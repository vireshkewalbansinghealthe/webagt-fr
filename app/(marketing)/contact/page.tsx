import Link from "next/link";
import { Navbar } from "@/components/landing";
import { ArrowLeft, Mail, MessageCircle, Twitter, Github, MapPin, Clock } from "lucide-react";

export const metadata = {
  title: "Contact — WebAGT",
  description: "Get in touch with the WebAGT team.",
};

export default function ContactPage() {
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
            Contact Us
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            We'd love to hear from you.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            Whether you have a question, feedback, or just want to say hi — we're here.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-5">
          {/* Contact form */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-border bg-muted/10 p-8">
              <h2 className="text-lg font-bold mb-6">Send us a message</h2>
              <form
                action="https://formspree.io/f/contact"
                method="POST"
                className="space-y-5"
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="name" className="text-sm font-medium">
                      Name
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      placeholder="Your name"
                      className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="email" className="text-sm font-medium">
                      Email
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      placeholder="you@example.com"
                      className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="subject" className="text-sm font-medium">
                    Subject
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                  >
                    <option value="general">General question</option>
                    <option value="support">Technical support</option>
                    <option value="billing">Billing & plans</option>
                    <option value="feedback">Feedback & suggestions</option>
                    <option value="partnership">Partnership / business</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="message" className="text-sm font-medium">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={5}
                    placeholder="Tell us what's on your mind…"
                    className="w-full resize-none rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Send Message
                </button>
              </form>
            </div>
          </div>

          {/* Contact info */}
          <div className="lg:col-span-2 space-y-5">
            {/* Direct email */}
            <div className="rounded-xl border border-border bg-muted/10 p-5">
              <div className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Mail className="size-4" />
              </div>
              <h3 className="font-semibold mb-1">Email us directly</h3>
              <p className="text-sm text-muted-foreground mb-3">
                For support, billing, or anything else.
              </p>
              <a
                href="mailto:support@webagt.ai"
                className="text-sm font-medium text-primary hover:underline"
              >
                support@webagt.ai
              </a>
            </div>

            {/* Response time */}
            <div className="rounded-xl border border-border bg-muted/10 p-5">
              <div className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clock className="size-4" />
              </div>
              <h3 className="font-semibold mb-1">Response time</h3>
              <p className="text-sm text-muted-foreground">
                We typically respond within <strong className="text-foreground">a few hours</strong> on
                business days. Pro users get priority support.
              </p>
            </div>

            {/* Help center */}
            <div className="rounded-xl border border-border bg-muted/10 p-5">
              <div className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageCircle className="size-4" />
              </div>
              <h3 className="font-semibold mb-1">Help Center</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Find answers to common questions before reaching out.
              </p>
              <Link
                href="/help"
                className="text-sm font-medium text-primary hover:underline"
              >
                Browse Help & Support →
              </Link>
            </div>

            {/* Social */}
            <div className="rounded-xl border border-border bg-muted/10 p-5">
              <h3 className="font-semibold mb-3">Follow us</h3>
              <div className="flex gap-3">
                <a
                  href="https://twitter.com/webagt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                >
                  <Twitter className="size-4" />
                </a>
                <a
                  href="https://github.com/vireshkewalbansinghealthe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                >
                  <Github className="size-4" />
                </a>
              </div>
            </div>

            {/* Location */}
            <div className="rounded-xl border border-border bg-muted/10 p-5">
              <div className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MapPin className="size-4" />
              </div>
              <h3 className="font-semibold mb-1">Based in</h3>
              <p className="text-sm text-muted-foreground">
                The Netherlands 🇳🇱
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
