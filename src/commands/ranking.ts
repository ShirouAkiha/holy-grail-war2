import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  User,
  ComponentType
} from 'discord.js';
import { getMasterRankings, getOrCreateMaster, getGuildDisplayName } from '../database/service';
import { MasterRankingResult, MasterRankingEntry } from '../types';

export const data = new SlashCommandBuilder()
  .setName('ranking')
  .setDescription('🏆 Masters Leaderboards — Server & Global rankings by Grail War Wins & Battle Wins')
  .addStringOption(opt =>
    opt
      .setName('scope')
      .setDescription('Select Leaderboard Scope (Server or Global Chaldea)')
      .setRequired(false)
      .addChoices(
        { name: '🏰 Server Masters (This Discord Server)', value: 'server' },
        { name: '🌐 Global Masters (All Servers / Chaldea)', value: 'global' }
      )
  )
  .addStringOption(opt =>
    opt
      .setName('category')
      .setDescription('Ranking Metric')
      .setRequired(false)
      .addChoices(
        { name: '🏆 Holy Grail War Victories', value: 'grail_war_wins' },
        { name: '⚔️ Total Battle Wins (All Modes)', value: 'all_battle_wins' },
        { name: '👑 Grand Magus Overall Index', value: 'overall' }
      )
  )
  .addUserOption(opt =>
    opt
      .setName('target')
      .setDescription('Check specific Master rank and standing')
      .setRequired(false)
  );

/**
 * Builds the rich Discord Embed for Server or Global rankings.
 */
export function buildRankingEmbed(
  res: MasterRankingResult,
  requestedUser?: { id: string; username: string }
): EmbedBuilder {
  const isServer = res.scope === 'server';
  const categoryLabel =
    res.category === 'grail_war_wins'
      ? '🏆 Holy Grail War Victories'
      : res.category === 'all_battle_wins'
      ? '⚔️ Total Battle Wins (PvP Duels & War Kills)'
      : '👑 Grand Magus Overall Index';

  const embed = new EmbedBuilder()
    .setTitle(isServer ? `🏰 SERVER MASTERS LEADERBOARD` : `🌐 GLOBAL MASTERS LEADERBOARD`)
    .setDescription(
      `**Scope:** ${isServer ? `🏰 ${res.serverName || 'Server'}` : '🌐 Throne of Heroes (Global Chaldea Network)'}\n` +
      `**Category:** ${categoryLabel}\n` +
      `**Total Registered Masters:** ${res.totalMasters}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    )
    .setColor(isServer ? 0xd4af37 : 0x38bdf8)
    .setTimestamp();

  if (res.rankings.length === 0) {
    embed.addFields({
      name: 'No Masters Recorded',
      value: 'No Masters have claimed victories in this sector yet. Perform `/summon` and challenge rivals in `/duel` or `/grailwar`!'
    });
  } else {
    // Build Top 10 list
    const lines = res.rankings.map(e => {
      const medal =
        e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : `\`#${e.rank.toString().padStart(2, ' ')}\``;
      
      const servantSnippet = e.activeServantName
        ? ` • *${e.activeServantName}* [${e.activeServantClass} Lv.${e.activeServantLevel}]`
        : '';

      const winrateSnippet = e.winRate > 0 ? ` (${e.winRate}% WR)` : '';

      if (res.category === 'grail_war_wins') {
        return (
          `${medal} **${e.master.username}**${servantSnippet}\n` +
          `   └ 🏆 **${e.grailWarWins} Grail Wins** • ⚔️ ${e.battleWins} Battle Wins${winrateSnippet} • 🔴 ${e.commandSeals}/3 Seals`
        );
      } else if (res.category === 'all_battle_wins') {
        return (
          `${medal} **${e.master.username}**${servantSnippet}\n` +
          `   └ ⚔️ **${e.battleWins} Total Battle Wins** (🤺 ${e.duelsWon} Duels, 💀 ${e.servantKills} Kills) • 🏆 ${e.grailWarWins} Grail Wins`
        );
      } else {
        const score = (e.grailWarWins * 1000) + (e.battleWins * 100) + (e.duelsWon * 10);
        return (
          `${medal} **${e.master.username}**${servantSnippet}\n` +
          `   └ 👑 **${score.toLocaleString()} PTS** • 🏆 ${e.grailWarWins} Grail Wins • ⚔️ ${e.battleWins} Battle Wins${winrateSnippet}`
        );
      }
    });

    // Split lines into chunks of at most 5 entries or 850 characters each to strictly conform to Discord's 1024-character field limit
    let currentChunk: string[] = [];
    let currentLen = 0;
    let chunkIndex = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLen = line.length + 2;
      if ((currentChunk.length >= 5 || currentLen + lineLen > 850) && currentChunk.length > 0) {
        embed.addFields({
          name: chunkIndex === 1 ? '🏅 TOP MASTERS ROSTER' : `🏅 TOP MASTERS (Cont. #${(chunkIndex - 1) * 5 + 1}+)`,
          value: currentChunk.join('\n\n')
        });
        currentChunk = [];
        currentLen = 0;
        chunkIndex++;
      }
      currentChunk.push(line);
      currentLen += lineLen;
    }

    if (currentChunk.length > 0) {
      embed.addFields({
        name: chunkIndex === 1 ? '🏅 TOP MASTERS ROSTER' : `🏅 TOP MASTERS (Cont. #${(chunkIndex - 1) * 5 + 1}+)`,
        value: currentChunk.join('\n\n')
      });
    }
  }

  // Add User Standing highlight footer / field if available
  if (res.userRank) {
    embed.addFields({
      name: `📍 Your Standing (${requestedUser?.username || 'You'})`,
      value:
        `• **Rank:** **#${res.userRank.rank}** of ${res.totalMasters} (${isServer ? 'Server' : 'Global'})\n` +
        `• **Percentile:** Top **${100 - res.userRank.percentile + 1}%** of all Masters\n` +
        `• **Record:** 🏆 **${res.userRank.grailWarWins} Grail Wins** | ⚔️ **${res.userRank.battleWins} Battle Wins** (🤺 ${res.userRank.duelsWon}W, 💀 ${res.userRank.servantKills} Kills)`
    });
  }

  embed.setFooter({
    text: `FATE: PLEXVERSE • Use buttons below to switch Scope (Server/Global) and Ranking Category`
  });

  return embed;
}

