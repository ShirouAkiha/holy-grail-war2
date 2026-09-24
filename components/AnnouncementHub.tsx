'use client';

import React, { useState } from 'react';
import {
  Megaphone,
  Copy,
  Check,
  Sparkles,
  Swords,
  Scroll,
  Send,
  Radio,
  FileText,
  CheckCircle2,
  Share2,
  Flame,
  Shield,
  Clock,
  Gift,
  HelpCircle,
  BookOpen
} from 'lucide-react';

interface AnnouncementTemplate {
  id: string;
  name: string;
  tagline: string;
  badge: string;
  icon: typeof Sparkles;
  embedColor: string;
  generateText: (config: AnnouncementConfig) => string;
}

interface AnnouncementConfig {
  serverName: string;
  botName: string;
  pingRole: string;
  launchBonusSq: number;
  tournamentDate: string;
  botInviteUrl: string;
  channelName: string;
}

export default function AnnouncementHub() {
  const [config, setConfig] = useState<AnnouncementConfig>({
    serverName: 'Our Discord Community',
    botName: 'Holy Grail War RPG',
    pingRole: '@everyone',
    launchBonusSq: 30,
    tournamentDate: 'This Weekend (Saturday 8:00 PM EST)',
    botInviteUrl: 'https://discord.com/oauth2/authorize?...',
    channelName: '#grail-announcements'
  });

  const [activeTemplateId, setActiveTemplateId] = useState<string>('epic_lore');
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedCommands, setCopiedCommands] = useState<boolean>(false);

  const templates: AnnouncementTemplate[] = [
    {
      id: 'server_bio',
      name: 'Server Bio & Bot Listing (Reference Style)',
      tagline: 'Matches the exact structured bullet & scenario layout from your reference image',
      badge: 'Exact Match',
      icon: BookOpen,
      embedColor: '#10b981',
      generateText: (c) => `**A dark urban fantasy RPG with authentic ritual summoning & tactical turn-based combat | Fate Concept**

*"Let thy silver and iron be the essence... will you claim the wish-granting chalice, or become fuel for the ritual?"*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**⚔️ ${c.botName.toUpperCase()} • CHRONICLES OF FUYUKI ⚔️**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• **25+ Distinct Heroic Spirits & Custom Admin Servants**
• **3 Fuyuki Sectors | Miyama Residential, Shinto Commercial & Bay, Ryuudou Leylines**
• **9 Playable Servant Classes | Saber, Archer, Lancer, Rider, Caster, Assassin, Berserker, Ruler, Avenger**
• **A World of 3 Founding Families & The Holy Church**
• **Buster / Arts / Quick Turn-Based Command Card System** (Critical Stars, NP Gauge & Class Advantage)
• **20+ Collectible Craft Essences** with stat multipliers & defensive traits
• **The 7-Master Holy Grail War Battle Royale Tournament**
• **Deep Lore, Visual Novel Bond Events & Servant Dialogue**
• **9 Starting Scenarios / Rites:**
  1. The Bloodline Awakening in the Tohsaka basement ritual circle
  2. Late night at Fuyuki Port when a crimson spear pierces the darkness
  3. You were denied an artifact catalyst and must perform an Emergency Summon
  4. The Fuyuki Church Overseer hands you 3 Command Seals with an ominous smile
  5. Confrontation at Ryuudou Temple steps under the blood moon
  6. Ambushed in Miyama town by a rogue Berserker
  7. 7-Master Tournament Finals: Standing across the burnt ground of the Greater Grail
  8. Servant Bond Event 5: A quiet conversation under the starry Fuyuki sky
  9. Bad Ending #4: Disobeyed the Command Seal (Noble Phantasm backlash)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Type **\`/daily\`** then **\`/summon\`** to carve your circle and claim **+${c.launchBonusSq} Saint Quartz**!
Official Server: **${c.serverName}**`
    },
    {
      id: 'epic_lore',
      name: 'Grand Holy Grail War Summoning Call',
      tagline: 'High-atmosphere, cinematic Fate lore prologue for maximum hype',
      badge: 'Lore & Cinematic',
      icon: Flame,
      embedColor: '#d4af37',
      generateText: (c) => `${c.pingRole !== 'none' ? `${c.pingRole}\n\n` : ''}# 🩸 THE HEAVEN'S FEEL COMMENCES: HOLY GRAIL WAR RPG IS LIVE! 🩸
>>> *"Let thy silver and iron be the essence. Let thy vow and thy stone be the foundation. Answer unto my summon, O Heroic Spirit!"*

Attention, prospective Masters of **${c.serverName}**!
The Fuyuki Leylines have converged, the Greater Grail has awakened, and Command Seals are manifesting on the hands of the chosen. 

Our official custom Discord RPG bot, **${c.botName}**, is officially open for summoners! Will you claim the omnipotent wish-granting chalice, or become fuel for the ritual?

---

### ⚔️ WHAT AWAITS YOU IN FUYUKI:
* 🌟 **Ritual Summoning:** Call forth Saber, Archer, Lancer, Rider, Caster, Assassin, Berserker, Ruler, and Avenger spirits with authentic visual noble phantasm cards.
* 🎴 **Buster / Arts / Quick Turn-Based Duels:** Engage in authentic tactical command card duels against your fellow Masters with critical stars, NP gain, and class affinities.
* 🏆 **7-Master Holy Grail War Battle Royale:** Enter tournament brackets where Masters hunt one another across Shinto & Miyama until one standing Master touches the Grail.
* 💬 **Servant Dialogue & Bond Sanctum:** Deepen your pact through interactions, feeding mana, and unlocking custom Visual Novel bond events.
* 🛡️ **Craft Essences & Tactical Ambush:** Equip legendary CE relics, plant boundary field traps, patrol territorial sectors, or seek sanctuary at the Fuyuki Church.

---

### 🎁 LAUNCH CELEBRATION REWARDS:
All Masters who initiate their contract this week will receive:
* 💎 **${c.launchBonusSq} Bonus Saint Quartz** on first contract
* 🔴 **Full 3/3 Command Seals** ready for emergency Noble Phantasm release
* 📜 **First Tournament Entry:** ${c.tournamentDate}

### 🚀 HOW TO JOIN RIGHT NOW:
1. Head over to the summoning channel!
2. Type **\`/daily\`** to collect your daily Saint Quartz & Mana supply.
3. Type **\`/summon\`** to carve your summoning circle and bind your Servant!
4. Challenge your rivals with **\`/duel\`** or prepare for the **\`/grailwar\`**!

*Let the bloodline ritual begin. May the Grail look favorably upon your cause.*`
    },
    {
      id: 'feature_packed',
      name: 'Feature Highlights & Player Guide',
      tagline: 'Clean, organized breakdown of commands, gameplay loops, and mechanics',
      badge: 'Informative & Clean',
      icon: Swords,
      embedColor: '#3b82f6',
      generateText: (c) => `${c.pingRole !== 'none' ? `${c.pingRole}\n\n` : ''}# ⚔️ NEW RPG BOT RELEASE: HOLY GRAIL WAR DISCORD RPG
We are excited to announce that our new interactive anime RPG bot **${c.botName}** has officially launched on **${c.serverName}**! 

Dive into an authentic turn-based RPG inspired by the Fate universe—featuring rich visual canvas cards, strategic combat, and competitive tournaments.

---

### 📋 COMMAND QUICK-START CHEATSHEET:
| Command | Description |
| :--- | :--- |
| \`/summon\` | Perform the summoning ritual to draw your Contract Servant |
| \`/daily\` | Claim daily Saint Quartz (SQ) & resource bonuses |
| \`/servant\` | Inspect your active Servant card, Noble Phantasm & stats |
| \`/duel @user\` | Challenge a server member to an authentic 1v1 Command Card duel |
| \`/grailwar\` | Join or launch a 7-Master Fuyuki Battle Royale tournament |
| \`/talk\` | Chat with your summoned Servant & build Bond XP |
| \`/church\` | Visit the Church Sanctuary for overseer blessings & truce |
| \`/cegacha\` | Pull tactical Craft Essences to equip for stat multipliers |
| \`/customise\` | Personalize your Servant's nickname, battle cries & NP chant |

---

### 💎 LAUNCH EVENT & FREE ROLLS:
To celebrate release day, every player who logs in can claim **+${c.launchBonusSq} Saint Quartz**!
* First Grail War Tournament will be hosted on **${c.tournamentDate}** with special Discord Roles for the Victor!

Head to our RPG bot channel and type \`/daily\` followed by \`/summon\` to get started!`
    },
    {
      id: 'church_overseer',
      name: 'Fuyuki Church Overseer Notice (Kotomine Style)',
      tagline: 'In-character, atmospheric proclamation from the Holy Church Overseer',
      badge: 'Roleplay / Kotomine',
      icon: Scroll,
      embedColor: '#ef4444',
      generateText: (c) => `${c.pingRole !== 'none' ? `${c.pingRole}\n\n` : ''}# ⛪ [THE HOLY CHURCH] NOTICE REGARDING THE COMMENCEMENT OF RITUAL
>>> *"Rejoice, young magus. For your wish shall surely come true."*

To all registered Magi and anomalous entities within **${c.serverName}**:

The Holy Church has officially confirmed the manifestation of the Heaven's Feel ritual in this sector. As the appointed Overseer, I am obligated to remind all participants of the following edicts:

1. **The Concealment of Mystery:**
All engagements must be conducted through designated bot channels. Civilians shall remain ignorant of your magical clashes.

2. **The Command Seals:**
Every participant is granted three Command Seals. Use them wisely, for when they are extinguished, your Servant's loyalty is no longer guaranteed.

3. **Church Neutrality & Sanctuary:**
Should you suffer defeat or wish to negotiate safe terms, the command **\`/church\`** will grant you asylum under my watchful eye. No bloodshed is permitted within my sanctuary.

4. **Commencement Rite:**
Initiate your contract immediately using **\`/summon\`**. Claim your starting provisioning of **${c.launchBonusSq} Saint Quartz** with **\`/daily\`**.

May the best Master attain what they seek. And remember... the Grail always extracts its price.

— *Father K., Church Overseer*`
    },
    {
      id: 'quick_hype',
      name: 'High-Impact Quick Ping & Event Alert',
      tagline: 'Short, mobile-friendly message designed for high click-through & fast engagement',
      badge: 'Fast & Punchy',
      icon: Sparkles,
      embedColor: '#a855f7',
      generateText: (c) => `${c.pingRole !== 'none' ? `${c.pingRole}\n\n` : ''}🎉 **THE HOLY GRAIL WAR RPG BOT IS FINALLY HERE!** 🎉

Summon your Heroic Spirit, equip legendary Craft Essences, and clash in turn-based Buster/Arts/Quick battles right inside **${c.serverName}**!

🔥 **Launch Starter Gift:** Everyone gets **${c.launchBonusSq} FREE SQ** today!

⚡ **Step 1:** Run \`/daily\` to claim your starter Quartz
⚡ **Step 2:** Run \`/summon\` to draw your Servant (Saber, Archer, Lancer, Berserker & more)
⚡ **Step 3:** Run \`/duel @friend\` to test your Noble Phantasm!

🏆 **Tournament Alert:** Our 7-Master Grail War kicks off **${c.tournamentDate}**! Who will claim the Grail?`
    }
  ];

  const currentTemplate = templates.find((t) => t.id === activeTemplateId) || templates[0];
  const generatedMarkdown = currentTemplate.generateText(config);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleCopyCommandsOnly = () => {
    const commandList = `**Holy Grail War Bot Slash Commands:**
• \`/summon\` - Perform ritual summon from the Throne of Heroes
• \`/daily\` - Collect daily Saint Quartz & mana supplies
• \`/servant\` - View your active Servant card, class affinity & NP
• \`/servants\` - View all servants currently in your archive
• \`/duel <@user>\` - Turn-based Buster/Arts/Quick battle vs a player
• \`/grailwar\` - Enter the 7-Master Battle Royale tournament
• \`/talk\` - Talk with your Servant & deepen Bond
• \`/feed\` - Offer mana food to restore fatigue and boost stats
• \`/customise\` - Set Servant nickname, battle cry & NP chant
• \`/church\` - Visit the Fuyuki Church for sanctuary & news
• \`/cegacha\` - Craft Essence gacha for combat stat multipliers
• \`/equip\` - Equip Craft Essences to your Heroic Spirit
• \`/profile\` - View Command Seals, wins, and Master status`;
    navigator.clipboard.writeText(commandList);
    setCopiedCommands(true);
    setTimeout(() => setCopiedCommands(false), 2200);
  };

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="bg-[#0f0f0f] border border-[#1e1e1e] p-5 sm:p-6 rounded-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#d4af37]/5 blur-3xl rounded-full pointer-events-none -mr-20 -mt-20"></div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-sm bg-[#161616] border border-[#d4af37]/40 text-[#d4af37]">
                <Megaphone className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-serif italic text-white tracking-wide flex items-center gap-2">
                  Server Release Announcement Composer
                  <span className="text-[10px] not-italic font-sans font-semibold px-2 py-0.5 rounded-sm bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40 uppercase tracking-wider">
                    Discord Ready
                  </span>
                </h2>
                <p className="text-xs text-white/50 font-sans">
                  Craft atmospheric, high-conversion server launch announcements with live Discord formatting and 1-click copy.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={handleCopyCommandsOnly}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-sm bg-[#161616] hover:bg-[#202020] border border-[#2a2a2a] text-xs font-mono text-white/80 flex items-center justify-center gap-2 transition-colors"
            >
              {copiedCommands ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Commands Copied!</span>
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>Copy Command List</span>
                </>
              )}
            </button>
            <button
              onClick={handleCopy}
              className="flex-1 sm:flex-none px-4 py-2 rounded-sm bg-[#d4af37] hover:bg-[#e5c158] text-black font-semibold text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(212,175,55,0.25)] active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Announcement</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Controls & Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Configuration & Style Selection (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Template Style Selector */}
          <div className="bg-[#0c0c0c] border border-[#1a1a1a] p-4 sm:p-5 rounded-sm space-y-3">
            <label className="text-xs font-mono uppercase tracking-wider text-[#d4af37] flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> Select Announcement Flavor
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              {templates.map((tmpl) => {
                const Icon = tmpl.icon;
                const isSelected = activeTemplateId === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    onClick={() => setActiveTemplateId(tmpl.id)}
                    className={`text-left p-3 rounded-sm border transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'bg-[#161616] border-[#d4af37] shadow-[0_0_10px_rgba(212,175,55,0.12)]'
                        : 'bg-[#0f0f0f] border-[#1e1e1e] hover:border-[#2a2a2a] hover:bg-[#121212]'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-sm mt-0.5 ${
                        isSelected ? 'bg-[#d4af37]/20 text-[#d4af37]' : 'bg-[#181818] text-white/40'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-medium ${isSelected ? 'text-white font-semibold' : 'text-white/80'}`}>
                          {tmpl.name}
                        </span>
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm uppercase tracking-wider ${
                            isSelected
                              ? 'bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30'
                              : 'bg-[#161616] text-white/40'
                          }`}
                        >
                          {tmpl.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/40 mt-1 line-clamp-2 leading-relaxed">
                        {tmpl.tagline}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Customization Parameters */}
          <div className="bg-[#0c0c0c] border border-[#1a1a1a] p-4 sm:p-5 rounded-sm space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#d4af37] flex items-center gap-2">
              <Scroll className="w-3.5 h-3.5" /> Customize Details
            </h3>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-mono text-white/60 mb-1">
                  Server Name
                </label>
                <input
                  type="text"
                  value={config.serverName}
                  onChange={(e) => setConfig({ ...config, serverName: e.target.value })}
                  placeholder="e.g. Fuyuki Sanctuary / Anime Haven"
                  className="w-full bg-[#121212] border border-[#222] focus:border-[#d4af37] rounded-sm px-3 py-2 text-white font-sans text-xs outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-white/60 mb-1">
                  Bot Name / Mention
                </label>
                <input
                  type="text"
                  value={config.botName}
                  onChange={(e) => setConfig({ ...config, botName: e.target.value })}
                  placeholder="e.g. Holy Grail War Bot"
                  className="w-full bg-[#121212] border border-[#222] focus:border-[#d4af37] rounded-sm px-3 py-2 text-white font-sans text-xs outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-white/60 mb-1">
                    Announcement Ping
                  </label>
                  <select
                    value={config.pingRole}
                    onChange={(e) => setConfig({ ...config, pingRole: e.target.value })}
                    className="w-full bg-[#121212] border border-[#222] focus:border-[#d4af37] rounded-sm px-3 py-2 text-white font-mono text-xs outline-none transition-colors"
                  >
                    <option value="@everyone">@everyone</option>
                    <option value="@here">@here</option>
                    <option value="<@&Master>">@Master Role</option>
                    <option value="none">No Ping</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-white/60 mb-1">
                    Free Launch SQ
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={config.launchBonusSq}
                    onChange={(e) =>
                      setConfig({ ...config, launchBonusSq: parseInt(e.target.value) || 0 })
                    }
                    className="w-full bg-[#121212] border border-[#222] focus:border-[#d4af37] rounded-sm px-3 py-2 text-white font-mono text-xs outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-white/60 mb-1">
                  First Grail War Tournament Date
                </label>
                <input
                  type="text"
                  value={config.tournamentDate}
                  onChange={(e) => setConfig({ ...config, tournamentDate: e.target.value })}
                  placeholder="e.g. This Saturday @ 8 PM EST"
                  className="w-full bg-[#121212] border border-[#222] focus:border-[#d4af37] rounded-sm px-3 py-2 text-white font-sans text-xs outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Quick Discord Server Setup Tips */}
          <div className="bg-[#0f0f0f] border border-[#1a1a1a] p-4 rounded-sm space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-wider text-white/70 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Recommended Channel Setup
            </h4>
            <ul className="text-[11px] space-y-1.5 text-white/50 font-sans">
              <li className="flex items-center gap-2">
                <span className="text-[#d4af37] font-mono font-bold">#announcements</span>
                <span>— Post this message with @everyone or @here</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#d4af37] font-mono font-bold">#summoning-circle</span>
                <span>— Dedicated channel for /summon and /daily pulls</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#d4af37] font-mono font-bold">#grail-war-arena</span>
                <span>— Fast-paced duel & tournament battle feed</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#d4af37] font-mono font-bold">#church-sanctuary</span>
                <span>— Roleplay, Servant conversation, and bond events</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right Column: Live Discord Simulator Preview (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono text-white/60">
              <span className="w-2.5 h-2.5 rounded-full bg-[#5865F2]"></span>
              <span>Discord Preview (How it will render in your server)</span>
            </div>
            <span className="text-[11px] font-mono text-white/40">Markdown & Embed format</span>
          </div>

          {/* Discord Message Mockup Box */}
          <div className="flex-1 bg-[#313338] text-[#dbdee1] rounded-md p-4 sm:p-5 border border-[#232428] font-sans text-sm shadow-xl overflow-y-auto max-h-[720px] select-text">
            {/* Header Author Info */}
            <div className="flex items-start gap-3.5 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0">
                🗡️
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-[15px] hover:underline cursor-pointer">
                    {config.botName || 'Holy Grail War Bot'}
                  </span>
                  <span className="bg-[#5865F2] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm tracking-wider uppercase">
                    APP
                  </span>
                  <span className="text-[#949ba4] text-xs">Today at 12:00 PM</span>
                </div>

                {/* Render Ping if any */}
                {config.pingRole !== 'none' && (
                  <div className="mt-1 text-sm font-semibold text-[#c9cdfb] bg-[#5865f2]/10 border-l-2 border-[#5865f2] px-2 py-0.5 rounded-sm inline-block">
                    {config.pingRole}
                  </div>
                )}
              </div>
            </div>

            {/* Embed Card Container */}
            <div className="ml-0 sm:ml-12 border-l-4 rounded-r-md bg-[#2b2d31] p-4 text-[#dbdee1] space-y-3.5" style={{ borderColor: currentTemplate.embedColor }}>
              <div className="whitespace-pre-line text-xs sm:text-[13px] leading-relaxed font-sans text-gray-200">
                {generatedMarkdown.replace(`${config.pingRole}\n\n`, '')}
              </div>

              {/* Bot Interaction Action Footer */}
              <div className="pt-2 border-t border-[#3f4147] flex flex-wrap items-center justify-between text-[11px] text-[#949ba4] gap-2 font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>Slash Commands Ready • /summon • /duel • /grailwar</span>
                </div>
                <span>Fuyuki City Protocol</span>
              </div>
            </div>

            {/* Quick Action Bar under Discord Message */}
            <div className="ml-0 sm:ml-12 mt-4 pt-3 border-t border-[#3f4147]/60 flex items-center justify-between gap-3">
              <span className="text-xs text-[#949ba4]">
                Ready to copy and paste directly into your server&apos;s announcement channel!
              </span>
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Raw Text'}</span>
              </button>
            </div>
          </div>

          {/* Raw Markdown Accordion */}
          <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-sm p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-white/50 uppercase tracking-wider">
                Raw Markdown Output (Copyable)
              </span>
              <button
                onClick={handleCopy}
                className="text-xs font-mono text-[#d4af37] hover:underline flex items-center gap-1"
              >
                <Copy className="w-3 h-3" /> Copy Full Text
              </button>
            </div>
            <textarea
              readOnly
              value={generatedMarkdown}
              rows={6}
              className="w-full bg-[#050505] border border-[#181818] p-3 text-[11px] font-mono text-white/70 rounded-sm outline-none resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
