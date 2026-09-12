'use client';

import React, { useState } from 'react';
import { MasterProfile, MasterServantInstance, BondEvent, BondDialogueLine } from '../lib/types';
import {
  getBondExpProgress,
  getBondEventsForServant,
  getUnlockedDialogueLinesForServant
} from '../lib/engine/bondEvents';
import { BondVisualNovelModal } from './BondVisualNovelModal';
import { Heart, Sparkles, BookOpen, Volume2, Award, Shield, ChevronRight, Lock, CheckCircle2, Play, Users } from 'lucide-react';

interface BondSanctumProps {
  master: MasterProfile;
  onUpdateMasterProfile: (updated: MasterProfile) => void;
}

export const BondSanctum: React.FC<BondSanctumProps> = ({
  master,
  onUpdateMasterProfile
}) => {
  const [selectedServantId, setSelectedServantId] = useState<string>(
    master.activeServantId || master.servants[0]?.id || ''
  );
  const [activeTab, setActiveTab] = useState<'events' | 'dialogue' | 'rewards'>('events');

  // Active Bond Event being played in Visual Novel modal
  const [playingEvent, setPlayingEvent] = useState<BondEvent | null>(null);

  // Active playing dialogue line preview
  const [playingQuoteId, setPlayingQuoteId] = useState<string | null>(null);

  const selectedServant = master.servants.find(s => s.id === selectedServantId) || master.servants[0];

  if (!selectedServant) {
    return (
      <div className="p-8 text-center text-slate-400">
        No Servants summoned yet. Summon Servants in the Summoning Sanctum first!
      </div>
    );
  }

  const template = selectedServant.template;
  const bondProgress = getBondExpProgress(selectedServant.bondExp || 0);
  const availableEvents = getBondEventsForServant(selectedServant);
  const unlockedLines = getUnlockedDialogueLinesForServant(selectedServant);

  // Handle completion of a Visual Novel event
  const handleCompleteEvent = (updatedServant: MasterServantInstance, rewardSq: number) => {
    const updatedServants = master.servants.map(s =>
      s.id === updatedServant.id ? updatedServant : s
    );

    const updatedProfile: MasterProfile = {
      ...master,
      saintQuartz: master.saintQuartz + rewardSq,
      servants: updatedServants
    };

    onUpdateMasterProfile(updatedProfile);
    setPlayingEvent(null);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 space-y-6 text-slate-100">
      
      {/* SERVANT SELECTOR STRIP */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap flex items-center gap-1.5 px-2">
          <Users className="w-4 h-4 text-amber-400" /> Contracted Servants:
        </span>
        {master.servants.map(s => {
          const isSelected = s.id === selectedServantId;
          const sTemplate = s.template;
          return (
            <button
              key={s.id}
              onClick={() => setSelectedServantId(s.id)}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all whitespace-nowrap ${
                isSelected
                  ? 'bg-amber-500/15 border-amber-500/60 text-amber-200 shadow-lg shadow-amber-500/10'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <img
                src={s.avatarUrl || sTemplate.avatarUrl}
                alt={sTemplate.name}
                className="w-7 h-7 rounded-full object-cover border border-amber-400/40"
                referrerPolicy="no-referrer"
              />
              <div className="text-left">
                <div className="text-xs font-bold leading-tight">{sTemplate.name}</div>
                <div className="text-[10px] text-amber-400/90 font-mono">Bond Lv. {s.bondLevel || 1}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* HERO HEROIC SPIRIT BOND HEADER CARD */}
      <div className="relative rounded-2xl border border-amber-500/30 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/60 p-6 shadow-2xl overflow-hidden">
        
        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row items-center md:items-start gap-6 z-10">
          
          {/* Portrait */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-yellow-600 rounded-2xl blur opacity-40 group-hover:opacity-75 transition duration-300" />
            <img
              src={selectedServant.avatarUrl || template.avatarUrl}
              alt={template.name}
              className="relative w-36 h-36 md:w-44 md:h-44 object-cover rounded-2xl border-2 border-amber-400/60 shadow-2xl"
              referrerPolicy="no-referrer"
            />
            <div className="absolute bottom-2 right-2 px-2.5 py-0.5 rounded-full bg-slate-950/90 border border-amber-400 text-amber-300 text-xs font-mono font-bold">
              ★ {template.rarity}
            </div>
          </div>

          {/* Details & Bond Meter */}
          <div className="flex-1 text-center md:text-left space-y-3">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
                {template.servantClass} Class
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold">
                {template.title}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-100">{template.name}</h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl line-clamp-2 leading-relaxed">
              {template.lore}
            </p>

            {/* Bond Progress Bar */}
            <div className="pt-2 max-w-xl">
              <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
                <span className="text-amber-300 flex items-center gap-1.5">
                  <Heart className="w-4 h-4 fill-amber-400/40 text-amber-400" />
                  Master Bond Progress
                </span>
                <span className="text-amber-400 font-mono font-bold text-sm">
                  Bond Lv. {selectedServant.bondLevel || 1} / 10
                </span>
              </div>
              
              <div className="w-full h-3.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-amber-500/30 shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 rounded-full transition-all duration-700 shadow-md"
                  style={{ width: `${bondProgress.progressPercent}%` }}
                />
              </div>

              <div className="flex justify-between text-[11px] text-slate-400 mt-1 font-mono">
                <span>Total Bond EXP: {selectedServant.bondExp || 0}</span>
                <span>{bondProgress.isMaxBond ? 'MAX BOND REACHED' : `${bondProgress.neededForNextLevel - bondProgress.expInCurrentLevel} EXP to Lv. ${(selectedServant.bondLevel || 1) + 1}`}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab('events')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'events'
              ? 'border-amber-400 text-amber-300 bg-amber-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Visual Novel Bond Events ({availableEvents.length})
        </button>

        <button
          onClick={() => setActiveTab('dialogue')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'dialogue'
              ? 'border-amber-400 text-amber-300 bg-amber-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Volume2 className="w-4 h-4" />
          My Room Quotes ({unlockedLines.length})
        </button>

        <button
          onClick={() => setActiveTab('rewards')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'rewards'
              ? 'border-amber-400 text-amber-300 bg-amber-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Award className="w-4 h-4" />
          Bond Milestones & Rewards
        </button>
      </div>

      {/* TAB CONTENT 1: VISUAL NOVEL BOND EVENTS */}
      {activeTab === 'events' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {availableEvents.map(evt => {
            const isCompleted = selectedServant.completedBondEvents?.includes(evt.id);
            const isUnlocked = (selectedServant.bondLevel || 1) >= evt.requiredBondLevel;

            return (
              <div
                key={evt.id}
                className={`relative rounded-xl border p-5 flex flex-col justify-between transition-all ${
                  isUnlocked
                    ? 'bg-slate-900/80 border-amber-500/40 hover:border-amber-400 shadow-lg'
                    : 'bg-slate-950/60 border-slate-800/80 opacity-65'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300">
                      Unlocks at Bond Lv. {evt.requiredBondLevel}
                    </span>
                    {isCompleted ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                      </span>
                    ) : isUnlocked ? (
                      <span className="text-xs font-semibold text-amber-400 animate-pulse">
                        Ready to Play!
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Lock className="w-3.5 h-3.5" /> Locked
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-slate-100">{evt.title}</h3>
                  <div className="text-xs text-amber-400/90 font-medium mb-2">{evt.subtitle}</div>
                  <p className="text-xs text-slate-300 leading-relaxed mb-4">{evt.description}</p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1 text-amber-300 font-mono">
                      <Heart className="w-3.5 h-3.5 fill-amber-300/30" /> +{evt.rewardBondExp} EXP
                    </span>
                    <span className="flex items-center gap-1 text-cyan-300 font-mono">
                      <Sparkles className="w-3.5 h-3.5" /> +{evt.rewardSaintQuartz || 3} SQ
                    </span>
                  </div>

                  <button
                    onClick={() => setPlayingEvent(evt)}
                    disabled={!isUnlocked}
                    className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                      isUnlocked
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-md'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isCompleted ? 'Replay Event' : 'Play VN Interlude'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB CONTENT 2: MY ROOM DIALOGUE PLAYER */}
      {activeTab === 'dialogue' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
            <span>Click any unlocked quote to hear and review {template.name}&apos;s voice line!</span>
            <span className="font-mono text-amber-400">{unlockedLines.length} Quotes Unlocked</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {unlockedLines.map(line => {
              const isPlaying = playingQuoteId === line.id;

              return (
                <div
                  key={line.id}
                  onClick={() => setPlayingQuoteId(line.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isPlaying
                      ? 'bg-amber-950/40 border-amber-400 shadow-lg'
                      : 'bg-slate-900/80 border-slate-800 hover:border-amber-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                      {line.title}
                    </span>
                    <Volume2 className={`w-4 h-4 ${isPlaying ? 'text-amber-400 animate-bounce' : 'text-slate-500'}`} />
                  </div>

                  <p className="text-xs sm:text-sm text-slate-200 font-sans italic leading-relaxed">
                    “{line.quoteText}”
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: BOND MILESTONES & REWARDS */}
      {activeTab === 'rewards' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase">Bond Level 1 - 4</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <h4 className="text-sm font-bold text-slate-100">Personal Lore & Voice Quotes</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Unlocks initial My Room dialogue lines, combat Brave Chain quotes, and basic servant history.
            </p>
          </div>

          <div className={`p-5 rounded-xl border space-y-2 ${
            (selectedServant.bondLevel || 1) >= 5
              ? 'border-emerald-500/40 bg-slate-900/80'
              : 'border-slate-800 bg-slate-950/60 opacity-60'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-400 uppercase">Bond Level 5</span>
              {(selectedServant.bondLevel || 1) >= 5 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Lock className="w-4 h-4 text-slate-500" />
              )}
            </div>
            <h4 className="text-sm font-bold text-slate-100">2nd Passive Skill Slot Unlocked</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Unlocks the Servant&apos;s secondary Passive Skill in Holy Grail War combat!
            </p>
          </div>

          <div className={`p-5 rounded-xl border space-y-2 ${
            (selectedServant.bondLevel || 1) >= 10
              ? 'border-amber-400 bg-amber-950/30'
              : 'border-slate-800 bg-slate-950/60 opacity-60'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase">Bond Level 10</span>
              {(selectedServant.bondLevel || 1) >= 10 ? (
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
              ) : (
                <Lock className="w-4 h-4 text-slate-500" />
              )}
            </div>
            <h4 className="text-sm font-bold text-slate-100">Max Bond 5★ Craft Essence</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Grants an exclusive, unique 5★ Craft Essence forged from the Servant&apos;s legend!
            </p>
          </div>
        </div>
      )}

      {/* VISUAL NOVEL MODAL */}
      <BondVisualNovelModal
        isOpen={!!playingEvent}
        event={playingEvent}
        servant={selectedServant}
        onClose={() => setPlayingEvent(null)}
        onComplete={handleCompleteEvent}
      />
    </div>
  );
};
