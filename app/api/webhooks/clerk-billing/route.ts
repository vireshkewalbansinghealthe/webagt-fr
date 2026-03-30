/**
 * app/api/webhooks/clerk-billing/route.ts
 *
 * Receives Clerk billing webhooks and forwards them to the Cloudflare Worker,
 * which does the actual KV update (upgradePlan / downgradePlan).
 *
 * The Worker already has a full svix-verified handler at:
 *   POST /webhooks/clerk-billing
 *
 * This Next.js handler simply proxies the raw request (including svix headers)
 * to the Worker so Clerk only needs one webhook URL configured.
 *
 * Webhook URL to configure in Clerk Dashboard:
 *   https://www.webagt.ai/api/webhooks/clerk-billing
 */

import { NextRequest, NextResponse } from "next/server";

const WORKER_URL =
  process.env.NEXT_PUBLIC_WORKER_URL ||
  process.env.WORKER_URL ||
  "https://webagt-worker.webagt.workers.dev";

export async function POST(request: NextRequest) {
  try {
    // Read the raw body — we must forward it byte-for-byte so svix
    // signature verification succeeds on the Worker side.
    const rawBody = await request.text();

    // Forward all svix signature headers the Worker needs for verification.
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    console.log(
      `[webhook] Forwarding Clerk billing event to Worker (svix-id: ${svixId})`
    );

    const workerRes = await fetch(
      `${WORKER_URL}/webhooks/clerk-billing`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(svixId ? { "svix-id": svixId } : {}),
          ...(svixTimestamp ? { "svix-timestamp": svixTimestamp } : {}),
          ...(svixSignature ? { "svix-signature": svixSignature } : {}),
        },
        body: rawBody,
      }
    );

    const responseText = await workerRes.text();

    if (!workerRes.ok) {
      console.error(
        `[webhook] Worker returned ${workerRes.status}: ${responseText}`
      );
      return NextResponse.json(
        { error: "Worker webhook processing failed", detail: responseText },
        { status: workerRes.status }
      );
    }

    console.log(`[webhook] Worker processed event successfully: ${responseText}`);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[webhook] Error forwarding to Worker:", error);
    return NextResponse.json(
      { error: "Webhook forwarding failed" },
      { status: 500 }
    );
  }
}
