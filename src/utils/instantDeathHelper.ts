import { PassiveSkill } from '../types';

export interface InstantDeathOptions {
  attacker: any;
  target: any;
  npBaseDeathRate?: number; // e.g. 1.00 for Hassan Azrael, 0.50 for Cu Chulainn Gae Bolg, 0.40 for Ciel Calvaria
  isRaid?: boolean;
  isMob?: boolean;
}

export interface InstantDeathResult {
  succeeded: boolean;
  instantKilled: boolean;
  triggeredGuts: boolean;
  chance: number;
  npBaseRate: number;
  targetSusceptibility: number;
  modifierMultiplier: number;
  reviveHp?: number;
  reason?: string;
}

/**
 * Calculates Target Death Susceptibility (Enemy Death Rate) based on FGO standard scale:
 * - 5★ Servants: 20% (0.20)
 * - 4★ Servants: 25% (0.25)
 * - 1–3★ Servants: 30–35% (0.30 - 0.35)
 * - Raid Bosses / Bosses: 1–5% (0.01 - 0.05)
 * - Standard Mobs: 50–100% (0.50 - 1.00)
 */
export function getTargetDeathSusceptibility(target: any, isRaid: boolean = false, isMob: boolean = false): number {
  if (isRaid || target?.isRaidBoss || target?.isBoss) {
    const bossLevel = target?.level || 100;
    if (bossLevel >= 120) return 0.01;
    if (bossLevel >= 90) return 0.02;
    return 0.05;
  }

  if (isMob || target?.isMob) {
    const mobRarity = target?.rarity || 1;
    if (mobRarity >= 3) return 0.50;
    if (mobRarity === 2) return 0.80;
    return 1.00;
  }

  // Default Servant Susceptibility by Rarity
  const rarity = target?.servant?.template?.rarity || target?.template?.rarity || target?.rarity || 5;
  if (rarity >= 5) return 0.20;
  if (rarity === 4) return 0.25;
  if (rarity === 3) return 0.30;
  return 0.35;
}

/**
 * Resolves the NP Base Death Rate for known Servants or default Instant Death NPs:
 * - Hassan-i-Sabbah (Azrael): 100% (1.00)
 * - Cú Chulainn (Gáe Bolg): 50% (0.50)
 * - Ciel (Calvaria Galgalim / Seventh Holy Scripture): 40% (0.40)
 * - Generic Fallback: 30% (0.30)
 */
export function getNpBaseDeathRate(attacker: any, defaultOverride?: number): number {
  if (defaultOverride !== undefined && defaultOverride > 0) {
    return defaultOverride;
  }

  const templateId = (
    attacker?.servant?.templateId ||
    attacker?.servant?.template?.id ||
    attacker?.templateId ||
    attacker?.template?.id ||
    attacker?.id ||
    ''
  ).toString().toLowerCase();

  const servantName = (
    attacker?.servant?.nickname ||
    attacker?.servant?.template?.name ||
    attacker?.template?.name ||
    attacker?.name ||
    ''
  ).toString().toLowerCase();

  const npName = (
    attacker?.servant?.template?.noblePhantasm?.name ||
    attacker?.noblePhantasm?.name ||
    ''
  ).toString().toLowerCase();

  if (
    templateId.includes('hassan_i_sabbah_azrael') ||
    servantName.includes('azrael') ||
    npName.includes('azrael') ||
    npName.includes("mal'ak al-mawt") ||
    npName.includes('angel of the evening bell')
  ) {
    return 1.00;
  }

  if (
    templateId.includes('cu_chulainn') ||
    servantName.includes('cú chulainn') ||
    servantName.includes('cu chulainn') ||
    npName.includes('gáe bolg') ||
    npName.includes('gae bolg') ||
    npName.includes('barbed spear')
  ) {
    return 0.50;
  }

  if (
    templateId.includes('ciel') ||
    servantName.includes('ciel') ||
    npName.includes('seventh holy scripture') ||
    npName.includes('calvaria')
  ) {
    return 0.40;
  }

  return 0.30;
}

/**
 * Checks whether target has complete Instant Death Immunity.
 */
export function isTargetImmuneToInstantDeath(target: any): boolean {
  if (!target) return false;

  if (target.isInstantDeathImmune || target.instant_kill_immunity) return true;

  // Check active buffs
  const activeBuffs = target.activeBuffs || [];
  if (
    activeBuffs.some(
      (b: any) =>
        b.type === 'instant_kill_immunity' ||
        b.type === 'debuff_immunity' ||
        /instant.*death.*immun|instant.*kill.*immun/i.test(b.name || '')
    )
  ) {
    return true;
  }

  // Check passives
  const passives: PassiveSkill[] =
    target.passives ||
    target.servant?.template?.passives ||
    target.template?.passives ||
    [];

  if (
    passives.some(
      (p: PassiveSkill) =>
        p.type === 'instant_kill_immunity' ||
        p.type === 'organizer' || // Hassan has Instant Death Immunity
        p.type === 'absolute_permanence' || // Luvria has Instant Death Immunity
        /instant.*death.*immun|instant.*kill.*immun/i.test(p.name || '') ||
        /instant.*death.*immun|instant.*kill.*immun/i.test(p.description || '')
    )
  ) {
    return true;
  }

  return false;
}

