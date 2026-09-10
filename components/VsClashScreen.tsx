'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Swords, Shield, Zap, Sparkles, ChevronRight, Volume2, VolumeX, FastForward, Play, RotateCcw } from 'lucide-react';
import { normalizeMediaUrl } from '../lib/utils/mediaResolver';

export interface VsClashScreenProps {
  challenger: {
    name: string;
    title: string;
    servantClass: string;
    avatarUrl?: string;
    masterName?: string;
    rarity?: number;
  };
  defender: {
    name: string;
    title: string;
    servantClass: string;
    avatarUrl?: string;
    masterName?: string;
    rarity?: number;
  };
  dialogue: {
    challengerLine: string;
    defenderLine: string;
    tag: string;
    themeColor?: string;
    isMirrorMatch?: boolean;
  };
  onEngage: () => void;
  onSkip?: () => void;
  autoAdvanceSeconds?: number;
}

export default function VsClashScreen({
  challenger,
  defender,
  dialogue,
  onEngage,
  onSkip,
  autoAdvanceSeconds = 8
}: VsClashScreenProps) {
  const [timeLeft, setTimeLeft] = useState(autoAdvanceSeconds);
  const [isPaused, setIsPaused] = useState(false);
  const [step, setStep] = useState<1 | 2>(1); // 1: Challenger speaks, 2: Defender retort appears

  const onEngageRef = useRef(onEngage);
  const onSkipRef = useRef(onSkip);

  useEffect(() => {
    onEngageRef.current = onEngage;
  }, [onEngage]);

  useEffect(() => {
    onSkipRef.current = onSkip;
  }, [onSkip]);

  const handleEngage = () => {
    onEngageRef.current?.();
  };

  const handleSkip = () => {
    if (onSkipRef.current) {
      onSkipRef.current();
    } else {
      onEngageRef.current?.();
    }
  };

  useEffect(() => {
    // Reveal defender's response after 1.2s
    const timer = setTimeout(() => {
      setStep(2);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          // Defer callback to macrotask queue so it never fires during render or state reconciliation
          setTimeout(() => {
            onEngageRef.current?.();
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused]);

  const classColorMap: Record<string, { border: string; bg: string; text: string }> = {
    Saber: { border: 'border-blue-500/60', bg: 'bg-blue-950/40', text: 'text-blue-400' },
    Archer: { border: 'border-red-500/60', bg: 'bg-red-950/40', text: 'text-red-400' },
    Lancer: { border: 'border-emerald-500/60', bg: 'bg-emerald-950/40', text: 'text-emerald-400' },
    Rider: { border: 'border-amber-500/60', bg: 'bg-amber-950/40', text: 'text-amber-400' },
    Caster: { border: 'border-purple-500/60', bg: 'bg-purple-950/40', text: 'text-purple-400' },
    Assassin: { border: 'border-slate-500/60', bg: 'bg-slate-900/60', text: 'text-slate-300' },
    Berserker: { border: 'border-rose-600/70', bg: 'bg-rose-950/50', text: 'text-rose-400' },
    Ruler: { border: 'border-yellow-400/70', bg: 'bg-yellow-950/40', text: 'text-yellow-300' },
    Avenger: { border: 'border-red-700/80', bg: 'bg-red-950/70', text: 'text-red-500' },
    Foreigner: { border: 'border-fuchsia-500/70', bg: 'bg-fuchsia-950/50', text: 'text-fuchsia-400' }
  };

  const cTheme = classColorMap[challenger.servantClass] || { border: 'border-amber-500/60', bg: 'bg-amber-950/40', text: 'text-amber-400' };
  const dTheme = classColorMap[defender.servantClass] || { border: 'border-rose-500/60', bg: 'bg-rose-950/40', text: 'text-rose-400' };

  return (
    <div
      id="vs-clash-overlay"
      className="relative w-full rounded-2xl overflow-hidden bg-gradient-to-b from-[#07090e] via-[#0b0f19] to-[#050608] border border-amber-500/30 shadow-[0_0_50px_rgba(0,0,0,0.8)] p-4 sm:p-6 my-4 transition-all animate-in fade-in zoom-in-95 duration-300"
    >
      {/* Background Decorative Energy Rays & Sparks */}
      <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-400/30 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(217,119,6,0.05)_25%,transparent_25%,transparent_50%,rgba(217,119,6,0.05)_50%,rgba(217,119,6,0.05)_75%,transparent_75%,transparent)] bg-[length:40px_40px] opacity-20 pointer-events-none" />

      {/* Top Banner & Matchup Tag */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3 mb-4 sm:mb-6">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping" />
          <span className="text-[10px] sm:text-xs font-mono uppercase tracking-widest text-amber-300/90 font-bold">
            ⚔️ Holy Grail War • Pre-Battle Face-Off
          </span>
        </div>

        {/* Thematic Encounter Tag */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs sm:text-sm font-serif font-bold text-amber-200 tracking-wide">
            {dialogue.tag}
          </span>
        </div>

        {/* Auto countdown & pause controls */}
        <div className="flex items-center gap-2 text-xs font-mono text-white/50">
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className="hover:text-white px-2 py-0.5 rounded bg-white/5 border border-white/10 transition-colors"
            title={isPaused ? "Resume auto timer" : "Pause auto timer"}
          >
            {isPaused ? "▶ Resume" : `⏳ ${timeLeft}s`}
          </button>
        </div>
      </div>

      {/* Main Clash Arena: Two Opposing Sides */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-11 gap-4 sm:gap-6 items-center">
        
        {/* LEFT / CHALLENGER SIDE (5 Columns on Large) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {/* Challenger Header Profile */}
          <div className="flex items-center gap-3 bg-white/[0.03] border border-white/10 p-2.5 rounded-xl">
            <div className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 ${cTheme.border} shadow-lg shrink-0`}>
              <img
                src={normalizeMediaUrl(challenger.avatarUrl || '') || 'https://ella.janitorai.com/media-approved/B9sAHeFp8-jdUk8VB4Y_f.webp'}
                alt={challenger.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <span className={`absolute bottom-0 right-0 text-[9px] font-bold px-1.5 py-0.5 rounded-tl-md ${cTheme.bg} ${cTheme.text} font-mono`}>
                {challenger.servantClass}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-mono tracking-wider text-amber-400 font-semibold">
                  Challenger
                </span>
                {challenger.masterName && (
                  <span className="text-[10px] text-white/40 font-mono">
                    • {challenger.masterName}
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-serif font-bold text-white truncate drop-shadow">
                {challenger.name}
              </h3>
              <p className="text-xs text-white/50 truncate italic">
                {challenger.title}
              </p>
            </div>
          </div>

          {/* Challenger Dialogue Speech Bubble */}
          <div className="relative bg-gradient-to-br from-[#121624] to-[#0c101c] border-l-4 border-l-amber-400 border border-white/10 p-3.5 sm:p-4 rounded-xl shadow-md transition-all">
            <div className="text-[10px] font-mono uppercase tracking-widest text-amber-400/80 mb-1 flex items-center gap-1">
              <span>❝ Challenge Dialogue</span>
            </div>
            <p className="text-xs sm:text-sm text-amber-100/90 font-serif italic leading-relaxed">
              &ldquo;{dialogue.challengerLine}&rdquo;
            </p>
          </div>
        </div>

        {/* CENTER VS METALLIC CREST (1 Column on Large) */}
        <div className="lg:col-span-1 flex flex-col items-center justify-center py-2 lg:py-0">
          <div className="relative flex items-center justify-center">
            {/* Glowing Aura Ring */}
            <div className="absolute w-16 h-16 rounded-full bg-amber-500/20 blur-xl animate-pulse" />
            <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-b from-[#241c10] via-[#15120d] to-[#080705] border-2 border-amber-400/80 shadow-[0_0_20px_rgba(245,158,11,0.5)]">
              <span className="text-lg sm:text-xl font-serif font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-400 to-yellow-600 drop-shadow">
                VS
              </span>
            </div>
          </div>
          <span className="hidden lg:block text-[9px] font-mono text-white/30 uppercase mt-1 tracking-widest">
            CLASH
          </span>
        </div>

        {/* RIGHT / DEFENDER SIDE (5 Columns on Large) */}
        <div className={`lg:col-span-5 flex flex-col gap-3 transition-all duration-500 ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-40 translate-y-2'}`}>
          {/* Defender Header Profile */}
          <div className="flex items-center gap-3 bg-white/[0.03] border border-white/10 p-2.5 rounded-xl">
            <div className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 ${dTheme.border} shadow-lg shrink-0`}>
              <img
                src={normalizeMediaUrl(defender.avatarUrl || '') || 'https://ella.janitorai.com/media-approved/4f4Ohvjxoy5qWV9FuCIpV.webp'}
                alt={defender.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <span className={`absolute bottom-0 right-0 text-[9px] font-bold px-1.5 py-0.5 rounded-tl-md ${dTheme.bg} ${dTheme.text} font-mono`}>
                {defender.servantClass}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-mono tracking-wider text-rose-400 font-semibold">
                  Opponent Retort
                </span>
                {defender.masterName && (
                  <span className="text-[10px] text-white/40 font-mono">
                    • {defender.masterName}
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-serif font-bold text-white truncate drop-shadow">
                {defender.name}
              </h3>
              <p className="text-xs text-white/50 truncate italic">
                {defender.title}
              </p>
            </div>
          </div>

          {/* Defender Retort Speech Bubble */}
          <div className="relative bg-gradient-to-br from-[#241316] to-[#140b0d] border-l-4 border-l-rose-500 border border-white/10 p-3.5 sm:p-4 rounded-xl shadow-md transition-all">
            <div className="text-[10px] font-mono uppercase tracking-widest text-rose-400/80 mb-1 flex items-center gap-1">
              <span>❝ Defender Comeback</span>
            </div>
            <p className="text-xs sm:text-sm text-rose-100/90 font-serif italic leading-relaxed">
              &ldquo;{dialogue.defenderLine}&rdquo;
            </p>
          </div>
        </div>

      </div>

      {/* Bottom Action Controls */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pt-4 sm:pt-5 mt-4 sm:mt-5 border-t border-white/10">
        <div className="flex items-center gap-2 text-xs text-white/40 font-mono">
          <span>Fate Tactical Combat Engine</span>
          {dialogue.isMirrorMatch && (
            <span className="px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px]">
              Mirror Entity Clash
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5 ml-auto">
          {onSkip && (
            <button
              type="button"
              onClick={handleSkip}
              className="px-3 py-1.5 rounded-lg text-xs font-mono text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              Skip Intro
            </button>
          )}

          <button
            type="button"
            onClick={handleEngage}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-serif font-bold text-sm shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-all hover:scale-105 active:scale-95"
          >
            <Swords className="w-4 h-4 text-black" />
            <span>COMMENCE COMBAT</span>
            <ChevronRight className="w-4 h-4 text-black" />
          </button>
        </div>
      </div>
    </div>
  );
}
