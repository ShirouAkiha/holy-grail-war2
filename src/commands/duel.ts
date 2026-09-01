import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  AttachmentBuilder,
  User,
  ComponentType
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { MasterProfile, MasterServantInstance, CardType, ServantClass, ActiveCombatant, CombatTurnLog } from '../types';
import { SERVANT_DATABASE } from '../data/servants';
import { getOrInitWarSession, recordDuelOutcome } from '../engine/grailwar';
import { renderBattleTurnSummary } from '../canvas/renderer';

// ==========================================
// 1. SLASH COMMAND DEFINITION
// ==========================================
// Allows a Master to challenge either a human player via `@Master` or an AI Shadow Servant.
export const data = new SlashCommandBuilder()
  .setName('duel')
  .setDescription('Engage in a turn-based tactical Fate battle against another Master or AI Shadow Servant')
  .addUserOption(option =>
    option
      .setName('opponent')
      .setDescription('Target Master to duel (leave empty to challenge AI Shadow Master)')
      .setRequired(false)
  );

// ==========================================
// 2. COMBATANT INTERFACE
// ==========================================
// Represents an active fighter in the duel arena with runtime HP, NP gauge, and active buffs.
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

// ==========================================
// 3. FATE CLASS ADVANTAGE MULTIPLIER MATRIX
// ==========================================
// Implements canonical Fate/Grand Order 3-way triangular affinities:
// - Saber > Lancer > Archer > Saber (1.5x damage dealt / 0.5x taken)
// - Rider > Caster > Assassin > Rider
// - Berserker deals 1.5x to all classes and takes 1.5x damage from all classes
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

