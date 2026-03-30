import Link from "next/link";
import { Navbar } from "@/components/landing";
import { ArrowLeft, Zap, Globe, Users, Shield, Code2, Rocket } from "lucide-react";

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
    <div className="relative min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-4xl px-6 pb-24 pt-28">
        {/* Back link */}
        <Link
          href="/"
          className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to home
        </Link>

        {/* Hero */}
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center rounded-full border border-border bg-muted/40 px-4 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-widest">
            About WebAGT
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            We're building the fastest way<br className="hidden sm:block" /> from idea to live product.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            WebAGT is an AI-powered development platform that turns plain text descriptions into fully
            functional web apps — with database, payments, and live preview included.
          </p>
        </div>

        {/* Mission */}
        <section className="mb-16 rounded-2xl border border-border bg-muted/20 p-8">
          <h2 className="text-xl font-bold mb-4">Our Mission</h2>
          <p className="text-muted-foreground leading-relaxed">
            The gap between having an idea and shipping a product has always been too wide.
            It requires writing code, setting up infrastructure, integrating APIs, and deploying — all
            before you've validated a single assumption.
          </p>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            WebAGT closes that gap. We combine the latest AI models with a production-ready
            infrastructure layer so that describing what you want <em>is</em> building it.
            Stop coding. Start building.
          </p>
        </section>

        {/* Values */}
        <section className="mb-16">
          <h2 className="text-xl font-bold mb-8">What we stand for</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {values.map((value) => (
              <div
                key={value.title}
                className="rounded-xl border border-border bg-muted/10 p-6 hover:bg-muted/20 transition-colors"
              >
                <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <value.icon className="size-5" />
                </div>
                <h3 className="mb-2 font-semibold">{value.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Stack */}
        <section className="mb-16 rounded-2xl border border-border bg-muted/20 p-8">
          <h2 className="text-xl font-bold mb-4">Built on modern infrastructure</h2>
          <p className="text-muted-foreground leading-relaxed mb-6">
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
        <section className="text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to build something?</h2>
          <p className="text-muted-foreground mb-8">
            Join thousands of builders who ship faster with WebAGT.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Link
              href="/sign-up"
              className="inline-flex h-10 items-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Get started free
            </Link>
            <Link
              href="/help"
              className="inline-flex h-10 items-center rounded-lg border border-border px-6 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
            >
              Visit Help Center
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
