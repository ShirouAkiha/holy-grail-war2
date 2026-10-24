// Chaldea Cafeteria & Campus Hub - Persistent Multi-User MUD Engine
// Manages real-time room locations, shared prep basin, stove timers, patron orders, and atomic disk persistence.

import fs from 'fs';
import path from 'path';
import { 
  CAFETERIA_ROOMS, 
  INGREDIENT_CATALOG, 
  RECIPES_CATALOG, 
  VISITING_PATRONS, 
  CafeteriaRoom, 
  Ingredient, 
  Recipe, 
  ServantPatron 
} from '../data/cafeteriaData';

export interface StationedMaster {
  discordId: string;
  username: string;
  avatarUrl: string;
  currentRoomId: string;
  statusText: string;
  isAfk: boolean;
  lastMovedAt: number;
  lastActivityAt: number;
  companionServantName: string;
  companionServantAvatar: string;
  companionServantSprite?: string;
  inventory: Record<string, number>;
  activePlatedDish?: {
    recipeId: string;
    recipeName: string;
    recipeEmoji: string;
    qualityScore: number;
    platedAt: number;
    cooksInvolved: string[];
  };
  totalDishesCooked: number;
  totalDishesServed: number;
}

export interface StoveCookingPot {
  id: string;
  recipeId: string;
  recipeName: string;
  recipeEmoji: string;
  startedByDiscordId: string;
  startedByUsername: string;
  startedAt: number;
  durationSeconds: number;
  readyAt: number;
  burnsAt: number;
  stirCount: number;
  lastStirredAt: number;
  stirredBy: string[];
  status: 'simmering' | 'ready' | 'burnt';
  qualityScore: number; // 50 to 100
}

export interface SharedPrepBasinItem {
  ingredientId: string;
  ingredientName: string;
  emoji: string;
  count: number;
  depositedBy: string;
  depositedAt: number;
}

export interface ActivePatronOrder {
  patronId: string;
  recipeId: string;
  arrivedAt: number;
  expiresAt: number;
  served: boolean;
  servedBy?: string;
}

export interface CafeteriaBuff {
  id: string;
  title: string;
  description: string;
  cardType?: 'Buster' | 'Arts' | 'Quick';
  bonusPercent: number;
  expiresAt: number;
}

export interface CafeteriaWorldState {
  masters: Record<string, StationedMaster>;
  sharedPrepBasin: SharedPrepBasinItem[];
  stovePots: StoveCookingPot[];
  activePatronOrders: ActivePatronOrder[];
  activeCommunityBuffs: CafeteriaBuff[];
  recentActivityFeed: Array<{ timestamp: number; text: string; roomId: string }>;
  roomForageCooldowns: Record<string, Record<string, number>>; // roomId -> ingredientId -> timestamp
  sharedFridgeVault: Record<string, number>; // ingredientId/dishId -> count
}

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const CAFETERIA_FILE = path.join(DATA_DIR, 'chaldea_cafeteria.json');
const CAFETERIA_BACKUP = path.join(DATA_DIR, 'backups', 'chaldea_cafeteria.latest.json');

let worldState: CafeteriaWorldState = {
  masters: {},
  sharedPrepBasin: [],
  stovePots: [],
  activePatronOrders: [],
  activeCommunityBuffs: [],
  recentActivityFeed: [],
  roomForageCooldowns: {},
  sharedFridgeVault: {}
};

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
  }
  const backupDir = path.join(DATA_DIR, 'backups');
  if (!fs.existsSync(backupDir)) {
    try { fs.mkdirSync(backupDir, { recursive: true }); } catch {}
  }
}

