/**
 * Slash Command: /inventory
 * Description: Inspect Master Inventory of Craft Essences, Servants & Seals
 * Library: discord.js v14
 */

export const inventoryCommandCode = `import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getOrCreateMaster } from '../database/service';
import { buildInventoryHub } from './customise';

export const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('👔 Inspect and equip Craft Essences, Servants, Command Seals, and Vault currency');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];

    if (!activeServant) {
      await interaction.reply({
        ephemeral: true,
        content: '❌ You must summon a Servant first to open your Master Inventory! Use \`/summon\`.'
      });
      return;
    }

    const { embed, components } = buildInventoryHub(master, activeServant, 'ces', 1);
    await interaction.reply({
      embeds: [embed],
      components,
      ephemeral: true
    });
  } catch (error: any) {
    console.error('Error executing /inventory:', error);
    await interaction.reply({ content: \`❌ Inventory error: \${error.message}\`, ephemeral: true });
  }
}`;
