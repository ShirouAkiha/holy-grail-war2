'use client';

import React, { useState } from 'react';
import {
  HolyGrailWarSession,
  MasterProfile,
  WarMasterParticipant
} from '../lib/types';
import {
  executeWarAction,
  simulateWarSkirmish,
  createHolyGrailWarSession,
  attackSuspectUserInWar,
  leakIntelInWar,
  exposeMasterInWar
} from '../lib/engine/grailwar';
import {
  Castle,
  Shield,
  Zap,
  Users,
  Swords,
  Heart,
  Skull,
  Handshake,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Trophy,
  Flame,
  Radio,
  Eye,
  EyeOff,
  UserX,
  FileText,
  Send,
  Crosshair
} from 'lucide-react';

interface GrailWarSimProps {
  master: MasterProfile;
  grailWar: HolyGrailWarSession;
  onUpdateGrailWar: (war: HolyGrailWarSession) => void;
  onUpdateMaster: (master: MasterProfile) => void;
  onStartDuelWithRival?: (rivalParticipant: WarMasterParticipant) => void;
}

export default function GrailWarSim({
  master,
  grailWar,
  onUpdateGrailWar,
  onUpdateMaster,
  onStartDuelWithRival
}: GrailWarSimProps) {
  const activeServant = master.servants.find(s => s.id === master.activeServantId) || master.servants[0];
  const userParticipant = grailWar.participants[master.discordId];

  const [selectedTargetMasterId, setSelectedTargetMasterId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [activeBoardTab, setActiveBoardTab] = useState<'roster' | 'leaks' | 'casualties'>('roster');

  // Ambush & Leak Form State
  const [showAmbushModal, setShowAmbushModal] = useState(false);
  const [ambushInput, setAmbushInput] = useState('');
  const [showLeakModal, setShowLeakModal] = useState(false);
  const [leakTextInput, setLeakTextInput] = useState('');
  const [leakTargetInput, setLeakTargetInput] = useState('');

  const handleAction = (actionType: any, targetParam?: string) => {
    const res = executeWarAction(grailWar, master.discordId, actionType, targetParam);
    onUpdateGrailWar(res.updatedWar);
    setActionFeedback(res.message);
    setTimeout(() => setActionFeedback(null), 6000);
  };

  const handleAmbushSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ambushInput.trim()) return;
    const res = attackSuspectUserInWar(grailWar, master.discordId, ambushInput.trim());
    onUpdateGrailWar(res.updatedWar);
    setActionFeedback(res.message);
    setShowAmbushModal(false);
    setAmbushInput('');
    setTimeout(() => setActionFeedback(null), 7000);
  };

  const handleLeakSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leakTextInput.trim()) return;
    const res = leakIntelInWar(grailWar, master.username, leakTextInput.trim(), leakTargetInput.trim() || undefined);
    onUpdateGrailWar(res.updatedWar);
    setActionFeedback(res.message);
    setShowLeakModal(false);
    setLeakTextInput('');
    setLeakTargetInput('');
    setTimeout(() => setActionFeedback(null), 7000);
  };

  const handleSimulateSkirmish = () => {
    const res = simulateWarSkirmish(grailWar);
    onUpdateGrailWar(res.updatedWar);
    setActionFeedback(res.message);
    setTimeout(() => setActionFeedback(null), 6000);
  };

  const handleResetWar = () => {
    if (!activeServant) return;
    const newSession = createHolyGrailWarSession({
      discordId: master.discordId,
      username: master.username,
      servantId: activeServant.id,
      servantName: activeServant.template.name,
      avatarUrl: activeServant.template.avatarUrl,
      maxHp: activeServant.template.baseHp
    });
    onUpdateGrailWar(newSession);
    setActionFeedback('New 7-Master Holy Grail War tournament initialized in strict secrecy!');
    setSelectedTargetMasterId(null);
  };

  const aliveParticipants = Object.values(grailWar.participants).filter(p => p.isAlive);
  const exposedParticipants = Object.values(grailWar.participants).filter(p => p.isExposed);
  const hiddenCount = aliveParticipants.filter(p => !p.isExposed && p.discordId !== master.discordId).length;
  const userAlliance = userParticipant?.allianceId ? grailWar.alliances[userParticipant.allianceId] : null;
  const winner = grailWar.grailWinnerId ? grailWar.participants[grailWar.grailWinnerId] : null;

  return (
    <div className="space-y-6">
      {/* War Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-sm bg-[#161616] text-[#d4af37] border border-[#d4af37]/30">
            <Castle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-serif italic text-white tracking-wide">{grailWar.title}</h2>
              <span
                className={`px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest rounded-sm border ${
                  grailWar.status === 'concluded'
                    ? 'bg-[#d4af37]/20 text-[#d4af37] border-[#d4af37]/40'
                    : 'bg-[#161616] text-[#22c55e] border-[#22c55e]/30'
                }`}
              >
                {grailWar.status === 'concluded' ? '🏆 CONCLUDED' : '🟢 ACTIVE WAR'}
              </span>
            </div>
            <p className="text-[11px] font-mono text-white/40 uppercase tracking-wider mt-0.5">
              Secret Intelligence Status Board • {aliveParticipants.length}/7 Masters Alive • {exposedParticipants.length} Exposed
            </p>
          </div>
        </div>

        {/* Master Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowAmbushModal(true)}
            className="px-3 py-1.5 rounded-sm bg-[#220000] hover:bg-[#330000] text-rose-400 border border-rose-500/40 text-xs font-mono uppercase tracking-wider font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <Crosshair className="w-3.5 h-3.5 text-rose-400" />
            <span>Ambush Suspect</span>
          </button>

          <button
            onClick={() => setShowLeakModal(true)}
            className="px-3 py-1.5 rounded-sm bg-[#1a0f2e] hover:bg-[#251642] text-purple-300 border border-purple-500/40 text-xs font-mono uppercase tracking-wider font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <Radio className="w-3.5 h-3.5 text-purple-400" />
            <span>Leak Intel</span>
          </button>

          <button
            onClick={() => handleAction('rest_and_heal')}
            className="px-3 py-1.5 rounded-sm bg-[#111] hover:bg-[#161616] text-[#22c55e] border border-[#22c55e]/40 text-xs font-mono uppercase tracking-wider font-bold transition flex items-center gap-1.5"
          >
            <Heart className="w-3.5 h-3.5" />
            <span>Channel Mana</span>
          </button>

          <button
            disabled={grailWar.status === 'concluded' || aliveParticipants.length <= 1}
            onClick={handleSimulateSkirmish}
            className="px-3.5 py-1.5 rounded-sm bg-[#d4af37] hover:bg-[#c49f27] text-black font-bold text-xs font-mono uppercase tracking-wider shadow-lg transition flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Simulate Skirmish</span>
          </button>
        </div>
      </div>

      {/* Intelligence Rule Banner */}
      <div className="p-4 rounded-xl bg-[#111] border border-[#1a1a1a] flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-sm bg-[#161616] text-[#d4af37] border border-[#d4af37]/20">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="text-white font-medium">Secrecy of Magecraft Protocol:</div>
            <p className="text-white/50 text-[11px] mt-0.5">
              Master identities remain concealed in the shadows until exposed by: public command usage, tactical ambush clashes, civilian collateral damage, or intelligence leaks.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
            <span className="text-white/60">Exposed: <strong>{exposedParticipants.length}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#64748b]" />
            <span className="text-white/60">In Shadows: <strong>{hiddenCount}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="text-white/60">Civilian Deaths: <strong>{grailWar.innocentVictims?.length || 0}</strong></span>
          </div>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionFeedback && (
        <div className="p-3.5 rounded-sm bg-[#161616] border border-[#d4af37]/40 text-[#d4af37] text-xs font-mono flex items-center gap-2 animate-in fade-in">
          <Sparkles className="w-4 h-4 text-[#d4af37] flex-shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Holy Grail Victory Banner if Concluded */}
      {grailWar.status === 'concluded' && winner && (
        <div className="p-6 rounded-xl bg-gradient-to-r from-[#161616] via-[#221c08] to-[#161616] border-2 border-[#d4af37] text-center space-y-2 shadow-[0_0_24px_rgba(212,175,55,0.25)]">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40">
            <Trophy className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-serif italic text-[#d4af37]">THE HOLY GRAIL HAS MANIFESTED</h3>
          <p className="text-sm text-white font-medium">
            Sole Surviving Master: <strong>{winner.username}</strong> with <strong>{winner.servantName}</strong> ({winner.servantClass})
          </p>
          <p className="text-xs font-mono text-white/50">
            All other rival Masters and Heroic Spirits have been eliminated. The wish-granting cup is claimed!
          </p>
          <div className="pt-2">
            <button
              onClick={handleResetWar}
              className="px-5 py-2 rounded-sm bg-[#d4af37] text-black font-mono font-bold text-xs uppercase tracking-wider hover:bg-[#c49f27] transition"
            >
              Begin New Holy Grail War
            </button>
          </div>
        </div>
      )}

      {/* Main Board Layout: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Master Roster / Leaks / Casualties */}
        <div className="lg:col-span-2 space-y-4">
          {/* Sub-Tabs */}
          <div className="flex items-center justify-between border-b border-[#1a1a1a] pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveBoardTab('roster')}
                className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-sm transition flex items-center gap-1.5 ${
                  activeBoardTab === 'roster'
                    ? 'bg-[#161616] text-[#d4af37] border border-[#d4af37]/30 font-bold'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Participants Board ({Object.values(grailWar.participants).length})</span>
              </button>

              <button
                onClick={() => setActiveBoardTab('leaks')}
                className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-sm transition flex items-center gap-1.5 ${
                  activeBoardTab === 'leaks'
                    ? 'bg-[#161616] text-purple-400 border border-purple-500/30 font-bold'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Leaked Intel ({grailWar.leakedIntel?.length || 0})</span>
              </button>

              <button
                onClick={() => setActiveBoardTab('casualties')}
                className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-sm transition flex items-center gap-1.5 ${
                  activeBoardTab === 'casualties'
                    ? 'bg-[#161616] text-rose-400 border border-rose-500/30 font-bold'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                <UserX className="w-3.5 h-3.5" />
                <span>Civilian Casualties ({grailWar.innocentVictims?.length || 0})</span>
              </button>
            </div>

            <span className="text-[11px] font-mono text-white/40 hidden sm:inline">
              Only exposed intel appears on board
            </span>
          </div>

          {/* TAB 1: PARTICIPANTS ROSTER */}
          {activeBoardTab === 'roster' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {Object.values(grailWar.participants).map(p => {
                const isUser = p.discordId === master.discordId;
                const isSelected = selectedTargetMasterId === p.discordId;
                const hasPactWithUser = userAlliance && userAlliance.memberMasterIds.includes(p.discordId) && !isUser;
                const hpPercent = Math.max(0, Math.min(100, Math.round((p.currentHp / p.maxHp) * 100)));

                // Exposure check: If participant is NOT exposed and NOT the user, conceal their info!
                const isRevealed = p.isExposed || isUser || !p.isAlive;

                return (
                  <div
                    key={p.discordId}
                    onClick={() => {
                      if (!isUser && p.isAlive) {
                        setSelectedTargetMasterId(p.discordId);
                      }
                    }}
                    className={`p-4 rounded-lg border transition-all relative overflow-hidden ${
                      !p.isAlive
                        ? 'bg-[#0a0a0a] border-[#1a1a1a] opacity-40 cursor-not-allowed'
                        : isSelected
                        ? 'bg-[#161616] border-[#d4af37] shadow-[0_0_14px_rgba(212,175,55,0.2)] cursor-pointer'
                        : isUser
                        ? 'bg-[#0e0e0e] border-[#3b82f6]/50'
                        : isRevealed
                        ? 'bg-[#0a0a0a] hover:bg-[#111] border-[#1a1a1a] cursor-pointer'
                        : 'bg-[#080808] border-dashed border-[#222] hover:border-[#333] cursor-pointer'
                    }`}
                  >
                    {/* Status Badge & Identification */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isRevealed ? (
                          <span className="text-sm font-medium text-white font-serif flex items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5 text-[#22c55e]" />
                            {p.username}
                          </span>
                        ) : (
                          <span className="text-sm font-medium text-white/60 font-serif italic flex items-center gap-1.5">
                            <EyeOff className="w-3.5 h-3.5 text-white/40" />
                            ??? (Shadow Master)
                          </span>
                        )}

                        {isUser && (
                          <span className="px-1.5 py-0.2 text-[8px] font-mono font-bold rounded-sm bg-[#161616] text-[#3b82f6] border border-[#3b82f6]/40">
                            YOU
                          </span>
                        )}
                        {hasPactWithUser && (
                          <span className="px-1.5 py-0.2 text-[8px] font-mono font-bold rounded-sm bg-[#221c08] text-[#d4af37] border border-[#d4af37]/40">
                            ALLY
                          </span>
                        )}
                      </div>

                      <span
                        className={`text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-sm font-bold ${
                          !p.isAlive
                            ? 'bg-[#220000] text-[#ef4444] border border-[#ef4444]/30'
                            : isRevealed
                            ? 'bg-[#111] text-[#22c55e] border border-[#22c55e]/30'
                            : 'bg-[#161616] text-white/40 border border-white/10'
                        }`}
                      >
                        {!p.isAlive ? 'ELIMINATED' : isRevealed ? p.servantClass : 'HIDDEN'}
                      </span>
                    </div>

                    {/* Servant Info */}
                    {isRevealed ? (
                      <div className="text-xs text-white/80 font-medium mb-1.5 flex items-center justify-between">
                        <span>
                          Servant: <strong className="text-[#d4af37]">{p.servantName}</strong>
                        </span>
                        <span className="text-[10px] font-mono text-white/40">Kills: {p.kills}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-white/40 font-mono italic mb-1.5 flex items-center justify-between">
                        <span>Servant: [CLASSIFIED IN SHADOWS]</span>
                        <span className="text-[10px]">Kills: ???</span>
                      </div>
                    )}

                    {/* Exposure Reason Tag */}
                    {p.isExposed && (
                      <div className="my-1.5">
                        <span className="inline-block px-1.5 py-0.5 text-[9px] font-mono rounded bg-[#161616] text-[#f59e0b] border border-[#f59e0b]/30">
                          {p.exposureReason === 'public_command' && '📡 Exposed via Public Command'}
                          {p.exposureReason === 'ambush_clash' && '⚔️ Exposed via Ambush Clash'}
                          {p.exposureReason === 'innocent_assault' && '☠️ Exposed via Civilian Assault'}
                          {p.exposureReason === 'intel_leak' && '🕵️ Exposed via Intel Leak'}
                          {p.exposureReason === 'direct_combat' && '⚔️ Exposed via Open Battle'}
                          {!p.exposureReason && '📡 Identity Exposed'}
                        </span>
                      </div>
                    )}

                    {!p.isExposed && !isUser && p.isAlive && (
                      <div className="my-1.5">
                        <span className="inline-block px-1.5 py-0.5 text-[9px] font-mono rounded bg-[#111] text-white/40 border border-white/10">
                          🕶️ Operating in Concealment
                        </span>
                      </div>
                    )}

                    {/* HP Bar */}
                    <div className="space-y-1 mt-2">
                      <div className="flex items-center justify-between text-[10px] font-mono text-white/50">
                        <span>HP:</span>
                        <span>
                          {isRevealed
                            ? `${p.currentHp.toLocaleString()} / ${p.maxHp.toLocaleString()} (${hpPercent}%)`
                            : '[CLASSIFIED]'}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            !isRevealed
                              ? 'bg-white/20'
                              : hpPercent > 50
                              ? 'bg-[#22c55e]'
                              : hpPercent > 20
                              ? 'bg-[#f59e0b]'
                              : 'bg-[#ef4444]'
                          }`}
                          style={{ width: isRevealed ? `${hpPercent}%` : '100%' }}
                        />
                      </div>
                    </div>

                    {/* Action Hints on Card */}
                    {isSelected && p.isAlive && (
                      <div className="mt-3 pt-2.5 border-t border-[#1a1a1a] flex items-center justify-between text-[10px] font-mono text-[#d4af37]">
                        <span>Target Selected</span>
                        <span>Ready to Ambush or Ally</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: LEAKED INTEL DISPATCHES */}
          {activeBoardTab === 'leaks' && (
            <div className="space-y-3">
              {(!grailWar.leakedIntel || grailWar.leakedIntel.length === 0) ? (
                <div className="p-8 text-center bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] space-y-2">
                  <Radio className="w-8 h-8 text-white/20 mx-auto" />
                  <p className="text-xs font-mono text-white/50">No intelligence leaks broadcasted yet.</p>
                  <p className="text-[11px] font-mono text-white/30">Use the &quot;Leak Intel&quot; button to broadcast secret rumors or out suspect Masters.</p>
                </div>
              ) : (
                grailWar.leakedIntel.map(leak => (
                  <div key={leak.id} className="p-3.5 rounded-lg bg-[#0e0a16] border border-purple-500/30 font-mono text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-purple-300/60">
                      <span className="flex items-center gap-1.5">
                        <Radio className="w-3 h-3 text-purple-400" />
                        <span>Dispatch by <strong>{leak.author}</strong></span>
                      </span>
                      <span>{new Date(leak.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-white text-xs leading-relaxed italic">&quot;{leak.text}&quot;</p>
                    {leak.exposedMasterId && (
                      <div className="pt-1 text-[10px] text-purple-400 font-semibold">
                        🎯 Confirmed target outed on Intelligence Board.
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: CIVILIAN CASUALTIES LOG */}
          {activeBoardTab === 'casualties' && (
            <div className="space-y-3">
              {(!grailWar.innocentVictims || grailWar.innocentVictims.length === 0) ? (
                <div className="p-8 text-center bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] space-y-2">
                  <UserX className="w-8 h-8 text-white/20 mx-auto" />
                  <p className="text-xs font-mono text-white/50">Zero civilian casualties recorded.</p>
                  <p className="text-[11px] font-mono text-white/30">Attacking innocent server members who are not Masters will record their deaths and expose the attacker.</p>
                </div>
              ) : (
                grailWar.innocentVictims.map(vic => (
                  <div key={vic.id} className="p-3.5 rounded-lg bg-[#180808] border border-rose-500/30 font-mono text-xs space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-rose-400/70">
                      <span className="flex items-center gap-1.5">
                        <Skull className="w-3 h-3 text-rose-500" />
                        <span>Slain Civilian: <strong>{vic.username}</strong></span>
                      </span>
                      <span>{new Date(vic.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-white/80 text-[11px]">
                      Struck down by Master <strong>{vic.killedBy}</strong> ({vic.killerServant}) in a botched ambush.
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Selected Rival Engagement Box */}
          {selectedTargetMasterId && selectedTargetMasterId !== master.discordId && (
            <div className="p-5 rounded-xl bg-[#0a0a0a] border border-[#d4af37]/40 space-y-3 shadow-lg">
              <div className="flex items-center justify-between border-b border-[#1a1a1a] pb-3">
                <div>
                  <h4 className="text-sm font-serif italic text-white">
                    Engagement: {grailWar.participants[selectedTargetMasterId]?.isExposed ? grailWar.participants[selectedTargetMasterId]?.username : 'Suspected Rival Master'}
                  </h4>
                  <p className="text-[11px] font-mono text-white/40">
                    Target ID: {selectedTargetMasterId} • {grailWar.participants[selectedTargetMasterId]?.isExposed ? `Servant: ${grailWar.participants[selectedTargetMasterId]?.servantName}` : 'Identity Hidden in Shadows'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTargetMasterId(null)}
                  className="text-xs font-mono text-white/40 hover:text-white"
                >
                  ✕ Close
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => handleAction('challenge_master', selectedTargetMasterId)}
                  className="py-3 px-4 rounded-sm bg-[#220000] hover:bg-[#330000] text-[#ef4444] border border-[#ef4444]/40 font-mono text-xs uppercase tracking-wider font-bold flex items-center justify-center gap-2 transition"
                >
                  <Swords className="w-4 h-4" />
                  <span>Challenge Duel (Exposes Both)</span>
                </button>

                {userAlliance && userAlliance.memberMasterIds.includes(selectedTargetMasterId) ? (
                  <button
                    onClick={() => handleAction('betray_ally')}
                    className="py-3 px-4 rounded-sm bg-[#221c08] hover:bg-[#2e260c] text-[#f59e0b] border border-[#f59e0b]/40 font-mono text-xs uppercase tracking-wider font-bold flex items-center justify-center gap-2 transition"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Betray Covenant</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleAction('form_alliance', selectedTargetMasterId)}
                    className="py-3 px-4 rounded-sm bg-[#111] hover:bg-[#161616] text-[#a855f7] border border-[#a855f7]/40 font-mono text-xs uppercase tracking-wider font-bold flex items-center justify-center gap-2 transition"
                  >
                    <Handshake className="w-4 h-4" />
                    <span>Form Secret Covenant</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Col: Live Chronicle / Event Logs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-serif italic text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-[#d4af37]" /> Holy Grail War Chronicle
            </h3>
            <span className="text-[11px] font-mono text-white/40">{grailWar.eventLogs.length} Events</span>
          </div>

          {/* Active Alliances Panel */}
          {Object.keys(grailWar.alliances).length > 0 && (
            <div className="p-3.5 rounded-lg bg-[#111] border border-[#1a1a1a] space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#d4af37] block">
                Active Covenants:
              </span>
              {Object.values(grailWar.alliances).map(a => (
                <div key={a.id} className="text-xs font-mono text-white/80 flex items-center gap-2">
                  <Handshake className="w-3.5 h-3.5 text-[#a855f7]" />
                  <span>{a.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Chronicle Stream */}
          <div className="p-4 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] max-h-[500px] overflow-y-auto space-y-3 font-mono text-xs scrollbar-thin">
            {grailWar.eventLogs.map(evt => (
              <div
                key={evt.id}
                className={`p-2.5 rounded-sm border ${
                  evt.type === 'elimination'
                    ? 'bg-[#220000]/60 border-[#ef4444]/40 text-rose-300'
                    : evt.type === 'casualty'
                    ? 'bg-[#2b0808] border-rose-600/50 text-rose-300'
                    : evt.type === 'exposure'
                    ? 'bg-[#261e05] border-[#f59e0b]/50 text-amber-300'
                    : evt.type === 'ambush'
                    ? 'bg-[#221008] border-[#ef4444]/40 text-orange-300'
                    : evt.type === 'intel_leak'
                    ? 'bg-[#180a29] border-purple-500/40 text-purple-300'
                    : evt.type === 'alliance'
                    ? 'bg-[#160d24] border-[#a855f7]/40 text-purple-300'
                    : evt.type === 'betrayal'
                    ? 'bg-[#261600] border-[#f59e0b]/40 text-amber-300'
                    : evt.type === 'heal'
                    ? 'bg-[#002200]/50 border-[#22c55e]/40 text-emerald-300'
                    : 'bg-[#111] border-[#1a1a1a] text-white/70'
                }`}
              >
                <div className="text-[10px] text-white/30 mb-1">
                  {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <div className="leading-relaxed">{evt.text}</div>
              </div>
            ))}
          </div>

          {/* Reset Session Button */}
          <button
            onClick={handleResetWar}
            className="w-full py-2.5 rounded-sm bg-transparent hover:bg-[#111] text-white/40 hover:text-white text-xs font-mono uppercase tracking-wider border border-white/10 flex items-center justify-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset 7-Master Tournament</span>
          </button>
        </div>
      </div>

      {/* AMBUSH SUSPECT MODAL */}
      {showAmbushModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0e0e0e] border border-rose-500/40 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1a1a1a] pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-serif italic text-base">
                <Crosshair className="w-5 h-5 text-rose-400" />
                <span>Tactical Ambush Command (/grailwar attack)</span>
              </div>
              <button onClick={() => setShowAmbushModal(false)} className="text-white/40 hover:text-white font-mono text-sm">
                ✕
              </button>
            </div>

            <p className="text-xs font-mono text-white/70 leading-relaxed">
              Target a suspected Master in the server. If your intuition is correct, both of your identities will be exposed, and you will deal devastating ambush damage.
            </p>
            <div className="p-3 bg-[#220000]/40 border border-rose-500/30 rounded text-[11px] font-mono text-rose-300">
              ⚠️ <strong>Warning:</strong> If the target is an innocent server user, the civilian will be killed instantly, and your identity will be publicly exposed on the board for breaching the Secrecy of Magecraft!
            </div>

            <form onSubmit={handleAmbushSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono text-white/50 uppercase mb-1">
                  Suspect Username or Discord Mention:
                </label>
                <input
                  type="text"
                  required
                  value={ambushInput}
                  onChange={e => setAmbushInput(e.target.value)}
                  placeholder="e.g. Kotomine Kirei, @Bazett, or user ID"
                  className="w-full bg-[#161616] border border-[#222] focus:border-rose-500 rounded p-2.5 text-xs text-white font-mono outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAmbushModal(false)}
                  className="px-4 py-2 rounded text-xs font-mono text-white/60 hover:text-white bg-[#111]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded text-xs font-mono font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Execute Ambush</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LEAK INTEL MODAL */}
      {showLeakModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0e0e0e] border border-purple-500/40 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1a1a1a] pb-3">
              <div className="flex items-center gap-2 text-purple-400 font-serif italic text-base">
                <Radio className="w-5 h-5 text-purple-400" />
                <span>Leak Intelligence Command (/grailwar leak)</span>
              </div>
              <button onClick={() => setShowLeakModal(false)} className="text-white/40 hover:text-white font-mono text-sm">
                ✕
              </button>
            </div>

            <p className="text-xs font-mono text-white/70 leading-relaxed">
              Broadcast an intelligence report, rumor, or leak onto the Holy Grail War status board. You can also specify a rival Master to expose their identity.
            </p>

            <form onSubmit={handleLeakSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono text-white/50 uppercase mb-1">
                  Intelligence Dispatch / Report:
                </label>
                <textarea
                  required
                  rows={3}
                  value={leakTextInput}
                  onChange={e => setLeakTextInput(e.target.value)}
                  placeholder="e.g. Sighted Berserker lurking near Einzbern Castle. Master suspected to be Illya."
                  className="w-full bg-[#161616] border border-[#222] focus:border-purple-500 rounded p-2.5 text-xs text-white font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-white/50 uppercase mb-1">
                  Expose Master (Optional Target Name):
                </label>
                <input
                  type="text"
                  value={leakTargetInput}
                  onChange={e => setLeakTargetInput(e.target.value)}
                  placeholder="e.g. Rin Tohsaka, Kotomine, Bazett"
                  className="w-full bg-[#161616] border border-[#222] focus:border-purple-500 rounded p-2.5 text-xs text-white font-mono outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLeakModal(false)}
                  className="px-4 py-2 rounded text-xs font-mono text-white/60 hover:text-white bg-[#111]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded text-xs font-mono font-bold uppercase tracking-wider bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Broadcast Leak</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
