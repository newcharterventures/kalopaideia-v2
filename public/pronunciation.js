/**
 * Pronunciation generation for Paideia
 * Generates IPA and approximations for words in Latin, Greek, German, French, Olde English
 */

const Pronunciation = {
  /**
   * Generate pronunciation for a word based on language
   * @param {string} word - The word to pronounce
   * @param {string} lang - Language code (latin, greek, german, french, italian, oldenglish, middleenglish)
   * @returns {Object} - { ipa: string, approx: string, say: string }
   */
  generate(word, lang) {
    if (!word || !lang) return null;
    
    const cleanWord = word.trim().toLowerCase();
    
    switch (lang) {
      case 'latin':
        return this.latin(cleanWord);
      case 'greek':
        return this.greek(cleanWord);
      case 'german':
        return this.german(cleanWord);
      case 'french':
        return this.french(cleanWord);
      case 'oldenglish':
        return this.oldEnglish(cleanWord);
      default:
        return null;
    }
  },

  /**
   * Classical Latin pronunciation (restored)
   */
  latin(word) {
    // Remove macrons for processing but keep track of them
    const hasMacron = /[āēīōūȳ]/.test(word);
    let ipa = word
      .replace(/ae/g, 'ai̯')
      .replace(/oe/g, 'oi̯')
      .replace(/au/g, 'au̯')
      .replace(/qu/g, 'kʷ')
      .replace(/c/g, 'k')
      .replace(/v/g, 'w')
      .replace(/j/g, 'j')
      .replace(/x/g, 'ks')
      .replace(/ch/g, 'kʰ')
      .replace(/ph/g, 'pʰ')
      .replace(/th/g, 'tʰ')
      .replace(/ā/g, 'aː')
      .replace(/ē/g, 'eː')
      .replace(/ī/g, 'iː')
      .replace(/ō/g, 'oː')
      .replace(/ū/g, 'uː')
      .replace(/ȳ/g, 'yː')
      .replace(/y/g, 'y')
      .replace(/a/g, 'a')
      .replace(/e/g, 'ɛ')
      .replace(/i/g, 'ɪ')
      .replace(/o/g, 'ɔ')
      .replace(/u/g, 'ʊ')
      .replace(/r/g, 'r')
      .replace(/s/g, 's')
      .replace(/t/g, 't')
      .replace(/n/g, 'n')
      .replace(/m/g, 'm')
      .replace(/l/g, 'l')
      .replace(/g/g, 'g')
      .replace(/b/g, 'b')
      .replace(/d/g, 'd')
      .replace(/p/g, 'p')
      .replace(/f/g, 'f')
      .replace(/h/g, 'h');

    // Approximation for English speakers
    const approx = word
      .replace(/ae/g, 'eye')
      .replace(/oe/g, 'oy')
      .replace(/c/g, 'k')
      .replace(/v/g, 'w')
      .replace(/j/g, 'y')
      .replace(/ā/g, 'AH')
      .replace(/ē/g, 'AY')
      .replace(/ī/g, 'EE')
      .replace(/ō/g, 'OH')
      .replace(/ū/g, 'OO')
      .toUpperCase();

    return {
      ipa: `/${ipa}/`,
      approx: approx,
      say: approx
    };
  },

  /**
   * Ancient Greek (Attic) pronunciation
   */
  greek(word) {
    let ipa = word
      .replace(/αι/g, 'ai̯')
      .replace(/ει/g, 'eː')
      .replace(/οι/g, 'oi̯')
      .replace(/υι/g, 'yi̯')
      .replace(/αυ/g, 'au̯')
      .replace(/ευ/g, 'eu̯')
      .replace(/ου/g, 'uː')
      .replace(/α/g, 'a')
      .replace(/ε/g, 'e')
      .replace(/η/g, 'ɛː')
      .replace(/ι/g, 'i')
      .replace(/ο/g, 'o')
      .replace(/υ/g, 'y')
      .replace(/ω/g, 'ɔː')
      .replace(/γ/g, 'g')
      .replace(/δ/g, 'd')
      .replace(/ζ/g, 'zd')
      .replace(/θ/g, 'tʰ')
      .replace(/κ/g, 'k')
      .replace(/λ/g, 'l')
      .replace(/μ/g, 'm')
      .replace(/ν/g, 'n')
      .replace(/ξ/g, 'ks')
      .replace(/π/g, 'p')
      .replace(/ρ/g, 'r')
      .replace(/σ|ς/g, 's')
      .replace(/τ/g, 't')
      .replace(/φ/g, 'pʰ')
      .replace(/χ/g, 'kʰ')
      .replace(/ψ/g, 'ps')
      // Remove accents for basic IPA
      .replace(/[άὰᾶἀἁἄἅ]/g, 'a')
      .replace(/[έὲἐἑἔἕ]/g, 'e')
      .replace(/[ήὴῆἠἡἤἥ]/g, 'ɛː')
      .replace(/[ίὶῖἰἱἴἵ]/g, 'i')
      .replace(/[όὸὀὁὄὅ]/g, 'o')
      .replace(/[ύὺῦὐὑὔὕ]/g, 'y')
      .replace(/[ώὼῶὠὡὤὥ]/g, 'ɔː');

    // Rough approximation
    const approx = word
      .replace(/[άὰᾶἀἁἄἅα]/g, 'ah')
      .replace(/[έὲἐἑἔἕε]/g, 'eh')
      .replace(/[ήὴῆἠἡἤἥη]/g, 'ay')
      .replace(/[ίὶῖἰἱἴἵι]/g, 'ee')
      .replace(/[όὸὀὁὄὅο]/g, 'oh')
      .replace(/[ύὺῦὐὑὔὕυ]/g, 'ew')
      .replace(/[ώὼῶὠὡὤὥω]/g, 'oh')
      .replace(/θ/g, 'th')
      .replace(/φ/g, 'ph')
      .replace(/χ/g, 'kh')
      .toUpperCase();

    return {
      ipa: `/${ipa}/`,
      approx: approx,
      say: approx
    };
  },

  /**
   * Modern Standard German pronunciation
   */
  german(word) {
    let ipa = word
      .replace(/sch/g, 'ʃ')
      .replace(/ch/g, 'x')
      .replace(/ck/g, 'k')
      .replace(/ie/g, 'iː')
      .replace(/ei/g, 'ai̯')
      .replace(/eu/g, 'ɔʏ̯')
      .replace(/äu/g, 'ɔʏ̯')
      .replace(/ä/g, 'ɛ')
      .replace(/ö/g, 'œ')
      .replace(/ü/g, 'y')
      .replace(/ß/g, 's')
      .replace(/z/g, 'ts')
      .replace(/v/g, 'f')
      .replace(/w/g, 'v')
      .replace(/j/g, 'j')
      .replace(/r/g, 'ʁ');

    const approx = word
      .replace(/sch/g, 'sh')
      .replace(/ch/g, 'kh')
      .replace(/ä/g, 'eh')
      .replace(/ö/g, 'er')
      .replace(/ü/g, 'ew')
      .replace(/ei/g, 'eye')
      .replace(/ie/g, 'ee')
      .toUpperCase();

    return {
      ipa: `/${ipa}/`,
      approx: approx,
      say: approx
    };
  },

  /**
   * Standard French pronunciation
   */
  french(word) {
    let ipa = word
      .replace(/ou/g, 'u')
      .replace(/eau/g, 'o')
      .replace(/au/g, 'o')
      .replace(/ai/g, 'ɛ')
      .replace(/ei/g, 'ɛ')
      .replace(/oi/g, 'wa')
      .replace(/eu/g, 'ø')
      .replace(/œu/g, 'œ')
      .replace(/an/g, 'ɑ̃')
      .replace(/en/g, 'ɑ̃')
      .replace(/in/g, 'ɛ̃')
      .replace(/on/g, 'ɔ̃')
      .replace(/un/g, 'œ̃')
      .replace(/é/g, 'e')
      .replace(/è/g, 'ɛ')
      .replace(/ê/g, 'ɛ')
      .replace(/à/g, 'a')
      .replace(/â/g, 'ɑ')
      .replace(/ç/g, 's')
      .replace(/gn/g, 'ɲ')
      .replace(/ch/g, 'ʃ')
      .replace(/j/g, 'ʒ')
      .replace(/r/g, 'ʁ');

    const approx = word
      .replace(/ou/g, 'oo')
      .replace(/au/g, 'oh')
      .replace(/ai/g, 'eh')
      .replace(/oi/g, 'wah')
      .replace(/ch/g, 'sh')
      .replace(/j/g, 'zh')
      .toUpperCase();

    return {
      ipa: `/${ipa}/`,
      approx: approx,
      say: approx
    };
  },

  /**
   * Olde English pronunciation
   */
  oldEnglish(word) {
    let ipa = word
      .replace(/æ/g, 'æ')
      .replace(/þ/g, 'θ')
      .replace(/ð/g, 'ð')
      .replace(/ċ/g, 'tʃ')
      .replace(/ġ/g, 'j')
      .replace(/sc/g, 'ʃ')
      .replace(/cg/g, 'dʒ')
      .replace(/c/g, 'k')
      .replace(/g/g, 'g')
      .replace(/h/g, 'h');

    const approx = word
      .replace(/æ/g, 'ah')
      .replace(/þ/g, 'th')
      .replace(/ð/g, 'th')
      .replace(/ċ/g, 'ch')
      .replace(/ġ/g, 'y')
      .replace(/sc/g, 'sh')
      .toUpperCase();

    return {
      ipa: `/${ipa}/`,
      approx: approx,
      say: approx
    };
  }
};

// Export for use in language.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Pronunciation;
}
