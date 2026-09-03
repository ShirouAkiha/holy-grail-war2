/**
 * Slash Command: /trap
 * Description: Conceal or disarm Bounded Field traps in channels
 * Library: discord.js v14
 */

export const trapCommandCode = `import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder 
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
      .setDescription('Conceal a Bounded Field trap in a channel sector')
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
      .addStringOption(opt =>
        opt
          .setName('channel')
          .setDescription('Target channel (e.g. #general, defaults to current channel)')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('list')
      .setDescription('View your active channel traps')
  )
  .addSubcommand(sub =>
    sub
      .setName('disarm')
      .setDescription('Disarm and dissolve all your deployed channel traps')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    if (!master.servants || master.servants.length === 0) {
      await interaction.reply({
        ephemeral: true,
        content: '❌ You must summon a Servant before setting traps! Use \`/summon\` first.'
      });
      return;
    }

    let war = getOrInitWarSession(master);
    const sub = interaction.options.getSubcommand();
    const currentChannelName = interaction.channel && 'name' in interaction.channel 
      ? \`#\${(interaction.channel as any).name}\`
      : '#general';

    if (sub === 'set') {
      const trapType = interaction.options.getString('type', true) as 'alarm' | 'drain';
      const channelOpt = interaction.options.getString('channel');
      const targetChan = channelOpt || currentChannelName;

      const res = setChannelTrapInWar(war, interaction.user.id, interaction.user.username, targetChan, trapType);
      war = res.updatedWar;
      await saveMaster(master);

      const trapEmbed = new EmbedBuilder()
        .setTitle('🕸️ Bounded Field Trap Deployed')
        .setDescription(res.message)
        .setColor(trapType === 'alarm' ? 0xeab308 : 0xdc2626)
        .setFooter({ text: 'Holy Grail War Espionage & Perimeter Security' });

      await interaction.reply({ embeds: [trapEmbed], ephemeral: true });
      return;
    }

    if (sub === 'disarm') {
      const res = disarmChannelTrapsInWar(war, interaction.user.id);
      war = res.updatedWar;
      await saveMaster(master);

      await interaction.reply({
        content: \`🧹 **Traps Disarmed:** Dissolved \${res.disarmedCount} active Bounded Field trap(s).\`,
        ephemeral: true
      });
      return;
    }

    // list
    const userTraps = (war.channelTraps || []).filter(t => t.setterMasterId === interaction.user.id);
    let desc = '';
    if (userTraps.length === 0) {
      desc = 'You currently have **no active Bounded Field traps** deployed in any channels.\\n\\nUse \`/trap set type:<alarm | drain>\` to place one!';
    } else {
      desc = \`You currently have **\${userTraps.length}/2** active Bounded Field traps deployed across Fuyuki:\\n\\n\` +
        userTraps.map((t, idx) => {
          const typeLabel = t.trapType === 'alarm' ? '🚨 **Alarm Ward** (Exposes intruder identity)' : '🩸 **Bloodfort Drain** (Siphons 1,800 HP)';
          return \`**\${idx + 1}. Sector \${t.channelName}** — \${typeLabel}\\n*Deployed <t:\${Math.floor(t.createdAt / 1000)}:R>*\`;
        }).join('\\n\\n');
    }

    const trapsEmbed = new EmbedBuilder()
      .setTitle('🕸️ Active Bounded Field Traps')
      .setDescription(desc)
      .setColor(0x8b5cf6)
      .setFooter({ text: 'Bounded fields remain hidden until tripped by a rival Master' });

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

    await interaction.reply({ embeds: [trapsEmbed], components: [row], ephemeral: true });
  } catch (error: any) {
    console.error('Error executing /trap:', error);
    await interaction.reply({ content: \`❌ Trap command error: \${error.message}\`, ephemeral: true });
  }
}`;
