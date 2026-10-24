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
  StationedMaster
} from '../engine/cafeteriaEngine';
import { 
  renderChaldeaNodeMapCanvas, 
  renderChaldeaLocationCanvas 
} from '../canvas/cafeteriaCanvas';
import { generatePatronFoodReview } from '../services/patronAi';
import { getMaster } from '../database/service';

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
  avatarUrl: string
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

  // 1. Generate Dual Canvases in parallel
  const [mapBuffer, viewportBuffer] = await Promise.all([
    renderChaldeaNodeMapCanvas(room.id, Object.values(world.masters)),
    renderChaldeaLocationCanvas(room, master, roomMasters, activePot)
  ]);

  const mapAttachment = new AttachmentBuilder(mapBuffer, { name: 'chaldea_map.png' });
  const viewportAttachment = new AttachmentBuilder(viewportBuffer, { name: 'chaldea_viewport.png' });

  // 2. Format Stationed Masters Summary
  const otherMasters = roomMasters.filter(m => m.discordId !== master.discordId);
  const mastersSummary = roomMasters.map(m => {
    const isSelf = m.discordId === master.discordId;
    return `• ${isSelf ? '👉 **' : '**'}${m.username}${isSelf ? ' (You)**' : '**'} [${m.companionServantName}]: *"${m.statusText}"* ${m.isAfk ? '💤' : '⚡'}`;
  }).join('\n');

  // 3. Format Workstation Status
  let stationDetails = `*${room.primaryActivityName} is quiet.*`;
  if (room.id === 'kitchen_prep') {
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
        const status = p.status === 'ready' ? '🟢 **READY TO PLATE!**' : p.status === 'burnt' ? '⚫ **BURNT**' : `🟡 Simmering (${remSec}s left)`;
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

  // 6. Assemble Dual Embed Stack
  // Top Banner Embed: Full-width Chaldea Facility Node Map (stacked cleanly above room viewport)
  const mapEmbed = new EmbedBuilder()
    .setTitle('🗺️ Chaldea Campus Hub — Facility Node Map')
    .setDescription(
      `📍 **Current Sector:** **${room.name}** • 👥 **Stationed Here:** ${roomMasters.length} Master${roomMasters.length === 1 ? '' : 's'} • 🌐 **Online Masters:** ${Object.keys(world.masters).length}`
    )
    .setColor(0x00e5ff)
    .setImage('attachment://chaldea_map.png');

  // Bottom Room Viewport Embed: Cinematic Visual Novel Scene, Activity, Inventory & Buffs
  const roomEmbed = new EmbedBuilder()
    .setTitle(`🍵 Chaldea Campus Hub — ${room.name}`)
    .setDescription(
      `📍 **Current Location:** **${room.name}**\n` +
      `🎵 *${room.ambientBgm}*\n\n` +
      `${room.description}\n\n` +
      `👥 **Masters Stationed Here (${roomMasters.length}):**\n${mastersSummary}\n\n` +
      `🍲 **Workstation Status:**\n${stationDetails}` +
      (platedStr ? `\n\n${platedStr}` : '')
    )
    .setColor(0xd4af37)
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
      text: `Chaldea Cafeteria MUD • Today's Menu in Chaldea • Asynchronous Co-Op`
    })
    .setTimestamp();

  // 7. Interactive Buttons Row 1: Station Actions
  const actionButtons: ButtonBuilder[] = [];

  // Room-specific primary action
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

  // Always available utility actions
  actionButtons.push(
    new ButtonBuilder()
      .setCustomId('chaldea_action_station_modal')
      .setLabel('📌 Set AFK Status')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('chaldea_action_refresh')
      .setLabel('🔄 Refresh')
      .setStyle(ButtonStyle.Secondary)
  );

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(actionButtons.slice(0, 5));

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

  const row2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(roomSelect);

  return {
    embeds: [mapEmbed, roomEmbed],
    components: [row1, row2],
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

  return false;
}
