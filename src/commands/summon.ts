import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  ComponentType
} from 'discord.js';
import { 
  getOrCreateMaster, 
  saveMaster, 
  getAvailableThroneServants, 
  getAllThroneServants,
  getContractedServantTemplateIds
} from '../database/service';
import { MasterServantInstance, ServantTemplate } from '../types';
import { getOrInitWarSession } from '../engine/grailwar';

// ==========================================
// 1. SLASH COMMAND DEFINITION
// ==========================================
// In an authentic Holy Grail War, summoning is not a gacha lottery:
// - A Master performs the summoning ritual to call an available Heroic Spirit from the Throne of Heroes.
// - Each Servant can only be summoned ONCE across the entire War (unique contract).
// - Each Master may only hold ONE active Servant contract at a time.
export const data = new SlashCommandBuilder()
  .setName('summon')
  .setDescription('Perform the Holy Grail Summoning Ritual to contract a Heroic Spirit')
  .addSubcommand(sub =>
    sub
      .setName('ritual')
      .setDescription('Draw the magic circle and summon a random available Servant from the Throne of Heroes')
  )
  .addSubcommand(sub =>
    sub
      .setName('status')
      .setDescription('Inspect your active Holy Grail War Servant contract and Command Seals')
  )
  .addSubcommand(sub =>
    sub
      .setName('release')
      .setDescription('Sever your contract with your current Servant to allow a new summoning')
  );

// ==========================================
// 2. HOLY GRAIL WAR SUMMONING RITUAL LOGIC
// ==========================================
function performSummoningRitual(master: any) {
  // Guard 1: Master already has a contracted Servant
  if (master.servants && master.servants.length > 0) {
    const existing = master.servants.find((s: any) => s.id === master.activeServantId) || master.servants[0];
    return {
      alreadyContracted: true,
      servant: existing
    };
  }

  // Guard 2: Get available unclaimed Heroic Spirits
  const availablePool = getAvailableThroneServants();

  if (availablePool.length === 0) {
    return {
      noServantsLeft: true
    };
  }

  // Pick ONE random unclaimed Heroic Spirit from the Throne of Heroes
  const selectedTemplate: ServantTemplate = availablePool[Math.floor(Math.random() * availablePool.length)];

  // Form the sacred contract
  const newServantInstance: MasterServantInstance = {
    id: `contract_${selectedTemplate.id}_${Date.now()}`,
    masterId: master.id,
    templateId: selectedTemplate.id,
    level: 1,
    experience: 0,
    allocatedStats: { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 },
    availableStatPoints: 10,
    skillLevels: [1, 1, 1],
    customQuotes: {
      summon: selectedTemplate.summonQuote,
      battleStart: selectedTemplate.battleStartQuote,
      noblePhantasm: selectedTemplate.noblePhantasm.chant,
      victory: selectedTemplate.victoryQuote,
      defeat: selectedTemplate.defeatQuote
    },
    bondLevel: 1,
    template: selectedTemplate
  };

  // Bind contract to Master
  master.servants = [newServantInstance];
  master.activeServantId = newServantInstance.id;
  master.commandSeals = 3; // Bestow the 3 sacred Command Seals

  return {
    success: true,
    servant: newServantInstance,
    template: selectedTemplate
  };
}

