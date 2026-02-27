import { Hono } from "hono";
import type { Env, Variables } from "../index";
import { authMiddleware } from "../middleware/auth";
import { getSupabaseAdmin } from "../lib/supabase";

export const billing = new Hono<{ Bindings: Env; Variables: Variables }>();

// ─── Allowed price IDs ──────────────────────────────────────────────────

const ALLOWED_PRICE_IDS = [
  "price_chainreview_pro_monthly",
  "price_chainreview_pro_yearly",
];

// ─── Helpers ────────────────────────────────────────────────────────────

async function stripeRequest(
  env: Env,
  path: string,
  method: "GET" | "POST",
  body?: URLSearchParams
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`https://api.stripe.com/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body?.toString(),
    });
  } catch (err) {
    console.error(`Stripe request failed (${method} ${path}):`, err);
    throw new Error("Failed to communicate with payment provider");
  }

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "unknown");
    console.error(`Stripe API error (${res.status}) on ${method} ${path}:`, errorBody);
    throw new Error(`Payment provider returned an error (${res.status})`);
  }

  return res;
}

async function getOrCreateStripeCustomer(
  env: Env,
  userId: string,
  email: string
): Promise<string> {
  const supabase = getSupabaseAdmin(env);

  // Check if we already have a Stripe customer for this user
  const { data: existing } = await supabase
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .single();

  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id;
  }

  // Create a new Stripe customer
  const params = new URLSearchParams();
  params.set("email", email);
  params.set("metadata[user_id]", userId);

  const res = await stripeRequest(env, "/customers", "POST", params);
  const customer = (await res.json()) as { id: string };

  // Store mapping
  await supabase.from("stripe_customers").insert({
    user_id: userId,
    stripe_customer_id: customer.id,
  });

  return customer.id;
}

// ─── Create Checkout Session ────────────────────────────────────────────

billing.post("/api/billing/checkout", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const email = c.get("userEmail");

  if (!c.env.STRIPE_SECRET_KEY) {
    return c.json({ error: "Billing not configured" }, 503);
  }

  const body = await c.req.json<{ priceId?: string; successUrl?: string; cancelUrl?: string }>();

  // Default to the Pro plan price ID (set in Stripe dashboard)
  const priceId = body.priceId || "price_chainreview_pro_monthly";

  // Validate price ID against allowlist
  if (!ALLOWED_PRICE_IDS.includes(priceId)) {
    return c.json({ error: "Invalid price ID" }, 400);
  }

  let customerId: string;
  try {
    customerId = await getOrCreateStripeCustomer(c.env, userId, email);
  } catch (err) {
    console.error("Failed to get/create Stripe customer:", err);
    return c.json({ error: "Failed to initialize billing" }, 502);
  }

  const params = new URLSearchParams();
  params.set("customer", customerId);
  params.set("mode", "subscription");
  params.set("line_items[0][price]", priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", body.successUrl || "https://dashboard.chainreview.dev/dashboard/settings?upgraded=true");
  params.set("cancel_url", body.cancelUrl || "https://dashboard.chainreview.dev/dashboard/settings");
  params.set("metadata[user_id]", userId);
  params.set("subscription_data[metadata][user_id]", userId);

  let session: { id: string; url: string };
  try {
    const res = await stripeRequest(c.env, "/checkout/sessions", "POST", params);
    session = (await res.json()) as { id: string; url: string };
  } catch (err) {
    console.error("Failed to create checkout session:", err);
    return c.json({ error: "Failed to create checkout session" }, 502);
  }

  if (!session.url) {
    return c.json({ error: "Failed to create checkout session" }, 500);
  }

  return c.json({ url: session.url, sessionId: session.id });
});

// ─── Customer Portal ────────────────────────────────────────────────────

billing.post("/api/billing/portal", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const email = c.get("userEmail");

  if (!c.env.STRIPE_SECRET_KEY) {
    return c.json({ error: "Billing not configured" }, 503);
  }

  const body = await c.req.json<{ returnUrl?: string }>().catch(() => ({}));

  let customerId: string;
  try {
    customerId = await getOrCreateStripeCustomer(c.env, userId, email);
  } catch (err) {
    console.error("Failed to get/create Stripe customer:", err);
    return c.json({ error: "Failed to initialize billing" }, 502);
  }

  const params = new URLSearchParams();
  params.set("customer", customerId);
  params.set("return_url", (body as { returnUrl?: string }).returnUrl || "https://dashboard.chainreview.dev/dashboard/settings");

  let session: { url: string };
  try {
    const res = await stripeRequest(c.env, "/billing_portal/sessions", "POST", params);
    session = (await res.json()) as { url: string };
  } catch (err) {
    console.error("Failed to create portal session:", err);
    return c.json({ error: "Failed to create billing portal session" }, 502);
  }

  return c.json({ url: session.url });
});

// ─── Current Subscription Status ────────────────────────────────────────

billing.get("/api/billing/status", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const supabase = getSupabaseAdmin(c.env);

  // Get plan from profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .single();

  // Get latest subscription event
  const { data: latestEvent } = await supabase
    .from("subscription_events")
    .select("event_type, plan, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return c.json({
    plan: profile?.plan || "free",
    lastEvent: latestEvent || null,
  });
});

// ─── Stripe Webhook ─────────────────────────────────────────────────────

billing.post("/api/billing/webhook", async (c) => {
  if (!c.env.STRIPE_SECRET_KEY || !c.env.STRIPE_WEBHOOK_SECRET) {
    return c.json({ error: "Webhooks not configured" }, 503);
  }

  const signature = c.req.header("stripe-signature");
  if (!signature) {
    return c.json({ error: "Missing signature" }, 400);
  }

  const rawBody = await c.req.text();

  // Verify Stripe webhook signature (manual HMAC verification for CF Workers)
  const isValid = await verifyStripeSignature(
    rawBody,
    signature,
    c.env.STRIPE_WEBHOOK_SECRET
  );

  if (!isValid) {
    return c.json({ error: "Invalid signature" }, 400);
  }

  const event = JSON.parse(rawBody) as {
    id: string;
    type: string;
    data: { object: Record<string, unknown> };
  };

  const supabase = getSupabaseAdmin(c.env);

  // Extract user_id from metadata — check object metadata, then subscription metadata
  const obj = event.data.object;
  const objMetadata = obj.metadata as Record<string, string> | undefined;
  const userId = objMetadata?.user_id || null;

  if (!userId) {
    // Not a ChainReview subscription event — acknowledge but ignore
    return c.json({ received: true });
  }

  // Determine plan from event type
  let plan: string | null = null;

  switch (event.type) {
    case "checkout.session.completed":
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const status = (obj as Record<string, unknown>).status as string;
      plan = status === "active" || status === "trialing" ? "pro" : "free";
      break;
    }
    case "customer.subscription.deleted":
    case "invoice.payment_failed": {
      plan = "free";
      break;
    }
    default:
      // Acknowledge unhandled event types
      return c.json({ received: true });
  }

  // Idempotency check: ensure we haven't already processed this Stripe event
  const { data: existingEvent } = await supabase
    .from("subscription_events")
    .select("id")
    .eq("stripe_event_id", event.id)
    .limit(1)
    .single();

  if (existingEvent) {
    // Already processed this event — acknowledge without re-processing
    return c.json({ received: true, duplicate: true });
  }

  // Record the event
  await supabase.from("subscription_events").insert({
    user_id: userId,
    stripe_event_id: event.id,
    event_type: event.type,
    plan,
  });

  // Update the user's plan in profiles
  if (plan) {
    await supabase
      .from("profiles")
      .update({ plan, updated_at: new Date().toISOString() })
      .eq("id", userId);
  }

  return c.json({ received: true });
});

// ─── Stripe Signature Verification (CF Workers compatible) ──────────────

async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string
): Promise<boolean> {
  try {
    const parts = header.split(",");
    let timestamp = "";
    let sig = "";

    for (const part of parts) {
      const [key, value] = part.split("=");
      if (key === "t") timestamp = value;
      if (key === "v1") sig = value;
    }

    if (!timestamp || !sig) return false;

    // Check timestamp tolerance (5 minutes)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp, 10)) > 300) return false;

    // Compute expected signature
    const signedPayload = `${timestamp}.${payload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
    const expectedSig = Array.from(new Uint8Array(mac))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Constant-time comparison
    if (sig.length !== expectedSig.length) return false;
    let result = 0;
    for (let i = 0; i < sig.length; i++) {
      result |= sig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
    }
    return result === 0;
  } catch {
    return false;
  }
}
