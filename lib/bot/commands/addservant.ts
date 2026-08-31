/**
 * Slash Command: /addservant
 * Description: Admin command to register custom Servants with pictures, stats, and quotes
 * Library: discord.js v14
 */

export const addservantCommandCode = `import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  PermissionFlagsBits 
} from 'discord.js';
import { addCustomServant, getCustomServants, removeCustomServant } from '../database/service';
import { ServantClass, ServantTemplate, CardType } from '../types';

export const data = new SlashCommandBuilder()
  .setName('addservant')
  .setDescription('Admin command to register custom Heroic Spirits into the Throne of Heroes')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
    sub
      .setName('create')
      .setDescription('Create and register a new custom Servant with picture and stats')
      .addStringOption(opt =>
        opt.setName('name').setDescription('Name of the Heroic Spirit').setRequired(true)
      )
      .addStringOption(opt =>
        opt
          .setName('class')
          .setDescription('Servant Class')
          .setRequired(true)
          .addChoices(
            { name: '⚔️ Saber', value: 'Saber' },
            { name: '🏹 Archer', value: 'Archer' },
            { name: '🔱 Lancer', value: 'Lancer' },
            { name: '🐎 Rider', value: 'Rider' },
            { name: '🔮 Caster', value: 'Caster' },
            { name: '🗡️ Assassin', value: 'Assassin' },
            { name: '🔥 Berserker', value: 'Berserker' },
            { name: '⚖️ Ruler', value: 'Ruler' },
            { name: '💀 Avenger', value: 'Avenger' }
          )
      )
      .addAttachmentOption(opt =>
        opt.setName('image_file').setDescription('Upload a picture of the Servant').setRequired(false)
      )
      .addStringOption(opt =>
        opt.setName('image_url').setDescription('Or direct picture URL').setRequired(false)
      )
      .addIntegerOption(opt =>
        opt.setName('hp').setDescription('Base Max HP').setRequired(false)
      )
      .addIntegerOption(opt =>
        opt.setName('atk').setDescription('Base Attack Power').setRequired(false)
      )
      .addStringOption(opt =>
        opt.setName('noble_phantasm').setDescription('Noble Phantasm Name').setRequired(false)
      )
      .addStringOption(opt =>
        opt.setName('summon_quote').setDescription('Summon dialogue quote').setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub.setName('list').setDescription('View all custom Servants in the Throne of Heroes')
  )
  .addSubcommand(sub =>
    sub
      .setName('delete')
      .setDescription('Delete a custom Servant by ID')
      .addStringOption(opt => opt.setName('servant_id').setDescription('Servant ID').setRequired(true))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  // Execute admin creation, listing, or deletion
}
`;