function loadCafeteriaStateFromDisk() {
  ensureDirectories();
  try {
    if (fs.existsSync(CAFETERIA_FILE)) {
      const raw = fs.readFileSync(CAFETERIA_FILE, 'utf-8');
      if (raw && raw.trim().length > 0) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          worldState = {
            masters: parsed.masters || {},
            sharedPrepBasin: parsed.sharedPrepBasin || [],
            stovePots: parsed.stovePots || [],
            activePatronOrders: parsed.activePatronOrders || [],
            activeCommunityBuffs: parsed.activeCommunityBuffs || [],
            recentActivityFeed: parsed.recentActivityFeed || [],
            roomForageCooldowns: parsed.roomForageCooldowns || {},
            sharedFridgeVault: parsed.sharedFridgeVault || {}
          };
          return;
        }
      }
    }
    // Attempt recovery from backup
    if (fs.existsSync(CAFETERIA_BACKUP)) {
      const backupRaw = fs.readFileSync(CAFETERIA_BACKUP, 'utf-8');
      if (backupRaw && backupRaw.trim().length > 0) {
        const parsed = JSON.parse(backupRaw);
        if (parsed) {
          worldState = {
            masters: parsed.masters || {},
            sharedPrepBasin: parsed.sharedPrepBasin || [],
            stovePots: parsed.stovePots || [],
            activePatronOrders: parsed.activePatronOrders || [],
            activeCommunityBuffs: parsed.activeCommunityBuffs || [],
            recentActivityFeed: parsed.recentActivityFeed || [],
            roomForageCooldowns: parsed.roomForageCooldowns || {},
            sharedFridgeVault: parsed.sharedFridgeVault || {}
          };
          return;
        }
      }
    }
  } catch (err) {
    console.error('[CafeteriaEngine] Failed to load cafeteria data from disk:', err);
  }

  // Initialize with initial patron orders if empty
  seedInitialPatronOrders();
}

function saveCafeteriaStateToDisk() {
  try {
    ensureDirectories();
    const serialized = JSON.stringify(worldState, null, 2);
    // Write backup
    try { fs.writeFileSync(CAFETERIA_BACKUP, serialized, 'utf-8'); } catch {}
    // Atomic write
    const tmp = `${CAFETERIA_FILE}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`;
    try {
      fs.writeFileSync(tmp, serialized, 'utf-8');
      fs.renameSync(tmp, CAFETERIA_FILE);
    } catch {
      fs.writeFileSync(CAFETERIA_FILE, serialized, 'utf-8');
      try { fs.unlinkSync(tmp); } catch {}
    }
  } catch (err) {
    console.error('[CafeteriaEngine] Failed to write cafeteria state to disk:', err);
  }
}

function seedInitialPatronOrders() {
  if (worldState.activePatronOrders.length === 0) {
    const p1 = VISITING_PATRONS[0]; // Artoria
    const p2 = VISITING_PATRONS[1]; // Kotomine
    worldState.activePatronOrders = [
      {
        patronId: p1.id,
        recipeId: p1.cravingRecipeId,
        arrivedAt: Date.now(),
        expiresAt: Date.now() + 25 * 60 * 1000,
        served: false
      },
      {
        patronId: p2.id,
        recipeId: p2.cravingRecipeId,
        arrivedAt: Date.now(),
        expiresAt: Date.now() + 35 * 60 * 1000,
        served: false
      }
    ];
  }
}

// Initialize on module load
loadCafeteriaStateFromDisk();

export function getOrCreateStationedMaster(
  discordId: string,
  username: string,
  avatarUrl: string,
  servantName = 'Heroic Spirit',
  servantAvatar = '',
  servantSprite = ''
): StationedMaster {
  let master = worldState.masters[discordId];
  const now = Date.now();

  if (!master) {
    master = {
      discordId,
      username,
      avatarUrl,
      currentRoomId: 'dining_hall',
      statusText: 'Browsing the cafeteria menu',
      isAfk: false,
      lastMovedAt: now,
      lastActivityAt: now,
      companionServantName: servantName,
      companionServantAvatar: servantAvatar,
      companionServantSprite: servantSprite,
      inventory: {
        miyama_rice: 2,
        chaldean_carrot: 1
      },
      totalDishesCooked: 0,
      totalDishesServed: 0
    };
    worldState.masters[discordId] = master;
    addCafeteriaActivity(`👤 Master **${username}** arrived at the **Dining Hall**.`, 'dining_hall');
    saveCafeteriaStateToDisk();
  } else {
    // Update live profile info
    master.username = username;
    if (avatarUrl) master.avatarUrl = avatarUrl;
    if (servantName) master.companionServantName = servantName;
    if (servantAvatar) master.companionServantAvatar = servantAvatar;
    if (servantSprite) master.companionServantSprite = servantSprite;
    master.lastActivityAt = now;
  }

  return master;
}

