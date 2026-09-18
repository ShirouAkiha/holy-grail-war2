import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  MessageFlags,
  AttachmentBuilder
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
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
  getServantSparringDebrief
} from '../../lib/engine/bondEvents';
import { safeSetEmbedThumbnail } from '../utils/discordEmbedHelper';
import { renderVisualNovelCard } from '../canvas/renderer';

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
        { name: '📖 Play Bond Interlude (Visual Novel Event)', value: 'interlude' },
        { name: '🎁 Present Gifts & Afternoon Tea (Boost Bond EXP)', value: 'gift' },
        { name: '⚔️ Master-Servant Sparring & Drills (+120 Bond EXP)', value: 'spar' },
        { name: '🎙️ Voice Quotes & My Room Lines', value: 'quotes' },
        { name: '❓ Ways to Gain Bond Guide', value: 'guide' }
      )
  );

function renderProgressBar(percent: number): string {
  const total = 10;
  const filled = Math.max(0, Math.min(total, Math.round((percent / 100) * total)));
  return '🌸'.repeat(filled) + '░'.repeat(total - filled);
}

// ==========================================
// 2. EMBED BUILDERS
// ==========================================
export function buildBondStatusEmbed(master: any) {
  const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];

  if (!activeServant) {
    return new EmbedBuilder()
      .setTitle('🌸 Servant Bond Sanctum | No Contracted Servant')
      .setDescription('❌ You have no active Servant contracted. Use `/summon` first to establish a pact!')
      .setColor(0xef4444);
  }

  const sTemplate = activeServant.template || activeServant;
  const servantName = activeServant.nickname || sTemplate.name || 'Heroic Spirit';
  const servantClass = sTemplate.servantClass || 'Saber';
  const bondLvl = activeServant.bondLevel || 1;
  const bondExp = activeServant.bondExp || 0;

  const progress = getBondExpProgress(bondExp);
  const progressBar = renderProgressBar(progress.progressPercent);
  const events = getBondEventsForServant(activeServant);
  const unlockedQuotes = getUnlockedDialogueLinesForServant(activeServant);
  const completedEvents = activeServant.completedBondEvents || [];

  const embed = new EmbedBuilder()
    .setTitle(`🌸 Bond Sanctum | ${servantName} (${servantClass})`)
    .setDescription(
      `*Deepen your covenant with ${servantName} through Interludes, Gifts, Conversations, and Battle to unlock voice lines and combat bonuses!*\n\n` +
      `💖 **BOND LEVEL:** Level \`${bondLvl} / 10\`\n` +
      `[${progressBar}] \`${progress.expInCurrentLevel} / ${progress.neededForNextLevel} EXP\` (**${progress.progressPercent}%**)\n\n` +
      `✨ **BOND MILESTONES & PERKS:**\n` +
      `• **Bond Level 1:** Unlocks initial Summoning Quote & basic battle lines.\n` +
      `• **Bond Level 3:** Unlocks Chivalric Trust Interlude & special dialogue.\n` +
      `• **Bond Level 5:** ${bondLvl >= 5 ? '✅ **UNLOCKED!** +10% Command Card Effectiveness & 2nd Class Passive.' : '🔒 Unlocks 2nd Class Passive & +10% Command Card Effectiveness.'}\n` +
      `• **Bond Level 10:** ${bondLvl >= 10 ? '✅ **UNLOCKED!** Exclusive Max Bond Craft Essence & Master Resonance!' : '🔒 Unlocks Master\'s Heroic Essence & Max Bond Craft Essence.'}\n\n` +
      `📖 **BOND INTERLUDES:** ${events.length} Event(s) (${completedEvents.length} Completed)\n` +
      `🎙️ **UNLOCKED VOICE LINES:** ${unlockedQuotes.length} Quote(s)\n` +
      `💎 **SAINT QUARTZ:** \`${master.saintQuartz || 0} SQ\``
    )
    .setColor(0xec4899)
    .setFooter({ text: 'Fate Bond Engine • Visual Novel Interludes & Sanctuary' });

  if (sTemplate.avatarUrl) {
    safeSetEmbedThumbnail(embed, sTemplate.avatarUrl);
  }

  return embed;
}

