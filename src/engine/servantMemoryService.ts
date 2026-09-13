import fs from 'fs';
import path from 'path';

export interface TalkMessageTurn {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export interface ServantChatMemoryRecord {
  masterId: string;
  servantId: string;
  servantName: string;
  warId: string;
  turns: TalkMessageTurn[];
  updatedAt: number;
}

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const MEMORY_FILE = path.join(DATA_DIR, 'servant_chat_memory.json');

// In-memory cache of conversations: key is `${warId}:${masterId}:${servantId}`
const memoryCache: Map<string, ServantChatMemoryRecord> = new Map();
let isInitialized = false;

function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadMemoryFromDisk() {
  if (isInitialized) return;
  try {
    ensureDataDirectory();
    if (fs.existsSync(MEMORY_FILE)) {
      const raw = fs.readFileSync(MEMORY_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const record of parsed) {
          const key = `${record.warId || 'default'}:${record.masterId}:${record.servantId}`;
          memoryCache.set(key, record);
        }
      }
    }
  } catch (err) {
    console.error('[ServantMemory] Failed to load chat memory:', err);
  } finally {
    isInitialized = true;
  }
}

function saveMemoryToDisk() {
  try {
    ensureDataDirectory();
    const list = Array.from(memoryCache.values());
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('[ServantMemory] Failed to save chat memory:', err);
  }
}

/**
 * Get the history of previous conversation turns for a Master and Servant in a specific Grail War.
 * Limits to the most recent maxTurns (default: 20 turns) to maintain fast generation speed.
 */
export function getServantChatHistory(
  masterId: string,
  servantId: string,
  warId: string = 'default',
  maxTurns: number = 20
): TalkMessageTurn[] {
  loadMemoryFromDisk();
  const key = `${warId}:${masterId}:${servantId}`;
  const record = memoryCache.get(key);
  if (!record || !record.turns) return [];
  return record.turns.slice(-maxTurns);
}

/**
 * Append a Master-Servant dialogue exchange to the persistent Holy Grail War memory.
 */
export function appendServantChatTurn(
  masterId: string,
  servantId: string,
  servantName: string,
  playerMessage: string,
  servantReply: string,
  warId: string = 'default'
): void {
  loadMemoryFromDisk();
  const key = `${warId}:${masterId}:${servantId}`;
  let record = memoryCache.get(key);

  if (!record) {
    record = {
      masterId,
      servantId,
      servantName,
      warId,
      turns: [],
      updatedAt: Date.now()
    };
    memoryCache.set(key, record);
  }

  const now = Date.now();
  record.turns.push(
    { role: 'user', content: playerMessage, timestamp: now },
    { role: 'model', content: servantReply, timestamp: now }
  );

  // Keep up to 60 message turns per Servant-Master contract to preserve memory across the entire War
  if (record.turns.length > 60) {
    record.turns = record.turns.slice(-60);
  }

  record.updatedAt = now;
  saveMemoryToDisk();
}

/**
 * Clear all Servant dialogue memories for a given war or specific master/servant.
 * Called automatically when the Holy Grail War resets or concludes.
 */
export function clearServantWarMemories(warId?: string): number {
  loadMemoryFromDisk();
  let clearedCount = 0;
  if (!warId) {
    clearedCount = memoryCache.size;
    memoryCache.clear();
  } else {
    for (const [key, record] of Array.from(memoryCache.entries())) {
      if (record.warId === warId || key.startsWith(`${warId}:`)) {
        memoryCache.delete(key);
        clearedCount++;
      }
    }
  }
  saveMemoryToDisk();
  console.log(`[ServantMemory] Cleared ${clearedCount} Servant chat memories for war: ${warId || 'all'}`);
  return clearedCount;
}

/**
 * Clear dialogue memory specifically for a single Master and Servant (e.g. if contract severed).
 */
export function clearMasterServantChat(masterId: string, servantId: string, warId: string = 'default'): boolean {
  loadMemoryFromDisk();
  const key = `${warId}:${masterId}:${servantId}`;
  const existed = memoryCache.delete(key);
  if (existed) {
    saveMemoryToDisk();
  }
  return existed;
}
