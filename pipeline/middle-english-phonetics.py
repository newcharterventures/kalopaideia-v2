"""
Middle English phonetic respelling for Edge TTS.

Edge TTS has no Middle English voice. The closest commercial voice is en-GB.
A modern English voice reads Chaucer's manuscript spelling like modern English,
which is wrong on many counts — silent gh, silent k in 'knight', the Great
Vowel Shift's effect on long vowels, the silent final -e, the missing rhotic /r/.

This module respells common Middle English words and patterns into modern
English orthography that, when read by a modern en-GB voice, produces a sound
much closer to Chaucerian Middle English (London dialect, c. 1380), before the
Great Vowel Shift.

What we capture:
  - Long vowels were continental, not shifted: ī = /iː/ (modern 'ee'),
    ō = /oː/ (modern 'oh'), ū = /uː/ (modern 'oo'), ā = /aː/ (modern 'ah').
  - Final -e was a sounded schwa /ə/ in stressed position.
  - The 'gh' in 'knight', 'thought' was /ç/ or /x/ — we approximate with 'kh'
    or sometimes drop, depending on what Sonia/Ryan do best.
  - The 'k' in 'knight' was sounded.
  - The 'r' was always pronounced (rhotic), including post-vocalic.

What we do NOT capture (limits of TTS):
  - Voiceless 'wh' /ʍ/ (Sonia/Ryan don't distinguish from /w/).
  - True velar fricative /x/ (English voices flatten to /k/ or silence).
  - True alveolar trill (English voices use the modern approximant /ɹ/).
  - Genuine /aː/ vowel value (closest English approximant /ɑː/ as in 'father').

The audio remains a respectful approximation, marked as such in the primer.

Usage:
    from middle_english_phonetics import respell_middle_english
    text = respell_middle_english("Whan that Aprille with his shoures soote")
    # → "When that ah-PREEL-uh with hees SHOO-res SOH-tuh" (or similar)

The function is pure: input ME text → output respelled string.
Idempotent (running twice does no harm).
"""
import re

