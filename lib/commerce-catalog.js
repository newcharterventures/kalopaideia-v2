// lib/commerce-catalog.js — load the SHARED Stoa catalog.
// Same JSON files the Mansion serves, read from the Mansion's data dir.

import fs from "node:fs";
import path from "node:path";

const STOA_DIR = process.env.MANSION_STOA_DIR
  || "/home/jae/.openclaw/workspace/mansion/data/stoa/library";

const PRICING = {
  stoa_book_cents: 999,
  classics_subscription_monthly_cents: 1299,
};

let _stoa = null;

function loadStoa() {
  if (_stoa) return _stoa;
  if (!fs.existsSync(STOA_DIR)) { _stoa = []; return _stoa; }
  _stoa = fs.readdirSync(STOA_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(STOA_DIR, f), "utf-8"));
      const isGateway = data.id === "odyssey-book-1";
      return {
        ...data,
        is_gateway: isGateway,
        price_cents: isGateway ? 0 : PRICING.stoa_book_cents,
        license: "public_domain",
      };
    })
    .sort((a, b) => {
      const order = { greek: 1, latin: 2, "old-english": 3, oldenglish: 3, german: 4, french: 5, italian: 6 };
      return (order[a.language] || 9) - (order[b.language] || 9);
    });
  return _stoa;
}

export function listStoa() { return loadStoa(); }
export function stoaById(id) { return loadStoa().find(b => b.id === id) || null; }
export function stoaCatalogView() {
  return loadStoa().map(b => ({
    id: b.id,
    title: b.title,
    author: b.author,
    language: b.language,
    date_composed: b.date,
    line_count: (b.lines || []).length,
    is_gateway: b.is_gateway,
    price_cents: b.price_cents,
    status: b.status || "open",
  }));
}
export { PRICING };
