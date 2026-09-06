/**
 * Slash Command: /ambush
 * Description: Ambush a suspected Master or civilian in the Holy Grail War
 * Library: discord.js v14
 */

export const ambushCommandCode = `import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction 
} from 'discord.js';
import { execute as attackExecute } from './attack';

export const data = new SlashCommandBuilder()
  .setName('ambush')
  .setDescription('Ambush a suspected Master in the server (if innocent, civilian dies & you are exposed!)')
  .addStringOption(opt =>
    opt.setName('target')
      .setDescription('The Master name, @mention, or ID of the suspected user')
      .setRequired(true)
  );

export const execute = attackExecute;
`;
