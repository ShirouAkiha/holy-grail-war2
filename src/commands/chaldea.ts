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
  extinguishRoomHazard,
  repairRoomStructuralDamage,
  instantRepairRoomSQ,
  drinkBurnSalve,
  instantRejuvenationSQ,
  startBedRest,
  setAttendingDoctor,
  bringFruitBasketToFriend,
  performHeroRescue,
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
      leftSpriteUrl: leftSpriteUrl
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
    if (world.stovePots.length > 0) {
      stationDetails = world.stovePots.map((p, idx) => {
        const remSec = Math.max(0, Math.ceil((p.readyAt - Date.now()) / 1000));
        const status = p.status === 'ready' ? '🟢 **READY TO PLATE!**' : p.status === 'burnt' ? '⚫ **BURNT (BURNT SLUDGE)**' : `🟡 Simmering (${remSec}s left)`;
        return `🔥 **Range #${idx + 1}:** ${p.recipeEmoji} **${p.recipeName}** — ${status} (Stirs: ${p.stirCount}, Quality: ${p.qualityScore}/100)`;
      }).join('\n');
    } else {
      stationDetails = `🔥 **Stoves & Ovens:** All ranges idle.\n*Have a prepped kit ready to light the flame!*`;
    }
  } else if (room.id === 'dining_hall') {
    if (world.activePatronOrders.length > 0) {
      stationDetails = world.activePatronOrders.map(o => {
        const patron = VISITING_PATRONS.find(p => p.id === o.patronId);
        const remMin = Math.max(0, Math.ceil((o.expiresAt - Date.now()) / 60000));
        return `🍽️ **${patron ? patron.name : 'Visiting Servant'}** craving **${patron ? patron.cravingName : 'Feast'}** (${remMin}m left)`;
      }).join('\n');
    } else {
      stationDetails = `🍽️ Tables are set. Visiting patrons arrive periodically!`;
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

  // 5b. Room Event Log (Top 5 room-isolated activity entries with relative Discord timestamps)
  const roomActivities = (world.recentActivityFeed || []).filter(a => a.roomId === room.id).slice(0, 5);
  const roomEventsSummary = roomActivities.length > 0
    ? roomActivities.map(a => `• <t:${Math.floor(a.timestamp / 1000)}:R> ${a.text}`).join('\n')
    : '*No recent events recorded in this sector.*';

  // 6. Assemble Dual Embed Stack
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
      `📍 **Current Location:** **${room.name}**\n` +
      `🎵 *${room.ambientBgm}*\n\n` +
      `${room.description}\n\n` +
      `👥 **Masters Stationed Here (${roomMasters.length}):**\n${mastersSummary}\n\n` +
      `🍲 **Workstation Status:**\n${stationDetails}` +
      (platedStr ? `\n\n${platedStr}` : '') +
      `\n\n📜 **Recent Room Activity:**\n${roomEventsSummary}`
    )
    .setColor(roomHazard.stage === 4 ? 0x991b1b : roomHazard.stage === 3 ? 0xef4444 : roomHazard.stage === 2 ? 0xf59e0b : 0xd4af37)
    .setImage('attachment://chaldea_viewport.png')
    .addFields(
      {
        name: '🎒 Your Inventory',
        value: invStr,
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

  // 7. Interactive Buttons Row 1: Contextual Action Button Swap
  const actionButtons: ButtonBuilder[] = [];

  if (room.id === 'infirmary') {
    // Infirmary Ward Mode: Recovery Actions
    actionButtons.push(
      new ButtonBuilder()
        .setCustomId('chaldea_action_bed_rest')
        .setLabel(master.activeRecoveryType === 'bed_rest' ? '🛏️ Bed Rest (1 hr in Progress)' : '🛏️ Bed Rest (Free 1 hr)')
        .setStyle(master.activeRecoveryType === 'bed_rest' ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('chaldea_action_drink_salve')
        .setLabel('🧪 Drink Burn Salve (Herbs)')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('chaldea_action_rejuvenate_sq')
        .setLabel('💎 Rejuvenate (500 SQ)')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('chaldea_action_switch_doctor')
        .setLabel('🩺 Page Doctor')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('chaldea_action_fruit_basket_select')
        .setLabel('🤝 Bring Fruit Basket')
        .setStyle(ButtonStyle.Success)
    );
  } else if (roomHazard.stage === 4) {
    // Structural Breakdown Mode: Only Repair / Instant Fix / Retreat available!
    actionButtons.push(
      new ButtonBuilder()
        .setCustomId('chaldea_action_repair_manual')
        .setLabel(`🛠️ Repair Flues (Free ${roomHazard.repairsContributed}/${roomHazard.requiredRepairs || 3})`)
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

    // Check if hero rescue button should be added (if other masters in room are coughing or fainted)
    const rescuableFriends = roomMasters.filter(m => m.discordId !== master.discordId && (m.currentHp < m.maxHp || m.burnStatus === 'singed' || m.burnStatus === 'fainted'));
    if (rescuableFriends.length > 0 && roomHazard.stage >= 3) {
      actionButtons.push(
        new ButtonBuilder()
          .setCustomId('chaldea_action_rescue_select')
          .setLabel('🚑 Drag Friend to Safety')
          .setStyle(ButtonStyle.Success)
      );
    }

    if (room.availableIngredients.length > 0) {
      actionButtons.push(
        new ButtonBuilder()
          .setCustomId('chaldea_action_forage')
          .setLabel('🌾 Gather / Harvest')
          .setStyle(ButtonStyle.Success)
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
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('chaldea_action_stir')
          .setLabel('🥄 Stir Pot')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('chaldea_action_plate')
          .setLabel('🍽️ Plate Dish')
          .setStyle(ButtonStyle.Success)
      );
    } else if (room.id === 'dining_hall') {
      actionButtons.push(
        new ButtonBuilder()
          .setCustomId('chaldea_action_serve_select')
          .setLabel('⭐ Present to Patron')
          .setStyle(ButtonStyle.Success)
      );
    }
  }

  // Always available utility actions
  actionButtons.push(
    new ButtonBuilder()
      .setCustomId('chaldea_action_station_modal')
      .setLabel('📌 AFK Status')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('chaldea_action_guide')
      .setLabel('📖 Guide')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('chaldea_action_refresh')
      .setLabel('🔄 Refresh')
      .setStyle(ButtonStyle.Secondary)
  );

  const actionRows: ActionRowBuilder<any>[] = [];
  for (let i = 0; i < actionButtons.length; i += 5) {
    actionRows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(actionButtons.slice(i, i + 5)));
  }

  // 8. Row 2: Room Movement Select Menu
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

  return {
    embeds: [mapEmbed, roomEmbed],
    components: [...actionRows, selectRow],
    files: [mapAttachment, viewportAttachment]
  };
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const sub = interaction.options.getSubcommand(false) || 'hub';

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
    const docCycle: Array<'nightingale' | 'asclepius' | 'bb'> = ['nightingale', 'asclepius', 'bb'];
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

  // 3. Button: Stir Pot
  if (interaction.isButton() && customId === 'chaldea_action_stir') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const res = stirStovePot(discordId);
    await interaction.editReply({ content: res.message });
    return true;
  }

  // 4. Button: Plate Dish
  if (interaction.isButton() && customId === 'chaldea_action_plate') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const res = plateFinishedDish(discordId);
    await interaction.editReply({ content: res.message });
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
    const select = new StringSelectMenuBuilder()
      .setCustomId('chaldea_cook_recipe_execute')
      .setPlaceholder('Select a dish to place on the gas range...');

    for (const [rId, recipe] of Object.entries(RECIPES_CATALOG)) {
      select.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`${recipe.emoji} ${recipe.name}`)
          .setValue(rId)
          .setDescription(`Cook Time: ${recipe.cookTimeSeconds}s • ${recipe.difficulty}`)
      );
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: '🔥 **Select a dish to start simmering on the stove:**',
      components: [row]
    });
    return true;
  }

  // 7b. Execute Cooking
  if (interaction.isStringSelectMenu() && customId === 'chaldea_cook_recipe_execute') {
    await interaction.deferUpdate();
    const rId = interaction.values[0];
    const res = startStoveCooking(discordId, rId);
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

    const select = new StringSelectMenuBuilder()
      .setCustomId('chaldea_serve_patron_execute')
      .setPlaceholder('Select a visiting Servant patron in the dining hall...');

    for (const patron of VISITING_PATRONS) {
      select.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`${patron.name} (${patron.servantClass})`)
          .setValue(patron.id)
          .setDescription(`Craving: ${patron.cravingName.slice(0, 45)}`)
      );
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: `🍽️ **Carrying:** ${master.activePlatedDish.recipeEmoji} **${master.activePlatedDish.recipeName}**\nPresent this meal to which visiting patron?`,
      components: [row]
    });
    return true;
  }

  // 8b. Execute Serving Patron (With Gemini AI review!)
  if (interaction.isStringSelectMenu() && customId === 'chaldea_serve_patron_execute') {
    await interaction.deferReply();
    const patronId = interaction.values[0];
    const patron = VISITING_PATRONS.find(p => p.id === patronId);
    const master = getOrCreateStationedMaster(discordId, username, avatarUrl);

    if (!patron || !master.activePlatedDish) {
      await interaction.editReply({ content: 'Patron or plated dish missing.' });
      return true;
    }

    const recipe = RECIPES_CATALOG[master.activePlatedDish.recipeId];
    // Generate Gemini AI critique
    const aiReview = await generatePatronFoodReview(
      patron,
      recipe,
      master.activePlatedDish.qualityScore,
      master.activePlatedDish.cooksInvolved
    );

    const res = serveDishToPatron(discordId, patronId, aiReview.critiqueText, aiReview.ratingStars);
    await interaction.editReply({ content: res.message });
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

  return false;
}
