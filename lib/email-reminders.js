// lib/email-reminders.js — Renewal reminder emails via Resend

const RESEND_API_KEY = process.env.RESEND_API_KEY || null;
const FROM_EMAIL = process.env.FROM_EMAIL || "billing@newcharterventures.com";
const SITE_URL = process.env.SITE_URL || "https://newcharterventures.com";

export function isEmailConfigured() {
  return !!RESEND_API_KEY;
}

/**
 * Send a renewal reminder email via Resend
 * @param {Object} params
 * @param {string} params.to - recipient email
 * @param {string} params.customerName - customer name
 * @param {string} params.planName - "Monthly" or "Annual"
 * @param {number} params.amountCents - renewal amount in cents
 * @param {string} params.renewalDate - formatted renewal date
 * @param {number} params.daysUntilRenewal - days until renewal
 */
export async function sendRenewalReminder({ to, customerName, planName, amountCents, renewalDate, daysUntilRenewal }) {
  if (!RESEND_API_KEY) {
    console.warn('[email-reminders] RESEND_API_KEY not configured; skipping renewal reminder email');
    return { skipped: true, reason: 'no_api_key' };
  }

  const amountDollars = (amountCents / 100).toFixed(2);
  const subject = `Your Kalopaideia subscription renews in ${daysUntilRenewal} days`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: 'Georgia', serif;
      font-size: 16px;
      line-height: 1.7;
      color: #1c1813;
      max-width: 600px;
      margin: 0 auto;
      padding: 32px 16px;
    }
    h1 {
      font-family: 'Cormorant Garamond', serif;
      font-size: 28px;
      font-weight: 500;
      color: #1c1813;
      margin: 0 0 24px;
    }
    p {
      margin: 16px 0;
    }
    .amount {
      font-weight: 600;
      color: #7a2e2e;
    }
    .cta {
      display: inline-block;
      padding: 12px 24px;
      background: #7a2e2e;
      color: #ffffff;
      text-decoration: none;
      margin: 24px 0;
      border-radius: 4px;
    }
    .footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid #e5e5e5;
      font-size: 14px;
      color: #77746f;
      font-style: italic;
    }
  </style>
</head>
<body>
  <h1>Your subscription renews soon</h1>
  
  <p>Hello${customerName ? ' ' + customerName : ''},</p>
  
  <p>This is a friendly reminder that your <strong>${planName}</strong> subscription to Kalopaideia will automatically renew on <strong>${renewalDate}</strong>.</p>
  
  <p>We will charge <span class="amount">$${amountDollars}</span> to your payment method on file.</p>
  
  <p>Your subscription includes:</p>
  <ul>
    <li>The Akousma audio library (22 classical works)</li>
    <li>The full Curriculum in all languages (Lessons 2–capstone)</li>
    <li>Auto-graded exams and the Diploma</li>
    <li>Classical wing access at The Reading Mansion</li>
  </ul>
  
  <p>If you'd like to update your payment method or cancel your subscription, visit your account dashboard:</p>
  
  <a href="${SITE_URL}/paideia/account" class="cta">Manage Subscription</a>
  
  <p>If you take no action, your subscription will renew automatically and your access will continue uninterrupted.</p>
  
  <div class="footer">
    <p>Questions? Write us at <a href="mailto:billing@newcharterventures.com">billing@newcharterventures.com</a></p>
    <p>Kalopaideia · A publication of New Charter Ventures LLC</p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Your subscription renews soon

Hello${customerName ? ' ' + customerName : ''},

This is a friendly reminder that your ${planName} subscription to Kalopaideia will automatically renew on ${renewalDate}.

We will charge $${amountDollars} to your payment method on file.

Your subscription includes:
- The Akousma audio library (22 classical works)
- The full Curriculum in all languages (Lessons 2–capstone)
- Auto-graded exams and the Diploma
- Classical wing access at The Reading Mansion

If you'd like to update your payment method or cancel your subscription, visit:
${SITE_URL}/paideia/account

If you take no action, your subscription will renew automatically and your access will continue uninterrupted.

Questions? Write us at billing@newcharterventures.com

Kalopaideia · A publication of New Charter Ventures LLC
  `.trim();

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to,
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[email-reminders] Resend API error:', response.status, errorText);
      return { success: false, error: errorText };
    }

    const data = await response.json();
    console.log('[email-reminders] Renewal reminder sent:', { to, id: data.id });
    return { success: true, id: data.id };
  } catch (err) {
    console.error('[email-reminders] Failed to send renewal reminder:', err);
    return { success: false, error: err.message };
  }
}
