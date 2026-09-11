import { MasterProfile, MasterServantInstance, CraftEssence, ServantTemplate, GachaBanner } from '../types';
import { SERVANT_DATABASE, getServantAvatarAndCardArt } from '../data/servants';
import { CRAFT_ESSENCE_DATABASE, CE_GACHA_BANNERS } from '../data/craftEssences';
import { normalizeMediaUrl } from '../utils/mediaResolver';
import { downloadMediaToLocal } from '../utils/localMedia';
import fs from 'fs';
import path from 'path';

// ==========================================
// 1. DISK PERSISTENCE ENGINE & DATA STORES
// ==========================================
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
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
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

/**
 * Safely and atomically writes data to disk using a temporary file.
 * Also keeps a rolling backup so that accidental git pull overrides or corrupted files can be restored.
 */
function writeJsonAtomic(filePath: string, data: any, backupPrefix?: string): void {
  try {
    ensureDataDirectory();
    const serialized = JSON.stringify(data, null, 2);

    // If writing non-empty data, maintain an automatic backup in data/backups/
    if (backupPrefix && Array.isArray(data) ? data.length > 0 : Boolean(data)) {
      const backupPath = path.join(BACKUPS_DIR, `${backupPrefix}.latest.json`);
      fs.writeFileSync(backupPath, serialized, 'utf-8');
    }

    // Atomic write to prevent partial file writes on process restart
    const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;
    fs.writeFileSync(tmpPath, serialized, 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    console.error(`[Database] Failed to atomically write ${filePath}:`, err);
  }
}

/**
 * Safely reads a JSON file from disk with automated recovery from backup
 * in case a git pull or stash-pop replaced it with an empty array or corrupted JSON.
 */
function readJsonWithBackupFallback<T>(filePath: string, backupPrefix: string, fallbackDefault: T): T {
  ensureDataDirectory();
  const backupPath = path.join(BACKUPS_DIR, `${backupPrefix}.latest.json`);

  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      if (raw && raw.trim().length > 0) {
        const parsed = JSON.parse(raw);

        // If it's a non-empty array or populated object, update backup and return
        const isNonEmptyArray = Array.isArray(parsed) && parsed.length > 0;
        const isPopulatedObject = !Array.isArray(parsed) && parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0;

        if (isNonEmptyArray || isPopulatedObject) {
          try {
            fs.writeFileSync(backupPath, raw, 'utf-8');
          } catch {}
          return parsed as T;
        }

        // If file is empty [] but backup exists and has data, auto-restore from backup!
        if (fs.existsSync(backupPath)) {
          const backupRaw = fs.readFileSync(backupPath, 'utf-8');
          if (backupRaw && backupRaw.trim().length > 0) {
            const backupParsed = JSON.parse(backupRaw);
            if (Array.isArray(backupParsed) && backupParsed.length > 0) {
              console.warn(`[Database] Main file ${path.basename(filePath)} was empty (possibly reset by git pull). Auto-restoring ${backupParsed.length} records from backup.`);
              writeJsonAtomic(filePath, backupParsed, backupPrefix);
              return backupParsed as T;
            }
          }
        }
        return parsed as T;
      }
    } catch (err) {
      console.error(`[Database] Error parsing ${filePath}, checking backup for auto-recovery:`, err);
    }
  }

  // File was missing or corrupted: attempt backup recovery
  if (fs.existsSync(backupPath)) {
    try {
      const backupRaw = fs.readFileSync(backupPath, 'utf-8');
      if (backupRaw && backupRaw.trim().length > 0) {
        const backupParsed = JSON.parse(backupRaw);
        console.warn(`[Database] Successfully auto-recovered ${path.basename(filePath)} from persistent backup.`);
        writeJsonAtomic(filePath, backupParsed, backupPrefix);
        return backupParsed as T;
      }
    } catch (err) {
      console.error(`[Database] Backup file also corrupted for ${backupPrefix}:`, err);
    }
  }

  return fallbackDefault;
}

/**
 * Loads saved servants, custom CEs, gacha banner settings, and master profiles from disk on startup.
 */
