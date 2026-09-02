'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useState } from 'react';
import {
  MasterProfile,
  MasterServantInstance,
  ServantClass,
  ServantTemplate
} from '../lib/types';
import { SERVANT_DATABASE } from '../lib/data/servants';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  Shield,
  Flame,
  Swords,
  PlusCircle,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Layers,
  Image as ImageIcon,
  Scroll,
  UserCheck,
  UserX,
  BookOpen,
  Search,
  X,
  ExternalLink,
  Download,
  Upload,
  Database
} from 'lucide-react';

interface SummoningSanctumProps {
  master: MasterProfile;
  onUpdateMaster: (master: MasterProfile) => void;
  customServants: ServantTemplate[];
  onUpdateCustomServants: (servants: ServantTemplate[]) => void;
}

export default function SummoningSanctum({
  master,
  onUpdateMaster,
  customServants,
  onUpdateCustomServants
}: SummoningSanctumProps) {
  const [activeSubTab, setActiveSubTab] = useState<'ritual' | 'admin_forge' | 'throne_registry'>('ritual');
  const [isSummoning, setIsSummoning] = useState(false);
  const [summonSuccessServant, setSummonSuccessServant] = useState<ServantTemplate | null>(null);
  const [statusNotice, setStatusNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [registrySearch, setRegistrySearch] = useState('');
  const [registryCategory, setRegistryCategory] = useState<'all' | 'canon' | 'custom'>('all');
  const [inspectedServant, setInspectedServant] = useState<ServantTemplate | null>(null);

  // Admin Custom / Canon Servant Form State
  const [forgeMode, setForgeMode] = useState<'create' | 'edit'>('create');
  const [selectedEditServantId, setSelectedEditServantId] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    servantClass: 'Saber' as ServantClass,
    title: '',
    imageUrl: '',
    hp: 14500,
    atk: 11500,
    npName: '',
    npChant: '',
    npCard: 'Buster' as 'Buster' | 'Arts' | 'Quick',
    summonQuote: '',
    lore: ''
  });

  const activeContract = master.servants?.find(s => s.id === master.activeServantId) || master.servants?.[0];
  const allThrone = [...SERVANT_DATABASE, ...customServants];

  const handleSelectServantToEdit = (servantId: string) => {
    const s = allThrone.find(serv => serv.id === servantId);
    if (!s) return;
    setSelectedEditServantId(s.id);
    setForgeMode('edit');
    setFormData({
      name: s.name,
      servantClass: s.servantClass,
      title: s.title || '',
      imageUrl: s.cardArtUrl || s.avatarUrl || '',
      hp: s.baseHp || 14500,
      atk: s.baseAtk || 11500,
      npName: s.noblePhantasm?.name || '',
      npChant: s.noblePhantasm?.chant || '',
      npCard: s.noblePhantasm?.cardType || 'Buster',
      summonQuote: s.summonQuote || '',
      lore: s.lore || ''
    });
  };

  // Perform Holy Grail War Summoning Ritual (One Servant, Randomly from Throne)
  const handlePerformRitual = () => {
    if (activeContract) {
      setStatusNotice({
        type: 'error',
        message: `You are already bound to ${activeContract.template.name} (${activeContract.template.servantClass}). Sever your current contract first if you wish to summon anew.`
      });
      return;
    }

    setIsSummoning(true);
    setStatusNotice(null);

    setTimeout(() => {
      // Pick random unclaimed Heroic Spirit
      const randomTemplate = allThrone[Math.floor(Math.random() * allThrone.length)];

      const newInstance: MasterServantInstance = {
        id: `contract_${randomTemplate.id}_${Date.now()}`,
        masterId: master.id,
        templateId: randomTemplate.id,
        level: 1,
        experience: 0,
        allocatedStats: { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 },
        availableStatPoints: 10,
        skillLevels: [1, 1, 1],
        customQuotes: {
          summon: randomTemplate.summonQuote,
          battleStart: randomTemplate.battleStartQuote,
          noblePhantasm: randomTemplate.noblePhantasm.chant,
          victory: randomTemplate.victoryQuote,
          defeat: randomTemplate.defeatQuote
        },
        bondLevel: 1,
        template: randomTemplate
      };

      onUpdateMaster({
        ...master,
        servants: [newInstance],
        activeServantId: newInstance.id,
        commandSeals: 3
      });

      setSummonSuccessServant(randomTemplate);
      setIsSummoning(false);

      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 }
      });
    }, 1200);
  };

  // Sever Contract
  const handleSeverContract = () => {
    if (!activeContract) return;
    const name = activeContract.template.name;
    onUpdateMaster({
      ...master,
      servants: [],
      activeServantId: undefined
    });
    setSummonSuccessServant(null);
    setStatusNotice({
      type: 'success',
      message: `Contract with ${name} has been severed. The Heroic Spirit has returned to the Throne of Heroes.`
    });
  };

  // Admin: Create or Edit Servant
  const handleSaveCustomOrEditServant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setStatusNotice({ type: 'error', message: 'Servant name is required!' });
      return;
    }

    const finalPicture = formData.imageUrl.trim() || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';

    if (forgeMode === 'edit' && selectedEditServantId) {
      const target = allThrone.find(s => s.id === selectedEditServantId);
      if (target) {
        target.name = formData.name.trim();
        target.title = formData.title.trim();
        target.servantClass = formData.servantClass;
        target.baseHp = Number(formData.hp) || 14500;
        target.baseAtk = Number(formData.atk) || 11500;
        target.avatarUrl = finalPicture;
        target.cardArtUrl = finalPicture;
        target.summonQuote = formData.summonQuote.trim();
        target.lore = formData.lore.trim();
        if (target.noblePhantasm) {
          target.noblePhantasm.name = formData.npName.trim() || target.noblePhantasm.name;
          target.noblePhantasm.chant = formData.npChant.trim() || target.noblePhantasm.chant;
          target.noblePhantasm.cardType = formData.npCard;
        }

        // Update customServants array or add as custom overlay
        const customIndex = customServants.findIndex(s => s.id === target.id);
        let updatedCustom: ServantTemplate[];
        if (customIndex >= 0) {
          updatedCustom = [...customServants];
          updatedCustom[customIndex] = { ...target };
        } else {
          updatedCustom = [...customServants, { ...target, isCustomOrMeme: target.isCustomOrMeme || false }];
        }
        onUpdateCustomServants(updatedCustom);

        // Also update Master profile if Master has this servant contracted!
        if (master.servants && master.servants.length > 0) {
          const updatedMasterServants = master.servants.map(inst => {
            if (inst.templateId === target.id || inst.template?.id === target.id) {
              return {
                ...inst,
                template: { ...target },
                customQuotes: {
                  ...inst.customQuotes,
                  summon: target.summonQuote,
                  noblePhantasm: target.noblePhantasm?.chant || inst.customQuotes?.noblePhantasm
                }
              };
            }
            return inst;
          });
          onUpdateMaster({
            ...master,
            servants: updatedMasterServants
          });
        }

        // Save to backend API
        fetch('/api/servants/custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'edit_servant', servant: target })
        }).catch(err => console.warn('Disk sync warning:', err));

        setStatusNotice({
          type: 'success',
          message: `✨ Heroic Spirit "${target.name}" [${target.servantClass}] successfully updated! Image and stats synchronized across all contracts.`
        });
        return;
      }
    }

    // Otherwise CREATE new custom servant
    const servantId = `custom_${formData.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`;

    const newServant: ServantTemplate = {
      id: servantId,
      name: formData.name.trim(),
      title: formData.title.trim() || 'Heroic Spirit',
      servantClass: formData.servantClass,
      rarity: 5,
      baseHp: Number(formData.hp) || 14500,
      baseAtk: Number(formData.atk) || 11500,
      baseStats: {
        strength: Math.min(25, Math.max(10, Math.round(Number(formData.atk) / 650))),
        endurance: Math.min(25, Math.max(10, Math.round(Number(formData.hp) / 800))),
        agility: 15,
        mana: 16,
        luck: 14
      },
      commandDeck: ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'],
      skills: [
        {
          id: `${servantId}_s1`,
          name: `${formData.title || formData.name} Insight`,
          cooldown: 5,
          description: 'Increases attack power by 35% for 3 turns.',
          effectType: 'buff_atk',
          value: 35,
          duration: 3,
          icon: '⚔️'
        },
        {
          id: `${servantId}_s2`,
          name: 'Heroic Resolve',
          cooldown: 6,
          description: 'Charges NP gauge by 30% and recovers 2500 HP.',
          effectType: 'np_charge',
          value: 30,
          duration: 1,
          icon: '✨'
        },
        {
          id: `${servantId}_s3`,
          name: 'Command Aura',
          cooldown: 5,
          description: 'Generates 20 Critical Stars and increases Critical Damage by 40%.',
          effectType: 'crit_stars',
          value: 20,
          duration: 3,
          icon: '🌟'
        }
      ],
      noblePhantasm: {
        name: formData.npName.trim() || `${formData.name}'s Secret Art`,
        cardType: formData.npCard,
        chant: formData.npChant.trim() || `Behold the boundless might of ${formData.name}!`,
        description: 'Unleashes devastating divine power upon the opponent.',
        target: 'single',
        multiplier: 500,
        overchargeEffect: 'Attack +20% for 3 turns'
      },
      lore: formData.lore.trim() || 'A legendary Heroic Spirit summoned to fight for the Holy Grail.',
      summonQuote: formData.summonQuote.trim() || `Servant ${formData.servantClass}. I ask of you, are you my Master?`,
      battleStartQuote: 'Let us carve our victory into the annals of history!',
      victoryQuote: 'The contract remains unbroken. Honor to our cause!',
      defeatQuote: 'My apologies, Master... My journey ends here...',
      avatarUrl: finalPicture,
      cardArtUrl: finalPicture,
      isCustomOrMeme: true
    };

    const updated = [...customServants, newServant];
    onUpdateCustomServants(updated);

    // Call disk API endpoint directly as immediate persistence guarantee
    fetch('/api/servants/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', servant: newServant })
    }).catch(err => console.warn('Disk sync warning:', err));

    setStatusNotice({
      type: 'success',
      message: `✨ Heroic Spirit "${newServant.name}" [${newServant.servantClass}] successfully forged and registered into the Throne of Heroes!`
    });

    // Reset form
    setFormData({
      name: '',
      servantClass: 'Saber',
      title: '',
      imageUrl: '',
      hp: 14500,
      atk: 11500,
      npName: '',
      npChant: '',
      npCard: 'Buster',
      summonQuote: '',
      lore: ''
    });
  };

  // Delete Custom Servant
  const handleDeleteCustomServant = (id: string) => {
    const updated = customServants.filter(s => s.id !== id);
    onUpdateCustomServants(updated);

    fetch('/api/servants/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', servantId: id })
    }).catch(err => console.warn('Disk sync warning:', err));

    setStatusNotice({
      type: 'success',
      message: 'Custom Servant removed from Throne of Heroes.'
    });
  };

  // Export Custom Servants JSON
  const handleExportJSON = () => {
    try {
      const jsonStr = JSON.stringify(customServants, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `custom_servants_backup_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setStatusNotice({
        type: 'success',
        message: `📥 Exported ${customServants.length} custom servants to backup JSON file.`
      });
    } catch (err: any) {
      setStatusNotice({
        type: 'error',
        message: `Export failed: ${err?.message || 'Unknown error'}`
      });
    }
  };

  // Import Custom Servants JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          const map = new Map<string, ServantTemplate>();
          customServants.forEach(s => map.set(s.id, s));
          parsed.forEach((s: any) => {
            if (s && s.id && s.name && s.servantClass) {
              map.set(s.id, s);
            }
          });
          const merged = Array.from(map.values());
          onUpdateCustomServants(merged);
          setStatusNotice({
            type: 'success',
            message: `📦 Successfully imported and merged ${parsed.length} custom Heroic Spirits!`
          });
        } else {
          setStatusNotice({
            type: 'error',
            message: 'Invalid file format: Expected an array of ServantTemplate objects.'
          });
        }
      } catch (err: any) {
        setStatusNotice({
          type: 'error',
          message: `Import parse error: ${err?.message || 'Invalid JSON'}`
        });
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-[#0a0a0a] rounded-xl border border-[#1a1a1a]">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-sm bg-[#161616] text-[#d4af37] border border-[#d4af37]/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-serif italic text-white tracking-wide">Throne of Heroes Summoning Sanctum</h2>
            <p className="text-[11px] font-mono text-white/40 uppercase tracking-wider">
              Authentic Holy Grail War Summoning Ritual • Admin Custom Servant Forge
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 bg-[#121212] p-1 rounded-sm border border-[#222]">
          <button
            onClick={() => { setActiveSubTab('ritual'); setStatusNotice(null); }}
            className={`px-3.5 py-1.5 text-xs font-mono tracking-wider rounded-sm transition ${
              activeSubTab === 'ritual'
                ? 'bg-[#d4af37] text-black font-bold'
                : 'text-white/70 hover:text-white'
            }`}
          >
            🕯️ Summoning Ritual
          </button>
          <button
            onClick={() => { setActiveSubTab('admin_forge'); setStatusNotice(null); }}
            className={`px-3.5 py-1.5 text-xs font-mono tracking-wider rounded-sm transition ${
              activeSubTab === 'admin_forge'
                ? 'bg-[#d4af37] text-black font-bold'
                : 'text-white/70 hover:text-white'
            }`}
          >
            🛠️ Admin Servant Forge
          </button>
          <button
            onClick={() => { setActiveSubTab('throne_registry'); setStatusNotice(null); }}
            className={`px-3.5 py-1.5 text-xs font-mono tracking-wider rounded-sm transition ${
              activeSubTab === 'throne_registry'
                ? 'bg-[#d4af37] text-black font-bold'
                : 'text-white/70 hover:text-white'
            }`}
          >
            📜 Throne Registry ({allThrone.length})
          </button>
        </div>
      </div>

      {/* Status Notice Alert */}
      {statusNotice && (
        <div
          className={`p-4 rounded-sm border flex items-center justify-between text-xs font-mono ${
            statusNotice.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {statusNotice.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{statusNotice.message}</span>
          </div>
          <button onClick={() => setStatusNotice(null)} className="text-white/40 hover:text-white text-xs">
            ✕
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: HOLY GRAIL SUMMONING RITUAL                       */}
      {/* ======================================================== */}
      {activeSubTab === 'ritual' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Summoning Circle & Chant */}
          <div className="lg:col-span-7 space-y-5">
            <div className="p-6 bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#d4af37]/5 rounded-full blur-3xl pointer-events-none" />

              <h3 className="text-base font-serif italic text-[#d4af37] tracking-wider mb-2">
                The Great Holy Grail Summoning Circle
              </h3>
              <p className="text-xs text-white/60 leading-relaxed mb-4">
                In this authentic Holy Grail War, each Master is granted <strong>3 Command Seals</strong> and contracts a single Heroic Spirit summoned randomly from the Throne of Heroes.
              </p>

              {/* Incantation Scroll Box */}
              <div className="p-4 bg-[#050505] rounded-sm border border-[#222] font-serif italic text-xs text-white/80 leading-loose mb-6">
                <p>“Let silver and iron be the essence. Let stone and the archduke of contracts be the foundation.”</p>
                <p>“Let the flowing great river be created, and the four corners be filled.”</p>
                <p className="text-[#d4af37] font-semibold">“Let the order of the Holy Grail be fulfilled!”</p>
              </div>

              {/* Contract Status / Summon Action */}
              {activeContract ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-sm bg-amber-950/20 border border-[#d4af37]/40 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <UserCheck className="w-5 h-5 text-[#d4af37]" />
                      <div>
                        <p className="text-xs font-bold text-white">
                          Bound Contract: {activeContract.template.name}
                        </p>
                        <p className="text-[11px] font-mono text-[#d4af37]">
                          Class: [{activeContract.template.servantClass}] • Seals: 3/3 • Bond Lv.{activeContract.bondLevel}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleSeverContract}
                      className="px-3 py-1.5 rounded-sm bg-rose-950/60 hover:bg-rose-900 border border-rose-600/50 text-rose-200 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      Sever Contract
                    </button>
                  </div>
                  <p className="text-[11px] text-white/40 font-mono italic">
                    * To maintain tournament integrity, you must sever your current contract before invoking another Servant.
                  </p>
                </div>
              ) : (
                <div className="text-center py-6 space-y-4">
                  <p className="text-xs font-mono text-white/60">
                    Throne Pool: <strong>{allThrone.length} Heroic Spirits available</strong>
                  </p>
                  <button
                    disabled={isSummoning}
                    onClick={handlePerformRitual}
                    className="px-8 py-3.5 rounded-sm bg-[#d4af37] hover:bg-[#c49f27] text-black font-serif italic text-base font-bold tracking-widest shadow-[0_0_20px_rgba(212,175,55,0.25)] transition duration-200 transform hover:scale-[1.02] disabled:opacity-50"
                  >
                    {isSummoning ? '⚡ Calling from the Throne...' : '✨ Invoke Summoning Ritual'}
                  </button>
                </div>
              )}
            </div>

            {/* Quick Master Information */}
            <div className="p-4 bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-4">
                <span className="text-white/40">Master: <strong className="text-white">{master.username}</strong></span>
                <span className="text-white/40">Seals: <strong className="text-rose-400">🔴🔴🔴 {master.commandSeals}/3</strong></span>
                <span className="text-white/40">AP: <strong className="text-[#d4af37]">{master.actionPoints}/100</strong></span>
              </div>
              <span className="text-white/40">Grail Wins: <strong className="text-white">{master.grailWarWins}</strong></span>
            </div>
          </div>

          {/* Right Column: Contracted / Summoned Servant Display Card */}
          <div className="lg:col-span-5">
            {activeContract ? (
              <div className="p-5 bg-[#0a0a0a] rounded-xl border border-[#d4af37]/40 space-y-4 shadow-[0_0_15px_rgba(212,175,55,0.1)]">
                <div className="flex items-center justify-between border-b border-[#1a1a1a] pb-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#d4af37]">Contracted Servant</span>
                    <h4 className="text-base font-serif italic text-white">{activeContract.template.name}</h4>
                  </div>
                  <span className="px-2.5 py-1 text-xs font-mono uppercase rounded-sm bg-[#161616] text-[#d4af37] border border-[#d4af37]/30">
                    {activeContract.template.servantClass}
                  </span>
                </div>

                {/* Picture Container */}
                <div className="relative h-64 rounded-sm overflow-hidden border border-[#222] bg-[#050505]">
                  <img
                    src={activeContract.template.cardArtUrl || activeContract.template.avatarUrl}
                    alt={activeContract.template.name}
                    className="w-full h-full object-cover object-top"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-[11px] font-serif italic text-white/90">
                      &ldquo;{activeContract.customQuotes?.summon || activeContract.template.summonQuote}&rdquo;
                    </p>
                  </div>
                </div>

                {/* Stats & Parameters */}
                {(() => {
                  const templateId = activeContract.templateId || activeContract.template?.id || activeContract.id;
                  const canonical = SERVANT_DATABASE.find(s => s.id === templateId) || activeContract.template;
                  const sTemplate = { ...canonical, ...(activeContract.template?.isCustomOrMeme ? activeContract.template : {}) };
                  const baseStats = sTemplate.baseStats || { strength: 10, endurance: 10, agility: 10, mana: 10, luck: 10 };
                  const alloc = activeContract.allocatedStats || {};
                  const totalStr = (baseStats.strength || 10) + (alloc.strength || 0);
                  const totalEnd = (baseStats.endurance || 10) + (alloc.endurance || 0);
                  const ceAtk = activeContract.equippedCe?.atkBonus || 0;
                  const ceHp = activeContract.equippedCe?.hpBonus || 0;
                  const lvl = activeContract.level || 1;
                  const activeMaxHp = Math.round((sTemplate.baseHp || 28000) * (1 + (lvl - 1) * 0.05) + totalEnd * 150 + ceHp);
                  const activeTotalAtk = Math.round((sTemplate.baseAtk || 10000) * (1 + (lvl - 1) * 0.05) + totalStr * 80 + ceAtk);

                  return (
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2 rounded bg-[#0f0f0f] border border-[#1a1a1a]">
                        <span className="text-white/40 text-[10px] block">MAX HP:</span>
                        <strong className="text-emerald-400">{activeMaxHp.toLocaleString()}</strong>
                      </div>
                      <div className="p-2 rounded bg-[#0f0f0f] border border-[#1a1a1a]">
                        <span className="text-white/40 text-[10px] block">TOTAL ATK:</span>
                        <strong className="text-rose-400">{activeTotalAtk.toLocaleString()}</strong>
                      </div>
                    </div>
                  );
                })()}

                <div className="p-3 bg-[#0f0f0f] rounded border border-[#1a1a1a] text-xs">
                  <span className="text-[#d4af37] font-mono text-[10px] uppercase tracking-wider block">Noble Phantasm</span>
                  <strong className="text-white">{activeContract.template.noblePhantasm.name}</strong>
                  <p className="text-[11px] text-white/60 font-serif italic mt-1">
                    &ldquo;{activeContract.template.noblePhantasm.chant}&rdquo;
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[350px] p-6 bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] flex flex-col items-center justify-center text-center text-white/40">
                <Sparkles className="w-10 h-10 text-white/20 mb-3" />
                <p className="font-serif italic text-sm text-white/60">No Servant Currently Contracted</p>
                <p className="text-xs font-mono mt-1 max-w-xs">
                  Invoke the summoning ritual to bind an ancient warrior to your command.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: ADMIN SERVANT FORGE (Add / Edit Servants & Photos)*/}
      {/* ======================================================== */}
      {activeSubTab === 'admin_forge' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Form */}
          <div className="lg:col-span-7 bg-[#0a0a0a] p-6 rounded-xl border border-[#1a1a1a] space-y-5">
            <div className="border-b border-[#1a1a1a] pb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-serif italic text-[#d4af37] tracking-wider">
                  Throne of Heroes • Admin Servant Forge & Editor
                </h3>
                <p className="text-xs font-mono text-white/50">
                  Register custom Heroic Spirits or edit any existing Servant (Canon & Custom).
                </p>
              </div>

              {/* Forge Mode Switcher */}
              <div className="flex items-center gap-1 bg-[#121212] p-1 rounded border border-[#222] text-xs font-mono">
                <button
                  type="button"
                  onClick={() => {
                    setForgeMode('create');
                    setSelectedEditServantId('');
                    setFormData({
                      name: '',
                      servantClass: 'Saber',
                      title: '',
                      imageUrl: '',
                      hp: 14500,
                      atk: 11500,
                      npName: '',
                      npChant: '',
                      npCard: 'Buster',
                      summonQuote: '',
                      lore: ''
                    });
                  }}
                  className={`px-3 py-1 rounded transition ${
                    forgeMode === 'create'
                      ? 'bg-[#d4af37] text-black font-bold'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  ➕ Forge New
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForgeMode('edit');
                    if (allThrone.length > 0) {
                      handleSelectServantToEdit(allThrone[0].id);
                    }
                  }}
                  className={`px-3 py-1 rounded transition ${
                    forgeMode === 'edit'
                      ? 'bg-[#d4af37] text-black font-bold'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  ✏️ Edit Existing ({allThrone.length})
                </button>
              </div>
            </div>

            {/* Select Servant Dropdown when in Edit Mode */}
            {forgeMode === 'edit' && (
              <div className="p-3 bg-[#111] rounded border border-[#d4af37]/40 space-y-2 text-xs font-mono">
                <label className="text-[#d4af37] font-bold block">
                  Select Servant to Edit (Canon or Custom):
                </label>
                <select
                  value={selectedEditServantId}
                  onChange={e => handleSelectServantToEdit(e.target.value)}
                  className="w-full px-3 py-2 bg-[#181818] border border-[#333] rounded text-white focus:border-[#d4af37] outline-none"
                >
                  {allThrone.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.isCustomOrMeme ? '🛠️ [Custom]' : '🏛️ [Canon]'} {s.name} ({s.servantClass}) — ID: {s.id}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-white/40 italic">
                  * Editing updates picture artwork, stats, quotes, and Noble Phantasms live across all Master contracts!
                </p>
              </div>
            )}

            <form onSubmit={handleSaveCustomOrEditServant} className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-white/60 block mb-1">Servant True Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Miyamoto Musashi"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-[#141414] border border-[#262626] rounded-sm text-white focus:border-[#d4af37] outline-none"
                  />
                </div>

                <div>
                  <label className="text-white/60 block mb-1">Servant Class *</label>
                  <select
                    value={formData.servantClass}
                    onChange={e => setFormData({ ...formData, servantClass: e.target.value as ServantClass })}
                    className="w-full px-3 py-2 bg-[#141414] border border-[#262626] rounded-sm text-white focus:border-[#d4af37] outline-none"
                  >
                    <option value="Saber">⚔️ Saber</option>
                    <option value="Archer">🏹 Archer</option>
                    <option value="Lancer">🔱 Lancer</option>
                    <option value="Rider">🐎 Rider</option>
                    <option value="Caster">🔮 Caster</option>
                    <option value="Assassin">🗡️ Assassin</option>
                    <option value="Berserker">🔥 Berserker</option>
                    <option value="Ruler">⚖️ Ruler</option>
                    <option value="Avenger">💀 Avenger</option>
                    <option value="Foreigner">🌌 Foreigner</option>
                    <option value="MoonCancer">🌙 MoonCancer</option>
                    <option value="Shitposter">🤡 Shitposter</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-white/60 block mb-1">Epithet / Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Peerless Dual Swordswoman"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 bg-[#141414] border border-[#262626] rounded-sm text-white focus:border-[#d4af37] outline-none"
                  />
                </div>

                <div>
                  <label className="text-white/60 block mb-1">Servant Picture URL (Avatar & Card Art)</label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={formData.imageUrl}
                    onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-[#141414] border border-[#262626] rounded-sm text-white focus:border-[#d4af37] outline-none"
                  />
                </div>
              </div>

              {/* Base Parameters */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-white/60 block mb-1">Base HP (5,000 - 30,000)</label>
                  <input
                    type="number"
                    min="1000"
                    max="50000"
                    value={formData.hp}
                    onChange={e => setFormData({ ...formData, hp: parseInt(e.target.value) || 14000 })}
                    className="w-full px-3 py-2 bg-[#141414] border border-[#262626] rounded-sm text-white focus:border-[#d4af37] outline-none"
                  />
                </div>
                <div>
                  <label className="text-white/60 block mb-1">Base ATK (4,000 - 25,000)</label>
                  <input
                    type="number"
                    min="1000"
                    max="50000"
                    value={formData.atk}
                    onChange={e => setFormData({ ...formData, atk: parseInt(e.target.value) || 11000 })}
                    className="w-full px-3 py-2 bg-[#141414] border border-[#262626] rounded-sm text-white focus:border-[#d4af37] outline-none"
                  />
                </div>
              </div>

              {/* Noble Phantasm */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-white/60 block mb-1">Noble Phantasm Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Ishana Daitensho"
                    value={formData.npName}
                    onChange={e => setFormData({ ...formData, npName: e.target.value })}
                    className="w-full px-3 py-2 bg-[#141414] border border-[#262626] rounded-sm text-white focus:border-[#d4af37] outline-none"
                  />
                </div>
                <div>
                  <label className="text-white/60 block mb-1">NP Card Affinity</label>
                  <select
                    value={formData.npCard}
                    onChange={e => setFormData({ ...formData, npCard: e.target.value as any })}
                    className="w-full px-3 py-2 bg-[#141414] border border-[#262626] rounded-sm text-white focus:border-[#d4af37] outline-none"
                  >
                    <option value="Buster">🔴 Buster (Heavy Damage)</option>
                    <option value="Arts">🔵 Arts (NP Refund)</option>
                    <option value="Quick">🟢 Quick (Critical Stars)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-white/60 block mb-1">Noble Phantasm Chant</label>
                <input
                  type="text"
                  placeholder="e.g. Heavenly maiden, behold my dual blade technique...!"
                  value={formData.npChant}
                  onChange={e => setFormData({ ...formData, npChant: e.target.value })}
                  className="w-full px-3 py-2 bg-[#141414] border border-[#262626] rounded-sm text-white focus:border-[#d4af37] outline-none"
                />
              </div>

              <div>
                <label className="text-white/60 block mb-1">Summon Dialogue Quote</label>
                <input
                  type="text"
                  placeholder="e.g. Servant Saber, Shinmen Musashi has arrived! Are you my Master?"
                  value={formData.summonQuote}
                  onChange={e => setFormData({ ...formData, summonQuote: e.target.value })}
                  className="w-full px-3 py-2 bg-[#141414] border border-[#262626] rounded-sm text-white focus:border-[#d4af37] outline-none"
                />
              </div>

              <div>
                <label className="text-white/60 block mb-1">Historical Lore / Backstory</label>
                <textarea
                  rows={2}
                  placeholder="The legendary master of Niten Ichi-ryu who carved a path through history..."
                  value={formData.lore}
                  onChange={e => setFormData({ ...formData, lore: e.target.value })}
                  className="w-full px-3 py-2 bg-[#141414] border border-[#262626] rounded-sm text-white focus:border-[#d4af37] outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#d4af37] hover:bg-[#c49f27] text-black font-bold font-serif italic text-sm tracking-wider rounded-sm transition flex items-center justify-center gap-2"
              >
                {forgeMode === 'edit' ? (
                  <>
                    <Sparkles className="w-4 h-4" /> Save & Update Servant Changes (/addservant edit)
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" /> Register to Throne of Heroes (/addservant create)
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right: Live Preview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 bg-[#0a0a0a] rounded-xl border border-[#222] space-y-4">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#d4af37] block">
                Live Card Art Preview
              </span>

              <div className="relative h-72 rounded-sm overflow-hidden border border-[#333] bg-[#050505]">
                <img
                  src={formData.imageUrl || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80'}
                  alt="Preview"
                  className="w-full h-full object-cover object-top"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded-sm bg-black/80 border border-[#d4af37]/40 text-[#d4af37] text-[10px] font-mono uppercase">
                  {formData.servantClass}
                </div>

                <div className="absolute bottom-3 left-3 right-3">
                  <h4 className="text-sm font-serif italic text-white font-bold">
                    {formData.name || 'Heroic Spirit Name'}
                  </h4>
                  <p className="text-[10px] text-[#d4af37] font-mono">
                    {formData.title || 'Servant Epithet'}
                  </p>
                  <p className="text-[10px] text-white/80 font-serif italic mt-1 line-clamp-2">
                    &ldquo;{formData.summonQuote || 'I ask of you, are you my Master?'}&rdquo;
                  </p>
                </div>
              </div>

              <div className="p-3 bg-[#0f0f0f] rounded border border-[#1a1a1a] text-xs font-mono space-y-1">
                <div className="flex justify-between text-white/60">
                  <span>HP: <strong className="text-white">{formData.hp.toLocaleString()}</strong></span>
                  <span>ATK: <strong className="text-white">{formData.atk.toLocaleString()}</strong></span>
                </div>
                <div className="text-white/60 pt-1 border-t border-[#1a1a1a]">
                  NP: <strong className="text-[#d4af37]">{formData.npName || 'Noble Phantasm'}</strong> [{formData.npCard}]
                </div>
              </div>
            </div>

            {/* Quick Summary of Active Custom Spirits */}
            <div className="p-4 bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-purple-400" />
                  Custom Spirits In Throne ({customServants.length})
                </span>
                <button
                  onClick={handleExportJSON}
                  disabled={customServants.length === 0}
                  className="px-2 py-1 rounded bg-[#161616] hover:bg-[#222] border border-[#333] text-amber-300 text-[10px] font-mono flex items-center gap-1 disabled:opacity-40 transition"
                >
                  <Download className="w-3 h-3" /> Backup JSON
                </button>
              </div>

              {customServants.length === 0 ? (
                <p className="text-[11px] font-mono text-white/40 italic">
                  No custom Heroic Spirits registered yet. Use the form on the left to forge one!
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {customServants.map(s => (
                    <div
                      key={s.id}
                      className="p-2 rounded bg-[#111] border border-[#222] flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[#d4af37] font-bold">[{s.servantClass}]</span>
                        <span className="text-white font-medium truncate">{s.name}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteCustomServant(s.id)}
                        className="p-1 rounded text-rose-400 hover:bg-rose-950/60 hover:text-rose-200 transition"
                        title="Delete custom spirit"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: THRONE OF HEROES REGISTRY                          */}
      {/* ======================================================== */}
      {activeSubTab === 'throne_registry' && (
        <div className="space-y-4">
          {/* Search & Filter Header Bar */}
          <div className="p-4 bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={registrySearch}
                onChange={e => setRegistrySearch(e.target.value)}
                placeholder="Search Heroic Spirits by name, class, NP, or lore..."
                className="w-full pl-9 pr-8 py-2 bg-[#111] border border-[#222] rounded-lg text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-[#d4af37]"
              />
              {registrySearch && (
                <button
                  onClick={() => setRegistrySearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills and Export/Import Actions */}
            <div className="flex flex-wrap items-center gap-1.5 self-start md:self-auto">
              <button
                onClick={() => setRegistryCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition ${
                  registryCategory === 'all'
                    ? 'bg-[#d4af37] text-black font-semibold'
                    : 'bg-[#111] text-white/60 hover:text-white border border-[#222]'
                }`}
              >
                All ({allThrone.length})
              </button>
              <button
                onClick={() => setRegistryCategory('canon')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition ${
                  registryCategory === 'canon'
                    ? 'bg-[#3b82f6] text-white font-semibold'
                    : 'bg-[#111] text-white/60 hover:text-white border border-[#222]'
                }`}
              >
                Canon ({SERVANT_DATABASE.length})
              </button>
              <button
                onClick={() => setRegistryCategory('custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition ${
                  registryCategory === 'custom'
                    ? 'bg-[#9333ea] text-white font-semibold'
                    : 'bg-[#111] text-white/60 hover:text-white border border-[#222]'
                }`}
              >
                Custom ({customServants.length})
              </button>

              <div className="h-4 w-[1px] bg-white/20 mx-1 hidden sm:block" />

              {/* JSON Backup & Restore for custom servants */}
              <button
                onClick={handleExportJSON}
                title="Backup custom servants to JSON file"
                className="px-2.5 py-1.5 rounded-lg text-xs font-mono bg-[#181818] hover:bg-[#252525] text-amber-300 border border-amber-500/30 flex items-center gap-1 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export ({customServants.length})</span>
              </button>

              <label
                title="Import custom servants from JSON backup file"
                className="px-2.5 py-1.5 rounded-lg text-xs font-mono bg-[#181818] hover:bg-[#252525] text-emerald-300 border border-emerald-500/30 flex items-center gap-1 cursor-pointer transition"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import JSON</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportJSON}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Servants Grid */}
          {(() => {
            const filtered = allThrone.filter(s => {
              if (registryCategory === 'canon' && s.isCustomOrMeme) return false;
              if (registryCategory === 'custom' && !s.isCustomOrMeme) return false;
              if (!registrySearch.trim()) return true;
              const q = registrySearch.toLowerCase().trim();
              return (
                s.name.toLowerCase().includes(q) ||
                s.servantClass.toLowerCase().includes(q) ||
                s.title.toLowerCase().includes(q) ||
                s.noblePhantasm.name.toLowerCase().includes(q) ||
                (s.lore && s.lore.toLowerCase().includes(q))
              );
            });

            if (filtered.length === 0) {
              return (
                <div className="p-8 text-center bg-[#0a0a0a] rounded-xl border border-[#1a1a1a]">
                  <p className="text-sm font-mono text-white/60">No Heroic Spirits found matching &quot;{registrySearch}&quot;</p>
                  <button
                    onClick={() => {
                      setRegistrySearch('');
                      setRegistryCategory('all');
                    }}
                    className="mt-3 px-3 py-1 text-xs font-mono bg-[#161616] text-[#d4af37] border border-[#d4af37]/30 rounded-lg hover:bg-[#222]"
                  >
                    Reset Search Filters
                  </button>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((s, idx) => (
                  <div
                    key={s.id || idx}
                    onClick={() => setInspectedServant(s)}
                    className="p-4 bg-[#0a0a0a] hover:bg-[#111] transition-all rounded-xl border border-[#1a1a1a] hover:border-[#d4af37]/50 flex gap-3 relative group cursor-pointer shadow-lg"
                  >
                    <div className="w-20 h-24 rounded-sm overflow-hidden bg-[#111] border border-[#222] flex-shrink-0 relative">
                      <img src={s.avatarUrl || s.cardArtUrl} alt={s.name} className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300" referrerPolicy="no-referrer" />
                      <span className="absolute bottom-1 right-1 text-[8px] font-mono px-1 rounded bg-black/80 text-amber-300">
                        {'★'.repeat(s.rarity || 5)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h5 className="text-xs font-serif italic text-white truncate font-bold group-hover:text-[#d4af37] transition-colors">{s.name}</h5>
                        <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-[#161616] text-[#d4af37] border border-[#d4af37]/30 flex-shrink-0">
                          {s.servantClass}
                        </span>
                      </div>
                      <p className="text-[10px] text-white/40 font-mono truncate">{s.title}</p>
                      <p className="text-[10px] text-white/60 font-mono mt-1">
                        HP: {s.baseHp.toLocaleString()} | ATK: {s.baseAtk.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-[#d4af37] font-mono truncate mt-0.5">
                        NP: {s.noblePhantasm?.name}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[9px] font-mono text-white/30 group-hover:text-[#d4af37] flex items-center gap-1 transition-colors">
                          <ExternalLink className="w-2.5 h-2.5" /> View Full Profile
                        </span>
                        {s.isCustomOrMeme ? (
                          <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-purple-950/60 text-purple-300 border border-purple-800/40">Custom</span>
                        ) : (
                          <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-blue-950/60 text-blue-300 border border-blue-800/40">Canon</span>
                        )}
                      </div>
                    </div>

                    {/* Delete button for custom servants */}
                    {s.isCustomOrMeme && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteCustomServant(s.id);
                        }}
                        title="Delete Custom Servant"
                        className="absolute top-2 right-2 p-1.5 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-600/40 opacity-0 group-hover:opacity-100 transition z-10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Full Servant Profile Modal */}
          {inspectedServant && (
            <div
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setInspectedServant(null)}
            >
              <div
                className="bg-[#0f172a] border border-[#38bdf8]/40 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative"
                onClick={e => e.stopPropagation()}
              >
                <button
                  onClick={() => setInspectedServant(null)}
                  className="absolute top-4 right-4 p-2 rounded-lg bg-[#1e293b] text-white/60 hover:text-white hover:bg-[#334155] transition"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex flex-col sm:flex-row gap-6 items-start">
                  <div className="w-36 h-48 rounded-xl overflow-hidden bg-black/40 border border-white/10 flex-shrink-0 mx-auto sm:mx-0 shadow-lg">
                    <img
                      src={inspectedServant.avatarUrl || inspectedServant.cardArtUrl}
                      alt={inspectedServant.name}
                      className="w-full h-full object-cover object-top"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 text-xs font-mono font-bold bg-[#1e293b] text-[#38bdf8] border border-[#38bdf8]/30 rounded">
                        {inspectedServant.servantClass}
                      </span>
                      <span className="text-amber-400 font-mono text-xs">
                        {'★'.repeat(inspectedServant.rarity || 5)}
                      </span>
                      {inspectedServant.isCustomOrMeme ? (
                        <span className="px-2 py-0.5 text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800 rounded">
                          🛠️ Custom Admin Spirit
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-800 rounded">
                          🏛️ Canon Heroic Spirit
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl font-serif italic text-white font-bold mt-2">
                      {inspectedServant.name}
                    </h3>
                    <p className="text-xs text-white/50 font-mono italic">{inspectedServant.title}</p>

                    <div className="grid grid-cols-2 gap-2 mt-4 text-xs font-mono">
                      <div className="p-2 rounded bg-black/40 border border-white/5">
                        <span className="text-white/40 block text-[10px]">BASE HP</span>
                        <span className="text-emerald-400 font-bold">{inspectedServant.baseHp.toLocaleString()}</span>
                      </div>
                      <div className="p-2 rounded bg-black/40 border border-white/5">
                        <span className="text-white/40 block text-[10px]">BASE ATK</span>
                        <span className="text-rose-400 font-bold">{inspectedServant.baseAtk.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Parameters */}
                <div className="mt-6 p-3.5 bg-black/40 rounded-xl border border-white/5">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-white/50 mb-2">Combat Parameters</h4>
                  <div className="grid grid-cols-5 gap-2 text-center text-xs font-mono">
                    <div className="p-1.5 rounded bg-white/5"><span className="text-[10px] text-white/40 block">STR</span><strong className="text-white">{inspectedServant.baseStats.strength}</strong></div>
                    <div className="p-1.5 rounded bg-white/5"><span className="text-[10px] text-white/40 block">END</span><strong className="text-white">{inspectedServant.baseStats.endurance}</strong></div>
                    <div className="p-1.5 rounded bg-white/5"><span className="text-[10px] text-white/40 block">AGI</span><strong className="text-white">{inspectedServant.baseStats.agility}</strong></div>
                    <div className="p-1.5 rounded bg-white/5"><span className="text-[10px] text-white/40 block">MAN</span><strong className="text-white">{inspectedServant.baseStats.mana}</strong></div>
                    <div className="p-1.5 rounded bg-white/5"><span className="text-[10px] text-white/40 block">LCK</span><strong className="text-white">{inspectedServant.baseStats.luck}</strong></div>
                  </div>
                </div>

                {/* Noble Phantasm */}
                <div className="mt-4 p-4 rounded-xl bg-amber-950/20 border border-amber-500/30">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-serif italic text-amber-300 font-bold flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-amber-400" />
                      {inspectedServant.noblePhantasm.name}
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30">
                      {inspectedServant.noblePhantasm.cardType} • {inspectedServant.noblePhantasm.target.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-amber-200/70 font-mono italic mt-1.5">
                    &quot;{inspectedServant.noblePhantasm.chant}&quot;
                  </p>
                  <p className="text-xs text-white/80 font-mono mt-2 leading-relaxed">
                    {inspectedServant.noblePhantasm.description}
                  </p>
                </div>

                {/* Skills */}
                {inspectedServant.skills && inspectedServant.skills.length > 0 && (
                  <div className="mt-4 p-3.5 bg-black/40 rounded-xl border border-white/5">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-white/50 mb-2">Class & Active Skills</h4>
                    <div className="space-y-2">
                      {inspectedServant.skills.map((sk, idx) => (
                        <div key={idx} className="p-2 rounded bg-white/5 text-xs font-mono">
                          <div className="flex items-center justify-between">
                            <span className="text-[#38bdf8] font-bold">✨ {sk.name}</span>
                            <span className="text-white/40 text-[10px]">CD: {sk.cooldown} Turns</span>
                          </div>
                          <p className="text-white/70 text-[11px] mt-0.5">{sk.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Historical Lore */}
                {inspectedServant.lore && (
                  <div className="mt-4 p-3.5 bg-black/40 rounded-xl border border-white/5">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-white/50 mb-1.5">Legend & Lore</h4>
                    <p className="text-xs text-white/70 font-mono leading-relaxed">{inspectedServant.lore}</p>
                  </div>
                )}

                {/* Dialogue Quotes */}
                <div className="mt-4 p-3.5 bg-black/40 rounded-xl border border-white/5 space-y-1.5 text-xs font-mono">
                  <h4 className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Master Quotes</h4>
                  <p className="text-white/80"><span className="text-amber-400">Summon:</span> &quot;{inspectedServant.summonQuote}&quot;</p>
                  <p className="text-white/80"><span className="text-amber-400">Battle:</span> &quot;{inspectedServant.battleStartQuote}&quot;</p>
                  <p className="text-white/80"><span className="text-amber-400">Victory:</span> &quot;{inspectedServant.victoryQuote}&quot;</p>
                </div>

                {/* Admin Quick Edit Action */}
                <div className="mt-5 pt-3 border-t border-white/10 flex justify-end">
                  <button
                    onClick={() => {
                      handleSelectServantToEdit(inspectedServant.id);
                      setActiveSubTab('admin_forge');
                      setInspectedServant(null);
                    }}
                    className="px-4 py-2 bg-[#d4af37] hover:bg-[#c49f27] text-black font-bold font-mono text-xs rounded-lg transition flex items-center gap-1.5 shadow-lg"
                  >
                    <Sparkles className="w-4 h-4" /> ✏️ Edit Servant Details & Artwork
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
