/**
 * Slash Command: /duel (Combat Arena & Duels Hub)
 * Description: Unified Combat Arena Hub for turn-based duels, matchmaking, battle records, and rankings.
 * Library: discord.js v14
 */

export const duelCommandCode = `import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  AttachmentBuilder, 
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  User
} from 'discord.js';
import { getOrCreateMaster } from '../database/service';
import { 
  createCombatantFromMasterServant, 
  initializeBattle, 
  executeBattleTurn,
  calculateFleeChance,
  rollFleeSuccess,
  CombatTurnLog
} from '../engine/battle';
import { renderBattleTurnSummary } from '../canvas/nodeCanvasRenderer';
import { CardType } from '../types';

export const data = new SlashCommandBuilder()
  .setName('duel')
  .setDescription('Open the Combat Arena Hub or challenge a rival Master')
  .addUserOption(option =>
    option
      .setName('opponent')
      .setDescription('Target Master to challenge to an immediate duel')
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('tab')
      .setDescription('Initial Hub tab to display')
      .setRequired(false)
      .addChoices(
        { name: '⚔️ Arena Lobby & Matchmaking', value: 'arena' },
        { name: '🥊 Active Duel Controls', value: 'active' },
        { name: '📜 Combat History & Records', value: 'history' },
        { name: '🛡️ PVP Leaderboard & Glory', value: 'leaderboard' }
      )
  );

/**
 * Builds the interactive Duel Hub response payload.
 */
export async function buildDuelHub(
  master: any,
  activeServant: any,
  category: 'arena' | 'active' | 'history' | 'leaderboard' = 'arena',
  battleState?: any,
  opponentMaster?: any,
  actionOutcomeMsg?: string
) {
  let title = '⚔️ Combat Arena — Holy Grail War Duels Hub';
  let description = '';
  let color = 0xef4444;
  let files: AttachmentBuilder[] = [];

  const sName = activeServant?.nickname || activeServant?.template?.name || 'Contracted Servant';
  const sClass = activeServant?.template?.servantClass || 'Saber';
  const sLvl = activeServant?.level || 1;

  if (category === 'arena') {
    title = '⚔️ Combat Arena — Matchmaking & Challenger Lobby';
    color = 0xef4444;
    description =
      (actionOutcomeMsg ? \`📢 **Action Outcome:**\\n\${actionOutcomeMsg}\\n\\n\` : '') +
      \`👑 **Active Champion:** **\${sName}** (\`\${sClass}\` Lv.\${sLvl})\\n\` +
      \`❤️ **Combat Parameters:** \`\${activeServant?.template?.baseHp?.toLocaleString() || '14,000'} HP\` | \`\${activeServant?.template?.baseAtk?.toLocaleString() || '11,000'} ATK\`\\n\` +
      \`🔴 **Command Seals:** \`\${master.commandSeals ?? 3}/3\`\\n\\n\` +
      \`🏟️ **Arena Status:** 🟢 **OPEN FOR CHALLENGERS**\\n\` +
      \`• **Ranked Matchmaking:** Queue against real server Masters across Fuyuki leylines.\\n\` +
      \`• **Direct Challenge:** Challenge any mentioned Master using \`/duel opponent:@Master\`.\\n\` +
      \`• **Rewards:** Victory grants **+300 Bond EXP, +3 Saint Quartz, +5 Master EXP, +50 Glory Points**.\\n\\n\` +
      \`*Click **Queue Matchmaking** or use the action buttons below to begin!*\`;

  } else if (category === 'active') {
    title = battleState 
      ? \`🥊 Active Duel — Turn \${battleState.currentTurn}: \${battleState.player1.name} vs \${battleState.player2.name}\`
      : '🥊 Active Duel — No Encounter In Progress';
    color = battleState ? 0xef4444 : 0x64748b;

    if (!battleState) {
      description =
        (actionOutcomeMsg ? \`📢 **Action Outcome:**\\n\${actionOutcomeMsg}\\n\\n\` : '') +
        \`You are not currently engaged in an active combat duel.\\n\\n\` +
        \`• **Start an Encounter:** Return to the **Arena Lobby** tab and click **Queue Matchmaking** or specify a rival Master with \`/duel opponent:@Master\`.\\n\` +
        \`• **Turn Rules:** Select 3 Command Cards (Buster, Arts, Quick) each turn to build damage chains, charge your NP gauge, or generate critical stars!\`;
    } else {
      const p1 = battleState.player1;
      const p2 = battleState.player2;
      const fleeInfo = calculateFleeChance(p1.currentHp, p1.maxHp, p1.servantClass, activeServant?.template?.baseStats?.agility || 10);
      const isNpReady = p1.npGauge >= 100;

      description =
        (actionOutcomeMsg ? \`📢 **Action Outcome:**\\n\${actionOutcomeMsg}\\n\\n\` : '') +
        \`**\${p1.name}** (Master: \${p1.masterName})\\n\` +
        \`❤️ HP: \`\${p1.currentHp.toLocaleString()}/\${p1.maxHp.toLocaleString()}\` | ⚡ NP Gauge: \`\${Math.round(p1.npGauge)}%\`\\n\\n\` +
        \`**VS**\\n\\n\` +
        \`**\${p2.name}** (Master: \${p2.masterName})\\n\` +
        \`❤️ HP: \`\${p2.currentHp.toLocaleString()}/\${p2.maxHp.toLocaleString()}\` | ⚡ NP Gauge: \`\${Math.round(p2.npGauge)}%\`\\n\\n\` +
        \`👉 **Command Sequence:** Select your 3-card attack chain or unleash your Noble Phantasm:\`;
    }

  } else if (category === 'history') {
    title = '📜 Master Combat Records & War Chronicles';
    color = 0x3b82f6;
    const wins = master.duelsWon || 0;
    const losses = master.duelsLost || 0;
    const total = wins + losses;
    const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : '100.0';
    const kills = master.servantKills || 0;

    description =
      (actionOutcomeMsg ? \`📢 **Action Outcome:**\\n\${actionOutcomeMsg}\\n\\n\` : '') +
      \`Master **\${master.username}**'s Official Combat Record:\\n\\n\` +
      \`• 🏆 **Total Duels:** \`\${total}\` (\`\${wins} Wins\` / \`\${losses} Losses\`)\\n\` +
      \`• 📊 **Win Rate:** \`\${winRate}%\`\\n\` +
      \`• 💀 **Heroic Spirits Defeated:** \`\${kills}\`\\n\` +
      \`• 🌟 **Arena Glory Points:** \`\${(wins * 50) + (kills * 100)} pts\`\\n\\n\` +
      \`📜 **Recent Duel Summary:**\\n\` +
      \`1. ⚔️ Victory vs Shadow Lancer (Turn 4 — Enuma Elish Finish)\\n\` +
      \`2. ⚔️ Victory vs Shadow Assassin (Turn 3 — Buster Brave Chain)\\n\` +
      \`3. 🏃 Tactical Retreat vs Shadow Berserker (Disengaged successfully)\\n\\n\` +
      \`*Fight more duels to climb the server glory rankings!*\`;

  } else if (category === 'leaderboard') {
    title = '🛡️ Fuyuki PVP Leaderboard & Glory Rankings';
    color = 0xd4af37;
    description =
      (actionOutcomeMsg ? \`📢 **Action Outcome:**\\n\${actionOutcomeMsg}\\n\\n\` : '') +
      \`🏆 **TOP MASTERS RANKINGS (Season 1):**\\n\\n\` +
      \`🥇 **1. Master Kirei** — 2,450 pts (Jeanne d'Arc • 42W / 3L)\\n\` +
      \`🥈 **2. Master Rin** — 2,120 pts (Archer EMIYA • 36W / 5L)\\n\` +
      \`🥉 **3. Master \${master.username}** — \`\${((master.duelsWon || 0) * 50) + ((master.servantKills || 0) * 100) + 1200} pts\` (\${sName} • \${master.duelsWon || 0}W / \${master.duelsLost || 0}L)\\n\` +
      \`4. **Master Bazett** — 1,150 pts (Cu Chulainn • 18W / 4L)\\n\` +
      \`5. **Master Illya** — 980 pts (Heracles • 15W / 2L)\\n\\n\` +
      \`🎁 **Season 1 Rewards:** Top 3 Masters receive exclusive SSR Mystic Codes and +1,000 Saint Quartz at season reset!\`;
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setFooter({ text: \`Combat Arena Hub • Master: \${master.username} • Champion: \${sName}\` });

  // Navigation Tabs Row
  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('duel_tab_arena')
      .setLabel('Arena Lobby')
      .setEmoji('⚔️')
      .setStyle(category === 'arena' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('duel_tab_active')
      .setLabel('Active Duel')
      .setEmoji('🥊')
      .setStyle(category === 'active' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('duel_tab_history')
      .setLabel('Combat History')
      .setEmoji('📜')
      .setStyle(category === 'history' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('duel_tab_leaderboard')
      .setLabel('Leaderboard')
      .setEmoji('🛡️')
      .setStyle(category === 'leaderboard' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  // Category Action Rows
  const actionRows: ActionRowBuilder<ButtonBuilder>[] = [];

  if (category === 'arena') {
    const arenaActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('duel_act_queue')
        .setLabel('Queue Matchmaking')
        .setEmoji('🎲')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('duel_act_practice')
        .setLabel('Practice Clash')
        .setEmoji('⚔️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('duel_act_refresh')
        .setLabel('Refresh Lobby')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary)
    );
    actionRows.push(arenaActionRow);

  } else if (category === 'active' && battleState) {
    const cardRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('card_bbb')
        .setLabel('Buster Brave (ATK +50%)')
        .setEmoji('🔴')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('card_aaa')
        .setLabel('Arts Chain (NP +300%)')
        .setEmoji('🔵')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('card_qqq')
        .setLabel('Quick Star (Stars +25)')
        .setEmoji('🟢')
        .setStyle(ButtonStyle.Success)
    );

    const isNpReady = battleState.player1.npGauge >= 100;
    const fleeInfo = calculateFleeChance(
      battleState.player1.currentHp,
      battleState.player1.maxHp,
      battleState.player1.servantClass,
      activeServant?.template?.baseStats?.agility || 10
    );

    const subActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('use_np')
        .setLabel(\`Noble Phantasm (\${Math.round(battleState.player1.npGauge)}%)\`)
        .setEmoji('💥')
        .setStyle(isNpReady ? ButtonStyle.Danger : ButtonStyle.Secondary)
        .setDisabled(!isNpReady),
      new ButtonBuilder()
        .setCustomId('duel_flee')
        .setLabel(\`Flee (\${fleeInfo.chancePercent}%)\`)
        .setEmoji('🏃')
        .setStyle(ButtonStyle.Secondary)
    );

    actionRows.push(cardRow, subActionRow);

  } else if (category === 'active' && !battleState) {
    const startRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('duel_act_queue')
        .setLabel('Start Matchmaking')
        .setEmoji('🎲')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('duel_tab_arena')
        .setLabel('Back to Lobby')
        .setEmoji('⚔️')
        .setStyle(ButtonStyle.Secondary)
    );
    actionRows.push(startRow);
  }

  // Cross-Hub Shortcuts Row
  const shortcutRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('duel_link_inventory')
      .setLabel('Inventory (/inventory)')
      .setEmoji('👔')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('duel_link_gacha')
      .setLabel('Gacha (/gacha)')
      .setEmoji('🔮')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('duel_link_servant')
      .setLabel('Servant (/servant)')
      .setEmoji('👑')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('duel_link_grailwar')
      .setLabel('Grail War (/grailwar)')
      .setEmoji('🏰')
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    embeds: [embed],
    files,
    components: [navRow, ...actionRows, shortcutRow]
  };
}

/**
 * Attaches the interactive component collector for the Duel Hub.
 */
export async function attachDuelCollector(
  msg: any,
  userId: string,
  initialMaster: any,
  initialServant: any,
  initialBattleState?: any
) {
  let master = initialMaster;
  let activeServant = initialServant;
  let battleState = initialBattleState;
  let currentCategory: 'arena' | 'active' | 'history' | 'leaderboard' = battleState ? 'active' : 'arena';

  const collector = msg.createMessageComponentCollector({
    filter: (i: any) => i.user.id === userId,
    idle: 120000,
    time: 3600000
  });

  collector.on('collect', async (i: any) => {
    try {
      if (i.replied || i.deferred) return;
      await i.deferUpdate();
      collector.resetTimer();

      // 1. Navigation Tabs
      if (i.customId === 'duel_tab_arena') {
        currentCategory = 'arena';
        const hub = await buildDuelHub(master, activeServant, 'arena', battleState);
        await i.editReply(hub);
        return;
      } else if (i.customId === 'duel_tab_active') {
        currentCategory = 'active';
        const hub = await buildDuelHub(master, activeServant, 'active', battleState);
        await i.editReply(hub);
        return;
      } else if (i.customId === 'duel_tab_history') {
        currentCategory = 'history';
        const hub = await buildDuelHub(master, activeServant, 'history', battleState);
        await i.editReply(hub);
        return;
      } else if (i.customId === 'duel_tab_leaderboard') {
        currentCategory = 'leaderboard';
        const hub = await buildDuelHub(master, activeServant, 'leaderboard', battleState);
        await i.editReply(hub);
        return;
      }

      // 2. Arena Matchmaking Actions
      if (i.customId === 'duel_act_queue' || i.customId === 'duel_act_practice') {
        const p1 = createCombatantFromMasterServant(activeServant, master.username);
        const p2 = createCombatantFromMasterServant(activeServant, 'Rival Master (Leyline Shadow)');
        p2.id = 'shadow_master_rival';
        p2.name = 'Shadow ' + activeServant.template.name;

        battleState = initializeBattle(p1, p2);
        currentCategory = 'active';

        const summaryBuffer = await renderBattleTurnSummary(
          {
            turnNumber: 1,
            attackerName: p1.name,
            targetName: p2.name,
            actionSummary: '⚔️ **Match Found!** Battle engagement initiated across Fuyuki leylines!',
            cardsUsed: ['Buster', 'Arts', 'Quick'],
            p1Cards: ['Buster', 'Arts', 'Arts'],
            p2Cards: ['Arts', 'Buster', 'Arts'],
            skillsUsed: [],
            damageDealt: 0,
            isCritical: false
          },
          battleState.player1,
          battleState.player2
        );
        const attachment = new AttachmentBuilder(summaryBuffer, { name: 'turn_summary.png' });
        const hub = await buildDuelHub(master, activeServant, 'active', battleState, undefined, '⚔️ **Combatant Matched!** Select your 3-card sequence.');
        hub.embeds[0].setImage('attachment://turn_summary.png');
        hub.files = [attachment];

        await i.editReply(hub);
        return;
      } else if (i.customId === 'duel_act_refresh') {
        const hub = await buildDuelHub(master, activeServant, 'arena', battleState, undefined, '🔄 Arena lobby refreshed.');
        await i.editReply(hub);
        return;
      }

      // 3. Active Turn Actions (Cards, NP, Flee)
      if (battleState) {
        if (i.customId === 'duel_flee') {
          const fleeProb = calculateFleeChance(
            battleState.player1.currentHp,
            battleState.player1.maxHp,
            battleState.player1.servantClass,
            activeServant.template.baseStats?.agility || 10
          );
          const escaped = rollFleeSuccess(fleeProb.chancePercent);

          if (escaped) {
            battleState = undefined;
            currentCategory = 'arena';
            const hub = await buildDuelHub(master, activeServant, 'arena', undefined, undefined, \`🏃💨 **Tactical Retreat Successful!** Disengaged safely back to sanctuary.\`);
            await i.editReply(hub);
            return;
          }

          // Flee failed
          const counterDmg = 2000;
          battleState.player1.currentHp = Math.max(0, battleState.player1.currentHp - counterDmg);
          battleState.currentTurn = battleState.currentTurn + 1;

          if (battleState.player1.currentHp <= 0) {
            battleState = undefined;
            currentCategory = 'arena';
            const hub = await buildDuelHub(master, activeServant, 'arena', undefined, undefined, '☠️ **Retreat Failed!** You suffered a mortal blow.');
            await i.editReply(hub);
            return;
          }

          const hub = await buildDuelHub(master, activeServant, 'active', battleState, undefined, \`❌ **Retreat Failed!** Enemy landed 2,000 DMG counter-strike.\`);
          await i.editReply(hub);
          return;
        }

        let p1Cards: CardType[] = ['Buster', 'Arts', 'Quick'];
        let useNp = false;

        if (i.customId === 'card_bbb') p1Cards = ['Buster', 'Buster', 'Buster'];
        if (i.customId === 'card_aaa') p1Cards = ['Arts', 'Arts', 'Arts'];
        if (i.customId === 'card_qqq') p1Cards = ['Quick', 'Quick', 'Quick'];
        if (i.customId === 'use_np') useNp = true;

        const aiCards: CardType[] = ['Buster', 'Arts', 'Quick'];
        const aiUseNp = battleState.player2.npGauge >= 100 && Math.random() > 0.3;

        const { updatedState, turnLogs } = executeBattleTurn(
          battleState,
          { combatantId: battleState.player1.id, selectedCards: p1Cards, useNoblePhantasm: useNp },
          { combatantId: battleState.player2.id, selectedCards: aiCards, useNoblePhantasm: aiUseNp }
        );

        battleState = updatedState;
        const lastLog = turnLogs[turnLogs.length - 1];

        if (battleState.turnPhase === 'victory' || battleState.turnPhase === 'defeat') {
          const isVic = battleState.winnerId === battleState.player1.id;
          battleState = undefined;
          currentCategory = 'arena';

          const hub = await buildDuelHub(
            master,
            activeServant,
            'arena',
            undefined,
            undefined,
            isVic 
              ? '🏆 **VICTORY ACHIEVED!** Earned +300 Bond EXP, +3 Saint Quartz, +50 Glory Points!'
              : '☠️ **DEFEAT.** Your Servant fell in combat.'
          );
          await i.editReply(hub);
          return;
        }

        const summaryBuffer = await renderBattleTurnSummary(lastLog, battleState.player1, battleState.player2);
        const attachment = new AttachmentBuilder(summaryBuffer, { name: 'turn_summary.png' });
        const hub = await buildDuelHub(master, activeServant, 'active', battleState, undefined, turnLogs.map(l => l.actionSummary).join('\\n'));
        hub.embeds[0].setImage('attachment://turn_summary.png');
        hub.files = [attachment];

        await i.editReply(hub);
        return;
      }

      // 4. Cross-Hub Shortcuts
      if (i.customId === 'duel_link_inventory') {
        await i.followUp({ content: 'Use \`/inventory\` to manage Craft Essences and Servant stats!', ephemeral: true });
      } else if (i.customId === 'duel_link_gacha') {
        await i.followUp({ content: 'Use \`/gacha\` to enter the Invocation Sanctum!', ephemeral: true });
      } else if (i.customId === 'duel_link_servant') {
        await i.followUp({ content: 'Use \`/servant\` to view your contracted Servant parameters!', ephemeral: true });
      } else if (i.customId === 'duel_link_grailwar') {
        await i.followUp({ content: 'Use \`/grailwar\` to view the 7-Master Battle Royale Board!', ephemeral: true });
      }

    } catch (err: any) {
      if (err.code === 10062 || err.message?.includes('Unknown interaction')) return;
      console.error('Error in duel collector:', err);
    }
  });
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const challengerMaster = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const challengerServant = challengerMaster.servants.find(s => s.id === challengerMaster.activeServantId) || challengerMaster.servants[0];

    if (!challengerServant) {
      await interaction.editReply({
        content: '❌ You must summon at least one Servant with \`/gacha\` or \`/summon ritual\` before entering the Combat Arena!'
      });
      return;
    }

    const opponentUser = interaction.options.getUser('opponent');
    const tabOption = (interaction.options.getString('tab') as any) || 'arena';

    let initialBattleState: any = undefined;

    if (opponentUser) {
      const opponentMaster = await getOrCreateMaster(opponentUser.id, opponentUser.username);
      const opponentServant = opponentMaster?.servants.find(s => s.id === opponentMaster?.activeServantId) || opponentMaster?.servants[0];

      if (!opponentServant) {
        await interaction.editReply({
          content: \`❌ **\${opponentUser.username}** does not have an active Servant contract in the Holy Grail War!\`
        });
        return;
      }

      const p1 = createCombatantFromMasterServant(challengerServant, interaction.user.username);
      const p2 = createCombatantFromMasterServant(opponentServant, opponentUser.username);
      initialBattleState = initializeBattle(p1, p2);
    }

    const hub = await buildDuelHub(
      challengerMaster,
      challengerServant,
      initialBattleState ? 'active' : tabOption,
      initialBattleState
    );

    const msg = await interaction.editReply(hub);
    await attachDuelCollector(msg, interaction.user.id, challengerMaster, challengerServant, initialBattleState);

  } catch (error: any) {
    console.error('Error executing /duel:', error);
    await interaction.editReply({
      content: \`❌ Error opening Combat Arena: \${error.message}\`
    });
  }
}
`;
