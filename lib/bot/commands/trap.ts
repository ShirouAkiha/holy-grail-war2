/**
 * Slash Command: /trap
 * Description: Conceal or disarm Bounded Field traps, Workshop Wards, and Command Seals in channels
 * Library: discord.js v14
 */

export const trapCommandCode = `import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  ChannelType
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { 
  getOrInitWarSession, 
  setChannelTrapInWar, 
  disarmChannelTrapsInWar,
  setWorkshopWardInWar,
  useCommandSealInWar
} from '../engine/grailwar';

export const data = new SlashCommandBuilder()
  .setName('trap')
  .setDescription('🕸️ Place or manage concealed Bounded Field traps, Workshop Wards, and Command Seals')
  .addSubcommand(sub =>
    sub
      .setName('set')
      .setDescription('Conceal a Bounded Field trap or Workshop Ward')
      .addStringOption(opt =>
        opt
          .setName('type')
          .setDescription('Choose Bounded Field or Ward type')
          .setRequired(true)
          .addChoices(
            { name: '🚨 Alarm Ward (Exposes intruder identity & Servant Class)', value: 'alarm' },
            { name: '🩸 Bloodfort Drain (Siphons 1,800 HP from intruder to your Servant)', value: 'drain' },
            { name: '🛡️ Mage Sanctuary Ward (Absorbs 60% incoming ambush damage)', value: 'sanctuary' },
            { name: '🗿 Homunculus Decoy Ward (Absorbs 100% incoming ambush damage)', value: 'decoy' }
          )
      )
      .addChannelOption(opt =>
        opt
          .setName('channel')
          .setDescription('Actual Discord channel to anchor (for channel traps)')
          .addChannelTypes(ChannelType.GuildText)
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
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(false)
      )
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

    if (sub === 'seal') {
      const act = interaction.options.getString('action', true);
      if (act === 'heal') {
        const res = useCommandSealInWar(war, interaction.user.id, 'heal');
        war = res.updatedWar;
        await saveMaster(master);
        await interaction.reply({ content: res.message, ephemeral: true });
        return;
      } else if (act === 'evac') {
        const res = useCommandSealInWar(war, interaction.user.id, 'toggle_evac');
        war = res.updatedWar;
        await saveMaster(master);
        await interaction.reply({ content: res.message, ephemeral: true });
        return;
      }
    }

    if (sub === 'set') {
      const trapType = interaction.options.getString('type', true);
      if (trapType === 'sanctuary') {
        const res = setWorkshopWardInWar(war, interaction.user.id, 'ward');
        war = res.updatedWar;
        await saveMaster(master);
        await interaction.reply({ content: res.message, ephemeral: true });
        return;
      } else if (trapType === 'decoy') {
        const res = setWorkshopWardInWar(war, interaction.user.id, 'decoy');
        war = res.updatedWar;
        await saveMaster(master);
        await interaction.reply({ content: res.message, ephemeral: true });
        return;
      }

      const channelOpt = interaction.options.getChannel('channel');
      const targetChan = channelOpt && 'name' in channelOpt 
        ? \`#\${(channelOpt as any).name}\` 
        : currentChannelName;

      const res = setChannelTrapInWar(war, interaction.user.id, interaction.user.username, targetChan, trapType as 'alarm' | 'drain');
      war = res.updatedWar;
      await saveMaster(master);

      if (!res.success) {
        const errorEmbed = new EmbedBuilder()
          .setTitle('⚠️ Bounded Field Interrupted')
          .setDescription(res.message)
          .setColor(0xef4444)
          .setFooter({ text: 'Holy Grail War Espionage & Perimeter Security' });

        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        return;
      }

      const trapEmbed = new EmbedBuilder()
        .setTitle('🕸️ Bounded Field Trap Deployed')
        .setDescription(res.message)
        .setColor(trapType === 'alarm' ? 0xeab308 : 0xdc2626)
        .setFooter({ text: 'Holy Grail War Espionage & Perimeter Security' });

      await interaction.reply({ embeds: [trapEmbed], ephemeral: true });
      return;
    }

    if (sub === 'disarm') {
      const channelOpt = interaction.options.getChannel('channel');
      const targetChan = channelOpt && 'name' in channelOpt ? \`#\${(channelOpt as any).name}\` : undefined;
      const res = disarmChannelTrapsInWar(war, interaction.user.id, targetChan);
      war = res.updatedWar;
      await saveMaster(master);

      await interaction.reply({
        content: res.message,
        ephemeral: true
      });
      return;
    }

    // list
    const userTraps = (war.channelTraps || []).filter(t => t.setterMasterId === interaction.user.id);
    const uP = war.participants[interaction.user.id];
    const wardType = uP?.boundedField || 'none';
    const autoEvac = uP?.autoEvadeEnabled === true;
    const csCount = uP?.commandSeals ?? 3;

    let desc = '';
    if (userTraps.length === 0) {
      desc = '📍 **YOUR ACTIVE BOUNDED FIELDS (0/3):**\\n• *You currently have no active Bounded Fields deployed in any channel sectors.*\\n• Use \`/trap set\` and select a target channel to anchor one!';
    } else {
      desc = '📍 **YOUR ACTIVE BOUNDED FIELDS (' + userTraps.length + '/3):**\\n' +
        userTraps.map((t, idx) => {
          const typeLabel = t.trapType === 'alarm' 
            ? '🚨 **Sensory Alarm Ward** (Exposes intruder identity & Servant class)' 
            : '🩸 **Bloodfort Drain** (Siphons 1,800 HP from intruder)';
          return '**' + (idx + 1) + '. Sector \`' + t.channelName + '\`** — ' + typeLabel + '\\n*Status: 🟢 Armed & Concealed • Deployed <t:' + Math.floor(t.createdAt / 1000) + ':R>*';
        }).join('\\n\\n');
    }

    // Workshop Ward Status
    let workshopDesc = '🚫 **No Workshop Ward Active**';
    if (wardType === 'ward') {
      workshopDesc = '🛡️ **Mage Sanctuary Bounded Field:** Absorbs & deflects **60% of incoming ambush damage**.';
    } else if (wardType === 'decoy') {
      workshopDesc = '🗿 **Homunculus Decoy:** Sacrifices an artificial homunculus to absorb **100% of incoming ambush damage**.';
    } else if (wardType === 'alarm') {
      workshopDesc = '🚨 **Sensory Alarm Trap:** Detects infiltrators, alerting you and dealing **3,000 retaliatory DMG**.';
    }

    // Dynamic Sector Radar
    const defaultSectors = ['#holy-grail-war', '#general', currentChannelName];
    const allSectors = Array.from(new Set([...defaultSectors, ...(war.channelTraps || []).map(t => t.channelName)]));
    const radarLines = allSectors.map(secName => {
      const activeTrap = (war.channelTraps || []).find(t => t.channelName.toLowerCase() === secName.toLowerCase());
      if (!activeTrap) {
        return '• \`' + secName + '\`: ✨ **Clear** *(Available to anchor)*';
      }
      if (activeTrap.setterMasterId === interaction.user.id) {
        const icon = activeTrap.trapType === 'alarm' ? '🚨' : '🩸';
        return '• \`' + secName + '\`: ' + icon + ' **Armed by You** (' + (activeTrap.trapType === 'alarm' ? 'Alarm Ward' : 'Bloodfort Drain') + ')';
      }
      return '• \`' + secName + '\`: 🔒 **Occupied** *(Master ' + activeTrap.setterUsername + ')*';
    }).join('\\n');

    const fullDesc = 
      '🏰 **WORKSHOP DEFENSES & WARDS:**\\n' + workshopDesc + '\\n\\n' +
      '📜 **COMMAND SEALS & AUTO-EVAC:**\\n' +
      '• **Remaining Seals:** ' + csCount + '/3\\n' +
      '• **Auto-Evacuate Ward:** ' + (autoEvac ? '🟢 ENABLED' : '🔴 DISABLED') + '\\n\\n' +
      desc + '\\n\\n🗺️ **ACTIVE CHANNELS RADAR:**\\n' + radarLines;

    const trapsEmbed = new EmbedBuilder()
      .setTitle('🕸️ Bounded Fields, Workshop Wards & Command Seals')
      .setDescription(fullDesc)
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
