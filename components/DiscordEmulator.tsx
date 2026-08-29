'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  MasterProfile,
  CardType,
  GachaResultItem,
  ActiveCombatant,
  CombatTurnLog,
  HolyGrailWarSession,
  DistrictId
} from '../lib/types';
import { executeGachaRoll } from '../lib/engine/gacha';
import { GACHA_BANNERS } from '../lib/data/craftEssences';
import {
  createCombatantFromMasterServant,
  initializeBattle,
  executeBattleTurn
} from '../lib/engine/battle';
import {
  renderServantProfileCard,
  renderDialogueCard,
  renderBattleTurnSummary,
  renderGachaSummonBanner
} from '../lib/canvas/browserCanvas';
import { executeWarAction, advanceWarRound } from '../lib/engine/grailwar';
import {
  Terminal,
  Sparkles,
  Swords,
  Shield,
  Send,
  Zap,
  RefreshCw,
  Trophy,
  Users,
  Compass,
  MessageSquare
} from 'lucide-react';

interface DiscordMessage {
  id: string;
  sender: 'user' | 'bot';
  timestamp: string;
  commandText?: string;
  embed?: {
    title: string;
    description: string;
    color: string;
    footer?: string;
  };
  canvasType?: 'servant' | 'dialogue' | 'battle' | 'gacha';
  canvasPayload?: any;
  components?: {
    type: 'buttons' | 'select';
    items: Array<{
      id: string;
      label: string;
      style: 'primary' | 'secondary' | 'danger' | 'success';
      disabled?: boolean;
      emoji?: string;
    }>;
  };
}

interface DiscordEmulatorProps {
  master: MasterProfile;
  onUpdateMaster: (updated: MasterProfile) => void;
  grailWar: HolyGrailWarSession;
  onUpdateGrailWar: (updated: HolyGrailWarSession) => void;
}

