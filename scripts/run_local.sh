#!/bin/bash

# scripts/run_local.sh
# Starts the local dev environment (Wrangler worker + Next.js frontend).
# - Kills any already-running instances on ports 8787 and 3000 before starting.
# - Cleans up all child processes on exit (Ctrl+C, terminal close, SIGTERM).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

# ── Cleanup: kill all child processes in this group ──────────────────────────
cleanup() {
  echo ""
  echo "🛑 Shutting down..."
  # Kill everything in our process group
  kill -- -$$ 2>/dev/null || true
  wait 2>/dev/null || true
  echo "✅ All processes stopped."
}

trap cleanup EXIT INT TERM HUP

# ── Kill anything already on port 8787 (wrangler) or 3000 (next.js) ─────────
kill_port() {
  local port=$1
  local pids
  pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "⚠️  Port $port already in use — killing PID(s): $pids"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 0.5
  fi
}

echo "🚀 Starting Web AGT in LOCAL mode..."
echo "📦 Using local KV/R2 simulators"

kill_port 8787
kill_port 3000

# Clear stale Next.js dev lock (left behind after crashes)
rm -f "$ROOT/.next/dev/lock" 2>/dev/null || true

# ── Start in process group so cleanup can kill all children ──────────────────
set -m  # enable job control / process groups

echo ""
echo "🔹 Starting Worker  → http://localhost:8787 (remote KV/R2)"
(cd "$ROOT/worker" && npx wrangler dev --remote) &
WORKER_PID=$!

echo "🔹 Starting Frontend → http://localhost:3000"
(cd "$ROOT" && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "✅ Both services started (worker PID $WORKER_PID, frontend PID $FRONTEND_PID)"
echo "   Press Ctrl+C to stop everything."
echo ""

# Wait for both; if either dies, exit (which triggers cleanup)
wait $WORKER_PID $FRONTEND_PID
