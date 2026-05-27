// Paideia bookmark store — client-side localStorage
// Tracks where the user left off in each text.
//
// Storage shape:
//   { "<text_id>": {
//       language: "latin",
//       title: "...",
//       section_id: "paragraph-1" | null,
//       line_n: 5,
//       total_lines: 10,
//       updated_at: <epoch_ms>
//   }, ... }

const KEY = "paideia:bookmarks:v1";

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch { return {}; }
}

function writeAll(obj) {
  try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch {}
}

export function recordBookmark(entry) {
  if (!entry?.text_id) return;
  const all = readAll();
  all[entry.text_id] = {
    language: entry.language,
    title: entry.title,
    section_id: entry.section_id || null,
    line_n: entry.line_n || 0,
    total_lines: entry.total_lines || 0,
    updated_at: Date.now(),
  };
  writeAll(all);
}

export function getBookmarks() {
  const all = readAll();
  return Object.entries(all)
    .map(([text_id, data]) => ({ text_id, ...data }))
    .sort((a, b) => b.updated_at - a.updated_at);
}

export function getBookmarksForLanguage(lang) {
  return getBookmarks().filter((b) => b.language === lang);
}

export function clearBookmark(text_id) {
  const all = readAll();
  delete all[text_id];
  writeAll(all);
}
