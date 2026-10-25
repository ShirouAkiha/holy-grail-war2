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
  currentHp: number;
  maxHp: number;
  isHospitalized: boolean;
  hospitalizedAt?: number;
  burnStatus?: 'none' | 'singed' | 'fainted';
  fireResistanceUntil?: number;
  activeRecoveryType?: 'none' | 'bed_rest';
  bedRestStartedAt?: number;
  bedRestInitialHp?: number;
  attendingDoctorId?: 'nightingale' | 'asclepius' | 'bb';
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

export interface RoomHazard {
  roomId: string;
  stage: 1 | 2 | 3 | 4; // 1: Stable/Simmering, 2: Neglected/Smoke, 3: Hazard Flare, 4: Structural Breakdown
  hazardType: 'grease_fire' | 'mana_leak' | 'spore_overgrowth' | 'arcane_overload';
  originMasterId?: string;
  originMasterName?: string;
  sourceDishName?: string;
  startedAt: number;
  stage2At: number;
  stage3At: number;
  stage4At: number;
  extinguishedBy?: string;
  repairsContributed: number; // Labor effort clicks (0 / 3)
  requiredRepairs: number;    // e.g. 3
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
  roomHazards: Record<string, RoomHazard>;
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
  sharedFridgeVault: {},
  roomHazards: {}
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
            sharedFridgeVault: parsed.sharedFridgeVault || {},
            roomHazards: parsed.roomHazards || {}
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
            sharedFridgeVault: parsed.sharedFridgeVault || {},
            roomHazards: parsed.roomHazards || {}
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
      totalDishesServed: 0,
      currentHp: 100,
      maxHp: 100,
      isHospitalized: false,
      burnStatus: 'none',
      activeRecoveryType: 'none',
      attendingDoctorId: 'nightingale'
    };
    worldState.masters[discordId] = master;
    addCafeteriaActivity(`👤 Master **${username}** arrived at the **Dining Hall**.`, 'dining_hall');
    saveCafeteriaStateToDisk();
  } else {
    // Ensure default HP fields exist for loaded records
    if (typeof master.currentHp !== 'number') master.currentHp = 100;
    if (typeof master.maxHp !== 'number') master.maxHp = 100;
    if (typeof master.isHospitalized !== 'boolean') master.isHospitalized = false;
    if (!master.burnStatus) master.burnStatus = 'none';
    if (!master.activeRecoveryType) master.activeRecoveryType = 'none';
    if (!master.attendingDoctorId) master.attendingDoctorId = 'nightingale';

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

  // Hospitalization lock: cannot leave the Infirmary until treatment is complete
  if (master.isHospitalized && master.currentHp < master.maxHp && targetRoomId !== 'infirmary') {
    return {
      success: false,
      message: '🏥 **HOSPITALIZED (RESTRICTED):** Head Nurse Nightingale and Asclepius will not permit you to leave the Infirmary until your recovery is complete! Select a recovery option in the Infirmary.'
    };
  }

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

  // 1. Update stove pots & trigger Stage 2 hazard for neglected pots
  for (const pot of worldState.stovePots) {
    if (pot.status === 'simmering' && now >= pot.readyAt) {
      pot.status = 'ready';
      addCafeteriaActivity(`🔔 **Ding!** The **${pot.recipeEmoji} ${pot.recipeName}** on the stove is now cooked and ready to plate!`, 'kitchen_stove');
    } else if (pot.status === 'ready' && now >= pot.burnsAt) {
      pot.status = 'burnt';
      addCafeteriaActivity(`💨 **Smoke billowing!** The **${pot.recipeEmoji} ${pot.recipeName}** was left on the flame too long and burned!`, 'kitchen_stove');

      // Trigger/update kitchen_stove hazard timing
      const h = getRoomHazard('kitchen_stove');
      if (h.stage === 1) {
        h.stage = 2; // Neglected / Smoke
        h.originMasterId = pot.startedByDiscordId;
        h.originMasterName = pot.startedByUsername;
        h.sourceDishName = pot.recipeName;
        h.startedAt = now;
        h.stage2At = now;
        h.stage3At = now + 5 * 60 * 1000;  // Flare after 5 min
        h.stage4At = now + 15 * 60 * 1000; // Breakdown after 15 min
      }
    }
  }

  // 1b. Evaluate background real-time room hazards based on timestamps
  for (const [rId, h] of Object.entries(worldState.roomHazards)) {
    if (h.stage === 2 && now >= h.stage3At) {
      h.stage = 3; // Hazard Flare (On Fire)
      addCafeteriaActivity(`🔥 **FIRE ALERT!** The unattended smoke in **${rId}** has ignited into a **Hazard Flare**! Action needed!`, rId);
    } else if (h.stage === 3 && now >= h.stage4At) {
      h.stage = 4; // Structural Breakdown (Room Locked)
      addCafeteriaActivity(`💥 **CRITICAL LOCKDOWN!** Severe structural damage in **${rId}**! All room activities suspended until repaired.`, rId);
    }
  }

  // 1c. Health Exposure & Passive Recovery Tick Engine
  for (const m of Object.values(worldState.masters)) {
    if (typeof m.currentHp !== 'number') m.currentHp = 100;
    if (typeof m.maxHp !== 'number') m.maxHp = 100;

    const roomHazard = worldState.roomHazards[m.currentRoomId];
    const isFireResistant = Boolean(m.fireResistanceUntil && now < m.fireResistanceUntil);

    if (roomHazard && roomHazard.stage >= 3 && !isFireResistant && !m.isHospitalized) {
      const dmg = roomHazard.stage === 4 ? 20 : 10;
      m.currentHp = Math.max(0, m.currentHp - dmg);
      m.burnStatus = m.currentHp <= 0 ? 'fainted' : 'singed';
      m.statusText = m.currentHp <= 0 ? '🔥 COLLAPSED IN SMOKE' : '🔥 COUGHING IN SMOKE';

      if (m.currentHp <= 0) {
        m.currentRoomId = 'infirmary';
        m.isHospitalized = true;
        m.hospitalizedAt = now;
        m.activeRecoveryType = 'none';
        m.bedRestStartedAt = undefined;
        m.statusText = '🏥 Admitted in Infirmary (Awaiting Treatment)';
        addCafeteriaActivity(`🏥 **MEDICAL WARD ADMISSION REPORT:** Master **${m.username}** collapsed from severe smoke inhalation in ${roomHazard.roomId}! Stretchered to the Infirmary under Nurse Nightingale's care.`, 'infirmary');
      }
    } else if (m.isHospitalized || m.currentRoomId === 'infirmary') {
      // Automatic recovery is DISABLED.
      // Master only recovers over 1 hour if they explicitly selected [🛏️ Bed Rest]
      if (m.activeRecoveryType === 'bed_rest' && m.bedRestStartedAt) {
        const elapsedMs = Math.max(0, now - m.bedRestStartedAt);
        const totalDurationMs = 60 * 60 * 1000; // 60 minutes = 1 full hour
        const initialHp = typeof m.bedRestInitialHp === 'number' ? m.bedRestInitialHp : 0;
        const progress = Math.min(1.0, elapsedMs / totalDurationMs);
        const computedHp = Math.min(m.maxHp, initialHp + Math.floor(progress * (m.maxHp - initialHp)));

        m.currentHp = computedHp;

        if (elapsedMs >= totalDurationMs || m.currentHp >= m.maxHp) {
          m.currentHp = m.maxHp;
          m.isHospitalized = false;
          m.burnStatus = 'none';
          m.activeRecoveryType = 'none';
          m.bedRestStartedAt = undefined;
          m.statusText = 'Resting peacefully (Fully Recovered)';
          addCafeteriaActivity(`✨ **DISCHARGE APPROVED:** Master **${m.username}** completed 1 full hour of bed rest and made a 100% full recovery!`, 'infirmary');
        }
      }
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

export function getRoomHazard(roomId: string): RoomHazard {
  if (!worldState.roomHazards[roomId]) {
    worldState.roomHazards[roomId] = {
      roomId,
      stage: 1,
      hazardType: roomId === 'kitchen_stove' ? 'grease_fire' : roomId === 'greenhouse' ? 'spore_overgrowth' : 'mana_leak',
      startedAt: Date.now(),
      stage2At: Date.now() + 1000 * 60 * 60 * 24,
      stage3At: Date.now() + 1000 * 60 * 60 * 24,
      stage4At: Date.now() + 1000 * 60 * 60 * 24,
      repairsContributed: 0,
      requiredRepairs: 3
    };
  }
  return worldState.roomHazards[roomId];
}

export function dumpBurntPot(discordId: string, potId?: string): { success: boolean; message: string } {
  const master = worldState.masters[discordId];
  if (!master) return { success: false, message: 'Master not found.' };

  const pot = potId ? worldState.stovePots.find(p => p.id === potId) : worldState.stovePots.find(p => p.status === 'burnt');
  if (!pot) return { success: false, message: 'No burnt pots found on the stoves.' };

  worldState.stovePots = worldState.stovePots.filter(p => p.id !== pot.id);

  const remainingBurnt = worldState.stovePots.some(p => p.status === 'burnt');
  if (!remainingBurnt && worldState.roomHazards['kitchen_stove']?.stage === 2) {
    worldState.roomHazards['kitchen_stove'].stage = 1;
  }

  addCafeteriaActivity(`🗑️ **${master.username}** scraped the burnt **${pot.recipeEmoji} ${pot.recipeName}** into the waste bin and scrubbed the pot clean.`, 'kitchen_stove');
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `🗑️ **Scraped & Discarded!**\nYou dumped the burnt **${pot.recipeEmoji} ${pot.recipeName}** into the disposal unit and wiped down the range.`
  };
}

export function extinguishRoomHazard(discordId: string, roomId: string): { success: boolean; message: string } {
  const master = worldState.masters[discordId];
  if (!master) return { success: false, message: 'Master not found.' };

  const hazard = getRoomHazard(roomId);
  if (hazard.stage < 2) {
    return { success: false, message: 'The room is currently clear of active fires or hazards!' };
  }

  if (hazard.stage === 4) {
    return { success: false, message: 'The hazard has already collapsed into Structural Breakdown! Use [🛠️ Repair Flues] or [💎 Instant Fix] to restore the room.' };
  }

  const originName = hazard.originMasterName ? `@${hazard.originMasterName}` : 'a neglectful cook';
  hazard.stage = 1;
  hazard.extinguishedBy = master.username;

  if (roomId === 'kitchen_stove') {
    worldState.stovePots = worldState.stovePots.filter(p => p.status !== 'burnt');
  }

  const broadcastMsg = `🚨 **HEROIC FIRST RESPONDER!** Master **${master.username}** grabbed the fire extinguisher and extinguished the ${hazard.hazardType.replace('_', ' ')} in **${roomId}**! The room was saved from ${originName}'s smoking dish!`;
  addCafeteriaActivity(broadcastMsg, roomId);
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `🧯 **HAZARD EXTINGUISHED!**\nYou swiftly deployed the CO2 extinguisher, dousing the flames and venting the smoke!\n\n🎁 **Heroic Honors Granted:**\n• **+200 Friend Points**\n• **Karma Title:** *Chaldea First Responder*`
  };
}

export function repairRoomStructuralDamage(discordId: string, roomId: string): { success: boolean; message: string; fullyRepaired: boolean } {
  const master = worldState.masters[discordId];
  if (!master) return { success: false, message: 'Master not found.', fullyRepaired: false };

  const hazard = getRoomHazard(roomId);
  if (hazard.stage !== 4) {
    return { success: false, message: 'This room does not currently suffer from structural breakdown.', fullyRepaired: false };
  }

  hazard.repairsContributed += 1;
  const current = hazard.repairsContributed;
  const req = hazard.requiredRepairs || 3;

  if (current >= req) {
    hazard.stage = 1;
    hazard.repairsContributed = 0;
    if (roomId === 'kitchen_stove') {
      worldState.stovePots = worldState.stovePots.filter(p => p.status !== 'burnt');
    }

    addCafeteriaActivity(`🛠️ **ROOM RESTORED!** Master **${master.username}** finished repairing the flues in **${roomId}**! Structural integrity restored.`, roomId);
    saveCafeteriaStateToDisk();

    return {
      success: true,
      message: `🛠️ **FINAL REPAIR COMPLETE!** (${current}/${req})\nYou replaced the scorched ventilation flues and recalibrated safety controls! **${roomId} is now fully operational!**\n\n🎁 **Rewards Granted:** +250 Friend Points!`,
      fullyRepaired: true
    };
  } else {
    addCafeteriaActivity(`🔧 **${master.username}** performed repair work on the damaged flues in **${roomId}** (${current}/${req}).`, roomId);
    saveCafeteriaStateToDisk();

    return {
      success: true,
      message: `🔧 **Repair Progress Applied!** (${current}/${req})\nYou scrubbed scorched soot and replaced a heat baffle! **${req - current} more repair effort action(s)** needed to fully restore the room.`,
      fullyRepaired: false
    };
  }
}

export function instantRepairRoomSQ(discordId: string, roomId: string, costSq = 5): { success: boolean; message: string } {
  const master = worldState.masters[discordId];
  if (!master) return { success: false, message: 'Master not found.' };

  const hazard = getRoomHazard(roomId);
  hazard.stage = 1;
  hazard.repairsContributed = 0;

  if (roomId === 'kitchen_stove') {
    worldState.stovePots = worldState.stovePots.filter(p => p.status !== 'burnt');
  }

  addCafeteriaActivity(`💎 **INSTANT RESTORATION!** Master **${master.username}** spent **${costSq} Saint Quartz** to summon Caster water magic, instantly repairing **${roomId}**!`, roomId);
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `💎 **INSTANT REPAIR SUCCESSFUL!**\nYou expended **${costSq} Saint Quartz** to weave an arcana restorative spell. All soot and structural damage in **${roomId}** have been erased instantly!`
  };
}

