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
 * Returns mode-tailored narrative, styling, and directives without fictional map locations.
 */
export function getModeDmConfig(presetKey: string, participantIndex: number, totalParticipants: number) {
  switch (presetKey) {
    case 'apocrypha_14': {
      const isBlackFaction = participantIndex % 2 === 0;
      const faction: 'red' | 'black' = isBlackFaction ? 'black' : 'red';
      const factionTitle = isBlackFaction ? '⚫ BLACK FACTION (Yggdmillennia)' : '🔴 RED FACTION (Clock Tower)';

      return {
        presetKey,
        title: `⚔️ GREAT HOLY GRAIL WAR: ${factionTitle}`,
        embedColor: isBlackFaction ? 0x7c3aed : 0xd97706,
        headerBadge: '🏛️ CLOCK TOWER & YGGDMILLENNIA • GREAT WAR DISPATCH',
        faction,
        intro:
          `You have been anointed as a Master in the **14-Master Great Holy Grail War** representing the **${factionTitle}**!\n\n` +
          `Seven Masters of the Black Faction and seven Masters of the Red Faction clash in open warfare for possession of the omnipotent Greater Grail.`,
        directives: [
          `🚩 **Faction Frontline (</grailwar:1>):** Coordinate strikes and strategy with your allied 7 Masters.`,
          `⚔️ **Legion Ambushes (</attack:1>):** Hunt and ambush enemy faction Magi from the shadows.`,
          `🤺 **Direct Duels (</duel:1>):** Challenge opposing faction champions to open combat.`,
          `🕸️ **Bounded Fields & Familiars (</trap:1> / </familiar:1>):** Fortify defenses with arcane traps and deploy scouting familiars.`,
          `⚖️ **Ruler Divine Mediation:** A neutral Ruler watches over the ritual—flagrant violations draw Divine Judgment.`,
          `🔴 **Command Seal Overdrive:** Consume Command Seals to trigger emergency 100% Noble Phantasm overcharge or tactical blinks.`
        ],
        footerNote: 'Confidential Great Grail War Dispatch • Coordinate with your Faction'
      };
    }

    case 'singularity_chaos': {
      return {
        presetKey,
        title: '🌀 CHALDEA RAYSPILL ALERT: GRAND SINGULARITY COLLISION!',
        embedColor: 0x0284c7,
        headerBadge: '⏳ CHALDEA SECURITY ORGANIZATION • EMERGENCY RAYSPILL DECREE',
        faction: 'none' as const,
        intro:
          `Space-time distortion critical! You have been rayshifted into the **Grand Singularity Chaos (30 Masters FFA)**!\n\n` +
          `All class restrictions have dissolved in the singularity vortex. 30 Masters clash with supercharged mana leylines.`,
        directives: [
          `⚡ **War Command (</grailwar:1>):** Monitor active contenders, battle logs, and casualty counts across the ritual.`,
          `💥 **Unchecked Free-For-All (</attack:1> / </duel:1>):** 30 Masters clash simultaneously with zero class restrictions.`,
          `🔴 **5 Supercharged Command Seals:** You start with **5 Command Seals** for instant NP releases, mid-battle heals, or tactical blinks.`,
          `🔄 **Rapid Revival Protocol:** Defeated Masters reconstruct at Chaldea anchor points after recalibration.`,
          `🕸️ **Traps & Familiars (</trap:1> / </familiar:1>):** Lay ambush wards and deploy familiars to scan rival Magi.`
        ],
        footerNote: 'Chaldea Emergency Rayshift Protocol • Master Identity Encrypted'
      };
    }

    case 'desolate_hardcore': {
      return {
        presetKey,
        title: '💀 SACRIFICIAL SEALS IGNITED: DESOLATE HARDCORE RITUAL',
        embedColor: 0xc2410c,
        headerBadge: '💀 RUINED GRAIL SANCTUARY • SACRIFICIAL ANNOUNCEMENT',
        faction: 'none' as const,
        intro:
          `The Ruined Grail has claimed your soul in the **Desolate Hardcore Ritual**.\n\n` +
          `Seven Masters enter the ritual. Only one shall survive. There are no second chances.`,
        directives: [
          `⚠️ **1 SINGLE COMMAND SEAL:** You hold only **1 Command Seal**. Once spent, it is gone forever.`,
          `☠️ **NO CHURCH ASYLUM:** The Overseer is dead. The Church is in ruins. There is no sanctuary and no retreat.`,
          `💀 **ABSOLUTE PERMADEATH:** Fatal damage results in **instant permanent elimination**. Your Servant will fade to ash immediately.`,
          `🕸️ **Magecraft Traps & Familiars (</trap:1> / </familiar:1>):** Mana is scarce. Every trap and familiar must be deployed with extreme care.`,
          `🩸 **Ruthless Survival (</attack:1> / </duel:1>):** Hunt before you are hunted. Trust no one.`
        ],
        footerNote: 'Ruined Grail Ritual • Permadeath Active • Trust No One'
      };
    }

    case 'fuyuki_7':
    default: {
      return {
        presetKey: 'fuyuki_7',
        title: '🔱 THE COMMAND SEALS HAVE AWAKENED!',
        embedColor: 0xbe123c,
        headerBadge: '⛪ FUYUKI CHURCH OVERSEER COMMUNIQUE',
        faction: 'none' as const,
        intro:
          `The Greater Grail has chosen you as one of the **${totalParticipants} Chosen Masters** for the **5th Holy Grail War**!\n\n` +
          `Your Magic Circuits have ignited with the Command Seals of the Heaven's Feel ritual. You stand anointed as a Sacred Combatant.`,
        directives: [
          `📜 **War Command (</grailwar:1>):** Monitor active Master contenders, combat status, and tournament standings.`,
          `🕶️ **Stealth Ambushes (</attack:1>):** Hunt rival Magi from the shadows. Your identity remains concealed until your first engagement.`,
          `⚔️ **Direct Duels (</duel:1>):** Challenge identified contenders to open, honorable combat.`,
          `🕸️ **Bounded Fields & Familiars (</trap:1> / </familiar:1>):** Fortify your defenses with traps and deploy scouting spirits.`,
          `🔴 **Command Seal Evacuation:** If your Servant takes fatal damage, expend 1 Command Seal to emergency-teleport to safety preserved at **1 HP**.`,
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
  userAvatarUrl?: string;
}): Promise<{
  embed: EmbedBuilder;
  row: ActionRowBuilder<ButtonBuilder>;
  attachment: AttachmentBuilder;
}> {
  const { master, activeServant, freshWar, participantIndex, totalParticipants, client, userAvatarUrl } = params;
  const presetKey = (freshWar.rules?.preset || (freshWar as any).presetKey || 'fuyuki_7') as string;
  const modeConfig = getModeDmConfig(presetKey, participantIndex, totalParticipants);

  // Fetch real active Discord avatar if available
  let resolvedMasterAvatar = userAvatarUrl || master.avatarUrl;
  if (!resolvedMasterAvatar && (master.discordId || master.id)) {
    try {
      const userObj = await client.users.fetch(master.discordId || master.id).catch(() => null);
      if (userObj) {
        resolvedMasterAvatar = userObj.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true });
        master.avatarUrl = resolvedMasterAvatar;
      }
    } catch {}
  }

  const sName = activeServant.nickname || activeServant.template?.name || 'Heroic Spirit';
  const sClass = activeServant.template?.servantClass || (activeServant as any).servantClass || 'Saber';
  const sAvatar = activeServant.template?.avatarUrl || (activeServant as any).avatarUrl || resolvedMasterAvatar;
  const sSprite = getServantSprite(activeServant);
  const summonQuote = resolveServantSummonQuote(activeServant, sName, sClass);
  const commandSealsCount = master.commandSeals || freshWar.rules?.startingCommandSeals || 3;

  // Render Canvas Awakening Banner (1040x620)
  const canvasBuffer = await renderHolyGrailWarAwakeningCard({
    masterName: master.username || 'Master',
    masterAvatarUrl: resolvedMasterAvatar,
    servantName: sName,
    servantClass: sClass,
    servantAvatarUrl: sAvatar,
    summonQuote,
    modePreset: presetKey,
    warTitle: freshWar.title || 'Holy Grail War',
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
      `• **Status:** 🕶️ **Shadow Master (Concealed in Shadows)**\n` +
      `• **Ritual Clearance:** ✦ **Sacred Combatant Anointed**\n\n` +
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
      .setCustomId(`war_dm_seals:${presetKey}`)
      .setLabel('Command Seal Powers')
      .setEmoji('🔱')
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

    const rulesEmbed = new EmbedBuilder()
      .setTitle(`📜 RITUAL DIRECTIVES & RULES • ${presetKey.toUpperCase()}`)
      .setDescription(
        `**Active Game Mode:** \`${war.title || presetKey}\`\n\n` +
        `1. **Stealth Concealment:** You are hidden as a *Shadow Master* until your first offensive action or duel.\n` +
        `2. **Ambush Advantage (</attack:1>):** Ambush rival Magi from the shadows with first-turn initiative.\n` +
        `3. **Direct Duels (</duel:1>):** Challenge identified opponents to direct tactical combat.\n` +
        `4. **Magecraft Traps (</trap:1>):** Stake bounded fields to inflict heavy damage on intruders.\n` +
        `5. **Familiars (</familiar:1>):** Dispatch scouts to scan enemy Servant stats and identities.\n` +
        `6. **Command Seal Powers:**\n` +
        `   • 🔴 **Instant 100% NP Overcharge:** Trigger immediate Noble Phantasm release.\n` +
        `   • 🔴 **Emergency Evacuation:** Preserve your life at 1 HP when facing lethal strikes.\n` +
        `   • 🔴 **Full Vitality Restoration:** Restore Servant HP to 100%.\n` +
        `7. **Victory Condition:** The last standing Master/Faction claims the omnipotent Greater Grail!`
      )
      .setColor(0xd97706)
      .setFooter({ text: 'Holy Church Sacred War Guidelines' });

    await interaction.reply({
      embeds: [rulesEmbed],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (btnId.startsWith('war_dm_seals')) {
    const sealsEmbed = new EmbedBuilder()
      .setTitle('🔱 SACRED COMMAND SEAL POWERS')
      .setDescription(
        `Command Seals represent absolute divine authority over your Heroic Spirit:\n\n` +
        `• 🔴 **Instant 100% NP Overcharge:** Force your Servant's Noble Phantasm to prime at 100% gauge for an immediate ultimate strike.\n` +
        `• 🔴 **Emergency Evacuation (Auto):** If your Servant suffers a fatal blow, 1 Command Seal automatically triggers an emergency tactical teleport, preserving your life at **1 HP**.\n` +
        `• 🔴 **Full Vitality Restoration:** Instantly heal and rejuvenate your Servant's Spirit Graph back to 100% HP during intense battle.\n\n` +
        `*Expend your seals wisely, Master—once depleted, you lose absolute authority!*`
      )
      .setColor(0xbe123c)
      .setFooter({ text: 'Holy Church Command Seal Compendium' });

    await interaction.reply({
      embeds: [sealsEmbed],
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
        const userAvatarUrl = userObj.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true });
        master.avatarUrl = userAvatarUrl;
        await saveMaster(master);

        const participantIdx = chosenApplicants.indexOf(item);
        const { embed: dmEmbed, row: dmRow, attachment: dmFile } = await buildModeSpecificMasterDm({
          master,
          activeServant,
          freshWar,
          participantIndex: participantIdx,
          totalParticipants: chosenApplicants.length,
          client,
          userAvatarUrl
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
