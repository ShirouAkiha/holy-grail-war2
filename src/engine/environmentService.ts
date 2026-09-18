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

export type EnvironmentMode = 'safe' | 'war';

/**
 * Resolves the active environment for a given Master profile.
 * Defaults to 'safe' if not explicitly enrolled in the active war session.
 */
export function getMasterEnvironment(
  master: MasterProfile,
  warSession?: HolyGrailWarSession | null
): EnvironmentMode {
  if (master.environmentMode) {
    return master.environmentMode;
  }

  // If master is an active, living participant in the active war, default to 'war'
  if (warSession && warSession.participants) {
    const part = warSession.participants[master.discordId];
    if (part && part.isAlive) {
      return 'war';
    }
  }

  // Otherwise, all players default to Safe Mode (Outside the War)
  return 'safe';
}

/**
 * Toggles a Master's environment between Safe Mode (Outside War) and In-War Mode.
 */
export function setMasterEnvironment(
  master: MasterProfile,
  mode: EnvironmentMode
): MasterProfile {
  master.environmentMode = mode;
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
 * ALWAYS returns true: Casual duels and friendly matches carry zero tournament stakes.
 */
export function canAccessFreeBattle(_master: MasterProfile): boolean {
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
