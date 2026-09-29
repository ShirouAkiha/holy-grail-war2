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
// CONSTANTS & CAPS
// ==========================================
export const MAX_STAT_VALUE = 1000; // 1000 Max Cap for each attribute
export const MAX_SERVANT_LEVEL = 500; // Level 500 Cap
export const STAT_POINTS_PER_LEVEL = 10; // +10 points earned per level up

// ==========================================
// 1. STAT POINT ALLOCATION ENGINE
// ==========================================
// Validates that the requested point allocation does not exceed available unspent points,
// enforces the 1000 max cap on every attribute (STR, END, AGI, MNA, LCK),
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

  const currentAllocated = servant.allocatedStats || {
    strength: 0,
    endurance: 0,
    agility: 0,
    mana: 0,
    luck: 0
  };

  const statKeys: (keyof ServantStats)[] = ['strength', 'endurance', 'agility', 'mana', 'luck'];

  // Check stat limit (1000 max for each attribute)
  for (const key of statKeys) {
    const addVal = statsToAdd[key] || 0;
    if (addVal < 0) {
      throw new Error(`Cannot allocate negative points for ${key}.`);
    }
    const currentVal = currentAllocated[key] || 0;
    if (currentVal + addVal > MAX_STAT_VALUE) {
      const allowed = Math.max(0, MAX_STAT_VALUE - currentVal);
      throw new Error(
        `Attribute ${key.toUpperCase()} cannot exceed the omnipotence cap of ${MAX_STAT_VALUE} points (Current: ${currentVal}, Max addable: ${allowed}).`
      );
    }
  }

  const totalCost =
    (statsToAdd.strength || 0) +
    (statsToAdd.endurance || 0) +
    (statsToAdd.agility || 0) +
    (statsToAdd.mana || 0) +
    (statsToAdd.luck || 0);

  // Validate budget
  if (totalCost > (servant.availableStatPoints || 0)) {
    throw new Error(`Cannot allocate ${totalCost} points. Only ${servant.availableStatPoints || 0} available.`);
  }

  const updatedAllocated: ServantStats = {
    strength: (currentAllocated.strength || 0) + (statsToAdd.strength || 0),
    endurance: (currentAllocated.endurance || 0) + (statsToAdd.endurance || 0),
    agility: (currentAllocated.agility || 0) + (statsToAdd.agility || 0),
    mana: (currentAllocated.mana || 0) + (statsToAdd.mana || 0),
    luck: (currentAllocated.luck || 0) + (statsToAdd.luck || 0)
  };

  return {
    ...servant,
    allocatedStats: updatedAllocated,
    availableStatPoints: (servant.availableStatPoints || 0) - totalCost
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
// Supports full scale up to 1000 max points (Omnipotence).
export function calculateRadarCoordinates(
  stats: ServantStats,
  centerX: number = 100,
  centerY: number = 100,
  maxRadius: number = 80,
  maxStatValue: number = MAX_STAT_VALUE
): { points: RadarPoint[]; polygonString: string } {
  const statKeys: Array<{ key: keyof ServantStats; label: string }> = [
    { key: 'strength', label: 'STR' },
    { key: 'endurance', label: 'END' },
    { key: 'agility', label: 'AGI' },
    { key: 'mana', label: 'MNA' },
    { key: 'luck', label: 'LCK' }
  ];

  // Dynamically resolve scale: if user passes explicit maxStatValue use it,
  // otherwise scale gracefully with an adaptive ceiling so small stats (e.g. 10) look great
  // while high stats (up to 1000) fill the pentagon appropriately.
  const highestStat = Math.max(1, ...statKeys.map(k => stats[k.key] || 0));
  const effectiveMax = maxStatValue === MAX_STAT_VALUE
    ? (highestStat <= 30 ? 30 : highestStat <= 100 ? 100 : highestStat <= 500 ? 500 : MAX_STAT_VALUE)
    : maxStatValue;

  const totalAxes = statKeys.length;
  const points: RadarPoint[] = statKeys.map((item, index) => {
    // Offset angle by -90 deg (-Math.PI/2) so STR points vertically upwards
    const angle = (Math.PI * 2 / totalAxes) * index - Math.PI / 2;
    const value = Math.min(MAX_STAT_VALUE, Math.max(1, stats[item.key] || 1));
    const ratio = Math.min(1, value / effectiveMax);
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
 * Returns the EXP amount provided by a Craft Essence based on its rarity or explicit expValue.
 */
export function getCeExpValue(ce: { rarity?: number; expValue?: number }): number {
  if (ce?.expValue && ce.expValue > 0) return ce.expValue;
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
 * Capped at MAX_SERVANT_LEVEL (Level 500).
 */
export function calculateLevelFromExp(totalExp: number, maxLevel: number = MAX_SERVANT_LEVEL): {
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
 * Feeds a list of Craft Essences to a Servant, granting EXP, increasing level (up to Lv. 500),
 * and awarding +10 stat points for every level gained.
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

  const oldLevel = Math.min(MAX_SERVANT_LEVEL, servant.level || 1);
  const currentExp = servant.experience ?? getTotalExpForLevel(oldLevel);
  const newTotalExp = currentExp + totalExpGained;
  const { level: newLevel } = calculateLevelFromExp(newTotalExp, MAX_SERVANT_LEVEL);
  const levelsGained = Math.max(0, newLevel - oldLevel);
  const statPointsGained = levelsGained * STAT_POINTS_PER_LEVEL;

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

// ==========================================
// 6. BATTLE LEVEL EXP ENGINE
// ==========================================

export interface BattleExpResult {
  updatedServant: MasterServantInstance;
  expGained: number;
  oldLevel: number;
  newLevel: number;
  levelsGained: number;
  statPointsGained: number;
  didLevelUp: boolean;
  oldTotalExp: number;
  newTotalExp: number;
}

/**
 * Awards Level EXP to a Servant from combat (Duels, Sparring, Patrols, Grail War).
 * Increases Servant level up to Level 500 and awards +10 unspent Stat Points on every level up!
 */
export function addServantBattleExp(
  servant: MasterServantInstance,
  battleExp: number
): BattleExpResult {
  const oldLevel = Math.min(MAX_SERVANT_LEVEL, servant.level || 1);
  const currentExp = servant.experience ?? getTotalExpForLevel(oldLevel);
  const newTotalExp = currentExp + battleExp;
  const { level: newLevel } = calculateLevelFromExp(newTotalExp, MAX_SERVANT_LEVEL);
  const levelsGained = Math.max(0, newLevel - oldLevel);
  const statPointsGained = levelsGained * STAT_POINTS_PER_LEVEL;

  const updatedServant: MasterServantInstance = {
    ...servant,
    level: newLevel,
    experience: newTotalExp,
    availableStatPoints: (servant.availableStatPoints || 0) + statPointsGained
  };

  return {
    updatedServant,
    expGained: battleExp,
    oldLevel,
    newLevel,
    levelsGained,
    statPointsGained,
    didLevelUp: levelsGained > 0,
    oldTotalExp: currentExp,
    newTotalExp
  };
}

// ==========================================
// 7. SERVANT RESPEC & RECLAMATION ENGINE
// ==========================================

export interface RespecResult {
  updatedServant: MasterServantInstance;
  refundedPoints: number;
  newAvailablePoints: number;
}

/**
 * Type A Reset: Stat Respec (Reallocate Points)
 * Resets allocated STR, END, AGI, MNA, LCK back to 0 and refunds all points
 * into the Servant's availableStatPoints pool.
 */
export function respecServantStats(servant: MasterServantInstance): RespecResult {
  const allocated = servant.allocatedStats || { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 };
  const refundedPoints =
    (allocated.strength || 0) +
    (allocated.endurance || 0) +
    (allocated.agility || 0) +
    (allocated.mana || 0) +
    (allocated.luck || 0);

  const updatedServant: MasterServantInstance = {
    ...servant,
    allocatedStats: {
      strength: 0,
      endurance: 0,
      agility: 0,
      mana: 0,
      luck: 0
    },
    availableStatPoints: (servant.availableStatPoints || 0) + refundedPoints
  };

  return {
    updatedServant,
    refundedPoints,
    newAvailablePoints: updatedServant.availableStatPoints
  };
}

export interface ReclaimResult {
  updatedServant: MasterServantInstance;
  updatedCraftEssences: any[];
  refundedExp: number;
  embersGenerated: {
    ssrCount: number; // ★5 Blaze of Wisdom (+10,000 EXP)
    srCount: number;  // ★4 Blaze of Wisdom (+3,000 EXP)
    rCount: number;   // ★3 Spark of Wisdom (+1,000 EXP)
    totalEmbers: number;
  };
  oldLevel: number;
  oldAllocatedStats: ServantStats;
  oldStatPoints: number;
}

/**
 * Creates a universal EXP Ember Craft Essence that can be fed to any Servant.
 */
export function createExpEmberCraftEssence(rarity: 5 | 4 | 3, countIndex: number): any {
  const timestamp = Date.now();
  if (rarity === 5) {
    return {
      id: `ce_ember_ssr_${timestamp}_${countIndex}_${Math.random().toString(36).substring(2, 6)}`,
      name: 'Blaze of Wisdom (★5 SSR)',
      rarity: 5,
      atkBonus: 500,
      hpBonus: 500,
      expValue: 10000,
      description: 'A crystallized pinnacle of heroic experience. Bestows +10,000 EXP when synthesized.',
      effectText: 'Universal EXP Relic: +10,000 Synthesis EXP',
      cardArtUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
      isEmber: true
    };
  } else if (rarity === 4) {
    return {
      id: `ce_ember_sr_${timestamp}_${countIndex}_${Math.random().toString(36).substring(2, 6)}`,
      name: 'Blaze of Wisdom (★4 SR)',
      rarity: 4,
      atkBonus: 300,
      hpBonus: 300,
      expValue: 3000,
      description: 'A concentrated crystal of saint graph energy. Bestows +3,000 EXP when synthesized.',
      effectText: 'Universal EXP Relic: +3,000 Synthesis EXP',
      cardArtUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
      isEmber: true
    };
  } else {
    return {
      id: `ce_ember_r_${timestamp}_${countIndex}_${Math.random().toString(36).substring(2, 6)}`,
      name: 'Spark of Wisdom (★3 R)',
      rarity: 3,
      atkBonus: 100,
      hpBonus: 100,
      expValue: 1000,
      description: 'A luminous fragment of mana. Bestows +1,000 EXP when synthesized.',
      effectText: 'Universal EXP Relic: +1,000 Synthesis EXP',
      cardArtUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
      isEmber: true
    };
  }
}

/**
 * Type B Reset: Complete Level & EXP Extraction (De-level to Lv. 1)
 * Extracts all accumulated level EXP as Universal EXP Embers (Blaze of Wisdom)
 * which are deposited directly into the Master's inventory and can be fed to ANY Servant.
 * 
 * Retains 100% of:
 * - Bond Level & Bond EXP
 * - NP Level
 * - Completed Bond Events & Visual Novel scenes
 * - Custom voice lines, nicknames, avatar & artwork
 * - Servant roster covenant
 */
export function reclaimServantLevelAndExp(
  servant: MasterServantInstance,
  masterCraftEssences: any[]
): ReclaimResult {
  const oldLevel = servant.level || 1;
  const currentExp = servant.experience ?? getTotalExpForLevel(oldLevel);

  if (oldLevel <= 1 && currentExp <= 0) {
    throw new Error('This Servant is already at Level 1 with no synthesized EXP to extract.');
  }

  const oldAllocatedStats = { ...(servant.allocatedStats || { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 }) };
  const oldStatPoints = servant.availableStatPoints || 0;

  // Calculate embers to mint from accumulated EXP
  let remainingExp = currentExp;
  const ssrCount = Math.floor(remainingExp / 10000);
  remainingExp %= 10000;

  const srCount = Math.floor(remainingExp / 3000);
  remainingExp %= 3000;

  const rCount = remainingExp > 0 ? Math.ceil(remainingExp / 1000) : 0;

  const newEmbers: any[] = [];
  let idx = 0;
  for (let i = 0; i < ssrCount; i++) newEmbers.push(createExpEmberCraftEssence(5, idx++));
  for (let i = 0; i < srCount; i++) newEmbers.push(createExpEmberCraftEssence(4, idx++));
  for (let i = 0; i < rCount; i++) newEmbers.push(createExpEmberCraftEssence(3, idx++));

  // Reset Servant to Level 1, 0 EXP, 0 available points, 0 allocated stats.
  // Bond, NP Level, Nickname, custom quotes, avatar, sprite, template are 100% PRESERVED!
  const updatedServant: MasterServantInstance = {
    ...servant,
    level: 1,
    experience: 0,
    availableStatPoints: 0,
    allocatedStats: {
      strength: 0,
      endurance: 0,
      agility: 0,
      mana: 0,
      luck: 0
    },
    equippedCeId: undefined,
    equippedCe: undefined
  };

  const currentInventory = (masterCraftEssences || []).filter(Boolean);
  const updatedCraftEssences = [...currentInventory, ...newEmbers];

  return {
    updatedServant,
    updatedCraftEssences,
    refundedExp: currentExp,
    embersGenerated: {
      ssrCount,
      srCount,
      rCount,
      totalEmbers: newEmbers.length
    },
    oldLevel,
    oldAllocatedStats,
    oldStatPoints
  };
}