function loadFromDisk() {
  try {
    ensureDataDirectory();

    // 1. Load Custom & Edited Servants (with auto-recovery)
    const savedServants: ServantTemplate[] = readJsonWithBackupFallback<ServantTemplate[]>(
      CUSTOM_SERVANTS_FILE,
      'custom_servants',
      []
    );
    for (const s of savedServants) {
      const canonIdx = SERVANT_DATABASE.findIndex(c => c.id === s.id);
      if (canonIdx >= 0) {
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
        savedServantsMap.set(s.id, s);
        const customIdx = customServants.findIndex(c => c.id === s.id);
        if (customIdx >= 0) {
          customServants[customIdx] = s;
        } else {
          customServants.push(s);
        }
      }
    }

    // 2. Load Custom & Edited Craft Essences (with auto-recovery)
    const savedCes: CraftEssence[] = readJsonWithBackupFallback<CraftEssence[]>(
      CUSTOM_CES_FILE,
      'custom_ces',
      []
    );
    if (Array.isArray(savedCes)) {
      customCraftEssences = savedCes;
      for (const ce of savedCes) {
        const canonIdx = CRAFT_ESSENCE_DATABASE.findIndex(c => c.id === ce.id);
        if (canonIdx >= 0) {
          CRAFT_ESSENCE_DATABASE[canonIdx] = { ...CRAFT_ESSENCE_DATABASE[canonIdx], ...ce };
        }
      }
    }

    // 3. Load Gacha Banner customization (with auto-recovery)
    const savedBanner: GachaBanner | null = readJsonWithBackupFallback<GachaBanner | null>(
      GACHA_BANNER_FILE,
      'gacha_banner',
      null
    );
    if (savedBanner && savedBanner.title) {
      currentGachaBanner = { ...CE_GACHA_BANNERS[0], ...savedBanner };
    }

    // 4. Load Custom Servant NP Animations (with auto-recovery)
    const savedAnims: ServantNpAnimConfig[] = readJsonWithBackupFallback<ServantNpAnimConfig[]>(
      NP_ANIMS_FILE,
      'servant_np_anims',
      []
    );
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

    // 5. Load Duel NP Settings
    const savedSettings = readJsonWithBackupFallback<any>(DUEL_SETTINGS_FILE, 'duel_settings', null);
    if (savedSettings) {
      duelNpSettings = {
        autoDelete: savedSettings.autoDelete !== false,
        afkTimeoutSeconds: Math.max(15, Number(savedSettings.afkTimeoutSeconds) || 60)
      };
    }

    // 6. Load Master Profiles (with auto-recovery)
    const savedMasters: MasterProfile[] = readJsonWithBackupFallback<MasterProfile[]>(
      MASTERS_FILE,
      'masters',
      []
    );
    if (Array.isArray(savedMasters) && savedMasters.length > 0) {
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
              const { avatarUrl, cardArtUrl } = getServantAvatarAndCardArt(inst, Array.from(savedServantsMap.values()));
              inst.template = {
                ...canonical,
                ...(customSaved || {}),
                ...(inst.template || {}),
                avatarUrl,
                cardArtUrl,
                baseHp: customSaved?.baseHp || canonical.baseHp,
                baseAtk: customSaved?.baseAtk || canonical.baseAtk,
                baseStats: customSaved?.baseStats || canonical.baseStats,
                noblePhantasm: customSaved?.noblePhantasm || canonical.noblePhantasm,
                skills: customSaved?.skills || canonical.skills
              };
              inst.avatarUrl = avatarUrl;
              inst.cardArtUrl = cardArtUrl;
            }
          }
        }
        masterStore.set(m.discordId, m);
      }
      // Save upgraded master profiles atomically
      saveMastersToDisk();
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
    for (const cs of customServants) {
      if (!savedServantsMap.has(cs.id)) {
        listToSave.push(cs);
      }
    }
    writeJsonAtomic(CUSTOM_SERVANTS_FILE, listToSave, 'custom_servants');
  } catch (err) {
    console.error('[Database] Failed to write custom_servants.json to disk:', err);
  }
}

function saveCustomCesToDisk() {
  try {
    ensureDataDirectory();
    writeJsonAtomic(CUSTOM_CES_FILE, customCraftEssences, 'custom_ces');
  } catch (err) {
    console.error('[Database] Failed to write custom_ces.json to disk:', err);
  }
}

function saveGachaBannerToDisk() {
  try {
    ensureDataDirectory();
    writeJsonAtomic(GACHA_BANNER_FILE, currentGachaBanner, 'gacha_banner');
  } catch (err) {
    console.error('[Database] Failed to write gacha_banner.json to disk:', err);
  }
}

function saveNpAnimsToDisk() {
  try {
    ensureDataDirectory();
    const unique = new Map<string, ServantNpAnimConfig>();
    for (const anim of customNpAnims.values()) {
      unique.set(anim.servantId, anim);
    }
    writeJsonAtomic(NP_ANIMS_FILE, Array.from(unique.values()), 'servant_np_anims');
  } catch (err) {
    console.error('[Database] Failed to write servant_np_anims.json to disk:', err);
  }
}

function saveDuelSettingsToDisk() {
  try {
    ensureDataDirectory();
    writeJsonAtomic(DUEL_SETTINGS_FILE, duelNpSettings, 'duel_settings');
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
    writeJsonAtomic(MASTERS_FILE, mastersList, 'masters');
  } catch (err) {
    console.error('[Database] Failed to write masters.json to disk:', err);
  }
}

/**
 * Returns the entire Throne of Heroes database (Built-in + Admin Custom Servants), safely deduplicated by ID and Name.
 */
