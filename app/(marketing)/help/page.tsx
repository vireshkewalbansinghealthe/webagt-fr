import Link from "next/link";
import { Navbar } from "@/components/landing";
import {
  ArrowLeft,
  BookOpen,
  Zap,
  MessageCircle,
  FileText,
  Video,
  Mail,
  ChevronRight,
} from "lucide-react";

export const metadata = {
  title: "Help & Support — WebAGT",
  description: "Find answers, guides, and get support for WebAGT.",
};

const faqs = [
  {
    q: "What is WebAGT?",
    a: "WebAGT is an AI-powered platform that turns plain text descriptions into fully functional web apps. You describe what you want, and AI generates the code — with live preview, database support, and Stripe payments built in.",
  },
  {
    q: "Do I need to know how to code?",
    a: "No. WebAGT is designed for everyone — founders, marketers, and designers — not just developers. You describe your idea in plain language and the AI handles the code.",
  },
  {
    q: "What can I build with WebAGT?",
    a: "You can build websites, landing pages, web apps, and fully functional webshops with Stripe checkout. Each project comes with a live preview and export option.",
  },
  {
    q: "Can I export my code?",
    a: "Yes. Every project can be exported as a complete, standalone Vite + React app. You own your code entirely.",
  },
  {
    q: "Which AI models are available?",
    a: "WebAGT supports Claude (Anthropic), GPT-4o (OpenAI), Gemini (Google), and DeepSeek. Pro users have access to premium models for more complex projects.",
  },
  {
    q: "How does billing work?",
    a: "The free plan includes a set of credits per month. Pro plan gives you unlimited credits, access to premium AI models, and priority support. You can upgrade or cancel anytime from Settings.",
  },
  {
    q: "How do I add images to my project?",
    a: "In the editor chat, click the attachment icon to upload images. The AI will reference your images directly in the generated code via their public URL.",
  },
  {
    q: "Is my project data private?",
    a: "Yes. Your projects are private to your account and never shared. All data is stored securely on Cloudflare infrastructure.",
  },
];

const resources = [
  {
    icon: Zap,
    title: "Quick Start",
    description: "Build your first project in under 5 minutes.",
    href: "#quick-start",
  },
  {
    icon: BookOpen,
    title: "Documentation",
    description: "In-depth guides for all features.",
    href: "#docs",
  },
  {
    icon: Video,
    title: "Video Tutorials",
    description: "Watch step-by-step walkthroughs.",
    href: "#videos",
  },
  {
    icon: FileText,
    title: "Changelog",
    description: "See what's new in every release.",
    href: "#changelog",
  },
];

export default function HelpPage() {
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
        <div className="mb-14 text-center">
          <div className="mb-4 inline-flex items-center rounded-full border border-border bg-muted/40 px-4 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-widest">
            Help & Support
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            How can we help?
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            Find answers to common questions, explore guides, or reach out directly.
          </p>
        </div>

        {/* Resource cards */}
        <section className="mb-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {resources.map((r) => (
            <Link
              key={r.title}
              href={r.href}
              className="group rounded-xl border border-border bg-muted/10 p-5 hover:bg-muted/20 transition-colors"
            >
              <div className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <r.icon className="size-4" />
              </div>
              <h3 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">
                {r.title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {r.description}
              </p>
            </Link>
          ))}
        </section>

        {/* Quick start guide */}
        <section id="quick-start" className="mb-14">
          <h2 className="text-xl font-bold mb-6">Quick Start</h2>
          <div className="space-y-4">
            {[
              {
                step: "1",
                title: "Create an account",
                body: "Sign up at webagt.ai using your email or Google account. It's free to get started.",
              },
              {
                step: "2",
                title: "Create a new project",
                body: 'Click "Create Project" on your dashboard. Choose between a website or a webshop, give it a name, and describe what you want to build.',
              },
              {
                step: "3",
                title: "Describe your idea",
                body: "In the editor, type what you want in plain language. For example: \"A landing page for a coffee brand with a hero section and pricing table.\"",
              },
              {
                step: "4",
                title: "Iterate with AI",
                body: "The AI generates your code instantly with a live preview. Keep prompting to refine — add sections, change colors, update content.",
              },
              {
                step: "5",
                title: "Export or share",
                body: "When you're happy, export your project as a standalone Vite app or share the live preview link.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="flex gap-4 rounded-xl border border-border bg-muted/10 p-5"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="docs" className="mb-14">
          <h2 className="text-xl font-bold mb-6">Frequently Asked Questions</h2>
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {faqs.map((faq) => (
              <details key={faq.q} className="group bg-muted/10 hover:bg-muted/20 transition-colors">
                <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-sm font-semibold list-none">
                  {faq.q}
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <p className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className="rounded-2xl border border-border bg-muted/20 p-8 text-center">
          <MessageCircle className="mx-auto mb-4 size-8 text-primary" />
          <h2 className="text-xl font-bold mb-2">Still need help?</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Can't find what you're looking for? Our support team typically responds within a few hours.
          </p>
          <a
            href="mailto:support@webagt.ai"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Mail className="size-4" />
            Contact Support
          </a>
          <p className="mt-4 text-xs text-muted-foreground">
            Or email us directly at{" "}
            <a href="mailto:support@webagt.ai" className="underline hover:text-foreground">
              support@webagt.ai
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}
