import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  AutocompleteInteraction,
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  AttachmentBuilder,
  ComponentType,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js';
import { getAllThroneServants, findServantInPool, matchServantSearch } from '../database/service';
import { getDefaultClassPassives } from '../data/servants';
import { ServantTemplate, MasterServantInstance, ServantClass } from '../types';
import { renderServantProfileCard } from '../canvas/renderer';
import { getNoblePhantasmGif, getNoblePhantasmChant } from '../data/noblePhantasmGifs';

export const CLASS_CYCLE: Array<'all' | ServantClass> = [
  'all', 'Saber', 'Archer', 'Lancer', 'Rider', 'Caster', 'Assassin', 'Berserker', 'Ruler', 'Avenger'
];

export function getClassEmoji(servantClass: string): string {
  switch (servantClass?.toLowerCase()) {
    case 'saber': return '⚔️';
    case 'archer': return '🏹';
    case 'lancer': return '🔱';
    case 'rider': return '🐎';
    case 'caster': return '🪄';
    case 'assassin': return '🗡️';
    case 'berserker': return '🩸';
    case 'ruler': return '⚖️';
    case 'avenger': return '🌑';
    case 'foreigner': return '🌌';
    case 'pretender': return '🎭';
    default: return '⚔️';
  }
}

export const data = new SlashCommandBuilder()
  .setName('servants')
  .setDescription('Browse, search, and inspect all canon and custom Heroic Spirits')
  .addSubcommand(sub =>
    sub
      .setName('list')
      .setDescription('Display the full registry of available Servants in the Throne of Heroes')
      .addStringOption(opt =>
        opt
          .setName('filter')
          .setDescription('Filter by category')
          .addChoices(
            { name: 'All Servants', value: 'all' },
            { name: 'Canon Servants Only', value: 'canon' },
            { name: 'Custom Servants Only', value: 'custom' }
          )
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('search')
      .setDescription('Search Heroic Spirits by name, class, noble phantasm, or lore')
      .addStringOption(opt =>
        opt
          .setName('query')
          .setDescription('Search keyword (e.g. Artoria, Saber, Excalibur, Gilgamesh)')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('view')
      .setDescription('View the complete public profile card of a specific Servant')
      .addStringOption(opt =>
        opt
          .setName('name')
          .setDescription('Exact or partial name of the Servant (e.g. Saber Alter, Artoria, Scáthach)')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('np')
      .setDescription('Preview the animated Noble Phantasm cinematic GIF and chant for any Servant')
      .addStringOption(opt =>
        opt
          .setName('name')
          .setDescription('Servant name to view Noble Phantasm (e.g. Scáthach, Gilgamesh, Saber Alter)')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('artwork')
      .setDescription('View the full-resolution card artwork for any Servant')
      .addStringOption(opt =>
        opt
          .setName('name')
          .setDescription('Servant name to view Artwork (e.g. Scáthach, Artoria, Jeanne)')
          .setRequired(true)
          .setAutocomplete(true)
      )
  );

export async function autocomplete(interaction: AutocompleteInteraction) {
  try {
    const focusedOption = interaction.options.getFocused(true);
    const query = focusedOption.value.toLowerCase().trim();
    const allServants = getAllThroneServants();

    const matches = allServants
      .filter(s => matchServantSearch(s, query))
      .slice(0, 25);

    await interaction.respond(
      matches.map(s => ({
        name: `${s.name} (${s.servantClass} ★${s.rarity}) ${s.isCustomOrMeme ? '[Custom]' : ''}`.slice(0, 100),
        value: s.name
      }))
    );
  } catch (err: any) {
    if (err.code === 10062 || err.code === 40060 || err.message?.includes('Unknown interaction')) {
      return; // Token expired on quick keystrokes; normal Discord autocomplete behavior
    }
    console.warn('Servants autocomplete warning:', err?.message || err);
  }
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const allServants: ServantTemplate[] = getAllThroneServants();
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'np') {
      const query = interaction.options.getString('name', true).trim();
      const match = findServantInPool(query, allServants);

      if (!match) {
        await interaction.reply({
          ephemeral: true,
          content: `❌ No Heroic Spirit found matching "${query}". Use \`/servants list\` to browse all available spirits.`
        });
        return;
      }

      const npEmbed = buildNoblePhantasmEmbed(match);
      const actionRow = buildNoblePhantasmActions(match.id);
      await interaction.reply({ embeds: [npEmbed], components: [actionRow] });
      return;
    }

    if (subcommand === 'artwork') {
      const query = interaction.options.getString('name', true).trim();
      const match = findServantInPool(query, allServants);

      if (!match) {
        await interaction.reply({
          ephemeral: true,
          content: `❌ No Heroic Spirit found matching "${query}". Use \`/servants list\` to browse all available spirits.`
        });
        return;
      }

      const artworkEmbed = buildServantArtworkEmbed(match);
      const actionRow = buildNoblePhantasmActions(match.id);
      await interaction.reply({ embeds: [artworkEmbed], components: [actionRow] });
      return;
    }

    if (subcommand === 'view') {
      // Defer reply immediately so Discord knows the bot is actively generating the card
      await interaction.deferReply();
      const query = interaction.options.getString('name', true).trim();
      const match = findServantInPool(query, allServants);

      if (!match) {
        const suggestions = allServants
          .filter(s => matchServantSearch(s, query))
          .slice(0, 5)
          .map(s => `• **${s.name}** (\`${s.servantClass}\`)`)
          .join('\n');

        await interaction.editReply({
          content: `❌ No Heroic Spirit found matching "${query}".\n\n${suggestions ? `**Suggestions:**\n${suggestions}\n\n` : ''}Use \`/servants list\` to see all available spirits.`
        });
        return;
      }

      const profileEmbed = buildServantFullProfileEmbed(match);
      const artworkEmbed = buildServantArtworkEmbed(match);
      const actionRow = buildProfileActions(match.id);
      
      const files: AttachmentBuilder[] = [];
      try {
        const tempInstance = createServantTempInstance(match);
        const cardBuffer = await renderServantProfileCard(tempInstance, 'Throne of Heroes');
        if (cardBuffer && cardBuffer.length > 500) {
          files.push(new AttachmentBuilder(cardBuffer, { name: 'servant_profile.png' }));
        }
      } catch (e) {
        console.warn('Canvas render error in /servants view:', e);
      }

      await interaction.editReply({ 
        embeds: [profileEmbed, artworkEmbed], 
        files,
        components: [actionRow] 
      });
      return;
    }

    if (subcommand === 'search') {
      const query = interaction.options.getString('query', true).trim();
      const { embed, components } = buildServantsListUI(allServants, 1, 'all', 'all', query);

      const response = await interaction.reply({
        embeds: [embed],
        components,
        withResponse: true
      }).then(r => r.resource?.message || interaction.fetchReply());

      setupServantListCollector(response, allServants, 1, 'all', 'all', query);
      return;
    }

    // Default: list all
    const filter = interaction.options.getString('filter') || 'all';
    const { embed, components } = buildServantsListUI(allServants, 1, filter, 'all');

    const response = await interaction.reply({
      embeds: [embed],
      components,
      withResponse: true
    }).then(r => r.resource?.message || interaction.fetchReply());

    setupServantListCollector(response, allServants, 1, filter, 'all');

  } catch (error: any) {
    if (error.code === 10062 || error.code === 40060) return;
    console.error('Error executing /servants:', error);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: `❌ Error querying Throne of Heroes: ${error.message}`,
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: `❌ Error querying Throne of Heroes: ${error.message}`,
          ephemeral: true
        });
      }
    } catch {}
  }
}

