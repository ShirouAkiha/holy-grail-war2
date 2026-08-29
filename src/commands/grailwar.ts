import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  ComponentType
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { DistrictId, WarDistrict, HolyGrailWarSession } from '../types';
import { createHolyGrailWarSession, executeWarAction, advanceWarRound } from '../engine/grailwar';

export const data = new SlashCommandBuilder()
  .setName('grailwar')
  .setDescription('Holy Grail War 7-Master Battle Royale operations')
  .addSubcommand(sub =>
    sub
      .setName('status')
      .setDescription('View current Holy Grail War battlefield map, districts, and Masters')
  )
  .addSubcommand(sub =>
    sub
      .setName('scout')
      .setDescription('Scout a Fuyuki City district to locate rival Masters (Costs 20 AP)')
      .addStringOption(opt =>
        opt
          .setName('district')
          .setDescription('Target district to scout')
          .setRequired(false)
          .addChoices(
            { name: 'Fuyuki Church (Command Seal Leyline)', value: 'fuyuki_church' },
            { name: 'Shinto Bridge (Agility Corridor)', value: 'shinto_bridge' },
            { name: 'Ryuudou Temple (Mana Surge)', value: 'ryuudou_temple' },
            { name: 'Homurahara Academy (Defensive Ward)', value: 'homurahara_academy' },
            { name: 'Fuyuki Docks (Critical Sanctuary)', value: 'docks' },
            { name: 'Einzbern Forest (Ancient Sanctum)', value: 'einzenbern_forest' },
            { name: 'Commercial District (Urban Hub)', value: 'commercial_district' }
          )
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('fortify')
      .setDescription('Fortify your current district leyline for tactical buffs (Costs 25 AP)')
  )
  .addSubcommand(sub =>
    sub
      .setName('rest')
      .setDescription('Rest at a safehouse to recover Servant HP and AP (Costs 15 AP)')
  );

// Global active Grail War session for Discord
let activeSession: HolyGrailWarSession | null = null;

function getOrInitWarSession(master: any): HolyGrailWarSession {
  const activeServant =
    master.servants?.find((s: any) => s.id === master.activeServantId) || master.servants?.[0];

  if (!activeSession) {
    activeSession = createHolyGrailWarSession({
      discordId: master.discordId,
      username: master.username,
      servantId: activeServant?.id || 'servant_artoria',
      servantName: activeServant?.template?.name || 'Artoria Pendragon',
      avatarUrl: activeServant?.template?.avatarUrl || '',
      maxHp: activeServant?.template?.baseHp || 15000
    });
  } else {
    // Ensure this master is registered as a participant
    if (!activeSession.participants[master.discordId] && activeServant) {
      activeSession.participants[master.discordId] = {
        discordId: master.discordId,
        username: master.username,
        servantId: activeServant.id,
        servantName: activeServant.template.name,
        servantClass: activeServant.template.servantClass,
        avatarUrl: activeServant.template.avatarUrl,
        currentHp: activeServant.template.baseHp || 15000,
        maxHp: activeServant.template.baseHp || 15000,
        commandSeals: master.commandSeals || 3,
        isAlive: true,
        currentDistrict: 'homurahara_academy',
        ap: master.actionPoints || 100,
        kills: 0
      };
    }
  }

  return activeSession;
}

function buildWarEmbed(war: HolyGrailWarSession, userParticipant: any, lastMsg?: string) {
  const aliveParticipants = Object.values(war.participants).filter(p => p.isAlive);

  const districtList = Object.values(war.districts)
    .slice(0, 5)
    .map(d => {
      const controller = d.controllingMasterId
        ? war.participants[d.controllingMasterId]?.username || 'Unknown'
        : 'Neutral';
      return `• **${d.name}** [${controller}] — *${d.leylineBonus}*`;
    })
    .join('\n');

  const embed = new EmbedBuilder()
    .setTitle(`🏰 FUYUKI HOLY GRAIL WAR — ROUND ${war.currentRound}/${war.maxRounds}`)
    .setDescription(
      `**Status:** ${war.status.toUpperCase()} | **Alive Masters:** **${aliveParticipants.length}/7**\n` +
      (userParticipant
        ? `\n👤 **Your Master Status:**\n` +
          `• Servant: **${userParticipant.servantName}** (${userParticipant.servantClass})\n` +
          `• District: **${(war.districts as Record<string, any>)[userParticipant.currentDistrict]?.name || userParticipant.currentDistrict}**\n` +
          `• AP: **${userParticipant.ap}/100** | Command Seals: **${userParticipant.commandSeals}/3** | Kills: **${userParticipant.kills}**\n\n`
        : '\n') +
      (lastMsg ? `📢 **Latest Intel:**\n${lastMsg}\n\n` : '') +
      `📍 **Key Districts & Leylines:**\n${districtList}\n\n` +
      `*Choose a tactical command below:*`
    )
    .setColor(0xd4af37);

  return embed;
}

function buildWarButtons(userParticipant: any) {
  const ap = userParticipant?.ap || 0;

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('war_scout')
      .setLabel('Scout District (20 AP)')
      .setEmoji('🔍')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(ap < 20),
    new ButtonBuilder()
      .setCustomId('war_fortify')
      .setLabel('Fortify Leyline (25 AP)')
      .setEmoji('🛡️')
      .setStyle(ButtonStyle.Success)
      .setDisabled(ap < 25),
    new ButtonBuilder()
      .setCustomId('war_rest')
      .setLabel('Rest & Heal (15 AP)')
      .setEmoji('☕')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(ap < 15),
    new ButtonBuilder()
      .setCustomId('war_advance')
      .setLabel('Advance Round')
      .setEmoji('⏩')
      .setStyle(ButtonStyle.Danger)
  );
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);

    if (!master.servants || master.servants.length === 0) {
      await interaction.reply({
        ephemeral: true,
        content: '❌ You cannot enter the Holy Grail War without a contracted Servant! Use `/summon` first.'
      });
      return;
    }

    const war = getOrInitWarSession(master);
    const userParticipant = war.participants[interaction.user.id];

    const subcommand = interaction.options.getSubcommand();
    let initialMsg = '';

    if (subcommand === 'scout') {
      const targetDistrict = (interaction.options.getString('district') as DistrictId) || 'ryuudou_temple';
      const res = executeWarAction(war, interaction.user.id, 'scout', targetDistrict);
      initialMsg = res.message;
      master.actionPoints = userParticipant.ap;
      await saveMaster(master);
    } else if (subcommand === 'fortify') {
      const res = executeWarAction(war, interaction.user.id, 'fortify_leyline');
      initialMsg = res.message;
      master.actionPoints = userParticipant.ap;
      await saveMaster(master);
    } else if (subcommand === 'rest') {
      const res = executeWarAction(war, interaction.user.id, 'rest_and_heal');
      initialMsg = res.message;
      master.actionPoints = userParticipant.ap;
      await saveMaster(master);
    }

    const embed = buildWarEmbed(war, userParticipant, initialMsg);
    const row = buildWarButtons(userParticipant);

    const reply = await interaction.reply({
      embeds: [embed],
      components: [row],
      fetchReply: true
    });

    setupWarCollector(reply, interaction.user.id);

  } catch (error: any) {
    console.error('Error executing /grailwar:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: `❌ Error: ${error.message}`, ephemeral: true });
    } else {
      await interaction.reply({ content: `❌ Error: ${error.message}`, ephemeral: true });
    }
  }
}

