import {
  HolyGrailWarSession,
  WarMasterParticipant,
  WarAlliance,
  MasterProfile,
  ChannelBoundedTrap,
  ActiveFamiliar,
  WarRules,
  WarHistoryRecord
} from '../types';
import { SERVANT_DATABASE } from '../data/servants';
import fs from 'fs';
import path from 'path';

// =========================================================================
// WAR PRESETS & RITUAL CONFIGURATIONS
// =========================================================================
export const WAR_PRESETS: Record<string, WarRules> = {
  fuyuki_7: {
    preset: 'fuyuki_7',
    formatName: '5th Fuyuki Holy Grail War (7 Masters)',
    maxMasters: 7,
    servantPool: 'canon_only',
    classExclusivity: true,
    permadeath: true,
    startingCommandSeals: 3,
    autoEvacuateAllowed: true,
    leylineDensity: 'standard',
    churchAsylum: true,
    trapLimitPerMaster: 3,
    factionMode: false
  },
  apocrypha_14: {
    preset: 'apocrypha_14',
    formatName: 'Great Holy Grail War (14 Masters, Black vs Red)',
    maxMasters: 14,
    servantPool: 'all',
    classExclusivity: false,
    permadeath: true,
    startingCommandSeals: 3,
    autoEvacuateAllowed: true,
    leylineDensity: 'standard',
    churchAsylum: true,
    trapLimitPerMaster: 3,
    factionMode: true,
    factions: { red: [], black: [], ruler: [] }
  },
  singularity_chaos: {
    preset: 'singularity_chaos',
    formatName: 'Grand Singularity Chaos (30 Masters FFA)',
    maxMasters: 30,
    servantPool: 'all',
    classExclusivity: false,
    permadeath: false,
    startingCommandSeals: 5,
    autoEvacuateAllowed: true,
    leylineDensity: 'fast',
    churchAsylum: true,
    trapLimitPerMaster: 5,
    factionMode: false
  },
  desolate_hardcore: {
    preset: 'desolate_hardcore',
    formatName: 'Desolate Hardcore Ritual (7 Masters, 1 Seal, Permadeath)',
    maxMasters: 7,
    servantPool: 'canon_only',
    classExclusivity: true,
    permadeath: true,
    startingCommandSeals: 1,
    autoEvacuateAllowed: false,
    leylineDensity: 'desolate',
    churchAsylum: false,
    trapLimitPerMaster: 1,
    factionMode: false
  }
};

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
        const session = JSON.parse(raw);
        return synchronizeWarParticipants(session);
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

/**
 * Ensures all participants in the active Holy Grail War are synchronized to canonical Servant stats and balanced HP pools.
 */
export function synchronizeWarParticipants(war: HolyGrailWarSession): HolyGrailWarSession {
  if (!war || !war.participants) return war;

  let modified = false;
  for (const p of Object.values(war.participants)) {
    // If maxHp is already set, don't overwrite it to prevent resetting level/CE stats!
    if (p.maxHp && p.maxHp > 0) continue;

    const canonical = SERVANT_DATABASE.find(
      s => s.id === p.servantId ||
           (s.name && p.servantName && s.name.toLowerCase() === p.servantName.toLowerCase()) ||
           (s.name && p.servantName && s.name.toLowerCase().includes(p.servantName.toLowerCase())) ||
           (s.name && p.servantName && p.servantName.toLowerCase().includes(s.name.toLowerCase()))
    );

    const baseHp = canonical?.baseHp || 28000;
    const endurance = canonical?.baseStats?.endurance || 10;
    const computedMax = Math.round(baseHp + endurance * 150 + 500);

    if (computedMax > 0 && p.maxHp !== computedMax) {
      const oldMax = p.maxHp || 1;
      const oldHp = p.currentHp;
      p.maxHp = computedMax;
      if (p.isAlive) {
        if (oldHp === undefined) {
          p.currentHp = computedMax;
        } else if (oldHp >= oldMax) {
          p.currentHp = computedMax;
        } else {
          p.currentHp = Math.min(computedMax, Math.max(1, Math.round((oldHp / oldMax) * computedMax)));
        }
      } else {
        p.currentHp = 0;
      }
      if (p.baseHpAtDamage !== undefined) {
        p.baseHpAtDamage = p.currentHp;
      }
      modified = true;
    }
  }

  return war;
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
  const maxHp = calculateServantMaxHp(servantInstance);

  const existing = war.participants[master.discordId];
  const isNewEntry = !existing;

  if (existing) {
    existing.servantId = servantInstance.id || 'servant_contract';
    existing.servantName = servantName;
    existing.servantClass = servantClass;
    existing.avatarUrl = avatarUrl;
    existing.username = master.username;
    existing.maxHp = maxHp;
    if (existing.currentHp <= 0 && existing.isAlive) {
      existing.currentHp = maxHp;
    } else {
      existing.currentHp = Math.min(maxHp, existing.currentHp);
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
      autoEvadeEnabled: false,
      autoConsumeCommandSeal: false,
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
    synchronizeWarParticipants(globalWarSession);
    return globalWarSession;
  }

  // Always keep all participants synchronized
  synchronizeWarParticipants(globalWarSession);

  const activeServant =
    master.servants.find((s: any) => s.id === master.activeServantId) || master.servants[0];

  const sAny = activeServant as any;
  const sTemplate = sAny?.template || sAny;
  const servantName = sAny?.nickname || sTemplate?.name || sAny?.name || 'Heroic Spirit';
  const servantClass = sTemplate?.servantClass || sAny?.servantClass || sAny?.class || 'Saber';
  const avatarUrl = sTemplate?.avatarUrl || sAny?.avatarUrl || '';
  const maxHp = calculateServantMaxHp(activeServant);

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
      const computedMax = calculateServantMaxHp(activeServant);
      if (existing.maxHp !== computedMax) {
        const hpRatio = existing.maxHp > 0 ? (existing.currentHp / existing.maxHp) : 1;
        existing.maxHp = computedMax;
        existing.currentHp = Math.min(computedMax, Math.round(hpRatio * computedMax));
        if (existing.baseHpAtDamage !== undefined) {
          existing.baseHpAtDamage = Math.min(computedMax, existing.baseHpAtDamage);
        }
      }
    }

    // Refresh real-time passive leyline healing
    Object.values(globalWarSession.participants).forEach(p => {
      calculateCurrentHp(p);
    });

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
  | 'rest_and_heal'
  | 'heal_ritual'
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
  wasAlreadyExposed?: boolean;
  exposedTargetMaster?: string;
  updatedWar: HolyGrailWarSession;
}

/**
 * Calculates a Servant's true Max HP scaled with Level, allocated Endurance, and equipped Craft Essence.
 */
export function calculateServantMaxHp(servantInstance: any): number {
  if (!servantInstance) return 30000;
  const sAny = servantInstance as any;
  const templateId = sAny.templateId || sAny.template?.id || sAny.id;
  const canonical = SERVANT_DATABASE.find(
    s => s.id === templateId ||
         (s.name && sAny.name && s.name.toLowerCase() === sAny.name.toLowerCase()) ||
         (s.name && sAny.template?.name && s.name.toLowerCase() === sAny.template.name.toLowerCase())
  ) || sAny.template || sAny;
  
  const isCustom = sAny.template?.isCustomOrMeme || canonical?.isCustomOrMeme;
  const sTemplate = isCustom 
    ? { ...canonical, ...sAny.template } 
    : { ...(canonical || sAny.template || sAny) };

  const base = canonical?.baseStats || sTemplate?.baseStats || { strength: 10, endurance: 10, agility: 10, mana: 10, luck: 10 };
  const totalEnd = (base.endurance || 10) + (sAny?.allocatedStats?.endurance || 0);
  const ce = sAny?.equippedCe;
  const ceHp = ce ? (ce.hpBonus || 0) : 0;
  const lvl = sAny?.level || 1;
  const baseHp = canonical?.baseHp || sTemplate?.baseHp || 28000;
  return Math.round(baseHp + totalEnd * 150 + ceHp);
}

/**
 * Calculates a participant's real-time HP based on passive leyline regeneration.
 * Full HP recovery cycle takes 5 minutes (300,000 ms).
 * NOTE: Auto-regeneration ONLY occurs when the Master has an active Mage Sanctuary ('ward').
 * All other auto-regen is disabled per Holy Grail War rules; Mage Sanctuary is the sole auto-heal method.
 */
export function calculateCurrentHp(participant: WarMasterParticipant, now: number = Date.now()): number {
  if (!participant) return 0;
  if (!participant.isAlive) {
    participant.currentHp = 0;
    return 0;
  }
  const maxHp = participant.maxHp || 30000;
  if (participant.currentHp >= maxHp) {
    participant.currentHp = maxHp;
    return maxHp;
  }

  // Auto-regeneration ONLY channels mana if an active Mage Sanctuary ('ward') is established and NOT in combat!
  const hasMageSanctuary = participant.boundedField === 'ward';
  if (!hasMageSanctuary || (participant as any).inCombat) {
    return participant.currentHp;
  }

  if (!participant.lastDamageTime) {
    return participant.currentHp;
  }

  const elapsed = Math.max(0, now - participant.lastDamageTime);
  const REGEN_DURATION = 300000; // 5 minutes in ms (300s)

  if (elapsed >= REGEN_DURATION) {
    participant.currentHp = maxHp;
    participant.baseHpAtDamage = maxHp;
    return maxHp;
  }

  // Ensure baseHp never exceeds currentHp if currentHp was lowered by recent damage
  const baseHp = participant.baseHpAtDamage !== undefined
    ? Math.min(participant.currentHp, participant.baseHpAtDamage)
    : participant.currentHp;

  const missingHp = Math.max(0, maxHp - baseHp);
  const progress = elapsed / REGEN_DURATION;
  const healed = Math.round(missingHp * progress);
  const calculatedHp = Math.min(maxHp, Math.max(participant.currentHp, baseHp + healed));
  participant.currentHp = calculatedHp;
  return calculatedHp;
}

/**
 * Returns comprehensive healing & spiritual core reconstitution status for UI display.
 */
