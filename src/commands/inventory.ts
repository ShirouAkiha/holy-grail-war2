import { SlashCommandBuilder, ChatInputCommandInteraction , MessageFlags } from 'discord.js';
import { getOrCreateMaster } from '../database/service';
import { buildInventoryHub, attachInventoryCollector } from './customise';

export const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('👔 Inspect and equip Craft Essences, Servants, Command Seals, and Vault currency');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];

    if (!activeServant) {
      await interaction.editReply({
        content: '❌ You must summon a Servant first to open your Master Inventory! Use `/summon`.'
      });
      return;
    }

    const { embed, components } = buildInventoryHub(master, activeServant, 'ces', 1, activeServant.equippedCeId);
    const reply = await interaction.editReply({
      embeds: [embed],
      components
    });

    attachInventoryCollector(interaction, master, activeServant, reply);
  } catch (error: any) {
    if (error.code === 10062 || error.code === 40060 || error.message?.includes('Unknown interaction')) {
      return;
    }
    console.error('Error executing /inventory:', error);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: `❌ Inventory error: ${error.message}` });
      } else {
        await interaction.reply({ content: `❌ Inventory error: ${error.message}`, flags: MessageFlags.Ephemeral });
      }
    } catch {
      // Safe fallback
    }
  }
}

