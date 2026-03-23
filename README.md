# Web AGT — AI-Powered Web App Builder

An open-source clone of [lovable.dev](https://lovable.dev) where users describe applications in natural language and receive working React + Tailwind code with a live in-browser preview. Built as a **YouTube tutorial series** with heavily commented, educational code.

## Features

- **Natural Language to Code** — Describe what you want, get a working React app
- **Live Preview** — Sandpack-powered in-browser preview updates in real time
- **Code Editor** — Monaco Editor (VS Code engine) with full file explorer
- **8 AI Models** — Claude, GPT-4o, Gemini 2.0, and DeepSeek with per-model credit costs
- **Streaming Responses** — Server-Sent Events for real-time AI code generation
- **Version History** — Timeline view, diff viewer, and one-click restore
- **Image Upload** — Attach screenshots to prompts for vision-capable models
- **Auto-Heal** — Automatically detects and fixes build/runtime errors
- **ZIP Export** — Download your generated project as a ZIP file
- **Freemium Billing** — Clerk-powered subscriptions with credit-based usage
- **Dark / Light Mode** — Dark-first design matching Lovable's aesthetic
- **Fully Responsive** — Works on mobile, tablet, and desktop

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 + React 19 |
| UI Components | shadcn/ui + Radix UI |
| Styling | Tailwind CSS v4 |
| Auth & Billing | Clerk |
| Backend API | Cloudflare Workers + Hono |
| File Storage | Cloudflare R2 |
| Metadata Store | Cloudflare KV |
| Code Preview | Sandpack (CodeSandbox) |
| Code Editor | Monaco Editor |
| AI Models | Claude, GPT-4o, Gemini 2.0, DeepSeek |
| Streaming | Server-Sent Events (SSE) |

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- A [Clerk](https://clerk.com) account (auth & billing)
- A [Cloudflare](https://cloudflare.com) account (Workers, KV, R2)
- At least one AI provider API key (Anthropic, OpenAI, Google, or DeepSeek)

### 1. Clone the repository

```bash
git clone https://github.com/koolkishan/nextjs-lovable-clone.git
cd nextjs-lovable-clone
```

### 2. Install dependencies

```bash
# Frontend
npm install

# Worker
cd worker && npm install
```

### 3. Configure environment variables

**Frontend** — create `.env.local` in the project root:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_WORKER_URL=http://localhost:8787
```

**Worker** — create `.dev.vars` in the `worker/` directory:

```env
CLERK_ISSUER=https://your-clerk-domain.clerk.accounts.dev
CLERK_JWKS_URL=https://your-clerk-domain.clerk.accounts.dev/.well-known/jwks.json
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=...
DEEPSEEK_API_KEY=...
```

### 4. Start development servers

```bash
# Terminal 1 — Frontend (port 3000)
npm run dev

# Terminal 2 — Worker (port 8787)
cd worker && npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Project Structure

```
nextjs-lovable-clone/
├── app/
│   ├── (marketing)/              # Landing & pricing pages
│   ├── (auth)/                   # Sign-in / sign-up (Clerk)
│   ├── (app)/                    # Dashboard, editor, settings
│   └── api/webhooks/             # Clerk billing webhooks
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── landing/                  # Landing page sections
│   ├── dashboard/                # Project grid, cards, dialogs
│   └── editor/                   # Chat, preview, code editor, versions
├── lib/                          # Utilities & API client
├── types/                        # Shared TypeScript definitions
├── docs/                         # Phase guides & architecture docs
└── worker/                       # Cloudflare Worker backend
    └── src/
        ├── routes/               # Projects, chat, versions, export
        ├── ai/                   # System prompt, file parser, providers
        │   └── providers/        # Anthropic, OpenAI, Google, DeepSeek
        ├── middleware/            # Clerk JWT auth
        └── services/             # Credits & billing logic
```

## Supported AI Models

| Model | Provider | Speed | Credits |
|-------|----------|-------|---------|
| Claude Sonnet 4.5 | Anthropic | Medium | 2 |
| Claude Haiku 3.5 | Anthropic | Fast | 1 |
| GPT-4o | OpenAI | Medium | 2 |
| GPT-4o-mini | OpenAI | Fast | 1 |
| Gemini 2.0 Flash | Google | Very Fast | 1 |
| Gemini 2.0 Pro | Google | Medium | 2 |
| DeepSeek V3 | DeepSeek | Fast | 1 |
| DeepSeek R1 | DeepSeek | Medium | 1 |

## Billing Plans

| Feature | Free | Pro ($25/mo) |
|---------|------|-------------|
| Messages / month | 50 | Unlimited |
| Projects | 3 | Unlimited |
| Models | Fast tier only | All models |
| Export | No | Yes |

## Available Scripts

```bash
# Frontend (project root)
npm run dev              # Start Next.js dev server
npx next build           # Production build
npm run lint             # ESLint

# Worker (worker/ directory)
npm run dev              # Start Cloudflare Worker dev server
npm run deploy           # Deploy Worker to Cloudflare
npm run typecheck        # TypeScript type check
```

## Documentation

Detailed docs live in the `docs/` directory:

- **PLAN.md** — Master implementation plan
- **ARCHITECTURE.md** — System architecture & data flows
- **AI-COST-ANALYSIS.md** — Token usage & cost breakdowns
- **phase-1 through phase-9** — Step-by-step phase guides

## Development Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Foundation (auth, routing, Worker skeleton) | Done |
| 2 | Landing & Dashboard (UI, project CRUD) | Done |
| 3 | Editor View (chat, Sandpack, Monaco) | Done |
| 4 | AI Engine (streaming, file parsing, providers) | Done |
| 5 | Versioning (timeline, diff viewer, restore) | Done |
| 6 | Billing (credits, pricing, plan gating) | Done |
| 7 | Multi-Model Switching (8 models, cost tiers) | Done |
| 8 | Export & Polish (ZIP export, UX polish) | In Progress |
| 9 | Agentic Generation | Planned |

## License

This project is for educational purposes as part of a YouTube tutorial series.
