import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { getOrInitWarSession, patrolCityInWar } from '../engine/grailwar';

export const data = new SlashCommandBuilder()
  .setName('patrol')
  .setDescription('👁️ Patrol Fuyuki City sectors to gather intel, detect rival signatures, or spy on bystanders');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];

    if (!activeServant) {
      await interaction.editReply({
        content: '❌ You must summon a Servant before patrolling the city! Use `/summon` first.'
      });
      return;
    }

    let war = getOrInitWarSession(master);
    const currentChannelName = interaction.channel && 'name' in interaction.channel 
      ? `#${(interaction.channel as any).name}`
      : '#fuyuki-city';

    const res = patrolCityInWar(war, interaction.user.id, interaction.user.username, currentChannelName);
    war = res.updatedWar;
    await saveMaster(master);

    const embed = new EmbedBuilder()
      .setTitle('👁️ CITY PATROL RECONNAISSANCE REPORT')
      .setDescription(res.message)
      .setColor(0x0284c7)
      .setFooter({ text: 'Fuyuki City Reconnaissance • Check /grailwar status' });

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error executing /patrol:', error);
    await interaction.editReply({ content: `❌ Patrol error: ${error.message}` });
  }
}
