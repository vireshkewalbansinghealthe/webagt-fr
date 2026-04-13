#!/usr/bin/env python3
"""
WebAGT Load Test — Interactive concurrent project generation tester with live dashboard.

Usage:
    python3 scripts/load-test.py

Requirements:
    pip install httpx rich questionary
"""

import asyncio
import json
import time
import random
import sys
import os
import re
from dataclasses import dataclass, field
from typing import Optional
from pathlib import Path

try:
    import httpx
    from rich.console import Console, Group
    from rich.table import Table
    from rich.live import Live
    from rich.panel import Panel
    from rich.layout import Layout
    from rich.text import Text
    from rich.columns import Columns
    from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeElapsedColumn
    from rich import box
    import questionary
    from questionary import Style
except ImportError:
    print("Installing dependencies...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "httpx", "rich", "questionary"])
    import httpx
    from rich.console import Console, Group
    from rich.table import Table
    from rich.live import Live
    from rich.panel import Panel
    from rich.layout import Layout
    from rich.text import Text
    from rich.columns import Columns
    from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeElapsedColumn
    from rich import box
    import questionary
    from questionary import Style

console = Console()


# ---------------------------------------------------------------------------
# Clerk auto-auth
# ---------------------------------------------------------------------------

def find_clerk_secret_key() -> Optional[str]:
    candidates = [
        Path(__file__).parent.parent / "worker" / ".dev.vars",
        Path.cwd() / "worker" / ".dev.vars",
    ]
    for p in candidates:
        if p.exists():
            content = p.read_text()
            match = re.search(r"CLERK_SECRET_KEY=(.+)", content)
            if match:
                return match.group(1).strip()
    return None


def find_admin_user_id(clerk_key: str) -> Optional[str]:
    try:
        res = httpx.get(
            "https://api.clerk.com/v1/users?limit=10&order_by=-last_active_at",
            headers={"Authorization": f"Bearer {clerk_key}"},
            timeout=10,
        )
        res.raise_for_status()
        users = res.json()
        if users:
            return users[0]["id"]
    except Exception:
        pass
    return None


class ClerkAuth:
    def __init__(self, secret_key: str, user_id: str):
        self.secret_key = secret_key
        self.user_id = user_id
        self._session_id: Optional[str] = None
        self._jwt: Optional[str] = None
        self._jwt_created: float = 0

    def _get_session_id_sync(self) -> str:
        if self._session_id:
            return self._session_id
        res = httpx.get(
            f"https://api.clerk.com/v1/sessions?user_id={self.user_id}&status=active",
            headers={"Authorization": f"Bearer {self.secret_key}"},
            timeout=10,
        )
        res.raise_for_status()
        sessions = res.json()
        if not sessions:
            raise RuntimeError(f"No active sessions for user {self.user_id}. Log in to the app first.")
        self._session_id = sessions[0]["id"]
        return self._session_id

    def get_token_sync(self) -> str:
        if self._jwt and (time.time() - self._jwt_created) < 30:
            return self._jwt
        sid = self._get_session_id_sync()
        res = httpx.post(
            f"https://api.clerk.com/v1/sessions/{sid}/tokens",
            headers={"Authorization": f"Bearer {self.secret_key}", "Content-Type": "application/json"},
            json={},
            timeout=10,
        )
        if res.status_code == 404:
            self._session_id = None
            return self.get_token_sync()
        res.raise_for_status()
        self._jwt = res.json()["jwt"]
        self._jwt_created = time.time()
        return self._jwt

    async def get_token(self) -> str:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.get_token_sync)


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

PROMPT_STYLE = Style([
    ("qmark", "fg:cyan bold"),
    ("question", "fg:white bold"),
    ("answer", "fg:green bold"),
    ("pointer", "fg:cyan bold"),
    ("highlighted", "fg:cyan bold"),
    ("selected", "fg:green"),
])

