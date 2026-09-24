import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder , MessageFlags } from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { getOrInitWarSession } from '../engine/grailwar';
import { safeSetEmbedThumbnail } from '../utils/discordEmbedHelper';

export const data = new SlashCommandBuilder()
  .setName('boast')
  .setDescription('📢 Publicly boast your Servant to the entire server (Permanent War Exposure!)');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const s = master.servants?.find((x: any) => x.id === master.activeServantId) || master.servants?.[0];

    if (!s) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: '❌ You must summon a Servant first to boast! Use `/summon`.'
      });
      return;
    }

    let war = getOrInitWarSession(master);
    const uP = war.participants[interaction.user.id];
    const isActivelyInWar = !!(uP && uP.isAlive && (war.status === 'active' || war.status === 'gathering'));

    if (uP && !uP.isAlive) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: '☠️ You were slain and permanently eliminated from the Holy Grail War! Deceased Masters cannot boast.'
      });
      return;
    }

    if (isActivelyInWar && uP) {
      uP.isExposed = true;
      uP.exposureReason = 'public_command';
      await saveMaster(master);
    }

    const sName = s.nickname || s.template?.name || 'Heroic Spirit';
    const sClass = s.template?.servantClass || 'Saber';

    let description = '';
    if (isActivelyInWar && uP) {
      description = 
        `Master **${master.username}** has chosen to boast their Servant's true parameters to the entire server!\n\n` +
        `⚔️ **Servant:** **${sName}** (\`${sClass}\`)\n` +
        `• **Noble Phantasm:** **${s.template?.noblePhantasm?.name || 'Sacred Phantasm'}**\n` +
        `• **Current Status:** HP: ${uP.currentHp?.toLocaleString() || '30,000'}/${uP.maxHp?.toLocaleString() || '30,000'}\n\n` +
        `⚠️ *Master **${master.username}** has cast aside concealment and is now permanently **EXPOSED** on the Holy Grail War Board (\`/grailwar status\`)! Rivals may now target them freely.*`;
    } else {
      description = 
        `Master **${master.username}** proudly displays their contracted Heroic Spirit to the server!\n\n` +
        `⚔️ **Servant:** **${sName}** (\`${sClass}\`)\n` +
        `• **Title:** *${s.template?.title || 'Heroic Spirit'}*\n` +
        `• **Noble Phantasm:** **${s.template?.noblePhantasm?.name || 'Sacred Phantasm'}** [${s.template?.noblePhantasm?.cardType?.toUpperCase() || 'BUSTER'}]\n` +
        `• **Bond Level:** ${'⭐'.repeat(Math.min(5, s.bondLevel || 1))} (Bond ${s.bondLevel || 1})\n\n` +
        `🗣️ *" ${s.customQuotes?.summon || s.template?.summonQuote || s.template?.battleStartQuote || 'I ask of you, are you my Master?'} "*`;
    }

    const embed = new EmbedBuilder()
      .setTitle(`📢 MASTER ANNOUNCEMENT: ${master.username.toUpperCase()} REVEALS HEROIC SPIRIT!`)
      .setDescription(description)
      .setColor(isActivelyInWar ? 0xef4444 : 0xd4af37)
      .setFooter({ 
        text: isActivelyInWar 
          ? 'Public Identity Broadcast • Master Permanently Exposed in Holy Grail War' 
          : 'Heroic Spirit Declaration • Throne of Heroes' 
      });

    if (s.template?.avatarUrl) {
      safeSetEmbedThumbnail(embed, s.template.avatarUrl);
    }

    await interaction.reply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error executing /boast:', error);
    await interaction.reply({ content: `❌ Boast error: ${error.message}`, flags: MessageFlags.Ephemeral });
  }
}
