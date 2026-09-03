/**
 * Admin Slash Command: /addce
 * Description: Admin command to register or edit Craft Essences & Gacha Banners
 * Library: discord.js v14
 */

export const addceCommandCode = `import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';
import { 
  addCustomCraftEssence, 
  getAllCraftEssences, 
  getActiveGachaBanner, 
  updateGachaBanner 
} from '../database/service';
import { CraftEssence } from '../types';

export const data = new SlashCommandBuilder()
  .setName('addce')
  .setDescription('Admin command to create, edit, and customize Craft Essences and Gacha Banners')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
    sub
      .setName('create')
      .setDescription('Register a brand new Craft Essence into the Gacha summoning pool')
      .addStringOption(opt => opt.setName('name').setDescription('Name of the Craft Essence').setRequired(true))
      .addIntegerOption(opt => opt.setName('rarity').setDescription('Rarity Tier (3, 4, 5)').setRequired(true))
      .addStringOption(opt => opt.setName('effect').setDescription('Passive effect description').setRequired(true))
      .addIntegerOption(opt => opt.setName('atk').setDescription('ATK stat bonus').setRequired(false))
      .addIntegerOption(opt => opt.setName('hp').setDescription('HP stat bonus').setRequired(false))
      .addStringOption(opt => opt.setName('image_url').setDescription('Artwork URL').setRequired(false))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const sub = interaction.options.getSubcommand();
    if (sub === 'create') {
      const name = interaction.options.getString('name', true);
      const rarity = interaction.options.getInteger('rarity', true);
      const effect = interaction.options.getString('effect', true);
      const atk = interaction.options.getInteger('atk') || 250;
      const hp = interaction.options.getInteger('hp') || 400;
      const artworkUrl = interaction.options.getString('image_url') || '';

      const newCe: CraftEssence = {
        id: 'ce_' + Date.now(),
        name,
        rarity: rarity as any,
        effectDescription: effect,
        stats: { atk, hp },
        artworkUrl,
        lore: 'Custom Craft Essence forged by Administrator mandate.'
      };

      await addCustomCraftEssence(newCe);

      const embed = new EmbedBuilder()
        .setTitle('🛡️ NEW CRAFT ESSENCE REGISTERED!')
        .setDescription(
          \`Successfully forged **\${name}** (★\${rarity}) into the Throne!\\n\\n\` +
          \`• **ATK / HP:** +\${atk} / +\${hp}\\n\` +
          \`• **Passive:** \${effect}\`
        )
        .setColor(0xd4af37);

      if (artworkUrl) embed.setThumbnail(artworkUrl);

      await interaction.reply({ embeds: [embed] });
    }
  } catch (error: any) {
    console.error('Error executing /addce:', error);
    await interaction.reply({ content: \`❌ Error in /addce: \${error.message}\`, ephemeral: true });
  }
}`;
