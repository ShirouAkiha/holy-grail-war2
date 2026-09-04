import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction
} from 'discord.js';
import { execute as executeDaily } from './daily';

// ==========================================
// SLASH COMMAND DEFINITION (/claim alias)
// ==========================================
export const data = new SlashCommandBuilder()
  .setName('claim')
  .setDescription('Claim your daily 30 Saint Quartz (SQ) Master allowance');

export async function execute(interaction: ChatInputCommandInteraction) {
  return executeDaily(interaction);
}
