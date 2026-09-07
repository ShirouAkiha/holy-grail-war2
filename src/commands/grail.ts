import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { execute as executeGrailWar } from './grailwar';

export const data = new SlashCommandBuilder()
  .setName('grail')
  .setDescription('🏆 Holy Grail War Board — 7-Master Roster, Casualties, Leaks, Battles & Operations Hub')
  .addStringOption(opt =>
    opt
      .setName('category')
      .setDescription('Select Grail War operations sector or intelligence dossier')
      .setRequired(false)
      .addChoices(
        { name: '🏆 War Board & 7-Master Roster', value: 'board' },
        { name: '☠️ Casualties Dossier (Masters & Civilians)', value: 'casualties' },
        { name: '🕵️ Leaked Intel & Intercepts', value: 'leaks' },
        { name: '⚔️ Battles & Skirmishes Chronicle', value: 'battles' },
        { name: '🏰 Workshop Defenses & Wards', value: 'defenses' },
        { name: '🦅 Familiar Recon Network', value: 'familiars' },
        { name: '🕸️ Bounded Field Traps', value: 'traps' },
        { name: '⛪ Fuyuki Church Sanctuary', value: 'church' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  return executeGrailWar(interaction);
}
