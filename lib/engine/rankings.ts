import { MasterProfile, MasterServantInstance, MasterRankingEntry, MasterRankingResult } from '../types';
import { SERVANT_DATABASE } from '../data/servants';

export const SEED_MASTERS_ROSTER: Array<{
  discordId: string;
  username: string;
  avatarUrl: string;
  guildId: string;
  saintQuartz: number;
  commandSeals: number;
  grailWarWins: number;
  duelsWon: number;
  duelsLost: number;
  servantKills: number;
  servantTemplateId: string;
  servantLevel: number;
}> = [
  {
    discordId: 'master_fujimaru_ritsuka',
    username: 'Fujimaru Ritsuka',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
    guildId: 'guild-chaldea',
    saintQuartz: 420,
    commandSeals: 3,
    grailWarWins: 14,
    duelsWon: 89,
    duelsLost: 12,
    servantKills: 31,
    servantTemplateId: 'jeanne_d_arc',
    servantLevel: 90
  },
  {
    discordId: 'master_rin_tohsaka',
    username: 'Rin Tohsaka',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400',
    guildId: 'guild-fuyuki',
    saintQuartz: 280,
    commandSeals: 3,
    grailWarWins: 9,
    duelsWon: 54,
    duelsLost: 6,
    servantKills: 18,
    servantTemplateId: 'emiya',
    servantLevel: 85
  },
  {
    discordId: 'master_kirschtaria_wodime',
    username: 'Kirschtaria Wodime',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    guildId: 'guild-chaldea',
    saintQuartz: 350,
    commandSeals: 3,
    grailWarWins: 8,
    duelsWon: 48,
    duelsLost: 7,
    servantKills: 19,
    servantTemplateId: 'karna',
    servantLevel: 90
  },
  {
    discordId: 'master_shirou_emiya',
    username: 'Shirou Emiya',
    avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400',
    guildId: 'guild-fuyuki',
    saintQuartz: 90,
    commandSeals: 3,
    grailWarWins: 7,
    duelsWon: 41,
    duelsLost: 11,
    servantKills: 14,
    servantTemplateId: 'artoria_pendragon',
    servantLevel: 80
  },
  {
    discordId: 'master_kirei_kotomine',
    username: 'Father Kotomine',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
    guildId: 'guild-fuyuki',
    saintQuartz: 150,
    commandSeals: 3,
    grailWarWins: 6,
    duelsWon: 36,
    duelsLost: 8,
    servantKills: 16,
    servantTemplateId: 'cu_chulainn',
    servantLevel: 80
  },
  {
    discordId: 'master_daybit_sem_void',
    username: 'Daybit Sem Void',
    avatarUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400',
    guildId: 'guild-chaldea',
    saintQuartz: 300,
    commandSeals: 3,
    grailWarWins: 6,
    duelsWon: 39,
    duelsLost: 3,
    servantKills: 17,
    servantTemplateId: 'gilgamesh',
    servantLevel: 90
  },
  {
    discordId: 'master_kiritsugu_emiya',
    username: 'Kiritsugu Emiya',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400',
    guildId: 'guild-fuyuki',
    saintQuartz: 120,
    commandSeals: 3,
    grailWarWins: 5,
    duelsWon: 29,
    duelsLost: 5,
    servantKills: 15,
    servantTemplateId: 'artoria_pendragon_alter',
    servantLevel: 80
  },
  {
    discordId: 'master_illya_einzbern',
    username: 'Illyasviel von Einzbern',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
    guildId: 'guild-fuyuki',
    saintQuartz: 200,
    commandSeals: 3,
    grailWarWins: 4,
    duelsWon: 27,
    duelsLost: 9,
    servantKills: 11,
    servantTemplateId: 'heracles',
    servantLevel: 80
  },
  {
    discordId: 'master_waver_velvet',
    username: 'Lord El-Melloi II',
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400',
    guildId: 'guild-clocktower',
    saintQuartz: 180,
    commandSeals: 3,
    grailWarWins: 4,
    duelsWon: 23,
    duelsLost: 10,
    servantKills: 8,
    servantTemplateId: 'zhuge_liang',
    servantLevel: 75
  },
  {
    discordId: 'master_bazett_fraga',
    username: 'Bazett Fraga McRemitz',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400',
    guildId: 'guild-clocktower',
    saintQuartz: 160,
    commandSeals: 3,
    grailWarWins: 3,
    duelsWon: 25,
    duelsLost: 4,
    servantKills: 9,
    servantTemplateId: 'scathach',
    servantLevel: 80
  },
  {
    discordId: 'master_hakuno_kishinami',
    username: 'Hakuno Kishinami',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400',
    guildId: 'guild-mooncell',
    saintQuartz: 210,
    commandSeals: 3,
    grailWarWins: 5,
    duelsWon: 31,
    duelsLost: 9,
    servantKills: 10,
    servantTemplateId: 'nero_claudius',
    servantLevel: 80
  }
];

