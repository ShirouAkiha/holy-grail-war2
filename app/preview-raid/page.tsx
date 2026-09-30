'use client';

import React, { useState } from 'react';

export default function RaidPreviewPage() {
  const [phase, setPhase] = useState<number>(3);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col items-center">
      <h1 className="text-3xl font-bold tracking-tight text-purple-400 mb-2">
        🐉 Tiamat Raid Canvas Live Visualizer
      </h1>
      <p className="text-slate-400 mb-6 text-center max-w-xl">
        Switch between phases below to instantly inspect Boss Sprite positions, sizing, and layering without needing to fight in Discord!
      </p>

      {/* Phase Selector Tabs */}
      <div className="flex space-x-3 mb-6 bg-slate-900 p-2 rounded-xl border border-slate-800">
        <button
          onClick={() => setPhase(1)}
          className={`px-5 py-2.5 rounded-lg font-medium transition-colors ${
            phase === 1
              ? 'bg-purple-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Phase 1: Femme Fatale
        </button>
        <button
          onClick={() => setPhase(2)}
          className={`px-5 py-2.5 rounded-lg font-medium transition-colors ${
            phase === 2
              ? 'bg-purple-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Phase 2: Titan Divine
        </button>
        <button
          onClick={() => setPhase(3)}
          className={`px-5 py-2.5 rounded-lg font-medium transition-colors ${
            phase === 3
              ? 'bg-purple-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Phase 3: True Draconic Maw
        </button>
      </div>

      {/* Canvas Render Frame Container */}
      <div className="relative rounded-2xl overflow-hidden border-2 border-purple-500/40 shadow-2xl bg-black max-w-5xl w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/preview_phase${phase}.png?t=${Date.now()}`}
          alt={`Tiamat Phase ${phase} Canvas Preview`}
          className="w-full h-auto object-contain block"
        />
      </div>

      <div className="mt-4 text-xs text-slate-500 text-center">
        Rendered Resolution: 1280 × 720 • Phase {phase} Settings Applied
      </div>
    </div>
  );
}
