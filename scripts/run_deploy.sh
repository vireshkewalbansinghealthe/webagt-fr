#!/bin/bash

# scripts/run_deploy.sh
#
# Deploy Web AGT to the target environment.
#
# Usage:
#   ./scripts/run_deploy.sh          # sync dev → master, deploy PRODUCTION
#   ./scripts/run_deploy.sh dev      # deploy DEV worker + push dev branch
#
# Production flow (default):
#   1. Verify you're on dev with no uncommitted changes
#   2. Push dev branch to remote
#   3. Merge dev → master and push master
#   4. Deploy Worker  → webagt-worker-prod   (Cloudflare)
#   5. Deploy Chat    → webagt-chat.fly.dev  (Fly.io)
#   6. Deploy Frontend → www.webagt.ai       (Vercel --prod)
#   7. Switch back to dev
#
# Dev flow:
#   - Worker  → webagt-worker-dev    (Cloudflare --env dev)
#   - Frontend → dev.webagt.ai       (Vercel preview via git push)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
ENV="${1:-prod}"

cd "$ROOT"

# ─────────────────────────────────────────────────────────────────────────────
if [ "$ENV" = "dev" ]; then
# ─────────────────────────────────────────────────────────────────────────────

  echo "🛠️  Deploying Web AGT → DEV environment"
  echo ""

  echo "☁️  Deploying Worker (dev)..."
  (cd worker && npx wrangler deploy --env dev)
  echo "✅ Worker deployed → webagt-worker-dev.webagt.workers.dev"

  echo ""
  echo "▲  Pushing dev branch → Vercel auto-builds dev.webagt.ai"
  git push origin dev
  echo "✅ Frontend push done — check Vercel dashboard for build status"

# ─────────────────────────────────────────────────────────────────────────────
else
# ─────────────────────────────────────────────────────────────────────────────

  echo "🚢 Deploying Web AGT → PRODUCTION"
  echo ""

  # ── 1. Git checks ──────────────────────────────────────────────────────────
  CURRENT_BRANCH=$(git branch --show-current)
  if [ "$CURRENT_BRANCH" != "dev" ]; then
    echo "❌ You must be on the 'dev' branch to deploy to production."
    echo "   Currently on: $CURRENT_BRANCH"
    echo "   Run: git checkout dev"
    exit 1
  fi

  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "❌ You have uncommitted changes. Commit or stash them first."
    git status --short
    exit 1
  fi

  # ── 2. Push dev → remote ───────────────────────────────────────────────────
  echo "📤 Pushing dev branch..."
  git push origin dev
  echo "✅ dev pushed"

  # ── 3. Merge dev → master ──────────────────────────────────────────────────
  echo ""
  echo "🔀 Merging dev → master..."
  git checkout master
  git merge dev --no-edit
  git push origin master
  echo "✅ master is up to date"
  git checkout dev

  # ── 4. Cloudflare Worker ───────────────────────────────────────────────────
  echo ""
  echo "☁️  Deploying Worker (prod)..."
  (cd worker && npx wrangler deploy)
  echo "✅ Worker deployed → webagt-worker-prod.webagt.workers.dev"

  # ── 5. Fly.io Chat ─────────────────────────────────────────────────────────
  echo ""
  echo "🎈 Deploying Fly-Chat..."
  if ! fly auth whoami > /dev/null 2>&1; then
    echo "❌ Not logged into Fly.io — run: fly auth login"
    exit 1
  fi
  (cd fly-chat && fly deploy)
  echo "✅ Fly-Chat deployed → webagt-chat.fly.dev"

  # ── 6. Vercel Frontend ─────────────────────────────────────────────────────
  echo ""
  echo "▲  Deploying Frontend (prod)..."
  if ! npx vercel whoami > /dev/null 2>&1; then
    echo "❌ Not logged into Vercel — run: npx vercel login"
    exit 1
  fi
  npx vercel --prod --yes
  echo "✅ Frontend deployed → www.webagt.ai"

fi

echo ""
echo "✨ Deploy complete! ($ENV)"