PROMPTS_WEBSHOP = [
    "Make me a modern webshop for selling handmade candles with a warm cozy aesthetic",
    "Create a plant shop with a lush green theme and 8 realistic products",
    "Build a sneaker store with a dark streetwear vibe and product filtering",
    "Design a coffee bean webshop with a minimalist brown/cream palette",
    "Make a pet accessories store with playful colors and a slide-out cart",
    "Create a vintage vinyl record shop with a retro 70s design",
    "Build a luxury watch store with an elegant black and gold theme",
    "Design a bakery webshop with pastels and a warm homey feel",
    "Make a tech gadgets store with a futuristic neon design",
    "Create a bookshop with a cozy library aesthetic and reading lists",
    "Build a fitness supplement store with a bold sporty design",
    "Design a jewelry shop with an elegant rose gold theme",
    "Make a craft beer webshop with a rustic brewery aesthetic",
    "Create a skincare products store with a clean minimal design",
    "Build a toy store with bright colors and fun animations",
    "Design a wine shop with an elegant burgundy and cream palette",
    "Make a surf gear webshop with ocean blues and beach vibes",
    "Create an organic grocery store with earth tones and fresh produce",
    "Build a guitar shop with a rock-and-roll theme",
    "Design a flower delivery webshop with soft watercolor aesthetics",
]

PROMPTS_WEBSITE = [
    "Create a portfolio website for a freelance photographer with a dark gallery layout",
    "Build a landing page for an AI startup with a modern gradient design",
    "Design a personal blog with a clean minimalist reading experience",
    "Make a restaurant website with menu, reservations, and food photography",
    "Create a fitness coach landing page with testimonials and booking",
    "Build a creative agency website with case studies and team section",
    "Design a podcast website with episode player and show notes",
    "Make an architecture firm portfolio with fullscreen project galleries",
    "Create a music artist website with tour dates and streaming links",
    "Build a nonprofit organization site with donation and volunteer pages",
]


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class GenerationResult:
    id: int
    project_id: Optional[str] = None
    project_name: str = ""
    prompt: str = ""
    status: str = "pending"
    started_at: float = 0
    completed_at: float = 0
    duration_ms: float = 0
    input_tokens: int = 0
    output_tokens: int = 0
    credits_used: int = 0
    api_cost_usd: float = 0
    credits_remaining: int = 0
    files_generated: int = 0
    error: Optional[str] = None
    chunks_received: int = 0
    events: list = field(default_factory=list)
    chunks_history: list = field(default_factory=list)


# ---------------------------------------------------------------------------
# Live dashboard
# ---------------------------------------------------------------------------

SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