export function buildSeedMasterProfiles(): MasterProfile[] {
  return SEED_MASTERS_ROSTER.map(s => {
    const canonServant = SERVANT_DATABASE.find(t => t.id === s.servantTemplateId) || SERVANT_DATABASE[0];
    const servantInst: MasterServantInstance = {
      id: `seed_servant_${s.discordId}`,
      masterId: s.discordId,
      templateId: canonServant.id,
      level: s.servantLevel,
      experience: s.servantLevel * 50,
      allocatedStats: { strength: 5, endurance: 5, agility: 5, mana: 5, luck: 5 },
      availableStatPoints: 0,
      skillLevels: [6, 6, 6],
      customQuotes: {
        summon: canonServant.summonQuote,
        noblePhantasm: canonServant.noblePhantasm?.chant || 'True Name Unleashed!'
      },
      bondLevel: 5,
      template: { ...canonServant }
    };

    return {
      id: `master_${s.discordId}`,
      discordId: s.discordId,
      username: s.username,
      avatarUrl: s.avatarUrl,
      guildId: s.guildId,
      guildIds: [s.guildId, 'guild-fuyuki'],
      saintQuartz: s.saintQuartz,
      summonTickets: 5,
      commandSeals: s.commandSeals,
      actionPoints: 100,
      maxActionPoints: 100,
      pityCount: 0,
      grailWarWins: s.grailWarWins,
      duelsWon: s.duelsWon,
      duelsLost: s.duelsLost,
      servantKills: s.servantKills,
      totalBattleWins: s.duelsWon + s.servantKills,
      activeServantId: servantInst.id,
      servants: [servantInst],
      craftEssences: []
    };
  });
}

export function getGuildDisplayName(guildId?: string): string {
  if (!guildId) return '🏰 Fuyuki Holy Grail War Server';
  const id = guildId.toLowerCase();
  if (id.includes('fuyuki')) return '🏰 Fuyuki Holy Grail War Server';
  if (id.includes('chaldea')) return '❄️ Chaldea Security Organization';
  if (id.includes('clock') || id.includes('tower')) return '🏛️ Clock Tower Magus Association';
  if (id.includes('moon') || id.includes('cell')) return '🌕 Moon Cell Holy Grail War';
  return `🏰 Server (${guildId})`;
}

