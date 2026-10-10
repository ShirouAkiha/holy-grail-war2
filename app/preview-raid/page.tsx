'use client';

import React, { useState } from 'react';

export default function RaidPreviewPage() {
  const [selectedBoss, setSelectedBoss] = useState<'sakura' | 'tiamat'>('sakura');
  const [phase, setPhase] = useState<number>(1);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col items-center">
      {/* Header */}
      <div className="text-center max-w-2xl mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-fuchsia-400 to-purple-400 mb-2">
          🔱 Chaldea Raid Boss Terminal & Canvas Visualizer
        </h1>
        <p className="text-slate-400 text-sm">
          Inspect boss battle configurations, canvas stages, interactive dialogue systems, and the new Dark Sakura Karma Ledger without needing Discord!
        </p>
      </div>

      {/* Boss Selector Tabs */}
      <div className="flex space-x-3 mb-6 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
        <button
          onClick={() => { setSelectedBoss('sakura'); setPhase(1); }}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all ${
            selectedBoss === 'sakura'
              ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-lg shadow-rose-900/40 ring-1 ring-rose-400/50'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <span>🌸</span>
          <span>Dark Sakura (Fuyuki Cavity)</span>
        </button>
        <button
          onClick={() => { setSelectedBoss('tiamat'); setPhase(1); }}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all ${
            selectedBoss === 'tiamat'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-900/40 ring-1 ring-purple-400/50'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <span>🌊</span>
          <span>Beast II / Tiamat (Chaos Sea)</span>
        </button>
      </div>

      {/* Dark Sakura Showcase */}
      {selectedBoss === 'sakura' ? (
        <div className="max-w-5xl w-full flex flex-col space-y-6">
          {/* Phase Switcher */}
          <div className="flex justify-center space-x-3 bg-slate-900 p-2 rounded-xl border border-slate-800 self-center">
            <button
              onClick={() => setPhase(1)}
              className={`px-5 py-2 rounded-lg font-medium text-sm transition-colors ${
                phase === 1 ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Phase 1: Shadow Maiden (1.8M HP)
            </button>
            <button
              onClick={() => setPhase(2)}
              className={`px-5 py-2 rounded-lg font-medium text-sm transition-colors ${
                phase === 2 ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Phase 2: Black Grail Incarnation (2.7M HP)
            </button>
          </div>

          {/* Visual Presentation Arena */}
          <div className="relative rounded-2xl overflow-hidden border-2 border-rose-500/30 shadow-2xl bg-black aspect-[16/9] w-full flex items-center justify-center">
            <img
              src="https://ella.janitorai.com/media-approved/P7i39PiVJeiUHbbq3dSn1.webp"
              alt="Grail Cave Background"
              className="absolute inset-0 w-full h-full object-cover opacity-80"
            />
            {/* Dark vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 pointer-events-none" />

            {/* Boss Sprite on Left */}
            <div className="absolute left-16 bottom-8 z-10 flex flex-col items-center">
              <div className="w-56 h-10 bg-black/80 rounded-[50%] blur-sm mb-[-20px] border border-rose-500/20" />
              <img
                src="https://ella.janitorai.com/media-approved/1_g6bqriIhxa4tLhBalDY.webp"
                alt="Dark Sakura Battle Sprite"
                className="h-[420px] object-contain drop-shadow-[0_15px_25px_rgba(225,29,72,0.4)]"
              />
            </div>

            {/* In-battle HUD Overlay Preview */}
            <div className="absolute top-6 left-6 z-20 flex items-center space-x-4 bg-slate-950/80 p-3 rounded-xl border border-rose-500/30 backdrop-blur-md">
              <img
                src="https://ella.janitorai.com/media-approved/mOhtzJN0kQulMvmZWa0l2.webp"
                alt="Dark Sakura Portrait"
                className="w-14 h-14 rounded-full border-2 border-rose-500 object-cover"
              />
              <div>
                <div className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                  Avenger • Lv.92 • {phase === 1 ? 'Shadow Maiden' : 'All The World’s Evil'}
                </div>
                <div className="text-lg font-black text-white">
                  {phase === 1 ? 'Dark Sakura' : 'Dark Sakura (Black Grail)'}
                </div>
                <div className="w-64 bg-slate-800 h-3 rounded-full overflow-hidden mt-1 border border-slate-700">
                  <div className="bg-gradient-to-r from-rose-700 via-rose-500 to-pink-400 h-full w-[85%]" />
                </div>
              </div>
            </div>

            {/* Dialogue Preview Box */}
            <div className="absolute bottom-6 right-6 left-80 z-20 bg-slate-950/90 border border-rose-500/40 rounded-xl p-4 backdrop-blur-md shadow-2xl">
              <div className="flex items-center space-x-2 text-rose-400 text-xs font-bold uppercase mb-1">
                <span>💬</span>
                <span>Reactive Self-Aware Encounter Voice</span>
              </div>
              <p className="text-sm text-slate-200 italic leading-relaxed">
                “Another challenger seeking Grail fragments... Are you going to cut me down like a true magus, or pretend to be my savior today? You Masters are all the same.”
              </p>
            </div>
          </div>

          {/* Mechanics & Karma Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <div className="text-rose-400 font-bold text-sm mb-2 flex items-center space-x-2">
                <span>⚖️</span>
                <span>The End Climax Dilemma</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                At 0 HP, each Master privately chooses:
                <br /><strong className="text-slate-200">• [Execute]:</strong> Safe guaranteed drops (16-28 SQ, 45k EXP).
                <br /><strong className="text-rose-300">• [Spare]:</strong> Trust roulette. High karma yields <span className="text-emerald-400 font-bold">2X Doubled Drops (32-56 SQ)</span> + ★5 CE! Low karma devours you!
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <div className="text-purple-400 font-bold text-sm mb-2 flex items-center space-x-2">
                <span>💖</span>
                <span>Pacifist Devotion Milestone</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Masters who consistently spare her without ever killing unlock <strong className="text-purple-300">Tier 4 Sanctuary</strong>.
                She cancels the fight, smiles warmly, pats your head, and grants free maximum double rewards peacefully!
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <div className="text-amber-400 font-bold text-sm mb-2 flex items-center space-x-2">
                <span>👥</span>
                <span>Co-op Party Dynamics</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                In multi-player teams, Dark Sakura evaluates party contrast. If a merciful Host brings a notorious Slayer ally, she calls them out in the intro! At the end, personal decisions ensure no griefing.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Tiamat Visualizer */
        <div className="max-w-5xl w-full flex flex-col space-y-6">
          <div className="flex justify-center space-x-3 bg-slate-900 p-2 rounded-xl border border-slate-800 self-center">
            <button
              onClick={() => setPhase(1)}
              className={`px-5 py-2 rounded-lg font-medium text-sm transition-colors ${
                phase === 1 ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Phase 1: Femme Fatale
            </button>
            <button
              onClick={() => setPhase(2)}
              className={`px-5 py-2 rounded-lg font-medium text-sm transition-colors ${
                phase === 2 ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Phase 2: Titan Divine
            </button>
            <button
              onClick={() => setPhase(3)}
              className={`px-5 py-2 rounded-lg font-medium text-sm transition-colors ${
                phase === 3 ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Phase 3: True Draconic Maw
            </button>
          </div>

          <div className="relative rounded-2xl overflow-hidden border-2 border-purple-500/40 shadow-2xl bg-black max-w-5xl w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/preview_phase${phase}.png?t=${Date.now()}`}
              alt={`Tiamat Phase ${phase} Canvas Preview`}
              className="w-full h-auto object-contain block"
            />
          </div>
        </div>
      )}

      <div className="mt-8 text-xs text-slate-500 text-center">
        Holy Grail War PvE Engine • Raid Boss Subsystem • Port 3000
      </div>
    </div>
  );
}

