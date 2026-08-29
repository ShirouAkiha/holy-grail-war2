import {
  GachaBanner,
  HolyGrailWarSession,
  MasterProfile,
  MasterServantInstance,
  CraftEssence
} from '../types';
import { SERVANT_DATABASE } from '../data/servants';
import { CRAFT_ESSENCE_DATABASE, GACHA_BANNERS } from '../data/craftEssences';
import { createHolyGrailWarSession } from '../engine/grailwar';

const STORAGE_KEY = 'holy_grail_war_master_profile_v1';
const WAR_STORAGE_KEY = 'holy_grail_war_active_session_v1';

export function getInitialMasterProfile(): MasterProfile {
  const defaultServantTemplate = SERVANT_DATABASE[0]; // Artoria
  const defaultCe = CRAFT_ESSENCE_DATABASE[0]; // Kaleidoscope

  const initialServant: MasterServantInstance = {
    id: 'starter_artoria_01',
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

  const starterArcher = SERVANT_DATABASE.find(s => s.id === 'emiya_archer') || SERVANT_DATABASE[1];
  const secondServant: MasterServantInstance = {
    id: 'starter_emiya_02',
    masterId: 'master_user_01',
    templateId: starterArcher.id,
    level: 15,
    experience: 600,
    allocatedStats: {
      strength: 2,
      endurance: 2,
      agility: 3,
      mana: 4,
      luck: 1
    },
    availableStatPoints: 3,
    equippedCeId: CRAFT_ESSENCE_DATABASE[4].id,
    equippedCe: CRAFT_ESSENCE_DATABASE[4],
    skillLevels: [2, 2, 1],
    customQuotes: {
      summon: starterArcher.summonQuote,
      battleStart: starterArcher.battleStartQuote,
      noblePhantasm: starterArcher.noblePhantasm.chant,
      victory: starterArcher.victoryQuote,
      defeat: starterArcher.defeatQuote
    },
    bondLevel: 2,
    template: starterArcher
  };

  return {
    id: 'master_user_01',
    discordId: '912420275492',
    username: 'Master Shirou',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
    saintQuartz: 90,
    summonTickets: 10,
    commandSeals: 3,
    actionPoints: 100,
    maxActionPoints: 100,
    pityCount: 15,
    grailWarWins: 2,
    activeServantId: initialServant.id,
    servants: [initialServant, secondServant],
    craftEssences: [
      CRAFT_ESSENCE_DATABASE[0],
      CRAFT_ESSENCE_DATABASE[1],
      CRAFT_ESSENCE_DATABASE[2],
      CRAFT_ESSENCE_DATABASE[4],
      CRAFT_ESSENCE_DATABASE[5]
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
    return JSON.parse(raw);
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
  if (typeof window === 'undefined') {
    const activeServant = master.servants.find(s => s.id === master.activeServantId) || master.servants[0];
    return createHolyGrailWarSession({
      discordId: master.discordId,
      username: master.username,
      servantId: activeServant?.id || 'servant_default',
      servantName: activeServant?.template.name || 'Artoria Pendragon',
      avatarUrl: activeServant?.template.avatarUrl || '',
      maxHp: activeServant?.template.baseHp || 15000
    });
  }

  try {
    const raw = localStorage.getItem(WAR_STORAGE_KEY);
    if (raw) return JSON.parse(raw);

    const activeServant = master.servants.find(s => s.id === master.activeServantId) || master.servants[0];
    const initial = createHolyGrailWarSession({
      discordId: master.discordId,
      username: master.username,
      servantId: activeServant?.id || 'servant_default',
      servantName: activeServant?.template.name || 'Artoria Pendragon',
      avatarUrl: activeServant?.template.avatarUrl || '',
      maxHp: activeServant?.template.baseHp || 15000
    });
    saveGrailWarSession(initial);
    return initial;
  } catch {
    const activeServant = master.servants.find(s => s.id === master.activeServantId) || master.servants[0];
    return createHolyGrailWarSession({
      discordId: master.discordId,
      username: master.username,
      servantId: activeServant?.id || 'servant_default',
      servantName: activeServant?.template.name || 'Artoria Pendragon',
      avatarUrl: activeServant?.template.avatarUrl || '',
      maxHp: activeServant?.template.baseHp || 15000
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
