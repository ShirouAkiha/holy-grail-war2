export interface ServantSpriteConfig {
  servantId: string;
  servantName: string;
  vnScale?: number;        // Visual Novel UI Scale Factor (e.g. 0.84, 1.0, 1.25)
  vnOffsetY?: number;      // Visual Novel UI Vertical Offset in px (e.g. -20, 0, +15)
  vnOffsetX?: number;      // Visual Novel UI Horizontal Offset in px
  duelScale?: number;      // Duel Combat Slot Scale Factor (e.g. 0.94, 1.15, 1.20)
  duelOffsetY?: number;    // Duel Combat Slot Vertical Offset in px
  raidHeight?: number;     // Raid Battlefield Sprite Height in px (e.g. 310, 370)
  raidOffsetY?: number;    // Raid Battlefield Vertical Offset in px
  updatedAt?: number;
  customBy?: string;
}

// Built-in fine-tuned calibrations for known custom/OC servants
const DEFAULT_SPRITE_CONFIGS: Record<string, ServantSpriteConfig> = {
  lucia: {
    servantId: 'lucia',
    servantName: 'Lucia Lyozes',
    vnScale: 0.84,
    vnOffsetY: 10,
    duelScale: 0.94,
    duelOffsetY: 0,
    raidHeight: 310,
    raidOffsetY: 0,
    updatedAt: Date.now(),
    customBy: 'Default Calibration'
  },
  luvria: {
    servantId: 'luvria',
    servantName: 'Luvria Greenharte',
    vnScale: 1.0,
    vnOffsetY: 5,
    duelScale: 0.94,
    duelOffsetY: 0,
    raidHeight: 310,
    raidOffsetY: 0,
    updatedAt: Date.now(),
    customBy: 'Default Calibration'
  },
  adiosa: {
    servantId: 'adiosa',
    servantName: 'Adiosa',
    vnScale: 1.25,
    vnOffsetY: 0,
    duelScale: 1.18,
    duelOffsetY: 0,
    raidHeight: 370,
    raidOffsetY: -35,
    updatedAt: Date.now(),
    customBy: 'Default Calibration'
  },
  edmond: {
    servantId: 'edmond',
    servantName: 'Edmond Dantes',
    vnScale: 1.25,
    vnOffsetY: 0,
    duelScale: 1.0,
    duelOffsetY: 0,
    raidHeight: 310,
    raidOffsetY: 0,
    updatedAt: Date.now(),
    customBy: 'Default Calibration'
  },
  amamiya: {
    servantId: 'amamiya',
    servantName: 'Amamiya',
    vnScale: 1.0,
    vnOffsetY: 0,
    duelScale: 1.0,
    duelOffsetY: 0,
    raidHeight: 310,
    raidOffsetY: 0,
    updatedAt: Date.now(),
    customBy: 'Default Calibration'
  }
};

const inMemorySpriteConfigs: Map<string, ServantSpriteConfig> = new Map();

// Initialize memory store with default calibrations
for (const [key, cfg] of Object.entries(DEFAULT_SPRITE_CONFIGS)) {
  inMemorySpriteConfigs.set(key, { ...cfg });
  inMemorySpriteConfigs.set(cfg.servantName.toLowerCase(), { ...cfg });
}

const LOCAL_STORAGE_KEY = 'fgo_servant_sprite_configs_v1';

export function loadSpriteConfigsFromStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return;
    const arr: ServantSpriteConfig[] = JSON.parse(raw);
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (item && item.servantId) {
          inMemorySpriteConfigs.set(item.servantId.toLowerCase(), item);
          if (item.servantName) inMemorySpriteConfigs.set(item.servantName.toLowerCase(), item);
        }
      }
    }
  } catch (err) {
    console.error('Failed to parse sprite configs from localStorage:', err);
  }
}

let onSaveCallback: ((configs: ServantSpriteConfig[]) => void) | null = null;

export function registerSpriteConfigDiskSaver(saver: (configs: ServantSpriteConfig[]) => void) {
  onSaveCallback = saver;
}

export function saveSpriteConfigsToStorage(): void {
  const all = getAllServantSpriteConfigs();
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
    } catch (err) {
      console.error('Failed to save sprite configs to localStorage:', err);
    }
    // Also broadcast to server endpoint if online
    fetch('/api/servants/sprites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync_all', configs: all })
    }).catch(() => {});
  }
  if (onSaveCallback) {
    try {
      onSaveCallback(all);
    } catch (err) {
      console.error('Failed to trigger disk saver callback:', err);
    }
  }
}

