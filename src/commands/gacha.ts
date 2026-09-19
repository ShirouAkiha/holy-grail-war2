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
import { executeCraftEssenceGachaRoll, executeServantGachaRoll } from '../engine/ceGacha';
import { renderGachaSummonBanner } from '../canvas/renderer';
import { CRAFT_ESSENCE_DATABASE } from '../data/craftEssences';
import { SERVANT_DATABASE } from '../data/servants';
import { buildInventoryHub, attachInventoryCollector } from './customise';
import { safeSetEmbedImage, safeSetEmbedThumbnail } from '../utils/discordEmbedHelper';

export const data = new SlashCommandBuilder()
  .setName('gacha')
  .setDescription('🔮 Greater Grail Invocation Sanctum — Summon Servants, Forge Craft Essences & Claim Daily SQ')
  .addSubcommand(sub =>
    sub
      .setName('menu')
      .setDescription('Open the interactive Gacha Invocation Sanctum Hub')
  )
  .addSubcommand(sub =>
    sub
      .setName('servant')
      .setDescription('Summon Heroic Spirits from the Throne of Heroes (3 SQ for 1x, 30 SQ for 10x)')
      .addIntegerOption(opt =>
        opt
          .setName('rolls')
          .setDescription('Number of rolls (1 or 10)')
          .setRequired(false)
          .addChoices(
            { name: '1x Summon (3 Saint Quartz)', value: 1 },
            { name: '10x Multi-Summon (30 Saint Quartz)', value: 10 }
          )
      )
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
      .setDescription('📜 View summoning rates and balance mechanics')
  );

export const SERVANT_SUMMONING_BANNER = 'https://ella.janitorai.com/media-approved/4eou5BGEGK91VbIpEukgO.webp';

