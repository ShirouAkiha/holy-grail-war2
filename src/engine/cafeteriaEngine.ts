// Chaldea Cafeteria & Campus Hub - Persistent Multi-User MUD Engine
// Manages real-time room locations, shared prep basin, stove timers, patron orders, and atomic disk persistence.

import fs from 'fs';
import path from 'path';
import { 
  CAFETERIA_ROOMS, 
  INGREDIENT_CATALOG, 
  RECIPES_CATALOG, 
  VISITING_PATRONS, 
  ATTENDING_DOCTORS,
  CHALDEA_SHOP_CATALOG,
  CHALDEA_RANK_TIERS,
  ChaldeaRankTier,
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
  attendingDoctorId?: 'nightingale' | 'asclepius' | 'bb' | 'paracelsus';
  friendPoints?: number;
  facilityUpgrades?: {
    extraStoves?: number;
    extraPrepCounters?: number;
    hydroponicLamps?: number;
  };
  dailyGiftsSent?: Record<string, { count: number; lastGiftDate: string }>;
  fruitBasketsCount?: number;
  lastHazardNotifiedAt?: number;
  unreadNotifications?: Array<{
    id: string;
    timestamp: number;
    title: string;
    message: string;
    type: 'hazard' | 'rescue' | 'gift' | 'system';
  }>;
  meritPoints?: number;
  disciplinaryBlacklistUntil?: number;
  isLockedInRestroom?: boolean;
  lockedUntil?: number;
  swirliesReceived?: number;
  timesImpeached?: number;
}

