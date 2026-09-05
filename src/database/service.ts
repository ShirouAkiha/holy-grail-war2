import { MasterProfile, MasterServantInstance, CraftEssence, ServantTemplate, GachaBanner } from '../types';
import { SERVANT_DATABASE } from '../data/servants';
import { CRAFT_ESSENCE_DATABASE, CE_GACHA_BANNERS } from '../data/craftEssences';
import { normalizeMediaUrl } from '../utils/mediaResolver';
import fs from 'fs';
import path from 'path';

// ==========================================
// 1. DISK PERSISTENCE ENGINE & DATA STORES
// ==========================================
const DATA_DIR = path.join(process.cwd(), 'data');
const CUSTOM_SERVANTS_FILE = path.join(DATA_DIR, 'custom_servants.json');
const MASTERS_FILE = path.join(DATA_DIR, 'masters.json');
const CUSTOM_CES_FILE = path.join(DATA_DIR, 'custom_ces.json');
const GACHA_BANNER_FILE = path.join(DATA_DIR, 'gacha_banner.json');
const NP_ANIMS_FILE = path.join(DATA_DIR, 'servant_np_anims.json');
const DUEL_SETTINGS_FILE = path.join(DATA_DIR, 'duel_settings.json');

// Interface for custom Noble Phantasm animation configurations
export interface ServantNpAnimConfig {
  servantId: string;
  servantName: string;
  gifUrl: string;
  chant?: string;
  updatedAt: number;
  customBy?: string;
}

export interface DuelNpSettings {
  autoDelete: boolean;
  afkTimeoutSeconds: number;
}

// Maps Discord User IDs (e.g. "123456789012345678") to their respective MasterProfile records.
const masterStore: Map<string, MasterProfile> = new Map();

// Store for custom Heroic Spirits registered by Server Admins
let customServants: ServantTemplate[] = [];

// Store for custom Craft Essences added by Server Admins
let customCraftEssences: CraftEssence[] = [];

// Store for current customizable Gacha Banner
let currentGachaBanner: GachaBanner = { ...CE_GACHA_BANNERS[0] };

// Store for custom Servant Noble Phantasm animations (mapped by servant ID and lowercase name)
const customNpAnims: Map<string, ServantNpAnimConfig> = new Map();

// Duel Noble Phantasm settings (stay active until next turn, with 60s AFK timeout default)
let duelNpSettings: DuelNpSettings = {
  autoDelete: true,
  afkTimeoutSeconds: 60
};

// Track all edited servant templates (both canon overrides and custom servants)
const savedServantsMap: Map<string, ServantTemplate> = new Map();

function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Loads saved servants, custom CEs, gacha banner settings, and master profiles from disk on startup.
 */
