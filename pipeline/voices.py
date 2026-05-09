"""
Centralized voice configuration for Paideia TTS.
Each language gets a voice + per-context tuning (rate, pitch, prosody hints).

Edge TTS Communicate accepts:
  - voice: short name
  - rate: "+N%" / "-N%"
  - pitch: "+NHz" / "-NHz"
  - volume: "+N%" / "-N%"

It does NOT accept arbitrary SSML markup in the text body — only plain text.
So we use rate/pitch/volume parameters and add natural pauses by inserting
extra punctuation and ellipses where lines break.
"""

# Voice choices favor the "Multilingual" / expressive Edge models when available.
# These have warmer prosody and are better for poetry than the older Neural voices.
VOICES = {
    # Latin → Isabella with deep pitch + slow rate to evoke a Dido-like
    # gravitas (queenly, weighty, ritual). Jae's pick from 2026-04-25 audition.
    # Female-only rule preserved. Macrons stripped via preprocess_for_tts.
    "latin": {
        "voice": "it-IT-IsabellaNeural",
        "rate": "-18%",
        "pitch": "-8Hz",
    },
    # Greek → Seraphina Multilingual reading Greek text. Per Jae's audition
    # 2026-04-25, Athina is too 'friendly modern' for Sappho/Homer. Seraphina
    # gives Pythian gravity (German-flavored pronunciation, but voice quality
    # is what Jae chose). Female-only rule preserved.
    "greek": {
        "voice": "de-DE-SeraphinaMultilingualNeural",
        "rate": "-15%",
        "pitch": "-3Hz",
    },
    # French → Vivienne Multilingual has natural literary lilt; far better than Denise.
    "french": {
        "voice": "fr-FR-VivienneMultilingualNeural",
        "rate": "-8%",
        "pitch": "+1Hz",
    },
    # German → Seraphina Multilingual has more warmth than Katja for Goethe/Heine.
    "german": {
        "voice": "de-DE-SeraphinaMultilingualNeural",
        "rate": "-10%",
        "pitch": "-1Hz",
    },
    # Old English → Sonia lifted (en-GB), per Jae's audition pick 2026-04-25.
    # Sonia (originally chosen for OE) with +5Hz pitch lift and lighter rate
    # to give the medieval Elvish lilt without losing dignity. Earlier I
    # mis-numbered the audition tracks; Jae meant the lifted-Sonia variant.
    "oldenglish": {
        "voice": "en-GB-SoniaNeural",
        "rate": "-10%",
        "pitch": "+5Hz",
    },
    # Middle English (Chaucer, Pearl-poet) — en-GB-RyanNeural (male, deeper,
    # slightly Northern English flavor) per Jae 2026-05-09. Sonia read
    # Chaucer with a modern lilt; Ryan gives a sturdier, more guttural
    # consonantal attack closer to what Jae described as the historical
    # voice. Combined with the Middle English phonetic respelling layer
    # in middle_english_phonetics.py (gh, silent k restored, long vowels
    # given continental values, final -e sounded as schwa), the result is
    # a much closer approximation of London ME c. 1380. Still an
    # approximation — Edge TTS has no Middle English voice and English
    # voices cannot produce true /x/, true /ʍ/, or trilled /r/.
    "middleenglish": {
        "voice": "en-GB-RyanNeural",
        "rate": "-15%",
        "pitch": "-2Hz",
    },
    # Italian — Isabella for Dante/Petrarch/Boccaccio. Same voice as Latin
    # so the Tuscan inheritance from Latin is acoustically honest, but
    # without the macron-stripping or the deepened gravitas. Slight slow
    # for the hendecasyllabic line.
    "italian": {
        "voice": "it-IT-IsabellaNeural",
        "rate": "-10%",
        "pitch": "+0Hz",
    },
}


