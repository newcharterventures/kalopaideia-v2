# Stripe Support / Sponsor Setup — Kalopaideia & Reading Mansion

## Legal framing (read first)

NCV is a for-profit LLC, so the language used in product names, success pages, and CTAs must NOT imply tax-deductibility. Use these words: **support**, **contribute**, **sponsor**, **patron**, **back**. Avoid: **donate**, **donation**, **gift** (in the charitable sense), **tax-deductible**.

Stripe-side: create one Product per tier (cleaner reporting than one Product with many Prices). Use Stripe's **"customer-set amount"** option for the one-time tier so supporters can name their amount, mirroring The Guardian's epic.

---

## Kalopaideia

**Site identity:** synchronized text+audio reader for the classical canon — Plato, Cicero, Homer — in Latin, Greek, French, German, Old English. The mission framing writes itself.

### Hero / mission statement (for the CTA component)
> Keep the classical canon free, open, and read aloud — in the languages it was written in.

### Supporting paragraph (optional, for an `/support` page)
Kalopaideia exists because Plato should not live behind a paywall. We build the reader, license the recordings, transcribe the manuscripts, and align every line — then we give it away. No subscription, no ads, no login. If the work matters to you, become a patron and keep the lamp lit for the next reader.

### Stripe product names & descriptions

| Tier | Stripe product name | Description (shown on Checkout) |
|---|---|---|
| One-time, customer-set | **Kalopaideia — One-Time Patron** | Support classical literature in the original languages. Set your own amount. |
| $5/mo | **Kalopaideia — Reader** | Monthly support. Keeps Plato free for everyone. |
| $10/mo | **Kalopaideia — Scholar** | Monthly support. Funds new texts and recordings. |
| $25/mo | **Kalopaideia — Patron** | Monthly support. Underwrites a full canonical work each year. |

### Checkout success message
> Thank you. You are now a patron of Kalopaideia. The classical canon stays open because of readers like you.

---

## Reading Mansion

> Note: I don't have full context on Reading Mansion's positioning, so the copy below assumes it's a literary reading platform in the NCV portfolio. Adjust the mission line to match the actual product.

### Hero / mission statement (assumed — adjust)
> Independent literary publishing, free for every reader. Backed by people, not platforms.

### Stripe product names & descriptions

| Tier | Stripe product name | Description (shown on Checkout) |
|---|---|---|
| One-time, customer-set | **Reading Mansion — One-Time Patron** | Support independent literary publishing. Set your own amount. |
| $5/mo | **Reading Mansion — Reader** | Monthly support. Keeps the doors open. |
| $10/mo | **Reading Mansion — Member** | Monthly support. Funds new editions and essays. |
| $25/mo | **Reading Mansion — Patron** | Monthly support. Underwrites our editorial program. |

### Checkout success message
> Welcome to the Mansion. Independent literary publishing exists because of patrons like you.

---

## Stripe setup steps (one command per line)

`stripe login` — authenticate the Stripe CLI to your NCV Stripe account (skip if you're using the Dashboard).

`stripe products create --name="Kalopaideia — Reader" --description="Monthly support. Keeps Plato free for everyone."` — creates one product; repeat for each tier.

`stripe prices create --product=prod_XXX --unit-amount=500 --currency=usd --recurring[interval]=month` — attach a $5/mo recurring price to the product (replace `prod_XXX` with the ID returned above; `500` = $5.00 in cents).

`stripe payment_links create --line-items[0][price]=price_XXX --line-items[0][quantity]=1` — generates a hosted Payment Link URL you can drop straight into the React component.

For the **customer-set one-time tier**, create the Price in the Dashboard rather than the CLI: Products → New Price → Pricing model: **Customer chooses price**, with a minimum (e.g., $3) and a preset suggested amount ($25). Then create a Payment Link against that price.

## Webhooks (do this on day one, not later)

`stripe listen --forward-to localhost:8000/webhooks/stripe` — pipes Stripe events into your FastAPI backend during development.

Subscribe to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.deleted`, and `invoice.payment_failed`. Log every event to your standard NCV structured JSON logger; you'll want the audit trail when a supporter emails asking when they started supporting.

## Attribution metadata (do this on day one too)

When you create the Payment Link, attach metadata so you know which site the contribution came from:

`stripe payment_links create --line-items[0][price]=price_XXX --line-items[0][quantity]=1 --metadata[site]=kalopaideia --metadata[tier]=reader`

This lets you query revenue per site without parsing product names later — important once you have three or four NCV properties running support flows.
