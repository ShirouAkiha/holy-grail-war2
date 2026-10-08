import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  ComponentType,
  MessageFlags
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { RAID_BOSSES, RaidBossConfig } from '../data/raidBosses';
import { renderRaidBattlefield, RaidBattleState, RaidParticipantState } from '../canvas/raidRenderer';
import { getNoblePhantasmGif, getNoblePhantasmChant } from '../data/noblePhantasmGifs';
import { normalizeMediaUrl } from '../utils/mediaResolver';
import { safeSetEmbedImage } from '../utils/discordEmbedHelper';
import { addServantBattleExp, createExpEmberCraftEssence } from '../engine/customization';
import { calculateServantMaxHp } from '../engine/statSystem';

export const data = new SlashCommandBuilder()
  .setName('raid')
  .setDescription('Launch or join a cooperative PvE Demon God Pillar / Beast Raid Battle (1-4 Masters)')
  .addSubcommand(sub =>
    sub.setName('menu')
      .setDescription('Open the Grand Raid Terminal to inspect bosses, phases, drops, and select your raid target')
  )
  .addSubcommand(sub =>
    sub.setName('barbatos')
      .setDescription('Challenge Demon God Pillar Barbatos in the Solomon Temple of Time (Solo or 4P Co-op)')
  )
  .addSubcommand(sub =>
    sub.setName('tiamat')
      .setDescription('Challenge Beast II / Primordial Mother Tiamat in the Chaos Sea (3-Phase Break Gauge Raid)')
  )
  .addSubcommand(sub =>
    sub.setName('info')
      .setDescription('View PvE raid mechanics, break gauges, drops, and weaknesses')
      .addStringOption(opt =>
        opt.setName('boss')
          .setDescription('Select boss to inspect')
          .setRequired(false)
          .addChoices(
            { name: 'Demon God Pillar Barbatos (Temple of Time)', value: 'barbatos' },
            { name: 'Beast II / Primordial Mother Tiamat (Chaos Sea)', value: 'tiamat' }
          )
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand(false) || 'menu';

  if (subcommand === 'info') {
    const requestedBoss = interaction.options.getString('boss') || 'barbatos';
    const boss = RAID_BOSSES[requestedBoss] || RAID_BOSSES['barbatos'];
    const isTiamat = boss.id === 'tiamat';

    let phaseDesc = '';
    if (boss.phases && boss.phases.length > 0) {
      phaseDesc = `\n🔥 **Break Gauge Phases (${boss.totalPhases || 3} Phases):**\n` +
        boss.phases.map(p => `• **Phase ${p.phaseNumber}: ${p.name}** (${p.baseHp.toLocaleString()} HP • ${p.maxCharge} Charge)\n  ${p.passives.map(ps => `  - *${ps}*`).join('\n')}`).join('\n') + '\n';
    }

    const infoEmbed = new EmbedBuilder()
      .setTitle(`👑 PVE RAID: ${boss.name.toUpperCase()}`)
      .setDescription(
        `**Title:** ${boss.title}\n` +
        `**Class:** \`${boss.servantClass}\` • **Level:** \`${boss.level}\` • **HP:** \`${boss.baseHp.toLocaleString()}\`\n` +
        `**Max Charge:** \`${Array(boss.maxCharge).fill('◆').join(' ')} (${boss.maxCharge} Diamonds)\`\n` +
        phaseDesc +
        `\n⚔️ **Raid Mechanics & Skills:**\n` +
        boss.skills.map(s => `• **${s.name}**: ${s.description}`).join('\n') +
        `\n• **Charge Attack**: **${boss.chargeAttack.name}** — ${boss.chargeAttack.description}\n\n` +
        `💎 **Victory Rewards (All Participating Masters):**\n` +
        `• Saint Quartz: **${boss.drops.minSq} – ${boss.drops.maxSq} SQ** 💎\n` +
        `• Servant Battle EXP: **+${boss.drops.servantExp.toLocaleString()} EXP** ⚔️ *(Levels up Servant & awards Stat Points!)*\n` +
        `• Relic Drops: **${boss.drops.emberCount}x Blaze of Wisdom EXP Embers** ✨ *(Universal enhancement relics for \`/feed\`)*`
      )
      .setThumbnail(boss.avatarUrl)
      .setColor(isTiamat ? 0xd946ef : 0x7c3aed)
      .setFooter({ text: 'Holy Grail War Engine • Chaldea Raid Protocol' });

    await interaction.reply({ embeds: [infoEmbed] });
    return;
  }

  // Raid Initiation & Lobby
  await interaction.deferReply();

  const hostMaster = await getOrCreateMaster(interaction.user.id, interaction.user.username);
  const hostServant = hostMaster.servants?.find(s => s.id === hostMaster.activeServantId) || hostMaster.servants?.[0];

  if (!hostServant) {
    await interaction.editReply({
      content: '❌ You must summon a Servant before launching a PvE Raid! Invoke `/summon ritual` first.'
    });
    return;
  }

  // If invoked with /raid or /raid menu: show interactive Grand Raid Terminal menu
  if (subcommand === 'menu') {
    const sName = hostServant.nickname || hostServant.template?.name || 'Contracted Servant';
    const sClass = hostServant.template?.servantClass || 'Saber';
    const sLvl = hostServant.level || 90;

    const menuEmbed = new EmbedBuilder()
      .setTitle('🔱 CHALDEA GRAND RAID TERMINAL — CALAMITY INCURSION HUB')
      .setDescription(
        `🚨 **CHALDEA SECURITY ORGANIZATION • PVE RAID OPERATIONS**\n\n` +
        `Deploy your active Servant alongside allied Masters to suppress Demon God Pillars and World Evils threatening Human History.\n\n` +
        `👑 **Active Vanguard:** **${sName}** (\`${sClass}\` Lv.${sLvl})\n` +
        `❤️ **Vanguard Parameters:** \`${hostServant.template?.baseHp?.toLocaleString() || '14,000'} HP\` | \`${hostServant.template?.baseAtk?.toLocaleString() || '11,000'} ATK\`\n` +
        `🔴 **Command Seals:** \`${hostMaster.commandSeals ?? 3}/3\`\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `👁️ **1. DEMON GOD PILLAR BARBATOS** — *Temple of Time*\n` +
        `• **Class:** \`Caster\` • **Level:** \`90\` • **HP:** \`1,200,000\` (Single Phase)\n` +
        `• **Threat:** Observation Pillar • Lowers party DEF & drains critical stars\n` +
        `• **Victory Drops:** 💎 \`10–20 SQ\` • ⚔️ \`+25,000 EXP\` • 💖 \`+2,000 Bond\` • ✨ \`3x Embers\`\n\n` +
        `🌊 **2. BEAST II / PRIMORDIAL MOTHER TIAMAT** — *Chaos Sea of Genesis*\n` +
        `• **Class:** \`Beast\` • **Level:** \`95\` • **HP:** \`17,000,000\` (**3 Break Gauges**)\n` +
        `• **Phases:** Limiter (3.5M HP) ➔ Titan (5.5M HP) ➔ Primeval Dragon (8M HP)\n` +
        `• **Mechanics:** Sea of Life (-2,000 HP/T), Self-Limitation, Nega-Genesis (-50% card DMG, NP True DMG)\n` +
        `• **Victory Drops:** 💎 \`20–35 SQ\` • ⚔️ \`+60,000 EXP\` • 💖 \`+5,000 Bond\` • ✨ \`5x Embers\`\n\n` +
        `👉 *Select a Raid Boss below to establish your co-op incursion lobby:*`
      )
      .setColor(0xd946ef)
      .setFooter({ text: 'Holy Grail War PvE Engine • 1-4 Masters Co-op' });

    const menuButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('raid_menu_barbatos')
        .setLabel('Fight Barbatos (Lv.90)')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('👁️'),
      new ButtonBuilder()
        .setCustomId('raid_menu_tiamat')
        .setLabel('Fight Tiamat (3-Phase)')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🌊'),
      new ButtonBuilder()
        .setCustomId('raid_menu_info')
        .setLabel('Boss Intel & Drops')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📖')
    );

    const menuMsg = await interaction.editReply({
      embeds: [menuEmbed],
      components: [menuButtons]
    });

    const menuCollector = menuMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 90_000
    });

    menuCollector.on('collect', async (btn) => {
      if (btn.user.id !== interaction.user.id) {
        await btn.reply({
          content: '❌ Only the initiating Master can pick the raid boss from this menu.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      menuCollector.stop('selected');
      await btn.deferUpdate();

      if (btn.customId === 'raid_menu_info') {
        const infoEmbed = new EmbedBuilder()
          .setTitle('📖 CHALDEA RAID BOSS DOSSIER & DROP INTELLIGENCE')
          .setDescription(
            `**1. Demon God Pillar Barbatos (Temple of Time)**\n` +
            `• Class: \`Caster\` • HP: \`1,200,000\` • Charge: 5\n` +
            `• Traits: Demonic, Giant, Super Large, Demon God Pillar\n` +
            `• Skills: DEF Shred 20%, Curse (1,200 DMG/T), 25% ATK buff\n` +
            `• Drops: 10–20 SQ, 25k EXP, 2,000 Bond, 3x Embers\n\n` +
            `**2. Beast II / Tiamat (Chaos Sea)**\n` +
            `• Class: \`Beast\` • Total HP: \`17,000,000\` (3 Break Gauges)\n` +
            `• Traits: Beast, Divine, Dragon, Super Large, Female\n` +
            `• Skills: Sea of Life (corrosive mud), Mud Surge, Chaos Deluge\n` +
            `• Drops: 20–35 SQ, 60k EXP, 5,000 Bond, 5x Embers`
          )
          .setColor(0x38bdf8);

        await menuMsg.edit({
          embeds: [infoEmbed],
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder().setCustomId('raid_menu_barbatos').setLabel('Fight Barbatos').setStyle(ButtonStyle.Primary).setEmoji('👁️'),
              new ButtonBuilder().setCustomId('raid_menu_tiamat').setLabel('Fight Tiamat').setStyle(ButtonStyle.Danger).setEmoji('🌊')
            )
          ]
        });

        const subCollector = menuMsg.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 60_000
        });

        subCollector.on('collect', async (subBtn) => {
          if (subBtn.user.id !== interaction.user.id) return;
          subCollector.stop();
          await subBtn.deferUpdate();
          const chosenKey = subBtn.customId === 'raid_menu_tiamat' ? 'tiamat' : 'barbatos';
          await launchRaidLobby(interaction, menuMsg, chosenKey, hostMaster, hostServant);
        });
        return;
      }

      const chosenKey = btn.customId === 'raid_menu_tiamat' ? 'tiamat' : 'barbatos';
      await launchRaidLobby(interaction, menuMsg, chosenKey, hostMaster, hostServant);
    });

    return;
  }

  const directBossKey = subcommand === 'tiamat' ? 'tiamat' : 'barbatos';
  await launchRaidLobby(interaction, null, directBossKey, hostMaster, hostServant);
}

