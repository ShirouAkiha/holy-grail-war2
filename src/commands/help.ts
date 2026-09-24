import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ButtonInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  MessageFlags 
} from 'discord.js';

// ==========================================
// HELP CATEGORIES & PAGES DATA
// ==========================================
export interface HelpCategory {
  id: string;
  name: string;
  emoji: string;
  shortDesc: string;
  color: number;
  commands: {
    command: string;
    description: string;
    usage?: string;
    tips?: string;
  }[];
}

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: 'quickstart',
    name: 'Quick-Start & Essentials',
    emoji: '🌟',
    shortDesc: 'Getting started, daily rewards, inventory & Master status',
    color: 0xd4af37, // Fate gold
    commands: [
      {
        command: '/daily',
        description: 'Claim your daily allowance of +30 Saint Quartz (SQ)',
        usage: '/daily',
        tips: 'Resets universally every day at 00:00 UTC. Enough for a 10x roll!'
      },
      {
        command: '/profile',
        description: 'View your Master profile, active Servant, and Command Seals (3/3)',
        usage: '/profile [user:@optional]',
        tips: 'Command Seals automatically regenerate and can be used for combat recovery or emergency evacuations.'
      },
      {
        command: '/inventory',
        description: 'Open your Master vault to view owned Craft Essences, items, and tickets',
        usage: '/inventory',
        tips: 'Interactive menu lets you inspect, filter, and equip directly.'
      },
      {
        command: '/help',
        description: 'Display this interactive Master Codex directory of all bot commands',
        usage: '/help [category:optional]',
        tips: 'Use the buttons below to browse different categories.'
      }
    ]
  },
  {
    id: 'gacha',
    name: 'Summoning & Economy',
    emoji: '🎲',
    shortDesc: 'Summon Heroic Spirits and tactical Craft Essences',
    color: 0x38bdf8, // Cyan leyline
    commands: [
      {
        command: '/summon',
        description: 'Conduct the Holy Grail summoning ritual to manifest Heroic Spirits',
        usage: '/summon [mode: single | multi]',
        tips: 'Manifests 3★, 4★, and 5★ SSR Servants with full Noble Phantasm chant cards!'
      },
      {
        command: '/gacha',
        description: 'Access the Chaldea Summoning Gate (Servants & Craft Essences)',
        usage: '/gacha',
        tips: 'Select between Heroic Spirit banners and Craft Essence focus banners.'
      },
      {
        command: '/cegacha',
        description: 'Roll on the Craft Essence Relic Banner for tactical stat cards',
        usage: '/cegacha [amount: 1 | 10]',
        tips: 'Craft Essences grant massive ATK/HP stats and combat passive skills.'
      },
      {
        command: '/ce',
        description: 'Browse the Craft Essence Archive and inspect special Bond 10 CEs',
        usage: '/ce [name:optional]',
        tips: 'Search any CE to preview artwork, level caps, and passives.'
      }
    ]
  },
  {
    id: 'servants',
    name: 'Servants & Customization',
    emoji: '⚔️',
    shortDesc: 'Manage your roster, allocate stats, equip CEs & customize',
    color: 0xa855f7, // Royal Purple
    commands: [
      {
        command: '/servants',
        description: 'Display your contracted Servants list with interactive inspect buttons',
        usage: '/servants',
        tips: 'Browse through your Servant roster with full stats and ascension info.'
      },
      {
        command: '/servant',
        description: 'Inspect full Saint Graph parameters, Noble Phantasm, and lore',
        usage: '/servant <name>',
        tips: 'Displays animated NP cards, parameters (STR, END, AGL, MGI, LCK, NP), and battle traits.'
      },
      {
        command: '/switch',
        description: 'Swap your primary battle partner and showcase Servant',
        usage: '/switch <servant_name>',
        tips: 'Your active partner represents you in duels, ambush defenses, and profile showcases.'
      },
      {
        command: '/equip',
        description: 'Attach a tactical Craft Essence to your active Servant',
        usage: '/equip <ce_name>',
        tips: 'Combines the CE bonus stats directly onto your Servant’s base parameters.'
      },
      {
        command: '/customise',
        description: 'Distribute stat points into ATK, HP, NP Gain, and Crit Rate',
        usage: '/customise',
        tips: 'Opens an interactive workshop UI to customize your Servant’s build.'
      },
      {
        command: '/feed',
        description: 'Fuse duplicate or spare Craft Essences to level up your equipped CE',
        usage: '/feed',
        tips: 'Higher CE levels grant higher stat multipliers and unlock Max Limit Break (MLB).'
      }
    ]
  },
  {
    id: 'combat',
    name: 'Combat & Dueling',
    emoji: '🥊',
    shortDesc: 'PVP turn-based duels, command card chains & healing',
    color: 0xef4444, // Crimson Red
    commands: [
      {
        command: '/duel',
        description: 'Challenge a fellow Master to an authentic turn-based battle',
        usage: '/duel @user',
        tips: 'Choose Buster (Heavy DMG), Arts (NP Charge), or Quick (Crit Stars) cards!'
      },
      {
        command: '/heal',
        description: 'Expend Command Seals or Church holy water to restore Servant HP',
        usage: '/heal',
        tips: 'Command Seals restore 100% HP instantly when your Servant is wounded.'
      },
      {
        command: '/boast',
        description: 'Proclaim your combat achievements on the Holy Church notice board',
        usage: '/boast',
        tips: 'Boosts your Master reputation in the Fuyuki City rankings.'
      }
    ]
  },
  {
    id: 'grailwar',
    name: 'Grail War & Espionage',
    emoji: '🗺️',
    shortDesc: '7-Master battle royale, patrols, familiars, wards & traps',
    color: 0x10b981, // Emerald Green
    commands: [
      {
        command: '/grailwar',
        description: 'Enter the 7-Master Holy Grail War command center',
        usage: '/grailwar status',
        tips: 'View the 7 Master candidates, leaked intelligence, and the current war cycle.'
      },
      {
        command: '/patrol',
        description: 'Stealth patrol Fuyuki sectors to gather intel and spot enemy traps',
        usage: '/patrol',
        tips: 'Scouting can uncover Saint Quartz, ambush enemy scouts, or detect hidden Bounded Fields.'
      },
      {
        command: '/familiar',
        description: 'Deploy scout familiars to surveil suspected rival Masters',
        usage: '/familiar [action: deploy | recall]',
        tips: 'Familiars can identify enemy Servant True Names and secret workshops.'
      },
      {
        command: '/ambush',
        description: 'Launch a surprise assault against a suspected Master',
        usage: '/ambush @user (or /attack <target>)',
        tips: 'Warning: Attacking a civilian carries heavy penalties and reveals your identity!'
      },
      {
        command: '/trap',
        description: 'Conceal Bounded Field traps or alarm wards in channels',
        usage: '/trap [type: alarm | drain | blast]',
        tips: 'Triggers when rival Masters or their familiars speak in that channel.'
      },
      {
        command: '/defenses',
        description: 'Configure your Mage Workshop defenses and emergency auto-evacuation',
        usage: '/defenses',
        tips: 'Toggle Command Seal Auto-Evac to avoid fatal blows with 1 HP remaining.'
      },
      {
        command: '/leak',
        description: 'Drop anonymous intelligence into the surveillance network',
        usage: '/leak <intel_text>',
        tips: 'Manipulate rival factions or expose another Master’s Servant class.'
      },
      {
        command: '/church',
        description: 'Seek sanctuary at the Holy Church under the Overseer’s protection',
        usage: '/church (or /sanctuary)',
        tips: 'The Church is a neutral haven: you cannot be attacked while in sanctuary.'
      }
    ]
  },
  {
    id: 'bond',
    name: 'Bond, Dialogue & Interludes',
    emoji: '💖',
    shortDesc: 'Interact with your Servant, build bond & unlock visual novel stories',
    color: 0xec4899, // Rose pink
    commands: [
      {
        command: '/talk',
        description: 'Speak telepathically with your active Servant to increase your Bond',
        usage: '/talk [message:optional]',
        tips: 'Your Servant replies in full character personality with custom dynamic dialogue!'
      },
      {
        command: '/bond',
        description: 'View your Bond Level progress, unlocked lore, and Bond 10 CE rewards',
        usage: '/bond [servant:optional]',
        tips: 'Reaching Bond 10 unlocks an exclusive, powerful Bond Craft Essence.'
      },
      {
        command: '/dialogue',
        description: 'Trigger special Visual Novel interlude scenes and rival face-offs',
        usage: '/dialogue [type: interlude | faceoff]',
        tips: 'Unlocks rich story vignettes between your Servant and other legendary heroes.'
      }
    ]
  },
  {
    id: 'admin',
    name: 'Workshop & Admin Tools',
    emoji: '⚙️',
    shortDesc: 'Custom Servant creator, NP animations & configuration',
    color: 0x64748b, // Slate
    commands: [
      {
        command: '/addservant',
        description: 'Register a custom original Heroic Spirit or edit existing stats',
        usage: '/addservant create | /addservant edit <name>',
        tips: 'Customize parameters, card art URLs, Noble Phantasm chants, and quotes.'
      },
      {
        command: '/admin',
        description: 'Server admin controls for Noble Phantasm animations and war timers',
        usage: '/admin npsettings',
        tips: 'Configure whether high-resolution NP battle GIFs auto-delete after combat.'
      },
      {
        command: '/apikey',
        description: 'Configure custom Gemini API key for unlimited AI Servant dialogue',
        usage: '/apikey set <your_key>',
        tips: 'Stored securely per-user for enhanced Servant conversational memory.'
      }
    ]
  }
];

