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
        `• Saint Quartz: **${boss.drops.minSq} – ${boss.drops.maxSq} SQ**\n` +
        `• QP: **${boss.drops.minQp.toLocaleString()} – ${boss.drops.maxQp.toLocaleString()} QP**\n` +
        `• Bond EXP: **+${boss.drops.bondExp.toLocaleString()}** • Master EXP: **+${boss.drops.masterExp.toLocaleString()}**\n` +
        `• Rare Materials: ${boss.drops.materials.join(', ')}`
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
    const alloc = s.allocatedStats || {};
    const baseStats = t.baseStats || { strength: 10, endurance: 10, agility: 10, mana: 10, luck: 10 };
    const totalEnd = (baseStats.endurance || 10) + (alloc.endurance || 0);
    const ceHp = s.equippedCe?.hpBonus || 0;
    const calculatedMaxHp = s.maxHp || Math.round((t.baseHp || 28000) + totalEnd * 150 + ceHp);
    const currentHp = (s.currentHp !== undefined && s.currentHp > 0)
      ? Math.min(calculatedMaxHp, Math.round(s.currentHp))
      : calculatedMaxHp;

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
      activeBuffs: [],
      isDead: false
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
    recentLogs: [`⚡ **BATTLE COMMENCED!** Demon God Pillar Barbatos awakens in the Temple of Time!`]
  };

  let pendingCards: ('Buster' | 'Arts' | 'Quick' | 'NP')[] = [];
  let pendingIndices: number[] = [];
  let currentActiveParticipant = battleState.participants[battleState.activeMasterIndex];

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

  const buildBattleButtons = () => {
    const active = currentActiveParticipant;
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
            .setDisabled(pendingCards.length >= 3 || active.isDead)
        );
      }
    });

    // Row 2: Noble Phantasm + Clear + Command Seal + Run (Exact layout from normal battles)
    const isNpReady = active.npGauge >= 100;
    const isNpSelected = pendingCards.includes('NP');
    const npType = active.servant.template?.noblePhantasm?.cardType || 'Buster';
    const hasPending = pendingCards.length > 0;
    const masterSeals = active.master?.commandSeals ?? 3;

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('raid_card_np')
        .setLabel(isNpReady ? `NP [${npType}] (100%)` : `NP (${Math.round(active.npGauge)}%)`)
        .setEmoji(isNpReady ? '💥' : (npType === 'Buster' ? '🔴' : npType === 'Arts' ? '🔵' : '🟢'))
        .setStyle(isNpReady ? ButtonStyle.Danger : ButtonStyle.Secondary)
        .setDisabled(!isNpReady || isNpSelected || pendingCards.length >= 3 || active.isDead),
      new ButtonBuilder()
        .setCustomId('raid_reset_cards')
        .setLabel('Clear')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!hasPending),
      new ButtonBuilder()
        .setCustomId('raid_command_seal')
        .setLabel(`Seal (${masterSeals})`)
        .setEmoji('🔱')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(masterSeals <= 0 || active.isDead),
      new ButtonBuilder()
        .setCustomId('raid_flee')
        .setLabel('Run')
        .setEmoji('🏃')
        .setStyle(ButtonStyle.Secondary)
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
        .setDisabled(cd1 > 0 || !s1 || active.isDead)
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
        .setDisabled(cd2 > 0 || !s2 || active.isDead)
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
        .setDisabled(!isS3Unlocked || cd3 > 0 || !s3 || active.isDead)
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

    const recent = battleState.recentLogs.slice(-2).join('\n');
    const bossHpPct = Math.max(0, Math.round((battleState.bossCurrentHp / battleState.bossMaxHp) * 100));
    const bossChargeStr = '◆'.repeat(battleState.bossCharge) + '◇'.repeat(Math.max(0, battleState.boss.maxCharge - battleState.bossCharge));

    const partyLines = battleState.participants.map(p => {
      const pName = p.servant.nickname || p.servant.template?.name || 'Servant';
      const isTurn = p.userId === active.userId;
      const arrow = isTurn ? '👉 ' : '• ';
      const hpStr = p.isDead ? 'FALLEN' : `${Math.round(p.currentHp).toLocaleString()} HP`;
      return `${arrow}**${pName}** (<@${p.userId}>): \`${hpStr}\` • \`NP: ${Math.round(p.npGauge)}%\` • \`★ ${p.critStars || 0}\``;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ DEMON GOD PILLAR RAID — ROUND ${battleState.round}`)
      .setDescription(
        `😈 **${battleState.boss.name}**\n` +
        `❤️ \`${Math.round(battleState.bossCurrentHp).toLocaleString()} / ${battleState.bossMaxHp.toLocaleString()}\` (${bossHpPct}%) • ⚡ Charge: \`[${bossChargeStr}]\`\n\n` +
        `🛡️ **Party Status:**\n${partyLines}\n\n` +
        `🎴 **Selected Attack Chain (${pendingCards.length}/3):**\n` +
        `\`[ 1: ${c1} ]\` ➔ \`[ 2: ${c2} ]\` ➔ \`[ 3: ${c3} ]\`\n\n` +
        `📜 **Log:** ${recent}`
      )
      .setImage(`attachment://${attachmentFileName}`)
      .setColor(0x8b5cf6)
      .setFooter({ text: 'Fate/Grand Order PvE Raid • Select 3 Command Cards & Attack!' });

    return embed;
  };

  const renderAndPostTurn = async () => {
    const { buffer, fileName } = await renderRaidBattlefield(battleState, false);
    const uniqueFileName = `raid_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
    const attachment = new AttachmentBuilder(buffer, { name: uniqueFileName });
    const embeds = [buildBattleEmbed(uniqueFileName)];
    const components = buildBattleButtons();
    const active = currentActiveParticipant;

    let newMsg: any = null;
    try {
      newMsg = await battleMsg.channel.send({
        content: `⚔️ **<@${active.userId}>'s Turn!**`,
        embeds,
        files: [attachment],
        components
      });
    } catch {
      newMsg = null;
    }

    if (newMsg) {
      const prevMsg = battleMsg;
      battleMsg = newMsg;
      if (prevMsg && typeof prevMsg.delete === 'function') {
        await prevMsg.delete().catch(() => {});
      }
    } else {
      await battleMsg.edit({
        content: `⚔️ **<@${active.userId}>'s Turn!**`,
        embeds,
        files: [attachment],
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
    // 1. Immediately clean up active NP GIF whenever any button is clicked
    await cleanupNpGif();

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
      await i.deferUpdate();
      await renderAndPostTurn();
      return;
    } else if (i.customId.startsWith('raid_skill_')) {
      const sIdx = parseInt(i.customId.replace('raid_skill_', ''), 10);
      if (active.skillCooldowns[sIdx] === 0) {
        const skillObj = active.servant.template?.skills?.[sIdx];
        const cd = skillObj?.cooldown || 5;
        active.skillCooldowns[sIdx] = cd;
        active.activeBuffs = active.activeBuffs || [];

        const sName = skillObj?.name || `Skill ${sIdx + 1}`;
        const sDesc = skillObj?.description || '';

        // Check for Calamity-Breaker Edict EX / Anti-Threat to Humanity skills
        const isAntiThreatSkill = /Threat to Humanity|Foreigner|Beast|Otherworlder|Calamity-Breaker/i.test(sName + ' ' + sDesc);

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

        await i.deferUpdate();
        await renderAndPostTurn();
        return;
      }
    } else if (i.customId === 'raid_command_seal') {
      if (active.master && (active.master.commandSeals ?? 3) > 0) {
        active.master.commandSeals = Math.max(0, (active.master.commandSeals ?? 3) - 1);
        await saveMaster(active.master);
        active.currentHp = active.maxHp;
        active.npGauge = 100;
        battleState.recentLogs.push(
          `🔱 <@${active.userId}> expended a **Command Seal** (${active.master.commandSeals} remaining)! **${active.servant.nickname || active.servant.template.name}** is fully healed and charged to **100% NP**!`
        );
        if (battleState.recentLogs.length > 4) battleState.recentLogs.shift();
        await i.deferUpdate();
        await renderAndPostTurn();
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
        await i.update({
          content: '💀 **Raid Abandoned:** All Masters retreated from the battlefield.',
          embeds: [],
          components: []
        });
        return;
      }

      pendingCards = [];
      pendingIndices = [];
      advanceToNextPlayer();
      await i.deferUpdate();
      await renderAndPostTurn();
      return;
    }

    // If fewer than 3 cards selected, update buttons and render turn
    if (pendingCards.length < 3) {
      await i.deferUpdate();
      await renderAndPostTurn();
      return;
    }

    // 3 Cards selected -> Automatic attack execution!
    await i.deferUpdate();

    const usedNp = pendingCards.includes('NP');
    if (usedNp) {
      active.npGauge = 0;
      const npGif = getNoblePhantasmGif(active.servant);
      const chant = getNoblePhantasmChant(active.servant);
      const npName = active.servant.template?.noblePhantasm?.name || 'Noble Phantasm';

      if (npGif) {
        await cleanupNpGif();
        const npFiles: AttachmentBuilder[] = [];
        const npEmbed = new EmbedBuilder()
          .setTitle(`💥 NOBLE PHANTASM: ${npName.toUpperCase()}`)
          .setDescription(`⚔️ **${active.servant.nickname || active.servant.template.name}** (Master: <@${active.userId}>)\n> *“${chant || 'True Name Unleashed!'}”*`)
          .setColor(0xe11d48);

        safeSetEmbedImage(npEmbed, normalizeMediaUrl(npGif), npFiles);

        try {
          activeNpGifMessage = await battleMsg.channel.send({ embeds: [npEmbed], files: npFiles });
          // Auto-delete after 12 seconds if idle
          activeNpGifTimeout = setTimeout(() => {
            cleanupNpGif().catch(() => {});
          }, 12_000);
        } catch {}
      }
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

    let npTriggeredAntiThreat = false;

    pendingCards.forEach((card, cIdx) => {
      const stepMult = cIdx === 0 ? 1.0 : cIdx === 1 ? 1.2 : 1.4;
      if (card === 'Buster') {
        totalTurnDmg += Math.round(baseAtk * 1.5 * stepMult * atkBuffMult * specialAtkMult * (0.9 + Math.random() * 0.2));
        starsGenerated += 3;
        npGained += 5;
      } else if (card === 'Arts') {
        totalTurnDmg += Math.round(baseAtk * 1.0 * stepMult * atkBuffMult * specialAtkMult * (0.9 + Math.random() * 0.2));
        npGained += 25;
        starsGenerated += 2;
      } else if (card === 'Quick') {
        totalTurnDmg += Math.round(baseAtk * 0.8 * stepMult * atkBuffMult * specialAtkMult * (0.9 + Math.random() * 0.2));
        starsGenerated += 12;
        npGained += 10;
      } else if (card === 'NP') {
        const npMultiplier = 5.5;
        const npDesc = active.servant.template?.noblePhantasm?.description || '';
        const npHasAntiThreat = /Threat to Humanity|Beast|Divine|Foreigner/i.test(npDesc);
        const npSpecialMult = (isBossThreat && npHasAntiThreat) ? 1.5 : 1.0;
        if (isBossThreat && npHasAntiThreat) npTriggeredAntiThreat = true;

        totalTurnDmg += Math.round(baseAtk * npMultiplier * atkBuffMult * specialAtkMult * npSpecialMult * (0.95 + Math.random() * 0.1));
        starsGenerated += 10;
        npGained += 15;
      }
    });

    battleState.bossCurrentHp = Math.max(0, battleState.bossCurrentHp - totalTurnDmg);
    active.npGauge = Math.min(100, (active.npGauge || 0) + npGained);
    active.critStars = Math.min(50, (active.critStars || 0) + starsGenerated);

    const servName = active.servant.nickname || active.servant.template?.name || 'Servant';
    let traitLog = '';
    if (npTriggeredAntiThreat) {
      traitLog = ' 👑 **[Anti-Calamity Protocol: +50% Special DMG vs Threat to Humanity!]**';
    } else if (antiThreatBuff > 0) {
      traitLog = ' ⚡ **[Calamity-Breaker: +30% Special ATK vs Threat to Humanity!]**';
    }

    battleState.recentLogs.push(
      `⚔️ **${servName}** dealt **${totalTurnDmg.toLocaleString()} DMG** to Barbatos! (+${npGained}% NP, +${starsGenerated} Stars)${traitLog}`
    );
    if (battleState.recentLogs.length > 4) battleState.recentLogs.shift();

    if (battleState.bossCurrentHp <= 0) {
      await cleanupNpGif();
      collector.stop('victory');
      await concludeRaidVictory(battleMsg, boss, battleState.participants);
      return;
    }

    // Refresh hand for this participant and clear selections
    refreshParticipantHand(active);
    pendingCards = [];
    pendingIndices = [];

    const hasMorePlayersInRound = advanceToNextPlayer();

    if (!hasMorePlayersInRound) {
      await executeBossTurn(battleState);

      const anyAlive = battleState.participants.some(p => !p.isDead);
      if (!anyAlive) {
        await cleanupNpGif();
        collector.stop('defeated');
        await concludeRaidDefeat(battleMsg, boss);
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

async function executeBossTurn(state: RaidBattleState) {
  state.bossCharge = Math.min(state.boss.maxCharge, state.bossCharge + 1);

  if (state.bossCharge >= state.boss.maxCharge) {
    state.bossCharge = 0;
    const aoeDamage = 6500;

    state.participants.forEach(p => {
      if (!p.isDead) {
        p.currentHp = Math.max(0, p.currentHp - aoeDamage);
        if (p.currentHp <= 0) p.isDead = true;
      }
    });

    state.recentLogs.push(
      `💥 **BOSS NOBLE PHANTASM: ${state.boss.chargeAttack.name.toUpperCase()}!** Barbatos blasts all Servants for **${aoeDamage.toLocaleString()} AoE DMG**!`
    );
  } else {
    const living = state.participants.filter(p => !p.isDead);
    if (living.length > 0) {
      const target = living[Math.floor(Math.random() * living.length)];
      const bossDmg = Math.round(2500 + Math.random() * 1200);
      target.currentHp = Math.max(0, target.currentHp - bossDmg);
      if (target.currentHp <= 0) target.isDead = true;

      const tName = target.servant.nickname || target.servant.template?.name || 'Servant';
      state.recentLogs.push(
        `👁️ Barbatos struck **${tName}** with Demonic Gaze for **${bossDmg.toLocaleString()} DMG**!`
      );
    }
  }

  if (state.recentLogs.length > 4) state.recentLogs.shift();
}

async function concludeRaidVictory(
  battleMsg: any,
  boss: RaidBossConfig,
  participants: RaidParticipantState[]
) {
  const sqReward = Math.floor(boss.drops.minSq + Math.random() * (boss.drops.maxSq - boss.drops.minSq + 1));
  const qpReward = Math.floor(boss.drops.minQp + Math.random() * (boss.drops.maxQp - boss.drops.minQp));

  for (const p of participants) {
    const master = await getOrCreateMaster(p.userId, p.username);
    master.saintQuartz = (master.saintQuartz || 0) + sqReward;
    master.qp = (master.qp || 0) + qpReward;

    const s = master.servants?.find(s => s.id === p.servant.id);
    if (s) {
      s.bondExp = (s.bondExp || 0) + boss.drops.bondExp;
    }
    await saveMaster(master);
  }

  const winnersList = participants.map(p => `• <@${p.userId}> (**${p.servant.nickname || p.servant.template.name}**)`).join('\n');

  const victoryEmbed = new EmbedBuilder()
    .setTitle('🏆 DEMON GOD PILLAR VANQUISHED — RAID COMPLETE!')
    .setDescription(
      `**Demon God Pillar Barbatos** has disintegrated into the void of the Temple of Time!\n\n` +
      `👑 **Victorious Masters:**\n${winnersList}\n\n` +
      `💎 **Spoils of War (Distributed to all Masters):**\n` +
      `• **+${sqReward} Saint Quartz** 💎\n` +
      `• **+${qpReward.toLocaleString()} QP** 🪙\n` +
      `• **+${boss.drops.bondExp.toLocaleString()} Servant Bond EXP** ✨\n` +
      `• **+${boss.drops.masterExp.toLocaleString()} Master EXP** 📈\n` +
      `• Materials: *${boss.drops.materials.join(', ')}*`
    )
    .setImage(boss.avatarUrl)
    .setColor(0x10b981)
    .setFooter({ text: 'Fate/Grand Order PvE Raid Engine • Victory Recorded' });

  try {
    await battleMsg.channel.send({ embeds: [victoryEmbed], components: [] });
    if (battleMsg && typeof battleMsg.delete === 'function') {
      await battleMsg.delete().catch(() => {});
    }
  } catch {
    await battleMsg.edit({ embeds: [victoryEmbed], components: [] }).catch(() => {});
  }
}

async function concludeRaidDefeat(battleMsg: any, boss: RaidBossConfig) {
  const defeatEmbed = new EmbedBuilder()
    .setTitle('💀 RAID DEFEAT — PARTY WIPED')
    .setDescription(
      `All Servants have fallen to the incinerating mana of **${boss.name}**.\n\n` +
      `*Regroup at Chaldea, reinforce your Saint Graphs, and challenge the Demon God Pillar once more!*`
    )
    .setColor(0xef4444)
    .setFooter({ text: 'Demon God Pillar Raid • Defeat' });

  try {
    await battleMsg.channel.send({ embeds: [defeatEmbed], components: [] });
    if (battleMsg && typeof battleMsg.delete === 'function') {
      await battleMsg.delete().catch(() => {});
    }
  } catch {
    await battleMsg.edit({ embeds: [defeatEmbed], components: [] }).catch(() => {});
  }
}
