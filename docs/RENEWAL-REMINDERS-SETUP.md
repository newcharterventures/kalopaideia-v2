# Renewal Reminders Setup Guide

**TOS Requirement**: Section 28.3 of the Kalopaideia Terms of Service requires automatic renewal reminders. This feature is **mandatory** for legal compliance.

## Overview

The renewal reminder system:
1. Listens for Stripe `invoice.upcoming` events (fires ~7 days before renewal)
2. Sends transactional emails via Resend to customers
3. Logs all reminder attempts for audit trail

## Prerequisites

1. **Stripe Account** with webhook capabilities
2. **Resend Account** (free tier: 100 emails/day, 3,000/month)
3. **Production domain** with verified DNS for sending emails

---

## Step 1: Get a Resend API Key

1. Sign up at https://resend.com
2. Verify your sending domain (e.g., `newcharterventures.com`)
   - Add DNS records: TXT, CNAME, DKIM
   - Wait for verification (~5-15 minutes)
3. Create an API key:
   - Dashboard → API Keys → Create API Key
   - Copy the key (starts with `re_`)

---

## Step 2: Configure Environment Variables

Add to `/home/jae/.openclaw/workspace/paideia/.env`:

```bash
# Resend (transactional email)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=billing@newcharterventures.com
SITE_URL=https://newcharterventures.com

# Stripe webhook (get from Stripe Dashboard)
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx

# Already configured (verify these exist)
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxx
```

---

## Step 3: Set Up Stripe Webhook

### 3.1 Create the Webhook in Stripe Dashboard

1. Go to: https://dashboard.stripe.com/webhooks
2. Click **Add endpoint**
3. Enter endpoint URL:
   ```
   https://newcharterventures.com/paideia/webhooks/stripe
   ```
4. Select events to listen for:
   - ✅ `invoice.upcoming`
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`

5. Click **Add endpoint**

### 3.2 Copy the Webhook Signing Secret

1. Click on your new webhook endpoint
2. Click **Reveal** under "Signing secret"
3. Copy the secret (starts with `whsec_`)
4. Add it to `.env` as `STRIPE_WEBHOOK_SECRET`

### 3.3 Configure Webhook Send Window (CRITICAL for Annual Subscriptions)

By default, Stripe sends `invoice.upcoming` **7 days** before renewal. This is fine for monthly subscriptions, but **too short** for annual subscriptions.

**Recommended**: Set to **30 days** for annual subscriptions.

**How to configure:**
1. In Stripe Dashboard → Settings → Billing
2. Scroll to **Invoice Settings**
3. Find **Days until due** or **Advanced invoice settings**
4. Set separate windows for:
   - Monthly subscriptions: **7 days**
   - Annual subscriptions: **30 days**

**Alternative** (if Stripe doesn't allow per-interval configuration):
Set a global **14-day** window as a compromise.

---

## Step 4: Test the Webhook

### 4.1 Test with Stripe CLI (Local Development)

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to localhost
stripe listen --forward-to http://localhost:3026/paideia/webhooks/stripe

# Trigger a test event
stripe trigger invoice.upcoming
```

### 4.2 Test in Production

1. Create a test subscription in Stripe Dashboard
2. Manually trigger `invoice.upcoming` event:
   - Dashboard → Events → Send test webhook
   - Select `invoice.upcoming`
   - Send to your production endpoint

3. Check logs:
```bash
journalctl --user -u paideia -n 50 --no-pager | grep "Renewal reminder"
```

Expected output:
```
[commerce-stripe] Renewal reminder sent (TOS 28.3): { invoice: 'in_xxx', customer: 'test@example.com', emailId: 're_xxx' }
```

---

## Step 5: Restart Paideia Service

```bash
systemctl --user restart paideia
```

---

## Verification Checklist

- [ ] `RESEND_API_KEY` set in `.env`
- [ ] `STRIPE_WEBHOOK_SECRET` set in `.env`
- [ ] FROM_EMAIL domain verified in Resend
- [ ] Stripe webhook endpoint created and active
- [ ] `invoice.upcoming` event subscribed
- [ ] Test email received successfully
- [ ] Production logs show successful reminder sends
- [ ] Annual subscription window set to 30 days (or 14+ days minimum)

---

## Monitoring & Compliance

### Daily Check
```bash
# Check for failed reminders
journalctl --user -u paideia -S today | grep "Failed to send renewal reminder"
```

### Monthly Audit
1. Export Stripe `invoice.upcoming` events
2. Cross-reference with email send logs
3. Verify 100% delivery rate

**TOS Breach Risk**: A single missed reminder for an annual renewal could be a breach-of-contract claim. Monitor this system actively.

---

## Troubleshooting

### "Email not configured; skipping renewal reminder"
→ Check `RESEND_API_KEY` in `.env`

### "Webhook signature verification failed"
→ Check `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard

### "Invalid customer for invoice"
→ Customer was deleted in Stripe; safe to skip

### Emails not being received
→ Check Resend dashboard for bounce/delivery logs
→ Verify FROM_EMAIL domain DNS records

### Annual renewals not sending reminders 30 days ahead
→ Check Stripe billing settings: invoice.upcoming send window must be ≥30 days for annual subscriptions

---

## Email Template Preview

**Subject**: Your Kalopaideia subscription renews in 7 days

**Body** (HTML):
- Clean serif typography
- Renewal date and amount highlighted
- One-click link to account dashboard
- Cancel/manage subscription CTA
- Footer with contact info

**Body** (Plain text fallback included)

---

## Production Deployment

Once verified:
1. ✅ Set all environment variables in production `.env`
2. ✅ Restart paideia service
3. ✅ Create Stripe webhook in Dashboard (production mode)
4. ✅ Send test `invoice.upcoming` event
5. ✅ Verify test email received
6. ✅ Document in runbook
7. ✅ Set up monthly compliance audit

**Status**: ⚠️ **NOT YET CONFIGURED** — Do not publish TOS Section 28.3 until this is live.

---

## Files Changed

- `lib/email-reminders.js` — Resend integration + email templates
- `lib/commerce-stripe.js` — `handleInvoiceUpcoming()` handler
- `lib/stripe-webhooks.js` — Standalone webhook module (unused, kept for reference)
- `docs/RENEWAL-REMINDERS-SETUP.md` — This file

---

## Contact

Questions? File an issue or ask Clawbot.
