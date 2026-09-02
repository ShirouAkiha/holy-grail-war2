import {
  ActiveCombatant,
  BattleState,
  CardType,
  CombatTurnLog,
  MasterServantInstance,
  ServantClass,
  TurnActionChoice
} from '../types';
import { SERVANT_DATABASE } from '../data/servants';

// Global PvP damage modifier (0.35x) to scale FGO-style formula output down to ~25k-35k Servant HP pools
export const PVP_DAMAGE_MODIFIER = 0.35;

// ==========================================
// 1. CLASS AFFINITY MULTIPLIER ENGINE
// ==========================================
// Evaluates the damage multiplier between attacker and defender classes according to canonical Fate rules:
// - Standard Knight Triangle: Saber beats Lancer, Lancer beats Archer, Archer beats Saber.
// - Standard Cavalry Triangle: Rider beats Caster, Caster beats Assassin, Assassin beats Rider.
// - Berserker: 1.35x damage dealt, 1.35x damage taken.
// - Ruler / Avenger / Foreigner special affinities.
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

  // Berserker: Glass Cannon (Deals 1.35x to all, Takes 1.35x from all)
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

// ==========================================
// 2. COMBATANT INITIALIZER
// ==========================================
// Converts a Master's saved Servant data + equipped Craft Essence into an active combatant state object.
export function createCombatantFromMasterServant(
  servantInstance: MasterServantInstance,
  masterName: string,
  overrideCurrentHp?: number
): ActiveCombatant {
  const templateId = servantInstance.templateId || servantInstance.template?.id || servantInstance.id;
  const canonical = SERVANT_DATABASE.find(s => s.id === templateId) || servantInstance.template || servantInstance;
  const t = { ...canonical, ...(servantInstance.template?.isCustomOrMeme ? servantInstance.template : {}) };
  const ce = servantInstance.equippedCe;
  const base = t.baseStats || { strength: 10, endurance: 10, agility: 10, mana: 10, luck: 10 };

  // Sum base parameters + allocated points
  const totalStr = (base.strength || 10) + (servantInstance.allocatedStats?.strength || 0);
  const totalEnd = (base.endurance || 10) + (servantInstance.allocatedStats?.endurance || 0);
  const totalAgi = (base.agility || 10) + (servantInstance.allocatedStats?.agility || 0);
  const totalMna = (base.mana || 10) + (servantInstance.allocatedStats?.mana || 0);
  const totalLck = (base.luck || 10) + (servantInstance.allocatedStats?.luck || 0);

  // Craft Essence equipment bonuses
  const ceHp = ce ? (ce.hpBonus || 0) : 0;
  const ceAtk = ce ? (ce.atkBonus || 0) : 0;

  const lvl = servantInstance.level || 1;
  const baseHp = t.baseHp || 28000;
  const baseAtk = t.baseAtk || 10000;

  // Scaled calculations based on Servant level and Parameter distribution
  const maxHp = Math.round(baseHp * (1 + (lvl - 1) * 0.05) + totalEnd * 150 + ceHp);
  const rawAtk = Math.round(baseAtk * (1 + (lvl - 1) * 0.05) + totalStr * 80 + ceAtk);
  const def = Math.round(totalEnd * 25);

  // Starting NP bonus from Craft Essence (e.g. Starting NP +50% / +80%)
  let initialNp = 0;
  if (ce && ce.passiveType === 'starting_np') {
    initialNp = ce.passiveValue;
  }

  const startingHp = overrideCurrentHp !== undefined && overrideCurrentHp > 0
    ? Math.min(maxHp, Math.round(overrideCurrentHp))
    : maxHp;

  return {
    id: servantInstance.id,
    name: servantInstance.nickname || t.name,
    masterName,
    servantClass: t.servantClass,
    avatarUrl: t.avatarUrl,
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
    activeBuffs: [],
    skills: t.skills.map(s => ({ ...s, currentCooldown: 0 })),
    noblePhantasm: { ...t.noblePhantasm },
    critStars: 0,
    bondLevel: servantInstance.bondLevel || 1,
    equippedCe: ce
  };
}

