import {
  HolyGrailWarSession,
  WarMasterParticipant,
  WarAlliance
} from '../types';
import { SERVANT_DATABASE } from '../data/servants';

// ==========================================
// 1. 7-MASTER WAR SESSION INITIALIZER
// ==========================================
export function createHolyGrailWarSession(
  initiatorMaster: { discordId: string; username: string; servantId: string; servantName: string; avatarUrl: string; maxHp: number },
  warTitle: string = '7-Master Fuyuki Holy Grail War'
): HolyGrailWarSession {
  const warId = `grail_war_${Date.now()}`;

  // Register Player 1
  const participants: Record<string, WarMasterParticipant> = {
    [initiatorMaster.discordId]: {
      discordId: initiatorMaster.discordId,
      username: initiatorMaster.username,
      servantId: initiatorMaster.servantId,
      servantName: initiatorMaster.servantName,
      servantClass: 'Saber',
      avatarUrl: initiatorMaster.avatarUrl,
      currentHp: initiatorMaster.maxHp,
      maxHp: initiatorMaster.maxHp,
      commandSeals: 3,
      isAlive: true,
      kills: 0
    }
  };

  // Seed 6 AI Rival Masters
  const aiRivals = [
    { name: 'Kotomine Kirei', servantId: 'gilgamesh_archer', servantName: 'Gilgamesh', class: 'Archer' as const },
    { name: 'Bazett Fraga', servantId: 'cu_chulainn_lancer', servantName: 'Cú Chulainn', class: 'Lancer' as const },
    { name: 'Illyasviel von Einzbern', servantId: 'heracles_berserker', servantName: 'Heracles', class: 'Berserker' as const },
    { name: 'Medea of Colchis', servantId: 'jeanne_darc_ruler', servantName: 'Jeanne d\'Arc', class: 'Ruler' as const },
    { name: 'Kiritsugu Emiya', servantId: 'emiya_archer', servantName: 'EMIYA', class: 'Archer' as const },
    { name: 'Rin Tohsaka', servantId: 'terminal_saber_linus', servantName: 'Terminal Saber', class: 'Saber' as const }
  ];

  aiRivals.forEach((r, idx) => {
    const id = `rival_${idx + 1}`;
    const t = SERVANT_DATABASE.find(s => s.id === r.servantId);
    const hp = t ? t.baseHp : 12000;
    participants[id] = {
      discordId: id,
      username: r.name,
      servantId: r.servantId,
      servantName: r.servantName,
      servantClass: r.class,
      avatarUrl: t?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
      currentHp: hp,
      maxHp: hp,
      commandSeals: 3,
      isAlive: true,
      kills: 0
    };
  });

  return {
    id: warId,
    title: warTitle,
    status: 'active',
    participants,
    alliances: {},
    eventLogs: [
      {
        id: `evt_init_${Date.now()}`,
        timestamp: Date.now(),
        text: `🕯️ The ${warTitle} has commenced! 7 Masters and their contracted Heroic Spirits battle to the death for the omnipotent wish-granting device.`,
        type: 'clash'
      }
    ]
  };
}

export type WarActionType =
  | 'challenge_master'
  | 'form_alliance'
  | 'betray_ally'
  | 'rest_and_heal'
  | 'simulate_skirmish';

export interface WarActionResult {
  success: boolean;
  message: string;
  combatTriggered?: {
    opponentId: string;
    opponentName: string;
    isAmbush: boolean;
  };
  eliminatedMasterId?: string;
  updatedWar: HolyGrailWarSession;
}