def build_dashboard(results: list[GenerationResult], start_time: float, target: str, concurrent: int, credits_start: int) -> Group:
    elapsed = time.time() - start_time
    frame = SPINNER_FRAMES[int(elapsed * 8) % len(SPINNER_FRAMES)]

    active = sum(1 for r in results if r.status in ("running", "creating"))
    done = sum(1 for r in results if r.status in ("success", "failed", "timeout", "rate_limited"))
    succeeded = sum(1 for r in results if r.status == "success")
    failed = sum(1 for r in results if r.status in ("failed", "timeout", "rate_limited"))

    total_chunks = sum(r.chunks_received for r in results)
    total_in = sum(r.input_tokens for r in results)
    total_out = sum(r.output_tokens for r in results)
    total_cost = sum(r.api_cost_usd for r in results)
    total_credits = sum(r.credits_used for r in results)
    total_files = sum(r.files_generated for r in results)

    chunks_per_sec = total_chunks / elapsed if elapsed > 1 else 0
    tokens_per_sec = total_out / elapsed if elapsed > 1 else 0

    remaining_credits = credits_start - total_credits

    # --- Header ---
    header_text = Text()
    if active > 0:
        header_text.append(f" {frame} ", style="bold cyan")
        header_text.append("RUNNING", style="bold cyan")
    elif done == len(results):
        header_text.append(" ✅ ", style="bold green")
        header_text.append("COMPLETE", style="bold green")
    header_text.append(f"  │  ", style="dim")
    header_text.append(f"{target}", style="dim")
    header_text.append(f"  │  ", style="dim")
    header_text.append(f"{elapsed:.0f}s", style="bold white")

    header = Panel(header_text, style="cyan", box=box.HEAVY, padding=(0, 1))

    # --- Metrics bar ---
    def metric(label: str, value: str, color: str = "white") -> str:
        return f"[dim]{label}[/] [{color} bold]{value}[/]"

    metrics_parts = [
        metric("Active", str(active), "cyan" if active > 0 else "dim"),
        metric("Done", f"{done}/{len(results)}", "green" if done == len(results) else "yellow"),
        metric("Pass", f"{succeeded}", "green"),
        metric("Fail", f"{failed}", "red" if failed > 0 else "dim"),
        "│",
        metric("Chunks", f"{total_chunks:,}"),
        metric("ch/s", f"{chunks_per_sec:.0f}", "cyan"),
        "│",
        metric("Tokens", f"↑{total_in:,} ↓{total_out:,}"),
        metric("tok/s", f"{tokens_per_sec:.0f}", "cyan"),
    ]
    metrics_line1 = "   ".join(metrics_parts)

    metrics_parts2 = [
        metric("Cost", f"${total_cost:.4f}", "yellow"),
        metric("Credits", f"{total_credits} used", "yellow"),
        metric("Remaining", f"{remaining_credits}", "green" if remaining_credits > 20 else "red"),
        "│",
        metric("Files", f"{total_files}"),
    ]
    if succeeded > 0:
        avg_cost = total_cost / succeeded
        avg_credits = total_credits / succeeded
        avg_files = total_files / succeeded
        metrics_parts2.extend([
            "│",
            metric("Avg/gen", f"${avg_cost:.3f} / {avg_credits:.0f}cr / {avg_files:.0f} files", "dim"),
        ])
    metrics_line2 = "   ".join(metrics_parts2)

    metrics_panel = Panel(
        f"{metrics_line1}\n{metrics_line2}",
        title="[bold]Metrics[/]",
        border_style="blue",
        box=box.ROUNDED,
        padding=(0, 1),
    )

    # --- Generation table ---
    table = Table(
        box=box.SIMPLE_HEAVY,
        border_style="dim",
        pad_edge=False,
        show_edge=False,
        expand=True,
    )
    table.add_column("#", style="dim", width=3, justify="right")
    table.add_column("", width=2)
    table.add_column("Prompt", ratio=3, no_wrap=True)
    table.add_column("Progress", width=22)
    table.add_column("Time", width=7, justify="right")
    table.add_column("Chunks", width=7, justify="right")
    table.add_column("Tokens", width=16, justify="right")
    table.add_column("Cost", width=8, justify="right")
    table.add_column("Files", width=5, justify="right")

    for r in results:
        icon_map = {
            "pending":      ("⏳", "dim"),
            "creating":     ("📦", "yellow"),
            "running":      (frame, "cyan"),
            "success":      ("✅", "green"),
            "failed":       ("❌", "red"),
            "timeout":      ("⏰", "yellow"),
            "rate_limited": ("🚫", "red"),
        }
        icon, color = icon_map.get(r.status, ("?", "white"))

        el = ""
        if r.status == "running" and r.started_at:
            el = f"{time.time() - r.started_at:.0f}s"
        elif r.duration_ms > 0:
            el = f"{r.duration_ms / 1000:.0f}s"

        # Progress bar
        progress_text = ""
        if r.status == "running":
            bar_width = 16
            speed = 0
            if len(r.chunks_history) >= 2:
                dt = r.chunks_history[-1][0] - r.chunks_history[-4 if len(r.chunks_history) >= 4 else 0][0]
                dc = r.chunks_history[-1][1] - r.chunks_history[-4 if len(r.chunks_history) >= 4 else 0][1]
                speed = dc / dt if dt > 0 else 0
            filled = min(bar_width, int(r.chunks_received / 200 * bar_width))  # rough estimate
            bar = "█" * filled + "░" * (bar_width - filled)
            progress_text = f"[cyan]{bar}[/] [dim]{speed:.0f}ch/s[/]"
        elif r.status == "success":
            progress_text = f"[green]{'█' * 16}[/] [dim]done[/]"
        elif r.status == "failed":
            progress_text = f"[red]{'█' * 4}{'░' * 12}[/] [dim]err[/]"
        elif r.status == "creating":
            progress_text = f"[yellow]{'░' * 16}[/] [dim]init[/]"
        elif r.status == "pending":
            progress_text = f"[dim]{'░' * 16}  wait[/]"

        tokens = ""
        if r.input_tokens or r.output_tokens:
            tokens = f"[dim]↑[/]{r.input_tokens // 1000}K [dim]↓[/]{r.output_tokens // 1000}K"

        cost = ""
        if r.api_cost_usd:
            cost = f"[yellow]${r.api_cost_usd:.3f}[/]"

        prompt_display = r.prompt[:38] + "…" if len(r.prompt) > 38 else r.prompt
        if r.error and r.status == "failed":
            prompt_display = f"[red]{r.error[:38]}…[/]" if len(r.error or "") > 38 else f"[red]{r.error}[/]"

        table.add_row(
            f"[{color}]{r.id}[/]",
            f"[{color}]{icon}[/]",
            prompt_display if r.status != "failed" else prompt_display,
            progress_text,
            f"[{color}]{el}[/]",
            f"[dim]{r.chunks_received:,}[/]" if r.chunks_received else "",
            tokens,
            cost,
            str(r.files_generated) if r.files_generated else "",
        )

    gen_panel = Panel(
        table,
        title="[bold]Generations[/]",
        border_style="green" if done == len(results) and failed == 0 else "cyan",
        box=box.ROUNDED,
        padding=(0, 0),
    )

    # --- Throughput sparkline ---
    throughput_parts = []
    if elapsed > 5:
        window = 30
        now = time.time()
        buckets = []
        for i in range(min(60, int(elapsed))):
            t = now - i
            count = 0
            for r in results:
                for ts, ch in r.chunks_history:
                    if t - 1 <= ts < t:
                        count += 1
                        break
            buckets.append(count)
        buckets.reverse()

        spark_chars = "▁▂▃▄▅▆▇█"
        if buckets:
            max_b = max(buckets) or 1
            spark = ""
            for b in buckets[-40:]:
                idx = min(len(spark_chars) - 1, int(b / max_b * (len(spark_chars) - 1)))
                spark += spark_chars[idx]
            throughput_parts.append(f"[dim]Activity (last 40s):[/]  [cyan]{spark}[/]")

    if throughput_parts:
        throughput_panel = Panel(
            "\n".join(throughput_parts),
            title="[bold]Activity[/]",
            border_style="dim",
            box=box.ROUNDED,
            padding=(0, 1),
        )
        return Group(header, metrics_panel, gen_panel, throughput_panel)

    return Group(header, metrics_panel, gen_panel)


