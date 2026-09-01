import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
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
  updateServantTemplate
} from '../database/service';
import { ServantClass, ServantTemplate, CardType } from '../types';

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
          .setDescription('ID or name of the Servant to edit (e.g. artoria_pendragon, gilgamesh_archer, or name)')
          .setRequired(true)
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
        opt.setName('summon_quote').setDescription('New Summon Dialogue quote').setRequired(false)
      )
      .addStringOption(opt =>
        opt.setName('lore').setDescription('New Lore / Backstory').setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('delete')
      .setDescription('Delete a custom Servant from the Throne of Heroes')
      .addStringOption(opt =>
        opt
          .setName('servant_id')
          .setDescription('The ID of the custom servant to delete (use /addservant list to find IDs)')
          .setRequired(true)
      )
  );

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
    const summonQuote = interaction.options.getString('summon_quote') || `Servant ${servantClass}. I ask of you, are you my Master?`;
    const lore = interaction.options.getString('lore') || `A legendary Heroic Spirit summoned across time to participate in the Holy Grail War.`;

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
        description: `Unleashes supreme power, dealing 500% damage to the enemy.`,
        target: 'single',
        multiplier: 500,
        overchargeEffect: 'Attack +20% for 3 turns'
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
        `• **Noble Phantasm:** **${newServantTemplate.noblePhantasm.name}** (${newServantTemplate.noblePhantasm.cardType})\n` +
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
      await interaction.reply({
        ephemeral: true,
        embeds: [
          new EmbedBuilder()
            .setTitle('🗑️ Custom Servant Removed')
            .setDescription(`Successfully erased Heroic Spirit \`${servantId}\` from the Throne of Heroes registry.`)
            .setColor(0x10b981)
        ]
      });
    } else {
      await interaction.reply({
        ephemeral: true,
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Servant Not Found')
            .setDescription(`No custom Servant found with ID \`${servantId}\`. Note: Default canonical Servants cannot be deleted.`)
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
    const summonQuote = interaction.options.getString('summon_quote');
    const lore = interaction.options.getString('lore');

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
        `Admin has updated the parameters and picture for **${s.name}**!\n\n` +
        `• **Class:** \`${s.servantClass}\` | **Title:** *${s.title}*\n` +
        `• **Base HP:** \`${s.baseHp.toLocaleString()}\` | **Base ATK:** \`${s.baseAtk.toLocaleString()}\`\n` +
        `• **Noble Phantasm:** **${s.noblePhantasm.name}** (${s.noblePhantasm.cardType})\n` +
        `• **NP Chant:** *"${s.noblePhantasm.chant}"*\n` +
        `• **Summon Dialogue:** *"${s.summonQuote}"*\n\n` +
        `*Changes take effect immediately across all active Master contracts and combat arenas!*`
      )
      .setImage(s.cardArtUrl || s.avatarUrl)
      .setColor(0xd4af37)
      .setFooter({ text: `ID: ${s.id} • Edited by Admin ${interaction.user.username}` });

    await interaction.reply({ embeds: [embed] });
    return;
  }
}
