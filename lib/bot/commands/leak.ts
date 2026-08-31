/**
 * Slash Command: /leak
 * Description: Leak tactical intelligence, rumors, or out rival Masters onto the Grail War Status Board
 * Library: discord.js v14
 */

export const leakCommandCode = `import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder 
} from 'discord.js';
import { getOrCreateMaster } from '../database/service';
import { 
  createHolyGrailWarSession, 
  leakIntelInWar 
} from '../engine/grailwar';

export const data = new SlashCommandBuilder()
  .setName('leak')
  .setDescription('Leak tactical intelligence or rumors onto the Holy Grail War status board')
  .addStringOption(opt =>
    opt.setName('intel')
      .setDescription('The intelligence report, clue, or rumor to broadcast')
      .setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('target')
      .setDescription('Optional: Master name, Servant name, or ID to expose with this leak')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const activeServant = master.servants.find(s => s.id === master.activeServantId) || master.servants[0];

    const war = createHolyGrailWarSession({
      discordId: interaction.user.id,
      username: interaction.user.username,
      servantId: activeServant ? activeServant.id : 'unknown',
      servantName: activeServant ? activeServant.template.name : 'Unknown Heroic Spirit',
      avatarUrl: activeServant?.template.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
      maxHp: activeServant ? activeServant.template.baseHp : 10000
    });

    const intelText = interaction.options.getString('intel', true);
    const targetQuery = interaction.options.getString('target');

    const res = leakIntelInWar(war, interaction.user.username, intelText, targetQuery || undefined);

    const embed = new EmbedBuilder()
      .setTitle('🕵️ Holy Grail War: Intelligence Leak Broadcasted')
      .setDescription(res.message)
      .setColor(0xa855f7)
      .setFooter({ text: 'Information updated on the Holy Grail War Intelligence Board (/grailwar status)' });

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error executing /leak:', error);
    await interaction.editReply({
      content: \`❌ Leak dispatch error: \${error.message}\`
    });
  }
}
`;
