'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  MasterProfile,
  CardType,
  ActiveCombatant,
  CombatTurnLog,
  HolyGrailWarSession,
  DistrictId,
  ServantTemplate,
  MasterServantInstance,
  ServantClass
} from '../lib/types';
import { SERVANT_DATABASE } from '../lib/data/servants';
import {
  createCombatantFromMasterServant,
  initializeBattle,
  executeBattleTurn
} from '../lib/engine/battle';
import {
  renderServantProfileCard,
  renderDialogueCard,
  renderBattleTurnSummary
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
  MessageSquare,
  Flame,
  PlusCircle,
  Trash2
} from 'lucide-react';

function createContractFromPool(allThrone: ServantTemplate[], masterId: string): MasterServantInstance {
  const randomTemplate = allThrone[Math.floor(Math.random() * allThrone.length)];
  return {
    id: `contract_${randomTemplate.id}_${Date.now()}`,
    masterId,
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
}

function buildCustomTemplate(
  customName: string,
  customClass: ServantClass,
  customImg: string,
  customNp: string,
  customTitle: string
): ServantTemplate {
  const newId = `custom_${customName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`;
  return {
    id: newId,
    name: customName,
    title: customTitle,
    servantClass: customClass,
    rarity: 5,
    baseHp: 15200,
    baseAtk: 11800,
    baseStats: { strength: 18, endurance: 17, agility: 16, mana: 19, luck: 15 },
    commandDeck: ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'],
    skills: [
      { id: `${newId}_s1`, name: 'Tactical Insight', cooldown: 5, description: 'ATK +35% for 3 turns', effectType: 'buff_atk', value: 35, duration: 3, icon: '⚔️' },
      { id: `${newId}_s2`, name: 'Heroic Resolve', cooldown: 6, description: 'NP +30% & Heal 2500 HP', effectType: 'np_charge', value: 30, duration: 1, icon: '✨' },
      { id: `${newId}_s3`, name: 'Throne Authority', cooldown: 5, description: '+20 Crit Stars', effectType: 'crit_stars', value: 20, duration: 3, icon: '🌟' }
    ],
    noblePhantasm: {
      name: customNp,
      cardType: 'Buster',
      chant: `Awaken, boundless power of ${customName}!`,
      description: 'Deals 500% damage to the enemy target.',
      target: 'single',
      multiplier: 500,
      overchargeEffect: 'Attack +20% for 3 turns'
    },
    lore: `A custom Heroic Spirit registered by server administrators into the Throne of Heroes.`,
    summonQuote: `Servant ${customClass}, ${customName}. I have responded to your summons, Master!`,
    battleStartQuote: 'Let us engrave our triumph upon this Holy Grail War!',
    victoryQuote: 'The contract holds true. Victory is ours!',
    defeatQuote: 'Forgive me, Master... I have fallen...',
    avatarUrl: customImg,
    cardArtUrl: customImg,
    isCustomOrMeme: true
  };
}

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
    imageUrl?: string;
    thumbnailUrl?: string;
  };
  canvasType?: 'servant' | 'dialogue' | 'battle';
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
  customServants: ServantTemplate[];
  onUpdateCustomServants: (updated: ServantTemplate[]) => void;
}

