/**
 * Slash Command: /heal
 * Description: Perform Workshop Leyline Healing Ritual
 * Library: discord.js v14
 */

export const healCommandCode = `import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
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
        content: '❌ You must summon a Servant before channeling healing rituals! Use \`/summon\` first.'
      });
      return;
    }

    let war = getOrInitWarSession(master);
    const res = executeWarAction(war, interaction.user.id, 'heal_ritual');
    war = res.updatedWar;
    await saveMaster(master);

    const embed = new EmbedBuilder()
      .setTitle(res.success ? '✨ LEYLINE HEALING RITUAL COMPLETE' : '⏳ LEYLINE HEALING ON COOLDOWN')
      .setDescription(res.message)
      .setColor(res.success ? 0x22c55e : 0xf59e0b)
      .setFooter({ text: 'Holy Grail War Regeneration • Check /grailwar status' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error: any) {
    console.error('Error executing /heal:', error);
    await interaction.reply({ content: \`❌ Heal command error: \${error.message}\`, ephemeral: true });
  }
}`;