export function moveMasterRoom(discordId: string, targetRoomId: string): { success: boolean; message: string; room?: CafeteriaRoom } {
  const master = worldState.masters[discordId];
  if (!master) return { success: false, message: 'Master record not found. Please type `/chaldea` first.' };

  const targetRoom = CAFETERIA_ROOMS[targetRoomId];
  if (!targetRoom) return { success: false, message: 'Invalid room location.' };

  if (master.currentRoomId === targetRoomId) {
    return { success: true, message: `You are already stationed in **${targetRoom.name}**.`, room: targetRoom };
  }

  const fromRoom = CAFETERIA_ROOMS[master.currentRoomId];
  master.currentRoomId = targetRoomId;
  master.lastMovedAt = Date.now();
  master.lastActivityAt = Date.now();
  master.isAfk = false;
  master.statusText = `Observing the ${targetRoom.shortName}`;

  addCafeteriaActivity(`🚶 **${master.username}** moved from *${fromRoom ? fromRoom.shortName : 'Chaldea'}* to **${targetRoom.shortName}**.`, targetRoomId);
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `You walked into **${targetRoom.name}**.\n*${targetRoom.description}*`,
    room: targetRoom
  };
}

export function stationMasterCustomStatus(discordId: string, customStatus: string): { success: boolean; message: string } {
  const master = worldState.masters[discordId];
  if (!master) return { success: false, message: 'Master record not found.' };

  const trimmed = customStatus.trim().slice(0, 80);
  master.statusText = trimmed || 'Resting quietly';
  master.lastActivityAt = Date.now();
  master.isAfk = true;

  const room = CAFETERIA_ROOMS[master.currentRoomId];
  addCafeteriaActivity(`📌 **${master.username}** is now stationed at **${room.shortName}**: *"${master.statusText}"*`, master.currentRoomId);
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `Your status in **${room.name}** is now set to:\n💬 *"${master.statusText}"*`
  };
}

export function forageIngredientInRoom(discordId: string): { success: boolean; message: string; ingredient?: Ingredient } {
  const master = worldState.masters[discordId];
  if (!master) return { success: false, message: 'Master not found.' };

  const room = CAFETERIA_ROOMS[master.currentRoomId];
  if (!room.availableIngredients || room.availableIngredients.length === 0) {
    return { success: false, message: `There are no harvestable ingredients in **${room.name}**! Check the **Pantry**, **Greenhouse**, or **Cold Storage**.` };
  }

  // Pick random ingredient from room
  const ingId = room.availableIngredients[Math.floor(Math.random() * room.availableIngredients.length)];
  const ingredient = INGREDIENT_CATALOG[ingId];
  if (!ingredient) return { success: false, message: 'Ingredient error.' };

  // Check cooldown
  const now = Date.now();
  if (!worldState.roomForageCooldowns[room.id]) worldState.roomForageCooldowns[room.id] = {};
  const lastForaged = worldState.roomForageCooldowns[room.id][ingId] || 0;
  const cooldownMs = (ingredient.cooldownSeconds || 20) * 1000;

  if (now - lastForaged < cooldownMs) {
    const waitSec = Math.ceil((cooldownMs - (now - lastForaged)) / 1000);
    return {
      success: false,
      message: `⏳ **${ingredient.name}** was recently harvested here! Resupplies in **${waitSec}s**.`
    };
  }

  // Award ingredient to Master
  worldState.roomForageCooldowns[room.id][ingId] = now;
  master.inventory[ingId] = (master.inventory[ingId] || 0) + 1;
  master.lastActivityAt = now;
  master.isAfk = false;
  master.statusText = `Harvested ${ingredient.name}`;

  addCafeteriaActivity(`🌾 **${master.username}** gathered **${ingredient.emoji} ${ingredient.name}** in ${room.shortName}.`, room.id);
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `You gathered **${ingredient.emoji} ${ingredient.name}** (${ingredient.category.toUpperCase()})!\n*${ingredient.description}*\n*(Your inventory: ${master.inventory[ingId]}x)*`,
    ingredient
  };
}

