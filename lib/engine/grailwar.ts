import {
  HolyGrailWarSession,
  WarMasterParticipant,
  WarAlliance,
  MasterProfile
} from '../types';
import { SERVANT_DATABASE } from '../data/servants';

// =========================================================================
// GLOBAL SHARED HOLY GRAIL WAR SINGLETON
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
  warTitle: string = 'Fuyuki Holy Grail War'
): HolyGrailWarSession {
  const warId = `grail_war_${Date.now()}`;

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
        text: `🕯️ The ${warTitle} has commenced! All Masters operate from the shadows. Identities remain concealed until exposed by public actions, tactical ambushes, or intelligence leaks.`,
        type: 'clash'
      }
    ]
  };

  globalWarSession = session;
  return session;
}

export function getOrInitWarSession(master: MasterProfile): HolyGrailWarSession {
  const activeServant =
    master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];

  const servantName = activeServant?.template?.name || 'Heroic Spirit';
  const servantClass = activeServant?.template?.servantClass || 'Saber';
  const avatarUrl = activeServant?.template?.avatarUrl || '';
  const maxHp = activeServant?.template?.baseHp || 15000;

  if (!globalWarSession) {
    globalWarSession = createHolyGrailWarSession({
      discordId: master.discordId,
      username: master.username,
      servantId: activeServant?.id || 'servant_init',
      servantName,
      avatarUrl,
      maxHp,
      servantClass
    });
    return globalWarSession;
  }

  if (!globalWarSession.leakedIntel) globalWarSession.leakedIntel = [];
  if (!globalWarSession.civilianCasualties) globalWarSession.civilianCasualties = [];
  if (!globalWarSession.eventLogs) globalWarSession.eventLogs = [];

  // Check if this real player already occupies a slot (by Discord ID or username match)
  const existingKey = Object.keys(globalWarSession.participants).find(
    k => k === master.discordId || 
         globalWarSession!.participants[k].discordId === master.discordId ||
         globalWarSession!.participants[k].username.toLowerCase() === master.username.toLowerCase()
  );

  if (existingKey) {
    const existing = globalWarSession.participants[existingKey];

    // If the key was a placeholder slot ID (e.g. ai_shadow_slot_3), migrate key to real discordId
    if (existingKey !== master.discordId) {
      delete globalWarSession.participants[existingKey];
      existing.discordId = master.discordId;
      globalWarSession.participants[master.discordId] = existing;
    }

    existing.username = master.username;

    // CRITICAL: If the Master was slain/eliminated, NEVER resurrect them or alter their deceased status!
    if (!existing.isAlive) {
      existing.currentHp = 0;
      existing.isAlive = false;
      return globalWarSession;
    }

    if (activeServant) {
      existing.servantId = activeServant.id;
      existing.servantName = activeServant.template.name;
      existing.servantClass = activeServant.template.servantClass;
      existing.avatarUrl = activeServant.template.avatarUrl;
    }
    return globalWarSession;
  }

  // Player is a NEW real Master entering the war: Add them directly to participants!
  globalWarSession.participants[master.discordId] = {
    discordId: master.discordId,
    username: master.username,
    servantId: activeServant?.id || 'servant_contract',
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
    text: `🕯️ A concealed Master contracted with a Heroic Spirit in the shadows and entered the Holy Grail War.`,
    type: 'clash'
  });

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
  | 'expose_master'
  | 'set_ward'
  | 'toggle_evade';

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

  // A. Attacker global cooldown (2 minutes)
  const now = Date.now();
  if (attacker.lastAmbushTime && now - attacker.lastAmbushTime < 120000) {
    const remainingSecs = Math.ceil((120000 - (now - attacker.lastAmbushTime)) / 1000);
    return {
      success: false,
      message: `⏳ **Clandestine Action Cooldown:** Your Servant is still recovering after their last maneuver! Wait another **${remainingSecs}s** before launching another ambush.`,
      updatedWar: targetWar
    };
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

  // B. Target's ambushed cooldown (3 minutes)
  if (targetMaster && targetMaster.isAlive && targetMaster.lastAmbushedTime && now - targetMaster.lastAmbushedTime < 180000) {
    const remainingSecs = Math.ceil((180000 - (now - targetMaster.lastAmbushedTime)) / 1000);
    return {
      success: false,
      message: `🚨 **Alert Protocol Active:** **${targetMaster.username}** has recently clashed and is on high alert! Wait **${remainingSecs}s** before trying to ambush them.`,
      updatedWar: targetWar
    };
  }

  // ---------------------------------------------------------
  // CASE 1: TARGET IS A REAL MASTER IN THE WAR
  // ---------------------------------------------------------
  if (targetMaster && targetMaster.isAlive) {
    // Record action timers
    attacker.lastAmbushTime = now;
    targetMaster.lastAmbushedTime = now;

    // Both get exposed (unless some passive/evade rescues them later)
    attacker.isExposed = true;
    attacker.exposureReason = 'ambush_clash';

    targetMaster.isExposed = true;
    targetMaster.exposureReason = 'ambush_clash';

    const defenderClass = targetMaster.servantClass || 'Saber';

    // 1. PRESENCE CONCEALMENT: ASSASSIN PASSIVE
    if (defenderClass === 'Assassin') {
      const pcDamage = 2500;
      attacker.currentHp = Math.max(0, attacker.currentHp - pcDamage);
      
      let failMsg = `🕶️ **PRESENCE CONCEALMENT DETECTION!** <@${attacker.discordId}> attempted to ambush suspected Master <@${targetMaster.discordId}> (**${targetMaster.username}**), but their Servant is an **Assassin**!\n\n` +
        `• The Assassin detected the intrusion, nullifying the surprise ambush entirely.\n` +
        `• The Assassin counter-struck from the shadows, dealing **${pcDamage.toLocaleString()} DMG** to Master **${attacker.username}**'s Servant (**${attacker.servantName}**)! (HP: ${attacker.currentHp}/${attacker.maxHp})\n` +
        `• Master **${attacker.username}**'s identity is now EXPOSED to the server!`;

      if (attacker.currentHp <= 0) {
        attacker.isAlive = false;
        failMsg += `\n☠️ **FATAL CONSEQUENCE:** Master **${attacker.username}** was slain by the Assassin they tried to ambush!`;
      }

      targetWar.eventLogs.unshift({
        id: `evt_ambush_fail_${Date.now()}`,
        timestamp: now,
        text: `🕶️ Assassin Presence Concealment triggered: **${attacker.username}**'s ambush on **${targetMaster.username}** failed, taking ${pcDamage} counter damage!`,
        type: 'ambush'
      });

      return {
        success: true,
        message: failMsg,
        targetWasMaster: true,
        updatedWar: targetWar
      };
    }

    // Base surprise ambush damage
    let ambushDamage = Math.round(3800 + Math.random() * 2500);
    let defenseText = '';

    // 2. BOUNDED FIELD / WORKSHOP WARDS
    const wardType = targetMaster.boundedField || 'none';
    if (wardType === 'ward') {
      // Absorbs 60% of damage
      const absorbed = Math.round(ambushDamage * 0.6);
      ambushDamage = ambushDamage - absorbed;
      defenseText += `🛡️ **Mage's Sanctuary Bounded Field** absorbed 60% of the strike (parried **${absorbed.toLocaleString()} DMG**).\n`;
    } else if (wardType === 'alarm') {
      // Alerts and strikes back for 3000 counter-damage
      const counterDmg = 3000;
      attacker.currentHp = Math.max(0, attacker.currentHp - counterDmg);
      defenseText += `🚨 **Alarm Ward Triggered!** The security field triggered an intrusion defense, dealing **${counterDmg.toLocaleString()} DMG** back to Master **${attacker.username}**'s Servant (**${attacker.servantName}**)! (HP: ${attacker.currentHp}/${attacker.maxHp})\n`;
      
      if (attacker.currentHp <= 0) {
        attacker.isAlive = false;
      }
    }

    // 3. INSTINCT / CLAIRVOYANCE (Saber, Archer, Lancer) PASSIVE (35% chance to parry 80%)
    const hasInstinct = ['Saber', 'Archer', 'Lancer'].includes(defenderClass);
    if (hasInstinct && Math.random() < 0.35) {
      const parried = Math.round(ambushDamage * 0.8);
      ambushDamage = ambushDamage - parried;
      defenseText += `👁️ **Instinct/Clairvoyance Alert:** Servant **${targetMaster.servantName}** sensed the threat instantly! They parried 80% of the damage (saved **${parried.toLocaleString()} DMG**) and counter-struck **${attacker.username}** for **1,500 DMG**!\n`;
      
      // Deal counter dmg
      attacker.currentHp = Math.max(0, attacker.currentHp - 1500);
      if (attacker.currentHp <= 0) {
        attacker.isAlive = false;
      }
    }

    // Apply the final damage to target
    targetMaster.currentHp = Math.max(0, targetMaster.currentHp - ambushDamage);

    let mainMessage = `🚨 **FUYUKI AIR RAID SIREN — <@${targetMaster.discordId}>, YOU ARE BEING AMBUSHED!**\n\n` +
      `Master <@${attacker.discordId}> (**${attacker.username}**) launched a surprise assault on suspected Master <@${targetMaster.discordId}> (**${targetMaster.username}**)! Both identities are now EXPOSED to the server!\n\n` +
      `• **Final Result:** **${targetMaster.username}**'s Servant (**${targetMaster.servantName}**) took **${ambushDamage.toLocaleString()} DMG**! (HP: ${targetMaster.currentHp}/${targetMaster.maxHp})\n` +
      (defenseText ? `• **Defensive Countermeasures:**\n${defenseText}` : '');

    let eliminatedId: string | undefined;

    // 4. COMMAND SEAL EMERGENCY EVACUATION (Auto-Evacuate on Lethal Damage)
    if (targetMaster.currentHp <= 0 && targetMaster.autoEvadeEnabled !== false && targetMaster.commandSeals >= 1) {
      targetMaster.commandSeals--;
      targetMaster.currentHp = 1;
      targetMaster.isAlive = true;
      targetMaster.isExposed = false; // Vanish back into the shadows
      
      mainMessage += `\n\n🔴 **EMERGENCY COMMAND SEAL EVACUATION!**\n` +
        `As **${targetMaster.username}** faced a fatal ambush, their contracted Command Seal flared: *“By my Command Seal... Spatial Evacuation!”*\n` +
        `• Consumed **1 Command Seal** (Remaining: **${targetMaster.commandSeals}/3**).\n` +
        `• Nullified the death-blow! **${targetMaster.username}** escaped into deep shadows with **1 HP**!`;

      targetWar.eventLogs.unshift({
        id: `evt_evac_${Date.now()}`,
        timestamp: now,
        text: `🔴 Emergency Evacuation: **${targetMaster.username}** consumed 1 Command Seal to escape fatal ambush from **${attacker.username}**!`,
        type: 'ambush'
      });
    }
    // 5. BATTLE CONTINUATION PASSIVE (Berserker / Lancer)
    else if (targetMaster.currentHp <= 0 && ['Berserker', 'Lancer'].includes(defenderClass) && !targetMaster.gutsTriggered) {
      targetMaster.gutsTriggered = true;
      targetMaster.currentHp = Math.round(targetMaster.maxHp * 0.25);
      targetMaster.isAlive = true;
      
      mainMessage += `\n\n❤️ **BATTLE CONTINUATION (GUTS)!**\n` +
        `**${targetMaster.username}**'s Servant (**${targetMaster.servantName}**) took a lethal blow, but their indomitable class spirit activated **Battle Continuation**!\n` +
        `• Clung to life, reviving instantly with **25% HP** (**${targetMaster.currentHp.toLocaleString()} HP**)!`;

      targetWar.eventLogs.unshift({
        id: `evt_guts_${Date.now()}`,
        timestamp: now,
        text: `❤️ Battle Continuation: **${targetMaster.username}**'s ${targetMaster.servantName} revived with 25% HP during ambush!`,
        type: 'ambush'
      });
    }
    // 6. ACTUAL DEATH / ELIMINATION
    else if (targetMaster.currentHp <= 0) {
      targetMaster.isAlive = false;
      attacker.kills++;
      eliminatedId = targetMaster.discordId;
      
      mainMessage += `\n\n☠️ **FATAL AMBUSH:** Master **${targetMaster.username}**'s Servant took a fatal strike and was permanently ELIMINATED from the active Holy Grail War!`;

      targetWar.eventLogs.unshift({
        id: `evt_elim_${Date.now()}`,
        timestamp: now,
        text: `☠️ Fatal Ambush: **${attacker.username}** ambushed and ELIMINATED Master **${targetMaster.username}**!`,
        type: 'elimination'
      });
    } else {
      // Normal non-lethal ambush log
      targetWar.eventLogs.unshift({
        id: `evt_ambush_${Date.now()}`,
        timestamp: now,
        text: `⚔️ Ambush: **${attacker.username}** ambushed **${targetMaster.username}** for ${ambushDamage} DMG!`,
        type: 'ambush'
      });
    }

    // Check war conclusion
    const remainingAlive = Object.values(targetWar.participants).filter(p => p.isAlive);
    if (remainingAlive.length === 1) {
      targetWar.status = 'concluded';
      targetWar.grailWinnerId = remainingAlive[0].discordId;
      targetWar.eventLogs.unshift({
        id: `evt_win_${Date.now()}`,
        timestamp: now,
        text: `🏆 THE HOLY GRAIL HAS MANIFESTED! **${remainingAlive[0].username}** is the sole survivor and has won the Holy Grail War!`,
        type: 'clash'
      });
    }

    return {
      success: true,
      message: mainMessage,
      targetWasMaster: true,
      isCollateralCasualty: false,
      eliminatedMasterId: eliminatedId,
      updatedWar: targetWar
    };
  }

  // ---------------------------------------------------------
  // CASE 2: TARGET IS AN INNOCENT SERVER USER (COLLATERAL CASUALTY)
  // ---------------------------------------------------------
  attacker.lastAmbushTime = now;
  attacker.isExposed = true;
  attacker.exposureReason = 'innocent_assault';
  attacker.innocentKills = (attacker.innocentKills || 0) + 1;

  if (!targetWar.civilianCasualties) targetWar.civilianCasualties = [];
  const bystanderName = suspectQuery.startsWith('@') ? suspectQuery : `@${suspectQuery}`;

  targetWar.civilianCasualties.unshift({
    id: `victim_${Date.now()}`,
    name: bystanderName,
    slainByMasterId: attacker.username,
    timestamp: now
  });

  const casualtyText = `☠️ **COLLATERAL CASUALTY: CIVILIAN SLAIN!**\n\n` +
    `Master **${attacker.username}**'s Servant (${attacker.servantName}) struck down innocent server bystander **${bystanderName}**!\n` +
    `• The victim was killed instantly.\n` +
    `• Master **${attacker.username}**'s identity is now **VIOLENTLY EXPOSED** to the server for breaching the Secrecy of Magecraft!`;

  targetWar.eventLogs.unshift({
    id: `evt_casualty_${Date.now()}`,
    timestamp: now,
    text: `☠️ Collateral Damage: **${attacker.username}**'s Servant killed bystander **${bystanderName}**!`,
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

  if (action === 'set_ward' && targetParam) {
    const val = targetParam as 'none' | 'ward' | 'alarm';
    if (!['none', 'ward', 'alarm'].includes(val)) {
      return { success: false, message: 'Invalid ward type! Choose none, ward, or alarm.', updatedWar: targetWar };
    }
    actor.boundedField = val;
    let desc = '';
    if (val === 'none') desc = 'deactivated all active bounded fields';
    else if (val === 'ward') desc = 'reinforced a Mage Workshop sanctuary field (blocks 60% incoming ambush damage)';
    else if (val === 'alarm') desc = 'deployed a high-alert Intrusion Alert Trap (detects ambushes and deals 3,000 retaliatory DMG)';
    
    // Note: Private workshop defenses are NOT published to the public War Chronicle

    return {
      success: true,
      message: `🏰 **Sanctuary Updated:** You have successfully ${desc}!`,
      updatedWar: targetWar
    };
  }

  if (action === 'toggle_evade' && targetParam) {
    const val = targetParam === 'on';
    actor.autoEvadeEnabled = val;
    const desc = val 
      ? 'ENABLED Command Seal Auto-Evacuation (automatically consumes 1 Command Seal on lethal blows to retreat to shadows with 1 HP)'
      : 'DISABLED Command Seal Auto-Evacuation';

    // Note: Private Command Seal evacuation settings are NOT published to the public War Chronicle

    return {
      success: true,
      message: `🔴 **Evacuation Settings:** Successfully ${desc}!`,
      updatedWar: targetWar
    };
  }

  let resultMsg = '';
  let combatInfo: WarActionResult['combatTriggered'];
  let eliminatedId: string | undefined;

  switch (action) {
    case 'rest_and_heal': {
      const healAmount = Math.round(actor.maxHp * 0.45);
      actor.currentHp = Math.min(actor.maxHp, actor.currentHp + healAmount);
      resultMsg = `🩹 Channeled mana to recover ${healAmount.toLocaleString()} HP for ${actor.isExposed ? actor.servantName : 'contracted Servant'} (HP: ${actor.currentHp.toLocaleString()}/${actor.maxHp.toLocaleString()}).`;
      // Private mana recovery in workshop is confidential
      return {
        success: true,
        message: resultMsg,
        updatedWar: targetWar
      };
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
    type: action === 'betray_ally' ? 'betrayal' : action === 'form_alliance' ? 'alliance' : 'clash'
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
  const name2 = ai2.isExposed ? `Master **${ai2.username}** (${ai2.servantName})` : `an unidentified Master with **${ai2.servantClass}**`;

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

