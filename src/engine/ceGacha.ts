import { CraftEssence, GachaResultItem, MasterProfile, Rarity, ServantTemplate, MasterServantInstance } from '../types';
import { getAllCraftEssences, getActiveGachaBanner, getAllThroneServants } from '../database/service';
import { createProjectedServantInstance } from './saintGraphProjection';

export interface RollGachaOptions {
  count: 1 | 10;
  master: MasterProfile;
  bannerId?: string;
  useTickets?: boolean;
}

export interface UnifiedGachaResultItem extends GachaResultItem {
  type: 'servant' | 'craft_essence';
  rarity: Rarity;
  item: any;
  servant?: ServantTemplate;
  isNew: boolean;
  manaPrismsAwarded?: number;
  isRateUp?: boolean;
}

export interface UnifiedGachaPullResponse {
  results: UnifiedGachaResultItem[];
  spentQuartz: number;
  spentTickets: number;
  updatedMaster: MasterProfile;
  servantsPulled: number;
  cesPulled: number;
  ssrsPulled: number;
  srsPulled: number;
  newServantsCount: number;
  newCeCount: number;
  totalManaPrismsAwarded: number;
}

// Backward compatibility types
export type ServantGachaPullResult = UnifiedGachaResultItem;
export type ServantGachaPullResponse = UnifiedGachaPullResponse;
export type CeGachaPullResponse = UnifiedGachaPullResponse;
export type RollCeGachaOptions = RollGachaOptions;

/**
 * Executes a Unified Greater Grail Gacha roll combining Servants and Craft Essences.
 * 
 * Rules:
 * - 10x Multi-Summon: Exactly 5 Servants (50%) and 5 Craft Essences (50%).
 * - 1x Single Summon: 50% chance for Servant, 50% chance for Craft Essence.
 * - Craft Essence 5★ SSR pull rate: strictly 1.0% (Kaleidoscope, Black Grail, etc.).
 * - Craft Essence 4★ SR pull rate: 19.0% (guaranteed at least one 4★+ CE in 10-pull).
 * - Craft Essence 3★ R pull rate: 80.0%.
 * - Heroic Spirits: Equalized Throne of Heroes roster. New Servants are permanently contracted.
 *   Duplicates award +50 Mana Prisms, +5 stat points, and NP upgrades.
 */
