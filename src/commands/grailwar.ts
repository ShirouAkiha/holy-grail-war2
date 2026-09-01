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
  leakIntelInWar,
  patrolCityInWar
} from '../engine/grailwar';
import { buildProfileEmbed, buildProfileButtons } from './profile';

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
      .setName('profile')
      .setDescription('👤 View your private Master profile, Servant parameters & defense settings (Ephemeral)')
  )
  .addSubcommand(sub =>
    sub
      .setName('defenses')
      .setDescription('🏰 Manage your Mage Workshop sanctuary wards & Command Seal auto-evacuation (Ephemeral)')
  )
  .addSubcommand(sub =>
    sub
      .setName('ward')
      .setDescription('🛡️ Configure your Mage Workshop Bounded Field ward type')
      .addStringOption(opt =>
        opt
          .setName('type')
          .setDescription('Choose your active Bounded Field ward')
          .setRequired(true)
          .addChoices(
            { name: '🚫 No Wards (None)', value: 'none' },
            { name: '🛡️ Sanctuary Bounded Field (Absorbs 60% Ambush DMG)', value: 'ward' },
            { name: '🚨 Alarm Trap (Alerts & Deals 3,000 Retaliatory DMG)', value: 'alarm' }
          )
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('evade')
      .setDescription('🔴 Toggle Command Seal Emergency Auto-Evacuation upon fatal damage')
      .addStringOption(opt =>
        opt
          .setName('mode')
          .setDescription('Auto-consume 1 Command Seal to escape death with 1 HP?')
          .setRequired(true)
          .addChoices(
            { name: '🟢 Enable Auto-Evacuation', value: 'on' },
            { name: '🔴 Disable Auto-Evacuation', value: 'off' }
          )
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('attack')
      .setDescription('Ambush a suspected Master (if civilian, they die & you get exposed!)')
      .addStringOption(opt =>
        opt.setName('target')
          .setDescription('The username, @mention, ID, or designation (e.g. Shadow Master #2) of the target')
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
          .setDescription('Optional: Mention, name, or designation of suspected Master to expose')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('patrol')
      .setDescription('👁️ Patrol/Scout channel sector to gather intel, detect rival signatures, or spy on bystanders')
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
// 2. WAR EMBED BUILDERS
// ==========================================
export function buildWarEmbed(war: HolyGrailWarSession, userParticipant?: any, lastMsg?: string) {
  const participants = Object.values(war.participants);
  const aliveParticipants = participants.filter(p => p.isAlive);

  const rosterList = participants
    .map((m, idx) => {
      const isRevealed = m.isExposed || !m.isAlive;
      
      let statusIcon = m.isAlive ? (isRevealed ? '🟢' : '🕶️') : '💀';
      let nameLabel = isRevealed ? m.username : `Shadow Master #${idx + 1}`;
      let servantLabel = isRevealed ? `${m.servantName} (${m.servantClass})` : '[Classified in Shadows]';
      let exposureTag = m.isExposed ? ' `[EXPOSED]`' : (!m.isAlive ? ' `[FALLEN]`' : '');

      return `${statusIcon} **${nameLabel}**${exposureTag} — Servant: *${servantLabel}* | HP: \`${m.currentHp.toLocaleString()}/${m.maxHp.toLocaleString()}\` | Kills: ${m.kills}`;
    })
    .join('\n');

  // Filter out any legacy private event logs
  const publicEventsList = (war.eventLogs || []).filter(evt => {
    const txt = evt.text.toLowerCase();
    return !txt.includes('workshop defense') && 
           !txt.includes('auto-evacuation') && 
           !txt.includes('channeled mana') &&
           !txt.includes('bounded field');
  });

  // Recent Event logs (last 6) with concealment protection for unexposed Masters
  const recentEvents = publicEventsList.slice(0, 6)
    .map(evt => {
      let icon = '📜';
      if (evt.type === 'elimination') icon = '💀';
      else if (evt.type === 'casualty') icon = '☠️';
      else if (evt.type === 'exposure') icon = '📡';
      else if (evt.type === 'ambush') icon = '⚔️';
      else if (evt.type === 'intel_leak') icon = '🕵️';
      else if (evt.type === 'alliance') icon = '🤝';

      let displayText = evt.text;
      // Concealment safeguard: If text mentions an unexposed Master, mask it for all viewers
      participants.forEach((m, idx) => {
        if (!m.isExposed) {
          if (m.username && displayText.includes(m.username)) {
            displayText = displayText.replace(new RegExp(`Master \\*\\*${m.username}\\*\\*`, 'g'), 'A Shadow Master');
            displayText = displayText.replace(new RegExp(`\\*\\*${m.username}\\*\\*`, 'g'), `Shadow Master #${idx + 1}`);
            displayText = displayText.replace(new RegExp(m.username, 'g'), `Shadow Master #${idx + 1}`);
          }
          if (m.servantName && displayText.includes(m.servantName)) {
            displayText = displayText.replace(new RegExp(`\\*\\*${m.servantName}\\*\\*`, 'g'), 'Heroic Spirit');
            displayText = displayText.replace(new RegExp(m.servantName, 'g'), 'Heroic Spirit');
          }
        }
      });

      return `${icon} \`${new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\` ${displayText}`;
    })
    .join('\n');

  const casualtiesCount = war.civilianCasualties?.length || 0;
  const leaksCount = war.leakedIntel?.length || 0;

  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${war.title}`)
    .setDescription(
      `**Status:** ${war.status.toUpperCase()} | **Alive Masters:** **${aliveParticipants.length}/7** | **Civilian Casualties:** **${casualtiesCount}**\n\n` +
      (lastMsg ? `📢 **Action Outcome:**\n${lastMsg}\n\n` : '') +
      `⚔️ **7 Masters Intelligence Roster:**\n${rosterList}\n\n` +
      `📜 **War Chronicle & Skirmishes (${(war.eventLogs || []).length} Events | ${leaksCount} Leaks):**\n${recentEvents || '*The war has begun. No city skirmishes recorded yet.*'}\n\n` +
      `*Tactical notice: To inspect your private Master stats, Servant parameters, and workshop defenses confidentially, use \`/profile\` or click "Secret Profile" below.*`
    )
    .setColor(0xd4af37);

  return embed;
}

function buildDefensesEmbed(userParticipant: any, lastMsg?: string) {
  if (!userParticipant) {
    return new EmbedBuilder()
      .setTitle('📜 Civilian Spectator Dossier')
      .setDescription('📜 Civilian Spectator Dossier: You are currently an innocent bystander in Fuyuki City with no contracted Servant. Use `/summon` to establish a covenant and enter the Holy Grail War.')
      .setColor(0x71717a);
  }

  const ward = userParticipant?.boundedField || 'none';
  const autoEvade = userParticipant?.autoEvadeEnabled !== false;
  const seals = userParticipant?.commandSeals ?? 3;

  let wardDescription = '🚫 **No Active Wards:** Your workshop has no magical perimeter defenses.';
  if (ward === 'ward') {
    wardDescription = '🛡️ **Mage\'s Sanctuary Bounded Field Active:** Multi-layered defensive barriers parry and absorb **60% of incoming ambush damage**.';
  } else if (ward === 'alarm') {
    wardDescription = '🚨 **Intrusion Alarm Trap Active:** Trapped boundary detects infiltrators, immediately alerting you and striking back for **3,000 retaliatory DMG**.';
  }

  let classPassive = 'None (Specializes in direct tactical matches)';
  const sClass = userParticipant?.servantClass;
  if (sClass === 'Saber' || sClass === 'Archer' || sClass === 'Lancer') {
    classPassive = '👁️ **Instinct / Clairvoyance:** 35% chance to predict ambushes, parrying 80% damage and dealing 1,500 counter DMG.';
  } else if (sClass === 'Assassin') {
    classPassive = '🕶️ **Presence Concealment:** Completely immune to surprise ambushes. Nullifies strike & counters for 2,500 DMG!';
  } else if (sClass === 'Berserker') {
    classPassive = '❤️ **Battle Continuation (Guts):** Revives once with 25% Max HP if dealt a fatal blow.';
  }

  const embed = new EmbedBuilder()
    .setTitle('🏰 Mage Workshop & Personal Sanctuary Defenses')
    .setDescription(
      `Master **${userParticipant?.username || 'Master'}**'s Tactical Defense Headquarters\n\n` +
      (lastMsg ? `📢 **Action Outcome:**\n${lastMsg}\n\n` : '') +
      `🛡️ **Bounded Field Protocol:**\n${wardDescription}\n\n` +
      `🔴 **Command Seal Emergency Evacuation:**\n` +
      (autoEvade 
        ? `• **🟢 ENABLED:** When taking fatal ambush damage, consumes **1 Command Seal** to escape into shadows with **1 HP**.\n`
        : `• **🔴 DISABLED:** Fatal ambushes will eliminate your Servant normally without consuming a seal.\n`) +
      `• **Current Command Seals:** \`${'✦ '.repeat(seals)}${'✧ '.repeat(Math.max(0, 3 - seals))}\` (**${seals}/3** remaining)\n\n` +
      `👁️ **Servant Class Passive:**\n${classPassive}\n\n` +
      `*Configure your workshop defenses instantly using the buttons below or slash commands:*`
    )
    .setColor(0x3b82f6)
    .setFooter({ text: 'Holy Grail War Defense Protocol • Use /grailwar status to return to roster' });

  return embed;
}

// ==========================================
// 3. ACTION BUTTONS
// ==========================================
export function buildWarButtons() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('war_my_profile')
      .setLabel('Secret Profile (Private)')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('war_defenses')
      .setLabel('Defenses')
      .setEmoji('🏰')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('war_patrol')
      .setLabel('Patrol City')
      .setEmoji('👁️')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('war_skirmish')
      .setLabel('City Skirmish')
      .setEmoji('💥')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('war_refresh')
      .setLabel('Refresh')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary)
  );
}

