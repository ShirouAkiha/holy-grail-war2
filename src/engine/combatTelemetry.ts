import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export interface CardStrikeDetail {
  cardIndex: number;
  cardType: 'Buster' | 'Arts' | 'Quick' | 'NP';
  isCrit: boolean;
  critChancePercent?: number;
  rawMultiplier?: number;
  classAdvantage?: number;
  damageDealt: number;
  blockedBy?: 'evade' | 'invincible' | 'anti_purge';
  damageCutAbsorbed?: number;
  npRefund?: number;
  starsGenerated?: number;
  defenderHpBefore?: number;
  defenderHpAfter?: number;
}

export interface SkillActivationDetail {
  skillName: string;
  skillIndex?: number;
  description?: string;
  cooldownPlaced: number;
  effects: string[];
}

export interface DefensiveTriggerDetail {
  type: 'evade' | 'invincible' | 'anti_purge' | 'damage_cut' | 'guts' | 'on_defense_heal' | 'avenger';
  label: string;
  value?: number;
  remainingChargesOrTurns?: number;
}

export interface TurnTelemetryEntry {
  turnNumber: number;
  round: number;
  timestamp: Date;
  actorName: string;
  actorClass?: string;
  actorUserId?: string;
  targetName: string;
  targetClass?: string;
  targetUserId?: string;
  isBossPhase?: boolean;

  // HP Dynamics
  actorHpBefore: number;
  actorHpAfter: number;
  actorMaxHp: number;
  targetHpBefore: number;
  targetHpAfter: number;
  targetMaxHp: number;

  // Pre-card actions
  skillsUsed: SkillActivationDetail[];
  commandSealUsed?: string;
  allianceAssistUsed?: boolean;

  // Strike Execution
  cardsSequence: ('Buster' | 'Arts' | 'Quick' | 'NP' | string)[];
  cardStrikes: CardStrikeDetail[];
  totalDamage: number;
  totalNpGained: number;
  totalStarsGained: number;
  quote?: string;

  // Defensive reactions during turn
  defensesTriggered: DefensiveTriggerDetail[];

  // Turn End status
  chainsTriggered?: string[];
  actorBuffsSummary?: string[];
  targetBuffsSummary?: string[];
  wasTargetVanquished?: boolean;
}

/**
 * Builds a comprehensive, single-turn granular embed formatted strictly within Discord's limits.
 */