// ==========================================
// 4. COMBATANT FACTORY
// ==========================================
// Computes baseline stats + allocated Parameter points + Craft Essence bonuses.
function createCombatant(master: MasterProfile, servant: MasterServantInstance, isAi: boolean = false): DuelCombatant {
  const t = servant.template;
  const alloc = servant.allocatedStats || { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 };
  const base = t.baseStats || { strength: 10, endurance: 10, agility: 10, mana: 10, luck: 10 };
  const totalStr = (base.strength || 10) + (alloc.strength || 0);
  const totalEnd = (base.endurance || 10) + (alloc.endurance || 0);

  const ceAtk = servant.equippedCe?.atkBonus || 0;
  const ceHp = servant.equippedCe?.hpBonus || 0;
  const lvl = servant.level || 1;

  // Unified Formula: Base Stat * level Scaling + (Total Parameter * factor) + Craft Essence Equipment
  const maxHp = Math.round((t.baseHp || 12000) * (1 + (lvl - 1) * 0.05) + totalEnd * 150 + ceHp);
  const atk = Math.round((t.baseAtk || 10000) * (1 + (lvl - 1) * 0.05) + totalStr * 80 + ceAtk);
  const def = 10 + totalEnd * 2;

  // Check if equipped CE grants starting NP (e.g. Kaleidoscope grants 80% starting NP)
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

// ==========================================
// 5. VISUAL HEALTH BAR GENERATOR
// ==========================================
// Converts HP fraction into a colored emoji health bar with exact numbers and percentage.
function renderHealthBar(current: number, max: number, length: number = 10): string {
  const pct = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(pct * length);
  const empty = length - filled;
  const emoji = pct > 0.5 ? '🟩' : pct > 0.25 ? '🟨' : '🟥';
  return `${emoji.repeat(filled)}${'⬛'.repeat(empty)} \`${Math.max(0, current).toLocaleString()}/${max.toLocaleString()}\` (${Math.round(pct * 100)}%)`;
}

async function createTurnSummaryAttachment(
  p1: DuelCombatant,
  p2: DuelCombatant,
  round: number,
  lastLogText: string,
  p1Cards: CardType[] = ['Buster', 'Arts', 'Quick'],
  p2Cards: CardType[] = ['Arts', 'Buster', 'Quick']
): Promise<AttachmentBuilder> {
  const activeP1: ActiveCombatant = {
    id: p1.userId,
    name: p1.servant.template.name,
    masterName: p1.username,
    servantClass: p1.servant.template.servantClass,
    avatarUrl: p1.servant.template.avatarUrl || '',
    maxHp: p1.maxHp,
    currentHp: p1.currentHp,
    atk: p1.atk,
    def: p1.def,
    stats: p1.servant.template.baseStats,
    commandDeck: p1.servant.template.commandDeck,
    npGauge: p1.npGauge,
    activeBuffs: [],
    skills: [],
    noblePhantasm: p1.servant.template.noblePhantasm,
    critStars: p1.critStars
  };

  const activeP2: ActiveCombatant = {
    id: p2.userId,
    name: p2.servant.template.name,
    masterName: p2.username,
    servantClass: p2.servant.template.servantClass,
    avatarUrl: p2.servant.template.avatarUrl || '',
    maxHp: p2.maxHp,
    currentHp: p2.currentHp,
    atk: p2.atk,
    def: p2.def,
    stats: p2.servant.template.baseStats,
    commandDeck: p2.servant.template.commandDeck,
    npGauge: p2.npGauge,
    activeBuffs: [],
    skills: [],
    noblePhantasm: p2.servant.template.noblePhantasm,
    critStars: p2.critStars
  };

  const isCrit = lastLogText.includes('CRITICAL');
  const isNP = lastLogText.includes('NOBLE PHANTASM');

  const turnLog: CombatTurnLog = {
    turnNumber: round,
    actorId: p1.userId,
    actorName: p1.servant.template.name,
    targetId: p2.userId,
    targetName: p2.servant.template.name,
    actionSummary: lastLogText.replace(/\*\*/g, '').replace(/[\r\n]+/g, ' ').slice(0, 100),
    cardsUsed: p1Cards,
    p1Cards: p1Cards,
    p2Cards: p2Cards,
    skillsUsed: [],
    npTriggered: isNP,
    isNoblePhantasm: isNP,
    damageDealt: 0,
    isCritical: isCrit,
    starsGenerated: 0,
    npCharged: 0,
    actorHpRemaining: p1.currentHp,
    targetHpRemaining: p2.currentHp,
    actorHpMax: p1.maxHp,
    targetHpMax: p2.maxHp,
    actorNp: p1.npGauge,
    targetNp: p2.npGauge
  };

  const imageBuffer = await renderBattleTurnSummary(turnLog, activeP1, activeP2);
  return new AttachmentBuilder(imageBuffer, { name: 'turn_summary.png' });
}

// ==========================================
// 6. DUEL UI EMBED BUILDER
// ==========================================
function buildDuelEmbed(
  p1: DuelCombatant,
  p2: DuelCombatant,
  round: number,
  activeUserId: string,
  _lastLogs?: string[]
) {
  const isP1Turn = activeUserId === p1.userId;
  const activeCombatant = isP1Turn ? p1 : p2;

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ HOLY GRAIL WAR DUEL — ROUND ${round}`)
    .setImage('attachment://turn_summary.png')
    .setDescription(
      `👉 **Current Turn:** ${activeCombatant.isAi ? '🤖 Shadow AI is calculating...' : `<@${activeCombatant.userId}>, select your Command Card or Noble Phantasm:`}`
    )
    .setColor(isP1Turn ? 0xef4444 : 0x38bdf8);

  return embed;
}

// ==========================================
// 7. INTERACTIVE ACTION BUTTON BUILDER
// ==========================================
// Generates buttons for Buster, Arts, Quick, Noble Phantasm (locked unless NP >= 100%), and Skills.
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
      .setDisabled(!isNpReady), // Disabled until NP is fully charged
    new ButtonBuilder()
      .setCustomId('card_skill')
      .setLabel(`${combatant.servant.template.skills[0]?.name || 'Activate Skill'}`)
      .setEmoji('🛡️')
      .setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2];
}

// ==========================================
// 8. TURN RESOLUTION & DAMAGE CALCULATION
// ==========================================
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

  // ACTION 1: BUSTER CARD (Maximum raw damage + Critical multiplier)
  if (actionType === 'buster') {
    const isCrit = Math.random() < attacker.critStars / 100; // Critical chance based on gathered stars
    const baseAtk = attacker.atk * 1.5;
    const critMult = isCrit ? 2.0 : 1.0;
    rawDmg = Math.round((baseAtk - defender.def * 10) * classMult * critMult * (0.9 + Math.random() * 0.2));
    rawDmg = Math.max(800, rawDmg);
    attacker.npGauge = Math.min(300, attacker.npGauge + 10);
    attacker.critStars = Math.max(0, attacker.critStars - 5);

    logText = `🔴 **${attacker.servant.template.name}** unleashed **Buster Brave** ${isCrit ? '💥 **CRITICAL HIT!**' : ''} dealing **${rawDmg.toLocaleString()} DMG** to ${defender.servant.template.name}!`;
  } 
  // ACTION 2: ARTS CARD (High NP gauge acquisition)
  else if (actionType === 'arts') {
    const baseAtk = attacker.atk * 1.1;
    rawDmg = Math.round((baseAtk - defender.def * 10) * classMult * (0.9 + Math.random() * 0.2));
    rawDmg = Math.max(600, rawDmg);
    const npCharge = Math.round(35 + Math.random() * 15);
    attacker.npGauge = Math.min(300, attacker.npGauge + npCharge);

    logText = `🔵 **${attacker.servant.template.name}** connected with **Arts Chain**, dealing **${rawDmg.toLocaleString()} DMG** and gaining **+${npCharge}% NP**!`;
  } 
  // ACTION 3: QUICK CARD (Generates Critical Stars for future turns)
  else if (actionType === 'quick') {
    const baseAtk = attacker.atk * 0.95;
    rawDmg = Math.round((baseAtk - defender.def * 10) * classMult * (0.9 + Math.random() * 0.2));
    rawDmg = Math.max(500, rawDmg);
    const starsGained = 25;
    attacker.critStars = Math.min(50, attacker.critStars + starsGained);
    attacker.npGauge = Math.min(300, attacker.npGauge + 15);

    logText = `🟢 **${attacker.servant.template.name}** performed **Quick Strike**, dealing **${rawDmg.toLocaleString()} DMG** and gathering **+${starsGained} Critical Stars**!`;
  } 
  // ACTION 4: NOBLE PHANTASM (Ultimate move with custom chant & massive damage)
  else if (actionType === 'np') {
    const npTemplate = attacker.servant.template.noblePhantasm;
    const baseAtk = attacker.atk * 3.5;
    rawDmg = Math.round((baseAtk - defender.def * 10) * classMult * (0.95 + Math.random() * 0.15));
    rawDmg = Math.max(3500, rawDmg);
    attacker.npGauge = 0; // Consume 100% NP

    const chant = attacker.servant.customQuotes?.noblePhantasm || npTemplate.chant;
    logText = `💥 **NOBLE PHANTASM UNLEASHED!**\n> *" ${chant} "*\n> **${attacker.servant.template.name}** obliterated ${defender.servant.template.name} with **${npTemplate.name}** for **${rawDmg.toLocaleString()} colossal DMG**!`;
  } 
  // ACTION 5: CLASS SKILL (Attack buff & utility recharge)
  else if (actionType === 'skill') {
    const skill = attacker.servant.template.skills[0];
    attacker.atk = Math.round(attacker.atk * 1.3);
    attacker.critStars += 15;
    attacker.npGauge = Math.min(300, attacker.npGauge + 20);

    logText = `🛡️ **${attacker.servant.template.name}** activated **${skill?.name || 'Class Skill'}**, gaining **+30% ATK Buff**, +20% NP, and +15 Stars!`;
  }

  // Apply damage to defender HP
  defender.currentHp = Math.max(0, defender.currentHp - rawDmg);
  return logText;
}

// ==========================================
// 9. SLASH COMMAND EXECUTION
// ==========================================
export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const challengerMaster = await getOrCreateMaster(interaction.user.id, interaction.user.username);

    // Verify challenger has summoned at least 1 Servant
    if (!challengerMaster.servants || challengerMaster.servants.length === 0) {
      await interaction.reply({
        ephemeral: true,
        content: '❌ You must summon a Servant using `/summon` before entering a duel!'
      });
      return;
    }

    const warSession = getOrInitWarSession(challengerMaster);

    // Check if challenger is eliminated from the Holy Grail War
    const challengerParticipant = warSession.participants[challengerMaster.discordId] ||
      Object.values(warSession.participants).find(p => p.username.toLowerCase() === challengerMaster.username.toLowerCase());

    if (challengerParticipant && !challengerParticipant.isAlive) {
      const deadEmbed = new EmbedBuilder()
        .setTitle('☠️ DECEASED MASTERS CANNOT DUEL')
        .setDescription(
          `Master **${challengerMaster.username}**, you were slain and permanently eliminated from the active Holy Grail War.\n\n` +
          `• **Status:** 💀 Deceased (HP: 0/${challengerParticipant.maxHp})\n` +
          `• **Command Seals:** 0 / 3 (Extinguished)\n\n` +
          `You cannot initiate duels while deceased. Inspect the battle status with \`/grailwar status\` or restart the tournament.`
        )
        .setColor(0xef4444);

      await interaction.reply({ embeds: [deadEmbed], ephemeral: true });
      return;
    }

    const challengerServant =
      challengerMaster.servants.find(s => s.id === challengerMaster.activeServantId) ||
      challengerMaster.servants[0];

    const opponentUser = interaction.options.getUser('opponent');

    // BRANCH 1: CHALLENGING A SPECIFIC HUMAN MASTER BY MENTION
    if (opponentUser) {
      if (opponentUser.id === interaction.user.id) {
        await interaction.reply({ content: '❌ You cannot duel yourself!', ephemeral: true });
        return;
      }
      if (opponentUser.bot) {
        await interaction.reply({ content: '❌ You cannot duel a Discord bot! Holy Grail War only features real Masters.', ephemeral: true });
        return;
      }

      const opponentMaster = await getOrCreateMaster(opponentUser.id, opponentUser.username);

      if (!opponentMaster.servants || opponentMaster.servants.length === 0) {
        await interaction.reply({
          content: `❌ <@${opponentUser.id}> has not summoned any Servants yet! They need to run \`/summon\` first.`,
          ephemeral: true
        });
        return;
      }

      const opponentParticipant = warSession.participants[opponentUser.id] ||
        Object.values(warSession.participants).find(p => p.username.toLowerCase() === opponentUser.username.toLowerCase());

      if (opponentParticipant && !opponentParticipant.isAlive) {
        await interaction.reply({
          content: `☠️ <@${opponentUser.id}> has already been eliminated and slain from the Holy Grail War!`,
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
        time: 60000 // 60s to accept
      });

      inviteCollector.on('collect', async i => {
        if (i.replied || i.deferred) return;
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

    // BRANCH 2: OPEN / QUICK DUEL AGAINST ANOTHER REAL LIVING MASTER
    const livingRivalParticipants = Object.values(warSession.participants).filter(
      p => p.discordId !== challengerMaster.discordId &&
           p.username.toLowerCase() !== challengerMaster.username.toLowerCase() &&
           p.isAlive
    );

    if (livingRivalParticipants.length === 0) {
      const noRivalsEmbed = new EmbedBuilder()
        .setTitle('⚔️ NO RIVAL MASTERS AVAILABLE IN FUYUKI')
        .setDescription(
          `There are currently no other living Masters with contracted Servants in the server to duel.\n\n` +
          `• **Pure Master vs Master:** The Holy Grail War is fought exclusively by actual server members — no NPCs or synthetic shadows.\n` +
          `• **How to Join:** Invite other members of the server to invoke \`/summon ritual\` to contract a Heroic Spirit and enter the war!\n` +
          `• Check currently active participants at any time with \`/grailwar status\`.`
        )
        .setColor(0x64748b)
        .setFooter({ text: 'Holy Grail War • Real Masters Only' });

      await interaction.reply({
        embeds: [noRivalsEmbed],
        ephemeral: false
      });
      return;
    }

    // Pick a random living rival Master from the server
    const targetRival = livingRivalParticipants[Math.floor(Math.random() * livingRivalParticipants.length)];
    const opponentMaster = await getOrCreateMaster(targetRival.discordId, targetRival.username);
    const opponentServant =
      opponentMaster.servants.find(s => s.id === opponentMaster.activeServantId) ||
      opponentMaster.servants[0];

    if (!opponentServant) {
      await interaction.reply({
        content: `❌ Rival Master **${targetRival.username}** has not summoned a Servant yet.`,
        ephemeral: true
      });
      return;
    }

    const inviteEmbed = new EmbedBuilder()
      .setTitle('⚔️ HOLY GRAIL WAR: DUEL INVITATION')
      .setDescription(
        `Master <@${interaction.user.id}> with **${challengerServant.template.name}** (${challengerServant.template.servantClass})\n` +
        `has challenged rival Master <@${targetRival.discordId}> (**${targetRival.username}**) with **${opponentServant.template.name}** (${opponentServant.template.servantClass}) to a duel!\n\n` +
        `<@${targetRival.discordId}>, do you accept this challenge?`
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
      content: `<@${targetRival.discordId}>`,
      embeds: [inviteEmbed],
      components: [inviteRow],
      fetchReply: true
    });

    const inviteCollector = inviteMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000
    });

    inviteCollector.on('collect', async i => {
      if (i.replied || i.deferred) return;
      if (i.user.id !== targetRival.discordId && i.user.id !== interaction.user.id) {
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

      if (i.customId === 'accept_duel' && i.user.id === targetRival.discordId) {
        inviteCollector.stop();
        const p1 = createCombatant(challengerMaster, challengerServant, false);
        const p2 = createCombatant(opponentMaster, opponentServant, false);
        await startInteractiveDuel(i, p1, p2, challengerMaster, opponentMaster);
      }
    });

  } catch (error: any) {
    console.error('Error executing /duel:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: `❌ Error starting duel: ${error.message}`, ephemeral: true });
    } else {
      await interaction.reply({ content: `❌ Error starting duel: ${error.message}`, ephemeral: true });
    }
  }
}