export default function DiscordEmulator({
  master,
  onUpdateMaster,
  grailWar,
  onUpdateGrailWar
}: DiscordEmulatorProps) {
  const [inputCommand, setInputCommand] = useState('');
  const [messages, setMessages] = useState<DiscordMessage[]>([
    {
      id: 'msg_welcome',
      sender: 'bot',
      timestamp: 'Today at 10:45 AM',
      embed: {
        title: '⚔️ Holy Grail War Discord Bot Engine (v14.0)',
        description:
          'Welcome, Master! The 7th Fuyuki Holy Grail War has begun. Interact using slash commands or quick action buttons below:\n\n' +
          '• `/summon [banner]` — Pull 5★ SSR Servants and Craft Essences\n' +
          '• `/servant` — View your Servant\'s status card, radar stats, and quotes\n' +
          '• `/duel [opponent]` — Engage in tactical Quick/Arts/Buster turn-based combat\n' +
          '• `/grailwar` — Access the 7-Master battle royale map & spend AP\n' +
          '• `/customise` — Allocate stat points, set custom dialogue quotes & equip CEs',
        color: '#f59e0b',
        footer: 'System Ready • Discord.js v14 • @napi-rs/canvas 2D Engine'
      },
      components: {
        type: 'buttons',
        items: [
          { id: 'quick_summon_10', label: 'Summon 10x (30 SQ)', style: 'success', emoji: '✨' },
          { id: 'quick_servant_card', label: 'My Servant Card', style: 'primary', emoji: '🛡️' },
          { id: 'quick_start_duel', label: 'Start Duel Arena', style: 'danger', emoji: '⚔️' },
          { id: 'quick_war_status', label: 'Grail War Status', style: 'secondary', emoji: '🏆' }
        ]
      }
    }
  ]);
  const [activeDuel, setActiveDuel] = useState<{
    battle: ReturnType<typeof initializeBattle>;
    lastLog?: CombatTurnLog;
  } | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const msgCounterRef = useRef<number>(100);

  const getNextId = (prefix: string) => {
    msgCounterRef.current += 1;
    return `${prefix}_${msgCounterRef.current}`;
  };

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (msg: DiscordMessage) => {
    setMessages(prev => [...prev, msg]);
  };

  const handleCommand = (cmd: string) => {
    const trimmed = cmd.trim().toLowerCase();
    const activeServant = master.servants.find(s => s.id === master.activeServantId) || master.servants[0];

    // User message
    addMessage({
      id: getNextId('usr'),
      sender: 'user',
      commandText: cmd,
      timestamp: 'Just now'
    });

    if (trimmed.startsWith('/summon')) {
      const banner = GACHA_BANNERS[0];
      try {
        const isTen = trimmed.includes('10') || trimmed.includes('multi');
        const count = isTen ? 10 : 1;
        const rollResult = executeGachaRoll({ banner, count, master });
        onUpdateMaster(rollResult.updatedMaster);

        addMessage({
          id: getNextId('bot_summon'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: `🌟 Summoning Results (${count}x Pull: ${banner.title})`,
            description:
              `Spent **${rollResult.spentQuartz} SQ** | Remaining: **${rollResult.updatedMaster.saintQuartz} SQ**\n` +
              `SSR Pity Counter: **${rollResult.newPityCount}/90**\n\n` +
              rollResult.results
                .map(
                  r =>
                    `${r.rarity === 5 ? '🌈' : r.rarity === 4 ? '✨' : '🔹'} **${r.item.name}** (${'★'.repeat(r.rarity)}) ${r.isNew ? '🆕' : ''}`
                )
                .join('\n'),
            color: rollResult.results.some(r => r.rarity === 5) ? '#f59e0b' : '#38bdf8',
            footer: 'Dynamic Canvas Image Attachment generated by @napi-rs/canvas'
          },
          canvasType: 'gacha',
          canvasPayload: { results: rollResult.results, bannerTitle: banner.title },
          components: {
            type: 'buttons',
            items: [
              { id: 'quick_summon_1', label: 'Summon 1x (3 SQ)', style: 'primary', emoji: '🗡️' },
              { id: 'quick_summon_10', label: 'Summon 10x (30 SQ)', style: 'success', emoji: '✨' }
            ]
          }
        });
      } catch (err: any) {
        addMessage({
          id: getNextId('bot_err'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '⚠️ Summoning Error',
            description: err.message,
            color: '#ef4444'
          }
        });
      }
    } else if (trimmed.startsWith('/servant')) {
      if (!activeServant) {
        addMessage({
          id: getNextId('bot_no_servant'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: 'No Contracted Servant',
            description: 'You must summon a Servant first using `/summon`!',
            color: '#ef4444'
          }
        });
        return;
      }

      addMessage({
        id: getNextId('bot_servant'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: `⚔️ Servant Profile: ${activeServant.nickname || activeServant.template.name}`,
          description:
            `*${activeServant.template.title}*\n\n` +
            `💬 **Master's Battle Quote:**\n` +
            `> *"${activeServant.customQuotes.battleStart || activeServant.template.battleStartQuote}"*\n\n` +
            `📜 **Noble Phantasm:** ${activeServant.template.noblePhantasm.name}\n` +
            `> *"${activeServant.customQuotes.noblePhantasm || activeServant.template.noblePhantasm.chant}"*\n\n` +
            `✨ **Available Stat Points:** ${activeServant.availableStatPoints} pts`,
          color: activeServant.template.rarity === 5 ? '#f59e0b' : '#38bdf8',
          footer: `Class: ${activeServant.template.servantClass} • Bond Level ${activeServant.bondLevel}`
        },
        canvasType: 'servant',
        canvasPayload: { servant: activeServant, masterName: master.username },
        components: {
          type: 'buttons',
          items: [
            { id: 'btn_hear_quote', label: 'Hear Dialogue Card', style: 'primary', emoji: '💬' },
            { id: 'quick_start_duel', label: 'Enter Battle', style: 'danger', emoji: '⚔️' }
          ]
        }
      });
    } else if (trimmed.startsWith('/duel')) {
      if (!activeServant) {
        addMessage({
          id: getNextId('bot_duel_err'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: { title: 'Combat Error', description: 'Summon a Servant before dueling!', color: '#ef4444' }
        });
        return;
      }

      const p1 = createCombatantFromMasterServant(activeServant, master.username);
      const rivalTemplate = master.servants[1] || master.servants[0];
      const p2 = createCombatantFromMasterServant(rivalTemplate, 'Shadow Berserker Rival');
      p2.id = 'rival_ai_duel';
      p2.name = 'Corrupted ' + rivalTemplate.template.name;
      p2.currentHp = Math.round(p2.maxHp * 0.9);

      const initialBattle = initializeBattle(p1, p2);
      setActiveDuel({ battle: initialBattle });

      addMessage({
        id: getNextId('bot_duel_init'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: `⚔️ HOLY GRAIL WAR DUEL — TURN 1`,
          description:
            `**${p1.name}** (Master: ${p1.masterName})\n` +
            `❤️ HP: **${p1.currentHp}/${p1.maxHp}** | ⚡ NP: **${Math.round(p1.npGauge)}%**\n\n` +
            `**VS**\n\n` +
            `**${p2.name}** (Master: ${p2.masterName})\n` +
            `❤️ HP: **${p2.currentHp}/${p2.maxHp}** | ⚡ NP: **${Math.round(p2.npGauge)}%**\n\n` +
            `*Select your 3-card Command sequence below:*`,
          color: '#ef4444',
          footer: 'Turn-Based RPG Combat Engine • Buster / Arts / Quick'
        },
        components: {
          type: 'buttons',
          items: [
            { id: 'duel_card_bbb', label: 'Buster Brave (ATK +50%)', style: 'danger', emoji: '🔴' },
            { id: 'duel_card_aaa', label: 'Arts Chain (NP +300%)', style: 'primary', emoji: '🔵' },
            { id: 'duel_card_qqq', label: 'Quick Chain (Stars +25)', style: 'success', emoji: '🟢' },
            { id: 'duel_use_np', label: `Noble Phantasm (${Math.round(p1.npGauge)}%)`, style: 'danger', emoji: '💥', disabled: p1.npGauge < 100 }
          ]
        }
      });
    } else if (trimmed.startsWith('/grailwar')) {
      const p = grailWar.participants[master.discordId] || Object.values(grailWar.participants)[0];
      const alive = Object.values(grailWar.participants).filter(x => x.isAlive).length;
      const district = grailWar.districts[p?.currentDistrict || 'homurahara_academy'];

      addMessage({
        id: getNextId('bot_war_status'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: `🏆 ${grailWar.title} — Round ${grailWar.currentRound}/${grailWar.maxRounds}`,
          description:
            `⚡ **Your Action Points:** ${p?.ap ?? 100}/100 AP\n` +
            `📍 **Current District:** ${district.name}\n` +
            `✨ **Leyline Effect:** \`${district.leylineBonus}\`\n` +
            `🩸 **Command Seals:** ${p?.commandSeals ?? 3}/3\n` +
            `👥 **Surviving Masters:** ${alive}/7 alive\n\n` +
            `**Active Participants:**\n` +
            Object.values(grailWar.participants)
              .map(
                m =>
                  `• ${m.isAlive ? '🟢' : '💀'} **${m.username}** (${m.servantName}) — *${grailWar.districts[m.currentDistrict].name}*`
              )
              .join('\n'),
          color: '#f59e0b',
          footer: '7-Master Battle Royale Tournament'
        },
        components: {
          type: 'buttons',
          items: [
            { id: 'war_scout', label: 'Scout District (20 AP)', style: 'primary', emoji: '🔭' },
            { id: 'war_fortify', label: 'Fortify Leyline (25 AP)', style: 'success', emoji: '🏰' },
            { id: 'war_rest', label: 'Rest & Heal (30 AP)', style: 'secondary', emoji: '🩹' },
            { id: 'war_advance_round', label: 'Advance War Round', style: 'danger', emoji: '⏩' }
          ]
        }
      });
    } else {
      // Default help response
      addMessage({
        id: getNextId('bot_help'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: '❓ Unknown Command',
          description:
            `Command \`${cmd}\` not recognized. Try one of the following:\n` +
            `• \`/summon\` — Gacha Summoning Portal\n` +
            `• \`/servant\` — View Servant Radar Card\n` +
            `• \`/duel\` — Initiate Turn-based Battle\n` +
            `• \`/grailwar\` — 7-Master Tournament Status`,
          color: '#64748b'
        }
      });
    }

    setInputCommand('');
  };

  // Button interaction handler
  const handleButtonClick = (btnId: string) => {
    if (btnId === 'quick_summon_10') {
      handleCommand('/summon 10');
    } else if (btnId === 'quick_summon_1') {
      handleCommand('/summon 1');
    } else if (btnId === 'quick_servant_card') {
      handleCommand('/servant');
    } else if (btnId === 'quick_start_duel') {
      handleCommand('/duel');
    } else if (btnId === 'quick_war_status') {
      handleCommand('/grailwar status');
    } else if (btnId === 'btn_hear_quote') {
      const activeServant = master.servants.find(s => s.id === master.activeServantId) || master.servants[0];
      if (activeServant) {
        addMessage({
          id: getNextId('bot_quote'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: `💬 ${activeServant.template.name}'s Dialogue`,
            description: `*"${activeServant.customQuotes.summon || activeServant.template.summonQuote}"*`,
            color: '#f59e0b',
            footer: 'Dynamic Visual Novel Dialogue Card attachment'
          },
          canvasType: 'dialogue',
          canvasPayload: {
            speaker: activeServant.template.name,
            quote: activeServant.customQuotes.summon || activeServant.template.summonQuote,
            title: activeServant.template.title,
            servantClass: activeServant.template.servantClass
          }
        });
      }
    } else if (btnId.startsWith('duel_')) {
      if (!activeDuel) {
        handleCommand('/duel');
        return;
      }

      let cards: CardType[] = ['Buster', 'Arts', 'Quick'];
      let useNp = false;

      if (btnId === 'duel_card_bbb') cards = ['Buster', 'Buster', 'Buster'];
      if (btnId === 'duel_card_aaa') cards = ['Arts', 'Arts', 'Arts'];
      if (btnId === 'duel_card_qqq') cards = ['Quick', 'Quick', 'Quick'];
      if (btnId === 'duel_use_np') useNp = true;

      const aiCards: CardType[] = ['Buster', 'Arts', 'Quick'];
      const aiNp = activeDuel.battle.player2.npGauge >= 100;

      const { updatedState, turnLogs } = executeBattleTurn(
        activeDuel.battle,
        { combatantId: activeDuel.battle.player1.id, selectedCards: cards, useNoblePhantasm: useNp },
        { combatantId: activeDuel.battle.player2.id, selectedCards: aiCards, useNoblePhantasm: aiNp }
      );

      const lastLog = turnLogs[turnLogs.length - 1];
      setActiveDuel({ battle: updatedState, lastLog });

      if (updatedState.turnPhase === 'victory' || updatedState.turnPhase === 'defeat') {
        const isWin = updatedState.turnPhase === 'victory';
        addMessage({
          id: getNextId('bot_duel_end'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: isWin ? '🏆 DUEL VICTORY!' : '☠️ DUEL DEFEAT',
            description: isWin
              ? `**${updatedState.player1.name}** won the battle!\n\n💬 *"A worthy clash. Walk with honor, Master."*\n\n💰 **Rewards:** +5 SQ, +500 EXP`
              : `**${updatedState.player2.name}** has defeated you in battle. Rest and recover!`,
            color: isWin ? '#22c55e' : '#ef4444',
            footer: 'Battle Finished'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'quick_start_duel', label: 'Rematch Duel', style: 'primary', emoji: '⚔️' },
              { id: 'quick_servant_card', label: 'View Servant', style: 'secondary', emoji: '🛡️' }
            ]
          }
        });
      } else {
        addMessage({
          id: getNextId('bot_duel_turn'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: `⚔️ TURN ${updatedState.currentTurn} CLASH SUMMARY`,
            description:
              `**Action:** ${lastLog.actionSummary}\n\n` +
              `**${updatedState.player1.name}**: ❤️ ${updatedState.player1.currentHp}/${updatedState.player1.maxHp} HP | ⚡ ${Math.round(updatedState.player1.npGauge)}% NP\n` +
              `**${updatedState.player2.name}**: ❤️ ${updatedState.player2.currentHp}/${updatedState.player2.maxHp} HP | ⚡ ${Math.round(updatedState.player2.npGauge)}% NP`,
            color: '#ef4444',
            footer: 'Next Turn Selection:'
          },
          canvasType: 'battle',
          canvasPayload: { log: lastLog, p1: updatedState.player1, p2: updatedState.player2 },
          components: {
            type: 'buttons',
            items: [
              { id: 'duel_card_bbb', label: 'Buster Brave', style: 'danger', emoji: '🔴' },
              { id: 'duel_card_aaa', label: 'Arts Chain', style: 'primary', emoji: '🔵' },
              { id: 'duel_card_qqq', label: 'Quick Chain', style: 'success', emoji: '🟢' },
              {
                id: 'duel_use_np',
                label: `Noble Phantasm (${Math.round(updatedState.player1.npGauge)}%)`,
                style: 'danger',
                emoji: '💥',
                disabled: updatedState.player1.npGauge < 100
              }
            ]
          }
        });
      }
    } else if (btnId.startsWith('war_')) {
      if (btnId === 'war_advance_round') {
        const nextWar = advanceWarRound(grailWar);
        onUpdateGrailWar(nextWar);
        addMessage({
          id: getNextId('bot_war_adv'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: `⏩ Holy Grail War: Round ${nextWar.currentRound} Commenced!`,
            description:
              `Action Points have been replenished (+60 AP)!\n` +
              `Recent Skirmishes:\n` +
              nextWar.eventLogs.slice(0, 3).map(e => `• ${e.text}`).join('\n'),
            color: '#a855f7'
          }
        });
        return;
      }

      let action: 'scout' | 'fortify_leyline' | 'rest_and_heal' = 'scout';
      if (btnId === 'war_fortify') action = 'fortify_leyline';
      if (btnId === 'war_rest') action = 'rest_and_heal';

      const result = executeWarAction(grailWar, master.discordId, action);
      onUpdateGrailWar(result.updatedWar);

      addMessage({
        id: getNextId('bot_war_act'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: result.success ? '✅ Grail War Action Succeeded' : '⚠️ Action Interrupted',
          description:
            `${result.message}\n\n` +
            `⚡ **Remaining AP:** ${result.updatedWar.participants[master.discordId]?.ap ?? 0} AP`,
          color: result.success ? '#22c55e' : '#ef4444'
        }
      });
    }
  };

  return (
    <div id="discord_emulator_container" className="flex flex-col h-full bg-[#0a0a0a] text-[#dbdee1] rounded-xl overflow-hidden border border-[#1a1a1a] shadow-2xl">
      {/* Discord Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#111] border-b border-[#1a1a1a]">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-sm bg-[#161616] text-[#d4af37] border border-[#d4af37]/30 font-mono font-bold text-xs">
            #
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif italic text-white text-base">holy-grail-war</span>
              <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-[#161616] text-[#d4af37] border border-[#d4af37]/30 rounded-sm">BOT</span>
            </div>
            <p className="text-[11px] font-mono text-white/40">discord.js v14 Slash Command Simulator & @napi-rs/canvas Compositor</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 text-[11px] font-mono font-medium rounded-sm bg-[#161616] text-[#d4af37] border border-[#d4af37]/30">
            💎 {master.saintQuartz} SQ
          </div>
          <div className="px-2.5 py-1 text-[11px] font-mono font-medium rounded-sm bg-[#161616] text-[#3b82f6] border border-[#3b82f6]/30">
            ⚡ {master.actionPoints} AP
          </div>
        </div>
      </div>

      {/* Discord Chat Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-sm bg-[#0a0a0a]">
        {messages.map(msg => (
          <div key={msg.id} className="flex gap-3 items-start group hover:bg-[#111] -mx-2 px-2 py-2 rounded-lg transition-colors">
            {/* Avatar */}
            <div className="w-9 h-9 rounded-sm flex-shrink-0 flex items-center justify-center overflow-hidden bg-[#161616] text-white font-bold border border-[#1a1a1a]">
              {msg.sender === 'bot' ? (
                <div className="w-full h-full bg-[#161616] text-[#d4af37] flex items-center justify-center font-serif text-sm">
                  ⚔️
                </div>
              ) : (
                <div className="w-full h-full bg-[#111] text-white flex items-center justify-center font-mono text-xs">
                  M
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-serif italic text-white text-sm">
                  {msg.sender === 'bot' ? 'Holy Grail War Bot' : master.username}
                </span>
                {msg.sender === 'bot' && (
                  <span className="bg-[#161616] text-[#d4af37] border border-[#d4af37]/30 text-[8px] font-mono font-bold px-1 rounded-sm">BOT</span>
                )}
                <span className="text-[10px] font-mono text-white/40">{msg.timestamp}</span>
              </div>

              {msg.commandText && (
                <div className="text-[#d4af37] font-mono text-xs mt-1 bg-[#111] border border-[#1a1a1a] px-2.5 py-1 rounded-sm inline-block">
                  {msg.commandText}
                </div>
              )}

              {/* Discord Embed */}
              {msg.embed && (
                <div
                  className="mt-2.5 p-4 rounded-sm bg-[#111] border-l-2 text-[#dbdee1] max-w-2xl border border-y-[#1a1a1a] border-r-[#1a1a1a]"
                  style={{ borderLeftColor: msg.embed.color || '#d4af37' }}
                >
                  <h4 className="font-serif italic text-white text-base mb-1.5">{msg.embed.title}</h4>
                  <div className="whitespace-pre-wrap text-xs text-white/80 leading-relaxed font-mono">
                    {msg.embed.description}
                  </div>
                  {msg.embed.footer && (
                    <div className="text-[10px] font-mono text-white/40 mt-2.5 pt-2 border-t border-[#1a1a1a]">
                      {msg.embed.footer}
                    </div>
                  )}
                </div>
              )}

              {/* Dynamic Canvas Image Output */}
              {msg.canvasType && (
                <div className="mt-3 rounded-lg overflow-hidden border border-[#1a1a1a] bg-[#050505] inline-block shadow-lg">
                  <CanvasRenderer canvasType={msg.canvasType} payload={msg.canvasPayload} />
                </div>
              )}

              {/* Discord Interactive Buttons */}
              {msg.components && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {msg.components.items.map(btn => {
                    let bg = 'bg-[#161616] hover:bg-[#222] text-white/80 border border-[#222]';
                    if (btn.style === 'primary') bg = 'bg-[#111] hover:bg-[#161616] text-[#d4af37] border border-[#d4af37]/40';
                    if (btn.style === 'success') bg = 'bg-[#111] hover:bg-[#161616] text-[#22c55e] border border-[#22c55e]/40';
                    if (btn.style === 'danger') bg = 'bg-[#220000] hover:bg-[#330000] text-[#ef4444] border border-[#ef4444]/40';

                    return (
                      <button
                        key={btn.id}
                        disabled={btn.disabled}
                        onClick={() => handleButtonClick(btn.id)}
                        className={`px-3 py-1.5 rounded-sm text-xs font-mono uppercase tracking-wider font-semibold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${bg}`}
                      >
                        {btn.emoji && <span>{btn.emoji}</span>}
                        <span>{btn.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={chatBottomRef} />
      </div>

      {/* Discord Input Bar */}
      <div className="p-3 bg-[#111] border-t border-[#1a1a1a]">
        <div className="flex items-center gap-2 bg-[#0a0a0a] rounded-sm px-3 py-2 border border-[#1a1a1a] focus-within:border-[#d4af37]">
          <div className="text-white/40 font-mono text-xs">/</div>
          <input
            type="text"
            value={inputCommand}
            onChange={e => setInputCommand(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && inputCommand.trim()) {
                handleCommand(inputCommand);
              }
            }}
            placeholder="Type a command: /summon, /servant, /duel, /grailwar, /customise..."
            className="flex-1 bg-transparent text-white font-mono text-xs outline-none placeholder-white/30"
          />
          <button
            onClick={() => {
              if (inputCommand.trim()) handleCommand(inputCommand);
            }}
            disabled={!inputCommand.trim()}
            className="p-1.5 rounded-sm bg-[#d4af37] hover:bg-[#c49f27] text-black disabled:opacity-30 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Command Quick Suggestions */}
        <div className="flex items-center gap-2 mt-2 px-1 text-[10px] font-mono text-white/40 overflow-x-auto">
          <span>Quick:</span>
          <button
            onClick={() => handleCommand('/summon 10')}
            className="hover:text-[#d4af37] hover:underline whitespace-nowrap"
          >
            /summon 10
          </button>
          <span>•</span>
          <button
            onClick={() => handleCommand('/servant')}
            className="hover:text-[#d4af37] hover:underline whitespace-nowrap"
          >
            /servant
          </button>
          <span>•</span>
          <button
            onClick={() => handleCommand('/duel')}
            className="hover:text-[#d4af37] hover:underline whitespace-nowrap"
          >
            /duel
          </button>
          <span>•</span>
          <button
            onClick={() => handleCommand('/grailwar status')}
            className="hover:text-[#d4af37] hover:underline whitespace-nowrap"
          >
            /grailwar status
          </button>
        </div>
      </div>
    </div>
  );
}

// Inline Canvas Renderer Component for Discord attachments
function CanvasRenderer({ canvasType, payload }: { canvasType: string; payload: any }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !payload) return;
    const canvas = canvasRef.current;

    if (canvasType === 'servant') {
      renderServantProfileCard(canvas, payload.servant, payload.masterName);
    } else if (canvasType === 'dialogue') {
      renderDialogueCard(canvas, payload.speaker, payload.quote, payload.title, payload.servantClass);
    } else if (canvasType === 'battle') {
      renderBattleTurnSummary(canvas, payload.log, payload.p1, payload.p2);
    } else if (canvasType === 'gacha') {
      renderGachaSummonBanner(canvas, payload.results, payload.bannerTitle);
    }
  }, [canvasType, payload]);

  return <canvas ref={canvasRef} className="max-w-full h-auto rounded block" />;
}