export interface StoveCookingPot {
  id: string;
  rangeIndex: number;
  recipeId: string;
  recipeName: string;
  recipeEmoji: string;
  startedByDiscordId: string;
  startedByUsername: string;
  startedAt: number;
  durationSeconds: number;
  readyAt: number;
  cookPriorityUntil: number; // 60s exclusive plating window for the cook
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
  tableNumber?: number;
  mood?: 'ravenous' | 'critical' | 'impatient' | 'curious';
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
  restroomDoorLockedUntil?: number;
  activeImpeachment?: {
    targetDiscordId: string;
    targetUsername: string;
    sponsors: string[];
    impeachVotes: string[];
    supportVotes: string[];
    startedAt: number;
    expiresAt: number;
    status: 'active' | 'passed' | 'failed';
  };
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
  roomHazards: {},
  restroomDoorLockedUntil: undefined,
  activeImpeachment: undefined
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
            roomHazards: parsed.roomHazards || {},
            restroomDoorLockedUntil: parsed.restroomDoorLockedUntil,
            activeImpeachment: parsed.activeImpeachment
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
            roomHazards: parsed.roomHazards || {},
            restroomDoorLockedUntil: parsed.restroomDoorLockedUntil,
            activeImpeachment: parsed.activeImpeachment
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
        served: false,
        tableNumber: 1,
        mood: 'ravenous'
      },
      {
        patronId: p2.id,
        recipeId: p2.cravingRecipeId,
        arrivedAt: Date.now(),
        expiresAt: Date.now() + 35 * 60 * 1000,
        served: false,
        tableNumber: 2,
        mood: 'critical'
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
      attendingDoctorId: 'nightingale',
      friendPoints: 500,
      facilityUpgrades: { extraStoves: 0, extraPrepCounters: 0, hydroponicLamps: 0 },
      dailyGiftsSent: {},
      fruitBasketsCount: 0,
      unreadNotifications: [],
      meritPoints: 0,
      swirliesReceived: 0,
      timesImpeached: 0
    };
    worldState.masters[discordId] = master;
    addCafeteriaActivity(`👤 Master **${username}** arrived at the **Dining Hall**.`, 'dining_hall');
    saveCafeteriaStateToDisk();
  } else {
    // Ensure default HP & new fields exist for loaded records
    if (typeof master.currentHp !== 'number') master.currentHp = 100;
    if (typeof master.maxHp !== 'number') master.maxHp = 100;
    if (typeof master.isHospitalized !== 'boolean') master.isHospitalized = false;
    if (!master.burnStatus) master.burnStatus = 'none';
    if (!master.activeRecoveryType) master.activeRecoveryType = 'none';
    if (!master.attendingDoctorId) master.attendingDoctorId = 'nightingale';
    if (typeof master.friendPoints !== 'number') master.friendPoints = 500;
    if (!master.facilityUpgrades) master.facilityUpgrades = { extraStoves: 0, extraPrepCounters: 0, hydroponicLamps: 0 };
    if (!master.dailyGiftsSent) master.dailyGiftsSent = {};
    if (!master.unreadNotifications) master.unreadNotifications = [];
    if (typeof master.meritPoints !== 'number') master.meritPoints = 0;
    if (typeof master.swirliesReceived !== 'number') master.swirliesReceived = 0;
    if (typeof master.timesImpeached !== 'number') master.timesImpeached = 0;

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

  // Lavatory lockdown check: cannot leave the Restrooms if locked inside
  if (master.isLockedInRestroom && master.lockedUntil && Date.now() < master.lockedUntil && master.currentRoomId === 'restrooms' && targetRoomId !== 'restrooms') {
    const remMin = Math.max(1, Math.ceil((master.lockedUntil - Date.now()) / 60000));
    return {
      success: false,
      message: `🔒 **LAVATORY LOCKDOWN (RESTRICTED):** The heavy bolt lock on the restroom door has been sealed by the Head Prefect! You cannot leave for another **${remMin} minute(s)**. Ask a fellow Master in the hallway or staff lounge to pick the lock!`
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

  // Award ingredient to Master (plus bonus yield if hydroponic UV lamps upgrade is owned in Greenhouse)
  worldState.roomForageCooldowns[room.id][ingId] = now;
  const bonusQty = (room.id === 'greenhouse' && master.facilityUpgrades?.hydroponicLamps) ? (master.facilityUpgrades.hydroponicLamps || 0) : 0;
  const totalYield = 1 + bonusQty;
  master.inventory[ingId] = (master.inventory[ingId] || 0) + totalYield;
  master.lastActivityAt = now;
  master.isAfk = false;
  master.statusText = `Harvested ${ingredient.name}`;

  const bonusNote = bonusQty > 0 ? ` (+${bonusQty} Bonus from UV Grow-Lamps!)` : '';
  addCafeteriaActivity(`🌾 **${master.username}** gathered **${totalYield}x ${ingredient.emoji} ${ingredient.name}** in ${room.shortName}${bonusNote}.`, room.id);
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `You gathered **${totalYield}x ${ingredient.emoji} ${ingredient.name}** (${ingredient.category.toUpperCase()})!${bonusNote}\n*${ingredient.description}*\n*(Your inventory: ${master.inventory[ingId]}x)*`,
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

export function getStoveCapacity(master?: StationedMaster): number {
  return 4 + ((master?.facilityUpgrades?.extraStoves || 0) * 2);
}

export function startStoveCooking(
  discordId: string, 
  recipeId: string, 
  targetRangeIndex?: number
): { success: boolean; message: string; pot?: StoveCookingPot } {
  const master = worldState.masters[discordId];
  if (!master) return { success: false, message: 'Master not found.' };

  if (master.currentRoomId !== 'kitchen_stove') {
    return { success: false, message: 'You must be at the **Kitchen — Stoves & Commercial Ovens** (`/move kitchen_stove`) to start cooking!' };
  }

  const recipe = RECIPES_CATALOG[recipeId];
  if (!recipe) return { success: false, message: 'Recipe not found.' };

  const maxStovePots = getStoveCapacity(master);
  const occupiedRanges = new Map<number, StoveCookingPot>();
  for (const pot of worldState.stovePots) {
    if (typeof pot.rangeIndex === 'number') {
      occupiedRanges.set(pot.rangeIndex, pot);
    }
  }

  let selectedRange: number;
  if (typeof targetRangeIndex === 'number' && targetRangeIndex > 0) {
    if (targetRangeIndex > maxStovePots) {
      return { success: false, message: `❌ Range #${targetRangeIndex} is not available! Your facility currently has **${maxStovePots} active stove ranges**.` };
    }
    if (occupiedRanges.has(targetRangeIndex)) {
      const existing = occupiedRanges.get(targetRangeIndex)!;
      return {
        success: false,
        message: `❌ **Range #${targetRangeIndex} is already occupied!**\nCurrently simmering: ${existing.recipeEmoji} **${existing.recipeName}** *(by @${existing.startedByUsername})*.\nChoose an idle range or stir the current pot!`
      };
    }
    selectedRange = targetRangeIndex;
  } else {
    // Automatically find lowest available range slot
    let freeSlot = -1;
    for (let r = 1; r <= maxStovePots; r++) {
      if (!occupiedRanges.has(r)) {
        freeSlot = r;
        break;
      }
    }
    if (freeSlot === -1) {
      return {
        success: false,
        message: `All ${maxStovePots} commercial stove ranges are currently occupied! Stir, plate, or dump one of the existing pots first, or visit the Chaldea Shop to upgrade stove capacity.`
      };
    }
    selectedRange = freeSlot;
  }

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

  const now = Date.now();
  const cookSec = recipe.cookTimeSeconds || 60;
  const readyTimestamp = now + cookSec * 1000;
  const pot: StoveCookingPot = {
    id: `pot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    rangeIndex: selectedRange,
    recipeId: recipe.id,
    recipeName: recipe.name,
    recipeEmoji: recipe.emoji,
    startedByDiscordId: master.discordId,
    startedByUsername: master.username,
    startedAt: now,
    durationSeconds: cookSec,
    readyAt: readyTimestamp,
    cookPriorityUntil: readyTimestamp + 60 * 1000, // 60s exclusive plating window for the cook
    burnsAt: readyTimestamp + 90 * 1000, // Burns 90 seconds after ready if neglected
    stirCount: 0,
    lastStirredAt: now,
    stirredBy: [master.username],
    status: 'simmering',
    qualityScore: 70
  };

  worldState.stovePots.push(pot);
  master.lastActivityAt = now;
  master.statusText = `Simmering ${recipe.name} on Range #${selectedRange}`;

  addCafeteriaActivity(`🔥 **${master.username}** ignited **Stove Range #${selectedRange}** and began simmering **${recipe.emoji} ${recipe.name}**! (Ready in ${Math.round(cookSec / 60)}m)`, 'kitchen_stove');
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `🔥 **Commercial Range #${selectedRange} Ignited!**\n**${recipe.emoji} ${recipe.name}** is now simmering on **Stove Station #${selectedRange}**!\n• **Cook Time:** ${cookSec} seconds\n• **Anti-Theft Protection:** You hold exclusive plating rights for 60s once cooked!\n• **Tip:** Visit the station to [Stir Range #${selectedRange}] to boost culinary quality!`,
    pot
  };
}

export function stirStovePot(discordId: string, target?: string | number): { success: boolean; message: string; pot?: StoveCookingPot } {
  const master = worldState.masters[discordId];
  if (!master) return { success: false, message: 'Master not found.' };

  if (master.currentRoomId !== 'kitchen_stove') {
    return { success: false, message: 'You must be at the **Kitchen — Stoves & Commercial Ovens** to stir the pots!' };
  }

  tickCafeteriaWorld();

  if (worldState.stovePots.length === 0) {
    return { success: false, message: 'There are currently no active pots on the stoves! Use `[Start Recipe]` to ignite a range.' };
  }

  let targetPot: StoveCookingPot | undefined;
  if (typeof target === 'number') {
    targetPot = worldState.stovePots.find(p => p.rangeIndex === target);
  } else if (typeof target === 'string') {
    const parsedRange = parseInt(target, 10);
    if (!isNaN(parsedRange)) {
      targetPot = worldState.stovePots.find(p => p.rangeIndex === parsedRange);
    } else {
      targetPot = worldState.stovePots.find(p => p.id === target);
    }
  }

  if (!targetPot) {
    targetPot = worldState.stovePots.find(p => p.status === 'simmering') || worldState.stovePots[0];
  }

  if (!targetPot) return { success: false, message: 'Cooking pot not found on the ranges.' };

  if (targetPot.status === 'burnt') {
    return { success: false, message: `⚠️ The **${targetPot.recipeName}** on Range #${targetPot.rangeIndex} burned! Use \`[Dump Burnt Sludge]\` to clear the range.` };
  }

  targetPot.stirCount += 1;
  targetPot.lastStirredAt = Date.now();
  targetPot.burnsAt += 30 * 1000; // Stirring extends burn window by 30 seconds
  if (targetPot.status === 'simmering') {
    targetPot.cookPriorityUntil += 15 * 1000;
  }
  targetPot.qualityScore = Math.min(100, targetPot.qualityScore + 6);
  if (!targetPot.stirredBy.includes(master.username)) {
    targetPot.stirredBy.push(master.username);
  }

  master.lastActivityAt = Date.now();
  master.statusText = `Stirring ${targetPot.recipeName} on Range #${targetPot.rangeIndex}`;

  const isStarter = targetPot.startedByDiscordId === master.discordId;
  const helperNote = isStarter ? '' : ` (Helping @${targetPot.startedByUsername}! Added as co-cook)`;

  addCafeteriaActivity(`🥄 **${master.username}** stirred **${targetPot.recipeEmoji} ${targetPot.recipeName}** on Range #${targetPot.rangeIndex} (Quality: ${targetPot.qualityScore}/100)${helperNote}!`, 'kitchen_stove');
  saveCafeteriaStateToDisk();

  const now = Date.now();
  const remainingSec = Math.max(0, Math.ceil((targetPot.readyAt - now) / 1000));
  const statusNote = remainingSec > 0 ? `Ready in **${remainingSec}s**` : `**READY TO PLATE!**`;

  return {
    success: true,
    message: `🥄 **Range #${targetPot.rangeIndex} Stirred with Precision!**\n**${targetPot.recipeEmoji} ${targetPot.recipeName}**\n• Status: ${statusNote}\n• Culinary Quality: **${targetPot.qualityScore}/100**\n• Stir Count: **${targetPot.stirCount}**\n• Master Cooks Involved: ${targetPot.stirredBy.join(', ')}`,
    pot: targetPot
  };
}

export function plateFinishedDish(discordId: string, target?: string | number): { success: boolean; message: string; recipe?: Recipe } {
  const master = worldState.masters[discordId];
  if (!master) return { success: false, message: 'Master not found.' };

  if (master.currentRoomId !== 'kitchen_stove' && master.currentRoomId !== 'dining_hall') {
    return { success: false, message: 'You must be at the **Stoves** or **Dining Hall** to plate finished dishes!' };
  }

  // Anti-loophole: Only 1 plated dish carried in apron at any time
  if (master.activePlatedDish) {
    return {
      success: false,
      message: `❌ **Hands are full!** You are already carrying **${master.activePlatedDish.recipeEmoji} ${master.activePlatedDish.recipeName}**!\nDeliver this meal to a visiting patron in the Dining Hall (\`/move dining_hall\`) before plating another dish.`
    };
  }

  tickCafeteriaWorld();

  let targetPot: StoveCookingPot | undefined;
  if (typeof target === 'number') {
    targetPot = worldState.stovePots.find(p => p.rangeIndex === target);
  } else if (typeof target === 'string') {
    const parsedRange = parseInt(target, 10);
    if (!isNaN(parsedRange)) {
      targetPot = worldState.stovePots.find(p => p.rangeIndex === parsedRange);
    } else {
      targetPot = worldState.stovePots.find(p => p.id === target);
    }
  }

  if (!targetPot) {
    targetPot = worldState.stovePots.find(p => p.status === 'ready');
  }

  if (!targetPot) {
    const simmeringPot = worldState.stovePots.find(p => p.status === 'simmering');
    if (simmeringPot) {
      const waitSec = Math.ceil((simmeringPot.readyAt - Date.now()) / 1000);
      return { success: false, message: `⏳ **${simmeringPot.recipeName}** on Range #${simmeringPot.rangeIndex} is still simmering! **${waitSec}s remaining** before it is ready to plate.` };
    }
    return { success: false, message: 'There are no dishes currently ready to plate on the stove ranges.' };
  }

  if (targetPot.status === 'burnt') {
    // Discard burnt pot
    const rangeNum = targetPot.rangeIndex;
    worldState.stovePots = worldState.stovePots.filter(p => p.id !== targetPot!.id);
    saveCafeteriaStateToDisk();
    return { success: false, message: `🗑️ The burnt **${targetPot.recipeName}** on Range #${rangeNum} was scraped into the waste bin and the range was cleaned.` };
  }

  if (targetPot.status !== 'ready') {
    const waitSec = Math.max(1, Math.ceil((targetPot.readyAt - Date.now()) / 1000));
    return { success: false, message: `⏳ **${targetPot.recipeName}** on Range #${targetPot.rangeIndex} is still simmering! **${waitSec}s remaining**.` };
  }

  // Anti-loophole: 60-Second Cook Priority Lock
  const now = Date.now();
  if (now < targetPot.cookPriorityUntil && targetPot.startedByDiscordId !== discordId) {
    const remPrioritySec = Math.max(1, Math.ceil((targetPot.cookPriorityUntil - now) / 1000));
    return {
      success: false,
      message: `⏳ **COOK PRIORITY LOCK (ANTI-THEFT):**\nMaster **@${targetPot.startedByUsername}** prepared this dish and holds exclusive plating rights for **${remPrioritySec} more second(s)**!\n\n*(Community plating unlocks automatically after 60 seconds to prevent kitchen line bottlenecks).*`
    };
  }

  const recipe = RECIPES_CATALOG[targetPot.recipeId];
  if (!recipe) return { success: false, message: 'Recipe reference missing.' };

  const freedRange = targetPot.rangeIndex;

  // Remove from stove pots
  worldState.stovePots = worldState.stovePots.filter(p => p.id !== targetPot!.id);

  // Set as master's active plated dish
  master.activePlatedDish = {
    recipeId: targetPot.recipeId,
    recipeName: targetPot.recipeName,
    recipeEmoji: targetPot.recipeEmoji,
    qualityScore: targetPot.qualityScore,
    platedAt: now,
    cooksInvolved: targetPot.stirredBy
  };
  master.totalDishesCooked += 1;
  master.lastActivityAt = now;
  master.statusText = `Carrying fresh ${targetPot.recipeName} to Dining Hall`;

  addCafeteriaActivity(`🍽️ **${master.username}** plated steaming **${targetPot.recipeEmoji} ${targetPot.recipeName}** from Range #${freedRange} (Quality: ${targetPot.qualityScore}/100)! Range #${freedRange} is now open!`, 'kitchen_stove');
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `🍽️ **Dish Plated from Range #${freedRange}!**\nYou are now carrying **${targetPot.recipeEmoji} ${targetPot.recipeName}**!\n• Range Station: **#${freedRange} (Now Free)**\n• Quality: **${targetPot.qualityScore}/100**\n• Master Cooks: ${targetPot.stirredBy.join(', ')}\n\n*Head to the **Dining Hall** (/move dining_hall) to present it to visiting Servant patrons!*`,
    recipe
  };
}

export function serveDishToPatron(
  discordId: string, 
  patronId: string,
  aiCritiqueText?: string,
  starRating?: number
): { success: boolean; message: string; rewards?: { sqShards: number; friendPoints: number; buff?: CafeteriaBuff }; isCraveMatch?: boolean } {
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

  // Clear plated dish & update master stats
  delete master.activePlatedDish;
  master.totalDishesServed += 1;
  master.lastActivityAt = Date.now();
  master.statusText = `Served ${dish.recipeName} to ${patron.name}`;

  // Remove the active order ticket for this patron
  worldState.activePatronOrders = worldState.activePatronOrders.filter(o => o.patronId !== patronId);

  if (!isCraveMatch) {
    // WRONG DISH CONSEQUENCE
    const stars = 1;
    master.meritPoints = (master.meritPoints || 0) + 2; // +2 CMP effort consolation
    const fallbackQuote = patron.fallbackWrongOrderQuotes
      ? patron.fallbackWrongOrderQuotes[Math.floor(Math.random() * patron.fallbackWrongOrderQuotes.length)]
      : `“What is this?! I distinctly ordered ${patron.cravingName}, not ${dish.recipeName}!”`;

    addCafeteriaActivity(`❌ **${master.username}** served wrong dish **${dish.recipeEmoji} ${dish.recipeName}** to **${patron.name}** (Craving: ${patron.cravingName})! Rating: ★☆☆☆☆ (1/5 Stars) (+2 CMP Consolation)`, 'dining_hall');
    saveCafeteriaStateToDisk();

    return {
      success: true,
      isCraveMatch: false,
      message: `💢 **WRONG DISH DELIVERED TO ${patron.name.toUpperCase()}!**\n★☆☆☆☆ (**1 / 5 Stars** — Rejected Order)\n\n${aiCritiqueText || `“${fallbackQuote}”`}\n\n⚠️ **Order Reprimand:**\n• **0 Saint Quartz**\n• **0 Friend Points**\n• **No Community Buff Activated**\n• **+2 Chaldea Merit Points (CMP)** *(Effort Consolation)*\n\n*${patron.name} left the table unsatisfied after taking a single bite!*`,
      rewards: {
        sqShards: 0,
        friendPoints: 0
      }
    };
  }

  // EXACT CRAVE MATCH
  const stars = starRating || (dish.qualityScore >= 85 ? 5 : 4);
  const sqReward = stars === 5 ? 3 : stars >= 4 ? 2 : 1;
  const fpReward = stars * 150;

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
    worldState.activeCommunityBuffs.unshift(awardedBuff);
    if (worldState.activeCommunityBuffs.length > 3) worldState.activeCommunityBuffs.pop();
  }

  // Award +15 Chaldea Merit Points (CMP)
  master.meritPoints = (master.meritPoints || 0) + 15;

  addCafeteriaActivity(`⭐ **${master.username}** served **${dish.recipeEmoji} ${dish.recipeName}** to **${patron.name}**! Rating: ${'★'.repeat(stars)} (${stars}/5 Stars) (+15 CMP)`, 'dining_hall');
  saveCafeteriaStateToDisk();

  return {
    success: true,
    isCraveMatch: true,
    message: `✨ **EXACT CRAVING DELIVERED TO ${patron.name.toUpperCase()}!**\n${'★'.repeat(stars)}${'☆'.repeat(5 - stars)} (**${stars} / 5 Stars**)\n\n${aiCritiqueText || `“${patron.fallbackPraiseQuotes[0]}”`}\n\n🎁 **Rewards Granted to Team:**\n• **+${sqReward} Saint Quartz Shard(s)**\n• **+${fpReward} Friend Points**\n• **+15 Chaldea Merit Points (CMP)**\n${awardedBuff ? `• **Community Buff Activated:** ${awardedBuff.title} (*${awardedBuff.description}*)` : ''}`,
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
      addCafeteriaActivity(`🔥 **FIRE ALERT!** The unattended smoke in **${rId}** has ignited into a **Hazard Flare**! Action needed!`, 'global');
    } else if (h.stage === 3 && now >= h.stage4At) {
      h.stage = 4; // Structural Breakdown (Room Locked)
      addCafeteriaActivity(`💥 **CRITICAL LOCKDOWN!** Severe structural damage in **${rId}**! All room activities suspended until repaired.`, 'global');
    }
  }

  // 1c. Health Exposure & Passive Recovery Tick Engine
  for (const m of Object.values(worldState.masters)) {
    if (typeof m.currentHp !== 'number') m.currentHp = 100;
    if (typeof m.maxHp !== 'number') m.maxHp = 100;

    const roomHazard = worldState.roomHazards[m.currentRoomId];
    const isFireResistant = Boolean(m.fireResistanceUntil && now < m.fireResistanceUntil);

    if (roomHazard && roomHazard.stage >= 2 && !m.isHospitalized) {
      // AFK / Active Hazard Pager Notification System
      if (!m.lastHazardNotifiedAt || now - m.lastHazardNotifiedAt > 60000) {
        m.lastHazardNotifiedAt = now;
        if (!m.unreadNotifications) m.unreadNotifications = [];
        const roomObj = CAFETERIA_ROOMS[m.currentRoomId];
        const roomName = roomObj ? roomObj.shortName : m.currentRoomId;
        const isEmergency = roomHazard.stage >= 3;

        m.unreadNotifications.unshift({
          id: `notif_hz_${now}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: now,
          title: isEmergency ? `🔥 EMERGENCY HAZARD: ${roomName}` : `💨 SMOKE WARNING: ${roomName}`,
          message: isEmergency
            ? `🔥 FIRE RAGING IN ${roomName}! You are taking active smoke/flame damage (${m.currentHp}/${m.maxHp} HP)! Return to Chaldea Hub immediately to extinguish or move!`
            : `💨 Thick smoke is filling ${roomName}! Extinguish the flame before it flares into an inferno!`,
          type: 'hazard'
        });
        if (m.unreadNotifications.length > 10) m.unreadNotifications.pop();

        addCafeteriaActivity(`🚨 **AFK HAZARD PAGER:** Paging @${m.username}! Stationed in **${roomName}** during an active **${roomHazard.hazardType.replace('_', ' ').toUpperCase()}** hazard! Alert dispatched!`, m.currentRoomId);
      }

      if (roomHazard.stage >= 3 && !isFireResistant) {
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

          if (!m.unreadNotifications) m.unreadNotifications = [];
          m.unreadNotifications.unshift({
            id: `notif_col_${now}`,
            timestamp: now,
            title: `🏥 MEDICAL WARD ADMISSION`,
            message: `🚨 You collapsed from severe smoke inhalation in ${roomHazard.roomId}! Stretchered to the Infirmary under Nurse Nightingale's care. Select bed rest to recover.`,
            type: 'hazard'
          });

          addCafeteriaActivity(`🏥 **MEDICAL WARD ADMISSION REPORT:** Master **${m.username}** collapsed from severe smoke inhalation in ${roomHazard.roomId}! Stretchered to the Infirmary under Nurse Nightingale's care.`, 'infirmary');
        }
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

export function dumpBurntPot(discordId: string, target?: string | number): { success: boolean; message: string } {
  const master = worldState.masters[discordId];
  if (!master) return { success: false, message: 'Master not found.' };

  let pot: StoveCookingPot | undefined;
  if (typeof target === 'number') {
    pot = worldState.stovePots.find(p => p.rangeIndex === target);
  } else if (typeof target === 'string') {
    const parsedRange = parseInt(target, 10);
    if (!isNaN(parsedRange)) {
      pot = worldState.stovePots.find(p => p.rangeIndex === parsedRange);
    } else {
      pot = worldState.stovePots.find(p => p.id === target);
    }
  }

  if (!pot) {
    pot = worldState.stovePots.find(p => p.status === 'burnt');
  }

  if (!pot) return { success: false, message: 'No burnt pots found on the stoves.' };

  const freedRange = pot.rangeIndex;
  worldState.stovePots = worldState.stovePots.filter(p => p.id !== pot!.id);

  const remainingBurnt = worldState.stovePots.some(p => p.status === 'burnt');
  if (!remainingBurnt && worldState.roomHazards['kitchen_stove']?.stage === 2) {
    worldState.roomHazards['kitchen_stove'].stage = 1;
  }

  addCafeteriaActivity(`🗑️ **${master.username}** scraped the burnt **${pot.recipeEmoji} ${pot.recipeName}** from Range #${freedRange} into the waste bin and scrubbed the burner clean.`, 'kitchen_stove');
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `🗑️ **Scraped & Discarded!**\nYou dumped the burnt **${pot.recipeEmoji} ${pot.recipeName}** from Range #${freedRange} into the disposal unit and wiped down the range.`
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
  master.meritPoints = (master.meritPoints || 0) + 25;

  if (roomId === 'kitchen_stove') {
    worldState.stovePots = worldState.stovePots.filter(p => p.status !== 'burnt');
  }

  const broadcastMsg = `🚨 **HEROIC FIRST RESPONDER!** Master **${master.username}** grabbed the fire extinguisher and extinguished the ${hazard.hazardType.replace('_', ' ')} in **${roomId}**! (+25 CMP)`;
  addCafeteriaActivity(broadcastMsg, 'global');
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `🧯 **HAZARD EXTINGUISHED!**\nYou swiftly deployed the CO2 extinguisher, dousing the flames and venting the smoke!\n\n🎁 **Heroic Honors Granted:**\n• **+200 Friend Points**\n• **+25 Chaldea Merit Points (CMP)**\n• **Karma Title:** *Chaldea First Responder*`
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
    master.meritPoints = (master.meritPoints || 0) + 25;
    if (roomId === 'kitchen_stove') {
      worldState.stovePots = worldState.stovePots.filter(p => p.status !== 'burnt');
    }

    addCafeteriaActivity(`🛠️ **ROOM RESTORED!** Master **${master.username}** finished repairing the flues in **${roomId}**! (+25 CMP)`, 'global');
    saveCafeteriaStateToDisk();

    return {
      success: true,
      message: `🛠️ **FINAL REPAIR COMPLETE!** (${current}/${req})\nYou replaced the scorched ventilation flues and recalibrated safety controls! **${roomId} is now fully operational!**\n\n🎁 **Rewards Granted:** +250 Friend Points & +25 CMP!`,
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

  addCafeteriaActivity(`💎 **INSTANT RESTORATION!** Master **${master.username}** spent **${costSq} Saint Quartz** to summon Caster water magic, instantly repairing **${roomId}**!`, 'global');
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

  const docId = master.attendingDoctorId || 'nightingale';
  const doctor = ATTENDING_DOCTORS[docId] || ATTENDING_DOCTORS.nightingale;
  // Nightingale Perk: +25% recovery speed reduces bed rest duration from 60 mins to 48 mins!
  const totalDurationMin = docId === 'nightingale' ? 48 : 60;
  const totalDurationMs = totalDurationMin * 60 * 1000;

  const now = Date.now();
  if (master.activeRecoveryType === 'bed_rest' && master.bedRestStartedAt) {
    const elapsedMs = now - master.bedRestStartedAt;
    const elapsedMin = Math.floor(elapsedMs / 60000);
    const remMin = Math.max(0, totalDurationMin - elapsedMin);
    return {
      success: true,
      message: `🛏️ **Bed Rest Already in Progress!**\nYou are tucked into a clean medical bed.\n• **Attending Doctor:** ${doctor.name} (${doctor.title})\n• **Time Elapsed:** **${elapsedMin} / ${totalDurationMin} minutes**\n• **Current HP:** **${master.currentHp}/${master.maxHp}**\n• **Time Remaining:** **${remMin} minute(s)** until full discharge.`,
      elapsedMin,
      remMin,
      currentHp: master.currentHp
    };
  }

  // Asclepius Perk: Instantly cleanses burns & singed status upon entering bed rest
  if (docId === 'asclepius') {
    master.burnStatus = 'none';
  }

  master.activeRecoveryType = 'bed_rest';
  master.bedRestStartedAt = now;
  master.bedRestInitialHp = master.currentHp;
  master.statusText = `🛏️ Resting under ${doctor.name}'s care`;
  master.isAfk = true;

  const perkNote = docId === 'nightingale' ? ' (⚡ Nightingale perk: Rest reduced to 48m!)' : docId === 'asclepius' ? ' (⚕️ Asclepius perk: Burns cleansed!)' : '';
  addCafeteriaActivity(`🛏️ Master **${master.username}** tucked into an Infirmary bed under ${doctor.name}'s care${perkNote}.`, 'infirmary');
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `🛏️ **BED REST COMMENCED!**\n${doctor.name} (${doctor.title}) has adjusted your IV fluids and tucked you into a medical bed.\n• **Recovery Duration:** ${totalDurationMin} minutes real time${perkNote}\n• **Starting HP:** ${master.currentHp}/${master.maxHp}\n• **Perk Active:** ${doctor.perkDescription}`,
    elapsedMin: 0,
    remMin: totalDurationMin,
    currentHp: master.currentHp
  };
}

export function setAttendingDoctor(discordId: string, doctorId: 'nightingale' | 'asclepius' | 'bb' | 'paracelsus'): { success: boolean; message: string } {
  const master = worldState.masters[discordId];
  if (!master) return { success: false, message: 'Master record not found.' };
  master.attendingDoctorId = doctorId;
  saveCafeteriaStateToDisk();
  const doc = ATTENDING_DOCTORS[doctorId];
  return { success: true, message: `Attending doctor updated to **${doc.name}**!\n*Perk:* ${doc.perkDescription}` };
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

  // Asclepius Perk: +25% HP heal bonus on salve
  const healAmount = master.attendingDoctorId === 'asclepius' ? 65 : 50;
  master.currentHp = Math.min(master.maxHp, master.currentHp + healAmount);
  master.burnStatus = 'none';
  if (master.currentHp >= master.maxHp) {
    master.isHospitalized = false;
    master.activeRecoveryType = 'none';
    master.bedRestStartedAt = undefined;
    master.statusText = 'Fully recovered with Burn Salve';
  }

  addCafeteriaActivity(`🧪 **${master.username}** drank a freshly brewed herbal burn salve in the Infirmary (+${healAmount} HP)!`, 'infirmary');
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `🧪 **HERBAL BURN SALVE CONSUMED!**\nYou drank a soothing herbal decoction brewed by Asclepius.\n• Restored **+${healAmount} HP** (Current HP: ${master.currentHp}/${master.maxHp})\n• Cleared Burn & Singed status!`
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

export function craftFruitBasket(discordId: string): { success: boolean; message: string } {
  const master = worldState.masters[discordId];
  if (!master) return { success: false, message: 'Master not found.' };

  const inv = master.inventory || {};
  const hasApple = (inv['holy_eden_fruit'] || 0) >= 1;
  const hasHoney = (inv['sweet_honey'] || 0) >= 1;

  if (!hasApple || !hasHoney) {
    return {
      success: false,
      message: `❌ Cannot craft Fruit Basket! Missing required ingredients:\n• Golden Eden Apple 🍎 (have ${inv['holy_eden_fruit'] || 0}/1)\n• Wild Forest Honey 🍯 (have ${inv['sweet_honey'] || 0}/1)\n\n*Harvest Golden Apples in the Hydroponic Greenhouse and Honey in the Staff Lounge!*`
    };
  }

  // Deduct ingredients
  inv['holy_eden_fruit'] -= 1;
  if (inv['holy_eden_fruit'] <= 0) delete inv['holy_eden_fruit'];

  inv['sweet_honey'] -= 1;
  if (inv['sweet_honey'] <= 0) delete inv['sweet_honey'];

  inv['fruit_basket'] = (inv['fruit_basket'] || 0) + 1;
  master.fruitBasketsCount = (master.fruitBasketsCount || 0) + 1;
  master.lastActivityAt = Date.now();

  addCafeteriaActivity(`🧺 **${master.username}** crafted a fresh **Hydroponic Fruit Basket** 🍎🍯 in the Greenhouse!`, master.currentRoomId);
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `🧺 **FRUIT BASKET CRAFTED!**\nYou combined 1x Golden Eden Apple and 1x Wild Forest Honey into a decorated wicker **Fresh Fruit Basket**!\n• *(Your Fruit Baskets in Apron: ${inv['fruit_basket']}x)*\n\n*Visit an injured friend in the Infirmary to gift this basket!*`
  };
}

export function bringFruitBasketToFriend(rescuerId: string, targetId: string): { success: boolean; message: string } {
  const rescuer = worldState.masters[rescuerId];
  const target = worldState.masters[targetId];

  if (!rescuer || !target) return { success: false, message: 'Master records not found.' };

  const today = new Date().toISOString().slice(0, 10);
  if (!rescuer.dailyGiftsSent) rescuer.dailyGiftsSent = {};
  const sentInfo = rescuer.dailyGiftsSent[targetId] || { count: 0, lastGiftDate: '' };
  const giftsToday = sentInfo.lastGiftDate === today ? sentInfo.count : 0;

  if (giftsToday >= 2) {
    return {
      success: false,
      message: `❌ **DAILY GIFT LIMIT REACHED:** You have already brought 2 Fruit Baskets to **${target.username}** today! (Maximum 2 daily baskets per friend).`
    };
  }

  const inv = rescuer.inventory || {};
  let deductedBasket = false;

  if ((inv['fruit_basket'] || 0) >= 1) {
    inv['fruit_basket'] -= 1;
    if (inv['fruit_basket'] <= 0) delete inv['fruit_basket'];
    deductedBasket = true;
  } else if ((inv['holy_eden_fruit'] || 0) >= 1 && (inv['sweet_honey'] || 0) >= 1) {
    inv['holy_eden_fruit'] -= 1;
    if (inv['holy_eden_fruit'] <= 0) delete inv['holy_eden_fruit'];
    inv['sweet_honey'] -= 1;
    if (inv['sweet_honey'] <= 0) delete inv['sweet_honey'];
    deductedBasket = true;
  }

  if (!deductedBasket) {
    return {
      success: false,
      message: `❌ You do not have a **Fruit Basket** 🧺 in your apron! Craft one in the Greenhouse using **1x Golden Eden Apple** 🍎 and **1x Wild Honey** 🍯.`
    };
  }

  // Calculate 25% bed rest timer reduction
  const now = Date.now();
  let timeReducedText = '';
  if (target.activeRecoveryType === 'bed_rest' && target.bedRestStartedAt) {
    const docId = target.attendingDoctorId || 'nightingale';
    const totalDurationMs = (docId === 'nightingale' ? 48 : 60) * 60 * 1000;
    const elapsedMs = Math.max(0, now - target.bedRestStartedAt);
    const remainingMs = Math.max(0, totalDurationMs - elapsedMs);
    const reductionMs = Math.floor(remainingMs * 0.25); // 25% reduction of remaining time
    target.bedRestStartedAt -= reductionMs; // Advance rest start time backward
    const reducedMin = Math.round(reductionMs / 60000);
    timeReducedText = ` (Remaining bed rest timer reduced by **25% / ${reducedMin} mins**!)`;
  }

  // Restore HP
  const hpBonus = target.attendingDoctorId === 'asclepius' ? 45 : 35;
  target.currentHp = Math.min(target.maxHp, target.currentHp + hpBonus);
  if (target.currentHp >= target.maxHp) {
    target.isHospitalized = false;
    target.burnStatus = 'none';
    target.activeRecoveryType = 'none';
    target.bedRestStartedAt = undefined;
  }

  // Calculate Friend Points (Paracelsus Perk: +50% FP multiplier = 1.5x)
  const isParacelsusActive = rescuer.attendingDoctorId === 'paracelsus' || target.attendingDoctorId === 'paracelsus';
  const fpMultiplier = isParacelsusActive ? 1.5 : 1.0;
  const rescuerFp = Math.floor(100 * fpMultiplier);
  const targetFp = Math.floor(50 * fpMultiplier);

  rescuer.friendPoints = (rescuer.friendPoints || 0) + rescuerFp;
  target.friendPoints = (target.friendPoints || 0) + targetFp;
  rescuer.meritPoints = (rescuer.meritPoints || 0) + 10;

  // Track daily gift limit
  rescuer.dailyGiftsSent[targetId] = {
    count: giftsToday + 1,
    lastGiftDate: today
  };

  const paracelsusNote = isParacelsusActive ? ' 🧪 *(Paracelsus Perk: 1.5x FP Multiplier Active!)*' : '';
  addCafeteriaActivity(`🍎 **@${rescuer.username}** brought a fresh fruit basket to **@${target.username}**'s bedside in the Infirmary! Recovery time reduced by 25%! (+10 CMP)`, 'infirmary');
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `🍎 **FRUIT BASKET DELIVERED TO ${target.username.toUpperCase()}!**\nYou presented a fresh Hydroponic Fruit Basket to **${target.username}** at their bedside!${timeReducedText}\n\n🎁 **Friend Points & Merit Awarded:**\n• You: **+${rescuerFp} FP** & **+10 CMP** (Total: ${rescuer.friendPoints} FP, ${rescuer.meritPoints} CMP)\n• ${target.username}: **+${targetFp} FP**\n• Daily Limit: **${giftsToday + 1} / 2 baskets** delivered to ${target.username} today.${paracelsusNote}`
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

  const isParacelsusActive = rescuer.attendingDoctorId === 'paracelsus';
  const fpEarned = isParacelsusActive ? 150 : 100;
  rescuer.friendPoints = (rescuer.friendPoints || 0) + fpEarned;

  addCafeteriaActivity(`🚑 **HEROIC RESCUE!** Master **${rescuer.username}** dashed through the flames and dragged unconscious **${target.username}** out of ${currentRoom} to the Infirmary!`, currentRoom);
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `🚑 **HEROIC RESCUE EXECUTED!**\nYou fearlessly threw open the burning door, lifted **${target.username}** over your shoulder, and carried them out of the inferno to the Infirmary!\n\n🎁 **Heroic Rewards Granted:**\n• **+${fpEarned} Friend Points** (Total: ${rescuer.friendPoints} FP)\n• **Karma:** *Lawful Good Hero*`
  };
}

export function purchaseChaldeaShopUpgrade(discordId: string, itemId: string): { success: boolean; message: string } {
  const master = worldState.masters[discordId];
  if (!master) return { success: false, message: 'Master record not found.' };

  const shopItem = CHALDEA_SHOP_CATALOG[itemId];
  if (!shopItem) return { success: false, message: 'Shop upgrade item not found.' };

  if (!master.facilityUpgrades) {
    master.facilityUpgrades = { extraStoves: 0, extraPrepCounters: 0, hydroponicLamps: 0 };
  }

  const currentLvl = master.facilityUpgrades[shopItem.upgradeType] || 0;
  if (currentLvl >= shopItem.maxLevel) {
    return { success: false, message: `❌ **MAX LEVEL REACHED:** Your **${shopItem.name}** is already at maximum level (${shopItem.maxLevel}/${shopItem.maxLevel})!` };
  }

  const costFP = shopItem.baseCostFP * (currentLvl + 1);
  const currentFP = master.friendPoints || 0;

  if (currentFP < costFP) {
    return {
      success: false,
      message: `❌ **INSUFFICIENT FRIEND POINTS:** **${shopItem.name}** Level ${currentLvl + 1} costs **${costFP} FP**! You currently have **${currentFP} FP**.\n*Earn Friend Points by gifting Fruit Baskets, serving patrons, or rescuing friends!*`
    };
  }

  master.friendPoints = currentFP - costFP;
  master.facilityUpgrades[shopItem.upgradeType] = currentLvl + 1;

  addCafeteriaActivity(`🛒 **UPGRADE PURCHASED!** Master **${master.username}** purchased **${shopItem.name} Lvl ${currentLvl + 1}** for ${costFP} FP!`, master.currentRoomId);
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `🛒 **CHALDEA SHOP UPGRADE SUCCESSFUL!**\nYou purchased **${shopItem.name} (Level ${currentLvl + 1}/${shopItem.maxLevel})**!\n• **Bonus Applied:** ${shopItem.perLevelBonus}\n• **Cost:** -${costFP} FP (Remaining: **${master.friendPoints} FP**)`
  };
}

export function clearMasterNotifications(discordId: string): { success: boolean; message: string } {
  const master = worldState.masters[discordId];
  if (!master) return { success: false, message: 'Master record not found.' };
  master.unreadNotifications = [];
  saveCafeteriaStateToDisk();
  return { success: true, message: '🔔 Unread notifications cleared.' };
}

export function getHeadPrefect(): StationedMaster | null {
  const now = Date.now();
  const eligible = Object.values(worldState.masters).filter(m => {
    return !m.disciplinaryBlacklistUntil || now >= m.disciplinaryBlacklistUntil;
  });
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => (b.meritPoints || 0) - (a.meritPoints || 0));
  return eligible[0];
}