export function buildBondActionRow(master: any): ActionRowBuilder<ButtonBuilder>[] {
  const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];
  if (!activeServant) return [];

  const { event, isReplay } = selectActiveInterludeForServant(activeServant);

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn_talk_servant:${activeServant.id}`)
      .setLabel('Talk to Servant 💬')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('vn_play_event')
      .setLabel(event ? `📖 Play Interlude: ${event.title.slice(0, 30)}${isReplay ? ' (Replay)' : ''}` : '📖 Play Interlude')
      .setStyle(isReplay ? ButtonStyle.Secondary : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('vn_gift_menu')
      .setLabel('Present Gifts 🎁')
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('vn_spar')
      .setLabel('Spar & Train ⚔️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('vn_view_quotes')
      .setLabel('Voice Quotes 🎙️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('vn_ways_to_bond')
      .setLabel('Bond Guide ❓')
      .setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2];
}

export function buildBondGiftsEmbed(master: any) {
  const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];
  const sTemplate = activeServant.template || activeServant;
  const servantName = activeServant.nickname || sTemplate.name || 'Heroic Spirit';
  const currentSq = master.saintQuartz || 0;
  const bondLvl = activeServant.bondLevel || 1;

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

  if (sTemplate.avatarUrl) {
    safeSetEmbedThumbnail(embed, sTemplate.avatarUrl);
  }

  return embed;
}

export function buildBondGiftsActionRows(master: any): ActionRowBuilder<ButtonBuilder>[] {
  const currentSq = master.saintQuartz || 0;

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('vn_give_gift:chaldea_tea')
      .setLabel('☕ Afternoon Tea (Free)')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('vn_give_gift:heroic_feast')
      .setLabel('🍱 Heroic Feast (5 SQ)')
      .setStyle(currentSq >= 5 ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('vn_give_gift:golden_apple')
      .setLabel('🍏 Golden Apple (10 SQ)')
      .setStyle(currentSq >= 10 ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('vn_give_gift:sacred_relic')
      .setLabel('💠 Sacred Relic (15 SQ)')
      .setStyle(currentSq >= 15 ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('vn_back_status')
      .setLabel('📊 Back to Bond Sanctum')
      .setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2];
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
      `• Fighting bravely together (defeat/survival) still awards **+60 Bond EXP**.\n\n` +
      `📖 **3. Visual Novel Interludes (\`/bond view:interlude\`)**\n` +
      `• Experience story quests and dialogues to earn **+150 to +300 Bond EXP** and **Saint Quartz**.\n\n` +
      `🎁 **4. Present Gifts & Tea Time (\`/bond view:gift\`)**\n` +
      `• Offer Afternoon Tea (**FREE**, +150 EXP), Feasts (+250 EXP), Golden Apples (+350 EXP), or Sacred Relics (+500 EXP).\n\n` +
      `⚔️ **5. Master-Servant Sparring (\`/bond view:spar\`)**\n` +
      `• Run tactical combat simulations together in the Sanctum for **+120 Bond EXP**.\n\n` +
      `✨ **6. Craft Essence Synthesis (\`/feed\`)**\n` +
      `• Enhancing your Servant with Craft Essences grants **+25 Bond EXP per CE fed**.\n\n` +
      `💎 **7. Daily Leyline Harvest (\`/daily\`)**\n` +
      `• Checking in daily awards **+100 Bond EXP** directly to your active partner Servant.\n\n` +
      `👁️ **8. City Reconnaissance Patrol (\`/patrol\`)**\n` +
      `• Scouting Fuyuki sectors together earns **+60 Bond EXP** per patrol.`
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

    const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];
    if (!activeServant && viewOption !== 'guide') {
      return interaction.editReply({ content: '❌ You do not have an active Servant contracted. Use `/summon` first!' });
    }

    if (viewOption === 'guide') {
      const guideEmbed = buildBondGuideEmbed();
      const rows = buildBondActionRow(master);
      return interaction.editReply({ embeds: [guideEmbed], components: rows });
    }

    if (viewOption === 'gift') {
      const giftEmbed = buildBondGiftsEmbed(master);
      const rows = buildBondGiftsActionRows(master);
      return interaction.editReply({ embeds: [giftEmbed], components: rows });
    }

    if (viewOption === 'spar') {
      const sTemplate = activeServant.template || activeServant;
      const servantName = activeServant.nickname || sTemplate.name || 'Heroic Spirit';
      const debrief = getServantSparringDebrief(activeServant);

      const bondGain = 120;
      const bondRes = addBondExpToServant(activeServant, bondGain);
      const updatedServant = bondRes.updatedServant;

      const sIdx = master.servants.findIndex((s: any) => s.id === activeServant.id);
      if (sIdx !== -1) {
        master.servants[sIdx] = updatedServant;
      }
      await saveMaster(master);

      const imageBuffer = await renderVisualNovelCard({
        servantName,
        servantClass: sTemplate.servantClass || 'Saber',
        servantAvatarUrl: sTemplate.avatarUrl,
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

      const sparEmbed = new EmbedBuilder()
        .setTitle(`⚔️ Tactical Sparring Complete: ${servantName}`)
        .setDescription(
          `**${servantName}:**\n> ❝ ***${debrief.responseText}*** ❞\n\n` +
          `💖 **Sparring Rewards:**\n` +
          `• **Bond EXP:** \`+${bondGain} Bond EXP\`\n` +
          `• **Current Bond:** Level \`${updatedServant.bondLevel} / 10\`${bondLvlMsg}`
        )
        .setImage('attachment://sparring_drill.png')
        .setColor(0x38bdf8);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('vn_spar')
          .setLabel('Spar Again ⚔️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('vn_back_status')
          .setLabel('📊 Bond Sanctum')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({
        embeds: [sparEmbed],
        files: [attachment],
        components: [row]
      });
    }

    if (viewOption === 'quotes') {
      const sTemplate = activeServant.template || activeServant;
      const servantName = activeServant.nickname || sTemplate.name || 'Heroic Spirit';
      const unlockedQuotes = getUnlockedDialogueLinesForServant(activeServant);
      const quotesList = unlockedQuotes.map(q => 
        `• **${q.title}** (Bond ${q.requiredBondLevel}):\n  *"${q.quoteText}"*`
      ).join('\n\n');

      const quotesEmbed = new EmbedBuilder()
        .setTitle(`🎙️ My Room Voice Quotes | ${servantName}`)
        .setDescription(
          `*Here are the unlocked quotes based on your current Bond Level (${activeServant.bondLevel || 1}/10):*\n\n` +
          (quotesList || 'No quotes unlocked yet.')
        )
        .setColor(0xa855f7)
        .setFooter({ text: 'Increase Bond Level to unlock more My Room dialogue lines!' });

      if (sTemplate.avatarUrl) {
        safeSetEmbedThumbnail(quotesEmbed, sTemplate.avatarUrl);
      }

      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('vn_play_event')
          .setLabel('📖 Play Interlude')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('vn_back_status')
          .setLabel('📊 Bond Status')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({
        embeds: [quotesEmbed],
        components: [backRow]
      });
    }

    if (viewOption === 'interlude') {
      const { event, isReplay, statusNote } = selectActiveInterludeForServant(activeServant);
      const scene1 = event.scenes[0];
      const sTemplate = activeServant.template || activeServant;
      const servantName = activeServant.nickname || sTemplate.name || 'Heroic Spirit';

      // Generate VN Canvas Image
      const imageBuffer = await renderVisualNovelCard({
        servantName,
        servantClass: sTemplate.servantClass || 'Saber',
        servantAvatarUrl: sTemplate.avatarUrl,
        speakerName: scene1.speakerName || servantName,
        dialogueText: scene1.dialogueText,
        title: event.title,
        subtitle: event.subtitle,
        currentBondLevel: activeServant.bondLevel || 1
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
              .setCustomId(`vn_choice:${event.id}:${c.id}`)
              .setLabel(`${idx + 1}. ${c.text.length > 75 ? c.text.slice(0, 72) + '...' : c.text}`)
              .setStyle(ButtonStyle.Primary)
          );
        });
      } else {
        choicesRow.addComponents(
          new ButtonBuilder()
            .setCustomId('vn_choice_complete')
            .setLabel('✨ Complete Interlude')
            .setStyle(ButtonStyle.Success)
        );
      }

      return interaction.editReply({
        embeds: [vnEmbed],
        files: [attachment],
        components: [choicesRow]
      });
    }

    const embed = buildBondStatusEmbed(master);
    const rows = buildBondActionRow(master);

    await interaction.editReply({
      embeds: [embed],
      components: rows
    });

  } catch (error: any) {
    console.error('Error executing /bond command:', error);
    await interaction.editReply({ content: `❌ Error opening Bond Sanctum: ${error.message}` });
  }
}

