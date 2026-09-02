/**
 * Slash Command: /cegacha
 * Description: Forge and summon Craft Essences using Saint Quartz
 * Library: discord.js v14
 */

export const cegachaCommandCode = [
  "import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';",
  "import { getOrCreateMaster, saveMaster } from '../database/service';",
  "import { CE_GACHA_BANNERS, CRAFT_ESSENCE_DATABASE } from '../data/craftEssences';",
  "import { executeCraftEssenceGachaRoll } from '../engine/ceGacha';",
  "import { renderGachaSummonBanner } from '../canvas/renderer';",
  "",
  "export const data = new SlashCommandBuilder()",
  "  .setName('cegacha')",
  "  .setDescription('Summon and forge Craft Essences using your Saint Quartz')",
  "  .addSubcommand(sub => sub.setName('pull').setDescription('Spend Saint Quartz to summon Craft Essences').addIntegerOption(opt => opt.setName('rolls').setDescription('1 or 10')))",
  "  .addSubcommand(sub => sub.setName('banner').setDescription('View current Craft Essence Banner'))",
  "  .addSubcommand(sub => sub.setName('inventory').setDescription('View owned Craft Essences'))",
  "  .addSubcommand(sub => sub.setName('rates').setDescription('View drop probabilities'));",
  "",
  "export async function execute(interaction: ChatInputCommandInteraction) {",
  "  const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);",
  "  const sub = interaction.options.getSubcommand() || 'banner';",
  "  if (sub === 'pull') {",
  "    const rolls = (interaction.options.getInteger('rolls') || 1) as 1 | 10;",
  "    const pullResult = executeCraftEssenceGachaRoll({ count: rolls, master });",
  "    await saveMaster(pullResult.updatedMaster);",
  "    await interaction.reply({ content: '✨ Successfully pulled ' + rolls + 'x Craft Essences!' });",
  "  }",
  "}"
].join('\n');
