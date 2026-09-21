import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  MessageFlags
} from 'discord.js';
import { getOrCreateMaster, saveMaster } from '../database/service';
import { getOrInitWarSession, calculateCurrentHp } from '../engine/grailwar';
import {
  generateServantTalkResponse,
  renderServantTalkVisualOutput,
  ServantSceneContext
} from '../engine/talkService';
import { checkMasterTalkQuota, consumeMasterTalkQuota } from '../engine/talkQuotaService';
import { safeSetEmbedThumbnail } from '../utils/discordEmbedHelper';
import { addBondExpToServant } from '../../lib/engine/bondEvents';

export const data = new SlashCommandBuilder()
  .setName('talk')
  .setDescription('💬 Open a telepathic dialogue channel with your contracted Heroic Spirit')
  .addStringOption(opt =>
    opt
      .setName('message')
      .setDescription('What do you wish to say to your Servant?')
      .setRequired(true)
      .setMaxLength(500)
  )
  .addStringOption(opt =>
    opt
      .setName('context')
      .setDescription('Atmosphere & scene of dialogue (defaults to Workshop / Casual Downtime)')
      .setRequired(false)
      .addChoices(
        { name: '🏠 Workshop (Casual Downtime)', value: 'workshop' },
        { name: '💖 Bond Covenant (Personal / Deep)', value: 'bond' },
        { name: '⛪ Church Sanctuary (Neutral Peace)', value: 'church' },
        { name: '⚔️ Active Patrol (Tactical / Warzone)', value: 'patrol' }
      )
  )
  .addStringOption(opt =>
    opt
      .setName('servant')
      .setDescription('Specific Servant to address (defaults to currently active Servant)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const master = await getOrCreateMaster(interaction.user.id, interaction.user.username);
    const war = getOrInitWarSession();

    if (!master.servants || master.servants.length === 0) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ No Contracted Servant')
            .setDescription('You have not established a Master-Servant covenant yet. Use `/summon ritual` to summon a Heroic Spirit into your service!')
            .setColor(0xef4444)
        ]
      });
    }

    const requestedServant = interaction.options.getString('servant')?.toLowerCase().trim();
    let targetServant = master.servants.find((s: any) => s.id === master.activeServantId) || master.servants[0];

    if (requestedServant) {
      const match = master.servants.find((s: any) =>
        s.nickname?.toLowerCase().includes(requestedServant) ||
        s.template?.name?.toLowerCase().includes(requestedServant) ||
        s.template?.servantClass?.toLowerCase() === requestedServant
      );
      if (match) targetServant = match;
    }

    const totalMastersCount = Object.keys(war.participants || {}).length || 7;
    const quotaStatus = checkMasterTalkQuota(master, totalMastersCount);

    if (!quotaStatus.allowed) {
      if (quotaStatus.reason === 'burst_cooldown') {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('⏳ Telepathic Link Stabilizing')
              .setDescription(`Your telepathic link is recharging. Please wait **${quotaStatus.cooldownRemainingSeconds} second(s)** before transmitting another thought.`)
              .setColor(0xf59e0b)
              .setFooter({ text: `Anti-Spam Leyline Guard • Remaining today: ${quotaStatus.remainingToday}/${quotaStatus.maxToday}` })
          ]
        });
      }

      const sealButtons: ButtonBuilder[] = [];
      if ((master.commandSeals ?? 0) > 0) {
        sealButtons.push(
          new ButtonBuilder()
            .setCustomId(`btn_refill_talk_seal:${targetServant.id}`)
            .setLabel(`Spend 1 Command Seal (+5 Chats) [${master.commandSeals}/3 Seals]`)
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔱')
        );
      }
      sealButtons.push(
        new ButtonBuilder()
          .setCustomId('btn_apikey_dashboard')
          .setLabel('Connect BYOK API Key (Unlimited) 🔑')
          .setStyle(ButtonStyle.Primary)
      );

      const sealRefillButton = new ActionRowBuilder<ButtonBuilder>().addComponents(sealButtons);

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('⚠️ Telepathic Mana Exhausted for Today')
            .setDescription(
              `Master **${master.username}**, your personal Magical Energy (Od) for telepathic communion has been exhausted for today.\n\n` +
              `• **Daily Allowance:** \`${quotaStatus.maxToday} chats / day\` (${totalMastersCount <= 7 ? '7-Master standard war limit: 25' : `Expanded ${totalMastersCount}-Master war limit: 20`})\n` +
              `• **Used Today:** \`${quotaStatus.maxToday}/${quotaStatus.maxToday}\`\n` +
              `• **Replenishment:** Resets daily at **00:00 UTC** (Midnight Leyline Renewal).\n\n` +
              `💡 **Need more chats?**\n` +
              `1. **Command Seal:** Channel 1 Command Seal to restore **+5 chats**.\n` +
              `2. **BYOK (Bring Your Own Key):** Connect your own **Gemini**, **OpenRouter**, or **NanoGPT** API key with \`/apikey\` for **unlimited chats**!`
            )
            .setColor(0xef4444)
            .setFooter({ text: `Daily Telepathic Cap: ${quotaStatus.maxToday} chats • Resets at 00:00 UTC` })
        ],
        components: [sealRefillButton]
      });
    }

    // Consume 1 daily chat quota
    const { remainingToday, maxToday, isByok } = await consumeMasterTalkQuota(master, totalMastersCount);

    const t = targetServant.template || targetServant;
    const servantName = targetServant.nickname || t.name || 'Heroic Spirit';
    const servantClass = t.servantClass || 'Saber';
    const bondLevel = targetServant.bondLevel || 1;
    const avatarUrl = targetServant.avatarUrl || t.avatarUrl;
    const cardArtUrl = targetServant.cardArtUrl || t.cardArtUrl;
    const spriteUrl = targetServant.spriteUrl || t.spriteUrl;
    const commandSeals = master.commandSeals ?? 3;
    const playerMessage = interaction.options.getString('message', true);

    const userParticipant = war.participants?.[master.discordId];
    const isExposed = !!userParticipant?.isExposed;
    const equippedCeName = targetServant.equippedCe?.name;
    const recentChronicleEvents = (war.eventLogs || []).slice(0, 6).map((l: any) =>
      typeof l === 'string' ? l : (l.text || l.message || 'War active in Fuyuki.')
    );

    // Actual combat skirmishes and ambushes (excluding trap siphons and maintenance)
    const recentBattleEvents = (war.eventLogs || [])
      .filter((evt: any) => {
        const t = evt.type;
        const txt = (evt.text || '').toLowerCase();
        if (
          txt.includes('bounded field') ||
          txt.includes('mana drain') ||
          txt.includes('alarm ward') ||
          txt.includes('sensory alarm') ||
          txt.includes('channeled workshop') ||
          txt.includes('mana reconstitution') ||
          txt.includes('workshop defense') ||
          txt.includes('familiar')
        ) {
          return false;
        }
        return (
          t === 'clash' ||
          t === 'ambush' ||
          t === 'elimination' ||
          t === 'casualty' ||
          t === 'duel' ||
          txt.includes('ambush') ||
          txt.includes('duel') ||
          txt.includes('eliminated') ||
          txt.includes('counter-struck') ||
          txt.includes('struck down') ||
          txt.includes('mercy') ||
          txt.includes('execution')
        );
      })
      .slice(0, 8)
      .map((l: any) => typeof l === 'string' ? l : (l.text || l.message || 'Combat clash recorded.'));

    // Intercepted intelligence leaks from surveillance & familiars
    const interceptedLeaks = (war.leakedIntel || []).slice(0, 6).map((lk: any) => ({
      informant: lk.informantMasterId ? (war.participants?.[lk.informantMasterId]?.username || lk.informantMasterId) : 'Scout Operative',
      intel: lk.intel || 'Unknown dispatch',
      target: lk.targetMasterId ? (war.participants?.[lk.targetMasterId]?.username || lk.targetMasterId) : undefined
    }));

    // Casualty breakdown: Fallen Masters and civilian collateral crossfire
    const fallenMasters = Object.values(war.participants || {})
      .filter((p: any) => p.isAlive === false)
      .map((p: any) => `${p.username} (${p.servantName || p.servantClass})`);
    const civilianCasualties = (war.civilianCasualties || []).slice(0, 6).map((c: any) =>
      `${c.name} (struck down by Master ${c.slainByMasterId || 'Unknown'}; Church gas leak cover-up)`
    );
    const totalCasualties = fallenMasters.length + (war.civilianCasualties?.length || 0);
    const casualtyDossier = {
      totalCasualties,
      fallenMasters,
      civilianCasualties
    };
    
    // Also include recent civilian casualties or exposed leaks in general chronicle if relevant
    if (war.civilianCasualties && war.civilianCasualties.length > 0) {
      const recentCas = war.civilianCasualties[0];
      if (recentCas) {
        recentChronicleEvents.push(`Casualty: ${recentCas.name} was slain by ${recentCas.slayerUsername || 'an unknown Master'} (${recentCas.cause || 'collateral damage'})`);
      }
    }

    // Dynamic combat condition calculation with real-time leyline regeneration / recent damage
    const currentHp = userParticipant ? calculateCurrentHp(userParticipant) : (targetServant.currentHp ?? t.baseHp);
    const maxHp = userParticipant?.maxHp ?? t.baseHp;
    const isInChurchAsylum = !!userParticipant?.inChurchSanctuary;
    const killsCount = userParticipant?.kills ?? 0;
    const noblePhantasmName = t.noblePhantasm?.name;

    // Tactical Channel & Bounded Field Context
    const channelName = (interaction.channel as any)?.name || 'general';
    const channelTraps = ((war as any).boundedTraps || []).filter((tr: any) => tr.channelName === channelName && !tr.triggered);
    const hasOwnTrapInChannel = channelTraps.some((tr: any) => tr.setterMasterId === master.discordId);
    const enemyTrapInChannel = channelTraps.some((tr: any) => tr.setterMasterId !== master.discordId);

    const channelFamiliars = ((war as any).familiars || []).filter((f: any) => f.channelName === channelName && f.expiresAt > Date.now());
    const hasOwnFamiliarInChannel = channelFamiliars.some((f: any) => f.masterId === master.discordId);

    const activeBoundedFieldType = userParticipant?.boundedField || (master as any).workshop?.boundedField || 'none';

    let alliedMasters: string[] = [];
    if (userParticipant?.allianceId && war.alliances?.[userParticipant.allianceId]) {
      const alliance = war.alliances[userParticipant.allianceId];
      alliedMasters = (alliance.memberMasterIds || [])
        .filter((id: string) => id !== master.discordId)
        .map((id: string) => war.participants?.[id]?.username || id);
    }

    // War Board & Rival Master statistics
    const otherParticipants = Object.values(war.participants || {}).filter((p: any) => p.discordId !== master.discordId);
    const exposedRivals = otherParticipants
      .filter((p: any) => p.isExposed)
      .map((p: any) => ({
        username: p.username || 'Unknown Master',
        servantClass: p.servantClass || 'Unknown Class',
        servantName: p.servantName,
        isAlive: p.isAlive !== false,
        inSanctuary: !!p.inChurchSanctuary,
        kills: p.kills || 0,
        innocentKills: p.innocentKills || 0,
        isRogueHeretic: (p.innocentKills || 0) >= 10 || !!p.bountyActive
      }));
    const totalAliveMasters = Object.values(war.participants || {}).filter((p: any) => p.isAlive !== false).length;
    const concealedMastersCount = otherParticipants.filter((p: any) => !p.isExposed && p.isAlive !== false).length;
    const eliminatedMastersCount = otherParticipants.filter((p: any) => p.isAlive === false).length;

    const explicitContext = interaction.options.getString('context') as ServantSceneContext | null;
    const sceneContext: ServantSceneContext = explicitContext || (isInChurchAsylum ? 'church' : 'workshop');

    // 1. Generate the dynamic in-character reply with Holy Grail War chat memory and combat awareness
    const { reply } = await generateServantTalkResponse({
      servantName,
      servantClass,
      bondLevel,
      maxBond: 10,
      masterName: master.username || 'Master',
      masterId: master.discordId || interaction.user.id,
      servantId: targetServant.id || targetServant.templateId || servantName.toLowerCase().replace(/\s+/g, '_'),
      warId: war.id || 'default_fuyuki',
      sceneContext,
      commandSeals,
      isExposed,
      equippedCeName,
      customApiConfig: master.customApiConfig,
      recentChronicleEvents,
      recentBattleEvents,
      latestBattleEvent: recentBattleEvents[0],
      interceptedLeaks,
      casualtyDossier,
      latestChurchHomily: war.latestChurchHomily,
      latestNewsBulletin: war.latestNewsBulletin,
      playerMessage,
      servantAvatarUrl: avatarUrl,
      currentHp,
      maxHp,
      isInChurchAsylum,
      killsCount,
      noblePhantasmName,
      channelName,
      hasOwnTrapInChannel,
      hasOwnFamiliarInChannel,
      enemyTrapInChannel,
      alliedMasters,
      activeBoundedFieldType,
      totalAliveMasters,
      exposedRivals,
      concealedMastersCount,
      eliminatedMastersCount
    });

    // Award Bond EXP for dialogue interaction
    const bondExpGain = sceneContext === 'bond' ? 50 : 35;
    const bondRes = addBondExpToServant(targetServant, bondExpGain);
    const updatedTargetServant = bondRes.updatedServant;
    const sIdx = master.servants.findIndex((s: any) => s.id === targetServant.id);
    if (sIdx !== -1) {
      master.servants[sIdx] = updatedTargetServant;
    }
    await saveMaster(master);

    const activeBondLevel = updatedTargetServant.bondLevel || bondLevel;
    const bondNotice = bondRes.didLevelUp ? ` • 🎉 **Bond Lv. ${bondRes.newLevel} Reached!**` : '';

    // 2. STEP 3: Render the Output
    const visual = await renderServantTalkVisualOutput({
      servantName,
      servantClass,
      servantAvatarUrl: avatarUrl,
      servantCardArtUrl: cardArtUrl,
      servantSpriteUrl: spriteUrl,
      replyText: reply,
      playerMessage,
      masterName: master.username || 'Master',
      bondLevel: activeBondLevel,
      sceneContext,
      commandSeals,
      quotaInfo: {
        remainingToday,
        maxToday,
        isByok
      }
    });

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_talk_servant:${targetServant.id}:${sceneContext}`)
        .setLabel('Speak Again 💬')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('quick_servant_card')
        .setLabel('Servant Profile 📜')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('vn_open_sanctum')
        .setLabel('Bond Sanctum 💖')
        .setStyle(ButtonStyle.Secondary)
    );

    // OPTION A: Canvas Card
    if (visual.canvasBuffer) {
      const attachment = new AttachmentBuilder(visual.canvasBuffer, { name: 'talk_card.png' });
      const embed = new EmbedBuilder()
        .setTitle(visual.embedData.title)
        .setDescription(
          `👤 **Master ${master.username}:**\n> *“${playerMessage}”*\n\n` +
          `⚔️ **${servantName}:**\n> ❝ ***${reply}*** ❞\n\n` +
          `💖 **Bond Resonance:** \`+${bondExpGain} Bond EXP\` (Lv. ${activeBondLevel}/10)${bondNotice}`
        )
        .setColor(visual.embedData.color)
        .setImage('attachment://talk_card.png')
        .setFooter({ text: visual.embedData.footer });

      if (avatarUrl) {
        safeSetEmbedThumbnail(embed, avatarUrl);
      }

      return interaction.editReply({
        embeds: [embed],
        files: [attachment],
        components: [actionRow]
      });
    }

    // OPTION B: Embed Fallback (Formatted with Servant's portrait icon & current Bond rank)
    const fallbackEmbed = new EmbedBuilder()
      .setTitle(`💬 Telepathic Link | ${servantName} [Bond Rank: Lv. ${activeBondLevel}/10]`)
      .setDescription(
        `👤 **Master ${master.username}:**\n> *“${playerMessage}”*\n\n` +
        `⚔️ **${servantName}:**\n> ❝ ***${reply}*** ❞\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💖 **Bond Rank:** Level \`${activeBondLevel} / 10\` (+${bondExpGain} EXP)${bondNotice}\n` +
        `💬 **Telepathic Mana:** \`${remainingToday}/${maxToday}\` *daily chats remaining*\n` +
        `🔱 **Command Seals:** \`${'✦ '.repeat(commandSeals)}${'✧ '.repeat(Math.max(0, 3 - commandSeals))}\` (**${commandSeals}/3**)\n` +
        `🛡️ **Equipped CE:** *${equippedCeName || 'None'}*\n` +
        `⚠️ **War Position:** *${isExposed ? 'Exposed on Public War Board' : 'Concealed in Shadows'}*`
      )
      .setColor(visual.embedData.color)
      .setFooter({ text: visual.embedData.footer });

    if (avatarUrl) {
      safeSetEmbedThumbnail(fallbackEmbed, avatarUrl);
    }

    return interaction.editReply({
      embeds: [fallbackEmbed],
      components: [actionRow]
    });

  } catch (error: any) {
    console.error('Error executing /talk:', error);
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('⚠️ Telepathic Resonance Disrupted')
          .setDescription(`The leylines are turbulent: ${error.message || 'Unknown error'}. Try speaking with your Servant again shortly.`)
          .setColor(0xef4444)
      ]
    });
  }
}
