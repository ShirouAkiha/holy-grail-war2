/**
 * Slash Command: /familiar
 * Description: Dispatch or inspect reconnaissance familiars in Fuyuki sectors
 * Library: discord.js v14
 */

export const familiarCommandCode = `import { 
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
  dispatchFamiliarInWar, 
  recallFamiliarsInWar 
} from '../engine/grailwar';

export const data = new SlashCommandBuilder()
  .setName('familiar')
  .setDescription('🦅 Dispatch or view reconnaissance familiars in Fuyuki sectors')
  .addSubcommand(sub =>
    sub
      .setName('dispatch')
      .setDescription('Deploy a reconnaissance familiar to a channel sector')
      .addStringOption(opt =>
        opt
          .setName('type')
          .setDescription('Choose familiar archetype')
          .setRequired(true)
          .addChoices(
            { name: '🦅 Scouting Raven (Aerial surveillance & Master tracking)', value: 'raven' },
            { name: '🗿 Homunculus Decoy (Bodyguard absorbing 100% ambush damage)', value: 'homunculus' },
            { name: '🦇 Shadow Imp (Saboteur siphoning HP & eavesdropping)', value: 'shadow_imp' }
          )
      )
      .addStringOption(opt =>
        opt
          .setName('channel')
          .setDescription('Target sector/channel (e.g. #general, defaults to current channel)')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('list')
      .setDescription('View active familiar network and surveillance logs')
  )
  .addSubcommand(sub =>
    sub
      .setName('recall')
      .setDescription('Recall and dismiss all deployed familiars')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    if (!master.servants || master.servants.length === 0) {
      await interaction.reply({
        ephemeral: true,
        content: '❌ You must summon a Servant before dispatching familiars! Use \`/summon\` first.'
      });
      return;
    }

    let war = getOrInitWarSession(master);
    const sub = interaction.options.getSubcommand();
    const currentChannelName = interaction.channel && 'name' in interaction.channel 
      ? \`#\${(interaction.channel as any).name}\`
      : '#general';

    if (sub === 'dispatch') {
      const famType = interaction.options.getString('type', true) as 'raven' | 'homunculus' | 'shadow_imp';
      const channelOpt = interaction.options.getString('channel');
      const targetChan = channelOpt || currentChannelName;

      const res = dispatchFamiliarInWar(war, interaction.user.id, interaction.user.username, targetChan, famType);
      war = res.updatedWar;
      await saveMaster(master);

      const embed = new EmbedBuilder()
        .setTitle('🦅 Reconnaissance Familiar Dispatched')
        .setDescription(res.message)
        .setColor(famType === 'homunculus' ? 0x10b981 : famType === 'shadow_imp' ? 0x8b5cf6 : 0x0ea5e9)
        .setFooter({ text: 'Familiars actively gather intelligence and shield their Masters' });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (sub === 'recall') {
      const res = recallFamiliarsInWar(war, interaction.user.id);
      war = res.updatedWar;
      await saveMaster(master);

      await interaction.reply({
        content: \`🕊️ **Familiars Recalled:** Dismissed \${res.recalledCount} active familiar(s).\`,
        ephemeral: true
      });
      return;
    }

    // list
    const userFamiliars = (war.familiars || []).filter(f => f.ownerMasterId === interaction.user.id);
    let desc = '';
    if (userFamiliars.length === 0) {
      desc = 'You currently have **no active familiars** deployed in any channels.\\n\\nUse \`/familiar dispatch\` to deploy one!';
    } else {
      desc = \`You currently have **\${userFamiliars.length}/3** active familiars stationed across Fuyuki:\\n\\n\` +
        userFamiliars.map((f, idx) => {
          const typeLabel = f.type === 'raven'
            ? '🦅 **Scouting Raven** (Aerial Surveillance)'
            : f.type === 'homunculus'
            ? '🗿 **Homunculus Decoy** (Bodyguard - 100% Ambush Block)'
            : '🦇 **Shadow Imp** (Sabotage & Siphon)';
          const intelLogs = (f.detectedIntel && f.detectedIntel.length > 0)
            ? \`\\n  ↳ **Surveillance Logs:**\\n  \${f.detectedIntel.slice(0, 3).join('\\n  ')}\`
            : \`\\n  ↳ *No movement observed yet.*\`;
          return \`**\${idx + 1}. Sector \${f.channelName}** — \${typeLabel}\\n*Deployed <t:\${Math.floor(f.createdAt / 1000)}:R>*\${intelLogs}\`;
        }).join('\\n\\n');
    }

    const embed = new EmbedBuilder()
      .setTitle('🦅 Active Familiar Reconnaissance Network')
      .setDescription(desc)
      .setColor(0x0ea5e9)
      .setFooter({ text: 'Familiars gather intelligence and shield their Masters' });

    const row = new ActionRowBuilder<ButtonBuilder>();
    if (userFamiliars.length > 0) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId('recall_all_familiars')
          .setLabel('Recall All Familiars')
          .setEmoji('🕊️')
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

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  } catch (error: any) {
    console.error('Error executing /familiar:', error);
    await interaction.reply({ content: \`❌ Familiar command error: \${error.message}\`, ephemeral: true });
  }
}`;