export function getMasterCMPRank(discordId: string): { rank: number; title: string; emoji: string; cmp: number; isHeadPrefect: boolean } {
  const master = worldState.masters[discordId];
  const cmp = master ? (master.meritPoints || 0) : 0;
  const prefect = getHeadPrefect();
  const isHeadPrefect = Boolean(prefect && prefect.discordId === discordId);

  if (isHeadPrefect) {
    const tier = CHALDEA_RANK_TIERS[0]; // Rank 1: Head Prefect
    return { rank: 1, title: tier.title, emoji: tier.emoji, cmp, isHeadPrefect: true };
  }

  if (cmp >= 300) {
    const tier = CHALDEA_RANK_TIERS[1]; // Rank 2
    return { rank: 2, title: tier.title, emoji: tier.emoji, cmp, isHeadPrefect: false };
  } else if (cmp >= 150) {
    const tier = CHALDEA_RANK_TIERS[2]; // Rank 3
    return { rank: 3, title: tier.title, emoji: tier.emoji, cmp, isHeadPrefect: false };
  } else if (cmp >= 50) {
    const tier = CHALDEA_RANK_TIERS[3]; // Rank 4
    return { rank: 4, title: tier.title, emoji: tier.emoji, cmp, isHeadPrefect: false };
  } else {
    const tier = CHALDEA_RANK_TIERS[4]; // Rank 5
    return { rank: 5, title: tier.title, emoji: tier.emoji, cmp, isHeadPrefect: false };
  }
}