// Build Servant Full Profile Embed
export function buildServantFullProfileEmbed(servant: ServantTemplate) {
  const stars = '⭐'.repeat(servant.rarity || 5);
  const deck = (servant.commandDeck || ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'])
    .map(c => (c === 'Buster' ? '🔴 Buster' : c === 'Arts' ? '🔵 Arts' : '🟢 Quick'))
    .join(' • ');

  const np = servant.noblePhantasm;
  const cardColor = servant.servantClass === 'Saber' ? 0x3b82f6 : servant.rarity === 5 ? 0xd4af37 : 0x9333ea;

  const activeSkillsText = servant.skills && servant.skills.length > 0
    ? servant.skills.map((s, idx) => `• **Skill ${idx + 1}: ${s.name}** [CD: ${s.cooldown}T] — ${s.description}`).join('\n')
    : 'None';

  const rawPassives = (servant.passives && servant.passives.length > 0)
    ? servant.passives.slice(0, 2)
    : getDefaultClassPassives(servant.servantClass).slice(0, 2);

  const passiveSkillsText = rawPassives && rawPassives.length > 0
    ? rawPassives.map((p, idx) => {
        if (idx === 0) {
          return `• **Passive 1: ${p.name}** [${p.rank || 'Passive'}] *(Unlocked at Bond 1)* — ${p.description}`;
        } else {
          return `• **Passive 2: ${p.name}** [${p.rank || 'Passive'}] *(Unlocks at Bond 5)* — ${p.description}`;
        }
      }).join('\n')
    : 'None';

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ ${servant.name} — ${servant.title}`)
    .setDescription(
      `${stars} | Class: **${servant.servantClass}** | Origin: **${servant.isCustomOrMeme ? '🛠️ Custom Administrator Creation' : '🏛️ Canon Heroic Spirit'}**\n\n` +
      `📜 **Historical Legend & Lore:**\n> ${servant.lore || 'A legendary soul recorded in the Throne of Heroes.'}\n\n` +
      `📊 **Base Parameters:**\n` +
      `• **STR:** ${servant.baseStats.strength} | **END:** ${servant.baseStats.endurance} | **AGI:** ${servant.baseStats.agility}\n` +
      `• **MAN:** ${servant.baseStats.mana} | **LCK:** ${servant.baseStats.luck}\n` +
      `• **Base HP:** \`${servant.baseHp.toLocaleString()}\` | **Base ATK:** \`${servant.baseAtk.toLocaleString()}\`\n\n` +
      `🃏 **Command Deck:** ${deck}\n\n` +
      `⚡ **Active Personal Skills:**\n${activeSkillsText}\n\n` +
      `🛡️ **Class Passive Skills (Max 2 • 2nd Unlocks at Bond Lv. 5):**\n${passiveSkillsText}\n\n` +
      `💥 **Noble Phantasm: ${np.name}** (${np.cardType} • ${np.target.toUpperCase()})\n` +
      `> *"${np.chant || 'True power of the Noble Phantasm release!'}"*\n` +
      `• **Multiplier:** ${np.multiplier}% | **Overcharge:** ${np.overchargeEffect || 'None'}\n` +
      `• ${np.description}\n\n` +
      `💬 **Master Quotes:**\n` +
      `• **Summon:** *"${servant.summonQuote}"*\n` +
      `• **Battle Start:** *"${servant.battleStartQuote}"*\n` +
      `• **Victory:** *"${servant.victoryQuote}"*`
    )
    .setColor(cardColor)
    .setFooter({ text: `Throne ID: ${servant.id} • Holy Grail War Registry` });

  // Add portrait thumbnail to top right corner of embed
  if (servant.avatarUrl) {
    embed.setThumbnail(servant.avatarUrl);
  }

  return embed;
}

