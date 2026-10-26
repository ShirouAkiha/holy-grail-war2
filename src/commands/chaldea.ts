// Chaldea Cafeteria & Campus Hub - Slash Command & Interactive MUD Controller
// Features dual-canvas rendering (Thumbnail map + First-Person Viewport), real-time stationing, and co-op cooking.

import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder, 
  StringSelectMenuOptionBuilder,
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction
} from 'discord.js';
import { 
  CAFETERIA_ROOMS, 
  INGREDIENT_CATALOG, 
  RECIPES_CATALOG, 
  VISITING_PATRONS,
  ATTENDING_DOCTORS,
  CHALDEA_SHOP_CATALOG,
  CHALDEA_RANK_TIERS,
  JUKEBOX_TRACKS,
  CafeteriaRoom 
} from '../data/cafeteriaData';
import { resolveAscensionSprite } from '../data/servantAscensions';
import { 
  getOrCreateStationedMaster, 
  moveMasterRoom, 
  stationMasterCustomStatus, 
  forageIngredientInRoom, 
  depositIngredientToSharedBasin, 
  chopAndPrepBasin, 
  startStoveCooking, 
  stirStovePot, 
  plateFinishedDish, 
  serveDishToPatron, 
  getCafeteriaWorldSnapshot, 
  getRoomStationedMasters,
  getRoomHazard,
  dumpBurntPot,
  getStoveCapacity,
  extinguishRoomHazard,
  repairRoomStructuralDamage,
  instantRepairRoomSQ,
  drinkBurnSalve,
  instantRejuvenationSQ,
  startBedRest,
  setAttendingDoctor,
  bringFruitBasketToFriend,
  craftFruitBasket,
  purchaseChaldeaShopUpgrade,
  clearMasterNotifications,
  performHeroRescue,
  getHeadPrefect,
  getMasterCMPRank,
  getChaldeaRankLeaderboard,
  executeGrabAndDrag,
  executeToiletDunk,
  executeLavatoryLockdown,
  breakRestroomLock,
  washFaceInRestroom,
  callImpeachmentVote,
  castImpeachmentVote,
  addRoomStickyNote,
  getRoomStickyNotes,
  dropItemOnRoomCounter,
  takeItemFromRoomCounter,
  getRoomCounterItems,
  getSandboxPropsState,
  interactWithRoomProp,
  executeCompanionServantAssist,
  StationedMaster
} from '../engine/cafeteriaEngine';
import { 
  renderChaldeaNodeMapCanvas, 
  renderChaldeaLocationCanvas 
} from '../canvas/cafeteriaCanvas';
import { generatePatronFoodReview } from '../services/patronAi';
import { getMaster, saveMaster } from '../database/service';