export function getChaldeaRankLeaderboard(): Array<{ discordId: string; username: string; cmp: number; rank: number; title: string; emoji: string; isPrefect: boolean }> {
  const masters = Object.values(worldState.masters);
  const prefect = getHeadPrefect();
  const sorted = [...masters].sort((a, b) => (b.meritPoints || 0) - (a.meritPoints || 0));

  return sorted.map((m) => {
    const isPrefect = Boolean(prefect && prefect.discordId === m.discordId);
    const info = getMasterCMPRank(m.discordId);
    return {
      discordId: m.discordId,
      username: m.username,
      cmp: m.meritPoints || 0,
      rank: info.rank,
      title: info.title,
      emoji: info.emoji,
      isPrefect
    };
  });
}

export function executeGrabAndDrag(prefectId: string, targetId: string, destRoomId: string): { success: boolean; message: string } {
  const prefect = worldState.masters[prefectId];
  const target = worldState.masters[targetId];

  if (!prefect || !target) return { success: false, message: 'Master record not found.' };

  const currentPrefect = getHeadPrefect();
  if (!currentPrefect || currentPrefect.discordId !== prefectId) {
    return { success: false, message: '❌ **UNAUTHORIZED:** Only the **#1 Ranked Chaldea Head Prefect** holds disciplinary authority to grab and drag other Masters!' };
  }

  if (targetId === prefectId) {
    return { success: false, message: 'You cannot drag yourself!' };
  }

  const destRoom = CAFETERIA_ROOMS[destRoomId];
  if (!destRoom) return { success: false, message: 'Destination room does not exist.' };

  const fromRoom = CAFETERIA_ROOMS[target.currentRoomId] || CAFETERIA_ROOMS.dining_hall;
  target.currentRoomId = destRoomId;
  target.lastMovedAt = Date.now();
  target.isAfk = false;
  target.statusText = `🚨 Dragged to ${destRoom.shortName} by Head Prefect`;

  // Move prefect alongside victim so they stay together
  prefect.currentRoomId = destRoomId;
  prefect.lastMovedAt = Date.now();
  prefect.statusText = `👑 Disciplining @${target.username}`;

  addCafeteriaActivity(`🚨 👑 **Head Prefect @${prefect.username}** seized **@${target.username}** by the collar in *${fromRoom.shortName}* and dragged them kicking and screaming to **${destRoom.name}**!`, 'global');
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `🤼 **PREFECT DISCIPLINE EXECUTED:**\nYou seized **@${target.username}** by the collar and dragged them straight to **${destRoom.name}**!\n\n*Broadcasted to campus activity logs.*`
  };
}

