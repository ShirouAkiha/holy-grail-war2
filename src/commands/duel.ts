import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  User,
  ComponentType
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { MasterProfile, MasterServantInstance, CardType, ServantClass } from '../types';
import { SERVANT_DATABASE } from '../data/servants';

export const data = new SlashCommandBuilder()
  .setName('duel')
  .setDescription('Engage in a turn-based tactical Fate battle against another Master or AI Shadow Servant')
  .addUserOption(option =>
    option
      .setName('opponent')
      .setDescription('Target Master to duel (leave empty to challenge AI Shadow Master)')
      .setRequired(false)
  );

interface DuelCombatant {
  userId: string;
  username: string;
  isAi: boolean;
  servant: MasterServantInstance;
  currentHp: number;
  maxHp: number;
  atk: number;
  def: number;
  npGauge: number;
  critStars: number;
  activeBuffs: Array<{ name: string; type: string; value: number; turns: number }>;
}

function getClassMultiplier(attacker: ServantClass, defender: ServantClass): number {
  const advantage: Record<string, string[]> = {
    Saber: ['Lancer'],
    Lancer: ['Archer'],
    Archer: ['Saber'],
    Rider: ['Caster'],
    Caster: ['Assassin'],
    Assassin: ['Rider'],
    Berserker: ['Saber', 'Lancer', 'Archer', 'Rider', 'Caster', 'Assassin', 'Ruler'],
    Ruler: ['MoonCancer', 'Berserker'],
    Avenger: ['Ruler', 'Berserker'],
    Foreigner: ['Berserker'],
  };

  const disadvantage: Record<string, string[]> = {
    Saber: ['Archer'],
    Lancer: ['Saber'],
    Archer: ['Lancer'],
    Rider: ['Assassin'],
    Caster: ['Rider'],
    Assassin: ['Caster'],
  };

  if (advantage[attacker]?.includes(defender)) return 1.5;
  if (disadvantage[attacker]?.includes(defender)) return 0.5;
  if (defender === 'Berserker') return 1.5;
  return 1.0;
}

function createCombatant(master: MasterProfile, servant: MasterServantInstance, isAi: boolean = false): DuelCombatant {
  const t = servant.template;
  const alloc = servant.allocatedStats || { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 };
  const ceAtk = servant.equippedCe?.atkBonus || 0;
  const ceHp = servant.equippedCe?.hpBonus || 0;

  const maxHp = (t.baseHp || 12000) + (alloc.endurance || 0) * 300 + ceHp;
  const atk = (t.baseAtk || 10000) + (alloc.strength || 0) * 150 + ceAtk;
  const def = 10 + (alloc.endurance || 0) * 2;

  let initialNp = 0;
  if (servant.equippedCe?.passiveType === 'starting_np') {
    initialNp = servant.equippedCe.passiveValue || 50;
  }

  return {
    userId: master.discordId,
    username: master.username,
    isAi,
    servant,
    currentHp: maxHp,
    maxHp,
    atk,
    def,
    npGauge: initialNp,
    critStars: 10,
    activeBuffs: []
  };
}

function renderHealthBar(current: number, max: number, length: number = 10): string {
  const pct = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(pct * length);
  const empty = length - filled;
  const emoji = pct > 0.5 ? '🟩' : pct > 0.25 ? '🟨' : '🟥';
  return `${emoji.repeat(filled)}${'⬛'.repeat(empty)} \`${Math.max(0, current).toLocaleString()}/${max.toLocaleString()}\` (${Math.round(pct * 100)}%)`;
}

