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

  const totalStr = (base.strength || 10) + (servantInstance.allocatedStats?.strength || 0);
  const totalEnd = (base.endurance || 10) + (servantInstance.allocatedStats?.endurance || 0);
  const totalAgi = (base.agility || 10) + (servantInstance.allocatedStats?.agility || 0);
  const totalMna = (base.mana || 10) + (servantInstance.allocatedStats?.mana || 0);
  const totalLck = (base.luck || 10) + (servantInstance.allocatedStats?.luck || 0);

  const ceHp = ce ? (ce.hpBonus || 0) : 0;
  const ceAtk = ce ? (ce.atkBonus || 0) : 0;

  const lvl = servantInstance.level || 1;
  const baseHp = t.baseHp || 28000;
  const baseAtk = t.baseAtk || 10000;

  const maxHp = Math.round(baseHp * (1 + (lvl - 1) * 0.05) + totalEnd * 150 + ceHp);
  const rawAtk = Math.round(baseAtk * (1 + (lvl - 1) * 0.05) + totalStr * 80 + ceAtk);
  const def = Math.round(totalEnd * 25);

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
    bondLevel: servantInstance.bondLevel || 1
  };
}

export function applyCombatantSkill(
  actor: ActiveCombatant,
  target: ActiveCombatant,
  skillIndex: number
): { success: boolean; log: string } {
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
  let logText = `✨ **${actor.name}** activated **${skill.name}**!`;

  switch (skill.effectType) {
    case 'buff_atk':
      actor.activeBuffs.push({
        name: skill.name,
        type: 'buff_atk',
        value: skill.value || 30,
        remainingTurns: skill.duration || 2
      });
      actor.critStars = Math.min(50, actor.critStars + 10);
      logText = `⚔️ **${actor.name}** activated **${skill.name}**, gaining **+${skill.value || 30}% ATK** for ${skill.duration || 2} turns and +10 Critical Stars!`;
      break;
    case 'buff_def':
      actor.activeBuffs.push({
        name: skill.name,
        type: 'buff_def',
        value: skill.value || 30,
        remainingTurns: skill.duration || 2
      });
      logText = `🛡️ **${actor.name}** activated **${skill.name}**, gaining **+${skill.value || 30}% DEF** for ${skill.duration || 2} turns!`;
      break;
    case 'heal': {
      const healAmt = skill.value || Math.round(actor.maxHp * 0.25);
      actor.currentHp = Math.min(actor.maxHp, actor.currentHp + healAmt);
      logText = `💚 **${actor.name}** activated **${skill.name}**, restoring **+${healAmt.toLocaleString()} HP**!`;
      break;
    }
    case 'np_charge':
      actor.npGauge = Math.min(300, actor.npGauge + (skill.value || 30));
      actor.critStars = Math.min(50, actor.critStars + 15);
      logText = `⚡ **${actor.name}** activated **${skill.name}**, charging **+${skill.value || 30}% NP** and generating +15 Stars!`;
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
      logText = `🌟 **${actor.name}** activated **${skill.name}**, generating **+${stars} Critical Stars** and +40% Critical DMG!`;
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
      logText = `💨 **${actor.name}** activated **${skill.name}**, granting absolute **Evade** against incoming damage!`;
      break;
    case 'stun':
      target.isStunned = true;
      target.activeBuffs.push({
        name: 'Stunned',
        type: 'stun',
        value: 100,
        remainingTurns: skill.duration || 1
      });
      logText = `💫 **${actor.name}** activated **${skill.name}**, stunning **${target.name}** for 1 turn!`;
      break;
    default:
      actor.activeBuffs.push({
        name: skill.name,
        type: 'buff_atk',
        value: 25,
        remainingTurns: 2
      });
      logText = `✨ **${actor.name}** activated **${skill.name}**!`;
      break;
  }

  return { success: true, log: logText };
}

