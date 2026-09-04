'use client';

import React, { useState, useEffect } from 'react';
import { MasterProfile, MasterServantInstance, ServantStats, ServantTemplate } from '../lib/types';
import { CRAFT_ESSENCE_DATABASE } from '../lib/data/craftEssences';
import { getCustomServantsFromStorage, saveCustomServantsToStorage } from '../lib/state/gameState';
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
  Sword,
  Film,
  Sliders,
  ExternalLink,
  Play,
  RotateCcw,
  Upload,
  FileUp,
  Image as ImageIcon,
  Loader2,
  Trash2
} from 'lucide-react';
import { normalizeMediaUrl } from '../lib/utils/mediaResolver';

interface ServantWorkshopProps {
  master: MasterProfile;
  onUpdateMaster: (master: MasterProfile) => void;
}

export default function ServantWorkshop({ master, onUpdateMaster }: ServantWorkshopProps) {
  const activeServant = master.servants.find(s => s.id === master.activeServantId) || master.servants[0];
  const [selectedServantId, setSelectedServantId] = useState<string>(activeServant?.id || '');

  const currentServant = master.servants.find(s => s.id === selectedServantId) || activeServant;

  const [summonQuote, setSummonQuote] = useState(currentServant?.customQuotes?.summon || '');
  const [battleQuote, setBattleQuote] = useState(currentServant?.customQuotes?.battleStart || '');
  const [npChant, setNpChant] = useState(currentServant?.customQuotes?.noblePhantasm || '');
  const [victoryQuote, setVictoryQuote] = useState(currentServant?.customQuotes?.victory || '');
  const [busterQuote, setBusterQuote] = useState(currentServant?.customQuotes?.busterChain || '');
  const [artsQuote, setArtsQuote] = useState(currentServant?.customQuotes?.artsChain || '');
  const [quickQuote, setQuickQuote] = useState(currentServant?.customQuotes?.quickChain || '');
  const [defeatQuote, setDefeatQuote] = useState(currentServant?.customQuotes?.defeat || '');
  const [activeDialogueTab, setActiveDialogueTab] = useState<'chains' | 'general'>('chains');
  const [saveFeedback, setSaveFeedback] = useState(false);

  // Servant Portrait & Artwork Customization State
  const [avatarUrl, setAvatarUrl] = useState(currentServant?.template?.avatarUrl || '');
  const [cardArtUrl, setCardArtUrl] = useState(currentServant?.template?.cardArtUrl || '');
  const [artSaveFeedback, setArtSaveFeedback] = useState(false);
  const [artUploading, setArtUploading] = useState(false);
  const [artUploadError, setArtUploadError] = useState<string | null>(null);

  // Noble Phantasm Animation Customization State
  const [npGifUrl, setNpGifUrl] = useState(currentServant?.template?.noblePhantasm?.animationUrl || '');
  const [npAutoDelete, setNpAutoDelete] = useState(true);
  const [npAfkTimeout, setNpAfkTimeout] = useState(60);
  const [npSaveFeedback, setNpSaveFeedback] = useState(false);
  const [npSaving, setNpSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/servants/npanim')
      .then(r => r.json())
      .then(data => {
        if (data.settings) {
          setNpAutoDelete(data.settings.autoDelete ?? true);
          setNpAfkTimeout(data.settings.afkTimeoutSeconds ?? 60);
        }
        if (currentServant?.template?.name && data.animations) {
          const match = data.animations.find((a: any) => 
            a.servantId === currentServant.template.id || 
            a.servantName?.toLowerCase() === currentServant.template.name.toLowerCase()
          );
          if (match && match.gifUrl) {
            setNpGifUrl(match.gifUrl);
          }
        }
      })
      .catch(() => {});
  }, [currentServant?.id, currentServant?.template?.id, currentServant?.template?.name]);

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
      victory: victoryQuote,
      defeat: defeatQuote,
      busterChain: busterQuote,
      artsChain: artsQuote,
      quickChain: quickQuote
    });
    const updatedServants = master.servants.map(s => (s.id === updated.id ? updated : s));
    onUpdateMaster({ ...master, servants: updatedServants });

    // Sync to server so bot commands (duel, summon, etc.) immediately use updated quotes
    fetch('/api/servants/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'edit',
        servant: currentServant.template.id || currentServant.template.name,
        summonQuote: summonQuote,
        noblePhantasmChant: npChant
      })
    }).catch(err => console.warn('Server quote sync warning:', err));

    setSaveFeedback(true);
    setTimeout(() => setSaveFeedback(false), 3000);
  };

  const handleSaveArt = async () => {
    if (!currentServant) return;
    const finalAvatar = avatarUrl.trim() || currentServant.template.avatarUrl;
    const finalCardArt = cardArtUrl.trim() || finalAvatar || currentServant.template.cardArtUrl;

    const updatedTemplate: ServantTemplate = {
      ...currentServant.template,
      avatarUrl: finalAvatar,
      cardArtUrl: finalCardArt
    };

    const updatedServant: MasterServantInstance = {
      ...currentServant,
      template: updatedTemplate
    };

    const updatedServants = master.servants.map(s => (s.id === updatedServant.id ? updatedServant : s));
    onUpdateMaster({ ...master, servants: updatedServants });

    // Persist to browser storage custom servants list
    const stored = getCustomServantsFromStorage();
    const idx = stored.findIndex(s => s.id === updatedTemplate.id || s.name.toLowerCase() === updatedTemplate.name.toLowerCase());
    let newStored: ServantTemplate[];
    if (idx >= 0) {
      newStored = [...stored];
      newStored[idx] = updatedTemplate;
    } else {
      newStored = [...stored, updatedTemplate];
    }
    saveCustomServantsToStorage(newStored);

    // Call server API to persist on disk database
    fetch('/api/servants/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', servant: updatedTemplate })
    }).catch(err => console.warn('Server disk art sync warning:', err));

    setArtSaveFeedback(true);
    setTimeout(() => setArtSaveFeedback(false), 3000);
  };

  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setArtUploadError('Please select a valid image file (PNG, JPG, GIF, WebP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setArtUploadError('File exceeds 10MB limit.');
      return;
    }

    setArtUploading(true);
    setArtUploadError(null);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAvatarUrl(dataUrl);
      if (!cardArtUrl || cardArtUrl === avatarUrl) {
        setCardArtUrl(dataUrl);
      }
      setArtUploading(false);
    };
    reader.onerror = () => {
      setArtUploadError('Failed to read image file.');
      setArtUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleCardArtFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setArtUploadError('Please select a valid image file (PNG, JPG, GIF, WebP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setArtUploadError('File exceeds 10MB limit.');
      return;
    }

    setArtUploading(true);
    setArtUploadError(null);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setCardArtUrl(dataUrl);
      setArtUploading(false);
    };
    reader.onerror = () => {
      setArtUploadError('Failed to read image file.');
      setArtUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveNpAnimation = async () => {
    setNpSaving(true);
    try {
      await fetch('/api/servants/npanim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_anim',
          servant: currentServant.template.id || currentServant.template.name,
          gifUrl: npGifUrl.trim(),
          chant: npChant.trim() || currentServant.template.noblePhantasm.chant,
          configuredBy: master.username
        })
      });

      await fetch('/api/servants/npanim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_settings',
          autoDelete: npAutoDelete,
          afkTimeoutSeconds: Number(npAfkTimeout) || 60
        })
      });

      const updatedServantInstance = {
        ...currentServant,
        template: {
          ...currentServant.template,
          noblePhantasm: {
            ...currentServant.template.noblePhantasm,
            animationUrl: npGifUrl.trim(),
            chant: npChant.trim() || currentServant.template.noblePhantasm.chant
          }
        }
      };

      const updatedServants = master.servants.map(s => (s.id === currentServant.id ? updatedServantInstance : s));
      onUpdateMaster({ ...master, servants: updatedServants });

      setNpSaveFeedback(true);
      setTimeout(() => setNpSaveFeedback(false), 3500);
    } catch (err) {
      console.error('Failed to save NP animation:', err);
    } finally {
      setNpSaving(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // 25MB maximum limit check
    if (file.size > 25 * 1024 * 1024) {
      setUploadError('File exceeds 25MB size limit.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    // Instant local preview
    const localBlobUrl = URL.createObjectURL(file);
    setNpGifUrl(localBlobUrl);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('servantId', currentServant.template.id || currentServant.template.name);

      const res = await fetch('/api/servants/upload-anim', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload media file');
      }

      setNpGifUrl(data.url);
      setUploadSuccess(`Uploaded ${(file.size / (1024 * 1024)).toFixed(2)} MB (${data.filename})`);
      setTimeout(() => setUploadSuccess(null), 4000);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploadError(err.message || 'Upload failed. You can still use a direct URL.');
    } finally {
      setIsUploading(false);
    }
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
                setAvatarUrl(target.template.avatarUrl || '');
                setCardArtUrl(target.template.cardArtUrl || '');
                setSummonQuote(target.customQuotes?.summon || target.template.summonQuote || '');
                setBattleQuote(target.customQuotes?.battleStart || target.template.battleStartQuote || '');
                setNpChant(target.customQuotes?.noblePhantasm || target.template.noblePhantasm.chant || '');
                setVictoryQuote(target.customQuotes?.victory || target.template.victoryQuote || '');
                setBusterQuote(target.customQuotes?.busterChain || '');
                setArtsQuote(target.customQuotes?.artsChain || '');
                setQuickQuote(target.customQuotes?.quickChain || '');
                setDefeatQuote(target.customQuotes?.defeat || target.template.defeatQuote || '');
                setNpGifUrl(target.template.noblePhantasm.animationUrl || '');
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
          <div className="border-b border-[#1a1a1a] pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-serif italic text-white flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-[#d4af37]" /> Custom Dialogue & Chants
              </h3>
              <p className="text-[11px] font-mono text-white/40 mt-0.5">Author custom voice lines for {currentServant.template.name}</p>
            </div>
            <button
              onClick={() => {
                setSummonQuote(currentServant.template.summonQuote || '');
                setBattleQuote(currentServant.template.battleStartQuote || '');
                setNpChant(currentServant.template.noblePhantasm.chant || '');
                setVictoryQuote(currentServant.template.victoryQuote || '');
                setDefeatQuote(currentServant.template.defeatQuote || '');
                setBusterQuote('');
                setArtsQuote('');
                setQuickQuote('');
              }}
              className="text-[10px] font-mono px-2 py-1 rounded bg-[#161616] text-white/50 hover:text-white border border-[#222] transition"
              title="Reset to Canon Fate quotes"
            >
              Reset to Canon
            </button>
          </div>

          {/* Dialogue Category Selector */}
          <div className="flex rounded-sm bg-[#121212] p-1 border border-[#222] text-[11px] font-mono">
            <button
              onClick={() => setActiveDialogueTab('chains')}
              className={`flex-1 py-1.5 rounded-sm transition font-bold ${
                activeDialogueTab === 'chains'
                  ? 'bg-[#d4af37] text-black shadow'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              ⚡ Combat Chains & NP
            </button>
            <button
              onClick={() => setActiveDialogueTab('general')}
              className={`flex-1 py-1.5 rounded-sm transition font-bold ${
                activeDialogueTab === 'general'
                  ? 'bg-[#d4af37] text-black shadow'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              📜 Invocations & Outcomes
            </button>
          </div>

          <div className="space-y-3 font-mono">
            {activeDialogueTab === 'chains' ? (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] uppercase tracking-wider text-red-400 font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                      Buster Brave Chain (3x Buster)
                    </label>
                    <span className="text-[9px] text-white/30">Priority battle cut-in line</span>
                  </div>
                  <textarea
                    value={busterQuote}
                    onChange={e => setBusterQuote(e.target.value)}
                    placeholder="e.g. My blade leaves nothing but scorched earth! DIE!"
                    rows={2}
                    className="w-full bg-[#111] text-white text-xs p-2.5 rounded-sm border border-[#222] outline-none focus:border-red-500 resize-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] uppercase tracking-wider text-blue-400 font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                      Arts Mana Chain (3x Arts)
                    </label>
                    <span className="text-[9px] text-white/30">Priority mana resonance line</span>
                  </div>
                  <textarea
                    value={artsQuote}
                    onChange={e => setArtsQuote(e.target.value)}
                    placeholder="e.g. Flow, leylines of the ancient world! Answer my call!"
                    rows={2}
                    className="w-full bg-[#111] text-white text-xs p-2.5 rounded-sm border border-[#222] outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                      Quick Star Chain (3x Quick)
                    </label>
                    <span className="text-[9px] text-white/30">Priority critical flurry line</span>
                  </div>
                  <textarea
                    value={quickQuote}
                    onChange={e => setQuickQuote(e.target.value)}
                    placeholder="e.g. A flash of lightning—you won't even perceive the blow!"
                    rows={2}
                    className="w-full bg-[#111] text-white text-xs p-2.5 rounded-sm border border-[#222] outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                      Noble Phantasm Chant
                    </label>
                    <span className="text-[9px] text-white/30">True Name Release</span>
                  </div>
                  <textarea
                    value={npChant}
                    onChange={e => setNpChant(e.target.value)}
                    rows={2}
                    className="w-full bg-[#111] text-white text-xs p-2.5 rounded-sm border border-[#222] outline-none focus:border-amber-500 resize-none"
                  />
                </div>
              </>
            ) : (
              <>
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
                  <label className="text-[10px] uppercase tracking-wider text-white/40 block mb-1">Victory Quote</label>
                  <textarea
                    value={victoryQuote}
                    onChange={e => setVictoryQuote(e.target.value)}
                    rows={2}
                    className="w-full bg-[#111] text-white text-xs p-2.5 rounded-sm border border-[#222] outline-none focus:border-[#d4af37] resize-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-wider text-white/40 block mb-1">Defeat Quote</label>
                  <textarea
                    value={defeatQuote}
                    onChange={e => setDefeatQuote(e.target.value)}
                    rows={2}
                    placeholder="e.g. Master... stand back... I must retreat..."
                    className="w-full bg-[#111] text-white text-xs p-2.5 rounded-sm border border-[#222] outline-none focus:border-[#d4af37] resize-none"
                  />
                </div>
              </>
            )}

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

      {/* Heroic Spirit Portrait & Card Artwork Forge */}
      <div className="p-6 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] shadow-2xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1a1a1a] pb-4">
          <div>
            <h3 className="text-base font-serif italic text-white flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-[#d4af37]" />
              Heroic Spirit Portrait & Card Artwork Forge
            </h3>
            <p className="text-xs font-mono text-white/40 mt-1">
              Customize avatar portraits and full card artwork for {currentServant.template.name}. Rendered on Discord canvas cards, duels, and profile cards.
            </p>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="px-2.5 py-1 rounded bg-[#161616] text-[#d4af37] border border-[#d4af37]/30">
              Permanent Sync Enabled
            </span>
          </div>
        </div>

        {artUploadError && (
          <div className="p-3 bg-red-950/40 border border-red-500/40 rounded text-red-300 font-mono text-xs flex items-center gap-2">
            <span>⚠️</span>
            <span>{artUploadError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono">
          {/* Left Column: Form Inputs & File Uploads (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Avatar PFP Section */}
            <div className="p-4 rounded bg-[#111] border border-[#222] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                  <User className="w-4 h-4 text-[#d4af37]" />
                  Avatar Profile Picture (PFP)
                </label>
                <span className="text-[10px] text-white/40">Square / Circle Badge</span>
              </div>

              {/* Direct File Upload */}
              <div className="flex items-center gap-2">
                <label className="flex-1 cursor-pointer py-2 px-3 rounded bg-[#1a1a1a] hover:bg-[#252525] border border-dashed border-[#d4af37]/40 text-center transition flex items-center justify-center gap-2 text-xs text-[#d4af37]">
                  <FileUp className="w-4 h-4" />
                  <span>Upload Image File (PNG, JPG, GIF, WebP)</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarFileUpload}
                    disabled={artUploading}
                  />
                </label>
              </div>

              {/* Or URL input */}
              <div>
                <label className="text-[10px] uppercase text-white/40 block mb-1">Or Direct Image / GIF URL</label>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={e => setAvatarUrl(e.target.value)}
                  placeholder="https://... or uploaded image"
                  className="w-full bg-[#0a0a0a] text-white text-xs p-2.5 rounded-sm border border-[#222] outline-none focus:border-[#d4af37]"
                />
              </div>
            </div>

            {/* Card Art Section */}
            <div className="p-4 rounded bg-[#111] border border-[#222] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-[#d4af37]" />
                  Full Card Artwork
                </label>
                <button
                  type="button"
                  onClick={() => setCardArtUrl(avatarUrl)}
                  className="text-[10px] text-[#d4af37] hover:underline"
                >
                  Match Avatar PFP
                </button>
              </div>

              {/* Direct File Upload for Card Art */}
              <div className="flex items-center gap-2">
                <label className="flex-1 cursor-pointer py-2 px-3 rounded bg-[#1a1a1a] hover:bg-[#252525] border border-dashed border-[#d4af37]/40 text-center transition flex items-center justify-center gap-2 text-xs text-[#d4af37]">
                  <FileUp className="w-4 h-4" />
                  <span>Upload Card Artwork (PNG, JPG, GIF, WebP)</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCardArtFileUpload}
                    disabled={artUploading}
                  />
                </label>
              </div>

              {/* URL input */}
              <div>
                <label className="text-[10px] uppercase text-white/40 block mb-1">Or Direct Card Art URL</label>
                <input
                  type="text"
                  value={cardArtUrl}
                  onChange={e => setCardArtUrl(e.target.value)}
                  placeholder="https://... or uploaded image"
                  className="w-full bg-[#0a0a0a] text-white text-xs p-2.5 rounded-sm border border-[#222] outline-none focus:border-[#d4af37]"
                />
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveArt}
              disabled={artUploading}
              className={`w-full py-3 rounded-sm font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition ${
                artSaveFeedback
                  ? 'bg-[#22c55e] text-black'
                  : 'bg-[#d4af37] hover:bg-[#c49f27] text-black'
              }`}
            >
              {artSaveFeedback ? <Check className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
              <span>{artSaveFeedback ? 'Portrait & Card Art Saved to Throne of Heroes!' : 'Save Servant Portrait & Artwork'}</span>
            </button>
          </div>

          {/* Right Column: Live Visual Previews (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="p-4 rounded bg-[#111] border border-[#222] flex-1 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] uppercase tracking-wider text-white/40 mb-3">Live Visual Previews</span>
              
              <div className="flex items-center gap-6 justify-center flex-wrap">
                {/* Avatar Preview */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#d4af37] bg-black shadow-lg relative">
                    <img
                      src={avatarUrl || currentServant.template.avatarUrl}
                      alt={currentServant.template.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e: any) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&auto=format&fit=crop&q=80';
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-white/60">Avatar PFP</span>
                </div>

                {/* Card Art Preview */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-28 h-36 rounded-md overflow-hidden border border-[#333] bg-black shadow-lg relative">
                    <img
                      src={cardArtUrl || avatarUrl || currentServant.template.cardArtUrl}
                      alt={currentServant.template.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e: any) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80';
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-white/60">Card Artwork</span>
                </div>
              </div>

              <div className="mt-4 text-[11px] text-white/40 leading-relaxed max-w-xs">
                Avatar is rendered in circle badges, combat summary screens, and /servant status embeds.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-Width Noble Phantasm Cinematic Delivery Studio */}
      <div className="p-6 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] shadow-2xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1a1a1a] pb-4">
          <div>
            <h3 className="text-base font-serif italic text-white flex items-center gap-2">
              <Film className="w-5 h-5 text-[#d4af37]" />
              Noble Phantasm Cinematic Animation Studio
            </h3>
            <p className="text-xs font-mono text-white/40 mt-1">
              Customize full-width edge-to-edge animated GIF cinematics unleashed when {currentServant.template.name} activates their Noble Phantasm.
            </p>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="px-2.5 py-1 rounded bg-[#161616] text-[#d4af37] border border-[#d4af37]/30">
              True Name: {currentServant.template.noblePhantasm.name}
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
              currentServant.template.noblePhantasm.cardType === 'Buster' ? 'bg-red-950 text-red-300 border border-red-800/50' :
              currentServant.template.noblePhantasm.cardType === 'Arts' ? 'bg-blue-950 text-blue-300 border border-blue-800/50' :
              'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
            }`}>
              {currentServant.template.noblePhantasm.cardType}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Controls (5 cols) */}
          <div className="lg:col-span-5 space-y-4 font-mono text-xs">
            {/* Direct File Upload (100% Guaranteed & Safe) */}
            <div className="p-3.5 rounded bg-[#111] border border-[#222]">
              <label className="text-[10px] uppercase tracking-wider text-white/60 block mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-white">
                  <FileUp className="w-3.5 h-3.5 text-[#d4af37]" />
                  Direct File Upload (Recommended)
                </span>
                <span className="text-[9px] text-emerald-400 font-bold bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/40">
                  100% Reliable
                </span>
              </label>

              <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
                  isUploading
                    ? 'border-[#d4af37] bg-[#d4af37]/5'
                    : 'border-[#2a2a2a] hover:border-[#d4af37]/60 bg-[#141414] hover:bg-[#181818]'
                }`}
                onClick={() => {
                  const input = document.getElementById('np-file-upload-input');
                  input?.click();
                }}
              >
                <input
                  id="np-file-upload-input"
                  type="file"
                  accept="image/gif,video/mp4,video/webm,image/webp,image/png,image/jpeg"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />

                {isUploading ? (
                  <div className="flex flex-col items-center justify-center py-2 space-y-2">
                    <Loader2 className="w-6 h-6 text-[#d4af37] animate-spin" />
                    <span className="text-white text-xs font-semibold">Uploading animation to server...</span>
                    <span className="text-white/40 text-[10px]">Preparing high-speed direct stream</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-1 space-y-1.5">
                    <div className="p-2 rounded-full bg-[#1c1c1c] text-[#d4af37] border border-[#2a2a2a]">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-white text-xs font-semibold">
                        Click to browse or drag & drop GIF/MP4
                      </p>
                      <p className="text-white/40 text-[10px] mt-0.5">
                        Supports .GIF, .MP4, .WEBM, .WEBP (Max 25MB)
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {uploadError && (
                <div className="mt-2 p-2 bg-red-950/60 border border-red-800/40 rounded text-[10px] text-red-300">
                  {uploadError}
                </div>
              )}
              {uploadSuccess && (
                <div className="mt-2 p-2 bg-emerald-950/60 border border-emerald-800/40 rounded text-[10px] text-emerald-300 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>{uploadSuccess}</span>
                </div>
              )}
            </div>

            {/* URL Input */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/40 block mb-1.5 flex items-center justify-between">
                <span>Or Enter Direct URL / CDN Link</span>
                <span className="text-[#d4af37]">Native Full-Width Discord</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={npGifUrl}
                  onChange={e => setNpGifUrl(e.target.value)}
                  placeholder="https://i.giphy.com/... or https://i.imgur.com/... or /uploads/..."
                  className="w-full bg-[#111] text-white text-xs px-3 py-2.5 rounded-sm border border-[#222] outline-none focus:border-[#d4af37] placeholder-white/25 pr-8"
                />
                {npGifUrl && (
                  <button
                    onClick={() => setNpGifUrl('')}
                    className="absolute right-2 top-2.5 text-white/40 hover:text-white"
                    title="Clear URL"
                  >
                    ✕
                  </button>
                )}
              </div>
              <p className="text-[10px] text-white/30 mt-1">
                Tip: Direct file uploads and direct `.gif` CDN links render without broken image icons.
              </p>
            </div>

            {/* Quick Presets */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/40 block mb-1.5">
                Verified Direct CDN Presets
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setNpGifUrl('https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif')}
                  className="p-2 bg-[#121212] hover:bg-[#1c1c1c] border border-[#222] rounded text-left text-[11px] text-white/80 transition flex items-center justify-between"
                >
                  <span>⚔️ Excalibur</span>
                  <span className="text-[9px] text-[#d4af37]">Saber</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNpGifUrl('https://i.giphy.com/media/13cACn6mlO56kU/giphy.gif')}
                  className="p-2 bg-[#121212] hover:bg-[#1c1c1c] border border-[#222] rounded text-left text-[11px] text-white/80 transition flex items-center justify-between"
                >
                  <span>⚡ Enuma Elish</span>
                  <span className="text-[9px] text-[#d4af37]">Gilgamesh</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNpGifUrl('https://i.giphy.com/media/eBGV4n8U8k3eg/giphy.gif')}
                  className="p-2 bg-[#121212] hover:bg-[#1c1c1c] border border-[#222] rounded text-left text-[11px] text-white/80 transition flex items-center justify-between"
                >
                  <span>🏹 Blade Works</span>
                  <span className="text-[9px] text-[#d4af37]">Archer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNpGifUrl('https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif')}
                  className="p-2 bg-[#121212] hover:bg-[#1c1c1c] border border-[#222] rounded text-left text-[11px] text-white/80 transition flex items-center justify-between"
                >
                  <span>🩸 Gáe Bolg</span>
                  <span className="text-[9px] text-[#d4af37]">Lancer</span>
                </button>
              </div>
            </div>

            {/* True Name Chant Customization */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/40 block mb-1.5">
                Invocation Chant Text
              </label>
              <textarea
                value={npChant}
                onChange={e => setNpChant(e.target.value)}
                rows={2}
                placeholder={`*“Take this, the sword of promised victory...”*`}
                className="w-full bg-[#111] text-white text-xs p-2.5 rounded-sm border border-[#222] outline-none focus:border-[#d4af37] resize-none"
              />
            </div>

            {/* Duel Settings: Turn Cleanup & AFK Duration */}
            <div className="p-3.5 rounded bg-[#111] border border-[#1e1e1e] space-y-3">
              <div className="flex items-center gap-1.5 text-white/80 font-serif italic text-xs">
                <Sliders className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>Duel Delivery Behavior</span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white text-xs">Auto-Delete on Next Turn</div>
                  <div className="text-[10px] text-white/40">Clean up previous GIF when Master selects next cards</div>
                </div>
                <input
                  type="checkbox"
                  checked={npAutoDelete}
                  onChange={e => setNpAutoDelete(e.target.checked)}
                  className="w-4 h-4 accent-[#d4af37] rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#1e1e1e]">
                <div>
                  <div className="text-white text-xs">AFK Timeout Fallback</div>
                  <div className="text-[10px] text-white/40">Removes GIF if player is inactive</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={10}
                    max={300}
                    value={npAfkTimeout}
                    onChange={e => setNpAfkTimeout(Number(e.target.value))}
                    className="w-16 bg-[#161616] text-white text-center text-xs p-1 rounded border border-[#2a2a2a] outline-none focus:border-[#d4af37]"
                  />
                  <span className="text-white/40 text-[10px]">sec</span>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <button
              type="button"
              disabled={npSaving}
              onClick={handleSaveNpAnimation}
              className="w-full py-2.5 rounded-sm bg-[#d4af37] hover:bg-[#c49f27] text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition disabled:opacity-50"
            >
              {npSaveFeedback ? <Check className="w-4 h-4" /> : <Film className="w-4 h-4" />}
              <span>{npSaveFeedback ? 'Saved to Throne & Database' : npSaving ? 'Persisting...' : 'Save NP Animation & Settings'}</span>
            </button>
          </div>

          {/* Right Preview (7 cols): Full-Width Live Discord Canvas Presentation */}
          <div className="lg:col-span-7 flex flex-col justify-between rounded-lg bg-[#0d0e10] border border-[#222] p-4 shadow-xl">
            <div>
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-3">
                <span className="text-[11px] font-mono text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-[#d4af37]" />
                  Live Discord Delivery Simulation (Edge-to-Edge)
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                  Full-Width Native Unfurl
                </span>
              </div>

              {/* Simulated Discord Message */}
              <div className="space-y-2 font-sans">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-600 to-red-800 flex items-center justify-center font-bold text-xs text-white">
                    FGO
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-xs">Holy Grail Bot</span>
                      <span className="bg-[#5865f2] text-white text-[9px] font-bold px-1 rounded">BOT</span>
                      <span className="text-white/40 text-[10px]">Today at duel phase</span>
                    </div>
                  </div>
                </div>

                <div className="text-white text-xs pl-10 space-y-1">
                  <div className="font-bold text-sm text-red-400">
                    💥 NOBLE PHANTASM UNLEASHED: {currentServant.template.noblePhantasm.name.toUpperCase()}
                  </div>
                  <div className="text-white/80 text-[11px]">
                    ⚔️ <strong>{currentServant.template.name}</strong> (Master: @{master.username})
                  </div>
                  {npChant && (
                    <div className="border-l-2 border-[#d4af37] pl-2 text-white/70 italic text-[11px] my-1">
                      “{npChant}”
                    </div>
                  )}
                </div>

                {/* The Full Width Image / GIF */}
                <div className="pl-10 mt-2">
                  <div className="rounded-md overflow-hidden border border-[#2b2d31] bg-black max-w-full w-full shadow-2xl relative">
                    {npGifUrl ? (
                      npGifUrl.includes('.mp4') ? (
                        <video
                          src={npGifUrl}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full h-auto max-h-[380px] object-contain mx-auto"
                        />
                      ) : (
                        <img
                          src={npGifUrl}
                          alt="Noble Phantasm Cinematic"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://media1.tenor.com/m/h2E2o3W6mYoAAAAC/saber-fate.gif';
                          }}
                          className="w-full h-auto max-h-[380px] object-contain mx-auto transition duration-300"
                        />
                      )
                    ) : (
                      <div className="py-16 text-center text-white/30 font-mono text-xs">
                        Enter or select a GIF URL to preview full-width animation
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-white/30 mt-1.5 flex items-center justify-between">
                    <span>Delivered directly into channel (bypassing embed box constraints)</span>
                    <span>Auto-delete: {npAutoDelete ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-white/40">
              <span>Admin Discord Command equivalent:</span>
              <code className="text-[#d4af37] bg-black/50 px-2 py-0.5 rounded text-[10px]">
                /admin npanim servant:&quot;{currentServant.template.name}&quot;
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
