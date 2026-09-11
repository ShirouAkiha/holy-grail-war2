import {
  ActiveCombatant,
  BattleState,
  CardType,
  CombatTurnLog,
  MasterServantInstance,
  ServantClass,
  StatBalanceMode,
  TurnActionChoice
} from '../types/index';
import { SERVANT_DATABASE, getDefaultClassPassives, getUnlockedPassives, getServantAvatarAndCardArt } from '../data/servants';

// Global PvP damage modifier (0.35x) to scale FGO-style formula output down to ~25k-35k Servant HP pools
export const PVP_DAMAGE_MODIFIER = 0.35;

export function calculateClassMultiplier(attackerClass: ServantClass, defenderClass: ServantClass): number {
  if (attackerClass === defenderClass) return 1.0;

  // Knight Triangle: Saber > Lancer > Archer > Saber
  if (attackerClass === 'Saber' && defenderClass === 'Lancer') return 1.35;
  if (attackerClass === 'Lancer' && defenderClass === 'Archer') return 1.35;
  if (attackerClass === 'Archer' && defenderClass === 'Saber') return 1.35;
  if (attackerClass === 'Saber' && defenderClass === 'Archer') return 0.75;
  if (attackerClass === 'Lancer' && defenderClass === 'Saber') return 0.75;
  if (attackerClass === 'Archer' && defenderClass === 'Lancer') return 0.75;

  // Cavalry Triangle: Rider > Caster > Assassin > Rider
  if (attackerClass === 'Rider' && defenderClass === 'Caster') return 1.35;
  if (attackerClass === 'Caster' && defenderClass === 'Assassin') return 1.35;
  if (attackerClass === 'Assassin' && defenderClass === 'Rider') return 1.35;
  if (attackerClass === 'Rider' && defenderClass === 'Assassin') return 0.75;
  if (attackerClass === 'Caster' && defenderClass === 'Rider') return 0.75;
  if (attackerClass === 'Assassin' && defenderClass === 'Caster') return 0.75;

  // Berserker: 1.35x dealt, 1.35x taken
  if (attackerClass === 'Berserker') return 1.35;
  if (defenderClass === 'Berserker') return 1.35;

  // Ruler: Resists standard 6 classes
  if (defenderClass === 'Ruler' && ['Saber', 'Archer', 'Lancer', 'Rider', 'Caster', 'Assassin'].includes(attackerClass)) {
    return 0.75;
  }
  if (attackerClass === 'Avenger' && defenderClass === 'Ruler') return 1.5;

  // Meme class: Shitposter deals chaotic 1.2x
  if (attackerClass === 'Shitposter') return 1.2;

  return 1.0;
}

/**
 * Calculates flee success probability (in percent 0-100).
 * - Base rate is 30% when HP is >= 50%.
 * - When HP drops below 50%, rate decreases proportionally:
 *   rate = 30 * (currentHp / (maxHp * 0.5))
 * - Agility Servants (Rider, Lancer, Assassin, or agilityStat >= 12) gain +5% escape bonus!
 */
export function calculateFleeChance(
  currentHp: number,
  maxHp: number,
  servantClass: ServantClass | string,
  agilityStat: number = 10
): { chancePercent: number; isAgilityBonus: boolean } {
  const safeMax = Math.max(1, maxHp);
  const hpRatio = Math.max(0, currentHp / safeMax);
  let baseRate = hpRatio >= 0.5 ? 30 : Math.round(30 * (hpRatio / 0.5));

  const isAgilityBonus =
    ['Rider', 'Lancer', 'Assassin'].includes(servantClass) || agilityStat >= 12;
  const bonus = isAgilityBonus ? 5 : 0;

  const total = Math.min(95, Math.max(5, baseRate + bonus));
  return { chancePercent: total, isAgilityBonus };
}

export function rollFleeSuccess(chancePercent: number): boolean {
  return Math.random() * 100 < chancePercent;
}

export function createCombatantFromMasterServant(
  servantInstance: MasterServantInstance,
  masterName: string,
  overrideCurrentHp?: number,
  balanceMode: StatBalanceMode = 'archetype'
): ActiveCombatant {
  const templateId = servantInstance.templateId || servantInstance.template?.id || servantInstance.id;
  const canonical = SERVANT_DATABASE.find(s => s.id === templateId) || servantInstance.template || servantInstance;
  const t = { ...canonical, ...(servantInstance.template?.isCustomOrMeme ? servantInstance.template : {}) };
  const ce = servantInstance.equippedCe;

  // Base parameters: under 'flat' mode, all base stats are 10. Under 'archetype', use canonical parameter distribution.
  const base = balanceMode === 'flat'
    ? { strength: 10, endurance: 10, agility: 10, mana: 10, luck: 10 }
    : (t.baseStats || { strength: 10, endurance: 10, agility: 10, mana: 10, luck: 10 });

  const totalStr = (base.strength || 10) + (servantInstance.allocatedStats?.strength || 0);
  const totalEnd = (base.endurance || 10) + (servantInstance.allocatedStats?.endurance || 0);
  const totalAgi = (base.agility || 10) + (servantInstance.allocatedStats?.agility || 0);
  const totalMna = (base.mana || 10) + (servantInstance.allocatedStats?.mana || 0);
  const totalLck = (base.luck || 10) + (servantInstance.allocatedStats?.luck || 0);

  const ceHp = ce ? (ce.hpBonus || 0) : 0;
  const ceAtk = ce ? (ce.atkBonus || 0) : 0;

  const lvl = servantInstance.level || 1;
  // Base HP & ATK: under 'flat' mode, flat 28,000 HP / 10,000 ATK. Under 'archetype', use normalized balanced template stats.
  const baseHp = balanceMode === 'flat' ? 28000 : (t.baseHp || 29000);
  const baseAtk = balanceMode === 'flat' ? 10000 : (t.baseAtk || 11000);

  const maxHp = Math.round(baseHp + totalEnd * 150 + ceHp);
  const rawAtk = Math.round(baseAtk + totalStr * 80 + ceAtk);
  const def = Math.round(totalEnd * 25);

  let initialNp = 0;
  if (ce) {
    if (ce.passiveType === 'starting_np' || ce.id === 'ce_kaleidoscope' || ce.id === 'ce_imaginary_element' || ce.id === 'ce_hollow_magic' || ce.id === 'ce_dragon_meridian' || ce.id === 'ce_jeweled_sword') {
      initialNp = ce.passiveValue || 50;
    }
  }

  // Resolve passives (Max 2 passives; Slot 2 unlocks after Bond Lv. 5)
  const servantBond = servantInstance.bondLevel || 1;
  const rawPassives = (t.passives && t.passives.length > 0)
    ? t.passives
    : getDefaultClassPassives(t.servantClass);
  const passives = getUnlockedPassives(rawPassives, servantBond);

  const pcBonus = passives.some(p => p.type === 'presence_concealment') ? 6 : 0;

  const startingHp = overrideCurrentHp !== undefined && overrideCurrentHp > 0
    ? Math.min(maxHp, Math.round(overrideCurrentHp))
    : (servantInstance.currentHp !== undefined && servantInstance.currentHp > 0
      ? Math.min(maxHp, Math.round(servantInstance.currentHp))
      : maxHp);

  const initialBuffs: ActiveCombatant['activeBuffs'] = [];
  let isInvincible = false;

  if (ce) {
    if (ce.id === 'ce_volumen_hydragyrum' || ce.passiveType === 'invincible_hits') {
      const hits = 3;
      const turns = 3;
      initialBuffs.push({
        name: 'Volumen Hydragyrum (Invincibility)',
        type: 'invincible',
        value: 100,
        remainingTurns: turns,
        remainingHits: hits,
        isHitCount: true
      });
      initialBuffs.push({
        name: 'Volumen Hydragyrum (Damage Cut)',
        type: 'buff_def',
        value: 15,
        remainingTurns: 99
      });
      isInvincible = true;
    }
    if (ce.id === 'ce_code_cast' || ce.passiveType === 'atk_def_up') {
      initialBuffs.push({
        name: 'Code Cast (ATK Up)',
        type: 'buff_atk',
        value: 10,
        remainingTurns: 99
      });
      initialBuffs.push({
        name: 'Code Cast (DEF Up)',
        type: 'buff_def',
        value: 10,
        remainingTurns: 99
      });
    }
    if (ce.id === 'ce_origin_bullet' || ce.passiveType === 'ignore_invincible') {
      initialBuffs.push({
        name: 'Origin Bullet (Ignore Invincible)',
        type: 'ignore_invincible',
        value: 35,
        remainingTurns: 99
      });
    }
  }

  return {
    id: servantInstance.id,
    name: servantInstance.nickname || t.name,
    masterName,
    servantClass: t.servantClass,
    avatarUrl: getServantAvatarAndCardArt(servantInstance).avatarUrl,
    maxHp,
    currentHp: startingHp,
    atk: rawAtk,
    def,
    stats: {
      strength: totalStr,
      endurance: totalEnd,
      agility: totalAgi,
      mana: totalMna,
      luck: totalLck
    },
    commandDeck: [...t.commandDeck],
    npGauge: initialNp,
    passives,
    activeBuffs: initialBuffs,
    isInvincible,
    equippedCe: ce ? { ...ce } : undefined,
    skills: t.skills.map(s => ({ ...s, currentCooldown: 0 })),
    noblePhantasm: { ...t.noblePhantasm },
    critStars: pcBonus,
    bondLevel: servantInstance.bondLevel || 1,
    npLevel: servantInstance.npLevel || 1,
    statBalanceMode: balanceMode,
    customQuotes: servantInstance.customQuotes
  };
}

