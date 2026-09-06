import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  ChannelType,
  MessageFlags
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { 
  getOrInitWarSession, 
  setChannelTrapInWar, 
  disarmChannelTrapsInWar 
} from '../engine/grailwar';

export const data = new SlashCommandBuilder()
  .setName('trap')
  .setDescription('🕸️ Place or manage concealed Bounded Field traps in channels')
  .addSubcommand(sub =>
    sub
      .setName('set')
      .setDescription('Conceal a Bounded Field trap in an actual Discord channel')
      .addStringOption(opt =>
        opt
          .setName('type')
          .setDescription('Choose Bounded Field trap type')
          .setRequired(true)
          .addChoices(
            { name: '🚨 Alarm Ward (Exposes intruder identity & Servant Class)', value: 'alarm' },
            { name: '🩸 Bloodfort Drain (Siphons 1,800 HP from intruder to your Servant)', value: 'drain' }
          )
      )
      .addChannelOption(opt =>
        opt
          .setName('channel')
          .setDescription('Actual Discord channel to anchor the Bounded Field in (defaults to current channel)')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('list')
      .setDescription('View where your active channel Bounded Fields are deployed')
  )
  .addSubcommand(sub =>
    sub
      .setName('disarm')
      .setDescription('Disarm and dissolve your deployed channel traps')
      .addChannelOption(opt =>
        opt
          .setName('channel')
          .setDescription('Specific Discord channel to disarm (leave blank to disarm all)')
          .addChannelTypes(ChannelType.GuildText)
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
    const sub = interaction.options.getSubcommand();
    const currentChannelName = interaction.channel && 'name' in interaction.channel 
      ? `#${(interaction.channel as any).name}`
      : '#general';

    if (sub === 'set') {
      const trapType = interaction.options.getString('type', true) as 'alarm' | 'drain';
      const channelOpt = interaction.options.getChannel('channel');
      const targetChan = channelOpt && 'name' in channelOpt 
        ? `#${channelOpt.name}` 
        : currentChannelName;

      const res = setChannelTrapInWar(war, interaction.user.id, interaction.user.username, targetChan, trapType);
      war = res.updatedWar;
      await saveMaster(master);

      if (!res.success) {
        const errorEmbed = new EmbedBuilder()
          .setTitle('⚠️ Bounded Field Interrupted')
          .setDescription(res.message)
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

    // list
    const userTraps = (war.channelTraps || []).filter(t => t.setterMasterId === interaction.user.id);
    let desc = '';
    if (userTraps.length === 0) {
      desc = '📍 **YOUR ACTIVE BOUNDED FIELDS (0/2):**\n• *You currently have no active Bounded Fields deployed in any channel sectors.*\n• Use `/trap set` and select a target channel to anchor one!';
    } else {
      desc = `📍 **YOUR ACTIVE BOUNDED FIELDS (${userTraps.length}/2):**\n` +
        userTraps.map((t, idx) => {
          const typeLabel = t.trapType === 'alarm' 
            ? '🚨 **Sensory Alarm Ward** (Exposes intruder identity & Servant class)' 
            : '🩸 **Bloodfort Drain** (Siphons 1,800 HP from intruder)';
          return `**${idx + 1}. Sector \`${t.channelName}\`** — ${typeLabel}\n*Status: 🟢 Armed & Concealed • Deployed <t:${Math.floor(t.createdAt / 1000)}:R>*`;
        }).join('\n\n');
    }

    // Dynamic Sector Radar for all active traps and default channels
    const defaultSectors = ['#holy-grail-war', '#general', currentChannelName];
    const allSectors = Array.from(new Set([...defaultSectors, ...(war.channelTraps || []).map(t => t.channelName)]));
    const radarLines = allSectors.map(secName => {
      const activeTrap = (war.channelTraps || []).find(t => t.channelName.toLowerCase() === secName.toLowerCase());
      if (!activeTrap) {
        return `• \`${secName}\`: ✨ **Clear** *(Available to anchor)*`;
      }
      if (activeTrap.setterMasterId === interaction.user.id) {
        const icon = activeTrap.trapType === 'alarm' ? '🚨' : '🩸';
        return `• \`${secName}\`: ${icon} **Armed by You** (${activeTrap.trapType === 'alarm' ? 'Alarm Ward' : 'Bloodfort Drain'})`;
      }
      return `• \`${secName}\`: 🔒 **Occupied** *(Master ${activeTrap.setterUsername})*`;
    }).join('\n');

    const fullDesc = desc + '\n\n🗺️ **ACTIVE CHANNELS RADAR:**\n' + radarLines;

    const trapsEmbed = new EmbedBuilder()
      .setTitle('🕸️ Bounded Field Traps & Radar')
      .setDescription(fullDesc)
      .setColor(0x8b5cf6)
      .setFooter({ text: 'Only 1 Bounded Field can exist per channel • Max 2 active per Master' });

    const row = new ActionRowBuilder<ButtonBuilder>();
    if (userTraps.length > 0) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId('disarm_all_traps')
          .setLabel('Disarm All Traps')
          .setEmoji('🧹')
          .setStyle(ButtonStyle.Danger)
      );
    }
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('war_status_board')
        .setLabel('Grail War Status')
        .setEmoji('📜')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [trapsEmbed], components: [row], flags: MessageFlags.Ephemeral });
  } catch (error: any) {
    console.error('Error executing /trap:', error);
    await interaction.reply({ content: `❌ Trap command error: ${error.message}`, flags: MessageFlags.Ephemeral });
  }
}
