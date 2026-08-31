'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  MasterProfile,
  CardType,
  ActiveCombatant,
  CombatTurnLog,
  HolyGrailWarSession,
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
import {
  executeWarAction,
  simulateWarSkirmish,
  attackSuspectUserInWar,
  leakIntelInWar,
  exposeMasterInWar
} from '../lib/engine/grailwar';
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
  Trash2,
  Crosshair,
  Radio,
  Eye,
  EyeOff,
  UserX,
  Lock
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
  const [activeChannel, setActiveChannel] = useState<'public' | 'dm'>('public');
  const [messages, setMessages] = useState<DiscordMessage[]>([
    {
      id: 'msg_welcome',
      sender: 'bot',
      timestamp: 'Today at 10:45 AM',
      embed: {
        title: '⚔️ Holy Grail War Discord Bot Engine (v14.0)',
        description:
          'Welcome, Master! The Fuyuki Holy Grail War has commenced.\n' +
          'All Masters operate under the **Secrecy of Magecraft**. Your true identity is hidden in shadows until exposed.\n\n' +
          '⚠️ **Exposure Rules:**\n' +
          '• Invoking any bot command in the **#holy-grail-war (Public)** channel will immediately **EXPOSE** your Master identity!\n' +
          '• Switch to **#direct-messages (DM)** if you wish to issue secret commands in concealment.\n' +
          '• Use `/grailwar attack <@user>` to ambush suspected rival Masters (if innocent, they die and you are exposed!)\n' +
          '• Use `/grailwar leak <intel>` to broadcast clandestine intelligence onto the war board.\n\n' +
          '**Key Slash Commands:**\n' +
          '• `/grailwar [status | attack | leak | skirmish | rest]`\n' +
          '• `/servants [list | search <term> | view <name>]`\n' +
          '• `/summon [ritual | status | release]`\n' +
          '• `/duel [opponent]`',
        color: '#f59e0b',
        footer: 'System Ready • Discord.js v14 • Holy Grail War Secret Engine'
      },
      components: {
        type: 'buttons',
        items: [
          { id: 'quick_war_status', label: 'Intelligence Board (/grailwar)', style: 'secondary', emoji: '🏆' },
          { id: 'war_attack_prompt', label: 'Ambush Suspect (/grailwar attack)', style: 'danger', emoji: '⚔️' },
          { id: 'war_leak_prompt', label: 'Leak Intel (/grailwar leak)', style: 'primary', emoji: '🕵️' },
          { id: 'quick_summon_ritual', label: 'Summoning Ritual', style: 'success', emoji: '✨' }
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

    // Check automatic exposure if executing commands in PUBLIC channel
    if (activeChannel === 'public' && activeServant) {
      const userParticipant = grailWar.participants[master.discordId];
      if (userParticipant && !userParticipant.isExposed) {
        const { updatedWar, newlyExposed } = exposeMasterInWar(grailWar, master.discordId, 'public_command');
        if (newlyExposed) {
          onUpdateGrailWar(updatedWar);
          // Insert alert embed into message stream
          setTimeout(() => {
            addMessage({
              id: getNextId('bot_public_exposed_alert'),
              sender: 'bot',
              timestamp: 'Just now',
              embed: {
                title: '📡 IDENTITY EXPOSED TO SERVER',
                description:
                  `⚠️ **Magecraft Detected in Public Channel!**\n\n` +
                  `Master **${master.username}** has invoked commands in **#holy-grail-war**.\n` +
                  `Your true identity and contracted Servant (**${activeServant.template.name}** - ${activeServant.template.servantClass}) are now officially exposed on the Holy Grail War Intelligence Board!`,
                color: '#f59e0b',
                footer: 'Exposure Trigger: Public Channel Command Invocation'
              }
            });
          }, 300);
        }
      }
    }

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
    // COMMAND 3: /servant (Master's Active Servant)
    // ----------------------------------------------------
    if (trimmed === '/servant' || trimmed.startsWith('/servant status')) {
      if (!activeServant) {
        addMessage({
          id: getNextId('bot_no_servant'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '🕯️ No Contracted Servant',
            description: 'You have not summoned a Heroic Spirit yet for the Holy Grail War!\nUse `/summon ritual` to draw the summoning circle or `/servants` to browse all spirits.',
            color: '#ef4444'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'quick_summon_ritual', label: 'Begin Summoning Ritual', style: 'success', emoji: '✨' },
              { id: 'btn_show_servants_list', label: 'Browse Throne (/servants)', style: 'primary', emoji: '📜' }
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
            { id: 'btn_show_servants_list', label: 'All Servants List', style: 'secondary', emoji: '📜' },
            { id: 'quick_start_duel', label: 'Enter Battle', style: 'danger', emoji: '⚔️' }
          ]
        }
      });
      return;
    }

    // ----------------------------------------------------
    // COMMAND 3.5: /servants, /servantlist, /throne (All Servants & Search)
    // ----------------------------------------------------
    if (trimmed.startsWith('/servants') || trimmed.startsWith('/servant list') || trimmed.startsWith('/servant search') || trimmed.startsWith('/throne') || trimmed.startsWith('/servantlist')) {
      const isSearch = trimmed.includes('search ') || trimmed.startsWith('/servant search');
      const isView = trimmed.includes('view ');

      // Sub-case: /servants view <name_or_id>
      if (isView) {
        const query = trimmed.replace('/servants view', '').replace('/servant view', '').trim().toLowerCase();
        const target = allThrone.find(
          s => s.name.toLowerCase().includes(query) || s.id.toLowerCase() === query
        );

        if (target) {
          postServantFullProfile(target);
        } else {
          addMessage({
            id: getNextId('bot_servants_notfound'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '❌ Heroic Spirit Not Found',
              description: `No Servant found matching "${query}". Use \`/servants\` to list all registered Heroic Spirits.`,
              color: '#ef4444'
            }
          });
        }
        return;
      }

      // Sub-case: /servants search <query>
      if (isSearch) {
        const query = trimmed
          .replace('/servants search', '')
          .replace('/servant search', '')
          .replace('/servants', '')
          .trim()
          .toLowerCase();

        if (!query) {
          addMessage({
            id: getNextId('bot_search_empty'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '🔍 Throne of Heroes Search',
              description:
                `Please specify a search term!\n\n` +
                `**Usage Examples:**\n` +
                `• \`/servants search Artoria\`\n` +
                `• \`/servants search Saber\`\n` +
                `• \`/servants search Excalibur\`\n` +
                `• \`/servants search Custom\``,
              color: '#d4af37'
            }
          });
          return;
        }

        const matches = allThrone.filter(s =>
          s.name.toLowerCase().includes(query) ||
          s.servantClass.toLowerCase().includes(query) ||
          s.title.toLowerCase().includes(query) ||
          s.noblePhantasm.name.toLowerCase().includes(query) ||
          (s.lore && s.lore.toLowerCase().includes(query))
        );

        if (matches.length === 0) {
          addMessage({
            id: getNextId('bot_search_no_results'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: `🔍 No Results for "${query}"`,
              description:
                `No Heroic Spirits found matching **"${query}"**.\n\n` +
                `• Try searching by class name (*Saber, Archer, Lancer, Rider, Caster, Assassin, Berserker, Ruler*)\n` +
                `• Or use \`/servants list\` to view all ${allThrone.length} registered spirits.`,
              color: '#ef4444'
            },
            components: {
              type: 'buttons',
              items: [
                { id: 'btn_show_servants_list', label: 'View All Servants List', style: 'primary', emoji: '📜' }
              ]
            }
          });
          return;
        }

        postServantsList(
          matches,
          `🔍 Search Results for "${query}" (${matches.length} Found)`,
          `Matching canon & custom Heroic Spirits recorded in the Throne of Heroes. Click any name below to broadcast their complete profile:`
        );
        return;
      }

      // Sub-case: /servants canon or /servants custom or /servants (all)
      let listPool = allThrone;
      let listTitle = `📜 Throne of Heroes Registry (${allThrone.length} Servants)`;
      let listSubtitle = `All canon & custom Heroic Spirits registered in the Great Holy Grail database. Click any name below to view their full parameters, deck, lore, and quotes:`;

      if (trimmed.includes('canon')) {
        listPool = allThrone.filter(s => !s.isCustomOrMeme);
        listTitle = `🏛️ Canon Heroic Spirits Registry (${listPool.length} Servants)`;
      } else if (trimmed.includes('custom')) {
        listPool = allThrone.filter(s => s.isCustomOrMeme);
        listTitle = `🛠️ Custom Admin Servants Registry (${listPool.length} Servants)`;
      }

      postServantsList(listPool, listTitle, listSubtitle);
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
    // COMMAND 5: /grailwar, /attack, /leak
    // ----------------------------------------------------
    if (trimmed.startsWith('/grailwar') || trimmed.startsWith('/attack') || trimmed.startsWith('/leak') || trimmed.startsWith('/ambush')) {
      const isAttack = trimmed.startsWith('/grailwar attack') || trimmed.startsWith('/attack') || trimmed.startsWith('/ambush');
      const isLeak = trimmed.startsWith('/grailwar leak') || trimmed.startsWith('/leak');
      const isSkirmish = trimmed.includes('skirmish');
      const isRest = trimmed.includes('rest') || trimmed.includes('heal');
      const isBetray = trimmed.includes('betray');

      // SUB-CASE A: /grailwar attack <target> (Ambush suspect)
      if (isAttack) {
        let targetQuery = trimmed
          .replace('/grailwar attack', '')
          .replace('/attack', '')
          .replace('/ambush', '')
          .trim();

        if (!targetQuery) {
          addMessage({
            id: getNextId('bot_attack_help'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '⚔️ Holy Grail War: Tactical Ambush',
              description:
                `Specify a suspect user to ambush in the server!\n\n` +
                `**Usage Examples:**\n` +
                `• \`/grailwar attack @Kotomine\`\n` +
                `• \`/grailwar attack Bazett\`\n` +
                `• \`/attack Shirou\`\n\n` +
                `⚠️ *If the target is a real Master, both identities are exposed and you deal ambush damage. If the target is an innocent user, the civilian dies and your identity is exposed for breaching the Secrecy of Magecraft!*`,
              color: '#ef4444'
            }
          });
          return;
        }

        const res = attackSuspectUserInWar(grailWar, master.discordId, targetQuery);
        onUpdateGrailWar(res.updatedWar);

        addMessage({
          id: getNextId('bot_attack_res'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: res.targetWasMaster
              ? '⚔️ TACTICAL AMBUSH: RIVAL MASTER ENGAGED!'
              : '☠️ COLLATERAL CASUALTY: CIVILIAN SLAIN!',
            description: res.message,
            color: res.targetWasMaster ? '#ef4444' : '#7f1d1d',
            footer: res.targetWasMaster
              ? 'Both Master identities are now EXPOSED on the Grail War Status Board'
              : 'Attacking Master identity is now VIOLENTLY EXPOSED for Secrecy breach'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'quick_war_status', label: 'View Intelligence Board', style: 'primary', emoji: '📋' },
              { id: 'war_attack_prompt', label: 'Ambush Another', style: 'danger', emoji: '⚔️' }
            ]
          }
        });
        return;
      }

      // SUB-CASE B: /grailwar leak <intel> (Broadcast intelligence)
      if (isLeak) {
        let intelText = trimmed
          .replace('/grailwar leak', '')
          .replace('/leak', '')
          .trim();

        if (!intelText) {
          addMessage({
            id: getNextId('bot_leak_help'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '🕵️ Holy Grail War: Intelligence Leak Dispatch',
              description:
                `Broadcast secret intelligence, rumors, or out a suspected rival Master!\n\n` +
                `**Usage Examples:**\n` +
                `• \`/grailwar leak Sighted Archer near Fuyuki Bridge\`\n` +
                `• \`/grailwar leak Kotomine is commanding Gilgamesh Archer\`\n` +
                `• \`/leak Berserker spotted in deep forest\``,
              color: '#a855f7'
            }
          });
          return;
        }

        // Check if a known rival name is mentioned in the leak to expose them
        const matchMaster = Object.values(grailWar.participants).find(
          p => p.discordId !== master.discordId && (intelText.toLowerCase().includes(p.username.toLowerCase()) || intelText.toLowerCase().includes(p.servantName.toLowerCase()))
        );

        const res = leakIntelInWar(grailWar, master.username, intelText, matchMaster?.discordId);
        onUpdateGrailWar(res.updatedWar);

        addMessage({
          id: getNextId('bot_leak_res'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '🕵️ Intelligence Leak Broadcasted',
            description: res.message,
            color: '#a855f7',
            footer: 'Information updated on the Holy Grail War Intelligence Board'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'quick_war_status', label: 'Check Status Board', style: 'primary', emoji: '📋' },
              { id: 'war_leak_prompt', label: 'Broadcast Another Leak', style: 'secondary', emoji: '🕵️' }
            ]
          }
        });
        return;
      }

      // SUB-CASE C: /grailwar skirmish
      if (isSkirmish) {
        const result = simulateWarSkirmish(grailWar);
        onUpdateGrailWar(result.updatedWar);
        const alive = Object.values(result.updatedWar.participants).filter(x => x.isAlive).length;

        addMessage({
          id: getNextId('bot_war_skirmish'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '💥 Holy Grail War: City Skirmish',
            description:
              `${result.message}\n\n` +
              `👥 **Surviving Masters:** ${alive}/7 alive`,
            color: '#ef4444',
            footer: 'Background clash simulated across Fuyuki'
          }
        });
        return;
      }

      // SUB-CASE D: /grailwar rest or betray
      if (isRest || isBetray) {
        const actionType = isBetray ? 'betray_ally' : 'rest_and_heal';
        const result = executeWarAction(grailWar, master.discordId, actionType);
        onUpdateGrailWar(result.updatedWar);

        addMessage({
          id: getNextId('bot_war_act_res'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: result.success ? '✅ Holy Grail War Action Completed' : '⚠️ Action Interrupted',
            description: result.message,
            color: result.success ? '#22c55e' : '#ef4444'
          }
        });
        return;
      }

      // SUB-CASE E: /grailwar status (Secret Intelligence Board)
      const p = grailWar.participants[master.discordId] || Object.values(grailWar.participants)[0];
      const aliveCount = Object.values(grailWar.participants).filter(x => x.isAlive).length;
      const exposedCount = Object.values(grailWar.participants).filter(x => x.isExposed).length;
      const civilianDeaths = grailWar.innocentVictims?.length || 0;

      // 1. Render roster lines (concealing shadow participants)
      const rosterLines = Object.values(grailWar.participants).map((m, idx) => {
        const isUser = m.discordId === master.discordId;
        const statusIcon = !m.isAlive ? '💀' : m.isExposed ? '📡' : '🕶️';

        if (m.isExposed || isUser || !m.isAlive) {
          const hpBar = `${m.currentHp.toLocaleString()}/${m.maxHp.toLocaleString()}`;
          const exposureTag = m.exposureReason === 'public_command'
            ? '📡 [Exposed: Public Command]'
            : m.exposureReason === 'ambush_clash'
            ? '⚔️ [Exposed: Ambush Clash]'
            : m.exposureReason === 'innocent_assault'
            ? '☠️ [Exposed: Civilian Assault]'
            : m.exposureReason === 'intel_leak'
            ? '🕵️ [Exposed: Intel Leak]'
            : '⚔️ [Exposed: Open Combat]';

          return `• ${statusIcon} **${m.username}** ${isUser ? '**(YOU)**' : ''} — **${m.servantName}** (${m.servantClass}) — HP: ${hpBar} | Kills: ${m.kills}` +
                 `\n  ↳ *${!m.isAlive ? 'Eliminated from Tournament' : exposureTag}*`;
        } else {
          return `• ${statusIcon} **[Unknown Master #${idx + 1} — In Shadows]** — Servant: **[CLASSIFIED]** (Class: Unknown) — HP: [CLASSIFIED] | Status: Concealed`;
        }
      }).join('\n\n');

      // 2. Render recent skirmishes and important events in lower part
      const recentEvents = (grailWar.eventLogs || []).slice(0, 6).map(evt => {
        const timeStr = new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `• [${timeStr}] ${evt.text}`;
      }).join('\n');

      const chronicleSection = recentEvents || '• *No skirmishes or leaks recorded yet.*';

      addMessage({
        id: getNextId('bot_war_status'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: `🏆 ${grailWar.title} — Intelligence Status Board`,
          description:
            `⚔️ **War Status:** ${grailWar.status === 'concluded' ? '🏆 Concluded' : '🟢 ACTIVE BATTLE ROYALE'} | 🩸 **Command Seals:** ${p?.commandSeals ?? 3}/3\n` +
            `👥 **Alive Masters:** ${aliveCount}/7 alive (${exposedCount} Exposed to Server, ${7 - exposedCount} in Shadows)\n` +
            `☠️ **Civilian Casualties:** ${civilianDeaths} innocent bystanders slain\n` +
            `👤 **Your Identity:** ${p?.isExposed ? '📡 **EXPOSED TO SERVER**' : '🕶️ **CONCEALED IN SHADOWS**'}\n\n` +
            `📋 **7 Masters Roster (Intelligence Board):**\n` +
            rosterLines +
            `\n\n📜 **War Chronicle & Recent Events (Skirmishes & Leaks):**\n` +
            chronicleSection,
          color: '#f59e0b',
          footer: 'Use /grailwar attack @user to ambush suspects | /grailwar leak to broadcast intel'
        },
        components: {
          type: 'buttons',
          items: [
            { id: 'war_attack_prompt', label: 'Ambush Suspect (/grailwar attack)', style: 'danger', emoji: '⚔️' },
            { id: 'war_leak_prompt', label: 'Leak Intel (/grailwar leak)', style: 'primary', emoji: '🕵️' },
            { id: 'war_rest', label: 'Channel Mana (Heal)', style: 'success', emoji: '🩹' },
            { id: 'war_skirmish', label: 'Simulate City Skirmish', style: 'secondary', emoji: '💥' }
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
          `• \`/servants [list | search <term> | view <name>]\` — **Browse & search all canon/custom Servants**\n` +
          `• \`/summon [ritual | status | release]\` — Summon a random available Servant\n` +
          `• \`/addservant [create | list | delete]\` — **(Admin)** Register custom Heroic Spirits\n` +
          `• \`/servant\` — View your contracted Servant profile & radar card\n` +
          `• \`/duel\` — Initiate Turn-based RPG Combat\n` +
          `• \`/grailwar\` — 7-Master Tournament Status & Clashes`,
        color: '#64748b'
      },
      components: {
        type: 'buttons',
        items: [
          { id: 'btn_show_servants_list', label: 'Browse All Servants (/servants)', style: 'primary', emoji: '📜' },
          { id: 'quick_summon_ritual', label: 'Summon Servant', style: 'success', emoji: '✨' },
          { id: 'quick_start_duel', label: 'Enter Arena (/duel)', style: 'danger', emoji: '⚔️' }
        ]
      }
    });

    setInputCommand('');
  };

  // Helper: Post List of Servants with Interactive Buttons
  const postServantsList = (
    servantsList: ServantTemplate[],
    headerTitle: string,
    headerSubtitle: string
  ) => {
    const listLines = servantsList.map((s, idx) => {
      const tag = s.isCustomOrMeme ? '🛠️ [CUSTOM]' : '🏛️ [CANON]';
      const stars = '⭐'.repeat(s.rarity || 5);
      return `${idx + 1}. **${s.name}** — *${s.title}* [${s.servantClass} ${stars}] ${tag}\n   └ *NP:* **${s.noblePhantasm.name}** | HP: ${s.baseHp.toLocaleString()} | ATK: ${s.baseAtk.toLocaleString()}`;
    });

    const buttonItems = servantsList.slice(0, 15).map(s => ({
      id: `view_servant_${s.id}`,
      label: s.name.length > 20 ? s.name.substring(0, 18) + '..' : s.name,
      style: (s.isCustomOrMeme ? 'secondary' : 'primary') as 'primary' | 'secondary',
      emoji: s.isCustomOrMeme ? '🛠️' : '⚔️'
    }));

    addMessage({
      id: getNextId('bot_servants_list'),
      sender: 'bot',
      timestamp: 'Just now',
      embed: {
        title: headerTitle,
        description:
          `${headerSubtitle}\n\n` +
          listLines.join('\n\n') +
          `\n\n*Tip: Search specifically with \`/servants search <keyword>\` (e.g. \`/servants search Gilgamesh\` or \`/servants search Saber\`)*`,
        color: '#d4af37',
        footer: `Throne of Heroes • ${servantsList.length} Total Servants Available`
      },
      components: {
        type: 'buttons',
        items: buttonItems
      }
    });
  };

  // Helper: Post Full Profile of a specific Servant Template to Everyone
  const postServantFullProfile = (template: ServantTemplate) => {
    const stars = '⭐'.repeat(template.rarity || 5);
    const deck = (template.commandDeck || ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'])
      .map(c => (c === 'Buster' ? '🔴 Buster' : c === 'Arts' ? '🔵 Arts' : '🟢 Quick'))
      .join(' • ');

    const tempInstance: MasterServantInstance = {
      id: `temp_${template.id}`,
      masterId: master.id,
      templateId: template.id,
      level: 50,
      experience: 5000,
      allocatedStats: { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 },
      availableStatPoints: 0,
      skillLevels: [10, 10, 10],
      customQuotes: {
        summon: template.summonQuote,
        battleStart: template.battleStartQuote,
        noblePhantasm: template.noblePhantasm.chant,
        victory: template.victoryQuote,
        defeat: template.defeatQuote
      },
      bondLevel: 5,
      template: template
    };

    addMessage({
      id: getNextId('bot_servant_profile'),
      sender: 'bot',
      timestamp: 'Just now',
      embed: {
        title: `⚔️ Servant Profile: ${template.name} — ${template.title}`,
        description:
          `${stars} | Class: **${template.servantClass}** | Origin: **${template.isCustomOrMeme ? '🛠️ Custom Administrator Creation' : '🏛️ Canon Heroic Spirit'}**\n\n` +
          `📜 **Historical Legend & Lore:**\n> ${template.lore || 'A legendary soul recorded in the Throne of Heroes.'}\n\n` +
          `📊 **Base Combat Parameters:**\n` +
          `• **STR:** \`${template.baseStats.strength}\` | **END:** \`${template.baseStats.endurance}\` | **AGI:** \`${template.baseStats.agility}\`\n` +
          `• **MAN:** \`${template.baseStats.mana}\` | **LCK:** \`${template.baseStats.luck}\`\n` +
          `• **Base HP:** \`${template.baseHp.toLocaleString()}\` | **Base ATK:** \`${template.baseAtk.toLocaleString()}\`\n\n` +
          `🃏 **Command Deck:** ${deck}\n\n` +
          `💥 **Noble Phantasm: ${template.noblePhantasm.name}** (${template.noblePhantasm.cardType} • ${template.noblePhantasm.target.toUpperCase()})\n` +
          `> *"${template.noblePhantasm.chant || 'Noble Phantasm release!'}"*\n` +
          `• **Multiplier:** ${template.noblePhantasm.multiplier}% | **Overcharge:** ${template.noblePhantasm.overchargeEffect || 'Standard boost'}\n` +
          `• ${template.noblePhantasm.description}\n\n` +
          `✨ **Active Class & Personal Skills:**\n` +
          template.skills.map(sk => `• **${sk.name}** [CD: ${sk.cooldown}T]: ${sk.description}`).join('\n') +
          `\n\n` +
          `💬 **Master Dialogue Quotes:**\n` +
          `• **Summon:** *"${template.summonQuote}"*\n` +
          `• **Battle Start:** *"${template.battleStartQuote}"*\n` +
          `• **Victory:** *"${template.victoryQuote}"*\n` +
          `• **Defeat:** *"${template.defeatQuote}"*`,
        color: template.servantClass === 'Saber' ? '#3b82f6' : template.rarity === 5 ? '#f59e0b' : '#a855f7',
        footer: `Throne ID: ${template.id} • Holy Grail War Public Registry • Visible to everyone in channel`
      },
      canvasType: 'servant',
      canvasPayload: { servant: tempInstance, masterName: 'Throne of Heroes' },
      components: {
        type: 'buttons',
        items: [
          { id: `quote_servant_${template.id}`, label: 'Hear Dialogue Card', style: 'primary', emoji: '💬' },
          { id: 'btn_show_servants_list', label: 'All Servants List (/servants)', style: 'secondary', emoji: '📜' },
          { id: 'quick_start_duel', label: 'Enter Arena (/duel)', style: 'danger', emoji: '⚔️' }
        ]
      }
    });
  };

  // Button interaction handler
  const handleButtonClick = (btnId: string) => {
    if (btnId === 'btn_show_servants_list') {
      handleCommand('/servants list');
    } else if (btnId.startsWith('view_servant_')) {
      const servantId = btnId.replace('view_servant_', '');
      const target = allThrone.find(s => s.id === servantId);
      if (target) {
        postServantFullProfile(target);
      }
    } else if (btnId.startsWith('quote_servant_')) {
      const servantId = btnId.replace('quote_servant_', '');
      const target = allThrone.find(s => s.id === servantId);
      if (target) {
        addMessage({
          id: getNextId('bot_servant_quote'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: `💬 ${target.name}'s Dialogue`,
            description: `*"${target.summonQuote}"*`,
            color: '#f59e0b',
            footer: `${target.title} • Class: ${target.servantClass}`
          },
          canvasType: 'dialogue',
          canvasPayload: {
            speaker: target.name,
            quote: target.summonQuote,
            title: target.title,
            servantClass: target.servantClass
          }
        });
      }
    } else if (btnId === 'quick_summon_ritual') {
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
      if (btnId === 'war_attack_prompt') {
        setInputCommand('/grailwar attack ');
        return;
      }

      if (btnId === 'war_leak_prompt') {
        setInputCommand('/grailwar leak ');
        return;
      }

      if (btnId === 'war_skirmish') {
        const result = simulateWarSkirmish(grailWar);
        onUpdateGrailWar(result.updatedWar);
        const alive = Object.values(result.updatedWar.participants).filter(x => x.isAlive).length;
        addMessage({
          id: getNextId('bot_war_skirmish'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '💥 Holy Grail War: Rival Clash Simulated',
            description:
              `${result.message}\n\n` +
              `👥 **Surviving Masters:** ${alive}/7 alive\n` +
              `Recent Log:\n` +
              result.updatedWar.eventLogs.slice(0, 2).map(e => `• ${e.text}`).join('\n'),
            color: '#ef4444'
          }
        });
        return;
      }

      if (btnId === 'war_rest') {
        const result = executeWarAction(grailWar, master.discordId, 'rest_and_heal');
        onUpdateGrailWar(result.updatedWar);

        addMessage({
          id: getNextId('bot_war_act'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: result.success ? '✅ Mana Recovery Completed' : '⚠️ Action Interrupted',
            description: result.message,
            color: result.success ? '#22c55e' : '#ef4444'
          }
        });
      }
    }
  };

  const userParticipant = grailWar.participants[master.discordId];
  const isUserExposed = userParticipant?.isExposed;

  return (
    <div id="discord_emulator_container" className="flex flex-col h-full bg-[#0a0a0a] text-[#dbdee1] rounded-xl overflow-hidden border border-[#1a1a1a] shadow-2xl">
      {/* Discord Header Bar with Channel Switcher */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-[#111] border-b border-[#1a1a1a] gap-2">
        <div className="flex items-center gap-3">
          {/* Channel Switch Tabs */}
          <div className="flex items-center bg-[#0a0a0a] p-0.5 rounded border border-[#1a1a1a]">
            <button
              onClick={() => setActiveChannel('public')}
              className={`px-3 py-1 rounded text-xs font-mono flex items-center gap-1.5 transition ${
                activeChannel === 'public'
                  ? 'bg-[#161616] text-[#d4af37] border border-[#d4af37]/30 font-bold'
                  : 'text-white/40 hover:text-white'
              }`}
              title="Public Server Channel - ⚠️ Using bot commands here exposes your Master Identity!"
            >
              <span>#</span>
              <span>holy-grail-war</span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-[#220000] text-rose-400 border border-rose-500/30">PUBLIC</span>
            </button>

            <button
              onClick={() => setActiveChannel('dm')}
              className={`px-3 py-1 rounded text-xs font-mono flex items-center gap-1.5 transition ${
                activeChannel === 'dm'
                  ? 'bg-[#161616] text-purple-300 border border-purple-500/30 font-bold'
                  : 'text-white/40 hover:text-white'
              }`}
              title="Private Direct Message - 🕶️ Shadow Mode: commands here keep identity concealed"
            >
              <Lock className="w-3 h-3 text-purple-400" />
              <span>fuyuki-dms</span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-[#100820] text-purple-400 border border-purple-500/30">SECRET</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Master Exposure State Badge */}
          <div
            className={`px-2.5 py-1 text-[11px] font-mono font-medium rounded-sm border flex items-center gap-1.5 ${
              isUserExposed
                ? 'bg-[#221c08] text-[#f59e0b] border-[#f59e0b]/40'
                : 'bg-[#0f172a] text-[#38bdf8] border-[#38bdf8]/40'
            }`}
          >
            {isUserExposed ? (
              <>
                <Eye className="w-3 h-3 text-[#f59e0b]" />
                <span>Identity: <strong>EXPOSED</strong></span>
              </>
            ) : (
              <>
                <EyeOff className="w-3 h-3 text-[#38bdf8]" />
                <span>Identity: <strong>IN SHADOWS</strong></span>
              </>
            )}
          </div>

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
            onClick={() => handleCommand('/servants list')}
            className="hover:text-[#d4af37] hover:underline whitespace-nowrap text-[#d4af37]"
          >
            /servants list
          </button>
          <span>•</span>
          <button
            onClick={() => handleCommand('/servants search Artoria')}
            className="hover:text-[#d4af37] hover:underline whitespace-nowrap"
          >
            /servants search Artoria
          </button>
          <span>•</span>
          <button
            onClick={() => handleCommand('/summon ritual')}
            className="hover:text-[#d4af37] hover:underline whitespace-nowrap"
          >
            /summon ritual
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
