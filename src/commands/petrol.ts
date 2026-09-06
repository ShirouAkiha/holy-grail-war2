import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { execute as executePatrol } from './patrol';

export const data = new SlashCommandBuilder()
  .setName('petrol')
  .setDescription('👁️ Patrol a Fuyuki sector to detect concealed traps & Bounded Fields safely without triggering them')
  .addChannelOption(opt =>
    opt
      .setName('channel')
      .setDescription('Channel sector to scout (defaults to current channel)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  return executePatrol(interaction);
}
