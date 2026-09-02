import { CraftEssence, GachaBanner, GachaResultItem, MasterProfile, Rarity } from '../types';
import { CRAFT_ESSENCE_DATABASE, CE_GACHA_BANNERS } from '../data/craftEssences';

export interface RollCeGachaOptions {
  count: 1 | 10;
  master: MasterProfile;
  bannerId?: string;
}

export interface CeGachaPullResponse {
  results: GachaResultItem[];
  spentQuartz: number;
  updatedMaster: MasterProfile;
  ssrsPulled: number;
  srsPulled: number;
  newCeCount: number;
}

/**
 * Executes a Craft Essence Gacha roll using Saint Quartz.
 * 
 * Rates:
 * - 5★ SSR Craft Essence: 5% (e.g. Kaleidoscope, The Black Grail, Formal Craft, Limited/Zero Over)
 * - 4★ SR Craft Essence: 25% (e.g. The Imaginary Element, Gamer Fuel, Gandr)
 * - 3★ R Craft Essence: 70% (e.g. Dragon's Meridian, Jeweled Sword Zelretch)
 * 
 * 10-Pull Guarantee: At least one 4★ SR or higher Craft Essence guaranteed!
 */
export function executeCraftEssenceGachaRoll({
  count,
  master,
  bannerId
}: RollCeGachaOptions): CeGachaPullResponse {
  const banner = CE_GACHA_BANNERS.find(b => b.id === bannerId) || CE_GACHA_BANNERS[0];
  const cost = count === 10 ? banner.costTenPull : banner.costPerPull;

  if ((master.saintQuartz || 0) < cost) {
    throw new Error(`Insufficient Saint Quartz! You need ${cost} SQ 💎, but only have ${master.saintQuartz || 0} SQ.`);
  }

  const results: GachaResultItem[] = [];
  const initialCeIds = new Set((master.craftEssences || []).map(c => c.id));
  const newMasterCraftEssences = [...(master.craftEssences || [])];

  const ssrCes = CRAFT_ESSENCE_DATABASE.filter(c => c.rarity === 5);
  const srCes = CRAFT_ESSENCE_DATABASE.filter(c => c.rarity === 4);
  const rCes = CRAFT_ESSENCE_DATABASE.filter(c => c.rarity === 3);

  let ssrsPulled = 0;
  let srsPulled = 0;
  let newCeCount = 0;

  const pullSingleCe = (guaranteeFourStar: boolean = false): GachaResultItem => {
    let targetRarity: Rarity = 3;

    if (guaranteeFourStar) {
      const roll = Math.random() * 100;
      targetRarity = roll < 20 ? 5 : 4;
    } else {
      const roll = Math.random() * 100;
      if (roll < banner.rates.ssrCe) {
        targetRarity = 5;
      } else if (roll < banner.rates.ssrCe + banner.rates.srCe) {
        targetRarity = 4;
      } else {
        targetRarity = 3;
      }
    }

    if (targetRarity === 5) ssrsPulled++;
    if (targetRarity === 4) srsPulled++;

    const pool = targetRarity === 5 ? ssrCes : targetRarity === 4 ? srCes : rCes;
    const featuredInPool = pool.filter(c => banner.featuredCeIds.includes(c.id));
    
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

    newMasterCraftEssences.push({ ...chosenCe });

    return {
      type: 'craft_essence',
      rarity: targetRarity,
      item: chosenCe,
      isNew: isFirstTime,
      isRateUp
    };
  };

  if (count === 1) {
    results.push(pullSingleCe(false));
  } else {
    let hasFourStarOrHigher = false;
    for (let i = 0; i < 9; i++) {
      const item = pullSingleCe(false);
      if (item.rarity >= 4) hasFourStarOrHigher = true;
      results.push(item);
    }
    const tenthItem = pullSingleCe(!hasFourStarOrHigher);
    results.push(tenthItem);
  }

  const updatedMaster: MasterProfile = {
    ...master,
    saintQuartz: Math.max(0, (master.saintQuartz || 0) - cost),
    craftEssences: newMasterCraftEssences
  };

  return {
    results,
    spentQuartz: cost,
    updatedMaster,
    ssrsPulled,
    srsPulled,
    newCeCount
  };
}
