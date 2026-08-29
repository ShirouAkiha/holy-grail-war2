import {
  DistrictId,
  HolyGrailWarSession,
  WarDistrict,
  WarMasterParticipant,
  WarAlliance
} from '../types';
import { SERVANT_DATABASE } from '../data/servants';

export const FUYUKI_DISTRICTS: Record<string, WarDistrict> = {
  fuyuki_church: {
    id: 'fuyuki_church',
    name: 'Fuyuki Church',
    description: 'Neutral sanctuary overseen by the Overseer. Recover command seals and rest safely.',
    leylineBonus: 'command_seal_recovery',
    manaReserve: 500
  },
  ryuudou_temple: {
    id: 'ryuudou_temple',
    name: 'Ryuudou Temple (Mount Enzou)',
    description: 'Primary magical focal point of the Great Holy Grail. Generates immense mana reserves.',
    leylineBonus: 'mana_surge',
    manaReserve: 1500
  },
  shinto_bridge: {
    id: 'shinto_bridge',
    name: 'Fuyuki Bridge',
    description: 'Vast suspension bridge connecting Shinto and Miyama. Ideal vantage point for scout operations.',
    leylineBonus: 'agility_scout',
    manaReserve: 400
  },
  homurahara_academy: {
    id: 'homurahara_academy',
    name: 'Homurahara Academy',
    description: 'Civilian school grounds surrounded by a dormant bounded field.',
    leylineBonus: 'defensive_ward',
    manaReserve: 600
  },
  docks: {
    id: 'docks',
    name: 'Fuyuki Industrial Docks',
    description: 'Desolate container yard under the foggy sea breeze. Critical strike sanctuary.',
    leylineBonus: 'crit_sanctuary',
    manaReserve: 350
  },
  einzenbern_forest: {
    id: 'einzenbern_forest',
    name: 'Einzbern Forest & Castle',
    description: 'Snow-capped ancient boreal woodland guarded by multi-layered defensive bounded fields.',
    leylineBonus: 'defensive_ward',
    manaReserve: 1200
  },
  commercial_district: {
    id: 'commercial_district',
    name: 'Shinto Commercial Center',
    description: 'Bustling modern high-rises with plentiful supply depots.',
    leylineBonus: 'mana_surge',
    manaReserve: 450
  }
};

export function createHolyGrailWarSession(
  initiatorMaster: { discordId: string; username: string; servantId: string; servantName: string; avatarUrl: string; maxHp: number },
  warTitle: string = '7th Fuyuki Holy Grail War'
): HolyGrailWarSession {
  const warId = `grail_war_${Date.now()}`;
  const districts = JSON.parse(JSON.stringify(FUYUKI_DISTRICTS)) as Record<DistrictId, WarDistrict>;

  // Initialize participants with the initiator + 6 AI / Rival Masters
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
      currentDistrict: 'homurahara_academy',
      ap: 100,
      kills: 0
    }
  };

  // Seed 6 other rival Masters
  const aiRivals = [
    { name: 'Kotomine Kirei', servantId: 'gilgamesh_archer', servantName: 'Gilgamesh', class: 'Archer' as const, district: 'fuyuki_church' as DistrictId },
    { name: 'Bazett Fraga', servantId: 'cu_chulainn_lancer', servantName: 'Cú Chulainn', class: 'Lancer' as const, district: 'docks' as DistrictId },
    { name: 'Illyasviel von Einzbern', servantId: 'heracles_berserker', servantName: 'Heracles', class: 'Berserker' as const, district: 'einzenbern_forest' as DistrictId },
    { name: 'Medea of Colchis', servantId: 'jeanne_darc_ruler', servantName: 'Jeanne d\'Arc', class: 'Ruler' as const, district: 'ryuudou_temple' as DistrictId },
    { name: 'Kiritsugu Emiya', servantId: 'emiya_archer', servantName: 'EMIYA', class: 'Archer' as const, district: 'shinto_bridge' as DistrictId },
    { name: 'Root Administrator', servantId: 'terminal_saber_linus', servantName: 'Terminal Saber', class: 'Saber' as const, district: 'commercial_district' as DistrictId }
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
      currentDistrict: r.district,
      ap: 100,
      kills: 0
    };
  });

  return {
    id: warId,
    title: warTitle,
    status: 'active',
    currentRound: 1,
    maxRounds: 7,
    districts,
    participants,
    alliances: {},
    eventLogs: [
      {
        id: `evt_init`,
        round: 1,
        timestamp: Date.now(),
        text: `🕯️ The ${warTitle} has commenced! 7 Masters and Servants have descended upon Fuyuki City.`,
        type: 'scout'
      }
    ]
  };
}

export type WarActionType =
  | 'scout'
  | 'move_district'
  | 'fortify_leyline'
  | 'rest_and_heal'
  | 'form_alliance'
  | 'betray_ally'
  | 'challenge_master';

