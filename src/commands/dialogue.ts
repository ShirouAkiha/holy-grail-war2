import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  AttachmentBuilder, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { getOrCreateMaster } from '../database/service';
import { renderDialogueCard } from '../canvas/renderer';
import { SERVANT_DATABASE } from '../data/servants';
import { getAllThroneServants } from '../database/service';

// ==========================================
// 1. SLASH COMMAND DEFINITION
// ==========================================
export const data = new SlashCommandBuilder()
  .setName('dialogue')
  .setDescription('🎬 Display animated Visual Novel dialogue cut-in with battlefield stage and slash effect')
  .addStringOption(opt =>
    opt
      .setName('servant')
      .setDescription('Heroic Spirit name (defaults to your contracted Servant)')
      .setRequired(false)
  )
  .addStringOption(opt =>
    opt
      .setName('battlefield')
      .setDescription('Battlefield environment preset')
      .setRequired(false)
      .addChoices(
        { name: '🌋 Fuyuki Burning City (Apocalyptic embers & ruined skyline)', value: 'fuyuki' },
        { name: '❄️ Einzbern Castle (Twilight blizzard & falling snow)', value: 'snow' },
        { name: '⛩️ Ryuudou Temple (Midnight indigo & moonlight spirit motes)', value: 'temple' },
        { name: '👑 Throne of Heroes (Celestial golden halos & cosmic starlight)', value: 'throne' },
        { name: '🟣 Greater Grail Cavern (Violet leyline abyss & mana pulse)', value: 'grail' }
      )
  )
  .addStringOption(opt =>
    opt
      .setName('quote')
      .setDescription('Custom dialogue speech line to speak')
      .setRequired(false)
  );

// ==========================================
// 2. MAIN EXECUTE HANDLER
// ==========================================
export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const servantQuery = interaction.options.getString('servant')?.trim().toLowerCase();
    const bgPreset = interaction.options.getString('battlefield') || 'fuyuki';
    const customQuote = interaction.options.getString('quote')?.trim();

    const throne = await getAllThroneServants();
    let targetTemplate: any = null;

    if (servantQuery) {
      targetTemplate = throne.find(s => 
        s.name.toLowerCase() === servantQuery ||
        s.id.toLowerCase() === servantQuery ||
        s.name.toLowerCase().includes(servantQuery)
      );
    }

    if (!targetTemplate) {
      const active = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];
      if (active) {
        targetTemplate = throne.find(s => s.id === (active.templateId || active.template?.id || active.id)) || active.template;
      }
    }

    if (!targetTemplate) {
      targetTemplate = throne[0] || SERVANT_DATABASE[0];
    }

    const speakerName = targetTemplate.name;
    const speakerTitle = targetTemplate.title || 'Heroic Spirit';
    const speakerClass = targetTemplate.servantClass || 'Saber';
    const speakerAvatar = targetTemplate.avatarUrl || targetTemplate.cardArtUrl;
    const quoteText = customQuote || targetTemplate.summonQuote || 'I ask of you: Are you my Master?';

    // Render high-resolution visual novel cut-in card
    const cardBuffer = await renderDialogueCard(
      speakerName,
      quoteText,
      'TACTICAL COMBAT CHAIN',
      speakerClass,
      speakerAvatar,
      10,
      'Gilgamesh',
      'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
      'Archer',
      ['Buster', 'Buster', 'Buster'],
      bgPreset
    );

    const files: AttachmentBuilder[] = [];
    if (cardBuffer && Buffer.isBuffer(cardBuffer)) {
      files.push(new AttachmentBuilder(cardBuffer, { name: 'dialogue_cutin.png' }));
    }

    const embed = new EmbedBuilder()
      .setTitle(`🎬 Visual Novel Action Cut-In: ${speakerName}`)
      .setDescription(
        `*"${quoteText}"*\n\n` +
        `🏟️ **Battlefield Stage:** \`${bgPreset.toUpperCase()}\` • ⚔️ **Class:** \`${speakerClass}\` • 🎯 **Target:** \`Gilgamesh (Archer)\``
      )
      .setColor(0xd4af37)
      .setImage('attachment://dialogue_cutin.png')
      .setFooter({ text: 'Visual Novel Dialogue Card with Full-Screen Slash & Stage Backdrop' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('quick_start_duel')
        .setLabel('Enter Combat')
        .setEmoji('⚔️')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('quick_servant_card')
        .setLabel('Servant Profile')
        .setEmoji('📜')
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.editReply({ embeds: [embed], files, components: [row] });
  } catch (error) {
    console.error('Error rendering dialogue cut-in command:', error);
    await interaction.editReply({
      content: '❌ Failed to render the visual novel dialogue cut-in card. Please check server logs.'
    });
  }
}