function buildDuelEmbed(
  p1: DuelCombatant,
  p2: DuelCombatant,
  round: number,
  activeUserId: string,
  lastLogs: string[]
) {
  const isP1Turn = activeUserId === p1.userId;
  const activeCombatant = isP1Turn ? p1 : p2;

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ HOLY GRAIL WAR DUEL — ROUND ${round}`)
    .setDescription(
      `**${p1.servant.template.name}** (Master: <@${p1.userId}>)\n` +
      `Class: **${p1.servant.template.servantClass}** ★${p1.servant.template.rarity}\n` +
      `HP: ${renderHealthBar(p1.currentHp, p1.maxHp)}\n` +
      `⚡ NP: **${Math.round(p1.npGauge)}%** | ✨ Stars: **${p1.critStars}**\n\n` +
      `**VS**\n\n` +
      `**${p2.servant.template.name}** (${p2.isAi ? 'Shadow AI' : `Master: <@${p2.userId}>`})\n` +
      `Class: **${p2.servant.template.servantClass}** ★${p2.servant.template.rarity}\n` +
      `HP: ${renderHealthBar(p2.currentHp, p2.maxHp)}\n` +
      `⚡ NP: **${Math.round(p2.npGauge)}%** | ✨ Stars: **${p2.critStars}**\n\n` +
      (lastLogs.length > 0
        ? `📜 **Combat Log:**\n${lastLogs.map(l => `> ${l}`).join('\n')}\n\n`
        : '') +
      `👉 **Current Turn:** ${activeCombatant.isAi ? '🤖 Shadow AI is calculating...' : `<@${activeCombatant.userId}>, select your Command Card or Noble Phantasm:`}`
    )
    .setColor(isP1Turn ? 0xef4444 : 0x38bdf8);

  return embed;
}

function buildCombatButtons(combatant: DuelCombatant) {
  const isNpReady = combatant.npGauge >= 100;

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('card_buster')
      .setLabel('Buster Brave (+50% DMG)')
      .setEmoji('🔴')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('card_arts')
      .setLabel('Arts Chain (+40% NP)')
      .setEmoji('🔵')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('card_quick')
      .setLabel('Quick Strike (+25 Stars)')
      .setEmoji('🟢')
      .setStyle(ButtonStyle.Success)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('card_np')
      .setLabel(`Noble Phantasm (${Math.round(combatant.npGauge)}%)`)
      .setEmoji('💥')
      .setStyle(isNpReady ? ButtonStyle.Danger : ButtonStyle.Secondary)
      .setDisabled(!isNpReady),
    new ButtonBuilder()
      .setCustomId('card_skill')
      .setLabel(`${combatant.servant.template.skills[0]?.name || 'Activate Skill'}`)
      .setEmoji('🛡️')
      .setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2];
}

function resolveStrike(
  attacker: DuelCombatant,
  defender: DuelCombatant,
  actionType: 'buster' | 'arts' | 'quick' | 'np' | 'skill'
): string {
  const classMult = getClassMultiplier(
    attacker.servant.template.servantClass,
    defender.servant.template.servantClass
  );

  let rawDmg = 0;
  let logText = '';

  if (actionType === 'buster') {
    const isCrit = Math.random() < attacker.critStars / 100;
    const baseAtk = attacker.atk * 1.5;
    const critMult = isCrit ? 2.0 : 1.0;
    rawDmg = Math.round((baseAtk - defender.def * 10) * classMult * critMult * (0.9 + Math.random() * 0.2));
    rawDmg = Math.max(800, rawDmg);
    attacker.npGauge = Math.min(300, attacker.npGauge + 10);
    attacker.critStars = Math.max(0, attacker.critStars - 5);

    logText = `🔴 **${attacker.servant.template.name}** unleashed **Buster Brave** ${isCrit ? '💥 **CRITICAL HIT!**' : ''} dealing **${rawDmg.toLocaleString()} DMG** to ${defender.servant.template.name}!`;
  } else if (actionType === 'arts') {
    const baseAtk = attacker.atk * 1.1;
    rawDmg = Math.round((baseAtk - defender.def * 10) * classMult * (0.9 + Math.random() * 0.2));
    rawDmg = Math.max(600, rawDmg);
    const npCharge = Math.round(35 + Math.random() * 15);
    attacker.npGauge = Math.min(300, attacker.npGauge + npCharge);

    logText = `🔵 **${attacker.servant.template.name}** connected with **Arts Chain**, dealing **${rawDmg.toLocaleString()} DMG** and gaining **+${npCharge}% NP**!`;
  } else if (actionType === 'quick') {
    const baseAtk = attacker.atk * 0.95;
    rawDmg = Math.round((baseAtk - defender.def * 10) * classMult * (0.9 + Math.random() * 0.2));
    rawDmg = Math.max(500, rawDmg);
    const starsGained = 25;
    attacker.critStars = Math.min(50, attacker.critStars + starsGained);
    attacker.npGauge = Math.min(300, attacker.npGauge + 15);

    logText = `🟢 **${attacker.servant.template.name}** performed **Quick Strike**, dealing **${rawDmg.toLocaleString()} DMG** and gathering **+${starsGained} Critical Stars**!`;
  } else if (actionType === 'np') {
    const npTemplate = attacker.servant.template.noblePhantasm;
    const baseAtk = attacker.atk * 3.5;
    rawDmg = Math.round((baseAtk - defender.def * 10) * classMult * (0.95 + Math.random() * 0.15));
    rawDmg = Math.max(3500, rawDmg);
    attacker.npGauge = 0;

    const chant = attacker.servant.customQuotes?.noblePhantasm || npTemplate.chant;
    logText = `💥 **NOBLE PHANTASM UNLEASHED!**\n> *" ${chant} "*\n> **${attacker.servant.template.name}** obliterated ${defender.servant.template.name} with **${npTemplate.name}** for **${rawDmg.toLocaleString()} colossal DMG**!`;
  } else if (actionType === 'skill') {
    const skill = attacker.servant.template.skills[0];
    attacker.atk = Math.round(attacker.atk * 1.3);
    attacker.critStars += 15;
    attacker.npGauge = Math.min(300, attacker.npGauge + 20);

    logText = `🛡️ **${attacker.servant.template.name}** activated **${skill?.name || 'Class Skill'}**, gaining **+30% ATK Buff**, +20% NP, and +15 Stars!`;
  }

  defender.currentHp = Math.max(0, defender.currentHp - rawDmg);
  return logText;
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const challengerMaster = await getOrCreateMaster(interaction.user.id, interaction.user.username);

    if (!challengerMaster.servants || challengerMaster.servants.length === 0) {
      await interaction.reply({
        ephemeral: true,
        content: '❌ You must summon a Servant using `/summon` before entering a duel!'
      });
      return;
    }

    const challengerServant =
      challengerMaster.servants.find(s => s.id === challengerMaster.activeServantId) ||
      challengerMaster.servants[0];

    const opponentUser = interaction.options.getUser('opponent');

    // Case 1: Challenging another human Master
    if (opponentUser && opponentUser.id !== interaction.user.id && !opponentUser.bot) {
      const opponentMaster = await getOrCreateMaster(opponentUser.id, opponentUser.username);

      if (!opponentMaster.servants || opponentMaster.servants.length === 0) {
        await interaction.reply({
          content: `❌ <@${opponentUser.id}> has not summoned any Servants yet! They need to run \`/summon\` first.`,
          ephemeral: true
        });
        return;
      }

      const opponentServant =
        opponentMaster.servants.find(s => s.id === opponentMaster.activeServantId) ||
        opponentMaster.servants[0];

      const inviteEmbed = new EmbedBuilder()
        .setTitle('⚔️ HOLY GRAIL WAR: DUEL INVITATION')
        .setDescription(
          `Master <@${interaction.user.id}> with **${challengerServant.template.name}** (${challengerServant.template.servantClass})\n` +
          `has challenged Master <@${opponentUser.id}> with **${opponentServant.template.name}** (${opponentServant.template.servantClass}) to a battle!\n\n` +
          `<@${opponentUser.id}>, do you accept this challenge?`
        )
        .setColor(0xd4af37);

      const inviteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('accept_duel')
          .setLabel('Accept Duel')
          .setEmoji('⚔️')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('decline_duel')
          .setLabel('Decline')
          .setEmoji('🏳️')
          .setStyle(ButtonStyle.Danger)
      );

      const inviteMsg = await interaction.reply({
        content: `<@${opponentUser.id}>`,
        embeds: [inviteEmbed],
        components: [inviteRow],
        fetchReply: true
      });

      const inviteCollector = inviteMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000
      });

      inviteCollector.on('collect', async i => {
        if (i.user.id !== opponentUser.id && i.user.id !== interaction.user.id) {
          await i.reply({ content: 'You are not involved in this duel challenge.', ephemeral: true });
          return;
        }

        if (i.customId === 'decline_duel') {
          inviteCollector.stop();
          await i.update({
            content: `🏳️ Duel declined by <@${i.user.id}>.`,
            embeds: [],
            components: []
          });
          return;
        }

        if (i.customId === 'accept_duel' && i.user.id === opponentUser.id) {
          inviteCollector.stop();
          const p1 = createCombatant(challengerMaster, challengerServant, false);
          const p2 = createCombatant(opponentMaster, opponentServant, false);
          await startInteractiveDuel(i, p1, p2, challengerMaster, opponentMaster);
        }
      });

      return;
    }

    // Case 2: AI Sparring Partner / Shadow Servant
    let aiServantTemplate = SERVANT_DATABASE[1]; // Gilgamesh or Linus
    if (challengerServant.template.servantClass === 'Saber') {
      aiServantTemplate = SERVANT_DATABASE.find(s => s.servantClass === 'Archer') || SERVANT_DATABASE[1];
    } else {
      aiServantTemplate = SERVANT_DATABASE.find(s => s.servantClass === 'Saber') || SERVANT_DATABASE[0];
    }

    const aiServantInstance: MasterServantInstance = {
      id: 'ai_servant_01',
      masterId: 'ai_master',
      templateId: aiServantTemplate.id,
      level: challengerServant.level || 1,
      experience: 0,
      allocatedStats: { strength: 4, endurance: 4, agility: 4, mana: 4, luck: 4 },
      availableStatPoints: 0,
      skillLevels: [2, 2, 2],
      customQuotes: {
        summon: aiServantTemplate.summonQuote,
        battleStart: aiServantTemplate.battleStartQuote,
        noblePhantasm: aiServantTemplate.noblePhantasm.chant,
        victory: aiServantTemplate.victoryQuote,
        defeat: aiServantTemplate.defeatQuote
      },
      bondLevel: 3,
      template: aiServantTemplate
    };

    const p1 = createCombatant(challengerMaster, challengerServant, false);
    const p2 = createCombatant(
      {
        id: 'ai_master',
        discordId: 'ai_shadow',
        username: 'Shadow Doppelganger',
        avatarUrl: '',
        saintQuartz: 0,
        summonTickets: 0,
        commandSeals: 3,
        actionPoints: 100,
        maxActionPoints: 100,
        pityCount: 0,
        grailWarWins: 0,
        servants: [aiServantInstance],
        craftEssences: []
      },
      aiServantInstance,
      true
    );

    await startInteractiveDuel(interaction, p1, p2, challengerMaster, null);

  } catch (error: any) {
    console.error('Error executing /duel:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: `❌ Error starting duel: ${error.message}`, ephemeral: true });
    } else {
      await interaction.reply({ content: `❌ Error starting duel: ${error.message}`, ephemeral: true });
    }
  }
}

