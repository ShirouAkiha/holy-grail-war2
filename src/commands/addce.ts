import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';
import { 
  addCustomCraftEssence, 
  getAllCraftEssences, 
  getActiveGachaBanner, 
  updateGachaBanner,
  updateCraftEssence
} from '../database/service';
import { CraftEssence, Rarity } from '../types';

// ==========================================
// 1. ADMIN SLASH COMMAND DEFINITION FOR CRAFT ESSENCES & GACHA BANNERS
// ==========================================
export const data = new SlashCommandBuilder()
  .setName('addce')
  .setDescription('Admin command to create, edit, and customize Craft Essences and Gacha Banners')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
    sub
      .setName('create')
      .setDescription('Register a brand new Craft Essence into the Gacha summoning pool')
      .addStringOption(opt =>
        opt
          .setName('name')
          .setDescription('Name of the Craft Essence (e.g. Heaven\'s Feel, Volumen Hydragyrum)')
          .setRequired(true)
      )
      .addIntegerOption(opt =>
        opt
          .setName('rarity')
          .setDescription('Craft Essence Rarity Tier')
          .setRequired(true)
          .addChoices(
            { name: '5★ SSR (Legendary Relic)', value: 5 },
            { name: '4★ SR (Rare Mystic Code)', value: 4 },
            { name: '3★ R (Standard Relic)', value: 3 }
          )
      )
      .addStringOption(opt =>
        opt
          .setName('effect')
          .setDescription('Passive ability description (e.g. +50% Starting NP Gauge, +25% Buster Damage)')
          .setRequired(true)
      )
      .addIntegerOption(opt =>
        opt
          .setName('atk')
          .setDescription('Bonus Attack stat granted to equipped Servant')
          .setRequired(false)
      )
      .addIntegerOption(opt =>
        opt
          .setName('hp')
          .setDescription('Bonus HP stat granted to equipped Servant')
          .setRequired(false)
      )
      .addAttachmentOption(opt =>
        opt
          .setName('image_file')
          .setDescription('Upload artwork image for this Craft Essence')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('image_url')
          .setDescription('Or provide a direct image URL (https://...)')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('passive_type')
          .setDescription('System mechanic trigger for combat')
          .setRequired(false)
          .addChoices(
            { name: '✨ Starting NP Gauge', value: 'starting_np' },
            { name: '🔴 Buster Card Up', value: 'buster_up' },
            { name: '🔵 Arts Card Up', value: 'arts_up' },
            { name: '🟢 Quick Card Up', value: 'quick_up' },
            { name: '💥 Critical Damage Up', value: 'crit_dmg' },
            { name: '⚔️ Attack Power Up', value: 'atk_up' }
          )
      )
      .addIntegerOption(opt =>
        opt
          .setName('passive_value')
          .setDescription('Numeric value for passive effect (e.g. 50 for 50% NP, 25 for 25% Buster)')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('edit')
      .setDescription('Edit any existing Craft Essence stats, effect, artwork, or rarity')
      .addStringOption(opt =>
        opt
          .setName('target')
          .setDescription('Name or ID of the Craft Essence to modify (e.g. "ce_kaleidoscope" or "Kaleidoscope")')
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt
          .setName('name')
          .setDescription('New Name for the Craft Essence')
          .setRequired(false)
      )
      .addIntegerOption(opt =>
        opt
          .setName('rarity')
          .setDescription('New Rarity Tier')
          .setRequired(false)
          .addChoices(
            { name: '5★ SSR', value: 5 },
            { name: '4★ SR', value: 4 },
            { name: '3★ R', value: 3 }
          )
      )
      .addStringOption(opt =>
        opt
          .setName('effect')
          .setDescription('New Passive Effect description')
          .setRequired(false)
      )
      .addIntegerOption(opt =>
        opt
          .setName('atk')
          .setDescription('New Bonus ATK stat')
          .setRequired(false)
      )
      .addIntegerOption(opt =>
        opt
          .setName('hp')
          .setDescription('New Bonus HP stat')
          .setRequired(false)
      )
      .addAttachmentOption(opt =>
        opt
          .setName('image_file')
          .setDescription('Upload new artwork image file')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('image_url')
          .setDescription('Direct image URL for artwork (https://...)')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('passive_type')
          .setDescription('New combat mechanic trigger')
          .setRequired(false)
          .addChoices(
            { name: '✨ Starting NP Gauge', value: 'starting_np' },
            { name: '🔴 Buster Card Up', value: 'buster_up' },
            { name: '🔵 Arts Card Up', value: 'arts_up' },
            { name: '🟢 Quick Card Up', value: 'quick_up' },
            { name: '💥 Critical Damage Up', value: 'crit_dmg' },
            { name: '⚔️ Attack Power Up', value: 'atk_up' }
          )
      )
      .addIntegerOption(opt =>
        opt
          .setName('passive_value')
          .setDescription('New percentage / value for passive effect')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('banner')
      .setDescription('Customize the active Craft Essence Gacha Banner image, title, and featured rate-ups')
      .addStringOption(opt =>
        opt
          .setName('title')
          .setDescription('Main Banner Title (e.g. Mystic Code Sanctum: Sacred Relics)')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('subtitle')
          .setDescription('Subtitle / Rate-up emphasis (e.g. Featured Rate-Up: Kaleidoscope & Heaven\'s Feel)')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('description')
          .setDescription('Introductory text shown on the banner')
          .setRequired(false)
      )
      .addAttachmentOption(opt =>
        opt
          .setName('image_file')
          .setDescription('Upload new Banner artwork image')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('image_url')
          .setDescription('Or provide direct image URL for the Gacha Banner (https://...)')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('featured_ces')
          .setDescription('Comma-separated list of CE IDs to rate-up (e.g. ce_kaleidoscope, ce_black_grail)')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('list')
      .setDescription('View all Craft Essences in the summoning pool')
  );

// ==========================================
// 2. COMMAND EXECUTION HANDLER
// ==========================================
export async function execute(interaction: ChatInputCommandInteraction) {
  // Permission Guard
  const isGuildAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
                       interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

  if (interaction.guild && !isGuildAdmin) {
    await interaction.reply({
      ephemeral: true,
      embeds: [
        new EmbedBuilder()
          .setTitle('⛔ Administrator Access Required')
          .setDescription('Only server administrators can manage Craft Essences and Gacha Banners.')
          .setColor(0xef4444)
      ]
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  // ------------------------------------------
  // A. CREATE NEW CRAFT ESSENCE
  // ------------------------------------------
  if (subcommand === 'create') {
    const name = interaction.options.getString('name', true).trim();
    const rarity = interaction.options.getInteger('rarity', true) as Rarity;
    const effect = interaction.options.getString('effect', true).trim();
    const atk = interaction.options.getInteger('atk') || (rarity === 5 ? 500 : rarity === 4 ? 300 : 150);
    const hp = interaction.options.getInteger('hp') || (rarity === 5 ? 300 : rarity === 4 ? 200 : 100);
    
    const imageAttachment = interaction.options.getAttachment('image_file');
    const imageUrl = interaction.options.getString('image_url');
    const finalPicture = imageAttachment?.url || imageUrl || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80';

    const passiveType = interaction.options.getString('passive_type') || (rarity === 5 ? 'starting_np' : 'atk_up');
    const passiveValue = interaction.options.getInteger('passive_value') || (rarity === 5 ? 50 : rarity === 4 ? 25 : 15);

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
      passiveType,
      passiveValue,
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
        `• **Passive Mechanic:** \`${passiveType}\` (${passiveValue}%)\n` +
        `• **ID:** \`${newCe.id}\`\n\n` +
        `*Masters can now pull this Craft Essence using \`/cegacha pull\`!*`
      )
      .setImage(finalPicture)
      .setColor(rarity === 5 ? 0xfbbf24 : rarity === 4 ? 0xa855f7 : 0x38bdf8)
      .setFooter({ text: `Registered by Admin ${interaction.user.username}` });

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // ------------------------------------------
  // B. EDIT EXISTING CRAFT ESSENCE
  // ------------------------------------------
  if (subcommand === 'edit') {
    const target = interaction.options.getString('target', true);
    const newName = interaction.options.getString('name');
    const newRarity = interaction.options.getInteger('rarity') as Rarity | null;
    const newEffect = interaction.options.getString('effect');
    const newAtk = interaction.options.getInteger('atk');
    const newHp = interaction.options.getInteger('hp');
    const imageAttachment = interaction.options.getAttachment('image_file');
    const imageUrl = interaction.options.getString('image_url');
    const newArt = imageAttachment?.url || imageUrl || undefined;
    const newPassiveType = interaction.options.getString('passive_type');
    const newPassiveValue = interaction.options.getInteger('passive_value');

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
    if (newPassiveType) updates.passiveType = newPassiveType;
    if (newPassiveValue !== null) updates.passiveValue = newPassiveValue;

    const updatedCe = updateCraftEssence(target, updates);

    if (!updatedCe) {
      await interaction.reply({
        ephemeral: true,
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Craft Essence Not Found')
            .setDescription(`No Craft Essence matching \`${target}\` was found in the database. Use \`/addce list\` to see all registered CE IDs and names.`)
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
        `• **Passive Mechanic:** \`${updatedCe.passiveType || 'N/A'}\` (${updatedCe.passiveValue || 0}%)\n` +
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

  // ------------------------------------------
  // C. CUSTOMIZE GACHA BANNER
  // ------------------------------------------
  if (subcommand === 'banner') {
    const current = getActiveGachaBanner();
    const title = interaction.options.getString('title');
    const subtitle = interaction.options.getString('subtitle');
    const description = interaction.options.getString('description');
    const imageAttachment = interaction.options.getAttachment('image_file');
    const imageUrl = interaction.options.getString('image_url');
    const bannerArtUrl = imageAttachment?.url || imageUrl || undefined;
    const featuredCesRaw = interaction.options.getString('featured_ces');

    let featuredCeIds = current.featuredCeIds;
    if (featuredCesRaw) {
      const allCes = getAllCraftEssences();
      const parsed = featuredCesRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      featuredCeIds = [];

      for (const item of parsed) {
        const found = allCes.find(c => c.id.toLowerCase() === item || c.name.toLowerCase().includes(item));
        if (found) {
          featuredCeIds.push(found.id);
        } else {
          featuredCeIds.push(item);
        }
      }
    }

    const updated = updateGachaBanner({
      title: title || current.title,
      subtitle: subtitle || current.subtitle,
      description: description || current.description,
      bannerArtUrl: bannerArtUrl || current.bannerArtUrl,
      featuredCeIds
    });

    const embed = new EmbedBuilder()
      .setTitle(`✨ GACHA BANNER UPDATED SUCCESSFULLY`)
      .setDescription(
        `### ${updated.title}\n` +
        `*${updated.subtitle}*\n\n` +
        `${updated.description}\n\n` +
        `**Featured Rate-Up CEs:** \`${updated.featuredCeIds.join(', ') || 'None'}\`\n\n` +
        `*Changes are now live for all Masters invoking \`/cegacha banner\`!*`
      )
      .setImage(updated.bannerArtUrl)
      .setColor(0x38bdf8)
      .setFooter({ text: `Updated by Admin ${interaction.user.username}` });

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // ------------------------------------------
  // C. LIST ALL CRAFT ESSENCES
  // ------------------------------------------
  if (subcommand === 'list') {
    const allCes = getAllCraftEssences();
    const listText = allCes.map((ce, idx) => {
      const star = '★'.repeat(ce.rarity);
      return `**${idx + 1}. ${ce.name}** [${star}]\n  • ID: \`${ce.id}\` | +${ce.bonusAtk || ce.atkBonus || 0} ATK, +${ce.bonusHp || ce.hpBonus || 0} HP\n  • Effect: *${ce.effectText}*`;
    }).join('\n\n');

    const embed = new EmbedBuilder()
      .setTitle(`🛡️ Craft Essence Registry (${allCes.length} Total Relics)`)
      .setDescription(listText.slice(0, 4000))
      .setColor(0x38bdf8);

    await interaction.reply({ embeds: [embed] });
    return;
  }
}