export function executeToiletDunk(prefectId: string, targetId: string): { success: boolean; message: string; targetFainted: boolean } {
  const prefect = worldState.masters[prefectId];
  const target = worldState.masters[targetId];

  if (!prefect || !target) return { success: false, message: 'Master record not found.', targetFainted: false };

  const currentPrefect = getHeadPrefect();
  if (!currentPrefect || currentPrefect.discordId !== prefectId) {
    return { success: false, message: '❌ **UNAUTHORIZED:** Only the **#1 Ranked Chaldea Head Prefect** holds swirlie disciplinary authority!', targetFainted: false };
  }

  if (prefect.currentRoomId !== 'restrooms' || target.currentRoomId !== 'restrooms') {
    return {
      success: false,
      message: `❌ **LOCATION REQUIREMENT:** Both you and **@${target.username}** must be inside the **Chaldea Restrooms** (\`/move restrooms\`) to perform a porcelain swirlie punishment! (Use \`[🤼 Grab & Drag]\` to drag them here first!)`,
      targetFainted: false
    };
  }

  const dmg = Math.floor(Math.random() * 11) + 20; // 20–30 direct HP damage
  target.currentHp = Math.max(0, target.currentHp - dmg);
  target.swirliesReceived = (target.swirliesReceived || 0) + 1;

  let fainted = false;
  if (target.currentHp <= 0) {
    fainted = true;
    target.currentRoomId = 'infirmary';
    target.isHospitalized = true;
    target.hospitalizedAt = Date.now();
    target.burnStatus = 'fainted';
    target.activeRecoveryType = 'none';
    target.statusText = '💀 Concussed from Extreme Swirlie Turbulence';

    addCafeteriaActivity(`💀 **@${target.username}** lost consciousness from extreme porcelain swirlie turbulence administered by **Head Prefect @${prefect.username}**! Medical bots have escorted them to the Infirmary!`, 'global');
    saveCafeteriaStateToDisk();

    return {
      success: true,
      message: `🚽 **THE PORCELAIN PUNISHMENT (KO!):**\nYou forcefully dunked **@${target.username}**'s head into the swirling porcelain waters (-${dmg} HP)!\n\n💀 **TARGET COLLAPSED!** The swirlie turbulence was so severe that **@${target.username}** lost consciousness and was stretcher-escorted to the Infirmary!`,
      targetFainted: true
    };
  }

  target.statusText = 'Drenched and humiliated from a toilet dunk';
  addCafeteriaActivity(`🚽 👑 **Head Prefect @${prefect.username}** dunked **@${target.username}**'s head into the toilet for disciplinary correction (-${dmg} HP)!`, 'global');
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `🚽 **THE PORCELAIN PUNISHMENT DELIVERED!**\nYou pushed **@${target.username}** into the stall and flushed the swirlie mechanism!\n• Damage Dealt: **-${dmg} HP** (Target HP: **${target.currentHp}/${target.maxHp}**)\n• Target is soaking wet and thoroughly disciplined!`,
    targetFainted: false
  };
}

