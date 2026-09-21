import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  AutocompleteInteraction,
  EmbedBuilder,
  AttachmentBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
  MessageFlags,
  User
} from 'discord.js';
import { 
  getAllThroneServants,
  setServantNpAnimation,
  getServantNpAnimation,
  getAllCustomNpAnimations,
  getDuelNpSettings,
  setDuelNpSettings,
  matchServantSearch,
  getOrCreateMaster,
  saveMaster,
  getAllMasters,
  giveCurrencyToMaster,
  removeCurrencyFromMaster,
  setMasterStat,
  giveCraftEssenceToMaster,
  removeCraftEssenceFromMaster,
  giveServantToMaster,
  removeServantFromMaster,
  getAllCraftEssences,
  findServantInPool,
  resetAllMastersServants,
  resetSingleMasterServant,
  resetSingleMasterCurrency,
  resetSingleMasterInventory,
  resetSingleMasterVault,
  resetAllMastersInventoryAndCurrency
} from '../database/service';
import {
  getOrInitWarSession,
  saveWarToDisk,
  WAR_PRESETS,
  startOrRestartWar,
  resetHolyGrailWar,
  updateWarRules,
  triggerAdminCataclysm,
  refillAllWarParticipantsSeals
} from '../engine/grailwar';
import { startWarRecruitment, igniteWarFromRecruitment, cancelRecruitmentCall } from '../engine/warRecruitmentService';
import { WarRules, MasterProfile } from '../types';
import { safeSetEmbedImage, safeSetEmbedThumbnail } from '../utils/discordEmbedHelper';

interface AnnounceDraft {
  presetKey: string;
  durationMinutes: number;
  maxSlots: number;
  targetChannelId?: string;
}

let adminAnnounceDraft: AnnounceDraft = {
  presetKey: 'fuyuki_7',
  durationMinutes: 15,
  maxSlots: 7
};
import {
  getAllCharacterProfiles,
  getServantCharacterProfile,
  saveCustomCharacterProfile,
  deleteCustomCharacterProfile,
  hasCustomCharacterProfile,
  ServantCharacterProfile,
  DEFAULT_SERVANT_CHARACTER_PROFILES
} from '../data/characterProfiles';