function loadFromDisk() {
  try {
    ensureDataDirectory();

    // 1. Load Custom & Edited Servants
    if (fs.existsSync(CUSTOM_SERVANTS_FILE)) {
      const raw = fs.readFileSync(CUSTOM_SERVANTS_FILE, 'utf-8');
      if (raw) {
        const savedServants: ServantTemplate[] = JSON.parse(raw);
        for (const s of savedServants) {
          const canonIdx = SERVANT_DATABASE.findIndex(c => c.id === s.id);
          if (canonIdx >= 0) {
            // If it's a canon servant, preserve the canonical balanced baseHp, baseAtk, and baseStats
            const canon = SERVANT_DATABASE[canonIdx];
            const updated = {
              ...canon,
              ...s,
              baseHp: Math.max(canon.baseHp, s.baseHp || 0),
              baseAtk: Math.max(canon.baseAtk, s.baseAtk || 0),
              baseStats: { ...canon.baseStats, ...(s.baseStats || {}) }
            };
            SERVANT_DATABASE[canonIdx] = updated;
            savedServantsMap.set(s.id, updated);
          } else {
            // Custom servant
            savedServantsMap.set(s.id, s);
            const customIdx = customServants.findIndex(c => c.id === s.id);
            if (customIdx >= 0) {
              customServants[customIdx] = s;
            } else {
              customServants.push(s);
            }
          }
        }
      }
    }

    // 2. Load Custom & Edited Craft Essences
    if (fs.existsSync(CUSTOM_CES_FILE)) {
      const raw = fs.readFileSync(CUSTOM_CES_FILE, 'utf-8');
      if (raw) {
        const savedCes: CraftEssence[] = JSON.parse(raw);
        if (Array.isArray(savedCes)) {
          customCraftEssences = savedCes;
          for (const ce of savedCes) {
            const canonIdx = CRAFT_ESSENCE_DATABASE.findIndex(c => c.id === ce.id);
            if (canonIdx >= 0) {
              CRAFT_ESSENCE_DATABASE[canonIdx] = { ...CRAFT_ESSENCE_DATABASE[canonIdx], ...ce };
            }
          }
        }
      }
    }

    // 3. Load Gacha Banner customization
    if (fs.existsSync(GACHA_BANNER_FILE)) {
      const raw = fs.readFileSync(GACHA_BANNER_FILE, 'utf-8');
      if (raw) {
        const savedBanner: GachaBanner = JSON.parse(raw);
        if (savedBanner && savedBanner.title) {
          currentGachaBanner = { ...CE_GACHA_BANNERS[0], ...savedBanner };
        }
      }
    }

    // 4. Load Custom Servant NP Animations
    if (fs.existsSync(NP_ANIMS_FILE)) {
      const raw = fs.readFileSync(NP_ANIMS_FILE, 'utf-8');
      if (raw) {
        const savedAnims: ServantNpAnimConfig[] = JSON.parse(raw);
        if (Array.isArray(savedAnims)) {
          for (const anim of savedAnims) {
            if (anim && anim.gifUrl) {
              customNpAnims.set(anim.servantId, anim);
              customNpAnims.set(anim.servantName.toLowerCase(), anim);

              // Apply to in-memory servants
              const canon = SERVANT_DATABASE.find(s => s.id === anim.servantId || s.name.toLowerCase() === anim.servantName.toLowerCase());
              if (canon && canon.noblePhantasm) {
                canon.noblePhantasm.animationUrl = anim.gifUrl;
                canon.noblePhantasm.gifUrl = anim.gifUrl;
                if (anim.chant) canon.noblePhantasm.chant = anim.chant;
              }
              const custom = customServants.find(s => s.id === anim.servantId || s.name.toLowerCase() === anim.servantName.toLowerCase());
              if (custom && custom.noblePhantasm) {
                custom.noblePhantasm.animationUrl = anim.gifUrl;
                custom.noblePhantasm.gifUrl = anim.gifUrl;
                if (anim.chant) custom.noblePhantasm.chant = anim.chant;
              }
            }
          }
        }
      }
    }

    // 5. Load Duel NP Settings
    if (fs.existsSync(DUEL_SETTINGS_FILE)) {
      const raw = fs.readFileSync(DUEL_SETTINGS_FILE, 'utf-8');
      if (raw) {
        const savedSettings = JSON.parse(raw);
        if (savedSettings) {
          duelNpSettings = {
            autoDelete: savedSettings.autoDelete !== false,
            afkTimeoutSeconds: Math.max(15, Number(savedSettings.afkTimeoutSeconds) || 60)
          };
        }
      }
    }

    // 2. Load Master Profiles
    if (fs.existsSync(MASTERS_FILE)) {
      const raw = fs.readFileSync(MASTERS_FILE, 'utf-8');
      if (raw) {
        const savedMasters: MasterProfile[] = JSON.parse(raw);
        for (const m of savedMasters) {
          // Remove Kaleidoscope from all existing masters' inventories (balance reset)
          if (m.craftEssences && Array.isArray(m.craftEssences)) {
            m.craftEssences = m.craftEssences
              .filter(ce => ce && ce.id !== 'ce_kaleidoscope')
              .map(ce => {
                const canonCe = CRAFT_ESSENCE_DATABASE.find(c => c.id === ce.id);
                return canonCe ? { ...canonCe } : ce;
              });
          } else {
            m.craftEssences = [];
          }

          // Synchronize master servant instances with canonical stats & strip equipped Kaleidoscope
          if (m.servants && Array.isArray(m.servants)) {
            for (const inst of m.servants) {
              // Unequip Kaleidoscope if equipped
              if (inst.equippedCeId === 'ce_kaleidoscope' || inst.equippedCe?.id === 'ce_kaleidoscope') {
                inst.equippedCeId = undefined;
                inst.equippedCe = undefined;
              } else if (inst.equippedCeId) {
                const canonCe = CRAFT_ESSENCE_DATABASE.find(c => c.id === inst.equippedCeId);
                if (canonCe) {
                  inst.equippedCe = { ...canonCe };
                }
              }

              const templateId = inst.templateId || inst.template?.id || inst.id;
              const instAny = inst as any;
              const canonical = SERVANT_DATABASE.find(
                s => s.id === templateId || 
                     (s.name && instAny.name && s.name.toLowerCase() === instAny.name.toLowerCase()) ||
                     (s.name && instAny.nickname && s.name.toLowerCase() === instAny.nickname.toLowerCase()) ||
                     (s.name && inst.template?.name && s.name.toLowerCase() === inst.template.name.toLowerCase())
              );
              if (canonical) {
                const customSaved = savedServantsMap.get(canonical.id);
                const preservedAvatar = inst.template?.avatarUrl || customSaved?.avatarUrl || canonical.avatarUrl;
                const preservedCardArt = inst.template?.cardArtUrl || customSaved?.cardArtUrl || canonical.cardArtUrl;
                inst.template = {
                  ...canonical,
                  ...(customSaved || {}),
                  ...(inst.template || {}),
                  avatarUrl: preservedAvatar,
                  cardArtUrl: preservedCardArt,
                  baseHp: customSaved?.baseHp || canonical.baseHp,
                  baseAtk: customSaved?.baseAtk || canonical.baseAtk,
                  baseStats: customSaved?.baseStats || canonical.baseStats,
                  noblePhantasm: customSaved?.noblePhantasm || canonical.noblePhantasm,
                  skills: customSaved?.skills || canonical.skills
                };
              }
            }
          }
          masterStore.set(m.discordId, m);
        }
        // Save upgraded master profiles to disk to clean up any old cached stats
        saveMastersToDisk();
      }
    }
  } catch (err) {
    console.error('[Database] Failed to load persistent data from disk:', err);
  }
}

