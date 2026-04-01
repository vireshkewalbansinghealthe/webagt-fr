import Link from "next/link";
import { Mail, MessageCircle, Twitter, Github, MapPin, Clock } from "lucide-react";

export const metadata = {
  title: "Contact — WebAGT",
  description: "Get in touch with the WebAGT team.",
};

export default function ContactPage() {
  return (
    <div className="flex flex-col gap-8 p-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contact</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Whether you have a question, feedback, or just want to say hi — we're here.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Contact form */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-border bg-muted/10 p-6">
            <h2 className="text-base font-bold mb-5">Send us a message</h2>
            <form
              action="https://formspree.io/f/contact"
              method="POST"
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="name" className="text-sm font-medium">Name</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    placeholder="Your name"
                    className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-sm font-medium">Email</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="subject" className="text-sm font-medium">Subject</label>
                <select
                  id="subject"
                  name="subject"
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
                >
                  <option value="general">General question</option>
                  <option value="support">Technical support</option>
                  <option value="billing">Billing &amp; plans</option>
                  <option value="feedback">Feedback &amp; suggestions</option>
                  <option value="partnership">Partnership / business</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="message" className="text-sm font-medium">Message</label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={5}
                  placeholder="Tell us what's on your mind…"
                  className="w-full resize-none rounded-lg border border-border bg-background px-3.5 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
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
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-border bg-muted/10 p-5">
            <div className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Mail className="size-4" />
            </div>
            <h3 className="font-semibold text-sm mb-1">Email us directly</h3>
            <p className="text-xs text-muted-foreground mb-2">For support, billing, or anything else.</p>
            <a href="mailto:support@webagt.ai" className="text-sm font-medium text-primary hover:underline">
              support@webagt.ai
            </a>
          </div>

          <div className="rounded-xl border border-border bg-muted/10 p-5">
            <div className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock className="size-4" />
            </div>
            <h3 className="font-semibold text-sm mb-1">Response time</h3>
            <p className="text-xs text-muted-foreground">
              We typically respond within <strong className="text-foreground">a few hours</strong> on
              business days. Pro users get priority support.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-muted/10 p-5">
            <div className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MessageCircle className="size-4" />
            </div>
            <h3 className="font-semibold text-sm mb-1">Help Center</h3>
            <p className="text-xs text-muted-foreground mb-2">Find answers to common questions before reaching out.</p>
            <Link href="/help" className="text-sm font-medium text-primary hover:underline">
              Browse Help &amp; Support →
            </Link>
          </div>

          <div className="rounded-xl border border-border bg-muted/10 p-5">
            <h3 className="font-semibold text-sm mb-3">Follow us</h3>
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
                href="https://github.com/webagt"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
              >
                <Github className="size-4" />
              </a>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/10 p-5">
            <div className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MapPin className="size-4" />
            </div>
            <h3 className="font-semibold text-sm mb-1">Based in</h3>
            <p className="text-xs text-muted-foreground">The Netherlands 🇳🇱</p>
          </div>
        </div>
      </div>
    </div>
  );
}