export default function DiscordEmulator({
  master,
  onUpdateMaster,
  grailWar,
  onUpdateGrailWar,
  customServants,
  onUpdateCustomServants
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
          'Welcome, Master! The Fuyuki Holy Grail War has commenced.\n' +
          'Unlike gacha games, each Master holds **3 Command Seals** and is bound to a single Heroic Spirit summoned from the Throne of Heroes.\n\n' +
          '**Available Commands:**\n' +
          '• `/summon [ritual | status | release]` — Perform the summoning ritual to contract an available Servant\n' +
          '• `/addservant [create | list | delete]` — **(Admin)** Register custom Heroic Spirits, photos & parameters\n' +
          '• `/servant` — View your contracted Servant\'s status card, radar stats, and dialogue quotes\n' +
          '• `/duel [opponent]` — Engage in tactical Quick/Arts/Buster turn-based combat\n' +
          '• `/grailwar` — Access the 7-Master battle royale district map & spend AP\n' +
          '• `/customise` — Allocate stat points, customize dialogue quotes & equip Craft Essences',
        color: '#f59e0b',
        footer: 'System Ready • Discord.js v14 • Holy Grail War Engine'
      },
      components: {
        type: 'buttons',
        items: [
          { id: 'quick_summon_ritual', label: 'Summoning Ritual', style: 'success', emoji: '✨' },
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

  const allThrone = [...SERVANT_DATABASE, ...customServants];

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
    const rawCmd = cmd.trim();
    const trimmed = rawCmd.toLowerCase();
    const activeServant = master.servants.find(s => s.id === master.activeServantId) || master.servants[0];

    // Record User message in Discord chat stream
    addMessage({
      id: getNextId('usr'),
      sender: 'user',
      commandText: rawCmd,
      timestamp: 'Just now'
    });

    // ----------------------------------------------------
    // COMMAND 1: /summon
    // ----------------------------------------------------
    if (trimmed.startsWith('/summon')) {
      if (trimmed.includes('release') || trimmed.includes('sever')) {
        if (!master.servants || master.servants.length === 0) {
          addMessage({
            id: getNextId('bot_release_err'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '❌ No Contract to Release',
              description: 'You do not hold an active Servant contract in this Holy Grail War.',
              color: '#ef4444'
            }
          });
          return;
        }

        const prevName = master.servants[0].template.name;
        onUpdateMaster({
          ...master,
          servants: [],
          activeServantId: undefined
        });

        addMessage({
          id: getNextId('bot_release_ok'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '⛓️ Holy Grail Contract Severed',
            description:
              `You have released your command over **${prevName}**.\n\n` +
              `The Heroic Spirit has returned to the Throne of Heroes. You are now free to invoke a new summoning ritual with \`/summon ritual\`.`,
            color: '#ef4444'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'quick_summon_ritual', label: 'Begin New Ritual', style: 'success', emoji: '✨' }
            ]
          }
        });
        return;
      }

      // Check if Master is already bound to a Servant
      if (master.servants && master.servants.length > 0) {
        const s = master.servants[0];
        addMessage({
          id: getNextId('bot_summon_bound'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '⚠️ Sacred Contract Already Bound',
            description:
              `You are already bound to **${s.template.name}** (\`${s.template.servantClass}\`) for this Holy Grail War!\n\n` +
              `• **Command Seals:** 🔴🔴🔴 **${master.commandSeals}/3**\n` +
              `• **Level:** **${s.level}** | **HP:** ${s.template.baseHp.toLocaleString()} | **ATK:** ${s.template.baseAtk.toLocaleString()}\n` +
              `• **Noble Phantasm:** **${s.template.noblePhantasm.name}**\n\n` +
              `*In an authentic Holy Grail War, each Master is bound to a single Heroic Spirit. Use \`/summon release\` if you wish to sever your pact.*`,
            color: '#f59e0b',
            thumbnailUrl: s.template.avatarUrl
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'quick_servant_card', label: 'View Parameters (/servant)', style: 'primary', emoji: '📊' },
              { id: 'quick_release_contract', label: 'Sever Contract', style: 'danger', emoji: '⛓️' }
            ]
          }
        });
        return;
      }

      // Perform random Holy Grail War ritual summoning from Throne of Heroes
      const newInstance = createContractFromPool(allThrone, master.id);
      const randomTemplate = newInstance.template;

      onUpdateMaster({
        ...master,
        servants: [newInstance],
        activeServantId: newInstance.id,
        commandSeals: 3
      });

      addMessage({
        id: getNextId('bot_summon_res'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: `✨ HEROIC SPIRIT SUMMONED: ${randomTemplate.name.toUpperCase()}`,
          description:
            `*“Let silver and iron be the essence. Let stone and the archduke of contracts be the foundation...”*\n\n` +
            `═══════════════════════════════════\n` +
            `🗣️ **"${randomTemplate.summonQuote}"**\n` +
            `═══════════════════════════════════\n\n` +
            `👤 **True Name:** **${randomTemplate.name}**\n` +
            `🗡️ **Class:** \`${randomTemplate.servantClass}\` | **Title:** *${randomTemplate.title}*\n` +
            `🔴 **Command Seals Bestowed:** **3 / 3**\n\n` +
            `📊 **Parameters:**\n` +
            `• **HP:** \`${randomTemplate.baseHp.toLocaleString()}\` | **ATK:** \`${randomTemplate.baseAtk.toLocaleString()}\`\n` +
            `• **STR:** ${randomTemplate.baseStats.strength} | **END:** ${randomTemplate.baseStats.endurance} | **AGI:** ${randomTemplate.baseStats.agility} | **MNA:** ${randomTemplate.baseStats.mana} | **LCK:** ${randomTemplate.baseStats.luck}\n\n` +
            `💥 **Noble Phantasm:** **${randomTemplate.noblePhantasm.name}** [${randomTemplate.noblePhantasm.cardType}]\n` +
            `* "${randomTemplate.noblePhantasm.chant}" *\n\n` +
            `📜 **Lore:**\n${randomTemplate.lore}`,
          color: '#d4af37',
          footer: 'Holy Grail War Contract Established • Use /servant or /duel'
        },
        canvasType: 'servant',
        canvasPayload: { servant: newInstance, masterName: master.username },
        components: {
          type: 'buttons',
          items: [
            { id: 'quick_servant_card', label: 'View Parameters (/servant)', style: 'primary', emoji: '📊' },
            { id: 'quick_start_duel', label: 'Test in Battle (/duel)', style: 'danger', emoji: '⚔️' }
          ]
        }
      });
      return;
    }

    // ----------------------------------------------------
    // COMMAND 2: /addservant (ADMIN CUSTOM SERVANT FORGE)
    // ----------------------------------------------------
    if (trimmed.startsWith('/addservant')) {
      if (trimmed.includes('list')) {
        const customCount = customServants.length;
        const items = customServants.map((s, i) => 
          `**${i + 1}. ${s.name}** [${s.servantClass}] — *${s.title}*\n` +
          `   • HP: ${s.baseHp} | ATK: ${s.baseAtk} | NP: *${s.noblePhantasm.name}*\n` +
          `   • ID: \`${s.id}\``
        ).join('\n\n');

        addMessage({
          id: getNextId('bot_addservant_list'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: `📜 Custom Servants in Throne of Heroes (${customCount})`,
            description: customCount === 0 
              ? 'No custom Servants currently registered.\nUse `/addservant create name="Gojo Satoru" class="Caster" image="..."` to add your first custom Heroic Spirit!'
              : items,
            color: '#d4af37',
            footer: `Total summonable pool: ${allThrone.length} Heroic Spirits`
          }
        });
        return;
      }

      if (trimmed.includes('delete')) {
        const parts = rawCmd.split(' ');
        const idToDelete = parts[2];
        if (!idToDelete) {
          addMessage({
            id: getNextId('bot_addservant_del_err'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '❌ Missing Servant ID',
              description: 'Usage: `/addservant delete <servant_id>`. Use `/addservant list` to inspect IDs.',
              color: '#ef4444'
            }
          });
          return;
        }

        const filtered = customServants.filter(s => s.id !== idToDelete && !s.id.includes(idToDelete));
        if (filtered.length < customServants.length) {
          onUpdateCustomServants(filtered);
          addMessage({
            id: getNextId('bot_addservant_del_ok'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '🗑️ Custom Servant Removed',
              description: `Successfully deleted custom Servant with ID \`${idToDelete}\` from the Throne of Heroes registry.`,
              color: '#10b981'
            }
          });
        } else {
          addMessage({
            id: getNextId('bot_addservant_del_fail'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '❌ Servant Not Found',
              description: `No custom Servant found with ID matching \`${idToDelete}\`.`,
              color: '#ef4444'
            }
          });
        }
        return;
      }

      // Default: parse /addservant create or parameters
      // e.g. /addservant create name="Miyamoto Musashi" class="Saber" image="https://..."
      let customName = 'Custom Heroic Spirit';
      let customClass: ServantClass = 'Saber';
      let customImg = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';
      let customNp = 'Secret Ultimate Art';
      let customTitle = 'Heroic Spirit of Legend';

      // Parse simple arguments if provided
      const nameMatch = rawCmd.match(/name=["']?([^"']+)["']?/i);
      const classMatch = rawCmd.match(/class=["']?([^"'\s]+)["']?/i);
      const imgMatch = rawCmd.match(/(?:image|img|pic)=["']?([^"'\s]+)["']?/i);
      const npMatch = rawCmd.match(/np=["']?([^"']+)["']?/i);

      if (nameMatch) customName = nameMatch[1];
      if (classMatch) customClass = (classMatch[1] as ServantClass) || 'Saber';
      if (imgMatch) customImg = imgMatch[1];
      if (npMatch) customNp = npMatch[1];

      // If user just typed "/addservant create Gojo Satoru Caster"
      const words = rawCmd.replace('/addservant', '').replace('create', '').trim().split(' ');
      if (words.length >= 1 && words[0] && !nameMatch) {
        customName = words[0];
        if (words[1] && ['saber','archer','lancer','rider','caster','assassin','berserker','ruler','avenger','foreigner','mooncancer','shitposter'].includes(words[1].toLowerCase())) {
          customClass = (words[1].charAt(0).toUpperCase() + words[1].slice(1)) as ServantClass;
        }
        if (words[2] && words[2].startsWith('http')) {
          customImg = words[2];
        }
      }

      const newCustomTemplate = buildCustomTemplate(
        customName,
        customClass,
        customImg,
        customNp,
        customTitle
      );

      const updated = [...customServants, newCustomTemplate];
      onUpdateCustomServants(updated);

      addMessage({
        id: getNextId('bot_addservant_res'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: '✨ NEW HEROIC SPIRIT REGISTERED TO THRONE OF HEROES',
          description:
            `**${newCustomTemplate.name}** has been recorded into the Great Holy Grail registry!\n\n` +
            `• **Class:** \`${newCustomTemplate.servantClass}\`\n` +
            `• **Base HP:** \`${newCustomTemplate.baseHp.toLocaleString()}\` | **Base ATK:** \`${newCustomTemplate.baseAtk.toLocaleString()}\`\n` +
            `• **Noble Phantasm:** **${newCustomTemplate.noblePhantasm.name}** (${newCustomTemplate.noblePhantasm.cardType})\n` +
            `• **Summon Dialogue:** *"${newCustomTemplate.summonQuote}"*\n\n` +
            `*This Servant can now be summoned randomly by any Master invoking \`/summon ritual\`!*`,
          color: '#d4af37',
          footer: `ID: ${newCustomTemplate.id} • Registered by Administrator`
        },
        components: {
          type: 'buttons',
          items: [
            { id: 'quick_summon_ritual', label: 'Perform Summoning Ritual', style: 'success', emoji: '✨' }
          ]
        }
      });
      return;
    }

    // ----------------------------------------------------
    // COMMAND 3: /servant
    // ----------------------------------------------------
    if (trimmed.startsWith('/servant')) {
      if (!activeServant) {
        addMessage({
          id: getNextId('bot_no_servant'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '🕯️ No Contracted Servant',
            description: 'You have not summoned a Heroic Spirit yet for the Holy Grail War!\nUse `/summon ritual` to draw the summoning circle.',
            color: '#ef4444'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'quick_summon_ritual', label: 'Begin Summoning Ritual', style: 'success', emoji: '✨' }
            ]
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
      return;
    }

    // ----------------------------------------------------
    // COMMAND 4: /duel
    // ----------------------------------------------------
    if (trimmed.startsWith('/duel')) {
      if (!activeServant) {
        addMessage({
          id: getNextId('bot_duel_err'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: 'Combat Error',
            description: 'You must contract a Servant via `/summon ritual` before entering combat!',
            color: '#ef4444'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'quick_summon_ritual', label: 'Begin Summoning Ritual', style: 'success', emoji: '✨' }
            ]
          }
        });
        return;
      }

      const p1 = createCombatantFromMasterServant(activeServant, master.username);
      const rivalTemplate = allThrone.find(s => s.id !== activeServant.templateId) || SERVANT_DATABASE[1];
      const p2 = createCombatantFromMasterServant({
        id: 'rival_combatant_01',
        masterId: 'rival_master',
        templateId: rivalTemplate.id,
        level: 20,
        experience: 1000,
        allocatedStats: { strength: 3, endurance: 3, agility: 3, mana: 3, luck: 2 },
        availableStatPoints: 0,
        skillLevels: [2, 2, 2],
        customQuotes: {
          summon: rivalTemplate.summonQuote,
          battleStart: rivalTemplate.battleStartQuote,
          noblePhantasm: rivalTemplate.noblePhantasm.chant,
          victory: rivalTemplate.victoryQuote,
          defeat: rivalTemplate.defeatQuote
        },
        bondLevel: 3,
        template: rivalTemplate
      }, 'Rival Master Kirei');

      p2.id = 'rival_ai_duel';
      p2.name = 'Rival ' + rivalTemplate.name;

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
      return;
    }

    // ----------------------------------------------------
    // COMMAND 5: /grailwar
    // ----------------------------------------------------
    if (trimmed.startsWith('/grailwar')) {
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
      return;
    }

    // Default help
    addMessage({
      id: getNextId('bot_help'),
      sender: 'bot',
      timestamp: 'Just now',
      embed: {
        title: '❓ Holy Grail War Command Guide',
        description:
          `• \`/summon [ritual | status | release]\` — Summon a random available Servant\n` +
          `• \`/addservant [create | list | delete]\` — **(Admin)** Add custom Servants with pictures\n` +
          `• \`/servant\` — View Servant Radar Card\n` +
          `• \`/duel\` — Initiate Turn-based Battle\n` +
          `• \`/grailwar\` — 7-Master Tournament Status`,
        color: '#64748b'
      }
    });

    setInputCommand('');
  };

  // Button interaction handler
  const handleButtonClick = (btnId: string) => {
    if (btnId === 'quick_summon_ritual') {
      handleCommand('/summon ritual');
    } else if (btnId === 'quick_release_contract') {
      handleCommand('/summon release');
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
              ? `**${updatedState.player1.name}** won the battle!\n\n💬 *"A worthy clash. Walk with honor, Master."*\n\n📈 **Rewards:** +500 EXP, +1 Bond Point`
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
            <p className="text-[11px] font-mono text-white/40">discord.js v14 Slash Command Simulator & Holy Grail Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 text-[11px] font-mono font-medium rounded-sm bg-[#161616] text-rose-400 border border-rose-400/30">
            🔴 {master.commandSeals}/3 Seals
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
            placeholder="Type a command: /summon ritual, /addservant create name='Musashi' class='Saber', /servant, /duel..."
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
            onClick={() => handleCommand('/summon ritual')}
            className="hover:text-[#d4af37] hover:underline whitespace-nowrap"
          >
            /summon ritual
          </button>
          <span>•</span>
          <button
            onClick={() => handleCommand('/addservant list')}
            className="hover:text-[#d4af37] hover:underline whitespace-nowrap"
          >
            /addservant list
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
            onClick={() => handleCommand('/grailwar')}
            className="hover:text-[#d4af37] hover:underline whitespace-nowrap"
          >
            /grailwar
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
    }
  }, [canvasType, payload]);

  return <canvas ref={canvasRef} className="max-w-full h-auto rounded block" />;
}
