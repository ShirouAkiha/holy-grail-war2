/**
 * Slash Command: /help (and /commands)
 * Description: Master Command Codex & Interactive Directory
 * Library: discord.js v14
 */

export const helpCommandCode = `import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ButtonInteraction 
} from 'discord.js';

export const HELP_CATEGORIES = [
  {
    id: 'quickstart',
    name: 'Quick-Start & Essentials',
    emoji: '🌟',
    shortDesc: 'Getting started, daily rewards, inventory & Master status',
    color: 0xd4af37,
    commands: [
      { command: '/daily', description: 'Claim your daily allowance of +30 Saint Quartz (SQ)', usage: '/daily' },
      { command: '/profile', description: 'View your Master profile, active Servant, and Command Seals', usage: '/profile [@user]' },
      { command: '/inventory', description: 'Open your Master vault to view owned CEs, items, and tickets', usage: '/inventory' },
      { command: '/help', description: 'Display this interactive Master Codex directory of commands', usage: '/help [category]' }
    ]
  },
  {
    id: 'gacha',
    name: 'Summoning & Economy',
    emoji: '🎲',
    shortDesc: 'Summon Heroic Spirits and tactical Craft Essences',
    color: 0x38bdf8,
    commands: [
      { command: '/summon', description: 'Conduct the Holy Grail summoning ritual to manifest Heroic Spirits', usage: '/summon' },
      { command: '/gacha', description: 'Access the Chaldea Summoning Gate (Servants & CEs)', usage: '/gacha' },
      { command: '/cegacha', description: 'Roll on the Craft Essence Relic Banner for tactical stat cards', usage: '/cegacha [amount]' },
      { command: '/ce', description: 'Browse the Craft Essence Archive and inspect special Bond 10 CEs', usage: '/ce [name]' }
    ]
  },
  {
    id: 'servants',
    name: 'Servants & Customization',
    emoji: '⚔️',
    shortDesc: 'Manage your roster, allocate stats, equip CEs & customize',
    color: 0xa855f7,
    commands: [
      { command: '/servants', description: 'Display your contracted Servants list with interactive inspect buttons', usage: '/servants' },
      { command: '/servant', description: 'Inspect full Saint Graph parameters, Noble Phantasm, and lore', usage: '/servant <name>' },
      { command: '/switch', description: 'Swap your primary battle partner and showcase Servant', usage: '/switch <name>' },
      { command: '/equip', description: 'Attach a tactical Craft Essence to your active Servant', usage: '/equip <ce_name>' },
      { command: '/customise', description: 'Distribute stat points into ATK, HP, NP Gain, and Crit Rate', usage: '/customise' },
      { command: '/feed', description: 'Fuse duplicate or spare Craft Essences to level up your equipped CE', usage: '/feed' }
    ]
  },
  {
    id: 'combat',
    name: 'Combat & Dueling',
    emoji: '🥊',
    shortDesc: 'PVP turn-based duels, command card chains & healing',
    color: 0xef4444,
    commands: [
      { command: '/duel', description: 'Challenge a fellow Master to an authentic turn-based battle', usage: '/duel @user' },
      { command: '/heal', description: 'Expend Command Seals or Church holy water to restore Servant HP', usage: '/heal' },
      { command: '/boast', description: 'Proclaim your combat achievements on the Holy Church notice board', usage: '/boast' }
    ]
  },
  {
    id: 'grailwar',
    name: 'Grail War & Espionage',
    emoji: '🗺️',
    shortDesc: '7-Master battle royale, patrols, familiars, wards & traps',
    color: 0x10b981,
    commands: [
      { command: '/grailwar', description: 'Enter the 7-Master Holy Grail War command center', usage: '/grailwar status' },
      { command: '/patrol', description: 'Stealth patrol Fuyuki sectors to gather intel and spot enemy traps', usage: '/patrol' },
      { command: '/familiar', description: 'Deploy scout familiars to surveil suspected rival Masters', usage: '/familiar [deploy|recall]' },
      { command: '/ambush', description: 'Launch a surprise assault against a suspected Master', usage: '/ambush @user' },
      { command: '/trap', description: 'Conceal Bounded Field traps or alarm wards in channels', usage: '/trap [type]' },
      { command: '/defenses', description: 'Configure your Mage Workshop defenses and emergency auto-evacuation', usage: '/defenses' },
      { command: '/leak', description: 'Drop anonymous intelligence into the surveillance network', usage: '/leak <intel>' },
      { command: '/church', description: 'Seek sanctuary at the Holy Church under the Overseer’s protection', usage: '/church' }
    ]
  },
  {
    id: 'bond',
    name: 'Bond, Dialogue & Interludes',
    emoji: '💖',
    shortDesc: 'Interact with your Servant, build bond & unlock visual novel stories',
    color: 0xec4899,
    commands: [
      { command: '/talk', description: 'Speak telepathically with your active Servant to increase your Bond', usage: '/talk [message]' },
      { command: '/bond', description: 'View your Bond Level progress, unlocked lore, and Bond 10 CE rewards', usage: '/bond' },
      { command: '/dialogue', description: 'Trigger special Visual Novel interlude scenes and rival face-offs', usage: '/dialogue' }
    ]
  },
  {
    id: 'admin',
    name: 'Workshop & Admin Tools',
    emoji: '⚙️',
    shortDesc: 'Custom Servant creator, NP animations & configuration',
    color: 0x64748b,
    commands: [
      { command: '/addservant', description: 'Register a custom original Heroic Spirit or edit existing stats', usage: '/addservant create' },
      { command: '/admin', description: 'Server admin controls for Noble Phantasm animations and war timers', usage: '/admin npsettings' },
      { command: '/apikey', description: 'Configure custom Gemini API key for unlimited AI Servant dialogue', usage: '/apikey set <key>' }
    ]
  }
];

export function buildHelpEmbed(categoryIndex = 0) {
  const cat = HELP_CATEGORIES[categoryIndex] || HELP_CATEGORIES[0];
  const embed = new EmbedBuilder()
    .setTitle(\`\${cat.emoji} FATE: PLEXVERSE RPG — COMMAND CODEX\`)
    .setDescription(\`**Category: \${cat.name}**\\n*\${cat.shortDesc}*\\n\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\`)
    .setColor(cat.color)
    .setFooter({ text: \`Page \${categoryIndex + 1} of \${HELP_CATEGORIES.length} • Use buttons below to navigate\` })
    .setTimestamp();

  for (const cmd of cat.commands) {
    embed.addFields({
      name: cmd.command,
      value: \`**Description:** \${cmd.description}\\n**Usage:** \\\`\${cmd.usage}\\\`\`
    });
  }
  return embed;
}

export function buildHelpButtons(currentPage = 0) {
  const isFirst = currentPage <= 0;
  const isLast = currentPage >= HELP_CATEGORIES.length - 1;

  const menuRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('help_select_category')
      .setPlaceholder('📖 Jump to Command Category...')
      .addOptions(
        HELP_CATEGORIES.map((cat, idx) => ({
          label: cat.name,
          description: cat.shortDesc.slice(0, 100),
          value: \`help_cat_\${idx}\`,
          emoji: cat.emoji,
          default: idx === currentPage
        }))
      )
  );

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(\`help_btn_prev_\${Math.max(0, currentPage - 1)}\`).setLabel('◀ Prev').setStyle(ButtonStyle.Secondary).setDisabled(isFirst),
    new ButtonBuilder().setCustomId('help_btn_quickstart').setLabel('🌟 Quickstart').setStyle(currentPage === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(currentPage === 0),
    new ButtonBuilder().setCustomId(\`help_btn_next_\${Math.min(HELP_CATEGORIES.length - 1, currentPage + 1)}\`).setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(isLast)
  );

  return [menuRow, navRow];
}

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Display the Master Command Codex and directory of all Fate RPG commands')
  .addStringOption(opt =>
    opt.setName('category')
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

export async function execute(interaction: ChatInputCommandInteraction) {
  const opt = interaction.options.getString('category');
  let page = 0;
  if (opt) {
    const idx = HELP_CATEGORIES.findIndex(c => c.id === opt);
    if (idx !== -1) page = idx;
  }
  const embed = buildHelpEmbed(page);
  const rows = buildHelpButtons(page);
  await interaction.reply({ embeds: [embed], components: rows });
}
`;
