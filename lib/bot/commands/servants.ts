/**
 * Slash Command: /servants
 * Description: Browse, search, and view all canon and custom Heroic Spirits in the Throne of Heroes
 * Library: discord.js v14
 */

export const servantsCommandCode = `import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  ComponentType
} from 'discord.js';
import { SERVANT_DATABASE, getDefaultClassPassives } from '../data/servants';
import { getCustomServants } from '../database/service';
import { ServantTemplate } from '../types';

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
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('view')
      .setDescription('View the complete public profile card of a specific Servant')
      .addStringOption(opt =>
        opt
          .setName('name')
          .setDescription('Exact or partial name of the Servant')
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const customServants: ServantTemplate[] = (await getCustomServants?.()) || [];
    const allServants: ServantTemplate[] = [...SERVANT_DATABASE, ...customServants];

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'view') {
      const query = interaction.options.getString('name', true).toLowerCase().trim();
      const match = allServants.find(
        s => s.name.toLowerCase().includes(query) || s.id.toLowerCase() === query
      );

      if (!match) {
        await interaction.reply({
          ephemeral: true,
          content: \`❌ No Heroic Spirit found matching "\${query}". Use \`/servants list\` to see all available spirits.\`
        });
        return;
      }

      const profileEmbed = buildServantFullProfileEmbed(match);
      const actionRow = buildProfileActions(match.id);
      await interaction.reply({ embeds: [profileEmbed], components: [actionRow] });
      return;
    }

    if (subcommand === 'search') {
      const query = interaction.options.getString('query', true).toLowerCase().trim();
      const results = allServants.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.servantClass.toLowerCase().includes(query) ||
        s.title.toLowerCase().includes(query) ||
        s.noblePhantasm.name.toLowerCase().includes(query) ||
        (s.lore && s.lore.toLowerCase().includes(query))
      );

      if (results.length === 0) {
        await interaction.reply({
          ephemeral: true,
          content: \`🔍 No Heroic Spirits found matching query: **"\${query}"**\`
        });
        return;
      }

      const embed = buildListEmbed(
        results,
        \`🔍 Search Results for "\${query}" (\${results.length} Found)\`,
        \`Click any Servant button below to broadcast their full profile to the channel:\`
      );

      const rows = buildServantButtons(results.slice(0, 10));
      const response = await interaction.reply({
        embeds: [embed],
        components: rows,
        fetchReply: true
      });

      setupServantListCollector(response, allServants);
      return;
    }

    // Default: list all
    const filter = interaction.options.getString('filter') || 'all';
    let filteredList = allServants;
    if (filter === 'canon') filteredList = allServants.filter(s => !s.isCustomOrMeme);
    if (filter === 'custom') filteredList = allServants.filter(s => s.isCustomOrMeme);

    const embed = buildListEmbed(
      filteredList,
      \`📜 Throne of Heroes Registry (\${filteredList.length} Servants)\`,
      \`Click any Servant's name button below to reveal their complete status and parameters:\`
    );

    const rows = buildServantButtons(filteredList.slice(0, 10));
    const response = await interaction.reply({
      embeds: [embed],
      components: rows,
      fetchReply: true
    });

    setupServantListCollector(response, allServants);

  } catch (error: any) {
    console.error('Error executing /servants:', error);
    await interaction.reply({
      content: \`❌ Error querying Throne of Heroes: \${error.message}\`,
      ephemeral: true
    });
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
    ? servant.skills.map((s, idx) => \`• **Skill \${idx + 1}: \${s.name}** [CD: \${s.cooldown}T] — \${s.description}\`).join('\\n')
    : 'None';

  const rawPassives = (servant.passives && servant.passives.length > 0)
    ? servant.passives.slice(0, 2)
    : getDefaultClassPassives(servant.servantClass).slice(0, 2);

  const passiveSkillsText = rawPassives && rawPassives.length > 0
    ? rawPassives.map((p, idx) => (idx === 0
        ? \`• **Passive 1: \${p.name}** [\${p.rank || 'Passive'}] *(Unlocked at Bond 1)* — \${p.description}\`
        : \`• **Passive 2: \${p.name}** [\${p.rank || 'Passive'}] *(Unlocks at Bond 5)* — \${p.description}\`
      )).join('\\n')
    : 'None';

  const embed = new EmbedBuilder()
    .setTitle(\`⚔️ \${servant.name} — \${servant.title}\`)
    .setDescription(
      \`\${stars} | Class: **\${servant.servantClass}** | Origin: **\${servant.isCustomOrMeme ? '🛠️ Custom Administrator Creation' : '🏛️ Canon Heroic Spirit'}**\\n\\n\` +
      \`📜 **Historical Legend & Lore:**\\n> \${servant.lore || 'A legendary soul recorded in the Throne of Heroes.'}\\n\\n\` +
      \`📊 **Base Parameters:**\\n\` +
      \`• **STR:** \${servant.baseStats.strength} | **END:** \${servant.baseStats.endurance} | **AGI:** \${servant.baseStats.agility}\\n\` +
      \`• **MAN:** \${servant.baseStats.mana} | **LCK:** \${servant.baseStats.luck}\\n\` +
      \`• **Base HP:** \`\${servant.baseHp.toLocaleString()}\` | **Base ATK:** \`\${servant.baseAtk.toLocaleString()}\`\\n\\n\` +
      \`🃏 **Command Deck:** \${deck}\\n\\n\` +
      \`⚡ **Active Personal Skills:**\\n\${activeSkillsText}\\n\\n\` +
      \`🛡️ **Class Passive Skills (Max 2 • 2nd Unlocks at Bond Lv. 5):**\\n\${passiveSkillsText}\\n\\n\` +
      \`💥 **Noble Phantasm: \${np.name}** (\${np.cardType} • \${np.target.toUpperCase()})\\n\` +
      \`> *"\${np.chant || 'True power of the Noble Phantasm release!'}"*\\n\` +
      \`• **Multiplier:** \${np.multiplier}% | **Overcharge:** \${np.overchargeEffect || 'None'}\\n\` +
      \`• \${np.description}\\n\\n\` +
      \`💬 **Master Quotes:**\\n\` +
      \`• **Summon:** *"\${servant.summonQuote}"*\\n\` +
      \`• **Battle Start:** *"\${servant.battleStartQuote}"*\\n\` +
      \`• **Victory:** *"\${servant.victoryQuote}"*\`
    )
    .setColor(cardColor)
    .setFooter({ text: \`Throne ID: \${servant.id} • Holy Grail War Registry\` });

  if (servant.cardArtUrl || servant.avatarUrl) {
    embed.setImage(servant.cardArtUrl || servant.avatarUrl);
  }

  return embed;
}

function buildListEmbed(servants: ServantTemplate[], title: string, description: string) {
  const lines = servants.map((s, idx) => {
    const tag = s.isCustomOrMeme ? '🛠️ [CUSTOM]' : '🏛️ [CANON]';
    return \`\`\${idx + 1}. **\${s.name}** — *\${s.title}* [\`\${s.servantClass}\` \${'⭐'.repeat(s.rarity || 5)}] \${tag}\`\`;
  });

  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(\`\${description}\\n\\n\${lines.join('\\n')}\`)
    .setColor(0xd4af37)
    .setFooter({ text: 'Holy Grail War Throne Registry • Use /servants search [query] to filter' });
}

function buildServantButtons(servants: ServantTemplate[]) {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();

  servants.forEach((s, idx) => {
    if (idx > 0 && idx % 5 === 0) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder<ButtonBuilder>();
    }

    const shortName = s.name.length > 20 ? s.name.substring(0, 18) + '..' : s.name;
    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId(\`view_servant_\${s.id}\`)
        .setLabel(shortName)
        .setStyle(s.isCustomOrMeme ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setEmoji(s.isCustomOrMeme ? '🛠️' : '⚔️')
    );
  });

  if (currentRow.components.length > 0) {
    rows.push(currentRow);
  }

  return rows;
}

function buildProfileActions(servantId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(\`quote_servant_\${servantId}\`)
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

function setupServantListCollector(message: any, allServants: ServantTemplate[]) {
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120000
  });

  collector.on('collect', async (i: any) => {
    try {
      if (i.replied || i.deferred) return;
      if (i.customId.startsWith('view_servant_')) {
        const id = i.customId.replace('view_servant_', '');
        const target = allServants.find(s => s.id === id);
        if (target) {
          const profileEmbed = buildServantFullProfileEmbed(target);
          const actions = buildProfileActions(target.id);
          // Show full profile to everyone in the channel
          await i.reply({ embeds: [profileEmbed], components: [actions] });
        } else {
          await i.reply({ content: 'Heroic Spirit not found.', ephemeral: true });
        }
      } else if (i.customId === 'btn_back_servants_list') {
        const listEmbed = buildListEmbed(
          allServants.slice(0, 15),
          \`📜 Throne of Heroes Registry (\${allServants.length} Servants)\`,
          \`Click any Servant's button below to display their full profile:\`
        );
        const rows = buildServantButtons(allServants.slice(0, 10));
        await i.reply({ embeds: [listEmbed], components: rows });
      }
    } catch (err: any) {
      if (err.code === 10062 || err.message?.includes('Unknown interaction')) return;
      console.error('Error handling servants list button:', err);
    }
  });
}
`;