export function startBedRest(discordId: string): { success: boolean; message: string; elapsedMin: number; remMin: number; currentHp: number } {
  const master = worldState.masters[discordId];
  if (!master) return { success: false, message: 'Master record not found.', elapsedMin: 0, remMin: 60, currentHp: 0 };

  if (master.currentRoomId !== 'infirmary') {
    return { success: false, message: 'You must be in the Chaldea Infirmary to rest in a hospital bed.', elapsedMin: 0, remMin: 60, currentHp: master.currentHp };
  }

  const now = Date.now();
  if (master.activeRecoveryType === 'bed_rest' && master.bedRestStartedAt) {
    const elapsedMs = now - master.bedRestStartedAt;
    const elapsedMin = Math.floor(elapsedMs / 60000);
    const remMin = Math.max(0, 60 - elapsedMin);
    return {
      success: true,
      message: `🛏️ **Bed Rest Already in Progress!**\nYou are tucked into a clean medical bed.\n• Time Elapsed: **${elapsedMin} / 60 minutes**\n• Current HP: **${master.currentHp}/${master.maxHp}**\n• Time Remaining: **${remMin} minute(s)** until full discharge.`,
      elapsedMin,
      remMin,
      currentHp: master.currentHp
    };
  }

  master.activeRecoveryType = 'bed_rest';
  master.bedRestStartedAt = now;
  master.bedRestInitialHp = master.currentHp;
  master.statusText = '🛏️ Resting in Infirmary Bed (Recovering)';
  master.isAfk = true;

  addCafeteriaActivity(`🛏️ Master **${master.username}** tucked into an Infirmary bed to begin a 1-hour healing rest.`, 'infirmary');
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `🛏️ **1-HOUR BED REST COMMENCED!**\nHead Nurse Nightingale and Asclepius have adjusted your IV fluids and tucked you into a comfortable hospital bed.\n• **Recovery Duration:** 60 minutes real time\n• **Starting HP:** ${master.currentHp}/${master.maxHp}\n• **Estimated Discharge:** In 60 minutes`,
    elapsedMin: 0,
    remMin: 60,
    currentHp: master.currentHp
  };
}

