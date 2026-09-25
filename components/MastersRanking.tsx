'use client';

import React, { useState, useMemo } from 'react';
import { MasterProfile } from '../src/types';
import { getMasterRankings, getGuildDisplayName } from '../lib/engine/rankings';
import { 
  Trophy, 
  Swords, 
  Crown, 
  Globe, 
  Building2, 
  Search, 
  Shield, 
  Sparkles, 
  Flame, 
  Medal, 
  UserCheck,
  ChevronRight,
  Filter
} from 'lucide-react';

interface MastersRankingProps {
  master: MasterProfile;
  onOpenDuel?: () => void;
  onOpenGrailWar?: () => void;
}

export default function MastersRanking({ master, onOpenDuel, onOpenGrailWar }: MastersRankingProps) {
  const [scope, setScope] = useState<'server' | 'global'>('server');
  const [category, setCategory] = useState<'grail_war_wins' | 'all_battle_wins' | 'overall'>('grail_war_wins');
  const [selectedServer, setSelectedServer] = useState<string>('guild-fuyuki');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [classFilter, setClassFilter] = useState<string>('all');

  // Compute rankings data
  const rankingResult = useMemo(() => {
    return getMasterRankings({
      scope,
      guildId: scope === 'server' ? selectedServer : undefined,
      category,
      limit: 50,
      targetUserId: master.discordId || master.id,
      currentMaster: master
    });
  }, [scope, category, selectedServer, master]);

  // Filter rankings by search query & class filter
  const filteredRankings = useMemo(() => {
    return rankingResult.rankings.filter(entry => {
      const matchesSearch = 
        entry.master.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.activeServantName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesClass = 
        classFilter === 'all' || 
        entry.activeServantClass.toLowerCase() === classFilter.toLowerCase();

      return matchesSearch && matchesClass;
    });
  }, [rankingResult.rankings, searchQuery, classFilter]);

  const topThree = rankingResult.rankings.slice(0, 3);

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { icon: '🥇', label: '1st Place', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
    if (rank === 2) return { icon: '🥈', label: '2nd Place', color: 'text-slate-300 bg-slate-400/10 border-slate-400/30' };
    if (rank === 3) return { icon: '🥉', label: '3rd Place', color: 'text-amber-700 bg-amber-700/10 border-amber-700/30' };
    return { icon: `#${rank}`, label: `Rank ${rank}`, color: 'text-white/60 bg-white/5 border-white/10' };
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-xl border border-[#d4af37]/30 bg-gradient-to-br from-[#141414] via-[#0d0d0d] to-[#181205] p-6 shadow-2xl">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-[#d4af37]/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest rounded bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-[#d4af37]" />
                PANTHEON OF HEROES
              </span>
              <span className="text-xs text-white/40 font-mono">
                Updated Live • {rankingResult.totalMasters} Masters Registered
              </span>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-serif italic text-white tracking-wide">
              Holy Grail War <span className="text-[#d4af37] not-italic font-sans font-bold">Masters Leaderboard</span>
            </h2>
            
            <p className="text-sm text-white/60 mt-1 max-w-2xl font-sans">
              Compete for supremacy in the Fuyuki Holy Grail War and Chaldea universal network. Ranked by verified Tournament Victories and Battle Triumphs across all combat modes.
            </p>
          </div>

          {/* User Fast Stats Capsule */}
          {rankingResult.userRank && (
            <div className="bg-[#1a1a1a]/90 border border-[#d4af37]/40 rounded-lg p-4 flex items-center gap-4 shrink-0 shadow-lg">
              <div className="w-12 h-12 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/50 flex items-center justify-center text-[#d4af37] font-mono font-bold text-lg">
                #{rankingResult.userRank.rank}
              </div>
              <div>
                <div className="text-[11px] text-white/50 uppercase tracking-wider font-mono">Your Standing</div>
                <div className="text-base font-semibold text-white flex items-center gap-1.5">
                  <span>{master.username}</span>
                  <span className="text-xs text-[#d4af37] font-mono">(Top {100 - rankingResult.userRank.percentile + 1}%)</span>
                </div>
                <div className="text-xs text-white/60 flex items-center gap-3 mt-0.5 font-mono">
                  <span className="text-amber-400">🏆 {rankingResult.userRank.grailWarWins} Wins</span>
                  <span className="text-rose-400">⚔️ {rankingResult.userRank.battleWins} Battles</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Control Filters & Switchers */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-[#111111] p-4 rounded-xl border border-[#222]">
        {/* Scope Toggle (Server vs Global) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScope('server')}
            className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${
              scope === 'server'
                ? 'bg-[#d4af37] text-black font-semibold shadow-[0_0_12px_rgba(212,175,55,0.3)]'
                : 'bg-[#181818] text-white/70 hover:text-white border border-[#2a2a2a]'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>🏰 Server Masters</span>
          </button>

          <button
            onClick={() => setScope('global')}
            className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${
              scope === 'global'
                ? 'bg-[#38bdf8] text-black font-semibold shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                : 'bg-[#181818] text-white/70 hover:text-white border border-[#2a2a2a]'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>🌐 Global Masters</span>
          </button>

          {scope === 'server' && (
            <select
              value={selectedServer}
              onChange={e => setSelectedServer(e.target.value)}
              aria-label="Filter leaderboard by server sector"
              className="bg-[#181818] border border-[#333] text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-[#d4af37]"
            >
              <option value="guild-fuyuki">🏰 Fuyuki Holy Grail War Server</option>
              <option value="guild-chaldea">❄️ Chaldea Security Organization</option>
              <option value="guild-clocktower">🏛️ Clock Tower Magus Association</option>
              <option value="guild-mooncell">🌕 Moon Cell Holy Grail War</option>
            </select>
          )}
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#181818] p-1 rounded-lg border border-[#2a2a2a]">
          <button
            onClick={() => setCategory('grail_war_wins')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
              category === 'grail_war_wins'
                ? 'bg-[#262626] text-amber-400 border border-amber-400/40 shadow-sm'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Grail War Wins</span>
          </button>

          <button
            onClick={() => setCategory('all_battle_wins')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
              category === 'all_battle_wins'
                ? 'bg-[#262626] text-rose-400 border border-rose-400/40 shadow-sm'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Battle Wins (All)</span>
          </button>

          <button
            onClick={() => setCategory('overall')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
              category === 'overall'
                ? 'bg-[#262626] text-[#d4af37] border border-[#d4af37]/40 shadow-sm'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Grand Magus Index</span>
          </button>
        </div>
      </div>

      {/* Podium Cards for Top 3 */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topThree.map((entry, index) => {
            const isFirst = entry.rank === 1;
            const isSecond = entry.rank === 2;
            const isThird = entry.rank === 3;

            const podiumBorder = isFirst
              ? 'border-amber-400/60 bg-gradient-to-b from-amber-500/10 via-[#141414] to-[#0f0f0f]'
              : isSecond
              ? 'border-slate-400/40 bg-gradient-to-b from-slate-400/10 via-[#141414] to-[#0f0f0f]'
              : 'border-amber-700/40 bg-gradient-to-b from-amber-700/10 via-[#141414] to-[#0f0f0f]';

            const badgeIcon = isFirst ? '🥇 1st Place' : isSecond ? '🥈 2nd Place' : '🥉 3rd Place';

            return (
              <div
                key={entry.master.id || entry.master.discordId}
                className={`relative rounded-xl p-5 border ${podiumBorder} flex flex-col justify-between shadow-xl`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-1 text-xs font-mono font-bold rounded-full bg-black/60 border border-white/10 text-white">
                      {badgeIcon}
                    </span>
                    <span className="text-[11px] font-mono text-white/50">
                      {entry.guildName?.split(' ')[0] || '🏰 Server'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3.5 mb-4">
                    <img
                      src={entry.master.avatarUrl}
                      alt={entry.master.username}
                      className="w-14 h-14 rounded-full border-2 border-[#d4af37]/60 object-cover shadow-md"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h4 className="text-base font-bold text-white tracking-wide flex items-center gap-1.5">
                        {entry.master.username}
                        {entry.master.discordId === (master.discordId || master.id) && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded font-mono">
                            YOU
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-[#d4af37] font-mono mt-0.5">
                        ✦ {entry.activeServantName} [{entry.activeServantClass} Lv.{entry.activeServantLevel}]
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-black/40 p-2.5 rounded-lg border border-white/5 text-center font-mono">
                  <div>
                    <div className="text-[10px] text-white/40 uppercase">Grail Wins</div>
                    <div className="text-sm font-bold text-amber-400">🏆 {entry.grailWarWins}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/40 uppercase">Battle Wins</div>
                    <div className="text-sm font-bold text-rose-400">⚔️ {entry.battleWins}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/40 uppercase">Win Rate</div>
                    <div className="text-sm font-bold text-emerald-400">{entry.winRate}%</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Leaderboard Table & Search */}
      <div className="bg-[#121212] border border-[#222] rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#222] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Medal className="w-5 h-5 text-[#d4af37]" />
            <h3 className="text-base font-semibold text-white">
              {scope === 'server' ? `🏰 ${rankingResult.serverName}` : '🌐 Throne of Heroes (Global Leaderboard)'}
            </h3>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search Master or Servant..."
                className="bg-[#181818] border border-[#2a2a2a] text-white text-xs rounded-lg pl-8 pr-3 py-1.5 outline-none focus:border-[#d4af37] w-48 sm:w-60 font-sans"
              />
            </div>

            {/* Class Filter Dropdown */}
            <select
              value={classFilter}
              onChange={e => setClassFilter(e.target.value)}
              aria-label="Filter by Servant Class"
              className="bg-[#181818] border border-[#2a2a2a] text-white text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-[#d4af37]"
            >
              <option value="all">All Classes</option>
              <option value="saber">Saber</option>
              <option value="archer">Archer</option>
              <option value="lancer">Lancer</option>
              <option value="rider">Rider</option>
              <option value="caster">Caster</option>
              <option value="assassin">Assassin</option>
              <option value="berserker">Berserker</option>
              <option value="ruler">Ruler</option>
              <option value="avenger">Avenger</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#161616] text-white/40 uppercase font-mono text-[10px] tracking-wider border-b border-[#222]">
              <tr>
                <th className="py-3 px-4 w-16">Rank</th>
                <th className="py-3 px-4">Master & Server</th>
                <th className="py-3 px-4">Contracted Servant</th>
                <th className="py-3 px-4 text-center">🏆 Grail Wins</th>
                <th className="py-3 px-4 text-center">⚔️ Battle Wins</th>
                <th className="py-3 px-4 text-center">PvP Breakdown</th>
                <th className="py-3 px-4 text-center">Win Rate</th>
                <th className="py-3 px-4 text-center">🔴 Seals</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e1e]">
              {filteredRankings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-white/40 font-mono">
                    No Masters found matching the current search & filters.
                  </td>
                </tr>
              ) : (
                filteredRankings.map(entry => {
                  const isCurrentUser = entry.master.discordId === (master.discordId || master.id);
                  const badge = getRankBadge(entry.rank);

                  return (
                    <tr
                      key={entry.master.id || entry.master.discordId}
                      className={`hover:bg-[#181818] transition-colors ${
                        isCurrentUser ? 'bg-[#d4af37]/5 font-medium' : ''
                      }`}
                    >
                      {/* Rank Badge */}
                      <td className="py-3.5 px-4 font-mono font-bold">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] border ${badge.color}`}>
                          {badge.icon}
                        </span>
                      </td>

                      {/* Master Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={entry.master.avatarUrl}
                            alt={entry.master.username}
                            className="w-8 h-8 rounded-full border border-white/10 object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              <span>{entry.master.username}</span>
                              {isCurrentUser && (
                                <span className="text-[9px] px-1 py-0.2 bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40 rounded font-mono">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-white/40 font-mono">
                              {entry.guildName || 'Fuyuki Magus'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contracted Servant */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <img
                            src={entry.activeServantAvatar}
                            alt={entry.activeServantName}
                            className="w-7 h-7 rounded border border-[#d4af37]/40 object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <div className="text-white font-medium">{entry.activeServantName}</div>
                            <div className="text-[10px] text-[#d4af37] font-mono">
                              {entry.activeServantClass} • Lv.{entry.activeServantLevel}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Grail War Wins */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-amber-400">
                        🏆 {entry.grailWarWins}
                      </td>

                      {/* Battle Wins (All) */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-rose-400">
                        ⚔️ {entry.battleWins}
                      </td>

                      {/* PvP Breakdown */}
                      <td className="py-3.5 px-4 text-center font-mono text-[11px] text-white/60">
                        🤺 {entry.duelsWon}W / {entry.duelsLost}L • 💀 {entry.servantKills}K
                      </td>

                      {/* Win Rate */}
                      <td className="py-3.5 px-4 text-center font-mono">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] ${
                          entry.winRate >= 80 ? 'text-emerald-400 bg-emerald-500/10' :
                          entry.winRate >= 50 ? 'text-amber-400 bg-amber-500/10' : 'text-rose-400 bg-rose-500/10'
                        }`}>
                          {entry.winRate}%
                        </span>
                      </td>

                      {/* Command Seals */}
                      <td className="py-3.5 px-4 text-center font-mono text-rose-400">
                        🔴 {entry.commandSeals}/3
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
