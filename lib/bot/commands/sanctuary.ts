/**
 * Slash Command: /sanctuary
 * Description: Sanctuary command alias for Fuyuki Church asylum
 * Library: discord.js v14
 */

export const sanctuaryCommandCode = `import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import * as churchCommand from './church';

export const data = new SlashCommandBuilder()
  .setName('sanctuary')
  .setDescription('⛪ Fuyuki Church Sanctuary — Claim or depart neutral asylum under Father Kotomine')
  .addStringOption(opt =>
    opt
      .setName('action')
      .setDescription('Sanctuary Action: status (view rules), enter (claim asylum), leave (re-enter war)')
      .setRequired(false)
      .addChoices(
        { name: '⛪ View Sanctuary Status', value: 'status' },
        { name: '🕊️ Enter Church Sanctuary (Claim Asylum)', value: 'enter' },
        { name: '🚪 Leave Church Sanctuary (Re-enter War)', value: 'leave' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  return churchCommand.execute(interaction);
}`;