export function setAttendingDoctor(discordId: string, doctorId: 'nightingale' | 'asclepius' | 'bb'): { success: boolean; message: string } {
  const master = worldState.masters[discordId];
  if (!master) return { success: false, message: 'Master record not found.' };
  master.attendingDoctorId = doctorId;
  saveCafeteriaStateToDisk();
  return { success: true, message: `Attending doctor updated to ${doctorId}.` };
}

export function drinkBurnSalve(discordId: string): { success: boolean; message: string } {
  const master = worldState.masters[discordId];
  if (!master) return { success: false, message: 'Master record not found.' };

  const inv = master.inventory || {};
  const herbKey = inv['chaldean_carrot'] ? 'chaldean_carrot' : inv['miyama_rice'] ? 'miyama_rice' : Object.keys(inv)[0];

  if (!herbKey || (inv[herbKey] || 0) < 1) {
    return { success: false, message: '❌ You do not have any gathered herbs or produce in your apron to brew a burn salve! Harvest produce in the Greenhouse or Pantry.' };
  }

  inv[herbKey] -= 1;
  if (inv[herbKey] <= 0) delete inv[herbKey];

  master.currentHp = Math.min(master.maxHp, master.currentHp + 50);
  master.burnStatus = 'none';
  if (master.currentHp >= master.maxHp) {
    master.isHospitalized = false;
    master.activeRecoveryType = 'none';
    master.bedRestStartedAt = undefined;
    master.statusText = 'Fully recovered with Burn Salve';
  }

  addCafeteriaActivity(`🧪 **${master.username}** drank a freshly brewed herbal burn salve in the Infirmary (+50 HP)!`, 'infirmary');
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `🧪 **HERBAL BURN SALVE CONSUMED!**\nYou drank a soothing herbal decoction brewed by Asclepius.\n• Restored **+50 HP** (Current HP: ${master.currentHp}/${master.maxHp})\n• Cleared Burn & Singed status!`
  };
}

