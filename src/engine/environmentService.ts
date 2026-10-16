/**
 * ============================================================================
 * TWO-ENVIRONMENT SYSTEM: SAFE MODE (CHALDEA) vs WAR MODE (FUYUKI)
 * ============================================================================
 * 
 * CORE PRINCIPLES:
 * 1. TWO CLEAR ENVIRONMENTS:
 *    - SAFE MODE / OUTSIDE THE WAR (Chaldea Reserve):
 *      Dedicated to peaceful RPG progression: daily rewards (/daily), free battles
 *      and friendly sparring (/duel free), summoning (/summon), bond dialogues (/talk),
 *      and Craft Essence banner pulls (/cegacha).
 *      Players outside the war enjoy uninterrupted gameplay without tournament locks.
 * 
 *    - IN-WAR MODE (Fuyuki Holy Grail War Theater):
 *      The clandestine deathmatch fought in secret across ALL Discord channels.
 *      Active Masters conceal Bounded Field traps, dispatch familiars, leak intel,
 *      seek Church asylum, and eliminate rivals for the Greater Grail.
 * 
 * 2. LORE-ACCURATE KILLING PERMITTED FOR WAR MASTERS:
 *    - Masters fighting in the Holy Grail War CAN kill people outside the war / in safe mode
 *      (e.g., civilian collateral casualties, life-force harvesting, crossfire).
 *    - The kill is 100% recorded in the Holy Grail War records:
 *      attacker gains kill count, innocent kill tally, Church bounty, rogue status,
 *      and Fuyuki news coverage.
 * 
 * 3. NO DETRIMENT TO OUTSIDE PLAYERS ("it doesnt effect others anyway"):
 *    - Casualties recorded in the war chronicle are strictly narrative/in-war events.
 *    - Victims outside the war are NEVER locked out of /daily, /summon, or /duel (free battles).
 *    - Their permanent Chaldea Servants, items, and progression remain completely intact.
 */

import { MasterProfile, HolyGrailWarSession } from '../types';
import { getAllWarSessions, findActiveWarSessionForMaster, forfeitWar, getActiveWarSession } from './grailwar';
import { saveMaster } from '../database/service';

export type EnvironmentMode = 'safe' | 'war';

/**
 * Resolves the active environment for a given Master profile.
 * - In DMs (no guildId), defaults strictly to 'safe' with war features disabled.
 * - In a Server (with guildId), evaluates the user's active standing in THAT server's war,
 *   falling back to master.guildEnvironmentModes[guildId] or 'safe'.
 */
export function getMasterEnvironment(
  master: MasterProfile,
  guildIdOrSession?: string | HolyGrailWarSession | null,
  warSession?: HolyGrailWarSession | null
): EnvironmentMode {
  if (!master) return 'safe';

  let guildId: string | undefined;
  let session = warSession;
  if (typeof guildIdOrSession === 'string') {
    guildId = guildIdOrSession.trim();
  } else if (guildIdOrSession && typeof guildIdOrSession === 'object') {
    session = guildIdOrSession;
  }

  // If in DMs (no guildId) and no session passed, strictly default to Safe Mode
  if (!guildId && !session) {
    return 'safe';
  }

  // If a guildId is present, evaluate strictly for this guild
  if (guildId) {
    // 1. Check if the user is an active, alive participant in this guild's active war
    const guildWar = session || getActiveWarSession(guildId);
    if (guildWar && guildWar.status === 'active' && guildWar.participants) {
      const part = guildWar.participants[master.discordId] ||
        Object.values(guildWar.participants).find(x => x.discordId === master.discordId);
      if (part && part.isAlive) {
        return 'war';
      }
    }

    // 2. Check if the master has an explicit guildEnvironmentModes entry for this server
    if (master.guildEnvironmentModes && master.guildEnvironmentModes[guildId]) {
      return master.guildEnvironmentModes[guildId];
    }

    // Defaults to safe mode in this guild
    return 'safe';
  }

  // Fallback when session object was provided directly without guildId
  if (session && session.participants) {
    const part = session.participants[master.discordId] ||
      Object.values(session.participants).find(x => x.discordId === master.discordId);
    if (part && part.isAlive) {
      return 'war';
    }
  }

  return master.environmentMode || 'safe';
}

/**
 * Toggles a Master's environment between Safe Mode and War Mode for a specific server.
 * If switching to Safe Mode while actively enrolled in that server's war, forfeits that participant slot only.
 */
export function setMasterEnvironment(
  master: MasterProfile,
  mode: EnvironmentMode,
  preferredGuildId?: string
): MasterProfile {
  if (preferredGuildId && typeof preferredGuildId === 'string' && preferredGuildId.trim().length > 0) {
    const gKey = preferredGuildId.trim();
    if (!master.guildEnvironmentModes) {
      master.guildEnvironmentModes = {};
    }
    master.guildEnvironmentModes[gKey] = mode;

    if (mode === 'safe') {
      const activeWar = getActiveWarSession(gKey);
      if (activeWar && activeWar.participants) {
        const p = activeWar.participants[master.discordId] ||
          Object.values(activeWar.participants).find(x => x.discordId === master.discordId);
        if (p && p.isAlive) {
          forfeitWar(master, activeWar, gKey);
        }
      }
      const hasOtherWar = Object.entries(master.guildEnvironmentModes).some(
        ([gid, m]) => gid !== gKey && m === 'war'
      );
      if (!hasOtherWar) {
        master.environmentMode = 'safe';
      }
    } else {
      master.environmentMode = 'war';
    }
  } else {
    master.environmentMode = mode;
  }

  return master;
}

/**
 * Verifies if a Master can claim their daily allowance.
 * ALWAYS returns true: Safe mode and outside players are never locked out of dailies.
 */