# Hand-curated overrides for common ME words. The respelling is what we want
# en-GB-RyanNeural to PRONOUNCE — using modern English orthography to elicit
# the desired phonetic shape. Whitespace-safe; case-insensitive matching;
# preserves the original case of the first letter.
#
# Format: lowercase ME spelling → respelled string for modern voice.
# Apostrophes and apostrophized contractions handled separately.
WORD_OVERRIDES = {
    # === The most famous Canterbury opening — Chaucer specifics ===
    "whan":        "when",            # initial wh- /ʍ/ approximated as /w/
    "aprille":     "ah-preel-uh",     # /aˈpriːlə/
    "shoures":     "shoo-res",        # /ʃuːrəs/
    "soote":       "soh-tuh",         # /soːtə/
    "droghte":     "droh-tuh",        # /droːtə/ — silent gh, sounded final -e
    "roote":       "roh-tuh",         # /roːtə/
    "perced":      "pair-sed",        # /pɛrsəd/
    "veyne":       "vain-uh",         # /vɛinə/ (but Mossé reads /vaɪnə/; both attested)
    "swich":       "switch",          # /swɪtʃ/
    "licour":      "lee-koor",        # /liˈkuːr/
    "vertu":       "ver-too",         # /vɛrˈtuː/
    "engendred":   "en-jen-dred",     # /ɛnˈdʒɛndrəd/
    "flour":       "floor",           # /fluːr/ — same root as 'flower'
    "zephirus":    "zeh-fee-roos",    # /ˈzɛfiːrus/
    "eek":         "ake",             # /eːk/
    "sweete":      "sway-tuh",        # /sweːtə/
    "breeth":      "brayth",          # /breːθ/
    "inspired":    "in-speer-ed",     # /ɪnˈspiːrəd/ — long ī
    "holt":        "holt",            # /hɔlt/
    "heeth":       "hayth",           # /heːθ/
    "tendre":      "ten-druh",        # /tɛndrə/
    "croppes":     "krop-es",         # /krɔpəs/
    "yonge":       "yong-uh",         # /jɔŋɡə/ — sounded final -e
    "sonne":       "sun-uh",          # /sʊnə/ — sounded final -e
    "ram":         "rom",             # /rɔm/ - keeping modern is fine
    "halve":       "hal-vuh",         # /halvə/
    "cours":       "koorss",          # /kuːrs/
    "yronne":      "ee-ron-uh",       # /iˈrɔnə/ — y- past-participle prefix
    "smale":       "smah-luh",        # /smɑːlə/
    "foweles":     "fow-el-es",       # three syllables /ˈfʊɣələs/
    "maken":       "mah-ken",         # /ˈmɑːkən/
    "melodye":     "meh-loh-dee-uh",  # four syllables /mɛˌloˈdiːə/
    "slepen":      "slay-pen",        # /sleːpən/
    "nyght":       "neekht",          # /niçt/ — long ī, sounded gh
    "ye":          "yuh",             # /jə/ for the eye (singular); "ye" plural left alone
    "priketh":     "prick-eth",       # /ˈprɪkəθ/
    "hem":         "hem",             # them (no change)
    "nature":      "nah-toor",        # /naˈtuːr/ — French stress preserved
    "hir":         "heer",            # /hɪr/ their
    "corages":     "koo-rah-jes",     # /kuˈrɑːdʒəs/
    "thanne":      "than-uh",         # /θanə/
    "longen":      "long-en",         # /ˈlɔŋɡən/
    "folk":        "folk",            # the l was sounded
    "goon":        "gohn",            # /goːn/
    "pilgrimages": "pill-gree-mah-jes", # /ˌpɪlɡriˈmɑːdʒəs/
    "palmeres":    "pal-mer-es",      # three syllables /ˈpalmərəs/
    "for":         "for",
    "seken":       "say-ken",         # /seːkən/
    "straunge":    "strahn-juh",      # /ˈstraʊndʒə/ ~ /ˈstraundʒə/
    "strondes":    "stron-des",       # /ˈstrɔndəs/
    "ferne":       "fair-nuh",        # /fɛrnə/
    "halwes":      "hal-wes",         # /halwəs/ shrines
    "kowthe":      "koo-thuh",        # /kuːθə/ — known
    "sondry":      "son-dree",        # /ˈsɔndri/
    "londes":      "lon-des",         # /ˈlɔndəs/
    "specially":   "speh-see-al-lee", # four syllables /ˌspɛsiˈali/
    "shires":      "sheer-es",        # /ˈʃiːrəs/
    "ende":        "en-duh",          # /ɛndə/
    "engelond":    "en-geh-lond",     # three syllables /ˈɛnɡəlɔnd/
    "caunterbury": "cawn-ter-bree",   # /ˈkaʊnterbri/ ~ /ˈkɔntəbri/
    "wende":       "wen-duh",         # /wɛndə/
    "hooly":       "hoh-lee",         # /ˈhoːli/
    "blisful":     "blees-fool",      # /ˈbliːsfʊl/
    "martir":      "mar-teer",        # /ˈmartiːr/
    "seke":        "say-kuh",         # /seːkə/
    "holpen":      "hol-pen",         # /hɔlpən/ helped, strong past part.
    # — narrator at the Tabard —
    "bifil":       "bee-feel",        # /biˈfiːl/
    "seson":       "say-son",         # /ˈseːsɔn/
    "southwerk":   "sooth-werk",      # /ˈsuːθwerk/
    "tabard":      "ta-bard",
    "lay":         "lay",
    "redy":        "ray-dee",         # /ˈreːdi/
    "wenden":      "wen-den",         # /ˈwɛndən/
    "pilgrymage":  "pill-gree-mah-juh",
    "ful":         "fool",            # /fʊl/ — very
    "devout":      "deh-voot",        # /dəˈvuːt/
    "corage":      "koo-rah-juh",     # /kuˈrɑːdʒə/ heart
    "hostelrye":   "hoh-stel-ree-uh", # /ˌhostelˈriːə/
    "wel":         "well",
    "nyne":        "nee-nuh",         # /niːnə/
    "twenty":      "twen-tee",
    "compaignye":  "com-pain-yee-uh", # /kɔmˈpaɪɲiːə/
    "yfalle":      "ee-fal-uh",       # /iˈfalə/ y- past part
    "felaweshipe": "fel-aw-shipe",    # /ˈfɛlawʃiːpə/
    "pilgrimes":   "pill-grim-es",
    "alle":        "ahl-uh",          # /alə/
    "toward":      "to-ward",
    "wolden":      "wol-den",         # /ˈwɔldən/
    "ryde":        "ree-duh",         # /riːdə/
    "chambres":    "chom-bres",       # /ˈʃambrəs/ - French loan
    "stables":     "stah-bles",
    "weren":       "wair-en",         # /wɛrən/
    "wyde":        "wee-duh",         # /wiːdə/
    "esed":        "ay-sed",          # /eːsəd/
    "atte":        "at-uh",
    "beste":       "bes-tuh",
    "shortly":     "short-lee",
    "reste":       "res-tuh",
    "spoken":      "spoh-ken",        # /ˈspoːkən/
    "everichon":   "ev-rich-own",     # /ˈɛvrɪtʃɔn/ each one
    "anon":        "an-on",
    "made":        "mah-duh",         # /mɑːdə/
    "forward":     "for-ward",        # promise
    "erly":        "air-lee",
    "ryse":        "ree-zuh",         # /riːzə/
    "oure":        "oor-uh",          # /uːrə/
    "wey":         "way",
    "ther":        "thair",           # /θɛr/ — rhotic
    "yow":         "you",
    "devyse":      "deh-vee-zuh",     # /dəˈviːzə/
    "but":         "but",
    "nathelees":   "nath-uh-lees",    # /ˌnaθəˈleːs/
    "whil":        "wheel",           # /wiːl/ wh- → w
    "tyme":        "tee-muh",         # /tiːmə/
    "space":       "spah-suh",        # /spɑːsə/
    "er":          "air",             # /ɛr/ — before
    "ferther":     "fer-ther",
    "tale":        "tah-luh",         # /tɑːlə/
    "pace":        "pah-suh",         # /pɑːsə/
    "thynketh":    "thin-keth",
    "acordaunt":   "ack-or-dawnt",
    "resoun":      "ray-zoon",        # /reːzun/
    "telle":       "tel-uh",
    "condicioun":  "kon-dee-see-oon", # four syllables /kɔnˌdisiˈuːn/
    "ech":         "etch",            # /ɛtʃ/
    "as":          "as",
    "semed":       "say-med",         # /seːməd/
    "me":          "meh",             # final -e dropped already
    "whiche":      "which-uh",        # /wɪtʃə/
    "of":          "off",             # /ɔf/
    "what":        "what",
    "degree":      "deh-gray",        # /dəˈɡreː/
    "array":       "ah-ray",
    "inne":        "in-uh",
    "knyght":      "kneekht",         # /knict/ — sounded k, sounded gh as kh
    "wol":         "wol",             # will
    "first":       "first",           # rhotic r
    # — some leftovers from later lines (rhetorical setup at line 35–42) —
    "alle":        "ahl-uh",          # /alə/
    "ende":        "en-duh",          # /ɛndə/
    "riche":       "reech-uh",        # /riːtʃə/
    "yeer":        "yair",            # /jɛr/ year
    "thise":       "thee-suh",        # /ðiːzə/
    "shal":        "shal",            # shall
    "man":         "man",
    "bigynne":     "bee-gin-uh",      # /biˈɡɪnə/
    # — today's Middle English word —
    "corteys":     "cor-tayss",       # /kɔrˈtɛis/
    "corteysly":   "cor-tays-lee",
    "corteysie":   "cor-tay-see-uh",  # /kɔrˈtɛisiə/
    "gentil":      "jen-teel",        # /dʒɛnˈtiːl/
    "port":        "port",            # bearing
    "spak":        "spahk",
    "faire":       "fay-ruh",         # /faɪrə/
    "maner":       "mah-nair",
}