export function buildServantArtworkEmbed(servant: ServantTemplate) {
  const embed = new EmbedBuilder()
    .setTitle(`🖼️ ${servant.name} — Character Card Artwork`)
    .setColor(servant.rarity === 5 ? 0xf59e0b : 0x38bdf8);

  const imgUrl = servant.cardArtUrl || servant.avatarUrl;
  if (imgUrl) {
    embed.setImage(imgUrl);
  }
  return embed;
}

export function createServantTempInstance(servant: ServantTemplate): MasterServantInstance {
  return {
    id: `temp_${servant.id}`,
    masterId: 'throne_registry',
    templateId: servant.id,
    level: 50,
    experience: 5000,
    allocatedStats: { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 },
    availableStatPoints: 0,
    skillLevels: [10, 10, 10],
    customQuotes: {
      summon: servant.summonQuote,
      battleStart: servant.battleStartQuote,
      noblePhantasm: servant.noblePhantasm.chant,
      victory: servant.victoryQuote,
      defeat: servant.defeatQuote
    },
    bondLevel: 5,
    template: servant
  };
}

// =========================================================================
// SCALABLE LIST UI: Interactive Select Dropdown + Navigation Controls
// =========================================================================

export function buildServantsListUI(
  allServants: ServantTemplate[],
  page = 1,
  originFilter = 'all',
  classFilter = 'all',
  searchKeyword?: string
) {
  let filtered = allServants;

  if (originFilter === 'canon') {
    filtered = filtered.filter(s => !s.isCustomOrMeme);
  } else if (originFilter === 'custom') {
    filtered = filtered.filter(s => s.isCustomOrMeme);
  }

  if (classFilter !== 'all') {
    filtered = filtered.filter(s => s.servantClass.toLowerCase() === classFilter.toLowerCase());
  }

  if (searchKeyword && searchKeyword.trim()) {
    filtered = filtered.filter(s => matchServantSearch(s, searchKeyword.trim()));
  }

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + pageSize);

  const originLabel = originFilter === 'canon' ? 'Canon' : originFilter === 'custom' ? 'Custom' : 'All Origins';
  const classLabel = classFilter === 'all' ? 'All Classes' : classFilter;
  const searchNotice = searchKeyword ? ` for "${searchKeyword}"` : '';

  let listContent = '';
  if (pageItems.length === 0) {
    listContent = '• *No Heroic Spirits match the selected filters. Use the buttons below to change filters.*';
  } else {
    listContent = pageItems.map((s, idx) => {
      const globalIdx = startIndex + idx + 1;
      const originTag = s.isCustomOrMeme ? '🛠️ [CUSTOM]' : '🏛️ [CANON]';
      const stars = '⭐'.repeat(s.rarity || 5);
      const emoji = getClassEmoji(s.servantClass);
      return `${globalIdx}. ${emoji} **${s.name}** — *${s.title}* [\`${s.servantClass}\` ${stars}] ${originTag}\n   └ *NP:* **${s.noblePhantasm.name}** | HP: \`${s.baseHp.toLocaleString()}\` | ATK: \`${s.baseAtk.toLocaleString()}\``;
    }).join('\n');
  }

  const embed = new EmbedBuilder()
    .setTitle(`📜 Throne of Heroes Registry (${filtered.length} Servants${searchNotice})`)
    .setDescription(
      `Select any Heroic Spirit from the dropdown below to inspect their complete status parameters, radar card, and Noble Phantasm:\n\n` +
      `${listContent}`
    )
    .setColor(0xd4af37)
    .setFooter({
      text: `Page ${currentPage} of ${totalPages} • Filter: [${originLabel} • ${classLabel}] • Use dropdown below to select`
    });

  const components: ActionRowBuilder<any>[] = [];

  // ROW 1: Dropdown Select Menu
  if (pageItems.length > 0) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_servant_registry`)
      .setPlaceholder('🔍 Select a Heroic Spirit to inspect dossier...')
      .addOptions(
        pageItems.map(s =>
          new StringSelectMenuOptionBuilder()
            .setLabel(`${s.name} (${s.servantClass})`.slice(0, 100))
            .setDescription(`★${s.rarity} • ${s.title || s.noblePhantasm.name}`.slice(0, 100))
            .setValue(`servant_view_${s.id}`)
            .setEmoji(getClassEmoji(s.servantClass))
        )
      );
    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
  }

  // ROW 2: Navigation & Filter Bar
  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`servant_list_prev`)
      .setLabel('Prev')
      .setEmoji('◀️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage <= 1),
    new ButtonBuilder()
      .setCustomId(`servant_list_info`)
      .setLabel(`${currentPage}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`servant_list_next`)
      .setLabel('Next')
      .setEmoji('▶️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages),
    new ButtonBuilder()
      .setCustomId(`servant_list_class`)
      .setLabel(classFilter === 'all' ? '🏷️ All Classes' : `🏷️ ${classFilter}`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`servant_list_origin`)
      .setLabel(originFilter === 'canon' ? '🏛️ Canon' : originFilter === 'custom' ? '🛠️ Custom' : '🌐 All')
      .setStyle(ButtonStyle.Primary)
  );

  components.push(navRow);

  return { embed, components, totalPages, currentPage, filteredCount: filtered.length };
}

