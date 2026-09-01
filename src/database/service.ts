import { MasterProfile, MasterServantInstance, CraftEssence, ServantTemplate } from '../types';
import { SERVANT_DATABASE } from '../data/servants';
import { CRAFT_ESSENCE_DATABASE } from '../data/craftEssences';

// ==========================================
// 1. IN-MEMORY MASTER & CUSTOM SERVANT STORE
// ==========================================
// Maps Discord User IDs (e.g. "123456789012345678") to their respective MasterProfile records.
const masterStore: Map<string, MasterProfile> = new Map();

// Store for custom Heroic Spirits registered by Server Admins
let customServants: ServantTemplate[] = [];

/**
 * Returns the entire Throne of Heroes database (Built-in + Admin Custom Servants).
 */
export function getAllThroneServants(): ServantTemplate[] {
  return [...SERVANT_DATABASE, ...customServants];
}

/**
 * Adds a new custom Heroic Spirit to the Throne of Heroes database.
 */
export function addCustomServant(servant: ServantTemplate): ServantTemplate {
  // Prevent duplicate IDs
  const existingIdx = customServants.findIndex(s => s.id === servant.id);
  if (existingIdx >= 0) {
    customServants[existingIdx] = servant;
  } else {
    customServants.push(servant);
  }
  return servant;
}

/**
 * Updates an existing Servant template (both Canon and Custom servants).
 */
export function updateServantTemplate(
  queryOrId: string,
  updates: {
    name?: string;
    title?: string;
    servantClass?: any;
    avatarUrl?: string;
    cardArtUrl?: string;
    baseHp?: number;
    baseAtk?: number;
    noblePhantasmName?: string;
    noblePhantasmChant?: string;
    noblePhantasmCardType?: 'Buster' | 'Arts' | 'Quick';
    summonQuote?: string;
    lore?: string;
  }
): { success: boolean; servant?: ServantTemplate; error?: string } {
  const allServants = getAllThroneServants();
  const lowerQuery = queryOrId.toLowerCase().trim();

  // Find exact ID match or name match
  let target = allServants.find(
    s => s.id.toLowerCase() === lowerQuery || s.name.toLowerCase() === lowerQuery
  );

  if (!target) {
    target = allServants.find(
      s => s.id.toLowerCase().includes(lowerQuery) || s.name.toLowerCase().includes(lowerQuery)
    );
  }

  if (!target) {
    return { success: false, error: `Servant matching "${queryOrId}" not found in Throne of Heroes.` };
  }

  // Apply updates
  if (updates.name) target.name = updates.name.trim();
  if (updates.title) target.title = updates.title.trim();
  if (updates.servantClass) target.servantClass = updates.servantClass;
  if (updates.avatarUrl) {
    const newImg = updates.avatarUrl.trim();
    target.avatarUrl = newImg;
    if (!updates.cardArtUrl || updates.cardArtUrl === updates.avatarUrl) {
      target.cardArtUrl = newImg;
    }
  }
  if (updates.cardArtUrl) target.cardArtUrl = updates.cardArtUrl.trim();
  if (updates.baseHp) target.baseHp = Number(updates.baseHp);
  if (updates.baseAtk) target.baseAtk = Number(updates.baseAtk);
  if (updates.summonQuote) target.summonQuote = updates.summonQuote.trim();
  if (updates.lore) target.lore = updates.lore.trim();

  if (updates.noblePhantasmName) {
    target.noblePhantasm.name = updates.noblePhantasmName.trim();
  }
  if (updates.noblePhantasmChant) {
    target.noblePhantasm.chant = updates.noblePhantasmChant.trim();
  }
  if (updates.noblePhantasmCardType) {
    target.noblePhantasm.cardType = updates.noblePhantasmCardType;
  }

  // Persist in customServants array if custom, or update in SERVANT_DATABASE
  const customIdx = customServants.findIndex(s => s.id === target!.id);
  if (customIdx >= 0) {
    customServants[customIdx] = { ...target };
  } else if (target.isCustomOrMeme) {
    customServants.push({ ...target });
  } else {
    // If it's a canon servant, update the in-memory SERVANT_DATABASE entry
    const canonIdx = SERVANT_DATABASE.findIndex(s => s.id === target!.id);
    if (canonIdx >= 0) {
      SERVANT_DATABASE[canonIdx] = { ...target };
    }
  }

  // Propagate updates to all active Master servant instances in memory
  for (const master of masterStore.values()) {
    if (master.servants) {
      for (const inst of master.servants) {
        if (inst.templateId === target.id || inst.template?.id === target.id) {
          inst.template = { ...target };
          if (inst.customQuotes) {
            if (updates.summonQuote) inst.customQuotes.summon = updates.summonQuote;
            if (updates.noblePhantasmChant) inst.customQuotes.noblePhantasm = updates.noblePhantasmChant;
          }
        }
      }
    }
  }

  return { success: true, servant: target };
}

