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
  statsToAdd: Partial<ServantStats>
): MasterServantInstance {
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
    strength: (servant.allocatedStats.strength || 0) + (statsToAdd.strength || 0),
    endurance: (servant.allocatedStats.endurance || 0) + (statsToAdd.endurance || 0),
    agility: (servant.allocatedStats.agility || 0) + (statsToAdd.agility || 0),
    mana: (servant.allocatedStats.mana || 0) + (statsToAdd.mana || 0),
    luck: (servant.allocatedStats.luck || 0) + (statsToAdd.luck || 0)
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