// ==========================================
// 3. BATTLE STATE FACTORY
// ==========================================
export function initializeBattle(
  combatant1: ActiveCombatant,
  combatant2: ActiveCombatant,
  battleId?: string,
  grailWarId?: string
): BattleState {
  return {
    battleId: battleId || `battle_${Date.now()}`,
    player1: { ...combatant1 },
    player2: { ...combatant2 },
    currentTurn: 1,
    turnPhase: 'card_selection',
    turnHistory: [],
    grailWarId
  };
}

// ==========================================
// 4. COMBAT TURN CALCULATION ENGINE
// ==========================================
// Computes damage, card modifiers, critical strikes, NP gain, and logs every hit.
export function resolveCombatTurn(
  battle: BattleState,
  attackerChoice: TurnActionChoice,
  defenderChoice: TurnActionChoice
): BattleState {
  const isP1Attacker = attackerChoice.combatantId === battle.player1.id;
  const attacker = isP1Attacker ? battle.player1 : battle.player2;
  const defender = isP1Attacker ? battle.player2 : battle.player1;

  let totalDmg = 0;
  let isCrit = false;
  let npGain = 0;
  let starsGen = 0;

  // Calculate active buffs for attacker and defender
  let atkBuff = 1.0;
  let defBuff = 1.0;
  let isEvading = defender.isEvading || false;

  for (const b of attacker.activeBuffs || []) {
    if (b.type === 'buff_atk') atkBuff += b.value / 100;
  }
  for (const b of defender.activeBuffs || []) {
    if (b.type === 'buff_def') defBuff += b.value / 100;
    if (b.type === 'evade') isEvading = true;
  }

  const effectiveAtk = attacker.atk * atkBuff;
  const effectiveDef = defender.def * defBuff;
  const classMultiplier = calculateClassMultiplier(attacker.servantClass, defender.servantClass);

  // Evaluate First Card Lead Bonuses
  const firstCard = attackerChoice.selectedCards[0];
  const isBusterFirst = firstCard === 'Buster';
  const isArtsFirst = firstCard === 'Arts';
  const isQuickFirst = firstCard === 'Quick';

  // Evaluate Type Chains (3 cards of the exact same color)
  const is3Cards = attackerChoice.selectedCards.length === 3;
  const isBusterChain = is3Cards && attackerChoice.selectedCards.every(c => c === 'Buster');
  const isArtsChain = is3Cards && attackerChoice.selectedCards.every(c => c === 'Arts');
  const isQuickChain = is3Cards && attackerChoice.selectedCards.every(c => c === 'Quick');

  // Buster Chain Bonus: Flat 20% of Servant's Base ATK per hit
  const busterChainBonusDmg = isBusterChain ? Math.round(attacker.atk * 0.20 * PVP_DAMAGE_MODIFIER) : 0;

  // Arts Chain Bonus: Instant +20% NP Gauge
  if (isArtsChain) {
    attacker.npGauge = Math.min(300, attacker.npGauge + 20);
  }

  // Quick Chain Bonus: Instant +20 Critical Stars
  if (isQuickChain) {
    starsGen += 20;
  }

  const chainTags: string[] = [];
  if (isBusterFirst) chainTags.push('🔥 Buster First (+50% DMG to remaining cards)');
  if (isArtsFirst) chainTags.push('🌊 Arts First (+100% NP Gain to remaining cards)');
  if (isQuickFirst) chainTags.push('⚡ Quick First (+20% Crit Rate & Stars to remaining cards)');

  if (isBusterChain) chainTags.push('🔴 BUSTER CHAIN (+20% Base ATK Bonus Damage per hit)');
  if (isArtsChain) chainTags.push('🔵 ARTS CHAIN (+20% Instant NP Charge)');
  if (isQuickChain) chainTags.push('🟢 QUICK CHAIN (+20 Instant Critical Stars)');

  // Position multipliers in FGO sequence: 1st = 1.0x, 2nd = 1.2x, 3rd = 1.4x
  const positionMultipliers = [1.0, 1.2, 1.4];

  // Process chosen Command Cards
  for (let i = 0; i < attackerChoice.selectedCards.length; i++) {
    const card = attackerChoice.selectedCards[i];
    const posMult = positionMultipliers[i] || 1.0;
    let cardMultiplier = 1.0;
    let cardNpGain = 0;
    let cardStarGen = 0;

    // BUSTER: Heavy physical hit
    if (card === 'Buster') {
      cardMultiplier = 1.5 * posMult;
      if (attacker.equippedCe && (attacker.equippedCe.passiveType === 'buster_up' || attacker.equippedCe.id === 'ce_limited_zero_over' || attacker.equippedCe.id === 'ce_verdant_sound')) {
        const val = attacker.equippedCe.passiveValue || 15;
        cardMultiplier *= (1 + val / 100);
      }
      cardNpGain += 8;
      cardStarGen += 3;
    } 
    // ARTS: High NP gauge generation
    else if (card === 'Arts') {
      cardMultiplier = 1.0 * posMult;
      if (attacker.equippedCe && (attacker.equippedCe.passiveType === 'arts_up' || attacker.equippedCe.id === 'ce_formal_craft' || attacker.equippedCe.id === 'ce_projection')) {
        const val = attacker.equippedCe.passiveValue || 15;
        cardMultiplier *= (1 + val / 100);
      }
      cardNpGain += 32;
      cardStarGen += 2;
    } 
    // QUICK: High Critical Star drop rate
    else if (card === 'Quick') {
      cardMultiplier = 0.80 * posMult;
      if (attacker.equippedCe && (attacker.equippedCe.passiveType === 'quick_up' || attacker.equippedCe.id === 'ce_imaginary_around' || attacker.equippedCe.id === 'ce_gandr' || attacker.equippedCe.id === 'ce_when_the_flowers_fall')) {
        const val = attacker.equippedCe.passiveValue || 15;
        cardMultiplier *= (1 + val / 100);
      }
      cardNpGain += 12;
      cardStarGen += 22;
    }

    // Apply First Card Lead Bonuses to cards 2 and 3 (i > 0) or all cards
    if (i > 0) {
      if (isBusterFirst) {
        cardMultiplier += 0.50; // +50% flat damage bonus
      }
      if (isArtsFirst) {
        cardNpGain *= 2.0; // +100% NP gain modifier
      }
      if (isQuickFirst) {
        cardStarGen += 8; // +20% star drop rate
      }
    }

    npGain += cardNpGain;
    starsGen += cardStarGen;

    // Critical Hit determination based on gathered stars + Quick First bonus
    let critChance = Math.min(0.95, ((attacker.critStars || 0) * 2.0) / 100);
    if (i > 0 && isQuickFirst) {
      critChance = Math.min(0.95, critChance + 0.20);
    }

    const hitCrit = Math.random() < critChance;
    if (hitCrit) isCrit = true;

    // Balanced Tactical Damage Formula: (ATK * CardMod * 0.11 - DEF * 2) * ClassAdvantage * CritMult * Variance + ChainBonus
    const variance = 0.95 + Math.random() * 0.10;
    const baseHit = (effectiveAtk * cardMultiplier * 0.11) - (effectiveDef * 2);
    
    let critMult = 1.75;
    if (hitCrit && attacker.equippedCe) {
      if (attacker.equippedCe.passiveType === 'crit_dmg' || attacker.equippedCe.id === 'ce_gamer_fuel' || attacker.equippedCe.id === 'ce_hydra_dagger') {
        const val = attacker.equippedCe.passiveValue || 15;
        critMult += val / 100;
      }
    }

    let hitDamage = Math.max(300, Math.round(baseHit * classMultiplier * (hitCrit ? critMult : 1.0) * variance)) + busterChainBonusDmg;

    if (isEvading) {
      hitDamage = Math.round(hitDamage * 0.15);
      isEvading = false; // consume evade
    }

    totalDmg += Math.round(hitDamage * PVP_DAMAGE_MODIFIER);
  }

  // Brave Chain Extra Attack (Finisher hit if 3 cards were selected)
  if (is3Cards) {
    chainTags.push('⚔️ BRAVE CHAIN (Extra Attack Finisher)');
    const extraBase = (effectiveAtk * 1.2 * 0.11) - (effectiveDef * 2);
    const extraDamage = Math.max(400, Math.round(extraBase * classMultiplier * (0.95 + Math.random() * 0.10)));
    totalDmg += Math.round(extraDamage * PVP_DAMAGE_MODIFIER);
    npGain += 10;
    starsGen += 5;
  }

  let npTriggered = false;
  let npChant = undefined;

  // Trigger Noble Phantasm if requested & gauge is >= 100%
  if (attackerChoice.useNoblePhantasm && attacker.npGauge >= 100) {
    npTriggered = true;
    npChant = attacker.noblePhantasm.chant;
    const npMult = (attacker.noblePhantasm.multiplier || 380) / 100;
    const variance = 0.96 + Math.random() * 0.08;
    const npBaseDmg = (effectiveAtk * npMult * 0.18) * classMultiplier;

    // CE NP Damage Boost
    let npDamageMultiplier = 1.0;
    if (attacker.equippedCe) {
      if (attacker.equippedCe.id === 'ce_black_grail') {
        npDamageMultiplier += 0.60;
      } else if (attacker.equippedCe.id === 'ce_heavens_feel') {
        npDamageMultiplier += 0.40;
      } else if (attacker.equippedCe.id === 'ce_when_the_flowers_fall') {
        npDamageMultiplier += 0.05;
      }
    }

    let npDmg = Math.round(npBaseDmg * npDamageMultiplier * variance);
    npDmg = Math.max(1500, npDmg);

    if (isEvading) {
      npDmg = Math.round(npDmg * 0.20);
    }

    totalDmg += Math.round(npDmg * PVP_DAMAGE_MODIFIER);
    attacker.npGauge = 0; // Consume gauge
  } else {
    attacker.npGauge = Math.min(300, attacker.npGauge + npGain);
  }

  attacker.critStars = Math.min(50, (attacker.critStars || 0) + starsGen);
  defender.currentHp = Math.max(0, defender.currentHp - totalDmg);

  // Apply end-of-turn passive adjustments for attacker and defender
  const applyEndTurnPassives = (combatant: ActiveCombatant) => {
    if (!combatant.equippedCe) return;
    const ce = combatant.equippedCe;

    // Prisma Cosmos / When the Flowers Fall turn NP regeneration
    if (ce.id === 'ce_prisma_cosmos') {
      combatant.npGauge = Math.min(300, combatant.npGauge + 8);
    } else if (ce.id === 'ce_when_the_flowers_fall') {
      combatant.npGauge = Math.min(300, combatant.npGauge + 4);
    }

    // A Fragment of 2030 (10 stars turn)
    if (ce.id === 'ce_fragment_2030') {
      combatant.critStars = Math.min(50, (combatant.critStars || 0) + 10);
    }

    // Black Grail -500 HP self-burn
    if (ce.id === 'ce_black_grail') {
      combatant.currentHp = Math.max(1, combatant.currentHp - 500);
    }
  };

  applyEndTurnPassives(attacker);
  applyEndTurnPassives(defender);

  const chainSummaryStr = chainTags.length > 0 ? `\n⛓️ **Chains Triggered:** ${chainTags.join(' • ')}` : '';

  // Generate combat log entry
  const log: CombatTurnLog = {
    turnNumber: battle.currentTurn,
    actorId: attacker.id,
    actorName: attacker.name,
    targetId: defender.id,
    targetName: defender.name,
    actionSummary: `${attacker.name} attacked with [${attackerChoice.selectedCards.join(', ')}] dealing ${totalDmg.toLocaleString()} damage.${chainSummaryStr}`,
    cardsUsed: attackerChoice.selectedCards,
    p1Cards: isP1Attacker ? attackerChoice.selectedCards : defenderChoice.selectedCards,
    p2Cards: isP1Attacker ? defenderChoice.selectedCards : attackerChoice.selectedCards,
    skillsUsed: [],
    npTriggered,
    isNoblePhantasm: npTriggered,
    npChant,
    damageDealt: totalDmg,
    isCritical: isCrit,
    starsGenerated: starsGen,
    npCharged: npGain,
    actorHpRemaining: attacker.currentHp,
    targetHpRemaining: defender.currentHp,
    actorHpMax: attacker.maxHp,
    targetHpMax: defender.maxHp,
    actorNp: attacker.npGauge,
    targetNp: defender.npGauge
  };

  battle.turnHistory.push(log);
  battle.currentTurn++;

  // Victory check
  if (defender.currentHp <= 0) {
    battle.turnPhase = 'victory';
    battle.winnerId = attacker.id;
  }

  return { ...battle };
}
