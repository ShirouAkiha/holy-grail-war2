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
 * Resolves canonical Fate Parameter Rank from a base stat score (10-22 scale) or string.
 */
export function getParameterRankFromBase(baseValue: number | string): string {
  if (typeof baseValue === 'string') {
    const upper = baseValue.trim().toUpperCase();
    if (upper.includes('EX')) return 'EX';
    if (upper.includes('A+') || upper.includes('A++') || upper.includes('A+++')) return 'A+';
    if (upper.startsWith('A')) return 'A';
    if (upper.includes('B+')) return 'B+';
    if (upper.startsWith('B')) return 'B';
    if (upper.startsWith('C')) return 'C';
    if (upper.startsWith('D')) return 'D';
    if (upper.startsWith('E')) return 'E';
    const num = parseFloat(baseValue);
    if (!isNaN(num)) return getParameterRankFromBase(num);
    return 'C';
  }

  if (baseValue >= 20) return 'EX';
  if (baseValue >= 18) return 'A';
  if (baseValue >= 16) return 'B';
  if (baseValue >= 14) return 'C';
  if (baseValue >= 12) return 'D';
  return 'E';
}

/**
 * Parameter Rank Aptitude Multiplier System:
 * Scales returns from allocated points based on natural Servant aptitude/rank:
 * - EX: 1.45x (Transcendent return)
 * - A+ / A: 1.30x - 1.35x (Powerhouse fortress)
 * - B+ / B: 1.15x - 1.20x (Above average proficiency)
 * - C: 1.00x (Baseline standard)
 * - D: 0.85x (Below average specialization)
 * - E: 0.75x (Frail / poor aptitude)
 */
export function getParameterRankMultiplier(rankOrBase: string | number): number {
  const rank = typeof rankOrBase === 'number' ? getParameterRankFromBase(rankOrBase) : rankOrBase.toUpperCase();
  if (rank.includes('EX')) return 1.45;
  if (rank.includes('A+')) return 1.35;
  if (rank.startsWith('A')) return 1.30;
  if (rank.includes('B+')) return 1.20;
  if (rank.startsWith('B')) return 1.15;
  if (rank.startsWith('C')) return 1.00;
  if (rank.startsWith('D')) return 0.85;
  if (rank.startsWith('E')) return 0.75;
  return 1.00;
}

/**
 * Computes native damage reduction percentage based on effective Endurance (diminishing-returns curve, max 50%).
 */
export function getEnduranceDamageReductionPercent(effectiveEndurance: number): number {
  if (effectiveEndurance <= 0) return 0;
  return Math.min(50, (effectiveEndurance / (effectiveEndurance + 800)) * 50);
}

/**
 * Calculates a Servant's maximum HP based on base HP, endurance allocation, and equipped Craft Essence.
 * Includes rank-based aptitude scaling, 300 HP/effective END, and percentage resilience scaling.
 */
export function calculateServantMaxHp(
  servant: MasterServantInstance | any,
  balanceMode: StatBalanceMode = 'archetype'
): number {
  if (!servant) return FLAT_BASELINE_HP;
  const baseHp = balanceMode === 'flat'
    ? FLAT_BASELINE_HP
    : (servant.template?.baseHp || servant.baseHp || FLAT_BASELINE_HP);

  const t = servant.template || servant;
  const baseEnd = t.baseStats?.endurance || 10;
  const allocEnd = servant.allocatedStats?.endurance || 0;
  const endMult = balanceMode === 'flat' ? 1.0 : getParameterRankMultiplier(baseEnd);
  const effectiveEnd = (baseEnd || 10) + Math.round(allocEnd * endMult);

  const ceHp = servant.equippedCe?.hpBonus || 0;

  // Upgraded formula: 300 HP per effective Endurance + percentage resilience scaling
  const rawHp = baseHp + (effectiveEnd * 300) + ceHp;
  const resilienceBonus = (effectiveEnd / 1000) * 0.25; // Up to +25% at 1000 effective END
  return Math.round(rawHp * (1 + resilienceBonus));
}

/**
 * Calculates a Servant's maximum ATK based on base ATK, strength allocation, and equipped Craft Essence.
 * Includes rank-based aptitude scaling.
 */
export function calculateServantMaxAtk(
  servant: MasterServantInstance | any,
  balanceMode: StatBalanceMode = 'archetype'
): number {
  if (!servant) return FLAT_BASELINE_ATK;
  const baseAtk = balanceMode === 'flat'
    ? FLAT_BASELINE_ATK
    : (servant.template?.baseAtk || servant.baseAtk || FLAT_BASELINE_ATK);

  const t = servant.template || servant;
  const baseStr = t.baseStats?.strength || 10;
  const allocStr = servant.allocatedStats?.strength || 0;
  const strMult = balanceMode === 'flat' ? 1.0 : getParameterRankMultiplier(baseStr);
  const effectiveStr = (baseStr || 10) + Math.round(allocStr * strMult);

  const ceAtk = servant.equippedCe?.atkBonus || 0;

  return Math.round(baseAtk + (effectiveStr * 80) + ceAtk);
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