export function executeLavatoryLockdown(prefectId: string, targetId: string, durationMinutes = 5): { success: boolean; message: string } {
  const prefect = worldState.masters[prefectId];
  const target = worldState.masters[targetId];

  if (!prefect || !target) return { success: false, message: 'Master record not found.' };

  const currentPrefect = getHeadPrefect();
  if (!currentPrefect || currentPrefect.discordId !== prefectId) {
    return { success: false, message: '❌ **UNAUTHORIZED:** Only the **#1 Ranked Chaldea Head Prefect** can declare a Lavatory Lockdown!' };
  }

  if (target.currentRoomId !== 'restrooms') {
    return {
      success: false,
      message: `❌ **@${target.username}** is not in the Chaldea Restrooms! Use \`[🤼 Grab & Drag]\` to bring them here first.`
    };
  }

  const durationMs = durationMinutes * 60 * 1000;
  const lockExpires = Date.now() + durationMs;

  target.isLockedInRestroom = true;
  target.lockedUntil = lockExpires;
  worldState.restroomDoorLockedUntil = Math.max(worldState.restroomDoorLockedUntil || 0, lockExpires);

  addCafeteriaActivity(`🔒 👑 **Head Prefect @${prefect.username}** bolted the exterior padlock on the Restroom doors, trapping **@${target.username}** inside for ${durationMinutes} minutes!`, 'global');
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `🔒 **LAVATORY LOCKDOWN ACTIVE!**\nYou slammed the heavy reinforced door shut and turned the deadbolt lock!\n• Target: **@${target.username}**\n• Duration: **${durationMinutes} minutes**\n• Victim cannot leave unless a sympathetic friend picks the lock from the corridor!`
  };
}

