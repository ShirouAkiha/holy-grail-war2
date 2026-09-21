import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType, 
  MessageFlags 
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { CRAFT_ESSENCE_DATABASE } from '../data/craftEssences';
import { SERVANT_DATABASE } from '../data/servants';
import { feedCraftEssences, getCeExpValue, calculateLevelFromExp, getTotalExpForLevel } from '../engine/customization';
import { 
  getOrInitWarSession, 
  invokeCommandSealInWar, 
  setWorkshopWardInWar, 
  setChannelTrapInWar 
} from '../engine/grailwar';

export interface InventoryHubOptions {
  ceViewMode?: 'all' | 'owned';
  ceRarityFilter?: 'all' | 5 | 4 | 3 | 'bond';
  ceSearchQuery?: string;
}

// ==========================================
// 0. INTERACTIVE INVENTORY HUB BUILDER & HANDLERS
// ==========================================
export function buildInventoryHub(
  master: any,
  activeServant: any,
  category: 'ces' | 'servants' | 'seals' | 'items' = 'ces',
  page: number = 1,
  selectedItemId?: string,
  options: InventoryHubOptions = {}
) {
  const ownedCes = (master.craftEssences || []).filter(Boolean);
  const ownedServants = master.servants || [];
  const servantName = activeServant?.nickname || activeServant?.template?.name || 'Heroic Spirit';

  const ceViewMode = options.ceViewMode || 'all';
  const ceRarityFilter = options.ceRarityFilter || 'all';
  const ceSearchQuery = (options.ceSearchQuery || '').trim().toLowerCase();

  let title = `👔 ${master.username}'s Inventory — Craft Essences`;
  let equippedBanner = '';
  let itemLines: string[] = [];
  let selectOptions: any[] = [];
  let totalItems = 0;
  const itemsPerPage = 8;

  if (category === 'ces') {
    const isCatalog = ceViewMode === 'all';
    title = isCatalog
      ? `🛡️ Master Archive — All Craft Essences (Catalog & Inventory)`
      : `🛡️ ${master.username}'s Vault — Owned Craft Essences`;

    const activeCeName = activeServant?.equippedCe?.name;
    const activeCeRarity = activeServant?.equippedCe?.rarity || 5;
    equippedBanner = activeCeName
      ? `✅ Active Equipped: **${activeCeName}** (★${activeCeRarity}) on **${servantName}**.\n*Mode: **${isCatalog ? '📖 All Catalog (Archive)' : '💼 Owned Vault'}** | Filter: **${ceRarityFilter === 'all' ? 'All Tiers' : ceRarityFilter === 'bond' ? '🎖️ Bond 10' : `★${ceRarityFilter}`}**${ceSearchQuery ? ` | Search: "${ceSearchQuery}"` : ''}*`
      : `⚠️ **No Craft Essence equipped.** Select an item below and press **Equip**.\n*Mode: **${isCatalog ? '📖 All Catalog (Archive)' : '💼 Owned Vault'}** | Filter: **${ceRarityFilter === 'all' ? 'All Tiers' : ceRarityFilter === 'bond' ? '🎖️ Bond 10' : `★${ceRarityFilter}`}**${ceSearchQuery ? ` | Search: "${ceSearchQuery}"` : ''}*`;

    // Map owned counts
    const ownedCountMap = new Map<string, number>();
    for (const c of ownedCes) {
      if (!c || !c.id) continue;
      ownedCountMap.set(c.id, (ownedCountMap.get(c.id) || 0) + 1);
    }

    // Build source list: combine CRAFT_ESSENCE_DATABASE + any custom owned CEs
    const allKnownCesMap = new Map<string, any>();
    for (const ce of CRAFT_ESSENCE_DATABASE) {
      allKnownCesMap.set(ce.id, ce);
    }
    for (const c of ownedCes) {
      if (c && c.id && !allKnownCesMap.has(c.id)) {
        allKnownCesMap.set(c.id, c);
      }
    }

    let candidateCes = Array.from(allKnownCesMap.values());

    // Filter by view mode (all catalog vs owned only)
    if (ceViewMode === 'owned') {
      candidateCes = candidateCes.filter(c => (ownedCountMap.get(c.id) || 0) > 0);
    }

    // Filter by rarity / bond
    if (ceRarityFilter === 5) {
      candidateCes = candidateCes.filter(c => c.rarity === 5 && !c.isBondCe);
    } else if (ceRarityFilter === 4) {
      candidateCes = candidateCes.filter(c => c.rarity === 4 && !c.isBondCe);
    } else if (ceRarityFilter === 3) {
      candidateCes = candidateCes.filter(c => c.rarity === 3 && !c.isBondCe);
    } else if (ceRarityFilter === 'bond') {
      candidateCes = candidateCes.filter(c => c.isBondCe === true || Boolean(c.bondServantId));
    }

    // Filter by search query
    if (ceSearchQuery) {
      candidateCes = candidateCes.filter(c => {
        const n = (c.name || '').toLowerCase();
        const e = (c.effectText || '').toLowerCase();
        const d = (c.description || '').toLowerCase();
        const p = (c.passiveType || '').toLowerCase();
        const b = (c.bondServantName || '').toLowerCase();
        return n.includes(ceSearchQuery) || e.includes(ceSearchQuery) || d.includes(ceSearchQuery) || p.includes(ceSearchQuery) || b.includes(ceSearchQuery);
      });
    }

    totalItems = candidateCes.length;

    if (totalItems === 0) {
      itemLines = [
        `• *No Craft Essences match your current filter (${ceSearchQuery ? `Search: "${ceSearchQuery}"` : ceRarityFilter}).*`,
        `• *Try toggling to **[All CEs]** or clearing the search term!*`
      ];
    } else {
      const startIndex = (page - 1) * itemsPerPage;
      const paginated = candidateCes.slice(startIndex, startIndex + itemsPerPage);

      itemLines = paginated.map((ce: any) => {
        const count = ownedCountMap.get(ce.id) || 0;
        const isEq = activeServant?.equippedCeId === ce.id;
        const stars = '★'.repeat(ce.rarity || 5);
        const eqBadge = isEq ? ' **[EQUIPPED]**' : '';
        const ownBadge = count > 0 ? `\`[Owned ×${count}]\`` : `\`[Catalog]\``;
        const bondTag = ce.isBondCe ? ` 🎖️[Bond: ${ce.bondServantName || 'Heroic Spirit'}]` : '';
        const isSel = (selectedItemId && selectedItemId === ce.id);
        const pointer = isSel ? '▶ ' : '• ';

        return `${pointer}**[${stars}]** **${ce.name}** ${ownBadge}${bondTag} — +${ce.atkBonus || 0} ATK / +${ce.hpBonus || 0} HP${eqBadge}\n   ↳ *${ce.effectText || ce.description || 'Mystic Code'}*`;
      });
    }

    const selCe = candidateCes.find(c => c.id === selectedItemId) || (candidateCes.length > 0 ? candidateCes[0] : null);

    selectOptions = [
      { label: 'Unequip Current Essence', value: 'none', description: 'Remove active Craft Essence from Servant' },
      ...candidateCes.slice(0, 24).map((ce: any) => {
        const count = ownedCountMap.get(ce.id) || 0;
        const countStr = count > 0 ? ` (x${count})` : ' [Catalog]';
        const stars = '★'.repeat(ce.rarity || 5);
        return {
          label: `${stars} ${ce.name}${countStr}`.slice(0, 100),
          value: ce.id,
          description: `+${ce.atkBonus || 0} ATK / +${ce.hpBonus || 0} HP • ${(ce.effectText || 'Craft Essence').slice(0, 40)}`,
          default: selectedItemId === ce.id
        };
      })
    ];
  } else if (category === 'servants') {
    title = `⚔️ ${master.username}'s Inventory — Contracted Servants`;
    const sClass = activeServant?.template?.servantClass || 'Saber';
    const sLvl = activeServant?.level || 1;
    equippedBanner = activeServant
      ? `✅ Active Contract: **${servantName}** (${sClass}) [Lv.${sLvl}].`
      : `⚠️ No active Servant contract.`;

    totalItems = ownedServants.length;
    const startIndex = (page - 1) * itemsPerPage;
    const paginated = ownedServants.slice(startIndex, startIndex + itemsPerPage);

    itemLines = paginated.map((s: any) => {
      const sN = s.nickname || s.template?.name || 'Heroic Spirit';
      const sCls = s.template?.servantClass || 'Saber';
      const isAct = master.activeServantId === s.id;
      const actBadge = isAct ? ' **[ACTIVE CONTRACT]**' : '';
      const arrow = (selectedItemId && selectedItemId === s.id) ? '➡️ ' : '• ';
      return `${arrow}**[${sCls}]** — **${sN}** — Lv.${s.level || 1}${actBadge}`;
    });

    selectOptions = ownedServants.length > 0 
      ? ownedServants.map((s: any) => {
          const sN = s.nickname || s.template?.name || 'Heroic Spirit';
          const sCls = s.template?.servantClass || 'Saber';
          return {
            label: `${sN} (Lv.${s.level || 1} ${sCls})`,
            value: s.id,
            description: `Bond Lv.${s.bondLevel || 1} • Stat Points: ${s.availableStatPoints || 0}`,
            default: selectedItemId === s.id
          };
        })
      : [{ label: 'No Servants Contracted', value: 'none', description: 'Use /summon to contract a Servant' }];
  } else if (category === 'seals') {
    title = `📜 ${master.username}'s Inventory — Command Seals & Master Wards`;
    equippedBanner = `✅ Master Seals: **3 / 3 Command Seals Available** (Auto-Evac Ward Active).`;

    itemLines = [
      `• **Legendary** — **Command Seals** ×3 — S Rank [RECHARGES 1 / 24H]`,
      `• **Rare** — **Mage Sanctuary Bounded Field** ×1 — A Rank [60% AMBUSH DEFENSE]`,
      `• **Rare** — **Homunculus Decoy** ×${master.homunculusCount || 1} — A Rank [ABSORBS 100% DAMAGE]`,
      `• **Standard** — **Alarm Ward** ×1 — B Rank [EXPOSES INTRUDERS]`,
      `• **Standard** — **Bloodfort Drain Field** ×1 — B Rank [SIPHONS HP]`
    ];
    totalItems = 5;

    selectOptions = [
      { label: 'Command Seal Auto-Evac Ward', value: 'cs_evac', description: 'Toggle CS emergency evacuation', default: selectedItemId === 'cs_evac' },
      { label: 'Mage Sanctuary Bounded Field', value: 'ward_sanctuary', description: 'Deflects 60% of ambush damage', default: selectedItemId === 'ward_sanctuary' },
      { label: 'Homunculus Decoy', value: 'ward_decoy', description: 'Sacrifices decoy to absorb 100% ambush damage', default: selectedItemId === 'ward_decoy' },
      { label: 'Alarm Ward', value: 'ward_alarm', description: 'Reveals intruder identity upon channel entry', default: selectedItemId === 'ward_alarm' },
      { label: 'Bloodfort Drain Field', value: 'ward_drain', description: 'Siphons 2,000 HP from channel intruders', default: selectedItemId === 'ward_drain' }
    ];
  } else if (category === 'items') {
    title = `💎 ${master.username}'s Inventory — Vault & Currency`;
    equippedBanner = `✅ Current Balance: **${master.saintQuartz || 0} SQ 💎**  •  **${master.summonTickets || 0} Tickets 🎫**  •  **${master.manaPrisms || 0} Prisms 🔵**`;

    itemLines = [
      `• **Mythic** — **Saint Quartz** ×${master.saintQuartz || 0} — EX Rank [GACHA SUMMON CURRENCY]`,
      `• **Rare** — **Summon Tickets** ×${master.summonTickets || 0} — S Rank [SINGLE SUMMON TICKET]`,
      `• **Rare** — **Mana Prisms** ×${master.manaPrisms || 0} — A Rank [DA VINCI SHOP EXCHANGE]`
    ];
    totalItems = 3;

    selectOptions = [
      { label: `Saint Quartz (x${master.saintQuartz || 0})`, value: 'item_sq', description: 'Summon Heroic Spirits and Craft Essences', default: selectedItemId === 'item_sq' },
      { label: `Summon Ticket (x${master.summonTickets || 0})`, value: 'item_ticket', description: 'Perform single summons on any banner', default: selectedItemId === 'item_ticket' },
      { label: `Mana Prism (x${master.manaPrisms || 0})`, value: 'item_prism', description: 'Exchange for Summon Tickets in /gacha shop', default: selectedItemId === 'item_prism' }
    ];
  }

  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const currentPage = Math.min(Math.max(page, 1), totalPages);

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(`${equippedBanner}\n\n` + itemLines.join('\n'))
    .setColor(category === 'ces' ? 0x38bdf8 : category === 'servants' ? 0xd4af37 : 0xa855f7)
    .setFooter({ text: `Page ${currentPage}/${totalPages} • Total: ${totalItems} • Select an item below, then press Equip, View Art, or Inspect Lore.` });

  // Row 1: Primary Categories
  const catRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('inv_cat_ces').setLabel('Craft Essences').setStyle(category === 'ces' ? ButtonStyle.Primary : ButtonStyle.Secondary).setEmoji('🛡️'),
    new ButtonBuilder().setCustomId('inv_cat_servants').setLabel('Servants').setStyle(category === 'servants' ? ButtonStyle.Primary : ButtonStyle.Secondary).setEmoji('⚔️'),
    new ButtonBuilder().setCustomId('inv_cat_seals').setLabel('Seals & Wards').setStyle(category === 'seals' ? ButtonStyle.Primary : ButtonStyle.Secondary).setEmoji('📜'),
    new ButtonBuilder().setCustomId('inv_cat_items').setLabel('Vault & Currency').setStyle(category === 'items' ? ButtonStyle.Primary : ButtonStyle.Secondary).setEmoji('💎')
  );

  // Row 2: CE Filter Pills (only when in CE category)
  let filterRow: ActionRowBuilder<ButtonBuilder> | null = null;
  if (category === 'ces') {
    filterRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('inv_toggle_ce_mode')
        .setLabel(ceViewMode === 'all' ? 'Catalog (All CEs)' : 'Vault (Owned Only)')
        .setStyle(ceViewMode === 'all' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setEmoji('📚'),
      new ButtonBuilder()
        .setCustomId('inv_filter_ce_5star')
        .setLabel('★5 SSR')
        .setStyle(ceRarityFilter === 5 ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setEmoji('⭐'),
      new ButtonBuilder()
        .setCustomId('inv_filter_ce_4star')
        .setLabel('★4 SR')
        .setStyle(ceRarityFilter === 4 ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setEmoji('⭐'),
      new ButtonBuilder()
        .setCustomId('inv_filter_ce_3star')
        .setLabel('★3 R')
        .setStyle(ceRarityFilter === 3 ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setEmoji('⭐'),
      new ButtonBuilder()
        .setCustomId('inv_filter_ce_bond')
        .setLabel('Bond 10')
        .setStyle(ceRarityFilter === 'bond' ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setEmoji('🎖️')
    );
  }

  // Row 3: Select Menu
  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('inv_select_item')
      .setPlaceholder(category === 'ces' ? '🔍 Select a Craft Essence to equip or view...' : 'Select an item from inventory...')
      .addOptions(selectOptions.length > 0 ? selectOptions.slice(0, 25) : [{ label: 'No items', value: 'none' }])
  );

  // Row 4: Action Buttons
  const actRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('inv_page_prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setEmoji('◀️').setDisabled(currentPage <= 1),
    new ButtonBuilder().setCustomId('inv_page_next').setLabel('Next').setStyle(ButtonStyle.Secondary).setEmoji('▶️').setDisabled(currentPage >= totalPages),
    new ButtonBuilder().setCustomId('inv_act_equip').setLabel('Equip / Set Active').setStyle(ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId('inv_act_view_art').setLabel('View Artwork').setStyle(ButtonStyle.Primary).setEmoji('🖼️'),
    new ButtonBuilder().setCustomId('inv_act_inspect').setLabel('Inspect Lore').setStyle(ButtonStyle.Secondary).setEmoji('📖')
  );

  // Row 5: Secondary Actions / Quick Links
  const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('inv_act_unequip').setLabel('Unequip').setStyle(ButtonStyle.Danger).setEmoji('❌'),
    new ButtonBuilder().setCustomId('inv_quick_gacha').setLabel('Gacha Sanctum (/gacha)').setStyle(ButtonStyle.Secondary).setEmoji('🔮'),
    new ButtonBuilder().setCustomId('inv_quick_stats').setLabel('Servant Workshop (/servant)').setStyle(ButtonStyle.Secondary).setEmoji('👑'),
    new ButtonBuilder().setCustomId('inv_quick_war').setLabel('Grail War Room (/grailwar)').setStyle(ButtonStyle.Secondary).setEmoji('🏰')
  );

  const components = filterRow
    ? [catRow, filterRow, selectRow, actRow, linkRow]
    : [catRow, selectRow, actRow, linkRow];

  return {
    embed,
    components
  };
}

/**
 * Attaches a stateful component collector to an inventory message reply
 */
export function attachInventoryCollector(interaction: any, master: any, activeServant: any, replyMessage: any) {
  let currentCategory: 'ces' | 'servants' | 'seals' | 'items' = 'ces';
  let currentPage = 1;
  let selectedItemId: string | undefined = activeServant?.equippedCeId;
  let ceViewMode: 'all' | 'owned' = 'all';
  let ceRarityFilter: 'all' | 5 | 4 | 3 | 'bond' = 'all';
  let ceSearchQuery = '';

  const collector = replyMessage.createMessageComponentCollector({
    idle: 180000,
    time: 900000
  });

  collector.on('collect', async (i: any) => {
    try {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ flags: MessageFlags.Ephemeral, content: '❌ This inventory menu belongs to another Master.' });
        return;
      }

      collector.resetTimer();
      const customId = i.customId;
      const ownedCes = (master.craftEssences || []).filter(Boolean);

      // Category Switching
      if (customId === 'inv_cat_ces') {
        currentCategory = 'ces';
        currentPage = 1;
        selectedItemId = activeServant?.equippedCeId;
      } else if (customId === 'inv_cat_servants') {
        currentCategory = 'servants';
        currentPage = 1;
        selectedItemId = master.activeServantId;
      } else if (customId === 'inv_cat_seals') {
        currentCategory = 'seals';
        currentPage = 1;
        selectedItemId = 'cs_evac';
      } else if (customId === 'inv_cat_items') {
        currentCategory = 'items';
        currentPage = 1;
        selectedItemId = 'item_sq';
      }

      // CE View Mode Toggle
      else if (customId === 'inv_toggle_ce_mode') {
        ceViewMode = ceViewMode === 'all' ? 'owned' : 'all';
        currentPage = 1;
      }

      // CE Rarity Filters
      else if (customId === 'inv_filter_ce_5star') {
        ceRarityFilter = ceRarityFilter === 5 ? 'all' : 5;
        currentPage = 1;
      } else if (customId === 'inv_filter_ce_4star') {
        ceRarityFilter = ceRarityFilter === 4 ? 'all' : 4;
        currentPage = 1;
      } else if (customId === 'inv_filter_ce_3star') {
        ceRarityFilter = ceRarityFilter === 3 ? 'all' : 3;
        currentPage = 1;
      } else if (customId === 'inv_filter_ce_bond') {
        ceRarityFilter = ceRarityFilter === 'bond' ? 'all' : 'bond';
        currentPage = 1;
      }

      // Pagination
      else if (customId === 'inv_page_prev') {
        currentPage = Math.max(1, currentPage - 1);
      } else if (customId === 'inv_page_next') {
        currentPage++;
      }

      // Dropdown Selection
      else if (customId === 'inv_select_item') {
        selectedItemId = i.values[0];
      }

      // Action: Equip
      else if (customId === 'inv_act_equip') {
        if (currentCategory === 'ces') {
          if (!selectedItemId || selectedItemId === 'none') {
            if (activeServant) {
              activeServant.equippedCeId = undefined;
              activeServant.equippedCe = undefined;
            }
          } else {
            const picked = ownedCes.find((c: any) => c.id === selectedItemId) || CRAFT_ESSENCE_DATABASE.find(c => c.id === selectedItemId);
            if (picked && activeServant) {
              activeServant.equippedCeId = picked.id;
              activeServant.equippedCe = picked;
            }
          }
          await saveMaster(master);
        } else if (currentCategory === 'servants') {
          if (selectedItemId && master.servants?.some((s: any) => s.id === selectedItemId)) {
            master.activeServantId = selectedItemId;
            activeServant = master.servants.find((s: any) => s.id === selectedItemId) || activeServant;
            await saveMaster(master);
          }
        } else if (currentCategory === 'seals') {
          const war = getOrInitWarSession(master);
          let resMsg = '';
          if (selectedItemId === 'cs_evac') {
            const res = invokeCommandSealInWar(war, interaction.user.id, 'toggle_evac');
            resMsg = res.message;
          } else if (selectedItemId === 'ward_sanctuary') {
            const res = setWorkshopWardInWar(war, interaction.user.id, 'ward');
            resMsg = res.message;
          } else if (selectedItemId === 'ward_decoy') {
            const res = setWorkshopWardInWar(war, interaction.user.id, 'decoy');
            resMsg = res.message;
          } else if (selectedItemId === 'ward_alarm') {
            const chanName = interaction.channel && 'name' in interaction.channel ? `#${(interaction.channel as any).name}` : '#general';
            const res = setChannelTrapInWar(war, interaction.user.id, interaction.user.username, chanName, 'alarm');
            resMsg = res.message;
          } else if (selectedItemId === 'ward_drain') {
            const chanName = interaction.channel && 'name' in interaction.channel ? `#${(interaction.channel as any).name}` : '#general';
            const res = setChannelTrapInWar(war, interaction.user.id, interaction.user.username, chanName, 'drain');
            resMsg = res.message;
          }
          if (resMsg) {
            await i.reply({ flags: MessageFlags.Ephemeral, content: resMsg });
            return;
          }
        }
      }

      // Action: Unequip
      else if (customId === 'inv_act_unequip') {
        if (currentCategory === 'ces' && activeServant) {
          activeServant.equippedCeId = undefined;
          activeServant.equippedCe = undefined;
          selectedItemId = 'none';
          await saveMaster(master);
        }
      }

      // Action: View Artwork
      else if (customId === 'inv_act_view_art') {
        if (currentCategory === 'ces') {
          const targetCeId = (selectedItemId && selectedItemId !== 'none') ? selectedItemId : activeServant?.equippedCeId;
          const ce = ownedCes.find((c: any) => c.id === targetCeId) || CRAFT_ESSENCE_DATABASE.find(c => c.id === targetCeId);
          if (ce) {
            const artUrl = ce.artworkUrl || 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp';
            await i.reply({
              flags: MessageFlags.Ephemeral,
              embeds: [
                new EmbedBuilder()
                  .setTitle(`🖼️ Craft Essence Art: ${ce.name}`)
                  .setDescription(
                    `**Rarity:** ${'★'.repeat(ce.rarity || 5)} (${ce.rarity >= 5 ? 'SSR' : ce.rarity >= 4 ? 'SR' : 'R'})\n` +
                    `**Stats:** \`+${ce.atkBonus || 0} ATK\` | \`+${ce.hpBonus || 0} HP\`\n` +
                    `**Effect:** ${ce.effectText}\n\n` +
                    `*${ce.description || 'A legendary conceptual armament crystallized with heroic memory.'}*`
                  )
                  .setImage(artUrl)
                  .setColor(ce.rarity >= 5 ? 0xd4af37 : 0x38bdf8)
                  .setFooter({ text: 'Craft Essence Visual Archive • Full High-Res Canvas' })
              ]
            });
            return;
          }
        }
      }

      // Action: Inspect
      else if (customId === 'inv_act_inspect') {
        if (currentCategory === 'ces') {
          const targetCeId = (selectedItemId && selectedItemId !== 'none') ? selectedItemId : activeServant?.equippedCeId;
          const ce = ownedCes.find((c: any) => c.id === targetCeId) || CRAFT_ESSENCE_DATABASE.find(c => c.id === targetCeId);
          if (ce) {
            await i.reply({
              flags: MessageFlags.Ephemeral,
              embeds: [
                new EmbedBuilder()
                  .setTitle(`📖 Relic Lore: ${ce.name}`)
                  .setDescription(
                    `**Rarity:** ★${ce.rarity}\n` +
                    `**Effect:** ${ce.effectText}\n` +
                    `**Stats:** +${ce.atkBonus || 0} ATK / +${ce.hpBonus || 0} HP\n\n` +
                    `*${ce.description || 'An ancient conceptual weapon forged from hero memories.'}*`
                  )
                  .setColor(0x38bdf8)
              ]
            });
            return;
          }
        } else if (currentCategory === 'servants') {
          const s = master.servants?.find((srv: any) => srv.id === selectedItemId) || activeServant;
          if (s) {
            await i.reply({
              flags: MessageFlags.Ephemeral,
              embeds: [
                new EmbedBuilder()
                  .setTitle(`⚔️ Servant Dossier: ${s.nickname || s.template?.name}`)
                  .setDescription(
                    `**Class:** ${s.template?.servantClass} | **Status:** ⚖️ Balanced Parity\n` +
                    `**Level:** Lv.${s.level || 1} | **Bond:** Lv.${s.bondLevel || 1}\n` +
                    `**Noble Phantasm:** ${s.template?.noblePhantasm?.name || 'Classified'} [${s.template?.noblePhantasm?.rank || 'A++'}]\n\n` +
                    `*Use \`/servant\` or \`!servant\` to view their full parameter radar card.*`
                  )
                  .setColor(0xd4af37)
              ]
            });
            return;
          }
        } else if (currentCategory === 'seals') {
          await i.reply({
            flags: MessageFlags.Ephemeral,
            embeds: [
              new EmbedBuilder()
                .setTitle(`📜 Command Seal & Bounded Field Codex`)
                .setDescription(
                  `• **Command Seals (3/3):** Absolute magecraft enforcement granting instant teleportation, full servant revival, or supreme Noble Phantasm release.\n` +
                  `• **Mage Sanctuary Ward:** Reduces incoming ambush strike damage by 60%.\n` +
                  `• **Homunculus Decoy:** Sacrifices an artificial homunculus to absorb 100% of an ambush attack.\n` +
                  `• **Alarm Ward:** Instantly alerts you when rival Masters scout or enter your channel.`
                )
                .setColor(0xf59e0b)
            ]
          });
          return;
        } else if (currentCategory === 'items') {
          await i.reply({
            flags: MessageFlags.Ephemeral,
            embeds: [
              new EmbedBuilder()
                .setTitle(`💎 Master Vault & Currency Ledger`)
                .setDescription(
                  `• **Saint Quartz (${master.saintQuartz || 0} SQ):** Prismatic crystallized mana used to invoke Heroic Spirits and Craft Essences in \`/summon\` and \`/cegacha\`.\n` +
                  `• **Holy Grail Shards (${master.grailShards || 1}):** Pieces of the Greater Grail used for Holy Grail Ascension to break level caps beyond Lv.90.\n` +
                  `• **Mana Prisms (${master.manaPrisms || 50}):** Pure magical energy exchangeable at the Da Vinci workshop.`
                )
                .setColor(0x38bdf8)
            ]
          });
          return;
        }
      }

      // Action: Quick Gacha
      else if (customId === 'inv_quick_gacha') {
        const sq = master.saintQuartz || 0;
        await i.reply({
          flags: MessageFlags.Ephemeral,
          embeds: [
            new EmbedBuilder()
              .setTitle('🔮 Greater Grail Invocation Sanctum')
              .setDescription(
                `**Current Balance:** \`${sq} Saint Quartz 💎\`\n\n` +
                `Use \`/gacha\` to open the unified Invocation Sanctum for:\n` +
                `• 🔮 Heroic Spirit Summons & Rate-ups\n` +
                `• 🛡️ Craft Essence Forge (1x / 10x)\n` +
                `• 💎 Claim Daily +30 Saint Quartz!`
              )
              .setColor(0xa855f7)
          ]
        });
        return;
      }

      // Action: Quick Servant Workshop
      else if (customId === 'inv_quick_stats') {
        if (!activeServant) {
          await i.reply({ flags: MessageFlags.Ephemeral, content: '❌ No active Servant contracted. Use `/summon ritual` first.' });
          return;
        }
        const pts = activeServant.availableStatPoints || 0;
        await i.reply({
          flags: MessageFlags.Ephemeral,
          embeds: [
            new EmbedBuilder()
              .setTitle(`👑 Servant Workshop: ${activeServant.nickname || activeServant.template?.name}`)
              .setDescription(
                `**Available Stat Points:** \`${pts} Points\` | **Level:** \`${activeServant.level || 1}/100\`\n\n` +
                `Use \`/servant\` to inspect parameters, allocate stats, hear voice lines, or watch Noble Phantasms!`
              )
              .setColor(0xd4af37)
          ]
        });
        return;
      }

      // Action: Quick Grail War Room
      else if (customId === 'inv_quick_war') {
        await i.reply({
          flags: MessageFlags.Ephemeral,
          embeds: [
            new EmbedBuilder()
              .setTitle('🏰 Holy Grail War Room')
              .setDescription(
                `Open the War Operations Command with \`/grailwar\`:\n` +
                `• 🏆 View the 7-Master Intelligence Board\n` +
                `• 🗺️ Execute Fuyuki City patrols and ambushes\n` +
                `• 🛡️ Configure Bounded Field defenses & alarm wards\n` +
                `• ⛪ Seek Fuyuki Church Sanctuary leylines healing`
              )
              .setColor(0xef4444)
          ]
        });
        return;
      }

      // Action: Quick Combat Arena
      else if (customId === 'inv_quick_duel') {
        await i.reply({
          flags: MessageFlags.Ephemeral,
          embeds: [
            new EmbedBuilder()
              .setTitle('⚔️ Fuyuki Combat Arena & Duels')
              .setDescription(
                `Step into battle with \`/duel\`:\n` +
                `• 🥊 Quick skirmish vs rogue Shadow Servants\n` +
                `• 👥 Challenge rival Masters to turn-based PvP duels\n` +
                `• 📜 Review combat logs and Buster/Arts/Quick battle mechanics!`
              )
              .setColor(0xec4899)
          ]
        });
        return;
      }

      const refreshed = buildInventoryHub(
        master,
        activeServant,
        currentCategory,
        currentPage,
        selectedItemId,
        { ceViewMode, ceRarityFilter, ceSearchQuery }
      );
      await i.update({ embeds: [refreshed.embed], components: refreshed.components });
    } catch (err: any) {
      if (err.code === 10062 || err.code === 40060 || err.message?.includes('Unknown interaction')) return;
      console.error('Error in inventory hub collector:', err);
    }
  });

  return collector;
}

