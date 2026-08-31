'use client';

import React, { useState, useEffect } from 'react';
import {
  MasterProfile,
  HolyGrailWarSession,
  ServantTemplate
} from '../lib/types';
import {
  loadMasterProfile,
  saveMasterProfile,
  loadGrailWarSession,
  saveGrailWarSession,
  getCustomServantsFromStorage,
  saveCustomServantsToStorage
} from '../lib/state/gameState';
import DiscordEmulator from '../components/DiscordEmulator';
import CombatArena from '../components/CombatArena';
import GrailWarSim from '../components/GrailWarSim';
import SummoningSanctum from '../components/SummoningSanctum';
import ServantWorkshop from '../components/ServantWorkshop';
import CanvasStudio from '../components/CanvasStudio';
import CodeExportHub from '../components/CodeExportHub';
import {
  Terminal,
  Swords,
  Castle,
  Sparkles,
  User,
  Image as ImageIcon,
  Code,
  Shield,
  Zap,
  RotateCcw,
  BookOpen
} from 'lucide-react';

export default function Home() {
  const [master, setMaster] = useState<MasterProfile>(loadMasterProfile);
  const [grailWar, setGrailWar] = useState<HolyGrailWarSession>(() => loadGrailWarSession(master));
  const [customServants, setCustomServants] = useState<ServantTemplate[]>(getCustomServantsFromStorage);
  const [activeTab, setActiveTab] = useState<
    'discord' | 'combat' | 'grailwar' | 'summoning' | 'workshop' | 'canvas' | 'code'
  >('discord');

  useEffect(() => {
    saveMasterProfile(master);
  }, [master]);

  useEffect(() => {
    saveGrailWarSession(grailWar);
  }, [grailWar]);

  useEffect(() => {
    saveCustomServantsToStorage(customServants);
  }, [customServants]);

  const activeServant = master.servants.find(s => s.id === master.activeServantId) || master.servants[0];

  const handleUpdateMaster = (updated: MasterProfile) => {
    setMaster(updated);
  };

  const handleUpdateGrailWar = (updated: HolyGrailWarSession) => {
    setGrailWar(updated);
  };

  const handleUpdateCustomServants = (updated: ServantTemplate[]) => {
    setCustomServants(updated);
  };

  return (
    <main className="min-h-screen bg-[#050505] text-[#e5e5e5] flex flex-col font-sans selection:bg-[#d4af37] selection:text-black">
      {/* Top Global Command Navigation Bar */}
      <header className="border-b border-[#1a1a1a] bg-[#0a0a0a]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-sm bg-[#161616] border border-[#d4af37]/60 flex items-center justify-center text-[#d4af37] shadow-[0_0_12px_rgba(212,175,55,0.15)]">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-base font-serif italic tracking-wider text-[#d4af37]">
                  HOLY GRAIL WAR <span className="text-white not-italic font-sans font-semibold text-xs tracking-normal">DISCORD RPG</span>
                </h1>
                <span className="px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest rounded-sm bg-[#161616] text-[#d4af37] border border-[#d4af37]/30">
                  v14.0
                </span>
              </div>
              <p className="text-[11px] text-white/40 tracking-wide font-mono">
                Holy Grail War Engine • Single Servant Summon • Admin Custom Forge
              </p>
            </div>
          </div>

          {/* Master Quick Info & Resources */}
          <div className="flex items-center gap-2.5">
            {activeServant ? (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-sm bg-[#0f0f0f] border border-[#1a1a1a] text-xs">
                <span className="text-white/40 text-[10px] uppercase tracking-wider font-mono">Contract:</span>
                <strong className="text-white font-medium">{activeServant.template.name}</strong>
                <span className="text-[#d4af37] text-[11px] font-mono">
                  [{activeServant.template.servantClass}]
                </span>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-sm bg-[#0f0f0f] border border-[#1a1a1a] text-xs text-white/40">
                <span>No Active Contract (/summon)</span>
              </div>
            )}

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-[#0f0f0f] border border-[#1a1a1a] text-xs font-mono text-rose-400">
              <span className="text-[10px] text-white/40 uppercase tracking-widest">Seals:</span>
              <span className="font-bold">🔴 {master.commandSeals}/3</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-[#0f0f0f] border border-[#1a1a1a] text-xs font-mono text-[#3b82f6]">
              <span className="text-[10px] text-white/40 uppercase tracking-widest">AP:</span>
              <span className="font-bold">{master.actionPoints}/100</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1.5 overflow-x-auto border-t border-[#1a1a1a] pt-1.5 pb-1.5 scrollbar-none">
          {[
            { id: 'discord' as const, label: 'Discord Bot Live Simulator', icon: Terminal, badge: 'Online' },
            { id: 'summoning' as const, label: 'Throne Summoning & Admin Forge', icon: Sparkles },
            { id: 'combat' as const, label: 'Combat Arena (Turn-Based)', icon: Swords },
            { id: 'grailwar' as const, label: 'Holy Grail War (7-Master BR)', icon: Castle },
            { id: 'workshop' as const, label: 'Servant Workshop & Stats', icon: User },
            { id: 'canvas' as const, label: 'Canvas 2D Studio', icon: ImageIcon },
            { id: 'code' as const, label: 'Codebase & Architecture Export', icon: Code }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-sm text-xs font-medium whitespace-nowrap flex items-center gap-2 transition-all ${
                  isActive
                    ? 'bg-[#161616] text-[#d4af37] border-b-2 border-[#d4af37] shadow-[0_0_8px_rgba(212,175,55,0.1)]'
                    : 'text-white/50 hover:text-white hover:bg-[#111111] border-b-2 border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#d4af37]' : 'text-white/40'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider rounded-sm ${
                      isActive ? 'bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40' : 'bg-[#1a1a1a] text-white/40'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'discord' && (
          <div className="h-[750px]">
            <DiscordEmulator
              master={master}
              onUpdateMaster={handleUpdateMaster}
              grailWar={grailWar}
              onUpdateGrailWar={handleUpdateGrailWar}
              customServants={customServants}
              onUpdateCustomServants={handleUpdateCustomServants}
            />
          </div>
        )}

        {activeTab === 'summoning' && (
          <SummoningSanctum
            master={master}
            onUpdateMaster={handleUpdateMaster}
            customServants={customServants}
            onUpdateCustomServants={handleUpdateCustomServants}
          />
        )}

        {activeTab === 'combat' && (
          <CombatArena master={master} onUpdateMaster={handleUpdateMaster} />
        )}

        {activeTab === 'grailwar' && (
          <GrailWarSim
            master={master}
            grailWar={grailWar}
            onUpdateGrailWar={handleUpdateGrailWar}
            onUpdateMaster={handleUpdateMaster}
          />
        )}

        {activeTab === 'workshop' && (
          <ServantWorkshop master={master} onUpdateMaster={handleUpdateMaster} />
        )}

        {activeTab === 'canvas' && <CanvasStudio master={master} />}

        {activeTab === 'code' && <CodeExportHub />}
      </div>

      {/* Footer */}
      <footer className="border-t border-[#1a1a1a] bg-[#080808] py-4 px-6 text-center text-[11px] font-mono text-white/40 flex flex-wrap items-center justify-between gap-4 max-w-7xl w-full mx-auto">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[#22c55e] rounded-full shadow-[0_0_4px_#22c55e]"></span>
          <span>System Online • Discord.js v14 Gateway</span>
        </div>
        <p className="text-center">
          Fate / Holy Grail War Modular Discord RPG • @napi-rs/canvas Compositor & In-Memory Service
        </p>
        <div className="text-right">
          <span className="text-[#d4af37]">GRAIL PROTOCOL v2.1.0</span>
        </div>
      </footer>
    </main>
  );
}