export function breakRestroomLock(rescuerId: string): { success: boolean; message: string } {
  const rescuer = worldState.masters[rescuerId];
  if (!rescuer) return { success: false, message: 'Master record not found.' };

  const now = Date.now();
  const isLocked = Boolean(worldState.restroomDoorLockedUntil && now < worldState.restroomDoorLockedUntil);

  if (!isLocked) {
    return { success: false, message: 'The Chaldea Restroom door is not currently locked!' };
  }

  // Free all locked masters
  let freedCount = 0;
  for (const m of Object.values(worldState.masters)) {
    if (m.currentRoomId === 'restrooms' && m.isLockedInRestroom) {
      m.isLockedInRestroom = false;
      m.lockedUntil = undefined;
      freedCount += 1;
    }
  }

  worldState.restroomDoorLockedUntil = undefined;
  rescuer.meritPoints = (rescuer.meritPoints || 0) + 15;
  rescuer.friendPoints = (rescuer.friendPoints || 0) + 100;

  addCafeteriaActivity(`🔓 **LOCK PICKED / BUSTED!** Master **@${rescuer.username}** forced open the restroom padlock with a crowbar, liberating ${freedCount} trapped Master(s)! (+15 CMP, +100 FP)`, 'global');
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `🔓 **RESTROOM LOCK SUCCESSFULLY BUSTED!**\nYou jammed a crowbar into the deadbolt and snapped the prefect's padlock open!\n• Freed: **${freedCount} trapped Master(s)**\n• Rewards: **+15 CMP** & **+100 Friend Points**!`
  };
}

