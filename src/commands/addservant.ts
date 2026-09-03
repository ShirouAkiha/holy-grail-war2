import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  AutocompleteInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { 
  addCustomServant, 
  removeCustomServant, 
  getCustomServants, 
  getAllThroneServants,
  updateServantTemplate,
  setServantNpAnimation,
  getServantNpAnimation,
  getAllCustomNpAnimations,
  getDuelNpSettings,
  setDuelNpSettings,
  findServantInPool,
  matchServantSearch
} from '../database/service';
import { ServantClass, ServantTemplate, CardType } from '../types';
import { normalizeMediaUrl, isDirectEmbeddableMedia } from '../utils/mediaResolver';

// ==========================================
// 1. ADMIN SLASH COMMAND DEFINITION
// ==========================================
// Allows Server Administrators to register custom Servants (with images, stats, NP chants, and lore)
// into the Throne of Heroes summoning pool.
export const data = new SlashCommandBuilder()
  .setName('addservant')
  .setDescription('Admin command to register custom Heroic Spirits into the Throne of Heroes')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
    sub
      .setName('create')
      .setDescription('Create and register a new custom Servant with picture and stats')
      .addStringOption(opt =>
        opt
          .setName('name')
          .setDescription('Name of the Heroic Spirit (e.g. Miyamoto Musashi, Satoru Gojo)')
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt
          .setName('class')
          .setDescription('Servant Class')
          .setRequired(true)
          .addChoices(
            { name: '⚔️ Saber', value: 'Saber' },
            { name: '🏹 Archer', value: 'Archer' },
            { name: '🔱 Lancer', value: 'Lancer' },
            { name: '🐎 Rider', value: 'Rider' },
            { name: '🔮 Caster', value: 'Caster' },
            { name: '🗡️ Assassin', value: 'Assassin' },
            { name: '🔥 Berserker', value: 'Berserker' },
            { name: '⚖️ Ruler', value: 'Ruler' },
            { name: '💀 Avenger', value: 'Avenger' },
            { name: '🌌 Foreigner', value: 'Foreigner' },
            { name: '🌙 MoonCancer', value: 'MoonCancer' },
            { name: '🤡 Shitposter', value: 'Shitposter' }
          )
      )
      .addStringOption(opt =>
        opt
          .setName('title')
          .setDescription('Epithet or Title (e.g. King of Knights, Peerless Swordsman)')
          .setRequired(false)
      )
      .addAttachmentOption(opt =>
        opt
          .setName('image_file')
          .setDescription('Upload a picture of the Servant')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('image_url')
          .setDescription('Or provide a direct image URL (https://...)')
          .setRequired(false)
      )
      .addIntegerOption(opt =>
        opt
          .setName('hp')
          .setDescription('Base Max HP (Default: 14500)')
          .setMinValue(5000)
          .setMaxValue(30000)
          .setRequired(false)
      )
      .addIntegerOption(opt =>
        opt
          .setName('atk')
          .setDescription('Base Attack Power (Default: 11500)')
          .setMinValue(4000)
          .setMaxValue(25000)
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('noble_phantasm')
          .setDescription('Noble Phantasm Name (e.g. Excalibur, Unlimited Blade Works)')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('np_chant')
          .setDescription('Chant recited when casting Noble Phantasm')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('np_card')
          .setDescription('Noble Phantasm Card Type')
          .setRequired(false)
          .addChoices(
            { name: '🔴 Buster (Heavy Damage)', value: 'Buster' },
            { name: '🔵 Arts (NP Refund)', value: 'Arts' },
            { name: '🟢 Quick (Critical Stars)', value: 'Quick' }
          )
      )
      .addStringOption(opt =>
        opt
          .setName('np_scope')
          .setDescription('Noble Phantasm Scope')
          .setRequired(false)
          .addChoices(
            { name: '🎯 Single Target (ST)', value: 'single' },
            { name: '💥 Area of Effect (AoE)', value: 'aoe' },
            { name: '🛡️ Support / Non-damaging', value: 'support' }
          )
      )
      .addStringOption(opt =>
        opt
          .setName('summon_quote')
          .setDescription('Dialogue spoken when summoned by the Master')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('lore')
          .setDescription('Historical lore or character backstory')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('list')
      .setDescription('View all custom and canon Servants registered in the Throne of Heroes')
  )
  .addSubcommand(sub =>
    sub
      .setName('edit')
      .setDescription('Admin command to edit any Servant (canon or custom) - images, stats, NP, lore')
      .addStringOption(opt =>
        opt
          .setName('servant_id')
          .setDescription('ID or name of the Servant to edit (e.g. Artoria, Saber Alter, Gilgamesh)')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(opt =>
        opt.setName('name').setDescription('New name of the Heroic Spirit').setRequired(false)
      )
      .addStringOption(opt =>
        opt.setName('title').setDescription('New Title or Epithet').setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('class')
          .setDescription('New Servant Class')
          .setRequired(false)
          .addChoices(
            { name: '⚔️ Saber', value: 'Saber' },
            { name: '🏹 Archer', value: 'Archer' },
            { name: '🔱 Lancer', value: 'Lancer' },
            { name: '🐎 Rider', value: 'Rider' },
            { name: '🔮 Caster', value: 'Caster' },
            { name: '🗡️ Assassin', value: 'Assassin' },
            { name: '🔥 Berserker', value: 'Berserker' },
            { name: '⚖️ Ruler', value: 'Ruler' },
            { name: '💀 Avenger', value: 'Avenger' },
            { name: '🌌 Foreigner', value: 'Foreigner' },
            { name: '🌙 MoonCancer', value: 'MoonCancer' },
            { name: '🤡 Shitposter', value: 'Shitposter' }
          )
      )
      .addAttachmentOption(opt =>
        opt.setName('image_file').setDescription('Upload a new picture of the Servant').setRequired(false)
      )
      .addStringOption(opt =>
        opt.setName('image_url').setDescription('Or provide a direct image URL (https://...)').setRequired(false)
      )
      .addIntegerOption(opt =>
        opt.setName('hp').setDescription('New Base Max HP').setMinValue(1000).setMaxValue(50000).setRequired(false)
      )
      .addIntegerOption(opt =>
        opt.setName('atk').setDescription('New Base Attack Power').setMinValue(1000).setMaxValue(50000).setRequired(false)
      )
      .addStringOption(opt =>
        opt.setName('noble_phantasm').setDescription('New Noble Phantasm Name').setRequired(false)
      )
      .addStringOption(opt =>
        opt.setName('np_chant').setDescription('New Noble Phantasm Chant').setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('np_card')
          .setDescription('New Noble Phantasm Card Type')
          .setRequired(false)
          .addChoices(
            { name: '🔴 Buster (Heavy Damage)', value: 'Buster' },
            { name: '🔵 Arts (NP Refund)', value: 'Arts' },
            { name: '🟢 Quick (Critical Stars)', value: 'Quick' }
          )
      )
      .addStringOption(opt =>
        opt
          .setName('np_scope')
          .setDescription('New Noble Phantasm Scope')
          .setRequired(false)
          .addChoices(
            { name: '🎯 Single Target (ST)', value: 'single' },
            { name: '💥 Area of Effect (AoE)', value: 'aoe' },
            { name: '🛡️ Support / Non-damaging', value: 'support' }
          )
      )
      .addStringOption(opt =>
        opt.setName('summon_quote').setDescription('New Summon Dialogue quote').setRequired(false)
      )
      .addStringOption(opt =>
        opt.setName('lore').setDescription('New Lore / Backstory').setRequired(false)
      )
      .addStringOption(opt =>
        opt.setName('np_gif').setDescription('URL of the Noble Phantasm animated GIF (Tenor, Giphy, or direct .gif link)').setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('npanim')
      .setDescription('Customize or set the Noble Phantasm animated GIF for any Servant')
      .addStringOption(opt =>
        opt
          .setName('servant')
          .setDescription('Name or ID of the Servant (e.g. Artoria, Gilgamesh, Musashi)')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addAttachmentOption(opt =>
        opt
          .setName('file')
          .setDescription('Upload direct GIF or MP4 animation file from your device (100% reliable)')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('gif_url')
          .setDescription('Or paste a direct image URL (https://...)')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('chant')
          .setDescription('Optional custom True Name invocation dialogue chant')
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
      .setName('delete')
      .setDescription('Delete a custom Servant from the Throne of Heroes')
      .addStringOption(opt =>
        opt
          .setName('servant_id')
          .setDescription('Search or select custom servant to delete (use "all" to wipe custom spirits)')
          .setRequired(true)
          .setAutocomplete(true)
      )
  );

// ==========================================
// 1.5 AUTOCOMPLETE HANDLER
// ==========================================
export async function autocomplete(interaction: AutocompleteInteraction) {
  try {
    const focusedOption = interaction.options.getFocused(true);
    const subcommand = interaction.options.getSubcommand(false);
    const query = focusedOption.value.toLowerCase().trim();
    const allServants = getAllThroneServants();

    if (focusedOption.name === 'servant_id' || focusedOption.name === 'servant') {
      const list = subcommand === 'delete' ? allServants.filter(s => s.isCustomOrMeme) : allServants;
      const matches = list
        .filter(s => matchServantSearch(s, query))
        .slice(0, 25);

      await interaction.respond(
        matches.map(s => ({
          name: `${s.name} (${s.servantClass} ★${s.rarity}) ${s.isCustomOrMeme ? '[Custom]' : ''}`.slice(0, 100),
          value: s.id
        }))
      );
    }
  } catch (err) {
    console.error('Addservant autocomplete error:', err);
  }
}

// ==========================================
// 2. COMMAND EXECUTION HANDLER
// ==========================================
export async function execute(interaction: ChatInputCommandInteraction) {
  // Permission Guard: Must be Administrator or Guild Manager
  const member = interaction.member;
  const isGuildAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
                       interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

  // Allow in DM or if user has admin permissions
  if (interaction.guild && !isGuildAdmin) {
    await interaction.reply({
      ephemeral: true,
      embeds: [
        new EmbedBuilder()
          .setTitle('⛔ Administrator Access Required')
          .setDescription('Only server administrators can register custom Heroic Spirits to the Throne of Heroes.')
          .setColor(0xef4444)
      ]
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  // ------------------------------------------
  // SUBCOMMAND A: CREATE CUSTOM SERVANT
  // ------------------------------------------
  if (subcommand === 'create') {
    const name = interaction.options.getString('name', true).trim();
    const servantClass = interaction.options.getString('class', true) as ServantClass;
    const title = interaction.options.getString('title') || 'Heroic Spirit';
    const hp = interaction.options.getInteger('hp') || 14500;
    const atk = interaction.options.getInteger('atk') || 11500;
    const npName = interaction.options.getString('noble_phantasm') || `${name}'s Secret Art`;
    const npChant = interaction.options.getString('np_chant') || `Behold the legendary power of ${name}!`;
    const npCard = (interaction.options.getString('np_card') as CardType) || 'Buster';
    const npScope = (interaction.options.getString('np_scope') as 'single' | 'aoe' | 'support') || 'single';
    const summonQuote = interaction.options.getString('summon_quote') || `Servant ${servantClass}. I ask of you, are you my Master?`;
    const lore = interaction.options.getString('lore') || `A legendary Heroic Spirit summoned across time to participate in the Holy Grail War.`;

    // Calculate standardized base multiplier based on Card Type and Scope
    let npMultiplier = 600;
    if (npScope === 'support') {
      npMultiplier = 0;
    } else if (npScope === 'single') {
      npMultiplier = npCard === 'Quick' ? 1200 : npCard === 'Arts' ? 900 : 600;
    } else {
      npMultiplier = npCard === 'Quick' ? 600 : npCard === 'Arts' ? 450 : 400;
    }

    // Picture resolution: check uploaded attachment first, then image_url option, then high quality placeholder
    const imageAttachment = interaction.options.getAttachment('image_file');
    const imageUrl = interaction.options.getString('image_url');
    const finalPicture = imageAttachment?.url || imageUrl || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';

    // Generate unique servant ID
    const servantId = `custom_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`;

    // Build the complete Servant Template
    const newServantTemplate: ServantTemplate = {
      id: servantId,
      name,
      title,
      servantClass,
      rarity: 5,
      baseHp: hp,
      baseAtk: atk,
      baseStats: {
        strength: Math.min(25, Math.max(10, Math.round(atk / 650))),
        endurance: Math.min(25, Math.max(10, Math.round(hp / 800))),
        agility: 15,
        mana: 16,
        luck: 14
      },
      commandDeck: ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'],
      skills: [
        {
          id: `${servantId}_skill_1`,
          name: `${title} Insight`,
          cooldown: 5,
          description: `Increases attack power by 35% for 3 turns.`,
          effectType: 'buff_atk',
          value: 35,
          duration: 3,
          icon: '⚔️'
        },
        {
          id: `${servantId}_skill_2`,
          name: 'Heroic Resolve',
          cooldown: 6,
          description: `Charges NP gauge by 30% and recovers 2500 HP.`,
          effectType: 'np_charge',
          value: 30,
          duration: 1,
          icon: '✨'
        },
        {
          id: `${servantId}_skill_3`,
          name: 'Command Aura',
          cooldown: 5,
          description: `Generates 20 Critical Stars and increases Critical Damage by 40%.`,
          effectType: 'crit_stars',
          value: 20,
          duration: 3,
          icon: '🌟'
        }
      ],
      noblePhantasm: {
        name: npName,
        cardType: npCard,
        chant: npChant,
        description: npScope === 'support'
          ? `Support Noble Phantasm granting defensive protection, HP recovery, and tactical advantages.`
          : `Unleashes supreme power, dealing ${npMultiplier}% ${npCard} ${npScope === 'single' ? 'Single Target' : 'Area of Effect'} damage.`,
        target: npScope,
        multiplier: npMultiplier,
        overchargeEffect: npCard === 'Quick' ? 'Increases Star Generation' : npCard === 'Arts' ? 'Increases NP Gain' : 'Increases ATK by 20% for 3 turns'
      },
      lore,
      summonQuote,
      battleStartQuote: `Let us carve our names into the annals of this Holy Grail War!`,
      victoryQuote: `The contract remains unbroken. Victory is ours!`,
      defeatQuote: `Forgive me, Master... My journey ends here...`,
      avatarUrl: finalPicture,
      cardArtUrl: finalPicture,
      isCustomOrMeme: true
    };

    // Save to Throne of Heroes database
    addCustomServant(newServantTemplate);

    const embed = new EmbedBuilder()
      .setTitle(`✨ NEW HEROIC SPIRIT REGISTERED TO THE THRONE OF HEROES`)
      .setDescription(
        `**${newServantTemplate.name}** has been recorded into the Great Holy Grail database!\n\n` +
        `• **Class:** \`${newServantTemplate.servantClass}\`\n` +
        `• **Title:** *${newServantTemplate.title}*\n` +
        `• **Base HP:** \`${newServantTemplate.baseHp.toLocaleString()}\` | **Base ATK:** \`${newServantTemplate.baseAtk.toLocaleString()}\`\n` +
        `• **Noble Phantasm:** **${newServantTemplate.noblePhantasm.name}** [${newServantTemplate.noblePhantasm.cardType} • ${newServantTemplate.noblePhantasm.target.toUpperCase()}]\n` +
        `• **NP Chant:** *"${newServantTemplate.noblePhantasm.chant}"*\n` +
        `• **Summon Dialogue:** *"${newServantTemplate.summonQuote}"*\n\n` +
        `📜 **Lore:**\n${newServantTemplate.lore}\n\n` +
        `*This Servant can now be summoned randomly by Masters performing the \`/summon\` ritual!*`
      )
      .setImage(finalPicture)
      .setColor(0xd4af37)
      .setFooter({ text: `ID: ${newServantTemplate.id} • Registered by Admin ${interaction.user.username}` });

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // ------------------------------------------
  // SUBCOMMAND B: LIST CUSTOM SERVANTS
  // ------------------------------------------
  if (subcommand === 'list') {
    const customList = getCustomServants();
    const allThrone = getAllThroneServants();

    const items = allThrone.map((s, idx) => 
      `**${idx + 1}. ${s.name}** [${s.servantClass}] ${s.isCustomOrMeme ? '🛠️ *[Custom]*' : '🏛️ *[Canon]*'}\n` +
      `   • Title: *${s.title}* | HP: \`${s.baseHp}\` | ATK: \`${s.baseAtk}\`\n` +
      `   • ID: \`${s.id}\` | NP: *${s.noblePhantasm.name}*`
    ).join('\n\n');

    const embed = new EmbedBuilder()
      .setTitle(`📜 Throne of Heroes Servant Registry (${allThrone.length} Servants)`)
      .setDescription(
        `Below are all Heroic Spirits registered in the Throne of Heroes.\n` +
        `Use \`/addservant edit servant_id:<id>\` to edit any Servant's image, stats, name, or quotes!\n\n` +
        items
      )
      .setColor(0xd4af37)
      .setFooter({ text: `Canon: ${allThrone.length - customList.length} • Custom: ${customList.length}` });

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // ------------------------------------------
  // SUBCOMMAND C: DELETE CUSTOM SERVANT
  // ------------------------------------------
  if (subcommand === 'delete') {
    const servantId = interaction.options.getString('servant_id', true).trim();
    const deleted = removeCustomServant(servantId);

    if (deleted) {
      const isAll = servantId.toLowerCase() === 'all' || servantId === '*';
      await interaction.reply({
        ephemeral: true,
        embeds: [
          new EmbedBuilder()
            .setTitle('🗑️ Custom Servant Removed')
            .setDescription(
              isAll 
                ? 'Successfully cleared all custom Heroic Spirits from the Throne of Heroes registry.'
                : `Successfully erased custom Heroic Spirit matching \`${servantId}\` from the Throne of Heroes registry.`
            )
            .setColor(0x10b981)
        ]
      });
    } else {
      await interaction.reply({
        ephemeral: true,
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Servant Not Found')
            .setDescription(`No custom Servant found matching \`${servantId}\`. Use \`/addservant list\` to see current custom spirits. Note: Default canonical Servants are permanent.`)
            .setColor(0xef4444)
        ]
      });
    }
    return;
  }

  // ------------------------------------------
  // SUBCOMMAND D: EDIT SERVANT (CANON OR CUSTOM)
  // ------------------------------------------
  if (subcommand === 'edit') {
    const servantId = interaction.options.getString('servant_id', true).trim();
    const name = interaction.options.getString('name');
    const title = interaction.options.getString('title');
    const servantClass = interaction.options.getString('class') as ServantClass | null;
    const imageAttachment = interaction.options.getAttachment('image_file');
    const imageUrl = interaction.options.getString('image_url');
    const finalPicture = imageAttachment?.url || imageUrl || undefined;
    const hp = interaction.options.getInteger('hp');
    const atk = interaction.options.getInteger('atk');
    const npName = interaction.options.getString('noble_phantasm');
    const npChant = interaction.options.getString('np_chant');
    const npCard = interaction.options.getString('np_card') as CardType | null;
    const npScope = interaction.options.getString('np_scope') as 'single' | 'aoe' | 'support' | null;
    const summonQuote = interaction.options.getString('summon_quote');
    const lore = interaction.options.getString('lore');
    const npGif = interaction.options.getString('np_gif');

    const result = updateServantTemplate(servantId, {
      name: name || undefined,
      title: title || undefined,
      servantClass: servantClass || undefined,
      avatarUrl: finalPicture,
      cardArtUrl: finalPicture,
      baseHp: hp || undefined,
      baseAtk: atk || undefined,
      noblePhantasmName: npName || undefined,
      noblePhantasmChant: npChant || undefined,
      noblePhantasmCardType: npCard || undefined,
      noblePhantasmTarget: npScope || undefined,
      noblePhantasmAnimationUrl: npGif || undefined,
      summonQuote: summonQuote || undefined,
      lore: lore || undefined
    });

    if (!result.success || !result.servant) {
      await interaction.reply({
        ephemeral: true,
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Servant Not Found')
            .setDescription(result.error || `Could not find servant matching "${servantId}". Use \`/addservant list\` to see all IDs.`)
            .setColor(0xef4444)
        ]
      });
      return;
    }

    const s = result.servant;
    const embed = new EmbedBuilder()
      .setTitle(`✨ SERVANT TEMPLATE UPDATED: ${s.name}`)
      .setDescription(
        `Admin has updated the profile parameters and character portrait for **${s.name}**!\n\n` +
        `• **Class:** \`${s.servantClass}\` | **Title:** *${s.title}*\n` +
        `• **Base HP:** \`${s.baseHp.toLocaleString()}\` | **Base ATK:** \`${s.baseAtk.toLocaleString()}\`\n` +
        `• **Character Portrait & Card Artwork:** ${finalPicture ? '✅ Custom Image Applied' : 'Preserved'}\n` +
        `• **Noble Phantasm:** **${s.noblePhantasm.name}** [${s.noblePhantasm.cardType} • ${s.noblePhantasm.target.toUpperCase()}]\n` +
        `• **NP Chant:** *"${s.noblePhantasm.chant}"*\n` +
        (npGif ? `• **NP Cinematic GIF:** [Updated Animation](${npGif})\n` : '') +
        `• **Summon Dialogue:** *"${s.summonQuote}"*\n\n` +
        `*Changes take effect immediately across all active Master contracts and combat arenas!*`
      )
      .setImage(s.cardArtUrl || s.avatarUrl)
      .setColor(0xd4af37)
      .setFooter({ text: `ID: ${s.id} • Edited by Admin ${interaction.user.username}` });

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // ------------------------------------------
  // SUBCOMMAND E: CUSTOMIZE NOBLE PHANTASM ANIMATION
  // ------------------------------------------
  if (subcommand === 'npanim') {
    const servantQuery = interaction.options.getString('servant', true).trim();
    const fileAttachment = interaction.options.getAttachment('file');
    const urlInput = interaction.options.getString('gif_url')?.trim() || '';
    const chant = interaction.options.getString('chant')?.trim();

    const rawGifUrl = fileAttachment ? fileAttachment.url : urlInput;

    if (!rawGifUrl) {
      await interaction.reply({
        ephemeral: true,
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Missing Media Input')
            .setDescription('Please either **upload a GIF/MP4 file** directly using the `file` option or provide a valid `gif_url`. Direct file upload is 100% reliable!')
            .setColor(0xef4444)
        ]
      });
      return;
    }

    const normalizedGifUrl = fileAttachment ? rawGifUrl : normalizeMediaUrl(rawGifUrl);
    const result = setServantNpAnimation(servantQuery, normalizedGifUrl, chant, interaction.user.username);

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
    const isDirectDiscordUpload = !!fileAttachment;
    const canEmbedDirectly = isDirectDiscordUpload || isDirectEmbeddableMedia(normalizedGifUrl);

    const embed = new EmbedBuilder()
      .setTitle(`🎬 NOBLE PHANTASM ANIMATION SET: ${s.name}`)
      .setDescription(
        `Admin has updated the Noble Phantasm animation for **${s.name}**!\n\n` +
        `• **Class:** \`${s.servantClass}\` | **Noble Phantasm:** **${s.noblePhantasm.name}**\n` +
        `• **True Name Chant:** *“${s.noblePhantasm.chant}”*\n` +
        `• **Media Source:** ${isDirectDiscordUpload ? '✅ **Direct Discord CDN Upload (Permanent & High-Res)**' : `[Direct Media Link](${normalizedGifUrl})`}\n\n` +
        `*During duels, when ${s.name} releases their Noble Phantasm, this animation will display at full size until the next turn!*`
      )
      .setColor(0xd4af37)
      .setFooter({ text: `Configured by Admin ${interaction.user.username} • ${isDirectDiscordUpload ? 'Discord CDN Hosted' : 'Direct CDN Mode'}` });

    if (canEmbedDirectly) {
      embed.setImage(normalizedGifUrl);
      await interaction.reply({ embeds: [embed] });
    } else {
      await interaction.reply({
        content: `🎬 **Noble Phantasm Cinematic Registered for ${s.name}**:\n${rawGifUrl}`,
        embeds: [embed]
      });
    }
    return;
  }

  // ------------------------------------------
  // SUBCOMMAND F: DUEL NOBLE PHANTASM SETTINGS
  // ------------------------------------------
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
}