// ==========================================
// 1. SLASH COMMAND DEFINITION
// ==========================================
export const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Fate/Grand Order Admin Hub — Master Management, Inventory, War Rules & Controls')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
    sub
      .setName('hub')
      .setDescription('Open the interactive Master Admin Dashboard')
      .addStringOption(opt =>
        opt
          .setName('category')
          .setDescription('Select administrative control panel')
          .setRequired(false)
          .addChoices(
            { name: '🏆 Holy Grail War Ritual & Rules', value: 'war' },
            { name: '👤 Master Dossier & Inventory Overseer', value: 'masters' },
            { name: '🎭 Servant AI Personas & Character Cards', value: 'personas' },
            { name: '🎬 NP Animations & Chant Registry', value: 'npanim' },
            { name: '⚙️ Duel NP Settings & Timing', value: 'npsettings' },
            { name: '📋 Registered Custom Animations', value: 'listnp' },
            { name: '💎 Economy & Saint Quartz Mint', value: 'economy' }
          )
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('persona')
      .setDescription('Configure, inspect, or customize Servant AI character cards, speech quirks, and lore')
      .addStringOption(opt =>
        opt
          .setName('action')
          .setDescription('Persona management action')
          .setRequired(true)
          .addChoices(
            { name: '📖 View Character Card & Quotes', value: 'view' },
            { name: '📋 List All Configured Personas', value: 'list' },
            { name: '✏️ Edit / Register Persona Card', value: 'edit' },
            { name: '🗑️ Delete Custom Override / Reset', value: 'delete' }
          )
      )
      .addStringOption(opt =>
        opt
          .setName('servant')
          .setDescription('Target Servant name or Heroic Spirit identity')
          .setRequired(false)
          .setAutocomplete(true)
      )
      .addStringOption(opt =>
        opt
          .setName('persona_lore')
          .setDescription('Full character persona description (Tavern / Character Card format)')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('speech_examples')
          .setDescription('Authentic dialogue lines separated by semicolons (;) or newlines')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('mannerisms')
          .setDescription('Key mannerisms & quirks separated by semicolons (;) or newlines')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('banned_tropes')
          .setDescription('Banned assistant phrases separated by commas')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('give')
      .setDescription('Grant currency, items, Craft Essences, or Servants to any Master')
      .addUserOption(opt =>
        opt
          .setName('user')
          .setDescription('Target Master to receive items')
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt
          .setName('item')
          .setDescription('Resource or item type to grant')
          .setRequired(true)
          .addChoices(
            { name: '💎 Saint Quartz (SQ)', value: 'sq' },
            { name: '🎫 Summon Tickets', value: 'tickets' },
            { name: '🔱 Command Seals', value: 'seals' },
            { name: '⚡ Stat Points (for active Servant)', value: 'stat_points' },
            { name: '🧬 Homunculus Helpers', value: 'homunculi' },
            { name: '⚡ Action Points (AP)', value: 'ap' },
            { name: '🃏 Craft Essence (Relic)', value: 'ce' },
            { name: '⚔️ Heroic Spirit (Servant Contract)', value: 'servant' }
          )
      )
      .addIntegerOption(opt =>
        opt
          .setName('amount')
          .setDescription('Quantity to give (default: 1; for SQ default: 30)')
          .setMinValue(1)
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('name')
          .setDescription('Name of the Craft Essence or Servant (required if item is CE or Servant)')
          .setRequired(false)
          .setAutocomplete(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('remove')
      .setDescription('Deduct currency, remove Craft Essences, or sever Servants from any Master')
      .addUserOption(opt =>
        opt
          .setName('user')
          .setDescription('Target Master to modify')
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt
          .setName('item')
          .setDescription('Resource or item type to remove')
          .setRequired(true)
          .addChoices(
            { name: '💎 Saint Quartz (SQ)', value: 'sq' },
            { name: '🎫 Summon Tickets', value: 'tickets' },
            { name: '🔱 Command Seals', value: 'seals' },
            { name: '⚡ Stat Points', value: 'stat_points' },
            { name: '🧬 Homunculus Helpers', value: 'homunculi' },
            { name: '⚡ Action Points (AP)', value: 'ap' },
            { name: '🃏 Craft Essence (Relic)', value: 'ce' },
            { name: '⚔️ Heroic Spirit (Sever Contract)', value: 'servant' },
            { name: '🎒 Wipe ALL Craft Essences', value: 'all_ces' }
          )
      )
      .addIntegerOption(opt =>
        opt
          .setName('amount')
          .setDescription('Quantity to remove (default: 1)')
          .setMinValue(1)
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('name')
          .setDescription('Name of the Craft Essence or Servant to remove')
          .setRequired(false)
          .setAutocomplete(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('set')
      .setDescription('Set an exact numerical balance or stat value for any Master or active Servant')
      .addUserOption(opt =>
        opt
          .setName('user')
          .setDescription('Target Master')
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt
          .setName('attribute')
          .setDescription('Attribute to set')
          .setRequired(true)
          .addChoices(
            { name: '💎 Saint Quartz', value: 'sq' },
            { name: '🎫 Summon Tickets', value: 'tickets' },
            { name: '🔱 Command Seals (0-3)', value: 'seals' },
            { name: '🧬 Homunculi', value: 'homunculi' },
            { name: '⚡ Action Points', value: 'ap' },
            { name: '⚔️ Servant Level (1-100)', value: 'servant_level' },
            { name: '💖 Servant Bond Level (0-10)', value: 'servant_bond' },
            { name: '⚡ Available Stat Points', value: 'stat_points' },
            { name: '💪 Allocated STR Points', value: 'servant_str' },
            { name: '🛡️ Allocated END Points', value: 'servant_end' },
            { name: '💨 Allocated AGI Points', value: 'servant_agi' },
            { name: '🔮 Allocated MANA Points', value: 'servant_mana' },
            { name: '🍀 Allocated LUCK Points', value: 'servant_lck' }
          )
      )
      .addIntegerOption(opt =>
        opt
          .setName('value')
          .setDescription('New integer value')
          .setMinValue(0)
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('inspect')
      .setDescription('View complete dossier, currencies, inventory, and stats of any Master')
      .addUserOption(opt =>
        opt
          .setName('user')
          .setDescription('Master to inspect')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('master')
      .setDescription('Execute targeted management actions on any Master')
      .addStringOption(opt =>
        opt
          .setName('action')
          .setDescription('Administrative action to perform')
          .setRequired(true)
          .addChoices(
            { name: '🔍 Inspect Dossier & Inventory', value: 'inspect' },
            { name: '💎 Mint +30 Saint Quartz', value: 'give_30sq' },
            { name: '💎 Mint +100 Saint Quartz', value: 'give_100sq' },
            { name: '🪙 Mint +1,000,000 QP', value: 'give_1mqp' },
            { name: '🔱 Refill Command Seals (3/3)', value: 'refill_seals' },
            { name: '⚡ Grant +10 Stat Points', value: 'give_stat_points' },
            { name: '🃏 Grant Craft Essence (uses name)', value: 'give_ce' },
            { name: '⚔️ Contract Heroic Spirit (uses name)', value: 'give_servant' },
            { name: '🗡️ Sever Active Servant Contract', value: 'sever_servant' },
            { name: '🎒 Wipe All Craft Essences', value: 'reset_inventory' },
            { name: '🧹 Reset Currency (SQ: 30, QP/Tickets: 0)', value: 'reset_currency' },
            { name: '🔄 Full Vault Reset (Items & Currency)', value: 'reset_vault' },
            { name: '🌱 Reset Servant to Level 1', value: 'reset_servant_stats' }
          )
      )
      .addUserOption(opt =>
        opt
          .setName('user')
          .setDescription('Target Master')
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt
          .setName('name')
          .setDescription('Craft Essence or Servant name (when granting CE/Servant)')
          .setRequired(false)
          .setAutocomplete(true)
      )
      .addIntegerOption(opt =>
        opt
          .setName('amount')
          .setDescription('Quantity (default: 1)')
          .setMinValue(1)
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('war')
      .setDescription('Manage Holy Grail War lifecycle, rules presets, reset, and cataclysm events')
      .addStringOption(opt =>
        opt
          .setName('action')
          .setDescription('War administration action')
          .setRequired(true)
          .addChoices(
            { name: '📢 Announce Holy Grail War (Timer & Anonymous Recruitment)', value: 'call' },
            { name: '📊 Open War Rules Dashboard', value: 'dashboard' },
            { name: '🚀 Launch / Restart War with Preset', value: 'restart' },
            { name: '🔄 Quick Reset (Restore HP & Seals)', value: 'reset' },
            { name: '⚡ Trigger Leyline Cataclysm Event', value: 'cataclysm' },
            { name: '📜 View War History & Hall of Fame', value: 'history' }
          )
      )
      .addIntegerOption(opt =>
        opt
          .setName('timer')
          .setDescription('Recruitment countdown timer in minutes (e.g. 5, 15, 30, 60; 0 for manual start)')
          .setMinValue(0)
          .setMaxValue(1440)
          .setRequired(false)
      )
      .addIntegerOption(opt =>
        opt
          .setName('max_slots')
          .setDescription('Maximum Master slots to randomly choose (e.g. 7 for Fuyuki, 14 for Apocrypha, default: 7)')
          .setMinValue(2)
          .setMaxValue(30)
          .setRequired(false)
      )
      .addChannelOption(opt =>
        opt
          .setName('channel')
          .setDescription('Channel to broadcast the recruitment proclamation in (default: current channel)')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('preset')
          .setDescription('Rules preset for war initialization')
          .setRequired(false)
          .addChoices(
            { name: '🏆 5th Fuyuki War (7 Masters, Canon Only, Strict Classes)', value: 'fuyuki_7' },
            { name: '⚔️ Trifas Great War (14 Masters, Black vs Red Factions)', value: 'apocrypha_14' },
            { name: '🌌 Grand Singularity Chaos (30 Masters FFA, Fast Mana)', value: 'singularity_chaos' },
            { name: '💀 Desolate Hardcore (7 Masters, 1 Seal, Permadeath, No Church)', value: 'desolate_hardcore' }
          )
      )
      .addStringOption(opt =>
        opt
          .setName('cataclysm')
          .setDescription('Leyline cataclysm event type')
          .setRequired(false)
          .addChoices(
            { name: '🌊 Grail Mud Overflow (All Masters Take 2,500 DMG & Exposed)', value: 'grail_mud' },
            { name: '🔥 Fuyuki Inferno (Dissolves Traps & Forces Out Church Refugees)', value: 'fuyuki_fire' },
            { name: '👁️ Angra Mainyu Descends (1,500 Shockwave DMG to All Servants)', value: 'angra_mainyu' },
            { name: '⚡ Leyline Mana Surge (+1 Seal & 50% HP Heal to All Masters)', value: 'mana_surge' }
          )
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('npanim')
      .setDescription('Set or customize the Noble Phantasm animated GIF for any Servant')
      .addStringOption(opt =>
        opt
          .setName('servant')
          .setDescription('Name or ID of the Servant to customize')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(opt =>
        opt
          .setName('gif_url')
          .setDescription('URL of the animated GIF (Tenor, Giphy, direct .gif, or Discord media link)')
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt
          .setName('chant')
          .setDescription('Optional custom True Name invocation chant')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('npsettings')
      .setDescription('Configure duel Noble Phantasm animation behavior (duration & auto-delete)')
      .addBooleanOption(opt =>
        opt
          .setName('autodelete')
          .setDescription('Auto-delete NP animation message when next turn is chosen (default: True)')
          .setRequired(false)
      )
      .addIntegerOption(opt =>
        opt
          .setName('afk_timeout')
          .setDescription('AFK safety timeout in seconds before auto-delete (default: 60s)')
          .setMinValue(15)
          .setMaxValue(300)
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('listnp')
      .setDescription('View all custom Noble Phantasm animations currently registered')
  )
  .addSubcommand(sub =>
    sub
      .setName('economy')
      .setDescription('Manage currency minting, inventory resets, and vault wipes')
      .addStringOption(opt =>
        opt
          .setName('action')
          .setDescription('Economy & Vault action')
          .setRequired(true)
          .addChoices(
            { name: '💎 Mint +30 Saint Quartz', value: 'mint_30sq' },
            { name: '💎 Mint +100 Saint Quartz', value: 'mint_100sq' },
            { name: '🪙 Mint +1,000,000 QP', value: 'mint_qp' },
            { name: '🔱 Refill Command Seals (3/3)', value: 'refill_seals' },
            { name: '🧹 Reset My Currency (SQ to 30, QP/Tickets/Shards to 0)', value: 'reset_currency' },
            { name: '🎒 Reset My Inventory (Wipe all Craft Essences & items)', value: 'reset_inventory' },
            { name: '🔄 Reset All My Vault (Items + Currency to defaults)', value: 'reset_vault' },
            { name: '⚠️ Server-Wide Wipe (All Masters Items & Currency)', value: 'server_wipe' }
          )
      )
      .addUserOption(opt =>
        opt
          .setName('user')
          .setDescription('Optional target Master (defaults to you if omitted)')
          .setRequired(false)
      )
  );

// ==========================================
// 2. AUTOCOMPLETE
// ==========================================
export async function autocomplete(interaction: AutocompleteInteraction) {
  try {
    const focusedOption = interaction.options.getFocused(true);
    const query = focusedOption.value.toLowerCase().trim();
    const allServants = getAllThroneServants();
    const allCes = getAllCraftEssences();

    if (focusedOption.name === 'servant') {
      const matches = allServants
        .filter(s => matchServantSearch(s, query))
        .slice(0, 25);

      await interaction.respond(
        matches.map(s => ({
          name: `${s.name} (${s.servantClass})`,
          value: s.name
        }))
      );
      return;
    }

    if (focusedOption.name === 'name') {
      const itemType = interaction.options.getString('item') || interaction.options.getString('action');

      if (itemType === 'ce' || itemType === 'give_ce' || itemType === 'remove_ce') {
        const ceMatches = allCes
          .filter(c => c.name.toLowerCase().includes(query) || c.id.toLowerCase().includes(query))
          .slice(0, 25);

        await interaction.respond(
          ceMatches.map(c => ({
            name: `🃏 [${c.rarity}★ CE] ${c.name}`,
            value: c.name
          }))
        );
        return;
      }

      if (itemType === 'servant' || itemType === 'give_servant') {
        const sMatches = allServants
          .filter(s => matchServantSearch(s, query))
          .slice(0, 25);

        await interaction.respond(
          sMatches.map(s => ({
            name: `⚔️ [${s.rarity}★ ${s.servantClass}] ${s.name}`,
            value: s.name
          }))
        );
        return;
      }

      // Default combined autocomplete (search both CEs and Servants)
      const combined: { name: string; value: string }[] = [];
      for (const s of allServants) {
        if (matchServantSearch(s, query)) {
          combined.push({ name: `⚔️ [${s.rarity}★ ${s.servantClass}] ${s.name}`, value: s.name });
        }
        if (combined.length >= 13) break;
      }
      for (const c of allCes) {
        if (c.name.toLowerCase().includes(query) || c.id.toLowerCase().includes(query)) {
          combined.push({ name: `🃏 [${c.rarity}★ CE] ${c.name}`, value: c.name });
        }
        if (combined.length >= 25) break;
      }

      await interaction.respond(combined.slice(0, 25));
    }
  } catch (err: any) {
    if (err.code === 10062 || err.code === 40060 || err.message?.includes('Unknown interaction')) {
      return;
    }
    console.warn('Admin autocomplete warning:', err?.message || err);
  }
}

// ==========================================
// 3. MAIN EXECUTE
// ==========================================
export async function execute(interaction: ChatInputCommandInteraction) {
  let subcommand: string | null = null;
  try {
    subcommand = interaction.options.getSubcommand();
  } catch {
    // If no subcommand was supplied, fallback to category option or default hub
  }

  const category = (subcommand as any) || (interaction.options.getString('category') as any) || 'war';

  // --- /admin give ---
  if (subcommand === 'give') {
    const targetUser = interaction.options.getUser('user', true);
    const itemType = interaction.options.getString('item', true);
    const rawAmount = interaction.options.getInteger('amount');
    const itemName = interaction.options.getString('name')?.trim();

    await getOrCreateMaster(targetUser.id, targetUser.username);

    if (itemType === 'ce') {
      if (!itemName) {
        await interaction.reply({
          content: '⚠️ Please specify the Craft Essence `name` to grant.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      const res = await giveCraftEssenceToMaster(targetUser.id, itemName, rawAmount || 1);
      const embed = new EmbedBuilder()
        .setTitle('🃏 CRAFT ESSENCE BESTOWAL')
        .setDescription(res.message)
        .setColor(res.success ? 0x10b981 : 0xef4444)
        .setFooter({ text: `Authorized by Overseer ${interaction.user.username}` });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (itemType === 'servant') {
      if (!itemName) {
        await interaction.reply({
          content: '⚠️ Please specify the Heroic Spirit `name` to contract.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      const res = await giveServantToMaster(targetUser.id, itemName, { level: rawAmount || 1 });
      const embed = new EmbedBuilder()
        .setTitle('⚔️ HEROIC SPIRIT COVENANT GRANTED')
        .setDescription(res.message)
        .setColor(res.success ? 0xd4af37 : 0xef4444)
        .setFooter({ text: `Authorized by Overseer ${interaction.user.username}` });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // Currencies and consumables
    const defaultAmount = itemType === 'sq' ? 30 : 1;
    const amount = rawAmount !== null ? rawAmount : defaultAmount;
    const res = await giveCurrencyToMaster(targetUser.id, itemType, amount);

    const embed = new EmbedBuilder()
      .setTitle('💎 OVERSEER RESOURCE GRANT')
      .setDescription(res.message)
      .setColor(res.success ? 0x10b981 : 0xef4444)
      .setFooter({ text: `Overseer Action by ${interaction.user.username}` });

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // --- /admin remove ---
  if (subcommand === 'remove') {
    const targetUser = interaction.options.getUser('user', true);
    const itemType = interaction.options.getString('item', true);
    const rawAmount = interaction.options.getInteger('amount');
    const itemName = interaction.options.getString('name')?.trim();

    await getOrCreateMaster(targetUser.id, targetUser.username);

    if (itemType === 'all_ces') {
      const res = await removeCraftEssenceFromMaster(targetUser.id, 'all', 1, true);
      const embed = new EmbedBuilder()
        .setTitle('🎒 INVENTORY PURGE')
        .setDescription(res.message)
        .setColor(0xef4444)
        .setFooter({ text: `Authorized by Overseer ${interaction.user.username}` });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (itemType === 'ce') {
      if (!itemName) {
        await interaction.reply({
          content: '⚠️ Please specify the Craft Essence `name` to remove.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      const res = await removeCraftEssenceFromMaster(targetUser.id, itemName, rawAmount || 1);
      const embed = new EmbedBuilder()
        .setTitle('🃏 CRAFT ESSENCE REMOVAL')
        .setDescription(res.message)
        .setColor(res.success ? 0xf59e0b : 0xef4444)
        .setFooter({ text: `Authorized by Overseer ${interaction.user.username}` });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (itemType === 'servant') {
      const res = await removeServantFromMaster(targetUser.id, itemName);
      const embed = new EmbedBuilder()
        .setTitle('🗡️ SERVANT CONTRACT SEVERED')
        .setDescription(res.message)
        .setColor(res.success ? 0xef4444 : 0xef4444)
        .setFooter({ text: `Authorized by Overseer ${interaction.user.username}` });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // Currency deduction
    const res = await removeCurrencyFromMaster(targetUser.id, itemType, rawAmount || 1);
    const embed = new EmbedBuilder()
      .setTitle('🪙 OVERSEER RESOURCE DEDUCTION')
      .setDescription(res.message)
      .setColor(res.success ? 0xf59e0b : 0xef4444)
      .setFooter({ text: `Overseer Action by ${interaction.user.username}` });

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // --- /admin set ---
  if (subcommand === 'set') {
    const targetUser = interaction.options.getUser('user', true);
    const attribute = interaction.options.getString('attribute', true);
    const value = interaction.options.getInteger('value', true);

    await getOrCreateMaster(targetUser.id, targetUser.username);
    const res = await setMasterStat(targetUser.id, attribute, value);

    const embed = new EmbedBuilder()
      .setTitle('⚙️ MASTER PARAMETER CALIBRATION')
      .setDescription(res.message)
      .setColor(res.success ? 0x3b82f6 : 0xef4444)
      .setFooter({ text: `Authorized by Overseer ${interaction.user.username}` });

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // --- /admin inspect ---
  if (subcommand === 'inspect') {
    const targetUser = interaction.options.getUser('user', true);
    const master = await getOrCreateMaster(targetUser.id, targetUser.username);
    const { embed, components } = buildMasterDossier(master);

    await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
    return;
  }

  // --- /admin master ---
  if (subcommand === 'master') {
    const action = interaction.options.getString('action', true);
    const targetUser = interaction.options.getUser('user', true);
    const itemName = interaction.options.getString('name')?.trim();
    const amount = interaction.options.getInteger('amount') || 1;

    const master = await getOrCreateMaster(targetUser.id, targetUser.username);
    let outcome = '';

    if (action === 'inspect') {
      const { embed, components } = buildMasterDossier(master);
      await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
      return;
    } else if (action === 'give_30sq') {
      master.saintQuartz = (master.saintQuartz || 0) + 30;
      await saveMaster(master);
      outcome = `✨ Minted **+30 Saint Quartz** for **${master.username}**! Total SQ: **${master.saintQuartz}**`;
    } else if (action === 'give_100sq') {
      master.saintQuartz = (master.saintQuartz || 0) + 100;
      await saveMaster(master);
      outcome = `✨ Minted **+100 Saint Quartz** for **${master.username}**! Total SQ: **${master.saintQuartz}**`;
    } else if (action === 'refill_seals') {
      master.commandSeals = 3;
      await saveMaster(master);
      outcome = `🔱 Refilled Command Seals to **3/3** for **${master.username}**!`;
    } else if (action === 'give_stat_points') {
      const res = await giveCurrencyToMaster(targetUser.id, 'stat_points', amount * 10);
      outcome = res.message;
    } else if (action === 'give_ce') {
      if (!itemName) {
        await interaction.reply({ content: '⚠️ Please specify the Craft Essence `name`.', flags: MessageFlags.Ephemeral });
        return;
      }
      const res = await giveCraftEssenceToMaster(targetUser.id, itemName, amount);
      outcome = res.message;
    } else if (action === 'give_servant') {
      if (!itemName) {
        await interaction.reply({ content: '⚠️ Please specify the Heroic Spirit `name`.', flags: MessageFlags.Ephemeral });
        return;
      }
      const res = await giveServantToMaster(targetUser.id, itemName);
      outcome = res.message;
    } else if (action === 'sever_servant') {
      const res = await removeServantFromMaster(targetUser.id, itemName);
      outcome = res.message;
    } else if (action === 'reset_inventory') {
      await resetSingleMasterInventory(targetUser.id);
      outcome = `🎒 **Inventory Wiped for ${master.username}!** All Craft Essences dissolved & unequipped.`;
    } else if (action === 'reset_currency') {
      const res = await resetSingleMasterCurrency(targetUser.id, { startingSq: 30, startingQp: 0, startingTickets: 0 });
      outcome = `🧹 **Currency Balances Reset for ${master.username}!** Saint Quartz: **${res?.saintQuartz || 30} SQ**, Tickets: **0**.`;
    } else if (action === 'reset_vault') {
      await resetSingleMasterVault(targetUser.id, { startingSq: 30, startingQp: 0, startingTickets: 0 });
      outcome = `🔄 **Full Vault Reset for ${master.username}!** Items cleared, SQ: **30**, Tickets: **0**.`;
    } else if (action === 'reset_servant_stats') {
      await resetSingleMasterServant(targetUser.id, { resetStatsOnly: true });
      outcome = `🌱 **Servant Level Reset for ${master.username}!** Active Servant reverted to Level 1 with 0 bonus stat points.`;
    }

    const embed = new EmbedBuilder()
      .setTitle('👤 MASTER MANAGEMENT OVERSEER')
      .setDescription(outcome)
      .setColor(0xd4af37)
      .setFooter({ text: `Authorized by Overseer ${interaction.user.username}` });

    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (subcommand === 'war') {
    const action = interaction.options.getString('action', true);
    const preset = interaction.options.getString('preset') || 'fuyuki_7';
    const cataclysm = interaction.options.getString('cataclysm') as any;
    const timerMinutes = interaction.options.getInteger('timer') ?? 15;
    const maxSlots = interaction.options.getInteger('max_slots') ?? 7;
    const targetChannel = (interaction.options.getChannel('channel') as any) || interaction.channel;

    if (action === 'call') {
      if (!targetChannel || typeof targetChannel.send !== 'function') {
        await interaction.reply({
          content: '❌ Invalid channel selected for Holy Grail War recruitment proclamation.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const res = await startWarRecruitment(interaction.client, targetChannel, interaction.user, {
        durationMinutes: timerMinutes,
        maxSlots,
        presetKey: preset
      });

      if (!res.success) {
        await interaction.editReply({ content: `❌ Error initiating recruitment: ${res.message}` });
        return;
      }

      await interaction.editReply({
        content: `✅ **Holy Grail War Recruitment Proclamation Issued!**\n\n• **Target Channel:** <#${targetChannel.id}>\n• **Timer:** ${timerMinutes > 0 ? `${timerMinutes} minutes` : 'Until manual Overseer start'}\n• **Capacity:** **${maxSlots} Masters** (Random selection if more apply)\n• **Secrecy:** True names & Servants will remain anonymous!\n• **DMs:** Chosen combatants will receive private battle orders via DM.`
      });
      return;
    }

    if (action === 'restart') {
      const res = startOrRestartWar(preset, undefined, interaction.user.username);
      const embed = new EmbedBuilder()
        .setTitle('🌟 HOLY GRAIL WAR RITUAL LAUNCHED')
        .setDescription(res.message)
        .setColor(0xd4af37)
        .setFooter({ text: `Authorized by Overseer Admin ${interaction.user.username}` });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (action === 'reset') {
      const res = resetHolyGrailWar(true, interaction.user.username);
      const embed = new EmbedBuilder()
        .setTitle('🔄 HOLY GRAIL WAR REFRESHED')
        .setDescription(res.message)
        .setColor(0x10b981)
        .setFooter({ text: `Overseer Ritual Refresh by ${interaction.user.username}` });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (action === 'cataclysm' && cataclysm) {
      const war = getOrInitWarSession();
      const res = triggerAdminCataclysm(war, cataclysm, interaction.user.username);
      const embed = new EmbedBuilder()
        .setTitle(`⚡ LEYLINE CATACLYSM: ${res.banner}`)
        .setDescription(res.message)
        .setColor(0xef4444)
        .setFooter({ text: `Cataclysm invoked by Overseer ${interaction.user.username}` });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (action === 'history') {
      const war = getOrInitWarSession();
      const hist = war.history || [];
      let desc = '';
      if (hist.length === 0) {
        desc = 'No archived Grail Wars in the Hall of Fame yet.\n\nOnce a Grail War concludes or is restarted, the previous victor and battle statistics will be recorded here.';
      } else {
        desc = hist.slice(0, 10).map((h, idx) => 
          `**${idx + 1}. ${h.title}** (${new Date(h.concludedAt).toLocaleDateString()})\n` +
          `• 🏆 **Victor:** **${h.winnerUsername}** with *${h.winnerServantName}*\n` +
          `• 👥 **Participants:** ${h.totalParticipants} Masters | ⚔️ **Eliminations:** ${h.totalEliminations}\n` +
          `• 📜 **Rules:** \`${h.rulesSummary}\``
        ).join('\n\n');
      }

      const embed = new EmbedBuilder()
        .setTitle('📜 Hall of Fame — Historical Grail War Chronicles')
        .setDescription(desc)
        .setColor(0xd4af37);

      await interaction.reply({ embeds: [embed] });
      return;
    }
  }

  if (subcommand === 'persona') {
    const action = interaction.options.getString('action', true);
    const servantQuery = interaction.options.getString('servant')?.trim();
    const personaLore = interaction.options.getString('persona_lore')?.trim();
    const speechExamplesRaw = interaction.options.getString('speech_examples')?.trim();
    const mannerismsRaw = interaction.options.getString('mannerisms')?.trim();
    const bannedTropesRaw = interaction.options.getString('banned_tropes')?.trim();

    if (action === 'list') {
      const allProfiles = getAllCharacterProfiles();
      const desc = allProfiles.map((p, idx) => {
        const isCustom = !DEFAULT_SERVANT_CHARACTER_PROFILES[p.id];
        return `**${idx + 1}. ${p.name}** (\`${p.id}\`) — ${isCustom ? '⭐ *Custom Profile*' : '📖 *Canon Lore*'}\n` +
          `> Aliases: \`${(p.aliases || []).slice(0, 3).join(', ')}\` | Quotes: \`${(p.speechExamples || []).length} sample(s)\``;
      }).join('\n\n');

      const embed = new EmbedBuilder()
        .setTitle(`🎭 Registered Servant AI Personas (${allProfiles.length})`)
        .setDescription(
          `These character cards define the visual novel voice, authentic slang, mannerisms, and banned AI tropes for telepathic dialogue.\n\n` +
          desc +
          `\n\n💡 *Use \`/admin persona action:view servant:<name>\` or open \`/admin hub category:personas\` to edit!*`
        )
        .setColor(0xa855f7)
        .setFooter({ text: 'Fate/Grand Order Holy Grail War • Persona Engine' });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (action === 'view') {
      if (!servantQuery) {
        const allProfiles = getAllCharacterProfiles();
        const embed = new EmbedBuilder()
          .setTitle('🎭 Servant Character Cards Directory')
          .setDescription(
            `Please specify a Servant name to view their full character card, or choose one below:\n\n` +
            allProfiles.map(p => `• **${p.name}** (\`${p.id}\`)`).join('\n')
          )
          .setColor(0xa855f7);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      const profile = getServantCharacterProfile(servantQuery, servantQuery) ||
        getAllCharacterProfiles().find(p => p.id.toLowerCase() === servantQuery.toLowerCase() || p.name.toLowerCase() === servantQuery.toLowerCase());
      if (!profile) {
        await interaction.reply({
          content: `❌ Could not find any registered character profile for **"${servantQuery}"**.\nUse \`/admin persona action:edit servant:${servantQuery}\` or \`/admin hub category:personas\` to create one!`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const card = buildPersonaCardEmbed(profile);
      await interaction.reply({ embeds: [card.embed], components: card.components });
      return;
    }

    if (action === 'edit') {
      if (!servantQuery) {
        await interaction.reply({
          content: '⚠️ Please specify the `servant` name when adding or editing a character profile.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (personaLore) {
        const existing = getServantCharacterProfile(servantQuery, servantQuery);
        const speechExamples = speechExamplesRaw 
          ? speechExamplesRaw.split(/[;\n]/).map(s => s.trim()).filter(Boolean)
          : (existing?.speechExamples || []);
        const mannerisms = mannerismsRaw
          ? mannerismsRaw.split(/[;\n]/).map(s => s.trim()).filter(Boolean)
          : (existing?.mannerisms || []);
        const bannedTropes = bannedTropesRaw
          ? bannedTropesRaw.split(/[,;\n]/).map(s => s.trim()).filter(Boolean)
          : (existing?.bannedTropes || ['Stay sharp', 'Keep your guard up']);

        const id = (existing?.id || servantQuery.toLowerCase().replace(/\s+/g, '_')).toLowerCase().trim();
        const saved = saveCustomCharacterProfile({
          id,
          name: existing?.name || servantQuery,
          aliases: existing?.aliases || [servantQuery.toLowerCase(), id],
          persona: personaLore,
          speechExamples,
          mannerisms,
          bannedTropes
        });

        const card = buildPersonaCardEmbed(saved, `✨ Successfully saved character card for **${saved.name}**!`);
        await interaction.reply({ embeds: [card.embed], components: card.components });
        return;
      }

      // No CLI persona_lore supplied: explain and provide button or hub
      const existing = getServantCharacterProfile(servantQuery, servantQuery);
      const embed = new EmbedBuilder()
        .setTitle(`🎭 Configure Persona: ${servantQuery}`)
        .setDescription(
          `To edit or add a character card for **${servantQuery}**, you can:\n\n` +
          `1. **Use the Interactive Admin Hub:** Run \`/admin hub category:personas\` and click **Edit/Register** for a full popup modal.\n` +
          `2. **Pass CLI arguments:** Provide \`persona_lore\`, \`speech_examples\`, and \`banned_tropes\` directly in this command.\n\n` +
          (existing ? `*Currently has an active character profile (${existing.persona.length} chars).*` : `*Currently unconfigured (using standard Type-Moon template).*`)
        )
        .setColor(0xa855f7);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`admin_persona_btn_edit_${existing?.id || servantQuery.toLowerCase().replace(/\s+/g, '_')}`).setLabel('Open Modal Editor').setEmoji('✏️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('admin_tab_personas').setLabel('Persona Hub').setEmoji('🎭').setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
      return;
    }

    if (action === 'delete') {
      if (!servantQuery) {
        await interaction.reply({
          content: '⚠️ Please specify the `servant` name to delete custom override.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const id = servantQuery.toLowerCase().replace(/\s+/g, '_');
      const existed = deleteCustomCharacterProfile(id);
      const isCanon = !!DEFAULT_SERVANT_CHARACTER_PROFILES[id];

      const embed = new EmbedBuilder()
        .setTitle('🗑️ Character Profile Reset')
        .setDescription(
          existed
            ? `Custom persona override for **"${servantQuery}"** was deleted.\n${isCanon ? '• Reset back to canonical Type-Moon baseline persona.' : '• Character card removed.'}`
            : `No custom override found for **"${servantQuery}"** (already using default).`
        )
        .setColor(0xef4444);

      await interaction.reply({ embeds: [embed] });
      return;
    }
  }

  if (subcommand === 'npanim') {
    const servantQuery = interaction.options.getString('servant', true).trim();
    const gifUrl = interaction.options.getString('gif_url', true).trim();
    const chant = interaction.options.getString('chant')?.trim();

    const result = setServantNpAnimation(servantQuery, gifUrl, chant, interaction.user.username);

    if (!result.success || !result.servant) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Could Not Set Animation')
            .setDescription(result.error || `Could not find any Servant matching "${servantQuery}".`)
            .setColor(0xef4444)
        ]
      });
      return;
    }

    const s = result.servant;
    const embed = new EmbedBuilder()
      .setTitle(`🎬 NOBLE PHANTASM ANIMATION CONFIGURED: ${s.name}`)
      .setDescription(
        `Admin has updated the Noble Phantasm animation for **${s.name}**!\n\n` +
        `• **Class:** \`${s.servantClass}\` | **Noble Phantasm:** **${s.noblePhantasm.name}**\n` +
        `• **True Name Chant:** *“${s.noblePhantasm.chant}”*\n` +
        `• **Animation Link:** [Click to open source](${gifUrl})\n\n` +
        `*During duels, when ${s.name} releases their Noble Phantasm, this animation will display at full size until the next turn!*`
      )
      .setColor(0xd4af37)
      .setFooter({ text: `Configured by Admin ${interaction.user.username} • Persistent on disk` });
    const npFiles: AttachmentBuilder[] = [];
    safeSetEmbedImage(embed, gifUrl, npFiles);

    await interaction.reply({ embeds: [embed], files: npFiles });
    return;
  }

  if (subcommand === 'npsettings') {
    const autodelete = interaction.options.getBoolean('autodelete');
    const afkTimeout = interaction.options.getInteger('afk_timeout');

    const updated = setDuelNpSettings({
      autoDelete: autodelete !== null ? autodelete : undefined,
      afkTimeoutSeconds: afkTimeout !== null ? afkTimeout : undefined
    });

    const embed = new EmbedBuilder()
      .setTitle('⚙️ DUEL NOBLE PHANTASM SETTINGS')
      .setDescription(
        `The duel Noble Phantasm animation parameters have been updated:\n\n` +
        `• **Auto-Delete on Next Turn:** \`${updated.autoDelete ? 'Enabled (Cleans up when turn chosen)' : 'Disabled (Remains permanently in chat)'}\`\n` +
        `• **AFK Safety Timeout:** \`${updated.afkTimeoutSeconds} seconds\`\n\n` +
        `*These settings apply immediately to all ongoing and future battles.*`
      )
      .setColor(0x3b82f6)
      .setFooter({ text: `Updated by Admin ${interaction.user.username}` });

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // Open the interactive Admin Hub
  const { embeds, components } = buildAdminHub(category);
  await interaction.reply({ embeds, components, flags: MessageFlags.Ephemeral });
}

// ==========================================
// 3.4. PERSONA CARD & MODAL BUILDERS
// ==========================================
export function buildPersonaCardEmbed(
  profile: ServantCharacterProfile,
  actionOutcomeMsg?: string
): { embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[] } {
  const isCustomOverride = hasCustomCharacterProfile(profile.id);
  const isCanon = !!DEFAULT_SERVANT_CHARACTER_PROFILES[profile.id];
  const quotesList = (profile.speechExamples || []).slice(0, 4).map(q => `• *“${q}”*`).join('\n') || '*No quote samples registered.*';
  const quirksList = (profile.mannerisms || []).slice(0, 4).map(m => `• ${m}`).join('\n') || '*No quirks specified.*';
  const bannedList = (profile.bannedTropes || []).map(b => `\`${b}\``).join(', ') || '*None*';

  let loreSnippet = profile.persona;
  if (loreSnippet.length > 1800) {
    loreSnippet = loreSnippet.slice(0, 1797) + '...';
  }

  const statusDisplay = isCustomOverride
    ? (isCanon ? '⭐ **Custom Override (Canon Baseline Available)**' : '✨ **Custom Servant Persona**')
    : '📖 **Canonical Type-Moon Baseline**';

  const embed = new EmbedBuilder()
    .setTitle(`🎭 CHARACTER CARD: ${profile.name} (\`${profile.id}\`)`)
    .setDescription(
      (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
      `**Profile Status:** ${statusDisplay}\n` +
      `**Aliases / Search Identifiers:** \`${(profile.aliases || [profile.id]).join(', ')}\`\n\n` +
      `📜 **Persona & Psychological Profile:**\n${loreSnippet}\n\n` +
      `🗣️ **Authentic Dialogue Samples:**\n${quotesList}\n\n` +
      `✨ **Habits & Visual Novel Mannerisms:**\n${quirksList}\n\n` +
      `🚫 **Banned AI Tropes / Restricted Stock Clichés:**\n${bannedList}\n\n` +
      `*This character card governs all telepathic dialogue in \`/servant talk\`, \`/grailwar duel\`, and battle banter.*`
    )
    .setColor(0xa855f7)
    .setFooter({ text: `ID: ${profile.id} • Servant AI Character Card Suite` });

  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`admin_persona_btn_edit_${profile.id}`).setLabel('Edit Card (Modal)').setEmoji('✏️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`admin_persona_btn_reset_${profile.id}`).setLabel(isCustomOverride ? (isCanon ? 'Reset to Canon' : 'Delete Override') : 'Customize Card').setEmoji(isCustomOverride ? '🗑️' : '✨').setStyle(isCustomOverride ? ButtonStyle.Danger : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('admin_tab_personas').setLabel('Persona Hub').setEmoji('🎭').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('admin_tab_war').setLabel('War Hub').setEmoji('🏆').setStyle(ButtonStyle.Secondary)
  );

  return { embed, components: [btnRow] };
}

export function buildPersonaModal(profile?: ServantCharacterProfile): ModalBuilder {
  const isEdit = !!profile;
  const modal = new ModalBuilder()
    .setCustomId(isEdit ? `admin_modal_persona_edit_${profile.id}` : 'admin_modal_persona_add')
    .setTitle(isEdit ? `Edit: ${profile.name}`.slice(0, 45) : 'Create Servant Persona Card');

  const nameInput = new TextInputBuilder()
    .setCustomId('persona_name')
    .setLabel('Heroic Spirit Name')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. Aoko Aozaki, Artoria Pendragon, Gilgamesh')
    .setMaxLength(80)
    .setRequired(true);
  if (profile) nameInput.setValue(profile.name);

  const loreInput = new TextInputBuilder()
    .setCustomId('persona_lore')
    .setLabel('Persona Lore & Personality')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Describe personality, background, dynamic with Master, speech tone...')
    .setMaxLength(3900)
    .setRequired(true);
  if (profile) loreInput.setValue(profile.persona.slice(0, 3900));

  const quotesInput = new TextInputBuilder()
    .setCustomId('persona_quotes')
    .setLabel('Quotes (Separate with ; or newline)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('e.g. "Grrr... This is frustrating!"; "Oi, idiot! Pay attention."')
    .setMaxLength(1000)
    .setRequired(false);
  if (profile && profile.speechExamples) quotesInput.setValue(profile.speechExamples.join('; ').slice(0, 1000));

  const mannerismsInput = new TextInputBuilder()
    .setCustomId('persona_mannerisms')
    .setLabel('Mannerisms (Separate with ; or newline)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('e.g. Slams fists on table; Lightens heavy mood with aggressive jokes')
    .setMaxLength(500)
    .setRequired(false);
  if (profile && profile.mannerisms) mannerismsInput.setValue(profile.mannerisms.join('; ').slice(0, 500));

  const bannedInput = new TextInputBuilder()
    .setCustomId('persona_banned')
    .setLabel('Banned AI Phrases (Comma-separated)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. Stay sharp, Stay focused, Keep your guard up, My core is at 100%')
    .setMaxLength(200)
    .setRequired(false);
  if (profile && profile.bannedTropes) bannedInput.setValue(profile.bannedTropes.join(', ').slice(0, 200));

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(loreInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(quotesInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(mannerismsInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(bannedInput)
  );

  return modal;
}

// ==========================================
// 3.5. MASTER DOSSIER BUILDER
// ==========================================
export function buildMasterDossier(
  master: any,
  actionOutcomeMsg?: string
): { embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[] } {
  const active = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];
  const ceCount = master.craftEssences?.length || 0;
  const targetId = master.discordId || master.id?.replace('master_', '') || master.id;

  let servantSummary = '❌ *No Contracted Servant*';
  if (active && active.template) {
    const ceInfo = active.equippedCe ? `\n> 🃏 **Equipped CE:** ${active.equippedCe.rarity}★ ${active.equippedCe.name}` : '';
    servantSummary = 
      `⚔️ **${active.template.rarity}★ ${active.template.name}** (\`${active.template.servantClass}\`)\n` +
      `> 🌟 **Level:** \`${active.level || 1}/100\` | 💥 **NP Level:** \`NP${active.npLevel || 1}\` | 💖 **Bond:** \`Lv.${active.bondLevel || 0}\`\n` +
      `> 📊 **Points:** \`${active.availableStatPoints || 0} AP\` | ⚔️ **Allocated:** STR +${active.allocatedStats?.strength || 0}, END +${active.allocatedStats?.endurance || 0}, AGI +${active.allocatedStats?.agility || 0}, MNA +${active.allocatedStats?.mana || 0}, LCK +${active.allocatedStats?.luck || 0}` +
      ceInfo;
  }

  const embed = new EmbedBuilder()
    .setTitle(`📜 OVERSEER MASTER DOSSIER: ${master.username}`)
    .setDescription(
      (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
      `Detailed parameters, assets, and active contract registry for Master **${master.username}** (\`${master.id}\`).\n\n` +
      `💎 **Treasury & Currencies:**\n` +
      `• 💎 **Saint Quartz:** \`${master.saintQuartz || 0} SQ\` | 🎫 **Tickets:** \`${master.summonTickets || 0}\`\n` +
      `• 🔱 **Command Seals:** \`${master.commandSeals ?? 3}/3\` | ⚡ **Action Points:** \`${master.actionPoints || 100}/${master.maxActionPoints || 100}\`\n\n` +
      `⚔️ **Heroic Spirit Covenant:**\n${servantSummary}\n\n` +
      `🎒 **Relic Inventory:** \`${ceCount} Craft Essence(s)\` | 🧬 **Homunculi:** \`${master.homunculusCount || 0}\`\n` +
      `🏆 **Combat Record:** \`${master.grailWarWins || 0} War Wins\` | \`${master.duelsWon || 0}W - ${master.duelsLost || 0}L\` | 🛡️ **Rank:** \`${master.reputationRank || 'Honorable Magus'}\``
    )
    .setColor(0xd4af37)
    .setFooter({ text: `Master ID: ${master.id} • Overseer Master Panel` });

  const grantRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`admin_m_give_30sq_${targetId}`).setLabel('+30 SQ').setEmoji('💎').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`admin_m_give_100sq_${targetId}`).setLabel('+100 SQ').setEmoji('💎').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`admin_m_give_tickets_${targetId}`).setLabel('+5 Tickets').setEmoji('🎫').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`admin_m_refill_seals_${targetId}`).setLabel('Refill 3 Seals').setEmoji('🔱').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`admin_m_give_stats_${targetId}`).setLabel('+50 Stat Pts').setEmoji('🌟').setStyle(ButtonStyle.Secondary)
  );

  const manageRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`admin_m_refresh_${targetId}`).setLabel('Refresh Dossier').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('admin_tab_masters').setLabel('Back to Master Roster').setEmoji('👤').setStyle(ButtonStyle.Primary)
  );

  return { embed, components: [grantRow, manageRow] };
}

// ==========================================
// 4. ADMIN HUB BUILDER
// ==========================================
export function buildAdminHub(
  category: 'war' | 'war_announce' | 'war_rules' | 'masters' | 'personas' | 'npanim' | 'npsettings' | 'listnp' | 'economy' = 'war',
  actionOutcomeMsg?: string
) {
  let embeds: EmbedBuilder[] = [];

  if (category === 'war') {
    const war = getOrInitWarSession();
    const rules = war.rules || WAR_PRESETS.fuyuki_7;
    const participants = Object.values(war.participants || {});
    const aliveCount = participants.filter(p => p.isAlive).length;
    const deadCount = participants.length - aliveCount;

    const poolTag = rules.servantPool === 'canon_only' 
      ? '📖 Canon Type-Moon Only' 
      : rules.servantPool === 'custom_only' 
        ? '🎨 Custom Community Only' 
        : '✨ Canon + Custom Servants';

    const isCallActive = !!(war.recruitmentCall && war.recruitmentCall.active);
    let recruitText = '⚪ **No Active Recruitment Proclamation** (Click **📢 Announce War** below to select a channel and broadcast)';
    if (isCallActive) {
      const chMention = war.recruitmentCall?.channelId ? `<#${war.recruitmentCall.channelId}>` : 'Selected Channel';
      const deadline = war.recruitmentCall?.expiresAt && war.recruitmentCall.expiresAt > 0 
        ? `<t:${Math.floor(war.recruitmentCall.expiresAt / 1000)}:R>` 
        : 'Manual Overseer Ignition';
      recruitText = `🟢 **ACTIVE IN ${chMention}** • **${war.recruitmentCall?.applicantIds.length || 0} Applicants** (Ends: ${deadline})`;
    }

    const embed = new EmbedBuilder()
      .setTitle('🏆 Overseer Control: Holy Grail War Master Dashboard')
      .setDescription(
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `Configure rituals, adjust lethality & servant pools, or broadcast Holy Grail War recruitment to any channel.\n\n` +
        `📢 **Recruitment Proclamation:** ${recruitText}\n\n` +
        `🏰 **Active War Format:** **${rules.formatName}**\n` +
        `👥 **Roster Status:** **${aliveCount} Alive** / **${participants.length} Total** (Max Cap: **${rules.maxMasters} Masters**)\n` +
        `☠️ **Eliminations:** **${deadCount} Fallen** | ⚱️ **Status:** \`${war.status.toUpperCase()}\`\n\n` +
        `📋 **Active Ritual Configuration & Rules:**\n` +
        `• ⚔️ **Servant Pool:** ${poolTag}\n` +
        `• 🔒 **Class Exclusivity:** \`${rules.classExclusivity ? 'Strict (1 per Class)' : 'Open (Multiple Allowed)'}\`\n` +
        `• 💀 **Lethality Mode:** \`${rules.permadeath ? 'Permadeath (Eliminated on HP 0)' : 'Casual / Training (Revive Cooldown)'}\`\n` +
        `• 🔱 **Starting Command Seals:** \`${rules.startingCommandSeals} Seals\`\n` +
        `• 💧 **Leyline Density:** \`${rules.leylineDensity === 'fast' ? '⚡ High Surge (2x Fast Recovery)' : rules.leylineDensity === 'desolate' ? '🏜️ Desolate (No Auto-Regen)' : 'Balanced Standard (5 min full)'}\`\n` +
        `• ⛪ **Church Sanctuary:** \`${rules.churchAsylum ? '🟢 Active Asylum under Father Kotomine' : '🔴 Desecrated (No Asylum)'}\`\n` +
        `• 🕸️ **Trap Limit:** \`Max ${rules.trapLimitPerMaster || 3} per Master\` | 🚩 **Factions:** \`${rules.factionMode ? 'Red vs Black (Apocrypha)' : 'Free-For-All'}\`\n\n` +
        `*Click **📢 Announce War** to choose a broadcast channel, or adjust settings with the buttons below!*`
      )
      .setColor(0xd4af37)
      .setFooter({ text: 'Admin Suite • FGO Holy Grail War Overseer Engine' });

    embeds = [embed];

  } else if (category === 'war_announce') {
    const war = getOrInitWarSession();
    const isCallActive = !!(war.recruitmentCall && war.recruitmentCall.active);
    const activeCh = isCallActive && war.recruitmentCall?.channelId ? `<#${war.recruitmentCall.channelId}>` : 'None';
    const activeTime = isCallActive && war.recruitmentCall?.expiresAt 
      ? (war.recruitmentCall.expiresAt > 0 ? `<t:${Math.floor(war.recruitmentCall.expiresAt / 1000)}:R>` : 'Manual Ignition')
      : 'N/A';
    const targetChTag = adminAnnounceDraft.targetChannelId ? `<#${adminAnnounceDraft.targetChannelId}>` : '*Current / Select from menu below*';
    const presetName = WAR_PRESETS[adminAnnounceDraft.presetKey]?.formatName || '5th Fuyuki Holy Grail War';

    const embed = new EmbedBuilder()
      .setTitle('📢 Overseer Dispatch: Holy Grail War Proclamation & Channel Broadcast')
      .setDescription(
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `Broadcast the official Holy Grail War Proclamation into a chosen channel on this server.\n` +
        `Magi will be able to privately inscribe their Command Seals with complete anonymity and receive battle orders in their DMs upon war ignition.\n\n` +
        `📡 **Target Broadcast Channel:** ${targetChTag}\n` +
        `⏱️ **Recruitment Countdown:** \`${adminAnnounceDraft.durationMinutes > 0 ? `${adminAnnounceDraft.durationMinutes} Minutes` : 'Manual Start (No Timer)'}\`\n` +
        `🏆 **Format & Capacity:** \`${adminAnnounceDraft.maxSlots} Masters\` (*${presetName}*)\n\n` +
        (isCallActive 
          ? `🟢 **CURRENT ACTIVE RECRUITMENT CALL:**\n` +
            `• Channel: ${activeCh} | Applicants: **${war.recruitmentCall?.applicantIds.length || 0} Magi**\n` +
            `• Deadline: ${activeTime}\n\n` +
            `⚠️ *An announcement card is already active in ${activeCh}. To prevent duplicate cards, use **Ignite**, **Cancel**, or **Replace & Broadcast** below.*\n`
          : `⚪ **Status:** No proclamation currently active.\n\n*Select a channel or click [Post] below to issue the proclamation:*`)
      )
      .setColor(0xb91c1c)
      .setFooter({ text: 'Admin Suite • Holy Grail War Proclamation Dispatcher' });

    embeds = [embed];

  } else if (category === 'masters') {
    const allMasters = getAllMasters();
    const war = getOrInitWarSession();
    const participants = war.participants || {};

    let masterListDesc = '';
    if (allMasters.length === 0) {
      masterListDesc = '❌ *No registered Masters found in memory or disk database.*';
    } else {
      masterListDesc = allMasters.slice(0, 10).map((m, idx) => {
        const active = m.servants?.find(s => s.id === m.activeServantId) || m.servants?.[0];
        const sName = active ? `${active.template?.rarity}★ ${active.template?.name} (Lv.${active.level || 1})` : 'No Servant';
        const inWar = participants[m.id] || participants[m.id.replace('master_', '')] ? '⚔️ In War' : '🌱 Free';
        return `**${idx + 1}. ${m.username}** (\`${m.id}\`)\n• 💎 **SQ:** \`${m.saintQuartz || 0}\` | 🎫 **Tickets:** \`${m.summonTickets || 0}\` | 🔱 **Seals:** \`${m.commandSeals ?? 3}/3\`\n• ⚔️ **Servant:** ${sName} | 🎴 **CEs:** \`${m.craftEssences?.length || 0}\` | [${inWar}]`;
      }).join('\n\n');
    }

    const embed = new EmbedBuilder()
      .setTitle(`👤 Admin Control: Master Records & Dossiers (${allMasters.length} Registered)`)
      .setDescription(
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `Inspect, grant resources, equip/unequip relics, or sever contracts for any Master across the server.\n\n` +
        `${masterListDesc}\n\n` +
        `*Select a Master from the dropdown below to open their full interactive Dossier & action suite:*`
      )
      .setColor(0xd4af37)
      .setFooter({ text: 'Admin Suite • Master Profile & Inventory Inspector' });

    embeds = [embed];

  } else if (category === 'war_rules') {
    const war = getOrInitWarSession();
    const rules = war.rules || WAR_PRESETS.fuyuki_7;

    const poolTag = rules.servantPool === 'canon_only' 
      ? '📖 Canon Type-Moon Only' 
      : rules.servantPool === 'custom_only' 
        ? '🎨 Custom Community Only' 
        : '✨ Canon + Custom Servants';

    const embed = new EmbedBuilder()
      .setTitle('⚙️ Overseer Ritual Workshop — Interactive Rule Customizer')
      .setDescription(
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `Directly tune ritual parameters for the active Holy Grail War. Use the direct action buttons or dropdown menu below.\n\n` +
        `🔱 **Starting Command Seals:** \`${rules.startingCommandSeals} Seals\` *(Options: 1, 2, 3, 5, 10)*\n` +
        `👥 **Master Roster Capacity:** \`${rules.maxMasters} Masters\` *(Options: 7, 14, 20, 30)*\n` +
        `⚔️ **Servant Summon Pool:** ${poolTag}\n` +
        `🔒 **Class Exclusivity:** \`${rules.classExclusivity ? 'Strict (1 per Class)' : 'Open (Duplicates Allowed)'}\`\n` +
        `💀 **Lethality & Permadeath:** \`${rules.permadeath ? 'Permadeath (Eliminated on HP 0)' : 'Casual / Training Mode'}\`\n` +
        `⛪ **Church Sanctuary:** \`${rules.churchAsylum ? '🟢 Active Asylum (Father Kotomine)' : '🔴 Desecrated (No Asylum)'}\`\n` +
        `💧 **Leyline Mana Density:** \`${rules.leylineDensity === 'fast' ? '⚡ High Surge (2x Fast)' : rules.leylineDensity === 'desolate' ? '🏜️ Desolate (No Regen)' : 'Standard (5 min)'}\`\n` +
        `🕸️ **Trap Limits:** \`Max ${rules.trapLimitPerMaster || 3} per Master\` | 🚩 **Factions:** \`${rules.factionMode ? 'Red vs Black (Apocrypha)' : 'Free-For-All'}\`\n\n` +
        `*Click any button below to instantly apply or toggle that rule!*`
      )
      .setColor(0xeab308)
      .setFooter({ text: 'Admin Suite • Holy Grail War Rule Tuner' });

    embeds = [embed];

  } else if (category === 'npanim') {
    const npList = getAllCustomNpAnimations();
    const embed = new EmbedBuilder()
      .setTitle('🎬 Admin Control: Noble Phantasm Animation Manager')
      .setDescription(
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `Configure cinematic animated GIFs and True Name invocation chants for Servants during combat and Noble Phantasm cut-ins.\n\n` +
        `• **Currently Configured Animations:** **${npList.length}** Servants\n` +
        `• **Supported Formats:** Tenor, Giphy, direct .gif URLs, and uploaded MP4/GIF assets\n\n` +
        `*Use the quick buttons below or \`/admin npanim servant:<name> gif_url:<url> chant:<text>\` to assign.*`
      )
      .setColor(0xd4af37)
      .setFooter({ text: 'Admin Suite • FGO Noble Phantasm Engine' });

    embeds = [embed];

  } else if (category === 'npsettings') {
    const settings = getDuelNpSettings();
    const embed = new EmbedBuilder()
      .setTitle('⚙️ Admin Control: Duel Noble Phantasm Settings')
      .setDescription(
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `Configure duel animation display timers and automatic message deletion.\n\n` +
        `• **Auto-Delete on Next Turn:** \`${settings.autoDelete ? 'Enabled 🟢' : 'Disabled 🔴'}\`\n` +
        `• **AFK Safety Timeout:** \`${settings.afkTimeoutSeconds}s\`\n\n` +
        `*Toggle settings directly using the action buttons below:*`
      )
      .setColor(0x3b82f6)
      .setFooter({ text: 'Admin Suite • Real-time Combat Settings' });

    embeds = [embed];

  } else if (category === 'listnp') {
    const list = getAllCustomNpAnimations();
    let desc = '';
    if (list.length === 0) {
      desc = 'No custom animations have been registered yet.\n\nUse `/admin npanim` to configure custom GIFs for any Servant!';
    } else {
      desc = list
        .slice(0, 10)
        .map((item, idx) => `${idx + 1}. **${item.servantName}** — [GIF Link](${item.gifUrl})\n> Chant: *“${item.chant || 'N/A'}”*`)
        .join('\n\n');
    }

    const embed = new EmbedBuilder()
      .setTitle(`📋 Custom Noble Phantasm Registry (${list.length})`)
      .setDescription(
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        desc
      )
      .setColor(0x8b5cf6)
      .setFooter({ text: 'Admin Suite • Registered Animations List' });

    embeds = [embed];

  } else if (category === 'personas') {
    const allProfiles = getAllCharacterProfiles();
    const maxListed = 25;
    const displayedProfiles = allProfiles.slice(0, maxListed);
    const listDesc = displayedProfiles.map((p, idx) => {
      const isCustomOverride = hasCustomCharacterProfile(p.id);
      const isCanon = !!DEFAULT_SERVANT_CHARACTER_PROFILES[p.id];
      const tag = isCustomOverride 
        ? (isCanon ? '⭐ *Custom Override*' : '✨ *Custom Servant*') 
        : '📖 *Canon Lore*';
      return `**${idx + 1}. ${p.name}** (\`${p.id}\`) — ${tag}\n> Quotes: \`${(p.speechExamples || []).length}\` | Quirks: \`${(p.mannerisms || []).length}\` | Banned: \`${(p.bannedTropes || []).length}\``;
    }).join('\n\n');

    const overflowNote = allProfiles.length > maxListed 
      ? `\n\n*...and ${allProfiles.length - maxListed} more Heroic Spirits (accessible via search and dropdown).*` 
      : '';

    const embed = new EmbedBuilder()
      .setTitle(`🎭 Admin Control: Servant AI Personas & Character Cards (${allProfiles.length})`)
      .setDescription(
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `Configure psychological profiles, speech quirks, authentic quotes, and banned assistant tropes for each Heroic Spirit.\n\n` +
        listDesc +
        overflowNote +
        `\n\n*Select a Servant below to inspect or click **Create / Edit Persona** to open the visual card editor modal:*`
      )
      .setColor(0xa855f7)
      .setFooter({ text: 'Admin Suite • Servant AI Persona Engine' });

    embeds = [embed];

  } else if (category === 'economy') {
    const embed = new EmbedBuilder()
      .setTitle('💎 Admin Control: Economy, Inventory & Vault Management')
      .setDescription(
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `Administrative tools for currency minting, Craft Essence inventory resets, and complete vault wipes.\n\n` +
        `• **Mint Resources:** Add Saint Quartz (SQ), Summon Tickets, or refill Command Seals\n` +
        `• **Reset Currency:** Reset Summon Tickets & set SQ to starting 30\n` +
        `• **Reset Inventory:** Wipe all Craft Essences, un-equip active CEs, and reset Homunculi\n` +
        `• **Reset All Vault:** Full reset of inventory items and currencies to fresh defaults\n` +
        `• **Server Economy Wipe:** Complete vault & currency reset for all registered Masters\n\n` +
        `*Click a quick-action button below to manage account resources:*`
      )
      .setColor(0x06b6d4)
      .setFooter({ text: 'Admin Suite • Holy Grail Treasury & Inventory Manager' });

    embeds = [embed];
  }

  // --- UI BUTTON ROWS ---
  const categoryNavRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('admin_tab_war').setLabel('War Hub').setEmoji('🏆').setStyle(category === 'war' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('admin_tab_war_announce').setLabel('Announce War').setEmoji('📢').setStyle(category === 'war_announce' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('admin_tab_masters').setLabel('Masters').setEmoji('👤').setStyle(category === 'masters' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('admin_tab_personas').setLabel('Personas').setEmoji('🎭').setStyle(category === 'personas' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('admin_tab_war_rules').setLabel('Rules').setEmoji('⚙️').setStyle(category === 'war_rules' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  const components: any[] = [categoryNavRow];

  // Helper for fine-tune dropdown (Strictly <= 25 options for Discord constraints)
  const createRuleSelectMenu = () => {
    const rawOptions = [
      new StringSelectMenuOptionBuilder().setLabel('Command Seals: 1 Seal (Hardcore)').setValue('seals_1').setEmoji('🔱').setDescription('1 Command Seal per Master (Desolate)'),
      new StringSelectMenuOptionBuilder().setLabel('Command Seals: 2 Seals (Tactical)').setValue('seals_2').setEmoji('🔱').setDescription('2 Command Seals per Master'),
      new StringSelectMenuOptionBuilder().setLabel('Command Seals: 3 Seals (Canon Standard)').setValue('seals_3').setEmoji('🔱').setDescription('Standard 3 Command Seals (Fuyuki)'),
      new StringSelectMenuOptionBuilder().setLabel('Command Seals: 5 Seals (Mana Surge)').setValue('seals_5').setEmoji('🔱').setDescription('High mana 5 Command Seals'),
      new StringSelectMenuOptionBuilder().setLabel('Command Seals: 10 Seals (Chaos / Unlimited)').setValue('seals_10').setEmoji('🔱').setDescription('10 Command Seals for ultimate freedom'),
      new StringSelectMenuOptionBuilder().setLabel('Capacity: 7 Masters (Classic 5th Fuyuki)').setValue('cap_7').setEmoji('👥').setDescription('Standard 7-Master ritual'),
      new StringSelectMenuOptionBuilder().setLabel('Capacity: 14 Masters (Apocrypha Factions)').setValue('cap_14').setEmoji('👥').setDescription('14-Master conflict (7 Red vs 7 Black)'),
      new StringSelectMenuOptionBuilder().setLabel('Capacity: 30 Masters (Chaos Brawl)').setValue('cap_30').setEmoji('👥').setDescription('All-out server-wide 30 Masters chaos'),
      new StringSelectMenuOptionBuilder().setLabel('Servant Pool: Canon Type-Moon Only').setValue('pool_canon').setEmoji('📖').setDescription('Only official Type-Moon/FGO Servants'),
      new StringSelectMenuOptionBuilder().setLabel('Servant Pool: Canon + Custom Servants').setValue('pool_all').setEmoji('✨').setDescription('Allow all registered and custom Heroic Spirits'),
      new StringSelectMenuOptionBuilder().setLabel('Servant Pool: Custom Community Only').setValue('pool_custom').setEmoji('🎨').setDescription('Only user-created and meme Servants'),
      new StringSelectMenuOptionBuilder().setLabel('Class Exclusivity: Strict (1 per Class)').setValue('class_strict').setEmoji('🔒').setDescription('1 Saber, 1 Archer, etc.'),
      new StringSelectMenuOptionBuilder().setLabel('Class Exclusivity: Open Classes').setValue('class_open').setEmoji('🔓').setDescription('Allow duplicate classes'),
      new StringSelectMenuOptionBuilder().setLabel('Permadeath: Classic Elimination').setValue('permadeath_on').setEmoji('☠️').setDescription('Defeated Masters without seals are eliminated'),
      new StringSelectMenuOptionBuilder().setLabel('Permadeath: Casual Training Mode').setValue('permadeath_off').setEmoji('🛡️').setDescription('Defeated Masters can recover and rejoin'),
      new StringSelectMenuOptionBuilder().setLabel('Leylines: High Surge (2x Fast Regen)').setValue('leyline_fast').setEmoji('⚡').setDescription('2.5 min full recovery in Sanctuaries'),
      new StringSelectMenuOptionBuilder().setLabel('Leylines: Balanced Standard').setValue('leyline_standard').setEmoji('💧').setDescription('Standard 5 min full recovery'),
      new StringSelectMenuOptionBuilder().setLabel('Leylines: Desolate (No Auto-Regen)').setValue('leyline_desolate').setEmoji('🏜️').setDescription('HP recovery only via Command Seals/rituals'),
      new StringSelectMenuOptionBuilder().setLabel('Church Sanctuary: Active Asylum').setValue('church_active').setEmoji('⛪').setDescription('Masters can take asylum with Father Kotomine'),
      new StringSelectMenuOptionBuilder().setLabel('Church Sanctuary: Desecrated (No Asylum)').setValue('church_desecrated').setEmoji('🔥').setDescription('Church is unsafe; no sanctuary granted'),
      new StringSelectMenuOptionBuilder().setLabel('Trap Limit: Max 1 per Master').setValue('trap_1').setEmoji('🕸️').setDescription('Limit each Master to 1 Channel Trap'),
      new StringSelectMenuOptionBuilder().setLabel('Trap Limit: Max 3 per Master').setValue('trap_3').setEmoji('🕸️').setDescription('Standard 3 Traps per Master'),
      new StringSelectMenuOptionBuilder().setLabel('Faction Mode: Free-For-All').setValue('faction_ffa').setEmoji('⚔️').setDescription('Every Master for themselves'),
      new StringSelectMenuOptionBuilder().setLabel('Faction Mode: Red vs Black Factions').setValue('faction_teams').setEmoji('🚩').setDescription('Apocrypha team war')
    ];

    return new StringSelectMenuBuilder()
      .setCustomId('admin_war_rule_select')
      .setPlaceholder('⚙️ Fine-Tune War Rules (Seals, Pools, Capacity, Lethality)...')
      .addOptions(rawOptions.slice(0, 25));
  };

  if (category === 'personas') {
    const allProfiles = getAllCharacterProfiles();
    if (allProfiles.length > 0) {
      const options = allProfiles.slice(0, 25).map(p => {
        const isCustomOverride = hasCustomCharacterProfile(p.id);
        const isCanon = !!DEFAULT_SERVANT_CHARACTER_PROFILES[p.id];
        const statusLabel = isCustomOverride ? (isCanon ? '⭐ Custom' : '✨ Custom') : '📖 Canon';
        return new StringSelectMenuOptionBuilder()
          .setLabel(p.name.slice(0, 25))
          .setValue(p.id)
          .setDescription(`${statusLabel} | Quotes: ${(p.speechExamples || []).length} | Quirks: ${(p.mannerisms || []).length}`.slice(0, 50))
          .setEmoji('🎭');
      });

      const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('admin_select_persona_profile')
          .setPlaceholder(`🔍 Select a Servant Persona (${allProfiles.length} available)...`)
          .addOptions(options)
      );
      components.push(selectRow);
    }

    const personaActionsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('admin_persona_btn_add').setLabel('Create / Add Persona (Modal)').setEmoji('➕').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('admin_persona_btn_refresh').setLabel('Refresh List').setEmoji('🔄').setStyle(ButtonStyle.Secondary)
    );
    components.push(personaActionsRow);

  } else if (category === 'masters') {
    const allMasters = getAllMasters();
    if (allMasters.length > 0) {
      const options = allMasters.slice(0, 25).map(m => {
        const active = m.servants?.find(s => s.id === m.activeServantId) || m.servants?.[0];
        const sInfo = active ? `${active.template?.rarity}★ ${active.template?.name}` : 'No Servant';
        return new StringSelectMenuOptionBuilder()
          .setLabel(m.username.slice(0, 25))
          .setValue(`master_dossier_${m.discordId || m.id.replace('master_', '')}`)
          .setDescription(`SQ: ${m.saintQuartz || 0} | Tickets: ${m.summonTickets || 0} | ${sInfo}`.slice(0, 50))
          .setEmoji('👤');
      });

      const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('admin_select_master_dossier')
          .setPlaceholder('🔍 Select a Master to inspect full dossier...')
          .addOptions(options)
      );
      components.push(selectRow);
    }
  } else if (category === 'war') {
    // Presets Row
    const presetsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('admin_war_preset_fuyuki_7').setLabel('5th Fuyuki (7P)').setEmoji('🏆').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('admin_war_preset_apocrypha_14').setLabel('Apocrypha (14P Factions)').setEmoji('⚔️').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('admin_war_preset_singularity_chaos').setLabel('Singularity (30P Fast)').setEmoji('🌌').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_war_preset_desolate_hardcore').setLabel('Desolate (1-Seal Hardcore)').setEmoji('💀').setStyle(ButtonStyle.Danger)
    );

    // Lifecycle Actions Row
    const lifecycleRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('admin_quick_open_announce').setLabel('Announce War (Choose Channel)').setEmoji('📢').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('admin_war_action_restart').setLabel('Restart War').setEmoji('🚀').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('admin_war_action_reset').setLabel('Quick Refresh').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_war_refill_all_seals').setLabel('Refill All Seals').setEmoji('🔱').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_war_cataclysm_hub').setLabel('Cataclysm').setEmoji('⚡').setStyle(ButtonStyle.Danger)
    );

    const ruleSelectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(createRuleSelectMenu());

    components.push(presetsRow, lifecycleRow, ruleSelectRow);

  } else if (category === 'war_announce') {
    const war = getOrInitWarSession();
    const isCallActive = !!(war.recruitmentCall && war.recruitmentCall.active);

    // 1. Channel Selector Row
    const channelSelectRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('admin_war_announce_channel_select')
        .setPlaceholder('📢 Select Discord channel to post Holy Grail War Proclamation...')
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    );

    // 2. Timer Presets Row
    const timerRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('admin_war_timer_0').setLabel('Manual (No Timer)').setEmoji('⏱️').setStyle(adminAnnounceDraft.durationMinutes === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_war_timer_5').setLabel('5 Mins').setEmoji('⏱️').setStyle(adminAnnounceDraft.durationMinutes === 5 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_war_timer_15').setLabel('15 Mins').setEmoji('⏱️').setStyle(adminAnnounceDraft.durationMinutes === 15 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_war_timer_30').setLabel('30 Mins').setEmoji('⏱️').setStyle(adminAnnounceDraft.durationMinutes === 30 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_war_timer_60').setLabel('1 Hour').setEmoji('⏱️').setStyle(adminAnnounceDraft.durationMinutes === 60 ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );

    // 3. Format Presets Row
    const presetRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('admin_war_ann_preset_fuyuki_7').setLabel('Fuyuki (7P)').setEmoji('🏆').setStyle(adminAnnounceDraft.presetKey === 'fuyuki_7' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_war_ann_preset_apocrypha_14').setLabel('Apocrypha (14P)').setEmoji('⚔️').setStyle(adminAnnounceDraft.presetKey === 'apocrypha_14' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_war_ann_preset_singularity_chaos').setLabel('Singularity (30P)').setEmoji('🌌').setStyle(adminAnnounceDraft.presetKey === 'singularity_chaos' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_war_ann_preset_desolate_hardcore').setLabel('Desolate (1-Seal)').setEmoji('💀').setStyle(adminAnnounceDraft.presetKey === 'desolate_hardcore' ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );

    // 4. Action & Navigation Buttons
    const executionButtons: ButtonBuilder[] = [];

    if (isCallActive) {
      executionButtons.push(
        new ButtonBuilder().setCustomId('admin_war_announce_force_ignite').setLabel('Ignite War Now').setEmoji('⚡').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('admin_war_announce_cancel').setLabel('Cancel Call').setEmoji('❌').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('admin_war_announce_force_replace').setLabel('Replace & Broadcast').setEmoji('🔄').setStyle(ButtonStyle.Primary)
      );
    } else {
      executionButtons.push(
        new ButtonBuilder().setCustomId('admin_war_announce_post_current').setLabel('Post Proclamation').setEmoji('📢').setStyle(ButtonStyle.Success)
      );
    }

    executionButtons.push(
      new ButtonBuilder().setCustomId('admin_back_to_war').setLabel('Back to War Hub').setEmoji('◀️').setStyle(ButtonStyle.Secondary)
    );

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(executionButtons);

    components.push(channelSelectRow, timerRow, presetRow, actionRow);

  } else if (category === 'war_rules') {
    const war = getOrInitWarSession();
    const rules = war.rules || WAR_PRESETS.fuyuki_7;

    // DIRECT 1-CLICK COMMAND SEALS BUTTONS ROW
    const sealsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('admin_set_seals_1').setLabel('1 Seal').setEmoji('🔱').setStyle(rules.startingCommandSeals === 1 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_set_seals_2').setLabel('2 Seals').setEmoji('🔱').setStyle(rules.startingCommandSeals === 2 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_set_seals_3').setLabel('3 Seals (Canon)').setEmoji('🔱').setStyle(rules.startingCommandSeals === 3 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_set_seals_5').setLabel('5 Seals').setEmoji('🔱').setStyle(rules.startingCommandSeals === 5 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_set_seals_10').setLabel('10 Seals (Chaos)').setEmoji('🔱').setStyle(rules.startingCommandSeals === 10 ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );

    // DIRECT 1-CLICK CAPACITY & POOL BUTTONS ROW
    const capPoolRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('admin_set_cap_7').setLabel('7 Masters').setEmoji('👥').setStyle(rules.maxMasters === 7 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_set_cap_14').setLabel('14 Masters').setEmoji('👥').setStyle(rules.maxMasters === 14 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_set_cap_30').setLabel('30 Masters').setEmoji('👥').setStyle(rules.maxMasters === 30 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_set_pool_canon').setLabel('Canon Only').setEmoji('📖').setStyle(rules.servantPool === 'canon_only' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_set_pool_all').setLabel('All Servants').setEmoji('✨').setStyle(rules.servantPool === 'all' ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );

    // DIRECT 1-CLICK TOGGLE BUTTONS ROW
    const toggleRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('admin_toggle_permadeath').setLabel(`Permadeath: ${rules.permadeath ? 'ON 🟢' : 'OFF 🔴'}`).setEmoji('☠️').setStyle(rules.permadeath ? ButtonStyle.Danger : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_toggle_church').setLabel(`Church: ${rules.churchAsylum ? 'ON 🟢' : 'OFF 🔴'}`).setEmoji('⛪').setStyle(rules.churchAsylum ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_toggle_class_strict').setLabel(`Strict Classes: ${rules.classExclusivity ? 'ON 🔒' : 'OFF 🔓'}`).setEmoji('🔒').setStyle(rules.classExclusivity ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_toggle_factions').setLabel(`Factions: ${rules.factionMode ? 'Teams 🚩' : 'FFA ⚔️'}`).setEmoji('🚩').setStyle(rules.factionMode ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

    const ruleSelectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(createRuleSelectMenu());

    components.push(sealsRow, capPoolRow, toggleRow, ruleSelectRow);

  } else if (category === 'npsettings') {
    const settings = getDuelNpSettings();
    const actionButtonsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('admin_toggle_autodelete').setLabel(settings.autoDelete ? 'Auto-Delete: ON 🟢' : 'Auto-Delete: OFF 🔴').setStyle(settings.autoDelete ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_set_afk_30').setLabel('Timeout: 30s').setStyle(settings.afkTimeoutSeconds === 30 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_set_afk_60').setLabel('Timeout: 60s').setStyle(settings.afkTimeoutSeconds === 60 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_set_afk_120').setLabel('Timeout: 120s').setStyle(settings.afkTimeoutSeconds === 120 ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );
    components.push(actionButtonsRow);

  } else if (category === 'economy') {
    const mintRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('admin_mint_30sq').setLabel('+30 SQ (1 Multi)').setEmoji('💎').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('admin_mint_100sq').setLabel('+100 SQ').setEmoji('💎').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('admin_mint_5tickets').setLabel('+5 Tickets').setEmoji('🎫').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_refill_seals').setLabel('Refill 3 Seals').setEmoji('🔱').setStyle(ButtonStyle.Primary)
    );

    components.push(mintRow);
  }

  return { embeds, components };
}

// ==========================================
// 5. GLOBAL INTERACTION HANDLER
// ==========================================
export async function handleAdminGlobalInteraction(interaction: any) {
  try {
    const customId = interaction.customId;
    let currentCategory: 'war' | 'war_announce' | 'war_rules' | 'masters' | 'personas' | 'npanim' | 'npsettings' | 'listnp' | 'economy' = 'war';
    let actionOutcome: string | undefined = undefined;

    // Detect category
    if (customId === 'admin_tab_war_announce' || customId.startsWith('admin_war_announce') || customId.startsWith('admin_war_timer_') || customId.startsWith('admin_war_ann_preset_')) {
      currentCategory = 'war_announce';
    } else if (customId === 'admin_tab_war' || customId.startsWith('admin_war_') || customId.startsWith('admin_cata_')) {
      currentCategory = 'war';
    } else if (customId === 'admin_tab_masters' || customId === 'admin_select_master_dossier') {
      currentCategory = 'masters';
    } else if (customId === 'admin_tab_personas' || customId === 'admin_select_persona_profile' || customId.startsWith('admin_persona_')) {
      currentCategory = 'personas';
    } else if (customId === 'admin_tab_war_rules' || customId.startsWith('admin_set_') || customId.startsWith('admin_toggle_')) {
      currentCategory = 'war_rules';
    } else if (customId === 'admin_tab_npanim') {
      currentCategory = 'npanim';
    } else if (customId === 'admin_tab_npsettings' || customId === 'admin_toggle_autodelete' || customId.startsWith('admin_set_afk_')) {
      currentCategory = 'npsettings';
    } else if (customId === 'admin_tab_listnp') {
      currentCategory = 'listnp';
    } else if (customId === 'admin_tab_economy' || customId.startsWith('admin_mint_') || customId === 'admin_refill_seals' || customId.startsWith('admin_reset_')) {
      currentCategory = 'economy';
    }

    // PERSONA PROFILE DROPDOWN SELECTION
    if (customId === 'admin_select_persona_profile') {
      const selectedId = interaction.values?.[0] || '';
      const profile = getServantCharacterProfile(selectedId, selectedId) ||
        getAllCharacterProfiles().find(p => p.id === selectedId || p.name.toLowerCase() === selectedId.toLowerCase());
      if (profile) {
        const card = buildPersonaCardEmbed(profile);
        await interaction.update({
          embeds: [card.embed],
          components: card.components
        });
        return;
      }
    }

    // PERSONA MODAL TRIGGER BUTTONS
    if (customId === 'admin_persona_btn_add') {
      const modal = buildPersonaModal();
      await interaction.showModal(modal);
      return;
    }

    if (customId.startsWith('admin_persona_btn_edit_')) {
      const profId = customId.replace('admin_persona_btn_edit_', '');
      const profile = getServantCharacterProfile(profId, profId) ||
        getAllCharacterProfiles().find(p => p.id === profId || p.name.toLowerCase() === profId.toLowerCase()) || {
        id: profId,
        name: profId,
        aliases: [profId],
        persona: '',
        speechExamples: [],
        mannerisms: [],
        bannedTropes: []
      };
      const modal = buildPersonaModal(profile);
      await interaction.showModal(modal);
      return;
    }

    if (customId.startsWith('admin_persona_btn_reset_')) {
      const profId = customId.replace('admin_persona_btn_reset_', '');
      const existed = deleteCustomCharacterProfile(profId);
      const isCanon = !!DEFAULT_SERVANT_CHARACTER_PROFILES[profId];
      actionOutcome = existed 
        ? (isCanon ? `🗑️ Reset **${profId}** back to canonical Type-Moon baseline.` : `🗑️ Deleted custom persona card for **${profId}**.`)
        : `No custom override found for **${profId}**.`;
      currentCategory = 'personas';
    }

    // MASTER DOSSIER DROPDOWN SELECTION
    if (customId === 'admin_select_master_dossier') {
      const selectedVal = interaction.values?.[0] || '';
      const targetId = selectedVal.replace('master_dossier_', '');
      const master = await getOrCreateMaster(targetId);
      const dossier = buildMasterDossier(master);
      await interaction.update({
        embeds: [dossier.embed],
        components: dossier.components
      });
      return;
    }

    // MASTER DOSSIER DIRECT BUTTON ACTIONS
    if (customId.startsWith('admin_m_')) {
      const parts = customId.split('_'); // e.g. ['admin', 'm', 'give', '30sq', '<targetId>'] or ['admin', 'm', 'sever', '<targetId>']
      let targetId = parts[parts.length - 1];
      let subAction = parts.slice(2, parts.length - 1).join('_');

      if (!targetId || targetId === 'undefined') {
        targetId = interaction.user.id;
      }

      const master = await getOrCreateMaster(targetId);
      let outcomeMsg = '';

      if (subAction === 'give_30sq') {
        master.saintQuartz = (master.saintQuartz || 0) + 30;
        await saveMaster(master);
        outcomeMsg = `✨ Bestowed **+30 Saint Quartz** upon **${master.username}**! (Total: **${master.saintQuartz} SQ**)`;
      } else if (subAction === 'give_100sq') {
        master.saintQuartz = (master.saintQuartz || 0) + 100;
        await saveMaster(master);
        outcomeMsg = `✨ Bestowed **+100 Saint Quartz** upon **${master.username}**! (Total: **${master.saintQuartz} SQ**)`;
      } else if (subAction === 'give_tickets') {
        master.summonTickets = (master.summonTickets || 0) + 5;
        await saveMaster(master);
        outcomeMsg = `🎫 Bestowed **+5 Summon Tickets** upon **${master.username}**! (Total: **${master.summonTickets} Tickets**)`;
      } else if (subAction === 'refill_seals') {
        master.commandSeals = 3;
        await saveMaster(master);
        outcomeMsg = `🔱 Restored **3/3 Command Seals** for **${master.username}**!`;
      } else if (subAction === 'give_stats') {
        const res = await giveCurrencyToMaster(targetId, 'stat_points', 50);
        outcomeMsg = res.message;
      } else if (subAction === 'sever') {
        const res = await removeServantFromMaster(targetId);
        outcomeMsg = res.message;
      } else if (subAction === 'wipe_ces') {
        const res = await removeCraftEssenceFromMaster(targetId, 'all', 1, true);
        outcomeMsg = res.message;
      } else if (subAction === 'reset_vault') {
        await resetSingleMasterVault(targetId, { startingSq: 30, startingQp: 0, startingTickets: 0 });
        outcomeMsg = `🔄 **Full Vault Reset Executed!** All items cleared, SQ set to 30, Tickets to 0.`;
      } else if (subAction === 'refresh') {
        outcomeMsg = `🔄 Dossier refreshed from persistent database.`;
      }

      const updatedMaster = await getOrCreateMaster(targetId);
      const dossier = buildMasterDossier(updatedMaster, outcomeMsg);
      await interaction.update({
        embeds: [dossier.embed],
        components: dossier.components
      });
      return;
    }

    // TAB NAVIGATION
    if (customId === 'admin_tab_war' || customId === 'admin_back_to_war') {
      currentCategory = 'war';
    } else if (customId === 'admin_tab_war_announce' || customId === 'admin_quick_open_announce') {
      currentCategory = 'war_announce';
    } else if (customId === 'admin_tab_masters') {
      currentCategory = 'masters';
    } else if (customId === 'admin_tab_personas') {
      currentCategory = 'personas';
    } else if (customId === 'admin_tab_war_rules') {
      currentCategory = 'war_rules';
    } else if (customId === 'admin_tab_npanim') {
      currentCategory = 'npanim';
    } else if (customId === 'admin_tab_npsettings') {
      currentCategory = 'npsettings';
    } else if (customId === 'admin_tab_listnp') {
      currentCategory = 'listnp';
    } else if (customId === 'admin_tab_economy') {
      currentCategory = 'economy';
    }

    // WAR ANNOUNCEMENT & CHANNEL SELECTOR HANDLERS
    else if (customId === 'admin_war_announce_channel_select') {
      currentCategory = 'war_announce';
      const selectedChanId = (interaction as any).values?.[0];
      if (selectedChanId) {
        adminAnnounceDraft.targetChannelId = selectedChanId;
        const war = getOrInitWarSession();
        if (war.recruitmentCall && war.recruitmentCall.active) {
          const activeCh = war.recruitmentCall.channelId ? `<#${war.recruitmentCall.channelId}>` : 'another channel';
          actionOutcome = `🎯 Target channel set to <#${selectedChanId}>.\n\n` +
            `⚠️ **An active recruitment drive is already ongoing in ${activeCh} (${war.recruitmentCall.applicantIds.length} applicants).**\n` +
            `Click **[Replace & Broadcast]** below if you wish to cancel the old proclamation and dispatch the new one to <#${selectedChanId}>.`;
        } else {
          let targetChan: any = null;
          try {
            targetChan = interaction.guild?.channels.cache.get(selectedChanId) || await interaction.client.channels.fetch(selectedChanId);
          } catch {
            targetChan = null;
          }

          if (targetChan && typeof targetChan.send === 'function') {
            const res = await startWarRecruitment(interaction.client, targetChan, interaction.user, {
              durationMinutes: adminAnnounceDraft.durationMinutes,
              maxSlots: adminAnnounceDraft.maxSlots,
              presetKey: adminAnnounceDraft.presetKey
            });

            if (res.success) {
              actionOutcome = `✅ **Holy Grail War Recruitment Broadcasted to <#${selectedChanId}>!**\n\n` +
                `• **Target Channel:** <#${selectedChanId}>\n` +
                `• **Format:** \`${WAR_PRESETS[adminAnnounceDraft.presetKey]?.formatName || 'Fuyuki 7'}\` (${adminAnnounceDraft.maxSlots} Max Masters)\n` +
                `• **Timer:** ${adminAnnounceDraft.durationMinutes > 0 ? `\`${adminAnnounceDraft.durationMinutes} Minutes\`` : '`Manual Start`'}\n` +
                `• **Secrecy:** Magi can now safely click to enroll with complete anonymity!`;
            } else {
              actionOutcome = `❌ **Recruitment Dispatch Failed:** ${res.message}`;
            }
          } else {
            actionOutcome = `❌ Selected channel <#${selectedChanId}> is not accessible or lacks send permissions.`;
          }
        }
      }
    } else if (customId === 'admin_war_announce_post_current') {
      currentCategory = 'war_announce';
      const targetChanId = adminAnnounceDraft.targetChannelId || interaction.channelId;
      let targetChan: any = null;
      try {
        targetChan = interaction.guild?.channels.cache.get(targetChanId) || await interaction.client.channels.fetch(targetChanId) || interaction.channel;
      } catch {
        targetChan = interaction.channel;
      }

      if (targetChan && typeof targetChan.send === 'function') {
        const res = await startWarRecruitment(interaction.client, targetChan, interaction.user, {
          durationMinutes: adminAnnounceDraft.durationMinutes,
          maxSlots: adminAnnounceDraft.maxSlots,
          presetKey: adminAnnounceDraft.presetKey
        });

        if (res.success) {
          actionOutcome = `✅ **Holy Grail War Recruitment Broadcasted to <#${targetChan.id}>!**\n\n` +
            `• **Channel:** <#${targetChan.id}>\n` +
            `• **Timer:** ${adminAnnounceDraft.durationMinutes > 0 ? `${adminAnnounceDraft.durationMinutes} Minutes` : 'Manual Start'}\n` +
            `• **Capacity:** ${adminAnnounceDraft.maxSlots} Masters\n` +
            `• **Secrecy:** Magi enrollment is completely anonymous.`;
        } else {
          actionOutcome = `❌ **Recruitment Dispatch Blocked:** ${res.message}`;
        }
      } else {
        actionOutcome = `❌ Current channel cannot receive messages.`;
      }
    } else if (customId === 'admin_war_announce_force_replace') {
      currentCategory = 'war_announce';
      const targetChanId = adminAnnounceDraft.targetChannelId || interaction.channelId;
      let targetChan: any = null;
      try {
        targetChan = interaction.guild?.channels.cache.get(targetChanId) || await interaction.client.channels.fetch(targetChanId) || interaction.channel;
      } catch {
        targetChan = interaction.channel;
      }

      if (targetChan && typeof targetChan.send === 'function') {
        const res = await startWarRecruitment(interaction.client, targetChan, interaction.user, {
          durationMinutes: adminAnnounceDraft.durationMinutes,
          maxSlots: adminAnnounceDraft.maxSlots,
          presetKey: adminAnnounceDraft.presetKey,
          forceRestart: true
        });

        if (res.success) {
          actionOutcome = `✅ **Previous Call Cancelled & New Proclamation Broadcasted to <#${targetChan.id}>!**\n\n` +
            `• **Channel:** <#${targetChan.id}>\n` +
            `• **Timer:** ${adminAnnounceDraft.durationMinutes > 0 ? `${adminAnnounceDraft.durationMinutes} Minutes` : 'Manual Start'}\n` +
            `• **Capacity:** ${adminAnnounceDraft.maxSlots} Masters\n` +
            `• **Clean Transition:** The previous proclamation card was safely cancelled.`;
        } else {
          actionOutcome = `❌ **Recruitment Dispatch Failed:** ${res.message}`;
        }
      } else {
        actionOutcome = `❌ Target channel is not accessible or lacks permissions.`;
      }
    } else if (customId.startsWith('admin_war_timer_')) {
      currentCategory = 'war_announce';
      const minutes = parseInt(customId.replace('admin_war_timer_', ''), 10);
      adminAnnounceDraft.durationMinutes = minutes;
      actionOutcome = minutes === 0 
        ? '⏱️ **Recruitment Timer:** Set to **Manual Start** (no automatic countdown timer).'
        : `⏱️ **Recruitment Timer:** Set to **${minutes} minutes** countdown!`;
    } else if (customId.startsWith('admin_war_ann_preset_')) {
      currentCategory = 'war_announce';
      const pKey = customId.replace('admin_war_ann_preset_', '');
      adminAnnounceDraft.presetKey = pKey;
      adminAnnounceDraft.maxSlots = WAR_PRESETS[pKey]?.maxMasters || 7;
      actionOutcome = `🏆 **Recruitment Format:** Set to **${WAR_PRESETS[pKey]?.formatName || pKey}** (${adminAnnounceDraft.maxSlots} Max Masters)!`;
    } else if (customId === 'admin_war_announce_force_ignite') {
      const res = await igniteWarFromRecruitment(interaction.client, interaction.user);
      actionOutcome = `⚡ **${res.success ? 'WAR IGNITED' : 'Ignition Failed'}:**\n${res.message}`;
      currentCategory = 'war';
    } else if (customId === 'admin_war_announce_cancel') {
      currentCategory = 'war_announce';
      const res = await cancelRecruitmentCall(interaction.client, interaction.user.username);
      actionOutcome = res.message;
    }

    // WAR PRESETS
    else if (customId === 'admin_war_preset_fuyuki_7') {
      const res = startOrRestartWar('fuyuki_7', undefined, interaction.user.username);
      actionOutcome = `🏆 **Applied Preset: 5th Fuyuki Holy Grail War (7 Masters)!**\n${res.message}`;
    } else if (customId === 'admin_war_preset_apocrypha_14') {
      const res = startOrRestartWar('apocrypha_14', undefined, interaction.user.username);
      actionOutcome = `⚔️ **Applied Preset: Trifas Great Holy Grail War (14 Masters, Black vs Red)!**\n${res.message}`;
    } else if (customId === 'admin_war_preset_singularity_chaos') {
      const res = startOrRestartWar('singularity_chaos', undefined, interaction.user.username);
      actionOutcome = `🌌 **Applied Preset: Grand Singularity Chaos (30 Masters FFA, Fast Mana)!**\n${res.message}`;
    } else if (customId === 'admin_war_preset_desolate_hardcore') {
      const res = startOrRestartWar('desolate_hardcore', undefined, interaction.user.username);
      actionOutcome = `💀 **Applied Preset: Desolate Hardcore Ritual (1 Seal, Permadeath, No Sanctuary)!**\n${res.message}`;
    }

    // WAR LIFECYCLE & CONTRACTS
    else if (customId === 'admin_war_action_restart') {
      const war = getOrInitWarSession();
      const res = startOrRestartWar(war.rules?.preset || 'fuyuki_7', war.rules, interaction.user.username, { wipeRoster: true });
      actionOutcome = `🚀 **Holy Grail War Restarted!**\n${res.message}`;
    } else if (customId === 'admin_war_fresh_slate') {
      const war = getOrInitWarSession();
      startOrRestartWar(war.rules?.preset || 'fuyuki_7', war.rules, interaction.user.username, { wipeRoster: true });
      const startingSeals = war.rules?.startingCommandSeals || 3;
      const wipeResult = await resetAllMastersServants({ fullSever: true, startingSeals });
      actionOutcome = `🧹 **FRESH SEASON LAUNCHED (COMPLETE CONTRACT WIPE)!**\n\n` +
        `• ⚔️ **Severed Contracts:** All **${wipeResult.count} Master(s)** contracts dissolved.\n` +
        `• 📜 **Roster Cleared:** All 7 Master slots are now open in the Throne of Heroes.\n` +
        `• 🔱 **Command Seals:** Re-inscribed **${startingSeals} Command Seals** for all Masters.\n` +
        `• 🕯️ Use \`/summon ritual\` to draw the magic circle and summon a new Heroic Spirit!`;
    } else if (customId === 'admin_war_reset_my_servant') {
      const war = getOrInitWarSession();
      const startingSeals = war.rules?.startingCommandSeals || 3;
      await resetSingleMasterServant(interaction.user.id, { fullSever: true, resetSeals: startingSeals });
      if (war.participants && war.participants[interaction.user.id]) {
        delete war.participants[interaction.user.id];
      }
      actionOutcome = `🗡️ **SACRED COVENANT SEVERED!**\n\n` +
        `Your Servant contract has been completely released and your war registration cleared.\n` +
        `• 🔱 Command Seals restored to **${startingSeals}**.\n` +
        `• Use \`/summon ritual\` to summon a brand new Heroic Spirit from the Throne!`;
    } else if (customId === 'admin_war_reset_my_stats') {
      await resetSingleMasterServant(interaction.user.id, { resetStatsOnly: true });
      actionOutcome = `🌱 **SERVANT LEVEL & STATS RESET TO LV.1!**\n\n` +
        `Your active Servant has been reset to **Level 1** with 0 EXP and 0 allocated bonus stat points. Base parameters and Noble Phantasm remain intact.`;
    } else if (customId === 'admin_war_action_reset') {
      const res = resetHolyGrailWar(true, interaction.user.username);
      actionOutcome = `🔄 **Ritual Refreshed:** ${res.message}`;
    } else if (customId === 'admin_war_refill_all_seals') {
      const war = getOrInitWarSession();
      const res = refillAllWarParticipantsSeals(war, interaction.user.username);
      actionOutcome = res.message;
    } else if (customId === 'admin_war_cataclysm_hub') {
      const cataclysmEmbed = new EmbedBuilder()
        .setTitle('⚡ Overseer Leyline Cataclysm Selector')
        .setDescription(
          `Select a catastrophic mid-war event to unleash upon all Masters:\n\n` +
          `• 🌊 **Grail Mud Overflow:** All living Masters take **2,500 corruption DMG** and their spiritual concealment is stripped (**EXPOSED**).\n` +
          `• 🔥 **Fuyuki Inferno:** Destroys all channel bounded traps and flushes all Church refugees into active combat.\n` +
          `• 👁️ **Angra Mainyu Descends:** Deals **1,500 shockwave DMG** to all contracted Servants.\n` +
          `• ⚡ **Leyline Mana Surge:** Grants **+1 Command Seal** and **+50% HP heal** to all living Masters.`
        )
        .setColor(0xef4444);

      const cataclysmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('admin_cata_grail_mud').setLabel('Grail Mud').setEmoji('🌊').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('admin_cata_fuyuki_fire').setLabel('Fuyuki Inferno').setEmoji('🔥').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('admin_cata_angra_mainyu').setLabel('Angra Mainyu').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('admin_cata_mana_surge').setLabel('Mana Surge').setEmoji('⚡').setStyle(ButtonStyle.Success)
      );

      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('admin_tab_war').setLabel('Back to War Dashboard').setEmoji('◀️').setStyle(ButtonStyle.Secondary)
      );

      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [cataclysmEmbed], components: [cataclysmRow, backRow] });
      } else {
        await interaction.update({ embeds: [cataclysmEmbed], components: [cataclysmRow, backRow] });
      }
      return;
    } else if (customId.startsWith('admin_cata_')) {
      const cataType = customId.replace('admin_cata_', '') as any;
      const war = getOrInitWarSession();
      const res = triggerAdminCataclysm(war, cataType, interaction.user.username);
      actionOutcome = `⚡ **${res.banner}**\n${res.message}`;
      currentCategory = 'war';
    } else if (customId === 'admin_war_history_view') {
      const war = getOrInitWarSession();
      const hist = war.history || [];
      let desc = '';
      if (hist.length === 0) {
        desc = 'No archived Grail Wars in the Hall of Fame yet.\n\nOnce a Grail War concludes or is restarted, the previous victor and battle statistics will be recorded here.';
      } else {
        desc = hist.slice(0, 10).map((h, idx) => 
          `**${idx + 1}. ${h.title}** (${new Date(h.concludedAt).toLocaleDateString()})\n` +
          `• 🏆 **Victor:** **${h.winnerUsername}** with *${h.winnerServantName}*\n` +
          `• 👥 **Participants:** ${h.totalParticipants} Masters | ⚔️ **Eliminations:** ${h.totalEliminations}\n` +
          `• 📜 **Rules:** \`${h.rulesSummary}\``
        ).join('\n\n');
      }

      const histEmbed = new EmbedBuilder()
        .setTitle('📜 Hall of Fame — Historical Grail War Chronicles')
        .setDescription(desc)
        .setColor(0xd4af37);

      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('admin_tab_war').setLabel('Back to War Dashboard').setEmoji('◀️').setStyle(ButtonStyle.Secondary)
      );

      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [histEmbed], components: [backRow] });
      } else {
        await interaction.update({ embeds: [histEmbed], components: [backRow] });
      }
      return;
    }

    // DIRECT 1-CLICK BUTTON RULE HANDLERS
    else if (customId.startsWith('admin_set_seals_')) {
      const seals = parseInt(customId.replace('admin_set_seals_', ''), 10);
      const war = getOrInitWarSession();
      const updateRes = updateWarRules(war, { startingCommandSeals: seals }, interaction.user.username);
      actionOutcome = `🔱 **Starting Command Seals set to ${seals}!**\n${updateRes.message}`;
      currentCategory = 'war_rules';
    } else if (customId.startsWith('admin_set_cap_')) {
      const cap = parseInt(customId.replace('admin_set_cap_', ''), 10);
      const war = getOrInitWarSession();
      const updateRes = updateWarRules(war, { maxMasters: cap, formatName: `Custom ${cap}-Master War` }, interaction.user.username);
      actionOutcome = `👥 **Master Capacity set to ${cap}!**\n${updateRes.message}`;
      currentCategory = 'war_rules';
    } else if (customId === 'admin_set_pool_canon') {
      const war = getOrInitWarSession();
      const updateRes = updateWarRules(war, { servantPool: 'canon_only' }, interaction.user.username);
      actionOutcome = `📖 **Servant Pool set to Canon Type-Moon Only!**\n${updateRes.message}`;
      currentCategory = 'war_rules';
    } else if (customId === 'admin_set_pool_all') {
      const war = getOrInitWarSession();
      const updateRes = updateWarRules(war, { servantPool: 'all' }, interaction.user.username);
      actionOutcome = `✨ **Servant Pool set to Canon + Custom Servants (All)!**\n${updateRes.message}`;
      currentCategory = 'war_rules';
    } else if (customId === 'admin_toggle_permadeath') {
      const war = getOrInitWarSession();
      const current = war.rules?.permadeath ?? true;
      const updateRes = updateWarRules(war, { permadeath: !current }, interaction.user.username);
      actionOutcome = `☠️ **Permadeath is now ${!current ? 'ENABLED (Defeat = Elimination)' : 'DISABLED (Casual Training Mode)'}!**\n${updateRes.message}`;
      currentCategory = 'war_rules';
    } else if (customId === 'admin_toggle_church') {
      const war = getOrInitWarSession();
      const current = war.rules?.churchAsylum ?? true;
      const updateRes = updateWarRules(war, { churchAsylum: !current }, interaction.user.username);
      actionOutcome = `⛪ **Church Asylum is now ${!current ? 'ACTIVE (Sanctuary granted)' : 'DESECRATED (No Sanctuary)'}!**\n${updateRes.message}`;
      currentCategory = 'war_rules';
    } else if (customId === 'admin_toggle_class_strict') {
      const war = getOrInitWarSession();
      const current = war.rules?.classExclusivity ?? true;
      const updateRes = updateWarRules(war, { classExclusivity: !current }, interaction.user.username);
      actionOutcome = `🔒 **Class Exclusivity is now ${!current ? 'STRICT (1 per class)' : 'OPEN (Duplicate classes allowed)'}!**\n${updateRes.message}`;
      currentCategory = 'war_rules';
    } else if (customId === 'admin_toggle_factions') {
      const war = getOrInitWarSession();
      const current = war.rules?.factionMode ?? false;
      const updateRes = updateWarRules(war, { factionMode: !current }, interaction.user.username);
      actionOutcome = `🚩 **Faction War Mode is now ${!current ? 'ACTIVE (Red vs Black Teams)' : 'FREE-FOR-ALL (Every Master for themselves)'}!**\n${updateRes.message}`;
      currentCategory = 'war_rules';
    }

    // RULE CUSTOMIZATION SELECT MENU
    else if (customId === 'admin_war_rule_select' && interaction.isStringSelectMenu()) {
      const val = interaction.values[0];
      const war = getOrInitWarSession();
      let ruleChanges: Partial<WarRules> = {};

      if (val === 'seals_1') ruleChanges = { startingCommandSeals: 1 };
      else if (val === 'seals_2') ruleChanges = { startingCommandSeals: 2 };
      else if (val === 'seals_3') ruleChanges = { startingCommandSeals: 3 };
      else if (val === 'seals_5') ruleChanges = { startingCommandSeals: 5 };
      else if (val === 'seals_10') ruleChanges = { startingCommandSeals: 10 };
      else if (val === 'cap_7') ruleChanges = { maxMasters: 7, formatName: 'Custom 7-Master War' };
      else if (val === 'cap_14') ruleChanges = { maxMasters: 14, formatName: 'Custom 14-Master War' };
      else if (val === 'cap_20') ruleChanges = { maxMasters: 20, formatName: 'Custom 20-Master Singularity' };
      else if (val === 'cap_30') ruleChanges = { maxMasters: 30, formatName: 'Custom 30-Master War' };
      else if (val === 'pool_canon') ruleChanges = { servantPool: 'canon_only' };
      else if (val === 'pool_all') ruleChanges = { servantPool: 'all' };
      else if (val === 'pool_custom') ruleChanges = { servantPool: 'custom_only' };
      else if (val === 'class_strict') ruleChanges = { classExclusivity: true };
      else if (val === 'class_open') ruleChanges = { classExclusivity: false };
      else if (val === 'permadeath_on') ruleChanges = { permadeath: true };
      else if (val === 'permadeath_off') ruleChanges = { permadeath: false };
      else if (val === 'leyline_fast') ruleChanges = { leylineDensity: 'fast' };
      else if (val === 'leyline_standard') ruleChanges = { leylineDensity: 'standard' };
      else if (val === 'leyline_desolate') ruleChanges = { leylineDensity: 'desolate' };
      else if (val === 'church_active') ruleChanges = { churchAsylum: true };
      else if (val === 'church_desecrated') ruleChanges = { churchAsylum: false };
      else if (val === 'trap_1') ruleChanges = { trapLimitPerMaster: 1 };
      else if (val === 'trap_3') ruleChanges = { trapLimitPerMaster: 3 };
      else if (val === 'trap_5') ruleChanges = { trapLimitPerMaster: 5 };
      else if (val === 'faction_ffa') ruleChanges = { factionMode: false };
      else if (val === 'faction_teams') ruleChanges = { factionMode: true };

      const updateRes = updateWarRules(war, ruleChanges, interaction.user.username);
      actionOutcome = `⚙️ **Rule Applied:** ${updateRes.message}`;
    }

    // SETTINGS ACTIONS
    else if (customId === 'admin_toggle_autodelete') {
      const settings = getDuelNpSettings();
      const updated = setDuelNpSettings({ autoDelete: !settings.autoDelete });
      actionOutcome = `Auto-Delete updated to: **${updated.autoDelete ? 'Enabled' : 'Disabled'}**`;
      currentCategory = 'npsettings';
    } else if (customId.startsWith('admin_set_afk_')) {
      const val = parseInt(customId.replace('admin_set_afk_', ''), 10);
      const updated = setDuelNpSettings({ afkTimeoutSeconds: val });
      actionOutcome = `AFK Safety Timeout updated to: **${updated.afkTimeoutSeconds}s**`;
      currentCategory = 'npsettings';
    }

    // ECONOMY MINT ACTIONS
    else if (customId === 'admin_mint_30sq') {
      const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
      master.saintQuartz = (master.saintQuartz || 0) + 30;
      await saveMaster(master);
      actionOutcome = `✨ Minted **+30 Saint Quartz**! Total SQ: **${master.saintQuartz}**`;
      currentCategory = 'economy';
    } else if (customId === 'admin_mint_100sq') {
      const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
      master.saintQuartz = (master.saintQuartz || 0) + 100;
      await saveMaster(master);
      actionOutcome = `✨ Minted **+100 Saint Quartz**! Total SQ: **${master.saintQuartz}**`;
      currentCategory = 'economy';
    } else if (customId === 'admin_mint_5tickets') {
      const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
      master.summonTickets = (master.summonTickets || 0) + 5;
      await saveMaster(master);
      actionOutcome = `🎫 Minted **+5 Summon Tickets**! Total Tickets: **${master.summonTickets}**`;
      currentCategory = 'economy';
    } else if (customId === 'admin_refill_seals') {
      const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
      master.commandSeals = 3;
      await saveMaster(master);
      actionOutcome = `🔱 Refilled Command Seals to **3/3**!`;
      currentCategory = 'economy';
    }
    
    // ECONOMY & INVENTORY RESETS
    else if (customId === 'admin_reset_my_currency') {
      const master = await resetSingleMasterCurrency(interaction.user.id, { startingSq: 30, startingQp: 0, startingTickets: 0 });
      actionOutcome = `🧹 **Currency Balances Reset!**\n• Saint Quartz: **${master?.saintQuartz || 30} SQ**\n• Summon Tickets: **0**`;
      currentCategory = 'economy';
    } else if (customId === 'admin_reset_my_inventory') {
      const master = await resetSingleMasterInventory(interaction.user.id);
      actionOutcome = `🎒 **Inventory Reset!**\n• All Craft Essences wiped (**0 CEs**)\n• All Servants un-equipped from Craft Essences\n• Homunculi count reset to **0**`;
      currentCategory = 'economy';
    } else if (customId === 'admin_reset_my_all_vault') {
      const master = await resetSingleMasterVault(interaction.user.id, { startingSq: 30, startingQp: 0, startingTickets: 0 });
      actionOutcome = `🔄 **Full Vault Reset (Items & Currency)!**\n• Craft Essences & Items: **Wiped**\n• Saint Quartz: **30 SQ** (Default)\n• Summon Tickets: **0**`;
      currentCategory = 'economy';
    } else if (customId === 'admin_reset_server_economy') {
      const res = await resetAllMastersInventoryAndCurrency({ startingSq: 30, startingQp: 0, startingTickets: 0 });
      actionOutcome = `⚠️ **SERVER-WIDE INVENTORY & CURRENCY WIPE!**\n\n` +
        `• **${res.count} Master(s)** updated.\n` +
        `• All Craft Essences dissolved and unequipped across all Masters.\n` +
        `• All currency balances reset (30 SQ starting pool, 0 Tickets).`;
      currentCategory = 'economy';
    }

    const hub = buildAdminHub(currentCategory, actionOutcome);
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({
        embeds: hub.embeds,
        components: hub.components
      });
    } else {
      await interaction.update({
        embeds: hub.embeds,
        components: hub.components
      });
    }
  } catch (err: any) {
    if (err.code === 10062 || err.message?.includes('Unknown interaction')) return;
    console.error('Error handling global admin interaction:', err);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '⚠️ An error occurred while processing admin action.', flags: MessageFlags.Ephemeral });
      }
    } catch {
      // ignore
    }
  }
}
