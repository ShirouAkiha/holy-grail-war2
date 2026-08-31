import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  ComponentType
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { HolyGrailWarSession } from '../types';
import { createHolyGrailWarSession, executeWarAction, simulateWarSkirmish } from '../engine/grailwar';

// ==========================================
// 1. SLASH COMMAND DEFINITION
// ==========================================
export const data = new SlashCommandBuilder()
  .setName('grailwar')
  .setDescription('Holy Grail War 7-Master Battle Royale operations')
  .addSubcommand(sub =>
    sub
      .setName('status')
      .setDescription('View current Holy Grail War status and surviving Masters')
  )
  .addSubcommand(sub =>
    sub
      .setName('skirmish')
      .setDescription('Simulate a background clash between rival Masters')
  )
  .addSubcommand(sub =>
    sub
      .setName('rest')
      .setDescription('Channel mana to restore Servant HP')
  );

// Global active Grail War session for Discord
let activeSession: HolyGrailWarSession | null = null;

// ==========================================
// 2. SESSION INITIALIZER
// ==========================================
function getOrInitWarSession(master: any): HolyGrailWarSession {
  const activeServant =
    master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];

  if (!activeSession) {
    activeSession = createHolyGrailWarSession({
      discordId: master.discordId,
      username: master.username,
      servantId: activeServant?.id || 'servant_artoria',
      servantName: activeServant?.template?.name || 'Artoria Pendragon',
      avatarUrl: activeServant?.template?.avatarUrl || '',
      maxHp: activeServant?.template?.baseHp || 15000
    });
  } else {
    if (!activeSession.participants[master.discordId] && activeServant) {
      activeSession.participants[master.discordId] = {
        discordId: master.discordId,
        username: master.username,
        servantId: activeServant.id,
        servantName: activeServant.template.name,
        servantClass: activeServant.template.servantClass,
        avatarUrl: activeServant.template.avatarUrl,
        currentHp: activeServant.template.baseHp || 15000,
        maxHp: activeServant.template.baseHp || 15000,
        commandSeals: master.commandSeals || 3,
        isAlive: true,
        kills: 0
      };
    }
  }

  return activeSession;
}

// ==========================================
// 3. WAR EMBED BUILDER
// ==========================================
function buildWarEmbed(war: HolyGrailWarSession, userParticipant: any, lastMsg?: string) {
  const aliveParticipants = Object.values(war.participants).filter(p => p.isAlive);

  const rosterList = Object.values(war.participants)
    .map(m => `• ${m.isAlive ? '🟢' : '💀'} **${m.username}** (${m.servantName} - ${m.servantClass}) — HP: ${m.currentHp.toLocaleString()}/${m.maxHp.toLocaleString()} | Kills: ${m.kills}`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${war.title}`)
    .setDescription(
      `**Status:** ${war.status.toUpperCase()} | **Alive Masters:** **${aliveParticipants.length}/7**\n` +
      (userParticipant
        ? `\n👤 **Your Master Status:**\n` +
          `• Servant: **${userParticipant.servantName}** (${userParticipant.servantClass})\n` +
          `• HP: **${userParticipant.currentHp.toLocaleString()}/${userParticipant.maxHp.toLocaleString()}** | Command Seals: **${userParticipant.commandSeals}/3** | Kills: **${userParticipant.kills}**\n\n`
        : '\n') +
      (lastMsg ? `📢 **Latest Event:**\n${lastMsg}\n\n` : '') +
      `⚔️ **7 Masters Roster:**\n${rosterList}\n\n` +
      `*Choose a tactical command below or challenge rivals with \`/duel\`:*`
    )
    .setColor(0xd4af37);

  return embed;
}

// ==========================================
// 4. ACTION BUTTONS (Duel, Heal, Skirmish)
// ==========================================
function buildWarButtons() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('war_duel')
      .setLabel('Challenge Duel (/duel)')
      .setEmoji('⚔️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('war_rest')
      .setLabel('Channel Mana (Heal)')
      .setEmoji('🩹')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('war_skirmish')
      .setLabel('Simulate Rival Clash')
      .setEmoji('💥')
      .setStyle(ButtonStyle.Primary)
  );
}

// ==========================================
// 5. COMMAND EXECUTION
// ==========================================
export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);

    if (!master.servants || master.servants.length === 0) {
      await interaction.reply({
        ephemeral: true,
        content: '❌ You cannot enter the Holy Grail War without a contracted Servant! Use `/summon` first.'
      });
      return;
    }

    const war = getOrInitWarSession(master);
    const userParticipant = war.participants[interaction.user.id];

    const subcommand = interaction.options.getSubcommand();
    let initialMsg = '';

    if (subcommand === 'skirmish') {
      const res = simulateWarSkirmish(war);
      initialMsg = res.message;
    } else if (subcommand === 'rest') {
      const res = executeWarAction(war, interaction.user.id, 'rest_and_heal');
      initialMsg = res.message;
      await saveMaster(master);
    }

    const embed = buildWarEmbed(war, userParticipant, initialMsg);
    const row = buildWarButtons();

    const reply = await interaction.reply({
      embeds: [embed],
      components: [row],
      fetchReply: true
    });

    setupWarCollector(reply, interaction.user.id);

  } catch (error: any) {
    console.error('Error executing /grailwar:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: `❌ Error: ${error.message}`, ephemeral: true });
    } else {
      await interaction.reply({ content: `❌ Error: ${error.message}`, ephemeral: true });
    }
  }
}

// ==========================================
// 6. INTERACTIVE TACTICAL WAR COLLECTOR
// ==========================================
function setupWarCollector(message: any, userId: string) {
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120000
  });

  collector.on('collect', async (i: any) => {
    if (i.user.id !== userId) {
      await i.reply({ content: 'Only the Master who issued this war command can control these actions.', ephemeral: true });
      return;
    }

    try {
      const master = await getOrCreateMaster(i.user.id, i.user.username);
      const war = getOrInitWarSession(master);
      let actionResultMsg = '';

      if (i.customId === 'war_duel') {
        await i.reply({ content: 'Use `/duel` to initiate tactical turn-based combat against a rival Master!', ephemeral: true });
        return;
      } 
      else if (i.customId === 'war_rest') {
        const res = executeWarAction(war, i.user.id, 'rest_and_heal');
        actionResultMsg = res.message;
        await saveMaster(master);
      } 
      else if (i.customId === 'war_skirmish') {
        const res = simulateWarSkirmish(war);
        actionResultMsg = res.message;
      }

      const userParticipant = war.participants[i.user.id];
      const updatedEmbed = buildWarEmbed(war, userParticipant, actionResultMsg);
      const updatedRow = buildWarButtons();

      await i.update({ embeds: [updatedEmbed], components: [updatedRow] });
    } catch (err: any) {
      console.error('Error in grail war collector:', err);
    }
  });
}