export function depositIngredientToSharedBasin(discordId: string, ingredientId: string, count = 1): { success: boolean; message: string } {
  const master = worldState.masters[discordId];
  if (!master) return { success: false, message: 'Master not found.' };

  if (master.currentRoomId !== 'kitchen_prep' && master.currentRoomId !== 'pantry') {
    return { success: false, message: 'You can only deposit ingredients at the **Kitchen Prep Counter** or **Pantry**!' };
  }

  const currentCount = master.inventory[ingredientId] || 0;
  if (currentCount < count) {
    return { success: false, message: 'You do not have enough of that ingredient in your inventory.' };
  }

  const ing = INGREDIENT_CATALOG[ingredientId];
  if (!ing) return { success: false, message: 'Invalid ingredient.' };

  master.inventory[ingredientId] -= count;
  if (master.inventory[ingredientId] <= 0) delete master.inventory[ingredientId];

  // Add to shared basin
  const existing = worldState.sharedPrepBasin.find(item => item.ingredientId === ingredientId);
  if (existing) {
    existing.count += count;
    existing.depositedBy = master.username;
    existing.depositedAt = Date.now();
  } else {
    worldState.sharedPrepBasin.push({
      ingredientId,
      ingredientName: ing.name,
      emoji: ing.emoji,
      count,
      depositedBy: master.username,
      depositedAt: Date.now()
    });
  }

  master.lastActivityAt = Date.now();
  master.statusText = `Stocked ${count}x ${ing.name} in basin`;

  addCafeteriaActivity(`📦 **${master.username}** deposited **${count}x ${ing.emoji} ${ing.name}** into the Shared Prep Basin!`, master.currentRoomId);
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `Deposited **${count}x ${ing.emoji} ${ing.name}** into the **Shared Prep Basin**! Fellow Masters can now chop and prepare it.`
  };
}

export function chopAndPrepBasin(discordId: string, recipeId: string): { success: boolean; message: string; recipe?: Recipe } {
  const master = worldState.masters[discordId];
  if (!master) return { success: false, message: 'Master not found.' };

  if (master.currentRoomId !== 'kitchen_prep') {
    return { success: false, message: 'You must be at the **Kitchen — Prep & Cutting Stations** (`/move kitchen_prep`) to chop and prepare ingredients!' };
  }

  const recipe = RECIPES_CATALOG[recipeId];
  if (!recipe) return { success: false, message: 'Recipe not found.' };

  // Check required ingredients between shared basin and personal inventory
  const missing: string[] = [];
  for (const [ingId, reqCount] of Object.entries(recipe.requiredIngredients)) {
    const basinItem = worldState.sharedPrepBasin.find(b => b.ingredientId === ingId);
    const basinCount = basinItem ? basinItem.count : 0;
    const personalCount = master.inventory[ingId] || 0;
    const totalAvail = basinCount + personalCount;

    if (totalAvail < reqCount) {
      const ing = INGREDIENT_CATALOG[ingId];
      missing.push(`${ing ? ing.name : ingId} (need ${reqCount}, have ${totalAvail})`);
    }
  }

  if (missing.length > 0) {
    return {
      success: false,
      message: `❌ Cannot prep **${recipe.name}**. Missing ingredients:\n• ${missing.join('\n• ')}\n\n*Check the Pantry, Greenhouse, and Cold Storage to forage more!*`
    };
  }

  // Deduct ingredients: consume from shared basin first, then personal inventory
  for (const [ingId, reqCount] of Object.entries(recipe.requiredIngredients)) {
    let needed = reqCount;
    const basinItem = worldState.sharedPrepBasin.find(b => b.ingredientId === ingId);
    if (basinItem) {
      const takeFromBasin = Math.min(basinItem.count, needed);
      basinItem.count -= takeFromBasin;
      needed -= takeFromBasin;
    }
    if (needed > 0) {
      master.inventory[ingId] = (master.inventory[ingId] || 0) - needed;
      if (master.inventory[ingId] <= 0) delete master.inventory[ingId];
    }
  }
  // Cleanup zero-count items in basin
  worldState.sharedPrepBasin = worldState.sharedPrepBasin.filter(b => b.count > 0);

  // Store prepped recipe kit in shared fridge vault
  const preppedKey = `prepped_${recipe.id}`;
  worldState.sharedFridgeVault[preppedKey] = (worldState.sharedFridgeVault[preppedKey] || 0) + 1;

  master.lastActivityAt = Date.now();
  master.statusText = `Prepped ingredients for ${recipe.name}`;

  addCafeteriaActivity(`🔪 **${master.username}** chopped and prepped a complete kit for **${recipe.emoji} ${recipe.name}**!`, 'kitchen_prep');
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `🔪 **Knife skills executed perfectly!**\nYou combined and diced all ingredients into a **Prepped Kit for ${recipe.emoji} ${recipe.name}**!\n\n*Head to the Stoves & Ovens (/move kitchen_stove) to ignite the flame and cook it!*`,
    recipe
  };
}

