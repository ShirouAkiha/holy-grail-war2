import type { ServantSpriteConfig } from '../types';
import {
  DEFAULT_SERVANT_SPRITE_CONFIGS,
  normalizeSpriteServantId
} from '../../src/utils/spriteConfig';

export { DEFAULT_SERVANT_SPRITE_CONFIGS, normalizeSpriteServantId };

const LOCAL_STORAGE_KEY = 'fgo_servant_sprite_configs';
export const SPRITE_CONFIG_UPDATE_EVENT = 'servant_sprite_configs_updated';

function getStorageSafe(): Record<string, ServantSpriteConfig> | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch (err) {
    console.warn('Could not read sprite configs from localStorage:', err);
  }
  return null;
}

function saveStorageSafe(configs: Record<string, ServantSpriteConfig>) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(configs));
  } catch (err) {
    console.warn('Could not save sprite configs to localStorage:', err);
  }
}

/**
 * Retrieves effective sprite config for client-side rendering.
 */
export function getServantSpriteConfig(servantIdOrName?: string): ServantSpriteConfig {
  const norm = normalizeSpriteServantId(servantIdOrName);
  const stored = getStorageSafe();
  if (stored && stored[norm]) {
    return { ...stored[norm] };
  }
  if (DEFAULT_SERVANT_SPRITE_CONFIGS[norm]) {
    return { ...DEFAULT_SERVANT_SPRITE_CONFIGS[norm] };
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
 * Sets and persists a sprite configuration, notifying all components via custom event.
 */
export function saveServantSpriteConfig(config: ServantSpriteConfig): ServantSpriteConfig {
  const norm = normalizeSpriteServantId(config.servantId);
  const existing = getServantSpriteConfig(norm);
  const updated: ServantSpriteConfig = {
    ...existing,
    ...config,
    servantId: norm
  };

  const current = getStorageSafe() || { ...DEFAULT_SERVANT_SPRITE_CONFIGS };
  current[norm] = updated;
  saveStorageSafe(current);

  // Sync to backend API asynchronously
  if (typeof window !== 'undefined') {
    fetch('/api/servants/sprites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set', config: updated })
    }).catch(err => console.warn('Could not sync sprite config to server API:', err));

    // Dispatch custom event for real-time reactivity in open modals & canvas
    try {
      window.dispatchEvent(new CustomEvent(SPRITE_CONFIG_UPDATE_EVENT, { detail: updated }));
    } catch {}
  }

  return updated;
}

/**
 * Resets a servant's config to default recommended values.
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
  return saveServantSpriteConfig(recommended);
}

/**
 * Returns all sprite configs (merged defaults + localStorage).
 */
export function getAllServantSpriteConfigs(): ServantSpriteConfig[] {
  const stored = getStorageSafe();
  const merged: Record<string, ServantSpriteConfig> = { ...DEFAULT_SERVANT_SPRITE_CONFIGS };
  if (stored) {
    for (const [k, v] of Object.entries(stored)) {
      merged[k] = { ...merged[k], ...v };
    }
  }
  return Object.values(merged);
}
