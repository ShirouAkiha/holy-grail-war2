import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  AttachmentBuilder,
  MessageFlags } from 'discord.js';
import { 
  getOrCreateMaster, 
  saveMaster, 
  getActiveGachaBanner, 
  getAllCraftEssences, 
  getAllThroneServants,
  claimDailySaintQuartz,
  addSaintQuartzToUser,
  buySummonTicketsWithPrisms
} from '../database/service';
import { executeCraftEssenceGachaRoll, executeServantGachaRoll, executeUnifiedGachaRoll } from '../engine/ceGacha';
import { renderGachaSummonBanner } from '../canvas/renderer';
import { CRAFT_ESSENCE_DATABASE } from '../data/craftEssences';
import { SERVANT_DATABASE } from '../data/servants';
import { buildInventoryHub, attachInventoryCollector } from './customise';
import { buildServantFullProfileEmbed } from './servants';
import { buildWarEmbed, buildWarButtons } from './grailwar';
import { getOrInitWarSession } from '../engine/grailwar';
import { safeSetEmbedImage, safeSetEmbedThumbnail } from '../utils/discordEmbedHelper';

export const data = new SlashCommandBuilder()
  .setName('gacha')
  .setDescription('🔮 Greater Grail Invocation Sanctum — Summon Servants & Craft Essences (50/50)')
  .addIntegerOption(opt =>
    opt
      .setName('rolls')
      .setDescription('Direct summon: 1x (3 SQ) or 10x (30 SQ - 5 Servants + 5 CEs). Leave empty for Sanctum Menu.')
      .setRequired(false)
      .addChoices(
        { name: '1x Single Summon (3 SQ or 1 Ticket)', value: 1 },
        { name: '10x Multi-Summon (30 SQ - 5 Servants + 5 CEs)', value: 10 }
      )
  );

export const SERVANT_SUMMONING_BANNER = 'https://ella.janitorai.com/media-approved/4eou5BGEGK91VbIpEukgO.webp';

