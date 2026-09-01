import {
  HolyGrailWarSession,
  WarMasterParticipant,
  WarAlliance,
  MasterProfile
} from '../types';
import { SERVANT_DATABASE } from '../data/servants';
import fs from 'fs';
import path from 'path';

// =========================================================================
// GLOBAL SHARED HOLY GRAIL WAR SINGLETON (Shared across all Discord commands & users)
// =========================================================================
const DATA_DIR = path.join(process.cwd(), 'data');
const GRAIL_WAR_FILE = path.join(DATA_DIR, 'grail_war.json');

let globalWarSession: HolyGrailWarSession | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadWarFromDisk(): HolyGrailWarSession | null {
  try {
    ensureDataDir();
    if (fs.existsSync(GRAIL_WAR_FILE)) {
      const raw = fs.readFileSync(GRAIL_WAR_FILE, 'utf-8');
      if (raw) {
        return JSON.parse(raw);
      }
    }
  } catch (err) {
    console.error('[GrailWar] Failed to load grail_war.json from disk:', err);
  }
  return null;
}

export function saveWarToDisk(): void {
  try {
    ensureDataDir();
    if (globalWarSession) {
      fs.writeFileSync(GRAIL_WAR_FILE, JSON.stringify(globalWarSession, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('[GrailWar] Failed to write grail_war.json to disk:', err);
  }
}

// Initial load from disk
globalWarSession = loadWarFromDisk();

export function createHolyGrailWarSession(
  initiatorMaster?: { discordId: string; username: string; servantId: string; servantName: string; avatarUrl: string; maxHp: number; servantClass?: string },
  warTitle: string = 'Fuyuki Holy Grail War'
): HolyGrailWarSession {
  const warId = `grail_war_${Date.now()}`;

  const participants: Record<string, WarMasterParticipant> = {};

  if (initiatorMaster) {
    participants[initiatorMaster.discordId] = {
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
    };
  }

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
        text: `🕯️ The ${warTitle} has commenced! All 7 Master covenants must be summoned in the shadows before the Greater Grail manifests.`,
        type: 'clash'
      }
    ]
  };

  globalWarSession = session;
  saveWarToDisk();
  return session;
}

/**
 * Registers or updates a Master's summoned Servant contract directly in the Holy Grail War memory.
 * Broadcasts an announcement in the war chronicles.
 */