def build_summary(results: list[GenerationResult], wall_time: float, credits_start: int) -> Panel:
    succeeded = [r for r in results if r.status == "success"]
    failed = [r for r in results if r.status == "failed"]
    rate_limited = [r for r in results if r.status == "rate_limited"]
    timed_out = [r for r in results if r.status == "timeout"]

    total_input = sum(r.input_tokens for r in results)
    total_output = sum(r.output_tokens for r in results)
    total_credits = sum(r.credits_used for r in results)
    total_cost = sum(r.api_cost_usd for r in results)
    total_files = sum(r.files_generated for r in results)

    durations = [r.duration_ms / 1000 for r in succeeded]
    avg_dur = sum(durations) / len(durations) if durations else 0
    min_dur = min(durations) if durations else 0
    max_dur = max(durations) if durations else 0
    med_dur = sorted(durations)[len(durations) // 2] if durations else 0

    lines = []
    pct = len(succeeded) / len(results) * 100 if results else 0
    color = "green" if pct == 100 else "yellow" if pct >= 50 else "red"

    lines.append(f"[bold]RESULTS[/]")
    lines.append(f"  [{color}]✅ Succeeded:    {len(succeeded)}/{len(results)}  ({pct:.0f}%)[/]")
    if failed:
        lines.append(f"  [red]❌ Failed:       {len(failed)}[/]")
    if rate_limited:
        lines.append(f"  [red]🚫 Rate Limited: {len(rate_limited)}[/]")
    if timed_out:
        lines.append(f"  [yellow]⏰ Timed Out:    {len(timed_out)}[/]")

    lines.append("")
    lines.append(f"[bold]TIMING[/]")
    lines.append(f"  Wall time:  [bold]{wall_time:.1f}s[/]  ({wall_time/60:.1f} min)")
    if durations:
        lines.append(f"  Fastest:    [green]{min_dur:.1f}s[/]")
        lines.append(f"  Slowest:    [yellow]{max_dur:.1f}s[/]")
        lines.append(f"  Average:    {avg_dur:.1f}s")
        lines.append(f"  Median:     {med_dur:.1f}s")

    lines.append("")
    lines.append(f"[bold]TOKENS[/]")
    lines.append(f"  Input:      {total_input:,}")
    lines.append(f"  Output:     {total_output:,}")
    lines.append(f"  Total:      [bold]{total_input + total_output:,}[/]")
    if wall_time > 0:
        lines.append(f"  Throughput: {(total_input + total_output) / wall_time:.0f} tok/s")

    lines.append("")
    lines.append(f"[bold]COST[/]")
    lines.append(f"  API Cost:   [yellow bold]${total_cost:.4f}[/]")
    lines.append(f"  Credits:    {total_credits} used  ({credits_start} → {credits_start - total_credits})")
    if succeeded:
        lines.append(f"  Avg/Gen:    ${total_cost/len(succeeded):.4f}  /  {total_credits//len(succeeded)} cr")

    lines.append("")
    lines.append(f"[bold]FILES[/]")
    lines.append(f"  Total:      {total_files}")
    if succeeded:
        lines.append(f"  Avg/Gen:    {total_files//len(succeeded)}")

    if rate_limited:
        lines.append("")
        lines.append("[bold red]⚠️  RATE LIMIT WARNING[/]")
        lines.append(f"  {len(rate_limited)} requests were rate-limited by Anthropic.")
        lines.append("  Consider: upgrading tier, adding queue, or multi-provider fallback.")

    errors = [r for r in results if r.error]
    if errors:
        lines.append("")
        lines.append("[bold red]ERRORS[/]")
        for r in errors:
            lines.append(f"  [dim]#{r.id}[/] [red]{r.error[:100]}[/]")

    border = "green" if pct == 100 else "yellow" if pct >= 50 else "red"
    return Panel(
        "\n".join(lines),
        title="[bold]Load Test Report[/]",
        border_style=border,
        box=box.DOUBLE,
    )


# ---------------------------------------------------------------------------
# API calls
# ---------------------------------------------------------------------------

async def create_project(client: httpx.AsyncClient, target: str, auth: ClerkAuth, name: str, proj_type: str, concurrent: int = 1) -> dict:
    # Webshop creation is serialized via Stripe queue — ~4s per account, 2 accounts per project
    create_timeout = max(300, concurrent * 20)
    token = await auth.get_token()
    res = await client.post(
        f"{target}/api/projects",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"name": name, "model": "claude-sonnet-4-6", "type": proj_type},
        timeout=create_timeout,
    )
    res.raise_for_status()
    return res.json()["project"]