// ==========================================
// 10. MULTI-TURN INTERACTIVE DUEL LOOP
// ==========================================
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

  const initialAttachment = await createTurnSummaryAttachment(p1, p2, round, combatLogs[0]);
  const initialEmbed = buildDuelEmbed(p1, p2, round, activeUserId, combatLogs);
  const initialButtons = buildCombatButtons(p1);

  let battleMsg: any;
  if (contextInteraction.isButton && contextInteraction.isButton()) {
    battleMsg = await contextInteraction.update({
      content: null,
      embeds: [initialEmbed],
      files: [initialAttachment],
      components: initialButtons,
      fetchReply: true
    });
  } else {
    battleMsg = await contextInteraction.reply({
      embeds: [initialEmbed],
      files: [initialAttachment],
      components: initialButtons,
      fetchReply: true
    });
  }

  // Component Collector for turn choices
  const collector = battleMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 180000 // 3 minutes timeout
  });

  collector.on('collect', async (i: any) => {
    try {
      if (i.replied || i.deferred) return;
      // Enforce Turn Order: Block clicks if it is not this player's turn
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

    // Execute Player attack
    const log = resolveStrike(attacker, defender, actionType);
    combatLogs.push(log);
    if (combatLogs.length > 4) combatLogs.shift(); // Keep last 4 logs clean

    // Check if Defender fainted
    if (defender.currentHp <= 0) {
      collector.stop();
      await finishDuel(i, attacker, defender, p1Master, p2Master);
      return;
    }

    const p1CardChoice: CardType[] = actionType === 'buster' ? ['Buster', 'Buster', 'Buster'] : actionType === 'arts' ? ['Arts', 'Arts', 'Arts'] : ['Quick', 'Quick', 'Quick'];
    let p2CardChoice: CardType[] = ['Arts', 'Buster', 'Quick'];

    // CASE A: Opponent is AI -> AI immediately strikes back
    if (defender.isAi) {
      round++;
      const aiAction = defender.npGauge >= 100 ? 'np' : Math.random() > 0.5 ? 'buster' : 'arts';
      p2CardChoice = aiAction === 'buster' ? ['Buster', 'Buster', 'Buster'] : aiAction === 'arts' ? ['Arts', 'Arts', 'Arts'] : ['Quick', 'Quick', 'Quick'];
      const aiLog = resolveStrike(defender, attacker, aiAction);
      combatLogs.push(aiLog);
      if (combatLogs.length > 4) combatLogs.shift();

      if (attacker.currentHp <= 0) {
        collector.stop();
        await finishDuel(i, defender, attacker, p1Master, p2Master);
        return;
      }

      // Keep turn on P1
      activeUserId = p1.userId;
      const turnAttachment = await createTurnSummaryAttachment(p1, p2, round, log, p1CardChoice, p2CardChoice);
      const updatedEmbed = buildDuelEmbed(p1, p2, round, activeUserId, combatLogs);
      const updatedButtons = buildCombatButtons(p1);
      await i.update({ embeds: [updatedEmbed], files: [turnAttachment], components: updatedButtons });
      return;
    }

    // CASE B: Opponent is human -> Swap active player turn
    round++;
    activeUserId = defender.userId;
    const nextCombatant = activeUserId === p1.userId ? p1 : p2;
    const turnAttachment = await createTurnSummaryAttachment(p1, p2, round, log, p1CardChoice, p2CardChoice);
    const updatedEmbed = buildDuelEmbed(p1, p2, round, activeUserId, combatLogs);
    const updatedButtons = buildCombatButtons(nextCombatant);

    await i.update({ embeds: [updatedEmbed], files: [turnAttachment], components: updatedButtons });
    } catch (err: any) {
      if (err.code === 10062 || err.message?.includes('Unknown interaction')) return;
      console.error('Error in duel battle collector:', err);
    }
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

// ==========================================
// 11. VICTORY REWARDS & DUEL CONCLUSION
// ==========================================
async function finishDuel(
  i: any,
  winner: DuelCombatant,
  loser: DuelCombatant,
  p1Master: MasterProfile,
  p2Master: MasterProfile | null
) {
  const warSession = getOrInitWarSession(p1Master);

  const chanTag = i.channel && 'name' in i.channel ? `#${(i.channel as any).name}` : '#general';

  // If AI opponent defeated the player Master, automatically eliminate player Master
  if (winner.isAi) {
    const outcome = recordDuelOutcome(warSession, winner.username, loser.username, 'kill', chanTag);

    const defeatEmbed = new EmbedBuilder()
      .setTitle('☠️ FATAL DUEL DEFEAT — MASTER ELIMINATED')
      .setDescription(
        `**${winner.servant.template.name}** (Master: ${winner.username}) has dealt a mortal blow to **${loser.servant.template.name}** (Master: ${loser.username})!\n\n` +
        `💬 *"${loser.servant.customQuotes?.defeat || loser.servant.template.defeatQuote}"*\n\n` +
        `💀 **You have been PERMANENTLY ELIMINATED from the Holy Grail War.**\n` +
        `Your status on the Intelligence Board (/grailwar) is now **💀 DECEASED** (HP: 0).`
      )
      .setColor(0xef4444);

    if (loser.servant.template.avatarUrl) {
      defeatEmbed.setThumbnail(loser.servant.template.avatarUrl);
    }

    await i.update({
      embeds: [defeatEmbed],
      components: []
    });
    return;
  }

  // Player Master won: Grant initial rewards and prompt for Kill vs Spare decision
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

  const victoryQuote =
    winner.servant.customQuotes?.victory || winner.servant.template.victoryQuote;

  const fateEmbed = new EmbedBuilder()
    .setTitle('🏆 DUEL VICTORY — DECIDE MASTER\'S FATE')
    .setDescription(
      `**${winner.servant.template.name}** (Master: ${winner.username}) has brought down **${loser.servant.template.name}** (Master: ${loser.username})!\n\n` +
      `💬 *"${victoryQuote}"*\n\n` +
      `⚖️ **The Fate of Master ${loser.username} rests in your hands:**\n` +
      `Choose whether to **Execute** the defeated Master to permanently eliminate them from the Holy Grail War, or show mercy and **Spare** their life.`
    )
    .setColor(0x22c55e);

  if (winner.servant.template.avatarUrl) {
    fateEmbed.setThumbnail(winner.servant.template.avatarUrl);
  }

  const fateRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('duel_fate_kill')
      .setLabel('☠️ Execute Master (Kill & Eliminate)')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('duel_fate_spare')
      .setLabel('🕊️ Spare Master (Show Mercy)')
      .setStyle(ButtonStyle.Success)
  );

  const response = await i.update({
    embeds: [fateEmbed],
    components: [fateRow],
    fetchReply: true
  });

  try {
    const confirmation = await response.awaitMessageComponent({
      filter: (btnInteraction: any) => btnInteraction.user.id === winner.userId,
      time: 60000,
      componentType: ComponentType.Button
    });

    const decision = confirmation.customId === 'duel_fate_kill' ? 'kill' : 'spare';
    const outcome = recordDuelOutcome(warSession, winner.username, loser.username, decision, chanTag);

    if (decision === 'kill') {
      const execEmbed = new EmbedBuilder()
        .setTitle('☠️ FATE SEALED — MASTER EXECUTED')
        .setDescription(
          `Master **${winner.username}** has chosen to **EXECUTE** Master **${loser.username}**!\n\n` +
          `☠️ Master **${loser.username}** (${loser.servant.template.name}) was slain and **PERMANENTLY ELIMINATED** from the Holy Grail War.\n\n` +
          `💰 **Master Rewards:** +3 Saint Quartz 💎 | +300 Bond EXP 💖 | +2 Parameter Points 📊`
        )
        .setColor(0xef4444);

      await confirmation.update({
        embeds: [execEmbed],
        components: []
      });
    } else {
      const spareEmbed = new EmbedBuilder()
        .setTitle('🕊️ MERCY BESTOWED — MASTER SPARED')
        .setDescription(
          `Master **${winner.username}** has chosen to **SPARE** Master **${loser.username}**!\n\n` +
          `🕊️ Mercy was shown. Master **${loser.username}** survives on critical HP (${outcome.defeatedMaster?.currentHp || 1000}/${outcome.defeatedMaster?.maxHp || 15000}), but remains in the war.\n\n` +
          `💰 **Master Rewards:** +3 Saint Quartz 💎 | +300 Bond EXP 💖 | +2 Parameter Points 📊`
        )
        .setColor(0x22c55e);

      await confirmation.update({
        embeds: [spareEmbed],
        components: []
      });
    }
  } catch {
    // Timeout default: spare
    recordDuelOutcome(warSession, winner.username, loser.username, 'spare', chanTag);
    await i.editReply({
      components: []
    });
  }
}
