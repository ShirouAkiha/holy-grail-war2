import { ServantTemplate } from '../types';

/**
 * Escapes regex special characters safely
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalizes diacritics and accents (e.g., "Scáthach" -> "scathach", "Kojirō" -> "kojiro")
 */
function normalizeText(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Known alias map for Type-Moon & Fate universe Heroic Spirits
 */
const ALIAS_MAP: Record<string, string[]> = {
  artoria_pendragon_alter: ['saber alter', 'salter', 'artoria alter', 'black saber', 'alter saber', 'saber_alter', 'dark saber'],
  artoria_pendragon: ['saber', 'seiba', 'king of knights', 'arturia', 'arthur', 'blue saber'],
  nero_claudius: ['nero', 'red saber', 'umu', 'emperor of roses', 'nero claudius', 'rose saber'],
  mordred: ['mordred', 'knight of treachery', 'saber of red'],
  musashi_miyamoto: ['musashi', 'miyamoto', 'shinmen', 'female musashi'],
  okita_souji: ['okita', 'shinsengumi', 'sakura saber'],
  gilgamesh: ['gil', 'king of heroes', 'auo', 'archer of babylon', 'gate of babylon'],
  emiya: ['nameless', 'faker', 'archer of fuyuki', 'gar', 'ubw', 'unlimited blade works', 'archer'],
  ishtar: ['ishtar', 'goddess of venus', 'rinface', 'archer ishtar'],
  arash: ['arash', 'stella'],
  cu_chulainn: ['lancer', 'cu', 'setanta', 'hound of culann', 'dog', 'gae bolg'],
  scathach: ['shishou', 'shadow lands', 'scathach', 'skadi', 'land of shadows'],
  karna: ['hero of charity', 'son of the sun god', 'karna', 'lancer of red', 'vasavi shakti'],
  medusa: ['rider', 'gorgon', 'pegasus', 'medusa', 'bellephron'],
  iskandar: ['alexander', 'king of conquerors', 'waver rider', 'iskandar', 'ionioi hetairoi'],
  astolfo: ['hippogriff', 'paladin', 'rider of black', 'astolfo'],
  medea: ['caster', 'witch of colchis', 'rule breaker', 'medea'],
  tamamo_no_mae: ['tamamo', 'mikokon', 'fox wife', 'caster of extra'],
  zhuge_liang: ['waver', 'lord el-melloi', 'el-melloi ii', 'zhuge'],
  merlin: ['magus of flowers', 'grand caster', 'cockroach', 'avalon'],
  heracles: ['herc', 'herakles', 'berserker', 'nine lives', 'god hand', 'basaka'],
  lancelot_berserker: ['black knight', 'knight of owner', 'arondight', 'berserker of fuyuki'],
  minamoto_no_raikou: ['raikou', 'mama', 'ushi gozen'],
  morg_le_fay: ['morgan', 'queen of faerie', 'ruler of camelot', 'morgan le fay'],
  jeanne_d_arc: ['jeanne', 'ruler', 'holy maiden of orleans', 'la pucelle', 'saint jeanne'],
  jeanne_alter: ['jalter', 'avenger jeanne', 'dragon witch', 'jeanne d\'arc (alter)'],
  sasaki_kojirou: ['kojirou', 'fake assassin', 'swallow slayer', 'gatekeeper', 'tsubame gaeshi'],
  hassan_of_cursed_arm: ['cursed arm', 'true assassin', 'zabaniya', 'hassan'],
  king_hassan: ['first hassan', 'grand assassin', 'old man of the mountain'],
  kama: ['goddess of love', 'mara', 'beast iii']
};

/**
 * Builds an intelligent RegExp suite from user input:
 * 1. Exact boundary matching
 * 2. Multi-token lookahead regex (order-independent)
 * 3. Permissive flexible delimiter regex (handles spaces, hyphens, underscores, parentheses)
 * 4. User-provided regex support (e.g., /art.*alt/i or gil.*)
 */
export function buildSearchRegex(rawQuery: string): {
  exactWordRegex?: RegExp;
  lookaheadRegex?: RegExp;
  flexibleRegex?: RegExp;
  customRegex?: RegExp;
  tokens: string[];
} {
  const q = normalizeText(rawQuery);
  if (!q) return { tokens: [] };

  // Check if user provided explicit regex like "/pattern/i" or has wildcard patterns
  let customRegex: RegExp | undefined;
  const explicitRegexMatch = rawQuery.match(/^\/(.+)\/([gimsuy]*)$/);
  if (explicitRegexMatch) {
    try {
      customRegex = new RegExp(explicitRegexMatch[1], explicitRegexMatch[2] || 'i');
    } catch {
      // Ignore invalid regex and fallback to standard compilation
    }
  }

  // Tokenize query words
  const tokens = q.split(/[\s_\-+/,():]+/).filter(Boolean);

  // 1. Exact word boundary regex: \b(word)\b
  const escapedTokens = tokens.map(escapeRegex);
  let exactWordRegex: RegExp | undefined;
  try {
    exactWordRegex = new RegExp(`\\b(${escapedTokens.join('|')})\\b`, 'i');
  } catch {}

  // 2. Lookahead multi-token regex: (?=.*token1)(?=.*token2)
  let lookaheadRegex: RegExp | undefined;
  if (tokens.length > 0) {
    try {
      const lookaheads = tokens.map(t => `(?=.*${escapeRegex(t)})`).join('');
      lookaheadRegex = new RegExp(`^${lookaheads}.*$`, 'i');
    } catch {}
  }

  // 3. Flexible separator regex (e.g. "saber alter" -> "saber[\s\W_]*alter")
  let flexibleRegex: RegExp | undefined;
  if (tokens.length > 1) {
    try {
      flexibleRegex = new RegExp(tokens.map(escapeRegex).join('[\\s\\W_]*'), 'i');
    } catch {}
  }

  return { exactWordRegex, lookaheadRegex, flexibleRegex, customRegex, tokens };
}

/**
 * Calculates a match score for a Servant given a search query.
 * Higher score = closer match. Returns 0 if no match.
 */
export function scoreServantMatch(s: ServantTemplate, rawQuery: string): number {
  if (!rawQuery || !rawQuery.trim()) return 100;

  const rawNorm = normalizeText(rawQuery);
  const idNorm = normalizeText(s.id);
  const nameNorm = normalizeText(s.name);
  const classNorm = normalizeText(s.servantClass);
  const titleNorm = normalizeText(s.title);
  const npNorm = normalizeText(s.noblePhantasm?.name);
  const loreNorm = normalizeText(s.lore || '');

  // 1. Highest priority: Exact ID or Name match
  if (idNorm === rawNorm || nameNorm === rawNorm) return 1000;
  if (idNorm.replace(/_/g, ' ') === rawNorm) return 950;

  // 2. Custom User RegExp check
  const { exactWordRegex, lookaheadRegex, flexibleRegex, customRegex, tokens } = buildSearchRegex(rawQuery);
  const fullSearchableText = `${idNorm} ${nameNorm} ${classNorm} ${titleNorm} ${npNorm} ${loreNorm}`;

  if (customRegex) {
    if (customRegex.test(nameNorm) || customRegex.test(idNorm)) return 900;
    if (customRegex.test(fullSearchableText)) return 700;
  }

  // 3. Known Aliases Check (e.g. "salter" -> Artoria Alter, "umu" -> Nero, "gil" -> Gilgamesh)
  for (const [key, aliases] of Object.entries(ALIAS_MAP)) {
    if (idNorm === key || idNorm.includes(key)) {
      if (aliases.some(a => a === rawNorm || rawNorm.includes(a) || a.includes(rawNorm))) {
        return 850;
      }
    }
  }

  // 4. Flexible Regex Match (e.g. "saber alter" matches "Saber (Alter)" or "saber_alter")
  if (flexibleRegex && (flexibleRegex.test(nameNorm) || flexibleRegex.test(idNorm))) {
    return 800;
  }

  // 5. Name or ID Prefix / Substring match
  if (nameNorm.startsWith(rawNorm) || idNorm.startsWith(rawNorm)) return 750;
  if (nameNorm.includes(rawNorm) || idNorm.includes(rawNorm)) return 700;

  // 6. Lookahead multi-token regex match across name + class + title + NP
  const coreFieldsText = `${nameNorm} ${classNorm} ${titleNorm} ${npNorm}`;
  if (lookaheadRegex && lookaheadRegex.test(coreFieldsText)) {
    return 600;
  }

  // 7. Lookahead regex match across all text including lore
  if (lookaheadRegex && lookaheadRegex.test(fullSearchableText)) {
    return 400;
  }

  // 8. Individual token matches with exact word regex
  if (exactWordRegex && exactWordRegex.test(coreFieldsText)) {
    return 300;
  }

  // 9. Substring match on tokens
  const matchCount = tokens.filter(t => fullSearchableText.includes(t)).length;
  if (matchCount > 0) {
    return (matchCount / (tokens.length || 1)) * 200;
  }

  return 0;
}

/**
 * Intelligent regex-powered matcher for Heroic Spirits.
 */
export function matchServantSearch(s: ServantTemplate, rawQuery: string): boolean {
  return scoreServantMatch(s, rawQuery) > 0;
}

/**
 * Searches a pool of Servants using Regex scoring and rank-ordering.
 */
export function findServantInPool(queryOrId: string, pool: ServantTemplate[]): ServantTemplate | undefined {
  if (!queryOrId || !queryOrId.trim() || !pool || pool.length === 0) return undefined;
  
  const ranked = searchAndRankServants(queryOrId, pool);
  return ranked.length > 0 ? ranked[0] : undefined;
}

/**
 * Filters and sorts a Servant pool by relevance score using Regex and semantic matching.
 */
export function searchAndRankServants(query: string, pool: ServantTemplate[]): ServantTemplate[] {
  if (!query || !query.trim() || !pool) return pool || [];

  return pool
    .map(s => ({ servant: s, score: scoreServantMatch(s, query) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.servant);
}