async def generate_project(
    client: httpx.AsyncClient,
    target: str,
    auth: ClerkAuth,
    project_id: str,
    prompt: str,
    result: GenerationResult,
    timeout_sec: int,
):
    try:
        token = await auth.get_token()
        async with client.stream(
            "POST",
            f"{target}/api/chat/{project_id}",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"message": prompt, "model": "claude-sonnet-4-6"},
            timeout=httpx.Timeout(timeout_sec, connect=15),
        ) as response:
            if response.status_code != 200:
                body = await response.aread()
                result.error = f"HTTP {response.status_code}: {body.decode()[:200]}"
                result.status = "failed"
                return

            buffer = ""
            got_done = False
            async for chunk in response.aiter_text():
                buffer += chunk
                while "\n" in buffer:
                    line, buffer = buffer.split("\n", 1)
                    line = line.strip()

                    if line.startswith("event: "):
                        event_type = line[7:]
                        result.events.append(event_type)
                        if event_type == "done":
                            got_done = True

                    if line.startswith("data: "):
                        result.chunks_received += 1
                        result.chunks_history.append((time.time(), result.chunks_received))
                        # Keep history manageable
                        if len(result.chunks_history) > 120:
                            result.chunks_history = result.chunks_history[-60:]
                        try:
                            data = json.loads(line[6:])
                            if "files" in data:
                                result.files_generated = len(data["files"])
                            if "tokenUsage" in data:
                                result.input_tokens = data["tokenUsage"].get("inputTokens", 0)
                                result.output_tokens = data["tokenUsage"].get("outputTokens", 0)
                                result.credits_used = data["tokenUsage"].get("creditsUsed", 0)
                                result.api_cost_usd = data["tokenUsage"].get("costUsd", 0)
                            if "creditsRemaining" in data:
                                result.credits_remaining = data["creditsRemaining"]
                            if "code" in data:
                                if "RATE_LIMITED" in data.get("code", "") or "429" in str(data):
                                    result.status = "rate_limited"
                                else:
                                    result.status = "failed"
                                result.error = f"{data.get('code')}: {data.get('message', '')}"
                                return
                        except json.JSONDecodeError:
                            pass

            if got_done:
                result.status = "success"
            else:
                result.status = "failed"
                result.error = f"Stream ended without 'done' event ({result.chunks_received} chunks — worker may have crashed)"

    except httpx.TimeoutException:
        result.status = "timeout"
        result.error = f"Timed out after {timeout_sec}s"
    except Exception as e:
        result.status = "failed"
        result.error = str(e)


