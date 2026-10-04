import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
  MessageFlags
} from 'discord.js';
import { getOrCreateMaster, getAllCraftEssences } from '../database/service';
import { 
  BOND_CRAFT_ESSENCES, 
  getAllBondCraftEssences, 
  getBondCraftEssenceForServant 
} from '../data/craftEssences';
import { safeSetEmbedImage, safeSetEmbedThumbnail } from '../utils/discordEmbedHelper';

export const data = new SlashCommandBuilder()
  .setName('ce')
  .setDescription('🖼️ View Craft Essence artwork, lore, bond relics, and stats')
  .addSubcommand(sub =>
    sub
      .setName('art')
      .setDescription('🖼️ View high-resolution card artwork and lore of a Craft Essence')
      .addStringOption(opt =>
        opt
          .setName('name')
          .setDescription('Name or ID of Craft Essence (Leave empty for active Servant\'s equipped CE)')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('view')
      .setDescription('📖 Inspect full parameter card, passives, and flavor lore')
      .addStringOption(opt =>
        opt
          .setName('name')
          .setDescription('Name or ID of Craft Essence')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('bond')
      .setDescription('🎖️ Browse all exclusive Bond 10 Craft Essences and partner Servants')
  )
  .addSubcommand(sub =>
    sub
      .setName('list')
      .setDescription('📜 Browse the Craft Essence archive and conceptual relics')
      .addIntegerOption(opt =>
        opt
          .setName('rarity')
          .setDescription('Filter by star rating (3, 4, 5)')
          .setRequired(false)
          .addChoices(
            { name: '★5 SSR', value: 5 },
            { name: '★4 SR', value: 4 },
            { name: '★3 R', value: 3 }
          )
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const sub = interaction.options.getSubcommand();
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];
    const allCes = getAllCraftEssences();
    const bondCes = getAllBondCraftEssences();
    const combinedDatabase = [...allCes, ...bondCes];

    // ==========================================
    // 1. SUBCOMMAND: BOND (CATALOG OF BOND CEs)
    // ==========================================
    if (sub === 'bond') {
      const selectOptions = bondCes.slice(0, 25).map(ce => ({
        label: `${ce.name.slice(0, 50)}`,
        value: ce.id,
        description: `Partner: ${ce.bondServantName || 'Heroic Spirit'} • ★4 Bond Relic`.slice(0, 100)
      }));

      const embed = new EmbedBuilder()
        .setTitle('🎖️ Master-Servant Max Bond 10 Relics')
        .setDescription(
          `When a contracted Heroic Spirit reaches **Bond Level 10 (MAX BOND)**, they bestow their legendary **Bond Craft Essence** upon their Master.\n\n` +
          bondCes.map(ce => 
            `• ★4 **${ce.name}**\n` +
            `  *Partner:* **${ce.bondServantName}**\n` +
            `  *Effect:* ${ce.effectText}`
          ).join('\n\n') +
          `\n\n💡 *Select a Bond Relic below or use \`/ce art <name>\` to view its card artwork!*`
        )
        .setColor(0xd4af37)
        .setFooter({ text: 'Bond relics grant exclusive passives when equipped to their partner.' });

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('ce_select_bond_view')
          .setPlaceholder('🖼️ Select a Bond Relic to view its full artwork...')
          .addOptions(selectOptions)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
      const reply = await interaction.fetchReply().catch(() => null);

      if (reply && typeof reply.createMessageComponentCollector === 'function') {
        const collector = reply.createMessageComponentCollector({
          componentType: ComponentType.StringSelect,
          time: 120000
        });

        collector.on('collect', async (i) => {
        if (i.user.id !== interaction.user.id) {
          await i.reply({ content: 'Only the Master who invoked this archive may interact with it.', flags: MessageFlags.Ephemeral });
          return;
        }
        const selectedId = i.values[0];
        const selectedCe = combinedDatabase.find(c => c.id === selectedId);
        if (selectedCe) {
          const artEmbed = new EmbedBuilder()
            .setTitle(`🖼️ Bond 10 Relic Artwork: ${selectedCe.name}`)
            .setDescription(
              `★4 **${selectedCe.name}** • **[BOND 10 RELIC]**\n` +
              `**Bond Partner:** **${selectedCe.bondServantName}**\n` +
              `**Stats:** \`+${selectedCe.atkBonus || 100} ATK\` / \`+${selectedCe.hpBonus || 100} HP\`\n\n` +
              `**Special Bond Effect:**\n${selectedCe.effectText}\n\n` +
              `*${selectedCe.description}*`
            )
            .setColor(0xd4af37);

          if (selectedCe.artworkUrl) {
            safeSetEmbedImage(artEmbed, selectedCe.artworkUrl);
          }

          await i.reply({ embeds: [artEmbed] });
        }
      });
      return;
    }
  }

    // ==========================================
    // 2. SUBCOMMAND: ART / VIEW (SPECIFIC CE)
    // ==========================================
    if (sub === 'art' || sub === 'view') {
      const searchName = interaction.options.getString('name');
      let targetCe: any = null;

      if (searchName) {
        const query = searchName.toLowerCase().trim();
        targetCe = combinedDatabase.find(c => 
          c.name.toLowerCase() === query ||
          c.id.toLowerCase() === query ||
          c.name.toLowerCase().includes(query) ||
          (c.bondServantName && c.bondServantName.toLowerCase().includes(query))
        );
      } else if (activeServant?.equippedCeId) {
        targetCe = combinedDatabase.find(c => c.id === activeServant.equippedCeId);
      } else if (master.craftEssences && master.craftEssences.length > 0) {
        targetCe = master.craftEssences[0];
      } else {
        targetCe = combinedDatabase[0];
      }

      if (!targetCe) {
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          embeds: [
            new EmbedBuilder()
              .setTitle('❌ Craft Essence Not Found')
              .setDescription(`Could not locate a Craft Essence matching \`${searchName}\`. Use \`/ce list\` to browse all relics.`)
              .setColor(0xef4444)
          ]
        });
        return;
      }

      const stars = '★'.repeat(targetCe.rarity || 4);
      const rarityLabel = targetCe.rarity >= 5 ? 'SSR' : targetCe.rarity >= 4 ? 'SR' : 'R';
      const bondBadge = targetCe.isBondCe ? ' • **[BOND 10 RELIC]**' : '';
      const partnerLine = targetCe.bondServantName ? `**Bond Partner:** **${targetCe.bondServantName}**\n` : '';

      const ceEmbed = new EmbedBuilder()
        .setTitle(`🖼️ Craft Essence: ${targetCe.name}`)
        .setDescription(
          `**Rarity:** ${stars} ${rarityLabel}${bondBadge}\n` +
          partnerLine +
          `**Effect:** ${targetCe.effectText || targetCe.description}\n` +
          `**Stats:** \`+${targetCe.atkBonus || targetCe.bonusAtk || 0} ATK\` / \`+${targetCe.hpBonus || targetCe.bonusHp || 0} HP\`\n\n` +
          `*${targetCe.description || 'An ancient conceptual weapon forged from heroic memories.'}*`
        )
        .setColor(targetCe.isBondCe ? 0xec4899 : targetCe.rarity >= 5 ? 0xf59e0b : 0x38bdf8)
        .setFooter({ text: 'Fate Conceptual Armaments • Leyline Altar' });

      if (targetCe.artworkUrl) {
        safeSetEmbedImage(ceEmbed, targetCe.artworkUrl);
      }

      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`ce_btn_open_art_${targetCe.id}`)
          .setLabel('View High-Res Art 🖼️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('ce_btn_inventory')
          .setLabel('My Inventory 🛡️')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({ embeds: [ceEmbed], components: [actionRow] });
      const reply = await interaction.fetchReply().catch(() => null);

      if (reply && typeof reply.createMessageComponentCollector === 'function') {
        const collector = reply.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 60000
        });

        collector.on('collect', async (bi) => {
          if (bi.customId === 'ce_btn_inventory') {
            await bi.reply({
              flags: MessageFlags.Ephemeral,
              content: 'Use `/inventory` to equip, unequip, feed, or browse your full personal relic vault!'
            });
          } else if (bi.customId.startsWith('ce_btn_open_art_')) {
            const artOnlyEmbed = new EmbedBuilder()
              .setTitle(`🖼️ ${targetCe.name}`)
              .setDescription(`*${targetCe.description}*`)
              .setColor(0xd4af37);
            if (targetCe.artworkUrl) {
              safeSetEmbedImage(artOnlyEmbed, targetCe.artworkUrl);
            }
            await bi.reply({ embeds: [artOnlyEmbed] });
          }
        });
      }
      return;
    }

    // ==========================================
    // 3. SUBCOMMAND: LIST (CATALOG WITH ART BUTTONS)
    // ==========================================
    if (sub === 'list') {
      const filterRarity = interaction.options.getInteger('rarity');
      const initialFilter = filterRarity ? String(filterRarity) : 'all';
      const { embed, components } = buildCeListUI(combinedDatabase, 1, initialFilter as any);

      await interaction.reply({ embeds: [embed], components });
      return;
    }
  } catch (error) {
    console.error('Error in /ce command:', error);
    if (!interaction.replied) {
      await interaction.reply({ content: '❌ Failed to access Craft Essence archive.', flags: MessageFlags.Ephemeral });
    }
  }
}

