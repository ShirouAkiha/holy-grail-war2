/**
 * Slash Command: /servant
 * Description: View servant profile status card, radar stats, bond, and custom dialogue
 * Library: discord.js v14
 */

export const servantCommandCode = `import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  AttachmentBuilder, 
  EmbedBuilder,
  StringSelectMenuBuilder
} from 'discord.js';
import { getOrCreateMaster } from '../database/service';
import { renderServantProfileCard, renderDialogueCard } from '../canvas/nodeCanvasRenderer';

export const data = new SlashCommandBuilder()
  .setName('servant')
  .setDescription('View your active Servant status card, stats radar, and dialogue')
  .addUserOption(option =>
    option
      .setName('master')
      .setDescription('View another Master\\'s active Servant')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const targetUser = interaction.options.getUser('master') || interaction.user;
    const master = await getOrCreateMaster(targetUser.id, targetUser.username);

    const activeServant = master.servants.find(s => s.id === master.activeServantId) || master.servants[0];

    if (!activeServant) {
      await interaction.editReply({
        content: \`❌ \${targetUser.username} does not have any Servants yet! Use \`/summon\` to form a contract.\`
      });
      return;
    }

    // Render Canvas Profile Card
    const imageBuffer = await renderServantProfileCard(activeServant, targetUser.username);
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'servant_card.png' });

    const embed = new EmbedBuilder()
      .setTitle(\`⚔️ Servant Profile: \${activeServant.nickname || activeServant.template.name}\`)
      .setDescription(
        \`*\${activeServant.template.title}* • **Master:** \${targetUser.username}\\n\` +
        \`🌟 **Class:** \${activeServant.template.servantClass} | **Parity:** Balanced | **Bond Lv:** \${activeServant.bondLevel || 1}/10 ♥ | **Level:** \${activeServant.level || 1}/100\\n\` +
        \`✨ **Available Stat Points:** \${activeServant.availableStatPoints} pts\`
      )
      .setColor(activeServant.template.rarity === 5 ? 0xf59e0b : 0x38bdf8)
      .setThumbnail(activeServant.template.avatarUrl || activeServant.template.cardArtUrl)
      .setImage('attachment://servant_card.png');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(\`dialogue_quote:\${activeServant.id}\`)
        .setLabel('Hear Dialogue')
        .setEmoji('💬')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(\`switch_servant_menu:\${master.id}\`)
        .setLabel('Switch Active Servant')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary)
    );

    const artworkEmbed = new EmbedBuilder()
      .setTitle(\`🖼️ Servant Character Portrait: \${activeServant.nickname || activeServant.template.name}\`)
      .setImage(activeServant.template.cardArtUrl || activeServant.template.avatarUrl)
      .setColor(activeServant.template.rarity === 5 ? 0xf59e0b : 0x38bdf8);

    const msg = await interaction.editReply({
      embeds: [embed, artworkEmbed],
      files: [attachment],
      components: [row]
    });

    const collector = msg.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 60000
    });

    collector.on('collect', async i => {
      try {
        if (i.replied || i.deferred) return;
        if (i.customId.startsWith('dialogue_quote:')) {
        const sTemplate = activeServant.template || activeServant;
        const dialogueBuffer = await renderDialogueCard(
          sTemplate.name || activeServant.name || 'Heroic Spirit',
          activeServant.customQuotes?.summon || sTemplate.summonQuote || 'I answer your call.',
          sTemplate.title || 'Servant',
          sTemplate.servantClass || 'Saber'
        );
        const dialogueAttachment = new AttachmentBuilder(dialogueBuffer, { name: 'dialogue_card.png' });

        await i.reply({
          files: [dialogueAttachment],
          ephemeral: true
        });
      }
      } catch (err: any) {
        if (
          err.code === 10062 || 
          err.code === 40060 || 
          err.code === 50027 || 
          err.message?.includes('Unknown interaction') || 
          err.message?.includes('already been acknowledged')
        ) {
          return;
        }
        console.error('Error in servant collector:', err);
      }
    });

  } catch (error: any) {
    console.error('Error executing /servant:', error);
    await interaction.editReply({
      content: \`❌ Error displaying Servant profile: \${error.message}\`
    });
  }
}
`;