// ==========================================
// 3. COMMAND EXECUTION HANDLER
// ==========================================
export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const subcommand = interaction.options.getSubcommand(false) || 'ritual';

    // Check if the Master is deceased/eliminated in the active Holy Grail War
    const warSession = getOrInitWarSession(master);
    const participant = warSession.participants[master.discordId] || 
      Object.values(warSession.participants).find(p => p.username.toLowerCase() === master.username.toLowerCase());

    if (participant && !participant.isAlive && subcommand !== 'status') {
      const deceasedEmbed = new EmbedBuilder()
        .setTitle('☠️ SACRED SUMMONING REJECTED — MASTER IS DECEASED')
        .setDescription(
          `**The Greater Grail rejects your invocation.**\n\n` +
          `Master **${master.username}**, you were dealt a fatal strike and **PERMANENTLY ELIMINATED** from the Holy Grail War.\n\n` +
          `• **Command Seals:** 💀 **0 / 3** (Extinguished)\n` +
          `• **Status:** **💀 Deceased / Eliminated**\n\n` +
          `*In the Fuyuki Holy Grail War, fallen Masters cannot summon a new Servant or re-enter the ongoing tournament. You must wait for the war to conclude or restart the tournament session.*`
        )
        .setColor(0xef4444);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('quick_war_status')
          .setLabel('View Intelligence Board (/grailwar)')
          .setEmoji('📋')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('war_reset_tournament')
          .setLabel('Restart Tournament (/grailwar reset)')
          .setEmoji('🔄')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({ embeds: [deceasedEmbed], components: [row] });
      return;
    }

    // ------------------------------------------
    // SUBCOMMAND: STATUS
    // ------------------------------------------
    if (subcommand === 'status') {
      const activeServant = master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];

      if (!activeServant) {
        const emptyEmbed = new EmbedBuilder()
          .setTitle('🕯️ No Active Servant Contract')
          .setDescription(
            `You have not formed a contract with any Heroic Spirit yet.\n\n` +
            `Use \`/summon ritual\` to draw the summoning circle and call forth your Servant for the Holy Grail War!`
          )
          .setColor(0x3b82f6);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('btn_perform_ritual')
            .setLabel('Begin Summoning Ritual')
            .setEmoji('✨')
            .setStyle(ButtonStyle.Primary)
        );

        const reply = await interaction.reply({ embeds: [emptyEmbed], components: [row], withResponse: true })
          .then(r => r.resource?.message || interaction.fetchReply());
        setupSummonButtonCollector(reply, interaction.user.id);
        return;
      }

      const sAny = activeServant as any;
      const t = sAny.template || sAny;
      const sName = sAny.nickname || t.name || sAny.name || 'HEROIC SPIRIT';
      const sClass = t.servantClass || sAny.servantClass || sAny.class || 'Saber';
      const sTitle = t.title || sAny.title || 'Heroic Spirit';
      const baseHp = t.baseHp || sAny.baseHp || 12000;
      const baseAtk = t.baseAtk || sAny.baseAtk || 10000;
      const np = t.noblePhantasm || sAny.noblePhantasm || { name: 'Excalibur', cardType: 'Buster', chant: 'Sword of Promised Victory' };
      const baseStats = t.baseStats || { strength: 10, endurance: 10, agility: 10, mana: 10, luck: 10 };
      const alloc = activeServant.allocatedStats || {};
      const totalStr = (baseStats.strength || 10) + (alloc.strength || 0);
      const totalEnd = (baseStats.endurance || 10) + (alloc.endurance || 0);
      const ceAtk = activeServant.equippedCe?.atkBonus || 0;
      const ceHp = activeServant.equippedCe?.hpBonus || 0;
      const lvl = activeServant.level || 1;

      const calcHp = Math.round(baseHp * (1 + (lvl - 1) * 0.05) + totalEnd * 150 + ceHp);
      const calcAtk = Math.round(baseAtk * (1 + (lvl - 1) * 0.05) + totalStr * 80 + ceAtk);

      const statusEmbed = new EmbedBuilder()
        .setTitle(`📜 HOLY GRAIL WAR CONTRACT: ${sName.toUpperCase()}`)
        .setDescription(
          `**Master:** <@${interaction.user.id}> (${master.username})\n` +
          `**Class:** \`${sClass}\` | **Title:** *${sTitle}*\n` +
          `**Command Seals:** 🔴🔴🔴 **${master.commandSeals}/3**\n` +
          `**Action Points (AP):** **${master.actionPoints || 100}/100**\n\n` +
          `⚔️ **Combat Parameters:**\n` +
          `• HP: \`${calcHp.toLocaleString()}\`\n` +
          `• ATK: \`${calcAtk.toLocaleString()}\`\n` +
          `• Available Parameter Points: **${activeServant.availableStatPoints || 0}** (Use \`/customise stats\`)\n\n` +
          `💥 **Noble Phantasm:** **${np.name}** [${np.cardType}]\n` +
          `* "${activeServant.customQuotes?.noblePhantasm || np.chant}" *\n\n` +
          `💬 **Arrival Quote:**\n*"${activeServant.customQuotes?.summon || t.summonQuote || 'I ask of you, are you my Master?'}"*`
        )
        .setImage(t.cardArtUrl || t.avatarUrl || sAny.cardArtUrl || sAny.avatarUrl)
        .setColor(0xd4af37);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_release_contract')
          .setLabel('Sever Contract')
          .setEmoji('⛓️')
          .setStyle(ButtonStyle.Danger)
      );

      const reply = await interaction.reply({ embeds: [statusEmbed], components: [row], withResponse: true })
        .then(r => r.resource?.message || interaction.fetchReply());
      setupSummonButtonCollector(reply, interaction.user.id);
      return;
    }

    // ------------------------------------------
    // SUBCOMMAND: RELEASE CONTRACT
    // ------------------------------------------
    if (subcommand === 'release') {
      if (!master.servants || master.servants.length === 0) {
        await interaction.reply({
          ephemeral: true,
          content: '❌ You do not have an active Servant contract to release.'
        });
        return;
      }

      const releasedServantName = master.servants[0].template.name;
      master.servants = [];
      master.activeServantId = undefined;
      await saveMaster(master);

      const releaseEmbed = new EmbedBuilder()
        .setTitle('⛓️ Contract Severed')
        .setDescription(
          `You have released your command over **${releasedServantName}**.\n\n` +
          `The Heroic Spirit has returned to the Throne of Heroes. You are now free to invoke a new summoning ritual using \`/summon ritual\`.`
        )
        .setColor(0xef4444);

      await interaction.reply({ embeds: [releaseEmbed] });
      return;
    }

    // ------------------------------------------
    // SUBCOMMAND: RITUAL (Summon Once Randomly)
    // ------------------------------------------
    const result = performSummoningRitual(master);

    // Case A: Master already has a Servant
    if (result.alreadyContracted) {
      const s = result.servant;
      const embed = new EmbedBuilder()
        .setTitle('⚠️ Sacred Contract Already Bound')
        .setDescription(
          `You have already formed a Holy Grail War contract with **${s.template.name}** (\`${s.template.servantClass}\`)!\n\n` +
          `In an authentic Holy Grail War, each Master is bound to a single Heroic Spirit.\n\n` +
          `• Use \`/servant\` to view their full status and parameters.\n` +
          `• Use \`/duel\` to engage in turn-based combat.\n` +
          `• Use \`/grailwar\` to enter the 7-Master battle royale tournament.\n` +
          `• If you wish to release your Servant and summon anew, use \`/summon release\`.`
        )
        .setThumbnail(s.template.avatarUrl)
        .setColor(0xf59e0b);

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // Case B: No available Servants left in the Throne
    if (result.noServantsLeft) {
      const allThrone = getAllThroneServants();
      const embed = new EmbedBuilder()
        .setTitle('🚫 The Throne of Heroes is Fully Manifested')
        .setDescription(
          `All **${allThrone.length} Heroic Spirits** in the Throne of Heroes are currently contracted to other Masters across Fuyuki City!\n\n` +
          `No more Servants can be summoned until a contracted Servant is defeated or released.\n\n` +
          `*(Admins can add new custom Heroic Spirits using \`/addservant create\`)*`
        )
        .setColor(0xef4444);

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // Case C: Successful Summoning Ritual
    await saveMaster(master);
    const template = result.template!;
    const newServant = result.servant!;

    const incantation = 
      `*“Let silver and iron be the essence. Let stone and the archduke of contracts be the foundation.”*\n` +
      `*“Let the flowing great river be created, and the four corners be filled.”*\n` +
      `*“Let the order of the Holy Grail be fulfilled!”*`;

    const summonEmbed = new EmbedBuilder()
      .setTitle(`✨ HEROIC SPIRIT SUMMONED: ${template.name.toUpperCase()}`)
      .setDescription(
        `${incantation}\n\n` +
        `═══════════════════════════════════\n` +
        `🗣️ **"${newServant.customQuotes?.summon || template.summonQuote}"**\n` +
        `═══════════════════════════════════\n\n` +
        `👤 **True Name:** **${template.name}**\n` +
        `🗡️ **Class:** \`${template.servantClass}\` | **Title:** *${template.title}*\n` +
        `🔴 **Command Seals Bestowed:** **3 / 3**\n\n` +
        `📊 **Base Parameters:**\n` +
        `• **HP:** \`${template.baseHp.toLocaleString()}\` | **ATK:** \`${template.baseAtk.toLocaleString()}\`\n` +
        `• **STR:** \`${template.baseStats.strength}\` | **END:** \`${template.baseStats.endurance}\` | **AGI:** \`${template.baseStats.agility}\` | **MNA:** \`${template.baseStats.mana}\` | **LCK:** \`${template.baseStats.luck}\`\n\n` +
        `💥 **Noble Phantasm:** **${template.noblePhantasm.name}** [${template.noblePhantasm.cardType}]\n` +
        `* "${template.noblePhantasm.chant}" *\n\n` +
        `📜 **Lore:**\n${template.lore}`
      )
      .setImage(template.cardArtUrl || template.avatarUrl)
      .setColor(0xd4af37)
      .setFooter({ text: `Holy Grail War Contract Active • Use /servant or /duel` });

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_view_servant')
        .setLabel('View Parameters (/servant)')
        .setEmoji('📊')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('btn_enter_war')
        .setLabel('Enter Grail War (/grailwar)')
        .setEmoji('🏰')
        .setStyle(ButtonStyle.Success)
    );

    const reply = await interaction.reply({
      embeds: [summonEmbed],
      components: [actionRow],
      withResponse: true
    }).then(r => r.resource?.message || interaction.fetchReply());

    setupSummonButtonCollector(reply, interaction.user.id);

  } catch (error: any) {
    console.error('Error executing /summon ritual:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: `❌ Ritual Error: ${error.message}`, ephemeral: true });
    } else {
      await interaction.reply({ content: `❌ Ritual Error: ${error.message}`, ephemeral: true });
    }
  }
}

