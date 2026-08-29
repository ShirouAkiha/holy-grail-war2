'use client';

import React, { useState } from 'react';
import { GachaBanner, GachaResultItem, MasterProfile } from '../lib/types';
import { GACHA_BANNERS } from '../lib/data/craftEssences';
import { executeGachaRoll } from '../lib/engine/gacha';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  Shield,
  Coins,
  ChevronRight,
  RefreshCw,
  Award,
  Flame,
  Info
} from 'lucide-react';

interface GachaPortalProps {
  master: MasterProfile;
  onUpdateMaster: (master: MasterProfile) => void;
}

export default function GachaPortal({ master, onUpdateMaster }: GachaPortalProps) {
  const [selectedBannerId, setSelectedBannerId] = useState<string>(GACHA_BANNERS[0].id);
  const [lastResults, setLastResults] = useState<GachaResultItem[] | null>(null);
  const [isPulling, setIsPulling] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeBanner = GACHA_BANNERS.find(b => b.id === selectedBannerId) || GACHA_BANNERS[0];

  const handleSummon = (count: 1 | 10) => {
    setErrorMsg(null);
    setIsPulling(true);

    try {
      const res = executeGachaRoll({
        banner: activeBanner,
        count,
        master
      });

      setTimeout(() => {
        onUpdateMaster(res.updatedMaster);
        setLastResults(res.results);
        setIsPulling(false);

        // Fire confetti on SSR 5-star pull
        if (res.results.some(r => r.rarity === 5)) {
          confetti({
            particleCount: 120,
            spread: 90,
            origin: { y: 0.6 }
          });
        }
      }, 700);
    } catch (err: any) {
      setErrorMsg(err.message);
      setIsPulling(false);
    }
  };

  const handleAddFreeQuartz = () => {
    onUpdateMaster({
      ...master,
      saintQuartz: master.saintQuartz + 30
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Selection & Resource Counter */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-[#0a0a0a] rounded-xl border border-[#1a1a1a]">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-sm bg-[#161616] text-[#d4af37] border border-[#d4af37]/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-serif italic text-white tracking-wide">Chaldea Summoning Gate</h2>
            <p className="text-[11px] font-mono text-white/40 uppercase tracking-wider">
              Form contracts with Heroic Spirits across time & lore
            </p>
          </div>
        </div>

        {/* Currency Display & Free Topup */}
        <div className="flex items-center gap-2.5">
          <div className="px-3.5 py-1.5 rounded-sm bg-[#111] border border-[#1a1a1a] text-xs font-mono text-[#d4af37] flex items-center gap-2">
            <span className="text-white/40 uppercase text-[10px]">Saint Quartz:</span>
            <span className="font-bold">{master.saintQuartz}</span>
          </div>

          <div className="px-3 py-1.5 rounded-sm bg-[#111] border border-[#1a1a1a] text-xs font-mono text-white/70">
            Pity: <strong className="text-white">{master.pityCount}/90</strong>
          </div>

          <button
            onClick={handleAddFreeQuartz}
            className="px-3 py-1.5 rounded-sm bg-transparent hover:bg-[#161616] text-white/70 hover:text-white text-xs font-mono uppercase tracking-wider border border-white/20 transition"
          >
            +30 Free SQ
          </button>
        </div>
      </div>

      {/* Banner Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {GACHA_BANNERS.map(banner => (
          <button
            key={banner.id}
            onClick={() => setSelectedBannerId(banner.id)}
            className={`px-4 py-2 rounded-sm font-mono text-xs uppercase tracking-wider whitespace-nowrap transition-all border ${
              selectedBannerId === banner.id
                ? 'bg-[#161616] text-[#d4af37] border-[#d4af37] shadow-[0_0_8px_rgba(212,175,55,0.15)]'
                : 'bg-[#0a0a0a] text-white/50 border-[#1a1a1a] hover:bg-[#111] hover:text-white'
            }`}
          >
            {banner.title.split(':')[0]}
          </button>
        ))}
      </div>

      {/* Active Banner Showcase Card */}
      <div className="p-8 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] shadow-2xl relative overflow-hidden">
        <div className="max-w-xl space-y-3.5 relative z-10">
          <span className="px-2.5 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-widest bg-[#161616] text-[#d4af37] border border-[#d4af37]/40">
            {activeBanner.bannerType.replace('_', ' ')} RATE-UP
          </span>
          <h3 className="text-2xl sm:text-3xl font-serif italic text-white">{activeBanner.title}</h3>
          <p className="text-xs font-mono text-[#d4af37] uppercase tracking-wider">{activeBanner.subtitle}</p>
          <p className="text-xs font-mono text-white/60 leading-relaxed">{activeBanner.description}</p>

          <div className="flex flex-wrap gap-4 pt-2 text-xs font-mono text-white/40">
            <div>
              5★ SSR Servant: <strong className="text-[#d4af37]">{activeBanner.rates.ssrServant}%</strong>
            </div>
            <div>
              4★ SR Servant: <strong className="text-[#c084fc]">{activeBanner.rates.srServant}%</strong>
            </div>
            <div>
              5★ SSR Craft Essence: <strong className="text-[#60a5fa]">{activeBanner.rates.ssrCe}%</strong>
            </div>
          </div>
        </div>

        {/* Summon Action Buttons */}
        <div className="flex flex-wrap gap-3.5 mt-7 relative z-10">
          <button
            disabled={isPulling || master.saintQuartz < 3}
            onClick={() => handleSummon(1)}
            className="px-6 py-2.5 rounded-sm bg-transparent hover:bg-[#161616] text-white font-mono text-xs uppercase tracking-wider border border-white/20 transition disabled:opacity-30"
          >
            Summon 1x (3 SQ)
          </button>

          <button
            disabled={isPulling || master.saintQuartz < 30}
            onClick={() => handleSummon(10)}
            className="px-7 py-2.5 rounded-sm bg-[#d4af37] hover:bg-[#c49f27] text-black font-bold font-mono text-xs uppercase tracking-widest shadow-xl transition disabled:opacity-30 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Summon 10x (30 SQ • Guaranteed 4★+)</span>
          </button>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mt-4 p-3 rounded-sm bg-[#220000] border border-[#ef4444]/40 text-[#ef4444] text-xs font-mono">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Summon Results Reveal Area */}
      {lastResults && (
        <div className="p-6 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-[#1a1a1a] pb-3">
            <h4 className="text-sm font-serif italic text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-[#d4af37]" /> Summon Results Reveal ({lastResults.length} Items)
            </h4>
            <span className="text-xs font-mono text-white/40">Pity: {master.pityCount}/90</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {lastResults.map((res, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border transition-all flex flex-col items-center text-center relative overflow-hidden ${
                  res.rarity === 5
                    ? 'bg-[#161616] border-[#d4af37] shadow-[0_0_15px_rgba(212,175,55,0.2)]'
                    : res.rarity === 4
                    ? 'bg-[#141018] border-[#a855f7]/60 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                    : 'bg-[#111] border-[#1a1a1a]'
                }`}
              >
                {res.isNew && (
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-sm bg-[#ef4444] text-white text-[9px] font-mono font-bold tracking-wider">
                    NEW
                  </div>
                )}

                <span
                  className={`text-[9px] font-mono uppercase tracking-widest mb-1 ${
                    res.type === 'servant' ? 'text-[#3b82f6]' : 'text-[#22c55e]'
                  }`}
                >
                  {res.type === 'servant' ? 'SERVANT' : 'CRAFT ESSENCE'}
                </span>

                <div className="text-[#d4af37] font-mono text-xs mb-2">{'★'.repeat(res.rarity)}</div>

                <div className="w-12 h-12 rounded-sm bg-[#161616] border border-white/10 flex items-center justify-center text-lg mb-2">
                  {res.type === 'servant' ? '⚔️' : '🛡️'}
                </div>

                <div className="font-serif italic text-xs text-white line-clamp-1">{res.item.name}</div>
                <div className="text-[10px] font-mono text-white/40 mt-1 line-clamp-1">
                  {res.type === 'servant'
                    ? (res.item as any).title
                    : (res.item as any).effectText}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
