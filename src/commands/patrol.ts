import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder , MessageFlags } from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { getOrInitWarSession, patrolCityInWar } from '../engine/grailwar';
import { addBondExpToServant } from '../../lib/engine/bondEvents';

export const data = new SlashCommandBuilder()
  .setName('patrol')
  .setDescription('👁️ Patrol a Fuyuki sector to scout concealed traps & Bounded Fields')
  .addChannelOption(opt =>
    opt
      .setName('channel')
      .setDescription('Channel sector to scout (defaults to current channel)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
    const targetChannelObj = interaction.options.getChannel('channel');
    const currentChannelName = targetChannelObj && 'name' in targetChannelObj
      ? `#${(targetChannelObj as any).name}`
      : interaction.channel && 'name' in interaction.channel 
        ? `#${(interaction.channel as any).name}`
        : '#general';

    const res = patrolCityInWar(war, interaction.user.id, interaction.user.username, currentChannelName);
    war = res.updatedWar;

    // Award patrol Bond EXP
    const bondGain = 60;
    const bondResult = addBondExpToServant(activeServant, bondGain);
    const sIdx = master.servants.findIndex((s: any) => s.id === activeServant.id);
    if (sIdx !== -1) {
      master.servants[sIdx] = bondResult.updatedServant;
    }
    await saveMaster(master);

    const sName = activeServant.nickname || activeServant.template?.name || 'Servant';
    const bondLvlNotice = bondResult.didLevelUp ? `\n🎉 **[BOND LEVEL UP]** **${sName}** reached **Bond Lv. ${bondResult.newLevel}**!` : '';

    const embed = new EmbedBuilder()
      .setTitle('👁️ CITY PATROL RECONNAISSANCE REPORT')
      .setDescription(
        `${res.message}\n\n` +
        `💖 **Bond Synergy:** **+${bondGain} Bond EXP** earned with **${sName}** through field reconnaissance! (Current: Lv. ${bondResult.newLevel})${bondLvlNotice}`
      )
      .setColor(0x0284c7)
      .setFooter({ text: 'Stealth Reconnaissance • Wards & Traps Detected Safely (No Trigger)' });

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error executing /patrol:', error);
    await interaction.editReply({ content: `❌ Patrol error: ${error.message}` });
  }
}