export function washFaceInRestroom(discordId: string): { success: boolean; message: string } {
  const master = worldState.masters[discordId];
  if (!master) return { success: false, message: 'Master record not found.' };

  if (master.currentRoomId !== 'restrooms') {
    return { success: false, message: 'You must be in the **Chaldea Restrooms** (`/move restrooms`) to wash your face!' };
  }

  master.burnStatus = 'none';
  master.currentHp = Math.min(master.maxHp, master.currentHp + 10);
  master.meritPoints = (master.meritPoints || 0) + 5;
  master.lastActivityAt = Date.now();
  master.statusText = 'Freshened up at the porcelain sinks';

  addCafeteriaActivity(`🧼 **${master.username}** washed soot and grime off their face at the restroom porcelain basin (+10 HP, +5 CMP)!`, 'restrooms');
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `🧼 **FACE WASHED & REFRESHED!**\nYou splashed chilled aromatic water onto your cheeks!\n• Restored **+10 HP** (Current HP: ${master.currentHp}/${master.maxHp})\n• Cleared soot and burn stains!\n• **+5 Chaldea Merit Points (CMP)** earned.`
  };
}

export function callImpeachmentVote(sponsorId: string): { success: boolean; message: string; activeVote?: any } {
  const sponsor = worldState.masters[sponsorId];
  if (!sponsor) return { success: false, message: 'Master record not found.' };

  const prefect = getHeadPrefect();
  if (!prefect) {
    return { success: false, message: 'There is currently no reigning Head Prefect to impeach! Earn Merit Points to claim the seat.' };
  }

  if (sponsorId === prefect.discordId) {
    return { success: false, message: 'You cannot call a vote of no confidence against yourself!' };
  }

  const now = Date.now();
  // Check if existing active vote
  if (worldState.activeImpeachment && now < worldState.activeImpeachment.expiresAt && worldState.activeImpeachment.status === 'active') {
    if (!worldState.activeImpeachment.sponsors.includes(sponsorId)) {
      worldState.activeImpeachment.sponsors.push(sponsorId);
    }
    if (!worldState.activeImpeachment.impeachVotes.includes(sponsorId)) {
      worldState.activeImpeachment.impeachVotes.push(sponsorId);
    }

    const currentSponsors = worldState.activeImpeachment.sponsors.length;
    addCafeteriaActivity(`🏛️ **@${sponsor.username}** joined as a sponsor for the Vote of No Confidence against Head Prefect @${prefect.username}! (${currentSponsors}/3 sponsors needed to formalize)`, 'global');
    saveCafeteriaStateToDisk();

    return {
      success: true,
      message: `🏛️ **SPONSOR RECORDED!** (${currentSponsors}/3 sponsors)\nYou co-sponsored the Vote of No Confidence against **@${prefect.username}**! Current Impeach Votes: **${worldState.activeImpeachment.impeachVotes.length}/5** needed.`,
      activeVote: worldState.activeImpeachment
    };
  }

  // Start new petition
  worldState.activeImpeachment = {
    targetDiscordId: prefect.discordId,
    targetUsername: prefect.username,
    sponsors: [sponsorId],
    impeachVotes: [sponsorId],
    supportVotes: [],
    startedAt: now,
    expiresAt: now + 15 * 60 * 1000, // 15 minute voting window
    status: 'active'
  };

  addCafeteriaActivity(`🏛️ **CHALDEA HIGH TRIBUNAL PETITION:** Master **@${sponsor.username}** filed a Vote of No Confidence against Head Prefect **@${prefect.username}**! (1/3 sponsors)`, 'global');
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `🏛️ **VOTE OF NO CONFIDENCE PETITION FILED!**\nYou initiated an impeachment proceeding against reigning Head Prefect **@${prefect.username}**!\n• Sponsors: **1 / 3 Masters needed** to formalize tribunal\n• Impeach Threshold: **5 Votes to Dethrone**\n• Voting Window: **15 minutes**`,
    activeVote: worldState.activeImpeachment
  };
}

export function castImpeachmentVote(voterId: string, voteType: 'impeach' | 'support'): { success: boolean; message: string; passed?: boolean } {
  const voter = worldState.masters[voterId];
  if (!voter) return { success: false, message: 'Master record not found.' };

  const now = Date.now();
  const vote = worldState.activeImpeachment;

  if (!vote || now >= vote.expiresAt || vote.status !== 'active') {
    return { success: false, message: 'There is currently no active Vote of No Confidence election. Use `/impeach` to petition one!' };
  }

  // Remove existing vote if any
  vote.impeachVotes = vote.impeachVotes.filter(id => id !== voterId);
  vote.supportVotes = vote.supportVotes.filter(id => id !== voterId);

  if (voteType === 'impeach') {
    vote.impeachVotes.push(voterId);
  } else {
    vote.supportVotes.push(voterId);
  }

  // Check if threshold reached: 5 impeach votes to dethrone
  if (vote.impeachVotes.length >= 5) {
    vote.status = 'passed';
    const prefect = worldState.masters[vote.targetDiscordId];
    if (prefect) {
      // Dock 20% CMP
      const lostCMP = Math.floor((prefect.meritPoints || 0) * 0.2);
      prefect.meritPoints = Math.max(0, (prefect.meritPoints || 0) - lostCMP);
      // 24 hour blacklist from reclaiming Rank 1
      prefect.disciplinaryBlacklistUntil = now + 24 * 60 * 60 * 1000;
      prefect.timesImpeached = (prefect.timesImpeached || 0) + 1;

      // Automated security bots escort ex-prefect to restroom stalls!
      prefect.currentRoomId = 'restrooms';
      prefect.isLockedInRestroom = true;
      prefect.lockedUntil = now + 5 * 60 * 1000;
      worldState.restroomDoorLockedUntil = Math.max(worldState.restroomDoorLockedUntil || 0, prefect.lockedUntil);
      prefect.statusText = 'Dethroned & escorted to stalls by Security Bots';
    }

    const newPrefect = getHeadPrefect();
    const newPrefectName = newPrefect ? `@${newPrefect.username}` : 'the next eligible Master';

    addCafeteriaActivity(`⚖️ **IMPEACHMENT PASSED!** Head Prefect **@${vote.targetUsername}** was DETHRONED by vote of the student body (5/5 votes)! Docked 20% CMP and locked in the restroom stalls! ${newPrefectName} is promoted to Head Prefect!`, 'global');
    saveCafeteriaStateToDisk();

    return {
      success: true,
      message: `⚖️ **IMPEACHMENT RESOLUTION PASSED! (5/5 VOTES)**\nThe student body has officially stripped **@${vote.targetUsername}** of their Head Prefect authority!\n• **Penalties:** -20% CMP & 24-hour lockout from Rank 1\n• **Security Bot Action:** Automated bots have locked the dethroned prefect in the Restroom stalls!\n• **Succession:** ${newPrefectName} is now crowned **👑 Chaldea Head Prefect**!`,
      passed: true
    };
  }

  addCafeteriaActivity(`🗳️ **@${voter.username}** voted **${voteType.toUpperCase()}** in the High Tribunal election against @${vote.targetUsername} (${vote.impeachVotes.length}/5 impeach votes).`, 'global');
  saveCafeteriaStateToDisk();

  return {
    success: true,
    message: `🗳️ **VOTE RECORDED (${voteType.toUpperCase()})!**\n• Current Impeach Votes: **${vote.impeachVotes.length} / 5 needed to dethrone**\n• Current Support Votes: **${vote.supportVotes.length}**\n• Time Remaining: **${Math.ceil((vote.expiresAt - now) / 60000)} minute(s)**`
  };
}
