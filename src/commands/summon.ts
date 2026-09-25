import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  AttachmentBuilder,
  MessageFlags 
} from 'discord.js';
import { 
  getOrCreateMaster, 
  saveMaster, 
  claimDailySaintQuartz
} from '../database/service';
import { executeServantGachaRoll, executeCraftEssenceGachaRoll } from '../engine/ceGacha';
import { buildGachaHub, attachGachaCollector } from './gacha';
import { registerMasterSummonInWar } from '../engine/grailwar';
import { safeSetEmbedImage } from '../utils/discordEmbedHelper';
import { renderGachaSummonBanner } from '../canvas/renderer';

// ==========================================
// 1. SLASH COMMAND DEFINITION (GACHA UNIFIED SHORTCUT)
// ==========================================
export const data = new SlashCommandBuilder()
  .setName('summon')
  .setDescription('👑 Throne of Heroes & Greater Grail Invocation — Summon Servants & Craft Essences')
  .addSubcommand(sub =>
    sub
      .setName('servant')
      .setDescription('Summon Heroic Spirits from the Throne of Heroes into your roster (3 SQ for 1x, 30 SQ for 10x)')
      .addIntegerOption(opt =>
        opt
          .setName('rolls')
          .setDescription('Number of summons (1x or 10x)')
          .setRequired(false)
          .addChoices(
            { name: '1x Single Summon (3 Saint Quartz)', value: 1 },
            { name: '10x Multi-Summon (30 Saint Quartz)', value: 10 }
          )
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('ritual')
      .setDescription('Channel magical energy into the summoning array to manifest a Heroic Spirit (Shortcut)')
      .addIntegerOption(opt =>
        opt
          .setName('rolls')
          .setDescription('Number of summons (1x or 10x)')
          .setRequired(false)
          .addChoices(
            { name: '1x Single Summon (3 Saint Quartz)', value: 1 },
            { name: '10x Multi-Summon (30 Saint Quartz)', value: 10 }
          )
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('ce')
      .setDescription('Forge Mystic Codes & Craft Essences from the Sanctum Pool (3 SQ for 1x, 30 SQ for 10x)')
      .addIntegerOption(opt =>
        opt
          .setName('rolls')
          .setDescription('Number of summons (1x or 10x)')
          .setRequired(false)
          .addChoices(
            { name: '1x Single Summon (3 Saint Quartz)', value: 1 },
            { name: '10x Multi-Summon (30 Saint Quartz - 4★+ Guaranteed)', value: 10 }
          )
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('menu')
      .setDescription('Open the interactive Gacha Invocation Sanctum Hub')
  )
  .addSubcommand(sub =>
    sub
      .setName('daily')
      .setDescription('💎 Claim your Daily 30 Saint Quartz reward (Free 10x Multi-Summon)')
  )
  .addSubcommand(sub =>
    sub
      .setName('shop')
      .setDescription('🛍️ Da Vinci Workshop — Exchange duplicate Mana Prisms for Summon Tickets')
  )
  .addSubcommand(sub =>
    sub
      .setName('status')
      .setDescription('Inspect your active Servant contract, roster size, Command Seals & SQ balance')
  )
  .addSubcommand(sub =>
    sub
      .setName('rates')
      .setDescription('📜 View summoning rates and balance mechanics')
  );

// ==========================================
// 1.5. AUTHENTIC FATE SUMMONING CHANTS & VISUALS
// ==========================================
const RIN_SUMMONING_GIF = 'https://i.imgur.com/hyNsgc1.jpeg';
const FALLBACK_MAGIC_CIRCLE = 'https://i.imgur.com/hyNsgc1.jpeg';

function resolveDirectGifUrl(url: string): string {
  if (!url) return FALLBACK_MAGIC_CIRCLE;
  if (url.includes('tenor.com') || url.includes('giphy.com')) {
    return FALLBACK_MAGIC_CIRCLE;
  }
  return url;
}

const SUMMONING_CHANTS = [
  `*“Let silver and steel be the essence.”*\n` +
  `*“Let stone and the archduke of contracts be the foundation.”*\n` +
  `*“Let red be the color I pay tribute to.”*\n` +
  `*“Let rise a wall against the wind that shall fall.”*\n` +
  `*“Let the four cardinal gates close.”*\n` +
  `*“Let the three-forked road from the crown reaching unto the Kingdom rotate.”*\n\n` +
  `*“Let it be filled. Again. Again. Again. Again.”*\n` +
  `*“Let it be filled fivefold for every turn, simply breaking asunder with every filling.”*`,

  `*“Fill. Fill. Fill. Fill. Fill. Let each be turned over five times, simply breaking asunder the fulfilled time.”*\n` +
  `*“Let silver and steel be the essence. Let stone and the archduke of contracts be the foundation. Let my great master be the ancestor. Raise a wall, against the wind that shall fall. Close the four cardinal gates. Come out from the crown. Rotate the three-branched road reaching the Kingdom.”*\n\n` +
  `*“– I shall declare here. Your body shall serve under me. My fate shall be with your sword. Submit to the beckoning of the Holy Grail. If you will submit to this will and this reason…… then answer!”*\n\n` +
  `*“– An oath shall be sworn here! I shall attain all virtues of all of Heaven. I shall have dominion over all evils of all of Hell! – From the Seventh Heaven, attended to by three great words of power, come forth from the ring of restraint, Protector of the Balance!”*`,

  `*“Be gone, shadows!”*\n` +
  `*“Thou of the unseeable!”*\n` +
  `*“Fade back into oblivion, if of darkness. Be returned to the immaterial!”*\n` +
  `*“Ask not me, my answer is clear. In my hand is light. Know that all is in this hand.”*\n` +
  `*“I am the truth of creation. In face of all things, thy defeat is certain!”*`
];

// ==========================================
// 2. COMMAND EXECUTION HANDLER
// ==========================================
export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const subcommand = interaction.options.getSubcommand(false) || 'ritual';

    // ------------------------------------------
    // SUBCOMMAND: DAILY
    // ------------------------------------------
    if (subcommand === 'daily') {
      const claimResult = await claimDailySaintQuartz(master.discordId || master.id);
      if (claimResult.success) {
        master.saintQuartz = claimResult.newTotalSq;
        await saveMaster(master);
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: `🎉 **Daily Reward Claimed!** Received **+30 Saint Quartz 💎**!\nNew Balance: **${master.saintQuartz} SQ** (Ready for a 10x Multi-Summon! Use \`/summon\` or \`/gacha\`)`
        });
      } else {
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: `⏳ ${claimResult.message || 'You have already claimed your Daily Saint Quartz! Please check back tomorrow.'}`
        });
      }
      return;
    }

    // ------------------------------------------
    // SUBCOMMAND: STATUS
    // ------------------------------------------
    if (subcommand === 'status') {
      const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];
      const rosterCount = master.servants?.length || 0;
      const sq = master.saintQuartz || 0;

      if (!activeServant) {
        const emptyEmbed = new EmbedBuilder()
          .setTitle('🕯️ Chaldea Summoning Sanctum — No Active Contract')
          .setDescription(
            `You have not summoned any Heroic Spirits into your Chaldea roster yet.\n\n` +
            `💎 **Saint Quartz Balance:** \`${sq} SQ\`\n` +
            `👥 **Contracted Roster:** \`0 Servants\`\n\n` +
            `Use \`/summon servant\` or click the button below to draw the summoning circle and call forth your first Heroic Spirit!`
          )
          .setColor(0x3b82f6);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('gacha_act_single')
            .setLabel('Summon First Servant (3 SQ)')
            .setEmoji('✨')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('gacha_act_claim_daily')
            .setLabel('Claim Daily SQ (+30)')
            .setEmoji('💎')
            .setStyle(ButtonStyle.Success)
        );

        await interaction.reply({ embeds: [emptyEmbed], components: [row], flags: MessageFlags.Ephemeral });
        return;
      }

      const sAny = activeServant as any;
      const t = sAny.template || sAny;
      const sName = sAny.nickname || t.name || sAny.name || 'HEROIC SPIRIT';
      const sClass = t.servantClass || sAny.servantClass || sAny.class || 'Saber';
      const sTitle = t.title || sAny.title || 'Heroic Spirit';
      const baseHp = t.baseHp || sAny.baseHp || 12000;
      const baseAtk = t.baseAtk || sAny.baseAtk || 10000;
      const np = t.noblePhantasm || sAny.noblePhantasm || { name: 'Excalibur', cardType: 'Buster', chant: 'Sword of Promised Victory' };
      const baseStats = t.baseStats || { strength: 10, endurance: 10, agility: 10, mana: 10, luck: 10 };
      const alloc = activeServant.allocatedStats || {};
      const totalStr = (baseStats.strength || 10) + (alloc.strength || 0);
      const totalEnd = (baseStats.endurance || 10) + (alloc.endurance || 0);
      const ceAtk = activeServant.equippedCe?.atkBonus || 0;
      const ceHp = activeServant.equippedCe?.hpBonus || 0;
      const calcHp = Math.round(baseHp + totalEnd * 150 + ceHp);
      const calcAtk = Math.round(baseAtk + totalStr * 80 + ceAtk);

      const statusEmbed = new EmbedBuilder()
        .setTitle(`📜 ACTIVE COMPANION CONTRACT: ${sName.toUpperCase()}`)
        .setDescription(
          `**Master:** <@${interaction.user.id}> (${master.username})\n` +
          `**Class:** \`${sClass}\` | **Title:** *${sTitle}*\n` +
          `**Command Seals:** 🔴🔴🔴 **${master.commandSeals || 3}/3**\n` +
          `**Action Points (AP):** **${master.actionPoints || 100}/100**\n` +
          `💎 **Saint Quartz:** \`${sq} SQ\` | 👥 **Total Roster:** \`${rosterCount} Servants\`\n\n` +
          `⚔️ **Combat Parameters:**\n` +
          `• HP: \`${calcHp.toLocaleString()}\`\n` +
          `• ATK: \`${calcAtk.toLocaleString()}\`\n` +
          `• Available Parameter Points: **${activeServant.availableStatPoints || 0}** (Use \`/customise stats\`)\n\n` +
          `💥 **Noble Phantasm:** **${np.name}** [${np.cardType}]\n` +
          `* "${activeServant.customQuotes?.noblePhantasm || np.chant}" *\n\n` +
          `💬 **Arrival Quote:**\n*"${activeServant.customQuotes?.summon || t.summonQuote || 'I ask of you, are you my Master?'}"*`
        )
        .setColor(0xd4af37);
      safeSetEmbedImage(statusEmbed, t.cardArtUrl || t.avatarUrl || sAny.cardArtUrl || sAny.avatarUrl);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('gacha_act_single')
          .setLabel('Summon More Servants')
          .setEmoji('✨')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('gacha_link_servant')
          .setLabel('View Roster (/servant)')
          .setEmoji('👥')
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.reply({ embeds: [statusEmbed], components: [row] });
      return;
    }

    // ------------------------------------------
    // SUBCOMMAND: SHOP
    // ------------------------------------------
    if (subcommand === 'shop') {
      const { embed, components } = buildGachaHub(master, 'shop');
      await interaction.reply({ embeds: [embed], components });
      const reply = await interaction.fetchReply();
      attachGachaCollector(interaction, master, reply);
      return;
    }

    // ------------------------------------------
    // SUBCOMMAND: RATES
    // ------------------------------------------
    if (subcommand === 'rates') {
      const { embed, components } = buildGachaHub(master, 'rates');
      await interaction.reply({ embeds: [embed], components });
      const reply = await interaction.fetchReply();
      attachGachaCollector(interaction, master, reply);
      return;
    }

    // ------------------------------------------
    // SUBCOMMAND: CE (Craft Essence Forge)
    // ------------------------------------------
    if (subcommand === 'ce') {
      const rolls = (interaction.options.getInteger('rolls') as 1 | 10) || 10;
      const cost = rolls === 10 ? 30 : 3;

      if ((master.saintQuartz || 0) < cost) {
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: `❌ Insufficient Saint Quartz! You need **${cost} SQ** to forge Craft Essences, but you currently have **${master.saintQuartz || 0} SQ**.\nUse \`/summon daily\` to claim **+30 SQ**!`
        });
        return;
      }

      const rollResult = executeCraftEssenceGachaRoll({ count: rolls, master });
      master.saintQuartz = rollResult.updatedMaster.saintQuartz;
      master.craftEssences = rollResult.updatedMaster.craftEssences;
      await saveMaster(master);

      if (rolls === 1) {
        const pulled = rollResult.results[0].item as any;
        const rarityStars = '★'.repeat(pulled.rarity);

        let files: AttachmentBuilder[] = [];
        let imageAttachmentName: string | undefined = undefined;

        try {
          const canvasBuffer = await renderGachaSummonBanner(rollResult.results, '1x Craft Essence Single Summon');
          const attachment = new AttachmentBuilder(canvasBuffer, { name: 'ce_summon.png' });
          files = [attachment];
          imageAttachmentName = 'attachment://ce_summon.png';
        } catch (canvasErr) {
          console.error('Failed to render gacha canvas banner:', canvasErr);
        }

        const embed = new EmbedBuilder()
          .setTitle(`✨ 1x Craft Essence Summon: ${pulled.name}!`)
          .setDescription(
            `Summoned **[${rarityStars}] ${pulled.name}**!\n\n` +
            `🔮 **Effect:** *${pulled.effectText || pulled.description}*\n` +
            `⚔️ **Stats:** +${pulled.bonusAtk || pulled.atkBonus || 0} ATK / +${pulled.bonusHp || pulled.hpBonus || 0} HP\n` +
            `💎 **Remaining Saint Quartz:** \`${master.saintQuartz} SQ\`\n\n` +
            `Use \`/inventory\` or \`/customise equip\` to equip it to your Servant!`
          )
          .setColor(pulled.rarity >= 5 ? 0xf59e0b : pulled.rarity >= 4 ? 0xa855f7 : 0x38bdf8);

        if (imageAttachmentName) {
          embed.setImage(imageAttachmentName);
        }

        const actionButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('quick_ce_gacha_ten')
            .setLabel('Forge 10x (30 SQ)')
            .setEmoji('💎')
            .setStyle(ButtonStyle.Primary)
            .setDisabled((master.saintQuartz || 0) < 30),
          new ButtonBuilder()
            .setCustomId('btn_view_inventory')
            .setLabel('View Inventory (/inventory)')
            .setEmoji('📦')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
          embeds: [embed],
          files,
          components: [actionButtons]
        });
        return;
      }

      // 10x CE Multi-Summon
      const cardSummary = rollResult.results
        .map((r: any, idx: number) => {
          const ce = r.item;
          const star = '⭐'.repeat(r.rarity || ce.rarity || 3);
          const newTag = r.isNew ? ' 🌟 **[NEW!]**' : '';
          const atk = ce.bonusAtk || ce.atkBonus || 0;
          const hp = ce.bonusHp || ce.hpBonus || 0;
          const effect = ce.effectText || ce.description || '';
          return `**${idx + 1}.** ${star} **${ce.name}**${newTag}\n   ↳ *${effect}* (+${atk} ATK / +${hp} HP)`;
        })
        .join('\n');

      let files: AttachmentBuilder[] = [];
      let imageAttachmentName: string | undefined = undefined;

      try {
        const canvasBuffer = await renderGachaSummonBanner(rollResult.results, '10x Craft Essence Multi-Summon');
        const attachment = new AttachmentBuilder(canvasBuffer, { name: 'ce_summon.png' });
        files = [attachment];
        imageAttachmentName = 'attachment://ce_summon.png';
      } catch (canvasErr) {
        console.error('Failed to render gacha canvas banner:', canvasErr);
      }

      const embedColor = rollResult.ssrsPulled > 0 ? 0xf59e0b : rollResult.srsPulled > 0 ? 0xa855f7 : 0x38bdf8;

      const embed = new EmbedBuilder()
        .setTitle('🎁 10x Craft Essence Multi-Summon Results!')
        .setDescription(
          `**10x Craft Essence Invocations Complete!**\n\n` +
          `💎 **Remaining Balance:** \`${master.saintQuartz} SQ\` *(Spent 30 SQ)*\n` +
          `📦 **Total Essences in Vault:** \`${master.craftEssences?.length || 0}\`\n\n` +
          `### 🔮 Relics Summoned:\n` +
          cardSummary +
          `\n\n*Use \`/inventory\` or \`/customise equip\` to bind these Mystic Codes to your Servant!*`
        )
        .setColor(embedColor)
        .setFooter({ text: 'Craft Essence Forge • 4★+ Guarantee Applied' });

      if (imageAttachmentName) {
        embed.setImage(imageAttachmentName);
      }

      const actionButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('quick_ce_gacha_ten')
          .setLabel('Forge 10x Again (30 SQ)')
          .setEmoji('💎')
          .setStyle(ButtonStyle.Success)
          .setDisabled((master.saintQuartz || 0) < 30),
        new ButtonBuilder()
          .setCustomId('btn_view_inventory')
          .setLabel('View Inventory (/inventory)')
          .setEmoji('📦')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({
        embeds: [embed],
        files,
        components: [actionButtons]
      });
      return;
    }

    // ------------------------------------------
    // SUBCOMMAND: MENU
    // ------------------------------------------
    if (subcommand === 'menu') {
      const { embed, components } = buildGachaHub(master, 'servants');
      await interaction.reply({ embeds: [embed], components });
      const reply = await interaction.fetchReply();
      attachGachaCollector(interaction, master, reply);
      return;
    }

    // ------------------------------------------
    // SUBCOMMAND: SERVANT & RITUAL (Direct Summoning)
    // ------------------------------------------
    const rolls = (interaction.options.getInteger('rolls') as 1 | 10) || 1;
    const cost = rolls === 10 ? 30 : 3;

    // First-Time Starter Gift: If a brand-new player has 0 servants and < 3 SQ, bestow starter SQ
    if ((!master.servants || master.servants.length === 0) && (master.saintQuartz || 0) < cost) {
      master.saintQuartz = (master.saintQuartz || 0) + 30;
      await saveMaster(master);
    }

    // Check balance (Quartz or Tickets)
    const canUseSq = (master.saintQuartz || 0) >= cost;
    const canUseTickets = (master.summonTickets || 0) >= rolls;

    if (!canUseSq && !canUseTickets) {
      const needSqEmbed = new EmbedBuilder()
        .setTitle('💎 Insufficient Summon Resources')
        .setDescription(
          `You need **${cost} Saint Quartz** (or **${rolls} Summon Ticket(s) 🎫**) for a ${rolls}x Summon, but you currently have **${master.saintQuartz || 0} SQ** and **${master.summonTickets || 0} Tickets**.\n\n` +
          `• Click **Claim Daily (+30 SQ)** below to receive a free 10x Multi-Summon!\n` +
          `• Or exchange duplicate Mana Prisms for tickets in the **Shop**.`
        )
        .setColor(0xef4444);

      const needSqRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('gacha_act_claim_daily')
          .setLabel('Claim Daily SQ (+30 💎)')
          .setEmoji('🎁')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('gacha_tab_shop')
          .setLabel(`Prism Shop (${master.manaPrisms || 0} 🔵)`)
          .setEmoji('🛍️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('gacha_tab_daily')
          .setLabel('Open Sanctum Hub')
          .setEmoji('🔮')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({ embeds: [needSqEmbed], components: [needSqRow], flags: MessageFlags.Ephemeral });
      return;
    }

    const useTickets = !canUseSq && canUseTickets;

    // Execute Servant Gacha Roll
    const rollResult = executeServantGachaRoll({ count: rolls, master, useTickets });
    const updatedMaster = rollResult.updatedMaster;

    // Ensure active servant and command seals are set if this was the first summon
    if (!updatedMaster.activeServantId && updatedMaster.servants.length > 0) {
      updatedMaster.activeServantId = updatedMaster.servants[0].id;
      updatedMaster.commandSeals = 3;
    }

    await saveMaster(updatedMaster);

    // Register active servant in war if needed
    if (updatedMaster.servants.length > 0) {
      const activeS = updatedMaster.servants.find((s: any) => s.id === updatedMaster.activeServantId) || updatedMaster.servants[0];
      registerMasterSummonInWar(updatedMaster, activeS);
    }

    // 1x Single Summon Result Display
    if (rolls === 1) {
      const s = rollResult.results[0].servant;
      const isNew = rollResult.results[0].isNew;
      const chosenChant = SUMMONING_CHANTS[Math.floor(Math.random() * SUMMONING_CHANTS.length)];

      const ritualEmbed = new EmbedBuilder()
        .setTitle('🕯️ HOLY GRAIL WAR: SACRED SUMMONING RITUAL')
        .setDescription(
          `Master **<@${interaction.user.id}>** channels magical energy through circuits into the summoning array...\n\n` +
          `${chosenChant}\n\n` +
          `✨ *The Greater Grail responds! Mana surges through the Fuyuki leylines as the magic circle erupts in brilliant light!*`
        )
        .setImage(resolveDirectGifUrl(RIN_SUMMONING_GIF))
        .setColor(0xa855f7)
        .setFooter({ text: 'Magecraft Circuits Active • Channelling Mana into the Greater Grail' });

      const summonEmbed = new EmbedBuilder()
        .setTitle(`✨ HEROIC SPIRIT SUMMONED: ${s.name.toUpperCase()}`)
        .setDescription(
          `═══════════════════════════════════\n` +
          `🗣️ **"${s.summonQuote || 'I ask of you, are you my Master?'}"**\n` +
          `═══════════════════════════════════\n\n` +
          `👤 **True Name:** **${s.name}**\n` +
          `🗡️ **Class:** \`${s.servantClass}\` | **Title:** *${s.title || 'Heroic Spirit'}*\n` +
          (isNew 
            ? `🌟 **[NEW CONTRACT ESTABLISHED!]** Added to your permanent Chaldea roster!` 
            : `🔄 **[DUPLICATE SPIRIT ORIGIN]** You already own this Servant. Awarded **+50 Mana Prisms 🔵**!`) +
          `\n\n` +
          `📊 **Base Parameters:**\n` +
          `• **HP:** \`${(s.baseHp || 12000).toLocaleString()}\` | **ATK:** \`${(s.baseAtk || 10000).toLocaleString()}\`\n` +
          `• **STR:** \`${s.baseStats?.strength || 10}\` | **END:** \`${s.baseStats?.endurance || 10}\` | **AGI:** \`${s.baseStats?.agility || 10}\` | **MNA:** \`${s.baseStats?.mana || 10}\` | **LCK:** \`${s.baseStats?.luck || 10}\`\n\n` +
          `💥 **Noble Phantasm:** **${s.noblePhantasm?.name || 'Noble Phantasm'}** [${s.noblePhantasm?.cardType || 'Buster'}]\n` +
          `* "${s.noblePhantasm?.chant || 'Unleash the Phantasm'}" *\n\n` +
          `💎 **Remaining Saint Quartz:** \`${updatedMaster.saintQuartz} SQ\` | 👥 **Roster Size:** \`${updatedMaster.servants.length}\``
        )
        .setColor(isNew ? 0xd4af37 : 0x38bdf8)
        .setFooter({ text: `Use /servant to view and switch companions • /duel to battle` });
      safeSetEmbedImage(summonEmbed, s.cardArtUrl || s.avatarUrl);

      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_view_servant')
          .setLabel('View Active Servant (/servant)')
          .setEmoji('📊')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('gacha_act_single')
          .setLabel('Summon Again (3 SQ)')
          .setEmoji('✨')
          .setStyle(ButtonStyle.Success)
          .setDisabled((updatedMaster.saintQuartz || 0) < 3),
        new ButtonBuilder()
          .setCustomId('btn_enter_war')
          .setLabel('Enter Grail War (/grailwar)')
          .setEmoji('🏰')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('btn_boast_summon')
          .setLabel('Boast to Server')
          .setEmoji('📢')
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({
        embeds: [ritualEmbed, summonEmbed],
        components: [actionRow]
      });
      return;
    }

    // 10x Multi-Summon Result Display
    const listSummary = rollResult.results
      .map((r, idx) => `${idx + 1}. **${r.servant.name}** (\`${r.servant.servantClass}\`) ${r.isNew ? '🌟 **[NEW!]**' : '🔵 *(+50 Prisms)*'}`)
      .join('\n');

    const multiEmbed = new EmbedBuilder()
      .setTitle(`👑 10x Heroic Spirit Multi-Summon Results!`)
      .setDescription(
        `**Throne of Heroes Gate Awakened:**\n\n` +
        listSummary +
        `\n\n` +
        `🌟 **New Servants Contracted:** **+${rollResult.newServantsCount}**\n` +
        `🔵 **Mana Prisms Earned (Duplicates):** **+${rollResult.totalManaPrismsAwarded}**\n` +
        `💎 **Remaining Saint Quartz:** \`${updatedMaster.saintQuartz} SQ\` | 🔵 **Total Prisms:** \`${updatedMaster.manaPrisms || 0}\`\n\n` +
        `Use \`/servant\` to view your full roster, allocate stats, and select your active companion!`
      )
      .setColor(0xeab308)
      .setFooter({ text: 'Throne of Heroes • Multi-Summon Protocol' });

    let files: AttachmentBuilder[] = [];
    try {
      const gachaItems = rollResult.results.map(r => ({
        type: 'servant',
        item: r.servant,
        rarity: r.servant.rarity || 5,
        isNew: r.isNew,
        isRateUp: r.servant.rarity >= 5
      }));
      const canvasBuffer = await renderGachaSummonBanner(gachaItems as any, '10x Heroic Spirit Multi-Summon');
      const attachment = new AttachmentBuilder(canvasBuffer, { name: 'servant_summon.png' });
      files = [attachment];
      multiEmbed.setImage('attachment://servant_summon.png');
    } catch (canvasErr) {
      console.error('Failed to render servant gacha canvas banner:', canvasErr);
    }

    const multiActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('gacha_act_multi')
        .setLabel('Summon 10x Again (30 SQ)')
        .setEmoji('🌟')
        .setStyle(ButtonStyle.Primary)
        .setDisabled((updatedMaster.saintQuartz || 0) < 30),
      new ButtonBuilder()
        .setCustomId('gacha_link_servant')
        .setLabel('Manage Roster (/servant)')
        .setEmoji('👥')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('btn_enter_war')
        .setLabel('Holy Grail War (/grailwar)')
        .setEmoji('🏰')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [multiEmbed],
      components: [multiActionRow],
      files
    });

  } catch (error: any) {
    if (error.code === 10062 || error.code === 40060 || error.message?.includes('Unknown interaction')) return;
    console.error('Error executing /summon:', error);
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: `❌ Summoning Error: ${error.message}`, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: `❌ Summoning Error: ${error.message}`, flags: MessageFlags.Ephemeral });
      }
    } catch {}
  }
}
