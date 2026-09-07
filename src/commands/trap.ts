import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  MessageFlags
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { 
  getOrInitWarSession, 
  setChannelTrapInWar, 
  disarmChannelTrapsInWar,
  setWorkshopWardInWar,
  invokeCommandSealInWar,
  calculateServantMaxHp
} from '../engine/grailwar';

export const data = new SlashCommandBuilder()
  .setName('trap')
  .setDescription('🕸️ Place or manage concealed Bounded Field traps, Mage Sanctuary, and Command Seals')
  .addSubcommand(sub =>
    sub
      .setName('set')
      .setDescription('Conceal a Bounded Field trap or establish a Mage Sanctuary')
      .addStringOption(opt =>
        opt
          .setName('type')
          .setDescription('Choose Bounded Field or Ward type')
          .setRequired(true)
          .addChoices(
            { name: '🛡️ Mage Sanctuary (Anchors auto-healing & deflects 60% ambush damage)', value: 'sanctuary' },
            { name: '🚨 Alarm Ward (Exposes intruder identity & Servant Class)', value: 'alarm' },
            { name: '🩸 Bloodfort Drain (Siphons 1,800 HP from intruder to your Servant)', value: 'drain' },
            { name: '🗿 Homunculus Decoy Ward (Absorbs 100% incoming ambush damage)', value: 'decoy' }
          )
      )
      .addChannelOption(opt =>
        opt
          .setName('channel')
          .setDescription('Actual Discord channel to anchor Mage Sanctuary or channel trap')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('seal')
      .setDescription('Invoke Command Seals or manage auto-evacuation defenses')
      .addStringOption(opt =>
        opt
          .setName('action')
          .setDescription('Command Seal action')
          .setRequired(true)
          .addChoices(
            { name: '⚡ Full Heal (Restores Servant to 100% HP)', value: 'heal' },
            { name: '🔴 Toggle Auto-Evacuation Ward (Consumes 1 CS on fatal hit to survive with 1 HP)', value: 'evac' }
          )
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('list')
      .setDescription('View active channel Bounded Fields, Workshop Wards, and Command Seals')
  )
  .addSubcommand(sub =>
    sub
      .setName('disarm')
      .setDescription('Disarm and dissolve your deployed channel traps or workshop wards')
      .addChannelOption(opt =>
        opt
          .setName('channel')
          .setDescription('Specific Discord channel to disarm (leave blank to disarm all)')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(false)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    if (!master.servants || master.servants.length === 0) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: '❌ You must summon a Servant before setting traps! Use `/summon` first.'
      });
      return;
    }

    let war = getOrInitWarSession(master);
    const sub = interaction.options.getSubcommand(false) || 'list';
    const currentChannelName = interaction.channel && 'name' in interaction.channel 
      ? `#${(interaction.channel as any).name}`
      : '#general';

    if (sub === 'seal') {
      const act = interaction.options.getString('action', true);
      if (act === 'heal') {
        const res = invokeCommandSealInWar(war, interaction.user.id, 'heal');
        war = res.updatedWar;
        await saveMaster(master);
        await interaction.reply({ content: res.message, flags: MessageFlags.Ephemeral });
        return;
      } else if (act === 'evac') {
        const res = invokeCommandSealInWar(war, interaction.user.id, 'toggle_evac');
        war = res.updatedWar;
        await saveMaster(master);
        await interaction.reply({ content: res.message, flags: MessageFlags.Ephemeral });
        return;
      }
    }

    if (sub === 'set') {
      const trapType = interaction.options.getString('type', true);
      const channelOpt = interaction.options.getChannel('channel');
      const targetChan = channelOpt && 'name' in channelOpt 
        ? `#${channelOpt.name}` 
        : currentChannelName;

      if (trapType === 'sanctuary') {
        const res = setWorkshopWardInWar(war, interaction.user.id, 'ward', targetChan);
        war = res.updatedWar;
        master.boundedField = 'ward';
        master.sanctuaryChannelName = targetChan;
        await saveMaster(master);

        const sanctuaryEmbed = new EmbedBuilder()
          .setTitle('🛡️ Mage Sanctuary Established')
          .setDescription(
            `**Mage Sanctuary Bounded Field Anchored in \`${targetChan}\`!**\n\n` +
            `• 💧 **HP Auto-Regeneration:** Your Servant is protected inside this Sanctuary and steadily regenerates missing HP (5-minute full recovery cycle).\n` +
            `• 🛡️ **Ambush Protection:** Absorbs & deflects **60% of incoming ambush damage**!\n\n` +
            `⚠️ *Important: Mage Sanctuary is the sole method of passive HP auto-regeneration in the Holy Grail War. All other auto-regen is inactive.*`
          )
          .setColor(0x10b981)
          .setFooter({ text: `Anchored Sector: ${targetChan} • Holy Grail War` })
          .setTimestamp();

        await interaction.reply({ embeds: [sanctuaryEmbed], flags: MessageFlags.Ephemeral });
        return;
      } else if (trapType === 'decoy') {
        const res = setWorkshopWardInWar(war, interaction.user.id, 'decoy');
        war = res.updatedWar;
        master.boundedField = 'decoy';
        await saveMaster(master);
        await interaction.reply({ content: res.message, flags: MessageFlags.Ephemeral });
        return;
      }

      const res = setChannelTrapInWar(war, interaction.user.id, interaction.user.username, targetChan, trapType as 'alarm' | 'drain');
      war = res.updatedWar;
      await saveMaster(master);

      if (!res.success) {
        const errorEmbed = new EmbedBuilder()
          .setTitle('⚠️ Bounded Field Interrupted')
          .setDescription(
            res.message +
            `\n\n💡 *Tip: To target an existing channel, use \`/trap set type:${trapType} channel:#your-channel\` or use the dropdown menu in \`/trap list\`!*`
          )
          .setColor(0xef4444)
          .setFooter({ text: 'Holy Grail War Espionage & Perimeter Security' });

        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }

      const trapEmbed = new EmbedBuilder()
        .setTitle('🕸️ Bounded Field Trap Deployed')
        .setDescription(res.message)
        .setColor(trapType === 'alarm' ? 0xeab308 : 0xdc2626)
        .setFooter({ text: 'Holy Grail War Espionage & Perimeter Security' });

      await interaction.reply({ embeds: [trapEmbed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'disarm') {
      const channelOpt = interaction.options.getChannel('channel');
      const targetChan = channelOpt && 'name' in channelOpt ? `#${channelOpt.name}` : undefined;
      const res = disarmChannelTrapsInWar(war, interaction.user.id, targetChan);
      war = res.updatedWar;
      await saveMaster(master);

      await interaction.reply({
        content: res.message,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // list / default handler
    const userTraps = (war.channelTraps || []).filter(t => t.setterMasterId === interaction.user.id);
    const uP = war.participants[interaction.user.id];
    const wardType = uP?.boundedField || 'none';
    const autoEvac = uP?.autoEvadeEnabled === true;
    const csCount = uP?.commandSeals ?? 3;

    let desc = '';
    if (userTraps.length === 0) {
      desc = '📍 **YOUR ACTIVE BOUNDED FIELDS (0/3):**\n• *You currently have no active Bounded Fields deployed in any channel sectors.*\n• Use the channel dropdown below or `/trap set` to anchor one!';
    } else {
      desc = `📍 **YOUR ACTIVE BOUNDED FIELDS (${userTraps.length}/3):**\n` +
        userTraps.map((t, idx) => {
          const typeLabel = t.trapType === 'alarm' 
            ? '🚨 **Sensory Alarm Ward** (Exposes intruder identity & Servant class)' 
            : '🩸 **Bloodfort Drain** (Siphons 1,800–2,600 HP from intruder)';
          return `**${idx + 1}. Sector \`${t.channelName}\`** — ${typeLabel}\n*Status: 🟢 Armed & Concealed • Deployed <t:${Math.floor(t.createdAt / 1000)}:R>*`;
        }).join('\n\n');
    }

    // Workshop Ward Status
    let workshopDesc = '🚫 **No Workshop Ward Active** *(HP auto-regeneration is disabled. Establish Mage Sanctuary in a channel to auto-heal)*';
    if (wardType === 'ward') {
      const sChan = uP?.sanctuaryChannelName || '#general';
      workshopDesc = `🛡️ **Mage Sanctuary Bounded Field (Anchored in \`${sChan}\`):**\n• 💧 **HP Auto-Regeneration Active:** (Sole auto-heal method; 5 min full recovery)\n• 🛡️ **Ambush Protection:** Deflects **60% of incoming ambush damage**.`;
    } else if (wardType === 'decoy') {
      workshopDesc = '🗿 **Homunculus Decoy:** Sacrifices an artificial homunculus to absorb **100% of incoming ambush damage** *(Auto-regen is inactive)*.';
    } else if (wardType === 'alarm') {
      workshopDesc = '🚨 **Sensory Alarm Trap:** Detects infiltrators, alerting you and dealing **3,000 retaliatory DMG** *(Auto-regen is inactive)*.';
    }

    // Dynamic Sector Radar for all active traps and default channels
    const defaultSectors = ['#holy-grail-war', '#general', currentChannelName];
    const allSectors = Array.from(new Set([...defaultSectors, ...(war.channelTraps || []).map(t => t.channelName)]));
    const radarLines = allSectors.map(secName => {
      const trapsInSec = (war.channelTraps || []).filter(t => t.channelName.toLowerCase() === secName.toLowerCase());
      if (trapsInSec.length === 0) {
        return `• \`${secName}\`: ✨ **Clear** *(Available to anchor)*`;
      }
      const myTrapsInSec = trapsInSec.filter(t => t.setterMasterId === interaction.user.id);
      if (myTrapsInSec.length > 0) {
        const labels = myTrapsInSec.map(t => t.trapType === 'alarm' ? '🚨 Alarm Ward' : '🩸 Bloodfort Drain').join(' + ');
        return `• \`${secName}\`: 🕸️ **Armed by You** (${myTrapsInSec.length}/3 fields: ${labels})`;
      }
      const otherMaster = trapsInSec[0].setterUsername;
      return `• \`${secName}\`: 🔒 **Occupied** *(Master ${otherMaster} claims this territory)*`;
    }).join('\n');

    const fullDesc = 
      `🏰 **WORKSHOP DEFENSES & SANCTUARY:**\n${workshopDesc}\n\n` +
      `📜 **COMMAND SEALS & AUTO-EVAC:**\n` +
      `• **Remaining Seals:** \`${'✦ '.repeat(csCount)}${'✧ '.repeat(Math.max(0, 3 - csCount))}\` (**${csCount}/3**)\n` +
      `• **Auto-Evacuate Ward:** ${autoEvac ? '🟢 **ENABLED** (Survives lethal hit with 1 HP)' : '🔴 **DISABLED**'}\n\n` +
      desc + '\n\n🗺️ **ACTIVE CHANNELS RADAR:**\n' + radarLines +
      '\n\n🎯 **TARGET A SPECIFIC CHANNEL:**\nSelect an existing Discord channel below to anchor Mage Sanctuary, deploy traps, or disarm sectors!';

    const trapsEmbed = new EmbedBuilder()
      .setTitle('🕸️ Bounded Fields, Mage Sanctuary & Command Seals')
      .setDescription(fullDesc)
      .setColor(0x8b5cf6)
      .setFooter({ text: 'A Master can set 3 Bounded Fields • Mage Sanctuary is the sole HP auto-regen source' });

    const btnRow1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('war_place_trap_alarm')
        .setLabel(`Alarm (${currentChannelName})`)
        .setEmoji('🚨')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('war_place_trap_drain')
        .setLabel(`Drain (${currentChannelName})`)
        .setEmoji('🩸')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('trap_set_sanctuary')
        .setLabel(`Sanctuary (${currentChannelName})`)
        .setEmoji('🛡️')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('trap_set_decoy')
        .setLabel('Decoy (100% Absorb)')
        .setEmoji('🗿')
        .setStyle(ButtonStyle.Secondary)
    );

    const btnRow2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('trap_use_seal_heal')
        .setLabel('Use Seal (Full Heal)')
        .setEmoji('⚡')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('trap_toggle_evac')
        .setLabel(autoEvac ? 'Auto-Evac: ON 🟢' : 'Auto-Evac: OFF 🔴')
        .setStyle(autoEvac ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('disarm_all_traps')
        .setLabel('Disarm Traps')
        .setEmoji('🧹')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('war_status_board')
        .setLabel('Grail War Board')
        .setEmoji('📜')
        .setStyle(ButtonStyle.Secondary)
    );

    const channelSelectRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('war_trap_channel_select')
        .setPlaceholder('🎯 Select an existing Discord channel to place Bounded Field or Sanctuary...')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    );

    await interaction.reply({
      embeds: [trapsEmbed],
      components: [btnRow1, btnRow2, channelSelectRow],
      flags: MessageFlags.Ephemeral
    });

    const reply = await interaction.fetchReply();
    const collector = reply.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', async (i: any) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: 'Only the Master who summoned this radar can interact.', flags: MessageFlags.Ephemeral });
        return;
      }

      if (i.isChannelSelectMenu() && i.customId === 'war_trap_channel_select') {
        const selectedChanId = i.values[0];
        const selectedChan = i.guild?.channels.cache.get(selectedChanId);
        const targetChanName = selectedChan ? `#${selectedChan.name}` : `#${selectedChanId}`;

        const promptEmbed = new EmbedBuilder()
          .setTitle(`🕸️ Anchor Bounded Field or Sanctuary in ${targetChanName}`)
          .setDescription(
            `You selected target channel: **${targetChanName}**\n\n` +
            `Choose which Bounded Field to deploy or manage in this sector:\n\n` +
            `• 🛡️ **Mage Sanctuary (Auto-Heal & 60% Ambush Block):** Anchors your primary workshop in this channel. **This is the sole method of continuous HP auto-regeneration** and deflects 60% ambush DMG.\n` +
            `• 🚨 **Sensory Alarm Ward:** Conceals an early warning perimeter that exposes rival Master identity and Servant true class upon typing.\n` +
            `• 🩸 **Bloodfort Mana Drain:** Traps the channel in a bounded field that siphons 1,800 HP from rival intruders directly into your Servant.\n` +
            `• 🧹 **Disarm Sector:** Dissolves any Bounded Field you have placed in ${targetChanName}.\n\n` +
            `*Or click Back to return.*`
          )
          .setColor(0x8b5cf6)
          .setFooter({ text: `Sector Target: ${targetChanName} • Holy Grail War` });

        const promptRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`trap_set_sanctuary_${selectedChanId}`)
            .setLabel(`Anchor Sanctuary (${targetChanName})`)
            .setEmoji('🛡️')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`trap_set_alarm_${selectedChanId}`)
            .setLabel(`Anchor Alarm (${targetChanName})`)
            .setEmoji('🚨')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`trap_set_drain_${selectedChanId}`)
            .setLabel(`Anchor Drain (${targetChanName})`)
            .setEmoji('🩸')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`trap_disarm_${selectedChanId}`)
            .setLabel(`Disarm ${targetChanName}`)
            .setEmoji('🧹')
            .setStyle(ButtonStyle.Secondary)
        );

        await i.update({ embeds: [promptEmbed], components: [promptRow] });
        return;
      }

      if (i.customId === 'trap_set_sanctuary') {
        const res = setWorkshopWardInWar(war, i.user.id, 'ward', currentChannelName);
        war = res.updatedWar;
        master.boundedField = 'ward';
        master.sanctuaryChannelName = currentChannelName;
        await saveMaster(master);
        await i.reply({ content: res.message, flags: MessageFlags.Ephemeral });
        return;
      }

      if (i.customId.startsWith('trap_set_sanctuary_')) {
        const chanId = i.customId.replace('trap_set_sanctuary_', '');
        const chan = i.guild?.channels.cache.get(chanId);
        const chanName = chan ? `#${chan.name}` : `#${chanId}`;
        const res = setWorkshopWardInWar(war, i.user.id, 'ward', chanName);
        war = res.updatedWar;
        master.boundedField = 'ward';
        master.sanctuaryChannelName = chanName;
        await saveMaster(master);
        await i.reply({ content: res.message, flags: MessageFlags.Ephemeral });
        return;
      }

      if (i.customId === 'trap_set_decoy') {
        const res = setWorkshopWardInWar(war, i.user.id, 'decoy');
        war = res.updatedWar;
        master.boundedField = 'decoy';
        await saveMaster(master);
        await i.reply({ content: res.message, flags: MessageFlags.Ephemeral });
        return;
      }

      if (i.customId === 'trap_use_seal_heal') {
        const res = invokeCommandSealInWar(war, i.user.id, 'heal');
        war = res.updatedWar;
        await saveMaster(master);
        await i.reply({ content: res.message, flags: MessageFlags.Ephemeral });
        return;
      }

      if (i.customId === 'trap_toggle_evac') {
        const res = invokeCommandSealInWar(war, i.user.id, 'toggle_evac');
        war = res.updatedWar;
        await saveMaster(master);
        await i.reply({ content: res.message, flags: MessageFlags.Ephemeral });
        return;
      }

      if (i.customId.startsWith('trap_set_alarm_')) {
        const chanId = i.customId.replace('trap_set_alarm_', '');
        const chan = i.guild?.channels.cache.get(chanId);
        const chanName = chan ? `#${chan.name}` : `#${chanId}`;
        const res = setChannelTrapInWar(war, i.user.id, i.user.username, chanName, 'alarm');
        war = res.updatedWar;
        await saveMaster(master);

        await i.reply({
          content: `${res.success ? '✅' : '⚠️'} ${res.message}`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (i.customId.startsWith('trap_set_drain_')) {
        const chanId = i.customId.replace('trap_set_drain_', '');
        const chan = i.guild?.channels.cache.get(chanId);
        const chanName = chan ? `#${chan.name}` : `#${chanId}`;
        const res = setChannelTrapInWar(war, i.user.id, i.user.username, chanName, 'drain');
        war = res.updatedWar;
        await saveMaster(master);

        await i.reply({
          content: `${res.success ? '✅' : '⚠️'} ${res.message}`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (i.customId.startsWith('trap_disarm_')) {
        const chanId = i.customId.replace('trap_disarm_', '');
        const chan = i.guild?.channels.cache.get(chanId);
        const chanName = chan ? `#${chan.name}` : `#${chanId}`;
        const res = disarmChannelTrapsInWar(war, i.user.id, chanName);
        war = res.updatedWar;
        await saveMaster(master);

        await i.reply({
          content: `🧹 ${res.message}`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (i.customId === 'war_place_trap_alarm') {
        const res = setChannelTrapInWar(war, i.user.id, i.user.username, currentChannelName, 'alarm');
        war = res.updatedWar;
        await saveMaster(master);
        await i.reply({ content: `${res.success ? '✅' : '⚠️'} ${res.message}`, flags: MessageFlags.Ephemeral });
        return;
      }

      if (i.customId === 'war_place_trap_drain') {
        const res = setChannelTrapInWar(war, i.user.id, i.user.username, currentChannelName, 'drain');
        war = res.updatedWar;
        await saveMaster(master);
        await i.reply({ content: `${res.success ? '✅' : '⚠️'} ${res.message}`, flags: MessageFlags.Ephemeral });
        return;
      }

      if (i.customId === 'disarm_all_traps') {
        const res = disarmChannelTrapsInWar(war, i.user.id);
        war = res.updatedWar;
        await saveMaster(master);
        await i.reply({ content: `🧹 ${res.message}`, flags: MessageFlags.Ephemeral });
        return;
      }
    });
  } catch (error: any) {
    console.error('Error executing /trap:', error);
    await interaction.reply({ content: `❌ Trap command error: ${error.message}`, flags: MessageFlags.Ephemeral });
  }
}
