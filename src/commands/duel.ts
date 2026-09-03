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
import { getOrCreateMaster, saveMaster, getDuelNpSettings } from '../database/service';
import { MasterProfile, MasterServantInstance, CardType, ServantClass, ActiveCombatant, CombatTurnLog, PassiveSkill } from '../types';
import { SERVANT_DATABASE, getDefaultClassPassives, getUnlockedPassives } from '../data/servants';
import { getOrInitWarSession, recordDuelOutcome, calculateCurrentHp } from '../engine/grailwar';
import { renderBattleTurnSummary } from '../canvas/renderer';
import { PVP_DAMAGE_MODIFIER } from '../engine/battle';
import { getNoblePhantasmGif, getNoblePhantasmChant } from '../data/noblePhantasmGifs';

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
// 2. COMBATANT INTERFACE & BUFFS
// ==========================================
export interface CombatantBuff {
  name: string;
  type: 'buff_atk' | 'buff_def' | 'crit_dmg' | 'evade' | 'guts' | 'np_gen' | 'buster_up' | 'arts_up' | 'quick_up' | 'invincible' | 'stun';
  value: number;
  remainingTurns: number;
}

export interface DuelCombatant {
  userId: string;
  username: string;
  isAi: boolean;
  servant: MasterServantInstance;
  currentHp: number;
  maxHp: number;
  baseAtk: number;
  atk: number;
  baseDef: number;
  def: number;
  npGauge: number;
  critStars: number;
  passives?: PassiveSkill[];
  activeBuffs: CombatantBuff[];
  skillCooldowns: { [skillIdx: number]: number };
  gutsCount: number;
  commandSeals: number;
  currentHand?: ('Buster' | 'Arts' | 'Quick')[];
  drawPile?: ('Buster' | 'Arts' | 'Quick')[];
}

// ==========================================
// CLASS COMMAND DECKS & HAND DEALING ENGINE
// ==========================================
function getServantCommandDeck(combatant: DuelCombatant): ('Buster' | 'Arts' | 'Quick')[] {
  if (combatant.servant?.template?.commandDeck && combatant.servant.template.commandDeck.length === 5) {
    return [...combatant.servant.template.commandDeck];
  }
  const sClass = combatant.servant?.template?.servantClass || 'Saber';
  switch (sClass) {
    case 'Caster':
      // Triple Arts Deck (Caster archetype): 3 Arts, 1 Buster, 1 Quick
      return ['Arts', 'Arts', 'Arts', 'Buster', 'Quick'];
    case 'Berserker':
      // Triple Buster Deck (Berserker archetype): 3 Buster, 1 Arts, 1 Quick
      return ['Buster', 'Buster', 'Buster', 'Arts', 'Quick'];
    case 'Assassin':
      // Triple Quick Deck (Assassin archetype): 3 Quick, 1 Arts, 1 Buster
      return ['Quick', 'Quick', 'Quick', 'Arts', 'Buster'];
    case 'Lancer':
      // Double Buster, Double Quick: 2 Buster, 2 Quick, 1 Arts
      return ['Buster', 'Buster', 'Quick', 'Quick', 'Arts'];
    case 'Rider':
      // Double Quick, Double Arts: 2 Quick, 2 Arts, 1 Buster
      return ['Quick', 'Quick', 'Arts', 'Arts', 'Buster'];
    case 'Archer':
      // Double Arts, Double Quick: 2 Arts, 2 Quick, 1 Buster
      return ['Arts', 'Arts', 'Quick', 'Quick', 'Buster'];
    case 'Saber':
    default:
      // Double Buster, Double Arts: 2 Buster, 2 Arts, 1 Quick
      return ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'];
  }
}

function refreshCombatantHand(combatant: DuelCombatant): ('Buster' | 'Arts' | 'Quick')[] {
  // Canonical FGO 3-Turn Deck Cycle:
  // A complete draw deck cycle consists of 15 cards (3 copies of the Servant's 5-card command deck).
  // Cards are drawn 5 at a time without replacement across a 3-turn cycle.
  // When the draw pile runs out (< 5 cards), a fresh 15-card shoe is generated and shuffled.
  if (!combatant.drawPile || combatant.drawPile.length < 5) {
    const deck = getServantCommandDeck(combatant);
    const freshShoe: ('Buster' | 'Arts' | 'Quick')[] = [...deck, ...deck, ...deck];
    // Fisher-Yates shuffle the 15-card shoe
    for (let i = freshShoe.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [freshShoe[i], freshShoe[j]] = [freshShoe[j], freshShoe[i]];
    }
    combatant.drawPile = freshShoe;
  }

  // Draw top 5 cards from the 15-card shoe
  const hand = combatant.drawPile.splice(0, 5);
  combatant.currentHand = hand;
  return hand;
}

// ==========================================
// 3. FATE CLASS ADVANTAGE MULTIPLIER MATRIX
// ==========================================
// Implements canonical Fate/Grand Order 3-way triangular affinities:
// - Saber > Lancer > Archer > Saber (1.5x damage dealt / 0.5x taken)
// - Rider > Caster > Assassin > Rider (1.5x damage dealt / 0.5x taken)
// - Berserker deals 1.5x to all classes and takes 1.5x damage from all classes
// - Ruler resists standard 6, Avenger beats Ruler (2.0x)
function getClassMultiplier(attacker: ServantClass, defender: ServantClass): number {
  if (attacker === defender) return 1.0;

  const advantage: Record<string, string[]> = {
    Saber: ['Lancer'],
    Lancer: ['Archer'],
    Archer: ['Saber'],
    Rider: ['Caster'],
    Caster: ['Assassin'],
    Assassin: ['Rider'],
    Berserker: ['Saber', 'Lancer', 'Archer', 'Rider', 'Caster', 'Assassin', 'Ruler', 'Shitposter'],
    Ruler: ['MoonCancer', 'Berserker'],
    Avenger: ['Ruler', 'Berserker'],
    Foreigner: ['Berserker'],
    Shitposter: ['Saber', 'Archer', 'Lancer', 'Rider', 'Caster', 'Assassin', 'Berserker']
  };

  const disadvantage: Record<string, string[]> = {
    Saber: ['Archer'],
    Lancer: ['Saber'],
    Archer: ['Lancer'],
    Rider: ['Assassin'],
    Caster: ['Rider'],
    Assassin: ['Caster'],
    Ruler: ['Avenger']
  };

  if (advantage[attacker]?.includes(defender)) return 1.35;
  if (disadvantage[attacker]?.includes(defender)) return 0.75;
  if (defender === 'Berserker') return 1.35;
  return 1.0;
}