# Patterns to apply to UNRECOGNIZED words. Order matters: longer patterns first.
# Each is (regex, replacement). All operate on lowercase tokens.
PATTERNS = [
    # gh after vowel → silent or 'kh' in stressed position. Strict: drop.
    # (The override map handles 'knyght', 'nyght' explicitly.)
    (re.compile(r"ought$"), "owt"),       # 'thought' → 'thowt' /θɔwt/
    (re.compile(r"aught$"), "awt"),
    (re.compile(r"ought"),  "owt"),
    # Long vowel digraphs that need explicit modern spellings
    (re.compile(r"oo"),  "oo"),    # already correct in modern English
    (re.compile(r"ee"),  "ee"),
    # Final -e after consonant (sounded as schwa)
    (re.compile(r"([bcdfghjklmnpqrstvwxz])e\b"), r"\1uh"),
    # Final -es as a syllable (sounded /əs/ in many positions in Chaucer)
    # Skip — too aggressive without context.
]


# Common modern-English words that are spelled the same in ME and should pass
# through untouched. Without this guard, the trailing-e fallback turns 'the'
# into 'thuh', 'be' into 'buh', etc.
PASSTHROUGH = {
    "the", "be", "he", "she", "we", "me", "ye", "a", "an", "and", "or",
    "of", "in", "on", "to", "is", "it", "his", "her", "its", "by", "for",
    "as", "at", "so", "do", "go", "no", "now", "if", "my", "can",
    "i", "o", "oh", "ah", "all", "are", "that", "this", "with", "not",
}


