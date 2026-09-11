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
  addSaintQuartzToUser
} from '../database/service';
import { executeCraftEssenceGachaRoll } from '../engine/ceGacha';
import { renderGachaSummonBanner } from '../canvas/renderer';
import { CRAFT_ESSENCE_DATABASE } from '../data/craftEssences';
import { SERVANT_DATABASE } from '../data/servants';
import { buildInventoryHub, attachInventoryCollector } from './customise';
import { safeSetEmbedImage } from '../utils/discordEmbedHelper';

export const data = new SlashCommandBuilder()
  .setName('gacha')
  .setDescription('🔮 Greater Grail Invocation Sanctum — Forge Craft Essences & Claim Daily SQ')
  .addSubcommand(sub =>
    sub
      .setName('menu')
      .setDescription('Open the interactive Gacha Invocation Sanctum Hub')
  )
  .addSubcommand(sub =>
    sub
      .setName('ce')
      .setDescription('Summon Craft Essences from the Sanctum Pool (3 SQ for 1x, 30 SQ for 10x)')
      .addIntegerOption(opt =>
        opt
          .setName('rolls')
          .setDescription('Number of rolls (1 or 10)')
          .setRequired(false)
          .addChoices(
            { name: '1x Summon (3 Saint Quartz)', value: 1 },
            { name: '10x Multi-Summon (30 Saint Quartz - 4★+ Guaranteed)', value: 10 }
          )
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('daily')
      .setDescription('💎 Claim your Daily 30 Saint Quartz reward')
  )
  .addSubcommand(sub =>
    sub
      .setName('rates')
      .setDescription('📜 View summoning rates and pity guarantees')
  );

export function buildGachaHub(
  master: any,
  category: 'ces' | 'daily' | 'rates' = 'ces',
  selectedBanner: string = 'standard_ce'
) {
  const sq = master.saintQuartz || 0;
  let title = '🛡️ Invocation Sanctum — Craft Essence Forge';
  let description = '';
  let color = 0x38bdf8;
  let bannerImage = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80';

  if (category === 'ces') {
    title = '🛡️ Invocation Sanctum — Craft Essence Forge';
    color = 0x38bdf8;
    bannerImage = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80';
    description =
      `💎 **Master Balance:** \`${sq} Saint Quartz\`\n\n` +
      `🛡️ **Featured Essence Banner:** **Mystic Code Armory**\n` +
      `🌟 **Featured Essences:** The Black Grail, Kaleidoscope, Formal Craft, Limited/Zero Over\n` +
      `🎁 **Multi-Summon Guarantee:** Every 10x roll guarantees at least one **★4 SR or higher** Craft Essence!\n\n` +
      `⚔️ **Holy Grail War Covenant:** *Heroic Spirits are contracted once per Master via \`/summon ritual\`. Forge and equip powerful Mystic Codes below to empower your Servant!*`;
  } else if (category === 'daily') {
    title = '💎 Saint Quartz Treasury & Daily Claim';
    color = 0x10b981;
    bannerImage = 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80';
    description =
      `💎 **Current Vault Balance:** \`${sq} Saint Quartz\`\n` +
      `🏆 **Grail Shards:** \`${master.grailShards || 1} Shards\`\n` +
      `🔵 **Mana Prisms:** \`${master.manaPrisms || 50} Prisms\`\n\n` +
      `🎁 **Daily Login Bonus:** Claim **+30 Saint Quartz (10x Multi-Summon)** every 24 hours!\n` +
      `💰 **Battle Rewards:** Earn bonus Saint Quartz by participating in Fuyuki Patrols and Duels.\n\n` +
      `*Press the **Claim Daily Quartz** button below to collect your reward!*`;
  } else if (category === 'rates') {
    title = '📜 Greater Grail Summoning Rates & Crafting Guarantees';
    color = 0x64748b;
    description =
      `📊 **Official Mystic Code Forge Probability Table:**\n\n` +
      `**Craft Essences (Mystic Codes):**\n` +
      `• ★5 SSR Craft Essence: **4.0%**\n` +
      `• ★4 SR Craft Essence: **12.0%**\n` +
      `• ★3 R Craft Essence: **84.0%**\n\n` +
      `💎 **Guaranteed Multi-Roll Pity:**\n` +
      `• 10x Multi-Summon guarantees at least one **★4 SR or higher** Craft Essence.\n\n` +
      `⚔️ **Heroic Spirit Covenant:**\n` +
      `• Servants cannot be summoned via Gacha. Each Master establishes a singular bond with a Heroic Spirit via \`/summon ritual\` for the Holy Grail War.`;
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setFooter({ text: `Greater Grail Sanctum • Master: ${master.username} • Balance: ${sq} SQ` });
  safeSetEmbedImage(embed, bannerImage);

  // Row 1: Category Navigation Tabs
  const catRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('gacha_tab_ces')
      .setLabel('Craft Essences')
      .setEmoji('🛡️')
      .setStyle(category === 'ces' ? ButtonStyle.Primary : ButtonStyle.Secondary),
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
          label: '★5 Mystic Code Armory (Craft Essences)',
          value: 'standard_ce',
          description: 'Summon Kaleidoscope, Black Grail, Limited/Zero Over',
          emoji: '🛡️',
          default: selectedBanner === 'standard_ce'
        },
        {
          label: '💎 Daily Quartz Treasury & Rewards',
          value: 'daily_vault',
          description: 'Claim daily Saint Quartz and inspect currency',
          emoji: '💎',
          default: selectedBanner === 'daily_vault'
        }
      ])
  );

  // Row 3: Action Summon Buttons
  const actRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('gacha_act_single')
      .setLabel('1x Single Summon (3 SQ)')
      .setEmoji('✨')
      .setStyle(ButtonStyle.Success)
      .setDisabled(sq < 3),
    new ButtonBuilder()
      .setCustomId('gacha_act_multi')
      .setLabel('10x Multi-Summon (30 SQ)')
      .setEmoji('🌟')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(sq < 30),
    new ButtonBuilder()
      .setCustomId('gacha_act_claim_daily')
      .setLabel('Claim Daily SQ (+30)')
      .setEmoji('💎')
      .setStyle(ButtonStyle.Success)
  );

  // Row 4: Cross-Hub Jump Shortcuts
  const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('gacha_link_inventory')
      .setLabel('Master Inventory (/inventory)')
      .setEmoji('👔')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('gacha_link_servant')
      .setLabel('Servant Workshop (/servant)')
      .setEmoji('👑')
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