async function launchRaidLobby(
  interaction: ChatInputCommandInteraction,
  existingMsg: any,
  bossKey: string,
  hostMaster: any,
  hostServant: any
) {
  const boss = RAID_BOSSES[bossKey] || RAID_BOSSES['barbatos'];
  const isTiamat = boss.id === 'tiamat';

  const lobbyParticipants: {
    userId: string;
    username: string;
    master: any;
    servant: any;
  }[] = [
    {
      userId: interaction.user.id,
      username: interaction.user.username,
      master: hostMaster,
      servant: hostServant
    }
  ];

  const buildLobbyEmbed = () => {
    const partyList = lobbyParticipants.map((p, idx) => {
      const sName = p.servant.nickname || p.servant.template?.name || 'Heroic Spirit';
      const sClass = p.servant.template?.servantClass || 'Saber';
      const sLvl = p.servant.level || 90;
      return `**${idx + 1}.** <@${p.userId}> — **${sName}** (\`${sClass}\` Lv.${sLvl})`;
    }).join('\n');

    const locationText = isTiamat
      ? 'Underworld Abyss • Chaos Sea of Genesis'
      : 'Grand Temple of Time • Throne of Solomon';

    const bossSubtitle = isTiamat
      ? `**Boss:** **${boss.name}** (\`${boss.servantClass}\` • Lv.${boss.level} • 3-Phase Break Gauge Boss)\n**Phase 1 HP:** **${boss.baseHp.toLocaleString()} HP** (3 Break Gauges Total)\n\n`
      : `**Boss:** **${boss.name}** (\`${boss.servantClass}\` • Lv.${boss.level})\n**Total Boss HP:** **${boss.baseHp.toLocaleString()} HP**\n\n`;

    return new EmbedBuilder()
      .setTitle(`⚔️ PVE RAID LOBBY: ${boss.name.toUpperCase()}`)
      .setDescription(
        `**Location:** ${locationText}\n` +
        bossSubtitle +
        `👥 **Raid Party Formation (${lobbyParticipants.length}/4 Masters):**\n` +
        `${partyList}\n\n` +
        `*Click **Join Raid** to bring your active Servant into the fight, or the host can launch immediately!*`
      )
      .setThumbnail(boss.avatarUrl)
      .setColor(isTiamat ? 0xd946ef : 0x9333ea)
      .setFooter({ text: 'PvE Raid Engine • Up to 4 Masters can join' });
  };

  const buildLobbyButtons = () => {
    const isFull = lobbyParticipants.length >= 4;
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('raid_lobby_join')
        .setLabel(`Join Raid (${lobbyParticipants.length}/4)`)
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⚔️')
        .setDisabled(isFull),
      new ButtonBuilder()
        .setCustomId('raid_lobby_start')
        .setLabel('🔥 Commence Raid')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('raid_lobby_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );
  };

  const lobbyMsg = existingMsg
    ? await existingMsg.edit({
        embeds: [buildLobbyEmbed()],
        components: [buildLobbyButtons()]
      })
    : await interaction.editReply({
        embeds: [buildLobbyEmbed()],
        components: [buildLobbyButtons()]
      });

  const lobbyCollector = lobbyMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120_000
  });

  lobbyCollector.on('collect', async (btn: any) => {
    if (btn.customId === 'raid_lobby_join') {
      if (lobbyParticipants.some(p => p.userId === btn.user.id)) {
        await btn.reply({
          content: '❌ You are already in the raid party!',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      if (lobbyParticipants.length >= 4) {
        await btn.reply({
          content: '❌ Raid party is full (Maximum 4 Masters)!',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const joinerMaster = await getOrCreateMaster(btn.user.id, btn.user.username);
      const joinerServant = joinerMaster.servants?.find(s => s.id === joinerMaster.activeServantId) || joinerMaster.servants?.[0];

      if (!joinerServant) {
        await btn.reply({
          content: '❌ You must summon a Servant before joining! Use `/summon ritual`.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      lobbyParticipants.push({
        userId: btn.user.id,
        username: btn.user.username,
        master: joinerMaster,
        servant: joinerServant
      });

      await btn.deferUpdate();
      await lobbyMsg.edit({
        embeds: [buildLobbyEmbed()],
        components: [buildLobbyButtons()]
      });
      return;
    }

    if (btn.customId === 'raid_lobby_cancel') {
      if (btn.user.id !== interaction.user.id) {
        await btn.reply({
          content: '❌ Only the raid host can cancel the lobby.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      lobbyCollector.stop('cancelled');
      await btn.update({
        content: '🕊️ Raid lobby cancelled by host.',
        embeds: [],
        components: []
      });
      return;
    }

    if (btn.customId === 'raid_lobby_start') {
      if (btn.user.id !== interaction.user.id) {
        await btn.reply({
          content: '❌ Only the raid host can commence the battle.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      lobbyCollector.stop('commenced');
      await btn.deferUpdate();
      await runRaidBattle(interaction, lobbyMsg, boss, lobbyParticipants);
      return;
    }
  });

  lobbyCollector.on('end', async (_: any, reason: any) => {
    if (reason === 'time') {
      await lobbyMsg.edit({
        content: '⏳ Raid lobby recruitment expired.',
        components: []
      }).catch(() => {});
    }
  });
}

function getServantCommandDeck(servantClass: string = 'Saber'): ('Buster' | 'Arts' | 'Quick')[] {
  switch (servantClass) {
    case 'Berserker':
      return ['Buster', 'Buster', 'Buster', 'Arts', 'Quick'];
    case 'Assassin':
      return ['Quick', 'Quick', 'Quick', 'Arts', 'Buster'];
    case 'Lancer':
      return ['Buster', 'Buster', 'Quick', 'Quick', 'Arts'];
    case 'Rider':
      return ['Quick', 'Quick', 'Arts', 'Arts', 'Buster'];
    case 'Archer':
      return ['Arts', 'Arts', 'Quick', 'Quick', 'Buster'];
    case 'Caster':
      return ['Arts', 'Arts', 'Arts', 'Buster', 'Quick'];
    case 'Saber':
    default:
      return ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'];
  }
}

function refreshParticipantHand(combatant: RaidParticipantState): ('Buster' | 'Arts' | 'Quick')[] {
  if (!combatant.drawPile || combatant.drawPile.length < 5) {
    const sClass = combatant.servant.template?.servantClass || 'Saber';
    const deck = getServantCommandDeck(sClass);
    const freshShoe: ('Buster' | 'Arts' | 'Quick')[] = [...deck, ...deck, ...deck];
    for (let i = freshShoe.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [freshShoe[i], freshShoe[j]] = [freshShoe[j], freshShoe[i]];
    }
    combatant.drawPile = freshShoe;
  }
  combatant.currentHand = combatant.drawPile.splice(0, 5);
  return combatant.currentHand;
}

async function runRaidBattle(
  interaction: ChatInputCommandInteraction,
  battleMsg: any,
  boss: RaidBossConfig,
  partyUsers: { userId: string; username: string; master: any; servant: any }[]
) {
  const participants: RaidParticipantState[] = partyUsers.map(p => {
    const s = p.servant;
    const t = s.template || {};
    const calculatedMaxHp = calculateServantMaxHp(s);
    const currentHp = calculatedMaxHp;

    // Ensure any user whose persistent profile command seals were reduced by prior raid battles is restored to 3
    if (p.master && (p.master.commandSeals === undefined || p.master.commandSeals < 3)) {
      p.master.commandSeals = 3;
      saveMaster(p.master).catch(() => {});
    }

    const initialBuffs: any[] = [];

  const raidSessionId = `raid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const raidMessageIds = new Set<string>();
  if (battleMsg?.id) {
    raidMessageIds.add(battleMsg.id);
  }

  const isInteractionForThisRaid = (btn: any): boolean => {
    const msgId = btn?.message?.id;
    if (msgId && (raidMessageIds.has(msgId) || msgId === battleMsg?.id)) {
      return true;
    }
    if (typeof btn?.customId === 'string' && btn.customId.includes(raidSessionId)) {
      return true;
    }
    return false;
  };
    const equippedCe = s.equippedCe || p.master?.craftEssences?.find((c: any) => c.id === s.equippedCeId);
    if (equippedCe) {
      if (equippedCe.id === 'ce_castle_of_snow' || equippedCe.name?.includes('Castle of Snow')) {
        initialBuffs.push({
          name: 'Castle of Snow (Guts x3)',
          type: 'guts',
          value: 500,
          remainingTurns: 99,
          remainingHits: 3,
          isHitCount: true
        });
      } else if (equippedCe.passiveType === 'guts' || equippedCe.name?.includes('Necromancy')) {
        initialBuffs.push({
          name: `${equippedCe.name} (Guts)`,
          type: 'guts',
          value: equippedCe.hpBonus || 1000,
          remainingTurns: 99,
          remainingHits: 1,
          isHitCount: true
        });
      }
    }

    const passives = t.passives || [];
    const servId = s.templateId || t.id || '';
    if (
      (servId === 'luvria_greenharte' || servId === 'adiosa_dragon_envoy') &&
      passives.some((ps: any) => ps.name?.includes('Absolute Permanence') || ps.type === 'absolute_permanence')
    ) {
      initialBuffs.push({
        name: 'Absolute Permanence EX (Guts)',
        type: 'guts',
        value: 4000,
        remainingTurns: 99,
        remainingHits: 1,
        isHitCount: true
      });
    }
    if (
      (servId === 'edmond_tank') &&
      passives.some((ps: any) => ps.name?.includes('Veteran of the Slums') || ps.type === 'veteran_of_the_slums')
    ) {
      initialBuffs.push({
        name: 'Veteran of the Slums EX (Guts)',
        type: 'guts',
        value: 3000,
        remainingTurns: 99,
        remainingHits: 1,
        isHitCount: true
      });
    }

    const partState: RaidParticipantState = {
      userId: p.userId,
      username: p.username,
      master: p.master,
      servant: s,
      currentHp,
      maxHp: calculatedMaxHp,
      npGauge: 0,
      critStars: 10,
      skillCooldowns: [0, 0, 0],
      activeBuffs: initialBuffs,
      isDead: false,
      commandSeals: 3,
      totalDamageDealt: 0,
      totalDamageTaken: 0,
      gutsTriggeredThisTurn: false
    };
    refreshParticipantHand(partState);
    return partState;
  });

  const hpMultiplier = participants.length === 1 ? 1.0 : participants.length === 2 ? 1.25 : participants.length === 3 ? 1.5 : 1.75;
  const isTiamat = boss.id === 'tiamat';
  const initialBaseHp = isTiamat && boss.phases ? boss.phases[0].baseHp : boss.baseHp;
  const scaledBossHp = Math.round(initialBaseHp * hpMultiplier);

  const battleState: RaidBattleState = {
    boss,
    bossCurrentHp: scaledBossHp,
    bossMaxHp: scaledBossHp,
    bossCharge: 0,
    round: 1,
    participants,
    activeMasterIndex: 0,
    recentLogs: [`⚡ **BATTLE COMMENCED!** ${boss.name} awakens!`],
    bossBuffs: [],
    fullCombatLog: [`⚡ **[Round 1]** Raid battle commenced against **${boss.name}**!`],
    currentPhase: isTiamat ? 1 : undefined,
    totalPhases: isTiamat ? (boss.totalPhases || 3) : undefined,
    breakGaugesRemaining: isTiamat ? ((boss.totalPhases || 3) - 1) : undefined,
    phaseTurn: 1,
    phaseUltsUsed: 0,
    turnDamageTaken: 0,
    chaosSporesActive: false,
    bossShield: 0
  };

  let pendingCards: ('Buster' | 'Arts' | 'Quick' | 'NP')[] = [];
  let pendingIndices: number[] = [];
  let currentActiveParticipant = battleState.participants[battleState.activeMasterIndex];
  let isProcessingTurn = false;

  // Active Noble Phantasm GIF message reference & auto-delete timer
  let activeNpGifMessage: any = null;
  let activeNpGifTimeout: any = null;

  const cleanupNpGif = async () => {
    if (activeNpGifTimeout) {
      clearTimeout(activeNpGifTimeout);
      activeNpGifTimeout = null;
    }
    if (activeNpGifMessage) {
      const msgToDelete = activeNpGifMessage;
      activeNpGifMessage = null;
      try {
        await msgToDelete.delete();
      } catch {
        // Ignored if already deleted
      }
    }
  };

  const dispatchRaidNpGif = async (servant: any, userId: string) => {
    await cleanupNpGif();
    const npGif = getNoblePhantasmGif(servant);
    const chant = getNoblePhantasmChant(servant);
    const npName = servant.template?.noblePhantasm?.name || 'Noble Phantasm';
    const sName = servant.nickname || servant.template?.name || 'Heroic Spirit';

    const npFiles: AttachmentBuilder[] = [];
    const npEmbed = new EmbedBuilder()
      .setTitle(`💥 NOBLE PHANTASM UNLEASHED: ${npName.toUpperCase()}`)
      .setDescription(`⚔️ **${sName}** (Master: <@${userId}>)\n> *“${chant || 'True Name Unleashed!'}”*`)
      .setColor(0xe11d48)
      .setFooter({ text: 'Fate/Grand Order PvE Raid • Noble Phantasm Unleashed' });

    if (npGif) {
      safeSetEmbedImage(npEmbed, normalizeMediaUrl(npGif), npFiles);
    }

    try {
      activeNpGifMessage = await battleMsg.channel.send({ embeds: [npEmbed], files: npFiles });
      activeNpGifTimeout = setTimeout(() => {
        cleanupNpGif().catch(() => {});
      }, 15_000);
    } catch (err) {
      console.warn('Could not post Raid NP GIF:', err);
    }
  };

  const dispatchBossNpGif = async () => {
    await cleanupNpGif();
    const isTiamat = boss.id === 'tiamat';
    const isPhase3 = battleState.currentPhase === 3;
    const npName = isTiamat ? (isPhase3 ? 'PRIMORDIAL ROAR' : 'PRIMORDIAL MURMUR') : boss.chargeAttack.name.toUpperCase();
    const chant = isTiamat
      ? (isPhase3
        ? '“...AAAAAA—! (The primordial cry of genesis that birthed and swallowed the gods!)”'
        : '“...Aaaaa... (The sorrowful murmur of the abandoned mother echoes through the dark sea...)”')
      : '“O Solomon, look upon our despair! From the cradle of incinerated time, we offer your demise!”';
    const desc = isTiamat
      ? (isPhase3
        ? 'Beast II spreads her titanic draconic wings, releasing a deafening roar of absolute annihilation that ignores all evasion and invulnerability!'
        : 'Tiamat weeps as waves of primordial black mud crash over the entire party!')
      : 'Barbatos opens all 72 crimson eyes of the Solomon Spire, unleashing an apocalyptic wave of cursed demon god mana across the entire battlefield!';

    const bossImage = boss.phases && battleState.currentPhase
      ? boss.phases[battleState.currentPhase - 1]?.spriteUrl || boss.avatarUrl
      : boss.avatarUrl;

    const bossEmbed = new EmbedBuilder()
      .setTitle(`🔥 APOCALYPTIC NOBLE PHANTASM: ${npName}`)
      .setDescription(
        `👑 **${boss.name}** (${boss.title})\n` +
        `> *${chant}*\n\n` +
        `${desc}`
      )
      .setColor(isTiamat ? 0xd946ef : 0x7c3aed)
      .setImage(bossImage)
      .setFooter({ text: `${boss.name} Raid • Cataclysmic Charge Attack` });

    try {
      activeNpGifMessage = await battleMsg.channel.send({ embeds: [bossEmbed] });
      activeNpGifTimeout = setTimeout(() => {
        cleanupNpGif().catch(() => {});
      }, 15_000);
    } catch (err) {
      console.warn('Could not post Boss NP embed:', err);
    }
  };

  const buildBattleButtons = (allDisabled = false) => {
    const active = currentActiveParticipant;
    const shouldDisableAll = allDisabled;
    if (!active.currentHand || active.currentHand.length === 0) {
      refreshParticipantHand(active);
    }

    // Row 1: 5 Dealt Command Cards from Servant Class Deck (Exact layout from normal battles)
    const row1 = new ActionRowBuilder<ButtonBuilder>();
    const isQuickFirst = pendingCards[0] === 'Quick';
    const hand = (active.currentHand && active.currentHand.length >= 5 ? active.currentHand : refreshParticipantHand(active)).slice(0, 5);

    hand.forEach((cardType, idx) => {
      const isUsed = pendingIndices.includes(idx);
      const orderIndex = pendingIndices.indexOf(idx);
      const isFirstCard = pendingIndices[0] === idx;

      let baseMult = cardType === 'Buster' ? 2.0 : cardType === 'Arts' ? 1.8 : 2.2;
      let critPct = Math.round((active.critStars || 0) * baseMult);
      if (isQuickFirst && !isFirstCard) {
        critPct += 20;
      }
      critPct = Math.min(100, Math.max(0, critPct));

      let emoji = '🔴';
      let style = ButtonStyle.Danger;
      if (cardType === 'Arts') {
        emoji = '🔵';
        style = ButtonStyle.Primary;
      } else if (cardType === 'Quick') {
        emoji = '🟢';
        style = ButtonStyle.Success;
      }

      if (isUsed) {
        row1.addComponents(
          new ButtonBuilder()
            .setCustomId(`raid_card_hand_${idx}`)
            .setLabel(`#${orderIndex + 1}: ${cardType} (${critPct}%)`)
            .setEmoji('✔️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );
      } else {
        row1.addComponents(
          new ButtonBuilder()
            .setCustomId(`raid_card_hand_${idx}`)
            .setLabel(`${cardType} (${critPct}%)`)
            .setEmoji(emoji)
            .setStyle(style)
            .setDisabled(shouldDisableAll || pendingCards.length >= 3 || active.isDead)
        );
      }
    });

    // Row 2: Noble Phantasm + Clear + Command Seal + Combat Log + Status
    const isNpReady = active.npGauge >= 100;
    const isNpSelected = pendingCards.includes('NP');
    const npType = active.servant.template?.noblePhantasm?.cardType || 'Buster';
    const hasPending = pendingCards.length > 0;
    const masterSeals = active.commandSeals !== undefined ? active.commandSeals : 3;

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('raid_card_np')
        .setLabel(isNpReady ? `NP [${npType}] (${Math.round(active.npGauge)}%)` : `NP (${Math.round(active.npGauge)}%)`)
        .setEmoji(isNpReady ? '💥' : (npType === 'Buster' ? '🔴' : npType === 'Arts' ? '🔵' : '🟢'))
        .setStyle(isNpReady ? ButtonStyle.Danger : ButtonStyle.Secondary)
        .setDisabled(shouldDisableAll || !isNpReady || isNpSelected || pendingCards.length >= 3 || active.isDead),
      new ButtonBuilder()
        .setCustomId('raid_reset_cards')
        .setLabel('Clear')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(shouldDisableAll || !hasPending),
      new ButtonBuilder()
        .setCustomId('raid_command_seal')
        .setLabel(`Seal (${masterSeals})`)
        .setEmoji('🔱')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(shouldDisableAll || masterSeals <= 0 || active.isDead),
      new ButtonBuilder()
        .setCustomId('raid_combat_log')
        .setLabel('Combat Log')
        .setEmoji('📜')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(shouldDisableAll),
      new ButtonBuilder()
        .setCustomId('raid_status')
        .setLabel('Status')
        .setEmoji('📊')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(shouldDisableAll)
    );

    // Row 3: 3 Active Skills + Run
    const row3 = new ActionRowBuilder<ButtonBuilder>();
    const skills = active.servant.template?.skills || [];
    const bondLevel = active.servant.bondLevel || 1;

    // Skill 1
    const s1 = skills[0];
    const cd1 = active.skillCooldowns[0] || 0;
    const s1Name = s1 ? s1.name.slice(0, 13) : 'Skill 1';
    row3.addComponents(
      new ButtonBuilder()
        .setCustomId('raid_skill_0')
        .setLabel(cd1 > 0 ? `S1: ${s1Name} (${cd1}T)` : `✨ S1: ${s1Name}`)
        .setStyle(cd1 > 0 ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(shouldDisableAll || cd1 > 0 || !s1 || active.isDead)
    );

    // Skill 2
    const s2 = skills[1];
    const cd2 = active.skillCooldowns[1] || 0;
    const s2Name = s2 ? s2.name.slice(0, 13) : 'Skill 2';
    row3.addComponents(
      new ButtonBuilder()
        .setCustomId('raid_skill_1')
        .setLabel(cd2 > 0 ? `S2: ${s2Name} (${cd2}T)` : `🛡️ S2: ${s2Name}`)
        .setStyle(cd2 > 0 ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(shouldDisableAll || cd2 > 0 || !s2 || active.isDead)
    );

    // Skill 3 (Unlocked at Bond Level 5)
    const s3 = skills[2];
    const cd3 = active.skillCooldowns[2] || 0;
    const isS3Unlocked = bondLevel >= 5;
    const s3Name = s3 ? s3.name.slice(0, 13) : 'Skill 3';
    row3.addComponents(
      new ButtonBuilder()
        .setCustomId('raid_skill_2')
        .setLabel(!isS3Unlocked ? '🔒 S3 (Bond Lv 5)' : cd3 > 0 ? `S3: ${s3Name} (${cd3}T)` : `🌟 S3: ${s3Name}`)
        .setStyle(!isS3Unlocked || cd3 > 0 ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(shouldDisableAll || !isS3Unlocked || cd3 > 0 || !s3 || active.isDead),
      new ButtonBuilder()
        .setCustomId('raid_flee')
        .setLabel('Run')
        .setEmoji('🏃')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(shouldDisableAll)
    );

    return [row1, row2, row3];
  };

  const buildTurnContent = (active: RaidParticipantState, selectedCards: string[] = pendingCards) => {
    const cardEmojiMap: Record<string, string> = {
      Buster: '🔴 Buster',
      Arts: '🔵 Arts',
      Quick: '🟢 Quick',
      NP: '💥 NP'
    };
    const activeServName = active.servant.nickname || active.servant.template?.name || 'Servant';

    let cardChainStr = '';
    if (selectedCards.length > 0) {
      const chain = selectedCards.map((c, idx) => `\`[ #${idx + 1}: ${cardEmojiMap[c] || c} ]\``).join(' ➔ ');
      cardChainStr = ` • 🎴 **Selected:** ${chain}`;
    }

    return `⚔️ **<@${active.userId}>'s Turn!** (**${activeServName}**)${cardChainStr}`;
  };

  const renderAndPostTurn = async () => {
    const { buffer } = await renderRaidBattlefield(battleState, false);
    const attachment = new AttachmentBuilder(buffer, { name: 'raid_battlefield.png' });
    const components = buildBattleButtons();
    const active = currentActiveParticipant;

    const channelToSend = interaction.channel || battleMsg?.channel;
    let newBattleMsg: any = null;
    if (channelToSend && typeof channelToSend.send === 'function') {
      try {
        newBattleMsg = await channelToSend.send({
          content: buildTurnContent(active, pendingCards),
          embeds: [],
          files: [attachment],
          components
        });
      } catch (sendErr: any) {
        console.warn('[raid] channel.send fresh turn failed, falling back to followUp/edit:', sendErr?.message || sendErr);
      }
    }

    if (!newBattleMsg && interaction && typeof interaction.followUp === 'function') {
      try {
        newBattleMsg = await interaction.followUp({
          content: buildTurnContent(active, pendingCards),
          embeds: [],
          files: [attachment],
          components
        });
      } catch (followErr) {
        console.warn('[raid] interaction.followUp fallback failed:', followErr);
      }
    }

    if (newBattleMsg) {
      if (newBattleMsg.id) {
        raidMessageIds.add(newBattleMsg.id);
      }
      const prevMsg = battleMsg;
      battleMsg = newBattleMsg;
      if (prevMsg && typeof prevMsg.delete === 'function') {
        await prevMsg.delete().catch(() => {});
      }
      if (interaction && typeof interaction.deleteReply === 'function') {
        await interaction.deleteReply().catch(() => {});
      }
    } else if (battleMsg && typeof battleMsg.edit === 'function') {
      await battleMsg.edit({
        content: buildTurnContent(active, pendingCards),
        embeds: [],
        files: [attachment],
        components
      }).catch(() => {});
    }
  };

  await renderAndPostTurn();

  const collector = battleMsg.channel.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (b: any) => isInteractionForThisRaid(b) && b.customId.startsWith('raid_'),
    idle: 180_000,
    time: 1_800_000
  });

  collector.on('collect', async (i: any) => {
    if (!isInteractionForThisRaid(i)) return;
    if (isProcessingTurn && i.customId !== 'raid_status' && i.customId !== 'raid_combat_log') {
      try {
        if (!i.replied && !i.deferred) {
          await i.deferUpdate().catch(() => {});
        }
      } catch {}
      return;
    }

    const safeUpdate = async (options: any) => {
      try {
        if (!i.deferred && !i.replied) {
          await i.deferUpdate().catch(() => {});
        }
        await i.editReply(options);
      } catch (err: any) {
        try {
          if (battleMsg && typeof battleMsg.edit === 'function') {
            await battleMsg.edit(options);
          }
        } catch (fallbackErr) {
          console.warn('[raid] safeUpdate fallback warning:', fallbackErr);
        }
      }
    };

    try {
      // 0. Status Inspection Dossier (Accessible by any Master at any time)
    if (i.customId === 'raid_status') {
      try {
        const statusEmbed = buildRaidStatusEmbed(battleState, i.user.id);
        await i.reply({
          embeds: [statusEmbed],
          flags: MessageFlags.Ephemeral
        });
      } catch (statusErr: any) {
        console.error('[raid] Error generating raid status embed:', statusErr);
        await i.reply({
          content: '⚠️ Unable to format full tactical dossier. Please try again.',
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      }
      return;
    }

    // 0.1 Combat Log Inspection (Accessible by any Master at any time)
    if (i.customId === 'raid_combat_log') {
      const fullLines = (battleState.fullCombatLog && battleState.fullCombatLog.length > 0)
        ? battleState.fullCombatLog
        : (battleState.recentLogs && battleState.recentLogs.length > 0)
          ? battleState.recentLogs
          : ['Battle commenced. No actions logged yet.'];

      const logChunks: string[] = [];
      let cur = '';
      for (const line of fullLines) {
        if ((cur + '\n' + line).length > 3800) {
          logChunks.push(cur);
          cur = line;
        } else {
          cur = cur ? cur + '\n' + line : line;
        }
      }
      if (cur) logChunks.push(cur);

      const isTiamat = battleState.boss.id === 'tiamat';
      const logEmbed = new EmbedBuilder()
        .setTitle(`📜 Complete Combat Log • Round ${battleState.round} • ${battleState.boss.name}`)
        .setDescription(logChunks[logChunks.length - 1] || 'No events recorded yet.')
        .setColor(isTiamat ? 0xd946ef : 0x8b5cf6)
        .setFooter({ text: `Total Battle Events: ${fullLines.length} • Fate/Grand Order PvE Raid` });

      await i.reply({
        embeds: [logEmbed],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const active = currentActiveParticipant;

    if (i.user.id !== active.userId && i.customId !== 'raid_flee') {
      await i.reply({
        content: `❌ It is currently <@${active.userId}>'s turn to command their Servant!`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (i.customId.startsWith('raid_card_hand_')) {
      const handIdx = parseInt(i.customId.replace('raid_card_hand_', ''), 10);
      if (!pendingIndices.includes(handIdx) && pendingCards.length < 3 && handIdx >= 0 && handIdx < 5) {
        pendingIndices.push(handIdx);
        pendingCards.push(active.currentHand?.[handIdx] || 'Buster');
      }
    } else if (i.customId === 'raid_card_np') {
      if (!pendingCards.includes('NP') && pendingCards.length < 3 && active.npGauge >= 100) {
        pendingCards.push('NP');
      }
    } else if (i.customId === 'raid_reset_cards') {
      pendingCards = [];
      pendingIndices = [];
      await safeUpdate({
        content: buildTurnContent(active, pendingCards),
        embeds: [],
        components: buildBattleButtons()
      });
      return;
    } else if (i.customId === 'raid_cancel_target_skill') {
      await i.reply({ content: '↩️ Skill targeting cancelled.', flags: MessageFlags.Ephemeral }).catch(() => {});
      return;
    } else if (i.customId.startsWith('raid_skill_') || i.customId.startsWith('raid_target_skill_')) {
      let sIdx: number;
      let targetUserId: string | null = null;

      if (i.customId.startsWith('raid_target_skill_')) {
        const parts = i.customId.replace('raid_target_skill_', '').split('_');
        sIdx = parseInt(parts[0], 10);
        targetUserId = parts[1] || null;
      } else {
        sIdx = parseInt(i.customId.replace('raid_skill_', ''), 10);
      }

      if (active.skillCooldowns[sIdx] === 0) {
        const skillObj = active.servant.template?.skills?.[sIdx];
        const sName = skillObj?.name || `Skill ${sIdx + 1}`;
        const sDesc = skillObj?.description || '';
        const sType = skillObj?.effectType || '';

        // Check if this skill targets a single ally
        const isSingleAllyTargetable =
          /avalon le fae|holy sword creation|hero creation|discerning eye|end of the dream|target ally|one ally|an ally|single ally/i.test(sName + ' ' + sDesc) ||
          (skillObj as any)?.target === 'single_ally' ||
          (skillObj as any)?.target === 'ally';

        const livingParticipants = battleState.participants.filter(p => !p.isDead);

        // If skill targets a single ally and party has multiple living participants, and target is not selected yet
        if (isSingleAllyTargetable && livingParticipants.length > 1 && !targetUserId) {
          const targetRow = new ActionRowBuilder<ButtonBuilder>();
          livingParticipants.forEach(p => {
            const pName = p.servant.nickname || p.servant.template?.name || 'Servant';
            const isSelf = p.userId === active.userId;
            targetRow.addComponents(
              new ButtonBuilder()
                .setCustomId(`raid_target_skill_${sIdx}_${p.userId}`)
                .setLabel(`🎯 ${pName}${isSelf ? ' (Self)' : ` (@${p.username})`}`.slice(0, 80))
                .setStyle(isSelf ? ButtonStyle.Secondary : ButtonStyle.Primary)
            );
          });
          targetRow.addComponents(
            new ButtonBuilder()
              .setCustomId('raid_cancel_target_skill')
              .setLabel('↩️ Cancel')
              .setStyle(ButtonStyle.Danger)
          );

          await i.reply({
            content: `✨ **Select an Ally Target for [${sName}]**:\n*${sDesc}*`,
            components: [targetRow],
            flags: MessageFlags.Ephemeral
          }).catch(() => {});
          return;
        }

        const targetAlly = targetUserId
          ? (battleState.participants.find(p => p.userId === targetUserId) || active)
          : active;

        if (targetUserId && i.isButton()) {
          const tName = targetAlly.servant.nickname || targetAlly.servant.template?.name || 'Ally';
          await i.reply({
            content: `🎯 Targeted **${tName}** with **[${sName}]**!`,
            flags: MessageFlags.Ephemeral
          }).catch(() => {});
        }

        isProcessingTurn = true;
        try {
          const cd = skillObj?.cooldown || 5;
          active.skillCooldowns[sIdx] = cd;
          active.activeBuffs = active.activeBuffs || [];
          targetAlly.activeBuffs = targetAlly.activeBuffs || [];
          battleState.bossBuffs = battleState.bossBuffs || [];

          // Check for Calamity-Breaker Edict EX / Anti-Threat to Humanity skills
          const isAntiThreatSkill = /Threat to Humanity|Foreigner|Beast|Otherworlder|Calamity-Breaker/i.test(sName + ' ' + sDesc);
          // Check for Guts / Battle Continuation
          const isGuts = sType === 'guts' || /guts|battle continuation|indomitable will|setting sun/i.test(sName + ' ' + sDesc);
          // Check for Evade / Invincibility
          const isEvade = /Evade|Invincible|Dodge/i.test(sName + ' ' + sDesc) || sType === 'evade';
          // Check for Damage Cut / Defense
          const isDefOrCut = /Damage Cut|Shield|Protection/i.test(sName + ' ' + sDesc) || sType === 'buff_def';
          // Check for Healing / Regeneration
          const isHeal = /Heal|Recover|Regenerat/i.test(sName + ' ' + sDesc) || sType === 'heal';

          // Check for DEBUFFS targeting Barbatos
          const isDefDown = (sType as string) === 'debuff_def' || /def.*down|lower.*def|reduce.*def|decrease.*def|defense down/i.test(sName + ' ' + sDesc);
          const isAtkDown = (sType as string) === 'debuff_atk' || /atk.*down|attack.*down|lower.*atk|reduce.*atk|reduce.*attack/i.test(sName + ' ' + sDesc);
          const isStun = sType === 'stun' || /stun|paralyze|charm|freeze|petrif/i.test(sName + ' ' + sDesc);
          const isNpDrainOrSeal = /np.*drain|charge.*drain|drain.*charge|seal.*np|np.*seal/i.test(sName + ' ' + sDesc);
          const isDot = /curse|poison|burn/i.test(sName + ' ' + sDesc);
          const isGeneralDebuff = sType === 'debuff';

          let buffLog = '';
          if (skillObj?.id === 'blaze_of_etna' || /blaze of etna|armor of ashen/i.test(sName)) {
            // S1: Blaze of Etna - Dragon Prison Manifestation: Armor of Ashen Flames C
            // Grants self Invincibility for 2 attacks (3 turns). Increases own attack by 20% for 3 turns. Increases own Buster performance by 30% for 3 turns.
            active.activeBuffs = active.activeBuffs || [];
            active.activeBuffs.push({
              name: 'Blaze of Etna (Invincible)',
              type: 'invincible',
              value: 100,
              remainingTurns: 3,
              remainingHits: 2,
              isHitCount: true
            } as any);
            active.activeBuffs.push({
              name: 'Blaze of Etna (ATK Up)',
              type: 'atk_up',
              value: 20,
              remainingTurns: 3
            });
            active.activeBuffs.push({
              name: 'Blaze of Etna (Buster Up)',
              type: 'buster_up',
              value: 30,
              remainingTurns: 3
            });
            buffLog = `(🛡️ Invincibility for 2 Attacks [3T], ⚔️ +20% ATK [3T], 🔥 +30% Buster Performance [3T])`;
          } else if (skillObj?.id === 'black_wings_a' || /black wings/i.test(sName)) {
            // S2: Black Wings A
            // Overcharges one ally's NP by 2 stages for 1 time (3 turns). Reduces their skill cooldown by 1. Increases their critical damage by 30% for 3 turns. Gains 15 critical stars.
            targetAlly.activeBuffs = targetAlly.activeBuffs || [];
            targetAlly.activeBuffs.push({
              name: 'Black Wings (Overcharge +2)',
              type: 'overcharge_up',
              value: 2,
              remainingTurns: 3,
              remainingHits: 1,
              isHitCount: true
            } as any);
            targetAlly.skillCooldowns = targetAlly.skillCooldowns.map((cd, idx) =>
              (targetAlly.userId === active.userId && idx === sIdx) ? cd : Math.max(0, cd - 1)
            );
            targetAlly.activeBuffs.push({
              name: 'Black Wings (Crit DMG Up)',
              type: 'crit_dmg',
              value: 30,
              remainingTurns: 3
            });
            active.critStars = (active.critStars || 0) + 15;
            const tName = targetAlly.servant.nickname || targetAlly.servant.template?.name || 'Ally';
            buffLog = `(🪶 Overcharged **${tName}**'s NP by +2 Stages [1x/3T], ⏳ Skill Cooldowns -1T, 💥 +30% Crit DMG [3T], ★ +15 Stars)`;
          } else if (skillObj?.id === 'let_this_become_a_prayer_ex' || /let this become a prayer/i.test(sName)) {
            // S3: Let This Become a Prayer EX
            // Charges own NP gauge by 30% and party's NP gauge by 20% (Total self +50% NP). Increases party's attack by 20% for 3 turns. 500% chance to inflict Curse with 500 damage for 3 turns to them [Demerit].
            battleState.participants.forEach(p => {
              if (!p.isDead) {
                p.npGauge = Math.min(300, (p.npGauge || 0) + 20);
                p.activeBuffs = p.activeBuffs || [];
                p.activeBuffs.push({
                  name: 'Let This Become a Prayer (ATK Up)',
                  type: 'atk_up',
                  value: 20,
                  remainingTurns: 3
                });
                p.activeBuffs.push({
                  name: 'Ephemeral Curse [Demerit]',
                  type: 'curse',
                  value: 500,
                  remainingTurns: 3
                });
              }
            });
            active.npGauge = Math.min(300, (active.npGauge || 0) + 30);
            buffLog = `(🍷 +50% NP Gauge to Self, +20% NP Gauge & +20% ATK to Party for 3T, 🩸 Inflicted Curse [500 DMG/3T] Demerit)`;
          } else if (/charisma of hope/i.test(sName)) {
            // Charisma of Hope B: Increases party's ATK by 20% for 3 turns, charges party's NP gauge by 30%
            battleState.participants.forEach(p => {
              if (!p.isDead) {
                p.activeBuffs = p.activeBuffs || [];
                p.activeBuffs.push({
                  name: `${sName} (ATK Up)`,
                  type: 'atk_up',
                  value: 20,
                  remainingTurns: 3
                });
                p.npGauge = Math.min(300, (p.npGauge || 0) + 30);
              }
            });
            active.critStars = (active.critStars || 0) + 10;
            buffLog = `(+20% ATK & +30% NP Gauge to ALL Allies for 3T!)`;
          } else if (/avalon le fae/i.test(sName)) {
            // Avalon le Fae A: Charges target ally's NP gauge by 20% & increases party's NP generation rate by 30% for 3 turns
            targetAlly.npGauge = Math.min(300, (targetAlly.npGauge || 0) + 20);
            battleState.participants.forEach(p => {
              if (!p.isDead) {
                p.activeBuffs = p.activeBuffs || [];
                p.activeBuffs.push({
                  name: `${sName} (NP Gain Rate Up)`,
                  type: 'np_gain_up',
                  value: 30,
                  remainingTurns: 3
                });
              }
            });
            const tName = targetAlly.servant.nickname || targetAlly.servant.template?.name || 'Ally';
            buffLog = `(+20% NP Gauge to **${tName}** & +30% Party NP Gain Rate for 3T!)`;
          } else if (/holy sword creation/i.test(sName)) {
            // Holy Sword Creation EX: +50% Arts Up (3T), +50% Special ATK vs Threat to Humanity (3T), Invincibility (1T) to target ally
            targetAlly.activeBuffs = targetAlly.activeBuffs || [];
            targetAlly.activeBuffs.push({
              name: `${sName} (Arts Up)`,
              type: 'arts_up',
              value: 50,
              remainingTurns: 3
            });
            targetAlly.activeBuffs.push({
              name: `${sName} (Anti-Threat)`,
              type: 'anti_threat',
              value: 50,
              remainingTurns: 3
            });
            targetAlly.activeBuffs.push({
              name: `${sName} (Invincibility)`,
              type: 'invincible',
              value: 1,
              remainingTurns: 1
            });
            const tName = targetAlly.servant.nickname || targetAlly.servant.template?.name || 'Ally';
            buffLog = `(+50% Arts Up, +50% Anti-Threat Special ATK & 1T Invincibility to **${tName}**!)`;
          } else if (/guardian's instinct|guardians_instinct|red scarf/i.test(sName + ' ' + sDesc)) {
            // Guardian's Instinct (Red Scarf) B+: Increases ATK of ALL allies by +15% (3T) & grants all allies Invincibility (1T), +20% NP Gauge to self
            battleState.participants.forEach(p => {
              if (!p.isDead) {
                p.activeBuffs = p.activeBuffs || [];
                p.activeBuffs.push({
                  name: "Guardian's Instinct (ATK Up)",
                  type: 'atk_up',
                  value: 15,
                  remainingTurns: 3
                });
                p.activeBuffs.push({
                  name: 'Red Scarf Aegis (Invincibility)',
                  type: 'invincible',
                  value: 1,
                  remainingTurns: 1
                });
              }
            });
            active.npGauge = Math.min(300, (active.npGauge || 0) + 20);
            buffLog = `(+15% ATK & 1T Invincibility to ALL Allies, +20% NP Gauge to self!)`;
          } else if (/kekkai creation|kekkai_creation|shrine boundary/i.test(sName + ' ' + sDesc) || skillObj?.id === 'kekkai_creation') {
            // Kekkai Creation A: Grants Invincibility for 1 turn, increases Defense by 30% for 3 turns, and cleanses all debuffs
            targetAlly.activeBuffs = targetAlly.activeBuffs || [];
            targetAlly.activeBuffs.push({
              name: `${sName} (Invincibility)`,
              type: 'invincible',
              value: 1,
              remainingTurns: 1
            });
            targetAlly.activeBuffs.push({
              name: `${sName} (DEF Up)`,
              type: 'def_up',
              value: 30,
              remainingTurns: 3
            });
            targetAlly.activeBuffs = targetAlly.activeBuffs.filter(b => !/curse|burn|poison|debuff|down|stun|seal/i.test(b.type));
            active.critStars = (active.critStars || 0) + 10;
            const tName = targetAlly.servant.nickname || targetAlly.servant.template?.name || 'Self';
            buffLog = `(⛩️ Invincibility for 1T, +30% DEF for 3T & Cleansed All Debuffs on **${tName}**!)`;
          } else if (isAntiThreatSkill) {
          // Calamity-Breaker Edict: Increases ATK of ALL allies by +20%, and grants all allies [Special Attack against Threat to Humanity / Beast] (+30% DMG) for 3 turns!
          battleState.participants.forEach(p => {
            p.activeBuffs = p.activeBuffs || [];
            p.activeBuffs.push({
              name: 'Calamity-Breaker ATK',
              type: 'atk_up',
              value: 20,
              remainingTurns: 3
            });
            p.activeBuffs.push({
              name: 'Anti-Threat to Humanity',
              type: 'anti_threat',
              value: 30,
              remainingTurns: 3
            });
          });
          active.critStars = (active.critStars || 0) + 15;
          buffLog = `(+20% ATK & +30% Special ATK vs [Threat to Humanity] to ALL allies for 3T, +15 Stars)`;
        } else if (isGuts) {
          const reviveVal = skillObj?.value || (/4,000/i.test(sDesc) ? 4000 : /3,000/i.test(sDesc) ? 3000 : /2,500/i.test(sDesc) ? 2500 : 2000);
          active.activeBuffs = active.activeBuffs || [];
          active.activeBuffs.push({
            name: `${sName} (Guts)`,
            type: 'guts',
            value: reviveVal,
            remainingTurns: skillObj?.duration || 5,
            remainingHits: 1,
            isHitCount: true
          } as any);
          if (/invincible/i.test(sDesc)) {
            active.activeBuffs.push({
              name: `${sName} (Invincibility)`,
              type: 'invincible',
              value: 1,
              remainingTurns: 1
            });
          }
          if (/100% Defense|100% DEF/i.test(sDesc)) {
            active.activeBuffs.push({
              name: `${sName} (DEF Up)`,
              type: 'def_up',
              value: 100,
              remainingTurns: 1
            });
          }
          if (/buster/i.test(sDesc)) {
            active.activeBuffs.push({
              name: `${sName} (Buster Up)`,
              type: 'atk_up',
              value: 20,
              remainingTurns: 3
            });
          }
          if (/on-guts|on guts/i.test(sDesc)) {
            active.activeBuffs.push({
              name: `${sName} (On-Guts Buster)`,
              type: 'on_guts_buster',
              value: 20,
              remainingTurns: 5
            });
          }
          active.critStars = (active.critStars || 0) + 10;
          buffLog = `(🩸 Granted **Guts** [Revive with ${reviveVal.toLocaleString()} HP] for ${skillObj?.duration || 5}T!)`;
        } else if (isDefDown) {
          battleState.bossBuffs.push({
            name: `${sName} (DEF Down)`,
            type: 'def_down',
            value: 30,
            remainingTurns: 3
          });
          active.critStars = (active.critStars || 0) + 10;
          active.npGauge = Math.min(300, (active.npGauge || 0) + 10);
          buffLog = `(🔻 Inflicted **-30% DEF Down** on ${boss.name} for 3T, +10% NP, +10 Stars)`;
        } else if (isAtkDown) {
          battleState.bossBuffs.push({
            name: `${sName} (ATK Down)`,
            type: 'atk_down',
            value: 25,
            remainingTurns: 3
          });
          buffLog = `(🔻 Inflicted **-25% ATK Down** on ${boss.name} for 3T)`;
        } else if (isStun) {
          const isImmuneToStun = boss.id === 'tiamat' && (battleState.currentPhase || 1) >= 2;
          if (isImmuneToStun) {
            buffLog = `(🛡️ **[IMMENSE MASS]** ${boss.name} is immune to Stun, mental interference, and instant death!)`;
          } else {
            battleState.bossBuffs.push({
              name: `${sName} (Stun)`,
              type: 'stun',
              value: 100,
              remainingTurns: 1
            });
            buffLog = `(⚡ Inflicted **STUN** on ${boss.name} for 1 turn!)`;
          }
        } else if (isNpDrainOrSeal) {
          battleState.bossCharge = Math.max(0, battleState.bossCharge - 1);
          battleState.bossBuffs.push({
            name: `${sName} (NP Seal)`,
            type: 'np_seal',
            value: 1,
            remainingTurns: 1
          });
          buffLog = `(⚡ Drained **1 Charge Diamond** & sealed ${boss.name}'s NP for 1 turn!)`;
        } else if (isDot) {
          battleState.bossBuffs.push({
            name: `${sName} (Cursed Affliction)`,
            type: 'curse',
            value: 8000,
            remainingTurns: 3
          });
          buffLog = `(🔥 Inflicted **Curse/Burn** on ${boss.name}: **8,000 DMG/Turn** for 3T)`;
        } else if (isGeneralDebuff) {
          battleState.bossBuffs.push({
            name: `${sName} (DEF Down)`,
            type: 'def_down',
            value: 25,
            remainingTurns: 3
          });
          buffLog = `(🔻 Inflicted **-25% DEF Down** on ${boss.name} for 3T)`;
        } else if (isEvade) {
          active.activeBuffs.push({
            name: `${sName} (Evade)`,
            type: 'evade',
            value: 1,
            remainingTurns: 2
          });
          active.critStars = (active.critStars || 0) + 15;
          buffLog = `(🛡️ Granted EVADE for 1 Hit, +15 Stars)`;
        } else if (isDefOrCut) {
          active.activeBuffs.push({
            name: `${sName} (Damage Cut)`,
            type: 'damage_cut',
            value: 1200,
            remainingTurns: 3
          });
          active.activeBuffs.push({
            name: `${sName} (DEF Up)`,
            type: 'def_up',
            value: 25,
            remainingTurns: 3
          });
          buffLog = `(🛡️ +25% DEF & 1,200 Damage Cut for 3T)`;
        } else if (isHeal) {
          const healAmt = 4500;
          active.currentHp = Math.min(active.maxHp, active.currentHp + healAmt);
          active.npGauge = Math.min(300, (active.npGauge || 0) + 20);
          active.activeBuffs = active.activeBuffs.filter(b => b.type !== 'curse' && b.type !== 'burn' && b.type !== 'poison');
          buffLog = `(💚 Restored +${healAmt.toLocaleString()} HP, +20% NP & Cleansed Afflictions)`;

          // Tiamat Phase 1 Passive: Self-Limitation
          if (boss.id === 'tiamat' && (battleState.currentPhase === 1)) {
            battleState.bossCurrentHp = Math.min(battleState.bossMaxHp, battleState.bossCurrentHp + 150_000);
            buffLog += `\n🌊 **[Self-Limitation]** Tiamat recoils from human healing, recovering +150,000 HP!`;
          }
        } else {
          active.activeBuffs.push({
            name: `${sName} Buff`,
            type: 'atk_up',
            value: 30,
            remainingTurns: 3
          });
          active.critStars = (active.critStars || 0) + 15;
          active.npGauge = Math.min(300, (active.npGauge || 0) + 20);
          buffLog = `(+30% ATK, +20% NP, +15 Stars)`;
        }

        const quote = skillObj?.quote || skillObj?.quotes?.[0] || '';
        const quoteText = quote ? `\n> *${quote}*` : '';
        const sServName = active.servant.nickname || active.servant.template?.name || 'Heroic Spirit';
        battleState.recentLogs.push(`✨ **${sServName}** invoked **${sName}**! ${buffLog}${quoteText}`);
        if (battleState.recentLogs.length > 4) battleState.recentLogs.shift();

        // Update single-focus Tactical Action HUD for this skill activation!
        const cleanBuffDetail = buffLog ? buffLog.replace(/[\(\)\*]/g, '').trim() : 'Active Skill Protocols Activated';
        battleState.lastHudAction = {
          category: 'SKILL ACTIVATED',
          categoryColor: '#fbbf24',
          headline: sServName,
          bigStat: sName.toUpperCase(),
          bigStatColor: '#fde047',
          subDetail: cleanBuffDetail,
          subDetailColor: '#38bdf8'
        };

        // Render updated canvas reflecting the new HP, NP, or buffs from the skill!
        const { buffer } = await renderRaidBattlefield(battleState, false);
        const uniqueFileName = 'raid_battlefield.png';
                const attachment = new AttachmentBuilder(buffer, { name: uniqueFileName });

        await safeUpdate({
          content: buildTurnContent(active, pendingCards),
        embeds: [],
          files: [attachment],
          components: buildBattleButtons()
        });
        } finally {
          isProcessingTurn = false;
        }
        return;
      }
    } else if (i.customId === 'raid_command_seal') {
      const availableSeals = active.commandSeals !== undefined ? active.commandSeals : 3;
      if (availableSeals > 0) {
        active.commandSeals = availableSeals - 1;
        active.currentHp = active.maxHp;
        active.npGauge = Math.min(300, Math.max(100, (active.npGauge || 0) + 100));
        const sServName = active.servant.nickname || active.servant.template?.name || 'Servant';
        battleState.recentLogs.push(
          `🔱 <@${active.userId}> expended a **Command Seal** (${active.commandSeals} remaining)! **${sServName}** is fully healed and gained **+100% NP Gauge** (${Math.round(active.npGauge)}% total)!`
        );
        while (battleState.recentLogs.length > 8) battleState.recentLogs.shift();

        // Update single-focus Tactical Action HUD for Command Seal
        battleState.lastHudAction = {
          category: 'COMMAND SEAL',
          categoryColor: '#c084fc',
          headline: `${sServName} Empowered`,
          bigStat: 'FULL RESTORE (100% NP)',
          bigStatColor: '#38bdf8',
          subDetail: `Full HP Healed • +100% NP (${active.commandSeals} Seals Left)`,
          subDetailColor: '#a7f3d0'
        };

        // Render updated canvas reflecting the restored HP and 100% NP!
        const { buffer } = await renderRaidBattlefield(battleState, false);
        const uniqueFileName = 'raid_battlefield.png';
                const attachment = new AttachmentBuilder(buffer, { name: uniqueFileName });

        await safeUpdate({
          content: buildTurnContent(active, pendingCards),
        embeds: [],
          files: [attachment],
          components: buildBattleButtons()
        });
        return;
      }
    } else if (i.customId === 'raid_flee') {
      active.isDead = true;
      battleState.recentLogs.push(`🏃 <@${active.userId}> ordered a tactical withdrawal from the raid.`);
      if (battleState.recentLogs.length > 4) battleState.recentLogs.shift();

      const livingRemaining = battleState.participants.filter(p => !p.isDead);
      if (livingRemaining.length === 0) {
        await cleanupNpGif();
        collector.stop('defeated');
        await safeUpdate({
          content: '💀 **Raid Abandoned:** All Masters retreated from the battlefield.',
        embeds: [],
          components: []
        });
        return;
      }

      pendingCards = [];
      pendingIndices = [];
      advanceToNextPlayer();
      await i.deferUpdate().catch(() => {});
      await renderAndPostTurn();
      return;
    }

    // If fewer than 3 cards selected, update buttons and message in-place with ZERO lag!
    if (pendingCards.length < 3) {
      await safeUpdate({
        content: buildTurnContent(active, pendingCards),
        embeds: [],
        components: buildBattleButtons()
      });
      return;
    }

    // 3 Cards selected -> Immediately update the message so the user sees Card 3 registered and all buttons disabled!
    isProcessingTurn = true;
    try {
      await safeUpdate({
        content: buildTurnContent(active, pendingCards),
        embeds: [],
        components: buildBattleButtons(true)
      });

      const usedNp = pendingCards.includes('NP');
      const initialNpGauge = active.npGauge || 0;
      let ocBonusStages = 0;
      if (usedNp && active.activeBuffs) {
        const ocIdx = active.activeBuffs.findIndex(b => b.type === 'overcharge_up');
        if (ocIdx >= 0) {
          ocBonusStages = active.activeBuffs[ocIdx].value || 2;
          active.activeBuffs.splice(ocIdx, 1);
        }
      }
      const baseOcLevel = initialNpGauge >= 300 ? 3 : initialNpGauge >= 200 ? 2 : 1;
      const overchargeLevel = Math.min(5, baseOcLevel + ocBonusStages);
      const isOvercharged = overchargeLevel >= 2;
      const overchargeScale = isOvercharged ? (1.0 + (overchargeLevel - 1) * 0.20) : 1.00;

      let pendingNpToDispatch: { servant: any; userId: string } | null = null;
      if (usedNp) {
        active.npGauge = 0;
        pendingNpToDispatch = { servant: active.servant, userId: active.userId };
      }

      let totalTurnDmg = 0;
      let starsGenerated = 0;
      let npGained = 0;

      const sAtk = active.servant;
      const tAtk = sAtk.template || {};
      const allocAtk = sAtk.allocatedStats || {};
      const baseStatsAtk = tAtk.baseStats || { strength: 10, endurance: 10, agility: 10, mana: 10, luck: 10 };
      const totalStr = (baseStatsAtk.strength || 10) + (allocAtk.strength || 0);
      const ceAtk = sAtk.equippedCe?.atkBonus || 0;
      const baseAtk = Math.round((tAtk.baseAtk || 10000) + totalStr * 80 + ceAtk);
      const atkBuffMult = 1 + ((active.activeBuffs?.filter(b => b.type === 'atk_up' || b.type === 'buff_atk').reduce((acc, b) => acc + b.value, 0) || 0) / 100);
      const busterBuffMult = 1 + ((active.activeBuffs?.filter(b => b.type === 'buster_up').reduce((acc, b) => acc + b.value, 0) || 0) / 100);
      const artsBuffMult = 1 + ((active.activeBuffs?.filter(b => b.type === 'arts_up').reduce((acc, b) => acc + b.value, 0) || 0) / 100);
      const quickBuffMult = 1 + ((active.activeBuffs?.filter(b => b.type === 'quick_up').reduce((acc, b) => acc + b.value, 0) || 0) / 100);
      const critDmgBuffMult = 1 + ((active.activeBuffs?.filter(b => b.type === 'crit_dmg' || b.type === 'crit_up').reduce((acc, b) => acc + b.value, 0) || 0) / 100);

      const isBossThreat = (boss.traits || []).some(t => ['threat_to_humanity', 'beast', 'demonic'].includes(t.toLowerCase()));
      const antiThreatBuff = (active.activeBuffs?.filter(b => b.type === 'anti_threat').reduce((acc, b) => acc + b.value, 0) || 0) / 100;
      const specialAtkMult = isBossThreat ? (1 + antiThreatBuff) : 1.0;

      const bossDefDown = (battleState.bossBuffs?.filter(b => b.type === 'def_down').reduce((acc, b) => acc + b.value, 0) || 0) / 100;
      const bossDefUp = (battleState.bossBuffs?.filter(b => b.type === 'def_up').reduce((acc, b) => acc + b.value, 0) || 0) / 100;
      const bossDefFactor = Math.max(0.2, 1 + bossDefDown - bossDefUp);

      const starsAvailableForCrits = active.critStars || 0;
      const isQuickFirstLead = pendingCards[0] === 'Quick';
      let totalCritsLanded = 0;
      let npTriggeredAntiThreat = false;
      let npEffectsLog: string[] = [];
      let npEffectsHud: string[] = [];
      let npNameUsed = '';

      pendingCards.forEach((card, cIdx) => {
        const stepMult = cIdx === 0 ? 1.0 : cIdx === 1 ? 1.2 : 1.4;

        // Calculate critical hit rate based on current star pool
        const baseCritMult = card === 'Buster' ? 2.0 : card === 'Arts' ? 1.8 : 2.2;
        let critPct = Math.round(starsAvailableForCrits * baseCritMult);
        if (isQuickFirstLead && cIdx > 0) critPct += 20;
        critPct = Math.min(100, Math.max(0, critPct));

        const isCrit = card !== 'NP' && (Math.random() * 100 < critPct);
        if (isCrit) totalCritsLanded++;

        const totalLuckAtk = (baseStatsAtk.luck || 10) + (allocAtk.luck || 0);
        const luckCritBonus = Math.min(0.35, (totalLuckAtk / (totalLuckAtk + 120)) * 0.35);
        const critDmgMult = isCrit ? (2.0 + luckCritBonus) : 1.0;
        const critNpBonus = isCrit ? 1.5 : 1.0;
        const critStarBonus = isCrit ? 1.4 : 1.0;

        const isNormalCard = card !== 'NP';
        const negaGenesisMult = (boss.id === 'tiamat' && battleState.currentPhase === 3 && isNormalCard) ? 0.5 : 1.0;

        if (card === 'Buster') {
          totalTurnDmg += Math.round(baseAtk * 1.5 * stepMult * atkBuffMult * specialAtkMult * bossDefFactor * critDmgMult * negaGenesisMult * (0.9 + Math.random() * 0.2));
          starsGenerated += Math.round(3 * critStarBonus);
          npGained += Math.round(5 * critNpBonus);
        } else if (card === 'Arts') {
          totalTurnDmg += Math.round(baseAtk * 1.0 * stepMult * atkBuffMult * specialAtkMult * bossDefFactor * critDmgMult * negaGenesisMult * (0.9 + Math.random() * 0.2));
          const totalAtkMana = (baseStatsAtk.mana || 10) + (allocAtk.mana || 0);
          const manaNpBonus = Math.min(0.35, (totalAtkMana / (totalAtkMana + 120)) * 0.35);
          npGained += Math.round(25 * critNpBonus * (1.0 + manaNpBonus));
          starsGenerated += Math.round(2 * critStarBonus);
        } else if (card === 'Quick') {
          totalTurnDmg += Math.round(baseAtk * 0.8 * stepMult * atkBuffMult * specialAtkMult * bossDefFactor * critDmgMult * negaGenesisMult * (0.9 + Math.random() * 0.2));
          starsGenerated += Math.round(12 * critStarBonus);
          npGained += Math.round(10 * critNpBonus);
        } else if (card === 'NP') {
          const rawNpMult = active.servant.template?.noblePhantasm?.multiplier ?? 600;
          const npMultiplier = rawNpMult >= 20 ? rawNpMult / 100 : (rawNpMult || 6.0);
          const npBaseDesc = (active.servant.template?.noblePhantasm?.description || '').trim();
          const npOverchargeDesc = (active.servant.template?.noblePhantasm?.overchargeEffect || '').trim();
          const npName = active.servant.template?.noblePhantasm?.name || 'Noble Phantasm';
          const npTarget = active.servant.template?.noblePhantasm?.target || 'single';
          npNameUsed = npName;

          const isSupportNp = npTarget === 'support' || npMultiplier === 0 || /party invincib|grant.*invincib|luminos|tigris redoubt|round of avalon/i.test(npName + ' ' + npBaseDesc);

          if (isSupportNp) {
            const isRoundOfAvalon = /round of avalon/i.test(npName);
            const isTigris = /tigris|edmond/i.test(npName);
            const isLuminosite = /luminosit|jeanne/i.test(npName);

            // Party Buffs & Protection to ALL living allies in the raid!
            battleState.participants.forEach(p => {
              if (!p.isDead) {
                p.activeBuffs = p.activeBuffs || [];
                // Cleanse debuffs
                p.activeBuffs = p.activeBuffs.filter(b => !['def_down', 'atk_down', 'curse', 'burn', 'poison', 'stun', 'np_seal', 'skill_seal'].includes(b.type));

                // Grant Invincibility for 1 Turn (Anti-Purge Defense for Round of Avalon)
                p.activeBuffs.push({
                  name: isRoundOfAvalon ? `${npName} (Anti-Purge Defense)` : `${npName} (Invincibility)`,
                  type: isRoundOfAvalon ? 'anti_purge_defense' : 'invincible',
                  value: 1,
                  remainingTurns: 1
                });

                if (isRoundOfAvalon) {
                  // Round of Avalon: +50% ATK for 3 turns, 2,500 Damage Cut, +15 Stars to all allies (Stars enhanced by Overcharge)
                  p.activeBuffs.push({
                    name: `${npName} (ATK Up)`,
                    type: 'atk_up',
                    value: 50,
                    remainingTurns: 3
                  });
                  p.activeBuffs.push({
                    name: `${npName} (Damage Cut)`,
                    type: 'damage_cut',
                    value: 2500,
                    remainingTurns: 3
                  });
                  const ocStarBonus = isOvercharged ? (overchargeLevel >= 3 ? 30 : 15) : 0;
                  p.critStars = Math.min(50, (p.critStars || 0) + 15 + ocStarBonus);
                } else if (isTigris) {
                  const defBonus = isOvercharged ? (30 + (overchargeLevel - 1) * 10) : 30;
                  p.activeBuffs.push({
                    name: `${npName} (DEF Up)`,
                    type: 'def_up',
                    value: defBonus,
                    remainingTurns: 3
                  });
                  // Overcharge Living Earth Damage Cut (only triggers when Overcharged >= 200% NP)
                  if (isOvercharged) {
                    const damageCutVal = 1500 + (overchargeLevel - 1) * 750;
                    p.activeBuffs.push({
                      name: `${npName} (Damage Cut)`,
                      type: 'damage_cut',
                      value: damageCutVal,
                      remainingTurns: 3
                    });
                  }
                } else if (isLuminosite) {
                  p.activeBuffs.push({
                    name: `${npName} (DEF Up)`,
                    type: 'def_up',
                    value: 30,
                    remainingTurns: 3
                  });
                  // Overcharge Holy Regen (only triggers when Overcharged >= 200% NP)
                  if (isOvercharged) {
                    const regenVal = 1000 + (overchargeLevel - 1) * 500;
                    p.currentHp = Math.min(p.maxHp, p.currentHp + regenVal);
                    p.activeBuffs.push({
                      name: `${npName} (Holy Regen)`,
                      type: 'hp_regen',
                      value: regenVal,
                      remainingTurns: 2
                    });
                  }
                } else {
                  // Standard Support NP: +30% DEF for 3 turns & +3,000 HP
                  p.activeBuffs.push({
                    name: `${npName} (DEF Up)`,
                    type: 'def_up',
                    value: 30,
                    remainingTurns: 3
                  });
                  p.currentHp = Math.min(p.maxHp, p.currentHp + 3000);
                }
              }
            });

            if (isRoundOfAvalon) {
              const ocNote = isOvercharged ? ` • Overcharge Lv.${overchargeLevel} Active` : '';
              npEffectsLog.push(`👑 [Round of Avalon: Party +50% ATK (3T), Anti-Purge Defense (1T), Cleanse & Stars to ALL Allies!${ocNote}]`);
              npEffectsHud.push(`+50% Party ATK • Anti-Purge Def • Stars${isOvercharged ? ' (OC Active)' : ''}`);
            } else {
              const ocNote = isOvercharged ? ` • Overcharge Lv.${overchargeLevel} Active` : '';
              npEffectsLog.push(`🕊️ [Party Invincible (1T), +30% DEF (3T), Cleanse & Party Support!${ocNote}]`);
              npEffectsHud.push(`Party Invincible • +30% DEF${isOvercharged ? ' • OC Regen/Cut' : ''}`);
            }
            starsGenerated += 15;
            npGained += 20;
          } else {
            const npHasAntiThreat = /Threat to Humanity|Beast|Divine|Foreigner/i.test(npBaseDesc + ' ' + npOverchargeDesc);
            const npSpecialMult = (isBossThreat && npHasAntiThreat) ? 1.5 : 1.0;
            if (isBossThreat && npHasAntiThreat) npTriggeredAntiThreat = true;

            // Apply secondary debuffs from Noble Phantasm to boss
            battleState.bossBuffs = battleState.bossBuffs || [];

            // 1. Stun / Paralysis / Charm / Bound Handling (Base effect or Overcharge trigger)
            const stunInBase = /stun|paraly|charm|bound/i.test(npBaseDesc);
            const stunInOvercharge = /stun|paraly|charm|bound/i.test(npOverchargeDesc);
            if (stunInBase || (stunInOvercharge && isOvercharged)) {
              const isImmuneToStun = boss.id === 'tiamat' && (battleState.currentPhase || 1) >= 2;
              if (isImmuneToStun) {
                npEffectsLog.push('🛡️ [Stun Resisted: Immense Mass (Boss Immune)]');
                npEffectsHud.push('Stun Resisted (Immune)');
              } else {
                const combinedStunDesc = stunInBase ? npBaseDesc : npOverchargeDesc;
                const chanceMatch = combinedStunDesc.match(/(\d+)%\s*(?:chance)?.*(?:stun|paraly|charm|bound)/i) ||
                                    combinedStunDesc.match(/(?:stun|paraly|charm|bound).*(?:with\s*)?(\d+)%/i);
                const stunChance = chanceMatch ? parseInt(chanceMatch[1], 10) : 100;
                const roll = Math.random() * 100;
                if (roll < stunChance) {
                  battleState.bossBuffs.push({
                    name: `${npName} (Stun)`,
                    type: 'stun',
                    value: 100,
                    remainingTurns: 1
                  });
                  npEffectsLog.push('⚡ [Stun Inflicted (1 Turn)]');
                  npEffectsHud.push('⚡ Stun Inflicted');
                } else {
                  npEffectsLog.push(`💨 [Stun Resisted]`);
                  npEffectsHud.push('Stun Resisted');
                }
              }
            }

            // 2. DEF Down / Armor Shred (Base effect or Overcharge trigger)
            const defInBase = /def.*down|lower.*def|reduce.*def|decrease.*def|shred.*armor/i.test(npBaseDesc);
            const defInOvercharge = /def.*down|lower.*def|reduce.*def|decrease.*def|shred.*armor/i.test(npOverchargeDesc);
            if (defInBase || (defInOvercharge && isOvercharged)) {
              const combinedDefDesc = defInBase ? npBaseDesc : npOverchargeDesc;
              const defMatch = combinedDefDesc.match(/def(?:ense)?\s*(?:by\s*|down\s*)?(\d+)%/i) ||
                               combinedDefDesc.match(/(\d+)%\s*(?:def|defense\s*down)/i);
              let defVal = defMatch ? parseInt(defMatch[1], 10) : 30;
              if (defInOvercharge && isOvercharged && overchargeLevel >= 3) {
                defVal = Math.round(defVal * 1.33); // Enhanced tier at Lv.3 MAX Overcharge
              }
              battleState.bossBuffs.push({
                name: `${npName} (DEF Down)`,
                type: 'def_down',
                value: defVal,
                remainingTurns: 3
              });
              npEffectsLog.push(`🔻 [-${defVal}% DEF Down (3T)]`);
              npEffectsHud.push(`-${defVal}% DEF`);
            }

            // 3. Critical Rate Down (Base effect or Overcharge trigger)
            const critInBase = /crit.*down|reduce.*crit|decrease.*crit/i.test(npBaseDesc);
            const critInOvercharge = /crit.*down|reduce.*crit|decrease.*crit/i.test(npOverchargeDesc);
            if (critInBase || (critInOvercharge && isOvercharged)) {
              const combinedCritDesc = critInBase ? npBaseDesc : npOverchargeDesc;
              const critMatch = combinedCritDesc.match(/crit(?:ical)?\s*(?:rate\s*)?(?:by\s*)?(\d+)%/i);
              const critVal = critMatch ? parseInt(critMatch[1], 10) : 20;
              battleState.bossBuffs.push({
                name: `${npName} (Crit Down)`,
                type: 'crit_rate_down',
                value: critVal,
                remainingTurns: 3
              });
              npEffectsLog.push(`🎯 [-${critVal}% Crit Rate (3T)]`);
              npEffectsHud.push(`-${critVal}% Boss Crit`);
            }

            // 4. NP Drain / Charge Reduction (Base effect or Overcharge trigger)
            const drainInBase = /drain|reduce.*np\s*gauge|np\s*seal/i.test(npBaseDesc);
            const drainInOvercharge = /drain|reduce.*np\s*gauge|np\s*seal/i.test(npOverchargeDesc);
            if (drainInBase || (drainInOvercharge && isOvercharged)) {
              battleState.bossCharge = Math.max(0, battleState.bossCharge - 1);
              battleState.bossBuffs.push({
                name: `${npName} (NP Drain)`,
                type: 'np_seal',
                value: 1,
                remainingTurns: 1
              });
              npEffectsLog.push('🔒 [-1 Boss NP Charge]');
              npEffectsHud.push('-1 NP Charge');
            }

            // 5. Curse / Burn / Poison (Base effect or Overcharge trigger)
            const dotInBase = /curse|burn|poison/i.test(npBaseDesc);
            const dotInOvercharge = /curse|burn|poison/i.test(npOverchargeDesc);
            if (dotInBase || (dotInOvercharge && isOvercharged)) {
              battleState.bossBuffs.push({
                name: `${npName} (Affliction)`,
                type: 'curse',
                value: 6000,
                remainingTurns: 3
              });
              npEffectsLog.push('🔥 [Curse/Burn (3T)]');
              npEffectsHud.push('Curse/Burn (3T)');
            }

            // 6. Buff Block (Base effect or Overcharge trigger)
            const blockInBase = /buff\s*block/i.test(npBaseDesc);
            const blockInOvercharge = /buff\s*block/i.test(npOverchargeDesc);
            if (blockInBase || (blockInOvercharge && isOvercharged)) {
              battleState.bossBuffs.push({
                name: `${npName} (Buff Block)`,
                type: 'buff_block',
                value: 1,
                remainingTurns: 3
              });
              npEffectsLog.push('🚫 [Buff Block (3T)]');
              npEffectsHud.push('Buff Block');
            }

            // 7. Ignore Defense
            if (/ignore.*def|bypass.*def|defense-ignoring/i.test(npBaseDesc + ' ' + npOverchargeDesc)) {
              npEffectsLog.push('🛡️ [DEF-Ignoring]');
            }

            // Typhon Ephemeros: Dragon Grail scaling with self debuffs (+10% per stack, up to +100%)
            let typhonRaidDebuffScale = 1.0;
            if (active.servant.templateId === 'typhon_ephemeros' || /dragon grail that reverses/i.test(npName)) {
              const debuffCount = (active.activeBuffs || []).filter(b => ['curse', 'burn', 'poison', 'atk_down', 'def_down', 'stun', 'np_seal', 'skill_seal'].includes(b.type) || (b.name && (b.name.includes('[Demerit]') || b.type.includes('debuff')))).length;
              if (debuffCount > 0) {
                typhonRaidDebuffScale = 1.0 + Math.min(1.0, debuffCount * 0.10);
                npEffectsLog.push(`🍷 [Dragon Grail Powerup: +${Math.round((typhonRaidDebuffScale - 1) * 100)}% DMG from ${debuffCount} Demerit/Debuff Stacks!]`);
                npEffectsHud.push(`+${Math.round((typhonRaidDebuffScale - 1) * 100)}% Debuff DMG`);
              }
              battleState.bossBuffs.push({
                name: 'Dragon Grail (Burn)',
                type: 'burn',
                value: 1000,
                remainingTurns: 5
              });
              battleState.bossBuffs.push({
                name: 'Dragon Grail (Spread of Fire)',
                type: 'spread_of_fire',
                value: 100,
                remainingTurns: 5
              });
              npEffectsLog.push('🔥 [Burn (1,000/5T) + Spread of Fire (+100%/5T) Inflicted!]');
              npEffectsHud.push('Burn + Spread of Fire');
            }

            totalTurnDmg += Math.round(baseAtk * npMultiplier * overchargeScale * typhonRaidDebuffScale * atkBuffMult * specialAtkMult * bossDefFactor * npSpecialMult * (0.95 + Math.random() * 0.1));
            starsGenerated += 10;
            npGained += 15;
          }
        }
      });

      // Chaos Spores Phase 2 Passive
      if (boss.id === 'tiamat' && battleState.currentPhase === 2 && (battleState.round % 2 === 1)) {
        if ((battleState.turnDamageTaken || 0) < 300_000) {
          totalTurnDmg = Math.round(totalTurnDmg * 0.80);
          battleState.chaosSporesActive = true;
          npEffectsLog.push('🛡️ [Chaos Spores: -20% Shield Active]');
        }
      }

      // Boss Barrier Absorption (e.g. from Chaos Deluge)
      if (battleState.bossShield && battleState.bossShield > 0) {
        if (totalTurnDmg <= battleState.bossShield) {
          battleState.bossShield -= totalTurnDmg;
          npEffectsLog.push(`🛡️ [Barrier Absorbed ${totalTurnDmg.toLocaleString()} DMG (${battleState.bossShield.toLocaleString()} HP Left)]`);
          totalTurnDmg = 0;
        } else {
          const absorbed = battleState.bossShield;
          totalTurnDmg -= absorbed;
          battleState.bossShield = 0;
          npEffectsLog.push(`💥 [Barrier Shattered (${absorbed.toLocaleString()} DMG Absorbed)]`);
        }
      }

      battleState.bossCurrentHp = Math.max(0, battleState.bossCurrentHp - totalTurnDmg);
      battleState.turnDamageTaken = (battleState.turnDamageTaken || 0) + totalTurnDmg;
      active.npGauge = Math.min(300, (active.npGauge || 0) + npGained);
      // Consumes existing stars used during the attack; new star pool is based on stars generated this turn!
      active.critStars = Math.min(50, Math.round(starsGenerated));

      const servName = active.servant.nickname || active.servant.template?.name || 'Servant';
      let traitLog = '';
      if (totalCritsLanded > 0) {
        traitLog += ` 💥 **[${totalCritsLanded} CRIT${totalCritsLanded > 1 ? 'S' : ''} (2.0x DMG)!]**`;
      }
      if (npTriggeredAntiThreat) {
        traitLog += ' 👑 **[Anti-Calamity Protocol: +50% Special DMG vs Threat to Humanity!]**';
      } else if (antiThreatBuff > 0) {
        traitLog += ' ⚡ **[Calamity-Breaker: +30% Special ATK vs Threat to Humanity!]**';
      }
      if (boss.id === 'tiamat' && battleState.currentPhase === 3 && pendingCards.some(c => c !== 'NP')) {
        traitLog += ' 🌑 **[Nega-Genesis: -50% Normal Card DMG]**';
      }
      if (bossDefDown > 0) {
        traitLog += ` 🔻 **[DEF Down: +${Math.round(bossDefDown * 100)}% DMG]**`;
      }

      const npEffectsStr = npEffectsLog.length > 0 ? ` ${npEffectsLog.join(' ')}` : '';
      const actionVerb = usedNp ? `unleashed **[${npNameUsed}]** dealing` : 'dealt';
      const playerAttackLog = `⚔️ **${servName}** ${actionVerb} **${totalTurnDmg.toLocaleString()} DMG** to ${boss.name}! (+${npGained}% NP, +${starsGenerated} Stars)${traitLog}${npEffectsStr}`;
      battleState.lastPlayerAttackLog = playerAttackLog;
      battleState.recentLogs.push(playerAttackLog);
      while (battleState.recentLogs.length > 8) battleState.recentLogs.shift();

      // Update single-focus Tactical Action HUD with THIS turn's strike damage & full NP details!
      let subDetailStr = '';
      if (usedNp) {
        const shortNpName = npNameUsed.split(':')[0].trim();
        if (npEffectsHud.length > 0) {
          subDetailStr = `${shortNpName} • ${npEffectsHud.join(' • ')} • +${starsGenerated} Stars`;
        } else {
          subDetailStr = `${shortNpName} Unleashed • +${starsGenerated} Stars`;
        }
      } else if (totalCritsLanded > 0) {
        subDetailStr = `CRITICAL HIT (${totalCritsLanded}x) • +${npGained}% NP • +${starsGenerated} Stars`;
      } else {
        subDetailStr = `+${npGained}% NP • +${starsGenerated} Stars Generated`;
      }

      battleState.lastHudAction = {
        category: usedNp ? 'NOBLE PHANTASM' : 'MASTER STRIKE',
        categoryColor: usedNp ? '#a855f7' : '#38bdf8',
        headline: servName,
        bigStat: `${totalTurnDmg.toLocaleString()} DMG`,
        bigStatColor: usedNp ? '#facc15' : '#fde047',
        subDetail: subDetailStr,
        subDetailColor: usedNp ? '#c084fc' : (totalCritsLanded > 0 ? '#f43f5e' : '#67e8f9')
      };

      active.totalDamageDealt = (active.totalDamageDealt || 0) + totalTurnDmg;
      battleState.fullCombatLog = battleState.fullCombatLog || [];
      const chainDesc = `[${pendingCards.join(' ➔ ')}]`;
      const fullNpDetail = usedNp ? `unleashed **[${npNameUsed}]** with \`${chainDesc}\`` : `struck with \`${chainDesc}\``;
      battleState.fullCombatLog.push(
        `⚔️ **[Round ${battleState.round}]** **${servName}** (<@${active.userId}>) ${fullNpDetail} dealing **${totalTurnDmg.toLocaleString()} DMG**! *(${boss.name} HP: ${battleState.bossCurrentHp.toLocaleString()} / ${battleState.bossMaxHp.toLocaleString()})*${npEffectsStr}${traitLog}`
      );

      if (battleState.bossCurrentHp <= 0) {
        if (battleState.breakGaugesRemaining && battleState.breakGaugesRemaining > 0) {
          // Break gauge transition!
          battleState.breakGaugesRemaining--;
          battleState.currentPhase = (battleState.currentPhase || 1) + 1;
          const phaseIdx = battleState.currentPhase - 1;
          const nextPhase = boss.phases?.[phaseIdx];
          const newBase = nextPhase?.baseHp || (battleState.currentPhase === 2 ? 5_500_000 : 8_000_000);
          const scaledNewHp = Math.round(newBase * hpMultiplier);

          battleState.bossCurrentHp = scaledNewHp;
          battleState.bossMaxHp = scaledNewHp;
          battleState.bossCharge = 0;
          battleState.bossBuffs = []; // Cleanse debuffs upon break
          battleState.phaseTurn = 1;
          battleState.phaseUltsUsed = 0;
          battleState.turnDamageTaken = 0;
          battleState.bossShield = 0;

          const breakMsg = `💥 **[BREAK GAUGE SHATTERED!]** ${nextPhase?.breakAnnouncement || 'The boss changes form and unleashes new power!'}`;
          battleState.recentLogs.push(breakMsg);
          battleState.fullCombatLog.push(breakMsg);
          while (battleState.recentLogs.length > 8) battleState.recentLogs.shift();

          battleState.lastHudAction = {
            category: 'BREAK GAUGE',
            categoryColor: '#ec4899',
            headline: boss.name,
            bigStat: 'GAUGE SHATTERED!',
            bigStatColor: '#f43f5e',
            subDetail: `Phase ${battleState.currentPhase}/3 Engaged • Boss Transformed`,
            subDetailColor: '#fbcfe8'
          };
        } else {
          battleState.bossCurrentHp = 0;
          await cleanupNpGif();
          collector.stop('victory');
          battleState.finishingBlow = {
            userId: active.userId,
            servantName: servName,
            damage: totalTurnDmg,
            cardChain: pendingCards.join(' ➔ '),
            round: battleState.round
          };
          await concludeRaidVictory(battleMsg, boss, battleState);
          return;
        }
      }

      // Refresh hand for this participant and clear selections
      refreshParticipantHand(active);
      pendingCards = [];
      pendingIndices = [];

      const hasMorePlayersInRound = advanceToNextPlayer();

      let bossUsedNp = false;
      if (!hasMorePlayersInRound) {
        // Save player strike HUD action before boss turn execution
        const playerStrikeHud = battleState.lastHudAction;

        // 1. Render and post the Player Strike Canvas so players see their strike damage & updated boss HP!
        await renderAndPostTurn();

        // 2. Dispatch player Noble Phantasm Visuals if unleashed
        if (pendingNpToDispatch) {
          await dispatchRaidNpGif(pendingNpToDispatch.servant, pendingNpToDispatch.userId);
          pendingNpToDispatch = null;
        }

        // 3. Brief dramatic pause (2.5s) to witness the strike impact before the enemy counter-attacks
        await new Promise(resolve => setTimeout(resolve, 2500));

        // 4. Execute Boss Turn
        const bossTurnResult = await executeBossTurn(battleState);
        bossUsedNp = bossTurnResult?.bossUsedNp || false;

        const anyAlive = battleState.participants.some(p => !p.isDead);
        if (!anyAlive) {
          await cleanupNpGif();
          collector.stop('defeated');
          await concludeRaidDefeat(battleMsg, boss, battleState);
          return;
        }

        battleState.round++;
        battleState.participants.forEach(p => {
          p.skillCooldowns = p.skillCooldowns.map(cd => Math.max(0, cd - 1));
          if (p.activeBuffs) {
            p.activeBuffs.forEach(b => b.remainingTurns--);
            p.activeBuffs = p.activeBuffs.filter(b => b.remainingTurns > 0);
          }
        });

        // Keep Boss turn HUD action active so players see the Boss's damage & action on the new turn
        // 5. Render and post the new round turn canvas (with active buttons & boss damage HUD)
        await renderAndPostTurn();

        // 6. Dispatch Boss NP GIF if used
        if (bossUsedNp) {
          await dispatchBossNpGif();
        }
      } else {
        // Multi-player: Advance to next player in the current round
        await renderAndPostTurn();

        if (pendingNpToDispatch) {
          await dispatchRaidNpGif(pendingNpToDispatch.servant, pendingNpToDispatch.userId);
        }
      }
    } finally {
      isProcessingTurn = false;
    }
    } catch (err: any) {
      if (
        err?.code === 10062 ||
        err?.code === 40060 ||
        err?.message?.includes('Unknown interaction') ||
        err?.message?.includes('already been acknowledged')
      ) {
        // Ignored harmless Discord interaction race
      } else {
        console.error('[raid] Unhandled error during raid turn execution:', err);
      }
    }
  });

  collector.on('end', async () => {
    await cleanupNpGif();
  });

  function advanceToNextPlayer(): boolean {
    const living = battleState.participants;
    let nextIdx = (battleState.activeMasterIndex + 1) % living.length;
    let loops = 0;

    while (living[nextIdx].isDead && loops < living.length) {
      nextIdx = (nextIdx + 1) % living.length;
      loops++;
    }

    const completedRound = nextIdx <= battleState.activeMasterIndex;
    battleState.activeMasterIndex = nextIdx;
    currentActiveParticipant = battleState.participants[battleState.activeMasterIndex];

    return !completedRound;
  }
}

async function executeBossTurn(state: RaidBattleState): Promise<{ bossUsedNp: boolean }> {
  state.bossBuffs = state.bossBuffs || [];

  const livingParticipants = state.participants.filter(p => !p.isDead);
  if (livingParticipants.length === 0) return { bossUsedNp: false };

  // Reset Guts activation flag for this turn
  state.participants.forEach(p => {
    p.gutsTriggeredThisTurn = false;
  });

  const enemyPhase = {
    skillName: '',
    skillDesc: '',
    actionName: '',
    actionTarget: '',
    strikeDamage: 0,
    curseDamage: 0,
    totalDamage: 0,
    debuffsInflicted: [] as string[],
    bossBuffsGained: [] as string[],
    specialEvents: [] as string[]
  };

  // 1. HP Threshold & Enrage Phase Check (< 50% HP)
  const hpRatio = state.bossCurrentHp / state.bossMaxHp;
  const isEnraged = hpRatio <= 0.50;
  const enrageMult = isEnraged ? 1.25 : 1.0;
  const bossAtkBuffs = state.bossBuffs.filter(b => b.type === 'atk_up').reduce((acc, b) => acc + b.value, 0);
  const bossAtkDebuffs = state.bossBuffs.filter(b => b.type === 'atk_down').reduce((acc, b) => acc + b.value, 0);
  const totalBossAtkMult = Math.max(0.2, (1 + (bossAtkBuffs - bossAtkDebuffs) / 100) * enrageMult);

  const isTiamat = state.boss.id === 'tiamat';
  state.phaseTurn = (state.phaseTurn || 1) + 1;

  // Tiamat Phase 1 Passive: Sea of Life / Chaos Tide
  if (isTiamat && (state.currentPhase === 1)) {
    state.participants.forEach(p => {
      if (!p.isDead) {
        p.currentHp = Math.max(1, p.currentHp - 2000);
        p.npGauge = Math.max(0, (p.npGauge || 0) - 15);
      }
    });
    state.recentLogs.push('🌊 **[Sea of Life]** Corrosive Chaos Tide roils across the field! (-2,000 HP & -15% NP to all Servants)');
    enemyPhase.specialEvents.push('🌊 **[Sea of Life]** All Servants suffered 2,000 HP corrosion & -15% NP gauge!');
  }

  // Tiamat Phase 2 & 3 Passive: Immense Mass (Immunity to Stun)
  if (isTiamat && (state.currentPhase || 1) >= 2) {
    state.bossBuffs = state.bossBuffs.filter(b => b.type !== 'stun');
  }

  // Check Stun on Boss
  const isBossStunned = state.bossBuffs.some(b => b.type === 'stun');
  if (isBossStunned) {
    state.recentLogs.push(`⚡ **[STUNNED!] ${state.boss.name} is paralyzed and unable to act this turn!**`);
    enemyPhase.specialEvents.push(`⚡ **[STUNNED!]** ${state.boss.name} was paralyzed by Stun and could not act!`);
    state.lastEnemyPhase = enemyPhase;
    const dotDmg = state.bossBuffs.filter(b => b.type === 'curse' || b.type === 'burn' || b.type === 'poison').reduce((acc, b) => acc + b.value, 0);
    if (dotDmg > 0) {
      state.bossCurrentHp = Math.max(0, state.bossCurrentHp - dotDmg);
      state.recentLogs.push(`🔥 ${state.boss.name} took **${dotDmg.toLocaleString()} Affliction DoT DMG**!`);
    }
    state.bossBuffs.forEach(b => b.remainingTurns--);
    state.bossBuffs = state.bossBuffs.filter(b => b.remainingTurns > 0);
    if (state.recentLogs.length > 8) state.recentLogs.shift();
    return { bossUsedNp: false };
  }

  // 2. Action 1: Tactical Skill
  if (isTiamat) {
    const tiamatSkillRoll = Math.random();
    if (tiamatSkillRoll < 0.20) {
      // Skill: Wailing Voice (1T Skill Seal on highest NP Servant)
      const target = [...livingParticipants].sort((a, b) => (b.npGauge || 0) - (a.npGauge || 0))[0];
      if (target) {
        target.activeBuffs = target.activeBuffs || [];
        target.activeBuffs.push({
          name: 'Wailing Voice (Skill Seal)',
          type: 'skill_seal',
          value: 1,
          remainingTurns: 1
        });
        const tName = target.servant.nickname || target.servant.template?.name || 'Servant';
        enemyPhase.skillName = 'Wailing Voice';
        enemyPhase.skillDesc = `Inflicted 1T Skill Seal on ${tName}`;
        enemyPhase.debuffsInflicted.push(`Skill Seal (1T) on ${tName}`);
        state.recentLogs.push(`📢 **Tiamat released [Wailing Voice]!** Inflicted **1-Turn Skill Seal** on **${tName}**!`);
      }
    } else if (tiamatSkillRoll < 0.40) {
      // Skill: Mud Surge (shortens active buff durations by 1 turn on 2 random Servants)
      const shuffled = [...livingParticipants].sort(() => 0.5 - Math.random());
      const affected: string[] = [];
      shuffled.slice(0, 2).forEach(p => {
        if (p.activeBuffs && p.activeBuffs.length > 0) {
          p.activeBuffs.forEach(b => {
            if (b.remainingTurns > 0 && b.remainingTurns < 90) b.remainingTurns--;
          });
          p.activeBuffs = p.activeBuffs.filter(b => b.remainingTurns > 0);
          affected.push(p.servant.nickname || p.servant.template?.name || 'Servant');
        }
      });
      enemyPhase.skillName = 'Mud Surge';
      enemyPhase.skillDesc = 'Shortened active buff durations by 1 turn';
      if (affected.length > 0) enemyPhase.debuffsInflicted.push(`Shortened buffs on ${affected.join(', ')}`);
      state.recentLogs.push(`🌊 **Tiamat unleashed [Mud Surge]!** Corrosive primordial tide shortened ally buff durations!`);
    } else if (tiamatSkillRoll < 0.60) {
      // Skill: Tremor Step (reduces front-most Servant DEF by 20% for 3 turns)
      const front = livingParticipants[0];
      if (front) {
        front.activeBuffs = front.activeBuffs || [];
        front.activeBuffs.push({
          name: 'Tremor DEF Down',
          type: 'def_down',
          value: 20,
          remainingTurns: 3
        });
        const tName = front.servant.nickname || front.servant.template?.name || 'Servant';
        enemyPhase.skillName = 'Tremor Step';
        enemyPhase.skillDesc = `-20% DEF on ${tName} for 3T`;
        enemyPhase.debuffsInflicted.push(`-20% DEF (3T) on ${tName}`);
        state.recentLogs.push(`👣 **Tiamat shook the abyss with [Tremor Step]!** Inflicted **-20% DEF (3T)** on **${tName}**!`);
      }
    } else if (tiamatSkillRoll < 0.80) {
      // Skill: Crying Eyes (drains 10% NP from 2 players)
      const shuffled = [...livingParticipants].sort(() => 0.5 - Math.random());
      const drainedNames: string[] = [];
      shuffled.slice(0, 2).forEach(p => {
        p.npGauge = Math.max(0, (p.npGauge || 0) - 10);
        drainedNames.push(p.servant.nickname || p.servant.template?.name || 'Servant');
      });
      enemyPhase.skillName = 'Crying Eyes';
      enemyPhase.skillDesc = 'Drained 10% NP from 2 Servants';
      enemyPhase.debuffsInflicted.push(`Drained 10% NP from ${drainedNames.join(', ')}`);
      state.recentLogs.push(`👁️ **Tiamat shed tears of genesis [Crying Eyes]!** Drained **10% NP** from **${drainedNames.join(', ')}**!`);
    } else {
      // Skill: Chaos Deluge (siphons 15% NP from all Servants, converts into +50k shield)
      let totalSiphoned = 0;
      livingParticipants.forEach(p => {
        const drain = Math.min(15, p.npGauge || 0);
        p.npGauge = Math.max(0, (p.npGauge || 0) - 15);
        totalSiphoned += drain;
      });
      state.bossShield = (state.bossShield || 0) + 50_000;
      enemyPhase.skillName = 'Chaos Deluge';
      enemyPhase.skillDesc = 'Siphoned 15% NP from all Servants and formed a 50,000 HP barrier';
      enemyPhase.bossBuffsGained.push('+50,000 HP Chaos Barrier');
      state.recentLogs.push(`🌊 **Tiamat invoked [Chaos Deluge]!** Siphoned NP from all Servants and created a **50,000 HP Barrier**!`);
    }
  } else {
    const skillRoll = Math.random();
    if (skillRoll < 0.35) {
      // Skill 1: Gaze of the Thousand Eyes (-20% DEF for 2 turns, scatters 10 stars)
      state.participants.forEach(p => {
        if (!p.isDead) {
          p.activeBuffs = p.activeBuffs || [];
          p.activeBuffs.push({
            name: 'Demonic DEF Down',
            type: 'def_down',
            value: 20,
            remainingTurns: 2
          });
          p.critStars = Math.max(0, (p.critStars || 0) - 10);
        }
      });
      enemyPhase.skillName = 'Gaze of the Thousand Eyes';
      enemyPhase.skillDesc = 'All Servants suffer -20% DEF (2T) and -10 Critical Stars';
      enemyPhase.debuffsInflicted.push('-20% DEF Down (2T) on all Servants', '-10 Critical Stars drained');
      state.recentLogs.push(
        `👁️ **Barbatos cast [Gaze of the Thousand Eyes]!** All Servants suffer **-20% DEF** (2T) and lost 10 Critical Stars!`
      );
    } else if (skillRoll < 0.70) {
      // Skill 2: Wailing of the Inverted Spire (+25% ATK, +1 Charge Diamond only when enraged)
      state.bossBuffs.push({
        name: 'Wailing of the Spire',
        type: 'atk_up',
        value: 25,
        remainingTurns: 2
      });
      if (isEnraged) {
        state.bossCharge = Math.min(state.boss.maxCharge, state.bossCharge + 1);
        enemyPhase.skillName = 'Wailing of the Inverted Spire';
        enemyPhase.skillDesc = 'Increases own ATK by +25% (2T) and charges NP gauge by 1 diamond';
        enemyPhase.bossBuffsGained.push('+25% ATK Up (2T)', '+1 NP Charge Diamond');
        state.recentLogs.push(
          `📢 **Barbatos cast [Wailing of the Inverted Spire]!** Demon God ATK increased by **+25%** and gained **+1 Charge Diamond**!`
        );
      } else {
        enemyPhase.skillName = 'Wailing of the Inverted Spire';
        enemyPhase.skillDesc = 'Increases own ATK by +25% (2T)';
        enemyPhase.bossBuffsGained.push('+25% ATK Up (2T)');
        state.recentLogs.push(
          `📢 **Barbatos cast [Wailing of the Inverted Spire]!** Demon God ATK increased by **+25%**!`
        );
      }
    } else {
      // Skill 3: Curse of the Solomon Throne (Curses target with highest NP & inflicts -20% ATK Down)
      const highestNpTarget = [...livingParticipants].sort((a, b) => (b.npGauge || 0) - (a.npGauge || 0))[0];
      if (highestNpTarget) {
        highestNpTarget.activeBuffs = highestNpTarget.activeBuffs || [];
        highestNpTarget.activeBuffs.push({
          name: 'Solomon\'s Curse',
          type: 'curse',
          value: 1200,
          remainingTurns: 3
        });
        highestNpTarget.activeBuffs.push({
          name: 'Solomon\'s ATK Down',
          type: 'atk_down',
          value: 20,
          remainingTurns: 2
        });
        const tName = highestNpTarget.servant.nickname || highestNpTarget.servant.template?.name || 'Servant';
        enemyPhase.skillName = 'Curse of the Solomon Throne';
        enemyPhase.skillDesc = `Inflicted Curse and -20% ATK Down on ${tName}`;
        enemyPhase.debuffsInflicted.push(`Curse (1,200 DMG/T, 3T) on ${tName}`, `-20% ATK Down (2T) on ${tName}`);
        state.recentLogs.push(
          `☠️ **Barbatos cast [Curse of the Solomon Throne]!** Inflicted **Curse** (1,200 DMG/Turn) & **-20% ATK Down** on **${tName}**!`
        );
      }
    }
  }

  // Charge progression (+1 normal charge; +2 if enraged)
  const isNpSealed = state.bossBuffs.some(b => b.type === 'np_seal');
  if (!isNpSealed) {
    state.bossCharge = Math.min(state.boss.maxCharge, state.bossCharge + (isEnraged ? 2 : 1));
  } else {
    state.recentLogs.push(`🔒 **[NP SEALED!] ${state.boss.name} is sealed and cannot charge its NP!**`);
    enemyPhase.specialEvents.push(`🔒 **[NP SEALED]** ${state.boss.name} was sealed and could not charge its NP diamond!`);
  }

  let bossUsedNp = false;

  // 3. Action 2: Attack or Noble Phantasm
  if (state.bossCharge >= state.boss.maxCharge && !isNpSealed) {
    bossUsedNp = true;
    state.bossCharge = 0;

    if (isTiamat) {
      const isPhase3 = state.currentPhase === 3;
      if (isPhase3) {
        state.phaseUltsUsed = (state.phaseUltsUsed || 0) + 1;
        const isEnrageWipe = state.phaseUltsUsed >= 3 || state.round >= 20;
        enemyPhase.actionName = isEnrageWipe
          ? 'ENRAGE WIPE: Primordial Roar (Absolute Calamity)'
          : 'NOBLE PHANTASM: Primordial Roar (True Genesis Annihilation)';
        enemyPhase.actionTarget = 'ALL Servants (Ignores Evade & Invincible!)';

        const baseAoeDamage = isEnrageWipe ? 99_999 : Math.round((22000 + Math.random() * 6000) * totalBossAtkMult);
        let antiPurgeCount = 0;

        state.participants.forEach(p => {
          if (!p.isDead) {
            // Anti-Purge Defense blocks attacks that ignore Evade/Invincible!
            const apIdx = p.activeBuffs ? p.activeBuffs.findIndex(b => b.type === 'anti_purge_defense' || b.type === 'anti_purge') : -1;
            if (apIdx >= 0 && p.activeBuffs && !isEnrageWipe) {
              antiPurgeCount++;
              const pName = p.servant.nickname || p.servant.template?.name || 'Servant';
              enemyPhase.specialEvents.push(`👑 **${pName}**'s Anti-Purge Defense completely NULLIFIED Primordial Roar!`);
              return;
            }

            enemyPhase.strikeDamage += baseAoeDamage;
            const res = applyDamageToRaidParticipant(p, baseAoeDamage, state);
            if (res.gutsLog) enemyPhase.specialEvents.push(res.gutsLog);
          }
        });

        const apNotice = antiPurgeCount > 0 ? ` 👑 (${antiPurgeCount} Protected by Anti-Purge Defense!)` : '';
        state.recentLogs.push(
          isEnrageWipe
            ? `💀 **[ENRAGE WIPE!]** Beast II unleashes 3rd Primordial Roar—shattering the reality of the Holy Grail War!`
            : `💥 **NOBLE PHANTASM: PRIMORDIAL ROAR!** Beast II spreads her wings and screams with true genesis mana for **${baseAoeDamage.toLocaleString()} True AoE DMG**! *(Ignores Evade/Invincibility!)*${apNotice}`
        );
      } else {
        enemyPhase.actionName = 'NOBLE PHANTASM: Primordial Murmur';
        enemyPhase.actionTarget = 'ALL Servants';
        const baseAoeDamage = Math.round((14500 + Math.random() * 3500) * totalBossAtkMult);
        let evadesCount = 0;

        state.participants.forEach(p => {
          if (!p.isDead) {
            const evIdx = p.activeBuffs ? p.activeBuffs.findIndex(b => b.type === 'anti_purge_defense' || b.type === 'anti_purge' || b.type === 'evade' || b.type === 'invincible') : -1;
            if (evIdx >= 0 && p.activeBuffs) {
              const bType = p.activeBuffs[evIdx].type;
              p.activeBuffs.splice(evIdx, 1);
              evadesCount++;
              const pName = p.servant.nickname || p.servant.template?.name || 'Servant';
              if (bType === 'anti_purge_defense' || bType === 'anti_purge') {
                enemyPhase.specialEvents.push(`👑 **${pName}** completely BLOCKED Primordial Murmur with Anti-Purge Defense!`);
              } else {
                enemyPhase.specialEvents.push(`🛡️ **${pName}** completely EVADED Primordial Murmur!`);
              }
              return;
            }

            const dmgCut = p.activeBuffs?.filter(b => b.type === 'damage_cut').reduce((acc, b) => acc + b.value, 0) || 0;
            const defDown = p.activeBuffs?.filter(b => b.type === 'def_down').reduce((acc, b) => acc + b.value, 0) || 0;
            const defUp = p.activeBuffs?.filter(b => b.type === 'def_up').reduce((acc, b) => acc + b.value, 0) || 0;
            const defFactor = Math.max(0.4, 1 + (defDown - defUp) / 100);

            const finalAoe = Math.max(1500, Math.round((baseAoeDamage * defFactor) - dmgCut));
            enemyPhase.strikeDamage += finalAoe;

            const res = applyDamageToRaidParticipant(p, finalAoe, state);
            if (res.gutsLog) enemyPhase.specialEvents.push(res.gutsLog);

            p.activeBuffs = p.activeBuffs || [];
            p.activeBuffs.push({
              name: 'Chaos Curse',
              type: 'curse',
              value: 1500,
              remainingTurns: 3
            });
          }
        });

        const evadeNotice = evadesCount > 0 ? ` 🛡️ (${evadesCount} Servant(s) EVADED!)` : '';
        state.recentLogs.push(
          `💥 **NOBLE PHANTASM: PRIMORDIAL MURMUR!** Tiamat weeps as cursed black waves deal **${baseAoeDamage.toLocaleString()} AoE DMG** & Curse!${evadeNotice}`
        );
      }
    } else {
      // Barbatos NP: Incineration Ritual — Barbatos Calamity
      const baseAoeDamage = Math.round((14500 + Math.random() * 3000) * totalBossAtkMult);
      let evadesCount = 0;
      enemyPhase.actionName = 'NOBLE PHANTASM: Incineration Ritual — Barbatos Calamity';
      enemyPhase.actionTarget = 'ALL Servants';

      state.participants.forEach(p => {
        if (!p.isDead) {
          const evIdx = p.activeBuffs ? p.activeBuffs.findIndex(b => b.type === 'anti_purge_defense' || b.type === 'anti_purge' || b.type === 'evade' || b.type === 'invincible') : -1;
          if (evIdx >= 0 && p.activeBuffs) {
            const bType = p.activeBuffs[evIdx].type;
            p.activeBuffs.splice(evIdx, 1);
            evadesCount++;
            const pName = p.servant.nickname || p.servant.template?.name || 'Servant';
            if (bType === 'anti_purge_defense' || bType === 'anti_purge') {
              enemyPhase.specialEvents.push(`👑 **${pName}** completely BLOCKED Barbatos's Noble Phantasm with Anti-Purge Defense!`);
            } else {
              enemyPhase.specialEvents.push(`🛡️ **${pName}** completely EVADED Barbatos's Noble Phantasm!`);
            }
            return;
          }

          const dmgCut = p.activeBuffs?.filter(b => b.type === 'damage_cut').reduce((acc, b) => acc + b.value, 0) || 0;
          const defDown = p.activeBuffs?.filter(b => b.type === 'def_down').reduce((acc, b) => acc + b.value, 0) || 0;
          const defUp = p.activeBuffs?.filter(b => b.type === 'def_up').reduce((acc, b) => acc + b.value, 0) || 0;
          const defFactor = Math.max(0.4, 1 + (defDown - defUp) / 100);

          const finalAoe = Math.max(1500, Math.round((baseAoeDamage * defFactor) - dmgCut));
          enemyPhase.strikeDamage += finalAoe;

          const res = applyDamageToRaidParticipant(p, finalAoe, state);
          if (res.gutsLog) {
            enemyPhase.specialEvents.push(res.gutsLog);
          }

          p.activeBuffs = p.activeBuffs || [];
          p.activeBuffs.push({
            name: 'Calamity Burn',
            type: 'curse',
            value: 1000,
            remainingTurns: 3
          });
        }
      });

      const evadeNotice = evadesCount > 0 ? ` 🛡️ (${evadesCount} Servant(s) EVADED!)` : '';
      state.recentLogs.push(
        `💥 **NOBLE PHANTASM: INCINERATION RITUAL — BARBATOS CALAMITY!** Barbatos blasts the field for **${baseAoeDamage.toLocaleString()} AoE DMG** & inflicts Calamity Curse!${evadeNotice}`
      );
    }
  } else {
    // Normal attack
    const isPhase3Beast = isTiamat && state.currentPhase === 3;
    const targetsToHit = (isPhase3Beast || livingParticipants.length >= 3) ? Math.min(2, livingParticipants.length) : 1;
    const shuffled = [...livingParticipants].sort(() => 0.5 - Math.random());
    const hitTargetNames: string[] = [];

    enemyPhase.actionName = isPhase3Beast ? 'Authority of the Beast (Double Cleave)' : `${state.boss.name} Strike`;

    for (let i = 0; i < Math.min(targetsToHit, shuffled.length); i++) {
      const target = shuffled[i];
      if (target.isDead) continue;

      const tName = target.servant.nickname || target.servant.template?.name || 'Servant';
      hitTargetNames.push(tName);
      const evIdx = target.activeBuffs ? target.activeBuffs.findIndex(b => b.type === 'anti_purge_defense' || b.type === 'anti_purge' || b.type === 'evade' || b.type === 'invincible') : -1;

      if (evIdx >= 0 && target.activeBuffs) {
        const bType = target.activeBuffs[evIdx].type;
        target.activeBuffs.splice(evIdx, 1);
        if (bType === 'anti_purge_defense' || bType === 'anti_purge') {
          state.recentLogs.push(
            `👑 **[BLOCKED!]** **${tName}**'s Anti-Purge Defense completely nullified ${state.boss.name}'s strike!`
          );
          enemyPhase.specialEvents.push(`👑 **${tName}** BLOCKED ${state.boss.name}'s strike with Anti-Purge Defense!`);
        } else {
          state.recentLogs.push(
            `🛡️ **[EVADED!]** **${tName}** read the trajectory and completely avoided ${state.boss.name}'s strike!`
          );
          enemyPhase.specialEvents.push(`🛡️ **${tName}** EVADED ${state.boss.name}'s strike!`);
        }
        continue;
      }

      const dmgCut = target.activeBuffs?.filter(b => b.type === 'damage_cut').reduce((acc, b) => acc + b.value, 0) || 0;
      const defDown = target.activeBuffs?.filter(b => b.type === 'def_down').reduce((acc, b) => acc + b.value, 0) || 0;
      const defUp = target.activeBuffs?.filter(b => b.type === 'def_up').reduce((acc, b) => acc + b.value, 0) || 0;
      const defFactor = Math.max(0.4, 1 + (defDown - defUp) / 100);

      const baseCritMult = isPhase3Beast ? 1.6 : 1.0;
      const baseSingle = Math.round((5000 + Math.random() * 2800) * totalBossAtkMult * baseCritMult);
      const finalDmg = Math.max(800, Math.round((baseSingle * defFactor) - dmgCut));
      enemyPhase.strikeDamage += finalDmg;

      const attackLabel = isPhase3Beast ? 'swept' : 'struck';
      state.recentLogs.push(
        `👁️ ${state.boss.name} ${attackLabel} **${tName}** for **${finalDmg.toLocaleString()} DMG**!${isPhase3Beast ? ' ⚡ **[CRITICAL CLEAVE]**' : ''}`
      );
      const res = applyDamageToRaidParticipant(target, finalDmg, state);
      if (res.gutsLog) {
        enemyPhase.specialEvents.push(res.gutsLog);
      }
    }
    enemyPhase.actionTarget = hitTargetNames.join(', ');
  }

  // 4. End-of-round Curse ticks on living participants
  state.participants.forEach(p => {
    if (!p.isDead) {
      const curseDamage = p.activeBuffs?.filter(b => b.type === 'curse').reduce((acc, b) => acc + b.value, 0) || 0;
      if (curseDamage > 0) {
        const pName = p.servant.nickname || p.servant.template?.name || 'Servant';
        const hasEvadeOrInvincibility = p.activeBuffs?.some(b => b.type === 'anti_purge_defense' || b.type === 'anti_purge' || b.type === 'evade' || b.type === 'invincible');

        if (hasEvadeOrInvincibility) {
          // Protective Anti-Purge / Evade / Invincible barrier completely nullifies Curse Burn DoT for this round
          state.recentLogs.push(`🛡️ **[BARRIER PROTECTED!]** **${pName}**'s barrier completely blocked the **${curseDamage.toLocaleString()} Curse Burn DMG**!`);
          enemyPhase.specialEvents.push(`🛡️ **${pName}**'s barrier blocked Curse Burn DoT!`);
        } else if (p.gutsTriggeredThisTurn) {
          // In Fate battle mechanics, Guts cannot be double-consumed in the same enemy turn.
          // Since the Servant was already revived by Guts from Barbatos's attack this round,
          // Curse burns them down to a minimum of 1 HP so they are not instantly killed again.
          p.currentHp = Math.max(1, p.currentHp - curseDamage);
          state.recentLogs.push(`🔥 **${pName}** endured **${curseDamage.toLocaleString()} Curse Burn DMG** (Protected by Guts Grace)!`);
          enemyPhase.specialEvents.push(`🛡️ **${pName}** survived Curse Burn at 1 HP due to Guts grace!`);
        } else {
          enemyPhase.curseDamage += curseDamage;
          state.recentLogs.push(`🔥 **${pName}** suffered **${curseDamage.toLocaleString()} Curse Burn DMG**!`);
          const res = applyDamageToRaidParticipant(p, curseDamage, state);
          if (res.gutsLog) {
            enemyPhase.specialEvents.push(res.gutsLog);
          }
        }
      }
    }
  });

  enemyPhase.totalDamage = enemyPhase.strikeDamage + enemyPhase.curseDamage;
  state.lastEnemyPhase = enemyPhase;

  // Update single-focus Tactical Action HUD for Boss Turn
  const isAoeOrMulti = enemyPhase.actionTarget === 'ALL Servants' || (enemyPhase.actionTarget && enemyPhase.actionTarget.includes(','));
  const targetLabel = isAoeOrMulti ? 'ALL Vanguard' : (enemyPhase.actionTarget || 'Party');
  state.lastHudAction = {
    category: 'ENEMY ACTION',
    categoryColor: '#f87171',
    headline: enemyPhase.skillName ? `${state.boss.name} • [${enemyPhase.skillName}]` : `${state.boss.name} Assault`,
    bigStat: enemyPhase.totalDamage > 0 ? `${enemyPhase.totalDamage.toLocaleString()} DMG DEALT` : (enemyPhase.skillName || enemyPhase.actionName || 'SKILL ACTIVATED'),
    bigStatColor: '#ef4444',
    subDetail: enemyPhase.debuffsInflicted.length > 0
      ? `Inflicted: ${enemyPhase.debuffsInflicted.join(', ')}`
      : (enemyPhase.actionName ? `${enemyPhase.actionName} on ${targetLabel}` : 'Enemy Phase Concluded'),
    subDetailColor: '#cbd5e1'
  };

  // Record enemy turn events in fullCombatLog
  state.fullCombatLog = state.fullCombatLog || [];
  if (enemyPhase.skillName) {
    const details = enemyPhase.debuffsInflicted.concat(enemyPhase.bossBuffsGained).join(', ') || enemyPhase.skillDesc;
    state.fullCombatLog.push(`👁️ **[Round ${state.round}]** ${state.boss.name} cast **[${enemyPhase.skillName}]** (${details})`);
  }
  if (enemyPhase.actionName) {
    state.fullCombatLog.push(`💥 **[Round ${state.round}]** ${state.boss.name} attacked with **${enemyPhase.actionName}** dealing **${enemyPhase.strikeDamage.toLocaleString()} DMG** to ${enemyPhase.actionTarget || 'party'}`);
  }
  if (enemyPhase.curseDamage > 0) {
    state.fullCombatLog.push(`🔥 **[Round ${state.round}]** Curse Burn inflicted **${enemyPhase.curseDamage.toLocaleString()} DoT DMG**`);
  }
  enemyPhase.specialEvents.forEach(evt => {
    state.fullCombatLog!.push(`🛡️ **[Round ${state.round}]** ${evt}`);
  });

  // End-of-round Curse / Burn / Poison DoT damage on boss
  const bossDotDmg = state.bossBuffs.filter(b => b.type === 'curse' || b.type === 'burn' || b.type === 'poison').reduce((acc, b) => acc + b.value, 0);
  if (bossDotDmg > 0) {
    state.bossCurrentHp = Math.max(0, state.bossCurrentHp - bossDotDmg);
    state.recentLogs.push(`🔥 ${state.boss.name} took **${bossDotDmg.toLocaleString()} Affliction DoT DMG**!`);
  }

  // Tick boss buffs down
  state.bossBuffs.forEach(b => b.remainingTurns--);
  state.bossBuffs = state.bossBuffs.filter(b => b.remainingTurns > 0);

  while (state.recentLogs.length > 8) state.recentLogs.shift();

  return { bossUsedNp };
}

/**
 * Applies damage to a raid participant and evaluates Guts status revival.
 */
function applyDamageToRaidParticipant(
  p: RaidParticipantState,
  damage: number,
  state: RaidBattleState
): { wasFatal: boolean; gutsTriggered: boolean; gutsLog?: string } {
  p.currentHp = p.currentHp - damage;
  if (p.currentHp <= 0) {
    const pName = p.servant.nickname || p.servant.template?.name || 'Servant';
    const gutsIdx = p.activeBuffs ? p.activeBuffs.findIndex(b => b.type === 'guts') : -1;
    if (gutsIdx !== -1 && p.activeBuffs) {
      const gutsBuff = p.activeBuffs[gutsIdx] as any;
      const reviveHp = gutsBuff.value || Math.round(p.maxHp * 0.25);
      let gutsMsg = '';
      if (gutsBuff.remainingHits !== undefined && gutsBuff.remainingHits > 1) {
        gutsBuff.remainingHits -= 1;
        gutsMsg = `✝️ **[GUTS ACTIVATED!]** **${pName}** refused to fall! Revived with **${reviveHp.toLocaleString()} HP**! (${gutsBuff.name} - ${gutsBuff.remainingHits} left)`;
      } else {
        p.activeBuffs.splice(gutsIdx, 1);
        gutsMsg = `✝️ **[GUTS ACTIVATED!]** **${pName}** refused to fall! Revived with **${reviveHp.toLocaleString()} HP**! (${gutsBuff.name} consumed)`;
      }
      state.recentLogs.push(gutsMsg);
      p.currentHp = reviveHp;
      p.isDead = false;
      p.gutsTriggeredThisTurn = true;

      // Check for On-Guts Buster buff (Indomitable A)
      const onGutsIdx = p.activeBuffs.findIndex(b => b.type === 'on_guts_buster');
      if (onGutsIdx !== -1) {
        p.activeBuffs.splice(onGutsIdx, 1);
        p.activeBuffs.push({
          name: 'Indomitable A (On-Guts +20% Buster)',
          type: 'atk_up',
          value: 20,
          remainingTurns: 3
        });
        state.recentLogs.push(`🔥 **[INDOMITABLE A]** On-Guts triggered! Buster performance increased by **+20%**!`);
      }

      return { wasFatal: false, gutsTriggered: true, gutsLog: gutsMsg };
    } else {
      p.currentHp = 0;
      p.isDead = true;
      return { wasFatal: true, gutsTriggered: false };
    }
  }
  return { wasFatal: false, gutsTriggered: false };
}

async function concludeRaidVictory(
  battleMsg: any,
  boss: RaidBossConfig,
  battleState: RaidBattleState
) {
  const participants = battleState.participants;
  const sqReward = Math.floor(boss.drops.minSq + Math.random() * (boss.drops.maxSq - boss.drops.minSq + 1));
  const servantExpReward = boss.drops.servantExp || 25_000;

  const progressionReports: string[] = [];

  for (const p of participants) {
    const master = await getOrCreateMaster(p.userId, p.username);
    master.saintQuartz = (master.saintQuartz || 0) + sqReward;

    const s = master.servants?.find(s => s.id === p.servant.id);
    let sReport = `• <@${p.userId}> (**${p.servant.nickname || p.servant.template.name}**)`;

    if (s) {
      // 1. Servant Level EXP & Real Level-Up
      const expResult = addServantBattleExp(s, servantExpReward);
      s.experience = expResult.updatedServant.experience;
      s.level = expResult.updatedServant.level;
      s.availableStatPoints = expResult.updatedServant.availableStatPoints;

      let lvlDetail = `Lv. ${expResult.newLevel}`;
      if (expResult.didLevelUp) {
        lvlDetail += ` *(+${expResult.levelsGained} Level-Up! +${expResult.statPointsGained} Stat Points)*`;
      }

      sReport += `\n  └─ ⚔️ **Level:** \`${lvlDetail}\``;
    }

    // 2. Universal EXP Embers (Blaze of Wisdom) deposited directly to Master inventory
    master.craftEssences = master.craftEssences || [];
    const emberSSR = createExpEmberCraftEssence(5, 1);
    const emberSR1 = createExpEmberCraftEssence(4, 2);
    const emberSR2 = createExpEmberCraftEssence(4, 3);
    master.craftEssences.push(emberSSR, emberSR1, emberSR2);

    progressionReports.push(sReport);
    await saveMaster(master);
  }

  // Finishing Blow Section
  const fb = battleState.finishingBlow;
  let finishingBlowText = '';
  if (fb) {
    finishingBlowText = `🗡️ **Finishing Blow:**\n• Fatal Strike by **${fb.servantName}** (<@${fb.userId}>)\n• Dealt **${fb.damage.toLocaleString()} DMG** via \`[${fb.cardChain}]\` in **Round ${fb.round}**!\n\n`;
  }

  // Damage Contribution Leaderboard
  const sortedByDamage = [...participants].sort((a, b) => (b.totalDamageDealt || 0) - (a.totalDamageDealt || 0));
  const totalPartyDmg = sortedByDamage.reduce((acc, p) => acc + (p.totalDamageDealt || 0), 0) || 1;
  const damageContributionText = sortedByDamage.map((p, idx) => {
    const pName = p.servant.nickname || p.servant.template?.name || 'Servant';
    const dmg = p.totalDamageDealt || 0;
    const pct = Math.round((dmg / totalPartyDmg) * 100);
    const medal = idx === 0 ? '👑 MVP' : `#${idx + 1}`;
    return `• **[${medal}]** <@${p.userId}> (**${pName}**): **${dmg.toLocaleString()} DMG** (${pct}% of total raid damage)`;
  }).join('\n');

  // Recent Combat Log Summary
  const recentCombatLogText = (battleState.fullCombatLog || []).slice(-6).join('\n');

  const isTiamat = boss.id === 'tiamat';
  const victoryTitle = isTiamat
    ? '🏆 BEAST II TIAMAT VANQUISHED — RAID COMPLETE!'
    : '🏆 DEMON GOD PILLAR VANQUISHED — RAID COMPLETE!';
  const victoryHeader = isTiamat
    ? `**Beast II / Primordial Mother Tiamat** has been banished back into the depths of the Chaos Sea!\n\n`
    : `**Demon God Pillar Barbatos** has disintegrated into the void of the Temple of Time!\n\n`;

  const victoryEmbed = new EmbedBuilder()
    .setTitle(victoryTitle)
    .setDescription(
      `${victoryHeader}` +
      `${finishingBlowText}` +
      `📊 **Damage Contribution:**\n${damageContributionText}\n\n` +
      `💎 **Spoils of War (Distributed to all Masters):**\n` +
      `• **+${sqReward} Saint Quartz** 💎\n` +
      `• **+${servantExpReward.toLocaleString()} Servant Battle EXP** ⚔️ *(Levels up Servant & awards unspent Stat Points)*\n` +
      `• **+3 Universal EXP Embers** ✨ *(1x ★5 SSR + 2x ★4 SR Blaze of Wisdom synthesized to inventory for \`/feed\`)*\n\n` +
      `👑 **Victorious Masters & Progression:**\n` +
      progressionReports.join('\n') + `\n\n` +
      `📜 **Recent Battle Log:**\n${recentCombatLogText}`
    )
    .setImage(boss.avatarUrl)
    .setColor(0x10b981)
    .setFooter({ text: 'Fate/Grand Order PvE Raid Engine • Victory Recorded' });

  const logRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('raid_view_full_log')
      .setLabel('📜 Full Battle Log')
      .setStyle(ButtonStyle.Secondary)
  );

  let finalMsg: any = null;
  try {
    finalMsg = await battleMsg.edit({ embeds: [victoryEmbed], components: [logRow] });
  } catch {
    try {
      finalMsg = await battleMsg.channel.send({ embeds: [victoryEmbed], components: [logRow] });
    } catch {}
  }

  if (finalMsg) {
    const postCollector = finalMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (b: any) => b.customId === 'raid_view_full_log',
      time: 600_000
    });

    postCollector.on('collect', async (i: any) => {
      const fullLines = battleState.fullCombatLog || [];
      const logChunks: string[] = [];
      let cur = '';
      for (const line of fullLines) {
        if ((cur + '\n' + line).length > 3800) {
          logChunks.push(cur);
          cur = line;
        } else {
          cur = cur ? cur + '\n' + line : line;
        }
      }
      if (cur) logChunks.push(cur);

      const logEmbed = new EmbedBuilder()
        .setTitle(`📜 Complete Battle Log • ${boss.name}`)
        .setDescription(logChunks[0] || 'No events recorded.')
        .setColor(0x3b82f6)
        .setFooter({ text: `Total Battle Events: ${fullLines.length} • Fate/Grand Order PvE Raid` });

      await i.reply({
        embeds: [logEmbed],
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    });
  }
}

async function concludeRaidDefeat(
  battleMsg: any,
  boss: RaidBossConfig,
  battleState: RaidBattleState
) {
  const participants = battleState.participants;
  const sortedByDamage = [...participants].sort((a, b) => (b.totalDamageDealt || 0) - (a.totalDamageDealt || 0));
  const totalPartyDmg = sortedByDamage.reduce((acc, p) => acc + (p.totalDamageDealt || 0), 0) || 1;
  const damageContributionText = sortedByDamage.map((p, idx) => {
    const pName = p.servant.nickname || p.servant.template?.name || 'Servant';
    const dmg = p.totalDamageDealt || 0;
    const pct = Math.round((dmg / totalPartyDmg) * 100);
    return `• <@${p.userId}> (**${pName}**): **${dmg.toLocaleString()} DMG** (${pct}%)`;
  }).join('\n');

  const recentCombatLogText = (battleState.fullCombatLog || []).slice(-6).join('\n');
  const bossHpPct = Math.round((battleState.bossCurrentHp / battleState.bossMaxHp) * 100);

  const defeatEmbed = new EmbedBuilder()
    .setTitle('💀 RAID DEFEAT — PARTY WIPED')
    .setDescription(
      `All Servants have fallen to the incinerating mana of **${boss.name}** in **Round ${battleState.round}**.\n\n` +
      `💔 **Boss Health Remaining:** ❤️ **${Math.round(battleState.bossCurrentHp).toLocaleString()} / ${battleState.bossMaxHp.toLocaleString()} HP** (${bossHpPct}% Remaining)\n\n` +
      `📊 **Damage Contribution:**\n${damageContributionText}\n\n` +
      `📜 **Recent Battle Log:**\n${recentCombatLogText}\n\n` +
      `*Regroup at Chaldea, reinforce your Saint Graphs, and challenge ${boss.name} once more!*`
    )
    .setColor(0xef4444)
    .setFooter({ text: `${boss.name} Raid • Defeat` });

  const logRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('raid_view_full_log')
      .setLabel('📜 Full Battle Log')
      .setStyle(ButtonStyle.Secondary)
  );

  let finalMsg: any = null;
  try {
    finalMsg = await battleMsg.edit({ embeds: [defeatEmbed], components: [logRow] });
  } catch {
    try {
      finalMsg = await battleMsg.channel.send({ embeds: [defeatEmbed], components: [logRow] });
    } catch {}
  }

  if (finalMsg) {
    const postCollector = finalMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (b: any) => b.customId === 'raid_view_full_log',
      time: 600_000
    });

    postCollector.on('collect', async (i: any) => {
      const fullLines = battleState.fullCombatLog || [];
      const logChunks: string[] = [];
      let cur = '';
      for (const line of fullLines) {
        if ((cur + '\n' + line).length > 3800) {
          logChunks.push(cur);
          cur = line;
        } else {
          cur = cur ? cur + '\n' + line : line;
        }
      }
      if (cur) logChunks.push(cur);

      const logEmbed = new EmbedBuilder()
        .setTitle(`📜 Complete Battle Log • ${boss.name}`)
        .setDescription(logChunks[0] || 'No events recorded.')
        .setColor(0xef4444)
        .setFooter({ text: `Total Battle Events: ${fullLines.length} • Fate/Grand Order PvE Raid` });

      await i.reply({
        embeds: [logEmbed],
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    });
  }
}

function cleanBuffNameForDisplay(name: string): string {
  return name
    .replace(/Round of Avalon: The Promised Star Which Gathers The True Round/gi, 'Round of Avalon')
    .replace(/Strengthening Adaptation A\+/gi, 'Adaptation A+')
    .replace(/Calamity-Breaker Edict EX/gi, 'Calamity-Breaker')
    .replace(/Holy Sword Creation EX/gi, 'Holy Sword')
    .replace(/Charisma of Hope B/gi, 'Charisma of Hope')
    .replace(/Avalon le Fae A/gi, 'Avalon le Fae')
    .replace(/Self-Modification EX/gi, 'Self-Mod EX');
}

function buildRaidStatusEmbed(state: RaidBattleState, viewingUserId: string): EmbedBuilder {
  const boss = state.boss;
  const bossHpPct = Math.max(0, Math.round((state.bossCurrentHp / state.bossMaxHp) * 100));
  const chargeDiamonds = '◆'.repeat(state.bossCharge) + '◇'.repeat(Math.max(0, boss.maxCharge - state.bossCharge));

  const viewer = state.participants.find(p => p.userId === viewingUserId) || state.participants[state.activeMasterIndex];
  const vServant = viewer.servant;
  const vName = vServant.nickname || vServant.template?.name || 'Servant';
  const vClass = (vServant.template?.servantClass || 'Saber').toUpperCase();
  const vLvl = vServant.level || 90;
  const vHpPct = Math.max(0, Math.round((viewer.currentHp / viewer.maxHp) * 100));

  // Boss Traits & Active Buffs/Debuffs (compact)
  const bossTraitsStr = (boss.traits || ['threat_to_humanity', 'beast', 'demonic', 'giant']).slice(0, 4).map(t => `\`${t.replace(/_/g, ' ')}\``).join(' • ');
  const rawBossBuffs = state.bossBuffs || [];
  const bossBuffsList = (rawBossBuffs.length > 0)
    ? rawBossBuffs.slice(0, 5).map(b => {
        const isDebuff = b.type.includes('down') || b.type.includes('debuff') || ['stun', 'np_seal', 'curse', 'poison', 'burn'].includes(b.type);
        const icon = isDebuff ? '🔻' : '🔺';
        const sign = isDebuff ? '-' : '+';
        const formattedVal = ['stun', 'np_seal'].includes(b.type)
          ? ''
          : `: ${sign}${Math.abs(b.value)}${['curse', 'poison', 'burn'].includes(b.type) ? ' DMG/T' : '%'}`;
        return `• ${icon} **${cleanBuffNameForDisplay(b.name)}**${formattedVal} (${b.remainingTurns}T)`;
      }).join('\n') + (rawBossBuffs.length > 5 ? `\n• *...+${rawBossBuffs.length - 5} more*` : '')
    : `_No active status effects or debuffs on ${boss.name}._`;

  // Viewer's Active Buffs (compact)
  const rawVBuffs = viewer.activeBuffs || [];
  const vBuffsList = (rawVBuffs.length > 0)
    ? rawVBuffs.slice(0, 6).map(b => `• ✨ **${cleanBuffNameForDisplay(b.name)}**: +${b.value}% (${b.remainingTurns}T)`).join('\n') +
      (rawVBuffs.length > 6 ? `\n• *...+${rawVBuffs.length - 6} more active buffs*` : '')
    : '_Operating at baseline parameters (No active buffs)._';

  // Viewer's Skills & Cooldowns
  const skills = vServant.template?.skills || [];
  const sList = skills.map((s, idx) => {
    const cd = viewer.skillCooldowns[idx] || 0;
    const cdStr = cd > 0 ? `\`[⏱ ${cd}T]\`` : `\`[✨ READY]\``;
    const descShort = s.description.length > 70 ? s.description.slice(0, 67) + '...' : s.description;
    return `• **S${idx + 1}: ${s.name}** ${cdStr} — *${descShort}*`;
  }).join('\n') || '_No active skills._';

  // Allied Vanguard Roster (compact buffs)
  const partyRoster = state.participants.map(p => {
    const pName = p.servant.nickname || p.servant.template?.name || 'Servant';
    const isViewer = p.userId === viewer.userId;
    const arrow = isViewer ? '👉 ' : '• ';
    const hpStr = p.isDead ? '💀 FALLEN' : `${Math.round(p.currentHp).toLocaleString()}/${p.maxHp.toLocaleString()} HP (${Math.round((p.currentHp / p.maxHp) * 100)}%)`;
    const pBuffs = (p.activeBuffs || []).map(b => `\`${cleanBuffNameForDisplay(b.name)} (${b.remainingTurns}T)\``);
    const buffSummary = pBuffs.length > 0
      ? (pBuffs.length > 3 ? `${pBuffs.slice(0, 3).join(', ')} +${pBuffs.length - 3} more` : pBuffs.join(', '))
      : 'None';
    return `${arrow}**${pName}** (<@${p.userId}>): ❤️ \`${hpStr}\` • ⚡ \`NP: ${Math.round(p.npGauge)}%\`\n  └─ ✨ Buffs: ${buffSummary}`;
  }).join('\n\n');

  let fullDesc =
    `### 😈 Enemy Target: **${boss.name}**\n` +
    `• **Class:** \`${boss.servantClass.toUpperCase()}\` • Lv.${boss.level} • **${boss.title}**\n` +
    `• **Vitality:** ❤️ **${Math.round(state.bossCurrentHp).toLocaleString()} / ${state.bossMaxHp.toLocaleString()} HP** (${bossHpPct}%)\n` +
    `• **NP Gauge:** ⚡ \`[ ${chargeDiamonds} ]\` (${state.bossCharge}/${boss.maxCharge})\n` +
    `• **Traits:** ${bossTraitsStr}\n` +
    `• **Afflictions & Status:**\n${bossBuffsList}\n\n` +
    `---\n` +
    `### 🛡️ Your Servant: **${vName}** (<@${viewer.userId}>)\n` +
    `• **Class & Level:** \`${vClass}\` • Lv.${vLvl} • ❤️ **${Math.round(viewer.currentHp).toLocaleString()}/${viewer.maxHp.toLocaleString()} HP** (${vHpPct}%)\n` +
    `• **NP & Stars:** ⚡ **${Math.round(viewer.npGauge)}% NP** • ★ **${viewer.critStars || 0} Stars**\n\n` +
    `**Active Buffs:**\n${vBuffsList}\n\n` +
    `**Skills:**\n${sList}\n\n` +
    `---\n` +
    `### 👥 Allied Vanguard Party:\n` +
    partyRoster;

  // Enforce Discord embed description safety limit (hard 4096 character ceiling)
  if (fullDesc.length > 3950) {
    fullDesc = fullDesc.slice(0, 3900) + '\n\n*(Status truncated for length)*';
  }

  const embed = new EmbedBuilder()
    .setTitle(`📊 BATTLE STATUS & BUFF DOSSIER — ROUND ${state.round}`)
    .setDescription(fullDesc)
    .setColor(0x8b5cf6)
    .setThumbnail(vServant.cardArtUrl || vServant.avatarUrl || boss.avatarUrl)
    .setFooter({ text: 'Holy Grail War Tactical Engine • Real-Time Buff Inspection' });

  return embed;
}

