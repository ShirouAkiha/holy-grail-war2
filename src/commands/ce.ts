import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
  MessageFlags
} from 'discord.js';
import { getOrCreateMaster, getAllCraftEssences } from '../database/service';
import { 
  BOND_CRAFT_ESSENCES, 
  getAllBondCraftEssences, 
  getBondCraftEssenceForServant 
} from '../data/craftEssences';
import { safeSetEmbedImage, safeSetEmbedThumbnail } from '../utils/discordEmbedHelper';

export const data = new SlashCommandBuilder()
  .setName('ce')
  .setDescription('🖼️ View Craft Essence artwork, lore, bond relics, and stats')
  .addSubcommand(sub =>
    sub
      .setName('art')
      .setDescription('🖼️ View high-resolution card artwork and lore of a Craft Essence')
      .addStringOption(opt =>
        opt
          .setName('name')
          .setDescription('Name or ID of Craft Essence (Leave empty for active Servant\'s equipped CE)')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('view')
      .setDescription('📖 Inspect full parameter card, passives, and flavor lore')
      .addStringOption(opt =>
        opt
          .setName('name')
          .setDescription('Name or ID of Craft Essence')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('bond')
      .setDescription('🎖️ Browse all exclusive Bond 10 Craft Essences and partner Servants')
  )
  .addSubcommand(sub =>
    sub
      .setName('list')
      .setDescription('📜 Browse the Craft Essence archive and conceptual relics')
      .addIntegerOption(opt =>
        opt
          .setName('rarity')
          .setDescription('Filter by star rating (3, 4, 5)')
          .setRequired(false)
          .addChoices(
            { name: '★5 SSR', value: 5 },
            { name: '★4 SR', value: 4 },
            { name: '★3 R', value: 3 }
          )
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const sub = interaction.options.getSubcommand();
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];
    const allCes = getAllCraftEssences();
    const bondCes = getAllBondCraftEssences();
    const combinedDatabase = [...allCes, ...bondCes];

    // ==========================================
    // 1. SUBCOMMAND: BOND (CATALOG OF BOND CEs)
    // ==========================================
    if (sub === 'bond') {
      const selectOptions = bondCes.slice(0, 25).map(ce => ({
        label: `${ce.name.slice(0, 50)}`,
        value: ce.id,
        description: `Partner: ${ce.bondServantName || 'Heroic Spirit'} • ★4 Bond Relic`.slice(0, 100)
      }));

      const embed = new EmbedBuilder()
        .setTitle('🎖️ Master-Servant Max Bond 10 Relics')
        .setDescription(
          `When a contracted Heroic Spirit reaches **Bond Level 10 (MAX BOND)**, they bestow their legendary **Bond Craft Essence** upon their Master.\n\n` +
          bondCes.map(ce => 
            `• ★4 **${ce.name}**\n` +
            `  *Partner:* **${ce.bondServantName}**\n` +
            `  *Effect:* ${ce.effectText}`
          ).join('\n\n') +
          `\n\n💡 *Select a Bond Relic below or use \`/ce art <name>\` to view its card artwork!*`
        )
        .setColor(0xd4af37)
        .setFooter({ text: 'Bond relics grant exclusive passives when equipped to their partner.' });

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('ce_select_bond_view')
          .setPlaceholder('🖼️ Select a Bond Relic to view its full artwork...')
          .addOptions(selectOptions)
      );

      const reply = await interaction.reply({ embeds: [embed], components: [row] });
      const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 120000
      });

      collector.on('collect', async (i) => {
        if (i.user.id !== interaction.user.id) {
          await i.reply({ content: 'Only the Master who invoked this archive may interact with it.', flags: MessageFlags.Ephemeral });
          return;
        }
        const selectedId = i.values[0];
        const selectedCe = combinedDatabase.find(c => c.id === selectedId);
        if (selectedCe) {
          const artEmbed = new EmbedBuilder()
            .setTitle(`🖼️ Bond 10 Relic Artwork: ${selectedCe.name}`)
            .setDescription(
              `★4 **${selectedCe.name}** • **[BOND 10 RELIC]**\n` +
              `**Bond Partner:** **${selectedCe.bondServantName}**\n` +
              `**Stats:** \`+${selectedCe.atkBonus || 100} ATK\` / \`+${selectedCe.hpBonus || 100} HP\`\n\n` +
              `**Special Bond Effect:**\n${selectedCe.effectText}\n\n` +
              `*${selectedCe.description}*`
            )
            .setColor(0xd4af37);

          if (selectedCe.artworkUrl) {
            safeSetEmbedImage(artEmbed, selectedCe.artworkUrl);
          }

          await i.reply({ embeds: [artEmbed], flags: MessageFlags.Ephemeral });
        }
      });
      return;
    }

    // ==========================================
    // 2. SUBCOMMAND: ART / VIEW (SPECIFIC CE)
    // ==========================================
    if (sub === 'art' || sub === 'view') {
      const searchName = interaction.options.getString('name');
      let targetCe: any = null;

      if (searchName) {
        const query = searchName.toLowerCase().trim();
        targetCe = combinedDatabase.find(c => 
          c.name.toLowerCase() === query ||
          c.id.toLowerCase() === query ||
          c.name.toLowerCase().includes(query) ||
          (c.bondServantName && c.bondServantName.toLowerCase().includes(query))
        );
      } else if (activeServant?.equippedCeId) {
        targetCe = combinedDatabase.find(c => c.id === activeServant.equippedCeId);
      } else if (master.craftEssences && master.craftEssences.length > 0) {
        targetCe = master.craftEssences[0];
      } else {
        targetCe = combinedDatabase[0];
      }

      if (!targetCe) {
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          embeds: [
            new EmbedBuilder()
              .setTitle('❌ Craft Essence Not Found')
              .setDescription(`Could not locate a Craft Essence matching \`${searchName}\`. Use \`/ce list\` to browse all relics.`)
              .setColor(0xef4444)
          ]
        });
        return;
      }

      const stars = '★'.repeat(targetCe.rarity || 4);
      const rarityLabel = targetCe.rarity >= 5 ? 'SSR' : targetCe.rarity >= 4 ? 'SR' : 'R';
      const bondBadge = targetCe.isBondCe ? ' • **[BOND 10 RELIC]**' : '';
      const partnerLine = targetCe.bondServantName ? `**Bond Partner:** **${targetCe.bondServantName}**\n` : '';

      const ceEmbed = new EmbedBuilder()
        .setTitle(`🖼️ Craft Essence: ${targetCe.name}`)
        .setDescription(
          `**Rarity:** ${stars} ${rarityLabel}${bondBadge}\n` +
          partnerLine +
          `**Effect:** ${targetCe.effectText || targetCe.description}\n` +
          `**Stats:** \`+${targetCe.atkBonus || targetCe.bonusAtk || 0} ATK\` / \`+${targetCe.hpBonus || targetCe.bonusHp || 0} HP\`\n\n` +
          `*${targetCe.description || 'An ancient conceptual weapon forged from heroic memories.'}*`
        )
        .setColor(targetCe.isBondCe ? 0xec4899 : targetCe.rarity >= 5 ? 0xf59e0b : 0x38bdf8)
        .setFooter({ text: 'Fate Conceptual Armaments • Leyline Altar' });

      if (targetCe.artworkUrl) {
        safeSetEmbedImage(ceEmbed, targetCe.artworkUrl);
      }

      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`ce_btn_open_art_${targetCe.id}`)
          .setLabel('View High-Res Art 🖼️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('ce_btn_inventory')
          .setLabel('My Inventory 🛡️')
          .setStyle(ButtonStyle.Secondary)
      );

      const reply = await interaction.reply({ embeds: [ceEmbed], components: [actionRow] });
      const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000
      });

      collector.on('collect', async (bi) => {
        if (bi.customId === 'ce_btn_inventory') {
          await bi.reply({
            flags: MessageFlags.Ephemeral,
            content: 'Use `/inventory` to equip, unequip, feed, or browse your full personal relic vault!'
          });
        } else if (bi.customId.startsWith('ce_btn_open_art_')) {
          const artOnlyEmbed = new EmbedBuilder()
            .setTitle(`🖼️ ${targetCe.name}`)
            .setDescription(`*${targetCe.description}*`)
            .setColor(0xd4af37);
          if (targetCe.artworkUrl) {
            safeSetEmbedImage(artOnlyEmbed, targetCe.artworkUrl);
          }
          await bi.reply({ embeds: [artOnlyEmbed], flags: MessageFlags.Ephemeral });
        }
      });
      return;
    }

    // ==========================================
    // 3. SUBCOMMAND: LIST (CATALOG WITH ART BUTTONS)
    // ==========================================
    if (sub === 'list') {
      const filterRarity = interaction.options.getInteger('rarity');
      const filtered = filterRarity 
        ? combinedDatabase.filter(c => c.rarity === filterRarity)
        : combinedDatabase;

      const lines = filtered.slice(0, 15).map(c => 
        `• **[${'★'.repeat(c.rarity)}]** **${c.name}**${c.isBondCe ? ' *(Bond 10)*' : ''}\n  *Effect:* ${c.effectText}\n  *Stats:* +${c.atkBonus || 0} ATK / +${c.hpBonus || 0} HP`
      );

      const listEmbed = new EmbedBuilder()
        .setTitle('🛡️ Craft Essence Encyclopedia & Art Gallery')
        .setDescription(
          `Showing **${Math.min(15, filtered.length)}** of **${filtered.length}** Conceptual Relics.\n\n` +
          lines.join('\n\n') +
          `\n\n💡 *Type \`/ce art <name>\` to view full artwork card for any Craft Essence!*`
        )
        .setColor(0x38bdf8);

      await interaction.reply({ embeds: [listEmbed] });
      return;
    }
  } catch (error) {
    console.error('Error in /ce command:', error);
    if (!interaction.replied) {
      await interaction.reply({ content: '❌ Failed to access Craft Essence archive.', flags: MessageFlags.Ephemeral });
    }
  }
}