export interface WarActionResult {
  success: boolean;
  message: string;
  apSpent: number;
  combatTriggered?: {
    opponentId: string;
    opponentName: string;
    isAmbush: boolean;
  };
  eliminatedMasterId?: string;
  updatedWar: HolyGrailWarSession;
}

export function executeWarAction(
  war: HolyGrailWarSession,
  actorDiscordId: string,
  action: WarActionType,
  targetParam?: string
): WarActionResult {
  const updatedWar: HolyGrailWarSession = JSON.parse(JSON.stringify(war));
  const actor = updatedWar.participants[actorDiscordId];

  if (!actor || !actor.isAlive) {
    return { success: false, message: 'You are eliminated from the Holy Grail War!', apSpent: 0, updatedWar };
  }

  let apCost = 0;
  let resultMsg = '';
  let combatInfo: WarActionResult['combatTriggered'];
  let eliminatedId: string | undefined;

  switch (action) {
    case 'scout':
      apCost = 20;
      if (actor.ap < apCost) return { success: false, message: 'Not enough Action Points (AP)!', apSpent: 0, updatedWar };
      actor.ap -= apCost;

      const spotted = Object.values(updatedWar.participants).filter(
        p => p.discordId !== actor.discordId && p.isAlive && p.currentDistrict === actor.currentDistrict
      );

      if (spotted.length > 0) {
        resultMsg = `🔭 Reconnaissance at ${updatedWar.districts[actor.currentDistrict]?.name || actor.currentDistrict}: You spotted ${spotted.map(s => `${s.username} (${s.servantName})`).join(', ')}!`;
      } else {
        resultMsg = `🔭 Reconnaissance at ${updatedWar.districts[actor.currentDistrict]?.name || actor.currentDistrict}: The area is quiet. No hostile Servant traces detected.`;
      }
      break;

    case 'move_district':
      apCost = 15;
      if (actor.ap < apCost) return { success: false, message: 'Not enough AP to relocate!', apSpent: 0, updatedWar };
      if (!targetParam || !updatedWar.districts[targetParam as DistrictId]) {
        return { success: false, message: 'Invalid destination district!', apSpent: 0, updatedWar };
      }
      actor.ap -= apCost;
      const prevDistrict = updatedWar.districts[actor.currentDistrict]?.name || actor.currentDistrict;
      actor.currentDistrict = targetParam as DistrictId;
      const newDistrict = updatedWar.districts[actor.currentDistrict]?.name || actor.currentDistrict;
      resultMsg = `🗺️ Relocated from ${prevDistrict} to ${newDistrict}.`;
      break;

    case 'fortify_leyline':
      apCost = 25;
      if (actor.ap < apCost) return { success: false, message: 'Not enough AP to fortify leyline!', apSpent: 0, updatedWar };
      actor.ap -= apCost;
      const district = updatedWar.districts[actor.currentDistrict];
      if (district) {
        district.controllingMasterId = actor.discordId;
        resultMsg = `🏰 Claimed control over the Leyline at ${district.name}! Bounded field established (+${district.leylineBonus}).`;
      } else {
        resultMsg = `🏰 Claimed control over the local Leyline! Bounded field established.`;
      }
      break;

    case 'rest_and_heal':
      apCost = 30;
      if (actor.ap < apCost) return { success: false, message: 'Not enough AP to rest!', apSpent: 0, updatedWar };
      actor.ap -= apCost;
      const healAmount = Math.round(actor.maxHp * 0.45);
      actor.currentHp = Math.min(actor.maxHp, actor.currentHp + healAmount);

      let sealMsg = '';
      if (actor.currentDistrict === 'fuyuki_church' && actor.commandSeals < 3) {
        actor.commandSeals++;
        sealMsg = ' Father Kotomine restored 1 Command Seal!';
      }
      resultMsg = `🩹 Rested and recovered ${healAmount.toLocaleString()} HP.${sealMsg}`;
      break;

    case 'form_alliance':
      apCost = 25;
      if (actor.ap < apCost) return { success: false, message: 'Not enough AP to negotiate an alliance!', apSpent: 0, updatedWar };
      if (!targetParam || !updatedWar.participants[targetParam]) {
        return { success: false, message: 'Specify a valid Master to ally with!', apSpent: 0, updatedWar };
      }
      const targetMaster = updatedWar.participants[targetParam];
      if (targetMaster.discordId === actor.discordId || !targetMaster.isAlive) {
        return { success: false, message: 'Cannot ally with this Master.', apSpent: 0, updatedWar };
      }
      actor.ap -= apCost;
      const allianceId = `alliance_${Date.now()}`;
      const alliance: WarAlliance = {
        id: allianceId,
        name: `Covenant of ${actor.username} & ${targetMaster.username}`,
        memberMasterIds: [actor.discordId, targetMaster.discordId],
        isSecret: true,
        betrayalRiskScore: 35,
        formedAtRound: updatedWar.currentRound
      };
      updatedWar.alliances[allianceId] = alliance;
      actor.allianceId = allianceId;
      targetMaster.allianceId = allianceId;
      resultMsg = `🤝 Secret Alliance formed with ${targetMaster.username}! You will share reconnaissance until one breaks the vow.`;
      break;

    case 'betray_ally':
      apCost = 20;
      if (actor.ap < apCost) return { success: false, message: 'Not enough AP to execute betrayal!', apSpent: 0, updatedWar };
      if (!actor.allianceId || !updatedWar.alliances[actor.allianceId]) {
        return { success: false, message: 'You have no active alliance to betray!', apSpent: 0, updatedWar };
      }
      const activeAlliance = updatedWar.alliances[actor.allianceId];
      const allyId = activeAlliance.memberMasterIds.find(id => id !== actor.discordId);
      if (!allyId || !updatedWar.participants[allyId]) {
        return { success: false, message: 'No ally found in current pact.', apSpent: 0, updatedWar };
      }
      const ally = updatedWar.participants[allyId];
      actor.ap -= apCost;
      delete updatedWar.alliances[actor.allianceId];
      actor.allianceId = undefined;
      ally.allianceId = undefined;

      combatInfo = {
        opponentId: ally.discordId,
        opponentName: ally.username,
        isAmbush: true
      };
      resultMsg = `🗡️ BETRAYAL! You broke the pact and ambushed ${ally.username} with lethal surprise attack!`;
      break;

    case 'challenge_master':
      apCost = 35;
      if (actor.ap < apCost) return { success: false, message: 'Not enough AP to issue a duel!', apSpent: 0, updatedWar };
      if (!targetParam || !updatedWar.participants[targetParam]) {
        return { success: false, message: 'Target Master not found!', apSpent: 0, updatedWar };
      }
      const opponent = updatedWar.participants[targetParam];
      if (opponent.discordId === actor.discordId || !opponent.isAlive) {
        return { success: false, message: 'Cannot challenge this target.', apSpent: 0, updatedWar };
      }
      actor.ap -= apCost;
      combatInfo = {
        opponentId: opponent.discordId,
        opponentName: opponent.username,
        isAmbush: false
      };
      resultMsg = `⚔️ CHALLENGE ISSUED: ${actor.servantName} clashes with ${opponent.username}'s ${opponent.servantName}!`;
      break;
  }

  updatedWar.eventLogs.unshift({
    id: `evt_${Date.now()}`,
    round: updatedWar.currentRound,
    timestamp: Date.now(),
    text: `${actor.username}: ${resultMsg}`,
    type: action === 'betray_ally' ? 'betrayal' : action === 'form_alliance' ? 'alliance' : 'scout'
  });

  return {
    success: true,
    message: resultMsg,
    apSpent: apCost,
    combatTriggered: combatInfo,
    eliminatedMasterId: eliminatedId,
    updatedWar
  };
}

