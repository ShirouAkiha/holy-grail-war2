import {
  HolyGrailWarSession,
  WarMasterParticipant,
  WarAlliance
} from '../types';
import { SERVANT_DATABASE } from '../data/servants';

export function createHolyGrailWarSession(
  initiatorMaster: { discordId: string; username: string; servantId: string; servantName: string; avatarUrl: string; maxHp: number },
  warTitle: string = '7-Master Fuyuki Holy Grail War'
): HolyGrailWarSession {
  const warId = `grail_war_${Date.now()}`;

  // Initialize participants with the initiator + 6 Rival Masters
  // All Masters start hidden in the shadows until exposed by public command, ambush, or leak!
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
      isExposed: false,
      kills: 0,
      innocentKills: 0
    }
  };

  // Seed 6 other rival Master slots (operating in concealment from the server shadows)
  const defaultClasses = [
    { slot: 2, class: 'Archer' as const, servantId: 'gilgamesh_archer', servantName: 'King of Heroes' },
    { slot: 3, class: 'Lancer' as const, servantId: 'cu_chulainn_lancer', servantName: 'Hound of Ulster' },
    { slot: 4, class: 'Berserker' as const, servantId: 'heracles_berserker', servantName: 'Great Berserker' },
    { slot: 5, class: 'Ruler' as const, servantId: 'jeanne_darc_ruler', servantName: 'Holy Maiden' },
    { slot: 6, class: 'Assassin' as const, servantId: 'emiya_archer', servantName: 'Nameless Hero' },
    { slot: 7, class: 'Rider' as const, servantId: 'terminal_saber_linus', servantName: 'Iron Sovereign' }
  ];

  defaultClasses.forEach(r => {
    const id = `master_slot_${r.slot}`;
    const t = SERVANT_DATABASE.find(s => s.id === r.servantId);
    const hp = t ? t.baseHp : 11000;
    participants[id] = {
      discordId: id,
      username: `Master Slot #${r.slot}`,
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

  return {
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
}

export type WarActionType =
  | 'challenge_master'  // Challenge a rival Master to a duel
  | 'form_alliance'      // Propose a pact with another Master
  | 'betray_ally'        // Ambush an ally
  | 'rest_and_heal'      // Recover Servant HP
  | 'simulate_skirmish' // Simulate rival clashes across the city
  | 'attack_suspect'     // Ambush a suspected user in the server
  | 'leak_intel'         // Leak intelligence onto the board
  | 'expose_master';     // Expose a master due to public command usage

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
  const updatedWar: HolyGrailWarSession = JSON.parse(JSON.stringify(war));
  const query = masterIdOrUsername.toLowerCase().trim();

  const participant = Object.values(updatedWar.participants).find(
    p => p.discordId.toLowerCase() === query || p.username.toLowerCase() === query || query.includes(p.username.toLowerCase())
  );

  if (!participant) {
    return { updatedWar, newlyExposed: false };
  }

  if (participant.isExposed) {
    return { updatedWar, newlyExposed: false, participant };
  }

  participant.isExposed = true;
  participant.exposureReason = reason;

  let reasonText = '';
  switch (reason) {
    case 'public_command':
      reasonText = `📡 EXPOSURE: Master **${participant.username}** invoked magecraft in a public server channel! Their identity and contracted Servant (**${participant.servantName}** - ${participant.servantClass}) are now exposed to all participants!`;
      break;
    case 'ambush_clash':
      reasonText = `⚔️ EXPOSURE: **${participant.username}** (${participant.servantName}) had their identity exposed during a tactical ambush clash!`;
      break;
    case 'innocent_assault':
      reasonText = `☠️ EXPOSURE: **${participant.username}** violated the Secrecy of Magecraft by attacking a bystander! Their identity is now exposed to the entire server!`;
      break;
    case 'intel_leak':
      reasonText = `🕵️ EXPOSURE: **${participant.username}** (${participant.servantName} - ${participant.servantClass}) was outed by an anonymous intelligence leak!`;
      break;
    case 'direct_combat':
      reasonText = `⚔️ EXPOSURE: **${participant.username}** (${participant.servantName}) engaged in open combat!`;
      break;
  }

  updatedWar.eventLogs.unshift({
    id: `evt_expose_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
    text: reasonText,
    type: 'exposure'
  });

  return { updatedWar, newlyExposed: true, participant };
}

// Attack a suspected user in the server
export function attackSuspectUserInWar(
  war: HolyGrailWarSession,
  attackerId: string,
  suspectQuery: string
): WarActionResult {
  let updatedWar: HolyGrailWarSession = JSON.parse(JSON.stringify(war));
  const attacker = updatedWar.participants[attackerId];

  if (!attacker || !attacker.isAlive) {
    return { success: false, message: 'You are not active in the Holy Grail War!', updatedWar };
  }

  // Clean suspect query (remove @ or discord mention wrapper <@!1234>)
  const cleanQuery = suspectQuery.replace(/[<@!>]/g, '').trim().toLowerCase();

  // Find if target is a real Master in this Grail War
  const targetMaster = Object.values(updatedWar.participants).find(
    p => p.discordId.toLowerCase() === cleanQuery ||
         p.username.toLowerCase() === cleanQuery ||
         p.username.toLowerCase().includes(cleanQuery) ||
         cleanQuery.includes(p.username.toLowerCase())
  );

  if (targetMaster && targetMaster.discordId === attacker.discordId) {
    return { success: false, message: 'You cannot target yourself with an ambush!', updatedWar };
  }

  // ---------------------------------------------------------
  // CASE 1: TARGET IS A REAL MASTER
  // ---------------------------------------------------------
  if (targetMaster && targetMaster.isAlive) {
    // Both attacker and target are now exposed!
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

    updatedWar.eventLogs.unshift({
      id: `evt_ambush_${Date.now()}`,
      timestamp: Date.now(),
      text: ambushText,
      type: targetMaster.currentHp <= 0 ? 'elimination' : 'ambush'
    });

    // Check war conclusion
    const remainingAlive = Object.values(updatedWar.participants).filter(p => p.isAlive);
    if (remainingAlive.length === 1) {
      updatedWar.status = 'concluded';
      updatedWar.grailWinnerId = remainingAlive[0].discordId;
      updatedWar.eventLogs.unshift({
        id: `evt_win_${Date.now()}`,
        timestamp: Date.now(),
        text: `🏆 THE HOLY GRAIL HAS MANIFESTED! ${remainingAlive[0].username} is the sole survivor and has won the Holy Grail War!`,
        type: 'clash'
      });
    }

    return {
      success: true,
      message: ambushText,
      targetWasMaster: true,
      isCollateralCasualty: false,
      eliminatedMasterId: eliminatedId,
      updatedWar
    };
  }

  // ---------------------------------------------------------
  // CASE 2: TARGET IS AN INNOCENT SERVER USER (COLLATERAL CASUALTY)
  // ---------------------------------------------------------
  // Attacker strikes down an innocent bystander!
  // Attacker is immediately exposed for violating the secrecy of Magecraft!
  attacker.isExposed = true;
  attacker.exposureReason = 'innocent_assault';
  attacker.innocentKills = (attacker.innocentKills || 0) + 1;

  if (!updatedWar.civilianCasualties) updatedWar.civilianCasualties = [];
  const bystanderName = suspectQuery.startsWith('@') ? suspectQuery : `@${suspectQuery}`;

  updatedWar.civilianCasualties.unshift({
    id: `victim_${Date.now()}`,
    name: bystanderName,
    slainByMasterId: attacker.username,
    timestamp: Date.now()
  });

  const casualtyText = `☠️ COLLATERAL CASUALTY: Master **${attacker.username}**'s Servant (${attacker.servantName}) struck down innocent bystander **${bystanderName}**! The victim was killed instantly, and **${attacker.username}**'s identity is now VIOLENTLY EXPOSED on the Holy Grail War status board for breaching the Secrecy of Magecraft!`;

  updatedWar.eventLogs.unshift({
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
    updatedWar
  };
}

// Leak intelligence onto the status board
export function leakIntelInWar(
  war: HolyGrailWarSession,
  leakerDiscordId: string,
  intelText: string,
  targetToExposeQuery?: string
): WarActionResult {
  const updatedWar: HolyGrailWarSession = JSON.parse(JSON.stringify(war));
  if (!updatedWar.leakedIntel) updatedWar.leakedIntel = [];

  const leaker = updatedWar.participants[leakerDiscordId];
  const leakerName = leaker?.username || leakerDiscordId;

  let exposedMaster: WarMasterParticipant | undefined;

  if (targetToExposeQuery && targetToExposeQuery.trim()) {
    const q = targetToExposeQuery.trim().toLowerCase();
    exposedMaster = Object.values(updatedWar.participants).find(
      p => p.discordId.toLowerCase() === q || p.username.toLowerCase().includes(q) || q.includes(p.username.toLowerCase())
    );

    if (exposedMaster) {
      exposedMaster.isExposed = true;
      exposedMaster.exposureReason = 'intel_leak';
    }
  }

  const leakId = `leak_${Date.now()}`;
  updatedWar.leakedIntel.unshift({
    id: leakId,
    informantMasterId: leakerName,
    intel: intelText,
    timestamp: Date.now(),
    targetMasterId: exposedMaster?.discordId
  });

  const logText = exposedMaster
    ? `🕵️ INTEL LEAK: An anonymous leak verified that **${exposedMaster.username}** is contracted to **${exposedMaster.servantName}** (${exposedMaster.servantClass})! Leaked Dispatch: "${intelText}"`
    : `🕵️ INTEL LEAK: A clandestine report was broadcasted onto the Info Board: "${intelText}"`;

  updatedWar.eventLogs.unshift({
    id: `evt_leak_${Date.now()}`,
    timestamp: Date.now(),
    text: logText,
    type: 'intel_leak'
  });

  return {
    success: true,
    message: logText,
    exposedTargetMaster: exposedMaster?.username,
    updatedWar
  };
}

export function executeWarAction(
  war: HolyGrailWarSession,
  actorDiscordId: string,
  action: WarActionType,
  targetParam?: string // Target Master ID or query
): WarActionResult {
  const updatedWar: HolyGrailWarSession = JSON.parse(JSON.stringify(war));
  const actor = updatedWar.participants[actorDiscordId];

  if (!actor || !actor.isAlive) {
    return { success: false, message: 'You are eliminated from the Holy Grail War!', updatedWar };
  }

  if (action === 'attack_suspect' && targetParam) {
    return attackSuspectUserInWar(updatedWar, actorDiscordId, targetParam);
  }

  if (action === 'leak_intel' && targetParam) {
    return leakIntelInWar(updatedWar, actorDiscordId, targetParam);
  }

  if (action === 'expose_master') {
    const res = exposeMasterInWar(updatedWar, actorDiscordId, 'public_command');
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
      resultMsg = `🤝 Secret Covenant formed between ${actor.isExposed ? actor.username : 'Unknown Master'} & ${targetMaster.isExposed ? targetMaster.username : 'Hidden Master'}! You fight side-by-side until one betrays the pact.`;
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

      // Betrayal exposes both!
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
      if (!targetParam || !updatedWar.participants[targetParam]) {
        return { success: false, message: 'Target Master not found!', updatedWar };
      }
      const opponent = updatedWar.participants[targetParam];
      if (opponent.discordId === actor.discordId || !opponent.isAlive) {
        return { success: false, message: 'Cannot challenge this target.', updatedWar };
      }

      // Open challenge exposes both
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
      return simulateWarSkirmish(updatedWar);
    }
  }

  // Record event log
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

export function simulateWarSkirmish(war: HolyGrailWarSession): WarActionResult {
  const updated: HolyGrailWarSession = JSON.parse(JSON.stringify(war));
  const aliveRivals = Object.values(updated.participants).filter(p => p.isAlive);

  if (aliveRivals.length < 2) {
    return {
      success: true,
      message: 'Not enough active Masters remaining in Fuyuki for a background skirmish.',
      updatedWar: updated
    };
  }

  // Pick two random alive rivals to clash
  const idx1 = Math.floor(Math.random() * aliveRivals.length);
  let idx2 = Math.floor(Math.random() * (aliveRivals.length - 1));
  if (idx2 >= idx1) idx2++;

  const ai1 = aliveRivals[idx1];
  const ai2 = aliveRivals[idx2];
  const damage = Math.round(3500 + Math.random() * 4500);
  ai2.currentHp = Math.max(0, ai2.currentHp - damage);

  // Chance to expose during intense skirmish
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
    ai2.isExposed = true; // Elimination exposes identity!
    ai1.kills++;
    clashText = `☠️ ELIMINATION: ${name1} struck a fatal blow and eliminated Master **${ai2.username}** (${ai2.servantName}) from the Holy Grail War!`;
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
    remainingAlive[0].isExposed = true;
    updated.eventLogs.unshift({
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
    updatedWar: updated
  };
}
