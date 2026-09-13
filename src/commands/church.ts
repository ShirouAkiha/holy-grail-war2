import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder, 
  AttachmentBuilder,
  MessageFlags 
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { 
  getOrInitWarSession,
  enterChurchSanctuary,
  leaveChurchSanctuary,
  getReputationInfo
} from '../engine/grailwar';
import {
  generateKotomine24hHomily,
  generateFuyuki2hNewsBulletin
} from '../engine/churchNewsService';
import { renderKireiVisualNovelCard } from '../canvas/renderer';

export const data = new SlashCommandBuilder()
  .setName('church')
  .setDescription('⛪ Fuyuki Church — Neutral asylum, Father Kotomine’s Homily & 2-Hour Breaking News')
  .addStringOption(opt =>
    opt
      .setName('action')
      .setDescription('Action: status, enter (asylum), leave, homily (24h sermon), news (2h bulletin), bounties')
      .setRequired(false)
      .addChoices(
        { name: '⛪ View Sanctuary & Church Status', value: 'status' },
        { name: '📜 Father Kotomine’s 24h Homily', value: 'homily' },
        { name: '📰 Fuyuki 2-Hour Breaking News Bulletin', value: 'news' },
        { name: '🕊️ Enter Church Sanctuary (Claim Asylum)', value: 'enter' },
        { name: '🚪 Leave Church Sanctuary (Re-enter War)', value: 'leave' },
        { name: '🎯 View Extermination Bounties', value: 'bounties' },
        { name: '📜 View Reputation Dossier', value: 'reputation' }
      )
  );

export function buildHomilyEmbed(homily: any): EmbedBuilder {
  const stats = homily.statsSummary || {};
  const statsLine = `📊 **24h War Status:** \`${stats.survivingMastersCount ?? '?'}\` Living Masters • \`${stats.fallenMastersCount ?? 0}\` Fallen • \`${stats.totalCasualties ?? 0}\` Total Casualties • \`${stats.asylumCount ?? 0}\` in Sanctuary • \`${stats.rogueHereticsCount ?? 0}\` Wanted Heretics`;

  const highlights = (homily.keyEvents || [])
    .map((e: string) => `• ${e.replace(/\*\*/g, '')}`)
    .join('\n');

  return new EmbedBuilder()
    .setTitle(homily.title || '🕯️ The Overseer’s 24-Hour Homily | Father Kotomine')
    .setDescription(
      `*“${homily.subtitle || 'A Theological Reflection on the Carnage & Desires of Fuyuki’s Masters'}”*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${homily.monologue}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${statsLine}\n\n` +
      (highlights ? `🕯️ **The Overseer's Noted Events:**\n${highlights}\n\n` : '') +
      `*“Rejoice, Master. For your struggles are the greatest entertainment under heaven.”*`
    )
    .setColor(0x991b1b)
    .setFooter({ text: `Holy Church Overseer Protocol • 24-Hour Soliloquy [Source: ${homily.source || 'gemini'}]` });
}

export function buildNewsEmbed(news: any): EmbedBuilder {
  const threatColors: Record<string, number> = {
    Low: 0x10b981,
    Moderate: 0xf59e0b,
    Severe: 0xef4444,
    Catastrophic: 0x7f1d1d
  };

  const points = (news.bulletinPoints || [])
    .map((p: string) => typeof p === 'string' ? (p.startsWith('•') ? p : `• ${p}`) : '• Tactical notice')
    .join('\n');

  return new EmbedBuilder()
    .setTitle(news.headline || '🚨 FUYUKI BREAKING NEWS BULLETIN')
    .setDescription(
      `📡 **Broadcast Relay:** \`${news.broadcastChannel || 'Fuyuki Emergency Radio'}\` • ⚠️ **Threat Level:** **[${news.threatLevel || 'Moderate'}]**\n\n` +
      `📰 **OFFICIAL MUNICIPAL COVER STORY:**\n> *“${news.gasLeakCoverStory}”*\n\n` +
      `📢 **PUBLIC BROADCAST TRANSCRIPT:**\n${news.content}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📋 **SECTOR INCIDENT DISPATCHES (PAST 2 HOURS):**\n${points}\n\n` +
      `*Active Extermination Bounties: \`${news.activeBountiesCount || 0}\` Wanted Heretic(s)*`
    )
    .setColor(threatColors[news.threatLevel] || 0xf59e0b)
    .setFooter({ text: `Fuyuki Public Information & Church Disinformation Bureau • 2-Hour Dispatch [Source: ${news.source || 'gemini'}]` });
}

