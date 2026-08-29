/**
 * Slash Command: /customise
 * Description: Customize Servant stats, equip Craft Essences, and set custom dialogue/battle quotes
 * Library: discord.js v14
 */

export const customiseCommandCode = `import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { getOrCreateMaster, updateMasterProfile } from '../database/service';
import { allocateStatPoints, equipCraftEssence, updateCustomDialogueQuotes } from '../engine/customization';
import { CRAFT_ESSENCE_DATABASE } from '../data/craftEssences';

export const data = new SlashCommandBuilder()
  .setName('customise')
  .setDescription('Customize your Servant\\'s stats, craft essences, and custom battle quotes')
  .addSubcommand(sub =>
    sub.setName('stats').setDescription('Allocate available stat points (STR, END, AGI, MNA, LCK)')
  )
  .addSubcommand(sub =>
    sub.setName('quotes').setDescription('Edit custom quotes (Summon, Battle start, NP chant, Victory)')
  )
  .addSubcommand(sub =>
    sub.setName('equip').setDescription('Equip or swap Craft Essences from your inventory')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const activeServant = master.servants.find(s => s.id === master.activeServantId) || master.servants[0];

    if (!activeServant) {
      await interaction.reply({
        ephemeral: true,
        content: '❌ You do not have any contracted Servants. Use \`/summon\` first!'
      });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'quotes') {
      // Show Modal for custom quotes
      const modal = new ModalBuilder()
        .setCustomId(\`modal_quotes:\${activeServant.id}\`)
        .setTitle(\`Quotes for \${activeServant.template.name}\`);

      const summonInput = new TextInputBuilder()
        .setCustomId('quote_summon')
        .setLabel('Summon Quote')
        .setStyle(TextInputStyle.Short)
        .setValue(activeServant.customQuotes.summon || activeServant.template.summonQuote)
        .setRequired(false);

      const npInput = new TextInputBuilder()
        .setCustomId('quote_np')
        .setLabel('Noble Phantasm Chant')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(activeServant.customQuotes.noblePhantasm || activeServant.template.noblePhantasm.chant)
        .setRequired(false);

      const victoryInput = new TextInputBuilder()
        .setCustomId('quote_victory')
        .setLabel('Victory Quote')
        .setStyle(TextInputStyle.Short)
        .setValue(activeServant.customQuotes.victory || activeServant.template.victoryQuote)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(summonInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(npInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(victoryInput)
      );

      await interaction.showModal(modal);
      return;
    }

    if (sub === 'equip') {
      await interaction.deferReply({ ephemeral: true });

      const options = CRAFT_ESSENCE_DATABASE.map(ce => ({
        label: ce.name,
        description: \`(\${'★'.repeat(ce.rarity)}) \${ce.effectText.substring(0, 50)}\`,
        value: ce.id
      }));

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(\`select_ce:\${activeServant.id}\`)
        .setPlaceholder('Select Craft Essence to equip...')
        .addOptions(options);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      await interaction.editReply({
        content: \`🛡️ **Equip Craft Essence to \${activeServant.template.name}:**\\nCurrently Equipped: **\${activeServant.equippedCe?.name || 'None'}**\`,
        components: [row]
      });
      return;
    }

    if (sub === 'stats') {
      await interaction.deferReply({ ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle(\`📊 Allocate Stat Points: \${activeServant.template.name}\`)
        .setDescription(
          \`✨ **Available Points:** \${activeServant.availableStatPoints} pts\\n\\n\` +
          \`• **Strength (STR):** \${activeServant.template.baseStats.strength} + \${activeServant.allocatedStats.strength || 0} *(Increases Buster DMG)*\\n\` +
          \`• **Endurance (END):** \${activeServant.template.baseStats.endurance} + \${activeServant.allocatedStats.endurance || 0} *(Increases HP & Defense)*\\n\` +
          \`• **Agility (AGI):** \${activeServant.template.baseStats.agility} + \${activeServant.allocatedStats.agility || 0} *(Increases Speed & Crit Stars)*\\n\` +
          \`• **Mana (MNA):** \${activeServant.template.baseStats.mana} + \${activeServant.allocatedStats.mana || 0} *(Increases NP Gain & Arts)*\\n\` +
          \`• **Luck (LCK):** \${activeServant.template.baseStats.luck} + \${activeServant.allocatedStats.luck || 0} *(Increases Crit DMG & Resists)*\`
        )
        .setColor(0x38bdf8);

      const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('add_str').setLabel('+1 STR').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('add_end').setLabel('+1 END').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('add_agi').setLabel('+1 AGI').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('add_mna').setLabel('+1 MNA').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('add_lck').setLabel('+1 LCK').setStyle(ButtonStyle.Primary)
      );

      await interaction.editReply({
        embeds: [embed],
        components: [row1]
      });
    }

  } catch (error: any) {
    console.error('Error executing /customise:', error);
    if (!interaction.replied) {
      await interaction.reply({ ephemeral: true, content: \`❌ Error: \${error.message}\` });
    }
  }
}
`;
