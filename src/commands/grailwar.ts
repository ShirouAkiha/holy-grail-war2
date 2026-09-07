import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ComponentType
, MessageFlags } from 'discord.js';
import { getOrCreateMaster, saveMaster, getMaster } from '../database/service';
import { HolyGrailWarSession } from '../types';

/**
 * Resolves a raw Discord ID, mention string, or username to a clean human username.
 * Ensures numbers are never shown to users.
 */
export function resolveDisplayName(raw: string | undefined, client?: any): string {
  if (!raw) return 'Unknown Citizen';
  // Check if raw contains a 16-21 digit snowflake ID
  const idMatch = raw.match(/\d{16,21}/);
  if (idMatch) {
    const uid = idMatch[0];
    const knownMaster = getMaster(uid);
    if (knownMaster?.username) {
      return `@${knownMaster.username.replace(/^@+/, '')}`;
    }
    if (client?.users?.cache?.get(uid)?.username) {
      return `@${client.users.cache.get(uid).username.replace(/^@+/, '')}`;
    }
    const fallbackMap: Record<string, string> = {
      '780278575860678676': 'pokehunter1',
      '492833398461562880': 'itsderpo',
      '1257784101906157589': 'fou.chiii',
      '521112557810090005': 'cccp001',
      '1499028902104797237': 'fou.chii',
      '152568236896944130': 'bwjolioliravioli',
      '442009903809429515': 'fluffycat78',
      '189710170597752832': 'ixyan',
      '499898049145995276': 'togata_my_beloved',
      '728294594378203177': 'snoic_2',
      '373115070068162561': 'stahlgeist',
      '707978460697460758': 'paradise3812'
    };
    if (fallbackMap[uid]) {
      return `@${fallbackMap[uid]}`;
    }
  }
  const clean = raw.replace(/[<@!>]/g, '').trim();
  if (/^\d+$/.test(clean)) {
    return `@Citizen_${clean.slice(-4)}`;
  }
  return clean.length > 0 ? (clean.startsWith('@') ? clean : `@${clean}`) : raw;
}
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
  .setDescription('🏆 Holy Grail War Hub — 7-Master Roster, Casualties, Leaks, Battles, Defenses & Sanctuary')
  .addStringOption(opt =>
    opt
      .setName('category')
      .setDescription('Select Grail War operations sector or intelligence dossier')
      .setRequired(false)
      .addChoices(
        { name: '🏆 War Board & 7-Master Roster', value: 'board' },
        { name: '☠️ Casualties Dossier (Masters & Civilians)', value: 'casualties' },
        { name: '🕵️ Leaked Intel & Intercepts', value: 'leaks' },
        { name: '⚔️ Battles & Skirmishes Chronicle', value: 'battles' },
        { name: '🏰 Workshop Defenses & Wards', value: 'defenses' },
        { name: '🦅 Familiar Recon Network', value: 'familiars' },
        { name: '🕸️ Bounded Field Traps', value: 'traps' },
        { name: '⛪ Fuyuki Church Sanctuary', value: 'church' }
      )
  );

// ==========================================
// 2. MAIN EXECUTE HANDLER
// ==========================================
export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const category = (interaction.options.getString('category') as any) || 'board';

    const war = getOrInitWarSession(master);
    const { embeds, components } = buildGrailWarHub(war, master, category, undefined, interaction.client);

    const msg = await interaction.editReply({
      embeds,
      components
    });

    attachGrailWarCollector(msg, interaction.user.id, master, category);

  } catch (error: any) {
    console.error('Error executing /grailwar:', error);
    await interaction.editReply({
      content: `❌ Error opening Holy Grail War hub: ${error.message}`
    });
  }
}