export function advanceWarRound(war: HolyGrailWarSession): HolyGrailWarSession {
  const updated: HolyGrailWarSession = JSON.parse(JSON.stringify(war));
  updated.currentRound++;

  Object.values(updated.participants).forEach(p => {
    if (p.isAlive) {
      p.ap = Math.min(100, p.ap + 60);
    }
  });

  const aliveAis = Object.values(updated.participants).filter(p => p.isAlive && p.discordId.startsWith('rival_'));
  if (aliveAis.length >= 2 && Math.random() < 0.6) {
    const ai1 = aliveAis[0];
    const ai2 = aliveAis[1];
    const dmg = Math.round(3000 + Math.random() * 4000);
    ai2.currentHp -= dmg;
    if (ai2.currentHp <= 0) {
      ai2.isAlive = false;
      ai1.kills++;
      updated.eventLogs.unshift({
        id: `evt_ai_elim_${Date.now()}`,
        round: updated.currentRound,
        timestamp: Date.now(),
        text: `☠️ ELIMINATION: ${ai1.username}'s ${ai1.servantName} defeated ${ai2.username}'s ${ai2.servantName}!`,
        type: 'elimination'
      });
    }
  }

  const remainingAlive = Object.values(updated.participants).filter(p => p.isAlive);
  if (remainingAlive.length === 1) {
    updated.status = 'concluded';
    updated.grailWinnerId = remainingAlive[0].discordId;
    updated.eventLogs.unshift({
      id: `evt_grail_win_${Date.now()}`,
      round: updated.currentRound,
      timestamp: Date.now(),
      text: `🏆 THE HOLY GRAIL HAS MANIFESTED! ${remainingAlive[0].username} has claimed supreme victory!`,
      type: 'clash'
    });
  }

  return updated;
}
