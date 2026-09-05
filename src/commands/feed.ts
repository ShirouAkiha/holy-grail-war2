import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { feedCraftEssences, getCeExpValue, calculateLevelFromExp, getTotalExpForLevel } from '../engine/customization';
import { CRAFT_ESSENCE_DATABASE } from '../data/craftEssences';

export const data = new SlashCommandBuilder()
  .setName('feed')
  .setDescription('✨ Feed Craft Essences to your Servant for EXP and +10 Stat Points per level!')
  .addStringOption(opt =>
    opt
      .setName('craft_essence')
      .setDescription('Name of Craft Essence, "all_3star", "duplicates", or "all"')
      .setRequired(false)
  )
  .addStringOption(opt =>
    opt
      .setName('servant')
      .setDescription('Target Servant name (defaults to active Servant)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const targetServantName = interaction.options.getString('servant')?.trim().toLowerCase();
    
    let activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];
    if (targetServantName) {
      const found = master.servants?.find((s: any) =>
        s.template?.name?.toLowerCase().includes(targetServantName) ||
        s.nickname?.toLowerCase().includes(targetServantName) ||
        s.id.toLowerCase() === targetServantName
      );
      if (found) {
        activeServant = found;
      }
    }

    if (!activeServant) {
      await interaction.reply({
        ephemeral: true,
        content: '❌ You have no contracted Servant to enhance! Use `/summon` first.'
      });
      return;
    }

    const ownedCes = (master.craftEssences || []).filter(Boolean);
    if (ownedCes.length === 0) {
      await interaction.reply({
        ephemeral: true,
        content: '❌ You have no Craft Essences in your inventory to feed! Summon more in `/cegacha` using Saint Quartz 💎.'
      });
      return;
    }

    const sName = activeServant.nickname || activeServant.template?.name || 'Heroic Spirit';
    const query = interaction.options.getString('craft_essence')?.trim();

    // 1. If no query passed, show the Interactive Synthesis / Feed menu
    if (!query) {
      const currentExp = activeServant.experience ?? getTotalExpForLevel(activeServant.level || 1);
      const expStatus = calculateLevelFromExp(currentExp);

      const ceSummary = ownedCes.map((ce: any, idx: number) => {
        const exp = getCeExpValue(ce);
        const star = '★'.repeat(ce.rarity || 3);
        const isEq = activeServant.equippedCeId === ce.id ? ' `[EQUIPPED]`' : '';
        return `\`#${idx + 1}\` **${ce.name}** [${star}] — **+${exp.toLocaleString()} EXP**${isEq}`;
      }).slice(0, 10).join('\n');

      const selectOptions = ownedCes.slice(0, 25).map((ce: any, idx: number) => ({
        label: `${idx + 1}. ${ce.name} (★${ce.rarity || 3})`,
        value: `feed_ce_${idx}`,
        description: `+${getCeExpValue(ce).toLocaleString()} EXP • +10 Stat Pts/Lv`
      }));

      const embed = new EmbedBuilder()
        .setTitle(`✨ Spirit Origin Enhancement: ${sName}`)
        .setDescription(
          `Feed Craft Essences into **${sName}**'s Saint Graph to grant massive Spirit EXP.\n` +
          `⭐ **Leveling Rule:** Every Level Up grants **+10 Available Stat Points**!\n\n` +
          `📊 **Current Status:**\n` +
          `• **Level:** \`Lv. ${activeServant.level || 1} / 100\`\n` +
          `• **Total EXP:** \`${currentExp.toLocaleString()} EXP\`\n` +
          `• **Next Level:** \`${expStatus.currentLevelExp.toLocaleString()} / ${expStatus.nextLevelExp.toLocaleString()} EXP\` (${expStatus.progressPercent}%)\n` +
          `• **Unspent Stat Points:** \`${activeServant.availableStatPoints || 0} pts\`\n\n` +
          `📦 **Available Essences to Feed (${ownedCes.length} total):**\n` +
          `${ceSummary}\n\n` +
          `*Select an essence below or use quick batch feed buttons:*`
        )
        .setColor(0xd4af37)
        .setFooter({ text: 'Each level up awards +10 stat points to allocate via /customise stats' });

      const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('feed_select_ce')
          .setPlaceholder('Select Craft Essence to feed for EXP...')
          .addOptions(selectOptions)
      );

      const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('feed_quick_3star')
          .setLabel('Feed All 3★ CEs')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⚡'),
        new ButtonBuilder()
          .setCustomId('feed_quick_duplicates')
          .setLabel('Feed All Duplicates')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔄'),
        new ButtonBuilder()
          .setCustomId('feed_quick_stats')
          .setLabel('Allocate Stats')
          .setStyle(ButtonStyle.Success)
          .setEmoji('📊')
      );

      const reply = await interaction.reply({
        embeds: [embed],
        components: [selectRow, btnRow],
        ephemeral: true,
        fetchReply: true
      });

      // Attach interaction collector
      const collector = reply.createMessageComponentCollector({ time: 120000 });
      collector.on('collect', async (i: any) => {
        try {
          if (i.user.id !== interaction.user.id) {
            await i.reply({ ephemeral: true, content: '❌ This menu belongs to another Master.' });
            return;
          }

          let targetsToFeed: string[] = [];
          if (i.customId === 'feed_select_ce') {
            const val = i.values[0];
            const idxStr = val.replace('feed_ce_', '');
            targetsToFeed = [idxStr];
          } else if (i.customId === 'feed_quick_3star') {
            targetsToFeed = master.craftEssences
              .map((c: any, idx: number) => (c && c.rarity <= 3 ? String(idx) : null))
              .filter(Boolean) as string[];
            if (targetsToFeed.length === 0) {
              await i.reply({ ephemeral: true, content: 'ℹ️ No 3★ or lower Craft Essences found in inventory.' });
              return;
            }
          } else if (i.customId === 'feed_quick_duplicates') {
            const seen = new Set<string>();
            targetsToFeed = master.craftEssences
              .map((c: any, idx: number) => {
                if (!c) return null;
                if (seen.has(c.id)) return String(idx);
                seen.add(c.id);
                return null;
              })
              .filter(Boolean) as string[];
            if (targetsToFeed.length === 0) {
              await i.reply({ ephemeral: true, content: 'ℹ️ No duplicate Craft Essences found in inventory.' });
              return;
            }
          } else if (i.customId === 'feed_quick_stats') {
            await i.reply({
              ephemeral: true,
              content: `📊 **Stat Points Available:** \`${activeServant.availableStatPoints || 0} pts\`\nUse \`/customise stats strength:5 mana:5\` or the Servant Workshop to allocate!`
            });
            return;
          }

          const result = feedCraftEssences(activeServant, targetsToFeed, master.craftEssences);
          master.craftEssences = result.remainingCraftEssences;
          const sIdx = master.servants.findIndex((s: any) => s.id === activeServant.id);
          if (sIdx !== -1) {
            master.servants[sIdx] = result.updatedServant;
          }
          activeServant = result.updatedServant;
          await saveMaster(master);

          const lvlMsg = result.levelsGained > 0
            ? `🌟 **LEVEL UP!** \`Lv. ${result.oldLevel} ➔ Lv. ${result.newLevel}\` (+${result.levelsGained} Levels!)\n` +
              `📈 **Stat Points Gained:** \`+${result.statPointsGained} Available Points\` (+10 pts per level!)\n` +
              `✨ **Total Available Points:** \`${result.updatedServant.availableStatPoints} pts\``
            : `📊 **Level:** \`Lv. ${result.newLevel}\` (Progressed towards next level)\n` +
              `✨ **Available Stat Points:** \`${result.updatedServant.availableStatPoints} pts\``;

          const fedNames = result.fedEssences.map((c: any) => `• **${c.name}** (★${c.rarity || 3}) — +${getCeExpValue(c).toLocaleString()} EXP`).slice(0, 8).join('\n');

          const successEmbed = new EmbedBuilder()
            .setTitle(`✨ Spirit Origin Enhancement Successful!`)
            .setDescription(
              `Synthesized **${result.fedEssences.length} Craft Essence(s)** into **${sName}**!\n\n` +
              `🔮 **EXP Gained:** \`+${result.expGained.toLocaleString()} EXP\`\n` +
              `${lvlMsg}\n\n` +
              `**Consolidated Essences:**\n${fedNames}${result.fedEssences.length > 8 ? `\n*...and ${result.fedEssences.length - 8} more*` : ''}\n\n` +
              `*Use \`/customise stats\` or Servant Workshop to allocate your points!*`
            )
            .setColor(result.levelsGained > 0 ? 0x22c55e : 0x38bdf8);

          await i.update({ embeds: [successEmbed], components: [] });
        } catch (err: any) {
          await i.reply({ ephemeral: true, content: `❌ Error: ${err.message}` });
        }
      });
      return;
    }

    // 2. Direct string query feed
    let targetsToFeed: string[] = [];
    const lowQuery = query.toLowerCase();

    if (lowQuery === 'all_3star' || lowQuery === '3star' || lowQuery === '3*') {
      targetsToFeed = ownedCes
        .map((c: any, idx: number) => (c && c.rarity <= 3 ? String(idx) : null))
        .filter(Boolean) as string[];
    } else if (lowQuery === 'duplicates' || lowQuery === 'dupes') {
      const seen = new Set<string>();
      targetsToFeed = ownedCes
        .map((c: any, idx: number) => {
          if (!c) return null;
          if (seen.has(c.id)) return String(idx);
          seen.add(c.id);
          return null;
        })
        .filter(Boolean) as string[];
    } else if (lowQuery === 'all') {
      targetsToFeed = ownedCes.map((_: any, idx: number) => String(idx));
    } else {
      // Find matching CE by name or ID
      const matchIdx = ownedCes.findIndex(
        (c: any) => c.name?.toLowerCase().includes(lowQuery) || c.id === query
      );
      if (matchIdx !== -1) {
        targetsToFeed = [String(matchIdx)];
      }
    }

    if (targetsToFeed.length === 0) {
      await interaction.reply({
        ephemeral: true,
        content: `❌ No Craft Essences matching "${query}" found in your inventory.`
      });
      return;
    }

    const result = feedCraftEssences(activeServant, targetsToFeed, master.craftEssences);
    master.craftEssences = result.remainingCraftEssences;
    const sIdx = master.servants.findIndex((s: any) => s.id === activeServant.id);
    if (sIdx !== -1) {
      master.servants[sIdx] = result.updatedServant;
    }
    await saveMaster(master);

    const lvlMsg = result.levelsGained > 0
      ? `🌟 **LEVEL UP!** \`Lv. ${result.oldLevel} ➔ Lv. ${result.newLevel}\` (+${result.levelsGained} Levels!)\n` +
        `📈 **Stat Points Gained:** \`+${result.statPointsGained} Available Points\` (+10 pts per level!)\n` +
        `✨ **Total Available Points:** \`${result.updatedServant.availableStatPoints} pts\``
      : `📊 **Level:** \`Lv. ${result.newLevel}\` (Progressed towards next level)\n` +
        `✨ **Available Stat Points:** \`${result.updatedServant.availableStatPoints} pts\``;

    const fedList = result.fedEssences.map((c: any) => `• **${c.name}** (★${c.rarity || 3}) — +${getCeExpValue(c).toLocaleString()} EXP`).slice(0, 8).join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`✨ Spirit Origin Enhancement: ${sName}`)
      .setDescription(
        `Synthesized **${result.fedEssences.length} Craft Essence(s)** into **${sName}**!\n\n` +
        `🔮 **EXP Gained:** \`+${result.expGained.toLocaleString()} EXP\`\n` +
        `${lvlMsg}\n\n` +
        `**Consolidated Essences:**\n${fedList}${result.fedEssences.length > 8 ? `\n*...and ${result.fedEssences.length - 8} more*` : ''}\n\n` +
        `*To allocate your newly gained stat points, use:*\n\`/customise stats strength:5 endurance:5\``
      )
      .setColor(result.levelsGained > 0 ? 0x22c55e : 0x38bdf8);

    await interaction.reply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Error in /feed command:', error);
    await interaction.reply({
      ephemeral: true,
      content: `❌ Error: ${error.message}`
    });
  }
}