export function startStoveCooking(discordId: string, recipeId: string): { success: boolean; message: string; pot?: StoveCookingPot } {
  const master = worldState.masters[discordId];
  if (!master) return { success: false, message: 'Master not found.' };

  if (master.currentRoomId !== 'kitchen_stove') {
    return { success: false, message: 'You must be at the **Kitchen — Stoves & Commercial Ovens** (`/move kitchen_stove`) to start cooking!' };
  }

  const recipe = RECIPES_CATALOG[recipeId];
  if (!recipe) return { success: false, message: 'Recipe not found.' };

  const preppedKey = `prepped_${recipe.id}`;
  const preppedAvailable = worldState.sharedFridgeVault[preppedKey] || 0;

  // If no prepped kit in fridge vault, check if player has all raw ingredients directly
  if (preppedAvailable <= 0) {
    let hasDirectRaw = true;
    for (const [ingId, reqCount] of Object.entries(recipe.requiredIngredients)) {
      if ((master.inventory[ingId] || 0) < reqCount) {
        hasDirectRaw = false;
        break;
      }
    }

    if (!hasDirectRaw) {
      return {
        success: false,
        message: `❌ No prepped kit for **${recipe.name}** found on the counter!\nGo to **Kitchen Prep Counter** (/move kitchen_prep) to chop ingredients into a prepped mix, or gather the required ingredients.`
      };
    }

    // Deduct raw ingredients directly
    for (const [ingId, reqCount] of Object.entries(recipe.requiredIngredients)) {
      master.inventory[ingId] -= reqCount;
      if (master.inventory[ingId] <= 0) delete master.inventory[ingId];
    }
  } else {
    worldState.sharedFridgeVault[preppedKey] -= 1;
    if (worldState.sharedFridgeVault[preppedKey] <= 0) delete worldState.sharedFridgeVault[preppedKey];
  }

  // Maximum 4 active pots simultaneously on the stove line
  if (worldState.stovePots.length >= 4) {
    return { success: false, message: 'All 4 stove ranges are currently occupied! Stir or plate one of the existing pots first.' };
  }

  const now = Date.now();
  const cookSec = recipe.cookTimeSeconds || 60;
  const pot: StoveCookingPot = {
    id: `pot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    recipeId: recipe.id,
    recipeName: recipe.name,
    recipeEmoji: recipe.emoji,
    startedByDiscordId: master.discordId,
    startedByUsername: master.username,
    startedAt: now,
    durationSeconds: cookSec,
    readyAt: now + cookSec * 1000,
    burnsAt: now + (cookSec + 90) * 1000, // Burns 90 seconds after ready if neglected
    stirCount: 0,
    lastStirredAt: now,
    stirredBy: [master.username],
    status: 'simmering',
    qualityScore: 70
  };

  worldState.stovePots.push(pot);
  master.lastActivityAt = now;
  master.statusText = `Stirring ${recipe.name} on the stove`;

  addCafeteriaActivity(`🔥 **${master.username}** lit the gas range and began simmering **${recipe.emoji} ${recipe.name}**! (Ready in ${Math.round(cookSec / 60)}m)`, 'kitchen_stove');
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `🔥 **Flame ignited!**\n**${recipe.emoji} ${recipe.name}** is now simmering on Stove Range #${worldState.stovePots.length}!\n• **Cook Time:** ${cookSec} seconds\n• **Tip:** Visit the stove to [Stir Pot] to increase its culinary quality score!`,
    pot
  };
}

