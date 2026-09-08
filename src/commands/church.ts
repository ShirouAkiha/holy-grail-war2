import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  ComponentType,
  MessageFlags 
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { 
  getOrInitWarSession,
  enterChurchSanctuary,
  leaveChurchSanctuary,
  getReputationInfo
} from '../engine/grailwar';

export const data = new SlashCommandBuilder()
  .setName('church')
  .setDescription('⛪ Fuyuki Church — Neutral asylum, reputation standing & bounty registry under Father Kotomine')
  .addStringOption(opt =>
    opt
      .setName('action')
      .setDescription('Sanctuary Action: status (view rules), enter (claim asylum), leave (re-enter war), bounties, reputation')
      .setRequired(false)
      .addChoices(
        { name: '⛪ View Sanctuary & Church Status', value: 'status' },
        { name: '🕊️ Enter Church Sanctuary (Claim Asylum)', value: 'enter' },
        { name: '🚪 Leave Church Sanctuary (Re-enter War)', value: 'leave' },
        { name: '🎯 View Extermination Bounties', value: 'bounties' },
        { name: '📜 View Reputation Dossier', value: 'reputation' }
      )
  );

export function buildChurchEmbed(userParticipant: any, war?: any, lastMsg?: string) {
  if (!userParticipant) {
    return new EmbedBuilder()
      .setTitle('⛪ Fuyuki Church — Neutral Sanctuary Grounds')
      .setDescription('❌ You are currently an innocent civilian with no contracted Servant. Use `/summon` to summon a Heroic Spirit and enter the Holy Grail War.')
      .setColor(0x71717a);
  }

  const inSanctuary = !!userParticipant.inSanctuary;
  const kills = userParticipant.innocentKills || 0;
  const rep = getReputationInfo(kills);

  const participants = war ? Object.values(war.participants || {}) : [];
  const rogueMasters: any[] = participants.filter(
    (p: any) => p.isAlive && (((p.innocentKills || 0) >= 10) || p.bountyActive || p.isRogueHeretic)
  );

  let bountyNotice = '';
  if (rogueMasters.length > 0) {
    bountyNotice = `\n\n🎯 **ACTIVE CHURCH BOUNTIES (${rogueMasters.length} WANTED):**\n` +
      rogueMasters.map((r: any) => `• ☠️ **${r.username}** (${r.servantName || 'Servant'} [${r.servantClass || 'Class'}]) — **${r.innocentKills || 10} Kills** (Reward: **+1 CS** & **+15 SQ**)`).join('\n');
  } else {
    bountyNotice = `\n\n🎯 **ACTIVE CHURCH BOUNTIES:** No active rogue heretic bounties currently listed.`;
  }

  let standingNotice = `• **Your Church Standing:** ${rep.badge} (\`${kills}/10\` Civilian Kills)\n`;
  if (rep.isRogue) {
    standingNotice += `  ↳ ☠️ **EXCOMMUNICATED ROGUE HERETIC:** Sanctuary barred. +1 CS & +15 SQ bounty on your head.\n`;
  } else if (kills >= 7) {
    standingNotice += `  ↳ 🩸 **High Inquisitorial Scrutiny:** Approaching 10 kills excommunication threshold.\n`;
  } else if (kills >= 4) {
    standingNotice += `  ↳ ⚠️ **Reprimanded:** Monitored for Secrecy of Magecraft violations.\n`;
  } else {
    standingNotice += `  ↳ 🕊️ **In Good Standing:** Full sanctuary and arbitration rights active.\n`;
  }

  return new EmbedBuilder()
    .setTitle('⛪ Fuyuki Church — Neutral Sanctuary Grounds')
    .setDescription(
      `*Father Kirei Kotomine presides over the neutral grounds of the Fuyuki Church.*\n\n` +
      (lastMsg ? `📢 **Action Outcome:**\n${lastMsg}\n\n` : '') +
      `Under Holy Church oversight and imperial leylines, Masters seeking reprieve from the Holy Grail War may claim asylum here.\n\n` +
      `• **Your Current Sanctuary Status:** ${inSanctuary ? '🕊️ **ACTIVE ASYLUM** (Immune to all ambushes & attacks)' : '⚔️ **IN THE FIELD** (Active combatant)'}\n` +
      standingNotice +
      `• **Asylum Inviolability:** No Master may target, ambush, or skirmish against anyone sheltered within the church.\n` +
      `• **Truce Binding:** Masters in sanctuary cannot launch ambushes or attack rivals until they formally depart.` +
      bountyNotice +
      `\n\n*Use the interactive buttons below or run \`/church action:enter\` and \`/church action:leave\`:*`
    )
    .setColor(rep.isRogue ? 0xef4444 : inSanctuary ? 0x10b981 : 0x6366f1)
    .setFooter({ text: 'Holy Church Overseer Protocol • Fuyuki City Neutral Zone' });
}

export function buildChurchButtons(userParticipant: any) {
  const inSanctuary = !!userParticipant?.inSanctuary;
  const isRogue = (userParticipant?.innocentKills || 0) >= 10 || userParticipant?.bountyActive;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(inSanctuary ? 'church_leave' : 'church_enter')
      .setLabel(inSanctuary ? 'Leave Sanctuary 🚪' : 'Enter Church Sanctuary ⛪')
      .setStyle(inSanctuary ? ButtonStyle.Danger : ButtonStyle.Primary)
      .setDisabled(isRogue && !inSanctuary),
    new ButtonBuilder()
      .setCustomId('war_tab_bounties')
      .setLabel('Bounty Registry 🎯')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('war_tab_board')
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
        flags: MessageFlags.Ephemeral,
        content: '📜 Civilian Spectator Dossier: You are currently an innocent bystander in Fuyuki City with no contracted Servant. Use `/summon` to establish a covenant and enter the Holy Grail War.'
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
    const churchEmbed = buildChurchEmbed(userParticipant, war, lastMsg);
    const churchButtons = buildChurchButtons(userParticipant);

    await interaction.reply({
      embeds: [churchEmbed],
      components: churchButtons,
      flags: MessageFlags.Ephemeral
    });
  } catch (error: any) {
    console.error('Error executing /church:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: `❌ Error in Church Sanctuary: ${error.message}` });
    }
  }
}