async function startInteractiveDuel(
  contextInteraction: any,
  p1: DuelCombatant,
  p2: DuelCombatant,
  p1Master: MasterProfile,
  p2Master: MasterProfile | null
) {
  let round = 1;
  let activeUserId = p1.userId;
  const combatLogs: string[] = ['⚔️ The Command Seal glow resonates... The Holy Grail Duel begins!'];

  const initialEmbed = buildDuelEmbed(p1, p2, round, activeUserId, combatLogs);
  const initialButtons = buildCombatButtons(p1);

  let battleMsg: any;
  if (contextInteraction.isButton && contextInteraction.isButton()) {
    battleMsg = await contextInteraction.update({
      content: null,
      embeds: [initialEmbed],
      components: initialButtons,
      fetchReply: true
    });
  } else {
    battleMsg = await contextInteraction.reply({
      embeds: [initialEmbed],
      components: initialButtons,
      fetchReply: true
    });
  }

  const collector = battleMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 180000
  });

  collector.on('collect', async (i: any) => {
    // Verify it's the turn of the player who clicked
    if (i.user.id !== activeUserId) {
      await i.reply({
        content: `⏳ It is not your turn! Waiting for <@${activeUserId}> to take an action.`,
        ephemeral: true
      });
      return;
    }

    let actionType: 'buster' | 'arts' | 'quick' | 'np' | 'skill' = 'buster';
    if (i.customId === 'card_buster') actionType = 'buster';
    if (i.customId === 'card_arts') actionType = 'arts';
    if (i.customId === 'card_quick') actionType = 'quick';
    if (i.customId === 'card_np') actionType = 'np';
    if (i.customId === 'card_skill') actionType = 'skill';

    const attacker = activeUserId === p1.userId ? p1 : p2;
    const defender = activeUserId === p1.userId ? p2 : p1;

    // Execute Player strike
    const log = resolveStrike(attacker, defender, actionType);
    combatLogs.push(log);
    if (combatLogs.length > 4) combatLogs.shift();

    // Check if Defender died
    if (defender.currentHp <= 0) {
      collector.stop();
      await finishDuel(i, attacker, defender, p1Master, p2Master);
      return;
    }

    // If opponent is AI, AI immediately takes its counter turn!
    if (defender.isAi) {
      round++;
      const aiAction = defender.npGauge >= 100 ? 'np' : Math.random() > 0.5 ? 'buster' : 'arts';
      const aiLog = resolveStrike(defender, attacker, aiAction);
      combatLogs.push(aiLog);
      if (combatLogs.length > 4) combatLogs.shift();

      if (attacker.currentHp <= 0) {
        collector.stop();
        await finishDuel(i, defender, attacker, p1Master, p2Master);
        return;
      }

      // Remains P1's turn
      activeUserId = p1.userId;
      const updatedEmbed = buildDuelEmbed(p1, p2, round, activeUserId, combatLogs);
      const updatedButtons = buildCombatButtons(p1);
      await i.update({ embeds: [updatedEmbed], components: updatedButtons });
      return;
    }

    // If opponent is another human player, switch active turn to Defender!
    round++;
    activeUserId = defender.userId;
    const nextCombatant = activeUserId === p1.userId ? p1 : p2;
    const updatedEmbed = buildDuelEmbed(p1, p2, round, activeUserId, combatLogs);
    const updatedButtons = buildCombatButtons(nextCombatant);

    await i.update({ embeds: [updatedEmbed], components: updatedButtons });
  });

  collector.on('end', async (_collected: any, reason: string) => {
    if (reason === 'time') {
      try {
        await battleMsg.edit({
          content: '⌛ Duel ended due to inactivity.',
          components: []
        });
      } catch {}
    }
  });
}