// ==========================================
// BUILD EMBED
// ==========================================
export function buildHelpEmbed(categoryIndexOrId: number | string = 0): EmbedBuilder {
  let catIndex = 0;
  if (typeof categoryIndexOrId === 'number') {
    catIndex = Math.max(0, Math.min(HELP_CATEGORIES.length - 1, categoryIndexOrId));
  } else {
    const foundIdx = HELP_CATEGORIES.findIndex(
      c => c.id.toLowerCase() === categoryIndexOrId.toLowerCase()
    );
    if (foundIdx !== -1) catIndex = foundIdx;
  }

  const category = HELP_CATEGORIES[catIndex];
  const totalPages = HELP_CATEGORIES.length;

  const embed = new EmbedBuilder()
    .setTitle(`${category.emoji} FATE: PLEXVERSE RPG — COMMAND CODEX`)
    .setDescription(
      `**Category: ${category.name}**\n` +
      `*${category.shortDesc}*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    )
    .setColor(category.color)
    .setFooter({
      text: `Page ${catIndex + 1} of ${totalPages} • Use buttons below to switch categories or navigate`
    })
    .setTimestamp();

  // Add commands as fields
  for (const cmd of category.commands) {
    let fieldVal = `**Description:** ${cmd.description}\n` +
      `**Usage:** \`${cmd.usage || cmd.command}\``;
    if (cmd.tips) {
      fieldVal += `\n💡 *Tip: ${cmd.tips}*`;
    }
    embed.addFields({
      name: `${cmd.command}`,
      value: fieldVal,
      inline: false
    });
  }

  return embed;
}

