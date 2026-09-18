import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder , MessageFlags } from 'discord.js';
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
        flags: MessageFlags.Ephemeral,
        content: '❌ You must summon a Servant before channeling healing rituals! Use `/summon` first.'
      });
      return;
    }

    // Safe Mode Masters have infinite continuous sanctuary healing
    if (master.environmentMode === 'safe') {
      const activeServant = master.servants.find(s => s.id === master.activeServantId) || master.servants[0];
      for (const s of master.servants) {
        s.currentHp = (s as any).maxHp || s.template?.baseHp || 50000;
      }
      await saveMaster(master);

      const maxHp = (activeServant as any).maxHp || activeServant.template?.baseHp || 50000;
      const safeEmbed = new EmbedBuilder()
        .setTitle('✨ CHALDEA LEYLINE SANCTUARY')
        .setDescription(
          `Your Servant (**${activeServant.nickname || activeServant.template?.name}**) is safeguarded under Chaldea's continuous spiritual leylines and restored to **100% Full Health** (\`${maxHp.toLocaleString()} / ${maxHp.toLocaleString()} HP\`)!\n\n` +
          `• **Mode:** 🛡️ Safe Mode\n` +
          `• **Status:** Spiritual core is fully intact with zero attrition.\n` +
          `• **Free Battles:** All friendly sparring matches automatically reset your Servant to 100% HP upon completion.`
        )
        .setColor(0x38bdf8)
        .setFooter({ text: 'Chaldea Virtual Simulator • Safe Mode Protection' });

      await interaction.reply({ embeds: [safeEmbed], flags: MessageFlags.Ephemeral });
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

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error: any) {
    if (error.code === 10062 || error.code === 40060) return;
    console.error('Error executing /heal:', error);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: `❌ Heal command error: ${error.message}`, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: `❌ Heal command error: ${error.message}`, flags: MessageFlags.Ephemeral });
      }
    } catch {}
  }
}