// Backward compatibility helper
export function buildListEmbed(servants: ServantTemplate[], title: string, description: string) {
  const { embed } = buildServantsListUI(servants, 1, 'all', 'all');
  if (title) embed.setTitle(title);
  return embed;
}

export function buildServantButtons(servants: ServantTemplate[]) {
  const { components } = buildServantsListUI(servants, 1, 'all', 'all');
  return components;
}

export function buildNoblePhantasmEmbed(servant: ServantTemplate) {
  const np = servant.noblePhantasm;
  const gifUrl = getNoblePhantasmGif(servant);
  const chant = getNoblePhantasmChant(servant);
  const stars = '⭐'.repeat(servant.rarity || 5);
  const color = np.cardType === 'Buster' ? 0xef4444 : np.cardType === 'Arts' ? 0x3b82f6 : 0x10b981;

  const embed = new EmbedBuilder()
    .setTitle(`💥 NOBLE PHANTASM: ${np.name}`)
    .setDescription(
      `> *"${chant || np.chant || 'True Name Unleashed!'}"*\n\n` +
      `• **Heroic Spirit:** **${servant.name}** — *${servant.title}* [\`${servant.servantClass}\` ${stars}]\n` +
      `• **Card Type & Target:** **${np.cardType}** • **${np.target.toUpperCase()}**\n` +
      `• **Damage Multiplier:** \`${np.multiplier}%\` | **Overcharge:** ${np.overchargeEffect || 'Standard boost'}\n` +
      `• **True Name Power:** ${np.description}\n\n` +
      `🎬 *Noble Phantasm Animated Cinematic Playback*`
    )
    .setColor(color)
    .setFooter({ text: `Throne ID: ${servant.id} • Holy Grail War Noble Phantasm Archive` });

  if (gifUrl) {
    embed.setImage(gifUrl);
  }
  if (servant.avatarUrl) {
    embed.setThumbnail(servant.avatarUrl);
  }

  return embed;
}