# Latin macron map. Edge TTS Italian voice doesn't recognize macron-vowels
# and falls back to character-by-character spelling for words containing them.
LATIN_MACRON_MAP = {
    'ā': 'a', 'ē': 'e', 'ī': 'i', 'ō': 'o', 'ū': 'u', 'ȳ': 'y',
    'Ā': 'A', 'Ē': 'E', 'Ī': 'I', 'Ō': 'O', 'Ū': 'U', 'Ȳ': 'Y',
    # Also the rarely-used breve marks
    'ă': 'a', 'ĕ': 'e', 'ĭ': 'i', 'ŏ': 'o', 'ŭ': 'u',
}

# Old English normalization. Edge TTS English voice spells out macrons and unfamiliar ligatures.
# Use phonetic equivalents that TTS will pronounce as words, not spell out.
OLD_ENGLISH_MAP = {
    'ǣ': 'ay',  # ae with macron → ay (closer to Old English long vowel, won't be spelled out)
    'Ǣ': 'Ay',
    'æ': 'a',   # ash → a (short vowel, TTS won't spell single letter in context)
    'Æ': 'A',
    'ð': 'th',  # eth → th
    'Ð': 'Th',
    'þ': 'th',  # thorn → th
    'Þ': 'Th',
}

# Middle English normalization. Chaucer-era texts use yogh (ȝ), thorn (þ),
# eth (ð) and the long-s. Edge en-GB Sonia spells these out as letter names.
# Map to phonetic equivalents that the voice handles as ordinary words.
MIDDLE_ENGLISH_MAP = {
    'ȝ': 'gh',  # yogh — typically /ɣ/, /j/, or /x/; "gh" reads as a soft 'gh'
    'Ȝ': 'Gh',
    'þ': 'th',  # thorn
    'Þ': 'Th',
    'ð': 'th',  # eth
    'Ð': 'Th',
    'æ': 'a',   # ash (rare in ME but appears in Pearl, Sir Gawain)
    'Æ': 'A',
    'ſ': 's',   # long-s (in older editions only)
}


def strip_latin_macrons(text: str) -> str:
    """Strip macrons/breves from Latin text so Edge TTS reads it as Italian-flavored Latin."""
    for k, v in LATIN_MACRON_MAP.items():
        text = text.replace(k, v)
    return text


def normalize_old_english(text: str) -> str:
    """Normalize Old English special characters to plain ASCII for Edge TTS.
    Converts æ/ǣ → ae, ð/þ → th so English voice pronounces words instead of spelling them.
    """
    for k, v in OLD_ENGLISH_MAP.items():
        text = text.replace(k, v)
    return text


def normalize_middle_english(text: str) -> str:
    """Normalize Middle English yogh/thorn/eth/ash to ASCII for Edge TTS so
    en-GB Ryan pronounces words rather than spelling letter names. Then
    apply phonetic respelling so the modern voice approximates pre-Great-
    Vowel-Shift London ME (c. 1380) instead of modern English. Per Jae
    2026-05-09. Edge TTS has no Middle English voice; this is the closest
    practical approximation — not a perfect reconstruction.
    """
    # Step 1: yogh/thorn/eth/ash to ASCII so the voice doesn't spell letter names.
    for k, v in MIDDLE_ENGLISH_MAP.items():
        text = text.replace(k, v)
    # Step 2: phonetic respelling for ME pronunciation. Imported lazily so
    # this module loads even if the phonetics file is absent.
    try:
        # Hyphen in module file name forces importlib path.
        import importlib.util, os
        _here = os.path.dirname(os.path.abspath(__file__))
        _spec = importlib.util.spec_from_file_location(
            "middle_english_phonetics",
            os.path.join(_here, "middle-english-phonetics.py"),
        )
        _mod = importlib.util.module_from_spec(_spec)
        _spec.loader.exec_module(_mod)
        text = _mod.respell_middle_english(text)
    except Exception as e:
        # If respelling fails for any reason, fall back to the
        # yogh/thorn-normalized form. Audio quality degrades to v1 but
        # the page still works.
        import sys
        print(f"[middleenglish] phonetic respelling skipped: {e}", file=sys.stderr)
    return text


