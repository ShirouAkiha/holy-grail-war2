/**
 * Slash Command: /leak
 * Description: Leak intelligence and unmask rival Masters in the Holy Grail War
 * Library: discord.js v14
 */

export const leakCommandCode = `import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder 
} from 'discord.js';
import { getOrCreateMaster } from '../database/service';
import { 
  getOrInitWarSession, 
  leakIntelInWar 
} from '../engine/grailwar';

export const data = new SlashCommandBuilder()
  .setName('leak')
  .setDescription('Leak intelligence or suspected Master identities into the Holy Grail War broadcast network')
  .addStringOption(opt =>
    opt.setName('intel')
      .setDescription('Intelligence report text (e.g. "I witnessed a golden archer near Fuyuki Bridge")')
      .setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('target')
      .setDescription('Optional: Mention or name of suspected Master to expose their Servant stats')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];

    const war = getOrInitWarSession(master);
    const intelText = interaction.options.getString('intel', true);
    const targetQuery = interaction.options.getString('target') || undefined;

    const channelName = interaction.channel && 'name' in interaction.channel 
      ? '#' + (interaction.channel as any).name
      : '#general';
    const res = leakIntelInWar(war, interaction.user.id, intelText, targetQuery, channelName);

    const embed = new EmbedBuilder()
      .setTitle('🕵️ HOLY GRAIL WAR INTELLIGENCE LEAK BROADCAST')
      .setDescription(
        '**Informant:** 🕵️ Clandestine Informant (Anonymous Transmission)\\n\\n' +
        '📡 **Dispatched Intelligence Report:**\\n> "' + intelText + '"\\n\\n' +
        (res.exposedTargetMaster 
          ? '🚨 **EXPOSURE RESULT:** **' + res.exposedTargetMaster + '** was positively identified! Their Servant and stats are now unmasked on the board.' 
          : (targetQuery ? '❓ **UNVERIFIED TARGET:** No active Master matching "' + targetQuery + '" was unmasked.' : '🔍 Intelligence registered to the global Holy Grail War Chronicle.'))
      )
      .setColor(0xa855f7)
      .setFooter({ text: 'Holy Grail War Surveillance Network • Check /grailwar status' });

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error executing /leak:', error);
    await interaction.editReply({
      content: '❌ Leak transmission error: ' + error.message
    });
  }
}
`;