/**
 * Top-level fallback handler for all inventory interactions (buttons and select menus)
 */
export async function handleGlobalInventoryInteraction(interaction: any) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];
    const customId = interaction.customId;
    const ownedCes = (master.craftEssences || []).filter(Boolean);

    // Default category from customId if applicable
    let currentCategory: 'ces' | 'servants' | 'seals' | 'items' = 'ces';
    if (customId === 'inv_cat_servants') currentCategory = 'servants';
    else if (customId === 'inv_cat_seals') currentCategory = 'seals';
    else if (customId === 'inv_cat_items') currentCategory = 'items';

    let selectedItemId: string | undefined = activeServant?.equippedCeId;
    if (interaction.isStringSelectMenu() && interaction.values?.[0]) {
      selectedItemId = interaction.values[0];
    }

    // Handle Quick Gacha
    if (customId === 'inv_quick_gacha') {
      const sq = master.saintQuartz || 0;
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [
          new EmbedBuilder()
            .setTitle('🎲 Gacha Vault Invocation')
            .setDescription(
              `**Current Balance:** \`${sq} Saint Quartz 💎\`\n\n` +
              `Perform invocations using:\n` +
              `• \`/cegacha roll type:single\` — (3 SQ)\n` +
              `• \`/cegacha roll type:multi\` — (30 SQ • Guaranteed 4★+)\n` +
              `• \`/cegacha daily\` — Claim free daily login Saint Quartz!`
            )
            .setColor(0x8b5cf6)
        ]
      });
      return;
    }

    // Handle Quick Stats
    if (customId === 'inv_quick_stats') {
      const pts = activeServant?.availableStatPoints || 0;
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [
          new EmbedBuilder()
            .setTitle(`📊 Parameter Customization: ${activeServant?.nickname || activeServant?.template?.name || 'Servant'}`)
            .setDescription(
              `**Available Stat Points:** \`${pts} Points\`\n\n` +
              `Use the command:\n` +
              `\`\`\`bash\n/customise stats strength:1 endurance:1\n\`\`\`\n` +
              `to allocate stat points!`
            )
            .setColor(0x10b981)
        ]
      });
      return;
    }

    // Handle Inspect
    if (customId === 'inv_act_inspect') {
      const targetCe = ownedCes.find((c: any) => c.id === activeServant?.equippedCeId) || CRAFT_ESSENCE_DATABASE[0];
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [
          new EmbedBuilder()
            .setTitle(`📖 Relic Lore: ${targetCe.name}`)
            .setDescription(
              `**Rarity:** ★${targetCe.rarity}\n` +
              `**Effect:** ${targetCe.effectText}\n` +
              `**Stats:** +${targetCe.atkBonus || 0} ATK / +${targetCe.hpBonus || 0} HP\n\n` +
              `*${targetCe.description || 'An ancient conceptual weapon forged from hero memories.'}*`
            )
            .setColor(0x38bdf8)
        ]
      });
      return;
    }

    // Handle Equip
    if (customId === 'inv_act_equip') {
      if (ownedCes.length > 0 && activeServant) {
        activeServant.equippedCeId = ownedCes[0].id;
        activeServant.equippedCe = ownedCes[0];
        await saveMaster(master);
      }
    }

    // Handle Unequip
    if (customId === 'inv_act_unequip') {
      if (activeServant) {
        activeServant.equippedCeId = undefined;
        activeServant.equippedCe = undefined;
        await saveMaster(master);
      }
    }

    const { embed, components } = buildInventoryHub(master, activeServant, currentCategory, 1, selectedItemId);
    await interaction.update({ embeds: [embed], components });
  } catch (err: any) {
    if (err.code === 10062 || err.code === 40060 || err.message?.includes('Unknown interaction')) return;
    console.error('Error in global inventory interaction:', err);
  }
}