export function stirStovePot(discordId: string, potId?: string): { success: boolean; message: string; pot?: StoveCookingPot } {
  const master = worldState.masters[discordId];
  if (!master) return { success: false, message: 'Master not found.' };

  if (master.currentRoomId !== 'kitchen_stove') {
    return { success: false, message: 'You must be at the **Kitchen — Stoves & Commercial Ovens** to stir the pots!' };
  }

  tickCafeteriaWorld();

  if (worldState.stovePots.length === 0) {
    return { success: false, message: 'There are currently no active pots on the stove! Use `[Start Recipe]` to begin one.' };
  }

  const targetPot = potId ? worldState.stovePots.find(p => p.id === potId) : worldState.stovePots[0];
  if (!targetPot) return { success: false, message: 'Cooking pot not found.' };

  if (targetPot.status === 'burnt') {
    return { success: false, message: `⚠️ This **${targetPot.recipeName}** unfortunately burned! It must be cleared from the stove.` };
  }

  targetPot.stirCount += 1;
  targetPot.lastStirredAt = Date.now();
  targetPot.burnsAt += 30 * 1000; // Stirring extends burn window by 30 seconds
  targetPot.qualityScore = Math.min(100, targetPot.qualityScore + 6);
  if (!targetPot.stirredBy.includes(master.username)) {
    targetPot.stirredBy.push(master.username);
  }

  master.lastActivityAt = Date.now();
  master.statusText = `Tending ${targetPot.recipeName}`;

  addCafeteriaActivity(`🥄 **${master.username}** stirred the simmering **${targetPot.recipeEmoji} ${targetPot.recipeName}** (Quality: ${targetPot.qualityScore}/100)!`, 'kitchen_stove');
  saveCafeteriaStateToDisk();

  const now = Date.now();
  const remainingSec = Math.max(0, Math.ceil((targetPot.readyAt - now) / 1000));
  const statusNote = remainingSec > 0 ? `Ready in **${remainingSec}s**` : `**READY TO PLATE!**`;

  return {
    success: true,
    message: `🥄 **Pot stirred with precision!**\n**${targetPot.recipeEmoji} ${targetPot.recipeName}**\n• Status: ${statusNote}\n• Culinary Quality: **${targetPot.qualityScore}/100**\n• Stir Count: **${targetPot.stirCount}**\n• Cooks Involved: ${targetPot.stirredBy.join(', ')}`,
    pot: targetPot
  };
}