// ==========================================
// BUILD INTERACTIVE BUTTONS & SELECT MENU
// ==========================================
export function buildHelpButtons(currentPage: number): ActionRowBuilder<any>[] {
  const totalPages = HELP_CATEGORIES.length;
  const isFirst = currentPage <= 0;
  const isLast = currentPage >= totalPages - 1;

  // Row 1: Interactive Category Select Menu
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('help_select_category')
    .setPlaceholder('📖 Jump to Command Category...')
    .addOptions(
      HELP_CATEGORIES.map((cat, idx) => ({
        label: cat.name,
        description: cat.shortDesc.slice(0, 100),
        value: `help_cat_${idx}`,
        emoji: cat.emoji,
        default: idx === currentPage
      }))
    );

  const menuRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  // Row 2: Navigation & Quick-Jump Buttons (Guaranteed 100% unique custom_ids)
  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`help_btn_prev_${Math.max(0, currentPage - 1)}`)
      .setLabel('◀ Previous')
      .setEmoji('⬅️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isFirst),
    new ButtonBuilder()
      .setCustomId('help_btn_quickstart')
      .setLabel('🌟 Quickstart')
      .setStyle(currentPage === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(currentPage === 0),
    new ButtonBuilder()
      .setCustomId(`help_btn_next_${Math.min(totalPages - 1, currentPage + 1)}`)
      .setLabel('Next ▶')
      .setEmoji('➡️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isLast)
  );

  return [menuRow, navRow];
}

// ==========================================
// SLASH COMMAND DEFINITION
// ==========================================
export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Display the Master Command Codex and directory of all Fate RPG commands')
  .addStringOption(option =>
    option
      .setName('category')
      .setDescription('Jump directly to a specific command category')
      .setRequired(false)
      .addChoices(
        { name: '🌟 Quick-Start & Essentials', value: 'quickstart' },
        { name: '🎲 Summoning & Economy', value: 'gacha' },
        { name: '⚔️ Servants & Customization', value: 'servants' },
        { name: '🥊 Combat & Dueling', value: 'combat' },
        { name: '🗺️ Grail War & Espionage', value: 'grailwar' },
        { name: '💖 Bond, Dialogue & Interludes', value: 'bond' },
        { name: '⚙️ Workshop & Admin', value: 'admin' }
      )
  );

// ==========================================
// COMMAND EXECUTION
// ==========================================
export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const selectedCategory = interaction.options.getString('category');
    let pageIndex = 0;

    if (selectedCategory) {
      const idx = HELP_CATEGORIES.findIndex(c => c.id === selectedCategory);
      if (idx !== -1) pageIndex = idx;
    }

    const embed = buildHelpEmbed(pageIndex);
    const components = buildHelpButtons(pageIndex);

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        embeds: [embed],
        components
      });
    } else {
      await interaction.reply({
        embeds: [embed],
        components
      });
    }
  } catch (err: any) {
    if (err?.code === 10062 || err?.code === 40060 || err?.code === 50027 || err?.code === 10008) return;
    console.error('Error executing /help command:', err);
    try {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Command Error')
        .setDescription('Failed to load command catalog. Please try `/help` again.')
        .setColor(0xef4444);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ flags: MessageFlags.Ephemeral, embeds: [errorEmbed] });
      }
    } catch {}
  }
}

