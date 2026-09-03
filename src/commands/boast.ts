import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { getOrInitWarSession } from '../engine/grailwar';

export const data = new SlashCommandBuilder()
  .setName('boast')
  .setDescription('📢 Publicly boast your Servant to the entire server (Permanent War Exposure!)');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const s = master.servants?.find((x: any) => x.id === master.activeServantId) || master.servants?.[0];

    if (!s) {
      await interaction.reply({
        ephemeral: true,
        content: '❌ You must summon a Servant first to boast! Use `/summon`.'
      });
      return;
    }

    let war = getOrInitWarSession(master);
    const uP = war.participants[interaction.user.id];
    if (uP) {
      uP.isExposed = true;
      uP.exposureReason = 'public_command';
    }
    await saveMaster(master);

    const sName = s.nickname || s.template?.name || 'Heroic Spirit';
    const sClass = s.template?.servantClass || 'Saber';

    const embed = new EmbedBuilder()
      .setTitle(`📢 MASTER ANNOUNCEMENT: ${master.username.toUpperCase()} REVEALS HEROIC SPIRIT!`)
      .setDescription(
        `Master **${master.username}** has chosen to boast their Servant's true parameters to the entire server!\n\n` +
        `⚔️ **Servant:** **${sName}** (\`${sClass}\`)\n` +
        `• **Noble Phantasm:** **${s.template?.noblePhantasm?.name || 'Sacred Phantasm'}**\n` +
        `• **Current Status:** HP: ${uP?.currentHp?.toLocaleString() || '30,000'}/${uP?.maxHp?.toLocaleString() || '30,000'}\n\n` +
        `⚠️ *Master **${master.username}** has cast aside concealment and is now permanently **EXPOSED** on the Holy Grail War Board (\`/grailwar status\`)! Rivals may now target them freely.*`
      )
      .setColor(0xef4444)
      .setFooter({ text: 'Public Identity Broadcast • Master Permanently Exposed' });

    if (s.template?.avatarUrl) {
      embed.setThumbnail(s.template.avatarUrl);
    }

    await interaction.reply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error executing /boast:', error);
    await interaction.reply({ content: `❌ Boast error: ${error.message}`, ephemeral: true });
  }
}