export function plateFinishedDish(discordId: string, potId?: string): { success: boolean; message: string; recipe?: Recipe } {
  const master = worldState.masters[discordId];
  if (!master) return { success: false, message: 'Master not found.' };

  if (master.currentRoomId !== 'kitchen_stove' && master.currentRoomId !== 'dining_hall') {
    return { success: false, message: 'You must be at the **Stoves** or **Dining Hall** to plate finished dishes!' };
  }

  tickCafeteriaWorld();

  const targetPot = potId 
    ? worldState.stovePots.find(p => p.id === potId)
    : worldState.stovePots.find(p => p.status === 'ready');

  if (!targetPot) {
    const simmeringPot = worldState.stovePots[0];
    if (simmeringPot && simmeringPot.status === 'simmering') {
      const waitSec = Math.ceil((simmeringPot.readyAt - Date.now()) / 1000);
      return { success: false, message: `⏳ **${simmeringPot.recipeName}** is still simmering! **${waitSec}s remaining** before it is ready to plate.` };
    }
    return { success: false, message: 'There are no dishes ready to plate on the stoves.' };
  }

  if (targetPot.status === 'burnt') {
    // Discard burnt pot
    worldState.stovePots = worldState.stovePots.filter(p => p.id !== targetPot.id);
    saveCafeteriaStateToDisk();
    return { success: false, message: `🗑️ The burnt **${targetPot.recipeName}** was scraped into the waste bin and the pan was cleaned.` };
  }

  const recipe = RECIPES_CATALOG[targetPot.recipeId];
  if (!recipe) return { success: false, message: 'Recipe reference missing.' };

  // Remove from stove pots
  worldState.stovePots = worldState.stovePots.filter(p => p.id !== targetPot.id);

  // Set as master's active plated dish
  master.activePlatedDish = {
    recipeId: targetPot.recipeId,
    recipeName: targetPot.recipeName,
    recipeEmoji: targetPot.recipeEmoji,
    qualityScore: targetPot.qualityScore,
    platedAt: Date.now(),
    cooksInvolved: targetPot.stirredBy
  };
  master.totalDishesCooked += 1;
  master.lastActivityAt = Date.now();
  master.statusText = `Carrying fresh ${targetPot.recipeName} to Dining Hall`;

  addCafeteriaActivity(`🍽️ **${master.username}** plated a steaming order of **${targetPot.recipeEmoji} ${targetPot.recipeName}** (Quality: ${targetPot.qualityScore}/100)!`, 'kitchen_stove');
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `🍽️ **Dish plated to perfection!**\nYou are now carrying **${targetPot.recipeEmoji} ${targetPot.recipeName}**!\n• Quality: **${targetPot.qualityScore}/100**\n• Cooks: ${targetPot.stirredBy.join(', ')}\n\n*Head to the **Dining Hall** (/move dining_hall) to serve it to visiting Servant patrons!*`,
    recipe
  };
}

export function serveDishToPatron(
  discordId: string, 
  patronId: string,
  aiCritiqueText?: string,
  starRating?: number
): { success: boolean; message: string; rewards?: { sqShards: number; friendPoints: number; buff?: CafeteriaBuff } } {
  const master = worldState.masters[discordId];
  if (!master) return { success: false, message: 'Master record not found.' };

  if (master.currentRoomId !== 'dining_hall') {
    return { success: false, message: 'You must be in the **Cafeteria Dining Hall** (`/move dining_hall`) to serve meals to patrons!' };
  }

  if (!master.activePlatedDish) {
    return { success: false, message: 'You are not carrying any plated dishes! Visit the stoves (`/move kitchen_stove`) to plate a cooked dish.' };
  }

  const patron = VISITING_PATRONS.find(p => p.id === patronId);
  if (!patron) return { success: false, message: 'Visiting patron not found in the dining hall.' };

  const dish = master.activePlatedDish;
  const recipe = RECIPES_CATALOG[dish.recipeId];
  const isCraveMatch = patron.cravingRecipeId === dish.recipeId;

  // Base score calculation
  const stars = starRating || (isCraveMatch ? (dish.qualityScore >= 85 ? 5 : 4) : (dish.qualityScore >= 80 ? 4 : 3));
  const sqReward = stars === 5 ? 3 : stars >= 4 ? 2 : 1;
  const fpReward = stars * 150;

  // Clear plated dish
  delete master.activePlatedDish;
  master.totalDishesServed += 1;
  master.lastActivityAt = Date.now();
  master.statusText = `Served ${dish.recipeName} to ${patron.name}`;

  // Apply community buff if recipe exists
  let awardedBuff: CafeteriaBuff | undefined;
  if (recipe && recipe.buffEffect) {
    awardedBuff = {
      id: `buff_${recipe.id}_${Date.now()}`,
      title: recipe.buffEffect.title,
      description: recipe.buffEffect.description,
      cardType: recipe.buffEffect.cardType,
      bonusPercent: recipe.buffEffect.statBonusPercent || 15,
      expiresAt: Date.now() + (recipe.buffEffect.durationHours || 4) * 3600 * 1000
    };
    // Keep max 3 active buffs
    worldState.activeCommunityBuffs.unshift(awardedBuff);
    if (worldState.activeCommunityBuffs.length > 3) worldState.activeCommunityBuffs.pop();
  }

  // Update order status if matching
  const matchingOrder = worldState.activePatronOrders.find(o => o.patronId === patronId && !o.served);
  if (matchingOrder) {
    matchingOrder.served = true;
    matchingOrder.servedBy = master.username;
  }

  addCafeteriaActivity(`⭐ **${master.username}** served **${dish.recipeEmoji} ${dish.recipeName}** to **${patron.name}**! Rating: ${'★'.repeat(stars)} (${stars}/5 Stars)`, 'dining_hall');
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `✨ **Meal Presented to ${patron.name}!**\n${'★'.repeat(stars)}${'☆'.repeat(5 - stars)} (**${stars} / 5 Stars**)\n\n${aiCritiqueText || `“${patron.fallbackPraiseQuotes[0]}”`}\n\n🎁 **Rewards Granted to Team:**\n• **+${sqReward} Saint Quartz Shard(s)**\n• **+${fpReward} Friend Points**\n${awardedBuff ? `• **Community Buff:** ${awardedBuff.title} (*${awardedBuff.description}*)` : ''}`,
    rewards: {
      sqShards: sqReward,
      friendPoints: fpReward,
      buff: awardedBuff
    }
  };
}

