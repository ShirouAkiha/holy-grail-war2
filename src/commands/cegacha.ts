import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  AttachmentBuilder,
  ComponentType,
  PermissionFlagsBits
} from 'discord.js';
import { 
  getOrCreateMaster, 
  saveMaster, 
  getActiveGachaBanner, 
  getAllCraftEssences, 
  updateGachaBanner, 
  addCustomCraftEssence,
  updateCraftEssence,
  addSaintQuartzToUser
} from '../database/service';
import { executeCraftEssenceGachaRoll } from '../engine/ceGacha';
import { renderGachaSummonBanner } from '../canvas/renderer';
import { CraftEssence, Rarity } from '../types';
import { getOrInitWarSession, exposeMasterInWar } from '../engine/grailwar';

export const data = new SlashCommandBuilder()
  .setName('cegacha')
  .setDescription('Summon and forge Craft Essences using your Saint Quartz')
  .addSubcommand(sub =>
    sub
      .setName('pull')
      .setDescription('Spend Saint Quartz (3 SQ for 1x, 30 SQ for 10x) to summon Craft Essences')
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
      .setName('banner')
      .setDescription('View the current active Craft Essence Sanctum Banner and featured rate-ups')
  )
  .addSubcommand(sub =>
    sub
      .setName('inventory')
      .setDescription('View your owned Craft Essences and their equipped status')
  )
  .addSubcommand(sub =>
    sub
      .setName('rates')
      .setDescription('View the official drop rates and pity guarantees for the Craft Essence Sanctum')
  )
  .addSubcommand(sub =>
    sub
      .setName('list')
      .setDescription('View the complete catalog of all Craft Essences in the summoning pool')
  )
  .addSubcommand(sub =>
    sub
      .setName('admin_banner')
      .setDescription('Admin: Customize current active Gacha Banner image, title, and rate-ups')
      .addStringOption(opt => opt.setName('title').setDescription('New Banner Title').setRequired(false))
      .addStringOption(opt => opt.setName('subtitle').setDescription('New Subtitle / Rate-up info').setRequired(false))
      .addStringOption(opt => opt.setName('description').setDescription('New Description text').setRequired(false))
      .addAttachmentOption(opt => opt.setName('image_file').setDescription('Upload Banner Image').setRequired(false))
      .addStringOption(opt => opt.setName('image_url').setDescription('Or direct Banner Image URL').setRequired(false))
      .addStringOption(opt => opt.setName('featured_ces').setDescription('Comma-separated list of CE IDs').setRequired(false))
  )
  .addSubcommand(sub =>
    sub
      .setName('admin_addce')
      .setDescription('Admin: Create and register a new Craft Essence into the Gacha pool')
      .addStringOption(opt => opt.setName('name').setDescription('Name of Craft Essence').setRequired(true))
      .addIntegerOption(opt => opt.setName('rarity').setDescription('3★, 4★, or 5★').setRequired(true).addChoices({ name: '5★ SSR', value: 5 }, { name: '4★ SR', value: 4 }, { name: '3★ R', value: 3 }))
      .addStringOption(opt => opt.setName('effect').setDescription('Passive effect description').setRequired(true))
      .addIntegerOption(opt => opt.setName('atk').setDescription('Bonus ATK').setRequired(false))
      .addIntegerOption(opt => opt.setName('hp').setDescription('Bonus HP').setRequired(false))
      .addAttachmentOption(opt => opt.setName('image_file').setDescription('Upload image file').setRequired(false))
      .addStringOption(opt => opt.setName('image_url').setDescription('Direct image URL').setRequired(false))
  )
  .addSubcommand(sub =>
    sub
      .setName('admin_editce')
      .setDescription('Admin: Edit any existing Craft Essence stats, effect, or artwork')
      .addStringOption(opt => opt.setName('target').setDescription('Target CE Name or ID').setRequired(true))
      .addStringOption(opt => opt.setName('name').setDescription('New Name').setRequired(false))
      .addIntegerOption(opt => opt.setName('rarity').setDescription('New Rarity Tier').setRequired(false).addChoices({ name: '5★ SSR', value: 5 }, { name: '4★ SR', value: 4 }, { name: '3★ R', value: 3 }))
      .addStringOption(opt => opt.setName('effect').setDescription('New Effect Description').setRequired(false))
      .addIntegerOption(opt => opt.setName('atk').setDescription('New Bonus ATK').setRequired(false))
      .addIntegerOption(opt => opt.setName('hp').setDescription('New Bonus HP').setRequired(false))
      .addAttachmentOption(opt => opt.setName('image_file').setDescription('Upload artwork image').setRequired(false))
      .addStringOption(opt => opt.setName('image_url').setDescription('Direct artwork image URL').setRequired(false))
  )
  .addSubcommand(sub =>
    sub
      .setName('admin_addsq')
      .setDescription('Admin: Grant Saint Quartz & Summon Tickets to any user')
      .addUserOption(opt => opt.setName('user').setDescription('Target Master').setRequired(true))
      .addIntegerOption(opt => opt.setName('amount').setDescription('Amount of Saint Quartz').setRequired(true))
      .addIntegerOption(opt => opt.setName('tickets').setDescription('Amount of Summon Tickets').setRequired(false))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const sub = interaction.options.getSubcommand() || 'banner';
    const banner = getActiveGachaBanner();
    const allCes = getAllCraftEssences();

    // ========================================================
    // ADMIN SUBCOMMANDS: BANNER, ADD CE & EDIT CE
    // ========================================================
    if (sub === 'admin_banner' || sub === 'admin_addce' || sub === 'admin_editce' || sub === 'admin_addsq') {
      const isGuildAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
                           interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

      if (interaction.guild && !isGuildAdmin) {
        await interaction.reply({
          ephemeral: true,
          embeds: [
            new EmbedBuilder()
              .setTitle('⛔ Administrator Access Required')
              .setDescription('Only server administrators can customize Gacha Banners or register/edit Craft Essences.')
              .setColor(0xef4444)
          ]
        });
        return;
      }

      if (sub === 'admin_banner') {
        const title = interaction.options.getString('title');
        const subtitle = interaction.options.getString('subtitle');
        const description = interaction.options.getString('description');
        const imageAttachment = interaction.options.getAttachment('image_file');
        const imageUrl = interaction.options.getString('image_url');
        const bannerArtUrl = imageAttachment?.url || imageUrl || undefined;
        const featuredCesRaw = interaction.options.getString('featured_ces');

        let featuredCeIds = banner.featuredCeIds;
        if (featuredCesRaw) {
          const parsed = featuredCesRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
          featuredCeIds = [];
          for (const item of parsed) {
            const found = allCes.find(c => c.id.toLowerCase() === item || c.name.toLowerCase().includes(item));
            if (found) featuredCeIds.push(found.id);
            else featuredCeIds.push(item);
          }
        }

        const updated = updateGachaBanner({
          title: title || banner.title,
          subtitle: subtitle || banner.subtitle,
          description: description || banner.description,
          bannerArtUrl: bannerArtUrl || banner.bannerArtUrl,
          featuredCeIds
        });

        const embed = new EmbedBuilder()
          .setTitle(`✨ GACHA BANNER UPDATED SUCCESSFULLY`)
          .setDescription(
            `### ${updated.title}\n` +
            `*${updated.subtitle}*\n\n` +
            `${updated.description}\n\n` +
            `**Featured Rate-Up CEs:** \`${updated.featuredCeIds.join(', ') || 'None'}\``
          )
          .setImage(updated.bannerArtUrl)
          .setColor(0x38bdf8)
          .setFooter({ text: `Updated by Admin ${interaction.user.username}` });

        await interaction.reply({ embeds: [embed] });
        return;
      }

      if (sub === 'admin_addce') {
        const name = interaction.options.getString('name', true).trim();
        const rarity = interaction.options.getInteger('rarity', true) as Rarity;
        const effect = interaction.options.getString('effect', true).trim();
        const atk = interaction.options.getInteger('atk') || (rarity === 5 ? 500 : rarity === 4 ? 300 : 150);
        const hp = interaction.options.getInteger('hp') || (rarity === 5 ? 300 : rarity === 4 ? 200 : 100);
        const imageAttachment = interaction.options.getAttachment('image_file');
        const imageUrl = interaction.options.getString('image_url');
        const finalPicture = imageAttachment?.url || imageUrl || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80';

        const ceId = `ce_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`;
        const newCe: CraftEssence = {
          id: ceId,
          name,
          rarity,
          description: `Custom Mystic Code created by Admin ${interaction.user.username}.`,
          bonusAtk: atk,
          bonusDef: 0,
          bonusHp: hp,
          atkBonus: atk,
          hpBonus: hp,
          effectText: effect,
          passiveType: rarity === 5 ? 'starting_np' : 'atk_up',
          passiveValue: rarity === 5 ? 50 : 20,
          artworkUrl: finalPicture
        };

        addCustomCraftEssence(newCe);

        const stars = '★'.repeat(rarity);
        const embed = new EmbedBuilder()
          .setTitle(`✨ NEW CRAFT ESSENCE REGISTERED`)
          .setDescription(
            `**${newCe.name}** [${stars}] has been added to the Gacha Summoning Pool!\n\n` +
            `• **Effect:** ${newCe.effectText}\n` +
            `• **Stats:** +${atk} ATK | +${hp} HP\n` +
            `• **ID:** \`${newCe.id}\``
          )
          .setImage(finalPicture)
          .setColor(rarity === 5 ? 0xfbbf24 : rarity === 4 ? 0xa855f7 : 0x38bdf8);

        await interaction.reply({ embeds: [embed] });
        return;
      }

      if (sub === 'admin_editce') {
        const target = interaction.options.getString('target', true);
        const newName = interaction.options.getString('name');
        const newRarity = interaction.options.getInteger('rarity') as Rarity | null;
        const newEffect = interaction.options.getString('effect');
        const newAtk = interaction.options.getInteger('atk');
        const newHp = interaction.options.getInteger('hp');
        const imageAttachment = interaction.options.getAttachment('image_file');
        const imageUrl = interaction.options.getString('image_url');
        const newArt = imageAttachment?.url || imageUrl || undefined;

        const updates: Partial<CraftEssence> = {};
        if (newName) updates.name = newName.trim();
        if (newRarity) updates.rarity = newRarity;
        if (newEffect) updates.effectText = newEffect.trim();
        if (newAtk !== null) {
          updates.bonusAtk = newAtk;
          updates.atkBonus = newAtk;
        }
        if (newHp !== null) {
          updates.bonusHp = newHp;
          updates.hpBonus = newHp;
        }
        if (newArt) updates.artworkUrl = newArt;

        const updatedCe = updateCraftEssence(target, updates);

        if (!updatedCe) {
          await interaction.reply({
            ephemeral: true,
            embeds: [
              new EmbedBuilder()
                .setTitle('❌ Craft Essence Not Found')
                .setDescription(`No Craft Essence matching \`${target}\` was found. Use \`/cegacha list\` to view all registered CEs and their IDs.`)
                .setColor(0xef4444)
            ]
          });
          return;
        }

        const stars = '★'.repeat(updatedCe.rarity);
        const embed = new EmbedBuilder()
          .setTitle(`🛠️ CRAFT ESSENCE UPDATED: ${updatedCe.name}`)
          .setDescription(
            `**${updatedCe.name}** [${stars}] has been updated!\n\n` +
            `• **Effect:** ${updatedCe.effectText}\n` +
            `• **Stats:** +${updatedCe.bonusAtk || updatedCe.atkBonus || 0} ATK | +${updatedCe.bonusHp || updatedCe.hpBonus || 0} HP\n` +
            `• **ID:** \`${updatedCe.id}\``
          )
          .setColor(0x38bdf8)
          .setFooter({ text: `Modified by Admin ${interaction.user.username}` });

        if (updatedCe.artworkUrl) {
          embed.setImage(updatedCe.artworkUrl);
        }

        await interaction.reply({ embeds: [embed] });
        return;
      }

      if (sub === 'admin_addsq') {
        const targetUser = interaction.options.getUser('user', true);
        const sqAmount = interaction.options.getInteger('amount', true);
        const ticketsAmount = interaction.options.getInteger('tickets') || 0;

        const result = await addSaintQuartzToUser(
          targetUser.id,
          sqAmount,
          ticketsAmount,
          targetUser.username
        );

        const isAddition = sqAmount >= 0;
        const sqSign = isAddition ? '+' : '';
        const ticketSign = ticketsAmount >= 0 ? '+' : '';

        const embed = new EmbedBuilder()
          .setTitle(`💎 CHALDEA TREASURY GRANT: ${targetUser.username}`)
          .setDescription(
            `**Saint Quartz & Ticket Balance Updated!**\n\n` +
            `👤 **Master:** <@${targetUser.id}> (\`${targetUser.username}\`)\n` +
            `💎 **Saint Quartz Adjustment:** \`${sqSign}${sqAmount.toLocaleString()} SQ\`\n` +
            (ticketsAmount !== 0 ? `🎫 **Summon Tickets Adjustment:** \`${ticketSign}${ticketsAmount.toLocaleString()} Ticket(s)\`\n` : '') +
            `\n📊 **New Total Balance:**\n` +
            `• **Saint Quartz:** 💎 \`${result.newSq.toLocaleString()} SQ\` (Was: ${result.previousSq.toLocaleString()} SQ)\n` +
            `• **Summon Tickets:** 🎫 \`${result.newTickets.toLocaleString()}\` (Was: ${result.previousTickets.toLocaleString()})`
          )
          .setColor(isAddition ? 0x38bdf8 : 0xf59e0b)
          .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
          .setFooter({ text: `Granted by Admin ${interaction.user.username} • Holy Grail War Protocol` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        return;
      }
    }

    // ========================================================
    // 1. SUBCOMMAND: INVENTORY
    // ========================================================
    if (sub === 'inventory') {
      const ownedCes = (master.craftEssences || []).filter(Boolean);
      const activeServant = master.servants?.find(s => s.id === master.activeServantId) || master.servants?.[0];

      if (ownedCes.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('🛡️ Master Craft Essence Vault')
          .setDescription(
            `**${master.username}**, you currently do not own any Craft Essences.\n\n` +
            `💎 **Saint Quartz Balance:** ${master.saintQuartz || 0} SQ\n\n` +
            `Use **/cegacha pull** or click below to forge ancient mystic relics from the leyline altar!`
          )
          .setColor(0x94a3b8);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('cegacha_btn_pull10')
            .setLabel('10x Multi-Summon (30 💎)')
            .setStyle(ButtonStyle.Primary)
            .setDisabled((master.saintQuartz || 0) < 30),
          new ButtonBuilder()
            .setCustomId('cegacha_btn_pull1')
            .setLabel('1x Summon (3 💎)')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled((master.saintQuartz || 0) < 3)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
        return;
      }

      // Group identical CEs with count
      const counts = new Map<string, { ce: any; count: number }>();
      for (const ce of ownedCes) {
        const existing = counts.get(ce.id);
        if (existing) {
          existing.count++;
        } else {
          counts.set(ce.id, { ce, count: 1 });
        }
      }

      const listItems = Array.from(counts.values()).map(({ ce, count }) => {
        const isEquipped = activeServant?.equippedCeId === ce.id || activeServant?.equippedCe?.id === ce.id;
        const star = '★'.repeat(ce.rarity || 3);
        const equippedTag = isEquipped ? ` ⚔️ **[EQUIPPED to ${activeServant?.template?.name || 'Servant'}]**` : '';
        const countTag = count > 1 ? ` (x${count})` : '';
        const atk = ce.bonusAtk || ce.atkBonus || 0;
        const hp = ce.bonusHp || ce.hpBonus || 0;
        return `• **${ce.name}** [${star}]${countTag}${equippedTag}\n  *Effect:* ${ce.effectText}\n  *Stats:* +${atk} ATK | +${hp} HP`;
      });

      const embed = new EmbedBuilder()
        .setTitle(`🛡️ Craft Essence Vault: ${master.username}`)
        .setDescription(
          `💎 **Saint Quartz Balance:** **${master.saintQuartz || 0} SQ**\n` +
          `📦 **Total Essences:** **${ownedCes.length}** | **Unique:** **${counts.size}**\n\n` +
          listItems.slice(0, 15).join('\n\n')
        )
        .setFooter({ text: 'Equip Craft Essences to your Servant using /customise equip' })
        .setColor(0x38bdf8);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('cegacha_btn_pull10')
          .setLabel('10x Multi-Summon (30 💎)')
          .setStyle(ButtonStyle.Primary)
          .setDisabled((master.saintQuartz || 0) < 30),
        new ButtonBuilder()
          .setCustomId('cegacha_btn_pull1')
          .setLabel('1x Summon (3 💎)')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled((master.saintQuartz || 0) < 3)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
      return;
    }

    // ========================================================
    // 5. SUBCOMMAND: LIST (ENCYCLOPEDIA)
    // ========================================================
    if (sub === 'list') {
      const ssrs = allCes.filter(c => c.rarity === 5);
      const srs = allCes.filter(c => c.rarity === 4);
      const rs = allCes.filter(c => c.rarity === 3);

      const formatCe = (c: any) => `• **${c.name}**\n  *Effect:* ${c.effectText}\n  *Stats:* +${c.bonusAtk || c.atkBonus || 0} ATK / +${c.bonusHp || c.hpBonus || 0} HP`;

      const embed = new EmbedBuilder()
        .setTitle('🛡️ Craft Essence Encyclopedia')
        .setDescription(
          `Browse all **${allCes.length}** ancient Mystic Codes and conceptual relics available in the Leyline Altar.\n\n` +
          `### 🌟 5★ SSR Legendaries\n${ssrs.map(formatCe).join('\n')}\n\n` +
          `### 💜 4★ SR Rare Relics\n${srs.map(formatCe).join('\n')}\n\n` +
          `### 💙 3★ R Standard Relics\n${rs.map(formatCe).join('\n')}`
        )
        .setColor(0x38bdf8)
        .setFooter({ text: 'Use /cegacha pull to roll for these items!' });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // ========================================================
    // 2. SUBCOMMAND: RATES
    // ========================================================
    if (sub === 'rates') {
      const embed = new EmbedBuilder()
        .setTitle('📜 Mystic Code Sanctum: Summoning Rates & Probabilities')
        .setDescription(
          `### 🌟 Craft Essence Drop Probabilities\n` +
          `• **5★ SSR Craft Essence:** **${banner.rates.ssrCe}%** *(Featured: Kaleidoscope, The Black Grail, Formal Craft)*\n` +
          `• **4★ SR Craft Essence:** **${banner.rates.srCe}%** *(Featured: The Imaginary Element, Gamer Fuel, Gandr)*\n` +
          `• **3★ R Craft Essence:** **${banner.rates.rCe}%** *(Dragon's Meridian, Jeweled Sword Zelretch)*\n\n` +
          `### 🛡️ 10-Pull Guarantee\n` +
          `Performing a **10x Multi-Summon (30 Saint Quartz)** guarantees at least one **4★ SR or higher Craft Essence** in your roll batch!\n\n` +
          `### 💎 Cost\n` +
          `• **1x Summon:** 3 Saint Quartz\n` +
          `• **10x Summon:** 30 Saint Quartz`
        )
        .setColor(0xf59e0b)
        .setFooter({ text: 'Authentic Fate Holy Grail War System' });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // ========================================================
    // 3. SUBCOMMAND: BANNER (DEFAULT VIEW)
    // ========================================================
    if (sub === 'banner') {
      const featuredList = banner.featuredCeIds
        .map(id => allCes.find(c => c.id === id))
        .filter(Boolean)
        .map(c => `• **${c!.name}** (★${c!.rarity}) — *${c!.effectText}*`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`✨ ${banner.title}`)
        .setDescription(
          `*${banner.subtitle}*\n\n` +
          `${banner.description}\n\n` +
          `### 🌟 Featured Rate-Up Mystic Relics:\n` +
          `${featuredList}\n\n` +
          `💎 **Your Saint Quartz:** **${master.saintQuartz || 0} SQ**\n` +
          `📦 **Owned Craft Essences:** **${(master.craftEssences || []).length}**`
        )
        .setImage(banner.bannerArtUrl)
        .setColor(0x38bdf8)
        .setFooter({ text: '10x Multi-Summon guarantees a 4★ SR or higher Craft Essence!' });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('cegacha_btn_pull10')
          .setLabel('10x Multi-Summon (30 💎)')
          .setStyle(ButtonStyle.Primary)
          .setDisabled((master.saintQuartz || 0) < 30),
        new ButtonBuilder()
          .setCustomId('cegacha_btn_pull1')
          .setLabel('1x Summon (3 💎)')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled((master.saintQuartz || 0) < 3),
        new ButtonBuilder()
          .setCustomId('cegacha_btn_inventory')
          .setLabel('Vault Inventory')
          .setStyle(ButtonStyle.Secondary)
      );

      const reply = await interaction.reply({ embeds: [embed], components: [row], ephemeral: true, fetchReply: true });

      // Handle button interactions
      const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: i => i.user.id === interaction.user.id,
        idle: 120000,
        time: 600000
      });

      collector.on('collect', async i => {
        try {
          if (i.replied || i.deferred) return;
          collector.resetTimer();

          const currentMaster = await getOrCreateMaster(interaction.user.id, interaction.user.username);

          if (i.customId === 'cegacha_btn_inventory') {
            await i.deferUpdate();
            const owned = (currentMaster.craftEssences || []).filter(Boolean);
            const activeServ = currentMaster.servants?.find(s => s.id === currentMaster.activeServantId) || currentMaster.servants?.[0];
            const listStr = owned.map(c => `• **${c.name}** (★${c.rarity})${activeServ?.equippedCeId === c.id ? ' [⚔️ EQUIPPED]' : ''}: ${c.effectText}`).slice(0, 10).join('\n');
            
            await i.followUp({
              ephemeral: true,
              content: `🛡️ **Your Craft Essence Vault (${owned.length} items):**\n${listStr || 'No Craft Essences owned yet.'}`
            });
            return;
          }

          const rollCount = i.customId === 'cegacha_btn_pull10' ? 10 : 1;
          const cost = rollCount === 10 ? 30 : 3;

          if ((currentMaster.saintQuartz || 0) < cost) {
            await i.reply({
              ephemeral: true,
              content: `❌ Insufficient Saint Quartz! You need ${cost} SQ 💎, but only have ${currentMaster.saintQuartz || 0} SQ. Win Grail War battles or claim daily rewards!`
            });
            return;
          }

          await i.deferUpdate();
          const pullResult = executeCraftEssenceGachaRoll({
            count: rollCount as 1 | 10,
            master: currentMaster
          });

          await saveMaster(pullResult.updatedMaster);

          // Render canvas banner
          const canvasBuffer = await renderGachaSummonBanner(pullResult.results, banner.title);
          const attachment = new AttachmentBuilder(canvasBuffer, { name: 'ce_summon.png' });

          const resultsSummary = pullResult.results.map(r => {
            const ce = r.item as any;
            const star = '★'.repeat(r.rarity);
            const newTag = r.isNew ? ' 🌟 **[NEW!]**' : '';
            return `• **${ce.name}** [${star}]${newTag} — *${ce.effectText}* (+${ce.bonusAtk || ce.atkBonus || 0} ATK)`;
          }).join('\n');

          const resultEmbed = new EmbedBuilder()
            .setTitle(`✨ Sacred Relics Forged! (${rollCount}x Summon)`)
            .setDescription(
              `Channeling completed! You spent **${pullResult.spentQuartz} Saint Quartz** 💎.\n\n` +
              `### 🔮 Relics Summoned:\n${resultsSummary}\n\n` +
              `💎 **Remaining Saint Quartz:** **${pullResult.updatedMaster.saintQuartz} SQ**\n` +
              `📦 **Total Essences Owned:** **${pullResult.updatedMaster.craftEssences.length}**`
            )
            .setImage('attachment://ce_summon.png')
            .setColor(pullResult.ssrsPulled > 0 ? 0xfbbf24 : pullResult.srsPulled > 0 ? 0xa855f7 : 0x38bdf8)
            .setFooter({ text: 'Use /customise equip to bind these Mystic Codes to your Servant!' });

          await i.editReply({
            embeds: [resultEmbed],
            files: [attachment],
            components: []
          });
        } catch (err: any) {
          console.error('Error in cegacha button collector:', err);
        }
      });

      return;
    }

    // ========================================================
    // 4. SUBCOMMAND: PULL
    // ========================================================
    if (sub === 'pull') {
      const rolls = (interaction.options.getInteger('rolls') || 1) as 1 | 10;
      const cost = rolls === 10 ? 30 : 3;

      if ((master.saintQuartz || 0) < cost) {
        const embed = new EmbedBuilder()
          .setTitle('❌ Insufficient Saint Quartz')
          .setDescription(
            `You need **${cost} Saint Quartz** 💎 to perform a ${rolls}x Summon, but you currently have **${master.saintQuartz || 0} SQ**.\n\n` +
            `Earn more Saint Quartz by fighting in the Holy Grail War (\`/war attack\`, \`/pvp challenge\`), claiming bounties, or completing battles!`
          )
          .setColor(0xef4444);

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const pullResult = executeCraftEssenceGachaRoll({
        count: rolls,
        master
      });

      await saveMaster(pullResult.updatedMaster);

      const canvasBuffer = await renderGachaSummonBanner(pullResult.results, banner.title);
      const attachment = new AttachmentBuilder(canvasBuffer, { name: 'ce_summon.png' });

      const resultsSummary = pullResult.results.map(r => {
        const ce = r.item as any;
        const star = '★'.repeat(r.rarity);
        const newTag = r.isNew ? ' 🌟 **[NEW!]**' : '';
        return `• **${ce.name}** [${star}]${newTag} — *${ce.effectText}* (+${ce.bonusAtk || ce.atkBonus || 0} ATK)`;
      }).join('\n');

      const resultEmbed = new EmbedBuilder()
        .setTitle(`✨ Sacred Relics Forged! (${rolls}x Summon)`)
        .setDescription(
          `Channeling completed! You spent **${pullResult.spentQuartz} Saint Quartz** 💎.\n\n` +
          `### 🔮 Relics Summoned:\n${resultsSummary}\n\n` +
          `💎 **Remaining Saint Quartz:** **${pullResult.updatedMaster.saintQuartz} SQ**\n` +
          `📦 **Total Essences in Vault:** **${pullResult.updatedMaster.craftEssences.length}**`
        )
        .setImage('attachment://ce_summon.png')
        .setColor(pullResult.ssrsPulled > 0 ? 0xfbbf24 : pullResult.srsPulled > 0 ? 0xa855f7 : 0x38bdf8)
        .setFooter({ text: 'Use /customise equip to bind these Mystic Codes to your Servant!' });

      const boastRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('cegacha_btn_boast')
          .setLabel('Boast Relics to Server')
          .setEmoji('📢')
          .setStyle(ButtonStyle.Danger)
      );

      const pullMsg = await interaction.editReply({
        embeds: [resultEmbed],
        files: [attachment],
        components: [boastRow]
      });

      const boastCollector = pullMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (bi: any) => bi.user.id === interaction.user.id,
        time: 120000
      });

      boastCollector.on('collect', async (bi: any) => {
        if (bi.customId === 'cegacha_btn_boast') {
          const war = getOrInitWarSession(pullResult.updatedMaster);
          exposeMasterInWar(war, interaction.user.id, 'public_command');
          await saveMaster(pullResult.updatedMaster);

          const bestRelic = pullResult.results.sort((a, b) => b.rarity - a.rarity)[0];
          const bestCe = bestRelic?.item as any;
          const starStr = '★'.repeat(bestRelic?.rarity || 4);

          const boastEmbed = new EmbedBuilder()
            .setTitle(`📢 MASTER ANNOUNCEMENT: ${master.username.toUpperCase()} FORGES CRAFT ESSENCE!`)
            .setDescription(
              `Master **${master.username}** has forged sacred mystic relics from the Craft Essence Sanctum!\n\n` +
              `🌟 **Highest Rarity Manifestation:** **${bestCe?.name || 'Mystic Relic'}** [${starStr}]\n` +
              `📜 **Enchantment Effect:** *${bestCe?.effectText || 'Combat Enhancement'}*\n` +
              `⚔️ **Parameters:** +${bestCe?.bonusAtk || bestCe?.atkBonus || 0} ATK | +${bestCe?.bonusHp || bestCe?.hpBonus || 0} HP\n\n` +
              `⚠️ *By broadcasting this mystic forging, Master **${master.username}** is now permanently **EXPOSED** on the War Board (\`/grailwar status\`)!*`
            )
            .setColor(bestRelic?.rarity >= 5 ? 0xfbbf24 : 0x38bdf8);

          if (bestCe?.artworkUrl) {
            boastEmbed.setImage(bestCe.artworkUrl);
          }

          if (bi.channel && 'send' in bi.channel) {
            await (bi.channel as any).send({ embeds: [boastEmbed] });
          }
          await bi.reply({
            content: '📢 You have revealed your Craft Essence pull to the server! Your identity is now permanently exposed on the War Board.',
            ephemeral: true
          });
        }
      });
      return;
    }

  } catch (error: any) {
    console.error('Error executing /cegacha:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ ephemeral: true, content: `❌ Error: ${error.message}` });
    } else {
      await interaction.editReply({ content: `❌ Error: ${error.message}` });
    }
  }
}
