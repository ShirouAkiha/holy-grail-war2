import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { CRAFT_ESSENCE_DATABASE } from '../data/craftEssences';

// ==========================================
// 0. INTERACTIVE INVENTORY HUB BUILDER & HANDLERS
// ==========================================
export function buildInventoryHub(
  master: any,
  activeServant: any,
  category: 'ces' | 'servants' | 'seals' | 'items' = 'ces',
  page: number = 1,
  selectedItemId?: string
) {
  const ownedCes = (master.craftEssences || []).filter(Boolean);
  const ownedServants = master.servants || [];
  const servantName = activeServant?.nickname || activeServant?.template?.name || 'Heroic Spirit';

  let title = `👔 ${master.username}'s Inventory — Craft Essences`;
  let equippedBanner = '';
  let itemLines: string[] = [];
  let selectOptions: any[] = [];
  let totalItems = 0;
  const itemsPerPage = 8;

  if (category === 'ces') {
    title = `🛡️ ${master.username}'s Inventory — Craft Essences`;
    const activeCeName = activeServant?.equippedCe?.name;
    equippedBanner = activeCeName
      ? `✅ Equipped **${activeCeName}** (★${activeServant.equippedCe?.rarity || 5}).`
      : `⚠️ **No Craft Essence equipped.** Select an item below and press **Equip**.`;

    const ceCounts = new Map<string, { ce: any; count: number }>();
    for (const c of ownedCes) {
      if (!c || !c.id) continue;
      if (!ceCounts.has(c.id)) ceCounts.set(c.id, { ce: c, count: 1 });
      else ceCounts.get(c.id)!.count++;
    }

    const uniqueCes = Array.from(ceCounts.values());
    totalItems = uniqueCes.length;

    if (uniqueCes.length === 0) {
      itemLines = ['• *No Craft Essences in inventory. Roll in `/cegacha` using Saint Quartz!*'];
    } else {
      const startIndex = (page - 1) * itemsPerPage;
      const paginated = uniqueCes.slice(startIndex, startIndex + itemsPerPage);

      itemLines = paginated.map(({ ce, count }) => {
        const isEq = activeServant?.equippedCeId === ce.id;
        const rarityTag = ce.rarity >= 5 ? '★5 Legendary' : ce.rarity >= 4 ? '★4 Rare' : '★3 Common';
        const rankTag = ce.rarity >= 5 ? 'S Rank' : ce.rarity >= 4 ? 'A Rank' : 'B Rank';
        const eqBadge = isEq ? ' **[EQUIPPED]**' : '';
        const arrow = (selectedItemId && selectedItemId === ce.id) ? '➡️ ' : '• ';
        return `${arrow}**${rarityTag}** — **${ce.name}** ×${count} — ${rankTag}${eqBadge}`;
      });
    }

    selectOptions = [
      { label: 'Unequip Current Essence', value: 'none', description: 'Remove active Craft Essence' },
      ...uniqueCes.map(({ ce, count }) => ({
        label: `${ce.rarity >= 5 ? '★5' : ce.rarity >= 4 ? '★4' : '★3'} ${ce.name}${count > 1 ? ` (x${count})` : ''}`,
        value: ce.id,
        description: (ce.effectText || 'Craft Essence').slice(0, 48),
        default: selectedItemId === ce.id
      }))
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
      const sRar = s.template?.rarity || 5;
      const isAct = master.activeServantId === s.id;
      const rarTag = sRar >= 5 ? '★5 SSR' : sRar >= 4 ? '★4 SR' : '★3 R';
      const actBadge = isAct ? ' **[ACTIVE CONTRACT]**' : '';
      const arrow = (selectedItemId && selectedItemId === s.id) ? '➡️ ' : '• ';
      return `${arrow}**${rarTag}** — **${sN}** — Lv.${s.level || 1} (${sCls})${actBadge}`;
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
    equippedBanner = `✅ Current Balance: **${master.saintQuartz || 0} Saint Quartz 💎**`;

    itemLines = [
      `• **Mythic** — **Saint Quartz** ×${master.saintQuartz || 0} — EX Rank [GACHA SUMMON CURRENCY]`,
      `• **Legendary** — **Holy Grail Shards** ×${master.grailShards || 1} — S Rank [ASCENSION CATALYST]`,
      `• **Rare** — **Mana Prisms** ×${master.manaPrisms || 50} — A Rank [DA VINCI WORKSHOP]`
    ];
    totalItems = 3;

    selectOptions = [
      { label: `Saint Quartz (x${master.saintQuartz || 0})`, value: 'item_sq', description: 'Summon Heroic Spirits and Craft Essences', default: selectedItemId === 'item_sq' },
      { label: `Holy Grail Shard (x${master.grailShards || 1})`, value: 'item_grail', description: 'Break Servant Level Caps beyond 90', default: selectedItemId === 'item_grail' },
      { label: `Mana Prism (x${master.manaPrisms || 50})`, value: 'item_prism', description: 'Exchange for Fous and Tickets', default: selectedItemId === 'item_prism' }
    ];
  }

  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const currentPage = Math.min(Math.max(page, 1), totalPages);

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(`${equippedBanner}\n\n` + itemLines.join('\n'))
    .setColor(0x38bdf8)
    .setFooter({ text: `Page ${currentPage}/${totalPages} • Select an item below, then press Equip or Read.` });

  // Row 1: Categories
  const catRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('inv_cat_ces').setLabel('Craft Essences').setStyle(category === 'ces' ? ButtonStyle.Primary : ButtonStyle.Secondary).setEmoji('🛡️'),
    new ButtonBuilder().setCustomId('inv_cat_servants').setLabel('Servants').setStyle(category === 'servants' ? ButtonStyle.Primary : ButtonStyle.Secondary).setEmoji('⚔️'),
    new ButtonBuilder().setCustomId('inv_cat_seals').setLabel('Seals & Wards').setStyle(category === 'seals' ? ButtonStyle.Primary : ButtonStyle.Secondary).setEmoji('📜'),
    new ButtonBuilder().setCustomId('inv_cat_items').setLabel('Vault & Currency').setStyle(category === 'items' ? ButtonStyle.Primary : ButtonStyle.Secondary).setEmoji('💎')
  );

  // Row 2: Select Menu
  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('inv_select_item')
      .setPlaceholder('Select an item from inventory...')
      .addOptions(selectOptions.length > 0 ? selectOptions.slice(0, 25) : [{ label: 'No items', value: 'none' }])
  );

  // Row 3: Action Buttons
  const actRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('inv_page_prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setEmoji('◀️').setDisabled(currentPage <= 1),
    new ButtonBuilder().setCustomId('inv_page_next').setLabel('Next').setStyle(ButtonStyle.Secondary).setEmoji('▶️').setDisabled(currentPage >= totalPages),
    new ButtonBuilder().setCustomId('inv_act_equip').setLabel('Equip / Set Active').setStyle(ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId('inv_act_inspect').setLabel('Inspect / Read Lore').setStyle(ButtonStyle.Primary).setEmoji('📖'),
    new ButtonBuilder().setCustomId('inv_act_unequip').setLabel('Unequip').setStyle(ButtonStyle.Danger).setEmoji('❌')
  );

  // Row 4: Quick Links
  const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('inv_quick_gacha').setLabel('Gacha Vault (/cegacha)').setStyle(ButtonStyle.Secondary).setEmoji('🎲'),
    new ButtonBuilder().setCustomId('inv_quick_stats').setLabel('Allocate Stats (/customise stats)').setStyle(ButtonStyle.Secondary).setEmoji('📊')
  );

  return {
    embed,
    components: [catRow, selectRow, actRow, linkRow]
  };
}

