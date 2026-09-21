import { 
  Client, 
  TextChannel, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ButtonInteraction, 
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  MessageFlags, 
  User,
  PermissionFlagsBits,
  AttachmentBuilder
} from 'discord.js';
import { 
  HolyGrailWarSession, 
  WarRecruitmentCall, 
  MasterProfile 
} from '../types';
import { 
  getOrInitWarSession, 
  saveWarToDisk, 
  WAR_PRESETS,
  startOrRestartWar
} from './grailwar';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { renderHolyGrailWarAwakeningCard } from '../canvas/renderer';
import { SERVANT_DATABASE, getServantSprite, getServantAvatarAndCardArt } from '../data/servants';

// In-memory active timer handle
let activeRecruitmentTimer: NodeJS.Timeout | null = null;

const GRAIL_ANNOUNCEMENT_IMAGE = 'https://ella.janitorai.com/media-approved/mK-ekdLeM4n1Wb-_vRN4L.webp';

/**
 * Builds the public Church announcement embed for the Holy Grail War recruitment call.
 * CRITICAL RULE: Absolutely NO Master or Servant identities are displayed!
 */
export function buildRecruitmentEmbed(
  recruitment: WarRecruitmentCall,
  warSession: HolyGrailWarSession
): { embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> } {
  const preset = WAR_PRESETS[recruitment.presetKey] || WAR_PRESETS.fuyuki_7;
  const applicantCount = recruitment.applicantIds.length;
  const maxSlots = recruitment.maxSlots || 7;

  const now = Date.now();
  let timerText = 
    '⚡ **Continuous Inscription Active:** Open until the Church Overseer commands ritual ignition.\n' +
    '🕯️ **Sanctuary State:** Fuyuki leyline circuits are primed and receptive for Command Seals.';
  
  if (recruitment.expiresAt > 0) {
    const unixSec = Math.floor(recruitment.expiresAt / 1000);
    if (recruitment.expiresAt > now) {
      timerText = 
        `⏳ **Ignition Window:** <t:${unixSec}:R> (<t:${unixSec}:f>)\n` +
        `⚡ **Leyline Resonance:** Approaching critical saturation point. The veil between reality and the Throne of Heroes thins.`;
    } else {
      timerText = `⏱️ **Leylines Saturated:** Countdown concluded. The Church Overseer is invoking the final seal...`;
    }
  }

  // Visual capacity progress bar
  const ratio = Math.min(1, Math.max(0, maxSlots > 0 ? applicantCount / maxSlots : 0));
  const filledBars = Math.round(ratio * 8);
  const emptyBars = 8 - filledBars;
  const progressBar = '`[' + '▓'.repeat(filledBars) + '░'.repeat(emptyBars) + ']`';

  let capacityNotice = '';
  if (applicantCount >= maxSlots) {
    capacityNotice = `🔴 **CAPACITY SATURATED** — *The Greater Grail shall invoke the Arbitrament Draw upon ignition!*`;
  } else if (applicantCount === 0) {
    capacityNotice = `⚪ **VACANT THRONES** — *Awaiting the first soul to step forward into covenant.*`;
  } else {
    const remaining = maxSlots - applicantCount;
    capacityNotice = `🟡 **${remaining} Seat${remaining === 1 ? '' : 's'} Remaining** before selection draw threshold.`;
  }

  const embed = new EmbedBuilder()
    .setAuthor({
      name: '⛪ FUYUKI CHURCH • EIGHTH SACRAMENT OVERSEER OFFICE',
      iconURL: GRAIL_ANNOUNCEMENT_IMAGE
    })
    .setTitle('🩸 HEAVEN\'S FEEL: RITUAL PROCLAMATION OF THE GREATER GRAIL')
    .setDescription(
      `*"Rejoice, Magi of this era. The sixty-year slumber dissolves beneath Mount Enzo. The Great Leylines of Fuyuki convulse with untamed ether, and the Root of All Creation beckons once more.*\n\n` +
      `*Seven Thrones of legend descend from the Throne of Heroes. Seven Heroic Spirits shall answer the summoner's call. Inscribe your Command Seals in shadow, cast your ambitions into the crucible of Heaven's Feel, and claim the omnipotent Wish-Granting Chalice.*\n\n` +
      `*Only one wish shall be granted. Only one shall survive the crucible."*\n\n` +
      `— **Father Kirei Kotomine**, Arbitrator & Overseer of the Fuyuki Holy Grail War`
    )
    .setColor(0x991b1b) // Ominous Deep Crimson
    .addFields(
      {
        name: '⏳ RITUAL COUNTDOWN & IGNITION HORIZON',
        value: timerText,
        inline: false
      },
      {
        name: '📜 THE SACRED ROSTER OF COVENANT',
        value: 
          `👥 **Inscribed Aspirants:** **${applicantCount} Magi** have etched their souls onto the roster\n` +
          `🎯 **Ritual Architecture:** **${maxSlots} Master Seats** (${preset.formatName})\n` +
          `📊 **Leyline Saturation:** ${progressBar} **${applicantCount}/${maxSlots}**\n` +
          `🩸 **Threshold State:** ${capacityNotice}`,
        inline: false
      },
      {
        name: '🛡️ SOVEREIGN DECREE OF SECRECY & SACRED EDICTS',
        value: 
          `• 🕶️ **Absolute Anonymity:** Master and Servant identities remain strictly cloaked under Holy Church thaumaturgical seals. No public registry shall be unveiled.\n` +
          `• 🎲 **The Chalice's Arbitrament:** Should inscriptions exceed **${maxSlots} Candidates**, the Greater Grail itself impartially selects the **${maxSlots} Destined Masters** upon ignition.\n` +
          `• 📬 **Telepathic Dispatch (DM):** Anointed Masters receive their confidential war codex, combat interface, and awakened Command Seals via private message directly.\n` +
          `• 🕊️ **Inviolable Sanctuary:** Those unchosen or choosing to withdraw dwell safely under Church protection in **Safe Mode**, free from all Holy Grail War combat.`,
        inline: false
      }
    )
    .setImage(GRAIL_ANNOUNCEMENT_IMAGE)
    .setFooter({ 
      text: `Overseer: ${recruitment.initiatedBy} • Inscribe below to answer the summons • Sanctuary guaranteed to the peaceful` 
    })
    .setTimestamp();

  const inscribeBtn = new ButtonBuilder()
    .setCustomId('war_call_inscribe')
    .setLabel(`⚔️ Inscribe Command Seals (${applicantCount})`)
    .setStyle(ButtonStyle.Primary);

  const withdrawBtn = new ButtonBuilder()
    .setCustomId('war_call_withdraw')
    .setLabel('🛡️ Withdraw to Sanctuary')
    .setStyle(ButtonStyle.Secondary);

  const forceStartBtn = new ButtonBuilder()
    .setCustomId('war_call_force')
    .setLabel('⚡ Force Start Ritual (Admin)')
    .setStyle(ButtonStyle.Danger);

  const cancelBtn = new ButtonBuilder()
    .setCustomId('war_call_cancel')
    .setLabel('❌ Cancel Call (Admin)')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    inscribeBtn,
    withdrawBtn,
    forceStartBtn,
    cancelBtn
  );

  return { embed, row };
}