async function finishDuel(
  i: any,
  winner: DuelCombatant,
  loser: DuelCombatant,
  p1Master: MasterProfile,
  p2Master: MasterProfile | null
) {
  // Reward winner
  if (!winner.isAi) {
    const winningMaster = winner.userId === p1Master.discordId ? p1Master : p2Master;
    if (winningMaster) {
      winningMaster.saintQuartz += 3;
      winningMaster.grailWarWins = (winningMaster.grailWarWins || 0) + 1;
      const s = winningMaster.servants.find(srv => srv.id === winner.servant.id);
      if (s) {
        s.bondLevel = Math.min(10, (s.bondLevel || 1) + 1);
        s.availableStatPoints = (s.availableStatPoints || 0) + 2;
      }
      await saveMaster(winningMaster);
    }
  }

  const victoryQuote =
    winner.servant.customQuotes?.victory || winner.servant.template.victoryQuote;

  const resultEmbed = new EmbedBuilder()
    .setTitle(winner.isAi ? '☠️ DEFEAT IN THE DUEL' : '🏆 VICTORY ACHIEVED!')
    .setDescription(
      `**${winner.servant.template.name}** has defeated **${loser.servant.template.name}** in the Holy Grail duel!\n\n` +
      `💬 *"${victoryQuote}"*\n\n` +
      (!winner.isAi
        ? `💰 **Master Rewards:**\n` +
          `• +3 Saint Quartz 💎\n` +
          `• +300 Bond EXP (+1 Bond Level) 💖\n` +
          `• +2 Parameter Points 📊`
        : `*The Shadow Servant dissipates back into the void... Train and try again!*`)
    )
    .setColor(winner.isAi ? 0xef4444 : 0x22c55e);

  if (winner.servant.template.avatarUrl) {
    resultEmbed.setThumbnail(winner.servant.template.avatarUrl);
  }

  await i.update({
    embeds: [resultEmbed],
    components: []
  });
}
