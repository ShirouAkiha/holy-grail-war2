import { MasterServantInstance, StatBalanceMode } from '../types';
import { allocateStatPoints } from './customization';

export { allocateStatPoints };

export const FLAT_BASELINE_HP = 28000;
export const FLAT_BASELINE_ATK = 10000;

/**
 * Calculates a Servant's maximum HP based on the active balance mode.
 * - 'archetype' (default): Parameter & Archetype Budget. Uses the servant's normalized canon-based HP.
 * - 'flat': Pure Parity Baseline. Every servant has identical 28,000 HP baseline.
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
  return baseHp + (end * 200) + ceHp;
}

/**
 * Calculates a Servant's maximum ATK based on the active balance mode.
 * - 'archetype' (default): Parameter & Archetype Budget. Uses the servant's normalized canon-based ATK.
 * - 'flat': Pure Parity Baseline. Every servant has identical 10,000 ATK baseline.
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
  return baseAtk + (str * 150) + ceAtk;
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
