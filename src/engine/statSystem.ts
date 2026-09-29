import { MasterServantInstance, StatBalanceMode } from '../types';
import { allocateStatPoints, MAX_SERVANT_LEVEL } from './customization';

export { allocateStatPoints };

export const FLAT_BASELINE_HP = 28000;
export const FLAT_BASELINE_ATK = 10000;

// ==========================================
// LEVEL & STAT ENHANCEMENT CAPS
// ==========================================
export const MAX_STAT_PARAMETER = 1000;       // Max allocatable stat points per parameter (1,000 Cap)
export const MAX_MASTER_LEVEL = 500;           // Max Master level

/**
 * Returns the maximum level cap for a Servant instance (Level 500 max cap).
 * Leveling is simple: direct EXP gain up to Level 500.
 */
export function getServantMaxLevel(_servant?: MasterServantInstance | any): number {
  return MAX_SERVANT_LEVEL; // 500
}

/**
 * Calculates a Servant's maximum HP based on base HP, endurance allocation, and equipped Craft Essence.
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

  return baseHp + (end * 150) + ceHp;
}

/**
 * Calculates a Servant's maximum ATK based on base ATK, strength allocation, and equipped Craft Essence.
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

  return baseAtk + (str * 80) + ceAtk;
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
