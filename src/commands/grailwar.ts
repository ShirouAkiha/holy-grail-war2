import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { HolyGrailWarSession } from '../types';
import { 
  getOrInitWarSession,
  calculateCurrentHp,
  executeWarAction, 
  simulateWarSkirmish,
  attackSuspectUserInWar,
  leakIntelInWar,
  patrolCityInWar,
  resetWarSession,
  setChannelTrapInWar,
  disarmChannelTrapsInWar,
  dispatchFamiliarInWar,
  recallFamiliarsInWar,
  enterChurchSanctuary,
  leaveChurchSanctuary
} from '../engine/grailwar';
import { buildProfileEmbed, buildProfileButtons } from './profile';
import { buildChurchEmbed, buildChurchButtons } from './church';

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
      .setName('familiar')
      .setDescription('🦅 Dispatch a reconnaissance familiar (Raven, Homunculus, or Shadow Imp)')
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
      .setName('familiars')
      .setDescription('🦅 View your active familiar reconnaissance network and surveillance logs')
  )
  .addSubcommand(sub =>
    sub
      .setName('trap')
      .setDescription('🕸️ Place a concealed Bounded Field trap in a channel (alarm or mana drain)')
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
      .setName('traps')
      .setDescription('🕸️ View your active channel Bounded Field traps and disarm if desired')
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
      .setName('heal')
      .setDescription('✨ Perform a Workshop Leyline Healing Ritual to restore 40% HP (5-minute cooldown)')
  )
  .addSubcommand(sub =>
    sub
      .setName('rest')
      .setDescription('✨ Channel mana to perform a Healing Ritual to restore 40% HP (5-minute cooldown)')
  )
  .addSubcommand(sub =>
    sub
      .setName('church')
      .setDescription('⛪ Claim or depart neutral asylum at the Fuyuki Church under Father Kotomine')
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
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('reset')
      .setDescription('🔄 Reset the Holy Grail War tournament to start fresh (0/7 summoned)')
  );

