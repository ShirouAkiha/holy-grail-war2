'use client';

import React, { useState } from 'react';
import {
  Megaphone,
  Copy,
  Check,
  Sparkles,
  Swords,
  Shield,
  Bot,
  Send,
  Zap,
  BookOpen,
  Calendar,
  Gift,
  Flame,
  Settings,
  Terminal,
  Server,
  Share2,
  Bell,
  Code
} from 'lucide-react';

interface AnnouncementTemplate {
  id: string;
  title: string;
  category: 'Launch' | 'Holy Grail War' | 'Update' | 'Tournament' | 'Maintenance';
  badge: string;
  badgeColor: string;
  icon: any;
  summary: string;
  generateMarkdown: (params: CustomParams) => string;
  generateEmbedPreview: (params: CustomParams) => {
    title: string;
    description: string;
    fields: { name: string; value: string; inline?: boolean }[];
    color: string;
    footer: string;
    author: string;
  };
}

interface CustomParams {
  serverName: string;
  hostName: string;
  sqPrize: number;
  startDate: string;
  channelName: string;
  customNote: string;
}

const DEFAULT_PARAMS: CustomParams = {
  serverName: 'Chaldea Discord Gate',
  hostName: 'Kotomine Kirei [Overseer]',
  sqPrize: 120,
  startDate: 'Tonight at 20:00 UTC',
  channelName: '#grail-war-fuyuki',
  customNote: 'May the Holy Grail smile upon the most cunning Master and Heroic Spirit.'
};

