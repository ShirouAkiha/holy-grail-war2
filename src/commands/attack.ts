import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder 
, MessageFlags } from 'discord.js';
import { getOrCreateMaster, saveMaster, getMaster } from '../database/service';
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
  // Ephemeral deferral prevents Discord from broadcasting "<User> used /attack" to the channel, keeping the attacker anonymous
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
    const channelName = interaction.channel && 'name' in interaction.channel 
      ? `#${(interaction.channel as any).name}`
      : '#general';

    // Resolve target username if a raw Discord ID or mention was supplied
    let resolvedTargetUsername: string | undefined = undefined;
    const cleanIdMatch = targetQuery.match(/\d{16,21}/);
    if (cleanIdMatch) {
      const uid = cleanIdMatch[0];
      const known = getMaster(uid);
      if (known?.username) {
        resolvedTargetUsername = known.username;
      } else {
        try {
          const cached = interaction.client.users.cache.get(uid);
          if (cached?.username) {
            resolvedTargetUsername = cached.username;
          } else {
            const fetched = await interaction.client.users.fetch(uid).catch(() => null);
            if (fetched?.username) {
              resolvedTargetUsername = fetched.username;
            }
          }
        } catch {}
      }
    }

    const res = attackSuspectUserInWar(war, interaction.user.id, targetQuery, channelName, resolvedTargetUsername);
    await saveMaster(master);

    if (!res.success) {
      const isChurch = res.message.includes('Fuyuki Church');
      const failEmbed = new EmbedBuilder()
        .setTitle(isChurch ? '⛪ Fuyuki Church Neutral Grounds' : '⚠️ Ambush Blocked')
        .setDescription(res.message)
        .setColor(isChurch ? 0x10b981 : 0xf59e0b)
        .setFooter({ text: isChurch ? 'Depart church asylum (/church leave) to resume offensive actions' : 'Ambush prevented' });
      await interaction.editReply({ embeds: [failEmbed] });
      return;
    }

    const attackerParticipant = res.updatedWar.participants[interaction.user.id];
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

    // Ping the ambushed Master or civilian so they receive an immediate notification of the attack
    let pingContent: string | undefined = undefined;
    if (res.targetWasMaster) {
      const pingId = res.targetMasterDiscordId || (targetQuery.startsWith('<@') ? targetQuery.replace(/[<@!>]/g, '') : undefined);
      if (pingId) {
        pingContent = `🚨 <@${pingId}> ⚔️ **AMBUSH ALERT! You are under attack in the Holy Grail War!**`;
      }
    } else {
      const pingId = res.targetMasterDiscordId && /^\d+$/.test(res.targetMasterDiscordId) 
        ? res.targetMasterDiscordId 
        : (targetQuery.startsWith('<@') ? targetQuery.replace(/[<@!>]/g, '') : undefined);
      if (pingId) {
        pingContent = `☠️ <@${pingId}> 💥 **COLLATERAL CASUALTY ALERT! You were caught in magecraft crossfire!**`;
      }
    }

    // Broadcast the ambush announcement to the channel from the bot
    if (interaction.channel && 'send' in interaction.channel) {
      await (interaction.channel as any).send({
        content: pingContent,
        embeds: [embed]
      });
    }

    const victimLabel = res.targetMasterUsername || (res.targetMasterDiscordId ? `<@${res.targetMasterDiscordId}>` : targetQuery);
    await interaction.editReply({
      content: res.targetWasMaster
        ? `⚔️ **Tactical Ambush Dispatched!** Target ${victimLabel} was ambushed and alerted in the channel.`
        : `☠️ **Civilian Casualties Incurred!** Struck down ${victimLabel}. Your identity has been exposed for violating magecraft secrecy!`
    });
  } catch (error: any) {
    console.error('Error executing /attack:', error);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content: `❌ Ambush execution error: ${error.message}`
      });
    } else {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: `❌ Ambush execution error: ${error.message}`
      });
    }
  }
}