export function buildGachaHub(
  master: any,
  category: 'servants' | 'ces' | 'daily' | 'rates' = 'servants',
  selectedBanner: string = 'throne_servants'
) {
  const sq = master.saintQuartz || 0;
  const ownedServantCount = master.servants?.length || 0;
  let title = '👑 THRONE OF HEROES — HEROIC SPIRIT INVOCATION';
  let description = '';
  let color = 0x38bdf8;
  let bannerImage = SERVANT_SUMMONING_BANNER;

  if (category === 'servants') {
    title = '👑 THRONE OF HEROES — HEROIC SPIRIT INVOCATION';
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
      `💎 **Saint Quartz:** \`${sq} SQ\`  •  🔵 **Mana Prisms:** \`${master.manaPrisms || 0} Prisms\`\n` +
      `👥 **Contracted Roster:** \`${ownedServantCount} Servants\`  •  🔴 **Command Seals:** \`${master.commandSeals ?? 3}/3 Active\`\n\n` +
      `${companionBlock}\n\n` +
      `═══════════════════════════════════════════════\n` +
      `⚔️ **Active Gate:** **Throne of Heroes Summoning Array**\n` +
      `🌟 **Manifesting Classes:** Saber, Archer, Lancer, Rider, Caster, Assassin, Berserker, Extra\n\n` +
      `✨ **Summoning Protocols & Rates:**\n` +
      `• **1x Single Summon:** \`3 Saint Quartz\` ➔ Manifests 1 Heroic Spirit into your roster\n` +
      `• **10x Multi-Summon:** \`30 Saint Quartz\` ➔ High-speed invocation of 10 Heroic Spirits\n` +
      `• **Duplicate Covenant:** Pulling an owned Servant automatically yields **+50 Mana Prisms 🔵**\n` +
      `• **Equalized Multiplayer Balance:** Strategic victory relies on class advantage, tactical skill timing, and Command Seal mastercraft!\n\n` +
      `⚡ *Channel your magical energy into the summoning array using the action buttons below!*`;
  } else if (category === 'ces') {
    title = '🛡️ INVOCATION SANCTUM — CRAFT ESSENCE FORGE';
    color = 0x38bdf8;
    bannerImage = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80';
    description =
      `*“Let silver and steel be the essence. Forge the armaments of antiquity!”*\n\n` +
      `💎 **Master Balance:** \`${sq} Saint Quartz\`  •  🔵 **Prisms:** \`${master.manaPrisms || 0}\`\n\n` +
      `🛡️ **Featured Essence Banner:** **Mystic Code Armory**\n` +
      `🌟 **Featured Relics:** The Black Grail, Kaleidoscope, Formal Craft, Limited/Zero Over\n` +
      `🎁 **Multi-Summon Guarantee:** Every 10x roll guarantees at least one **★4 SR or higher** Craft Essence!\n\n` +
      `Forge and equip powerful Mystic Codes to bestow massive ATK, HP, and passive combat passives onto your Servants!`;
  } else if (category === 'daily') {
    title = '💎 SAINT QUARTZ TREASURY & DAILY VAULT';
    color = 0x10b981;
    bannerImage = 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80';
    description =
      `*“Mana accumulates within the Greater Grail over time. Claim your allotment!”*\n\n` +
      `💎 **Current Vault Balance:** \`${sq} Saint Quartz\`\n` +
      `🏆 **Grail Shards:** \`${master.grailShards || 1} Shards\`  •  🔵 **Mana Prisms:** \`${master.manaPrisms || 50} Prisms\`\n\n` +
      `🎁 **Daily Login Bonus:** Claim **+30 Saint Quartz (Free 10x Multi-Summon)** every 24 hours!\n` +
      `💰 **Combat Inflow:** Earn additional Quartz by participating in Fuyuki Patrols, Boss Raids, and Arena Duels.\n\n` +
      `*Click the **Claim Daily Quartz (+30)** button below to collect today's bounty!*`;
  } else if (category === 'rates') {
    title = '📜 GREATER GRAIL SUMMONING RATES & BALANCE MATRIX';
    color = 0x818cf8;
    description =
      `📊 **Equalized Multiplayer Balance System:**\n\n` +
      `👑 **Heroic Spirits (Servants):**\n` +
      `• All Servants possess equalized base stat potential for balanced multiplayer combat.\n` +
      `• No star-rarity gaps or predatory stat tiers.\n` +
      `• Tactical victory is determined by **Class Advantage**, **Skill Timing**, **Command Seals**, and **Craft Essence synergies**.\n` +
      `• Duplicate Heroic Spirits are converted into **+50 Mana Prisms 🔵**.\n\n` +
      `🛡️ **Craft Essences (Mystic Codes):**\n` +
      `• ★5 SSR Craft Essence: **4.0%**\n` +
      `• ★4 SR Craft Essence: **12.0%**\n` +
      `• ★3 R Craft Essence: **84.0%**\n` +
      `• 10x Multi-Summon guarantees at least one **★4 SR or higher** Craft Essence.`;
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setFooter({ text: `Greater Grail Sanctum • Master: ${master.username} • Balance: ${sq} SQ` });
  
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
      .setLabel('Heroic Spirits')
      .setEmoji('👑')
      .setStyle(category === 'servants' ? ButtonStyle.Primary : ButtonStyle.Secondary),
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
          label: '👑 Throne of Heroes (Heroic Spirits)',
          value: 'throne_servants',
          description: 'Summon Sabers, Archers, Lancers, Riders, Casters, Assassins, Berserkers',
          emoji: '👑',
          default: selectedBanner === 'throne_servants'
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
      .setLabel(category === 'servants' ? '1x Summon Servant (3 SQ)' : '1x Single Summon (3 SQ)')
      .setEmoji('✨')
      .setStyle(ButtonStyle.Success)
      .setDisabled(sq < 3),
    new ButtonBuilder()
      .setCustomId('gacha_act_multi')
      .setLabel(category === 'servants' ? '10x Multi-Summon (30 SQ)' : '10x Multi-Summon (30 SQ)')
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

export function attachGachaCollector(interaction: any, initialMaster: any, replyMessage: any) {
  let master = initialMaster;
  let currentCategory: 'servants' | 'ces' | 'daily' | 'rates' = 'servants';
  let currentBanner = 'throne_servants';

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
      if (customId === 'gacha_tab_servants') {
        currentCategory = 'servants';
        currentBanner = 'throne_servants';
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
        if (currentBanner === 'throne_servants') currentCategory = 'servants';
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

        if (currentCategory === 'servants' || currentBanner === 'throne_servants') {
          // HEROIC SPIRIT SUMMON
          const rollResult = executeServantGachaRoll({ count: 1, master });
          master = rollResult.updatedMaster;
          await saveMaster(master);

          const pulled = rollResult.results[0];
          const s = pulled.servant;

          const embed = new EmbedBuilder()
            .setTitle(`👑 1x Heroic Spirit Summon: ${s.name} (${s.servantClass})!`)
            .setDescription(
              `🗣️ *" ${s.summonQuote || 'I ask of you, are you my Master?'} "*\n\n` +
              `🗡️ **Class:** \`${s.servantClass}\`\n` +
              `📜 **Noble Phantasm:** **${s.noblePhantasm?.name || 'Secret Phantasm'}**\n` +
              `💥 **NP Affinity:** *${s.noblePhantasm?.cardType || 'Buster'}* (${s.noblePhantasm?.target || 'single'}-target) — ${s.noblePhantasm?.description || ''}\n\n` +
              (pulled.isNew 
                ? `🌟 **[NEW CONTRACT ESTABLISHED!]** Formed a sacred covenant with this Heroic Spirit!` 
                : `🔄 **[DUPLICATE SPIRIT ORIGIN]** You already hold a contract with this Servant. Awarded **+${pulled.manaPrismsAwarded} Mana Prisms 🔵**!`) +
              `\n\n💎 **Remaining Saint Quartz:** \`${master.saintQuartz} SQ\` | 🔵 **Prisms:** \`${master.manaPrisms || 0}\``
            )
            .setColor(pulled.isNew ? 0xeab308 : 0x38bdf8);

          safeSetEmbedImage(embed, s.cardArtUrl || s.avatarUrl);
          safeSetEmbedThumbnail(embed, s.avatarUrl);

          await i.reply({
            flags: MessageFlags.Ephemeral,
            embeds: [embed]
          });
        } else {
          // CRAFT ESSENCE SUMMON
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
      }

      // 10x Multi-Summon Action
      else if (customId === 'gacha_act_multi') {
        if ((master.saintQuartz || 0) < 30) {
          await i.reply({ flags: MessageFlags.Ephemeral, content: '❌ You need at least 30 Saint Quartz for a 10x Multi-Summon!' });
          return;
        }

        if (currentCategory === 'servants' || currentBanner === 'throne_servants') {
          // 10x HEROIC SPIRIT SUMMON
          const rollResult = executeServantGachaRoll({ count: 10, master });
          master = rollResult.updatedMaster;
          await saveMaster(master);

          const listSummary = rollResult.results
            .map((r, idx) => {
              const statusTag = r.isNew ? '🌟 **[NEW!]**' : `🔵 *(+50 Prisms)*`;
              return `${idx + 1}. **${r.servant.name}** (\`${r.servant.servantClass}\`) ${statusTag}`;
            })
            .join('\n');

          const embed = new EmbedBuilder()
            .setTitle(`👑 10x Heroic Spirit Multi-Summon Results!`)
            .setDescription(
              `**Throne of Heroes Gate Awakened:**\n\n` +
              listSummary +
              `\n\n` +
              `🌟 **New Servants Contracted:** **+${rollResult.newServantsCount}**\n` +
              `🔵 **Mana Prisms Earned (Duplicates):** **+${rollResult.totalManaPrismsAwarded}**\n` +
              `💎 **Remaining Saint Quartz:** \`${master.saintQuartz} SQ\` | 🔵 **Total Prisms:** \`${master.manaPrisms || 0}\`\n\n` +
              `Use \`/servant\` to view your full roster, allocate stats, and select your active companion!`
            )
            .setColor(0xeab308);

          await i.reply({
            flags: MessageFlags.Ephemeral,
            embeds: [embed]
          });
        } else {
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

    if (sub === 'servant') {
      const rolls = (interaction.options.getInteger('rolls') as 1 | 10) || 1;
      const cost = rolls === 10 ? 30 : 3;
      if ((master.saintQuartz || 0) < cost) {
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: `❌ Insufficient Saint Quartz! You need **${cost} SQ**, but only have **${master.saintQuartz || 0} SQ**.`
        });
        return;
      }

      const rollResult = executeServantGachaRoll({ count: rolls, master });
      await saveMaster(rollResult.updatedMaster);

      if (rolls === 1) {
        const s = rollResult.results[0].servant;
        const isNew = rollResult.results[0].isNew;
        const embed = new EmbedBuilder()
          .setTitle(`👑 1x Heroic Spirit Summon: ${s.name} (${s.servantClass})!`)
          .setDescription(
            `🗣️ *" ${s.summonQuote || 'I ask of you, are you my Master?'} "*\n\n` +
            `🗡️ **Class:** \`${s.servantClass}\`\n` +
            `📜 **Noble Phantasm:** **${s.noblePhantasm?.name || 'Secret Phantasm'}**\n` +
            (isNew 
              ? `🌟 **[NEW CONTRACT ESTABLISHED!]** Formed a sacred covenant with this Heroic Spirit!` 
              : `🔄 **[DUPLICATE SPIRIT ORIGIN]** You already hold a contract with this Servant. Awarded **+50 Mana Prisms 🔵**!`) +
            `\n\n💎 **Remaining Saint Quartz:** \`${rollResult.updatedMaster.saintQuartz} SQ\``
          )
          .setColor(isNew ? 0xeab308 : 0x38bdf8);

        safeSetEmbedImage(embed, s.cardArtUrl || s.avatarUrl);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      } else {
        const listSummary = rollResult.results
          .map((r, idx) => `${idx + 1}. **${r.servant.name}** (\`${r.servant.servantClass}\`) ${r.isNew ? '🌟 **[NEW!]**' : '🔵 *(+50 Prisms)*'}`)
          .join('\n');

        const embed = new EmbedBuilder()
          .setTitle(`👑 10x Heroic Spirit Multi-Summon Results!`)
          .setDescription(
            `**Throne of Heroes Gate Awakened:**\n\n` +
            listSummary +
            `\n\n🌟 **New Servants Contracted:** **+${rollResult.newServantsCount}**\n` +
            `🔵 **Mana Prisms Earned:** **+${rollResult.totalManaPrismsAwarded}**\n` +
            `💎 **Remaining Saint Quartz:** \`${rollResult.updatedMaster.saintQuartz} SQ\``
          )
          .setColor(0xeab308);

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
      return;
    }

    let initialCategory: 'servants' | 'ces' | 'daily' | 'rates' = 'servants';
    if (sub === 'rates') initialCategory = 'rates';
    else if (sub === 'daily') initialCategory = 'daily';
    else if (sub === 'ce') initialCategory = 'ces';
    else initialCategory = 'servants';

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
