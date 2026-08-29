/**
 * Slash Command: /summon
 * Description: Summon Heroic Spirits & Craft Essences from active Gacha Banners
 * Library: discord.js v14
 */

export const summonCommandCode = `import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder,
  AttachmentBuilder,
  EmbedBuilder 
} from 'discord.js';
import { executeGachaRoll } from '../engine/gacha';
import { GACHA_BANNERS } from '../data/banners';
import { renderGachaSummonBanner } from '../canvas/nodeCanvasRenderer';
import { getOrCreateMaster, updateMasterProfile } from '../database/service';

export const data = new SlashCommandBuilder()
  .setName('summon')
  .setDescription('Summon Heroic Spirits and Craft Essences from Gacha Banners')
  .addStringOption(option =>
    option
      .setName('banner')
      .setDescription('Choose which banner to pull from')
      .setRequired(false)
      .addChoices(
        { name: 'Holy Grail War: King\\'s Awakening (SSR Artoria & Gilgamesh)', value: 'banner_holy_grail_legends' },
        { name: 'Chaldea Vanguard: Shadows & Saints (SSR Scáthach & Jeanne)', value: 'banner_shadow_lands_saint' },
        { name: 'Server Discord Chaos: Midnight Raid (SSR Linus & Mod)', value: 'banner_server_chaos_memes' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const bannerId = interaction.options.getString('banner') || 'banner_holy_grail_legends';
    const banner = GACHA_BANNERS.find(b => b.id === bannerId) || GACHA_BANNERS[0];

    // Build initial banner embed
    const embed = new EmbedBuilder()
      .setTitle(\`✨ Summoning Portal: \${banner.title}\`)
      .setDescription(
        \`**\${banner.subtitle}**\\n\\n\` +
        \`\${banner.description}\\n\\n\` +
        \`💎 **Your Saint Quartz:** \${master.saintQuartz} SQ\\n\` +
        \`🎫 **Summon Tickets:** \${master.summonTickets}\\n\` +
        \`📊 **SSR Pity Counter:** \${master.pityCount}/90 pulls\`
      )
      .setColor(0xf59e0b)
      .setImage(banner.bannerArtUrl)
      .setFooter({ text: 'Holy Grail War RPG • Select an option below to summon' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(\`gacha_single:\${banner.id}\`)
        .setLabel('Summon 1x (3 SQ)')
        .setEmoji('🗡️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(\`gacha_multi:\${banner.id}\`)
        .setLabel('Summon 10x (30 SQ - Guaranteed 4★+)')
        .setEmoji('✨')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('gacha_info')
        .setLabel('Drop Rates')
        .setStyle(ButtonStyle.Secondary)
    );

    const message = await interaction.editReply({
      embeds: [embed],
      components: [row]
    });

    // Create button collector for 60 seconds
    const collector = message.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 60000
    });

    collector.on('collect', async i => {
      if (i.customId === 'gacha_info') {
        await i.reply({
          ephemeral: true,
          content: \`📊 **\${banner.title} Rates:**\\n\` +
            \`• 5★ SSR Servant: \${banner.rates.ssrServant}%\\n\` +
            \`• 5★ SSR Craft Essence: \${banner.rates.ssrCe}%\\n\` +
            \`• 4★ SR Servant: \${banner.rates.srServant}%\\n\` +
            \`• 4★ SR Craft Essence: \${banner.rates.srCe}%\\n\` +
            \`• 3★ R Servant / CE: 80% combined\\n\` +
            \`*Guaranteed 4★ or higher item on every 10-pull!*\`
        });
        return;
      }

      const isMulti = i.customId.startsWith('gacha_multi:');
      const count = isMulti ? 10 : 1;

      try {
        const pullResult = executeGachaRoll({ banner, count, master });
        await updateMasterProfile(pullResult.updatedMaster);

        // Generate dynamic composite image with @napi-rs/canvas
        const canvasBuffer = await renderGachaSummonBanner(pullResult.results, banner.title);
        const attachment = new AttachmentBuilder(canvasBuffer, { name: 'summon_result.png' });

        const resultEmbed = new EmbedBuilder()
          .setTitle(\`🌟 Summoning Results (\${count}x Pull)\`)
          .setDescription(
            \`You spent **\${pullResult.spentQuartz} Saint Quartz**.\\n\` +
            \`Remaining SQ: **\${pullResult.updatedMaster.saintQuartz}** | Pity: **\${pullResult.newPityCount}/90**\\n\\n\` +
            pullResult.results
              .map(r => \`\${r.rarity === 5 ? '🌈' : r.rarity === 4 ? '✨' : '🔹'} **\${r.item.name}** (\${'★'.repeat(r.rarity)}) \${r.isNew ? '🆕' : ''}\`)
              .join('\\n')
          )
          .setColor(pullResult.results.some(r => r.rarity === 5) ? 0xf59e0b : 0x3b82f6)
          .setImage('attachment://summon_result.png');

        await i.update({
          embeds: [resultEmbed],
          files: [attachment],
          components: [row] // Allow rerolling
        });
      } catch (err: any) {
        await i.reply({
          ephemeral: true,
          content: \`❌ \${err.message || 'Summoning failed.'}\`
        });
      }
    });

  } catch (error: any) {
    console.error('Error executing /summon:', error);
    await interaction.editReply({
      content: \`❌ An error occurred during summoning: \${error.message}\`
    });
  }
}
`;