export function executeUnifiedGachaRoll({
  count,
  master,
  useTickets = false
}: RollGachaOptions): UnifiedGachaPullResponse {
  let spentQuartz = 0;
  let spentTickets = 0;

  if (useTickets) {
    const ticketCost = count;
    if ((master.summonTickets || 0) < ticketCost) {
      throw new Error(`Insufficient Summon Tickets! You need ${ticketCost} Ticket(s) 🎫, but only have ${master.summonTickets || 0} Tickets.`);
    }
    spentTickets = ticketCost;
  } else {
    const cost = count === 10 ? 30 : 3;
    if ((master.saintQuartz || 0) < cost) {
      throw new Error(`Insufficient Saint Quartz! You need ${cost} SQ 💎, but only have ${master.saintQuartz || 0} SQ.`);
    }
    spentQuartz = cost;
  }

  const allServants = getAllThroneServants();
  if (!allServants || allServants.length === 0) {
    throw new Error('The Throne of Heroes is currently silent. No Heroic Spirits available.');
  }

  const banner = getActiveGachaBanner();
  const allCes = getAllCraftEssences().filter(c => !c.isBondCe);
  const ssrCes = allCes.filter(c => c.rarity === 5);
  const srCes = allCes.filter(c => c.rarity === 4);
  const rCes = allCes.filter(c => c.rarity === 3);

  const ownedTemplateIds = new Set((master.servants || []).map(s => s.templateId || s.id));
  const newServantsList: MasterServantInstance[] = [...(master.servants || [])];
  const initialCeIds = new Set((master.craftEssences || []).map(c => c.id));
  const newMasterCraftEssences = [...(master.craftEssences || [])];

  let newServantsCount = 0;
  let totalManaPrismsAwarded = 0;
  let ssrsPulled = 0;
  let srsPulled = 0;
  let newCeCount = 0;
  let servantsPulled = 0;
  let cesPulled = 0;
  const pulledServantsInThisRoll = new Set<string>();

  const pullServant = (): UnifiedGachaResultItem => {
    servantsPulled++;
    let randomTemplate = allServants[Math.floor(Math.random() * allServants.length)];
    let attempts = 0;
    while (pulledServantsInThisRoll.has(randomTemplate.id) && attempts < 10) {
      randomTemplate = allServants[Math.floor(Math.random() * allServants.length)];
      attempts++;
    }
    pulledServantsInThisRoll.add(randomTemplate.id);
    const isAlreadyOwned = ownedTemplateIds.has(randomTemplate.id);

    if (!isAlreadyOwned) {
      const newInstance = createProjectedServantInstance(master, randomTemplate);
      newServantsList.push(newInstance);
      ownedTemplateIds.add(randomTemplate.id);
      newServantsCount++;

      return {
        type: 'servant',
        rarity: 5,
        item: randomTemplate,
        servant: randomTemplate,
        isNew: true,
        manaPrismsAwarded: 0
      };
    } else {
      totalManaPrismsAwarded += 50;
      // Upgrade existing servant
      const existing = newServantsList.find(s => (s.templateId || s.id) === randomTemplate.id);
      if (existing) {
        existing.availableStatPoints = (existing.availableStatPoints || 0) + 5;
        existing.npLevel = Math.min(5, (existing.npLevel || 1) + 1);
      }
      return {
        type: 'servant',
        rarity: 5,
        item: randomTemplate,
        servant: randomTemplate,
        isNew: false,
        manaPrismsAwarded: 50
      };
    }
  };

  const pullCraftEssence = (guaranteeFourStar: boolean = false): UnifiedGachaResultItem => {
    cesPulled++;
    let targetRarity: Rarity = 3;
    const roll = Math.random() * 100;

    // Pull rate of 5-star CE is strictly 1.0% as requested
    if (guaranteeFourStar) {
      // Guaranteed 4★ or higher: 1.0% for 5★, 99.0% for 4★
      targetRarity = roll < 1.0 ? 5 : 4;
    } else {
      // Normal pull: 1.0% for 5★ SSR, 19.0% for 4★ SR, 80.0% for 3★ R
      if (roll < 1.0) {
        targetRarity = 5;
      } else if (roll < 20.0) {
        targetRarity = 4;
      } else {
        targetRarity = 3;
      }
    }

    if (targetRarity === 5) ssrsPulled++;
    if (targetRarity === 4) srsPulled++;

    const pool = targetRarity === 5 ? ssrCes : targetRarity === 4 ? srCes : rCes;
    const featuredInPool = pool.filter(c => banner.featuredCeIds?.includes(c.id));

    let chosenCe: CraftEssence;
    let isRateUp = false;

    if (featuredInPool.length > 0 && Math.random() < 0.6) {
      chosenCe = featuredInPool[Math.floor(Math.random() * featuredInPool.length)];
      isRateUp = true;
    } else {
      chosenCe = pool[Math.floor(Math.random() * pool.length)];
    }

    const isFirstTime = !initialCeIds.has(chosenCe.id);
    if (isFirstTime) {
      initialCeIds.add(chosenCe.id);
      newCeCount++;
    }

    // Add to Master's CE inventory with unique instanceId & auto-lock 5★/Bond CEs
    const isFiveStarOrBond = targetRarity === 5 || chosenCe.rarity === 5 || chosenCe.isBondCe;
    const instance: CraftEssence = {
      ...chosenCe,
      instanceId: `ce_inst_${chosenCe.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      locked: isFiveStarOrBond ? true : (chosenCe.locked ?? false)
    };
    newMasterCraftEssences.push(instance);

    return {
      type: 'craft_essence',
      rarity: targetRarity,
      item: instance,
      isNew: isFirstTime,
      isRateUp
    };
  };

  const results: UnifiedGachaResultItem[] = [];

  if (count === 1) {
    // 1x Single Summon: 50% Servant, 50% Craft Essence
    if (Math.random() < 0.5) {
      results.push(pullServant());
    } else {
      results.push(pullCraftEssence(false));
    }
  } else {
    // 10x Multi-Summon: Exactly 5 Servants (50%) and 5 Craft Essences (50%)
    const servantPulls: UnifiedGachaResultItem[] = [];
    for (let i = 0; i < 5; i++) {
      servantPulls.push(pullServant());
    }

    const cePulls: UnifiedGachaResultItem[] = [];
    let hasFourStarOrHigherCe = false;
    for (let i = 0; i < 4; i++) {
      const ceItem = pullCraftEssence(false);
      if (ceItem.rarity >= 4) hasFourStarOrHigherCe = true;
      cePulls.push(ceItem);
    }
    // 5th CE guarantees 4★+ if none pulled yet among the first 4
    const lastCeItem = pullCraftEssence(!hasFourStarOrHigherCe);
    cePulls.push(lastCeItem);

    // Interleave: Servant, CE, Servant, CE, Servant, CE, Servant, CE, Servant, CE
    for (let i = 0; i < 5; i++) {
      results.push(servantPulls[i]);
      results.push(cePulls[i]);
    }
  }

  const updatedMaster: MasterProfile = {
    ...master,
    saintQuartz: Math.max(0, (master.saintQuartz || 0) - spentQuartz),
    summonTickets: Math.max(0, (master.summonTickets || 0) - spentTickets),
    manaPrisms: (master.manaPrisms || 0) + totalManaPrismsAwarded,
    servants: newServantsList,
    craftEssences: newMasterCraftEssences,
    activeServantId: master.activeServantId || (newServantsList[0] ? newServantsList[0].id : undefined)
  };

  return {
    results,
    spentQuartz,
    spentTickets,
    updatedMaster,
    servantsPulled,
    cesPulled,
    ssrsPulled,
    srsPulled,
    newServantsCount,
    newCeCount,
    totalManaPrismsAwarded
  };
}

/**
 * Universal wrapper aliases so any existing command or legacy call gets the unified 50/50 gacha
 */
export function executeServantGachaRoll(opts: RollGachaOptions): UnifiedGachaPullResponse {
  return executeUnifiedGachaRoll(opts);
}

export function executeCraftEssenceGachaRoll(opts: RollGachaOptions): UnifiedGachaPullResponse {
  return executeUnifiedGachaRoll(opts);
}