export function applyCombatantSkill(
  actor: ActiveCombatant,
  target: ActiveCombatant,
  skillIndex: number
): { success: boolean; log: string; quote?: string; skillName?: string } {
  if (skillIndex === 2 && (actor.bondLevel || 1) < 5) {
    return { success: false, log: '🔒 Skill 3 is locked! Reach Bond Level 5 to unlock.' };
  }

  const skill = actor.skills[skillIndex];
  if (!skill) {
    return { success: false, log: 'Skill not found.' };
  }

  if (skill.currentCooldown > 0) {
    return { success: false, log: `Skill ${skill.name} is on cooldown for ${skill.currentCooldown} more turns.` };
  }

  skill.currentCooldown = skill.cooldown;
  const skillQuote = actor.customQuotes?.skill || `My power answers the command! Witness ${skill.name}!`;
  const quoteLine = `\n> 💬 ❝ ***${skillQuote}*** ❞`;
  let logText = `✨ **${actor.name}** activated **${skill.name}**!${quoteLine}`;

  switch (skill.effectType) {
    case 'buff_atk': {
      const descLower = (skill.description || '').toLowerCase();
      const nameLower = skill.name.toLowerCase();
      let cardBuff: 'buster_up' | 'arts_up' | 'quick_up' | null = null;
      if (descLower.includes('buster') || nameLower.includes('mana burst') || nameLower.includes('bravery')) {
        cardBuff = 'buster_up';
      } else if (descLower.includes('arts') || nameLower.includes('fox') || descLower.includes('arts up')) {
        cardBuff = 'arts_up';
      } else if (descLower.includes('quick') || nameLower.includes('primordial rune') || descLower.includes('quick up')) {
        cardBuff = 'quick_up';
      }

      if (cardBuff) {
        actor.activeBuffs.push({
          name: `${skill.name} (${cardBuff === 'buster_up' ? 'Buster' : cardBuff === 'arts_up' ? 'Arts' : 'Quick'} Up)`,
          type: cardBuff,
          value: skill.value || 30,
          remainingTurns: skill.duration || 1
        });
      } else {
        actor.activeBuffs.push({
          name: skill.name,
          type: 'buff_atk',
          value: skill.value || 30,
          remainingTurns: skill.duration || 2
        });
      }
      actor.critStars = Math.min(50, actor.critStars + 10);
      logText = `⚔️ **${actor.name}** activated **${skill.name}**!${quoteLine}`;
      break;
    }
    case 'buff_def':
      actor.activeBuffs.push({
        name: skill.name,
        type: 'buff_def',
        value: skill.value || 30,
        remainingTurns: skill.duration || 2
      });
      logText = `🛡️ **${actor.name}** activated **${skill.name}**!${quoteLine}`;
      break;
    case 'heal': {
      const healAmt = skill.value || Math.round(actor.maxHp * 0.25);
      actor.currentHp = Math.min(actor.maxHp, actor.currentHp + healAmt);
      logText = `💚 **${actor.name}** activated **${skill.name}**!${quoteLine}`;
      break;
    }
    case 'np_charge':
      actor.npGauge = Math.min(300, actor.npGauge + (skill.value || 30));
      actor.critStars = Math.min(50, actor.critStars + 15);
      logText = `⚡ **${actor.name}** activated **${skill.name}**!${quoteLine}`;
      break;
    case 'crit_stars': {
      const stars = skill.value || 25;
      actor.critStars = Math.min(50, actor.critStars + stars);
      actor.activeBuffs.push({
        name: skill.name,
        type: 'crit_dmg',
        value: 40,
        remainingTurns: skill.duration || 2
      });
      logText = `🌟 **${actor.name}** activated **${skill.name}**!${quoteLine}`;
      break;
    }
    case 'evade':
    case 'invincible':
      actor.isEvading = true;
      actor.activeBuffs.push({
        name: skill.name,
        type: 'evade',
        value: 100,
        remainingTurns: skill.duration || 1
      });
      logText = `💨 **${actor.name}** activated **${skill.name}**!${quoteLine}`;
      break;
    case 'guts': {
      const reviveVal = skill.value || Math.round(actor.maxHp * 0.20);
      actor.activeBuffs.push({
        name: skill.name,
        type: 'guts',
        value: reviveVal,
        remainingTurns: skill.duration || 5
      });
      if (skill.id?.includes('thrice')) {
        actor.activeBuffs.push({
          name: `${skill.name} (DEF Up)`,
          type: 'buff_def',
          value: 100,
          remainingTurns: 1
        });
      }
      logText = `🩸 **${actor.name}** activated **${skill.name}**!${quoteLine}`;
      break;
    }
    case 'debuff':
    case 'stun': {
      const targetPassives = target.passives || getUnlockedPassives(target.servantClass, target.bondLevel || 1);
      const actorPassives = actor.passives || getUnlockedPassives(actor.servantClass, actor.bondLevel || 1);
      const magicResist = targetPassives.filter(p => p.type === 'magic_resistance').reduce((s, p) => s + p.value, 0);
      const itemConstruct = actorPassives.filter(p => p.type === 'item_construction').reduce((s, p) => s + p.value, 0);
      const effectiveResist = Math.max(0, magicResist - itemConstruct);

      target.npGauge = Math.max(0, target.npGauge - 20);
      target.activeBuffs.push({
        name: `${skill.name} (ATK Down)`,
        type: 'debuff_atk',
        value: skill.value || 20,
        remainingTurns: skill.duration || 1
      });

      if (effectiveResist > 0 && Math.random() * 100 < effectiveResist) {
        logText = `🛡️ **${target.name}** partially resisted **${actor.name}'s ${skill.name}** via Magic Resistance!${quoteLine}`;
      } else {
        target.isStunned = true;
        target.activeBuffs.push({
          name: 'Stunned',
          type: 'stun',
          value: 100,
          remainingTurns: skill.duration || 1
        });
        logText = `👁️ **${actor.name}** activated **${skill.name}**!${quoteLine}`;
      }
      break;
    }
    default:
      actor.activeBuffs.push({
        name: skill.name,
        type: 'buff_atk',
        value: 25,
        remainingTurns: 2
      });
      logText = `✨ **${actor.name}** activated **${skill.name}**!${quoteLine}`;
      break;
  }

  return { success: true, log: logText, quote: skillQuote, skillName: skill.name };
}

export function initializeBattle(
  combatant1: ActiveCombatant,
  combatant2: ActiveCombatant,
  battleId?: string,
  grailWarId?: string,
  balanceMode: StatBalanceMode = 'archetype'
): BattleState {
  return {
    battleId: battleId || `battle_${Date.now()}`,
    player1: combatant1,
    player2: combatant2,
    currentTurn: 1,
    turnPhase: 'card_selection',
    turnHistory: [],
    grailWarId,
    statBalanceMode: balanceMode
  };
}

export interface NoblePhantasmExecutionResult {
  cardType: CardType;
  scope: 'single' | 'aoe' | 'support';
  damageDealt: number;
  npCharged: number;
  starsGenerated: number;
  hpHealed: number;
  isCritical: boolean;
  actionSummary: string;
  isEvaded: boolean;
  isInvincible: boolean;
}

