import {
  HolyGrailWarSession,
  WarMasterParticipant,
  WarAlliance,
  MasterProfile
} from '../types';
import { SERVANT_DATABASE } from '../data/servants';

// =========================================================================
// GLOBAL SHARED HOLY GRAIL WAR SINGLETON (Shared across all Discord commands & users)
// =========================================================================
let globalWarSession: HolyGrailWarSession | null = null;

const CANONICAL_WAR_CLASSES = [
  { slot: 2, class: 'Archer' as const, servantId: 'gilgamesh_archer', servantName: 'King of Heroes (Gilgamesh)', defaultUsername: 'Shadow Master #2' },
  { slot: 3, class: 'Lancer' as const, servantId: 'scathach_lancer', servantName: 'Scáthach (Lancer)', defaultUsername: 'itsderpo' },
  { slot: 4, class: 'Berserker' as const, servantId: 'heracles_berserker', servantName: 'Great Berserker (Heracles)', defaultUsername: 'Shadow Master #4' },
  { slot: 5, class: 'Ruler' as const, servantId: 'jeanne_darc_ruler', servantName: 'Holy Maiden (Jeanne d\'Arc)', defaultUsername: 'Shadow Master #5' },
  { slot: 6, class: 'Assassin' as const, servantId: 'emiya_archer', servantName: 'Nameless Guardian (EMIYA)', defaultUsername: 'Shadow Master #6' },
  { slot: 7, class: 'Rider' as const, servantId: 'terminal_saber_linus', servantName: 'Iron Sovereign (Linus)', defaultUsername: 'Shadow Master #7' }
];

export function createHolyGrailWarSession(
  initiatorMaster: { discordId: string; username: string; servantId: string; servantName: string; avatarUrl: string; maxHp: number; servantClass?: string },
  warTitle: string = '7-Master Fuyuki Holy Grail War'
): HolyGrailWarSession {
  const warId = `grail_war_${Date.now()}`;

  // Initialize exactly 7 slots
  const participants: Record<string, WarMasterParticipant> = {
    [initiatorMaster.discordId]: {
      discordId: initiatorMaster.discordId,
      username: initiatorMaster.username,
      servantId: initiatorMaster.servantId,
      servantName: initiatorMaster.servantName,
      servantClass: (initiatorMaster.servantClass as any) || 'Saber',
      avatarUrl: initiatorMaster.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
      currentHp: initiatorMaster.maxHp,
      maxHp: initiatorMaster.maxHp,
      commandSeals: 3,
      isAlive: true,
      isExposed: false,
      kills: 0,
      innocentKills: 0
    }
  };

  // Seed remaining 6 slots as Shadow Masters
  CANONICAL_WAR_CLASSES.forEach(r => {
    const aiSlotId = `ai_shadow_slot_${r.slot}`;
    const t = SERVANT_DATABASE.find(s => s.id === r.servantId);
    const hp = t ? t.baseHp : 14820;
    participants[aiSlotId] = {
      discordId: aiSlotId,
      username: r.defaultUsername || `Shadow Master #${r.slot}`,
      servantId: r.servantId,
      servantName: r.servantName,
      servantClass: r.class,
      avatarUrl: t?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
      currentHp: hp,
      maxHp: hp,
      commandSeals: 3,
      isAlive: true,
      isExposed: false,
      kills: 0,
      innocentKills: 0
    };
  });

  const session: HolyGrailWarSession = {
    id: warId,
    title: warTitle,
    status: 'active',
    participants,
    alliances: {},
    civilianCasualties: [],
    leakedIntel: [],
    eventLogs: [
      {
        id: `evt_init_${Date.now()}`,
        timestamp: Date.now(),
        text: `🕯️ The ${warTitle} has commenced in strict secrecy! All 7 Masters operate from the shadows. Identities remain concealed until exposed by public actions, tactical ambushes, or intelligence leaks.`,
        type: 'clash'
      }
    ]
  };

  globalWarSession = session;
  return session;
}

/**
 * Returns or initializes the shared, server-wide 7-Master Holy Grail War session.
 * Real players seamlessly occupy one of the 7 shadow slots without exceeding the 7-Master limit!
 */
