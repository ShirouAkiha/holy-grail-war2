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
, MessageFlags } from 'discord.js';
import { getOrCreateMaster, saveMaster, getDuelNpSettings } from '../database/service';
import { MasterProfile, MasterServantInstance, CardType, ServantClass, ActiveCombatant, CombatTurnLog, PassiveSkill } from '../types';
import { SERVANT_DATABASE, getDefaultClassPassives, getUnlockedPassives, getServantAvatarAndCardArt } from '../data/servants';
import { getOrInitWarSession, recordDuelOutcome, calculateCurrentHp, getReputationInfo } from '../engine/grailwar';
import { renderBattleTurnSummary, renderDialogueCard, renderDefeatDialogueCard, renderMasterCommandSealDialogueCard, renderSkillDialogueCard } from '../canvas/renderer';
import { PVP_DAMAGE_MODIFIER, calculateFleeChance, rollFleeSuccess } from '../engine/battle';
import { getNoblePhantasmGif, getNoblePhantasmChant } from '../data/noblePhantasmGifs';
import { normalizeMediaUrl } from '../utils/mediaResolver';
import { safeSetEmbedImage, safeSetEmbedThumbnail } from '../utils/discordEmbedHelper';
import { getServantChainDialogue, shouldTriggerDialogueCutIn } from '../engine/dialogue';
import { getServantMatchupDialogue } from '../data/servantMatchups';

// ==========================================
// 1. SLASH COMMAND DEFINITION
// ==========================================
// Allows a Master to challenge either a human player via `@Master` or an AI Shadow Servant.
export const data = new SlashCommandBuilder()
  .setName('duel')
  .setDescription('Engage in a turn-based tactical Fate battle (1v1, 2v2 Alliance, 1v2 Raid, or Force Join)')
  .addStringOption(option =>
    option
      .setName('mode')
      .setDescription('Battle Format: 1v1 Solo, 2v2 Alliance Tag-Team, 1v2 Raid, or Force Join')
      .setRequired(false)
      .addChoices(
        { name: '⚔️ 1v1 Solo Duel', value: '1v1' },
        { name: '🛡️ 2v2 Alliance Tag-Team', value: '2v2' },
        { name: '⚔️ 1v2 Raid Survival', value: '1v2' },
        { name: '⚡ Force Join Ongoing Battle', value: 'forcejoin' }
      )
  )
  .addUserOption(option =>
    option
      .setName('opponent')
      .setDescription('Primary target Master to duel (leave empty to challenge AI Shadow Master)')
      .setRequired(false)
  )
  .addUserOption(option =>
    option
      .setName('ally')
      .setDescription('Allied Master for 2v2 Alliance Tag-Team (leave empty for Shadow Ally)')
      .setRequired(false)
  )
  .addUserOption(option =>
    option
      .setName('opponent2')
      .setDescription('Second Opponent Master for 2v2 or 1v2 Raid (leave empty for Shadow Rival)')
      .setRequired(false)
  );

// ==========================================
// 2. COMBATANT INTERFACE & BUFFS
// ==========================================
export interface CombatantBuff {
  name: string;
  type: 'buff_atk' | 'buff_def' | 'crit_dmg' | 'evade' | 'guts' | 'np_gen' | 'buster_up' | 'arts_up' | 'quick_up' | 'invincible' | 'stun' | 'debuff_atk' | 'ignore_invincible';
  value: number;
  remainingTurns: number;
  remainingHits?: number;
  isHitCount?: boolean;
}