export function getHealingStatus(participant: WarMasterParticipant, now: number = Date.now()): {
  currentHp: number;
  maxHp: number;
  percent: number;
  isFullyHealed: boolean;
  remainingSecs: number;
  statusTag: string;
  canRitualHeal: boolean;
  ritualCooldownSecs: number;
} {
  const maxHp = participant?.maxHp || 15000;
  if (!participant || !participant.isAlive) {
    return {
      currentHp: 0,
      maxHp,
      percent: 0,
      isFullyHealed: false,
      remainingSecs: 0,
      statusTag: '💀 Deceased',
      canRitualHeal: false,
      ritualCooldownSecs: 0
    };
  }

  const currentHp = calculateCurrentHp(participant, now);
  const percent = Math.min(100, Math.max(0, Math.round((currentHp / maxHp) * 100)));
  const isFullyHealed = currentHp >= maxHp;
  const hasMageSanctuary = participant.boundedField === 'ward';

  let remainingSecs = 0;
  if (!isFullyHealed && participant.lastDamageTime && hasMageSanctuary) {
    const elapsed = Math.max(0, now - participant.lastDamageTime);
    remainingSecs = Math.max(0, Math.ceil((300000 - elapsed) / 1000));
  }

  const RITUAL_COOLDOWN = 300000; // 5 minutes
  let ritualCooldownSecs = 0;
  if (participant.lastHealRitualTime && now - participant.lastHealRitualTime < RITUAL_COOLDOWN) {
    ritualCooldownSecs = Math.ceil((RITUAL_COOLDOWN - (now - participant.lastHealRitualTime)) / 1000);
  }

  const canRitualHeal = ritualCooldownSecs === 0 && !isFullyHealed;

  let statusTag = '🟢 Full Health';
  if (!isFullyHealed) {
    if (hasMageSanctuary) {
      const mins = Math.floor(remainingSecs / 60);
      const secs = remainingSecs % 60;
      const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      const chanInfo = (participant as any).sanctuaryChannelName ? ` in ${(participant as any).sanctuaryChannelName}` : '';
      statusTag = `🛡️ Mage Sanctuary Regen${chanInfo} (${timeStr} to full)`;
    } else {
      statusTag = '⚠️ Wounded (Auto-regen inactive — Mage Sanctuary is the only auto-heal method; deploy via /trap or cast /heal)';
    }
  }

  return {
    currentHp,
    maxHp,
    percent,
    isFullyHealed,
    remainingSecs,
    statusTag,
    canRitualHeal,
    ritualCooldownSecs
  };
}

/**
 * Applies damage to a participant, storing the base HP at time of injury and setting the 5-minute passive recovery timer.
 */
export function applyDamageToParticipant(
  participant: WarMasterParticipant,
  damageAmount: number,
  now: number = Date.now()
): void {
  calculateCurrentHp(participant, now);
  participant.currentHp = Math.max(0, participant.currentHp - damageAmount);
  participant.baseHpAtDamage = participant.currentHp;
  participant.lastDamageTime = now;
}

/**
 * Performs a Workshop Leyline Healing Ritual for a Master (+40% HP, 5-minute cooldown).
 */
