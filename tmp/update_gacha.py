import os

with open("src/commands/gacha.ts", "r", encoding="utf-8") as f:
    content = f.read()

marker = "export function attachGachaCollector("
cut_pos = content.find(marker)
if cut_pos == -1:
    print("Error: marker not found!")
    exit(1)

top_part = content[:cut_pos]

new_code = '''export function attachGachaCollector(
  _interaction?: any,
  _initialMaster?: any,
  _replyMessage?: any,
  _initialCategory?: 'servants' | 'ces' | 'shop' | 'daily' | 'rates',
  _initialBanner?: string
) {
  // Global interaction handler (handleGlobalGachaInteraction) dynamically handles all components universally
}

export async function handleGlobalGachaInteraction(interaction: any): Promise<boolean> {
  const customId = interaction.customId;
  if (!customId) return false;

  const isGachaBtn = 
    customId.startsWith('gacha_') || 
    customId.startsWith('quick_ce_gacha_') || 
    customId.startsWith('cegacha_btn_') ||
    customId === 'btn_view_inventory' ||
    customId === 'ce_btn_inventory' ||
    customId === 'btn_view_servant' ||
    customId === 'btn_enter_war';

  if (!isGachaBtn) return false;

  try {
    let master = await getOrCreateMaster(interaction.user.id, interaction.user.username);

    // 1. 10x Multi-Summon (5 Servants + 5 CEs)
    if (customId === 'gacha_act_multi' || customId === 'quick_ce_gacha_ten' || customId === 'cegacha_btn_pull10') {
      if ((master.saintQuartz || 0) < 30) {
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: `❌ Insufficient Saint Quartz! You need **30 SQ 💎** for a 10x Multi-Summon, but currently have **${master.saintQuartz || 0} SQ**.\\nUse \\`/daily\\` or click **Daily & Vault** to claim **+30 SQ**!`
        });
        return true;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const rollResult = executeUnifiedGachaRoll({ count: 10, master });
      master = rollResult.updatedMaster;
      await saveMaster(master);

      const servantList = rollResult.results.filter(r => r.type === 'servant');
      const ceList = rollResult.results.filter(r => r.type === 'craft_essence');

      const servantSummary = servantList.map((r, idx) => {
        const s = (r.servant || r.item) as any;
        const statusTag = r.isNew ? '🌟 **[NEW!]**' : '🔵 *(+50 Prisms)*';
        return `${idx + 1}. **${s.name}** (\\`${s.servantClass}\\`) ${statusTag}`;
      }).join('\\n');

      const ceSummary = ceList.map((r, idx) => {
        const c = r.item as any;
        const statusTag = r.isNew ? '🌟 **[NEW!]**' : '';
        const stars = '★'.repeat(r.rarity || c.rarity || 3);
        return `${idx + 1}. **[${stars}] ${c.name}** ${statusTag} — *${(c.effectText || c.description || '').slice(0, 36)}...*`;
      }).join('\\n');

      const embed = new EmbedBuilder()
        .setTitle('👑 10x Greater Grail Unified Multi-Summon Results!')
        .setDescription(
          `**Chaldea Summoning Gate Opened (5 Servants + 5 Craft Essences):**\\n\\n` +
          `⚔️ **Heroic Spirits Manifested (5x):**\\n` +
          servantSummary +
          `\\n\\n` +
          `🛡️ **Craft Essences Forged (5x):**\\n` +
          ceSummary +
          `\\n\\n` +
          `═══════════════════════════════════════════════\\n` +
          `🌟 **New Servants Contracted:** **+${rollResult.newServantsCount}**\\n` +
          `🛡️ **SSR / SR Relics Forged:** **${rollResult.ssrsPulled}x ★5 SSR**, **${rollResult.srsPulled}x ★4 SR**\\n` +
          `🔵 **Mana Prisms Earned (Duplicates):** **+${rollResult.totalManaPrismsAwarded} 🔵**\\n` +
          `💎 **Remaining Saint Quartz:** \\`${master.saintQuartz} SQ\\` | 🔵 **Total Prisms:** \\`${master.manaPrisms || 0}\\`\\n\\n` +
          `Use \\`/servant\\` to inspect your companions, or \\`/inventory\\` to equip Mystic Codes!`
        )
        .setColor(rollResult.ssrsPulled > 0 ? 0xf59e0b : 0xeab308)
        .setFooter({ text: 'Greater Grail Unified Altar • 50% Servants / 50% CEs (1% 5★ CE Rate)' });

      let files: AttachmentBuilder[] = [];
      try {
        const canvasBuffer = await renderGachaSummonBanner(rollResult.results, '10x Greater Grail Unified Summon');
        files = [new AttachmentBuilder(canvasBuffer, { name: 'unified_summon.png' })];
        embed.setImage('attachment://unified_summon.png');
      } catch (canvasErr) {
        console.error('Failed to render gacha canvas banner:', canvasErr);
      }

      const multiActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('gacha_act_multi')
          .setLabel('Summon 10x Again (30 SQ)')
          .setEmoji('🌟')
          .setStyle(ButtonStyle.Primary)
          .setDisabled((master.saintQuartz || 0) < 30),
        new ButtonBuilder()
          .setCustomId('gacha_act_single')
          .setLabel('1x Summon (3 SQ)')
          .setEmoji('✨')
          .setStyle(ButtonStyle.Success)
          .setDisabled((master.saintQuartz || 0) < 3),
        new ButtonBuilder()
          .setCustomId('gacha_link_inventory')
          .setLabel('Inventory (/inventory)')
          .setEmoji('📦')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('gacha_link_servant')
          .setLabel('Servants (/servant)')
          .setEmoji('👥')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({
        embeds: [embed],
        files,
        components: [multiActionRow]
      });
      return true;
    }

    // 2. 1x Single Summon
    if (customId === 'gacha_act_single' || customId === 'cegacha_btn_pull1') {
      const canUseSq = (master.saintQuartz || 0) >= 3;
      const canUseTickets = (master.summonTickets || 0) >= 1;

      if (!canUseSq && !canUseTickets) {
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: `❌ Insufficient Saint Quartz! You need **3 SQ 💎** (or **1 Summon Ticket 🎫**), but currently have **${master.saintQuartz || 0} SQ**.`
        });
        return true;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const useTickets = !canUseSq && canUseTickets;
      const rollResult = executeUnifiedGachaRoll({ count: 1, master, useTickets });
      master = rollResult.updatedMaster;
      await saveMaster(master);

      const pulled = rollResult.results[0];
      if (pulled.type === 'servant') {
        const s = (pulled.servant || pulled.item) as any;
        const embed = new EmbedBuilder()
          .setTitle(`👑 1x Heroic Spirit Summon: ${s.name} (${s.servantClass})!`)
          .setDescription(
            `🗣️ *" ${s.summonQuote || 'I ask of you, are you my Master?'} "*\\n\\n` +
            `🗡️ **Class:** \\`${s.servantClass}\\`\\n` +
            `📜 **Noble Phantasm:** **${s.noblePhantasm?.name || 'Secret Phantasm'}**\\n` +
            `💥 **NP Affinity:** *${s.noblePhantasm?.cardType || 'Buster'}* (${s.noblePhantasm?.target || 'single'}-target) — ${s.noblePhantasm?.description || ''}\\n\\n` +
            (pulled.isNew 
              ? `🌟 **[NEW CONTRACT ESTABLISHED!]** Formed a sacred covenant with this Heroic Spirit!` 
              : `🔄 **[DUPLICATE SPIRIT ORIGIN]** You already hold a contract with this Servant. Awarded **+50 Mana Prisms 🔵**, +5 stat points, and NP upgrade!`) +
            `\\n\\n💎 **Remaining Saint Quartz:** \\`${master.saintQuartz} SQ\\` | 🔵 **Prisms:** \\`${master.manaPrisms || 0}\\``
          )
          .setColor(pulled.isNew ? 0xeab308 : 0x38bdf8);

        safeSetEmbedImage(embed, s.cardArtUrl || s.avatarUrl);
        safeSetEmbedThumbnail(embed, s.avatarUrl);

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('gacha_act_single')
            .setLabel('Summon Again (3 SQ)')
            .setEmoji('✨')
            .setStyle(ButtonStyle.Success)
            .setDisabled((master.saintQuartz || 0) < 3),
          new ButtonBuilder()
            .setCustomId('gacha_act_multi')
            .setLabel('10x Multi (5 Servants + 5 CEs)')
            .setEmoji('🌟')
            .setStyle(ButtonStyle.Primary)
            .setDisabled((master.saintQuartz || 0) < 30),
          new ButtonBuilder()
            .setCustomId('gacha_link_servant')
            .setLabel('Servants (/servant)')
            .setEmoji('👥')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.editReply({ embeds: [embed], components: [actionRow] });
        return true;
      } else {
        const ce = pulled.item as any;
        const rarityStars = '★'.repeat(pulled.rarity);
        let files: AttachmentBuilder[] = [];
        try {
          const canvasBuffer = await renderGachaSummonBanner(rollResult.results, '1x Craft Essence Forge');
          files = [new AttachmentBuilder(canvasBuffer, { name: 'ce_summon.png' })];
        } catch (canvasErr) {
          console.error('Failed to render gacha canvas banner:', canvasErr);
        }

        const embed = new EmbedBuilder()
          .setTitle(`🛡️ 1x Craft Essence Forge: ${ce.name}!`)
          .setDescription(
            `Forged **[${rarityStars}] ${ce.name}**!\\n\\n` +
            `🔮 **Effect:** *${ce.effectText || ce.description}*\\n` +
            `⚔️ **Stats:** +${ce.bonusAtk || ce.atkBonus || 0} ATK / +${ce.bonusHp || ce.hpBonus || 0} HP\\n` +
            `💎 **Remaining Saint Quartz:** \\`${master.saintQuartz} SQ\\`\\n\\n` +
            `Use \\`/inventory\\` or \\`/customise equip\\` to bind it to your Servant!`
          )
          .setColor(pulled.rarity >= 5 ? 0xf59e0b : pulled.rarity >= 4 ? 0xa855f7 : 0x38bdf8);

        if (files.length > 0) {
          embed.setImage('attachment://ce_summon.png');
        }

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('gacha_act_single')
            .setLabel('Summon Again (3 SQ)')
            .setEmoji('✨')
            .setStyle(ButtonStyle.Success)
            .setDisabled((master.saintQuartz || 0) < 3),
          new ButtonBuilder()
            .setCustomId('gacha_act_multi')
            .setLabel('10x Multi (5 Servants + 5 CEs)')
            .setEmoji('🌟')
            .setStyle(ButtonStyle.Primary)
            .setDisabled((master.saintQuartz || 0) < 30),
          new ButtonBuilder()
            .setCustomId('gacha_link_inventory')
            .setLabel('Inventory (/inventory)')
            .setEmoji('📦')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.editReply({ embeds: [embed], files, components: [actionRow] });
        return true;
      }
    }

    // 3. Ticket Summon
    if (customId === 'gacha_act_ticket') {
      if ((master.summonTickets || 0) < 1) {
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: '❌ You have no Summon Tickets 🎫! Exchange Mana Prisms from duplicate Servants in the **Prism Shop** to obtain tickets.'
        });
        return true;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const rollResult = executeUnifiedGachaRoll({ count: 1, master, useTickets: true });
      master = rollResult.updatedMaster;
      await saveMaster(master);

      const pulled = rollResult.results[0];
      if (pulled.type === 'servant') {
        const s = (pulled.servant || pulled.item) as any;
        const embed = new EmbedBuilder()
          .setTitle(`👑 1x Ticket Heroic Spirit Summon: ${s.name} (${s.servantClass})!`)
          .setDescription(
            `🗣️ *" ${s.summonQuote || 'I ask of you, are you my Master?'} "*\\n\\n` +
            `🗡️ **Class:** \\`${s.servantClass}\\`\\n` +
            `📜 **Noble Phantasm:** **${s.noblePhantasm?.name || 'Secret Phantasm'}**\\n` +
            `💥 **NP Affinity:** *${s.noblePhantasm?.cardType || 'Buster'}* (${s.noblePhantasm?.target || 'single'}-target) — ${s.noblePhantasm?.description || ''}\\n\\n` +
            (pulled.isNew 
              ? `🌟 **[NEW CONTRACT ESTABLISHED!]** Formed a sacred covenant with this Heroic Spirit!` 
              : `🔄 **[DUPLICATE SPIRIT ORIGIN]** You already hold a contract with this Servant. Awarded **+50 Mana Prisms 🔵**, +5 stat points, and NP upgrade!`) +
            `\\n\\n🎫 **Remaining Tickets:** \\`${master.summonTickets || 0} Tickets\\` | 🔵 **Prisms:** \\`${master.manaPrisms || 0}\\``
          )
          .setColor(pulled.isNew ? 0xeab308 : 0x38bdf8);

        safeSetEmbedImage(embed, s.cardArtUrl || s.avatarUrl);
        safeSetEmbedThumbnail(embed, s.avatarUrl);

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('gacha_act_ticket')
            .setLabel(`Use Ticket (${master.summonTickets || 0} 🎫)`)
            .setEmoji('🎫')
            .setStyle(ButtonStyle.Success)
            .setDisabled((master.summonTickets || 0) < 1),
          new ButtonBuilder()
            .setCustomId('gacha_act_multi')
            .setLabel('10x Multi (5 Servants + 5 CEs)')
            .setEmoji('🌟')
            .setStyle(ButtonStyle.Primary)
            .setDisabled((master.saintQuartz || 0) < 30),
          new ButtonBuilder()
            .setCustomId('gacha_link_servant')
            .setLabel('Servants (/servant)')
            .setEmoji('👥')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.editReply({ embeds: [embed], components: [actionRow] });
        return true;
      } else {
        const ce = pulled.item as any;
        const rarityStars = '★'.repeat(pulled.rarity);
        let files: AttachmentBuilder[] = [];
        try {
          const canvasBuffer = await renderGachaSummonBanner(rollResult.results, '1x Craft Essence Forge');
          files = [new AttachmentBuilder(canvasBuffer, { name: 'ce_summon.png' })];
        } catch (canvasErr) {
          console.error('Failed to render gacha canvas banner:', canvasErr);
        }

        const embed = new EmbedBuilder()
          .setTitle(`🛡️ 1x Ticket Craft Essence Forge: ${ce.name}!`)
          .setDescription(
            `Forged **[${rarityStars}] ${ce.name}**!\\n\\n` +
            `🔮 **Effect:** *${ce.effectText || ce.description}*\\n` +
            `⚔️ **Stats:** +${ce.bonusAtk || ce.atkBonus || 0} ATK / +${ce.bonusHp || ce.hpBonus || 0} HP\\n` +
            `🎫 **Remaining Tickets:** \\`${master.summonTickets || 0} Tickets\\`\\n\\n` +
            `Use \\`/inventory\\` or \\`/customise equip\\` to bind it to your Servant!`
          )
          .setColor(pulled.rarity >= 5 ? 0xf59e0b : pulled.rarity >= 4 ? 0xa855f7 : 0x38bdf8);

        if (files.length > 0) {
          embed.setImage('attachment://ce_summon.png');
        }

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('gacha_act_ticket')
            .setLabel(`Use Ticket (${master.summonTickets || 0} 🎫)`)
            .setEmoji('🎫')
            .setStyle(ButtonStyle.Success)
            .setDisabled((master.summonTickets || 0) < 1),
          new ButtonBuilder()
            .setCustomId('gacha_act_multi')
            .setLabel('10x Multi (5 Servants + 5 CEs)')
            .setEmoji('🌟')
            .setStyle(ButtonStyle.Primary)
            .setDisabled((master.saintQuartz || 0) < 30),
          new ButtonBuilder()
            .setCustomId('gacha_link_inventory')
            .setLabel('Inventory (/inventory)')
            .setEmoji('📦')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.editReply({ embeds: [embed], files, components: [actionRow] });
        return true;
      }
    }

    // 4. Daily Claim
    if (customId === 'gacha_act_claim_daily') {
      const claimResult = await claimDailySaintQuartz(master.discordId || master.id, master.username);
      if (claimResult.success) {
        master.saintQuartz = claimResult.newTotalSq;
        await saveMaster(master);
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: `🎉 **Daily Reward Claimed!** Received **+30 Saint Quartz 💎**!\\nNew Balance: **${master.saintQuartz} SQ** (Ready for a 10x Multi-Summon!)`
        });
      } else {
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: `⏳ ${claimResult.message || 'You have already claimed your Daily Saint Quartz! Please check back tomorrow.'}`
        });
      }
      return true;
    }

    // 5. Shop Purchases
    if (customId === 'gacha_shop_buy_1' || customId === 'gacha_shop_buy_5' || customId === 'gacha_shop_buy_10') {
      const count = customId === 'gacha_shop_buy_10' ? 10 : customId === 'gacha_shop_buy_5' ? 5 : 1;
      const result = await buySummonTicketsWithPrisms(master.discordId || master.id, count, master.username);
      master = result.master;

      const shopEmbed = new EmbedBuilder()
        .setTitle(result.success ? '🛍️ Da Vinci Workshop — Exchange Success!' : '❌ Da Vinci Workshop — Insufficient Prisms')
        .setDescription(result.message)
        .setColor(result.success ? 0x10b981 : 0xef4444);

      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [shopEmbed]
      });
      return true;
    }

    // 6. Tab Navigation
    if (
      customId === 'gacha_tab_servants' || 
      customId === 'gacha_tab_shop' || 
      customId === 'gacha_tab_daily' || 
      customId === 'gacha_tab_rates' || 
      customId === 'gacha_act_goto_servants' || 
      customId === 'gacha_act_back_servants' || 
      customId === 'gacha_act_goto_shop' || 
      customId === 'gacha_act_open_shop'
    ) {
      let category: 'servants' | 'shop' | 'daily' | 'rates' = 'servants';
      if (customId === 'gacha_tab_shop' || customId === 'gacha_act_goto_shop' || customId === 'gacha_act_open_shop') {
        category = 'shop';
      } else if (customId === 'gacha_tab_daily') {
        category = 'daily';
      } else if (customId === 'gacha_tab_rates') {
        category = 'rates';
      }

      const hub = buildGachaHub(master, category);
      if (interaction.isButton() && typeof interaction.update === 'function') {
        await interaction.update({ embeds: [hub.embed], components: hub.components });
      } else if (typeof interaction.reply === 'function') {
        await interaction.reply({ embeds: [hub.embed], components: hub.components, flags: MessageFlags.Ephemeral });
      }
      return true;
    }

    // 7. Dropdown Selection
    if (customId === 'gacha_select_banner' && typeof interaction.isStringSelectMenu === 'function' && interaction.isStringSelectMenu()) {
      const selected = interaction.values[0];
      let category: 'servants' | 'shop' | 'daily' | 'rates' = 'servants';
      if (selected === 'prism_shop') category = 'shop';
      else if (selected === 'daily_vault') category = 'daily';

      const hub = buildGachaHub(master, category, selected);
      await interaction.update({ embeds: [hub.embed], components: hub.components });
      return true;
    }

    // 8. Cross-Hub Shortcuts
    if (customId === 'gacha_link_inventory' || customId === 'btn_view_inventory' || customId === 'cegacha_btn_inventory' || customId === 'ce_btn_inventory') {
      const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];
      const inv = buildInventoryHub(master, activeServant, 'ces', 1, activeServant?.equippedCeId);
      await interaction.reply({ embeds: [inv.embed], components: inv.components, flags: MessageFlags.Ephemeral });
      return true;
    }

    if (customId === 'gacha_link_servant' || customId === 'btn_view_servant') {
      const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];
      if (!activeServant) {
        await interaction.reply({ content: 'You have no contracted Servant! Use \\`/summon\\` to manifest one.', flags: MessageFlags.Ephemeral });
        return true;
      }
      const profileEmbed = buildServantFullProfileEmbed(activeServant.template || activeServant);
      await interaction.reply({ embeds: [profileEmbed], flags: MessageFlags.Ephemeral });
      return true;
    }

    if (customId === 'gacha_link_grailwar' || customId === 'btn_enter_war') {
      const war = getOrInitWarSession(master);
      const uP = war.participants[interaction.user.id];
      const embed = await buildWarEmbed(war, uP, '🏰 Welcome to the Holy Grail War Board!');
      const btns = buildWarButtons();
      await interaction.reply({ embeds: [embed], components: btns, flags: MessageFlags.Ephemeral });
      return true;
    }

    if (customId === 'quick_ce_gacha_view') {
      const hub = buildGachaHub(master, 'servants');
      await interaction.reply({ embeds: [hub.embed], components: hub.components, flags: MessageFlags.Ephemeral });
      return true;
    }

    return false;
  } catch (err: any) {
    if (
      err.code === 10062 || 
      err.code === 40060 || 
      err.code === 50027 || 
      err.message?.includes('Unknown interaction') || 
      err.message?.includes('already been acknowledged')
    ) {
      return true;
    }
    console.error('Error handling gacha interaction:', err);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ flags: MessageFlags.Ephemeral, content: `❌ Error: ${err.message}` });
      }
    } catch {}
    return true;
  }
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    let master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const rolls = interaction.options.getInteger('rolls');

    // If invoked with no options (e.g. /gacha), open the interactive Greater Grail Sanctum Hub
    if (!rolls) {
      const { embed, components } = buildGachaHub(master, 'servants');
      await interaction.reply({
        embeds: [embed],
        components
      });
      return;
    }

    const cost = rolls === 10 ? 30 : 3;
    const canUseSq = (master.saintQuartz || 0) >= cost;
    const canUseTickets = (master.summonTickets || 0) >= rolls;

    if (!canUseSq && !canUseTickets) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: `❌ Insufficient Saint Quartz! You need **${cost} SQ 💎** (or **${rolls} Ticket(s) 🎫**), but only have **${master.saintQuartz || 0} SQ** and **${master.summonTickets || 0} Tickets**.\\nUse \\`/daily\\` or open the Gacha Sanctum to claim **+30 SQ**!`
      });
      return;
    }

    // Immediately defer reply to Discord so canvas generation never triggers "didn't respond in time"
    await interaction.deferReply();

    const useTickets = !canUseSq && canUseTickets;
    const rollResult = executeUnifiedGachaRoll({ count: rolls as 1 | 10, master, useTickets });
    master = rollResult.updatedMaster;
    await saveMaster(master);

    if (rolls === 1) {
      const pulled = rollResult.results[0];
      if (pulled.type === 'servant') {
        const s = (pulled.servant || pulled.item) as any;
        const embed = new EmbedBuilder()
          .setTitle(`👑 1x Heroic Spirit Summon: ${s.name} (${s.servantClass})!`)
          .setDescription(
            `🗣️ *" ${s.summonQuote || 'I ask of you, are you my Master?'} "*\\n\\n` +
            `🗡️ **Class:** \\`${s.servantClass}\\`\\n` +
            `📜 **Noble Phantasm:** **${s.noblePhantasm?.name || 'Secret Phantasm'}**\\n` +
            `💥 **NP Affinity:** *${s.noblePhantasm?.cardType || 'Buster'}* (${s.noblePhantasm?.target || 'single'}-target)\\n\\n` +
            (pulled.isNew 
              ? `🌟 **[NEW CONTRACT ESTABLISHED!]** Formed a sacred covenant with this Heroic Spirit!` 
              : `🔄 **[DUPLICATE SPIRIT ORIGIN]** You already hold a contract with this Servant. Awarded **+50 Mana Prisms 🔵**, +5 stat points, and NP upgrade!`) +
            `\\n\\n💎 **Remaining Saint Quartz:** \\`${master.saintQuartz} SQ\\`  •  🔵 **Prisms:** \\`${master.manaPrisms || 0}\\``
          )
          .setColor(pulled.isNew ? 0xeab308 : 0x38bdf8);

        safeSetEmbedImage(embed, s.cardArtUrl || s.avatarUrl);
        safeSetEmbedThumbnail(embed, s.avatarUrl);

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('gacha_act_single')
            .setLabel('Summon Again (3 SQ)')
            .setEmoji('✨')
            .setStyle(ButtonStyle.Success)
            .setDisabled((master.saintQuartz || 0) < 3),
          new ButtonBuilder()
            .setCustomId('gacha_act_multi')
            .setLabel('10x Multi (5 Servants + 5 CEs)')
            .setEmoji('🌟')
            .setStyle(ButtonStyle.Primary)
            .setDisabled((master.saintQuartz || 0) < 30),
          new ButtonBuilder()
            .setCustomId('gacha_link_servant')
            .setLabel('Servants (/servant)')
            .setEmoji('👥')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.editReply({ embeds: [embed], components: [actionRow] });
        return;
      } else {
        const ce = pulled.item as any;
        const rarityStars = '★'.repeat(pulled.rarity);
        let files: AttachmentBuilder[] = [];
        try {
          const canvasBuffer = await renderGachaSummonBanner(rollResult.results, '1x Craft Essence Forge');
          files = [new AttachmentBuilder(canvasBuffer, { name: 'ce_summon.png' })];
        } catch (canvasErr) {
          console.error('Failed to render gacha canvas banner:', canvasErr);
        }

        const embed = new EmbedBuilder()
          .setTitle(`🛡️ 1x Craft Essence Forge: ${ce.name}!`)
          .setDescription(
            `Forged **[${rarityStars}] ${ce.name}**!\\n\\n` +
            `🔮 **Effect:** *${ce.effectText || ce.description}*\\n` +
            `⚔️ **Stats:** +${ce.bonusAtk || ce.atkBonus || 0} ATK / +${ce.bonusHp || ce.hpBonus || 0} HP\\n` +
            `💎 **Remaining Saint Quartz:** \\`${master.saintQuartz} SQ\\`  •  🔵 **Prisms:** \\`${master.manaPrisms || 0}\\`\\n\\n` +
            `Use \\`/inventory\\` or \\`/customise equip\\` to bind it to your Servant!`
          )
          .setColor(pulled.rarity >= 5 ? 0xf59e0b : pulled.rarity >= 4 ? 0xa855f7 : 0x38bdf8);

        if (files.length > 0) {
          embed.setImage('attachment://ce_summon.png');
        }

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('gacha_act_single')
            .setLabel('Summon Again (3 SQ)')
            .setEmoji('✨')
            .setStyle(ButtonStyle.Success)
            .setDisabled((master.saintQuartz || 0) < 3),
          new ButtonBuilder()
            .setCustomId('gacha_act_multi')
            .setLabel('10x Multi (5 Servants + 5 CEs)')
            .setEmoji('🌟')
            .setStyle(ButtonStyle.Primary)
            .setDisabled((master.saintQuartz || 0) < 30),
          new ButtonBuilder()
            .setCustomId('gacha_link_inventory')
            .setLabel('Inventory (/inventory)')
            .setEmoji('📦')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.editReply({ embeds: [embed], files, components: [actionRow] });
        return;
      }
    }

    // 10x Multi-Summon (5 Servants + 5 Craft Essences)
    const servantList = rollResult.results.filter(r => r.type === 'servant');
    const ceList = rollResult.results.filter(r => r.type === 'craft_essence');

    const servantSummary = servantList.map((r, idx) => {
      const s = (r.servant || r.item) as any;
      const statusTag = r.isNew ? '🌟 **[NEW!]**' : '🔵 *(+50 Prisms)*';
      return `${idx + 1}. **${s.name}** (\\`${s.servantClass}\\`) ${statusTag}`;
    }).join('\\n');

    const ceSummary = ceList.map((r, idx) => {
      const c = r.item as any;
      const statusTag = r.isNew ? '🌟 **[NEW!]**' : '';
      const stars = '★'.repeat(r.rarity || c.rarity || 3);
      return `${idx + 1}. **[${stars}] ${c.name}** ${statusTag} — *${(c.effectText || c.description || '').slice(0, 36)}...*`;
    }).join('\\n');

    const embed = new EmbedBuilder()
      .setTitle('👑 10x Greater Grail Unified Multi-Summon Results!')
      .setDescription(
        `**Chaldea Summoning Gate Opened (5 Servants + 5 Craft Essences):**\\n\\n` +
        `⚔️ **Heroic Spirits Manifested (5x):**\\n` +
        servantSummary +
        `\\n\\n` +
        `🛡️ **Craft Essences Forged (5x):**\\n` +
        ceSummary +
        `\\n\\n` +
        `═══════════════════════════════════════════════\\n` +
        `🌟 **New Servants Contracted:** **+${rollResult.newServantsCount}**\\n` +
        `🛡️ **SSR / SR Relics Forged:** **${rollResult.ssrsPulled}x ★5 SSR**, **${rollResult.srsPulled}x ★4 SR**\\n` +
        `🔵 **Mana Prisms Earned (Duplicates):** **+${rollResult.totalManaPrismsAwarded} 🔵**\\n` +
        `💎 **Remaining Saint Quartz:** \\`${master.saintQuartz} SQ\\` | 🔵 **Total Prisms:** \\`${master.manaPrisms || 0}\\`\\n\\n` +
        `Use \\`/servant\\` to inspect your companions, or \\`/inventory\\` to equip Mystic Codes!`
      )
      .setColor(rollResult.ssrsPulled > 0 ? 0xf59e0b : 0xeab308);

    let files: AttachmentBuilder[] = [];
    try {
      const canvasBuffer = await renderGachaSummonBanner(rollResult.results, '10x Greater Grail Unified Summon');
      files = [new AttachmentBuilder(canvasBuffer, { name: 'unified_summon.png' })];
      embed.setImage('attachment://unified_summon.png');
    } catch (canvasErr) {
      console.error('Failed to render gacha canvas banner:', canvasErr);
    }

    const multiActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('gacha_act_multi')
        .setLabel('Summon 10x Again (30 SQ)')
        .setEmoji('🌟')
        .setStyle(ButtonStyle.Primary)
        .setDisabled((master.saintQuartz || 0) < 30),
      new ButtonBuilder()
        .setCustomId('gacha_link_servant')
        .setLabel('Servants (/servant)')
        .setEmoji('👥')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('gacha_link_inventory')
        .setLabel('Inventory (/inventory)')
        .setEmoji('📦')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
      embeds: [embed],
      files,
      components: [multiActionRow]
    });
  } catch (error: any) {
    console.error('Error executing /gacha:', error);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: `❌ Gacha error: ${error.message}` });
      } else {
        await interaction.reply({ content: `❌ Gacha error: ${error.message}`, flags: MessageFlags.Ephemeral });
      }
    } catch {}
  }
}
'''

with open("src/commands/gacha.ts", "w", encoding="utf-8") as f:
    f.write(top_part + new_code)

print("Updated src/commands/gacha.ts successfully!")
