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
import { getOrInitWarSession, recordDuelOutcome, calculateCurrentHp } from '../engine/grailwar';
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
// 2. COMBATANT INTERFACE & BUFFS
// ==========================================
export interface CombatantBuff {
  name: string;
  type: 'buff_atk' | 'buff_def' | 'crit_dmg' | 'evade' | 'guts' | 'np_gen';
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
  activeBuffs: CombatantBuff[];
  skillCooldowns: { [skillIdx: number]: number };
  gutsCount: number;
  commandSeals: number;
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

  // Initial stars based on Agility
  const initialStars = Math.min(30, Math.max(5, Math.round(totalAgi * 0.8)));

  const startingHp = overrideCurrentHp !== undefined && overrideCurrentHp > 0
    ? Math.min(maxHp, Math.round(overrideCurrentHp))
    : maxHp;

  return {
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
    activeBuffs: [],
    skillCooldowns: {},
    gutsCount: 0,
    commandSeals: isAi ? 0 : (master.commandSeals ?? 3)
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
  lastLogs?: string[]
) {
  const isP1Turn = activeUserId === p1.userId;
  const activeCombatant = isP1Turn ? p1 : p2;

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ HOLY GRAIL WAR DUEL — ROUND ${round}`)
    .setImage('attachment://turn_summary.png')
    .setDescription(
      `👉 **Current Turn:** ${activeCombatant.isAi ? '🤖 Shadow AI is calculating...' : `<@${activeCombatant.userId}>, select your Command Card, Skill, or Noble Phantasm:`}`
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
// Generates 2 rows:
// Row 1: Command Attack Cards (Buster, Arts, Quick, Noble Phantasm)
// Row 2: 3 Active Skill Sets (Skill 1 & 2 unlocked, Skill 3 unlocked at Bond Level 5) + Command Seal
function buildCombatButtons(combatant: DuelCombatant) {
  const isNpReady = combatant.npGauge >= 100;
  const skills = combatant.servant.template.skills || [];
  const bondLevel = combatant.servant.bondLevel || 1;

  // Row 1: Command Cards + Noble Phantasm
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('card_buster')
      .setLabel('Buster (+50% DMG)')
      .setEmoji('🔴')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('card_arts')
      .setLabel('Arts (+35% NP)')
      .setEmoji('🔵')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('card_quick')
      .setLabel('Quick (+25 Stars)')
      .setEmoji('🟢')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('card_np')
      .setLabel(`NP (${Math.round(combatant.npGauge)}%)`)
      .setEmoji('💥')
      .setStyle(isNpReady ? ButtonStyle.Danger : ButtonStyle.Secondary)
      .setDisabled(!isNpReady)
  );

  // Row 2: 3 Active Skill Sets + Master Command Seal
  const hasSeals = (combatant.commandSeals || 0) > 0;
  const row2 = new ActionRowBuilder<ButtonBuilder>();

  // Skill 1 (Unlocked by default)
  const s1 = skills[0];
  const cd1 = combatant.skillCooldowns[0] || 0;
  const s1Name = s1 ? s1.name.slice(0, 13) : 'Skill 1';
  row2.addComponents(
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
  row2.addComponents(
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
  row2.addComponents(
    new ButtonBuilder()
      .setCustomId('skill_2')
      .setLabel(!isS3Unlocked ? '🔒 S3 (Bond Lv 5)' : cd3 > 0 ? `S3: ${s3Name} (${cd3}T)` : `🌟 S3: ${s3Name}`)
      .setStyle(!isS3Unlocked || cd3 > 0 ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(!isS3Unlocked || cd3 > 0 || !s3)
  );

  // Master Command Seal
  row2.addComponents(
    new ButtonBuilder()
      .setCustomId('card_seal')
      .setLabel(`Seal (${combatant.commandSeals || 0})`)
      .setEmoji('🔱')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasSeals)
  );

  return [row1, row2];
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
    combatant.activeBuffs.push({ name: skill.name, type: 'buff_atk', value: val, remainingTurns: skill.duration || 2 });
    combatant.critStars = Math.min(50, combatant.critStars + 10);
    logText = `⚔️ **${combatant.servant.template.name}** activated **${skill.name}**, gaining **+${val}% ATK Buff** for ${skill.duration || 2} turns & +10 Stars!`;
  } else if (skill.effectType === 'buff_def') {
    const val = skill.value || 30;
    combatant.activeBuffs.push({ name: skill.name, type: 'buff_def', value: val, remainingTurns: skill.duration || 2 });
    logText = `🛡️ **${combatant.servant.template.name}** activated **${skill.name}**, gaining **+${val}% DEF Buff** for ${skill.duration || 2} turns!`;
  } else if (skill.effectType === 'evade' || skill.effectType === 'invincible') {
    combatant.activeBuffs.push({ name: skill.name, type: 'evade', value: 85, remainingTurns: skill.duration || 1 });
    logText = `💨 **${combatant.servant.template.name}** activated **${skill.name}**! Readied an evasive barrier to dodge incoming strikes!`;
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
  const lowHp = combatant.currentHp < combatant.maxHp * 0.6;
  let logText = '';
  if (lowHp) {
    const healAmt = Math.round(combatant.maxHp * 0.40);
    combatant.currentHp = Math.min(combatant.maxHp, combatant.currentHp + healAmt);
    combatant.npGauge = Math.min(300, combatant.npGauge + 50);
    logText = `🔱 **COMMAND SEAL INVOKED!** Master **${combatant.username}** commanded: *"By my Command Seal, recover and strike!"*\n> ✨ **${combatant.servant.template.name}** restored **+${healAmt.toLocaleString()} HP** and gained **+50% NP**!`;
  } else {
    combatant.npGauge = 100;
    combatant.critStars = Math.min(50, combatant.critStars + 20);
    logText = `🔱 **COMMAND SEAL INVOKED!** Master **${combatant.username}** commanded: *"Unleash your full Phantasm!"*\n> ⚡ **${combatant.servant.template.name}** reached **100% NP Gauge**!`;
  }
  return { success: true, log: logText };
}

// ==========================================
// 8. TURN RESOLUTION & BALANCED DAMAGE ENGINE
// ==========================================
// Uses canonical Fate / FGO combat formulas:
// - Global 0.23 damage constant prevents 1-shots while keeping strikes impactful
// - Buster: Heavy 1.5x damage + crit burst
// - Arts: 1.0x damage + high NP gain (+30-45%)
// - Quick: 0.8x damage + massive star drop (+20-30 stars)
// - Crit: 2.0x damage multiplier consuming active stars
// - NP: Devastating tactical finisher (7,000 - 13,000+ damage)
// - Skills & Evade: Active buffs, mitigations, and Guts revivals
function resolveStrike(
  attacker: DuelCombatant,
  defender: DuelCombatant,
  actionType: 'buster' | 'arts' | 'quick' | 'np' | 'skill' | 'seal'
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

  const effectiveAtk = attacker.baseAtk * atkBuff;
  const effectiveDef = defender.baseDef * defBuff;

  const classMult = getClassMultiplier(
    attacker.servant.template.servantClass,
    defender.servant.template.servantClass
  );

  let rawDmg = 0;
  let logText = '';

  // -------------------------------------------------------------
  // ACTION 1: BUSTER CARD (Raw Physical Power & Crit Impact)
  // -------------------------------------------------------------
  if (actionType === 'buster') {
    const critChance = Math.min(0.95, (attacker.critStars * 2.0) / 100);
    const isCrit = Math.random() < critChance;
    const critMult = isCrit ? (1.75 * critDmgBonus) : 1.0;
    const cardMult = 1.4;
    const variance = 0.95 + Math.random() * 0.10;

    // FGO formula scaled: (ATK * Card * 0.11 - DEF * 2) * Class * Crit * Variance
    const baseHit = (effectiveAtk * cardMult * 0.11) - (effectiveDef * 2);
    rawDmg = Math.round(Math.max(400, baseHit) * classMult * critMult * variance);

    if (isEvading) {
      rawDmg = Math.round(rawDmg * 0.15);
      defender.activeBuffs = defender.activeBuffs.filter(b => b.type !== 'evade');
    }

    attacker.npGauge = Math.min(300, attacker.npGauge + (isCrit ? 10 : 6));
    if (isCrit) {
      attacker.critStars = Math.max(0, attacker.critStars - 10);
    } else {
      attacker.critStars = Math.min(50, attacker.critStars + 3);
    }

    const evadeTag = isEvading ? ' *(Evaded 85% DMG!)*' : '';
    const critTag = isCrit ? ' 💥 **CRITICAL HIT!**' : '';
    logText = `🔴 **${attacker.servant.template.name}** unleashed **Buster Strike**${critTag}${evadeTag}, dealing **${rawDmg.toLocaleString()} DMG** to ${defender.servant.template.name}!`;
  } 
  // -------------------------------------------------------------
  // ACTION 2: ARTS CARD (High NP Gauge Generation & Stable Hit)
  // -------------------------------------------------------------
  else if (actionType === 'arts') {
    const critChance = Math.min(0.80, (attacker.critStars * 1.5) / 100);
    const isCrit = Math.random() < critChance;
    const critMult = isCrit ? (1.75 * critDmgBonus) : 1.0;
    const cardMult = 1.0;
    const variance = 0.95 + Math.random() * 0.10;

    const baseHit = (effectiveAtk * cardMult * 0.11) - (effectiveDef * 2);
    rawDmg = Math.round(Math.max(300, baseHit) * classMult * critMult * variance);

    if (isEvading) {
      rawDmg = Math.round(rawDmg * 0.15);
      defender.activeBuffs = defender.activeBuffs.filter(b => b.type !== 'evade');
    }

    const npGain = Math.round((26 + Math.random() * 8) * npGenBonus * (isCrit ? 1.4 : 1.0));
    attacker.npGauge = Math.min(300, attacker.npGauge + npGain);
    attacker.critStars = Math.min(50, attacker.critStars + 2);

    const evadeTag = isEvading ? ' *(Evaded 85% DMG!)*' : '';
    const critTag = isCrit ? ' 💥 **CRITICAL HIT!**' : '';
    logText = `🔵 **${attacker.servant.template.name}** connected with **Arts Chain**${critTag}${evadeTag}, dealing **${rawDmg.toLocaleString()} DMG** and gaining **+${npGain}% NP**!`;
  } 
  // -------------------------------------------------------------
  // ACTION 3: QUICK CARD (Critical Star Engine & Agility)
  // -------------------------------------------------------------
  else if (actionType === 'quick') {
    const critChance = Math.min(0.90, (attacker.critStars * 2.5) / 100);
    const isCrit = Math.random() < critChance;
    const critMult = isCrit ? (1.75 * critDmgBonus) : 1.0;
    const cardMult = 0.85;
    const variance = 0.95 + Math.random() * 0.10;

    const baseHit = (effectiveAtk * cardMult * 0.11) - (effectiveDef * 2);
    rawDmg = Math.round(Math.max(250, baseHit) * classMult * critMult * variance);

    if (isEvading) {
      rawDmg = Math.round(rawDmg * 0.15);
      defender.activeBuffs = defender.activeBuffs.filter(b => b.type !== 'evade');
    }

    const starsGained = Math.round(18 + Math.random() * 6);
    attacker.critStars = Math.min(50, attacker.critStars + starsGained);
    attacker.npGauge = Math.min(300, attacker.npGauge + 10);

    const evadeTag = isEvading ? ' *(Evaded 85% DMG!)*' : '';
    const critTag = isCrit ? ' 💥 **CRITICAL HIT!**' : '';
    logText = `🟢 **${attacker.servant.template.name}** executed **Quick Strike**${critTag}${evadeTag}, dealing **${rawDmg.toLocaleString()} DMG** and gathering **+${starsGained} Critical Stars**!`;
  } 
  // -------------------------------------------------------------
  // ACTION 4: NOBLE PHANTASM (Decisive Climax Finisher)
  // -------------------------------------------------------------
  else if (actionType === 'np') {
    const npTemplate = attacker.servant.template.noblePhantasm;
    const npMultiplier = (npTemplate.multiplier || 380) / 100;
    const variance = 0.96 + Math.random() * 0.08;

    // NP Formula: Balanced climax finisher dealing ~6,000 - 12,000 damage
    rawDmg = Math.round((effectiveAtk * npMultiplier * 0.18) * classMult * variance);
    rawDmg = Math.max(1500, rawDmg);

    if (isEvading) {
      rawDmg = Math.round(rawDmg * 0.20);
      defender.activeBuffs = defender.activeBuffs.filter(b => b.type !== 'evade');
    }

    const isOvercharge = attacker.npGauge >= 200;
    attacker.npGauge = 0; // Consume NP

    if (isOvercharge) {
      attacker.npGauge = 20; // 20% refund on overcharge
      attacker.critStars = Math.min(50, attacker.critStars + 12);
    }

    const chant = attacker.servant.customQuotes?.noblePhantasm || npTemplate.chant;
    const evadeTag = isEvading ? ' *(Evaded 75% NP Blast!)*' : '';
    logText = `💥 **NOBLE PHANTASM UNLEASHED!**\n> *" ${chant} "*\n> **${attacker.servant.template.name}** obliterated ${defender.servant.template.name} with **${npTemplate.name}** for **${rawDmg.toLocaleString()} decisive DMG**!${evadeTag}`;
  } 
  // -------------------------------------------------------------
  // ACTION 5: SERVANT SKILL ACTIVATION
  // -------------------------------------------------------------
  else if (actionType === 'skill') {
    const skills = attacker.servant.template.skills || [];
    let usedIdx = 0;
    for (let i = 0; i < skills.length; i++) {
      if ((attacker.skillCooldowns[i] || 0) <= 0) {
        usedIdx = i;
        break;
      }
    }
    const skill = skills[usedIdx];
    attacker.skillCooldowns[usedIdx] = skill?.cooldown || 4;

    if (!skill || skill.effectType === 'buff_atk') {
      const val = skill?.value || 30;
      attacker.activeBuffs.push({ name: skill?.name || 'ATK Buff', type: 'buff_atk', value: val, remainingTurns: 2 });
      attacker.critStars = Math.min(50, attacker.critStars + 10);
      logText = `🛡️ **${attacker.servant.template.name}** activated **${skill?.name || 'Mana Burst'}**, gaining **+${val}% ATK Buff** for 2 turns and +10 Stars!`;
    } else if (skill.effectType === 'evade' || skill.effectType === 'invincible') {
      attacker.activeBuffs.push({ name: skill.name, type: 'evade', value: 85, remainingTurns: 2 });
      logText = `💨 **${attacker.servant.template.name}** activated **${skill.name}**! Readied an impenetrable Evade against incoming attacks!`;
    } else if (skill.effectType === 'heal') {
      const healVal = Math.round(attacker.maxHp * 0.25);
      attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + healVal);
      logText = `✨ **${attacker.servant.template.name}** activated **${skill.name}**, restoring **+${healVal.toLocaleString()} HP**!`;
    } else if (skill.effectType === 'np_charge') {
      attacker.npGauge = Math.min(300, attacker.npGauge + (skill.value || 30));
      attacker.critStars = Math.min(50, attacker.critStars + 15);
      logText = `⚡ **${attacker.servant.template.name}** activated **${skill.name}**, charging **+${skill.value || 30}% NP** and +15 Critical Stars!`;
    } else if (skill.effectType === 'crit_stars') {
      const starVal = skill.value || 25;
      attacker.critStars = Math.min(50, attacker.critStars + starVal);
      attacker.activeBuffs.push({ name: skill.name, type: 'crit_dmg', value: 40, remainingTurns: 2 });
      logText = `🌟 **${attacker.servant.template.name}** activated **${skill.name}**, generating **+${starVal} Stars** & +40% Crit DMG!`;
    } else {
      attacker.activeBuffs.push({ name: skill.name, type: 'buff_atk', value: 25, remainingTurns: 2 });
      logText = `🛡️ **${attacker.servant.template.name}** activated **${skill.name}**!`;
    }
  }
  // -------------------------------------------------------------
  // ACTION 6: MASTER COMMAND SEAL INVOCATION
  // -------------------------------------------------------------
  else if (actionType === 'seal') {
    if (attacker.commandSeals > 0) {
      attacker.commandSeals--;
      const lowHp = attacker.currentHp < attacker.maxHp * 0.6;
      if (lowHp) {
        const healAmt = Math.round(attacker.maxHp * 0.40);
        attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + healAmt);
        attacker.npGauge = Math.min(300, attacker.npGauge + 50);
        logText = `🔱 **COMMAND SEAL INVOKED!** Master **${attacker.username}** commanded: *"By the power of my Command Seal, recover and strike!"*\n> ✨ **${attacker.servant.template.name}** restored **+${healAmt.toLocaleString()} HP** and gained **+50% NP**!`;
      } else {
        attacker.npGauge = 100;
        attacker.critStars = Math.min(50, attacker.critStars + 20);
        logText = `🔱 **COMMAND SEAL INVOKED!** Master **${attacker.username}** commanded: *"Unleash your full Phantasm!"*\n> ⚡ **${attacker.servant.template.name}** instantly reached **100% NP Gauge**!`;
      }
    }
  }

  // Apply damage to defender HP
  defender.currentHp = Math.max(0, defender.currentHp - rawDmg);

  // Check for Guts (Battle Continuation)
  if (defender.currentHp <= 0 && defender.gutsCount > 0) {
    defender.gutsCount--;
    const reviveHp = Math.round(defender.maxHp * 0.20);
    defender.currentHp = reviveHp;
    logText += `\n✝️ **BATTLE CONTINUATION!** ${defender.servant.template.name} refused to perish, clinging to life with **${reviveHp.toLocaleString()} HP**!`;
  }

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
  let activeUserId = p1.userId;
  const combatLogs: string[] = ['⚔️ The Command Seal glow resonates... The Holy Grail Duel begins!'];

  const initialAttachment = await createTurnSummaryAttachment(p1, p2, round, combatLogs[0]);
  const initialEmbed = buildDuelEmbed(p1, p2, round, activeUserId, combatLogs);
  const initialButtons = buildCombatButtons(p1);

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

      // Acknowledge Discord immediately so the 3s timeout never triggers during canvas rendering
      await i.deferUpdate();

      // CASE: SKILL ACTIVATION (Instant - does NOT end turn)
      if (i.customId.startsWith('skill_')) {
        const skillIdx = parseInt(i.customId.replace('skill_', ''), 10);
        const actor = activeUserId === p1.userId ? p1 : p2;
        const res = activateCombatantSkill(actor, skillIdx);
        combatLogs.push(res.log);
        if (combatLogs.length > 4) combatLogs.shift();

        const p1CardChoice: CardType[] = ['Arts', 'Buster', 'Quick'];
        const p2CardChoice: CardType[] = ['Arts', 'Buster', 'Quick'];
        const turnAttachment = await createTurnSummaryAttachment(p1, p2, round, res.log, p1CardChoice, p2CardChoice);
        const updatedEmbed = buildDuelEmbed(p1, p2, round, activeUserId, combatLogs);
        const updatedButtons = buildCombatButtons(actor);
        await i.editReply({ embeds: [updatedEmbed], files: [turnAttachment], components: updatedButtons });
        return;
      }

      // CASE: COMMAND SEAL ACTIVATION (Instant - does NOT end turn)
      if (i.customId === 'card_seal') {
        const actor = activeUserId === p1.userId ? p1 : p2;
        const actingMaster = activeUserId === p1Master.discordId ? p1Master : p2Master;
        if (actingMaster && actingMaster.commandSeals > 0) {
          actingMaster.commandSeals--;
          await saveMaster(actingMaster);
        }
        const res = invokeCombatantSeal(actor);
        combatLogs.push(res.log);
        if (combatLogs.length > 4) combatLogs.shift();

        const p1CardChoice: CardType[] = ['Arts', 'Buster', 'Quick'];
        const p2CardChoice: CardType[] = ['Arts', 'Buster', 'Quick'];
        const turnAttachment = await createTurnSummaryAttachment(p1, p2, round, res.log, p1CardChoice, p2CardChoice);
        const updatedEmbed = buildDuelEmbed(p1, p2, round, activeUserId, combatLogs);
        const updatedButtons = buildCombatButtons(actor);
        await i.editReply({ embeds: [updatedEmbed], files: [turnAttachment], components: updatedButtons });
        return;
      }

      let actionType: 'buster' | 'arts' | 'quick' | 'np' = 'buster';
      if (i.customId === 'card_buster') actionType = 'buster';
      if (i.customId === 'card_arts') actionType = 'arts';
      if (i.customId === 'card_quick') actionType = 'quick';
      if (i.customId === 'card_np') actionType = 'np';

      const attacker = activeUserId === p1.userId ? p1 : p2;
      const defender = activeUserId === p1.userId ? p2 : p1;

      // Execute Player attack
      const log = resolveStrike(attacker, defender, actionType);
      combatLogs.push(log);
      if (combatLogs.length > 4) combatLogs.shift(); // Keep last 4 logs clean

      const p1CardChoice: CardType[] = actionType === 'buster' 
        ? ['Buster', 'Buster', 'Buster'] 
        : actionType === 'arts' 
        ? ['Arts', 'Arts', 'Arts'] 
        : actionType === 'quick'
        ? ['Quick', 'Quick', 'Quick']
        : ['Arts', 'Buster', 'Quick'];
      let p2CardChoice: CardType[] = ['Arts', 'Buster', 'Quick'];

      // Check if Defender fainted
      if (defender.currentHp <= 0) {
        collector.stop();
        const finalAttachment = await createTurnSummaryAttachment(p1, p2, round, log, p1CardChoice, p2CardChoice);
        await finishDuel(i, attacker, defender, p1Master, p2Master, finalAttachment);
        return;
      }

      // CASE A: Opponent is AI -> AI immediately strikes back
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

        let aiAction: 'buster' | 'arts' | 'quick' | 'np' = 'buster';
        if (defender.npGauge >= 100) {
          aiAction = 'np';
        } else {
          const rand = Math.random();
          if (rand < 0.45) aiAction = 'buster';
          else if (rand < 0.75) aiAction = 'arts';
          else aiAction = 'quick';
        }

        p2CardChoice = aiAction === 'buster' 
          ? ['Buster', 'Buster', 'Buster'] 
          : aiAction === 'arts' 
          ? ['Arts', 'Arts', 'Arts'] 
          : aiAction === 'quick'
          ? ['Quick', 'Quick', 'Quick']
          : ['Arts', 'Buster', 'Quick'];

        const aiLog = resolveStrike(defender, attacker, aiAction);
        combatLogs.push(aiLog);
        if (combatLogs.length > 4) combatLogs.shift();

        if (attacker.currentHp <= 0) {
          collector.stop();
          const finalAttachment = await createTurnSummaryAttachment(p1, p2, round, aiLog, p1CardChoice, p2CardChoice);
          await finishDuel(i, defender, attacker, p1Master, p2Master, finalAttachment);
          return;
        }

        // Keep turn on P1
        activeUserId = p1.userId;
        const turnAttachment = await createTurnSummaryAttachment(p1, p2, round, log, p1CardChoice, p2CardChoice);
        const updatedEmbed = buildDuelEmbed(p1, p2, round, activeUserId, combatLogs);
        const updatedButtons = buildCombatButtons(p1);
        await i.editReply({ embeds: [updatedEmbed], files: [turnAttachment], components: updatedButtons });
        return;
      }

      // CASE B: Opponent is human -> Swap active player turn
      round++;
      activeUserId = defender.userId;
      const nextCombatant = activeUserId === p1.userId ? p1 : p2;
      const turnAttachment = await createTurnSummaryAttachment(p1, p2, round, log, p1CardChoice, p2CardChoice);
      const updatedEmbed = buildDuelEmbed(p1, p2, round, activeUserId, combatLogs);
      const updatedButtons = buildCombatButtons(nextCombatant);

      await i.editReply({ embeds: [updatedEmbed], files: [turnAttachment], components: updatedButtons });
    } catch (err: any) {
      if (err.code === 10062 || err.code === 40060 || err.message?.includes('Unknown interaction')) return;
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
