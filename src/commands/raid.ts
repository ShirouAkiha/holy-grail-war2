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
import { addBondExpToServant } from '../../lib/engine/bondEvents';

export const data = new SlashCommandBuilder()
  .setName('raid')
  .setDescription('Launch or join a cooperative PvE Demon God Pillar Raid Battle (1-4 Masters)')
  .addSubcommand(sub =>
    sub.setName('barbatos')
      .setDescription('Challenge Demon God Pillar Barbatos in the Solomon Temple of Time (Solo or 4P Co-op)')
  )
  .addSubcommand(sub =>
    sub.setName('info')
      .setDescription('View Demon God Pillar Barbatos raid mechanics, drops, and weaknesses')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand() || 'barbatos';

  if (subcommand === 'info') {
    const boss = RAID_BOSSES['barbatos'];
    const infoEmbed = new EmbedBuilder()
      .setTitle(`👑 PVE RAID: ${boss.name.toUpperCase()}`)
      .setDescription(
        `**Title:** ${boss.title}\n` +
        `**Class:** \`${boss.servantClass}\` • **Level:** \`${boss.level}\` • **HP:** \`${boss.baseHp.toLocaleString()}\`\n` +
        `**Max Charge:** \`◆ ◆ ◆ ◆ (4 Diamonds)\`\n\n` +
        `⚔️ **Raid Mechanics & Skills:**\n` +
        boss.skills.map(s => `• **${s.name}**: ${s.description}`).join('\n') +
        `\n• **Charge Attack**: **${boss.chargeAttack.name}** — ${boss.chargeAttack.description}\n\n` +
        `💎 **Victory Rewards (All Participating Masters):**\n` +
        `• Saint Quartz: **${boss.drops.minSq} – ${boss.drops.maxSq} SQ** 💎\n` +
        `• Servant Battle EXP: **+${boss.drops.servantExp.toLocaleString()} EXP** ⚔️ *(Levels up Servant & awards Stat Points!)*\n` +
        `• Servant Bond EXP: **+${boss.drops.bondExp.toLocaleString()} Bond EXP** 💖 *(Advances Bond Rank toward Bond 10 & Signature CEs!)*\n` +
        `• Relic Drops: **${boss.drops.emberCount}x Blaze of Wisdom EXP Embers** ✨ *(Universal enhancement relics for \`/feed\`)*`
      )
      .setThumbnail(boss.avatarUrl)
      .setColor(0x7c3aed)
      .setFooter({ text: 'Holy Grail War Engine • Chaldea Raid Protocol' });

    await interaction.reply({ embeds: [infoEmbed] });
    return;
  }

  // Barbatos Raid Initiation & Lobby
  await interaction.deferReply();

  const hostMaster = await getOrCreateMaster(interaction.user.id, interaction.user.username);
  const hostServant = hostMaster.servants?.find(s => s.id === hostMaster.activeServantId) || hostMaster.servants?.[0];

  if (!hostServant) {
    await interaction.editReply({
      content: '❌ You must summon a Servant before launching a PvE Raid! Invoke `/summon ritual` first.'
    });
    return;
  }

  const boss = RAID_BOSSES['barbatos'];

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

    return new EmbedBuilder()
      .setTitle(`⚔️ PVE RAID LOBBY: ${boss.name.toUpperCase()}`)
      .setDescription(
        `**Location:** Grand Temple of Time • Throne of Solomon\n` +
        `**Boss:** **${boss.name}** (\`${boss.servantClass}\` • Lv.${boss.level})\n` +
        `**Total Boss HP:** **${boss.baseHp.toLocaleString()} HP**\n\n` +
        `👥 **Raid Party Formation (${lobbyParticipants.length}/4 Masters):**\n` +
        `${partyList}\n\n` +
        `*Click **Join Raid** to bring your active Servant into the fight, or the host can launch immediately!*`
      )
      .setThumbnail(boss.avatarUrl)
      .setColor(0x9333ea)
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

  const lobbyMsg = await interaction.editReply({
    embeds: [buildLobbyEmbed()],
    components: [buildLobbyButtons()]
  });

  const lobbyCollector = lobbyMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120_000
  });

  lobbyCollector.on('collect', async (btn) => {
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

  lobbyCollector.on('end', async (_, reason) => {
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
  const scaledBossHp = Math.round(boss.baseHp * hpMultiplier);

  const battleState: RaidBattleState = {
    boss,
    bossCurrentHp: scaledBossHp,
    bossMaxHp: scaledBossHp,
    bossCharge: 0,
    round: 1,
    participants,
    activeMasterIndex: 0,
    recentLogs: [`⚡ **BATTLE COMMENCED!** Demon God Pillar Barbatos awakens in the Temple of Time!`],
    bossBuffs: [],
    fullCombatLog: [`⚡ **[Round 1]** Raid battle commenced against **Demon God Pillar Barbatos**!`]
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
    const bossEmbed = new EmbedBuilder()
      .setTitle(`🔥 APOCALYPTIC NOBLE PHANTASM: ${boss.chargeAttack.name.toUpperCase()}`)
      .setDescription(
        `👁️ **${boss.name}** (${boss.title})\n` +
        `> *“O Solomon, look upon our despair! From the cradle of incinerated time, we offer your demise!”*\n\n` +
        `Barbatos opens all 72 crimson eyes of the Solomon Spire, unleashing an apocalyptic wave of cursed demon god mana across the entire battlefield!`
      )
      .setColor(0x7c3aed)
      .setImage(boss.avatarUrl)
      .setFooter({ text: 'Demon God Pillar Raid • Cataclysmic Charge Attack' });

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
    const hand = active.currentHand || ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'];

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

    // Row 2: Noble Phantasm + Clear + Command Seal + Run (Exact layout from normal battles)
    const isNpReady = active.npGauge >= 100;
    const isNpSelected = pendingCards.includes('NP');
    const npType = active.servant.template?.noblePhantasm?.cardType || 'Buster';
    const hasPending = pendingCards.length > 0;
    const masterSeals = active.commandSeals !== undefined ? active.commandSeals : 3;

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('raid_card_np')
        .setLabel(isNpReady ? `NP [${npType}] (100%)` : `NP (${Math.round(active.npGauge)}%)`)
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
        .setCustomId('raid_flee')
        .setLabel('Run')
        .setEmoji('🏃')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(shouldDisableAll),
      new ButtonBuilder()
        .setCustomId('raid_status')
        .setLabel('Status')
        .setEmoji('📊')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(shouldDisableAll)
    );

    // Row 3: 3 Active Skills (Exact layout from normal battles)
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
        .setDisabled(shouldDisableAll || !isS3Unlocked || cd3 > 0 || !s3 || active.isDead)
    );

    return [row1, row2, row3];
  };

  const buildBattleEmbed = (attachmentFileName: string) => {
    const active = currentActiveParticipant;
    const servName = active.servant.nickname || active.servant.template?.name || 'Heroic Spirit';

    const cardEmojiMap: Record<string, string> = {
      Buster: '🔴 Buster (DMG)',
      Arts: '🔵 Arts (NP Gain)',
      Quick: '🟢 Quick (Crit Stars)',
      NP: '💥 Noble Phantasm'
    };

    const c1 = pendingCards[0] ? cardEmojiMap[pendingCards[0]] : '❓ Card 1';
    const c2 = pendingCards[1] ? cardEmojiMap[pendingCards[1]] : '❓ Card 2';
    const c3 = pendingCards[2] ? cardEmojiMap[pendingCards[2]] : '❓ Card 3';

    const bossHpPct = Math.max(0, Math.round((battleState.bossCurrentHp / battleState.bossMaxHp) * 100));
    const bossChargeStr = '◆'.repeat(battleState.bossCharge) + '◇'.repeat(Math.max(0, battleState.boss.maxCharge - battleState.bossCharge));

    const bossStatusList = (battleState.bossBuffs || []).map(b => {
      if (b.type === 'def_down') return `\`🔻 -${b.value}% DEF (${b.remainingTurns}T)\``;
      if (b.type === 'atk_down') return `\`🔻 -${b.value}% ATK (${b.remainingTurns}T)\``;
      if (b.type === 'atk_up') return `\`⚔️ +${b.value}% ATK (${b.remainingTurns}T)\``;
      if (b.type === 'def_up') return `\`🛡️ +${b.value}% DEF (${b.remainingTurns}T)\``;
      if (b.type === 'curse') return `\`🔥 Curse ${b.value} (${b.remainingTurns}T)\``;
      if (b.type === 'stun') return `\`⚡ STUN (${b.remainingTurns}T)\``;
      if (b.type === 'np_seal') return `\`🔒 NP SEAL (${b.remainingTurns}T)\``;
      return `\`${b.name} (${b.remainingTurns}T)\``;
    });
    const bossStatusStr = bossStatusList.length > 0 ? `\n   └ 🌀 **Boss Status:** ${bossStatusList.join(' ')}` : '';

    const partyLines = battleState.participants.map(p => {
      const pName = p.servant.nickname || p.servant.template?.name || 'Servant';
      const isTurn = p.userId === active.userId;
      const arrow = isTurn ? '👉 ' : '• ';
      const hpStr = p.isDead ? 'FALLEN' : `${Math.round(p.currentHp).toLocaleString()} HP`;

      const pDebuffs = (p.activeBuffs || []).filter(b => ['def_down', 'atk_down', 'curse', 'burn', 'poison', 'stun', 'np_seal', 'skill_seal'].includes(b.type)).map(b => {
        if (b.type === 'def_down') return `\`🔻 -${b.value}% DEF (${b.remainingTurns}T)\``;
        if (b.type === 'atk_down') return `\`🔻 -${b.value}% ATK (${b.remainingTurns}T)\``;
        if (b.type === 'curse') return `\`🔥 Curse ${b.value} (${b.remainingTurns}T)\``;
        if (b.type === 'stun') return `\`⚡ Stun (${b.remainingTurns}T)\``;
        return `\`${b.name} (${b.remainingTurns}T)\``;
      });
      const pBuffs = (p.activeBuffs || []).filter(b => !['def_down', 'atk_down', 'curse', 'burn', 'poison', 'stun', 'np_seal', 'skill_seal', 'on_guts_buster'].includes(b.type)).map(b => {
        if (b.type === 'guts') return `\`🩸 Guts ${(b as any).remainingHits && (b as any).remainingHits > 1 ? `x${(b as any).remainingHits}` : ''} (${b.value} HP)\``;
        if (b.type === 'evade') return `\`💨 Evade\``;
        if (b.type === 'invincible') return `\`✨ Invincible\``;
        if (b.type === 'atk_up') return `\`⚔️ +${b.value}% ATK (${b.remainingTurns}T)\``;
        if (b.type === 'def_up') return `\`🛡️ +${b.value}% DEF (${b.remainingTurns}T)\``;
        if (b.type === 'damage_cut') return `\`🛡️ Cut ${b.value} (${b.remainingTurns}T)\``;
        return `\`${b.name} (${b.remainingTurns}T)\``;
      });

      let subLine = '';
      if (pDebuffs.length > 0 && pBuffs.length > 0) {
        subLine = `\n   └ 🛑 ${pDebuffs.join(' ')} • 🛡️ ${pBuffs.join(' ')}`;
      } else if (pDebuffs.length > 0) {
        subLine = `\n   └ 🛑 Debuffs: ${pDebuffs.join(' ')}`;
      } else if (pBuffs.length > 0) {
        subLine = `\n   └ 🛡️ Buffs: ${pBuffs.join(' ')}`;
      }

      return `${arrow}**${pName}** (<@${p.userId}>): \`${hpStr}\` • \`NP: ${Math.round(p.npGauge)}%\` • \`★ ${p.critStars || 0}\`${subLine}`;
    }).join('\n');

    let logContent = '';
    if (battleState.lastPlayerAttackLog) {
      logContent = `⚔️ **Master Strike:**\n${battleState.lastPlayerAttackLog}`;
    }

    if (battleState.lastEnemyPhase) {
      const ep = battleState.lastEnemyPhase;
      const enemyLines: string[] = [];
      const dmgBreakdown = ep.curseDamage > 0 
        ? ` *(Strike: ${ep.strikeDamage.toLocaleString()} DMG • Curse: ${ep.curseDamage.toLocaleString()} DMG)*`
        : '';
      enemyLines.push(`• 💥 **Total Barbatos Turn DMG:** __**${ep.totalDamage.toLocaleString()} DMG**__${dmgBreakdown}`);

      if (ep.skillName) {
        const debuffsText = ep.debuffsInflicted.length > 0 ? ` ➔ Inflicted: ${ep.debuffsInflicted.join(', ')}` : '';
        const buffsText = ep.bossBuffsGained.length > 0 ? ` ➔ Gained: ${ep.bossBuffsGained.join(', ')}` : '';
        enemyLines.push(`• 👁️ **Skill Used:** **[${ep.skillName}]**${debuffsText}${buffsText}`);
      }
      if (ep.actionName) {
        const targetStr = ep.actionTarget ? ` on **${ep.actionTarget}**` : '';
        enemyLines.push(`• 👁️ **Action:** **${ep.actionName}**${targetStr} (Dealt **${ep.strikeDamage.toLocaleString()} DMG**)`);
      }
      if (ep.curseDamage > 0) {
        enemyLines.push(`• 🔥 **Curse Burn:** Sapped party for **${ep.curseDamage.toLocaleString()} Curse DMG**!`);
      }
      if (ep.specialEvents && ep.specialEvents.length > 0) {
        enemyLines.push(...ep.specialEvents);
      }
      logContent += `\n\n😈 **Enemy Phase:**\n${enemyLines.join('\n')}`;
    } else if (!battleState.lastPlayerAttackLog) {
      logContent = `📜 **Log:** ${battleState.recentLogs.slice(-3).join('\n')}`;
    }

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ DEMON GOD PILLAR RAID — ROUND ${battleState.round}`)
      .setDescription(
        `😈 **${battleState.boss.name}**\n` +
        `❤️ \`${Math.round(battleState.bossCurrentHp).toLocaleString()} / ${battleState.bossMaxHp.toLocaleString()}\` (${bossHpPct}%) • ⚡ Charge: \`[${bossChargeStr}]\`${bossStatusStr}\n\n` +
        `🛡️ **Party Status:**\n${partyLines}\n\n` +
        `🎴 **Selected Attack Chain (${pendingCards.length}/3):**\n` +
        `\`[ 1: ${c1} ]\` ➔ \`[ 2: ${c2} ]\` ➔ \`[ 3: ${c3} ]\`\n\n` +
        `${logContent}`
      )
      .setImage(`attachment://${attachmentFileName}`)
      .setColor(0x8b5cf6)
      .setFooter({ text: 'Fate/Grand Order PvE Raid • Select 3 Command Cards & Attack!' });

    return embed;
  };

  let currentCanvasFileName = '';

  const renderAndPostTurn = async () => {
    const { buffer, fileName } = await renderRaidBattlefield(battleState, false);
    const uniqueFileName = `raid_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
    currentCanvasFileName = uniqueFileName;
    const attachment = new AttachmentBuilder(buffer, { name: uniqueFileName });
    const embeds = [buildBattleEmbed(uniqueFileName)];
    const components = buildBattleButtons();
    const active = currentActiveParticipant;

    const channelToSend = interaction.channel || battleMsg?.channel;
    let newBattleMsg: any = null;

    if (channelToSend && typeof channelToSend.send === 'function') {
      try {
        newBattleMsg = await channelToSend.send({
          content: `⚔️ **<@${active.userId}>'s Turn!**`,
          embeds,
          files: [attachment],
          components
        });
      } catch (sendErr: any) {
        console.warn('[raid] channel.send fresh turn failed, falling back to in-place edit:', sendErr?.message || sendErr);
      }
    }

    if (newBattleMsg) {
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
        content: `⚔️ **<@${active.userId}>'s Turn!**`,
        embeds,
        files: [attachment],
        attachments: [], // Clears previous attachment cache in Discord so the new canvas renders!
        components
      }).catch(() => {});
    }
  };

  await renderAndPostTurn();

  const collector = battleMsg.channel.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (b: any) => b.customId.startsWith('raid_'),
    idle: 180_000,
    time: 1_800_000
  });

  collector.on('collect', async (i: any) => {
    if (isProcessingTurn && i.customId !== 'raid_status') {
      try {
        if (!i.replied && !i.deferred) {
          await i.deferUpdate().catch(() => {});
        }
      } catch {}
      return;
    }

    const safeUpdate = async (options: any) => {
      try {
        if (!i.replied && !i.deferred) {
          await i.update(options);
        } else {
          await i.editReply(options);
        }
      } catch (err: any) {
        if (
          err?.code === 10062 ||
          err?.code === 40060 ||
          err?.message?.includes('Unknown interaction') ||
          err?.message?.includes('already been acknowledged')
        ) {
          return;
        }
        console.warn('[raid] safeUpdate warning:', err);
      }
    };

    try {
      // 0. Status Inspection Dossier (Accessible by any Master at any time)
    if (i.customId === 'raid_status') {
      const statusEmbed = buildRaidStatusEmbed(battleState, i.user.id);
      await i.reply({
        embeds: [statusEmbed],
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
        embeds: [buildBattleEmbed(currentCanvasFileName)],
        components: buildBattleButtons()
      });
      return;
    } else if (i.customId.startsWith('raid_skill_')) {
      const sIdx = parseInt(i.customId.replace('raid_skill_', ''), 10);
      if (active.skillCooldowns[sIdx] === 0) {
        isProcessingTurn = true;
        try {
          const skillObj = active.servant.template?.skills?.[sIdx];
        const cd = skillObj?.cooldown || 5;
        active.skillCooldowns[sIdx] = cd;
        active.activeBuffs = active.activeBuffs || [];
        battleState.bossBuffs = battleState.bossBuffs || [];

        const sName = skillObj?.name || `Skill ${sIdx + 1}`;
        const sDesc = skillObj?.description || '';
        const sType = skillObj?.effectType || '';

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
        if (isAntiThreatSkill) {
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
          active.npGauge = Math.min(100, (active.npGauge || 0) + 10);
          buffLog = `(🔻 Inflicted **-30% DEF Down** on Barbatos for 3T, +10% NP, +10 Stars)`;
        } else if (isAtkDown) {
          battleState.bossBuffs.push({
            name: `${sName} (ATK Down)`,
            type: 'atk_down',
            value: 25,
            remainingTurns: 3
          });
          buffLog = `(🔻 Inflicted **-25% ATK Down** on Barbatos for 3T)`;
        } else if (isStun) {
          battleState.bossBuffs.push({
            name: `${sName} (Stun)`,
            type: 'stun',
            value: 100,
            remainingTurns: 1
          });
          buffLog = `(⚡ Inflicted **STUN** on Barbatos for 1 turn!)`;
        } else if (isNpDrainOrSeal) {
          battleState.bossCharge = Math.max(0, battleState.bossCharge - 1);
          battleState.bossBuffs.push({
            name: `${sName} (NP Seal)`,
            type: 'np_seal',
            value: 1,
            remainingTurns: 1
          });
          buffLog = `(⚡ Drained **1 Charge Diamond** & sealed Barbatos's NP for 1 turn!)`;
        } else if (isDot) {
          battleState.bossBuffs.push({
            name: `${sName} (Cursed Affliction)`,
            type: 'curse',
            value: 8000,
            remainingTurns: 3
          });
          buffLog = `(🔥 Inflicted **Curse/Burn** on Barbatos: **8,000 DMG/Turn** for 3T)`;
        } else if (isGeneralDebuff) {
          battleState.bossBuffs.push({
            name: `${sName} (DEF Down)`,
            type: 'def_down',
            value: 25,
            remainingTurns: 3
          });
          buffLog = `(🔻 Inflicted **-25% DEF Down** on Barbatos for 3T)`;
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
          active.npGauge = Math.min(100, (active.npGauge || 0) + 20);
          buffLog = `(💚 Restored +${healAmt.toLocaleString()} HP, +20% NP)`;
        } else {
          active.activeBuffs.push({
            name: `${sName} Buff`,
            type: 'atk_up',
            value: 30,
            remainingTurns: 3
          });
          active.critStars = (active.critStars || 0) + 15;
          active.npGauge = Math.min(100, (active.npGauge || 0) + 20);
          buffLog = `(+30% ATK, +20% NP, +15 Stars)`;
        }

        const quote = skillObj?.quote || skillObj?.quotes?.[0] || '';
        const quoteText = quote ? `\n> *${quote}*` : '';
        battleState.recentLogs.push(`✨ **${active.servant.nickname || active.servant.template.name}** invoked **${sName}**! ${buffLog}${quoteText}`);
        if (battleState.recentLogs.length > 4) battleState.recentLogs.shift();

        // Render updated canvas reflecting the new HP, NP, or buffs from the skill!
        const { buffer } = await renderRaidBattlefield(battleState, false);
        const uniqueFileName = `raid_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
        currentCanvasFileName = uniqueFileName;
        const attachment = new AttachmentBuilder(buffer, { name: uniqueFileName });

        await safeUpdate({
          embeds: [buildBattleEmbed(uniqueFileName)],
          files: [attachment],
          attachments: [],
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
        active.npGauge = 100;
        battleState.recentLogs.push(
          `🔱 <@${active.userId}> expended a **Command Seal** (${active.commandSeals} remaining)! **${active.servant.nickname || active.servant.template.name}** is fully healed and charged to **100% NP**!`
        );
        while (battleState.recentLogs.length > 8) battleState.recentLogs.shift();

        // Render updated canvas reflecting the restored HP and 100% NP!
        const { buffer } = await renderRaidBattlefield(battleState, false);
        const uniqueFileName = `raid_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
        currentCanvasFileName = uniqueFileName;
        const attachment = new AttachmentBuilder(buffer, { name: uniqueFileName });

        await safeUpdate({
          embeds: [buildBattleEmbed(uniqueFileName)],
          files: [attachment],
          attachments: [],
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

    // If fewer than 3 cards selected, update buttons and embed in-place with ZERO lag!
    if (pendingCards.length < 3) {
      await safeUpdate({
        embeds: [buildBattleEmbed(currentCanvasFileName)],
        components: buildBattleButtons()
      });
      return;
    }

    // 3 Cards selected -> Immediately update the message so the user sees Card 3 registered and all buttons disabled!
    isProcessingTurn = true;
    try {
      await safeUpdate({
        embeds: [buildBattleEmbed(currentCanvasFileName)],
        components: buildBattleButtons(true)
      });

      const usedNp = pendingCards.includes('NP');
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
      const atkBuffMult = 1 + ((active.activeBuffs?.filter(b => b.type === 'atk_up').reduce((acc, b) => acc + b.value, 0) || 0) / 100);

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
      let npDebuffNotice = '';

      pendingCards.forEach((card, cIdx) => {
        const stepMult = cIdx === 0 ? 1.0 : cIdx === 1 ? 1.2 : 1.4;

        // Calculate critical hit rate based on current star pool
        const baseCritMult = card === 'Buster' ? 2.0 : card === 'Arts' ? 1.8 : 2.2;
        let critPct = Math.round(starsAvailableForCrits * baseCritMult);
        if (isQuickFirstLead && cIdx > 0) critPct += 20;
        critPct = Math.min(100, Math.max(0, critPct));

        const isCrit = card !== 'NP' && (Math.random() * 100 < critPct);
        if (isCrit) totalCritsLanded++;

        const critDmgMult = isCrit ? 2.0 : 1.0;
        const critNpBonus = isCrit ? 1.5 : 1.0;
        const critStarBonus = isCrit ? 1.4 : 1.0;

        if (card === 'Buster') {
          totalTurnDmg += Math.round(baseAtk * 1.5 * stepMult * atkBuffMult * specialAtkMult * bossDefFactor * critDmgMult * (0.9 + Math.random() * 0.2));
          starsGenerated += Math.round(3 * critStarBonus);
          npGained += Math.round(5 * critNpBonus);
        } else if (card === 'Arts') {
          totalTurnDmg += Math.round(baseAtk * 1.0 * stepMult * atkBuffMult * specialAtkMult * bossDefFactor * critDmgMult * (0.9 + Math.random() * 0.2));
          npGained += Math.round(25 * critNpBonus);
          starsGenerated += Math.round(2 * critStarBonus);
        } else if (card === 'Quick') {
          totalTurnDmg += Math.round(baseAtk * 0.8 * stepMult * atkBuffMult * specialAtkMult * bossDefFactor * critDmgMult * (0.9 + Math.random() * 0.2));
          starsGenerated += Math.round(12 * critStarBonus);
          npGained += Math.round(10 * critNpBonus);
        } else if (card === 'NP') {
          const npMultiplier = active.servant.template?.noblePhantasm?.multiplier ?? 5.5;
          const npDesc = active.servant.template?.noblePhantasm?.description || '';
          const npName = active.servant.template?.noblePhantasm?.name || 'Noble Phantasm';
          const npTarget = active.servant.template?.noblePhantasm?.target || 'single';
          const sName = active.servant.template?.name || active.servant.nickname || '';

          const isSupportNp = npTarget === 'support' || npMultiplier === 0 || /party invincib|grant.*invincib|invincible|luminos|jeanne/i.test(npName + ' ' + npDesc + ' ' + sName);

          if (isSupportNp) {
            // Party Invincibility, DEF Up (+30% 3T), Debuff Cleanse & Heal (+3,000 HP) to ALL living allies in the raid!
            battleState.participants.forEach(p => {
              if (!p.isDead) {
                p.activeBuffs = p.activeBuffs || [];
                // Cleanse debuffs
                p.activeBuffs = p.activeBuffs.filter(b => !['def_down', 'atk_down', 'curse', 'burn', 'poison', 'stun', 'np_seal', 'skill_seal'].includes(b.type));

                // Grant Invincibility for 1 Turn
                p.activeBuffs.push({
                  name: `${npName} (Invincibility)`,
                  type: 'invincible',
                  value: 1,
                  remainingTurns: 1
                });

                // Grant +30% DEF Up for 3 Turns
                p.activeBuffs.push({
                  name: `${npName} (DEF Up)`,
                  type: 'def_up',
                  value: 30,
                  remainingTurns: 3
                });

                // Recovers +3,000 HP
                p.currentHp = Math.min(p.maxHp, p.currentHp + 3000);
              }
            });
            npDebuffNotice += ` 🕊️ **[LUMINOSITÉ ÉTERNELLE: Party Invincibility (1T), +30% DEF (3T), Debuff Cleanse & +3,000 HP Heal to ALL Allies!]**`;
            starsGenerated += 15;
            npGained += 20;
          } else {
            const npHasAntiThreat = /Threat to Humanity|Beast|Divine|Foreigner/i.test(npDesc);
            const npSpecialMult = (isBossThreat && npHasAntiThreat) ? 1.5 : 1.0;
            if (isBossThreat && npHasAntiThreat) npTriggeredAntiThreat = true;

            // Apply secondary debuffs from Noble Phantasm to Barbatos
            battleState.bossBuffs = battleState.bossBuffs || [];
            if (/def.*down|lower.*def|reduce.*def|decrease.*def/i.test(npDesc)) {
              battleState.bossBuffs.push({
                name: `${npName} (DEF Down)`,
                type: 'def_down',
                value: 30,
                remainingTurns: 3
              });
              npDebuffNotice += ' 🔻 [-30% DEF Down]';
            }
            if (/curse|burn|poison/i.test(npDesc)) {
              battleState.bossBuffs.push({
                name: `${npName} (Affliction)`,
                type: 'curse',
                value: 6000,
                remainingTurns: 3
              });
              npDebuffNotice += ' 🔥 [Curse/Burn]';
            }
            if (/stun|paraly|charm/i.test(npDesc)) {
              battleState.bossBuffs.push({
                name: `${npName} (Stun)`,
                type: 'stun',
                value: 100,
                remainingTurns: 1
              });
              npDebuffNotice += ' ⚡ [Stun]';
            }
            if (/drain|seal/i.test(npDesc)) {
              battleState.bossCharge = Math.max(0, battleState.bossCharge - 1);
              battleState.bossBuffs.push({
                name: `${npName} (NP Drain)`,
                type: 'np_seal',
                value: 1,
                remainingTurns: 1
              });
              npDebuffNotice += ' 🔒 [NP Drained]';
            }

            totalTurnDmg += Math.round(baseAtk * npMultiplier * atkBuffMult * specialAtkMult * bossDefFactor * npSpecialMult * (0.95 + Math.random() * 0.1));
            starsGenerated += 10;
            npGained += 15;
          }
        }
      });

      battleState.bossCurrentHp = Math.max(0, battleState.bossCurrentHp - totalTurnDmg);
      active.npGauge = Math.min(100, (active.npGauge || 0) + npGained);
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
      if (bossDefDown > 0) {
        traitLog += ` 🔻 **[DEF Down: +${Math.round(bossDefDown * 100)}% DMG]**`;
      }
      if (npDebuffNotice) {
        traitLog += npDebuffNotice;
      }

      const playerAttackLog = `⚔️ **${servName}** dealt **${totalTurnDmg.toLocaleString()} DMG** to Barbatos! (+${npGained}% NP, +${starsGenerated} Stars)${traitLog}`;
      battleState.lastPlayerAttackLog = playerAttackLog;
      battleState.recentLogs.push(playerAttackLog);
      while (battleState.recentLogs.length > 8) battleState.recentLogs.shift();

      active.totalDamageDealt = (active.totalDamageDealt || 0) + totalTurnDmg;
      battleState.fullCombatLog = battleState.fullCombatLog || [];
      battleState.fullCombatLog.push(
        `⚔️ **[Round ${battleState.round}]** **${servName}** (<@${active.userId}>) struck with \`[${pendingCards.join(' ➔ ')}]\` dealing **${totalTurnDmg.toLocaleString()} DMG**! *(Barbatos HP: ${battleState.bossCurrentHp.toLocaleString()} / ${battleState.bossMaxHp.toLocaleString()})*`
      );

      if (battleState.bossCurrentHp <= 0) {
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

      // Refresh hand for this participant and clear selections
      refreshParticipantHand(active);
      pendingCards = [];
      pendingIndices = [];

      const hasMorePlayersInRound = advanceToNextPlayer();

      let bossUsedNp = false;
      if (!hasMorePlayersInRound) {
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
      }

      await renderAndPostTurn();

      // Dispatch Noble Phantasm Visuals BELOW the newly rendered Battle Canvas!
      if (pendingNpToDispatch) {
        await dispatchRaidNpGif(pendingNpToDispatch.servant, pendingNpToDispatch.userId);
      } else if (bossUsedNp) {
        await dispatchBossNpGif();
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

  // Check Stun on Barbatos
  const isBossStunned = state.bossBuffs.some(b => b.type === 'stun');
  if (isBossStunned) {
    state.recentLogs.push('⚡ **[STUNNED!] Barbatos is paralyzed and unable to act this turn!**');
    enemyPhase.specialEvents.push('⚡ **[STUNNED!]** Barbatos was paralyzed by Stun and could not act!');
    state.lastEnemyPhase = enemyPhase;
    const dotDmg = state.bossBuffs.filter(b => b.type === 'curse' || b.type === 'burn' || b.type === 'poison').reduce((acc, b) => acc + b.value, 0);
    if (dotDmg > 0) {
      state.bossCurrentHp = Math.max(0, state.bossCurrentHp - dotDmg);
      state.recentLogs.push(`🔥 Barbatos took **${dotDmg.toLocaleString()} Affliction DoT DMG**!`);
    }
    state.bossBuffs.forEach(b => b.remainingTurns--);
    state.bossBuffs = state.bossBuffs.filter(b => b.remainingTurns > 0);
    if (state.recentLogs.length > 8) state.recentLogs.shift();
    return { bossUsedNp: false };
  }

  // 2. Action 1: Demonic Tactical Skill
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
    enemyPhase.debuffsInflicted.push('🔻 **-20% DEF Down (2T)** on all Servants', '⭐ **-10 Critical Stars drained**');
    state.recentLogs.push(
      `👁️ **Barbatos cast [Gaze of the Thousand Eyes]!** All Servants suffer **-20% DEF** (2T) and lost 10 Critical Stars!`
    );
  } else if (skillRoll < 0.70) {
    // Skill 2: Wailing of the Inverted Spire (+25% ATK, +1 Charge Diamond)
    state.bossBuffs.push({
      name: 'Wailing of the Spire',
      type: 'atk_up',
      value: 25,
      remainingTurns: 2
    });
    state.bossCharge = Math.min(state.boss.maxCharge, state.bossCharge + 1);
    enemyPhase.skillName = 'Wailing of the Inverted Spire';
    enemyPhase.skillDesc = 'Increases own ATK by +25% (2T) and charges NP gauge by 1 diamond';
    enemyPhase.bossBuffsGained.push('⚔️ **+25% ATK Up (2T)**', '⚡ **+1 NP Charge Diamond**');
    state.recentLogs.push(
      `📢 **Barbatos cast [Wailing of the Inverted Spire]!** Demon God ATK increased by **+25%** and gained **+1 Charge Diamond**!`
    );
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
      enemyPhase.debuffsInflicted.push(`🔥 **Curse (1,200 DMG/T, 3T)** on **${tName}**`, `🔻 **-20% ATK Down (2T)** on **${tName}**`);
      state.recentLogs.push(
        `☠️ **Barbatos cast [Curse of the Solomon Throne]!** Inflicted **Curse** (1,200 DMG/Turn) & **-20% ATK Down** on **${tName}**!`
      );
    }
  }

  // Charge progression (+1 normal charge; +2 if enraged)
  const isNpSealed = state.bossBuffs.some(b => b.type === 'np_seal');
  if (!isNpSealed) {
    state.bossCharge = Math.min(state.boss.maxCharge, state.bossCharge + (isEnraged ? 2 : 1));
  } else {
    state.recentLogs.push('🔒 **[NP SEALED!] Barbatos is sealed and cannot charge its NP!**');
    enemyPhase.specialEvents.push('🔒 **[NP SEALED]** Barbatos was sealed and could not charge its NP diamond!');
  }

  let bossUsedNp = false;

  // 3. Action 2: Attack or Noble Phantasm
  if (state.bossCharge >= state.boss.maxCharge && !isNpSealed) {
    // DEVASTATING NOBLE PHANTASM: Incineration Ritual — Barbatos Calamity!
    bossUsedNp = true;
    state.bossCharge = 0;
    const baseAoeDamage = Math.round((14500 + Math.random() * 3000) * totalBossAtkMult);
    let evadesCount = 0;
    enemyPhase.actionName = 'NOBLE PHANTASM: Incineration Ritual — Barbatos Calamity';
    enemyPhase.actionTarget = 'ALL Servants';

    state.participants.forEach(p => {
      if (!p.isDead) {
        // Check for Evade / Invincibility
        const evIdx = p.activeBuffs ? p.activeBuffs.findIndex(b => b.type === 'evade' || b.type === 'invincible') : -1;
        if (evIdx >= 0 && p.activeBuffs) {
          p.activeBuffs.splice(evIdx, 1);
          evadesCount++;
          const pName = p.servant.nickname || p.servant.template?.name || 'Servant';
          enemyPhase.specialEvents.push(`🛡️ **${pName}** completely EVADED Barbatos's Noble Phantasm!`);
          return;
        }

        // Damage Cut & Defense modifiers
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

        // Calamity Curse Burn
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
  } else {
    // Normal attack (1 target for solo, up to 2 targets for teams)
    const targetsToHit = livingParticipants.length >= 3 ? 2 : 1;
    const shuffled = [...livingParticipants].sort(() => 0.5 - Math.random());
    const hitTargetNames: string[] = [];

    enemyPhase.actionName = 'Demonic Gaze Strike';

    for (let i = 0; i < Math.min(targetsToHit, shuffled.length); i++) {
      const target = shuffled[i];
      if (target.isDead) continue;

      const tName = target.servant.nickname || target.servant.template?.name || 'Servant';
      hitTargetNames.push(tName);
      const evIdx = target.activeBuffs ? target.activeBuffs.findIndex(b => b.type === 'evade' || b.type === 'invincible') : -1;

      if (evIdx >= 0 && target.activeBuffs) {
        target.activeBuffs.splice(evIdx, 1);
        state.recentLogs.push(
          `🛡️ **[EVADED!]** **${tName}** read the trajectory and completely avoided Barbatos's strike!`
        );
        enemyPhase.specialEvents.push(`🛡️ **${tName}** EVADED Barbatos's Demonic Gaze!`);
        continue;
      }

      const dmgCut = target.activeBuffs?.filter(b => b.type === 'damage_cut').reduce((acc, b) => acc + b.value, 0) || 0;
      const defDown = target.activeBuffs?.filter(b => b.type === 'def_down').reduce((acc, b) => acc + b.value, 0) || 0;
      const defUp = target.activeBuffs?.filter(b => b.type === 'def_up').reduce((acc, b) => acc + b.value, 0) || 0;
      const defFactor = Math.max(0.4, 1 + (defDown - defUp) / 100);

      const baseSingle = Math.round((4800 + Math.random() * 2600) * totalBossAtkMult);
      const finalDmg = Math.max(800, Math.round((baseSingle * defFactor) - dmgCut));
      enemyPhase.strikeDamage += finalDmg;

      state.recentLogs.push(
        `👁️ Barbatos struck **${tName}** with Demonic Gaze for **${finalDmg.toLocaleString()} DMG**!`
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
        if (p.gutsTriggeredThisTurn) {
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

  // Record enemy turn events in fullCombatLog
  state.fullCombatLog = state.fullCombatLog || [];
  if (enemyPhase.skillName) {
    const details = enemyPhase.debuffsInflicted.concat(enemyPhase.bossBuffsGained).join(', ') || enemyPhase.skillDesc;
    state.fullCombatLog.push(`👁️ **[Round ${state.round}]** Barbatos cast **[${enemyPhase.skillName}]** (${details})`);
  }
  if (enemyPhase.actionName) {
    state.fullCombatLog.push(`💥 **[Round ${state.round}]** Barbatos attacked with **${enemyPhase.actionName}** dealing **${enemyPhase.strikeDamage.toLocaleString()} DMG** to ${enemyPhase.actionTarget || 'party'}`);
  }
  if (enemyPhase.curseDamage > 0) {
    state.fullCombatLog.push(`🔥 **[Round ${state.round}]** Curse Burn inflicted **${enemyPhase.curseDamage.toLocaleString()} DoT DMG**`);
  }
  enemyPhase.specialEvents.forEach(evt => {
    state.fullCombatLog!.push(`🛡️ **[Round ${state.round}]** ${evt}`);
  });

  // End-of-round Curse / Burn / Poison DoT damage on Barbatos
  const bossDotDmg = state.bossBuffs.filter(b => b.type === 'curse' || b.type === 'burn' || b.type === 'poison').reduce((acc, b) => acc + b.value, 0);
  if (bossDotDmg > 0) {
    state.bossCurrentHp = Math.max(0, state.bossCurrentHp - bossDotDmg);
    state.recentLogs.push(`🔥 Barbatos took **${bossDotDmg.toLocaleString()} Affliction DoT DMG**!`);
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
  const bondExpReward = boss.drops.bondExp || 2_000;

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

      // 2. Servant Bond EXP & Real Bond Level Progression
      const bondResult = addBondExpToServant(s, bondExpReward);
      s.bondExp = bondResult.updatedServant.bondExp;
      s.bondLevel = bondResult.updatedServant.bondLevel;

      let bondDetail = `Bond Lv. ${bondResult.newLevel}/10`;
      if (bondResult.didLevelUp) {
        bondDetail += ` *(Bond Level Up!)*`;
      }

      sReport += `\n  └─ ⚔️ **Level:** \`${lvlDetail}\` • 💖 **Bond:** \`${bondDetail}\``;

      if (bondResult.unlockedBondCe) {
        master.craftEssences = master.craftEssences || [];
        master.craftEssences.push(bondResult.unlockedBondCe);
        sReport += `\n  └─ 🌟 **UNLOCKED SIGNATURE BOND CE:** **${bondResult.unlockedBondCe.name}**!`;
      }
    }

    // 3. Universal EXP Embers (Blaze of Wisdom) deposited directly to Master inventory
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

  const victoryEmbed = new EmbedBuilder()
    .setTitle('🏆 DEMON GOD PILLAR VANQUISHED — RAID COMPLETE!')
    .setDescription(
      `**Demon God Pillar Barbatos** has disintegrated into the void of the Temple of Time!\n\n` +
      `${finishingBlowText}` +
      `📊 **Damage Contribution:**\n${damageContributionText}\n\n` +
      `💎 **Spoils of War (Distributed to all Masters):**\n` +
      `• **+${sqReward} Saint Quartz** 💎\n` +
      `• **+${servantExpReward.toLocaleString()} Servant Battle EXP** ⚔️ *(Levels up Servant & awards unspent Stat Points)*\n` +
      `• **+${bondExpReward.toLocaleString()} Servant Bond EXP** 💖 *(Advances Bond Rank toward Bond 10 & Signature CEs)*\n` +
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
      `*Regroup at Chaldea, reinforce your Saint Graphs, and challenge the Demon God Pillar once more!*`
    )
    .setColor(0xef4444)
    .setFooter({ text: 'Demon God Pillar Raid • Defeat' });

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

  // Boss Traits & Active Buffs/Debuffs
  const bossTraitsStr = (boss.traits || ['threat_to_humanity', 'beast', 'demonic', 'giant']).map(t => `\`${t.replace(/_/g, ' ')}\``).join(' • ');
  const bossBuffsList = (state.bossBuffs && state.bossBuffs.length > 0)
    ? state.bossBuffs.map(b => {
        const isDebuff = b.type.includes('down') || b.type.includes('debuff') || ['stun', 'np_seal', 'curse', 'poison', 'burn'].includes(b.type);
        const icon = isDebuff ? '🔻' : '🔺';
        const sign = isDebuff ? '-' : '+';
        const formattedVal = ['stun', 'np_seal'].includes(b.type)
          ? ''
          : `: ${sign}${Math.abs(b.value)}${['curse', 'poison', 'burn'].includes(b.type) ? ' DMG/Turn' : '%'}`;
        return `• ${icon} **${b.name}**${formattedVal} (${b.remainingTurns} turn(s) left)`;
      }).join('\n')
    : '_No active status effects or debuffs applied to the Demon God Pillar._';

  // Viewer's Active Buffs
  const vBuffsList = (viewer.activeBuffs && viewer.activeBuffs.length > 0)
    ? viewer.activeBuffs.map(b => `• ✨ **${b.name}**: +${b.value}% (${b.remainingTurns} turn(s) left)`).join('\n')
    : '_Operating at baseline battle parameters (No active buffs or debuffs)._';

  // Viewer's Skills & Cooldowns
  const skills = vServant.template?.skills || [];
  const sList = skills.map((s, idx) => {
    const cd = viewer.skillCooldowns[idx] || 0;
    const cdStr = cd > 0 ? `\`[⏱ ${cd}T Cooldown]\`` : `\`[✨ READY]\``;
    return `• **S${idx + 1}: ${s.name}** ${cdStr}\n  └─ *${s.description}*`;
  }).join('\n') || '_No active skills found._';

  // Allied Vanguard Roster
  const partyRoster = state.participants.map(p => {
    const pName = p.servant.nickname || p.servant.template?.name || 'Servant';
    const isViewer = p.userId === viewer.userId;
    const arrow = isViewer ? '👉 ' : '• ';
    const hpStr = p.isDead ? '💀 FALLEN' : `${Math.round(p.currentHp).toLocaleString()} / ${p.maxHp.toLocaleString()} HP (${Math.round((p.currentHp / p.maxHp) * 100)}%)`;
    const buffCount = p.activeBuffs?.length || 0;
    const buffSummary = buffCount > 0 ? p.activeBuffs!.map(b => `\`${b.name} (${b.remainingTurns}T)\``).join(', ') : 'None';
    return `${arrow}**${pName}** (<@${p.userId}>):\n  └─ ❤️ \`${hpStr}\` • ⚡ \`NP: ${Math.round(p.npGauge)}%\` • ★ \`${p.critStars || 0}\`\n  └─ ✨ Buffs: ${buffSummary}`;
  }).join('\n\n');

  const embed = new EmbedBuilder()
    .setTitle(`📊 BATTLE STATUS & BUFF DOSSIER — ROUND ${state.round}`)
    .setDescription(
      `### 😈 Enemy Raid Target: **${boss.name}**\n` +
      `• **Class & Rank:** \`${boss.servantClass.toUpperCase()}\` • Lv.${boss.level} • **${boss.title}**\n` +
      `• **Vitality:** ❤️ **${Math.round(state.bossCurrentHp).toLocaleString()} / ${state.bossMaxHp.toLocaleString()} HP** (${bossHpPct}%)\n` +
      `• **Noble Phantasm Gauge:** ⚡ \`[ ${chargeDiamonds} ]\` (${state.bossCharge}/${boss.maxCharge} Charge)\n` +
      `• **Classification Traits:** ${bossTraitsStr}\n` +
      `• **Afflictions & Active Status:**\n${bossBuffsList}\n\n` +
      `---\n` +
      `### 🛡️ Your Servant: **${vName}** (<@${viewer.userId}>)\n` +
      `• **Class & Level:** \`${vClass}\` • Lv.${vLvl}\n` +
      `• **Health:** ❤️ **${Math.round(viewer.currentHp).toLocaleString()} / ${viewer.maxHp.toLocaleString()} HP** (${vHpPct}%)\n` +
      `• **NP & Critical:** ⚡ **${Math.round(viewer.npGauge)}% NP** • ★ **${viewer.critStars || 0} Critical Stars**\n\n` +
      `**Active Buffs & Modifiers:**\n${vBuffsList}\n\n` +
      `**Skill Protocols & Readiness:**\n${sList}\n\n` +
      `---\n` +
      `### 👥 Allied Vanguard Party Overview:\n` +
      partyRoster
    )
    .setColor(0x8b5cf6)
    .setThumbnail(vServant.cardArtUrl || vServant.avatarUrl || boss.avatarUrl)
    .setFooter({ text: 'Holy Grail War Tactical Engine • Real-Time Buff Inspection' });

  return embed;
}

