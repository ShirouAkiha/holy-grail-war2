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
  addCustomCraftEssence 
} from '../database/service';
import { executeCraftEssenceGachaRoll } from '../engine/ceGacha';
import { renderGachaSummonBanner } from '../canvas/renderer';
import { CraftEssence, Rarity } from '../types';

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
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const sub = interaction.options.getSubcommand() || 'banner';
    const banner = getActiveGachaBanner();
    const allCes = getAllCraftEssences();

    // ========================================================
    // ADMIN SUBCOMMANDS: BANNER & ADD CE
    // ========================================================
    if (sub === 'admin_banner' || sub === 'admin_addce') {
      const isGuildAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
                           interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

      if (interaction.guild && !isGuildAdmin) {
        await interaction.reply({
          ephemeral: true,
          embeds: [
            new EmbedBuilder()
              .setTitle('⛔ Administrator Access Required')
              .setDescription('Only server administrators can customize Gacha Banners or register new Craft Essences.')
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

      await interaction.reply({ embeds: [embed] });
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

      const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

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

        await interaction.reply({ embeds: [embed] });
        return;
      }

      await interaction.deferReply();

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

      await interaction.editReply({
        embeds: [resultEmbed],
        files: [attachment]
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
