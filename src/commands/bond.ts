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
  BOND_EXP_TABLE
} from '../../lib/engine/bondEvents';
import { safeSetEmbedThumbnail } from '../utils/discordEmbedHelper';
import { renderVisualNovelCard } from '../canvas/renderer';

// ==========================================
// 1. SLASH COMMAND DEFINITION
// ==========================================
export const data = new SlashCommandBuilder()
  .setName('bond')
  .setDescription('🌸 Access the Servant Bond System, Visual Novel Interludes & Voice Quotes')
  .addStringOption(opt =>
    opt
      .setName('view')
      .setDescription('Choose what section of the Bond Sanctum to open')
      .setRequired(false)
      .addChoices(
        { name: '📊 Bond Status & Progress (View EXP & unlocked perks)', value: 'status' },
        { name: '📖 Play Bond Interlude (Visual Novel Event)', value: 'interlude' },
        { name: '🎙️ Voice Quotes & My Room Lines', value: 'quotes' }
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
      `*Spend quality time with your Heroic Spirit through Visual Novel Interludes to deepen your pact, unlock My Room voice lines, and empower combat performance!*\n\n` +
      `💖 **BOND LEVEL:** Level \`${bondLvl} / 10\`\n` +
      `[${progressBar}] \`${progress.expInCurrentLevel} / ${progress.neededForNextLevel} EXP\` (**${progress.progressPercent}%**)\n\n` +
      `✨ **BOND MILESTONES & PERKS:**\n` +
      `• **Bond Level 1:** Unlocks initial Summoning Quote & basic battle lines.\n` +
      `• **Bond Level 3:** Unlocks Chivalric Trust Interlude & dialogue.\n` +
      `• **Bond Level 5:** ${bondLvl >= 5 ? '✅ **UNLOCKED!** +10% Command Card Effectiveness & 2nd Class Passive.' : '🔒 Unlocks 2nd Class Passive & +10% Command Card Effectiveness.'}\n` +
      `• **Bond Level 10:** ${bondLvl >= 10 ? '✅ **UNLOCKED!** Exclusive Max Bond Craft Essence!' : '🔒 Unlocks Master\'s Heroic Essence & Max Bond Craft Essence.'}\n\n` +
      `📖 **AVAILABLE BOND INTERLUDES:** ${events.length} Event(s) (${completedEvents.length} Completed)\n` +
      `🎙️ **UNLOCKED VOICE LINES:** ${unlockedQuotes.length} Quote(s)`
    )
    .setColor(0xec4899)
    .setFooter({ text: 'Fate Bond Engine • Visual Novel Interludes' });

  if (sTemplate.avatarUrl) {
    safeSetEmbedThumbnail(embed, sTemplate.avatarUrl);
  }

  return embed;
}

export function buildBondActionRow(master: any) {
  const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];
  if (!activeServant) return [];

  const { event, isReplay } = selectActiveInterludeForServant(activeServant);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('vn_play_event')
      .setLabel(event ? `📖 Play Interlude: ${event.title.slice(0, 28)}${isReplay ? ' (Replay)' : ''}` : '📖 Play Generic Interlude')
      .setStyle(isReplay ? ButtonStyle.Secondary : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('vn_view_quotes')
      .setLabel('🎙️ View Voice Lines')
      .setStyle(ButtonStyle.Secondary)
  );

  return [row];
}

// ==========================================
// 3. MAIN EXECUTE HANDLER
// ==========================================
export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const viewOption = interaction.options.getString('view') || 'status';

    if (viewOption === 'interlude') {
      const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];
      if (!activeServant) {
        return interaction.editReply({ content: '❌ You do not have an active Servant contracted.' });
      }

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
      const vnEmbed = new EmbedBuilder()
        .setTitle(`📖 Bond Interlude: ${cleanTitle}`)
        .setDescription(
          `*${event.subtitle}* ${statusNote ? `\n\n*${statusNote}*` : ''}\n\n` +
          `👇 **Make your dialogue choice below to deepen your Bond:**`
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
              .setLabel(`${idx + 1}. ${c.text.slice(0, 70)}`)
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

    if (!activeServant) {
      return interaction.reply({ flags: MessageFlags.Ephemeral, content: '❌ You do not have an active Servant contracted.' });
    }

    const sTemplate = activeServant.template || activeServant;
    const servantName = activeServant.nickname || sTemplate.name || 'Heroic Spirit';

    if (btnId === 'vn_play_event') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
      const vnEmbed = new EmbedBuilder()
        .setTitle(`📖 Bond Interlude: ${cleanTitle}`)
        .setDescription(
          `*${event.subtitle}* ${statusNote ? `\n\n*${statusNote}*` : ''}\n\n` +
          `👇 **Choose your response to deepen your Bond:**`
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
              .setLabel(`${idx + 1}. ${c.text.slice(0, 70)}`)
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

      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [quotesEmbed]
      });
      return;
    }

    if (btnId.startsWith('vn_choice:') || btnId.startsWith('vn_choice_')) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const events = getBondEventsForServant(activeServant);
      
      // Parse colon or underscore format safely
      let eventId = '';
      let choiceId = '';
      if (btnId.includes(':')) {
        const parts = btnId.split(':');
        eventId = parts[1];
        choiceId = parts[2];
      } else {
        // Fallback parsing for legacy buttons
        choiceId = btnId.replace(/vn_choice_[^_]+_/, '');
      }

      const event = events.find(e => e.id === eventId) || events[0];
      const scene1 = event.scenes[0];

      // Accurately find picked choice
      const pickedChoice = scene1.choices?.find(c => c.id === choiceId);
      const servantResponse = pickedChoice ? pickedChoice.response : scene1.dialogueText;

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
        speakerName: scene1.speakerName || servantName,
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

      await interaction.editReply({
        embeds: [resultEmbed],
        files: [attachment]
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
