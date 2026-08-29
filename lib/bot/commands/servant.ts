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
        \`*\${activeServant.template.title}*\\n\\n\` +
        \`💬 **Master\\'s Battle Quote:**\\n\` +
        \`> *"\${activeServant.customQuotes.battleStart || activeServant.template.battleStartQuote}"*\\n\\n\` +
        \`📜 **Noble Phantasm:** \${activeServant.template.noblePhantasm.name}\\n\` +
        \`> *"\${activeServant.customQuotes.noblePhantasm || activeServant.template.noblePhantasm.chant}"*\\n\\n\` +
        \`✨ **Available Stat Points:** \${activeServant.availableStatPoints} pts (Use \`/customise\` to allocate)\`
      )
      .setColor(activeServant.template.rarity === 5 ? 0xf59e0b : 0x38bdf8)
      .setImage('attachment://servant_card.png')
      .setFooter({ text: \`Class: \${activeServant.template.servantClass} • Bond Level \${activeServant.bondLevel}\` });

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

    const msg = await interaction.editReply({
      embeds: [embed],
      files: [attachment],
      components: [row]
    });

    const collector = msg.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 60000
    });

    collector.on('collect', async i => {
      if (i.customId.startsWith('dialogue_quote:')) {
        const dialogueBuffer = await renderDialogueCard(
          activeServant.template.name,
          activeServant.customQuotes.summon || activeServant.template.summonQuote,
          activeServant.template.title,
          activeServant.template.servantClass
        );
        const dialogueAttachment = new AttachmentBuilder(dialogueBuffer, { name: 'dialogue_card.png' });

        await i.reply({
          files: [dialogueAttachment],
          ephemeral: true
        });
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