export const data = new SlashCommandBuilder()
  .setName('chaldea')
  .setDescription('Enter the Chaldea Cafeteria & Campus Hub — a persistent visual novel cooking MUD!')
  .addSubcommand(sub =>
    sub.setName('hub')
      .setDescription('Open your personal Chaldea Cafeteria visual novel viewport')
  )
  .addSubcommand(sub =>
    sub.setName('move')
      .setDescription('Move to another Chaldea facility room')
      .addStringOption(opt =>
        opt.setName('room')
          .setDescription('Target room location')
          .setRequired(true)
          .addChoices(
            { name: 'Dining Hall & Serving Counter', value: 'dining_hall' },
            { name: 'Kitchen — Prep & Cutting Stations', value: 'kitchen_prep' },
            { name: 'Kitchen — Stoves & Commercial Ovens', value: 'kitchen_stove' },
            { name: 'Pantry & Dry Ingredient Vault', value: 'pantry' },
            { name: 'Hydroponics & Sacred Greenhouse', value: 'greenhouse' },
            { name: 'Cold Storage & Deep Freezer', value: 'cold_storage' },
            { name: 'Staff Lounge & Relaxation Break Room', value: 'staff_lounge' },
            { name: 'Chaldea Restrooms & Lavatories', value: 'restrooms' },
            { name: 'Central Hub Corridor', value: 'hallway' }
          )
      )
  )
  .addSubcommand(sub =>
    sub.setName('station')
      .setDescription('Park yourself at your current station with an AFK or activity status')
      .addStringOption(opt =>
        opt.setName('status')
          .setDescription('Your custom status message (e.g. Slicing onions, Sipping tea)')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('forage')
      .setDescription('Gather raw produce or ingredients in your current room')
  )
  .addSubcommand(sub =>
    sub.setName('cook')
      .setDescription('Perform cooking action at your current station')
      .addStringOption(opt =>
        opt.setName('action')
          .setDescription('Action to perform')
          .setRequired(true)
          .addChoices(
            { name: 'Chop & Prep Recipe (at Prep Counter)', value: 'prep' },
            { name: 'Start Cooking Pot (at Stoves)', value: 'start' },
            { name: 'Stir Simmering Pot (at Stoves)', value: 'stir' },
            { name: 'Plate Cooked Dish (at Stoves)', value: 'plate' }
          )
      )
  )
  .addSubcommand(sub =>
    sub.setName('serve')
      .setDescription('Plate and present your cooked dish to a visiting Servant patron')
  )
  .addSubcommand(sub =>
    sub.setName('fridge')
      .setDescription('Inspect the shared community pantry and prep basin')
  )
  .addSubcommand(sub =>
    sub.setName('rankings')
      .setDescription('View Chaldea Merit Points (CMP) leaderboard & Master Hierarchy')
  )
  .addSubcommand(sub =>
    sub.setName('impeach')
      .setDescription('Call a Vote of No Confidence against an abusive Head Prefect')
  );

/**
 * Builds the complete dual-canvas visual novel response for a Master
 */
export async function buildChaldeaViewportResponse(
  discordId: string,
  username: string,
  avatarUrl: string,
  customDialogue?: string
): Promise<{ embeds: EmbedBuilder[]; components: ActionRowBuilder<any>[]; files: AttachmentBuilder[] }> {
  // Fetch master & active servant
  const dbMaster = await getMaster(discordId);
  const activeServant = dbMaster?.servants?.find((s: any) => s.id === dbMaster.activeServantId) || dbMaster?.servants?.[0];
  const sName = activeServant?.nickname || activeServant?.template?.name || 'Heroic Spirit';
  
  // Resolve transparent visual novel figure sprite (matches Bond Sanctum / Interludes)
  const sSprite = resolveAscensionSprite(
    activeServant,
    activeServant?.selectedAscensionStage,
    activeServant?.level,
    activeServant?.bondLevel,
    activeServant?.spriteUrl || activeServant?.customArtworkUrl
  ) || activeServant?.spriteUrl || activeServant?.customArtworkUrl || '';
  const sAvatar = activeServant?.avatarUrl || activeServant?.template?.avatarUrl || sSprite;

  const master = getOrCreateStationedMaster(discordId, username, avatarUrl, sName, sAvatar, sSprite);
  const world = getCafeteriaWorldSnapshot();
  const room = CAFETERIA_ROOMS[master.currentRoomId] || CAFETERIA_ROOMS.dining_hall;
  const roomMasters = getRoomStationedMasters(room.id);
  const activePot = world.stovePots[0];

  // Resolve attending doctor and custom dialogue if in Infirmary
  let leftSpriteUrl: string | undefined = undefined;
  let customSpeakerName: string | undefined = undefined;
  let activeDialogue = customDialogue;

  if (room.id === 'infirmary') {
    const docId = master.attendingDoctorId || 'nightingale';
    const doctor = ATTENDING_DOCTORS[docId] || ATTENDING_DOCTORS.nightingale;
    leftSpriteUrl = doctor.spriteUrl;
    customSpeakerName = doctor.name;
    if (!activeDialogue) {
      const quotes = doctor.iconicQuotes;
      activeDialogue = quotes[Math.floor(Math.random() * quotes.length)];
    }
  }

  // 1. Generate Dual Canvases in parallel
  const [mapBuffer, viewportBuffer] = await Promise.all([
    renderChaldeaNodeMapCanvas(room.id, Object.values(world.masters)),
    renderChaldeaLocationCanvas(room, master, roomMasters, activePot, {
      customDialogue: activeDialogue,
      customSpeakerName: customSpeakerName,
      leftSpriteUrl: leftSpriteUrl,
      allStovePots: world.stovePots,
      stoveCapacity: getStoveCapacity(master)
    })
  ]);

  const mapAttachment = new AttachmentBuilder(mapBuffer, { name: 'chaldea_map.png' });
  const viewportAttachment = new AttachmentBuilder(viewportBuffer, { name: 'chaldea_viewport.png' });

  // 2. Format Stationed Masters Summary
  const otherMasters = roomMasters.filter(m => m.discordId !== master.discordId);
  const mastersSummary = roomMasters.map(m => {
    const isSelf = m.discordId === master.discordId;
    return `• ${isSelf ? '👉 **' : '**'}${m.username}${isSelf ? ' (You)**' : '**'} [${m.companionServantName}]: *"${m.statusText}"* ${m.isAfk ? '💤' : '⚡'}`;
  }).join('\n');

  // 3. Format Workstation Status & Consequence Engine Hazard Checks
  const roomHazard = getRoomHazard(room.id);
  let stationDetails = `*${room.primaryActivityName} is quiet.*`;

  if (roomHazard.stage === 4) {
    stationDetails = `💥 **CRITICAL STRUCTURAL BREAKDOWN (LOCKDOWN):**\nThis room has suffered severe soot and structural damage due to an unaddressed hazard! **All standard cooking and foraging interactions are disabled** until the room is repaired.\n\n*Progress:* **${roomHazard.repairsContributed}/${roomHazard.requiredRepairs || 3} Repair Actions** completed.`;
  } else if (roomHazard.stage === 3) {
    stationDetails = `🔥 **HAZARD FLARE (ON FIRE!):**\nAn active fire is raging in **${room.name}**! Heat and dense smoke are filling the station. Quick action is needed!`;
  } else if (roomHazard.stage === 2) {
    stationDetails = `⚠️ **SMOKE / NEGLECTED:**\nA pot or activity was left unmonitored and is billowing thick grey smoke! Scrape or extinguish it before it flares into a blaze.`;
  } else if (room.id === 'kitchen_prep') {
    if (world.sharedPrepBasin.length > 0) {
      const basinList = world.sharedPrepBasin.map(b => `${b.emoji} **${b.ingredientName}** x${b.count} *(by ${b.depositedBy})*`).join(', ');
      stationDetails = `📦 **Shared Prep Basin:** ${basinList}\n*Use \`[🔪 Chop & Prep]\` to assemble a recipe kit!*`;
    } else {
      stationDetails = `📦 **Shared Prep Basin:** Empty.\n*Deposit gathered produce here so anyone can prepare dishes!*`;
    }
  } else if (room.id === 'kitchen_stove') {
    const maxRanges = getStoveCapacity(master);
    const rangeLines: string[] = [];
    const now = Date.now();
    for (let r = 1; r <= maxRanges; r++) {
      const p = world.stovePots.find(pot => pot.rangeIndex === r);
      if (!p) {
        rangeLines.push(`• **Range #${r}:** ⚪ *Idle Burner Grate (Ready for prepped kit)*`);
      } else if (p.status === 'burnt') {
        rangeLines.push(`• **Range #${r}:** ⚫ **BURNT SLUDGE!** ${p.recipeEmoji} **${p.recipeName}** *(by @${p.startedByUsername})* — Needs Scraped & Dumped!`);
      } else if (p.status === 'ready') {
        const hasPriority = now < p.cookPriorityUntil;
        const remPrio = Math.max(1, Math.ceil((p.cookPriorityUntil - now) / 1000));
        const lockNote = hasPriority
          ? (p.startedByDiscordId === master.discordId ? ` [🔒 Your Priority: ${remPrio}s]` : ` [🔒 Cook Priority: @${p.startedByUsername} (${remPrio}s)]`)
          : ` [🔓 Open to Anyone to Plate!]`;
        rangeLines.push(`• **Range #${r}:** 🟢 **READY TO PLATE!** ${p.recipeEmoji} **${p.recipeName}** (Quality: ${p.qualityScore}/100)${lockNote}`);
      } else {
        const remSec = Math.max(0, Math.ceil((p.readyAt - now) / 1000));
        rangeLines.push(`• **Range #${r}:** 🟡 **SIMMERING (${remSec}s)** ${p.recipeEmoji} **${p.recipeName}** *(by @${p.startedByUsername})* — Stirs: ${p.stirCount}, Q: ${p.qualityScore}/100`);
      }
    }
    stationDetails = `🔥 **Commercial Stove Ranges (${maxRanges} Stations):**\n${rangeLines.join('\n')}`;
  } else if (room.id === 'dining_hall') {
    if (world.activePatronOrders.length > 0) {
      const moodEmojis: Record<string, string> = {
        ravenous: '🔥',
        critical: '🌶️',
        impatient: '⏳',
        curious: '✨'
      };
      stationDetails = `🍽️ **Seated Patron Table Orders:**\n` + world.activePatronOrders.map(o => {
        const patron = VISITING_PATRONS.find(p => p.id === o.patronId);
        const remMin = Math.max(0, Math.ceil((o.expiresAt - Date.now()) / 60000));
        const tNum = o.tableNumber || 1;
        const mood = o.mood || 'ravenous';
        const emoji = moodEmojis[mood] || '✨';
        return `• **Table #${tNum}:** **${patron ? patron.name : 'Visiting Servant'}** (${patron ? patron.servantClass : 'Servant'}) — Craving: **${patron ? patron.cravingName : 'Feast'}** | Mood: *${mood.toUpperCase()}* ${emoji} (${remMin}m left)`;
      }).join('\n');
    } else {
      stationDetails = `🍽️ All tables are set. Visiting patrons arrive periodically!`;
    }
  } else if (room.id === 'infirmary') {
    const docId = master.attendingDoctorId || 'nightingale';
    const doctor = ATTENDING_DOCTORS[docId] || ATTENDING_DOCTORS.nightingale;
    if (master.isHospitalized || master.currentHp < master.maxHp) {
      if (master.activeRecoveryType === 'bed_rest' && master.bedRestStartedAt) {
        const elapsedMs = Math.max(0, Date.now() - master.bedRestStartedAt);
        const elapsedMin = Math.floor(elapsedMs / 60000);
        const remMin = Math.max(0, 60 - elapsedMin);
        const percent = Math.min(100, Math.floor((elapsedMs / (60 * 60 * 1000)) * 100));
        stationDetails = `🛏️ **BED REST IN PROGRESS:**\n• **Attending Doctor:** ${doctor.name} (${doctor.title})\n• **Rest Timer:** **${elapsedMin} / 60 minutes** elapsed (${percent}%)\n• **Vitals:** **${master.currentHp}/${master.maxHp} HP**\n• **Estimated Discharge:** **${remMin} minute(s)** remaining\n\n*Master is safely tucked in bed recovering.*`;
      } else {
        stationDetails = `⚠️ **INCAPACITATED / AWAITING TREATMENT:**\n• **Attending Doctor:** ${doctor.name} (${doctor.title})\n• **Current Health:** **${master.currentHp}/${master.maxHp} HP**\n• **Status:** ${master.burnStatus === 'fainted' ? '🔥 Unconscious / Suffocating' : '🔥 Singed / Injured'}\n\n🛑 **Action Required:** You will not recover automatically. Select a medical treatment option below to begin rehabilitation!`;
      }
    } else {
      stationDetails = `🏥 **Infirmary Ward Clear:**\n• **Attending Doctor on Duty:** ${doctor.name} (${doctor.title})\n• **Your Vitals:** 100/100 HP (Healthy & Discharged)`;
    }
  } else if (room.availableIngredients.length > 0) {
    const ings = room.availableIngredients.map(id => INGREDIENT_CATALOG[id]).filter(Boolean);
    stationDetails = `🌾 **Harvestable Resources:** ${ings.map(i => `${i.emoji} ${i.name}`).join(', ')}`;
  }

  // 4. Player Inventory Ribbon
  const invEntries = Object.entries(master.inventory || {});
  const invStr = invEntries.length > 0
    ? invEntries.map(([id, count]) => {
        const item = INGREDIENT_CATALOG[id];
        return `${item ? item.emoji : '📦'} ${item ? item.name : id} x${count}`;
      }).join(' • ')
    : 'Empty Apron Pockets';

  const platedStr = master.activePlatedDish
    ? `🍽️ **Carrying Plated Dish:** ${master.activePlatedDish.recipeEmoji} **${master.activePlatedDish.recipeName}** (Quality: ${master.activePlatedDish.qualityScore}/100)`
    : '';

  // 5. Active Community Buffs
  const buffsStr = world.activeCommunityBuffs.length > 0
    ? world.activeCommunityBuffs.map(b => `✨ **${b.title}**: ${b.description}`).join('\n')
    : 'None active (Serve dishes to patrons to unlock buffs!)';

  // 5b. Room Event Log (Top 6 campus-wide activity entries so everyone sees disciplinary, hazard, & kitchen events)
  const roomActivities = (world.recentActivityFeed || []).slice(0, 6);
  const roomEventsSummary = roomActivities.length > 0
    ? roomActivities.map(a => `• <t:${Math.floor(a.timestamp / 1000)}:R> ${a.text}`).join('\n')
    : '*No recent events recorded in this sector.*';

  // Format unread notifications / AFK hazard alert / Discipline banners
  // 5c. Master Rank & Prefect Hierarchy Status
  const rankInfo = getMasterCMPRank(master.discordId);
  const headPrefect = getHeadPrefect();
  const isHeadPrefect = rankInfo.isHeadPrefect;
  const rankBadge = isHeadPrefect 
    ? '👑 **CHALDEA HEAD PREFECT** (Chief Overseer)' 
    : `${rankInfo.emoji} **${rankInfo.title}** (Rank ${rankInfo.rank})`;

  // Format unread notifications / AFK hazard alert / Discipline / Campus Hazard banners
  let notifBanner = '';
  const unreadNotifs = master.unreadNotifications || [];

  // Campus-wide hazard alert if another room is on fire or broken down
  const activeEmergencyHazards = Object.entries(world.roomHazards || {}).filter(([rId, h]) => rId !== room.id && h.stage >= 3);
  if (activeEmergencyHazards.length > 0) {
    const hazardList = activeEmergencyHazards.map(([rId, h]) => {
      const rName = CAFETERIA_ROOMS[rId]?.shortName || rId;
      return h.stage === 4 ? `💥 **${rName}** (Breakdown)` : `🔥 **${rName}** (On Fire!)`;
    }).join(' • ');
    notifBanner += `🚨 **CAMPUS EMERGENCY HAZARD ALERT:** Active hazard raging in ${hazardList}! Click \`[🚪 Move Sector]\` to assist!\n\n`;
  }
  
  if (master.isLockedInRestroom && master.lockedUntil && Date.now() < master.lockedUntil) {
    const remMins = Math.max(1, Math.ceil((master.lockedUntil - Date.now()) / 60000));
    notifBanner += `🔒 **LAVATORY LOCKDOWN ACTIVE:** You are locked in the Chaldea Restroom stalls by Prefect Authority! (${remMins}m remaining). Sector movement is barred until the timer expires or a friend busts the lock!\n\n`;
  } else if (world.restroomDoorLockedUntil && Date.now() < world.restroomDoorLockedUntil) {
    const remDoorMins = Math.max(1, Math.ceil((world.restroomDoorLockedUntil - Date.now()) / 60000));
    notifBanner += `🚪 **RESTROOM DEADBOLT BOLTED:** The exterior doors are locked shut! (${remDoorMins}m remaining). Masters in adjacent sectors can click \`[🔓 Pick Lock / Bust Door]\` to liberate trapped students!\n\n`;
  }

  if (world.activeImpeachment && Date.now() < world.activeImpeachment.expiresAt && world.activeImpeachment.status === 'active') {
    const remImpMins = Math.max(1, Math.ceil((world.activeImpeachment.expiresAt - Date.now()) / 60000));
    notifBanner += `🏛️ **CHALDEA HIGH TRIBUNAL: VOTE OF NO CONFIDENCE!**\n"Masters are rising up against Head Prefect @${world.activeImpeachment.targetUsername}'s reign of terror!"\n• **Impeach Votes:** **${world.activeImpeachment.impeachVotes.length}/5** to dethrone\n• **Support Votes:** **${world.activeImpeachment.supportVotes.length}**\n• **Time Remaining:** ${remImpMins} minute(s)\n\n`;
  }

  if (roomHazard.stage >= 2 && master.isAfk) {
    notifBanner += `🚨 **AFK HAZARD EMERGENCY WARNING:**\n⚠️ You are currently **AFK** in **${room.name}** during an active **${roomHazard.hazardType.replace('_', ' ').toUpperCase()}** (Stage ${roomHazard.stage})!\n• *Vitals:* **${master.currentHp}/${master.maxHp} HP** (${master.burnStatus === 'none' ? 'In Danger' : master.burnStatus})\n• *Action Required:* Click **[🧯 Extinguish Fire]** or **[🚪 Move Sector]** immediately!\n\n`;
  } else if (unreadNotifs.length > 0) {
    const latestNotif = unreadNotifs[0];
    notifBanner += `🚨 **UNREAD AFK PAGER ALERT (${unreadNotifs.length}):**\n**${latestNotif.title}** — *${latestNotif.message}*\n\n`;
  }

  const mapEmbed = new EmbedBuilder()
    .setTitle('🗺️ Chaldea Campus Hub — Facility Node Map')
    .setDescription(
      `📍 **Current Sector:** **${room.name}** • 👥 **Stationed Here:** ${roomMasters.length} Master${roomMasters.length === 1 ? '' : 's'} • 🌐 **Online Masters:** ${Object.keys(world.masters).length}`
    )
    .setColor(roomHazard.stage === 4 ? 0x991b1b : roomHazard.stage === 3 ? 0xef4444 : roomHazard.stage === 2 ? 0xf59e0b : 0x00e5ff)
    .setImage('attachment://chaldea_map.png');

  const roomEmbed = new EmbedBuilder()
    .setTitle(`🍵 Chaldea Campus Hub — ${room.name}`)
    .setDescription(
      `${notifBanner}` +
      `🎖️ **Master Standing:** ${rankBadge} • **Merit (CMP):** \`${rankInfo.cmp} pts\`\n` +
      `📍 **Current Location:** **${room.name}**\n` +
      `🎵 *${room.ambientBgm}*\n\n` +
      `${room.description}\n\n` +
      `👥 **Masters Stationed Here (${roomMasters.length}):**\n${mastersSummary}\n\n` +
      `🍲 **Workstation Status:**\n${stationDetails}` +
      (platedStr ? `\n\n${platedStr}` : '') +
      `\n\n📜 **Recent Room Activity:**\n${roomEventsSummary}`
    )
    .setColor(roomHazard.stage === 4 ? 0x991b1b : roomHazard.stage === 3 ? 0xef4444 : roomHazard.stage === 2 ? 0xf59e0b : 0xd4af37)
    .setImage('attachment://chaldea_viewport.png');

  // Sandbox Props & Environment Details
  const sandboxProps = getSandboxPropsState();
  let propsStatus = '';
  if (room.id === 'dining_hall') {
    const curTrack = JUKEBOX_TRACKS[sandboxProps.diningJukeboxTrack] || JUKEBOX_TRACKS.emiya_family;
    const tableStatus = sandboxProps.dirtyTablesCount > 0
      ? `⚠️ Sticky tables with dishes (${sandboxProps.dirtyTablesCount}) — Click Wipe Tables to clean!`
      : `✨ Tables are spotless and sanitized!`;
    const floralStatus = sandboxProps.floralCenterpieces ? `💐 Fresh garden floral centerpieces arranged.` : `🥀 No centerpieces arranged.`;
    propsStatus = `🎶 **Jukebox Playing:** ${curTrack.emoji} **${curTrack.title}**\n• ${curTrack.perkDescription}\n🪑 **Tables:** ${tableStatus} • ${floralStatus}`;
  } else if (room.id === 'greenhouse') {
    const hybrids = sandboxProps.greenhouseHybrids || [];
    const hybridStr = hybrids.length > 0
      ? hybrids.map(h => {
          const isReady = Date.now() >= h.readyAt;
          const remSec = Math.max(0, Math.ceil((h.readyAt - Date.now()) / 1000));
          const ing = INGREDIENT_CATALOG[h.resultIngId];
          const ingName = ing ? ing.name : h.resultIngId;
          const emoji = ing ? ing.emoji : '🌱';
          return `• ${emoji} **${ingName}** (by @${h.plantedBy}): ${isReady ? '🟢 **READY TO HARVEST!**' : `⏳ Sprouting (${remSec}s)`}`;
        }).join('\n')
      : '*Experimental patch is ready for seeds.*';
    propsStatus = `🌿 **Hydroponic Terraces:** Lush UV grow-lamps running.\n🌱 **Cross-Breeding Experimental Patch:**\n${hybridStr}`;
  } else if (room.id === 'pantry') {
    const stash = sandboxProps.hiddenSnackStash;
    const stashNotice = stash
      ? `🗝️ A loose floorboard smells suspiciously like delicious hot food! Someone hid a dish here!`
      : `📦 Floorboard locker is currently empty.`;
    propsStatus = `📦 **Storage Crates:** Unlabeled supply crates ready to rummage.\n${stashNotice}`;
  } else if (room.id === 'kitchen_stove') {
    const flameTitles = {
      low_simmer: '🕯️ Low Simmer (Gentle, zero burn risk)',
      standard: '🔥 Standard Heat (Balanced)',
      overdrive: '⚡ Mana Burst Overdrive (2x Speed & 2x Burn Rate!)'
    };
    propsStatus = `🎛️ **Flame Tuning Dial:** **${flameTitles[sandboxProps.stoveFlameMode || 'standard']}**\n🪵 **Hearth:** Charred ash residue available to scrape.`;
  } else if (room.id === 'staff_lounge') {
    propsStatus = `🍵 **The Grand Kotatsu:** Warm blanket & tea kettle ready for Masters.\n📖 **Chaldea Kitchen Lore Grimoires:** Ready on the bookshelf.`;
  }

  // Room Countertop Items (Shared drop/take)
  const counterItems = getRoomCounterItems(room.id);
  const counterStr = counterItems.length > 0
    ? counterItems.map(i => `${i.emoji} **${i.ingredientName}** x${i.count} *(by @${i.droppedBy})*`).join(' • ')
    : '*Countertop is clear. Use `[ 📦 Drop Item ]` to place items here for teammates!*';

  // Room Sticky Notes / Bulletin
  const stickyNotes = getRoomStickyNotes(room.id);
  const notesStr = stickyNotes.length > 0
    ? stickyNotes.map(n => `• *" ${n.text} "* — **@${n.authorName}** (<t:${Math.floor(n.timestamp / 1000)}:R>)`).join('\n')
    : '*No notes pinned yet. Click `[ 📝 Write Note ]` to pin a memo on this board!*';

  roomEmbed.addFields(
    {
      name: '🎒 Your Inventory',
      value: invStr,
      inline: false
    },
    {
      name: '🛠️ Room Environment & Props',
      value: propsStatus || '*Standard facility room amenities.*',
      inline: false
    },
    {
      name: `🧺 Shared Countertop Storage (${counterItems.length}/6 slots)`,
      value: counterStr,
      inline: false
    },
    {
      name: `📝 Room Bulletin & Sticky Notes (${stickyNotes.length}/5)`,
      value: notesStr,
      inline: false
    },
    {
      name: '🌟 Active Community Cafeteria Buffs',
      value: buffsStr,
      inline: false
    }
  )
  .setFooter({
    text: `Chaldea Cafeteria MUD • Consequence Engine • Real-time Co-Op`
  })
  .setTimestamp();

  // 7. Interactive Buttons Row 1: Contextual Station Action Buttons (Max 5)
  const actionButtons: ButtonBuilder[] = [];

  // Head Prefect Authority Button (Only unlocked by #1 Ranked Master)
  if (isHeadPrefect) {
    actionButtons.push(
      new ButtonBuilder()
        .setCustomId('chaldea_action_prefect_menu')
        .setLabel('⚖️ Prefect Action')
        .setStyle(ButtonStyle.Danger)
    );
  }

  // Restroom Door Counterplay: Pick Lock / Bust Door
  const isRestroomDoorLocked = Boolean(world.restroomDoorLockedUntil && Date.now() < world.restroomDoorLockedUntil);
  if (isRestroomDoorLocked && ['restrooms', 'hallway', 'staff_lounge'].includes(room.id)) {
    actionButtons.push(
      new ButtonBuilder()
        .setCustomId('chaldea_action_bust_door')
        .setLabel('🔓 Pick Lock / Bust Door')
        .setStyle(ButtonStyle.Danger)
    );
  }

  if (room.id === 'infirmary') {
    // Infirmary Ward Mode: Recovery Actions
    actionButtons.push(
      new ButtonBuilder()
        .setCustomId('chaldea_action_bed_rest')
        .setLabel(master.activeRecoveryType === 'bed_rest' ? '🛏️ Bed Rest (In Progress)' : '🛏️ Bed Rest (1 hr)')
        .setStyle(master.activeRecoveryType === 'bed_rest' ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('chaldea_action_drink_salve')
        .setLabel('🧪 Burn Salve')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('chaldea_action_rejuvenate_sq')
        .setLabel('💎 Rejuvenate (500 SQ)')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('chaldea_action_fruit_basket_select')
        .setLabel('🤝 Bring Fruit Basket')
        .setStyle(ButtonStyle.Success)
    );
  } else if (room.id === 'restrooms') {
    // Restrooms & Maintenance Mode Actions
    actionButtons.push(
      new ButtonBuilder()
        .setCustomId('chaldea_action_wash_face')
        .setLabel('🧼 Wash Face (+10 HP)')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('chaldea_action_check_reflection')
        .setLabel('🪞 Check Reflection')
        .setStyle(ButtonStyle.Secondary)
    );
  } else if (roomHazard.stage === 4) {
    // Structural Breakdown Mode: Only Repair / Instant Fix / Retreat available!
    actionButtons.push(
      new ButtonBuilder()
        .setCustomId('chaldea_action_repair_manual')
        .setLabel(`🛠️ Repair (${roomHazard.repairsContributed}/${roomHazard.requiredRepairs || 3})`)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('chaldea_action_repair_sq')
        .setLabel('💎 Instant Fix (5 SQ)')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('chaldea_action_retreat')
        .setLabel('🚪 Retreat to Corridor')
        .setStyle(ButtonStyle.Danger)
    );
  } else {
    // Active Hazard / Normal Room Actions
    if (roomHazard.stage >= 2 || (room.id === 'kitchen_stove' && world.stovePots.some(p => p.status === 'burnt'))) {
      actionButtons.push(
        new ButtonBuilder()
          .setCustomId('chaldea_action_extinguish')
          .setLabel('🧯 Extinguish Fire')
          .setStyle(ButtonStyle.Danger)
      );
      if (world.stovePots.some(p => p.status === 'burnt')) {
        actionButtons.push(
          new ButtonBuilder()
            .setCustomId('chaldea_action_dump_pot')
            .setLabel('🗑️ Dump Burnt Sludge')
            .setStyle(ButtonStyle.Secondary)
        );
      }
    }

    if (room.availableIngredients.length > 0) {
      actionButtons.push(
        new ButtonBuilder()
          .setCustomId('chaldea_action_forage')
          .setLabel('🌾 Gather / Harvest')
          .setStyle(ButtonStyle.Success)
      );
    }

    if (room.id === 'greenhouse') {
      actionButtons.push(
        new ButtonBuilder()
          .setCustomId('chaldea_action_craft_basket')
          .setLabel('🧺 Craft Fruit Basket')
          .setStyle(ButtonStyle.Primary)
      );
    }

    if (room.id === 'kitchen_prep') {
      actionButtons.push(
        new ButtonBuilder()
          .setCustomId('chaldea_action_deposit')
          .setLabel('📦 Deposit to Basin')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('chaldea_action_prep_select')
          .setLabel('🔪 Chop & Prep Recipe')
          .setStyle(ButtonStyle.Success)
      );
    } else if (room.id === 'kitchen_stove') {
      actionButtons.push(
        new ButtonBuilder()
          .setCustomId('chaldea_action_cook_select')
          .setLabel('🔥 Start Cooking')
          .setStyle(ButtonStyle.Danger)
      );

      // Dedicated range buttons for each active pot on the ranges
      const sortedPots = [...world.stovePots].sort((a, b) => a.rangeIndex - b.rangeIndex);
      for (const pot of sortedPots.slice(0, 3)) {
        if (pot.status === 'simmering') {
          actionButtons.push(
            new ButtonBuilder()
              .setCustomId(`chaldea_stove_stir_range:${pot.rangeIndex}`)
              .setLabel(`🥄 Stir R#${pot.rangeIndex}`)
              .setStyle(ButtonStyle.Primary)
          );
        } else if (pot.status === 'ready') {
          actionButtons.push(
            new ButtonBuilder()
              .setCustomId(`chaldea_stove_plate_range:${pot.rangeIndex}`)
              .setLabel(`🍽️ Plate R#${pot.rangeIndex}`)
              .setStyle(ButtonStyle.Success)
          );
        } else if (pot.status === 'burnt') {
          actionButtons.push(
            new ButtonBuilder()
              .setCustomId(`chaldea_stove_dump_range:${pot.rangeIndex}`)
              .setLabel(`🗑️ Dump R#${pot.rangeIndex}`)
              .setStyle(ButtonStyle.Secondary)
          );
        }
      }
    } else if (room.id === 'dining_hall') {
      actionButtons.push(
        new ButtonBuilder()
          .setCustomId('chaldea_action_serve_select')
          .setLabel('⭐ Present to Patron')
          .setStyle(ButtonStyle.Success)
      );
    }
  }

  // Active High Tribunal Impeachment Voting Buttons
  if (world.activeImpeachment && Date.now() < world.activeImpeachment.expiresAt && world.activeImpeachment.status === 'active') {
    actionButtons.push(
      new ButtonBuilder()
        .setCustomId('chaldea_impeach_vote_impeach')
        .setLabel(`🗳️ Impeach (${world.activeImpeachment.impeachVotes.length}/5)`)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('chaldea_impeach_vote_support')
        .setLabel(`🛡️ Support (${world.activeImpeachment.supportVotes.length})`)
        .setStyle(ButtonStyle.Success)
    );
  }

  // Row 1: Station Actions (Max 5 buttons)
  const stationRow = actionButtons.length > 0
    ? new ActionRowBuilder<ButtonBuilder>().addComponents(actionButtons.slice(0, 5))
    : null;

  // 8. Row 2: Dynamic Sandbox Props & Environment Select Menu
  const sandboxMenu = new StringSelectMenuBuilder()
    .setCustomId('chaldea_select_room_sandbox_prop')
    .setPlaceholder(`🔍 Explore Room Props & Sandbox Environment (${room.shortName})...`);

  if (room.id === 'dining_hall') {
    sandboxMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('🍳 Jukebox: Emiya Family (-15% Wait)')
        .setValue('dining_jukebox:emiya_family')
        .setDescription("Play gentle acoustic melodies that soothe waiting patrons"),
      new StringSelectMenuOptionBuilder()
        .setLabel('🎷 Jukebox: Midnight Jazz (+10% Quality)')
        .setValue('dining_jukebox:jazz_cafe')
        .setDescription("Play smooth bistro jazz to boost dish culinary quality"),
      new StringSelectMenuOptionBuilder()
        .setLabel('🎪 Jukebox: Carnival Phantasm (+25% CMP)')
        .setValue('dining_jukebox:carnival_phantasm')
        .setDescription("Play hyperactive brass for +25% bonus CMP earned"),
      new StringSelectMenuOptionBuilder()
        .setLabel('⚔️ Jukebox: Grand Battle (+1 Harvest Yield)')
        .setValue('dining_jukebox:grand_battle')
        .setDescription("Play symphonic orchestra for +1 bonus foraging yield"),
      new StringSelectMenuOptionBuilder()
        .setLabel('🧽 Wipe & Sanitize Dining Tables (+15 CMP)')
        .setValue('dining_wipe')
        .setDescription("Clear sticky bowls & sanitize tables to attract 5★ patrons"),
      new StringSelectMenuOptionBuilder()
        .setLabel('💐 Set Floral Centerpieces (+20 CMP)')
        .setValue('dining_floral')
        .setDescription("Arrange fresh garden blooms on every dining table")
    );
  } else if (room.id === 'greenhouse') {
    sandboxMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('✂️ Pruning Shears (Foliage & Phantasmal Dew)')
        .setValue('greenhouse_prune')
        .setDescription("Trim yellow leaves & collect shimmering Phantasmal Dew"),
      new StringSelectMenuOptionBuilder()
        .setLabel('🌱 Cross-Breeding Patch (Fuse 2 Seeds)')
        .setValue('greenhouse_crossbreed_plant')
        .setDescription("Plant two apron ingredients to grow a rare hybrid"),
      new StringSelectMenuOptionBuilder()
        .setLabel('🌾 Harvest Hybrids (+25 CMP/FP)')
        .setValue('greenhouse_crossbreed_harvest')
        .setDescription("Collect mature hybrid crops from the experimental patch")
    );
  } else if (room.id === 'pantry') {
    sandboxMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('📦 Rummage Unlabeled Crates (Scavenger Hunt)')
        .setValue('pantry_rummage')
        .setDescription("Search crates for salt, rare cooking wine, aged cheese, or Fou!"),
      new StringSelectMenuOptionBuilder()
        .setLabel('🗝️ Secret Floorboard Locker: Hide Carried Dish')
        .setValue('pantry_stash_dish')
        .setDescription("Hide your plated dish under loose boards away from hungry eyes"),
      new StringSelectMenuOptionBuilder()
        .setLabel('🕵️ Search Floorboards for Hidden Snacks')
        .setValue('pantry_search_stash')
        .setDescription("Sniff out and heist dishes hidden by other Masters")
    );
  } else if (room.id === 'kitchen_stove') {
    sandboxMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('🔥 Flame Control: Toggle Simmer / Standard / Overdrive')
        .setValue('stove_toggle_flame')
        .setDescription("Adjust burner flames between Low Simmer, Standard, and Overdrive"),
      new StringSelectMenuOptionBuilder()
        .setLabel('🪵 Scrape Hearth Charcoal (+10 CMP)')
        .setValue('stove_scrape_charcoal')
        .setDescription("Scrape purified charcoal residue from the ovens")
    );
  } else if (room.id === 'staff_lounge') {
    sandboxMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('🍵 Grand Kotatsu: Serve Green Tea to all Masters')
        .setValue('lounge_tea')
        .setDescription("Brew warm Uji matcha for everyone sitting around the kotatsu (+20 FP)"),
      new StringSelectMenuOptionBuilder()
        .setLabel('🎲 Roll Dice Duel (2d6 Challenge)')
        .setValue('lounge_dice')
        .setDescription("Roll a pair of dice at the kotatsu table for games with friends"),
      new StringSelectMenuOptionBuilder()
        .setLabel('📖 Read Chaldea Kitchen Lore & Grimoires')
        .setValue('lounge_lore')
        .setDescription("Browse hilarious kitchen memoirs by Bedivere, Emiya, Kotomine, etc.")
    );
  }

  // Universal sandbox options available in all rooms
  sandboxMenu.addOptions(
    new StringSelectMenuOptionBuilder()
      .setLabel('📝 Write Note on Room Bulletin')
      .setValue('general_write_note')
      .setDescription("Pin a persistent note on this room's corkboard"),
    new StringSelectMenuOptionBuilder()
      .setLabel('📦 Drop Item onto Room Counter')
      .setValue('general_drop_counter')
      .setDescription("Leave an ingredient on the shared counter for teammates"),
    new StringSelectMenuOptionBuilder()
      .setLabel('🧺 Pick Up Item from Room Counter')
      .setValue('general_take_counter')
      .setDescription("Take a shared item sitting on this room's countertop"),
    new StringSelectMenuOptionBuilder()
      .setLabel('🛒 Visit Chaldea Supply Shop')
      .setValue('facility_shop')
      .setDescription("Purchase permanent station upgrades and supplies"),
    new StringSelectMenuOptionBuilder()
      .setLabel('🏆 View CMP Rankings & Hierarchy')
      .setValue('facility_rankings')
      .setDescription("Inspect Master ranks, Prefect titles, and merit scores"),
    new StringSelectMenuOptionBuilder()
      .setLabel('📌 Set AFK / Station Status Memo')
      .setValue('facility_status')
      .setDescription("Update your public speech bubble or toggle AFK mode")
  );

  const sandboxRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(sandboxMenu);

  // 9. Row 3: Social & Companion Sandbox Action Buttons (5 Buttons)
  const socialRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('chaldea_action_companion_assist')
      .setLabel('🤝 Servant Assist')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('chaldea_action_write_note')
      .setLabel('📝 Write Note')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('chaldea_action_drop_counter')
      .setLabel('📦 Drop Item')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('chaldea_action_take_counter')
      .setLabel('🧺 Take Counter')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('chaldea_action_refresh')
      .setLabel('🔄 Refresh')
      .setStyle(ButtonStyle.Secondary)
  );

  // 10. Row 4: Room Movement Select Menu
  const roomSelect = new StringSelectMenuBuilder()
    .setCustomId('chaldea_select_move')
    .setPlaceholder(`🚪 Move to Another Room (Currently in ${room.shortName})...`);

  for (const [rId, rData] of Object.entries(CAFETERIA_ROOMS)) {
    const isHere = rId === room.id;
    const isAdjacent = room.connections.includes(rId);
    roomSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(`${isHere ? '📍 ' : isAdjacent ? '🚪 ' : '🚶 '}${rData.shortName}`)
        .setValue(rId)
        .setDescription(rData.name.slice(0, 50))
        .setDefault(isHere)
    );
  }

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(roomSelect);

  const finalComponents: ActionRowBuilder<any>[] = [];
  if (stationRow) finalComponents.push(stationRow);
  finalComponents.push(sandboxRow);
  finalComponents.push(socialRow);
  finalComponents.push(selectRow);

  return {
    embeds: [mapEmbed, roomEmbed],
    components: finalComponents,
    files: [mapAttachment, viewportAttachment]
  };
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const sub = interaction.options.getSubcommand(false) || 'hub';

  if (sub === 'rankings') {
    const lb = getChaldeaRankLeaderboard();
    const prefect = getHeadPrefect();
    const desc = lb.map((m, idx) => {
      const crown = m.isPrefect ? '👑 ' : `${idx + 1}. `;
      return `${crown}${m.emoji} **${m.username}** — \`${m.cmp} CMP\` (${m.title})${m.isPrefect ? ' ⭐ **[Head Prefect]**' : ''}`;
    }).join('\n') || '*No registered Masters yet. Cook, clean, or extinguish hazards to earn CMP!*';

    const embed = new EmbedBuilder()
      .setTitle('🏆 Chaldea Campus Hierarchy — Merit Point Rankings')
      .setDescription(
        `Welcome to the **Chaldea Master Discipline & Hierarchy Registry**!\n` +
        `Masters earn **Chaldea Merit Points (CMP)** by performing proper facility activities:\n` +
        `• 🍽️ Serving dishes to patrons: **+15 CMP**\n` +
        `• 🧯 Extinguishing fires & hazards: **+25 CMP**\n` +
        `• 🛠️ Repairing broken flues & counters: **+25 CMP**\n` +
        `• 🍎 Gifting fruit baskets in Infirmary: **+10 CMP**\n` +
        `• 🔓 Busting restroom padlocks: **+15 CMP**\n` +
        `• 🧼 Washing face in restrooms: **+5 CMP**\n\n` +
        `👑 **Reigning Head Prefect:** ${prefect ? `**@${prefect.username}** (\`${prefect.meritPoints || 0} CMP\`)` : '*Position Vacant*'}\n\n` +
        `📜 **Master Leaderboard:**\n${desc}\n\n` +
        `⚖️ *The #1 Ranked Master wields Disciplinary Authority (Grab & Drag, Toilet Dunk, Lavatory Lockdown). To check tyranny, Masters can initiate a \`/chaldea impeach\` Vote of No Confidence!*`
      )
      .setColor(0xd4af37)
      .setFooter({ text: 'Chaldea Discipline Hierarchy • Impeachment threshold: 5 votes to dethrone' });

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (sub === 'impeach') {
    const res = callImpeachmentVote(interaction.user.id);
    const vote = res.activeVote;
    const embed = new EmbedBuilder()
      .setTitle('🏛️ Chaldea High Tribunal — Vote of No Confidence')
      .setDescription(res.message)
      .setColor(0xd97706);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('chaldea_impeach_vote_impeach')
        .setLabel(`🗳️ Impeach & Dethrone (${vote?.impeachVotes?.length || 1}/5)`)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('chaldea_impeach_vote_support')
        .setLabel(`🛡️ Support Prefect (${vote?.supportVotes?.length || 0})`)
        .setStyle(ButtonStyle.Success)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
    return;
  }

  if (sub === 'move') {
    const target = interaction.options.getString('room', true);
    const res = moveMasterRoom(interaction.user.id, target);
    if (!res.success) {
      await interaction.editReply({ content: res.message });
      return;
    }
  } else if (sub === 'station') {
    const status = interaction.options.getString('status', true);
    const res = stationMasterCustomStatus(interaction.user.id, status);
    if (!res.success) {
      await interaction.editReply({ content: res.message });
      return;
    }
  } else if (sub === 'forage') {
    const res = forageIngredientInRoom(interaction.user.id);
    if (!res.success) {
      await interaction.editReply({ content: res.message });
      return;
    }
  } else if (sub === 'cook') {
    const act = interaction.options.getString('action', true);
    if (act === 'stir') {
      const res = stirStovePot(interaction.user.id);
      if (!res.success) {
        await interaction.editReply({ content: res.message });
        return;
      }
    } else if (act === 'plate') {
      const res = plateFinishedDish(interaction.user.id);
      if (!res.success) {
        await interaction.editReply({ content: res.message });
        return;
      }
    }
  }

  const payload = await buildChaldeaViewportResponse(
    interaction.user.id,
    interaction.user.username,
    interaction.user.displayAvatarURL()
  );

  await interaction.editReply({
    embeds: payload.embeds,
    components: payload.components,
    files: payload.files
  });
}

