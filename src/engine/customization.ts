import { MasterServantInstance, ServantStats } from '../types';
import { CRAFT_ESSENCE_DATABASE } from '../data/craftEssences';
import { prisma } from '../database/service';

export interface DialogueQuotes {
  summonQuote?: string;
  battleStartQuote?: string;
  noblePhantasmQuote?: string;
  victoryQuote?: string;
  defeatQuote?: string;
}

// ==========================================
// 1. STAT POINT ALLOCATION ENGINE
// ==========================================
// Validates that the requested point allocation does not exceed available unspent points,
// then applies the stat increases and decrements the remaining point pool.
export function allocateStatPoints(
  servant: MasterServantInstance,
  statsToAddOrKey: Partial<ServantStats> | keyof ServantStats,
  amount: number = 1
): MasterServantInstance {
  const statsToAdd: Partial<ServantStats> =
    typeof statsToAddOrKey === 'string'
      ? { [statsToAddOrKey]: amount }
      : statsToAddOrKey;

  const totalCost =
    (statsToAdd.strength || 0) +
    (statsToAdd.endurance || 0) +
    (statsToAdd.agility || 0) +
    (statsToAdd.mana || 0) +
    (statsToAdd.luck || 0);

  // Validate budget
  if (totalCost > servant.availableStatPoints) {
    throw new Error(`Cannot allocate ${totalCost} points. Only ${servant.availableStatPoints} available.`);
  }

  const updatedAllocated: ServantStats = {
    strength: (servant.allocatedStats?.strength || 0) + (statsToAdd.strength || 0),
    endurance: (servant.allocatedStats?.endurance || 0) + (statsToAdd.endurance || 0),
    agility: (servant.allocatedStats?.agility || 0) + (statsToAdd.agility || 0),
    mana: (servant.allocatedStats?.mana || 0) + (statsToAdd.mana || 0),
    luck: (servant.allocatedStats?.luck || 0) + (statsToAdd.luck || 0)
  };

  return {
    ...servant,
    allocatedStats: updatedAllocated,
    availableStatPoints: servant.availableStatPoints - totalCost
  };
}

// ==========================================
// 2. CRAFT ESSENCE EQUIPMENT ENGINE
// ==========================================
// Binds or unbinds a Craft Essence to the Servant instance.
export function equipCraftEssence(
  servant: MasterServantInstance,
  craftEssenceId?: string
): MasterServantInstance {
  if (!craftEssenceId) {
    return {
      ...servant,
      equippedCeId: undefined,
      equippedCe: undefined
    };
  }

  const ce = CRAFT_ESSENCE_DATABASE.find((c: any) => c.id === craftEssenceId);
  if (!ce) {
    throw new Error('Craft Essence not found in database.');
  }

  return {
    ...servant,
    equippedCeId: ce.id,
    equippedCe: ce as any
  };
}

// ==========================================
// 3. DIALOGUE QUOTES ENGINE
// ==========================================
export function updateCustomDialogueQuotes(
  servant: MasterServantInstance,
  quotes: Partial<MasterServantInstance['customQuotes']>
): MasterServantInstance {
  return {
    ...servant,
    customQuotes: {
      ...servant.customQuotes,
      ...quotes
    }
  };
}

export interface RadarPoint {
  x: number;
  y: number;
  statName: string;
  value: number;
  label: string;
}

// ==========================================
// 4. RADAR CHART GEOMETRIC ENGINE
// ==========================================
// Calculates 5-axis pentagonal trigonometry coordinates (STR, END, AGI, MNA, LCK)
// for rendering the visual status radar polygon in Canvas or SVG.
export function calculateRadarCoordinates(
  stats: ServantStats,
  centerX: number = 100,
  centerY: number = 100,
  maxRadius: number = 80,
  maxStatValue: number = 30
): { points: RadarPoint[]; polygonString: string } {
  const statKeys: Array<{ key: keyof ServantStats; label: string }> = [
    { key: 'strength', label: 'STR' },
    { key: 'endurance', label: 'END' },
    { key: 'agility', label: 'AGI' },
    { key: 'mana', label: 'MNA' },
    { key: 'luck', label: 'LCK' }
  ];

  const totalAxes = statKeys.length;
  const points: RadarPoint[] = statKeys.map((item, index) => {
    // Offset angle by -90 deg (-Math.PI/2) so STR points vertically upwards
    const angle = (Math.PI * 2 / totalAxes) * index - Math.PI / 2;
    const value = Math.min(maxStatValue, Math.max(1, stats[item.key] || 1));
    const ratio = value / maxStatValue;
    const r = maxRadius * ratio;
    const x = centerX + r * Math.cos(angle);
    const y = centerY + r * Math.sin(angle);

    return {
      x,
      y,
      statName: item.key,
      value,
      label: item.label
    };
  });

  const polygonString = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return { points, polygonString };
}

// Database helper compatibility
export async function updateDialogueQuotesDB(inventoryId: string, quotes: DialogueQuotes) {
  try {
    return await (prisma as any).userInventory?.update({
      where: { id: inventoryId },
      data: { customDialogue: JSON.stringify(quotes) },
    });
  } catch {
    return null;
  }
}

// ==========================================
// 5. CRAFT ESSENCE FEEDING & EXP ENGINE
// ==========================================