// ==========================================
// 3. GRAIL WAR HUB BUILDER
// ==========================================
export function buildGrailWarHub(
  war: HolyGrailWarSession,
  master: any,
  category: 'board' | 'casualties' | 'leaks' | 'battles' | 'defenses' | 'familiars' | 'traps' | 'church' = 'board',
  actionOutcomeMsg?: string,
  client?: any
) {
  const userParticipant = war.participants[master.discordId];
  let embeds: EmbedBuilder[] = [];

  const participants = Object.values(war.participants || {});
  const aliveParticipants = participants.filter(p => p.isAlive);
  const deadCount = participants.filter(p => !p.isAlive).length;
  const totalSummoned = participants.length;
  const casualtiesCount = war.civilianCasualties?.length || 0;
  const leaksCount = war.leakedIntel?.length || 0;
  const totalCasualties = deadCount + casualtiesCount;

  const battleEventsList = (war.eventLogs || []).filter(evt => {
    const t = evt.type;
    const txt = (evt.text || '').toLowerCase();
    return t === 'clash' || t === 'ambush' || t === 'elimination' || t === 'casualty' || t === 'betrayal' ||
           txt.includes('dmg') || txt.includes('ambush') || txt.includes('attack') || txt.includes('skirmish') || txt.includes('clash') || txt.includes('struck');
  });

  if (category === 'board') {
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

    const publicEventsList = (war.eventLogs || []).filter(evt => {
      const txt = evt.text.toLowerCase();
      return !txt.includes('workshop defense') && 
             !txt.includes('auto-evacuation') && 
             !txt.includes('channeled mana') &&
             !txt.includes('bounded field');
    });

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
        // Clean any raw @\d{16,21} mentions in event logs to human usernames
        displayText = displayText.replace(/@(\d{16,21})/g, (_, uid) => {
          return resolveDisplayName(uid, client);
        });

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

    let statusHeader = '';
    if (war.status === 'concluded') {
      const winner = war.grailWinnerId && war.participants[war.grailWinnerId] 
        ? war.participants[war.grailWinnerId].username 
        : (aliveParticipants[0]?.username || 'Victor');
      statusHeader = `**Status:** 🏆 CONCLUDED | **Victor:** **${winner}** | **Total Casualties:** **${totalCasualties}** (${deadCount} Masters, ${casualtiesCount} Civilians)`;
    } else if (totalSummoned < 7) {
      statusHeader = `**Status:** 🕯️ GATHERING MASTERS (**${totalSummoned}/7** Summoned | **${aliveParticipants.length}** Alive | **${deadCount}/6** Cores Absorbed) | **Total Casualties:** **${totalCasualties}**`;
    } else {
      statusHeader = `**Status:** ⚔️ ACTIVE ELIMINATION PHASE (**${aliveParticipants.length}/7** Alive | **${deadCount}/6** Cores Absorbed) | **Total Casualties:** **${totalCasualties}**`;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🏆 ${war.title}`)
      .setDescription(
        `${statusHeader}\n\n` +
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `⚔️ **7 Masters Intelligence Roster:**\n${rosterLines.join('\n')}\n\n` +
        `📜 **War Chronicle & Skirmishes (${(war.eventLogs || []).length} Events | ${leaksCount} Leaks):**\n${recentEvents || '*The war has begun. No city skirmishes recorded yet.*'}\n\n` +
        `💡 *Click the buttons below to view detailed records of Casualties, Intercepted Leaks, or Battles.*`
      )
      .setColor(0xd4af37)
      .setFooter({ text: 'Holy Grail War Operations Board • Click options below to view lists' });

    embeds = [embed];

  } else if (category === 'casualties') {
    const fallenMasters = participants.filter(p => !p.isAlive);
    const civilianCasualties = war.civilianCasualties || [];

    const fallenLines = fallenMasters.length > 0
      ? fallenMasters.map((m, idx) => {
          return `• 💀 **${m.username}** — Contracted Servant: **${m.servantName}** (${m.servantClass})\n  ↳ Kills: ${m.kills} | Status: 💀 Saint Graph Dissolved | Core absorbed into Lesser Grail`;
        }).join('\n\n')
      : '• *✨ All 7 Masters currently remain active in the field. Zero Master eliminations recorded.*';

    const civilianLines = civilianCasualties.length > 0
      ? civilianCasualties.slice(0, 10).map((vic, idx) => {
          const timeStr = new Date(vic.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const victimDisplay = resolveDisplayName(vic.name, client);
          const rawSlayer = vic.slainByMasterId || 'Unknown Mage';
          const slayerDisplay = resolveDisplayName(rawSlayer, client).replace(/^@/, '');
          return `• ☠️ **${victimDisplay}** \`${timeStr}\`\n  ↳ Struck down by: **Master ${slayerDisplay}** (Botched ambush in civilian sector)\n  ↳ *Church Cover-up:* Filed with municipal police as an industrial gas leak explosion.`;
        }).join('\n\n')
      : '• *🛡️ Zero civilian casualties reported. The Concealment of Mystery holds firm across Fuyuki City.*';

    const embed = new EmbedBuilder()
      .setTitle(`🏆 ${war.title} — ☠️ Casualty Ledger`)
      .setDescription(
        `📊 **Casualty Ledger Summary:**\n` +
        `• 💀 **Fallen Masters:** **${fallenMasters.length}/7** eliminated\n` +
        `• ☠️ **Civilian Casualties:** **${civilianCasualties.length}** collateral casualties\n` +
        `• 🏺 **Servant Cores Absorbed:** **${deadCount}/6** required for Greater Grail descent\n\n` +
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `💀 **FALLEN MASTERS RECORD (${fallenMasters.length}):**\n${fallenLines}\n\n` +
        `☠️ **CIVILIAN COLLATERAL CASUALTIES RECORD (${civilianCasualties.length}):**\n${civilianLines}\n\n` +
        `⚠️ *Warning: Striking non-combatant citizens exposes the attacker's true identity to the Holy Church and incurs penalty.*`
      )
      .setColor(0xe11d48)
      .setFooter({ text: 'Holy Grail War Casualty Dossier • Use options below to switch views' });

    embeds = [embed];

  } else if (category === 'leaks') {
    const leaks = war.leakedIntel || [];
    const exposedMasters = participants.filter(p => p.isExposed);
    const exposureEvents = (war.eventLogs || []).filter(e => e.type === 'intel_leak' || e.type === 'exposure');

    const leakLines = leaks.length > 0
      ? leaks.slice(0, 10).map((lk, idx) => {
          const timeStr = new Date(lk.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const targetName = lk.targetMasterId ? resolveDisplayName(lk.targetMasterId, client).replace(/^@/, '') : '';
          const targetTag = targetName ? ` ➔ Target: **Master ${targetName}**` : '';
          const rawInformant = lk.informantMasterId || 'Shadow Operative';
          const informantName = resolveDisplayName(rawInformant, client).replace(/^@/, '');
          return `• 📡 \`${timeStr}\` **Informant:** ${informantName}${targetTag}\n  ↳ Intercept: *"${lk.intel}"*`;
        }).join('\n\n')
      : '• *🔒 No leaked intelligence intercepted yet. Masters are maintaining encrypted silence and bounded fields.*';

    const exposureLines = exposureEvents.length > 0
      ? exposureEvents.slice(0, 6).map(e => {
          const timeStr = new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return `• 🕵️ \`${timeStr}\` ${e.text}`;
        }).join('\n')
      : '• *No identity exposures recorded.*';

    const embed = new EmbedBuilder()
      .setTitle(`🏆 ${war.title} — 🕵️ Intercepted Intelligence & Leaks`)
      .setDescription(
        `📡 **Surveillance & Intel Overview:**\n` +
        `• 🕵️ **Total Leaks Intercepted:** **${leaks.length}** dispatches\n` +
        `• 📡 **Compromised Masters:** **${exposedMasters.length}/${totalSummoned}** publicly exposed\n` +
        `• 🦅 **Active Familiar Scouts:** **${(war.familiars || []).length}** units stationed\n\n` +
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `📜 **INTERCEPTED TRANSMISSIONS & DISPATCHES (${leaks.length}):**\n${leakLines}\n\n` +
        `👁️ **RECENT RECON & EXPOSURE LOGS:**\n${exposureLines}\n\n` +
        `💡 *Tip: Deploy familiars or use \`/patrol\` in sectors to eavesdrop on rivals and intercept new intel.*`
      )
      .setColor(0x8b5cf6)
      .setFooter({ text: 'Holy Grail War Intelligence Dossier • Use options below to switch views' });

    embeds = [embed];

  } else if (category === 'battles') {
    const battleLines = battleEventsList.length > 0
      ? battleEventsList.slice(0, 12).map(evt => {
          let icon = '⚔️';
          if (evt.type === 'elimination') icon = '💀';
          else if (evt.type === 'casualty') icon = '☠️';
          else if (evt.type === 'ambush') icon = '🗡️';
          else if (evt.type === 'betrayal') icon = '💔';
          const timeStr = new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return `• ${icon} \`${timeStr}\` **${evt.text}**`;
        }).join('\n\n')
      : '• *No active clashes recorded in Fuyuki City yet. Tension mounts in the dark.*';

    const fatalCount = battleEventsList.filter(b => b.type === 'elimination').length;
    const ambushCount = battleEventsList.filter(b => b.type === 'ambush').length;

    const embed = new EmbedBuilder()
      .setTitle(`🏆 ${war.title} — ⚔️ Battle & Skirmish Chronicle`)
      .setDescription(
        `⚔️ **Combat Operations Overview:**\n` +
        `• 💥 **Total Recorded Engagements:** **${battleEventsList.length}** skirmishes\n` +
        `• 💀 **Fatal Eliminations:** **${fatalCount}** Servant Saint Graphs dissolved\n` +
        `• 🗡️ **Surprise Ambushes:** **${ambushCount}** ambush strikes launched\n\n` +
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `📜 **CHRONICLE OF RECORDED ENGAGEMENTS:**\n${battleLines}\n\n` +
        `💡 *Tip: Use \`/attack\` to ambush suspects, or click [Simulate Clash] below to provoke skirmishes.*`
      )
      .setColor(0xf97316)
      .setFooter({ text: 'Holy Grail War Battle Chronicle • Use options below to switch views' });

    embeds = [embed];

  } else if (category === 'defenses') {
    if (!userParticipant) {
      const embed = new EmbedBuilder()
        .setTitle('📜 Civilian Spectator Dossier')
        .setDescription('You are currently an innocent bystander in Fuyuki City with no contracted Servant. Use `/gacha` or `/summon ritual` to establish a covenant.')
        .setColor(0x71717a);
      embeds = [embed];
    } else {
      const ward = userParticipant?.boundedField || 'none';
      const autoEvade = userParticipant?.autoEvadeEnabled !== false;
      const seals = userParticipant?.commandSeals ?? 3;

      let wardDescription = '🚫 **No Active Wards:** Your workshop has no perimeter defenses.';
      if (ward === 'ward') {
        wardDescription = '🛡️ **Mage\'s Sanctuary Active:** Absorbs **60% of incoming ambush damage**.';
      } else if (ward === 'alarm') {
        wardDescription = '🚨 **Intrusion Alarm Active:** Deals **3,000 retaliatory DMG** and exposes intruders.';
      }

      const embed = new EmbedBuilder()
        .setTitle('🏰 Mage Workshop & Personal Sanctuary Defenses')
        .setDescription(
          `Master **${userParticipant?.username || master.username}**'s Defense Protocols\n\n` +
          (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
          `🛡️ **Bounded Field Ward:**\n${wardDescription}\n\n` +
          `🔴 **Command Seal Emergency Auto-Evacuation:**\n` +
          (autoEvade 
            ? `• **🟢 ENABLED:** Consumes **1 Command Seal** on fatal ambush to escape with **1 HP**.\n`
            : `• **🔴 DISABLED:** Fatal ambushes will eliminate your Servant normally.\n`) +
          `• **Command Seals Remaining:** \`${'✦ '.repeat(seals)}${'✧ '.repeat(Math.max(0, 3 - seals))}\` (**${seals}/3**)`
        )
        .setColor(0x3b82f6)
        .setFooter({ text: 'Holy Grail War Defense Headquarters' });

      embeds = [embed];
    }

  } else if (category === 'familiars') {
    const userFamiliars = (war.familiars || []).filter(f => f.masterId === master.discordId);
    let desc = '';
    if (userFamiliars.length === 0) {
      desc = 'You currently have **no active familiars** stationed in Fuyuki City.\n\nDeploy a reconnaissance familiar to gather intelligence and track rivals!';
    } else {
      desc = `You currently command **${userFamiliars.length}/2** active familiars:\n\n` +
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
        }).join('\n\n');
    }

    const embed = new EmbedBuilder()
      .setTitle('🦅 Active Familiar Reconnaissance Network')
      .setDescription(
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        desc
      )
      .setColor(0x0ea5e9)
      .setFooter({ text: 'Familiars gather intelligence and protect their Masters' });

    embeds = [embed];

  } else if (category === 'traps') {
    const userTraps = (war.channelTraps || []).filter(t => t.setterMasterId === master.discordId);
    let desc = '';
    if (userTraps.length === 0) {
      desc = 'You currently have **no active Bounded Field traps (0/3)** placed in any channel sectors.\n\n' +
        '• **Place in current channel:** Use the quick buttons below.\n' +
        '• **Place in another server channel:** Select any channel from the dropdown menu below, or use `/trap set type:... channel:#target`!';
    } else {
      desc = `You currently command **${userTraps.length}/3** active Bounded Field traps:\n\n` +
        userTraps.map((t, idx) => {
          const typeLabel = t.trapType === 'alarm' ? '🚨 **Alarm Ward** (Exposes intruder identity)' : '🩸 **Bloodfort Drain** (Siphons 1,800–2,600 HP)';
          return `**${idx + 1}. Sector ${t.channelName}** — ${typeLabel}\n*Deployed <t:${Math.floor(t.createdAt / 1000)}:R>*`;
        }).join('\n\n') +
        '\n\n🎯 **To anchor or disarm in other server channels:** Select an existing channel from the dropdown menu below!';
    }

    const embed = new EmbedBuilder()
      .setTitle('🕸️ Concealed Bounded Field Traps')
      .setDescription(
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        desc
      )
      .setColor(0x8b5cf6)
      .setFooter({ text: 'Bounded fields remain hidden until tripped • Max 3 fields per Master • 2–3 fields allowed per channel' });

    embeds = [embed];

  } else if (category === 'church') {
    const isUnderSanctuary = !!(userParticipant?.inSanctuary || userParticipant?.inChurchSanctuary);
    const embed = new EmbedBuilder()
      .setTitle('⛪ Fuyuki Church Sanctuary (Father Kotomine)')
      .setDescription(
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `*"Welcome to the Fuyuki Church, Master. Under the supervision of the Holy Church and Father Kotomine, neutral asylum is guaranteed to any combatant who yields their right to the Grail."*\n\n` +
        `📜 **SANCTUARY RULES & STATUS:**\n` +
        `• **Your Status:** ${isUnderSanctuary ? '🕊️ **UNDER CHURCH ASYLUM** *(Immune to ambushes & unable to attack)*' : '⚔️ **ACTIVE COMBATANT** *(Can engage in skirmishes)*'}\n` +
        `• **Immunity:** Masters residing within the Church cannot be ambushed or tracked by familiars.\n` +
        `• **Restriction:** While under sanctuary, you cannot launch ambushes, leak intel, or duel rivals.\n\n` +
        `*Choose an action below to claim or renounce church asylum.*`
      )
      .setColor(isUnderSanctuary ? 0x22c55e : 0xd4af37)
      .setFooter({ text: 'Fuyuki Church Neutral Grounds • Holy Grail War Supervisor' });

    embeds = [embed];
  }

  // --- UI COMPONENTS ---
  const isBoardSection = ['board', 'casualties', 'leaks', 'battles'].includes(category);

  const categoryNavRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('war_tab_board').setLabel('War Board').setEmoji('🏆').setStyle(isBoardSection ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('war_tab_defenses').setLabel('Defenses').setEmoji('🏰').setStyle(category === 'defenses' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('war_tab_familiars').setLabel('Familiars').setEmoji('🦅').setStyle(category === 'familiars' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('war_tab_traps').setLabel('Traps').setEmoji('🕸️').setStyle(category === 'traps' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('war_tab_church').setLabel('Church').setEmoji('⛪').setStyle(category === 'church' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  const components: any[] = [categoryNavRow];

  if (isBoardSection) {
    const boardSubViewsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('war_board_roster').setLabel('7 Masters').setEmoji('📋').setStyle(category === 'board' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('war_board_casualties').setLabel(`Casualties (${totalCasualties})`).setEmoji('☠️').setStyle(category === 'casualties' ? ButtonStyle.Danger : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('war_board_leaks').setLabel(`Leaks (${leaksCount})`).setEmoji('🕵️').setStyle(category === 'leaks' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('war_board_battles').setLabel(`Battles (${battleEventsList.length})`).setEmoji('⚔️').setStyle(category === 'battles' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('war_act_refresh').setLabel('Refresh').setEmoji('🔄').setStyle(ButtonStyle.Secondary)
    );
    components.push(boardSubViewsRow);

    const actionButtonsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('war_act_patrol').setLabel('Patrol Sector').setEmoji('👁️').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('war_act_skirmish').setLabel('Simulate Clash').setEmoji('⚔️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('war_act_heal').setLabel('Leyline Heal (40%)').setEmoji('✨').setStyle(ButtonStyle.Primary)
    );
    components.push(actionButtonsRow);
  } else if (category === 'defenses') {
    const curWard = userParticipant?.boundedField || 'none';
    const autoEvade = userParticipant?.autoEvadeEnabled !== false;
    const actionButtonsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('ward_none').setLabel('No Wards').setEmoji('🚫').setStyle(curWard === 'none' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ward_ward').setLabel('Sanctuary (60% Block)').setEmoji('🛡️').setStyle(curWard === 'ward' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ward_alarm').setLabel('Alarm Trap (3k DMG)').setEmoji('🚨').setStyle(curWard === 'alarm' ? ButtonStyle.Danger : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('toggle_auto_evade').setLabel(autoEvade ? 'Auto-Evacuate: ON 🟢' : 'Auto-Evacuate: OFF 🔴').setStyle(autoEvade ? ButtonStyle.Success : ButtonStyle.Secondary)
    );
    components.push(actionButtonsRow);
  } else if (category === 'familiars') {
    const userFamiliars = (war.familiars || []).filter(f => f.masterId === master.discordId);
    const actionButtonsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('war_deploy_raven').setLabel('Deploy Raven').setEmoji('🦅').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('war_deploy_homunculus').setLabel('Deploy Decoy').setEmoji('🗿').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('war_deploy_shadow_imp').setLabel('Deploy Shadow Imp').setEmoji('🦇').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('recall_all_familiars').setLabel('Recall Familiars').setEmoji('🕊️').setStyle(ButtonStyle.Danger).setDisabled(userFamiliars.length === 0)
    );
    components.push(actionButtonsRow);
  } else if (category === 'traps') {
    const userTraps = (war.channelTraps || []).filter(t => t.setterMasterId === master.discordId);
    const actionButtonsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('war_place_trap_alarm').setLabel('Place Alarm Ward (Current)').setEmoji('🚨').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('war_place_trap_drain').setLabel('Place Bloodfort Drain (Current)').setEmoji('🩸').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('disarm_all_traps').setLabel('Disarm All Traps').setEmoji('🧹').setStyle(ButtonStyle.Secondary).setDisabled(userTraps.length === 0)
    );
    components.push(actionButtonsRow);

    const trapChannelSelectRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('war_trap_channel_select')
        .setPlaceholder('🎯 Select an existing Discord channel to place Bounded Field...')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    );
    components.push(trapChannelSelectRow);
  } else if (category === 'church') {
    const isUnderSanctuary = !!(userParticipant?.inSanctuary || userParticipant?.inChurchSanctuary);
    const actionButtonsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('church_claim_asylum').setLabel('Enter Sanctuary').setEmoji('🕊️').setStyle(ButtonStyle.Success).setDisabled(!!isUnderSanctuary),
      new ButtonBuilder().setCustomId('church_leave_asylum').setLabel('Depart Sanctuary').setEmoji('🚪').setStyle(ButtonStyle.Danger).setDisabled(!isUnderSanctuary)
    );
    components.push(actionButtonsRow);
  }

  const crossHubShortcutsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('war_link_inventory').setLabel('Inventory (/inventory)').setEmoji('👔').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('war_link_gacha').setLabel('Gacha (/gacha)').setEmoji('🔮').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('war_link_servant').setLabel('Servant (/servant)').setEmoji('⚔️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('war_link_duel').setLabel('Duel Arena (/duel)').setEmoji('⚔️').setStyle(ButtonStyle.Secondary)
  );

  components.push(crossHubShortcutsRow);
  return { embeds, components };
}

// ==========================================
// 4. INTERACTION COLLECTOR
// ==========================================
export function attachGrailWarCollector(
  message: any,
  userId: string,
  initialMaster: any,
  initialCategory: 'board' | 'casualties' | 'leaks' | 'battles' | 'defenses' | 'familiars' | 'traps' | 'church' = 'board'
) {
  let currentCategory = initialCategory;

  const collector = message.createMessageComponentCollector({
    idle: 120000,
    time: 600000
  });

  collector.on('collect', async (i: any) => {
    if (i.replied || i.deferred) return;
    if (i.user.id !== userId) {
      await i.reply({ content: 'Only the Master who issued this command can interact with this Holy Grail War board.', flags: MessageFlags.Ephemeral });
      return;
    }
    collector.resetTimer();

    try {
      const master = await getOrCreateMaster(i.user.id, i.user.username);
      let war = getOrInitWarSession(master);
      let actionOutcome: string | undefined = undefined;

      const currentChan = i.channel && 'name' in i.channel ? `#${(i.channel as any).name}` : '#general';

      // TAB NAVIGATION & BOARD SUB-VIEWS
      if (i.customId === 'war_tab_board' || i.customId === 'war_board_roster') {
        currentCategory = 'board';
      } else if (i.customId === 'war_board_casualties') {
        currentCategory = 'casualties';
      } else if (i.customId === 'war_board_leaks') {
        currentCategory = 'leaks';
      } else if (i.customId === 'war_board_battles') {
        currentCategory = 'battles';
      } else if (i.customId === 'war_act_refresh') {
        actionOutcome = '🔄 Holy Grail War records updated.';
      } else if (i.customId === 'war_tab_defenses') {
        currentCategory = 'defenses';
      } else if (i.customId === 'war_tab_familiars') {
        currentCategory = 'familiars';
      } else if (i.customId === 'war_tab_traps') {
        currentCategory = 'traps';
      } else if (i.customId === 'war_tab_church') {
        currentCategory = 'church';
      }
      // BOARD ACTIONS
      else if (i.customId === 'war_act_patrol') {
        const res = patrolCityInWar(war, i.user.id, i.user.username, currentChan);
        war = res.updatedWar;
        actionOutcome = res.message;
        await saveMaster(master);
      } else if (i.customId === 'war_act_skirmish') {
        const res = simulateWarSkirmish(war, currentChan);
        war = res.updatedWar;
        actionOutcome = res.message;
        await saveMaster(master);
      } else if (i.customId === 'war_act_heal') {
        const res = executeWarAction(war, i.user.id, 'heal_ritual');
        war = res.updatedWar;
        actionOutcome = res.message;
        await saveMaster(master);
      }
      // DEFENSE ACTIONS
      else if (i.customId === 'ward_none' || i.customId === 'ward_ward' || i.customId === 'ward_alarm') {
        const wType = i.customId.replace('ward_', '');
        const res = executeWarAction(war, i.user.id, 'set_ward', wType);
        war = res.updatedWar;
        actionOutcome = res.message;
        await saveMaster(master);
      } else if (i.customId === 'toggle_auto_evade') {
        const uP = war.participants[i.user.id];
        const nextMode = uP?.autoEvadeEnabled !== false ? 'off' : 'on';
        const res = executeWarAction(war, i.user.id, 'toggle_evade', nextMode);
        war = res.updatedWar;
        actionOutcome = res.message;
        await saveMaster(master);
      }
      // FAMILIAR ACTIONS
      else if (i.customId.startsWith('war_deploy_')) {
        const famType = i.customId.replace('war_deploy_', '') as any;
        const res = dispatchFamiliarInWar(war, i.user.id, i.user.username, currentChan, famType);
        war = res.updatedWar;
        actionOutcome = res.message;
        await saveMaster(master);
      } else if (i.customId === 'recall_all_familiars') {
        const res = recallFamiliarsInWar(war, i.user.id);
        war = res.updatedWar;
        actionOutcome = res.message;
        await saveMaster(master);
      }
      // TRAP CHANNEL SELECTION & ACTIONS
      else if (i.isChannelSelectMenu && i.isChannelSelectMenu() && i.customId === 'war_trap_channel_select') {
        const selectedChanId = i.values[0];
        const selectedChan = i.guild?.channels.cache.get(selectedChanId);
        const targetChanName = selectedChan ? `#${selectedChan.name}` : `#${selectedChanId}`;

        const promptEmbed = new EmbedBuilder()
          .setTitle(`🕸️ Anchor Bounded Field in ${targetChanName}`)
          .setDescription(
            `You selected target channel: **${targetChanName}**\n\n` +
            `Choose which Bounded Field to deploy or manage in this sector:\n\n` +
            `• 🚨 **Sensory Alarm Ward:** Conceals an early warning perimeter that exposes rival Master identity and Servant true class upon typing.\n` +
            `• 🩸 **Bloodfort Mana Drain:** Traps the channel in a bounded field that siphons 1,800 HP from rival intruders directly into your Servant.\n` +
            `• 🧹 **Disarm Sector:** Dissolves any Bounded Field you have placed in ${targetChanName}.\n\n` +
            `*Or click Back to return to the War Hub.*`
          )
          .setColor(0x8b5cf6)
          .setFooter({ text: `Sector Target: ${targetChanName} • Holy Grail War` });

        const channelActionsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`war_anchor_alarm_${selectedChanId}`)
            .setLabel(`Anchor Alarm (${targetChanName})`)
            .setEmoji('🚨')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`war_anchor_drain_${selectedChanId}`)
            .setLabel(`Anchor Drain (${targetChanName})`)
            .setEmoji('🩸')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`war_anchor_disarm_${selectedChanId}`)
            .setLabel(`Disarm ${targetChanName}`)
            .setEmoji('🧹')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('war_tab_traps')
            .setLabel('Back to Traps')
            .setEmoji('⬅️')
            .setStyle(ButtonStyle.Secondary)
        );

        await i.update({
          embeds: [promptEmbed],
          components: [channelActionsRow]
        });
        return;
      } else if (i.customId.startsWith('war_anchor_alarm_')) {
        const chanId = i.customId.replace('war_anchor_alarm_', '');
        const chan = i.guild?.channels.cache.get(chanId);
        const chanName = chan ? `#${chan.name}` : `#${chanId}`;
        const res = setChannelTrapInWar(war, i.user.id, i.user.username, chanName, 'alarm');
        war = res.updatedWar;
        actionOutcome = res.message;
        await saveMaster(master);
        currentCategory = 'traps';
      } else if (i.customId.startsWith('war_anchor_drain_')) {
        const chanId = i.customId.replace('war_anchor_drain_', '');
        const chan = i.guild?.channels.cache.get(chanId);
        const chanName = chan ? `#${chan.name}` : `#${chanId}`;
        const res = setChannelTrapInWar(war, i.user.id, i.user.username, chanName, 'drain');
        war = res.updatedWar;
        actionOutcome = res.message;
        await saveMaster(master);
        currentCategory = 'traps';
      } else if (i.customId.startsWith('war_anchor_disarm_')) {
        const chanId = i.customId.replace('war_anchor_disarm_', '');
        const chan = i.guild?.channels.cache.get(chanId);
        const chanName = chan ? `#${chan.name}` : `#${chanId}`;
        const res = disarmChannelTrapsInWar(war, i.user.id, chanName);
        war = res.updatedWar;
        actionOutcome = res.message;
        await saveMaster(master);
        currentCategory = 'traps';
      } else if (i.customId === 'war_place_trap_alarm') {
        const res = setChannelTrapInWar(war, i.user.id, i.user.username, currentChan, 'alarm');
        war = res.updatedWar;
        actionOutcome = res.message;
        if (!res.success) {
          actionOutcome += '\n💡 *Tip: Select an existing channel from the dropdown menu below or use `/trap set type:alarm channel:#target` to anchor in a different channel.*';
        }
        await saveMaster(master);
      } else if (i.customId === 'war_place_trap_drain') {
        const res = setChannelTrapInWar(war, i.user.id, i.user.username, currentChan, 'drain');
        war = res.updatedWar;
        actionOutcome = res.message;
        if (!res.success) {
          actionOutcome += '\n💡 *Tip: Select an existing channel from the dropdown menu below or use `/trap set type:drain channel:#target` to anchor in a different channel.*';
        }
        await saveMaster(master);
      } else if (i.customId === 'disarm_all_traps') {
        const res = disarmChannelTrapsInWar(war, i.user.id);
        war = res.updatedWar;
        actionOutcome = res.message;
        await saveMaster(master);
      }
      // CHURCH ACTIONS
      else if (i.customId === 'church_claim_asylum') {
        const res = enterChurchSanctuary(war, i.user.id);
        war = res.updatedWar;
        actionOutcome = res.message;
        await saveMaster(master);
      } else if (i.customId === 'church_leave_asylum') {
        const res = leaveChurchSanctuary(war, i.user.id);
        war = res.updatedWar;
        actionOutcome = res.message;
        await saveMaster(master);
      }
      // CROSS-HUB SHORTCUTS
      else if (i.customId === 'war_link_inventory') {
        await i.reply({ content: 'Use `/inventory` to open your Master Vault and equip Craft Essences!', flags: MessageFlags.Ephemeral });
        return;
      } else if (i.customId === 'war_link_gacha') {
        await i.reply({ content: 'Use `/gacha` to forge Mystic Codes & Craft Essences using Saint Quartz!', flags: MessageFlags.Ephemeral });
        return;
      } else if (i.customId === 'war_link_servant') {
        await i.reply({ content: 'Use `/servant` to view your Heroic Spirit parameter card, allocate points, and hear dialogue!', flags: MessageFlags.Ephemeral });
        return;
      } else if (i.customId === 'war_link_duel') {
        await i.reply({ content: 'Use `/duel` to enter the combat arena and battle rivals or AI!', flags: MessageFlags.Ephemeral });
        return;
      }

      const hub = buildGrailWarHub(war, master, currentCategory, actionOutcome, i.client);
      await i.update({
        embeds: hub.embeds,
        components: hub.components
      });

    } catch (err: any) {
      if (
        err.code === 10062 || 
        err.code === 40060 || 
        err.code === 50027 || 
        err.message?.includes('Unknown interaction') || 
        err.message?.includes('already been acknowledged')
      ) {
        return;
      }
      console.error('Error in grailwar collector:', err);
    }
  });
}

// Legacy export compatibility
export function buildWarEmbed(war: HolyGrailWarSession, master: any, actionOutcomeMsg?: string) {
  const hub = buildGrailWarHub(war, master, 'board', actionOutcomeMsg);
  return hub.embeds[0];
}

export function buildWarButtons(category: string = 'board') {
  const dummyWar = { participants: {} } as any;
  const dummyMaster = { discordId: '' };
  const hub = buildGrailWarHub(dummyWar, dummyMaster, category as any);
  return hub.components;
}