function setupWarCollector(message: any, userId: string) {
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120000
  });

  collector.on('collect', async (i: any) => {
    if (i.user.id !== userId) {
      await i.reply({ content: 'Only the Master who issued this war command can control these actions.', ephemeral: true });
      return;
    }

    try {
      const master = await getOrCreateMaster(i.user.id, i.user.username);
      const war = getOrInitWarSession(master);
      let actionResultMsg = '';

      if (i.customId === 'war_scout') {
        const districts: DistrictId[] = ['fuyuki_church', 'shinto_bridge', 'ryuudou_temple', 'homurahara_academy', 'docks', 'einzenbern_forest'];
        const randomDistrict = districts[Math.floor(Math.random() * districts.length)];
        const res = executeWarAction(war, i.user.id, 'scout', randomDistrict);
        actionResultMsg = res.message;
      } else if (i.customId === 'war_fortify') {
        const res = executeWarAction(war, i.user.id, 'fortify_leyline');
        actionResultMsg = res.message;
      } else if (i.customId === 'war_rest') {
        const res = executeWarAction(war, i.user.id, 'rest_and_heal');
        actionResultMsg = res.message;
      } else if (i.customId === 'war_advance') {
        activeSession = advanceWarRound(war);
        actionResultMsg = `⏩ Advanced to Round ${activeSession.currentRound}/${activeSession.maxRounds}! AP recovered +60 for all surviving Masters.`;
      }

      const userParticipant = war.participants[i.user.id];
      if (userParticipant) {
        master.actionPoints = userParticipant.ap;
        await saveMaster(master);
      }

      const updatedEmbed = buildWarEmbed(war, userParticipant, actionResultMsg);
      const updatedRow = buildWarButtons(userParticipant);

      await i.update({ embeds: [updatedEmbed], components: [updatedRow] });
    } catch (err: any) {
      console.error('Error in grail war collector:', err);
    }
  });
}
