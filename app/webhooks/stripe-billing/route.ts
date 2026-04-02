/**
 * app/webhooks/stripe-billing/route.ts
 *
 * Receives Stripe subscription webhook events from https://webagt.ai/webhooks/stripe-billing
 * and proxies them byte-for-byte to the Cloudflare Worker, which verifies the
 * Stripe signature and updates the user's plan in KV.
 *
 * The raw body MUST be forwarded intact — Stripe's HMAC-SHA256 signature
 * verification fails if the body is parsed and re-serialized.
 *
 * Worker handler: worker/src/routes/stripe-billing-webhook.ts
 *                 POST /webhooks/stripe-billing
 */

import { NextRequest, NextResponse } from "next/server";

const WORKER_URL =
  process.env.NEXT_PUBLIC_WORKER_URL ||
  process.env.WORKER_URL ||
  "https://webagt-worker.webagt.workers.dev";

export async function POST(request: NextRequest) {
  try {
    // Preserve the raw body — required for Stripe HMAC signature verification
    const rawBody = await request.text();
    const sig = request.headers.get("stripe-signature");

    if (!sig) {
      console.error("[webhook/stripe-billing] Missing stripe-signature header");
      return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
    }

    console.log("[webhook/stripe-billing] Forwarding event to Worker");

    const workerRes = await fetch(`${WORKER_URL}/webhooks/stripe-billing`, {
      method: "POST",
      headers: {
        "Content-Type": request.headers.get("content-type") || "application/json",
        "stripe-signature": sig,
      },
      body: rawBody,
    });

    const responseText = await workerRes.text();

    if (!workerRes.ok) {
      console.error(
        `[webhook/stripe-billing] Worker returned ${workerRes.status}: ${responseText}`
      );
      return NextResponse.json(
        { error: "Worker processing failed", detail: responseText },
        { status: workerRes.status }
      );
    }

    console.log(`[webhook/stripe-billing] Processed: ${responseText}`);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[webhook/stripe-billing] Proxy error:", error);
    return NextResponse.json({ error: "Webhook forwarding failed" }, { status: 500 });
  }
}
