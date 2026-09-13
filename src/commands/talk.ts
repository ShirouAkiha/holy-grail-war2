import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  MessageFlags
} from 'discord.js';
import { getOrCreateMaster } from '../database/service';
import { getOrInitWarSession } from '../engine/grailwar';
import { generateServantTalkResponse, renderServantTalkVisualOutput } from '../engine/talkService';
import { safeSetEmbedThumbnail } from '../utils/discordEmbedHelper';

export const data = new SlashCommandBuilder()
  .setName('talk')
  .setDescription('💬 Open a telepathic dialogue channel with your contracted Heroic Spirit')
  .addStringOption(opt =>
    opt
      .setName('message')
      .setDescription('What do you wish to say to your Servant?')
      .setRequired(true)
      .setMaxLength(500)
  )
  .addStringOption(opt =>
    opt
      .setName('servant')
      .setDescription('Specific Servant to address (defaults to currently active Servant)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const war = getOrInitWarSession();

    if (!master.servants || master.servants.length === 0) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ No Contracted Servant')
            .setDescription('You have not established a Master-Servant covenant yet. Use `/summon ritual` to summon a Heroic Spirit into your service!')
            .setColor(0xef4444)
        ]
      });
    }

    const requestedServant = interaction.options.getString('servant')?.toLowerCase().trim();
    let targetServant = master.servants.find((s: any) => s.id === master.activeServantId) || master.servants[0];

    if (requestedServant) {
      const match = master.servants.find((s: any) =>
        s.nickname?.toLowerCase().includes(requestedServant) ||
        s.template?.name?.toLowerCase().includes(requestedServant) ||
        s.template?.servantClass?.toLowerCase() === requestedServant
      );
      if (match) targetServant = match;
    }

    const t = targetServant.template || targetServant;
    const servantName = targetServant.nickname || t.name || 'Heroic Spirit';
    const servantClass = t.servantClass || 'Saber';
    const bondLevel = targetServant.bondLevel || 1;
    const avatarUrl = targetServant.avatarUrl || t.avatarUrl;
    const commandSeals = master.commandSeals ?? 3;
    const playerMessage = interaction.options.getString('message', true);

    const userParticipant = war.participants?.[master.discordId];
    const isExposed = !!userParticipant?.isExposed;
    const equippedCeName = targetServant.equippedCe?.name;
    const recentChronicleEvents = (war.eventLogs || []).slice(-3).map((l: any) =>
      typeof l === 'string' ? l : (l.text || l.message || 'War active in Fuyuki.')
    );

    // 1. Generate the dynamic in-character reply with Holy Grail War chat memory
    const { reply } = await generateServantTalkResponse({
      servantName,
      servantClass,
      bondLevel,
      maxBond: 10,
      masterName: master.username || 'Master',
      masterId: master.discordId || interaction.user.id,
      servantId: targetServant.id || targetServant.templateId || servantName.toLowerCase().replace(/\s+/g, '_'),
      warId: war.id || 'default_fuyuki',
      commandSeals,
      isExposed,
      equippedCeName,
      recentChronicleEvents,
      playerMessage,
      servantAvatarUrl: avatarUrl
    });

    // 2. STEP 3: Render the Output
    const visual = await renderServantTalkVisualOutput({
      servantName,
      servantClass,
      servantAvatarUrl: avatarUrl,
      replyText: reply,
      playerMessage,
      masterName: master.username || 'Master',
      bondLevel,
      commandSeals
    });

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_talk_servant:${targetServant.id}`)
        .setLabel('Speak Again 💬')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('quick_servant_card')
        .setLabel('Servant Profile 📜')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('vn_open_sanctum')
        .setLabel('Bond Sanctum 💖')
        .setStyle(ButtonStyle.Secondary)
    );

    // OPTION A: Canvas Card
    if (visual.canvasBuffer) {
      const attachment = new AttachmentBuilder(visual.canvasBuffer, { name: 'talk_card.png' });
      const embed = new EmbedBuilder()
        .setTitle(visual.embedData.title)
        .setDescription(
          `👤 **Master ${master.username}:**\n> *“${playerMessage}”*\n\n` +
          `⚔️ **${servantName}:**\n> ❝ ***${reply}*** ❞`
        )
        .setColor(visual.embedData.color)
        .setImage('attachment://talk_card.png')
        .setFooter({ text: visual.embedData.footer });

      if (avatarUrl) {
        safeSetEmbedThumbnail(embed, avatarUrl);
      }

      return interaction.editReply({
        embeds: [embed],
        files: [attachment],
        components: [actionRow]
      });
    }

    // OPTION B: Embed Fallback (Formatted with Servant's portrait icon & current Bond rank)
    const fallbackEmbed = new EmbedBuilder()
      .setTitle(`💬 Telepathic Link | ${servantName} [Bond Rank: Lv. ${bondLevel}/10]`)
      .setDescription(
        `👤 **Master ${master.username}:**\n> *“${playerMessage}”*\n\n` +
        `⚔️ **${servantName}:**\n> ❝ ***${reply}*** ❞\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💖 **Bond Rank:** Level \`${bondLevel} / 10\`\n` +
        `🔱 **Command Seals:** \`${'✦ '.repeat(commandSeals)}${'✧ '.repeat(Math.max(0, 3 - commandSeals))}\` (**${commandSeals}/3**)\n` +
        `🛡️ **Equipped CE:** *${equippedCeName || 'None'}*\n` +
        `⚠️ **War Position:** *${isExposed ? 'Exposed on Public War Board' : 'Concealed in Shadows'}*`
      )
      .setColor(visual.embedData.color)
      .setFooter({ text: `Bond Rank ${bondLevel}/10 • Holy Grail War Telepathic Resonance` });

    if (avatarUrl) {
      safeSetEmbedThumbnail(fallbackEmbed, avatarUrl);
    }

    return interaction.editReply({
      embeds: [fallbackEmbed],
      components: [actionRow]
    });

  } catch (error: any) {
    console.error('Error executing /talk:', error);
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('⚠️ Telepathic Resonance Disrupted')
          .setDescription(`The leylines are turbulent: ${error.message || 'Unknown error'}. Try speaking with your Servant again shortly.`)
          .setColor(0xef4444)
      ]
    });
  }
}
