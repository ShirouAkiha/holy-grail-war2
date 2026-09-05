import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  StringSelectMenuBuilder,
  ComponentType
} from 'discord.js';
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
import { CRAFT_ESSENCE_DATABASE } from '../data/craftEssences';
import { SERVANT_DATABASE } from '../data/servants';
import { buildInventoryHub, attachInventoryCollector } from './customise';

export const data = new SlashCommandBuilder()
  .setName('gacha')
  .setDescription('🔮 Greater Grail Invocation Sanctum — Summon Heroic Spirits, Craft Essences & Claim Daily SQ')
  .addSubcommand(sub =>
    sub
      .setName('menu')
      .setDescription('Open the interactive Gacha Invocation Sanctum Hub')
  )
  .addSubcommand(sub =>
    sub
      .setName('summon')
      .setDescription('Summon a random Heroic Spirit from the Throne of Heroes (3 SQ)')
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
  category: 'heroic' | 'ces' | 'daily' | 'rates' = 'heroic',
  selectedBanner: string = 'standard_servant'
) {
  const sq = master.saintQuartz || 0;
  let title = '🔮 Greater Grail Invocation Sanctum';
  let description = '';
  let color = 0xa855f7;
  let bannerImage = 'https://i.imgur.com/hyNsgc1.jpeg';

  if (category === 'heroic') {
    title = '🔮 Invocation Sanctum — Heroic Spirits Banner';
    color = 0xd4af37;
    bannerImage = 'https://i.imgur.com/hyNsgc1.jpeg';
    description = 
      `💎 **Master Balance:** \`${sq} Saint Quartz\`\n\n` +
      `✨ **Featured Rate-Up Banner:** **Holy Grail War Legends**\n` +
      `🌟 **Featured ★5 SSR Spirits:** Artoria Pendragon, Gilgamesh, Scáthach, Jeanne d'Arc\n` +
      `📜 **Contract Rule:** Each Master forms a sacred bond with a summoned Heroic Spirit.\n\n` +
      `*Select a summoning option below or switch categories using the top tabs.*`;
  } else if (category === 'ces') {
    title = '🛡️ Invocation Sanctum — Craft Essence Forge';
    color = 0x38bdf8;
    bannerImage = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80';
    description =
      `💎 **Master Balance:** \`${sq} Saint Quartz\`\n\n` +
      `🛡️ **Featured Essence Banner:** **Mystic Code Armory**\n` +
      `🌟 **Featured ★5 Essences:** The Black Grail, Kaleidoscope, Formal Craft, Limited/Zero Over\n` +
      `🎁 **Multi-Summon Guarantee:** Every 10x roll guarantees at least one **★4 SR or higher** Craft Essence!\n\n` +
      `*Equip summoned Craft Essences to your Servant in \`/inventory\` to gain massive HP/ATK and passives.*`;
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
    title = '📜 Greater Grail Summoning Rates & Pity Guarantees';
    color = 0x64748b;
    description =
      `📊 **Official Gacha Probability Table:**\n\n` +
      `**Heroic Spirits:**\n` +
      `• ★5 SSR Heroic Spirit: **1.0%** (Rate-up: 0.8%)\n` +
      `• ★4 SR Heroic Spirit: **3.0%**\n` +
      `• ★3 R Heroic Spirit: **40.0%**\n\n` +
      `**Craft Essences:**\n` +
      `• ★5 SSR Craft Essence: **4.0%**\n` +
      `• ★4 SR Craft Essence: **12.0%**\n` +
      `• ★3 R Craft Essence: **84.0%**\n\n` +
      `💎 **Guaranteed Multi-Roll Pity:**\n` +
      `• 10x Multi-Summon guarantees at least one **★4 SR or higher** Craft Essence or Servant.`;
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setImage(bannerImage)
    .setFooter({ text: `Greater Grail Sanctum • Master: ${master.username} • Balance: ${sq} SQ` });

  // Row 1: Category Navigation Tabs
  const catRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('gacha_tab_heroic')
      .setLabel('Heroic Spirits')
      .setEmoji('🔮')
      .setStyle(category === 'heroic' ? ButtonStyle.Primary : ButtonStyle.Secondary),
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
          label: '★5 Holy Grail War Legends (Heroic Spirits)',
          value: 'standard_servant',
          description: 'Summon Saber, Gilgamesh, Scáthach, Jeanne d\'Arc',
          emoji: '🔮',
          default: selectedBanner === 'standard_servant'
        },
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
  let currentCategory: 'heroic' | 'ces' | 'daily' | 'rates' = 'heroic';
  let currentBanner = 'standard_servant';

  const collector = replyMessage.createMessageComponentCollector({
    idle: 180000,
    time: 900000
  });

  collector.on('collect', async (i: any) => {
    try {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ ephemeral: true, content: '❌ This Gacha Sanctum belongs to another Master.' });
        return;
      }

      collector.resetTimer();
      const customId = i.customId;

      // Tab switching
      if (customId === 'gacha_tab_heroic') {
        currentCategory = 'heroic';
        currentBanner = 'standard_servant';
      } else if (customId === 'gacha_tab_ces') {
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
        if (currentBanner === 'standard_servant') currentCategory = 'heroic';
        else if (currentBanner === 'standard_ce') currentCategory = 'ces';
        else if (currentBanner === 'daily_vault') currentCategory = 'daily';
      }

      // Daily Claim Action
      else if (customId === 'gacha_act_claim_daily') {
        const claimResult = await claimDailySaintQuartz(master.discordId || master.id);
        if (claimResult.success) {
          master.saintQuartz = claimResult.newTotalSq;
          await saveMaster(master);
          await i.reply({
            ephemeral: true,
            content: `🎉 **Daily Reward Claimed!** Received **+30 Saint Quartz 💎**!\nNew Balance: **${master.saintQuartz} SQ** (Ready for a 10x Multi-Summon!)`
          });
        } else {
          await i.reply({
            ephemeral: true,
            content: `⏳ ${claimResult.message || 'You have already claimed your Daily Saint Quartz! Please check back tomorrow.'}`
          });
        }
      }

      // 1x Single Summon Action
      else if (customId === 'gacha_act_single') {
        if ((master.saintQuartz || 0) < 3) {
          await i.reply({ ephemeral: true, content: '❌ You need at least 3 Saint Quartz to perform a summon! Claim daily SQ or earn quartz from battles.' });
          return;
        }

        if (currentCategory === 'ces' || currentBanner === 'standard_ce') {
          // CE Roll
          const rollResult = executeCraftEssenceGachaRoll({ count: 1, master });
          master.saintQuartz = rollResult.updatedMaster.saintQuartz;
          master.craftEssences = rollResult.updatedMaster.craftEssences;
          await saveMaster(master);

          const pulled = rollResult.results[0].item;
          const rarityStars = '★'.repeat(pulled.rarity);
          await i.reply({
            ephemeral: true,
            content: `✨ **Summon Result:** You pulled **${rarityStars} ${pulled.name}**!\n• Effect: ${pulled.effectText}\n• Remaining Quartz: **${master.saintQuartz} SQ**\nUse \`/inventory\` to equip it to your Servant!`
          });
        } else {
          // Heroic Spirit Summon Info
          await i.reply({
            ephemeral: true,
            content: `✨ **Heroic Spirit Summoning Ritual:** To invoke an authentic Holy Grail War contract, use \`/summon ritual\`!\nRemaining Quartz: **${master.saintQuartz} SQ**`
          });
        }
      }

      // 10x Multi-Summon Action
      else if (customId === 'gacha_act_multi') {
        if ((master.saintQuartz || 0) < 30) {
          await i.reply({ ephemeral: true, content: '❌ You need at least 30 Saint Quartz for a 10x Multi-Summon!' });
          return;
        }

        // 10x CE Roll
        const rollResult = executeCraftEssenceGachaRoll({ count: 10, master });
        master.saintQuartz = rollResult.updatedMaster.saintQuartz;
        master.craftEssences = rollResult.updatedMaster.craftEssences;
        await saveMaster(master);

        const cardSummary = rollResult.results
          .map((r: any) => `• **${'★'.repeat(r.item.rarity)} ${r.item.name}** — ${r.item.effectText.slice(0, 45)}...`)
          .join('\n');

        await i.reply({
          ephemeral: true,
          content: `🌟 **10x Multi-Summon Results:**\n\n${cardSummary}\n\n💎 **Remaining Quartz:** \`${master.saintQuartz} SQ\`\nUse \`/inventory\` to view your expanded collection and equip them!`
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
          ephemeral: true,
          content: '👑 Opening Servant Workshop... Use `/servant` to view full parameter radar cards and customisation options!'
        });
        return;
      }

      // Cross-Hub Shortcut: Grail War
      else if (customId === 'gacha_link_grailwar') {
        await i.reply({
          ephemeral: true,
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
          ephemeral: true,
          content: `🎉 **Daily Reward Claimed!** Received **+30 Saint Quartz 💎**!\nNew Balance: **${master.saintQuartz} SQ** (Ready for a 10x Multi-Summon!)`
        });
      } else {
        await interaction.reply({
          ephemeral: true,
          content: `⏳ ${claimResult.message || 'You have already claimed your Daily Saint Quartz! Please check back tomorrow.'}`
        });
      }
      return;
    }

    let initialCategory: 'heroic' | 'ces' | 'daily' | 'rates' = 'heroic';
    if (sub === 'ce') initialCategory = 'ces';
    else if (sub === 'rates') initialCategory = 'rates';

    const { embed, components } = buildGachaHub(master, initialCategory);
    const reply = await interaction.reply({
      embeds: [embed],
      components,
      ephemeral: true,
      fetchReply: true
    });

    attachGachaCollector(interaction, master, reply);
  } catch (error: any) {
    console.error('Error executing /gacha:', error);
    await interaction.reply({ content: `❌ Gacha error: ${error.message}`, ephemeral: true });
  }
}
