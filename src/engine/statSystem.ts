import { MasterServantInstance, StatBalanceMode } from '../types';
import { allocateStatPoints } from './customization';

export { allocateStatPoints };

export const FLAT_BASELINE_HP = 28000;
export const FLAT_BASELINE_ATK = 10000;

// ==========================================
// LEVEL & STAT ENHANCEMENT CAPS
// ==========================================
export const MAX_GRAIL_LEVEL = 100;           // Standard Holy Grail Palingenesis Cap
export const MAX_SUPER_GRAIL_LEVEL = 120;     // Grand Palingenesis (New Modern FGO Cap!)
export const MAX_STAT_PARAMETER = 150;        // Max allocatable stat points per parameter (STR/END/AGI/MNA/LCK)
export const MAX_SILVER_FOU = 1000;           // Silver Fou (+1,000 HP / +1,000 ATK)
export const MAX_GOLDEN_FOU = 2000;           // Golden Fou (+2,000 HP / +2,000 ATK Grand Cap!)
export const MAX_FOU_PAWS = 500;              // Beast Footprints (+500 per Command Card)
export const MAX_BOND_CAP = 15;               // Chaldean Visionary Flame Bond Cap (Bond 11-15 with 30 SQ rewards)
export const MAX_MASTER_LEVEL = 160;          // Max Master level

/**
 * Returns the natural un-grailed base level cap for a Servant based on rarity.
 */
export function getBaseMaxLevel(rarity: number = 5): number {
  switch (rarity) {
    case 1: return 60;
    case 2: return 65;
    case 3: return 70;
    case 4: return 80;
    case 5:
    default: return 90;
  }
}

/**
 * Resolves the active maximum level cap for a Servant instance,
 * accounting for natural rarity cap, Holy Grail Palingenesis (Lv 100),
 * and Grand Palingenesis (Lv 120).
 */
export function getServantMaxLevel(servant: MasterServantInstance | any): number {
  if (!servant) return 90;
  if (servant.maxLevel && servant.maxLevel >= 60) {
    return Math.min(MAX_SUPER_GRAIL_LEVEL, servant.maxLevel);
  }
  const rarity = servant.template?.rarity || servant.rarity || 5;
  const baseCap = getBaseMaxLevel(rarity);

  if (servant.grailCount && servant.grailCount > 0) {
    // Each grail to 100 adds +2 or +5 levels. Above 100, each grail adds +2 levels up to 120.
    const grailedCap = baseCap < 90
      ? Math.min(90, baseCap + servant.grailCount * 5)
      : Math.min(100, 90 + servant.grailCount * 2);
    
    if (servant.grailCount > 5 && grailedCap >= 100) {
      return Math.min(MAX_SUPER_GRAIL_LEVEL, 100 + (servant.grailCount - 5) * 2);
    }
    return Math.min(MAX_SUPER_GRAIL_LEVEL, grailedCap);
  }

  return baseCap;
}

/**
 * Calculates a Servant's maximum HP based on the active balance mode,
 * including Level 100-120 Grand Scaling, Fou Enhancements (+2,000 HP cap),
 * and Craft Essences.
 */
export function calculateServantMaxHp(
  servant: MasterServantInstance | any,
  balanceMode: StatBalanceMode = 'archetype'
): number {
  if (!servant) return FLAT_BASELINE_HP;
  const baseHp = balanceMode === 'flat'
    ? FLAT_BASELINE_HP
    : (servant.template?.baseHp || servant.baseHp || FLAT_BASELINE_HP);

  const end = servant.allocatedStats?.endurance || 0;
  const ceHp = servant.equippedCe?.hpBonus || 0;
  const fouHp = Math.min(MAX_GOLDEN_FOU, Math.max(0, servant.fouHp || 0));
  
  // Super-Grail Level 101-120 bonus scaling (+120 HP per level above 100)
  const currentLvl = servant.level || 1;
  const superGrailHpBonus = currentLvl > 100 ? (currentLvl - 100) * 120 : 0;

  return baseHp + (end * 200) + ceHp + fouHp + superGrailHpBonus;
}

/**
 * Calculates a Servant's maximum ATK based on the active balance mode,
 * including Level 100-120 Grand Scaling, Fou Enhancements (+2,000 ATK cap),
 * and Craft Essences.
 */
export function calculateServantMaxAtk(
  servant: MasterServantInstance | any,
  balanceMode: StatBalanceMode = 'archetype'
): number {
  if (!servant) return FLAT_BASELINE_ATK;
  const baseAtk = balanceMode === 'flat'
    ? FLAT_BASELINE_ATK
    : (servant.template?.baseAtk || servant.baseAtk || FLAT_BASELINE_ATK);

  const str = servant.allocatedStats?.strength || 0;
  const ceAtk = servant.equippedCe?.atkBonus || 0;
  const fouAtk = Math.min(MAX_GOLDEN_FOU, Math.max(0, servant.fouAtk || 0));

  // Super-Grail Level 101-120 bonus scaling (+80 ATK per level above 100)
  const currentLvl = servant.level || 1;
  const superGrailAtkBonus = currentLvl > 100 ? (currentLvl - 100) * 80 : 0;

  return baseAtk + (str * 150) + ceAtk + fouAtk + superGrailAtkBonus;
}

/**
 * Convenience helper to resolve both HP and ATK for a given servant and balance mode.
 */
export function getServantEffectiveStats(
  servant: MasterServantInstance | any,
  balanceMode: StatBalanceMode = 'archetype'
): { hp: number; atk: number; balanceMode: StatBalanceMode } {
  return {
    hp: calculateServantMaxHp(servant, balanceMode),
    atk: calculateServantMaxAtk(servant, balanceMode),
    balanceMode
  };
}
