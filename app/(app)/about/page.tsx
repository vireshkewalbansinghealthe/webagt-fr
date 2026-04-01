import { Zap, Globe, Users, Shield, Code2, Rocket } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "About — WebAGT",
  description: "Learn about WebAGT, our mission, and the team behind the platform.",
};

const values = [
  {
    icon: Zap,
    title: "Speed First",
    description:
      "We believe every idea deserves to be live within minutes, not months. Speed is built into everything we do.",
  },
  {
    icon: Globe,
    title: "Built for Builders",
    description:
      "Whether you're a solo founder, a marketer, or a developer, WebAGT adapts to how you think and work.",
  },
  {
    icon: Shield,
    title: "Production Ready",
    description:
      "We don't generate toy apps. Every project comes with real database support, payments, and deployment-ready code.",
  },
  {
    icon: Code2,
    title: "Open & Transparent",
    description:
      "You always own your code. Export it, host it yourself, or keep iterating with AI — your choice.",
  },
  {
    icon: Users,
    title: "Community Driven",
    description:
      "We shape the product around real user feedback. If something doesn't work for you, we want to know.",
  },
  {
    icon: Rocket,
    title: "Constantly Evolving",
    description:
      "New models, new capabilities, new integrations — we ship improvements every week.",
  },
];

export default function AboutPage() {
  return (
    <div className="flex flex-col gap-8 p-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">About WebAGT</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We're building the fastest way from idea to live product.
        </p>
      </div>

      {/* Mission */}
      <section className="rounded-2xl border border-border bg-muted/20 p-6">
        <h2 className="text-lg font-bold mb-3">Our Mission</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The gap between having an idea and shipping a product has always been too wide.
          It requires writing code, setting up infrastructure, integrating APIs, and deploying — all
          before you've validated a single assumption.
        </p>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          WebAGT closes that gap. We combine the latest AI models with a production-ready
          infrastructure layer so that describing what you want <em>is</em> building it.
          Stop coding. Start building.
        </p>
      </section>

      {/* Values */}
      <section>
        <h2 className="text-lg font-bold mb-5">What we stand for</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {values.map((value) => (
            <div
              key={value.title}
              className="rounded-xl border border-border bg-muted/10 p-5 hover:bg-muted/20 transition-colors"
            >
              <div className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <value.icon className="size-4" />
              </div>
              <h3 className="mb-1.5 font-semibold text-sm">{value.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {value.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Stack */}
      <section className="rounded-2xl border border-border bg-muted/20 p-6">
        <h2 className="text-lg font-bold mb-3">Built on modern infrastructure</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-5">
          WebAGT runs on a battle-tested stack designed for speed, reliability, and scale.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["Frontend", "Next.js 15, Tailwind CSS, Shadcn/ui"],
            ["AI Models", "Claude, GPT-4o, Gemini, DeepSeek"],
            ["Backend", "Cloudflare Workers + Hono"],
            ["Storage", "Cloudflare KV, R2, Supabase"],
            ["Auth & Billing", "Clerk"],
            ["Databases", "Turso (SQLite at the edge)"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-start gap-3">
              <span className="mt-0.5 min-w-[100px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
              </span>
              <span className="text-sm text-foreground">{value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-border bg-muted/10 p-6 text-center">
        <h2 className="text-lg font-bold mb-2">Ready to build something?</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Join thousands of builders who ship faster with WebAGT.
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/help"
            className="inline-flex h-9 items-center rounded-lg border border-border px-5 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
          >
            Visit Help Center
          </Link>
        </div>
      </section>
    </div>
  );
}
