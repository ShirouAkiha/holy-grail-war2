import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  MessageFlags
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { 
  getBondExpProgress, 
  getBondLevelFromExp, 
  getBondEventsForServant, 
  getUnlockedDialogueLinesForServant,
  addBondExpToServant,
  BOND_EXP_TABLE
} from '../../lib/engine/bondEvents';
import { safeSetEmbedThumbnail } from '../utils/discordEmbedHelper';

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

  const events = getBondEventsForServant(activeServant);
  const bondLvl = activeServant.bondLevel || 1;
  const availableEvent = events.find(e => e.requiredBondLevel <= bondLvl);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('vn_play_event')
      .setLabel(availableEvent ? `📖 Play Interlude: ${availableEvent.title.slice(0, 30)}` : '📖 Play Generic Interlude')
      .setStyle(ButtonStyle.Primary),
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

      const events = getBondEventsForServant(activeServant);
      const firstEvent = events[0];
      const scene1 = firstEvent.scenes[0];
      const sTemplate = activeServant.template || activeServant;
      const servantName = activeServant.nickname || sTemplate.name || 'Heroic Spirit';

      const vnEmbed = new EmbedBuilder()
        .setTitle(`📖 Visual Novel Interlude: ${firstEvent.title}`)
        .setDescription(
          `*${firstEvent.subtitle}*\n\n` +
          `**${scene1.speakerName || servantName}**:\n` +
          `*"${scene1.dialogueText}"*\n\n` +
          `👇 **Make your dialogue choice below to increase Bond EXP:**`
        )
        .setColor(0xec4899)
        .setFooter({ text: `Reward: +${firstEvent.rewardBondExp} Bond EXP & 💎 ${firstEvent.rewardSaintQuartz || 3} SQ` });

      if (sTemplate.avatarUrl) {
        safeSetEmbedThumbnail(vnEmbed, sTemplate.avatarUrl);
      }

      const choicesRow = new ActionRowBuilder<ButtonBuilder>();
      if (scene1.choices && scene1.choices.length > 0) {
        scene1.choices.forEach((c, idx) => {
          choicesRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`vn_choice_${firstEvent.id}_${c.id}`)
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
      const events = getBondEventsForServant(activeServant);
      const bondLvl = activeServant.bondLevel || 1;
      const availableEvent = events.find(e => e.requiredBondLevel <= bondLvl) || events[0];
      const scene1 = availableEvent.scenes[0];

      const vnEmbed = new EmbedBuilder()
        .setTitle(`📖 Bond Interlude: ${availableEvent.title}`)
        .setDescription(
          `**${scene1.speakerName || servantName}**:\n` +
          `*"${scene1.dialogueText}"*\n\n` +
          `👇 **Choose your response to deepen your Bond:**`
        )
        .setColor(0xec4899)
        .setFooter({ text: `Reward: +${availableEvent.rewardBondExp} Bond EXP & 💎 ${availableEvent.rewardSaintQuartz || 3} SQ` });

      if (sTemplate.avatarUrl) {
        safeSetEmbedThumbnail(vnEmbed, sTemplate.avatarUrl);
      }

      const choicesRow = new ActionRowBuilder<ButtonBuilder>();
      if (scene1.choices && scene1.choices.length > 0) {
        scene1.choices.forEach((c, idx) => {
          choicesRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`vn_choice_${availableEvent.id}_${c.id}`)
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

      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [vnEmbed],
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

    if (btnId.startsWith('vn_choice_')) {
      const events = getBondEventsForServant(activeServant);
      const event = events[0];
      const scene1 = event.scenes[0];

      // Parse choice
      const choiceId = btnId.replace(/vn_choice_[^_]+_/, '');
      const pickedChoice = scene1.choices?.find(c => c.id === choiceId);
      const expGain = pickedChoice ? pickedChoice.bondExpGain : 100;

      // Add bond exp to servant
      const { updatedServant } = addBondExpToServant(activeServant, expGain);

      // Award SQ
      const sqReward = event.rewardSaintQuartz || 3;
      master.saintQuartz = (master.saintQuartz || 0) + sqReward;

      // Track completed event
      if (!updatedServant.completedBondEvents) updatedServant.completedBondEvents = [];
      if (!updatedServant.completedBondEvents.includes(event.id)) {
        updatedServant.completedBondEvents.push(event.id);
      }

      master.servants = master.servants.map((s: any) => s.id === updatedServant.id ? updatedServant : s);
      await saveMaster(master);

      const reactionEmoji = pickedChoice?.reactionEmotion === 'happy' ? '💖' : pickedChoice?.reactionEmotion === 'flustered' ? '😳' : pickedChoice?.reactionEmotion === 'amused' ? '😄' : '✨';

      const resultEmbed = new EmbedBuilder()
        .setTitle(`🌸 Interlude Complete: ${event.title}`)
        .setDescription(
          `**${servantName}**:\n` +
          `*"${pickedChoice ? pickedChoice.response : scene1.dialogueText}"*\n\n` +
          `🎉 **REWARDS EARNED:**\n` +
          `• **Bond EXP:** +${expGain} EXP ${reactionEmoji}\n` +
          `• **Saint Quartz:** +💎 ${sqReward} SQ\n` +
          `• **Current Bond:** Level \`${updatedServant.bondLevel} / 10\``
        )
        .setColor(0xec4899);

      if (sTemplate.avatarUrl) {
        safeSetEmbedThumbnail(resultEmbed, sTemplate.avatarUrl);
      }

      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [resultEmbed]
      });
      return;
    }

  } catch (error: any) {
    console.error('Error in handleBondButtonInteraction:', error);
    await interaction.reply({ flags: MessageFlags.Ephemeral, content: `❌ Error: ${error.message}` });
  }
}