function buildDefensesButtons(userParticipant: any) {
  if (!userParticipant) return [];
  const currentWard = userParticipant?.boundedField || 'none';
  const autoEvade = userParticipant?.autoEvadeEnabled !== false;

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ward_none')
      .setLabel('No Wards')
      .setEmoji('🚫')
      .setStyle(currentWard === 'none' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ward_ward')
      .setLabel('Sanctuary (60% Block)')
      .setEmoji('🛡️')
      .setStyle(currentWard === 'ward' ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ward_alarm')
      .setLabel('Alarm Trap (3k DMG)')
      .setEmoji('🚨')
      .setStyle(currentWard === 'alarm' ? ButtonStyle.Danger : ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_auto_evade')
      .setLabel(autoEvade ? 'Auto-Evacuate: ON 🟢' : 'Auto-Evacuate: OFF 🔴')
      .setStyle(autoEvade ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('war_refresh_defenses')
      .setLabel('Refresh Settings')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('war_status_board')
      .setLabel('View War Board (/grailwar)')
      .setEmoji('📋')
      .setStyle(ButtonStyle.Primary)
  );

  return [row1, row2];
}

// ==========================================
// 4. COMMAND EXECUTION
// ==========================================
export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const subcommand = interaction.options.getSubcommand();

    const isCivilian = !master.servants || master.servants.length === 0;

    if (isCivilian) {
      if (['profile', 'defenses', 'ward', 'evade', 'attack', 'rest', 'betray'].includes(subcommand)) {
        await interaction.reply({
          ephemeral: true,
          content: '📜 Civilian Spectator Dossier: You are currently an innocent bystander in Fuyuki City with no contracted Servant. Use `/summon` to establish a covenant and enter the Holy Grail War.'
        });
        return;
      }
    }

    let war = getOrInitWarSession(master);
    const userParticipant = war.participants[interaction.user.id];

    // Obtain current Discord channel name if available
    const currentChannelName = interaction.channel && 'name' in interaction.channel 
      ? `#${(interaction.channel as any).name}`
      : '#general';

    if (subcommand === 'profile') {
      const profEmbed = buildProfileEmbed(master, war);
      const profButtons = buildProfileButtons(userParticipant);
      const reply = await interaction.reply({
        embeds: [profEmbed],
        components: profButtons,
        ephemeral: true,
        withResponse: true
      }).then(r => r.resource?.message || interaction.fetchReply());
      setupWarCollector(reply, interaction.user.id);
      return;
    }

    if (subcommand === 'defenses') {
      const defEmbed = buildDefensesEmbed(userParticipant);
      const defButtons = buildDefensesButtons(userParticipant);
      const reply = await interaction.reply({
        embeds: [defEmbed],
        components: defButtons,
        ephemeral: true,
        withResponse: true
      }).then(r => r.resource?.message || interaction.fetchReply());
      setupWarCollector(reply, interaction.user.id);
      return;
    }

    if (subcommand === 'ward') {
      const wardType = interaction.options.getString('type', true);
      const res = executeWarAction(war, interaction.user.id, 'set_ward', wardType);
      war = res.updatedWar;
      await saveMaster(master);

      const defEmbed = buildDefensesEmbed(war.participants[interaction.user.id], res.message);
      const defButtons = buildDefensesButtons(war.participants[interaction.user.id]);
      const reply = await interaction.reply({
        embeds: [defEmbed],
        components: defButtons,
        ephemeral: true,
        withResponse: true
      }).then(r => r.resource?.message || interaction.fetchReply());
      setupWarCollector(reply, interaction.user.id);
      return;
    }

    if (subcommand === 'evade') {
      const mode = interaction.options.getString('mode', true);
      const res = executeWarAction(war, interaction.user.id, 'toggle_evade', mode);
      war = res.updatedWar;
      await saveMaster(master);

      const defEmbed = buildDefensesEmbed(war.participants[interaction.user.id], res.message);
      const defButtons = buildDefensesButtons(war.participants[interaction.user.id]);
      const reply = await interaction.reply({
        embeds: [defEmbed],
        components: defButtons,
        ephemeral: true,
        withResponse: true
      }).then(r => r.resource?.message || interaction.fetchReply());
      setupWarCollector(reply, interaction.user.id);
      return;
    }

    let initialMsg = '';

    if (subcommand === 'patrol') {
      const res = patrolCityInWar(war, interaction.user.id, interaction.user.username, currentChannelName);
      initialMsg = res.message;
      war = res.updatedWar;
    } else if (subcommand === 'skirmish') {
      const res = simulateWarSkirmish(war, currentChannelName);
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
      const res = attackSuspectUserInWar(war, interaction.user.id, targetQuery, currentChannelName);
      initialMsg = res.message;
      war = res.updatedWar;
      await saveMaster(master);
    } else if (subcommand === 'leak') {
      const intelText = interaction.options.getString('intel', true);
      const targetQuery = interaction.options.getString('target') || undefined;
      const res = leakIntelInWar(war, interaction.user.id, intelText, targetQuery, currentChannelName);
      initialMsg = res.message;
      war = res.updatedWar;
    }

    const embed = buildWarEmbed(war, userParticipant, initialMsg);
    const row = buildWarButtons();

    const reply = await interaction.reply({
      embeds: [embed],
      components: [row],
      withResponse: true
    }).then(r => r.resource?.message || interaction.fetchReply());

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
    try {
      if (i.replied || i.deferred) return;

      const master = await getOrCreateMaster(i.user.id, i.user.username);
      let war = getOrInitWarSession(master);
      let actionResultMsg = '';
      const isCivilian = !master.servants || master.servants.length === 0;

      // Secret Profile Button (Private to whoever clicks it)
      if (i.customId === 'war_my_profile') {
        if (isCivilian) {
          await i.reply({
            ephemeral: true,
            content: '📜 Civilian Spectator Dossier: You are currently an innocent bystander in Fuyuki City with no contracted Servant. Use `/summon` to establish a covenant and enter the Holy Grail War.'
          });
          return;
        }
        const userP = war.participants[i.user.id];
        const profEmbed = buildProfileEmbed(master, war);
        const profBtns = buildProfileButtons(userP);
        await i.reply({ embeds: [profEmbed], components: profBtns, ephemeral: true });
        return;
      }

      // Defenses & Ward Button interactions (Private to whoever clicks it)
      if (i.customId === 'war_defenses') {
        if (isCivilian) {
          await i.reply({
            ephemeral: true,
            content: '📜 Civilian Spectator Dossier: You are currently an innocent bystander in Fuyuki City with no contracted Servant. Use `/summon` to establish a covenant and enter the Holy Grail War.'
          });
          return;
        }
        const userP = war.participants[i.user.id];
        const defEmbed = buildDefensesEmbed(userP);
        const defBtns = buildDefensesButtons(userP);
        await i.reply({ embeds: [defEmbed], components: defBtns, ephemeral: true });
        return;
      }

      // If action is on the main war board, ensure only the user who triggered can control public buttons
      if (i.user.id !== userId) {
        await i.reply({ content: 'Only the Master who issued this war command can control these public actions. Use `/profile` to view your own stats.', ephemeral: true });
        return;
      }

      if (i.customId === 'war_status_board') {
        const userP = war.participants[i.user.id];
        const warEmbed = buildWarEmbed(war, userP);
        const warBtns = buildWarButtons();
        await i.update({ embeds: [warEmbed], components: [warBtns] });
        return;
      }
      else if (i.customId === 'ward_none') {
        const res = executeWarAction(war, i.user.id, 'set_ward', 'none');
        war = res.updatedWar;
        await saveMaster(master);
        const userP = war.participants[i.user.id];
        const defEmbed = buildDefensesEmbed(userP, res.message);
        const defBtns = buildDefensesButtons(userP);
        await i.update({ embeds: [defEmbed], components: defBtns });
        return;
      }
      else if (i.customId === 'ward_ward') {
        const res = executeWarAction(war, i.user.id, 'set_ward', 'ward');
        war = res.updatedWar;
        await saveMaster(master);
        const userP = war.participants[i.user.id];
        const defEmbed = buildDefensesEmbed(userP, res.message);
        const defBtns = buildDefensesButtons(userP);
        await i.update({ embeds: [defEmbed], components: defBtns });
        return;
      }
      else if (i.customId === 'ward_alarm') {
        const res = executeWarAction(war, i.user.id, 'set_ward', 'alarm');
        war = res.updatedWar;
        await saveMaster(master);
        const userP = war.participants[i.user.id];
        const defEmbed = buildDefensesEmbed(userP, res.message);
        const defBtns = buildDefensesButtons(userP);
        await i.update({ embeds: [defEmbed], components: defBtns });
        return;
      }
      else if (i.customId === 'toggle_auto_evade') {
        const currentP = war.participants[i.user.id];
        const newMode = currentP?.autoEvadeEnabled !== false ? 'off' : 'on';
        const res = executeWarAction(war, i.user.id, 'toggle_evade', newMode);
        war = res.updatedWar;
        await saveMaster(master);
        const userP = war.participants[i.user.id];
        const defEmbed = buildDefensesEmbed(userP, res.message);
        const defBtns = buildDefensesButtons(userP);
        await i.update({ embeds: [defEmbed], components: defBtns });
        return;
      }
      else if (i.customId === 'war_refresh_defenses') {
        const userP = war.participants[i.user.id];
        const defEmbed = buildDefensesEmbed(userP, '🔄 Workshop settings refreshed.');
        const defBtns = buildDefensesButtons(userP);
        await i.update({ embeds: [defEmbed], components: defBtns });
        return;
      }
      else if (i.customId === 'war_patrol') {
        const chanTag = i.channel && 'name' in i.channel ? `#${(i.channel as any).name}` : '#general';
        const res = patrolCityInWar(war, i.user.id, i.user.username, chanTag);
        actionResultMsg = res.message;
        war = res.updatedWar;
      }
      else if (i.customId === 'war_skirmish') {
        const chanTag = i.channel && 'name' in i.channel ? `#${(i.channel as any).name}` : '#general';
        const res = simulateWarSkirmish(war, chanTag);
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
      if (err.code === 10062 || err.message?.includes('Unknown interaction')) return;
      console.error('Error in grail war collector:', err);
    }
  });
}
