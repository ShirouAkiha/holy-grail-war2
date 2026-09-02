/**
 * Slash Command: /customise
 * Description: Customize Servant stats, craft essences, and custom dialogue/battle quotes
 * Library: discord.js v14
 */

export const customiseCommandCode = [
  "import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';",
  "import { getOrCreateMaster, saveMaster } from '../database/service';",
  "import { CRAFT_ESSENCE_DATABASE } from '../data/craftEssences';",
  "",
  "export const data = new SlashCommandBuilder()",
  "  .setName('customise')",
  "  .setDescription('Customize Servant stats, craft essences, and custom battle quotes')",
  "  .addSubcommand(sub => sub.setName('stats').setDescription('Allocate available stat points'))",
  "  .addSubcommand(sub => sub.setName('quotes').setDescription('Edit custom quotes'))",
  "  .addSubcommand(sub => sub.setName('equip').setDescription('Equip or swap Craft Essences from your inventory'));",
  "",
  "export async function execute(interaction: ChatInputCommandInteraction) {",
  "  const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);",
  "  const sub = interaction.options.getSubcommand();",
  "  if (sub === 'equip') {",
  "    const ownedCes = (master.craftEssences || []).filter(Boolean);",
  "    if (ownedCes.length === 0) {",
  "      await interaction.reply({ ephemeral: true, content: '❌ You do not own any Craft Essences. Use /cegacha pull to roll for Craft Essences!' });",
  "      return;",
  "    }",
  "    const options = [",
  "      { label: 'Unequip Current Essence', value: 'none' },",
  "      ...ownedCes.slice(0, 24).map(ce => ({ label: ce.name, description: '★' + ce.rarity + ' ' + ce.effectText.slice(0, 40), value: ce.id }))",
  "    ];",
  "    const selectMenu = new StringSelectMenuBuilder().setCustomId('customise_select_ce').addOptions(options);",
  "    await interaction.reply({ content: '🛡️ Select a Craft Essence from your inventory to equip:', components: [new ActionRowBuilder().addComponents(selectMenu)], ephemeral: true });",
  "  }",
  "}"
].join('\n');