export function buildNoblePhantasmActions(servantId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`view_servant_${servantId}`)
      .setLabel('Inspect Servant Profile')
      .setEmoji('⚔️')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`view_art_${servantId}`)
      .setLabel('View Card Artwork')
      .setEmoji('🖼️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`quote_servant_${servantId}`)
      .setLabel('Hear Voice Lines')
      .setEmoji('💬')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_back_servants_list')
      .setLabel('Back to Servants List')
      .setEmoji('📜')
      .setStyle(ButtonStyle.Secondary)
  );
}

export function buildProfileActions(servantId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`view_np_${servantId}`)
      .setLabel('View Noble Phantasm')
      .setEmoji('🎬')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`view_art_${servantId}`)
      .setLabel('View Full Artwork')
      .setEmoji('🖼️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`quote_servant_${servantId}`)
      .setLabel('Hear Voice Dialogue')
      .setEmoji('💬')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_back_servants_list')
      .setLabel('Back to Servants List')
      .setEmoji('📜')
      .setStyle(ButtonStyle.Secondary)
  );
}

export function setupServantListCollector(
  message: any,
  allServants: ServantTemplate[],
  initialPage = 1,
  initialOrigin = 'all',
  initialClass = 'all',
  searchKeyword?: string
) {
  let page = initialPage;
  let originFilter = initialOrigin;
  let classFilter = initialClass;

  const collector = message.createMessageComponentCollector({
    idle: 120000,
    time: 600000
  });

  collector.on('collect', async (i: any) => {
    try {
      if (i.replied || i.deferred) return;
      const customId = i.customId;

      // Dropdown Select Menu
      if (i.isStringSelectMenu() && (customId === 'select_servant_registry' || customId.startsWith('select_servant_'))) {
        const val = i.values[0];
        const servantId = val.replace('servant_view_', '').replace('view_servant_', '');
        const target = allServants.find(s => s.id === servantId);

        if (target) {
          await i.deferReply();
          const profileEmbed = buildServantFullProfileEmbed(target);
          const artworkEmbed = buildServantArtworkEmbed(target);
          const actions = buildProfileActions(target.id);

          const files: AttachmentBuilder[] = [];
          try {
            const tempInstance = createServantTempInstance(target);
            const cardBuffer = await renderServantProfileCard(tempInstance, 'Throne of Heroes');
            if (cardBuffer && cardBuffer.length > 500) {
              files.push(new AttachmentBuilder(cardBuffer, { name: 'servant_profile.png' }));
            }
          } catch (e) {
            console.warn('Canvas render error in servants list dropdown:', e);
          }

          await i.editReply({ 
            embeds: [profileEmbed, artworkEmbed], 
            files,
            components: [actions] 
          });
        } else {
          await i.reply({ content: 'Heroic Spirit not found.', ephemeral: true });
        }
        return;
      }

      // Pagination Controls
      if (customId === 'servant_list_prev') {
        page = Math.max(1, page - 1);
        const { embed, components } = buildServantsListUI(allServants, page, originFilter, classFilter, searchKeyword);
        await i.update({ embeds: [embed], components });
        return;
      }

      if (customId === 'servant_list_next') {
        page = page + 1;
        const { embed, components } = buildServantsListUI(allServants, page, originFilter, classFilter, searchKeyword);
        await i.update({ embeds: [embed], components });
        return;
      }

      // Origin Filter Button (All -> Canon -> Custom -> All)
      if (customId === 'servant_list_origin') {
        if (originFilter === 'all') originFilter = 'canon';
        else if (originFilter === 'canon') originFilter = 'custom';
        else originFilter = 'all';

        page = 1;
        const { embed, components } = buildServantsListUI(allServants, page, originFilter, classFilter, searchKeyword);
        await i.update({ embeds: [embed], components });
        return;
      }

      // Class Filter Button (Cycles through classes)
      if (customId === 'servant_list_class') {
        const currentIdx = CLASS_CYCLE.indexOf(classFilter as any);
        const nextIdx = (currentIdx + 1) % CLASS_CYCLE.length;
        classFilter = CLASS_CYCLE[nextIdx];

        page = 1;
        const { embed, components } = buildServantsListUI(allServants, page, originFilter, classFilter, searchKeyword);
        await i.update({ embeds: [embed], components });
        return;
      }

      // Profile Actions & Detail Views
      if (customId.startsWith('view_servant_')) {
        const id = customId.replace('view_servant_', '');
        const target = allServants.find(s => s.id === id);
        if (target) {
          await i.deferReply();
          const profileEmbed = buildServantFullProfileEmbed(target);
          const artworkEmbed = buildServantArtworkEmbed(target);
          const actions = buildProfileActions(target.id);

          const files: AttachmentBuilder[] = [];
          try {
            const tempInstance = createServantTempInstance(target);
            const cardBuffer = await renderServantProfileCard(tempInstance, 'Throne of Heroes');
            if (cardBuffer && cardBuffer.length > 500) {
              files.push(new AttachmentBuilder(cardBuffer, { name: 'servant_profile.png' }));
            }
          } catch (e) {
            console.warn('Canvas render error in servants list button:', e);
          }

          await i.editReply({ 
            embeds: [profileEmbed, artworkEmbed], 
            files,
            components: [actions] 
          });
        } else {
          await i.reply({ content: 'Heroic Spirit not found.', ephemeral: true });
        }
        return;
      }

      if (customId.startsWith('view_np_')) {
        const id = customId.replace('view_np_', '');
        const target = allServants.find(s => s.id === id);
        if (target) {
          const npEmbed = buildNoblePhantasmEmbed(target);
          const actions = buildNoblePhantasmActions(target.id);
          await i.reply({ embeds: [npEmbed], components: [actions] });
        } else {
          await i.reply({ content: 'Heroic Spirit not found.', ephemeral: true });
        }
        return;
      }

      if (customId.startsWith('view_art_')) {
        const id = customId.replace('view_art_', '');
        const target = allServants.find(s => s.id === id);
        if (target) {
          const artEmbed = buildServantArtworkEmbed(target);
          const actions = buildNoblePhantasmActions(target.id);
          await i.reply({ embeds: [artEmbed], components: [actions] });
        } else {
          await i.reply({ content: 'Heroic Spirit not found.', ephemeral: true });
        }
        return;
      }

      if (customId.startsWith('quote_servant_')) {
        const id = customId.replace('quote_servant_', '');
        const target = allServants.find(s => s.id === id);
        if (target) {
          const quoteEmbed = new EmbedBuilder()
            .setTitle(`💬 ${target.name} — Dialogue Line`)
            .setDescription(`*"${target.summonQuote || target.battleStartQuote}"*`)
            .setColor(0xd4af37)
            .setFooter({ text: `${target.title} • Class: ${target.servantClass}` });
          await i.reply({ embeds: [quoteEmbed] });
        } else {
          await i.reply({ content: 'Heroic Spirit not found.', ephemeral: true });
        }
        return;
      }

      if (customId === 'btn_back_servants_list') {
        const { embed, components } = buildServantsListUI(allServants, 1, 'all', 'all');
        await i.reply({ embeds: [embed], components });
        return;
      }
    } catch (err: any) {
      if (err.code === 10062 || err.message?.includes('Unknown interaction')) return;
      console.error('Error handling servants list interaction:', err);
    }
  });
}
