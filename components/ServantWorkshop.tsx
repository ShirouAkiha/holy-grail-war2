'use client';

import React, { useState } from 'react';
import { MasterProfile, MasterServantInstance, ServantStats } from '../lib/types';
import { CRAFT_ESSENCE_DATABASE } from '../lib/data/craftEssences';
import {
  allocateStatPoints,
  equipCraftEssence,
  updateCustomDialogueQuotes,
  calculateRadarCoordinates
} from '../lib/engine/customization';
import {
  User,
  Shield,
  Zap,
  Sparkles,
  Edit3,
  Check,
  Award,
  BookOpen,
  Sword
} from 'lucide-react';

interface ServantWorkshopProps {
  master: MasterProfile;
  onUpdateMaster: (master: MasterProfile) => void;
}

export default function ServantWorkshop({ master, onUpdateMaster }: ServantWorkshopProps) {
  const activeServant = master.servants.find(s => s.id === master.activeServantId) || master.servants[0];
  const [selectedServantId, setSelectedServantId] = useState<string>(activeServant?.id || '');

  const currentServant = master.servants.find(s => s.id === selectedServantId) || activeServant;

  const [summonQuote, setSummonQuote] = useState(currentServant?.customQuotes.summon || '');
  const [battleQuote, setBattleQuote] = useState(currentServant?.customQuotes.battleStart || '');
  const [npChant, setNpChant] = useState(currentServant?.customQuotes.noblePhantasm || '');
  const [victoryQuote, setVictoryQuote] = useState(currentServant?.customQuotes.victory || '');
  const [saveFeedback, setSaveFeedback] = useState(false);

  if (!currentServant) {
    return (
      <div className="p-8 text-center bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] text-[#e5e5e5]">
        <h3 className="text-xl font-serif italic text-white mb-2">No Servants Available</h3>
        <p className="text-xs text-white/40 font-mono">Summon your first Heroic Spirit to access the workshop!</p>
      </div>
    );
  }

  const handleAddStat = (statKey: keyof ServantStats) => {
    if (currentServant.availableStatPoints <= 0) return;
    try {
      const updated = allocateStatPoints(currentServant, { [statKey]: 1 });
      const updatedServants = master.servants.map(s => (s.id === updated.id ? updated : s));
      onUpdateMaster({ ...master, servants: updatedServants });
    } catch (err) {
      console.error(err);
    }
  };

  const handleEquipCe = (ceId?: string) => {
    try {
      const updated = equipCraftEssence(currentServant, ceId);
      const updatedServants = master.servants.map(s => (s.id === updated.id ? updated : s));
      onUpdateMaster({ ...master, servants: updatedServants });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveQuotes = () => {
    const updated = updateCustomDialogueQuotes(currentServant, {
      summon: summonQuote,
      battleStart: battleQuote,
      noblePhantasm: npChant,
      victory: victoryQuote
    });
    const updatedServants = master.servants.map(s => (s.id === updated.id ? updated : s));
    onUpdateMaster({ ...master, servants: updatedServants });
    setSaveFeedback(true);
    setTimeout(() => setSaveFeedback(false), 3000);
  };

  const handleSetActive = (servantId: string) => {
    onUpdateMaster({ ...master, activeServantId: servantId });
    setSelectedServantId(servantId);
  };

  // Radar chart calculation
  const totalStats: ServantStats = {
    strength: currentServant.template.baseStats.strength + (currentServant.allocatedStats.strength || 0),
    endurance: currentServant.template.baseStats.endurance + (currentServant.allocatedStats.endurance || 0),
    agility: currentServant.template.baseStats.agility + (currentServant.allocatedStats.agility || 0),
    mana: currentServant.template.baseStats.mana + (currentServant.allocatedStats.mana || 0),
    luck: currentServant.template.baseStats.luck + (currentServant.allocatedStats.luck || 0)
  };
  const radar = calculateRadarCoordinates(totalStats, 100, 100, 70, 30);

  return (
    <div className="space-y-6">
      {/* Top Header & Servant Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-[#0a0a0a] rounded-xl border border-[#1a1a1a]">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-sm bg-[#161616] text-[#d4af37] border border-[#d4af37]/30">
            <Sword className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-serif italic text-white tracking-wide">Servant Workshop & Stats</h2>
            <p className="text-[11px] font-mono text-white/40 uppercase tracking-wider">
              Allocate Master stat points, equip Craft Essences, and write battle chants
            </p>
          </div>
        </div>

        {/* Servant Switcher */}
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">Contract:</span>
          <select
            value={selectedServantId}
            onChange={e => {
              setSelectedServantId(e.target.value);
              const target = master.servants.find(s => s.id === e.target.value);
              if (target) {
                setSummonQuote(target.customQuotes.summon || target.template.summonQuote);
                setBattleQuote(target.customQuotes.battleStart || target.template.battleStartQuote);
                setNpChant(target.customQuotes.noblePhantasm || target.template.noblePhantasm.chant);
                setVictoryQuote(target.customQuotes.victory || target.template.victoryQuote);
              }
            }}
            className="bg-[#111] text-white text-xs px-3 py-1.5 rounded-sm border border-[#222] outline-none font-mono focus:border-[#d4af37]"
          >
            {master.servants.map(s => (
              <option key={s.id} value={s.id}>
                {s.template.name} ({s.template.servantClass} • Lv. {s.level})
              </option>
            ))}
          </select>

          {master.activeServantId !== currentServant.id && (
            <button
              onClick={() => handleSetActive(currentServant.id)}
              className="px-3 py-1.5 rounded-sm bg-[#d4af37] hover:bg-[#c49f27] text-black font-bold font-mono text-xs uppercase tracking-wider transition"
            >
              Set Active
            </button>
          )}
        </div>
      </div>

      {/* Main Builder Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Stat Distribution & Interactive Radar Chart */}
        <div className="p-6 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] space-y-6 shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#1a1a1a] pb-3">
            <div>
              <h3 className="text-sm font-serif italic text-white flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-[#d4af37]" /> Stats & Radar Polygon
              </h3>
              <p className="text-[11px] font-mono text-white/40 mt-0.5">Points: <strong className="text-[#d4af37]">{currentServant.availableStatPoints} pts</strong></p>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-sm bg-[#161616] text-[#d4af37] border border-[#d4af37]/30">
              Lv. {currentServant.level} / 100
            </span>
          </div>

          {/* SVG Radar Chart */}
          <div className="flex justify-center py-2">
            <svg width="200" height="200" className="overflow-visible">
              {/* Concentric Web Lines */}
              {[0.33, 0.66, 1.0].map((scale, sIdx) => {
                const pts = [0, 1, 2, 3, 4].map(i => {
                  const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
                  const r = 70 * scale;
                  return `${(100 + r * Math.cos(angle)).toFixed(1)},${(100 + r * Math.sin(angle)).toFixed(1)}`;
                }).join(' ');
                return (
                  <polygon
                    key={sIdx}
                    points={pts}
                    fill="none"
                    stroke="rgba(212, 175, 55, 0.2)"
                    strokeWidth="1"
                  />
                );
              })}

              {/* Stat Polygon Fill */}
              <polygon
                points={radar.polygonString}
                fill="rgba(212, 175, 55, 0.25)"
                stroke="#d4af37"
                strokeWidth="1.5"
              />

              {/* Axis Labels */}
              {radar.points.map((p, idx) => {
                const angle = Math.atan2(p.y - 100, p.x - 100);
                const lx = 100 + 88 * Math.cos(angle);
                const ly = 100 + 88 * Math.sin(angle) + 4;
                return (
                  <text
                    key={idx}
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    fill="#d4af37"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {p.label} {p.value}
                  </text>
                );
              })}
            </svg>
          </div>

          {/* Stat Allocation Controls */}
          <div className="space-y-2 pt-2">
            {[
              { key: 'strength' as const, label: 'Strength (STR)', desc: 'Buster ATK multiplier' },
              { key: 'endurance' as const, label: 'Endurance (END)', desc: 'Max HP & Mitigation' },
              { key: 'agility' as const, label: 'Agility (AGI)', desc: 'Speed & Crit Stars' },
              { key: 'mana' as const, label: 'Mana (MNA)', desc: 'Arts & NP Generation' },
              { key: 'luck' as const, label: 'Luck (LCK)', desc: 'Critical Strike Rate' }
            ].map(item => {
              const base = currentServant.template.baseStats[item.key];
              const added = currentServant.allocatedStats[item.key] || 0;
              return (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-2.5 rounded-sm bg-[#111] border border-[#1a1a1a]"
                >
                  <div>
                    <div className="text-xs font-serif italic text-white">{item.label}</div>
                    <div className="text-[10px] font-mono text-white/40">{item.desc}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#d4af37]">
                      {base} + {added}
                    </span>
                    <button
                      disabled={currentServant.availableStatPoints <= 0}
                      onClick={() => handleAddStat(item.key)}
                      className="px-2 py-0.5 rounded-sm bg-[#d4af37] hover:bg-[#c49f27] text-black text-xs font-mono font-bold transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      +1
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Middle Col: Craft Essence Inventory & Equipment */}
        <div className="p-6 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] space-y-5 shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#1a1a1a] pb-3">
            <div>
              <h3 className="text-sm font-serif italic text-white flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[#d4af37]" /> Equipped Craft Essence
              </h3>
              <p className="text-[11px] font-mono text-white/40 mt-0.5">Attach passive magical artifacts</p>
            </div>
            {currentServant.equippedCe && (
              <button
                onClick={() => handleEquipCe(undefined)}
                className="text-[11px] font-mono uppercase tracking-wider text-[#ef4444] hover:underline"
              >
                Unequip
              </button>
            )}
          </div>

          {/* Currently Equipped Card Banner */}
          {currentServant.equippedCe ? (
            <div className="p-4 rounded-sm bg-[#161616] border border-[#d4af37]/40 shadow-md">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-serif italic text-white text-sm">{currentServant.equippedCe.name}</h4>
                <span className="text-[#d4af37] font-mono text-xs">{'★'.repeat(currentServant.equippedCe.rarity)}</span>
              </div>
              <p className="text-xs font-mono text-[#22c55e] mb-2">{currentServant.equippedCe.effectText}</p>
              <div className="flex gap-3 text-[11px] font-mono text-white/60">
                <span>ATK: +{currentServant.equippedCe.atkBonus}</span>
                <span>HP: +{currentServant.equippedCe.hpBonus}</span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-sm bg-[#111] border border-dashed border-[#222] text-center text-xs font-mono text-white/40">
              No Craft Essence equipped. Select from inventory below.
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-[10px] font-mono uppercase tracking-widest text-white/40">Available CEs</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {CRAFT_ESSENCE_DATABASE.map(ce => {
                const isEquipped = currentServant.equippedCeId === ce.id;
                return (
                  <div
                    key={ce.id}
                    className={`p-3 rounded-sm border text-xs font-mono flex items-center justify-between transition ${
                      isEquipped
                        ? 'bg-[#161616] border-[#d4af37] text-white'
                        : 'bg-[#111] border-[#1a1a1a] text-white/70 hover:bg-[#161616]'
                    }`}
                  >
                    <div>
                      <div className="font-serif italic text-white flex items-center gap-1.5">
                        <span>{ce.name}</span>
                        <span className="text-[#d4af37] text-[10px]">{'★'.repeat(ce.rarity)}</span>
                      </div>
                      <div className="text-[10px] text-white/40 mt-0.5 line-clamp-1">{ce.effectText}</div>
                    </div>
                    <button
                      onClick={() => handleEquipCe(ce.id)}
                      className={`px-2.5 py-1 rounded-sm font-mono text-[10px] uppercase tracking-wider font-bold transition ${
                        isEquipped
                          ? 'bg-[#22c55e] text-black'
                          : 'bg-[#222] hover:bg-[#333] text-white/80'
                      }`}
                    >
                      {isEquipped ? 'Equipped' : 'Equip'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Col: Custom Dialogue & Battle Quotes Writer */}
        <div className="p-6 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] space-y-4 shadow-2xl">
          <div className="border-b border-[#1a1a1a] pb-3">
            <h3 className="text-sm font-serif italic text-white flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-[#d4af37]" /> Custom Dialogue & Chants
            </h3>
            <p className="text-[11px] font-mono text-white/40 mt-0.5">Rendered dynamically on Discord Canvas cards</p>
          </div>

          <div className="space-y-3 font-mono">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/40 block mb-1">Summon Quote</label>
              <textarea
                value={summonQuote}
                onChange={e => setSummonQuote(e.target.value)}
                rows={2}
                className="w-full bg-[#111] text-white text-xs p-2.5 rounded-sm border border-[#222] outline-none focus:border-[#d4af37] resize-none"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/40 block mb-1">Battle Start Quote</label>
              <textarea
                value={battleQuote}
                onChange={e => setBattleQuote(e.target.value)}
                rows={2}
                className="w-full bg-[#111] text-white text-xs p-2.5 rounded-sm border border-[#222] outline-none focus:border-[#d4af37] resize-none"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/40 block mb-1">Noble Phantasm Chant</label>
              <textarea
                value={npChant}
                onChange={e => setNpChant(e.target.value)}
                rows={2}
                className="w-full bg-[#111] text-white text-xs p-2.5 rounded-sm border border-[#222] outline-none focus:border-[#d4af37] resize-none"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/40 block mb-1">Victory Quote</label>
              <textarea
                value={victoryQuote}
                onChange={e => setVictoryQuote(e.target.value)}
                rows={2}
                className="w-full bg-[#111] text-white text-xs p-2.5 rounded-sm border border-[#222] outline-none focus:border-[#d4af37] resize-none"
              />
            </div>

            <button
              onClick={handleSaveQuotes}
              className="w-full py-2.5 rounded-sm bg-[#d4af37] hover:bg-[#c49f27] text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg transition"
            >
              {saveFeedback ? <Check className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
              <span>{saveFeedback ? 'Saved to Contract' : 'Save Custom Dialogue'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
