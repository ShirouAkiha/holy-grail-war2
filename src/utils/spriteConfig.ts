import fs from 'fs';
import path from 'path';
import type { ServantSpriteConfig } from '../types';

export const DATA_FILE_PATH = (typeof process !== 'undefined' && typeof process.cwd === 'function')
  ? path.join(process.cwd(), 'data', 'servant_sprite_configs.json')
  : 'data/servant_sprite_configs.json';

/**
 * Baseline calibrated defaults addressing custom servant aspect ratio variances:
 * - Lucia Lyozes: Compact scale (0.84x) so her sprite isn't oversized
 * - Luvria Greenharte: Stage-grounded Y position (+120px) in VN UI while preserving standard 1.0x in duel & raids
 * - Adiosa Dragon Envoy: Scaled up (1.32x Duel, 1.35x Raid) so her draconic figure isn't small in combat
 * - Edmond & Amamiya: Standard 1.0x balance
 */
export const DEFAULT_SERVANT_SPRITE_CONFIGS: Record<string, ServantSpriteConfig> = {
  lucia_lyozes: {
    servantId: 'lucia_lyozes',
    servantName: 'Lucernalia Lyozes',
    vnScale: 0.65,
    vnOffsetY: 40,
    vnOffsetX: 0,
    combatScale: 0.68,
    combatOffsetY: 35,
    combatOffsetX: 0,
    raidScale: 0.70,
    raidOffsetY: 50,
    raidOffsetX: 0
  },
  luvria_greenharte: {
    servantId: 'luvria_greenharte',
    servantName: 'Luvria Greenharte',
    vnScale: 0.98,
    vnOffsetY: 120,
    vnOffsetX: 0,
    combatScale: 1.0,
    combatOffsetY: 0,
    combatOffsetX: 0,
    raidScale: 1.0,
    raidOffsetY: 0,
    raidOffsetX: 0
  },
  adiosa_dragon_envoy: {
    servantId: 'adiosa_dragon_envoy',
    servantName: 'Adiosa Dragon Envoy',
    vnScale: 1.0,
    vnOffsetY: 20,
    vnOffsetX: 0,
    combatScale: 1.32,
    combatOffsetY: -15,
    combatOffsetX: 0,
    raidScale: 1.35,
    raidOffsetY: -10,
    raidOffsetX: 0
  },
  edmond: {
    servantId: 'edmond',
    servantName: 'Edmond',
    vnScale: 1.0,
    vnOffsetY: 0,
    vnOffsetX: 0,
    combatScale: 1.0,
    combatOffsetY: 0,
    combatOffsetX: 0,
    raidScale: 1.0,
    raidOffsetY: 0,
    raidOffsetX: 0
  },
  amamiya_no_chihaya_tenkohime: {
    servantId: 'amamiya_no_chihaya_tenkohime',
    servantName: 'Amamiya no Chihaya Tenkohime',
    vnScale: 1.0,
    vnOffsetY: 0,
    vnOffsetX: 0,
    combatScale: 1.0,
    combatOffsetY: 0,
    combatOffsetX: 0,
    raidScale: 1.0,
    raidOffsetY: 0,
    raidOffsetX: 0
  }
};

/**
 * Normalizes input name or ID into standard canonical ID
 */
export function normalizeSpriteServantId(rawIdOrName?: string): string {
  if (!rawIdOrName) return '';
  const clean = rawIdOrName.trim().toLowerCase().replace(/[\s\-_]+/g, '_');

  if (clean.includes('lucia') || clean.includes('lucernalia') || clean.includes('lyozes')) {
    return 'lucia_lyozes';
  }
  if (clean.includes('luvria') || clean.includes('greenharte')) {
    return 'luvria_greenharte';
  }
  if (clean.includes('adiosa') || clean.includes('dragon_envoy')) {
    return 'adiosa_dragon_envoy';
  }
  if (clean.includes('edmond')) {
    return 'edmond';
  }
  if (clean.includes('amamiya') || clean.includes('chihaya') || clean.includes('tenkohime')) {
    return 'amamiya_no_chihaya_tenkohime';
  }
  return clean;
}

// In-memory cache for fast synchronous access in render loops
let cachedSpriteConfigs: Record<string, ServantSpriteConfig> | null = null;

