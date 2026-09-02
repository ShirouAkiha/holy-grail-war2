'use client';

import React, { useState } from 'react';
import {
  Code,
  Copy,
  Check,
  Terminal,
  Database,
  Layers,
  FileCode,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import { prismaSchemaCode } from '../prisma/schema';
import { summonCommandCode } from '../lib/bot/commands/summon';
import { servantCommandCode } from '../lib/bot/commands/servant';
import { duelCommandCode } from '../lib/bot/commands/duel';
import { grailwarCommandCode } from '../lib/bot/commands/grailwar';
import { attackCommandCode } from '../lib/bot/commands/attack';
import { leakCommandCode } from '../lib/bot/commands/leak';
import { servantsCommandCode } from '../lib/bot/commands/servants';
import { customiseCommandCode } from '../lib/bot/commands/customise';
import { addservantCommandCode } from '../lib/bot/commands/addservant';
import { cegachaCommandCode } from '../lib/bot/commands/cegacha';
import { defensesCommandCode } from '../lib/bot/commands/defenses';
import { profileCommandCode } from '../lib/bot/commands/profile';
import { discordBotMainCode } from '../lib/bot/client';
import { nodeCanvasRendererCode } from '../lib/bot/nodeCanvasExport';
import { deployScriptCode } from '../lib/bot/deploy';

const FILE_MODULES = [
  {
    id: 'bot_index',
    name: 'src/bot/index.ts',
    category: 'Discord Bot v14 Entry Point',
    code: discordBotMainCode
  },
  {
    id: 'bot_deploy',
    name: 'src/bot/deploy.ts',
    category: 'Slash Command Deploy Script (Instant Sync)',
    code: deployScriptCode
  },
  {
    id: 'prisma_schema',
    name: 'prisma/schema.prisma',
    category: 'Prisma ORM & Database',
    code: prismaSchemaCode
  },
  {
    id: 'canvas_renderer',
    name: 'src/canvas/nodeCanvasRenderer.ts',
    category: '@napi-rs/canvas 2D Compositor',
    code: nodeCanvasRendererCode
  },
  {
    id: 'cmd_grailwar',
    name: 'src/bot/commands/grailwar.ts',
    category: 'Slash Command: /grailwar (Status Board & War)',
    code: grailwarCommandCode
  },
  {
    id: 'cmd_attack',
    name: 'src/bot/commands/attack.ts',
    category: 'Slash Command: /attack (Ambush Suspect)',
    code: attackCommandCode
  },
  {
    id: 'cmd_leak',
    name: 'src/bot/commands/leak.ts',
    category: 'Slash Command: /leak (Intel Leak Dispatch)',
    code: leakCommandCode
  },
  {
    id: 'cmd_servants',
    name: 'src/bot/commands/servants.ts',
    category: 'Slash Command: /servants (Codex & Search)',
    code: servantsCommandCode
  },
  {
    id: 'cmd_summon',
    name: 'src/bot/commands/summon.ts',
    category: 'Slash Command: /summon (Ritual)',
    code: summonCommandCode
  },
  {
    id: 'cmd_addservant',
    name: 'src/bot/commands/addservant.ts',
    category: 'Admin Slash Command: /addservant',
    code: addservantCommandCode
  },
  {
    id: 'cmd_servant',
    name: 'src/bot/commands/servant.ts',
    category: 'Slash Command: /servant',
    code: servantCommandCode
  },
  {
    id: 'cmd_duel',
    name: 'src/bot/commands/duel.ts',
    category: 'Slash Command: /duel',
    code: duelCommandCode
  },
  {
    id: 'cmd_customise',
    name: 'src/bot/commands/customise.ts',
    category: 'Slash Command: /customise',
    code: customiseCommandCode
  },
  {
    id: 'cmd_cegacha',
    name: 'src/bot/commands/cegacha.ts',
    category: 'Slash Command: /cegacha (Craft Essence Gacha)',
    code: cegachaCommandCode
  },
  {
    id: 'cmd_defenses',
    name: 'src/bot/commands/defenses.ts',
    category: 'Slash Command: /defenses',
    code: defensesCommandCode
  },
  {
    id: 'cmd_profile',
    name: 'src/bot/commands/profile.ts',
    category: 'Slash Command: /profile',
    code: profileCommandCode
  }
];

export default function CodeExportHub() {
  const [selectedFileId, setSelectedFileId] = useState<string>('bot_index');
  const [copied, setCopied] = useState(false);

  const currentModule = FILE_MODULES.find(m => m.id === selectedFileId) || FILE_MODULES[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(String(currentModule.code));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-[#0a0a0a] rounded-xl border border-[#1a1a1a]">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-sm bg-[#161616] text-[#d4af37] border border-[#d4af37]/30">
            <Code className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-serif italic text-white tracking-wide">Modular Architecture & Export</h2>
            <p className="text-[11px] font-mono text-white/40 uppercase tracking-wider">
              TypeScript codebase for discord.js v14, Prisma ORM, and @napi-rs/canvas
            </p>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="px-4 py-2 rounded-sm bg-[#d4af37] hover:bg-[#c49f27] text-black font-bold font-mono text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied to Clipboard' : 'Copy Active File'}</span>
        </button>
      </div>

      {/* Quick Setup Instructions Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#d4af37] uppercase tracking-wider">
            <Terminal className="w-4 h-4 text-[#d4af37]" /> 1. Dependencies
          </div>
          <p className="text-[11px] font-mono text-white/40">Run in your repository:</p>
          <div className="p-2.5 rounded-sm bg-[#050505] border border-[#1a1a1a] font-mono text-[11px] text-[#d4af37] overflow-x-auto">
            npm i discord.js @napi-rs/canvas @prisma/client
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#3b82f6] uppercase tracking-wider">
            <Database className="w-4 h-4 text-[#3b82f6]" /> 2. Prisma Migration
          </div>
          <p className="text-[11px] font-mono text-white/40">Generate SQLite / Postgres schema:</p>
          <div className="p-2.5 rounded-sm bg-[#050505] border border-[#1a1a1a] font-mono text-[11px] text-white/80 overflow-x-auto">
            npx prisma migrate dev --name init
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#22c55e] uppercase tracking-wider">
            <Layers className="w-4 h-4 text-[#22c55e]" /> 3. Gateway Launch
          </div>
          <p className="text-[11px] font-mono text-white/40">Deploy slash commands & start bot:</p>
          <div className="p-2.5 rounded-sm bg-[#050505] border border-[#1a1a1a] font-mono text-[11px] text-[#22c55e] overflow-x-auto">
            npx tsx src/bot/index.ts
          </div>
        </div>
      </div>

      {/* Code Browser Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* File Directory Sidebar */}
        <div className="p-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] space-y-2">
          <h4 className="text-[10px] font-mono uppercase tracking-widest text-white/40 px-2 mb-2">Project Files</h4>
          <div className="space-y-1">
            {FILE_MODULES.map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedFileId(f.id)}
                className={`w-full text-left px-3 py-2 rounded-sm text-xs font-mono transition flex items-center gap-2 border ${
                  selectedFileId === f.id
                    ? 'bg-[#161616] text-[#d4af37] border-[#d4af37]'
                    : 'bg-transparent text-white/60 border-transparent hover:bg-[#111] hover:text-white'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />
                <div className="truncate">
                  <div className="font-mono text-xs">{f.name}</div>
                  <div className="text-[9px] text-white/40 font-normal">{f.category}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Code Viewer */}
        <div className="lg:col-span-3 rounded-xl bg-[#050505] border border-[#1a1a1a] overflow-hidden shadow-2xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#0a0a0a] border-b border-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white/20" />
              <span className="w-2 h-2 rounded-full bg-white/20" />
              <span className="w-2 h-2 rounded-full bg-white/20" />
              <span className="font-mono text-xs text-white/80 ml-2">{currentModule.name}</span>
            </div>
            <span className="text-[10px] text-white/40 font-mono">TypeScript / ESModules</span>
          </div>

          <pre className="flex-1 p-4 font-mono text-xs text-white/80 overflow-x-auto leading-relaxed max-h-[550px] overflow-y-auto">
            <code>{currentModule.code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
