// lib/commerce.js — Kalopaideia commerce: auth, store, checkout, account, webhook.
//
// Mounts under /paideia/* (alongside the existing static site).
// Marketed as 'All-Access' for the subscription, $9.99 per work.
// Shares accounts.db + Stoa catalog with The Reading Mansion.

import { Router } from "express";
import express from "express";
import session from "express-session";
import SQLiteStoreFactory from "better-sqlite3-session-store";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { findOrCreateUser, getUser, hasStoaAccess, listHoldings, userOwns, getHolding, saveReadingProgress } from "./commerce-db.js";
import { stoaById, stoaCatalogView, listStoa } from "./commerce-catalog.js";
import {
  isConfigured as stripeConfigured,
  createStoaBookCheckout,
  createAllAccessCheckout,
  createPortalSession,
  parseEvent,
  handleEvent,
} from "./commerce-stripe.js";
import { isAuthConfigured, supabaseAnon } from "./commerce-supabase.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── session store (paideia-local sessions; shares users with mansion via accounts.db) ───
const SQLiteStore = SQLiteStoreFactory(session);
const sessionDb = new Database(path.join(__dirname, "..", "data", "sessions.db"));

export function buildCommerce({ basePath = "/paideia" } = {}) {
  const router = Router();

  router.use(session({
    name: "paideia.sid",
    store: new SQLiteStore({ client: sessionDb, expired: { clear: true, intervalMs: 15 * 60 * 1000 } }),
    secret: process.env.SESSION_SECRET || "paideia-dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  }));

  router.use((req, res, next) => {
    req.user = req.session?.userId ? getUser(req.session.userId) : null;
    next();
  });

  // ─── lightweight HTML helpers ───
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function shell(title, body) {
    return `<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} — Kalopaideia</title>
  <link rel="stylesheet" href="${basePath}/styles.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&family=Inter:wght@400;500;600;700&display=swap">
  <style>
    .commerce-wrap { max-width: 880px; margin: 40px auto 80px; padding: 0 24px; font-family: "Source Serif 4", Georgia, serif; }
    .commerce-wrap h1 { font-family: "Cormorant Garamond", serif; font-weight: 400; font-size: 48px; margin: 0 0 8px; }
    .commerce-wrap h2 { font-family: "Cormorant Garamond", serif; font-weight: 400; font-size: 30px; margin: 32px 0 12px; }
    .commerce-sub { font-family: "Cormorant Garamond", serif; font-style: italic; font-size: 20px; color: #6b5d4a; margin: 0 0 32px; }
    .commerce-card { border: 1px solid #d8cfbe; padding: 26px 30px; margin: 18px 0; background: #faf7f2; }
    .commerce-card h3 { font-family: "Cormorant Garamond", serif; font-weight: 400; font-size: 26px; margin: 0 0 6px; }
    .commerce-btn { display: inline-block; padding: 11px 22px; border: 1px solid #1f1b16; background: #1f1b16; color: #faf7f2; font-family: "Inter", sans-serif; font-size: 13px; letter-spacing: 0.6px; text-transform: uppercase; cursor: pointer; text-decoration: none; }
    .commerce-btn:hover { background: #8c2a1e; border-color: #8c2a1e; }
    .commerce-btn.quiet { background: transparent; color: #1f1b16; }
    .commerce-btn.quiet:hover { background: transparent; color: #8c2a1e; border-color: #8c2a1e; }
    .commerce-link { color: #8c2a1e; }
    .commerce-meta { font-family: "Inter", sans-serif; font-size: 12px; letter-spacing: 0.4px; color: #8a8070; }
    .commerce-form input { width: 100%; padding: 11px 14px; font-family: "Inter", sans-serif; font-size: 15px; border: 1px solid #d8cfbe; margin-bottom: 14px; background: #efe9dc; box-sizing: border-box; }
    .commerce-empty { font-family: "Cormorant Garamond", serif; font-style: italic; color: #8a8070; text-align: center; padding: 40px 0; }
    .commerce-row { display: grid; grid-template-columns: 1fr auto auto; gap: 18px; align-items: baseline; padding: 14px 0; border-bottom: 1px solid #e6dfd0; }
    .commerce-row:first-of-type { border-top: 1px solid #d8cfbe; }
    .commerce-row .work-title { font-family: "Cormorant Garamond", serif; font-size: 19px; font-weight: 400; }
    .commerce-row .work-meta { font-family: "Cormorant Garamond", serif; font-style: italic; color: #8a8070; font-size: 14px; }
    .commerce-row .work-price { font-family: "Inter", sans-serif; font-size: 13px; color: #524a3e; }
    .commerce-row.gateway .work-price { color: #b0935a; font-weight: 500; }
    .commerce-banner { background: #efe9dc; border: 1px solid #d8cfbe; padding: 22px 28px; margin-bottom: 28px; font-family: "Cormorant Garamond", serif; font-style: italic; color: #524a3e; }
    .commerce-banner b { color: #1f1b16; font-weight: 500; font-style: normal; }
    .commerce-nav { font-family: "Inter", sans-serif; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase; color: #8a8070; margin-bottom: 14px; }
    .commerce-nav a { color: inherit; }
    .commerce-nav a:hover { color: #8c2a1e; }
    .commerce-msg { padding: 14px 18px; background: #efe9dc; border-left: 3px solid #b0935a; font-family: "Cormorant Garamond", serif; font-style: italic; color: #524a3e; margin-bottom: 24px; }
    .commerce-err { padding: 14px 18px; background: #fdf2ef; border-left: 3px solid #8c2a1e; font-family: "Inter", sans-serif; font-size: 13px; color: #8c2a1e; margin-bottom: 24px; }
  </style>
</head><body>
<header style="border-bottom: 1px solid #d8cfbe; padding: 18px 28px; max-width: 1140px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; font-family: 'Inter', sans-serif; font-size: 13px;">
  <a href="${basePath}/" style="font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 22px; color: #1f1b16; text-decoration: none;">Kalopaideia</a>
  <nav style="display: flex; gap: 22px; letter-spacing: 0.5px;">
    <a href="${basePath}/" style="color: #524a3e;">Home</a>
    <a href="${basePath}/store" style="color: #524a3e;">Store</a>
    <a href="${basePath}/account" style="color: #524a3e;">Account</a>
  </nav>
</header>
<main class="commerce-wrap">
${body}
</main>
</body></html>`;
  }

  function priceLabel(cents) { return "$" + (cents / 100).toFixed(2); }

  // ─── /paideia/store — full Stoa catalog (also accessible at /paideia/store) ───
  router.get("/store", (req, res) => {
    const works = stoaCatalogView();
    const byLang = {};
    for (const w of works) {
      const k = (w.language || "unknown").toLowerCase();
      (byLang[k] ||= []).push(w);
    }
    const langOrder = ["greek", "latin", "old-english", "oldenglish", "german", "french", "italian"];
    const langNames = { greek: "Greek", latin: "Latin", "old-english": "Old English", oldenglish: "Old English", german: "German", french: "French", italian: "Italian" };

    const sections = langOrder.filter(k => byLang[k]).map(k => {
      const rows = byLang[k].map(w => `
<div class="commerce-row${w.is_gateway ? " gateway" : ""}">
  <span class="work-title"><a href="${basePath}/store/${esc(w.id)}">${esc(w.title)}</a></span>
  <span class="work-meta">${esc(w.author)} · ${esc(w.date_composed || "")} · ${w.line_count} lines</span>
  <span class="work-price">${w.is_gateway ? "Free" : priceLabel(w.price_cents)}</span>
</div>`).join("");
      return `<h2>${esc(langNames[k] || k)}</h2>${rows}`;
    }).join("");

    const sub = req.user?.sub_status === "active";
    const allAccessCard = sub
      ? `<div class="commerce-card"><h3>All-Access · Active</h3><p style="font-style:italic; color:#6b5d4a;">Every work below is open to you. Renews monthly until you cancel.</p><a class="commerce-btn quiet" href="${basePath}/account">Manage subscription</a></div>`
      : `<div class="commerce-card"><h3>All-Access — $12.99 / month</h3><p style="font-style:italic; color:#6b5d4a;">Every classical work in Kalopaideia, present and future. Cancel any time. The same subscription unlocks the Stoa at <a class="commerce-link" href="https://newcharterventures.com/mansion/wanderings/stoa">The Reading Mansion</a>.</p><form method="POST" action="${basePath}/checkout/all-access" style="display:inline; margin-top: 8px;"><button class="commerce-btn" type="submit">Subscribe</button></form></div>`;

    const body = `
<h1>The Store</h1>
<p class="commerce-sub">Line-by-line classics. Original on the left, English on the right, gloss on click.</p>

${allAccessCard}

<div class="commerce-banner">
  <span><b>Odyssey, Book 1</b> is free for everyone — sign in and it's yours forever.<br>Other works are <b>$9.99 each</b>, kept for life. Or All-Access at $12.99 a month.</span>
</div>

${sections}
`;
    res.send(shell("Store", body));
  });

  // ─── /paideia/store/:id — single work detail ───
  router.get("/store/:id", (req, res) => {
    const w = stoaById(req.params.id);
    if (!w) return res.status(404).send(shell("Not found", `<h1>Not found</h1><p><a href="${basePath}/store">← Store</a></p>`));
    const user = req.user;
    const has = hasStoaAccess(user, w);
    const lineCount = (w.lines || []).length;
    const sample = (w.lines || []).slice(0, 5);

    const sampleHtml = sample.map(ln => `
<div style="display: grid; grid-template-columns: 36px 1fr 1fr; gap: 18px; padding: 12px 0; border-bottom: 1px solid #e6dfd0; align-items: baseline;">
  <span style="font-family: Inter, sans-serif; font-size: 11px; color: #8a8070; text-align: right;">${ln.n}</span>
  <span style="font-family: 'Cormorant Garamond', serif; font-size: 18px; line-height: 1.55;">${esc(ln.original)}</span>
  <span style="font-family: 'Source Serif 4', serif; font-size: 16px; font-style: italic; color: #524a3e; line-height: 1.6;">${esc(ln.english)}</span>
</div>`).join("");

    const cta = has
      ? `<a class="commerce-btn" href="${basePath}/read/${esc(w.id)}">Open the reader</a>`
      : `<form method="POST" action="${basePath}/checkout/stoa-book/${esc(w.id)}" style="display:inline;">
           <button class="commerce-btn" type="submit">Buy this book — $9.99</button>
         </form>
         <form method="POST" action="${basePath}/checkout/all-access" style="display:inline; margin-left: 8px;">
           <button class="commerce-btn quiet" type="submit">All-Access — $12.99/mo</button>
         </form>`;

    const body = `
<p class="commerce-nav"><a href="${basePath}/store">← Store</a></p>
<h1>${esc(w.title)}</h1>
<p class="commerce-sub">${esc(w.author)} · ${esc(w.date || "")} · ${esc(w.language || "")}</p>
<p style="color: #8a8070; font-family: 'Cormorant Garamond', serif; font-style: italic;">Translation: ${esc(w.translator || "public domain")}, ${esc(w.translator_date || "")}.</p>

<div style="margin: 24px 0;">${cta}</div>

<h2 style="font-size: 22px;">First five lines</h2>
${sampleHtml}
<p class="commerce-meta" style="margin-top: 16px;">${lineCount - 5} more lines unlock with purchase.</p>
`;
    res.send(shell(w.title, body));
  });

  // ─── /paideia/account — sub status, holdings, sign out ───
  router.get("/account", (req, res) => {
    const user = req.user;
    if (!user) return res.redirect(`${basePath}/login`);

    const subStatus = user.sub_status;
    let subBlock;
    if (subStatus === "active") {
      const renewal = user.sub_period_end ? new Date(user.sub_period_end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "soon";
      subBlock = `<div class="commerce-card"><h3>All-Access · Active</h3><p style="font-style:italic; color:#6b5d4a;">Every classical work is open to you. Renews on ${esc(renewal)}.</p><form method="POST" action="${basePath}/billing/portal" style="display:inline;"><button class="commerce-btn quiet" type="submit">Manage subscription</button></form></div>`;
    } else if (subStatus === "past_due") {
      subBlock = `<div class="commerce-card" style="border-left: 3px solid #8c2a1e;"><h3>Payment past due</h3><p style="font-style:italic; color:#6b5d4a;">Stripe couldn't charge your card. Update payment to keep your access.</p><form method="POST" action="${basePath}/billing/portal" style="display:inline;"><button class="commerce-btn" type="submit">Update payment</button></form></div>`;
    } else {
      subBlock = `<div class="commerce-card"><h3>All-Access — $12.99 / month</h3><p style="font-style:italic; color:#6b5d4a;">Unlocks every classical work, here and at <a class="commerce-link" href="https://newcharterventures.com/mansion/wanderings/stoa">The Reading Mansion</a>. Cancel any time.</p><form method="POST" action="${basePath}/checkout/all-access" style="display:inline;"><button class="commerce-btn" type="submit">Subscribe</button></form></div>`;
    }

    const holdings = listHoldings(user.id).filter(h => h.product_kind === "stoa_book");
    const holdingsList = holdings.length
      ? holdings.map(h => {
          const w = stoaById(h.product_id);
          if (!w) return "";
          return `<div class="commerce-row"><span class="work-title"><a href="${basePath}/read/${esc(w.id)}">${esc(w.title)}</a></span><span class="work-meta">${esc(w.author)} · ${esc(w.language || "")}</span><span class="work-price">${w.is_gateway ? "Gateway" : "Owned"}</span></div>`;
        }).join("")
      : `<p class="commerce-empty">No books yet. <a class="commerce-link" href="${basePath}/store">Visit the store.</a></p>`;

    const subscribedNote = req.query.subscribed === "1"
      ? `<div class="commerce-msg">Welcome aboard. Every classical work is now open to you, here and at the Mansion.</div>`
      : "";
    const boughtNote = req.query.bought
      ? `<div class="commerce-msg">Purchase complete. <i>${esc(stoaById(String(req.query.bought))?.title || "")}</i> is now in your library.</div>`
      : "";

    const body = `
<h1>${esc(user.display_name || user.email.split("@")[0])}</h1>
<p class="commerce-sub">${esc(user.email)}</p>

${subscribedNote}${boughtNote}
${subBlock}

<h2>Your books</h2>
${holdingsList}

<h2>Sign out</h2>
<form method="POST" action="${basePath}/logout" style="display:inline;"><button class="commerce-btn quiet" type="submit">Sign out</button></form>

<h2>What you pay for</h2>
<div style="font-family: 'Source Serif 4', serif; font-size: 16px; line-height: 1.7; color: #524a3e;">
<p>Single works are <b style="color:#1f1b16">$9.99 each</b>, yours forever.</p>
<p><b style="color:#1f1b16">All-Access</b> is $12.99 per month. Cancel any time. The works you bought separately stay yours.</p>
<p style="font-family: 'Cormorant Garamond', serif; font-style: italic; color: #8a8070; margin-top: 18px;">We don't offer refunds. We deliver instantly, the books are public-domain text, and a refund policy creates more problems than it solves at this price point. If you're not sure, sample any book before buying. If you were charged in error, contact us and we'll fix it.</p>
</div>
`;
    res.send(shell("Account", body));
  });

  // ─── /paideia/login — magic link + OAuth ───
  router.get("/login", (req, res) => {
    const next = req.query.next ? `?next=${encodeURIComponent(req.query.next)}` : "";
    const sent = req.query.sent === "1";
    const err = req.query.err;

    let inner;
    if (!isAuthConfigured()) {
      inner = `<p style="font-family: 'Cormorant Garamond', serif; font-style: italic; color: #6b5d4a;">Auth is not configured yet. Set <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code> to enable sign-in.</p><a class="commerce-btn quiet" href="${basePath}/" style="margin-top: 20px;">Continue browsing</a>`;
    } else if (sent) {
      inner = `<p style="font-family: 'Cormorant Garamond', serif; font-style: italic; color: #6b5d4a;">A sign-in link is on its way to your inbox. Click it from the same browser to enter Kalopaideia.</p><a class="commerce-btn quiet" href="${basePath}/login${next}" style="margin-top: 14px;">Send another</a>`;
    } else {
      const errMsg = err ? `<div class="commerce-err">${esc(err)}</div>` : "";
      inner = `${errMsg}
<form method="POST" action="${basePath}/auth/magic-link${next}" class="commerce-form">
  <input type="email" name="email" required autofocus placeholder="you@somewhere">
  <button type="submit" class="commerce-btn" style="width:100%;">Send a magic link</button>
</form>
<hr style="margin: 22px 0; border: 0; border-top: 1px solid #d8cfbe;">
<a class="commerce-btn quiet" style="display:block; width:100%; margin-bottom: 10px; box-sizing: border-box; text-align: center;" href="${basePath}/auth/oauth/google${next}">Continue with Google</a>
<a class="commerce-btn quiet" style="display:block; width:100%; box-sizing: border-box; text-align: center;" href="${basePath}/auth/oauth/apple${next}">Continue with Apple</a>`;
    }

    const body = `
<div style="max-width: 420px; margin: 60px auto; text-align:center;">
  <h1>Sign in</h1>
  <p class="commerce-sub">A magic link, a Google sign-in, an Apple sign-in.</p>
  <div class="commerce-card" style="text-align: left;">${inner}</div>
  <p style="margin-top: 20px; font-family: 'Cormorant Garamond', serif; font-style: italic; color: #8a8070; font-size: 14px;">One sign-in works at <a class="commerce-link" href="https://newcharterventures.com/mansion/">The Reading Mansion</a> too.</p>
</div>`;
    res.send(shell("Sign in", body));
  });

  router.post("/auth/magic-link", async (req, res, next) => {
    if (!isAuthConfigured() || !supabaseAnon) {
      return res.redirect(`${basePath}/login?err=` + encodeURIComponent("Auth not configured"));
    }
    const email = String(req.body?.email || "").trim();
    if (!email) return res.redirect(`${basePath}/login?err=` + encodeURIComponent("Email is required"));
    const proto = req.protocol;
    const host = req.get("host");
    const nextPath = String(req.query.next || `${basePath}/`);
    const redirectTo = `${proto}://${host}${basePath}/auth/callback?next=${encodeURIComponent(nextPath)}`;
    try {
      const { error } = await supabaseAnon.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
      });
      if (error) {
        return res.redirect(`${basePath}/login?err=` + encodeURIComponent(error.message));
      }
      return res.redirect(`${basePath}/login?sent=1`);
    } catch (e) { next(e); }
  });

  router.get("/auth/oauth/:provider", async (req, res, next) => {
    const provider = req.params.provider;
    if (!["google", "apple", "github"].includes(provider)) return res.status(400).send("unknown provider");
    if (!isAuthConfigured() || !supabaseAnon) return res.redirect(`${basePath}/login?err=` + encodeURIComponent("Auth not configured"));
    const proto = req.protocol;
    const host = req.get("host");
    const nextPath = String(req.query.next || `${basePath}/`);
    const redirectTo = `${proto}://${host}${basePath}/auth/callback?next=${encodeURIComponent(nextPath)}`;
    try {
      const { data, error } = await supabaseAnon.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) return res.redirect(`${basePath}/login?err=` + encodeURIComponent(error.message));
      return res.redirect(data.url);
    } catch (e) { next(e); }
  });

  router.get("/auth/callback", async (req, res) => {
    if (!isAuthConfigured() || !supabaseAnon) return res.redirect(`${basePath}/login?err=` + encodeURIComponent("Auth not configured"));
    const code = String(req.query.code || "");
    const nextPath = String(req.query.next || `${basePath}/`);
    if (!code) {
      const tokenHash = String(req.query.token_hash || "");
      const type = String(req.query.type || "email");
      if (tokenHash) {
        try {
          const { data, error } = await supabaseAnon.auth.verifyOtp({ token_hash: tokenHash, type });
          if (error || !data?.user) throw error || new Error("no user");
          await persistUserAndLogin(req, data.user);
          return res.redirect(nextPath);
        } catch (e) {
          return res.redirect(`${basePath}/login?err=` + encodeURIComponent("Sign-in link expired or invalid"));
        }
      }
      return res.redirect(`${basePath}/login?err=` + encodeURIComponent("Missing code"));
    }
    try {
      const { data, error } = await supabaseAnon.auth.exchangeCodeForSession(code);
      if (error || !data?.user) throw error || new Error("no user");
      await persistUserAndLogin(req, data.user);
      return res.redirect(nextPath);
    } catch (e) {
      return res.redirect(`${basePath}/login?err=` + encodeURIComponent("Sign-in failed: " + e.message));
    }
  });

  async function persistUserAndLogin(req, supabaseUser) {
    const email = supabaseUser.email || supabaseUser.user_metadata?.email;
    const display_name = supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || (email ? email.split("@")[0] : null);
    const u = findOrCreateUser({ id: supabaseUser.id, email, display_name });
    req.session.userId = u.id;
  }

  router.post("/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("paideia.sid");
      res.redirect(`${basePath}/`);
    });
  });

  // ─── checkout ───
  function requireUser(req, res) {
    if (req.user) return req.user;
    res.redirect(`${basePath}/login?next=${encodeURIComponent(req.originalUrl)}`);
    return null;
  }
  function notConfiguredPage(res, summary) {
    return res.send(shell("Almost ready", `<h1>Almost ready</h1><p class="commerce-sub">Set STRIPE_SECRET_KEY to enable purchases.</p><p style="font-style: italic; color: #6b5d4a;">${esc(summary)}</p><a class="commerce-btn quiet" href="javascript:history.back()">← Back</a>`));
  }

  router.post("/checkout/stoa-book/:id", async (req, res, next) => {
    try {
      const w = stoaById(req.params.id);
      if (!w) return res.status(404).send("Not found");
      if (!stripeConfigured()) return notConfiguredPage(res, `${w.title} — $9.99`);
      const user = requireUser(req, res); if (!user) return;
      const session = await createStoaBookCheckout({ user, book: w, req });
      return res.redirect(303, session.url);
    } catch (e) { next(e); }
  });

  router.post("/checkout/all-access", async (req, res, next) => {
    try {
      if (!stripeConfigured()) return notConfiguredPage(res, "Kalopaideia All-Access — $12.99/month");
      const user = requireUser(req, res); if (!user) return;
      const session = await createAllAccessCheckout({ user, req });
      return res.redirect(303, session.url);
    } catch (e) { next(e); }
  });

  router.post("/billing/portal", async (req, res, next) => {
    try {
      if (!stripeConfigured()) return notConfiguredPage(res, "Billing portal");
      const user = requireUser(req, res); if (!user) return;
      const proto = req.protocol;
      const host = req.get("host");
      const session = await createPortalSession({ user, returnUrl: `${proto}://${host}${basePath}/account` });
      return res.redirect(303, session.url);
    } catch (e) { next(e); }
  });

  // ─── webhook (raw body required) ───
  router.post("/webhooks/stripe",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const sig = req.headers["stripe-signature"];
      if (!sig) return res.status(400).send("missing signature");
      let event;
      try { event = parseEvent(req.body, sig); }
      catch (e) { return res.status(400).send(`webhook error: ${e.message}`); }
      try { await handleEvent(event); res.status(200).send("ok"); }
      catch (e) { console.error("[paideia webhook]", e); res.status(500).send("handler error"); }
    }
  );

  // ─── /paideia/read/:id — owners-only line-by-line reader ───
  router.get("/read/:id", (req, res) => {
    const w = stoaById(req.params.id);
    if (!w) return res.status(404).send(shell("Not found", `<h1>Not found</h1>`));
    const user = req.user;
    const has = hasStoaAccess(user, w);
    if (!has) return res.redirect(`${basePath}/store/${encodeURIComponent(w.id)}`);

    // Resume from prior progress
    let resumeLineN = null;
    if (user) {
      const h = getHolding(user.id, 'stoa_book', w.id);
      if (h && h.last_cfi && /^stoa:\d+/.test(h.last_cfi)) {
        const m = h.last_cfi.match(/^stoa:(\d+)/);
        if (m) resumeLineN = parseInt(m[1], 10);
      }
    }
    const totalLines = (w.lines || []).length;

    const lines = (w.lines || []).map(ln => `
<div id="line-${ln.n}" style="display: grid; grid-template-columns: 36px 1fr 1fr; gap: 18px; padding: 12px 0; border-bottom: 1px solid #e6dfd0; align-items: baseline;" data-line="${ln.n}">
  <span style="font-family: Inter, sans-serif; font-size: 11px; color: #8a8070; text-align: right;">${ln.n}</span>
  <span style="font-family: 'Cormorant Garamond', serif; font-size: 18px; line-height: 1.55;">${esc(ln.original)}</span>
  <span style="font-family: 'Source Serif 4', serif; font-size: 16px; font-style: italic; color: #524a3e; line-height: 1.6;">${esc(ln.english)}</span>
  ${ln.gloss ? `<button onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'" style="grid-column: 2 / -1; font-family: Inter, sans-serif; font-size: 11px; color: #8c2a1e; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; cursor: pointer; background: none; border: 0; padding: 0; text-align: left;">show the gloss</button><div style="grid-column: 2 / -1; margin-top: 10px; padding: 14px 18px; background: #efe9dc; border-left: 2px solid #b0935a; font-family: 'Source Serif 4', serif; font-size: 14px; line-height: 1.6; color: #524a3e; display: none;">${esc(ln.gloss).replace(/\\*\\*([^*]+)\\*\\*/g, "<b>$1</b>")}</div>` : ""}
</div>`).join("");

    const resumeHtml = (resumeLineN && resumeLineN > 1) ? `
<div style="background: #efe9dc; border-left: 3px solid #b0935a; padding: 14px 22px; margin: 16px 0 28px; display: flex; justify-content: space-between; align-items: center; font-family: 'Cormorant Garamond', serif; font-style: italic; color: #524a3e;">
  <span>You left off at line ${resumeLineN}.</span>
  <a href="#line-${resumeLineN}" style="font-family: Inter, sans-serif; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase; color: #8c2a1e; font-style: normal;">Resume →</a>
</div>` : '';

    const progressJs = user ? `
<script>
(function(){
  const lines = document.querySelectorAll('[data-line]');
  if (!lines.length) return;
  let lastLine = ${resumeLineN ? resumeLineN : 1};
  let timer = null;
  function visibleLineNow() {
    const mid = window.scrollY + window.innerHeight * 0.4;
    let best = lastLine;
    for (const el of lines) {
      const top = el.offsetTop;
      if (top <= mid) best = parseInt(el.dataset.line, 10);
      else break;
    }
    return best;
  }
  function save() {
    const n = visibleLineNow();
    if (n === lastLine) return;
    lastLine = n;
    fetch('${basePath}/api/stoa/progress/${esc(w.id)}', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ line: n, total: ${totalLines} }),
    }).catch(() => {});
  }
  window.addEventListener('scroll', () => { clearTimeout(timer); timer = setTimeout(save, 600); }, { passive: true });
  window.addEventListener('beforeunload', save);
})();
</script>` : '';

    const body = `