const TEMPLATES: AnnouncementTemplate[] = [
  {
    id: 'grand_launch',
    title: '🚀 Grand Server Launch & Bot Activation',
    category: 'Launch',
    badge: 'Official Release',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    icon: Sparkles,
    summary: 'The ultimate welcome announcement introducing the Fate Holy Grail War Discord RPG bot, core features, starting bonus, and beginner commands.',
    generateMarkdown: (p) =>
`# 🌌 ⚔️ THE HOLY GRAIL WAR COMMENCES IN ${p.serverName.toUpperCase()} ⚔️ 🌌

> *"Hearken, O Lord! The Holy Grail has chosen its battleground. The ley lines surge, the Command Seals manifest upon the flesh of seven Masters!"*

@everyone @here

The **Fate / Holy Grail War Modular Discord RPG** is officially live on **${p.serverName}**! Prepare your soul for tactical battles, Servant summoning, Noble Phantasm clashes, telepathic AI dialogues, and territory warfare.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### 🌟 MASTER ONBOARDING GIFT
Every Master who enters the ritual today receives:
• 🎁 **+30 Saint Quartz (SQ)** for an instant 10x Servant Summon
• 🩸 **3x Sacred Command Seals** for tactical combat overrides
• 🛡️ **Starter Boundary Field Defense** in their Workshop

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### ⚡ QUICKSTART COMMANDS
• \`/summon\` — Perform high-rarity Heroic Spirit summoning ritual with dynamic canvas banners
• \`/profile\` — Inspect your Master stats, equipped Craft Essence, and inventory
• \`/daily\` — Claim daily Saint Quartz, Mana Prisms, and Leyline materials
• \`/talk\` — Engage in immersive, lore-authentic telepathic AI dialogue with your Servant
• \`/grailwar\` — Enter the active 7-Master Fuyuki City battle royale
• \`/duel @user\` — Challenge rival Masters to a high-stakes Noble Phantasm duel
• \`/apikey\` — Connect ultra-fast free AI models (Groq 70B, Google Gemini, OpenRouter) for unlimited chat!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 **Official Battleground:** ${p.channelName}
👑 **Chalice Overseer:** ${p.hostName}
📜 *"${p.customNote}"*`,
    generateEmbedPreview: (p) => ({
      author: `Fate Holy Grail War • ${p.serverName}`,
      title: '⚔️ THE HOLY GRAIL WAR IS NOW LIVE',
      description: `The leylines have aligned! The modular Discord RPG system is active in **${p.serverName}**.\n\nSummon legendary Heroic Spirits (Saber, Archer, Lancer, Rider, Caster, Assassin, Berserker, Ruler, Avenger), equip Craft Essences, and clash for the Chalice of Heaven!`,
      fields: [
        { name: '🎁 Starter Bonus', value: '`+30 SQ` • `3 Command Seals` • `Starter Defenses`', inline: true },
        { name: '📍 Battle Channel', value: `\`${p.channelName}\``, inline: true },
        { name: '👑 Overseer', value: `\`${p.hostName}\``, inline: true },
        {
          name: '🔮 Essential Commands',
          value: '• `/summon` — Summon Heroic Spirits\n• `/profile` — View Master & Servant Status\n• `/grailwar` — 7-Master Battle Royale\n• `/talk` — Telepathic AI Servant Dialogue\n• `/duel` — 1v1 Noble Phantasm Clash\n• `/daily` — Daily SQ & Mana Prisms'
        },
        {
          name: '⚡ Zero Cost AI Models Included',
          value: 'Run `/apikey` to switch between 100% Free Groq Llama 3.3 70B (300+ tok/s), Google Gemini 3.5 Flash, or Local Ollama!'
        }
      ],
      color: '#d4af37',
      footer: `Fate Holy Grail War Gateway • ${p.startDate}`
    })
  },
  {
    id: 'grail_war_round',
    title: '🏆 Holy Grail War: New Season Opening',
    category: 'Holy Grail War',
    badge: 'Season Start',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    icon: Swords,
    summary: 'Announce the registration phase and start time for a 7-Master Fuyuki City Battle Royale season with SQ prizes.',
    generateMarkdown: (p) =>
`# 🏆 ⚔️ FUYUKI HOLY GRAIL WAR: REGISTRATION OPEN ⚔️ 🏆

> *"Let seven Masters gather. Let seven Heroic Spirits clash. Only one soul shall claim the Wish-Granting Chalice!"*

@everyone 

The Church Sanctuary has declared the onset of a new **Holy Grail War Season** in ${p.channelName}!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### 📅 WAR TIMELINE & REWARDS
• ⏰ **War Commencement:** **${p.startDate}**
• 💎 **Grand Champion Prize:** **${p.sqPrize} Saint Quartz** + Exclusive Holy Grail Trophy Profile Badge
• 🩸 **Rule of Engagement:** Elimination Battle Royale with Territory Traps, Ambush, Noble Phantasm Duels & Leyline Leaks

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### 📝 HOW TO PARTICIPATE
1️⃣ Summon your Servant with \`/summon\`
2️⃣ Fortify your Workshop with \`/defenses\` and \`/trap\`
3️⃣ Register your contract by entering \`/grailwar register\` in ${p.channelName}
4️⃣ Coordinate patrol routes with \`/patrol\` and send \`/familiar\` scouts!

*Overseer's Decree:* "${p.customNote}"`,
    generateEmbedPreview: (p) => ({
      author: 'Fuyuki Church Sanctuary • Overseer Declaration',
      title: '🏆 NEW HOLY GRAIL WAR TOURNAMENT HAS COMMENCED',
      description: `Masters of **${p.serverName}**, prepare your Servants. The ritual circle is active and registration is open for the upcoming Grail War season.`,
      fields: [
        { name: '🏆 Grand Prize', value: `\`${p.sqPrize} Saint Quartz\` + Grail Winner Role`, inline: true },
        { name: '⏰ Start Time', value: `\`${p.startDate}\``, inline: true },
        { name: '📍 Channel', value: `\`${p.channelName}\``, inline: true },
        {
          name: '⚔️ War Phases',
          value: '1. **Scouting:** `/patrol` & `/familiar` to detect enemy Masters\n2. **Territory:** Deploy `/trap` and reinforce `/defenses`\n3. **Engagement:** `/ambush` and `/duel` for decisive Noble Phantasm clashes\n4. **Ascension:** Winner claims the Chalice!'
        }
      ],
      color: '#e11d48',
      footer: 'Church Sanctuary Registry • Fuyuki District'
    })
  },
  {
    id: 'byok_ai_models',
    title: '🧠 AI Engine & Free Models Update (BYOK)',
    category: 'Update',
    badge: 'Free Models Hub',
    badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
    icon: Zap,
    summary: 'Announce the expanded 8-provider support with 20+ 100% Free AI models (Groq 70B, Google Gemini, OpenRouter, Ollama) for unlimited Servant chat.',
    generateMarkdown: (p) =>
`# ⚡ 🧠 UNLIMITED SERVANT AI CHAT & FREE MODELS UPDATE 🧠 ⚡

> *"Direct mind-to-soul telepathic link established. The boundary between Master and Heroic Spirit dissolves!"*

@everyone 

We have upgraded the Servant Telepathic Dialogue system with **Zero-Cost Free AI Providers**! You can now chat unlimitedly with your summoned Servants at blazing speed.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### 🌟 100% FREE AI PROVIDERS SUPPORTED
• ⚡ **Groq Cloud (Llama 3.3 70B Versatile):** Ultra-fast 300+ tokens/second inference on LPUs (100% Free)
• 🔷 **Google AI Studio (Gemini 3.5 Flash):** Unmatched emotional fidelity & visual novel roleplay depth
• 🌐 **OpenRouter (:free tier):** Access \`meta-llama/llama-3.3-70b-instruct:free\` & \`gemini-2.0-flash-exp:free\`
• 💻 **Ollama Local AI:** 100% Private, offline execution running right on your machine!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### 🚀 HOW TO ACTIVATE IN 10 SECONDS
1. Type \`/apikey\` in ${p.channelName}
2. Click **"Free Models Menu"** or select **"Groq Free 70B"**
3. Start talking immediately via \`/talk message:<your question>\`!

*All keys are strictly AES-256-GCM encrypted and private to your account.*`,
    generateEmbedPreview: (p) => ({
      author: 'Fate Engine • AI Providers & BYOK Hub',
      title: '⚡ UNLIMITED TELEPATHIC DIALOGUE ACTIVATED',
      description: 'Masters can now connect personal keys or select from curated 100% Free AI models for infinite lore-accurate Servant dialogues.',
      fields: [
        { name: '⚡ Fastest Free Model', value: '`Groq Llama 3.3 70B` (300+ tok/s)', inline: true },
        { name: '🔷 Top Roleplay Nuance', value: '`Google Gemini 3.5 Flash` (Free)', inline: true },
        { name: '🔒 Security', value: '`AES-256-GCM Encrypted`', inline: true },
        {
          name: '💬 How to Talk',
          value: '• `/talk message:Who were you in your past life?`\n• `/talk message:What strategy should we use in Fuyuki?`\n• `/apikey` to switch models anytime.'
        }
      ],
      color: '#3b82f6',
      footer: 'Fate Vault Security Engine • Zero Cost AI'
    })
  },
  {
    id: 'patch_notes',
    title: '🛠️ Major Patch 2.5: Dynamic Canvas & Craft Essences',
    category: 'Update',
    badge: 'v2.5 Patch Notes',
    badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
    icon: BookOpen,
    summary: 'Detailed changelog covering Bond 10 CE unlocking, dynamic 2D canvas card generation, and balance adjustments.',
    generateMarkdown: (p) =>
`# 📜 🛠️ FATE HOLY GRAIL WAR — PATCH 2.5 CHANGELOG 🛠️ 📜

Greetings, Masters of **${p.serverName}**! A major balance update and feature expansion has been deployed to the bot engine.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### ✨ NEW FEATURES
• 🎨 **Dynamic Canvas Compositor:** High-resolution Servant status cards, Noble Phantasm banners, and Gacha summon reels.
• 💖 **Bond 10 Unique Craft Essences:** Reach Bond Level 10 with your Servant to automatically forge their legendary signature CE!
• 🛡️ **Territory Defense System:** Build Magecraft Bounding Fields, Leyline Fortifications, and anti-ambush wards with \`/defenses\`.
• ⚔️ **Advanced Noble Phantasm Clash:** Custom elemental affinities, Buster/Arts/Quick chains, and cinematic battle animations.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### ⚖️ BALANCE ADJUSTMENTS
• Daily Login SQ increased to **10 SQ** + 3x Mana Prisms per streak day.
• Command Seal regeneration standardized to **1 Seal every 24 Hours**.
• Berserker Madness Enhancement attack scaling increased by +12%.

*Jump into ${p.channelName} and type \`/daily\` to claim your patch celebration bonus!*`,
    generateEmbedPreview: (p) => ({
      author: 'Chaldea Engineering Division • Patch Notes',
      title: '🛠️ UPDATE v2.5: DYNAMIC CANVAS & CRAFT ESSENCES',
      description: 'The latest engine update introduces visual canvas rendering, Bond 10 CE forging, and territory defense overhaul.',
      fields: [
        { name: '🎨 New Graphics', value: 'High-DPI Node Canvas Banners', inline: true },
        { name: '💖 Bond 10 CEs', value: 'Exclusive Servant Signature Relics', inline: true },
        { name: '⚔️ Combat Overhaul', value: 'Buster / Arts / Quick Chain Modifiers', inline: true },
        {
          name: '🎁 Patch Celebration Bonus',
          value: 'Run `/daily` today to claim **+10 Bonus SQ** and **3 Mana Prisms**!'
        }
      ],
      color: '#8b5cf6',
      footer: 'Fate Holy Grail War Engine • Build v2.5.0'
    })
  },
  {
    id: 'server_maintenance',
    title: '⚠️ Scheduled Leyline Maintenance & Backup',
    category: 'Maintenance',
    badge: 'Notice',
    badgeColor: 'bg-red-500/20 text-red-400 border-red-500/40',
    icon: Shield,
    summary: 'A clean maintenance warning notice for bot restarts, database indexing, or scheduled upgrades.',
    generateMarkdown: (p) =>
`# ⚠️ ⏳ SCHEDULED LEYLINE MAINTENANCE NOTICE ⏳ ⚠️

@here

Please be advised that the **Fate Holy Grail War Bot** in **${p.serverName}** will undergo scheduled leyline maintenance.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 🕒 **Scheduled Window:** **${p.startDate}**
• ⏱️ **Expected Downtime:** ~5 to 10 minutes
• 🔒 **Data Safety:** All Master profiles, summoned Servants, SQ balances, and Craft Essences are safely persisted in cold storage.

*During this maintenance window, ongoing duels and grail wars will be safely paused. Thank you for your patience!*`,
    generateEmbedPreview: (p) => ({
      author: 'System Operations • Maintenance Notice',
      title: '⚠️ SCHEDULED LEYLINE MAINTENANCE',
      description: `The bot gateway will briefly restart for database optimization and security updates.`,
      fields: [
        { name: '🕒 Window', value: `\`${p.startDate}\``, inline: true },
        { name: '⏱️ Duration', value: '`~5-10 Minutes`', inline: true },
        { name: '💾 Save State', value: '`100% Persisted`', inline: true }
      ],
      color: '#ef4444',
      footer: 'Chaldea Server Operations'
    })
  }
];

