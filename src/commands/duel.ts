import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  AttachmentBuilder,
  User,
  ComponentType,
  Message,
  MessageFlags } from 'discord.js';
import { getOrCreateMaster, saveMaster, getDuelNpSettings, getAllMasters, getAllThroneServants } from '../database/service';
import { MasterProfile, MasterServantInstance, CardType, ServantClass, ActiveCombatant, CombatTurnLog, PassiveSkill } from '../types';
import { SERVANT_DATABASE, getDefaultClassPassives, getUnlockedPassives, getServantAvatarAndCardArt } from '../data/servants';
import { resolveAscensionSprite } from '../data/servantAscensions';
import { getOrInitWarSession, recordDuelOutcome, calculateCurrentHp, getReputationInfo, isUserSlainCivilianInWar } from '../engine/grailwar';
import { renderBattleTurnSummary, renderDialogueCard, renderDefeatDialogueCard, renderMasterCommandSealDialogueCard, renderSkillDialogueCard, cleanCanvasText } from '../canvas/renderer';
import { PVP_DAMAGE_MODIFIER, calculateFleeChance, rollFleeSuccess } from '../engine/battle';
import { getNoblePhantasmGif, getNoblePhantasmChant } from '../data/noblePhantasmGifs';
import { normalizeMediaUrl } from '../utils/mediaResolver';
import { safeSetEmbedImage, safeSetEmbedThumbnail } from '../utils/discordEmbedHelper';
import { calculateCombatantBuffSummary, buildTacticalDossierEmbed } from '../utils/combatBuffHelper';
import { getServantChainDialogue, shouldTriggerDialogueCutIn, getServantSkillQuote } from '../engine/dialogue';
import { getServantMatchupDialogue } from '../data/servantMatchups';
import { generateServantBattleReaction } from '../engine/talkService';
import { addBondExpToServant } from '../../lib/engine/bondEvents';
import { addServantBattleExp } from '../engine/customization';
import { checkAndGrantBond10Ce, getBondCraftEssenceForServant } from '../data/craftEssences';
import { getRandomBackgroundUrl } from '../data/backgrounds';
import { isBondCeActiveForServant, getCePassiveStats, applyCeInitialCombatantEffects, applyCePartyAuras, processCeTurnStartEffects, processCeOnAttackEffects } from '../utils/craftEssenceHelper';

// ==========================================
// 1. SLASH COMMAND DEFINITION
// ==========================================
// Allows a Master to challenge real human players via @Master in 1v1, 2v2 Tag-Team, or 1v2 Raid.
export const data = new SlashCommandBuilder()
  .setName('duel')
  .setDescription('Engage in a turn-based tactical Fate battle (1v1, 2v2 Alliance, 1v2 Raid, or Force Join)')
  .addStringOption(option =>
    option
      .setName('mode')
      .setDescription('Battle Format')
      .setRequired(false)
      .addChoices(
        { name: '🕊️ Free Battle / Sparring', value: 'free' },
        { name: '⚔️ 1v1 Holy Grail Duel', value: '1v1' },
        { name: '🛡️ 2v2 Alliance Tag-Team', value: '2v2' },
        { name: '⚔️ 1v2 Raid Survival', value: '1v2' },
        { name: '⚡ Force Join Arena', value: 'forcejoin' }
      )
  )
  .addBooleanOption(option =>
    option
      .setName('free')
      .setDescription('Enable Free Battle / Friendly Sparring (Zero elimination risk, full rewards)')
      .setRequired(false)
  )
  .addUserOption(option =>
    option
      .setName('opponent')
      .setDescription('Primary target Master to duel')
      .setRequired(false)
  )
  .addUserOption(option =>
    option
      .setName('ally')
      .setDescription('Allied Master for 2v2 Alliance Tag-Team')
      .setRequired(false)
  )
  .addUserOption(option =>
    option
      .setName('opponent2')
      .setDescription('Second Opponent Master for 2v2 or 1v2 Raid')
      .setRequired(false)
  );

// ==========================================
// 2. COMBATANT INTERFACE & BUFFS
// ==========================================
export interface CombatantBuff {
  name: string;
  type: 'buff_atk' | 'buff_def' | 'crit_dmg' | 'evade' | 'guts' | 'np_gen' | 'np_gain' | 'buster_up' | 'arts_up' | 'quick_up' | 'invincible' | 'stun' | 'debuff_atk' | 'debuff_def' | 'ignore_invincible' | 'stars_per_turn' | 'hp_regen' | 'debuff_np_strength' | 'debuff_np_dmg' | string;
  value: number;
  remainingTurns: number;
  remainingHits?: number;
  isHitCount?: boolean;
  appliedRound?: number;
  appliedTurnUserId?: string;
  hasDefendedOnce?: boolean;
}

export interface DuelCombatant {
  userId: string;
  username: string;
  isAi: boolean;
  servant: MasterServantInstance;
  avatarUrl?: string;
  baseAvatarUrl?: string;
  spriteUrl?: string;
  isTransformed?: boolean;
  transformationTurns?: number;
  currentHp: number;
  maxHp: number;
  baseAtk: number;
  atk: number;
  baseDef: number;
  def: number;
  npGauge: number;
  critStars: number;
  isStunned?: boolean;
  isEvading?: boolean;
  isInvincible?: boolean;
  isAntiPurgeDefense?: boolean;
  passives?: PassiveSkill[];
  activeBuffs: CombatantBuff[];
  skillCooldowns: { [skillIdx: number]: number };
  gutsCount: number;
  commandSeals: number;
  currentHand?: ('Buster' | 'Arts' | 'Quick')[];
  drawPile?: ('Buster' | 'Arts' | 'Quick')[];
  masterAvatarUrl?: string;
  selectedTargetId?: string;
  isFled?: boolean;
}

export function getCombatantSpriteUrl(combatantOrServant: any): string {
  const servant = combatantOrServant?.servant || combatantOrServant;
  if (!servant) return '';
  const artInfo = getServantAvatarAndCardArt(servant);
  const activeStage = (servant as any).selectedAscensionStage ?? servant.template?.selectedAscensionStage;
  const stageSprite = resolveAscensionSprite(servant, activeStage, servant.level, servant.bondLevel);
  return stageSprite || artInfo.spriteUrl || artInfo.cardArtUrl || servant.avatarUrl || servant.template?.avatarUrl || '';
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
  if (attacker === 'Shielder' || defender === 'Shielder') return 1.0;

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
function createCombatant(
  master: MasterProfile,
  servant: MasterServantInstance,
  isAi: boolean = false,
  overrideCurrentHp?: number,
  isFreeBattle: boolean = false
): DuelCombatant {
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

  // Unified Formula: Base Stat + (Total Parameter * factor) + Craft Essence Equipment
  const maxHp = Math.round((t.baseHp || 28000) + totalEnd * 150 + ceHp);
  let baseAtk = Math.round((t.baseAtk || 10000) + totalStr * 80 + ceAtk);

  // Curse of Heresy for Rogue Heretics (10+ civilian kills): -10% ATK suppression by Church Wards
  if ((master.innocentKills || 0) >= 10 || master.isRogueHeretic) {
    baseAtk = Math.max(1000, Math.round(baseAtk * 0.9));
  }

  const baseDef = 10 + totalEnd * 2;

  // Check if equipped CE grants starting NP (e.g. Kaleidoscope grants 80% starting NP)
  let initialNp = 0;
  const ce = servant.equippedCe;
  if (ce) {
    const ceStats = getCePassiveStats(ce, servant);
    if (ceStats.startingNp > 0) {
      initialNp = ceStats.startingNp;
    }
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

  const isSafeModeOrFree = isFreeBattle || master.environmentMode === 'safe' || !master.environmentMode;
  const startingHp = isSafeModeOrFree
    ? maxHp
    : (overrideCurrentHp !== undefined
      ? Math.max(0, Math.min(maxHp, Math.round(overrideCurrentHp)))
      : (servant.currentHp !== undefined && servant.currentHp > 0
        ? Math.min(maxHp, Math.round(servant.currentHp))
        : maxHp));

  const initialBuffs: CombatantBuff[] = [];

  // Absolute Permanence Passive (Luvria Greenharte / Concept Anchor)
  const hasAbsolutePermanence = passives.some(p => p.type === 'absolute_permanence' || (p.name && p.name.includes('Absolute Permanence'))) ||
    (t.passives && t.passives.some(p => p.type === 'absolute_permanence' || (p.name && p.name.includes('Absolute Permanence'))));
  if (hasAbsolutePermanence) {
    initialBuffs.push({
      name: 'Absolute Permanence (Concept Anchor)',
      type: 'guts',
      value: Math.round(maxHp * 0.25),
      remainingTurns: 99,
      remainingHits: 1,
      isHitCount: true
    });
  }

  const artInfo = getServantAvatarAndCardArt(servant);
  const baseAvatar = artInfo.cardArtUrl || artInfo.avatarUrl;
  const spriteUrl = getCombatantSpriteUrl(servant) || baseAvatar;

  const combatant: DuelCombatant = {
    userId: master.discordId,
    username: master.username,
    isAi,
    servant,
    avatarUrl: baseAvatar,
    baseAvatarUrl: baseAvatar,
    spriteUrl,
    isTransformed: false,
    transformationTurns: 0,
    currentHp: startingHp,
    maxHp,
    baseAtk,
    atk: baseAtk,
    baseDef,
    def: baseDef,
    npGauge: initialNp,
    critStars: initialStars,
    passives,
    activeBuffs: initialBuffs,
    skillCooldowns: {},
    gutsCount: 0,
    commandSeals: isAi ? 0 : (isFreeBattle || master.environmentMode === 'safe' ? 3 : (master.commandSeals ?? 3)),
    drawPile: [],
    masterAvatarUrl: (master.avatarUrl && !master.avatarUrl.includes('unsplash.com')) ? master.avatarUrl : undefined
  };

  // Apply all Craft Essence initial passives (Guts, starting NP, stats, card buffs, damage cuts)
  applyCeInitialCombatantEffects(combatant);
  combatant.gutsCount = combatant.activeBuffs.filter(b => b.type === 'guts').reduce((sum, b) => sum + (b.remainingHits && b.remainingHits > 0 ? b.remainingHits : 1), 0);
  combatant.isInvincible = combatant.activeBuffs.some(b => b.type === 'invincible');
  combatant.isEvading = combatant.activeBuffs.some(b => b.type === 'evade');

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

// Helper to calculate chain-based dialogue quote, tag, and embed color
function getCombatantChainDialogue(
  combatant: DuelCombatant,
  cards: ('Buster' | 'Arts' | 'Quick' | 'NP')[],
  roundSeed: number = 0
): { quote: string; tag: string; color: number } {
  const sName = combatant.servant.nickname || combatant.servant.template?.name || 'Heroic Spirit';
  const sClass = combatant.servant.template?.servantClass || 'Servant';
  const customQuotes = combatant.servant.customQuotes;
  return getServantChainDialogue(
    sName,
    sClass,
    cards,
    customQuotes,
    combatant.currentHp,
    combatant.maxHp,
    roundSeed
  );
}

// Helper to build pre-attack visual novel dialogue cut-in embed box
function buildDialogueCutInEmbed(
  attacker: DuelCombatant,
  defender: DuelCombatant,
  sequence: ('Buster' | 'Arts' | 'Quick' | 'NP')[],
  dialogue: { quote: string; tag: string; color: number },
  hasImageAttachment: boolean = true
): EmbedBuilder {
  const sName = attacker.servant.nickname || attacker.servant.template?.name || 'Heroic Spirit';
  const sClass = attacker.servant.template?.servantClass || 'Servant';

  const embed = new EmbedBuilder()
    .setTitle(`💬 [${dialogue.tag}] — ${sName.toUpperCase()}`)
    .setColor(dialogue.color)
    .setFooter({ text: 'Holy Grail War • Tactical RPG Visual Novel Dialogue Cut-In' });

  const seqDisplay = sequence.map(c => {
    if (c === 'Buster') return '🔴 **Buster**';
    if (c === 'Arts') return '🔵 **Arts**';
    if (c === 'Quick') return '🟢 **Quick**';
    return '💥 **Noble Phantasm**';
  }).join(' ➔ ');

  embed.setDescription(
    `### ⚔️ **${sName}** *(${sClass})*\n` +
    `> ❝ ***${dialogue.quote}*** ❞\n\n` +
    (sequence.length > 0 ? `⚡ **Tactical Focus:** ${seqDisplay}\n` : '') +
    `🎯 **Target:** **${defender.servant.nickname || defender.servant.template?.name}**\n\n` +
    `⏳ *Resolving tactical action...*`
  );

  if (hasImageAttachment) {
    embed.setImage('attachment://vn_dialogue.gif');
  }

  return embed;
}

// Master-specific Command Seal Invocation Cut-In Embed Builder
function buildMasterCommandSealDialogueCutInEmbed(
  masterName: string,
  masterAvatarUrl: string | undefined,
  servantName: string,
  servantClass: string,
  quote: string,
  hasImageAttachment: boolean = true
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`🔱 [COMMAND SEAL INVOCATION] — MASTER ${masterName.toUpperCase()}`)
    .setColor(0xe11d48)
    .setFooter({ text: 'Holy Grail War • Master Absolute Authority Invocation' });

  if (masterAvatarUrl && !masterAvatarUrl.includes('unsplash.com')) {
    embed.setAuthor({ name: `Master ${masterName}`, iconURL: masterAvatarUrl });
  }

  const cleanQuote = quote.replace(/^["“]/, '').replace(/["”]$/, '').trim();

  embed.setDescription(
    `### 🔱 **Master ${masterName}** *(Chaldea Magus)*\n` +
    `> ❝ ***“${cleanQuote}”*** ❞\n\n` +
    `⚡ **Command Decree:** Surge Noble Phantasm Gauge to **100% Ready**\n` +
    `🛡️ **Contracted Servant:** **${servantName}** *(${servantClass})*\n\n` +
    `⏳ *Invoking absolute magus authority...*`
  );

  if (hasImageAttachment) {
    embed.setImage('attachment://seal_dialogue.png');
  }

  return embed;
}

async function createTurnSummaryAttachment(
  p1: DuelCombatant,
  p2: DuelCombatant,
  round: number,
  lastLogText: string,
  p1Cards: ('Buster' | 'Arts' | 'Quick' | 'NP')[] = ['Buster', 'Arts', 'Quick'],
  p2Cards: ('Buster' | 'Arts' | 'Quick' | 'NP')[] = ['Arts', 'Buster', 'Quick'],
  p1Ally?: DuelCombatant,
  p2Ally?: DuelCombatant,
  combatLogsHistory: string[] = [],
  teamSoloList: DuelCombatant[] = []
): Promise<AttachmentBuilder> {
  const mapToActive = (c: DuelCombatant): ActiveCombatant => {
    const artInfo = getServantAvatarAndCardArt(c.servant);
    const baseAvatar = c.baseAvatarUrl || artInfo.cardArtUrl || artInfo.avatarUrl;
    const currentAvatar = c.isTransformed ? (c.avatarUrl || 'https://ella.janitorai.com/media-approved/zUtP5PQLU7fMKVyin9H-f.webp') : baseAvatar;
    const activeStage = (c.servant as any).selectedAscensionStage ?? c.servant.template?.selectedAscensionStage;
    const stageSprite = resolveAscensionSprite(c.servant, activeStage, c.servant.level, c.servant.bondLevel);
    const resolvedSprite = c.isTransformed ? currentAvatar : (stageSprite || c.spriteUrl || artInfo.spriteUrl || currentAvatar);
    return {
      id: c.userId,
      name: c.isTransformed ? `${c.servant.nickname || c.servant.template.name} (Super Aoko)` : (c.servant.nickname || c.servant.template.name),
      masterName: c.username,
      servantClass: c.servant.template.servantClass,
      avatarUrl: currentAvatar,
      baseAvatarUrl: baseAvatar,
      cardArtUrl: artInfo.cardArtUrl || currentAvatar,
      spriteUrl: resolvedSprite,
      selectedAscensionStage: activeStage,
      customArtworkUrl: (c.servant as any).customArtworkUrl,
      isTransformed: c.isTransformed,
      transformationTurns: c.transformationTurns,
      maxHp: c.maxHp,
      currentHp: c.currentHp,
      atk: c.atk,
      def: c.def,
      stats: c.servant.template.baseStats,
      commandDeck: c.servant.template.commandDeck,
      npGauge: c.npGauge,
      activeBuffs: c.activeBuffs.map(b => ({ name: b.name, type: b.type, value: b.value, remainingTurns: b.remainingTurns, remainingHits: b.remainingHits, isHitCount: b.isHitCount })),
      equippedCe: c.servant.equippedCe,
      skills: (c.servant.template.skills || []).map((s, idx) => ({ ...s, currentCooldown: c.skillCooldowns[idx] || 0 })),
      noblePhantasm: c.servant.template.noblePhantasm,
      critStars: c.critStars,
      bondLevel: c.servant.bondLevel || 1,
      passives: c.passives,
      gutsCount: c.gutsCount,
      isStunned: c.isStunned
    };
  };

  const activeP1 = mapToActive(p1);
  const activeP2 = mapToActive(p2);
  const activeP1Ally = p1Ally ? mapToActive(p1Ally) : undefined;
  const activeP2Ally = p2Ally ? mapToActive(p2Ally) : undefined;

  const isSkillActivation = Boolean(lastLogText && (lastLogText.includes('activated') || lastLogText.includes('Skill:')));
  const isSealActivation = Boolean(lastLogText && lastLogText.includes('COMMAND SEAL INVOKED'));

  // If lastLogText is a kill log or other non-damage log (and NOT a skill/seal action), look back in combatLogsHistory for the strike log
  let strikeLogText = lastLogText || '';
  if (!isSkillActivation && !isSealActivation && !/DMG/i.test(strikeLogText) && combatLogsHistory && combatLogsHistory.length > 0) {
    for (let k = combatLogsHistory.length - 1; k >= 0; k--) {
      if (/DMG/i.test(combatLogsHistory[k])) {
        strikeLogText = combatLogsHistory[k];
        break;
      }
    }
  }

  const isCrit = !isSkillActivation && (lastLogText.includes('CRITICAL') || strikeLogText.includes('CRITICAL'));
  const isNP = !isSkillActivation && (lastLogText.includes('NOBLE PHANTASM') || strikeLogText.includes('NOBLE PHANTASM'));

  // Identify who was the attacker / actor in the most recent combat log entry
  const allCombatants = [p1, p2, p1Ally, p2Ally, ...teamSoloList].filter((c): c is DuelCombatant => !!c);

  let activeAttacker: DuelCombatant | undefined = undefined;
  if (isSkillActivation || isSealActivation) {
    activeAttacker = allCombatants.find(c => {
      const sName = (c.servant.nickname || c.servant.template?.name || '').toLowerCase();
      const tName = (c.servant.template?.name || '').toLowerCase();
      const uName = (c.username || '').toLowerCase();
      return (sName && lastLogText.toLowerCase().includes(sName)) ||
             (tName && lastLogText.toLowerCase().includes(tName)) ||
             (uName && lastLogText.toLowerCase().includes(uName));
    });
  } else {
    // Extract leading bold attacker name from log string
    const leadMatch = strikeLogText.match(/^(?:⚔️|🎴|✨|🔴|🛡️|💥|👁️)?\s*(?:\*\*[^*]+\*\*\s+)?\*\*([^*]+)\*\*/i)
                   || lastLogText.match(/^(?:⚔️|🎴|✨|🔴|🛡️|💥|👁️)?\s*(?:\*\*[^*]+\*\*\s+)?\*\*([^*]+)\*\*/i);

    if (leadMatch) {
      const rawLeadName = leadMatch[1].trim().toLowerCase();
      activeAttacker = allCombatants.find(c => {
        const sName = (c.servant.nickname || c.servant.template?.name || '').toLowerCase();
        const tName = (c.servant.template?.name || '').toLowerCase();
        const uName = (c.username || '').toLowerCase();
        return sName === rawLeadName || tName === rawLeadName || uName === rawLeadName;
      });
    }
  }

  if (!activeAttacker) {
    // Fallback: Check who executed or activated the action
    activeAttacker = allCombatants.find(c => {
      const sName = c.servant.nickname || c.servant.template?.name || '';
      const tName = c.servant.template?.name || '';
      const uName = c.username || '';
      const pattern = new RegExp(`(${sName}|${tName}|${uName})\\s*(?:executed|activated|unleashed|attacked)`, 'i');
      return pattern.test(strikeLogText) || pattern.test(lastLogText);
    });
  }

  if (!activeAttacker) {
    activeAttacker = p1;
  }

  const foundDefender = allCombatants.find(c =>
    c !== activeAttacker && (
      strikeLogText.includes(`to ${c.servant.template.name}`) ||
      strikeLogText.includes(`to ${c.servant.nickname || c.servant.template.name}`) ||
      strikeLogText.includes(`to ${c.username}`) ||
      lastLogText.includes(`to ${c.servant.template.name}`)
    )
  );
  const activeDefender = foundDefender || (
    activeAttacker.selectedTargetId
      ? allCombatants.find(c => c.userId === activeAttacker.selectedTargetId && c.currentHp > 0)
      : undefined
  ) || (activeAttacker === p1 ? p2 : p1);

  const activeCards = activeAttacker === p2 ? p2Cards : p1Cards;

  let dQuote = '';
  let dTag = '';

  if (isSealActivation) {
    const quoteMatch = lastLogText.match(/❝ \*\*\*(.*?)\*\*\* ❞/) || lastLogText.match(/\*“{1,2}(.*?)[”"]{1,2}\*/);
    dQuote = quoteMatch ? quoteMatch[1] : (activeAttacker.servant.customQuotes?.commandSeal || 'By my Command Seal, unleash your Noble Phantasm!');
    dTag = 'COMMAND SEAL INVOCATION';
  } else if (isSkillActivation) {
    const quoteMatch = lastLogText.match(/❝ \*\*\*(.*?)\*\*\* ❞/) || lastLogText.match(/\*“(.*?)[”"]\*/);
    dQuote = quoteMatch ? quoteMatch[1] : (activeAttacker.servant.customQuotes?.skill || 'My power answers the command!');
    dTag = 'SKILL ACTIVATION';
  } else {
    const dInfo = getCombatantChainDialogue(activeAttacker, activeCards);
    dQuote = dInfo.quote;
    dTag = dInfo.tag;
  }

  // Clean quote from markdown symbols and emojis
  dQuote = dQuote.replace(/^[*_~`#💬✨🔱"“'❝\s]+|[*_~`#💬✨🔱"”'❞\s]+$/g, '').trim();

  // Extract damage, NP gained, stars generated via regex
  let damageDealt = 0;
  if (!isSkillActivation && !isSealActivation) {
    const dmgMatch = strikeLogText.match(/Dealt \*\*([\d,]+) DMG\*\*/i)
      || strikeLogText.match(/counter-attacked for \*\*([\d,]+) DMG\*\*/i)
      || strikeLogText.match(/([\d,]+)\s*DMG/i)
      || lastLogText.match(/Dealt \*\*([\d,]+) DMG\*\*/i)
      || lastLogText.match(/([\d,]+)\s*DMG/i);
    damageDealt = dmgMatch ? parseInt(dmgMatch[1].replace(/,/g, ''), 10) : 0;
  }

  const npMatch = strikeLogText.match(/\+(\d+)%\s*NP/i) || lastLogText.match(/\+(\d+)%\s*NP/i);
  const npCharged = npMatch ? parseInt(npMatch[1], 10) : 0;

  const starMatch = strikeLogText.match(/\+(\d+)\s*Critical Stars/i) || strikeLogText.match(/\+(\d+)\s*Stars/i) || lastLogText.match(/\+(\d+)\s*Critical Stars/i);
  const starsGenerated = starMatch ? parseInt(starMatch[1], 10) : 0;
  const isEvaded = !isSkillActivation && !isSealActivation && damageDealt === 0 && (/evaded/i.test(strikeLogText) || /evade/i.test(strikeLogText));
  const isInvincible = !isSkillActivation && !isSealActivation && damageDealt === 0 && (/invincible/i.test(strikeLogText) || (/invincible/i.test(lastLogText) && !lastLogText.includes('activated')));

  let cardChainType: string | undefined = undefined;
  const fullLogCheck = `${lastLogText} ${strikeLogText}`;
  if (/Buster Brave Chain/i.test(fullLogCheck)) {
    cardChainType = 'Buster Brave Chain';
  } else if (/Arts Brave Chain/i.test(fullLogCheck)) {
    cardChainType = 'Arts Brave Chain';
  } else if (/Quick Brave Chain/i.test(fullLogCheck)) {
    cardChainType = 'Quick Brave Chain';
  } else if (/Brave Chain/i.test(fullLogCheck)) {
    cardChainType = 'Brave Chain';
  } else if (/Buster Chain/i.test(fullLogCheck)) {
    cardChainType = 'Buster Chain';
  } else if (/Arts Chain/i.test(fullLogCheck)) {
    cardChainType = 'Arts Chain';
  } else if (/Quick Chain/i.test(fullLogCheck)) {
    cardChainType = 'Quick Chain';
  }

  const logWithoutQuotes = lastLogText
    .replace(/\n?>\s*.*$/gim, '')
    .replace(/❝.*?❞/g, '')
    .replace(/“.*?”/g, '')
    .replace(/💬.*$/g, '');

  const cleanActionSummary = logWithoutQuotes
    .replace(/[*_~`>#]/g, '')
    .replace(/[•·]/g, '|')
    .replace(/[⚔️💥✨🌀⚡🔴🔵🟢🛡️👑🌟🗡️🔥💀🩸]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  const activeTeamSolo = teamSoloList.map(c => {
    const mapped = mapToActive(c);
    mapped.isSoloRogue = true;
    mapped.roleTag = 'SOLO ROGUE';
    return mapped;
  });

  const p1AllyCards = p1Ally?.currentHand?.slice(0, 3) || activeTeamSolo[1]?.commandDeck?.slice(0, 3);
  const p2AllyCards = p2Ally?.currentHand?.slice(0, 3) || activeTeamSolo[0]?.commandDeck?.slice(0, 3);

  const turnLog: CombatTurnLog = {
    turnNumber: round,
    actorId: activeAttacker.userId,
    actorName: activeAttacker.servant.template.name,
    targetId: activeDefender.userId,
    targetName: activeDefender.servant.template.name,
    actionSummary: cleanActionSummary,
    cardChainType,
    dialogueQuote: dQuote,
    dialogueTag: dTag,
    dialogueTitle: activeAttacker.servant.template.name,
    cardsUsed: activeCards,
    p1Cards: p1Cards,
    p2Cards: p2Cards,
    p1AllyCards: p1AllyCards as any,
    p2AllyCards: p2AllyCards as any,
    skillsUsed: [],
    npTriggered: isNP,
    isNoblePhantasm: isNP,
    damageDealt,
    isCritical: isCrit,
    isEvaded,
    isInvincible,
    starsGenerated,
    npCharged,
    actorHpRemaining: activeAttacker.currentHp,
    targetHpRemaining: activeDefender.currentHp,
    actorHpMax: activeAttacker.maxHp,
    targetHpMax: activeDefender.maxHp,
    actorNp: activeAttacker.npGauge,
    targetNp: activeDefender.npGauge
  };

  const imageBuffer = await renderBattleTurnSummary(
    turnLog,
    activeP1,
    activeP2,
    activeP1Ally,
    activeP2Ally,
    undefined,
    undefined,
    activeTeamSolo
  );
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
  pendingIndices: number[] = [],
  p1Ally?: DuelCombatant,
  p2Ally?: DuelCombatant,
  selectedTarget?: DuelCombatant,
  teamSoloList: DuelCombatant[] = []
) {
  const allCombatants = [p1, p2, p1Ally, p2Ally, ...teamSoloList].filter((c): c is DuelCombatant => !!c);
  const activeCombatant = allCombatants.find(c => c.userId === activeUserId) || p1;
  const isP1Team = activeCombatant === p1 || activeCombatant === p1Ally;
  const isSoloRogue = teamSoloList.some(c => c.userId === activeCombatant.userId);

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

  let targetSection = '';
  if (selectedTarget) {
    const tName = selectedTarget.servant.nickname || selectedTarget.servant.template?.name || 'Opponent';
    const tSummary = calculateCombatantBuffSummary(selectedTarget);
    const tProtections: string[] = [];
    if (tSummary.isInvincible) tProtections.push('✨ Invincible');
    else if (tSummary.isEvading) tProtections.push(`💨 Evade (${tSummary.evadeHits || 1}H)`);
    if (tSummary.gutsCount > 0) tProtections.push(`🩸 Guts x${tSummary.gutsCount}`);
    const tProtText = tProtections.length > 0 ? ` • [${tProtections.join(', ')}]` : '';
    targetSection = `\n🎯 **Target Locked:** **${tName}** (Master: <@${selectedTarget.userId}> • HP: **${Math.round(selectedTarget.currentHp).toLocaleString()} / ${selectedTarget.maxHp.toLocaleString()}**${tProtText})\n`;
  }

  const slotDisplay = `${targetSection}🎴 **Dealt Command Hand (${sClass} Deck • Turn ${cycleTurn}/3):**\n${handDisplay}\n\n🛡️ **Active Class Passives (Max 2):** ${passivesText}${lockedNote}\n\n⚔️ **Selected Chain (${pendingCards.length}/3):**\n\`[ 1: ${c1Text} ]\` ➔ \`[ 2: ${c2Text} ]\` ➔ \`[ 3: ${c3Text} ]\`${leadHelp}`;

  const combatantName = activeCombatant.servant.nickname || activeCombatant.servant.template?.name || 'Servant';
  const embed = new EmbedBuilder()
    .setTitle(`⚔️ HOLY GRAIL WAR DUEL — ROUND ${round}`)
    .setImage('attachment://turn_summary.png')
    .setDescription(
      `👉 **Current Turn:** ${activeCombatant.isAi ? `🤖 Shadow AI (${combatantName}) is calculating...` : `<@${activeCombatant.userId}> (**${combatantName}**), pick **3 Cards** from your dealt hand:`}\n\n${slotDisplay}`
    )
    .setColor(isSoloRogue ? 0xf59e0b : isP1Team ? 0xef4444 : 0x38bdf8);

  const team1List = [p1, p1Ally].filter((c): c is DuelCombatant => !!c);
  const team2List = [p2, p2Ally].filter((c): c is DuelCombatant => !!c);

  if (p1Ally || p2Ally || teamSoloList.length > 0) {
    const formatStatus = (c: DuelCombatant) => {
      if (c.isFled) return '🏃 Fled';
      if (c.currentHp <= 0) return '💀 Fallen';
      return `${Math.round(c.currentHp).toLocaleString()} HP`;
    };

    const team1Str = team1List.map(c => `• <@${c.userId}> (**${c.servant.nickname || c.servant.template?.name || 'Servant'}** • ${formatStatus(c)})`).join('\n');
    const team2Str = team2List.map(c => `• <@${c.userId}> (**${c.servant.nickname || c.servant.template?.name || 'Servant'}** • ${formatStatus(c)})`).join('\n');
    const fields = [
      { name: '🛡️ Team 1', value: team1Str || 'None', inline: true },
      { name: '⚔️ Team 2', value: team2Str || 'None', inline: true }
    ];
    if (teamSoloList.length > 0) {
      const soloStr = teamSoloList.map(c => `• <@${c.userId}> (**${c.servant.nickname || c.servant.template?.name || 'Servant'}** • ${formatStatus(c)})`).join('\n');
      fields.push({ name: '⚡ Solo Rogue (3rd Master)', value: soloStr, inline: true });
    }
    embed.addFields(fields);
  }

  if (lastLogs && lastLogs.length > 0) {
    const recent = lastLogs.slice(-2).join('\n\n');
    embed.addFields({
      name: '📜 Battle Log',
      value: recent.length > 1000 ? recent.slice(0, 1000) + '...' : recent
    });
  }

  return embed;
}

export interface DetailedDuelAction {
  round: number;
  actorName: string;
  targetName?: string;
  actionType: 'skill' | 'attack' | 'seal' | 'assist' | 'flee' | 'system';
  title: string;
  details: string;
  timestamp: Date;
}

function formatCombatLogEntryDetails(entry: DetailedDuelAction): string {
  if (!entry.details) return '• *No detailed action telemetry recorded.*';

  let raw = entry.details;

  // Convert pipes to line breaks if present
  if (raw.includes('|')) {
    raw = raw.split('|').map(s => s.trim()).filter(Boolean).join('\n');
  }

  // Strip redundant execution headers
  raw = raw
    .replace(/^[^\n:]*executed sequence [^:\n]*[:!]\s*/i, '')
    .replace(/^[^\n:]*activated [^!\n]*!\s*/i, '')
    .replace(/^(⚔️|🎴|✨|🔴|🛡️)?\s*(\*\*[\w\s]+\*\*|[A-Za-z0-9\s_]+)\s*(executed|activated|invoked)\s*[^:\n]*[:!]?\s*/i, '')
    .trim();

  const rawLines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const formattedLines: string[] = [];

  for (let line of rawLines) {
    line = line.replace(/^[•*\-\s]+/, '').trim();
    if (!line) continue;

    if (line.startsWith('💬') || line.startsWith('“') || line.startsWith('"') || line.startsWith('*“')) {
      const cleanQuote = line.replace(/^[💬*“"\s]+/, '').replace(/["”*]+$/, '').trim();
      formattedLines.push(`💬 *“${cleanQuote}”*`);
    } else if (/dealt|took|dmg/i.test(line)) {
      formattedLines.push(`💥 **${line}**`);
    } else if (/gained|np|critical stars|stars/i.test(line)) {
      formattedLines.push(`⚡ **${line}**`);
    } else if (/chain/i.test(line)) {
      formattedLines.push(`⛓️ **${line}**`);
    } else if (/revived|continuation|guts/i.test(line)) {
      formattedLines.push(`✝️ **${line}**`);
    } else if (/stun/i.test(line)) {
      formattedLines.push(`💫 **${line}**`);
    } else {
      formattedLines.push(`• ${line}`);
    }
  }

  if (formattedLines.length === 0) {
    return `• ${entry.details}`;
  }

  return formattedLines.join('\n');
}

function buildDetailedCombatLogEmbed(
  p1: DuelCombatant,
  p2: DuelCombatant,
  round: number,
  activeUserId: string,
  history: DetailedDuelAction[],
  p1Ally?: DuelCombatant,
  p2Ally?: DuelCombatant,
  teamSoloList: DuelCombatant[] = [],
  requestedPage: number = -1
): { embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[] } {
  const PAGE_SIZE = 4;
  const totalEntries = history.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));

  let page = requestedPage;
  if (page === -1 || page >= totalPages) {
    page = totalPages - 1; // Default to latest page so user sees recent actions
  }
  page = Math.max(0, Math.min(totalPages - 1, page));

  const startIdx = page * PAGE_SIZE;
  const pageEntries = history.slice(startIdx, startIdx + PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setTitle(`📜 HOLY GRAIL WAR — COMBAT DOSSIER & BATTLE LOG`)
    .setColor(0x38bdf8)
    .setDescription(
      `⚔️ **Current Battle State:** Round **${round}** • Turn Active: <@${activeUserId}>\n` +
      `📊 **Total Actions Recorded:** **${history.length}** tactical event(s) • **Page ${page + 1} of ${totalPages}**\n` +
      `──────────────────────────────────────────────`
    );

  if (pageEntries.length > 0) {
    for (let idx = 0; idx < pageEntries.length; idx++) {
      const entry = pageEntries[idx];
      const globalNum = startIdx + idx + 1;
      const targetStr = entry.targetName ? ` ➔ **${entry.targetName}**` : '';
      const formattedDetails = formatCombatLogEntryDetails(entry);

      const fieldTitle = `#${globalNum} [R${entry.round}] ${entry.title}`;
      const fieldValue =
        `• **Actor:** **${entry.actorName}**${targetStr}\n` +
        `${formattedDetails}`;

      embed.addFields({
        name: fieldTitle.slice(0, 256),
        value: fieldValue.slice(0, 1024)
      });
    }
  } else {
    embed.addFields({
      name: '🏆 Turn-by-Turn Combat Chronicle',
      value: '• *No combat actions recorded in history yet.*'
    });
  }

  // Combatant Health & Gauge Overview
  const allLiving = [p1, p2, p1Ally, p2Ally, ...teamSoloList].filter((c): c is DuelCombatant => !!c);
  const statusOverview = allLiving.map(c => {
    const sName = c.servant.nickname || c.servant.template?.name || 'Servant';
    const hpPct = Math.max(0, Math.min(100, Math.round((c.currentHp / c.maxHp) * 100)));
    const hpBar = '█'.repeat(Math.round(hpPct / 10)) + '░'.repeat(10 - Math.round(hpPct / 10));
    const npType = c.servant.template?.noblePhantasm?.cardType || 'Buster';
    const seals = c.commandSeals !== undefined ? `${c.commandSeals} Seal(s)` : 'N/A';
    const buffCount = c.activeBuffs ? c.activeBuffs.length : 0;
    
    // Skill cooldown status
    const skills = c.servant.template?.skills || [];
    const skillStatus = skills.map((s, idx) => {
      const cd = c.skillCooldowns[idx] || 0;
      return cd > 0 ? `\`${s.name} (${cd}T)\`` : `\`${s.name} (Ready)\``;
    }).join(' • ');

    return `**${sName}** (<@${c.userId}>)\n` +
           `• **HP:** \`[${hpBar}]\` ${Math.round(c.currentHp).toLocaleString()} / ${c.maxHp.toLocaleString()} (${hpPct}%)\n` +
           `• **NP:** **${Math.round(c.npGauge)}%** [${npType}] | **Seals:** ${seals} | **Buffs:** ${buffCount} active\n` +
           `• **Skills:** ${skillStatus || 'None'}`;
  }).join('\n\n');

  embed.addFields({
    name: '📊 Combatants Status & Tactical Skills',
    value: statusOverview.slice(0, 1024)
  });

  embed.setFooter({ text: `Holy Grail War Tactical Telemetry • Page ${page + 1}/${totalPages} • Real-Time Combat Log Archive` });

  const components: ActionRowBuilder<ButtonBuilder>[] = [];
  if (totalPages > 1 || history.length > 0) {
    const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`combat_log_page_${Math.max(0, page - 1)}`)
        .setLabel('◀ Prev Actions')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 0),
      new ButtonBuilder()
        .setCustomId('combat_log_page_indicator')
        .setLabel(`Page ${page + 1} / ${totalPages}`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`combat_log_page_${Math.min(totalPages - 1, page + 1)}`)
        .setLabel('Next Actions ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1),
      new ButtonBuilder()
        .setCustomId(`combat_log_page_${page}`)
        .setLabel('🔄 Refresh')
        .setStyle(ButtonStyle.Success)
    );
    components.push(navRow);
  }

  return { embed, components };
}

// ==========================================
// 7. INTERACTIVE ACTION BUTTON BUILDER
// ==========================================
function buildCombatButtons(
  combatant: DuelCombatant,
  pendingCards: ('Buster' | 'Arts' | 'Quick' | 'NP')[] = [],
  pendingIndices: number[] = [],
  livingOpponents: DuelCombatant[] = [],
  selectedTargetId?: string,
  hasAlly: boolean = false,
  allianceAssistAvailable: boolean = false,
  forceJoinAvailable: boolean = false
) {
  if (!combatant.currentHand || combatant.currentHand.length !== 5) {
    refreshCombatantHand(combatant);
  }

  const hand = (combatant.currentHand && combatant.currentHand.length >= 5 ? combatant.currentHand : refreshCombatantHand(combatant)).slice(0, 5);
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

  // Row 2: Noble Phantasm + Clear + Command Seal + Run / Flee
  const hasSeals = (combatant.commandSeals || 0) > 0;
  const npType = combatant.servant.template?.noblePhantasm?.cardType || 'Buster';
  const sClass = combatant.servant.template?.servantClass || 'Saber';
  const agility = combatant.servant.template?.baseStats?.agility || combatant.servant.allocatedStats?.agility || 10;
  const fleeCalc = calculateFleeChance(combatant.currentHp, combatant.maxHp, sClass, agility);

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
      .setDisabled(!hasSeals),
    new ButtonBuilder()
      .setCustomId('card_flee')
      .setLabel(`Run (${fleeCalc.chancePercent}%)`)
      .setEmoji('🏃')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('card_inspect_buffs')
      .setLabel('Status')
      .setEmoji('📊')
      .setStyle(ButtonStyle.Secondary)
  );

  // Row 3: 3 Active Skill Sets
  const row3 = new ActionRowBuilder<ButtonBuilder>();
  const isSkillSealed = Boolean(combatant.activeBuffs && combatant.activeBuffs.some(b => b.type === 'skill_seal'));

  // Skill 1 (Unlocked by default)
  const s1 = skills[0];
  const cd1 = combatant.skillCooldowns[0] || 0;
  const s1Name = s1 ? s1.name.slice(0, 13) : 'Skill 1';
  row3.addComponents(
    new ButtonBuilder()
      .setCustomId('skill_0')
      .setLabel(isSkillSealed ? `🚫 S1: Sealed` : cd1 > 0 ? `S1: ${s1Name} (${cd1}T)` : `✨ S1: ${s1Name}`)
      .setStyle(isSkillSealed || cd1 > 0 ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(isSkillSealed || cd1 > 0 || !s1)
  );

  // Skill 2 (Unlocked by default)
  const s2 = skills[1];
  const cd2 = combatant.skillCooldowns[1] || 0;
  const s2Name = s2 ? s2.name.slice(0, 13) : 'Skill 2';
  row3.addComponents(
    new ButtonBuilder()
      .setCustomId('skill_1')
      .setLabel(isSkillSealed ? `🚫 S2: Sealed` : cd2 > 0 ? `S2: ${s2Name} (${cd2}T)` : `🛡️ S2: ${s2Name}`)
      .setStyle(isSkillSealed || cd2 > 0 ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(isSkillSealed || cd2 > 0 || !s2)
  );

  // Skill 3 (Unlocked at Bond Level 5)
  const s3 = skills[2];
  const cd3 = combatant.skillCooldowns[2] || 0;
  // Row 3: 3 Active Skill Sets + Combat Log Button
  const isS3Unlocked = bondLevel >= 5;
  const s3Name = s3 ? s3.name.slice(0, 13) : 'Skill 3';
  row3.addComponents(
    new ButtonBuilder()
      .setCustomId('skill_2')
      .setLabel(!isS3Unlocked ? '🔒 S3 (Bond Lv 5)' : isSkillSealed ? `🚫 S3: Sealed` : cd3 > 0 ? `S3: ${s3Name} (${cd3}T)` : `🌟 S3: ${s3Name}`)
      .setStyle(!isS3Unlocked || isSkillSealed || cd3 > 0 ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(!isS3Unlocked || isSkillSealed || cd3 > 0 || !s3)
  );

  row3.addComponents(
    new ButtonBuilder()
      .setCustomId('card_combat_log')
      .setLabel('Combat Log')
      .setEmoji('📜')
      .setStyle(ButtonStyle.Secondary)
  );

  const actionRows: ActionRowBuilder<ButtonBuilder>[] = [row1, row2, row3];

  const utilityRow = new ActionRowBuilder<ButtonBuilder>();
  if (hasAlly) {
    utilityRow.addComponents(
      new ButtonBuilder()
        .setCustomId('card_alliance_assist')
        .setLabel(
          !allianceAssistAvailable
            ? 'Assist (Used)'
            : 'Tag Assist (+25% ATK)'
        )
        .setEmoji('🛡️')
        .setStyle(!allianceAssistAvailable ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(!allianceAssistAvailable)
    );
  }

  if (forceJoinAvailable) {
    utilityRow.addComponents(
      new ButtonBuilder()
        .setCustomId('card_forcejoin')
        .setLabel('Force Join Arena')
        .setEmoji('⚡')
        .setStyle(ButtonStyle.Danger)
    );
  }

  if (utilityRow.components.length > 0) {
    actionRows.push(utilityRow);
  }

  // Optional Row 4: Target Selection (when multiple opponents are alive in battle)
  if (livingOpponents.length > 1) {
    const targetRow = new ActionRowBuilder<ButtonBuilder>();
    livingOpponents.forEach((opp, oppIdx) => {
      const targetKey = opp.userId || opp.servant?.id || `opp_${oppIdx}`;
      const isTarget = selectedTargetId === targetKey || selectedTargetId === opp.userId;
      const oppServantName = opp.servant.nickname || opp.servant.template?.name || 'Foe';
      const label = isTarget
        ? `🎯 [TARGET] ${oppServantName} (${Math.round(opp.currentHp)})`
        : `Target: ${oppServantName} (${Math.round(opp.currentHp)})`;

      targetRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`target_${targetKey}_idx${oppIdx}`)
          .setLabel(label.slice(0, 80))
          .setStyle(isTarget ? ButtonStyle.Success : ButtonStyle.Secondary)
      );
    });
    actionRows.push(targetRow);
  }

  return actionRows;
}

// Helper to activate a combatant skill without spending a turn
function activateCombatantSkill(
  combatant: DuelCombatant,
  skillIdx: number,
  opponent?: DuelCombatant,
  currentRound: number = 1,
  livingAllies?: DuelCombatant[],
  livingEnemies?: DuelCombatant[]
): {
  success: boolean;
  log: string;
  quote?: string;
  skillName?: string;
  skillType?: string;
  skillDescription?: string;
  isTransformation?: boolean;
  transformationGif?: string;
  transformationAvatarUrl?: string;
} {
  const bondLevel = combatant.servant.bondLevel || 1;
  const isSkillSealed = Boolean(combatant.activeBuffs && combatant.activeBuffs.some(b => b.type === 'skill_seal'));
  if (isSkillSealed) {
    return {
      success: false,
      log: `🚫 **Skills Sealed!** **${combatant.servant.nickname || combatant.servant.template.name}** is under the effect of [Skill Seal] and cannot activate skills!`
    };
  }

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
  const sName = combatant.servant.nickname || combatant.servant.template.name;
  const customSkillQuote = combatant.servant.customQuotes?.skill;
  const skillQuote = customSkillQuote || getServantSkillQuote(combatant.servant.template, skillIdx, skill);
  const quoteLine = `\n> 💬 ❝ ***${skillQuote}*** ❞`;
  let logText = `✨ **${sName}** activated **${skill.name}**!${quoteLine}`;

  // Check for transformation skill (e.g. Aoko's Fifth Magic: Red Hair Ignition)
  const isTransformation = Boolean(
    (skill as any).transformationAvatarUrl ||
    skill.id === 'fifth_magic_red_hair' ||
    (skill.name && skill.name.toLowerCase().includes('red hair ignition'))
  );

  let transformationGif: string | undefined;
  if (isTransformation) {
    combatant.isTransformed = true;
    combatant.transformationTurns = skill.duration || 3;
    if (!combatant.baseAvatarUrl) {
      const artInfo = getServantAvatarAndCardArt(combatant.servant);
      combatant.baseAvatarUrl = artInfo.cardArtUrl || artInfo.avatarUrl;
    }
    const transformedAvatar = (skill as any).transformationAvatarUrl || 'https://ella.janitorai.com/media-approved/zUtP5PQLU7fMKVyin9H-f.webp';
    combatant.avatarUrl = transformedAvatar;
    transformationGif = (skill as any).transformationGifUrl || 'https://ella.janitorai.com/media-approved/gR8x0bMk-pHc95lo5mhAL.gif';

    combatant.activeBuffs.push({
      name: 'Super Aoko (ATK Up)',
      type: 'buff_atk',
      value: skill.value || 30,
      remainingTurns: skill.duration || 3
    });
    combatant.activeBuffs.push({
      name: 'Super Aoko (Crit DMG Up)',
      type: 'crit_dmg',
      value: 40,
      remainingTurns: skill.duration || 3
    });
    combatant.critStars = Math.min(50, (combatant.critStars || 0) + 15);
    logText = `🔴 **TRANSFORMATION AWAKENED!** **${sName}** ignited **${skill.name}** and entered **Super Aoko** form!${quoteLine}`;
  } else if (skill.id === 'charisma_of_hope' || /charisma of hope/i.test(skill.name)) {
    combatant.activeBuffs.push({
      name: `${skill.name} (ATK Up)`,
      type: 'buff_atk',
      value: 20,
      remainingTurns: 3
    });
    combatant.npGauge = Math.min(300, combatant.npGauge + 30);
    combatant.critStars = Math.min(50, (combatant.critStars || 0) + 10);
    logText = `👑 **${sName}** activated **${skill.name}**! (+20% ATK & +30% NP Gauge for 3T, +10 Stars)${quoteLine}`;
  } else if (skill.id === 'avalon_le_fae' || /avalon le fae/i.test(skill.name)) {
    combatant.npGauge = Math.min(300, combatant.npGauge + 20);
    combatant.activeBuffs.push({
      name: `${skill.name} (NP Gain Up)`,
      type: 'np_gain',
      value: 30,
      remainingTurns: 3
    });
    logText = `✨ **${sName}** activated **${skill.name}**! (+20% NP Gauge & +30% NP Gain Rate for 3T)${quoteLine}`;
  } else if (skill.id === 'holy_sword_creation' || /holy sword creation/i.test(skill.name)) {
    combatant.activeBuffs.push({
      name: `${skill.name} (Arts Up)`,
      type: 'arts_up',
      value: 50,
      remainingTurns: 3
    });
    combatant.activeBuffs.push({
      name: `${skill.name} (Anti-Threat)`,
      type: 'anti_threat',
      value: 50,
      remainingTurns: 3
    });
    combatant.activeBuffs.push({
      name: `${skill.name} (Invincible)`,
      type: 'invincible',
      value: 100,
      remainingTurns: 1
    });
    logText = `🗡️ **${sName}** activated **${skill.name}**! (+50% Arts Up, +50% Anti-Threat Special ATK & 1T Invincibility)${quoteLine}`;
  } else if (skill.id === 'infinite_wellspring_a') {
    combatant.npGauge = Math.min(300, combatant.npGauge + 30);
    combatant.activeBuffs.push({
      name: 'Infinite Wellspring (NP Gain Up)',
      type: 'np_gain',
      value: 20,
      remainingTurns: 3
    });
    combatant.currentHp = Math.min(combatant.maxHp, combatant.currentHp + 1000);
    combatant.activeBuffs.push({
      name: 'Infinite Wellspring (HP Regen)',
      type: 'hp_regen',
      value: 1000,
      remainingTurns: 3
    });
    logText = `💧 **${sName}** activated **${skill.name}**! (+30% NP Gauge, +20% NP Gain (3T), +1,000 HP Regen/turn (3T))${quoteLine}`;
  } else if (skill.id === 'concept_nullification_impact_space_a') {
    combatant.activeBuffs.push({
      name: 'Concept Nullification (Invincible)',
      type: 'invincible',
      value: 100,
      remainingTurns: 1
    });
    combatant.activeBuffs.push({
      name: 'Concept Nullification (Ignore Invincible)',
      type: 'ignore_invincible',
      value: 100,
      remainingTurns: 1
    });
    logText = `🛡️ **${sName}** activated **${skill.name}**! (Gained **Invincibility (1T)** & **Ignore Invincible (1T)**)${quoteLine}`;
  } else if (skill.id === 'nullify_the_law_of_magic_ex') {
    let strippedCount = 0;
    if (opponent && opponent.activeBuffs) {
      const initialLen = opponent.activeBuffs.length;
      opponent.activeBuffs = opponent.activeBuffs.filter(b => 
        b.type !== 'buff_atk' &&
        b.type !== 'crit_dmg' &&
        b.type !== 'buster_up' &&
        b.type !== 'arts_up' &&
        b.type !== 'quick_up' &&
        b.type !== 'ignore_invincible' &&
        !/atk|crit|power|damage|buster|arts|quick|strength/i.test(b.name)
      );
      strippedCount = initialLen - opponent.activeBuffs.length;
      opponent.activeBuffs.push({
        name: 'Law of Magic (Skill Seal)',
        type: 'skill_seal',
        value: 100,
        remainingTurns: 1
      });
    }
    combatant.activeBuffs.push({
      name: 'Law of Magic (Arts Up)',
      type: 'arts_up',
      value: 20,
      remainingTurns: 3
    });
    logText = `👑 **${sName}** activated **${skill.name}**! (Stripped ${strippedCount} offensive buffs, inflicted **Skill Seal (1T)** on enemy, +20% Arts Up for 3T)${quoteLine}`;
  } else if (skill.id === 'fortress_stance_terra_barrier_a' || skill.name.toLowerCase().includes('fortress stance')) {
    combatant.activeBuffs.push({
      name: 'Fortress Stance (DEF Up)',
      type: 'buff_def',
      value: 30,
      remainingTurns: 3
    });
    combatant.activeBuffs.push({
      name: 'Terra Barrier (Damage Cut)',
      type: 'damage_cut',
      value: 1500,
      remainingTurns: 3
    });
    combatant.activeBuffs.push({
      name: 'Fortress Stance (Target Focus)',
      type: 'target_focus',
      value: 100,
      remainingTurns: 1
    });
    logText = `🛡️ **${sName}** activated **${skill.name}**! (+30% DEF (3T), 1,500 Damage Cut (3T), Target Focus (1T))${quoteLine}`;
  } else if (skill.id === 'guardians_instinct_red_scarf_b' || skill.name.toLowerCase().includes("guardian's instinct") || skill.name.toLowerCase().includes("red scarf")) {
    const alliesTeam: DuelCombatant[] = [combatant];
    alliesTeam.forEach((ally: DuelCombatant) => {
      if (ally && ally.currentHp > 0) {
        ally.activeBuffs = ally.activeBuffs || [];
        ally.activeBuffs.push({
          name: "Guardian's Instinct (ATK Up)",
          type: 'buff_atk',
          value: 15,
          remainingTurns: 3
        });
        ally.activeBuffs.push({
          name: 'Red Scarf Aegis (Invincible)',
          type: 'invincible',
          value: 100,
          remainingTurns: 1
        });
      }
    });
    combatant.npGauge = Math.min(300, combatant.npGauge + 20);
    logText = `🧣 **${sName}** activated **${skill.name}**! (+15% ATK & Invincibility (1T) to ALL allies, +20% NP Gauge to self!)${quoteLine}`;
  } else if (skill.id === 'earth_wrought_heart_ex' || skill.name.toLowerCase().includes('earth-wrought heart')) {
    combatant.activeBuffs.push({
      name: 'Earth-Wrought Heart (Buster Up)',
      type: 'buster_up',
      value: 30,
      remainingTurns: 3
    });
    combatant.activeBuffs.push({
      name: 'Tectonic Plate (Damage Cut)',
      type: 'damage_cut',
      value: 2000,
      remainingTurns: 1
    });
    combatant.activeBuffs.push({
      name: 'Earth-Wrought Heart (Debuff Immunity)',
      type: 'debuff_immunity',
      value: 100,
      remainingTurns: 1
    });
    combatant.activeBuffs = combatant.activeBuffs.filter(b => !b.type.startsWith('debuff') && b.type !== 'stun');
    logText = `⛰️ **${sName}** activated **${skill.name}**! (+30% Buster (3T), 2,000 Damage Cut (1T), Debuff Immunity (1T))${quoteLine}`;
  } else if (skill.id === 'strengthening_adaptation_a' || skill.name.toLowerCase().includes('strengthening adaptation')) {
    combatant.activeBuffs.push({
      name: `${skill.name} (Buster Up)`,
      type: 'buster_up',
      value: 30,
      remainingTurns: 3
    });
    combatant.activeBuffs.push({
      name: `${skill.name} (Arts Up)`,
      type: 'arts_up',
      value: 30,
      remainingTurns: 3
    });
    combatant.activeBuffs.push({
      name: `${skill.name} (Damage Cut)`,
      type: 'damage_cut',
      value: 1000,
      remainingTurns: 1
    });
    combatant.activeBuffs.push({
      name: `${skill.name} (Debuff Immunity)`,
      type: 'debuff_immunity',
      value: 100,
      remainingTurns: 1
    });
    combatant.activeBuffs = combatant.activeBuffs.filter(b => !b.type.startsWith('debuff') && b.type !== 'stun');
    logText = `🛡️ **${sName}** activated **${skill.name}**! (+30% Buster & Arts (3T), 1,000 Damage Cut (1T), Debuff Immunity (1T))${quoteLine}`;
  } else if (skill.id === 'calamity_breaker_edict_ex' || skill.name.toLowerCase().includes('calamity-breaker') || skill.name.toLowerCase().includes('calamity breaker')) {
    combatant.activeBuffs.push({
      name: `${skill.name} (ATK Up)`,
      type: 'buff_atk',
      value: 20,
      remainingTurns: 3
    });
    combatant.activeBuffs.push({
      name: `${skill.name} (Anti-Calamity Special Attack)`,
      type: 'special_damage_up' as any,
      value: 30,
      remainingTurns: 3
    });
    logText = `👑 **${sName}** activated **${skill.name}**! (+20% Party ATK (3T), +30% Special ATK vs Threat/Foreigner/Beast/Calamity (3T))${quoteLine}`;
  } else if (skill.id === 'blaze_of_etna' || /blaze of etna|armor of ashen/i.test(skill.name)) {
    // S1: Blaze of Etna - Dragon Prison Manifestation: Armor of Ashen Flames C
    combatant.activeBuffs.push({
      name: 'Blaze of Etna (Invincible)',
      type: 'invincible',
      value: 100,
      remainingTurns: 1
    });
    combatant.activeBuffs.push({
      name: 'Blaze of Etna (ATK Up)',
      type: 'buff_atk',
      value: 20,
      remainingTurns: 3
    });
    combatant.activeBuffs.push({
      name: 'Blaze of Etna (Buster Up)',
      type: 'buster_up',
      value: 30,
      remainingTurns: 3
    });
    logText = `🔥 **${sName}** activated **${skill.name}**! (Invincibility (1T), +20% ATK (3T), +30% Buster Up (3T))${quoteLine}`;
  } else if (skill.id === 'black_wings_a' || /black wings/i.test(skill.name)) {
    // S2: Black Wings A
    combatant.activeBuffs.push({
      name: 'Black Wings (Overcharge +2)',
      type: 'overcharge_up',
      value: 2,
      remainingTurns: 3,
      remainingHits: 1,
      isHitCount: true
    });
    // Reduce other skill cooldowns by 1
    combatant.skillCooldowns = combatant.skillCooldowns || {};
    for (const k of Object.keys(combatant.skillCooldowns)) {
      const idx = parseInt(k, 10);
      if (idx !== skillIdx && combatant.skillCooldowns[idx] > 0) {
        combatant.skillCooldowns[idx]--;
      }
    }
    combatant.activeBuffs.push({
      name: 'Black Wings (Crit DMG Up)',
      type: 'crit_dmg',
      value: 30,
      remainingTurns: 3
    });
    combatant.critStars = Math.min(50, (combatant.critStars || 0) + 15);
    logText = `🪶 **${sName}** activated **${skill.name}**! (NP Overcharge +2 stages (1 time/3T), Cooldowns -1, +30% Crit DMG (3T), +15 Stars)${quoteLine}`;
  } else if (skill.id === 'let_this_become_a_prayer_ex' || /let this become a prayer/i.test(skill.name)) {
    // S3: Let This Become a Prayer EX
    combatant.npGauge = Math.min(300, combatant.npGauge + 50);
    combatant.activeBuffs.push({
      name: 'Let This Become a Prayer (ATK Up)',
      type: 'buff_atk',
      value: 20,
      remainingTurns: 3
    });
    combatant.activeBuffs.push({
      name: 'Ephemeral Curse [Demerit]',
      type: 'curse',
      value: 500,
      remainingTurns: 3
    });
    logText = `🍷 **${sName}** activated **${skill.name}**! (+50% NP Gauge, +20% ATK (3T), [Demerit] Inflicted Curse 500 dmg/turn (3T) to self)${quoteLine}`;
  } else if (skill.id === 'void_space_fine_arts' || /void space fine arts/i.test(skill.name)) {
    // Van Gogh S1: Void Space Fine Arts B+
    // Grants self Guts status for 1 time, 5 turns (revives with 3,000 HP).
    // Inflicts 3 stacks of Curse with 100 damage for 10 turns to self [Demerit].
    // Charges own NP gauge by 10% per Curse stack on self.
    const isHeracles = combatant.servant.templateId === 'heracles_berserker' ||
                       combatant.servant.templateId === 'heracles' ||
                       /heracles|herakles/i.test(combatant.servant.template?.name || combatant.servant.nickname || '');
    const hasActiveGuts = combatant.activeBuffs.some((b: any) => b.type === 'guts' && (b.remainingTurns === undefined || b.remainingTurns > 0)) || ((combatant.gutsCount || 0) > 0);
    let gutsGrantedText = '';
    if (isHeracles || !hasActiveGuts) {
      combatant.gutsCount = (combatant.gutsCount || 0) + 1;
      combatant.activeBuffs.unshift({
        name: 'Void Space Fine Arts (Guts)',
        type: 'guts',
        value: 3000,
        remainingTurns: 5,
        remainingHits: 1,
        isHitCount: true,
        appliedRound: currentRound,
        appliedTurnUserId: combatant.userId
      });
      gutsGrantedText = 'Guts 3,000 HP (5T)';
    } else {
      gutsGrantedText = '[Guts Already Active - Does not stack]';
    }
    for (let k = 0; k < 3; k++) {
      combatant.activeBuffs.push({
        name: `Void Curse Stack ${k + 1} [Demerit]`,
        type: 'curse',
        value: 100,
        remainingTurns: 10,
        appliedRound: currentRound,
        appliedTurnUserId: combatant.userId
      });
    }
    const curCurses = combatant.activeBuffs.filter(b => b.type === 'curse').length;
    const npGain = curCurses * 10;
    combatant.npGauge = Math.min(300, (combatant.npGauge || 0) + npGain);
    logText = `🎨 **${sName}** activated **${skill.name}**! (${gutsGrantedText}, +3 Curse Stacks [Demerit], ⚡ +${npGain}% NP Gauge from ${curCurses} active Curses!)${quoteLine}`;
  } else if (skill.id === 'het_gele_huis' || /het gele huis|the yellow house/i.test(skill.name)) {
    // Van Gogh S2: Het Gele Huis: The Yellow House A+
    // Reduces all enemies' defense by 20% for 3 turns. Reduces their Quick resistance by 20% for 3 turns.
    // Grants party Evasion for 1 hit (3 turns). Recovers party's HP by 3,000 every turn for 5 turns.
    // Inflicts Curse with 100 damage for 10 turns to party [Demerit].
    const targetEnemies = (livingEnemies && livingEnemies.length > 0) ? livingEnemies.filter(e => e.currentHp > 0) : (opponent ? [opponent] : []);
    const targetAllies = (livingAllies && livingAllies.length > 0) ? livingAllies.filter(a => a.currentHp > 0) : [combatant];

    targetEnemies.forEach(opp => {
      opp.activeBuffs = opp.activeBuffs || [];
      opp.activeBuffs.push({
        name: 'Het Gele Huis (DEF Down)',
        type: 'debuff_def',
        value: 20,
        remainingTurns: 3,
        appliedRound: currentRound,
        appliedTurnUserId: combatant.userId
      });
      opp.activeBuffs.push({
        name: 'Het Gele Huis (Quick Res Down)',
        type: 'quick_res_down',
        value: 20,
        remainingTurns: 3,
        appliedRound: currentRound,
        appliedTurnUserId: combatant.userId
      });
    });

    targetAllies.forEach(ally => {
      ally.activeBuffs = ally.activeBuffs || [];
      ally.activeBuffs.push({
        name: 'The Yellow House (Evasion)',
        type: 'evade',
        value: 100,
        remainingTurns: 3,
        remainingHits: 1,
        isHitCount: true,
        appliedRound: currentRound,
        appliedTurnUserId: combatant.userId
      });
      ally.activeBuffs.push({
        name: 'The Yellow House (HP Regen)',
        type: 'hp_regen',
        value: 3000,
        remainingTurns: 5,
        appliedRound: currentRound,
        appliedTurnUserId: combatant.userId
      });
      ally.activeBuffs.push({
        name: 'Sunflower Curse [Demerit]',
        type: 'curse',
        value: 100,
        remainingTurns: 10,
        appliedRound: currentRound,
        appliedTurnUserId: combatant.userId
      });
    });

    logText = `🌻 **${sName}** activated **${skill.name}**! (-20% DEF & -20% Quick Res to enemies [3T], 1-Hit Evade [3T] & +3,000 HP Regen/turn [5T] to party, +1 Curse Stack [Demerit])${quoteLine}`;
  } else if (skill.id === 'soul_of_water_channels' || /soul of water channels/i.test(skill.name)) {
    // Van Gogh S3: Soul of Water Channels EX
    // Increases ally's attack by 30% for 3 turns. Increases party critical star gain by 200% for 3 turns.
    // Grants self Buff-On-Attack for 3 turns (Removes 1 Curse on Quick attack, grants +10% ATK for 3 turns).
    // Absorbs all enemies' and party's Curses to self [Demerit].
    const targetAllies = (livingAllies && livingAllies.length > 0) ? livingAllies.filter(a => a.currentHp > 0) : [combatant];
    const targetEnemies = (livingEnemies && livingEnemies.length > 0) ? livingEnemies.filter(e => e.currentHp > 0) : (opponent ? [opponent] : []);

    combatant.activeBuffs.push({
      name: 'Soul of Water Channels (ATK Up)',
      type: 'buff_atk',
      value: 30,
      remainingTurns: 3,
      appliedRound: currentRound,
      appliedTurnUserId: combatant.userId
    });

    targetAllies.forEach(ally => {
      ally.activeBuffs = ally.activeBuffs || [];
      ally.activeBuffs.push({
        name: 'Soul of Water Channels (Star Gain +200%)',
        type: 'star_gain_up',
        value: 200,
        remainingTurns: 3,
        appliedRound: currentRound,
        appliedTurnUserId: combatant.userId
      });
    });

    combatant.activeBuffs.push({
      name: 'Soul of Water Channels (Quick Curse Cleanse)',
      type: 'buff_on_quick_curse_cleanse',
      value: 10,
      remainingTurns: 3,
      appliedRound: currentRound,
      appliedTurnUserId: combatant.userId
    });

    let absorbedCurses = 0;
    targetAllies.forEach(ally => {
      if (ally !== combatant && ally.activeBuffs) {
        const allyCurses = ally.activeBuffs.filter(b => b.type === 'curse');
        absorbedCurses += allyCurses.length;
        ally.activeBuffs = ally.activeBuffs.filter(b => b.type !== 'curse');
        allyCurses.forEach(c => {
          combatant.activeBuffs.push({
            name: `Absorbed ${c.name}`,
            type: 'curse',
            value: c.value,
            remainingTurns: c.remainingTurns,
            appliedRound: currentRound,
            appliedTurnUserId: combatant.userId
          });
        });
      }
    });

    targetEnemies.forEach(opp => {
      if (opp.activeBuffs) {
        const oppCurses = opp.activeBuffs.filter(b => b.type === 'curse');
        absorbedCurses += oppCurses.length;
        opp.activeBuffs = opp.activeBuffs.filter(b => b.type !== 'curse');
        oppCurses.forEach(c => {
          combatant.activeBuffs.push({
            name: `Absorbed ${c.name}`,
            type: 'curse',
            value: c.value,
            remainingTurns: c.remainingTurns,
            appliedRound: currentRound,
            appliedTurnUserId: combatant.userId
          });
        });
      }
    });

    logText = `💧 **${sName}** activated **${skill.name}**! (+30% ATK [3T], +200% Party Star Gain [3T], Quick Curse Cleanse Buff [3T], absorbed ${absorbedCurses} Curses to self!)${quoteLine}`;
  } else if (skill.id === 'mantra_boundless_sunlight_a' || /mantra: boundless sunlight|boundless sunlight/i.test(skill.name)) {
    // Tamamo no Mae S1: Mantra: Boundless Sunlight A
    // Reduces enemy's NP gauge by 30% in duels. Increases party's and self NP damage by 30% for 3 turns.
    if (opponent) {
      const oppPassives = opponent.passives || getUnlockedPassives(opponent.servant.template?.passives?.length ? opponent.servant.template.passives : opponent.servant.template?.servantClass, opponent.servant.bondLevel || 1);
      const debuffResist = oppPassives.filter(p => p.type === 'magic_resistance' || p.type === 'fifth_succession').reduce((s, p) => s + p.value, 0);
      const didResist = Math.random() * 100 < debuffResist;
      if (!didResist) {
        opponent.npGauge = Math.max(0, opponent.npGauge - 30);
      }
    }
    const alliesList = livingAllies && livingAllies.length > 0 ? livingAllies.filter(a => a.currentHp > 0) : [combatant];
    alliesList.forEach(a => {
      a.activeBuffs = a.activeBuffs || [];
      a.activeBuffs.push({
        name: `${skill.name} (NP DMG Up)`,
        type: 'np_damage_up',
        value: 30,
        remainingTurns: 3,
        appliedRound: currentRound,
        appliedTurnUserId: combatant.userId
      });
    });
    logText = `☀️ **${sName}** activated **${skill.name}**! (Drained -30% Enemy NP Gauge & granted +30% NP DMG to party for 3T!)${quoteLine}`;
  } else if (skill.id === 'shapeshift_a' || /shapeshift a/i.test(skill.name)) {
    // Tamamo no Mae S2: Shapeshift A
    // Increases own defense by 30% for 1 turn. Increases own defense by 30% for 3 turns.
    combatant.activeBuffs = combatant.activeBuffs || [];
    combatant.activeBuffs.push({
      name: `${skill.name} (DEF Up 1T)`,
      type: 'buff_def',
      value: 30,
      remainingTurns: 1,
      appliedRound: currentRound,
      appliedTurnUserId: combatant.userId
    });
    combatant.activeBuffs.push({
      name: `${skill.name} (DEF Up 3T)`,
      type: 'buff_def',
      value: 30,
      remainingTurns: 3,
      appliedRound: currentRound,
      appliedTurnUserId: combatant.userId
    });
    logText = `🦊 **${sName}** activated **${skill.name}**! (+60% DEF on Turn 1, +30% DEF for 3T)${quoteLine}`;
  } else if (skill.id === 'foxs_wedding_ex' || /fox's wedding/i.test(skill.name)) {
    // Tamamo no Mae S3: Fox's Wedding EX
    // Increases one ally's Arts performance by 50% for 3 turns. Recovers 3,000 of their HP.
    combatant.activeBuffs = combatant.activeBuffs || [];
    combatant.activeBuffs.push({
      name: `${skill.name} (Arts Up)`,
      type: 'arts_up',
      value: 50,
      remainingTurns: 3,
      appliedRound: currentRound,
      appliedTurnUserId: combatant.userId
    });
    const healAmount = 3000;
    combatant.currentHp = Math.min(combatant.maxHp, combatant.currentHp + healAmount);
    logText = `💍 **${sName}** activated **${skill.name}**! (+50% Arts Performance for 3T, recovered ${healAmount.toLocaleString()} HP!)${quoteLine}`;
  } else if (skill.effectType === 'buff_atk') {
    const val = skill.value || 35;
    const desc = (skill.description || '').toLowerCase();
    const nameLower = (skill.name || '').toLowerCase();
    let bonusText = `+${val}% ATK (${skill.duration || 2}T), +10 Stars`;
    if (desc.includes('buster') || nameLower.includes('buster') || nameLower.includes('mana burst')) {
      combatant.activeBuffs.push({ name: skill.name, type: 'buster_up', value: val, remainingTurns: skill.duration || 1 });
      bonusText = `+${val}% Buster (${skill.duration || 1}T)`;
    } else if (desc.includes('arts') || nameLower.includes('arts') || nameLower.includes('fox')) {
      combatant.activeBuffs.push({ name: skill.name, type: 'arts_up', value: val, remainingTurns: skill.duration || 1 });
      bonusText = `+${val}% Arts (${skill.duration || 1}T)`;
    } else if (desc.includes('quick') || nameLower.includes('quick') || nameLower.includes('primordial rune')) {
      combatant.activeBuffs.push({ name: skill.name, type: 'quick_up', value: val, remainingTurns: skill.duration || 1 });
      bonusText = `+${val}% Quick (${skill.duration || 1}T)`;
    } else {
      combatant.activeBuffs.push({ name: skill.name, type: 'buff_atk', value: val, remainingTurns: skill.duration || 2 });
      combatant.critStars = Math.min(50, combatant.critStars + 10);
    }
    logText = `⚔️ **${sName}** activated **${skill.name}**! (${bonusText})${quoteLine}`;
  } else if (skill.effectType === 'buff_def') {
    const val = skill.value || 30;
    const descLower = (skill.description || '').toLowerCase();
    const idLower = (skill.id || '').toLowerCase();
    combatant.activeBuffs.push({ name: skill.name, type: 'buff_def', value: val, remainingTurns: skill.duration || 2 });

    if (descLower.includes('invincible') || descLower.includes('invulnerability') || idLower === 'kekkai_creation') {
      const invDuration = descLower.includes('2 turns') || descLower.includes('2t') ? 2 : 1;
      combatant.activeBuffs.push({
        name: `${skill.name} (Invincible)`,
        type: 'invincible',
        value: 100,
        remainingTurns: invDuration
      });
    }
    if (descLower.includes('cleanse') || descLower.includes('debuff') || idLower === 'kekkai_creation') {
      combatant.activeBuffs = combatant.activeBuffs.filter(b => !b.type.startsWith('debuff'));
    }
    const bonusText = `+${val}% DEF (${skill.duration || 2}T)${descLower.includes('invincible') ? ', Invincible (1T)' : ''}`;
    logText = `🛡️ **${sName}** activated **${skill.name}**! (${bonusText})${quoteLine};`
  } else if (skill.effectType === 'evade' || skill.effectType === 'invincible') {
    const bType: 'evade' | 'invincible' = skill.effectType === 'invincible' ? 'invincible' : 'evade';
    const descLower = (skill.description || '').toLowerCase();
    const idLower = (skill.id || '').toLowerCase();
    const isSingleHit = descLower.includes('1 time') || descLower.includes('1 evade') || descLower.includes('1 hit') || idLower.includes('prescient_foresight');
    const isHitBased = skill.name.toLowerCase().includes('protection from arrows') || descLower.includes('attacks') || descLower.includes('hits') || isSingleHit;
    const hitCount = isSingleHit ? 1 : 3;
    const invDuration = descLower.includes('2 turns') || descLower.includes('2t')
      ? 2
      : (descLower.includes('1 turn') || descLower.includes('1t') || idLower === 'kekkai_creation' ? 1 : (skill.duration || 1));

    combatant.activeBuffs.push({
      name: skill.name,
      type: bType,
      value: 100,
      remainingTurns: isHitBased ? (skill.duration || 3) : invDuration,
      remainingHits: isHitBased ? hitCount : undefined,
      isHitCount: isHitBased
    });
    if (skill.id === 'wisdom_dun_scaith' || idLower.includes('prescient_foresight')) {
      combatant.critStars = Math.min(50, combatant.critStars + 15);
    }
    if (skill.id === 'ephemeral_dream_a' || (descLower.includes('attack') && !descLower.includes('attacks'))) {
      combatant.activeBuffs.push({
        name: `${skill.name} (ATK Up)`,
        type: 'buff_atk',
        value: skill.value || 40,
        remainingTurns: skill.duration || 1
      });
    }
    if (idLower.includes('prescient_foresight') || descLower.includes('critical damage') || descLower.includes('crit damage')) {
      combatant.activeBuffs.push({
        name: `${skill.name} (Crit DMG Up)`,
        type: 'crit_dmg',
        value: 30,
        remainingTurns: 3
      });
    }
    if (idLower === 'kekkai_creation' || descLower.includes('defense') || descLower.includes('increases def')) {
      combatant.activeBuffs.push({
        name: `${skill.name} (DEF Up)`,
        type: 'buff_def',
        value: skill.value || 30,
        remainingTurns: skill.duration || 3
      });
    }
    if (idLower === 'kekkai_creation' || descLower.includes('cleanse') || descLower.includes('debuff')) {
      combatant.activeBuffs = combatant.activeBuffs.filter(b => !b.type.startsWith('debuff'));
    }
    const bonusLabels: string[] = [];
    if (idLower === 'ephemeral_dream_a' || (descLower.includes('attack') && !descLower.includes('attacks'))) bonusLabels.push(`+${skill.value || 40}% ATK`);
    if (idLower === 'kekkai_creation' || descLower.includes('defense') || descLower.includes('increases def')) bonusLabels.push(`+${skill.value || 30}% DEF`);
    if (idLower.includes('prescient_foresight')) bonusLabels.push('1-Time Evade', '+30% Crit DMG');
    if (idLower === 'kekkai_creation' || descLower.includes('cleanse') || descLower.includes('debuff')) bonusLabels.push('Debuffs Cleansed');
    const bonusSummary = bonusLabels.length > 0 ? ` & ${bonusLabels.join(', ')}` : '';

    logText = bType === 'invincible'
      ? `🛡️ **${sName}** activated **${skill.name}** (Invincible${bonusSummary})!${quoteLine}`
      : `💨 **${sName}** activated **${skill.name}** (Evade${bonusSummary})!${quoteLine}`;
  } else if (skill.effectType === 'guts' || skill.id?.includes('guts') || skill.id?.includes('battle_continuation') || skill.id?.includes('thrice')) {
    const reviveAmt = skill.value || Math.round(combatant.maxHp * 0.20);
    const descLower = (skill.description || '').toLowerCase();
    const isHeracles = combatant.servant.templateId === 'heracles_berserker' ||
                       combatant.servant.templateId === 'heracles' ||
                       /heracles|herakles/i.test(combatant.servant.template?.name || combatant.servant.nickname || '');
    const hasActiveGuts = combatant.activeBuffs.some((b: any) => b.type === 'guts' && (b.remainingTurns === undefined || b.remainingTurns > 0)) || ((combatant.gutsCount || 0) > 0);
    let gutsSummaryTag = '';
    if (isHeracles || !hasActiveGuts) {
      combatant.gutsCount = (combatant.gutsCount || 0) + 1;
      combatant.activeBuffs.unshift({
        name: skill.name,
        type: 'guts',
        value: reviveAmt,
        remainingTurns: skill.duration || 5,
        appliedRound: currentRound
      });
      gutsSummaryTag = `Granted Guts [${reviveAmt.toLocaleString()} HP / ${skill.duration || 5}T]`;
    } else {
      gutsSummaryTag = `[Guts Already Active - Does not stack]`;
    }
    if (descLower.includes('invincible') || descLower.includes('invincibility')) {
      const invDur = descLower.includes('2 turns') || descLower.includes('2t') ? 2 : 1;
      combatant.activeBuffs.push({
        name: `${skill.name} (Invincible)`,
        type: 'invincible',
        value: 100,
        remainingTurns: invDur,
        appliedRound: currentRound,
        appliedTurnUserId: combatant.userId,
        hasDefendedOnce: false
      });
      combatant.isInvincible = true;
    }
    if (skill.id === 'indomitable_a' || skill.name.includes('Indomitable')) {
      combatant.activeBuffs.push({
        name: 'Indomitable A (On-Guts Buster Up)',
        type: 'on_guts_buster' as any,
        value: 20,
        remainingTurns: skill.duration || 5,
        appliedRound: currentRound
      });
      combatant.activeBuffs.push({
        name: `${skill.name} (Buster Up)`,
        type: 'buster_up',
        value: 20,
        remainingTurns: 3,
        appliedRound: currentRound
      });
    }
    if (skill.id?.includes('thrice')) {
      combatant.activeBuffs.push({
        name: `${skill.name} (DEF Up)`,
        type: 'buff_def',
        value: 100,
        remainingTurns: 1,
        appliedRound: currentRound
      });
    }
    const invNotice = descLower.includes('invincible') || descLower.includes('invincibility') ? ', 🛡️ Invincible (1T)' : '';
    logText = `🩸 **${sName}** activated **${skill.name}**! (${gutsSummaryTag}${invNotice})${quoteLine}`;
  } else if (skill.effectType === 'heal') {
    const healVal = skill.value || Math.round(combatant.maxHp * 0.25);
    combatant.currentHp = Math.min(combatant.maxHp, combatant.currentHp + healVal);
    const descLower = (skill.description || '').toLowerCase();
    const idLower = (skill.id || '').toLowerCase();

    if (descLower.includes('buster') || idLower.includes('blast_stream')) {
      combatant.activeBuffs.push({
        name: `${skill.name} (Buster Up)`,
        type: 'buster_up',
        value: 30,
        remainingTurns: skill.duration || 3
      });
    }
    if (descLower.includes('arts')) {
      combatant.activeBuffs.push({
        name: `${skill.name} (Arts Up)`,
        type: 'arts_up',
        value: 30,
        remainingTurns: skill.duration || 3
      });
    }
    if (descLower.includes('quick')) {
      combatant.activeBuffs.push({
        name: `${skill.name} (Quick Up)`,
        type: 'quick_up',
        value: 30,
        remainingTurns: skill.duration || 3
      });
    }
    if (descLower.includes('clears debuffs') || descLower.includes('debuff') || idLower === 'divine_blessing') {
      combatant.activeBuffs = combatant.activeBuffs.filter(b => !b.type.startsWith('debuff'));
      combatant.activeBuffs.push({
        name: `${skill.name} (DEF Up)`,
        type: 'buff_def',
        value: 15,
        remainingTurns: 2
      });
    }
    logText = `💖 **${sName}** activated **${skill.name}**! (+${healVal.toLocaleString()} HP restored${descLower.includes('buster') || idLower.includes('blast_stream') ? ', +30% Buster Up' : ''}${idLower === 'divine_blessing' ? ', debuffs cleansed, +15% DEF Up' : ''})${quoteLine}`;
  } else if (skill.effectType === 'np_charge') {
    const npVal = skill.value || 30;
    combatant.npGauge = Math.min(300, combatant.npGauge + npVal);
    combatant.critStars = Math.min(50, combatant.critStars + 15);
    const descLower = (skill.description || '').toLowerCase();
    const idLower = (skill.id || '').toLowerCase();

    if (descLower.includes('arts') || idLower === 'after_pure_prayer_ex' || skill.name.includes('Pure Prayer')) {
      combatant.activeBuffs.push({
        name: `${skill.name} (Arts Up)`,
        type: 'arts_up',
        value: 20,
        remainingTurns: 3
      });
    }
    if (descLower.includes('stars') || idLower === 'after_pure_prayer_ex' || skill.name.includes('Pure Prayer')) {
      combatant.activeBuffs.push({
        name: `${skill.name} (Stars Per Turn)`,
        type: 'stars_per_turn',
        value: 15,
        remainingTurns: 3
      });
      combatant.critStars = Math.min(50, (combatant.critStars || 0) + 15);
    }
    if (descLower.includes('evade') || idLower.includes('magic_circuit_acceleration')) {
      combatant.activeBuffs.push({
        name: `${skill.name} (Evade)`,
        type: 'evade',
        value: 100,
        remainingTurns: 1
      });
    }
    if (descLower.includes('invincible') || descLower.includes('invulnerability')) {
      combatant.activeBuffs.push({
        name: `${skill.name} (Invincible)`,
        type: 'invincible',
        value: 100,
        remainingTurns: 1
      });
    }
    if (descLower.includes('np gain') || idLower.includes('magic_circuit_acceleration')) {
      combatant.activeBuffs.push({
        name: `${skill.name} (NP Gain Up)`,
        type: 'np_gain',
        value: 30,
        remainingTurns: skill.duration || 3
      });
    }

    logText = `⚡ **${sName}** activated **${skill.name}**! (+${npVal}% NP Gauge, +15 Stars/turn (3T)${descLower.includes('arts') || idLower === 'after_pure_prayer_ex' ? ', +20% Arts Up (3T)' : ''}${descLower.includes('evade') || idLower.includes('magic_circuit') ? ', Evade granted for 1 turn' : ''})${quoteLine}`;
  } else if (skill.effectType === 'crit_stars') {
    const starVal = skill.value || 25;
    combatant.critStars = Math.min(50, combatant.critStars + starVal);
    combatant.activeBuffs.push({ name: skill.name, type: 'crit_dmg', value: 40, remainingTurns: skill.duration || 2 });
    logText = `🌟 **${sName}** activated **${skill.name}**!${quoteLine}`;
  } else if (skill.effectType === 'stun' || skill.effectType === 'debuff' || skill.id?.includes('discernment') || skill.id === 'restoration_radiant_light' || skill.id === 'divine_judgement_a') {
    if (opponent) {
      // Check Debuff Resistance (Magic Resistance, Fifth Succession, etc.)
      const oppPassives = opponent.passives || getUnlockedPassives(opponent.servant.template?.passives?.length ? opponent.servant.template.passives : opponent.servant.template?.servantClass, opponent.servant.bondLevel || 1);
      const debuffResist = oppPassives.filter(p => p.type === 'magic_resistance' || p.type === 'fifth_succession').reduce((s, p) => s + p.value, 0);
      const didResist = Math.random() * 100 < debuffResist;
      const oppServantName = opponent.servant.nickname || opponent.servant.template?.name || 'Opponent';

      if (didResist) {
        logText = `🛡️ **${sName}** activated **${skill.name}**, but **${oppServantName}** nullified the debuff with **Debuff Resistance (${debuffResist}%)**!${quoteLine}`;
      } else if (skill.id === 'restoration_radiant_light' || skill.name.includes('Radiant Holy Light') || skill.name.includes('Restoration')) {
        opponent.npGauge = Math.max(0, opponent.npGauge - 20);
        opponent.activeBuffs.push({
          name: `${skill.name} (NP Strength Down)`,
          type: 'debuff_np_strength',
          value: 30,
          remainingTurns: 1
        });
        opponent.activeBuffs.push({
          name: `${skill.name} (DEF Down 1T)`,
          type: 'debuff_def',
          value: 20,
          remainingTurns: 1
        });
        opponent.activeBuffs.push({
          name: `${skill.name} (DEF Down 3T)`,
          type: 'debuff_def',
          value: 30,
          remainingTurns: 3
        });
        logText = `✨ **${sName}** activated **${skill.name}**! (-30% Enemy NP Strength (1T), -50% Enemy DEF Down, -20% NP Drain)${quoteLine}`;
      } else if (skill.effectType === 'stun' || skill.id === 'divine_judgement_a' || skill.name.includes('Divine Judgement')) {
        opponent.isStunned = true;
        opponent.activeBuffs.push({
          name: `${skill.name} (Stun)`,
          type: 'stun',
          value: 100,
          remainingTurns: skill.duration || 1
        });
        logText = `⚖️ **${sName}** activated **${skill.name}**! (Inflicted **Stun** on enemy for 1 turn!)${quoteLine}`;
      } else {
        opponent.activeBuffs.push({
          name: `${skill.name} (ATK Down)`,
          type: 'debuff_atk',
          value: skill.value || 20,
          remainingTurns: skill.duration || 1
        });
        logText = `✨ **${sName}** activated **${skill.name}**! (-${skill.value || 20}% ATK Down for ${skill.duration || 1} turns)${quoteLine}`;
      }
    } else {
      logText = `✨ **${sName}** activated **${skill.name}**!${quoteLine}`;
    }
  } else {
    combatant.activeBuffs.push({ name: skill.name, type: 'buff_atk', value: 25, remainingTurns: 2 });
    logText = `✨ **${sName}** activated **${skill.name}**!${quoteLine}`;
  }

  // Guarantee every newly applied buff has its origin round and caster stamped so it survives round rollover
  combatant.activeBuffs?.forEach(b => {
    if (b.appliedRound === undefined) {
      b.appliedRound = currentRound;
    }
    if (b.appliedTurnUserId === undefined) {
      b.appliedTurnUserId = combatant.userId;
    }
  });
  if (opponent?.activeBuffs) {
    opponent.activeBuffs.forEach(b => {
      if (b.appliedRound === undefined) {
        b.appliedRound = currentRound;
      }
      if (b.appliedTurnUserId === undefined) {
        b.appliedTurnUserId = combatant.userId;
      }
    });
  }

  return {
    success: true,
    log: logText,
    quote: isTransformation ? 'Fifth Magic—Circuits ignition! Time to kick this into maximum gear!' : skillQuote,
    skillName: skill.name,
    skillType: skill.effectType || 'buff',
    skillDescription: skill.description || '',
    isTransformation,
    transformationGif,
    transformationAvatarUrl: (skill as any).transformationAvatarUrl || 'https://ella.janitorai.com/media-approved/zUtP5PQLU7fMKVyin9H-f.webp'
  };
}

// Helper to invoke a command seal without spending a turn
function invokeCombatantSeal(combatant: DuelCombatant): { success: boolean; log: string; quote: string } {
  if ((combatant.commandSeals || 0) <= 0) {
    return { success: false, log: '⚠️ You have no Command Seals remaining!', quote: '' };
  }

  combatant.commandSeals--;
  combatant.npGauge = 100;
  const sName = combatant.servant.nickname || combatant.servant.template.name;
  const sealQuote = combatant.servant.customQuotes?.commandSeal || "By my Command Seal, shatter all opposition and surge with true ether!";
  const logText = `🔱 **COMMAND SEAL INVOKED!** Master **${combatant.username}** commanded: ❝ ***${sealQuote}*** ❞\n> ⚡ **${sName}**'s NP Gauge has been completely refilled to **100%**!`;
  return { success: true, log: logText, quote: sealQuote };
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
  cardsSequence: ('Buster' | 'Arts' | 'Quick' | 'NP')[],
  dialogue?: { quote: string; tag: string },
  livingOpponents?: DuelCombatant[],
  livingAllies?: DuelCombatant[]
): string {
  const chainTags: string[] = [];

  // Decrement attacker skill cooldowns
  for (const idxStr of Object.keys(attacker.skillCooldowns)) {
    const idx = parseInt(idxStr, 10);
    if (attacker.skillCooldowns[idx] > 0) {
      attacker.skillCooldowns[idx]--;
    }
  }

  // Craft Essence Turn-Start Passives (strictly validated for matching servant on Bond CEs)
  const attackerCe = attacker.servant.equippedCe;
  const attackerCeStats = attackerCe ? getCePassiveStats(attackerCe, attacker.servant) : null;
  if (attackerCe && attackerCeStats) {
    if (attackerCeStats.npPerTurn > 0) {
      attacker.npGauge = Math.min(300, attacker.npGauge + attackerCeStats.npPerTurn);
    }
    if (attackerCeStats.starsPerTurn > 0) {
      attacker.critStars = Math.min(50, (attacker.critStars || 0) + attackerCeStats.starsPerTurn);
    }
    if (attackerCe.id === 'ce_when_the_flowers_fall') {
      attacker.npGauge = Math.min(300, attacker.npGauge + 4);
    }
    if (attackerCe.id === 'ce_black_grail' || /black grail/i.test(attackerCe.name || '')) {
      const burnDmg = 500;
      attacker.currentHp = Math.max(1, attacker.currentHp - burnDmg);
      chainTags.push(`🩸 The Black Grail Tainted Curse (-${burnDmg} HP Demerit)`);
    }
  }

  // Servant Passive Skills: Turn-Start (e.g. Progenitor Dragon)
  // 1. Resolve Attacker & Defender Passives (Max 2, 2nd unlocked after Bond 5)
  const attackerPassives = attacker.passives || getUnlockedPassives(attacker.servant.template?.passives?.length ? attacker.servant.template.passives : attacker.servant.template?.servantClass, attacker.servant.bondLevel || 1);
  const defenderPassives = defender.passives || getUnlockedPassives(defender.servant.template?.passives?.length ? defender.servant.template.passives : defender.servant.template?.servantClass, defender.servant.bondLevel || 1);
  if (attackerPassives.some(p => p.type === 'progenitor_dragon' || (p.name && p.name.includes('Progenitor Dragon')))) {
    attacker.npGauge = Math.min(300, attacker.npGauge + 5);
  }

  // Turn-Start Skill Buffs (e.g. After Pure Prayer EX stars per turn)
  const starBuffs = attacker.activeBuffs.filter(b => b.type === 'stars_per_turn');
  const starsFromTurnBuffs = starBuffs.reduce((s, b) => s + b.value, 0);
  if (starsFromTurnBuffs > 0) {
    attacker.critStars = Math.min(50, (attacker.critStars || 0) + starsFromTurnBuffs);
  }

  // Turn-Start HP Regen Buffs (e.g. Luminosité Eternelle Overcharge HP recovery every turn for 2 turns)
  let turnRegenHealed = 0;
  const duelRegenBuffs = attacker.activeBuffs.filter(b => b.type === 'hp_regen');
  const duelHpRegenTotal = duelRegenBuffs.reduce((s, b) => s + b.value, 0);
  const ceDuelRegen = attackerCeStats?.hpRegenPerTurn || 0;
  const totalDuelRegen = duelHpRegenTotal + ceDuelRegen;
  if (totalDuelRegen > 0 && attacker.currentHp < attacker.maxHp) {
    turnRegenHealed = totalDuelRegen;
    attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + totalDuelRegen);
  }


  // Turn-Start Servant Passives (e.g. Fifth Succession A grants +4% NP Gauge every turn)
  const fifthSuccessionBonus = attackerPassives.filter(p => p.type === 'fifth_succession').length > 0 ? 4 : 0;
  if (fifthSuccessionBonus > 0) {
    attacker.npGauge = Math.min(300, attacker.npGauge + fifthSuccessionBonus);
  }

  // Absolute Permanence B (Luvria Greenharte) grants +3% NP Gauge every turn
  const permanenceBonus = attackerPassives.filter(p => p.type === 'absolute_permanence').length > 0 ? 3 : 0;
  if (permanenceBonus > 0) {
    attacker.npGauge = Math.min(300, attacker.npGauge + permanenceBonus);
  }

  // The Weight of Heaven (Adiosa) gravitational field
  const weightOfHeaven = attackerPassives.find(p => p.type === 'the_weight_of_heaven');
  if (weightOfHeaven) {
    const atkMana = (attacker.servant.template?.baseStats?.mana || 10) + (attacker.servant.allocatedStats?.mana || 0);
    const defMana = (defender.servant.template?.baseStats?.mana || 10) + (defender.servant.allocatedStats?.mana || 0);
    if (atkMana > defMana) {
      const gravDmg = Math.round(weightOfHeaven.value * PVP_DAMAGE_MODIFIER);
      defender.currentHp = Math.max(0, defender.currentHp - gravDmg);
    }
  }

  // Curse damage at turn start
  const curseBuffs = attacker.activeBuffs.filter(b => b.type === 'curse');
  if (curseBuffs.length > 0) {
    const totalCurseDmg = curseBuffs.reduce((s, b) => s + (b.value || 100), 0);
    attacker.currentHp = Math.max(1, attacker.currentHp - totalCurseDmg);
    chainTags.push(`💀 Curse Affliction (-${totalCurseDmg} HP from ${curseBuffs.length} stacks)`);
  }

  // Turn-Start Foreigner / Existence Outside the Domain Passive (+2 critical stars every turn)
  const existenceOutsideBonus = attackerPassives.filter(p => p.type === 'existence_outside_the_domain').length > 0 ? 2 : 0;
  if (existenceOutsideBonus > 0) {
    attacker.critStars = Math.min(50, (attacker.critStars || 0) + existenceOutsideBonus);
  }

  // Turn-Start Stars per turn buffs (e.g. from De Sterrennacht)
  const starsPerTurnBuffs = attacker.activeBuffs.filter(b => b.type === 'stars_per_turn' || b.type === 'star_regen');
  const totalTurnStars = starsPerTurnBuffs.reduce((s, b) => s + b.value, 0);
  if (totalTurnStars > 0) {
    attacker.critStars = Math.min(50, (attacker.critStars || 0) + totalTurnStars);
  }

  // Handle Stun status
  const isStunnedActor = attacker.isStunned || (attacker.activeBuffs && attacker.activeBuffs.some(b => b.type === 'stun'));
  if (isStunnedActor) {
    attacker.isStunned = false;
    attacker.activeBuffs = (attacker.activeBuffs || [])
      .filter(b => b.type !== 'stun')
      .map(b => {
        if (
          b.type === 'buff_atk' ||
          b.type === 'atk_up' ||
          b.type === 'debuff_atk' ||
          b.type === 'crit_dmg' ||
          b.type === 'crit_dmg_up' ||
          b.type === 'np_gen' ||
          b.type === 'np_gain' ||
          b.type === 'buster_up' ||
          b.type === 'arts_up' ||
          b.type === 'quick_up' ||
          b.type === 'ignore_invincible' ||
          b.type === 'ignore_defense' ||
          b.type === 'skill_seal' ||
          b.type === 'stars_per_turn' ||
          b.type === 'hp_regen' ||
          b.type === 'debuff_np_strength' ||
          b.type === 'debuff_np_dmg'
        ) {
          b.remainingTurns--;
        }
        return b;
      })
      .filter(b => b.remainingTurns > 0);
    return `💫 **${attacker.servant.template.name}** was **Stunned** and was unable to attack this turn! (Stun has worn off)`;
  }

  // Calculate active buffs
  let atkBuff = 1.0;
  let critDmgBonus = 1.0;
  let npGenBonus = 1.0;

  const magicGunnerBonus = attackerPassives.filter(p => p.type === 'magic_gunner').reduce((s, p) => s + p.value, 0);
  const madnessBonus = attackerPassives.filter(p => p.type === 'madness_enhancement').reduce((s, p) => s + p.value, 0) + magicGunnerBonus;
  const ridingBonus = attackerPassives.filter(p => p.type === 'riding').reduce((s, p) => s + p.value, 0);
  const territoryBonus = attackerPassives.filter(p => p.type === 'territory_creation').reduce((s, p) => s + p.value, 0) + magicGunnerBonus;
  const critPassiveBonus = attackerPassives.filter(p => p.type === 'independent_action' || p.type === 'oblivion_correction').reduce((s, p) => s + p.value, 0);
  const divinityBonus = attackerPassives.filter(p => p.type === 'divinity').reduce((s, p) => s + p.value, 0);
  const presenceConcealBonus = attackerPassives.filter(p => p.type === 'presence_concealment').reduce((s, p) => s + p.value, 0) + (magicGunnerBonus > 0 ? 5 : 0);
  const avengerBonus = defenderPassives.filter(p => p.type === 'avenger').reduce((s, p) => s + p.value, 0);
  const attackerAvengerAtk = attackerPassives.filter(p => p.type === 'avenger').length > 0 ? 0.04 : 0;
  const flatDivinity = Math.round(divinityBonus * PVP_DAMAGE_MODIFIER);

  // Independent Action & Oblivion Correction boost Crit Damage
  critDmgBonus += critPassiveBonus / 100;

  // Luck (LCK) parameter soft-capped scaling (+0% to +35% Crit DMG boost)
  const attackerLuck = (attacker.servant.template?.baseStats?.luck || 10) + (attacker.servant.allocatedStats?.luck || 0);
  const luckCritBonus = Math.min(0.35, (attackerLuck / (attackerLuck + 120)) * 0.35);
  critDmgBonus += luckCritBonus;

  attacker.activeBuffs.forEach(b => {
    if (b.type === 'buff_atk' || b.type === 'atk_up') atkBuff += b.value / 100;
    if (b.type === 'debuff_atk') atkBuff -= b.value / 100;
    if (b.type === 'crit_dmg' || b.type === 'crit_dmg_up') critDmgBonus += b.value / 100;
    if (b.type === 'np_gen' || b.type === 'np_gain') npGenBonus += b.value / 100;
  });

  let defBuff = 1.0;
  defender.activeBuffs.forEach(b => {
    if (b.type === 'buff_def') defBuff += b.value / 100;
    if (b.type === 'debuff_def') defBuff -= b.value / 100;
  });
  const defTerraPassive = defenderPassives.find(p => p.type === 'terra_affinity');
  if (defTerraPassive) defBuff += (defTerraPassive.value || 8) / 100;

  const effectiveAtk = attacker.baseAtk * (atkBuff + attackerAvengerAtk);
  const effectiveDef = defender.baseDef * defBuff;

  const classMult = getClassMultiplier(
    attacker.servant.template.servantClass,
    defender.servant.template.servantClass
  );

  let turnBlockedByAntiPurge = false;
  let turnBlockedByInvincible = false;
  let turnBlockedByEvade = false;

  const processTargetHitProtection = (targetDefender: DuelCombatant): { isProtected: boolean; type?: 'anti_purge_defense' | 'invincible' | 'evade' } => {
    const actorHasAntiPurgeAtk = attackerCe?.passiveType === 'anti_purge_atk' || attacker.activeBuffs.some(b => b.type === 'anti_purge_atk' || b.type === 'pierce_anti_purge');
    const actorIgnoresInvincible = attackerCe?.id === 'ce_origin_bullet' || attackerCe?.passiveType === 'ignore_invincible' || attacker.activeBuffs.some(b => b.type === 'ignore_invincible' || b.type === 'anti_invulnerable' || b.type === 'pierce_invincible');
    const actorHasSureHit = attackerCe?.passiveType === 'sure_hit' || attacker.activeBuffs.some(b => b.type === 'sure_hit' || b.type === 'ignore_evade');

    // 1. Anti-Purge Defense (Top Tier Defense: Blocks normal attacks, sure hit, AND ignore invincible! Pierced ONLY by Anti-Purge Attack)
    const apIdx = targetDefender.activeBuffs.findIndex(b => b.type === 'anti_purge_defense' || b.type === 'anti_purge');
    if (apIdx !== -1) {
      const buff = targetDefender.activeBuffs[apIdx];
      if (actorHasAntiPurgeAtk) {
        // Pierced by Anti-Purge Attack!
      } else {
        const isHitBased = buff.isHitCount || buff.remainingHits !== undefined;
        if (isHitBased) {
          if (buff.remainingHits === undefined) buff.remainingHits = 1;
          if (buff.remainingHits > 0) {
            buff.remainingHits--;
            buff.hasDefendedOnce = true;
            if (buff.remainingHits <= 0) {
              targetDefender.activeBuffs.splice(apIdx, 1);
              targetDefender.isAntiPurgeDefense = targetDefender.activeBuffs.some(b => b.type === 'anti_purge_defense' || b.type === 'anti_purge');
            }
            return { isProtected: true, type: 'anti_purge_defense' };
          } else {
            targetDefender.activeBuffs.splice(apIdx, 1);
            targetDefender.isAntiPurgeDefense = targetDefender.activeBuffs.some(b => b.type === 'anti_purge_defense' || b.type === 'anti_purge');
          }
        } else if (buff.remainingTurns > 0) {
          buff.hasDefendedOnce = true;
          return { isProtected: true, type: 'anti_purge_defense' };
        } else {
          targetDefender.activeBuffs.splice(apIdx, 1);
          targetDefender.isAntiPurgeDefense = targetDefender.activeBuffs.some(b => b.type === 'anti_purge_defense' || b.type === 'anti_purge');
        }
      }
    }

    // 2. Invincible (Blocks normal attacks & Sure Hit; Pierced by Ignore Invincible AND Anti-Purge Attack)
    if (actorHasAntiPurgeAtk || actorIgnoresInvincible) {
      // Pierced by Ignore Invincible or Anti-Purge Attack!
    } else {
      // Prioritize turn-based Invincible if active so hit charges (e.g. Volumen Hydragyrum) are preserved
      const turnInvIdx = targetDefender.activeBuffs.findIndex(b => b.type === 'invincible' && !b.isHitCount && b.remainingHits === undefined && (b.remainingTurns === undefined || b.remainingTurns > 0));
      if (turnInvIdx !== -1) {
        const buff = targetDefender.activeBuffs[turnInvIdx];
        buff.hasDefendedOnce = true;
        return { isProtected: true, type: 'invincible' };
      }

      // Hit-based Invincible (e.g. Volumen Hydragyrum)
      const hitInvIdx = targetDefender.activeBuffs.findIndex(b => b.type === 'invincible');
      if (hitInvIdx !== -1) {
        const buff = targetDefender.activeBuffs[hitInvIdx];
        const isHitBased = buff.isHitCount || buff.remainingHits !== undefined || /volumen/i.test(buff.name);
        if (isHitBased) {
          if (buff.remainingHits === undefined) buff.remainingHits = 3;
          if (buff.remainingHits > 0) {
            buff.remainingHits--;
            buff.hasDefendedOnce = true;
            if (buff.remainingHits <= 0) {
              targetDefender.activeBuffs.splice(hitInvIdx, 1);
              targetDefender.isInvincible = targetDefender.activeBuffs.some(b => b.type === 'invincible');
            }
            return { isProtected: true, type: 'invincible' };
          } else {
            targetDefender.activeBuffs.splice(hitInvIdx, 1);
            targetDefender.isInvincible = targetDefender.activeBuffs.some(b => b.type === 'invincible');
          }
        } else {
          if (buff.remainingTurns > 0) {
            buff.hasDefendedOnce = true;
            return { isProtected: true, type: 'invincible' };
          } else {
            targetDefender.activeBuffs.splice(hitInvIdx, 1);
            targetDefender.isInvincible = targetDefender.activeBuffs.some(b => b.type === 'invincible');
          }
        }
      }
    }

    // 3. Evade (Blocks normal attacks AND Anti-Purge Attack; Pierced by Ignore Invincible AND Sure Hit)
    if (actorIgnoresInvincible || actorHasSureHit) {
      // Pierced by Ignore Invincible / Sure Hit!
    } else {
      // Prioritize turn-based Evade if active so hit charges (e.g. Protection from Arrows) are preserved
      const turnEvaIdx = targetDefender.activeBuffs.findIndex(b => b.type === 'evade' && !b.isHitCount && b.remainingHits === undefined && (b.remainingTurns === undefined || b.remainingTurns > 0));
      if (turnEvaIdx !== -1) {
        const buff = targetDefender.activeBuffs[turnEvaIdx];
        buff.hasDefendedOnce = true;
        return { isProtected: true, type: 'evade' };
      }

      // Hit-based Evade (e.g. Protection from Arrows)
      const hitEvaIdx = targetDefender.activeBuffs.findIndex(b => b.type === 'evade');
      if (hitEvaIdx !== -1) {
        const buff = targetDefender.activeBuffs[hitEvaIdx];
        const isHitBased = buff.isHitCount || buff.remainingHits !== undefined || /protection from arrows/i.test(buff.name);
        if (isHitBased) {
          if (buff.remainingHits === undefined) buff.remainingHits = 3;
          if (buff.remainingHits > 0) {
            buff.remainingHits--;
            buff.hasDefendedOnce = true;
            if (buff.remainingHits <= 0) {
              targetDefender.activeBuffs.splice(hitEvaIdx, 1);
              targetDefender.isEvading = targetDefender.activeBuffs.some(b => b.type === 'evade');
            }
            return { isProtected: true, type: 'evade' };
          } else {
            targetDefender.activeBuffs.splice(hitEvaIdx, 1);
            targetDefender.isEvading = targetDefender.activeBuffs.some(b => b.type === 'evade');
          }
        } else {
          if (buff.remainingTurns > 0) {
            buff.hasDefendedOnce = true;
            return { isProtected: true, type: 'evade' };
          } else {
            targetDefender.activeBuffs.splice(hitEvaIdx, 1);
            targetDefender.isEvading = targetDefender.activeBuffs.some(b => b.type === 'evade');
          }
        }
      }
    }

    return { isProtected: false };
  };

  const processHitProtection = () => processTargetHitProtection(defender);

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

  if (isBusterFirst) chainTags.push('🔥 Buster 1st Lead (+50% DMG)');
  if (isArtsFirst) chainTags.push('🌊 Arts 1st Lead (+50% NP Gain)');
  if (isQuickFirst) chainTags.push('⚡ Quick 1st Lead (+20% Crit Rate)');

  if (isBusterChain) chainTags.push('🔴 BUSTER CHAIN (+20% Base ATK Hit Bonus)');
  if (isArtsChain) chainTags.push('🔵 ARTS CHAIN (+20% NP Refund)');
  if (isQuickChain) chainTags.push('🟢 QUICK CHAIN (+20 Critical Stars)');
  if (turnRegenHealed > 0) chainTags.push(`💖 Holy Regen (+${turnRegenHealed.toLocaleString()} HP)`);

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

  let totalNpDmgVal = 0;
  let npLogBlock = '';

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

      // Card-specific performance buffs (Active buffs + Class Passives + CE Passives)
      const ceBuster = attackerCe?.passiveType === 'buster_up' && attackerCe.id !== 'ce_black_grail' ? (attackerCe.passiveValue || 0) : 0;
      const ceArts = attackerCe?.passiveType === 'arts_up' ? (attackerCe.passiveValue || 0) : 0;
      const ceQuick = attackerCe?.passiveType === 'quick_up' ? (attackerCe.passiveValue || 0) : 0;

      const busterBuff = attacker.activeBuffs.filter(b => b.type === 'buster_up' || /mana burst|buster/i.test(b.name)).reduce((s, b) => s + b.value, 0) + madnessBonus + ceBuster;
      const artsBuff = attacker.activeBuffs.filter(b => b.type === 'arts_up' || /arts|fox/i.test(b.name)).reduce((s, b) => s + b.value, 0) + territoryBonus + ceArts;
      const quickBuff = attacker.activeBuffs.filter(b => b.type === 'quick_up' || /quick|primordial rune/i.test(b.name)).reduce((s, b) => s + b.value, 0) + ridingBonus + ceQuick;

      const cardPerfMult = 1.0 + ((npCardType === 'Buster' ? busterBuff : npCardType === 'Arts' ? artsBuff : quickBuff) / 100);

      // Card inherent damage scaling: Buster (1.5x), Arts (1.0x), Quick (0.8x)
      const cardTypeScale = npCardType === 'Buster' ? 1.50 : npCardType === 'Quick' ? 0.80 : 1.00;
      const scopeScale = npScope === 'single' ? 1.00 : npScope === 'aoe' ? 0.70 : 0.00;

      let ocBonus = 0;
      const ocIdx = attacker.activeBuffs.findIndex(b => b.type === 'overcharge_up');
      if (ocIdx >= 0) {
        ocBonus = attacker.activeBuffs[ocIdx].value || 2;
        attacker.activeBuffs.splice(ocIdx, 1);
      }
      const baseOcLevel = attacker.npGauge >= 300 ? 3 : attacker.npGauge >= 200 ? 2 : 1;
      const overchargeLevel = Math.min(5, baseOcLevel + ocBonus);
      const isOvercharged = overchargeLevel >= 2;
      const overchargeScale = isOvercharged ? (1.0 + (overchargeLevel - 1) * 0.20) : 1.00;

      let npDmg = 0;
      let npRefund = 0;
      let npStars = 0;

      if (npScope === 'support') {
        // Non-damaging Support NP applies EXCLUSIVELY to living allies (NEVER enemies)
        const targetAllies = (livingAllies && livingAllies.length > 0) ? livingAllies.filter(a => a.currentHp > 0) : [attacker];

        targetAllies.forEach(allyCombatant => {
          if (npCardType === 'Arts') {
            const isRoundOfAvalon = /round of avalon|avalon/i.test(npTemplate.name) || attacker.servant.template.id === 'artoria_caster';
            const isLuminosite = /luminosit|jeanne/i.test(npTemplate.name) || attacker.servant.template.id === 'jeanne_darc_ruler';
            const isTigris = /tigris|edmond/i.test(npTemplate.name) || attacker.servant.template.id === 'edmond';
            const isDeSterrennacht = /sterrennacht|starry night|van gogh/i.test(npTemplate.name) || attacker.servant.template.id === 'van_gogh';
            const isAmaterasu = /suiten|amaterasu|shizu-ishi|tamamo/i.test(npTemplate.name) || attacker.servant.template.id === 'tamamo_no_mae';
            if (isAmaterasu) {
              // Tamamo no Mae NP: Suiten Nikkō Amaterasu Yano Shizu-Ishi
              // 1. Reduces all party's and self skill cooldown by 1
              if (allyCombatant.skillCooldowns) {
                for (const idxStr of Object.keys(allyCombatant.skillCooldowns)) {
                  const sIdx = parseInt(idxStr, 10);
                  if (allyCombatant.skillCooldowns[sIdx] > 0) {
                    allyCombatant.skillCooldowns[sIdx] = Math.max(0, allyCombatant.skillCooldowns[sIdx] - 1);
                  }
                }
              }
              // 2. Recovers party's and self HP by 5,000
              allyCombatant.currentHp = Math.min(allyCombatant.maxHp, allyCombatant.currentHp + 5000);
              // 3. Overcharge: Increases party NP gain by 50% for 3 turns (scales with Overcharge)
              const ocNpGain = isOvercharged ? (50 + (overchargeLevel - 1) * 10) : 50;
              allyCombatant.activeBuffs = allyCombatant.activeBuffs || [];
              allyCombatant.activeBuffs.push({
                name: 'Blessings of Amaterasu (NP Gain Up)',
                type: 'np_gain',
                value: ocNpGain,
                remainingTurns: 3
              });
            } else if (isDeSterrennacht) {
              const isDomainAlly = allyCombatant.servant.template.servantClass === 'Foreigner' ||
                (allyCombatant.passives && allyCombatant.passives.some(p => p.type === 'existence_outside_the_domain')) ||
                (allyCombatant.servant.template.passives && allyCombatant.servant.template.passives.some(p => p.type === 'existence_outside_the_domain')) ||
                allyCombatant.servant.template.id === 'van_gogh' ||
                allyCombatant === attacker;

              // 1. Party Crit DMG Up (100% to all party members for 3 turns)
              allyCombatant.activeBuffs.push({
                name: 'De Sterrennacht (Crit DMG Up)',
                type: 'crit_dmg',
                value: 100,
                remainingTurns: 3
              });

              // 2. Existence Outside the Domain Crit DMG Up (+100% extra, boosts Van Gogh herself and any Foreigner!)
              if (isDomainAlly) {
                allyCombatant.activeBuffs.push({
                  name: 'De Sterrennacht (Domain Crit DMG Up)',
                  type: 'crit_dmg',
                  value: 100,
                  remainingTurns: 3
                });
              }

              // 3. Stars per turn (10 stars/turn for 3 turns)
              allyCombatant.activeBuffs.push({
                name: 'De Sterrennacht (Stars Per Turn)',
                type: 'stars_per_turn',
                value: 10,
                remainingTurns: 3
              });

              // 4. Overcharge ATK Up: 50% base + 10% per overcharge level for 3 turns
              const ocAtkBonus = isOvercharged ? (50 + (overchargeLevel - 1) * 10) : 50;
              allyCombatant.activeBuffs.push({
                name: 'De Sterrennacht (ATK Up)',
                type: 'buff_atk',
                value: ocAtkBonus,
                remainingTurns: 3
              });
            } else if (isRoundOfAvalon) {
              // Removes party debuffs
              allyCombatant.activeBuffs = allyCombatant.activeBuffs.filter(b =>
                !b.type.startsWith('debuff') &&
                b.type !== 'stun' &&
                b.type !== 'burn' &&
                b.type !== 'poison' &&
                b.type !== 'curse' &&
                b.type !== 'np_dmg_down' &&
                b.type !== 'charm' &&
                b.type !== 'atk_down' &&
                b.type !== 'def_down' &&
                !(b.value < 0) &&
                !/debuff|down|curse|burn|poison|stun|bound/i.test(b.name)
              );
              allyCombatant.isStunned = false;

              // Party Anti-Purge Defense (Damage Nullification 1T), ATK Up +50% 3T, Damage Cut
              allyCombatant.activeBuffs.push({ name: 'Anti-Purge Defense', type: 'anti_purge_defense', value: 100, remainingTurns: 1 });
              allyCombatant.activeBuffs.push({ name: 'Round of Avalon ATK', type: 'buff_atk', value: 50, remainingTurns: 3 });
              allyCombatant.activeBuffs.push({ name: 'Round of Avalon Protection', type: 'damage_cut', value: 2000, remainingTurns: 3 });
            } else if (isTigris) {
              const defBonus = isOvercharged ? (30 + (overchargeLevel - 1) * 10) : 30;
              allyCombatant.activeBuffs.push({ name: 'Tigris Bulwark (Defense Up)', type: 'buff_def', value: defBonus, remainingTurns: 3 });
              allyCombatant.activeBuffs.push({ name: 'Tigris Bastion (Invincible)', type: 'invincible', value: 100, remainingTurns: 1 });
              // Living Earth Damage Cut is an Overcharge effect (only triggers when Overcharged >= 200% NP)
              if (isOvercharged) {
                const damageCutVal = 1500 + (overchargeLevel - 1) * 750;
                allyCombatant.activeBuffs.push({ name: 'Living Earth (Damage Cut)', type: 'damage_cut', value: damageCutVal, remainingTurns: 3 });
              }
            } else if (isLuminosite) {
              // Removes party debuffs
              allyCombatant.activeBuffs = allyCombatant.activeBuffs.filter(b =>
                !b.type.startsWith('debuff') &&
                b.type !== 'stun' &&
                b.type !== 'burn' &&
                b.type !== 'poison' &&
                b.type !== 'curse' &&
                b.type !== 'np_dmg_down' &&
                b.type !== 'charm' &&
                b.type !== 'atk_down' &&
                b.type !== 'def_down' &&
                !(b.value < 0) &&
                !/debuff|down|curse|burn|poison|stun|bound/i.test(b.name)
              );
              allyCombatant.isStunned = false;

              // Party Invincibility 1T, DEF Up +30% 3T
              allyCombatant.activeBuffs.push({ name: 'Luminosité Invincibility', type: 'invincible', value: 100, remainingTurns: 1 });
              allyCombatant.activeBuffs.push({ name: 'Divine Protection', type: 'buff_def', value: 30, remainingTurns: 3 });
              // Holy HP Regen is an Overcharge effect (only triggers when Overcharged >= 200% NP)
              if (isOvercharged) {
                const regenPerTurn = 1000 + (overchargeLevel - 1) * 500;
                allyCombatant.currentHp = Math.min(allyCombatant.maxHp, allyCombatant.currentHp + regenPerTurn);
                allyCombatant.activeBuffs.push({ name: 'Luminosité Holy Regen', type: 'hp_regen', value: regenPerTurn, remainingTurns: 2 });
              }
            } else {
              const healAmount = Math.round(allyCombatant.maxHp * 0.20);
              allyCombatant.currentHp = Math.min(allyCombatant.maxHp, allyCombatant.currentHp + healAmount);
              allyCombatant.activeBuffs.push({ name: 'Invincibility', type: 'invincible', value: 100, remainingTurns: 1 });
              allyCombatant.activeBuffs.push({ name: 'Divine Protection', type: 'buff_def', value: 30, remainingTurns: 3 });
            }
          } else if (npCardType === 'Quick') {
            allyCombatant.activeBuffs.push({ name: 'Evade', type: 'evade', value: 100, remainingTurns: 1 });
          } else {
            allyCombatant.activeBuffs.push({ name: 'War Cry', type: 'buff_atk', value: 30, remainingTurns: 3 });
          }
        });

        const isDeSterrennacht = /sterrennacht|starry night|van gogh/i.test(npTemplate.name) || attacker.servant.template.id === 'van_gogh';
        if (isDeSterrennacht) {
          // Terror / Stun to all living enemies
          const targetEnemies = (livingOpponents && livingOpponents.length > 0) ? livingOpponents.filter(o => o.currentHp > 0) : (defender ? [defender] : []);
          targetEnemies.forEach(opp => {
            opp.isStunned = true;
            opp.activeBuffs = opp.activeBuffs || [];
            opp.activeBuffs.push({
              name: 'De Sterrennacht (Terror/Stun)',
              type: 'stun',
              value: 100,
              remainingTurns: 1
            });
          });

          // In-flight update of critDmgBonus and atkBuff for subsequent cards in this sequence
          const selfCritBonus = 100 + 100; // Party +100% Crit DMG + Domain +100% Crit DMG (+200% for Van Gogh)
          critDmgBonus += selfCritBonus / 100;
          const ocAtkBonus = isOvercharged ? (50 + (overchargeLevel - 1) * 10) : 50;
          atkBuff += ocAtkBonus / 100;

          chainTags.push(`🌌 De Sterrennacht Unleashed (Terror/Stun • Party +100% Crit DMG [+200% to Van Gogh] • +${ocAtkBonus}% ATK • +15 Stars & +10 Stars/turn)`);
          npRefund = 20;
          npStars = 15;
          attacker.critStars = Math.min(50, (attacker.critStars || 0) + 15);
        } else if (npCardType === 'Arts') {
          const isRoundOfAvalon = /round of avalon|avalon/i.test(npTemplate.name) || attacker.servant.template.id === 'artoria_caster';
          if (isRoundOfAvalon) {
            atkBuff += 50 / 100;
          }
          chainTags.push(`🕊️ Party Support NP Unleashed (Invincible 1T • DEF Up 3T • Debuff Cleanse)`);
          npRefund = 15;
          // Overcharge Critical Stars for Round of Avalon (only when Overcharged)
          const ocStars = (isRoundOfAvalon && isOvercharged) ? (overchargeLevel >= 3 ? 30 : 15) : 0;
          npStars = 3 + ocStars;
        } else if (npCardType === 'Quick') {
          const baseStars = isOvercharged ? (20 + (overchargeLevel - 1) * 10) : 20;
          npStars = Math.round(baseStars * (1.0 + quickBuff / 100));
          npRefund = Math.round(8 * (1.0 + quickBuff / 100));
        } else {
          npStars = 5;
          npRefund = 0;
        }

        const allyNames = targetAllies.map(a => `**${(a.servant.nickname || a.servant.template?.name || 'Ally').toUpperCase()}**`).join(' & ');
        let effectDesc = 'Applied War Cry (+30% ATK for 3 Turns)';
        if (isDeSterrennacht) {
          const ocAtkBonus = isOvercharged ? (50 + (overchargeLevel - 1) * 10) : 50;
          effectDesc = `Inflicted Terror/Stun on enemies (1T), Party +100% Crit DMG (3T), Van Gogh & Foreigner Allies +100% Bonus Crit DMG (+200% Total, 3T), Party +${ocAtkBonus}% ATK (3T), +15 Stars & +10 Stars/turn (3T)!`;
        } else if (npCardType === 'Arts') {
          effectDesc = isOvercharged
            ? 'Applied Party Protection (1T), DEF Up +30% (3T), Debuff Cleanse & [Overcharge Bonus Active]!'
            : 'Applied Party Protection (1T), DEF Up +30% (3T) & Debuff Cleanse!';
        } else if (npCardType === 'Quick') {
          effectDesc = 'Applied Party Evade (1T)';
        }

        const overchargeStatusText = isOvercharged
          ? `Lv.${overchargeLevel} (${Math.round(overchargeScale * 100)}% Power • Overcharge Active)`
          : `Inactive (100% Base NP Release)`;

        npLogBlock = 
          `\n> ════════════════════════════════════\n` +
          `> 🔱 **NOBLE PHANTASM ACTIVATED** 🔱\n` +
          `> 🌌 **[ ${npTemplate.name.toUpperCase()} ]**\n` +
          `> ────────────────────────────────────\n` +
          `> ◆ **TYPE:** PARTY SUPPORT (${npCardType.toUpperCase()})\n` +
          `> ◆ **OVERCHARGE:** ${overchargeStatusText}\n` +
          `> ◆ **TARGETS:** ${allyNames}\n` +
          `> ◆ **EFFECTS:** ${effectDesc}\n` +
          `> ════════════════════════════════════`;
      } else {
        const variance = 0.96 + Math.random() * 0.08;
        const npDmgBuff = attacker.activeBuffs
          .filter(b => b.type === 'np_dmg' || b.type === 'np_dmg_up' || /np damage|np dmg/i.test(b.name))
          .reduce((s, b) => s + b.value, 0);
        const ceNpDmgMult = 1.0 + (npDmgBuff / 100);
        const npDmgDebuff = attacker.activeBuffs
          .filter(b => b.type === 'debuff_np_strength' || b.type === 'debuff_np_dmg' || /np strength|radiant holy light|true name/i.test(b.name))
          .reduce((s, b) => s + b.value, 0);
        const npStrengthScale = Math.max(0.05, 1.0 - (npDmgDebuff / 100));

        // Offense Noble Phantasms: ST hits locked defender, AoE hits EXCLUSIVELY living opponents (NEVER allies)
        const targetEnemies = (npScope === 'aoe')
          ? ((livingOpponents && livingOpponents.length > 0) ? livingOpponents.filter(o => o.currentHp > 0) : [defender])
          : [defender];

        const damageDetails: string[] = [];
        const damageLines: string[] = [];
        totalNpDmgVal = 0;

        targetEnemies.forEach(targetOpp => {
          const targetClassMult = getClassMultiplier(
            attacker.servant.template.servantClass,
            targetOpp.servant.template.servantClass
          );

          let oppDefBuff = 1.0;
          targetOpp.activeBuffs.forEach(b => {
            if (b.type === 'buff_def') oppDefBuff += b.value / 100;
            if (b.type === 'debuff_def') oppDefBuff -= b.value / 100;
          });
          const targetEffectiveDef = targetOpp.baseDef * oppDefBuff;

          let typhonDebuffScale = 1.0;
          if (attacker.servant.templateId === 'typhon_ephemeros' || /dragon grail that reverses/i.test(attacker.servant.template.noblePhantasm?.name || '')) {
            const debuffCount = (attacker.activeBuffs || []).filter(b => ['curse', 'burn', 'poison', 'atk_down', 'def_down', 'stun', 'np_seal', 'skill_seal'].includes(b.type) || b.name.includes('[Demerit]') || b.type.includes('debuff')).length;
            if (debuffCount > 0) {
              typhonDebuffScale = 1.0 + Math.min(1.0, debuffCount * 0.10);
            }
            targetOpp.activeBuffs.push({
              name: `${attacker.servant.template.noblePhantasm?.name || 'Dragon Grail'} (Burn)`,
              type: 'burn',
              value: 1000,
              remainingTurns: 5
            });
            targetOpp.activeBuffs.push({
              name: `${attacker.servant.template.noblePhantasm?.name || 'Dragon Grail'} (Spread of Fire)`,
              type: 'spread_of_fire',
              value: 100,
              remainingTurns: 5
            });
          }

          const rawNpDmg = (effectiveAtk * (baseMultiplier / 100) * 0.18 * cardTypeScale * scopeScale * overchargeScale * typhonDebuffScale * targetClassMult * cardPerfMult * ceNpDmgMult * npStrengthScale * variance);
          let oppDmg = Math.round(Math.max(600, rawNpDmg) * PVP_DAMAGE_MODIFIER) + flatDivinity;

          const hitProt = processTargetHitProtection(targetOpp);
          const wasProtected = hitProt.isProtected;
          if (wasProtected) {
            oppDmg = 0;
          }

          // Damage cut calculation
          const targetCut = targetOpp.activeBuffs.filter(b => b.type === 'damage_cut').reduce((s, b) => s + b.value, 0);
          if (targetCut > 0 && oppDmg > 0) {
            oppDmg = Math.max(0, oppDmg - targetCut);
          }

          // Directly apply AoE NP damage to this enemy
          targetOpp.currentHp = Math.max(0, targetOpp.currentHp - oppDmg);

          const oppName = targetOpp.servant.nickname || targetOpp.servant.template?.name || 'Enemy';
          damageDetails.push(`${oppName} (took ${oppDmg.toLocaleString()} DMG)`);
          totalNpDmgVal += oppDmg;

          // Slum Veteran Guts check
          const oppPassives = targetOpp.passives || getUnlockedPassives(targetOpp.servant.template?.passives?.length ? targetOpp.servant.template.passives : targetOpp.servant.template?.servantClass, targetOpp.servant.bondLevel || 1);
          const hasDefSlums = oppPassives.some(p => p.type === 'veteran_of_the_slums' || (p.name && p.name.includes('Veteran of the Slums'))) && !(targetOpp as any).isSlumVeteranTriggered;
          if (hasDefSlums && targetOpp.currentHp <= 0) {
            (targetOpp as any).isSlumVeteranTriggered = true;
            targetOpp.currentHp = 3000;
          }

          // Overcharge-exclusive debuffs (only trigger when Overcharged >= 200% NP)
          let isStunnedThisTurn = false;
          const isDenyTheVictory = (attacker.servant.template.noblePhantasm?.name || '').includes('Deny the Victory') || (attacker.servant.template.noblePhantasm?.name || '').includes('Concept Nullification');
          if (isDenyTheVictory && isOvercharged) {
            targetOpp.npGauge = Math.max(0, targetOpp.npGauge - 20);
            if (Math.random() < 0.50) {
              targetOpp.isStunned = true;
              isStunnedThisTurn = true;
              targetOpp.activeBuffs.push({ name: 'Concept Nullification (Stun)', type: 'stun' as any, value: 100, remainingTurns: 1 });
            }
            const defDownVal = overchargeLevel >= 3 ? 40 : 30;
            const critDownVal = overchargeLevel >= 3 ? 30 : 20;
            targetOpp.activeBuffs.push({ name: 'Deny the Victory (DEF Down)', type: 'debuff_def', value: defDownVal, remainingTurns: 3 });
            targetOpp.activeBuffs.push({ name: 'Deny the Victory (Crit Rate Down)', type: 'debuff_atk', value: critDownVal, remainingTurns: 3 });
          }

          if (targetOpp === defender) {
            npDmg = oppDmg;
          }

          // Format status notifications without emojis
          const statuses: string[] = [];
          if (wasProtected) {
            if (hitProt.type === 'anti_purge_defense') {
              statuses.push('ABSORBED BY ANTI-PURGE DEFENSE');
            } else if (hitProt.type === 'invincible') {
              statuses.push('ABSORBED BY INVINCIBILITY');
            } else {
              statuses.push('EVADED');
            }
          } else if (targetOpp.currentHp <= 0) {
            statuses.push('DEFEATED');
          } else {
            if (isStunnedThisTurn) statuses.push('STUNNED');
            if (isDenyTheVictory && isOvercharged) statuses.push('OVERCHARGE: DEF DOWN', 'NP GAUGE -20%');
            if ((targetOpp as any).isSlumVeteranTriggered) statuses.push('SLUMS GUTS REVIVED');
          }

          const statusSuffix = statuses.length > 0 ? ` [ ${statuses.join(' • ')} ]` : '';
          damageLines.push(`> • **${oppName.toUpperCase()}** ➔ __**${oppDmg.toLocaleString()} DMG**__${statusSuffix}`);
        });

        if (npScope === 'aoe') {
          chainTags.push(`💥 AOE Strike: Hit ${damageDetails.join(', ')}`);
        }

        const typeLabel = npScope === 'aoe' ? 'AREA-OF-EFFECT' : 'SINGLE TARGET';
        const overchargeStatusText = isOvercharged
          ? `Lv.${overchargeLevel} (${Math.round(overchargeScale * 100)}% Power • ${overchargeLevel === 3 ? 'MAX Overcharge Active' : 'Overcharge Active'})`
          : `Inactive (100% Base NP Release)`;

        npLogBlock = 
          `\n> ════════════════════════════════════\n` +
          `> 🔱 **NOBLE PHANTASM ACTIVATED** 🔱\n` +
          `> 🌌 **[ ${npTemplate.name.toUpperCase()} ]**\n` +
          `> ────────────────────────────────────\n` +
          `> ◆ **TYPE:** ${typeLabel} (${npCardType.toUpperCase()})\n` +
          `> ◆ **OVERCHARGE:** ${overchargeStatusText}\n` +
          `> ────────────────────────────────────\n` +
          damageLines.join('\n') + `\n` +
          `> ────────────────────────────────────\n` +
          `> ◆ **TOTAL NP DAMAGE DEALT:** __**${totalNpDmgVal.toLocaleString()} DMG**__\n` +
          `> ════════════════════════════════════`;

        // Refund properties dictated by card type
        if (npCardType === 'Buster') {
          const hasOverchargeRefund = /refund|recharge/i.test(attacker.servant.template.noblePhantasm?.overchargeEffect || '');
          // Overcharge refund only triggers when Overcharged (>= 200% NP)
          npRefund = (hasOverchargeRefund && isOvercharged) ? (overchargeLevel >= 3 ? 30 : 20) : 0;
          npStars = npScope === 'aoe' ? 5 : 2;
        } else if (npCardType === 'Arts') {
          const baseRefund = npScope === 'aoe' ? 18 : 12;
          const totalAtkMana = (attacker.servant.template?.baseStats?.mana || 10) + (attacker.servant.allocatedStats?.mana || 0);
          const manaNpBonus = Math.min(0.35, (totalAtkMana / (totalAtkMana + 120)) * 0.35);
          let artsRefundScale = 1.0 + (artsBuff / 100) + manaNpBonus;
          if (attackerCe?.id === 'ce_jeweled_sword') artsRefundScale *= 1.15;
          if (attackerCe?.id === 'ce_formal_craft') artsRefundScale *= 1.10;
          npRefund = Math.round(baseRefund * artsRefundScale);
          npStars = 2;
        } else {
          const baseStars = npScope === 'aoe' ? 20 : 14;
          const ocStarsBonus = isOvercharged ? (overchargeLevel >= 3 ? 15 : 10) : 0;
          npStars = Math.round((baseStars + ocStarsBonus) * (1.0 + quickBuff / 100));
          const baseRefund = npScope === 'aoe' ? 10 : 6;
          npRefund = Math.round(baseRefund * (1.0 + quickBuff / 100));
        }
      }

      // Expending NP: Reset gauge to the NP's refund amount
      attacker.npGauge = npRefund;
      totalNpGained += npRefund;
      totalStarsGained += npStars;
      // NP damage is handled separately in the flashy NP block.
    } else if (card === 'Buster') {
      if (attackerCe) {
        const ceLogs = processCeOnAttackEffects(attacker, defender, card);
        ceLogs.forEach((l: string) => chainTags.push(l));
      }
      const busterBuff = attacker.activeBuffs.filter(b => b.type === 'buster_up').reduce((s, b) => s + b.value, 0);
      let cardMult = 1.4 * posMult * (1.0 + (madnessBonus + busterBuff) / 100);
      if (i > 0 && isBusterFirst) cardMult += 0.50; // Buster Lead Bonus

      let critChance = Math.min(0.95, (starsForCrits * 2.0) / 100);
      if (i > 0 && isQuickFirst) critChance = Math.min(0.95, critChance + 0.20);

      const hitCrit = Math.random() < critChance;
      if (hitCrit) isAnyCrit = true;
      const critMult = hitCrit ? (1.75 * critDmgBonus) : 1.0;
      const variance = 0.95 + Math.random() * 0.10;

      const baseHit = (effectiveAtk * cardMult * 0.11) - (effectiveDef * 2) + busterChainBonusDmg;
      let hitDmg = Math.round(Math.max(350, baseHit) * classMult * critMult * variance * PVP_DAMAGE_MODIFIER) + flatDivinity;

      if (attackerCe?.id === 'ce_origin_bullet' && (defender.servant.template.servantClass === 'Caster' || (defender.servant.template.baseStats?.mana || 0) >= 12)) {
        hitDmg = Math.round(hitDmg * 1.35);
      }

      const hitProt = processHitProtection();
      if (hitProt.isProtected) {
        if (hitProt.type === 'anti_purge_defense') turnBlockedByAntiPurge = true;
        else if (hitProt.type === 'invincible') turnBlockedByInvincible = true;
        else turnBlockedByEvade = true;
        hitDmg = 0; // 0 DMG on Anti-Purge/Invincible/Evade
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
      if (attackerCe) {
        const ceLogs = processCeOnAttackEffects(attacker, defender, card);
        ceLogs.forEach((l: string) => chainTags.push(l));
      }
      const artsBuff = attacker.activeBuffs.filter(b => b.type === 'arts_up').reduce((s, b) => s + b.value, 0);
      let cardMult = 1.0 * posMult * (1.0 + (territoryBonus + artsBuff) / 100);
      if (i > 0 && isBusterFirst) cardMult += 0.50;

      let critChance = Math.min(0.85, (starsForCrits * 1.8) / 100);
      if (i > 0 && isQuickFirst) critChance = Math.min(0.95, critChance + 0.20);

      const hitCrit = Math.random() < critChance;
      if (hitCrit) isAnyCrit = true;
      const critMult = hitCrit ? (1.75 * critDmgBonus) : 1.0;
      const variance = 0.95 + Math.random() * 0.10;

      const baseHit = (effectiveAtk * cardMult * 0.11) - (effectiveDef * 2);
      let hitDmg = Math.round(Math.max(280, baseHit) * classMult * critMult * variance * PVP_DAMAGE_MODIFIER) + flatDivinity;

      if (attackerCe?.id === 'ce_origin_bullet' && (defender.servant.template.servantClass === 'Caster' || (defender.servant.template.baseStats?.mana || 0) >= 12)) {
        hitDmg = Math.round(hitDmg * 1.35);
      }

      const hitProt = processHitProtection();
      if (hitProt.isProtected) {
        if (hitProt.type === 'anti_purge_defense') turnBlockedByAntiPurge = true;
        else if (hitProt.type === 'invincible') turnBlockedByInvincible = true;
        else turnBlockedByEvade = true;
        hitDmg = 0; // 0 DMG on Anti-Purge/Invincible/Evade
      }

      // FGO Arts NP rule: 8-10 base NP gain scaled by position (1.0x/1.2x/1.4x), crit (1.5x), and Arts 1st Lead (+50%)
      const baseArtsNp = 8 + Math.floor(Math.random() * 3);
      let ceNpArtScale = 1.0;
      if (attackerCe?.id === 'ce_jeweled_sword') ceNpArtScale *= 1.15;
      if (attackerCe?.id === 'ce_formal_craft') ceNpArtScale *= 1.10;
      const totalAtkMana = (attacker.servant.template?.baseStats?.mana || 10) + (attacker.servant.allocatedStats?.mana || 0);
      const manaNpBonus = Math.min(0.35, (totalAtkMana / (totalAtkMana + 120)) * 0.35);
      let npGain = Math.round(baseArtsNp * posMult * npGenBonus * ceNpArtScale * (hitCrit ? 1.5 : 1.0) * (1.0 + (territoryBonus + artsBuff + Math.round(manaNpBonus * 100)) / 100));
      if (i > 0 && isArtsFirst) npGain = Math.round(npGain * 1.5); // Arts Lead Bonus

      attacker.npGauge = Math.min(300, attacker.npGauge + npGain);
      totalNpGained += npGain;

      // Arts stars: 1 star (2 on crit)
      const artsStars = hitCrit ? 2 : 1;
      totalStarsGained += artsStars;

      totalSeqDmg += hitDmg;
    } else if (card === 'Quick') {
      if (attackerCe) {
        const ceLogs = processCeOnAttackEffects(attacker, defender, card);
        ceLogs.forEach((l: string) => chainTags.push(l));
      }
      const quickBuff = attacker.activeBuffs.filter(b => b.type === 'quick_up').reduce((s, b) => s + b.value, 0);
      const quickResDown = (defender.activeBuffs || []).filter(b => b.type === 'quick_res_down').reduce((s, b) => s + b.value, 0);
      let cardMult = 0.85 * posMult * (1.0 + (ridingBonus + quickBuff + quickResDown) / 100);
      if (i > 0 && isBusterFirst) cardMult += 0.50;

      let critChance = Math.min(0.95, (starsForCrits * 2.2) / 100);
      if (i > 0 && isQuickFirst) critChance = Math.min(0.95, critChance + 0.20);

      const hitCrit = Math.random() < critChance;
      if (hitCrit) isAnyCrit = true;
      const critMult = hitCrit ? (1.75 * critDmgBonus) : 1.0;
      const variance = 0.95 + Math.random() * 0.10;

      const baseHit = (effectiveAtk * cardMult * 0.11) - (effectiveDef * 2);
      let hitDmg = Math.round(Math.max(220, baseHit) * classMult * critMult * variance * PVP_DAMAGE_MODIFIER) + flatDivinity;

      if (attackerCe?.id === 'ce_origin_bullet' && (defender.servant.template.servantClass === 'Caster' || (defender.servant.template.baseStats?.mana || 0) >= 12)) {
        hitDmg = Math.round(hitDmg * 1.35);
      }

      const hitProt = processHitProtection();
      if (hitProt.isProtected) {
        if (hitProt.type === 'anti_purge_defense') turnBlockedByAntiPurge = true;
        else if (hitProt.type === 'invincible') turnBlockedByInvincible = true;
        else turnBlockedByEvade = true;
        hitDmg = 0; // 0 DMG on Anti-Purge/Invincible/Evade
      }

      // Quick Curse Cleanse Buff (Soul of Water Channels EX)
      if (attacker.activeBuffs && attacker.activeBuffs.some(b => b.type === 'buff_on_quick_curse_cleanse')) {
        const curseIdx = attacker.activeBuffs.findIndex(b => b.type === 'curse');
        if (curseIdx !== -1) {
          attacker.activeBuffs.splice(curseIdx, 1);
          attacker.activeBuffs.push({
            name: 'Quick Cleanse (ATK Up +10%)',
            type: 'buff_atk',
            value: 10,
            remainingTurns: 3
          });
          atkBuff += 0.10;
          chainTags.push('🧹 Quick Curse Cleanse (+10% ATK)');
        }
      }

      // FGO Quick stars: 4-6 base stars scaled by position (1.0x/1.25x/1.5x), crit (1.4x), star gain buffs, and Quick 1st Lead (+30%)
      const starGainBuff = attacker.activeBuffs.filter(b => b.type === 'star_gain_up').reduce((s, b) => s + b.value, 0);
      const baseQuickStars = 4 + Math.floor(Math.random() * 3);
      let starsGained = Math.round(baseQuickStars * (1.0 + (i * 0.25)) * (hitCrit ? 1.4 : 1.0) * (1.0 + (ridingBonus + quickBuff + presenceConcealBonus + starGainBuff) / 100));
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
    let extraDmg = Math.max(450, Math.round(extraBase * classMult * (0.95 + Math.random() * 0.10) * PVP_DAMAGE_MODIFIER)) + flatDivinity;
    const extraProt = processHitProtection();
    if (extraProt.isProtected) {
      if (extraProt.type === 'anti_purge_defense') turnBlockedByAntiPurge = true;
      else if (extraProt.type === 'invincible') turnBlockedByInvincible = true;
      else turnBlockedByEvade = true;
      extraDmg = 0;
    }
    totalSeqDmg += extraDmg;
    const extraNp = isArtsFirst ? 5 : 3;
    attacker.npGauge = Math.min(300, attacker.npGauge + extraNp);
    totalNpGained += extraNp;
    const extraStars = 3 + (isQuickFirst ? 2 : 0) + (presenceConcealBonus > 0 ? 2 : 0);
    totalStarsGained += extraStars;
  }

  // Set the combatant's critical star pool for the upcoming turn based on hits + active turn-start star buffs
  const upcomingStarBuffs = attacker.activeBuffs.filter(b => b.type === 'stars_per_turn');
  const futureStarGen = upcomingStarBuffs.reduce((s, b) => s + b.value, 0);
  let nextTurnStars = totalStarsGained + futureStarGen;
  if (attackerCe && (attackerCe.id === 'ce_fragment_2030' || attackerCe.passiveType === 'stars_per_turn')) {
    nextTurnStars += (attackerCe.passiveValue || 10);
  }
  attacker.critStars = Math.min(50, nextTurnStars);

  if (totalSeqDmg === 0) {
    if (turnBlockedByAntiPurge) {
      chainTags.push('👑 Absorbed by Anti-Purge Defense');
    } else if (turnBlockedByInvincible) {
      chainTags.push('✨ Absorbed by Invincibility');
    } else if (turnBlockedByEvade) {
      chainTags.push('💨 Evaded');
    }
  }

  // Apply Damage Cut
  const cutBuffs = defender.activeBuffs.filter(b => b.type === 'damage_cut');
  const totalCut = cutBuffs.reduce((s, b) => s + b.value, 0);
  if (totalCut > 0 && totalSeqDmg > 0) {
    const actualCut = Math.min(totalSeqDmg, totalCut);
    totalSeqDmg = Math.max(0, totalSeqDmg - actualCut);
    chainTags.push(`🛡️ Damage Cut (-${actualCut.toLocaleString()} DMG)`);
  }

  // Veteran of the Slums EX Check (Bond 5 Passive)
  const hasDefSlums = (defenderPassives.some(p => p.type === 'veteran_of_the_slums' || (p.name && p.name.includes('Veteran of the Slums'))) ||
    (defender.passives && defender.passives.some(p => p.type === 'veteran_of_the_slums' || (p.name && p.name.includes('Veteran of the Slums'))))) &&
    !(defender as any).isSlumVeteranTriggered;
  if (hasDefSlums && (defender.currentHp <= Math.round(defender.maxHp * 0.25) || (defender.currentHp - totalSeqDmg) <= 0)) {
    (defender as any).isSlumVeteranTriggered = true;
    defender.activeBuffs.push({
      name: 'Veteran of the Slums EX (Guts)',
      type: 'guts',
      value: 3000,
      remainingTurns: 99,
      remainingHits: 1,
      isHitCount: true
    });
    chainTags.push(`🧣 Veteran of the Slums EX (Granted Guts 3,000 HP)`);
  }

  // Apply total damage to defender
  defender.currentHp = Math.max(0, defender.currentHp - totalSeqDmg);

  // Filter out consumed hit-based Evade/Invincibility and mark defended turn
  defender.activeBuffs = defender.activeBuffs.map(b => {
    const isDefensive = b.type === 'evade' || b.type === 'invincible' || b.type === 'anti_purge_defense' || b.type === 'anti_purge';
    if (isDefensive) {
      return { ...b, hasDefendedOnce: true };
    }
    return b;
  }).filter(b => {
    const isHitBased = b.isHitCount || b.remainingHits !== undefined || /volumen|protection from arrows/i.test(b.name);
    if (isHitBased) {
      return b.remainingHits === undefined || b.remainingHits > 0;
    }
    return b.remainingTurns > 0;
  });
  defender.isEvading = defender.activeBuffs.some(b => b.type === 'evade');
  defender.isInvincible = defender.activeBuffs.some(b => b.type === 'invincible');
  defender.isAntiPurgeDefense = defender.activeBuffs.some(b => b.type === 'anti_purge_defense' || b.type === 'anti_purge');
  defender.isStunned = defender.activeBuffs.some(b => b.type === 'stun');

  // Decrement attacker offensive, utility, and special buffs after completing turn (defensive buffs persist for incoming strikes)
  attacker.activeBuffs = attacker.activeBuffs.filter(b => {
    const isDefensive = b.type === 'evade' || b.type === 'invincible' || b.type === 'anti_purge_defense' || b.type === 'anti_purge' || b.type === 'guts' || b.type === 'damage_cut';
    const isHitBased = b.isHitCount || b.remainingHits !== undefined || /volumen|protection from arrows/i.test(b.name);
    if (isHitBased) {
      return b.remainingHits === undefined || b.remainingHits > 0;
    }
    if (isDefensive) {
      return b.remainingTurns === undefined || b.remainingTurns > 0;
    }
    if (b.remainingTurns !== undefined && b.remainingTurns > 0 && b.remainingTurns < 90) {
      b.remainingTurns--;
      return b.remainingTurns > 0;
    }
    return true;
  });
  attacker.isEvading = attacker.activeBuffs.some(b => b.type === 'evade');
  attacker.isInvincible = attacker.activeBuffs.some(b => b.type === 'invincible');
  attacker.isAntiPurgeDefense = attacker.activeBuffs.some(b => b.type === 'anti_purge_defense' || b.type === 'anti_purge');

  // Decrement transformation duration and revert if expired
  let revertText = '';
  if (attacker.isTransformed && attacker.transformationTurns !== undefined) {
    attacker.transformationTurns--;
    if (attacker.transformationTurns <= 0) {
      attacker.isTransformed = false;
      attacker.transformationTurns = 0;
      const artInfo = getServantAvatarAndCardArt(attacker.servant);
      attacker.avatarUrl = attacker.baseAvatarUrl || artInfo.cardArtUrl || artInfo.avatarUrl;
      revertText = `\n✨ **[Fifth Magic: Cooldown]** Transformation ended — ${attacker.servant.template.name} returned to base form.`;
    }
  }

  // Defender Avenger Passive: NP refund on taking damage
  let avengerLog = '';
  if (avengerBonus > 0 && totalSeqDmg > 0) {
    const avengerRefund = Math.round(12 * (1.0 + avengerBonus / 100));
    defender.npGauge = Math.min(300, defender.npGauge + avengerRefund);
    avengerLog = `\n🖤 **[Avenger]** ${defender.servant.template.name} gained **+${avengerRefund}% NP** from suffering damage!`;
  }

  // Check for Guts (Battle Continuation / Castle of Snow / Absolute Permanence / Indomitable A)
  let gutsText = '';
  const gutsBuffIndex = defender.activeBuffs.findIndex(b => b.type === 'guts');
  const hasDefPermanence = (defenderPassives.some(p => p.type === 'absolute_permanence' || (p.name && p.name.includes('Absolute Permanence'))) ||
    (defender.passives && defender.passives.some(p => p.type === 'absolute_permanence' || (p.name && p.name.includes('Absolute Permanence'))))) &&
    !(defender as any).isPermanenceTriggered;

  if (defender.currentHp <= 0 && (defender.gutsCount > 0 || gutsBuffIndex !== -1 || hasDefPermanence)) {
    let reviveHp = Math.round(defender.maxHp * 0.25);
    if (gutsBuffIndex !== -1) {
      const gutsBuff = defender.activeBuffs[gutsBuffIndex];
      if (gutsBuff.value) reviveHp = gutsBuff.value;
      if (gutsBuff.remainingHits !== undefined && gutsBuff.remainingHits > 1) {
        gutsBuff.remainingHits -= 1;
        gutsText = `\n✝️ **BATTLE CONTINUATION!** ${defender.servant.template.name} revived with **${reviveHp.toLocaleString()} HP**! (${gutsBuff.name} - ${gutsBuff.remainingHits} charge(s) remaining)`;
      } else {
        defender.activeBuffs.splice(gutsBuffIndex, 1);
        if (gutsBuff.name?.includes('Absolute Permanence')) {
          (defender as any).isPermanenceTriggered = true;
          gutsText = `\n✨ **[ABSOLUTE PERMANENCE]** Concept Nullification rejected lethal erasure! ${defender.servant.template.name} revived with **${reviveHp.toLocaleString()} HP**!`;
        } else {
          gutsText = `\n✝️ **BATTLE CONTINUATION!** ${defender.servant.template.name} revived with **${reviveHp.toLocaleString()} HP**! (${gutsBuff.name} consumed)`;
        }
      }
      if (defender.gutsCount > 0) {
        defender.gutsCount--;
      }
    } else if (hasDefPermanence) {
      (defender as any).isPermanenceTriggered = true;
      gutsText = `\n✨ **[ABSOLUTE PERMANENCE]** Concept Nullification rejected lethal erasure! ${defender.servant.template.name} revived with **${reviveHp.toLocaleString()} HP**!`;
    } else {
      if (defender.gutsCount > 0) defender.gutsCount--;
      gutsText = `\n✝️ **BATTLE CONTINUATION!** ${defender.servant.template.name} revived with **${reviveHp.toLocaleString()} HP**!`;
    }
    defender.currentHp = reviveHp;

    // Check On-Guts Buster Up buff (Indomitable A)
    const onGutsIndex = defender.activeBuffs.findIndex(b => (b.type as any) === 'on_guts_buster');
    if (onGutsIndex !== -1) {
      const ogBuff = defender.activeBuffs[onGutsIndex];
      defender.activeBuffs.splice(onGutsIndex, 1);
      defender.activeBuffs.push({
        name: 'Indomitable A: On-Guts Buster Up (+20%)',
        type: 'buster_up',
        value: ogBuff.value || 20,
        remainingTurns: 5
      });
      gutsText += `\n🔥 **[INDOMITABLE A]** On-Guts activated! Buster Performance increased by +20% for 5 turns!`;
    }
  }

  const critTag = isAnyCrit ? ' 💥 **CRITICAL HIT!**' : '';
  const evadeTag = (totalSeqDmg === 0 && turnBlockedByInvincible)
    ? ' 🛡️ **(Invincible - 0 DMG!)**'
    : (totalSeqDmg === 0 && turnBlockedByEvade)
    ? ' 💨 **(Evaded - 0 DMG!)**'
    : turnBlockedByInvincible
    ? ' 🛡️ **(Invincible Broke • Hits Absorbed)**'
    : turnBlockedByEvade
    ? ' 💨 **(Evade Broke • Hits Evaded)**'
    : '';
  const npHeader = hasNpHit ? ' 💥 **NOBLE PHANTASM UNLEASHED!**' : '';
  const chainStr = chainTags.length > 0 ? `\n⛓️ **Chains:** ${chainTags.join(' • ')}` : '';

  const seqNames = cardsSequence.join(' -> ');
  const dInfo = dialogue || getCombatantChainDialogue(attacker, cardsSequence);
  const quoteLine = dInfo.quote ? `\n💬 *“${dInfo.quote}”*` : '';

  const grandTotalDamage = totalSeqDmg + (hasNpHit ? totalNpDmgVal : 0);

  const dmgLine = hasNpHit
    ? `• Dealt **${grandTotalDamage.toLocaleString()} DMG** to target team *(Breakdown: ${totalNpDmgVal.toLocaleString()} NP DMG • ${totalSeqDmg.toLocaleString()} Chain Cards DMG)*\n`
    : `• Dealt **${grandTotalDamage.toLocaleString()} DMG** to ${defender.servant.template.name}\n`;

  const logText = `⚔️ **${attacker.servant.template.name}** executed sequence **[${seqNames}]**${npHeader}${critTag}${evadeTag}:${quoteLine}\n` +
    npLogBlock + (npLogBlock ? '\n' : '') +
    dmgLine +
    `• Gained **+${totalNpGained}% NP** & **+${totalStarsGained} Critical Stars**${chainStr}${gutsText}${avengerLog}${revertText}`;

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
        flags: MessageFlags.Ephemeral,
        content: '❌ You are a civilian without a contracted Servant! Civilians cannot initiate duels in the Holy Grail War. Invoke `/summon` to contract a Heroic Spirit first.'
      });
      return;
    }

    const warSession = getOrInitWarSession(challengerMaster);
    const rawMode = interaction.options.getString('mode');
    const isExplicitFree = interaction.options.getBoolean('free') === true;

    const opponentUser = interaction.options.getUser('opponent');
    const allyUser = interaction.options.getUser('ally');
    const opponent2User = interaction.options.getUser('opponent2');

    // Check if challenger is enrolled and alive in the active Holy Grail War
    const challengerParticipant = warSession.participants[challengerMaster.discordId] ||
      Object.values(warSession.participants).find(p => p.username.toLowerCase() === challengerMaster.username.toLowerCase());

    const isChallengerInWar = challengerMaster.environmentMode === 'war' && !!challengerParticipant && challengerParticipant.isAlive;
    const isChallengerInSafeMode = !isChallengerInWar;

    // Determine if this is a Free Battle (Safe Mode / Sparring)
    const isFreeBattle =
      isExplicitFree ||
      rawMode === 'free' ||
      rawMode === 'free_1v2' ||
      rawMode === 'free_2v2' ||
      isChallengerInSafeMode;

    // Determine combat mode (1v1, 1v2, 2v2, forcejoin)
    let mode: '1v1' | '1v2' | '2v2' | 'forcejoin' = '1v1';
    if (rawMode === 'forcejoin') {
      mode = 'forcejoin';
    } else if (rawMode === '1v2' || rawMode === 'free_1v2' || (opponent2User && !allyUser)) {
      mode = '1v2';
    } else if (rawMode === '2v2' || rawMode === 'free_2v2' || (opponent2User && allyUser)) {
      mode = '2v2';
    } else {
      mode = '1v1';
    }

    // Check if challenger is eliminated from the Holy Grail War tournament (only relevant in War battles)
    if (!isFreeBattle && challengerParticipant && !challengerParticipant.isAlive) {
      const deadEmbed = new EmbedBuilder()
        .setTitle('☠️ ELIMINATED FROM WAR BRACKET')
        .setDescription(
          `Master **${challengerMaster.username}**, you were defeated in this Holy Grail War season.\n\n` +
          `• **🕊️ Free Battles Available:** You can still engage in friendly duels without elimination risks using \`/duel mode:free\` or \`/duel mode:free_1v2\`!\n` +
          `• **🔄 Restart Tournament:** Or start a fresh war tournament with \`/grailwar reset\` to fight for the Grail anew.`
        )
        .setColor(0xef4444);

      await interaction.reply({ embeds: [deadEmbed], flags: MessageFlags.Ephemeral });
      return;
    }

    const challengerServant =
      challengerMaster.servants.find(s => s.id === challengerMaster.activeServantId) ||
      challengerMaster.servants[0];

    if (mode === 'forcejoin') {
      await interaction.reply({
        content: '⚡ **Force Join Active Duel:** To force join an ongoing Holy Grail War duel, click the **⚡ Force Join Arena** button located directly on any active battle message in the channel!',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // BRANCH 0: 2v2 ALLIANCE TAG-TEAM OR 1v2 RAID MODE
    if (mode === '2v2' || mode === '1v2') {
      const is2v2 = mode === '2v2';

      if (is2v2) {
        if (!allyUser || !opponentUser || !opponent2User) {
          await interaction.reply({
            content: '❌ **2v2 Alliance Tag-Team requires 4 real Masters!**\nPlease specify all participants using the command options:\n• `ally`: your allied partner (@Master)\n• `opponent`: 1st rival Master (@Master)\n• `opponent2`: 2nd rival Master (@Master)',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (allyUser.bot || opponentUser.bot || opponent2User.bot) {
          await interaction.reply({
            content: '❌ **Bots cannot participate in Holy Grail War duels!** All combatants must be real Discord Masters.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const distinctUsers = new Set([interaction.user.id, allyUser.id, opponentUser.id, opponent2User.id]);
        if (distinctUsers.size !== 4) {
          await interaction.reply({
            content: '❌ **All 4 participants in a 2v2 Tag-Team duel must be distinct Masters!** You cannot invite yourself or select the same Master more than once.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }
      } else {
        // 1v2 Raid Survival: 1 solo Challenger vs 2 Opponents
        if (!opponentUser || !opponent2User) {
          await interaction.reply({
            content: '❌ **1v2 Raid Survival requires 2 real rival Masters to face!**\nPlease specify both opponents using the command options:\n• `opponent`: 1st rival Master (@Master)\n• `opponent2`: 2nd rival Master (@Master)',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (opponentUser.bot || opponent2User.bot) {
          await interaction.reply({
            content: '❌ **Bots cannot participate in Holy Grail War duels!** All combatants must be real Discord Masters.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (opponentUser.id === interaction.user.id || opponent2User.id === interaction.user.id || opponentUser.id === opponent2User.id) {
          await interaction.reply({
            content: '❌ **All 3 participants in a 1v2 Raid duel must be distinct Masters!** You cannot duel yourself or select the same opponent twice.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }
      }

      // Check participants' deceased status in current Grail War session (bypassed in Free Battle)
      const checkDeceased = (uid: string) => {
        if (isFreeBattle) return false;
        const part = warSession.participants[uid];
        return part && !part.isAlive;
      };

      if (checkDeceased(opponentUser.id)) {
        await interaction.reply({ content: `☠️ Master <@${opponentUser.id}> has already been slain in this Holy Grail War! You can duel them in Free Battle mode using \`/duel mode:free_1v2\`.`, flags: MessageFlags.Ephemeral });
        return;
      }
      if (checkDeceased(opponent2User.id)) {
        await interaction.reply({ content: `☠️ Master <@${opponent2User.id}> has already been slain in this Holy Grail War! You can duel them in Free Battle mode using \`/duel mode:free_1v2\`.`, flags: MessageFlags.Ephemeral });
        return;
      }
      if (is2v2 && allyUser && checkDeceased(allyUser.id)) {
        await interaction.reply({ content: `☠️ Master <@${allyUser.id}> has already been slain in this Holy Grail War! You can duel in Free Battle mode using \`/duel mode:free_2v2\`.`, flags: MessageFlags.Ephemeral });
        return;
      }

      // Resolve profiles and servants
      const opponentMaster = await getOrCreateMaster(opponentUser.id, opponentUser.username);
      const opponentServant = opponentMaster.servants?.find(s => s.id === opponentMaster.activeServantId) || opponentMaster.servants?.[0];
      if (!opponentServant) {
        await interaction.reply({
          content: `❌ Rival Master <@${opponentUser.id}> has not summoned a Servant yet! All participants must have an active Servant.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const p2AllyMaster = await getOrCreateMaster(opponent2User.id, opponent2User.username);
      const opp2Servant = p2AllyMaster.servants?.find(s => s.id === p2AllyMaster.activeServantId) || p2AllyMaster.servants?.[0];
      if (!opp2Servant) {
        await interaction.reply({
          content: `❌ Rival Master <@${opponent2User.id}> has not summoned a Servant yet! All participants must have an active Servant.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      let p1AllyMaster: MasterProfile | null = null;
      let p1Ally: DuelCombatant | undefined = undefined;

      if (is2v2 && allyUser) {
        const allyMaster = await getOrCreateMaster(allyUser.id, allyUser.username);
        p1AllyMaster = allyMaster;
        const allyServant = allyMaster.servants?.find(s => s.id === allyMaster.activeServantId) || allyMaster.servants?.[0];
        if (!allyServant) {
          await interaction.reply({
            content: `❌ Allied Master <@${allyUser.id}> has not summoned a Servant yet! All participants must have an active Servant.`,
            flags: MessageFlags.Ephemeral
          });
          return;
        }
        const allyPart = warSession.participants[allyMaster.discordId];
        const allyHp = (isFreeBattle || allyMaster.environmentMode === 'safe') ? undefined : (allyPart ? calculateCurrentHp(allyPart) : undefined);
        p1Ally = createCombatant(allyMaster, allyServant, false, allyHp, isFreeBattle);
      }

      const p1Part = warSession.participants[challengerMaster.discordId];
      const p1Hp = (isFreeBattle || challengerMaster.environmentMode === 'safe') ? undefined : (p1Part ? calculateCurrentHp(p1Part) : undefined);
      const p1 = createCombatant(challengerMaster, challengerServant, false, p1Hp, isFreeBattle);

      const p2Part = warSession.participants[opponentMaster.discordId];
      const p2Hp = (isFreeBattle || opponentMaster.environmentMode === 'safe') ? undefined : (p2Part ? calculateCurrentHp(p2Part) : undefined);
      const p2 = createCombatant(opponentMaster, opponentServant, false, p2Hp, isFreeBattle);

      const opp2Part = warSession.participants[p2AllyMaster.discordId];
      const opp2Hp = (isFreeBattle || p2AllyMaster.environmentMode === 'safe') ? undefined : (opp2Part ? calculateCurrentHp(opp2Part) : undefined);
      const p2Ally = createCombatant(p2AllyMaster, opp2Servant, false, opp2Hp, isFreeBattle);

      if (is2v2) {
        p1.critStars = 25;
        p1.activeBuffs = p1.activeBuffs || [];
        p1.activeBuffs.push({
          name: '2v2 Alliance Formation',
          type: 'buff_atk',
          value: 15,
          remainingTurns: 3
        });
      } else {
        // 1v2 Raid Survival solo challenger bonus
        p1.critStars = 30;
        p1.activeBuffs = p1.activeBuffs || [];
        p1.activeBuffs.push({
          name: '1v2 Raid Fortitude',
          type: 'buff_atk',
          value: 20,
          remainingTurns: 3
        });
      }

      // Collect required human confirmations
      const invitedHumans = new Map<string, { user: User; role: string; accepted: boolean }>();
      invitedHumans.set(opponentUser.id, { user: opponentUser, role: is2v2 ? 'Primary Opponent (Team 2)' : '1st Rival Master', accepted: false });
      invitedHumans.set(opponent2User.id, { user: opponent2User, role: is2v2 ? 'Secondary Opponent (Team 2)' : '2nd Rival Master', accepted: false });
      if (is2v2 && allyUser) {
        invitedHumans.set(allyUser.id, { user: allyUser, role: 'Allied Master (Team 1)', accepted: false });
      }

      const matchHeading = isFreeBattle
        ? (is2v2 ? '🕊️ FREE BATTLE: 2v2 ALLIANCE SPARRING' : '🕊️ FREE BATTLE: 1v2 RAID SPARRING')
        : (is2v2 ? '⚔️ HOLY GRAIL WAR: 2v2 TAG-TEAM CLASH' : '⚔️ HOLY GRAIL WAR: 1v2 RAID SURVIVAL');

      const matchFormatDesc = isFreeBattle
        ? `• **Format:** 🕊️ Free Battle / Safe Mode *(Zero elimination risk, intact Command Seals & friendly sparring rewards)*`
        : `• **Format:** ⚔️ Holy Grail War Tournament *(Ranked stakes, Command Seal survival & full War rewards)*`;

      // Send multi-master invitation prompt requiring confirmation from all challenged human masters
      const inviteEmbed = new EmbedBuilder()
        .setTitle(matchHeading)
        .setDescription(
          `Master <@${interaction.user.id}> has issued a **${is2v2 ? '2v2 Tag-Team' : '1v2 Raid'}** challenge!\n\n` +
          `🛡️ **Team 1:** <@${interaction.user.id}> (**${p1.servant.template?.name || 'Servant'}**) ${p1AllyMaster && p1Ally ? `& <@${p1AllyMaster.discordId}> (**${p1Ally.servant.template?.name || 'Servant'}**)` : ''}\n` +
          `⚔️ **Team 2:** <@${opponentMaster.discordId}> (**${p2.servant.template?.name || 'Servant'}**) & <@${p2AllyMaster.discordId}> (**${p2Ally.servant.template?.name || 'Servant'}**)\n\n` +
          `${matchFormatDesc}\n\n` +
          `📜 **Challenge Confirmation Status:**\n` +
          `• <@${interaction.user.id}> (Challenger): ✅ **Initiator**\n` +
          `• ${[...invitedHumans.values()].map(h => `<@${h.user.id}> (${h.role}): ⏳ **Pending Confirmation**`).join('\n• ')}\n\n` +
          `*All challenged Masters must accept to enter the arena!*`
        )
        .setColor(isFreeBattle ? 0x38bdf8 : 0xd4af37)
        .setFooter({ text: `Holy Grail War • ${isFreeBattle ? 'Friendly Sparring Arena' : 'Ranked Tournament Match'}` });

      const inviteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('accept_2v2_duel')
          .setLabel('Accept Challenge')
          .setEmoji('⚔️')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('decline_2v2_duel')
          .setLabel('Decline')
          .setEmoji('🏳️')
          .setStyle(ButtonStyle.Danger)
      );

      const pingContent = [...invitedHumans.keys()].map(id => `<@${id}>`).join(' ');

      const inviteMsg = await interaction.reply({
        content: `⚔️ **Attention Masters:** ${pingContent}`,
        embeds: [inviteEmbed],
        components: [inviteRow],
        withResponse: true
      }).then(r => r.resource?.message || interaction.fetchReply());

      const inviteCollector = inviteMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000 // 5 minutes
      });

      inviteCollector.on('collect', async i => {
        try {
          if (i.replied || i.deferred) return;

          if (i.customId === 'decline_2v2_duel') {
            if (!invitedHumans.has(i.user.id) && i.user.id !== interaction.user.id) {
              await i.reply({ content: '❌ You are not involved in this duel challenge.', flags: MessageFlags.Ephemeral });
              return;
            }
            inviteCollector.stop('declined');
            await i.update({
              content: `🏳️ Duel challenge declined by <@${i.user.id}>.`,
              embeds: [],
              components: []
            });
            return;
          }

          if (i.customId === 'accept_2v2_duel') {
            if (!invitedHumans.has(i.user.id)) {
              await i.reply({
                content: '❌ You are not one of the challenged Masters in this duel invitation.',
                flags: MessageFlags.Ephemeral
              });
              return;
            }

            const humanEntry = invitedHumans.get(i.user.id)!;
            if (humanEntry.accepted) {
              await i.reply({ content: '✅ You have already accepted this challenge!', flags: MessageFlags.Ephemeral });
              return;
            }

            humanEntry.accepted = true;
            const allAccepted = [...invitedHumans.values()].every(h => h.accepted);

            if (!allAccepted) {
              await i.deferUpdate();
              const updatedStatusText = [...invitedHumans.values()]
                .map(h => `<@${h.user.id}> (${h.role}): ${h.accepted ? '✅ **Accepted**' : '⏳ **Pending Confirmation**'}`)
                .join('\n• ');

              const updatedEmbed = EmbedBuilder.from(inviteEmbed)
                .setDescription(
                  `Master <@${interaction.user.id}> has issued a **${is2v2 ? '2v2 Tag-Team' : '1v2 Raid'}** challenge!\n\n` +
                  `🛡️ **Team 1:** <@${interaction.user.id}> (**${p1.servant.template?.name || 'Servant'}**) ${p1AllyMaster && p1Ally ? `& <@${p1AllyMaster.discordId}> (**${p1Ally.servant.template?.name || 'Servant'}**)` : ''}\n` +
                  `⚔️ **Team 2:** <@${opponentMaster.discordId}> (**${p2.servant.template?.name || 'Servant'}**) & <@${p2AllyMaster.discordId}> (**${p2Ally.servant.template?.name || 'Servant'}**)\n\n` +
                  `📜 **Challenge Confirmation Status:**\n` +
                  `• <@${interaction.user.id}> (Challenger): ✅ **Initiator**\n` +
                  `• ${updatedStatusText}\n\n` +
                  `*Awaiting remaining challenged Masters...*`
                );

              await i.editReply({ embeds: [updatedEmbed] });
            } else {
              inviteCollector.stop('accepted');
              await i.deferUpdate();

              const startingEmbed = EmbedBuilder.from(inviteEmbed)
                .setTitle(`⚔️ ALL MASTERS ACCEPTED — ENTERING ARENA...`)
                .setDescription(`⚔️ All challenged Masters have accepted the duel! Preparing battle arena canvas...`)
                .setColor(0x22c55e);

              await i.editReply({ embeds: [startingEmbed], components: [] });

              await startInteractiveDuel(
                i,
                p1,
                p2,
                challengerMaster,
                opponentMaster,
                p1Ally,
                p2Ally,
                p1AllyMaster,
                p2AllyMaster,
                isFreeBattle
              );
            }
          }
        } catch (err: any) {
          if (err.code === 10062 || err.code === 40060 || err.message?.includes('Unknown interaction')) return;
          console.error('Error in 2v2 inviteCollector:', err);
        }
      });

      inviteCollector.on('end', async (_collected, reason) => {
        if (reason !== 'accepted' && reason !== 'declined') {
          try {
            const expiredEmbed = EmbedBuilder.from(inviteEmbed)
              .setColor(0x64748b)
              .setFooter({ text: 'Holy Grail War • Duel invitation expired (5 min timeout)' });
            await interaction.editReply({
              embeds: [expiredEmbed],
              components: []
            });
          } catch {}
        }
      });

      return;
    }

    // BRANCH 1: CHALLENGING A SPECIFIC HUMAN MASTER BY MENTION
    if (opponentUser) {
      if (opponentUser.id === interaction.user.id) {
        await interaction.reply({ content: '❌ You cannot duel yourself!', flags: MessageFlags.Ephemeral });
        return;
      }
      if (opponentUser.bot) {
        await interaction.reply({ content: '❌ You cannot duel a Discord bot! Holy Grail War only features real Masters.', flags: MessageFlags.Ephemeral });
        return;
      }

      const opponentMaster = await getOrCreateMaster(opponentUser.id, opponentUser.username);
      const isOpponentCivilian = !opponentMaster.servants || opponentMaster.servants.length === 0;

      const opponentParticipant = warSession.participants[opponentUser.id] ||
        Object.values(warSession.participants).find(p => p.username.toLowerCase() === opponentUser.username.toLowerCase());

      const isOpponentInWar = opponentMaster.environmentMode === 'war' && !!opponentParticipant && opponentParticipant.isAlive;

      // In Free Battle: Opponent must have a contracted Servant
      if (isFreeBattle) {
        if (isOpponentCivilian) {
          await interaction.reply({
            content: `❌ <@${opponentUser.id}> is a civilian without a contracted Servant and cannot participate in Free Battles!`,
            flags: MessageFlags.Ephemeral
          });
          return;
        }
      } else {
        // In War Duel: Opponent cannot be in Safe Mode (unless civilian collateral)
        if (!isOpponentInWar && !isOpponentCivilian) {
          await interaction.reply({
            content: `❌ Master <@${opponentUser.id}> is currently in Safe Mode outside of the Holy Grail War! Safe Mode Masters can only be dueled in Free Battle mode using \`/duel mode:free opponent:@${opponentUser.username}\`.`,
            flags: MessageFlags.Ephemeral
          });
          return;
        }
      }

      if (!isFreeBattle && opponentParticipant && !opponentParticipant.isAlive) {
        await interaction.reply({
          content: `☠️ Master <@${opponentUser.id}> was eliminated from this Holy Grail War season! You can battle them in Free Battle mode using \`/duel mode:free opponent:@${opponentUser.username}\`.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (isOpponentCivilian && !isFreeBattle) {
        const alreadySlainCivilian = (warSession.civilianCasualties || []).find(
          c => c.id === opponentUser.id || c.name.toLowerCase().includes(opponentUser.username.toLowerCase())
        );
        if (alreadySlainCivilian) {
          await interaction.reply({
            content: `☠️ Civilian <@${opponentUser.id}> was already slain earlier in this Holy Grail War! A civilian cannot be killed twice in the tournament.`,
            flags: MessageFlags.Ephemeral
          });
          return;
        }
      }

      const opponentServant = isOpponentCivilian
        ? null
        : (opponentMaster.servants.find(s => s.id === opponentMaster.activeServantId) || opponentMaster.servants[0]);

      const inviteEmbed = new EmbedBuilder()
        .setTitle('⚔️ HOLY GRAIL WAR: DUEL INVITATION')
        .setDescription(
          `Master <@${interaction.user.id}> has challenged ${isOpponentCivilian ? 'civilian' : 'Master'} <@${opponentUser.id}> to a battle!\n\n` +
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
        time: 300000 // 5 minutes to accept/decline
      });

      inviteCollector.on('collect', async i => {
        try {
          if (i.replied || i.deferred) return;

          if (i.customId === 'decline_duel') {
            if (i.user.id !== opponentUser.id && i.user.id !== interaction.user.id) {
              await i.reply({ content: '❌ You are not involved in this duel challenge.', flags: MessageFlags.Ephemeral });
              return;
            }
            inviteCollector.stop('declined');
            await i.update({
              content: `🏳️ Duel declined by <@${i.user.id}>.`,
              embeds: [],
              components: []
            });
            return;
          }

          if (i.customId === 'accept_duel') {
            if (i.user.id !== opponentUser.id) {
              await i.reply({
                content: `❌ Only the challenged ${isOpponentCivilian ? 'civilian' : 'Master'} (<@${opponentUser.id}>) can accept this duel invitation.`,
                flags: MessageFlags.Ephemeral
              });
              return;
            }

            inviteCollector.stop('accepted');
            // Acknowledge the button immediately so Discord never shows "This interaction failed"
            await i.deferUpdate();

            if (isOpponentCivilian || !opponentServant) {
              const alreadyDead = (warSession.civilianCasualties || []).some(
                c => c.id === opponentUser.id || c.name.toLowerCase().includes(opponentUser.username.toLowerCase())
              );
              if (alreadyDead) {
                await i.editReply({
                  content: `☠️ Civilian <@${opponentUser.id}> was already slain earlier in this Holy Grail War! A civilian cannot be killed twice.`,
                  embeds: [],
                  components: []
                });
                return;
              }

              const pEntry = warSession.participants[opponentUser.id] || {
                discordId: opponentUser.id,
                username: opponentUser.username,
                servantId: 'none',
                servantName: 'Civilian',
                servantClass: 'Civilian' as any,
                avatarUrl: opponentUser.displayAvatarURL?.() || '',
                maxHp: 100,
                currentHp: 0,
                commandSeals: 0,
                kills: 0,
                isAlive: false
              };
              pEntry.isAlive = false;
              pEntry.currentHp = 0;
              pEntry.deathTimestamp = Date.now();
              pEntry.killedByMaster = challengerMaster.username;
              warSession.participants[opponentUser.id] = pEntry;

              if (!warSession.civilianCasualties) warSession.civilianCasualties = [];
              warSession.civilianCasualties.unshift({
                id: opponentUser.id,
                name: `@${opponentUser.username}`,
                slainByMasterId: challengerMaster.discordId,
                timestamp: Date.now(),
                cause: 'duel_civilian_execution'
              });

              challengerMaster.innocentKills = (challengerMaster.innocentKills || 0) + 1;
              const rep = getReputationInfo(challengerMaster.innocentKills);
              challengerMaster.reputationRank = rep.rank;
              challengerMaster.bountyActive = rep.bountyActive;
              challengerMaster.bountyRewardSq = rep.bountyRewardSq;
              challengerMaster.isRogueHeretic = rep.isRogue;

              const challengerParticipant = warSession.participants[challengerMaster.discordId];
              if (challengerParticipant) {
                challengerParticipant.innocentKills = challengerMaster.innocentKills;
                challengerParticipant.reputationRank = rep.rank;
                challengerParticipant.bountyActive = rep.bountyActive;
                challengerParticipant.isRogueHeretic = rep.isRogue;
                if (rep.isRogue) {
                  challengerParticipant.isExposed = true;
                  challengerParticipant.exposureReason = 'heretic_bounty';
                  challengerParticipant.inSanctuary = false;
                  (challengerParticipant as any).inChurchSanctuary = false;
                }
              }

              challengerMaster.duelsWon = (challengerMaster.duelsWon || 0) + 1;
              challengerMaster.servantKills = (challengerMaster.servantKills || 0) + 1;
              challengerMaster.saintQuartz = (challengerMaster.saintQuartz || 0) + 3;
              if (challengerServant) {
                challengerServant.experience = (challengerServant.experience || 0) + 300;
              }
              await saveMaster(challengerMaster);

              opponentMaster.duelsLost = (opponentMaster.duelsLost || 0) + 1;
              await saveMaster(opponentMaster);

              const sName = challengerServant?.template?.name || 'Heroic Spirit';

              let repNotice = '';
              if (challengerMaster.innocentKills === 10) {
                repNotice = `\n\n📜 **CHURCH ORDER OF EXTERMINATION & BOUNTY ISSUED!**\n` +
                  `> *"By decree of Father Kotomine: Master <@${challengerMaster.discordId}> has reached 10 civilian kills! They are hereby excommunicated and branded a **Rogue Heretic**."*\n\n` +
                  `• 🎯 **Open Server Bounty:** **+1 Extra Command Seal** & **+15 Saint Quartz** to any Master who eliminates them!\n` +
                  `• 🚫 **Church Sanctuary:** Permanently revoked.\n` +
                  `• ⛓️ **Curse of Heresy:** Servant suffers -10% ATK suppression in all combat.`;
              } else if (challengerMaster.innocentKills > 10) {
                repNotice = `\n\n☠️ **WANTED ROGUE HERETIC:** Active Bounty: +1 Command Seal & +15 Saint Quartz! Barred from Church sanctuary.`;
              } else if (challengerMaster.innocentKills >= 7) {
                repNotice = `\n\n🩸 **NOTORIOUS MAGUS (${challengerMaster.innocentKills}/10 Kills):** The Holy Church has placed you under heavy surveillance. Reaching 10 civilian kills activates a Rogue Heretic Bounty!`;
              } else if (challengerMaster.innocentKills >= 4) {
                repNotice = `\n\n⚠️ **SUSPECT MAGUS (${challengerMaster.innocentKills}/10 Kills):** The Holy Church notes your disregard for the Secrecy of Magecraft.`;
              }

              const civilianKilledEmbed = new EmbedBuilder()
                .setTitle('☠️ CIVILIAN SLAIN WITHOUT A FIGHT')
                .setDescription(
                  `Civilian <@${opponentUser.id}> (**${opponentUser.username}**) accepted the duel invitation without a contracted Servant!\n\n` +
                  `⚔️ **${sName}** easily struck down the defenceless civilian on the spot without a fight.\n\n` +
                  `• **Target Status:** 💀 Slain & Permanently Eliminated (Civilian casualty recorded)\n` +
                  `• **Victor:** Master <@${interaction.user.id}> (**${challengerMaster.username}**)\n` +
                  `• **Civilian Kills:** ${challengerMaster.innocentKills} (${rep.rank})\n` +
                  `• **Rewards Granted:** +300 Bond EXP, +3 Saint Quartz, +1 Kill` +
                  repNotice
                )
                .setColor(0xef4444)
                .setFooter({ text: 'Holy Grail War • Civilian Execution Ledger' });

              await i.editReply({
                content: `<@${interaction.user.id}> <@${opponentUser.id}>`,
                embeds: [civilianKilledEmbed],
                components: []
              });
              return;
            }

            try {
              const p1Part = warSession.participants[challengerMaster.discordId];
              const p1Hp = (isFreeBattle || challengerMaster.environmentMode === 'safe') ? undefined : (p1Part ? calculateCurrentHp(p1Part) : undefined);
              const p1 = createCombatant(challengerMaster, challengerServant, false, p1Hp, isFreeBattle);

              const p2Part = warSession.participants[opponentUser.id] ||
                Object.values(warSession.participants).find(p => p.username.toLowerCase() === opponentUser.username.toLowerCase());
              const p2Hp = (isFreeBattle || opponentMaster.environmentMode === 'safe') ? undefined : (p2Part ? calculateCurrentHp(p2Part) : undefined);
              const p2 = createCombatant(opponentMaster, opponentServant, false, p2Hp, isFreeBattle);
              await startInteractiveDuel(i, p1, p2, challengerMaster, opponentMaster, undefined, undefined, undefined, undefined, isFreeBattle);
            } catch (duelErr: any) {
              console.error('Error starting duel after accept:', duelErr);
              await i.followUp({
                content: `❌ Failed to initialize duel arena: ${duelErr?.message || duelErr}`,
                flags: MessageFlags.Ephemeral
              });
            }
          }
        } catch (err: any) {
          if (err.code === 10062 || err.code === 40060 || err.message?.includes('Unknown interaction')) return;
          console.error('Error in inviteCollector (opponent):', err);
        }
      });

      inviteCollector.on('end', async (_collected, reason) => {
        if (reason !== 'accepted' && reason !== 'declined') {
          try {
            const expiredEmbed = EmbedBuilder.from(inviteEmbed)
              .setColor(0x64748b)
              .setFooter({ text: 'Holy Grail War • Duel invitation expired (5 min timeout)' });
            await interaction.editReply({
              embeds: [expiredEmbed],
              components: []
            });
          } catch {}
        }
      });

      return;
    }

    // BRANCH 2: OPEN / QUICK DUEL AGAINST ANOTHER REAL MASTER
    let livingRivalParticipants: Array<{ discordId: string; username: string }> = [];

    if (isFreeBattle) {
      // Safe Mode Free Battle: Match against any other Safe Mode Master with Servants
      const allMasters = getAllMasters();
      livingRivalParticipants = allMasters
        .filter(m => {
          if (m.discordId === challengerMaster.discordId) return false;
          if (!m.servants || m.servants.length === 0) return false;
          const p = warSession.participants[m.discordId];
          const isEnrolledAndAliveInWar = m.environmentMode === 'war' && p && p.isAlive;
          return !isEnrolledAndAliveInWar; // Safe mode or eliminated/withdrawn
        })
        .map(m => ({ discordId: m.discordId, username: m.username }));
    } else {
      // War Duel: Match against living active War participants
      livingRivalParticipants = Object.values(warSession.participants).filter(
        p => p.discordId !== challengerMaster.discordId &&
             p.username.toLowerCase() !== challengerMaster.username.toLowerCase() &&
             p.isAlive
      );
    }

    if (livingRivalParticipants.length === 0) {
      const noRivalsEmbed = new EmbedBuilder()
        .setTitle(isFreeBattle ? '🕊️ NO SAFE MODE MASTERS AVAILABLE TO SPAR' : '⚔️ NO RIVAL MASTERS AVAILABLE IN FUYUKI')
        .setDescription(
          isFreeBattle
            ? `There are currently no other Safe Mode Masters with contracted Servants in the server to spar with.\n\n` +
              `• **Direct Invite:** You can challenge a specific friend directly using \`/duel mode:free opponent:@Master\`.\n` +
              `• **Invite Others:** Invite your friends to contract a Servant with \`/summon\`!`
            : `There are currently no other living Masters participating in this Holy Grail War session to duel.\n\n` +
              `• **Pure Master vs Master:** The Holy Grail War is fought exclusively by enrolled Masters — no NPCs or synthetic shadows.\n` +
              `• **How to Join:** Invite other members of the server to invoke \`/grailwar join\` to enter the war!\n` +
              `• Check currently active participants at any time with \`/grailwar status\`.`
        )
        .setColor(0x64748b)
        .setFooter({ text: isFreeBattle ? 'Holy Grail War • Safe Mode Free Battle' : 'Holy Grail War • Real Masters Only' });

      await interaction.reply({
        embeds: [noRivalsEmbed],
        ephemeral: false
      });
      return;
    }

    // Pick a random living rival Master from the server
    const targetRival = livingRivalParticipants[Math.floor(Math.random() * livingRivalParticipants.length)];
    const opponentMaster = await getOrCreateMaster(targetRival.discordId, targetRival.username);
    const isOpponentCivilian = !opponentMaster.servants || opponentMaster.servants.length === 0;
    const opponentServant = isOpponentCivilian
      ? null
      : (opponentMaster.servants.find(s => s.id === opponentMaster.activeServantId) || opponentMaster.servants[0]);

    const inviteEmbed = new EmbedBuilder()
      .setTitle('⚔️ HOLY GRAIL WAR: DUEL INVITATION')
      .setDescription(
        `Master <@${interaction.user.id}> has challenged ${isOpponentCivilian ? 'civilian' : 'rival Master'} <@${targetRival.discordId}> (**${targetRival.username}**) to a duel!\n\n` +
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
      time: 300000 // 5 minutes to accept/decline
    });

    inviteCollector.on('collect', async i => {
      try {
        if (i.replied || i.deferred) return;

        if (i.customId === 'decline_duel') {
          if (i.user.id !== targetRival.discordId && i.user.id !== interaction.user.id) {
            await i.reply({ content: '❌ You are not involved in this duel challenge.', flags: MessageFlags.Ephemeral });
            return;
          }
          inviteCollector.stop('declined');
          await i.update({
            content: `🏳️ Duel declined by <@${i.user.id}>.`,
            embeds: [],
            components: []
          });
          return;
        }

        if (i.customId === 'accept_duel') {
          if (i.user.id !== targetRival.discordId) {
            await i.reply({
              content: `❌ Only the challenged ${isOpponentCivilian ? 'civilian' : 'Master'} (<@${targetRival.discordId}>) can accept this duel invitation.`,
              flags: MessageFlags.Ephemeral
            });
            return;
          }

          inviteCollector.stop('accepted');
          // Acknowledge immediately before async canvas generation
          await i.deferUpdate();

          if (isOpponentCivilian || !opponentServant) {
            const alreadyDead = (warSession.civilianCasualties || []).some(
              c => c.id === targetRival.discordId || c.name.toLowerCase().includes(targetRival.username.toLowerCase())
            );
            if (alreadyDead) {
              await i.editReply({
                content: `☠️ Civilian <@${targetRival.discordId}> was already slain earlier in this Holy Grail War! A civilian cannot be killed twice.`,
                embeds: [],
                components: []
              });
              return;
            }

            const pEntry = warSession.participants[targetRival.discordId] || {
              discordId: targetRival.discordId,
              username: targetRival.username,
              servantId: 'none',
              servantName: 'Civilian',
              servantClass: 'Civilian' as any,
              avatarUrl: '',
              maxHp: 100,
              currentHp: 0,
              commandSeals: 0,
              kills: 0,
              isAlive: false
            };
            pEntry.isAlive = false;
            pEntry.currentHp = 0;
            pEntry.deathTimestamp = Date.now();
            pEntry.killedByMaster = challengerMaster.username;
            warSession.participants[targetRival.discordId] = pEntry;

            if (!warSession.civilianCasualties) warSession.civilianCasualties = [];
            warSession.civilianCasualties.unshift({
              id: targetRival.discordId,
              name: `@${targetRival.username}`,
              slainByMasterId: challengerMaster.discordId,
              timestamp: Date.now(),
              cause: 'duel_civilian_execution'
            });

            challengerMaster.innocentKills = (challengerMaster.innocentKills || 0) + 1;
            const rep = getReputationInfo(challengerMaster.innocentKills);
            challengerMaster.reputationRank = rep.rank;
            challengerMaster.bountyActive = rep.bountyActive;
            challengerMaster.bountyRewardSq = rep.bountyRewardSq;
            challengerMaster.isRogueHeretic = rep.isRogue;

            const challengerParticipant = warSession.participants[challengerMaster.discordId];
            if (challengerParticipant) {
              challengerParticipant.innocentKills = challengerMaster.innocentKills;
              challengerParticipant.reputationRank = rep.rank;
              challengerParticipant.bountyActive = rep.bountyActive;
              challengerParticipant.isRogueHeretic = rep.isRogue;
              if (rep.isRogue) {
                challengerParticipant.isExposed = true;
                challengerParticipant.exposureReason = 'heretic_bounty';
                challengerParticipant.inSanctuary = false;
                (challengerParticipant as any).inChurchSanctuary = false;
              }
            }

            challengerMaster.duelsWon = (challengerMaster.duelsWon || 0) + 1;
            challengerMaster.servantKills = (challengerMaster.servantKills || 0) + 1;
            challengerMaster.saintQuartz = (challengerMaster.saintQuartz || 0) + 3;
            if (challengerServant) {
              challengerServant.experience = (challengerServant.experience || 0) + 300;
            }
            await saveMaster(challengerMaster);

            opponentMaster.duelsLost = (opponentMaster.duelsLost || 0) + 1;
            await saveMaster(opponentMaster);

            const sName = challengerServant?.template?.name || 'Heroic Spirit';

            let repNotice = '';
            if (challengerMaster.innocentKills === 10) {
              repNotice = `\n\n📜 **CHURCH ORDER OF EXTERMINATION & BOUNTY ISSUED!**\n` +
                `> *"By decree of Father Kotomine: Master <@${challengerMaster.discordId}> has reached 10 civilian kills! They are excommunicated as a **Rogue Heretic**."*\n\n` +
                `• 🎯 **Open Server Bounty:** **+1 Extra Command Seal** & **+15 Saint Quartz** to any Master who slays them!\n` +
                `• 🚫 **Church Sanctuary:** Permanently revoked.\n` +
                `• ⛓️ **Curse of Heresy:** Servant suffers -10% ATK suppression in all combat.`;
            } else if (challengerMaster.innocentKills > 10) {
              repNotice = `\n\n☠️ **WANTED ROGUE HERETIC:** Active Bounty: +1 Command Seal & +15 Saint Quartz! Barred from Church sanctuary.`;
            } else if (challengerMaster.innocentKills >= 7) {
              repNotice = `\n\n🩸 **NOTORIOUS MAGUS (${challengerMaster.innocentKills}/10 Kills):** The Holy Church has placed you under heavy surveillance. Reaching 10 civilian kills activates a Rogue Heretic Bounty!`;
            } else if (challengerMaster.innocentKills >= 4) {
              repNotice = `\n\n⚠️ **SUSPECT MAGUS (${challengerMaster.innocentKills}/10 Kills):** The Holy Church notes your disregard for the Secrecy of Magecraft.`;
            }

            const civilianKilledEmbed = new EmbedBuilder()
              .setTitle('☠️ CIVILIAN SLAIN WITHOUT A FIGHT')
              .setDescription(
                `Civilian <@${targetRival.discordId}> (**${targetRival.username}**) accepted the duel invitation without a contracted Servant!\n\n` +
                `⚔️ **${sName}** easily struck down the defenceless civilian on the spot without a fight.\n\n` +
                `• **Target Status:** 💀 Slain & Permanently Eliminated (Civilian casualty recorded)\n` +
                `• **Victor:** Master <@${interaction.user.id}> (**${challengerMaster.username}**)\n` +
                `• **Civilian Kills:** ${challengerMaster.innocentKills} (${rep.rank})\n` +
                `• **Rewards Granted:** +300 Bond EXP, +3 Saint Quartz, +1 Kill` +
                repNotice
              )
              .setColor(0xef4444)
              .setFooter({ text: 'Holy Grail War • Civilian Execution Ledger' });

            await i.editReply({
              content: `<@${interaction.user.id}> <@${targetRival.discordId}>`,
              embeds: [civilianKilledEmbed],
              components: []
            });
            return;
          }

          try {
            const p1Part = warSession.participants[challengerMaster.discordId];
            const p1Hp = (isFreeBattle || challengerMaster.environmentMode === 'safe') ? undefined : (p1Part ? calculateCurrentHp(p1Part) : undefined);
            const p1 = createCombatant(challengerMaster, challengerServant, false, p1Hp, isFreeBattle);

            const p2Part = warSession.participants[targetRival.discordId] ||
              Object.values(warSession.participants).find(p => p.username.toLowerCase() === targetRival.username.toLowerCase());
            const p2Hp = (isFreeBattle || opponentMaster.environmentMode === 'safe') ? undefined : (p2Part ? calculateCurrentHp(p2Part) : undefined);
            const p2 = createCombatant(opponentMaster, opponentServant, false, p2Hp, isFreeBattle);
            await startInteractiveDuel(i, p1, p2, challengerMaster, opponentMaster, undefined, undefined, undefined, undefined, isFreeBattle);
          } catch (duelErr: any) {
            console.error('Error starting duel after accept (rival):', duelErr);
            await i.followUp({
              content: `❌ Failed to initialize duel arena: ${duelErr?.message || duelErr}`,
              flags: MessageFlags.Ephemeral
            });
          }
        }
      } catch (err: any) {
        if (err.code === 10062 || err.code === 40060 || err.message?.includes('Unknown interaction')) return;
        console.error('Error in inviteCollector (rival):', err);
      }
    });

    inviteCollector.on('end', async (_collected, reason) => {
      if (reason !== 'accepted' && reason !== 'declined') {
        try {
          const expiredEmbed = EmbedBuilder.from(inviteEmbed)
            .setColor(0x64748b)
            .setFooter({ text: 'Holy Grail War • Duel invitation expired (5 min timeout)' });
          await interaction.editReply({
            embeds: [expiredEmbed],
            components: []
          });
        } catch {}
      }
    });

  } catch (error: any) {
    console.error('Error executing /duel:', error);
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: `❌ Error starting duel: ${error.message}`, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: `❌ Error starting duel: ${error.message}`, flags: MessageFlags.Ephemeral });
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
  p2Master: MasterProfile | null,
  p1Ally?: DuelCombatant,
  p2Ally?: DuelCombatant,
  p1AllyMaster?: MasterProfile | null,
  p2AllyMaster?: MasterProfile | null,
  isFreeBattle?: boolean
) {
  let round = 1;
  const t1 = p1.servant.template;
  const t2 = p2.servant.template;
  const p1Speaker = p1.servant.nickname || t1?.name || 'Servant';
  const p2Speaker = p2.servant.nickname || t2?.name || 'Opponent Servant';

  // Interactive Matchup Banter Resolution
  const clashMatchup = getServantMatchupDialogue(p1.servant, t2);
  const p1BattleQuote = clashMatchup.challengerLine;
  const p2BattleQuote = clashMatchup.defenderLine;

  const combatLogs: string[] = [
    `⚔️ **[VS CLASH: ${clashMatchup.tag}]** The Command Seal glow resonates... The Holy Grail Duel begins!`,
    `💬 **${p1Speaker} (${t1.servantClass}):**\n> ❝ ***${clashMatchup.challengerLine}*** ❞`,
    `💬 **${p2Speaker} (${t2.servantClass}):**\n> ❝ ***${clashMatchup.defenderLine}*** ❞`
  ];

  const fullCombatHistory: DetailedDuelAction[] = [
    {
      round: 1,
      actorName: p1Speaker,
      targetName: p2Speaker,
      actionType: 'system',
      title: `⚔️ Holy Grail War Commenced [VS CLASH: ${clashMatchup.tag}]`,
      details: `Duel began between ${p1Speaker} (${t1.servantClass}) and ${p2Speaker} (${t2.servantClass})`,
      timestamp: new Date()
    }
  ];

  if (p1Ally) {
    const p1AllyTpl = p1Ally.servant.template;
    const p1AllySpeaker = p1Ally.servant.nickname || p1AllyTpl?.name || 'Ally Servant';
    const p1AllyMatchup = getServantMatchupDialogue(p1Ally.servant, t2);
    combatLogs.push(`💬 **${p1AllySpeaker} (${p1AllyTpl?.servantClass || 'Servant'}):**\n> ❝ ***${p1AllyMatchup.challengerLine}*** ❞`);
  }

  if (p2Ally) {
    const p2AllyTpl = p2Ally.servant.template;
    const p2AllySpeaker = p2Ally.servant.nickname || p2AllyTpl?.name || 'Opponent Ally Servant';
    const p2AllyMatchup = getServantMatchupDialogue(p2Ally.servant, t1);
    combatLogs.push(`💬 **${p2AllySpeaker} (${p2AllyTpl?.servantClass || 'Servant'}):**\n> ❝ ***${p2AllyMatchup.challengerLine}*** ❞`);
  }

  const team1: DuelCombatant[] = [p1, ...(p1Ally ? [p1Ally] : [])];
  const team2: DuelCombatant[] = [p2, ...(p2Ally ? [p2Ally] : [])];
  const teamSolo: DuelCombatant[] = [];
  let team1AssistUsed = false;
  let team2AssistUsed = false;
  let forceJoinCount = (team1.length + team2.length >= 4 ? 1 : 0);

  // Track all Masters who have participated in this duel match (initial combatants + mid-battle joiners)
  // to prevent fallen combatants from re-joining / infinite respawning.
  const duelParticipantIds = new Set<string>([
    p1.userId,
    p2.userId,
    ...(p1Ally ? [p1Ally.userId] : []),
    ...(p2Ally ? [p2Ally.userId] : [])
  ]);

  // Track all Master IDs whose Servant has fallen in this duel
  const fallenMasterIds = new Set<string>();

  const recordFallenCombatants = () => {
    team1.forEach(c => {
      if (c.currentHp <= 0) fallenMasterIds.add(c.userId);
    });
    team2.forEach(c => {
      if (c.currentHp <= 0) fallenMasterIds.add(c.userId);
    });
    teamSolo.forEach(c => {
      if (c.currentHp <= 0) fallenMasterIds.add(c.userId);
    });
  };

  const getLivingTeam1 = () => team1.filter(c => c.currentHp > 0 && !c.isFled);
  const getLivingTeam2 = () => team2.filter(c => c.currentHp > 0 && !c.isFled);
  const getLivingTeamSolo = () => teamSolo.filter(c => c.currentHp > 0 && !c.isFled);
  const getTargetsFor = (combatant: DuelCombatant) => {
    if (teamSolo.includes(combatant)) {
      return [
        ...getLivingTeam1(),
        ...getLivingTeam2(),
        ...getLivingTeamSolo().filter(c => c.userId !== combatant.userId)
      ];
    }
    if (team1.includes(combatant)) {
      return [...getLivingTeam2(), ...getLivingTeamSolo()];
    }
    return [...getLivingTeam1(), ...getLivingTeamSolo()];
  };
  const getMyTeamFor = (combatant: DuelCombatant) => {
    if (teamSolo.includes(combatant)) return [combatant];
    if (team1.includes(combatant)) return team1;
    return team2;
  };
  const getSelectedTarget = (combatant: DuelCombatant): DuelCombatant | undefined => {
    const opps = getTargetsFor(combatant);
    if (opps.length === 0) return undefined;
    let target = opps.find(o => 
      combatant.selectedTargetId && 
      (o.userId === combatant.selectedTargetId || combatant.selectedTargetId.includes(o.userId)) && 
      o.currentHp > 0 && 
      !o.isFled
    );
    if (!target) {
      target = opps[0];
      combatant.selectedTargetId = target.userId;
    }
    return target;
  };

  // Pick a single, consistent stage background for the entire duel session
  const battleBgUrl = getRandomBackgroundUrl();

  let turnOrder: DuelCombatant[] = [p1, p2, ...(p1Ally ? [p1Ally] : []), ...(p2Ally ? [p2Ally] : [])];
  let currentTurnIndex = 0;

  // Find fastest combatant for initiative
  let fastestIdx = 0;
  let maxSpeed = -1;
  turnOrder.forEach((c, idx) => {
    const baseAgi = c.servant.template?.baseStats?.agility || 10;
    const allocAgi = c.servant.allocatedStats?.agility || 0;
    const spd = (baseAgi + allocAgi) * 10 + Math.random() * 20;
    if (spd > maxSpeed) {
      maxSpeed = spd;
      fastestIdx = idx;
    }
  });

  currentTurnIndex = fastestIdx;
  let activeCombatant = turnOrder[currentTurnIndex];
  let activeUserId = activeCombatant.userId;
  const fasterName = activeCombatant.servant.nickname || activeCombatant.servant.template?.name || 'Heroic Spirit';
  combatLogs.push(`⚡ **Agility Initiative:** **${fasterName}** outmaneuvered the arena and claims the first move!`);

  let activePendingCards: ('Buster' | 'Arts' | 'Quick' | 'NP')[] = [];
  let activePendingIndices: number[] = [];
  let p1LastCards: ('Buster' | 'Arts' | 'Quick' | 'NP')[] = ['Buster', 'Arts', 'Quick'];
  let p2LastCards: ('Buster' | 'Arts' | 'Quick' | 'NP')[] = ['Arts', 'Buster', 'Quick'];

  const buildCurrentButtons = () => {
    getSelectedTarget(activeCombatant);
    const oppLiving = getTargetsFor(activeCombatant);
    const myTeam = getMyTeamFor(activeCombatant);
    const hasAlly = myTeam.length > 1;
    const isT1 = team1.includes(activeCombatant);
    const assistAvail = isT1 ? (!team1AssistUsed && hasAlly) : (!team2AssistUsed && hasAlly);
    const livingT1 = getLivingTeam1();
    const livingT2 = getLivingTeam2();
    const livingTS = getLivingTeamSolo();
    const totalLiving = livingT1.length + livingT2.length + livingTS.length;
    const forceJoinAvail = totalLiving < 4;

    return buildCombatButtons(
      activeCombatant,
      activePendingCards,
      activePendingIndices,
      oppLiving,
      activeCombatant.selectedTargetId,
      hasAlly,
      assistAvail,
      forceJoinAvail
    );
  };

  const buildCurrentEmbed = () => {
    const target = getSelectedTarget(activeCombatant);
    return buildDuelEmbed(
      p1,
      p2,
      round,
      activeUserId,
      combatLogs,
      activePendingCards,
      activePendingIndices,
      p1Ally,
      p2Ally,
      target,
      teamSolo
    );
  };

  const buildCurrentEmbeds = (): EmbedBuilder[] => {
    return [];
  };

  const buildDuelTurnContent = (
    active: DuelCombatant = activeCombatant,
    selectedCards: ('Buster' | 'Arts' | 'Quick' | 'NP')[] = activePendingCards
  ) => {
    const cardEmojiMap: Record<string, string> = {
      Buster: '🔴 Buster',
      Arts: '🔵 Arts',
      Quick: '🟢 Quick',
      NP: '💥 NP'
    };
    const sName = active.servant.nickname || active.servant.template?.name || 'Servant';
    let cardChainStr = '';
    if (selectedCards.length > 0) {
      const chain = selectedCards.map((c, idx) => `\`[ #${idx + 1}: ${cardEmojiMap[c] || c} ]\``).join(' ➔ ');
      cardChainStr = ` • 🎴 **Selected:** ${chain}`;
    }
    return `⚔️ **<@${active.userId}>'s Turn!** (**${sName}**)${cardChainStr}`;
  };

  const buildCurrentAttachment = async (logText?: string) => {
    return createTurnSummaryAttachment(
      p1,
      p2,
      round,
      logText || combatLogs[combatLogs.length - 1],
      p1LastCards,
      p2LastCards,
      p1Ally,
      p2Ally,
      combatLogs,
      teamSolo
    );
  };

  const p1Class = t1?.servantClass || 'Saber';
  const p1AvatarUrl = getCombatantSpriteUrl(p1) || t1?.avatarUrl;

  const p2Class = t2?.servantClass || 'Saber';
  const p2AvatarUrl = getCombatantSpriteUrl(p2) || t2?.avatarUrl;

  const initialAttachment = await buildCurrentAttachment();
  const initialButtons = buildCurrentButtons();

  const startEmbeds: EmbedBuilder[] = [];
  const startFiles = [initialAttachment];

  const p1StartBuffer = await renderDialogueCard(
    p1Speaker,
    p1BattleQuote,
    'SUMMON INVOCATION',
    p1Class,
    p1AvatarUrl,
    p1.servant.bondLevel || 5,
    p2Speaker,
    p2AvatarUrl,
    p2Class,
    ['Buster', 'Buster', 'Buster'],
    battleBgUrl
  ).catch((err) => {
    console.error('Error rendering p1 starting dialogue card:', err);
    return null;
  });

  const p2StartBuffer = await renderDialogueCard(
    p2Speaker,
    p2BattleQuote,
    'SUMMON INVOCATION',
    p2Class,
    p2AvatarUrl,
    p2.servant.bondLevel || 5,
    p1Speaker,
    p1AvatarUrl,
    p1Class,
    ['Buster', 'Buster', 'Buster'],
    battleBgUrl
  ).catch((err) => {
    console.error('Error rendering p2 starting dialogue card:', err);
    return null;
  });

  if (p1StartBuffer) {
    const p1StartAttachment = new AttachmentBuilder(p1StartBuffer, { name: 'p1_start.png' });
    const p1StartEmbed = new EmbedBuilder()
      .setTitle(`💬 BATTLE ENGAGEMENT — ${p1.servant.template.name.toUpperCase()}`)
      .setDescription(
        `💬 **${p1.servant.template.name}** (Master: ${p1.username}):\n> ❝ ***${p1BattleQuote}*** ❞`
      )
      .setImage('attachment://p1_start.png')
      .setColor(0xef4444);

    if (p1AvatarUrl) {
      safeSetEmbedThumbnail(p1StartEmbed, p1AvatarUrl, startFiles);
    }

    startEmbeds.push(p1StartEmbed);
    startFiles.push(p1StartAttachment);
  }

  if (p2StartBuffer) {
    const p2StartAttachment = new AttachmentBuilder(p2StartBuffer, { name: 'p2_start.png' });
    const p2StartEmbed = new EmbedBuilder()
      .setTitle(`💬 BATTLE ENGAGEMENT — ${p2.servant.template.name.toUpperCase()}`)
      .setDescription(
        `💬 **${p2.servant.template.name}** (Master: ${p2.username}):\n> ❝ ***${p2BattleQuote}*** ❞`
      )
      .setImage('attachment://p2_start.png')
      .setColor(0x38bdf8);

    if (p2AvatarUrl) {
      safeSetEmbedThumbnail(p2StartEmbed, p2AvatarUrl, startFiles);
    }

    startEmbeds.push(p2StartEmbed);
    startFiles.push(p2StartAttachment);
  }

  if (p1Ally) {
    const p1AllyTpl = p1Ally.servant.template;
    const p1AllySpeaker = p1Ally.servant.nickname || p1AllyTpl?.name || 'Ally Servant';
    const p1AllyClass = p1AllyTpl?.servantClass || 'Saber';
    const p1AllyAvatarUrl = getCombatantSpriteUrl(p1Ally) || p1AllyTpl?.avatarUrl;
    const p1AllyMatchup = getServantMatchupDialogue(p1Ally.servant, t2);
    const p1AllyQuote = p1AllyMatchup.challengerLine;

    const p1AllyStartBuffer = await renderDialogueCard(
      p1AllySpeaker,
      p1AllyQuote,
      'ALLIANCE INVOCATION',
      p1AllyClass,
      p1AllyAvatarUrl,
      p1Ally.servant.bondLevel || 5,
      p2Speaker,
      p2AvatarUrl,
      p2Class,
      ['Buster', 'Arts', 'Quick'],
      battleBgUrl
    ).catch(err => {
      console.error('Error rendering p1Ally starting dialogue card:', err);
      return null;
    });

    if (p1AllyStartBuffer) {
      const p1AllyStartAttachment = new AttachmentBuilder(p1AllyStartBuffer, { name: 'p1_ally_start.png' });
      const p1AllyStartEmbed = new EmbedBuilder()
        .setTitle(`💬 BATTLE ENGAGEMENT — ${p1AllyTpl.name.toUpperCase()}`)
        .setDescription(
          `💬 **${p1AllyTpl.name}** (Master: <@${p1Ally.userId}>):\n> ❝ ***${p1AllyQuote}*** ❞`
        )
        .setImage('attachment://p1_ally_start.png')
        .setColor(0xef4444);

      if (p1AllyAvatarUrl) {
        safeSetEmbedThumbnail(p1AllyStartEmbed, p1AllyAvatarUrl, startFiles);
      }

      startEmbeds.push(p1AllyStartEmbed);
      startFiles.push(p1AllyStartAttachment);
    }
  }

  if (p2Ally) {
    const p2AllyTpl = p2Ally.servant.template;
    const p2AllySpeaker = p2Ally.servant.nickname || p2AllyTpl?.name || 'Opponent Ally Servant';
    const p2AllyClass = p2AllyTpl?.servantClass || 'Saber';
    const p2AllyAvatarUrl = getCombatantSpriteUrl(p2Ally) || p2AllyTpl?.avatarUrl;
    const p2AllyMatchup = getServantMatchupDialogue(p2Ally.servant, t1);
    const p2AllyQuote = p2AllyMatchup.challengerLine;

    const p2AllyStartBuffer = await renderDialogueCard(
      p2AllySpeaker,
      p2AllyQuote,
      'ALLIANCE INVOCATION',
      p2AllyClass,
      p2AllyAvatarUrl,
      p2Ally.servant.bondLevel || 5,
      p1Speaker,
      p1AvatarUrl,
      p1Class,
      ['Buster', 'Arts', 'Quick'],
      battleBgUrl
    ).catch(err => {
      console.error('Error rendering p2Ally starting dialogue card:', err);
      return null;
    });

    if (p2AllyStartBuffer) {
      const p2AllyStartAttachment = new AttachmentBuilder(p2AllyStartBuffer, { name: 'p2_ally_start.png' });
      const p2AllyStartEmbed = new EmbedBuilder()
        .setTitle(`💬 BATTLE ENGAGEMENT — ${p2AllyTpl.name.toUpperCase()}`)
        .setDescription(
          `💬 **${p2AllyTpl.name}** (Master: <@${p2Ally.userId}>):\n> ❝ ***${p2AllyQuote}*** ❞`
        )
        .setImage('attachment://p2_ally_start.png')
        .setColor(0x38bdf8);

      if (p2AllyAvatarUrl) {
        safeSetEmbedThumbnail(p2AllyStartEmbed, p2AllyAvatarUrl, startFiles);
      }

      startEmbeds.push(p2AllyStartEmbed);
      startFiles.push(p2AllyStartAttachment);
    }
  }

  const activeHumanUsers = [p1, p2, p1Ally, p2Ally]
    .filter((c): c is DuelCombatant => !!c && !c.isAi)
    .map(c => `<@${c.userId}>`);
  const activePingsContent = buildDuelTurnContent(activeCombatant, activePendingCards);

  let battleMsg: any;
  if (contextInteraction.deferred || contextInteraction.replied) {
    battleMsg = await contextInteraction.editReply({
      content: activePingsContent,
      embeds: startEmbeds,
      files: startFiles,
      components: initialButtons
    });
  } else if (contextInteraction.isButton && contextInteraction.isButton()) {
    await contextInteraction.deferUpdate();
    battleMsg = await contextInteraction.editReply({
      content: activePingsContent,
      embeds: startEmbeds,
      files: startFiles,
      components: initialButtons
    });
  } else {
    const res = await contextInteraction.reply({
      content: activePingsContent,
      embeds: startEmbeds,
      files: startFiles,
      components: initialButtons,
      withResponse: true
    });
    battleMsg = res?.resource?.message || await contextInteraction.fetchReply();
  }

  // Active dialogue cut-in auto-disappear timer
  let activeCutInTimer: any = null;

  const clearCutInTimer = () => {
    if (activeCutInTimer) {
      clearTimeout(activeCutInTimer);
      activeCutInTimer = null;
    }
  };

  const scheduleCutInAutoClear = (delayMs = 2500) => {
    clearCutInTimer();
    activeCutInTimer = setTimeout(async () => {
      activeCutInTimer = null;
      try {
        const freshAttachment = await buildCurrentAttachment();
        const currentTurnContent = buildDuelTurnContent(activeCombatant, activePendingCards);
        const updatedButtons = buildCurrentButtons();

        if (battleMsg && typeof battleMsg.edit === 'function') {
          await battleMsg.edit({
            content: currentTurnContent,
            embeds: [],
            files: [freshAttachment],
            components: updatedButtons
          }).catch(() => {});
        } else if (contextInteraction && (contextInteraction.deferred || contextInteraction.replied)) {
          await contextInteraction.editReply({
            content: currentTurnContent,
            embeds: [],
            files: [freshAttachment],
            components: updatedButtons
          }).catch(() => {});
        }
      } catch (err) {
        // Ignored
      }
    }, delayMs);
  };

  if (startEmbeds.length > 0) {
    scheduleCutInAutoClear(2500);
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
    const rawNpGifUrl = getNoblePhantasmGif(servant);
    const npGifUrl = normalizeMediaUrl(rawNpGifUrl);
    const npChant = getNoblePhantasmChant(servant);
    const npName = npTemplate?.name || 'Noble Phantasm';
    const servantDisplayName = servant.nickname || servant.template?.name || 'Heroic Spirit';
    const { autoDelete, afkTimeoutSeconds } = getDuelNpSettings();

    const chantBlock = npChant ? `\n> *“${npChant}”*` : '';

    const npFiles: AttachmentBuilder[] = [];
    const npEmbed = new EmbedBuilder()
      .setTitle(`💥 NOBLE PHANTASM UNLEASHED: ${npName.toUpperCase()}`)
      .setDescription(`⚔️ **${servantDisplayName}** (Master: <@${actor.userId}>)${chantBlock}`)
      .setColor(0xe11d48)
      .setFooter({ text: 'Holy Grail War • Noble Phantasm Unleashed' });
    safeSetEmbedImage(npEmbed, npGifUrl, npFiles);

    try {
      let sentMsg: any = null;
      if (interaction.channel && typeof interaction.channel.send === 'function') {
        sentMsg = await interaction.channel.send({
          embeds: [npEmbed],
          files: npFiles
        });
      } else if (interaction.followUp) {
        sentMsg = await interaction.followUp({
          embeds: [npEmbed],
          files: npFiles,
          withResponse: true
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

  // Component Collector for turn choices - channel-level or message-level auto-relay collector
  const targetChannel = contextInteraction.channel;
  const collector = targetChannel && typeof targetChannel.createMessageComponentCollector === 'function'
    ? targetChannel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        idle: 300000, // 5 minutes per player turn
        time: 3600000, // 1 hour absolute safety ceiling
        filter: (btn: any) =>
          isInteractionForThisDuel(btn) &&
          (btn.customId.startsWith('card_') ||
           btn.customId.startsWith('target_') ||
           btn.customId.startsWith('skill_') ||
           btn.customId.startsWith('fj_'))
      })
    : battleMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        idle: 300000, // 5 minutes per player turn
        time: 3600000, // 1 hour absolute safety ceiling
        filter: (btn: any) =>
          isInteractionForThisDuel(btn) &&
          (btn.customId.startsWith('card_') ||
           btn.customId.startsWith('target_') ||
           btn.customId.startsWith('skill_') ||
           btn.customId.startsWith('fj_'))
      });

  const advanceTurn = async (
    interactionToEdit?: any,
    pendingNpActors: DuelCombatant[] = [],
    combatCutInEmbed?: EmbedBuilder | null,
    combatCutInFile?: AttachmentBuilder | null
  ) => {
    const livingT1 = getLivingTeam1();
    const livingT2 = getLivingTeam2();
    const livingTS = getLivingTeamSolo();
    const activeFactionsCount = (livingT1.length > 0 ? 1 : 0) + (livingT2.length > 0 ? 1 : 0) + livingTS.length;

    // If 1 or fewer factions remain standing, conclude duel!
    if (activeFactionsCount <= 1) {
      collector.stop('finished');
      const winningTeam = livingT1.length > 0 ? team1 : livingT2.length > 0 ? team2 : (livingTS.length > 0 ? [livingTS[0]] : teamSolo);
      const losingTeam = [
        ...(livingT1.length === 0 ? team1 : []),
        ...(livingT2.length === 0 ? team2 : []),
        ...(livingTS.length === 0 ? teamSolo : [])
      ];
      const finalAttachment = await buildCurrentAttachment();
      if (pendingNpActors.length > 0) {
        for (const npActor of pendingNpActors) {
          dispatchNpGif(npActor, interactionToEdit || contextInteraction).catch(() => {});
        }
      }
      await finishDuel(interactionToEdit || contextInteraction, winningTeam, losingTeam, p1Master, p2Master, finalAttachment, isFreeBattle, battleBgUrl);
      return;
    }

    let cycleCount = 0;
    while (cycleCount < turnOrder.length * 2) {
      currentTurnIndex = (currentTurnIndex + 1) % turnOrder.length;
      cycleCount++;
      if (currentTurnIndex === 0) {
        const roundBeforeInc = round;
        round++;
        // Decrement round-based buffs on all active combatants so 1T Invincible/Evade and turn-limited buffs properly wear off
        turnOrder.forEach(c => {
          if (c && c.activeBuffs) {
            c.activeBuffs = c.activeBuffs.map(b => {
              const isHitBased = b.isHitCount || b.remainingHits !== undefined || /volumen|protection from arrows/i.test(b.name);
              if (!isHitBased && b.remainingTurns > 0 && b.remainingTurns < 90) {
                const isDefensive = b.type === 'invincible' || b.type === 'evade' || b.type === 'anti_purge_defense' || b.type === 'anti_purge';
                // If a 1T defensive buff already protected against incoming attacks, it expires at round end
                if (isDefensive && b.remainingTurns <= 1 && b.hasDefendedOnce) {
                  return { ...b, remainingTurns: 0 };
                }
                // Preserve newly applied defensive buffs that haven't faced an incoming attack yet
                if (b.appliedRound !== undefined && b.appliedRound === roundBeforeInc && !b.hasDefendedOnce) {
                  return b;
                }
                return { ...b, remainingTurns: b.remainingTurns - 1 };
              }
              return b;
            }).filter(b => b.remainingTurns > 0 && (!b.isHitCount || b.remainingHits === undefined || b.remainingHits > 0));
            c.isInvincible = c.activeBuffs.some(b => b.type === 'invincible');
            c.isEvading = c.activeBuffs.some(b => b.type === 'evade');
            c.isAntiPurgeDefense = c.activeBuffs.some(b => b.type === 'anti_purge_defense' || b.type === 'anti_purge');
            c.isStunned = c.activeBuffs.some(b => b.type === 'stun');
            // Re-sync gutsCount strictly with remaining active Guts buffs
            const activeGutsHits = c.activeBuffs
              .filter(b => b.type === 'guts' && (b.remainingTurns === undefined || b.remainingTurns > 0))
              .reduce((acc, b) => acc + (b.remainingHits !== undefined ? b.remainingHits : 1), 0);
            c.gutsCount = activeGutsHits;
          }
        });
      }
      const candidate = turnOrder[currentTurnIndex];
      if (candidate.currentHp > 0 && !candidate.isFled) {
        activeCombatant = candidate;
        activeUserId = activeCombatant.userId;

        // Expire 1-turn defensive buffs on activeCombatant whose turn has now arrived after defending
        activeCombatant.activeBuffs = activeCombatant.activeBuffs.filter(b => {
          const isHitBased = b.isHitCount || b.remainingHits !== undefined || /volumen|protection from arrows/i.test(b.name);
          if (!isHitBased && (b.type === 'invincible' || b.type === 'evade' || b.type === 'anti_purge_defense' || b.type === 'anti_purge')) {
            if (b.remainingTurns <= 1 && (b.hasDefendedOnce || (b.appliedRound !== undefined && b.appliedRound < round))) {
              return false;
            }
          }
          return true;
        });
        activeCombatant.isInvincible = activeCombatant.activeBuffs.some(b => b.type === 'invincible');
        activeCombatant.isEvading = activeCombatant.activeBuffs.some(b => b.type === 'evade');
        activeCombatant.isAntiPurgeDefense = activeCombatant.activeBuffs.some(b => b.type === 'anti_purge_defense' || b.type === 'anti_purge');
        break;
      }
    }

    activePendingCards = [];
    activePendingIndices = [];
    refreshCombatantHand(activeCombatant);

    // If activeCombatant is AI, run AI turn immediately
    if (activeCombatant.isAi) {
      const opps = getTargetsFor(activeCombatant);
      if (opps.length === 0) {
        await advanceTurn(interactionToEdit, pendingNpActors);
        return;
      }
      // AI chooses target (prefer lowest HP or random)
      const target = opps[Math.floor(Math.random() * opps.length)];
      activeCombatant.selectedTargetId = target.userId;

      // AI tactical skill usage
      const aiSkills = activeCombatant.servant.template.skills || [];
      const aiBond = activeCombatant.servant.bondLevel || 3;
      const alliesList = getMyTeamFor(activeCombatant);
      for (let sIdx = 0; sIdx < aiSkills.length; sIdx++) {
        if (sIdx === 2 && aiBond < 5) continue;
        if ((activeCombatant.skillCooldowns[sIdx] || 0) <= 0 && Math.random() < 0.35) {
          const aiSkillRes = activateCombatantSkill(activeCombatant, sIdx, target, round, alliesList, opps);
          if (aiSkillRes.success) {
            combatLogs.push(aiSkillRes.log);
            if (combatLogs.length > 4) combatLogs.shift();
            fullCombatHistory.push({
              round,
              actorName: activeCombatant.servant.nickname || activeCombatant.servant.template.name,
              targetName: target ? (target.servant.nickname || target.servant.template.name) : undefined,
              actionType: 'skill',
              title: `✨ Skill: ${aiSkillRes.skillName || 'Tactical Skill'}`,
              details: aiSkillRes.log.replace(/\n?>\s*.*$/gim, '').replace(/[*_~`]/g, '').trim(),
              timestamp: new Date()
            });
          }
          break;
        }
      }

      const aiSequence = chooseAiSequence(activeCombatant);
      if (team1.includes(activeCombatant)) {
        p1LastCards = aiSequence;
      } else {
        p2LastCards = aiSequence;
      }

      const aiDialogue = getCombatantChainDialogue(activeCombatant, aiSequence);

      if (aiSequence.includes('NP')) {
        pendingNpActors.push(activeCombatant);
      }

      const aiLog = resolveStrike(activeCombatant, target, aiSequence, aiDialogue, opps, alliesList);
      refreshCombatantHand(activeCombatant);
      combatLogs.push(aiLog);
      if (combatLogs.length > 4) combatLogs.shift();
      fullCombatHistory.push({
        round,
        actorName: activeCombatant.servant.nickname || activeCombatant.servant.template.name,
        targetName: target ? (target.servant.nickname || target.servant.template.name) : undefined,
        actionType: 'attack',
        title: `🎴 [${aiSequence.join(' ➔ ')}] ${aiSequence.includes('NP') ? 'Noble Phantasm' : 'Chain Strike'}`,
        details: cleanCanvasText(aiLog).replace(/[*_~`]/g, '').trim(),
        timestamp: new Date()
      });

      // Check if target was slain
      if (target.currentHp <= 0) {
        fallenMasterIds.add(target.userId);
        recordFallenCombatants();
        const killLog = `💀 **${target.servant.nickname || target.servant.template.name}** (Master: ${target.username}) has fallen in battle!`;
        combatLogs.push(killLog);
        if (combatLogs.length > 4) combatLogs.shift();
      }

      // Check if duel is over
      const livingT1End = getLivingTeam1();
      const livingT2End = getLivingTeam2();
      const livingTSEnd = getLivingTeamSolo();
      const endFactionsCount = (livingT1End.length > 0 ? 1 : 0) + (livingT2End.length > 0 ? 1 : 0) + (livingTSEnd.length > 0 ? 1 : 0);

      if (endFactionsCount <= 1) {
        collector.stop('finished');
        const winningTeam = livingT1End.length > 0 ? team1 : livingT2End.length > 0 ? team2 : teamSolo;
        const losingTeam = [
          ...(livingT1End.length === 0 ? team1 : []),
          ...(livingT2End.length === 0 ? team2 : []),
          ...(livingTSEnd.length === 0 ? teamSolo : [])
        ];
        const finalAttachment = await buildCurrentAttachment();
        if (pendingNpActors.length > 0) {
          for (const npActor of pendingNpActors) {
            dispatchNpGif(npActor, interactionToEdit || contextInteraction).catch(() => {});
          }
        }
        await finishDuel(interactionToEdit || contextInteraction, winningTeam, losingTeam, p1Master, p2Master, finalAttachment, isFreeBattle, battleBgUrl);
        return;
      }

      // Recursively advance until a human player turn is reached
      await advanceTurn(interactionToEdit, pendingNpActors);
      return;
    }

    // Human player turn reached: auto-relay fresh battle message to bottom of channel
    const turnAttachment = await buildCurrentAttachment();
    const updatedEmbeds: EmbedBuilder[] = buildCurrentEmbeds();
    if (combatCutInEmbed) {
      updatedEmbeds.push(combatCutInEmbed);
    }
    const updatedFiles: AttachmentBuilder[] = [turnAttachment];
    if (combatCutInFile) {
      updatedFiles.push(combatCutInFile);
    }
    const updatedButtons = buildCurrentButtons();
    const currentTurnContent = buildDuelTurnContent(activeCombatant, activePendingCards);

    try {
      const channelToSend = interactionToEdit?.channel || contextInteraction?.channel;
      let newBattleMsg: any = null;

      if (channelToSend && typeof channelToSend.send === 'function') {
        newBattleMsg = await channelToSend.send({
          content: currentTurnContent,
          embeds: updatedEmbeds,
          files: updatedFiles,
          components: updatedButtons
        }).catch((err: any) => {
          console.warn('[duel] Auto-relay send to channel failed, falling back to in-place edit:', err?.message || err);
          return null;
        });
      }

      if (newBattleMsg) {
        // Successfully sent fresh message at bottom: safely clean up previous battle message
        const prevMsg = battleMsg;
        battleMsg = newBattleMsg;

        if (prevMsg && typeof prevMsg.delete === 'function') {
          await prevMsg.delete().catch(() => {});
        }
        if (contextInteraction && typeof contextInteraction.deleteReply === 'function') {
          await contextInteraction.deleteReply().catch(() => {});
        }
      } else {
        // Fallback: If channel.send failed (e.g. Missing Access / thread), edit existing message in-place
        if (battleMsg && typeof battleMsg.edit === 'function') {
          await battleMsg.edit({
            content: currentTurnContent,
            embeds: updatedEmbeds,
            files: updatedFiles,
            components: updatedButtons
          }).catch(() => {});
        } else if (interactionToEdit && (interactionToEdit.deferred || interactionToEdit.replied)) {
          await interactionToEdit.editReply({
            content: currentTurnContent,
            embeds: updatedEmbeds,
            files: updatedFiles,
            components: updatedButtons
          }).catch(() => {});
        } else if (contextInteraction && (contextInteraction.deferred || contextInteraction.replied)) {
          await contextInteraction.editReply({
            content: currentTurnContent,
            embeds: updatedEmbeds,
            files: updatedFiles,
            components: updatedButtons
          }).catch(() => {});
        }
      }

      if (combatCutInEmbed) {
        scheduleCutInAutoClear(2500);
      }

      // Dispatch any pending Noble Phantasm GIFs asynchronously BELOW the newly relayed Battle Canvas!
      if (pendingNpActors.length > 0) {
        for (const npActor of pendingNpActors) {
          dispatchNpGif(npActor, interactionToEdit || contextInteraction).catch(() => {});
        }
      }
    } catch (relayErr) {
      console.warn('[duel] Battle auto-relay error:', relayErr);
    }
  };

  // If initial fastest combatant is AI, run their turn immediately
  if (activeCombatant.isAi) {
    const opps = getTargetsFor(activeCombatant);
    if (opps.length > 0) {
      const target = opps[0];
      activeCombatant.selectedTargetId = target.userId;
      const aiSequence = chooseAiSequence(activeCombatant);
      if (team1.includes(activeCombatant)) {
        p1LastCards = aiSequence;
      } else {
        p2LastCards = aiSequence;
      }
      const aiDialogue = getCombatantChainDialogue(activeCombatant, aiSequence);
      const alliesList = getMyTeamFor(activeCombatant);
      const aiLog = resolveStrike(activeCombatant, target, aiSequence, aiDialogue, opps, alliesList);
      refreshCombatantHand(activeCombatant);
      combatLogs.push(aiLog);

      // Advance to next living turn
      currentTurnIndex = (currentTurnIndex + 1) % turnOrder.length;
      activeCombatant = turnOrder[currentTurnIndex];
      activeUserId = activeCombatant.userId;
    }
  }

  collector.on('collect', async (i: any) => {
    try {
      if (!isInteractionForThisDuel(i)) return;
      if (i.replied || i.deferred) return;

      // CASE: TARGET SELECTION BUTTON (e.g. target_123456789)
      if (i.customId.startsWith('target_')) {
        if (i.user.id !== activeUserId) {
          await i.reply({
            content: `⏳ It is not your turn! Waiting for <@${activeUserId}> to take an action.`,
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const rawKey = i.customId.replace('target_', '');
        const targetId = rawKey.split('_idx')[0];
        activeCombatant.selectedTargetId = targetId;

        const target = getSelectedTarget(activeCombatant);
        const targetName = target?.servant.nickname || target?.servant.template?.name || 'Target Opponent';
        combatLogs.push(`🎯 **Target Locked:** <@${activeUserId}> set focus on **${targetName}**!`);
        if (combatLogs.length > 4) combatLogs.shift();

        const updatedEmbeds = buildCurrentEmbeds();
        const updatedButtons = buildCurrentButtons();
        const turnAttachment = await buildCurrentAttachment();

        await i.deferUpdate();
        await i.editReply({
          content: buildDuelTurnContent(activeCombatant, activePendingCards),
          embeds: updatedEmbeds,
          files: [turnAttachment],
          components: updatedButtons
        });
        return;
      }

      // CASE: COMBAT STATUS & BUFF INSPECTION DOSSIER
      if (i.customId === 'card_inspect_buffs') {
        const allParticipants: DuelCombatant[] = [...team1, ...team2, ...teamSolo];
        const viewer: DuelCombatant = allParticipants.find((c: DuelCombatant) => c.userId === i.user.id) || activeCombatant;
        const opponent: DuelCombatant | undefined = getSelectedTarget(viewer) || (team1.includes(viewer) ? p2 : p1);
        const allies: DuelCombatant[] = team1.includes(viewer) ? team1 : team2;
        const dossierEmbed = buildTacticalDossierEmbed(viewer, opponent, allies);

        await i.reply({
          embeds: [dossierEmbed],
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      // CASE: COMPREHENSIVE COMBAT LOG & BATTLE CHRONICLE
      if (i.customId === 'card_combat_log' || i.customId === 'duel_combat_log' || i.customId.startsWith('combat_log_page_')) {
        let reqPage = -1; // -1 defaults to latest page
        if (i.customId.startsWith('combat_log_page_')) {
          const parts = i.customId.split('_');
          const pageStr = parts[3];
          if (pageStr === 'indicator') {
            await i.deferUpdate().catch(() => {});
            return;
          }
          reqPage = parseInt(pageStr, 10);
          if (isNaN(reqPage)) reqPage = -1;
        }

        const { embed: combatLogEmbed, components: pageComponents } = buildDetailedCombatLogEmbed(
          p1,
          p2,
          round,
          activeUserId,
          fullCombatHistory,
          p1Ally,
          p2Ally,
          teamSolo,
          reqPage
        );

        if (i.customId.startsWith('combat_log_page_')) {
          await i.update({
            embeds: [combatLogEmbed],
            components: pageComponents
          });
        } else {
          await i.reply({
            embeds: [combatLogEmbed],
            components: pageComponents,
            flags: MessageFlags.Ephemeral
          });
        }
        return;
      }

      // CASE: ALLIANCE TAG ASSIST (+25% ATK & +15 Crit Stars)
      if (i.customId === 'card_alliance_assist' || i.customId === 'duel_act_alliance_assist') {
        const isTeam1Member = team1.some(c => c.userId === i.user.id);
        const isTeam2Member = team2.some(c => c.userId === i.user.id);

        if (!isTeam1Member && !isTeam2Member) {
          await i.reply({
            content: '❌ You are not a combatant in this active duel arena.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (i.user.id !== activeUserId) {
          await i.reply({
            content: `⏳ Alliance Assist can only be triggered during your active turn!`,
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const isT1 = team1.includes(activeCombatant);
        const myTeam = isT1 ? team1 : team2;
        const assistAlreadyUsed = isT1 ? team1AssistUsed : team2AssistUsed;

        if (myTeam.length < 2) {
          await i.reply({
            content: '❌ Alliance Tag Assist requires an active allied Servant on your team!',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (assistAlreadyUsed) {
          await i.reply({
            content: '❌ Your alliance tag assist was already used in this duel (Limit 1 per team per battle)!',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (isT1) {
          team1AssistUsed = true;
        } else {
          team2AssistUsed = true;
        }

        activeCombatant.critStars = Math.min(50, (activeCombatant.critStars || 0) + 15);
        activeCombatant.activeBuffs = activeCombatant.activeBuffs || [];
        activeCombatant.activeBuffs.push({
          name: 'Alliance Tag Assist',
          type: 'buff_atk',
          value: 25,
          remainingTurns: 2
        });

        const assistLog = `🛡️ **ALLIANCE TAG ASSIST ACTIVATED!** Allied partner delivers a coordinated flank strike! **+25% ATK (2 Turns)** & **+15 Critical Stars** generated!`;
        combatLogs.push(assistLog);
        if (combatLogs.length > 4) combatLogs.shift();

        const turnAttachment = await buildCurrentAttachment(assistLog);
        const updatedEmbeds = buildCurrentEmbeds();
        const updatedButtons = buildCurrentButtons();

        await i.deferUpdate();
        await i.editReply({
          content: buildDuelTurnContent(activeCombatant, activePendingCards),
          embeds: updatedEmbeds,
          files: [turnAttachment],
          components: updatedButtons
        });
        return;
      }

      // CASE: FORCE JOIN BUTTON CLICK
      if (i.customId === 'card_forcejoin' || i.customId === 'duel_prompt_forcejoin') {
        recordFallenCombatants();
        const livingT1 = getLivingTeam1();
        const livingT2 = getLivingTeam2();
        const livingTS = getLivingTeamSolo();
        if (livingT1.length + livingT2.length + livingTS.length >= 4) {
          await i.reply({
            content: '❌ Force Join is unavailable! Arena is at maximum capacity (4 living combatants). Wait for a Servant to fall.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        // Loophole fix: Prevent fallen combatants from re-entering or infinite respawning
        const isFallenInThisBattle = fallenMasterIds.has(i.user.id) ||
          team1.some(c => c.userId === i.user.id && c.currentHp <= 0) ||
          team2.some(c => c.userId === i.user.id && c.currentHp <= 0) ||
          teamSolo.some(c => c.userId === i.user.id && c.currentHp <= 0);

        if (isFallenInThisBattle) {
          await i.reply({
            content: '❌ **Eliminated Master:** Your Servant has already fallen in this duel! Fallen combatants cannot re-enter or respawn in the same battle.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        // Prevent existing participants from force-joining multiple times or taking other slots
        const isAlreadyInBattle = duelParticipantIds.has(i.user.id) ||
          team1.some(c => c.userId === i.user.id) ||
          team2.some(c => c.userId === i.user.id) ||
          teamSolo.some(c => c.userId === i.user.id);

        if (isAlreadyInBattle) {
          await i.reply({
            content: '❌ You already have an active Servant standing in this duel!',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const joinerMaster = await getOrCreateMaster(i.user.id, i.user.username);
        if (!joinerMaster.servants || joinerMaster.servants.length === 0) {
          await i.reply({
            content: '❌ You must summon a Servant before force-joining an active battle! Invoke `/summon ritual` first.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        // Safe mode masters cannot intervene in an ongoing war battle, but can freely join Free Battles
        if (!isFreeBattle && joinerMaster.environmentMode === 'safe') {
          await i.reply({
            content: '❌ **Safe Mode Protected:** You are currently in Safe Mode outside of the Holy Grail War. You cannot intervene in an ongoing tournament war battle.\n\n🕊️ You can freely Force Join any **Free Battle** (`/duel mode:free`) sparring match!',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        // Always show options: Ally with Team 1, Ally with Team 2, or Solo Rogue (No Team)
        const p1Leader = livingT1[0] || team1[0] || p1;
        const p2Leader = livingT2[0] || team2[0] || p2;
        const p1Name = p1Leader.username || p1Leader.servant.nickname || p1Leader.servant.template.name;
        const p2Name = p2Leader.username || p2Leader.servant.nickname || p2Leader.servant.template.name;

        const fjButtons: ButtonBuilder[] = [];
        if (livingT1.length < 2) {
          fjButtons.push(
            new ButtonBuilder()
              .setCustomId(`fj_join_team1_${duelSessionId}`)
              .setLabel(`Ally with Team 1 (${p1Name.slice(0, 15)})`)
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🛡️')
          );
        }
        if (livingT2.length < 2) {
          fjButtons.push(
            new ButtonBuilder()
              .setCustomId(`fj_join_team2_${duelSessionId}`)
              .setLabel(`Ally with Team 2 (${p2Name.slice(0, 15)})`)
              .setStyle(ButtonStyle.Danger)
              .setEmoji('⚔️')
          );
        }
        fjButtons.push(
          new ButtonBuilder()
            .setCustomId(`fj_join_solo_${duelSessionId}`)
            .setLabel('👑 Solo Rogue Intervention (No Team)')
            .setStyle(ButtonStyle.Success)
            .setEmoji('⚡')
        );

        const fjRow = new ActionRowBuilder<ButtonBuilder>().addComponents(fjButtons);

        const ephemRes = await i.reply({
          content: `⚡ **FORCE JOIN ARENA:** Select how you wish to intervene in combat (Alliance vs Solo Rogue / No Team):`,
          components: [fjRow],
          flags: MessageFlags.Ephemeral,
          withResponse: true
        }).catch(() => null);
        const ephemMsgId = ephemRes?.resource?.message?.id || ephemRes?.id;
        if (ephemMsgId) {
          battleMessageIds.add(ephemMsgId);
        }
        return;
      }

      // CASE: FORCE JOIN SELECTION RESPONSE (From ephemeral prompt buttons)
      if (i.customId.startsWith('fj_join_team1') || i.customId.startsWith('fj_join_team2') || i.customId.startsWith('fj_join_solo')) {
        if (!i.customId.includes(duelSessionId) && !isInteractionForThisDuel(i)) {
          return;
        }
        recordFallenCombatants();
        const livingT1 = getLivingTeam1();
        const livingT2 = getLivingTeam2();
        const livingTS = getLivingTeamSolo();
        const targetTeam1 = i.customId.startsWith('fj_join_team1');
        const targetTeam2 = i.customId.startsWith('fj_join_team2');
        const targetSolo = i.customId.startsWith('fj_join_solo');

        if (targetTeam1 && livingT1.length >= 2) {
          await i.update({
            content: '❌ Team 1 already has 2 living Servants! Select Team 2 or Solo Rogue.',
            components: []
          });
          return;
        }
        if (targetTeam2 && livingT2.length >= 2) {
          await i.update({
            content: '❌ Team 2 already has 2 living Servants! Select Team 1 or Solo Rogue.',
            components: []
          });
          return;
        }

        const isFallenInThisBattle = fallenMasterIds.has(i.user.id) ||
          team1.some(c => c.userId === i.user.id && c.currentHp <= 0) ||
          team2.some(c => c.userId === i.user.id && c.currentHp <= 0) ||
          teamSolo.some(c => c.userId === i.user.id && c.currentHp <= 0);

        if (isFallenInThisBattle) {
          await i.update({
            content: '❌ **Eliminated Master:** Your Servant has already fallen in this duel! Fallen combatants cannot re-enter or respawn in the same battle.',
            components: []
          });
          return;
        }

        const isAlreadyInBattle = duelParticipantIds.has(i.user.id) ||
          team1.some(c => c.userId === i.user.id) ||
          team2.some(c => c.userId === i.user.id) ||
          teamSolo.some(c => c.userId === i.user.id);

        if (isAlreadyInBattle) {
          await i.update({
            content: '❌ You already have an active Servant standing in this duel!',
            components: []
          });
          return;
        }

        const joinerMaster = await getOrCreateMaster(i.user.id, i.user.username);
        if (!joinerMaster.servants || joinerMaster.servants.length === 0) {
          await i.update({
            content: '❌ You must summon a Servant before force-joining an active battle! Invoke `/summon ritual` first.',
            components: []
          });
          return;
        }

        if (!isFreeBattle && joinerMaster.environmentMode === 'safe') {
          await i.update({
            content: '❌ **Safe Mode Protected:** You are currently in Safe Mode outside of the Holy Grail War. You cannot intervene in an ongoing tournament war battle.\n\n🕊️ You can freely Force Join any **Free Battle** (`/duel mode:free`) sparring match!',
            components: []
          });
          return;
        }

        const joinServant = joinerMaster.servants.find(s => s.id === joinerMaster.activeServantId) || joinerMaster.servants[0];
        const joinName = joinServant.nickname || joinServant.template?.name || 'Heroic Spirit';

        const warSession = getOrInitWarSession(p1Master);
        const joinPart = warSession.participants[joinerMaster.discordId];
        const joinHp = (isFreeBattle || joinerMaster.environmentMode === 'safe') ? undefined : (joinPart ? calculateCurrentHp(joinPart) : undefined);

        if (!isFreeBattle && joinerMaster.environmentMode !== 'safe' && ((joinServant.currentHp !== undefined && joinServant.currentHp <= 0) || (joinHp !== undefined && joinHp <= 0))) {
          await i.update({
            content: `❌ **Incapacitated Servant:** Your Servant **${joinName}** currently has 0 HP and is incapacitated! Restore your Servant before entering combat.`,
            components: []
          });
          return;
        }

        const joinCombatant = createCombatant(joinerMaster, joinServant, false, joinHp, isFreeBattle);
        duelParticipantIds.add(i.user.id);

        joinCombatant.critStars = 20;
        joinCombatant.activeBuffs = joinCombatant.activeBuffs || [];
        joinCombatant.activeBuffs.push({
          name: targetSolo ? 'Rogue Fortitude' : '3rd Master Reinforcement',
          type: 'buff_atk',
          value: 30,
          remainingTurns: 3
        });

        let forceJoinLog = '';
        if (targetSolo) {
          teamSolo.push(joinCombatant);
          turnOrder.push(joinCombatant);
          forceJoinLog = `⚡ **SOLO ROGUE FORCE JOIN INTERVENTION!** <@${i.user.id}> entered the fray with **${joinName}** as a Rogue Contender (NO TEAM - Hostile to All)! Reinforced with **+30% ATK (3T)** & **+20 Critical Stars**!`;
        } else {
          const targetTeam = targetTeam1 ? team1 : team2;
          const deadIndex = targetTeam.findIndex(c => c.currentHp <= 0);
          let replacedCombatant: DuelCombatant | null = null;

          if (deadIndex !== -1) {
            replacedCombatant = targetTeam[deadIndex];
            fallenMasterIds.add(replacedCombatant.userId);
            targetTeam[deadIndex] = joinCombatant;

            const tIdx = turnOrder.findIndex(c => c === replacedCombatant || (c.userId === replacedCombatant?.userId && c.servant?.id === replacedCombatant?.servant?.id));
            if (tIdx !== -1) {
              turnOrder[tIdx] = joinCombatant;
            } else {
              turnOrder.push(joinCombatant);
            }

            if (targetTeam1) {
              if (deadIndex === 0) {
                p1 = joinCombatant;
                p1Master = joinerMaster;
              } else {
                p1Ally = joinCombatant;
                p1AllyMaster = joinerMaster;
              }
            } else {
              if (deadIndex === 0) {
                p2 = joinCombatant;
                p2Master = joinerMaster;
              } else {
                p2Ally = joinCombatant;
                p2AllyMaster = joinerMaster;
              }
            }
          } else {
            if (targetTeam1) {
              p1Ally = joinCombatant;
              p1AllyMaster = joinerMaster;
              team1.push(joinCombatant);
            } else {
              p2Ally = joinCombatant;
              p2AllyMaster = joinerMaster;
              team2.push(joinCombatant);
            }
            turnOrder.push(joinCombatant);
          }

          const teamLeaderName = targetTeam1 ? p1.username : p2.username;
          if (replacedCombatant) {
            forceJoinLog = `⚡ **FORCE JOIN REPLACEMENT!** <@${i.user.id}> entered the fray with **${joinName}** to REPLACE fallen Master **${replacedCombatant.username}** on Team ${targetTeam1 ? '1' : '2'}! Reinforced with **+30% ATK (3T)** & **+20 Critical Stars**!`;
          } else {
            const totalLivingNow = getLivingTeam1().length + getLivingTeam2().length + getLivingTeamSolo().length;
            const joinOrdinal = totalLivingNow === 3 ? '3RD' : totalLivingNow === 4 ? '4TH' : `${totalLivingNow}TH`;
            forceJoinLog = `⚡ **${joinOrdinal} MASTER FORCE JOIN INTERVENTION!** <@${i.user.id}> entered the fray with **${joinName}** to assist **${teamLeaderName}**! Reinforced with **+30% ATK (3T)** & **+20 Critical Stars**!`;
          }
        }
        combatLogs.push(forceJoinLog);
        if (combatLogs.length > 4) combatLogs.shift();

        const turnAttachment = await buildCurrentAttachment(forceJoinLog);
        const updatedEmbeds = buildCurrentEmbeds();
        const updatedButtons = buildCurrentButtons();

        const joinSuccessMsg = targetSolo
          ? `⚡ **FORCE JOIN SUCCESSFUL!** You entered the fray as a Solo Rogue Contender (No Team)!`
          : `⚡ **FORCE JOIN SUCCESSFUL!** You entered the fray to assist **${targetTeam1 ? p1.username : p2.username}**!`;

        await i.update({
          content: joinSuccessMsg,
          components: []
        });

        if (battleMsg) {
          await battleMsg.edit({ embeds: updatedEmbeds, files: [turnAttachment], components: updatedButtons });
        } else if (contextInteraction) {
          await contextInteraction.editReply({ embeds: updatedEmbeds, files: [turnAttachment], components: updatedButtons });
        }
        return;
      }

      // CASE: FORCE JOIN SELECTION RESPONSE (From ephemeral prompt buttons)
      if (i.customId === 'fj_join_team1' || i.customId === 'fj_join_team2') {
        recordFallenCombatants();
        const livingT1 = getLivingTeam1();
        const livingT2 = getLivingTeam2();
        const targetTeam1 = i.customId === 'fj_join_team1';

        if (targetTeam1 && livingT1.length >= 2) {
          await i.update({
            content: '❌ Team 1 already has 2 living Servants! Select Team 2 or wait for a slot to open.',
            components: []
          });
          return;
        }
        if (!targetTeam1 && livingT2.length >= 2) {
          await i.update({
            content: '❌ Team 2 already has 2 living Servants! Select Team 1 or wait for a slot to open.',
            components: []
          });
          return;
        }

        const isFallenInThisBattle = fallenMasterIds.has(i.user.id) ||
          team1.some(c => c.userId === i.user.id && c.currentHp <= 0) ||
          team2.some(c => c.userId === i.user.id && c.currentHp <= 0);

        if (isFallenInThisBattle) {
          await i.update({
            content: '❌ **Eliminated Master:** Your Servant has already fallen in this duel! Fallen combatants cannot re-enter or respawn in the same battle.',
            components: []
          });
          return;
        }

        const isAlreadyInBattle = duelParticipantIds.has(i.user.id) ||
          team1.some(c => c.userId === i.user.id) ||
          team2.some(c => c.userId === i.user.id);

        if (isAlreadyInBattle) {
          await i.update({
            content: '❌ You already have an active Servant standing in this duel!',
            components: []
          });
          return;
        }

        const joinerMaster = await getOrCreateMaster(i.user.id, i.user.username);
        if (!joinerMaster.servants || joinerMaster.servants.length === 0) {
          await i.update({
            content: '❌ You must summon a Servant before force-joining an active battle! Invoke `/summon ritual` first.',
            components: []
          });
          return;
        }

        if (!isFreeBattle && joinerMaster.environmentMode === 'safe') {
          await i.update({
            content: '❌ **Safe Mode Protected:** You are currently in Safe Mode outside of the Holy Grail War. You cannot intervene in an ongoing tournament war battle.\n\n🕊️ You can freely Force Join any **Free Battle** (`/duel mode:free`) sparring match!',
            components: []
          });
          return;
        }

        const joinServant = joinerMaster.servants.find(s => s.id === joinerMaster.activeServantId) || joinerMaster.servants[0];
        const joinName = joinServant.nickname || joinServant.template?.name || 'Heroic Spirit';

        const warSession = getOrInitWarSession(p1Master);
        const joinPart = warSession.participants[joinerMaster.discordId];
        const joinHp = (isFreeBattle || joinerMaster.environmentMode === 'safe') ? undefined : (joinPart ? calculateCurrentHp(joinPart) : undefined);

        if (!isFreeBattle && joinerMaster.environmentMode !== 'safe' && ((joinServant.currentHp !== undefined && joinServant.currentHp <= 0) || (joinHp !== undefined && joinHp <= 0))) {
          await i.update({
            content: `❌ **Incapacitated Servant:** Your Servant **${joinName}** currently has 0 HP and is incapacitated! Restore your Servant before entering combat.`,
            components: []
          });
          return;
        }

        const joinCombatant = createCombatant(joinerMaster, joinServant, false, joinHp, isFreeBattle);
        duelParticipantIds.add(i.user.id);

        joinCombatant.critStars = 20;
        joinCombatant.activeBuffs = joinCombatant.activeBuffs || [];
        joinCombatant.activeBuffs.push({
          name: '3rd Master Reinforcement',
          type: 'buff_atk',
          value: 30,
          remainingTurns: 3
        });

        const targetTeam = targetTeam1 ? team1 : team2;
        const deadIndex = targetTeam.findIndex(c => c.currentHp <= 0);
        let replacedCombatant: DuelCombatant | null = null;

        if (deadIndex !== -1) {
          replacedCombatant = targetTeam[deadIndex];
          fallenMasterIds.add(replacedCombatant.userId);
          targetTeam[deadIndex] = joinCombatant;

          const tIdx = turnOrder.findIndex(c => c === replacedCombatant || (c.userId === replacedCombatant?.userId && c.servant?.id === replacedCombatant?.servant?.id));
          if (tIdx !== -1) {
            turnOrder[tIdx] = joinCombatant;
          } else {
            turnOrder.push(joinCombatant);
          }

          if (targetTeam1) {
            if (deadIndex === 0) {
              p1 = joinCombatant;
              p1Master = joinerMaster;
            } else {
              p1Ally = joinCombatant;
              p1AllyMaster = joinerMaster;
            }
          } else {
            if (deadIndex === 0) {
              p2 = joinCombatant;
              p2Master = joinerMaster;
            } else {
              p2Ally = joinCombatant;
              p2AllyMaster = joinerMaster;
            }
          }
        } else {
          if (targetTeam1) {
            p1Ally = joinCombatant;
            p1AllyMaster = joinerMaster;
            team1.push(joinCombatant);
          } else {
            p2Ally = joinCombatant;
            p2AllyMaster = joinerMaster;
            team2.push(joinCombatant);
          }
          turnOrder.push(joinCombatant);
        }

        const teamLeaderName = targetTeam1 ? p1.username : p2.username;
        let forceJoinLog = '';
        if (replacedCombatant) {
          forceJoinLog = `⚡ **FORCE JOIN REPLACEMENT!** <@${i.user.id}> entered the fray with **${joinName}** to REPLACE fallen Master **${replacedCombatant.username}** on Team ${targetTeam1 ? '1' : '2'}! Reinforced with **+30% ATK (3T)** & **+20 Critical Stars**!`;
        } else {
          const totalLivingNow = getLivingTeam1().length + getLivingTeam2().length;
          const joinOrdinal = totalLivingNow === 3 ? '3RD' : totalLivingNow === 4 ? '4TH' : `${totalLivingNow}TH`;
          forceJoinLog = `⚡ **${joinOrdinal} MASTER FORCE JOIN INTERVENTION!** <@${i.user.id}> entered the fray with **${joinName}** to assist **${teamLeaderName}**! Reinforced with **+30% ATK (3T)** & **+20 Critical Stars**!`;
        }
        combatLogs.push(forceJoinLog);
        if (combatLogs.length > 4) combatLogs.shift();

        const turnAttachment = await buildCurrentAttachment(forceJoinLog);
        const updatedEmbeds = buildCurrentEmbeds();
        const updatedButtons = buildCurrentButtons();

        await i.update({
          content: `⚡ **FORCE JOIN SUCCESSFUL!** You entered the fray to assist **${teamLeaderName}**!`,
          components: []
        });

        if (battleMsg) {
          await battleMsg.edit({ embeds: updatedEmbeds, files: [turnAttachment], components: updatedButtons });
        } else if (contextInteraction) {
          await contextInteraction.editReply({ embeds: updatedEmbeds, files: [turnAttachment], components: updatedButtons });
        }
        return;
      }

      // Enforce Turn Order: Block clicks if it is not this player's turn
      if (i.user.id !== activeUserId) {
        await i.reply({
          content: `⏳ It is not your turn! Waiting for <@${activeUserId}> (${activeCombatant.servant.nickname || activeCombatant.servant.template?.name}) to act.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      // Acknowledge Discord immediately so the 3s timeout never triggers during canvas rendering or async cleanup
      await i.deferUpdate();

      // Clear any active dialogue cut-in auto-disappear timer
      clearCutInTimer();

      // Reset inactivity idle timer on active player action
      collector.resetTimer();

      // Automatically delete active NP GIF asynchronously without delaying interaction
      cleanupNpGif().catch(() => {});

      // CASE: SKILL ACTIVATION (Instant - does NOT end turn)
      if (i.customId.startsWith('skill_')) {
        const skillIdx = parseInt(i.customId.replace('skill_', ''), 10);
        const actor = activeCombatant;
        const opponent = getSelectedTarget(actor) || (team1.includes(actor) ? p2 : p1);
        const alliesList = getMyTeamFor(actor);
        const oppsList = getTargetsFor(actor);
        const res = activateCombatantSkill(actor, skillIdx, opponent, round, alliesList, oppsList);

        if (!res.success) {
          await i.followUp({ content: res.log, flags: MessageFlags.Ephemeral });
          return;
        }

        combatLogs.push(res.log);
        if (combatLogs.length > 4) combatLogs.shift();
        fullCombatHistory.push({
          round,
          actorName: actor.servant.nickname || actor.servant.template.name,
          targetName: opponent ? (opponent.servant.nickname || opponent.servant.template.name) : undefined,
          actionType: 'skill',
          title: `✨ Skill: ${res.skillName || 'Tactical Skill'}`,
          details: res.log.replace(/\n?>\s*.*$/gim, '').replace(/[*_~`]/g, '').trim(),
          timestamp: new Date()
        });

        // Check if this is a transformation skill (e.g. Aoko's Fifth Magic)
        if (res.isTransformation && res.transformationGif) {
          const sName = actor.servant.nickname || actor.servant.template?.name || 'Heroic Spirit';
          const skillName = res.skillName || 'TACTICAL SKILL';
          const skillQuote = res.quote || 'Fifth Magic—Circuits ignition! Time to kick this into maximum gear!';

          const turnAttachment = await buildCurrentAttachment(res.log);
          const mainEmbed = buildCurrentEmbed();
          const updatedButtons = buildCurrentButtons();

          const transEmbed = new EmbedBuilder()
            .setTitle(`🔴 TRANSFORMATION AWAKENED: ${sName.toUpperCase()} (SUPER AOKO)`)
            .setDescription(
              `✨ **${sName}** ignited **${skillName}**!\n\n` +
              `> 💬 ❝ ***${skillQuote}*** ❞\n\n` +
              `⚡ **Fifth Magic True Output:** ATK +30%, Crit DMG +40%, +15 Critical Stars generated!`
            )
            .setImage(res.transformationGif)
            .setColor(0xef4444)
            .setFooter({ text: 'True Magic Ignition • Super Aoko Form Engaged' });

          await i.editReply({
            embeds: [mainEmbed, transEmbed],
            files: [turnAttachment],
            components: updatedButtons
          });
          return;
        }

        // Skill executed successfully!
        const skillName = res.skillName || 'TACTICAL SKILL';
        const skillQuote = res.quote || getServantSkillQuote(actor.servant, skillIdx);
        const sClass = actor.servant.template?.servantClass || 'Saber';
        const avatarUrl = getCombatantSpriteUrl(actor) || actor.avatarUrl;
        const bondLevel = actor.servant.bondLevel || 5;
        const skillType = res.skillType || 'Buff';
        const effectsText = (res as any).effectsText || res.log.replace(/[*_~`]/g, '');

        const skillGifBuffer = await renderSkillDialogueCard(
          actor.servant.nickname || actor.servant.template?.name || 'Heroic Spirit',
          skillName,
          skillQuote,
          sClass,
          avatarUrl,
          bondLevel,
          skillType,
          effectsText,
          battleBgUrl
        ).catch((err) => {
          console.error('Error rendering skill dialogue card:', err);
          return null;
        });

        const turnAttachment = await buildCurrentAttachment(res.log);
        const updatedButtons = buildCurrentButtons();
        const skillEmbeds: EmbedBuilder[] = [];
        const skillFiles: AttachmentBuilder[] = [turnAttachment];

        if (skillGifBuffer) {
          const skillFile = new AttachmentBuilder(skillGifBuffer, { name: 'skill_dialogue.png' });
          skillFiles.push(skillFile);
          const skillEmbed = new EmbedBuilder()
            .setTitle(`✨ [SKILL ACTIVATED] — ${skillName.toUpperCase()}`)
            .setDescription(
              `### ⚔️ **${actor.servant.nickname || actor.servant.template?.name}** *(${sClass})*\n` +
              `> ❝ ***“${skillQuote}”*** ❞\n\n` +
              `✨ **Effect:** ${cleanCanvasText(res.log).replace(/[*_~`]/g, '').trim()}`
            )
            .setImage('attachment://skill_dialogue.png')
            .setColor(0x3b82f6)
            .setFooter({ text: 'Holy Grail War • Tactical Skill Activation' });
          skillEmbeds.push(skillEmbed);
        }

        await i.editReply({
          content: buildDuelTurnContent(activeCombatant, activePendingCards),
          embeds: skillEmbeds,
          files: skillFiles,
          components: updatedButtons
        });
        if (skillGifBuffer) {
          scheduleCutInAutoClear(2500);
        }
        return;
      }

      // CASE: COMMAND SEAL ACTIVATION (Instant - does NOT end turn)
      if (i.customId === 'card_seal') {
        const actor = activeCombatant;
        const actingMaster = activeUserId === p1Master.discordId ? p1Master : (p2Master && activeUserId === p2Master.discordId ? p2Master : null);
        const res = invokeCombatantSeal(actor);

        if (!res.success) {
          await i.followUp({ content: res.log, flags: MessageFlags.Ephemeral });
          return;
        }

        if (actingMaster) {
          if (!isFreeBattle && actingMaster.environmentMode !== 'safe') {
            actingMaster.commandSeals = actor.commandSeals;
            await saveMaster(actingMaster);
          }
        }

        // Command seal invoked successfully
        combatLogs.push(res.log);
        if (combatLogs.length > 4) combatLogs.shift();
        fullCombatHistory.push({
          round,
          actorName: actor.servant.nickname || actor.servant.template.name,
          actionType: 'seal',
          title: `🔴 Command Seal Invoked`,
          details: res.log.replace(/[*_~`]/g, '').trim(),
          timestamp: new Date()
        });

        const masterName = actingMaster?.username || actor.username;
        const masterAvatar = actor.masterAvatarUrl || actingMaster?.avatarUrl;
        const sName = actor.servant.nickname || actor.servant.template?.name || 'Servant';
        const sClass = actor.servant.template?.servantClass || 'Saber';
        const sAvatar = getCombatantSpriteUrl(actor) || actor.avatarUrl;
        const csQuote = res.quote || 'By my Command Seal... unleash your full power!';

        const sealGifBuffer = await renderMasterCommandSealDialogueCard(
          masterName,
          csQuote,
          masterAvatar,
          actor.commandSeals,
          sName,
          sClass,
          sAvatar,
          battleBgUrl
        ).catch((err) => {
          console.error('Error rendering command seal card:', err);
          return null;
        });

        const turnAttachment = await buildCurrentAttachment(res.log);
        const updatedButtons = buildCurrentButtons();
        const sealEmbeds: EmbedBuilder[] = [];
        const sealFiles: AttachmentBuilder[] = [turnAttachment];

        if (sealGifBuffer) {
          const sealFile = new AttachmentBuilder(sealGifBuffer, { name: 'seal_dialogue.png' });
          sealFiles.push(sealFile);
          const sealEmbed = buildMasterCommandSealDialogueCutInEmbed(
            masterName,
            masterAvatar,
            sName,
            sClass,
            csQuote,
            true
          );
          sealEmbed.setImage('attachment://seal_dialogue.png');
          sealEmbeds.push(sealEmbed);
        }

        await i.editReply({
          content: buildDuelTurnContent(activeCombatant, activePendingCards),
          embeds: sealEmbeds,
          files: sealFiles,
          components: updatedButtons
        });
        if (sealGifBuffer) {
          scheduleCutInAutoClear(2500);
        }
        return;
      }

      // CASE: RESET PENDING CARDS
      if (i.customId === 'card_reset') {
        activePendingCards = [];
        activePendingIndices = [];
        const updatedButtons = buildCurrentButtons();
        await i.editReply({
          content: buildDuelTurnContent(activeCombatant, activePendingCards),
          embeds: [],
          components: updatedButtons
        });
        return;
      }

      // CASE: TACTICAL RETREAT / RUN (Consumes active turn)
      if (i.customId === 'card_flee' || i.customId === 'duel_flee' || i.customId === 'card_run') {
        const fleeActor = activeCombatant;
        const sClass = fleeActor.servant.template?.servantClass || 'Saber';
        const agility = fleeActor.servant.template?.baseStats?.agility || fleeActor.servant.allocatedStats?.agility || 10;
        const fleeInfo = calculateFleeChance(fleeActor.currentHp, fleeActor.maxHp, sClass, agility);

        const success = rollFleeSuccess(fleeInfo.chancePercent);

        if (success) {
          fleeActor.isFled = true;

          const warSession = getOrInitWarSession(p1Master);
          const now = Date.now();
          const fleePart = warSession.participants[fleeActor.userId];
          if (fleePart) {
            fleePart.currentHp = Math.min(fleePart.maxHp, Math.max(1, fleeActor.currentHp));
            fleePart.baseHpAtDamage = fleePart.currentHp;
            fleePart.lastDamageTime = now;
          }
          const fleeMaster = fleeActor.userId === p1Master?.discordId
            ? p1Master
            : (p2Master && fleeActor.userId === p2Master.discordId ? p2Master : await getOrCreateMaster(fleeActor.userId, fleeActor.username));
          if (fleeMaster && fleeMaster.servants) {
            const s = fleeMaster.servants.find(serv => serv.id === fleeActor.servant.id);
            if (s) s.currentHp = fleeActor.currentHp;
            await saveMaster(fleeMaster);
          }

          const fleeServantName = fleeActor.servant.nickname || fleeActor.servant.template?.name || 'Heroic Spirit';
          const fleeSuccessLog = `🏃 **Tactical Retreat Successful!** **${fleeServantName}** (Master: ${fleeActor.username}) broke line of sight and safely disengaged from combat! (${fleeInfo.chancePercent}% chance • HP Preserved: ${fleeActor.currentHp.toLocaleString()}/${fleeActor.maxHp.toLocaleString()})`;
          combatLogs.push(fleeSuccessLog);
          if (combatLogs.length > 4) combatLogs.shift();

          const livingT1 = getLivingTeam1();
          const livingT2 = getLivingTeam2();
          const livingTS = getLivingTeamSolo();
          const activeFactionsCount = (livingT1.length > 0 ? 1 : 0) + (livingT2.length > 0 ? 1 : 0) + livingTS.length;

          if (activeFactionsCount <= 1) {
            collector.stop('flee_success');

            const retreatEmbed = new EmbedBuilder()
              .setTitle('🏃 TACTICAL RETREAT — COMBAT CONCLUDED')
              .setDescription(
                `**${fleeServantName}** broke line of sight and safely disengaged from combat!\n\n` +
                `> *"A tactical withdrawal preserves the spirit for the decisive battle."*\n\n` +
                `🛡️ **Retreat Outcome:**\n` +
                `• Turn ${round} Action: **Tactical Retreat (Turn Consumed)**\n` +
                `• Escape Success Rate: **${fleeInfo.chancePercent}%**${fleeInfo.isAgilityBonus ? ' *(+5% Agility bonus applied)*' : ''}\n` +
                `• Current HP Preserved: **${fleeActor.currentHp.toLocaleString()} / ${fleeActor.maxHp.toLocaleString()}**\n` +
                `• No Holy Grail War rating penalties or win streak deductions were incurred.`
              )
              .setColor(0xf59e0b)
              .setFooter({ text: `Holy Grail War Engine • Round ${round} • Retreat Success Rate: ${fleeInfo.chancePercent}%` });

            await i.editReply({ embeds: [retreatEmbed], components: [] });
            return;
          } else {
            await advanceTurn(i);
            return;
          }
        } else {
          activePendingCards = [];
          activePendingIndices = [];
          refreshCombatantHand(fleeActor);

          const counterDmg = 2000;
          fleeActor.currentHp = Math.max(0, fleeActor.currentHp - counterDmg);

          const fleeFailLog = `🏃 **Retreat Failed!** (${fleeInfo.chancePercent}% chance) Turn consumed — Opponent intercepted and counter-attacked for **${counterDmg.toLocaleString()} DMG**!`;
          combatLogs.push(fleeFailLog);
          if (combatLogs.length > 4) combatLogs.shift();

          if (fleeActor.currentHp <= 0) {
            fallenMasterIds.add(fleeActor.userId);
            recordFallenCombatants();
            const killLog = `💀 **${fleeActor.servant.nickname || fleeActor.servant.template.name}** (Master: ${fleeActor.username}) was vanquished while attempting to flee!`;
            combatLogs.push(killLog);
            if (combatLogs.length > 4) combatLogs.shift();
            await advanceTurn(i);
            return;
          }

          await advanceTurn(i);
          return;
        }
      }

      // CASE: HAND CARD SELECTION
      const attacker = activeCombatant;
      const defender = getSelectedTarget(attacker);

      if (!defender) {
        await advanceTurn(i);
        return;
      }

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

      if (activePendingCards.length === 1) {
        await cleanupNpGif();
      }

      if (activePendingCards.length < 3) {
        const updatedButtons = buildCurrentButtons();
        await i.editReply({
          content: buildDuelTurnContent(activeCombatant, activePendingCards),
          embeds: [],
          components: updatedButtons
        });
        return;
      }

      // 3 CARDS SELECTED -> Execute 3-Card Chain Attack Sequence!
      const playerSequence = [...activePendingCards];
      activePendingCards = [];
      activePendingIndices = [];

      const playerDialogue = getCombatantChainDialogue(attacker, playerSequence, round);
      const isNoblePhantasm = playerSequence.includes('NP');

      const shouldCutIn = shouldTriggerDialogueCutIn(
        playerSequence,
        attacker.currentHp,
        attacker.maxHp
      );

      const pendingNpList: DuelCombatant[] = [];
      if (isNoblePhantasm) {
        pendingNpList.push(attacker);
      }

      const opps = getTargetsFor(attacker);
      const allies = getMyTeamFor(attacker);
      const log = resolveStrike(attacker, defender, playerSequence, playerDialogue, opps, allies);
      refreshCombatantHand(attacker);
      combatLogs.push(log);
      if (combatLogs.length > 4) combatLogs.shift();
      fullCombatHistory.push({
        round,
        actorName: attacker.servant.nickname || attacker.servant.template.name,
        targetName: defender ? (defender.servant.nickname || defender.servant.template.name) : undefined,
        actionType: 'attack',
        title: `🎴 [${playerSequence.join(' ➔ ')}] ${isNoblePhantasm ? 'Noble Phantasm' : 'Chain Strike'}`,
        details: cleanCanvasText(log).replace(/[*_~`]/g, '').trim(),
        timestamp: new Date()
      });

      if (team1.includes(attacker)) {
        p1LastCards = playerSequence;
      } else {
        p2LastCards = playerSequence;
      }

      // Check if Defender was slain
      if (defender.currentHp <= 0) {
        fallenMasterIds.add(defender.userId);
        recordFallenCombatants();
        const killLog = `💀 **${defender.servant.nickname || defender.servant.template.name}** (Master: ${defender.username}) was vanquished!`;
        combatLogs.push(killLog);
        if (combatLogs.length > 4) combatLogs.shift();
      }

      // Render combat dialogue cut-in GIF card
      let combatCutInEmbed: EmbedBuilder | null = null;
      let combatCutInFile: AttachmentBuilder | null = null;

      if (shouldCutIn) {
        const cutInGifBuffer = await renderDialogueCard(
          attacker.servant.nickname || attacker.servant.template?.name || 'Heroic Spirit',
          playerDialogue.quote,
          playerDialogue.tag,
          attacker.servant.template?.servantClass || 'Saber',
          getCombatantSpriteUrl(attacker) || attacker.avatarUrl,
          attacker.servant.bondLevel || 5,
          defender.servant.nickname || defender.servant.template?.name || 'Opponent',
          getCombatantSpriteUrl(defender) || defender.avatarUrl,
          defender.servant.template?.servantClass || 'Saber',
          playerSequence,
          battleBgUrl
        ).catch(err => {
          console.error('Error rendering combat dialogue card:', err);
          return null;
        });

        if (cutInGifBuffer) {
          combatCutInFile = new AttachmentBuilder(cutInGifBuffer, { name: 'vn_dialogue.gif' });
          combatCutInEmbed = buildDialogueCutInEmbed(attacker, defender, playerSequence, playerDialogue, true);
        }
      }

      // Advance to the next player's / servant's turn!
      await advanceTurn(i, pendingNpList, combatCutInEmbed, combatCutInFile);
    } catch (err: any) {
      if (
        err.code === 10062 || 
        err.code === 40060 || 
        err.code === 50027 || 
        err.code === 10008 ||
        err.code === 50001 ||
        err.status === 403 ||
        err.status === 404 ||
        err.message?.includes('Unknown interaction') || 
        err.message?.includes('Unknown Message') || 
        err.message?.includes('already been acknowledged')
      ) return;
      console.error('Error in duel battle collector:', err);
    }
  });

  collector.on('end', async (_collected: any, reason: string) => {
    if (reason === 'idle' || reason === 'time') {
      await cleanupNpGif();
      try {
        await battleMsg.edit({
          content: '⌛ **Duel ended due to inactivity** *(Turn timed out after 5 minutes of no input)*.',
          components: []
        });
      } catch {}
    }
  });
}

// ==========================================
// 11. VICTORY REWARDS & DUEL CONCLUSION (1v1, 2v2 & 1v2 MULTI-MASTER SUPPORT)
// ==========================================
async function finishDuel(
  i: any,
  winnerOrTeam: DuelCombatant | DuelCombatant[],
  loserOrTeam: DuelCombatant | DuelCombatant[],
  p1Master: MasterProfile,
  p2Master: MasterProfile | null,
  finalAttachment: AttachmentBuilder,
  isFreeBattle?: boolean,
  battlefieldBgUrl?: string
) {
  const battleBgUrl = battlefieldBgUrl || getRandomBackgroundUrl();
  const winningTeam = Array.isArray(winnerOrTeam) ? winnerOrTeam : [winnerOrTeam];
  const primaryWinner = winningTeam.find(c => c.currentHp > 0) || winningTeam[0];
  const losingTeam = Array.isArray(loserOrTeam) ? loserOrTeam : [loserOrTeam];

  // Identify all combatants on the losing team who have fallen
  let defeatedCombatants = losingTeam.filter(c => c.currentHp <= 0);
  if (defeatedCombatants.length === 0) {
    defeatedCombatants = [...losingTeam];
  }

  const warSession = getOrInitWarSession(p1Master);
  const chanTag = i.channel && 'name' in i.channel ? `#${(i.channel as any).name}` : '#general';

  interface DefeatedTargetState {
    combatant: DuelCombatant;
    master: MasterProfile;
    participant?: any;
    availableSeals: number;
    autoConsume: boolean;
    evacuated: boolean;
    evacQuote?: string;
    fate?: 'kill' | 'spare';
    winnerReaction?: string;
    loserReaction?: string;
    bountyClaimText?: string;
  }

  const defeatedStates: DefeatedTargetState[] = [];
  for (const c of defeatedCombatants) {
    const m = c.userId === p1Master.discordId
      ? p1Master
      : (p2Master && c.userId === p2Master.discordId ? p2Master : await getOrCreateMaster(c.userId, c.username));
    const part = warSession?.participants[c.userId] ||
      Object.values(warSession?.participants || {}).find(p => p.username.toLowerCase() === c.username.toLowerCase() || p.servantName.toLowerCase() === c.servant.template.name.toLowerCase());
    const availableSeals = m ? (m.commandSeals ?? 3) : (part?.commandSeals ?? c.commandSeals ?? 3);
    const autoConsume = m
      ? (m.autoConsumeCommandSeal === true)
      : (part?.autoEvadeEnabled === true || part?.autoConsumeCommandSeal === true);

    defeatedStates.push({
      combatant: c,
      master: m,
      participant: part,
      availableSeals,
      autoConsume,
      evacuated: false
    });
  }

  const winnerName = primaryWinner.servant.nickname || primaryWinner.servant.template?.name || 'Heroic Spirit';
  const winnerClass = primaryWinner.servant.template?.servantClass || 'Saber';
  const winnerAvatarUrl = getCombatantSpriteUrl(primaryWinner) || primaryWinner.servant.template?.avatarUrl;

  const primaryLoser = defeatedStates[0].combatant;
  const loserName = primaryLoser.servant.nickname || primaryLoser.servant.template?.name || 'Heroic Spirit';
  const loserClass = primaryLoser.servant.template?.servantClass || 'Saber';
  const loserAvatarUrl = getCombatantSpriteUrl(primaryLoser) || primaryLoser.servant.template?.avatarUrl;
  const loserBond = primaryLoser.servant.bondLevel || 5;
  const loserDefeatQuote = primaryLoser.servant.customQuotes?.defeat || primaryLoser.servant.template?.defeatQuote || "Master... I have failed you in battle...";

  // 1. Process immediate Auto-Consume Evacuations
  for (const state of defeatedStates) {
    if (state.availableSeals >= 1 && !state.combatant.isAi && state.autoConsume === true) {
      if (state.master) {
        state.master.commandSeals = Math.max(0, state.availableSeals - 1);
        const sServant = state.master.servants?.find(s => s.id === state.combatant.servant.id);
        if (sServant) sServant.currentHp = 1;
        await saveMaster(state.master);
      }
      if (state.participant) {
        state.participant.commandSeals = Math.max(0, state.availableSeals - 1);
        state.participant.currentHp = 1;
        state.participant.baseHpAtDamage = 1;
        state.participant.lastDamageTime = Date.now();
        state.participant.isAlive = true;
        state.participant.inSanctuary = true;
      }
      state.evacuated = true;
      state.availableSeals = Math.max(0, state.availableSeals - 1);
      try {
        state.evacQuote = await generateServantBattleReaction({
          servant: state.combatant.servant,
          masterName: state.combatant.username,
          masterId: state.combatant.userId,
          role: 'evacuated',
          outcomeDecision: 'evacuate',
          opponentName: winnerName,
          opponentMaster: primaryWinner.username,
          currentHp: 1,
          maxHp: state.combatant.maxHp,
          warId: warSession?.id
        });
      } catch {}
    }
  }

  // Visual novel defeat card for primary loser
  const defeatCardBuffer = await renderDefeatDialogueCard(
    loserName,
    loserDefeatQuote,
    defeatedStates[0].availableSeals >= 1 ? 'CRITICAL DEFEAT' : 'SPIRIT ORIGIN DISSOLVED',
    loserClass,
    loserAvatarUrl,
    loserBond,
    winnerName,
    winnerAvatarUrl,
    winnerClass,
    battleBgUrl
  ).catch(() => null);

  const defeatCardAttachment = defeatCardBuffer
    ? new AttachmentBuilder(defeatCardBuffer, { name: 'defeat_dialogue.png' })
    : null;

  const summaryEmbed = new EmbedBuilder()
    .setTitle('⚔️ FINAL COMBAT ROUND SUMMARY')
    .setDescription(`**${winnerName}** dealt the final blow in this Holy Grail duel!`)
    .setImage('attachment://turn_summary.png')
    .setColor(0x0f172a);

  let targetMsg: any = null;

  // If this is a Free Battle / Sparring match (Outside active war elimination)
  if (isFreeBattle) {
    for (const state of defeatedStates) {
      state.evacuated = true;
      state.fate = 'spare';
    }

    const rewardReport = await finalizeDuelRewardsAndSync(winningTeam, defeatedStates, warSession, chanTag, primaryWinner, isFreeBattle);

    const multBanner = rewardReport.enemyBeatenMultiplier > 1
      ? ` 🔥 **[${rewardReport.enemyBeatenMultiplier}x Enemy Defeat Multiplier Active!]** *(Scaled for defeating ${defeatedStates.length} enemy Servants)*\n\n`
      : '\n\n';

    const freeBattleEmbed = new EmbedBuilder()
      .setTitle(`🕊️ FREE BATTLE CONCLUDED — ${rewardReport.matchFormatTitle.toUpperCase()}`)
      .setDescription(
        `**${winnerName}** (Master: ${primaryWinner.username}) emerged victorious in this friendly sparring match!${multBanner}` +
        `• **Format:** 🕊️ Free Battle / Safe Mode (${winningTeam.length}v${defeatedStates.length})\n` +
        `• **Stakes:** Zero tournament elimination — Servants, Command Seals, and Master standing remain completely intact.\n\n` +
        `🏆 **Victorious Team Rewards:**\n` +
        rewardReport.winnerRewardLines.join('\n') +
        `\n\n🎗️ **Sparring Participant Rewards:**\n` +
        rewardReport.loserRewardLines.join('\n') +
        `\n\n💡 *Level EXP increases Servant Level & grants **+10 Unspent Stat Points** per Level Up! Allocate via \`/servant\` or \`/customise stats\`.*`
      )
      .setColor(0x38bdf8)
      .setFooter({ text: `Holy Grail War • Safe Mode Free Battle • ${rewardReport.enemyBeatenMultiplier}x Multiplier Active` });

    const files = [finalAttachment];
    if (defeatCardAttachment) files.push(defeatCardAttachment);

    await (targetMsg ? targetMsg.edit({ embeds: [summaryEmbed, freeBattleEmbed], files, components: [] }) : i.editReply({ embeds: [summaryEmbed, freeBattleEmbed], files, components: [] })).catch(async () => {
      if (i.channel && typeof i.channel.send === 'function') {
        await i.channel.send({ embeds: [summaryEmbed, freeBattleEmbed], files, components: [] }).catch(() => {});
      }
    });
    return;
  }

  // 2. Identify defeated Masters needing manual Command Seal decision
  const pendingEvacStates = defeatedStates.filter(s => !s.evacuated && !s.combatant.isAi && s.availableSeals >= 1);

  if (pendingEvacStates.length > 0) {
    const isMulti = pendingEvacStates.length > 1;
    const decisionEmbed = new EmbedBuilder()
      .setTitle(isMulti ? `⚠️ CRITICAL DEFEAT — COMMAND SEAL DECISIONS (${pendingEvacStates.length} MASTERS)` : '⚠️ CRITICAL DEFEAT — COMMAND SEAL DECISION')
      .setDescription(
        isMulti
          ? `**${winnerName}** (Master: ${primaryWinner.username}) and allies have defeated the opposing Masters!\n\n` +
            `🔮 **Command Seal Evacuation Available:**\n` +
            pendingEvacStates.map(s => `• Master **${s.combatant.username}** (${s.combatant.servant.nickname || s.combatant.servant.template?.name}): **${s.availableSeals}/3 Command Seals**`).join('\n') +
            `\n\nWhen a Master loses, they get a last chance to expend **1 Command Seal** to run and emergency-teleport their Servant to safety preserved at **1 HP**, preventing contract severance and Holy Grail War elimination.\n\n` +
            `⏱️ **Time Limit:** Each defeated Master has **1 minute (60 seconds)** to decide. If time expires or defeat is taken, the victor will decide your fate.`
          : `**${winnerName}** (Master: ${primaryWinner.username}) dealt a mortal blow to **${loserName}** (Master: ${pendingEvacStates[0].combatant.username})!\n\n` +
            `🔮 **Command Seal Evacuation Available:** Defeated Master **${pendingEvacStates[0].combatant.username}** possesses **${pendingEvacStates[0].availableSeals}/3 Command Seals**.\n` +
            `When a Master loses, they get a last chance to expend **1 Command Seal** to run and emergency-teleport their Servant to safety preserved at **1 HP**, preventing contract severance and Holy Grail War elimination.\n\n` +
            `⏱️ **Time Limit:** You have **1 minute (60 seconds)** to decide. If time expires or defeat is taken, the victor will decide your fate.\n` +
            `*(Auto-consume option is OFF by default to protect your Command Seals)*`
      )
      .setColor(0xf59e0b)
      .setFooter({ text: 'Holy Grail War Survival Protocol • 1-Minute Decision Window' });

    if (loserAvatarUrl && !isMulti) {
      safeSetEmbedThumbnail(decisionEmbed, loserAvatarUrl);
    }
    if (defeatCardAttachment) {
      decisionEmbed.setImage('attachment://defeat_dialogue.png');
    }

    const buildEvacRows = (resolvedMap: Map<string, 'run' | 'defeat'>) => {
      return pendingEvacStates.map(s => {
        const status = resolvedMap.get(s.combatant.userId);
        if (status === 'run') {
          return new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`duel_evacuate_seal_${s.combatant.userId}`)
              .setLabel(isMulti ? `✅ ${s.combatant.username}: Evacuated (${s.availableSeals}/3 Seals)` : `✅ Evacuated with Command Seal (${s.availableSeals}/3)`)
              .setEmoji('🔮')
              .setStyle(ButtonStyle.Success)
              .setDisabled(true)
          );
        }
        if (status === 'defeat') {
          return new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`duel_accept_defeat_${s.combatant.userId}`)
              .setLabel(isMulti ? `💀 ${s.combatant.username}: Defeat Accepted` : '💀 Defeat Accepted (Awaiting Victor\'s Fate)')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true)
          );
        }
        return new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`duel_evacuate_seal_${s.combatant.userId}`)
            .setLabel(isMulti ? `Run: ${s.combatant.username} (${s.availableSeals}/3)` : `Use Command Seal to Run (${s.availableSeals}/3)`)
            .setEmoji('🔮')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`duel_accept_defeat_${s.combatant.userId}`)
            .setLabel(isMulti ? `Take Defeat: ${s.combatant.username}` : 'Take Defeat')
            .setEmoji('💀')
            .setStyle(ButtonStyle.Secondary)
        );
      });
    };

    const initialFiles = [finalAttachment];
    if (defeatCardAttachment) initialFiles.push(defeatCardAttachment);

    const initialEvacMap = new Map<string, 'run' | 'defeat'>();
    const initialRows = buildEvacRows(initialEvacMap);

    try {
      if (i.channel && typeof i.channel.send === 'function') {
        if (i.deleteReply) {
          await i.deleteReply().catch(() => {});
        }
        targetMsg = await i.channel.send({
          embeds: [summaryEmbed, decisionEmbed],
          files: initialFiles,
          components: initialRows
        });
      } else if (i.deferred || i.replied) {
        targetMsg = await i.editReply({
          embeds: [summaryEmbed, decisionEmbed],
          files: initialFiles,
          components: initialRows
        });
      } else {
        targetMsg = await i.update({
          embeds: [summaryEmbed, decisionEmbed],
          files: initialFiles,
          components: initialRows
        });
      }
    } catch {
      if (i.deferred || i.replied) {
        targetMsg = await i.editReply({
          embeds: [summaryEmbed, decisionEmbed],
          files: initialFiles,
          components: initialRows
        }).catch(() => null);
      }
    }

    if (!targetMsg && i.fetchReply) {
      targetMsg = await i.fetchReply().catch(() => null);
    }

    if (targetMsg && typeof targetMsg.createMessageComponentCollector === 'function') {
      const evacCollector = targetMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000
      });

      await new Promise<void>((resolve) => {
        let allDone = false;

        evacCollector.on('collect', async (decision: any) => {
          const customId = decision.customId;
          const targetState = pendingEvacStates.find(s =>
            customId === `duel_evacuate_seal_${s.combatant.userId}` ||
            customId === `duel_accept_defeat_${s.combatant.userId}` ||
            (pendingEvacStates.length === 1 && (customId === 'duel_evacuate_seal' || customId === 'duel_accept_defeat'))
          );

          if (!targetState) return;

          if (decision.user.id !== targetState.combatant.userId) {
            await decision.reply({
              content: `⏳ Only defeated Master <@${targetState.combatant.userId}> can decide their Command Seal evacuation!`,
              flags: MessageFlags.Ephemeral
            }).catch(() => {});
            return;
          }

          await decision.deferUpdate().catch(() => {});

          if (customId.startsWith('duel_evacuate_seal') || customId === 'duel_evacuate_seal') {
            if (targetState.master) {
              targetState.master.commandSeals = Math.max(0, targetState.availableSeals - 1);
              const sLoser = targetState.master.servants?.find(s => s.id === targetState.combatant.servant.id);
              if (sLoser) sLoser.currentHp = 1;
              await saveMaster(targetState.master);
            }
            if (targetState.participant) {
              targetState.participant.commandSeals = Math.max(0, targetState.availableSeals - 1);
              targetState.participant.currentHp = 1;
              targetState.participant.baseHpAtDamage = 1;
              targetState.participant.lastDamageTime = Date.now();
              targetState.participant.isAlive = true;
              targetState.participant.inSanctuary = true;
            }
            targetState.evacuated = true;
            targetState.availableSeals = Math.max(0, targetState.availableSeals - 1);
            try {
              targetState.evacQuote = await generateServantBattleReaction({
                servant: targetState.combatant.servant,
                masterName: targetState.combatant.username,
                masterId: targetState.combatant.userId,
                role: 'evacuated',
                outcomeDecision: 'evacuate',
                opponentName: winnerName,
                opponentMaster: primaryWinner.username,
                currentHp: 1,
                maxHp: targetState.combatant.maxHp,
                warId: warSession?.id
              });
            } catch {}
            initialEvacMap.set(targetState.combatant.userId, 'run');
          } else {
            targetState.evacuated = false;
            initialEvacMap.set(targetState.combatant.userId, 'defeat');
          }

          const updatedRows = buildEvacRows(initialEvacMap);
          await decision.editReply({ components: updatedRows }).catch(async () => {
            await targetMsg?.edit({ components: updatedRows }).catch(() => {});
          });

          if (initialEvacMap.size >= pendingEvacStates.length) {
            if (!allDone) {
              allDone = true;
              evacCollector.stop('all_resolved');
              resolve();
            }
          }
        });

        evacCollector.on('end', async (_collected: any, _reason: string) => {
          if (!allDone) {
            allDone = true;
            for (const s of pendingEvacStates) {
              if (!initialEvacMap.has(s.combatant.userId)) {
                initialEvacMap.set(s.combatant.userId, 'defeat');
                s.evacuated = false;
              }
            }
            resolve();
          }
        });
      });
    }
  }

  // 3. Victor's Fate Decision for all defeated Masters who did not evacuate
  const pendingFateStates = defeatedStates.filter(s => !s.evacuated);

  // If all defeated masters evacuated using Command Seals, conclude with Sanctuary!
  if (pendingFateStates.length === 0) {
    const rewardReport = await finalizeDuelRewardsAndSync(winningTeam, defeatedStates, warSession, chanTag, primaryWinner, isFreeBattle);

    const sanctuaryEmbed = new EmbedBuilder()
      .setTitle(`🔴 COMMAND SEAL EMERGENCY SANCTUARY — ${rewardReport.matchFormatTitle.toUpperCase()}`)
      .setDescription(
        `**${winnerName}** (Master: ${primaryWinner.username}) dealt decisive strikes to the opposing team in this **${rewardReport.matchFormatTitle}**!\n\n` +
        defeatedStates.map(s =>
          `✨ **Master ${s.combatant.username}:** Expended 1 Command Seal (${s.availableSeals}/3 remaining). Servant preserved at **1 HP** and evacuated to sanctuary!\n` +
          (s.evacQuote ? `> 💬 ❝ ***${s.evacQuote}*** ❞\n` : '')
        ).join('\n') +
        `\nContract preserved. Permanent elimination has been averted for all defeated Masters.\n\n` +
        `💰 **Combat Rewards Distributed:**\n` +
        rewardReport.rewardsSummaryText
      )
      .setColor(0xf59e0b)
      .setFooter({ text: 'Holy Grail War Survival Protocol • Sanctuary Activated' });

    const evacFiles = [finalAttachment];
    if (defeatCardAttachment) evacFiles.push(defeatCardAttachment);

    await targetMsg?.edit({
      embeds: [summaryEmbed, sanctuaryEmbed],
      files: evacFiles,
      components: []
    }).catch(async () => {
      if (i.channel && typeof i.channel.send === 'function') {
        await i.channel.send({
          embeds: [summaryEmbed, sanctuaryEmbed],
          files: evacFiles,
          components: []
        }).catch(() => {});
      }
    });
    return;
  }

  // If primaryWinner is AI: Eliminate all defeated masters immediately
  if (primaryWinner.isAi) {
    for (const s of pendingFateStates) {
      s.fate = 'kill';
      recordDuelOutcome(warSession, primaryWinner.username, s.combatant.username, 'kill', chanTag, primaryWinner.currentHp, 0);
    }
    await finalizeDuelRewardsAndSync(winningTeam, defeatedStates, warSession, chanTag, primaryWinner, isFreeBattle);

    const defeatEmbed = new EmbedBuilder()
      .setTitle('☠️ FATAL DUEL DEFEAT — OPPONENT ELIMINATED')
      .setDescription(
        `**${winnerName}** (Master: ${primaryWinner.username}) has eliminated the defeated rival(s)!\n\n` +
        pendingFateStates.map(s => `• Master **${s.combatant.username}** (${s.combatant.servant.template?.name}) was slain and eliminated from the Holy Grail War.`).join('\n')
      )
      .setColor(0xef4444);

    const aiFiles = [finalAttachment];
    if (defeatCardAttachment) aiFiles.push(defeatCardAttachment);

    await targetMsg?.edit({
      embeds: [summaryEmbed, defeatEmbed],
      files: aiFiles,
      components: []
    }).catch(() => {});
    return;
  }

  // Player victor: Prompt for Kill vs Spare for EACH defeated Master who took defeat
  const isMultiFate = pendingFateStates.length > 1;
  const fateEmbed = new EmbedBuilder()
    .setTitle(isMultiFate ? `⚖️ FATE DECISIONS — DECIDE DEFEATED MASTERS' FATE (${pendingFateStates.length} MASTERS)` : '⚖️ FATE DECISION — DECIDE MASTER\'S FATE')
    .setDescription(
      isMultiFate
        ? `⚖️ **The Fate of ${pendingFateStates.length} Defeated Masters rests in your hands, Master <@${primaryWinner.userId}>:**\n\n` +
          `Choose whether to **Execute** each defeated Master to permanently eliminate them from the Holy Grail War, or show mercy and **Spare** their life:\n\n` +
          pendingFateStates.map(s => `• Master **${s.combatant.username}** (${s.combatant.servant.nickname || s.combatant.servant.template?.name}):\n  💬 *"${s.combatant.servant.customQuotes?.defeat || s.combatant.servant.template?.defeatQuote || "Master... I have failed you in battle..."}"*`).join('\n\n')
        : `⚖️ **The Fate of Master ${pendingFateStates[0].combatant.username} rests in your hands, Master <@${primaryWinner.userId}>:**\n\n` +
          `Choose whether to **Execute** the defeated Master to permanently eliminate them from the Holy Grail War, or show mercy and **Spare** their life.\n\n` +
          `💬 **[DEFEAT MONOLOGUE] ${pendingFateStates[0].combatant.servant.nickname || pendingFateStates[0].combatant.servant.template?.name}:**\n> ❝ ***${pendingFateStates[0].combatant.servant.customQuotes?.defeat || pendingFateStates[0].combatant.servant.template?.defeatQuote || "Master... I have failed you in battle..."}*** ❞`
    )
    .setColor(0xef4444);

  if (loserAvatarUrl && !isMultiFate) {
    safeSetEmbedThumbnail(fateEmbed, loserAvatarUrl);
  }
  if (defeatCardAttachment) {
    fateEmbed.setImage('attachment://defeat_dialogue.png');
  }

  const buildFateRows = (resolvedMap: Map<string, 'kill' | 'spare'>) => {
    return pendingFateStates.map(s => {
      const decision = resolvedMap.get(s.combatant.userId);
      if (decision === 'kill') {
        return new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`duel_fate_kill_${s.combatant.userId}`)
            .setLabel(isMultiFate ? `☠️ ${s.combatant.username}: Executed` : '☠️ Master Executed (Eliminated)')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
        );
      }
      if (decision === 'spare') {
        return new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`duel_fate_spare_${s.combatant.userId}`)
            .setLabel(isMultiFate ? `🕊️ ${s.combatant.username}: Spared` : '🕊️ Master Spared (Mercy Bestowed)')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true)
        );
      }
      return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`duel_fate_kill_${s.combatant.userId}`)
          .setLabel(isMultiFate ? `☠️ Execute ${s.combatant.username}` : '☠️ Execute Master (Kill & Eliminate)')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`duel_fate_spare_${s.combatant.userId}`)
          .setLabel(isMultiFate ? `🕊️ Spare ${s.combatant.username}` : '🕊️ Spare Master (Show Mercy)')
          .setStyle(ButtonStyle.Success)
      );
    });
  };

  const initialFateMap = new Map<string, 'kill' | 'spare'>();
  const initialFateRows = buildFateRows(initialFateMap);

  const fateFiles = [finalAttachment];
  if (defeatCardAttachment) fateFiles.push(defeatCardAttachment);

  try {
    if (targetMsg && typeof targetMsg.edit === 'function') {
      await targetMsg.edit({
        embeds: [summaryEmbed, fateEmbed],
        files: fateFiles,
        components: initialFateRows
      });
    } else if (i.channel && typeof i.channel.send === 'function') {
      targetMsg = await i.channel.send({
        embeds: [summaryEmbed, fateEmbed],
        files: fateFiles,
        components: initialFateRows
      });
    }
  } catch {}

  const allowedVictorIds = new Set([
    primaryWinner.userId,
    ...winningTeam.filter(w => w.currentHp > 0).map(w => w.userId)
  ]);

  if (targetMsg && typeof targetMsg.createMessageComponentCollector === 'function') {
    const fateCollector = targetMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000
    });

    await new Promise<void>((resolve) => {
      let fateFinished = false;

      fateCollector.on('collect', async (confirmation: any) => {
        if (!allowedVictorIds.has(confirmation.user.id)) {
          await confirmation.reply({
            content: `⏳ Only the victorious Master (<@${primaryWinner.userId}>) can decide the defeated Masters' fate!`,
            flags: MessageFlags.Ephemeral
          }).catch(() => {});
          return;
        }

        await confirmation.deferUpdate().catch(() => {});

        const customId = confirmation.customId;
        const targetState = pendingFateStates.find(s =>
          customId === `duel_fate_kill_${s.combatant.userId}` ||
          customId === `duel_fate_spare_${s.combatant.userId}` ||
          (pendingFateStates.length === 1 && (customId === 'duel_fate_kill' || customId === 'duel_fate_spare'))
        );

        if (!targetState) return;

        const decision = (customId.startsWith('duel_fate_kill') || customId === 'duel_fate_kill') ? 'kill' : 'spare';
        targetState.fate = decision;
        initialFateMap.set(targetState.combatant.userId, decision);

        const updatedRows = buildFateRows(initialFateMap);
        await confirmation.editReply({ components: updatedRows }).catch(async () => {
          await targetMsg?.edit({ components: updatedRows }).catch(() => {});
        });

        if (initialFateMap.size >= pendingFateStates.length) {
          if (!fateFinished) {
            fateFinished = true;
            fateCollector.stop('all_resolved');
            resolve();
          }
        }
      });

      fateCollector.on('end', async (_collected: any, _reason: string) => {
        if (!fateFinished) {
          fateFinished = true;
          for (const s of pendingFateStates) {
            if (!initialFateMap.has(s.combatant.userId)) {
              initialFateMap.set(s.combatant.userId, 'spare');
              s.fate = 'spare';
            }
          }
          resolve();
        }
      });
    });
  }

  // 4. Record outcomes in Holy Grail War and compute final reactions
  for (const s of defeatedStates) {
    if (s.evacuated) continue;

    if (s.fate === 'kill') {
      recordDuelOutcome(
        warSession,
        primaryWinner.username,
        s.combatant.username,
        'kill',
        chanTag,
        primaryWinner.currentHp,
        0
      );

      // Check Church Bounty for slain heretic
      if (s.master.bountyActive || (s.master.innocentKills || 0) >= 10 || s.master.isRogueHeretic) {
        const winningMaster = await getOrCreateMaster(primaryWinner.userId, primaryWinner.username);
        winningMaster.saintQuartz = (winningMaster.saintQuartz || 0) + 15;
        winningMaster.commandSeals = Math.min(3, (winningMaster.commandSeals || 0) + 1);

        const winnerServant = winningMaster.servants?.find((srv: any) => srv.id === primaryWinner.servant.id);
        if (winnerServant) {
          const bRes = addBondExpToServant(winnerServant, 100);
          const sIdx = winningMaster.servants.findIndex((srv: any) => srv.id === primaryWinner.servant.id);
          if (sIdx !== -1) winningMaster.servants[sIdx] = bRes.updatedServant;
        }

        s.master.bountyActive = false;
        s.master.isRogueHeretic = false;
        await saveMaster(winningMaster);
        await saveMaster(s.master);

        s.bountyClaimText = `\n🏆 **CHURCH EXTERMINATION BOUNTY CLAIMED:** Father Kotomine has awarded Master **${primaryWinner.username}** +1 Command Seal 💠, +15 Saint Quartz 💎, +150 Bond EXP 💖 for slaying Rogue Heretic **${s.combatant.username}**!`;
      }

      try {
        s.winnerReaction = await generateServantBattleReaction({
          servant: primaryWinner.servant,
          masterName: primaryWinner.username,
          masterId: primaryWinner.userId,
          role: 'victor',
          outcomeDecision: 'kill',
          opponentName: s.combatant.servant.nickname || s.combatant.servant.template?.name || 'Servant',
          opponentMaster: s.combatant.username,
          currentHp: primaryWinner.currentHp,
          maxHp: primaryWinner.maxHp,
          warId: warSession?.id
        });
      } catch {}
    } else {
      const outcome = recordDuelOutcome(
        warSession,
        primaryWinner.username,
        s.combatant.username,
        'spare',
        chanTag,
        primaryWinner.currentHp,
        s.combatant.currentHp
      );

      try {
        const [wRes, lRes] = await Promise.allSettled([
          generateServantBattleReaction({
            servant: primaryWinner.servant,
            masterName: primaryWinner.username,
            masterId: primaryWinner.userId,
            role: 'victor',
            outcomeDecision: 'spare',
            opponentName: s.combatant.servant.nickname || s.combatant.servant.template?.name || 'Servant',
            opponentMaster: s.combatant.username,
            currentHp: primaryWinner.currentHp,
            maxHp: primaryWinner.maxHp,
            warId: warSession?.id
          }),
          generateServantBattleReaction({
            servant: s.combatant.servant,
            masterName: s.combatant.username,
            masterId: s.combatant.userId,
            role: 'spared',
            outcomeDecision: 'spare',
            opponentName: winnerName,
            opponentMaster: primaryWinner.username,
            currentHp: outcome.defeatedMaster?.currentHp || 1000,
            maxHp: outcome.defeatedMaster?.maxHp || 15000,
            warId: warSession?.id
          })
        ]);
        if (wRes.status === 'fulfilled') s.winnerReaction = wRes.value;
        if (lRes.status === 'fulfilled') s.loserReaction = lRes.value;
      } catch {}
    }
  }

  // 5. Award victory rewards & sync Master HP
  const rewardReport = await finalizeDuelRewardsAndSync(winningTeam, defeatedStates, warSession, chanTag, primaryWinner, isFreeBattle);
  const { primaryBondLevelUp, primaryNewBondLevel, primaryUnlockedBondCe, enemyBeatenMultiplier } = rewardReport;

  // 6. Build Victory & Final Outcome Embeds
  const victoryQuote = primaryWinner.servant.customQuotes?.victory || primaryWinner.servant.template?.victoryQuote || "A decisive triumph. The Holy Grail draws closer.";

  const victoryCardBuffer = await renderDialogueCard(
    winnerName,
    victoryQuote,
    'VICTORY INVOCATION',
    winnerClass,
    winnerAvatarUrl,
    primaryWinner.servant.bondLevel || 5,
    loserName,
    loserAvatarUrl,
    primaryLoser.servant.template?.servantClass || 'Lancer',
    ['Buster', 'Buster', 'Buster'],
    battleBgUrl
  ).catch(() => null);

  const victoryCardAttachment = victoryCardBuffer 
    ? new AttachmentBuilder(victoryCardBuffer, { name: 'victory_dialogue.png' })
    : null;

  const bond10Celebration = primaryUnlockedBondCe
    ? `\n🎖️ **[MAX BOND 10 REACHED!]** Bestowed Bond Craft Essence: ★4 **${primaryUnlockedBondCe.name}**!\n*Effect:* ${primaryUnlockedBondCe.effectText}\n*(Type \`/ce art ${primaryUnlockedBondCe.name}\` to view high-res card art!)*`
    : '';

  const multText = enemyBeatenMultiplier > 1
    ? ` 🔥 **[${enemyBeatenMultiplier}x Enemy Defeat Multiplier Active!]** *(Scaled for defeating ${defeatedStates.length} enemy Servants)*\n\n`
    : '\n\n';

  const victoryEmbed = new EmbedBuilder()
    .setTitle('🏆 DUEL VICTORY — VICTORY INVOCATION')
    .setDescription(
      `**${winnerName}** (Master: ${primaryWinner.username}) has triumphed in the Holy Grail duel!${multText}` +
      `🏆 **Victor & Ally Rewards:**\n` +
      rewardReport.winnerRewardLines.join('\n') +
      `${primaryBondLevelUp ? `\n\n🎉 **[BOND LEVEL UP!]** **${winnerName}** reached **Bond Lv. ${primaryNewBondLevel}**!` : ''}${bond10Celebration}\n\n` +
      `💬 **[VICTORY INVOCATION] ${winnerName}:**\n> ❝ ***${victoryQuote}*** ❞`
    )
    .setColor(0x22c55e);

  if (winnerAvatarUrl) safeSetEmbedThumbnail(victoryEmbed, winnerAvatarUrl);
  if (victoryCardAttachment) victoryEmbed.setImage('attachment://victory_dialogue.png');

  // Outcome breakdown for EVERY defeated Master
  const outcomeLines: string[] = [];
  for (const s of defeatedStates) {
    const sServantName = s.combatant.servant.nickname || s.combatant.servant.template?.name || 'Servant';
    if (s.evacuated) {
      outcomeLines.push(
        `🔴 **Master ${s.combatant.username}** (${sServantName}): **COMMAND SEAL SANCTUARY**\n` +
        `• Expended 1 Command Seal (${s.availableSeals}/3 remaining). Evacuated to sanctuary at **1 HP**.\n` +
        (s.evacQuote ? `• 💬 *[Survivor's Breath] "${s.evacQuote}"*\n` : '')
      );
    } else if (s.fate === 'kill') {
      outcomeLines.push(
        `☠️ **Master ${s.combatant.username}** (${sServantName}): **EXECUTED & ELIMINATED**\n` +
        `• Permanent casualty of the Holy Grail War. Spiritual core absorbed by the Lesser Grail.\n` +
        (s.winnerReaction ? `• 💬 *[Aftermath Reflection] "${s.winnerReaction}"*\n` : '') +
        (s.bountyClaimText || '')
      );
    } else {
      outcomeLines.push(
        `🕊️ **Master ${s.combatant.username}** (${sServantName}): **SPARED (MERCY BESTOWED)**\n` +
        `• Survives with critical HP. Remains an active contender in the Holy Grail War.\n` +
        (s.loserReaction ? `• 💬 *[Survivor's Breath] "${s.loserReaction}"*\n` : '')
      );
    }
  }

  const anyExecuted = defeatedStates.some(s => s.fate === 'kill');
  const finalOutcomeEmbed = new EmbedBuilder()
    .setTitle(anyExecuted ? '☠️ DUEL AFTERMATH — CASUALTY & FATE REPORT' : '🕊️ DUEL AFTERMATH — RESOLUTION REPORT')
    .setDescription(
      `⚖️ **Holy Grail War Fate Resolution (${defeatedStates.length} Master${defeatedStates.length > 1 ? 's' : ''}):**\n\n` +
      outcomeLines.join('\n\n') +
      `\n\n💰 **Participation & Consolation Rewards:**\n` +
      rewardReport.loserRewardLines.join('\n')
    )
    .setColor(anyExecuted ? 0xef4444 : 0x22c55e)
    .setFooter({ text: 'Holy Grail War Fate Protocol • All Combatants Fully Resolved' });

  const finalFiles: any[] = [finalAttachment];
  if (victoryCardAttachment) finalFiles.push(victoryCardAttachment);

  await targetMsg?.edit({
    embeds: [summaryEmbed, victoryEmbed, finalOutcomeEmbed],
    files: finalFiles,
    components: []
  }).catch(async () => {
    if (i.channel && typeof i.channel.send === 'function') {
      await i.channel.send({
        embeds: [summaryEmbed, victoryEmbed, finalOutcomeEmbed],
        files: finalFiles,
        components: []
      }).catch(() => {});
    }
  });
}

// Helper to award victor rewards and sync participant HP with full 1v1, 1v2, 2v1, 2v2 support
async function finalizeDuelRewardsAndSync(
  winningTeam: DuelCombatant[],
  defeatedStates: any[],
  warSession: any,
  _chanTag: string,
  primaryWinner: DuelCombatant,
  isFreeBattle: boolean = false
) {
  const winnerCount = winningTeam.length;
  const loserCount = defeatedStates.length;
  const enemyBeatenMultiplier = Math.max(1, loserCount);

  let matchFormatTitle = '⚔️ 1v1 Duel';
  let isSoloClutch1v2 = false;
  let isAlliance2v2 = false;
  let isGank2v1 = false;

  if (winnerCount === 1 && loserCount >= 2) {
    isSoloClutch1v2 = true;
    matchFormatTitle = isFreeBattle ? '👑 1v2 Solo Clutch Sparring' : '👑 1v2 Solo Clutch War Triumph';
  } else if (winnerCount >= 2 && loserCount >= 2) {
    isAlliance2v2 = true;
    matchFormatTitle = isFreeBattle ? '🛡️ 2v2 Alliance Sparring' : '🛡️ 2v2 Alliance War Clash';
  } else if (winnerCount >= 2 && loserCount === 1) {
    isGank2v1 = true;
    matchFormatTitle = isFreeBattle ? '⚔️ 2v1 Alliance Sparring' : '⚔️ 2v1 Alliance War Engagement';
  } else {
    matchFormatTitle = isFreeBattle ? '🕊️ 1v1 Friendly Sparring' : '⚔️ 1v1 Holy Grail Duel';
  }

  // Base rewards determination (Scaled and multiplied per enemy servant beaten)
  let baseWinSq = isFreeBattle ? 3 : 4;
  let baseWinLevelExp = isFreeBattle ? 1500 : 2000;
  let baseWinBondExp = isFreeBattle ? 150 : 200;
  let baseWinStatPoints = isFreeBattle ? 0 : 2;
  let baseWinManaPrisms = isFreeBattle ? 20 : 25;

  let winSq = baseWinSq * enemyBeatenMultiplier;
  let winLevelExp = baseWinLevelExp * enemyBeatenMultiplier;
  let winBondExp = baseWinBondExp * enemyBeatenMultiplier;
  let winStatPoints = baseWinStatPoints * enemyBeatenMultiplier;
  let winManaPrisms = baseWinManaPrisms * enemyBeatenMultiplier;

  // Solo clutch underdog bonus (1 Player defeating 2+ enemies alone!)
  if (isSoloClutch1v2) {
    winSq += isFreeBattle ? 2 : 4;
    winLevelExp += isFreeBattle ? 1000 : 1800;
    winBondExp += isFreeBattle ? 60 : 120;
    winManaPrisms += isFreeBattle ? 20 : 30;
    if (!isFreeBattle) winStatPoints += 2;
  }

  // Consolation loser rewards
  let loseScale = loserCount >= 2 ? 1.5 : 1.0;
  let loseSq = Math.max(1, Math.round((isFreeBattle ? 1 : 1) * loseScale));
  let loseLevelExp = Math.round((isFreeBattle ? 600 : 800) * loseScale);
  let loseBondExp = Math.round((isFreeBattle ? 60 : 80) * loseScale);
  let loseStatPoints = (!isFreeBattle && isGank2v1) ? 1 : 0;
  let loseManaPrisms = Math.round((isFreeBattle ? 8 : 12) * loseScale);

  let primaryBondLevelUp = false;
  let primaryNewBondLevel = 1;
  let primaryUnlockedBondCe: any = undefined;

  const winnerRewardLines: string[] = [];
  const loserRewardLines: string[] = [];

  // Process and award each winner (INCLUDING fallen teammates who helped win the match!)
  for (const winner of winningTeam) {
    const sName = winner.servant.nickname || winner.servant.template?.name || 'Servant';
    const isFallenTeammate = (winner.currentHp || 0) <= 0;

    if (winner.isAi) {
      winnerRewardLines.push(`• 🤖 **${winner.username}** (${sName}): *[AI Vanguard Triumph]*`);
      continue;
    }

    const wMaster = await getOrCreateMaster(winner.userId, winner.username);
    const isWinnerSafe = isFreeBattle || wMaster?.environmentMode === 'safe' || !wMaster?.environmentMode;
    if (wMaster) {
      wMaster.saintQuartz = (wMaster.saintQuartz || 0) + winSq;
      wMaster.manaPrisms = (wMaster.manaPrisms || 0) + winManaPrisms;
      wMaster.duelsWon = (wMaster.duelsWon || 0) + 1;
      wMaster.totalBattleWins = (wMaster.duelsWon || 0) + (wMaster.servantKills || 0);

      const s = wMaster.servants?.find(srv => srv.id === winner.servant.id) ||
                wMaster.servants?.find(srv => srv.id === wMaster.activeServantId) ||
                wMaster.servants?.find(srv => srv.template?.name === winner.servant.template?.name) ||
                wMaster.servants?.[0];

      let bondDidLvl = false;
      let bondNewLvl = 1;
      let battleDidLvl = false;
      let battleNewLvl = 1;
      let battlePtsGained = 0;

      if (s) {
        // 1. Bond EXP
        const bondRes = addBondExpToServant(s, winBondExp);
        let updatedS = bondRes.updatedServant;

        // 2. Battle Level EXP (Levels up Servant & awards +10 Stat Points per level!)
        const battleExpRes = addServantBattleExp(updatedS, winLevelExp);
        updatedS = battleExpRes.updatedServant;
        battleDidLvl = battleExpRes.didLevelUp;
        battleNewLvl = battleExpRes.newLevel;
        battlePtsGained = battleExpRes.statPointsGained;

        // 3. Tournament Bonus Stat Points (if ranked)
        if (!isFreeBattle && winStatPoints > 0) {
          updatedS.availableStatPoints = (updatedS.availableStatPoints || 0) + winStatPoints;
        }

        const grantResult = checkAndGrantBond10Ce(wMaster, updatedS);
        if (winner.userId === primaryWinner.userId && grantResult) {
          primaryUnlockedBondCe = grantResult.ce;
        }

        if (isWinnerSafe) {
          const sMaxHp = (updatedS as any).maxHp || updatedS.template?.baseHp || 50000;
          updatedS.currentHp = sMaxHp;
          wMaster.commandSeals = 3;
        } else {
          const sMaxHp = (updatedS as any).maxHp || updatedS.template?.baseHp || 50000;
          // If fallen teammate in ranked, revive safely at 1 HP Sanctuary rather than perishing
          updatedS.currentHp = Math.min(sMaxHp, Math.max(1, isFallenTeammate ? 1 : winner.currentHp));
        }

        const sIdx = wMaster.servants.findIndex(srv => srv.id === (s?.id || winner.servant.id));
        if (sIdx !== -1) {
          wMaster.servants[sIdx] = updatedS;
        } else {
          wMaster.servants[0] = updatedS;
        }

        bondDidLvl = bondRes.didLevelUp;
        bondNewLvl = bondRes.newLevel;

        if (winner.userId === primaryWinner.userId) {
          primaryBondLevelUp = bondRes.didLevelUp;
          primaryNewBondLevel = bondRes.newLevel;
        }
      }

      await saveMaster(wMaster);

      const totalWinBonusPts = (!isFreeBattle && winStatPoints > 0 ? winStatPoints : 0) + battlePtsGained;
      const statStr = totalWinBonusPts > 0 ? ` | 📊 +${totalWinBonusPts} Stat Pts` : '';
      const battleLvlStr = battleDidLvl ? ` 🌟 **[LEVEL UP! Lv.${battleNewLvl}]**` : '';
      const bondLvlStr = bondDidLvl ? ` 💖 **[Bond Lv.${bondNewLvl}!]**` : '';
      const roleStr = isFallenTeammate
        ? ' 🛡️ **[Fallen Ally — Victory Honored & Revived!]**'
        : (isSoloClutch1v2
          ? ' 👑 **[1v2 Solo Clutch]**'
          : (isAlliance2v2 ? ' 🏆 **[Alliance Victor]**' : ' 🏆 **[Victor]**'));

      winnerRewardLines.push(
        `• 🏆 **Master ${winner.username}** (${sName})${roleStr}: +${winSq} SQ 💎 | +${winLevelExp.toLocaleString()} Level EXP ⚔️ | +${winBondExp} Bond EXP 💖 | +${winManaPrisms} Prisms 🔵${statStr}${battleLvlStr}${bondLvlStr}`
      );
    }

    if (!isWinnerSafe) {
      const wPart = warSession?.participants[winner.userId];
      if (wPart) {
        wPart.currentHp = Math.min(wPart.maxHp, Math.max(1, isFallenTeammate ? 1 : winner.currentHp));
        wPart.baseHpAtDamage = wPart.currentHp;
        wPart.lastDamageTime = Date.now();
        wPart.isAlive = true;
      }
    }
  }

  // Process and award each defeated participant
  for (const s of defeatedStates) {
    const sLoserName = s.combatant.servant.nickname || s.combatant.servant.template?.name || 'Servant';
    if (s.combatant.isAi) {
      loserRewardLines.push(`• 🤖 **${s.combatant.username}** (${sLoserName}): *[AI Combatant Concluded]*`);
      continue;
    }

    if (s.master) {
      const isLoserSafe = isFreeBattle || s.master.environmentMode === 'safe' || !s.master.environmentMode;
      s.master.saintQuartz = (s.master.saintQuartz || 0) + loseSq;
      s.master.manaPrisms = (s.master.manaPrisms || 0) + loseManaPrisms;
      s.master.duelsLost = (s.master.duelsLost || 0) + 1;

      const sLoser = s.master.servants?.find((srv: any) => srv.id === s.combatant.servant.id) ||
                     s.master.servants?.find((srv: any) => srv.id === s.master.activeServantId) ||
                     s.master.servants?.find((srv: any) => srv.template?.name === s.combatant.servant.template?.name) ||
                     s.master.servants?.[0];

      let loserBondLvlUp = false;
      let loserNewBondLvl = 1;
      let loserBattleLvlUp = false;
      let loserNewBattleLvl = 1;
      let loserPtsGained = 0;

      if (sLoser) {
        // 1. Bond EXP
        const loserBondRes = addBondExpToServant(sLoser, loseBondExp);
        let updatedLoser = loserBondRes.updatedServant;

        // 2. Battle Level EXP (Consolation Level EXP for participating & learning in battle!)
        const loserBattleExpRes = addServantBattleExp(updatedLoser, loseLevelExp);
        updatedLoser = loserBattleExpRes.updatedServant;
        loserBattleLvlUp = loserBattleExpRes.didLevelUp;
        loserNewBattleLvl = loserBattleExpRes.newLevel;
        loserPtsGained = loserBattleExpRes.statPointsGained;

        // 3. Tournament Bonus Stat Points (if courageous defender)
        if (!isFreeBattle && loseStatPoints > 0) {
          updatedLoser.availableStatPoints = (updatedLoser.availableStatPoints || 0) + loseStatPoints;
        }

        checkAndGrantBond10Ce(s.master, updatedLoser);
        if (isLoserSafe) {
          const loserMaxHp = (updatedLoser as any).maxHp || updatedLoser.template?.baseHp || 50000;
          updatedLoser.currentHp = loserMaxHp;
          s.master.commandSeals = 3;
        } else if (s.evacuated) {
          updatedLoser.currentHp = 1;
        }

        const sIdx = s.master.servants.findIndex((srv: any) => srv.id === (sLoser?.id || s.combatant.servant.id));
        if (sIdx !== -1) {
          s.master.servants[sIdx] = updatedLoser;
        } else {
          s.master.servants[0] = updatedLoser;
        }

        loserBondLvlUp = loserBondRes.didLevelUp;
        loserNewBondLvl = loserBondRes.newLevel;
      }

      await saveMaster(s.master);

      const totalLoseBonusPts = (!isFreeBattle && loseStatPoints > 0 ? loseStatPoints : 0) + loserPtsGained;
      const statStr = totalLoseBonusPts > 0 ? ` | 📊 +${totalLoseBonusPts} Stat Pt` : '';
      const battleLvlStr = loserBattleLvlUp ? ` 🌟 **[LEVEL UP! Lv.${loserNewBattleLvl}]**` : '';
      const bondLvlStr = loserBondLvlUp ? ` 💖 **[Bond Lv.${loserNewBondLvl}!]**` : '';
      const roleStr = (isGank2v1) ? ' 🛡️ **[Courageous Stand]**' : '';
      loserRewardLines.push(
        `• 🎗️ **Master ${s.combatant.username}** (${sLoserName})${roleStr}: +${loseSq} SQ 💎 | +${loseLevelExp.toLocaleString()} Level EXP ⚔️ | +${loseBondExp} Bond EXP 💖 | +${loseManaPrisms} Prisms 🔵${statStr}${battleLvlStr}${bondLvlStr}`
      );
    }
  }

  const rewardsSummaryText =
    `**🏆 Victor(s):**\n` +
    winnerRewardLines.join('\n') +
    `\n\n**🎗️ Defeated Participant(s):**\n` +
    loserRewardLines.join('\n');

  return {
    matchFormatTitle,
    winnerRewardLines,
    loserRewardLines,
    rewardsSummaryText,
    primaryBondLevelUp,
    primaryNewBondLevel,
    primaryUnlockedBondCe,
    enemyBeatenMultiplier
  };
}

/**
 * Prefix Command Handler for !duel / !spar / !fight
 * Supports:
 * - `!duel 1v2 @user1 @user2` or `!duel free 1v2 @user1 @user2`
 * - `!duel 2v2 @ally @opp1 @opp2` or `!duel free 2v2 @ally @opp1 @opp2`
 * - `!duel @user` or `!duel free @user`
 * - `!duel` (Solo vs AI or Living Master)
 */
export async function handlePrefixDuel(message: Message, args: string[]) {
  try {
    const challengerMaster = await getOrCreateMaster(message.author.id, message.author.username);
    if (!challengerMaster.servants || challengerMaster.servants.length === 0) {
      await message.reply({ content: '❌ You have no contracted Servant to duel with! Use `!summon` to enter the Holy Grail War first.' });
      return;
    }

    const warSession = getOrInitWarSession(challengerMaster);
    const text = args.join(' ').toLowerCase();

    const isChallengerInWar = challengerMaster.environmentMode === 'war';
    const isChallengerInSafeMode = !isChallengerInWar;

    const isExplicitFree = text.includes('free') || text.includes('spar') || text.includes('safe');
    const isFreeBattle = isExplicitFree || isChallengerInSafeMode;

    const is1v2Requested = text.includes('1v2') || text.includes('raid');
    const is2v2Requested = text.includes('2v2') || text.includes('alliance') || text.includes('tag');

    // Extract mentioned users
    const mentionedUsers = Array.from(message.mentions.users.values()).filter(u => u.id !== message.author.id && !u.bot);

    let mode: '1v1' | '1v2' | '2v2' = '1v1';
    if (is1v2Requested || (!is2v2Requested && mentionedUsers.length === 2)) {
      mode = '1v2';
    } else if (is2v2Requested || mentionedUsers.length >= 3) {
      mode = '2v2';
    }

    const challengerServant = challengerMaster.servants.find(s => s.id === challengerMaster.activeServantId) || challengerMaster.servants[0];

    // ==========================================
    // 1v2 or 2v2 Multi-Master Prefix Duel
    // ==========================================
    if (mode === '1v2' || mode === '2v2') {
      const is2v2 = mode === '2v2';

      let allyUser: User | undefined;
      let opponentUser: User | undefined;
      let opponent2User: User | undefined;

      if (is2v2) {
        if (mentionedUsers.length < 3) {
          await message.reply({
            content: '❌ **2v2 Alliance Duel requires 3 mentioned Masters!**\nUsage: `!duel 2v2 @Ally @Opponent1 @Opponent2` (or `!duel free 2v2 @Ally @Opponent1 @Opponent2`)'
          });
          return;
        }
        allyUser = mentionedUsers[0];
        opponentUser = mentionedUsers[1];
        opponent2User = mentionedUsers[2];
      } else {
        if (mentionedUsers.length < 2) {
          await message.reply({
            content: '❌ **1v2 Raid Duel requires 2 mentioned rival Masters!**\nUsage: `!duel 1v2 @Opponent1 @Opponent2` (or `!duel free 1v2 @Opponent1 @Opponent2`)'
          });
          return;
        }
        opponentUser = mentionedUsers[0];
        opponent2User = mentionedUsers[1];
      }

      const opponentMaster = await getOrCreateMaster(opponentUser.id, opponentUser.username);
      const opp2Master = await getOrCreateMaster(opponent2User.id, opponent2User.username);

      const opponentServant = opponentMaster.servants?.find(s => s.id === opponentMaster.activeServantId) || opponentMaster.servants?.[0];
      const opp2Servant = opp2Master.servants?.find(s => s.id === opp2Master.activeServantId) || opp2Master.servants?.[0];

      if (!opponentServant) {
        await message.reply({ content: `❌ Rival Master <@${opponentUser.id}> has not summoned a Servant yet!` });
        return;
      }
      if (!opp2Servant) {
        await message.reply({ content: `❌ Rival Master <@${opponent2User.id}> has not summoned a Servant yet!` });
        return;
      }

      let p1AllyMaster: MasterProfile | null = null;
      let p1Ally: DuelCombatant | undefined = undefined;

      if (is2v2 && allyUser) {
        const allyMaster = await getOrCreateMaster(allyUser.id, allyUser.username);
        p1AllyMaster = allyMaster;
        const allyServant = allyMaster.servants?.find(s => s.id === allyMaster.activeServantId) || allyMaster.servants?.[0];
        if (!allyServant) {
          await message.reply({ content: `❌ Allied Master <@${allyUser.id}> has not summoned a Servant yet!` });
          return;
        }
        const allyPart = warSession.participants[allyMaster.discordId];
        const allyHp = (isFreeBattle || allyMaster.environmentMode === 'safe') ? undefined : (allyPart ? calculateCurrentHp(allyPart) : undefined);
        p1Ally = createCombatant(allyMaster, allyServant, false, allyHp, isFreeBattle);
      }

      const p1Part = warSession.participants[challengerMaster.discordId];
      const p1Hp = (isFreeBattle || challengerMaster.environmentMode === 'safe') ? undefined : (p1Part ? calculateCurrentHp(p1Part) : undefined);
      const p1 = createCombatant(challengerMaster, challengerServant, false, p1Hp, isFreeBattle);

      const p2Part = warSession.participants[opponentMaster.discordId];
      const p2Hp = (isFreeBattle || opponentMaster.environmentMode === 'safe') ? undefined : (p2Part ? calculateCurrentHp(p2Part) : undefined);
      const p2 = createCombatant(opponentMaster, opponentServant, false, p2Hp, isFreeBattle);

      const opp2Part = warSession.participants[opp2Master.discordId];
      const opp2Hp = (isFreeBattle || opp2Master.environmentMode === 'safe') ? undefined : (opp2Part ? calculateCurrentHp(opp2Part) : undefined);
      const p2Ally = createCombatant(opp2Master, opp2Servant, false, opp2Hp, isFreeBattle);

      if (is2v2) {
        p1.critStars = 25;
        p1.activeBuffs = [{ name: '2v2 Alliance Formation', type: 'buff_atk', value: 15, remainingTurns: 3 }];
      } else {
        p1.critStars = 30;
        p1.activeBuffs = [{ name: '1v2 Raid Fortitude', type: 'buff_atk', value: 20, remainingTurns: 3 }];
      }

      const invitedHumans = new Map<string, { user: User; role: string; accepted: boolean }>();
      invitedHumans.set(opponentUser.id, { user: opponentUser, role: is2v2 ? 'Primary Opponent (Team 2)' : '1st Rival Master', accepted: false });
      invitedHumans.set(opponent2User.id, { user: opponent2User, role: is2v2 ? 'Secondary Opponent (Team 2)' : '2nd Rival Master', accepted: false });
      if (is2v2 && allyUser) {
        invitedHumans.set(allyUser.id, { user: allyUser, role: 'Allied Master (Team 1)', accepted: false });
      }

      const matchHeading = isFreeBattle
        ? (is2v2 ? '🕊️ FREE BATTLE: 2v2 ALLIANCE SPARRING' : '🕊️ FREE BATTLE: 1v2 RAID SPARRING')
        : (is2v2 ? '⚔️ HOLY GRAIL WAR: 2v2 TAG-TEAM CLASH' : '⚔️ HOLY GRAIL WAR: 1v2 RAID SURVIVAL');

      const matchFormatDesc = isFreeBattle
        ? `• **Format:** 🕊️ Free Battle / Safe Mode *(Zero elimination risk, intact Command Seals & friendly sparring rewards)*`
        : `• **Format:** ⚔️ Holy Grail War Tournament *(Ranked stakes, Command Seal survival & full War rewards)*`;

      const inviteEmbed = new EmbedBuilder()
        .setTitle(matchHeading)
        .setDescription(
          `Master <@${message.author.id}> has issued a **${is2v2 ? '2v2 Tag-Team' : '1v2 Raid'}** challenge!\n\n` +
          `🛡️ **Team 1:** <@${message.author.id}> (**${p1.servant.template?.name || 'Servant'}**) ${p1AllyMaster && p1Ally ? `& <@${p1AllyMaster.discordId}> (**${p1Ally.servant.template?.name || 'Servant'}**)` : ''}\n` +
          `⚔️ **Team 2:** <@${opponentMaster.discordId}> (**${p2.servant.template?.name || 'Servant'}**) & <@${opp2Master.discordId}> (**${p2Ally.servant.template?.name || 'Servant'}**)\n\n` +
          `${matchFormatDesc}\n\n` +
          `📜 **Challenge Confirmation Status:**\n` +
          `• <@${message.author.id}> (Challenger): ✅ **Initiator**\n` +
          `• ${[...invitedHumans.values()].map(h => `<@${h.user.id}> (${h.role}): ⏳ **Pending Confirmation**`).join('\n• ')}\n\n` +
          `*All challenged Masters must accept to enter the arena!*`
        )
        .setColor(isFreeBattle ? 0x38bdf8 : 0xd4af37)
        .setFooter({ text: `Holy Grail War • ${isFreeBattle ? 'Friendly Sparring Arena' : 'Ranked Tournament Match'}` });

      const inviteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('accept_2v2_duel').setLabel('Accept Challenge').setEmoji('⚔️').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('decline_2v2_duel').setLabel('Decline').setEmoji('🏳️').setStyle(ButtonStyle.Danger)
      );

      const pingContent = [...invitedHumans.keys()].map(id => `<@${id}>`).join(' ');
      const inviteMsg = await message.reply({
        content: `⚔️ **Attention Masters:** ${pingContent}`,
        embeds: [inviteEmbed],
        components: [inviteRow]
      });

      const inviteCollector = inviteMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000
      });

      inviteCollector.on('collect', async i => {
        try {
          if (i.replied || i.deferred) return;
          if (i.customId === 'decline_2v2_duel') {
            if (!invitedHumans.has(i.user.id) && i.user.id !== message.author.id) {
              await i.reply({ content: '❌ You are not involved in this duel challenge.', flags: MessageFlags.Ephemeral });
              return;
            }
            inviteCollector.stop('declined');
            await i.update({ content: `🏳️ Duel challenge declined by <@${i.user.id}>.`, embeds: [], components: [] });
            return;
          }

          if (i.customId === 'accept_2v2_duel') {
            if (!invitedHumans.has(i.user.id)) {
              await i.reply({ content: '❌ You are not one of the challenged Masters.', flags: MessageFlags.Ephemeral });
              return;
            }
            const humanEntry = invitedHumans.get(i.user.id)!;
            if (humanEntry.accepted) {
              await i.reply({ content: '✅ You have already accepted this challenge!', flags: MessageFlags.Ephemeral });
              return;
            }
            humanEntry.accepted = true;
            const allAccepted = [...invitedHumans.values()].every(h => h.accepted);

            if (!allAccepted) {
              await i.deferUpdate();
              const updatedStatusText = [...invitedHumans.values()]
                .map(h => `<@${h.user.id}> (${h.role}): ${h.accepted ? '✅ **Accepted**' : '⏳ **Pending Confirmation**'}`)
                .join('\n• ');
              const updatedEmbed = EmbedBuilder.from(inviteEmbed)
                .setDescription(
                  `Master <@${message.author.id}> has issued a **${is2v2 ? '2v2 Tag-Team' : '1v2 Raid'}** challenge!\n\n` +
                  `🛡️ **Team 1:** <@${message.author.id}> (**${p1.servant.template?.name || 'Servant'}**) ${p1AllyMaster && p1Ally ? `& <@${p1AllyMaster.discordId}> (**${p1Ally.servant.template?.name || 'Servant'}**)` : ''}\n` +
                  `⚔️ **Team 2:** <@${opponentMaster.discordId}> (**${p2.servant.template?.name || 'Servant'}**) & <@${opp2Master.discordId}> (**${p2Ally.servant.template?.name || 'Servant'}**)\n\n` +
                  `${matchFormatDesc}\n\n` +
                  `📜 **Challenge Confirmation Status:**\n` +
                  `• <@${message.author.id}> (Challenger): ✅ **Initiator**\n` +
                  `• ${updatedStatusText}\n\n` +
                  `*Awaiting remaining challenged Masters...*`
                );
              await inviteMsg.edit({ embeds: [updatedEmbed] });
            } else {
              inviteCollector.stop('accepted');
              await i.deferUpdate();
              const startingEmbed = EmbedBuilder.from(inviteEmbed)
                .setTitle(`⚔️ ALL MASTERS ACCEPTED — ENTERING ARENA...`)
                .setDescription(`⚔️ All challenged Masters have accepted the duel! Preparing battle arena canvas...`)
                .setColor(0x22c55e);
              await inviteMsg.edit({ embeds: [startingEmbed], components: [] });

              await startInteractiveDuel(
                i,
                p1,
                p2,
                challengerMaster,
                opponentMaster,
                p1Ally,
                p2Ally,
                p1AllyMaster,
                opp2Master,
                isFreeBattle
              );
            }
          }
        } catch (err: any) {
          console.error('Error in prefix 2v2 inviteCollector:', err);
        }
      });
      return;
    }

    // ==========================================
    // 1v1 Prefix Duel
    // ==========================================
    const targetUser = mentionedUsers[0];
    if (targetUser) {
      const targetMaster = await getOrCreateMaster(targetUser.id, targetUser.username);
      const targetServant = targetMaster.servants?.find(s => s.id === targetMaster.activeServantId) || targetMaster.servants?.[0];
      if (!targetServant) {
        await message.reply({ content: `❌ Rival Master <@${targetUser.id}> has not summoned a Servant yet!` });
        return;
      }

      const p1Part = warSession.participants[challengerMaster.discordId];
      const p1Hp = (isFreeBattle || challengerMaster.environmentMode === 'safe') ? undefined : (p1Part ? calculateCurrentHp(p1Part) : undefined);
      const p1 = createCombatant(challengerMaster, challengerServant, false, p1Hp, isFreeBattle);

      const p2Part = warSession.participants[targetMaster.discordId];
      const p2Hp = (isFreeBattle || targetMaster.environmentMode === 'safe') ? undefined : (p2Part ? calculateCurrentHp(p2Part) : undefined);
      const p2 = createCombatant(targetMaster, targetServant, false, p2Hp, isFreeBattle);

      const matchHeading = isFreeBattle ? '🕊️ FREE BATTLE: 1v1 SPARRING' : '⚔️ HOLY GRAIL WAR: 1v1 DUEL CHALLENGE';
      const inviteEmbed = new EmbedBuilder()
        .setTitle(matchHeading)
        .setDescription(
          `Master <@${message.author.id}> (**${challengerServant.template?.name || 'Servant'}**) challenges <@${targetUser.id}> (**${targetServant.template?.name || 'Servant'}**) to a ${isFreeBattle ? 'friendly sparring match' : 'Holy Grail War duel'}!\n\n` +
          `• **Format:** ${isFreeBattle ? '🕊️ Free Battle / Safe Mode (Zero elimination risk, intact seals)' : '⚔️ Holy Grail War (Ranked stakes)'}\n\n` +
          `<@${targetUser.id}>, do you accept this challenge?`
        )
        .setColor(isFreeBattle ? 0x38bdf8 : 0xd4af37);

      const inviteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('accept_1v1_duel').setLabel('Accept Duel').setEmoji('⚔️').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('decline_1v1_duel').setLabel('Decline').setEmoji('🏳️').setStyle(ButtonStyle.Danger)
      );

      const inviteMsg = await message.reply({
        content: `⚔️ **Duel Challenge:** <@${targetUser.id}>`,
        embeds: [inviteEmbed],
        components: [inviteRow]
      });

      const inviteCollector = inviteMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 180000
      });

      inviteCollector.on('collect', async i => {
        try {
          if (i.user.id !== targetUser.id && i.user.id !== message.author.id) {
            await i.reply({ content: '❌ You are not involved in this duel challenge.', flags: MessageFlags.Ephemeral });
            return;
          }
          if (i.customId === 'decline_1v1_duel') {
            inviteCollector.stop('declined');
            await i.update({ content: `🏳️ Duel challenge declined by <@${i.user.id}>.`, embeds: [], components: [] });
            return;
          }
          if (i.customId === 'accept_1v1_duel') {
            if (i.user.id !== targetUser.id) {
              await i.reply({ content: '❌ Only the challenged Master can accept!', flags: MessageFlags.Ephemeral });
              return;
            }
            inviteCollector.stop('accepted');
            await i.deferUpdate();
            await inviteMsg.edit({
              content: '⚔️ **Challenge Accepted! Entering Arena...**',
              embeds: [],
              components: []
            });
            await startInteractiveDuel(i, p1, p2, challengerMaster, targetMaster, undefined, undefined, null, null, isFreeBattle);
          }
        } catch (err) {
          console.error('Error in prefix 1v1 inviteCollector:', err);
        }
      });
      return;
    }

    // Solo 1v1 vs AI or Available Master
    const p1Part = warSession.participants[challengerMaster.discordId];
    const p1Hp = (isFreeBattle || challengerMaster.environmentMode === 'safe') ? undefined : (p1Part ? calculateCurrentHp(p1Part) : undefined);
    const p1 = createCombatant(challengerMaster, challengerServant, false, p1Hp, isFreeBattle);

    const allSpirits = getAllThroneServants();
    const otherSpirits = allSpirits.filter((s: any) => s.id !== challengerServant.templateId);
    const randomEnemyTemplate = otherSpirits[Math.floor(Math.random() * otherSpirits.length)] || allSpirits[0];

    const aiMasterMock: MasterProfile = {
      id: 'ai_vanguard_master',
      discordId: 'ai_vanguard_master',
      username: 'Shadow Magus (AI Vanguard)',
      avatarUrl: randomEnemyTemplate.avatarUrl,
      saintQuartz: 0,
      summonTickets: 0,
      commandSeals: 3,
      actionPoints: 100,
      maxActionPoints: 100,
      pityCount: 0,
      grailWarWins: 0,
      duelsWon: 0,
      duelsLost: 0,
      activeServantId: randomEnemyTemplate.id,
      servants: [{
        id: randomEnemyTemplate.id,
        masterId: 'ai_vanguard_master',
        templateId: randomEnemyTemplate.id,
        template: randomEnemyTemplate,
        level: 1,
        experience: 0,
        bondLevel: 5,
        bondExp: 0,
        currentHp: randomEnemyTemplate.baseHp,
        allocatedStats: { strength: 0, agility: 0, endurance: 0, mana: 0, luck: 0 },
        availableStatPoints: 0,
        skillLevels: [1, 1, 1],
        customQuotes: {}
      }],
      craftEssences: [],
      environmentMode: isFreeBattle ? 'safe' : 'war'
    };

    const p2 = createCombatant(aiMasterMock, aiMasterMock.servants[0], true, undefined, isFreeBattle);

    // Initial message dispatch and start duel
    const startMsg = await message.reply({ content: `⚔️ **Challenging Arena... Preparing Combat Grid!**` });

    // Build trigger adapter that implements editReply and reply
    const fakeTrigger: any = {
      deferred: true,
      replied: true,
      user: message.author,
      channel: message.channel,
      editReply: async (opts: any) => startMsg.edit(opts),
      reply: async (opts: any) => message.reply(opts),
      fetchReply: async () => startMsg,
      isButton: () => false
    };

    await startInteractiveDuel(fakeTrigger, p1, p2, challengerMaster, aiMasterMock, undefined, undefined, null, null, isFreeBattle);
  } catch (err: any) {
    console.error('Error in handlePrefixDuel:', err);
    await message.reply({ content: `❌ Error starting duel: ${err?.message || 'Unknown error'}` }).catch(() => {});
  }
}

