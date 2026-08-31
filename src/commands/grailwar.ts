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
import { 
  getOrInitWarSession,
  executeWarAction, 
  simulateWarSkirmish,
  attackSuspectUserInWar,
  leakIntelInWar 
} from '../engine/grailwar';

// ==========================================
// 1. SLASH COMMAND DEFINITION
// ==========================================
export const data = new SlashCommandBuilder()
  .setName('grailwar')
  .setDescription('Holy Grail War 7-Master Battle Royale operations')
  .addSubcommand(sub =>
    sub
      .setName('status')
      .setDescription('View 7-Master Intelligence Roster, Leaked Intel, and War Chronicle')
  )
  .addSubcommand(sub =>
    sub
      .setName('attack')
      .setDescription('Ambush a suspected Master (if civilian, they die & you get exposed!)')
      .addStringOption(opt =>
        opt.setName('target')
          .setDescription('The username, @mention, or ID of the suspected Master')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('leak')
      .setDescription('Leak intelligence into the Grail War surveillance network to expose shadow Masters')
      .addStringOption(opt =>
        opt.setName('intel')
          .setDescription('Intelligence report text (e.g. "Spotted Archer near the bridge")')
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName('target')
          .setDescription('Optional: Mention or name of suspected Master to expose')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('skirmish')
      .setDescription('Simulate a background clash between rival shadow Masters in the city')
  )
  .addSubcommand(sub =>
    sub
      .setName('rest')
      .setDescription('Channel mana to restore Servant HP')
  )
  .addSubcommand(sub =>
    sub
      .setName('betray')
      .setDescription('Break an active covenant and strike an ally with a surprise assault')
  );

// ==========================================
// 2. WAR EMBED BUILDER (Rich 7-Master Board + Chronicle)
// ==========================================
function buildWarEmbed(war: HolyGrailWarSession, userParticipant: any, lastMsg?: string) {
  const participants = Object.values(war.participants);
  const aliveParticipants = participants.filter(p => p.isAlive);

  const rosterList = participants
    .map((m, idx) => {
      const isUser = userParticipant && m.discordId === userParticipant.discordId;
      const isRevealed = m.isExposed || isUser || !m.isAlive;
      
      let statusIcon = m.isAlive ? (isRevealed ? '🟢' : '🕶️') : '💀';
      let nameLabel = isRevealed ? m.username : `Shadow Master #${idx + 1}`;
      let servantLabel = isRevealed ? `${m.servantName} (${m.servantClass})` : '[Classified in Shadows]';
      let tag = isUser ? ' `[YOU]`' : '';
      let exposureTag = m.isExposed ? ' `[EXPOSED]`' : '';

      return `${statusIcon} **${nameLabel}**${tag}${exposureTag} — Servant: *${servantLabel}* | HP: \`${m.currentHp.toLocaleString()}/${m.maxHp.toLocaleString()}\` | Kills: ${m.kills}`;
    })
    .join('\n');

  // Recent Event logs (last 6)
  const recentEvents = (war.eventLogs || []).slice(0, 6)
    .map(evt => {
      let icon = '📜';
      if (evt.type === 'elimination') icon = '💀';
      else if (evt.type === 'casualty') icon = '☠️';
      else if (evt.type === 'exposure') icon = '📡';
      else if (evt.type === 'ambush') icon = '⚔️';
      else if (evt.type === 'intel_leak') icon = '🕵️';
      else if (evt.type === 'alliance') icon = '🤝';
      return `${icon} \`${new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\` ${evt.text}`;
    })
    .join('\n');

  const casualtiesCount = war.civilianCasualties?.length || 0;
  const leaksCount = war.leakedIntel?.length || 0;

  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${war.title}`)
    .setDescription(
      `**Status:** ${war.status.toUpperCase()} | **Alive Masters:** **${aliveParticipants.length}/7** | **Civilian Casualties:** **${casualtiesCount}**\n` +
      (userParticipant
        ? `\n👤 **Your Master Profile:**\n` +
          `• Servant: **${userParticipant.servantName}** (${userParticipant.servantClass})\n` +
          `• Status: **${userParticipant.isExposed ? '⚠️ Identity Exposed to Server' : '🕶️ Concealed in Shadows'}**\n` +
          `• HP: **${userParticipant.currentHp.toLocaleString()}/${userParticipant.maxHp.toLocaleString()}** | Command Seals: **${userParticipant.commandSeals}/3** | Kills: **${userParticipant.kills}**\n\n`
        : '\n') +
      (lastMsg ? `📢 **Action Outcome:**\n${lastMsg}\n\n` : '') +
      `⚔️ **7 Masters Intelligence Roster:**\n${rosterList}\n\n` +
      `📜 **War Chronicle & Skirmishes (${(war.eventLogs || []).length} Events | ${leaksCount} Leaks):**\n${recentEvents || '*The war has begun. No city skirmishes recorded yet.*'}\n\n` +
      `*Tactical commands: Use \`/attack\` to ambush suspects, \`/leak\` to expose rivals, or buttons below:*`
    )
    .setColor(0xd4af37);

  return embed;
}

// ==========================================
// 3. ACTION BUTTONS
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
      .setLabel('City Skirmish')
      .setEmoji('💥')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('war_refresh')
      .setLabel('Refresh Board')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary)
  );
}

// ==========================================
// 4. COMMAND EXECUTION
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

    let war = getOrInitWarSession(master);
    const userParticipant = war.participants[interaction.user.id];

    const subcommand = interaction.options.getSubcommand();
    let initialMsg = '';

    if (subcommand === 'skirmish') {
      const res = simulateWarSkirmish(war);
      initialMsg = res.message;
      war = res.updatedWar;
    } else if (subcommand === 'rest') {
      const res = executeWarAction(war, interaction.user.id, 'rest_and_heal');
      initialMsg = res.message;
      war = res.updatedWar;
      await saveMaster(master);
    } else if (subcommand === 'betray') {
      const res = executeWarAction(war, interaction.user.id, 'betray_ally');
      initialMsg = res.message;
      war = res.updatedWar;
      await saveMaster(master);
    } else if (subcommand === 'attack') {
      const targetQuery = interaction.options.getString('target', true);
      const res = attackSuspectUserInWar(war, interaction.user.id, targetQuery);
      initialMsg = res.message;
      war = res.updatedWar;
      await saveMaster(master);
    } else if (subcommand === 'leak') {
      const intelText = interaction.options.getString('intel', true);
      const targetQuery = interaction.options.getString('target') || undefined;
      const res = leakIntelInWar(war, interaction.user.id, intelText, targetQuery);
      initialMsg = res.message;
      war = res.updatedWar;
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
// 5. INTERACTIVE TACTICAL WAR COLLECTOR
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
      let war = getOrInitWarSession(master);
      let actionResultMsg = '';

      if (i.customId === 'war_duel') {
        await i.reply({ content: 'Use `/duel` to initiate tactical turn-based combat against a rival Master!', ephemeral: true });
        return;
      } 
      else if (i.customId === 'war_rest') {
        const res = executeWarAction(war, i.user.id, 'rest_and_heal');
        actionResultMsg = res.message;
        war = res.updatedWar;
        await saveMaster(master);
      } 
      else if (i.customId === 'war_skirmish') {
        const res = simulateWarSkirmish(war);
        actionResultMsg = res.message;
        war = res.updatedWar;
      }
      else if (i.customId === 'war_refresh') {
        actionResultMsg = '🔄 Intelligence Board refreshed.';
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
