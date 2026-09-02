import {
  HolyGrailWarSession,
  MasterProfile,
  MasterServantInstance,
  CraftEssence,
  ServantTemplate
} from '../types';
import { SERVANT_DATABASE } from '../data/servants';
import { CRAFT_ESSENCE_DATABASE } from '../data/craftEssences';
import { createHolyGrailWarSession, calculateServantMaxHp } from '../engine/grailwar';

const STORAGE_KEY = 'holy_grail_war_master_profile_v2';
const WAR_STORAGE_KEY = 'holy_grail_war_active_session_v2';
const CUSTOM_SERVANTS_STORAGE_KEY = 'holy_grail_war_custom_servants_v1';

export function getCustomServantsFromStorage(): ServantTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_SERVANTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomServantsToStorage(servants: ServantTemplate[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CUSTOM_SERVANTS_STORAGE_KEY, JSON.stringify(servants));
    // Asynchronously synchronize with server storage endpoint so updates survive project pull/rebuilds
    fetch('/api/servants/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_all', servants })
    }).catch(err => {
      console.warn('Server storage sync failed, local copy intact:', err);
    });
  } catch (err) {
    console.error('Failed to save custom servants to storage', err);
  }
}

export async function fetchServerCustomServants(): Promise<ServantTemplate[]> {
  try {
    const res = await fetch('/api/servants/custom');
    if (!res.ok) return [];
    const data = await res.json();
    if (data.success && Array.isArray(data.servants)) {
      return data.servants;
    }
    return [];
  } catch (err) {
    console.warn('Could not fetch server custom servants:', err);
    return [];
  }
}

export function getAllThroneServants(customServants: ServantTemplate[] = []): ServantTemplate[] {
  const canonMap = new Map<string, ServantTemplate>(SERVANT_DATABASE.map(s => [s.id, { ...s }]));
  const customOnly: ServantTemplate[] = [];

  for (const cs of customServants) {
    if (canonMap.has(cs.id)) {
      canonMap.set(cs.id, { ...canonMap.get(cs.id)!, ...cs });
    } else {
      customOnly.push(cs);
    }
  }

  return [...Array.from(canonMap.values()), ...customOnly];
}

export function getInitialMasterProfile(): MasterProfile {
  const defaultServantTemplate = SERVANT_DATABASE[0]; // Artoria
  const defaultCe = CRAFT_ESSENCE_DATABASE[0]; // Kaleidoscope

  const initialServant: MasterServantInstance = {
    id: 'contract_artoria_starter',
    masterId: 'master_user_01',
    templateId: defaultServantTemplate.id,
    level: 25,
    experience: 1250,
    allocatedStats: {
      strength: 4,
      endurance: 3,
      agility: 2,
      mana: 5,
      luck: 1
    },
    availableStatPoints: 5,
    equippedCeId: defaultCe.id,
    equippedCe: defaultCe,
    skillLevels: [4, 3, 2],
    customQuotes: {
      summon: defaultServantTemplate.summonQuote,
      battleStart: 'I shall cut through the darkness with the light of victory!',
      noblePhantasm: 'Gathered breath of the planet... EX---CALIBUR!',
      victory: 'A worthy clash. Walk with honor, Master.',
      defeat: 'My resolve... was not enough...'
    },
    bondLevel: 4,
    template: defaultServantTemplate
  };

  return {
    id: 'master_user_01',
    discordId: '912420275492',
    username: 'Master Shirou',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
    saintQuartz: 0,
    summonTickets: 0,
    commandSeals: 3,
    actionPoints: 100,
    maxActionPoints: 100,
    pityCount: 0,
    grailWarWins: 2,
    activeServantId: initialServant.id,
    servants: [initialServant],
    craftEssences: [
      CRAFT_ESSENCE_DATABASE[0],
      CRAFT_ESSENCE_DATABASE[1],
      CRAFT_ESSENCE_DATABASE[2],
      CRAFT_ESSENCE_DATABASE[4]
    ]
  };
}

