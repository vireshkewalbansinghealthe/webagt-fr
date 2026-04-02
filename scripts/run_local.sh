#!/bin/bash

# scripts/run_local.sh
#
# Starts the LOCAL dev environment:
#   - Cloudflare Worker on http://localhost:8787  (dev KV/R2 via remote bindings)
#   - Next.js frontend    on http://localhost:3000 (dev Clerk keys from .env.local)
#
# Kills any stale processes on those ports first.
# Ctrl+C stops both cleanly.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

# ── Cleanup ───────────────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo "🛑 Shutting down..."
  kill -- -$$ 2>/dev/null || true
  wait 2>/dev/null || true
  echo "✅ All processes stopped."
}
trap cleanup EXIT INT TERM HUP

kill_port() {
  local port=$1
  local pids
  pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "⚠️  Port $port in use — killing PID(s): $pids"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 0.5
  fi
}

echo "🚀 Starting Web AGT — LOCAL DEV"
echo "   Worker  → http://localhost:8787  (dev KV)"
echo "   Frontend → http://localhost:3000  (dev Clerk)"
echo ""

kill_port 8787
kill_port 3000
rm -f "$ROOT/.next/dev/lock" 2>/dev/null || true

# Redirect stdin to /dev/null so background processes never block on TTY reads
# (wrangler sometimes prompts interactively; without this it suspends silently)
(cd "$ROOT/worker" && npx wrangler dev --env dev </dev/null) &
WORKER_PID=$!

(cd "$ROOT" && npm run dev </dev/null) &
FRONTEND_PID=$!

echo "✅ Both started (worker PID $WORKER_PID, frontend PID $FRONTEND_PID)"
echo "   Press Ctrl+C to stop."
echo ""

wait $WORKER_PID $FRONTEND_PID