export function instantRejuvenationSQ(discordId: string, costSq = 500): { success: boolean; message: string } {
  const master = worldState.masters[discordId];
  if (!master) return { success: false, message: 'Master record not found.' };

  master.currentHp = master.maxHp;
  master.isHospitalized = false;
  master.burnStatus = 'none';
  master.activeRecoveryType = 'none';
  master.bedRestStartedAt = undefined;
  master.fireResistanceUntil = Date.now() + 60 * 60 * 1000;
  master.statusText = 'Shielded with Fire Resistance';

  addCafeteriaActivity(`💎 **DIVINE REJUVENATION!** Master **${master.username}** expended **${costSq} Saint Quartz** for instant restoration and 1-hour Fire Resistance!`, 'infirmary');
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `💎 **INSTANT REJUVENATION SUCCESSFUL!**\nAsclepius and Paracelsus administered divine stasis rejuvenation.\n• **HP Fully Restored** (100/100)\n• **Discharged from Infirmary**\n• **Buff Unlocked:** 🔥 *Fire Resistance* (Immune to smoke & burn damage for 1 hour!)`
  };
}

export function bringFruitBasketToFriend(rescuerId: string, targetId: string): { success: boolean; message: string } {
  const rescuer = worldState.masters[rescuerId];
  const target = worldState.masters[targetId];

  if (!rescuer || !target) return { success: false, message: 'Master records not found.' };

  target.currentHp = Math.min(target.maxHp, target.currentHp + 35);
  // If friend is undergoing bed rest, advance their rest timer by 30 minutes!
  if (target.activeRecoveryType === 'bed_rest' && target.bedRestStartedAt) {
    target.bedRestStartedAt -= 30 * 60 * 1000;
  }
  if (target.currentHp >= target.maxHp) {
    target.isHospitalized = false;
    target.burnStatus = 'none';
    target.activeRecoveryType = 'none';
    target.bedRestStartedAt = undefined;
  }

  addCafeteriaActivity(`🤝 **BEDSIDE CARE!** Master **${rescuer.username}** presented a fresh Fruit Basket to **${target.username}** in the Infirmary (+35 HP, +50 FP)!`, 'infirmary');
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `🍎 **FRUIT BASKET DELIVERED!**\nYou presented a fresh basket of Holy Eden apples to **${target.username}**!\n• Restored **+35 HP** and advanced bed rest time by 30 minutes!\n• Granted **+50 Friend Points** to you!`
  };
}

export function performHeroRescue(rescuerId: string, targetId: string): { success: boolean; message: string } {
  const rescuer = worldState.masters[rescuerId];
  const target = worldState.masters[targetId];

  if (!rescuer || !target) return { success: false, message: 'Master records not found.' };

  const currentRoom = rescuer.currentRoomId;
  target.currentRoomId = 'infirmary';
  target.isHospitalized = true;
  target.hospitalizedAt = Date.now();
  target.statusText = '🏥 Admitted in Infirmary (Rescued)';

  addCafeteriaActivity(`🚑 **HEROIC RESCUE!** Master **${rescuer.username}** dashed through the flames and dragged unconscious **${target.username}** out of ${currentRoom} to the Infirmary!`, currentRoom);
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `🚑 **HEROIC RESCUE EXECUTED!**\nYou fearlessly threw open the burning door, lifted **${target.username}** over your shoulder, and carried them out of the inferno to the Infirmary!\n\n🎁 **Heroic Rewards Granted:**\n• **+100 Friend Points**\n• **Karma:** *Lawful Good Hero*`
  };
}
