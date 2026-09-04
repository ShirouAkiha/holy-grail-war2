'use client';

import React, { useState } from 'react';
import { CombatBattleRecord, CombatTurnLog } from '../lib/types';
import {
  Swords,
  Shield,
  Zap,
  Flame,
  Sparkles,
  RotateCcw,
  Skull,
  Award,
  ChevronRight,
  Clock,
  Filter,
  Copy,
  Check,
  Trash2,
  BookOpen,
  Heart
} from 'lucide-react';

interface CombatLogHistoryProps {
  history: CombatBattleRecord[];
  onSelectRematch?: (enemyTemplateId: string) => void;
  onClose?: () => void;
  onResetSeed?: () => void;
  onClearHistory?: () => void;
  activeServantName?: string;
  initialSelectedBattleId?: string;
}

export default function CombatLogHistory({
  history,
  onSelectRematch,
  onClose,
  onResetSeed,
  onClearHistory,
  activeServantName,
  initialSelectedBattleId
}: CombatLogHistoryProps) {
  const [selectedBattleId, setSelectedBattleId] = useState<string>(
    initialSelectedBattleId || history[0]?.id || ''
  );
  const [filterOutcome, setFilterOutcome] = useState<'all' | 'victory' | 'defeat'>('all');
  const [selectedTurnTab, setSelectedTurnTab] = useState<'all' | number>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filtered battles
  const filteredBattles = history.filter(b => {
    if (filterOutcome === 'victory') return b.outcome === 'victory';
    if (filterOutcome === 'defeat') return b.outcome === 'defeat';
    return true;
  });

  const selectedBattle =
    history.find(b => b.id === selectedBattleId) ||
    filteredBattles[0] ||
    history[0];

  // Stats calculation
  const totalBattles = history.length;
  const victoriesCount = history.filter(b => b.outcome === 'victory').length;
  const defeatsCount = history.filter(b => b.outcome === 'defeat').length;
  const winRate = totalBattles > 0 ? Math.round((victoriesCount / totalBattles) * 100) : 0;
  const totalDamageDealt = history.reduce((sum, b) => sum + (b.totalDamageDealt || 0), 0);
  const totalTurnsFought = history.reduce((sum, b) => sum + (b.totalTurns || 0), 0);

  const [currentTime] = useState<number>(() => Date.now());

  const formatTimestamp = (timestamp: number) => {
    const diffMs = Math.max(0, currentTime - timestamp);
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const handleCopyLog = (battle: CombatBattleRecord) => {
    let text = `=== FUYUKI COMBAT LOG: ${battle.player1.name} VS ${battle.player2.name} ===\n`;
    text += `Outcome: ${battle.outcome.toUpperCase()} (${battle.totalTurns} Turns)\n`;
    text += `Date: ${new Date(battle.timestamp).toLocaleString()}\n`;
    text += `Total Damage Dealt: ${battle.totalDamageDealt.toLocaleString()} | Taken: ${battle.totalDamageTaken.toLocaleString()}\n\n`;
    text += `--- TURN-BY-TURN BREAKDOWN ---\n`;

    battle.turns.forEach(turn => {
      text += `[Turn ${turn.turnNumber}] ${turn.actorName} -> ${turn.targetName}\n`;
      text += `  Cards: ${turn.cardsUsed?.join(' - ') || 'N/A'}${turn.cardChainType ? ` (${turn.cardChainType})` : ''}\n`;
      if (turn.skillsUsed && turn.skillsUsed.length > 0) {
        text += `  Skills: ${turn.skillsUsed.join(', ')}\n`;
      }
      if (turn.npTriggered && turn.npChant) {
        text += `  Noble Phantasm Chant: "${turn.npChant}"\n`;
      }
      text += `  Damage: ${turn.damageDealt.toLocaleString()}${turn.isCritical ? ' (CRITICAL!)' : ''}\n`;
      text += `  Result: ${turn.actionSummary}\n`;
      text += `  Target HP Remaining: ${turn.targetHpRemaining} / ${turn.targetHpMax}\n\n`;
    });

    navigator.clipboard.writeText(text);
    setCopiedId(battle.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Controls Bar */}
      <div className="p-5 bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-sm bg-[#161616] text-[#d4af37] border border-[#d4af37]/30">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-serif italic text-white tracking-wide">Combat Log History</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40 font-bold">
                Last {totalBattles} Battles
              </span>
            </div>
            <p className="text-[11px] font-mono text-white/40 uppercase tracking-wider">
              Turn-by-turn outcome review, card-chain sequences &amp; Noble Phantasm chants
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onClose && (
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-sm bg-[#161616] hover:bg-[#202020] text-white text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 border border-white/20 transition"
            >
              <Swords className="w-3.5 h-3.5 text-[#d4af37]" />
              Return to Duel
            </button>
          )}

          {onResetSeed && (
            <button
              onClick={onResetSeed}
              title="Reload sample battle history logs"
              className="px-3 py-1.5 rounded-sm bg-transparent hover:bg-[#161616] text-white/70 hover:text-white text-xs font-mono uppercase tracking-wider flex items-center gap-1 border border-white/10 transition"
            >
              <RotateCcw className="w-3 h-3 text-[#d4af37]" />
              Reset Samples
            </button>
          )}

          {onClearHistory && (
            <button
              onClick={onClearHistory}
              title="Clear stored battle logs"
              className="px-3 py-1.5 rounded-sm bg-transparent hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 text-xs font-mono uppercase tracking-wider flex items-center gap-1 border border-rose-900/30 transition"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Aggregate Statistics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-white/40">Win Ratio</div>
          <div className="text-xl font-serif italic text-white mt-1 flex items-baseline gap-2">
            <span className={winRate >= 50 ? 'text-[#10b981]' : 'text-rose-400'}>{winRate}%</span>
            <span className="text-[11px] font-mono text-white/40 font-normal">
              ({victoriesCount}W - {defeatsCount}L)
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-white/40">Total Battles</div>
          <div className="text-xl font-serif italic text-white mt-1 flex items-baseline gap-2">
            <span className="text-[#d4af37]">{totalBattles} / 10</span>
            <span className="text-[11px] font-mono text-white/40 font-normal">Recorded</span>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-white/40">Turns Fought</div>
          <div className="text-xl font-serif italic text-white mt-1 flex items-baseline gap-2">
            <span>{totalTurnsFought}</span>
            <span className="text-[11px] font-mono text-white/40 font-normal">
              (~{(totalTurnsFought / (totalBattles || 1)).toFixed(1)} / duel)
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-white/40">Damage Dealt</div>
          <div className="text-xl font-serif italic text-[#3b82f6] mt-1 flex items-baseline gap-1.5">
            <span>{totalDamageDealt.toLocaleString()}</span>
            <span className="text-[10px] font-mono text-white/40 uppercase">DMG</span>
          </div>
        </div>
      </div>

      {/* Main Master-Detail Layout: Left = Battle List, Right = Turn-by-Turn Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Recent Battles List (4 cols on lg) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Outcome Filter Tabs */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a]">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-white/40 ml-1.5" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 mr-1">Filter:</span>
              <button
                onClick={() => setFilterOutcome('all')}
                className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider rounded-sm transition ${
                  filterOutcome === 'all'
                    ? 'bg-[#d4af37] text-black font-bold'
                    : 'text-white/60 hover:text-white bg-[#141414]'
                }`}
              >
                All ({history.length})
              </button>
              <button
                onClick={() => setFilterOutcome('victory')}
                className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider rounded-sm transition ${
                  filterOutcome === 'victory'
                    ? 'bg-[#10b981] text-black font-bold'
                    : 'text-[#10b981]/70 hover:text-[#10b981] bg-[#141414]'
                }`}
              >
                Win ({victoriesCount})
              </button>
              <button
                onClick={() => setFilterOutcome('defeat')}
                className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider rounded-sm transition ${
                  filterOutcome === 'defeat'
                    ? 'bg-rose-600 text-white font-bold'
                    : 'text-rose-400/70 hover:text-rose-300 bg-[#141414]'
                }`}
              >
                Loss ({defeatsCount})
              </button>
            </div>
            <span className="text-[10px] font-mono text-white/40 mr-1">Max 10 Logs</span>
          </div>

          {/* Battles List Scroll */}
          <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
            {filteredBattles.length === 0 ? (
              <div className="p-8 text-center bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] text-white/50 text-xs font-mono">
                No battles found under this filter.
              </div>
            ) : (
              filteredBattles.map((battle, idx) => {
                const isSelected = selectedBattle?.id === battle.id;
                const isVictory = battle.outcome === 'victory';

                return (
                  <div
                    key={battle.id}
                    onClick={() => {
                      setSelectedBattleId(battle.id);
                      setSelectedTurnTab('all');
                    }}
                    className={`p-3.5 rounded-lg cursor-pointer transition-all border text-left relative ${
                      isSelected
                        ? 'bg-[#141414] border-[#d4af37] shadow-[0_0_15px_rgba(212,175,55,0.15)]'
                        : 'bg-[#0a0a0a] hover:bg-[#111] border-[#1a1a1a]'
                    }`}
                  >
                    {/* Top Row: Index, Outcome Pill, Timestamp */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-white/40 font-bold">
                          #{idx + 1}
                        </span>
                        <span
                          className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border ${
                            isVictory
                              ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/40'
                              : 'bg-rose-950/40 text-rose-400 border-rose-800/40'
                          }`}
                        >
                          {isVictory ? 'VICTORY' : 'DEFEAT'}
                        </span>
                        <span className="text-[10px] font-mono text-white/40">
                          {battle.totalTurns} {battle.totalTurns === 1 ? 'Turn' : 'Turns'}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-white/40 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(battle.timestamp)}
                      </span>
                    </div>

                    {/* Matchup Title */}
                    <div className="flex items-center justify-between gap-2 text-sm font-serif italic text-white">
                      <div className="truncate flex items-center gap-1.5">
                        <span className="text-[#d4af37] truncate">{battle.player1.name}</span>
                        <span className="text-white/30 text-xs font-mono not-italic font-normal">vs</span>
                        <span className="text-white/80 truncate">{battle.player2.name}</span>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 shrink-0 transition-transform ${
                          isSelected ? 'text-[#d4af37] translate-x-0.5' : 'text-white/30'
                        }`}
                      />
                    </div>

                    {/* Quick Metrics Footer */}
                    <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-white/50 mt-2.5 pt-2 border-t border-white/5">
                      <div className="flex items-center gap-3">
                        <span className="text-[#3b82f6]">
                          DMG: {battle.totalDamageDealt.toLocaleString()}
                        </span>
                        {battle.noblePhantasmsUsed > 0 && (
                          <span className="text-[#d4af37] flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" /> NP x{battle.noblePhantasmsUsed}
                          </span>
                        )}
                        {battle.criticalHitsLanded > 0 && (
                          <span className="text-amber-400">
                            Crit x{battle.criticalHitsLanded}
                          </span>
                        )}
                      </div>
                      <span className="text-white/40">
                        {battle.turns.length} Turn Logs
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Turn-by-Turn Outcome Inspector (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-4">
          {selectedBattle ? (
            <div className="p-6 bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] shadow-2xl space-y-6">
              {/* Selected Duel Overview Header */}
              <div className="border-b border-[#1a1a1a] pb-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-mono font-bold uppercase tracking-widest px-3 py-1 rounded-sm border ${
                        selectedBattle.outcome === 'victory'
                          ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/50 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                          : 'bg-rose-950/40 text-rose-400 border-rose-800/50'
                      }`}
                    >
                      {selectedBattle.outcome === 'victory' ? 'VICTORY ACHIEVED' : 'COMBAT DEFEAT'}
                    </span>
                    <span className="text-xs font-mono text-white/40">
                      {selectedBattle.totalTurns} Turns Duration • {formatTimestamp(selectedBattle.timestamp)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyLog(selectedBattle)}
                      className="px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider rounded-sm bg-[#161616] hover:bg-[#222] text-white/70 hover:text-white flex items-center gap-1.5 border border-white/10 transition"
                      title="Copy full turn-by-turn transcript"
                    >
                      {copiedId === selectedBattle.id ? (
                        <>
                          <Check className="w-3 h-3 text-[#10b981]" />
                          <span className="text-[#10b981]">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Log</span>
                        </>
                      )}
                    </button>

                    {onSelectRematch && (
                      <button
                        onClick={() => onSelectRematch(selectedBattle.player2.id)}
                        className="px-3 py-1 text-[11px] font-mono uppercase tracking-wider font-bold rounded-sm bg-[#d4af37] hover:bg-[#c49f27] text-black flex items-center gap-1 transition"
                      >
                        <Swords className="w-3 h-3" />
                        Rematch
                      </button>
                    )}
                  </div>
                </div>

                {/* Matchup Duelists Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  {/* Your Servant (Player 1) */}
                  <div className="p-3.5 rounded-lg bg-[#111] border border-[#1a1a1a]">
                    <div className="flex items-center justify-between text-[10px] font-mono text-white/40 mb-1">
                      <span>YOUR SERVANT</span>
                      <span className="text-[#d4af37]">{selectedBattle.player1.servantClass}</span>
                    </div>
                    <div className="text-sm font-serif italic text-white font-bold truncate">
                      {selectedBattle.player1.name}
                    </div>
                    <div className="text-[11px] font-mono text-white/40 truncate">
                      Master: {selectedBattle.player1.masterName}
                    </div>
                    <div className="mt-2 text-[11px] font-mono flex items-center justify-between text-white/70">
                      <span>Final HP:</span>
                      <span className={selectedBattle.player1.finalHp > 0 ? 'text-[#10b981]' : 'text-rose-400'}>
                        {selectedBattle.player1.finalHp.toLocaleString()} / {selectedBattle.player1.maxHp.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Rival Servant (Player 2) */}
                  <div className="p-3.5 rounded-lg bg-[#111] border border-[#1a1a1a]">
                    <div className="flex items-center justify-between text-[10px] font-mono text-white/40 mb-1">
                      <span>RIVAL SERVANT</span>
                      <span className="text-[#d4af37]">{selectedBattle.player2.servantClass}</span>
                    </div>
                    <div className="text-sm font-serif italic text-white font-bold truncate">
                      {selectedBattle.player2.name}
                    </div>
                    <div className="text-[11px] font-mono text-white/40 truncate">
                      Master: {selectedBattle.player2.masterName}
                    </div>
                    <div className="mt-2 text-[11px] font-mono flex items-center justify-between text-white/70">
                      <span>Final HP:</span>
                      <span className={selectedBattle.player2.finalHp > 0 ? 'text-white' : 'text-rose-400 font-bold'}>
                        {selectedBattle.player2.finalHp.toLocaleString()} / {selectedBattle.player2.maxHp.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Turn-by-Turn Filter / Selector Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-white/40 mr-1 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-[#d4af37]" /> Review Turns:
                  </span>
                  <button
                    onClick={() => setSelectedTurnTab('all')}
                    className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider rounded-sm transition ${
                      selectedTurnTab === 'all'
                        ? 'bg-[#d4af37] text-black font-bold'
                        : 'bg-[#141414] text-white/60 hover:text-white border border-[#222]'
                    }`}
                  >
                    All ({selectedBattle.turns.length})
                  </button>
                  {Array.from(new Set(selectedBattle.turns.map(t => t.turnNumber))).map(turnNum => (
                    <button
                      key={turnNum}
                      onClick={() => setSelectedTurnTab(turnNum)}
                      className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider rounded-sm transition ${
                        selectedTurnTab === turnNum
                          ? 'bg-[#d4af37] text-black font-bold'
                          : 'bg-[#141414] text-white/60 hover:text-white border border-[#222]'
                      }`}
                    >
                      Turn {turnNum}
                    </button>
                  ))}
                </div>
              </div>

              {/* Turn-by-Turn Detailed Feed */}
              <div className="space-y-3.5 max-h-[520px] overflow-y-auto pr-1">
                {selectedBattle.turns
                  .filter(turn => (selectedTurnTab === 'all' ? true : turn.turnNumber === selectedTurnTab))
                  .map((turn, tIdx) => {
                    const isP1 = turn.actorName === selectedBattle.player1.name;

                    return (
                      <div
                        key={tIdx}
                        className={`p-4 rounded-lg border transition-all ${
                          isP1
                            ? 'bg-[#0e0e0e] border-[#1f1f1f]'
                            : 'bg-[#110d0d] border-rose-950/40'
                        }`}
                      >
                        {/* Turn Header */}
                        <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-white/5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-[#1a1a1a] text-[#d4af37] font-bold">
                              TURN {turn.turnNumber}
                            </span>
                            <span className="text-xs font-serif italic text-white flex items-center gap-1.5">
                              <span className={isP1 ? 'text-[#d4af37] font-bold' : 'text-rose-400 font-bold'}>
                                {turn.actorName}
                              </span>
                              <span className="text-white/30 text-[11px] font-mono not-italic">attacks</span>
                              <span className="text-white/70">{turn.targetName}</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {turn.isCritical && (
                              <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                CRITICAL
                              </span>
                            )}
                            <span className="text-xs font-mono font-bold text-[#3b82f6]">
                              {turn.damageDealt.toLocaleString()} DMG
                            </span>
                          </div>
                        </div>

                        {/* Action Description */}
                        <p className="text-xs font-mono text-white/90 leading-relaxed mb-3">
                          {turn.actionSummary}
                        </p>

                        {/* Command Cards & Chain Badge */}
                        {turn.cardsUsed && turn.cardsUsed.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 mb-3 bg-black/40 p-2 rounded-sm border border-white/5">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">
                              Command Sequence:
                            </span>
                            <div className="flex items-center gap-1.5">
                              {turn.cardsUsed.map((c, cIdx) => (
                                <span
                                  key={cIdx}
                                  className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-sm border ${
                                    c === 'Buster'
                                      ? 'bg-rose-950/60 text-rose-400 border-rose-800/60'
                                      : c === 'Arts'
                                      ? 'bg-blue-950/60 text-blue-400 border-blue-800/60'
                                      : c === 'Quick'
                                      ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                                      : 'bg-[#d4af37]/20 text-[#d4af37] border-[#d4af37]/60'
                                  }`}
                                >
                                  {c}
                                </span>
                              ))}
                            </div>
                            {turn.cardChainType && turn.cardChainType !== 'Normal' && (
                              <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30 ml-auto">
                                {turn.cardChainType}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Mid-Battle Dialogue Cut-In Box */}
                        {(turn.dialogueQuote || (turn.npTriggered && turn.npChant)) && (
                          <div className="p-3 rounded-lg bg-[#140d0a] border border-[#d4af37]/60 mb-3 relative overflow-hidden shadow-[0_0_15px_rgba(212,175,55,0.15)]">
                            <div className="flex items-center justify-between text-[10px] font-mono text-[#d4af37] mb-1.5 font-bold tracking-wider">
                              <span className="uppercase flex items-center gap-1.5 text-[#f59e0b]">
                                <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
                                {turn.dialogueTag || (turn.npTriggered ? 'NOBLE PHANTASM RELEASE' : 'MID-BATTLE DIALOGUE')}
                              </span>
                              <span className="text-[#d4af37] px-2 py-0.5 rounded-sm bg-[#24150b] border border-[#d4af37]/40">
                                {turn.actorName}
                              </span>
                            </div>
                            <div className="text-[#fef08a] font-serif italic text-xs leading-relaxed pl-1">
                              &quot;{turn.dialogueQuote || turn.npChant}&quot;
                            </div>
                          </div>
                        )}

                        {/* Skills Used */}
                        {turn.skillsUsed && turn.skillsUsed.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 mb-2.5 text-[10px] font-mono">
                            <span className="text-white/40">Skills:</span>
                            {turn.skillsUsed.map((sk, sIdx) => (
                              <span
                                key={sIdx}
                                className="px-2 py-0.5 rounded-sm bg-[#161616] text-[#d4af37] border border-[#d4af37]/30"
                              >
                                {sk}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Turn Outcome HP & NP Snapshot */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-[10px] font-mono text-white/50">
                          <div>
                            <span className="text-white/40">{turn.actorName}:</span>{' '}
                            <span className="text-white font-bold">
                              {turn.actorHpRemaining.toLocaleString()} HP
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-white/40">{turn.targetName}:</span>{' '}
                            <span className={turn.targetHpRemaining <= 0 ? 'text-rose-400 font-bold' : 'text-white font-bold'}>
                              {turn.targetHpRemaining.toLocaleString()} HP
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] text-white/40 text-xs font-mono">
              Select a battle from the list to review its turn-by-turn combat log.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