// ==========================================
// 4. COMBATANT FACTORY
// ==========================================
// Computes baseline stats + allocated Parameter points + Craft Essence bonuses.
function createCombatant(master: MasterProfile, servant: MasterServantInstance, isAi: boolean = false, overrideCurrentHp?: number): DuelCombatant {
  const templateId = servant.templateId || servant.template?.id || servant.id;
  const canonical = SERVANT_DATABASE.find(s => s.id === templateId) || servant.template;
  const t = { ...canonical, ...(servant.template?.isCustomOrMeme ? servant.template : {}) };
  const alloc = servant.allocatedStats || { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 };
  const base = t.baseStats || { strength: 10, endurance: 10, agility: 10, mana: 10, luck: 10 };
  const totalStr = (base.strength || 10) + (alloc.strength || 0);
  const totalEnd = (base.endurance || 10) + (alloc.endurance || 0);
  const totalAgi = (base.agility || 10) + (alloc.agility || 0);

  const ceAtk = servant.equippedCe?.atkBonus || 0;
  const ceHp = servant.equippedCe?.hpBonus || 0;
  const lvl = servant.level || 1;

  // Unified Formula: Base Stat * level Scaling + (Total Parameter * factor) + Craft Essence Equipment
  const maxHp = Math.round((t.baseHp || 28000) * (1 + (lvl - 1) * 0.05) + totalEnd * 150 + ceHp);
  const baseAtk = Math.round((t.baseAtk || 10000) * (1 + (lvl - 1) * 0.05) + totalStr * 80 + ceAtk);
  const baseDef = 10 + totalEnd * 2;

  // Check if equipped CE grants starting NP (e.g. Kaleidoscope grants 80% starting NP)
  let initialNp = 0;
  if (servant.equippedCe?.passiveType === 'starting_np') {
    initialNp = servant.equippedCe.passiveValue || 50;
  }

  // Resolve Passives (Strict max 2 passives; Slot 2 unlocks after Bond Lv. 5)
  const bondLevel = servant.bondLevel || 1;
  const rawPassives: PassiveSkill[] = (t.passives && t.passives.length > 0)
    ? t.passives
    : getDefaultClassPassives(t.servantClass);
  const passives: PassiveSkill[] = getUnlockedPassives(rawPassives, bondLevel);

  // Initial stars based on Agility + Presence Concealment passive bonus
  const pcBonus = passives.some(p => p.type === 'presence_concealment') ? 6 : 0;
  const initialStars = Math.min(40, Math.max(5, Math.round(totalAgi * 0.8) + pcBonus));

  const startingHp = overrideCurrentHp !== undefined && overrideCurrentHp > 0
    ? Math.min(maxHp, Math.round(overrideCurrentHp))
    : maxHp;

  const combatant: DuelCombatant = {
    userId: master.discordId,
    username: master.username,
    isAi,
    servant,
    currentHp: startingHp,
    maxHp,
    baseAtk,
    atk: baseAtk,
    baseDef,
    def: baseDef,
    npGauge: initialNp,
    critStars: initialStars,
    passives,
    activeBuffs: [],
    skillCooldowns: {},
    gutsCount: 0,
    commandSeals: isAi ? 0 : (master.commandSeals ?? 3),
    drawPile: []
  };
  refreshCombatantHand(combatant);
  return combatant;
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
  p1Cards: ('Buster' | 'Arts' | 'Quick' | 'NP')[] = ['Buster', 'Arts', 'Quick'],
  p2Cards: ('Buster' | 'Arts' | 'Quick' | 'NP')[] = ['Arts', 'Buster', 'Quick']
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
    activeBuffs: p1.activeBuffs.map(b => ({ name: b.name, type: b.type, value: b.value, remainingTurns: b.remainingTurns })),
    skills: (p1.servant.template.skills || []).map((s, idx) => ({ ...s, currentCooldown: p1.skillCooldowns[idx] || 0 })),
    noblePhantasm: p1.servant.template.noblePhantasm,
    critStars: p1.critStars,
    bondLevel: p1.servant.bondLevel || 1
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
    activeBuffs: p2.activeBuffs.map(b => ({ name: b.name, type: b.type, value: b.value, remainingTurns: b.remainingTurns })),
    skills: (p2.servant.template.skills || []).map((s, idx) => ({ ...s, currentCooldown: p2.skillCooldowns[idx] || 0 })),
    noblePhantasm: p2.servant.template.noblePhantasm,
    critStars: p2.critStars,
    bondLevel: p2.servant.bondLevel || 1
  };

  const isCrit = lastLogText.includes('CRITICAL');
  const isNP = lastLogText.includes('NOBLE PHANTASM');

  // Extract damage, NP gained, stars generated via regex
  const dmgMatch = lastLogText.match(/Dealt \*\*([\d,]+) DMG\*\*/i) || lastLogText.match(/([\d,]+)\s*DMG/i);
  const damageDealt = dmgMatch ? parseInt(dmgMatch[1].replace(/,/g, ''), 10) : 0;

  const npMatch = lastLogText.match(/\+(\d+)%\s*NP/i);
  const npCharged = npMatch ? parseInt(npMatch[1], 10) : 0;

  const starMatch = lastLogText.match(/\+(\d+)\s*Critical Stars/i) || lastLogText.match(/\+(\d+)\s*Stars/i);
  const starsGenerated = starMatch ? parseInt(starMatch[1], 10) : 0;

  const cleanActionSummary = lastLogText
    .replace(/[*_~`>#]/g, '')
    .replace(/[⚔️💥✨🌀⚡🔴🔵🟢🛡️👑🌟🗡️🔥💀🩸]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  const turnLog: CombatTurnLog = {
    turnNumber: round,
    actorId: p1.userId,
    actorName: p1.servant.template.name,
    targetId: p2.userId,
    targetName: p2.servant.template.name,
    actionSummary: cleanActionSummary,
    cardsUsed: p1Cards,
    p1Cards: p1Cards,
    p2Cards: p2Cards,
    skillsUsed: [],
    npTriggered: isNP,
    isNoblePhantasm: isNP,
    damageDealt,
    isCritical: isCrit,
    starsGenerated,
    npCharged,
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
  lastLogs?: string[],
  pendingCards: ('Buster' | 'Arts' | 'Quick' | 'NP')[] = [],
  pendingIndices: number[] = []
) {
  const isP1Turn = activeUserId === p1.userId;
  const activeCombatant = isP1Turn ? p1 : p2;

  if (!activeCombatant.currentHand || activeCombatant.currentHand.length !== 5) {
    refreshCombatantHand(activeCombatant);
  }

  const handCards = activeCombatant.currentHand!;
  const handDisplay = handCards.map((c, i) => {
    const emoji = c === 'Buster' ? '🔴' : c === 'Arts' ? '🔵' : '🟢';
    const isUsed = pendingIndices.includes(i);
    return isUsed ? `\`[#${pendingIndices.indexOf(i) + 1}: ${c} ✔️]\`` : `\`[${i + 1}: ${emoji} ${c}]\``;
  }).join(' ');

  const npType = activeCombatant.servant.template?.noblePhantasm?.cardType || 'Buster';
  const npScope = activeCombatant.servant.template?.noblePhantasm?.target || 'single';
  const npEmoji = npType === 'Buster' ? '🔴' : npType === 'Arts' ? '🔵' : '🟢';

  const cardEmojiMap: Record<string, string> = {
    Buster: '🔴 Buster',
    Arts: '🔵 Arts',
    Quick: '🟢 Quick',
    NP: `${npEmoji} NP [${npType} • ${npScope.toUpperCase()}]`
  };

  const c1Text = pendingCards[0] ? cardEmojiMap[pendingCards[0]] || pendingCards[0] : '❓ Card 1 (1.0x Lead)';
  const c2Text = pendingCards[1] ? cardEmojiMap[pendingCards[1]] || pendingCards[1] : '❓ Card 2 (1.2x)';
  const c3Text = pendingCards[2] ? cardEmojiMap[pendingCards[2]] || pendingCards[2] : '❓ Card 3 (1.4x)';

  let leadHelp = '';
  if (pendingCards.length > 0) {
    const first = pendingCards[0];
    const effectiveFirst = first === 'NP' ? npType : first;
    if (effectiveFirst === 'Buster') leadHelp = '\n🔥 *1st Buster Lead: +50% DMG to remaining cards!*';
    else if (effectiveFirst === 'Arts') leadHelp = '\n🌊 *1st Arts Lead: +100% NP Gain to remaining cards!*';
    else if (effectiveFirst === 'Quick') leadHelp = '\n⚡ *1st Quick Lead: +20% Crit Rate & Star Drop!*';
  }

  const sClass = activeCombatant.servant.template?.servantClass || 'Servant';
  const activePassives = activeCombatant.passives || [];
  const rawPassives = (activeCombatant.servant.template?.passives && activeCombatant.servant.template.passives.length > 0)
    ? activeCombatant.servant.template.passives.slice(0, 2)
    : getDefaultClassPassives(sClass).slice(0, 2);
  const bond = activeCombatant.servant.bondLevel || 1;
  const lockedNote = rawPassives.length >= 2 && bond < 5 ? ' 🔒 *(2nd Passive unlocks at Bond 5)*' : '';
  const passivesText = activePassives.length > 0
    ? activePassives.map(p => `\`[${p.name}]\``).join(' ')
    : '`None`';
  const cardsRemainingInCycle = activeCombatant.drawPile?.length ?? 0;
  const cycleTurn = 3 - Math.floor(cardsRemainingInCycle / 5);
  const slotDisplay = `🎴 **Dealt Command Hand (${sClass} Deck • Turn ${cycleTurn}/3):**\n${handDisplay}\n\n🛡️ **Active Class Passives (Max 2):** ${passivesText}${lockedNote}\n\n⚔️ **Selected Chain (${pendingCards.length}/3):**\n\`[ 1: ${c1Text} ]\` ➔ \`[ 2: ${c2Text} ]\` ➔ \`[ 3: ${c3Text} ]\`${leadHelp}`;

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ HOLY GRAIL WAR DUEL — ROUND ${round}`)
    .setImage('attachment://turn_summary.png')
    .setDescription(
      `👉 **Current Turn:** ${activeCombatant.isAi ? '🤖 Shadow AI is calculating...' : `<@${activeCombatant.userId}>, pick **3 Cards** from your dealt hand:`}\n\n${slotDisplay}`
    )
    .setColor(isP1Turn ? 0xef4444 : 0x38bdf8);

  if (lastLogs && lastLogs.length > 0) {
    const recent = lastLogs.slice(-2).join('\n\n');
    embed.addFields({
      name: '📜 Battle Log',
      value: recent.length > 1000 ? recent.slice(0, 1000) + '...' : recent
    });
  }

  return embed;
}

// ==========================================
// 7. INTERACTIVE ACTION BUTTON BUILDER
// ==========================================
// Generates 3 rows:
// Row 1: 5 Dealt Command Cards from Servant Class Deck
// Row 2: Noble Phantasm + Reset + Command Seal
// Row 3: 3 Active Skill Sets
function buildCombatButtons(
  combatant: DuelCombatant,
  pendingCards: ('Buster' | 'Arts' | 'Quick' | 'NP')[] = [],
  pendingIndices: number[] = []
) {
  if (!combatant.currentHand || combatant.currentHand.length !== 5) {
    refreshCombatantHand(combatant);
  }

  const hand = combatant.currentHand!;
  const isNpReady = combatant.npGauge >= 100;
  const isNpSelected = pendingCards.includes('NP');
  const skills = combatant.servant.template?.skills || [];
  const bondLevel = combatant.servant.bondLevel || 1;
  const hasPending = pendingCards.length > 0;

  // Row 1: 5 Dealt Command Cards from Servant Class Deck
  const row1 = new ActionRowBuilder<ButtonBuilder>();
  const isQuickFirst = pendingCards[0] === 'Quick';

  hand.forEach((cardType, idx) => {
    const isUsed = pendingIndices.includes(idx);
    const orderIndex = pendingIndices.indexOf(idx);
    const isFirstCard = pendingIndices[0] === idx;

    let baseMult = cardType === 'Buster' ? 2.0 : cardType === 'Arts' ? 1.8 : 2.2;
    let critPct = Math.round((combatant.critStars || 0) * baseMult);
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
          .setCustomId(`card_hand_${idx}`)
          .setLabel(`#${orderIndex + 1}: ${cardType} (${critPct}%)`)
          .setEmoji('✔️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
    } else {
      row1.addComponents(
        new ButtonBuilder()
          .setCustomId(`card_hand_${idx}`)
          .setLabel(`${cardType} (${critPct}%)`)
          .setEmoji(emoji)
          .setStyle(style)
          .setDisabled(pendingCards.length >= 3)
      );
    }
  });

  // Row 2: Noble Phantasm + Clear + Command Seal
  const hasSeals = (combatant.commandSeals || 0) > 0;
  const npType = combatant.servant.template?.noblePhantasm?.cardType || 'Buster';
  const npScope = combatant.servant.template?.noblePhantasm?.target || 'single';
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('card_np')
      .setLabel(`NP [${npType}] (${Math.round(combatant.npGauge)}%)`)
      .setEmoji(npType === 'Buster' ? '🔴' : npType === 'Arts' ? '🔵' : '🟢')
      .setStyle(isNpReady ? ButtonStyle.Danger : ButtonStyle.Secondary)
      .setDisabled(!isNpReady || isNpSelected || pendingCards.length >= 3),
    new ButtonBuilder()
      .setCustomId('card_reset')
      .setLabel('Clear')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasPending),
    new ButtonBuilder()
      .setCustomId('card_seal')
      .setLabel(`Seal (${combatant.commandSeals || 0})`)
      .setEmoji('🔱')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasSeals)
  );

  // Row 3: 3 Active Skill Sets
  const row3 = new ActionRowBuilder<ButtonBuilder>();

  // Skill 1 (Unlocked by default)
  const s1 = skills[0];
  const cd1 = combatant.skillCooldowns[0] || 0;
  const s1Name = s1 ? s1.name.slice(0, 13) : 'Skill 1';
  row3.addComponents(
    new ButtonBuilder()
      .setCustomId('skill_0')
      .setLabel(cd1 > 0 ? `S1: ${s1Name} (${cd1}T)` : `✨ S1: ${s1Name}`)
      .setStyle(cd1 > 0 ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(cd1 > 0 || !s1)
  );

  // Skill 2 (Unlocked by default)
  const s2 = skills[1];
  const cd2 = combatant.skillCooldowns[1] || 0;
  const s2Name = s2 ? s2.name.slice(0, 13) : 'Skill 2';
  row3.addComponents(
    new ButtonBuilder()
      .setCustomId('skill_1')
      .setLabel(cd2 > 0 ? `S2: ${s2Name} (${cd2}T)` : `🛡️ S2: ${s2Name}`)
      .setStyle(cd2 > 0 ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(cd2 > 0 || !s2)
  );

  // Skill 3 (Unlocked at Bond Level 5)
  const s3 = skills[2];
  const cd3 = combatant.skillCooldowns[2] || 0;
  const isS3Unlocked = bondLevel >= 5;
  const s3Name = s3 ? s3.name.slice(0, 13) : 'Skill 3';
  row3.addComponents(
    new ButtonBuilder()
      .setCustomId('skill_2')
      .setLabel(!isS3Unlocked ? '🔒 S3 (Bond Lv 5)' : cd3 > 0 ? `S3: ${s3Name} (${cd3}T)` : `🌟 S3: ${s3Name}`)
      .setStyle(!isS3Unlocked || cd3 > 0 ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(!isS3Unlocked || cd3 > 0 || !s3)
  );

  return [row1, row2, row3];
}

// Helper to activate a combatant skill without spending a turn
function activateCombatantSkill(
  combatant: DuelCombatant,
  skillIdx: number
): { success: boolean; log: string } {
  const bondLevel = combatant.servant.bondLevel || 1;
  if (skillIdx === 2 && bondLevel < 5) {
    return { success: false, log: '🔒 **Skill 3 is Locked!** Reach Bond Level 5 to unlock this skill.' };
  }

  const skills = combatant.servant.template.skills || [];
  const skill = skills[skillIdx];
  if (!skill) {
    return { success: false, log: 'Skill not found.' };
  }

  if ((combatant.skillCooldowns[skillIdx] || 0) > 0) {
    return { success: false, log: `⏳ **${skill.name}** is on cooldown for **${combatant.skillCooldowns[skillIdx]}** more turns.` };
  }

  combatant.skillCooldowns[skillIdx] = skill.cooldown || 5;
  let logText = `✨ **${combatant.servant.template.name}** activated **${skill.name}**!`;

  if (skill.effectType === 'buff_atk') {
    const val = skill.value || 35;
    const desc = (skill.description || '').toLowerCase();
    const nameLower = (skill.name || '').toLowerCase();
    if (desc.includes('buster') || nameLower.includes('buster') || nameLower.includes('mana burst')) {
      combatant.activeBuffs.push({ name: skill.name, type: 'buster_up', value: val, remainingTurns: skill.duration || 1 });
      logText = `🔥 **${combatant.servant.template.name}** activated **${skill.name}**, gaining **+${val}% Buster Performance Up** for ${skill.duration || 1} turn!`;
    } else if (desc.includes('arts') || nameLower.includes('arts') || nameLower.includes('fox')) {
      combatant.activeBuffs.push({ name: skill.name, type: 'arts_up', value: val, remainingTurns: skill.duration || 1 });
      logText = `🌊 **${combatant.servant.template.name}** activated **${skill.name}**, gaining **+${val}% Arts Performance Up** for ${skill.duration || 1} turn!`;
    } else if (desc.includes('quick') || nameLower.includes('quick') || nameLower.includes('primordial rune')) {
      combatant.activeBuffs.push({ name: skill.name, type: 'quick_up', value: val, remainingTurns: skill.duration || 1 });
      logText = `⚡ **${combatant.servant.template.name}** activated **${skill.name}**, gaining **+${val}% Quick Performance Up** for ${skill.duration || 1} turn!`;
    } else {
      combatant.activeBuffs.push({ name: skill.name, type: 'buff_atk', value: val, remainingTurns: skill.duration || 2 });
      combatant.critStars = Math.min(50, combatant.critStars + 10);
      logText = `⚔️ **${combatant.servant.template.name}** activated **${skill.name}**, gaining **+${val}% ATK Buff** for ${skill.duration || 2} turns & +10 Stars!`;
    }
  } else if (skill.effectType === 'buff_def') {
    const val = skill.value || 30;
    combatant.activeBuffs.push({ name: skill.name, type: 'buff_def', value: val, remainingTurns: skill.duration || 2 });
    logText = `🛡️ **${combatant.servant.template.name}** activated **${skill.name}**, gaining **+${val}% DEF Buff** for ${skill.duration || 2} turns!`;
  } else if (skill.effectType === 'evade' || skill.effectType === 'invincible') {
    combatant.activeBuffs.push({ name: skill.name, type: 'evade', value: 85, remainingTurns: skill.duration || 1 });
    logText = `💨 **${combatant.servant.template.name}** activated **${skill.name}**! Readied an evasive barrier to dodge incoming strikes!`;
  } else if (skill.effectType === 'guts' || skill.id?.includes('guts') || skill.id?.includes('battle_continuation') || skill.id?.includes('thrice')) {
    const reviveAmt = skill.value || Math.round(combatant.maxHp * 0.20);
    combatant.gutsCount = (combatant.gutsCount || 0) + 1;
    combatant.activeBuffs.push({
      name: skill.name,
      type: 'guts',
      value: reviveAmt,
      remainingTurns: skill.duration || 5
    });
    if (skill.id?.includes('thrice')) {
      combatant.activeBuffs.push({
        name: `${skill.name} (DEF Up)`,
        type: 'buff_def',
        value: 100,
        remainingTurns: 1
      });
    }
    logText = `🩸 **${combatant.servant.template.name}** activated **${skill.name}**, gaining **Guts Status**! (Will revive with +${reviveAmt.toLocaleString()} HP on lethal damage)`;
  } else if (skill.effectType === 'heal') {
    const healVal = skill.value || Math.round(combatant.maxHp * 0.25);
    combatant.currentHp = Math.min(combatant.maxHp, combatant.currentHp + healVal);
    logText = `💚 **${combatant.servant.template.name}** activated **${skill.name}**, restoring **+${healVal.toLocaleString()} HP**!`;
  } else if (skill.effectType === 'np_charge') {
    const npVal = skill.value || 30;
    combatant.npGauge = Math.min(300, combatant.npGauge + npVal);
    combatant.critStars = Math.min(50, combatant.critStars + 15);
    logText = `⚡ **${combatant.servant.template.name}** activated **${skill.name}**, charging **+${npVal}% NP Gauge** & +15 Critical Stars!`;
  } else if (skill.effectType === 'crit_stars') {
    const starVal = skill.value || 25;
    combatant.critStars = Math.min(50, combatant.critStars + starVal);
    combatant.activeBuffs.push({ name: skill.name, type: 'crit_dmg', value: 40, remainingTurns: skill.duration || 2 });
    logText = `🌟 **${combatant.servant.template.name}** activated **${skill.name}**, generating **+${starVal} Stars** & +40% Crit DMG!`;
  } else {
    combatant.activeBuffs.push({ name: skill.name, type: 'buff_atk', value: 25, remainingTurns: 2 });
    logText = `✨ **${combatant.servant.template.name}** activated **${skill.name}**!`;
  }

  return { success: true, log: logText };
}

// Helper to invoke a command seal without spending a turn
function invokeCombatantSeal(combatant: DuelCombatant): { success: boolean; log: string } {
  if ((combatant.commandSeals || 0) <= 0) {
    return { success: false, log: '⚠️ You have no Command Seals remaining!' };
  }

  combatant.commandSeals--;
  combatant.npGauge = 100;
  const logText = `🔱 **COMMAND SEAL INVOKED!** Master **${combatant.username}** commanded: *"By my Command Seal, unleash your Noble Phantasm!"*\n> ⚡ **${combatant.servant.template.name}**'s NP Gauge has been completely refilled to **100%**!`;
  return { success: true, log: logText };
}

// Helper for AI card selection based on servant hand and class deck
function chooseAiSequence(ai: DuelCombatant): ('Buster' | 'Arts' | 'Quick' | 'NP')[] {
  if (!ai.currentHand || ai.currentHand.length !== 5) {
    refreshCombatantHand(ai);
  }
  const hand = [...ai.currentHand!];

  if (ai.npGauge >= 100) {
    return ['NP', hand[0], hand[1]];
  }

  const busters = hand.filter(c => c === 'Buster');
  const arts = hand.filter(c => c === 'Arts');
  const quicks = hand.filter(c => c === 'Quick');

  // Perform full Chain if 3 identical cards were dealt in hand
  if (arts.length >= 3) return ['Arts', 'Arts', 'Arts'];
  if (busters.length >= 3) return ['Buster', 'Buster', 'Buster'];
  if (quicks.length >= 3) return ['Quick', 'Quick', 'Quick'];

  // Lean towards Servant class specialty
  const sClass = ai.servant?.template?.servantClass || 'Saber';
  if (sClass === 'Caster' && arts.length >= 2) {
    const remaining = hand.filter(c => c !== 'Arts');
    return ['Arts', 'Arts', remaining[0] || 'Buster'];
  }
  if (sClass === 'Berserker' && busters.length >= 2) {
    const remaining = hand.filter(c => c !== 'Buster');
    return ['Buster', 'Buster', remaining[0] || 'Arts'];
  }
  if (sClass === 'Assassin' && quicks.length >= 2) {
    const remaining = hand.filter(c => c !== 'Quick');
    return ['Quick', 'Quick', remaining[0] || 'Buster'];
  }

  return [hand[0], hand[1], hand[2]];
}

// ==========================================
// 8. TURN RESOLUTION & BALANCED DAMAGE ENGINE
// ==========================================
// Uses canonical Fate / FGO combat formulas:
// - 3 Command Card Sequence execution
// - 1st Card Lead Bonuses (Buster DMG Lead, Arts NP Lead, Quick Crit Lead)
// - Position Multipliers (1.0x, 1.2x, 1.4x)
// - Type Chains (Buster Chain, Arts Chain, Quick Chain)
// - Brave Chain Extra Attack Finisher
function resolveStrike(
  attacker: DuelCombatant,
  defender: DuelCombatant,
  cardsSequence: ('Buster' | 'Arts' | 'Quick' | 'NP')[]
): string {
  // Decrement attacker skill cooldowns
  for (const idxStr of Object.keys(attacker.skillCooldowns)) {
    const idx = parseInt(idxStr, 10);
    if (attacker.skillCooldowns[idx] > 0) {
      attacker.skillCooldowns[idx]--;
    }
  }

  // Calculate active buffs
  let atkBuff = 1.0;
  let critDmgBonus = 1.0;
  let npGenBonus = 1.0;

  // 1. Resolve Attacker & Defender Passives (Max 2, 2nd unlocked after Bond 5)
  const attackerPassives = attacker.passives || getUnlockedPassives(attacker.servant.template?.passives?.length ? attacker.servant.template.passives : attacker.servant.template?.servantClass, attacker.servant.bondLevel || 1);
  const defenderPassives = defender.passives || getUnlockedPassives(defender.servant.template?.passives?.length ? defender.servant.template.passives : defender.servant.template?.servantClass, defender.servant.bondLevel || 1);

  const madnessBonus = attackerPassives.filter(p => p.type === 'madness_enhancement').reduce((s, p) => s + p.value, 0);
  const ridingBonus = attackerPassives.filter(p => p.type === 'riding').reduce((s, p) => s + p.value, 0);
  const territoryBonus = attackerPassives.filter(p => p.type === 'territory_creation').reduce((s, p) => s + p.value, 0);
  const critPassiveBonus = attackerPassives.filter(p => p.type === 'independent_action' || p.type === 'oblivion_correction').reduce((s, p) => s + p.value, 0);
  const divinityBonus = attackerPassives.filter(p => p.type === 'divinity').reduce((s, p) => s + p.value, 0);
  const presenceConcealBonus = attackerPassives.filter(p => p.type === 'presence_concealment').reduce((s, p) => s + p.value, 0);
  const avengerBonus = defenderPassives.filter(p => p.type === 'avenger').reduce((s, p) => s + p.value, 0);
  const attackerAvengerAtk = attackerPassives.filter(p => p.type === 'avenger').length > 0 ? 0.04 : 0;
  const flatDivinity = Math.round(divinityBonus * PVP_DAMAGE_MODIFIER);

  // Independent Action & Oblivion Correction boost Crit Damage
  critDmgBonus += critPassiveBonus / 100;

  attacker.activeBuffs = attacker.activeBuffs.filter(b => {
    b.remainingTurns--;
    if (b.type === 'buff_atk') atkBuff += b.value / 100;
    if (b.type === 'crit_dmg') critDmgBonus += b.value / 100;
    if (b.type === 'np_gen') npGenBonus += b.value / 100;
    return b.remainingTurns > 0;
  });

  let defBuff = 1.0;
  let isEvading = false;
  defender.activeBuffs = defender.activeBuffs.filter(b => {
    if (b.type === 'buff_def') defBuff += b.value / 100;
    if (b.type === 'evade') isEvading = true;
    return b.remainingTurns > 0;
  });

  const effectiveAtk = attacker.baseAtk * (atkBuff + attackerAvengerAtk);
  const effectiveDef = defender.baseDef * defBuff;

  const classMult = getClassMultiplier(
    attacker.servant.template.servantClass,
    defender.servant.template.servantClass
  );

  // 1st Card Lead Bonus Evaluation (NP card uses its permanently mapped Card Type)
  const npEffectiveCard = attacker.servant.template.noblePhantasm?.cardType || 'Buster';
  const firstEffectiveCard = cardsSequence[0] === 'NP' ? npEffectiveCard : (cardsSequence[0] || 'Buster');
  const isBusterFirst = firstEffectiveCard === 'Buster';
  const isArtsFirst = firstEffectiveCard === 'Arts';
  const isQuickFirst = firstEffectiveCard === 'Quick';

  // Type Chains Evaluation (3 cards of exact same color, including NP card of that color)
  const is3Cards = cardsSequence.length >= 3;
  const effectiveChainCards = cardsSequence.map(c => c === 'NP' ? npEffectiveCard : c);
  const isBusterChain = is3Cards && effectiveChainCards.every(c => c === 'Buster');
  const isArtsChain = is3Cards && effectiveChainCards.every(c => c === 'Arts');
  const isQuickChain = is3Cards && effectiveChainCards.every(c => c === 'Quick');

  const busterChainBonusDmg = isBusterChain ? Math.round(attacker.baseAtk * 0.20 * PVP_DAMAGE_MODIFIER) : 0;

  const chainTags: string[] = [];
  if (isBusterFirst) chainTags.push('🔥 Buster 1st Lead (+50% DMG)');
  if (isArtsFirst) chainTags.push('🌊 Arts 1st Lead (+50% NP Gain)');
  if (isQuickFirst) chainTags.push('⚡ Quick 1st Lead (+20% Crit Rate)');

  if (isBusterChain) chainTags.push('🔴 BUSTER CHAIN (+20% Base ATK Hit Bonus)');
  if (isArtsChain) chainTags.push('🔵 ARTS CHAIN (+20% NP Refund)');
  if (isQuickChain) chainTags.push('🟢 QUICK CHAIN (+20 Critical Stars)');

  const positionMultipliers = [1.0, 1.2, 1.4];
  let totalSeqDmg = 0;
  let totalNpGained = 0;
  let totalStarsGained = 0;
  let isAnyCrit = false;
  let hasNpHit = false;

  // Type Chain Bonuses: Arts Chain grants +20% flat NP, Quick Chain grants +20 flat stars
  if (isArtsChain) {
    attacker.npGauge = Math.min(300, attacker.npGauge + 20);
    totalNpGained += 20;
  }
  if (isQuickChain) {
    totalStarsGained += 20;
  }

  // Available stars collected from previous turn (or active skills) used to determine this turn's crit rates
  const starsForCrits = attacker.critStars || 0;

  // Process 3-card sequence
  for (let i = 0; i < cardsSequence.length; i++) {
    const card = cardsSequence[i];
    const posMult = positionMultipliers[i] || 1.0;

    if (card === 'NP') {
      hasNpHit = true;
      const npTemplate = attacker.servant.template.noblePhantasm;
      const npCardType = npTemplate.cardType || 'Buster';
      const npScope = npTemplate.target || 'single';

      // Multipliers: ST vs AoE vs Support
      let baseMultiplier = npTemplate.multiplier;
      if (npScope === 'support') {
        baseMultiplier = 0;
      } else if (!baseMultiplier || baseMultiplier <= 0) {
        if (npScope === 'single') {
          baseMultiplier = npCardType === 'Quick' ? 1200 : npCardType === 'Arts' ? 900 : 600;
        } else {
          baseMultiplier = npCardType === 'Quick' ? 600 : npCardType === 'Arts' ? 450 : 400;
        }
      }

      // Card-specific performance buffs (Active buffs + Class Passives)
      const busterBuff = attacker.activeBuffs.filter(b => b.type === 'buster_up' || /mana burst|buster/i.test(b.name)).reduce((s, b) => s + b.value, 0) + madnessBonus;
      const artsBuff = attacker.activeBuffs.filter(b => b.type === 'arts_up' || /arts|fox/i.test(b.name)).reduce((s, b) => s + b.value, 0) + territoryBonus;
      const quickBuff = attacker.activeBuffs.filter(b => b.type === 'quick_up' || /quick|primordial rune/i.test(b.name)).reduce((s, b) => s + b.value, 0) + ridingBonus;

      const cardPerfMult = 1.0 + ((npCardType === 'Buster' ? busterBuff : npCardType === 'Arts' ? artsBuff : quickBuff) / 100);

      // Card inherent damage scaling: Buster (1.5x), Arts (1.0x), Quick (0.8x)
      const cardTypeScale = npCardType === 'Buster' ? 1.50 : npCardType === 'Quick' ? 0.80 : 1.00;
      const scopeScale = npScope === 'single' ? 1.00 : npScope === 'aoe' ? 0.70 : 0.00;

      const overchargeLevel = attacker.npGauge >= 300 ? 3 : attacker.npGauge >= 200 ? 2 : 1;
      const overchargeScale = 1.0 + (overchargeLevel - 1) * 0.20;

      let npDmg = 0;
      let npRefund = 0;
      let npStars = 0;

      if (npScope === 'support') {
        // Non-damaging Support NP
        npDmg = 0;
        if (npCardType === 'Arts') {
          const healAmount = Math.round(attacker.maxHp * 0.20);
          attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + healAmount);
          attacker.activeBuffs.push({ name: 'Invincibility', type: 'invincible', value: 100, remainingTurns: 1 });
          attacker.activeBuffs.push({ name: 'Divine Protection', type: 'buff_def', value: 30, remainingTurns: 3 });
          npRefund = Math.round(15 * (1.0 + artsBuff / 100));
          npStars = 3;
        } else if (npCardType === 'Quick') {
          npStars = Math.round(20 * (1.0 + quickBuff / 100));
          attacker.activeBuffs.push({ name: 'Evade', type: 'evade', value: 100, remainingTurns: 1 });
          npRefund = Math.round(8 * (1.0 + quickBuff / 100));
        } else {
          attacker.activeBuffs.push({ name: 'War Cry', type: 'buff_atk', value: 30, remainingTurns: 3 });
          npStars = 5;
        }
      } else {
        const variance = 0.96 + Math.random() * 0.08;
        const rawNpDmg = (effectiveAtk * (baseMultiplier / 100) * 0.18 * cardTypeScale * scopeScale * overchargeScale * classMult * cardPerfMult * variance);
        npDmg = Math.round(Math.max(1200, rawNpDmg) * PVP_DAMAGE_MODIFIER) + flatDivinity;

        if (isEvading) {
          npDmg = Math.round(npDmg * 0.15);
          defender.activeBuffs = defender.activeBuffs.filter(b => b.type !== 'evade');
          isEvading = false;
        }

        // Refund properties dictated by card type (Balanced FGO tuning)
        if (npCardType === 'Buster') {
          const hasOverchargeRefund = /refund|recharge/i.test(attacker.servant.template.noblePhantasm?.overchargeEffect || '');
          npRefund = hasOverchargeRefund ? (overchargeLevel >= 2 ? 30 : 20) : 0;
          npStars = npScope === 'aoe' ? 5 : 2;
        } else if (npCardType === 'Arts') {
          const baseRefund = npScope === 'aoe' ? 18 : 12;
          npRefund = Math.round(baseRefund * (1.0 + artsBuff / 100));
          npStars = 2;
        } else {
          const baseStars = npScope === 'aoe' ? 20 : 14;
          npStars = Math.round(baseStars * (1.0 + quickBuff / 100));
          const baseRefund = npScope === 'aoe' ? 10 : 6;
          npRefund = Math.round(baseRefund * (1.0 + quickBuff / 100));
        }
      }

      // Expending NP: Reset gauge to the NP's refund amount
      attacker.npGauge = npRefund;
      totalNpGained += npRefund;
      totalStarsGained += npStars;
      totalSeqDmg += npDmg;
    } else if (card === 'Buster') {
      let cardMult = 1.4 * posMult * (1.0 + madnessBonus / 100);
      if (i > 0 && isBusterFirst) cardMult += 0.50; // Buster Lead Bonus

      let critChance = Math.min(0.95, (starsForCrits * 2.0) / 100);
      if (i > 0 && isQuickFirst) critChance = Math.min(0.95, critChance + 0.20);

      const hitCrit = Math.random() < critChance;
      if (hitCrit) isAnyCrit = true;
      const critMult = hitCrit ? (1.75 * critDmgBonus) : 1.0;
      const variance = 0.95 + Math.random() * 0.10;

      const baseHit = (effectiveAtk * cardMult * 0.11) - (effectiveDef * 2) + busterChainBonusDmg;
      let hitDmg = Math.round(Math.max(350, baseHit) * classMult * critMult * variance * PVP_DAMAGE_MODIFIER) + flatDivinity;

      if (isEvading) {
        hitDmg = Math.round(hitDmg * 0.15);
        defender.activeBuffs = defender.activeBuffs.filter(b => b.type !== 'evade');
        isEvading = false;
      }

      // FGO Buster NP rule: 0% base NP gain, only gains small NP (+2-3%) if Arts 1st Lead is active
      let npAmt = 0;
      if (i > 0 && isArtsFirst) {
        npAmt = hitCrit ? 3 : 2;
      }
      if (npAmt > 0) {
        attacker.npGauge = Math.min(300, attacker.npGauge + npAmt);
        totalNpGained += npAmt;
      }

      // Buster Star Gen: 0 base (1 on crit or with Presence Concealment)
      const starsAmt = hitCrit ? (presenceConcealBonus > 0 ? 2 : 1) : (presenceConcealBonus > 0 ? 1 : 0);
      if (starsAmt > 0) {
        totalStarsGained += starsAmt;
      }

      totalSeqDmg += hitDmg;
    } else if (card === 'Arts') {
      let cardMult = 1.0 * posMult * (1.0 + territoryBonus / 100);
      if (i > 0 && isBusterFirst) cardMult += 0.50;

      let critChance = Math.min(0.85, (starsForCrits * 1.8) / 100);
      if (i > 0 && isQuickFirst) critChance = Math.min(0.95, critChance + 0.20);

      const hitCrit = Math.random() < critChance;
      if (hitCrit) isAnyCrit = true;
      const critMult = hitCrit ? (1.75 * critDmgBonus) : 1.0;
      const variance = 0.95 + Math.random() * 0.10;

      const baseHit = (effectiveAtk * cardMult * 0.11) - (effectiveDef * 2);
      let hitDmg = Math.round(Math.max(280, baseHit) * classMult * critMult * variance * PVP_DAMAGE_MODIFIER) + flatDivinity;

      if (isEvading) {
        hitDmg = Math.round(hitDmg * 0.15);
        defender.activeBuffs = defender.activeBuffs.filter(b => b.type !== 'evade');
        isEvading = false;
      }

      // FGO Arts NP rule: 8-10 base NP gain scaled by position (1.0x/1.2x/1.4x), crit (1.5x), and Arts 1st Lead (+50%)
      const baseArtsNp = 8 + Math.floor(Math.random() * 3);
      let npGain = Math.round(baseArtsNp * posMult * npGenBonus * (hitCrit ? 1.5 : 1.0) * (1.0 + territoryBonus / 100));
      if (i > 0 && isArtsFirst) npGain = Math.round(npGain * 1.5); // Arts Lead Bonus

      attacker.npGauge = Math.min(300, attacker.npGauge + npGain);
      totalNpGained += npGain;

      // Arts stars: 1 star (2 on crit)
      const artsStars = hitCrit ? 2 : 1;
      totalStarsGained += artsStars;

      totalSeqDmg += hitDmg;
    } else if (card === 'Quick') {
      let cardMult = 0.85 * posMult * (1.0 + ridingBonus / 100);
      if (i > 0 && isBusterFirst) cardMult += 0.50;

      let critChance = Math.min(0.95, (starsForCrits * 2.2) / 100);
      if (i > 0 && isQuickFirst) critChance = Math.min(0.95, critChance + 0.20);

      const hitCrit = Math.random() < critChance;
      if (hitCrit) isAnyCrit = true;
      const critMult = hitCrit ? (1.75 * critDmgBonus) : 1.0;
      const variance = 0.95 + Math.random() * 0.10;

      const baseHit = (effectiveAtk * cardMult * 0.11) - (effectiveDef * 2);
      let hitDmg = Math.round(Math.max(220, baseHit) * classMult * critMult * variance * PVP_DAMAGE_MODIFIER) + flatDivinity;

      if (isEvading) {
        hitDmg = Math.round(hitDmg * 0.15);
        defender.activeBuffs = defender.activeBuffs.filter(b => b.type !== 'evade');
        isEvading = false;
      }

      // FGO Quick stars: 4-6 base stars scaled by position (1.0x/1.25x/1.5x), crit (1.4x), and Quick 1st Lead (+30%)
      const baseQuickStars = 4 + Math.floor(Math.random() * 3);
      let starsGained = Math.round(baseQuickStars * (1.0 + (i * 0.25)) * (hitCrit ? 1.4 : 1.0) * (1.0 + (ridingBonus + presenceConcealBonus) / 100));
      if (i > 0 && isQuickFirst) starsGained = Math.round(starsGained * 1.3); // Quick Lead Bonus

      totalStarsGained += starsGained;

      // Quick NP gain: 3-4 base
      let quickNp = 3 + Math.floor(Math.random() * 2);
      if (hitCrit) quickNp = Math.round(quickNp * 1.5);
      if (i > 0 && isArtsFirst) quickNp = Math.round(quickNp * 1.5);
      attacker.npGauge = Math.min(300, attacker.npGauge + quickNp);
      totalNpGained += quickNp;

      totalSeqDmg += hitDmg;
    }
  }

  // Brave Chain Extra Attack Finisher (if 3 cards were used)
  if (is3Cards) {
    chainTags.push('⚔️ BRAVE CHAIN (Extra Attack)');
    const extraBase = (effectiveAtk * 1.2 * 0.11) - (effectiveDef * 2);
    const extraDmg = Math.max(450, Math.round(extraBase * classMult * (0.95 + Math.random() * 0.10) * PVP_DAMAGE_MODIFIER)) + flatDivinity;
    totalSeqDmg += extraDmg;
    const extraNp = isArtsFirst ? 5 : 3;
    attacker.npGauge = Math.min(300, attacker.npGauge + extraNp);
    totalNpGained += extraNp;
    const extraStars = 3 + (isQuickFirst ? 2 : 0) + (presenceConcealBonus > 0 ? 2 : 0);
    totalStarsGained += extraStars;
  }

  // Set the combatant's critical star pool for the upcoming turn based on what was gathered
  attacker.critStars = Math.min(50, totalStarsGained);

  // Apply total damage to defender
  defender.currentHp = Math.max(0, defender.currentHp - totalSeqDmg);

  // Defender Avenger Passive: NP refund on taking damage
  let avengerLog = '';
  if (avengerBonus > 0 && totalSeqDmg > 0) {
    const avengerRefund = Math.round(12 * (1.0 + avengerBonus / 100));
    defender.npGauge = Math.min(300, defender.npGauge + avengerRefund);
    avengerLog = `\n🖤 **[Avenger]** ${defender.servant.template.name} gained **+${avengerRefund}% NP** from suffering damage!`;
  }

  // Check for Guts (Battle Continuation)
  let gutsText = '';
  const gutsBuffIndex = defender.activeBuffs.findIndex(b => b.type === 'guts');
  if (defender.currentHp <= 0 && (defender.gutsCount > 0 || gutsBuffIndex !== -1)) {
    if (defender.gutsCount > 0) defender.gutsCount--;
    let reviveHp = Math.round(defender.maxHp * 0.20);
    if (gutsBuffIndex !== -1) {
      const gutsBuff = defender.activeBuffs[gutsBuffIndex];
      if (gutsBuff.value) reviveHp = gutsBuff.value;
      defender.activeBuffs.splice(gutsBuffIndex, 1);
    }
    defender.currentHp = reviveHp;
    gutsText = `\n✝️ **BATTLE CONTINUATION!** ${defender.servant.template.name} revived with **${reviveHp.toLocaleString()} HP**!`;
  }

  const critTag = isAnyCrit ? ' 💥 **CRITICAL HIT!**' : '';
  const evadeTag = isEvading ? ' *(Evaded)*' : '';
  const npHeader = hasNpHit ? ' 💥 **NOBLE PHANTASM UNLEASHED!**' : '';
  const chainStr = chainTags.length > 0 ? `\n⛓️ **Chains:** ${chainTags.join(' • ')}` : '';

  const seqNames = cardsSequence.join(' -> ');
  const logText = `⚔️ **${attacker.servant.template.name}** executed sequence **[${seqNames}]**${npHeader}${critTag}${evadeTag}:\n` +
    `• Dealt **${totalSeqDmg.toLocaleString()} DMG** to ${defender.servant.template.name}\n` +
    `• Gained **+${totalNpGained}% NP** & **+${totalStarsGained} Critical Stars**${chainStr}${gutsText}${avengerLog}`;

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
        withResponse: true
      }).then(r => r.resource?.message || interaction.fetchReply());

      const inviteCollector = inviteMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000 // 60s to accept
      });

      inviteCollector.on('collect', async i => {
        try {
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
            // Acknowledge the button immediately before async canvas generation
            await i.deferUpdate();
            const p1Part = warSession.participants[challengerMaster.discordId];
            const p1Hp = p1Part ? calculateCurrentHp(p1Part) : undefined;
            const p1 = createCombatant(challengerMaster, challengerServant, false, p1Hp);

            const p2Part = warSession.participants[opponentUser.id] ||
              Object.values(warSession.participants).find(p => p.username.toLowerCase() === opponentUser.username.toLowerCase());
            const p2Hp = p2Part ? calculateCurrentHp(p2Part) : undefined;
            const p2 = createCombatant(opponentMaster, opponentServant, false, p2Hp);
            await startInteractiveDuel(i, p1, p2, challengerMaster, opponentMaster);
          }
        } catch (err: any) {
          if (err.code === 10062 || err.code === 40060 || err.message?.includes('Unknown interaction')) return;
          console.error('Error in inviteCollector (opponent):', err);
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
      withResponse: true
    }).then(r => r.resource?.message || interaction.fetchReply());

    const inviteCollector = inviteMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000
    });

    inviteCollector.on('collect', async i => {
      try {
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
          // Acknowledge immediately before async canvas generation
          await i.deferUpdate();
          const p1Part = warSession.participants[challengerMaster.discordId];
          const p1Hp = p1Part ? calculateCurrentHp(p1Part) : undefined;
          const p1 = createCombatant(challengerMaster, challengerServant, false, p1Hp);

          const p2Part = warSession.participants[targetRival.discordId] ||
            Object.values(warSession.participants).find(p => p.username.toLowerCase() === targetRival.username.toLowerCase());
          const p2Hp = p2Part ? calculateCurrentHp(p2Part) : undefined;
          const p2 = createCombatant(opponentMaster, opponentServant, false, p2Hp);
          await startInteractiveDuel(i, p1, p2, challengerMaster, opponentMaster);
        }
      } catch (err: any) {
        if (err.code === 10062 || err.code === 40060 || err.message?.includes('Unknown interaction')) return;
        console.error('Error in inviteCollector (rival):', err);
      }
    });

  } catch (error: any) {
    console.error('Error executing /duel:', error);
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: `❌ Error starting duel: ${error.message}`, ephemeral: true });
      } else {
        await interaction.reply({ content: `❌ Error starting duel: ${error.message}`, ephemeral: true });
      }
    } catch {}
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
  const combatLogs: string[] = ['⚔️ The Command Seal glow resonates... The Holy Grail Duel begins!'];

  const t1 = p1.servant.template;
  const t2 = p2.servant.template;
  const base1 = t1?.baseStats || { agility: 10 };
  const base2 = t2?.baseStats || { agility: 10 };
  const alloc1 = p1.servant.allocatedStats || { agility: 0 };
  const alloc2 = p2.servant.allocatedStats || { agility: 0 };
  const agi1 = (base1.agility || 10) + (alloc1.agility || 0);
  const agi2 = (base2.agility || 10) + (alloc2.agility || 0);

  const p1Speed = agi1 * 10 + (Math.random() * 20);
  const p2Speed = agi2 * 10 + (Math.random() * 20);

  let activeUserId = p1.userId;
  let activePendingCards: ('Buster' | 'Arts' | 'Quick' | 'NP')[] = [];
  let activePendingIndices: number[] = [];
  let p1LastCards: ('Buster' | 'Arts' | 'Quick' | 'NP')[] = ['Buster', 'Arts', 'Quick'];
  let p2LastCards: ('Buster' | 'Arts' | 'Quick' | 'NP')[] = ['Arts', 'Buster', 'Quick'];

  if (p2Speed > p1Speed) {
    activeUserId = p2.userId;
    const fasterName = p2.servant.nickname || p2.servant.template?.name || 'Opponent Servant';
    combatLogs.push(`⚡ **Agility Initiative:** **${fasterName}** (Agi: ${agi2}) outmaneuvered their opponent and claims the first move!`);

    // If P2 is AI, resolve AI strike immediately on turn 1
    if (p2.isAi) {
      const aiCards = chooseAiSequence(p2);
      p2LastCards = aiCards;
      const aiLog = resolveStrike(p2, p1, aiCards);
      refreshCombatantHand(p2);
      combatLogs.push(aiLog);
      round++;
      // Now it's P1's turn
      activeUserId = p1.userId;
    }
  } else {
    const fasterName = p1.servant.nickname || p1.servant.template?.name || 'Your Servant';
    combatLogs.push(`⚡ **Agility Initiative:** **${fasterName}** (Agi: ${agi1}) outmaneuvered their opponent and claims the first move!`);
  }

  const activeCombatant = activeUserId === p1.userId ? p1 : p2;
  const lastLogText = combatLogs[combatLogs.length - 1];

  const initialAttachment = await createTurnSummaryAttachment(p1, p2, round, lastLogText, p1LastCards, p2LastCards);
  const initialEmbed = buildDuelEmbed(p1, p2, round, activeUserId, combatLogs, activePendingCards, activePendingIndices);
  const initialButtons = buildCombatButtons(activeCombatant, activePendingCards, activePendingIndices);

  let battleMsg: any;
  if (contextInteraction.deferred || contextInteraction.replied) {
    battleMsg = await contextInteraction.editReply({
      content: null,
      embeds: [initialEmbed],
      files: [initialAttachment],
      components: initialButtons
    });
  } else if (contextInteraction.isButton && contextInteraction.isButton()) {
    await contextInteraction.deferUpdate();
    battleMsg = await contextInteraction.editReply({
      content: null,
      embeds: [initialEmbed],
      files: [initialAttachment],
      components: initialButtons
    });
  } else {
    const res = await contextInteraction.reply({
      embeds: [initialEmbed],
      files: [initialAttachment],
      components: initialButtons,
      withResponse: true
    });
    battleMsg = res?.resource?.message || await contextInteraction.fetchReply();
  }

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
        // Ignored if already deleted or interaction expired
      }
    }
  };

  const dispatchNpGif = async (actor: DuelCombatant, interaction: any) => {
    await cleanupNpGif();
    const servant = actor.servant;
    const npTemplate = servant.template?.noblePhantasm;
    const npGifUrl = getNoblePhantasmGif(servant);
    const npChant = getNoblePhantasmChant(servant);
    const npName = npTemplate?.name || 'Noble Phantasm';
    const servantDisplayName = servant.nickname || servant.template?.name || 'Heroic Spirit';
    const { autoDelete, afkTimeoutSeconds } = getDuelNpSettings();

    // To make the animation display as BIG as possible at full channel width,
    // we deliver the True Name invocation as a native Discord message with the direct GIF link.
    // Native Discord message links unfurl at full width without embed bounding box restrictions!
    const chantBlock = npChant ? `\n> *“${npChant}”*` : '';

    const fullWidthContent = 
      `## 💥 NOBLE PHANTASM UNLEASHED: **${npName.toUpperCase()}**\n` +
      `⚔️ **${servantDisplayName}** (Master: <@${actor.userId}>)${chantBlock}\n` +
      `${npGifUrl}`;

    try {
      let sentMsg: any = null;
      if (interaction.channel && typeof interaction.channel.send === 'function') {
        sentMsg = await interaction.channel.send({
          content: fullWidthContent
        });
      } else if (interaction.followUp) {
        sentMsg = await interaction.followUp({
          content: fullWidthContent,
          fetchReply: true
        });
      }

      if (sentMsg) {
        activeNpGifMessage = sentMsg;
        if (autoDelete) {
          activeNpGifTimeout = setTimeout(async () => {
            if (activeNpGifMessage === sentMsg) {
              await cleanupNpGif();
            }
          }, afkTimeoutSeconds * 1000);
        }
      }
    } catch (err) {
      console.warn('Could not post Noble Phantasm GIF cinematic message:', err);
    }
  };

  // Component Collector for turn choices - resets idle timer on every valid player action
  const collector = battleMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    idle: 120000, // 2 minutes per player turn
    time: 3600000 // 1 hour absolute safety ceiling
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

      // Reset inactivity idle timer on active player action
      collector.resetTimer();

      // Automatically delete active NP GIF when the next turn action is picked
      await cleanupNpGif();

      // Acknowledge Discord immediately so the 3s timeout never triggers during canvas rendering
      await i.deferUpdate();

      // CASE: SKILL ACTIVATION (Instant - does NOT end turn)
      if (i.customId.startsWith('skill_')) {
        const skillIdx = parseInt(i.customId.replace('skill_', ''), 10);
        const actor = activeUserId === p1.userId ? p1 : p2;
        const res = activateCombatantSkill(actor, skillIdx);
        combatLogs.push(res.log);
        if (combatLogs.length > 4) combatLogs.shift();

        const turnAttachment = await createTurnSummaryAttachment(p1, p2, round, res.log, p1LastCards, p2LastCards);
        const updatedEmbed = buildDuelEmbed(p1, p2, round, activeUserId, combatLogs, activePendingCards, activePendingIndices);
        const updatedButtons = buildCombatButtons(actor, activePendingCards, activePendingIndices);
        await i.editReply({ embeds: [updatedEmbed], files: [turnAttachment], components: updatedButtons });
        return;
      }

      // CASE: COMMAND SEAL ACTIVATION (Instant - does NOT end turn)
      if (i.customId === 'card_seal') {
        const actor = activeUserId === p1.userId ? p1 : p2;
        const actingMaster = activeUserId === p1Master.discordId ? p1Master : p2Master;
        const res = invokeCombatantSeal(actor);
        if (actingMaster) {
          actingMaster.commandSeals = actor.commandSeals;
          await saveMaster(actingMaster);
        }
        combatLogs.push(res.log);
        if (combatLogs.length > 4) combatLogs.shift();

        const turnAttachment = await createTurnSummaryAttachment(p1, p2, round, res.log, p1LastCards, p2LastCards);
        const updatedEmbed = buildDuelEmbed(p1, p2, round, activeUserId, combatLogs, activePendingCards, activePendingIndices);
        const updatedButtons = buildCombatButtons(actor, activePendingCards, activePendingIndices);
        await i.editReply({ embeds: [updatedEmbed], files: [turnAttachment], components: updatedButtons });
        return;
      }

      // CASE: RESET PENDING CARDS
      if (i.customId === 'card_reset') {
        activePendingCards = [];
        activePendingIndices = [];
        const actor = activeUserId === p1.userId ? p1 : p2;
        const updatedEmbed = buildDuelEmbed(p1, p2, round, activeUserId, combatLogs, activePendingCards, activePendingIndices);
        const updatedButtons = buildCombatButtons(actor, activePendingCards, activePendingIndices);
        await i.editReply({ embeds: [updatedEmbed], components: updatedButtons });
        return;
      }

      // CASE: HAND CARD SELECTION
      const attacker = activeUserId === p1.userId ? p1 : p2;
      const defender = activeUserId === p1.userId ? p2 : p1;

      if (!attacker.currentHand || attacker.currentHand.length !== 5) {
        refreshCombatantHand(attacker);
      }

      if (i.customId.startsWith('card_hand_')) {
        const handIdx = parseInt(i.customId.replace('card_hand_', ''), 10);
        if (!activePendingIndices.includes(handIdx) && activePendingCards.length < 3 && handIdx >= 0 && handIdx < 5 && attacker.currentHand) {
          activePendingIndices.push(handIdx);
          activePendingCards.push(attacker.currentHand[handIdx]);
        }
      } else if (i.customId === 'card_np') {
        if (!activePendingCards.includes('NP') && activePendingCards.length < 3) {
          activePendingCards.push('NP');
        }
      }

      // As soon as the active Master starts picking their next turn cards, clean up previous NP GIF
      if (activePendingCards.length === 1) {
        await cleanupNpGif();
      }

      // If user hasn't selected 3 cards yet, update selection UI and wait for next card click
      if (activePendingCards.length < 3) {
        const updatedEmbed = buildDuelEmbed(p1, p2, round, activeUserId, combatLogs, activePendingCards, activePendingIndices);
        const updatedButtons = buildCombatButtons(attacker, activePendingCards, activePendingIndices);
        await i.editReply({ embeds: [updatedEmbed], components: updatedButtons });
        return;
      }

      // 3 CARDS SELECTED -> Execute 3-Card Chain Attack Sequence!
      const playerSequence = [...activePendingCards];
      activePendingCards = [];
      activePendingIndices = [];

      const log = resolveStrike(attacker, defender, playerSequence);
      refreshCombatantHand(attacker);
      combatLogs.push(log);
      if (combatLogs.length > 4) combatLogs.shift();

      // Trigger cinematic Noble Phantasm animated GIF if player used NP
      if (playerSequence.includes('NP')) {
        await dispatchNpGif(attacker, i);
      }

      if (activeUserId === p1.userId) {
        p1LastCards = playerSequence;
      } else {
        p2LastCards = playerSequence;
      }

      const p1CardChoice = p1LastCards;
      let p2CardChoice = p2LastCards;

      // Check if Defender fainted
      if (defender.currentHp <= 0) {
        collector.stop('finished');
        const finalAttachment = await createTurnSummaryAttachment(p1, p2, round, log, p1CardChoice, p2CardChoice);
        await finishDuel(i, attacker, defender, p1Master, p2Master, finalAttachment);
        return;
      }

      // CASE A: Opponent is AI -> AI chooses 3 cards and strikes back
      if (defender.isAi) {
        round++;

        // AI tactical skill usage
        const aiSkills = defender.servant.template.skills || [];
        const aiBond = defender.servant.bondLevel || 3;
        for (let sIdx = 0; sIdx < aiSkills.length; sIdx++) {
          if (sIdx === 2 && aiBond < 5) continue;
          if ((defender.skillCooldowns[sIdx] || 0) <= 0 && Math.random() < 0.35) {
            const aiSkillRes = activateCombatantSkill(defender, sIdx);
            if (aiSkillRes.success) {
              combatLogs.push(aiSkillRes.log);
              if (combatLogs.length > 4) combatLogs.shift();
            }
            break;
          }
        }

        const aiSequence = chooseAiSequence(defender);
        p2LastCards = aiSequence;
        p2CardChoice = p2LastCards;

        const aiLog = resolveStrike(defender, attacker, aiSequence);
        refreshCombatantHand(defender);
        combatLogs.push(aiLog);
        if (combatLogs.length > 4) combatLogs.shift();

        // Trigger cinematic Noble Phantasm animated GIF if AI used NP
        if (aiSequence.includes('NP')) {
          await dispatchNpGif(defender, i);
        }

        if (attacker.currentHp <= 0) {
          collector.stop('finished');
          const finalAttachment = await createTurnSummaryAttachment(p1, p2, round, aiLog, p1CardChoice, p2CardChoice);
          await finishDuel(i, defender, attacker, p1Master, p2Master, finalAttachment);
          return;
        }

        // Keep turn on P1
        activeUserId = p1.userId;
        const turnAttachment = await createTurnSummaryAttachment(p1, p2, round, aiLog, p1CardChoice, p2CardChoice);
        const updatedEmbed = buildDuelEmbed(p1, p2, round, activeUserId, combatLogs, activePendingCards, activePendingIndices);
        const updatedButtons = buildCombatButtons(p1, activePendingCards, activePendingIndices);
        await i.editReply({ embeds: [updatedEmbed], files: [turnAttachment], components: updatedButtons });
        return;
      }

      // CASE B: Opponent is human -> Swap active player turn
      round++;
      activeUserId = defender.userId;
      const nextCombatant = activeUserId === p1.userId ? p1 : p2;
      const turnAttachment = await createTurnSummaryAttachment(p1, p2, round, log, p1CardChoice, p2CardChoice);
      const updatedEmbed = buildDuelEmbed(p1, p2, round, activeUserId, combatLogs, activePendingCards, activePendingIndices);
      const updatedButtons = buildCombatButtons(nextCombatant, activePendingCards, activePendingIndices);

      await i.editReply({ embeds: [updatedEmbed], files: [turnAttachment], components: updatedButtons });
    } catch (err: any) {
      if (err.code === 10062 || err.code === 40060 || err.message?.includes('Unknown interaction')) return;
      console.error('Error in duel battle collector:', err);
    }
  });

  collector.on('end', async (_collected: any, reason: string) => {
    if (reason === 'idle' || reason === 'time') {
      await cleanupNpGif();
      try {
        await battleMsg.edit({
          content: '⌛ **Duel ended due to inactivity** *(Turn timed out after 2 minutes of no input)*.',
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
  p2Master: MasterProfile | null,
  finalAttachment: AttachmentBuilder
) {
  const warSession = getOrInitWarSession(p1Master);

  const chanTag = i.channel && 'name' in i.channel ? `#${(i.channel as any).name}` : '#general';

  // If AI opponent defeated the player Master, automatically eliminate player Master
  if (winner.isAi) {
    const outcome = recordDuelOutcome(
      warSession,
      winner.username,
      loser.username,
      'kill',
      chanTag,
      winner.currentHp,
      loser.currentHp
    );

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

    if (i.deferred || i.replied) {
      await i.editReply({
        embeds: [defeatEmbed],
        files: [finalAttachment],
        components: []
      });
    } else {
      await i.update({
        embeds: [defeatEmbed],
        files: [finalAttachment],
        components: []
      });
    }
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

  let response: any;
  if (i.deferred || i.replied) {
    response = await i.editReply({
      embeds: [fateEmbed],
      files: [finalAttachment],
      components: [fateRow]
    });
  } else {
    response = await i.update({
      embeds: [fateEmbed],
      files: [finalAttachment],
      components: [fateRow],
      withResponse: true
    }).then((r: any) => r?.resource?.message || i.fetchReply());
  }

  try {
    const confirmation = await response.awaitMessageComponent({
      filter: (btnInteraction: any) => btnInteraction.user.id === winner.userId,
      time: 60000,
      componentType: ComponentType.Button
    });

    const decision = confirmation.customId === 'duel_fate_kill' ? 'kill' : 'spare';
    const outcome = recordDuelOutcome(
      warSession,
      winner.username,
      loser.username,
      decision,
      chanTag,
      winner.currentHp,
      loser.currentHp
    );

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
    try {
      await i.editReply({
        components: []
      });
    } catch {}
  }
}
