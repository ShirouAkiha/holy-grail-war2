import {
  ActiveCombatant,
  BattleState,
  CardType,
  CombatTurnLog,
  MasterServantInstance,
  ServantClass,
  TurnActionChoice
} from '../types';

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

export function createCombatantFromMasterServant(
  servantInstance: MasterServantInstance,
  masterName: string
): ActiveCombatant {
  const t = servantInstance.template;
  const ce = servantInstance.equippedCe;

  const totalStr = t.baseStats.strength + (servantInstance.allocatedStats?.strength || 0);
  const totalEnd = t.baseStats.endurance + (servantInstance.allocatedStats?.endurance || 0);
  const totalAgi = t.baseStats.agility + (servantInstance.allocatedStats?.agility || 0);
  const totalMna = t.baseStats.mana + (servantInstance.allocatedStats?.mana || 0);
  const totalLck = t.baseStats.luck + (servantInstance.allocatedStats?.luck || 0);

  const ceHp = ce ? (ce.hpBonus || 0) : 0;
  const ceAtk = ce ? (ce.atkBonus || 0) : 0;

  const maxHp = Math.round(t.baseHp * (1 + (servantInstance.level - 1) * 0.05) + totalEnd * 150 + ceHp);
  const rawAtk = Math.round(t.baseAtk * (1 + (servantInstance.level - 1) * 0.05) + totalStr * 80 + ceAtk);
  const def = Math.round(totalEnd * 25);

  let initialNp = 0;
  if (ce && ce.passiveType === 'starting_np') {
    initialNp = ce.passiveValue;
  }

  return {
    id: servantInstance.id,
    name: servantInstance.nickname || t.name,
    masterName,
    servantClass: t.servantClass,
    avatarUrl: t.avatarUrl,
    maxHp,
    currentHp: maxHp,
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

  const classMultiplier = calculateClassMultiplier(attacker.servantClass, defender.servantClass);

  for (const card of attackerChoice.selectedCards) {
    let cardMultiplier = 1.0;
    if (card === 'Buster') {
      cardMultiplier = 1.5;
      npGain += 5;
      starsGen += 2;
    } else if (card === 'Arts') {
      cardMultiplier = 1.0;
      npGain += 30;
      starsGen += 1;
    } else if (card === 'Quick') {
      cardMultiplier = 0.8;
      npGain += 10;
      starsGen += 15;
    }

    const hitCrit = Math.random() < ((attacker.critStars || 0) / 100);
    if (hitCrit) isCrit = true;

    const baseHit = (attacker.atk * cardMultiplier * classMultiplier) - (defender.def * 0.5);
    const hitDamage = Math.max(200, Math.round(baseHit * (hitCrit ? 2.0 : 1.0)));
    totalDmg += hitDamage;
  }

  let npTriggered = false;
  let npChant = undefined;

  if (attackerChoice.useNoblePhantasm && attacker.npGauge >= 100) {
    npTriggered = true;
    npChant = attacker.noblePhantasm.chant;
    const npDmg = Math.round(attacker.atk * (attacker.noblePhantasm.multiplier / 100) * classMultiplier);
    totalDmg += npDmg;
    attacker.npGauge = 0;
  } else {
    attacker.npGauge = Math.min(300, attacker.npGauge + npGain);
  }

  attacker.critStars = Math.min(50, (attacker.critStars || 0) + starsGen);
  defender.currentHp = Math.max(0, defender.currentHp - totalDmg);

  const log: CombatTurnLog = {
    turnNumber: battle.currentTurn,
    actorId: attacker.id,
    actorName: attacker.name,
    targetId: defender.id,
    targetName: defender.name,
    actionSummary: `${attacker.name} attacked with [${attackerChoice.selectedCards.join(', ')}] dealing ${totalDmg} damage.`,
    cardsUsed: attackerChoice.selectedCards,
    skillsUsed: [],
    npTriggered,
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

  if (defender.currentHp <= 0) {
    battle.turnPhase = 'victory';
    battle.winnerId = attacker.id;
  }

  return { ...battle };
}