export interface FeedResult {
  updatedServant: MasterServantInstance;
  remainingCraftEssences: any[];
  fedEssences: any[];
  consumedCount: number;
  expGained: number;
  oldLevel: number;
  newLevel: number;
  levelsGained: number;
  statPointsGained: number;
  oldTotalExp: number;
  newTotalExp: number;
}

/**
 * Returns the EXP amount provided by a Craft Essence based on its rarity.
 */
export function getCeExpValue(ce: { rarity?: number }): number {
  const r = ce?.rarity || 3;
  switch (r) {
    case 1:
      return 100;
    case 2:
      return 250;
    case 3:
      return 500;
    case 4:
      return 1200;
    case 5:
      return 3000;
    default:
      return Math.max(100, r * 400);
  }
}

/**
 * Calculates the EXP required to progress from `level` to `level + 1`.
 */
export function getExpForLevelStep(level: number): number {
  if (level <= 0) return 1000;
  return 1000 + (level - 1) * 500 + Math.floor(Math.pow(level, 1.5) * 50);
}

/**
 * Calculates the cumulative total EXP needed to reach a specific level starting from level 1.
 */
export function getTotalExpForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let l = 1; l < level; l++) {
    total += getExpForLevelStep(l);
  }
  return total;
}

/**
 * Determines a Servant's current level, remaining EXP, and progress towards the next level.
 */
export function calculateLevelFromExp(totalExp: number, maxLevel: number = 100): {
  level: number;
  currentLevelExp: number;
  nextLevelExp: number;
  progressPercent: number;
} {
  let level = 1;
  while (level < maxLevel) {
    const nextLevelReq = getExpForLevelStep(level);
    const currentBase = getTotalExpForLevel(level);
    if (totalExp < currentBase + nextLevelReq) {
      const currentLevelExp = Math.max(0, totalExp - currentBase);
      const progressPercent = Math.min(100, Math.floor((currentLevelExp / nextLevelReq) * 100));
      return { level, currentLevelExp, nextLevelExp: nextLevelReq, progressPercent };
    }
    level++;
  }
  return { level: maxLevel, currentLevelExp: 0, nextLevelExp: 0, progressPercent: 100 };
}

/**
 * Feeds a list of Craft Essences to a Servant, granting EXP, increasing level,
 * and awarding 10 stat points for every level gained.
 */
export function feedCraftEssences(
  servant: MasterServantInstance,
  ceIndicesOrIds: (string | number)[],
  masterCraftEssences: any[]
): FeedResult {
  if (!ceIndicesOrIds || ceIndicesOrIds.length === 0) {
    throw new Error('No Craft Essences selected for synthesis.');
  }

  const originalList = (masterCraftEssences || []).filter(Boolean);
  const consumedIndices = new Set<number>();
  const fedEssences: any[] = [];
  let totalExpGained = 0;

  for (const rawTarget of ceIndicesOrIds) {
    const targetStr = String(rawTarget).trim();
    const asNum = Number(targetStr);

    // If it's a valid original array index, consume that exact index
    if (!isNaN(asNum) && Number.isInteger(asNum) && asNum >= 0 && asNum < originalList.length && !consumedIndices.has(asNum)) {
      consumedIndices.add(asNum);
      const consumed = originalList[asNum];
      fedEssences.push(consumed);
      totalExpGained += getCeExpValue(consumed);
      continue;
    }

    // Otherwise match by exact ID, or name, among unconsumed items
    const matchIdx = originalList.findIndex((c: any, i: number) => {
      if (consumedIndices.has(i) || !c) return false;
      return c.id === targetStr || c.name?.toLowerCase() === targetStr.toLowerCase();
    });

    if (matchIdx !== -1) {
      consumedIndices.add(matchIdx);
      const consumed = originalList[matchIdx];
      fedEssences.push(consumed);
      totalExpGained += getCeExpValue(consumed);
    }
  }

  if (fedEssences.length === 0) {
    throw new Error('None of the selected Craft Essences were found in inventory.');
  }

  const remaining = originalList.filter((_, idx) => !consumedIndices.has(idx));

  const oldLevel = servant.level || 1;
  const currentExp = servant.experience ?? getTotalExpForLevel(oldLevel);
  const newTotalExp = currentExp + totalExpGained;
  const { level: newLevel } = calculateLevelFromExp(newTotalExp);
  const levelsGained = Math.max(0, newLevel - oldLevel);
  const statPointsGained = levelsGained * 10;

  // Un-equip if the equipped CE was consumed
  const consumedIds = new Set(fedEssences.map((c: any) => c.id));
  const isEquippedConsumed = servant.equippedCeId ? consumedIds.has(servant.equippedCeId) : false;

  const updatedServant: MasterServantInstance = {
    ...servant,
    level: newLevel,
    experience: newTotalExp,
    availableStatPoints: (servant.availableStatPoints || 0) + statPointsGained,
    equippedCeId: isEquippedConsumed ? undefined : servant.equippedCeId,
    equippedCe: isEquippedConsumed ? undefined : servant.equippedCe
  };

  return {
    updatedServant,
    remainingCraftEssences: remaining,
    fedEssences,
    consumedCount: fedEssences.length,
    expGained: totalExpGained,
    oldLevel,
    newLevel,
    levelsGained,
    statPointsGained,
    oldTotalExp: currentExp,
    newTotalExp
  };
}