export function getAllThroneServants(): ServantTemplate[] {
  const map = new Map<string, ServantTemplate>();

  // 1. Add built-in canonical database servants
  for (const s of SERVANT_DATABASE) {
    if (s && s.id) {
      map.set(s.id, s);
    }
  }

  // 2. Add custom servants without duplicating existing IDs or Names
  for (const s of customServants) {
    if (s && s.id) {
      if (!map.has(s.id)) {
        // Also ensure no duplicate by lowercased servant name
        const nameMatch = Array.from(map.values()).find(
          existing => existing.name.toLowerCase().trim() === s.name.toLowerCase().trim()
        );
        if (!nameMatch) {
          map.set(s.id, s);
        }
      }
    }
  }

  return Array.from(map.values());
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

  // If the URL is external, download to local media asynchronously
  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
    downloadMediaToLocal(cleanUrl, `np_${target.id}`).then((localUrl) => {
      if (localUrl && localUrl.startsWith('/api/media/')) {
        config.gifUrl = localUrl;
        if (target.noblePhantasm) {
          target.noblePhantasm.animationUrl = localUrl;
          target.noblePhantasm.gifUrl = localUrl;
        }
        customNpAnims.set(target.id, config);
        customNpAnims.set(target.name.toLowerCase(), config);
        saveNpAnimsToDisk();
      }
    }).catch(() => {});
  }

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
 * Retrieves a Master profile by Discord ID if it exists, without auto-creating.
 */
export function getMaster(discordId: string): MasterProfile | undefined {
  return masterStore.get(discordId);
}

/**
 * Retrieves all registered Masters from the in-memory store.
 */