export function executeHealRitual(
  war: HolyGrailWarSession,
  masterId: string
): { success: boolean; message: string; updatedWar: HolyGrailWarSession } {
  const targetWar = war || globalWarSession;
  if (!targetWar) {
    return { success: false, message: 'Holy Grail War is not active!', updatedWar: war };
  }

  const actor = targetWar.participants[masterId];
  if (!actor || !actor.isAlive) {
    return { success: false, message: 'You are eliminated from the Holy Grail War!', updatedWar: targetWar };
  }

  const now = Date.now();
  calculateCurrentHp(actor, now);

  if (actor.currentHp >= actor.maxHp) {
    return {
      success: false,
      message: `✨ **Spiritual Core Pristine:** Your Servant (**${actor.servantName}**) is already at **100% Full Health** (${actor.maxHp.toLocaleString()}/${actor.maxHp.toLocaleString()})! No healing required.`,
      updatedWar: targetWar
    };
  }

  const RITUAL_COOLDOWN = 300000; // 5 minutes
  if (actor.lastHealRitualTime && now - actor.lastHealRitualTime < RITUAL_COOLDOWN) {
    const rem = Math.ceil((RITUAL_COOLDOWN - (now - actor.lastHealRitualTime)) / 1000);
    const mins = Math.floor(rem / 60);
    const secs = rem % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    const healStat = getHealingStatus(actor, now);
    return {
      success: false,
      message: `⏳ **Magical Circuit Exhaustion:** Your workshop leylines need time to reconstitute after your last ritual!\n\n` +
        `• Next Healing Ritual available in **${timeStr}**.\n` +
        `• Passive Leyline Regeneration is active: currently at **${healStat.currentHp.toLocaleString()}/${healStat.maxHp.toLocaleString()} HP** (${healStat.statusTag}).`,
      updatedWar: targetWar
    };
  }

  // Restore 40% Max HP
  const healAmount = Math.round(actor.maxHp * 0.40);
  actor.currentHp = Math.min(actor.maxHp, actor.currentHp + healAmount);
  actor.baseHpAtDamage = actor.currentHp;
  actor.lastDamageTime = now;
  actor.lastHealRitualTime = now;

  const isFull = actor.currentHp >= actor.maxHp;
  const statusInfo = getHealingStatus(actor, now);

  const msg = `✨ **WORKSHOP LEYLINE HEALING RITUAL COMPLETE!**\n\n` +
    `Master **${actor.username}** channeled their magical crest into **${actor.servantName}**'s spiritual core!\n` +
    `• Restored **+${healAmount.toLocaleString()} HP**! (Current HP: **${actor.currentHp.toLocaleString()}/${actor.maxHp.toLocaleString()}** — ${statusInfo.percent}%)\n` +
    (isFull ? `• 🟢 **Servant's spiritual core is fully restored!**\n` : `• ⏳ **Remaining passive recovery:** ${statusInfo.statusTag}.\n`) +
    `• ⏳ Next active Healing Ritual ready in **5 minutes** (or use a Command Seal for emergency recovery).`;

  targetWar.eventLogs.unshift({
    id: `evt_heal_${Date.now()}`,
    timestamp: now,
    text: `✨ Mana Reconstitution: Master **${actor.username}** channeled workshop leylines to heal Servant **${actor.servantName}** (+${healAmount.toLocaleString()} HP).`,
    type: 'heal'
  });

  saveWarToDisk();

  return {
    success: true,
    message: msg,
    updatedWar: targetWar
  };
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

  let attacker: WarMasterParticipant | undefined = targetWar.participants[attackerId];
  if (!attacker) {
    attacker = Object.values(targetWar.participants).find(
      p => p.discordId === attackerId || p.username.toLowerCase() === attackerId.toLowerCase()
    );
  }
  if (!attacker || !attacker.isAlive) {
    return { success: false, message: 'You are not active in the Holy Grail War! Summon a Servant first using `/summon ritual`.', updatedWar: targetWar };
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

  if (attacker.inSanctuary || (attacker as any).inChurchSanctuary) {
    return {
      success: false,
      message: `⛪ **Fuyuki Church Truce:** You are currently seeking sanctuary at the Fuyuki Church under Father Kotomine's protection! You cannot launch ambushes while under church asylum. (Use \`/church leave\` to return to the Holy Grail War).`,
      updatedWar: targetWar
    };
  }

  const targetMaster = findTargetMaster(targetWar, suspectQuery);

  if (targetMaster && targetMaster.discordId === attacker.discordId) {
    return { success: false, message: 'You cannot target yourself with an ambush!', updatedWar: targetWar };
  }

  if (targetMaster && (targetMaster.inSanctuary || (targetMaster as any).inChurchSanctuary)) {
    return {
      success: false,
      message: `⛪ **Fuyuki Church Sanctuary:** **${targetMaster.isExposed ? targetMaster.username : 'Target Master'}** is currently residing under the neutral asylum of the Fuyuki Church Overseer! All assaults and ambushes are strictly forbidden on consecrated grounds.`,
      updatedWar: targetWar
    };
  }

  // B. Anti-Dogpiling & High Alert Protection
  // Target cannot be ambushed if:
  // 1. Within 5 minutes (300,000ms) of last ambush AND HP has not fully regenerated to 100%.
  if (targetMaster && targetMaster.isAlive && targetMaster.lastAmbushedTime) {
    const curTargetHp = calculateCurrentHp(targetMaster, now);
    const elapsedSinceAmbushed = now - targetMaster.lastAmbushedTime;
    const isTargetFullHp = curTargetHp >= targetMaster.maxHp;

    if (elapsedSinceAmbushed < 300000 && !isTargetFullHp) {
      const remainingSecs = Math.ceil((300000 - elapsedSinceAmbushed) / 1000);
      const mins = Math.floor(remainingSecs / 60);
      const secs = remainingSecs % 60;
      const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      return {
        success: false,
        message: `🚨 **Anti-Dogpiling High Alert Active:** **${targetMaster.isExposed ? targetMaster.username : 'Target Master'}** was recently attacked and their defensive wards are on maximum alert! Their workshop perimeter is fortified and deflecting all ambush attempts until their Spiritual Core reconstitutes to full HP (Immunity remaining: **${timeStr}**).`,
        updatedWar: targetWar
      };
    }
  }

  // ---------------------------------------------------------
  // CASE 1: TARGET IS A REAL MASTER IN THE WAR
  // ---------------------------------------------------------
  if (targetMaster && targetMaster.isAlive) {
    // Record action timers
    attacker.lastAmbushTime = now;
    targetMaster.lastAmbushedTime = now;
    // An aggressive action breaks attacker's own high alert defense turtle
    attacker.lastAmbushedTime = undefined;

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

    // 3. INSTINCT / CLAIRVOYANCE (Saber, Archer, Lancer) PASSIVE
    // Anti-Vulture: If defender is below 50% HP, parry rate doubles to 70% and parries 90% of damage!
    const targetHpBeforeStrike = calculateCurrentHp(targetMaster, now);
    const isWounded = targetHpBeforeStrike < (targetMaster.maxHp * 0.5);
    const hasInstinct = ['Saber', 'Archer', 'Lancer', 'Ruler', 'Shielder'].includes(defenderClass) || isWounded;
    const parryChance = isWounded ? 0.70 : 0.35;
    
    if (hasInstinct && Math.random() < parryChance) {
      const parryPercent = isWounded ? 0.90 : 0.80;
      const parried = Math.round(ambushDamage * parryPercent);
      ambushDamage = ambushDamage - parried;
      defenseText += `👁️ **${isWounded ? 'Crisis Instinct / Desperation Parry' : 'Instinct / Clairvoyance Alert'}:** Servant **${targetMaster.servantName}** sensed the lethal trajectory! Parried ${Math.round(parryPercent * 100)}% of damage (saved **${parried.toLocaleString()} DMG**) and counter-struck for **2,000 DMG**!\n`;
      
      // Deal counter dmg
      attacker.currentHp = Math.max(0, attacker.currentHp - 2000);
      if (attacker.currentHp <= 0) {
        attacker.isAlive = false;
      }
    }

    // 1.5 HOMUNCULUS DECOY FAMILIAR (Intercepts 100% ambush damage & preserves secrecy)
    let homunculusIntercepted = false;
    if (targetWar.familiars && targetWar.familiars.length > 0) {
      const homunculusIdx = targetWar.familiars.findIndex(
        f => f.masterId === targetMaster.discordId && f.familiarType === 'homunculus'
      );
      if (homunculusIdx !== -1) {
        targetWar.familiars.splice(homunculusIdx, 1);
        homunculusIntercepted = true;
        ambushDamage = 0;
        defenseText += `🗿 **Homunculus Decoy Interception:** A crafted homunculus decoy took the lethal ambush trajectory, shattering to dust and absorbing 100% of the attack (**0 DMG taken**)! Master **${targetMaster.username}** remained unharmed and concealed in the shadows!\n`;
      }
    }

    if (!homunculusIntercepted) {
      // Target becomes exposed due to taking a direct ambush
      targetMaster.isExposed = true;
      targetMaster.exposureReason = 'ambush_clash';
    }

    // Apply final damage to target
    targetMaster.currentHp = Math.max(0, targetMaster.currentHp - ambushDamage);

    const attackerLabel = attacker.isExposed ? `Master **${attacker.username}**` : 'A Shadow Master';

    let mainMessage = `🚨 **FUYUKI AIR RAID SIREN — AMBUSH IN ${chanTag}!**\n\n` +
      `${attackerLabel} launched a surprise assault on ${targetLabel} in **${chanTag}**!\n\n` +
      `• **Final Ambush Result:** **${targetMaster.username}**'s Servant (**${targetMaster.servantName}**) took **${ambushDamage.toLocaleString()} DMG**! (HP: ${targetMaster.currentHp}/${targetMaster.maxHp})\n` +
      (defenseText ? `• **Defensive Countermeasures:**\n${defenseText}` : '') +
      `\n⛪ **Fuyuki Church Overseer Gas Leak Bulletin:**\n> *"The Fuyuki Church and municipal police report a severe structural **'gas leak explosion'** in **${chanTag}** following abnormal seismic and thermal readings. Residents advised to stay indoors."*`;

    let eliminatedId: string | undefined;

    // 4. COMMAND SEAL EMERGENCY EVACUATION (Off by default: requires autoEvadeEnabled === true)
    if (targetMaster.currentHp <= 0 && targetMaster.autoEvadeEnabled === true && targetMaster.commandSeals >= 1) {
      targetMaster.commandSeals--;
      targetMaster.currentHp = 1;
      targetMaster.isAlive = true;
      // Note: User rule: "once exposed, remains exposed" — Master identity does NOT vanish back into shadows
      
      mainMessage += `\n\n🔴 **EMERGENCY COMMAND SEAL EVACUATION!**\n` +
        `As **${targetMaster.username}** faced fatal damage in **${chanTag}**, their Command Seal flared: *“By my Command Seal... Spatial Evacuation!”*\n` +
        `• Consumed **1 Command Seal** (Remaining: **${targetMaster.commandSeals}/3**).\n` +
        `• Nullified death-blow! **${targetMaster.username}** escaped with **1 HP**!`;

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
  const wasAlreadyExposed = !!attacker.isExposed;
  attacker.lastAmbushTime = now;
  attacker.isExposed = true;
  if (!wasAlreadyExposed) {
    attacker.exposureReason = 'innocent_assault';
  }
  attacker.innocentKills = (attacker.innocentKills || 0) + 1;

  if (!targetWar.civilianCasualties) targetWar.civilianCasualties = [];
  
  // Clean bystander string to prevent duplicate @ symbols or raw mention formatting
  const cleanBystander = suspectQuery.replace(/^<@!?(\d+)>$/, '$1').replace(/^@+/, '').trim();
  const bystanderDisplay = `@${cleanBystander}`;

  targetWar.civilianCasualties.unshift({
    id: `victim_${Date.now()}`,
    name: bystanderDisplay,
    slainByMasterId: attacker.username,
    timestamp: now
  });

  const exposureNote = wasAlreadyExposed
    ? `• Master **${attacker.username}** was **already publicly exposed** on the War Board, and this civilian casualty further stains their Master record!\n`
    : `• Master **${attacker.username}**'s identity is now **VIOLENTLY EXPOSED** to the server for breaching the Secrecy of Magecraft!\n`;

  const casualtyText = 
    `Master **${attacker.username}**'s Servant (${attacker.servantName}) struck down innocent server bystander **${bystanderDisplay}** in **${chanTag}**!\n` +
    `• The victim was killed instantly in the magical crossfire.\n` +
    exposureNote + `\n` +
    `⛪ **Fuyuki Church Overseer Gas Leak Bulletin:**\n` +
    `> *"The Fuyuki Church and municipal police report a severe structural **'gas leak explosion'** in **${chanTag}** involving civilian ${bystanderDisplay}. Cause classified as faulty underground utility piping. Public is advised to stay indoors."*`;

  targetWar.eventLogs.unshift({
    id: `evt_casualty_${Date.now()}`,
    timestamp: now,
    text: `☠️ Church Cover-Up: "Gas leak explosion" reported in ${chanTag} involving bystander **${bystanderDisplay}** (caused by **${attacker.username}**)!`,
    type: 'casualty'
  });

  return {
    success: true,
    message: casualtyText,
    targetWasMaster: false,
    isCollateralCasualty: true,
    wasAlreadyExposed,
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
 * Sets a Bounded Field trap in a specific channel.
 * Max 2 active traps per Master.
 */
export function setChannelTrapInWar(
  war: HolyGrailWarSession,
  setterId: string,
  setterUsername: string,
  channelName: string,
  trapType: 'alarm' | 'drain'
): { success: boolean; message: string; updatedWar: HolyGrailWarSession } {
  const targetWar = war || globalWarSession;
  if (!targetWar) {
    return { success: false, message: 'Holy Grail War is not active!', updatedWar: war };
  }

  const setter = targetWar.participants[setterId];
  if (!setter || !setter.isAlive) {
    return { success: false, message: 'You must have an active Heroic Spirit contract to weave Bounded Field traps!', updatedWar: targetWar };
  }

  const chanTag = channelName.startsWith('#') ? channelName : `#${channelName}`;

  if (!targetWar.channelTraps) {
    targetWar.channelTraps = [];
  }

  // Check if ANOTHER Master has already anchored a Bounded Field in this channel sector
  const rivalFieldInChannel = targetWar.channelTraps.find(
    t => t.channelName.toLowerCase() === chanTag.toLowerCase() && t.setterMasterId !== setterId
  );
  if (rivalFieldInChannel) {
    return {
      success: false,
      message: `❌ **Magical Territory Clash:** A Bounded Field is already anchored in **${chanTag}** by rival Master **${rivalFieldInChannel.setterUsername}**! Multiple Masters cannot set Bounded Fields in the same channel due to conflicting leyline interference. Their field must be triggered or disarmed first.`,
      updatedWar: targetWar
    };
  }
  
  // Count active traps for this Master across all channels (max 3)
  const currentTraps = targetWar.channelTraps.filter(t => t.setterMasterId === setterId);
  if (currentTraps.length >= 3) {
    return {
      success: false,
      message: `❌ You can only maintain up to **3 active channel Bounded Fields** simultaneously across Fuyuki! Use \`/trap disarm\` to remove an existing field first.`,
      updatedWar: targetWar
    };
  }

  // Count active traps for this Master in this specific channel (max 3 in a channel)
  const currentTrapsInChannel = currentTraps.filter(t => t.channelName.toLowerCase() === chanTag.toLowerCase());
  if (currentTrapsInChannel.length >= 3) {
    return {
      success: false,
      message: `❌ You have reached the maximum capacity of **3 Bounded Fields** anchored in **${chanTag}**! Disarm an existing field in this channel with \`/trap disarm\`.`,
      updatedWar: targetWar
    };
  }

  const trapId = `trap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = Date.now();
  const newTrap: ChannelBoundedTrap = {
    id: trapId,
    channelName: chanTag,
    setterMasterId: setterId,
    setterUsername: setter.username || setterUsername,
    trapType,
    createdAt: now,
    expiresAt: now + (24 * 60 * 60 * 1000)
  };

  targetWar.channelTraps.push(newTrap);

  const trapLabel = trapType === 'alarm' 
    ? '🚨 **Sensory Alarm Ward** (Exposes intruder identity & Servant Class upon action)'
    : '🩸 **Bloodfort Mana Drain Field** (Siphons 1,800–2,600 HP from intruder and heals your Servant)';

  const myCountInChan = currentTrapsInChannel.length + 1;
  const resultMsg = `🕸️ **Bounded Field Trap Deployed in ${chanTag}!**\n` +
    `• **Field Type:** ${trapLabel}\n` +
    `• **Status:** Concealed in leyline currents. Triggers when any rival Master operates in ${chanTag}.\n` +
    `• **Active Traps:** ${currentTraps.length + 1}/3 deployed (${myCountInChan} anchored in ${chanTag}).`;

  targetWar.eventLogs.unshift({
    id: `evt_trap_set_${Date.now()}`,
    timestamp: Date.now(),
    text: `🕸️ Bounded Field Weaving: A concealed magical perimeter was anchored in ${chanTag}.`,
    type: 'ambush'
  });

  saveWarToDisk();
  return {
    success: true,
    message: resultMsg,
    updatedWar: targetWar
  };
}

/**
 * Disarms a Master's own active channel trap(s) or infiltrates and dismantles rival/enemy Bounded Fields.
 */
export function disarmChannelTrapsInWar(
  war: HolyGrailWarSession,
  setterId: string,
  channelName?: string
): { success: boolean; message: string; updatedWar: HolyGrailWarSession } {
  const targetWar = war || globalWarSession;
  if (!targetWar) {
    return { success: false, message: 'Holy Grail War is not active!', updatedWar: war };
  }

  if (!targetWar.channelTraps) {
    targetWar.channelTraps = [];
  }

  const disarmer = targetWar.participants[setterId];
  const disarmerName = disarmer?.username || 'Master';

  // Case 1: Specific Channel targeted
  if (channelName) {
    const chanTag = channelName.startsWith('#') ? channelName : `#${channelName}`;
    const matchingTraps = targetWar.channelTraps.filter(
      t => t.channelName.toLowerCase() === chanTag.toLowerCase()
    );

    if (matchingTraps.length === 0) {
      return {
        success: true,
        message: `ℹ️ No active Bounded Fields found anchored in **${chanTag}**. The sector is already clear of magical wards.`,
        updatedWar: targetWar
      };
    }

    const myTraps = matchingTraps.filter(t => t.setterMasterId === setterId);
    const enemyTraps = matchingTraps.filter(t => t.setterMasterId !== setterId);

    // Remove all traps in this channel
    targetWar.channelTraps = targetWar.channelTraps.filter(
      t => t.channelName.toLowerCase() !== chanTag.toLowerCase()
    );

    saveWarToDisk();

    if (myTraps.length > 0 && enemyTraps.length === 0) {
      return {
        success: true,
        message: `🧹 **Bounded Field Dissolved:** Successfully dismissed and disarmed **${myTraps.length}** of your active Bounded Field trap(s) in **${chanTag}**.`,
        updatedWar: targetWar
      };
    }

    if (enemyTraps.length > 0) {
      const enemyNames = Array.from(new Set(enemyTraps.map(t => t.setterUsername))).join(', ');
      const enemyTypes = enemyTraps.map(t => t.trapType === 'alarm' ? '🚨 Sensory Alarm Ward' : '🩸 Bloodfort Mana Drain Field').join(' & ');

      // Add event log to war history
      targetWar.eventLogs.unshift({
        id: `evt_disarm_${Date.now()}`,
        timestamp: Date.now(),
        text: `🧹 **Leyline Infiltration:** Master **${disarmerName}** infiltrated **${chanTag}** and dismantled rival Master **${enemyNames}**'s concealed Bounded Field!`,
        type: 'ambush'
      });

      return {
        success: true,
        message: `🗡️ **Enemy Bounded Field Dismantled & Neutralized!**\n` +
          `• **Target Sector:** **${chanTag}**\n` +
          `• **Rival Master:** **${enemyNames}**\n` +
          `• **Neutralized Ward(s):** ${enemyTypes}\n` +
          `• **Tactical Outcome:** Your Servant infiltrated the sector's mana leylines and severed the rival magical circuits! The enemy's trap has been dissolved and the channel is now clear for your own deployment.`,
        updatedWar: targetWar
      };
    }
  }

  // Case 2: No specific channel targeted -> disarm all of caller's own traps
  const initialCount = targetWar.channelTraps.length;
  targetWar.channelTraps = targetWar.channelTraps.filter(t => t.setterMasterId !== setterId);
  const removedCount = initialCount - targetWar.channelTraps.length;
  saveWarToDisk();

  return {
    success: true,
    message: removedCount > 0 
      ? `🧹 Successfully dissolved and disarmed **${removedCount}** of your active Bounded Field trap(s) across Fuyuki.`
      : `You have no active Bounded Field traps to disarm. (To dismantle an enemy Bounded Field, specify the target sector with \`/trap disarm channel:#channel-name\`).`,
    updatedWar: targetWar
  };
}

/**
 * Checks if a channel has any active traps placed by rival Masters and triggers the first matching trap.
 */
export function checkAndTriggerChannelTraps(
  war: HolyGrailWarSession,
  intruderId: string,
  intruderUsername: string,
  channelName: string,
  channelId?: string
): { 
  triggered: boolean; 
  message?: string; 
  trapType?: 'alarm' | 'drain'; 
  setterId?: string;
  setterUsername?: string;
  drainDmg?: number;
  intruderRemainingHp?: number;
  intruderMaxHp?: number;
  intruderServantName?: string;
  intruderServantClass?: string;
  isLethal?: boolean;
  usedAutoEvade?: boolean;
  channelName?: string;
} {
  const targetWar = war || globalWarSession;
  if (!targetWar || !targetWar.channelTraps || targetWar.channelTraps.length === 0) {
    return { triggered: false };
  }

  const chanTag = channelName.startsWith('#') ? channelName : `#${channelName}`;
  const cleanChan = chanTag.replace(/^[#<@>]/, '').toLowerCase();
  const cId = channelId ? channelId.toLowerCase() : '';

  const intruder = targetWar.participants[intruderId];
  if (!intruder || !intruder.isAlive) {
    return { triggered: false };
  }

  // Find trap in channel placed by a rival (not intruder, not in same alliance)
  const trapIdx = targetWar.channelTraps.findIndex(t => {
    const tClean = t.channelName.replace(/^[#<@>]/, '').toLowerCase();
    const matchesName = tClean === cleanChan || t.channelName.toLowerCase() === chanTag.toLowerCase();
    const matchesId = !!cId && (tClean === cId || t.channelName.toLowerCase() === cId || t.channelName === `<#${channelId}>`);
    if (!matchesName && !matchesId) return false;
    if (t.setterMasterId === intruderId) return false;
    const setter = targetWar.participants[t.setterMasterId];
    if (!setter || !setter.isAlive) return false;
    // Check alliance
    if (intruder.allianceId && setter.allianceId && intruder.allianceId === setter.allianceId) return false;
    return true;
  });

  if (trapIdx === -1) {
    return { triggered: false };
  }

  const trap = targetWar.channelTraps[trapIdx];
  const setter = targetWar.participants[trap.setterMasterId];

  // Consume/remove single-use trap
  targetWar.channelTraps.splice(trapIdx, 1);

  let trapNotice = '';
  let drainDmg = 0;
  let isLethal = false;
  let usedAutoEvade = false;

  if (trap.trapType === 'alarm') {
    intruder.isExposed = true;
    intruder.exposureReason = 'alarm_trap';

    trapNotice = `🚨 **ALARM BOUNDED FIELD TRIPPED IN ${chanTag}!**\n` +
      `Master **${intruder.username}** entered **${chanTag}** and tripped a concealed sensory web!\n` +
      `• Intruder Identity: **${intruder.username}** (Servant: **${intruder.servantName}**, Class: **${intruder.servantClass}**)\n` +
      `• Master **${intruder.username}** is now **EXPOSED** on the Holy Grail War Board!`;

    targetWar.eventLogs.unshift({
      id: `evt_trap_alarm_${Date.now()}`,
      timestamp: Date.now(),
      text: `🚨 Alarm Bounded Field Tripped in ${chanTag}: Master **${intruder.username}** (${intruder.servantClass}) was detected and exposed!`,
      type: 'exposure'
    });
  } else {
    // DRAIN FIELD
    drainDmg = Math.round(1800 + Math.random() * 800);
    intruder.currentHp = Math.max(0, intruder.currentHp - drainDmg);
    setter.currentHp = Math.min(setter.maxHp, setter.currentHp + drainDmg);

    trapNotice = `🩸 **BLOODFORT MANA DRAIN FIELD TRIGGERED IN ${chanTag}!**\n` +
      `Master **${intruder.username}** walked into a concealed predatory Bounded Field in **${chanTag}**!\n` +
      `• Siphoned **${drainDmg.toLocaleString()} HP** from ${intruder.isExposed ? intruder.servantName : 'contracted Servant'} (HP: ${intruder.currentHp}/${intruder.maxHp})!\n` +
      `• Channeled vitality directly to the ward anchor!`;

    if (intruder.currentHp <= 0) {
      if (intruder.autoEvadeEnabled === true && intruder.commandSeals >= 1) {
        intruder.commandSeals--;
        intruder.currentHp = 1;
        usedAutoEvade = true;
        trapNotice += `\n🔴 **EMERGENCY ESCAPE:** Consumed 1 Command Seal to escape fatal drain with 1 HP!`;
      } else {
        intruder.isAlive = false;
        intruder.isExposed = true;
        isLethal = true;
        setter.kills = (setter.kills || 0) + 1;
        trapNotice += `\n☠️ **FATAL WITHERING:** Master **${intruder.username}**'s spiritual core collapsed from total mana drain!`;
        evaluateWarState(targetWar);
      }
    }

    targetWar.eventLogs.unshift({
      id: `evt_trap_drain_${Date.now()}`,
      timestamp: Date.now(),
      text: `🩸 Mana Drain Field in ${chanTag}: A predatory Bounded Field siphoned ${drainDmg.toLocaleString()} HP from Master **${intruder.username}**!`,
      type: 'clash'
    });
  }

  saveWarToDisk();

  return {
    triggered: true,
    message: trapNotice,
    trapType: trap.trapType,
    setterId: trap.setterMasterId,
    setterUsername: setter.username,
    drainDmg: trap.trapType === 'drain' ? drainDmg : 0,
    intruderRemainingHp: intruder.currentHp,
    intruderMaxHp: intruder.maxHp,
    intruderServantName: intruder.servantName,
    intruderServantClass: intruder.servantClass,
    isLethal,
    usedAutoEvade,
    channelName: chanTag
  };
}

/**
 * Dispatches a magical familiar (Raven, Homunculus, or Shadow Imp) to a channel sector.
 * Max 2 active familiars per Master.
 */
export function dispatchFamiliarInWar(
  war: HolyGrailWarSession,
  masterId: string,
  masterUsername: string,
  channelName: string,
  familiarType: 'raven' | 'homunculus' | 'shadow_imp'
): { success: boolean; message: string; updatedWar: HolyGrailWarSession } {
  const targetWar = war || globalWarSession;
  if (!targetWar) {
    return { success: false, message: 'Holy Grail War is not active!', updatedWar: war };
  }

  const master = targetWar.participants[masterId];
  if (!master || !master.isAlive) {
    return { success: false, message: 'You must have an active Heroic Spirit contract to dispatch familiars!', updatedWar: targetWar };
  }

  const chanTag = channelName.startsWith('#') ? channelName : `#${channelName}`;

  if (!targetWar.familiars) {
    targetWar.familiars = [];
  }

  // Check how many familiars this Master currently commands
  const userFamiliars = targetWar.familiars.filter(f => f.masterId === masterId);
  if (userFamiliars.length >= 2) {
    return {
      success: false,
      message: `❌ You can only maintain up to **2 active familiars** simultaneously! Use \`/grailwar familiars\` to inspect or recall them.`,
      updatedWar: targetWar
    };
  }

  const familiarId = `fam_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = Date.now();
  const expiresAt = now + (24 * 60 * 60 * 1000); // 24 hours

  const newFamiliar: ActiveFamiliar = {
    id: familiarId,
    masterId,
    masterUsername: master.username || masterUsername,
    channelName: chanTag,
    familiarType,
    createdAt: now,
    expiresAt,
    detectedIntel: []
  };

  targetWar.familiars.push(newFamiliar);

  let typeDesc = '';
  if (familiarType === 'raven') {
    typeDesc = '🦅 **Scouting Raven (Aerial Surveillance)**\n• Stationed in **' + chanTag + '** to observe rival Master movements, magecraft invocations, and Servant class signatures.';
  } else if (familiarType === 'homunculus') {
    typeDesc = '🗿 **Homunculus Decoy (Bodyguard Construct)**\n• Materialized in **' + chanTag + '** to absorb 100% damage from the next enemy ambush attempt on you and shield your identity.';
  } else {
    typeDesc = '🦇 **Shadow Imp (Saboteur & Mana Siphon)**\n• Latched into the shadows of **' + chanTag + '** to siphon 600–1,000 HP from trespassing rival Masters and spy on secret chatter.';
  }

  const resultMsg = `✨ **Familiar Successfully Dispatched!**\n\n` +
    typeDesc + `\n\n` +
    `• **Active Familiars:** ${targetWar.familiars.filter(f => f.masterId === masterId).length}/2 active.\n` +
    `• Use \`/grailwar familiars\` to read surveillance logs or recall your scouts.`;

  targetWar.eventLogs.unshift({
    id: `evt_fam_dispatch_${Date.now()}`,
    timestamp: now,
    text: `🦅 Familiar Dispatch: A concealed magical familiar was deployed to patrol ${chanTag}.`,
    type: 'intel_leak'
  });

  saveWarToDisk();

  return {
    success: true,
    message: resultMsg,
    updatedWar: targetWar
  };
}

/**
 * Recalls active familiars for a Master.
 */
export function recallFamiliarsInWar(
  war: HolyGrailWarSession,
  masterId: string,
  channelName?: string
): { success: boolean; message: string; updatedWar: HolyGrailWarSession } {
  const targetWar = war || globalWarSession;
  if (!targetWar) {
    return { success: false, message: 'Holy Grail War is not active!', updatedWar: war };
  }

  if (!targetWar.familiars || targetWar.familiars.length === 0) {
    return { success: true, message: 'You have no active familiars deployed.', updatedWar: targetWar };
  }

  const initialCount = targetWar.familiars.length;
  if (channelName) {
    const chanTag = channelName.startsWith('#') ? channelName : `#${channelName}`;
    targetWar.familiars = targetWar.familiars.filter(
      f => !(f.masterId === masterId && f.channelName.toLowerCase() === chanTag.toLowerCase())
    );
  } else {
    targetWar.familiars = targetWar.familiars.filter(f => f.masterId !== masterId);
  }

  const recalledCount = initialCount - targetWar.familiars.length;
  saveWarToDisk();

  return {
    success: true,
    message: recalledCount > 0
      ? `🕊️ Successfully recalled and dismissed **${recalledCount}** active familiar(s).`
      : `No active familiars found in the specified channel.`,
    updatedWar: targetWar
  };
}

/**
 * Records an observation to any active Ravens / Imps stationed in that channel.
 */
export function recordFamiliarObservation(
  war: HolyGrailWarSession,
  actorId: string,
  actorUsername: string,
  channelName: string,
  actionText: string,
  servantClass?: string
): void {
  const targetWar = war || globalWarSession;
  if (!targetWar || !targetWar.familiars || targetWar.familiars.length === 0) return;

  const chanTag = channelName.startsWith('#') ? channelName : `#${channelName}`;
  const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  for (const fam of targetWar.familiars) {
    // Only record for familiars owned by OTHER masters in that channel
    if (fam.masterId === actorId) continue;
    if (fam.channelName.toLowerCase() !== chanTag.toLowerCase()) continue;

    if (fam.familiarType === 'raven') {
      const classHint = servantClass ? ` (Resonating aura: **${servantClass}**)` : '';
      const logEntry = `[${nowStr}] 🦅 **Raven Sighting:** Sighted **${actorUsername}** active in ${chanTag}: *${actionText}*${classHint}.`;
      if (!fam.detectedIntel) fam.detectedIntel = [];
      fam.detectedIntel.unshift(logEntry);
      if (fam.detectedIntel.length > 8) fam.detectedIntel.pop();
    } else if (fam.familiarType === 'shadow_imp') {
      const logEntry = `[${nowStr}] 🦇 **Shadow Imp Whisper:** Overheard **${actorUsername}** operating in ${chanTag}: *${actionText}*.`;
      if (!fam.detectedIntel) fam.detectedIntel = [];
      fam.detectedIntel.unshift(logEntry);
      if (fam.detectedIntel.length > 8) fam.detectedIntel.pop();
    }
  }

  saveWarToDisk();
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

  // MASTER SCOUT PATROL (Stealth Reconnaissance - DOES NOT trigger traps)
  const cleanChan = chanTag.replace(/^[#<@>]/, '').toLowerCase();
  const activeTraps = (targetWar.channelTraps || []).filter(t => {
    const tClean = t.channelName.replace(/^[#<@>]/, '').toLowerCase();
    return tClean === cleanChan || t.channelName.toLowerCase() === chanTag.toLowerCase();
  });

  let trapIntel = '';
  if (activeTraps.length > 0) {
    const rivalTraps = activeTraps.filter(t => t.setterMasterId !== actorDiscordId);
    const ownTraps = activeTraps.filter(t => t.setterMasterId === actorDiscordId);

    const intelLines: string[] = [];
    if (rivalTraps.length > 0) {
      for (const t of rivalTraps) {
        if (t.trapType === 'drain') {
          intelLines.push(`🩸 **Hostile Bounded Field Detected:** Concealed **Bloodfort Mana Drain Field** anchored in **${chanTag}**!\n• *Hazard:* Walking or casting spells here normally will siphon 2,500–5,000 HP from your Servant!\n• *Disarm:* Use \`/trap disarm channel:${chanTag}\` to safely dismantle it before engaging.`);
        } else {
          intelLines.push(`🚨 **Hostile Alarm Ward Detected:** Concealed **Sensory Alarm Ward** woven into **${chanTag}**!\n• *Hazard:* Operating here normally will trip perimeter sensors and expose your identity to the War Board!\n• *Disarm:* Use \`/trap disarm channel:${chanTag}\` to dismantle it safely.`);
        }
      }
    }
    if (ownTraps.length > 0) {
      for (const t of ownTraps) {
        intelLines.push(`🛡️ **Your Active Ward:** You have an active **${t.trapType === 'drain' ? 'Bloodfort Mana Drain Field' : 'Sensory Alarm Ward'}** guarding **${chanTag}**.`);
      }
    }
    trapIntel = intelLines.join('\n\n');
  } else {
    trapIntel = `✨ **Leyline Reconnaissance:** **${chanTag}** is clear of concealed Bounded Fields, Alarm Wards, and Bloodfort Drains.`;
  }

  const aliveRivals = Object.values(targetWar.participants).filter(p => p.discordId !== actorDiscordId && p.isAlive);
  let masterReport = '';

  if (aliveRivals.length > 0 && Math.random() < 0.60) {
    const rival = aliveRivals[Math.floor(Math.random() * aliveRivals.length)];
    const rivalIndex = Object.values(targetWar.participants).indexOf(rival) + 1;
    const rivalLabel = rival.isExposed ? `Master **${rival.username}**` : `Shadow Master #${rivalIndex}`;
    const servantLabel = rival.isExposed ? `**${rival.servantName}** (${rival.servantClass})` : `**${rival.servantClass} Class**`;

    masterReport = `👁️ **Scout Intel for ${chanTag}:** Your Servant (**${actorParticipant.servantName}**) surveyed **${chanTag}** and detected the distant mana trail of ${rivalLabel} (${servantLabel}, ~${rival.currentHp.toLocaleString()} HP).`;
  } else {
    const masterReports = [
      `👁️ **Scout Intel for ${chanTag}:** Your Servant surveyed **${chanTag}** and spotted civilian bystanders lingering nearby. Exercise caution if ambushing here to avoid collateral casualties.`,
      `👁️ **Scout Intel for ${chanTag}:** Your Servant combed **${chanTag}** from the shadows. The area is currently clear of rival Servant signatures.`
    ];
    masterReport = masterReports[Math.floor(Math.random() * masterReports.length)];
  }

  // Check if actor has active familiars in this sector to include feed
  const ownFamiliars = (targetWar.familiars || []).filter(
    f => f.masterId === actorDiscordId && f.channelName.toLowerCase() === chanTag.toLowerCase()
  );
  if (ownFamiliars.length > 0) {
    const lines = ownFamiliars.map(f => {
      const typeLabel = f.familiarType === 'raven' ? '🦅 **Scouting Raven**' : f.familiarType === 'homunculus' ? '🗿 **Homunculus Decoy**' : '🦇 **Shadow Imp**';
      const logs = (f.detectedIntel && f.detectedIntel.length > 0)
        ? f.detectedIntel.slice(0, 3).join('\n  ')
        : '• *No hostile movement detected in this sector yet.*';
      return `${typeLabel} stationed in ${chanTag}:\n  ${logs}`;
    }).join('\n\n');
    masterReport += `\n\n📡 **Active Familiar Surveillance Feed:**\n${lines}`;
  }

  // Check if enemy familiar exists and if Archer/Assassin/Rider or perception detects and neutralizes it
  const isHighPerception = ['Archer', 'Assassin', 'Rider'].includes(actorParticipant.servantClass);
  const enemyFamIdx = (targetWar.familiars || []).findIndex(
    f => f.masterId !== actorDiscordId && f.channelName.toLowerCase() === chanTag.toLowerCase()
  );
  if (enemyFamIdx !== -1 && (isHighPerception || Math.random() < 0.45)) {
    const enemyFam = targetWar.familiars![enemyFamIdx];
    const famTypeName = enemyFam.familiarType === 'raven' ? 'Scouting Raven' : enemyFam.familiarType === 'homunculus' ? 'Homunculus Decoy' : 'Shadow Imp';
    targetWar.familiars!.splice(enemyFamIdx, 1);
    masterReport += `\n\n🏹 **Enemy Spy Neutralized!** Your Servant (**${actorParticipant.servantName}**) detected a concealed **${famTypeName}** spying on ${chanTag} and eliminated it!`;
  }

  const fullReport = `${trapIntel}\n\n${masterReport}`;

  // Record observation for any surviving rival familiars in this channel
  recordFamiliarObservation(
    targetWar,
    actorDiscordId,
    actorUsername,
    chanTag,
    'conducted a tactical patrol',
    actorParticipant.servantClass
  );

  return {
    success: true,
    message: fullReport,
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
    const previousWard = actor.boundedField || 'none';
    actor.boundedField = val;

    const now = Date.now();
    if (val === 'ward' && previousWard !== 'ward') {
      // Activating Mage Sanctuary begins active leyline regeneration from current HP
      if (actor.currentHp < actor.maxHp) {
        actor.baseHpAtDamage = actor.currentHp;
        actor.lastDamageTime = now;
      }
    } else if (val !== 'ward' && previousWard === 'ward') {
      // Deactivating Mage Sanctuary calculates HP up to this instant and pauses further auto-regen
      actor.currentHp = calculateCurrentHp(actor, now);
      actor.baseHpAtDamage = actor.currentHp;
      actor.lastDamageTime = undefined;
    }

    let desc = '';
    if (val === 'none') desc = 'deactivated all active workshop bounded fields (HP auto-regeneration paused)';
    else if (val === 'ward') desc = `established a Mage Sanctuary Bounded Field in \`${actor.sanctuaryChannelName || '#general'}\` (blocks 60% incoming ambush damage & is the sole method of HP auto-regeneration)`;
    else if (val === 'alarm') desc = 'deployed an Intrusion Alert Trap (deals 3,000 retaliatory DMG; note: auto-regeneration requires Mage Sanctuary)';
    
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
    case 'rest_and_heal':
    case 'heal_ritual': {
      return executeHealRitual(targetWar, actor.discordId);
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
    type: action === 'form_alliance' ? 'alliance' : 'clash'
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
  applyDamageToParticipant(ai2, damage);

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
  saveWarToDisk();

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
 * Retains surviving combat damage so wounded combatants do not instantly auto-heal.
 */
export function recordDuelOutcome(
  war: HolyGrailWarSession,
  winnerQuery: string,
  loserQuery: string,
  decision: 'kill' | 'spare',
  channelName?: string,
  winnerRemainingHp?: number,
  loserRemainingHp?: number
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

  const now = Date.now();

  // Both identities become exposed due to the decisive duel
  victor.isExposed = true;
  victor.exposureReason = 'direct_combat';
  defeated.isExposed = true;
  defeated.exposureReason = 'direct_combat';

  // Victor retains any battle damage taken rather than resetting to 100%
  if (winnerRemainingHp !== undefined && winnerRemainingHp > 0) {
    victor.currentHp = Math.min(victor.maxHp, Math.round(winnerRemainingHp));
  }
  if (victor.currentHp < victor.maxHp) {
    victor.baseHpAtDamage = victor.currentHp;
    victor.lastDamageTime = now;
  }

  let outcomeLog = '';
  let isEliminated = false;

  if (decision === 'kill') {
    defeated.isAlive = false;
    defeated.currentHp = 0;
    defeated.baseHpAtDamage = 0;
    victor.kills = (victor.kills || 0) + 1;
    isEliminated = true;

    const deadCount = Object.values(targetWar.participants).filter(p => !p.isAlive).length;

    outcomeLog = `☠️ FATAL EXECUTION in ${chanTag}: Master **${victor.username}** (${victor.servantName}) dealt the finishing blow and EXECUTED Master **${defeated.username}** (${defeated.servantName})!\n⚱️ The Lesser Grail absorbed a Spiritual Core (${deadCount}/6 absorbed).`;

    targetWar.eventLogs.unshift({
      id: `evt_exec_${Date.now()}`,
      timestamp: now,
      text: outcomeLog,
      type: 'elimination'
    });

    evaluateWarState(targetWar);
  } else {
    // Spared: left on critical HP (or duel remaining HP), starts 5-min regeneration recovery
    defeated.isAlive = true;
    if (loserRemainingHp !== undefined && loserRemainingHp > 0) {
      defeated.currentHp = Math.min(defeated.maxHp, Math.round(loserRemainingHp));
    } else {
      defeated.currentHp = Math.max(1, Math.round(defeated.maxHp * 0.1));
    }
    defeated.baseHpAtDamage = defeated.currentHp;
    defeated.lastDamageTime = now;
    isEliminated = false;

    outcomeLog = `🕊️ MERCY BESTOWED in ${chanTag}: Master **${victor.username}** (${victor.servantName}) defeated Master **${defeated.username}** (${defeated.servantName}) in a duel, but chose to SPARE their life! **${defeated.username}** survives with critical HP (${defeated.currentHp.toLocaleString()}/${defeated.maxHp.toLocaleString()}). Spiritual core requires 5 minutes of leyline regeneration to fully reconstitute. Both identities are now exposed.`;

    targetWar.eventLogs.unshift({
      id: `evt_mercy_${Date.now()}`,
      timestamp: now,
      text: outcomeLog,
      type: 'heal'
    });

    evaluateWarState(targetWar);
  }

  saveWarToDisk();

  return {
    updatedWar: targetWar,
    message: outcomeLog,
    eliminated: isEliminated,
    victorMaster: victor,
    defeatedMaster: defeated
  };
}

// =========================================================================
// FUYUKI CHURCH SANCTUARY PROTOCOL
// =========================================================================

export function enterChurchSanctuary(
  war: HolyGrailWarSession,
  masterId: string
): { success: boolean; message: string; updatedWar: HolyGrailWarSession } {
  const targetWar = war || globalWarSession;
  if (!targetWar) {
    return { success: false, message: 'Holy Grail War is not active!', updatedWar: war };
  }

  let participant: WarMasterParticipant | undefined = targetWar.participants[masterId];
  if (!participant) {
    participant = Object.values(targetWar.participants).find(
      p => p.discordId === masterId || p.username.toLowerCase() === masterId.toLowerCase()
    );
  }
  if (!participant || !participant.isAlive) {
    return { success: false, message: 'You are not an active participant in this Holy Grail War.', updatedWar: targetWar };
  }

  const isUnderSanctuary = !!(participant.inSanctuary || (participant as any).inChurchSanctuary);
  if (isUnderSanctuary) {
    return { success: false, message: '⛪ You are already under the sacred protection of the Fuyuki Church Sanctuary!', updatedWar: targetWar };
  }

  participant.inSanctuary = true;
  (participant as any).inChurchSanctuary = true;
  participant.sanctuaryEnteredAt = Date.now();

  const nameLabel = participant.isExposed ? participant.username : 'A Master concealed in shadows';
  const logMsg = `⛪ **CHURCH SANCTUARY:** Master **${participant.username}** has sought political asylum under Father Kotomine at the Fuyuki Church! Immune to all ambushes and attacks while on sacred grounds.`;
  
  targetWar.eventLogs.unshift({
    id: `evt_sanctuary_${Date.now()}`,
    timestamp: Date.now(),
    text: logMsg,
    type: 'heal'
  });

  saveWarToDisk();

  return {
    success: true,
    message: `⛪ **FUYUKI CHURCH SANCTUARY ENTERED**\n\n` +
      `You have sought political asylum at the Fuyuki Church under Father Kotomine's supervision!\n\n` +
      `• 🛡️ **Absolute Asylum:** You are **100% immune** to all ambushes, skirmishes, and duels while in Sanctuary.\n` +
      `• 🕊️ **Pact of Non-Aggression:** You cannot initiate attacks or ambushes against other Masters while in Sanctuary.\n` +
      `• 🚪 **Departure:** Use \`/church leave\` or the status panel when you are prepared to re-enter the Holy Grail War.`,
    updatedWar: targetWar
  };
}

export function leaveChurchSanctuary(
  war: HolyGrailWarSession,
  masterId: string
): { success: boolean; message: string; updatedWar: HolyGrailWarSession } {
  const targetWar = war || globalWarSession;
  if (!targetWar) {
    return { success: false, message: 'Holy Grail War is not active!', updatedWar: war };
  }

  let participant: WarMasterParticipant | undefined = targetWar.participants[masterId];
  if (!participant) {
    participant = Object.values(targetWar.participants).find(
      p => p.discordId === masterId || p.username.toLowerCase() === masterId.toLowerCase()
    );
  }
  if (!participant || !participant.isAlive) {
    return { success: false, message: 'You are not an active participant in this Holy Grail War.', updatedWar: targetWar };
  }

  const isUnderSanctuary = !!(participant.inSanctuary || (participant as any).inChurchSanctuary);
  if (!isUnderSanctuary) {
    return { success: false, message: 'You are not currently in the Fuyuki Church Sanctuary.', updatedWar: targetWar };
  }

  participant.inSanctuary = false;
  (participant as any).inChurchSanctuary = false;
  participant.sanctuaryEnteredAt = undefined;

  const logMsg = `⚔️ **SANCTUARY DEPARTURE:** Master **${participant.username}** has stepped down from the Fuyuki Church steps and re-entered the battlefield of the Holy Grail War!`;

  targetWar.eventLogs.unshift({
    id: `evt_sanctuary_leave_${Date.now()}`,
    timestamp: Date.now(),
    text: logMsg,
    type: 'heal'
  });

  saveWarToDisk();

  return {
    success: true,
    message: `⚔️ **DEPARTED FUYUKI CHURCH SANCTUARY**\n\n` +
      `You have stepped out of consecrated grounds and re-entered the active battle royale!\n\n` +
      `• Your weapons are drawn and you may now launch tactical ambushes (\`/war attack\`).\n` +
      `• Rivals may now target you if you are exposed or tracked!`,
    updatedWar: targetWar
  };
}

export function invokeCommandSealInWar(
  war: HolyGrailWarSession,
  actorDiscordId: string,
  effect: 'heal' | 'overdrive' | 'toggle_evac'
): { success: boolean; message: string; updatedWar: HolyGrailWarSession } {
  const targetWar = war || globalWarSession;
  if (!targetWar) {
    return { success: false, message: 'Holy Grail War is not active!', updatedWar: war };
  }
  const actor = targetWar.participants[actorDiscordId];
  if (!actor || !actor.isAlive) {
    return { success: false, message: 'You have no active Servant contract in the Holy Grail War!', updatedWar: targetWar };
  }

  if (effect === 'toggle_evac') {
    actor.autoEvadeEnabled = actor.autoEvadeEnabled === false ? true : false;
    const statusStr = actor.autoEvadeEnabled ? '🟢 ENABLED' : '🔴 DISABLED';
    return {
      success: true,
      message: `📜 **Command Seal Auto-Evacuation:** ${statusStr}! When enabled, taking fatal ambush damage will automatically consume **1 Command Seal** to escape into shadows with **1 HP** (Remaining Seals: **${actor.commandSeals ?? 3}/3**).`,
      updatedWar: targetWar
    };
  }

  const seals = actor.commandSeals ?? 3;
  if (seals < 1) {
    return {
      success: false,
      message: '❌ **Command Seals Depleted:** You have 0 Command Seals remaining! Seals auto-recharge (1 Seal per 24 hours).',
      updatedWar: targetWar
    };
  }

  if (effect === 'heal') {
    actor.commandSeals = seals - 1;
    actor.currentHp = actor.maxHp;
    actor.baseHpAtDamage = actor.maxHp;
    actor.lastDamageTime = Date.now();
    return {
      success: true,
      message: `⚡ **COMMAND SEAL INVOKED: HEAL & REPAIR!** Consumed **1 Command Seal** (Remaining: **${actor.commandSeals}/3**).\n\nYour Servant **${actor.servantName}** was instantly restored to **100% Max HP (${actor.maxHp.toLocaleString()} HP)**!`,
      updatedWar: targetWar
    };
  }

  if (effect === 'overdrive') {
    actor.commandSeals = seals - 1;
    (actor as any).npGauge = 100;
    return {
      success: true,
      message: `🔮 **COMMAND SEAL INVOKED: NOBLE PHANTASM OVERDRIVE!** Consumed **1 Command Seal** (Remaining: **${actor.commandSeals}/3**).\n\nYour Servant **${actor.servantName}**'s Noble Phantasm gauge was instantly charged to **100% MAXIMUM OVERDRIVE**!`,
      updatedWar: targetWar
    };
  }

  return { success: false, message: 'Invalid Command Seal action.', updatedWar: targetWar };
}

export function setWorkshopWardInWar(
  war: HolyGrailWarSession,
  actorDiscordId: string,
  wardType: 'ward' | 'decoy' | 'alarm' | 'none',
  channelName?: string
): { success: boolean; message: string; updatedWar: HolyGrailWarSession } {
  const targetWar = war || globalWarSession;
  if (!targetWar) {
    return { success: false, message: 'Holy Grail War is not active!', updatedWar: war };
  }
  const actor = targetWar.participants[actorDiscordId];
  if (!actor || !actor.isAlive) {
    return { success: false, message: 'You have no active Servant contract in the Holy Grail War!', updatedWar: targetWar };
  }

  const previousWard = actor.boundedField || 'none';
  if (wardType === 'decoy') {
    (actor as any).homunculusCount = ((actor as any).homunculusCount || 0) + 1;
    actor.boundedField = 'decoy';
    return {
      success: true,
      message: `🗿 **HOMUNCULUS DECOY DEPLOYED!** Created an artificial Homunculus Decoy guarding your workshop.\n\n• *Effect:* The decoy will sacrifice itself to absorb **100% of incoming ambush damage** on the next surprise strike! (Active Decoys: **${(actor as any).homunculusCount}**)`,
      updatedWar: targetWar
    };
  }

  const targetChannel = channelName || actor.sanctuaryChannelName || '#general';
  if (wardType === 'ward') {
    actor.sanctuaryChannelName = targetChannel;
  }
  actor.boundedField = wardType;

  const now = Date.now();
  if (wardType === 'ward' && previousWard !== 'ward') {
    if (actor.currentHp < actor.maxHp) {
      actor.baseHpAtDamage = actor.currentHp;
      actor.lastDamageTime = now;
    }
  } else if (wardType !== 'ward' && previousWard === 'ward') {
    actor.currentHp = calculateCurrentHp(actor, now);
    actor.baseHpAtDamage = actor.currentHp;
    actor.lastDamageTime = undefined;
  }

  let desc = '';
  if (wardType === 'none') {
    desc = 'deactivated all active workshop bounded fields (HP auto-regeneration paused)';
  } else if (wardType === 'ward') {
    desc = `anchored a **Mage Sanctuary in \`${targetChannel}\`**!\n\n• 🛡️ **Defensive Barrier:** Absorbs and deflects **60% of incoming ambush damage**.\n• 💧 **Leyline Auto-Heal:** Channels continuous **HP Auto-Regeneration** (sole method of auto-healing; 5 min full recovery)`;
  } else if (wardType === 'alarm') {
    desc = 'deployed an Intrusion Alert Ward (deals 3,000 retaliatory DMG; note: auto-healing is disabled without an active Mage Sanctuary)';
  }

  return {
    success: true,
    message: `🏰 **Workshop Ward Deployed:** ${desc}`,
    updatedWar: targetWar
  };
}

// =========================================================================
// ADMIN LIFECYCLE & WAR CUSTOMIZATION ENGINE
// =========================================================================

export function startOrRestartWar(
  presetKey: string = 'fuyuki_7',
  customRules?: Partial<WarRules>,
  adminUsername: string = 'Overseer',
  options: { wipeRoster?: boolean } = { wipeRoster: true }
): { war: HolyGrailWarSession; message: string } {
  const war = getOrInitWarSession();
  const basePreset = WAR_PRESETS[presetKey] || WAR_PRESETS.fuyuki_7;
  const newRules: WarRules = {
    ...basePreset,
    ...(customRules || {})
  };

  // Archive previous war if there were active participants
  if (Object.keys(war.participants).length > 0) {
    const living = Object.values(war.participants).filter(p => p.isAlive);
    const topScorer = Object.values(war.participants).sort((a, b) => (b.kills || 0) - (a.kills || 0))[0];
    const victor = living.length === 1 ? living[0] : (war.grailWinnerId ? war.participants[war.grailWinnerId] : topScorer);

    if (!war.history) war.history = [];
    war.history.unshift({
      warId: war.id,
      title: war.title,
      concludedAt: Date.now(),
      winnerMasterId: victor?.discordId,
      winnerUsername: victor?.username || 'None',
      winnerServantName: victor?.servantName || 'None',
      totalParticipants: Object.keys(war.participants).length,
      totalEliminations: Object.values(war.participants).reduce((sum, p) => sum + (p.kills || 0), 0),
      rulesSummary: `${war.rules?.formatName || 'Standard'} • ${war.rules?.permadeath ? 'Permadeath' : 'Casual'}`
    });
  }

  const startingSeals = newRules.startingCommandSeals || 3;

  if (options.wipeRoster) {
    // True fresh war: Wipe active roster so all Masters must invoke /summon ritual anew
    war.participants = {};
  } else {
    // Retain existing roster but reset status & seals
    for (const p of Object.values(war.participants)) {
      p.currentHp = p.maxHp;
      p.baseHpAtDamage = p.maxHp;
      p.lastDamageTime = undefined;
      p.commandSeals = startingSeals;
      p.isAlive = true;
      p.isExposed = false;
      p.inSanctuary = false;
      (p as any).inChurchSanctuary = false;
      p.boundedField = 'none';
      p.kills = 0;
    }
  }

  // Clear traps, familiars, casualties, and start fresh
  war.channelTraps = [];
  war.familiars = [];
  war.civilianCasualties = [];
  war.leakedIntel = [];
  war.alliances = {};
  war.grailWinnerId = undefined;
  war.status = 'active';
  war.id = `grail_war_${Date.now()}`;
  war.title = newRules.formatName;
  war.rules = newRules;

  // If Apocrypha faction mode, assign participants evenly to Red vs Black
  if (newRules.factionMode && Object.keys(war.participants).length > 0) {
    const pKeys = Object.keys(war.participants);
    const red: string[] = [];
    const black: string[] = [];
    pKeys.forEach((key, idx) => {
      if (idx % 2 === 0) red.push(key);
      else black.push(key);
    });
    war.rules.factions = { red, black, ruler: [] };
  }

  const broadcastMsg = `🌟 **THE HOLY GRAIL WAR HAS COMMENCED!**\n\n` +
    `🏰 **Format:** ${newRules.formatName}\n` +
    `👥 **Participant Capacity:** Max **${newRules.maxMasters} Masters**\n` +
    `⚔️ **Servant Pool:** ${newRules.servantPool === 'canon_only' ? '📖 Canon Type-Moon Servants Only' : newRules.servantPool === 'custom_only' ? '🎨 Custom Community Servants Only' : '✨ Canon + Custom Servants'}\n` +
    `🔒 **Class Exclusivity:** ${newRules.classExclusivity ? 'Strict (1 per Class)' : 'Open (Multiple Allowed)'}\n` +
    `💀 **Lethality:** ${newRules.permadeath ? '☠️ Classic Permadeath' : '🛡️ Casual Training (Recovery Allowed)'}\n` +
    `⚡ **Command Seals:** **${newRules.startingCommandSeals} Seals** per Master\n` +
    `💧 **Leylines:** ${newRules.leylineDensity === 'fast' ? '⚡ High Surge (2x Fast Recovery)' : newRules.leylineDensity === 'desolate' ? '🏜️ Desolate (No Auto-Regen)' : 'Balanced Standard'}\n` +
    `⛪ **Church Sanctuary:** ${newRules.churchAsylum ? '🟢 Active Asylum under Father Kotomine' : '🔴 Desecrated (No Asylum)'}\n\n` +
    (options.wipeRoster 
      ? `🧹 **Fresh Season:** The war roster has been cleared! All Masters must perform the Summoning Ritual (\`/summon ritual\`) to form new contracts.\n`
      : `*All Master HP and Command Seals have been fully restored. Summon your Servant or enter the shadows with \`/patrol\` or \`/profile\`!*\n`);

  war.eventLogs.unshift({
    id: `evt_restart_${Date.now()}`,
    timestamp: Date.now(),
    text: `👑 **Admin ${adminUsername} launched a new Holy Grail War:** ${newRules.formatName}!`,
    type: 'admin_reset'
  });

  saveWarToDisk();
  return { war, message: broadcastMsg };
}

export function resetHolyGrailWar(
  archiveVictor: boolean = true,
  adminUsername: string = 'Overseer'
): { war: HolyGrailWarSession; message: string } {
  const war = getOrInitWarSession();
  const startingSeals = war.rules?.startingCommandSeals || 3;

  for (const p of Object.values(war.participants)) {
    p.currentHp = p.maxHp;
    p.baseHpAtDamage = p.maxHp;
    p.lastDamageTime = undefined;
    p.commandSeals = startingSeals;
    p.isAlive = true;
    p.isExposed = false;
    p.inSanctuary = false;
    (p as any).inChurchSanctuary = false;
    p.boundedField = 'none';
  }

  war.channelTraps = [];
  war.familiars = [];
  war.civilianCasualties = [];
  war.grailWinnerId = undefined;
  war.status = 'active';

  const resetMsg = `🔄 **HOLY GRAIL WAR RITUAL REFRESHED BY ADMIN (${adminUsername})!**\n\n` +
    `• ❤️ **Vitality:** All living and fallen Masters have been restored to **100% Max HP**.\n` +
    `• ✦ **Command Seals:** Re-inscribed **${startingSeals} Command Seals** for all Masters.\n` +
    `• 🕸️ **Territory:** All hostile channel traps and bounded fields dissolved.\n` +
    `• 🕶️ **Shadows:** All public exposure states cleared.`;

  war.eventLogs.unshift({
    id: `evt_quick_reset_${Date.now()}`,
    timestamp: Date.now(),
    text: `🔄 Admin ${adminUsername} performed a ritual refresh: Restored all Master HP and Command Seals.`,
    type: 'admin_reset'
  });

  saveWarToDisk();
  return { war, message: resetMsg };
}

export function updateWarRules(
  war: HolyGrailWarSession,
  ruleChanges: Partial<WarRules>,
  adminUsername: string = 'Overseer'
): { updatedWar: HolyGrailWarSession; message: string } {
  const targetWar = war || globalWarSession || getOrInitWarSession();
  if (!targetWar.rules) {
    targetWar.rules = { ...WAR_PRESETS.fuyuki_7 };
  }

  targetWar.rules = {
    ...targetWar.rules,
    ...ruleChanges,
    preset: 'custom'
  };

  const changeSummaries = Object.entries(ruleChanges).map(([k, v]) => `• **${k}:** \`${String(v)}\``).join('\n');
  const msg = `⚙️ **War Rules Updated by Admin (${adminUsername}):**\n${changeSummaries}`;

  targetWar.eventLogs.unshift({
    id: `evt_rule_update_${Date.now()}`,
    timestamp: Date.now(),
    text: msg,
    type: 'admin_reset'
  });

  saveWarToDisk();
  return { updatedWar: targetWar, message: msg };
}

export function refillAllWarParticipantsSeals(
  war: HolyGrailWarSession,
  adminUsername: string = 'Overseer'
): { updatedWar: HolyGrailWarSession; message: string } {
  const targetWar = war || globalWarSession || getOrInitWarSession();
  const maxSeals = targetWar.rules?.startingCommandSeals || 3;
  let count = 0;
  for (const p of Object.values(targetWar.participants || {})) {
    if (p.isAlive) {
      p.commandSeals = maxSeals;
      count++;
    }
  }
  saveWarToDisk();
  const msg = `🔱 **Overseer Re-inscription Ritual:** Restored Command Seals to **${maxSeals}/${maxSeals}** for all **${count}** living Masters!`;
  return { updatedWar: targetWar, message: msg };
}

export function triggerAdminCataclysm(
  war: HolyGrailWarSession,
  cataclysmType: 'grail_mud' | 'fuyuki_fire' | 'angra_mainyu' | 'mana_surge',
  adminUsername: string = 'Overseer'
): { updatedWar: HolyGrailWarSession; message: string; banner: string } {
  const targetWar = war || globalWarSession || getOrInitWarSession();
  const now = Date.now();
  let msg = '';
  let banner = '';

  if (cataclysmType === 'grail_mud') {
    banner = '🌊 ALL THE WORLD\'S EVIL: GRAIL MUD OVERFLOW!';
    let count = 0;
    for (const p of Object.values(targetWar.participants)) {
      if (p.isAlive) {
        p.currentHp = Math.max(1, p.currentHp - 2500);
        p.baseHpAtDamage = p.currentHp;
        p.lastDamageTime = now;
        p.isExposed = true;
        p.exposureReason = 'grail_mud_overflow';
        count++;
      }
    }
    msg = `🖤 **THE LESSER GRAIL HAS OVERFLOWED WITH CORRUPTED MUD!**\n\n` +
      `Black ichor floods Fuyuki City! **${count} Masters** suffered **2,500 direct corruption damage** and their spiritual concealment was destroyed (ALL Masters are now **EXPOSED** on the War Board)!`;
  } else if (cataclysmType === 'fuyuki_fire') {
    banner = '🔥 FUYUKI INFERNO: GREAT FIRE OF THE FOURTH WAR!';
    let refugeeCount = 0;
    for (const p of Object.values(targetWar.participants)) {
      if (p.inSanctuary || (p as any).inChurchSanctuary) {
        p.inSanctuary = false;
        (p as any).inChurchSanctuary = false;
        refugeeCount++;
      }
    }
    const trapCount = targetWar.channelTraps?.length || 0;
    targetWar.channelTraps = [];
    msg = `🔥 **THE GREAT FIRE OF FUYUKI HAS CONSUMED THE DISTRICTS!**\n\n` +
      `Raging hellfire sweeps the battlefield! **${trapCount} Bounded Field traps** were vaporized, and **${refugeeCount} Masters** taking asylum at the Holy Church were smoked out into active combat!`;
  } else if (cataclysmType === 'angra_mainyu') {
    banner = '👁️ ANGRA MAINYU DESCENDS: THE SHADOW RAID BOSS!';
    for (const p of Object.values(targetWar.participants)) {
      if (p.isAlive) {
        p.currentHp = Math.max(1, p.currentHp - 1500);
        p.baseHpAtDamage = p.currentHp;
        p.lastDamageTime = now;
      }
    }
    msg = `👁️ **ANGRA MAINYU HAS AWAKENED FROM THE DEPTHS OF THE GREATER GRAIL!**\n\n` +
      `A monstrous shadowy aura descends upon the war! All contracted Servants took **1,500 spiritual shockwave damage**. High-intensity leyline mana surges across the city!`;
  } else if (cataclysmType === 'mana_surge') {
    banner = '⚡ GREATER GRAIL LEYLINE ERUPTION: MANA SURGE!';
    let buffedCount = 0;
    for (const p of Object.values(targetWar.participants)) {
      if (p.isAlive) {
        p.commandSeals = Math.min(5, (p.commandSeals || 0) + 1);
        p.currentHp = Math.min(p.maxHp, p.currentHp + Math.round(p.maxHp * 0.5));
        p.baseHpAtDamage = p.currentHp;
        p.lastDamageTime = now;
        buffedCount++;
      }
    }
    msg = `✨ **THE GREATER GRAIL HAS ERUPTED WITH PRISMATIC MANA!**\n\n` +
      `A radiant column of magical energy fills the heavens! **${buffedCount} active Masters** received **+1 Command Seal** and had **50% of their Max HP** instantly replenished!`;
  }

  targetWar.eventLogs.unshift({
    id: `evt_cata_${Date.now()}`,
    timestamp: now,
    text: `⚡ Admin ${adminUsername} triggered Cataclysm: ${banner}`,
    type: 'cataclysm'
  });

  saveWarToDisk();
  return { updatedWar: targetWar, message: msg, banner };
}
