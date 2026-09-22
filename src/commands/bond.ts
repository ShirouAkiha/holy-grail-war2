import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  MessageFlags,
  AttachmentBuilder
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { getOrInitWarSession } from '../engine/grailwar';
import { 
  getBondExpProgress, 
  getBondLevelFromExp, 
  getBondEventsForServant, 
  selectActiveInterludeForServant,
  getUnlockedDialogueLinesForServant,
  addBondExpToServant,
  BOND_EXP_TABLE,
  BOND_GIFTS,
  getServantGiftReaction,
  getServantSparringDebrief,
  splitDialogueIntoChunks,
  type BondEvent
} from '../../lib/engine/bondEvents';
import { safeSetEmbedThumbnail } from '../utils/discordEmbedHelper';
import { renderVisualNovelCard } from '../canvas/renderer';
import { checkAndGrantBond10Ce, getBondCraftEssenceForServant } from '../data/craftEssences';

// ==========================================
// 1. SLASH COMMAND DEFINITION
// ==========================================
export const data = new SlashCommandBuilder()
  .setName('bond')
  .setDescription('🌸 Access the Servant Bond System, Visual Novel Interludes, Gifts & Sparring')
  .addStringOption(opt =>
    opt
      .setName('view')
      .setDescription('Choose what section of the Bond Sanctum to open')
      .setRequired(false)
      .addChoices(
        { name: '📊 Bond Status & Progress (View EXP & unlocked perks)', value: 'status' },
        { name: '👥 Bond Roster (View all contracted Servants & Bond Levels)', value: 'roster' },
        { name: '📖 Play Bond Interlude (Visual Novel Event)', value: 'interlude' },
        { name: '🎁 Present Gifts & Afternoon Tea (Boost Bond EXP)', value: 'gift' },
        { name: '⚔️ Master-Servant Sparring & Drills (+120 Bond EXP)', value: 'spar' },
        { name: '🎙️ Voice Quotes & My Room Lines', value: 'quotes' },
        { name: '❓ Ways to Gain Bond Guide', value: 'guide' }
      )
  )
  .addStringOption(opt =>
    opt
      .setName('servant')
      .setDescription('Target specific Servant (name, class, or ID) to view or interact with their Bond Sanctum')
      .setRequired(false)
  );

function renderProgressBar(percent: number): string {
  const total = 10;
  const filled = Math.max(0, Math.min(total, Math.round((percent / 100) * total)));
  return '🌸'.repeat(filled) + '░'.repeat(total - filled);
}

/**
 * Ensures any Discord customId stays strictly <= 100 chars (Discord API requirement).
 */
export function safeCustomId(id: string): string {
  if (id.length <= 100) return id;
  return id.slice(0, 100);
}

/**
 * Returns a short, compact key for a servant (e.g. s_0, s_1) so combined button customIds
 * stay well within Discord's 100-character limit even with long event/choice IDs.
 */
export function getServantCompactKey(servant: any, master: any): string {
  if (!servant) return '0';
  if (master && Array.isArray(master.servants)) {
    const idx = master.servants.findIndex((s: any) => s.id === servant.id);
    if (idx !== -1) return `s_${idx}`;
  }
  return servant.id && servant.id.length > 16 ? servant.id.slice(-12) : (servant.id || '0');
}

export function resolveTargetServant(master: any, servantQuery?: string | null, targetServantId?: string | null): any {
  if (!master.servants || master.servants.length === 0) return null;

  const rawKey = targetServantId || servantQuery;
  if (rawKey && typeof rawKey === 'string' && rawKey.trim()) {
    const q = rawKey.trim();
    const qLower = q.toLowerCase();

    // 1. Check index format (e.g., s_0, s_1, idx_0, @0)
    if (qLower.startsWith('s_') || qLower.startsWith('idx_')) {
      const idxStr = qLower.replace(/^(s_|idx_)/, '');
      const idx = parseInt(idxStr, 10);
      if (!isNaN(idx) && master.servants[idx]) {
        return master.servants[idx];
      }
    }
    if (qLower.startsWith('@')) {
      const idx = parseInt(qLower.slice(1), 10);
      if (!isNaN(idx) && master.servants[idx]) {
        return master.servants[idx];
      }
    }

    // 2. Exact ID
    const byId = master.servants.find((s: any) => s.id === q);
    if (byId) return byId;

    // 3. ID endsWith or contains (for shortened/hashed ID fragments)
    const bySuffix = master.servants.find((s: any) => s.id && (s.id.endsWith(q) || s.id.includes(q)));
    if (bySuffix) return bySuffix;

    // 4. Template ID
    const byTemplateId = master.servants.find((s: any) => (s.template?.id || '').toLowerCase() === qLower);
    if (byTemplateId) return byTemplateId;

    // 5. Name or Nickname contains
    const byName = master.servants.find((s: any) => {
      const name = (s.nickname || s.template?.name || s.name || '').toLowerCase();
      return name.includes(qLower);
    });
    if (byName) return byName;

    // 6. Class matches
    const byClass = master.servants.find((s: any) => (s.template?.servantClass || s.servantClass || '').toLowerCase() === qLower);
    if (byClass) return byClass;
  }

  // Fallback to active servant or first in roster
  return master.servants.find((s: any) => s.id === master.activeServantId) || master.servants[0];
}

// ==========================================
// 2. EMBED BUILDERS
// ==========================================
export function buildBondStatusEmbed(master: any, targetServantId?: string) {
  const targetServant = resolveTargetServant(master, null, targetServantId);

  if (!targetServant) {
    return new EmbedBuilder()
      .setTitle('🌸 Servant Bond Sanctum | No Contracted Servant')
      .setDescription('❌ You have no active Servant contracted. Use `/summon` first to establish a pact!')
      .setColor(0xef4444);
  }

  const sTemplate = targetServant.template || targetServant;
  const servantName = targetServant.nickname || sTemplate.name || 'Heroic Spirit';
  const servantClass = sTemplate.servantClass || 'Saber';
  const bondLvl = targetServant.bondLevel || 1;
  const bondExp = targetServant.bondExp || 0;
  const isActive = targetServant.id === master.activeServantId;

  const progress = getBondExpProgress(bondExp);
  const progressBar = renderProgressBar(progress.progressPercent);
  const events = getBondEventsForServant(targetServant);
  const unlockedQuotes = getUnlockedDialogueLinesForServant(targetServant);
  const completedEvents = targetServant.completedBondEvents || [];

  const statusBadge = isActive ? '⭐ **[ACTIVE CONTRACT]**' : '📜 **[CONTRACTED RESERVE]**';
  const otherServantsCount = (master.servants?.length || 1) - 1;
  const multiServantNote = otherServantsCount > 0
    ? `\n\n💡 *You have **${master.servants.length} contracted Servants**. Use the dropdown below or \`/bond view:roster\` to switch Servants!*`
    : '';

  const isBond10 = bondLvl >= 10;
  const bondCe = getBondCraftEssenceForServant(targetServant.templateId || sTemplate.id || targetServant.id, servantName);
  const bond10Line = isBond10
    ? `• **Bond Level 10:** ✅ **UNLOCKED!** Bestowed Bond Craft Essence: ★4 **${bondCe.name}**\n  *Effect:* ${bondCe.effectText}`
    : `• **Bond Level 10:** 🔒 Unlocks exclusive Max Bond Craft Essence: **${bondCe.name}**`;

  const embed = new EmbedBuilder()
    .setTitle(`🌸 Bond Sanctum | ${servantName} (${servantClass})`)
    .setDescription(
      `${statusBadge}\n` +
      `*Deepen your covenant with ${servantName} through Interludes, Gifts, Conversations, and Battle to unlock voice lines and combat bonuses!*\n\n` +
      `💖 **BOND LEVEL:** Level \`${bondLvl} / 10\` ${isBond10 ? '🎖️ **(MAX BOND)**' : ''}\n` +
      `[${progressBar}] \`${progress.expInCurrentLevel} / ${progress.neededForNextLevel} EXP\` (**${progress.progressPercent}%**)\n\n` +
      `✨ **BOND MILESTONES & PERKS:**\n` +
      `• **Bond Level 1:** Unlocks initial Summoning Quote & basic battle lines.\n` +
      `• **Bond Level 3:** Unlocks Chivalric Trust Interlude & special dialogue.\n` +
      `• **Bond Level 5:** ${bondLvl >= 5 ? '✅ **UNLOCKED!** +10% Command Card Effectiveness & 2nd Class Passive.' : '🔒 Unlocks 2nd Class Passive & +10% Command Card Effectiveness.'}\n` +
      `${bond10Line}\n\n` +
      `📖 **BOND INTERLUDES:** ${events.length} Event(s) (${completedEvents.length} Completed)\n` +
      `🎙️ **UNLOCKED VOICE LINES:** ${unlockedQuotes.length} Quote(s)\n` +
      `💎 **SAINT QUARTZ:** \`${master.saintQuartz || 0} SQ\`${multiServantNote}`
    )
    .setColor(isBond10 ? 0xd4af37 : 0xec4899)
    .setFooter({ text: 'Fate Bond Engine • Visual Novel Interludes & Sanctuary' });

  if (sTemplate.avatarUrl) {
    safeSetEmbedThumbnail(embed, sTemplate.avatarUrl);
  }

  return embed;
}

