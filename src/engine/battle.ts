import {
  ActiveCombatant,
  BattleState,
  CardType,
  CombatTurnLog,
  MasterServantInstance,
  ServantClass,
  TurnActionChoice
} from '../types';

// ==========================================
// 1. CLASS AFFINITY MULTIPLIER ENGINE
// ==========================================
// Evaluates the damage multiplier between attacker and defender classes according to canonical Fate rules:
// - Standard Knight Triangle: Saber beats Lancer, Lancer beats Archer, Archer beats Saber.
// - Standard Cavalry Triangle: Rider beats Caster, Caster beats Assassin, Assassin beats Rider.
// - Berserker: 1.5x damage dealt, 1.5x damage taken.
// - Ruler / Avenger / Foreigner special affinities.
export function calculateClassMultiplier(attackerClass: ServantClass, defenderClass: ServantClass): number {
  if (attackerClass === defenderClass) return 1.0;

  // Knight Triangle: Saber > Lancer > Archer > Saber
  if (attackerClass === 'Saber' && defenderClass === 'Lancer') return 1.5;
  if (attackerClass === 'Lancer' && defenderClass === 'Archer') return 1.5;
  if (attackerClass === 'Archer' && defenderClass === 'Saber') return 1.5;
  if (attackerClass === 'Saber' && defenderClass === 'Archer') return 0.5;
  if (attackerClass === 'Lancer' && defenderClass === 'Saber') return 0.5;
  if (attackerClass === 'Archer' && defenderClass === 'Lancer') return 0.5;

  // Cavalry Triangle: Rider > Caster > Assassin > Rider
  if (attackerClass === 'Rider' && defenderClass === 'Caster') return 1.5;
  if (attackerClass === 'Caster' && defenderClass === 'Assassin') return 1.5;
  if (attackerClass === 'Assassin' && defenderClass === 'Rider') return 1.5;
  if (attackerClass === 'Rider' && defenderClass === 'Assassin') return 0.5;
  if (attackerClass === 'Caster' && defenderClass === 'Rider') return 0.5;
  if (attackerClass === 'Assassin' && defenderClass === 'Caster') return 0.5;

  // Berserker: Glass Cannon (Deals 1.5x to all, Takes 1.5x from all)
  if (attackerClass === 'Berserker') return 1.5;
  if (defenderClass === 'Berserker') return 1.5;

  // Ruler: Resists standard 6 classes
  if (defenderClass === 'Ruler' && ['Saber', 'Archer', 'Lancer', 'Rider', 'Caster', 'Assassin'].includes(attackerClass)) {
    return 0.5;
  }
  if (attackerClass === 'Avenger' && defenderClass === 'Ruler') return 2.0;

  // Meme class: Shitposter deals chaotic 1.25x
  if (attackerClass === 'Shitposter') return 1.25;

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
  const t = servantInstance.template || servantInstance;
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
  const baseHp = t.baseHp || 12000;
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
    critStars: 0
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

  // Process chosen Command Cards
  for (let i = 0; i < attackerChoice.selectedCards.length; i++) {
    const card = attackerChoice.selectedCards[i];
    let cardMultiplier = 1.0;

    // BUSTER: 1.5x damage bonus
    if (card === 'Buster') {
      cardMultiplier = 1.5;
      npGain += 8;
      starsGen += 3;
    } 
    // ARTS: High NP gauge generation
    else if (card === 'Arts') {
      cardMultiplier = 1.0;
      npGain += 32;
      starsGen += 2;
    } 
    // QUICK: High Critical Star drop rate
    else if (card === 'Quick') {
      cardMultiplier = 0.80;
      npGain += 12;
      starsGen += 22;
    }

    // Critical Hit determination based on gathered stars
    const critChance = Math.min(0.95, ((attacker.critStars || 0) * 2.0) / 100);
    const hitCrit = Math.random() < critChance;
    if (hitCrit) isCrit = true;

    // Canonical FGO Damage Formula: (ATK * CardMod * 0.23 - DEF * 4) * ClassAdvantage * CritMult * Variance
    const variance = 0.95 + Math.random() * 0.10;
    const baseHit = (effectiveAtk * cardMultiplier * 0.23) - (effectiveDef * 4);
    let hitDamage = Math.max(500, Math.round(baseHit * classMultiplier * (hitCrit ? 2.0 : 1.0) * variance));

    if (isEvading) {
      hitDamage = Math.round(hitDamage * 0.15);
      isEvading = false; // consume evade
    }

    totalDmg += hitDamage;
  }

  let npTriggered = false;
  let npChant = undefined;

  // Trigger Noble Phantasm if requested & gauge is >= 100%
  if (attackerChoice.useNoblePhantasm && attacker.npGauge >= 100) {
    npTriggered = true;
    npChant = attacker.noblePhantasm.chant;
    const npMult = (attacker.noblePhantasm.multiplier || 500) / 100;
    const variance = 0.96 + Math.random() * 0.08;
    let npDmg = Math.round((effectiveAtk * npMult * 0.18) * classMultiplier * variance);
    npDmg = Math.max(3500, npDmg);

    if (isEvading) {
      npDmg = Math.round(npDmg * 0.25);
    }

    totalDmg += npDmg;
    attacker.npGauge = 0; // Consume gauge
  } else {
    attacker.npGauge = Math.min(300, attacker.npGauge + npGain);
  }

  attacker.critStars = Math.min(50, (attacker.critStars || 0) + starsGen);
  defender.currentHp = Math.max(0, defender.currentHp - totalDmg);

  // Generate combat log entry
  const log: CombatTurnLog = {
    turnNumber: battle.currentTurn,
    actorId: attacker.id,
    actorName: attacker.name,
    targetId: defender.id,
    targetName: defender.name,
    actionSummary: `${attacker.name} attacked with [${attackerChoice.selectedCards.join(', ')}] dealing ${totalDmg} damage.`,
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