export default function AnnouncementHub() {
  const [selectedTemplate, setSelectedTemplate] = useState<AnnouncementTemplate>(TEMPLATES[0]);
  const [params, setParams] = useState<CustomParams>(DEFAULT_PARAMS);
  const [copiedType, setCopiedType] = useState<'markdown' | 'embed' | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'markdown' | 'setup_guide'>('preview');

  const handleCopyMarkdown = () => {
    const text = selectedTemplate.generateMarkdown(params);
    navigator.clipboard.writeText(text);
    setCopiedType('markdown');
    setTimeout(() => setCopiedType(null), 2000);
  };

  const preview = selectedTemplate.generateEmbedPreview(params);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#121212] via-[#1a140b] to-[#121212] border border-[#d4af37]/30 rounded-lg p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#d4af37]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40 flex items-center gap-1">
                <Megaphone className="w-3 h-3" />
                Server Broadcast Center
              </span>
              <span className="text-xs text-white/40 font-mono">Discord Markdown & Embed Templates</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
              Server Release & Announcement Hub
            </h1>
            <p className="text-xs sm:text-sm text-white/60 mt-1 max-w-2xl">
              Ready-to-copy Discord broadcast messages, launch embeds, tournament declarations, and patch notes for server admins and Chalice Overseers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              className="px-4 py-2.5 bg-[#d4af37] hover:bg-[#c49f27] text-black font-semibold text-xs rounded-md shadow-md flex items-center gap-2 transition-all"
            >
              {copiedType === 'markdown' ? <Check className="w-4 h-4 text-black" /> : <Copy className="w-4 h-4 text-black" />}
              <span>{copiedType === 'markdown' ? 'Copied to Clipboard!' : 'Copy Discord Text'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Template Selector & Parameters */}
        <div className="lg:col-span-5 space-y-5">
          {/* Template Picker */}
          <div className="bg-[#101010] border border-[#222] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-mono uppercase tracking-wider text-white/70 flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-[#d4af37]" />
                Select Announcement Type
              </h2>
              <span className="text-[10px] font-mono text-white/40">{TEMPLATES.length} Templates</span>
            </div>

            <div className="space-y-2">
              {TEMPLATES.map((tmpl) => {
                const Icon = tmpl.icon;
                const isSelected = selectedTemplate.id === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    onClick={() => setSelectedTemplate(tmpl)}
                    className={`w-full text-left p-3 rounded-md transition-all border flex items-start gap-3 ${
                      isSelected
                        ? 'bg-[#181818] border-[#d4af37]/60 shadow-[0_0_12px_rgba(212,175,55,0.15)]'
                        : 'bg-[#141414] border-[#222] hover:border-white/20 hover:bg-[#161616]'
                    }`}
                  >
                    <div className={`p-2 rounded mt-0.5 ${isSelected ? 'bg-[#d4af37]/20 text-[#d4af37]' : 'bg-[#202020] text-white/50'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : 'text-white/80'}`}>
                          {tmpl.title}
                        </span>
                        <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border shrink-0 ${tmpl.badgeColor}`}>
                          {tmpl.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/50 line-clamp-2 mt-0.5">
                        {tmpl.summary}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Customizer Settings Form */}
          <div className="bg-[#101010] border border-[#222] rounded-lg p-4 space-y-3">
            <h2 className="text-xs font-mono uppercase tracking-wider text-white/70 flex items-center gap-2">
              <Settings className="w-3.5 h-3.5 text-[#d4af37]" />
              Broadcast Parameters
            </h2>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-[11px] font-mono text-white/50 mb-1">Server Name</label>
                <input
                  type="text"
                  value={params.serverName}
                  onChange={(e) => setParams({ ...params, serverName: e.target.value })}
                  className="w-full bg-[#181818] border border-[#333] rounded px-2.5 py-1.5 text-white focus:border-[#d4af37] outline-none font-mono"
                  placeholder="e.g., Fuyuki Holy Grail War Discord"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-mono text-white/50 mb-1">Target Channel</label>
                  <input
                    type="text"
                    value={params.channelName}
                    onChange={(e) => setParams({ ...params, channelName: e.target.value })}
                    className="w-full bg-[#181818] border border-[#333] rounded px-2.5 py-1.5 text-white focus:border-[#d4af37] outline-none font-mono"
                    placeholder="e.g., #grail-war"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-white/50 mb-1">SQ Prize Pool</label>
                  <input
                    type="number"
                    value={params.sqPrize}
                    onChange={(e) => setParams({ ...params, sqPrize: Number(e.target.value) || 0 })}
                    className="w-full bg-[#181818] border border-[#333] rounded px-2.5 py-1.5 text-white focus:border-[#d4af37] outline-none font-mono"
                    placeholder="120"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-mono text-white/50 mb-1">Start Date / Time</label>
                  <input
                    type="text"
                    value={params.startDate}
                    onChange={(e) => setParams({ ...params, startDate: e.target.value })}
                    className="w-full bg-[#181818] border border-[#333] rounded px-2.5 py-1.5 text-white focus:border-[#d4af37] outline-none font-mono"
                    placeholder="e.g., Tonight at 20:00 UTC"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-white/50 mb-1">Overseer Name</label>
                  <input
                    type="text"
                    value={params.hostName}
                    onChange={(e) => setParams({ ...params, hostName: e.target.value })}
                    className="w-full bg-[#181818] border border-[#333] rounded px-2.5 py-1.5 text-white focus:border-[#d4af37] outline-none font-mono"
                    placeholder="Kotomine Kirei"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-white/50 mb-1">Custom Overseer Decree / Note</label>
                <textarea
                  rows={2}
                  value={params.customNote}
                  onChange={(e) => setParams({ ...params, customNote: e.target.value })}
                  className="w-full bg-[#181818] border border-[#333] rounded px-2.5 py-1.5 text-white focus:border-[#d4af37] outline-none font-mono resize-none text-[11px]"
                  placeholder="Optional quote or rules notice..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Discord Preview & Code Tabs */}
        <div className="lg:col-span-7 space-y-4">
          {/* Navigation Bar */}
          <div className="flex items-center justify-between border-b border-[#222] pb-3">
            <div className="flex items-center gap-1 bg-[#141414] p-1 rounded-md border border-[#222]">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 text-xs rounded transition-all font-medium flex items-center gap-1.5 ${
                  activeTab === 'preview' ? 'bg-[#222] text-white' : 'text-white/50 hover:text-white'
                }`}
              >
                <Bot className="w-3.5 h-3.5 text-[#5865F2]" />
                Discord Embed Preview
              </button>
              <button
                onClick={() => setActiveTab('markdown')}
                className={`px-3 py-1.5 text-xs rounded transition-all font-medium flex items-center gap-1.5 ${
                  activeTab === 'markdown' ? 'bg-[#222] text-white' : 'text-white/50 hover:text-white'
                }`}
              >
                <Code className="w-3.5 h-3.5 text-[#d4af37]" />
                Raw Markdown Text
              </button>
              <button
                onClick={() => setActiveTab('setup_guide')}
                className={`px-3 py-1.5 text-xs rounded transition-all font-medium flex items-center gap-1.5 ${
                  activeTab === 'setup_guide' ? 'bg-[#222] text-white' : 'text-white/50 hover:text-white'
                }`}
              >
                <Server className="w-3.5 h-3.5 text-emerald-400" />
                Server Setup Checklist
              </button>
            </div>

            <button
              onClick={handleCopyMarkdown}
              className="px-3 py-1.5 bg-[#202020] hover:bg-[#282828] border border-[#333] text-white/90 text-xs rounded font-mono flex items-center gap-1.5 transition-all"
            >
              {copiedType === 'markdown' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/60" />}
              <span>{copiedType === 'markdown' ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>

          {/* TAB 1: Discord UI Simulator */}
          {activeTab === 'preview' && (
            <div className="bg-[#313338] border border-[#2b2d31] rounded-lg p-4 font-sans text-sm text-[#dbdee1] shadow-2xl space-y-4">
              {/* Bot Message Header */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center text-white font-bold shrink-0 shadow-md">
                  ⚔️
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm">Fate Grail War Bot</span>
                    <span className="bg-[#5865F2] text-[10px] text-white px-1.5 py-0.2 rounded font-mono uppercase font-bold">
                      BOT
                    </span>
                    <span className="text-[11px] text-[#949ba4]">Today at 8:00 PM</span>
                  </div>

                  <div className="text-xs text-[#b5bac1] mt-1 space-y-1">
                    <p>
                      <span className="bg-[#5865F2]/20 text-[#c9cdfb] px-1 rounded font-medium">@everyone</span>{' '}
                      <span className="bg-[#5865F2]/20 text-[#c9cdfb] px-1 rounded font-medium">@here</span>
                    </p>
                    <p className="text-xs text-white/80">
                      The Church Sanctuary has issued an official broadcast in <span className="text-[#00a8fc] hover:underline cursor-pointer">{params.channelName}</span>.
                    </p>
                  </div>

                  {/* Discord Embed Box */}
                  <div className="mt-3 bg-[#2b2d31] border-l-4 rounded-r-md p-3.5 space-y-3 max-w-xl" style={{ borderLeftColor: preview.color }}>
                    {/* Embed Author */}
                    <div className="text-[11px] font-semibold text-[#b5bac1] flex items-center gap-1.5">
                      <span>{preview.author}</span>
                    </div>

                    {/* Embed Title */}
                    <h3 className="text-sm font-bold text-white hover:underline cursor-pointer">
                      {preview.title}
                    </h3>

                    {/* Embed Description */}
                    <p className="text-xs text-[#dbdee1] whitespace-pre-line leading-relaxed">
                      {preview.description}
                    </p>

                    {/* Embed Fields */}
                    {preview.fields && preview.fields.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-[#35373c]">
                        {preview.fields.map((f, idx) => (
                          <div key={idx} className={f.inline ? '' : 'sm:col-span-2'}>
                            <h4 className="text-[11px] font-bold text-white/80 uppercase tracking-wider mb-0.5">
                              {f.name}
                            </h4>
                            <div className="text-xs text-[#dbdee1] whitespace-pre-line">
                              {f.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Embed Footer */}
                    <div className="text-[10px] text-[#949ba4] pt-2 border-t border-[#35373c] flex items-center justify-between">
                      <span>{preview.footer}</span>
                      <span>Fate Engine Gateway</span>
                    </div>
                  </div>

                  {/* Quick Action Button Mockups */}
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button className="px-3 py-1.5 bg-[#5865F2] hover:bg-[#4752c4] text-white text-xs rounded font-medium flex items-center gap-1.5 shadow-sm">
                      ✨ Begin Ritual (/summon)
                    </button>
                    <button className="px-3 py-1.5 bg-[#4e5058] hover:bg-[#6d6f78] text-white text-xs rounded font-medium flex items-center gap-1.5">
                      ⚔️ Enter War (/grailwar)
                    </button>
                    <button className="px-3 py-1.5 bg-[#4e5058] hover:bg-[#6d6f78] text-white text-xs rounded font-medium flex items-center gap-1.5">
                      🔑 Free AI Models (/apikey)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Raw Markdown View */}
          {activeTab === 'markdown' && (
            <div className="bg-[#121212] border border-[#222] rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-white/50 font-mono">
                <span>discord_announcement.md</span>
                <span>Ready for Copy & Paste into Discord</span>
              </div>
              <pre className="bg-[#0a0a0a] border border-[#1f1f1f] rounded p-3.5 text-xs text-emerald-400 font-mono whitespace-pre-wrap overflow-x-auto leading-relaxed max-h-[500px]">
                {selectedTemplate.generateMarkdown(params)}
              </pre>
            </div>
          )}

          {/* TAB 3: Server Setup Checklist */}
          {activeTab === 'setup_guide' && (
            <div className="bg-[#101010] border border-[#222] rounded-lg p-5 space-y-4 text-xs text-white/80">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded">
                  <Server className="w-4 h-4" />
                </span>
                <h3 className="font-bold text-sm text-white">Recommended Discord Server Channel Structure</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="bg-[#161616] p-3 rounded border border-[#262626] space-y-1.5">
                  <h4 className="font-mono text-[#d4af37] font-semibold flex items-center gap-1">
                    📢 #announcements
                  </h4>
                  <p className="text-white/60 text-[11px]">
                    Read-only channel for Server Release, Holy Grail War Season Declarations, and Patch Notes.
                  </p>
                </div>

                <div className="bg-[#161616] p-3 rounded border border-[#262626] space-y-1.5">
                  <h4 className="font-mono text-[#5865F2] font-semibold flex items-center gap-1">
                    ⚔️ #grail-war-fuyuki
                  </h4>
                  <p className="text-white/60 text-[11px]">
                    Active battleground for 7-Master war turns, ambush encounters, territory traps, and duels.
                  </p>
                </div>

                <div className="bg-[#161616] p-3 rounded border border-[#262626] space-y-1.5">
                  <h4 className="font-mono text-emerald-400 font-semibold flex items-center gap-1">
                    ✨ #summoning-circle
                  </h4>
                  <p className="text-white/60 text-[11px]">
                    Designated channel for <code className="text-white bg-black/40 px-1 rounded">/summon</code> and <code className="text-white bg-black/40 px-1 rounded">/cegacha</code> pulls.
                  </p>
                </div>

                <div className="bg-[#161616] p-3 rounded border border-[#262626] space-y-1.5">
                  <h4 className="font-mono text-purple-400 font-semibold flex items-center gap-1">
                    💬 #telepathic-sanctuary
                  </h4>
                  <p className="text-white/60 text-[11px]">
                    Dedicated channel for AI Servant conversations with <code className="text-white bg-black/40 px-1 rounded">/talk</code> and Bond progression.
                  </p>
                </div>
              </div>

              <div className="bg-[#141414] border-l-2 border-[#d4af37] p-3 text-[11px] text-white/70 space-y-1">
                <p className="font-semibold text-white">💡 Admin Tip: Automatic Slash Command Deployment</p>
                <p>
                  Deploy the slash command set with <code className="text-[#d4af37]">npm run deploy:commands</code> or run the bot index file to instantly sync all 22+ commands to your Discord guild!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