export async function handleBondButtonInteraction(interaction: ButtonInteraction) {
  try {
    const btnId = interaction.customId;
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];

    if (btnId === 'vn_ways_to_bond') {
      await interaction.deferUpdate();
      const guideEmbed = buildBondGuideEmbed();
      const rows = buildBondActionRow(master);
      return interaction.editReply({ embeds: [guideEmbed], files: [], components: rows });
    }

    if (!activeServant) {
      return interaction.reply({ flags: MessageFlags.Ephemeral, content: '❌ You do not have an active Servant contracted.' });
    }

    const sTemplate = activeServant.template || activeServant;
    const servantName = activeServant.nickname || sTemplate.name || 'Heroic Spirit';

    if (btnId === 'vn_gift_menu') {
      await interaction.deferUpdate();
      const giftEmbed = buildBondGiftsEmbed(master);
      const rows = buildBondGiftsActionRows(master);
      return interaction.editReply({ embeds: [giftEmbed], files: [], components: rows });
    }

    if (btnId.startsWith('vn_give_gift:')) {
      await interaction.deferUpdate();
      const giftId = btnId.split(':')[1];
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

      const reaction = getServantGiftReaction(activeServant, giftId);
      const bondRes = addBondExpToServant(activeServant, gift.bondExp);
      const updatedServant = bondRes.updatedServant;

      const sIdx = master.servants.findIndex((s: any) => s.id === activeServant.id);
      if (sIdx !== -1) {
        master.servants[sIdx] = updatedServant;
      }
      await saveMaster(master);

      const imageBuffer = await renderVisualNovelCard({
        servantName,
        servantClass: sTemplate.servantClass || 'Saber',
        servantAvatarUrl: sTemplate.avatarUrl,
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

      const giftResultEmbed = new EmbedBuilder()
        .setTitle(`🎁 Gift Received: ${gift.emoji} ${gift.name}`)
        .setDescription(
          `**${servantName}:**\n> ❝ ***${reaction.responseText}*** ❞\n\n` +
          `💖 **Gift Rewards:**\n` +
          `• **Bond EXP:** \`+${gift.bondExp} Bond EXP\`\n` +
          (gift.sqCost > 0 ? `• **Saint Quartz Spent:** \`-${gift.sqCost} SQ\` (Remaining: 💎 ${master.saintQuartz || 0} SQ)\n` : '') +
          `• **Current Bond:** Level \`${updatedServant.bondLevel} / 10\`${bondLvlMsg}`
        )
        .setImage('attachment://gift_reaction.png')
        .setColor(0x22c55e);

      const giftNavRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('vn_gift_menu')
          .setLabel('Give Another Gift 🎁')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('vn_back_status')
          .setLabel('📊 Bond Sanctum')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({
        embeds: [giftResultEmbed],
        files: [attachment],
        components: [giftNavRow]
      });
    }

    if (btnId === 'vn_spar') {
      await interaction.deferUpdate();
      const debrief = getServantSparringDebrief(activeServant);

      const bondGain = 120;
      const bondRes = addBondExpToServant(activeServant, bondGain);
      const updatedServant = bondRes.updatedServant;

      const sIdx = master.servants.findIndex((s: any) => s.id === activeServant.id);
      if (sIdx !== -1) {
        master.servants[sIdx] = updatedServant;
      }
      await saveMaster(master);

      const imageBuffer = await renderVisualNovelCard({
        servantName,
        servantClass: sTemplate.servantClass || 'Saber',
        servantAvatarUrl: sTemplate.avatarUrl,
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

      const sparEmbed = new EmbedBuilder()
        .setTitle(`⚔️ Tactical Sparring Complete: ${servantName}`)
        .setDescription(
          `**${servantName}:**\n> ❝ ***${debrief.responseText}*** ❞\n\n` +
          `💖 **Sparring Rewards:**\n` +
          `• **Bond EXP:** \`+${bondGain} Bond EXP\`\n` +
          `• **Current Bond:** Level \`${updatedServant.bondLevel} / 10\`${bondLvlMsg}`
        )
        .setImage('attachment://sparring_drill.png')
        .setColor(0x38bdf8);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('vn_spar')
          .setLabel('Spar Again ⚔️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('vn_back_status')
          .setLabel('📊 Bond Sanctum')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({
        embeds: [sparEmbed],
        files: [attachment],
        components: [row]
      });
    }

    if (btnId === 'vn_play_event') {
      await interaction.deferUpdate();

      const { event, isReplay, statusNote } = selectActiveInterludeForServant(activeServant);
      const scene1 = event.scenes[0];

      // Generate VN Canvas Image
      const imageBuffer = await renderVisualNovelCard({
        servantName,
        servantClass: sTemplate.servantClass || 'Saber',
        servantAvatarUrl: sTemplate.avatarUrl,
        speakerName: scene1.speakerName || servantName,
        dialogueText: scene1.dialogueText,
        title: event.title,
        subtitle: event.subtitle,
        currentBondLevel: activeServant.bondLevel || 1
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
              .setCustomId(`vn_choice:${event.id}:0:${c.id}`)
              .setLabel(`${idx + 1}. ${c.text.length > 75 ? c.text.slice(0, 72) + '...' : c.text}`)
              .setStyle(ButtonStyle.Primary)
          );
        });
      } else {
        choicesRow.addComponents(
          new ButtonBuilder()
            .setCustomId('vn_choice_complete')
            .setLabel('✨ Complete Interlude')
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

    if (btnId === 'vn_view_quotes') {
      await interaction.deferUpdate();

      const unlockedQuotes = getUnlockedDialogueLinesForServant(activeServant);
      const quotesList = unlockedQuotes.map(q => 
        `• **${q.title}** (Bond ${q.requiredBondLevel}):\n  *"${q.quoteText}"*`
      ).join('\n\n');

      const quotesEmbed = new EmbedBuilder()
        .setTitle(`🎙️ My Room Voice Quotes | ${servantName}`)
        .setDescription(
          `*Here are the unlocked quotes based on your current Bond Level (${activeServant.bondLevel || 1}/10):*\n\n` +
          (quotesList || 'No quotes unlocked yet.')
        )
        .setColor(0xa855f7)
        .setFooter({ text: 'Increase Bond Level to unlock more My Room dialogue lines!' });

      if (sTemplate.avatarUrl) {
        safeSetEmbedThumbnail(quotesEmbed, sTemplate.avatarUrl);
      }

      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('vn_play_event')
          .setLabel('📖 Play Interlude')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('vn_back_status')
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

    if (btnId === 'vn_back_status') {
      await interaction.deferUpdate();
      const embed = buildBondStatusEmbed(master);
      const rows = buildBondActionRow(master);

      await interaction.editReply({
        embeds: [embed],
        files: [],
        components: rows
      });
      return;
    }

    if (btnId.startsWith('vn_choice:') || btnId.startsWith('vn_choice_')) {
      await interaction.deferUpdate();

      const events = getBondEventsForServant(activeServant);
      
      // Parse colon or underscore format safely
      let eventId = '';
      let choiceId = '';
      let sceneIdx = 0;
      if (btnId.includes(':')) {
        const parts = btnId.split(':');
        eventId = parts[1];
        if (parts.length >= 4) {
          sceneIdx = parseInt(parts[2], 10) || 0;
          choiceId = parts[3];
        } else {
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

      const hasNextScene = sceneIdx < event.scenes.length - 1;

      if (hasNextScene) {
        // Show Servant's response card + Next Scene button
        const imageBuffer = await renderVisualNovelCard({
          servantName,
          servantClass: sTemplate.servantClass || 'Saber',
          servantAvatarUrl: sTemplate.avatarUrl,
          speakerName: scene.speakerName || servantName,
          dialogueText: servantResponse,
          title: event.title,
          subtitle: `${event.subtitle} • Scene ${sceneIdx + 1}/${event.scenes.length}`,
          choiceMadeText: pickedChoice?.text,
          reactionEmotion: pickedChoice?.reactionEmotion,
          currentBondLevel: activeServant.bondLevel || 1
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
            .setCustomId(`vn_next:${event.id}:${sceneIdx + 1}`)
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

      // Check if event was ALREADY completed to prevent duplicate rewards glitch!
      const completedIds: string[] = activeServant.completedBondEvents || [];
      const isFirstCompletion = !completedIds.includes(event.id);

      const baseExpGain = pickedChoice ? pickedChoice.bondExpGain : 150;
      const baseSqReward = event.rewardSaintQuartz || 3;

      const expGain = isFirstCompletion ? baseExpGain : 0;
      const sqReward = isFirstCompletion ? baseSqReward : 0;

      let updatedServant = { ...activeServant };

      if (isFirstCompletion) {
        // Track completed event
        if (!updatedServant.completedBondEvents) updatedServant.completedBondEvents = [];
        updatedServant.completedBondEvents.push(event.id);

        // Add bond exp to servant
        if (expGain > 0) {
          const res = addBondExpToServant(updatedServant, expGain);
          updatedServant = res.updatedServant;
        }

        // Award SQ
        if (sqReward > 0) {
          master.saintQuartz = (master.saintQuartz || 0) + sqReward;
        }

        master.servants = master.servants.map((s: any) => s.id === updatedServant.id ? updatedServant : s);
        await saveMaster(master);
      }

      const reactionEmoji = pickedChoice?.reactionEmotion === 'happy' ? '💖' : pickedChoice?.reactionEmotion === 'flustered' ? '😳' : pickedChoice?.reactionEmotion === 'amused' ? '😄' : '✨';

      // Render Visual Novel Reaction Card Canvas Image
      const imageBuffer = await renderVisualNovelCard({
        servantName,
        servantClass: sTemplate.servantClass || 'Saber',
        servantAvatarUrl: sTemplate.avatarUrl,
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

      const rewardsText = isFirstCompletion
        ? `🎉 **REWARDS EARNED:**\n` +
          `• **Bond EXP:** +${expGain} EXP ${reactionEmoji}\n` +
          `• **Saint Quartz:** +💎 ${sqReward} SQ\n` +
          `• **Current Bond:** Level \`${updatedServant.bondLevel} / 10\``
        : `ℹ️ **REPLAY MODE:**\n` +
          `• *Rewards already claimed for this Interlude.*\n` +
          `• **Current Bond:** Level \`${updatedServant.bondLevel} / 10\``;

      const resultEmbed = new EmbedBuilder()
        .setTitle(`🌸 Interlude Complete: ${event.title}`)
        .setDescription(
          `**${servantName}**:\n` +
          `*"${servantResponse}"*\n\n` +
          rewardsText
        )
        .setImage('attachment://visual_novel_reaction.png')
        .setColor(isFirstCompletion ? 0xec4899 : 0x64748b);

      const completionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('vn_play_event')
          .setLabel('📖 Play Interlude Again')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('vn_gift_menu')
          .setLabel('Present Gifts 🎁')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('vn_back_status')
          .setLabel('📊 Bond Sanctum Status')
          .setStyle(ButtonStyle.Secondary)
      );

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
        eventId = parts[1];
        nextSceneIdx = parseInt(parts[2], 10) || 0;
      } else {
        const parts = btnId.split('_');
        nextSceneIdx = parseInt(parts.pop() || '0', 10);
        eventId = parts.slice(2).join('_');
      }

      const events = getBondEventsForServant(activeServant);
      const event = events.find(e => e.id === eventId) || events[0];
      const scene = event.scenes[nextSceneIdx] || event.scenes[0];

      const imageBuffer = await renderVisualNovelCard({
        servantName,
        servantClass: sTemplate.servantClass || 'Saber',
        servantAvatarUrl: sTemplate.avatarUrl,
        speakerName: scene.speakerName || servantName,
        dialogueText: scene.dialogueText,
        title: event.title,
        subtitle: `${event.subtitle} • Scene ${nextSceneIdx + 1}/${event.scenes.length}`,
        currentBondLevel: activeServant.bondLevel || 1
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
              .setCustomId(`vn_choice:${event.id}:${nextSceneIdx}:${c.id}`)
              .setLabel(`${idx + 1}. ${c.text.length > 75 ? c.text.slice(0, 72) + '...' : c.text}`)
              .setStyle(ButtonStyle.Primary)
          );
        });
      } else {
        choicesRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`vn_next:${event.id}:${nextSceneIdx + 1}`)
            .setLabel('Next Scene ➔')
            .setStyle(ButtonStyle.Success)
        );
      }

      const vnEmbed = new EmbedBuilder()
        .setTitle(`📖 Bond Interlude: ${event.title}`)
        .setDescription(
          `💬 **[BOND INTERLUDE] ${scene.speakerName || servantName}:**\n> ❝ ***${scene.dialogueText}*** ❞\n\n` +
          `*Scene ${nextSceneIdx + 1}/${event.scenes.length} • Servant Bond Lv. ${activeServant.bondLevel || 1}*` +
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