export function buildChurchEmbed(userParticipant: any, war?: any, lastMsg?: string) {
  if (!userParticipant) {
    return new EmbedBuilder()
      .setTitle('⛪ Fuyuki Church — Neutral Sanctuary Grounds')
      .setDescription('❌ You are currently an innocent civilian with no contracted Servant. Use `/summon` to summon a Heroic Spirit and enter the Holy Grail War.')
      .setColor(0x71717a);
  }

  const inSanctuary = !!userParticipant.inSanctuary;
  const kills = userParticipant.innocentKills || 0;
  const rep = getReputationInfo(kills);

  const participants = war ? Object.values(war.participants || {}) : [];
  const rogueMasters: any[] = participants.filter(
    (p: any) => p.isAlive && (((p.innocentKills || 0) >= 10) || p.bountyActive || p.isRogueHeretic)
  );

  let bountyNotice = '';
  if (rogueMasters.length > 0) {
    bountyNotice = `\n\n🎯 **ACTIVE CHURCH BOUNTIES (${rogueMasters.length} WANTED):**\n` +
      rogueMasters.map((r: any) => `• ☠️ **${r.username}** (${r.servantName || 'Servant'} [${r.servantClass || 'Class'}]) — **${r.innocentKills || 10} Kills** (Reward: **+1 CS** & **+15 SQ**)`).join('\n');
  } else {
    bountyNotice = `\n\n🎯 **ACTIVE CHURCH BOUNTIES:** No active rogue heretic bounties currently listed.`;
  }

  let standingNotice = `• **Your Church Standing:** ${rep.badge} (\`${kills}/10\` Civilian Kills)\n`;
  if (rep.isRogue) {
    standingNotice += `  ↳ ☠️ **EXCOMMUNICATED ROGUE HERETIC:** Sanctuary barred. +1 CS & +15 SQ bounty on your head.\n`;
  } else if (kills >= 7) {
    standingNotice += `  ↳ 🩸 **High Inquisitorial Scrutiny:** Approaching 10 kills excommunication threshold.\n`;
  } else if (kills >= 4) {
    standingNotice += `  ↳ ⚠️ **Reprimanded:** Monitored for Secrecy of Magecraft violations.\n`;
  } else {
    standingNotice += `  ↳ 🕊️ **In Good Standing:** Full sanctuary and arbitration rights active.\n`;
  }

  return new EmbedBuilder()
    .setTitle('⛪ Fuyuki Church — Neutral Sanctuary Grounds')
    .setDescription(
      `*Father Kirei Kotomine presides over the neutral grounds of the Fuyuki Church.*\n\n` +
      (lastMsg ? `📢 **Action Outcome:**\n${lastMsg}\n\n` : '') +
      `Under Holy Church oversight and imperial leylines, Masters seeking reprieve from the Holy Grail War may claim asylum here.\n\n` +
      `• **Your Current Sanctuary Status:** ${inSanctuary ? '🕊️ **ACTIVE ASYLUM** (Immune to all ambushes & attacks)' : '⚔️ **IN THE FIELD** (Active combatant)'}\n` +
      standingNotice +
      `• **Asylum Inviolability:** No Master may target, ambush, or skirmish against anyone sheltered within the church.\n` +
      `• **Truce Binding:** Masters in sanctuary cannot launch ambushes or attack rivals until they formally depart.` +
      bountyNotice +
      `\n\n*Use the interactive buttons below or run \`/church action:homily\` and \`/church action:news\`:*`
    )
    .setColor(rep.isRogue ? 0xef4444 : inSanctuary ? 0x10b981 : 0x6366f1)
    .setFooter({ text: 'Holy Church Overseer Protocol • Fuyuki City Neutral Zone' });
}

