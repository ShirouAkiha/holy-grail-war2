'use client';

import React, { useState } from 'react';
import {
  DistrictId,
  HolyGrailWarSession,
  MasterProfile,
  WarDistrict
} from '../lib/types';
import {
  executeWarAction,
  advanceWarRound,
  createHolyGrailWarSession,
  FUYUKI_DISTRICTS
} from '../lib/engine/grailwar';
import {
  Compass,
  Castle,
  Shield,
  Zap,
  Users,
  Swords,
  Heart,
  Skull,
  Eye,
  Handshake,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  MapPin
} from 'lucide-react';

interface GrailWarSimProps {
  master: MasterProfile;
  grailWar: HolyGrailWarSession;
  onUpdateGrailWar: (war: HolyGrailWarSession) => void;
  onUpdateMaster: (master: MasterProfile) => void;
}

export default function GrailWarSim({
  master,
  grailWar,
  onUpdateGrailWar,
  onUpdateMaster
}: GrailWarSimProps) {
  const activeServant = master.servants.find(s => s.id === master.activeServantId) || master.servants[0];
  const userParticipant = grailWar.participants[master.discordId];

  const [selectedDistrict, setSelectedDistrict] = useState<DistrictId>(
    userParticipant?.currentDistrict || 'homurahara_academy'
  );
  const [selectedTargetMasterId, setSelectedTargetMasterId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const handleAction = (actionType: any, targetParam?: string) => {
    const res = executeWarAction(grailWar, master.discordId, actionType, targetParam);
    onUpdateGrailWar(res.updatedWar);
    setActionFeedback(res.message);
    setTimeout(() => setActionFeedback(null), 5000);
  };

  const handleAdvanceRound = () => {
    const nextWar = advanceWarRound(grailWar);
    onUpdateGrailWar(nextWar);
    setActionFeedback(`Round ${nextWar.currentRound} began! AP recovered (+60 AP).`);
    setTimeout(() => setActionFeedback(null), 5000);
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
    setActionFeedback('New 7-Master Holy Grail War session initialized!');
  };

  const aliveParticipants = Object.values(grailWar.participants).filter(p => p.isAlive);
  const userDistrict = grailWar.districts[userParticipant?.currentDistrict || 'homurahara_academy'];
  const userAlliance = userParticipant?.allianceId ? grailWar.alliances[userParticipant.allianceId] : null;

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
              <span className="px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest bg-[#161616] text-[#d4af37] border border-[#d4af37]/40 rounded-sm">
                ROUND {grailWar.currentRound}/{grailWar.maxRounds}
              </span>
            </div>
            <p className="text-[11px] font-mono text-white/40 uppercase tracking-wider mt-0.5">
              7-Master Battle Royale • Status: <span className="font-bold text-[#22c55e]">{grailWar.status}</span>
            </p>
          </div>
        </div>

        {/* Master Resources */}
        <div className="flex items-center gap-2.5">
          <div className="px-3.5 py-1.5 rounded-sm bg-[#111] border border-[#1a1a1a] text-xs font-mono flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-[#3b82f6]" />
            <span className="text-white/40 uppercase text-[10px]">AP:</span>
            <strong className="text-[#3b82f6]">{userParticipant?.ap ?? 100}/100</strong>
          </div>

          <div className="px-3.5 py-1.5 rounded-sm bg-[#111] border border-[#1a1a1a] text-xs font-mono flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-[#ef4444]" />
            <span className="text-white/40 uppercase text-[10px]">Seals:</span>
            <strong className="text-[#ef4444]">{userParticipant?.commandSeals ?? 3}/3</strong>
          </div>

          <button
            onClick={handleAdvanceRound}
            className="px-4 py-1.5 rounded-sm bg-[#d4af37] hover:bg-[#c49f27] text-black font-bold text-xs font-mono uppercase tracking-wider shadow-lg transition flex items-center gap-1.5"
          >
            <span>Next Round</span>
            <span>⏩</span>
          </button>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionFeedback && (
        <div className="p-3.5 rounded-sm bg-[#161616] border border-[#d4af37]/40 text-[#d4af37] text-xs font-mono flex items-center gap-2 animate-in fade-in">
          <Sparkles className="w-4 h-4 text-[#d4af37]" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Map of Fuyuki Districts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* District Grid / Map (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-serif italic text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#d4af37]" /> Fuyuki City Districts & Leylines
            </h3>
            <span className="text-[11px] font-mono text-white/40">Select district to scout or relocate</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.values(grailWar.districts).map(d => {
              const mastersInDistrict = Object.values(grailWar.participants).filter(
                p => p.isAlive && p.currentDistrict === d.id
              );
              const isUserHere = userParticipant?.currentDistrict === d.id;
              const isSelected = selectedDistrict === d.id;

              return (
                <div
                  key={d.id}
                  onClick={() => setSelectedDistrict(d.id)}
                  className={`p-4 rounded-lg border transition-all cursor-pointer relative overflow-hidden ${
                    isSelected
                      ? 'bg-[#161616] border-[#d4af37] shadow-[0_0_12px_rgba(212,175,55,0.15)]'
                      : 'bg-[#0a0a0a] hover:bg-[#111] border-[#1a1a1a]'
                  }`}
                >
                  {isUserHere && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-sm bg-[#22c55e]/20 text-[#22c55e] text-[9px] font-mono font-bold border border-[#22c55e]/30 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> YOU ARE HERE
                    </div>
                  )}

                  <h4 className="font-serif italic text-white text-sm mb-1">{d.name}</h4>
                  <p className="text-[11px] font-mono text-white/40 mb-2.5 line-clamp-2">{d.description}</p>

                  <div className="flex items-center justify-between text-[10px] font-mono pt-2 border-t border-[#1a1a1a]">
                    <span className="text-[#d4af37]">Leyline: {d.leylineBonus}</span>
                    <span className="text-white/40">
                      Masters: <strong className="text-white">{mastersInDistrict.length}</strong>
                    </span>
                  </div>

                  {mastersInDistrict.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 overflow-x-auto">
                      {mastersInDistrict.map(m => (
                        <span
                          key={m.discordId}
                          className="px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider rounded-sm bg-[#111] text-white/70 border border-[#1a1a1a]"
                        >
                          {m.username} ({m.servantClass})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* District Action Panel */}
          {userParticipant && (
            <div className="p-5 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] space-y-4">
              <div className="flex items-center justify-between border-b border-[#1a1a1a] pb-3">
                <div>
                  <h4 className="text-sm font-serif italic text-white">
                    District Actions: {grailWar.districts[userParticipant.currentDistrict].name}
                  </h4>
                  <p className="text-[11px] font-mono text-white/40">Spend AP to execute tactical maneuvers</p>
                </div>
                <div className="text-xs font-mono text-[#d4af37] font-bold">AP: {userParticipant.ap}/100</div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  disabled={userParticipant.ap < 20}
                  onClick={() => handleAction('scout')}
                  className="p-3 rounded-sm bg-[#111] hover:bg-[#161616] text-[#3b82f6] border border-[#3b82f6]/30 text-xs font-mono uppercase tracking-wider font-bold flex flex-col items-center gap-1 transition disabled:opacity-30"
                >
                  <Eye className="w-4 h-4 text-[#3b82f6]" />
                  <span>Scout</span>
                  <span className="text-[9px] text-white/40 font-normal">20 AP</span>
                </button>

                <button
                  disabled={userParticipant.ap < 25}
                  onClick={() => handleAction('fortify_leyline')}
                  className="p-3 rounded-sm bg-[#111] hover:bg-[#161616] text-[#22c55e] border border-[#22c55e]/30 text-xs font-mono uppercase tracking-wider font-bold flex flex-col items-center gap-1 transition disabled:opacity-30"
                >
                  <Castle className="w-4 h-4 text-[#22c55e]" />
                  <span>Fortify</span>
                  <span className="text-[9px] text-white/40 font-normal">25 AP</span>
                </button>

                <button
                  disabled={userParticipant.ap < 30}
                  onClick={() => handleAction('rest_and_heal')}
                  className="p-3 rounded-sm bg-[#111] hover:bg-[#161616] text-[#a855f7] border border-[#a855f7]/30 text-xs font-mono uppercase tracking-wider font-bold flex flex-col items-center gap-1 transition disabled:opacity-30"
                >
                  <Heart className="w-4 h-4 text-[#a855f7]" />
                  <span>Rest & Heal</span>
                  <span className="text-[9px] text-white/40 font-normal">30 AP</span>
                </button>

                {selectedDistrict !== userParticipant.currentDistrict ? (
                  <button
                    disabled={userParticipant.ap < 15}
                    onClick={() => handleAction('move_district', selectedDistrict)}
                    className="p-3 rounded-sm bg-[#111] hover:bg-[#161616] text-[#d4af37] border border-[#d4af37]/40 text-xs font-mono uppercase tracking-wider font-bold flex flex-col items-center gap-1 transition disabled:opacity-30"
                  >
                    <Compass className="w-4 h-4 text-[#d4af37]" />
                    <span>Relocate</span>
                    <span className="text-[9px] text-white/40 font-normal">15 AP</span>
                  </button>
                ) : (
                  <button
                    disabled={!userAlliance || userParticipant.ap < 20}
                    onClick={() => handleAction('betray_ally')}
                    className="p-3 rounded-sm bg-[#220000] hover:bg-[#330000] text-[#ef4444] border border-[#ef4444]/40 text-xs font-mono uppercase tracking-wider font-bold flex flex-col items-center gap-1 transition disabled:opacity-30"
                  >
                    <AlertTriangle className="w-4 h-4 text-[#ef4444]" />
                    <span>Betray</span>
                    <span className="text-[9px] text-white/40 font-normal">20 AP</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Master Roster & Alliance Panel (1 Col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-serif italic text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-[#d4af37]" /> 7 Masters Roster
            </h3>
            <span className="text-[11px] font-mono text-white/40">{aliveParticipants.length}/7 Alive</span>
          </div>

          <div className="space-y-2.5">
            {Object.values(grailWar.participants).map(p => {
              const isUser = p.discordId === master.discordId;
              const isSelected = selectedTargetMasterId === p.discordId;

              return (
                <div
                  key={p.discordId}
                  onClick={() => !isUser && setSelectedTargetMasterId(p.discordId)}
                  className={`p-3.5 rounded-lg border transition cursor-pointer ${
                    !p.isAlive
                      ? 'bg-[#0a0a0a] border-[#1a1a1a] opacity-30'
                      : isSelected
                      ? 'bg-[#161616] border-[#d4af37] shadow-[0_0_8px_rgba(212,175,55,0.15)]'
                      : 'bg-[#0a0a0a] border-[#1a1a1a] hover:bg-[#111]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white">{p.username}</span>
                      {isUser && (
                        <span className="px-1.5 py-0.2 text-[8px] font-mono font-bold rounded-sm bg-[#161616] text-[#d4af37] border border-[#d4af37]/30">YOU</span>
                      )}
                    </div>
                    <span
                      className={`text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-sm ${
                        p.isAlive ? 'bg-[#111] text-[#22c55e] border border-[#22c55e]/30' : 'bg-[#220000] text-[#ef4444] border border-[#ef4444]/30'
                      }`}
                    >
                      {p.isAlive ? p.servantClass : 'ELIMINATED'}
                    </span>
                  </div>

                  <div className="text-[11px] font-mono text-white/40 flex items-center justify-between mb-2">
                    <span>Servant: <strong className="text-white/80">{p.servantName}</strong></span>
                    <span>📍 {grailWar.districts[p.currentDistrict].name.split(' ')[0]}</span>
                  </div>

                  {/* HP Bar */}
                  <div className="w-full h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#22c55e]"
                      style={{ width: `${Math.max(0, (p.currentHp / p.maxHp) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Target Interaction Actions */}
          {selectedTargetMasterId && selectedTargetMasterId !== master.discordId && (
            <div className="p-4 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] space-y-2">
              <div className="text-xs font-mono text-white/70">
                Target: <strong className="text-white">{grailWar.participants[selectedTargetMasterId]?.username}</strong>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={userParticipant?.ap < 25}
                  onClick={() => handleAction('form_alliance', selectedTargetMasterId)}
                  className="py-2 px-3 rounded-sm bg-[#111] hover:bg-[#161616] text-[#a855f7] border border-[#a855f7]/40 font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-1 transition"
                >
                  <Handshake className="w-3.5 h-3.5" />
                  <span>Alliance</span>
                </button>
                <button
                  disabled={userParticipant?.ap < 35}
                  onClick={() => handleAction('challenge_master', selectedTargetMasterId)}
                  className="py-2 px-3 rounded-sm bg-[#220000] hover:bg-[#330000] text-[#ef4444] border border-[#ef4444]/40 font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-1 transition"
                >
                  <Swords className="w-3.5 h-3.5" />
                  <span>Duel</span>
                </button>
              </div>
            </div>
          )}

          {/* Reset Session Option */}
          <button
            onClick={handleResetWar}
            className="w-full py-2 rounded-sm bg-transparent hover:bg-[#111] text-white/40 hover:text-white text-xs font-mono uppercase tracking-wider border border-white/10 flex items-center justify-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset 7-Master War Session</span>
          </button>
        </div>
      </div>
    </div>
  );
}
