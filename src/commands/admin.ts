import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  AutocompleteInteraction,
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';
import { 
  getAllThroneServants,
  setServantNpAnimation,
  getServantNpAnimation,
  getAllCustomNpAnimations,
  getDuelNpSettings,
  setDuelNpSettings,
  matchServantSearch
} from '../database/service';

export const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Fate/Grand Order Master Administration Control Suite')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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
  } catch (err) {
    console.error('Admin autocomplete error:', err);
  }
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

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

  if (subcommand === 'listnp') {
    const list = getAllCustomNpAnimations();
    if (list.length === 0) {
      await interaction.reply({
        ephemeral: true,
        embeds: [
          new EmbedBuilder()
            .setTitle('📋 Custom Noble Phantasm Animations')
            .setDescription('No custom animations have been registered yet. Use `/admin npanim` to configure custom GIFs for any Servant!')
            .setColor(0x3b82f6)
        ]
      });
      return;
    }

    const desc = list
      .map((item, idx) => `${idx + 1}. **${item.servantName}** — [GIF Link](${item.gifUrl})\n> Chant: *“${item.chant || 'N/A'}”*`)
      .join('\n\n');

    await interaction.reply({
      ephemeral: true,
      embeds: [
        new EmbedBuilder()
          .setTitle(`📋 Custom Noble Phantasm Animations (${list.length})`)
          .setDescription(desc)
          .setColor(0xd4af37)
      ]
    });
    return;
  }
}