<p class="commerce-nav"><a href="${basePath}/store/${esc(w.id)}">← ${esc(w.title)}</a></p>
<h1>${esc(w.title)}</h1>
<p class="commerce-sub">${esc(w.author)} · ${esc(w.date || "")} · ${esc(w.language || "")}</p>
${resumeHtml}
<div style="margin-top: 32px;">${lines}</div>
${progressJs}
`;
    res.send(shell(w.title, body));
  });

  // ─── Stoa progress API (Kalopaideia) ───
  router.post("/api/stoa/progress/:id", (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'sign in required' });
    const w = stoaById(req.params.id);
    if (!w) return res.status(404).json({ error: 'unknown work' });
    if (!hasStoaAccess(req.user, w)) return res.status(403).json({ error: 'no access' });
    const line = parseInt(req.body?.line, 10);
    const total = parseInt(req.body?.total, 10);
    if (!Number.isFinite(line) || line < 1) return res.status(400).json({ error: 'bad line' });
    const cfi = `stoa:${line}`;
    const pct = (Number.isFinite(total) && total > 0) ? Math.round((line / total) * 100) : null;
    saveReadingProgress(req.user.id, 'stoa_book', w.id, { cfi, progressPct: pct });
    res.setHeader('content-type', 'application/json');
    res.json({ ok: true });
  });

  // ─── /paideia/store-home — alternative landing for the store ───
  router.get("/store/", (req, res) => res.redirect(`${basePath}/store`));

  return router;
}