export function getOrInitWarSession(master: MasterProfile): HolyGrailWarSession {
  const activeServant =
    master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];

  const servantName = activeServant?.template?.name || 'Artoria Pendragon';
  const servantClass = activeServant?.template?.servantClass || 'Saber';
  const avatarUrl = activeServant?.template?.avatarUrl || '';
  const maxHp = activeServant?.template?.baseHp || 15000;

  if (!globalWarSession) {
    globalWarSession = createHolyGrailWarSession({
      discordId: master.discordId,
      username: master.username,
      servantId: activeServant?.id || 'servant_artoria',
      servantName,
      avatarUrl,
      maxHp,
      servantClass
    });
    return globalWarSession;
  }

  // Ensure arrays exist
  if (!globalWarSession.leakedIntel) globalWarSession.leakedIntel = [];
  if (!globalWarSession.civilianCasualties) globalWarSession.civilianCasualties = [];
  if (!globalWarSession.eventLogs) globalWarSession.eventLogs = [];

  // Check if this real player already occupies a slot
  if (globalWarSession.participants[master.discordId]) {
    const existing = globalWarSession.participants[master.discordId];
    existing.username = master.username;
    if (activeServant) {
      existing.servantId = activeServant.id;
      existing.servantName = activeServant.template.name;
      existing.servantClass = activeServant.template.servantClass;
      existing.avatarUrl = activeServant.template.avatarUrl;
    }
    return globalWarSession;
  }

  // Player is NEW to the current war: Claim an available AI shadow slot (keep total at exactly 7)
  const aiSlotKey = Object.keys(globalWarSession.participants).find(
    k => k.startsWith('ai_shadow_slot_') || k.startsWith('master_slot_')
  );

  if (aiSlotKey) {
    const oldAiSlot = globalWarSession.participants[aiSlotKey];
    delete globalWarSession.participants[aiSlotKey];

    globalWarSession.participants[master.discordId] = {
      discordId: master.discordId,
      username: master.username,
      servantId: activeServant?.id || oldAiSlot.servantId,
      servantName,
      servantClass,
      avatarUrl,
      currentHp: maxHp,
      maxHp,
      commandSeals: master.commandSeals || 3,
      isAlive: true,
      isExposed: false,
      kills: 0,
      innocentKills: 0
    };

    globalWarSession.eventLogs.unshift({
      id: `evt_enter_${Date.now()}`,
      timestamp: Date.now(),
      text: `🕯️ A new Master contracted a Heroic Spirit in secret and entered the Holy Grail War from the shadows!`,
      type: 'clash'
    });
  } else if (Object.keys(globalWarSession.participants).length < 7) {
    // If fewer than 7 slots exist, insert directly
    globalWarSession.participants[master.discordId] = {
      discordId: master.discordId,
      username: master.username,
      servantId: activeServant?.id || 'servant_artoria',
      servantName,
      servantClass,
      avatarUrl,
      currentHp: maxHp,
      maxHp,
      commandSeals: master.commandSeals || 3,
      isAlive: true,
      isExposed: false,
      kills: 0,
      innocentKills: 0
    };
  }

  return globalWarSession;
}

export function getActiveWarSession(): HolyGrailWarSession | null {
  return globalWarSession;
}

export function resetWarSession(): void {
  globalWarSession = null;
}

export type WarActionType =
  | 'challenge_master'
  | 'form_alliance'
  | 'betray_ally'
  | 'rest_and_heal'
  | 'simulate_skirmish'
  | 'attack_suspect'
  | 'leak_intel'
  | 'expose_master';

export interface WarActionResult {
  success: boolean;
  message: string;
  combatTriggered?: {
    opponentId: string;
    opponentName: string;
    isAmbush: boolean;
  };
  eliminatedMasterId?: string;
  isCollateralCasualty?: boolean;
  targetWasMaster?: boolean;
  exposedTargetMaster?: string;
  updatedWar: HolyGrailWarSession;
}

