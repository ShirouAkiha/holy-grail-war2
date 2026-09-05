import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { getOrInitWarSession, executeWarAction } from '../engine/grailwar';

export const data = new SlashCommandBuilder()
  .setName('heal')
  .setDescription('✨ Perform a Workshop Leyline Healing Ritual to restore 40% HP (5-minute cooldown)');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    if (!master.servants || master.servants.length === 0) {
      await interaction.reply({
        ephemeral: true,
        content: '❌ You must summon a Servant before channeling healing rituals! Use `/summon` first.'
      });
      return;
    }

    let war = getOrInitWarSession(master);
    const res = executeWarAction(war, interaction.user.id, 'heal_ritual');
    war = res.updatedWar;
    if (res.success && master.servants && master.servants.length > 0) {
      const activePart = war.participants[interaction.user.id];
      if (activePart) {
        master.servants[0].currentHp = activePart.currentHp;
        master.servants[0].baseHpAtDamage = activePart.baseHpAtDamage;
        master.servants[0].lastDamageTime = activePart.lastDamageTime;
      }
    }
    await saveMaster(master);

    const embed = new EmbedBuilder()
      .setTitle(res.success ? '✨ LEYLINE HEALING RITUAL COMPLETE' : '⏳ LEYLINE HEALING ON COOLDOWN')
      .setDescription(res.message)
      .setColor(res.success ? 0x22c55e : 0xf59e0b)
      .setFooter({ text: 'Holy Grail War Regeneration • Check /grailwar status' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error: any) {
    if (error.code === 10062 || error.code === 40060) return;
    console.error('Error executing /heal:', error);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: `❌ Heal command error: ${error.message}`, ephemeral: true });
      } else {
        await interaction.reply({ content: `❌ Heal command error: ${error.message}`, ephemeral: true });
      }
    } catch {}
  }
}
