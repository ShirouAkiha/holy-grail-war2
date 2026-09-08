/**
 * Slash Command: /profile
 * Description: View Master dossier, kills, duel record, contracted Servant & defenses
 * Library: discord.js v14
 */

export const profileCommandCode = `import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ComponentType,
  MessageFlags
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { 
  getOrInitWarSession, 
  executeWarAction,
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
      .setDescription('❌ You have not entered the Holy Grail War yet. Use \`/summon\` to summon a Heroic Spirit and establish your contract.')
      .setColor(0x71717a);
  }

  const ward = userParticipant.boundedField || 'none';
  const autoEvade = userParticipant.autoEvadeEnabled !== false;
  const seals = userParticipant.commandSeals ?? master.commandSeals ?? 3;
  const isExposed = userParticipant.isExposed;
  const isUnderSanctuary = userParticipant.underSanctuary;

  let wardLabel = '🚫 **No Wards Active** *(No perimeter defenses)*';
  if (ward === 'ward') {
    wardLabel = '🛡️ **Mage Sanctuary Bounded Field** *(Absorbs 60% Ambush DMG & Auto-Heals)*';
  } else if (ward === 'alarm') {
    wardLabel = '🚨 **Intrusion Alarm Trap** *(Alerts & Deals 3,000 retaliatory DMG)*';
  }

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

  const healInfo = getHealingStatus ? getHealingStatus(userParticipant) : { currentHp: userParticipant.currentHp || 30000, maxHp: userParticipant.maxHp || 30000, percent: 100, statusTag: 'Full Health', ritualCooldownSecs: 0, canRitualHeal: true };
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
    churchStanding += ' *(⚠️ 💎 ' + master.bountyRewardSq + ' SQ Bounty)*';
  }

  return new EmbedBuilder()
    .setTitle('👤 Master Dossier | ' + master.username + ' [' + standingTag + ']')
    .setDescription(
      '*(🔒 Confidential Private Dossier — only visible to you)*\\n\\n' +
      '💠 **Command Seals:** \`' + '✦ '.repeat(seals) + '✧ '.repeat(Math.max(0, 3 - seals)) + '\` (**' + seals + '/3**) | 💎 **' + (master.saintQuartz || 0) + ' SQ** | 🎴 **' + (master.servants?.length || 1) + '** Servant(s)\\n\\n' +
      (lastMsg ? ('📢 **Action Outcome:**\\n' + lastMsg + '\\n\\n') : '') +
      '⚔️ **MASTER COMBAT RECORD & WAR STATUS:**\\n' +
      '• **War Standing:** ' + standingTag + ' [' + (isExposed ? '⚠️ **EXPOSED TO PUBLIC WAR BOARD**' : '🕶️ **Concealed in Shadows**') + ']\\n' +
      '• **Servant Kills:** 💀 **' + kills + '** Dissolved\\n' +
      '• **Duel Record:** ⚔️ **' + duelsWon + 'W - ' + duelsLost + 'L** (' + winRate + '% Win Rate)\\n' +
      '• **Church Standing:** ' + churchStanding + '\\n\\n' +
      '🗡️ **ACTIVE CONTRACTED SERVANT:**\\n' +
      '• **Servant:** **' + servantName + '** (' + servantClass + ')\\n' +
      '• **Vitality:** ❤️ [' + hpBar + '] \`' + healInfo.currentHp.toLocaleString() + ' / ' + healInfo.maxHp.toLocaleString() + '\` (' + healInfo.percent + '%)\\n' +
      '• **Class Passive:** ' + classPassive + '\\n\\n' +
      '🏰 **WORKSHOP DEFENSES:**\\n' +
      '• **Bounded Field:** ' + wardLabel + '\\n' +
      '• **Auto-Evacuation:** ' + (autoEvade ? '🟢 **ON** *(Retreats automatically on lethal blow)*' : '🔴 **OFF**') + '\\n\\n' +
      '*Configure workshop defenses or click **[Share Public Card]** below:*'
    )
    .setColor(isExposed ? 0xef4444 : 0x3b82f6)
    .setFooter({ text: 'Private Master Dossier • Holy Grail War Protocol' });
}

export function buildPublicProfileEmbed(master: any, war: any) {
  const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];
  const userParticipant = war.participants?.[master.discordId];

  if (!activeServant || !userParticipant) {
    return new EmbedBuilder()
      .setTitle('📜 Civilian Dossier | ' + master.username)
      .setDescription('Citizen **' + master.username + '** is an uncontracted observer in Fuyuki City.')
      .setColor(0x71717a);
  }

  const seals = userParticipant.commandSeals ?? master.commandSeals ?? 3;
  const isExposed = userParticipant.isExposed;
  const sTemplate = activeServant.template || activeServant;
  const servantName = isExposed ? (activeServant.nickname || sTemplate.name || 'Heroic Spirit') : '[Classified in Shadows]';
  const servantClass = sTemplate.servantClass || activeServant.servantClass || 'Saber';

  const healInfo = getHealingStatus ? getHealingStatus(userParticipant) : { currentHp: userParticipant.currentHp || 30000, maxHp: userParticipant.maxHp || 30000, percent: 100 };
  const hpBar = renderHpBar(healInfo.percent);

  const kills = userParticipant.kills ?? master.servantKills ?? 0;
  const duelsWon = master.duelsWon || 0;
  const duelsLost = master.duelsLost || 0;
  const totalDuels = duelsWon + duelsLost;
  const winRate = totalDuels > 0 ? Math.round((duelsWon / totalDuels) * 100) : 0;

  return new EmbedBuilder()
    .setTitle('📢 MASTER DOSSIER | ' + master.username.toUpperCase())
    .setDescription(
      'Master **' + master.username + '** has broadcast their Master credentials to the server!\\n\\n' +
      '💠 **Command Seals:** \`' + '✦ '.repeat(seals) + '✧ '.repeat(Math.max(0, 3 - seals)) + '\` (' + seals + '/3) | 🎴 **' + (master.servants?.length || 1) + '** Contracted Spirit(s)\\n\\n' +
      '⚔️ **COMBAT RECORD & STANDING:**\\n' +
      '• **War Standing:** ' + (userParticipant.isAlive ? '🟢 Active Competitor' : '💀 Dissolved') + ' [' + (isExposed ? '⚠️ **EXPOSED**' : '🕶️ **Stealth**') + ']\\n' +
      '• **Servant Kills:** 💀 **' + kills + '** Dissolved\\n' +
      '• **Duel Record:** ⚔️ **' + duelsWon + 'W - ' + duelsLost + 'L** (' + winRate + '% Win Rate)\\n' +
      '• **Church Standing:** ' + (master.reputationRank || '🕊️ Honorable Neutral') + '\\n\\n' +
      '🗡️ **CONTRACTED HEROIC SPIRIT:**\\n' +
      '• **Heroic Spirit:** **' + servantName + '** (\`' + servantClass + '\`)\\n' +
      '• **Vitality:** ❤️ [' + hpBar + '] \`' + healInfo.currentHp.toLocaleString() + ' / ' + healInfo.maxHp.toLocaleString() + '\` (' + healInfo.percent + '%)'
    )
    .setColor(0x3b82f6)
    .setFooter({ text: 'Public Master Dossier • Holy Grail War' });
}

export function buildProfileButtons(userParticipant: any) {
  const currentWard = userParticipant?.boundedField || 'none';
  const autoEvade = userParticipant?.autoEvadeEnabled !== false;

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
      .setLabel('Healing Ritual (+40%)')
      .setEmoji('✨')
      .setStyle(ButtonStyle.Success),
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

  return [row1, row2];
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const isPublic = interaction.options.getBoolean('public') ?? false;
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);

    if (!master.servants || master.servants.length === 0) {
      await interaction.reply({
        flags: isPublic ? undefined : MessageFlags.Ephemeral,
        content: '📜 Civilian Spectator Dossier: You are currently an innocent bystander in Fuyuki City with no contracted Servant. Use \`/summon\` to establish a covenant and enter the Holy Grail War.'
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
    console.error('Error executing /profile:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: '❌ Error: ' + error.message, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: '❌ Error: ' + error.message, flags: MessageFlags.Ephemeral });
    }
  }
}
`;