/**
 * Attaches a stateful component collector to an inventory message reply
 */
export function attachInventoryCollector(interaction: any, master: any, activeServant: any, replyMessage: any) {
  let currentCategory: 'ces' | 'servants' | 'seals' | 'items' = 'ces';
  let currentPage = 1;
  let selectedItemId: string | undefined = activeServant?.equippedCeId;

  const collector = replyMessage.createMessageComponentCollector({
    idle: 180000,
    time: 900000
  });

  collector.on('collect', async (i: any) => {
    try {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ ephemeral: true, content: '❌ This inventory menu belongs to another Master.' });
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

      // Action: Inspect
      else if (customId === 'inv_act_inspect') {
        if (currentCategory === 'ces') {
          const targetCeId = (selectedItemId && selectedItemId !== 'none') ? selectedItemId : activeServant?.equippedCeId;
          const ce = ownedCes.find((c: any) => c.id === targetCeId) || CRAFT_ESSENCE_DATABASE.find(c => c.id === targetCeId);
          if (ce) {
            await i.reply({
              ephemeral: true,
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
              ephemeral: true,
              embeds: [
                new EmbedBuilder()
                  .setTitle(`⚔️ Servant Dossier: ${s.nickname || s.template?.name}`)
                  .setDescription(
                    `**Class:** ${s.template?.servantClass} | **Rarity:** ★${s.template?.rarity || 5}\n` +
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
            ephemeral: true,
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
            ephemeral: true,
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
          ephemeral: true,
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

      // Action: Quick Stats
      else if (customId === 'inv_quick_stats') {
        if (!activeServant) {
          await i.reply({ ephemeral: true, content: '❌ No active Servant contracted.' });
          return;
        }
        const pts = activeServant.availableStatPoints || 0;
        await i.reply({
          ephemeral: true,
          embeds: [
            new EmbedBuilder()
              .setTitle(`📊 Parameter Customization: ${activeServant.nickname || activeServant.template?.name}`)
              .setDescription(
                `**Available Stat Points:** \`${pts} Points\`\n\n` +
                `Use the slash command:\n` +
                `\`\`\`bash\n/customise stats strength:1 endurance:1 agility:1 mana:1 luck:1\n\`\`\`\n` +
                `to allocate earned parameter points directly into your Servant's combat matrix!`
              )
              .setColor(0x10b981)
          ]
        });
        return;
      }

      const refreshed = buildInventoryHub(master, activeServant, currentCategory, currentPage, selectedItemId);
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
        ephemeral: true,
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
        ephemeral: true,
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
        ephemeral: true,
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
      .setName('nickname')
      .setDescription('Set a custom nickname for your Servant')
      .addStringOption(opt =>
        opt
          .setName('name')
          .setDescription('New nickname')
          .setRequired(true)
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
        ephemeral: true,
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

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if player has enough unused points
      if (totalRequested > (activeServant.availableStatPoints || 0)) {
        await interaction.reply({
          ephemeral: true,
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

      await interaction.reply({ embeds: [embed], ephemeral: true });
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

        await interaction.reply({ embeds: [embed], ephemeral: true });
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
              ephemeral: true,
              content: `❌ You do not own **${dbFound.name}** in your inventory! Roll in \`/cegacha\` using Saint Quartz 💎.`
            });
          } else {
            await interaction.reply({
              ephemeral: true,
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

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Render Full Interactive Inventory Hub
      const { embed, components } = buildInventoryHub(master, activeServant, 'ces', 1, activeServant.equippedCeId);
      const reply = await interaction.reply({ embeds: [embed], components, ephemeral: true, fetchReply: true });
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

      await interaction.reply({ embeds: [embed], ephemeral: true });
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
        ephemeral: true
      });
      return;
    }

  } catch (error: any) {
    console.error('Error executing /customise:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: `❌ Error: ${error.message}`, ephemeral: true });
    } else {
      await interaction.reply({ content: `❌ Error: ${error.message}`, ephemeral: true });
    }
  }
}
