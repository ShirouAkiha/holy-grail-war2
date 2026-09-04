'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MasterProfile, GachaResultItem } from '../lib/types';
import {
  renderServantProfileCard,
  renderDialogueCard,
  renderBattleTurnSummary,
  renderGachaSummonBanner
} from '../lib/canvas/browserCanvas';
import { Image as ImageIcon, Download, Sparkles, RefreshCw } from 'lucide-react';

interface CanvasStudioProps {
  master: MasterProfile;
}

export default function CanvasStudio({ master }: CanvasStudioProps) {
  const activeServant = master.servants.find(s => s.id === master.activeServantId) || master.servants[0];

  const [activeTab, setActiveTab] = useState<'profile' | 'dialogue' | 'battle' | 'gacha'>('profile');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [dialogueSpeaker, setDialogueSpeaker] = useState(activeServant?.template.name || 'Artoria Pendragon');
  const [dialogueText, setDialogueText] = useState(
    activeServant?.customQuotes.summon || 'I ask of you: Are you my Master?'
  );

  useEffect(() => {
    if (!canvasRef.current || !activeServant) return;
    const canvas = canvasRef.current;

    if (activeTab === 'profile') {
      renderServantProfileCard(canvas, activeServant, master.username);
    } else if (activeTab === 'dialogue') {
      renderDialogueCard(
        canvas,
        dialogueSpeaker,
        dialogueText,
        activeServant.template.title,
        activeServant.template.servantClass
      );
    } else if (activeTab === 'battle') {
      const mockLog = {
        turnNumber: 3,
        actionSummary: `${activeServant.template.name} executed Buster Brave Chain, dealing 14,800 damage!`,
        p1DamageDealt: 14800,
        p2DamageDealt: 4200,
        p1HpRemaining: 12500,
        p2HpRemaining: 6800,
        npChant: activeServant.customQuotes.noblePhantasm
      };
      const p1 = {
        id: 'p1',
        masterName: master.username,
        name: activeServant.template.name,
        servantClass: activeServant.template.servantClass,
        currentHp: 12500,
        maxHp: 16000,
        atk: 12000,
        def: 9500,
        npGauge: 100,
        critStars: 30,
        commandDeck: activeServant.template.commandDeck,
        skills: [],
        noblePhantasm: activeServant.template.noblePhantasm,
        quotes: activeServant.customQuotes,
        statusEffects: []
      };
      const p2 = { ...p1, id: 'p2', name: 'Gilgamesh', servantClass: 'Archer', currentHp: 6800, maxHp: 15500 };
      renderBattleTurnSummary(canvas, mockLog as any, p1 as any, p2 as any);
    } else if (activeTab === 'gacha') {
      const mockResults: GachaResultItem[] = [
        { type: 'servant' as const, item: activeServant.template, rarity: 5, isNew: true, isRateUp: true },
        { type: 'craft_essence' as const, item: master.craftEssences[0], rarity: 5, isNew: false, isRateUp: false },
        { type: 'servant' as const, item: master.servants[1]?.template || activeServant.template, rarity: 4, isNew: false, isRateUp: false }
      ];
      renderGachaSummonBanner(canvas, mockResults, 'Fuyuki Holy Grail War Banner');
    }
  }, [activeTab, activeServant, dialogueSpeaker, dialogueText, master.craftEssences, master.servants, master.username]);

  const handleDownloadImage = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `holy_grail_war_${activeTab}_render.png`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-[#0a0a0a] rounded-xl border border-[#1a1a1a]">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-sm bg-[#161616] text-[#d4af37] border border-[#d4af37]/30">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-serif italic text-white tracking-wide">@napi-rs/canvas 2D Studio</h2>
            <p className="text-[11px] font-mono text-white/40 uppercase tracking-wider">
              Live visual preview of dynamic cards generated as Discord attachments
            </p>
          </div>
        </div>

        <button
          onClick={handleDownloadImage}
          className="px-4 py-2 rounded-sm bg-[#d4af37] hover:bg-[#c49f27] text-black font-bold font-mono text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Rendered PNG</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#1a1a1a] pb-3">
        {[
          { id: 'profile' as const, label: 'Servant Status Card (850x390)' },
          { id: 'dialogue' as const, label: 'Dialogue Card (800x240)' },
          { id: 'battle' as const, label: 'Battle Clash (640x640 Square)' },
          { id: 'gacha' as const, label: 'Summon Banner (900x420)' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3.5 py-1.5 rounded-sm text-xs font-mono uppercase tracking-wider transition border ${
              activeTab === t.id
                ? 'bg-[#161616] text-[#d4af37] border-[#d4af37]'
                : 'bg-[#0a0a0a] text-white/40 border-[#1a1a1a] hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Customizable inputs if Dialogue Tab */}
      {activeTab === 'dialogue' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-[#0a0a0a] rounded-xl border border-[#1a1a1a]">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-white/40 block mb-1">Speaker Name</label>
            <input
              type="text"
              value={dialogueSpeaker}
              onChange={e => setDialogueSpeaker(e.target.value)}
              className="w-full bg-[#111] text-white font-mono text-xs px-3 py-2 rounded-sm border border-[#222] outline-none focus:border-[#d4af37]"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-white/40 block mb-1">Dialogue Quote</label>
            <input
              type="text"
              value={dialogueText}
              onChange={e => setDialogueText(e.target.value)}
              className="w-full bg-[#111] text-white font-mono text-xs px-3 py-2 rounded-sm border border-[#222] outline-none focus:border-[#d4af37]"
            />
          </div>
        </div>
      )}

      {/* Canvas Viewport */}
      <div className="p-6 rounded-xl bg-[#050505] border border-[#1a1a1a] flex items-center justify-center overflow-x-auto shadow-2xl">
        <canvas ref={canvasRef} className="rounded-lg border border-[#1a1a1a] shadow-2xl max-w-full h-auto" />
      </div>
    </div>
  );
}