/**
 * Interactive button rows for switching Scope and Category.
 */
export function buildRankingButtons(
  currentScope: 'server' | 'global',
  currentCategory: 'grail_war_wins' | 'all_battle_wins' | 'overall'
): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`rank_scope_server:${currentCategory}`)
      .setLabel('🏰 Server Ranking')
      .setStyle(currentScope === 'server' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`rank_scope_global:${currentCategory}`)
      .setLabel('🌐 Global Ranking')
      .setStyle(currentScope === 'global' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`rank_me:${currentScope}:${currentCategory}`)
      .setLabel('👤 My Standing')
      .setStyle(ButtonStyle.Success)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`rank_cat_grail:${currentScope}`)
      .setLabel('🏆 Grail War Wins')
      .setStyle(currentCategory === 'grail_war_wins' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`rank_cat_battle:${currentScope}`)
      .setLabel('⚔️ Battle Wins (All)')
      .setStyle(currentCategory === 'all_battle_wins' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`rank_cat_overall:${currentScope}`)
      .setLabel('👑 Grand Magus Score')
      .setStyle(currentCategory === 'overall' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  return [row1, row2];
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const scope = (interaction.options.getString('scope') as 'server' | 'global') || 'server';
  const category = (interaction.options.getString('category') as 'grail_war_wins' | 'all_battle_wins' | 'overall') || 'grail_war_wins';
  const targetUser = interaction.options.getUser('target') || interaction.user;
  const guildId = interaction.guildId || 'guild-fuyuki';

  // Ensure calling master exists
  await getOrCreateMaster(interaction.user.id, interaction.user.username);

  const rankingData = getMasterRankings({
    scope,
    guildId,
    category,
    limit: 10,
    targetUserId: targetUser.id
  });

  const embed = buildRankingEmbed(rankingData, { id: targetUser.id, username: targetUser.username });
  const components = buildRankingButtons(scope, category);

  const response = await interaction.reply({
    embeds: [embed],
    components,
    fetchReply: true
  });

  // Attach collector for interactive button toggling
  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 180000 // 3 minutes
  });

  let activeScope = scope;
  let activeCategory = category;

  collector.on('collect', async btnInteraction => {
    if (btnInteraction.user.id !== interaction.user.id) {
      await btnInteraction.reply({
        content: '⚠️ You can only navigate rankings for your own invoked menu. Run `/ranking` to explore!',
        ephemeral: true
      });
      return;
    }

    const [action, p1, p2] = btnInteraction.customId.split(':');

    if (action === 'rank_scope_server') {
      activeScope = 'server';
      if (p1) activeCategory = p1 as any;
    } else if (action === 'rank_scope_global') {
      activeScope = 'global';
      if (p1) activeCategory = p1 as any;
    } else if (action === 'rank_cat_grail') {
      activeCategory = 'grail_war_wins';
      if (p1) activeScope = p1 as any;
    } else if (action === 'rank_cat_battle') {
      activeCategory = 'all_battle_wins';
      if (p1) activeScope = p1 as any;
    } else if (action === 'rank_cat_overall') {
      activeCategory = 'overall';
      if (p1) activeScope = p1 as any;
    } else if (action === 'rank_me') {
      if (p1) activeScope = p1 as any;
      if (p2) activeCategory = p2 as any;
    }

    const updatedData = getMasterRankings({
      scope: activeScope,
      guildId,
      category: activeCategory,
      limit: 10,
      targetUserId: btnInteraction.user.id
    });

    const newEmbed = buildRankingEmbed(updatedData, { id: btnInteraction.user.id, username: btnInteraction.user.username });
    const newButtons = buildRankingButtons(activeScope, activeCategory);

    await btnInteraction.update({
      embeds: [newEmbed],
      components: newButtons
    });
  });
}