export function initializeBattle(
  combatant1: ActiveCombatant,
  combatant2: ActiveCombatant,
  battleId?: string,
  grailWarId?: string
): BattleState {
  return {
    battleId: battleId || `battle_${Date.now()}`,
    player1: combatant1,
    player2: combatant2,
    currentTurn: 1,
    turnPhase: 'card_selection',
    turnHistory: [],
    grailWarId
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

    // Decrement skill cooldowns at start of turn
    actor.skills = actor.skills.map(sk => ({
      ...sk,
      currentCooldown: Math.max(0, sk.currentCooldown - 1)
    }));

    // Handle Active Skill trigger if chosen
    if (choice.useSkillIndex !== undefined && choice.useSkillIndex >= 0) {
      const skill = actor.skills[choice.useSkillIndex];
      if (skill && skill.currentCooldown <= 0) {
        skill.currentCooldown = skill.cooldown;
        usedSkillNames.push(skill.name);

        switch (skill.effectType) {
          case 'buff_atk':
            actor.activeBuffs.push({
              name: skill.name,
              type: 'buff_atk',
              value: skill.value,
              remainingTurns: skill.duration
            });
            break;
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
              name: 'Evade',
              type: 'evade',
              value: 100,
              remainingTurns: skill.duration
            });
            break;
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

    // Handle Master Command Seal if activated
    if (choice.useCommandSeal) {
      if (choice.useCommandSeal === 'heal') {
        actor.currentHp = actor.maxHp;
        usedSkillNames.push('Command Seal: Complete Restoration');
      } else if (choice.useCommandSeal === 'np_charge') {
        actor.npGauge = 300;
        usedSkillNames.push('Command Seal: 300% NP Overdrive');
      }
    }

    // Check Noble Phantasm execution
    let npTriggered = false;
    let npChant: string | undefined;
    let totalDamage = 0;
    let totalStars = 0;
    let totalNpCharge = 0;
    let isCritical = false;

    // Determine ATK & DEF buffs
    const atkBuff = actor.activeBuffs
      .filter(b => b.type === 'buff_atk')
      .reduce((sum, b) => sum + b.value, 0);
    const defBuff = target.activeBuffs
      .filter(b => b.type === 'buff_def')
      .reduce((sum, b) => sum + b.value, 0);

    const classMult = calculateClassMultiplier(actor.servantClass, target.servantClass);
    const effectiveAtk = actor.atk * (1 + atkBuff / 100) * (1 + (actor.stats.strength * 0.01));
    const effectiveDef = target.def * (1 + defBuff / 100);

    const cards = choice.selectedCards.length === 3 ? choice.selectedCards : ['Buster', 'Arts', 'Quick'] as CardType[];

    // Check Card Chain Bonuses
    let cardChainType: 'Buster Brave' | 'Arts Chain' | 'Quick Chain' | 'Normal' = 'Normal';
    if (cards.every(c => c === 'Buster')) cardChainType = 'Buster Brave';
    else if (cards.every(c => c === 'Arts')) cardChainType = 'Arts Chain';
    else if (cards.every(c => c === 'Quick')) cardChainType = 'Quick Chain';

    // If NP is ready and requested
    if (choice.useNoblePhantasm && actor.npGauge >= 100) {
      npTriggered = true;
      npChant = actor.noblePhantasm.chant;
      const npMultiplier = (actor.noblePhantasm.multiplier / 100) * (1 + (actor.npGauge / 500));
      let npBaseDmg = Math.max(800, (effectiveAtk * npMultiplier * 0.20 * classMult) - (effectiveDef * 0.3));

      if (target.isEvading) {
        npBaseDmg = 0;
        target.isEvading = false;
      }

      totalDamage += Math.round(npBaseDmg * PVP_DAMAGE_MODIFIER);
      totalNpCharge += 20; // base refund
      totalStars += 12;
      actor.npGauge = 0; // consume gauge
    } else {
      // Calculate 3-card chain attacks
      cards.forEach((card, idx) => {
        const positionMultiplier = 1.0 + idx * 0.15; // 1st: 1.0x, 2nd: 1.15x, 3rd: 1.30x

        // Critical hit check based on Agility + Luck + Stars
        const critChance = Math.min(0.85, (actor.stats.agility * 0.01) + (actor.critStars * 0.02));
        const cardIsCrit = Math.random() < critChance;
        if (cardIsCrit) isCritical = true;
        const critMultiplier = cardIsCrit ? 1.75 + (actor.stats.luck * 0.01) : 1.0;

        let cardDmgMult = 1.0;
        let cardNpMult = 1.0;
        let cardStarMult = 1.0;

        if (card === 'Buster') {
          cardDmgMult = 1.4; // Buster deals strong base dmg
          cardNpMult = 0.0;
          cardStarMult = 0.5;
        } else if (card === 'Arts') {
          cardDmgMult = 1.0;
          cardNpMult = 2.5 + (actor.stats.mana * 0.04); // Arts gives solid NP charge
          cardStarMult = 0.5;
        } else if (card === 'Quick') {
          cardDmgMult = 0.85;
          cardNpMult = 1.0;
          cardStarMult = 2.5 + (actor.stats.agility * 0.04); // Quick generates crit stars
        }

        // Apply chain bonus
        if (cardChainType === 'Buster Brave') cardDmgMult += 0.35;
        if (cardChainType === 'Arts Chain') cardNpMult += 1.2;
        if (cardChainType === 'Quick Chain') cardStarMult += 1.8;

        let hitDmg = Math.max(
          100,
          ((effectiveAtk * 0.11 * cardDmgMult * positionMultiplier * critMultiplier * classMult) - (effectiveDef * 0.2))
        );

        if (target.isEvading) {
          hitDmg = 0;
          target.isEvading = false;
        }

        totalDamage += Math.round(hitDmg * PVP_DAMAGE_MODIFIER);
        totalNpCharge += Math.round(8 * cardNpMult * (actor.stats.mana / 15));
        totalStars += Math.round(4 * cardStarMult);
      });
    }

    // Apply damage to target
    target.currentHp = Math.max(0, target.currentHp - totalDamage);
    actor.npGauge = Math.min(300, actor.npGauge + totalNpCharge);
    actor.critStars = Math.min(50, actor.critStars + totalStars);

    // Decrement buff durations
    actor.activeBuffs = actor.activeBuffs
      .map(b => ({ ...b, remainingTurns: b.remainingTurns - 1 }))
      .filter(b => b.remainingTurns > 0);

    const actionText = npTriggered
      ? `💥 ${actor.name} unleashed Noble Phantasm [${actor.noblePhantasm.name}] for ${totalDamage.toLocaleString()} DMG!`
      : `⚔️ ${actor.name} executed a ${cards.join(' • ')} sequence dealing ${totalDamage.toLocaleString()} DMG!`;

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
      npChant,
      damageDealt: totalDamage,
      isCritical,
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
