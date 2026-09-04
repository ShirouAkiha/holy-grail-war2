'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MasterProfile, GachaResultItem } from '../lib/types';
import {
  renderServantProfileCard,
  renderDialogueCard,
  renderBattleTurnSummary,
  renderGachaSummonBanner
} from '../lib/canvas/browserCanvas';
import {
  Image as ImageIcon,
  Download,
  Sparkles,
  RefreshCw,
  Upload,
  Play,
  Pause,
  Swords,
  Shield,
  Crosshair,
  Flame,
  Layers,
  Check
} from 'lucide-react';

interface CanvasStudioProps {
  master: MasterProfile;
}

const BATTLEFIELD_PRESETS = [
  { id: 'fuyuki', name: 'Fuyuki Burning City', desc: 'Apocalyptic flame embers & ruined skyline', icon: '🌋' },
  { id: 'temple', name: 'Ryuudou Temple', desc: 'Midnight indigo, moonlight beam & spirit motes', icon: '⛩️' },
  { id: 'throne', name: 'Throne of Heroes', desc: 'Celestial golden halos & cosmic starlight', icon: '👑' },
  { id: 'grail', name: 'Greater Grail Cavern', desc: 'Violet leyline abyss & pulsing mana currents', icon: '🟣' },
  { id: 'snow', name: 'Einzbern Castle', desc: 'Twilight blizzard & gentle falling starry snow', icon: '❄️' }
];

const OPPONENT_PRESETS = [
  {
    name: 'Gilgamesh',
    servantClass: 'Archer',
    avatarUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
    quote: 'Here I come, King of Heroes — do you have enough weapons in stock?'
  },
  {
    name: 'Cu Chulainn',
    servantClass: 'Lancer',
    avatarUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
    quote: 'Your heart is mine! Gae Bolg!'
  },
  {
    name: 'Heracles',
    servantClass: 'Berserker',
    avatarUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=600&auto=format&fit=crop&q=80',
    quote: 'ROOOAAAR! Nine Lives Blade Works!'
  },
  {
    name: 'Karna',
    servantClass: 'Lancer',
    avatarUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    quote: 'O Sun, bestow your blinding scorch! Vasavi Shakti!'
  }
];

const SAMPLE_QUOTES = [
  'I ask of you: Are you my Master?',
  'Here I come, King of Heroes — do you have enough weapons in stock?',
  'Take hold of the radiant star! Ex... CALIBURRR!',
  'Enuma Elish! The star of creation that split heaven and earth!',
  'Trace on. Trigger off. Nine Lives Blade Works!'
];

