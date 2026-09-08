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
  exposeMasterInWar,
  setChannelTrapInWar,
  disarmChannelTrapsInWar,
  checkAndTriggerChannelTraps
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
  Crosshair,
  Lock,
  Trash2,
  CheckCircle2,
  AlertOctagon,
  Radar
} from 'lucide-react';

interface GrailWarSimProps {
  master: MasterProfile;
  grailWar: HolyGrailWarSession;
  onUpdateGrailWar: (war: HolyGrailWarSession) => void;
  onUpdateMaster: (master: MasterProfile) => void;
  onStartDuelWithRival?: (rivalParticipant: WarMasterParticipant) => void;
}

function formatVictimOrUsername(raw: string | undefined): string {
  if (!raw) return 'Innocent Bystander';
  const idMatch = raw.match(/\d{16,21}/);
  if (idMatch) {
    const uid = idMatch[0];
    const knownMap: Record<string, string> = {
      '780278575860678676': 'pokehunter1',
      '492833398461562880': 'itsderpo',
      '1257784101906157589': 'fou.chiii',
      '521112557810090005': 'cccp001',
      '1499028902104797237': 'fou.chii',
      '152568236896944130': 'bwjolioliravioli',
      '442009903809429515': 'fluffycat78',
      '189710170597752832': 'ixyan',
      '499898049145995276': 'togata_my_beloved',
      '728294594378203177': 'snoic_2',
      '373115070068162561': 'stahlgeist',
      '707978460697460758': 'paradise3812'
    };
    if (knownMap[uid]) return `@${knownMap[uid]}`;
    return `@Citizen_${uid.slice(-4)}`;
  }
  const clean = raw.replace(/[<@!>]/g, '').trim();
  return clean.length > 0 ? (clean.startsWith('@') ? clean : `@${clean}`) : raw;
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
  const [activeBoardTab, setActiveBoardTab] = useState<'roster' | 'leaks' | 'casualties' | 'traps'>('roster');
  const [boardTrapChannel, setBoardTrapChannel] = useState<string>('#holy-grail-war');
  const [boardTrapType, setBoardTrapType] = useState<'alarm' | 'bloodfort'>('alarm');
  const [customChannelInput, setCustomChannelInput] = useState<string>('');

  // Real-time ticking clock for pure render of cooldown counters
  const [currentTime, setCurrentTime] = useState<number>(0);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentTime(Date.now());
    }, 0);
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  // Ambush & Leak Form State
  const [showAmbushModal, setShowAmbushModal] = useState(false);
  const [ambushInput, setAmbushInput] = useState('');
  const [showLeakModal, setShowLeakModal] = useState(false);
  const [leakTextInput, setLeakTextInput] = useState('');
  const [leakTargetInput, setLeakTargetInput] = useState('');
  const [chronicleFilter, setChronicleFilter] = useState<'all' | 'clash' | 'leak' | 'casualty' | 'elimination'>('all');

  const handleAction = (actionType: any, targetParam?: string) => {
    const res = executeWarAction(grailWar, master.discordId, actionType, targetParam);
    onUpdateGrailWar(res.updatedWar);
    setActionFeedback(res.message);
    setTimeout(() => setActionFeedback(null), 6000);

    if (actionType === 'set_ward' && targetParam) {
      onUpdateMaster({ ...master, boundedField: targetParam as any });
    } else if (actionType === 'toggle_evade' && targetParam) {
      onUpdateMaster({ ...master, autoConsumeCommandSeal: targetParam === 'on' });
    } else if ((actionType === 'rest_and_heal' || actionType === 'heal_ritual') && res.success) {
      const activePart = res.updatedWar.participants[master.discordId];
      if (activePart && master.servants.length > 0) {
        const updatedServants = master.servants.map((s, idx) => {
          if (s.id === (master.activeServantId || master.servants[0].id) || idx === 0) {
            return {
              ...s,
              currentHp: activePart.currentHp,
              baseHpAtDamage: activePart.baseHpAtDamage,
              lastDamageTime: activePart.lastDamageTime
            };
          }
          return s;
        });
        onUpdateMaster({ ...master, servants: updatedServants });
      }
    }
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

  const handleDeployTrapFromBoard = (targetChannel: string, trapType: 'alarm' | 'bloodfort') => {
    const chan = targetChannel.startsWith('#') ? targetChannel : `#${targetChannel.trim()}`;
    const engineTrap = trapType === 'bloodfort' ? 'drain' : 'alarm';
    const res = setChannelTrapInWar(grailWar, master.discordId, master.username, chan, engineTrap);
    onUpdateGrailWar(res.updatedWar);
    setActionFeedback(res.message);
    setTimeout(() => setActionFeedback(null), 7000);
  };

  const handleDisarmTrapFromBoard = (channelName?: string) => {
    const res = disarmChannelTrapsInWar(grailWar, master.discordId, channelName);
    onUpdateGrailWar(res.updatedWar);
    setActionFeedback(res.message);
    setTimeout(() => setActionFeedback(null), 7000);
  };

  const handleTriggerIntrusionTest = (channelName: string) => {
    const rivals = Object.values(grailWar.participants).filter(p => p.discordId !== master.discordId && p.isAlive);
    const rival = rivals.length > 0 ? rivals[Math.floor(Math.random() * rivals.length)] : null;
    const triggerId = rival ? rival.discordId : 'shadow_rival_tester';
    const triggerName = rival ? rival.username : 'Shadow Infiltrator';
    const res = checkAndTriggerChannelTraps(grailWar, triggerId, triggerName, channelName);
    if (res.triggered) {
      onUpdateGrailWar({ ...grailWar });
      setActionFeedback(`⚡ INTRUSION DETECTED in ${channelName}!\n${res.message || 'Trap triggered!'}`);
    } else {
      setActionFeedback(`ℹ️ No active Bounded Field traps triggered in ${channelName}. Anchor a trap in this sector first!`);
    }
    setTimeout(() => setActionFeedback(null), 8000);
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
            <span className="text-white/60">Civilian Deaths: <strong>{grailWar.civilianCasualties?.length || 0}</strong></span>
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

      {/* Mage Workshop & Personal Sanctuary Wards */}
      {userParticipant && userParticipant.isAlive && (
        <div className="p-5 bg-[#08080c] rounded-xl border border-[#3b82f6]/30 shadow-lg space-y-4 font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1a1a1a] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-sm bg-[#10101a] text-[#3b82f6] border border-[#3b82f6]/20">
                <Castle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-serif italic text-white">Your Mage Workshop & Sanctuary Wards</h3>
                <p className="text-[10px] text-white/40">Reinforce your defenses to secure your Servant against lethal covert ambushes</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/40">Command Seals:</span>
              <div className="flex items-center gap-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[8px] font-bold border transition ${
                      i < (userParticipant.commandSeals || 0)
                        ? 'bg-[#ef4444]/20 border-[#ef4444] text-[#ef4444]'
                        : 'bg-[#111] border-[#222] text-white/10'
                    }`}
                  >
                    ✦
                  </span>
                ))}
                <span className="text-[10px] text-white/60 ml-1">({userParticipant.commandSeals || 0}/3)</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Workshop Security Ward Selection */}
            <div className="space-y-2.5">
              <div className="text-[11px] text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#3b82f6]" />
                <span>Bounded Field / Wards Protocol</span>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'none', label: 'No Wards', desc: 'No active defenses. (HP Auto-Regen inactive).' },
                  { value: 'ward', label: '🛡️ Sanctuary', desc: 'Absorbs 60% DMG + Sole Leyline HP Auto-Regen (5m).' },
                  { value: 'alarm', label: '🚨 Alarm Trap', desc: '3k counter DMG (Auto-regen inactive without Sanctuary).' }
                ].map(opt => {
                  const isActive = (userParticipant.boundedField || 'none') === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleAction('set_ward', opt.value)}
                      className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition-all ${
                        isActive
                          ? 'bg-[#0f172a] border-[#3b82f6] text-[#3b82f6]'
                          : 'bg-[#111] border-[#1a1a1a] text-white/40 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      <span className="font-bold text-[10px] block mb-1">{opt.label}</span>
                      <span className="text-[9px] leading-snug font-normal text-white/40 block">
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Emergency Command Seal Evacuation Toggle */}
            <div className="space-y-2.5 flex flex-col justify-between">
              <div>
                <div className="text-[11px] text-white/50 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Zap className="w-3.5 h-3.5 text-rose-400" />
                  <span>Command Seal Emergency Evacuation</span>
                </div>
                <p className="text-[10px] text-white/40 leading-relaxed">
                  Toggle the automated Spatial Escape ward. When active, if your Servant takes lethal damage, a Command Seal will automatically flare to nullify the strike and retreat you back into shadows with 1 HP.
                </p>
              </div>

              <div className="flex items-center gap-3.5 bg-[#111] p-3 rounded-lg border border-[#1a1a1a] mt-2">
                <button
                  onClick={() => handleAction('toggle_evade', userParticipant.autoEvadeEnabled !== false ? 'off' : 'on')}
                  className={`w-10 h-6 rounded-full p-1 transition-colors relative flex items-center ${
                    userParticipant.autoEvadeEnabled !== false ? 'bg-rose-600' : 'bg-white/10'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                      userParticipant.autoEvadeEnabled !== false ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
                <div>
                  <span className="text-[11px] font-bold text-white block">
                    {userParticipant.autoEvadeEnabled !== false ? '🟢 AUTO-EVACUATION ACTIVE' : '🔴 AUTO-EVACUATION DISABLED'}
                  </span>
                  <span className="text-[9px] text-white/40">
                    {userParticipant.commandSeals && userParticipant.commandSeals > 0 
                      ? 'Ready to safeguard against death'
                      : 'Requires at least 1 Command Seal to function'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Timers & Real-time Cooldown Panel */}
          <div className="pt-3 border-t border-[#1a1a1a] flex flex-wrap items-center justify-between gap-4 text-[10px] text-white/40">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />
              <span>Servant Class Passive: <strong className="text-white">
                {userParticipant.servantClass === 'Saber' || userParticipant.servantClass === 'Archer' || userParticipant.servantClass === 'Lancer'
                  ? '👁️ Instinct (35% chance to parry 80% and counter for 1,500 DMG)'
                  : userParticipant.servantClass === 'Assassin'
                  ? '🕶️ Presence Concealment (Completely counters ambushes and deals 2,500 counter DMG)'
                  : userParticipant.servantClass === 'Berserker'
                  ? '❤️ Battle Continuation (Guts: Revives with 25% HP once)'
                  : 'None (Specializes in direct matches)'
                }
              </strong></span>
            </div>

            <div className="flex items-center gap-4">
              <span>Ambush Cooldown: <strong className="text-white">
                {userParticipant.lastAmbushTime && (currentTime - userParticipant.lastAmbushTime < 120000)
                  ? `${Math.ceil((120000 - (currentTime - userParticipant.lastAmbushTime)) / 1000)}s`
                  : 'Ready'
                }
              </strong></span>
              <span>Intrusion Safe Buffer: <strong className="text-white">
                {userParticipant.lastAmbushedTime && (currentTime - userParticipant.lastAmbushedTime < 180000)
                  ? `${Math.ceil((180000 - (currentTime - userParticipant.lastAmbushedTime)) / 1000)}s`
                  : 'None (Exposed)'
                }
              </strong></span>
            </div>
          </div>
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

      {/* Main Board Layout */}
      <div className="space-y-6">
        {/* Upper Area: Master Roster / Leaks / Casualties + Selection Controls */}
        <div className="space-y-4">
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
                <span>7 Masters Intelligence Roster ({Object.values(grailWar.participants).length})</span>
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
                <span>Leaked Intel Dispatches ({grailWar.leakedIntel?.length || 0})</span>
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
                <span>Civilian Casualties ({grailWar.civilianCasualties?.length || 0})</span>
              </button>

              <button
                id="grailwar_board_traps_tab_btn"
                onClick={() => setActiveBoardTab('traps')}
                className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-sm transition flex items-center gap-1.5 ${
                  activeBoardTab === 'traps'
                    ? 'bg-[#160d24] text-purple-300 border border-purple-500/50 font-bold shadow-sm'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                <span>🕸️</span>
                <span>Territorial Wards &amp; Radar ({(grailWar.channelTraps || []).filter(t => t.setterMasterId === master.discordId).length}/3)</span>
              </button>
            </div>

            <span className="text-[11px] font-mono text-white/40 hidden sm:inline">
              Only exposed intel appears on board
            </span>
          </div>

          {/* TAB 1: PARTICIPANTS ROSTER */}
          {activeBoardTab === 'roster' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {Object.values(grailWar.participants).map((p, idx) => {
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
                    className={`p-4 rounded-lg border transition-all relative overflow-hidden flex flex-col justify-between ${
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
                    <div>
                      {/* Status Badge & Identification */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isRevealed ? (
                            <span className="text-sm font-medium text-white font-serif flex items-center gap-1.5">
                              <Eye className="w-3.5 h-3.5 text-[#22c55e]" />
                              {p.username}
                            </span>
                          ) : (
                            <span className="text-sm font-medium text-white/60 font-serif italic flex items-center gap-1.5">
                              <EyeOff className="w-3.5 h-3.5 text-white/40" />
                              Shadow Master #{idx + 1}
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
                          {!p.isAlive ? 'ELIMINATED' : isRevealed ? p.servantClass : 'IN SHADOWS'}
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
                            🕶️ Concealed in Shadows
                          </span>
                        </div>
                      )}
                    </div>

                    {/* HP Bar */}
                    <div className="space-y-1 mt-2 pt-2 border-t border-[#1a1a1a]">
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
                        <span>Dispatch by <strong>{leak.informantMasterId}</strong></span>
                      </span>
                      <span>{new Date(leak.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-white text-xs leading-relaxed italic">&quot;{leak.intel}&quot;</p>
                    {leak.targetMasterId && (
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
              {(!grailWar.civilianCasualties || grailWar.civilianCasualties.length === 0) ? (
                <div className="p-8 text-center bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] space-y-2">
                  <UserX className="w-8 h-8 text-white/20 mx-auto" />
                  <p className="text-xs font-mono text-white/50">Zero civilian casualties recorded.</p>
                  <p className="text-[11px] font-mono text-white/30">Attacking innocent server members who are not Masters will record their deaths and expose the attacker.</p>
                </div>
              ) : (
                grailWar.civilianCasualties.map(vic => (
                  <div key={vic.id} className="p-3.5 rounded-lg bg-[#180808] border border-rose-500/30 font-mono text-xs space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-rose-400/70">
                      <span className="flex items-center gap-1.5">
                        <Skull className="w-3 h-3 text-rose-500" />
                        <span>Slain Bystander: <strong>{formatVictimOrUsername(vic.name)}</strong></span>
                      </span>
                      <span>{new Date(vic.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-white/80 text-[11px]">
                      Struck down by Master <strong>{formatVictimOrUsername(vic.slainByMasterId).replace(/^@/, '')}</strong> in a botched ambush.
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: TERRITORIAL BOUNDED FIELDS & RADAR MANAGEMENT HUB */}
          {activeBoardTab === 'traps' && (() => {
            const userTraps = (grailWar.channelTraps || []).filter(t => t.setterMasterId === master.discordId);
            const defaultSectors = [
              { id: '#holy-grail-war', label: 'Central Front (⛩️ #holy-grail-war)' },
              { id: '#mount-enzo', label: 'Mt. Enzo Ryuudou Temple (⛰️ #mount-enzo)' },
              { id: '#shinto-district', label: 'Shinto Commercial District (🏙️ #shinto-district)' },
              { id: '#miyama-town', label: 'Miyama Residential District (🏡 #miyama-town)' },
              { id: '#fuyuki-bridge', label: 'Fuyuki Great Bridge (🌉 #fuyuki-bridge)' },
              { id: '#church-grounds', label: 'Church Outer Perimeter (⛪ #church-grounds)' },
              { id: '#general', label: 'Civilian District (💬 #general)' }
            ];

            const allKnownSectors = Array.from(new Set([
              ...defaultSectors.map(s => s.id),
              ...(grailWar.channelTraps || []).map(t => t.channelName)
            ]));

            return (
              <div className="space-y-6 animate-in fade-in">
                {/* Header Banner & Slots Status */}
                <div className="p-5 rounded-xl bg-gradient-to-r from-[#170926] via-[#100b1a] to-[#0a0a0a] border border-purple-500/40 space-y-3 shadow-lg">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-purple-950/60 text-purple-300 border border-purple-500/40 shadow-inner">
                        <Radar className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-serif italic text-white flex items-center gap-2">
                          <span>Territorial Bounded Field Sanctum</span>
                          <span className="text-[11px] font-mono font-normal px-2 py-0.5 rounded bg-purple-900/50 text-purple-200 border border-purple-500/30">
                            {userTraps.length}/3 Wards Active
                          </span>
                        </h4>
                        <p className="text-xs font-mono text-purple-200/60 mt-0.5">
                          Conceal boundary defenses across Fuyuki sectors. When rival Masters type in your claimed channels, traps trigger automatically.
                        </p>
                      </div>
                    </div>

                    {userTraps.length > 0 && (
                      <button
                        onClick={() => handleDisarmTrapFromBoard()}
                        className="px-3.5 py-1.5 rounded-md bg-[#2a0c10] hover:bg-[#3d1117] text-rose-300 border border-rose-500/40 text-xs font-mono font-semibold flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Disarm All My Wards</span>
                      </button>
                    )}
                  </div>

                  {/* 3 Dedicated Ward Slots Display */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    {[0, 1, 2].map(slotIdx => {
                      const trap = userTraps[slotIdx];
                      if (trap) {
                        const isAlarm = trap.trapType === 'alarm';
                        return (
                          <div
                            key={trap.id || slotIdx}
                            className={`p-3.5 rounded-lg border flex flex-col justify-between space-y-2.5 ${
                              isAlarm
                                ? 'bg-[#150e24] border-purple-500/40 text-purple-200'
                                : 'bg-[#220710] border-rose-500/40 text-rose-200'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="text-[10px] font-mono uppercase tracking-wider text-white/50 block">
                                  Slot {slotIdx + 1} • {isAlarm ? '🚨 Alarm Ward' : '🩸 Bloodfort Drain'}
                                </span>
                                <span className="text-sm font-bold text-white font-mono mt-0.5 block">
                                  {trap.channelName}
                                </span>
                              </div>
                              <span className="text-xs px-2 py-0.5 rounded font-mono bg-black/40 border border-white/10">
                                🟢 ARMED
                              </span>
                            </div>

                            <p className="text-[11px] font-mono text-white/70 leading-relaxed">
                              {isAlarm
                                ? 'Exposes intruder identity & Servant true class on the War Board.'
                                : 'Siphons 1,800–2,600 HP from intruder and heals your contracted Servant.'}
                            </p>

                            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px] font-mono">
                              <span className="text-white/40">
                                Set {new Date(trap.createdAt).toLocaleTimeString()}
                              </span>
                              <button
                                onClick={() => handleDisarmTrapFromBoard(trap.channelName)}
                                className="text-rose-400 hover:text-rose-300 underline font-semibold cursor-pointer"
                              >
                                Disarm Sector
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={slotIdx}
                          className="p-3.5 rounded-lg bg-[#0c0c0e] border border-dashed border-white/15 flex flex-col justify-center items-center text-center space-y-1.5 min-h-[110px]"
                        >
                          <span className="text-xs font-mono text-white/40">
                            ✨ Slot {slotIdx + 1} — Available
                          </span>
                          <p className="text-[10px] font-mono text-white/30 max-w-[200px]">
                            Ready to anchor a Sensory Alarm Ward or Bloodfort Mana Drain.
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Direct Deployment Control Deck */}
                <div className="p-5 rounded-xl bg-[#0c0c0e] border border-[#1f1f23] space-y-4">
                  <div className="flex items-center justify-between border-b border-[#1a1a1f] pb-3">
                    <h5 className="text-sm font-serif italic text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#d4af37]" />
                      <span>Deploy New Bounded Field (No Slash Commands Required)</span>
                    </h5>
                    <span className="text-[11px] font-mono text-white/40">
                      Cost: 0 AP • Max 3 Concurrent Wards
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Sector Selection */}
                    <div className="space-y-2">
                      <label className="text-xs font-mono text-white/70 block">
                        1. Select Target Discord Channel / Sector:
                      </label>
                      <select
                        value={boardTrapChannel}
                        onChange={e => setBoardTrapChannel(e.target.value)}
                        className="w-full bg-[#141416] text-[#d4af37] border border-[#d4af37]/40 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#d4af37]"
                      >
                        {allKnownSectors.map(secName => {
                          const existing = (grailWar.channelTraps || []).find(t => t.channelName.toLowerCase() === secName.toLowerCase());
                          let note = '✨ Clear';
                          if (existing) {
                            note = existing.setterMasterId === master.discordId
                              ? `🕸️ Armed by You (${existing.trapType})`
                              : `🔒 Occupied by ${existing.setterUsername}`;
                          }
                          return (
                            <option key={secName} value={secName} className="bg-[#141416] text-white">
                              {secName} — [{note}]
                            </option>
                          );
                        })}
                      </select>

                      {/* Custom Channel Add Input */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={customChannelInput}
                          onChange={e => setCustomChannelInput(e.target.value)}
                          placeholder="Or type custom channel (e.g. #war-room)..."
                          className="flex-1 bg-[#141416] text-white border border-white/10 focus:border-[#d4af37] rounded-lg px-3 py-1.5 text-xs font-mono outline-none placeholder-white/30"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (customChannelInput.trim()) {
                              const clean = customChannelInput.trim().startsWith('#') ? customChannelInput.trim() : `#${customChannelInput.trim()}`;
                              setBoardTrapChannel(clean);
                              setCustomChannelInput('');
                            }
                          }}
                          className="px-3 py-1.5 text-xs font-mono bg-[#1c1c22] hover:bg-[#282830] text-[#d4af37] rounded-lg border border-[#d4af37]/30 transition"
                        >
                          Use
                        </button>
                      </div>
                    </div>

                    {/* Ward Type Selection */}
                    <div className="space-y-2">
                      <label className="text-xs font-mono text-white/70 block">
                        2. Choose Bounded Field Magecraft Type:
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setBoardTrapType('alarm')}
                          className={`p-3 rounded-lg border text-left flex flex-col justify-between transition ${
                            boardTrapType === 'alarm'
                              ? 'bg-[#1b1030] border-purple-500 text-purple-200 shadow-md ring-1 ring-purple-500'
                              : 'bg-[#141416] border-white/10 text-white/50 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <span>🚨</span>
                            <span>Sensory Alarm</span>
                          </div>
                          <span className="text-[10px] text-white/60 leading-tight mt-1.5">
                            Exposes rival Master &amp; Servant True Class.
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setBoardTrapType('bloodfort')}
                          className={`p-3 rounded-lg border text-left flex flex-col justify-between transition ${
                            boardTrapType === 'bloodfort'
                              ? 'bg-[#290812] border-rose-500 text-rose-200 shadow-md ring-1 ring-rose-500'
                              : 'bg-[#141416] border-white/10 text-white/50 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <span>🩸</span>
                            <span>Bloodfort Drain</span>
                          </div>
                          <span className="text-[10px] text-white/60 leading-tight mt-1.5">
                            Siphons 1,800–2,600 HP to heal your Servant.
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Primary Deploy Button */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      id="grailwar_board_deploy_trap_btn"
                      disabled={userTraps.length >= 3}
                      onClick={() => handleDeployTrapFromBoard(boardTrapChannel, boardTrapType)}
                      className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      <span>⚡</span>
                      <span>Anchor {boardTrapType === 'alarm' ? 'Sensory Alarm Ward' : 'Bloodfort Drain'} in {boardTrapChannel}</span>
                    </button>

                    {/* Test Intrusion Skirmish Trigger */}
                    <button
                      onClick={() => handleTriggerIntrusionTest(boardTrapChannel)}
                      className="px-3.5 py-2 rounded-lg bg-[#18181e] hover:bg-[#24242e] text-amber-300 border border-amber-500/30 text-xs font-mono font-medium flex items-center gap-1.5 transition cursor-pointer"
                      title="Test how the trap reacts when a rival intruder types in this channel"
                    >
                      <span>🎯</span>
                      <span>Simulate Intrusion in {boardTrapChannel}</span>
                    </button>
                  </div>
                </div>

                {/* Leyline Radar Grid */}
                <div className="p-5 rounded-xl bg-[#0a0a0a] border border-[#1a1a1f] space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-serif italic text-white flex items-center gap-2">
                      <Radio className="w-4 h-4 text-purple-400" />
                      <span>Fuyuki City Leyline Radar &amp; Territorial Overview</span>
                    </h5>
                    <span className="text-[11px] font-mono text-white/40">
                      Click any sector to quick-anchor
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                    {allKnownSectors.map(secName => {
                      const trap = (grailWar.channelTraps || []).find(t => t.channelName.toLowerCase() === secName.toLowerCase());
                      const isMyTrap = trap && trap.setterMasterId === master.discordId;
                      const isRivalTrap = trap && trap.setterMasterId !== master.discordId;

                      return (
                        <div
                          key={secName}
                          className={`p-3 rounded-lg border text-xs font-mono flex flex-col justify-between space-y-2 transition ${
                            isMyTrap
                              ? 'bg-[#170c26] border-purple-500/50 shadow-sm'
                              : isRivalTrap
                              ? 'bg-[#1a080c] border-rose-500/40'
                              : 'bg-[#111114] border-white/10 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <span className="font-bold text-white text-xs">
                              {secName}
                            </span>
                            {isMyTrap ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-900/80 text-purple-200 border border-purple-400/40 font-semibold">
                                {trap.trapType === 'alarm' ? '🚨 MY ALARM' : '🩸 MY BLOODFORT'}
                              </span>
                            ) : isRivalTrap ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-950 text-rose-300 border border-rose-500/40 font-semibold">
                                🔒 RIVAL TERRITORY
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                                ✨ CLEAR
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-white/60">
                            {isMyTrap && (
                              <span>Armed &amp; monitoring. Intrusion will spring {trap.trapType === 'alarm' ? 'alarm reveal' : 'mana siphon'}.</span>
                            )}
                            {isRivalTrap && (
                              <span>Concealed by Master <strong>{trap.setterUsername}</strong>. Typing here may trigger their ward!</span>
                            )}
                            {!trap && (
                              <span>Unclaimed leyline zone. Ready for territorial boundary field anchor.</span>
                            )}
                          </div>

                          <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-1">
                            {isMyTrap ? (
                              <button
                                onClick={() => handleDisarmTrapFromBoard(secName)}
                                className="w-full py-1 text-[11px] text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 rounded border border-rose-500/30 font-medium transition cursor-pointer"
                              >
                                🧹 Disarm This Sector
                              </button>
                            ) : isRivalTrap ? (
                              <button
                                onClick={() => handleDisarmTrapFromBoard(secName)}
                                className="w-full py-1 text-[11px] text-amber-300 bg-amber-950/50 hover:bg-amber-900/70 rounded border border-amber-500/40 font-medium transition cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                                title={`Infiltrate leylines and dismantle Master ${trap.setterUsername}'s Bounded Field`}
                              >
                                <span>🗡️</span>
                                <span>Infiltrate &amp; Disarm Rival Field</span>
                              </button>
                            ) : (
                              <div className="grid grid-cols-2 gap-1 w-full">
                                <button
                                  disabled={userTraps.length >= 3}
                                  onClick={() => handleDeployTrapFromBoard(secName, 'alarm')}
                                  className="py-1 px-1.5 text-[10px] text-purple-200 bg-purple-950/50 hover:bg-purple-900/70 rounded border border-purple-500/30 font-medium transition disabled:opacity-40 cursor-pointer text-center"
                                >
                                  🚨 +Alarm
                                </button>
                                <button
                                  disabled={userTraps.length >= 3}
                                  onClick={() => handleDeployTrapFromBoard(secName, 'bloodfort')}
                                  className="py-1 px-1.5 text-[10px] text-rose-200 bg-rose-950/50 hover:bg-rose-900/70 rounded border border-rose-500/30 font-medium transition disabled:opacity-40 cursor-pointer text-center"
                                >
                                  🩸 +Bloodfort
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Selected Rival Engagement Box */}
          {selectedTargetMasterId && selectedTargetMasterId !== master.discordId && (
            <div className="p-5 rounded-xl bg-[#0a0a0a] border border-[#d4af37]/40 space-y-3 shadow-lg animate-in fade-in">
              <div className="flex items-center justify-between border-b border-[#1a1a1a] pb-3">
                <div>
                  <h4 className="text-sm font-serif italic text-white">
                    Target Engagement: {grailWar.participants[selectedTargetMasterId]?.isExposed ? grailWar.participants[selectedTargetMasterId]?.username : 'Suspected Shadow Master'}
                  </h4>
                  <p className="text-[11px] font-mono text-white/40">
                    ID: {selectedTargetMasterId} • {grailWar.participants[selectedTargetMasterId]?.isExposed ? `Servant: ${grailWar.participants[selectedTargetMasterId]?.servantName} (${grailWar.participants[selectedTargetMasterId]?.servantClass})` : 'Identity Concealed in Shadows'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTargetMasterId(null)}
                  className="text-xs font-mono text-white/40 hover:text-white"
                >
                  ✕ Close
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => handleAction('challenge_master', selectedTargetMasterId)}
                  className="py-2.5 px-4 rounded-sm bg-[#220000] hover:bg-[#330000] text-[#ef4444] border border-[#ef4444]/40 font-mono text-xs uppercase tracking-wider font-bold flex items-center justify-center gap-2 transition"
                >
                  <Swords className="w-4 h-4" />
                  <span>Challenge Duel (Exposes Both)</span>
                </button>

                <button
                  onClick={() => {
                    const targetName = grailWar.participants[selectedTargetMasterId]?.username || '';
                    setAmbushInput(targetName);
                    setShowAmbushModal(true);
                  }}
                  className="py-2.5 px-4 rounded-sm bg-[#160000] hover:bg-[#250000] text-rose-400 border border-rose-500/40 font-mono text-xs uppercase tracking-wider font-bold flex items-center justify-center gap-2 transition"
                >
                  <Crosshair className="w-4 h-4 text-rose-400" />
                  <span>Ambush Suspect</span>
                </button>

                {userAlliance && userAlliance.memberMasterIds.includes(selectedTargetMasterId) ? (
                  <button
                    onClick={() => handleAction('betray_ally')}
                    className="py-2.5 px-4 rounded-sm bg-[#221c08] hover:bg-[#2e260c] text-[#f59e0b] border border-[#f59e0b]/40 font-mono text-xs uppercase tracking-wider font-bold flex items-center justify-center gap-2 transition"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Betray Covenant</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleAction('form_alliance', selectedTargetMasterId)}
                    className="py-2.5 px-4 rounded-sm bg-[#111] hover:bg-[#161616] text-[#a855f7] border border-[#a855f7]/40 font-mono text-xs uppercase tracking-wider font-bold flex items-center justify-center gap-2 transition"
                  >
                    <Handshake className="w-4 h-4" />
                    <span>Form Secret Covenant</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* LOWER SECTION: Full-Width Holy Grail War Chronicle & Event Intelligence Feed */}
        <div className="p-5 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1a1a1a] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-sm bg-[#161616] text-[#d4af37] border border-[#d4af37]/20">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-serif italic text-white">Holy Grail War Chronicle &amp; Clashes</h3>
                <p className="text-[10px] font-mono text-white/40">Real-time log of city skirmishes, intelligence leaks, ambush reports, and casualties</p>
              </div>
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-mono">
              <button
                onClick={() => setChronicleFilter('all')}
                className={`px-2.5 py-1 rounded transition ${
                  chronicleFilter === 'all'
                    ? 'bg-[#161616] text-[#d4af37] border border-[#d4af37]/40 font-bold'
                    : 'bg-[#111] text-white/50 hover:text-white border border-transparent'
                }`}
              >
                All ({grailWar.eventLogs.length})
              </button>
              <button
                onClick={() => setChronicleFilter('clash')}
                className={`px-2.5 py-1 rounded transition ${
                  chronicleFilter === 'clash'
                    ? 'bg-[#220000] text-rose-300 border border-rose-500/40 font-bold'
                    : 'bg-[#111] text-white/50 hover:text-white border border-transparent'
                }`}
              >
                ⚔️ Skirmishes &amp; Clashes
              </button>
              <button
                onClick={() => setChronicleFilter('leak')}
                className={`px-2.5 py-1 rounded transition ${
                  chronicleFilter === 'leak'
                    ? 'bg-[#180a29] text-purple-300 border border-purple-500/40 font-bold'
                    : 'bg-[#111] text-white/50 hover:text-white border border-transparent'
                }`}
              >
                🕵️ Intel Leaks
              </button>
              <button
                onClick={() => setChronicleFilter('casualty')}
                className={`px-2.5 py-1 rounded transition ${
                  chronicleFilter === 'casualty'
                    ? 'bg-[#2b0808] text-rose-300 border border-rose-600/40 font-bold'
                    : 'bg-[#111] text-white/50 hover:text-white border border-transparent'
                }`}
              >
                ☠️ Casualties &amp; Eliminations
              </button>
            </div>
          </div>

          {/* Active Alliances Panel if any */}
          {Object.keys(grailWar.alliances).length > 0 && (
            <div className="p-3 rounded-lg bg-[#111] border border-[#1a1a1a] flex items-center gap-3 text-xs font-mono">
              <span className="text-[10px] uppercase tracking-widest text-[#d4af37] font-bold">Active Covenants:</span>
              <div className="flex items-center gap-3 flex-wrap">
                {Object.values(grailWar.alliances).map(a => (
                  <span key={a.id} className="text-white/80 flex items-center gap-1.5 bg-[#160d24] px-2 py-0.5 rounded border border-[#a855f7]/30">
                    <Handshake className="w-3 h-3 text-[#a855f7]" />
                    {a.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Chronicle List */}
          <div className="max-h-[380px] overflow-y-auto space-y-2.5 font-mono text-xs scrollbar-thin pr-1">
            {grailWar.eventLogs
              .filter(evt => {
                const txt = (evt.text || '').toLowerCase();
                if (txt.includes('workshop defense') || txt.includes('auto-evacuation') || txt.includes('channeled mana') || txt.includes('bounded field')) {
                  return false;
                }
                if (chronicleFilter === 'all') return true;
                if (chronicleFilter === 'clash') return evt.type === 'clash' || evt.type === 'ambush';
                if (chronicleFilter === 'leak') return evt.type === 'intel_leak';
                if (chronicleFilter === 'casualty') return evt.type === 'casualty' || evt.type === 'elimination';
                return true;
              })
              .map(evt => {
                let displayText = evt.text;
                Object.values(grailWar.participants).forEach((participant, idx) => {
                  if (!participant.isExposed && participant.discordId !== master.discordId) {
                    if (participant.username && displayText.includes(participant.username)) {
                      displayText = displayText.replace(new RegExp(`Master \\*\\*${participant.username}\\*\\*`, 'g'), 'A Shadow Master');
                      displayText = displayText.replace(new RegExp(`\\*\\*${participant.username}\\*\\*`, 'g'), `Shadow Master #${idx + 1}`);
                      displayText = displayText.replace(new RegExp(participant.username, 'g'), `Shadow Master #${idx + 1}`);
                    }
                    if (participant.servantName && displayText.includes(participant.servantName)) {
                      displayText = displayText.replace(new RegExp(`\\*\\*${participant.servantName}\\*\\*`, 'g'), 'Heroic Spirit');
                      displayText = displayText.replace(new RegExp(participant.servantName, 'g'), 'Heroic Spirit');
                    }
                  }
                });

                return (
                  <div
                    key={evt.id}
                    className={`p-3 rounded-lg border flex items-start gap-3 transition ${
                      evt.type === 'elimination'
                        ? 'bg-[#220000]/70 border-[#ef4444]/40 text-rose-200'
                        : evt.type === 'casualty'
                        ? 'bg-[#2b0808] border-rose-600/50 text-rose-300'
                        : evt.type === 'exposure'
                        ? 'bg-[#261e05] border-[#f59e0b]/50 text-amber-300'
                        : evt.type === 'ambush'
                        ? 'bg-[#221008] border-[#ef4444]/40 text-orange-300'
                        : evt.type === 'intel_leak'
                        ? 'bg-[#180a29] border-purple-500/40 text-purple-200'
                        : evt.type === 'alliance'
                        ? 'bg-[#160d24] border-[#a855f7]/40 text-purple-300'
                        : evt.type === 'betrayal'
                        ? 'bg-[#261600] border-[#f59e0b]/40 text-amber-300'
                        : evt.type === 'heal'
                        ? 'bg-[#002200]/50 border-[#22c55e]/40 text-emerald-300'
                        : 'bg-[#111] border-[#1a1a1a] text-white/80'
                    }`}
                  >
                    <div className="text-[10px] text-white/40 whitespace-nowrap pt-0.5 font-mono">
                      {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                    <div className="leading-relaxed flex-1">{displayText}</div>
                  </div>
                );
              })}
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={handleResetWar}
              className="py-1.5 px-3 rounded bg-transparent hover:bg-[#111] text-white/40 hover:text-white text-[11px] font-mono uppercase tracking-wider border border-white/10 flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset 7-Master Tournament</span>
            </button>
          </div>
        </div>
      </div>

      {/* AMBUSH SUSPECT MODAL */}
      {showAmbushModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0e0e0e] border border-rose-500/40 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1a1a1a] pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-serif italic text-base">
                <Crosshair className="w-5 h-5 text-rose-400" />
                <span>Tactical Ambush Command (/attack & /ambush)</span>
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