export function buildTurnTelemetryEmbed(
  entry: TurnTelemetryEntry,
  pageIndex: number,
  totalPages: number,
  allCombatantsOverview?: string
): EmbedBuilder {
  const isBoss = Boolean(entry.isBossPhase);
  const color = isBoss ? 0xd946ef : 0x38bdf8;

  const actorTag = entry.actorUserId ? `<@${entry.actorUserId}>` : entry.actorName;
  const targetTag = entry.targetUserId ? `<@${entry.targetUserId}>` : entry.targetName;

  const embed = new EmbedBuilder()
    .setTitle(`📜 COMBAT DOSSIER — ROUND ${entry.round} • TURN #${entry.turnNumber}`)
    .setColor(color)
    .setFooter({
      text: `Holy Grail War Tactical Telemetry • Turn ${pageIndex + 1} of ${totalPages} • Real-Time Engine Log`
    });

  // Section 1: Overview & Actor / Target Identity
  const actorClassStr = entry.actorClass ? ` (${entry.actorClass})` : '';
  const targetClassStr = entry.targetClass ? ` (${entry.targetClass})` : '';
  const quoteLine = entry.quote ? `\n> 💬 ❝ ***“${entry.quote}”*** ❞` : '';

  embed.setDescription(
    `⚔️ **Actor:** **${entry.actorName}**${actorClassStr} [${actorTag}]\n` +
    `🎯 **Target:** **${entry.targetName}**${targetClassStr} [${targetTag}]${quoteLine}\n` +
    `──────────────────────────────────────────────`
  );

  // Section 2: Health Dynamics
  const targetHpDelta = entry.targetHpAfter - entry.targetHpBefore;
  const targetPctBefore = Math.max(0, Math.min(100, Math.round((entry.targetHpBefore / entry.targetMaxHp) * 100)));
  const targetPctAfter = Math.max(0, Math.min(100, Math.round((entry.targetHpAfter / entry.targetMaxHp) * 100)));

  const actorPct = Math.max(0, Math.min(100, Math.round((entry.actorHpAfter / entry.actorMaxHp) * 100)));

  let hpFieldText = 
    `• **Target:** \`${Math.round(entry.targetHpBefore).toLocaleString()} HP\` (${targetPctBefore}%) ➔ ` +
    `\`${Math.round(entry.targetHpAfter).toLocaleString()} HP\` (${targetPctAfter}%) ` +
    `[**${targetHpDelta >= 0 ? `+${targetHpDelta.toLocaleString()}` : `${targetHpDelta.toLocaleString()}`} HP**]\n` +
    `• **Actor:** \`${Math.round(entry.actorHpAfter).toLocaleString()} / ${entry.actorMaxHp.toLocaleString()} HP\` (${actorPct}%)`;

  if (entry.wasTargetVanquished) {
    hpFieldText += `\n💀 **Status:** Vanquished / Incapacitated!`;
  }

  embed.addFields({
    name: '❤️ Health Dynamics Before & After',
    value: hpFieldText.slice(0, 1024)
  });

  // Section 3: Tactical Skills & Pre-Attack Actions
  const skillsList: string[] = [];
  if (entry.commandSealUsed) {
    skillsList.push(`🔱 **Command Seal Invocation:** ${entry.commandSealUsed}`);
  }
  if (entry.allianceAssistUsed) {
    skillsList.push(`🛡️ **Alliance Tag Assist:** +25% ATK & +15 Critical Stars coordinated flank strike`);
  }
  if (entry.skillsUsed && entry.skillsUsed.length > 0) {
    entry.skillsUsed.forEach(s => {
      const cdStr = s.cooldownPlaced > 0 ? ` (Cooldown: ${s.cooldownPlaced}T)` : '';
      const effStr = s.effects.length > 0 ? s.effects.join(' • ') : (s.description || 'Activated');
      skillsList.push(`✨ **${s.skillName}**${cdStr}: ${effStr}`);
    });
  }

  if (skillsList.length > 0) {
    embed.addFields({
      name: '✨ Tactical Skills & Master Invocations',
      value: skillsList.join('\n').slice(0, 1024)
    });
  }

  // Section 4: Card-by-Card Strike Breakdown
  if (entry.cardStrikes && entry.cardStrikes.length > 0) {
    const cardEmojiMap: Record<string, string> = {
      Buster: '🔴 Buster',
      Arts: '🔵 Arts',
      Quick: '🟢 Quick',
      NP: '💥 Noble Phantasm'
    };

    const strikesText = entry.cardStrikes.map(cs => {
      const cardTitle = cardEmojiMap[cs.cardType] || cs.cardType;
      const critTag = cs.isCrit ? ' 💥 **CRITICAL HIT! (2x)**' : (cs.critChancePercent ? ` *(Crit: ${cs.critChancePercent}%)*` : '');
      const blockedTag = cs.blockedBy === 'anti_purge'
        ? ' 👑 **(Anti-Purge Blocked • 0 DMG)**'
        : cs.blockedBy === 'invincible'
        ? ' ✨ **(Invincible Blocked • 0 DMG)**'
        : cs.blockedBy === 'evade'
        ? ' 💨 **(Evaded • 0 DMG)**'
        : '';

      const cutTag = cs.damageCutAbsorbed ? ` *(🛡️ ${cs.damageCutAbsorbed.toLocaleString()} DMG Cut)*` : '';
      const npTag = (cs.npRefund && cs.npRefund > 0) ? ` • +${cs.npRefund}% NP` : '';
      const starTag = (cs.starsGenerated && cs.starsGenerated > 0) ? ` • +${cs.starsGenerated} Stars` : '';

      return `**#${cs.cardIndex + 1}: ${cardTitle}**${critTag}${blockedTag}:\n` +
             `  └─ Dealt **${cs.damageDealt.toLocaleString()} DMG**${cutTag}${npTag}${starTag}`;
    }).join('\n');

    const chainStr = (entry.chainsTriggered && entry.chainsTriggered.length > 0)
      ? `\n⛓️ **Chains:** ${entry.chainsTriggered.join(' • ')}`
      : '';

    const summaryLine = `\n📊 **Turn Total:** **${entry.totalDamage.toLocaleString()} DMG** dealt • **+${entry.totalNpGained}% NP** • **+${entry.totalStarsGained} Stars**${chainStr}`;

    embed.addFields({
      name: `🎴 Sequence: [${entry.cardsSequence.join(' ➔ ')}]`,
      value: (strikesText + summaryLine).slice(0, 1024)
    });
  } else if (entry.totalDamage > 0) {
    embed.addFields({
      name: '⚔️ Strike Execution',
      value: `• Dealt **${entry.totalDamage.toLocaleString()} DMG** to ${entry.targetName}\n• +${entry.totalNpGained}% NP gained • +${entry.totalStarsGained} Critical Stars generated`
    });
  }

  // Section 5: Defenses, Mitigations & Reactions
  if (entry.defensesTriggered && entry.defensesTriggered.length > 0) {
    const defenseLines = entry.defensesTriggered.map(d => `• ${d.label}`);
    embed.addFields({
      name: '🛡️ Defenses, Mitigations & Reactions Triggered',
      value: defenseLines.join('\n').slice(0, 1024)
    });
  }

  // Section 6: Active Buffs Remaining at End of Turn
  const statusLines: string[] = [];
  if (entry.actorBuffsSummary && entry.actorBuffsSummary.length > 0) {
    statusLines.push(`**${entry.actorName}:** ${entry.actorBuffsSummary.join(' • ')}`);
  }
  if (entry.targetBuffsSummary && entry.targetBuffsSummary.length > 0) {
    statusLines.push(`**${entry.targetName}:** ${entry.targetBuffsSummary.join(' • ')}`);
  }

  if (statusLines.length > 0) {
    embed.addFields({
      name: '🔮 Active Effects & Statuses at Turn End',
      value: statusLines.join('\n\n').slice(0, 1024)
    });
  }

  // Optional Section 7: Overall Combatant Health & Gauge Overview
  if (allCombatantsOverview) {
    embed.addFields({
      name: '📊 Arena Combatants Overview',
      value: allCombatantsOverview.slice(0, 1024)
    });
  }

  return embed;
}

/**
 * Builds interactive navigation buttons with strictly unique IDs to avoid duplicate ID errors.
 */
export function buildTurnTelemetryComponents(
  page: number,
  totalPages: number,
  idPrefix: string = 'combat_log_nav'
): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${idPrefix}_first`)
      .setLabel('⏮️ First')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`${idPrefix}_prev_${Math.max(0, page - 1)}`)
      .setLabel('◀ Prev Turn')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`${idPrefix}_indicator`)
      .setLabel(`Turn ${page + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`${idPrefix}_next_${Math.min(totalPages - 1, page + 1)}`)
      .setLabel('Next Turn ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId(`${idPrefix}_latest`)
      .setLabel('⏭️ Latest')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1)
  );

  const refreshRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${idPrefix}_refresh_${page}`)
      .setLabel('🔄 Refresh Telemetry')
      .setStyle(ButtonStyle.Success)
  );

  return [row, refreshRow];
}
