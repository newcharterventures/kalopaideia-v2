// lib/stripe-webhooks.js — Stripe webhook handlers for renewal reminders

import { stripe } from "./commerce-stripe.js";
import { sendRenewalReminder, isEmailConfigured } from "./email-reminders.js";
import { isStripeEventSeen, markStripeEventSeen } from "./commerce-db.js";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || null;

/**
 * Verify and process a Stripe webhook event
 * @param {Object} req - Express request object
 * @returns {Object} - { success: boolean, message: string, statusCode: number }
 */
export async function handleStripeWebhook(req) {
  if (!stripe) {
    return { success: false, message: 'Stripe not configured', statusCode: 503 };
  }

  const sig = req.headers['stripe-signature'];
  let event;

  // Verify webhook signature if secret is configured
  if (WEBHOOK_SECRET) {
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
    } catch (err) {
      console.error('[stripe-webhooks] Signature verification failed:', err.message);
      return { success: false, message: `Webhook signature verification failed: ${err.message}`, statusCode: 400 };
    }
  } else {
    // If no webhook secret, parse the body directly (less secure, dev only)
    console.warn('[stripe-webhooks] STRIPE_WEBHOOK_SECRET not set; accepting webhook without signature verification (INSECURE)');
    event = req.body;
  }

  // Idempotency: check if we've already processed this event
  if (isStripeEventSeen(event.id)) {
    console.log('[stripe-webhooks] Event already processed:', event.id);
    return { success: true, message: 'Event already processed (idempotent)', statusCode: 200 };
  }

  console.log('[stripe-webhooks] Processing event:', event.type, event.id);

  try {
    switch (event.type) {
      case 'invoice.upcoming':
        await handleInvoiceUpcoming(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        // These are already handled by existing commerce logic
        console.log('[stripe-webhooks] Subscription event (handled elsewhere):', event.type);
        break;

      default:
        console.log('[stripe-webhooks] Unhandled event type:', event.type);
    }

    // Mark event as processed
    markStripeEventSeen(event.id, event.type);

    return { success: true, message: 'Webhook processed', statusCode: 200 };
  } catch (err) {
    console.error('[stripe-webhooks] Error processing webhook:', err);
    return { success: false, message: `Processing error: ${err.message}`, statusCode: 500 };
  }
}

/**
 * Handle invoice.upcoming event (fires ~7 days before renewal)
 * Send renewal reminder email to the customer
 */
async function handleInvoiceUpcoming(invoice) {
  if (!isEmailConfigured()) {
    console.warn('[stripe-webhooks] Email not configured; skipping renewal reminder');
    return;
  }

  // Don't send reminders for $0 invoices or manual invoices
  if (invoice.amount_due <= 0 || !invoice.subscription) {
    console.log('[stripe-webhooks] Skipping reminder for $0 or non-subscription invoice:', invoice.id);
    return;
  }

  try {
    // Fetch customer details
    const customer = await stripe.customers.retrieve(invoice.customer);
    if (!customer || customer.deleted || !customer.email) {
      console.error('[stripe-webhooks] Invalid customer for invoice:', invoice.id);
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
      daysUntilRenewal: Math.max(1, daysUntilRenewal), // At least 1 day
    });

    if (result.success) {
      console.log('[stripe-webhooks] Renewal reminder sent:', {
        invoice: invoice.id,
        customer: customer.email,
        emailId: result.id,
      });
    } else {
      console.error('[stripe-webhooks] Failed to send renewal reminder:', result.error);
    }
  } catch (err) {
    console.error('[stripe-webhooks] Error in handleInvoiceUpcoming:', err);
  }
}

/**
 * Handle invoice.payment_succeeded event
 * Log successful renewal (optional)
 */
async function handleInvoicePaymentSucceeded(invoice) {
  if (invoice.subscription) {
    console.log('[stripe-webhooks] Subscription renewed successfully:', {
      invoice: invoice.id,
      customer: invoice.customer,
      amount: invoice.amount_paid / 100,
    });
  }
}