/**
 * Initiates a new Holy Grail War recruitment drive with countdown and anonymous registry.
 */
export async function startWarRecruitment(
  client: Client,
  channel: TextChannel | any,
  adminUser: User,
  options: {
    durationMinutes: number;
    maxSlots: number;
    presetKey?: string;
    forceRestart?: boolean;
  }
): Promise<{ success: boolean; message: string; recruitment?: WarRecruitmentCall }> {
  const war = getOrInitWarSession();

  // Check if an existing recruitment is already active
  if (war.recruitmentCall && war.recruitmentCall.active) {
    if (!options.forceRestart) {
      const activeCh = war.recruitmentCall.channelId ? `<#${war.recruitmentCall.channelId}>` : 'another channel';
      return {
        success: false,
        message: `An active Holy Grail War recruitment is already underway in ${activeCh} with **${war.recruitmentCall.applicantIds.length} Magi** registered.\nPlease cancel or ignite the current recruitment first, or select 'Replace & Broadcast' to supersede it.`
      };
    }

    // Cleanly cancel and strip components from the old announcement message before creating a new one
    await cancelRecruitmentCall(client, adminUser.username);
  }

  const presetKey = options.presetKey || 'fuyuki_7';
  const durationMs = options.durationMinutes > 0 ? options.durationMinutes * 60 * 1000 : 0;
  const startedAt = Date.now();
  const expiresAt = durationMs > 0 ? startedAt + durationMs : 0;

  const recruitment: WarRecruitmentCall = {
    id: `recruitment_${Date.now()}`,
    active: true,
    channelId: channel.id,
    guildId: channel.guild?.id,
    startedAt,
    expiresAt,
    durationMinutes: options.durationMinutes,
    maxSlots: options.maxSlots || 7,
    presetKey,
    applicantIds: [],
    initiatedBy: adminUser.username,
    initiatedById: adminUser.id
  };

  war.recruitmentCall = recruitment;
  saveWarToDisk();

  const { embed, row } = buildRecruitmentEmbed(recruitment, war);

  let sentMsg: any = null;
  try {
    sentMsg = await channel.send({
      embeds: [embed],
      components: [row]
    });
    recruitment.messageId = sentMsg.id;
    saveWarToDisk();
  } catch (err: any) {
    console.error('Failed to post Grail War recruitment announcement:', err);
    return { success: false, message: `Failed to dispatch Church announcement: ${err.message}` };
  }

  // Clear existing timer if any
  if (activeRecruitmentTimer) {
    clearTimeout(activeRecruitmentTimer);
    activeRecruitmentTimer = null;
  }

  // Schedule automatic ignition when countdown finishes
  if (expiresAt > 0) {
    const delay = Math.max(1000, expiresAt - Date.now());
    activeRecruitmentTimer = setTimeout(async () => {
      try {
        await igniteWarFromRecruitment(client, war);
      } catch (err) {
        console.error('Error during auto-ignition of Grail War from recruitment:', err);
      }
    }, delay);
  }

  return {
    success: true,
    message: `📢 **Holy Grail War Recruitment Proclamation Issued!**\n\n• **Duration:** ${options.durationMinutes > 0 ? `${options.durationMinutes} minutes` : 'Indefinite (Manual Start)'}\n• **Capacity Limit:** **${recruitment.maxSlots} Masters**\n• **Format:** ${WAR_PRESETS[presetKey]?.formatName || 'Canonical 5th Fuyuki War'}\n• **Channel:** <#${channel.id}>`,
    recruitment
  };
}

/**
 * Cleanly cancels any active Holy Grail War recruitment call and strips interactive components from the message.
 */
export async function cancelRecruitmentCall(
  client: Client,
  cancelledBy?: string
): Promise<{ success: boolean; message: string }> {
  const war = getOrInitWarSession();
  const recruitment = war.recruitmentCall;

  if (!recruitment || !recruitment.active) {
    return { success: false, message: 'No active Holy Grail War recruitment call found.' };
  }

  const oldChannelId = recruitment.channelId;
  const oldMessageId = recruitment.messageId;

  recruitment.active = false;
  war.recruitmentCall = undefined;
  saveWarToDisk();

  if (activeRecruitmentTimer) {
    clearTimeout(activeRecruitmentTimer);
    activeRecruitmentTimer = null;
  }

  // Update previous announcement embed to CANCELLED and remove all buttons
  if (oldMessageId && oldChannelId && client) {
    try {
      const channel: any = await client.channels.fetch(oldChannelId).catch(() => null);
      if (channel && typeof channel.messages?.fetch === 'function') {
        const msg = await channel.messages.fetch(oldMessageId).catch(() => null);
        if (msg) {
          const cancelEmbed = new EmbedBuilder()
            .setTitle('❌ FUYUKI CHURCH: GRAIL RECRUITMENT CANCELLED')
            .setDescription(
              `The Holy Grail War recruitment call has been cancelled by Overseer ${cancelledBy ? `**${cancelledBy}**` : 'Father Kotomine'}.\nAll inscribed magi remain in Sanctuary Safe Mode.`
            )
            .setColor(0x64748b)
            .setTimestamp();
          await msg.edit({ embeds: [cancelEmbed], components: [] }).catch(() => null);
        }
      }
    } catch (err) {
      console.warn('Failed to clean up cancelled recruitment message:', err);
    }
  }

  return { success: true, message: '🛑 Holy Grail War recruitment proclamation successfully cancelled.' };
}

/**
 * Handles button and select menu interactions for the recruitment announcement card.
 */