/**
 * Gets custom sprite size/position configuration for a servant.
 */
export function getServantSpriteConfig(queryOrId: string): ServantSpriteConfig | undefined {
  if (!queryOrId) return undefined;
  const q = queryOrId.trim().toLowerCase();
  
  if (inMemorySpriteConfigs.has(q)) return inMemorySpriteConfigs.get(q);

  for (const item of inMemorySpriteConfigs.values()) {
    const sId = item.servantId.toLowerCase();
    const sName = item.servantName.toLowerCase();
    if (sId === q || sName === q || q.includes(sId) || q.includes(sName) || sName.includes(q)) {
      return item;
    }
  }

  // Check default calibrations match
  if (q.includes('lucia')) return inMemorySpriteConfigs.get('lucia');
  if (q.includes('luvria')) return inMemorySpriteConfigs.get('luvria');
  if (q.includes('adiosa') || q.includes('typhon')) return inMemorySpriteConfigs.get('adiosa');
  if (q.includes('edmond') || q.includes('dantes')) return inMemorySpriteConfigs.get('edmond');
  if (q.includes('amamiya')) return inMemorySpriteConfigs.get('amamiya');

  return undefined;
}

/**
 * Saves or updates custom sprite size/position configuration for a servant.
 */
export function setServantSpriteConfig(config: Partial<ServantSpriteConfig> & { servantName: string; servantId?: string }): ServantSpriteConfig {
  const servantName = config.servantName.trim();
  const servantId = (config.servantId || servantName.toLowerCase().replace(/[^a-z0-9_]/g, '_')).trim();

  const existing = getServantSpriteConfig(servantId) || getServantSpriteConfig(servantName) || {
    servantId,
    servantName
  };

  const updated: ServantSpriteConfig = {
    ...existing,
    servantId,
    servantName: config.servantName || existing.servantName,
    vnScale: config.vnScale !== undefined && !isNaN(config.vnScale) ? config.vnScale : existing.vnScale,
    vnOffsetY: config.vnOffsetY !== undefined && !isNaN(config.vnOffsetY) ? config.vnOffsetY : existing.vnOffsetY,
    vnOffsetX: config.vnOffsetX !== undefined && !isNaN(config.vnOffsetX) ? config.vnOffsetX : existing.vnOffsetX,
    duelScale: config.duelScale !== undefined && !isNaN(config.duelScale) ? config.duelScale : existing.duelScale,
    duelOffsetY: config.duelOffsetY !== undefined && !isNaN(config.duelOffsetY) ? config.duelOffsetY : existing.duelOffsetY,
    raidHeight: config.raidHeight !== undefined && !isNaN(config.raidHeight) ? config.raidHeight : existing.raidHeight,
    raidOffsetY: config.raidOffsetY !== undefined && !isNaN(config.raidOffsetY) ? config.raidOffsetY : existing.raidOffsetY,
    updatedAt: Date.now(),
    customBy: config.customBy || existing.customBy || 'Admin'
  };

  inMemorySpriteConfigs.set(servantId.toLowerCase(), updated);
  inMemorySpriteConfigs.set(servantName.toLowerCase(), updated);

  saveSpriteConfigsToStorage();
  return updated;
}

/**
 * Returns all custom registered servant sprite configs.
 */
export function getAllServantSpriteConfigs(): ServantSpriteConfig[] {
  const unique = new Map<string, ServantSpriteConfig>();
  for (const item of inMemorySpriteConfigs.values()) {
    unique.set(item.servantId.toLowerCase(), item);
  }
  return Array.from(unique.values());
}

/**
 * Removes custom sprite config for a servant.
 */
export function removeServantSpriteConfig(servantIdOrName: string): boolean {
  const existing = getServantSpriteConfig(servantIdOrName);
  if (!existing) return false;

  inMemorySpriteConfigs.delete(existing.servantId.toLowerCase());
  inMemorySpriteConfigs.delete(existing.servantName.toLowerCase());
  saveSpriteConfigsToStorage();
  return true;
}

// In browser, initialize from localStorage
if (typeof window !== 'undefined') {
  loadSpriteConfigsFromStorage();
}
