#!/bin/bash

# scripts/run_remote.sh
# Starts the development environment using REMOTE production databases.

echo "🌍 Starting Web AGT in REMOTE mode..."
echo "🔗 Connecting to production Cloudflare KV/R2"

# Trap SIGINT (Ctrl+C) to kill all background processes
trap "kill 0" SIGINT

# 1. Start Cloudflare Worker with --remote
echo "🔹 Starting Worker (Remote)..."
(cd worker && npx wrangler dev --remote) &

# 2. Start Next.js Frontend
echo "🔹 Starting Frontend..."
npm run dev &

# Wait for all processes
wait
