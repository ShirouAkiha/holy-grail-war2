import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder 
, MessageFlags } from 'discord.js';
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
  // Ephemeral deferral ensures the leaker's name is not revealed via Discord's slash command notification
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const war = getOrInitWarSession(master);
    const intelText = interaction.options.getString('intel', true);
    const targetQuery = interaction.options.getString('target') || undefined;

    const channelName = interaction.channel && 'name' in interaction.channel 
      ? `#${(interaction.channel as any).name}`
      : '#general';
    const res = leakIntelInWar(war, interaction.user.id, intelText, targetQuery, channelName);

    const embed = new EmbedBuilder()
      .setTitle('🕵️ HOLY GRAIL WAR INTELLIGENCE LEAK BROADCAST')
      .setDescription(
        `**Informant:** 🕵️ Clandestine Informant (Anonymous Transmission)\n\n` +
        `📡 **Dispatched Intelligence Report:**\n> "${intelText}"\n\n` +
        (res.exposedTargetMaster 
          ? `🚨 **EXPOSURE RESULT:** **${res.exposedTargetMaster}** was positively identified! Their Servant and stats are now unmasked on the board.` 
          : (targetQuery ? `❓ **UNVERIFIED TARGET:** No active Master matching "${targetQuery}" was unmasked.` : `🔍 Intelligence registered to the global Holy Grail War Chronicle.`))
      )
      .setColor(0xa855f7)
      .setFooter({ text: 'Holy Grail War Surveillance Network • Check /grailwar status' });

    // Post anonymous broadcast directly to channel
    if (interaction.channel && 'send' in interaction.channel) {
      await (interaction.channel as any).send({ embeds: [embed] });
    }

    await interaction.editReply({
      content: '🕵️ **Intelligence Leak Dispatched!** Your report was broadcasted anonymously to the channel with no identity attribution.'
    });
  } catch (error: any) {
    console.error('Error executing /leak:', error);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content: `❌ Leak transmission error: ${error.message}`
      });
    } else {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: `❌ Leak transmission error: ${error.message}`
      });
    }
  }
}