// ==========================================
// 2. TACTICAL ACTION RESOLVER
// ==========================================
export function executeWarAction(
  war: HolyGrailWarSession,
  actorDiscordId: string,
  action: WarActionType,
  targetParam?: string
): WarActionResult {
  const updatedWar: HolyGrailWarSession = JSON.parse(JSON.stringify(war));
  const actor = updatedWar.participants[actorDiscordId];

  if (!actor || !actor.isAlive) {
    return { success: false, message: 'You are eliminated from the Holy Grail War!', updatedWar };
  }

  let resultMsg = '';
  let combatInfo: WarActionResult['combatTriggered'];
  let eliminatedId: string | undefined;

  switch (action) {
    case 'rest_and_heal': {
      const healAmount = Math.round(actor.maxHp * 0.45);
      actor.currentHp = Math.min(actor.maxHp, actor.currentHp + healAmount);
      resultMsg = `🩹 Channeled mana to recover ${healAmount.toLocaleString()} HP for ${actor.servantName} (HP: ${actor.currentHp.toLocaleString()}/${actor.maxHp.toLocaleString()}).`;
      break;
    }

    case 'form_alliance': {
      if (!targetParam || !updatedWar.participants[targetParam]) {
        return { success: false, message: 'Specify a valid Master to form an alliance with!', updatedWar };
      }
      const targetMaster = updatedWar.participants[targetParam];
      if (targetMaster.discordId === actor.discordId || !targetMaster.isAlive) {
        return { success: false, message: 'Cannot form an alliance with this Master.', updatedWar };
      }
      const allianceId = `alliance_${Date.now()}`;
      const alliance: WarAlliance = {
        id: allianceId,
        name: `Covenant of ${actor.username} & ${targetMaster.username}`,
        memberMasterIds: [actor.discordId, targetMaster.discordId],
        isSecret: true,
        betrayalRiskScore: 30
      };
      updatedWar.alliances[allianceId] = alliance;
      actor.allianceId = allianceId;
      targetMaster.allianceId = allianceId;
      resultMsg = `🤝 Secret Covenant formed with ${targetMaster.username}! You fight side-by-side until one betrays the pact.`;
      break;
    }

    case 'betray_ally': {
      if (!actor.allianceId || !updatedWar.alliances[actor.allianceId]) {
        return { success: false, message: 'You have no active alliance to betray!', updatedWar };
      }
      const activeAlliance = updatedWar.alliances[actor.allianceId];
      const allyId = activeAlliance.memberMasterIds.find(id => id !== actor.discordId);
      if (!allyId || !updatedWar.participants[allyId]) {
        return { success: false, message: 'No ally found in current pact.', updatedWar };
      }
      const ally = updatedWar.participants[allyId];
      delete updatedWar.alliances[actor.allianceId];
      actor.allianceId = undefined;
      ally.allianceId = undefined;

      combatInfo = {
        opponentId: ally.discordId,
        opponentName: ally.username,
        isAmbush: true
      };
      resultMsg = `🗡️ BETRAYAL! You broke the covenant and ambushed ${ally.username} with a lethal surprise strike!`;
      break;
    }

    case 'challenge_master': {
      if (!targetParam || !updatedWar.participants[targetParam]) {
        return { success: false, message: 'Target Master not found!', updatedWar };
      }
      const opponent = updatedWar.participants[targetParam];
      if (opponent.discordId === actor.discordId || !opponent.isAlive) {
        return { success: false, message: 'Cannot challenge this target.', updatedWar };
      }
      combatInfo = {
        opponentId: opponent.discordId,
        opponentName: opponent.username,
        isAmbush: false
      };
      resultMsg = `⚔️ CHALLENGE ISSUED: ${actor.username}'s ${actor.servantName} engages ${opponent.username}'s ${opponent.servantName}!`;
      break;
    }

    case 'simulate_skirmish': {
      return {
        ...simulateWarSkirmish(updatedWar),
        updatedWar: simulateWarSkirmish(updatedWar).updatedWar
      };
    }
  }

  // Push event to battle log
  updatedWar.eventLogs.unshift({
    id: `evt_${Date.now()}`,
    timestamp: Date.now(),
    text: resultMsg,
    type: action === 'betray_ally' ? 'betrayal' : action === 'form_alliance' ? 'alliance' : action === 'rest_and_heal' ? 'heal' : 'clash'
  });

  return {
    success: true,
    message: resultMsg,
    combatTriggered: combatInfo,
    eliminatedMasterId: eliminatedId,
    updatedWar
  };
}

// ==========================================
// 3. BACKGROUND WAR SKIRMISH SIMULATOR
// ==========================================
export function simulateWarSkirmish(war: HolyGrailWarSession): WarActionResult {
  const updated: HolyGrailWarSession = JSON.parse(JSON.stringify(war));
  const aliveAis = Object.values(updated.participants).filter(p => p.isAlive && p.discordId.startsWith('rival_'));

  if (aliveAis.length < 2) {
    return {
      success: true,
      message: 'Not enough rival Masters remaining for a background skirmish.',
      updatedWar: updated
    };
  }

  const idx1 = Math.floor(Math.random() * aliveAis.length);
  let idx2 = Math.floor(Math.random() * (aliveAis.length - 1));
  if (idx2 >= idx1) idx2++;

  const ai1 = aliveAis[idx1];
  const ai2 = aliveAis[idx2];
  const damage = Math.round(3500 + Math.random() * 4500);
  ai2.currentHp = Math.max(0, ai2.currentHp - damage);

  let clashText = `⚔️ SKIRMISH: ${ai1.username}'s ${ai1.servantName} clashed with ${ai2.username}'s ${ai2.servantName}, dealing ${damage.toLocaleString()} damage!`;

  if (ai2.currentHp <= 0) {
    ai2.isAlive = false;
    ai1.kills++;
    clashText = `☠️ ELIMINATION: ${ai1.username}'s ${ai1.servantName} struck a fatal blow and eliminated ${ai2.username} (${ai2.servantName}) from the Holy Grail War!`;
  }

  updated.eventLogs.unshift({
    id: `evt_skirmish_${Date.now()}`,
    timestamp: Date.now(),
    text: clashText,
    type: ai2.currentHp <= 0 ? 'elimination' : 'clash'
  });

  // Check victory condition
  const remainingAlive = Object.values(updated.participants).filter(p => p.isAlive);
  if (remainingAlive.length === 1) {
    updated.status = 'concluded';
    updated.grailWinnerId = remainingAlive[0].discordId;
    updated.eventLogs.unshift({
      id: `evt_grail_win_${Date.now()}`,
      timestamp: Date.now(),
      text: `🏆 THE HOLY GRAIL HAS MANIFESTED! ${remainingAlive[0].username} is the sole survivor and has won the Holy Grail War!`,
      type: 'clash'
    });
  }

  return {
    success: true,
    message: clashText,
    eliminatedMasterId: ai2.currentHp <= 0 ? ai2.discordId : undefined,
    updatedWar: updated
  };
}