export function canAccessDaily(_master: MasterProfile): boolean {
  return true;
}

/**
 * Verifies if a Master can summon Servants into their Chaldea vault.
 * ALWAYS returns true: Chaldea summoning exists outside the Fuyuki War conflict.
 */
export function canAccessSummon(_master: MasterProfile): boolean {
  return true;
}

/**
 * Verifies if a Master can participate in Free Battle / Friendly Sparring.
 * Safe Mode masters (and eliminated/withdrawn Masters in the current server) can access Free Battles.
 * Active Holy Grail War contenders in the current server cannot access Free Battles.
 */
export function canAccessFreeBattle(
  master: MasterProfile,
  guildIdOrSession?: string | HolyGrailWarSession | null,
  warSession?: HolyGrailWarSession | null
): boolean {
  const mode = getMasterEnvironment(master, guildIdOrSession, warSession);
  if (mode === 'war') {
    let targetWar = warSession;
    if (!targetWar && typeof guildIdOrSession === 'string') {
      targetWar = getActiveWarSession(guildIdOrSession);
    } else if (guildIdOrSession && typeof guildIdOrSession === 'object') {
      targetWar = guildIdOrSession;
    }
    if (targetWar && targetWar.participants) {
      const part = targetWar.participants[master.discordId] ||
        Object.values(targetWar.participants).find(x => x.discordId === master.discordId);
      if (part && part.isAlive) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Checks if a user's casualty status is purely an in-war lore casualty
 * that does not affect their external Chaldea RPG gameplay.
 */
export function isLoreVictimOnly(
  war: HolyGrailWarSession | null | undefined,
  discordId: string,
  username?: string
): boolean {
  if (!war || !war.civilianCasualties || war.civilianCasualties.length === 0) return false;
  const cleanId = discordId.replace(/[<@!>]/g, '').trim();
  const uLower = (username || '').toLowerCase();

  return war.civilianCasualties.some(c => {
    const matchId = c.id === cleanId || c.id === discordId;
    const matchName = uLower && c.name.toLowerCase().includes(uLower);
    return matchId || matchName;
  });
}

export { forfeitWar, attemptJoinWar } from './grailwar';

/**
 * Checks if a user is an active, living participant in an ongoing Holy Grail War in the target server.
 * Tactical war actions (patrols, wards, traps, familiars, asylum, etc.) are strictly forbidden for civilians or in DMs.
 */
export function checkWarActionPermission(
  master: MasterProfile | null | undefined,
  war: HolyGrailWarSession | null | undefined,
  discordId: string,
  guildId?: string
): { allowed: boolean; reason?: 'civilian' | 'eliminated' | 'no_war' | 'dm'; message: string } {
  // If in DMs (no guildId), war actions are strictly server-exclusive
  if (!guildId) {
    return {
      allowed: false,
      reason: 'dm',
      message: '🕊️ **Server-Exclusive War:** Holy Grail War operations (patrols, traps, wards, familiars, sanctuary) must be conducted inside a Discord server where a tournament is taking place.'
    };
  }

  // 1. Locate the true active war session strictly for this guild
  const targetWar = war || (guildId ? getActiveWarSession(guildId) : null);
  const uP = targetWar?.participants
    ? (targetWar.participants[discordId] || Object.values(targetWar.participants).find(p => p.discordId === discordId))
    : undefined;

  // 2. Is the Holy Grail War currently active in this server?
  if (!targetWar || targetWar.status !== 'active') {
    return {
      allowed: false,
      reason: 'no_war',
      message: '🕊️ **No Active War in Server:** The Holy Grail War is not currently active in this server. Everyone outside an active tournament is a peaceful civilian. Tactical war actions cannot be used until a tournament begins!'
    };
  }

  // 3. Auto-heal master.guildEnvironmentModes if user is an active participant in this server
  if (uP && master && guildId) {
    if (!master.guildEnvironmentModes) master.guildEnvironmentModes = {};
    if (master.guildEnvironmentModes[guildId] !== 'war') {
      master.guildEnvironmentModes[guildId] = 'war';
      master.environmentMode = 'war';
      saveMaster(master).catch(() => {});
    }
  }

  // 4. Is the user enrolled as an active war participant in this server with contracted servants?
  const hasServant = !!(master?.servants && master.servants.length > 0);
  const currentEnv = master ? getMasterEnvironment(master, guildId, targetWar) : 'safe';
  const isEnrolledInWar = (currentEnv === 'war' || !!uP) && !!uP;

  if (!isEnrolledInWar || !hasServant || !uP) {
    return {
      allowed: false,
      reason: 'civilian',
      message: '📜 **Civilian Notice:** You cannot use this option because you are currently a civilian outside the Holy Grail War in this server.\n\nOnly registered Masters actively participating in this server\'s ongoing Holy Grail War can conduct tactical patrols, deploy workshop wards, dispatch familiars, anchor bounded fields, or claim church sanctuary.\n\n🕊️ *Peaceful Chaldea activities (`/daily`, `/summon`, and `/duel mode:free`) remain open to you!*'
    };
  }

  // 5. Is the participant alive?
  if (!uP.isAlive) {
    return {
      allowed: false,
      reason: 'eliminated',
      message: '💀 **Eliminated Master Notice:** You cannot use this option because your Servant\'s Saint Graph has been dissolved and you have fallen in this server\'s Holy Grail War.\n\nDeceased Masters cannot conduct tactical war actions until the next tournament begins.\n\n🕊️ *Peaceful Chaldea activities (`/daily`, `/summon`, and `/duel mode:free`) remain open to you!*'
    };
  }

  return { allowed: true, message: '' };
}