export function attachGachaCollector(interaction: any, initialMaster: any, replyMessage: any) {
  let master = initialMaster;
  let currentCategory: 'ces' | 'daily' | 'rates' = 'ces';
  let currentBanner = 'standard_ce';

  const collector = replyMessage.createMessageComponentCollector({
    idle: 180000,
    time: 900000
  });

  collector.on('collect', async (i: any) => {
    try {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ flags: MessageFlags.Ephemeral, content: '❌ This Gacha Sanctum belongs to another Master.' });
        return;
      }

      collector.resetTimer();
      const customId = i.customId;

      // Tab switching
      if (customId === 'gacha_tab_ces') {
        currentCategory = 'ces';
        currentBanner = 'standard_ce';
      } else if (customId === 'gacha_tab_daily') {
        currentCategory = 'daily';
        currentBanner = 'daily_vault';
      } else if (customId === 'gacha_tab_rates') {
        currentCategory = 'rates';
      }

      // Dropdown selection
      else if (customId === 'gacha_select_banner') {
        currentBanner = i.values[0];
        if (currentBanner === 'standard_ce') currentCategory = 'ces';
        else if (currentBanner === 'daily_vault') currentCategory = 'daily';
      }

      // Daily Claim Action
      else if (customId === 'gacha_act_claim_daily') {
        const claimResult = await claimDailySaintQuartz(master.discordId || master.id);
        if (claimResult.success) {
          master.saintQuartz = claimResult.newTotalSq;
          await saveMaster(master);
          await i.reply({
            flags: MessageFlags.Ephemeral,
            content: `🎉 **Daily Reward Claimed!** Received **+30 Saint Quartz 💎**!\nNew Balance: **${master.saintQuartz} SQ** (Ready for a 10x Multi-Summon!)`
          });
        } else {
          await i.reply({
            flags: MessageFlags.Ephemeral,
            content: `⏳ ${claimResult.message || 'You have already claimed your Daily Saint Quartz! Please check back tomorrow.'}`
          });
        }
      }

      // 1x Single Summon Action
      else if (customId === 'gacha_act_single') {
        if ((master.saintQuartz || 0) < 3) {
          await i.reply({ flags: MessageFlags.Ephemeral, content: '❌ You need at least 3 Saint Quartz to perform a summon! Claim daily SQ or earn quartz from battles.' });
          return;
        }

        // Forge Craft Essence
        const rollResult = executeCraftEssenceGachaRoll({ count: 1, master });
        master.saintQuartz = rollResult.updatedMaster.saintQuartz;
        master.craftEssences = rollResult.updatedMaster.craftEssences;
        await saveMaster(master);

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
            `Use \`/inventory\` to equip it to your Servant!`
          )
          .setColor(pulled.rarity >= 5 ? 0xf59e0b : pulled.rarity >= 4 ? 0xa855f7 : 0x38bdf8);

        if (imageAttachmentName) {
          embed.setImage(imageAttachmentName);
        }

        await i.reply({
          flags: MessageFlags.Ephemeral,
          embeds: [embed],
          files
        });
      }

      // 10x Multi-Summon Action
      else if (customId === 'gacha_act_multi') {
        if ((master.saintQuartz || 0) < 30) {
          await i.reply({ flags: MessageFlags.Ephemeral, content: '❌ You need at least 30 Saint Quartz for a 10x Multi-Summon!' });
          return;
        }

        // 10x CE Roll
        const rollResult = executeCraftEssenceGachaRoll({ count: 10, master });
        master.saintQuartz = rollResult.updatedMaster.saintQuartz;
        master.craftEssences = rollResult.updatedMaster.craftEssences;
        await saveMaster(master);

        const cardSummary = rollResult.results
          .map((r: any, idx: number) => `${idx + 1}. **[★${r.item.rarity}] ${r.item.name}**${r.isNew ? ' 🌟 **[NEW!]**' : ''} — *${(r.item.effectText || r.item.description || '').slice(0, 40)}...*`)
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
          .setTitle(`💎 10x Multi-Summon Results!`)
          .setDescription(
            `**Chaldea Summoning Gate Opened:**\n\n` +
            cardSummary +
            `\n\n💎 **Remaining Quartz:** \`${master.saintQuartz} SQ\`\n` +
            `Use \`/inventory\` to view your expanded collection and equip them!`
          )
          .setColor(embedColor);

        if (imageAttachmentName) {
          embed.setImage(imageAttachmentName);
        }

        await i.reply({
          flags: MessageFlags.Ephemeral,
          embeds: [embed],
          files
        });
      }

      // Cross-Hub Shortcut: Inventory
      else if (customId === 'gacha_link_inventory') {
        const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];
        const inv = buildInventoryHub(master, activeServant, 'ces', 1, activeServant?.equippedCeId);
        await i.update({ embeds: [inv.embed], components: inv.components });
        return;
      }

      // Cross-Hub Shortcut: Servant
      else if (customId === 'gacha_link_servant') {
        await i.reply({
          flags: MessageFlags.Ephemeral,
          content: '👑 Opening Servant Workshop... Use `/servant` to view full parameter radar cards and customisation options!'
        });
        return;
      }

      // Cross-Hub Shortcut: Grail War
      else if (customId === 'gacha_link_grailwar') {
        await i.reply({
          flags: MessageFlags.Ephemeral,
          content: '🏰 Opening War Room... Use `/grailwar` to view the 7-Master Intelligence Board and city operations!'
        });
        return;
      }

      // Update Hub View
      const updated = buildGachaHub(master, currentCategory, currentBanner);
      if (!i.replied && !i.deferred) {
        await i.update({ embeds: [updated.embed], components: updated.components });
      } else {
        await interaction.editReply({ embeds: [updated.embed], components: updated.components });
      }

    } catch (err: any) {
      if (
        err.code === 10062 || 
        err.code === 40060 || 
        err.code === 50027 || 
        err.message?.includes('Unknown interaction') || 
        err.message?.includes('already been acknowledged')
      ) {
        return;
      }
      console.error('Error in gacha collector:', err);
    }
  });
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const sub = interaction.options.getSubcommand(false) || 'menu';

    if (sub === 'daily') {
      const claimResult = await claimDailySaintQuartz(master.discordId || master.id);
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
      return;
    }

    let initialCategory: 'ces' | 'daily' | 'rates' = 'ces';
    if (sub === 'rates') initialCategory = 'rates';
    else if (sub === 'daily') initialCategory = 'daily';
    else initialCategory = 'ces';

    const { embed, components } = buildGachaHub(master, initialCategory);
    await interaction.reply({
      embeds: [embed],
      components,
      flags: MessageFlags.Ephemeral
    });
    const reply = await interaction.fetchReply();

    attachGachaCollector(interaction, master, reply);
  } catch (error: any) {
    console.error('Error executing /gacha:', error);
    await interaction.reply({ content: `❌ Gacha error: ${error.message}`, flags: MessageFlags.Ephemeral });
  }
}
