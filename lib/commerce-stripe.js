// lib/commerce-stripe.js — Kalopaideia's Stripe integration.
// Uses the SAME Stripe products as the Mansion (one customer, one subscription).
// Marketed differently: 'All-Access' here, 'Stoa Pass' there. Same SKU.

import Stripe from "stripe";
import { PRICING } from "./commerce-catalog.js";
import { setStripeCustomer, getStripeCustomer, isStripeEventSeen, markStripeEventSeen, grantHolding, setSubscription } from "./commerce-db.js";

const KEY = process.env.STRIPE_SECRET_KEY || null;
export const stripe = KEY ? new Stripe(KEY, { apiVersion: "2024-10-28.acacia" }) : null;
export function isConfigured() { return !!stripe; }

export async function findOrCreateCustomer(user) {
  if (!stripe) throw new Error("Stripe not configured");
  const cached = getStripeCustomer(user.id);
  if (cached) {
    try { const c = await stripe.customers.retrieve(cached); if (!c.deleted) return c.id; } catch {}
  }
  const c = await stripe.customers.create({
    email: user.email,
    name: user.display_name || undefined,
    metadata: { ncv_user_id: user.id },
  });
  setStripeCustomer(user.id, c.id);
  return c.id;
}

function originOf(req) {
  return `${req.protocol}://${req.get("host")}`;
}

export async function createStoaBookCheckout({ user, book, req }) {
  if (!stripe) throw new Error("Stripe not configured");
  const customerId = await findOrCreateCustomer(user);
  return stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{
      price_data: {
        currency: "usd",
        unit_amount: PRICING.stoa_book_cents,
        product_data: {
          name: `${book.title} — Kalopaideia`,
          description: `${book.author} · ${book.language} · line-by-line with English`,
        },
      },
      quantity: 1,
    }],
    metadata: { kind: "stoa_book", product_id: book.id, ncv_user_id: user.id, sold_at: "kalopaideia" },
    success_url: `${originOf(req)}/paideia/account?bought=${encodeURIComponent(book.id)}`,
    cancel_url: `${originOf(req)}/paideia/store/${encodeURIComponent(book.id)}`,
  });
}

export async function createAllAccessCheckout({ user, req }) {
  if (!stripe) throw new Error("Stripe not configured");
  const customerId = await findOrCreateCustomer(user);
  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{
      price_data: {
        currency: "usd",
        recurring: { interval: "month" },
        unit_amount: PRICING.classics_subscription_monthly_cents,
        product_data: {
          name: "Kalopaideia All-Access",
          description: "Every classical work, present and future. Cancel any time.",
        },
      },
      quantity: 1,
    }],
    metadata: { kind: "stoa_pass_subscription", ncv_user_id: user.id, sold_at: "kalopaideia" },
    subscription_data: {
      metadata: { ncv_user_id: user.id, tier: "classics_monthly" },
    },
    success_url: `${originOf(req)}/paideia/account?subscribed=1`,
    cancel_url: `${originOf(req)}/paideia/store`,
  });
}

export async function createPortalSession({ user, returnUrl }) {
  if (!stripe) throw new Error("Stripe not configured");
  const customerId = await findOrCreateCustomer(user);
  return stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
}

// ─── webhook ───
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || null;

export function parseEvent(rawBody, signature) {
  if (!stripe) throw new Error("Stripe not configured");
  if (!WEBHOOK_SECRET) throw new Error("STRIPE_WEBHOOK_SECRET not set");
  return stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
}

export async function handleEvent(event) {
  if (isStripeEventSeen(event.id)) return { duplicate: true };

  const obj = event.data.object;
  switch (event.type) {
    case "checkout.session.completed": {
      const meta = obj.metadata || {};
      const userId = meta.ncv_user_id;
      if (!userId) break;
      if (obj.customer) setStripeCustomer(userId, obj.customer);
      if (meta.kind === "stoa_book") grantHolding(userId, "stoa_book", meta.product_id);
      if (meta.kind === "lodestar_book") grantHolding(userId, "lodestar_book", meta.product_id);
      // subscription state arrives via subscription.created
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const userId = obj.metadata?.ncv_user_id;
      if (!userId) break;
      setSubscription({
        userId,
        stripe_subscription_id: obj.id,
        status: obj.status,
        tier: obj.metadata?.tier || "classics_monthly",
        current_period_end: obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : null,
        cancel_at_period_end: !!obj.cancel_at_period_end,
      });
      break;
    }
    case "customer.subscription.deleted": {
      const userId = obj.metadata?.ncv_user_id;
      if (!userId) break;
      setSubscription({
        userId,
        stripe_subscription_id: obj.id,
        status: "canceled",
        tier: obj.metadata?.tier || "classics_monthly",
        current_period_end: obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : null,
        cancel_at_period_end: false,
      });
      break;
    }
  }
  markStripeEventSeen(event.id, event.type);
  return { ok: true };
}
