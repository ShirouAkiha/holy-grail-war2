import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  MessageFlags 
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { 
  getOrInitWarSession, 
  getHealingStatus
} from '../engine/grailwar';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('👤 View Master profile, kills, duel record, contracted Servant & defenses')
  .addBooleanOption(opt =>
    opt
      .setName('public')
      .setDescription('Post your Master profile card publicly to the channel instead of ephemeral')
      .setRequired(false)
  );

export function renderHpBar(percent: number): string {
  const totalBlocks = 14;
  const filled = Math.max(0, Math.min(totalBlocks, Math.round((percent / 100) * totalBlocks)));
  const empty = totalBlocks - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

export function buildProfileEmbed(master: any, war: any, lastMsg?: string) {
  const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];
  const userParticipant = war.participants?.[master.discordId];

  if (!activeServant || !userParticipant) {
    return new EmbedBuilder()
      .setTitle('👤 Master Dossier | No Servant Contracted')
      .setDescription('❌ You have not entered the Holy Grail War yet. Use `/summon` to summon a Heroic Spirit and establish your contract.')
      .setColor(0x71717a);
  }

  const ward = userParticipant.boundedField || 'none';
  const autoEvade = userParticipant.autoEvadeEnabled !== false;
  const seals = userParticipant.commandSeals ?? master.commandSeals ?? 3;
  const isExposed = userParticipant.isExposed;
  const isUnderSanctuary = userParticipant.inSanctuary || userParticipant.inChurchSanctuary;

  let wardLabel = '🚫 **No Wards Active** *(No perimeter defenses)*';
  if (ward === 'ward') {
    const sChan = (userParticipant as any)?.sanctuaryChannelName ? ` in ${(userParticipant as any).sanctuaryChannelName}` : '';
    wardLabel = `🛡️ **Mage Sanctuary Bounded Field**${sChan} *(Absorbs 60% Ambush DMG & Continuous Auto-Heal)*`;
  } else if (ward === 'alarm') {
    wardLabel = '🚨 **Intrusion Alarm Trap** *(Alerts & Deals 3,000 retaliatory DMG)*';
  }

  // Active channel traps
  const myChannelTraps = (war?.channelTraps || []).filter((t: any) => t.setterMasterId === master.discordId);
  const channelTrapsSummary = myChannelTraps.length > 0
    ? myChannelTraps.map((t: any) => `\`${t.channelName}\` (${t.trapType === 'alarm' ? '🚨 Alarm' : '🩸 Bloodfort'})`).join(', ')
    : 'None *(Select a channel below to anchor)*';

  const sTemplate = activeServant.template || activeServant;
  const servantName = activeServant.nickname || sTemplate.name || activeServant.name || 'Heroic Spirit';
  const servantClass = sTemplate.servantClass || activeServant.servantClass || activeServant.class || userParticipant?.servantClass || 'Saber';

  let classPassive = 'None (Specializes in standard tactical combat)';
  if (servantClass === 'Saber' || servantClass === 'Archer' || servantClass === 'Lancer') {
    classPassive = '👁️ **Instinct / Clairvoyance:** 35% chance to predict ambushes, parrying 80% damage and dealing 1,500 counter DMG.';
  } else if (servantClass === 'Assassin') {
    classPassive = '🕶️ **Presence Concealment:** Completely immune to surprise ambushes. Nullifies strike & counters for 2,500 DMG!';
  } else if (servantClass === 'Berserker') {
    classPassive = '❤️ **Battle Continuation (Guts):** Revives once with 25% Max HP if dealt a fatal blow.';
  }

  const healInfo = getHealingStatus(userParticipant);
  const hpBar = renderHpBar(healInfo.percent);

  const kills = userParticipant.kills ?? master.servantKills ?? 0;
  const duelsWon = master.duelsWon || 0;
  const duelsLost = master.duelsLost || 0;
  const totalDuels = duelsWon + duelsLost;
  const winRate = totalDuels > 0 ? Math.round((duelsWon / totalDuels) * 100) : 0;

  let standingTag = '🟢 Active Competitor';
  if (!userParticipant.isAlive) {
    standingTag = '💀 Dissolved Saint Graph';
  } else if (isUnderSanctuary) {
    standingTag = '🕊️ Under Church Asylum';
  }

  let churchStanding = master.reputationRank || '🕊️ Honorable Neutral';
  if (master.bountyActive && master.bountyRewardSq) {
    churchStanding += ` *(⚠️ 💎 ${master.bountyRewardSq} SQ Bounty Active)*`;
  }

  const embed = new EmbedBuilder()
    .setTitle(`👤 Master Dossier | ${master.username} [${standingTag}]`)
    .setDescription(
      `*(🔒 Confidential Private Dossier — only visible to you)*\n\n` +
      `💠 **Command Seals:** \`${'✦ '.repeat(seals)}${'✧ '.repeat(Math.max(0, 3 - seals))}\` (**${seals}/3**) | 💎 **${master.saintQuartz || 0} SQ** | 🎴 **${master.servants?.length || 1}** Servant(s)\n\n` +
      (lastMsg ? `📢 **Action Outcome:**\n${lastMsg}\n\n` : '') +
      `⚔️ **MASTER COMBAT RECORD & WAR STATUS:**\n` +
      `• **War Standing:** ${standingTag} [${isExposed ? '⚠️ **EXPOSED TO PUBLIC WAR BOARD**' : '🕶️ **Concealed in Shadows**'}]\n` +
      `• **Servant Kills:** 💀 **${kills}** Dissolved\n` +
      `• **Duel Record:** ⚔️ **${duelsWon}W - ${duelsLost}L** (${winRate}% Win Rate)\n` +
      `• **Church Standing:** ${churchStanding}\n\n` +
      `🗡️ **ACTIVE CONTRACTED SERVANT:**\n` +
      `• **Servant:** **${servantName}** (${servantClass})\n` +
      `• **Vitality:** ❤️ [${hpBar}] \`${healInfo.currentHp.toLocaleString()} / ${healInfo.maxHp.toLocaleString()}\` (${healInfo.percent}%) — ${healInfo.statusTag}\n` +
      (healInfo.ritualCooldownSecs > 0 ? `• **Healing Ritual:** ⏳ \`${Math.floor(healInfo.ritualCooldownSecs / 60)}m ${healInfo.ritualCooldownSecs % 60}s remaining\`\n` : `• **Healing Ritual:** ✨ \`Ready (+40% HP)\`\n`) +
      `• **Class Passive:** ${classPassive}\n\n` +
      `🏰 **WORKSHOP DEFENSES:**\n` +
      `• **Bounded Field:** ${wardLabel}\n` +
      `• **Auto-Evacuation:** ${autoEvade ? '🟢 **ON** *(Retreats automatically with Command Seal on lethal strike)*' : '🔴 **OFF**'}\n` +
      `• **Territorial Wards:** ${channelTrapsSummary}\n\n` +
      `*Configure workshop defenses, heal, or click **[Share Public Card]** below to broadcast your profile to the server:*`
    )
    .setColor(isExposed ? 0xef4444 : 0x3b82f6)
    .setFooter({ text: 'Private Master Dossier • Holy Grail War Protocol' });

  if (activeServant.template?.avatarUrl) {
    embed.setThumbnail(activeServant.template.avatarUrl);
  }

  return embed;
}