export function tickCafeteriaWorld(): void {
  const now = Date.now();

  // 1. Update stove pots
  for (const pot of worldState.stovePots) {
    if (pot.status === 'simmering' && now >= pot.readyAt) {
      pot.status = 'ready';
      addCafeteriaActivity(`🔔 **Ding!** The **${pot.recipeEmoji} ${pot.recipeName}** on the stove is now cooked and ready to plate!`, 'kitchen_stove');
    } else if (pot.status === 'ready' && now >= pot.burnsAt) {
      pot.status = 'burnt';
      addCafeteriaActivity(`💨 **Smoke billowing!** The **${pot.recipeEmoji} ${pot.recipeName}** was left on the flame too long and burned!`, 'kitchen_stove');
    }
  }

  // 2. Mark inactive masters as AFK (>2 minutes without action)
  for (const m of Object.values(worldState.masters)) {
    if (!m.isAfk && now - m.lastActivityAt > 2 * 60 * 1000) {
      m.isAfk = true;
      if (!m.statusText || m.statusText.startsWith('Observing') || m.statusText.startsWith('Browsing')) {
        m.statusText = 'Resting quietly / AFK';
      }
    }
  }

  // 3. Cycle patron orders
  worldState.activePatronOrders = worldState.activePatronOrders.filter(o => now < o.expiresAt);
  if (worldState.activePatronOrders.length < 2) {
    const unselected = VISITING_PATRONS.filter(p => !worldState.activePatronOrders.some(o => o.patronId === p.id));
    if (unselected.length > 0) {
      const nextPatron = unselected[Math.floor(Math.random() * unselected.length)];
      worldState.activePatronOrders.push({
        patronId: nextPatron.id,
        recipeId: nextPatron.cravingRecipeId,
        arrivedAt: now,
        expiresAt: now + 30 * 60 * 1000,
        served: false
      });
      addCafeteriaActivity(`🚪 **${nextPatron.name}** (${nextPatron.servantClass}) entered the Dining Hall craving **${nextPatron.cravingName}**!`, 'dining_hall');
    }
  }

  // 4. Clean expired community buffs
  worldState.activeCommunityBuffs = worldState.activeCommunityBuffs.filter(b => now < b.expiresAt);
}

export function addCafeteriaActivity(text: string, roomId: string): void {
  worldState.recentActivityFeed.unshift({
    timestamp: Date.now(),
    text,
    roomId
  });
  if (worldState.recentActivityFeed.length > 25) {
    worldState.recentActivityFeed.pop();
  }
}

export function getCafeteriaWorldSnapshot() {
  tickCafeteriaWorld();
  return worldState;
}

export function getRoomStationedMasters(roomId: string): StationedMaster[] {
  return Object.values(worldState.masters).filter(m => m.currentRoomId === roomId);
}