// ==========================================
// 4. INTERACTIVE CE LIST UI BUILDER & HANDLER
// ==========================================
export function buildCeListUI(
  combinedDatabase: any[],
  page: number = 1,
  rarityFilter: 'all' | '5' | '4' | '3' | 'bond' = 'all'
) {
  let filtered = combinedDatabase;
  let filterLabel = 'All Tiers';

  if (rarityFilter === '5') {
    filtered = combinedDatabase.filter(c => c.rarity === 5 && !c.isBondCe);
    filterLabel = '★5 SSR';
  } else if (rarityFilter === '4') {
    filtered = combinedDatabase.filter(c => c.rarity === 4 && !c.isBondCe);
    filterLabel = '★4 SR';
  } else if (rarityFilter === '3') {
    filtered = combinedDatabase.filter(c => c.rarity === 3 && !c.isBondCe);
    filterLabel = '★3 R';
  } else if (rarityFilter === 'bond') {
    filtered = combinedDatabase.filter(c => c.isBondCe);
    filterLabel = '🎖️ Bond 10';
  }

  const itemsPerPage = 6;
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const pagedItems = filtered.slice(startIndex, startIndex + itemsPerPage);

  const lines = pagedItems.map((c, idx) => {
    const stars = '★'.repeat(c.rarity || 4);
    const bondBadge = c.isBondCe ? ` *(Bond 10 • ${c.bondServantName || 'Heroic Spirit'})*` : '';
    const atkHp = `+${c.atkBonus || c.bonusAtk || 0} ATK / +${c.hpBonus || c.bonusHp || 0} HP`;
    return `**${startIndex + idx + 1}. [${stars}] ${c.name}**${bondBadge}\n  *Effect:* ${c.effectText || c.description}\n  *Stats:* \`${atkHp}\``;
  });

  const embed = new EmbedBuilder()
    .setTitle('🛡️ Craft Essence Encyclopedia & Art Gallery')
    .setDescription(
      `Showing **${filtered.length > 0 ? startIndex + 1 : 0}–${startIndex + pagedItems.length}** of **${filtered.length}** Conceptual Relics.\n` +
      `*Filter: **${filterLabel}** | Page **${currentPage}/${totalPages}***\n\n` +
      (lines.length > 0 ? lines.join('\n\n') : '*(No Craft Essences match this filter tier)*') +
      `\n\n💡 *Select a Craft Essence below or tap a view button to inspect its full artwork and parameters!*`
    )
    .setColor(rarityFilter === '5' ? 0xf59e0b : rarityFilter === 'bond' ? 0xec4899 : 0x38bdf8)
    .setFooter({ text: `Page ${currentPage} of ${totalPages} • Holy Grail War Relic Registry` });

  const components: ActionRowBuilder<any>[] = [];

  // Dropdown Select Menu for items on current page
  if (pagedItems.length > 0) {
    const options = pagedItems.map((c, idx) => ({
      label: `${startIndex + idx + 1}. ${c.name}`.slice(0, 100),
      value: `ce_view_${c.id}`,
      description: `★${c.rarity || 4} • +${c.atkBonus || 0} ATK / +${c.hpBonus || 0} HP • ${(c.effectText || c.description || '').slice(0, 50)}`.slice(0, 100),
      emoji: '🖼️'
    }));

    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ce_list_select_view')
        .setPlaceholder('🖼️ Select a Craft Essence to view full artwork & stats...')
        .addOptions(options)
    );
    components.push(selectRow);
  }

  // Row 2: Pagination & Filter Control Buttons
  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ce_list_prev_${currentPage}_${rarityFilter}`)
      .setLabel('⏮️ Prev')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage <= 1),
    new ButtonBuilder()
      .setCustomId(`ce_list_page_num`)
      .setLabel(`Page ${currentPage} / ${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`ce_list_next_${currentPage}_${rarityFilter}`)
      .setLabel('Next ⏭️')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage >= totalPages),
    new ButtonBuilder()
      .setCustomId(`ce_list_filter_${rarityFilter}`)
      .setLabel(`Filter: ${filterLabel}`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔍')
  );
  components.push(navRow);

  // Row 3: Direct Item Buttons for page items (up to 5 buttons max)
  if (pagedItems.length > 0) {
    const itemBtnRow = new ActionRowBuilder<ButtonBuilder>();
    pagedItems.slice(0, 5).forEach((c, idx) => {
      const shortName = c.name.length > 18 ? c.name.slice(0, 16) + '..' : c.name;
      itemBtnRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`ce_view_${c.id}`)
          .setLabel(`${startIndex + idx + 1}. ${shortName}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🖼️')
      );
    });
    components.push(itemBtnRow);
  }

  return { embed, components, currentPage, totalPages };
}

export async function handleCeListInteraction(i: any) {
  try {
    const customId = i.customId;
    const allCes = getAllCraftEssences();
    const bondCes = getAllBondCraftEssences();
    const combinedDatabase = [...allCes, ...bondCes];

    // Case 1: Select menu selection or View CE button
    if (
      (i.isStringSelectMenu() && (customId === 'ce_list_select_view' || customId.startsWith('ce_list_select'))) ||
      customId.startsWith('ce_view_')
    ) {
      let targetId = '';
      if (i.isStringSelectMenu()) {
        targetId = i.values[0].replace('ce_view_', '');
      } else {
        targetId = customId.replace('ce_view_', '');
      }

      const targetCe = combinedDatabase.find(c => c.id === targetId);
      if (targetCe) {
        const stars = '★'.repeat(targetCe.rarity || 4);
        const rarityLabel = targetCe.rarity >= 5 ? 'SSR' : targetCe.rarity >= 4 ? 'SR' : 'R';
        const bondBadge = targetCe.isBondCe ? ' • **[BOND 10 RELIC]**' : '';
        const partnerLine = targetCe.bondServantName ? `**Bond Partner:** **${targetCe.bondServantName}**\n` : '';

        const ceEmbed = new EmbedBuilder()
          .setTitle(`🖼️ Craft Essence: ${targetCe.name}`)
          .setDescription(
            `**Rarity:** ${stars} ${rarityLabel}${bondBadge}\n` +
            partnerLine +
            `**Effect:** ${targetCe.effectText || targetCe.description}\n` +
            `**Stats:** \`+${targetCe.atkBonus || targetCe.bonusAtk || 0} ATK\` / \`+${targetCe.hpBonus || targetCe.bonusHp || 0} HP\`\n\n` +
            `*${targetCe.description || 'An ancient conceptual weapon forged from heroic memories.'}*`
          )
          .setColor(targetCe.isBondCe ? 0xec4899 : targetCe.rarity >= 5 ? 0xf59e0b : 0x38bdf8)
          .setFooter({ text: 'Fate Conceptual Armaments • Leyline Altar' });

        if (targetCe.artworkUrl) {
          safeSetEmbedImage(ceEmbed, targetCe.artworkUrl);
        }

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`ce_btn_open_art_${targetCe.id}`)
            .setLabel('View High-Res Art 🖼️')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('ce_list_back_1_all')
            .setLabel('Back to CE List 📜')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('ce_btn_inventory')
            .setLabel('My Inventory 🛡️')
            .setStyle(ButtonStyle.Secondary)
        );

        if (i.replied || i.deferred) {
          await i.followUp({ embeds: [ceEmbed], components: [actionRow] });
        } else {
          await i.reply({ embeds: [ceEmbed], components: [actionRow] });
        }
      } else {
        await i.reply({ content: '❌ Craft Essence not found.' });
      }
      return true;
    }

    // Case 2: Open High-Res Art
    if (customId.startsWith('ce_btn_open_art_')) {
      const targetId = customId.replace('ce_btn_open_art_', '');
      const targetCe = combinedDatabase.find(c => c.id === targetId);
      if (targetCe) {
        const artOnlyEmbed = new EmbedBuilder()
          .setTitle(`🖼️ ${targetCe.name}`)
          .setDescription(`*${targetCe.description || targetCe.effectText}*`)
          .setColor(0xd4af37);
        if (targetCe.artworkUrl) {
          safeSetEmbedImage(artOnlyEmbed, targetCe.artworkUrl);
        }
        await i.reply({ embeds: [artOnlyEmbed] });
      } else {
        await i.reply({ content: '❌ Craft Essence artwork not found.' });
      }
      return true;
    }

    // Case 3: Back to CE List
    if (customId.startsWith('ce_list_back')) {
      const parts = customId.split('_'); // ce_list_back_page_filter
      const page = parseInt(parts[3] || '1', 10);
      const filter = (parts[4] || 'all') as any;

      const { embed, components } = buildCeListUI(combinedDatabase, page, filter);
      await i.reply({ embeds: [embed], components });
      return true;
    }

    // Case 4: Pagination Prev
    if (customId.startsWith('ce_list_prev_')) {
      const parts = customId.split('_'); // ce_list_prev_curPage_filter
      const curPage = parseInt(parts[3] || '1', 10);
      const filter = (parts[4] || 'all') as any;

      const { embed, components } = buildCeListUI(combinedDatabase, Math.max(1, curPage - 1), filter);
      await i.update({ embeds: [embed], components });
      return true;
    }

    // Case 5: Pagination Next
    if (customId.startsWith('ce_list_next_')) {
      const parts = customId.split('_'); // ce_list_next_curPage_filter
      const curPage = parseInt(parts[3] || '1', 10);
      const filter = (parts[4] || 'all') as any;

      const { embed, components } = buildCeListUI(combinedDatabase, curPage + 1, filter);
      await i.update({ embeds: [embed], components });
      return true;
    }

    // Case 6: Rarity Filter Toggle
    if (customId.startsWith('ce_list_filter_')) {
      const curFilter = customId.replace('ce_list_filter_', '');
      const cycle: Array<'all' | '5' | '4' | '3' | 'bond'> = ['all', '5', '4', '3', 'bond'];
      const curIdx = cycle.indexOf(curFilter as any);
      const nextFilter = cycle[(curIdx + 1) % cycle.length];

      const { embed, components } = buildCeListUI(combinedDatabase, 1, nextFilter as any);
      await i.update({ embeds: [embed], components });
      return true;
    }

    return false;
  } catch (err: any) {
    if (err.code === 10062 || err.code === 40060 || err.message?.includes('Unknown interaction')) {
      return true;
    }
    console.error('Error in handleCeListInteraction:', err);
    return false;
  }
}