export function buildPublicProfileEmbed(master: any, war: any) {
  const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];
  const userParticipant = war.participants?.[master.discordId];

  if (!activeServant || !userParticipant) {
    return new EmbedBuilder()
      .setTitle(`📜 Civilian Dossier | ${master.username}`)
      .setDescription(`Citizen **${master.username}** is an uncontracted observer in Fuyuki City.`)
      .setColor(0x71717a);
  }

  const seals = userParticipant.commandSeals ?? master.commandSeals ?? 3;
  const isExposed = userParticipant.isExposed;
  const isUnderSanctuary = userParticipant.inSanctuary || userParticipant.inChurchSanctuary;

  const sTemplate = activeServant.template || activeServant;
  const servantName = isExposed ? (activeServant.nickname || sTemplate.name || 'Heroic Spirit') : '[Classified in Shadows]';
  const servantClass = sTemplate.servantClass || activeServant.servantClass || activeServant.class || userParticipant?.servantClass || 'Saber';

  const healInfo = getHealingStatus(userParticipant);
  const hpBar = renderHpBar(healInfo.percent);

  const kills = userParticipant.kills ?? master.servantKills ?? 0;
  const duelsWon = master.duelsWon || 0;
  const duelsLost = master.duelsLost || 0;
  const totalDuels = duelsWon + duelsLost;
  const winRate = totalDuels > 0 ? Math.round((duelsWon / totalDuels) * 100) : 0;

  let standingTag = '🟢 Active Competitor';
  if (!userParticipant.isAlive) {
    standingTag = '💀 Dissolved Saint Graph';
  } else if (isUnderSanctuary) {
    standingTag = '🕊️ Under Church Asylum';
  }

  const embed = new EmbedBuilder()
    .setTitle(`📢 MASTER DOSSIER | ${master.username.toUpperCase()}`)
    .setDescription(
      `Master **${master.username}** has broadcast their Master credentials to the server!\n\n` +
      `💠 **Command Seals:** \`${'✦ '.repeat(seals)}${'✧ '.repeat(Math.max(0, 3 - seals))}\` (${seals}/3) | 🎴 **${master.servants?.length || 1}** Contracted Spirit(s)\n\n` +
      `⚔️ **COMBAT RECORD & STANDING:**\n` +
      `• **War Standing:** ${standingTag} [${isExposed ? '⚠️ **EXPOSED**' : '🕶️ **Stealth**'}]\n` +
      `• **Servant Kills:** 💀 **${kills}** Dissolved\n` +
      `• **Duel Record:** ⚔️ **${duelsWon}W - ${duelsLost}L** (${winRate}% Win Rate)\n` +
      `• **Church Standing:** ${master.reputationRank || '🕊️ Honorable Neutral'}\n\n` +
      `🗡️ **CONTRACTED HEROIC SPIRIT:**\n` +
      `• **Heroic Spirit:** **${servantName}** (\`${servantClass}\`)\n` +
      `• **Vitality:** ❤️ [${hpBar}] \`${healInfo.currentHp.toLocaleString()} / ${healInfo.maxHp.toLocaleString()}\` (${healInfo.percent}%) — ${healInfo.statusTag}`
    )
    .setColor(0x3b82f6)
    .setFooter({ text: 'Public Master Dossier • Holy Grail War' });

  if (isExposed && activeServant.template?.avatarUrl) {
    embed.setThumbnail(activeServant.template.avatarUrl);
  }

  return embed;
}