// ==========================================
// 2. WAR EMBED BUILDERS
// ==========================================
export function buildWarEmbed(war: HolyGrailWarSession, userParticipant?: any, lastMsg?: string) {
  const participants = Object.values(war.participants || {});
  const aliveParticipants = participants.filter(p => p.isAlive);
  const deadCount = participants.filter(p => !p.isAlive).length;
  const totalSummoned = participants.length;

  // Build full 7-slot roster (always 7 slots)
  const rosterLines: string[] = [];
  for (let slotIdx = 0; slotIdx < 7; slotIdx++) {
    const m = participants[slotIdx];
    if (m) {
      const isRevealed = m.isExposed || !m.isAlive;
      const statusIcon = m.isAlive ? (isRevealed ? '🟢' : '🕶️') : '💀';
      const nameLabel = isRevealed ? m.username : `Shadow Master #${slotIdx + 1}`;
      const servantLabel = isRevealed ? `${m.servantName} (${m.servantClass})` : '[Classified in Shadows]';
      const exposureTag = m.isExposed ? ' `[EXPOSED]`' : (!m.isAlive ? ' `[FALLEN]`' : '');

      const curHp = calculateCurrentHp(m);
      rosterLines.push(`${statusIcon} **${nameLabel}**${exposureTag} — Servant: *${servantLabel}* | HP: \`${curHp.toLocaleString()}/${m.maxHp.toLocaleString()}\` | Kills: ${m.kills}`);
    } else {
      rosterLines.push(`⏳ **Slot #${slotIdx + 1}** — *[Unsummoned Heroic Spirit — Awaiting Master Covenant]*`);
    }
  }

  const rosterList = rosterLines.join('\n');

  // Filter out any private event logs
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

  let statusHeader = '';
  if (war.status === 'concluded') {
    const winner = war.grailWinnerId && war.participants[war.grailWinnerId] 
      ? war.participants[war.grailWinnerId].username 
      : (aliveParticipants[0]?.username || 'Victor');
    statusHeader = `**Status:** 🏆 CONCLUDED | **Victor:** **${winner}** | **Civilian Casualties:** **${casualtiesCount}**`;
  } else if (totalSummoned < 7) {
    statusHeader = `**Status:** 🕯️ GATHERING MASTERS (**${totalSummoned}/7** Summoned | **${aliveParticipants.length}** Alive | **${deadCount}/6** Cores Absorbed) | **Civilian Casualties:** **${casualtiesCount}**`;
  } else {
    statusHeader = `**Status:** ⚔️ ACTIVE ELIMINATION PHASE (**${aliveParticipants.length}/7** Alive | **${deadCount}/6** Cores Absorbed) | **Civilian Casualties:** **${casualtiesCount}**`;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${war.title}`)
    .setDescription(
      `${statusHeader}\n\n` +
      (lastMsg ? `📢 **Action Outcome:**\n${lastMsg}\n\n` : '') +
      `⚔️ **7 Masters Intelligence Roster:**\n${rosterList}\n\n` +
      `📜 **War Chronicle & Skirmishes (${(war.eventLogs || []).length} Events | ${leaksCount} Leaks):**\n${recentEvents || '*The war has begun. No city skirmishes recorded yet.*'}\n\n` +
      `*Tactical notice: To summon a Servant and claim an uncontracted slot, use \`/summon ritual\`. To inspect your secret stats and workshop defenses confidentially, use \`/profile\` or click "Secret Profile" below.*`
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
      .setCustomId('war_familiars_hub')
      .setLabel('Familiars')
      .setEmoji('🦅')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('war_patrol')
      .setLabel('Patrol City')
      .setEmoji('👁️')
      .setStyle(ButtonStyle.Success),
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
      if (['profile', 'defenses', 'ward', 'evade', 'attack', 'rest', 'heal'].includes(subcommand)) {
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
      await interaction.reply({
        embeds: [profEmbed],
        components: profButtons,
        ephemeral: true
      });
      return;
    }

    if (subcommand === 'defenses') {
      const defEmbed = buildDefensesEmbed(userParticipant);
      const defButtons = buildDefensesButtons(userParticipant);
      await interaction.reply({
        embeds: [defEmbed],
        components: defButtons,
        ephemeral: true
      });
      return;
    }

    if (subcommand === 'ward') {
      const wardType = interaction.options.getString('type', true);
      const res = executeWarAction(war, interaction.user.id, 'set_ward', wardType);
      war = res.updatedWar;
      await saveMaster(master);

      const defEmbed = buildDefensesEmbed(war.participants[interaction.user.id], res.message);
      const defButtons = buildDefensesButtons(war.participants[interaction.user.id]);
      await interaction.reply({
        embeds: [defEmbed],
        components: defButtons,
        ephemeral: true
      });
      return;
    }

    if (subcommand === 'evade') {
      const mode = interaction.options.getString('mode', true);
      const res = executeWarAction(war, interaction.user.id, 'toggle_evade', mode);
      war = res.updatedWar;
      await saveMaster(master);

      const defEmbed = buildDefensesEmbed(war.participants[interaction.user.id], res.message);
      const defButtons = buildDefensesButtons(war.participants[interaction.user.id]);
      await interaction.reply({
        embeds: [defEmbed],
        components: defButtons,
        ephemeral: true
      });
      return;
    }

    if (subcommand === 'familiar') {
      const familiarType = interaction.options.getString('type', true) as 'raven' | 'homunculus' | 'shadow_imp';
      const channelOpt = interaction.options.getString('channel');
      const targetChan = channelOpt || currentChannelName;

      const res = dispatchFamiliarInWar(war, interaction.user.id, interaction.user.username, targetChan, familiarType);
      war = res.updatedWar;
      await saveMaster(master);

      const color = familiarType === 'raven' ? 0x0284c7 : familiarType === 'homunculus' ? 0x10b981 : 0x7c3aed;
      const famEmbed = new EmbedBuilder()
        .setTitle('🦅 Familiar Reconnaissance Dispatched')
        .setDescription(res.message)
        .setColor(color)
        .setFooter({ text: 'Holy Grail War Familiar Network • Recon & Surveillance' });

      await interaction.reply({ embeds: [famEmbed], ephemeral: true });
      return;
    }

    if (subcommand === 'familiars') {
      const userFamiliars = (war.familiars || []).filter(f => f.masterId === interaction.user.id);
      let desc = '';
      if (userFamiliars.length === 0) {
        desc = 'You currently have **no active familiars** dispatched in Fuyuki City.\n\nUse `/grailwar familiar type:<raven | homunculus | shadow_imp> channel:<#channel>` to deploy one!';
      } else {
        desc = `You currently command **${userFamiliars.length}/2** active familiars stationed across Fuyuki:\n\n` +
          userFamiliars.map((f, idx) => {
            const typeLabel = f.familiarType === 'raven'
              ? '🦅 **Scouting Raven** (Surveillance)'
              : f.familiarType === 'homunculus'
              ? '🗿 **Homunculus Decoy** (Ambush Shield)'
              : '🦇 **Shadow Imp** (Sabotage & Siphon)';
            const intelLogs = (f.detectedIntel && f.detectedIntel.length > 0)
              ? `\n  ↳ **Surveillance Logs:**\n  ${f.detectedIntel.slice(0, 3).join('\n  ')}`
              : `\n  ↳ *No movement observed yet.*`;
            return `**${idx + 1}. Sector ${f.channelName}** — ${typeLabel}\n*Deployed <t:${Math.floor(f.createdAt / 1000)}:R>*${intelLogs}`;
          }).join('\n\n') + '\n\n*Click **Recall All Familiars** below to dismiss your familiars.*';
      }

      const famsEmbed = new EmbedBuilder()
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

      await interaction.reply({ embeds: [famsEmbed], components: [row], ephemeral: true });
      return;
    }

    if (subcommand === 'trap') {
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

    if (subcommand === 'traps') {
      const userTraps = (war.channelTraps || []).filter(t => t.setterMasterId === interaction.user.id);
      let desc = '';
      if (userTraps.length === 0) {
        desc = 'You currently have **no active Bounded Field traps** deployed in any channels.\n\nUse `/grailwar trap type:<alarm | drain> channel:<#channel>` to place one!';
      } else {
        desc = `You currently have **${userTraps.length}/2** active Bounded Field traps deployed across Fuyuki:\n\n` +
          userTraps.map((t, idx) => {
            const typeLabel = t.trapType === 'alarm' ? '🚨 **Alarm Ward** (Exposes intruder identity)' : '🩸 **Bloodfort Drain** (Siphons 1,800 HP)';
            return `**${idx + 1}. Sector ${t.channelName}** — ${typeLabel}\n*Deployed <t:${Math.floor(t.createdAt / 1000)}:R>*`;
          }).join('\n\n') + '\n\n*Click **Disarm All Traps** below to dissolve your active fields.*';
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
    } else if (subcommand === 'rest' || subcommand === 'heal') {
      const res = executeWarAction(war, interaction.user.id, 'heal_ritual');
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
    } else if (subcommand === 'church') {
      const act = interaction.options.getString('action') || 'status';
      let lastMsg: string | undefined = undefined;
      if (act === 'enter') {
        const res = enterChurchSanctuary(war, interaction.user.id);
        war = res.updatedWar;
        lastMsg = res.message;
        await saveMaster(master);
      } else if (act === 'leave') {
        const res = leaveChurchSanctuary(war, interaction.user.id);
        war = res.updatedWar;
        lastMsg = res.message;
        await saveMaster(master);
      }
      const uP = war.participants[interaction.user.id];
      const embed = buildChurchEmbed(uP, lastMsg);
      const buttons = buildChurchButtons(uP);
      await interaction.reply({ embeds: [embed], components: buttons, ephemeral: true });
      return;
    } else if (subcommand === 'reset') {
      war = resetWarSession();
      initialMsg = '🔄 The Holy Grail War has been reset! All 7 Servant slots are now vacant and awaiting Master summonings.';
    }

    const embed = buildWarEmbed(war, userParticipant, initialMsg);
    const row = buildWarButtons();

    await interaction.reply({
      embeds: [embed],
      components: [row]
    });

  } catch (error: any) {
    console.error('Error executing /grailwar:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: `❌ Error: ${error.message}`, ephemeral: true });
    } else {
      await interaction.reply({ content: `❌ Error: ${error.message}`, ephemeral: true });
    }
  }
}