def strip_greek_polytonic(text: str) -> str:
    """Strip polytonic accents/breathings from Greek text so Edge TTS doesn't
    misread accented short words (e.g. 'oὖn' read as the letter omicron
    instead of the word). Keeps base letters intact.
    Per Jae 2026-04-25: 'omicron' bug on Republic line 327b.
    
    Special case (2026-05-02): Standalone reflexive pronouns (ἑ, ἕ) become
    bare ε after stripping, which TTS pronounces as "epsilon" (letter name)
    instead of the word. Pre-map these to phonetic spellings.
    """
    import unicodedata
    import re
    
    # BEFORE stripping diacritics, replace standalone reflexive pronouns
    # with phonetic spellings that TTS will pronounce correctly.
    # ἑ (rough breathing) = accusative reflexive pronoun "him/us/them"
    # ἕ (rough breathing + acute) = same, with accent
    # Word boundaries ensure we only catch standalone instances, not within words.
    text = re.sub(r'\bἑ\b', 'heh', text)  # rough breathing → aspirated "heh"
    text = re.sub(r'\bἕ\b', 'heh', text)  # same with accent
    
    nfd = unicodedata.normalize("NFD", text)
    # Strip combining marks (Mn category): grave/acute/circumflex/breathings/iota subscript
    stripped = "".join(c for c in nfd if unicodedata.category(c) != "Mn")
    return unicodedata.normalize("NFC", stripped)


def preprocess_for_tts(text: str, lang_key: str) -> str:
    """Per-language text normalization before sending to Edge TTS.
    Latin: strip macrons (Edge spells out macron-words).
    Greek: strip polytonic diacritics (Edge spells out accented short words).
    Old English: normalize æ/ǣ/ð/þ to ASCII equivalents.
    Others: pass through.
    """
    if lang_key == "latin":
        return strip_latin_macrons(text)
    if lang_key == "greek":
        return strip_greek_polytonic(text)
    if lang_key == "oldenglish":
        return normalize_old_english(text)
    if lang_key == "middleenglish":
        return normalize_middle_english(text)
    return text


def add_prosody_hints(text: str) -> str:
    """
    Insert subtle pause cues that Edge TTS naturally honors via punctuation.
    - Caesura between half-lines in alliterative verse: comma already there if input has it.
    - Emphasis on line-final words: trailing ellipsis adds a gentle held note.
    - We do NOT inject SSML; Edge TTS strips unknown tags. Plain punctuation is the lever.
    """
    text = text.strip()
    if not text:
        return text
    # If the line is short (verse-likely) and ends with no terminal mark, add a soft period
    if len(text) < 100 and text[-1] not in ".!?;,:":
        text = text + "."
    return text


def speak_kwargs(lang_key: str, context: str = "library") -> dict:
    """
    Return kwargs for edge_tts.Communicate based on language + context.
    
    context options:
      - "library"     → reading line-by-line poetry/prose, slowed for clarity
      - "headword"    → single word pronunciation, normal rate
      - "alphabet"    → letter sounds, very slow
      - "sentence"    → "In Use" example sentences, moderate rate
    """
    cfg = VOICES.get(lang_key)
    if not cfg:
        raise KeyError(f"No voice for language: {lang_key}")
    
    base_rate = cfg["rate"]
    pitch = cfg["pitch"]
    
    # Adjust rate by context. Override ONLY if it would slow further than base;
    # never speed up past the language's base rate (so Latin's deep slow Dido
    # pacing isn't lost on headword/sentence).
    rate_overrides = {
        "headword": "-5%",
        "alphabet": "-30%",
        "sentence": "-10%",
        "library":  base_rate,
    }
    candidate = rate_overrides.get(context, base_rate)
    
    def _pct(s):
        try: return int(s.rstrip('%'))
        except: return 0
    # Pick whichever is slower (more negative)
    rate = candidate if _pct(candidate) < _pct(base_rate) else base_rate
    
    return {
        "voice": cfg["voice"],
        "rate": rate,
        "pitch": pitch,
    }
