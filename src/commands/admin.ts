import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  AutocompleteInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
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
  saveMaster
} from '../database/service';

// ==========================================
// 1. SLASH COMMAND DEFINITION
// ==========================================
export const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Fate/Grand Order Admin Hub — Manage NP Animations, Settings & System Utilities')
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
            { name: '🎬 NP Animations & Chant Registry', value: 'npanim' },
            { name: '⚙️ Duel NP Settings & Timing', value: 'npsettings' },
            { name: '📋 Registered Custom Animations', value: 'listnp' },
            { name: '💎 Economy & Saint Quartz Mint', value: 'economy' }
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
  );

// ==========================================
// 2. AUTOCOMPLETE
// ==========================================
export async function autocomplete(interaction: AutocompleteInteraction) {
  try {
    const focusedOption = interaction.options.getFocused(true);
    const query = focusedOption.value.toLowerCase().trim();
    const allServants = getAllThroneServants();

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

  const category = (subcommand as any) || (interaction.options.getString('category') as any) || 'npanim';

  if (subcommand === 'npanim') {
    const servantQuery = interaction.options.getString('servant', true).trim();
    const gifUrl = interaction.options.getString('gif_url', true).trim();
    const chant = interaction.options.getString('chant')?.trim();

    const result = setServantNpAnimation(servantQuery, gifUrl, chant, interaction.user.username);

    if (!result.success || !result.servant) {
      await interaction.reply({
        ephemeral: true,
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
      .setImage(gifUrl)
      .setColor(0xd4af37)
      .setFooter({ text: `Configured by Admin ${interaction.user.username} • Persistent on disk` });

    await interaction.reply({ embeds: [embed] });
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
  await interaction.deferReply({ ephemeral: true });
  const { embeds, components } = buildAdminHub(category);
  const msg = await interaction.editReply({ embeds, components });
  attachAdminCollector(msg, interaction.user.id, category);
}

// ==========================================
// 4. ADMIN HUB BUILDER
// ==========================================
export function buildAdminHub(
  category: 'npanim' | 'npsettings' | 'listnp' | 'economy' = 'npanim',
  actionOutcomeMsg?: string
) {
  let embeds: EmbedBuilder[] = [];

  if (category === 'npanim') {
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

  } else if (category === 'economy') {
    const embed = new EmbedBuilder()
      .setTitle('💎 Admin Control: Economy & Saint Quartz Mint')
      .setDescription(
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `Administrative tools for currency distribution and test summonings.\n\n` +
        `• **Grant Saint Quartz (SQ):** Add currency for gacha testing\n` +
        `• **Grant Quantum Particles (QP):** Add currency for enhancements\n` +
        `• **Grant Command Seals:** Refill tactical Command Seals\n\n` +
        `*Click a quick-action button below to mint resources for your Master account:*`
      )
      .setColor(0x10b981)
      .setFooter({ text: 'Admin Suite • Holy Grail Treasury' });

    embeds = [embed];
  }

  // --- UI BUTTON ROWS ---
  const categoryNavRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('admin_tab_npanim').setLabel('NP Animations').setEmoji('🎬').setStyle(category === 'npanim' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('admin_tab_npsettings').setLabel('Duel Settings').setEmoji('⚙️').setStyle(category === 'npsettings' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('admin_tab_listnp').setLabel('Animation List').setEmoji('📋').setStyle(category === 'listnp' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('admin_tab_economy').setLabel('Economy Mint').setEmoji('💎').setStyle(category === 'economy' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  const actionButtonsRow = new ActionRowBuilder<ButtonBuilder>();

  if (category === 'npsettings') {
    const settings = getDuelNpSettings();
    actionButtonsRow.addComponents(
      new ButtonBuilder().setCustomId('admin_toggle_autodelete').setLabel(settings.autoDelete ? 'Auto-Delete: ON 🟢' : 'Auto-Delete: OFF 🔴').setStyle(settings.autoDelete ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_set_afk_30').setLabel('Timeout: 30s').setStyle(settings.afkTimeoutSeconds === 30 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_set_afk_60').setLabel('Timeout: 60s').setStyle(settings.afkTimeoutSeconds === 60 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_set_afk_120').setLabel('Timeout: 120s').setStyle(settings.afkTimeoutSeconds === 120 ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );
  } else if (category === 'economy') {
    actionButtonsRow.addComponents(
      new ButtonBuilder().setCustomId('admin_mint_30sq').setLabel('+30 SQ (1 Multi)').setEmoji('💎').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('admin_mint_100sq').setLabel('+100 SQ').setEmoji('💎').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('admin_mint_qp').setLabel('+1,000,000 QP').setEmoji('🪙').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_refill_seals').setLabel('Refill 3 Seals').setEmoji('🔱').setStyle(ButtonStyle.Danger)
    );
  } else {
    actionButtonsRow.addComponents(
      new ButtonBuilder().setCustomId('admin_refresh_view').setLabel('Refresh View').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_link_gacha').setLabel('Gacha Test (/gacha)').setEmoji('🔮').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_link_duel').setLabel('Duel Test (/duel)').setEmoji('⚔️').setStyle(ButtonStyle.Secondary)
    );
  }

  const crossHubShortcutsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('admin_link_inventory').setLabel('Inventory (/inventory)').setEmoji('👔').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('admin_link_servant').setLabel('Servant (/servant)').setEmoji('⚔️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('admin_link_grailwar').setLabel('Grail War (/grailwar)').setEmoji('🏆').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('admin_link_duel_main').setLabel('Duel Arena (/duel)').setEmoji('⚔️').setStyle(ButtonStyle.Secondary)
  );

  const components: any[] = [categoryNavRow, actionButtonsRow, crossHubShortcutsRow];
  return { embeds, components };
}

// ==========================================
// 5. INTERACTION COLLECTOR
// ==========================================
export function attachAdminCollector(
  message: any,
  userId: string,
  initialCategory: 'npanim' | 'npsettings' | 'listnp' | 'economy' = 'npanim'
) {
  let currentCategory = initialCategory;

  const collector = message.createMessageComponentCollector({
    idle: 120000,
    time: 600000
  });

  collector.on('collect', async (i: any) => {
    if (i.replied || i.deferred) return;
    if (i.user.id !== userId) {
      await i.reply({ content: 'Only the administrator who opened this panel can interact with it.', ephemeral: true });
      return;
    }
    collector.resetTimer();

    try {
      let actionOutcome: string | undefined = undefined;

      // TAB NAVIGATION
      if (i.customId === 'admin_tab_npanim') {
        currentCategory = 'npanim';
      } else if (i.customId === 'admin_tab_npsettings') {
        currentCategory = 'npsettings';
      } else if (i.customId === 'admin_tab_listnp') {
        currentCategory = 'listnp';
      } else if (i.customId === 'admin_tab_economy') {
        currentCategory = 'economy';
      }
      // SETTINGS ACTIONS
      else if (i.customId === 'admin_toggle_autodelete') {
        const settings = getDuelNpSettings();
        const updated = setDuelNpSettings({ autoDelete: !settings.autoDelete });
        actionOutcome = `Auto-Delete updated to: **${updated.autoDelete ? 'Enabled' : 'Disabled'}**`;
      } else if (i.customId.startsWith('admin_set_afk_')) {
        const val = parseInt(i.customId.replace('admin_set_afk_', ''), 10);
        const updated = setDuelNpSettings({ afkTimeoutSeconds: val });
        actionOutcome = `AFK Safety Timeout updated to: **${updated.afkTimeoutSeconds}s**`;
      }
      // ECONOMY MINT ACTIONS
      else if (i.customId === 'admin_mint_30sq') {
        const master = await getOrCreateMaster(i.user.id, i.user.username);
        master.saintQuartz = (master.saintQuartz || 0) + 30;
        await saveMaster(master);
        actionOutcome = `✨ Minted **+30 Saint Quartz**! Total SQ: **${master.saintQuartz}**`;
      } else if (i.customId === 'admin_mint_100sq') {
        const master = await getOrCreateMaster(i.user.id, i.user.username);
        master.saintQuartz = (master.saintQuartz || 0) + 100;
        await saveMaster(master);
        actionOutcome = `✨ Minted **+100 Saint Quartz**! Total SQ: **${master.saintQuartz}**`;
      } else if (i.customId === 'admin_mint_qp') {
        const master = await getOrCreateMaster(i.user.id, i.user.username);
        master.qp = (master.qp || 0) + 1000000;
        await saveMaster(master);
        actionOutcome = `🪙 Minted **+1,000,000 QP**! Total QP: **${master.qp.toLocaleString()}**`;
      } else if (i.customId === 'admin_refill_seals') {
        const master = await getOrCreateMaster(i.user.id, i.user.username);
        master.commandSeals = 3;
        await saveMaster(master);
        actionOutcome = `🔱 Refilled Command Seals to **3/3**!`;
      }
      // CROSS-HUB SHORTCUTS
      else if (i.customId === 'admin_link_inventory') {
        await i.reply({ content: 'Use `/inventory` to open Master Inventory!', ephemeral: true });
        return;
      } else if (i.customId === 'admin_link_gacha') {
        await i.reply({ content: 'Use `/gacha` to open Summoning Sanctum!', ephemeral: true });
        return;
      } else if (i.customId === 'admin_link_servant') {
        await i.reply({ content: 'Use `/servant` to open Servant Workshop!', ephemeral: true });
        return;
      } else if (i.customId === 'admin_link_grailwar') {
        await i.reply({ content: 'Use `/grailwar` to open Holy Grail War operations!', ephemeral: true });
        return;
      } else if (i.customId.startsWith('admin_link_duel')) {
        await i.reply({ content: 'Use `/duel` to enter the combat arena!', ephemeral: true });
        return;
      }

      const hub = buildAdminHub(currentCategory, actionOutcome);
      await i.update({
        embeds: hub.embeds,
        components: hub.components
      });

    } catch (err: any) {
      if (err.code === 10062 || err.message?.includes('Unknown interaction')) return;
      console.error('Error in admin collector:', err);
    }
  });
}