// ==========================================
// INTERACTION HANDLER (Buttons & Select Menu)
// ==========================================
export async function handleHelpInteraction(interaction: ButtonInteraction | StringSelectMenuInteraction | any) {
  try {
    const customId = interaction.customId;
    let targetPage = 0;

    if (interaction.isStringSelectMenu() && customId === 'help_select_category') {
      const selectedVal = interaction.values?.[0] || '';
      if (selectedVal.startsWith('help_cat_')) {
        targetPage = parseInt(selectedVal.replace('help_cat_', ''), 10);
      }
    } else if (customId === 'help_btn_quickstart' || customId === 'help_page_0') {
      targetPage = 0;
    } else if (customId.startsWith('help_btn_prev_')) {
      targetPage = parseInt(customId.replace('help_btn_prev_', ''), 10);
    } else if (customId.startsWith('help_btn_next_')) {
      targetPage = parseInt(customId.replace('help_btn_next_', ''), 10);
    } else if (customId.startsWith('help_page_')) {
      targetPage = parseInt(customId.replace('help_page_', ''), 10);
    } else if (customId.startsWith('help_cat_')) {
      targetPage = parseInt(customId.replace('help_cat_', ''), 10);
    }

    const validPage = isNaN(targetPage) ? 0 : Math.max(0, Math.min(HELP_CATEGORIES.length - 1, targetPage));

    const embed = buildHelpEmbed(validPage);
    const components = buildHelpButtons(validPage);

    await interaction.update({
      embeds: [embed],
      components
    });
    return true;
  } catch (err: any) {
    if (err?.code === 10062 || err?.code === 40060 || err?.code === 50027 || err?.code === 10008) return false;
    console.error('Error handling help interaction:', err);
    return false;
  }
}

// Backward compatibility alias
export const handleHelpButton = handleHelpInteraction;
