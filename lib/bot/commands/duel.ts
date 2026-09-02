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
  executeBattleTurn 
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

      const embed = new EmbedBuilder()
        .setTitle(\`⚔️ HOLY GRAIL WAR DUEL — TURN \${state.currentTurn}\`)
        .setDescription(
          \`👉 **Current Turn:** <@\${interaction.user.id}>, select your Command Card sequence or Noble Phantasm:\`
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
          .setDisabled(!isNpReady)
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
        collector.resetTimer();
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

        await i.update({
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

      await i.update({
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