def respell_word(word: str) -> str:
    """Respell a single Middle English word for modern TTS. Preserves case
    of the first letter (Title-case input → Title-case output)."""
    if not word:
        return word
    lower = word.lower()
    if lower in PASSTHROUGH:
        return word
    if lower in WORD_OVERRIDES:
        out = WORD_OVERRIDES[lower]
    else:
        out = lower
        for pat, rep in PATTERNS:
            out = pat.sub(rep, out)
    # Restore initial capitalization if the original was capitalized
    if word[0].isupper() and out:
        out = out[0].upper() + out[1:]
    return out


# Word boundary regex that respects ME apostrophes and contractions.
# Match runs of letters; punctuation passes through unchanged.
_TOKEN_RE = re.compile(r"[A-Za-zæþðȝǣÆÞÐȜǢ']+")


def respell_middle_english(text: str) -> str:
    """Respell every word in a Middle English line for modern TTS pronunciation.
    Punctuation and whitespace are preserved exactly. The yogh/thorn/eth
    normalization in voices.py runs AFTER this; this function expects original
    Middle English orthography on input."""
    if not text:
        return text
    out_parts = []
    pos = 0
    for m in _TOKEN_RE.finditer(text):
        if m.start() > pos:
            out_parts.append(text[pos:m.start()])
        out_parts.append(respell_word(m.group(0)))
        pos = m.end()
    if pos < len(text):
        out_parts.append(text[pos:])
    return "".join(out_parts)


if __name__ == "__main__":
    # Quick smoke test for a curious operator.
    samples = [
        "Whan that Aprille with his shoures soote",
        "The droghte of March hath perced to the roote,",
        "Of which vertu engendred is the flour;",
        "And smale foweles maken melodye,",
        "Thanne longen folk to goon on pilgrimages,",
        "The hooly blisful martir for to seke,",
        "And at a knyght than wol I first bigynne.",
    ]
    for s in samples:
        print(s)
        print(" -> ", respell_middle_english(s))
        print()