export function getAllMasters(): MasterProfile[] {
  return Array.from(masterStore.values());
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
 * Resets a single Master's contracted Servants (severs contract or resets stats to Lv.1).
 */
export async function resetSingleMasterServant(
  discordId: string,
  options: { fullSever?: boolean; resetStatsOnly?: boolean; resetSeals?: number } = { fullSever: true }
): Promise<MasterProfile | null> {
  const master = masterStore.get(discordId);
  if (!master) return null;

  if (options.resetStatsOnly) {
    if (master.servants) {
      for (const s of master.servants) {
        s.level = 1;
        s.experience = 0;
        s.availableStatPoints = 0;
        s.allocatedStats = { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 };
        s.bondLevel = 0;
        s.equippedCe = undefined;
        s.equippedCeId = undefined;
        s.skillLevels = [1, 1, 1];
      }
    }
  } else {
    // Full contract sever / clean slate
    master.servants = [];
    master.activeServantId = undefined;
  }

  if (options.resetSeals !== undefined) {
    master.commandSeals = options.resetSeals;
  }

  saveMastersToDisk();
  return master;
}

/**
 * Resets all Masters' contracted Servants across the entire server for a fresh Holy Grail War season.
 */
export async function resetAllMastersServants(
  options: { fullSever?: boolean; resetStatsOnly?: boolean; startingSeals?: number } = { fullSever: true }
): Promise<{ count: number; masters: MasterProfile[] }> {
  let count = 0;
  const updated: MasterProfile[] = [];

  for (const master of masterStore.values()) {
    if (options.resetStatsOnly) {
      if (master.servants && master.servants.length > 0) {
        for (const s of master.servants) {
          s.level = 1;
          s.experience = 0;
          s.availableStatPoints = 0;
          s.allocatedStats = { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 };
          s.bondLevel = 0;
          s.equippedCe = undefined;
          s.equippedCeId = undefined;
          s.skillLevels = [1, 1, 1];
        }
      }
    } else {
      master.servants = [];
      master.activeServantId = undefined;
    }

    if (options.startingSeals !== undefined) {
      master.commandSeals = options.startingSeals;
    }

    count++;
    updated.push(master);
  }

  saveMastersToDisk();
  return { count, masters: updated };
}

/**
 * Resets a single Master's currency balances (SQ, QP, Tickets, Grail Shards, Mana Prisms, etc.).
 */
export async function resetSingleMasterCurrency(
  discordId: string,
  options: { startingSq?: number; startingQp?: number; startingTickets?: number } = { startingSq: 30, startingQp: 0, startingTickets: 0 }
): Promise<MasterProfile | null> {
  const master = masterStore.get(discordId);
  if (!master) return null;

  master.saintQuartz = options.startingSq ?? 30;
  master.qp = options.startingQp ?? 0;
  master.summonTickets = options.startingTickets ?? 0;
  master.grailShards = 0;
  master.manaPrisms = 0;
  master.pityCount = 0;
  master.actionPoints = 100;
  master.maxActionPoints = 100;

  saveMastersToDisk();
  return master;
}

/**
 * Resets a single Master's inventory items (all Craft Essences, un-equips CEs from Servants, Homunculi).
 */
export async function resetSingleMasterInventory(
  discordId: string
): Promise<MasterProfile | null> {
  const master = masterStore.get(discordId);
  if (!master) return null;

  // Clear Craft Essences list
  master.craftEssences = [];
  master.homunculusCount = 0;

  // Detach all equipped CEs on contracted Servants
  if (master.servants) {
    for (const s of master.servants) {
      s.equippedCeId = undefined;
      s.equippedCe = undefined;
    }
  }

  saveMastersToDisk();
  return master;
}

/**
 * Resets both inventory items and currencies for a single Master.
 */
export async function resetSingleMasterVault(
  discordId: string,
  options: { startingSq?: number; startingQp?: number; startingTickets?: number } = { startingSq: 30, startingQp: 0, startingTickets: 0 }
): Promise<MasterProfile | null> {
  await resetSingleMasterInventory(discordId);
  return resetSingleMasterCurrency(discordId, options);
}

/**
 * Server-wide reset: Wipes all inventory items and resets currency balances for ALL Masters on the server.
 */
export async function resetAllMastersInventoryAndCurrency(
  options: { startingSq?: number; startingQp?: number; startingTickets?: number } = { startingSq: 30, startingQp: 0, startingTickets: 0 }
): Promise<{ count: number; masters: MasterProfile[] }> {
  let count = 0;
  const updated: MasterProfile[] = [];

  for (const master of masterStore.values()) {
    master.craftEssences = [];
    master.homunculusCount = 0;
    master.saintQuartz = options.startingSq ?? 30;
    master.qp = options.startingQp ?? 0;
    master.summonTickets = options.startingTickets ?? 0;
    master.grailShards = 0;
    master.manaPrisms = 0;
    master.pityCount = 0;
    master.actionPoints = 100;
    master.maxActionPoints = 100;

    if (master.servants) {
      for (const s of master.servants) {
        s.equippedCeId = undefined;
        s.equippedCe = undefined;
      }
    }

    count++;
    updated.push(master);
  }

  saveMastersToDisk();
  return { count, masters: updated };
}

/**
 * Gives currency or consumable items to any specified Master.
 */
export async function giveCurrencyToMaster(
  discordId: string,
  type: string,
  amount: number
): Promise<{ success: boolean; message: string; master: MasterProfile | null; newAmount: number }> {
  const master = masterStore.get(discordId);
  if (!master) {
    return { success: false, message: `Master with Discord ID \`${discordId}\` not found in database.`, master: null, newAmount: 0 };
  }

  const safeAmount = Math.max(1, Math.floor(amount || 1));
  const t = type.toLowerCase().trim();

  let newAmount = 0;
  let label = '';

  if (t === 'sq' || t === 'saintquartz' || t === 'saint_quartz') {
    master.saintQuartz = (master.saintQuartz || 0) + safeAmount;
    newAmount = master.saintQuartz;
    label = `${safeAmount} Saint Quartz (💎 Total: ${newAmount})`;
  } else if (t === 'qp' || t === 'quantum_pieces') {
    master.qp = (master.qp || 0) + safeAmount;
    newAmount = master.qp;
    label = `${safeAmount.toLocaleString()} QP (🪙 Total: ${newAmount.toLocaleString()})`;
  } else if (t === 'tickets' || t === 'summontickets' || t === 'ticket' || t === 'summon_tickets') {
    master.summonTickets = (master.summonTickets || 0) + safeAmount;
    newAmount = master.summonTickets;
    label = `${safeAmount} Summon Tickets (🎫 Total: ${newAmount})`;
  } else if (t === 'seals' || t === 'commandseals' || t === 'command_seals' || t === 'seal') {
    master.commandSeals = Math.min(3, (master.commandSeals || 0) + safeAmount);
    newAmount = master.commandSeals;
    label = `${safeAmount} Command Seals (🔱 Total: ${newAmount}/3)`;
  } else if (t === 'mana_prisms' || t === 'prisms' || t === 'manaprisms') {
    master.manaPrisms = (master.manaPrisms || 0) + safeAmount;
    newAmount = master.manaPrisms;
    label = `${safeAmount} Mana Prisms (🧪 Total: ${newAmount})`;
  } else if (t === 'grail_shards' || t === 'shards' || t === 'grailshards') {
    master.grailShards = (master.grailShards || 0) + safeAmount;
    newAmount = master.grailShards;
    label = `${safeAmount} Holy Grail Shards (🔮 Total: ${newAmount})`;
  } else if (t === 'stat_points' || t === 'statpoints' || t === 'points' || t === 'stats') {
    const active = master.servants?.find(s => s.id === master.activeServantId) || master.servants?.[0];
    if (!active) {
      return { success: false, message: `Master **${master.username}** does not have a contracted Servant to give stat points to!`, master, newAmount: 0 };
    }
    active.availableStatPoints = (active.availableStatPoints || 0) + safeAmount;
    newAmount = active.availableStatPoints;
    label = `${safeAmount} Stat Points for ${active.template.name} (⚡ Available: ${newAmount})`;
  } else if (t === 'homunculi' || t === 'homunculus' || t === 'homunculus_count') {
    master.homunculusCount = (master.homunculusCount || 0) + safeAmount;
    newAmount = master.homunculusCount;
    label = `${safeAmount} Homunculus Helpers (🧬 Total: ${newAmount})`;
  } else if (t === 'ap' || t === 'action_points' || t === 'actionpoints') {
    master.actionPoints = Math.min(master.maxActionPoints || 100, (master.actionPoints || 0) + safeAmount);
    newAmount = master.actionPoints;
    label = `${safeAmount} Action Points (⚡ Total: ${newAmount}/${master.maxActionPoints || 100})`;
  } else {
    return { success: false, message: `Unknown currency/item type: \`${type}\`. Supported: \`sq\`, \`qp\`, \`tickets\`, \`seals\`, \`mana_prisms\`, \`grail_shards\`, \`stat_points\`, \`homunculi\`, \`ap\`.`, master, newAmount: 0 };
  }

  await saveMaster(master);
  return {
    success: true,
    message: `Successfully granted **${label}** to **${master.username}**!`,
    master,
    newAmount
  };
}

/**
 * Removes currency or consumable items from any specified Master.
 */
export async function removeCurrencyFromMaster(
  discordId: string,
  type: string,
  amount: number
): Promise<{ success: boolean; message: string; master: MasterProfile | null; newAmount: number }> {
  const master = masterStore.get(discordId);
  if (!master) {
    return { success: false, message: `Master with Discord ID \`${discordId}\` not found in database.`, master: null, newAmount: 0 };
  }

  const safeAmount = Math.max(1, Math.floor(amount || 1));
  const t = type.toLowerCase().trim();

  let newAmount = 0;
  let label = '';

  if (t === 'sq' || t === 'saintquartz' || t === 'saint_quartz') {
    master.saintQuartz = Math.max(0, (master.saintQuartz || 0) - safeAmount);
    newAmount = master.saintQuartz;
    label = `${safeAmount} Saint Quartz (💎 Remaining: ${newAmount})`;
  } else if (t === 'qp' || t === 'quantum_pieces') {
    master.qp = Math.max(0, (master.qp || 0) - safeAmount);
    newAmount = master.qp;
    label = `${safeAmount.toLocaleString()} QP (🪙 Remaining: ${newAmount.toLocaleString()})`;
  } else if (t === 'tickets' || t === 'summontickets' || t === 'ticket' || t === 'summon_tickets') {
    master.summonTickets = Math.max(0, (master.summonTickets || 0) - safeAmount);
    newAmount = master.summonTickets;
    label = `${safeAmount} Summon Tickets (🎫 Remaining: ${newAmount})`;
  } else if (t === 'seals' || t === 'commandseals' || t === 'command_seals' || t === 'seal') {
    master.commandSeals = Math.max(0, (master.commandSeals || 0) - safeAmount);
    newAmount = master.commandSeals;
    label = `${safeAmount} Command Seals (🔱 Remaining: ${newAmount}/3)`;
  } else if (t === 'mana_prisms' || t === 'prisms' || t === 'manaprisms') {
    master.manaPrisms = Math.max(0, (master.manaPrisms || 0) - safeAmount);
    newAmount = master.manaPrisms;
    label = `${safeAmount} Mana Prisms (🧪 Remaining: ${newAmount})`;
  } else if (t === 'grail_shards' || t === 'shards' || t === 'grailshards') {
    master.grailShards = Math.max(0, (master.grailShards || 0) - safeAmount);
    newAmount = master.grailShards;
    label = `${safeAmount} Holy Grail Shards (🔮 Remaining: ${newAmount})`;
  } else if (t === 'stat_points' || t === 'statpoints' || t === 'points' || t === 'stats') {
    const active = master.servants?.find(s => s.id === master.activeServantId) || master.servants?.[0];
    if (!active) {
      return { success: false, message: `Master **${master.username}** does not have a contracted Servant!`, master, newAmount: 0 };
    }
    active.availableStatPoints = Math.max(0, (active.availableStatPoints || 0) - safeAmount);
    newAmount = active.availableStatPoints;
    label = `${safeAmount} Stat Points from ${active.template.name} (⚡ Remaining: ${newAmount})`;
  } else if (t === 'homunculi' || t === 'homunculus' || t === 'homunculus_count') {
    master.homunculusCount = Math.max(0, (master.homunculusCount || 0) - safeAmount);
    newAmount = master.homunculusCount;
    label = `${safeAmount} Homunculus Helpers (🧬 Remaining: ${newAmount})`;
  } else if (t === 'ap' || t === 'action_points' || t === 'actionpoints') {
    master.actionPoints = Math.max(0, (master.actionPoints || 0) - safeAmount);
    newAmount = master.actionPoints;
    label = `${safeAmount} Action Points (⚡ Remaining: ${newAmount}/${master.maxActionPoints || 100})`;
  } else {
    return { success: false, message: `Unknown currency/item type: \`${type}\`. Supported: \`sq\`, \`qp\`, \`tickets\`, \`seals\`, \`mana_prisms\`, \`grail_shards\`, \`stat_points\`, \`homunculi\`, \`ap\`.`, master, newAmount: 0 };
  }

  await saveMaster(master);
  return {
    success: true,
    message: `Successfully deducted **${label}** from **${master.username}**!`,
    master,
    newAmount
  };
}

/**
 * Sets an exact value on any Master or their active Servant.
 */
export async function setMasterStat(
  discordId: string,
  field: string,
  value: number
): Promise<{ success: boolean; message: string; master: MasterProfile | null; prevValue: number; newValue: number }> {
  const master = masterStore.get(discordId);
  if (!master) {
    return { success: false, message: `Master with Discord ID \`${discordId}\` not found.`, master: null, prevValue: 0, newValue: 0 };
  }

  const f = field.toLowerCase().trim();
  const v = Math.max(0, Math.floor(value));
  let prevValue = 0;
  let fieldLabel = '';

  const active = master.servants?.find(s => s.id === master.activeServantId) || master.servants?.[0];

  if (f === 'sq' || f === 'saintquartz' || f === 'saint_quartz') {
    prevValue = master.saintQuartz || 0;
    master.saintQuartz = v;
    fieldLabel = '💎 Saint Quartz';
  } else if (f === 'qp' || f === 'quantum_pieces') {
    prevValue = master.qp || 0;
    master.qp = v;
    fieldLabel = '🪙 QP';
  } else if (f === 'tickets' || f === 'summontickets' || f === 'summon_tickets') {
    prevValue = master.summonTickets || 0;
    master.summonTickets = v;
    fieldLabel = '🎫 Summon Tickets';
  } else if (f === 'seals' || f === 'commandseals' || f === 'command_seals') {
    prevValue = master.commandSeals || 0;
    master.commandSeals = Math.min(3, v);
    fieldLabel = '🔱 Command Seals';
  } else if (f === 'mana_prisms' || f === 'prisms') {
    prevValue = master.manaPrisms || 0;
    master.manaPrisms = v;
    fieldLabel = '🧪 Mana Prisms';
  } else if (f === 'grail_shards' || f === 'shards') {
    prevValue = master.grailShards || 0;
    master.grailShards = v;
    fieldLabel = '🔮 Grail Shards';
  } else if (f === 'homunculi' || f === 'homunculus') {
    prevValue = master.homunculusCount || 0;
    master.homunculusCount = v;
    fieldLabel = '🧬 Homunculi';
  } else if (f === 'ap' || f === 'action_points') {
    prevValue = master.actionPoints || 0;
    master.actionPoints = Math.min(master.maxActionPoints || 100, v);
    fieldLabel = '⚡ Action Points';
  } else if (f === 'servant_level' || f === 'level' || f === 'lvl') {
    if (!active) return { success: false, message: `Master **${master.username}** has no active Servant!`, master, prevValue: 0, newValue: 0 };
    prevValue = active.level || 1;
    active.level = Math.max(1, Math.min(100, v));
    fieldLabel = `⚔️ ${active.template.name} Level`;
  } else if (f === 'servant_bond' || f === 'bond' || f === 'bond_level') {
    if (!active) return { success: false, message: `Master **${master.username}** has no active Servant!`, master, prevValue: 0, newValue: 0 };
    prevValue = active.bondLevel || 0;
    active.bondLevel = Math.max(0, Math.min(10, v));
    fieldLabel = `💖 ${active.template.name} Bond Level`;
  } else if (f === 'stat_points' || f === 'statpoints' || f === 'points') {
    if (!active) return { success: false, message: `Master **${master.username}** has no active Servant!`, master, prevValue: 0, newValue: 0 };
    prevValue = active.availableStatPoints || 0;
    active.availableStatPoints = v;
    fieldLabel = `⚡ ${active.template.name} Available Stat Points`;
  } else if (f === 'servant_str' || f === 'strength' || f === 'str') {
    if (!active) return { success: false, message: `Master **${master.username}** has no active Servant!`, master, prevValue: 0, newValue: 0 };
    prevValue = active.allocatedStats?.strength || 0;
    if (!active.allocatedStats) active.allocatedStats = { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 };
    active.allocatedStats.strength = v;
    fieldLabel = `💪 ${active.template.name} Allocated STR`;
  } else if (f === 'servant_end' || f === 'endurance' || f === 'end') {
    if (!active) return { success: false, message: `Master **${master.username}** has no active Servant!`, master, prevValue: 0, newValue: 0 };
    prevValue = active.allocatedStats?.endurance || 0;
    if (!active.allocatedStats) active.allocatedStats = { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 };
    active.allocatedStats.endurance = v;
    fieldLabel = `🛡️ ${active.template.name} Allocated END`;
  } else if (f === 'servant_agi' || f === 'agility' || f === 'agi') {
    if (!active) return { success: false, message: `Master **${master.username}** has no active Servant!`, master, prevValue: 0, newValue: 0 };
    prevValue = active.allocatedStats?.agility || 0;
    if (!active.allocatedStats) active.allocatedStats = { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 };
    active.allocatedStats.agility = v;
    fieldLabel = `💨 ${active.template.name} Allocated AGI`;
  } else if (f === 'servant_mana' || f === 'mana' || f === 'mp') {
    if (!active) return { success: false, message: `Master **${master.username}** has no active Servant!`, master, prevValue: 0, newValue: 0 };
    prevValue = active.allocatedStats?.mana || 0;
    if (!active.allocatedStats) active.allocatedStats = { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 };
    active.allocatedStats.mana = v;
    fieldLabel = `🔮 ${active.template.name} Allocated MANA`;
  } else if (f === 'servant_lck' || f === 'luck' || f === 'lck') {
    if (!active) return { success: false, message: `Master **${master.username}** has no active Servant!`, master, prevValue: 0, newValue: 0 };
    prevValue = active.allocatedStats?.luck || 0;
    if (!active.allocatedStats) active.allocatedStats = { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 };
    active.allocatedStats.luck = v;
    fieldLabel = `🍀 ${active.template.name} Allocated LUCK`;
  } else {
    return { success: false, message: `Unknown attribute: \`${field}\`. Supported: \`sq\`, \`qp\`, \`tickets\`, \`seals\`, \`mana_prisms\`, \`grail_shards\`, \`stat_points\`, \`homunculi\`, \`ap\`, \`servant_level\`, \`servant_bond\`, \`servant_str\`, \`servant_end\`, \`servant_agi\`, \`servant_mana\`, \`servant_lck\`.`, master, prevValue: 0, newValue: 0 };
  }

  await saveMaster(master);
  return {
    success: true,
    message: `Updated **${fieldLabel}** for **${master.username}**: \`${prevValue}\` ➔ \`${v}\``,
    master,
    prevValue,
    newValue: v
  };
}

/**
 * Force gives any Craft Essence (canon or custom) to any Master's inventory.
 */
export async function giveCraftEssenceToMaster(
  discordId: string,
  ceQuery: string,
  count: number = 1
): Promise<{ success: boolean; message: string; ce?: CraftEssence; countAdded: number; master: MasterProfile | null }> {
  const master = masterStore.get(discordId);
  if (!master) {
    return { success: false, message: `Master with Discord ID \`${discordId}\` not found.`, countAdded: 0, master: null };
  }

  const allCes = getAllCraftEssences();
  const q = ceQuery.toLowerCase().trim();
  const foundCe = allCes.find(c => c.id.toLowerCase() === q || c.name.toLowerCase() === q || c.name.toLowerCase().includes(q));

  if (!foundCe) {
    return { success: false, message: `Craft Essence matching \`${ceQuery}\` not found in database.`, countAdded: 0, master };
  }

  const safeCount = Math.max(1, Math.floor(count || 1));
  if (!master.craftEssences) {
    master.craftEssences = [];
  }

  for (let i = 0; i < safeCount; i++) {
    // Generate unique instance ID for each granted CE
    master.craftEssences.push({
      ...foundCe,
      id: foundCe.id
    });
  }

  await saveMaster(master);

  return {
    success: true,
    message: `Granted **${safeCount}x ${foundCe.rarity}★ ${foundCe.name}** to **${master.username}**'s inventory! (Total CEs owned: ${master.craftEssences.length})`,
    ce: foundCe,
    countAdded: safeCount,
    master
  };
}

/**
 * Removes Craft Essence(s) from any Master's inventory (and un-equips if needed).
 */
export async function removeCraftEssenceFromMaster(
  discordId: string,
  ceQuery: string,
  count: number = 1,
  removeAll: boolean = false
): Promise<{ success: boolean; message: string; countRemoved: number; master: MasterProfile | null }> {
  const master = masterStore.get(discordId);
  if (!master) {
    return { success: false, message: `Master with Discord ID \`${discordId}\` not found.`, countRemoved: 0, master: null };
  }

  if (!master.craftEssences || master.craftEssences.length === 0) {
    return { success: false, message: `Master **${master.username}** does not have any Craft Essences in their inventory.`, countRemoved: 0, master };
  }

  if (removeAll || ceQuery.toLowerCase().trim() === 'all') {
    const totalWiped = master.craftEssences.length;
    master.craftEssences = [];
    if (master.servants) {
      for (const s of master.servants) {
        s.equippedCe = undefined;
        s.equippedCeId = undefined;
      }
    }
    await saveMaster(master);
    return {
      success: true,
      message: `Removed all **${totalWiped}** Craft Essences from **${master.username}**'s inventory and unequipped all relics.`,
      countRemoved: totalWiped,
      master
    };
  }

  const q = ceQuery.toLowerCase().trim();
  const matchingIndices: number[] = [];

  master.craftEssences.forEach((c, idx) => {
    if (c.id.toLowerCase() === q || c.name.toLowerCase() === q || c.name.toLowerCase().includes(q)) {
      matchingIndices.push(idx);
    }
  });

  if (matchingIndices.length === 0) {
    return { success: false, message: `No Craft Essence matching \`${ceQuery}\` found in **${master.username}**'s inventory.`, countRemoved: 0, master };
  }

  const safeCount = Math.max(1, Math.floor(count || 1));
  const indicesToRemove = new Set(matchingIndices.slice(0, safeCount));
  const removedName = master.craftEssences[matchingIndices[0]].name;

  master.craftEssences = master.craftEssences.filter((_, idx) => !indicesToRemove.has(idx));

  // If active servant had this CE equipped and none left, unequip
  if (master.servants) {
    for (const s of master.servants) {
      if (s.equippedCe && (s.equippedCe.id.toLowerCase() === q || s.equippedCe.name.toLowerCase().includes(q))) {
        const stillHas = master.craftEssences.some(c => c.id === s.equippedCeId);
        if (!stillHas) {
          s.equippedCe = undefined;
          s.equippedCeId = undefined;
        }
      }
    }
  }

  await saveMaster(master);

  return {
    success: true,
    message: `Removed **${indicesToRemove.size}x ${removedName}** from **${master.username}**'s inventory. (Remaining CEs: ${master.craftEssences.length})`,
    countRemoved: indicesToRemove.size,
    master
  };
}

/**
 * Force assigns / contracts any Servant (canon or custom) from the Throne to any Master.
 */
export async function giveServantToMaster(
  discordId: string,
  servantQuery: string,
  options: { level?: number; bond?: number; statPoints?: number; forceActive?: boolean } = {}
): Promise<{ success: boolean; message: string; servant?: MasterServantInstance; master: MasterProfile | null }> {
  const master = masterStore.get(discordId);
  if (!master) {
    return { success: false, message: `Master with Discord ID \`${discordId}\` not found.`, master: null };
  }

  const foundTemplate = findServantInPool(servantQuery);
  if (!foundTemplate) {
    return { success: false, message: `Heroic Spirit matching \`${servantQuery}\` not found in the Throne of Heroes.`, master };
  }

  const newServantInstance: MasterServantInstance = {
    id: `contract_${foundTemplate.id}_${Date.now()}`,
    masterId: master.id,
    templateId: foundTemplate.id,
    level: Math.max(1, Math.min(100, options.level || 1)),
    experience: 0,
    allocatedStats: { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 },
    availableStatPoints: options.statPoints !== undefined ? options.statPoints : 10,
    skillLevels: [1, 1, 1],
    customQuotes: {
      summon: foundTemplate.summonQuote,
      battleStart: foundTemplate.battleStartQuote,
      noblePhantasm: foundTemplate.noblePhantasm.chant,
      victory: foundTemplate.victoryQuote,
      defeat: foundTemplate.defeatQuote
    },
    bondLevel: options.bond !== undefined ? options.bond : 1,
    template: foundTemplate
  };

  master.servants = [newServantInstance];
  master.activeServantId = newServantInstance.id;
  master.commandSeals = 3;

  await saveMaster(master);

  return {
    success: true,
    message: `Formed a sacred pact! Bestowed **${foundTemplate.rarity}★ ${foundTemplate.name}** (${foundTemplate.servantClass}) to **${master.username}** with 3 Command Seals!`,
    servant: newServantInstance,
    master
  };
}

/**
 * Force severs / removes a Servant from any Master.
 */
export async function removeServantFromMaster(
  discordId: string,
  servantQuery?: string
): Promise<{ success: boolean; message: string; master: MasterProfile | null; removedName?: string }> {
  const master = masterStore.get(discordId);
  if (!master) {
    return { success: false, message: `Master with Discord ID \`${discordId}\` not found.`, master: null };
  }

  if (!master.servants || master.servants.length === 0) {
    return { success: false, message: `Master **${master.username}** has no contracted Servants.`, master };
  }

  let removedName = master.servants[0].template.name;

  if (servantQuery) {
    const q = servantQuery.toLowerCase().trim();
    const idx = master.servants.findIndex(s => s.template.id.toLowerCase() === q || s.template.name.toLowerCase().includes(q));
    if (idx >= 0) {
      removedName = master.servants[idx].template.name;
      master.servants.splice(idx, 1);
    } else {
      return { success: false, message: `Servant matching \`${servantQuery}\` not contracted to **${master.username}**.`, master };
    }
  } else {
    master.servants = [];
  }

  if (master.servants.length === 0) {
    master.activeServantId = undefined;
  } else {
    master.activeServantId = master.servants[0].id;
  }

  await saveMaster(master);

  return {
    success: true,
    message: `Severed command contract over **${removedName}** from **${master.username}**. Returned to the Throne of Heroes.`,
    master,
    removedName
  };
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