async def run_single(
    client: httpx.AsyncClient,
    target: str,
    auth: ClerkAuth,
    result: GenerationResult,
    prompt: str,
    proj_type: str,
    timeout_sec: int,
    cleanup: bool,
    concurrent: int = 1,
):
    name = f"loadtest-{result.id}-{int(time.time())}"
    result.project_name = name
    result.prompt = prompt
    result.status = "creating"
    result.started_at = time.time()

    try:
        project = await create_project(client, target, auth, name, proj_type, concurrent)
        result.project_id = project["id"]
        result.status = "running"
        await generate_project(client, target, auth, project["id"], prompt, result, timeout_sec)
    except Exception as e:
        result.status = "failed"
        result.error = str(e)

    result.completed_at = time.time()
    result.duration_ms = (result.completed_at - result.started_at) * 1000

    if cleanup and result.project_id:
        try:
            token = await auth.get_token()
            await client.delete(
                f"{target}/api/projects/{result.project_id}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Main runner
# ---------------------------------------------------------------------------

async def run_load_test(
    target: str,
    auth: ClerkAuth,
    concurrent: int,
    proj_type: str,
    prompts: list[str],
    timeout_sec: int,
    cleanup: bool,
    credits_start: int,
    stagger: bool = False,
    custom_prompts: Optional[list[str]] = None,
):
    if custom_prompts:
        selected = custom_prompts
    else:
        selected = [prompts[i % len(prompts)] for i in range(concurrent)]
        random.shuffle(selected)

    results = [GenerationResult(id=i + 1) for i in range(concurrent)]
    start_time = time.time()

    async with httpx.AsyncClient() as client:
        with Live(
            build_dashboard(results, start_time, target, concurrent, credits_start),
            console=console,
            refresh_per_second=4,
            transient=False,
        ) as live:
            done_event = asyncio.Event()

            async def update_display():
                while not done_event.is_set():
                    live.update(build_dashboard(results, start_time, target, concurrent, credits_start))
                    await asyncio.sleep(0.25)

            if stagger:
                async def launch_with_delay(i):
                    await asyncio.sleep(random.uniform(0.5, 3.0) * i / max(1, concurrent - 1))
                    await run_single(client, target, auth, results[i], selected[i], proj_type, timeout_sec, cleanup, concurrent)

                tasks = [launch_with_delay(i) for i in range(concurrent)]
            else:
                tasks = [
                    run_single(client, target, auth, results[i], selected[i], proj_type, timeout_sec, cleanup, concurrent)
                    for i in range(concurrent)
                ]

            updater = asyncio.create_task(update_display())
            await asyncio.gather(*tasks)
            done_event.set()
            await updater

            live.update(build_dashboard(results, start_time, target, concurrent, credits_start))

    wall_time = time.time() - start_time
    console.print()
    console.print(build_summary(results, wall_time, credits_start))
    console.print()


# ---------------------------------------------------------------------------
# Interactive menu
# ---------------------------------------------------------------------------

def interactive_menu():
    console.print()
    console.print(Panel(
        "[bold cyan]WebAGT Load Test[/]\n"
        "[dim]Concurrent project generation stress tester with live dashboard[/]",
        border_style="cyan",
        box=box.DOUBLE,
    ))
    console.print()

    clerk_key = find_clerk_secret_key()
    if clerk_key:
        console.print(f"[green]✅ Found CLERK_SECRET_KEY in worker/.dev.vars[/]")
    else:
        clerk_key = questionary.password(
            "CLERK_SECRET_KEY not found. Paste it here:",
            style=PROMPT_STYLE,
        ).ask()
        if not clerk_key:
            console.print("[red]Clerk secret key is required.[/]")
            sys.exit(1)

    target = questionary.select(
        "Target environment:",
        choices=[
            questionary.Choice("Local (localhost:8787)", value="http://localhost:8787"),
            questionary.Choice("Dev (webagt-worker-dev.webagt.workers.dev)", value="https://webagt-worker-dev.webagt.workers.dev"),
            questionary.Choice("Production (webagt-worker-v2.webagt.workers.dev)", value="https://webagt-worker-v2.webagt.workers.dev"),
            questionary.Choice("Custom URL...", value="custom"),
        ],
        style=PROMPT_STYLE,
    ).ask()

    if target == "custom":
        target = questionary.text("Enter worker URL:", style=PROMPT_STYLE).ask()

    proj_type = questionary.select(
        "Project type:",
        choices=[
            questionary.Choice("Webshop (with Turso DB, products, cart)", value="webshop"),
            questionary.Choice("Website (simpler, no DB)", value="website"),
        ],
        style=PROMPT_STYLE,
    ).ask()

    concurrent = questionary.select(
        "How many concurrent generations?",
        choices=[
            questionary.Choice("1 — Baseline (single)", value=1),
            questionary.Choice("3 — Light load", value=3),
            questionary.Choice("5 — Moderate", value=5),
            questionary.Choice("10 — Heavy", value=10),
            questionary.Choice("15 — Stress test", value=15),
            questionary.Choice("20 — High stress", value=20),
            questionary.Choice("30 — Extreme", value=30),
            questionary.Choice("Custom...", value=0),
        ],
        style=PROMPT_STYLE,
    ).ask()

    if concurrent == 0:
        concurrent = int(questionary.text("Enter number:", style=PROMPT_STYLE).ask() or "3")

    prompt_choice = questionary.select(
        "Prompts to use:",
        choices=[
            questionary.Choice("Random from built-in pool (recommended)", value="random"),
            questionary.Choice("All the same prompt", value="same"),
            questionary.Choice("Enter custom prompts", value="custom"),
        ],
        style=PROMPT_STYLE,
    ).ask()

    custom_prompts = None
    if prompt_choice == "same":
        prompt = questionary.text(
            "Enter the prompt for all generations:",
            default="Make me a modern webshop for selling handmade candles",
            style=PROMPT_STYLE,
        ).ask()
        custom_prompts = [prompt] * concurrent
    elif prompt_choice == "custom":
        console.print("[dim]Enter one prompt per line. Empty line to finish.[/]")
        custom_prompts = []
        while True:
            p = questionary.text(f"Prompt {len(custom_prompts) + 1}:", style=PROMPT_STYLE).ask()
            if not p:
                break
            custom_prompts.append(p)
        if len(custom_prompts) < concurrent:
            custom_prompts = [custom_prompts[i % len(custom_prompts)] for i in range(concurrent)]

    timeout_sec = questionary.select(
        "Timeout per generation:",
        choices=[
            questionary.Choice("3 minutes (short)", value=180),
            questionary.Choice("5 minutes (normal)", value=300),
            questionary.Choice("10 minutes (safe)", value=600),
            questionary.Choice("15 minutes (long)", value=900),
        ],
        style=PROMPT_STYLE,
    ).ask()

    cleanup = questionary.confirm(
        "Delete test projects after completion?",
        default=True,
        style=PROMPT_STYLE,
    ).ask()

    stagger = questionary.confirm(
        "Stagger requests? (1-3s delay between launches — recommended for 3+)",
        default=concurrent >= 3,
        style=PROMPT_STYLE,
    ).ask()

    # Auth
    console.print("\n[dim]Setting up authentication...[/]")
    user_id = find_admin_user_id(clerk_key)
    if not user_id:
        console.print("[red]Could not find any users in Clerk.[/]")
        sys.exit(1)
    auth = ClerkAuth(clerk_key, user_id)

    credits_start = 0
    try:
        token = auth.get_token_sync()
        console.print(f"[green]✅ Authenticated as {user_id}[/]")

        res = httpx.get(
            f"{target}/api/credits",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        if res.status_code != 200:
            console.print(f"[red]API verification failed: HTTP {res.status_code}[/]")
            console.print(f"[dim]{res.text[:200]}[/]")
            sys.exit(1)
        credits = res.json()
        credits_start = credits.get("remaining", 0)
        console.print(f"[green]✅ API reachable — {credits_start} credits remaining[/]")

        estimated = concurrent * 10
        if credits_start < estimated:
            console.print(f"[yellow]⚠️  {credits_start} credits may not be enough for {concurrent} generations (~{estimated} estimated)[/]")
            if not questionary.confirm("Continue anyway?", default=False, style=PROMPT_STYLE).ask():
                sys.exit(0)
    except Exception as e:
        console.print(f"[red]Auth failed: {e}[/]")
        sys.exit(1)

    console.print()
    if not questionary.confirm(
        f"Launch {concurrent} concurrent generations against {target}?",
        default=True,
        style=PROMPT_STYLE,
    ).ask():
        console.print("[dim]Cancelled.[/]")
        sys.exit(0)

    prompts = PROMPTS_WEBSHOP if proj_type == "webshop" else PROMPTS_WEBSITE

    console.print()
    asyncio.run(run_load_test(
        target, auth, concurrent, proj_type, prompts,
        timeout_sec, cleanup, credits_start, stagger, custom_prompts,
    ))


if __name__ == "__main__":
    try:
        interactive_menu()
    except KeyboardInterrupt:
        console.print("\n[dim]Interrupted.[/]")
        sys.exit(0)