/**
 * Resolves Noble Phantasm execution according to Fate/Grand Order mechanics:
 * 1. Permanently mapped Card Type: Buster, Arts, or Quick.
 * 2. Scope classification: Single Target (ST), Area of Effect (AoE), or Support/Non-damaging.
 * 3. Base damage scaling dictated by card type (Buster 1.5x card mod, Arts 1.0x, Quick 0.8x; ST vs AoE).
 * 4. Refund properties (Buster: 0% base; Arts: 25-30% refund scaled by Arts buffs; Quick: massive stars + moderate refund).
 * 5. Party-wide & active buff interaction (Buster buffs only affect Buster, Arts buffs only affect Arts & refund, Quick buffs affect Quick & stars).
 */
export function executeNoblePhantasmLogic(
  actor: ActiveCombatant,
  target: ActiveCombatant,
  classMult: number
): NoblePhantasmExecutionResult {
  const np = actor.noblePhantasm || {
    name: 'Noble Phantasm',
    cardType: 'Buster' as CardType,
    chant: '',
    description: '',
    target: 'single' as const,
    multiplier: 600,
    overchargeEffect: ''
  };
  const cardType: CardType = np.cardType || 'Buster';
  const scope: 'single' | 'aoe' | 'support' = (np.target as any) || 'single';

  // Base Multipliers according to Fate/Grand Order parameters:
  // Buster: ST 600%, AoE 400%, Support 0%
  // Arts: ST 900%, AoE 450%, Support 0%
  // Quick: ST 1200%, AoE 600%, Support 0%
  let baseMultiplier = np.multiplier;
  if (scope === 'support') {
    baseMultiplier = 0;
  } else if (!baseMultiplier || baseMultiplier <= 0) {
    if (scope === 'single') {
      baseMultiplier = cardType === 'Quick' ? 1200 : cardType === 'Arts' ? 900 : 600;
    } else {
      baseMultiplier = cardType === 'Quick' ? 600 : cardType === 'Arts' ? 450 : 400;
    }
  }

  // Command card base damage modifiers: Buster (1.5x), Arts (1.0x), Quick (0.8x)
  const cardDamageModifier = cardType === 'Buster' ? 1.50 : cardType === 'Quick' ? 0.80 : 1.00;
  // Scope modifier: Single Target focuses full concentrated force (1.0x); AoE distributes damage (0.70x in 1v1 duel); Support deals 0
  const scopeModifier = scope === 'single' ? 1.00 : scope === 'aoe' ? 0.70 : 0.00;

  // Overcharge scaling
  const overchargeLevel = actor.npGauge >= 300 ? 3 : actor.npGauge >= 200 ? 2 : 1;
  const overchargeDamageBonus = 1.0 + (overchargeLevel - 1) * 0.20;

  // General ATK Buffs
  const atkBuff = actor.activeBuffs
    .filter(b => b.type === 'buff_atk')
    .reduce((s, b) => s + b.value, 0) -
    actor.activeBuffs
    .filter(b => b.type === 'debuff_atk')
    .reduce((s, b) => s + b.value, 0);

  // Actor Passives (Max 2, 2nd unlocked after Bond 5)
  const actorPassives = actor.passives || getUnlockedPassives(actor.servantClass, actor.bondLevel || 1);
  const actorMadness = actorPassives.filter(p => p.type === 'madness_enhancement').reduce((s, p) => s + p.value, 0);
  const actorTerritory = actorPassives.filter(p => p.type === 'territory_creation').reduce((s, p) => s + p.value, 0);
  const actorRiding = actorPassives.filter(p => p.type === 'riding').reduce((s, p) => s + p.value, 0);
  const actorDivinity = actorPassives.filter(p => p.type === 'divinity').reduce((s, p) => s + p.value, 0);
  const flatDivinity = Math.round(actorDivinity * PVP_DAMAGE_MODIFIER);

  // Card Performance Buffs (Card Type strictly dictates which card buffs interact!)
  const busterBuff = actor.activeBuffs
    .filter(b => b.type === 'buster_up' || /mana burst|buster/i.test(b.name))
    .reduce((s, b) => s + b.value, 0) +
    (actor.equippedCe?.passiveType === 'buster_up' && actor.equippedCe.id !== 'ce_black_grail' ? (actor.equippedCe.passiveValue || 0) : 0) +
    actorMadness;

  const artsBuff = actor.activeBuffs
    .filter(b => b.type === 'arts_up' || /arts|fox/i.test(b.name))
    .reduce((s, b) => s + b.value, 0) +
    (actor.equippedCe?.passiveType === 'arts_up' ? (actor.equippedCe.passiveValue || 0) : 0) +
    actorTerritory;

  const quickBuff = actor.activeBuffs
    .filter(b => b.type === 'quick_up' || /quick|primordial rune/i.test(b.name))
    .reduce((s, b) => s + b.value, 0) +
    (actor.equippedCe?.passiveType === 'quick_up' ? (actor.equippedCe.passiveValue || 0) : (actor.equippedCe?.id === 'ce_when_the_flowers_fall' ? 4 : 0)) +
    actorRiding;

  // Card-specific performance multiplier strictly matching NP card type
  const cardPerformanceMultiplier = 1.0 + (
    (cardType === 'Buster' ? busterBuff : cardType === 'Arts' ? artsBuff : quickBuff) / 100
  );

  // NP Damage Buff (The Black Grail, Heaven's Feel, etc.)
  let npDmgBonus = 1.0;
  if (actor.equippedCe) {
    if (actor.equippedCe.id === 'ce_black_grail' || actor.equippedCe.passiveType === 'np_damage') {
      npDmgBonus += (actor.equippedCe.passiveValue || 60) / 100;
    } else if (actor.equippedCe.id === 'ce_heavens_feel') {
      npDmgBonus += 0.40;
    } else if (actor.equippedCe.id === 'ce_when_the_flowers_fall') {
      npDmgBonus += 0.05;
    }
  }
  const npBuffVal = actor.activeBuffs
    .filter(b => b.type === 'buff_np_dmg')
    .reduce((s, b) => s + b.value, 0);
  npDmgBonus += (npBuffVal / 100);

  // Target defense & debuffs
  const defBuff = target.activeBuffs
    .filter(b => b.type === 'buff_def')
    .reduce((s, b) => s + b.value, 0);
  const defDebuff = target.activeBuffs
    .filter(b => b.type === 'debuff_def')
    .reduce((s, b) => s + b.value, 0);
  const targetDefFactor = Math.max(0.15, 1.0 + (defBuff - defDebuff) / 100);

  const strBonus = actor.stats?.strength ? (1 + actor.stats.strength * 0.01) : 1;
  const effectiveAtk = actor.atk * (1 + atkBuff / 100) * strBonus;
  const effectiveDef = target.def * targetDefFactor;

  let damageDealt = 0;
  let npCharged = 0;
  let starsGenerated = 0;
  let hpHealed = 0;
  let isEvaded = false;
  let isInvincible = false;
  let actionSummary = '';

  if (scope === 'support') {
    // Non-damaging Support Noble Phantasm
    damageDealt = 0;
    if (cardType === 'Arts') {
      // e.g. Jeanne d'Arc: Luminosité Eternelle
      const manaBonus = actor.stats?.mana ? Math.round(actor.stats.mana * 50) : 0;
      hpHealed = 2500 + manaBonus;
      actor.currentHp = Math.min(actor.maxHp, actor.currentHp + hpHealed);
      actor.isInvincible = true;
      actor.activeBuffs.push({
        name: 'Luminosité Invincibility',
        type: 'invincible',
        value: 100,
        remainingTurns: 1
      });
      actor.activeBuffs.push({
        name: 'Divine Protection',
        type: 'buff_def',
        value: 30,
        remainingTurns: 3
      });
      npCharged = Math.round(25 * (1.0 + artsBuff / 100));
      starsGenerated = 5;
      actionSummary = `🛡️ **${actor.name}** deployed Support Noble Phantasm [${np.name}] (Arts • Non-damaging)! Bestowed Invincibility (1T), +30% DEF, healed +${hpHealed.toLocaleString()} HP, and refilled +${npCharged}% NP Gauge!`;
    } else if (cardType === 'Quick') {
      // Quick Support
      starsGenerated = Math.round(30 * (1.0 + quickBuff / 100));
      actor.isEvading = true;
      actor.activeBuffs.push({
        name: 'Quick Evade',
        type: 'evade',
        value: 100,
        remainingTurns: 1
      });
      actor.activeBuffs.push({
        name: 'Quick Surge',
        type: 'quick_up',
        value: 25,
        remainingTurns: 3
      });
      npCharged = Math.round(15 * (1.0 + quickBuff / 100));
      actionSummary = `🌪️ **${actor.name}** deployed Support Noble Phantasm [${np.name}] (Quick • Non-damaging)! Generated +${starsGenerated} Stars, bestowed Evade (1T), and granted +25% Quick!`;
    } else {
      // Buster Support
      actor.activeBuffs.push({
        name: 'War Cry',
        type: 'buff_atk',
        value: 30,
        remainingTurns: 3
      });
      actor.activeBuffs.push({
        name: 'Buster Surge',
        type: 'buster_up',
        value: 30,
        remainingTurns: 3
      });
      starsGenerated = 10;
      actionSummary = `🔥 **${actor.name}** deployed Support Noble Phantasm [${np.name}] (Buster • Non-damaging)! Bestowed +30% ATK, +30% Buster, and generated +${starsGenerated} Stars!`;
    }
  } else {
    // Damaging Noble Phantasm (ST or AoE)
    const baseDamage = (effectiveAtk * (baseMultiplier / 100) * 0.18 * cardDamageModifier * scopeModifier * overchargeDamageBonus * classMult);
    let totalDmg = (baseDamage * cardPerformanceMultiplier * npDmgBonus) - (effectiveDef * 0.25);
    totalDmg = Math.max(1200, totalDmg);
    const variance = 0.96 + Math.random() * 0.08;
    totalDmg = Math.round(totalDmg * variance * PVP_DAMAGE_MODIFIER) + flatDivinity;

    // Check Ignore Invincible (e.g. Origin Bullet)
    const actorIgnoresInvincible = actor.equippedCe?.id === 'ce_origin_bullet' || actor.equippedCe?.passiveType === 'ignore_invincible' || actor.activeBuffs.some(b => b.type === 'ignore_invincible');
    if (actor.equippedCe?.id === 'ce_origin_bullet' && (target.servantClass === 'Caster' || (target.stats?.mana || 0) >= 12)) {
      totalDmg = Math.round(totalDmg * 1.35);
    }

    // Check Invincibility & Evade on target
    const invIdx = target.activeBuffs ? target.activeBuffs.findIndex(b => b.type === 'invincible') : -1;
    const evaIdx = target.activeBuffs ? target.activeBuffs.findIndex(b => b.type === 'evade') : -1;
    if (invIdx !== -1 && !actorIgnoresInvincible && target.activeBuffs) {
      const buff = target.activeBuffs[invIdx];
      if (buff.remainingTurns <= 0 || (buff.remainingHits !== undefined && buff.remainingHits <= 0)) {
        target.activeBuffs.splice(invIdx, 1);
        if (!target.activeBuffs.some(b => b.type === 'invincible')) target.isInvincible = false;
        damageDealt = totalDmg;
      } else {
        damageDealt = 0;
        isInvincible = true;
        const isHitBased = buff.isHitCount || buff.remainingHits !== undefined || /volumen/i.test(buff.name);
        if (isHitBased) {
          if (buff.remainingHits !== undefined) {
            buff.remainingHits--;
            if (buff.remainingHits <= 0) target.activeBuffs.splice(invIdx, 1);
          } else {
            buff.remainingTurns--;
            if (buff.remainingTurns <= 0) target.activeBuffs.splice(invIdx, 1);
          }
        }
        if (!target.activeBuffs.some(b => b.type === 'invincible')) {
          target.isInvincible = false;
        }
      }
    } else if (evaIdx !== -1 && !actorIgnoresInvincible && target.activeBuffs) {
      const buff = target.activeBuffs[evaIdx];
      if (buff.remainingTurns <= 0 || (buff.remainingHits !== undefined && buff.remainingHits <= 0)) {
        target.activeBuffs.splice(evaIdx, 1);
        if (!target.activeBuffs.some(b => b.type === 'evade')) target.isEvading = false;
        damageDealt = totalDmg;
      } else {
        damageDealt = 0;
        isEvaded = true;
        const isHitBased = buff.isHitCount || buff.remainingHits !== undefined || /protection from arrows/i.test(buff.name);
        if (isHitBased) {
          if (buff.remainingHits !== undefined) {
            buff.remainingHits--;
            if (buff.remainingHits <= 0) target.activeBuffs.splice(evaIdx, 1);
          } else {
            buff.remainingTurns--;
            if (buff.remainingTurns <= 0) target.activeBuffs.splice(evaIdx, 1);
          }
        }
        if (!target.activeBuffs.some(b => b.type === 'evade')) {
          target.isEvading = false;
        }
      }
    } else {
      damageDealt = totalDmg;
    }

    // Refund and Star Generation dictated by cardType:
    if (cardType === 'Buster') {
      // Buster: 0% base refund. Inherent 1.5x card modifier power.
      const hasInherentRecharge = np.description.toLowerCase().includes('recharg') || np.description.toLowerCase().includes('refund');
      npCharged = (overchargeLevel >= 2 ? 20 : 0) + (hasInherentRecharge ? 20 : 0);
      starsGenerated = scope === 'aoe' ? 8 : 5;
      actionSummary = isInvincible
        ? `💥 **${actor.name}** unleashed Buster Noble Phantasm [${np.name}] (${scope === 'single' ? 'ST' : 'AoE'}), but **${target.name}** was shielded by Invincibility!`
        : isEvaded
        ? `💨 **${actor.name}** unleashed Buster Noble Phantasm [${np.name}] (${scope === 'single' ? 'ST' : 'AoE'}), but **${target.name}** Evaded!`
        : `💥 **${actor.name}** unleashed Buster Noble Phantasm [${np.name}] (${scope === 'single' ? 'Single Target ST' : 'AoE'}) for **${damageDealt.toLocaleString()} DMG**! (Card Mod: 1.5x${npCharged > 0 ? ` • Recharged +${npCharged}% NP` : ''})`;
    } else if (cardType === 'Arts') {
      // Arts: Generates heavy NP refund, boosted by Arts performance buffs!
      const baseRefund = scope === 'aoe' ? 30 : 25;
      npCharged = Math.round(baseRefund * (1.0 + artsBuff / 100));
      starsGenerated = 5;
      actionSummary = isInvincible
        ? `🔵 **${actor.name}** unleashed Arts Noble Phantasm [${np.name}] (${scope === 'single' ? 'ST' : 'AoE'}), but **${target.name}** was shielded by Invincibility! (Arts Refund: +${npCharged}% NP)`
        : isEvaded
        ? `💨 **${actor.name}** unleashed Arts Noble Phantasm [${np.name}] (${scope === 'single' ? 'ST' : 'AoE'}), but **${target.name}** Evaded! (Arts Refund: +${npCharged}% NP)`
        : `🔵 **${actor.name}** unleashed Arts Noble Phantasm [${np.name}] (${scope === 'single' ? 'Single Target ST' : 'AoE'}) for **${damageDealt.toLocaleString()} DMG** and refilled **+${npCharged}% NP Gauge** via Arts Refund!`;
    } else {
      // Quick: Generates massive Critical Stars and moderate NP refund, both boosted by Quick performance buffs!
      const baseStars = scope === 'aoe' ? 35 : 25;
      starsGenerated = Math.round(baseStars * (1.0 + quickBuff / 100));
      const baseRefund = scope === 'aoe' ? 20 : 15;
      npCharged = Math.round(baseRefund * (1.0 + quickBuff / 100));
      actionSummary = isInvincible
        ? `🟢 **${actor.name}** unleashed Quick Noble Phantasm [${np.name}] (${scope === 'single' ? 'ST' : 'AoE'}), but **${target.name}** blocked with Invincibility! (Generated +${starsGenerated} Stars, +${npCharged}% NP)`
        : isEvaded
        ? `💨 **${actor.name}** unleashed Quick Noble Phantasm [${np.name}] (${scope === 'single' ? 'ST' : 'AoE'}), but **${target.name}** Evaded! (Generated +${starsGenerated} Stars, +${npCharged}% NP)`
        : `🟢 **${actor.name}** unleashed Quick Noble Phantasm [${np.name}] (${scope === 'single' ? 'Single Target ST' : 'AoE'}) for **${damageDealt.toLocaleString()} DMG**, generating **+${starsGenerated} Critical Stars** and refilling **+${npCharged}% NP**!`;
    }
  }

  return {
    cardType,
    scope,
    damageDealt,
    npCharged,
    starsGenerated,
    hpHealed,
    isCritical: false,
    actionSummary,
    isEvaded,
    isInvincible
  };
}