/**
 * FGO Instant Death Formula:
 * Chance = NP Death Rate × Target Death Susceptibility × (1 + Attacker Death Buffs - Target Death Resists)
 */
export function calculateInstantDeathChance(options: InstantDeathOptions): InstantDeathResult {
  const { attacker, target, npBaseDeathRate: overrideNpRate, isRaid = false, isMob = false } = options;

  const npBaseRate = getNpBaseDeathRate(attacker, overrideNpRate);

  if (isTargetImmuneToInstantDeath(target)) {
    return {
      succeeded: false,
      instantKilled: false,
      triggeredGuts: false,
      chance: 0,
      npBaseRate,
      targetSusceptibility: 0,
      modifierMultiplier: 1.0,
      reason: 'Immune to Instant Death'
    };
  }

  const targetSusceptibility = getTargetDeathSusceptibility(target, isRaid, isMob);

  // Attacker Death Buffs
  let attackerBuffVal = 0;
  const attackerBuffs = attacker?.activeBuffs || [];
  attackerBuffs.forEach((b: any) => {
    if (b.type === 'buff_death_rate' || b.type === 'instant_death_rate_up') {
      attackerBuffVal += (b.value || 0) / 100;
    }
  });

  // Check Attacker Passives (e.g. Organizer grants +5% in PvP, +10% in Raids)
  const attackerPassives: PassiveSkill[] =
    attacker?.passives ||
    attacker?.servant?.template?.passives ||
    attacker?.template?.passives ||
    [];

  if (attackerPassives.some((p: PassiveSkill) => p.type === 'organizer' || /organizer/i.test(p.name || ''))) {
    attackerBuffVal += isRaid ? 0.10 : 0.05;
  }

  // Target Death Resistance / Debuffs
  let targetResistVal = 0;
  const targetBuffs = target?.activeBuffs || [];
  targetBuffs.forEach((b: any) => {
    if (b.type === 'debuff_death_res' || b.type === 'tree_of_zaqqum_death_res_down') {
      // Negative death res debuff increases chance (subtracting negative = adding)
      targetResistVal -= (b.value || 0) / 100;
    }
    if (b.type === 'buff_death_res') {
      targetResistVal += (b.value || 0) / 100;
    }
  });

  const modifierMultiplier = Math.max(0, 1 + attackerBuffVal - targetResistVal);
  const chance = Math.min(1.0, Math.max(0, npBaseRate * targetSusceptibility * modifierMultiplier));

  const roll = Math.random();
  const succeeded = roll < chance;

  if (!succeeded) {
    return {
      succeeded: false,
      instantKilled: false,
      triggeredGuts: false,
      chance,
      npBaseRate,
      targetSusceptibility,
      modifierMultiplier,
      reason: 'Instant Death Roll Failed'
    };
  }

  // Instant Death Succeeded! Check if target has Guts status active.
  const hasGutsActive =
    (target?.gutsCount && target.gutsCount > 0) ||
    (target?.activeBuffs || []).some((b: any) => b.type === 'guts' && (b.remainingTurns === undefined || b.remainingTurns > 0));

  if (hasGutsActive) {
    let reviveHp = 1;
    // Process Guts charge
    if (target.activeBuffs) {
      const gutsIdx = target.activeBuffs.findIndex((b: any) => b.type === 'guts');
      if (gutsIdx !== -1) {
        reviveHp = target.activeBuffs[gutsIdx].value || Math.round((target.maxHp || 10000) * 0.20);
        const gutsBuff = target.activeBuffs[gutsIdx];
        if (gutsBuff.remainingHits !== undefined && gutsBuff.remainingHits > 1) {
          gutsBuff.remainingHits--;
        } else {
          target.activeBuffs.splice(gutsIdx, 1);
        }
      }
    }
    if (target.gutsCount && target.gutsCount > 0) {
      target.gutsCount--;
    }
    target.currentHp = reviveHp;

    return {
      succeeded: true,
      instantKilled: false,
      triggeredGuts: true,
      chance,
      npBaseRate,
      targetSusceptibility,
      modifierMultiplier,
      reviveHp,
      reason: 'Instant Death Triggered Guts Revive'
    };
  }

  // Instant Death executed cleanly
  target.currentHp = 0;

  return {
    succeeded: true,
    instantKilled: true,
    triggeredGuts: false,
    chance,
    npBaseRate,
    targetSusceptibility,
    modifierMultiplier,
    reason: 'Instant Death Succeeded'
  };
}