export function buildBondActionRow(master: any, targetServantId?: string): ActionRowBuilder<any>[] {
  const targetServant = resolveTargetServant(master, null, targetServantId);
  if (!targetServant) return [];

  const sKey = getServantCompactKey(targetServant, master);
  const { event, isReplay } = selectActiveInterludeForServant(targetServant);
  const todayKey = new Date().toISOString().slice(0, 10);
  const usedToday = master.lastSparDay === todayKey ? (master.dailySparCount || 0) : 0;
  const sparsLeft = Math.max(0, MAX_DAILY_SPARS - usedToday);
  const isActive = targetServant.id === master.activeServantId;
  const isBond10 = (targetServant.bondLevel || 1) >= 10;

  const row1Components: ButtonBuilder[] = [
    new ButtonBuilder()
      .setCustomId(safeCustomId(`btn_talk_servant:${sKey}`))
      .setLabel('Talk to Servant 💬')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(safeCustomId(`vn_play_event:${sKey}`))
      .setLabel(event ? `📖 Play Interlude: ${event.title.slice(0, 26)}${isReplay ? ' (Replay)' : ''}` : '📖 Play Interlude')
      .setStyle(isReplay ? ButtonStyle.Secondary : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(safeCustomId(`vn_gift_menu:${sKey}`))
      .setLabel('Present Gifts 🎁')
      .setStyle(ButtonStyle.Secondary)
  ];

  if (isBond10) {
    row1Components.push(
      new ButtonBuilder()
        .setCustomId(safeCustomId(`ce_art_bond:${sKey}`))
        .setLabel('View Bond CE Art 🎖️')
        .setStyle(ButtonStyle.Primary)
    );
  }

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(row1Components);

  const row2Components: ButtonBuilder[] = [
    new ButtonBuilder()
      .setCustomId(safeCustomId(`vn_spar:${sKey}`))
      .setLabel(sparsLeft > 0 ? `Spar & Train ⚔️ (${sparsLeft}/3)` : `Spar & Train ⚔️ (0/3)`)
      .setStyle(sparsLeft > 0 ? ButtonStyle.Secondary : ButtonStyle.Secondary)
      .setDisabled(sparsLeft <= 0),
    new ButtonBuilder()
      .setCustomId(safeCustomId(`vn_view_quotes:${sKey}`))
      .setLabel('Voice Quotes 🎙️')
      .setStyle(ButtonStyle.Secondary)
  ];

  if (!isActive) {
    row2Components.push(
      new ButtonBuilder()
        .setCustomId(safeCustomId(`vn_set_active:${sKey}`))
        .setLabel('Set as Active ⭐')
        .setStyle(ButtonStyle.Primary)
    );
  } else {
    row2Components.push(
      new ButtonBuilder()
        .setCustomId('vn_view_roster')
        .setLabel('Bond Roster 👥')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  row2Components.push(
    new ButtonBuilder()
      .setCustomId('vn_ways_to_bond')
      .setLabel('Bond Guide ❓')
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(row2Components);

  const rows: ActionRowBuilder<any>[] = [row1, row2];

  // If the Master owns multiple servants, include an interactive select dropdown to switch instantly!
  if (master.servants && master.servants.length > 1) {
    const servantOptions = master.servants.slice(0, 25).map((s: any) => {
      const sTemp = s.template || s;
      const sN = s.nickname || sTemp.name || 'Heroic Spirit';
      const sCls = sTemp.servantClass || 'Saber';
      const sLvl = s.bondLevel || 1;
      const isAct = s.id === master.activeServantId;
      const prog = getBondExpProgress(s.bondExp || 0);

      return {
        label: `${sN} (${sCls})`,
        value: s.id,
        description: `Bond Lv.${sLvl}/10 (${prog.progressPercent}%) • ${isAct ? '⭐ Active Partner' : 'Contracted'}`,
        emoji: isAct ? '⭐' : '🌸',
        default: s.id === targetServant.id
      };
    });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('vn_select_servant')
      .setPlaceholder('🔄 Switch to another contracted Servant...')
      .addOptions(servantOptions);

    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    rows.push(selectRow);
  }

  return rows;
}

export function buildBondRosterEmbed(master: any) {
  if (!master.servants || master.servants.length === 0) {
    return new EmbedBuilder()
      .setTitle('🌸 Master Bond Roster | No Contracted Servants')
      .setDescription('❌ You have no Servants contracted yet. Use `/summon` to establish covenants with Heroic Spirits!')
      .setColor(0xef4444);
  }

  const lines = master.servants.map((s: any, idx: number) => {
    const sTemp = s.template || s;
    const sN = s.nickname || sTemp.name || 'Heroic Spirit';
    const sCls = sTemp.servantClass || 'Saber';
    const bondLvl = s.bondLevel || 1;
    const bondExp = s.bondExp || 0;
    const progress = getBondExpProgress(bondExp);
    const progressBar = renderProgressBar(progress.progressPercent);
    const isAct = s.id === master.activeServantId;
    const actBadge = isAct ? ' ⭐ **[ACTIVE]**' : '';
    const events = getBondEventsForServant(s);
    const completed = s.completedBondEvents || [];

    const perks: string[] = [];
    if (bondLvl >= 5) perks.push('✅ Bond 5 Passive');
    if (bondLvl >= 10) perks.push('✅ Bond 10 CE');

    const perkText = perks.length > 0 ? ` • ${perks.join(' • ')}` : '';

    return `**${idx + 1}. [${sCls}] ${sN}**${actBadge}\n` +
      `   💖 **Bond Lv. ${bondLvl} / 10** [${progressBar}] \`${progress.expInCurrentLevel}/${progress.neededForNextLevel} EXP\` (**${progress.progressPercent}%**)\n` +
      `   📖 Interludes: \`${completed.length} / ${events.length} Completed\`${perkText}`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`🌸 Master ${master.username}'s Servant Bond Roster`)
    .setDescription(
      `*Overview of all **${master.servants.length}** contracted Heroic Spirits in your Chaldea Sanctuary.*\n\n` +
      lines.join('\n\n') +
      `\n\n👇 **Select any Servant from the menu below to open their Bond Sanctum, play Interludes, or give Gifts!**`
    )
    .setColor(0xec4899)
    .setFooter({ text: 'Fate Bond Engine • Select a Servant below to interact' });

  return embed;
}

export function buildBondRosterActionRows(master: any): ActionRowBuilder<any>[] {
  const rows: ActionRowBuilder<any>[] = [];

  if (master.servants && master.servants.length > 0) {
    const servantOptions = master.servants.slice(0, 25).map((s: any) => {
      const sTemp = s.template || s;
      const sN = s.nickname || sTemp.name || 'Heroic Spirit';
      const sCls = sTemp.servantClass || 'Saber';
      const sLvl = s.bondLevel || 1;
      const isAct = s.id === master.activeServantId;
      const prog = getBondExpProgress(s.bondExp || 0);

      return {
        label: `${sN} (${sCls})`,
        value: s.id,
        description: `Bond Lv.${sLvl}/10 (${prog.progressPercent}%) • ${isAct ? '⭐ Active Partner' : 'Contracted'}`,
        emoji: isAct ? '⭐' : '🌸',
        default: isAct
      };
    });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('vn_select_servant')
      .setPlaceholder('👉 Choose a Servant to open their Bond Sanctum...')
      .addOptions(servantOptions);

    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
  }

  const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];
  const actKey = getServantCompactKey(activeServant, master);
  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(activeServant ? safeCustomId(`vn_back_status:${actKey}`) : 'vn_back_status')
      .setLabel('📊 Active Servant Sanctum')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('vn_ways_to_bond')
      .setLabel('Bond Guide ❓')
      .setStyle(ButtonStyle.Secondary)
  );

  rows.push(navRow);
  return rows;
}

export function buildBondGiftsEmbed(master: any, targetServantId?: string) {
  const targetServant = resolveTargetServant(master, null, targetServantId);
  const sTemplate = targetServant?.template || targetServant;
  const servantName = targetServant?.nickname || sTemplate?.name || 'Heroic Spirit';
  const currentSq = master.saintQuartz || 0;
  const bondLvl = targetServant?.bondLevel || 1;

  const embed = new EmbedBuilder()
    .setTitle(`🎁 Present Gifts & Treats | ${servantName}`)
    .setDescription(
      `*Offer culinary delights, afternoon tea, or consecrated relics to **${servantName}** to deepen your bond immediately!*\n\n` +
      `💎 **Your Saint Quartz Balance:** \`${currentSq} SQ\`\n` +
      `💖 **Current Bond:** Level \`${bondLvl} / 10\`\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `☕ **1. Chaldea Afternoon Tea**\n` +
      `   • **Cost:** **FREE** (Chaldea Kitchen Daily Service)\n` +
      `   • **Reward:** **+150 Bond EXP**\n` +
      `   • *A warm cup of royal black tea and freshly baked pastries to enjoy together.*\n\n` +
      `🍱 **2. Heroic Feast & Delicacies**\n` +
      `   • **Cost:** 💎 **5 Saint Quartz**\n` +
      `   • **Reward:** **+250 Bond EXP**\n` +
      `   • *A lavish gourmet spread prepared with exquisite culinary care.*\n\n` +
      `🍏 **3. Golden Apple of Eden**\n` +
      `   • **Cost:** 💎 **10 Saint Quartz**\n` +
      `   • **Reward:** **+350 Bond EXP**\n` +
      `   • *A mythical fruit overflowing with pure, revitalizing magical energy.*\n\n` +
      `💠 **4. Sacred Holy Relic**\n` +
      `   • **Cost:** 💎 **15 Saint Quartz**\n` +
      `   • **Reward:** **+500 Bond EXP**\n` +
      `   • *An ancient consecrated sigil that deeply resonates with heroic origins.*`
    )
    .setColor(0xf59e0b)
    .setFooter({ text: 'Choose a gift below to present to your Servant!' });

  if (sTemplate?.avatarUrl) {
    safeSetEmbedThumbnail(embed, sTemplate.avatarUrl);
  }

  return embed;
}

export function buildBondGiftsActionRows(master: any, targetServantId?: string): ActionRowBuilder<ButtonBuilder>[] {
  const targetServant = resolveTargetServant(master, null, targetServantId);
  const sKey = getServantCompactKey(targetServant, master);
  const currentSq = master.saintQuartz || 0;

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(safeCustomId(`vn_give_gift:${sKey}:chaldea_tea`))
      .setLabel('☕ Afternoon Tea (Free)')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(safeCustomId(`vn_give_gift:${sKey}:heroic_feast`))
      .setLabel('🍱 Heroic Feast (5 SQ)')
      .setStyle(currentSq >= 5 ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(safeCustomId(`vn_give_gift:${sKey}:golden_apple`))
      .setLabel('🍏 Golden Apple (10 SQ)')
      .setStyle(currentSq >= 10 ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(safeCustomId(`vn_give_gift:${sKey}:sacred_relic`))
      .setLabel('💠 Sacred Relic (15 SQ)')
      .setStyle(currentSq >= 15 ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(safeCustomId(`vn_back_status:${sKey}`))
      .setLabel('📊 Back to Bond Sanctum')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('vn_view_roster')
      .setLabel('Bond Roster 👥')
      .setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2];
}

export const MAX_DAILY_SPARS = 3;

export function checkSparLimit(master: any): { allowed: boolean; reason?: string; isCooldown?: boolean; remaining: number; max: number } {
  const todayKey = new Date().toISOString().slice(0, 10);
  const usedToday = master.lastSparDay === todayKey ? (master.dailySparCount || 0) : 0;
  const now = Date.now();

  // Burst cooldown: 5 seconds
  if (master.lastSparTimestamp && (now - master.lastSparTimestamp) < 5000) {
    const waitSec = Math.ceil((5000 - (now - master.lastSparTimestamp)) / 1000);
    return {
      allowed: false,
      reason: `⏳ Please catch your breath for **${waitSec}s** before initiating the next tactical sparring drill!`,
      isCooldown: true,
      remaining: Math.max(0, MAX_DAILY_SPARS - usedToday),
      max: MAX_DAILY_SPARS
    };
  }

  if (usedToday >= MAX_DAILY_SPARS) {
    return {
      allowed: false,
      reason: 'limit_reached',
      isCooldown: false,
      remaining: 0,
      max: MAX_DAILY_SPARS
    };
  }

  return {
    allowed: true,
    remaining: MAX_DAILY_SPARS - usedToday,
    max: MAX_DAILY_SPARS
  };
}

export function buildBondGuideEmbed() {
  return new EmbedBuilder()
    .setTitle('🌸 Ways to Increase Servant Bond | Complete Master Guide')
    .setDescription(
      `Your bond with your contracted Heroic Spirit represents trust, synchronicity, and shared resolve. ` +
      `Here are all the ways to earn **Bond EXP** in the Holy Grail War:\n\n` +
      `💬 **1. Telepathic Dialogue (\`/talk\`)**\n` +
      `• Converse with your Servant to earn **+35 to +50 Bond EXP** per interaction.\n\n` +
      `⚔️ **2. Holy Grail Duels (\`/duel\`)**\n` +
      `• Victory in battle awards **+150 Bond EXP** & **+2 Stat Points**.\n` +
      `• Fighting bravely together (defeat/survival) still awards **+60 Bond EXP**.\n` +
      `• Purging Rogue Heretics with open Church bounties awards an extra **+150 Bond EXP**.\n\n` +
      `📖 **3. Visual Novel Interludes (\`/bond view:interlude\`)**\n` +
      `• Experience story quests and dialogues to earn **+150 to +300 Bond EXP** and **Saint Quartz**.\n\n` +
      `🎁 **4. Present Gifts & Tea Time (\`/bond view:gift\`)**\n` +
      `• Offer Afternoon Tea (**FREE**, +150 EXP), Feasts (+250 EXP), Golden Apples (+350 EXP), or Sacred Relics (+500 EXP).\n\n` +
      `⚔️ **5. Master-Servant Sparring (\`/bond view:spar\`)**\n` +
      `• Run tactical combat simulations together in the Sanctum for **+120 Bond EXP**.\n` +
      `• **Daily Limit:** **3 Sparring Sessions per day** (resets at 00:00 UTC).\n\n` +
      `💎 **6. Daily Leyline Harvest (\`/daily\`)**\n` +
      `• Checking in daily awards **+100 Bond EXP** directly to your active partner Servant.`
    )
    .setColor(0xec4899)
    .setFooter({ text: 'Reach Bond Lv. 5 for +10% Card Potency & Bond Lv. 10 for Exclusive CE!' });
}

// ==========================================
// 3. MAIN EXECUTE HANDLER
// ==========================================
export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const viewOption = interaction.options.getString('view') || 'status';
    const servantParam = interaction.options.getString('servant');

    if (viewOption === 'roster') {
      const rosterEmbed = buildBondRosterEmbed(master);
      const rows = buildBondRosterActionRows(master);
      return interaction.editReply({ embeds: [rosterEmbed], components: rows });
    }

    if (viewOption === 'guide') {
      const guideEmbed = buildBondGuideEmbed();
      const rows = buildBondActionRow(master);
      return interaction.editReply({ embeds: [guideEmbed], components: rows });
    }

    const targetServant = resolveTargetServant(master, servantParam);
    if (!targetServant) {
      return interaction.editReply({ content: '❌ You do not have any contracted Servants. Use `/summon` first!' });
    }

    if (viewOption === '10' || viewOption === 'max') {
      targetServant.bondLevel = 10;
      targetServant.bondExp = 4000;
      const grant = checkAndGrantBond10Ce(master, targetServant);
      const sIdx = master.servants.findIndex((s: any) => s.id === targetServant.id);
      if (sIdx !== -1) master.servants[sIdx] = targetServant;
      await saveMaster(master);

      const statusEmbed = buildBondStatusEmbed(master, targetServant);
      const rows = buildBondActionRow(master, targetServant.id);
      return interaction.editReply({
        content: `🎖️ **[MAX BOND GRANTED]** **${targetServant.nickname || targetServant.template?.name}** reached **Bond Level 10**!${grant ? `\nBestowed Bond CE: ★4 **${grant.ce.name}**!` : ''}`,
        embeds: [statusEmbed],
        components: rows
      });
    }

    if (targetServant.bondLevel >= 10) {
      const grant = checkAndGrantBond10Ce(master, targetServant);
      if (grant) {
        const sIdx = master.servants.findIndex((s: any) => s.id === targetServant.id);
        if (sIdx !== -1) master.servants[sIdx] = targetServant;
        await saveMaster(master);
      }
    }

    if (viewOption === 'gift') {
      const giftEmbed = buildBondGiftsEmbed(master, targetServant.id);
      const rows = buildBondGiftsActionRows(master, targetServant.id);
      return interaction.editReply({ embeds: [giftEmbed], components: rows });
    }

    if (viewOption === 'spar') {
      const sparStatus = checkSparLimit(master);
      const sTemplate = targetServant.template || targetServant;
      const servantName = targetServant.nickname || sTemplate.name || 'Heroic Spirit';

      if (!sparStatus.allowed) {
        if (sparStatus.isCooldown) {
          return interaction.editReply({ content: sparStatus.reason || '⏳ Please wait before sparring again!' });
        }

        const limitEmbed = new EmbedBuilder()
          .setTitle(`⚔️ Daily Sparring Limit Reached (${MAX_DAILY_SPARS}/${MAX_DAILY_SPARS} Drills)`)
          .setDescription(
            `**${servantName}** lowers their weapon to rest:\n` +
            `> ❝ *We have pushed our limits in today's combat simulations, Master. Pushing further without proper rest risks overtaxing our spiritual core. Let us resume tactical drills after tomorrow's mana refresh!* ❞\n\n` +
            `📊 **Daily Sparring Limit:** \`${MAX_DAILY_SPARS} / ${MAX_DAILY_SPARS} Drills Completed Today\`\n` +
            `🔄 **Daily Reset:** 00:00 UTC\n\n` +
            `💡 **Other Ways to Deepen Your Bond Today:**\n` +
            `• 💬 **Telepathic Dialogue (\`/talk\`)** — Converse with your Servant (+35 to +50 EXP)\n` +
            `• 🎁 **Present Gifts (\`/bond view:gift\`)** — Enjoy Free Afternoon Tea (+150 EXP) or Feasts\n` +
            `• ⚔️ **Holy Grail Duels (\`/duel\`)** — Battle in official Grail War duels (+150 EXP win / +60 EXP defense)\n` +
            `• 📖 **Visual Novel Interludes (\`/bond view:interlude\`)** — Experience story quests`
          )
          .setColor(0xf59e0b)
          .setFooter({ text: `Daily Sparring Limit: ${MAX_DAILY_SPARS} Sessions per Day (Resets 00:00 UTC)` });

        const sKey = getServantCompactKey(targetServant, master);
        const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(safeCustomId(`vn_gift_menu:${sKey}`))
            .setLabel('Present Gifts 🎁')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(safeCustomId(`vn_back_status:${sKey}`))
            .setLabel('📊 Bond Sanctum')
            .setStyle(ButtonStyle.Secondary)
        );

        return interaction.editReply({ embeds: [limitEmbed], components: [backRow] });
      }

      const todayKey = new Date().toISOString().slice(0, 10);
      const usedToday = master.lastSparDay === todayKey ? (master.dailySparCount || 0) : 0;
      master.dailySparCount = usedToday + 1;
      master.lastSparDay = todayKey;
      master.lastSparTimestamp = Date.now();

      const debrief = getServantSparringDebrief(targetServant);
      const bondGain = 120;
      const bondRes = addBondExpToServant(targetServant, bondGain);
      const updatedServant = bondRes.updatedServant;
      const bond10Grant = checkAndGrantBond10Ce(master, updatedServant);

      const sIdx = master.servants.findIndex((s: any) => s.id === targetServant.id);
      if (sIdx !== -1) {
        master.servants[sIdx] = updatedServant;
      }
      await saveMaster(master);

      const imageBuffer = await renderVisualNovelCard({
        servantName,
        servantClass: sTemplate.servantClass || 'Saber',
        servantAvatarUrl: sTemplate.avatarUrl,
        servantCardArtUrl: sTemplate.cardArtUrl || targetServant?.cardArtUrl,
        servantSpriteUrl: sTemplate.spriteUrl || targetServant?.spriteUrl,
        speakerName: servantName,
        dialogueText: debrief.responseText,
        title: 'Master-Servant Tactical Sparring',
        subtitle: 'Bond Chamber Combat Simulation',
        reactionEmotion: debrief.emotion,
        expGained: bondGain,
        currentBondLevel: updatedServant.bondLevel || 1,
        isComplete: true
      });

      const attachment = new AttachmentBuilder(imageBuffer, { name: 'sparring_drill.png' });
      const bondLvlMsg = bondRes.didLevelUp ? `\n🎉 **[BOND LEVEL UP!]** Reached **Bond Lv. ${bondRes.newLevel}**!` : '';
      const bond10Msg = bond10Grant
        ? `\n\n🎖️ **[MAX BOND 10 REACHED!]** Bestowed Bond Craft Essence: ★4 **${bond10Grant.ce.name}**!\n*Effect:* ${bond10Grant.ce.effectText}\n*(Type \`/ce art ${bond10Grant.ce.name}\` to view high-res card art!)*`
        : '';
      const remainingSpars = MAX_DAILY_SPARS - master.dailySparCount;

      const sparEmbed = new EmbedBuilder()
        .setTitle(`⚔️ Tactical Sparring Complete: ${servantName}`)
        .setDescription(
          `**${servantName}:**\n> ❝ ***${debrief.responseText}*** ❞\n\n` +
          `💖 **Sparring Rewards:**\n` +
          `• **Bond EXP:** \`+${bondGain} Bond EXP\`\n` +
          `• **Current Bond:** Level \`${updatedServant.bondLevel} / 10\`${bondLvlMsg}${bond10Msg}\n` +
          `• **Daily Spar Drills:** \`${master.dailySparCount} / ${MAX_DAILY_SPARS} Completed Today\` (${remainingSpars > 0 ? `${remainingSpars} drill(s) left` : 'Daily limit reached'})`
        )
        .setImage('attachment://sparring_drill.png')
        .setColor(0x38bdf8);

      const sKey = getServantCompactKey(targetServant, master);
      const sparRowComponents = [
        new ButtonBuilder()
          .setCustomId(safeCustomId(`vn_spar:${sKey}`))
          .setLabel(remainingSpars > 0 ? `Spar Again ⚔️ (${remainingSpars} left)` : 'Spar Limit Reached ⚔️')
          .setStyle(remainingSpars > 0 ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setDisabled(remainingSpars <= 0),
        new ButtonBuilder()
          .setCustomId(safeCustomId(`vn_back_status:${sKey}`))
          .setLabel('📊 Bond Sanctum')
          .setStyle(ButtonStyle.Secondary)
      ];

      if (updatedServant.bondLevel >= 10) {
        sparRowComponents.push(
          new ButtonBuilder()
            .setCustomId(safeCustomId(`ce_art_bond:${sKey}`))
            .setLabel('View Bond CE Art 🎖️')
            .setStyle(ButtonStyle.Success)
        );
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(sparRowComponents);

      return interaction.editReply({
        embeds: [sparEmbed],
        files: [attachment],
        components: [row]
      });
    }

    if (viewOption === 'quotes') {
      const sTemplate = targetServant.template || targetServant;
      const servantName = targetServant.nickname || sTemplate.name || 'Heroic Spirit';
      const unlockedQuotes = getUnlockedDialogueLinesForServant(targetServant);
      const quotesList = unlockedQuotes.map(q => 
        `• **${q.title}** (Bond ${q.requiredBondLevel}):\n  *"${q.quoteText}"*`
      ).join('\n\n');

      const quotesEmbed = new EmbedBuilder()
        .setTitle(`🎙️ My Room Voice Quotes | ${servantName}`)
        .setDescription(
          `*Here are the unlocked quotes based on your current Bond Level (${targetServant.bondLevel || 1}/10):*\n\n` +
          (quotesList || 'No quotes unlocked yet.')
        )
        .setColor(0xa855f7)
        .setFooter({ text: 'Increase Bond Level to unlock more My Room dialogue lines!' });

      if (sTemplate.avatarUrl) {
        safeSetEmbedThumbnail(quotesEmbed, sTemplate.avatarUrl);
      }

      const sKey = getServantCompactKey(targetServant, master);
      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(safeCustomId(`vn_play_event:${sKey}`))
          .setLabel('📖 Play Interlude')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(safeCustomId(`vn_back_status:${sKey}`))
          .setLabel('📊 Bond Status')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({
        embeds: [quotesEmbed],
        components: [backRow]
      });
    }

    if (viewOption === 'interlude') {
      const { event, isReplay, statusNote } = selectActiveInterludeForServant(targetServant);
      const scene1 = event.scenes[0];
      const sTemplate = targetServant.template || targetServant;
      const servantName = targetServant.nickname || sTemplate.name || 'Heroic Spirit';

      // Generate VN Canvas Image
      const imageBuffer = await renderVisualNovelCard({
        servantName,
        servantClass: sTemplate.servantClass || 'Saber',
        servantAvatarUrl: sTemplate.avatarUrl,
        servantCardArtUrl: sTemplate.cardArtUrl || targetServant?.cardArtUrl,
        servantSpriteUrl: sTemplate.spriteUrl || targetServant?.spriteUrl,
        speakerName: scene1.speakerName || servantName,
        dialogueText: scene1.dialogueText,
        title: event.title,
        subtitle: event.subtitle,
        currentBondLevel: targetServant.bondLevel || 1
      });

      const attachment = new AttachmentBuilder(imageBuffer, { name: 'visual_novel.png' });
      const cleanTitle = event.title.replace(/^Bond Interlude:\s*/i, '');
      const choiceTextList = scene1.choices && scene1.choices.length > 0
        ? `\n\n👇 **Choose your response to deepen your Bond:**\n` +
          scene1.choices.map((c, idx) => `**${idx + 1}.** “*${c.text}*”`).join('\n')
        : '';

      const vnEmbed = new EmbedBuilder()
        .setTitle(`📖 Bond Interlude: ${cleanTitle}`)
        .setDescription(
          `*${event.subtitle}* ${statusNote ? `\n\n*${statusNote}*` : ''}` +
          choiceTextList
        )
        .setImage('attachment://visual_novel.png')
        .setColor(0xec4899)
        .setFooter({
          text: isReplay
            ? 'Replay Mode: Rewards already claimed for this Interlude.'
            : `Reward: +${event.rewardBondExp} Bond EXP & 💎 ${event.rewardSaintQuartz || 3} SQ`
        });

      const sKey = getServantCompactKey(targetServant, master);
      const choicesRow = new ActionRowBuilder<ButtonBuilder>();
      if (scene1.choices && scene1.choices.length > 0) {
        scene1.choices.forEach((c, idx) => {
          choicesRow.addComponents(
            new ButtonBuilder()
              .setCustomId(safeCustomId(`vn_choice:${sKey}:${event.id}:0:${c.id}`))
              .setLabel(`${idx + 1}. ${c.text.length > 75 ? c.text.slice(0, 72) + '...' : c.text}`)
              .setStyle(ButtonStyle.Primary)
          );
        });
      } else {
        choicesRow.addComponents(
          new ButtonBuilder()
            .setCustomId(safeCustomId(`vn_next:${sKey}:${event.id}:1`))
            .setLabel(event.scenes.length > 1 ? 'Next Scene ➔' : '🏁 Complete Interlude')
            .setStyle(ButtonStyle.Success)
        );
      }

      return interaction.editReply({
        embeds: [vnEmbed],
        files: [attachment],
        components: [choicesRow]
      });
    }

    const embed = buildBondStatusEmbed(master, targetServant.id);
    const rows = buildBondActionRow(master, targetServant.id);

    await interaction.editReply({
      embeds: [embed],
      components: rows
    });

  } catch (error: any) {
    console.error('Error executing /bond command:', error);
    await interaction.editReply({ content: `❌ Error opening Bond Sanctum: ${error.message}` });
  }
}

// ==========================================
// 4. SELECT MENU INTERACTION HANDLER
// ==========================================
export async function handleBondSelectInteraction(interaction: StringSelectMenuInteraction) {
  try {
    await interaction.deferUpdate();
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const selectedServantId = interaction.values[0];

    const targetServant = resolveTargetServant(master, null, selectedServantId);
    if (!targetServant) {
      return interaction.followUp({ flags: MessageFlags.Ephemeral, content: '❌ Servant not found in your contracted roster.' });
    }

    const embed = buildBondStatusEmbed(master, targetServant.id);
    const rows = buildBondActionRow(master, targetServant.id);

    await interaction.editReply({
      embeds: [embed],
      files: [],
      components: rows
    });
  } catch (error: any) {
    console.error('Error handling bond select menu:', error);
  }
}

// ==========================================
// 5. BUTTON INTERACTION HANDLER
// ==========================================
export async function handleBondButtonInteraction(interaction: ButtonInteraction) {
  try {
    const btnId = interaction.customId;
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);

    if (btnId === 'vn_ways_to_bond') {
      await interaction.deferUpdate();
      const guideEmbed = buildBondGuideEmbed();
      const rows = buildBondActionRow(master);
      return interaction.editReply({ embeds: [guideEmbed], files: [], components: rows });
    }

    if (btnId === 'vn_view_roster') {
      await interaction.deferUpdate();
      const rosterEmbed = buildBondRosterEmbed(master);
      const rows = buildBondRosterActionRows(master);
      return interaction.editReply({ embeds: [rosterEmbed], files: [], components: rows });
    }

    if (btnId.startsWith('vn_set_active:')) {
      await interaction.deferUpdate();
      const servantId = btnId.split(':')[1];
      const chosen = resolveTargetServant(master, null, servantId);
      if (!chosen) {
        return interaction.followUp({ flags: MessageFlags.Ephemeral, content: '❌ Selected Servant is not contracted.' });
      }

      master.activeServantId = chosen.id;
      await saveMaster(master);
      getOrInitWarSession(master);

      const sTemp = chosen.template || chosen;
      const sName = chosen.nickname || sTemp.name || 'Heroic Spirit';

      const embed = buildBondStatusEmbed(master, chosen.id);
      const rows = buildBondActionRow(master, chosen.id);

      await interaction.editReply({
        embeds: [embed],
        files: [],
        components: rows
      });

      return interaction.followUp({
        flags: MessageFlags.Ephemeral,
        content: `⭐ Set **${sName}** (${sTemp.servantClass}) as your active Holy Grail War partner!`
      });
    }

    // Determine target servant from button ID if present
    let targetServantId: string | undefined = undefined;
    if (btnId.startsWith('vn_gift_menu:')) targetServantId = btnId.split(':')[1];
    else if (btnId.startsWith('vn_give_gift:')) targetServantId = btnId.split(':')[1];
    else if (btnId.startsWith('vn_spar:')) targetServantId = btnId.split(':')[1];
    else if (btnId.startsWith('vn_play_event:')) targetServantId = btnId.split(':')[1];
    else if (btnId.startsWith('vn_view_quotes:')) targetServantId = btnId.split(':')[1];
    else if (btnId.startsWith('vn_back_status:')) targetServantId = btnId.split(':')[1];
    else if (btnId.startsWith('vn_choice_complete:')) targetServantId = btnId.split(':')[1];
    else if (btnId.startsWith('btn_talk_servant:')) targetServantId = btnId.split(':')[1];
    else if (btnId.startsWith('vn_set_active:')) targetServantId = btnId.split(':')[1];
    else if (btnId.startsWith('ce_art_bond:')) targetServantId = btnId.split(':')[1];
    else if (btnId.startsWith('vn_choice:')) {
      const parts = btnId.split(':');
      // Format: vn_choice:servantId:eventId:sceneIdx:choiceId OR legacy vn_choice:eventId:sceneIdx:choiceId
      if (parts.length >= 5) {
        targetServantId = parts[1];
      }
    } else if (btnId.startsWith('vn_next:')) {
      const parts = btnId.split(':');
      // Format: vn_next:servantId:eventId:nextSceneIdx OR legacy vn_next:eventId:nextSceneIdx
      if (parts.length >= 4) {
        targetServantId = parts[1];
      }
    }

    const targetServant = resolveTargetServant(master, null, targetServantId);

    if (!targetServant) {
      return interaction.reply({ flags: MessageFlags.Ephemeral, content: '❌ You do not have an active Servant contracted.' });
    }

    const sTemplate = targetServant.template || targetServant;
    const servantName = targetServant.nickname || sTemplate.name || 'Heroic Spirit';
    const sKey = getServantCompactKey(targetServant, master);

    if (btnId.startsWith('ce_art_bond')) {
      const bCe = getBondCraftEssenceForServant(targetServant.templateId || sTemplate.id || targetServant.id, servantName);
      const artEmbed = new EmbedBuilder()
        .setTitle(`🎖️ Max Bond 10 Relic: ${bCe.name}`)
        .setDescription(
          `★4 **${bCe.name}** • **[BOND 10 RELIC]**\n` +
          `**Bond Partner:** **${bCe.bondServantName}**\n` +
          `**Stats:** \`+${bCe.atkBonus || 100} ATK\` / \`+${bCe.hpBonus || 100} HP\`\n\n` +
          `**Exclusive Bond Passive:**\n${bCe.effectText}\n\n` +
          `*${bCe.description}*`
        )
        .setColor(0xd4af37)
        .setFooter({ text: 'Awarded upon reaching Bond Level 10' });

      if (bCe.artworkUrl) {
        artEmbed.setImage(bCe.artworkUrl);
      }

      return interaction.reply({ embeds: [artEmbed], flags: MessageFlags.Ephemeral });
    }

    if (btnId.startsWith('vn_gift_menu')) {
      await interaction.deferUpdate();
      const giftEmbed = buildBondGiftsEmbed(master, targetServant.id);
      const rows = buildBondGiftsActionRows(master, targetServant.id);
      return interaction.editReply({ embeds: [giftEmbed], files: [], components: rows });
    }

    if (btnId.startsWith('vn_give_gift:')) {
      await interaction.deferUpdate();
      const parts = btnId.split(':');
      // format: vn_give_gift:servantId:giftId OR legacy vn_give_gift:giftId
      const giftId = parts.length >= 3 ? parts[2] : parts[1];
      const gift = BOND_GIFTS[giftId] || BOND_GIFTS.chaldea_tea;

      if (gift.sqCost > 0 && (master.saintQuartz || 0) < gift.sqCost) {
        return interaction.followUp({
          flags: MessageFlags.Ephemeral,
          content: `❌ You need at least **${gift.sqCost} Saint Quartz** (💎) to offer **${gift.name}**! Claim your \`/daily\` or participate in the Grail War.`
        });
      }

      if (gift.sqCost > 0) {
        master.saintQuartz = (master.saintQuartz || 0) - gift.sqCost;
      }

      const reaction = getServantGiftReaction(targetServant, giftId);
      const bondRes = addBondExpToServant(targetServant, gift.bondExp);
      const updatedServant = bondRes.updatedServant;
      const bond10Grant = checkAndGrantBond10Ce(master, updatedServant);

      const sIdx = master.servants.findIndex((s: any) => s.id === targetServant.id);
      if (sIdx !== -1) {
        master.servants[sIdx] = updatedServant;
      }
      await saveMaster(master);

      const imageBuffer = await renderVisualNovelCard({
        servantName,
        servantClass: sTemplate.servantClass || 'Saber',
        servantAvatarUrl: sTemplate.avatarUrl,
        servantCardArtUrl: sTemplate.cardArtUrl || targetServant?.cardArtUrl,
        servantSpriteUrl: sTemplate.spriteUrl || targetServant?.spriteUrl,
        speakerName: servantName,
        dialogueText: reaction.responseText,
        title: `Gift Presented: ${gift.name}`,
        subtitle: gift.description,
        reactionEmotion: reaction.emotion,
        expGained: gift.bondExp,
        currentBondLevel: updatedServant.bondLevel || 1,
        isComplete: true
      });

      const attachment = new AttachmentBuilder(imageBuffer, { name: 'gift_reaction.png' });
      const bondLvlMsg = bondRes.didLevelUp ? `\n🎉 **[BOND LEVEL UP!]** Reached **Bond Lv. ${bondRes.newLevel}**!` : '';
      const bond10Msg = bond10Grant
        ? `\n\n🎖️ **[MAX BOND 10 REACHED!]** Bestowed Bond Craft Essence: ★4 **${bond10Grant.ce.name}**!\n*Effect:* ${bond10Grant.ce.effectText}\n*(Type \`/ce art ${bond10Grant.ce.name}\` to view high-res card art!)*`
        : '';

      const giftResultEmbed = new EmbedBuilder()
        .setTitle(`🎁 Gift Received: ${gift.emoji} ${gift.name}`)
        .setDescription(
          `**${servantName}:**\n> ❝ ***${reaction.responseText}*** ❞\n\n` +
          `💖 **Gift Rewards:**\n` +
          `• **Bond EXP:** \`+${gift.bondExp} Bond EXP\`\n` +
          (gift.sqCost > 0 ? `• **Saint Quartz Spent:** \`-${gift.sqCost} SQ\` (Remaining: 💎 ${master.saintQuartz || 0} SQ)\n` : '') +
          `• **Current Bond:** Level \`${updatedServant.bondLevel} / 10\`${bondLvlMsg}${bond10Msg}`
        )
        .setImage('attachment://gift_reaction.png')
        .setColor(0x22c55e);

      const giftNavRowComponents = [
        new ButtonBuilder()
          .setCustomId(safeCustomId(`vn_gift_menu:${sKey}`))
          .setLabel('Give Another Gift 🎁')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(safeCustomId(`vn_back_status:${sKey}`))
          .setLabel('📊 Bond Sanctum')
          .setStyle(ButtonStyle.Secondary)
      ];

      if (updatedServant.bondLevel >= 10) {
        giftNavRowComponents.push(
          new ButtonBuilder()
            .setCustomId(safeCustomId(`ce_art_bond:${sKey}`))
            .setLabel('View Bond CE Art 🎖️')
            .setStyle(ButtonStyle.Success)
        );
      }

      giftNavRowComponents.push(
        new ButtonBuilder()
          .setCustomId('vn_view_roster')
          .setLabel('Bond Roster 👥')
          .setStyle(ButtonStyle.Secondary)
      );

      const giftNavRow = new ActionRowBuilder<ButtonBuilder>().addComponents(giftNavRowComponents);

      return interaction.editReply({
        embeds: [giftResultEmbed],
        files: [attachment],
        components: [giftNavRow]
      });
    }

    if (btnId.startsWith('vn_spar')) {
      await interaction.deferUpdate();

      const sparStatus = checkSparLimit(master);
      if (!sparStatus.allowed) {
        if (sparStatus.isCooldown) {
          return interaction.followUp({ flags: MessageFlags.Ephemeral, content: sparStatus.reason || '⏳ Please wait before sparring again!' });
        }

        const limitEmbed = new EmbedBuilder()
          .setTitle(`⚔️ Daily Sparring Limit Reached (${MAX_DAILY_SPARS}/${MAX_DAILY_SPARS} Drills)`)
          .setDescription(
            `**${servantName}** lowers their weapon to rest:\n` +
            `> ❝ *We have pushed our limits in today's combat simulations, Master. Pushing further without proper rest risks overtaxing our spiritual core. Let us resume tactical drills after tomorrow's mana refresh!* ❞\n\n` +
            `📊 **Daily Sparring Limit:** \`${MAX_DAILY_SPARS} / ${MAX_DAILY_SPARS} Drills Completed Today\`\n` +
            `🔄 **Daily Reset:** 00:00 UTC\n\n` +
            `💡 **Other Ways to Deepen Your Bond Today:**\n` +
            `• 💬 **Telepathic Dialogue (\`/talk\`)** — Converse with your Servant (+35 to +50 EXP)\n` +
            `• 🎁 **Present Gifts (\`/bond view:gift\`)** — Enjoy Free Afternoon Tea (+150 EXP) or Feasts\n` +
            `• ⚔️ **Holy Grail Duels (\`/duel\`)** — Battle in official Grail War duels (+150 EXP win / +60 EXP defense)\n` +
            `• 📖 **Visual Novel Interludes (\`/bond view:interlude\`)** — Experience story quests`
          )
          .setColor(0xf59e0b)
          .setFooter({ text: `Daily Sparring Limit: ${MAX_DAILY_SPARS} Sessions per Day (Resets 00:00 UTC)` });

        const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(safeCustomId(`vn_gift_menu:${sKey}`))
            .setLabel('Present Gifts 🎁')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(safeCustomId(`vn_back_status:${sKey}`))
            .setLabel('📊 Bond Sanctum')
            .setStyle(ButtonStyle.Secondary)
        );

        return interaction.editReply({ embeds: [limitEmbed], files: [], components: [backRow] });
      }

      const todayKey = new Date().toISOString().slice(0, 10);
      const usedToday = master.lastSparDay === todayKey ? (master.dailySparCount || 0) : 0;
      master.dailySparCount = usedToday + 1;
      master.lastSparDay = todayKey;
      master.lastSparTimestamp = Date.now();

      const debrief = getServantSparringDebrief(targetServant);
      const bondGain = 120;
      const bondRes = addBondExpToServant(targetServant, bondGain);
      const updatedServant = bondRes.updatedServant;
      const bond10Grant = checkAndGrantBond10Ce(master, updatedServant);

      const sIdx = master.servants.findIndex((s: any) => s.id === targetServant.id);
      if (sIdx !== -1) {
        master.servants[sIdx] = updatedServant;
      }
      await saveMaster(master);

      const imageBuffer = await renderVisualNovelCard({
        servantName,
        servantClass: sTemplate.servantClass || 'Saber',
        servantAvatarUrl: sTemplate.avatarUrl,
        servantCardArtUrl: sTemplate.cardArtUrl || targetServant?.cardArtUrl,
        servantSpriteUrl: sTemplate.spriteUrl || targetServant?.spriteUrl,
        speakerName: servantName,
        dialogueText: debrief.responseText,
        title: 'Master-Servant Tactical Sparring',
        subtitle: 'Bond Chamber Combat Simulation',
        reactionEmotion: debrief.emotion,
        expGained: bondGain,
        currentBondLevel: updatedServant.bondLevel || 1,
        isComplete: true
      });

      const attachment = new AttachmentBuilder(imageBuffer, { name: 'sparring_drill.png' });
      const bondLvlMsg = bondRes.didLevelUp ? `\n🎉 **[BOND LEVEL UP!]** Reached **Bond Lv. ${bondRes.newLevel}**!` : '';
      const bond10Msg = bond10Grant
        ? `\n\n🎖️ **[MAX BOND 10 REACHED!]** Bestowed Bond Craft Essence: ★4 **${bond10Grant.ce.name}**!\n*Effect:* ${bond10Grant.ce.effectText}\n*(Type \`/ce art ${bond10Grant.ce.name}\` to view high-res card art!)*`
        : '';
      const remainingSpars = MAX_DAILY_SPARS - master.dailySparCount;

      const sparEmbed = new EmbedBuilder()
        .setTitle(`⚔️ Tactical Sparring Complete: ${servantName}`)
        .setDescription(
          `**${servantName}:**\n> ❝ ***${debrief.responseText}*** ❞\n\n` +
          `💖 **Sparring Rewards:**\n` +
          `• **Bond EXP:** \`+${bondGain} Bond EXP\`\n` +
          `• **Current Bond:** Level \`${updatedServant.bondLevel} / 10\`${bondLvlMsg}${bond10Msg}\n` +
          `• **Daily Spar Drills:** \`${master.dailySparCount} / ${MAX_DAILY_SPARS} Completed Today\` (${remainingSpars > 0 ? `${remainingSpars} drill(s) left` : 'Daily limit reached'})`
        )
        .setImage('attachment://sparring_drill.png')
        .setColor(0x38bdf8);

      const sparRowComponents = [
        new ButtonBuilder()
          .setCustomId(safeCustomId(`vn_spar:${sKey}`))
          .setLabel(remainingSpars > 0 ? `Spar Again ⚔️ (${remainingSpars} left)` : 'Spar Limit Reached ⚔️')
          .setStyle(remainingSpars > 0 ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setDisabled(remainingSpars <= 0),
        new ButtonBuilder()
          .setCustomId(safeCustomId(`vn_back_status:${sKey}`))
          .setLabel('📊 Bond Sanctum')
          .setStyle(ButtonStyle.Secondary)
      ];

      if (updatedServant.bondLevel >= 10) {
        sparRowComponents.push(
          new ButtonBuilder()
            .setCustomId(safeCustomId(`ce_art_bond:${sKey}`))
            .setLabel('View Bond CE Art 🎖️')
            .setStyle(ButtonStyle.Success)
        );
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(sparRowComponents);

      return interaction.editReply({
        embeds: [sparEmbed],
        files: [attachment],
        components: [row]
      });
    }

    if (btnId.startsWith('vn_play_event') || btnId.startsWith('vn_start_specific')) {
      await interaction.deferUpdate();

      const events = getBondEventsForServant(targetServant);
      let event: BondEvent;
      let isReplay = false;
      let statusNote = '';

      if (btnId.startsWith('vn_start_specific:')) {
        const parts = btnId.split(':');
        // Format: vn_start_specific:sKey:eventId
        const specificEventId = parts[2];
        const found = events.find(e => e.id === specificEventId);
        if (found) {
          event = found;
          isReplay = (targetServant.completedBondEvents || []).includes(found.id);
          statusNote = isReplay ? 'Replay Mode' : `Chapter ${found.requiredBondLevel}`;
        } else {
          const res = selectActiveInterludeForServant(targetServant);
          event = res.event;
          isReplay = res.isReplay;
          statusNote = res.statusNote;
        }
      } else {
        const res = selectActiveInterludeForServant(targetServant);
        event = res.event;
        isReplay = res.isReplay;
        statusNote = res.statusNote;
      }

      const scene1 = event.scenes[0];

      // Generate VN Canvas Image
      const imageBuffer = await renderVisualNovelCard({
        servantName,
        servantClass: sTemplate.servantClass || 'Saber',
        servantAvatarUrl: sTemplate.avatarUrl,
        servantCardArtUrl: sTemplate.cardArtUrl || targetServant?.cardArtUrl,
        servantSpriteUrl: sTemplate.spriteUrl || targetServant?.spriteUrl,
        speakerName: scene1.speakerName || servantName,
        dialogueText: scene1.dialogueText,
        title: event.title,
        subtitle: `${event.subtitle} • Scene 1/${event.scenes.length}`,
        currentBondLevel: targetServant.bondLevel || 1
      });

      const attachment = new AttachmentBuilder(imageBuffer, { name: 'visual_novel.png' });
      const cleanTitle = event.title.replace(/^Bond Interlude:\s*/i, '');
      const choiceTextList = scene1.choices && scene1.choices.length > 0
        ? `\n\n👇 **Choose your response to deepen your Bond:**\n` +
          scene1.choices.map((c, idx) => `**${idx + 1}.** “*${c.text}*”`).join('\n')
        : '';

      const vnEmbed = new EmbedBuilder()
        .setTitle(`📖 Bond Interlude: ${cleanTitle}`)
        .setDescription(
          `*${event.subtitle}* ${statusNote ? `\n\n*${statusNote}*` : ''}` +
          choiceTextList
        )
        .setImage('attachment://visual_novel.png')
        .setColor(0xec4899)
        .setFooter({
          text: isReplay
            ? 'Replay Mode: Rewards already claimed for this Interlude.'
            : `Reward: +${event.rewardBondExp} Bond EXP & 💎 ${event.rewardSaintQuartz || 3} SQ`
        });

      const choicesRow = new ActionRowBuilder<ButtonBuilder>();
      if (scene1.choices && scene1.choices.length > 0) {
        scene1.choices.forEach((c, idx) => {
          choicesRow.addComponents(
            new ButtonBuilder()
              .setCustomId(safeCustomId(`vn_choice:${sKey}:${event.id}:0:${c.id}`))
              .setLabel(`${idx + 1}. ${c.text.length > 75 ? c.text.slice(0, 72) + '...' : c.text}`)
              .setStyle(ButtonStyle.Primary)
          );
        });
      } else {
        choicesRow.addComponents(
          new ButtonBuilder()
            .setCustomId(safeCustomId(`vn_next:${sKey}:${event.id}:1`))
            .setLabel(event.scenes.length > 1 ? 'Next Scene ➔' : '🏁 Complete Interlude')
            .setStyle(ButtonStyle.Success)
        );
      }

      await interaction.editReply({
        embeds: [vnEmbed],
        files: [attachment],
        components: [choicesRow]
      });
      return;
    }

    if (btnId.startsWith('vn_view_quotes')) {
      await interaction.deferUpdate();

      const unlockedQuotes = getUnlockedDialogueLinesForServant(targetServant);
      const quotesList = unlockedQuotes.map(q => 
        `• **${q.title}** (Bond ${q.requiredBondLevel}):\n  *"${q.quoteText}"*`
      ).join('\n\n');

      const quotesEmbed = new EmbedBuilder()
        .setTitle(`🎙️ My Room Voice Quotes | ${servantName}`)
        .setDescription(
          `*Here are the unlocked quotes based on your current Bond Level (${targetServant.bondLevel || 1}/10):*\n\n` +
          (quotesList || 'No quotes unlocked yet.')
        )
        .setColor(0xa855f7)
        .setFooter({ text: 'Increase Bond Level to unlock more My Room dialogue lines!' });

      if (sTemplate.avatarUrl) {
        safeSetEmbedThumbnail(quotesEmbed, sTemplate.avatarUrl);
      }

      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(safeCustomId(`vn_play_event:${sKey}`))
          .setLabel('📖 Play Interlude')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(safeCustomId(`vn_back_status:${sKey}`))
          .setLabel('📊 Bond Status')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({
        embeds: [quotesEmbed],
        files: [],
        components: [backRow]
      });
      return;
    }

    if (btnId.startsWith('vn_back_status')) {
      await interaction.deferUpdate();
      const embed = buildBondStatusEmbed(master, targetServant.id);
      const rows = buildBondActionRow(master, targetServant.id);

      await interaction.editReply({
        embeds: [embed],
        files: [],
        components: rows
      });
      return;
    }

    if (btnId.startsWith('vn_choice_complete:') || btnId.startsWith('vn_choice_complete')) {
      await interaction.deferUpdate();
      const events = getBondEventsForServant(targetServant);
      const { event } = selectActiveInterludeForServant(targetServant);
      
      const lastScene = event.scenes[event.scenes.length - 1] || event.scenes[0];
      const completedIds: string[] = targetServant.completedBondEvents || [];
      const isFirstCompletion = !completedIds.includes(event.id);

      const expGain = isFirstCompletion ? (event.rewardBondExp || 500) : 0;
      const sqReward = isFirstCompletion ? (event.rewardSaintQuartz || 3) : 0;

      let updatedServant = { ...targetServant };

      if (isFirstCompletion) {
        if (!updatedServant.completedBondEvents) updatedServant.completedBondEvents = [];
        updatedServant.completedBondEvents.push(event.id);

        let bond10Grant: any = undefined;
        if (expGain > 0) {
          const res = addBondExpToServant(updatedServant, expGain);
          updatedServant = res.updatedServant;
          bond10Grant = checkAndGrantBond10Ce(master, updatedServant);
        }

        if (sqReward > 0) {
          master.saintQuartz = (master.saintQuartz || 0) + sqReward;
        }

        master.servants = master.servants.map((s: any) => s.id === updatedServant.id ? updatedServant : s);
        await saveMaster(master);
      }

      const allServantEvents = getBondEventsForServant(updatedServant);
      const currentBondLv = updatedServant.bondLevel || 1;
      const nextEvent = allServantEvents.find(e => e.requiredBondLevel <= currentBondLv && !(updatedServant.completedBondEvents || []).includes(e.id) && e.id !== event.id);

      const imageBuffer = await renderVisualNovelCard({
        servantName,
        servantClass: sTemplate.servantClass || 'Saber',
        servantAvatarUrl: sTemplate.avatarUrl,
        servantCardArtUrl: sTemplate.cardArtUrl || targetServant?.cardArtUrl,
        servantSpriteUrl: sTemplate.spriteUrl || targetServant?.spriteUrl,
        speakerName: lastScene.speakerName || servantName,
        dialogueText: lastScene.dialogueText,
        title: `${event.title} (Complete)`,
        subtitle: event.subtitle,
        expGained: expGain,
        sqGained: sqReward,
        currentBondLevel: updatedServant.bondLevel || 1,
        isComplete: true
      });

      const attachment = new AttachmentBuilder(imageBuffer, { name: 'visual_novel_complete.png' });

      const bond10RewardText = (updatedServant.bondLevel >= 10)
        ? `\n\n🎖️ **[MAX BOND 10 REACHED!]** Bestowed Bond Craft Essence: ★4 **${getBondCraftEssenceForServant(updatedServant.templateId || sTemplate.id || updatedServant.id, servantName).name}**!\n*(Type \`/ce art\` or click the button below to view high-res card art!)*`
        : '';

      const rewardsText = isFirstCompletion
        ? `🎉 **REWARDS EARNED:**\n` +
          `• **Bond EXP:** +${expGain} EXP ✨\n` +
          `• **Saint Quartz:** +💎 ${sqReward} SQ\n` +
          `• **Current Bond:** Level \`${updatedServant.bondLevel} / 10\`${bond10RewardText}`
        : `ℹ️ **REPLAY MODE:**\n` +
          `• *Rewards already claimed for this Interlude.*\n` +
          `• **Current Bond:** Level \`${updatedServant.bondLevel} / 10\`${bond10RewardText}`;

      const nextChapterNotice = nextEvent
        ? `\n\n✨ **New Story Chapter Unlocked!** *${nextEvent.title}* (Bond Lv. ${nextEvent.requiredBondLevel}) is ready to play!`
        : '';

      const resultEmbed = new EmbedBuilder()
        .setTitle(`🌸 Interlude Complete: ${event.title}`)
        .setDescription(
          `**${servantName}**:\n` +
          `*"${lastScene.dialogueText}"*\n\n` +
          rewardsText +
          nextChapterNotice
        )
        .setImage('attachment://visual_novel_complete.png')
        .setColor(isFirstCompletion ? 0xec4899 : 0x64748b);

      const completionButtons: ButtonBuilder[] = [];
      if (nextEvent) {
        completionButtons.push(
          new ButtonBuilder()
            .setCustomId(safeCustomId(`vn_start_specific:${sKey}:${nextEvent.id}`))
            .setLabel(`📖 Play Chapter ${nextEvent.requiredBondLevel}: ${nextEvent.title.length > 25 ? nextEvent.title.slice(0, 22) + '...' : nextEvent.title} ➔`)
            .setStyle(ButtonStyle.Success)
        );
      }
      if (updatedServant.bondLevel >= 10) {
        completionButtons.push(
          new ButtonBuilder()
            .setCustomId(safeCustomId(`ce_art_bond:${sKey}`))
            .setLabel('View Bond CE Art 🎖️')
            .setStyle(ButtonStyle.Success)
        );
      }
      completionButtons.push(
        new ButtonBuilder()
          .setCustomId(safeCustomId(`vn_play_event:${sKey}`))
          .setLabel('📖 Chapter List / Replay')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(safeCustomId(`vn_gift_menu:${sKey}`))
          .setLabel('Present Gifts 🎁')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(safeCustomId(`vn_back_status:${sKey}`))
          .setLabel('📊 Bond Sanctum')
          .setStyle(ButtonStyle.Secondary)
      );

      const completionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(completionButtons.slice(0, 5));

      await interaction.editReply({
        embeds: [resultEmbed],
        files: [attachment],
        components: [completionRow]
      });
      return;
    }

    if (btnId.startsWith('vn_choice:') || btnId.startsWith('vn_choice_')) {
      await interaction.deferUpdate();

      const events = getBondEventsForServant(targetServant);
      
      let eventId = '';
      let choiceId = '';
      let sceneIdx = 0;

      if (btnId.includes(':')) {
        const parts = btnId.split(':');
        // Check if 5 parts: vn_choice:servantId:eventId:sceneIdx:choiceId
        if (parts.length >= 5) {
          eventId = parts[2];
          sceneIdx = parseInt(parts[3], 10) || 0;
          choiceId = parts[4];
        } else if (parts.length >= 4) {
          eventId = parts[1];
          sceneIdx = parseInt(parts[2], 10) || 0;
          choiceId = parts[3];
        } else {
          eventId = parts[1];
          choiceId = parts[2];
        }
      } else {
        choiceId = btnId.replace(/vn_choice_[^_]+_/, '');
      }

      const event = events.find(e => e.id === eventId) || events[0];
      const scene = event.scenes[sceneIdx] || event.scenes[0];

      // Accurately find picked choice
      const pickedChoice = scene.choices?.find(c => c.id === choiceId);
      const servantResponse = pickedChoice ? pickedChoice.response : scene.dialogueText;

      const targetNextIndex = pickedChoice?.nextSceneId
        ? event.scenes.findIndex(s => s.id === pickedChoice.nextSceneId)
        : sceneIdx + 1;
      const effectiveNextIndex = targetNextIndex !== -1 ? targetNextIndex : sceneIdx + 1;
      const hasNextScene = effectiveNextIndex < event.scenes.length;

      if (hasNextScene) {
        const imageBuffer = await renderVisualNovelCard({
          servantName,
          servantClass: sTemplate.servantClass || 'Saber',
          servantAvatarUrl: sTemplate.avatarUrl,
          servantCardArtUrl: sTemplate.cardArtUrl || targetServant?.cardArtUrl,
          servantSpriteUrl: sTemplate.spriteUrl || targetServant?.spriteUrl,
          speakerName: scene.speakerName || servantName,
          dialogueText: servantResponse,
          title: event.title,
          subtitle: `${event.subtitle} • Scene ${sceneIdx + 1}/${event.scenes.length}`,
          choiceMadeText: pickedChoice?.text,
          reactionEmotion: pickedChoice?.reactionEmotion,
          currentBondLevel: targetServant.bondLevel || 1
        });

        const attachment = new AttachmentBuilder(imageBuffer, { name: 'visual_novel_step.png' });

        const stepEmbed = new EmbedBuilder()
          .setTitle(`📖 ${event.title} — Scene ${sceneIdx + 1}/${event.scenes.length}`)
          .setDescription(
            `💬 **[BOND INTERLUDE] ${scene.speakerName || servantName}:**\n> ❝ ***${servantResponse}*** ❞\n\n` +
            (pickedChoice ? `✨ **Master Choice Selected:** “${pickedChoice.text}”\n\n` : '') +
            `👉 *Click **Next Scene ➔** below to continue the story!*`
          )
          .setImage('attachment://visual_novel_step.png')
          .setColor(0xf59e0b);

        const nextRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(safeCustomId(`vn_next:${sKey}:${event.id}:${effectiveNextIndex}`))
            .setLabel('Next Scene ➔')
            .setStyle(ButtonStyle.Success)
        );

        await interaction.editReply({
          embeds: [stepEmbed],
          files: [attachment],
          components: [nextRow]
        });
        return;
      }

      // Final scene completion from choice
      const completedIds: string[] = targetServant.completedBondEvents || [];
      const isFirstCompletion = !completedIds.includes(event.id);

      const baseExpGain = pickedChoice ? pickedChoice.bondExpGain : (event.rewardBondExp || 500);
      const baseSqReward = event.rewardSaintQuartz || 3;

      const expGain = isFirstCompletion ? baseExpGain : 0;
      const sqReward = isFirstCompletion ? baseSqReward : 0;

      let updatedServant = { ...targetServant };

      if (isFirstCompletion) {
        if (!updatedServant.completedBondEvents) updatedServant.completedBondEvents = [];
        updatedServant.completedBondEvents.push(event.id);

        let bond10Grant: any = undefined;
        if (expGain > 0) {
          const res = addBondExpToServant(updatedServant, expGain);
          updatedServant = res.updatedServant;
          bond10Grant = checkAndGrantBond10Ce(master, updatedServant);
        }

        if (sqReward > 0) {
          master.saintQuartz = (master.saintQuartz || 0) + sqReward;
        }

        master.servants = master.servants.map((s: any) => s.id === updatedServant.id ? updatedServant : s);
        await saveMaster(master);
      }

      const allServantEvents = getBondEventsForServant(updatedServant);
      const currentBondLv = updatedServant.bondLevel || 1;
      const nextEvent = allServantEvents.find(e => e.requiredBondLevel <= currentBondLv && !(updatedServant.completedBondEvents || []).includes(e.id) && e.id !== event.id);

      const reactionEmoji = pickedChoice?.reactionEmotion === 'happy' ? '💖' : pickedChoice?.reactionEmotion === 'flustered' ? '😳' : pickedChoice?.reactionEmotion === 'amused' ? '😄' : '✨';

      const imageBuffer = await renderVisualNovelCard({
        servantName,
        servantClass: sTemplate.servantClass || 'Saber',
        servantAvatarUrl: sTemplate.avatarUrl,
        servantCardArtUrl: sTemplate.cardArtUrl || targetServant?.cardArtUrl,
        servantSpriteUrl: sTemplate.spriteUrl || targetServant?.spriteUrl,
        speakerName: scene.speakerName || servantName,
        dialogueText: servantResponse,
        title: `${event.title} (Complete)`,
        subtitle: event.subtitle,
        choiceMadeText: pickedChoice?.text,
        reactionEmotion: pickedChoice?.reactionEmotion,
        expGained: expGain,
        sqGained: sqReward,
        currentBondLevel: updatedServant.bondLevel || 1,
        isComplete: true
      });

      const attachment = new AttachmentBuilder(imageBuffer, { name: 'visual_novel_reaction.png' });

      const bond10RewardText = (updatedServant.bondLevel >= 10)
        ? `\n\n🎖️ **[MAX BOND 10 REACHED!]** Bestowed Bond Craft Essence: ★4 **${getBondCraftEssenceForServant(updatedServant.templateId || sTemplate.id || updatedServant.id, servantName).name}**!\n*(Type \`/ce art\` or click the button below to view high-res card art!)*`
        : '';

      const rewardsText = isFirstCompletion
        ? `🎉 **REWARDS EARNED:**\n` +
          `• **Bond EXP:** +${expGain} EXP ${reactionEmoji}\n` +
          `• **Saint Quartz:** +💎 ${sqReward} SQ\n` +
          `• **Current Bond:** Level \`${updatedServant.bondLevel} / 10\`${bond10RewardText}`
        : `ℹ️ **REPLAY MODE:**\n` +
          `• *Rewards already claimed for this Interlude.*\n` +
          `• **Current Bond:** Level \`${updatedServant.bondLevel} / 10\`${bond10RewardText}`;

      const nextChapterNotice = nextEvent
        ? `\n\n✨ **New Story Chapter Unlocked!** *${nextEvent.title}* (Bond Lv. ${nextEvent.requiredBondLevel}) is ready to play!`
        : '';

      const resultEmbed = new EmbedBuilder()
        .setTitle(`🌸 Interlude Complete: ${event.title}`)
        .setDescription(
          `**${servantName}**:\n` +
          `*"${servantResponse}"*\n\n` +
          rewardsText +
          nextChapterNotice
        )
        .setImage('attachment://visual_novel_reaction.png')
        .setColor(isFirstCompletion ? 0xec4899 : 0x64748b);

      const completionButtons: ButtonBuilder[] = [];
      if (nextEvent) {
        completionButtons.push(
          new ButtonBuilder()
            .setCustomId(safeCustomId(`vn_start_specific:${sKey}:${nextEvent.id}`))
            .setLabel(`📖 Play Chapter ${nextEvent.requiredBondLevel}: ${nextEvent.title.length > 25 ? nextEvent.title.slice(0, 22) + '...' : nextEvent.title} ➔`)
            .setStyle(ButtonStyle.Success)
        );
      }
      if (updatedServant.bondLevel >= 10) {
        completionButtons.push(
          new ButtonBuilder()
            .setCustomId(safeCustomId(`ce_art_bond:${sKey}`))
            .setLabel('View Bond CE Art 🎖️')
            .setStyle(ButtonStyle.Success)
        );
      }
      completionButtons.push(
        new ButtonBuilder()
          .setCustomId(safeCustomId(`vn_play_event:${sKey}`))
          .setLabel('📖 Chapter List / Replay')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(safeCustomId(`vn_gift_menu:${sKey}`))
          .setLabel('Present Gifts 🎁')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(safeCustomId(`vn_back_status:${sKey}`))
          .setLabel('📊 Bond Sanctum')
          .setStyle(ButtonStyle.Secondary)
      );

      const completionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(completionButtons.slice(0, 5));

      await interaction.editReply({
        embeds: [resultEmbed],
        files: [attachment],
        components: [completionRow]
      });
      return;
    }

    if (btnId.startsWith('vn_next:') || btnId.startsWith('vn_next_')) {
      await interaction.deferUpdate();

      let eventId = '';
      let nextSceneIdx = 0;

      if (btnId.includes(':')) {
        const parts = btnId.split(':');
        // Format: vn_next:servantId:eventId:nextSceneIdx OR legacy vn_next:eventId:nextSceneIdx
        if (parts.length >= 4) {
          eventId = parts[2];
          nextSceneIdx = parseInt(parts[3], 10) || 0;
        } else {
          eventId = parts[1];
          nextSceneIdx = parseInt(parts[2], 10) || 0;
        }
      } else {
        const parts = btnId.split('_');
        nextSceneIdx = parseInt(parts.pop() || '0', 10);
        eventId = parts.slice(2).join('_');
      }

      const events = getBondEventsForServant(targetServant);
      const event = events.find(e => e.id === eventId) || events[0];

      // If nextSceneIdx is past the end, complete the interlude!
      if (nextSceneIdx >= event.scenes.length) {
        const lastScene = event.scenes[event.scenes.length - 1] || event.scenes[0];
        const lastDialogue = lastScene.dialogueText || "The vanguard holds strong, Master.";

        const completedIds: string[] = targetServant.completedBondEvents || [];
        const isFirstCompletion = !completedIds.includes(event.id);

        const expGain = isFirstCompletion ? (event.rewardBondExp || 500) : 0;
        const sqReward = isFirstCompletion ? (event.rewardSaintQuartz || 3) : 0;

        let updatedServant = { ...targetServant };

        if (isFirstCompletion) {
          if (!updatedServant.completedBondEvents) updatedServant.completedBondEvents = [];
          updatedServant.completedBondEvents.push(event.id);

          let bond10Grant: any = undefined;
          if (expGain > 0) {
            const res = addBondExpToServant(updatedServant, expGain);
            updatedServant = res.updatedServant;
            bond10Grant = checkAndGrantBond10Ce(master, updatedServant);
          }

          if (sqReward > 0) {
            master.saintQuartz = (master.saintQuartz || 0) + sqReward;
          }

          master.servants = master.servants.map((s: any) => s.id === updatedServant.id ? updatedServant : s);
          await saveMaster(master);
        }

        const allServantEvents = getBondEventsForServant(updatedServant);
        const currentBondLv = updatedServant.bondLevel || 1;
        const nextEvent = allServantEvents.find(e => e.requiredBondLevel <= currentBondLv && !(updatedServant.completedBondEvents || []).includes(e.id) && e.id !== event.id);

        const imageBuffer = await renderVisualNovelCard({
          servantName,
          servantClass: sTemplate.servantClass || 'Saber',
          servantAvatarUrl: sTemplate.avatarUrl,
          servantCardArtUrl: sTemplate.cardArtUrl || targetServant?.cardArtUrl,
          servantSpriteUrl: sTemplate.spriteUrl || targetServant?.spriteUrl,
          speakerName: lastScene.speakerName || servantName,
          dialogueText: lastDialogue,
          title: `${event.title} (Complete)`,
          subtitle: event.subtitle,
          expGained: expGain,
          sqGained: sqReward,
          currentBondLevel: updatedServant.bondLevel || 1,
          isComplete: true
        });

        const attachment = new AttachmentBuilder(imageBuffer, { name: 'visual_novel_complete.png' });

        const bond10RewardText = (updatedServant.bondLevel >= 10)
          ? `\n\n🎖️ **[MAX BOND 10 REACHED!]** Bestowed Bond Craft Essence: ★4 **${getBondCraftEssenceForServant(updatedServant.templateId || sTemplate.id || updatedServant.id, servantName).name}**!\n*(Type \`/ce art\` or click the button below to view high-res card art!)*`
          : '';

        const rewardsText = isFirstCompletion
          ? `🎉 **REWARDS EARNED:**\n` +
            `• **Bond EXP:** +${expGain} EXP ✨\n` +
            `• **Saint Quartz:** +💎 ${sqReward} SQ\n` +
            `• **Current Bond:** Level \`${updatedServant.bondLevel} / 10\`${bond10RewardText}`
          : `ℹ️ **REPLAY MODE:**\n` +
            `• *Rewards already claimed for this Interlude.*\n` +
            `• **Current Bond:** Level \`${updatedServant.bondLevel} / 10\`${bond10RewardText}`;

        const nextChapterNotice = nextEvent
          ? `\n\n✨ **New Story Chapter Unlocked!** *${nextEvent.title}* (Bond Lv. ${nextEvent.requiredBondLevel}) is ready to play!`
          : '';

        const resultEmbed = new EmbedBuilder()
          .setTitle(`🌸 Interlude Complete: ${event.title}`)
          .setDescription(
            `**${servantName}**:\n` +
            `*"${lastDialogue}"*\n\n` +
            rewardsText +
            nextChapterNotice
          )
          .setImage('attachment://visual_novel_complete.png')
          .setColor(isFirstCompletion ? 0xec4899 : 0x64748b);

        const completionButtons: ButtonBuilder[] = [];
        if (nextEvent) {
          completionButtons.push(
            new ButtonBuilder()
              .setCustomId(safeCustomId(`vn_start_specific:${sKey}:${nextEvent.id}`))
              .setLabel(`📖 Play Chapter ${nextEvent.requiredBondLevel}: ${nextEvent.title.length > 25 ? nextEvent.title.slice(0, 22) + '...' : nextEvent.title} ➔`)
              .setStyle(ButtonStyle.Success)
          );
        }
        if (updatedServant.bondLevel >= 10) {
          completionButtons.push(
            new ButtonBuilder()
              .setCustomId(safeCustomId(`ce_art_bond:${sKey}`))
              .setLabel('View Bond CE Art 🎖️')
              .setStyle(ButtonStyle.Success)
          );
        }
        completionButtons.push(
          new ButtonBuilder()
            .setCustomId(safeCustomId(`vn_play_event:${sKey}`))
            .setLabel('📖 Chapter List / Replay')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(safeCustomId(`vn_gift_menu:${sKey}`))
            .setLabel('Present Gifts 🎁')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(safeCustomId(`vn_back_status:${sKey}`))
            .setLabel('📊 Bond Sanctum')
            .setStyle(ButtonStyle.Secondary)
        );

        const completionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(completionButtons.slice(0, 5));

        await interaction.editReply({
          embeds: [resultEmbed],
          files: [attachment],
          components: [completionRow]
        });
        return;
      }

      const scene = event.scenes[nextSceneIdx];
      const isLastScene = nextSceneIdx === event.scenes.length - 1;

      const imageBuffer = await renderVisualNovelCard({
        servantName,
        servantClass: sTemplate.servantClass || 'Saber',
        servantAvatarUrl: sTemplate.avatarUrl,
        servantCardArtUrl: sTemplate.cardArtUrl || targetServant?.cardArtUrl,
        servantSpriteUrl: sTemplate.spriteUrl || targetServant?.spriteUrl,
        speakerName: scene.speakerName || servantName,
        dialogueText: scene.dialogueText,
        title: event.title,
        subtitle: `${event.subtitle} • Scene ${nextSceneIdx + 1}/${event.scenes.length}`,
        currentBondLevel: targetServant.bondLevel || 1
      });

      const attachment = new AttachmentBuilder(imageBuffer, { name: 'visual_novel.png' });

      const choiceTextList = scene.choices && scene.choices.length > 0
        ? `\n\n👇 **Choose your response to deepen your Bond:**\n` +
          scene.choices.map((c, idx) => `**${idx + 1}.** “*${c.text}*”`).join('\n')
        : '';

      const choicesRow = new ActionRowBuilder<ButtonBuilder>();
      if (scene.choices && scene.choices.length > 0) {
        scene.choices.forEach((c, idx) => {
          choicesRow.addComponents(
            new ButtonBuilder()
              .setCustomId(safeCustomId(`vn_choice:${sKey}:${event.id}:${nextSceneIdx}:${c.id}`))
              .setLabel(`${idx + 1}. ${c.text.length > 75 ? c.text.slice(0, 72) + '...' : c.text}`)
              .setStyle(ButtonStyle.Primary)
          );
        });
      } else {
        choicesRow.addComponents(
          new ButtonBuilder()
            .setCustomId(safeCustomId(`vn_next:${sKey}:${event.id}:${nextSceneIdx + 1}`))
            .setLabel(isLastScene ? '🏁 Finish Interlude' : 'Next Scene ➔')
            .setStyle(ButtonStyle.Success)
        );
      }

      const vnEmbed = new EmbedBuilder()
        .setTitle(`📖 Bond Interlude: ${event.title}`)
        .setDescription(
          `💬 **[BOND INTERLUDE] ${scene.speakerName || servantName}:**\n> ❝ ***${scene.dialogueText}*** ❞\n\n` +
          `*Scene ${nextSceneIdx + 1}/${event.scenes.length} • Servant Bond Lv. ${targetServant.bondLevel || 1}*` +
          choiceTextList
        )
        .setImage('attachment://visual_novel.png')
        .setColor(0xec4899);

      await interaction.editReply({
        embeds: [vnEmbed],
        files: [attachment],
        components: [choicesRow]
      });
      return;
    }

  } catch (error: any) {
    console.error('Error in handleBondButtonInteraction:', error);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: `❌ Error: ${error.message}` });
    } else {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: `❌ Error: ${error.message}` });
    }
  }
}