export function buildChurchButtons(userParticipant: any) {
  const inSanctuary = !!userParticipant?.inSanctuary;
  const isRogue = (userParticipant?.innocentKills || 0) >= 10 || userParticipant?.bountyActive;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(inSanctuary ? 'church_leave' : 'church_enter')
      .setLabel(inSanctuary ? 'Leave Sanctuary 🚪' : 'Enter Church Sanctuary ⛪')
      .setStyle(inSanctuary ? ButtonStyle.Danger : ButtonStyle.Primary)
      .setDisabled(isRogue && !inSanctuary),
    new ButtonBuilder()
      .setCustomId('church_action_homily')
      .setLabel('24h Kotomine Homily 📜')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('church_action_news')
      .setLabel('2h Fuyuki News 📰')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('war_tab_bounties')
      .setLabel('Bounties 🎯')
      .setStyle(ButtonStyle.Secondary)
  );
  return [row];
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);

    if (!master.servants || master.servants.length === 0) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: '📜 Civilian Spectator Dossier: You are currently an innocent bystander in Fuyuki City with no contracted Servant. Use `/summon` to establish a covenant and enter the Holy Grail War.'
      });
      return;
    }

    let war = getOrInitWarSession(master);
    const action = interaction.options.getString('action') || 'status';

    if (action === 'homily') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const homily = await generateKotomine24hHomily(war, false);
      const embed = buildHomilyEmbed(homily);

      let files: AttachmentBuilder[] = [];
      try {
        const imageBuffer = await renderKireiVisualNovelCard({
          monologueText: homily.monologue,
          title: homily.title || 'Overseer’s 24h Soliloquy',
          subtitle: homily.subtitle
        });
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'kirei_homily_vn.png' });
        embed.setImage('attachment://kirei_homily_vn.png');
        files.push(attachment);
      } catch (err) {
        console.error('Error rendering Kirei VN Card:', err);
      }

      return interaction.editReply({
        embeds: [embed],
        files,
        components: buildChurchButtons(war.participants[interaction.user.id])
      });
    }

    if (action === 'news') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const news = await generateFuyuki2hNewsBulletin(war, false);
      const embed = buildNewsEmbed(news);
      return interaction.editReply({
        embeds: [embed],
        components: buildChurchButtons(war.participants[interaction.user.id])
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let lastMsg: string | undefined = undefined;

    if (action === 'enter') {
      const res = enterChurchSanctuary(war, interaction.user.id);
      war = res.updatedWar;
      lastMsg = res.message;
      await saveMaster(master);
    } else if (action === 'leave') {
      const res = leaveChurchSanctuary(war, interaction.user.id);
      war = res.updatedWar;
      lastMsg = res.message;
      await saveMaster(master);
    }

    const userParticipant = war.participants[interaction.user.id];
    const churchEmbed = buildChurchEmbed(userParticipant, war, lastMsg);
    const churchButtons = buildChurchButtons(userParticipant);

    let files: AttachmentBuilder[] = [];
    try {
      const homily = war.latestChurchHomily;
      const monologueText = homily?.monologue || 'Welcome to the neutral sanctuary of the Fuyuki Church. Yield your Command Seals, or prepare to face judgment.';
      const imageBuffer = await renderKireiVisualNovelCard({
        monologueText: monologueText,
        title: homily?.title || 'Fuyuki Church Sanctuary',
        subtitle: homily?.subtitle || 'Neutral Grounds & Overseer Arbitration'
      });
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'kirei_church_vn.png' });
      churchEmbed.setImage('attachment://kirei_church_vn.png');
      files.push(attachment);
    } catch (err) {
      console.error('Error rendering Kirei VN Card for /church:', err);
    }

    await interaction.editReply({
      embeds: [churchEmbed],
      components: churchButtons,
      files
    });
  } catch (error: any) {
    console.error('Error executing /church:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: `❌ Error in Church Sanctuary: ${error.message}` });
    }
  }
}

