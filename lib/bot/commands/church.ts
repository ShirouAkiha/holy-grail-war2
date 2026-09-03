/**
 * Slash Command: /church
 * Description: Fuyuki Church neutral sanctuary asylum under Father Kotomine
 * Library: discord.js v14
 */

export const churchCommandCode = `import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  ComponentType
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { 
  getOrInitWarSession,
  enterChurchSanctuary,
  leaveChurchSanctuary
} from '../engine/grailwar';

export const data = new SlashCommandBuilder()
  .setName('church')
  .setDescription('⛪ Fuyuki Church — Claim or depart neutral asylum under Father Kotomine')
  .addStringOption(opt =>
    opt
      .setName('action')
      .setDescription('Sanctuary Action: status (view rules), enter (claim asylum), leave (re-enter war)')
      .setRequired(false)
      .addChoices(
        { name: '⛪ View Sanctuary Status', value: 'status' },
        { name: '🕊️ Enter Church Sanctuary (Claim Asylum)', value: 'enter' },
        { name: '🚪 Leave Church Sanctuary (Re-enter War)', value: 'leave' }
      )
  );

export function buildChurchEmbed(userParticipant: any, lastMsg?: string) {
  if (!userParticipant) {
    return new EmbedBuilder()
      .setTitle('⛪ Fuyuki Church — Neutral Sanctuary Grounds')
      .setDescription('❌ You are currently an innocent civilian with no contracted Servant. Use \`/summon\` to summon a Heroic Spirit and enter the Holy Grail War.')
      .setColor(0x71717a);
  }

  const inSanctuary = !!userParticipant.inSanctuary;
  return new EmbedBuilder()
    .setTitle('⛪ Fuyuki Church — Neutral Sanctuary Grounds')
    .setDescription(
      \`*Father Kirei Kotomine presides over the neutral grounds of the Fuyuki Church.*\\n\\n\` +
      (lastMsg ? \`📢 **Action Outcome:**\\n\${lastMsg}\\n\\n\` : '') +
      \`Under Holy Church oversight and imperial leylines, Masters seeking reprieve from the Holy Grail War may claim asylum here.\\n\\n\` +
      \`• **Your Current Sanctuary Status:** \${inSanctuary ? '🕊️ **ACTIVE ASYLUM** (Immune to all ambushes & attacks)' : '⚔️ **IN THE FIELD** (Active combatant)'}\\n\` +
      \`• **Asylum Inviolability:** No Master may target, ambush, or skirmish against anyone sheltered within the church.\\n\` +
      \`• **Truce Binding:** Masters in sanctuary cannot launch ambushes or attack rivals until they formally depart.\\n\\n\` +
      \`*Use the interactive buttons below or run \\\`/church action:enter\\\` and \\\`/church action:leave\\\`:*\`
    )
    .setColor(inSanctuary ? 0x10b981 : 0x6366f1)
    .setFooter({ text: 'Holy Church Overseer Protocol • Fuyuki City Neutral Zone' });
}

export function buildChurchButtons(userParticipant: any) {
  const inSanctuary = !!userParticipant?.inSanctuary;
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(inSanctuary ? 'church_leave' : 'church_enter')
      .setLabel(inSanctuary ? 'Leave Sanctuary 🚪' : 'Enter Church Sanctuary ⛪')
      .setStyle(inSanctuary ? ButtonStyle.Danger : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('quick_war_defenses')
      .setLabel('Mage Defenses 🏰')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('war_status_board')
      .setLabel('War Board 📋')
      .setStyle(ButtonStyle.Secondary)
  );
  return [row];
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);

    if (!master.servants || master.servants.length === 0) {
      await interaction.reply({
        ephemeral: true,
        content: '📜 Civilian Spectator Dossier: You are currently an innocent bystander in Fuyuki City with no contracted Servant. Use \`/summon\` to establish a covenant and enter the Holy Grail War.'
      });
      return;
    }

    let war = getOrInitWarSession(master);
    let lastMsg: string | undefined = undefined;

    const action = interaction.options.getString('action') || 'status';

    if (action === 'enter') {
      const res = enterChurchSanctuary(war, interaction.user.id);
      war = res.updatedWar;
      lastMsg = res.message;
      await saveMaster(master);
    } else if (action === 'leave') {
      const res = leaveChurchSanctuary(war, interaction.user.id);
      war = res.updatedWar;
      lastMsg = res.message;
      await saveMaster(master);
    }

    const userParticipant = war.participants[interaction.user.id];
    const churchEmbed = buildChurchEmbed(userParticipant, lastMsg);
    const churchButtons = buildChurchButtons(userParticipant);

    const reply = await interaction.reply({
      embeds: [churchEmbed],
      components: churchButtons,
      ephemeral: true,
      withResponse: true
    });

    const collector = reply.resource?.message?.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000
    });

    if (!collector) return;

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: '❌ You can only manage your own church sanctuary status.', ephemeral: true });
        return;
      }

      const freshMaster = await getOrCreateMaster(i.user.id, i.user.username);
      let currentWar = getOrInitWarSession(freshMaster);
      let outcomeMsg = '';

      if (i.customId === 'church_enter') {
        const res = enterChurchSanctuary(currentWar, i.user.id);
        currentWar = res.updatedWar;
        outcomeMsg = res.message;
        await saveMaster(freshMaster);
      } else if (i.customId === 'church_leave') {
        const res = leaveChurchSanctuary(currentWar, i.user.id);
        currentWar = res.updatedWar;
        outcomeMsg = res.message;
        await saveMaster(freshMaster);
      }

      const uP = currentWar.participants[i.user.id];
      await i.update({
        embeds: [buildChurchEmbed(uP, outcomeMsg)],
        components: buildChurchButtons(uP)
      });
    });
  } catch (error: any) {
    console.error('Error executing /church:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ ephemeral: true, content: \`❌ Error in Church Sanctuary: \${error.message}\` });
    }
  }
}`;
