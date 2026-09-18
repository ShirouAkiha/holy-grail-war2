/**
 * ============================================================================
 * SAINT GRAPH PROJECTION & CLONE SERVANT SYSTEM (ISOLATED ENGINE)
 * ============================================================================
 * 
 * DESIGN PRINCIPLES:
 * 1. ZERO SCARCITY BOTTLENECKS:
 *    Multiple Masters across the Discord server can summon and build their own
 *    projections of the same Heroic Spirit (Artoria, Gilgamesh, Jeanne, etc.).
 * 
 * 2. DUAL-STATE ARCHITECTURE:
 *    - Permanent "Master Roster Vault" (Out-of-War State):
 *      Never wiped or lost on war defeat or season resets. Holds levels, EXP,
 *      allocated stat points, equipped CEs, custom quotes, avatars, and bond.
 *    - Instanced "War Participant" (In-War State):
 *      A projected combat snapshot deployed to the active Holy Grail War season.
 *      If eliminated or executed in the war, only the season participant is
 *      marked deceased. The Master's permanent Servant remains 100% safe in Chaldea.
 * 
 * 3. RETRO-COMPATIBLE & SAFE:
 *    This file acts as a standalone facade and feature flag. If this system is
 *    ever disabled, setting ENABLE_PROJECTED_SAINT_GRAPHS = false restores
 *    the original 1-servant-per-server Throne lock instantly without touching core code.
 */

import {
  MasterProfile,
  MasterServantInstance,
  ServantTemplate,
  WarMasterParticipant,
  HolyGrailWarSession
} from '../types';
import { getAllThroneServants } from '../database/service';

/**
 * Feature Toggle for Projected / Clone Servants.
 * Set to true to allow multiple Masters to summon identical Heroic Spirits
 * and safeguard permanent Servant progression across seasonal Grail Wars.
 */
export const ENABLE_PROJECTED_SAINT_GRAPHS = true;

/**
 * Maximum number of permanent Servants a single Master can hold in their vault.
 */
export const MAX_MASTER_SERVANT_ROSTER = 10;

/**
 * Returns the pool of Servants available to be summoned by a specific Master.
 * 
 * In Projected Saint Graph mode:
 * - The entire Throne of Heroes is accessible to every Master.
 * - The only restriction is that a single Master cannot contract the exact same
 *   Heroic Spirit template twice in their own roster.
 * 
 * If the feature flag is disabled:
 * - Falls back to server-wide global exclusivity (only 1 of each servant exists across all players).
 */
export function getAvailableProjectionServants(
  master: MasterProfile,
  allServants: ServantTemplate[],
  contractedTemplateIdsServerWide: Set<string>
): ServantTemplate[] {
  if (!ENABLE_PROJECTED_SAINT_GRAPHS) {
    return allServants.filter(s => !contractedTemplateIdsServerWide.has(s.id));
  }

  // Under Saint Graph Projection rules:
  // Check which templates this specific Master ALREADY owns
  const ownedTemplateIdsByMaster = new Set<string>(
    (master.servants || []).map(s => s.templateId)
  );

  return allServants.filter(s => !ownedTemplateIdsByMaster.has(s.id));
}

/**
 * Creates a unique Projected Saint Graph instance for a Master.
 */
export function createProjectedServantInstance(
  master: MasterProfile,
  template: ServantTemplate
): MasterServantInstance {
  const instanceId = `proj_${template.id}_${master.discordId}_${Date.now()}`;

  return {
    id: instanceId,
    masterId: master.id,
    templateId: template.id,
    level: 1,
    experience: 0,
    allocatedStats: {
      strength: 0,
      endurance: 0,
      agility: 0,
      mana: 0,
      luck: 0
    },
    availableStatPoints: 10,
    skillLevels: [1, 1, 1],
    customQuotes: {
      summon: template.summonQuote,
      battleStart: template.battleStartQuote,
      noblePhantasm: template.noblePhantasm?.chant,
      victory: template.victoryQuote,
      defeat: template.defeatQuote
    },
    bondLevel: 1,
    template
  };
}

/**
 * Generates an instanced War Participant snapshot from a Master's permanent Servant.
 * Ensures the war state tracks volatile parameters (HP, traps, location, seals)
 * while isolating the permanent MasterServantInstance from destruction.
 */
export function projectServantToWarParticipant(
  master: MasterProfile,
  servant: MasterServantInstance
): WarMasterParticipant {
  const template = servant.template || getAllThroneServants().find(s => s.id === servant.templateId);
  const baseHp = template?.baseHp || 12000;
  const allocEnd = servant.allocatedStats?.endurance || 0;
  const ceHp = servant.equippedCe?.hpBonus || 0;
  const calculatedMaxHp = Math.round(baseHp + allocEnd * 150 + ceHp);

  const servantName = servant.nickname || template?.name || 'Heroic Spirit';
  const servantClass = template?.servantClass || 'Saber';
  const avatarUrl = servant.avatarUrl || template?.avatarUrl || master.avatarUrl || '';

  return {
    discordId: master.discordId,
    username: master.username,
    servantId: servant.id,
    servantName,
    servantClass,
    avatarUrl,
    currentHp: calculatedMaxHp,
    maxHp: calculatedMaxHp,
    commandSeals: master.commandSeals ?? 3,
    isAlive: true,
    kills: 0,
    boundedField: 'none',
    inSanctuary: false,
    autoEvadeEnabled: false,
    autoConsumeCommandSeal: false
  };
}

/**
 * Sanitizes and protects the permanent Master roster upon war defeat or casualty.
 * 
 * In canonical Grail War, elimination marks the participant as deceased in the war session.
 * This helper guarantees that the Master's permanent roster in `master.servants`
 * remains 100% intact, fully trained, and ready for future tournaments or friendly duels.
 */
export function preservePermanentRosterOnWarDefeat(
  master: MasterProfile,
  _eliminatedServantId: string
): { preserved: boolean; activeServantName: string } {
  const activeServant = (master.servants || []).find(s => s.id === master.activeServantId) || master.servants?.[0];
  const name = activeServant?.nickname || activeServant?.template?.name || 'Servant';

  // We explicitly DO NOT delete or strip master.servants.
  // The Servant remains safely in the Master's permanent roster.
  return {
    preserved: true,
    activeServantName: name
  };
}

/**
 * Formats a display label for a Servant in battle or rosters,
 * distinguishing different players' projections of the same Heroic Spirit.
 * Example: "Master Kiritsugu's Artoria [King of Knights]" vs "Master Shirou's Artoria"
 */
export function formatProjectedServantDisplay(
  masterUsername: string,
  servant: MasterServantInstance
): string {
  const baseName = servant.template?.name || 'Heroic Spirit';
  const customNick = servant.nickname;
  const title = servant.template?.title ? ` [${servant.template.title}]` : '';

  if (customNick && customNick !== baseName) {
    return `${masterUsername}'s ${customNick} (${baseName})${title}`;
  }
  return `${masterUsername}'s ${baseName}${title}`;
}

/**
 * Validates whether a Master can deploy a specific Servant to an active war session.
 */
export function canDeployServantToWar(
  warSession: HolyGrailWarSession | null | undefined,
  masterId: string
): { canDeploy: boolean; reason?: string } {
  if (!warSession) {
    return { canDeploy: true };
  }

  const existingParticipant = warSession.participants[masterId];
  if (existingParticipant && !existingParticipant.isAlive) {
    return {
      canDeploy: false,
      reason: 'You were already eliminated from the current Holy Grail War season. Your Servant is resting in Chaldea until the next war season begins!'
    };
  }

  return { canDeploy: true };
}
