#!/bin/bash

# scripts/run_deploy.sh
# Checks authentication and deploys to Vercel, Cloudflare, and Fly.io.

set -e # Exit on any error

echo "🚢 Starting full deployment for Web AGT..."

# 1. Check & Deploy Cloudflare Worker
echo "------------------------------------------------"
echo "☁️  Checking Cloudflare (Wrangler) authentication..."
if ! npx wrangler whoami > /dev/null 2>&1; then
    echo "❌ Not logged into Cloudflare. Please login:"
    npx wrangler login
else
    echo "✅ Cloudflare: Authenticated"
fi

echo "🚀 Deploying Worker..."
(cd worker && npm run deploy)


# 2. Check & Deploy Fly.io Chat Service
echo "------------------------------------------------"
echo "🎈 Checking Fly.io authentication..."
if ! fly auth whoami > /dev/null 2>&1; then
    echo "❌ Not logged into Fly.io. Please login:"
    fly auth login
else
    echo "✅ Fly.io: Authenticated"
fi

echo "🚀 Deploying Fly-Chat..."
(cd fly-chat && fly deploy)


# 3. Check & Deploy Vercel Frontend
echo "------------------------------------------------"
echo "▲ Checking Vercel authentication..."
if ! npx vercel whoami > /dev/null 2>&1; then
    echo "❌ Not logged into Vercel. Please login:"
    npx vercel login
else
    echo "✅ Vercel: Authenticated"
fi

echo "🚀 Deploying Frontend to Vercel (Production)..."
npx vercel --prod --yes


echo "------------------------------------------------"
echo "✨ ALL DEPLOYMENTS COMPLETE!"
echo "------------------------------------------------"
