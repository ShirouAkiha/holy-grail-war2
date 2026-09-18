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
  PermissionFlagsBits
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

    // Send Confidential Direct Message (DM) to Chosen Master
    try {
      const userObj = await client.users.fetch(discordId).catch(() => null);
      if (userObj) {
        const dmEmbed = new EmbedBuilder()
          .setTitle('🔱 THE COMMAND SEALS HAVE AWAKENED!')
          .setDescription(
            `The Greater Grail of Fuyuki has chosen you as one of the **${chosenApplicants.length} Masters** in the **${freshWar.title}**!\n\n` +
            `• **Contracted Servant:** **${sName}** (${sClass})\n` +
            `• **Command Seals:** 🔴🔴🔴 **3/3**\n` +
            `• **Status:** 🕶️ **Shadow Master (Concealed)**\n\n` +
            `═══════════════════════════════════\n` +
            `📜 **HOLY GRAIL WAR COMBAT DIRECTIVES:**\n` +
            `1. **War Command:** Open \`/grailwar\` to view the War Board, workshop defenses, and Fuyuki leylines.\n` +
            `2. **Stealth Ambushes:** Track rival Magi and launch surprise attacks using \`/attack @Master\`.\n` +
            `3. **Direct Duels:** Challenge opponents in open duels with \`/duel\`.\n` +
            `4. **Magecraft Traps:** Stake bounded fields with \`/trap\` and deploy scouting familiars with \`/familiar\`.\n` +
            `5. **Command Seal Evacuation:** If your Servant takes fatal damage, you may expend 1 Command Seal to emergency-teleport to safety preserved at **1 HP**.\n\n` +
            `*May victory belong to the swiftest blade. Let the Holy Grail War begin!*`
          )
          .setColor(0xb91c1c)
          .setFooter({ text: 'Confidential Church Dispatch • Keep your identity secret' })
          .setTimestamp();

        await userObj.send({ embeds: [dmEmbed] }).catch(() => {
          console.warn(`Could not send Grail War DM to user ${discordId} (DMs may be restricted).`);
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