export interface DuelCombatant {
  userId: string;
  username: string;
  isAi: boolean;
  servant: MasterServantInstance;
  avatarUrl?: string;
  baseAvatarUrl?: string;
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
  passives?: PassiveSkill[];
  activeBuffs: CombatantBuff[];
  skillCooldowns: { [skillIdx: number]: number };
  gutsCount: number;
  commandSeals: number;
  currentHand?: ('Buster' | 'Arts' | 'Quick')[];
  drawPile?: ('Buster' | 'Arts' | 'Quick')[];
  masterAvatarUrl?: string;
  selectedTargetId?: string;
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
  if (servant.equippedCe) {
    const ce = servant.equippedCe;
    if (ce.passiveType === 'starting_np' || ce.id === 'ce_kaleidoscope' || ce.id === 'ce_imaginary_element' || ce.id === 'ce_hollow_magic' || ce.id === 'ce_dragon_meridian' || ce.id === 'ce_jeweled_sword') {
      initialNp = ce.passiveValue || 50;
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

  const startingHp = overrideCurrentHp !== undefined && overrideCurrentHp > 0
    ? Math.min(maxHp, Math.round(overrideCurrentHp))
    : (servant.currentHp !== undefined && servant.currentHp > 0
      ? Math.min(maxHp, Math.round(servant.currentHp))
      : maxHp);

  const initialBuffs: CombatantBuff[] = [];
  const ce = servant.equippedCe;
  if (ce) {
    if (ce.id === 'ce_volumen_hydragyrum' || ce.passiveType === 'invincible_hits') {
      const hits = 3;
      const turns = 3;
      initialBuffs.push({
        name: 'Volumen Hydragyrum (Invincibility)',
        type: 'invincible',
        value: 100,
        remainingTurns: turns,
        remainingHits: hits,
        isHitCount: true
      });
      initialBuffs.push({
        name: 'Volumen Hydragyrum (Damage Cut)',
        type: 'buff_def',
        value: 15,
        remainingTurns: 99
      });
    }
    if (ce.id === 'ce_code_cast' || ce.passiveType === 'atk_def_up') {
      initialBuffs.push({
        name: 'Code Cast (ATK Up)',
        type: 'buff_atk',
        value: 10,
        remainingTurns: 99
      });
      initialBuffs.push({
        name: 'Code Cast (DEF Up)',
        type: 'buff_def',
        value: 10,
        remainingTurns: 99
      });
    }
    if (ce.id === 'ce_origin_bullet' || ce.passiveType === 'ignore_invincible') {
      initialBuffs.push({
        name: 'Origin Bullet (Ignore Invincible)',
        type: 'ignore_invincible',
        value: 35,
        remainingTurns: 99
      });
    }
  }

  const baseAvatar = getServantAvatarAndCardArt(servant).avatarUrl;

  const combatant: DuelCombatant = {
    userId: master.discordId,
    username: master.username,
    isAi,
    servant,
    avatarUrl: baseAvatar,
    baseAvatarUrl: baseAvatar,
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
    commandSeals: isAi ? 0 : (master.commandSeals ?? 3),
    drawPile: [],
    masterAvatarUrl: master.avatarUrl
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
  } else {
    const avatar = attacker.servant.template?.avatarUrl;
    if (avatar) {
      embed.setThumbnail(avatar);
    }
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

  const cleanQuote = quote.replace(/^["“]/, '').replace(/["”]$/, '').trim();

  embed.setDescription(
    `### 🔱 **Master ${masterName}** *(Chaldea Magus)*\n` +
    `> ❝ ***“${cleanQuote}”*** ❞\n\n` +
    `⚡ **Command Decree:** Surge Noble Phantasm Gauge to **100% Ready**\n` +
    `🛡️ **Contracted Servant:** **${servantName}** *(${servantClass})*\n\n` +
    `⏳ *Invoking absolute magus authority...*`
  );

  if (hasImageAttachment) {
    embed.setImage('attachment://vn_dialogue.gif');
  } else if (masterAvatarUrl) {
    embed.setThumbnail(masterAvatarUrl);
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
  combatLogsHistory: string[] = []
): Promise<AttachmentBuilder> {
  const mapToActive = (c: DuelCombatant): ActiveCombatant => {
    const baseAvatar = c.baseAvatarUrl || getServantAvatarAndCardArt(c.servant).avatarUrl;
    const currentAvatar = c.isTransformed ? (c.avatarUrl || 'https://ella.janitorai.com/media-approved/zUtP5PQLU7fMKVyin9H-f.webp') : baseAvatar;
    return {
      id: c.userId,
      name: c.isTransformed ? `${c.servant.nickname || c.servant.template.name} (Super Aoko)` : (c.servant.nickname || c.servant.template.name),
      masterName: c.username,
      servantClass: c.servant.template.servantClass,
      avatarUrl: currentAvatar,
      baseAvatarUrl: baseAvatar,
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
      bondLevel: c.servant.bondLevel || 1
    };
  };

  const activeP1 = mapToActive(p1);
  const activeP2 = mapToActive(p2);
  const activeP1Ally = p1Ally ? mapToActive(p1Ally) : undefined;
  const activeP2Ally = p2Ally ? mapToActive(p2Ally) : undefined;

  // If lastLogText is a kill log or skill log without damage, look back in combatLogsHistory for the strike log
  let strikeLogText = lastLogText || '';
  if (!/DMG/i.test(strikeLogText) && combatLogsHistory && combatLogsHistory.length > 0) {
    for (let k = combatLogsHistory.length - 1; k >= 0; k--) {
      if (/DMG/i.test(combatLogsHistory[k])) {
        strikeLogText = combatLogsHistory[k];
        break;
      }
    }
  }

  const isCrit = lastLogText.includes('CRITICAL') || strikeLogText.includes('CRITICAL');
  const isNP = lastLogText.includes('NOBLE PHANTASM') || strikeLogText.includes('NOBLE PHANTASM');

  // Identify who was the attacker in the most recent combat log entry
  const allCombatants = [p1, p2, p1Ally, p2Ally].filter((c): c is DuelCombatant => !!c);
  const foundAttacker = allCombatants.find(c =>
    strikeLogText.includes(`**${c.servant.template.name}**`) ||
    strikeLogText.includes(`**${c.servant.nickname || c.servant.template.name}**`) ||
    strikeLogText.includes(`**${c.username}**`) ||
    lastLogText.includes(`**${c.servant.template.name}**`) ||
    lastLogText.includes(`**${c.username}**`)
  );
  const activeAttacker = foundAttacker || p1;

  const foundDefender = allCombatants.find(c =>
    c !== activeAttacker && (
      strikeLogText.includes(`to ${c.servant.template.name}`) ||
      strikeLogText.includes(`to ${c.servant.nickname || c.servant.template.name}`) ||
      lastLogText.includes(`to ${c.servant.template.name}`)
    )
  );
  const activeDefender = foundDefender || (activeAttacker === p1 ? p2 : p1);

  const activeCards = activeAttacker === p2 ? p2Cards : p1Cards;

  let dQuote = '';
  let dTag = '';

  if (lastLogText.includes('COMMAND SEAL INVOKED')) {
    const quoteMatch = lastLogText.match(/❝ \*\*\*(.*?)\*\*\* ❞/) || lastLogText.match(/\*“{1,2}(.*?)[”"]{1,2}\*/);
    dQuote = quoteMatch ? quoteMatch[1] : (activeAttacker.servant.customQuotes?.commandSeal || 'By my Command Seal, unleash your Noble Phantasm!');
    dTag = 'COMMAND SEAL INVOCATION';
  } else if (lastLogText.includes('activated')) {
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
  const dmgMatch = strikeLogText.match(/Dealt \*\*([\d,]+) DMG\*\*/i)
    || strikeLogText.match(/counter-attacked for \*\*([\d,]+) DMG\*\*/i)
    || strikeLogText.match(/([\d,]+)\s*DMG/i)
    || lastLogText.match(/Dealt \*\*([\d,]+) DMG\*\*/i)
    || lastLogText.match(/([\d,]+)\s*DMG/i);
  const damageDealt = dmgMatch ? parseInt(dmgMatch[1].replace(/,/g, ''), 10) : 0;

  const npMatch = strikeLogText.match(/\+(\d+)%\s*NP/i) || lastLogText.match(/\+(\d+)%\s*NP/i);
  const npCharged = npMatch ? parseInt(npMatch[1], 10) : 0;

  const starMatch = strikeLogText.match(/\+(\d+)\s*Critical Stars/i) || strikeLogText.match(/\+(\d+)\s*Stars/i) || lastLogText.match(/\+(\d+)\s*Critical Stars/i);
  const starsGenerated = starMatch ? parseInt(starMatch[1], 10) : 0;
  const isEvaded = /evaded/i.test(lastLogText) || /evaded/i.test(strikeLogText) || /evade/i.test(lastLogText);
  const isInvincible = /invincible/i.test(lastLogText) || /invincible/i.test(strikeLogText);

  const cleanActionSummary = lastLogText
    .replace(/[*_~`>#]/g, '')
    .replace(/[⚔️💥✨🌀⚡🔴🔵🟢🛡️👑🌟🗡️🔥💀🩸]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  const turnLog: CombatTurnLog = {
    turnNumber: round,
    actorId: activeAttacker.userId,
    actorName: activeAttacker.servant.template.name,
    targetId: activeDefender.userId,
    targetName: activeDefender.servant.template.name,
    actionSummary: cleanActionSummary,
    dialogueQuote: dQuote,
    dialogueTag: dTag,
    dialogueTitle: activeAttacker.servant.template.name,
    cardsUsed: activeCards,
    p1Cards: p1Cards,
    p2Cards: p2Cards,
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

  const imageBuffer = await renderBattleTurnSummary(turnLog, activeP1, activeP2, activeP1Ally, activeP2Ally);
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
  selectedTarget?: DuelCombatant
) {
  const allCombatants = [p1, p2, p1Ally, p2Ally].filter((c): c is DuelCombatant => !!c);
  const activeCombatant = allCombatants.find(c => c.userId === activeUserId) || p1;
  const isP1Team = activeCombatant === p1 || activeCombatant === p1Ally;

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
    targetSection = `\n🎯 **Target Locked:** **${tName}** (Master: <@${selectedTarget.userId}> • HP: **${Math.round(selectedTarget.currentHp).toLocaleString()} / ${selectedTarget.maxHp.toLocaleString()}**)\n`;
  }

  const slotDisplay = `${targetSection}🎴 **Dealt Command Hand (${sClass} Deck • Turn ${cycleTurn}/3):**\n${handDisplay}\n\n🛡️ **Active Class Passives (Max 2):** ${passivesText}${lockedNote}\n\n⚔️ **Selected Chain (${pendingCards.length}/3):**\n\`[ 1: ${c1Text} ]\` ➔ \`[ 2: ${c2Text} ]\` ➔ \`[ 3: ${c3Text} ]\`${leadHelp}`;

  const combatantName = activeCombatant.servant.nickname || activeCombatant.servant.template?.name || 'Servant';
  const embed = new EmbedBuilder()
    .setTitle(`⚔️ HOLY GRAIL WAR DUEL — ROUND ${round}`)
    .setImage('attachment://turn_summary.png')
    .setDescription(
      `👉 **Current Turn:** ${activeCombatant.isAi ? `🤖 Shadow AI (${combatantName}) is calculating...` : `<@${activeCombatant.userId}> (**${combatantName}**), pick **3 Cards** from your dealt hand:`}\n\n${slotDisplay}`
    )
    .setColor(isP1Team ? 0xef4444 : 0x38bdf8);

  const team1List = [p1, p1Ally].filter((c): c is DuelCombatant => !!c);
  const team2List = [p2, p2Ally].filter((c): c is DuelCombatant => !!c);

  if (p1Ally || p2Ally) {
    const team1Str = team1List.map(c => `• <@${c.userId}> (**${c.servant.nickname || c.servant.template?.name || 'Servant'}** • ${Math.round(c.currentHp).toLocaleString()} HP)`).join('\n');
    const team2Str = team2List.map(c => `• <@${c.userId}> (**${c.servant.nickname || c.servant.template?.name || 'Servant'}** • ${Math.round(c.currentHp).toLocaleString()} HP)`).join('\n');
    embed.addFields(
      { name: '🛡️ Team 1', value: team1Str, inline: true },
      { name: '⚔️ Team 2', value: team2Str, inline: true }
    );
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
      .setStyle(ButtonStyle.Secondary)
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
  // Row 3: Skills + Tactical Alliance Assist + Force Join
  const isS3Unlocked = bondLevel >= 5;
  const s3Name = s3 ? s3.name.slice(0, 13) : 'Skill 3';
  row3.addComponents(
    new ButtonBuilder()
      .setCustomId('skill_2')
      .setLabel(!isS3Unlocked ? '🔒 S3 (Bond Lv 5)' : cd3 > 0 ? `S3: ${s3Name} (${cd3}T)` : `🌟 S3: ${s3Name}`)
      .setStyle(!isS3Unlocked || cd3 > 0 ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(!isS3Unlocked || cd3 > 0 || !s3)
  );

  if (hasAlly) {
    row3.addComponents(
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
    row3.addComponents(
      new ButtonBuilder()
        .setCustomId('card_forcejoin')
        .setLabel('Force Join Arena')
        .setEmoji('⚡')
        .setStyle(ButtonStyle.Danger)
    );
  }

  const actionRows: ActionRowBuilder<ButtonBuilder>[] = [row1, row2, row3];

  // Optional Row 4: Target Selection (when multiple opponents are alive in battle)
  if (livingOpponents.length > 1) {
    const targetRow = new ActionRowBuilder<ButtonBuilder>();
    livingOpponents.forEach(opp => {
      const isTarget = opp.userId === selectedTargetId;
      const oppServantName = opp.servant.nickname || opp.servant.template?.name || 'Foe';
      const label = isTarget
        ? `🎯 [TARGET] ${oppServantName} (${Math.round(opp.currentHp)})`
        : `Target: ${oppServantName} (${Math.round(opp.currentHp)})`;

      targetRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`target_${opp.userId}`)
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
  opponent?: DuelCombatant
): { success: boolean; log: string; quote?: string; skillName?: string; skillType?: string; skillDescription?: string } {
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
  const sName = combatant.servant.nickname || combatant.servant.template.name;
  const customSkillQuote = combatant.servant.customQuotes?.skill;
  const skillQuote = customSkillQuote || `My power answers the command! Witness ${skill.name}!`;
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
      combatant.baseAvatarUrl = getServantAvatarAndCardArt(combatant.servant).avatarUrl;
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
  } else if (skill.effectType === 'buff_atk') {
    const val = skill.value || 35;
    const desc = (skill.description || '').toLowerCase();
    const nameLower = (skill.name || '').toLowerCase();
    if (desc.includes('buster') || nameLower.includes('buster') || nameLower.includes('mana burst')) {
      combatant.activeBuffs.push({ name: skill.name, type: 'buster_up', value: val, remainingTurns: skill.duration || 1 });
    } else if (desc.includes('arts') || nameLower.includes('arts') || nameLower.includes('fox')) {
      combatant.activeBuffs.push({ name: skill.name, type: 'arts_up', value: val, remainingTurns: skill.duration || 1 });
    } else if (desc.includes('quick') || nameLower.includes('quick') || nameLower.includes('primordial rune')) {
      combatant.activeBuffs.push({ name: skill.name, type: 'quick_up', value: val, remainingTurns: skill.duration || 1 });
    } else {
      combatant.activeBuffs.push({ name: skill.name, type: 'buff_atk', value: val, remainingTurns: skill.duration || 2 });
      combatant.critStars = Math.min(50, combatant.critStars + 10);
    }
    logText = `⚔️ **${sName}** activated **${skill.name}**!${quoteLine}`;
  } else if (skill.effectType === 'buff_def') {
    const val = skill.value || 30;
    combatant.activeBuffs.push({ name: skill.name, type: 'buff_def', value: val, remainingTurns: skill.duration || 2 });
    logText = `🛡️ **${sName}** activated **${skill.name}**!${quoteLine}`;
  } else if (skill.effectType === 'evade' || skill.effectType === 'invincible') {
    const bType: 'evade' | 'invincible' = skill.effectType === 'invincible' ? 'invincible' : 'evade';
    const isHitBased = skill.name.toLowerCase().includes('protection from arrows') || (skill.description || '').toLowerCase().includes('attacks') || (skill.description || '').toLowerCase().includes('hits');
    combatant.activeBuffs.push({
      name: skill.name,
      type: bType,
      value: 100,
      remainingTurns: isHitBased ? 3 : (skill.duration || 1),
      remainingHits: isHitBased ? 3 : undefined,
      isHitCount: isHitBased
    });
    if (skill.id === 'wisdom_dun_scaith') {
      combatant.critStars = Math.min(50, combatant.critStars + 15);
    }
    logText = bType === 'invincible'
      ? `🛡️ **${sName}** activated **${skill.name}** (Invincible)!${quoteLine}`
      : `💨 **${sName}** activated **${skill.name}** (Evade)!${quoteLine}`;
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
    logText = `🩸 **${sName}** activated **${skill.name}**!${quoteLine}`;
  } else if (skill.effectType === 'heal') {
    const healVal = skill.value || Math.round(combatant.maxHp * 0.25);
    combatant.currentHp = Math.min(combatant.maxHp, combatant.currentHp + healVal);
    logText = `💚 **${sName}** activated **${skill.name}**!${quoteLine}`;
  } else if (skill.effectType === 'np_charge') {
    const npVal = skill.value || 30;
    combatant.npGauge = Math.min(300, combatant.npGauge + npVal);
    combatant.critStars = Math.min(50, combatant.critStars + 15);
    logText = `⚡ **${sName}** activated **${skill.name}**!${quoteLine}`;
  } else if (skill.effectType === 'crit_stars') {
    const starVal = skill.value || 25;
    combatant.critStars = Math.min(50, combatant.critStars + starVal);
    combatant.activeBuffs.push({ name: skill.name, type: 'crit_dmg', value: 40, remainingTurns: skill.duration || 2 });
    logText = `🌟 **${sName}** activated **${skill.name}**!${quoteLine}`;
  } else if (skill.effectType === 'stun' || skill.effectType === 'debuff' || skill.id?.includes('discernment')) {
    if (opponent) {
      opponent.isStunned = true;
      opponent.npGauge = Math.max(0, opponent.npGauge - 20);
      opponent.activeBuffs.push({
        name: `${skill.name} (ATK Down)`,
        type: 'debuff_atk',
        value: skill.value || 20,
        remainingTurns: skill.duration || 1
      });
    }
    logText = `👁️ **${sName}** activated **${skill.name}**!${quoteLine}`;
  } else {
    combatant.activeBuffs.push({ name: skill.name, type: 'buff_atk', value: 25, remainingTurns: 2 });
    logText = `✨ **${sName}** activated **${skill.name}**!${quoteLine}`;
  }

  return {
    success: true,
    log: logText,
    quote: skillQuote,
    skillName: skill.name,
    skillType: skill.effectType || 'buff',
    skillDescription: skill.description || ''
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
  dialogue?: { quote: string; tag: string }
): string {
  // Decrement attacker skill cooldowns
  for (const idxStr of Object.keys(attacker.skillCooldowns)) {
    const idx = parseInt(idxStr, 10);
    if (attacker.skillCooldowns[idx] > 0) {
      attacker.skillCooldowns[idx]--;
    }
  }

  // Craft Essence Turn-Start Passives
  const attackerCe = attacker.servant.equippedCe;
  if (attackerCe) {
    if (attackerCe.id === 'ce_prisma_cosmos' || attackerCe.passiveType === 'np_per_turn') {
      attacker.npGauge = Math.min(300, attacker.npGauge + (attackerCe.passiveValue || 8));
    }
    if (attackerCe.id === 'ce_fragment_2030' || attackerCe.passiveType === 'stars_per_turn') {
      attacker.critStars = Math.min(50, (attacker.critStars || 0) + (attackerCe.passiveValue || 10));
    }
    if (attackerCe.id === 'ce_when_the_flowers_fall') {
      attacker.npGauge = Math.min(300, attacker.npGauge + 4);
    }
    if (attackerCe.id === 'ce_black_grail') {
      attacker.currentHp = Math.max(1, attacker.currentHp - 500);
    }
  }

  // Handle Stun status
  if (attacker.isStunned) {
    attacker.isStunned = false;
    attacker.activeBuffs = attacker.activeBuffs.filter(b => {
      b.remainingTurns--;
      return b.remainingTurns > 0;
    });
    return `💫 **${attacker.servant.template.name}** was **Stunned / NP Sealed** and was unable to attack this turn!`;
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
    // Only decrement offensive / attack-phase buffs when executing an attack!
    // Defensive buffs (evade, invincible, buff_def, guts) must NOT decrement when attacking,
    // so they remain active to protect against enemy strikes.
    if (
      b.type === 'buff_atk' ||
      b.type === 'debuff_atk' ||
      b.type === 'crit_dmg' ||
      b.type === 'np_gen' ||
      b.type === 'buster_up' ||
      b.type === 'arts_up' ||
      b.type === 'quick_up'
    ) {
      b.remainingTurns--;
    }
    if (b.type === 'buff_atk') atkBuff += b.value / 100;
    if (b.type === 'debuff_atk') atkBuff -= b.value / 100;
    if (b.type === 'crit_dmg') critDmgBonus += b.value / 100;
    if (b.type === 'np_gen') npGenBonus += b.value / 100;
    return b.remainingTurns > 0;
  });

  let defBuff = 1.0;
  defender.activeBuffs.forEach(b => {
    if (b.type === 'buff_def') defBuff += b.value / 100;
  });

  const effectiveAtk = attacker.baseAtk * (atkBuff + attackerAvengerAtk);
  const effectiveDef = defender.baseDef * defBuff;

  const classMult = getClassMultiplier(
    attacker.servant.template.servantClass,
    defender.servant.template.servantClass
  );

  let turnBlockedByInvincible = false;
  let turnBlockedByEvade = false;

  const processHitProtection = (): { isProtected: boolean; type?: 'invincible' | 'evade' } => {
    const actorIgnores = attackerCe?.id === 'ce_origin_bullet' || attackerCe?.passiveType === 'ignore_invincible' || attacker.activeBuffs.some(b => b.type === 'ignore_invincible');
    if (actorIgnores) return { isProtected: false };

    // 1. Invincible has priority over Evade
    const invIdx = defender.activeBuffs.findIndex(b => b.type === 'invincible');
    if (invIdx !== -1) {
      const buff = defender.activeBuffs[invIdx];
      if (buff.remainingTurns <= 0 || (buff.remainingHits !== undefined && buff.remainingHits <= 0)) {
        defender.activeBuffs.splice(invIdx, 1);
      } else {
        turnBlockedByInvincible = true;
        const isHitBased = buff.isHitCount || buff.remainingHits !== undefined || /volumen/i.test(buff.name);
        if (isHitBased) {
          if (buff.remainingHits !== undefined) {
            buff.remainingHits--;
            if (buff.remainingHits <= 0) {
              defender.activeBuffs.splice(invIdx, 1);
            }
          } else {
            buff.remainingTurns--;
            if (buff.remainingTurns <= 0) {
              defender.activeBuffs.splice(invIdx, 1);
            }
          }
        }
        return { isProtected: true, type: 'invincible' };
      }
    }

    // 2. Evade check
    const evaIdx = defender.activeBuffs.findIndex(b => b.type === 'evade');
    if (evaIdx !== -1) {
      const buff = defender.activeBuffs[evaIdx];
      if (buff.remainingTurns <= 0 || (buff.remainingHits !== undefined && buff.remainingHits <= 0)) {
        defender.activeBuffs.splice(evaIdx, 1);
      } else {
        turnBlockedByEvade = true;
        const isHitBased = buff.isHitCount || buff.remainingHits !== undefined || /protection from arrows/i.test(buff.name);
        if (isHitBased) {
          if (buff.remainingHits !== undefined) {
            buff.remainingHits--;
            if (buff.remainingHits <= 0) {
              defender.activeBuffs.splice(evaIdx, 1);
            }
          } else {
            buff.remainingTurns--;
            if (buff.remainingTurns <= 0) {
              defender.activeBuffs.splice(evaIdx, 1);
            }
          }
        }
        return { isProtected: true, type: 'evade' };
      }
    }

    return { isProtected: false };
  };

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
        let ceNpDmgMult = 1.0;
        if (attackerCe) {
          if (attackerCe.id === 'ce_black_grail' || attackerCe.id === 'ce_heavens_feel' || attackerCe.id === 'ce_when_the_flowers_fall' || attackerCe.passiveType === 'np_dmg_up') {
            ceNpDmgMult += (attackerCe.passiveValue || 30) / 100;
          }
        }
        const rawNpDmg = (effectiveAtk * (baseMultiplier / 100) * 0.18 * cardTypeScale * scopeScale * overchargeScale * classMult * cardPerfMult * ceNpDmgMult * variance);
        npDmg = Math.round(Math.max(1200, rawNpDmg) * PVP_DAMAGE_MODIFIER) + flatDivinity;

        const hitProt = processHitProtection();
        if (hitProt.isProtected) {
          npDmg = 0; // Completely evade/nullify incoming NP damage
        }

        // Refund properties dictated by card type (Balanced FGO tuning)
        if (npCardType === 'Buster') {
          const hasOverchargeRefund = /refund|recharge/i.test(attacker.servant.template.noblePhantasm?.overchargeEffect || '');
          npRefund = hasOverchargeRefund ? (overchargeLevel >= 2 ? 30 : 20) : 0;
          npStars = npScope === 'aoe' ? 5 : 2;
        } else if (npCardType === 'Arts') {
          const baseRefund = npScope === 'aoe' ? 18 : 12;
          let artsRefundScale = 1.0 + artsBuff / 100;
          if (attackerCe?.id === 'ce_jeweled_sword') artsRefundScale *= 1.15;
          if (attackerCe?.id === 'ce_formal_craft') artsRefundScale *= 1.10;
          npRefund = Math.round(baseRefund * artsRefundScale);
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
      const ceBuster = attackerCe?.passiveType === 'buster_up' && attackerCe.id !== 'ce_black_grail' ? (attackerCe.passiveValue || 0) : 0;
      let cardMult = 1.4 * posMult * (1.0 + (madnessBonus + ceBuster) / 100);
      if (i > 0 && isBusterFirst) cardMult += 0.50; // Buster Lead Bonus

      let critChance = Math.min(0.95, (starsForCrits * 2.0) / 100);
      if (i > 0 && isQuickFirst) critChance = Math.min(0.95, critChance + 0.20);

      const hitCrit = Math.random() < critChance;
      if (hitCrit) isAnyCrit = true;
      const ceCritBonus = (attackerCe?.passiveType === 'crit_dmg' ? (attackerCe.passiveValue || 0) : 0) / 100;
      const critMult = hitCrit ? (1.75 * (critDmgBonus + ceCritBonus)) : 1.0;
      const variance = 0.95 + Math.random() * 0.10;

      const baseHit = (effectiveAtk * cardMult * 0.11) - (effectiveDef * 2) + busterChainBonusDmg;
      let hitDmg = Math.round(Math.max(350, baseHit) * classMult * critMult * variance * PVP_DAMAGE_MODIFIER) + flatDivinity;

      if (attackerCe?.id === 'ce_origin_bullet' && (defender.servant.template.servantClass === 'Caster' || (defender.servant.template.baseStats?.mana || 0) >= 12)) {
        hitDmg = Math.round(hitDmg * 1.35);
      }

      const hitProt = processHitProtection();
      if (hitProt.isProtected) {
        hitDmg = 0; // 0 DMG on Evade/Invincible
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
      const ceArts = attackerCe?.passiveType === 'arts_up' ? (attackerCe.passiveValue || 0) : 0;
      let cardMult = 1.0 * posMult * (1.0 + (territoryBonus + ceArts) / 100);
      if (i > 0 && isBusterFirst) cardMult += 0.50;

      let critChance = Math.min(0.85, (starsForCrits * 1.8) / 100);
      if (i > 0 && isQuickFirst) critChance = Math.min(0.95, critChance + 0.20);

      const hitCrit = Math.random() < critChance;
      if (hitCrit) isAnyCrit = true;
      const ceCritBonus = (attackerCe?.passiveType === 'crit_dmg' ? (attackerCe.passiveValue || 0) : 0) / 100;
      const critMult = hitCrit ? (1.75 * (critDmgBonus + ceCritBonus)) : 1.0;
      const variance = 0.95 + Math.random() * 0.10;

      const baseHit = (effectiveAtk * cardMult * 0.11) - (effectiveDef * 2);
      let hitDmg = Math.round(Math.max(280, baseHit) * classMult * critMult * variance * PVP_DAMAGE_MODIFIER) + flatDivinity;

      if (attackerCe?.id === 'ce_origin_bullet' && (defender.servant.template.servantClass === 'Caster' || (defender.servant.template.baseStats?.mana || 0) >= 12)) {
        hitDmg = Math.round(hitDmg * 1.35);
      }

      const hitProt = processHitProtection();
      if (hitProt.isProtected) {
        hitDmg = 0; // 0 DMG on Evade/Invincible
      }

      // FGO Arts NP rule: 8-10 base NP gain scaled by position (1.0x/1.2x/1.4x), crit (1.5x), and Arts 1st Lead (+50%)
      const baseArtsNp = 8 + Math.floor(Math.random() * 3);
      let ceNpArtScale = 1.0;
      if (attackerCe?.id === 'ce_jeweled_sword') ceNpArtScale *= 1.15;
      if (attackerCe?.id === 'ce_formal_craft') ceNpArtScale *= 1.10;
      let npGain = Math.round(baseArtsNp * posMult * npGenBonus * ceNpArtScale * (hitCrit ? 1.5 : 1.0) * (1.0 + (territoryBonus + ceArts) / 100));
      if (i > 0 && isArtsFirst) npGain = Math.round(npGain * 1.5); // Arts Lead Bonus

      attacker.npGauge = Math.min(300, attacker.npGauge + npGain);
      totalNpGained += npGain;

      // Arts stars: 1 star (2 on crit)
      const artsStars = hitCrit ? 2 : 1;
      totalStarsGained += artsStars;

      totalSeqDmg += hitDmg;
    } else if (card === 'Quick') {
      const ceQuick = attackerCe?.passiveType === 'quick_up' ? (attackerCe.passiveValue || 0) : 0;
      let cardMult = 0.85 * posMult * (1.0 + (ridingBonus + ceQuick) / 100);
      if (i > 0 && isBusterFirst) cardMult += 0.50;

      let critChance = Math.min(0.95, (starsForCrits * 2.2) / 100);
      if (i > 0 && isQuickFirst) critChance = Math.min(0.95, critChance + 0.20);

      const hitCrit = Math.random() < critChance;
      if (hitCrit) isAnyCrit = true;
      const ceCritBonus = (attackerCe?.passiveType === 'crit_dmg' ? (attackerCe.passiveValue || 0) : 0) / 100;
      const critMult = hitCrit ? (1.75 * (critDmgBonus + ceCritBonus)) : 1.0;
      const variance = 0.95 + Math.random() * 0.10;

      const baseHit = (effectiveAtk * cardMult * 0.11) - (effectiveDef * 2);
      let hitDmg = Math.round(Math.max(220, baseHit) * classMult * critMult * variance * PVP_DAMAGE_MODIFIER) + flatDivinity;

      if (attackerCe?.id === 'ce_origin_bullet' && (defender.servant.template.servantClass === 'Caster' || (defender.servant.template.baseStats?.mana || 0) >= 12)) {
        hitDmg = Math.round(hitDmg * 1.35);
      }

      const hitProt = processHitProtection();
      if (hitProt.isProtected) {
        hitDmg = 0; // 0 DMG on Evade/Invincible
      }

      // FGO Quick stars: 4-6 base stars scaled by position (1.0x/1.25x/1.5x), crit (1.4x), and Quick 1st Lead (+30%)
      const baseQuickStars = 4 + Math.floor(Math.random() * 3);
      let starsGained = Math.round(baseQuickStars * (1.0 + (i * 0.25)) * (hitCrit ? 1.4 : 1.0) * (1.0 + (ridingBonus + ceQuick + presenceConcealBonus) / 100));
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
      extraDmg = 0;
    }
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

  // Consume turn-based and hit-based Evade / Invincibility and decrement DEF buffs after defending against an attack sequence
  defender.activeBuffs = defender.activeBuffs.filter(b => {
    const isHitBased = b.isHitCount || b.remainingHits !== undefined || /volumen|protection from arrows/i.test(b.name);
    if (b.type === 'evade' || b.type === 'invincible') {
      b.remainingTurns--;
      if (b.remainingTurns <= 0) return false;
      if (isHitBased && b.remainingHits !== undefined && b.remainingHits <= 0) return false;
      return true;
    }
    if (b.type === 'buff_def' && b.remainingTurns < 90) {
      b.remainingTurns--;
      return b.remainingTurns > 0;
    }
    return true;
  });

  // Decrement attacker offensive buffs
  attacker.activeBuffs = attacker.activeBuffs.filter(b => {
    if (b.type === 'buff_atk' || b.type === 'crit_dmg' || b.type === 'buster_up' || b.type === 'arts_up' || b.type === 'quick_up') {
      b.remainingTurns--;
      return b.remainingTurns > 0;
    }
    return true;
  });

  // Decrement transformation duration and revert if expired
  let revertText = '';
  if (attacker.isTransformed && attacker.transformationTurns !== undefined) {
    attacker.transformationTurns--;
    if (attacker.transformationTurns <= 0) {
      attacker.isTransformed = false;
      attacker.transformationTurns = 0;
      attacker.avatarUrl = attacker.baseAvatarUrl || getServantAvatarAndCardArt(attacker.servant).avatarUrl;
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

  const logText = `⚔️ **${attacker.servant.template.name}** executed sequence **[${seqNames}]**${npHeader}${critTag}${evadeTag}:${quoteLine}\n` +
    `• Dealt **${totalSeqDmg.toLocaleString()} DMG** to ${defender.servant.template.name}\n` +
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

      await interaction.reply({ embeds: [deadEmbed], flags: MessageFlags.Ephemeral });
      return;
    }

    const challengerServant =
      challengerMaster.servants.find(s => s.id === challengerMaster.activeServantId) ||
      challengerMaster.servants[0];

    const mode = interaction.options.getString('mode') || '1v1';
    const opponentUser = interaction.options.getUser('opponent');
    const allyUser = interaction.options.getUser('ally');
    const opponent2User = interaction.options.getUser('opponent2');

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
      let opponentMaster: MasterProfile;
      let opponentServant: any;

      if (opponentUser && !opponentUser.bot && opponentUser.id !== interaction.user.id) {
        opponentMaster = await getOrCreateMaster(opponentUser.id, opponentUser.username);
        opponentServant = opponentMaster.servants?.find(s => s.id === opponentMaster.activeServantId) || opponentMaster.servants?.[0];
      } else {
        opponentMaster = {
          id: 'master_ai_shadow_kirei',
          discordId: 'ai_shadow_kirei',
          username: 'Shadow Magus Kirei',
          avatarUrl: '',
          commandSeals: 3,
          saintQuartz: 0,
          summonTickets: 0,
          actionPoints: 100,
          maxActionPoints: 100,
          pityCount: 0,
          grailWarWins: 0,
          reputationRank: 'Honorable Magus',
          servants: [],
          craftEssences: []
        };
        const oppTemplate = SERVANT_DATABASE.find(s => s.id === 'servant_lancer_cuchulainn') || SERVANT_DATABASE[1] || SERVANT_DATABASE[0];
        opponentServant = {
          id: 'shadow_cu',
          masterId: opponentMaster.id,
          templateId: oppTemplate.id,
          template: oppTemplate,
          level: 70,
          experience: 0,
          bondLevel: 5,
          currentHp: oppTemplate.baseHp || 28000,
          allocatedStats: { strength: 15, endurance: 15, agility: 20, mana: 10, luck: 10 },
          availableStatPoints: 0,
          skillLevels: [6, 6, 6],
          customQuotes: {}
        };
      }

      if (!opponentServant) {
        const oppTemplate = SERVANT_DATABASE.find(s => s.id === 'servant_lancer_cuchulainn') || SERVANT_DATABASE[0];
        opponentServant = {
          id: 'shadow_servant',
          masterId: opponentMaster.id,
          templateId: oppTemplate.id,
          template: oppTemplate,
          level: 70,
          experience: 0,
          bondLevel: 5,
          currentHp: oppTemplate.baseHp || 28000,
          allocatedStats: { strength: 15, endurance: 15, agility: 20, mana: 10, luck: 10 },
          availableStatPoints: 0,
          skillLevels: [6, 6, 6],
          customQuotes: {}
        };
      }

      const p1Part = warSession.participants[challengerMaster.discordId];
      const p1Hp = p1Part ? calculateCurrentHp(p1Part) : undefined;
      const p1 = createCombatant(challengerMaster, challengerServant, false, p1Hp);

      const p2Part = opponentMaster.discordId.startsWith('ai_') ? null : warSession.participants[opponentMaster.discordId];
      const p2Hp = p2Part ? calculateCurrentHp(p2Part) : undefined;
      const p2 = createCombatant(opponentMaster, opponentServant, opponentMaster.discordId.startsWith('ai_'), p2Hp);

      let p1Ally: DuelCombatant | undefined;
      let p1AllyMaster: MasterProfile | null = null;
      let p2Ally: DuelCombatant | undefined;
      let p2AllyMaster: MasterProfile | null = null;

      if (allyUser && !allyUser.bot && allyUser.id !== interaction.user.id) {
        p1AllyMaster = await getOrCreateMaster(allyUser.id, allyUser.username);
        const allyServant = p1AllyMaster.servants?.find(s => s.id === p1AllyMaster!.activeServantId) || p1AllyMaster.servants?.[0];
        if (allyServant) {
          const allyPart = warSession.participants[p1AllyMaster.discordId];
          const allyHp = allyPart ? calculateCurrentHp(allyPart) : undefined;
          p1Ally = createCombatant(p1AllyMaster, allyServant, false, allyHp);
        }
      } else if (is2v2) {
        p1AllyMaster = {
          id: 'master_ai_shadow_rin',
          discordId: 'ai_shadow_rin',
          username: 'Shadow Magus Rin',
          avatarUrl: '',
          commandSeals: 3,
          saintQuartz: 0,
          summonTickets: 0,
          actionPoints: 100,
          maxActionPoints: 100,
          pityCount: 0,
          grailWarWins: 0,
          reputationRank: 'Honorable Magus',
          servants: [],
          craftEssences: []
        };
        const allyTpl = SERVANT_DATABASE.find(s => s.id === 'servant_archer_emiya') || SERVANT_DATABASE[0];
        const allySrv: MasterServantInstance = {
          id: 'shadow_archer',
          masterId: p1AllyMaster.id,
          templateId: allyTpl.id,
          template: allyTpl,
          level: 70,
          experience: 0,
          bondLevel: 5,
          currentHp: allyTpl.baseHp || 26000,
          allocatedStats: { strength: 15, endurance: 15, agility: 15, mana: 15, luck: 10 },
          availableStatPoints: 0,
          skillLevels: [6, 6, 6],
          customQuotes: {}
        };
        p1Ally = createCombatant(p1AllyMaster, allySrv, true);
      }

      if (opponent2User && !opponent2User.bot && opponent2User.id !== interaction.user.id) {
        p2AllyMaster = await getOrCreateMaster(opponent2User.id, opponent2User.username);
        const opp2Servant = p2AllyMaster.servants?.find(s => s.id === p2AllyMaster!.activeServantId) || p2AllyMaster.servants?.[0];
        if (opp2Servant) {
          const opp2Part = warSession.participants[p2AllyMaster.discordId];
          const opp2Hp = opp2Part ? calculateCurrentHp(opp2Part) : undefined;
          p2Ally = createCombatant(p2AllyMaster, opp2Servant, false, opp2Hp);
        }
      } else {
        p2AllyMaster = {
          id: 'master_ai_shadow_sakura',
          discordId: 'ai_shadow_sakura',
          username: 'Shadow Magus Sakura',
          avatarUrl: '',
          commandSeals: 3,
          saintQuartz: 0,
          summonTickets: 0,
          actionPoints: 100,
          maxActionPoints: 100,
          pityCount: 0,
          grailWarWins: 0,
          reputationRank: 'Honorable Magus',
          servants: [],
          craftEssences: []
        };
        const opp2Tpl = SERVANT_DATABASE.find(s => s.id === 'servant_rider_medusa') || SERVANT_DATABASE[2] || SERVANT_DATABASE[0];
        const opp2Srv: MasterServantInstance = {
          id: 'shadow_rider',
          masterId: p2AllyMaster.id,
          templateId: opp2Tpl.id,
          template: opp2Tpl,
          level: 70,
          experience: 0,
          bondLevel: 5,
          currentHp: opp2Tpl.baseHp || 25000,
          allocatedStats: { strength: 15, endurance: 15, agility: 20, mana: 10, luck: 10 },
          availableStatPoints: 0,
          skillLevels: [6, 6, 6],
          customQuotes: {}
        };
        p2Ally = createCombatant(p2AllyMaster, opp2Srv, true);
      }

      if (is2v2) {
        p1.critStars = 25;
        p1.activeBuffs = p1.activeBuffs || [];
        p1.activeBuffs.push({
          name: '2v2 Alliance Formation',
          type: 'buff_atk',
          value: 15,
          remainingTurns: 3
        });
      }

      // Collect required human confirmations
      const invitedHumans = new Map<string, { user: User; role: string; accepted: boolean }>();
      if (opponentUser && !opponentUser.bot && opponentUser.id !== interaction.user.id) {
        invitedHumans.set(opponentUser.id, { user: opponentUser, role: 'Opponent Master', accepted: false });
      }
      if (allyUser && !allyUser.bot && allyUser.id !== interaction.user.id && !invitedHumans.has(allyUser.id)) {
        invitedHumans.set(allyUser.id, { user: allyUser, role: 'Ally Master', accepted: false });
      }
      if (opponent2User && !opponent2User.bot && opponent2User.id !== interaction.user.id && !invitedHumans.has(opponent2User.id)) {
        invitedHumans.set(opponent2User.id, { user: opponent2User, role: 'Secondary Opponent', accepted: false });
      }

      // If no human masters need confirmation, start immediately!
      if (invitedHumans.size === 0) {
        await interaction.deferReply();
        await startInteractiveDuel(
          interaction,
          p1,
          p2,
          challengerMaster,
          opponentMaster,
          p1Ally,
          p2Ally,
          p1AllyMaster,
          p2AllyMaster
        );
        return;
      }

      // Send multi-master invitation prompt requiring confirmation from all challenged human masters
      const inviteEmbed = new EmbedBuilder()
        .setTitle(`⚔️ HOLY GRAIL WAR: ${is2v2 ? '2v2 TAG-TEAM' : '1v2 RAID'} DUEL CHALLENGE`)
        .setDescription(
          `Master <@${interaction.user.id}> has issued a **${is2v2 ? '2v2 Tag-Team' : '1v2 Raid'}** challenge!\n\n` +
          `🛡️ **Team 1:** <@${interaction.user.id}> (**${p1.servant.template?.name || 'Servant'}**) ${p1AllyMaster ? `& <@${p1AllyMaster.discordId}> (**${p1Ally?.servant.template?.name || 'Servant'}**)` : ''}\n` +
          `⚔️ **Team 2:** <@${opponentMaster.discordId}> (**${p2.servant.template?.name || 'Servant'}**) ${p2AllyMaster ? `& <@${p2AllyMaster.discordId}> (**${p2Ally?.servant.template?.name || 'Servant'}**)` : ''}\n\n` +
          `📜 **Challenge Confirmation Status:**\n` +
          `• <@${interaction.user.id}> (Challenger): ✅ **Initiator**\n` +
          `• ${[...invitedHumans.values()].map(h => `<@${h.user.id}> (${h.role}): ⏳ **Pending Confirmation**`).join('\n• ')}\n\n` +
          `*All challenged Masters must accept to enter the Holy Grail War arena!*`
        )
        .setColor(0xd4af37);

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
                  `🛡️ **Team 1:** <@${interaction.user.id}> (**${p1.servant.template?.name || 'Servant'}**) ${p1AllyMaster ? `& <@${p1AllyMaster.discordId}> (**${p1Ally?.servant.template?.name || 'Servant'}**)` : ''}\n` +
                  `⚔️ **Team 2:** <@${opponentMaster.discordId}> (**${p2.servant.template?.name || 'Servant'}**) ${p2AllyMaster ? `& <@${p2AllyMaster.discordId}> (**${p2Ally?.servant.template?.name || 'Servant'}**)` : ''}\n\n` +
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
                p2AllyMaster
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

      const alreadySlainCivilian = (warSession.civilianCasualties || []).find(
        c => c.id === opponentUser.id || c.name.toLowerCase().includes(opponentUser.username.toLowerCase())
      );

      if ((opponentParticipant && !opponentParticipant.isAlive) || (isOpponentCivilian && alreadySlainCivilian)) {
        await interaction.reply({
          content: `☠️ Civilian <@${opponentUser.id}> was already slain earlier in this Holy Grail War! A civilian cannot be killed twice.`,
          flags: MessageFlags.Ephemeral
        });
        return;
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
              const p1Hp = p1Part ? calculateCurrentHp(p1Part) : undefined;
              const p1 = createCombatant(challengerMaster, challengerServant, false, p1Hp);

              const p2Part = warSession.participants[opponentUser.id] ||
                Object.values(warSession.participants).find(p => p.username.toLowerCase() === opponentUser.username.toLowerCase());
              const p2Hp = p2Part ? calculateCurrentHp(p2Part) : undefined;
              const p2 = createCombatant(opponentMaster, opponentServant, false, p2Hp);
              await startInteractiveDuel(i, p1, p2, challengerMaster, opponentMaster);
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
            const p1Hp = p1Part ? calculateCurrentHp(p1Part) : undefined;
            const p1 = createCombatant(challengerMaster, challengerServant, false, p1Hp);

            const p2Part = warSession.participants[targetRival.discordId] ||
              Object.values(warSession.participants).find(p => p.username.toLowerCase() === targetRival.username.toLowerCase());
            const p2Hp = p2Part ? calculateCurrentHp(p2Part) : undefined;
            const p2 = createCombatant(opponentMaster, opponentServant, false, p2Hp);
            await startInteractiveDuel(i, p1, p2, challengerMaster, opponentMaster);
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
  p2AllyMaster?: MasterProfile | null
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
  let team1AssistUsed = false;
  let team2AssistUsed = false;
  let forceJoinCount = (team1.length + team2.length >= 4 ? 1 : 0);

  const getLivingTeam1 = () => team1.filter(c => c.currentHp > 0);
  const getLivingTeam2 = () => team2.filter(c => c.currentHp > 0);
  const getTargetsFor = (combatant: DuelCombatant) => {
    if (team1.includes(combatant)) return getLivingTeam2();
    return getLivingTeam1();
  };
  const getMyTeamFor = (combatant: DuelCombatant) => {
    if (team1.includes(combatant)) return team1;
    return team2;
  };
  const getSelectedTarget = (combatant: DuelCombatant): DuelCombatant | undefined => {
    const opps = getTargetsFor(combatant);
    if (opps.length === 0) return undefined;
    let target = opps.find(o => o.userId === combatant.selectedTargetId && o.currentHp > 0);
    if (!target) {
      target = opps[0];
      combatant.selectedTargetId = target.userId;
    }
    return target;
  };

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
    const oppLiving = getTargetsFor(activeCombatant);
    const myTeam = getMyTeamFor(activeCombatant);
    const hasAlly = myTeam.length > 1;
    const isT1 = team1.includes(activeCombatant);
    const assistAvail = isT1 ? (!team1AssistUsed && hasAlly) : (!team2AssistUsed && hasAlly);
    const forceJoinAvail = (team1.length + team2.length < 4);

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
      target
    );
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
      combatLogs
    );
  };

  const p1Class = t1?.servantClass || 'Saber';
  const p1AvatarUrl = t1?.avatarUrl;

  const p2Class = t2?.servantClass || 'Saber';
  const p2AvatarUrl = t2?.avatarUrl;

  const initialAttachment = await buildCurrentAttachment();
  const initialEmbed = buildCurrentEmbed();
  const initialButtons = buildCurrentButtons();

  const startEmbeds = [initialEmbed];
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
    'fuyuki'
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
    'fuyuki'
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
    const p1AllyAvatarUrl = p1AllyTpl?.avatarUrl;
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
      'fuyuki'
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
    const p2AllyAvatarUrl = p2AllyTpl?.avatarUrl;
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
      'fuyuki'
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
  const activePingsContent = activeHumanUsers.length > 0
    ? `⚔️ **Holy Grail War Duel In Progress!** ${activeHumanUsers.join(' ')}`
    : null;

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

  // Component Collector for turn choices - resets idle timer on every valid player action
  const collector = battleMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    idle: 300000, // 5 minutes per player turn
    time: 3600000 // 1 hour absolute safety ceiling
  });

  const advanceTurn = async (interactionToEdit?: any) => {
    // If either team is completely eliminated, conclude duel!
    if (getLivingTeam1().length === 0 || getLivingTeam2().length === 0) {
      collector.stop('finished');
      const isTeam1Winner = getLivingTeam1().length > 0;
      const winner = isTeam1Winner ? (team1.find(c => c.currentHp > 0) || p1) : (team2.find(c => c.currentHp > 0) || p2);
      const loser = isTeam1Winner ? (team2[0] || p2) : (team1[0] || p1);
      const finalAttachment = await buildCurrentAttachment();
      await finishDuel(interactionToEdit || contextInteraction, winner, loser, p1Master, p2Master, finalAttachment);
      return;
    }

    let cycleCount = 0;
    while (cycleCount < turnOrder.length * 2) {
      currentTurnIndex = (currentTurnIndex + 1) % turnOrder.length;
      cycleCount++;
      if (currentTurnIndex === 0) {
        round++;
      }
      const candidate = turnOrder[currentTurnIndex];
      if (candidate.currentHp > 0) {
        activeCombatant = candidate;
        activeUserId = activeCombatant.userId;
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
        await advanceTurn(interactionToEdit);
        return;
      }
      // AI chooses target (prefer lowest HP or random)
      const target = opps[Math.floor(Math.random() * opps.length)];
      activeCombatant.selectedTargetId = target.userId;

      // AI tactical skill usage
      const aiSkills = activeCombatant.servant.template.skills || [];
      const aiBond = activeCombatant.servant.bondLevel || 3;
      for (let sIdx = 0; sIdx < aiSkills.length; sIdx++) {
        if (sIdx === 2 && aiBond < 5) continue;
        if ((activeCombatant.skillCooldowns[sIdx] || 0) <= 0 && Math.random() < 0.35) {
          const aiSkillRes = activateCombatantSkill(activeCombatant, sIdx, target);
          if (aiSkillRes.success) {
            combatLogs.push(aiSkillRes.log);
            if (combatLogs.length > 4) combatLogs.shift();
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
        await dispatchNpGif(activeCombatant, interactionToEdit || contextInteraction);
      }

      const aiLog = resolveStrike(activeCombatant, target, aiSequence, aiDialogue);
      refreshCombatantHand(activeCombatant);
      combatLogs.push(aiLog);
      if (combatLogs.length > 4) combatLogs.shift();

      // Check if target was slain
      if (target.currentHp <= 0) {
        const killLog = `💀 **${target.servant.nickname || target.servant.template.name}** (Master: ${target.username}) has fallen in battle!`;
        combatLogs.push(killLog);
        if (combatLogs.length > 4) combatLogs.shift();
      }

      // Check if duel is over
      if (getLivingTeam1().length === 0 || getLivingTeam2().length === 0) {
        collector.stop('finished');
        const isTeam1Winner = getLivingTeam1().length > 0;
        const winner = isTeam1Winner ? (team1.find(c => c.currentHp > 0) || p1) : (team2.find(c => c.currentHp > 0) || p2);
        const loser = isTeam1Winner ? (team2[0] || p2) : (team1[0] || p1);
        const finalAttachment = await buildCurrentAttachment();
        await finishDuel(interactionToEdit || contextInteraction, winner, loser, p1Master, p2Master, finalAttachment);
        return;
      }

      // Recursively advance until a human player turn is reached
      await advanceTurn(interactionToEdit);
      return;
    }

    // Human player turn reached: update message
    const turnAttachment = await buildCurrentAttachment();
    const updatedEmbed = buildCurrentEmbed();
    const updatedButtons = buildCurrentButtons();

    if (interactionToEdit) {
      await interactionToEdit.editReply({ embeds: [updatedEmbed], files: [turnAttachment], components: updatedButtons });
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
      const aiLog = resolveStrike(activeCombatant, target, aiSequence, aiDialogue);
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

        const targetId = i.customId.replace('target_', '');
        activeCombatant.selectedTargetId = targetId;

        const target = getSelectedTarget(activeCombatant);
        const targetName = target?.servant.nickname || target?.servant.template?.name || 'Target Opponent';
        combatLogs.push(`🎯 **Target Locked:** <@${activeUserId}> set focus on **${targetName}**!`);
        if (combatLogs.length > 4) combatLogs.shift();

        const updatedEmbed = buildCurrentEmbed();
        const updatedButtons = buildCurrentButtons();

        await i.deferUpdate();
        await i.editReply({ embeds: [updatedEmbed], components: updatedButtons });
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
        const updatedEmbed = buildCurrentEmbed();
        const updatedButtons = buildCurrentButtons();

        await i.deferUpdate();
        await i.editReply({ embeds: [updatedEmbed], files: [turnAttachment], components: updatedButtons });
        return;
      }

      // CASE: FORCE JOIN MID-BATTLE INTERVENTION
      if (i.customId === 'card_forcejoin' || i.customId === 'duel_prompt_forcejoin') {
        if (team1.length + team2.length >= 4) {
          await i.reply({
            content: '❌ Force Join is unavailable! Arena is at maximum capacity (4 combatants).',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (team1.some(c => c.userId === i.user.id) || team2.some(c => c.userId === i.user.id)) {
          await i.reply({
            content: '❌ You are already an active participant in this Holy Grail duel!',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const joinerMaster = await getOrCreateMaster(i.user.id, i.user.username);
        if (!joinerMaster.servants || joinerMaster.servants.length === 0) {
          await i.reply({
            content: '❌ You must summon a Servant before force-joining an active Holy Grail War battle! Invoke `/summon ritual` first.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        let targetTeam1 = true;
        let actionInteraction: any = i;

        // If 1v1 battle, prompt 3rd Master to choose which team to reinforce!
        if (team1.length === 1 && team2.length === 1) {
          const p1Name = p1.username || p1.servant.nickname || p1.servant.template.name;
          const p2Name = p2.username || p2.servant.nickname || p2.servant.template.name;

          const fjRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId('fj_join_team1')
              .setLabel(`Ally with Team 1 (${p1Name.slice(0, 15)})`)
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🛡️'),
            new ButtonBuilder()
              .setCustomId('fj_join_team2')
              .setLabel(`Ally with Team 2 (${p2Name.slice(0, 15)})`)
              .setStyle(ButtonStyle.Danger)
              .setEmoji('⚔️')
          );

          const ephemeralReply = await i.reply({
            content: `⚡ **FORCE JOIN ARENA:** Select which Master/Team you wish to assist in combat:`,
            components: [fjRow],
            flags: MessageFlags.Ephemeral,
            withResponse: true,
            fetchReply: true
          });

          const promptMsg = (ephemeralReply as any)?.resource?.message || ephemeralReply || (await i.fetchReply().catch(() => null));

          let selectionInteraction: any = null;
          try {
            if (promptMsg && typeof promptMsg.awaitMessageComponent === 'function') {
              selectionInteraction = await promptMsg.awaitMessageComponent({
                filter: (btn: any) => btn.user.id === i.user.id && (btn.customId === 'fj_join_team1' || btn.customId === 'fj_join_team2'),
                time: 30000
              });
            } else if (i.channel && typeof i.channel.awaitMessageComponent === 'function') {
              selectionInteraction = await i.channel.awaitMessageComponent({
                filter: (btn: any) => btn.user.id === i.user.id && (btn.customId === 'fj_join_team1' || btn.customId === 'fj_join_team2'),
                time: 30000
              });
            }
          } catch {
            await i.editReply({
              content: '⏱️ Force Join team selection timed out.',
              components: []
            }).catch(() => {});
            return;
          }

          if (!selectionInteraction) {
            return;
          }

          actionInteraction = selectionInteraction;
          targetTeam1 = selectionInteraction.customId === 'fj_join_team1';
        } else {
          targetTeam1 = team1.length <= team2.length;
        }

        const joinServant = joinerMaster.servants.find(s => s.id === joinerMaster.activeServantId) || joinerMaster.servants[0];
        const joinName = joinServant.nickname || joinServant.template?.name || 'Heroic Spirit';

        const warSession = getOrInitWarSession(p1Master);
        const joinPart = warSession.participants[joinerMaster.discordId];
        const joinHp = joinPart ? calculateCurrentHp(joinPart) : undefined;
        const joinCombatant = createCombatant(joinerMaster, joinServant, false, joinHp);

        joinCombatant.critStars = 20;
        joinCombatant.activeBuffs = joinCombatant.activeBuffs || [];
        joinCombatant.activeBuffs.push({
          name: '3rd Master Reinforcement',
          type: 'buff_atk',
          value: 30,
          remainingTurns: 3
        });

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

        const totalParticipants = team1.length + team2.length;
        const joinOrdinal = totalParticipants === 3 ? '3RD' : totalParticipants === 4 ? '4TH' : `${totalParticipants}TH`;
        const teamLeaderName = targetTeam1 ? p1.username : p2.username;
        const forceJoinLog = `⚡ **${joinOrdinal} MASTER FORCE JOIN INTERVENTION!** <@${i.user.id}> entered the fray with **${joinName}** to assist **${teamLeaderName}**! Reinforced with **+30% ATK (3T)** & **+20 Critical Stars**!`;
        combatLogs.push(forceJoinLog);
        if (combatLogs.length > 4) combatLogs.shift();

        const turnAttachment = await buildCurrentAttachment(forceJoinLog);
        const updatedEmbed = buildCurrentEmbed();
        const updatedButtons = buildCurrentButtons();

        if (actionInteraction !== i) {
          await actionInteraction.update({
            content: `⚡ **FORCE JOIN SUCCESSFUL!** You have allied with **${teamLeaderName}** as a 3rd Master reinforcement! Entering combat...`,
            components: []
          });
        } else {
          await i.reply({
            content: `⚡ **FORCE JOIN SUCCESSFUL!** You entered the fray to assist **${teamLeaderName}**!`,
            flags: MessageFlags.Ephemeral
          });
        }

        if (battleMsg) {
          await battleMsg.edit({ embeds: [updatedEmbed], files: [turnAttachment], components: updatedButtons });
        } else if (contextInteraction) {
          await contextInteraction.editReply({ embeds: [updatedEmbed], files: [turnAttachment], components: updatedButtons });
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

      // Reset inactivity idle timer on active player action
      collector.resetTimer();

      // Automatically delete active NP GIF asynchronously without delaying interaction
      cleanupNpGif().catch(() => {});

      // CASE: SKILL ACTIVATION (Instant - does NOT end turn)
      if (i.customId.startsWith('skill_')) {
        const skillIdx = parseInt(i.customId.replace('skill_', ''), 10);
        const actor = activeCombatant;
        const opponent = getSelectedTarget(actor) || (team1.includes(actor) ? p2 : p1);
        const res = activateCombatantSkill(actor, skillIdx, opponent);

        if (!res.success) {
          await i.followUp({ content: res.log, flags: MessageFlags.Ephemeral });
          return;
        }

        try {
          const sName = actor.servant.nickname || actor.servant.template?.name || 'Heroic Spirit';
          const sClass = actor.servant.template?.servantClass || 'Servant';
          const avatarUrl = actor.servant.template?.avatarUrl;
          const bondLvl = actor.servant.bondLevel || 8;

          const oppName = opponent.servant.nickname || opponent.servant.template?.name || 'Opponent Servant';
          const oppClass = opponent.servant.template?.servantClass || 'Servant';
          const oppAvatarUrl = opponent.servant.template?.avatarUrl;

          const skillName = res.skillName || 'TACTICAL SKILL';
          const skillQuote = res.quote || 'My power answers the command!';

          const skillDiaBuffer = await renderSkillDialogueCard(
            sName,
            skillName,
            skillQuote,
            sClass,
            avatarUrl,
            bondLvl,
            res.skillType || 'buff',
            res.skillDescription ? [res.skillDescription] : [],
            'fuyuki'
          );

          if (skillDiaBuffer && skillDiaBuffer.length > 500) {
            const attachment = new AttachmentBuilder(skillDiaBuffer, { name: 'vn_dialogue.gif' });
            const skillDialogueObj = {
              quote: skillQuote,
              tag: `SKILL: ${skillName.toUpperCase()}`,
              color: 0x38bdf8
            };
            const cutInEmbed = buildDialogueCutInEmbed(actor, opponent, ['Arts'], skillDialogueObj, true);
            await i.editReply({ embeds: [cutInEmbed], files: [attachment], components: [] });

            await new Promise(r => setTimeout(r, 2500));
          }
        } catch (err) {
          console.warn('Failed to render Skill visual novel dialogue cut-in:', err);
        }

        combatLogs.push(res.log);
        if (combatLogs.length > 4) combatLogs.shift();

        const turnAttachment = await buildCurrentAttachment(res.log);
        const updatedEmbed = buildCurrentEmbed();
        const updatedButtons = buildCurrentButtons();
        await i.editReply({ embeds: [updatedEmbed], files: [turnAttachment], components: updatedButtons });
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
          actingMaster.commandSeals = actor.commandSeals;
          await saveMaster(actingMaster);
        }

        try {
          const sName = actor.servant.nickname || actor.servant.template?.name || 'Heroic Spirit';
          const sClass = actor.servant.template?.servantClass || 'Servant';
          const servantAvatarUrl = actor.servant.template?.avatarUrl;

          const masterName = actingMaster?.username || actor.username;
          const masterAvatarUrl = (i.user?.id === actingMaster?.discordId ? i.user.displayAvatarURL({ extension: 'png', size: 512 }) : undefined)
            || actingMaster?.avatarUrl
            || actor.masterAvatarUrl;

          const sealQuote = res.quote || 'By my Command Seal, unleash your Noble Phantasm!';

          const sealDiaBuffer = await renderMasterCommandSealDialogueCard(
            masterName,
            sealQuote,
            masterAvatarUrl,
            actor.commandSeals,
            sName,
            sClass,
            servantAvatarUrl,
            'fuyuki'
          );

          if (sealDiaBuffer && sealDiaBuffer.length > 500) {
            const attachment = new AttachmentBuilder(sealDiaBuffer, { name: 'vn_dialogue.gif' });
            const cutInEmbed = buildMasterCommandSealDialogueCutInEmbed(
              masterName,
              masterAvatarUrl,
              sName,
              sClass,
              sealQuote,
              true
            );
            await i.editReply({ embeds: [cutInEmbed], files: [attachment], components: [] });

            await new Promise(r => setTimeout(r, 2500));
          }
        } catch (err) {
          console.warn('Failed to render Command Seal visual novel dialogue cut-in:', err);
        }

        combatLogs.push(res.log);
        if (combatLogs.length > 4) combatLogs.shift();

        const turnAttachment = await buildCurrentAttachment(res.log);
        const updatedEmbed = buildCurrentEmbed();
        const updatedButtons = buildCurrentButtons();
        await i.editReply({ embeds: [updatedEmbed], files: [turnAttachment], components: updatedButtons });
        return;
      }

      // CASE: RESET PENDING CARDS
      if (i.customId === 'card_reset') {
        activePendingCards = [];
        activePendingIndices = [];
        const updatedEmbed = buildCurrentEmbed();
        const updatedButtons = buildCurrentButtons();
        await i.editReply({ embeds: [updatedEmbed], components: updatedButtons });
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
          collector.stop('flee_success');

          const warSession = getOrInitWarSession(p1Master);
          const now = Date.now();
          const p1Part = warSession.participants[p1.userId];
          if (p1Part) {
            p1Part.currentHp = Math.min(p1Part.maxHp, Math.max(1, p1.currentHp));
            p1Part.baseHpAtDamage = p1Part.currentHp;
            p1Part.lastDamageTime = now;
          }
          const p2Part = warSession.participants[p2.userId];
          if (p2Part) {
            p2Part.currentHp = Math.min(p2Part.maxHp, Math.max(1, p2.currentHp));
            p2Part.baseHpAtDamage = p2Part.currentHp;
            p2Part.lastDamageTime = now;
          }
          if (p1Master && p1Master.servants) {
            const s1 = p1Master.servants.find(s => s.id === p1.servant.id);
            if (s1) s1.currentHp = p1.currentHp;
            await saveMaster(p1Master);
          }
          if (p2Master && p2Master.servants) {
            const s2 = p2Master.servants.find(s => s.id === p2.servant.id);
            if (s2) s2.currentHp = p2.currentHp;
            await saveMaster(p2Master);
          }

          const retreatEmbed = new EmbedBuilder()
            .setTitle('🏃 TACTICAL RETREAT SUCCESSFUL')
            .setDescription(
              `**${fleeActor.servant.nickname || fleeActor.servant.template.name}** broke line of sight and safely disengaged from combat!\n\n` +
              `> *"A tactical withdrawal preserves the spirit for the decisive battle."*\n\n` +
              `🛡️ **Retreat Outcome:**\n` +
              `• Turn ${round} Action: **Tactical Retreat (Turn Consumed)**\n` +
              `• Escape Success Rate: **${fleeInfo.chancePercent}%**${fleeInfo.isAgilityBonus ? ' *(+5% Agility bonus applied)*' : ''}\n` +
              `• Current HP Preserved: **${fleeActor.currentHp.toLocaleString()} / ${fleeActor.maxHp.toLocaleString()}**\n` +
              `• No Holy Grail War rating penalties or win streak deductions were incurred.`
            )
            .setColor(0xf59e0b)
            .setFooter({ text: `Holy Grail War Engine • Round ${round} • Retreat Success Rate: ${fleeInfo.chancePercent}%` });

          if (fleeActor.servant.template?.avatarUrl) {
            retreatEmbed.setThumbnail(fleeActor.servant.template.avatarUrl);
          }

          await i.editReply({ embeds: [retreatEmbed], components: [] });
          return;
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
        const updatedEmbed = buildCurrentEmbed();
        const updatedButtons = buildCurrentButtons();
        await i.editReply({ embeds: [updatedEmbed], components: updatedButtons });
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

      if (isNoblePhantasm) {
        await dispatchNpGif(attacker, i);
      } else if (shouldCutIn) {
        try {
          const sName = attacker.servant.nickname || attacker.servant.template?.name || 'Heroic Spirit';
          const sClass = attacker.servant.template?.servantClass || 'Servant';
          const avatarUrl = attacker.servant.template?.avatarUrl;
          const bondLvl = attacker.servant.bondLevel || 8;

          const dName = defender.servant.nickname || defender.servant.template?.name || 'Opponent Servant';
          const dClass = defender.servant.template?.servantClass || 'Servant';
          const dAvatarUrl = defender.servant.template?.avatarUrl;

          const diaBuffer = await renderDialogueCard(
            sName,
            playerDialogue.quote,
            playerDialogue.tag,
            sClass,
            avatarUrl,
            bondLvl,
            dName,
            dAvatarUrl,
            dClass,
            playerSequence
          );

          if (diaBuffer && diaBuffer.length > 500) {
            const attachment = new AttachmentBuilder(diaBuffer, { name: 'vn_dialogue.gif' });
            const cutInEmbed = buildDialogueCutInEmbed(attacker, defender, playerSequence, playerDialogue, true);
            await i.editReply({ embeds: [cutInEmbed], files: [attachment], components: [] });

            await new Promise(r => setTimeout(r, 3000));
          }
        } catch (err) {
          console.warn('Failed to render visual novel dialogue cut-in:', err);
        }
      }

      const log = resolveStrike(attacker, defender, playerSequence, playerDialogue);
      refreshCombatantHand(attacker);
      combatLogs.push(log);
      if (combatLogs.length > 4) combatLogs.shift();

      if (team1.includes(attacker)) {
        p1LastCards = playerSequence;
      } else {
        p2LastCards = playerSequence;
      }

      // Check if Defender was slain
      if (defender.currentHp <= 0) {
        const killLog = `💀 **${defender.servant.nickname || defender.servant.template.name}** (Master: ${defender.username}) was vanquished!`;
        combatLogs.push(killLog);
        if (combatLogs.length > 4) combatLogs.shift();
      }

      // Advance to the next player's / servant's turn!
      await advanceTurn(i);
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
          content: '⌛ **Duel ended due to inactivity** *(Turn timed out after 5 minutes of no input)*.',
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

  // Check if defeated Master has Command Seals to run or take defeat
  const loserMaster = loser.userId === p1Master.discordId ? p1Master : (p2Master || null);
  const winnerMaster = winner.userId === p1Master.discordId ? p1Master : (p2Master || null);
  const loserParticipant = warSession?.participants[loser.userId] ||
    Object.values(warSession?.participants || {}).find(p => p.username.toLowerCase() === loser.username.toLowerCase() || p.servantName.toLowerCase() === loser.servant.template.name.toLowerCase());
  const winnerParticipant = warSession?.participants[winner.userId] ||
    Object.values(warSession?.participants || {}).find(p => p.username.toLowerCase() === winner.username.toLowerCase() || p.servantName.toLowerCase() === winner.servant.template.name.toLowerCase());
  const availableSeals = loserMaster ? (loserMaster.commandSeals ?? 3) : (loserParticipant?.commandSeals ?? loser.commandSeals ?? 3);
  const autoConsume = loserMaster 
    ? (loserMaster.autoConsumeCommandSeal === true) 
    : (loserParticipant?.autoEvadeEnabled === true || loserParticipant?.autoConsumeCommandSeal === true);

  // Setup visual novel defeat card data
  const loserName = loser.servant.nickname || loser.servant.template?.name || 'Heroic Spirit';
  const loserClass = loser.servant.template?.servantClass || 'Saber';
  const loserAvatarUrl = loser.servant.template?.avatarUrl;
  const loserBond = loser.servant.bondLevel || 5;
  const loserDefeatQuote = loser.servant.customQuotes?.defeat || loser.servant.template?.defeatQuote || "Master... I have failed you in battle...";

  const winnerName = winner.servant.nickname || winner.servant.template?.name || 'Heroic Spirit';
  const winnerClass = winner.servant.template?.servantClass || 'Saber';
  const winnerAvatarUrl = winner.servant.template?.avatarUrl;

  const defaultTag = availableSeals >= 1 ? 'CRITICAL DEFEAT' : 'SPIRIT ORIGIN DISSOLVED';

  const defeatCardBuffer = await renderDefeatDialogueCard(
    loserName,
    loserDefeatQuote,
    defaultTag,
    loserClass,
    loserAvatarUrl,
    loserBond,
    winnerName,
    winnerAvatarUrl,
    winnerClass,
    'fuyuki'
  ).catch((err) => {
    console.error('Error rendering defeat dialogue card on server:', err);
    return null;
  });

  const defeatCardAttachment = defeatCardBuffer 
    ? new AttachmentBuilder(defeatCardBuffer, { name: 'defeat_dialogue.png' })
    : null;

  if (availableSeals >= 1) {
    if (autoConsume === true) {
      if (loserMaster) {
        loserMaster.commandSeals = Math.max(0, availableSeals - 1);
        const sLoser = loserMaster.servants?.find(s => s.id === loser.servant.id);
        if (sLoser) sLoser.currentHp = 1;
        await saveMaster(loserMaster);
      }
      if (loserParticipant) {
        loserParticipant.commandSeals = Math.max(0, availableSeals - 1);
        loserParticipant.currentHp = 1;
        loserParticipant.baseHpAtDamage = 1;
        loserParticipant.lastDamageTime = Date.now();
        loserParticipant.isAlive = true;
        loserParticipant.inSanctuary = true;
      }
      if (winnerParticipant) {
        winnerParticipant.currentHp = Math.min(winnerParticipant.maxHp, Math.max(1, winner.currentHp));
        winnerParticipant.baseHpAtDamage = winnerParticipant.currentHp;
        winnerParticipant.lastDamageTime = Date.now();
      }
      if (winnerMaster) {
        const sWin = winnerMaster.servants?.find(s => s.id === winner.servant.id);
        if (sWin) sWin.currentHp = winner.currentHp;
        await saveMaster(winnerMaster);
      }

      const interventionEmbed = new EmbedBuilder()
        .setTitle('🔴 COMMAND SEAL AUTOMATIC EVACUATION')
        .setDescription(
          `**${winner.servant.template.name}** (Master: ${winner.username}) dealt a mortal blow to **${loser.servant.template.name}** (Master: ${loser.username})!\n\n` +
          `🔮 **Auto-Consume Enabled:** Defeated Master possessed **${availableSeals}/3 Command Seals**.\n` +
          `1 Command Seal was automatically expended (Remaining: **${availableSeals - 1}/3**).\n\n` +
          `✨ **Emergency Sanctuary:** Your Command Seal flared with crimson light, relocating your Servant from fatal annihilation preserved at **1 HP**!\n` +
          `Contract preserved. Permanent elimination has been averted.`
        )
        .setColor(0xf59e0b)
        .setFooter({ text: 'Holy Grail War Survival Protocol • Command Seal Sanctuary' });

      if (loser.servant.template.avatarUrl) {
        safeSetEmbedThumbnail(interventionEmbed, loser.servant.template.avatarUrl);
      }

      // Render custom sanctuary/evac card
      const autoEvacCardBuffer = await renderDefeatDialogueCard(
        loserName,
        loserDefeatQuote,
        'EMERGENCY SANCTUARY',
        loserClass,
        loserAvatarUrl,
        loserBond,
        winnerName,
        winnerAvatarUrl,
        winnerClass,
        'fuyuki'
      ).catch(() => null);

      const autoEvacAttachment = autoEvacCardBuffer 
        ? new AttachmentBuilder(autoEvacCardBuffer, { name: 'evac_dialogue.png' }) 
        : null;

      if (autoEvacAttachment) {
        interventionEmbed.setImage('attachment://evac_dialogue.png');
      }

      const summaryEmbed = new EmbedBuilder()
        .setTitle('⚔️ FINAL COMBAT ROUND SUMMARY')
        .setDescription(`**${winner.servant.template.name}** dealt the final blow to **${loser.servant.template.name}**!`)
        .setImage('attachment://turn_summary.png')
        .setColor(0x0f172a);

      const responseFiles = [finalAttachment];
      if (autoEvacAttachment) responseFiles.push(autoEvacAttachment);

      if (i.deferred || i.replied) {
        await i.editReply({
          embeds: [summaryEmbed, interventionEmbed],
          files: responseFiles,
          components: []
        });
      } else {
        await i.update({
          embeds: [summaryEmbed, interventionEmbed],
          files: responseFiles,
          components: []
        });
      }
      return;
    }

    // Default: auto-consume is OFF. Present the 1-minute decision prompt for the defeated Master!
    const decisionEmbed = new EmbedBuilder()
      .setTitle('⚠️ CRITICAL DEFEAT — COMMAND SEAL DECISION')
      .setDescription(
        `**${winner.servant.template.name}** (Master: ${winner.username}) dealt a mortal blow to **${loser.servant.template.name}** (Master: ${loser.username})!\n\n` +
        `🔮 **Command Seal Evacuation Available:** Defeated Master **${loser.username}** possesses **${availableSeals}/3 Command Seals**.\n` +
        `When a Master loses, they get a last chance to expend **1 Command Seal** to run and emergency-teleport their Servant to safety preserved at **1 HP**, preventing contract severance and Holy Grail War elimination.\n\n` +
        `⏱️ **Time Limit:** You have **1 minute (60 seconds)** to decide. If time expires or defeat is taken, the victor will decide your fate.\n` +
        `*(Auto-consume option is OFF by default to protect your Command Seals)*`
      )
      .setColor(0xf59e0b)
      .setFooter({ text: 'Holy Grail War Survival Protocol • 1-Minute Decision Window (Auto-consume: OFF)' });

    if (loser.servant.template.avatarUrl) {
      safeSetEmbedThumbnail(decisionEmbed, loser.servant.template.avatarUrl);
    }

    if (defeatCardAttachment) {
      decisionEmbed.setImage('attachment://defeat_dialogue.png');
    }

    const decisionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('duel_evacuate_seal')
        .setLabel(`Use Command Seal to Run (${availableSeals}/3)`)
        .setEmoji('🔮')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('duel_accept_defeat')
        .setLabel('Take Defeat')
        .setEmoji('💀')
        .setStyle(ButtonStyle.Secondary)
    );

    const summaryEmbed = new EmbedBuilder()
      .setTitle('⚔️ FINAL COMBAT ROUND SUMMARY')
      .setDescription(`**${winner.servant.template.name}** dealt the final blow to **${loser.servant.template.name}**!`)
      .setImage('attachment://turn_summary.png')
      .setColor(0x0f172a);

    const responseFiles = [finalAttachment];
    if (defeatCardAttachment) responseFiles.push(defeatCardAttachment);

    let responseMsg: any;
    if (i.deferred || i.replied) {
      responseMsg = await i.editReply({
        embeds: [summaryEmbed, decisionEmbed],
        files: responseFiles,
        components: [decisionRow]
      });
    } else {
      responseMsg = await i.update({
        embeds: [summaryEmbed, decisionEmbed],
        files: responseFiles,
        components: [decisionRow]
      });
    }

    const targetMsg = responseMsg || (i.fetchReply ? await i.fetchReply().catch(() => null) : null);

    if (targetMsg && targetMsg.awaitMessageComponent) {
      try {
        const decision = await targetMsg.awaitMessageComponent({
          filter: (btnInt: any) => btnInt.user.id === (loserMaster?.discordId || loser.userId),
          componentType: ComponentType.Button,
          time: 60000 // 1-minute time limit
        });

        if (decision.customId === 'duel_evacuate_seal') {
          if (loserMaster) {
            loserMaster.commandSeals = Math.max(0, availableSeals - 1);
            const sLoser = loserMaster.servants?.find(s => s.id === loser.servant.id);
            if (sLoser) sLoser.currentHp = 1;
            await saveMaster(loserMaster);
          }
          if (loserParticipant) {
            loserParticipant.commandSeals = Math.max(0, availableSeals - 1);
            loserParticipant.currentHp = 1;
            loserParticipant.baseHpAtDamage = 1;
            loserParticipant.lastDamageTime = Date.now();
            loserParticipant.isAlive = true;
            loserParticipant.inSanctuary = true;
          }
          if (winnerParticipant) {
            winnerParticipant.currentHp = Math.min(winnerParticipant.maxHp, Math.max(1, winner.currentHp));
            winnerParticipant.baseHpAtDamage = winnerParticipant.currentHp;
            winnerParticipant.lastDamageTime = Date.now();
          }
          if (winnerMaster) {
            const sWin = winnerMaster.servants?.find(s => s.id === winner.servant.id);
            if (sWin) sWin.currentHp = winner.currentHp;
            await saveMaster(winnerMaster);
          }

          const interventionEmbed = new EmbedBuilder()
            .setTitle('🔴 COMMAND SEAL EMERGENCY EVACUATION')
            .setDescription(
              `**${loser.servant.template.name}** was saved from mortal annihilation!\n\n` +
              `🔮 **Command Seal Invoked:** 1 Command Seal expended by Master **${loser.username}** (Remaining: **${availableSeals - 1}/3**).\n\n` +
              `✨ **Emergency Sanctuary:** Preserved at **1 HP** and evacuated to sanctuary.\n` +
              `Contract preserved. Permanent elimination has been averted.`
            )
            .setColor(0xf59e0b)
            .setFooter({ text: 'Holy Grail War Survival Protocol • Command Seal Sanctuary' });

          if (loser.servant.template.avatarUrl) {
            interventionEmbed.setThumbnail(loser.servant.template.avatarUrl);
          }

          const manualEvacCardBuffer = await renderDefeatDialogueCard(
            loserName,
            loserDefeatQuote,
            'EMERGENCY SANCTUARY',
            loserClass,
            loserAvatarUrl,
            loserBond,
            winnerName,
            winnerAvatarUrl,
            winnerClass,
            'fuyuki'
          ).catch(() => null);

          const manualEvacAttachment = manualEvacCardBuffer 
            ? new AttachmentBuilder(manualEvacCardBuffer, { name: 'evac_dialogue.png' }) 
            : null;

          if (manualEvacAttachment) {
            interventionEmbed.setImage('attachment://evac_dialogue.png');
          }

          await decision.update({
            embeds: [interventionEmbed],
            files: manualEvacAttachment ? [manualEvacAttachment] : [],
            components: []
          });
          return;
        } else {
          await decision.deferUpdate().catch(() => {});
        }
      } catch {
        // 1 minute expired without choice -> Defeat is accepted!
      }
    }
  }

  // If AI opponent won and defeat is accepted (or no seals left): Eliminate player
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

    if (defeatCardAttachment) {
      defeatEmbed.setImage('attachment://defeat_dialogue.png');
    }

    const summaryEmbed = new EmbedBuilder()
      .setTitle('⚔️ FINAL COMBAT ROUND SUMMARY')
      .setDescription(`**${winner.servant.template.name}** dealt the final blow to **${loser.servant.template.name}**!`)
      .setImage('attachment://turn_summary.png')
      .setColor(0x0f172a);

    const responseFiles = [finalAttachment];
    if (defeatCardAttachment) responseFiles.push(defeatCardAttachment);

    if (i.deferred || i.replied) {
      await i.editReply({
        embeds: [summaryEmbed, defeatEmbed],
        files: responseFiles,
        components: []
      });
    } else {
      await i.update({
        embeds: [summaryEmbed, defeatEmbed],
        files: responseFiles,
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
    winner.servant.customQuotes?.victory || winner.servant.template.victoryQuote || "A decisive triumph. The Holy Grail draws closer.";

  const victoryCardBuffer = await renderDialogueCard(
    winnerName,
    victoryQuote,
    'VICTORY INVOCATION',
    winnerClass,
    winnerAvatarUrl,
    winner.servant.bondLevel || 5,
    loserName,
    loserAvatarUrl,
    loserClass,
    ['Buster', 'Buster', 'Buster'],
    'fuyuki'
  ).catch((err) => {
    console.error('Error rendering victory dialogue card on server:', err);
    return null;
  });

  const victoryCardAttachment = victoryCardBuffer 
    ? new AttachmentBuilder(victoryCardBuffer, { name: 'victory_dialogue.png' })
    : null;

  const victoryEmbed = new EmbedBuilder()
    .setTitle('🏆 DUEL VICTORY — VICTORY INVOCATION')
    .setDescription(
      `**${winner.servant.template.name}** (Master: ${winner.username}) has triumphed over **${loser.servant.template.name}** (Master: ${loser.username}) in the Holy Grail duel!\n\n` +
      `💬 **[VICTORY INVOCATION] ${winner.servant.template.name}:**\n> ❝ ***${victoryQuote}*** ❞`
    )
    .setColor(0x22c55e);

  if (winner.servant.template.avatarUrl) {
    safeSetEmbedThumbnail(victoryEmbed, winner.servant.template.avatarUrl);
  }

  if (victoryCardAttachment) {
    victoryEmbed.setImage('attachment://victory_dialogue.png');
  }

  const fateEmbed = new EmbedBuilder()
    .setTitle('⚖️ FATE DECISION — DECIDE MASTER\'S FATE')
    .setDescription(
      `⚖️ **The Fate of Master ${loser.username} rests in your hands:**\n` +
      `Choose whether to **Execute** the defeated Master to permanently eliminate them from the Holy Grail War, or show mercy and **Spare** their life.\n\n` +
      `💬 **[DEFEAT MONOLOGUE] ${loser.servant.template.name}:**\n> ❝ ***${loserDefeatQuote}*** ❞`
    )
    .setColor(0xef4444);

  if (loser.servant.template.avatarUrl) {
    safeSetEmbedThumbnail(fateEmbed, loser.servant.template.avatarUrl);
  }

  if (defeatCardAttachment) {
    fateEmbed.setImage('attachment://defeat_dialogue.png');
  }

  const summaryEmbed = new EmbedBuilder()
    .setTitle('⚔️ FINAL COMBAT ROUND SUMMARY')
    .setDescription(`**${winner.servant.template.name}** dealt the final blow to **${loser.servant.template.name}**!`)
    .setImage('attachment://turn_summary.png')
    .setColor(0x0f172a);

  const responseEmbeds = [summaryEmbed, victoryEmbed, fateEmbed];
  const responseFiles: any[] = [finalAttachment];
  if (victoryCardAttachment) responseFiles.push(victoryCardAttachment);
  if (defeatCardAttachment) responseFiles.push(defeatCardAttachment);

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
      embeds: responseEmbeds,
      files: responseFiles,
      components: [fateRow]
    });
  } else {
    response = await i.update({
      embeds: responseEmbeds,
      files: responseFiles,
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
      const loserMaster = await getOrCreateMaster(loser.userId, loser.username);
      const winnerMaster = await getOrCreateMaster(winner.userId, winner.username);
      
      let bountyRewardText = '';
      if (loserMaster.bountyActive || (loserMaster.innocentKills || 0) >= 10 || loserMaster.isRogueHeretic) {
        winnerMaster.saintQuartz = (winnerMaster.saintQuartz || 0) + 15;
        winnerMaster.commandSeals = Math.min(3, (winnerMaster.commandSeals || 0) + 1);
        loserMaster.bountyActive = false;
        loserMaster.isRogueHeretic = false;
        await saveMaster(winnerMaster);
        await saveMaster(loserMaster);

        bountyRewardText = `\n\n🏆 **CHURCH EXTERMINATION BOUNTY CLAIMED!**\n` +
          `Father Kotomine has awarded Master **${winner.username}** the Extermination Bounty for slaying the Rogue Heretic:\n` +
          `• **+1 Command Seal** 💠 (Consecrated Sigil Restored)\n` +
          `• **+15 Saint Quartz** 💎 (Church Treasury Bounty)\n` +
          `The Blight of Fuyuki has been purged!`;
      }

      const execEmbed = new EmbedBuilder()
        .setTitle('☠️ FATE SEALED — MASTER EXECUTED')
        .setDescription(
          `Master **${winner.username}** has chosen to **EXECUTE** Master **${loser.username}**!\n\n` +
          `☠️ Master **${loser.username}** (${loser.servant.template.name}) was slain and **PERMANENTLY ELIMINATED** from the Holy Grail War.\n\n` +
          `💰 **Master Rewards:** +3 Saint Quartz 💎 | +300 Bond EXP 💖 | +2 Parameter Points 📊` +
          bountyRewardText
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
