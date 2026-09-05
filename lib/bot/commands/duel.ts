/**
 * Slash Command: /duel
 * Description: Tactical RPG turn-based battle with Quick/Arts/Buster cards & Noble Phantasm
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
  User
} from 'discord.js';
import { getOrCreateMaster } from '../database/service';
import { 
  createCombatantFromMasterServant, 
  initializeBattle, 
  executeBattleTurn,
  calculateFleeChance,
  rollFleeSuccess
} from '../engine/battle';
import { renderBattleTurnSummary } from '../canvas/nodeCanvasRenderer';
import { CardType } from '../types';

export const data = new SlashCommandBuilder()
  .setName('duel')
  .setDescription('Challenge another Master to a tactical Servant battle')
  .addUserOption(option =>
    option
      .setName('opponent')
      .setDescription('Target Master to duel (leave empty to challenge AI Shadow Master)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const challengerMaster = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const challengerServant = challengerMaster.servants.find(s => s.id === challengerMaster.activeServantId) || challengerMaster.servants[0];

    if (!challengerServant) {
      await interaction.editReply({
        content: '❌ You must summon at least one Servant with \`/summon\` before entering combat!'
      });
      return;
    }

    const opponentUser = interaction.options.getUser('opponent');
    let opponentMaster = opponentUser ? await getOrCreateMaster(opponentUser.id, opponentUser.username) : null;
    let opponentServant = opponentMaster?.servants.find(s => s.id === opponentMaster?.activeServantId) || opponentMaster?.servants[0];

    if (!opponentUser || !opponentServant) {
      await interaction.editReply({
        content: '❌ **No Rival Master Found:** Please specify a rival Master with /duel opponent:@Master. The Holy Grail War is fought strictly between real server Masters — no NPCs or synthetic duplicates are permitted.'
      });
      return;
    }

    const p1 = createCombatantFromMasterServant(challengerServant, interaction.user.username);
    const p2 = createCombatantFromMasterServant(opponentServant, opponentUser.username);

    let battleState = initializeBattle(p1, p2);

    const generateBattleEmbedAndRows = (state: typeof battleState, _lastLogSummary?: string) => {
      const isNpReady = state.player1.npGauge >= 100;
      const lastDialogue = (state as any).turnLogs && (state as any).turnLogs.length > 0 ? (state as any).turnLogs[(state as any).turnLogs.length - 1] : null;
      const quoteLine = lastDialogue?.dialogueQuote ? \`\\n\\n💬 **\${lastDialogue.actorName || state.player1.name}:** *"\${lastDialogue.dialogueQuote}"*\` : '';

      const embed = new EmbedBuilder()
        .setTitle(\`⚔️ HOLY GRAIL WAR DUEL — TURN \${state.currentTurn}\`)
        .setDescription(
          \`👉 **Current Turn:** <@\${interaction.user.id}>, select your Command Card sequence or Noble Phantasm:\${quoteLine}\`
        )
        .setColor(0xef4444);

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

      const fleeInfo = calculateFleeChance(
        state.player1.currentHp,
        state.player1.maxHp,
        state.player1.servantClass,
        challengerServant.template.baseStats?.agility || 10
      );

      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('use_skill_1')
          .setLabel(state.player1.skills[0]?.name || 'Skill 1')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled((state.player1.skills[0]?.currentCooldown || 0) > 0),
        new ButtonBuilder()
          .setCustomId('use_np')
          .setLabel(\`Noble Phantasm (\${Math.round(state.player1.npGauge)}%)\`)
          .setEmoji('💥')
          .setStyle(isNpReady ? ButtonStyle.Danger : ButtonStyle.Secondary)
          .setDisabled(!isNpReady),
        new ButtonBuilder()
          .setCustomId('duel_flee')
          .setLabel(\`Flee (\${fleeInfo.chancePercent}%)\`)
          .setEmoji('🏃')
          .setStyle(ButtonStyle.Secondary)
      );

      return { embed, rows: [cardRow, actionRow] };
    };

    const initialSummaryBuffer = await renderBattleTurnSummary(
      {
        turnNumber: 1,
        attackerName: p1.name,
        targetName: p2.name,
        actionSummary: 'The Command Seal glow resonates... The Holy Grail Duel begins!',
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
    const initialAttachment = new AttachmentBuilder(initialSummaryBuffer, { name: 'turn_summary.png' });
    const initialView = generateBattleEmbedAndRows(battleState);
    initialView.embed.setImage('attachment://turn_summary.png');
    const msg = await interaction.editReply({
      embeds: [initialView.embed],
      files: [initialAttachment],
      components: initialView.rows
    });

    const collector = msg.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      idle: 120000, // 2 minutes per move
      time: 3600000 // 1 hour absolute safety ceiling
    });

    collector.on('collect', async i => {
      try {
        if (i.replied || i.deferred) return;
        await i.deferUpdate();
        collector.resetTimer();
        if (i.customId === 'duel_flee') {
          const fleeProb = calculateFleeChance(
            battleState.player1.currentHp,
            battleState.player1.maxHp,
            battleState.player1.servantClass,
            challengerServant.template.baseStats?.agility || 10
          );
          const escaped = rollFleeSuccess(fleeProb.chancePercent);

          if (escaped) {
            collector.stop();
            const fleeEmbed = new EmbedBuilder()
              .setTitle('🏃💨 TACTICAL RETREAT SUCCESSFUL')
              .setDescription(
                \`**\${p1.name}** successfully disengaged from **\${p2.name}**!\\n\\n\` +
                \`🎲 **Flee Rate:** \`\${fleeProb.chancePercent}%\`\${fleeProb.isAgilityBonus ? ' (+5% Agility Bonus)' : ''}\\n\` +
                \`✨ Disengaged back to Chaldea sanctuary. No defeat penalty incurred!\`
              )
              .setColor(0xf59e0b);

            await i.editReply({ embeds: [fleeEmbed], components: [] });
            return;
          }

          // Flee failed - Turn consumed! Enemy lands 2,000 HP counter-strike!
          const counterDmg = 2000;
          battleState.player1.currentHp = Math.max(0, battleState.player1.currentHp - counterDmg);
          battleState.currentTurn = battleState.currentTurn + 1;
          if (battleState.player1.currentHp <= 0) {
            battleState.turnPhase = 'defeat';
          }

          if (battleState.turnPhase === 'defeat') {
            collector.stop();
            const seals = challengerMaster.commandSeals ?? 3;
            if (seals >= 1) {
              // Mandatory Command Seal check triggers!
              challengerMaster.commandSeals = Math.max(0, seals - 1);
              const savedEmbed = new EmbedBuilder()
                .setTitle('🔴 MANDATORY COMMAND SEAL INTERVENTION!')
                .setDescription(
                  \`**\${p1.name}** failed to retreat and took a mortal blow from **\${p2.name}**!\\n\\n\` +
                  \`🔮 **Mandatory Command Seal Check:** Master possessed **\${seals}/3 Command Seals**!\\n\` +
                  \`1 Command Seal automatically consumed (Remaining: **\${challengerMaster.commandSeals}/3**).\\n\` +
                  \`**\${p1.name}** emergency-teleported to sanctuary preserved at **1 HP**! Elimination averted.\`
                )
                .setColor(0xf59e0b);
              await i.editReply({ embeds: [savedEmbed], components: [] });
              return;
            } else {
              const deadEmbed = new EmbedBuilder()
                .setTitle('☠️ RETREAT FAILED — MASTER ELIMINATED')
                .setDescription(
                  \`**\${p1.name}** failed to retreat and suffered a fatal counter-strike!\\n\\n\` +
                  \`💀 **Mandatory Command Seal Check:** 0 Command Seals remaining! You have been permanently eliminated from the Holy Grail War.\`
                )
                .setColor(0xef4444);
              await i.editReply({ embeds: [deadEmbed], components: [] });
              return;
            }
          }

          // Player survived: turn was consumed! Present next turn prompt
          const fleeFailLog: CombatTurnLog = {
            turnNumber: battleState.currentTurn - 1,
            actorId: p2.id,
            actorName: p2.name,
            targetId: p1.id,
            targetName: p1.name,
            actionSummary: '❌ **TACTICAL RETREAT FAILED!** (' + fleeProb.chancePercent + '% chance). ' + p1.name + '\'s turn was consumed trying to flee. ' + p2.name + ' intercepted for **2,000 DMG**!',
            cardsUsed: ['Buster'],
            skillsUsed: [],
            damageDealt: counterDmg,
            isCritical: false,
            starsGenerated: 0,
            npCharged: 0,
            actorHpRemaining: battleState.player2.currentHp,
            targetHpRemaining: battleState.player1.currentHp,
            actorHpMax: battleState.player2.maxHp,
            targetHpMax: battleState.player1.maxHp,
            actorNp: battleState.player2.npGauge,
            targetNp: battleState.player1.npGauge
          };

          battleState.turnHistory = [...battleState.turnHistory, fleeFailLog];

          const summaryBuffer = await renderBattleTurnSummary(fleeFailLog, battleState.player1, battleState.player2);
          const attachment = new AttachmentBuilder(summaryBuffer, { name: 'turn_summary.png' });

          const nextView = generateBattleEmbedAndRows(battleState, fleeFailLog.actionSummary);
          nextView.embed.setImage('attachment://turn_summary.png');

          await i.editReply({
            embeds: [nextView.embed],
            files: [attachment],
            components: nextView.rows
          });
          return;
        }

        let p1Cards: CardType[] = ['Buster', 'Arts', 'Quick'];
        let useNp = false;
        let useSkillIndex: number | undefined;

        if (i.customId === 'card_bbb') p1Cards = ['Buster', 'Buster', 'Buster'];
        if (i.customId === 'card_aaa') p1Cards = ['Arts', 'Arts', 'Arts'];
        if (i.customId === 'card_qqq') p1Cards = ['Quick', 'Quick', 'Quick'];
        if (i.customId === 'use_np') useNp = true;
        if (i.customId === 'use_skill_1') useSkillIndex = 0;

      // AI response choice
      const aiCards: CardType[] = ['Buster', 'Arts', 'Quick'];
      const aiUseNp = battleState.player2.npGauge >= 100 && Math.random() > 0.3;

      const { updatedState, turnLogs } = executeBattleTurn(
        battleState,
        { combatantId: p1.id, selectedCards: p1Cards, useNoblePhantasm: useNp, useSkillIndex },
        { combatantId: p2.id, selectedCards: aiCards, useNoblePhantasm: aiUseNp }
      );

      battleState = updatedState;
      const lastLog = turnLogs[turnLogs.length - 1];

      if (battleState.turnPhase === 'victory' || battleState.turnPhase === 'defeat') {
        collector.stop();
        const winner = battleState.winnerId === p1.id ? p1 : p2;
        const resultEmbed = new EmbedBuilder()
          .setTitle(battleState.winnerId === p1.id ? '🏆 VICTORY ACHIEVED!' : '☠️ DEFEAT')
          .setDescription(
            \`**\${winner.name}** has triumphed in the Holy Grail duel!\\n\\n\` +
            \`💬 *"\${challengerServant.customQuotes.victory || challengerServant.template.victoryQuote}"*\\n\\n\` +
            \`💰 **Rewards:** +300 Bond EXP, +3 Saint Quartz, +5 Master EXP\`
          )
          .setColor(battleState.winnerId === p1.id ? 0x22c55e : 0xef4444);

        await i.editReply({
          embeds: [resultEmbed],
          components: []
        });
        return;
      }

      // Generate turn clash summary card
      const summaryBuffer = await renderBattleTurnSummary(lastLog, battleState.player1, battleState.player2);
      const attachment = new AttachmentBuilder(summaryBuffer, { name: 'turn_summary.png' });

      const nextView = generateBattleEmbedAndRows(battleState, turnLogs.map(l => l.actionSummary).join('\\n'));
      nextView.embed.setImage('attachment://turn_summary.png');

      await i.editReply({
        embeds: [nextView.embed],
        files: [attachment],
        components: nextView.rows
      });
      } catch (err: any) {
        if (err.code === 10062 || err.message?.includes('Unknown interaction')) return;
        console.error('Error in duel collector:', err);
      }
    });

  } catch (error: any) {
    console.error('Error executing /duel:', error);
    await interaction.editReply({
      content: \`❌ Error initiating duel: \${error.message}\`
    });
  }
}
`;
