import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  StringSelectMenuBuilder,
  ComponentType
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
  .setDescription('Holy Grail War Hub — 7-Master Roster, Defenses, Familiars, Traps & Church Sanctuary')
  .addStringOption(opt =>
    opt
      .setName('category')
      .setDescription('Select Grail War operations sector')
      .setRequired(false)
      .addChoices(
        { name: '🏆 War Board & 7-Master Roster', value: 'board' },
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
  await interaction.deferReply({ ephemeral: true });

  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const category = (interaction.options.getString('category') as any) || 'board';

    const war = getOrInitWarSession(master);
    const { embeds, components } = buildGrailWarHub(war, master, category);

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
  category: 'board' | 'defenses' | 'familiars' | 'traps' | 'church' = 'board',
  actionOutcomeMsg?: string
) {
  const userParticipant = war.participants[master.discordId];
  let embeds: EmbedBuilder[] = [];

  if (category === 'board') {
    const participants = Object.values(war.participants || {});
    const aliveParticipants = participants.filter(p => p.isAlive);
    const deadCount = participants.filter(p => !p.isAlive).length;
    const totalSummoned = participants.length;

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
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `⚔️ **7 Masters Intelligence Roster:**\n${rosterLines.join('\n')}\n\n` +
        `📜 **War Chronicle & Skirmishes (${(war.eventLogs || []).length} Events | ${leaksCount} Leaks):**\n${recentEvents || '*The war has begun. No city skirmishes recorded yet.*'}`
      )
      .setColor(0xd4af37)
      .setFooter({ text: 'Holy Grail War Operations Board • Use tabs below to navigate systems' });

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
      desc = 'You currently have **no active Bounded Field traps** placed in any channel sectors.\n\nLay a hidden trap to surprise rivals!';
    } else {
      desc = `You currently command **${userTraps.length}/2** active Bounded Field traps:\n\n` +
        userTraps.map((t, idx) => {
          const typeLabel = t.trapType === 'alarm' ? '🚨 **Alarm Ward** (Exposes intruder identity)' : '🩸 **Bloodfort Drain** (Siphons 1,800 HP)';
          return `**${idx + 1}. Sector ${t.channelName}** — ${typeLabel}\n*Deployed <t:${Math.floor(t.createdAt / 1000)}:R>*`;
        }).join('\n\n');
    }

    const embed = new EmbedBuilder()
      .setTitle('🕸️ Concealed Bounded Field Traps')
      .setDescription(
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        desc
      )
      .setColor(0x8b5cf6)
      .setFooter({ text: 'Bounded fields remain hidden until tripped by a rival Master' });

    embeds = [embed];

  } else if (category === 'church') {
    const isUnderSanctuary = userParticipant?.inChurchSanctuary;
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
  const categoryNavRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('war_tab_board').setLabel('War Board').setEmoji('🏆').setStyle(category === 'board' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('war_tab_defenses').setLabel('Defenses').setEmoji('🏰').setStyle(category === 'defenses' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('war_tab_familiars').setLabel('Familiars').setEmoji('🦅').setStyle(category === 'familiars' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('war_tab_traps').setLabel('Traps').setEmoji('🕸️').setStyle(category === 'traps' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('war_tab_church').setLabel('Church').setEmoji('⛪').setStyle(category === 'church' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  const actionButtonsRow = new ActionRowBuilder<ButtonBuilder>();

  if (category === 'board') {
    actionButtonsRow.addComponents(
      new ButtonBuilder().setCustomId('war_act_patrol').setLabel('Patrol Sector').setEmoji('👁️').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('war_act_skirmish').setLabel('Simulate Clash').setEmoji('⚔️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('war_act_heal').setLabel('Leyline Heal (40%)').setEmoji('✨').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('war_act_refresh').setLabel('Refresh Board').setEmoji('🔄').setStyle(ButtonStyle.Secondary)
    );
  } else if (category === 'defenses') {
    const curWard = userParticipant?.boundedField || 'none';
    const autoEvade = userParticipant?.autoEvadeEnabled !== false;
    actionButtonsRow.addComponents(
      new ButtonBuilder().setCustomId('ward_none').setLabel('No Wards').setEmoji('🚫').setStyle(curWard === 'none' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ward_ward').setLabel('Sanctuary (60% Block)').setEmoji('🛡️').setStyle(curWard === 'ward' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ward_alarm').setLabel('Alarm Trap (3k DMG)').setEmoji('🚨').setStyle(curWard === 'alarm' ? ButtonStyle.Danger : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('toggle_auto_evade').setLabel(autoEvade ? 'Auto-Evacuate: ON 🟢' : 'Auto-Evacuate: OFF 🔴').setStyle(autoEvade ? ButtonStyle.Success : ButtonStyle.Secondary)
    );
  } else if (category === 'familiars') {
    const userFamiliars = (war.familiars || []).filter(f => f.masterId === master.discordId);
    actionButtonsRow.addComponents(
      new ButtonBuilder().setCustomId('war_deploy_raven').setLabel('Deploy Raven').setEmoji('🦅').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('war_deploy_homunculus').setLabel('Deploy Decoy').setEmoji('🗿').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('war_deploy_shadow_imp').setLabel('Deploy Shadow Imp').setEmoji('🦇').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('recall_all_familiars').setLabel('Recall Familiars').setEmoji('🕊️').setStyle(ButtonStyle.Danger).setDisabled(userFamiliars.length === 0)
    );
  } else if (category === 'traps') {
    const userTraps = (war.channelTraps || []).filter(t => t.setterMasterId === master.discordId);
    actionButtonsRow.addComponents(
      new ButtonBuilder().setCustomId('war_place_trap_alarm').setLabel('Place Alarm Ward').setEmoji('🚨').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('war_place_trap_drain').setLabel('Place Bloodfort Drain').setEmoji('🩸').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('disarm_all_traps').setLabel('Disarm All Traps').setEmoji('🧹').setStyle(ButtonStyle.Secondary).setDisabled(userTraps.length === 0)
    );
  } else if (category === 'church') {
    const isUnderSanctuary = userParticipant?.inChurchSanctuary;
    actionButtonsRow.addComponents(
      new ButtonBuilder().setCustomId('church_claim_asylum').setLabel('Enter Sanctuary').setEmoji('🕊️').setStyle(ButtonStyle.Success).setDisabled(!!isUnderSanctuary),
      new ButtonBuilder().setCustomId('church_leave_asylum').setLabel('Depart Sanctuary').setEmoji('🚪').setStyle(ButtonStyle.Danger).setDisabled(!isUnderSanctuary)
    );
  }

  const crossHubShortcutsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('war_link_inventory').setLabel('Inventory (/inventory)').setEmoji('👔').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('war_link_gacha').setLabel('Gacha (/gacha)').setEmoji('🔮').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('war_link_servant').setLabel('Servant (/servant)').setEmoji('⚔️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('war_link_duel').setLabel('Duel Arena (/duel)').setEmoji('⚔️').setStyle(ButtonStyle.Secondary)
  );

  const components: any[] = [categoryNavRow, actionButtonsRow, crossHubShortcutsRow];
  return { embeds, components };
}

// ==========================================
// 4. INTERACTION COLLECTOR
// ==========================================
export function attachGrailWarCollector(
  message: any,
  userId: string,
  initialMaster: any,
  initialCategory: 'board' | 'defenses' | 'familiars' | 'traps' | 'church' = 'board'
) {
  let currentCategory = initialCategory;

  const collector = message.createMessageComponentCollector({
    idle: 120000,
    time: 600000
  });

  collector.on('collect', async (i: any) => {
    if (i.replied || i.deferred) return;
    if (i.user.id !== userId) {
      await i.reply({ content: 'Only the Master who issued this command can interact with this Holy Grail War board.', ephemeral: true });
      return;
    }
    collector.resetTimer();

    try {
      const master = await getOrCreateMaster(i.user.id, i.user.username);
      let war = getOrInitWarSession(master);
      let actionOutcome: string | undefined = undefined;

      const currentChan = i.channel && 'name' in i.channel ? `#${(i.channel as any).name}` : '#general';

      // TAB NAVIGATION
      if (i.customId === 'war_tab_board') {
        currentCategory = 'board';
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
      // TRAP ACTIONS
      else if (i.customId === 'war_place_trap_alarm') {
        const res = setChannelTrapInWar(war, i.user.id, i.user.username, currentChan, 'alarm');
        war = res.updatedWar;
        actionOutcome = res.message;
        await saveMaster(master);
      } else if (i.customId === 'war_place_trap_drain') {
        const res = setChannelTrapInWar(war, i.user.id, i.user.username, currentChan, 'drain');
        war = res.updatedWar;
        actionOutcome = res.message;
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
        await i.reply({ content: 'Use `/inventory` to open your Master Vault and equip Craft Essences!', ephemeral: true });
        return;
      } else if (i.customId === 'war_link_gacha') {
        await i.reply({ content: 'Use `/gacha` to roll for Heroic Spirits and Craft Essences!', ephemeral: true });
        return;
      } else if (i.customId === 'war_link_servant') {
        await i.reply({ content: 'Use `/servant` to view your Heroic Spirit parameter card, allocate points, and hear dialogue!', ephemeral: true });
        return;
      } else if (i.customId === 'war_link_duel') {
        await i.reply({ content: 'Use `/duel` to enter the combat arena and battle rivals or AI!', ephemeral: true });
        return;
      }

      const hub = buildGrailWarHub(war, master, currentCategory, actionOutcome);
      await i.update({
        embeds: hub.embeds,
        components: hub.components
      });

    } catch (err: any) {
      if (err.code === 10062 || err.message?.includes('Unknown interaction')) return;
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