export interface TurnDialogueQuoteInfo {
  speakerName: string;
  speakerTitle: string;
  servantClass: string;
  tag: string;
  quoteText: string;
  badgeType: 'np' | 'skill' | 'advantage' | 'low_hp' | 'crit' | 'attack';
}

export function generateTurnDialogueQuote(
  actor: ActiveCombatant,
  target: ActiveCombatant,
  choice: TurnActionChoice,
  classMult: number,
  isCritical: boolean = false
): TurnDialogueQuoteInfo {
  const hpRatio = actor.currentHp / actor.maxHp;
  const isLowHp = hpRatio <= 0.35;
  const servantName = actor.name;
  const servantClass = actor.servantClass;

  if (choice.useCommandSeal) {
    const quote = actor.customQuotes?.commandSeal || `By my Command Seal! ${servantName}, refill your Noble Phantasm and shatter enemy lines!`;
    return {
      speakerName: actor.masterName || 'Master',
      speakerTitle: `Master Command Seal Amplification`,
      servantClass,
      tag: 'COMMAND SEAL ACTIVATED',
      quoteText: quote,
      badgeType: 'skill'
    };
  }

  if (choice.useSkillIndex !== undefined && choice.useSkillIndex >= 0 && actor.skills[choice.useSkillIndex]) {
    const skill = actor.skills[choice.useSkillIndex];
    const quote = actor.customQuotes?.skill || `Activating ${skill.name}! ${skill.description}`;
    return {
      speakerName: servantName,
      speakerTitle: `${servantClass} • Skill: ${skill.name}`,
      servantClass,
      tag: 'SKILL RELEASE',
      quoteText: quote,
      badgeType: 'skill'
    };
  }

  if (choice.useNoblePhantasm && actor.npGauge >= 100) {
    const chant = actor.customQuotes?.noblePhantasm || actor.noblePhantasm?.chant || `Sword of Promised Victory... EXCALIBUR!`;
    return {
      speakerName: servantName,
      speakerTitle: `${servantClass} • ${actor.noblePhantasm?.name || 'Noble Phantasm'}`,
      servantClass,
      tag: 'NOBLE PHANTASM CHANT',
      quoteText: chant,
      badgeType: 'np'
    };
  }

  if (isCritical && actor.customQuotes?.critHit) {
    return {
      speakerName: servantName,
      speakerTitle: `${servantClass} • Critical Strike`,
      servantClass,
      tag: 'CRITICAL STRIKE',
      quoteText: actor.customQuotes.critHit,
      badgeType: 'crit'
    };
  }

  const cards = choice.selectedCards || ['Buster', 'Arts', 'Quick'];
  if (cards.length === 3) {
    if (cards.every(c => c === 'Buster')) {
      return {
        speakerName: servantName,
        speakerTitle: `${servantClass} • Buster Brave Chain`,
        servantClass,
        tag: 'BUSTER BRAVE CHAIN',
        quoteText: actor.customQuotes?.busterChain || "All mana into maximum destruction! Take this!",
        badgeType: 'crit'
      };
    }
    if (cards.every(c => c === 'Arts')) {
      return {
        speakerName: servantName,
        speakerTitle: `${servantClass} • Arts Chain`,
        servantClass,
        tag: 'ARTS CHAIN',
        quoteText: actor.customQuotes?.artsChain || "Charging mana reservoir... let's flood the battlefield!",
        badgeType: 'attack'
      };
    }
    if (cards.every(c => c === 'Quick')) {
      return {
        speakerName: servantName,
        speakerTitle: `${servantClass} • Quick Star Chain`,
        servantClass,
        tag: 'QUICK STAR CHAIN',
        quoteText: actor.customQuotes?.quickChain || "Swift like lightning... you won't even see the strike!",
        badgeType: 'crit'
      };
    }
    return {
      speakerName: servantName,
      speakerTitle: `${servantClass} • Command Card Combo`,
      servantClass,
      tag: 'TACTICAL COMBAT CHAIN',
      quoteText: "Executing tactical 3-card chain! My blade answers your command, Master!",
      badgeType: 'attack'
    };
  }

  if (isLowHp) {
    const quotes = [
      "I won't fall here... Master, give me strength!",
      "My Spirit Origin remains unyielding! Final strike!",
      "This pain is nothing... I shall fulfill our pact!"
    ];
    return {
      speakerName: servantName,
      speakerTitle: `${servantClass} • Desperation Strike`,
      servantClass,
      tag: 'DESPERATION',
      quoteText: quotes[Math.floor(Math.random() * quotes.length)],
      badgeType: 'low_hp'
    };
  }

  if (classMult > 1.0) {
    const quotes = [
      "Your class stands no chance against my blade!",
      "I hold the class affinity edge in this clash, prepare yourself!",
      "A foolish match-up for you... I will take victory in one strike!"
    ];
    return {
      speakerName: servantName,
      speakerTitle: `${servantClass} (${classMult}x Advantage vs ${target.servantClass})`,
      servantClass,
      tag: 'CLASS ADVANTAGE',
      quoteText: quotes[Math.floor(Math.random() * quotes.length)],
      badgeType: 'advantage'
    };
  }

  return {
    speakerName: servantName,
    speakerTitle: `${servantClass} • Battle Engagement`,
    servantClass,
    tag: 'BATTLE QUOTE',
    quoteText: "My blade answers your command, Master!",
    badgeType: 'attack'
  };
}