export function loadSpriteConfigsFromDisk(): Record<string, ServantSpriteConfig> {
  try {
    if (typeof window !== 'undefined' || typeof fs === 'undefined' || !fs.existsSync) {
      return { ...DEFAULT_SERVANT_SPRITE_CONFIGS };
    }
    if (!DATA_FILE_PATH || !fs.existsSync(DATA_FILE_PATH)) {
      return { ...DEFAULT_SERVANT_SPRITE_CONFIGS };
    }
    const raw = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
    const parsed = raw ? JSON.parse(raw) : null;
    const result: Record<string, ServantSpriteConfig> = { ...DEFAULT_SERVANT_SPRITE_CONFIGS };

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && item.servantId) {
          const norm = normalizeSpriteServantId(item.servantId);
          result[norm] = {
            ...(result[norm] || {}),
            ...item,
            servantId: norm
          };
        }
      }
    } else if (parsed && typeof parsed === 'object') {
      for (const [key, item] of Object.entries(parsed)) {
        if (item && typeof item === 'object') {
          const norm = normalizeSpriteServantId((item as any).servantId || key);
          result[norm] = {
            ...(result[norm] || {}),
            ...(item as any),
            servantId: norm
          };
        }
      }
    }
    cachedSpriteConfigs = result;
    return result;
  } catch (err) {
    console.error('Error loading servant sprite configs from disk:', err);
    return { ...DEFAULT_SERVANT_SPRITE_CONFIGS };
  }
}

export function saveSpriteConfigsToDisk(configs: Record<string, ServantSpriteConfig> | ServantSpriteConfig[]): boolean {
  try {
    if (typeof window !== 'undefined' || typeof fs === 'undefined' || !fs.writeFileSync) {
      return false;
    }
    const dataDir = path.dirname(DATA_FILE_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const list = Array.isArray(configs) ? configs : Object.values(configs);
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(list, null, 2), 'utf-8');

    // Update in-memory cache
    const newCache: Record<string, ServantSpriteConfig> = { ...DEFAULT_SERVANT_SPRITE_CONFIGS };
    for (const item of list) {
      if (item && item.servantId) {
        const norm = normalizeSpriteServantId(item.servantId);
        newCache[norm] = {
          ...(newCache[norm] || {}),
          ...item,
          servantId: norm
        };
      }
    }
    cachedSpriteConfigs = newCache;
    return true;
  } catch (err) {
    console.error('Error saving servant sprite configs to disk:', err);
    return false;
  }
}

/**
 * Retrieves the effective sprite configuration for a Servant by ID or Name.
 */
export function getServantSpriteConfig(servantIdOrName?: string): ServantSpriteConfig {
  if (!cachedSpriteConfigs) {
    loadSpriteConfigsFromDisk();
  }
  const norm = normalizeSpriteServantId(servantIdOrName);
  const found = (cachedSpriteConfigs && cachedSpriteConfigs[norm]) || DEFAULT_SERVANT_SPRITE_CONFIGS[norm];
  if (found) {
    return { ...found };
  }
  return {
    servantId: norm || 'default',
    servantName: servantIdOrName || 'Custom Servant',
    vnScale: 1.0,
    vnOffsetY: 0,
    vnOffsetX: 0,
    combatScale: 1.0,
    combatOffsetY: 0,
    combatOffsetX: 0,
    raidScale: 1.0,
    raidOffsetY: 0,
    raidOffsetX: 0
  };
}

/**
 * Updates a single servant sprite configuration in memory and persists to disk.
 */
export function setServantSpriteConfig(config: ServantSpriteConfig): ServantSpriteConfig {
  if (!cachedSpriteConfigs) {
    loadSpriteConfigsFromDisk();
  }
  const norm = normalizeSpriteServantId(config.servantId);
  const existing = getServantSpriteConfig(norm);
  const merged: ServantSpriteConfig = {
    ...existing,
    ...config,
    servantId: norm
  };
  if (cachedSpriteConfigs) {
    cachedSpriteConfigs[norm] = merged;
  }
  saveSpriteConfigsToDisk(cachedSpriteConfigs || { [norm]: merged });
  return merged;
}

/**
 * Resets a servant's sprite config to the recommended default.
 */
export function resetServantSpriteConfig(servantIdOrName: string): ServantSpriteConfig {
  const norm = normalizeSpriteServantId(servantIdOrName);
  const recommended = DEFAULT_SERVANT_SPRITE_CONFIGS[norm] || {
    servantId: norm,
    vnScale: 1.0,
    vnOffsetY: 0,
    vnOffsetX: 0,
    combatScale: 1.0,
    combatOffsetY: 0,
    combatOffsetX: 0,
    raidScale: 1.0,
    raidOffsetY: 0,
    raidOffsetX: 0
  };
  return setServantSpriteConfig(recommended);
}

/**
 * Returns all configured custom servants as an array.
 */
export function getAllServantSpriteConfigs(): ServantSpriteConfig[] {
  if (!cachedSpriteConfigs) {
    loadSpriteConfigsFromDisk();
  }
  return Object.values(cachedSpriteConfigs || DEFAULT_SERVANT_SPRITE_CONFIGS);
}
