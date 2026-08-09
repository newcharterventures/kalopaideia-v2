// lib/commerce-stripe.js — Kalopaideia's Stripe integration.
// Uses the SAME Stripe products as the Mansion (one customer, one subscription).
// Marketed differently: 'All-Access' here, 'Stoa Pass' there. Same SKU.

import Stripe from "stripe";
import { PRICING } from "./commerce-catalog.js";
import { setStripeCustomer, getStripeCustomer, isStripeEventSeen, markStripeEventSeen, grantHolding, setSubscription } from "./commerce-db.js";
import { sendRenewalReminder, isEmailConfigured } from "./email-reminders.js";

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
        product: 'kalopaideia',
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
        product: 'kalopaideia',
        stripe_subscription_id: obj.id,
        status: "canceled",
        tier: obj.metadata?.tier || "classics_monthly",
        current_period_end: obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : null,
        cancel_at_period_end: false,
      });
      break;
    }
    case "invoice.upcoming": {
      // TOS Section 28.3 requires renewal reminders
      await handleInvoiceUpcoming(obj);
      break;
    }
  }
  markStripeEventSeen(event.id, event.type);
  return { ok: true };
}

/**
 * Handle invoice.upcoming event (fires ~7 days before renewal)
 * Send renewal reminder email to the customer (TOS Section 28.3 requirement)
 */
async function handleInvoiceUpcoming(invoice) {
  if (!isEmailConfigured()) {
    console.warn('[commerce-stripe] Email not configured; skipping renewal reminder (TOS breach risk!)');
    return;
  }

  // Don't send reminders for $0 invoices or manual invoices
  if (invoice.amount_due <= 0 || !invoice.subscription) {
    console.log('[commerce-stripe] Skipping reminder for $0 or non-subscription invoice:', invoice.id);
    return;
  }

  try {
    // Fetch customer details
    const customer = await stripe.customers.retrieve(invoice.customer);
    if (!customer || customer.deleted || !customer.email) {
      console.error('[commerce-stripe] Invalid customer for invoice:', invoice.id);
      return;
    }

    // Fetch subscription to determine plan type
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    const interval = subscription.items.data[0]?.price?.recurring?.interval;
    const planName = interval === 'year' ? 'Annual' : 'Monthly';

    // Calculate days until renewal
    const renewalTimestamp = invoice.period_end || invoice.next_payment_attempt;
    const renewalDate = new Date(renewalTimestamp * 1000);
    const now = new Date();
    const daysUntilRenewal = Math.ceil((renewalDate - now) / (1000 * 60 * 60 * 24));

    // Format renewal date
    const renewalDateFormatted = renewalDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Send renewal reminder
    const result = await sendRenewalReminder({
      to: customer.email,
      customerName: customer.name || null,
      planName,
      amountCents: invoice.amount_due,
      renewalDate: renewalDateFormatted,
      daysUntilRenewal: Math.max(1, daysUntilRenewal),
    });

    if (result.success) {
      console.log('[commerce-stripe] Renewal reminder sent (TOS 28.3):', {
        invoice: invoice.id,
        customer: customer.email,
        emailId: result.id,
      });
    } else if (result.skipped) {
      console.warn('[commerce-stripe] Renewal reminder skipped:', result.reason);
    } else {
      console.error('[commerce-stripe] Failed to send renewal reminder:', result.error);
    }
  } catch (err) {
    console.error('[commerce-stripe] Error in handleInvoiceUpcoming:', err);
  }
}
