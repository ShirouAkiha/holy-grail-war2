import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder 
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { 
  getOrInitWarSession, 
  attackSuspectUserInWar 
} from '../engine/grailwar';

export const data = new SlashCommandBuilder()
  .setName('attack')
  .setDescription('Ambush a suspected Master in the server (if innocent, they die & you are exposed!)')
  .addStringOption(opt =>
    opt.setName('target')
      .setDescription('The Master name, @mention, or ID of the suspected user')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];

    if (!activeServant) {
      await interaction.editReply({
        content: '❌ You must summon a Servant before launching an ambush! Use `/summon` first.'
      });
      return;
    }

    const war = getOrInitWarSession(master);
    const targetQuery = interaction.options.getString('target', true);
    const res = attackSuspectUserInWar(war, interaction.user.id, targetQuery);
    await saveMaster(master);

    const attackerParticipant = war.participants[interaction.user.id];
    let footerText = '';
    if (!res.targetWasMaster) {
      if (res.wasAlreadyExposed) {
        footerText = 'Attacking Master was already publicly exposed on the War Board (/grailwar status)';
      } else {
        footerText = 'Attacking Master identity is now publicly exposed for violating Secrecy of Magecraft!';
      }
    } else if (attackerParticipant?.isExposed) {
      footerText = 'Both Masters are now EXPOSED on the Grail War Status Board (/grailwar status)';
    } else {
      footerText = 'Target Master identity is now EXPOSED! You remain concealed in the shadows (/grailwar status)';
    }

    const embed = new EmbedBuilder()
      .setTitle(res.targetWasMaster ? '⚔️ TACTICAL AMBUSH: RIVAL MASTER ENGAGED!' : '☠️ COLLATERAL CASUALTY: CIVILIAN SLAIN!')
      .setDescription(res.message)
      .setColor(res.targetWasMaster ? 0xef4444 : 0x7f1d1d)
      .setFooter({ text: footerText });

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error executing /attack:', error);
    await interaction.editReply({
      content: `❌ Ambush execution error: ${error.message}`
    });
  }
}
