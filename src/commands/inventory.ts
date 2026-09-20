import { SlashCommandBuilder, ChatInputCommandInteraction , MessageFlags } from 'discord.js';
import { getOrCreateMaster } from '../database/service';
import { buildInventoryHub, attachInventoryCollector } from './customise';

export const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('👔 Inspect and equip Craft Essences, Servants, Command Seals, and Vault currency')
  .addStringOption(opt =>
    opt
      .setName('category')
      .setDescription('Inventory compartment to open')
      .setRequired(false)
      .addChoices(
        { name: '🛡️ Craft Essences (All Catalog & Vault)', value: 'ces' },
        { name: '⚔️ Contracted Servants', value: 'servants' },
        { name: '📜 Command Seals & Wards', value: 'seals' },
        { name: '💎 Vault & Currency', value: 'items' }
      )
  )
  .addStringOption(opt =>
    opt
      .setName('search')
      .setDescription('Search Craft Essences by name, passive effect, or servant')
      .setRequired(false)
  )
  .addStringOption(opt =>
    opt
      .setName('filter')
      .setDescription('Filter Craft Essences by rarity tier')
      .setRequired(false)
      .addChoices(
        { name: 'All Tiers', value: 'all' },
        { name: '★5 SSR Legendary', value: '5' },
        { name: '★4 SR Rare', value: '4' },
        { name: '★3 R Common', value: '3' },
        { name: '🎖️ Bond 10 Relics', value: 'bond' }
      )
  )
  .addStringOption(opt =>
    opt
      .setName('mode')
      .setDescription('View Mode: Catalog Archive (All CEs) or Vault (Owned Only)')
      .setRequired(false)
      .addChoices(
        { name: '📚 Catalog Archive (All CEs in Database)', value: 'all' },
        { name: '💼 Vault (Owned Only)', value: 'owned' }
      )
  );

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

    const categoryOpt = (interaction.options.getString('category') || 'ces') as 'ces' | 'servants' | 'seals' | 'items';
    const searchOpt = interaction.options.getString('search') || '';
    const filterOpt = interaction.options.getString('filter') || 'all';
    const modeOpt = (interaction.options.getString('mode') || 'all') as 'all' | 'owned';

    const rarityFilter: 'all' | 5 | 4 | 3 | 'bond' =
      filterOpt === '5' ? 5 :
      filterOpt === '4' ? 4 :
      filterOpt === '3' ? 3 :
      filterOpt === 'bond' ? 'bond' : 'all';

    const { embed, components } = buildInventoryHub(
      master,
      activeServant,
      categoryOpt,
      1,
      activeServant.equippedCeId,
      {
        ceViewMode: modeOpt,
        ceRarityFilter: rarityFilter,
        ceSearchQuery: searchOpt
      }
    );
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