export function registerMasterSummonInWar(master: MasterProfile, servantInstance: any): HolyGrailWarSession {
  const war = getOrInitWarSession();

  const sAny = servantInstance as any;
  const sTemplate = sAny?.template || sAny;
  const servantName = sAny?.nickname || sTemplate?.name || sAny?.name || 'Heroic Spirit';
  const servantClass = sTemplate?.servantClass || sAny?.servantClass || sAny?.class || 'Saber';
  const avatarUrl = sTemplate?.avatarUrl || sAny?.avatarUrl || '';
  const maxHp = sTemplate?.baseHp || sAny?.baseHp || 15000;

  const existing = war.participants[master.discordId];
  const isNewEntry = !existing;

  if (existing) {
    existing.servantId = servantInstance.id || 'servant_contract';
    existing.servantName = servantName;
    existing.servantClass = servantClass;
    existing.avatarUrl = avatarUrl;
    existing.username = master.username;
    if (existing.currentHp <= 0 && existing.isAlive) {
      existing.currentHp = maxHp;
      existing.maxHp = maxHp;
    }
  } else {
    war.participants[master.discordId] = {
      discordId: master.discordId,
      username: master.username,
      servantId: servantInstance.id || 'servant_contract',
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

  const totalSummoned = Object.keys(war.participants).length;

  if (isNewEntry) {
    war.eventLogs.unshift({
      id: `evt_summon_${Date.now()}`,
      timestamp: Date.now(),
      text: `🕯️ A new Master contracted with a Heroic Spirit in the shadows! (Holy Grail War: **${totalSummoned}/7** Masters Summoned)`,
      type: 'clash'
    });

    if (totalSummoned >= 7) {
      war.eventLogs.unshift({
        id: `evt_all_summoned_${Date.now()}`,
        timestamp: Date.now(),
        text: `⚔️ ALL 7 HEROIC SPIRITS HAVE BEEN SUMMONED! The Fuyuki Holy Grail War has reached full convergence! The Elimination Climax begins!`,
        type: 'clash'
      });
    }
  }

  saveWarToDisk();
  return war;
}

/**
 * Removes or resets a Master's participant slot when they sever their contract.
 */
export function handleMasterReleaseInWar(discordId: string): HolyGrailWarSession {
  const war = getOrInitWarSession();
  if (war.participants[discordId]) {
    delete war.participants[discordId];
    const totalRemaining = Object.keys(war.participants).length;
    war.eventLogs.unshift({
      id: `evt_release_${Date.now()}`,
      timestamp: Date.now(),
      text: `⛓️ A Master severed their contract with their Heroic Spirit. Slot returned to the Throne of Heroes (**${totalRemaining}/7** Summoned).`,
      type: 'clash'
    });
    saveWarToDisk();
  }
  return war;
}

/**
 * Returns or initializes the shared, server-wide Holy Grail War session.
 * Real players register directly into the war.
 * Civilians (players with no contracted Servants) can view the war board without registration.
 */
export function getOrInitWarSession(master?: MasterProfile): HolyGrailWarSession {
  if (!globalWarSession) {
    const session: HolyGrailWarSession = {
      id: `grail_war_${Date.now()}`,
      title: 'Fuyuki Holy Grail War',
      status: 'active',
      participants: {},
      alliances: {},
      civilianCasualties: [],
      leakedIntel: [],
      eventLogs: [
        {
          id: `evt_init_${Date.now()}`,
          timestamp: Date.now(),
          text: `🕯️ The Fuyuki Holy Grail War has commenced! All Masters operate from the shadows. Identities remain concealed until exposed by public actions, tactical ambushes, or intelligence leaks.`,
          type: 'clash'
        }
      ]
    };
    globalWarSession = session;
    saveWarToDisk();
  }

  // Ensure arrays exist
  if (!globalWarSession.leakedIntel) globalWarSession.leakedIntel = [];
  if (!globalWarSession.civilianCasualties) globalWarSession.civilianCasualties = [];
  if (!globalWarSession.eventLogs) globalWarSession.eventLogs = [];

  // If no master or civilian without contracted servants, return active session directly
  if (!master || !master.servants || master.servants.length === 0) {
    return globalWarSession;
  }

  const activeServant =
    master.servants.find((s: any) => s.id === master.activeServantId) || master.servants[0];

  const sAny = activeServant as any;
  const sTemplate = sAny?.template || sAny;
  const servantName = sAny?.nickname || sTemplate?.name || sAny?.name || 'Heroic Spirit';
  const servantClass = sTemplate?.servantClass || sAny?.servantClass || sAny?.class || 'Saber';
  const avatarUrl = sTemplate?.avatarUrl || sAny?.avatarUrl || '';
  const maxHp = sTemplate?.baseHp || sAny?.baseHp || 15000;

  // Check if this real player already occupies a slot
  const existingKey = Object.keys(globalWarSession.participants).find(
    k => k === master.discordId || 
         globalWarSession!.participants[k].discordId === master.discordId ||
         globalWarSession!.participants[k].username.toLowerCase() === master.username.toLowerCase()
  );

  if (existingKey) {
    const existing = globalWarSession.participants[existingKey];
    
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
      existing.servantName = servantName;
      existing.servantClass = servantClass;
      existing.avatarUrl = avatarUrl;
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

  const totalCount = Object.keys(globalWarSession.participants).length;

  globalWarSession.eventLogs.unshift({
    id: `evt_enter_${Date.now()}`,
    timestamp: Date.now(),
    text: `🕯️ A new Master contracted with a Heroic Spirit in the shadows! (Holy Grail War: **${totalCount}/7** Masters Summoned)`,
    type: 'clash'
  });

  saveWarToDisk();
  return globalWarSession;
}

export function getActiveWarSession(): HolyGrailWarSession | null {
  return globalWarSession;
}

export function resetWarSession(): HolyGrailWarSession {
  globalWarSession = {
    id: `grail_war_${Date.now()}`,
    title: 'Fuyuki Holy Grail War',
    status: 'active',
    participants: {},
    alliances: {},
    civilianCasualties: [],
    leakedIntel: [],
    eventLogs: [
      {
        id: `evt_reset_${Date.now()}`,
        timestamp: Date.now(),
        text: `🔄 The Holy Grail War tournament has been reset! All 7 Servant slots are now open for new summoning rituals (/summon ritual).`,
        type: 'clash'
      }
    ]
  };
  saveWarToDisk();
  return globalWarSession;
}

export type WarActionType =
  | 'challenge_master'
  | 'form_alliance'
  | 'betray_ally'
  | 'rest_and_heal'
  | 'simulate_skirmish'
  | 'attack_suspect'
  | 'leak_intel'
  | 'patrol_city'
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

/**
 * Evaluates the Holy Grail War status and checks if the Greater Grail can manifest.
 * The Holy Grail War requires all 7 Heroic Spirits to be summoned and 6 eliminated before victory.
 */
export function evaluateWarState(targetWar: HolyGrailWarSession): void {
  const participantsList = Object.values(targetWar.participants || {});
  const totalSummoned = participantsList.length;
  const aliveList = participantsList.filter(p => p.isAlive);
  const deadCount = participantsList.filter(p => !p.isAlive).length;

  if (targetWar.status === 'concluded') {
    saveWarToDisk();
    return;
  }

  // True Holy Grail Climax: All 7 standard Servant slots summoned AND 6 eliminated!
  if (totalSummoned >= 7 && aliveList.length === 1) {
    targetWar.status = 'concluded';
    targetWar.grailWinnerId = aliveList[0].discordId;
    aliveList[0].isExposed = true;
    targetWar.eventLogs.unshift({
      id: `evt_grail_win_${Date.now()}`,
      timestamp: Date.now(),
      text: `🏆 THE GREATER GRAIL HAS MANIFESTED! With all 6 rival Heroic Spirits eliminated, Master **${aliveList[0].username}** (${aliveList[0].servantName}) is the sole survivor and has won the Fuyuki Holy Grail War!`,
      type: 'clash'
    });
  } else if (totalSummoned >= 7) {
    targetWar.status = 'active';
  } else {
    targetWar.status = 'gathering';
  }

  saveWarToDisk();
}

/**
 * Helper to match a target Master in the session via username, discordId, servantName, or designation (e.g. "Shadow Master #2", "Master 2", "#2")
 */
export function findTargetMaster(targetWar: HolyGrailWarSession, query: string): WarMasterParticipant | undefined {
  if (!query) return undefined;
  const rawClean = query.trim().toLowerCase();
  if (!rawClean) return undefined;

  // Clean Discord mention tokens <@!> and leading @
  const idClean = rawClean.replace(/[<@!>]/g, '').replace(/^@/, '').trim();
  if (!idClean) return undefined;

  const participantsList = Object.values(targetWar.participants || {});
  if (participantsList.length === 0) return undefined;

  // 1. Exact match on discordId, username, or @username
  let match = participantsList.find(p => 
    p.discordId.toLowerCase() === idClean ||
    p.username.toLowerCase() === idClean ||
    p.username.toLowerCase() === rawClean ||
    p.username.toLowerCase().replace(/^@/, '') === idClean
  );
  if (match) return match;

  // 2. Strict designation match (e.g. "#2", "shadow master #2", "master 2", "slot 2", or exact single digit "2")
  // MUST use start/end anchors so Discord user IDs or arbitrary strings with numbers (e.g. "pokehunter1") do not match
  const slotMatch = rawClean.match(/^(?:shadow\s*master|master|slot)?\s*#?\s*([1-7])$/i);
  if (slotMatch) {
    const slotIdx = parseInt(slotMatch[1], 10) - 1;
    if (slotIdx >= 0 && slotIdx < participantsList.length) {
      return participantsList[slotIdx];
    }
  }

  // 3. Substring match on username or servantName (only for queries at least 3 characters)
  if (idClean.length >= 3) {
    match = participantsList.find(p => {
      const u = p.username.toLowerCase();
      return u === idClean || u.includes(idClean);
    });
    if (match) return match;

    match = participantsList.find(p => {
      const s = p.servantName ? p.servantName.toLowerCase() : '';
      return s.length > 0 && s.includes(idClean);
    });
    if (match) return match;
  }

  return undefined;
}

// Expose a Master when they perform an action publicly or are identified
export function exposeMasterInWar(
  war: HolyGrailWarSession,
  masterIdOrUsername: string,
  reason: 'public_command' | 'ambush_clash' | 'innocent_assault' | 'intel_leak' | 'direct_combat'
): { updatedWar: HolyGrailWarSession; newlyExposed: boolean; participant?: WarMasterParticipant } {
  const targetWar = war || globalWarSession;
  if (!targetWar) return { updatedWar: war, newlyExposed: false };

  const participant = findTargetMaster(targetWar, masterIdOrUsername);

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

/**
 * Launch an ambush on a target in a specific channel.
 * Anonymous target designation supported (e.g. "Shadow Master #2", "@username", or username).
 * Attacker remains ANONYMOUS in shadows unless trapped by Alarm Ward, counter-struck by Assassin, or attacking an innocent civilian.
 */
export function attackSuspectUserInWar(
  war: HolyGrailWarSession,
  attackerId: string,
  suspectQuery: string,
  channelName?: string
): WarActionResult {
  const targetWar = war || globalWarSession;
  if (!targetWar) {
    return { success: false, message: 'Holy Grail War is not active!', updatedWar: war };
  }

  const attacker = targetWar.participants[attackerId];
  if (!attacker || !attacker.isAlive) {
    return { success: false, message: 'You are not active in the Holy Grail War!', updatedWar: targetWar };
  }

  const chanTag = channelName 
    ? (channelName.startsWith('#') ? channelName : `#${channelName}`)
    : '#general';

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

  const targetMaster = findTargetMaster(targetWar, suspectQuery);

  if (targetMaster && targetMaster.discordId === attacker.discordId) {
    return { success: false, message: 'You cannot target yourself with an ambush!', updatedWar: targetWar };
  }

  // B. Target's ambushed cooldown (3 minutes)
  if (targetMaster && targetMaster.isAlive && targetMaster.lastAmbushedTime && now - targetMaster.lastAmbushedTime < 180000) {
    const remainingSecs = Math.ceil((180000 - (now - targetMaster.lastAmbushedTime)) / 1000);
    return {
      success: false,
      message: `🚨 **Alert Protocol Active:** **${targetMaster.isExposed ? targetMaster.username : 'Target Master'}** has recently clashed and is on high alert! Wait **${remainingSecs}s** before trying to ambush them.`,
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

    const targetIdx = Object.values(targetWar.participants).indexOf(targetMaster) + 1;
    const targetLabel = targetMaster.isExposed ? `Master **${targetMaster.username}**` : `Shadow Master #${targetIdx}`;
    const defenderClass = targetMaster.servantClass || 'Saber';

    // 1. PRESENCE CONCEALMENT: ASSASSIN PASSIVE (Exposes attacker!)
    if (defenderClass === 'Assassin') {
      attacker.isExposed = true;
      attacker.exposureReason = 'ambush_clash';
      targetMaster.isExposed = true;
      targetMaster.exposureReason = 'ambush_clash';

      const pcDamage = 2500;
      attacker.currentHp = Math.max(0, attacker.currentHp - pcDamage);
      
      let failMsg = `🕶️ **PRESENCE CONCEALMENT DETECTION IN ${chanTag}!**\n` +
        `An ambush on ${targetLabel} in **${chanTag}** failed completely because their Servant is an **Assassin**!\n\n` +
        `• The Assassin detected the intrusion, nullifying the surprise strike.\n` +
        `• The Assassin counter-struck from the shadows, dealing **${pcDamage.toLocaleString()} DMG** to Master **${attacker.username}**'s Servant (**${attacker.servantName}**)! (HP: ${attacker.currentHp}/${attacker.maxHp})\n` +
        `• Master **${attacker.username}**'s identity is now **EXPOSED** to the server!\n\n` +
        `⛪ **Fuyuki Church Overseer Gas Leak Bulletin:**\n> *"The Fuyuki Church reports a sudden high-pressure 'gas leak explosion' in **${chanTag}** following abnormal seismic signatures. Citizens advised to stay indoors."*`;

      if (attacker.currentHp <= 0) {
        attacker.isAlive = false;
        failMsg += `\n☠️ **FATAL CONSEQUENCE:** Master **${attacker.username}** was slain by the Assassin they tried to ambush!`;
      }

      targetWar.eventLogs.unshift({
        id: `evt_ambush_fail_${Date.now()}`,
        timestamp: now,
        text: `🕶️ Assassin Counter in ${chanTag}: Master **${attacker.username}**'s ambush on ${targetLabel} failed! Took ${pcDamage} counter damage and was exposed!`,
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
    let attackerWasExposedByWard = false;

    // 2. BOUNDED FIELD / WORKSHOP WARDS
    const wardType = targetMaster.boundedField || 'none';
    if (wardType === 'ward') {
      // Absorbs 60% of damage
      const absorbed = Math.round(ambushDamage * 0.6);
      ambushDamage = ambushDamage - absorbed;
      defenseText += `🛡️ **Mage's Sanctuary Bounded Field** absorbed 60% of the strike (parried **${absorbed.toLocaleString()} DMG**).\n`;
    } else if (wardType === 'alarm') {
      // Alerts, exposes attacker, and strikes back for 3000 counter-damage
      attacker.isExposed = true;
      attacker.exposureReason = 'ambush_clash';
      attackerWasExposedByWard = true;

      const counterDmg = 3000;
      attacker.currentHp = Math.max(0, attacker.currentHp - counterDmg);
      defenseText += `🚨 **Alarm Ward Triggered!** Intrusion alarm detected the infiltrator! Exposed Master **${attacker.username}** and dealt **${counterDmg.toLocaleString()} DMG** back to Servant **${attacker.servantName}**! (HP: ${attacker.currentHp}/${attacker.maxHp})\n`;
      
      if (attacker.currentHp <= 0) {
        attacker.isAlive = false;
      }
    }

    // 3. INSTINCT / CLAIRVOYANCE (Saber, Archer, Lancer) PASSIVE (35% chance to parry 80%)
    const hasInstinct = ['Saber', 'Archer', 'Lancer'].includes(defenderClass);
    if (hasInstinct && Math.random() < 0.35) {
      const parried = Math.round(ambushDamage * 0.8);
      ambushDamage = ambushDamage - parried;
      defenseText += `👁️ **Instinct/Clairvoyance Alert:** Servant **${targetMaster.servantName}** sensed the threat! Parried 80% of damage (saved **${parried.toLocaleString()} DMG**) and counter-struck for **1,500 DMG**!\n`;
      
      // Deal counter dmg
      attacker.currentHp = Math.max(0, attacker.currentHp - 1500);
      if (attacker.currentHp <= 0) {
        attacker.isAlive = false;
      }
    }

    // Target becomes exposed due to taking a direct ambush
    targetMaster.isExposed = true;
    targetMaster.exposureReason = 'ambush_clash';

    // Apply final damage to target
    targetMaster.currentHp = Math.max(0, targetMaster.currentHp - ambushDamage);

    const attackerLabel = attacker.isExposed ? `Master **${attacker.username}**` : 'A Shadow Master';

    let mainMessage = `🚨 **FUYUKI AIR RAID SIREN — AMBUSH IN ${chanTag}!**\n\n` +
      `${attackerLabel} launched a surprise assault on ${targetLabel} in **${chanTag}**!\n\n` +
      `• **Final Ambush Result:** **${targetMaster.username}**'s Servant (**${targetMaster.servantName}**) took **${ambushDamage.toLocaleString()} DMG**! (HP: ${targetMaster.currentHp}/${targetMaster.maxHp})\n` +
      (defenseText ? `• **Defensive Countermeasures:**\n${defenseText}` : '') +
      `\n⛪ **Fuyuki Church Overseer Gas Leak Bulletin:**\n> *"The Fuyuki Church and municipal police report a severe structural **'gas leak explosion'** in **${chanTag}** following abnormal seismic and thermal readings. Residents advised to stay indoors."*`;

    let eliminatedId: string | undefined;

    // 4. COMMAND SEAL EMERGENCY EVACUATION
    if (targetMaster.currentHp <= 0 && targetMaster.autoEvadeEnabled !== false && targetMaster.commandSeals >= 1) {
      targetMaster.commandSeals--;
      targetMaster.currentHp = 1;
      targetMaster.isAlive = true;
      targetMaster.isExposed = false; // Vanish back into the shadows
      
      mainMessage += `\n\n🔴 **EMERGENCY COMMAND SEAL EVACUATION!**\n` +
        `As **${targetMaster.username}** faced fatal damage in **${chanTag}**, their Command Seal flared: *“By my Command Seal... Spatial Evacuation!”*\n` +
        `• Consumed **1 Command Seal** (Remaining: **${targetMaster.commandSeals}/3**).\n` +
        `• Nullified death-blow! **${targetMaster.username}** escaped into deep shadows with **1 HP**!`;

      targetWar.eventLogs.unshift({
        id: `evt_evac_${Date.now()}`,
        timestamp: now,
        text: `🔴 Emergency Evacuation in ${chanTag}: **${targetMaster.username}** consumed 1 Command Seal to escape fatal ambush by ${attackerLabel}!`,
        type: 'ambush'
      });
    }
    // 5. BATTLE CONTINUATION PASSIVE
    else if (targetMaster.currentHp <= 0 && ['Berserker', 'Lancer'].includes(defenderClass) && !targetMaster.gutsTriggered) {
      targetMaster.gutsTriggered = true;
      targetMaster.currentHp = Math.round(targetMaster.maxHp * 0.25);
      targetMaster.isAlive = true;
      
      mainMessage += `\n\n❤️ **BATTLE CONTINUATION (GUTS)!**\n` +
        `**${targetMaster.username}**'s Servant (**${targetMaster.servantName}**) took a lethal blow in **${chanTag}**, but their indomitable class spirit activated **Battle Continuation**!\n` +
        `• Clung to life, reviving instantly with **25% HP** (**${targetMaster.currentHp.toLocaleString()} HP**)!`;

      targetWar.eventLogs.unshift({
        id: `evt_guts_${Date.now()}`,
        timestamp: now,
        text: `❤️ Battle Continuation in ${chanTag}: **${targetMaster.username}**'s ${targetMaster.servantName} revived with 25% HP during ambush!`,
        type: 'ambush'
      });
    }
    // 6. ACTUAL DEATH / ELIMINATION
    else if (targetMaster.currentHp <= 0) {
      targetMaster.isAlive = false;
      attacker.kills++;
      eliminatedId = targetMaster.discordId;
      
      mainMessage += `\n\n☠️ **FATAL AMBUSH IN ${chanTag}:** Master **${targetMaster.username}**'s Servant took a fatal strike and was permanently ELIMINATED from the active Holy Grail War!`;

      targetWar.eventLogs.unshift({
        id: `evt_elim_${Date.now()}`,
        timestamp: now,
        text: `☠️ Fatal Ambush in ${chanTag}: ${attackerLabel} ambushed and ELIMINATED Master **${targetMaster.username}**!`,
        type: 'elimination'
      });
    } else {
      // Normal non-lethal ambush log
      targetWar.eventLogs.unshift({
        id: `evt_ambush_${Date.now()}`,
        timestamp: now,
        text: `⚔️ Ambush in ${chanTag}: ${attackerLabel} ambushed **${targetMaster.username}** for ${ambushDamage.toLocaleString()} DMG!`,
        type: 'ambush'
      });
    }

    // Evaluate war state and check if Greater Grail can manifest
    evaluateWarState(targetWar);

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

  const casualtyText = `☠️ **COLLATERAL CASUALTY: CIVILIAN SLAIN IN ${chanTag}!**\n\n` +
    `Master **${attacker.username}**'s Servant (${attacker.servantName}) struck down innocent server bystander **${bystanderName}** in **${chanTag}**!\n` +
    `• The victim was killed instantly in the magical crossfire.\n` +
    `• Master **${attacker.username}**'s identity is now **VIOLENTLY EXPOSED** to the server for breaching the Secrecy of Magecraft!\n\n` +
    `⛪ **Fuyuki Church Overseer Gas Leak Bulletin:**\n` +
    `> *"The Fuyuki Church and municipal police report a severe structural **'gas leak explosion'** in **${chanTag}** involving civilian ${bystanderName}. Cause classified as faulty underground utility piping. Public is advised to stay indoors."*`;

  targetWar.eventLogs.unshift({
    id: `evt_casualty_${Date.now()}`,
    timestamp: now,
    text: `☠️ Church Cover-Up: "Gas leak explosion" reported in ${chanTag} involving bystander **${bystanderName}** (caused by **${attacker.username}**)!`,
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

/**
 * Leak intelligence onto the status board.
 * Works for both contracted Masters and civilian bystanders!
 */
export function leakIntelInWar(
  war: HolyGrailWarSession,
  leakerDiscordId: string,
  intelText: string,
  targetToExposeQuery?: string,
  channelName?: string
): WarActionResult {
  const targetWar = war || globalWarSession;
  if (!targetWar) {
    return { success: false, message: 'Holy Grail War is not active!', updatedWar: war };
  }

  const chanTag = channelName 
    ? (channelName.startsWith('#') ? channelName : `#${channelName}`)
    : '#general';

  if (!targetWar.leakedIntel) targetWar.leakedIntel = [];
  if (!targetWar.eventLogs) targetWar.eventLogs = [];

  const leaker = targetWar.participants[leakerDiscordId];
  const leakerName = leaker?.username || 'Civilian Informant';

  let exposedMaster: WarMasterParticipant | undefined;

  if (targetToExposeQuery && targetToExposeQuery.trim()) {
    exposedMaster = findTargetMaster(targetWar, targetToExposeQuery);
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
    ? `🕵️ INTEL LEAK in ${chanTag}: An anonymous leak verified that **${exposedMaster.username}** is contracted to **${exposedMaster.servantName}** (${exposedMaster.servantClass})! Leaked Dispatch: "${intelText}"`
    : `🕵️ INTEL LEAK in ${chanTag}: A clandestine report was broadcasted onto the Info Board: "${intelText}"`;

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

/**
 * Scout / Patrol a channel sector in Fuyuki.
 * Civilians gather investigation rumors and overheared mana signatures.
 * Masters detect rival signatures, bystander counts, or Bounded Field resonance.
 */
export function patrolCityInWar(
  war: HolyGrailWarSession,
  actorDiscordId: string,
  actorUsername: string,
  channelName?: string
): WarActionResult {
  const targetWar = war || globalWarSession;
  if (!targetWar) {
    return { success: false, message: 'Holy Grail War is not active.', updatedWar: war };
  }

  const chanTag = channelName 
    ? (channelName.startsWith('#') ? channelName : `#${channelName}`)
    : '#general';

  const actorParticipant = targetWar.participants[actorDiscordId];

  if (!actorParticipant || !actorParticipant.isAlive) {
    // CIVILIAN PATROL / INVESTIGATION
    const civilianReports = [
      `👁️ **Civilian Patrol in ${chanTag}:** While investigating **${chanTag}**, you noticed strange glowing runes etched into an alley wall and overheard chanting! You gathered a tip-off: *"Faint Arts/Buster mana signature detected near ${chanTag}."* Use \`/grailwar leak\` or \`/leak\` to broadcast this rumor!`,
      `👁️ **Civilian Patrol in ${chanTag}:** You surveyed **${chanTag}**. Citizens are walking by oblivious, but you detected a brief temperature drop and subtle magical static. A Servant was likely here recently!`,
      `👁️ **Civilian Patrol in ${chanTag}:** You caught a glimpse of two shadowy figures leaping across rooftops in **${chanTag}** before vanishing into the night. You remained hidden in the crowd and escaped unnoticed!`,
      `👁️ **Civilian Patrol in ${chanTag}:** **${chanTag}** appears calm tonight. No active Master confrontations or Servant clashes observed in this sector.`
    ];
    const report = civilianReports[Math.floor(Math.random() * civilianReports.length)];

    targetWar.eventLogs.unshift({
      id: `evt_patrol_${Date.now()}`,
      timestamp: Date.now(),
      text: `👁️ Civilian Investigation in ${chanTag}: An innocent bystander conducted a clandestine patrol of the sector.`,
      type: 'intel_leak'
    });

    return {
      success: true,
      message: report,
      updatedWar: targetWar
    };
  }

  // MASTER SCOUT PATROL
  const aliveRivals = Object.values(targetWar.participants).filter(p => p.discordId !== actorDiscordId && p.isAlive);
  let masterReport = '';

  if (aliveRivals.length > 0 && Math.random() < 0.65) {
    const rival = aliveRivals[Math.floor(Math.random() * aliveRivals.length)];
    const rivalIndex = Object.values(targetWar.participants).indexOf(rival) + 1;
    const rivalLabel = rival.isExposed ? `Master **${rival.username}**` : `Shadow Master #${rivalIndex}`;
    const servantLabel = rival.isExposed ? `**${rival.servantName}** (${rival.servantClass})` : `**${rival.servantClass} Class**`;

    masterReport = `👁️ **Master Scout Patrol in ${chanTag}:** Your Servant (**${actorParticipant.servantName}**) surveyed **${chanTag}** and picked up the mana trail of ${rivalLabel} (${servantLabel}, ~${rival.currentHp.toLocaleString()} HP)! They are lurking near this channel.`;
  } else {
    const masterReports = [
      `👁️ **Master Scout Patrol in ${chanTag}:** Your Servant surveyed **${chanTag}** and spotted 2 civilian bystanders lingering nearby. Exercise caution if ambushing here to avoid collateral casualties and Secrecy exposure!`,
      `👁️ **Master Scout Patrol in ${chanTag}:** Your Servant detected faint Bounded Field resonance in **${chanTag}**. A rival Master in this sector may have set Sanctuary or Alarm wards!`,
      `👁️ **Master Scout Patrol in ${chanTag}:** Your Servant combed **${chanTag}** from the shadows. The area is currently clear of rival Servant signatures.`
    ];
    masterReport = masterReports[Math.floor(Math.random() * masterReports.length)];
  }

  targetWar.eventLogs.unshift({
    id: `evt_patrol_${Date.now()}`,
    timestamp: Date.now(),
    text: `👁️ Patrol in ${chanTag}: A Master surveyed ${chanTag} for rival signatures and civilian activity.`,
    type: 'intel_leak'
  });

  return {
    success: true,
    message: masterReport,
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

  if (action === 'patrol_city') {
    return patrolCityInWar(targetWar, actorDiscordId, actor.username, targetParam);
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

export function simulateWarSkirmish(war: HolyGrailWarSession, channelName?: string): WarActionResult {
  const targetWar = war || globalWarSession;
  if (!targetWar) {
    return { success: false, message: 'Holy Grail War is not active.', updatedWar: war };
  }

  const defaultChannels = ['#general', '#bot-commands', '#lounge', '#fuyuki-crossroads', '#rooftop'];
  const chanTag = channelName 
    ? (channelName.startsWith('#') ? channelName : `#${channelName}`)
    : defaultChannels[Math.floor(Math.random() * defaultChannels.length)];

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

  let clashText = `⚔️ SKIRMISH in ${chanTag}: ${name1} clashed in the shadows with ${name2} (${damage.toLocaleString()} DMG)!`;

  if (ai2.currentHp <= 0) {
    ai2.isAlive = false;
    ai2.isExposed = true;
    ai1.kills++;
    clashText = `☠️ ELIMINATION in ${chanTag}: ${name1} struck a fatal blow and eliminated Master **${ai2.username}** (${ai2.servantName})! [Church Bulletin: Severe 'gas main rupture' in ${chanTag}]`;
  }

  targetWar.eventLogs.unshift({
    id: `evt_skirmish_${Date.now()}`,
    timestamp: Date.now(),
    text: clashText,
    type: ai2.currentHp <= 0 ? 'elimination' : 'clash'
  });

  evaluateWarState(targetWar);

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
  decision: 'kill' | 'spare',
  channelName?: string
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

  const chanTag = channelName 
    ? (channelName.startsWith('#') ? channelName : `#${channelName}`)
    : '#general';

  const victor = findTargetMaster(targetWar, winnerQuery) || Object.values(targetWar.participants)[0];
  let defeated = findTargetMaster(targetWar, loserQuery);

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

    const deadCount = Object.values(targetWar.participants).filter(p => !p.isAlive).length;
    const totalSummoned = Object.keys(targetWar.participants).length;

    outcomeLog = `☠️ FATAL EXECUTION in ${chanTag}: Master **${victor.username}** (${victor.servantName}) dealt the finishing blow and EXECUTED Master **${defeated.username}** (${defeated.servantName})!\n⚱️ The Lesser Grail absorbed a Spiritual Core (${deadCount}/6 absorbed).`;

    targetWar.eventLogs.unshift({
      id: `evt_exec_${Date.now()}`,
      timestamp: Date.now(),
      text: outcomeLog,
      type: 'elimination'
    });

    evaluateWarState(targetWar);
  } else {
    // Spared: left on critical HP (10% max HP)
    defeated.isAlive = true;
    defeated.currentHp = Math.max(1, Math.round(defeated.maxHp * 0.1));
    isEliminated = false;

    outcomeLog = `🕊️ MERCY BESTOWED in ${chanTag}: Master **${victor.username}** (${victor.servantName}) defeated Master **${defeated.username}** (${defeated.servantName}) in a duel, but chose to SPARE their life! **${defeated.username}** survives with critical HP. Both identities are now exposed.`;

    targetWar.eventLogs.unshift({
      id: `evt_mercy_${Date.now()}`,
      timestamp: Date.now(),
      text: outcomeLog,
      type: 'heal'
    });

    evaluateWarState(targetWar);
  }

  return {
    updatedWar: targetWar,
    message: outcomeLog,
    eliminated: isEliminated,
    victorMaster: victor,
    defeatedMaster: defeated
  };
}