export function buildProfileButtons(userParticipant: any) {
  if (!userParticipant) return [];
  const currentWard = userParticipant?.boundedField || 'none';
  const autoEvade = userParticipant?.autoEvadeEnabled !== false;
  const healInfo = getHealingStatus(userParticipant);

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('profile_ward_none')
      .setLabel('No Wards')
      .setEmoji('🚫')
      .setStyle(currentWard === 'none' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('profile_ward_ward')
      .setLabel('Sanctuary (60% Block)')
      .setEmoji('🛡️')
      .setStyle(currentWard === 'ward' ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('profile_ward_alarm')
      .setLabel('Alarm Trap (3k DMG)')
      .setEmoji('🚨')
      .setStyle(currentWard === 'alarm' ? ButtonStyle.Danger : ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('profile_share_public')
      .setLabel('Share Public Card')
      .setEmoji('📢')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('profile_heal')
      .setLabel(healInfo.ritualCooldownSecs > 0 ? `Healing Ritual (${Math.ceil(healInfo.ritualCooldownSecs / 60)}m)` : 'Healing Ritual (+40%)')
      .setEmoji('✨')
      .setStyle(healInfo.canRitualHeal ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('profile_toggle_evade')
      .setLabel(autoEvade ? 'Auto-Evacuate: ON 🟢' : 'Auto-Evacuate: OFF 🔴')
      .setStyle(autoEvade ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('profile_refresh')
      .setLabel('Refresh')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('war_tab_traps')
      .setLabel('Channel Traps (/trap)')
      .setEmoji('🎯')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('war_status_board')
      .setLabel('Grail War Board')
      .setEmoji('📜')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('disarm_all_traps')
      .setLabel('Disarm Traps')
      .setEmoji('🧹')
      .setStyle(ButtonStyle.Secondary)
  );

  const channelSelectRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('war_trap_channel_select')
      .setPlaceholder('🎯 Select a channel to anchor Bounded Field, Sanctuary, or Disarm...')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
  );

  return [row1, row2, row3, channelSelectRow];
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const isPublic = interaction.options.getBoolean('public') ?? false;
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);

    if (!master.servants || master.servants.length === 0) {
      await interaction.reply({
        flags: isPublic ? undefined : MessageFlags.Ephemeral,
        content: '📜 Civilian Spectator Dossier: You are currently an innocent bystander in Fuyuki City with no contracted Servant. Use `/summon` to establish a covenant and enter the Holy Grail War.'
      });
      return;
    }

    const war = getOrInitWarSession(master);
    const userParticipant = war.participants[interaction.user.id];

    if (isPublic) {
      const publicEmbed = buildPublicProfileEmbed(master, war);
      await interaction.reply({
        embeds: [publicEmbed]
      });
      return;
    }

    const embed = buildProfileEmbed(master, war);
    const buttons = buildProfileButtons(userParticipant);

    await interaction.reply({
      embeds: [embed],
      components: buttons,
      flags: MessageFlags.Ephemeral
    });
  } catch (error: any) {
    if (error?.code === 10062 || error?.code === 40060 || error?.code === 50027 || error?.code === 10008 || error?.message?.includes('Unknown interaction') || error?.message?.includes('acknowledged')) return;
    console.error('Error executing /profile:', error);
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: `❌ Error: ${error.message}`, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: `❌ Error: ${error.message}`, flags: MessageFlags.Ephemeral });
      }
    } catch {}
  }
}