// Immediately load disk state when module initializes
loadFromDisk();

function saveCustomServantsToDisk() {
  try {
    ensureDataDirectory();
    const listToSave = Array.from(savedServantsMap.values());
    // Ensure any customServants not in map are included
    for (const cs of customServants) {
      if (!savedServantsMap.has(cs.id)) {
        listToSave.push(cs);
      }
    }
    fs.writeFileSync(CUSTOM_SERVANTS_FILE, JSON.stringify(listToSave, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Database] Failed to write custom_servants.json to disk:', err);
  }
}

function saveCustomCesToDisk() {
  try {
    ensureDataDirectory();
    fs.writeFileSync(CUSTOM_CES_FILE, JSON.stringify(customCraftEssences, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Database] Failed to write custom_ces.json to disk:', err);
  }
}

function saveGachaBannerToDisk() {
  try {
    ensureDataDirectory();
    fs.writeFileSync(GACHA_BANNER_FILE, JSON.stringify(currentGachaBanner, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Database] Failed to write gacha_banner.json to disk:', err);
  }
}

function saveNpAnimsToDisk() {
  try {
    ensureDataDirectory();
    // Unique by servantId
    const unique = new Map<string, ServantNpAnimConfig>();
    for (const anim of customNpAnims.values()) {
      unique.set(anim.servantId, anim);
    }
    fs.writeFileSync(NP_ANIMS_FILE, JSON.stringify(Array.from(unique.values()), null, 2), 'utf-8');
  } catch (err) {
    console.error('[Database] Failed to write servant_np_anims.json to disk:', err);
  }
}

function saveDuelSettingsToDisk() {
  try {
    ensureDataDirectory();
    fs.writeFileSync(DUEL_SETTINGS_FILE, JSON.stringify(duelNpSettings, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Database] Failed to write duel_settings.json to disk:', err);
  }
}

/**
 * Returns all Craft Essences (built-in + admin custom).
 */
export function getAllCraftEssences(): CraftEssence[] {
  return [...CRAFT_ESSENCE_DATABASE, ...customCraftEssences];
}

/**
 * Adds a new custom Craft Essence to the database.
 */
export function addCustomCraftEssence(ce: CraftEssence): CraftEssence {
  const existingIdx = customCraftEssences.findIndex(c => c.id === ce.id);
  if (existingIdx >= 0) {
    customCraftEssences[existingIdx] = ce;
  } else {
    customCraftEssences.push(ce);
  }
  saveCustomCesToDisk();
  return ce;
}

/**
 * Updates any existing Craft Essence (canonical or custom) by ID or Name.
 */
export function updateCraftEssence(targetIdOrName: string, updates: Partial<CraftEssence>): CraftEssence | null {
  const query = targetIdOrName.trim().toLowerCase();
  const all = getAllCraftEssences();
  const found = all.find(c => c.id.toLowerCase() === query || c.name.toLowerCase() === query || c.name.toLowerCase().includes(query));
  
  if (!found) return null;

  const updated: CraftEssence = {
    ...found,
    ...updates,
    id: found.id // preserve original ID
  };

  // If custom CE, update in customCraftEssences array
  const customIdx = customCraftEssences.findIndex(c => c.id === found.id);
  if (customIdx >= 0) {
    customCraftEssences[customIdx] = updated;
    saveCustomCesToDisk();
  } else {
    // If canonical CE, update in CRAFT_ESSENCE_DATABASE
    const canonIdx = CRAFT_ESSENCE_DATABASE.findIndex(c => c.id === found.id);
    if (canonIdx >= 0) {
      CRAFT_ESSENCE_DATABASE[canonIdx] = updated;
    }
    // Save to customCraftEssences list to persist override across restarts
    const customMatchIdx = customCraftEssences.findIndex(c => c.id === found.id);
    if (customMatchIdx >= 0) {
      customCraftEssences[customMatchIdx] = updated;
    } else {
      customCraftEssences.push(updated);
    }
    saveCustomCesToDisk();
  }

  return updated;
}

/**
 * Returns the currently active Gacha Banner.
 */
export function getActiveGachaBanner(): GachaBanner {
  return currentGachaBanner;
}

/**
 * Updates the active Gacha Banner parameters (title, image, rate-ups, description).
 */
export function updateGachaBanner(updates: Partial<GachaBanner>): GachaBanner {
  currentGachaBanner = {
    ...currentGachaBanner,
    ...updates
  };
  saveGachaBannerToDisk();
  return currentGachaBanner;
}

function saveMastersToDisk() {
  try {
    ensureDataDirectory();
    const mastersList = Array.from(masterStore.values());
    fs.writeFileSync(MASTERS_FILE, JSON.stringify(mastersList, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Database] Failed to write masters.json to disk:', err);
  }
}

/**
 * Returns the entire Throne of Heroes database (Built-in + Admin Custom Servants).
 */
export function getAllThroneServants(): ServantTemplate[] {
  return [...SERVANT_DATABASE, ...customServants];
}

/**
 * Escapes regex special characters safely
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalizes diacritics and accents
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
  karna_lancer: ['hero of charity', 'son of the sun god', 'karna', 'karna lancer', 'lancer of red', 'vasavi shakti'],
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

  let customRegex: RegExp | undefined;
  const explicitRegexMatch = rawQuery.match(/^\/(.+)\/([gimsuy]*)$/);
  if (explicitRegexMatch) {
    try {
      customRegex = new RegExp(explicitRegexMatch[1], explicitRegexMatch[2] || 'i');
    } catch {}
  }

  const tokens = q.split(/[\s_\-+/,():]+/).filter(Boolean);
  const escapedTokens = tokens.map(escapeRegex);
  
  let exactWordRegex: RegExp | undefined;
  try {
    exactWordRegex = new RegExp(`\\b(${escapedTokens.join('|')})\\b`, 'i');
  } catch {}

  let lookaheadRegex: RegExp | undefined;
  if (tokens.length > 0) {
    try {
      const lookaheads = tokens.map(t => `(?=.*${escapeRegex(t)})`).join('');
      lookaheadRegex = new RegExp(`^${lookaheads}.*$`, 'i');
    } catch {}
  }

  let flexibleRegex: RegExp | undefined;
  if (tokens.length > 1) {
    try {
      flexibleRegex = new RegExp(tokens.map(escapeRegex).join('[\\s\\W_]*'), 'i');
    } catch {}
  }

  return { exactWordRegex, lookaheadRegex, flexibleRegex, customRegex, tokens };
}

/**
 * Calculates regex match score for a Servant.
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

  // 3. Known Aliases Check
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
 * Filters and sorts a Servant pool by relevance score using Regex and semantic matching.
 */
export function searchAndRankServants(query: string, pool?: ServantTemplate[]): ServantTemplate[] {
  const list = pool || getAllThroneServants();
  if (!query || !query.trim()) return list;

  return list
    .map(s => ({ servant: s, score: scoreServantMatch(s, query) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.servant);
}

/**
 * Searches the Throne of Heroes pool for a Servant by exact ID, exact Name, multi-token, or alias.
 */
export function findServantInPool(queryOrId: string, pool?: ServantTemplate[]): ServantTemplate | undefined {
  const list = pool || getAllThroneServants();
  if (!queryOrId || !queryOrId.trim()) return undefined;
  
  const ranked = searchAndRankServants(queryOrId, list);
  return ranked.length > 0 ? ranked[0] : undefined;
}

/**
 * Adds a new custom Heroic Spirit to the Throne of Heroes database.
 */
export function addCustomServant(servant: ServantTemplate): ServantTemplate {
  // Prevent duplicate IDs
  const existingIdx = customServants.findIndex(s => s.id === servant.id);
  if (existingIdx >= 0) {
    customServants[existingIdx] = servant;
  } else {
    customServants.push(servant);
  }
  savedServantsMap.set(servant.id, servant);
  saveCustomServantsToDisk();
  return servant;
}

/**
 * Updates an existing Servant template (both Canon and Custom servants).
 */
export function updateServantTemplate(
  queryOrId: string,
  updates: {
    name?: string;
    title?: string;
    servantClass?: any;
    avatarUrl?: string;
    cardArtUrl?: string;
    baseHp?: number;
    baseAtk?: number;
    noblePhantasmName?: string;
    noblePhantasmChant?: string;
    noblePhantasmCardType?: 'Buster' | 'Arts' | 'Quick';
    noblePhantasmTarget?: 'single' | 'aoe' | 'support';
    noblePhantasmMultiplier?: number;
    noblePhantasmAnimationUrl?: string;
    noblePhantasmGifUrl?: string;
    summonQuote?: string;
    lore?: string;
  }
): { success: boolean; servant?: ServantTemplate; error?: string } {
  const allServants = getAllThroneServants();
  const target = findServantInPool(queryOrId, allServants);

  if (!target) {
    const suggestions = allServants
      .filter(s => matchServantSearch(s, queryOrId))
      .slice(0, 3)
      .map(s => `"${s.name}" (${s.servantClass})`);

    const suggestionText = suggestions.length > 0 ? ` Did you mean: ${suggestions.join(', ')}?` : '';
    return { 
      success: false, 
      error: `Servant matching "${queryOrId}" not found in Throne of Heroes.${suggestionText}` 
    };
  }

  // Apply updates
  if (updates.name) target.name = updates.name.trim();
  if (updates.title) target.title = updates.title.trim();
  if (updates.servantClass) target.servantClass = updates.servantClass;
  if (updates.avatarUrl) {
    const newImg = updates.avatarUrl.trim();
    target.avatarUrl = newImg;
    if (!updates.cardArtUrl || updates.cardArtUrl === updates.avatarUrl) {
      target.cardArtUrl = newImg;
    }
  }
  if (updates.cardArtUrl) target.cardArtUrl = updates.cardArtUrl.trim();
  if (updates.baseHp) target.baseHp = Number(updates.baseHp);
  if (updates.baseAtk) target.baseAtk = Number(updates.baseAtk);
  if (updates.summonQuote) target.summonQuote = updates.summonQuote.trim();
  if (updates.lore) target.lore = updates.lore.trim();

  if (updates.noblePhantasmName) {
    target.noblePhantasm.name = updates.noblePhantasmName.trim();
  }
  if (updates.noblePhantasmChant) {
    target.noblePhantasm.chant = updates.noblePhantasmChant.trim();
  }
  if (updates.noblePhantasmCardType) {
    target.noblePhantasm.cardType = updates.noblePhantasmCardType;
  }
  if (updates.noblePhantasmTarget) {
    target.noblePhantasm.target = updates.noblePhantasmTarget;
  }
  const animUrl = (updates.noblePhantasmAnimationUrl || updates.noblePhantasmGifUrl || '').trim();
  if (animUrl) {
    target.noblePhantasm.animationUrl = animUrl;
    target.noblePhantasm.gifUrl = animUrl;
    customNpAnims.set(target.id, {
      servantId: target.id,
      servantName: target.name,
      gifUrl: animUrl,
      chant: target.noblePhantasm.chant,
      updatedAt: Date.now()
    });
    customNpAnims.set(target.name.toLowerCase(), {
      servantId: target.id,
      servantName: target.name,
      gifUrl: animUrl,
      chant: target.noblePhantasm.chant,
      updatedAt: Date.now()
    });
    saveNpAnimsToDisk();
  }
  if (updates.noblePhantasmMultiplier !== undefined) {
    target.noblePhantasm.multiplier = updates.noblePhantasmMultiplier;
  } else if (updates.noblePhantasmTarget || updates.noblePhantasmCardType) {
    const card = target.noblePhantasm.cardType || 'Buster';
    const scope = target.noblePhantasm.target || 'single';
    if (scope === 'support') {
      target.noblePhantasm.multiplier = 0;
    } else if (scope === 'single') {
      target.noblePhantasm.multiplier = card === 'Quick' ? 1200 : card === 'Arts' ? 900 : 600;
    } else {
      target.noblePhantasm.multiplier = card === 'Quick' ? 600 : card === 'Arts' ? 450 : 400;
    }
  }

  // Persist in customServants array if custom, or update in SERVANT_DATABASE
  const customIdx = customServants.findIndex(s => s.id === target!.id);
  if (customIdx >= 0) {
    customServants[customIdx] = { ...target };
  } else if (target.isCustomOrMeme) {
    customServants.push({ ...target });
  } else {
    // If it's a canon servant, update the in-memory SERVANT_DATABASE entry
    const canonIdx = SERVANT_DATABASE.findIndex(s => s.id === target!.id);
    if (canonIdx >= 0) {
      SERVANT_DATABASE[canonIdx] = { ...target };
    }
  }

  // Save servant edit to disk map & file
  savedServantsMap.set(target.id, { ...target });
  saveCustomServantsToDisk();

  // Propagate updates to all active Master servant instances in memory
  for (const master of masterStore.values()) {
    if (master.servants) {
      for (const inst of master.servants) {
        if (inst.templateId === target.id || inst.template?.id === target.id) {
          inst.template = { ...target };
          if (inst.customQuotes) {
            if (updates.summonQuote) inst.customQuotes.summon = updates.summonQuote;
            if (updates.noblePhantasmChant) inst.customQuotes.noblePhantasm = updates.noblePhantasmChant;
          }
        }
      }
    }
  }

  saveMastersToDisk();

  return { success: true, servant: target };
}

/**
 * Directly configures/overrides the Noble Phantasm animated GIF for any Servant.
 */
export function setServantNpAnimation(
  queryOrId: string,
  gifUrl: string,
  customChant?: string,
  adminUsername?: string
): { success: boolean; servant?: ServantTemplate; message?: string; error?: string } {
  const cleanUrl = normalizeMediaUrl((gifUrl || '').trim());
  if (!cleanUrl) {
    return { success: false, error: 'Animated GIF URL cannot be empty.' };
  }

  const allServants = getAllThroneServants();
  const target = findServantInPool(queryOrId, allServants);

  if (!target) {
    return {
      success: false,
      error: `Could not find any Servant in the Throne of Heroes matching "${queryOrId}".`
    };
  }

  // Update target Noble Phantasm
  if (!target.noblePhantasm) {
    target.noblePhantasm = {
      name: 'Noble Phantasm',
      cardType: 'Buster',
      chant: customChant || 'True Name Unleashed!',
      description: 'Ultimate attack',
      target: 'single',
      multiplier: 600,
      overchargeEffect: 'Deals massive damage'
    };
  }

  target.noblePhantasm.animationUrl = cleanUrl;
  target.noblePhantasm.gifUrl = cleanUrl;
  if (customChant && customChant.trim()) {
    target.noblePhantasm.chant = customChant.trim();
  }

  // Store in config map
  const config: ServantNpAnimConfig = {
    servantId: target.id,
    servantName: target.name,
    gifUrl: cleanUrl,
    chant: target.noblePhantasm.chant,
    updatedAt: Date.now(),
    customBy: adminUsername || 'Admin'
  };

  customNpAnims.set(target.id, config);
  customNpAnims.set(target.name.toLowerCase(), config);
  saveNpAnimsToDisk();

  // Save to servant repository
  savedServantsMap.set(target.id, { ...target });
  const customIdx = customServants.findIndex(s => s.id === target.id);
  if (customIdx >= 0) {
    customServants[customIdx] = { ...target };
  } else {
    const canonIdx = SERVANT_DATABASE.findIndex(s => s.id === target.id);
    if (canonIdx >= 0) {
      SERVANT_DATABASE[canonIdx] = { ...target };
    }
  }
  saveCustomServantsToDisk();

  // Propagate to all active master servants
  for (const master of masterStore.values()) {
    if (master.servants) {
      for (const inst of master.servants) {
        if (inst.templateId === target.id || inst.template?.id === target.id) {
          inst.template = { ...target };
          if (customChant && inst.customQuotes) {
            inst.customQuotes.noblePhantasm = customChant.trim();
          }
        }
      }
    }
  }
  saveMastersToDisk();

  return {
    success: true,
    servant: target,
    message: `Successfully set Noble Phantasm animation for **${target.name}** (${target.servantClass})!`
  };
}

/**
 * Returns custom Noble Phantasm animation configuration for a Servant if registered.
 */
export function getServantNpAnimation(queryOrId: string): ServantNpAnimConfig | undefined {
  if (!queryOrId) return undefined;
  return customNpAnims.get(queryOrId) || customNpAnims.get(queryOrId.trim().toLowerCase());
}

/**
 * Returns all custom registered Noble Phantasm animations.
 */
export function getAllCustomNpAnimations(): ServantNpAnimConfig[] {
  const unique = new Map<string, ServantNpAnimConfig>();
  for (const item of customNpAnims.values()) {
    unique.set(item.servantId, item);
  }
  return Array.from(unique.values());
}

/**
 * Returns the current Duel Noble Phantasm display & auto-delete settings.
 */
export function getDuelNpSettings(): DuelNpSettings {
  return { ...duelNpSettings };
}

/**
 * Updates the Duel Noble Phantasm display & auto-delete settings.
 */
export function setDuelNpSettings(settings: Partial<DuelNpSettings>): DuelNpSettings {
  if (settings.autoDelete !== undefined) {
    duelNpSettings.autoDelete = Boolean(settings.autoDelete);
  }
  if (settings.afkTimeoutSeconds !== undefined && !isNaN(settings.afkTimeoutSeconds)) {
    duelNpSettings.afkTimeoutSeconds = Math.max(15, Number(settings.afkTimeoutSeconds));
  }
  saveDuelSettingsToDisk();
  return { ...duelNpSettings };
}

/**
 * Removes a custom Servant from the database by ID or Name, or clears all if ID is 'all' or '*'.
 */
export function removeCustomServant(servantId: string): boolean {
  const query = servantId.trim().toLowerCase();
  
  if (query === 'all' || query === '*') {
    const prevCount = customServants.length;
    customServants = [];
    savedServantsMap.clear();
    saveCustomServantsToDisk();
    return prevCount > 0;
  }

  const initialLen = customServants.length;
  // Match by exact ID, case-insensitive ID, or case-insensitive Name
  const target = customServants.find(
    s => s.id.toLowerCase() === query || 
         s.name.toLowerCase() === query ||
         s.id.toLowerCase().includes(query) ||
         s.name.toLowerCase().includes(query)
  );

  if (!target) return false;

  customServants = customServants.filter(s => s.id !== target.id);
  savedServantsMap.delete(target.id);
  saveCustomServantsToDisk();
  return customServants.length < initialLen;
}

/**
 * Clears all custom servants from the Throne of Heroes.
 */
export function clearAllCustomServants(): number {
  const count = customServants.length;
  customServants = [];
  savedServantsMap.clear();
  saveCustomServantsToDisk();
  return count;
}

/**
 * Returns all custom servants registered by admins.
 */
export function getCustomServants(): ServantTemplate[] {
  return [...customServants];
}

/**
 * Returns a set of template IDs of all currently contracted Servants across all active Masters.
 * In the Holy Grail War, each Heroic Spirit can only be contracted to one Master at a time.
 */
export function getContractedServantTemplateIds(): Set<string> {
  const contracted = new Set<string>();
  for (const master of masterStore.values()) {
    if (master.servants && master.servants.length > 0) {
      for (const s of master.servants) {
        contracted.add(s.templateId);
      }
    }
  }
  return contracted;
}

/**
 * Returns all available unclaimed Heroic Spirits in the Throne of Heroes.
 */
export function getAvailableThroneServants(): ServantTemplate[] {
  const contractedIds = getContractedServantTemplateIds();
  const allServants = getAllThroneServants();
  return allServants.filter(s => !contractedIds.has(s.id));
}

/**
 * Creates or retrieves a Master record by Discord ID.
 * When a user first enters the Holy Grail War, they are granted:
 * - 3 Command Seals (sacred marks of Master authority)
 * - 100 Action Points (AP) for tactical war moves
 * - No pre-assigned Servant (must perform the Summoning Ritual)
 */
export async function getOrCreateMaster(discordId: string, username: string = 'Master'): Promise<MasterProfile> {
  let master = masterStore.get(discordId);

  if (!master) {
    master = {
      id: `master_${discordId}`,
      discordId,
      username,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
      saintQuartz: 0,
      summonTickets: 0,
      commandSeals: 3,
      autoConsumeCommandSeal: false,
      actionPoints: 100,
      maxActionPoints: 100,
      pityCount: 0,
      grailWarWins: 0,
      lastDailyClaim: undefined,
      activeServantId: undefined,
      servants: [],
      craftEssences: []
    };
    masterStore.set(discordId, master);
    saveMastersToDisk();
  } else {
    // Keep username synchronized in case the user changed their Discord display name
    if (username && master.username !== username) {
      master.username = username;
      saveMastersToDisk();
    }
  }

  return master;
}

/**
 * Updates selective properties on a Master's profile.
 */
export async function updateMasterProfile(discordId: string, data: Partial<MasterProfile>): Promise<MasterProfile> {
  const master = await getOrCreateMaster(discordId);
  
  if (data.username !== undefined) master.username = data.username;
  if (data.saintQuartz !== undefined) master.saintQuartz = data.saintQuartz;
  if (data.summonTickets !== undefined) master.summonTickets = data.summonTickets;
  if (data.actionPoints !== undefined) master.actionPoints = data.actionPoints;
  if (data.commandSeals !== undefined) master.commandSeals = data.commandSeals;
  if (data.grailWarWins !== undefined) master.grailWarWins = data.grailWarWins;
  if (data.lastDailyClaim !== undefined) master.lastDailyClaim = data.lastDailyClaim;
  if (data.activeServantId !== undefined) master.activeServantId = data.activeServantId;
  if (data.servants !== undefined) master.servants = data.servants;
  if (data.craftEssences !== undefined) master.craftEssences = data.craftEssences;

  masterStore.set(discordId, master);
  saveMastersToDisk();
  return master;
}

/**
 * Grants Saint Quartz and/or Summon Tickets to a user by Discord ID.
 */
export async function addSaintQuartzToUser(
  discordId: string,
  saintQuartzAmount: number,
  ticketsAmount: number = 0,
  username?: string
): Promise<{ master: MasterProfile; previousSq: number; newSq: number; previousTickets: number; newTickets: number }> {
  const master = await getOrCreateMaster(discordId, username);
  const previousSq = master.saintQuartz || 0;
  const previousTickets = master.summonTickets || 0;

  master.saintQuartz = Math.max(0, previousSq + saintQuartzAmount);
  master.summonTickets = Math.max(0, previousTickets + ticketsAmount);

  saveMastersToDisk();
  return {
    master,
    previousSq,
    newSq: master.saintQuartz,
    previousTickets,
    newTickets: master.summonTickets
  };
}

/**
 * Daily Login / Leyline Harvest Claim Function
 * Grants 30 Saint Quartz once every 24 hours (86,400,000 ms).
 */
export async function claimDailySaintQuartz(
  discordId: string,
  username?: string
): Promise<{
  success: boolean;
  saintQuartzClaimed: number;
  newTotalSq: number;
  previousSq: number;
  message: string;
  cooldownRemainingMs?: number;
  formattedCooldown?: string;
  nextClaimTimestamp?: number;
  master: MasterProfile;
}> {
  const master = await getOrCreateMaster(discordId, username);
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const lastClaim = typeof master.lastDailyClaim === 'number'
    ? master.lastDailyClaim
    : typeof master.lastDailyClaim === 'string'
      ? new Date(master.lastDailyClaim).getTime()
      : 0;

  const timeSinceLastClaim = now - lastClaim;

  if (lastClaim > 0 && timeSinceLastClaim < ONE_DAY_MS) {
    const remainingMs = ONE_DAY_MS - timeSinceLastClaim;
    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
    const formattedCooldown = `${hours}h ${minutes}m ${seconds}s`;
    const nextClaimTimestamp = now + remainingMs;

    return {
      success: false,
      saintQuartzClaimed: 0,
      previousSq: master.saintQuartz || 0,
      newTotalSq: master.saintQuartz || 0,
      message: `You have already claimed your daily Saint Quartz for today! Return in **${formattedCooldown}** (<t:${Math.floor(nextClaimTimestamp / 1000)}:R>).`,
      cooldownRemainingMs: remainingMs,
      formattedCooldown,
      nextClaimTimestamp,
      master
    };
  }

  const previousSq = master.saintQuartz || 0;
  const saintQuartzClaimed = 30;
  master.saintQuartz = previousSq + saintQuartzClaimed;
  master.lastDailyClaim = now;
  await saveMaster(master);

  return {
    success: true,
    saintQuartzClaimed,
    previousSq,
    newTotalSq: master.saintQuartz,
    message: `Successfully harvested **30 Saint Quartz** (💎) from the Fuyuki Leyline Sanctuary!`,
    master
  };
}

/**
 * Saves a complete modified master profile back to the persistent store.
 */
export async function saveMaster(master: MasterProfile): Promise<MasterProfile> {
  masterStore.set(master.discordId, master);
  saveMastersToDisk();
  return master;
}

/**
 * Gets all registered masters across the server.
 */
export async function getAllMasters(): Promise<MasterProfile[]> {
  return Array.from(masterStore.values());
}

/**
 * Looks up a Servant instance by ID across all registered Masters.
 */
export async function getServantById(servantId: string): Promise<MasterServantInstance | null> {
  for (const master of masterStore.values()) {
    const s = master.servants.find(srv => srv.id === servantId || srv.templateId === servantId);
    if (s) return s;
  }
  return null;
}

// Fallback compatibility proxy if standard ORM methods are invoked
export const prisma: any = new Proxy({}, {
  get: () => ({
    findMany: async () => Array.from(masterStore.values()),
    findFirst: async () => null,
    findUnique: async ({ where }: any) => {
      if (where?.discordId) return masterStore.get(where.discordId) || null;
      return null;
    },
    create: async ({ data }: any) => {
      if (data?.discordId) {
        return getOrCreateMaster(data.discordId, data.username);
      }
      return data;
    },
    update: async ({ where, data }: any) => {
      if (where?.discordId) {
        return updateMasterProfile(where.discordId, data);
      }
      return data;
    },
    delete: async () => ({})
  })
});
