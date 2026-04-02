#!/bin/bash

# scripts/run_deploy.sh
#
# Deploy Web AGT to the target environment.
#
# Usage:
#   ./scripts/run_deploy.sh          # deploy to PRODUCTION (master)
#   ./scripts/run_deploy.sh dev      # deploy to DEV (dev branch)
#
# Production deploys:
#   - Worker  → webagt-worker-prod   (Cloudflare)
#   - Chat    → webagt-chat.fly.dev  (Fly.io)
#   - Frontend → www.webagt.ai       (Vercel --prod)
#
# Dev deploys:
#   - Worker  → webagt-worker-dev    (Cloudflare --env dev)
#   - Chat    → same Fly.io (shared for now)
#   - Frontend → dev.webagt.ai       (Vercel preview via git push)

set -e

ENV="${1:-prod}"

if [ "$ENV" = "dev" ]; then
  echo "🛠️  Deploying Web AGT → DEV environment"
  echo ""

  echo "☁️  Deploying Worker (dev)..."
  (cd worker && npx wrangler deploy --env dev)
  echo "✅ Worker deployed → webagt-worker-dev.webagt.workers.dev"

  echo ""
  echo "▲  Pushing dev branch → Vercel will auto-build dev.webagt.ai"
  git push origin dev
  echo "✅ Frontend push done — check Vercel dashboard for build status"

else
  echo "🚢 Deploying Web AGT → PRODUCTION"
  echo ""

  # Cloudflare Worker
  echo "☁️  Deploying Worker (prod)..."
  (cd worker && npx wrangler deploy)
  echo "✅ Worker deployed → webagt-worker-prod.webagt.workers.dev"

  # Fly.io Chat
  echo ""
  echo "🎈 Deploying Fly-Chat..."
  if ! fly auth whoami > /dev/null 2>&1; then
    echo "❌ Not logged into Fly.io — run: fly auth login"
    exit 1
  fi
  (cd fly-chat && fly deploy)
  echo "✅ Fly-Chat deployed → webagt-chat.fly.dev"

  # Vercel Frontend
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