export function getMasterRankings(options: {
  scope?: 'server' | 'global';
  guildId?: string;
  category?: 'grail_war_wins' | 'all_battle_wins' | 'overall';
  limit?: number;
  offset?: number;
  targetUserId?: string;
  currentMaster?: MasterProfile;
}): MasterRankingResult {
  const scope = options.scope || 'server';
  const category = options.category || 'overall';
  const targetGuild = (options.guildId || 'guild-fuyuki').toLowerCase();

  const seedProfiles = buildSeedMasterProfiles();
  const allMasters: MasterProfile[] = [...seedProfiles];

  if (options.currentMaster) {
    const existingIdx = allMasters.findIndex(
      m => m.discordId === options.currentMaster!.discordId || m.id === options.currentMaster!.id
    );
    if (existingIdx >= 0) {
      allMasters[existingIdx] = { ...allMasters[existingIdx], ...options.currentMaster };
    } else {
      allMasters.push({
        ...options.currentMaster,
        guildId: options.currentMaster.guildId || 'guild-fuyuki',
        guildIds: options.currentMaster.guildIds || ['guild-fuyuki']
      });
    }
  }

  // Filter by scope (Server vs Global)
  let scopedMasters = allMasters;
  if (scope === 'server') {
    scopedMasters = allMasters.filter(m => {
      if (!m.guildId && !m.guildIds) return true;
      if (m.guildId && (m.guildId.toLowerCase() === targetGuild || (m.guildId.toLowerCase().includes('fuyuki') && targetGuild.includes('fuyuki')))) return true;
      if (m.guildIds && m.guildIds.some(g => g.toLowerCase() === targetGuild || (g.toLowerCase().includes('fuyuki') && targetGuild.includes('fuyuki')))) return true;
      return false;
    });

    if (scopedMasters.length < 3) {
      scopedMasters = allMasters;
    }
  }

  // Map into rich leaderboard entries
  const entries: MasterRankingEntry[] = scopedMasters.map(m => {
    const grailWarWins = m.grailWarWins || 0;
    const duelsWon = m.duelsWon || 0;
    const duelsLost = m.duelsLost || 0;
    const servantKills = m.servantKills || 0;
    const battleWins = duelsWon + servantKills;
    const totalFights = duelsWon + duelsLost;
    const winRate = totalFights > 0 ? Math.round((duelsWon / totalFights) * 100) : (battleWins > 0 ? 100 : 0);

    const activeServant = m.servants?.find(s => s.id === m.activeServantId) || m.servants?.[0];
    const servantName = activeServant?.nickname || activeServant?.template?.name || (activeServant as any)?.name || 'Heroic Spirit';
    const servantClass = activeServant?.template?.servantClass || (activeServant as any)?.servantClass || 'Saber';
    const servantAvatar = activeServant?.avatarUrl || activeServant?.template?.avatarUrl || m.avatarUrl;
    const servantLevel = activeServant?.level || 1;

    return {
      rank: 0,
      master: m,
      grailWarWins,
      battleWins,
      duelsWon,
      duelsLost,
      servantKills,
      winRate,
      commandSeals: m.commandSeals ?? 3,
      activeServantName: servantName,
      activeServantClass: servantClass,
      activeServantAvatar: servantAvatar,
      activeServantLevel: servantLevel,
      guildId: m.guildId,
      guildName: getGuildDisplayName(m.guildId)
    };
  });

  // Sort based on selected category:
  // 1. 'grail_war_wins': Total Grail War tournament victories
  // 2. 'all_battle_wins': Total battle & duel victories across all modes
  // 3. 'overall': Grand Magus formula combining Grail Victories & Battle Triumphs
  entries.sort((a, b) => {
    if (category === 'grail_war_wins') {
      if (b.grailWarWins !== a.grailWarWins) return b.grailWarWins - a.grailWarWins;
      return b.battleWins - a.battleWins;
    } else if (category === 'all_battle_wins') {
      if (b.battleWins !== a.battleWins) return b.battleWins - a.battleWins;
      return b.grailWarWins - a.grailWarWins;
    } else {
      const scoreA = (a.grailWarWins * 1000) + (a.battleWins * 100) + (a.duelsWon * 10);
      const scoreB = (b.grailWarWins * 1000) + (b.battleWins * 100) + (b.duelsWon * 10);
      if (scoreB !== scoreA) return scoreB - scoreA;
      if (b.grailWarWins !== a.grailWarWins) return b.grailWarWins - a.grailWarWins;
      return b.battleWins - a.battleWins;
    }
  });

  // Assign ranks
  entries.forEach((e, idx) => {
    e.rank = idx + 1;
  });

  let userRankInfo: MasterRankingResult['userRank'] = undefined;
  if (options.targetUserId) {
    const userIdx = entries.findIndex(
      e => e.master.discordId === options.targetUserId || e.master.id === options.targetUserId || e.master.username.toLowerCase() === options.targetUserId?.toLowerCase()
    );
    if (userIdx >= 0) {
      const u = entries[userIdx];
      const percentile = Math.max(1, Math.round(((entries.length - userIdx) / entries.length) * 100));
      userRankInfo = {
        rank: u.rank,
        percentile,
        grailWarWins: u.grailWarWins,
        battleWins: u.battleWins,
        duelsWon: u.duelsWon,
        servantKills: u.servantKills
      };
    }
  }

  const offset = options.offset || 0;
  const limit = options.limit || 10;
  const sliced = entries.slice(offset, offset + limit);

  return {
    scope,
    category,
    serverName: scope === 'server' ? getGuildDisplayName(options.guildId || 'guild-fuyuki') : 'Throne of Heroes (Universal Chaldea Network)',
    rankings: sliced,
    totalMasters: entries.length,
    userRank: userRankInfo
  };
}
