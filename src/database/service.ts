import { MasterProfile, MasterServantInstance, CraftEssence } from '../types';
import { SERVANT_DATABASE } from '../data/servants';
import { CRAFT_ESSENCE_DATABASE } from '../data/craftEssences';

// In-memory persistent master registry
const masterStore: Map<string, MasterProfile> = new Map();

/**
 * Creates or retrieves a Master record by Discord ID
 */
export async function getOrCreateMaster(discordId: string, username: string = 'Master'): Promise<MasterProfile> {
  let master = masterStore.get(discordId);

  if (!master) {
    master = {
      id: `master_${discordId}`,
      discordId,
      username,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
      saintQuartz: 30,
      summonTickets: 3,
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
    // Keep username updated if changed
    if (username && master.username !== username) {
      master.username = username;
    }
  }

  return master;
}

/**
 * Updates properties on a Master's profile
 */
export async function updateMasterProfile(discordId: string, data: Partial<MasterProfile>): Promise<MasterProfile> {
  const master = await getOrCreateMaster(discordId);
  
  if (data.username !== undefined) master.username = data.username;
  if (data.saintQuartz !== undefined) master.saintQuartz = data.saintQuartz;
  if (data.actionPoints !== undefined) master.actionPoints = data.actionPoints;
  if (data.commandSeals !== undefined) master.commandSeals = data.commandSeals;
  if (data.pityCount !== undefined) master.pityCount = data.pityCount;
  if (data.grailWarWins !== undefined) master.grailWarWins = data.grailWarWins;
  if (data.activeServantId !== undefined) master.activeServantId = data.activeServantId;
  if (data.servants !== undefined) master.servants = data.servants;
  if (data.craftEssences !== undefined) master.craftEssences = data.craftEssences;

  masterStore.set(discordId, master);
  return master;
}

/**
 * Saves a complete master profile
 */
export async function saveMaster(master: MasterProfile): Promise<MasterProfile> {
  masterStore.set(master.discordId, master);
  return master;
}

/**
 * Gets all registered masters
 */
export async function getAllMasters(): Promise<MasterProfile[]> {
  return Array.from(masterStore.values());
}

/**
 * Retrieves a Servant instance from any Master or global template
 */
export async function getServantById(servantId: string): Promise<MasterServantInstance | null> {
  for (const master of masterStore.values()) {
    const s = master.servants.find(srv => srv.id === servantId || srv.templateId === servantId);
    if (s) return s;
  }
  return null;
}

// Fallback prisma export for backwards compatibility
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
