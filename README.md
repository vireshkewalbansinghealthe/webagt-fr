# Web AGT — AI-Powered Web App Builder

Web AGT is a powerful platform where users can describe web applications in natural language and receive working React + Tailwind code with a live in-browser preview. It streamlines the development process by leveraging state-of-the-art AI models to generate, iterate, and deploy full-stack applications.

## Features

- **Natural Language to Code** — Describe what you want, get a working React app in seconds.
- **Live Preview** — Sandpack-powered in-browser preview that updates in real time as the AI generates code.
- **Full Code Editor** — Integrated Monaco Editor (the engine behind VS Code) with a full file explorer for manual adjustments.
- **Multi-Model Intelligence** — Support for 8+ AI models including Claude 3.5/3.7, GPT-4o, Gemini 2.0, and DeepSeek.
- **Async Streaming** — Refresh-safe Server-Sent Events (SSE) for real-time code generation that continues in the background.
- **Version Control** — Visual timeline view with diff viewer and one-click restoration of previous versions.
- **Vision Support** — Upload screenshots or wireframes to guide the AI's design process.
- **Auto-Healing** — Automatically detects and suggests fixes for build and runtime errors.
- **ZIP Export** — Download your generated projects as standalone, production-ready Vite applications.
- **Professional Auth & Billing** — Integrated with Clerk for secure authentication and credit-based usage management.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16 + React 19 (Vercel) |
| **UI Components** | shadcn/ui + Radix UI |
| **Styling** | Tailwind CSS v4 |
| **Auth & Billing** | Clerk |
| **Backend API** | Cloudflare Workers + Hono |
| **AI Generator** | Node.js + Hono (Fly.io) |
| **File Storage** | Cloudflare R2 |
| **Metadata Store** | Cloudflare KV |
| **Code Preview** | Sandpack (CodeSandbox) |
| **Code Editor** | Monaco Editor |
| **Streaming** | Server-Sent Events (SSE) |

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- A [Clerk](https://clerk.com) account (Authentication)
- A [Cloudflare](https://cloudflare.com) account (Workers, KV, R2)
- AI Provider API Keys (Anthropic, OpenAI, Google, or DeepSeek)

### 1. Installation

Install dependencies for both the frontend and the worker:

```bash
# Root (Frontend)
npm install

# Backend
cd worker && npm install
```

### 2. Configuration

**Frontend** — Create `.env.local` in the project root:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_WORKER_URL=http://localhost:8787
NEXT_PUBLIC_CHAT_URL=https://webagt-chat.fly.dev
```

**Worker** — Create `.dev.vars` in the `worker/` directory:

```env
CLERK_SECRET_KEY=sk_test_...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

### 3. Development

Use the provided scripts to start the environment:

```bash
# Start with local database simulators
./scripts/run_local.sh

# Start connected to production data (Sync with Fly.io)
./scripts/run_remote.sh
```

## Project Structure

```
Web AGT/
├── app/                          # Next.js App Router (UI & Auth)
├── components/                   # React components (Dashboard, Editor, UI)
├── lib/                          # API client & shared utilities
├── types/                        # Shared TypeScript definitions
├── worker/                       # Cloudflare Worker (Metadata, Billing, Versions)
│   └── src/
│       ├── routes/               # API endpoints
│       └── services/             # Core business logic
└── fly-chat/                     # AI Generation Service (Fly.io)
    └── src/
        ├── routes/               # SSE Streaming & Stop logic
        └── ai/                   # AI System prompts & providers
```

## Deployment

Web AGT uses a multi-platform deployment strategy for optimal performance:
- **Frontend**: Vercel
- **Metadata API**: Cloudflare Workers
- **AI Streaming**: Fly.io

For detailed deployment instructions and architecture diagrams, see **[DEPLOY.md](DEPLOY.md)**.

You can also use the automated deployment script:
```bash
./scripts/run_deploy.sh
```

## License

Copyright © 2026 Web AGT. All rights reserved.