export default function CanvasStudio({ master }: CanvasStudioProps) {
  const activeServant = master.servants.find(s => s.id === master.activeServantId) || master.servants[0];

  const [activeTab, setActiveTab] = useState<'dialogue' | 'profile' | 'battle' | 'gacha'>('dialogue');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Dialogue & Cut-in State
  const [dialogueSpeaker, setDialogueSpeaker] = useState(activeServant?.template.name || 'Artoria Pendragon');
  const [dialogueClass, setDialogueClass] = useState<string>(activeServant?.template.servantClass || 'Saber');
  const [dialogueAvatarUrl, setDialogueAvatarUrl] = useState(activeServant?.template.avatarUrl || '');
  const [dialogueBond, setDialogueBond] = useState<number | string>(activeServant?.bondLevel || 10);
  const [dialogueText, setDialogueText] = useState(
    activeServant?.customQuotes.summon || 'I ask of you: Are you my Master?'
  );

  // Opponent / Defender state
  const [defenderName, setDefenderName] = useState('Gilgamesh');
  const [defenderClass, setDefenderClass] = useState('Archer');
  const [defenderAvatarUrl, setDefenderAvatarUrl] = useState(
    'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80'
  );

  // Tactical Chain & Deck
  const [chainTag, setChainTag] = useState('Buster Brave Chain');
  const [cardSeq, setCardSeq] = useState<('Buster' | 'Arts' | 'Quick' | 'NP')[]>(['Buster', 'Buster', 'Buster']);

  // Background Customization State
  const [bgPreset, setBgPreset] = useState('fuyuki');
  const [customBgUrl, setCustomBgUrl] = useState('');
  const [bgMode, setBgMode] = useState<'preset' | 'custom'>('preset');

  // Animation Replay & Trigger state
  const [animTrigger, setAnimTrigger] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle local background image upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCustomBgUrl(dataUrl);
        setBgMode('custom');
      }
    };
    reader.readAsDataURL(file);
  };

  // Re-render canvas whenever relevant parameters change
  useEffect(() => {
    if (!canvasRef.current || !activeServant) return;
    const canvas = canvasRef.current;

    if (activeTab === 'profile') {
      renderServantProfileCard(canvas, activeServant, master.username);
    } else if (activeTab === 'dialogue') {
      const effectiveBg = bgMode === 'custom' && customBgUrl ? customBgUrl : bgPreset;
      renderDialogueCard(
        canvas,
        dialogueSpeaker,
        dialogueText,
        chainTag,
        dialogueClass,
        dialogueAvatarUrl || undefined,
        dialogueBond,
        defenderName,
        defenderAvatarUrl || undefined,
        defenderClass,
        cardSeq,
        effectiveBg
      );
    } else if (activeTab === 'battle') {
      const mockLog = {
        turnNumber: 3,
        actionSummary: `${dialogueSpeaker} executed Buster Brave Chain, dealing 18,400 damage!`,
        p1DamageDealt: 18400,
        p2DamageDealt: 4200,
        p1HpRemaining: 12500,
        p2HpRemaining: 6800,
        npChant: activeServant.customQuotes.noblePhantasm
      };
      const p1 = {
        id: 'p1',
        masterName: master.username,
        name: dialogueSpeaker,
        servantClass: dialogueClass,
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
      const p2 = { ...p1, id: 'p2', name: defenderName, servantClass: defenderClass, currentHp: 6800, maxHp: 15500 };
      renderBattleTurnSummary(canvas, mockLog as any, p1 as any, p2 as any);
    } else if (activeTab === 'gacha') {
      const mockResults: GachaResultItem[] = [
        { type: 'servant' as const, item: activeServant.template, rarity: 5, isNew: true, isRateUp: true },
        { type: 'craft_essence' as const, item: master.craftEssences[0], rarity: 5, isNew: false, isRateUp: false },
        { type: 'servant' as const, item: master.servants[1]?.template || activeServant.template, rarity: 4, isNew: false, isRateUp: false }
      ];
      renderGachaSummonBanner(canvas, mockResults, 'Fuyuki Holy Grail War Banner');
    }

    return () => {
      if ((canvas as any).__animTimer) {
        clearInterval((canvas as any).__animTimer);
        (canvas as any).__animTimer = null;
      }
    };
  }, [
    activeTab,
    activeServant,
    dialogueSpeaker,
    dialogueClass,
    dialogueAvatarUrl,
    dialogueBond,
    dialogueText,
    defenderName,
    defenderClass,
    defenderAvatarUrl,
    chainTag,
    cardSeq,
    bgPreset,
    customBgUrl,
    bgMode,
    animTrigger,
    master.craftEssences,
    master.servants,
    master.username
  ]);

  const handleDownloadImage = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `fate_vn_${activeTab}_cut_in.png`;
    a.click();
  };

  const handleReplaySlash = () => {
    setAnimTrigger(prev => prev + 1);
  };

  return (
    <div className="space-y-6" id="canvas_studio_container">
      {/* Top Bar / Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-[#0a0a0a] rounded-xl border border-[#1a1a1a]">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-sm bg-[#161616] text-[#d4af37] border border-[#d4af37]/30">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-serif italic text-white tracking-wide">
              Fate Visual Novel Cut-In & 2D Canvas Studio
            </h2>
            <p className="text-[11px] font-mono text-white/40 uppercase tracking-wider">
              Split-Screen Cinematic Cut-In • Screen-Splitting Slash • Custom Battlefield Backgrounds
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {activeTab === 'dialogue' && (
            <button
              id="btn_replay_slash_animation"
              onClick={handleReplaySlash}
              className="px-3.5 py-2 rounded-sm bg-[#7f1d1d] hover:bg-[#991b1b] text-white font-bold font-mono text-xs uppercase tracking-wider flex items-center gap-2 border border-red-500/40 shadow-lg transition"
              title="Re-trigger screen-cleaving slash animation sequence"
            >
              <Swords className="w-3.5 h-3.5 text-red-300" />
              <span>Replay Slash Cleave</span>
            </button>
          )}

          <button
            id="btn_export_canvas_png"
            onClick={handleDownloadImage}
            className="px-4 py-2 rounded-sm bg-[#d4af37] hover:bg-[#c49f27] text-black font-bold font-mono text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Rendered PNG</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#1a1a1a] pb-3" id="canvas_studio_tabs">
        {[
          { id: 'dialogue' as const, label: 'Visual Novel Cut-In (800x420 Cinematic Slash)' },
          { id: 'profile' as const, label: 'Servant Status Card (850x390)' },
          { id: 'battle' as const, label: 'Battle Clash (640x700 Tarot)' },
          { id: 'gacha' as const, label: 'Summon Banner (900x420)' }
        ].map(t => (
          <button
            key={t.id}
            id={`tab_canvas_${t.id}`}
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

      {/* Live Canvas Viewport */}
      <div className="p-6 rounded-xl bg-[#050505] border border-[#1a1a1a] flex flex-col items-center justify-center overflow-x-auto shadow-2xl relative">
        <canvas
          ref={canvasRef}
          id="fate_vn_active_canvas"
          className="rounded-lg border border-[#2a2a2a] shadow-2xl max-w-full h-auto"
        />

        {activeTab === 'dialogue' && (
          <div className="mt-3 flex items-center gap-4 text-xs font-mono text-white/40">
            <span className="flex items-center gap-1.5 text-[#fbbf24]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Full-Screen Animated Action Sequence</span>
            </span>
            <span>•</span>
            <span>Left: Attacker Stance</span>
            <span>•</span>
            <span>Center: Command Deck Resonance</span>
            <span>•</span>
            <span>Right: Targeted Opponent</span>
          </div>
        )}
      </div>

      {/* Comprehensive Customization Panel for Dialogue & Cut-In */}
      {activeTab === 'dialogue' && (
        <div className="space-y-5" id="dialogue_customization_panel">
          {/* Section 1: Background Customization (Key User Request) */}
          <div className="p-5 bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] space-y-4">
            <div className="flex items-center justify-between border-b border-[#1a1a1a] pb-2.5">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#d4af37]" />
                <h3 className="text-xs font-mono uppercase tracking-wider text-white font-bold">
                  Battlefield Stage & Background Image
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBgMode('preset')}
                  className={`px-2.5 py-1 text-[11px] font-mono rounded-sm transition ${
                    bgMode === 'preset'
                      ? 'bg-[#d4af37] text-black font-bold'
                      : 'bg-[#141414] text-white/50 hover:text-white'
                  }`}
                >
                  Stage Presets
                </button>
                <button
                  onClick={() => setBgMode('custom')}
                  className={`px-2.5 py-1 text-[11px] font-mono rounded-sm transition ${
                    bgMode === 'custom'
                      ? 'bg-[#d4af37] text-black font-bold'
                      : 'bg-[#141414] text-white/50 hover:text-white'
                  }`}
                >
                  Custom Image / Upload
                </button>
              </div>
            </div>

            {bgMode === 'preset' ? (
              <div>
                <p className="text-[11px] text-white/40 font-mono mb-2.5">
                  Select an authentic Fate atmospheric stage with animated ambient motes & leylines:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
                  {BATTLEFIELD_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => setBgPreset(preset.id)}
                      className={`p-3 rounded-lg border text-left transition relative ${
                        bgPreset === preset.id
                          ? 'bg-[#1a1408] border-[#d4af37] text-white shadow-md'
                          : 'bg-[#111] border-[#222] text-white/60 hover:border-[#444] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xl">{preset.icon}</span>
                        {bgPreset === preset.id && <Check className="w-4 h-4 text-[#d4af37]" />}
                      </div>
                      <div className="font-bold text-xs text-white">{preset.name}</div>
                      <div className="text-[10px] text-white/40 leading-tight mt-1">{preset.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] text-white/40 font-mono">
                  Enter an image URL or upload any custom background image from your device:
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[260px]">
                    <input
                      type="text"
                      placeholder="Paste background image URL (https://...)"
                      value={customBgUrl}
                      onChange={e => setCustomBgUrl(e.target.value)}
                      className="w-full bg-[#111] text-white font-mono text-xs px-3.5 py-2.5 rounded-sm border border-[#222] outline-none focus:border-[#d4af37]"
                    />
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2.5 rounded-sm bg-[#1f1f1f] hover:bg-[#2a2a2a] text-[#d4af37] border border-[#d4af37]/40 font-mono text-xs uppercase tracking-wider flex items-center gap-2 transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Local Image</span>
                  </button>

                  {customBgUrl && (
                    <button
                      onClick={() => setCustomBgUrl('')}
                      className="px-3 py-2.5 rounded-sm bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/30 font-mono text-xs transition"
                    >
                      Clear Image
                    </button>
                  )}
                </div>

                {customBgUrl && (
                  <div className="flex items-center gap-3 p-2 bg-[#121212] rounded border border-[#222]">
                    <img
                      src={customBgUrl}
                      alt="Background Preview"
                      className="w-16 h-10 object-cover rounded border border-[#333]"
                    />
                    <div className="text-[11px] font-mono text-emerald-400">
                      Active Custom Background Loaded (Auto-scaled & tone-mapped)
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Character Portraits (Hovering Left Attacker & Right Defender) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Character: Attacker */}
            <div className="p-4 bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] space-y-3">
              <div className="flex items-center justify-between border-b border-[#1a1a1a] pb-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#fbbf24]" />
                  <h3 className="text-xs font-mono uppercase tracking-wider text-white font-bold">
                    Left Hovering Sprite (Attacker)
                  </h3>
                </div>
                {master.servants.length > 1 && (
                  <select
                    onChange={e => {
                      const s = master.servants.find(srv => srv.id === e.target.value);
                      if (s) {
                        setDialogueSpeaker(s.template.name);
                        setDialogueClass(s.template.servantClass);
                        setDialogueAvatarUrl(s.template.avatarUrl);
                        setDialogueBond(s.bondLevel || 10);
                        if (s.customQuotes.summon) setDialogueText(s.customQuotes.summon);
                      }
                    }}
                    className="bg-[#141414] text-[#d4af37] border border-[#333] text-[11px] font-mono px-2 py-1 rounded"
                  >
                    <option value="">Choose My Servant...</option>
                    {master.servants.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.template.name} ({s.template.servantClass})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-white/40 block mb-1">
                    Attacker Name
                  </label>
                  <input
                    type="text"
                    value={dialogueSpeaker}
                    onChange={e => setDialogueSpeaker(e.target.value)}
                    className="w-full bg-[#111] text-white font-mono text-xs px-3 py-2 rounded-sm border border-[#222] outline-none focus:border-[#d4af37]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-white/40 block mb-1">
                    Servant Class
                  </label>
                  <select
                    value={dialogueClass}
                    onChange={e => setDialogueClass(e.target.value)}
                    className="w-full bg-[#111] text-white font-mono text-xs px-3 py-2 rounded-sm border border-[#222] outline-none focus:border-[#d4af37]"
                  >
                    {['Saber', 'Archer', 'Lancer', 'Rider', 'Caster', 'Assassin', 'Berserker', 'Ruler', 'Avenger', 'Foreigner'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-white/40 block mb-1">
                  Attacker Sprite / Portrait Image URL
                </label>
                <input
                  type="text"
                  placeholder="Avatar image URL (optional)"
                  value={dialogueAvatarUrl}
                  onChange={e => setDialogueAvatarUrl(e.target.value)}
                  className="w-full bg-[#111] text-white font-mono text-xs px-3 py-2 rounded-sm border border-[#222] outline-none focus:border-[#d4af37]"
                />
              </div>
            </div>

            {/* Right Character: Defender / Targeted Opponent */}
            <div className="p-4 bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] space-y-3">
              <div className="flex items-center justify-between border-b border-[#1a1a1a] pb-2">
                <div className="flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-red-500" />
                  <h3 className="text-xs font-mono uppercase tracking-wider text-white font-bold">
                    Right Hovering Sprite (Opponent)
                  </h3>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono text-red-400">
                  <span>Presets:</span>
                  {OPPONENT_PRESETS.map(p => (
                    <button
                      key={p.name}
                      onClick={() => {
                        setDefenderName(p.name);
                        setDefenderClass(p.servantClass);
                        setDefenderAvatarUrl(p.avatarUrl);
                      }}
                      className="px-1.5 py-0.5 rounded bg-[#1a1111] hover:bg-[#2e1515] border border-red-500/20 text-red-300 transition"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-white/40 block mb-1">
                    Opponent Name
                  </label>
                  <input
                    type="text"
                    value={defenderName}
                    onChange={e => setDefenderName(e.target.value)}
                    className="w-full bg-[#111] text-white font-mono text-xs px-3 py-2 rounded-sm border border-[#222] outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-white/40 block mb-1">
                    Opponent Class
                  </label>
                  <select
                    value={defenderClass}
                    onChange={e => setDefenderClass(e.target.value)}
                    className="w-full bg-[#111] text-white font-mono text-xs px-3 py-2 rounded-sm border border-[#222] outline-none focus:border-red-500"
                  >
                    {['Archer', 'Saber', 'Lancer', 'Rider', 'Caster', 'Assassin', 'Berserker', 'Ruler', 'Avenger', 'Foreigner'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-white/40 block mb-1">
                  Opponent Sprite / Portrait Image URL
                </label>
                <input
                  type="text"
                  placeholder="Opponent portrait image URL"
                  value={defenderAvatarUrl}
                  onChange={e => setDefenderAvatarUrl(e.target.value)}
                  className="w-full bg-[#111] text-white font-mono text-xs px-3 py-2 rounded-sm border border-[#222] outline-none focus:border-red-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Tactical Command Cards & Dialogue Text */}
          <div className="p-4 bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1a1a1a] pb-2">
              <Layers className="w-4 h-4 text-[#d4af37]" />
              <h3 className="text-xs font-mono uppercase tracking-wider text-white font-bold">
                Tactical Command Chain & Visual Novel Dialogue
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-white/40 block mb-1">
                  Chain Resonance Title
                </label>
                <input
                  type="text"
                  value={chainTag}
                  onChange={e => setChainTag(e.target.value)}
                  placeholder="e.g. Buster Brave Chain, Excalibur Incantation..."
                  className="w-full bg-[#111] text-white font-mono text-xs px-3 py-2 rounded-sm border border-[#222] outline-none focus:border-[#d4af37]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-white/40 block mb-1">
                  Command Deck 3-Card Chain
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[0, 1, 2].map(idx => (
                    <select
                      key={idx}
                      value={cardSeq[idx]}
                      onChange={e => {
                        const next = [...cardSeq] as ('Buster' | 'Arts' | 'Quick' | 'NP')[];
                        next[idx] = e.target.value as any;
                        setCardSeq(next);
                      }}
                      className="bg-[#141414] text-white border border-[#333] text-xs font-mono px-2 py-2 rounded-sm outline-none focus:border-[#d4af37]"
                    >
                      <option value="Buster">🔴 Buster</option>
                      <option value="Arts">🔵 Arts</option>
                      <option value="Quick">🟢 Quick</option>
                      <option value="NP">💥 NP</option>
                    </select>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-white/40">
                  Dialogue Quote (Rendered in Elegant High-Contrast Georgia Serif)
                </label>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/40">
                  <span>Quick quotes:</span>
                  <button
                    onClick={() => setDialogueText(SAMPLE_QUOTES[0])}
                    className="hover:text-[#d4af37]"
                  >
                    Summon
                  </button>
                  <span>•</span>
                  <button
                    onClick={() => setDialogueText(SAMPLE_QUOTES[2])}
                    className="hover:text-[#d4af37]"
                  >
                    Excalibur
                  </button>
                  <span>•</span>
                  <button
                    onClick={() => setDialogueText(SAMPLE_QUOTES[3])}
                    className="hover:text-[#d4af37]"
                  >
                    Enuma Elish
                  </button>
                </div>
              </div>
              <textarea
                rows={2}
                value={dialogueText}
                onChange={e => setDialogueText(e.target.value)}
                className="w-full bg-[#111] text-[#fffbeb] font-serif text-sm italic px-3.5 py-2.5 rounded-sm border border-[#222] outline-none focus:border-[#d4af37] resize-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