// ==========================================
// 4. BUTTON COLLECTOR FOR SUMMON EMBED
// ==========================================
function setupSummonButtonCollector(message: any, userId: string) {
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120000 // 2 minutes
  });

  collector.on('collect', async (i: any) => {
    if (i.replied || i.deferred) return;
    if (i.user.id !== userId) {
      await i.reply({ content: 'Only the Master who performed this ritual can click these actions.', ephemeral: true });
      return;
    }

    try {
      const master = await getOrCreateMaster(i.user.id, i.user.username);

      if (i.customId === 'btn_release_contract') {
        if (!master.servants || master.servants.length === 0) {
          await i.reply({ content: 'You have no active Servant contract to release.', ephemeral: true });
          return;
        }
        const sName = master.servants[0].template.name;
        master.servants = [];
        master.activeServantId = undefined;
        await saveMaster(master);

        await i.update({
          embeds: [
            new EmbedBuilder()
              .setTitle('⛓️ Contract Severed')
              .setDescription(`You have released **${sName}**. Use \`/summon ritual\` to summon a new Heroic Spirit.`)
              .setColor(0xef4444)
          ],
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId('btn_perform_ritual')
                .setLabel('Begin New Ritual')
                .setEmoji('✨')
                .setStyle(ButtonStyle.Primary)
            )
          ]
        });
        return;
      }

      if (i.customId === 'btn_perform_ritual') {
        const result = performSummoningRitual(master);
        if (result.success && result.template) {
          await saveMaster(master);
          const t = result.template;
          await i.update({
            embeds: [
              new EmbedBuilder()
                .setTitle(`✨ HEROIC SPIRIT SUMMONED: ${t.name.toUpperCase()}`)
                .setDescription(
                  `🗣️ **"${t.summonQuote}"**\n\n` +
                  `• **True Name:** **${t.name}** [${t.servantClass}]\n` +
                  `• **Noble Phantasm:** **${t.noblePhantasm.name}**\n` +
                  `• **Command Seals:** 3 / 3\n\n` +
                  `Contract established for the Holy Grail War!`
                )
                .setImage(t.cardArtUrl || t.avatarUrl)
                .setColor(0xd4af37)
            ],
            components: []
          });
        }
        return;
      }

      if (i.customId === 'btn_view_servant') {
        await i.reply({ content: 'Use `/servant` to view your detailed 2D status card and parameter radar.', ephemeral: true });
        return;
      }

      if (i.customId === 'btn_enter_war') {
        await i.reply({ content: 'Use `/grailwar` to check Holy Grail War tournament standings and challenge rivals.', ephemeral: true });
        return;
      }
    } catch (err: any) {
      if (err.code === 10062 || err.message?.includes('Unknown interaction')) return;
      console.error('Error in summon collector:', err);
    }
  });
}
