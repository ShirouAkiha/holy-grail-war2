'use client';

import React, { useState } from 'react';
import {
  ActiveCombatant,
  BattleState,
  CardType,
  CombatBattleRecord,
  MasterProfile,
  MasterServantInstance
} from '../lib/types';
import {
  createCombatantFromMasterServant,
  initializeBattle,
  executeBattleTurn,
  calculateClassMultiplier
} from '../lib/engine/battle';
import {
  loadCombatBattleHistory,
  saveCombatBattleRecord,
  createRecordFromFinishedBattle,
  clearCombatBattleHistory,
  resetSeedCombatBattleHistory
} from '../lib/engine/combatHistory';
import CombatLogHistory from './CombatLogHistory';
import { SERVANT_DATABASE } from '../lib/data/servants';
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
  BookOpen
} from 'lucide-react';

interface CombatArenaProps {
  master: MasterProfile;
  onUpdateMaster: (master: MasterProfile) => void;
}

export default function CombatArena({ master, onUpdateMaster }: CombatArenaProps) {
  const activeServant = master.servants.find(s => s.id === master.activeServantId) || master.servants[0];

  // Enemy selection
  const [selectedEnemyId, setSelectedEnemyId] = useState<string>('gilgamesh_archer');
  const enemyTemplate = SERVANT_DATABASE.find(s => s.id === selectedEnemyId) || SERVANT_DATABASE[1];

  const setupNewBattle = (opponentTemplate = enemyTemplate) => {
    if (!activeServant) return null;
    const p1 = createCombatantFromMasterServant(activeServant, master.username);
    const p2 = createCombatantFromMasterServant(
      {
        id: 'cpu_servant',
        masterId: 'cpu_master',
        templateId: opponentTemplate.id,
        level: 30,
        experience: 0,
        allocatedStats: { strength: 4, endurance: 3, agility: 3, mana: 4, luck: 2 },
        availableStatPoints: 0,
        skillLevels: [5, 5, 5],
        customQuotes: {
          summon: opponentTemplate.summonQuote,
          battleStart: opponentTemplate.battleStartQuote,
          noblePhantasm: opponentTemplate.noblePhantasm.chant,
          victory: opponentTemplate.victoryQuote,
          defeat: opponentTemplate.defeatQuote
        },
        bondLevel: 5,
        template: opponentTemplate
      },
      'Rival Master Kotomine'
    );
    return initializeBattle(p1, p2);
  };

  const [battle, setBattle] = useState<BattleState | null>(() => setupNewBattle());
  const [selectedCards, setSelectedCards] = useState<CardType[]>([]);
  const [useNp, setUseNp] = useState(false);
  const [selectedSkillIdx, setSelectedSkillIdx] = useState<number | undefined>();
  const [selectedCommandSeal, setSelectedCommandSeal] = useState<'heal' | 'np_charge' | undefined>();
  const [isSimulating, setIsSimulating] = useState(false);

  // Combat Log History state (Last 10 battles)
  const [arenaTab, setArenaTab] = useState<'duel' | 'history'>('duel');
  const [battleHistory, setBattleHistory] = useState<CombatBattleRecord[]>(() => loadCombatBattleHistory());
  const [lastCompletedBattleId, setLastCompletedBattleId] = useState<string | undefined>();

  if (!activeServant || !battle) {
    return (
      <div className="p-8 text-center bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] text-[#e5e5e5]">
        <Swords className="w-12 h-12 text-[#d4af37] mx-auto mb-3 opacity-80" />
        <h3 className="text-xl font-serif italic text-white mb-2">No Active Servant</h3>
        <p className="text-xs text-white/40 font-mono">Summon a Servant first from the Gacha portal to enter combat!</p>
      </div>
    );
  }

  const p1 = battle.player1;
  const p2 = battle.player2;
  const classMultiplier = calculateClassMultiplier(p1.servantClass, p2.servantClass);

  const handleCardClick = (card: CardType) => {
    if (selectedCards.length < 3) {
      setSelectedCards(prev => [...prev, card]);
    }
  };

  const handleClearCards = () => {
    setSelectedCards([]);
  };

  const handleQuickPreset = (preset: 'Buster Brave' | 'Arts Chain' | 'Quick Chain') => {
    if (preset === 'Buster Brave') setSelectedCards(['Buster', 'Buster', 'Buster']);
    if (preset === 'Arts Chain') setSelectedCards(['Arts', 'Arts', 'Arts']);
    if (preset === 'Quick Chain') setSelectedCards(['Quick', 'Quick', 'Quick']);
  };

  const handleExecuteTurn = () => {
    if (selectedCards.length < 3 && !useNp) return;

    setIsSimulating(true);
    // AI enemy card decision
    const aiDeck = p2.commandDeck;
    const shuffled = [...aiDeck].sort(() => 0.5 - Math.random());
    const aiCards = (shuffled.slice(0, 3) as CardType[]) || ['Buster', 'Arts', 'Quick'];
    const aiUseNp = p2.npGauge >= 100 && Math.random() > 0.3;

    setTimeout(() => {
      const { updatedState } = executeBattleTurn(
        battle,
        {
          combatantId: p1.id,
          selectedCards: selectedCards.length === 3 ? selectedCards : ['Buster', 'Arts', 'Quick'],
          useNoblePhantasm: useNp,
          useSkillIndex: selectedSkillIdx,
          useCommandSeal: selectedCommandSeal
        },
        {
          combatantId: p2.id,
          selectedCards: aiCards,
          useNoblePhantasm: aiUseNp
        }
      );

      if (selectedCommandSeal) {
        onUpdateMaster({
          ...master,
          commandSeals: Math.max(0, (master.commandSeals ?? 3) - 1)
        });
      }

      setBattle(updatedState);
      setSelectedCards([]);
      setUseNp(false);
      setSelectedSkillIdx(undefined);
      setSelectedCommandSeal(undefined);
      setIsSimulating(false);

      if (updatedState.turnPhase === 'victory') {
        onUpdateMaster({
          ...master,
          saintQuartz: master.saintQuartz + 3,
          grailWarWins: master.grailWarWins + 1
        });
      }

      // Automatically record concluded battle into combat log history (max 10)
      if (updatedState.turnPhase === 'victory' || updatedState.turnPhase === 'defeat') {
        const record = createRecordFromFinishedBattle(updatedState, updatedState.turnPhase);
        const updatedHistory = saveCombatBattleRecord(record);
        setBattleHistory(updatedHistory);
        setLastCompletedBattleId(record.id);
      }
    }, 400);
  };

  const handleRestart = () => {
    setBattle(setupNewBattle());
    setSelectedCards([]);
    setUseNp(false);
    setSelectedSkillIdx(undefined);
  };

  return (
    <div className="space-y-6">
      {/* Top Arena Navigation Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1a1a1a] pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setArenaTab('duel')}
            className={`px-4 py-2 rounded-sm text-xs font-mono uppercase tracking-wider flex items-center gap-2 transition ${
              arenaTab === 'duel'
                ? 'bg-[#d4af37] text-black font-bold shadow-[0_0_12px_rgba(212,175,55,0.2)]'
                : 'bg-[#111] text-white/60 hover:text-white border border-[#1a1a1a]'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            Live Arena Duel
          </button>
          <button
            onClick={() => setArenaTab('history')}
            className={`px-4 py-2 rounded-sm text-xs font-mono uppercase tracking-wider flex items-center gap-2 transition ${
              arenaTab === 'history'
                ? 'bg-[#d4af37] text-black font-bold shadow-[0_0_12px_rgba(212,175,55,0.2)]'
                : 'bg-[#111] text-white/60 hover:text-white border border-[#1a1a1a]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Combat Log History
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1 ${
                arenaTab === 'history' ? 'bg-black text-[#d4af37]' : 'bg-[#1a1a1a] text-[#d4af37]'
              }`}
            >
              {battleHistory.length}
            </span>
          </button>
        </div>

        {arenaTab === 'duel' && (
          <button
            onClick={() => setArenaTab('history')}
            className="text-[11px] font-mono text-white/50 hover:text-[#d4af37] flex items-center gap-1.5 transition"
          >
            <span>Review Last 10 Battles</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* When Combat Log History Tab is Active */}
      {arenaTab === 'history' ? (
        <CombatLogHistory
          history={battleHistory}
          initialSelectedBattleId={lastCompletedBattleId}
          activeServantName={activeServant.template.name}
          onSelectRematch={enemyTemplateId => {
            const opp = SERVANT_DATABASE.find(s => s.id === enemyTemplateId);
            if (opp) {
              setSelectedEnemyId(opp.id);
              setBattle(setupNewBattle(opp));
            } else {
              setBattle(setupNewBattle());
            }
            setSelectedCards([]);
            setUseNp(false);
            setSelectedSkillIdx(undefined);
            setArenaTab('duel');
          }}
          onClose={() => setArenaTab('duel')}
          onResetSeed={() => {
            const reset = resetSeedCombatBattleHistory();
            setBattleHistory(reset);
          }}
          onClearHistory={() => {
            clearCombatBattleHistory();
            setBattleHistory([]);
          }}
        />
      ) : (
        <>
          {/* Top Arena Header & Opponent Select */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#0a0a0a] rounded-xl border border-[#1a1a1a]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-sm bg-[#161616] text-[#d4af37] border border-[#d4af37]/30">
                <Swords className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-serif italic text-white tracking-wide">Fuyuki Combat Arena</h2>
                <p className="text-[11px] font-mono text-white/40 uppercase tracking-wider">
                  Turn {battle.currentTurn} • Tactical Card-Chain RPG
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-[11px] font-mono text-white/40 uppercase tracking-wider">Rival:</div>
              <select
                value={selectedEnemyId}
                onChange={e => {
                  setSelectedEnemyId(e.target.value);
                  const opp = SERVANT_DATABASE.find(s => s.id === e.target.value);
                  if (opp) setBattle(setupNewBattle(opp));
                }}
                className="bg-[#111] text-white text-xs px-3 py-1.5 rounded-sm border border-[#222] outline-none font-mono focus:border-[#d4af37]"
              >
                {SERVANT_DATABASE.filter(s => s.id !== activeServant.template.id).map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.servantClass} • {s.rarity}★)
                  </option>
                ))}
              </select>

              <button
                onClick={handleRestart}
                className="px-3 py-1.5 rounded-sm bg-transparent hover:bg-[#161616] text-white/70 hover:text-white text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 border border-white/20 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          </div>

      {/* Battle Stage Split Screen */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Player 1 Card */}
        <div className="p-6 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 px-3 py-1 bg-[#161616] text-[#d4af37] text-[10px] font-mono uppercase tracking-widest border-l border-b border-[#1a1a1a]">
            YOUR SERVANT • {p1.servantClass}
          </div>

          <div className="flex items-center gap-4 mb-5 mt-2">
            <div className="w-14 h-14 rounded-sm bg-[#161616] border border-[#d4af37]/40 flex items-center justify-center text-xl text-[#d4af37]">
              ⚔️
            </div>
            <div>
              <h3 className="text-lg font-serif italic text-white">{p1.name}</h3>
              <p className="text-xs text-white/40 font-mono">Master: {p1.masterName}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-[#111] text-[#3b82f6] border border-[#3b82f6]/30">
                  ATK: {p1.atk.toLocaleString()}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-[#111] text-[#22c55e] border border-[#22c55e]/30">
                  DEF: {p1.def.toLocaleString()}
                </span>
                {classMultiplier > 1 && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/40">
                    Advantage 1.5x
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* HP Bar */}
          <div className="space-y-1.5 mb-4">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-white/40 uppercase tracking-wider">HP</span>
              <span className="text-white font-bold">
                {p1.currentHp.toLocaleString()} / {p1.maxHp.toLocaleString()}
              </span>
            </div>
            <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  p1.currentHp / p1.maxHp > 0.3 ? 'bg-[#22c55e]' : 'bg-[#ef4444]'
                }`}
                style={{ width: `${Math.max(0, (p1.currentHp / p1.maxHp) * 100)}%` }}
              />
            </div>
          </div>

          {/* NP Gauge */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-[#d4af37] flex items-center gap-1 uppercase tracking-wider">
                <Sparkles className="w-3 h-3" /> NP Gauge
              </span>
              <span className="text-[#d4af37] font-bold">{Math.round(p1.npGauge)}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#d4af37] shadow-[0_0_8px_#d4af37] transition-all duration-300"
                style={{ width: `${Math.min(100, (p1.npGauge / 100) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Player 2 (Enemy) Card */}
        <div className="p-6 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 px-3 py-1 bg-[#161616] text-[#ef4444] text-[10px] font-mono uppercase tracking-widest border-l border-b border-[#1a1a1a]">
            OPPONENT • {p2.servantClass}
          </div>

          <div className="flex items-center gap-4 mb-5 mt-2">
            <div className="w-14 h-14 rounded-sm bg-[#161616] border border-[#ef4444]/40 flex items-center justify-center text-xl text-[#ef4444]">
              💀
            </div>
            <div>
              <h3 className="text-lg font-serif italic text-white">{p2.name}</h3>
              <p className="text-xs text-white/40 font-mono">Master: {p2.masterName}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-[#111] text-[#ef4444] border border-[#ef4444]/30">
                  ATK: {p2.atk.toLocaleString()}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-[#111] text-[#22c55e] border border-[#22c55e]/30">
                  DEF: {p2.def.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* HP Bar */}
          <div className="space-y-1.5 mb-4">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-white/40 uppercase tracking-wider">HP</span>
              <span className="text-white font-bold">
                {p2.currentHp.toLocaleString()} / {p2.maxHp.toLocaleString()}
              </span>
            </div>
            <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  p2.currentHp / p2.maxHp > 0.3 ? 'bg-[#22c55e]' : 'bg-[#ef4444]'
                }`}
                style={{ width: `${Math.max(0, (p2.currentHp / p2.maxHp) * 100)}%` }}
              />
            </div>
          </div>

          {/* NP Gauge */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-[#d4af37] flex items-center gap-1 uppercase tracking-wider">
                <Sparkles className="w-3 h-3" /> NP Gauge
              </span>
              <span className="text-[#d4af37] font-bold">{Math.round(p2.npGauge)}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#d4af37] shadow-[0_0_8px_#d4af37] transition-all duration-300"
                style={{ width: `${Math.min(100, (p2.npGauge / 100) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Victory / Defeat Overlay */}
      {(battle.turnPhase === 'victory' || battle.turnPhase === 'defeat') && (
        <div
          className={`p-8 rounded-xl border text-center shadow-2xl ${
            battle.turnPhase === 'victory'
              ? 'bg-[#0a0a0a] border-[#d4af37]/50 text-[#e5e5e5]'
              : 'bg-[#0a0a0a] border-[#ef4444]/50 text-[#e5e5e5]'
          }`}
        >
          <div className="inline-flex p-3.5 rounded-sm bg-[#161616] border border-white/10 mb-4">
            {battle.turnPhase === 'victory' ? <Award className="w-8 h-8 text-[#d4af37]" /> : <Skull className="w-8 h-8 text-[#ef4444]" />}
          </div>
          <h3 className="text-2xl font-serif italic text-white mb-2">
            {battle.turnPhase === 'victory' ? 'VICTORY ACHIEVED' : 'DEFEAT'}
          </h3>
          <p className="text-xs font-mono text-white/60 max-w-md mx-auto mb-6">
            {battle.turnPhase === 'victory'
              ? `Your Servant ${p1.name} has claimed triumph. Rewards: +3 Saint Quartz & +1 Grail War Victory.`
              : `${p2.name} overwhelmed your defense. Fortify your stats in the workshop and retry.`}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handleRestart}
              className="px-6 py-2.5 rounded-sm bg-[#d4af37] hover:bg-[#c49f27] text-black font-bold text-xs uppercase tracking-wider shadow-lg transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Rematch Duel
            </button>
            <button
              onClick={() => setArenaTab('history')}
              className="px-6 py-2.5 rounded-sm bg-[#161616] hover:bg-[#222] text-[#d4af37] border border-[#d4af37]/40 font-bold text-xs uppercase tracking-wider shadow-lg transition flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Review Turn-by-Turn Combat Log
            </button>
          </div>
        </div>
      )}

      {/* Combat Command Controller */}
      {battle.turnPhase !== 'victory' && battle.turnPhase !== 'defeat' && (
        <div className="p-6 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] shadow-2xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1a1a1a] pb-4">
            <div>
              <h3 className="text-sm font-serif italic text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#d4af37]" /> Command Card Sequence (3 Cards)
              </h3>
              <p className="text-[11px] font-mono text-white/40 mt-0.5">
                Select 3 cards to chain tactical Buster / Arts / Quick multipliers
              </p>
            </div>

            {/* Quick Chain Presets */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">Presets:</span>
              <button
                onClick={() => handleQuickPreset('Buster Brave')}
                className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider font-bold rounded-sm bg-[#220000] text-[#ef4444] border border-[#ef4444]/40 hover:bg-[#330000] transition"
              >
                Buster x3
              </button>
              <button
                onClick={() => handleQuickPreset('Arts Chain')}
                className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider font-bold rounded-sm bg-[#001133] text-[#3b82f6] border border-[#3b82f6]/40 hover:bg-[#001c4d] transition"
              >
                Arts x3
              </button>
              <button
                onClick={() => handleQuickPreset('Quick Chain')}
                className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider font-bold rounded-sm bg-[#002200] text-[#22c55e] border border-[#22c55e]/40 hover:bg-[#003300] transition"
              >
                Quick x3
              </button>
            </div>
          </div>

          {/* Active 3-card slots */}
          <div className="flex items-center justify-center gap-4">
            {[0, 1, 2].map(idx => {
              const card = selectedCards[idx];
              return (
                <div
                  key={idx}
                  className={`w-28 h-36 rounded-lg border flex flex-col items-center justify-center p-3 transition-all ${
                    card === 'Buster'
                      ? 'bg-[#220000] border-[#ef4444]/60 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                      : card === 'Arts'
                      ? 'bg-[#001133] border-[#3b82f6]/60 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                      : card === 'Quick'
                      ? 'bg-[#002200] border-[#22c55e]/60 shadow-[0_0_12px_rgba(34,197,94,0.2)]'
                      : 'bg-[#0f0f0f] border-dashed border-[#222]'
                  }`}
                >
                  {card ? (
                    <>
                      <span className={`text-[10px] font-mono font-bold uppercase tracking-widest ${
                        card === 'Buster' ? 'text-[#ef4444]' : card === 'Arts' ? 'text-[#3b82f6]' : 'text-[#22c55e]'
                      }`}>
                        {card}
                      </span>
                      <span className="text-[9px] font-mono text-white/50 mt-1">
                        {card === 'Buster' ? 'DMG +50%' : card === 'Arts' ? 'NP +30%' : 'Crit +40%'}
                      </span>
                    </>
                  ) : (
                    <span className="text-[10px] font-mono text-white/20 uppercase tracking-wider">Slot #{idx + 1}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Card Hand Selector */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {p1.commandDeck.map((card, idx) => (
              <button
                key={idx}
                disabled={selectedCards.length >= 3}
                onClick={() => handleCardClick(card)}
                className={`px-4 py-2 rounded-sm font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 border transition disabled:opacity-30 disabled:cursor-not-allowed ${
                  card === 'Buster'
                    ? 'bg-[#220000] hover:bg-[#330000] text-[#ef4444] border-[#ef4444]/40'
                    : card === 'Arts'
                    ? 'bg-[#001133] hover:bg-[#001c4d] text-[#3b82f6] border-[#3b82f6]/40'
                    : 'bg-[#002200] hover:bg-[#003300] text-[#22c55e] border-[#22c55e]/40'
                }`}
              >
                <span>{card} Card</span>
              </button>
            ))}

            <button
              onClick={handleClearCards}
              className="px-3.5 py-2 rounded-sm bg-transparent hover:bg-[#161616] text-white/60 hover:text-white text-xs font-mono uppercase tracking-wider border border-white/20"
            >
              Clear
            </button>
          </div>

          {/* Active Skills & Noble Phantasm Triggers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#1a1a1a]">
            {/* Active Skills */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Active Skills:</span>
              <div className="flex flex-wrap gap-2">
                {p1.skills.map((sk, idx) => (
                  <button
                    key={sk.id}
                    disabled={sk.currentCooldown > 0}
                    onClick={() => setSelectedSkillIdx(selectedSkillIdx === idx ? undefined : idx)}
                    className={`px-3 py-1.5 rounded-sm text-xs font-mono transition border ${
                      selectedSkillIdx === idx
                        ? 'bg-[#d4af37] text-black border-[#d4af37] font-bold'
                        : sk.currentCooldown > 0
                        ? 'bg-[#111] text-white/20 border-[#1a1a1a] cursor-not-allowed'
                        : 'bg-[#111] hover:bg-[#161616] text-white/80 border-[#222]'
                    }`}
                  >
                    <span>{sk.icon} </span>
                    <span>{sk.name}</span>
                    {sk.currentCooldown > 0 && <span className="text-[10px] text-white/40"> ({sk.currentCooldown}t)</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Noble Phantasm & Command Seals Activation */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Noble Phantasm & Seals:</span>
                <span className="text-[10px] font-mono text-rose-400">🔴 {master.commandSeals ?? 3}/3 Seals</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  disabled={p1.npGauge < 100}
                  onClick={() => setUseNp(!useNp)}
                  className={`py-2 px-3 rounded-sm text-xs font-mono uppercase tracking-wider flex items-center justify-between border transition ${
                    useNp
                      ? 'bg-[#d4af37] text-black border-[#d4af37] font-bold shadow-[0_0_12px_#d4af37]'
                      : p1.npGauge >= 100
                      ? 'bg-[#ef4444]/20 hover:bg-[#ef4444]/30 text-[#ef4444] border-[#ef4444]/50'
                      : 'bg-[#111] text-white/30 border-[#1a1a1a] cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-serif italic capitalize not-italic truncate">{p1.noblePhantasm.name}</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-black/40 font-mono ml-1">
                    {p1.npGauge >= 100 ? 'READY' : `${Math.round(p1.npGauge)}%`}
                  </span>
                </button>

                <button
                  disabled={(master.commandSeals ?? 3) <= 0 || p1.npGauge >= 100}
                  onClick={() => setSelectedCommandSeal(selectedCommandSeal ? undefined : 'np_charge')}
                  className={`py-2 px-3 rounded-sm text-xs font-mono tracking-wider flex items-center justify-between border transition ${
                    selectedCommandSeal
                      ? 'bg-rose-600 text-white border-rose-400 font-bold shadow-[0_0_12px_rgba(225,29,72,0.5)]'
                      : (master.commandSeals ?? 3) <= 0 || p1.npGauge >= 100
                      ? 'bg-[#111] text-white/30 border-[#1a1a1a] cursor-not-allowed'
                      : 'bg-[#111] hover:bg-[#161616] text-rose-400 border-rose-900/50'
                  }`}
                >
                  <span className="truncate">🔴 Refill NP (1 Seal)</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-black/40 font-mono ml-1">100% NP</span>
                </button>
              </div>
            </div>
          </div>

          {/* Turn Execution Submit Button */}
          <div className="pt-2">
            <button
              disabled={selectedCards.length < 3 && !useNp}
              onClick={handleExecuteTurn}
              className="w-full py-3 rounded-sm bg-[#d4af37] hover:bg-[#c49f27] text-black font-bold text-xs font-mono uppercase tracking-widest shadow-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSimulating ? (
                <span>Resolving Turn Clash...</span>
              ) : (
                <>
                  <span>Execute Turn {battle.currentTurn} Clash</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Battle Log History */}
      {battle.turnHistory.length > 0 && (
        <div className="p-6 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono uppercase tracking-widest text-white/40 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#d4af37]" /> Current Clash Logs
            </h4>
            <button
              onClick={() => setArenaTab('history')}
              className="text-[11px] font-mono text-[#d4af37] hover:underline flex items-center gap-1 transition"
            >
              <BookOpen className="w-3 h-3" />
              <span>Review Past 10 Battles History</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto font-mono text-xs">
            {battle.turnHistory.slice(-6).map((log, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-sm bg-[#111] border border-[#1a1a1a] flex items-start gap-2.5 text-white/80"
              >
                <span className="text-[#d4af37] font-bold">T{log.turnNumber}:</span>
                <div className="flex-1">
                  <div>{log.actionSummary}</div>
                  {log.npChant && (
                    <div className="text-[#d4af37] italic text-[11px] mt-0.5">
                      &quot;{log.npChant}&quot;
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