export function buildGachaHub(
  master: any,
  category: 'servants' | 'ces' | 'shop' | 'daily' | 'rates' | 'altar' = 'altar',
  selectedBanner: string = 'throne_servants'
) {
  const sq = master.saintQuartz || 0;
  const tickets = master.summonTickets || 0;
  const prisms = master.manaPrisms || 0;
  const ownedServantCount = master.servants?.length || 0;
  const isAltar = category === 'altar' || category === 'servants' || category === 'ces';
  let title = '🌌 GREATER GRAIL — UNIFIED INVOCATION ALTAR';
  let description = '';
  let color = 0x38bdf8;
  let bannerImage = SERVANT_SUMMONING_BANNER;

  if (isAltar) {
    title = '🌌 GREATER GRAIL — UNIFIED INVOCATION ALTAR';
    color = 0x38bdf8; // Ethereal moonlight azure matching summoning illumination
    bannerImage = SERVANT_SUMMONING_BANNER;

    const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];
    const sName = activeServant?.nickname || activeServant?.template?.name || activeServant?.name || 'No Contract Active';
    const sClass = activeServant?.template?.servantClass || activeServant?.servantClass || 'Unknown';
    const sBond = activeServant?.bondLevel || 1;
    const sQuote = activeServant?.customQuotes?.summon || activeServant?.template?.summonQuote || 'I ask of you, are you my Master?';

    const companionBlock = activeServant
      ? `🛡️ **Current Guardian:** **${sName}** \`[${sClass}]\` • Bond Lv.${sBond}\n` +
        `💬 *“${sQuote.slice(0, 110)}”*`
      : `🕯️ **Current Guardian:** *No active companion contracted yet. Draw the magic circle below to summon your first Servant!*`;

    description =
      `*“– I shall declare here. Your body shall serve under me. My fate shall be with your sword. Submit to the beckoning of the Holy Grail!”*\n\n` +
      `🔮 **Master Mana Reserves & Telemetry:**\n` +
      `💎 **Saint Quartz:** \`${sq} SQ\`  •  🎫 **Summon Tickets:** \`${tickets} Tickets\`  •  🔵 **Mana Prisms:** \`${prisms} Prisms\`\n` +
      `👥 **Contracted Roster:** \`${ownedServantCount} Servants\`  •  🔴 **Command Seals:** \`${master.commandSeals ?? 3}/3 Active\`\n\n` +
      `${companionBlock}\n\n` +
      `═══════════════════════════════════════════════\n` +
      `⚔️ **Active Gate:** **Greater Grail Unified Invocation Gate**\n` +
      `🌟 **Combined Summoning Altar:** Every invocation roll summons both Heroic Spirits and Craft Essences!\n\n` +
      `✨ **Summoning Protocols & Rates:**\n` +
      `• **10x Multi-Summon (30 SQ):** Manifests exactly **5 Heroic Spirits (50%) & 5 Craft Essences (50%)**!\n` +
      `• **1x Single Summon (3 SQ or 1 Ticket 🎫):** **50%** Servant / **50%** Craft Essence\n` +
      `• **★5 SSR Craft Essence:** Strictly **1.0%** pull rate *(Kaleidoscope, The Black Grail, Formal Craft)*\n` +
      `• **★4 SR Craft Essence:** **19.0%** *(Guaranteed at least one 4★+ CE in 10-pull)*\n` +
      `• **★3 R Craft Essence:** **80.0%** *(Dragon's Meridian, Jeweled Sword Zelretch)*\n` +
      `• **Duplicate Covenant:** Pulling an owned Servant automatically yields **+50 Mana Prisms 🔵**, +5 stat points, and NP upgrade!\n` +
      `• **Prism Exchange:** Spend Mana Prisms in the **🛍️ Da Vinci Workshop** to buy more Summon Tickets!\n\n` +
      `⚡ *Channel your magical energy into the summoning array using the action buttons below!*`;
  } else if (category === 'shop') {
    title = '🛍️ DA VINCI WORKSHOP — MANA PRISM EXCHANGE';
    color = 0x06b6d4;
    bannerImage = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80';
    description =
      `*“Welcome to the Da Vinci Workshop! Bring me Mana Prisms harvested from duplicate Heroic Spirit summonings, and I’ll trade them for Summon Tickets!”*\n\n` +
      `🔵 **Mana Prisms:** \`${prisms} Prisms\`  •  🎫 **Summon Tickets:** \`${tickets} Tickets\`  •  💎 **Saint Quartz:** \`${sq} SQ\`\n\n` +
      `═══════════════════════════════════════════════\n` +
      `🛍️ **Available Exchange Catalog:**\n` +
      `• 🎫 **1x Summon Ticket** ➔ **1,000 Mana Prisms 🔵** *(Grants 1 Single Summon on any banner)*\n` +
      `• 🎟️ **5x Summon Tickets** ➔ **5,000 Mana Prisms 🔵** *(Grants 5 Summons)*\n` +
      `• 🎟️ **10x Summon Tickets** ➔ **10,000 Mana Prisms 🔵** *(Grants 10 Multi-Summon)*\n\n` +
      `💡 **How to Acquire Mana Prisms:**\n` +
      `• Every duplicate Heroic Spirit summoned from the Throne of Heroes yields **+50 Mana Prisms 🔵** automatically!\n` +
      `• Exchange your prisms for tickets below to keep summoning indefinitely!`;
  } else if (category === 'daily') {
    title = '💎 SAINT QUARTZ TREASURY & DAILY VAULT';
    color = 0x10b981;
    bannerImage = 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80';
    description =
      `*“Mana accumulates within the Greater Grail over time. Claim your allotment!”*\n\n` +
      `💎 **Current Vault Balance:** \`${sq} Saint Quartz\`  •  🎫 **Summon Tickets:** \`${tickets} Tickets\`\n` +
      `🔵 **Mana Prisms:** \`${prisms} Prisms\`\n\n` +
      `🎁 **Daily Login Bonus:** Claim **+30 Saint Quartz (Free 10x Multi-Summon)** every 24 hours!\n` +
      `💰 **Combat Inflow:** Earn additional Quartz by participating in Fuyuki Patrols, Boss Raids, and Arena Duels.\n\n` +
      `*Click the **Claim Daily Quartz (+30)** button below to collect today's bounty!*`;
  } else if (category === 'rates') {
    title = '📜 GREATER GRAIL SUMMONING RATES & BALANCE MATRIX';
    color = 0x818cf8;
    description =
      `📊 **Unified Greater Grail Invocation Matrix (50% Servants / 50% Craft Essences):**\n\n` +
      `👑 **Heroic Spirits (50% of 10-Pull = Exactly 5 Servants):**\n` +
      `• All Servants possess equalized base stat potential for balanced multiplayer combat.\n` +
      `• No star-rarity gaps or predatory stat tiers.\n` +
      `• Tactical victory is determined by **Class Advantage**, **Skill Timing**, **Command Seals**, and **Craft Essence synergies**.\n` +
      `• Duplicate Heroic Spirits are converted into **+50 Mana Prisms 🔵**, +5 stat points, and NP level upgrade!\n\n` +
      `🛡️ **Craft Essences (50% of 10-Pull = Exactly 5 Mystic Codes):**\n` +
      `• ★5 SSR Craft Essence: **1.0%** *(Kaleidoscope, The Black Grail, Formal Craft, Limited/Zero Over)*\n` +
      `• ★4 SR Craft Essence: **19.0%** *(The Imaginary Element, Gamer Fuel, Gandr)*\n` +
      `• ★3 R Craft Essence: **80.0%** *(Dragon's Meridian, Jeweled Sword Zelretch)*\n` +
      `• 10x Multi-Summon guarantees at least one **★4 SR or higher** Craft Essence.`;
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setFooter({ text: `Greater Grail Sanctum • Master: ${master.username} • Balance: ${sq} SQ • ${tickets} Tickets • ${prisms} Prisms` });
  
  if (category !== 'rates') {
    embed.setImage(bannerImage);
    safeSetEmbedImage(embed, bannerImage);
  }

  const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];
  if (activeServant) {
    const avatar = activeServant.template?.avatarUrl || activeServant.avatarUrl || 'https://i.imgur.com/hyNsgc1.jpeg';
    safeSetEmbedThumbnail(embed, avatar);
  } else {
    safeSetEmbedThumbnail(embed, 'https://i.imgur.com/hyNsgc1.jpeg');
  }

  // Row 1: Category Navigation Tabs
  const catRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('gacha_tab_servants')
      .setLabel('Unified Altar (50/50)')
      .setEmoji('🌌')
      .setStyle(isAltar ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('gacha_tab_shop')
      .setLabel('Prism Shop')
      .setEmoji('🛍️')
      .setStyle(category === 'shop' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('gacha_tab_daily')
      .setLabel('Daily & Vault')
      .setEmoji('💎')
      .setStyle(category === 'daily' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('gacha_tab_rates')
      .setLabel('Drop Rates')
      .setEmoji('📜')
      .setStyle(category === 'rates' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  // Row 2: Banner Selection Dropdown
  const bannerSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('gacha_select_banner')
      .setPlaceholder('Select Summoning Banner...')
      .addOptions([
        {
          label: '🌌 Greater Grail Altar (Servants & CEs)',
          value: 'throne_servants',
          description: '50% Heroic Spirits & 50% Craft Essences (1% 5★ CE rate)',
          emoji: '🌌',
          default: isAltar
        },
        {
          label: '🛍️ Da Vinci Workshop (Mana Prism Shop)',
          value: 'prism_shop',
          description: 'Exchange duplicate Mana Prisms for Summon Tickets',
          emoji: '🛍️',
          default: category === 'shop'
        },
        {
          label: '💎 Daily Quartz Treasury & Rewards',
          value: 'daily_vault',
          description: 'Claim daily Saint Quartz and inspect currency',
          emoji: '💎',
          default: category === 'daily' && selectedBanner === 'daily_vault'
        }
      ])
  );

  // Row 3: Action Summon / Shop Buttons
  let actRow: ActionRowBuilder<ButtonBuilder>;

  if (category === 'shop') {
    actRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('gacha_shop_buy_1')
        .setLabel('Buy 1x Ticket (1,000 🔵)')
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Success)
        .setDisabled(prisms < 1000),
      new ButtonBuilder()
        .setCustomId('gacha_shop_buy_5')
        .setLabel('Buy 5x Tickets (5,000 🔵)')
        .setEmoji('🎟️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(prisms < 5000),
      new ButtonBuilder()
        .setCustomId('gacha_shop_buy_10')
        .setLabel('Buy 10x Tickets (10,000 🔵)')
        .setEmoji('🎟️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(prisms < 10000),
      new ButtonBuilder()
        .setCustomId('gacha_act_back_servants')
        .setLabel('Back to Gacha 🌌')
        .setStyle(ButtonStyle.Secondary)
    );
  } else if (category === 'daily') {
    actRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('gacha_act_claim_daily')
        .setLabel('Claim Daily SQ (+30)')
        .setEmoji('💎')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('gacha_act_goto_shop')
        .setLabel(`Open Shop (${prisms} 🔵)`)
        .setEmoji('🛍️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('gacha_act_goto_servants')
        .setLabel('Summon Altar 🌌')
        .setStyle(ButtonStyle.Secondary)
    );
  } else {
    // Unified Altar (Servants + CEs)
    actRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('gacha_act_single')
        .setLabel('1x Summon (3 SQ)')
        .setEmoji('✨')
        .setStyle(ButtonStyle.Success)
        .setDisabled(sq < 3),
      new ButtonBuilder()
        .setCustomId('gacha_act_multi')
        .setLabel('10x Multi: 5 Servants + 5 CEs (30 SQ)')
        .setEmoji('🌟')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(sq < 30),
      new ButtonBuilder()
        .setCustomId('gacha_act_ticket')
        .setLabel(`Use Ticket (${tickets} 🎫)`)
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Success)
        .setDisabled(tickets < 1),
      new ButtonBuilder()
        .setCustomId('gacha_act_open_shop')
        .setLabel(`Shop (${prisms} 🔵)`)
        .setEmoji('🛍️')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  // Row 4: Cross-Hub Jump Shortcuts
  const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('gacha_link_servant')
      .setLabel('Servant Workshop (/servant)')
      .setEmoji('👑')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('gacha_link_inventory')
      .setLabel('Master Inventory (/inventory)')
      .setEmoji('👔')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('gacha_link_grailwar')
      .setLabel('Holy Grail War (/grailwar)')
      .setEmoji('🏰')
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    embed,
    components: [catRow, bannerSelect, actRow, linkRow]
  };
}

export function attachGachaCollector(
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
    customId === 'btn_enter_war' ||
    customId === 'go_summon' ||
    customId === 'go_gacha' ||
    customId === 'quick_summon_ritual';

  if (!isGachaBtn) return false;

  try {
    let master = await getOrCreateMaster(interaction.user.id, interaction.user.username);

    // 0. Quick Portal to Gacha Hub
    if (customId === 'go_summon' || customId === 'go_gacha' || customId === 'quick_summon_ritual') {
      const hub = buildGachaHub(master, 'altar');
      if (interaction.isButton() && typeof interaction.update === 'function' && !interaction.deferred && !interaction.replied) {
        // If from within an ephemeral or replaceable component
        try {
          await interaction.reply({ embeds: [hub.embed], components: hub.components, flags: MessageFlags.Ephemeral });
        } catch {
          await interaction.followUp({ embeds: [hub.embed], components: hub.components, flags: MessageFlags.Ephemeral });
        }
      } else if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ embeds: [hub.embed], components: hub.components, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.followUp({ embeds: [hub.embed], components: hub.components, flags: MessageFlags.Ephemeral });
      }
      return true;
    }

    // 1. 10x Multi-Summon (5 Servants + 5 CEs)
    if (customId === 'gacha_act_multi' || customId === 'quick_ce_gacha_ten' || customId === 'cegacha_btn_pull10') {
      if ((master.saintQuartz || 0) < 30) {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.reply({
            flags: MessageFlags.Ephemeral,
            content: `❌ Insufficient Saint Quartz! You need **30 SQ 💎** for a 10x Multi-Summon, but currently have **${master.saintQuartz || 0} SQ**.\nUse \`/daily\` or click **Daily & Vault** to claim **+30 SQ**!`
          });
        } else {
          await interaction.followUp({
            flags: MessageFlags.Ephemeral,
            content: `❌ Insufficient Saint Quartz! You need **30 SQ 💎** for a 10x Multi-Summon, but currently have **${master.saintQuartz || 0} SQ**.\nUse \`/daily\` or click **Daily & Vault** to claim **+30 SQ**!`
          });
        }
        return true;
      }

      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }

      const rollResult = executeUnifiedGachaRoll({ count: 10, master });
      master = rollResult.updatedMaster;
      await saveMaster(master);

      const servantList = rollResult.results.filter(r => r.type === 'servant');
      const ceList = rollResult.results.filter(r => r.type === 'craft_essence');

      const servantSummary = servantList.map((r, idx) => {
        const s = (r.servant || r.item) as any;
        const statusTag = r.isNew ? '🌟 **[NEW!]**' : '🔵 *(+50 Prisms)*';
        return `${idx + 1}. **${s.name}** (\`${s.servantClass}\`) ${statusTag}`;
      }).join('\n');

      const ceSummary = ceList.map((r, idx) => {
        const c = r.item as any;
        const statusTag = r.isNew ? '🌟 **[NEW!]**' : '';
        const stars = '★'.repeat(r.rarity || c.rarity || 3);
        return `${idx + 1}. **[${stars}] ${c.name}** ${statusTag} — *${(c.effectText || c.description || '').slice(0, 36)}...*`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setTitle('👑 10x Greater Grail Unified Multi-Summon Results!')
        .setDescription(
          `**Chaldea Summoning Gate Opened (5 Servants + 5 Craft Essences):**\n\n` +
          `⚔️ **Heroic Spirits Manifested (5x):**\n` +
          servantSummary +
          `\n\n` +
          `🛡️ **Craft Essences Forged (5x):**\n` +
          ceSummary +
          `\n\n` +
          `═══════════════════════════════════════════════\n` +
          `🌟 **New Servants Contracted:** **+${rollResult.newServantsCount}**\n` +
          `🛡️ **SSR / SR Relics Forged:** **${rollResult.ssrsPulled}x ★5 SSR**, **${rollResult.srsPulled}x ★4 SR**\n` +
          `🔵 **Mana Prisms Earned (Duplicates):** **+${rollResult.totalManaPrismsAwarded} 🔵**\n` +
          `💎 **Remaining Saint Quartz:** \`${master.saintQuartz} SQ\` | 🔵 **Total Prisms:** \`${master.manaPrisms || 0}\`\n\n` +
          `Use \`/servant\` to inspect your companions, or \`/inventory\` to equip Mystic Codes!`
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
        if (!interaction.deferred && !interaction.replied) {
          await interaction.reply({
            flags: MessageFlags.Ephemeral,
            content: `❌ Insufficient Saint Quartz! You need **3 SQ 💎** (or **1 Summon Ticket 🎫**), but currently have **${master.saintQuartz || 0} SQ**.`
          });
        } else {
          await interaction.followUp({
            flags: MessageFlags.Ephemeral,
            content: `❌ Insufficient Saint Quartz! You need **3 SQ 💎** (or **1 Summon Ticket 🎫**), but currently have **${master.saintQuartz || 0} SQ**.`
          });
        }
        return true;
      }

      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }

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
            `🗣️ *" ${s.summonQuote || 'I ask of you, are you my Master?'} "*\n\n` +
            `🗡️ **Class:** \`${s.servantClass}\`\n` +
            `📜 **Noble Phantasm:** **${s.noblePhantasm?.name || 'Secret Phantasm'}**\n` +
            `💥 **NP Affinity:** *${s.noblePhantasm?.cardType || 'Buster'}* (${s.noblePhantasm?.target || 'single'}-target) — ${s.noblePhantasm?.description || ''}\n\n` +
            (pulled.isNew 
              ? `🌟 **[NEW CONTRACT ESTABLISHED!]** Formed a sacred covenant with this Heroic Spirit!` 
              : `🔄 **[DUPLICATE SPIRIT ORIGIN]** You already hold a contract with this Servant. Awarded **+50 Mana Prisms 🔵**, +5 stat points, and NP upgrade!`) +
            `\n\n💎 **Remaining Saint Quartz:** \`${master.saintQuartz} SQ\` | 🔵 **Prisms:** \`${master.manaPrisms || 0}\``
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
            `Forged **[${rarityStars}] ${ce.name}**!\n\n` +
            `🔮 **Effect:** *${ce.effectText || ce.description}*\n` +
            `⚔️ **Stats:** +${ce.bonusAtk || ce.atkBonus || 0} ATK / +${ce.bonusHp || ce.hpBonus || 0} HP\n` +
            `💎 **Remaining Saint Quartz:** \`${master.saintQuartz} SQ\`\n\n` +
            `Use \`/inventory\` or \`/customise equip\` to bind it to your Servant!`
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
        if (!interaction.deferred && !interaction.replied) {
          await interaction.reply({
            flags: MessageFlags.Ephemeral,
            content: '❌ You have no Summon Tickets 🎫! Exchange Mana Prisms from duplicate Servants in the **Prism Shop** to obtain tickets.'
          });
        } else {
          await interaction.followUp({
            flags: MessageFlags.Ephemeral,
            content: '❌ You have no Summon Tickets 🎫! Exchange Mana Prisms from duplicate Servants in the **Prism Shop** to obtain tickets.'
          });
        }
        return true;
      }

      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }

      const rollResult = executeUnifiedGachaRoll({ count: 1, master, useTickets: true });
      master = rollResult.updatedMaster;
      await saveMaster(master);

      const pulled = rollResult.results[0];
      if (pulled.type === 'servant') {
        const s = (pulled.servant || pulled.item) as any;
        const embed = new EmbedBuilder()
          .setTitle(`👑 1x Ticket Heroic Spirit Summon: ${s.name} (${s.servantClass})!`)
          .setDescription(
            `🗣️ *" ${s.summonQuote || 'I ask of you, are you my Master?'} "*\n\n` +
            `🗡️ **Class:** \`${s.servantClass}\`\n` +
            `📜 **Noble Phantasm:** **${s.noblePhantasm?.name || 'Secret Phantasm'}**\n` +
            `💥 **NP Affinity:** *${s.noblePhantasm?.cardType || 'Buster'}* (${s.noblePhantasm?.target || 'single'}-target) — ${s.noblePhantasm?.description || ''}\n\n` +
            (pulled.isNew 
              ? `🌟 **[NEW CONTRACT ESTABLISHED!]** Formed a sacred covenant with this Heroic Spirit!` 
              : `🔄 **[DUPLICATE SPIRIT ORIGIN]** You already hold a contract with this Servant. Awarded **+50 Mana Prisms 🔵**, +5 stat points, and NP upgrade!`) +
            `\n\n🎫 **Remaining Tickets:** \`${master.summonTickets || 0} Tickets\` | 🔵 **Prisms:** \`${master.manaPrisms || 0}\``
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
            `Forged **[${rarityStars}] ${ce.name}**!\n\n` +
            `🔮 **Effect:** *${ce.effectText || ce.description}*\n` +
            `⚔️ **Stats:** +${ce.bonusAtk || ce.atkBonus || 0} ATK / +${ce.bonusHp || ce.hpBonus || 0} HP\n` +
            `🎫 **Remaining Tickets:** \`${master.summonTickets || 0} Tickets\`\n\n` +
            `Use \`/inventory\` or \`/customise equip\` to bind it to your Servant!`
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
          content: `🎉 **Daily Reward Claimed!** Received **+30 Saint Quartz 💎**!\nNew Balance: **${master.saintQuartz} SQ** (Ready for a 10x Multi-Summon!)`
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
        await interaction.reply({ content: 'You have no contracted Servant! Use \`/summon\` to manifest one.', flags: MessageFlags.Ephemeral });
        return true;
      }
      const profileEmbed = buildServantFullProfileEmbed(activeServant.template || activeServant);
      await interaction.reply({ embeds: [profileEmbed], flags: MessageFlags.Ephemeral });
      return true;
    }

    if (customId === 'gacha_link_grailwar' || customId === 'btn_enter_war') {
      const war = getOrInitWarSession(master);
      const embed = await buildWarEmbed(war, master, '🏰 Welcome to the Holy Grail War Board!');
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
        content: `❌ Insufficient Saint Quartz! You need **${cost} SQ 💎** (or **${rolls} Ticket(s) 🎫**), but only have **${master.saintQuartz || 0} SQ** and **${master.summonTickets || 0} Tickets**.\nUse \`/daily\` or open the Gacha Sanctum to claim **+30 SQ**!`
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
            `🗣️ *" ${s.summonQuote || 'I ask of you, are you my Master?'} "*\n\n` +
            `🗡️ **Class:** \`${s.servantClass}\`\n` +
            `📜 **Noble Phantasm:** **${s.noblePhantasm?.name || 'Secret Phantasm'}**\n` +
            `💥 **NP Affinity:** *${s.noblePhantasm?.cardType || 'Buster'}* (${s.noblePhantasm?.target || 'single'}-target)\n\n` +
            (pulled.isNew 
              ? `🌟 **[NEW CONTRACT ESTABLISHED!]** Formed a sacred covenant with this Heroic Spirit!` 
              : `🔄 **[DUPLICATE SPIRIT ORIGIN]** You already hold a contract with this Servant. Awarded **+50 Mana Prisms 🔵**, +5 stat points, and NP upgrade!`) +
            `\n\n💎 **Remaining Saint Quartz:** \`${master.saintQuartz} SQ\`  •  🔵 **Prisms:** \`${master.manaPrisms || 0}\``
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
            `Forged **[${rarityStars}] ${ce.name}**!\n\n` +
            `🔮 **Effect:** *${ce.effectText || ce.description}*\n` +
            `⚔️ **Stats:** +${ce.bonusAtk || ce.atkBonus || 0} ATK / +${ce.bonusHp || ce.hpBonus || 0} HP\n` +
            `💎 **Remaining Saint Quartz:** \`${master.saintQuartz} SQ\`  •  🔵 **Prisms:** \`${master.manaPrisms || 0}\`\n\n` +
            `Use \`/inventory\` or \`/customise equip\` to bind it to your Servant!`
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
      return `${idx + 1}. **${s.name}** (\`${s.servantClass}\`) ${statusTag}`;
    }).join('\n');

    const ceSummary = ceList.map((r, idx) => {
      const c = r.item as any;
      const statusTag = r.isNew ? '🌟 **[NEW!]**' : '';
      const stars = '★'.repeat(r.rarity || c.rarity || 3);
      return `${idx + 1}. **[${stars}] ${c.name}** ${statusTag} — *${(c.effectText || c.description || '').slice(0, 36)}...*`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('👑 10x Greater Grail Unified Multi-Summon Results!')
      .setDescription(
        `**Chaldea Summoning Gate Opened (5 Servants + 5 Craft Essences):**\n\n` +
        `⚔️ **Heroic Spirits Manifested (5x):**\n` +
        servantSummary +
        `\n\n` +
        `🛡️ **Craft Essences Forged (5x):**\n` +
        ceSummary +
        `\n\n` +
        `═══════════════════════════════════════════════\n` +
        `🌟 **New Servants Contracted:** **+${rollResult.newServantsCount}**\n` +
        `🛡️ **SSR / SR Relics Forged:** **${rollResult.ssrsPulled}x ★5 SSR**, **${rollResult.srsPulled}x ★4 SR**\n` +
        `🔵 **Mana Prisms Earned (Duplicates):** **+${rollResult.totalManaPrismsAwarded} 🔵**\n` +
        `💎 **Remaining Saint Quartz:** \`${master.saintQuartz} SQ\` | 🔵 **Total Prisms:** \`${master.manaPrisms || 0}\`\n\n` +
        `Use \`/servant\` to inspect your companions, or \`/inventory\` to equip Mystic Codes!`
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