// ==========================================
// 1. SLASH COMMAND DEFINITION WITH SUBCOMMANDS
// ==========================================
// Provides 4 specialized subcommands:
// - `/customise stats`: Allocate earned parameter points into STR, END, AGI, MNA, LCK
// - `/customise equip`: Attach/swap Craft Essences to boost combat passives
// - `/customise quote`: Overwrite standard Fate voice lines with custom dialogue
// - `/customise nickname`: Set a custom name for the Servant
export const data = new SlashCommandBuilder()
  .setName('customise')
  .setDescription('Customize your active Servant parameters, Craft Essence, and dialogue lines')
  .addSubcommand(sub =>
    sub
      .setName('stats')
      .setDescription('Allocate available parameter points to your Servant')
      .addIntegerOption(opt => opt.setName('strength').setDescription('Points for STR (ATK/Buster)').setRequired(false))
      .addIntegerOption(opt => opt.setName('endurance').setDescription('Points for END (HP/DEF)').setRequired(false))
      .addIntegerOption(opt => opt.setName('agility').setDescription('Points for AGI (Speed/Quick)').setRequired(false))
      .addIntegerOption(opt => opt.setName('mana').setDescription('Points for MNA (NP/Arts)').setRequired(false))
      .addIntegerOption(opt => opt.setName('luck').setDescription('Points for LCK (Crits)').setRequired(false))
  )
  .addSubcommand(sub =>
    sub
      .setName('equip')
      .setDescription('Equip a Craft Essence from your inventory')
      .addStringOption(opt =>
        opt
          .setName('craft_essence')
          .setDescription('Select Craft Essence to equip')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('quote')
      .setDescription('Set custom dialogue lines for your Servant')
      .addStringOption(opt =>
        opt
          .setName('type')
          .setDescription('Dialogue trigger')
          .setRequired(true)
          .addChoices(
            { name: 'Summon Quote', value: 'summon' },
            { name: 'Battle Start', value: 'battleStart' },
            { name: 'Noble Phantasm Chant', value: 'noblePhantasm' },
            { name: 'Skill Activation', value: 'skill' },
            { name: 'Command Seal Invocation', value: 'commandSeal' },
            { name: 'Critical Strike', value: 'critHit' },
            { name: 'Buster Brave Chain (3x Buster)', value: 'busterChain' },
            { name: 'Arts Mana Chain (3x Arts)', value: 'artsChain' },
            { name: 'Quick Star Chain (3x Quick)', value: 'quickChain' },
            { name: 'Victory Quote', value: 'victory' },
            { name: 'Defeat Quote', value: 'defeat' }
          )
      )
      .addStringOption(opt =>
        opt
          .setName('text')
          .setDescription('New custom dialogue text')
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt
          .setName('servant')
          .setDescription('Servant name (defaults to your active Servant)')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('faceoff')
      .setDescription('Set custom face-off clash dialogue against a specific rival Servant')
      .addStringOption(opt =>
        opt
          .setName('rival')
          .setDescription('Rival Servant name or ID (e.g. artoria, gilgamesh, aoko, emiya, scathach)')
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt
          .setName('intro')
          .setDescription('Custom opening clash line when engaging this rival')
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt
          .setName('retort')
          .setDescription('Custom retort line when challenged by this rival (optional)')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('tag')
          .setDescription('Custom clash tag title (e.g. DESTINED CLASH, KINGS SUMMIT)')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('servant')
          .setDescription('Servant name (defaults to your active Servant)')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('nickname')
      .setDescription('Set a custom nickname for your Servant')
      .addStringOption(opt =>
        opt
          .setName('name')
          .setDescription('New nickname')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('feed')
      .setDescription('Feed Craft Essences to your Servant for EXP and +10 Stat Points per level!')
      .addStringOption(opt =>
        opt
          .setName('craft_essence')
          .setDescription('Craft Essence name, "all_3star", "duplicates", or "all"')
          .setRequired(false)
      )
  );

// ==========================================
// 2. MAIN EXECUTE HANDLER
// ==========================================
export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);

    // Validation: Player must have at least 1 Servant
    if (!master.servants || master.servants.length === 0) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: '❌ You must summon a Servant using `/summon` before you can customize them!'
      });
      return;
    }

    const activeServant =
      master.servants.find((s: any) => s.id === master.activeServantId) || master.servants[0];

    const sAny = activeServant as any;
    const sTemplate = sAny.template || sAny;
    const servantName = sAny.nickname || sTemplate.name || sAny.name || 'Heroic Spirit';
    const baseStats = sTemplate.baseStats || { strength: 10, endurance: 10, agility: 10, mana: 10, luck: 10 };

    const subcommand = interaction.options.getSubcommand();

    // ==========================================
    // SUBCOMMAND A: STAT POINT ALLOCATION
    // ==========================================
    if (subcommand === 'stats') {
      const str = interaction.options.getInteger('strength') || 0;
      const end = interaction.options.getInteger('endurance') || 0;
      const agi = interaction.options.getInteger('agility') || 0;
      const mna = interaction.options.getInteger('mana') || 0;
      const lck = interaction.options.getInteger('luck') || 0;

      const totalRequested = str + end + agi + mna + lck;

      // If no points passed, display the current allocation overview and instructions
      if (totalRequested <= 0) {
        const embed = new EmbedBuilder()
          .setTitle(`📊 Parameter Allocation: ${servantName}`)
          .setDescription(
            `Available Stat Points: **${activeServant.availableStatPoints || 0} pts**\n\n` +
            `**Current Allocated:**\n` +
            `• **STR:** +${activeServant.allocatedStats?.strength || 0}\n` +
            `• **END:** +${activeServant.allocatedStats?.endurance || 0}\n` +
            `• **AGI:** +${activeServant.allocatedStats?.agility || 0}\n` +
            `• **MNA:** +${activeServant.allocatedStats?.mana || 0}\n` +
            `• **LCK:** +${activeServant.allocatedStats?.luck || 0}\n\n` +
            `*To allocate points, use:*\n\`/customise stats strength:2 endurance:2 mana:1\``
          )
          .setColor(0xd4af37);

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Check if player has enough unused points
      if (totalRequested > (activeServant.availableStatPoints || 0)) {
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: `❌ Cannot allocate **${totalRequested} pts**. You only have **${activeServant.availableStatPoints || 0} available stat points** on ${servantName}.`
        });
        return;
      }

      if (!activeServant.allocatedStats) {
        activeServant.allocatedStats = { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 };
      }

      // Apply points
      activeServant.allocatedStats.strength = (activeServant.allocatedStats.strength || 0) + str;
      activeServant.allocatedStats.endurance = (activeServant.allocatedStats.endurance || 0) + end;
      activeServant.allocatedStats.agility = (activeServant.allocatedStats.agility || 0) + agi;
      activeServant.allocatedStats.mana = (activeServant.allocatedStats.mana || 0) + mna;
      activeServant.allocatedStats.luck = (activeServant.allocatedStats.luck || 0) + lck;
      activeServant.availableStatPoints -= totalRequested;

      await saveMaster(master);

      const embed = new EmbedBuilder()
        .setTitle('✅ Parameters Allocated Successfully!')
        .setDescription(
          `Allocated **${totalRequested} points** to **${servantName}**:\n` +
          (str ? `• STR: +${str}\n` : '') +
          (end ? `• END: +${end}\n` : '') +
          (agi ? `• AGI: +${agi}\n` : '') +
          (mna ? `• MNA: +${mna}\n` : '') +
          (lck ? `• LCK: +${lck}\n` : '') +
          `\nRemaining Available Points: **${activeServant.availableStatPoints} pts**`
        )
        .setColor(0x22c55e);

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    // ==========================================
    // SUBCOMMAND B: EQUIP CRAFT ESSENCE
    // ==========================================
    if (subcommand === 'equip') {
      const ceNameParam = interaction.options.getString('craft_essence');

      // Check unequip
      if (ceNameParam && (ceNameParam.toLowerCase() === 'none' || ceNameParam.toLowerCase() === 'unequip')) {
        activeServant.equippedCeId = undefined;
        activeServant.equippedCe = undefined;
        await saveMaster(master);

        const embed = new EmbedBuilder()
          .setTitle('🛡️ Craft Essence Unequipped')
          .setDescription(`Removed Craft Essence from **${servantName}**.`)
          .setColor(0x94a3b8);

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Check if master owns any CEs
      const ownedCes = (master.craftEssences || []).filter(Boolean);

      // Direct text search
      if (ceNameParam) {
        const found = ownedCes.find(
          (c: any) => c.name.toLowerCase().includes(ceNameParam.toLowerCase()) || c.id === ceNameParam
        );

        if (!found) {
          const dbFound = CRAFT_ESSENCE_DATABASE.find(
            (c: any) => c.name.toLowerCase().includes(ceNameParam.toLowerCase()) || c.id === ceNameParam
          );

          if (dbFound) {
            await interaction.reply({
              flags: MessageFlags.Ephemeral,
              content: `❌ You do not own **${dbFound.name}** in your inventory! Roll in \`/cegacha\` using Saint Quartz 💎.`
            });
          } else {
            await interaction.reply({
              flags: MessageFlags.Ephemeral,
              content: `❌ Item "${ceNameParam}" not found in database or inventory.`
            });
          }
          return;
        }

        activeServant.equippedCeId = found.id;
        activeServant.equippedCe = found;
        await saveMaster(master);

        const embed = new EmbedBuilder()
          .setTitle('🛡️ Craft Essence Equipped!')
          .setDescription(
            `Equipped **${found.name}** (★${found.rarity}) to **${servantName}**!\n\n` +
            `**Effect:** ${found.effectText}\n` +
            `**Bonus:** +${found.atkBonus || 0} ATK, +${found.hpBonus || 0} HP`
          )
          .setColor(0x38bdf8);

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Render Full Interactive Inventory Hub
      const { embed, components } = buildInventoryHub(master, activeServant, 'ces', 1, activeServant.equippedCeId);
      await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
      const reply = await interaction.fetchReply();
      attachInventoryCollector(interaction, master, activeServant, reply);
      return;
    }

    // ==========================================
    // SUBCOMMAND C: CUSTOM QUOTES
    // ==========================================
    if (subcommand === 'quote') {
      const type = interaction.options.getString('type', true);
      const text = interaction.options.getString('text', true);
      const targetQuery = interaction.options.getString('servant')?.trim().toLowerCase();

      let targetServant = activeServant;
      if (targetQuery) {
        const found = master.servants.find((s: any) =>
          s.template?.name?.toLowerCase().includes(targetQuery) ||
          s.nickname?.toLowerCase().includes(targetQuery) ||
          s.id.toLowerCase() === targetQuery ||
          s.templateId?.toLowerCase() === targetQuery
        );
        if (found) {
          targetServant = found;
        }
      }

      if (!targetServant.customQuotes) {
        targetServant.customQuotes = {};
      }

      // Overwrite the specific voice line
      (targetServant.customQuotes as any)[type] = text;
      await saveMaster(master);

      const targetName = targetServant.nickname || targetServant.template?.name || 'Servant';
      const labelMap: Record<string, string> = {
        summon: 'Summon Quote',
        battleStart: 'Battle Start Quote',
        noblePhantasm: 'Noble Phantasm Chant',
        skill: 'Skill Activation Quote',
        commandSeal: 'Command Seal Invocation Quote',
        critHit: 'Critical Strike Quote',
        busterChain: 'Buster Brave Chain (3x Buster)',
        artsChain: 'Arts Mana Chain (3x Arts)',
        quickChain: 'Quick Star Chain (3x Quick)',
        victory: 'Victory Quote',
        defeat: 'Defeat Quote'
      };

      const embed = new EmbedBuilder()
        .setTitle('💬 Custom Dialogue Saved!')
        .setDescription(
          `Updated **${labelMap[type] || type}** for **${targetName}**:\n\n` +
          `🗣️ *" ${text} "*\n\n` +
          `✨ *This custom dialogue will trigger dynamically during battles, visual novel cut-ins, and dialogue inspects!*`
        )
        .setColor(0x22c55e)
        .setFooter({ text: `Contracted to Master ${master.username} • Use /dialogue or /duel to hear it live!` });

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    // ==========================================
    // SUBCOMMAND C2: CUSTOM RIVAL FACE-OFF DIALOGUE
    // ==========================================
    if (subcommand === 'faceoff' || subcommand === 'matchup') {
      const rivalQuery = interaction.options.getString('rival', true).trim().toLowerCase();
      const intro = interaction.options.getString('intro', true).trim();
      const retort = interaction.options.getString('retort', false)?.trim();
      const tag = interaction.options.getString('tag', false)?.trim();
      const servantQuery = interaction.options.getString('servant', false);

      let targetServant = activeServant;
      if (servantQuery) {
        const query = servantQuery.toLowerCase();
        const found = master.servants.find((s: any) =>
          (s.nickname && s.nickname.toLowerCase().includes(query)) ||
          s.template?.name?.toLowerCase().includes(query) ||
          s.name?.toLowerCase().includes(query) ||
          s.id.toLowerCase() === query ||
          s.templateId?.toLowerCase() === query
        );
        if (found) targetServant = found;
      }

      // Look up target rival in servant database
      const matchedRival = SERVANT_DATABASE.find(s =>
        s.id.toLowerCase() === rivalQuery ||
        s.name.toLowerCase().includes(rivalQuery) ||
        s.servantClass.toLowerCase() === rivalQuery ||
        (s.aliases && s.aliases.some((a: string) => a.toLowerCase().includes(rivalQuery)))
      ) || SERVANT_DATABASE[0];

      if (!targetServant.customQuotes) {
        targetServant.customQuotes = {};
      }
      if (!targetServant.customQuotes.matchups) {
        targetServant.customQuotes.matchups = {};
      }

      // Save custom matchup record
      targetServant.customQuotes.matchups[matchedRival.id] = {
        intro,
        ...(retort ? { retort } : {}),
        ...(tag ? { tag } : {})
      };

      master.servants = master.servants.map((s: any) => s.id === targetServant.id ? targetServant : s);
      await saveMaster(master);

      const targetName = targetServant.nickname || targetServant.template?.name || 'Servant';
      const clashTagTitle = tag || 'FATEFUL RIVALRY';

      const embed = new EmbedBuilder()
        .setTitle(`⚔️ Rival Face-Off Dialogue Registered!`)
        .setDescription(
          `Configured custom clash banter for **${targetName}** vs **${matchedRival.name}** [${matchedRival.servantClass}]!\n\n` +
          `🏷️ **Clash Tag:** \`${clashTagTitle}\`\n\n` +
          `🔥 **Challenger Opening (${targetName}):**\n` +
          `*" ${intro} "*\n\n` +
          (retort ? `🛡️ **Defender Counter-Retort (${matchedRival.name}):**\n*" ${retort} "*\n\n` : '') +
          `✨ *When duel arena battles begin or visual novel cut-ins engage against ${matchedRival.name}, this dedicated face-off dialogue will trigger automatically!*`
        )
        .setColor(0xd4af37)
        .setFooter({ text: `Contracted to Master ${master.username} • Use /duel to challenge rival spirits!` });

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    // ==========================================
    // SUBCOMMAND D: NICKNAME
    // ==========================================
    if (subcommand === 'nickname') {
      const name = interaction.options.getString('name', true);
      activeServant.nickname = name;
      await saveMaster(master);

      await interaction.reply({
        content: `✨ Servant nickname updated to **${name}**!`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // ==========================================
    // SUBCOMMAND E: FEED CRAFT ESSENCES FOR EXP & STAT POINTS
    // ==========================================
    if (subcommand === 'feed') {
      const ownedCes = (master.craftEssences || []).filter(Boolean);
      if (ownedCes.length === 0) {
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: '❌ You have no Craft Essences in your inventory to feed! Summon more in `/cegacha` using Saint Quartz 💎.'
        });
        return;
      }

      const query = interaction.options.getString('craft_essence')?.trim();

      // If no query passed, show feed status & guidance
      if (!query) {
        const currentExp = activeServant.experience ?? getTotalExpForLevel(activeServant.level || 1);
        const expStatus = calculateLevelFromExp(currentExp);

        const ceSummary = ownedCes.slice(0, 8).map((ce: any, idx: number) => {
          const exp = getCeExpValue(ce);
          const star = '★'.repeat(ce.rarity || 3);
          const isEq = activeServant.equippedCeId === ce.id ? ' `[EQUIPPED]`' : '';
          return `\`#${idx + 1}\` **${ce.name}** [${star}] — **+${exp.toLocaleString()} EXP**${isEq}`;
        }).join('\n');

        const embed = new EmbedBuilder()
          .setTitle(`✨ Spirit Origin Enhancement: ${servantName}`)
          .setDescription(
            `Feed Craft Essences into **${servantName}**'s Saint Graph to grant massive Spirit EXP.\n` +
            `⭐ **Leveling Rule:** Every Level Up awards **+10 Available Stat Points**!\n\n` +
            `📊 **Current Status:**\n` +
            `• **Level:** \`Lv. ${activeServant.level || 1} / 100\`\n` +
            `• **Total EXP:** \`${currentExp.toLocaleString()} EXP\`\n` +
            `• **Next Level:** \`${expStatus.currentLevelExp.toLocaleString()} / ${expStatus.nextLevelExp.toLocaleString()} EXP\` (${expStatus.progressPercent}%)\n` +
            `• **Unspent Stat Points:** \`${activeServant.availableStatPoints || 0} pts\`\n\n` +
            `📦 **Inventory Essences (${ownedCes.length} total):**\n` +
            `${ceSummary}\n\n` +
            `*Quick Commands to Feed:*\n` +
            `• \`/customise feed craft_essence:all_3star\` — Feed all 3★ Essences\n` +
            `• \`/customise feed craft_essence:duplicates\` — Feed all duplicate copies\n` +
            `• \`/customise feed craft_essence:<name>\` — Feed a specific Essence\n` +
            `• Or use \`/feed\` for an interactive selection dropdown!`
          )
          .setColor(0xd4af37);

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      let targetsToFeed: string[] = [];
      const lowQuery = query.toLowerCase();

      if (lowQuery === 'all_3star' || lowQuery === '3star' || lowQuery === '3*') {
        targetsToFeed = ownedCes
          .map((c: any, idx: number) => (c && (c.rarity || 3) <= 3 ? String(idx) : null))
          .filter(Boolean) as string[];
      } else if (lowQuery === 'duplicates' || lowQuery === 'dupes') {
        const nameCounts = new Map<string, number>();
        ownedCes.forEach((c: any) => {
          if (c) nameCounts.set(c.name, (nameCounts.get(c.name) || 0) + 1);
        });
        const seen = new Set<string>();
        targetsToFeed = ownedCes
          .map((c: any, idx: number) => {
            if (!c || (c.rarity || 3) >= 5) return null; // Protect 5-stars
            if ((nameCounts.get(c.name) || 0) > 1) {
              if (seen.has(c.name)) return String(idx);
              seen.add(c.name);
            }
            return null;
          })
          .filter(Boolean) as string[];
      } else if (lowQuery === 'all') {
        targetsToFeed = ownedCes.map((_: any, idx: number) => String(idx));
      } else {
        const matchIdx = ownedCes.findIndex(
          (c: any) => c.name?.toLowerCase().includes(lowQuery) || c.id === query
        );
        if (matchIdx !== -1) {
          targetsToFeed = [String(matchIdx)];
        }
      }

      if (targetsToFeed.length === 0) {
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
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
        .setTitle(`✨ Spirit Origin Enhancement: ${servantName}`)
        .setDescription(
          `Synthesized **${result.fedEssences.length} Craft Essence(s)** into **${servantName}**!\n\n` +
          `🔮 **EXP Gained:** \`+${result.expGained.toLocaleString()} EXP\`\n` +
          `${lvlMsg}\n\n` +
          `**Consolidated Essences:**\n${fedList}${result.fedEssences.length > 8 ? `\n*...and ${result.fedEssences.length - 8} more*` : ''}\n\n` +
          `*To allocate your newly gained stat points, use:*\n\`/customise stats strength:5 endurance:5\``
        )
        .setColor(result.levelsGained > 0 ? 0x22c55e : 0x38bdf8);

      await interaction.reply({ embeds: [embed] });
      return;
    }

  } catch (error: any) {
    console.error('Error executing /customise:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: `❌ Error: ${error.message}`, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: `❌ Error: ${error.message}`, flags: MessageFlags.Ephemeral });
    }
  }
}