/**
 * Dispatches interactive button clicks, select menus, and modals for Chaldea
 */
export async function handleChaldeaGlobalInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction
): Promise<boolean> {
  const customId = interaction.customId;
  if (!customId.startsWith('chaldea_')) return false;

  const discordId = interaction.user.id;
  const username = interaction.user.username;
  const avatarUrl = interaction.user.displayAvatarURL();

  // 1. Move Room Select Menu
  if (interaction.isStringSelectMenu() && customId === 'chaldea_select_move') {
    await interaction.deferUpdate();
    const targetRoom = interaction.values[0];
    moveMasterRoom(discordId, targetRoom);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    return true;
  }

  // 1b. Button: Dump Burnt Sludge
  if (interaction.isButton() && customId === 'chaldea_action_dump_pot') {
    await interaction.deferUpdate();
    dumpBurntPot(discordId);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    return true;
  }

  // 1c. Button: Extinguish Fire
  if (interaction.isButton() && customId === 'chaldea_action_extinguish') {
    await interaction.deferUpdate();
    const master = getOrCreateStationedMaster(discordId, username, avatarUrl);
    extinguishRoomHazard(discordId, master.currentRoomId);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    return true;
  }

  // 1d. Button: Manual Repair (Free Effort Clicks)
  if (interaction.isButton() && customId === 'chaldea_action_repair_manual') {
    await interaction.deferUpdate();
    const master = getOrCreateStationedMaster(discordId, username, avatarUrl);
    repairRoomStructuralDamage(discordId, master.currentRoomId);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    return true;
  }

  // 1e. Button: Instant Fix (Spendable Saint Quartz)
  if (interaction.isButton() && customId === 'chaldea_action_repair_sq') {
    await interaction.deferUpdate();
    const master = getOrCreateStationedMaster(discordId, username, avatarUrl);
    const dbMaster = await getMaster(discordId);
    const costSq = 5;

    if (!dbMaster || (dbMaster.saintQuartz || 0) < costSq) {
      await interaction.followUp({
        flags: MessageFlags.Ephemeral,
        content: `❌ You need at least **${costSq} Saint Quartz** (earned from raids, duels, and achievements) for instant restoration! You currently have **${dbMaster?.saintQuartz || 0} SQ**.\n*Use [🛠️ Repair Flues] for free manual repair instead!*`
      });
      return true;
    }

    dbMaster.saintQuartz -= costSq;
    await saveMaster(dbMaster);

    instantRepairRoomSQ(discordId, master.currentRoomId, costSq);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    return true;
  }

  // 1f. Button: Retreat to Corridor
  if (interaction.isButton() && customId === 'chaldea_action_retreat') {
    await interaction.deferUpdate();
    moveMasterRoom(discordId, 'hallway');
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    return true;
  }

  // 1g. Button: Bed Rest in Infirmary
  if (interaction.isButton() && customId === 'chaldea_action_bed_rest') {
    await interaction.deferUpdate();
    const result = startBedRest(discordId);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    await interaction.followUp({
      flags: MessageFlags.Ephemeral,
      content: result.message
    });
    return true;
  }

  // 1g-2. Button: Switch Attending Doctor in Infirmary
  if (interaction.isButton() && customId === 'chaldea_action_switch_doctor') {
    await interaction.deferUpdate();
    const master = getOrCreateStationedMaster(discordId, username, avatarUrl);
    const docCycle: Array<'nightingale' | 'asclepius' | 'bb' | 'paracelsus'> = ['nightingale', 'asclepius', 'bb', 'paracelsus'];
    const currentDoc = master.attendingDoctorId || 'nightingale';
    const nextIdx = (docCycle.indexOf(currentDoc) + 1) % docCycle.length;
    const nextDocId = docCycle[nextIdx];
    setAttendingDoctor(discordId, nextDocId);

    const docObj = ATTENDING_DOCTORS[nextDocId];
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    await interaction.followUp({
      flags: MessageFlags.Ephemeral,
      content: `🩺 **ATTENDING PHYSICIAN PAGED:** **${docObj.name}** (${docObj.title}) has taken charge of your bedside!`
    });
    return true;
  }

  // 1h. Button: Drink Burn Salve
  if (interaction.isButton() && customId === 'chaldea_action_drink_salve') {
    await interaction.deferUpdate();
    const res = drinkBurnSalve(discordId);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    await interaction.followUp({ flags: MessageFlags.Ephemeral, content: res.message });
    return true;
  }

  // 1i. Button: Instant Rejuvenation (500 SQ)
  if (interaction.isButton() && customId === 'chaldea_action_rejuvenate_sq') {
    await interaction.deferUpdate();
    const dbMaster = await getMaster(discordId);
    const costSq = 500;
    if (!dbMaster || (dbMaster.saintQuartz || 0) < costSq) {
      await interaction.followUp({
        flags: MessageFlags.Ephemeral,
        content: `❌ You need at least **${costSq} Saint Quartz** for divine stasis rejuvenation! You currently have **${dbMaster?.saintQuartz || 0} SQ**.\n*Use [🧪 Drink Burn Salve] or [🛏️ Bed Rest] to recover for free!*`
      });
      return true;
    }

    dbMaster.saintQuartz -= costSq;
    await saveMaster(dbMaster);

    instantRejuvenationSQ(discordId, costSq);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    return true;
  }

  // 1j. Button: Bring Fruit Basket Select
  if (interaction.isButton() && customId === 'chaldea_action_fruit_basket_select') {
    const world = getCafeteriaWorldSnapshot();
    const roomMasters = getRoomStationedMasters('infirmary').filter(m => m.discordId !== discordId);

    if (roomMasters.length === 0) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: 'There are currently no other hospitalized friends in the Infirmary beds!'
      });
      return true;
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('chaldea_action_fruit_basket_execute')
      .setPlaceholder('Select a hospitalized friend to present a Fruit Basket...');

    for (const friend of roomMasters.slice(0, 25)) {
      select.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`🍎 ${friend.username} (${friend.currentHp}/${friend.maxHp} HP)`)
          .setValue(friend.discordId)
          .setDescription(`Hospitalized in Infirmary • Cut recovery time`)
      );
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: '🍎 **Select a hospitalized friend to visit with a Fruit Basket:**',
      components: [row]
    });
    return true;
  }

  // 1k. Execute Fruit Basket Delivery
  if (interaction.isStringSelectMenu() && customId === 'chaldea_action_fruit_basket_execute') {
    await interaction.deferUpdate();
    const targetId = interaction.values[0];
    const res = bringFruitBasketToFriend(discordId, targetId);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    await interaction.followUp({ flags: MessageFlags.Ephemeral, content: res.message });
    return true;
  }

  // 1l. Button: Hero Rescue Select
  if (interaction.isButton() && customId === 'chaldea_action_rescue_select') {
    const master = getOrCreateStationedMaster(discordId, username, avatarUrl);
    const roomMasters = getRoomStationedMasters(master.currentRoomId).filter(m => m.discordId !== discordId && (m.currentHp < m.maxHp || m.burnStatus === 'singed' || m.burnStatus === 'fainted'));

    if (roomMasters.length === 0) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: 'There are no coughing or fainted friends in this room needing rescue!'
      });
      return true;
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('chaldea_action_rescue_execute')
      .setPlaceholder('Select an unconscious friend to drag to safety...');

    for (const friend of roomMasters.slice(0, 25)) {
      select.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`🚑 Rescue ${friend.username} (${friend.statusText})`)
          .setValue(friend.discordId)
          .setDescription(`Drag out of flames to Infirmary • Earn +100 FP`)
      );
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: '🚑 **Select an endangered friend to drag out of the flames:**',
      components: [row]
    });
    return true;
  }

  // 1m. Execute Hero Rescue
  if (interaction.isStringSelectMenu() && customId === 'chaldea_action_rescue_execute') {
    await interaction.deferUpdate();
    const targetId = interaction.values[0];
    const res = performHeroRescue(discordId, targetId);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    await interaction.followUp({ flags: MessageFlags.Ephemeral, content: res.message });
    return true;
  }

  // 2. Button: Harvest / Forage
  if (interaction.isButton() && customId === 'chaldea_action_forage') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const res = forageIngredientInRoom(discordId);
    await interaction.editReply({ content: res.message });
    return true;
  }

  // 2b. Button: Craft Fruit Basket
  if (interaction.isButton() && customId === 'chaldea_action_craft_basket') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const res = craftFruitBasket(discordId);
    await interaction.editReply({ content: res.message });
    return true;
  }

  // 2c. Button: Open Chaldea Shop
  if (interaction.isButton() && customId === 'chaldea_action_shop_open') {
    const master = getOrCreateStationedMaster(discordId, username, avatarUrl);
    const fp = master.friendPoints || 0;
    const upg = master.facilityUpgrades || { extraStoves: 0, extraPrepCounters: 0, hydroponicLamps: 0 };

    const shopEmbed = new EmbedBuilder()
      .setTitle('🛒 Chaldea Facility & Capacity Shop')
      .setDescription(
        `Welcome to the **Chaldea Capacity Upgrade Shop**!\n` +
        `Spend **Friend Points (FP)** earned from gifting Fruit Baskets, serving meals, and rescuing friends to upgrade facility capacity so multiple Masters can perform tasks simultaneously.\n\n` +
        `💰 **Your Current Balance:** **${fp} Friend Points**\n\n` +
        `🔥 **Heavy Industrial Gas Stove** (Current Lvl: ${upg.extraStoves}/3)\n` +
        `• *Perk:* +2 Active Stove slots per level (Base: 4 pots)\n` +
        `• *Next Level Cost:* ${upg.extraStoves! >= 3 ? 'MAXED' : `${CHALDEA_SHOP_CATALOG.extra_stove.baseCostFP * (upg.extraStoves! + 1)} FP`}\n\n` +
        `🔪 **Marble Dual Prep Station** (Current Lvl: ${upg.extraPrepCounters}/3)\n` +
        `• *Perk:* Parallel prep counter workspace & double prep efficiency\n` +
        `• *Next Level Cost:* ${upg.extraPrepCounters! >= 3 ? 'MAXED' : `${CHALDEA_SHOP_CATALOG.extra_prep_counter.baseCostFP * (upg.extraPrepCounters! + 1)} FP`}\n\n` +
        `💡 **High-Output Magic UV Grow-Lamps** (Current Lvl: ${upg.hydroponicLamps}/3)\n` +
        `• *Perk:* +1 Bonus harvested produce yield in Greenhouse per level\n` +
        `• *Next Level Cost:* ${upg.hydroponicLamps! >= 3 ? 'MAXED' : `${CHALDEA_SHOP_CATALOG.hydroponic_uv_lamps.baseCostFP * (upg.hydroponicLamps! + 1)} FP`}`
      )
      .setColor(0xd4af37);

    const shopButtons: ButtonBuilder[] = [];
    if (upg.extraStoves! < 3) {
      shopButtons.push(
        new ButtonBuilder()
          .setCustomId('chaldea_action_shop_buy_extra_stove')
          .setLabel(`Buy Stove Lvl ${upg.extraStoves! + 1} (${CHALDEA_SHOP_CATALOG.extra_stove.baseCostFP * (upg.extraStoves! + 1)} FP)`)
          .setStyle(ButtonStyle.Success)
      );
    }
    if (upg.extraPrepCounters! < 3) {
      shopButtons.push(
        new ButtonBuilder()
          .setCustomId('chaldea_action_shop_buy_extra_prep_counter')
          .setLabel(`Buy Prep Lvl ${upg.extraPrepCounters! + 1} (${CHALDEA_SHOP_CATALOG.extra_prep_counter.baseCostFP * (upg.extraPrepCounters! + 1)} FP)`)
          .setStyle(ButtonStyle.Success)
      );
    }
    if (upg.hydroponicLamps! < 3) {
      shopButtons.push(
        new ButtonBuilder()
          .setCustomId('chaldea_action_shop_buy_hydroponic_uv_lamps')
          .setLabel(`Buy Lamps Lvl ${upg.hydroponicLamps! + 1} (${CHALDEA_SHOP_CATALOG.hydroponic_uv_lamps.baseCostFP * (upg.hydroponicLamps! + 1)} FP)`)
          .setStyle(ButtonStyle.Success)
      );
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(shopButtons.length > 0 ? shopButtons : [
      new ButtonBuilder().setCustomId('chaldea_shop_maxed').setLabel('✨ All Facility Upgrades Maxed!').setStyle(ButtonStyle.Secondary).setDisabled(true)
    ]);

    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [shopEmbed],
      components: [row]
    });
    return true;
  }

  // 2d. Button: Purchase Chaldea Shop Item
  if (interaction.isButton() && customId.startsWith('chaldea_action_shop_buy_')) {
    await interaction.deferUpdate();
    const itemId = customId.replace('chaldea_action_shop_buy_', '');
    const res = purchaseChaldeaShopUpgrade(discordId, itemId);

    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    await interaction.followUp({ flags: MessageFlags.Ephemeral, content: res.message });
    return true;
  }

  // 2e. Button: Clear Unread Notifications
  if (interaction.isButton() && customId === 'chaldea_action_clear_notifs') {
    await interaction.deferUpdate();
    clearMasterNotifications(discordId);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    return true;
  }

  // 3. Button: Stir Pot (General)
  if (interaction.isButton() && customId === 'chaldea_action_stir') {
    await interaction.deferUpdate();
    const res = stirStovePot(discordId);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    await interaction.followUp({ flags: MessageFlags.Ephemeral, content: res.message });
    return true;
  }

  // 3b. Button: Stir Specific Range (e.g. chaldea_stove_stir_range:1)
  if (interaction.isButton() && customId.startsWith('chaldea_stove_stir_range:')) {
    await interaction.deferUpdate();
    const rangeIndex = parseInt(customId.replace('chaldea_stove_stir_range:', ''), 10);
    const res = stirStovePot(discordId, rangeIndex);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    await interaction.followUp({ flags: MessageFlags.Ephemeral, content: res.message });
    return true;
  }

  // 4. Button: Plate Dish (General)
  if (interaction.isButton() && customId === 'chaldea_action_plate') {
    await interaction.deferUpdate();
    const res = plateFinishedDish(discordId);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    await interaction.followUp({ flags: MessageFlags.Ephemeral, content: res.message });
    return true;
  }

  // 4b. Button: Plate Specific Range (e.g. chaldea_stove_plate_range:1)
  if (interaction.isButton() && customId.startsWith('chaldea_stove_plate_range:')) {
    await interaction.deferUpdate();
    const rangeIndex = parseInt(customId.replace('chaldea_stove_plate_range:', ''), 10);
    const res = plateFinishedDish(discordId, rangeIndex);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    await interaction.followUp({ flags: MessageFlags.Ephemeral, content: res.message });
    return true;
  }

  // 4c. Button: Dump Burnt Pot on Range (e.g. chaldea_stove_dump_range:1)
  if (interaction.isButton() && customId.startsWith('chaldea_stove_dump_range:')) {
    await interaction.deferUpdate();
    const rangeIndex = parseInt(customId.replace('chaldea_stove_dump_range:', ''), 10);
    const res = dumpBurntPot(discordId, rangeIndex);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    await interaction.followUp({ flags: MessageFlags.Ephemeral, content: res.message });
    return true;
  }

  // 5. Button: Deposit to Basin
  if (interaction.isButton() && customId === 'chaldea_action_deposit') {
    const master = getOrCreateStationedMaster(discordId, username, avatarUrl);
    const inv = master.inventory || {};
    const entries = Object.entries(inv).filter(([_, count]) => count > 0);

    if (entries.length === 0) {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: 'You have no ingredients in your apron pockets to deposit!' });
      return true;
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('chaldea_deposit_select_ing')
      .setPlaceholder('Select an ingredient to deposit into the Shared Prep Basin...');

    for (const [ingId, count] of entries.slice(0, 25)) {
      const ing = INGREDIENT_CATALOG[ingId];
      select.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`${ing ? ing.emoji : '📦'} ${ing ? ing.name : ingId} (${count} in apron)`)
          .setValue(ingId)
          .setDescription(ing ? ing.description.slice(0, 50) : '')
      );
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: 'Choose an ingredient to deposit into the community basin:',
      components: [row]
    });
    return true;
  }

  // 5b. Deposit Selection
  if (interaction.isStringSelectMenu() && customId === 'chaldea_deposit_select_ing') {
    await interaction.deferUpdate();
    const chosenIng = interaction.values[0];
    const res = depositIngredientToSharedBasin(discordId, chosenIng, 1);
    await interaction.followUp({ flags: MessageFlags.Ephemeral, content: res.message });
    return true;
  }

  // 6. Button: Chop & Prep Recipe Select
  if (interaction.isButton() && customId === 'chaldea_action_prep_select') {
    const select = new StringSelectMenuBuilder()
      .setCustomId('chaldea_prep_recipe_execute')
      .setPlaceholder('Select a recipe kit to chop & prep at the counter...');

    for (const [rId, recipe] of Object.entries(RECIPES_CATALOG)) {
      select.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`${recipe.emoji} ${recipe.name}`)
          .setValue(rId)
          .setDescription(recipe.description.slice(0, 50))
      );
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: '🔪 **Select a recipe to chop & assemble:**',
      components: [row]
    });
    return true;
  }

  // 6b. Execute Prep
  if (interaction.isStringSelectMenu() && customId === 'chaldea_prep_recipe_execute') {
    await interaction.deferUpdate();
    const rId = interaction.values[0];
    const res = chopAndPrepBasin(discordId, rId);
    await interaction.followUp({ flags: MessageFlags.Ephemeral, content: res.message });
    return true;
  }

  // 7. Button: Start Stove Cooking Select
  if (interaction.isButton() && customId === 'chaldea_action_cook_select') {
    const world = getCafeteriaWorldSnapshot();
    const master = getOrCreateStationedMaster(discordId, username, avatarUrl);
    const maxRanges = getStoveCapacity(master);
    const occupied = new Set(world.stovePots.map(p => p.rangeIndex));
    const freeSlots = [];
    for (let r = 1; r <= maxRanges; r++) {
      if (!occupied.has(r)) freeSlots.push(r);
    }

    if (freeSlots.length === 0) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: `❌ **All ${maxRanges} stove ranges are currently occupied!**\nStir, plate, or dump an existing pot on the ranges first.`
      });
      return true;
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('chaldea_cook_recipe_execute')
      .setPlaceholder(`Select a dish to place on free Range #${freeSlots[0]}...`);

    for (const [rId, recipe] of Object.entries(RECIPES_CATALOG)) {
      select.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`${recipe.emoji} ${recipe.name}`)
          .setValue(rId)
          .setDescription(`Cook: ${recipe.cookTimeSeconds}s • Range #${freeSlots[0]}`)
      );
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: `🔥 **Commercial Ranges:** Open Stations: **Range #${freeSlots.join(', #')}**\nSelect a dish to start simmering on **Range #${freeSlots[0]}**:`,
      components: [row]
    });
    return true;
  }

  // 7b. Execute Cooking
  if (interaction.isStringSelectMenu() && customId === 'chaldea_cook_recipe_execute') {
    await interaction.deferUpdate();
    const rId = interaction.values[0];
    const res = startStoveCooking(discordId, rId);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    await interaction.followUp({ flags: MessageFlags.Ephemeral, content: res.message });
    return true;
  }

  // 8. Button: Present Dish to Patron Select
  if (interaction.isButton() && customId === 'chaldea_action_serve_select') {
    const master = getOrCreateStationedMaster(discordId, username, avatarUrl);
    if (!master.activePlatedDish) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: '❌ You are not carrying any plated dishes! Cook and plate a meal at the Stoves (`/move kitchen_stove`) first.'
      });
      return true;
    }

    const world = getCafeteriaWorldSnapshot();
    const seatedOrders = (world.activePatronOrders || []).filter(o => !o.served);

    if (seatedOrders.length === 0) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: '🍽️ There are currently no active visiting patrons seated at tables in the Dining Hall! Wait a moment for patrons to arrive.'
      });
      return true;
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('chaldea_serve_patron_execute')
      .setPlaceholder('Select a seated Servant patron in the dining hall...');

    for (const order of seatedOrders) {
      const patron = VISITING_PATRONS.find(p => p.id === order.patronId);
      if (!patron) continue;
      const tNum = order.tableNumber || 1;
      const mood = order.mood || 'ravenous';

      select.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`Table #${tNum}: ${patron.name} (${patron.servantClass})`)
          .setValue(patron.id)
          .setDescription(`Craving: ${patron.cravingName.slice(0, 35)} [${mood.toUpperCase()}]`)
      );
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: `🍽️ **Carrying:** ${master.activePlatedDish.recipeEmoji} **${master.activePlatedDish.recipeName}**\nSelect a seated patron table to present this meal:`,
      components: [row]
    });
    return true;
  }

  // 8b. Execute Serving Patron (With Gemini AI review!)
  if (interaction.isStringSelectMenu() && customId === 'chaldea_serve_patron_execute') {
    await interaction.deferUpdate();
    const patronId = interaction.values[0];
    const patron = VISITING_PATRONS.find(p => p.id === patronId);
    const master = getOrCreateStationedMaster(discordId, username, avatarUrl);

    if (!patron || !master.activePlatedDish) {
      await interaction.followUp({ flags: MessageFlags.Ephemeral, content: 'Patron or plated dish missing.' });
      return true;
    }

    const world = getCafeteriaWorldSnapshot();
    const activeOrder = world.activePatronOrders.find(o => o.patronId === patronId && !o.served);
    const recipe = RECIPES_CATALOG[master.activePlatedDish.recipeId];

    // Generate Gemini AI critique with mood and craving match context
    const aiReview = await generatePatronFoodReview(
      patron,
      recipe,
      master.activePlatedDish.qualityScore,
      master.activePlatedDish.cooksInvolved,
      activeOrder?.mood,
      patron.cravingName
    );

    const res = serveDishToPatron(discordId, patronId, aiReview.critiqueText, aiReview.ratingStars);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    await interaction.followUp({ flags: MessageFlags.Ephemeral, content: res.message });
    return true;
  }

  // 9. Button: Set AFK Status Modal
  if (interaction.isButton() && customId === 'chaldea_action_station_modal') {
    const modal = new ModalBuilder()
      .setCustomId('chaldea_modal_station_submit')
      .setTitle('Station Activity & AFK Status');

    const input = new TextInputBuilder()
      .setCustomId('station_status_text')
      .setLabel('What is your character doing in this room?')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. Dicing onions, Sipping Earl Grey, Watching the pot')
      .setMaxLength(80)
      .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
    modal.addComponents(row);
    await interaction.showModal(modal);
    return true;
  }

  // 9b. Submit Modal
  if (interaction.isModalSubmit() && customId === 'chaldea_modal_station_submit') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const text = interaction.fields.getTextInputValue('station_status_text');
    const res = stationMasterCustomStatus(discordId, text);
    await interaction.editReply({ content: res.message });
    return true;
  }

  // 10. Button: Refresh
  if (interaction.isButton() && customId === 'chaldea_action_refresh') {
    await interaction.deferUpdate();
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    return true;
  }

  // 11. Button: Operational Guide
  if (interaction.isButton() && customId === 'chaldea_action_guide') {
    const guideEmbed = new EmbedBuilder()
      .setTitle('📖 Chaldea Cafeteria & Campus Hub — Operational Guide')
      .setDescription(
        'Welcome to **Chaldea Cafeteria & Campus Hub** — an asynchronous, real-time visual novel cooking MUD!\n' +
        'Work together with fellow Masters and Heroic Spirits to harvest ingredients, prep recipe kits, simmer gourmet meals, and present feasts to visiting patrons.'
      )
      .setColor(0xd4af37)
      .addFields(
        {
          name: '🌾 1. Foraging & Harvesting',
          value:
            '• Visit resource rooms like the **Pantry**, **Hydroponics Greenhouse**, or **Cold Storage** using `/move` or the room menu.\n' +
            '• Click `[🌾 Gather / Harvest]` to collect raw produce (Saint Quartz Berries, Sacred Dragon Flour, Mana Milk, etc.) into your apron pockets.',
          inline: false
        },
        {
          name: '📦 2. Shared Basin & Kitchen Prep',
          value:
            '• Head to `Kitchen — Prep & Cutting Stations` (`/move kitchen_prep`).\n' +
            '• Click `[📦 Deposit to Basin]` to share harvested ingredients with all Masters in Chaldea.\n' +
            '• Click `[🔪 Chop & Prep Recipe]` to assemble community ingredients into prepped recipe kits.',
          inline: false
        },
        {
          name: '🔥 3. Stove Cooking, Stirring & Plating',
          value:
            '• Move to `Kitchen — Stoves & Commercial Ovens` (`/move kitchen_stove`).\n' +
            '• Click `[🔥 Start Cooking]` to place a prepped kit onto a gas range stove.\n' +
            '• Click `[🥄 Stir Pot]` periodically while simmering to boost dish quality score (up to 100)!\n' +
            '• Once ready, click `[🍽️ Plate Dish]` to carry the freshly cooked dish in your hands.',
          inline: false
        },
        {
          name: '🍽️ 4. Patron Serving & Gemini AI Food Critiques',
          value:
            '• Enter the `Dining Hall & Serving Counter` (`/move dining_hall`).\n' +
            '• Click `[⭐ Present to Patron]` to present your meal to visiting Heroic Spirits (e.g. Saber, Gilgamesh, Emiya).\n' +
            '• Servants deliver real-time **Gemini AI Food Reviews** and activate server-wide **Community Cafeteria Buffs**!',
          inline: false
        },
        {
          name: '📌 5. AFK Stationing & Room Navigation',
          value:
            '• Click `[📌 Set AFK Status]` to set a custom roleplay status for your Master (e.g. *"Dicing onions"*, *"Brewing Earl Grey"*).\n' +
            '• Use the drop-down menu at any time to travel between all 8 Chaldea facility sectors.',
          inline: false
        },
        {
          name: '💬 6. Telepathic Resonance & Servant Bond Systems',
          value:
            '• Your active Servant companion appears alongside you in full visual novel stage rendering.\n' +
            '• Raise your Servant Bond level in the Bond Sanctum to unlock high-tier ascension artwork and stage presence.',
          inline: false
        }
      )
      .setFooter({ text: 'Chaldea Facility Operations Manual • Press Refresh anytime to update status' })
      .setTimestamp();

    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [guideEmbed]
    });
    return true;
  }

  // 12. Button: Wash Face in Restroom
  if (interaction.isButton() && customId === 'chaldea_action_wash_face') {
    await interaction.deferUpdate();
    const res = washFaceInRestroom(discordId);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    await interaction.followUp({ flags: MessageFlags.Ephemeral, content: res.message });
    return true;
  }

  // 13. Button: Check Reflection in Mirror
  if (interaction.isButton() && customId === 'chaldea_action_check_reflection') {
    const master = getOrCreateStationedMaster(discordId, username, avatarUrl);
    const rank = getMasterCMPRank(discordId);
    const prefect = getHeadPrefect();
    const isPrefect = Boolean(prefect && prefect.discordId === discordId);
    const embed = new EmbedBuilder()
      .setTitle(`🪞 Porcelain Mirror — ${master.username}'s Reflection`)
      .setDescription(
        `You gaze into the fogged restroom mirror over the porcelain sink:\n\n` +
        `• **Standing:** ${rank.emoji} **${rank.title}** (Tier ${rank.rank})\n` +
        `• **Chaldea Merit Points (CMP):** \`${rank.cmp} pts\`\n` +
        `• **Status:** ${isPrefect ? '👑 **CHALDEA HEAD PREFECT** (Chief Overseer)' : 'Active Campus Student'}\n` +
        `• **Health:** \`${master.currentHp}/${master.maxHp} HP\`\n` +
        `• **Toilet Dunks Endured:** \`${master.swirliesReceived || 0} swirlies\`\n` +
        `• **Times Impeached:** \`${master.timesImpeached || 0}\`\n\n` +
        `*Maintain discipline, perform facility duties, and keep your honor unblemished!*`
      )
      .setColor(0x06b6d4)
      .setFooter({ text: 'Chaldea Facility Mirror • Hygiene & Honor' });

    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [embed]
    });
    return true;
  }

  // 14. Button: Pick Lock / Bust Restroom Door
  if (interaction.isButton() && customId === 'chaldea_action_bust_door') {
    await interaction.deferUpdate();
    const res = breakRestroomLock(discordId);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    await interaction.followUp({ flags: MessageFlags.Ephemeral, content: res.message });
    return true;
  }

  // 15. Button: View CMP Rankings
  if (interaction.isButton() && customId === 'chaldea_action_rankings') {
    const lb = getChaldeaRankLeaderboard();
    const prefect = getHeadPrefect();
    const desc = lb.map((m, idx) => {
      const crown = m.isPrefect ? '👑 ' : `${idx + 1}. `;
      return `${crown}${m.emoji} **${m.username}** — \`${m.cmp} CMP\` (${m.title})${m.isPrefect ? ' ⭐ **[Head Prefect]**' : ''}`;
    }).join('\n') || '*No registered Masters yet.*';

    const embed = new EmbedBuilder()
      .setTitle('🏆 Chaldea Campus Hierarchy — Merit Point Rankings')
      .setDescription(
        `👑 **Reigning Head Prefect:** ${prefect ? `**@${prefect.username}** (\`${prefect.meritPoints || 0} CMP\`)` : '*Position Vacant*'}\n\n` +
        `📜 **Master Leaderboard:**\n${desc}\n\n` +
        `⚖️ *The #1 Ranked Master holds Disciplinary Authority. If tyrannical abuse occurs, Masters can file a Vote of No Confidence with \`/chaldea impeach\` or the Impeach button!*`
      )
      .setColor(0xd4af37)
      .setFooter({ text: 'Chaldea Discipline Hierarchy • Impeachment threshold: 5 votes' });

    await interaction.reply({ flags: MessageFlags.Ephemeral, embeds: [embed] });
    return true;
  }

  // 16. Button: Start / Sponsor Impeachment
  if (interaction.isButton() && customId === 'chaldea_action_impeach_start') {
    await interaction.deferUpdate();
    const res = callImpeachmentVote(discordId);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    await interaction.followUp({ flags: MessageFlags.Ephemeral, content: res.message });
    return true;
  }

  // 17. Button: Cast Impeachment Vote (Impeach or Support)
  if (interaction.isButton() && (customId === 'chaldea_impeach_vote_impeach' || customId === 'chaldea_impeach_vote_support')) {
    await interaction.deferUpdate();
    const voteType = customId === 'chaldea_impeach_vote_impeach' ? 'impeach' : 'support';
    const res = castImpeachmentVote(discordId, voteType);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    await interaction.followUp({ flags: MessageFlags.Ephemeral, content: res.message });
    return true;
  }

  // 18. Button: Open Head Prefect Disciplinary Menu
  if (interaction.isButton() && customId === 'chaldea_action_prefect_menu') {
    const currentPrefect = getHeadPrefect();
    if (!currentPrefect || currentPrefect.discordId !== discordId) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: '❌ **UNAUTHORIZED:** Only the **#1 Ranked Chaldea Head Prefect** holds Prefect Disciplinary Authority!'
      });
      return true;
    }

    const world = getCafeteriaWorldSnapshot();
    const otherMasters = Object.values(world.masters).filter(m => m.discordId !== discordId);

    if (otherMasters.length === 0) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: 'There are currently no other Masters stationed in Chaldea to discipline!'
      });
      return true;
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('chaldea_select_discipline_target')
      .setPlaceholder('Select an idle, hazard-causing, or silly Master to discipline...');

    for (const m of otherMasters.slice(0, 25)) {
      const loc = CAFETERIA_ROOMS[m.currentRoomId]?.shortName || m.currentRoomId;
      select.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`⚖️ ${m.username} (in ${loc})`)
          .setValue(m.discordId)
          .setDescription(`HP: ${m.currentHp}/${m.maxHp} • Status: ${m.statusText.slice(0, 40)}`)
      );
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: '👑 **HEAD PREFECT DISCIPLINARY TRIBUNAL:**\nChoose a Master to administer corrective action:',
      components: [row]
    });
    return true;
  }

  // 19. Select: Discipline Target Chosen
  if (interaction.isStringSelectMenu() && customId === 'chaldea_select_discipline_target') {
    await interaction.deferUpdate();
    const targetId = interaction.values[0];
    const world = getCafeteriaWorldSnapshot();
    const target = world.masters[targetId];

    if (!target) {
      await interaction.followUp({ flags: MessageFlags.Ephemeral, content: 'Target Master no longer found.' });
      return true;
    }

    const targetRoom = CAFETERIA_ROOMS[target.currentRoomId]?.name || target.currentRoomId;

    const embed = new EmbedBuilder()
      .setTitle(`👑 Prefect Authority: Select Punishment for @${target.username}`)
      .setDescription(
        `**Target:** **@${target.username}**\n` +
        `• **Location:** ${targetRoom}\n` +
        `• **Current Vitals:** **${target.currentHp}/${target.maxHp} HP**\n` +
        `• **Behavior / Status:** *"${target.statusText}"*\n\n` +
        `Choose disciplinary measure:\n` +
        `• 🤼 **Grab & Drag:** Seize target by the collar and forcibly march them to another sector (e.g. Restrooms).\n` +
        `• 🚽 **Swirlie / Porcelain Dunk:** Flush target's face in the toilet (-20 to -30 direct HP, KO to Infirmary if HP reaches 0).\n` +
        `• 🔒 **Lavatory Lockdown:** Bolt the restroom doors for 5, 10, or 20 minutes.`
      )
      .setColor(0xef4444);

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`chaldea_discipline_grab_select:${targetId}`)
        .setLabel('🤼 Grab & Drag to Room...')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`chaldea_discipline_dunk:${targetId}`)
        .setLabel('🚽 Toilet Dunk (-20 HP)')
        .setStyle(ButtonStyle.Danger)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`chaldea_discipline_lock:${targetId}:5`)
        .setLabel('🔒 Lock in Restroom (5 min)')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`chaldea_discipline_lock:${targetId}:10`)
        .setLabel('🔒 Lock (10 min)')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`chaldea_discipline_lock:${targetId}:20`)
        .setLabel('🔒 Lock (20 min)')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.followUp({
      flags: MessageFlags.Ephemeral,
      embeds: [embed],
      components: [row1, row2]
    });
    return true;
  }

  // 20. Button: Grab & Drag Room Selector
  if (interaction.isButton() && customId.startsWith('chaldea_discipline_grab_select:')) {
    const targetId = customId.replace('chaldea_discipline_grab_select:', '');
    const world = getCafeteriaWorldSnapshot();
    const target = world.masters[targetId];

    const select = new StringSelectMenuBuilder()
      .setCustomId(`chaldea_discipline_grab_execute:${targetId}`)
      .setPlaceholder(`Select destination room to drag ${target ? target.username : 'target'}...`);

    select.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('🚽 Chaldea Restrooms (Discipline Sector)')
        .setValue('restrooms')
        .setDescription('Seize and drag straight to the toilet stalls!'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🚪 Central Hub Corridor')
        .setValue('hallway')
        .setDescription('March out of workstation into the open hallway'),
      new StringSelectMenuOptionBuilder()
        .setLabel('☕ Staff Lounge & Break Room')
        .setValue('staff_lounge')
        .setDescription('Escort to detention/reflection in the lounge'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🍽️ Dining Hall & Serving Counter')
        .setValue('dining_hall')
        .setDescription('Force back to public dining area'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🏥 Medical Infirmary')
        .setValue('infirmary')
        .setDescription('Drag straight to hospital ward beds')
    );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: `🤼 **Choose destination sector to drag @${target ? target.username : 'target'}:**`,
      components: [row]
    });
    return true;
  }

  // 21. Select: Execute Grab & Drag
  if (interaction.isStringSelectMenu() && customId.startsWith('chaldea_discipline_grab_execute:')) {
    await interaction.deferUpdate();
    const targetId = customId.replace('chaldea_discipline_grab_execute:', '');
    const destRoomId = interaction.values[0];
    const res = executeGrabAndDrag(discordId, targetId, destRoomId);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    await interaction.followUp({ flags: MessageFlags.Ephemeral, content: res.message });
    return true;
  }

  // 22. Button: Execute Toilet Dunk / Swirlie
  if (interaction.isButton() && customId.startsWith('chaldea_discipline_dunk:')) {
    await interaction.deferUpdate();
    const targetId = customId.replace('chaldea_discipline_dunk:', '');
    const res = executeToiletDunk(discordId, targetId);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    await interaction.followUp({ flags: MessageFlags.Ephemeral, content: res.message });
    return true;
  }

  // 23. Button: Execute Lavatory Lockdown
  if (interaction.isButton() && customId.startsWith('chaldea_discipline_lock:')) {
    await interaction.deferUpdate();
    const parts = customId.split(':');
    const targetId = parts[1];
    const mins = parseInt(parts[2], 10) || 5;
    const res = executeLavatoryLockdown(discordId, targetId, mins);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    await interaction.followUp({ flags: MessageFlags.Ephemeral, content: res.message });
    return true;
  }

  // -------------------------------------------------------------
  // SANDBOX HANDLERS: ROOM BULLETIN & STICKY NOTES
  // -------------------------------------------------------------

  if ((interaction.isButton() && customId === 'chaldea_action_write_note') ||
      (interaction.isStringSelectMenu() && customId === 'chaldea_select_room_sandbox_prop' && interaction.values[0] === 'general_write_note')) {
    const modal = new ModalBuilder()
      .setCustomId('chaldea_modal_write_note')
      .setTitle('📝 Chaldea Bulletin — Write Sticky Note');

    const input = new TextInputBuilder()
      .setCustomId('chaldea_input_note_text')
      .setLabel('Message to Pin (Max 180 chars)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('e.g. Diced onions are reserved for the beef curry! -@Master')
      .setMaxLength(180)
      .setMinLength(2)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    await interaction.showModal(modal);
    return true;
  }

  if (interaction.isModalSubmit() && customId === 'chaldea_modal_write_note') {
    await interaction.deferUpdate();
    const noteText = interaction.fields.getTextInputValue('chaldea_input_note_text');
    const master = getOrCreateStationedMaster(discordId, username, avatarUrl);
    const res = addRoomStickyNote(discordId, master.currentRoomId, noteText);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl, res.message);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    return true;
  }

  // -------------------------------------------------------------
  // SANDBOX HANDLERS: COMPANION SERVANT ASSIST
  // -------------------------------------------------------------

  if (interaction.isButton() && customId === 'chaldea_action_companion_assist') {
    await interaction.deferUpdate();
    const master = getOrCreateStationedMaster(discordId, username, avatarUrl);
    const dbMaster = await getMaster(discordId);
    const activeServant = dbMaster?.servants?.find((s: any) => s.id === dbMaster.activeServantId) || dbMaster?.servants?.[0];
    const sName = master.companionServantName || activeServant?.nickname || activeServant?.template?.name || 'Heroic Spirit';
    const sClass = activeServant?.template?.class || activeServant?.class || 'Saber';

    const res = executeCompanionServantAssist(discordId, sClass, sName);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl, res.message);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    return true;
  }

  // -------------------------------------------------------------
  // SANDBOX HANDLERS: DROPPABLE WORLD ITEMS & SHARED COUNTERTOPS
  // -------------------------------------------------------------

  if ((interaction.isButton() && customId === 'chaldea_action_drop_counter') ||
      (interaction.isStringSelectMenu() && customId === 'chaldea_select_room_sandbox_prop' && interaction.values[0] === 'general_drop_counter')) {
    const master = getOrCreateStationedMaster(discordId, username, avatarUrl);
    const items = Object.entries(master.inventory || {}).filter(([_, count]) => count > 0);
    if (items.length === 0) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: '📦 Your apron pockets are empty! Harvest or gather ingredients first.'
      });
      return true;
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('chaldea_select_drop_counter')
      .setPlaceholder('Select an ingredient to place on the room counter...');

    for (const [id, count] of items.slice(0, 25)) {
      const ing = INGREDIENT_CATALOG[id];
      const name = ing ? ing.name : id;
      const emoji = ing ? ing.emoji : '📦';
      select.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`${emoji} ${name} (You have: ${count})`)
          .setValue(id)
          .setDescription(`Place 1x ${name} on the shared room countertop`)
      );
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: '📦 **Drop Ingredient onto Countertop:**\nTeammates stationed in this room can pick this item up:',
      components: [row]
    });
    return true;
  }

  if (interaction.isStringSelectMenu() && customId === 'chaldea_select_drop_counter') {
    await interaction.deferUpdate();
    const ingId = interaction.values[0];
    const master = getOrCreateStationedMaster(discordId, username, avatarUrl);
    const res = dropItemOnRoomCounter(discordId, master.currentRoomId, ingId, 1);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl, res.message);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    await interaction.followUp({ flags: MessageFlags.Ephemeral, content: res.message });
    return true;
  }

  if ((interaction.isButton() && customId === 'chaldea_action_take_counter') ||
      (interaction.isStringSelectMenu() && customId === 'chaldea_select_room_sandbox_prop' && interaction.values[0] === 'general_take_counter')) {
    const master = getOrCreateStationedMaster(discordId, username, avatarUrl);
    const counterItems = getRoomCounterItems(master.currentRoomId);
    if (counterItems.length === 0) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: '🧺 The countertop in this room is completely clear. No items have been left here.'
      });
      return true;
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('chaldea_select_take_counter')
      .setPlaceholder('Select an item to pick up from the countertop...');

    for (const item of counterItems.slice(0, 25)) {
      select.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`${item.emoji} ${item.ingredientName} x${item.count}`)
          .setValue(item.ingredientId)
          .setDescription(`Dropped by @${item.droppedBy}`)
      );
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: '🧺 **Pick Up Shared Item from Counter:**\nSelect an ingredient to take into your apron:',
      components: [row]
    });
    return true;
  }

  if (interaction.isStringSelectMenu() && customId === 'chaldea_select_take_counter') {
    await interaction.deferUpdate();
    const ingId = interaction.values[0];
    const master = getOrCreateStationedMaster(discordId, username, avatarUrl);
    const res = takeItemFromRoomCounter(discordId, master.currentRoomId, ingId, 1);
    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl, res.message);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    await interaction.followUp({ flags: MessageFlags.Ephemeral, content: res.message });
    return true;
  }

  // -------------------------------------------------------------
  // SANDBOX HANDLERS: ROOM-SPECIFIC PROPS SELECT MENU
  // -------------------------------------------------------------

  if (interaction.isStringSelectMenu() && customId === 'chaldea_select_room_sandbox_prop') {
    const val = interaction.values[0];
    const master = getOrCreateStationedMaster(discordId, username, avatarUrl);

    if (val === 'facility_shop') {
      const embed = new EmbedBuilder()
        .setTitle('🛒 Chaldea Cafeteria Supply Shop')
        .setDescription(
          `**Your Balance:** \`${master.friendPoints || 0} FP\` • \`${master.meritPoints || 0} CMP\`\n\n` +
          `• 🍳 **Commercial Range Expander:** \`1,200 FP\` (Increases max stove slots)\n` +
          `• 🔪 **Marble Prep Counter Extender:** \`800 FP\`\n` +
          `• 💡 **Magical UV Hydroponic Lamp:** \`1,000 FP\``
        )
        .setColor(0x3b82f6);
      await interaction.reply({ flags: MessageFlags.Ephemeral, embeds: [embed] });
      return true;
    }

    if (val === 'facility_rankings') {
      const lb = getChaldeaRankLeaderboard();
      const prefect = getHeadPrefect();
      const pName = prefect ? `@${prefect.username}` : 'Vacant';
      const embed = new EmbedBuilder()
        .setTitle('🏆 Chaldea Campus Merit Points (CMP) Leaderboard')
        .setDescription(
          `👑 **Current Head Prefect:** **${pName}**\n\n` +
          lb.slice(0, 10).map((m, idx) => `**#${idx + 1}** ${m.isHeadPrefect ? '👑 ' : ''}**${m.username}** — \`${m.meritPoints || 0} CMP\` [${m.companionServantName}]`).join('\n')
        )
        .setColor(0xd4af37);
      await interaction.reply({ flags: MessageFlags.Ephemeral, embeds: [embed] });
      return true;
    }

    if (val === 'facility_status') {
      const modal = new ModalBuilder()
        .setCustomId('chaldea_modal_station_status')
        .setTitle('📌 Chaldea Station & Status');
      const input = new TextInputBuilder()
        .setCustomId('chaldea_input_status_text')
        .setLabel('Custom Status / Speech Bubble')
        .setStyle(TextInputStyle.Short)
        .setValue(master.statusText || '')
        .setMaxLength(60)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
      await interaction.showModal(modal);
      return true;
    }

    // Environmental prop interaction
    await interaction.deferUpdate();
    let res: { success: boolean; message: string };

    if (val.startsWith('dining_jukebox:')) {
      const trackId = val.replace('dining_jukebox:', '');
      res = interactWithRoomProp(discordId, master.currentRoomId, 'dining_jukebox', trackId);
    } else {
      res = interactWithRoomProp(discordId, master.currentRoomId, val);
    }

    const payload = await buildChaldeaViewportResponse(discordId, username, avatarUrl, res.message);
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files
    });
    return true;
  }

  return false;
}