export async function handleRecruitmentInteraction(interaction: any, client: Client): Promise<void> {
  const war = getOrInitWarSession();
  const recruitment = war.recruitmentCall;

  if (!recruitment || !recruitment.active) {
    await interaction.reply({
      content: '⚠️ This Holy Grail War recruitment call is no longer active or has already ignited into battle.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const userId = interaction.user.id;
  const username = interaction.user.username;

  // Initialize applicantServantChoices map if undefined
  if (!recruitment.applicantServantChoices) {
    recruitment.applicantServantChoices = {};
  }

  // CASE 1: Inscribe Command Seals Button Click
  if (interaction.customId === 'war_call_inscribe') {
    const master = await getOrCreateMaster(userId, username);
    if (!master.servants || master.servants.length === 0) {
      await interaction.reply({
        content: '❌ **No Contracted Servant:** You must summon a Heroic Spirit before you can inscribe your soul for the Holy Grail War! Invoke `/gacha servant` or `/summon ritual` first.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // If master has multiple servants in their Chaldea roster, allow picking their champion!
    if (master.servants.length > 1) {
      const servantOptions = master.servants.slice(0, 25).map(s => {
        const sName = s.nickname || s.template?.name || 'Heroic Spirit';
        const sClass = s.template?.servantClass || (s as any).servantClass || 'Saber';
        const npName = s.template?.noblePhantasm?.name || 'Noble Phantasm';
        const isDefault = s.id === (recruitment.applicantServantChoices?.[userId] || master.activeServantId || master.servants[0].id);

        return {
          label: `${sName} (${sClass})`,
          value: s.id,
          description: `Level ${s.level || 1} • NP: ${npName.slice(0, 45)}`,
          emoji: '🗡️',
          default: isDefault
        };
      });

      const selectMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('war_call_select_servant')
          .setPlaceholder('Choose your champion Servant for this War...')
          .addOptions(servantOptions)
      );

      const activeServant = master.servants.find(s => s.id === master.activeServantId) || master.servants[0];
      const activeName = activeServant.nickname || activeServant.template?.name || 'Heroic Spirit';
      const activeClass = activeServant.template?.servantClass || (activeServant as any).servantClass || 'Saber';

      await interaction.reply({
        content:
          `👑 **Choose Your Champion Servant for the Holy Grail War**\n\n` +
          `You hold contracts with **${master.servants.length} Heroic Spirits**.\n` +
          `Currently selected default: **${activeName}** (\`${activeClass}\`)\n\n` +
          `Select the Servant you wish to deploy from the dropdown below to finalize your inscription:`,
        components: [selectMenu],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // Master only has 1 servant
    const singleServant = master.servants[0];
    recruitment.applicantServantChoices[userId] = singleServant.id;

    if (!recruitment.applicantIds.includes(userId)) {
      recruitment.applicantIds.push(userId);
    }
    saveWarToDisk();

    // Update announcement card
    await updateRecruitmentMessage(interaction.channel as any, recruitment, war);

    const sName = singleServant.nickname || singleServant.template?.name || 'Heroic Spirit';
    const sClass = singleServant.template?.servantClass || (singleServant as any).servantClass || 'Saber';

    await interaction.reply({
      content:
        `🔱 **COMMAND SEALS INSCRIBED!**\n\n` +
        `Your soul has been submitted to the Greater Grail's applicant pool with champion **${sName}** (\`${sClass}\`).\n\n` +
        `• 🕶️ **Identity Concealed:** Your name and Servant remain completely confidential.\n` +
        `• 🎲 **Selection Draw:** When the countdown concludes, **${recruitment.maxSlots} Masters** will be chosen randomly.\n` +
        `• 📬 **Telepathic Notice:** If selected, you will receive an immediate private Discord DM with your battle orders!`,
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  // CASE 1.5: Master picked a Servant from the dropdown
  if (interaction.customId === 'war_call_select_servant') {
    const chosenServantId = interaction.values?.[0];
    const master = await getOrCreateMaster(userId, username);
    const chosenServant = master.servants?.find(s => s.id === chosenServantId) || master.servants?.[0];

    if (!chosenServant) {
      await interaction.reply({
        content: '❌ Invalid Servant selection. Please try inscribing again.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    recruitment.applicantServantChoices[userId] = chosenServant.id;
    if (!recruitment.applicantIds.includes(userId)) {
      recruitment.applicantIds.push(userId);
    }
    saveWarToDisk();

    // Update announcement card
    await updateRecruitmentMessage(interaction.channel as any, recruitment, war);

    const sName = chosenServant.nickname || chosenServant.template?.name || 'Heroic Spirit';
    const sClass = chosenServant.template?.servantClass || (chosenServant as any).servantClass || 'Saber';

    await interaction.reply({
      content:
        `🔱 **COMMAND SEALS INSCRIBED WITH ${sName.toUpperCase()}!**\n\n` +
        `You have committed **${sName}** (\`${sClass}\`) as your champion for the upcoming Holy Grail War.\n\n` +
        `• 🕶️ **Identity Concealed:** Your name and Servant remain confidential.\n` +
        `• 🎲 **Selection Draw:** When the timer concludes, **${recruitment.maxSlots} Masters** will be chosen randomly.\n` +
        `• 📬 **Telepathic Notice:** If selected, you will receive an immediate private Discord DM!`,
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  // CASE 2: Withdraw from Inscription
  if (interaction.customId === 'war_call_withdraw') {
    if (!recruitment.applicantIds.includes(userId)) {
      await interaction.reply({
        content: 'ℹ️ You are not currently inscribed in this recruitment pool.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    recruitment.applicantIds = recruitment.applicantIds.filter(id => id !== userId);
    saveWarToDisk();

    // Update announcement card
    await updateRecruitmentMessage(interaction.channel as any, recruitment, war);

    await interaction.reply({
      content: '🕊️ **Withdrawn to Sanctuary:** Your inscription has been removed. You will remain safely in Safe Mode under Church protection.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  // CASE 3: Admin Force Start
  if (interaction.customId === 'war_call_force') {
    const member = interaction.member as any;
    const isAdmin = member?.permissions?.has(PermissionFlagsBits.Administrator) || userId === recruitment.initiatedById;

    if (!isAdmin) {
      await interaction.reply({
        content: '❌ **Authority Denied:** Only Server Administrators or the initiating Church Overseer can force start the ritual.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.reply({
      content: '⚡ **Invoking Ritual Ignition:** Commencing Master selection and awakening the Greater Grail...',
      flags: MessageFlags.Ephemeral
    });

    if (activeRecruitmentTimer) {
      clearTimeout(activeRecruitmentTimer);
      activeRecruitmentTimer = null;
    }

    await igniteWarFromRecruitment(client, war, interaction.channel as any);
    return;
  }

  // CASE 4: Admin Cancel Recruitment
  if (interaction.customId === 'war_call_cancel') {
    const member = interaction.member as any;
    const isAdmin = member?.permissions?.has(PermissionFlagsBits.Administrator) || userId === recruitment.initiatedById;

    if (!isAdmin) {
      await interaction.reply({
        content: '❌ **Authority Denied:** Only Server Administrators can cancel this recruitment call.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    recruitment.active = false;
    war.recruitmentCall = undefined;
    saveWarToDisk();

    if (activeRecruitmentTimer) {
      clearTimeout(activeRecruitmentTimer);
      activeRecruitmentTimer = null;
    }

    const cancelEmbed = new EmbedBuilder()
      .setTitle('❌ FUYUKI CHURCH: GRAIL RECRUITMENT CANCELLED')
      .setDescription(`The Holy Grail War recruitment call has been cancelled by Overseer <@${userId}>. All inscribed magi remain in Sanctuary Safe Mode.`)
      .setColor(0x64748b)
      .setTimestamp();

    if (recruitment.messageId && interaction.channel && typeof (interaction.channel as any).messages?.fetch === 'function') {
      try {
        const msg = await (interaction.channel as any).messages.fetch(recruitment.messageId);
        if (msg) {
          await msg.edit({ embeds: [cancelEmbed], components: [] });
        }
      } catch {}
    }

    await interaction.reply({
      content: '🛑 Recruitment call successfully cancelled.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
}

/**
 * Resolves the character summoning quote for a Servant.
 */
export function resolveServantSummonQuote(servant: any, sName: string, sClass: string): string {
  if (servant?.template?.summonQuote && typeof servant.template.summonQuote === 'string') {
    return servant.template.summonQuote;
  }

  const foundDb = SERVANT_DATABASE.find(
    s => s.id === servant?.templateId || s.id === servant?.id || s.name.toLowerCase() === sName.toLowerCase()
  );
  if (foundDb?.summonQuote) {
    return foundDb.summonQuote;
  }

  // Authentic Class-tailored summon quotes
  const classUpper = (sClass || 'Saber').toUpperCase();
  if (classUpper.includes('SABER')) {
    return 'I ask of you, are you my Master? Upon your summon, I have come to fight by your side.';
  } else if (classUpper.includes('ARCHER')) {
    return 'Servant Archer, responding to your summons. Point me toward the enemy, Master.';
  } else if (classUpper.includes('LANCER')) {
    return 'Servant Lancer. My spear is yours—let us claim the Greater Grail together.';
  } else if (classUpper.includes('CASTER')) {
    return 'Servant Caster. The leyline is primed. Entrust your battlefield strategy to my magecraft.';
  } else if (classUpper.includes('RIDER')) {
    return 'Servant Rider has arrived! Hold on tight, Master, victory waits for no one!';
  } else if (classUpper.includes('ASSASSIN')) {
    return 'Servant Assassin. I dwell in the shadows of the ritual, awaiting your silent command.';
  } else if (classUpper.includes('BERSERKER')) {
    return 'Grrr... RRRRRAAAAGH! (The beast roars, acknowledging the sacred Master covenant.)';
  } else if (classUpper.includes('RULER')) {
    return 'Servant Ruler. I shall ensure this Holy Grail War adheres to sacred divine law.';
  } else if (classUpper.includes('AVENGER')) {
    return 'Servant Avenger. Let us burn down every pretender standing between us and the Grail.';
  }
  return 'I ask of you, are you my Master? Upon your summon, I have answered the call.';
}

/**
 * Returns mode-tailored narrative, styling, directives, and starting territory.
 */
export function getModeDmConfig(presetKey: string, participantIndex: number, totalParticipants: number) {
  switch (presetKey) {
    case 'apocrypha_14': {
      const isBlackFaction = participantIndex % 2 === 0;
      const faction: 'red' | 'black' = isBlackFaction ? 'black' : 'red';
      const factionTitle = isBlackFaction ? '⚫ BLACK FACTION (Yggdmillennia)' : '🔴 RED FACTION (Clock Tower)';
      const startingDistrict = isBlackFaction
        ? 'Trifas Fortress Inner Sanctum (Black Faction Base)'
        : 'Hanging Gardens of Babylon (Red Faction Air Citadel)';
      const startingBonus = isBlackFaction
        ? '🏰 Shared Homunculus Mana Reservoir (+10% Workshop Traps)'
        : '✨ Aerial Bombardment Supremacy (+10% Ambush Initiative)';

      return {
        presetKey,
        title: `⚔️ GREAT HOLY GRAIL WAR: ${factionTitle}`,
        embedColor: isBlackFaction ? 0x7c3aed : 0xd97706,
        headerBadge: '🏛️ CLOCK TOWER & YGGDMILLENNIA • GREAT WAR DISPATCH',
        faction,
        startingDistrict,
        startingBonus,
        intro:
          `You have been anointed as a Master in the **14-Master Great Holy Grail War** representing the **${factionTitle}**!\n\n` +
          `Seven Masters of the Black Faction and seven Masters of the Red Faction clash across the ancient mist-shrouded forests of Trifas for possession of the Greater Grail.`,
        directives: [
          `🚩 **Faction Frontline (</grailwar:1>):** Coordinate with your allied 7 Masters. Shared territory vision and joint mana reservoirs are active.`,
          `⚔️ **Legion Ambushes (</attack:1>):** Ambush enemy faction Magi. Allied Masters in the same district provide defensive interception.`,
          `🏰 **Fortress Defense (</trap:1>):** Fortify your faction stronghold against enemy sieges and infiltration.`,
          `⚖️ **Ruler Divine Mediation:** A neutral Ruler watches over the ritual—flagrant violations draw Divine Judgment.`,
          `🔴 **Command Seal Overdrive:** Consume Command Seals to trigger emergency noble phantasm overcharge or tactical teleports.`
        ],
        footerNote: 'Confidential Great Grail War Dispatch • Coordinate with your Faction'
      };
    }

    case 'singularity_chaos': {
      const singularityDistricts = [
        { name: 'Babylonian Ziggurat High Leylines', bonus: '⚡ +25% Noble Phantasm Gauge Surge' },
        { name: 'Camelot Holy Citadel Outer Gates', bonus: '🛡️ +20% Invincibility Barrier' },
        { name: 'Shinjuku Demonic Night Skyline', bonus: '✨ +15% Critical Star Burst' },
        { name: 'Atlantis Submerged Titan Leyline', bonus: '🌊 Continuous Arts Card Acceleration' },
        { name: 'Heian-Kyo Thunder Leyline Nexus', bonus: '⚡ High-Frequency Quick Surge' },
        { name: 'Chaldea Rayshift Dropzone Alpha', bonus: '🔄 Rapid Emergency Recalibration' }
      ];
      const dist = singularityDistricts[participantIndex % singularityDistricts.length];

      return {
        presetKey,
        title: '🌀 CHALDEA RAYSPILL ALERT: GRAND SINGULARITY COLLISION!',
        embedColor: 0x0284c7,
        headerBadge: '⏳ CHALDEA SECURITY ORGANIZATION • EMERGENCY RAYSPILL DECREE',
        faction: 'none' as const,
        startingDistrict: dist.name,
        startingBonus: dist.bonus,
        intro:
          `Space-time distortion critical! You have been rayshifted into the **Grand Singularity Chaos (30 Masters FFA)**!\n\n` +
          `All safety locks and class restrictions have dissolved in the singularity vortex. 30 Masters clash with supercharged mana leylines.`,
        directives: [
          `⚡ **Hyper-Resonant Leylines (</grailwar:1>):** Monitor unstable leylines that recharge Noble Phantasms and skills at double velocity.`,
          `💥 **Unchecked Free-For-All (</attack:1> / </duel:1>):** 30 Masters clash simultaneously across all districts with zero class limits.`,
          `🔴 **5 Supercharged Command Seals:** You start with **5 Command Seals** to force instant NP releases, mid-battle heals, or tactical blinks.`,
          `🔄 **Rapid Revival Protocol:** Non-permadeath rules active! Defeated Masters reconstruct at Chaldea anchor points after recalibration.`,
          `💎 **Singularity Shards:** Seize district leylines to trigger singularity overdrive buffs!`
        ],
        footerNote: 'Chaldea Emergency Rayshift Protocol • Master Identity Encrypted'
      };
    }

    case 'desolate_hardcore': {
      const desolateDistricts = [
        { name: 'Ash-Choked Fuyuki Crater', bonus: '💀 Desolate Ether (Mana Depleted)' },
        { name: 'Ruined Kotomine Church Spire', bonus: '☠️ Sanctum Desecrated (Zero Asylum)' },
        { name: 'Subterranean Greater Grail Abyss', bonus: '🩸 Corruption (+10% ATK / -10% Max HP)' },
        { name: 'Petrified Forest Perimeter', bonus: '🌲 Unforgiving Isolation' },
        { name: 'Shattered Shinto Waterfront Bridge', bonus: '🎯 Exposed Killzone' }
      ];
      const dist = desolateDistricts[participantIndex % desolateDistricts.length];

      return {
        presetKey,
        title: '💀 SACRIFICIAL SEALS IGNITED: DESOLATE HARDCORE RITUAL',
        embedColor: 0xc2410c,
        headerBadge: '💀 RUINED GRAIL SANCTUARY • SACRIFICIAL ANNOUNCEMENT',
        faction: 'none' as const,
        startingDistrict: dist.name,
        startingBonus: dist.bonus,
        intro:
          `The Ruined Grail has claimed your soul in the **Desolate Hardcore Ritual**.\n\n` +
          `Seven Masters enter the ashen wasteland. Only one shall survive. There are no second chances.`,
        directives: [
          `⚠️ **1 SINGLE COMMAND SEAL:** You hold only **1 Command Seal**. Once spent, it is gone forever.`,
          `☠️ **NO CHURCH ASYLUM:** The Overseer is dead. The Church is in ruins. There is no sanctuary and no retreat.`,
          `💀 **ABSOLUTE PERMADEATH:** Fatal damage results in **instant permanent elimination**. Your Servant will fade to ash immediately.`,
          `🕸️ **Desolate Leylines:** Mana is scarce. Every trap (</trap:1>) and familiar (</familiar:1>) must be husbanded with care.`,
          `🩸 **Ruthless Survival:** Hunt before you are hunted using </attack:1>. Trust no shadows.`
        ],
        footerNote: 'Ruined Grail Ritual • Permadeath Active • Trust No One'
      };
    }

    case 'fuyuki_7':
    default: {
      const fuyukiDistricts = [
        { name: 'Miyama Residential District (Tohsaka / Emiya Estate)', bonus: '🛡️ +10% Bounded Field Trap Defense' },
        { name: 'Shinto Commercial Waterfront & Hyatt Tower', bonus: '🦅 +10% Familiar Scouting Precision' },
        { name: 'Mount Enzo (Ryuudou Temple Grounds)', bonus: '⚡ +15% Ambient Leyline Mana Flow' },
        { name: 'Einzbern Forest & Deep Castle', bonus: '🕶️ +10% Shadow Concealment Stealth' },
        { name: 'Fuyuki Port & Industrial Docks', bonus: '🗡️ +10% Ambush Strike Critical Rate' },
        { name: 'Fuyuki Central Park & Bridge', bonus: '✨ +10% Duel Star Generation' },
        { name: 'Homurahara Academy Leyline Core', bonus: '🔮 +10% Command Card Effectiveness' }
      ];
      const dist = fuyukiDistricts[participantIndex % fuyukiDistricts.length];

      return {
        presetKey: 'fuyuki_7',
        title: '🔱 THE COMMAND SEALS HAVE AWAKENED!',
        embedColor: 0xbe123c,
        headerBadge: '⛪ FUYUKI CHURCH OVERSEER COMMUNIQUE',
        faction: 'none' as const,
        startingDistrict: dist.name,
        startingBonus: dist.bonus,
        intro:
          `The Greater Grail of Fuyuki has chosen you as one of the **${totalParticipants} Chosen Masters** for the **5th Fuyuki Holy Grail War**!\n\n` +
          `Your Magic Circuits have ignited with the Command Seals of the Heaven's Feel ritual. You stand anointed as a Sacred Combatant.`,
        directives: [
          `🗺️ **War Command (</grailwar:1>):** Open the Fuyuki Leyline Map to monitor active districts, workshop traps, and contenders.`,
          `🕶️ **Stealth Ambushes (</attack:1>):** Hunt rival Magi from the shadows. Your identity remains concealed until your first engagement.`,
          `⚔️ **Direct Duels (</duel:1>):** Challenge identified contenders to open combat.`,
          `🕸️ **Bounded Fields & Familiars (</trap:1> / </familiar:1>):** Fortify your territory and deploy scouting spirits to detect intruders.`,
          `🔴 **Command Seal Evacuation:** If your Servant takes fatal damage, expend 1 Command Seal to emergency-teleport to safety preserved at **1 HP** under Church protection.`,
          `⛪ **Church Sanctuary:** Yielding all Command Seals grants neutral asylum at Kotomine Church.`
        ],
        footerNote: 'Confidential Church Dispatch • Keep your Master identity secret'
      };
    }
  }
}

/**
 * Builds the interactive, visually stunning DM package for a chosen Master.
 */
export async function buildModeSpecificMasterDm(params: {
  master: MasterProfile;
  activeServant: any;
  freshWar: HolyGrailWarSession;
  participantIndex: number;
  totalParticipants: number;
  client: Client;
}): Promise<{
  embed: EmbedBuilder;
  row: ActionRowBuilder<ButtonBuilder>;
  attachment: AttachmentBuilder;
}> {
  const { master, activeServant, freshWar, participantIndex, totalParticipants, client } = params;
  const presetKey = (freshWar.rules?.preset || (freshWar as any).presetKey || 'fuyuki_7') as string;
  const modeConfig = getModeDmConfig(presetKey, participantIndex, totalParticipants);

  const sName = activeServant.nickname || activeServant.template?.name || 'Heroic Spirit';
  const sClass = activeServant.template?.servantClass || (activeServant as any).servantClass || 'Saber';
  const sAvatar = activeServant.template?.avatarUrl || (activeServant as any).avatarUrl || master.avatarUrl;
  const sSprite = getServantSprite(activeServant);
  const summonQuote = resolveServantSummonQuote(activeServant, sName, sClass);
  const commandSealsCount = master.commandSeals || freshWar.rules?.startingCommandSeals || 3;

  // Render Canvas Awakening Banner
  const canvasBuffer = await renderHolyGrailWarAwakeningCard({
    masterName: master.username || 'Master',
    masterAvatarUrl: master.avatarUrl,
    servantName: sName,
    servantClass: sClass,
    servantAvatarUrl: sAvatar,
    servantSpriteUrl: sSprite,
    summonQuote,
    modePreset: presetKey,
    warTitle: freshWar.title || 'Holy Grail War',
    startingDistrict: modeConfig.startingDistrict,
    startingBonus: modeConfig.startingBonus,
    commandSealsCount,
    faction: modeConfig.faction
  });

  const attachment = new AttachmentBuilder(canvasBuffer, { name: 'command_seal_awakening.png' });

  // Mode-Specific Seal Emojis
  const sealEmojis = '🔴 '.repeat(Math.min(5, commandSealsCount)).trim();

  const embed = new EmbedBuilder()
    .setAuthor({
      name: modeConfig.headerBadge,
      iconURL: GRAIL_ANNOUNCEMENT_IMAGE
    })
    .setTitle(modeConfig.title)
    .setDescription(
      `${modeConfig.intro}\n\n` +
      `═══════════════════════════════════\n` +
      `📜 **ANOINTED MASTER COVENANT:**\n` +
      `• **Contracted Servant:** **${sName}** (\`${sClass}\`)\n` +
      `• **Command Seals:** ${sealEmojis} **(${commandSealsCount}/${commandSealsCount} Inscribed)**\n` +
      `• **Starting Territory:** 📍 **${modeConfig.startingDistrict}**\n` +
      `• **Territory Perk:** \`${modeConfig.startingBonus}\`\n` +
      `• **Status:** 🕶️ **Shadow Master (Concealed in Shadows)**\n\n` +
      `═══════════════════════════════════\n` +
      `⚔️ **COMBAT DIRECTIVES:**\n` +
      modeConfig.directives.map((d, i) => `${i + 1}. ${d}`).join('\n') +
      `\n\n*“${summonQuote}”* — **${sName}**`
    )
    .setColor(modeConfig.embedColor)
    .setImage('attachment://command_seal_awakening.png')
    .setFooter({ text: modeConfig.footerNote })
    .setTimestamp();

  // Interactive Buttons Row
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`war_dm_servant:${master.discordId || master.id}`)
      .setLabel('Servant Dossier')
      .setEmoji('🗡️')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`war_dm_rules:${presetKey}`)
      .setLabel('Mode Directives')
      .setEmoji('📜')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`war_dm_district:${presetKey}`)
      .setLabel('Territory & Traps')
      .setEmoji('📍')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`war_dm_church:${presetKey}`)
      .setLabel('Church Sanctuary')
      .setEmoji('⛪')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embed, row, attachment };
}

/**
 * Handles button interactions dispatched from private Master DMs.
 */
export async function handleWarDmInteraction(interaction: ButtonInteraction, client: Client): Promise<void> {
  const btnId = interaction.customId;
  const userId = interaction.user.id;
  const username = interaction.user.username;

  if (btnId.startsWith('war_dm_servant')) {
    const master = await getOrCreateMaster(userId, username);
    const activeServant = master.servants?.find(s => s.id === master.activeServantId) || master.servants?.[0];

    if (!activeServant) {
      await interaction.reply({
        content: '❌ No active contracted Servant found on your profile.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const sName = activeServant.nickname || activeServant.template?.name || 'Heroic Spirit';
    const sClass = activeServant.template?.servantClass || (activeServant as any).servantClass || 'Saber';
    const sHp = (activeServant as any).currentHp || activeServant.template?.baseHp || 50000;
    const sMaxHp = (activeServant as any).maxHp || activeServant.template?.baseHp || 50000;
    const sAtk = (activeServant as any).attack || activeServant.template?.baseAtk || 12000;
    const np = activeServant.template?.noblePhantasm;
    const skills = activeServant.template?.skills || [];
    const deck = activeServant.template?.commandDeck || ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'];

    const servantEmbed = new EmbedBuilder()
      .setTitle(`🗡️ CONTRACTED SERVANT: ${sName.toUpperCase()}`)
      .setDescription(
        `• **Class:** \`${sClass}\`\n` +
        `• **Spirit Graph HP:** ❤️ **${sHp.toLocaleString()} / ${sMaxHp.toLocaleString()}**\n` +
        `• **Base Attack:** ⚔️ **${sAtk.toLocaleString()}**\n` +
        `• **Command Deck:** 🃏 \`${deck.join(' - ')}\`\n\n` +
        `═══════════════════════════════════\n` +
        `✨ **NOBLE PHANTASM:**\n` +
        `**${np?.name || 'Secret Noble Phantasm'}** (\`${np?.cardType || 'Buster'}\`)\n` +
        `*${np?.description || 'Devastating ultimate phantasm strike.'}*\n\n` +
        `⚡ **HEROIC SPIRIT SKILLS:**\n` +
        (skills.length > 0
          ? skills.map((sk: any) => `• **${sk.name}** (CD: ${sk.cooldown}T): ${sk.description}`).join('\n')
          : '• *Standard Combat Intuition*')
      )
      .setColor(0x3b82f6)
      .setThumbnail(activeServant.template?.avatarUrl || master.avatarUrl || null)
      .setFooter({ text: 'Holy Grail War Servant Tactical Sheet' });

    await interaction.reply({
      embeds: [servantEmbed],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (btnId.startsWith('war_dm_rules')) {
    const presetKey = btnId.split(':')[1] || 'fuyuki_7';
    const war = getOrInitWarSession();
    const config = getModeDmConfig(presetKey, 0, 7);

    const rulesEmbed = new EmbedBuilder()
      .setTitle(`📜 RITUAL DIRECTIVES & RULES • ${presetKey.toUpperCase()}`)
      .setDescription(
        `**Active Game Mode:** \`${war.title || presetKey}\`\n\n` +
        `1. **Stealth Concealment:** You are hidden as a *Shadow Master* until your first offensive action or duel.\n` +
        `2. **Ambush Advantage:** Attacking an unsuspecting rival from the same district awards priority initiative and first-turn bonus damage.\n` +
        `3. **Command Seal Powers:**\n` +
        `   • 🔴 **Instant 100% NP Overcharge:** Trigger full Noble Phantasm release.\n` +
        `   • 🔴 **Emergency Evacuation:** Preserve your life at 1 HP when facing lethal strikes.\n` +
        `   • 🔴 **Full Vitality Restoration:** Restore Servant HP to 100%.\n` +
        `4. **Victory Condition:** The last standing Master/Faction claims the omnipotent Greater Grail!`
      )
      .setColor(0xd97706)
      .setFooter({ text: 'Holy Church Sacred War Guidelines' });

    await interaction.reply({
      embeds: [rulesEmbed],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (btnId.startsWith('war_dm_district')) {
    const districtEmbed = new EmbedBuilder()
      .setTitle('📍 TERRITORY CONTROL & MUKYOKU BOUNDED FIELDS')
      .setDescription(
        `In the Holy Grail War, districts provide tactical advantages and defense leylines:\n\n` +
        `• **Workshop Traps (</trap:1>):** Stake arcane bounded fields in your current district. Intruding rival Magi trigger explosive magical traps, suffering damage and exposing their identity.\n` +
        `• **Scouting Familiars (</familiar:1>):** Dispatch avian or insect familiars to survey adjacent districts, uncovering rival Master locations and workshop preparations.\n` +
        `• **Leyline Circulation:** Resting in your initial spawn district increases mana recovery and skill cooldown refresh rates.`
      )
      .setColor(0x10b981)
      .setFooter({ text: 'Magecraft Territory & Defense Manual' });

    await interaction.reply({
      embeds: [districtEmbed],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (btnId.startsWith('war_dm_church')) {
    const churchEmbed = new EmbedBuilder()
      .setTitle('⛪ FUYUKI CHURCH: NEUTRAL SANCTUARY PROTOCOLS')
      .setDescription(
        `Under the authority of the Eighth Sacrament and Holy Church Overseer:\n\n` +
        `• **Neutral Ground:** Violence, bounded fields, and Servant combat are strictly forbidden within Church grounds.\n` +
        `• **Surrender & Asylum:** Any Master who voluntarily yields all remaining Command Seals may claim permanent neutral sanctuary for the remainder of the war.\n` +
        `• **Emergency Extraction:** When reduced to 0 HP, a surviving Command Seal will automatically teleport your spirit graph to the Church crypt preserved at 1 HP.`
      )
      .setColor(0xfbbf24)
      .setFooter({ text: 'Overseer Neutrality Accord' });

    await interaction.reply({
      embeds: [churchEmbed],
      flags: MessageFlags.Ephemeral
    });
    return;
  }
}


/**
 * Updates the existing announcement card message with the latest applicant counts.
 */
async function updateRecruitmentMessage(
  channel: TextChannel | any,
  recruitment: WarRecruitmentCall,
  warSession: HolyGrailWarSession
): Promise<void> {
  if (!recruitment.messageId || !channel) return;
  try {
    const msg = await channel.messages.fetch(recruitment.messageId).catch(() => null);
    if (msg) {
      const { embed, row } = buildRecruitmentEmbed(recruitment, warSession);
      await msg.edit({ embeds: [embed], components: [row] });
    }
  } catch (err) {
    console.warn('Failed to update recruitment message embed:', err);
  }
}

/**
 * Concludes the recruitment call, randomly draws the chosen Masters up to maxSlots,
 * transitions them into active war mode, and dispatches confidential DMs!
 */
export async function igniteWarFromRecruitment(
  client: Client,
  warSession?: HolyGrailWarSession,
  fallbackChannel?: TextChannel | any
): Promise<{ success: boolean; message: string; chosenCount: number }> {
  const war = warSession || getOrInitWarSession();
  const recruitment = war.recruitmentCall;

  if (!recruitment) {
    return { success: false, message: 'No active recruitment call found.', chosenCount: 0 };
  }

  // Deactivate recruitment
  recruitment.active = false;
  war.recruitmentCall = undefined;
  saveWarToDisk();

  const applicantIds = [...recruitment.applicantIds];
  const maxSlots = recruitment.maxSlots || 7;

  // Filter valid applicants (must exist and have a summoned Servant)
  const validApplicants: { master: MasterProfile; discordId: string }[] = [];
  for (const uid of applicantIds) {
    try {
      const m = await getOrCreateMaster(uid, `Master_${uid}`);
      if (m && m.servants && m.servants.length > 0) {
        validApplicants.push({ master: m, discordId: uid });
      }
    } catch {}
  }

  // Handle case with zero applicants
  if (validApplicants.length === 0) {
    const emptyEmbed = new EmbedBuilder()
      .setTitle('🕯️ FUYUKI CHURCH: GRAIL RITUAL DISSIPATED')
      .setDescription('No worthy Magi inscribed their Command Seals for this cycle. The Greater Grail returns to slumber beneath Mount Enzo.')
      .setColor(0x64748b)
      .setTimestamp();

    if (recruitment.channelId && client) {
      try {
        const chan: any = await client.channels.fetch(recruitment.channelId).catch(() => fallbackChannel);
        if (chan && recruitment.messageId) {
          const msg = await chan.messages.fetch(recruitment.messageId).catch(() => null);
          if (msg) await msg.edit({ embeds: [emptyEmbed], components: [] });
        }
      } catch {}
    }
    return { success: false, message: 'No valid applicants inscribed.', chosenCount: 0 };
  }

  // Random selection if applicants exceed maxSlots (Fisher-Yates Shuffle)
  const shuffled = [...validApplicants];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const chosenApplicants = shuffled.slice(0, maxSlots);
  const unchosenApplicants = shuffled.slice(maxSlots);

  // Initialize a fresh Holy Grail War tournament with the chosen preset
  const { war: freshWar } = startOrRestartWar(
    recruitment.presetKey,
    undefined,
    recruitment.initiatedBy,
    { wipeRoster: true }
  );

  // Register each chosen Master into the active war session
  const chosenSummaryList: string[] = [];

  for (const item of chosenApplicants) {
    const master = item.master;
    const discordId = item.discordId;

    // Retrieve chosen servant for this war (or fallback to active servant)
    const chosenServantId = recruitment.applicantServantChoices?.[discordId] || master.activeServantId;
    const activeServant = master.servants.find(s => s.id === chosenServantId) || master.servants[0];
    master.activeServantId = activeServant.id;

    // Set Master into active War mode with full HP and 3 Command Seals
    master.environmentMode = 'war';
    master.commandSeals = freshWar.rules?.startingCommandSeals || 3;
    const sMaxHp = (activeServant as any).maxHp || activeServant.template?.baseHp || 50000;
    activeServant.currentHp = sMaxHp;
    await saveMaster(master);

    const sName = activeServant.nickname || activeServant.template?.name || 'Heroic Spirit';
    const sClass = activeServant.template?.servantClass || (activeServant as any).servantClass || 'Saber';
    const avatar = activeServant.template?.avatarUrl || (activeServant as any).avatarUrl || master.avatarUrl;

    // Register into war session participant roster as CONCEALED Shadow Master
    freshWar.participants[discordId] = {
      discordId,
      username: master.username,
      servantId: activeServant.id || 'servant_contract',
      servantName: sName,
      servantClass: sClass as any,
      avatarUrl: avatar,
      currentHp: sMaxHp,
      maxHp: sMaxHp,
      commandSeals: master.commandSeals,
      isAlive: true,
      isExposed: false, // Stealth concealment
      kills: 0,
      innocentKills: 0
    };

    chosenSummaryList.push(`<@${discordId}>`);

    // Send Confidential Mode-Tailored Direct Message (DM) to Chosen Master
    try {
      const userObj = await client.users.fetch(discordId).catch(() => null);
      if (userObj) {
        const participantIdx = chosenApplicants.indexOf(item);
        const { embed: dmEmbed, row: dmRow, attachment: dmFile } = await buildModeSpecificMasterDm({
          master,
          activeServant,
          freshWar,
          participantIndex: participantIdx,
          totalParticipants: chosenApplicants.length,
          client
        });

        await userObj.send({
          embeds: [dmEmbed],
          files: [dmFile],
          components: [dmRow]
        }).catch((sendErr) => {
          console.warn(`Could not send Grail War DM to user ${discordId} (DMs may be restricted):`, sendErr);
        });
      }
    } catch (dmErr) {
      console.warn(`Failed to dispatch DM to chosen Master ${discordId}:`, dmErr);
    }
  }

  // Notify unchosen applicants that they remain safely in Safe Mode
  for (const item of unchosenApplicants) {
    const master = item.master;
    master.environmentMode = 'safe';
    master.commandSeals = 3;
    await saveMaster(master);

    try {
      const userObj = await client.users.fetch(item.discordId).catch(() => null);
      if (userObj) {
        const safeDmEmbed = new EmbedBuilder()
          .setTitle('🕊️ CHURCH SANCTUARY NOTICE')
          .setDescription(
            `The Greater Grail has completed its Master selection for this cycle.\n\n` +
            `You were not drawn among the active combatants and remain safely under Church protection in **Safe Mode**.\n\n` +
            `• ⚔️ You can freely participate in **Free Battles** (\`/duel mode:free\`) without elimination risks!\n` +
            `• 💎 Continue Chaldea daily summons and quests (\`/daily\`, \`/summon\`).\n` +
            `• ⏳ You can enter the applicant pool again when the next war is announced!`
          )
          .setColor(0x3b82f6)
          .setTimestamp();

        await userObj.send({ embeds: [safeDmEmbed] }).catch(() => {});
      }
    } catch {}
  }

  saveWarToDisk();

  // Update original recruitment card to grand War Ignition announcement
  const ignitedEmbed = new EmbedBuilder()
    .setAuthor({
      name: '⛪ FUYUKI CHURCH • EIGHTH SACRAMENT OVERSEER OFFICE',
      iconURL: GRAIL_ANNOUNCEMENT_IMAGE
    })
    .setTitle('🔔 HEAVEN\'S FEEL: THE GREATER GRAIL RITUAL HAS IGNITED!')
    .setDescription(
      `*"The seventh bell tolls through the burning night. The spiritual leylines of Fuyuki have reached total resonance, and the Greater Grail has anointed its **${chosenApplicants.length} Masters** in sacred secrecy."*\n\n` +
      `⚔️ **Active Crucible:** **${freshWar.title}**\n` +
      `👥 **Chosen Contenders:** **${chosenApplicants.length} Shadow Masters** (Concealed by the Grail)\n` +
      `📬 **Confidential Dispatches:** Battle codices, strategic interfaces, and awakened Command Seals have been transmitted via **Private Telepathic Dispatch (DM)**.\n\n` +
      `🩸 **Citywide Thaumaturgy Live:** Bounded fields, familiars, ambushes, and tournament duels are now active across Fuyuki City.\n\n` +
      `*Claim the Wish-Granting Chalice or return to ash. Access \`/grailwar\` for tactical operations.*`
    )
    .setImage(GRAIL_ANNOUNCEMENT_IMAGE)
    .setColor(0xd97706) // Golden Grail / Fire Amber
    .setFooter({ text: 'Holy Grail War Active • Command Seals Awakened • Check /grailwar' })
    .setTimestamp();

  const warRoomBtn = new ButtonBuilder()
    .setCustomId('inv_quick_war')
    .setLabel('🏰 Open War Room (/grailwar)')
    .setStyle(ButtonStyle.Success)
    .setEmoji('🏆');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(warRoomBtn);

  if (recruitment.channelId && client) {
    try {
      const chan: any = await client.channels.fetch(recruitment.channelId).catch(() => fallbackChannel);
      if (chan && recruitment.messageId) {
        const msg = await chan.messages.fetch(recruitment.messageId).catch(() => null);
        if (msg) {
          await msg.edit({ embeds: [ignitedEmbed], components: [row] });
        } else {
          await chan.send({ embeds: [ignitedEmbed], components: [row] });
        }
      }
    } catch (chanErr) {
      console.warn('Failed to update announcement channel with ignited war embed:', chanErr);
    }
  }

  return {
    success: true,
    message: `🌟 **Holy Grail War Successfully Ignited with ${chosenApplicants.length} Masters!**`,
    chosenCount: chosenApplicants.length
  };
}

/**
 * Initializes automatic timer recovery upon bot reboot if a recruitment call is still pending.
 */
export function resumePendingRecruitment(client: Client): void {
  const war = getOrInitWarSession();
  const recruitment = war.recruitmentCall;

  if (recruitment && recruitment.active) {
    const now = Date.now();
    if (recruitment.expiresAt > 0) {
      const remainingMs = recruitment.expiresAt - now;
      if (remainingMs <= 0) {
        // Expired while bot was offline; ignite immediately
        igniteWarFromRecruitment(client, war).catch(err => {
          console.error('Failed to auto-ignite expired recruitment on startup:', err);
        });
      } else {
        // Resume timeout
        activeRecruitmentTimer = setTimeout(() => {
          igniteWarFromRecruitment(client, war).catch(err => {
            console.error('Failed to auto-ignite recruitment on timer expiry:', err);
          });
        }, remainingMs);
      }
    }
  }
}
