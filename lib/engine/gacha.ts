import { GachaBanner, GachaResultItem, MasterProfile, MasterServantInstance, Rarity } from '../types';
import { SERVANT_DATABASE } from '../data/servants';
import { CRAFT_ESSENCE_DATABASE } from '../data/craftEssences';

export interface RollGachaOptions {
  banner: GachaBanner;
  count: 1 | 10;
  master: MasterProfile;
}

export interface GachaPullResponse {
  results: GachaResultItem[];
  spentQuartz: number;
  newPityCount: number;
  updatedMaster: MasterProfile;
}

export function executeGachaRoll({ banner, count, master }: RollGachaOptions): GachaPullResponse {
  const cost = count === 10 ? banner.costTenPull : banner.costPerPull;
  if (master.saintQuartz < cost) {
    throw new Error(`Insufficient Saint Quartz! You need ${cost} SQ, but only have ${master.saintQuartz} SQ.`);
  }

  const results: GachaResultItem[] = [];
  let pity = master.pityCount;
  const updatedMaster: MasterProfile = {
    ...master,
    saintQuartz: master.saintQuartz - cost,
    servants: [...master.servants],
    craftEssences: [...master.craftEssences]
  };

  const ssrServants = SERVANT_DATABASE.filter(s => s.rarity === 5);
  const srServants = SERVANT_DATABASE.filter(s => s.rarity === 4);
  const rServants = SERVANT_DATABASE.filter(s => s.rarity === 3);

  const ssrCes = CRAFT_ESSENCE_DATABASE.filter(c => c.rarity === 5);
  const srCes = CRAFT_ESSENCE_DATABASE.filter(c => c.rarity === 4);
  const rCes = CRAFT_ESSENCE_DATABASE.filter(c => c.rarity === 3);

  const pullSingleItem = (forceFourStarOrAbove: boolean = false): GachaResultItem => {
    pity++;
    const roll = Math.random() * 100;

    // Hard pity at 90 rolls for SSR
    const isHardPity = pity >= 90;

    let targetRarity: Rarity = 3;
    let targetType: 'servant' | 'craft_essence' = 'servant';

    if (isHardPity || roll < banner.rates.ssrServant) {
      targetRarity = 5;
      targetType = 'servant';
      pity = 0; // reset pity
    } else if (roll < banner.rates.ssrServant + banner.rates.ssrCe) {
      targetRarity = 5;
      targetType = 'craft_essence';
    } else if (roll < banner.rates.ssrServant + banner.rates.ssrCe + banner.rates.srServant) {
      targetRarity = 4;
      targetType = 'servant';
    } else if (roll < banner.rates.ssrServant + banner.rates.ssrCe + banner.rates.srServant + banner.rates.srCe) {
      targetRarity = 4;
      targetType = 'craft_essence';
    } else if (forceFourStarOrAbove) {
      // Guaranteed 4-star fallback in 10-pull
      const subRoll = Math.random();
      targetRarity = 4;
      targetType = subRoll > 0.6 ? 'servant' : 'craft_essence';
    } else if (roll < banner.rates.ssrServant + banner.rates.ssrCe + banner.rates.srServant + banner.rates.srCe + banner.rates.rServant) {
      targetRarity = 3;
      targetType = 'servant';
    } else {
      targetRarity = 3;
      targetType = 'craft_essence';
    }

    if (targetType === 'servant') {
      let pool = targetRarity === 5 ? ssrServants : targetRarity === 4 ? srServants : rServants;
      // Filter if banner has featured rate-up
      const featuredInPool = pool.filter(s => banner.featuredServantIds.includes(s.id));
      let chosenServant = pool[Math.floor(Math.random() * pool.length)];
      let isRateUp = false;

      if (featuredInPool.length > 0 && Math.random() < 0.7) {
        chosenServant = featuredInPool[Math.floor(Math.random() * featuredInPool.length)];
        isRateUp = true;
      }

      const alreadyOwns = updatedMaster.servants.some(s => s.templateId === chosenServant.id);
      if (!alreadyOwns) {
        const newInstance: MasterServantInstance = {
          id: `servant_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          masterId: master.id,
          templateId: chosenServant.id,
          level: 1,
          experience: 0,
          allocatedStats: { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 },
          availableStatPoints: 10,
          skillLevels: [1, 1, 1],
          customQuotes: {
            summon: chosenServant.summonQuote,
            battleStart: chosenServant.battleStartQuote,
            noblePhantasm: chosenServant.noblePhantasm.chant,
            victory: chosenServant.victoryQuote,
            defeat: chosenServant.defeatQuote
          },
          bondLevel: 1,
          template: chosenServant
        };
        updatedMaster.servants.push(newInstance);
        if (!updatedMaster.activeServantId) {
          updatedMaster.activeServantId = newInstance.id;
        }
      } else {
        // Duplicate gives bonus stat points to existing servant
        const existing = updatedMaster.servants.find(s => s.templateId === chosenServant.id);
        if (existing) {
          existing.availableStatPoints += 5;
          existing.bondLevel = Math.min(10, existing.bondLevel + 1);
        }
      }

      return {
        type: 'servant',
        rarity: targetRarity,
        item: chosenServant,
        isNew: !alreadyOwns,
        isRateUp
      };
    } else {
      let pool = targetRarity === 5 ? ssrCes : targetRarity === 4 ? srCes : rCes;
      const featuredInPool = pool.filter(c => banner.featuredCeIds.includes(c.id));
      let chosenCe = pool[Math.floor(Math.random() * pool.length)];
      let isRateUp = false;

      if (featuredInPool.length > 0 && Math.random() < 0.6) {
        chosenCe = featuredInPool[Math.floor(Math.random() * featuredInPool.length)];
        isRateUp = true;
      }

      const alreadyOwns = updatedMaster.craftEssences.some(c => c.id === chosenCe.id);
      if (!alreadyOwns) {
        updatedMaster.craftEssences.push(chosenCe);
      }

      return {
        type: 'craft_essence',
        rarity: targetRarity,
        item: chosenCe,
        isNew: !alreadyOwns,
        isRateUp
      };
    }
  };

  // Perform pulls
  if (count === 1) {
    results.push(pullSingleItem());
  } else {
    // 10-pull: At least one item is guaranteed 4-star or higher
    let hasFourStarOrHigher = false;
    for (let i = 0; i < 9; i++) {
      const res = pullSingleItem();
      if (res.rarity >= 4) hasFourStarOrHigher = true;
      results.push(res);
    }
    // 10th card guaranteed 4-star or higher if none pulled yet
    const lastRes = pullSingleItem(!hasFourStarOrHigher);
    results.push(lastRes);
  }

  updatedMaster.pityCount = pity;

  return {
    results,
    spentQuartz: cost,
    newPityCount: pity,
    updatedMaster
  };
}
