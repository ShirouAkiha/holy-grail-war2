import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { getOrInitWarSession, patrolCityInWar } from '../engine/grailwar';
import { addBondExpToServant } from '../../lib/engine/bondEvents';
import { addServantBattleExp } from '../engine/customization';

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

    let expRewardNote = '';
    if (res.success && activeServant) {
      const bRes = addBondExpToServant(activeServant, 40);
      let updatedS = bRes.updatedServant;
      const lvlRes = addServantBattleExp(updatedS, 500);
      updatedS = lvlRes.updatedServant;

      const sIdx = master.servants.findIndex((s: any) => s.id === activeServant.id);
      if (sIdx !== -1) master.servants[sIdx] = updatedS;
      await saveMaster(master);

      const lvlUpStr = lvlRes.didLevelUp ? ` 🌟 **[LEVEL UP! Lv.${lvlRes.newLevel} • +${lvlRes.statPointsGained} Stat Pts]**` : '';
      const bondLvlStr = bRes.didLevelUp ? ` 💖 **[Bond Lv.${bRes.newLevel}!]**` : '';
      expRewardNote = `\n\n🎖️ **Reconnaissance Rewards:** \`+500 Level EXP ⚔️\` | \`+40 Bond EXP 💖\`${lvlUpStr}${bondLvlStr}`;
    }

    const embed = new EmbedBuilder()
      .setTitle('👁️ CITY PATROL RECONNAISSANCE REPORT')
      .setDescription(res.message + expRewardNote)
      .setColor(0x0284c7)
      .setFooter({ text: 'Stealth Reconnaissance • Wards & Traps Detected Safely (No Trigger)' });

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error executing /patrol:', error);
    await interaction.editReply({ content: `❌ Patrol error: ${error.message}` });
  }
}