/**
 * Removes a custom Servant from the database by ID.
 */
export function removeCustomServant(servantId: string): boolean {
  const initialLen = customServants.length;
  customServants = customServants.filter(s => s.id !== servantId);
  return customServants.length < initialLen;
}

/**
 * Returns all custom servants registered by admins.
 */
export function getCustomServants(): ServantTemplate[] {
  return [...customServants];
}

/**
 * Returns a set of template IDs of all currently contracted Servants across all active Masters.
 * In the Holy Grail War, each Heroic Spirit can only be contracted to one Master at a time.
 */
export function getContractedServantTemplateIds(): Set<string> {
  const contracted = new Set<string>();
  for (const master of masterStore.values()) {
    if (master.servants && master.servants.length > 0) {
      for (const s of master.servants) {
        contracted.add(s.templateId);
      }
    }
  }
  return contracted;
}

/**
 * Returns all available unclaimed Heroic Spirits in the Throne of Heroes.
 */
export function getAvailableThroneServants(): ServantTemplate[] {
  const contractedIds = getContractedServantTemplateIds();
  const allServants = getAllThroneServants();
  return allServants.filter(s => !contractedIds.has(s.id));
}

/**
 * Creates or retrieves a Master record by Discord ID.
 * When a user first enters the Holy Grail War, they are granted:
 * - 3 Command Seals (sacred marks of Master authority)
 * - 100 Action Points (AP) for tactical war moves
 * - No pre-assigned Servant (must perform the Summoning Ritual)
 */
export async function getOrCreateMaster(discordId: string, username: string = 'Master'): Promise<MasterProfile> {
  let master = masterStore.get(discordId);

  if (!master) {
    master = {
      id: `master_${discordId}`,
      discordId,
      username,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
      saintQuartz: 0,
      summonTickets: 0,
      commandSeals: 3,
      actionPoints: 100,
      maxActionPoints: 100,
      pityCount: 0,
      grailWarWins: 0,
      activeServantId: undefined,
      servants: [],
      craftEssences: [CRAFT_ESSENCE_DATABASE[0]]
    };
    masterStore.set(discordId, master);
  } else {
    // Keep username synchronized in case the user changed their Discord display name
    if (username && master.username !== username) {
      master.username = username;
    }
  }

  return master;
}

/**
 * Updates selective properties on a Master's profile.
 */
export async function updateMasterProfile(discordId: string, data: Partial<MasterProfile>): Promise<MasterProfile> {
  const master = await getOrCreateMaster(discordId);
  
  if (data.username !== undefined) master.username = data.username;
  if (data.actionPoints !== undefined) master.actionPoints = data.actionPoints;
  if (data.commandSeals !== undefined) master.commandSeals = data.commandSeals;
  if (data.grailWarWins !== undefined) master.grailWarWins = data.grailWarWins;
  if (data.activeServantId !== undefined) master.activeServantId = data.activeServantId;
  if (data.servants !== undefined) master.servants = data.servants;
  if (data.craftEssences !== undefined) master.craftEssences = data.craftEssences;

  masterStore.set(discordId, master);
  return master;
}

/**
 * Saves a complete modified master profile back to the persistent store.
 */
export async function saveMaster(master: MasterProfile): Promise<MasterProfile> {
  masterStore.set(master.discordId, master);
  return master;
}

/**
 * Gets all registered masters across the server.
 */
export async function getAllMasters(): Promise<MasterProfile[]> {
  return Array.from(masterStore.values());
}

/**
 * Looks up a Servant instance by ID across all registered Masters.
 */
export async function getServantById(servantId: string): Promise<MasterServantInstance | null> {
  for (const master of masterStore.values()) {
    const s = master.servants.find(srv => srv.id === servantId || srv.templateId === servantId);
    if (s) return s;
  }
  return null;
}

// Fallback compatibility proxy if standard ORM methods are invoked
export const prisma: any = new Proxy({}, {
  get: () => ({
    findMany: async () => Array.from(masterStore.values()),
    findFirst: async () => null,
    findUnique: async ({ where }: any) => {
      if (where?.discordId) return masterStore.get(where.discordId) || null;
      return null;
    },
    create: async ({ data }: any) => {
      if (data?.discordId) {
        return getOrCreateMaster(data.discordId, data.username);
      }
      return data;
    },
    update: async ({ where, data }: any) => {
      if (where?.discordId) {
        return updateMasterProfile(where.discordId, data);
      }
      return data;
    },
    delete: async () => ({})
  })
});