// Expose a Master when they perform an action publicly or are identified
export function exposeMasterInWar(
  war: HolyGrailWarSession,
  masterIdOrUsername: string,
  reason: 'public_command' | 'ambush_clash' | 'innocent_assault' | 'intel_leak' | 'direct_combat'
): { updatedWar: HolyGrailWarSession; newlyExposed: boolean; participant?: WarMasterParticipant } {
  const targetWar = war || globalWarSession;
  if (!targetWar) return { updatedWar: war, newlyExposed: false };

  const query = masterIdOrUsername.toLowerCase().trim();
  const participant = Object.values(targetWar.participants).find(
    p => p.discordId.toLowerCase() === query || p.username.toLowerCase() === query || query.includes(p.username.toLowerCase())
  );

  if (!participant) {
    return { updatedWar: targetWar, newlyExposed: false };
  }

  if (participant.isExposed) {
    return { updatedWar: targetWar, newlyExposed: false, participant };
  }

  participant.isExposed = true;
  participant.exposureReason = reason;

  let reasonText = '';
  switch (reason) {
    case 'public_command':
      reasonText = `📡 EXPOSURE: Master **${participant.username}** invoked magecraft publicly! Contracted Servant: **${participant.servantName}** (${participant.servantClass}) is now EXPOSED!`;
      break;
    case 'ambush_clash':
      reasonText = `⚔️ EXPOSURE: **${participant.username}** (${participant.servantName}) had their identity exposed during a tactical ambush clash!`;
      break;
    case 'innocent_assault':
      reasonText = `☠️ EXPOSURE: **${participant.username}** violated the Secrecy of Magecraft by attacking a bystander! Identity is now exposed to the server!`;
      break;
    case 'intel_leak':
      reasonText = `🕵️ EXPOSURE: **${participant.username}** (${participant.servantName} - ${participant.servantClass}) was outed by an anonymous intelligence leak!`;
      break;
    case 'direct_combat':
      reasonText = `⚔️ EXPOSURE: **${participant.username}** (${participant.servantName}) engaged in open combat!`;
      break;
  }

  targetWar.eventLogs.unshift({
    id: `evt_expose_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
    text: reasonText,
    type: 'exposure'
  });

  return { updatedWar: targetWar, newlyExposed: true, participant };
}

// Attack a suspected user in the server
export function attackSuspectUserInWar(
  war: HolyGrailWarSession,
  attackerId: string,
  suspectQuery: string
): WarActionResult {
  const targetWar = war || globalWarSession;
  if (!targetWar) {
    return { success: false, message: 'Holy Grail War is not active!', updatedWar: war };
  }

  const attacker = targetWar.participants[attackerId];
  if (!attacker || !attacker.isAlive) {
    return { success: false, message: 'You are not active in the Holy Grail War!', updatedWar: targetWar };
  }

  // Clean suspect query (remove @ or discord mention wrapper <@!1234>)
  const cleanQuery = suspectQuery.replace(/[<@!>]/g, '').trim().toLowerCase();

  // Find if target is a real Master in this Grail War
  const targetMaster = Object.values(targetWar.participants).find(
    p => p.discordId.toLowerCase() === cleanQuery ||
         p.username.toLowerCase() === cleanQuery ||
         p.username.toLowerCase().includes(cleanQuery) ||
         cleanQuery.includes(p.username.toLowerCase())
  );

  if (targetMaster && targetMaster.discordId === attacker.discordId) {
    return { success: false, message: 'You cannot target yourself with an ambush!', updatedWar: targetWar };
  }

  // ---------------------------------------------------------
  // CASE 1: TARGET IS A REAL MASTER IN THE WAR
  // ---------------------------------------------------------
  if (targetMaster && targetMaster.isAlive) {
    attacker.isExposed = true;
    attacker.exposureReason = 'ambush_clash';

    targetMaster.isExposed = true;
    targetMaster.exposureReason = 'ambush_clash';

    // Calculate surprise ambush damage
    const ambushDamage = Math.round(3800 + Math.random() * 2500);
    targetMaster.currentHp = Math.max(0, targetMaster.currentHp - ambushDamage);

    let ambushText = `⚔️ TACTICAL AMBUSH: Master **${attacker.username}** (${attacker.servantName}) launched a surprise assault on suspected Master **${targetMaster.username}**! Both identities are now EXPOSED to the server! **${targetMaster.username}**'s ${targetMaster.servantName} took **${ambushDamage.toLocaleString()} damage**!`;
    let eliminatedId: string | undefined;

    if (targetMaster.currentHp <= 0) {
      targetMaster.isAlive = false;
      attacker.kills++;
      eliminatedId = targetMaster.discordId;
      ambushText = `☠️ FATAL AMBUSH: Master **${attacker.username}** (${attacker.servantName}) ambushed and ELIMINATED Master **${targetMaster.username}** (${targetMaster.servantName})! Both identities were exposed!`;
    }

    targetWar.eventLogs.unshift({
      id: `evt_ambush_${Date.now()}`,
      timestamp: Date.now(),
      text: ambushText,
      type: targetMaster.currentHp <= 0 ? 'elimination' : 'ambush'
    });

    // Check war conclusion
    const remainingAlive = Object.values(targetWar.participants).filter(p => p.isAlive);
    if (remainingAlive.length === 1) {
      targetWar.status = 'concluded';
      targetWar.grailWinnerId = remainingAlive[0].discordId;
      targetWar.eventLogs.unshift({
        id: `evt_win_${Date.now()}`,
        timestamp: Date.now(),
        text: `🏆 THE HOLY GRAIL HAS MANIFESTED! **${remainingAlive[0].username}** is the sole survivor and has won the Holy Grail War!`,
        type: 'clash'
      });
    }

    return {
      success: true,
      message: ambushText,
      targetWasMaster: true,
      isCollateralCasualty: false,
      eliminatedMasterId: eliminatedId,
      updatedWar: targetWar
    };
  }

  // ---------------------------------------------------------
  // CASE 2: TARGET IS AN INNOCENT SERVER USER (COLLATERAL CASUALTY)
  // ---------------------------------------------------------
  attacker.isExposed = true;
  attacker.exposureReason = 'innocent_assault';
  attacker.innocentKills = (attacker.innocentKills || 0) + 1;

  if (!targetWar.civilianCasualties) targetWar.civilianCasualties = [];
  const bystanderName = suspectQuery.startsWith('@') ? suspectQuery : `@${suspectQuery}`;

  targetWar.civilianCasualties.unshift({
    id: `victim_${Date.now()}`,
    name: bystanderName,
    slainByMasterId: attacker.username,
    timestamp: Date.now()
  });

  const casualtyText = `☠️ COLLATERAL CASUALTY: Master **${attacker.username}**'s Servant (${attacker.servantName}) struck down innocent bystander **${bystanderName}**! The victim was killed instantly, and **${attacker.username}**'s identity is now VIOLENTLY EXPOSED on the Holy Grail War status board for breaching the Secrecy of Magecraft!`;

  targetWar.eventLogs.unshift({
    id: `evt_casualty_${Date.now()}`,
    timestamp: Date.now(),
    text: casualtyText,
    type: 'casualty'
  });

  return {
    success: true,
    message: casualtyText,
    targetWasMaster: false,
    isCollateralCasualty: true,
    updatedWar: targetWar
  };
}

// Leak intelligence onto the status board
export function leakIntelInWar(
  war: HolyGrailWarSession,
  leakerDiscordId: string,
  intelText: string,
  targetToExposeQuery?: string
): WarActionResult {
  const targetWar = war || globalWarSession;
  if (!targetWar) {
    return { success: false, message: 'Holy Grail War is not active!', updatedWar: war };
  }

  if (!targetWar.leakedIntel) targetWar.leakedIntel = [];
  if (!targetWar.eventLogs) targetWar.eventLogs = [];

  const leaker = targetWar.participants[leakerDiscordId];
  const leakerName = leaker?.username || leakerDiscordId;

  let exposedMaster: WarMasterParticipant | undefined;

  if (targetToExposeQuery && targetToExposeQuery.trim()) {
    const q = targetToExposeQuery.trim().toLowerCase();
    exposedMaster = Object.values(targetWar.participants).find(
      p => p.discordId.toLowerCase() === q || p.username.toLowerCase().includes(q) || q.includes(p.username.toLowerCase())
    );

    if (exposedMaster) {
      exposedMaster.isExposed = true;
      exposedMaster.exposureReason = 'intel_leak';
    }
  }

  const leakId = `leak_${Date.now()}`;
  targetWar.leakedIntel.unshift({
    id: leakId,
    informantMasterId: leakerName,
    intel: intelText,
    timestamp: Date.now(),
    targetMasterId: exposedMaster?.discordId
  });

  const logText = exposedMaster
    ? `🕵️ INTEL LEAK: An anonymous leak verified that **${exposedMaster.username}** is contracted to **${exposedMaster.servantName}** (${exposedMaster.servantClass})! Leaked Dispatch: "${intelText}"`
    : `🕵️ INTEL LEAK: A clandestine report was broadcasted onto the Info Board: "${intelText}"`;

  targetWar.eventLogs.unshift({
    id: `evt_leak_${Date.now()}`,
    timestamp: Date.now(),
    text: logText,
    type: 'intel_leak'
  });

  return {
    success: true,
    message: logText,
    exposedTargetMaster: exposedMaster?.username,
    updatedWar: targetWar
  };
}

export function executeWarAction(
  war: HolyGrailWarSession,
  actorDiscordId: string,
  action: WarActionType,
  targetParam?: string
): WarActionResult {
  const targetWar = war || globalWarSession;
  if (!targetWar) {
    return { success: false, message: 'Holy Grail War is not active!', updatedWar: war };
  }

  const actor = targetWar.participants[actorDiscordId];
  if (!actor || !actor.isAlive) {
    return { success: false, message: 'You are eliminated from the Holy Grail War!', updatedWar: targetWar };
  }

  if (action === 'attack_suspect' && targetParam) {
    return attackSuspectUserInWar(targetWar, actorDiscordId, targetParam);
  }

  if (action === 'leak_intel' && targetParam) {
    return leakIntelInWar(targetWar, actorDiscordId, targetParam);
  }

  if (action === 'expose_master') {
    const res = exposeMasterInWar(targetWar, actorDiscordId, 'public_command');
    return { success: true, message: 'Master exposed publicly.', updatedWar: res.updatedWar };
  }

  let resultMsg = '';
  let combatInfo: WarActionResult['combatTriggered'];
  let eliminatedId: string | undefined;

  switch (action) {
    case 'rest_and_heal': {
      const healAmount = Math.round(actor.maxHp * 0.45);
      actor.currentHp = Math.min(actor.maxHp, actor.currentHp + healAmount);
      resultMsg = `🩹 Channeled mana to recover ${healAmount.toLocaleString()} HP for ${actor.isExposed ? actor.servantName : 'contracted Servant'} (HP: ${actor.currentHp.toLocaleString()}/${actor.maxHp.toLocaleString()}).`;
      break;
    }

    case 'form_alliance': {
      if (!targetParam || !targetWar.participants[targetParam]) {
        return { success: false, message: 'Specify a valid Master to form an alliance with!', updatedWar: targetWar };
      }
      const targetMaster = targetWar.participants[targetParam];
      if (targetMaster.discordId === actor.discordId || !targetMaster.isAlive) {
        return { success: false, message: 'Cannot form an alliance with this Master.', updatedWar: targetWar };
      }
      const allianceId = `alliance_${Date.now()}`;
      const alliance: WarAlliance = {
        id: allianceId,
        name: `Covenant of ${actor.username} & ${targetMaster.username}`,
        memberMasterIds: [actor.discordId, targetMaster.discordId],
        isSecret: true,
        betrayalRiskScore: 30
      };
      targetWar.alliances[allianceId] = alliance;
      actor.allianceId = allianceId;
      targetMaster.allianceId = allianceId;
      resultMsg = `🤝 Secret Covenant formed between ${actor.isExposed ? actor.username : 'Unknown Master'} & ${targetMaster.isExposed ? targetMaster.username : 'Hidden Master'}!`;
      break;
    }

    case 'betray_ally': {
      if (!actor.allianceId || !targetWar.alliances[actor.allianceId]) {
        return { success: false, message: 'You have no active alliance to betray!', updatedWar: targetWar };
      }
      const activeAlliance = targetWar.alliances[actor.allianceId];
      const allyId = activeAlliance.memberMasterIds.find(id => id !== actor.discordId);
      if (!allyId || !targetWar.participants[allyId]) {
        return { success: false, message: 'No ally found in current pact.', updatedWar: targetWar };
      }
      const ally = targetWar.participants[allyId];
      delete targetWar.alliances[actor.allianceId];
      actor.allianceId = undefined;
      ally.allianceId = undefined;

      actor.isExposed = true;
      actor.exposureReason = 'ambush_clash';
      ally.isExposed = true;
      ally.exposureReason = 'ambush_clash';

      combatInfo = {
        opponentId: ally.discordId,
        opponentName: ally.username,
        isAmbush: true
      };
      resultMsg = `🗡️ BETRAYAL! **${actor.username}** broke the covenant and ambushed **${ally.username}** with a lethal surprise strike! Both identities are exposed!`;
      break;
    }

    case 'challenge_master': {
      if (!targetParam || !targetWar.participants[targetParam]) {
        return { success: false, message: 'Target Master not found!', updatedWar: targetWar };
      }
      const opponent = targetWar.participants[targetParam];
      if (opponent.discordId === actor.discordId || !opponent.isAlive) {
        return { success: false, message: 'Cannot challenge this target.', updatedWar: targetWar };
      }

      actor.isExposed = true;
      actor.exposureReason = 'direct_combat';
      opponent.isExposed = true;
      opponent.exposureReason = 'direct_combat';

      combatInfo = {
        opponentId: opponent.discordId,
        opponentName: opponent.username,
        isAmbush: false
      };
      resultMsg = `⚔️ OPEN CLASH: **${actor.username}** (${actor.servantName}) directly engages **${opponent.username}** (${opponent.servantName})!`;
      break;
    }

    case 'simulate_skirmish': {
      return simulateWarSkirmish(targetWar);
    }
  }

  targetWar.eventLogs.unshift({
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
    updatedWar: targetWar
  };
}

export function simulateWarSkirmish(war: HolyGrailWarSession): WarActionResult {
  const targetWar = war || globalWarSession;
  if (!targetWar) {
    return { success: false, message: 'Holy Grail War is not active.', updatedWar: war };
  }

  const aliveRivals = Object.values(targetWar.participants).filter(p => p.isAlive);
  if (aliveRivals.length < 2) {
    return {
      success: true,
      message: 'Not enough active Masters remaining in Fuyuki for a background skirmish.',
      updatedWar: targetWar
    };
  }

  const idx1 = Math.floor(Math.random() * aliveRivals.length);
  let idx2 = Math.floor(Math.random() * (aliveRivals.length - 1));
  if (idx2 >= idx1) idx2++;

  const ai1 = aliveRivals[idx1];
  const ai2 = aliveRivals[idx2];
  const damage = Math.round(3500 + Math.random() * 4500);
  ai2.currentHp = Math.max(0, ai2.currentHp - damage);

  if (!ai1.isExposed && Math.random() < 0.45) {
    ai1.isExposed = true;
    ai1.exposureReason = 'direct_combat';
  }
  if (!ai2.isExposed && Math.random() < 0.45) {
    ai2.isExposed = true;
    ai2.exposureReason = 'direct_combat';
  }

  const name1 = ai1.isExposed ? `Master **${ai1.username}** (${ai1.servantName})` : `An unidentified Master with **${ai1.servantClass}**`;
  const name2 = ai2.isExposed ? `Master **${ai2.username}** (${ai2.servantName})` : `a shadow Master with **${ai2.servantClass}**`;

  let clashText = `⚔️ SKIRMISH: ${name1} clashed in the city with ${name2}, dealing ${damage.toLocaleString()} damage!`;

  if (ai2.currentHp <= 0) {
    ai2.isAlive = false;
    ai2.isExposed = true;
    ai1.kills++;
    clashText = `☠️ ELIMINATION: ${name1} struck a fatal blow and eliminated Master **${ai2.username}** (${ai2.servantName}) from the Holy Grail War!`;
  }

  targetWar.eventLogs.unshift({
    id: `evt_skirmish_${Date.now()}`,
    timestamp: Date.now(),
    text: clashText,
    type: ai2.currentHp <= 0 ? 'elimination' : 'clash'
  });

  const remainingAlive = Object.values(targetWar.participants).filter(p => p.isAlive);
  if (remainingAlive.length === 1) {
    targetWar.status = 'concluded';
    targetWar.grailWinnerId = remainingAlive[0].discordId;
    remainingAlive[0].isExposed = true;
    targetWar.eventLogs.unshift({
      id: `evt_grail_win_${Date.now()}`,
      timestamp: Date.now(),
      text: `🏆 THE HOLY GRAIL HAS MANIFESTED! Master **${remainingAlive[0].username}** (${remainingAlive[0].servantName}) is the sole survivor and has won the Holy Grail War!`,
      type: 'clash'
    });
  }

  return {
    success: true,
    message: clashText,
    eliminatedMasterId: ai2.currentHp <= 0 ? ai2.discordId : undefined,
    updatedWar: targetWar
  };
}

/**
 * Records the outcome of a duel between two Masters with the decisive choice to Kill or Spare.
 * If killed, the defeated Master is permanently eliminated from the Holy Grail War.
 */
export function recordDuelOutcome(
  war: HolyGrailWarSession,
  winnerQuery: string,
  loserQuery: string,
  decision: 'kill' | 'spare'
): {
  updatedWar: HolyGrailWarSession;
  message: string;
  eliminated: boolean;
  victorMaster?: WarMasterParticipant;
  defeatedMaster?: WarMasterParticipant;
} {
  const targetWar = war || globalWarSession;
  if (!targetWar) {
    return {
      updatedWar: war,
      message: 'Holy Grail War session not found.',
      eliminated: false
    };
  }

  const findParticipant = (q: string) => {
    const clean = q.replace(/[<@!>]/g, '').trim().toLowerCase();
    return Object.values(targetWar.participants).find(
      p =>
        p.discordId.toLowerCase() === clean ||
        p.username.toLowerCase() === clean ||
        p.username.toLowerCase().includes(clean) ||
        clean.includes(p.username.toLowerCase()) ||
        p.servantName.toLowerCase().includes(clean)
    );
  };

  const victor = findParticipant(winnerQuery) || Object.values(targetWar.participants)[0];
  let defeated = findParticipant(loserQuery);

  // If defeated participant isn't in participants map (e.g. shadow / rival), find first alive rival
  if (!defeated) {
    defeated = Object.values(targetWar.participants).find(
      p => p.discordId !== victor.discordId && p.isAlive
    );
  }

  if (!defeated) {
    return {
      updatedWar: targetWar,
      message: 'Defeated Master was not found in the Holy Grail War roster.',
      eliminated: false,
      victorMaster: victor
    };
  }

  // Both identities become exposed due to the decisive duel
  victor.isExposed = true;
  victor.exposureReason = 'direct_combat';
  defeated.isExposed = true;
  defeated.exposureReason = 'direct_combat';

  let outcomeLog = '';
  let isEliminated = false;

  if (decision === 'kill') {
    defeated.isAlive = false;
    defeated.currentHp = 0;
    victor.kills = (victor.kills || 0) + 1;
    isEliminated = true;

    outcomeLog = `☠️ FATAL EXECUTION: Master **${victor.username}** (${victor.servantName}) dealt the finishing blow and EXECUTED Master **${defeated.username}** (${defeated.servantName})! Master **${defeated.username}** is PERMANENTLY ELIMINATED from the Holy Grail War!`;

    targetWar.eventLogs.unshift({
      id: `evt_exec_${Date.now()}`,
      timestamp: Date.now(),
      text: outcomeLog,
      type: 'elimination'
    });

    const aliveList = Object.values(targetWar.participants).filter(p => p.isAlive);
    if (aliveList.length === 1) {
      targetWar.status = 'concluded';
      targetWar.grailWinnerId = aliveList[0].discordId;
      targetWar.eventLogs.unshift({
        id: `evt_win_${Date.now()}`,
        timestamp: Date.now(),
        text: `🏆 THE HOLY GRAIL HAS MANIFESTED! Master **${aliveList[0].username}** (${aliveList[0].servantName}) is the sole survivor and has won the Holy Grail War!`,
        type: 'clash'
      });
    }
  } else {
    // Spared: left on critical HP (10% max HP)
    defeated.isAlive = true;
    defeated.currentHp = Math.max(1, Math.round(defeated.maxHp * 0.1));
    isEliminated = false;

    outcomeLog = `🕊️ MERCY BESTOWED: Master **${victor.username}** (${victor.servantName}) defeated Master **${defeated.username}** (${defeated.servantName}) in a duel, but chose to SPARE their life! **${defeated.username}** survives with critical HP (${defeated.currentHp.toLocaleString()}/${defeated.maxHp.toLocaleString()}).`;

    targetWar.eventLogs.unshift({
      id: `evt_mercy_${Date.now()}`,
      timestamp: Date.now(),
      text: outcomeLog,
      type: 'heal'
    });
  }

  return {
    updatedWar: targetWar,
    message: outcomeLog,
    eliminated: isEliminated,
    victorMaster: victor,
    defeatedMaster: defeated
  };
}