export function executeBattleTurn(
  state: BattleState,
  p1Choice: TurnActionChoice,
  p2Choice: TurnActionChoice
): { updatedState: BattleState; turnLogs: CombatTurnLog[] } {
  const p1 = { ...state.player1, activeBuffs: [...state.player1.activeBuffs] };
  const p2 = { ...state.player2, activeBuffs: [...state.player2.activeBuffs] };
  const turnLogs: CombatTurnLog[] = [];

  // Determine initiative order based on Agility + random variance + Quick buffs
  const p1Speed = p1.stats.agility * 10 + (Math.random() * 20);
  const p2Speed = p2.stats.agility * 10 + (Math.random() * 20);

  const [firstActor, secondActor, firstChoice, secondChoice] =
    p1Speed >= p2Speed
      ? [p1, p2, p1Choice, p2Choice]
      : [p2, p1, p2Choice, p1Choice];

  // Helper for single action resolution
  const resolveActorTurn = (actor: ActiveCombatant, target: ActiveCombatant, choice: TurnActionChoice) => {
    if (actor.currentHp <= 0 || target.currentHp <= 0) return;

    const usedSkillNames: string[] = [];

    // Actor and Target Passives (Max 2, 2nd unlocked after Bond 5)
    const actorPassives = actor.passives || getUnlockedPassives(actor.servantClass, actor.bondLevel || 1);
    const targetPassives = target.passives || getUnlockedPassives(target.servantClass, target.bondLevel || 1);

    // Decrement skill cooldowns at start of turn
    actor.skills = actor.skills.map(sk => ({
      ...sk,
      currentCooldown: Math.max(0, sk.currentCooldown - 1)
    }));

    // Craft Essence Turn-Start Passives
    if (actor.equippedCe) {
      const ce = actor.equippedCe;
      if (ce.id === 'ce_prisma_cosmos' || ce.passiveType === 'np_per_turn') {
        actor.npGauge = Math.min(300, actor.npGauge + (ce.passiveValue || 8));
      }
      if (ce.id === 'ce_fragment_2030' || ce.passiveType === 'stars_per_turn') {
        actor.critStars = Math.min(50, (actor.critStars || 0) + (ce.passiveValue || 10));
      }
      if (ce.id === 'ce_when_the_flowers_fall') {
        actor.npGauge = Math.min(300, actor.npGauge + 4);
      }
      if (ce.id === 'ce_black_grail') {
        actor.currentHp = Math.max(1, actor.currentHp - 500);
      }
    }

    // Handle Active Skill trigger if chosen
    if (choice.useSkillIndex !== undefined && choice.useSkillIndex >= 0) {
      const skill = actor.skills[choice.useSkillIndex];
      if (skill && skill.currentCooldown <= 0) {
        skill.currentCooldown = skill.cooldown;
        usedSkillNames.push(skill.name);

        switch (skill.effectType) {
          case 'buff_atk': {
            const descLower = (skill.description || '').toLowerCase();
            const nameLower = skill.name.toLowerCase();
            let cardBuff: 'buster_up' | 'arts_up' | 'quick_up' | null = null;
            if (descLower.includes('buster') || nameLower.includes('mana burst') || nameLower.includes('bravery')) {
              cardBuff = 'buster_up';
            } else if (descLower.includes('arts') || nameLower.includes('fox') || descLower.includes('arts up')) {
              cardBuff = 'arts_up';
            } else if (descLower.includes('quick') || nameLower.includes('primordial rune') || descLower.includes('quick up')) {
              cardBuff = 'quick_up';
            }

            if (cardBuff) {
              actor.activeBuffs.push({
                name: `${skill.name} (${cardBuff === 'buster_up' ? 'Buster' : cardBuff === 'arts_up' ? 'Arts' : 'Quick'} Up)`,
                type: cardBuff,
                value: skill.value,
                remainingTurns: skill.duration
              });
            } else {
              actor.activeBuffs.push({
                name: skill.name,
                type: 'buff_atk',
                value: skill.value,
                remainingTurns: skill.duration
              });
            }
            break;
          }
          case 'buff_def':
            actor.activeBuffs.push({
              name: skill.name,
              type: 'buff_def',
              value: skill.value,
              remainingTurns: skill.duration
            });
            break;
          case 'heal':
            actor.currentHp = Math.min(actor.maxHp, actor.currentHp + skill.value);
            break;
          case 'np_charge':
            actor.npGauge = Math.min(300, actor.npGauge + skill.value);
            break;
          case 'crit_stars':
            actor.critStars += skill.value;
            break;
          case 'evade':
            actor.isEvading = true;
            actor.activeBuffs.push({
              name: skill.name || 'Evade',
              type: 'evade',
              value: 100,
              remainingTurns: skill.duration || 1
            });
            if (skill.id === 'wisdom_dun_scaith') {
              actor.critStars = Math.min(50, (actor.critStars || 0) + 15);
            }
            break;
          case 'guts': {
            const reviveVal = skill.value || Math.round(actor.maxHp * 0.20);
            actor.activeBuffs.push({
              name: skill.name,
              type: 'guts',
              value: reviveVal,
              remainingTurns: skill.duration || 5
            });
            if (skill.id?.includes('thrice')) {
              actor.activeBuffs.push({
                name: `${skill.name} (DEF Up)`,
                type: 'buff_def',
                value: 100,
                remainingTurns: 1
              });
            }
            break;
          }
          case 'debuff': {
            const magicResist = targetPassives.filter(p => p.type === 'magic_resistance').reduce((s, p) => s + p.value, 0);
            const itemConstruct = actorPassives.filter(p => p.type === 'item_construction').reduce((s, p) => s + p.value, 0);
            const effectiveResist = Math.max(0, magicResist - itemConstruct);

            // Drain target NP gauge & apply ATK debuff (Discernment of the Poor / debuff skills)
            const drainAmount = skill.value || 20;
            target.npGauge = Math.max(0, target.npGauge - drainAmount);
            target.activeBuffs.push({
              name: `${skill.name} (ATK Down)`,
              type: 'debuff_atk',
              value: skill.value || 20,
              remainingTurns: skill.duration || 1
            });

            if (effectiveResist <= 0 || Math.random() * 100 >= effectiveResist) {
              target.isStunned = true;
              target.activeBuffs.push({
                name: `${skill.name} (NP Seal / Stun)`,
                type: 'stun',
                value: 100,
                remainingTurns: skill.duration || 1
              });
            }
            break;
          }
          case 'stun':
            target.isStunned = true;
            target.activeBuffs.push({
              name: 'Stunned',
              type: 'stun',
              value: 100,
              remainingTurns: skill.duration
            });
            break;
        }
      }
    }

    // Check Stun state
    if (actor.isStunned) {
      actor.isStunned = false; // wears off
      actor.activeBuffs = actor.activeBuffs
        .map(b => ({ ...b, remainingTurns: b.remainingTurns - 1 }))
        .filter(b => b.remainingTurns > 0);
      if (!actor.activeBuffs.some(b => b.type === 'evade')) actor.isEvading = false;
      if (!actor.activeBuffs.some(b => b.type === 'invincible')) actor.isInvincible = false;
      turnLogs.push({
        turnNumber: state.currentTurn,
        actorId: actor.id,
        actorName: actor.name,
        targetId: target.id,
        targetName: target.name,
        actionSummary: `${actor.name} is Stunned and unable to act this turn!`,
        cardsUsed: [],
        skillsUsed: usedSkillNames,
        damageDealt: 0,
        isCritical: false,
        starsGenerated: 0,
        npCharged: 0,
        actorHpRemaining: actor.currentHp,
        targetHpRemaining: target.currentHp,
        actorHpMax: actor.maxHp,
        targetHpMax: target.maxHp,
        actorNp: actor.npGauge,
        targetNp: target.npGauge
      });
      return;
    }

    // Handle Master Command Seal if activated (Refills whole NP gauge to 100%)
    if (choice.useCommandSeal) {
      actor.npGauge = 100;
      usedSkillNames.push('Command Seal: NP Refilled (100%)');
    }

    // Check Noble Phantasm execution
    let npTriggered = false;
    let npChant: string | undefined;
    let totalDamage = 0;
    let totalStars = 0;
    let totalNpCharge = 0;
    let isCritical = false;

    // Calculate Passives bonuses (Max 2, 2nd unlocked after Bond 5)
    const madnessBonus = actorPassives.filter(p => p.type === 'madness_enhancement').reduce((s, p) => s + p.value, 0);
    const ridingBonus = actorPassives.filter(p => p.type === 'riding').reduce((s, p) => s + p.value, 0);
    const territoryBonus = actorPassives.filter(p => p.type === 'territory_creation').reduce((s, p) => s + p.value, 0);
    const critPassiveBonus = actorPassives.filter(p => p.type === 'independent_action' || p.type === 'oblivion_correction').reduce((s, p) => s + p.value, 0);
    const divinityBonus = actorPassives.filter(p => p.type === 'divinity').reduce((s, p) => s + p.value, 0);
    const presenceConcealBonus = actorPassives.filter(p => p.type === 'presence_concealment').reduce((s, p) => s + p.value, 0);
    const flatDivinity = Math.round(divinityBonus * PVP_DAMAGE_MODIFIER);
    const avengerBonus = targetPassives.filter(p => p.type === 'avenger').reduce((s, p) => s + p.value, 0);

    // Determine ATK & DEF buffs
    const atkBuff = actor.activeBuffs
      .filter(b => b.type === 'buff_atk')
      .reduce((sum, b) => sum + b.value, 0) -
      actor.activeBuffs
      .filter(b => b.type === 'debuff_atk')
      .reduce((sum, b) => sum + b.value, 0);
    const defBuff = target.activeBuffs
      .filter(b => b.type === 'buff_def')
      .reduce((sum, b) => sum + b.value, 0);

    // Card performance buffs (Active Buffs + Passives)
    const busterBuff = actor.activeBuffs
      .filter(b => b.type === 'buster_up' || /mana burst|buster/i.test(b.name))
      .reduce((sum, b) => sum + b.value, 0) +
      (actor.equippedCe?.passiveType === 'buster_up' && actor.equippedCe.id !== 'ce_black_grail' ? (actor.equippedCe.passiveValue || 0) : 0) +
      madnessBonus;

    const artsBuff = actor.activeBuffs
      .filter(b => b.type === 'arts_up' || /arts|fox/i.test(b.name))
      .reduce((sum, b) => sum + b.value, 0) +
      (actor.equippedCe?.passiveType === 'arts_up' ? (actor.equippedCe.passiveValue || 0) : 0) +
      territoryBonus;

    const quickBuff = actor.activeBuffs
      .filter(b => b.type === 'quick_up' || /quick|primordial rune/i.test(b.name))
      .reduce((sum, b) => sum + b.value, 0) +
      (actor.equippedCe?.passiveType === 'quick_up' ? (actor.equippedCe.passiveValue || 0) : 0) +
      ridingBonus;

    const classMult = calculateClassMultiplier(actor.servantClass, target.servantClass);
    const effectiveAtk = actor.atk * (1 + atkBuff / 100) * (1 + (actor.stats.strength * 0.01));
    const effectiveDef = target.def * (1 + defBuff / 100);

    const processHitProtection = (): { isProtected: boolean; isInvincible: boolean; isEvade: boolean } => {
      const actorIgnores = actor.equippedCe?.id === 'ce_origin_bullet' || actor.equippedCe?.passiveType === 'ignore_invincible' || actor.activeBuffs.some(b => b.type === 'ignore_invincible');
      if (actorIgnores) return { isProtected: false, isInvincible: false, isEvade: false };

      const invIdx = target.activeBuffs ? target.activeBuffs.findIndex(b => b.type === 'invincible') : -1;
      if (invIdx !== -1 && target.activeBuffs) {
        const buff = target.activeBuffs[invIdx];
        if (buff.remainingTurns <= 0 || (buff.remainingHits !== undefined && buff.remainingHits <= 0)) {
          target.activeBuffs.splice(invIdx, 1);
          if (!target.activeBuffs.some(b => b.type === 'invincible')) target.isInvincible = false;
        } else {
          const isHitBased = buff.isHitCount || buff.remainingHits !== undefined || /volumen/i.test(buff.name);
          if (isHitBased) {
            if (buff.remainingHits !== undefined) {
              buff.remainingHits--;
              if (buff.remainingHits <= 0) target.activeBuffs.splice(invIdx, 1);
            } else {
              buff.remainingTurns--;
              if (buff.remainingTurns <= 0) target.activeBuffs.splice(invIdx, 1);
            }
          }
          if (!target.activeBuffs.some(b => b.type === 'invincible')) {
            target.isInvincible = false;
          }
          return { isProtected: true, isInvincible: true, isEvade: false };
        }
      } else {
        target.isInvincible = false;
      }

      const evaIdx = target.activeBuffs ? target.activeBuffs.findIndex(b => b.type === 'evade') : -1;
      if (evaIdx !== -1 && target.activeBuffs) {
        const buff = target.activeBuffs[evaIdx];
        if (buff.remainingTurns <= 0 || (buff.remainingHits !== undefined && buff.remainingHits <= 0)) {
          target.activeBuffs.splice(evaIdx, 1);
          if (!target.activeBuffs.some(b => b.type === 'evade')) target.isEvading = false;
        } else {
          const isHitBased = buff.isHitCount || buff.remainingHits !== undefined || /protection from arrows/i.test(buff.name);
          if (isHitBased) {
            if (buff.remainingHits !== undefined) {
              buff.remainingHits--;
              if (buff.remainingHits <= 0) target.activeBuffs.splice(evaIdx, 1);
            } else {
              buff.remainingTurns--;
              if (buff.remainingTurns <= 0) target.activeBuffs.splice(evaIdx, 1);
            }
          }
          if (!target.activeBuffs.some(b => b.type === 'evade')) {
            target.isEvading = false;
          }
          return { isProtected: true, isInvincible: false, isEvade: true };
        }
      } else {
        target.isEvading = false;
      }

      return { isProtected: false, isInvincible: false, isEvade: false };
    };

    let turnWasEvaded = false;
    let turnWasInvincible = false;

    const cards = choice.selectedCards.length === 3 ? choice.selectedCards : ['Buster', 'Arts', 'Quick'] as CardType[];

    // Check Card Chain Bonuses
    let cardChainType: 'Buster Brave' | 'Arts Chain' | 'Quick Chain' | 'Normal' = 'Normal';
    if (cards.every(c => c === 'Buster')) {
      cardChainType = 'Buster Brave';
    } else if (cards.every(c => c === 'Arts')) {
      cardChainType = 'Arts Chain';
      totalNpCharge += 20; // Canonical FGO +20% flat NP gauge battery on Arts Chain
    } else if (cards.every(c => c === 'Quick')) {
      cardChainType = 'Quick Chain';
      // Canonical FGO Quick Chain: Immediate +20 Critical Stars burst into the pool!
      actor.critStars = Math.min(50, (actor.critStars || 0) + 20);
      totalStars += 20;
    }

    let actionText = '';

    // If NP is ready and requested
    if (choice.useNoblePhantasm && actor.npGauge >= 100) {
      npTriggered = true;
      npChant = actor.noblePhantasm.chant;
      const npOutcome = executeNoblePhantasmLogic(actor, target, classMult);

      totalDamage += npOutcome.damageDealt;
      totalNpCharge += npOutcome.npCharged;
      totalStars += npOutcome.starsGenerated;
      actor.npGauge = 0; // consume gauge
      turnWasEvaded = npOutcome.isEvaded || false;
      turnWasInvincible = npOutcome.isInvincible || false;

      actionText = npOutcome.actionSummary;
    } else {
      // Calculate 3-card chain attacks
      cards.forEach((card, idx) => {
        const positionMultiplier = 1.0 + idx * 0.15; // 1st: 1.0x, 2nd: 1.15x, 3rd: 1.30x

        // Critical hit check based on Agility + Luck + Stars + Quick Chain Bonus
        const quickChainCritBonus = cardChainType === 'Quick Chain' ? 0.25 : 0.0;
        const critChance = Math.min(0.95, (actor.stats.agility * 0.01) + ((actor.critStars || 0) * 0.02) + quickChainCritBonus);
        const cardIsCrit = Math.random() < critChance;
        if (cardIsCrit) isCritical = true;
        const quickChainCritDmg = cardChainType === 'Quick Chain' ? 0.30 : 0.0;
        const ceCritBonus = (actor.equippedCe?.passiveType === 'crit_dmg' ? (actor.equippedCe.passiveValue || 0) : 0) / 100;
        const critMultiplier = cardIsCrit ? 1.75 + (actor.stats.luck * 0.01) + (critPassiveBonus / 100) + ceCritBonus + quickChainCritDmg : 1.0;

        let cardDmgMult = 1.0;
        let cardNpMult = 1.0;
        let cardStarMult = 1.0;

        if (card === 'Buster') {
          cardDmgMult = 1.4 * (1.0 + busterBuff / 100); // Buster deals strong base dmg boosted by Buster buffs
          cardNpMult = 0.0;
          cardStarMult = 0.2;
        } else if (card === 'Arts') {
          cardDmgMult = 1.0;
          let artsNpScale = (1.2 + (actor.stats.mana * 0.02)) * (1.0 + artsBuff / 100); // Balanced Arts NP charge
          if (actor.equippedCe?.id === 'ce_jeweled_sword') artsNpScale *= 1.15;
          if (actor.equippedCe?.id === 'ce_formal_craft') artsNpScale *= 1.10;
          cardNpMult = artsNpScale;
          cardStarMult = 0.2;
        } else if (card === 'Quick') {
          cardDmgMult = 0.85;
          cardNpMult = 0.4 * (1.0 + quickBuff / 100);
          cardStarMult = (1.4 + (actor.stats.agility * 0.02)) * (1.0 + (quickBuff + presenceConcealBonus) / 100); // Balanced Quick star drop
        }

        // Apply chain bonus
        if (cardChainType === 'Buster Brave') cardDmgMult += 0.35;
        if (cardChainType === 'Arts Chain') cardNpMult += 0.6;
        if (cardChainType === 'Quick Chain') cardStarMult += 1.0;

        let hitDmg = Math.max(
          100,
          ((effectiveAtk * 0.11 * cardDmgMult * positionMultiplier * critMultiplier * classMult) - (effectiveDef * 0.2))
        );

        // Origin Bullet special bonus vs Caster or high Mana
        if (actor.equippedCe?.id === 'ce_origin_bullet' && (target.servantClass === 'Caster' || target.stats.mana >= 12)) {
          hitDmg = Math.round(hitDmg * 1.35);
        }

        const hitProt = processHitProtection();
        if (hitProt.isProtected) {
          hitDmg = 0;
          if (hitProt.isInvincible) turnWasInvincible = true;
          if (hitProt.isEvade) turnWasEvaded = true;
        }

        totalDamage += Math.round(hitDmg * PVP_DAMAGE_MODIFIER) + (hitDmg > 0 ? flatDivinity : 0);
        totalNpCharge += Math.round(5 * cardNpMult * (actor.stats.mana / 15));
        totalStars += Math.round(2 * cardStarMult);
      });

      // Consume turn-based and hit-based Evade / Invincibility and tick DEF buffs after defending against this attack sequence
      if (target.activeBuffs) {
        target.activeBuffs = target.activeBuffs.filter(b => {
          const isHitBased = b.isHitCount || b.remainingHits !== undefined || /volumen|protection from arrows/i.test(b.name);
          if (b.type === 'evade' || b.type === 'invincible') {
            b.remainingTurns--;
            if (b.remainingTurns <= 0) return false;
            if (isHitBased && b.remainingHits !== undefined && b.remainingHits <= 0) return false;
            return true;
          }
          if (b.type === 'buff_def' && b.remainingTurns < 90) {
            b.remainingTurns--;
            return b.remainingTurns > 0;
          }
          return true;
        });
        if (!target.activeBuffs.some(b => b.type === 'evade')) target.isEvading = false;
        if (!target.activeBuffs.some(b => b.type === 'invincible')) target.isInvincible = false;
      }

      const chainNotice = cardChainType === 'Quick Chain'
        ? `\n🟢 **QUICK CHAIN BONUS:** +20 Critical Stars added & +25% Crit Rate!`
        : cardChainType === 'Buster Brave'
        ? `\n🔴 **BUSTER BRAVE CHAIN:** +35% Card Damage Power!`
        : cardChainType === 'Arts Chain'
        ? `\n🔵 **ARTS CHAIN:** +20% Flat NP Gauge Battery!`
        : '';
      const critNotice = isCritical ? ' ⚡ **CRITICAL HIT!**' : '';
      actionText = `⚔️ ${actor.name} executed a ${cards.join(' • ')} sequence dealing ${totalDamage.toLocaleString()} DMG!${critNotice}${chainNotice}`;
    }

    if (usedSkillNames.length > 0) {
      let quotePrefix = '';
      if (choice.useCommandSeal) {
        const sealQuote = actor.customQuotes?.commandSeal || `By my Command Seal! ${actor.name}, refill your Noble Phantasm and shatter enemy lines!`;
        quotePrefix = `🔱 **[COMMAND SEAL]** *“${sealQuote}”*\n`;
      } else if (choice.useSkillIndex !== undefined && choice.useSkillIndex >= 0 && actor.skills[choice.useSkillIndex]) {
        const sk = actor.skills[choice.useSkillIndex];
        const skQuote = actor.customQuotes?.skill || `Activating ${sk.name}! ${sk.description}`;
        quotePrefix = `💬 **[${sk.name}]** *“${skQuote}”*\n`;
      }
      actionText = quotePrefix + `✨ **${actor.name}** activated **${usedSkillNames.join(', ')}**!\n` + actionText;
    }

    // Check "The Weight of Heaven EX" passive (Aethel Gravitational Aura - Actor)
    const weightPassive = actorPassives.find(p => p.type === 'the_weight_of_heaven' || (p.name && p.name.includes('Weight of Heaven')));
    if (weightPassive && target.stats.mana < actor.stats.mana) {
      const auraDmg = weightPassive.value || 2000;
      totalDamage += auraDmg;
      actionText += `\n🌌 **[The Weight of Heaven EX]** Dense draconic aura crushed ${target.name} for ${auraDmg.toLocaleString()} true HP damage! (Enemy Mana: ${target.stats.mana} < ${actor.name} Mana: ${actor.stats.mana})`;
    }

    // Check if Target has "The Weight of Heaven EX" passive (Aethel Gravitational Aura - Target)
    const targetWeight = targetPassives.find(p => p.type === 'the_weight_of_heaven' || (p.name && p.name.includes('Weight of Heaven')));
    if (targetWeight && actor.stats.mana < target.stats.mana) {
      const auraDmg = targetWeight.value || 2000;
      actor.currentHp = Math.max(0, actor.currentHp - auraDmg);
      actionText += `\n🌌 **[Enemy Weight of Heaven EX]** ${target.name}'s dense aura crushed ${actor.name} for ${auraDmg.toLocaleString()} true HP damage! (Mana: ${actor.stats.mana} < ${target.stats.mana})`;
    }

    // Apply damage to target
    target.currentHp = Math.max(0, target.currentHp - totalDamage);
    actor.npGauge = Math.min(300, actor.npGauge + totalNpCharge);
    actor.critStars = Math.min(50, (actor.critStars || 0) + totalStars);

    // Guts Check (Battle Continuation)
    const gutsBuffIndex = target.activeBuffs.findIndex(b => b.type === 'guts');
    if (target.currentHp <= 0 && gutsBuffIndex !== -1) {
      const gutsBuff = target.activeBuffs[gutsBuffIndex];
      const reviveHp = gutsBuff.value || Math.round(target.maxHp * 0.20);
      target.currentHp = reviveHp;
      target.activeBuffs.splice(gutsBuffIndex, 1);
      actionText += `\n✝️ **BATTLE CONTINUATION!** ${target.name} revived with **${reviveHp.toLocaleString()} HP**!`;
    }

    // Defender Avenger Passive: NP refill when suffering damage
    if (avengerBonus > 0 && totalDamage > 0) {
      const avengerRefund = Math.round(12 * (1.0 + avengerBonus / 100));
      target.npGauge = Math.min(300, target.npGauge + avengerRefund);
      actionText += `\n🖤 **[Avenger]** ${target.name} gained +${avengerRefund}% NP from suffering damage!`;
    }

    // Generate Turn Dialogue Quote
    const dialogueInfo = generateTurnDialogueQuote(actor, target, choice, classMult, isCritical);
    const dialogueQuote = dialogueInfo.quoteText;
    const dialogueTag = dialogueInfo.tag;
    const dialogueTitle = dialogueInfo.speakerTitle;

    // Decrement buff durations (offensive/attack-phase buffs only!)
    // Defensive buffs (evade, invincible, buff_def, guts) must NOT decrement when attacking!
    actor.activeBuffs = actor.activeBuffs
      .map(b => {
        if (
          b.type === 'buff_atk' ||
          b.type === 'debuff_atk' ||
          b.type === 'buster_up' ||
          b.type === 'arts_up' ||
          b.type === 'quick_up' ||
          b.type === 'crit_dmg' ||
          b.type === 'np_gen'
        ) {
          return { ...b, remainingTurns: b.remainingTurns - 1 };
        }
        return b;
      })
      .filter(b => b.remainingTurns > 0);
    if (!actor.activeBuffs.some(b => b.type === 'evade')) actor.isEvading = false;
    if (!actor.activeBuffs.some(b => b.type === 'invincible')) actor.isInvincible = false;

    turnLogs.push({
      turnNumber: state.currentTurn,
      actorId: actor.id,
      actorName: actor.name,
      targetId: target.id,
      targetName: target.name,
      actionSummary: actionText,
      cardChainType,
      cardsUsed: cards,
      skillsUsed: usedSkillNames,
      npTriggered,
      npChant: npChant || (npTriggered ? dialogueQuote : undefined),
      dialogueQuote,
      dialogueTag,
      dialogueTitle,
      damageDealt: totalDamage,
      isCritical,
      isEvaded: turnWasEvaded,
      isInvincible: turnWasInvincible,
      starsGenerated: totalStars,
      npCharged: totalNpCharge,
      actorHpRemaining: actor.currentHp,
      targetHpRemaining: target.currentHp,
      actorHpMax: actor.maxHp,
      targetHpMax: target.maxHp,
      actorNp: actor.npGauge,
      targetNp: target.npGauge
    });
  };

  // Execute 1st and 2nd combatants
  resolveActorTurn(firstActor, secondActor, firstChoice);
  resolveActorTurn(secondActor, firstActor, secondChoice);

  // Clean up any expired buffs and sync defensive booleans
  p1.activeBuffs = p1.activeBuffs.filter(b => b.remainingTurns > 0 && (!b.isHitCount || b.remainingHits === undefined || b.remainingHits > 0));
  p2.activeBuffs = p2.activeBuffs.filter(b => b.remainingTurns > 0 && (!b.isHitCount || b.remainingHits === undefined || b.remainingHits > 0));
  p1.isInvincible = p1.activeBuffs.some(b => b.type === 'invincible');
  p2.isInvincible = p2.activeBuffs.some(b => b.type === 'invincible');
  p1.isEvading = p1.activeBuffs.some(b => b.type === 'evade');
  p2.isEvading = p2.activeBuffs.some(b => b.type === 'evade');

  // Check victory condition
  let winnerId: string | undefined;
  let nextPhase: BattleState['turnPhase'] = 'card_selection';

  if (p1.currentHp <= 0 && p2.currentHp <= 0) {
    nextPhase = 'victory';
    winnerId = p1Speed >= p2Speed ? p1.id : p2.id;
  } else if (p2.currentHp <= 0) {
    nextPhase = 'victory';
    winnerId = p1.id;
  } else if (p1.currentHp <= 0) {
    nextPhase = 'defeat';
    winnerId = p2.id;
  }

  const updatedState: BattleState = {
    ...state,
    player1: p1,
    player2: p2,
    currentTurn: state.currentTurn + 1,
    turnPhase: nextPhase,
    turnHistory: [...state.turnHistory, ...turnLogs],
    winnerId
  };

  return { updatedState, turnLogs };
}