export function loadMasterProfile(): MasterProfile {
  if (typeof window === 'undefined') return getInitialMasterProfile();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getInitialMasterProfile();
      saveMasterProfile(initial);
      return initial;
    }
    const parsed: MasterProfile = JSON.parse(raw);
    // Refresh servant templates from current SERVANT_DATABASE / custom servants
    const customServants = getCustomServantsFromStorage();
    const allThrone = getAllThroneServants(customServants);
    if (parsed.servants && Array.isArray(parsed.servants)) {
      parsed.servants = parsed.servants.map(s => {
        const templateId = s.templateId || s.template?.id || s.id;
        const fresh = allThrone.find(t => t.id === templateId) || SERVANT_DATABASE.find(t => t.id === templateId) || s.template;
        return {
          ...s,
          template: fresh ? { ...fresh, ...(s.template?.isCustomOrMeme ? s.template : {}) } : s.template
        };
      });
    }
    return parsed;
  } catch {
    return getInitialMasterProfile();
  }
}

export function saveMasterProfile(profile: MasterProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error('Failed to save master profile to localStorage', err);
  }
}

export function loadGrailWarSession(master: MasterProfile): HolyGrailWarSession {
  const activeServant = master.servants.find(s => s.id === master.activeServantId) || master.servants[0];
  const activeMaxHp = activeServant ? calculateServantMaxHp(activeServant) : 31250;

  if (typeof window === 'undefined') {
    return createHolyGrailWarSession({
      discordId: master.discordId,
      username: master.username,
      servantId: activeServant?.id || 'servant_default',
      servantName: activeServant?.template.name || 'Artoria Pendragon',
      avatarUrl: activeServant?.template.avatarUrl || '',
      maxHp: activeMaxHp
    });
  }

  try {
    const raw = localStorage.getItem(WAR_STORAGE_KEY);
    if (raw) {
      const session: HolyGrailWarSession = JSON.parse(raw);
      // Synchronize all participants' max HP to canonical templates
      if (session.participants) {
        Object.values(session.participants).forEach(p => {
          const isCurrentMaster = p.discordId === master.discordId;
          const freshMax = isCurrentMaster
            ? activeMaxHp
            : calculateServantMaxHp({
                templateId: p.servantId,
                name: p.servantName,
                servantClass: p.servantClass,
                level: 20,
                allocatedStats: { strength: 3, endurance: 3, agility: 3, mana: 3, luck: 2 }
              });

          const oldMax = p.maxHp || 1;
          p.maxHp = freshMax;
          if (p.isAlive) {
            if (p.currentHp === undefined) {
              p.currentHp = freshMax;
            } else if (p.currentHp >= oldMax) {
              p.currentHp = freshMax;
            } else {
              p.currentHp = Math.min(freshMax, Math.round((p.currentHp / oldMax) * freshMax));
            }
          }
        });
      }
      return session;
    }

    const initial = createHolyGrailWarSession({
      discordId: master.discordId,
      username: master.username,
      servantId: activeServant?.id || 'servant_default',
      servantName: activeServant?.template.name || 'Artoria Pendragon',
      avatarUrl: activeServant?.template.avatarUrl || '',
      maxHp: activeMaxHp
    });
    saveGrailWarSession(initial);
    return initial;
  } catch {
    return createHolyGrailWarSession({
      discordId: master.discordId,
      username: master.username,
      servantId: activeServant?.id || 'servant_default',
      servantName: activeServant?.template.name || 'Artoria Pendragon',
      avatarUrl: activeServant?.template.avatarUrl || '',
      maxHp: activeMaxHp
    });
  }
}

export function saveGrailWarSession(war: HolyGrailWarSession): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WAR_STORAGE_KEY, JSON.stringify(war));
  } catch (err) {
    console.error('Failed to save grail war session to localStorage', err);
  }
}
