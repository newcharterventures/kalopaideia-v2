/**
 * Letter → {ipa, name} lookup for each language.
 * SINGLE SOURCE OF TRUTH: primer alphabet JSON served via /api/primer/:lang
 * (or embedded in /api/language/:lang responses).
 *
 * All values come directly from data/primer/<lang>.json — no hand-written
 * overrides. This guarantees the letter breakdown matches the Alphabet &
 * Pronunciation tab exactly.
 */

window.LetterPhonetics = (function () {

  // Parse the IPA field from the primer.
  // Examples:
  //   "[a] / [aː]"   → "a"   (take first variant, strip brackets)
  //   "a aː"         → "a"   (take first token)
  //   "/k/ or /s/"   → "k"
  //   "ɡ"            → "ɡ"
  function cleanIpa(raw) {
    if (!raw) return "";
    let s = String(raw);
    // Strip wrapping punctuation and split on common separators
    s = s.replace(/[\[\]/]/g, " ");
    // Common separators in primer entries
    const parts = s.split(/\s+or\s+|[,;]|\s+\/\s+|\s+/);
    for (const p of parts) {
      const trimmed = p.trim();
      if (trimmed && trimmed !== "—") return trimmed;
    }
    return s.trim();
  }

  // Normalize the 'char' field to its lowercase form.
  // Skip entries whose char field looks like a reference header rather than
  // a single letter (e.g. "Accents: é è ê ..." is a catch-all description,
  // not an entry for any specific letter).
  function charKeys(charField) {
    if (!charField) return [];
    const raw = String(charField).trim();
    // Reject reference-header entries
    if (/[:;\u2014\u2013\-—]/.test(raw) && raw.length > 6) return [];
    if (/accents?|diacrit|mark|note|variant/i.test(raw)) return [];
    const tokens = raw.split(/\s+/);
    // Only accept entries where every token is a single grapheme or very short.
    // An entry with >3 tokens is almost certainly a description, not letters.
    if (tokens.length > 3) return [];
    const keys = new Set();
    for (const t of tokens) {
      keys.add(t);
      keys.add(t.toLowerCase());
    }
    return [...keys];
  }

  // Reject values that come from reference sections where name/ipa are placeholders.
  function isPlaceholderValue(val) {
    if (!val) return true;
    const lowerName = (val.name || "").toLowerCase();
    const lowerIpa = (val.ipa || "").toLowerCase();
    if (lowerName === "varies" || lowerName === "") return true;
    if (lowerName.includes("diacrit") || lowerName.includes("mark")) return true;
    if (lowerIpa === "varies") return true;
    return false;
  }

  // Normalize a letter name for display.
  // Latin primer uses "ā", "bē", "cē" etc. — these are great, show as-is.
  // Greek "alpha", "beta" — show as-is.
  // German "a-Umlaut" — keep hyphen, show as-is.
  function cleanName(raw) {
    if (!raw) return "";
    return String(raw).trim();
  }

  // Strip combining diacritics to get a base letter.
  function baseChar(ch) {
    return ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  // Cache of lang → map
  const _cache = {};

  /**
   * Build a lookup map from a primer object.
   * Returns { "char": {ipa, name}, ... }
   */
  function buildMap(primer) {
    const map = {};
    const alphabet = primer && primer.alphabet ? primer.alphabet : [];
    for (const entry of alphabet) {
      const keys = charKeys(entry.char);
      const value = {
        ipa: cleanIpa(entry.ipa),
        name: cleanName(entry.name),
      };
      for (const k of keys) {
        if (!map[k]) map[k] = value;  // first entry wins
      }
    }
    return map;
  }

  /**
   * Set the primer for a language. Called after fetching /api/language or /api/primer.
   */
  function setPrimer(lang, primer) {
    if (!lang || !primer) return;
    _cache[lang] = buildMap(primer);
  }

  /**
   * Fetch the primer for a language if not cached.
   * Returns a promise that resolves when the map is available.
   */
  async function ensurePrimer(lang) {
    if (_cache[lang]) return _cache[lang];
    try {
      const resp = await fetch(`/paideia/api/primer/${lang}`);
      if (!resp.ok) throw new Error(`primer fetch failed: ${resp.status}`);
      const primer = await resp.json();
      _cache[lang] = buildMap(primer);
      return _cache[lang];
    } catch (e) {
      console.warn(`Could not load primer for ${lang}`, e);
      _cache[lang] = {};
      return _cache[lang];
    }
  }

  // Aliases: characters that share the same sound/name as another (e.g. Greek
  // final sigma ς is a positional variant of σ).
  const ALIASES = {
    greek: { "ς": "σ" },
  };

  /**
   * Look up {ipa, name} for a letter in a given language.
   * Synchronous — requires the map to already be cached.
   *
   * For accented letters (é, è, etc.) we prefer the base letter's entry since
   * accented variants in Latin-script primers are typically described in a single
   * "e" entry that covers all accent forms. We only use a diacritical-specific
   * entry if it's a real standalone letter (æ, ø, þ, ð etc.).
   */
  function lookup(letter, lang) {
    if (!letter || !lang) return { ipa: "", name: "" };
    const map = _cache[lang];
    if (!map) return { ipa: "", name: "" };
    const lower = letter.toLowerCase();
    const base = baseChar(lower);

    // Preference order:
    //   1. The letter's own entry in the alphabet, IF it's a real letter entry
    //      (not a "Diacritical Marks" reference section placeholder).
    //   2. For letters with diacritics, fall back to the base letter.
    //   3. Aliases.
    //   4. Any last-resort entry (even placeholder) for base char.
    if (map[lower] && !isPlaceholderValue(map[lower])) return map[lower];
    if (map[letter] && !isPlaceholderValue(map[letter])) return map[letter];
    // Fall back to base letter (strip diacritics)
    if (lower !== base && map[base] && !isPlaceholderValue(map[base])) return map[base];

    // Alias (e.g. final sigma)
    const aliases = ALIASES[lang] || {};
    if (aliases[letter] && map[aliases[letter]] && !isPlaceholderValue(map[aliases[letter]])) {
      return map[aliases[letter]];
    }
    if (aliases[lower] && map[aliases[lower]] && !isPlaceholderValue(map[aliases[lower]])) {
      return map[aliases[lower]];
    }

    // Last resort: base char even if placeholder (better than nothing)
    if (map[base]) return map[base];
    return { ipa: "", name: "" };
  }

  /**
   * Build an array of {letter, ipa, name} for a word.
   */
  function breakdown(word, lang) {
    if (!word) return [];
    const normalized = String(word).normalize("NFC");
    return Array.from(normalized)
      .filter(ch => !/\s/.test(ch))
      .map(ch => {
        const { ipa, name } = lookup(ch, lang);
        return { letter: ch, ipa: ipa, name: name };
      });
  }

  /**
   * Render HTML: a row of letters, each with IPA + name beneath.
   */
  function renderHtml(word, lang, escFn) {
    const esc = escFn || ((s) => String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])));
    const items = breakdown(word, lang);
    if (items.length === 0) return "";
    const cells = items.map(it => `
      <span class="letter-cell">
        <span class="letter-char">${esc(it.letter)}</span>
        ${it.ipa ? `<span class="letter-ipa">${esc(it.ipa)}</span>` : ""}
        ${it.name ? `<span class="letter-name">${esc(it.name)}</span>` : ""}
      </span>
    `).join("");
    return `<div class="letter-breakdown-grid" aria-label="Letters in ${esc(word)}">${cells}</div>`;
  }

  return {
    setPrimer: setPrimer,
    ensurePrimer: ensurePrimer,
    lookup: lookup,
    breakdown: breakdown,
    renderHtml: renderHtml,
  };
})();
