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
import { SERVANT_DATABASE, getDefaultClassPassives } from '../lib/data/servants';
import { getAllThroneServants, saveCustomServantsToStorage } from '../lib/state/gameState';
import { getNoblePhantasmGif, getNoblePhantasmChant, setCustomNpAnimationInMemory, setCustomNpAnimationsBatch } from '../lib/data/noblePhantasmGifs';
import { normalizeMediaUrl } from '../lib/utils/mediaResolver';
import { findServantInPool, matchServantSearch } from '../lib/utils/servantMatcher';
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
  calculateCurrentHp,
  calculateServantMaxHp,
  executeWarAction,
  simulateWarSkirmish,
  attackSuspectUserInWar,
  leakIntelInWar,
  exposeMasterInWar,
  recordDuelOutcome,
  createHolyGrailWarSession,
  patrolCityInWar,
  setChannelTrapInWar,
  disarmChannelTrapsInWar,
  dispatchFamiliarInWar,
  recallFamiliarsInWar,
  enterChurchSanctuary,
  leaveChurchSanctuary
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
  Lock,
  Search,
  X,
  ChevronRight,
  Filter
} from 'lucide-react';

const RIN_SUMMONING_GIF = 'https://i.imgur.com/hyNsgc1.jpeg';

const SUMMONING_CHANTS = [
  `*“Let silver and steel be the essence.”*\n` +
  `*“Let stone and the archduke of contracts be the foundation.”*\n` +
  `*“Let red be the color I pay tribute to.”*\n` +
  `*“Let rise a wall against the wind that shall fall.”*\n` +
  `*“Let the four cardinal gates close.”*\n` +
  `*“Let the three-forked road from the crown reaching unto the Kingdom rotate.”*\n\n` +
  `*“Let it be filled. Again. Again. Again. Again.”*\n` +
  `*“Let it be filled fivefold for every turn, simply breaking asunder with every filling.”*`,

  `*“Fill. Fill. Fill. Fill. Fill. Let each be turned over five times, simply breaking asunder the fulfilled time.”*\n` +
  `*“Let silver and steel be the essence. Let stone and the archduke of contracts be the foundation. Let my great master be the ancestor. Raise a wall, against the wind that shall fall. Close the four cardinal gates. Come out from the crown. Rotate the three-branched road reaching the Kingdom.”*\n\n` +
  `*“– I shall declare here. Your body shall serve under me. My fate shall be with your sword. Submit to the beckoning of the Holy Grail. If you will submit to this will and this reason…… then answer!”*\n\n` +
  `*“– An oath shall be sworn here! I shall attain all virtues of all of Heaven. I shall have dominion over all evils of all of Hell! – From the Seventh Heaven, attended to by three great words of power, come forth from the ring of restraint, Protector of the Balance!”*`,

  `*“Be gone, shadows!”*\n` +
  `*“Thou of the unseeable!”*\n` +
  `*“Fade back into oblivion, if of darkness. Be returned to the immaterial!”*\n` +
  `*“Ask not me, my answer is clear. In my hand is light. Know that all is in this hand.”*\n` +
  `*“I am the truth of creation. In face of all things, thy defeat is certain!”*`
];

function getRandomChant(): string {
  const index = Math.floor(Math.random() * SUMMONING_CHANTS.length);
  return SUMMONING_CHANTS[index];
}

function EmbedVisual({ url }: { url: string }) {
  const [imgError, setImgError] = useState(false);
  const [useSecondaryFallback, setUseSecondaryFallback] = useState(false);

  if (!url) return null;

  // Handle Tenor Web Page Links (e.g. https://tenor.com/view/anime-magic-magic-circle-spell-gif-8657546)
  if (url.includes('tenor.com/view/')) {
    const tenorMatch = url.match(/([0-9]+)\/?$/);
    const tenorId = tenorMatch ? tenorMatch[1] : '8657546';
    const embedUrl = `https://tenor.com/embed/${tenorId}`;

    return (
      <div className="mt-3 rounded overflow-hidden border border-[#222] bg-[#050505] max-w-xl shadow-md min-h-[280px]">
        <iframe
          src={embedUrl}
          title="Tenor Summoning Ritual GIF"
          className="w-full h-[300px] rounded border-0"
          allow="autoplay; encrypted-media"
          allowFullScreen
        />
      </div>
    );
  }

  // Handle Klipy links
  if (url.includes('klipy.com') && !url.includes('.mp4')) {
    return (
      <div className="mt-3 rounded overflow-hidden border border-[#222] bg-[#050505] max-w-xl shadow-md min-h-[280px]">
        <iframe
          src={url}
          title="Summoning Ritual GIF"
          className="w-full h-[300px] rounded border-0"
          allow="autoplay; encrypted-media"
          allowFullScreen
        />
      </div>
    );
  }

  // Handle direct MP4 video links
  if (url.includes('.mp4') || url.toLowerCase().endsWith('.mp4')) {
    return (
      <div className="mt-3 rounded overflow-hidden border border-[#222] bg-[#050505] max-w-xl shadow-md">
        <video
          src={url}
          className="w-full h-auto object-contain max-h-[400px] rounded"
          autoPlay
          loop
          muted
          playsInline
        />
      </div>
    );
  }

  const primaryFallback = 'https://media1.tenor.com/m/8YpY9q6y430AAAAC/rin-tohsaka-fate.gif';
  const secondaryFallback = 'https://i.imgur.com/hyNsgc1.jpeg';

  let currentSrc = url;
  if (imgError) {
    currentSrc = useSecondaryFallback ? secondaryFallback : primaryFallback;
  }

  const handleImageError = () => {
    if (!imgError) {
      setImgError(true);
    } else if (!useSecondaryFallback) {
      setUseSecondaryFallback(true);
    }
  };

  if (currentSrc.includes('.mp4') || currentSrc.toLowerCase().endsWith('.mp4')) {
    return (
      <div className="mt-3 rounded overflow-hidden border border-[#222] bg-[#050505] max-w-xl shadow-md">
        <video
          src={currentSrc}
          className="w-full h-auto object-contain max-h-[400px] rounded"
          autoPlay
          loop
          muted
          playsInline
        />
      </div>
    );
  }

  return (
    <div className="mt-3 rounded overflow-hidden border border-[#222] bg-[#050505] max-w-2xl shadow-md">
      <img
        src={currentSrc}
        alt="Embed Visual"
        className="w-full h-auto object-contain max-h-[460px] rounded"
        referrerPolicy="no-referrer"
        onError={handleImageError}
      />
    </div>
  );
}

function NativeMediaVisual({ url }: { url: string }) {
  const [imgError, setImgError] = useState(false);
  const [useSecondaryFallback, setUseSecondaryFallback] = useState(false);

  if (!url) return null;

  // Tenor Web Page Links (e.g. https://tenor.com/view/...)
  if (url.includes('tenor.com/view/')) {
    const tenorMatch = url.match(/([0-9]+)\/?$/);
    const tenorId = tenorMatch ? tenorMatch[1] : '8657546';
    const embedUrl = `https://tenor.com/embed/${tenorId}`;

    return (
      <div className="w-full rounded-md overflow-hidden border border-[#26282d] bg-[#050505] shadow-2xl min-h-[340px]">
        <iframe
          src={embedUrl}
          title="Noble Phantasm Animation"
          className="w-full h-[380px] rounded border-0"
          allow="autoplay; encrypted-media"
          allowFullScreen
        />
      </div>
    );
  }

  // Direct MP4 video clips
  if (url.includes('.mp4') || url.toLowerCase().endsWith('.mp4')) {
    return (
      <div className="w-full rounded-md overflow-hidden border border-[#26282d] bg-[#050505] shadow-2xl">
        <video
          src={url}
          className="w-full h-auto object-contain max-h-[520px] rounded bg-black"
          autoPlay
          loop
          muted
          playsInline
        />
      </div>
    );
  }

  const primaryFallback = 'https://media1.tenor.com/m/h2E2o3W6mYoAAAAC/saber-fate.gif';
  const secondaryFallback = 'https://media1.tenor.com/m/8YpY9q6y430AAAAC/rin-tohsaka-fate.gif';

  let currentSrc = url;
  if (imgError) {
    currentSrc = useSecondaryFallback ? secondaryFallback : primaryFallback;
  }

  const handleImageError = () => {
    if (!imgError) {
      setImgError(true);
    } else if (!useSecondaryFallback) {
      setUseSecondaryFallback(true);
    }
  };

  return (
    <div className="w-full rounded-md overflow-hidden border border-[#26282d] bg-[#050505] shadow-2xl">
      <img
        src={currentSrc}
        alt="Noble Phantasm Full-Width Cinematic"
        className="w-full h-auto object-contain max-h-[520px] rounded bg-black transition duration-200"
        referrerPolicy="no-referrer"
        onError={handleImageError}
      />
    </div>
  );
}

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
  content?: string;
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
  artworkEmbed?: {
    title?: string;
    description?: string;
    imageUrl?: string;
    color?: string;
  };
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
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showServantPickerModal, setShowServantPickerModal] = useState(false);
  const [servantPickerSearch, setServantPickerSearch] = useState('');
  const [servantPickerClass, setServantPickerClass] = useState<'all' | ServantClass>('all');
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
  const activeNpTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeNpMsgIdRef = useRef<string | null>(null);

  const cleanupActiveNpGif = () => {
    if (activeNpTimeoutRef.current) {
      clearTimeout(activeNpTimeoutRef.current);
      activeNpTimeoutRef.current = null;
    }
    if (activeNpMsgIdRef.current) {
      const idToDelete = activeNpMsgIdRef.current;
      activeNpMsgIdRef.current = null;
      setMessages(prev => prev.filter(m => m.id !== idToDelete));
    }
  };

  useEffect(() => {
    fetch('/api/servants/npanim')
      .then(r => r.json())
      .then(data => {
        if (data.animations && Array.isArray(data.animations)) {
          const map: Record<string, { gifUrl: string; chant?: string }> = {};
          data.animations.forEach((a: any) => {
            if (a.servantId && a.gifUrl) map[a.servantId.toLowerCase()] = { gifUrl: a.gifUrl, chant: a.chant };
            if (a.servantName && a.gifUrl) map[a.servantName.toLowerCase()] = { gifUrl: a.gifUrl, chant: a.chant };
          });
          setCustomNpAnimationsBatch(map);
        }
      })
      .catch(() => {});

    return () => {
      if (activeNpTimeoutRef.current) {
        clearTimeout(activeNpTimeoutRef.current);
      }
    };
  }, []);

  const allThrone = getAllThroneServants(customServants);
  const activeServant = master.servants.find(s => s.id === master.activeServantId) || master.servants[0];

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
    // Normalize exclamation mark prefix `!command` to `/command` so both styles work interchangeably
    const normalizedRawCmd = rawCmd.startsWith('!') ? '/' + rawCmd.slice(1) : rawCmd;
    const trimmed = normalizedRawCmd.toLowerCase();

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
      const userParticipant = grailWar.participants[master.discordId] ||
        Object.values(grailWar.participants).find(p => p.username.toLowerCase() === master.username.toLowerCase());

      // Master has been eliminated from the current Holy Grail War
      if (userParticipant && !userParticipant.isAlive && !trimmed.includes('status')) {
        addMessage({
          id: getNextId('bot_summon_deceased'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '☠️ SACRED SUMMONING REJECTED — MASTER IS DECEASED',
            description:
              `**The Greater Grail rejects your invocation.**\n\n` +
              `Master **${master.username}**, you were dealt a lethal strike and **PERMANENTLY ELIMINATED** from the active Holy Grail War.\n\n` +
              `• **Command Seals:** 💀 **0 / 3** (Extinguished)\n` +
              `• **Tournament Status:** **💀 Deceased / Eliminated** (HP: 0/${userParticipant.maxHp})\n\n` +
              `*In an authentic Holy Grail War, deceased Masters cannot summon a replacement Heroic Spirit or re-enter an ongoing tournament. You must wait for the war to conclude or restart the tournament session.*`,
            color: '#ef4444',
            footer: 'Eliminated Masters cannot re-enter an active Holy Grail War'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'quick_war_status', label: 'View Intelligence Board (/grailwar)', style: 'primary', emoji: '📋' },
              { id: 'war_reset_tournament', label: 'Restart Tournament Session', style: 'secondary', emoji: '🔄' }
            ]
          }
        });
        return;
      }

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

      // Synchronize Holy Grail War participant slot if alive
      const updatedWarParticipants = { ...grailWar.participants };
      const mySlotKey = Object.keys(updatedWarParticipants).find(
        k => k === master.discordId || updatedWarParticipants[k].username.toLowerCase() === master.username.toLowerCase()
      );
      if (mySlotKey) {
        const newServantMaxHp = calculateServantMaxHp(newInstance);
        updatedWarParticipants[mySlotKey] = {
          ...updatedWarParticipants[mySlotKey],
          discordId: master.discordId,
          username: master.username,
          servantId: newInstance.id,
          servantName: randomTemplate.name,
          servantClass: randomTemplate.servantClass,
          avatarUrl: randomTemplate.avatarUrl,
          maxHp: newServantMaxHp,
          currentHp: Math.min(updatedWarParticipants[mySlotKey].currentHp, newServantMaxHp)
        };
        onUpdateGrailWar({
          ...grailWar,
          participants: updatedWarParticipants
        });
      }

      // Select random chant for the ritual embed
      const chosenChant = getRandomChant();

      // Stage 1: Summoning Ritual Incantation Embed
      addMessage({
        id: getNextId('bot_summon_ritual_phase'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: '🕯️ HOLY GRAIL WAR: SACRED SUMMONING RITUAL',
          description:
            `Master **${master.username}** channels magical energy through circuits into the summoning array...\n\n` +
            chosenChant + `\n\n` +
            `✨ *The Greater Grail responds! Mana surges through the Fuyuki leylines as the magic circle erupts in blinding crimson light!*`,
          color: '#a855f7',
          imageUrl: RIN_SUMMONING_GIF,
          footer: 'Magecraft Circuits Active • Channelling Mana into the Greater Grail'
        }
      });

      // Stage 2: Servant Reveal Embed & Contract Establishment
      addMessage({
        id: getNextId('bot_summon_res'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: `✨ HEROIC SPIRIT SUMMONED: ${randomTemplate.name.toUpperCase()}`,
          description:
            `═══════════════════════════════════\n` +
            `🗣️ **"${newInstance.customQuotes?.summon || randomTemplate.summonQuote || `Servant ${randomTemplate.servantClass}. I have answered your summons. Are you my Master?`}"**\n` +
            `═══════════════════════════════════\n\n` +
            `👤 **True Name:** **${randomTemplate.name}**\n` +
            `🗡️ **Class:** \`${randomTemplate.servantClass}\` | **Title:** *${randomTemplate.title}*\n` +
            `🔴 **Command Seals Bestowed:** **3 / 3**\n\n` +
            `📊 **Base Parameters:**\n` +
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
            { id: 'boast_servant_summon', label: 'Boast to Server 📢', style: 'danger' },
            { id: 'quick_start_duel', label: 'Test in Battle (/duel)', style: 'secondary', emoji: '⚔️' },
            { id: 'quick_war_status', label: 'Enter Grail War (/grailwar)', style: 'success', emoji: '🏰' }
          ]
        }
      });
      return;
    }

    // ----------------------------------------------------
    // COMMAND: /admin & NP CINEMATIC STUDIO
    // ----------------------------------------------------
    if (trimmed.startsWith('/admin') || trimmed.startsWith('/addservant npanim') || trimmed.startsWith('/addservant npsettings')) {
      // Subcommand: npanim (bind animated GIF to any Servant NP)
      if (trimmed.includes('npanim')) {
        const urlMatch = rawCmd.match(/https?:\/\/[^\s"'>]+/i);
        const rawUrl = urlMatch ? urlMatch[0] : '';
        const gifUrl = normalizeMediaUrl(rawUrl);

        const servantMatch = rawCmd.match(/servant[:=]["']?([^"']+)["']?/i);
        let servantQuery = servantMatch ? servantMatch[1].trim() : '';

        const chantMatch = rawCmd.match(/chant[:=]["']?([^"']+)["']?/i);
        let chant = chantMatch ? chantMatch[1].trim() : '';

        if (!servantQuery) {
          // Parse non-flagged text before URL
          const cleaned = rawCmd
            .replace(/\/admin/gi, '')
            .replace(/\/addservant/gi, '')
            .replace(/npanim/gi, '')
            .replace(gifUrl, '')
            .trim();
          const parts = cleaned.split(/\s{2,}|;/);
          servantQuery = parts[0]?.trim() || '';
          if (parts[1] && !chant) chant = parts[1].trim();
        }

        if (!servantQuery || !gifUrl) {
          addMessage({
            id: getNextId('bot_npanim_help'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '🎬 /admin npanim — Noble Phantasm Animation Studio',
              description:
                `Configure custom animated cinematic GIFs for any Servant's Noble Phantasm. Rendered natively at full width during duels!\n\n` +
                `**Usage:**\n` +
                `• \`/admin npanim <servant> <gif_url> [chant]\`\n` +
                `• \`/admin npanim servant:"Artoria Pendragon" gif_url:"https://media.giphy.com/..." chant:"EX---CALIBUR!"\`\n\n` +
                `**Settings:** Use \`/admin npsettings\` to configure auto-delete and turn duration.\n` +
                `**Web UI:** You can also configure animations directly in the **Servant Workshop** tab.`,
              color: '#d4af37',
              footer: 'Native Discord full-width delivery mode active'
            }
          });
          return;
        }

        const target = findServantInPool(servantQuery, allThrone);
        if (!target) {
          addMessage({
            id: getNextId('bot_npanim_err_404'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '❌ Servant Not Found',
              description: `Could not find any Heroic Spirit matching \`${servantQuery}\` in the Throne of Heroes. Use \`/servants list\` to check names.`,
              color: '#ef4444'
            }
          });
          return;
        }

        // Persist to backend API & disk
        fetch('/api/servants/npanim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'set_anim',
            servant: target.id,
            gifUrl,
            chant: chant || undefined,
            configuredBy: master.username
          })
        }).catch(err => console.warn('Disk sync warning:', err));

        // Update in-memory registry immediately
        const finalChant = chant || target.noblePhantasm.chant;
        setCustomNpAnimationInMemory(target.id, { gifUrl, chant: finalChant });
        setCustomNpAnimationInMemory(target.name, { gifUrl, chant: finalChant });
        addMessage({
          id: getNextId('bot_npanim_success'),
          sender: 'bot',
          timestamp: 'Just now',
          content:
            `## 🎬 NOBLE PHANTASM ANIMATION CONFIGURED\n` +
            `Administrator **${master.username}** linked a cinematic animation to **${target.name}**!\n` +
            `• **Noble Phantasm:** ${target.noblePhantasm.name} (${target.noblePhantasm.cardType})\n` +
            `• **Invocation Chant:** *“${finalChant}”*\n\n` +
            `${gifUrl}\n` +
            `*(Now active in turn-based duels across all channels at full width)*`
        });
        return;
      }

      // Subcommand: npsettings (auto-delete & turn duration)
      if (trimmed.includes('npsettings')) {
        const autoDeleteMatch = rawCmd.match(/autodelete[:=]["']?(true|false|1|0)["']?/i);
        const afkMatch = rawCmd.match(/(?:afk|timeout|duration)[:=]["']?([0-9]+)["']?/i);

        const newAutoDelete: boolean | undefined = autoDeleteMatch ? (autoDeleteMatch[1].toLowerCase() === 'true' || autoDeleteMatch[1] === '1') : undefined;
        const newAfk: number | undefined = afkMatch ? parseInt(afkMatch[1], 10) : undefined;

        if (newAutoDelete !== undefined || newAfk !== undefined) {
          fetch('/api/servants/npanim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'set_settings',
              autoDelete: newAutoDelete,
              afkTimeoutSeconds: newAfk
            })
          }).catch(() => {});
        }

        addMessage({
          id: getNextId('bot_npsettings_info'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '⚙️ Noble Phantasm Duel Delivery Settings',
            description:
              `Configure how cinematic animations appear and cleanup during combat encounters:\n\n` +
              `• **Delivery Mode:** \`Native Full-Width Discord\` (No embed boundaries)\n` +
              `• **Auto-Delete on Next Turn:** \`${newAutoDelete !== undefined ? (newAutoDelete ? 'Enabled' : 'Disabled') : 'Enabled'}\`\n` +
              `• **AFK Fallback Timeout:** \`${newAfk || 60} seconds\`\n\n` +
              `**Update Syntax:**\n` +
              `\`/admin npsettings autodelete:true afk_timeout:60\``,
            color: '#d4af37',
            footer: 'Turn cleanup automatically removes GIF when next action is chosen'
          }
        });
        return;
      }

      // Subcommand: listnp or default admin control panel
      addMessage({
        id: getNextId('bot_admin_hub'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: '👑 Holy Grail War Admin Control Panel',
          description:
            `Available Administrator Commands:\n\n` +
            `• \`/admin npanim <servant> <gif_url> [chant]\` — Bind custom GIF animation to any Servant\n` +
            `• \`/admin npsettings [autodelete:true] [afk_timeout:60]\` — Configure GIF auto-delete and turn duration\n` +
            `• \`/addservant create name="Spirit" class="Saber"\` — Register custom Heroic Spirit\n` +
            `• \`/addservant edit <servant_name>\` — Modify stats, dialogue, or artwork\n` +
            `• \`/addservant list\` — List all custom registered servants\n\n` +
            `*Tip: You can also use the graphical Noble Phantasm Studio inside the Servant Workshop tab!*`,
          color: '#d4af37',
          footer: 'Administrator Authority • Fuyuki Grail War Core Engine'
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

      // SUBCOMMAND: EDIT SERVANT (CANON OR CUSTOM)
      if (trimmed.includes('edit')) {
        // Parse servant_id or target query from command
        const servantIdMatch = rawCmd.match(/servant_id[:=]["']?([^"']+)["']?/i);
        let targetQuery = servantIdMatch ? servantIdMatch[1].trim() : '';

        if (!targetQuery) {
          // Remove '/addservant', 'edit', and any known flags
          targetQuery = rawCmd
            .replace(/\/addservant/gi, '')
            .replace(/edit/gi, '')
            .replace(/(?:name|title|class|hp|atk|image|img|pic|noble_phantasm|np|np_chant|chant|np_card|summon_quote|lore)=["']?[^"']*["']?/gi, '')
            .replace(/^["']|["']$/g, '')
            .trim();
        }

        // If no servant specified at all, show interactive search & select menu
        if (!targetQuery) {
          addMessage({
            id: getNextId('bot_addservant_edit_help'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '🛠️ Throne of Heroes Admin Forge — Servant Editor',
              description: 
                `Select or search for any Heroic Spirit in the Throne of Heroes to edit their stats, artwork, voice lines, or Noble Phantasm!\n\n` +
                `**Usage:**\n` +
                `• \`/addservant edit <servant_name>\`\n` +
                `• \`/addservant edit servant_id:"saber alter" hp:18500 atk:14200\`\n` +
                `• \`/addservant edit servant_id:"Artoria" image:"https://..."\`\n\n` +
                `*Click any quick button below or use the ⚡ Pick Servant button beside chat:*`,
              color: '#d4af37',
              footer: `${allThrone.length} Servants available for editing`
            },
            components: {
              type: 'buttons',
              items: [
                { id: 'edit_servant_artoria_pendragon_alter', label: 'Edit Saber Alter', style: 'danger', emoji: '⚔️' },
                { id: 'edit_servant_artoria_pendragon', label: 'Edit Artoria (Saber)', style: 'primary', emoji: '👑' },
                { id: 'edit_servant_gilgamesh', label: 'Edit Gilgamesh', style: 'secondary', emoji: '🍷' },
                { id: 'edit_servant_emiya', label: 'Edit EMIYA (Archer)', style: 'primary', emoji: '🗡️' },
                { id: 'btn_show_servants_list', label: 'Browse All Spirits', style: 'secondary', emoji: '📜' }
              ]
            }
          });
          return;
        }

        // Search for target servant
        const target = findServantInPool(targetQuery, allThrone);

        if (!target) {
          // Find close matching suggestions
          const suggestions = allThrone
            .filter(s => matchServantSearch(s, targetQuery))
            .slice(0, 4);

          addMessage({
            id: getNextId('bot_addservant_edit_notfound'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '❌ Servant Not Found',
              description: 
                `Servant matching **"${targetQuery}"** not found in Throne of Heroes.\n\n` +
                (suggestions.length > 0
                  ? `**Did you mean:**\n` + suggestions.map(s => `• **${s.name}** (\`${s.servantClass}\` ★${s.rarity})`).join('\n') + `\n\n*Click a suggestion below to edit immediately:*`
                  : `Use \`/servants list\` or the \`⚡ Pick Servant\` tool to browse all Heroic Spirits.`),
              color: '#ef4444',
              footer: `Tip: Try searching by alias (e.g. "saber alter", "salter", "gil", "emiya")`
            },
            components: suggestions.length > 0 ? {
              type: 'buttons',
              items: suggestions.map(s => ({
                id: `edit_servant_${s.id}`,
                label: `Edit ${s.name.slice(0, 20)}`,
                style: 'secondary',
                emoji: '✏️'
              }))
            } : undefined
          });
          return;
        }

        // Check if any attribute updates were passed in the command line
        const nameMatch = rawCmd.match(/name=["']?([^"']+)["']?/i);
        const titleMatch = rawCmd.match(/title=["']?([^"']+)["']?/i);
        const classMatch = rawCmd.match(/class=["']?([^"'\s]+)["']?/i);
        const imgMatch = rawCmd.match(/(?:image_url|image_file|image|img|pic|avatar|card_art|pfp|art)[:=]["']?([^"'\s]+)["']?/i) || rawCmd.match(/https?:\/\/[^\s"'>]+\.(?:png|jpg|jpeg|webp|gif)/i);
        const hpMatch = rawCmd.match(/hp[:=]["']?(\d+)["']?/i);
        const atkMatch = rawCmd.match(/atk[:=]["']?(\d+)["']?/i);
        const npMatch = rawCmd.match(/(?:noble_phantasm|np)=["']?([^"']+)["']?/i);
        const chantMatch = rawCmd.match(/(?:np_chant|chant)=["']?([^"']+)["']?/i);
        const cardMatch = rawCmd.match(/(?:np_card|card)=["']?(Buster|Arts|Quick)["']?/i);
        const quoteMatch = rawCmd.match(/(?:summon_quote|quote)=["']?([^"']+)["']?/i);
        const loreMatch = rawCmd.match(/lore=["']?([^"']+)["']?/i);

        const hasUpdates = !!(nameMatch || titleMatch || classMatch || imgMatch || hpMatch || atkMatch || npMatch || chantMatch || cardMatch || quoteMatch || loreMatch);

        if (hasUpdates) {
          // Apply updates
          if (nameMatch) target.name = nameMatch[1].trim();
          if (titleMatch) target.title = titleMatch[1].trim();
          if (classMatch) target.servantClass = (classMatch[1].charAt(0).toUpperCase() + classMatch[1].slice(1)) as ServantClass;
          if (imgMatch) {
            const newImage = (typeof imgMatch[1] === 'string' ? imgMatch[1] : imgMatch[0]).trim();
            target.avatarUrl = newImage;
            target.cardArtUrl = newImage;
          }
          if (hpMatch) target.baseHp = parseInt(hpMatch[1], 10);
          if (atkMatch) target.baseAtk = parseInt(atkMatch[1], 10);
          if (npMatch) target.noblePhantasm.name = npMatch[1].trim();
          if (chantMatch) target.noblePhantasm.chant = chantMatch[1].trim();
          if (cardMatch) target.noblePhantasm.cardType = cardMatch[1] as CardType;
          if (quoteMatch) target.summonQuote = quoteMatch[1].trim();
          if (loreMatch) target.lore = loreMatch[1].trim();

          // Sync state & persist custom / canon overrides permanently
          const customIdx = customServants.findIndex(s => s.id === target.id);
          let updatedCustom: ServantTemplate[];
          if (customIdx >= 0) {
            updatedCustom = [...customServants];
            updatedCustom[customIdx] = { ...target };
          } else {
            updatedCustom = [...customServants, { ...target }];
          }
          onUpdateCustomServants(updatedCustom);
          saveCustomServantsToStorage(updatedCustom);

          // If the master currently has a contract with this servant, update their active template too!
          const updatedMasterServants = master.servants.map(s => {
            if (s.templateId === target.id || s.template?.id === target.id || s.template?.name.toLowerCase() === target.name.toLowerCase()) {
              return {
                ...s,
                template: { ...target }
              };
            }
            return s;
          });
          onUpdateMaster({
            ...master,
            servants: updatedMasterServants
          });

          // Persist to server disk
          fetch('/api/servants/custom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'add', servant: target })
          }).catch(err => console.warn('Disk sync warning:', err));

          addMessage({
            id: getNextId('bot_addservant_edit_success'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: `✨ HEROIC SPIRIT UPDATED: ${target.name}`,
              description: 
                `Administrator has updated profile parameters and character portrait for **${target.name}**!\n\n` +
                `• **Class:** \`${target.servantClass}\` | **Title:** *${target.title}*\n` +
                `• **Base HP:** \`${target.baseHp.toLocaleString()}\` | **Base ATK:** \`${target.baseAtk.toLocaleString()}\`\n` +
                `• **Character Portrait & Card Artwork:** ${imgMatch ? '✅ Custom Image Applied' : 'Preserved'}\n` +
                `• **Noble Phantasm:** **${target.noblePhantasm.name}** (${target.noblePhantasm.cardType})\n` +
                `• **NP Chant:** *"${target.noblePhantasm.chant}"*\n` +
                `• **Summon Dialogue:** *"${target.summonQuote}"*\n\n` +
                `*Changes take effect immediately across all active Master contracts and combat arenas!*`,
              imageUrl: target.cardArtUrl || target.avatarUrl,
              color: '#d4af37',
              footer: `ID: ${target.id} • Edited by Admin`
            },
            artworkEmbed: {
              title: `🖼️ Character Portrait & Card Artwork: ${target.name}`,
              imageUrl: target.cardArtUrl || target.avatarUrl,
              color: '#d4af37'
            },
            components: {
              type: 'buttons',
              items: [
                { id: `view_servant_${target.id}`, label: 'View Profile Card', style: 'primary', emoji: '📜' },
                { id: `edit_hp_${target.id}`, label: 'Boost HP/ATK (+2k)', style: 'secondary', emoji: '⚡' },
                { id: `edit_np_${target.id}`, label: 'Cycle NP Card', style: 'secondary', emoji: '✨' }
              ]
            }
          });
          return;
        }

        // If no updates were supplied (just inspecting/selecting servant to edit)
        addMessage({
          id: getNextId('bot_addservant_edit_sheet'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: `✏️ Editing Heroic Spirit: ${target.name}`,
            description: 
              `**Current Parameters for ${target.name}:**\n\n` +
              `• **ID:** \`${target.id}\` | **Class:** \`${target.servantClass}\` (★${target.rarity})\n` +
              `• **Title:** *${target.title}*\n` +
              `• **Base HP:** \`${target.baseHp.toLocaleString()}\` | **Base ATK:** \`${target.baseAtk.toLocaleString()}\`\n` +
              `• **Noble Phantasm:** **${target.noblePhantasm.name}** (${target.noblePhantasm.cardType})\n` +
              `• **Chant:** *"${target.noblePhantasm.chant}"*\n` +
              `• **Summon Quote:** *"${target.summonQuote}"*\n\n` +
              `**Quick Modification Syntax:**\n` +
              `\`\`\`bash\n` +
              `/addservant edit servant_id:"${target.id}" hp:19000 atk:15000\n` +
              `/addservant edit servant_id:"${target.id}" image:"https://..."\n` +
              `/addservant edit servant_id:"${target.id}" np_card:"Buster"\n` +
              `\`\`\``,
            imageUrl: target.cardArtUrl || target.avatarUrl,
            color: '#d4af37',
            footer: `Click quick action buttons below or type parameters in chat`
          },
          components: {
            type: 'buttons',
            items: [
              { id: `edit_hp_${target.id}`, label: 'Boost Stats (+2k HP/+1.5k ATK)', style: 'primary', emoji: '⚡' },
              { id: `edit_np_${target.id}`, label: 'Cycle NP Card Type', style: 'secondary', emoji: '✨' },
              { id: `view_servant_${target.id}`, label: 'View Broadcast Card', style: 'success', emoji: '📜' }
            ]
          }
        });
        return;
      }

      if (trimmed.includes('delete') || trimmed.includes('clear')) {
        let idToDelete = rawCmd
          .replace(/\/addservant/gi, '')
          .replace(/delete/gi, '')
          .replace(/clear/gi, '')
          .replace(/servant_id[:=]/gi, '')
          .trim()
          .replace(/^["']|["']$/g, '');

        if (!idToDelete && trimmed.includes('clear')) {
          idToDelete = 'all';
        }

        if (!idToDelete) {
          addMessage({
            id: getNextId('bot_addservant_del_err'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '❌ Missing Servant ID',
              description: 'Usage: `/addservant delete <servant_id>` or `/addservant delete all`. Use `/addservant list` to inspect IDs.',
              color: '#ef4444'
            }
          });
          return;
        }

        const queryLower = idToDelete.toLowerCase();
        const isAll = queryLower === 'all' || queryLower === '*';

        let filtered: typeof customServants = [];
        let deletedTargetName = idToDelete;

        if (isAll) {
          filtered = [];
        } else {
          const match = customServants.find(
            s => s.id.toLowerCase() === queryLower ||
                 s.name.toLowerCase() === queryLower ||
                 s.id.toLowerCase().includes(queryLower) ||
                 s.name.toLowerCase().includes(queryLower)
          );

          if (match) {
            deletedTargetName = `${match.name} (${match.id})`;
            filtered = customServants.filter(s => s.id !== match.id);
          } else {
            filtered = customServants;
          }
        }

        if (isAll || filtered.length < customServants.length) {
          const removedCount = customServants.length - filtered.length;
          onUpdateCustomServants(filtered);
          fetch('/api/servants/custom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: isAll ? 'save_all' : 'delete', servants: isAll ? [] : undefined, servantId: idToDelete })
          }).catch(err => console.warn('Disk sync warning:', err));

          addMessage({
            id: getNextId('bot_addservant_del_ok'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '🗑️ Custom Servant Removed',
              description: isAll 
                ? `Successfully cleared all ${removedCount} custom Heroic Spirits from the Throne of Heroes registry.`
                : `Successfully deleted custom Servant **${deletedTargetName}** from the Throne of Heroes registry.`,
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
              description: `No custom Servant found matching \`${idToDelete}\`. Use \`/addservant list\` to see registered custom spirits. (Canon Servants cannot be removed).`,
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

      // Immediately write to server persistence disk
      fetch('/api/servants/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', servant: newCustomTemplate })
      }).catch(err => console.warn('Disk sync warning:', err));

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
    // COMMAND 2.8: /inventory, /equip, /customise equip, /cegacha inventory
    // ----------------------------------------------------
    if (
      trimmed.startsWith('/inventory') ||
      trimmed.startsWith('/equip') ||
      trimmed.startsWith('/customise') ||
      trimmed.startsWith('/cegacha inventory')
    ) {
      let category: 'ces' | 'servants' | 'seals' | 'items' = 'ces';
      if (trimmed.includes('servant')) category = 'servants';
      else if (trimmed.includes('seal') || trimmed.includes('ward')) category = 'seals';
      else if (trimmed.includes('item') || trimmed.includes('vault') || trimmed.includes('quartz')) category = 'items';

      postInventoryHub(category);
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

      const templateId = activeServant.templateId || activeServant.template?.id || activeServant.id;
      const canonical = SERVANT_DATABASE.find(s => s.id === templateId) || activeServant.template || activeServant;
      const t = { ...canonical, ...(activeServant.template?.isCustomOrMeme ? activeServant.template : {}) };
      const alloc = activeServant.allocatedStats || { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 };
      const base = t.baseStats || { strength: 10, endurance: 10, agility: 10, mana: 10, luck: 10 };
      const totalStr = (base.strength || 10) + (alloc.strength || 0);
      const totalEnd = (base.endurance || 10) + (alloc.endurance || 0);
      const ceBonusAtk = activeServant.equippedCe?.atkBonus || 0;
      const ceBonusHp = activeServant.equippedCe?.hpBonus || 0;
      const lvl = activeServant.level || 1;
      const totalHp = Math.round((t.baseHp || 28000) * (1 + (lvl - 1) * 0.05) + totalEnd * 150 + ceBonusHp);
      const totalAtk = Math.round((t.baseAtk || 10000) * (1 + (lvl - 1) * 0.05) + totalStr * 80 + ceBonusAtk);

      addMessage({
        id: getNextId('bot_servant'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: `⚔️ Servant Profile Card: ${activeServant.nickname || t.name}`,
          description:
            `*${t.title}* • **Master:** ${master.username}\n` +
            `🌟 **Class:** ${t.servantClass} | **Rarity:** ${'★'.repeat(t.rarity)} | **Bond Lv:** ${activeServant.bondLevel || 1}/10 ♥ | **Level:** ${lvl}/100\n` +
            `❤️ **Max HP:** \`${totalHp.toLocaleString()}\` | ⚔️ **Total ATK:** \`${totalAtk.toLocaleString()}\` | 📈 **Stat Points:** **${activeServant.availableStatPoints || 0} pts**`,
          color: t.rarity === 5 ? '#f59e0b' : '#38bdf8'
        },
        canvasType: 'servant',
        canvasPayload: { servant: activeServant, masterName: master.username },
        artworkEmbed: {
          imageUrl: t.cardArtUrl || t.avatarUrl,
          color: t.rarity === 5 ? '#f59e0b' : '#38bdf8'
        },
        components: {
          type: 'buttons',
          items: [
            { id: 'view_active_np', label: 'View Noble Phantasm', style: 'danger', emoji: '🎬' },
            { id: 'btn_hear_quote', label: 'Hear Dialogue Card', style: 'primary', emoji: '💬' },
            { id: 'boast_servant_profile', label: 'Boast to Server 📢', style: 'danger' },
            { id: 'btn_show_servants_list', label: 'All Servants List', style: 'secondary', emoji: '📜' },
            { id: 'quick_start_duel', label: 'Enter Battle', style: 'danger', emoji: '⚔️' }
          ]
        }
      });
      return;
    }

    // ----------------------------------------------------
    // COMMAND: /np, /noblephantasm, /servants np, /servant np
    // ----------------------------------------------------
    if (trimmed.startsWith('/np') || trimmed.startsWith('/noblephantasm') || trimmed.startsWith('/servants np') || trimmed.startsWith('/servant np')) {
      const q = trimmed
        .replace('/servants np', '')
        .replace('/servant np', '')
        .replace('/noblephantasm', '')
        .replace('/np', '')
        .trim()
        .toLowerCase();

      let target: ServantTemplate | undefined = undefined;
      if (q) {
        target = allThrone.find(
          s => s.name.toLowerCase() === q ||
               s.id.toLowerCase() === q ||
               s.name.toLowerCase().includes(q) ||
               s.id.toLowerCase().includes(q)
        );
      } else if (activeServant) {
        target = activeServant.template;
      }

      if (target) {
        postNoblePhantasmCard(target);
      } else {
        addMessage({
          id: getNextId('bot_np_notfound'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '❌ Noble Phantasm Not Found',
            description: q 
              ? `No Heroic Spirit found matching "${q}". Use \`/servants\` to list all registered Servants.`
              : 'Please specify a Servant name (e.g. `/np Scáthach` or `/np Gilgamesh`) or contract a Servant first.',
            color: '#ef4444'
          }
        });
      }
      return;
    }

    // ----------------------------------------------------
    // COMMAND: /artwork, /art, /servants artwork, /servant artwork
    // ----------------------------------------------------
    if (trimmed.startsWith('/artwork') || trimmed.startsWith('/art') || trimmed.startsWith('/servants artwork') || trimmed.startsWith('/servant artwork')) {
      const q = trimmed
        .replace('/servants artwork', '')
        .replace('/servant artwork', '')
        .replace('/artwork', '')
        .replace('/art', '')
        .trim()
        .toLowerCase();

      let target: ServantTemplate | undefined = undefined;
      if (q) {
        target = allThrone.find(
          s => s.name.toLowerCase() === q ||
               s.id.toLowerCase() === q ||
               s.name.toLowerCase().includes(q) ||
               s.id.toLowerCase().includes(q)
        );
      } else if (activeServant) {
        target = activeServant.template;
      }

      if (target) {
        postArtworkCard(target);
      } else {
        addMessage({
          id: getNextId('bot_art_notfound'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '❌ Character Artwork Not Found',
            description: q 
              ? `No Heroic Spirit found matching "${q}". Use \`/servants\` to list all registered Servants.`
              : 'Please specify a Servant name (e.g. `/artwork Artoria` or `/artwork Jeanne`) or contract a Servant first.',
            color: '#ef4444'
          }
        });
      }
      return;
    }

    // ----------------------------------------------------
    // COMMAND 3.5: /servants, /servantlist, /throne (All Servants & Search)
    // ----------------------------------------------------
    // Direct servant lookup if user enters "/servant <name>" or "/servants <name>"
    if ((trimmed.startsWith('/servant ') || trimmed.startsWith('/servants ')) &&
        !trimmed.startsWith('/servant status') &&
        !trimmed.startsWith('/servant list') &&
        !trimmed.startsWith('/servants list') &&
        !trimmed.startsWith('/servants canon') &&
        !trimmed.startsWith('/servants custom') &&
        !trimmed.startsWith('/servant search') &&
        !trimmed.startsWith('/servants search') &&
        !trimmed.startsWith('/servant view') &&
        !trimmed.startsWith('/servants view')) {
      const q = trimmed.replace('/servants', '').replace('/servant', '').trim().toLowerCase();
      if (q) {
        const direct = allThrone.find(
          s => s.name.toLowerCase() === q || 
               s.id.toLowerCase() === q ||
               s.name.toLowerCase().includes(q) ||
               s.id.toLowerCase().includes(q)
        );
        if (direct) {
          postServantFullProfile(direct);
          return;
        }
      }
    }

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

      // Check if user is eliminated from the Holy Grail War
      const userParticipant =
        grailWar.participants[master.discordId] ||
        Object.values(grailWar.participants).find(
          p => p.username.toLowerCase() === master.username.toLowerCase()
        );

      if (userParticipant && !userParticipant.isAlive) {
        addMessage({
          id: getNextId('bot_duel_dead'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '💀 You Are Deceased in the Holy Grail War',
            description:
              `**${master.username}**, you have been slain and permanently eliminated from this Holy Grail War!\n\n` +
              `Your contract with **${activeServant.template.name}** has been severed. You can inspect the Intelligence Board with \`/grailwar status\` or restart the Holy Grail War tournament.`,
            color: '#ef4444',
            footer: 'Deceased Masters are permanently removed from combat'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'quick_war_status', label: 'View Intelligence Board (/grailwar)', style: 'primary', emoji: '📋' },
              { id: 'war_reset_tournament', label: 'Restart Tournament Session', style: 'secondary', emoji: '🔄' }
            ]
          }
        });
        return;
      }

      // Match target opponent from Holy Grail War
      const targetQuery = trimmed.replace('/duel', '').replace(/[<@!>]/g, '').trim().toLowerCase();
      let targetParticipant = targetQuery
        ? Object.values(grailWar.participants).find(
            p =>
              (p.username.toLowerCase().includes(targetQuery) ||
              p.servantName.toLowerCase().includes(targetQuery) ||
              p.discordId.toLowerCase() === targetQuery) &&
              p.discordId !== master.discordId
          )
        : Object.values(grailWar.participants).find(
            p =>
              p.discordId !== master.discordId &&
              p.username.toLowerCase() !== master.username.toLowerCase() &&
              p.isAlive
          );

      if (!targetParticipant) {
        addMessage({
          id: getNextId('bot_duel_no_rivals'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '⚔️ NO RIVAL MASTERS AVAILABLE IN FUYUKI',
            description:
              `There are currently no other living Masters in the server to duel.\n\n` +
              `• **Real Masters Only:** The Holy Grail War is fought exclusively by actual server members — no NPCs or synthetic duplicates are permitted.\n` +
              `• **How to Duel:** Invite another server member to invoke \`/summon ritual\` to contract a Heroic Spirit and join the war!\n` +
              `• You can view current participants at any time with \`/grailwar status\`.`,
            color: '#64748b',
            footer: 'Holy Grail War • Real Masters Only'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'quick_war_status', label: 'View Intelligence Board (/grailwar)', style: 'primary', emoji: '📋' }
            ]
          }
        });
        return;
      }

      if (targetParticipant && !targetParticipant.isAlive) {
        addMessage({
          id: getNextId('bot_duel_target_dead'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '💀 Target Master Already Eliminated',
            description: `Master **${targetParticipant.username}** (${targetParticipant.servantName}) has already been slain in this Holy Grail War. Choose an alive Master to duel!`,
            color: '#ef4444'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'quick_war_status', label: 'View Intelligence Board (/grailwar)', style: 'primary', emoji: '📋' }
            ]
          }
        });
        return;
      }

      const p1Hp = userParticipant ? calculateCurrentHp(userParticipant) : undefined;
      const p1 = createCombatantFromMasterServant(activeServant, master.username, p1Hp);

      const rivalTemplate =
        allThrone.find(s => s.id === targetParticipant.servantId) ||
        allThrone.find(s => s.name.toLowerCase() === targetParticipant.servantName.toLowerCase()) ||
        allThrone.find(s => s.name.toLowerCase().includes(targetParticipant.servantName.toLowerCase())) ||
        allThrone.find(s => s.id !== activeServant.templateId) ||
        SERVANT_DATABASE[1];

      const rivalMasterName = targetParticipant.username;
      const p2Hp = targetParticipant ? calculateCurrentHp(targetParticipant) : undefined;
      const p2 = createCombatantFromMasterServant({
        id: targetParticipant.discordId,
        masterId: targetParticipant.discordId,
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
      }, rivalMasterName, p2Hp);

      p2.id = targetParticipant.discordId;
      p2.name = rivalTemplate.name;

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
    // COMMAND 4.5: /profile and /patrol
    // ----------------------------------------------------
    if (trimmed === '/profile' || trimmed.startsWith('/profile ') || trimmed.startsWith('/grailwar profile')) {
      postProfileEmbed();
      return;
    }

    if (trimmed.startsWith('/patrol') || trimmed.startsWith('/grailwar patrol')) {
      const chanTag = activeChannel === 'public' ? '#holy-grail-war' : '#general';
      const res = patrolCityInWar(grailWar, master.discordId, master.username, chanTag);
      onUpdateGrailWar(res.updatedWar);
      addMessage({
        id: getNextId('bot_patrol_res'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: '👁️ Patrol Outcome — Fuyuki Surveillance',
          description: res.message,
          color: '#3b82f6',
          footer: 'Holy Grail War Patrol Protocol'
        },
        components: {
          type: 'buttons',
          items: [
            { id: 'quick_war_status', label: 'Check Status Board (/grailwar)', style: 'primary', emoji: '📋' },
            { id: 'war_patrol', label: 'Patrol Again', style: 'success', emoji: '👁️' }
          ]
        }
      });
      return;
    }

    // ----------------------------------------------------
    // COMMAND 4.9: /church, /sanctuary (Fuyuki Church Sanctuary)
    // ----------------------------------------------------
    if (trimmed.startsWith('/church') || trimmed.startsWith('/sanctuary')) {
      const uP = grailWar.participants[master.discordId] ||
        Object.values(grailWar.participants).find(p => p.username.toLowerCase() === master.username.toLowerCase());

      if (!uP || !uP.isAlive) {
        addMessage({
          id: getNextId('bot_church_no_part'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '⛪ Fuyuki Church — Neutral Sanctuary',
            description: 'You are not currently an active Master in the Holy Grail War. Summon a Servant via `/summon ritual` to enter the war.',
            color: '#71717a'
          }
        });
        return;
      }

      if (trimmed.includes('leave') || trimmed.includes('exit')) {
        const res = leaveChurchSanctuary(grailWar, uP.discordId);
        onUpdateGrailWar(res.updatedWar);
        addMessage({
          id: getNextId('bot_church_leave'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: res.success ? '⚔️ Departed Fuyuki Church Sanctuary' : '⚠️ Departure Notice',
            description: res.message,
            color: res.success ? '#3b82f6' : '#f59e0b'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'church_enter', label: 'Enter Church Sanctuary ⛪', style: 'primary' },
              { id: 'quick_war_defenses', label: 'Mage Defenses 🏰', style: 'secondary' }
            ]
          }
        });
        return;
      }

      if (trimmed.includes('enter') || trimmed.includes('join') || trimmed.includes('claim')) {
        const res = enterChurchSanctuary(grailWar, uP.discordId);
        onUpdateGrailWar(res.updatedWar);
        addMessage({
          id: getNextId('bot_church_enter'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: res.success ? '⛪ Fuyuki Church Asylum Granted' : '⚠️ Asylum Notice',
            description: res.message,
            color: res.success ? '#10b981' : '#f59e0b'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'church_leave', label: 'Leave Sanctuary 🚪', style: 'danger' },
              { id: 'quick_war_defenses', label: 'Mage Defenses 🏰', style: 'secondary' }
            ]
          }
        });
        return;
      }

      // Default status view
      const inSanctuary = !!uP.inSanctuary;
      addMessage({
        id: getNextId('bot_church_status'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: '⛪ Fuyuki Church — Neutral Sanctuary Grounds',
          description:
            `*Father Kirei Kotomine presides over the neutral grounds of the Fuyuki Church.*\n\n` +
            `Under Holy Church oversight and imperial leylines, Masters seeking reprieve from the Holy Grail War may claim sanctuary here.\n\n` +
            `• **Your Current Sanctuary Status:** ${inSanctuary ? '🕊️ **ACTIVE ASYLUM** (Immune to all ambushes & attacks)' : '⚔️ **IN THE FIELD** (Active combatant)'}\n` +
            `• **Asylum Inviolability:** No Master may target, ambush, or skirmish against anyone sheltered within the church.\n` +
            `• **Truce Binding:** Masters in sanctuary cannot launch ambushes or attack rivals until they formally depart.\n\n` +
            `*Use the interactive buttons below or commands \`/church enter\` and \`/church leave\`:*`,
          color: inSanctuary ? '#10b981' : '#6366f1',
          footer: 'Holy Church Overseer Protocol • Fuyuki City Neutral Zone'
        },
        components: {
          type: 'buttons',
          items: [
            inSanctuary
              ? { id: 'church_leave', label: 'Leave Sanctuary (Re-enter War) 🚪', style: 'danger' }
              : { id: 'church_enter', label: 'Enter Church Sanctuary (Claim Asylum) ⛪', style: 'primary' },
            { id: 'quick_war_defenses', label: 'Mage Defenses 🏰', style: 'secondary' },
            { id: 'quick_war_status', label: 'War Board 📋', style: 'secondary' }
          ]
        }
      });
      return;
    }

    // ----------------------------------------------------
    // COMMAND 5: /grailwar, /attack, /leak, /defenses, /familiar, /trap
    // ----------------------------------------------------
    if (trimmed.startsWith('/grailwar') || trimmed.startsWith('/attack') || trimmed.startsWith('/leak') || trimmed.startsWith('/ambush') || trimmed.startsWith('/defenses') || trimmed.startsWith('/ward') || trimmed.startsWith('/evade') || trimmed.startsWith('/familiar') || trimmed.startsWith('/familiars') || trimmed.startsWith('/trap') || trimmed.startsWith('/traps')) {
      const isFamiliars = trimmed.startsWith('/familiars') || trimmed.startsWith('/familiar') || trimmed.startsWith('/grailwar familiar') || trimmed.startsWith('/grailwar familiars');
      const isTraps = trimmed.startsWith('/traps') || trimmed.startsWith('/trap') || trimmed.startsWith('/grailwar trap') || trimmed.startsWith('/grailwar traps');
      const isDefenses = !isFamiliars && !isTraps && (trimmed.startsWith('/defenses') || trimmed.startsWith('/grailwar defenses') || trimmed.startsWith('/ward') || trimmed.startsWith('/grailwar ward') || trimmed.startsWith('/evade') || trimmed.startsWith('/grailwar evade'));
      const isAttack = trimmed.startsWith('/grailwar attack') || trimmed.startsWith('/attack') || trimmed.startsWith('/ambush');
      const isLeak = trimmed.startsWith('/grailwar leak') || trimmed.startsWith('/leak');
      const isSkirmish = trimmed.includes('skirmish');
      const isRest = trimmed.includes('rest') || trimmed.includes('heal');

      // SUB-CASE FAMILIARS: /grailwar familiar, /familiars
      if (isFamiliars) {
        const chanTag = activeChannel === 'public' ? '#holy-grail-war' : '#general';
        if (trimmed.includes('raven') || trimmed.includes('crow')) {
          const res = dispatchFamiliarInWar(grailWar, master.discordId, master.username, chanTag, 'raven');
          onUpdateGrailWar(res.updatedWar);
          addMessage({
            id: getNextId('bot_fam_res'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: res.success ? '🦅 Scouting Raven Dispatched' : '⚠️ Dispatch Interrupted',
              description: res.message,
              color: res.success ? '#3b82f6' : '#ef4444'
            },
            components: {
              type: 'buttons',
              items: [
                { id: 'war_familiars', label: 'View Familiars', style: 'primary', emoji: '🦅' },
                { id: 'quick_war_status', label: 'Status Board', style: 'secondary', emoji: '📋' }
              ]
            }
          });
          return;
        } else if (trimmed.includes('homunculus') || trimmed.includes('doll') || trimmed.includes('decoy')) {
          const res = dispatchFamiliarInWar(grailWar, master.discordId, master.username, chanTag, 'homunculus');
          onUpdateGrailWar(res.updatedWar);
          addMessage({
            id: getNextId('bot_fam_res'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: res.success ? '🗿 Homunculus Decoy Materialized' : '⚠️ Dispatch Interrupted',
              description: res.message,
              color: res.success ? '#10b981' : '#ef4444'
            },
            components: {
              type: 'buttons',
              items: [
                { id: 'war_familiars', label: 'View Familiars', style: 'primary', emoji: '🦅' },
                { id: 'quick_war_status', label: 'Status Board', style: 'secondary', emoji: '📋' }
              ]
            }
          });
          return;
        } else if (trimmed.includes('shadow') || trimmed.includes('imp')) {
          const res = dispatchFamiliarInWar(grailWar, master.discordId, master.username, chanTag, 'shadow_imp');
          onUpdateGrailWar(res.updatedWar);
          addMessage({
            id: getNextId('bot_fam_res'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: res.success ? '🦇 Shadow Imp Infiltrated' : '⚠️ Dispatch Interrupted',
              description: res.message,
              color: res.success ? '#8b5cf6' : '#ef4444'
            },
            components: {
              type: 'buttons',
              items: [
                { id: 'war_familiars', label: 'View Familiars', style: 'primary', emoji: '🦅' },
                { id: 'quick_war_status', label: 'Status Board', style: 'secondary', emoji: '📋' }
              ]
            }
          });
          return;
        } else if (trimmed.includes('recall') || trimmed.includes('dismiss')) {
          const res = recallFamiliarsInWar(grailWar, master.discordId);
          onUpdateGrailWar(res.updatedWar);
          addMessage({
            id: getNextId('bot_fam_recall'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '🕊️ Familiars Recalled',
              description: res.message,
              color: '#64748b'
            }
          });
          return;
        }

        // View active familiars and dispatch panel
        const userFamiliars = (grailWar.familiars || []).filter(f => f.masterId === master.discordId);
        const familiarLines = userFamiliars.length > 0
          ? userFamiliars.map((f, i) => {
              const icon = f.familiarType === 'raven' ? '🦅' : f.familiarType === 'homunculus' ? '🗿' : '🦇';
              const name = f.familiarType === 'raven' ? 'Scouting Raven' : f.familiarType === 'homunculus' ? 'Homunculus Decoy' : 'Shadow Imp';
              const logs = f.detectedIntel && f.detectedIntel.length > 0
                ? f.detectedIntel.slice(0, 2).map(l => `\n    ↳ *${l}*`).join('')
                : '\n    ↳ *No movements recorded yet.*';
              return `${i + 1}. ${icon} **${name}** stationed in **${f.channelName}**${logs}`;
            }).join('\n\n')
          : '• *You have no active familiars deployed in Fuyuki City.*';

        addMessage({
          id: getNextId('bot_fam_menu'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '🦅 Familiar Reconnaissance & Tactical Espionage',
            description:
              `Deploy magical scouts to monitor server sectors, intercept enemy ambushes, or spy on rivals!\n\n` +
              `📡 **Your Active Familiars (${userFamiliars.length}/2):**\n` +
              familiarLines + `\n\n` +
              `✨ **Available Familiar Archetypes:**\n` +
              `• 🦅 **Scouting Raven:** Patrols a channel to record rival activity and detect Servant class auras.\n` +
              `• 🗿 **Homunculus Decoy:** Sacrifices itself to absorb 100% of the next ambush damage and keep you concealed.\n` +
              `• 🦇 **Shadow Imp:** Lies in ambush in a channel, siphoning HP and gathering clandestine whispers.`,
            color: '#8b5cf6',
            footer: 'Select a familiar to dispatch or recall active scouts below:'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'dispatch_familiar_raven', label: 'Dispatch Raven', style: 'primary', emoji: '🦅' },
              { id: 'dispatch_familiar_homunculus', label: 'Craft Homunculus', style: 'success', emoji: '🗿' },
              { id: 'dispatch_familiar_shadow_imp', label: 'Deploy Shadow Imp', style: 'secondary', emoji: '🦇' },
              { id: 'recall_all_familiars', label: 'Recall All', style: 'danger', emoji: '🕊️' },
              { id: 'quick_war_status', label: 'Status Board', style: 'secondary', emoji: '📋' }
            ]
          }
        });
        return;
      }

      // SUB-CASE TRAPS: /grailwar trap, /traps
      if (isTraps) {
        const chanTag = activeChannel === 'public' ? '#holy-grail-war' : '#general';
        if (trimmed.includes('alarm')) {
          const res = setChannelTrapInWar(grailWar, master.discordId, master.username, chanTag, 'alarm');
          onUpdateGrailWar(res.updatedWar);
          addMessage({
            id: getNextId('bot_trap_res'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: res.success ? '🚨 Alarm Ward Anchored' : '⚠️ Ward Interrupted',
              description: res.message,
              color: res.success ? '#ef4444' : '#64748b'
            }
          });
          return;
        } else if (trimmed.includes('drain') || trimmed.includes('bloodfort')) {
          const res = setChannelTrapInWar(grailWar, master.discordId, master.username, chanTag, 'drain');
          onUpdateGrailWar(res.updatedWar);
          addMessage({
            id: getNextId('bot_trap_res'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: res.success ? '🩸 Bloodfort Drain Field Anchored' : '⚠️ Ward Interrupted',
              description: res.message,
              color: res.success ? '#dc2626' : '#64748b'
            }
          });
          return;
        } else if (trimmed.includes('disarm') || trimmed.includes('clear')) {
          const res = disarmChannelTrapsInWar(grailWar, master.discordId);
          onUpdateGrailWar(res.updatedWar);
          addMessage({
            id: getNextId('bot_trap_disarm'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '🧹 Bounded Traps Disarmed',
              description: res.message,
              color: '#64748b'
            }
          });
          return;
        }

        const userTraps = (grailWar.channelTraps || []).filter(t => t.setterMasterId === master.discordId);
        const trapLines = userTraps.length > 0
          ? userTraps.map((t, i) => `${i + 1}. ${t.trapType === 'alarm' ? '🚨 Alarm Ward' : '🩸 Bloodfort Drain'} in **${t.channelName}**`).join('\n')
          : '• *No active channel Bounded Fields anchored.*';

        addMessage({
          id: getNextId('bot_trap_menu'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '🕸️ Channel Bounded Field Traps',
            description:
              `Anchor hidden magecraft traps in specific channels to intercept rival Masters!\n\n` +
              `🕸️ **Your Active Traps (${userTraps.length}/2):**\n` +
              trapLines + `\n\n` +
              `• 🚨 **Alarm Ward:** Exposes the intruder's username and Servant class upon entering.\n` +
              `• 🩸 **Bloodfort Drain:** Siphons 1,800–2,600 HP from intruder to heal your Servant.`,
            color: '#dc2626',
            footer: 'Select an action below:'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'trap_channel_alarm', label: 'Set Alarm Ward', style: 'danger', emoji: '🚨' },
              { id: 'trap_channel_drain', label: 'Set Bloodfort Drain', style: 'danger', emoji: '🩸' },
              { id: 'disarm_all_traps', label: 'Disarm All Traps', style: 'secondary', emoji: '🧹' },
              { id: 'quick_war_status', label: 'Status Board', style: 'primary', emoji: '📋' }
            ]
          }
        });
        return;
      }

      // SUB-CASE 0: /defenses, /grailwar defenses, /grailwar ward, /grailwar evade
      if (isDefenses) {
        let currentWar = grailWar;
        let actionMsg = '';

        if (trimmed.includes('ward alarm') || trimmed.includes('alarm')) {
          const res = executeWarAction(currentWar, master.discordId, 'set_ward', 'alarm');
          currentWar = res.updatedWar;
          actionMsg = res.message;
          onUpdateGrailWar(currentWar);
        } else if (trimmed.includes('ward sanctuary') || trimmed.includes('ward ward') || (trimmed.startsWith('/ward') && !trimmed.includes('none') && !trimmed.includes('alarm'))) {
          const res = executeWarAction(currentWar, master.discordId, 'set_ward', 'ward');
          currentWar = res.updatedWar;
          actionMsg = res.message;
          onUpdateGrailWar(currentWar);
        } else if (trimmed.includes('ward none')) {
          const res = executeWarAction(currentWar, master.discordId, 'set_ward', 'none');
          currentWar = res.updatedWar;
          actionMsg = res.message;
          onUpdateGrailWar(currentWar);
        } else if (trimmed.includes('evade off')) {
          const res = executeWarAction(currentWar, master.discordId, 'toggle_evade', 'off');
          currentWar = res.updatedWar;
          actionMsg = res.message;
          onUpdateGrailWar(currentWar);
        } else if (trimmed.includes('evade on')) {
          const res = executeWarAction(currentWar, master.discordId, 'toggle_evade', 'on');
          currentWar = res.updatedWar;
          actionMsg = res.message;
          onUpdateGrailWar(currentWar);
        }

        const uP = currentWar.participants[master.discordId];
        const wardType = uP?.boundedField || 'none';
        const evadeOn = uP?.autoEvadeEnabled !== false;
        const seals = uP?.commandSeals ?? 3;
        const inSanctuary = !!uP?.inSanctuary;

        let wardDesc = '🚫 **No Active Wards:** Your workshop has no perimeter defenses.';
        if (wardType === 'ward') {
          wardDesc = '🛡️ **Mage\'s Sanctuary Bounded Field:** Absorbs & deflects **60% of incoming ambush damage**.';
        } else if (wardType === 'alarm') {
          wardDesc = '🚨 **Intrusion Alarm Trap:** Detects infiltrators, alerting you and dealing **3,000 retaliatory DMG**.';
        }

        let classPassive = 'None (Specializes in direct tactical matches)';
        const sClass = uP?.servantClass;
        if (sClass === 'Saber' || sClass === 'Archer' || sClass === 'Lancer') {
          classPassive = '👁️ **Instinct / Clairvoyance:** 35% chance to predict ambushes, parrying 80% damage and dealing 1,500 counter DMG.';
        } else if (sClass === 'Assassin') {
          classPassive = '🕶️ **Presence Concealment:** Completely immune to surprise ambushes. Nullifies strike & counters for 2,500 DMG!';
        } else if (sClass === 'Berserker') {
          classPassive = '❤️ **Battle Continuation (Guts):** Revives once with 25% Max HP if dealt a fatal blow.';
        }

        addMessage({
          id: getNextId('bot_defenses_embed'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '🏰 Mage Workshop & Sanctuary Defenses',
            description:
              `Master **${master.username}**'s Tactical Defense Headquarters\n\n` +
              (actionMsg ? `📢 **Action Outcome:**\n${actionMsg}\n\n` : '') +
              `🛡️ **Bounded Field Protocol:**\n${wardDesc}\n\n` +
              `⛪ **Fuyuki Church Sanctuary:**\n` +
              (inSanctuary
                ? `• **🕊️ ACTIVE ASYLUM:** Sheltered under Father Kotomine. 100% immune to all ambushes & attacks (cannot attack rivals).\n\n`
                : `• **⚔️ IN THE FIELD:** Active combatant in Holy Grail War territory.\n\n`) +
              `🔴 **Command Seal Emergency Evacuation:**\n` +
              (evadeOn
                ? `• **🟢 ENABLED:** When taking fatal ambush damage, consumes **1 Command Seal** to escape into shadows with **1 HP**.\n`
                : `• **🔴 DISABLED:** Fatal ambushes will eliminate your Servant normally without consuming a seal.\n`) +
              `• **Current Command Seals:** \`${'✦ '.repeat(seals)}${'✧ '.repeat(Math.max(0, 3 - seals))}\` (**${seals}/3** remaining)\n\n` +
              `👁️ **Servant Class Passive:**\n${classPassive}\n\n` +
              `*Toggle your defenses and Bounded Fields using the interactive buttons below:*`,
            color: '#3b82f6',
            footer: 'Holy Grail War Defense Protocol • Use /grailwar status to view roster'
          },
          components: {
            type: 'buttons',
            items: [
              {
                id: 'ward_none',
                label: 'No Wards',
                style: wardType === 'none' ? 'primary' : 'secondary',
                emoji: '🚫'
              },
              {
                id: 'ward_ward',
                label: 'Sanctuary (60% Block)',
                style: wardType === 'ward' ? 'success' : 'secondary',
                emoji: '🛡️'
              },
              {
                id: 'ward_alarm',
                label: 'Alarm Trap (3k DMG)',
                style: wardType === 'alarm' ? 'danger' : 'secondary',
                emoji: '🚨'
              },
              {
                id: inSanctuary ? 'church_leave' : 'church_enter',
                label: inSanctuary ? 'Leave Sanctuary 🚪' : 'Church Sanctuary ⛪',
                style: inSanctuary ? 'danger' : 'primary'
              },
              {
                id: 'toggle_auto_evade',
                label: evadeOn ? 'Auto-Evacuate: ON 🟢' : 'Auto-Evacuate: OFF 🔴',
                style: evadeOn ? 'success' : 'secondary'
              },
              {
                id: 'quick_war_status',
                label: 'War Board (/grailwar)',
                style: 'primary',
                emoji: '📋'
              }
            ]
          }
        });
        return;
      }

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

      // SUB-CASE D: /grailwar rest or /grailwar heal
      if (isRest) {
        const result = executeWarAction(grailWar, master.discordId, 'heal_ritual');
        onUpdateGrailWar(result.updatedWar);

        addMessage({
          id: getNextId('bot_war_act_res'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: result.success ? '✨ Workshop Leyline Healing Ritual' : '⏳ Magical Circuit Exhaustion',
            description: result.message,
            color: result.success ? '#22c55e' : '#eab308',
            footer: 'Spiritual Core Regeneration • 5-min cooldown (Passive Leylines active)'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'war_my_profile', label: 'View Profile & HP', style: 'primary', emoji: '👤' },
              { id: 'quick_war_status', label: 'War Status Board', style: 'secondary', emoji: '📋' }
            ]
          }
        });
        return;
      }

      // SUB-CASE RESET: /grailwar reset
      if (trimmed.startsWith('/grailwar reset') || trimmed.startsWith('/resetwar')) {
        const newWar = createHolyGrailWarSession({
          discordId: master.discordId,
          username: master.username,
          servantId: activeServant?.templateId || 'artoria_pendragon_saber',
          servantName: activeServant?.template.name || 'Artoria Pendragon',
          servantClass: activeServant?.template.servantClass || 'Saber',
          avatarUrl: master.avatarUrl,
          maxHp: activeServant ? calculateServantMaxHp(activeServant) : 15000
        });
        onUpdateGrailWar(newWar);
        addMessage({
          id: getNextId('bot_war_reset'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '🔄 Holy Grail War Tournament Initialized',
            description:
              `A brand new **7-Master Fuyuki Holy Grail War** has commenced!\n\n` +
              `All 7 Master-Servant contracts have been restored to full health in the shadows of Fuyuki City.\n` +
              `Conceal your identity, gather intelligence, and clash for the wish-granting artifact!`,
            color: '#3b82f6'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'quick_war_status', label: 'View Intelligence Board (/grailwar)', style: 'primary', emoji: '📋' },
              { id: 'quick_start_duel', label: 'Initiate Duel (/duel)', style: 'danger', emoji: '⚔️' }
            ]
          }
        });
        return;
      }

      // SUB-CASE E: /grailwar status (Secret Intelligence Board)
      const p = grailWar.participants[master.discordId] || Object.values(grailWar.participants)[0];
      const aliveCount = Object.values(grailWar.participants).filter(x => x.isAlive).length;
      const exposedCount = Object.values(grailWar.participants).filter(x => x.isExposed).length;
      const civilianDeaths = grailWar.civilianCasualties?.length || 0;
      const leaksCount = grailWar.leakedIntel?.length || 0;

      // 1. Render roster lines (concealing shadow participants)
      const rosterLines = Object.values(grailWar.participants).map((m, idx) => {
        const isUser = m.discordId === master.discordId;
        const statusIcon = !m.isAlive ? '💀' : m.isExposed ? '📡' : '🕶️';

        if (m.isExposed || isUser || !m.isAlive) {
          const curHp = calculateCurrentHp(m);
          const hpBar = !m.isAlive
            ? `0/${m.maxHp.toLocaleString()}`
            : `${curHp.toLocaleString()}/${m.maxHp.toLocaleString()}`;

          const exposureTag = !m.isAlive
            ? '💀 [DECEASED / PERMANENTLY ELIMINATED]'
            : m.exposureReason === 'public_command'
            ? '📡 [Exposed: Public Command]'
            : m.exposureReason === 'ambush_clash'
            ? '⚔️ [Exposed: Ambush Clash]'
            : m.exposureReason === 'innocent_assault'
            ? '☠️ [Exposed: Civilian Assault]'
            : m.exposureReason === 'intel_leak'
            ? '🕵️ [Exposed: Intel Leak]'
            : '⚔️ [Exposed: Open Combat]';

          return `• ${statusIcon} **${m.username}** ${isUser ? '**(YOU)**' : ''} — **${m.servantName}** (${m.servantClass}) — HP: ${hpBar} | Kills: ${m.kills}` +
                 `\n  ↳ *${exposureTag}*`;
        } else {
          return `• ${statusIcon} **[Unknown Master #${idx + 1} — In Shadows]** — Servant: **[CLASSIFIED]** (Class: Unknown) — HP: [CLASSIFIED] | Status: Concealed`;
        }
      }).join('\n\n');

      // 2. Render recent skirmishes and important events in lower part with stealth protection
      const publicEvents = (grailWar.eventLogs || []).filter(evt => {
        const txt = (evt.text || '').toLowerCase();
        return !txt.includes('workshop defense') &&
               !txt.includes('auto-evacuation') &&
               !txt.includes('channeled mana') &&
               !txt.includes('bounded field');
      });

      const recentEvents = publicEvents.slice(0, 6).map(evt => {
        const timeStr = new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let displayText = evt.text;
        Object.values(grailWar.participants).forEach((participant, idx) => {
          if (!participant.isExposed && participant.discordId !== master.discordId) {
            if (participant.username && displayText.includes(participant.username)) {
              displayText = displayText.replace(new RegExp(`Master \\*\\*${participant.username}\\*\\*`, 'g'), 'A Shadow Master');
              displayText = displayText.replace(new RegExp(`\\*\\*${participant.username}\\*\\*`, 'g'), `Shadow Master #${idx + 1}`);
              displayText = displayText.replace(new RegExp(participant.username, 'g'), `Shadow Master #${idx + 1}`);
            }
            if (participant.servantName && displayText.includes(participant.servantName)) {
              displayText = displayText.replace(new RegExp(`\\*\\*${participant.servantName}\\*\\*`, 'g'), 'Heroic Spirit');
              displayText = displayText.replace(new RegExp(participant.servantName, 'g'), 'Heroic Spirit');
            }
          }
        });
        return `• [${timeStr}] ${displayText}`;
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
            { id: 'war_my_profile', label: 'Secret Profile (Private)', style: 'primary', emoji: '👤' },
            { id: 'war_defenses', label: 'Defenses', style: 'secondary', emoji: '🏰' },
            { id: 'war_familiars', label: 'Familiars', style: 'primary', emoji: '🦅' },
            { id: 'war_traps', label: 'Bounded Traps', style: 'secondary', emoji: '🕸️' },
            { id: 'war_patrol', label: 'Patrol City', style: 'success', emoji: '👁️' },
            { id: 'war_refresh', label: 'Refresh', style: 'secondary', emoji: '🔄' }
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
        title: '❓ Holy Grail War Command Guide (Supports / and ! prefixes)',
        description:
          `*You can type commands using either \`/\` slash syntax or \`!\` text prefix (e.g. \`/servant\` or \`!servant\`).*\n\n` +
          `• \`!servants [list | search <term> | view <name>]\` — Browse & inspect all Servants in the Throne\n` +
          `• \`!np <name>\` / \`!art <name>\` — View animated Noble Phantasm cinematics & full card artwork\n` +
          `• \`!summon [ritual | status | release]\` — Summon a random Heroic Spirit to contract\n` +
          `• \`!servant\` — View your contracted Servant profile, radar card, and voice lines\n` +
          `• \`!heal\` — Perform workshop leylines healing ritual\n` +
          `• \`!duel [@master]\` — Challenge a rival Master to turn-based RPG combat\n` +
          `• \`!grailwar\` — 7-Master Tournament Battle Royal dashboard & scouting\n` +
          `• \`!profile\` & \`!defenses\` — Manage Master Command Seals, Mana, and workshop boundary fields\n` +
          `• \`!inventory\` & \`!equip\` — Manage Craft Essences, catalysts, and saint quartz\n` +
          `• \`!church\` — Enter neutral Church Sanctuary protection\n` +
          `• \`!addservant\` — **(Admin)** Register or customize Heroic Spirits`,
        color: '#64748b'
      },
      components: {
        type: 'buttons',
        items: [
          { id: 'btn_show_servants_list', label: 'Browse All Servants (!servants)', style: 'primary', emoji: '📜' },
          { id: 'quick_summon_ritual', label: 'Summon Servant (!summon)', style: 'success', emoji: '✨' },
          { id: 'quick_start_duel', label: 'Enter Arena (!duel)', style: 'danger', emoji: '⚔️' }
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

    const rawPassives = (template.passives && template.passives.length > 0)
      ? template.passives.slice(0, 2)
      : getDefaultClassPassives(template.servantClass).slice(0, 2);

    const passiveSkillsText = rawPassives && rawPassives.length > 0
      ? rawPassives.map((p, idx) => {
          if (idx === 0) {
            return `• **Passive 1: ${p.name}** [${p.rank || 'Passive'}] *(Unlocked at Bond 1)* — ${p.description}`;
          } else {
            return `• **Passive 2: ${p.name}** [${p.rank || 'Passive'}] *(Unlocks at Bond 5)* — ${p.description}`;
          }
        }).join('\n')
      : 'None';

    const activeSkillsText = template.skills && template.skills.length > 0
      ? template.skills.map((sk, idx) => `• **Skill ${idx + 1}: ${sk.name}** [CD: ${sk.cooldown}T] — ${sk.description}`).join('\n')
      : 'None';

    addMessage({
      id: getNextId('bot_servant_profile'),
      sender: 'bot',
      timestamp: 'Just now',
      embed: {
        title: `⚔️ Servant Profile: ${template.name} — ${template.title}`,
        thumbnailUrl: template.avatarUrl,
        imageUrl: template.cardArtUrl || template.avatarUrl,
        description:
          `${stars} | Class: **${template.servantClass}** | Origin: **${template.isCustomOrMeme ? '🛠️ Custom Administrator Creation' : '🏛️ Canon Heroic Spirit'}**\n\n` +
          `📜 **Historical Legend & Lore:**\n> ${template.lore || 'A legendary soul recorded in the Throne of Heroes.'}\n\n` +
          `📊 **Base Combat Parameters:**\n` +
          `• **STR:** \`${template.baseStats.strength}\` | **END:** \`${template.baseStats.endurance}\` | **AGI:** \`${template.baseStats.agility}\`\n` +
          `• **MAN:** \`${template.baseStats.mana}\` | **LCK:** \`${template.baseStats.luck}\`\n` +
          `• **Base HP:** \`${template.baseHp.toLocaleString()}\` | **Base ATK:** \`${template.baseAtk.toLocaleString()}\`\n\n` +
          `🃏 **Command Deck:** ${deck}\n\n` +
          `⚡ **Active Personal Skills:**\n${activeSkillsText}\n\n` +
          `🛡️ **Class Passive Skills (Max 2 • 2nd Unlocks at Bond Lv. 5):**\n${passiveSkillsText}\n\n` +
          `💥 **Noble Phantasm: ${template.noblePhantasm.name}** (${template.noblePhantasm.cardType} • ${template.noblePhantasm.target.toUpperCase()})\n` +
          `> *"${template.noblePhantasm.chant || 'Noble Phantasm release!'}"*\n` +
          `• **Multiplier:** ${template.noblePhantasm.multiplier}% | **Overcharge:** ${template.noblePhantasm.overchargeEffect || 'Standard boost'}\n` +
          `• ${template.noblePhantasm.description}\n\n` +
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
      artworkEmbed: {
        title: `🖼️ Character Artwork: ${template.name}`,
        imageUrl: template.cardArtUrl || template.avatarUrl,
        color: template.servantClass === 'Saber' ? '#3b82f6' : template.rarity === 5 ? '#f59e0b' : '#a855f7'
      },
      components: {
        type: 'buttons',
        items: [
          { id: `view_np_${template.id}`, label: 'View Noble Phantasm', style: 'danger', emoji: '🎬' },
          { id: `view_art_${template.id}`, label: 'View Card Artwork', style: 'secondary', emoji: '🖼️' },
          { id: `quote_servant_${template.id}`, label: 'Hear Dialogue Card', style: 'primary', emoji: '💬' },
          { id: 'btn_show_servants_list', label: 'Back to Servants List', style: 'secondary', emoji: '📜' }
        ]
      }
    });
  };

  // Helper: Post Noble Phantasm Animation Card
  const postNoblePhantasmCard = (template: ServantTemplate) => {
    const np = template.noblePhantasm;
    const gifUrl = getNoblePhantasmGif(template);
    const chant = getNoblePhantasmChant(template);
    const stars = '⭐'.repeat(template.rarity || 5);
    const cardColor = np.cardType === 'Buster' ? '#ef4444' : np.cardType === 'Arts' ? '#3b82f6' : '#10b981';

    addMessage({
      id: getNextId('bot_np_view'),
      sender: 'bot',
      timestamp: 'Just now',
      embed: {
        title: `💥 NOBLE PHANTASM: ${np.name}`,
        thumbnailUrl: template.avatarUrl,
        imageUrl: gifUrl,
        description:
          `> *"${chant || np.chant || 'True Name Unleashed!'}"*\n\n` +
          `• **Heroic Spirit:** **${template.name}** — *${template.title}* [\`${template.servantClass}\` ${stars}]\n` +
          `• **Card Type & Target:** **${np.cardType}** • **${np.target.toUpperCase()}**\n` +
          `• **Damage Multiplier:** \`${np.multiplier}%\` | **Overcharge:** ${np.overchargeEffect || 'Standard boost'}\n` +
          `• **True Name Power:** ${np.description}\n\n` +
          `🎬 *Noble Phantasm Animated Cinematic Playback*`,
        color: cardColor,
        footer: `Throne ID: ${template.id} • Holy Grail War Noble Phantasm Archive`
      },
      components: {
        type: 'buttons',
        items: [
          { id: `view_servant_${template.id}`, label: 'Inspect Profile', style: 'primary', emoji: '⚔️' },
          { id: `view_art_${template.id}`, label: 'View Card Artwork', style: 'secondary', emoji: '🖼️' },
          { id: `quote_servant_${template.id}`, label: 'Hear Voice Line', style: 'secondary', emoji: '💬' },
          { id: 'btn_show_servants_list', label: 'Back to Servants List', style: 'secondary', emoji: '📜' }
        ]
      }
    });
  };

  // Helper: Post Full Artwork Card
  const postArtworkCard = (template: ServantTemplate) => {
    const stars = '⭐'.repeat(template.rarity || 5);
    const imgUrl = template.cardArtUrl || template.avatarUrl;

    addMessage({
      id: getNextId('bot_art_view'),
      sender: 'bot',
      timestamp: 'Just now',
      embed: {
        title: `🖼️ Character Artwork: ${template.name} — ${template.title}`,
        thumbnailUrl: template.avatarUrl,
        imageUrl: imgUrl,
        description:
          `${stars} | Class: **${template.servantClass}** | Origin: **${template.isCustomOrMeme ? '🛠️ Custom Administrator Creation' : '🏛️ Canon Heroic Spirit'}**\n\n` +
          `📜 **Legend & Lore:**\n> ${template.lore || 'A legendary soul recorded in the Throne of Heroes.'}\n\n` +
          `💥 **Noble Phantasm:** *${template.noblePhantasm.name}* (${template.noblePhantasm.cardType})`,
        color: template.servantClass === 'Saber' ? '#3b82f6' : template.rarity === 5 ? '#f59e0b' : '#a855f7',
        footer: `Throne ID: ${template.id} • Holy Grail War Card Archive`
      },
      components: {
        type: 'buttons',
        items: [
          { id: `view_np_${template.id}`, label: 'View Noble Phantasm', style: 'danger', emoji: '🎬' },
          { id: `view_servant_${template.id}`, label: 'Inspect Profile', style: 'primary', emoji: '⚔️' },
          { id: `quote_servant_${template.id}`, label: 'Hear Voice Line', style: 'secondary', emoji: '💬' },
          { id: 'btn_show_servants_list', label: 'Back to Servants List', style: 'secondary', emoji: '📜' }
        ]
      }
    });
  };

  const postProfileEmbed = (customMsg?: string) => {
    const userParticipant = grailWar.participants[master.discordId] || Object.values(grailWar.participants)[0];
    const activeServant = master.servants?.find(s => s.id === master.activeServantId) || master.servants?.[0];

    if (!activeServant || !master.servants || master.servants.length === 0) {
      addMessage({
        id: getNextId('bot_profile_no_servant'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: '👤 Master Dossier | No Servant Contracted',
          description: '📜 **Civilian Spectator Dossier**: You are currently an innocent bystander in Fuyuki City with no contracted Servant. Use `/summon` to establish a covenant and enter the Holy Grail War.',
          color: '#71717a'
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

    const ward = userParticipant?.boundedField || 'none';
    const autoEvade = userParticipant?.autoEvadeEnabled !== false;
    const seals = userParticipant?.commandSeals ?? 3;
    const isExposed = userParticipant?.isExposed;

    let wardLabel = '🚫 **No Wards Active** (No perimeter defenses)';
    if (ward === 'ward') {
      wardLabel = '🛡️ **Sanctuary Bounded Field** (Absorbs 60% Ambush DMG)';
    } else if (ward === 'alarm') {
      wardLabel = '🚨 **Intrusion Alarm Trap** (Alerts & Deals 3,000 retaliatory DMG)';
    }

    const sTemplate = activeServant.template;
    const servantName = activeServant.nickname || sTemplate.name;
    const servantClass = sTemplate.servantClass;

    let classPassive = 'None (Specializes in standard strategic match)';
    if (servantClass === 'Saber' || servantClass === 'Archer' || servantClass === 'Lancer') {
      classPassive = '👁️ **Instinct / Clairvoyance:** 35% chance to predict ambushes, parrying 80% damage and dealing 1,500 counter DMG.';
    } else if (servantClass === 'Assassin') {
      classPassive = '🕶️ **Presence Concealment:** Completely immune to surprise ambushes. Nullifies strike & counters for 2,500 DMG!';
    } else if (servantClass === 'Berserker') {
      classPassive = '❤️ **Battle Continuation (Guts):** Revives once with 25% Max HP if dealt a fatal blow.';
    }

    const rarity = sTemplate.rarity || 5;
    const rarityStars = '⭐'.repeat(rarity);
    const np = sTemplate.noblePhantasm;

    const userCurHp = userParticipant ? calculateCurrentHp(userParticipant) : (activeServant ? calculateServantMaxHp(activeServant) : 10000);
    const userMaxHp = userParticipant?.maxHp || (activeServant ? calculateServantMaxHp(activeServant) : 10000);

    addMessage({
      id: getNextId('bot_profile_dossier'),
      sender: 'bot',
      timestamp: 'Just now',
      embed: {
        title: `👤 Secret Master Dossier | ${master.username}`,
        description:
          `*(🔒 This confidential profile is only visible to you. Other Masters cannot see these details.)*\n\n` +
          (customMsg ? `📢 **Action Outcome:**\n${customMsg}\n\n` : '') +
          `⚔️ **Contracted Servant:**\n` +
          `• **${servantName}** [${rarityStars}] — Class: **${servantClass}**\n` +
          `• **Noble Phantasm:** ✨ **${np.name}** (${np.cardType})\n` +
          `  *${np.chant || np.description}*\n\n` +
          `📊 **Combat Parameters:**\n` +
          `• **HP:** ❤️ \`${userCurHp.toLocaleString()} / ${userMaxHp.toLocaleString()}\`\n` +
          `• **Base ATK:** ⚔️ \`${sTemplate.baseAtk.toLocaleString()}\`\n` +
          `• **Noble Phantasm Charge:** ⚡ \`100% Ready\`\n\n` +
          `🛡️ **Workshop Defenses & Wards:**\n` +
          `• **Active Bounded Field:** ${wardLabel}\n` +
          `• **Command Seal Auto-Evacuation:** ${autoEvade ? '🟢 **ENABLED** (Retreats to shadows with 1 HP on lethal blow)' : '🔴 **DISABLED**'}\n` +
          `• **Command Seals:** \`${'✦ '.repeat(seals)}${'✧ '.repeat(Math.max(0, 3 - seals))}\` (**${seals}/3** remaining)\n\n` +
          `👁️ **Servant Class Passive:**\n${classPassive}\n\n` +
          `🏆 **Grail War Status:**\n` +
          `• **Stealth Status:** ${isExposed ? '⚠️ **EXPOSED TO PUBLIC WAR BOARD**' : '🕶️ **Concealed in Shadows** (Anonymous to rivals)'}\n` +
          `• **Kills:** **${userParticipant?.kills || 0}** | **Status:** ${userParticipant?.isAlive !== false ? '🟢 Active Competitor' : '💀 Eliminated'}`,
        color: isExposed ? '#ef4444' : '#3b82f6',
        footer: 'Private Master Dossier • Holy Grail War Protocol'
      },
      components: {
        type: 'buttons',
        items: [
          {
            id: 'profile_ward_none',
            label: 'No Wards',
            style: ward === 'none' ? 'primary' : 'secondary',
            emoji: '🚫'
          },
          {
            id: 'profile_ward_ward',
            label: 'Sanctuary (60% Block)',
            style: ward === 'ward' ? 'success' : 'secondary',
            emoji: '🛡️'
          },
          {
            id: 'profile_ward_alarm',
            label: 'Alarm Trap (3k DMG)',
            style: ward === 'alarm' ? 'danger' : 'secondary',
            emoji: '🚨'
          },
          {
            id: 'profile_toggle_evade',
            label: autoEvade ? 'Auto-Evacuate: ON 🟢' : 'Auto-Evacuate: OFF 🔴',
            style: autoEvade ? 'success' : 'secondary'
          },
          {
            id: 'profile_heal',
            label: 'Channel Mana (Heal)',
            style: 'success',
            emoji: '🩹'
          },
          {
            id: 'quick_war_status',
            label: 'War Board (/grailwar)',
            style: 'primary',
            emoji: '📋'
          }
        ]
      }
    });
  };

  // Helper: Post Hana Association Equipment & Inventory Hub
  const postInventoryHub = (
    category: 'ces' | 'servants' | 'seals' | 'items' = 'ces',
    page: number = 1,
    selectedId?: string
  ) => {
    const ownedCes = (master.craftEssences || []).filter(Boolean);
    const ownedServants = master.servants || [];
    const activeServant = master.servants?.find(s => s.id === master.activeServantId) || master.servants?.[0];
    const servantName = activeServant?.nickname || activeServant?.template?.name || (activeServant as any)?.name || 'Heroic Spirit';

    let title = `🛡️ ${master.username}'s Inventory — Craft Essences`;
    let equippedBanner = '';
    let itemLines: string[] = [];
    let totalItems = 0;
    const itemsPerPage = 8;

    if (category === 'ces') {
      title = `🛡️ ${master.username}'s Inventory — Craft Essences`;
      const activeCeName = activeServant?.equippedCe?.name;
      equippedBanner = activeCeName
        ? `✅ Equipped **${activeCeName}** (★${activeServant?.equippedCe?.rarity || 5}).`
        : `⚠️ **No Craft Essence equipped.** Select an item below and press **Equip**.`;

      const ceCounts = new Map<string, { ce: any; count: number }>();
      for (const c of ownedCes) {
        if (!c || !c.id) continue;
        if (!ceCounts.has(c.id)) ceCounts.set(c.id, { ce: c, count: 1 });
        else ceCounts.get(c.id)!.count++;
      }

      const uniqueCes = Array.from(ceCounts.values());
      totalItems = uniqueCes.length;

      if (uniqueCes.length === 0) {
        itemLines = ['• *No Craft Essences in inventory. Roll in `/cegacha` using Saint Quartz!*'];
      } else {
        const startIndex = (page - 1) * itemsPerPage;
        const paginated = uniqueCes.slice(startIndex, startIndex + itemsPerPage);

        itemLines = paginated.map(({ ce, count }) => {
          const isEq = activeServant?.equippedCeId === ce.id;
          const rarityTag = ce.rarity >= 5 ? 'Legendary' : ce.rarity >= 4 ? 'Rare' : 'Common';
          const rankTag = ce.rarity >= 5 ? 'S Rank' : ce.rarity >= 4 ? 'A Rank' : 'B Rank';
          const eqBadge = isEq ? ' **[EQUIPPED]**' : '';
          const arrow = (selectedId && selectedId === ce.id) ? '➡️ ' : '• ';
          return `${arrow}**${rarityTag}** — **${ce.name}** ×${count} — ${rankTag}${eqBadge}`;
        });
      }
    } else if (category === 'servants') {
      title = `⚔️ ${master.username}'s Inventory — Contracted Servants`;
      const sClass = activeServant?.template?.servantClass || (activeServant as any)?.servantClass || 'Saber';
      const sLvl = activeServant?.level || 1;
      equippedBanner = activeServant
        ? `✅ Active Contract: **${servantName}** (${sClass}) [Lv.${sLvl}].`
        : `⚠️ No active Servant contract.`;

      totalItems = ownedServants.length;
      const startIndex = (page - 1) * itemsPerPage;
      const paginated = ownedServants.slice(startIndex, startIndex + itemsPerPage);

      itemLines = paginated.map((s: any) => {
        const sN = s.nickname || s.template?.name || s.name || 'Heroic Spirit';
        const sCls = s.template?.servantClass || s.servantClass || 'Saber';
        const sRar = s.template?.rarity || s.rarity || 5;
        const isAct = master.activeServantId === s.id;
        const rarTag = sRar >= 5 ? '★5 SSR' : sRar >= 4 ? '★4 SR' : '★3 R';
        const actBadge = isAct ? ' **[ACTIVE CONTRACT]**' : '';
        const arrow = (selectedId && selectedId === s.id) ? '➡️ ' : '• ';
        return `${arrow}**${rarTag}** — **${sN}** — Lv.${s.level || 1} (${sCls})${actBadge}`;
      });
    } else if (category === 'seals') {
      title = `📜 ${master.username}'s Inventory — Command Seals & Master Wards`;
      equippedBanner = `✅ Master Seals: **3 / 3 Command Seals Available** (Auto-Evac Ward Active).`;

      itemLines = [
        `• **Legendary** — **Command Seals** ×3 — S Rank [RECHARGES 1 / 24H]`,
        `• **Rare** — **Mage Sanctuary Bounded Field** ×1 — A Rank [60% AMBUSH DEFENSE]`,
        `• **Rare** — **Homunculus Decoy** ×${(master as any).homunculusCount || 1} — A Rank [ABSORBS 100% DAMAGE]`,
        `• **Standard** — **Alarm Ward** ×1 — B Rank [EXPOSES INTRUDERS]`,
        `• **Standard** — **Bloodfort Drain Field** ×1 — B Rank [SIPHONS HP]`
      ];
      totalItems = 5;
    } else if (category === 'items') {
      title = `💎 ${master.username}'s Inventory — Vault & Currency`;
      equippedBanner = `✅ Current Balance: **${master.saintQuartz || 0} Saint Quartz 💎**`;

      itemLines = [
        `• **Mythic** — **Saint Quartz** ×${master.saintQuartz || 0} — EX Rank [GACHA SUMMON CURRENCY]`,
        `• **Legendary** — **Holy Grail Shards** ×${(master as any).grailShards || 1} — S Rank [ASCENSION CATALYST]`,
        `• **Rare** — **Mana Prisms** ×${(master as any).manaPrisms || 50} — A Rank [DA VINCI WORKSHOP]`
      ];
      totalItems = 3;
    }

    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    const currentPage = Math.min(Math.max(page, 1), totalPages);

    addMessage({
      id: getNextId('bot_inv_hub'),
      sender: 'bot',
      timestamp: 'Just now',
      embed: {
        title,
        description: `${equippedBanner}\n\n` + itemLines.join('\n'),
        color: '#38bdf8',
        footer: `Page ${currentPage}/${totalPages} • Select an item below, then press Equip or Read.`
      },
      components: {
        type: 'buttons',
        items: [
          { id: 'inv_cat_ces', label: 'Craft Essences', style: category === 'ces' ? 'primary' : 'secondary', emoji: '🛡️' },
          { id: 'inv_cat_servants', label: 'Servants', style: category === 'servants' ? 'primary' : 'secondary', emoji: '⚔️' },
          { id: 'inv_cat_seals', label: 'Seals & Wards', style: category === 'seals' ? 'primary' : 'secondary', emoji: '📜' },
          { id: 'inv_cat_items', label: 'Vault & Currency', style: category === 'items' ? 'primary' : 'secondary', emoji: '💎' },
          { id: 'inv_page_prev', label: 'Previous', style: 'secondary', emoji: '◀️' },
          { id: 'inv_page_next', label: 'Next', style: 'secondary', emoji: '▶️' },
          { id: 'inv_act_equip', label: 'Equip', style: 'success', emoji: '✅' },
          { id: 'inv_act_inspect', label: 'Read / Inspect', style: 'primary', emoji: '📖' },
          { id: 'inv_act_unequip', label: 'Unequip', style: 'danger', emoji: '❌' },
          { id: 'inv_quick_gacha', label: 'Gacha Vault', style: 'secondary', emoji: '🎲' },
          { id: 'inv_quick_stats', label: 'Battle Stats', style: 'secondary', emoji: '⚔️' }
        ]
      }
    });
  };

  // Button interaction handler
  const handleButtonClick = (btnId: string) => {
    if (btnId === 'btn_show_servants_list' || btnId === 'btn_back_servants_list') {
      handleCommand('/servants list');
    } else if (btnId.startsWith('inv_')) {
      if (btnId === 'inv_cat_ces') postInventoryHub('ces');
      else if (btnId === 'inv_cat_servants') postInventoryHub('servants');
      else if (btnId === 'inv_cat_seals') postInventoryHub('seals');
      else if (btnId === 'inv_cat_items') postInventoryHub('items');
      else if (btnId === 'inv_quick_gacha') handleCommand('/cegacha');
      else if (btnId === 'inv_quick_stats') handleCommand('/customise stats');
      else if (btnId === 'inv_act_equip') {
        const ownedCes = (master.craftEssences || []).filter(Boolean);
        const targetServantId = master.activeServantId || master.servants?.[0]?.id;
        if (targetServantId && ownedCes.length > 0) {
          const updatedServants = (master.servants || []).map(s => {
            if (s.id === targetServantId) {
              return { ...s, equippedCeId: ownedCes[0].id, equippedCe: ownedCes[0] };
            }
            return s;
          });
          onUpdateMaster({ ...master, servants: updatedServants });
          postInventoryHub('ces');
        }
      } else if (btnId === 'inv_act_unequip') {
        const targetServantId = master.activeServantId || master.servants?.[0]?.id;
        if (targetServantId) {
          const updatedServants = (master.servants || []).map(s => {
            if (s.id === targetServantId) {
              return { ...s, equippedCeId: undefined, equippedCe: undefined };
            }
            return s;
          });
          onUpdateMaster({ ...master, servants: updatedServants });
          postInventoryHub('ces');
        }
      } else if (btnId === 'inv_act_inspect') {
        const activeServant = master.servants?.find(s => s.id === master.activeServantId) || master.servants?.[0];
        if (activeServant?.equippedCe) {
          addMessage({
            id: getNextId('bot_ce_lore'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: `📖 Relic Lore: ${activeServant.equippedCe.name}`,
              description:
                `**Rarity:** ★${activeServant.equippedCe.rarity}\n` +
                `**Effect:** ${activeServant.equippedCe.effectText}\n` +
                `**Stats:** +${activeServant.equippedCe.atkBonus || 0} ATK / +${activeServant.equippedCe.hpBonus || 0} HP\n\n` +
                `*${activeServant.equippedCe.description || 'An ancient conceptual relic forged from hero memories.'}*`,
              color: '#38bdf8'
            }
          });
        }
      }
      return;
    } else if (btnId.startsWith('profile_')) {
      let currentWar = grailWar;
      let actionMsg = '';

      if (btnId === 'profile_ward_none') {
        const res = executeWarAction(currentWar, master.discordId, 'set_ward', 'none');
        currentWar = res.updatedWar;
        actionMsg = res.message;
        onUpdateGrailWar(currentWar);
      } else if (btnId === 'profile_ward_ward') {
        const res = executeWarAction(currentWar, master.discordId, 'set_ward', 'ward');
        currentWar = res.updatedWar;
        actionMsg = res.message;
        onUpdateGrailWar(currentWar);
      } else if (btnId === 'profile_ward_alarm') {
        const res = executeWarAction(currentWar, master.discordId, 'set_ward', 'alarm');
        currentWar = res.updatedWar;
        actionMsg = res.message;
        onUpdateGrailWar(currentWar);
      } else if (btnId === 'profile_toggle_evade') {
        const curMode = currentWar.participants[master.discordId]?.autoEvadeEnabled !== false ? 'off' : 'on';
        const res = executeWarAction(currentWar, master.discordId, 'toggle_evade', curMode);
        currentWar = res.updatedWar;
        actionMsg = res.message;
        onUpdateGrailWar(currentWar);
      } else if (btnId === 'profile_heal') {
        const res = executeWarAction(currentWar, master.discordId, 'rest_and_heal');
        currentWar = res.updatedWar;
        actionMsg = res.message;
        onUpdateGrailWar(currentWar);
      } else if (btnId === 'profile_refresh') {
        actionMsg = '🔄 Profile refreshed.';
      }

      postProfileEmbed(actionMsg);
      return;
    } else if (btnId.startsWith('view_servant_')) {
      const servantId = btnId.replace('view_servant_', '');
      const target = allThrone.find(s => s.id === servantId);
      if (target) {
        postServantFullProfile(target);
      }
    } else if (btnId.startsWith('view_np_')) {
      const servantId = btnId.replace('view_np_', '');
      const target = allThrone.find(s => s.id === servantId);
      if (target) {
        postNoblePhantasmCard(target);
      }
    } else if (btnId.startsWith('view_art_')) {
      const servantId = btnId.replace('view_art_', '');
      const target = allThrone.find(s => s.id === servantId);
      if (target) {
        postArtworkCard(target);
      }
    } else if (btnId === 'view_active_np') {
      const activeServant = master.servants?.find(s => s.id === master.activeServantId) || master.servants?.[0];
      if (activeServant) {
        postNoblePhantasmCard(activeServant.template);
      }
    } else if (btnId.startsWith('edit_servant_')) {
      const servantId = btnId.replace('edit_servant_', '');
      handleCommand(`/addservant edit ${servantId}`);
    } else if (btnId.startsWith('edit_hp_')) {
      const servantId = btnId.replace('edit_hp_', '');
      const target = allThrone.find(s => s.id === servantId);
      if (target) {
        const newHp = (target.baseHp || 14000) + 2000;
        const newAtk = (target.baseAtk || 11000) + 1500;
        handleCommand(`/addservant edit servant_id:"${target.id}" hp:${newHp} atk:${newAtk}`);
      }
    } else if (btnId.startsWith('edit_np_')) {
      const servantId = btnId.replace('edit_np_', '');
      const target = allThrone.find(s => s.id === servantId);
      if (target) {
        const nextCard: CardType = target.noblePhantasm.cardType === 'Buster' ? 'Arts' : target.noblePhantasm.cardType === 'Arts' ? 'Quick' : 'Buster';
        handleCommand(`/addservant edit servant_id:"${target.id}" np_card:"${nextCard}"`);
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

      if (btnId === 'duel_fate_kill' || btnId === 'duel_fate_spare') {
        const decision = btnId === 'duel_fate_kill' ? 'kill' : 'spare';
        const rivalMaster = activeDuel?.battle.player2.masterName || 'itsderpo';
        const rivalServantName = activeDuel?.battle.player2.name || 'Scáthach';

        const outcome = recordDuelOutcome(
          grailWar,
          master.username,
          rivalMaster,
          decision,
          activeChannel === 'public' ? 'holy-grail-war' : 'direct-messages',
          activeDuel?.battle.player1.currentHp,
          activeDuel?.battle.player2.currentHp
        );
        onUpdateGrailWar(outcome.updatedWar);

        // Grant winner rewards
        const updatedServants = master.servants.map(s => {
          if (s.id === activeServant?.id) {
            return {
              ...s,
              bondLevel: Math.min(10, (s.bondLevel || 1) + 1),
              availableStatPoints: (s.availableStatPoints || 0) + 2
            };
          }
          return s;
        });

        onUpdateMaster({
          ...master,
          servants: updatedServants,
          saintQuartz: master.saintQuartz + 3,
          grailWarWins: (master.grailWarWins || 0) + 1
        });

        const aliveMastersCount = Object.values(outcome.updatedWar.participants).filter(p => p.isAlive).length;

        if (decision === 'kill') {
          addMessage({
            id: getNextId('bot_duel_fate_exec'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '☠️ FATE SEALED — MASTER EXECUTED',
              description:
                `Master **${master.username}** has chosen to **EXECUTE** Master **${rivalMaster}**!\n\n` +
                `☠️ Master **${rivalMaster}** (${rivalServantName}) was dealt a lethal strike and has been **PERMANENTLY ELIMINATED** from the Holy Grail War.\n\n` +
                `👥 **Surviving Masters:** **${aliveMastersCount}/7** alive in Fuyuki City.\n\n` +
                `💰 **Master Rewards Claimed:**\n` +
                `• +3 Saint Quartz 💎\n` +
                `• +300 Bond EXP (+1 Bond Level) 💖\n` +
                `• +2 Parameter Points 📊`,
              color: '#ef4444',
              footer: outcome.updatedWar.status === 'concluded' ? '🏆 HOLY GRAIL WAR CONCLUDED!' : 'Holy Grail War State Updated'
            },
            components: {
              type: 'buttons',
              items: [
                { id: 'quick_war_status', label: 'View Intelligence Board (/grailwar)', style: 'primary', emoji: '📋' },
                { id: 'quick_start_duel', label: 'Challenge Next Master (/duel)', style: 'danger', emoji: '⚔️' }
              ]
            }
          });
        } else {
          addMessage({
            id: getNextId('bot_duel_fate_mercy'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '🕊️ MERCY BESTOWED — MASTER SPARED',
              description:
                `Master **${master.username}** has chosen to **SPARE** Master **${rivalMaster}**!\n\n` +
                `🕊️ You showed mercy in combat. Master **${rivalMaster}** clings to life on critical HP (**${outcome.defeatedMaster?.currentHp || 1000}/${outcome.defeatedMaster?.maxHp || 14820}**), but remains an active participant in the war.\n\n` +
                `💰 **Master Rewards Claimed:**\n` +
                `• +3 Saint Quartz 💎\n` +
                `• +300 Bond EXP (+1 Bond Level) 💖\n` +
                `• +2 Parameter Points 📊`,
              color: '#22c55e',
              footer: 'Holy Grail War State Updated'
            },
            components: {
              type: 'buttons',
              items: [
                { id: 'quick_war_status', label: 'View Intelligence Board (/grailwar)', style: 'primary', emoji: '📋' },
                { id: 'quick_start_duel', label: 'Challenge Next Master (/duel)', style: 'danger', emoji: '⚔️' }
              ]
            }
          });
        }
        setActiveDuel(null);
        return;
      }

      // Automatically delete previous NP GIF when a new action/turn is chosen
      cleanupActiveNpGif();

      let cards: CardType[] = ['Buster', 'Arts', 'Quick'];
      let useNp = false;

      if (btnId === 'duel_card_bbb') cards = ['Buster', 'Buster', 'Buster'];
      if (btnId === 'duel_card_aaa') cards = ['Arts', 'Arts', 'Arts'];
      if (btnId === 'duel_card_qqq') cards = ['Quick', 'Quick', 'Quick'];
      if (btnId === 'duel_use_np') useNp = true;

      const aiCards: CardType[] = ['Buster', 'Arts', 'Quick'];
      const aiNp = activeDuel.battle.player2.npGauge >= 100;

      // Dispatch Noble Phantasm Animated Cinematic GIF if player or AI unleashed NP (Full-Width Native Delivery)
      if (useNp) {
        const npActor = activeDuel.battle.player1;
        const npGif = getNoblePhantasmGif(npActor);
        const npChant = getNoblePhantasmChant(npActor);
        const npName = npActor.noblePhantasm?.name || 'Noble Phantasm';

        const npMsgId = getNextId('bot_duel_np_cinematic');
        const chantLine = npChant ? `\n> *“${npChant}”*` : '';

        addMessage({
          id: npMsgId,
          sender: 'bot',
          timestamp: 'Just now',
          content: 
            `## 💥 NOBLE PHANTASM UNLEASHED: **${npName.toUpperCase()}**\n` +
            `⚔️ **${npActor.name}** (Master: <@${master.discordId}>)${chantLine}\n\n` +
            `${npGif}`
        });

        activeNpMsgIdRef.current = npMsgId;
        // AFK safety timeout (60s fallback, dismissed earlier as soon as Master or Enemy acts)
        activeNpTimeoutRef.current = setTimeout(() => {
          setMessages(prev => prev.filter(m => m.id !== npMsgId));
          if (activeNpMsgIdRef.current === npMsgId) {
            activeNpMsgIdRef.current = null;
          }
        }, 60000);
      } else if (aiNp) {
        const aiActor = activeDuel.battle.player2;
        const aiNpGif = getNoblePhantasmGif(aiActor);
        const aiNpChant = getNoblePhantasmChant(aiActor);
        const aiNpName = aiActor.noblePhantasm?.name || 'Noble Phantasm';

        const aiNpMsgId = getNextId('bot_duel_ai_np_cinematic');
        const chantLine = aiNpChant ? `\n> *“${aiNpChant}”*` : '';

        addMessage({
          id: aiNpMsgId,
          sender: 'bot',
          timestamp: 'Just now',
          content: 
            `## 💥 ENEMY NOBLE PHANTASM: **${aiNpName.toUpperCase()}**\n` +
            `⚔️ **${aiActor.name}** (Master: ${aiActor.masterName})${chantLine}\n\n` +
            `${aiNpGif}`
        });

        activeNpMsgIdRef.current = aiNpMsgId;
        // AFK safety timeout (60s fallback)
        activeNpTimeoutRef.current = setTimeout(() => {
          setMessages(prev => prev.filter(m => m.id !== aiNpMsgId));
          if (activeNpMsgIdRef.current === aiNpMsgId) {
            activeNpMsgIdRef.current = null;
          }
        }, 60000);
      }

      const { updatedState, turnLogs } = executeBattleTurn(
        activeDuel.battle,
        { combatantId: activeDuel.battle.player1.id, selectedCards: cards, useNoblePhantasm: useNp },
        { combatantId: activeDuel.battle.player2.id, selectedCards: aiCards, useNoblePhantasm: aiNp }
      );

      const lastLog = turnLogs[turnLogs.length - 1];
      setActiveDuel({ battle: updatedState, lastLog });

      if (updatedState.turnPhase === 'victory' || updatedState.turnPhase === 'defeat') {
        // Retain finishing Noble Phantasm cinematic in chat log upon duel conclusion
        if (activeNpTimeoutRef.current) {
          clearTimeout(activeNpTimeoutRef.current);
          activeNpTimeoutRef.current = null;
        }
        activeNpMsgIdRef.current = null;

        const isWin = updatedState.turnPhase === 'victory';

        if (isWin) {
          // Player won: Prompt with Kill or Spare choice
          addMessage({
            id: getNextId('bot_duel_fate_prompt'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '🏆 DUEL VICTORY — DECIDE MASTER\'S FATE',
              description:
                `**${updatedState.player1.name}** (Master: ${master.username}) has defeated **${updatedState.player2.name}** (Master: ${updatedState.player2.masterName}) in the Holy Grail duel!\n\n` +
                `💬 *"A decisive clash. The enemy Master kneels before you."*\n\n` +
                `⚖️ **The Fate of Master ${updatedState.player2.masterName} is in your hands:**\n` +
                `Choose whether to **Execute** the fallen Master to permanently eliminate them from the Holy Grail War, or show mercy and **Spare** their life.`,
              color: '#22c55e',
              footer: 'Select an execution decision below:'
            },
            components: {
              type: 'buttons',
              items: [
                { id: 'duel_fate_kill', label: '☠️ Execute Master (Kill & Eliminate)', style: 'danger', emoji: '☠️' },
                { id: 'duel_fate_spare', label: '🕊️ Spare Master (Show Mercy)', style: 'success', emoji: '🕊️' }
              ]
            }
          });
        } else {
          // Player defeated by opponent (e.g. itsderpo)
          const outcome = recordDuelOutcome(
            grailWar,
            updatedState.player2.masterName,
            master.username,
            'kill',
            activeChannel === 'public' ? 'holy-grail-war' : 'direct-messages',
            updatedState.player2.currentHp,
            updatedState.player1.currentHp
          );
          onUpdateGrailWar(outcome.updatedWar);
          setActiveDuel(null);

          const aliveCount = Object.values(outcome.updatedWar.participants).filter(p => p.isAlive).length;

          addMessage({
            id: getNextId('bot_duel_defeat_exec'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '☠️ FATAL DUEL DEFEAT — MASTER ELIMINATED',
              description:
                `**${updatedState.player2.name}** (Master: ${updatedState.player2.masterName}) has struck down **${updatedState.player1.name}** (Master: ${master.username})!\n\n` +
                `💬 *"A duel in the Holy Grail War is fought to the death. Your contract has been severed."*\n\n` +
                `💀 **You have been PERMANENTLY ELIMINATED from the Holy Grail War.**\n` +
                `Your status on the Intelligence Board is now **💀 DECEASED** (HP: 0/${grailWar.participants[master.discordId]?.maxHp || 11000}).\n\n` +
                `👥 **Surviving Masters:** **${aliveCount}/7** alive in Fuyuki.`,
              color: '#ef4444',
              footer: 'You have been eliminated from the Holy Grail War tournament'
            },
            components: {
              type: 'buttons',
              items: [
                { id: 'quick_war_status', label: 'View Intelligence Board (/grailwar)', style: 'primary', emoji: '📋' },
                { id: 'war_reset_tournament', label: 'Restart Tournament Session', style: 'secondary', emoji: '🔄' }
              ]
            }
          });
        }
      } else {
        addMessage({
          id: getNextId('bot_duel_turn'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: `⚔️ TURN ${updatedState.currentTurn} CLASH SUMMARY`,
            description: `👉 **Current Turn:** Select your next Command Card sequence or Noble Phantasm:`,
            color: '#ef4444',
            footer: 'Holy Grail War • Turn-based RPG Combat Engine'
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
    } else if (btnId.startsWith('ward_') || btnId === 'toggle_auto_evade' || btnId === 'quick_war_defenses' || btnId === 'war_refresh_defenses') {
      if (btnId === 'quick_war_defenses') {
        handleCommand('/defenses');
        return;
      }

      let currentWar = grailWar;
      let actionMsg = '';

      if (btnId === 'ward_none') {
        const res = executeWarAction(currentWar, master.discordId, 'set_ward', 'none');
        currentWar = res.updatedWar;
        actionMsg = res.message;
        onUpdateGrailWar(currentWar);
      } else if (btnId === 'ward_ward') {
        const res = executeWarAction(currentWar, master.discordId, 'set_ward', 'ward');
        currentWar = res.updatedWar;
        actionMsg = res.message;
        onUpdateGrailWar(currentWar);
      } else if (btnId === 'ward_alarm') {
        const res = executeWarAction(currentWar, master.discordId, 'set_ward', 'alarm');
        currentWar = res.updatedWar;
        actionMsg = res.message;
        onUpdateGrailWar(currentWar);
      } else if (btnId === 'toggle_auto_evade') {
        const curMode = currentWar.participants[master.discordId]?.autoEvadeEnabled !== false ? 'off' : 'on';
        const res = executeWarAction(currentWar, master.discordId, 'toggle_evade', curMode);
        currentWar = res.updatedWar;
        actionMsg = res.message;
        onUpdateGrailWar(currentWar);
      } else if (btnId === 'church_enter') {
        const res = enterChurchSanctuary(currentWar, master.discordId);
        currentWar = res.updatedWar;
        actionMsg = res.message;
        onUpdateGrailWar(currentWar);
      } else if (btnId === 'church_leave') {
        const res = leaveChurchSanctuary(currentWar, master.discordId);
        currentWar = res.updatedWar;
        actionMsg = res.message;
        onUpdateGrailWar(currentWar);
      } else if (btnId === 'war_refresh_defenses') {
        actionMsg = '🔄 Settings refreshed.';
      }

      const uP = currentWar.participants[master.discordId];
      const wardType = uP?.boundedField || 'none';
      const evadeOn = uP?.autoEvadeEnabled !== false;
      const seals = uP?.commandSeals ?? 3;

      let wardDesc = '🚫 **No Active Wards:** Your workshop has no perimeter defenses.';
      if (wardType === 'ward') {
        wardDesc = '🛡️ **Mage\'s Sanctuary Bounded Field:** Absorbs & deflects **60% of incoming ambush damage**.';
      } else if (wardType === 'alarm') {
        wardDesc = '🚨 **Intrusion Alarm Trap:** Detects infiltrators, alerting you and dealing **3,000 retaliatory DMG**.';
      }

      let classPassive = 'None (Specializes in direct tactical matches)';
      const sClass = uP?.servantClass;
      if (sClass === 'Saber' || sClass === 'Archer' || sClass === 'Lancer') {
        classPassive = '👁️ **Instinct / Clairvoyance:** 35% chance to predict ambushes, parrying 80% damage and dealing 1,500 counter DMG.';
      } else if (sClass === 'Assassin') {
        classPassive = '🕶️ **Presence Concealment:** Completely immune to surprise ambushes. Nullifies strike & counters for 2,500 DMG!';
      } else if (sClass === 'Berserker') {
        classPassive = '❤️ **Battle Continuation (Guts):** Revives once with 25% Max HP if dealt a fatal blow.';
      }

      const inSanctuary = !!uP?.inSanctuary;

      addMessage({
        id: getNextId('bot_defenses_updated'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: '🏰 Mage Workshop Defenses Updated',
          description:
            `Master **${master.username}**'s Tactical Defense Headquarters\n\n` +
            (actionMsg ? `📢 **Action Outcome:**\n${actionMsg}\n\n` : '') +
            `🛡️ **Bounded Field Protocol:**\n${wardDesc}\n\n` +
            `⛪ **Fuyuki Church Sanctuary:**\n` +
            (inSanctuary
              ? `• **🕊️ ACTIVE ASYLUM:** Sheltered under Father Kotomine. 100% immune to all ambushes & attacks (cannot attack rivals).\n\n`
              : `• **⚔️ IN THE FIELD:** Active combatant in Holy Grail War territory.\n\n`) +
            `🔴 **Command Seal Emergency Evacuation:**\n` +
            (evadeOn
              ? `• **🟢 ENABLED:** When taking fatal ambush damage, consumes **1 Command Seal** to escape into shadows with **1 HP**.\n`
              : `• **🔴 DISABLED:** Fatal ambushes will eliminate your Servant normally without consuming a seal.\n`) +
            `• **Current Command Seals:** \`${'✦ '.repeat(seals)}${'✧ '.repeat(Math.max(0, 3 - seals))}\` (**${seals}/3** remaining)\n\n` +
            `👁️ **Servant Class Passive:**\n${classPassive}\n\n` +
            `*Settings saved to Holy Grail War Engine.*`,
          color: '#3b82f6',
          footer: 'Holy Grail War Defense Protocol'
        },
        components: {
          type: 'buttons',
          items: [
            {
              id: 'ward_none',
              label: 'No Wards',
              style: wardType === 'none' ? 'primary' : 'secondary',
              emoji: '🚫'
            },
            {
              id: 'ward_ward',
              label: 'Sanctuary (60% Block)',
              style: wardType === 'ward' ? 'success' : 'secondary',
              emoji: '🛡️'
            },
            {
              id: 'ward_alarm',
              label: 'Alarm Trap (3k DMG)',
              style: wardType === 'alarm' ? 'danger' : 'secondary',
              emoji: '🚨'
            },
            {
              id: inSanctuary ? 'church_leave' : 'church_enter',
              label: inSanctuary ? 'Leave Sanctuary 🚪' : 'Church Sanctuary ⛪',
              style: inSanctuary ? 'danger' : 'primary'
            },
            {
              id: 'toggle_auto_evade',
              label: evadeOn ? 'Auto-Evacuate: ON 🟢' : 'Auto-Evacuate: OFF 🔴',
              style: evadeOn ? 'success' : 'secondary'
            },
            {
              id: 'quick_war_status',
              label: 'War Board (/grailwar)',
              style: 'primary',
              emoji: '📋'
            }
          ]
        }
      });
      return;
    } else if (btnId.startsWith('war_')) {
      if (btnId === 'war_my_profile') {
        postProfileEmbed();
        return;
      }

      if (btnId === 'war_defenses') {
        handleCommand('/defenses');
        return;
      }

      if (btnId === 'war_patrol') {
        const chanTag = activeChannel === 'public' ? '#holy-grail-war' : '#general';
        const res = patrolCityInWar(grailWar, master.discordId, master.username, chanTag);
        onUpdateGrailWar(res.updatedWar);
        addMessage({
          id: getNextId('bot_patrol_res'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '👁️ Patrol Outcome — Fuyuki Surveillance',
            description: res.message,
            color: '#3b82f6',
            footer: 'Holy Grail War Patrol Protocol'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'quick_war_status', label: 'Check Status Board (/grailwar)', style: 'primary', emoji: '📋' },
              { id: 'war_patrol', label: 'Patrol Again', style: 'success', emoji: '👁️' }
            ]
          }
        });
        return;
      }

      if (btnId === 'war_refresh' || btnId === 'war_status_board') {
        handleCommand('/grailwar status');
        return;
      }

      if (btnId === 'war_attack_prompt') {
        setInputCommand('/grailwar attack ');
        return;
      }

      if (btnId === 'war_leak_prompt') {
        setInputCommand('/grailwar leak ');
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
        return;
      }

      if (btnId === 'war_familiars') {
        handleCommand('/familiars');
        return;
      }

      if (btnId === 'war_traps') {
        handleCommand('/traps');
        return;
      }

      if (btnId === 'dispatch_familiar_raven') {
        handleCommand('/familiar raven');
        return;
      }

      if (btnId === 'dispatch_familiar_homunculus') {
        handleCommand('/familiar homunculus');
        return;
      }

      if (btnId === 'dispatch_familiar_shadow_imp') {
        handleCommand('/familiar shadow_imp');
        return;
      }

      if (btnId === 'recall_all_familiars') {
        handleCommand('/familiar recall');
        return;
      }

      if (btnId === 'trap_channel_alarm') {
        handleCommand('/trap alarm');
        return;
      }

      if (btnId === 'trap_channel_drain') {
        handleCommand('/trap drain');
        return;
      }

      if (btnId === 'disarm_all_traps') {
        handleCommand('/trap disarm');
        return;
      }

      if (btnId === 'war_reset_tournament') {
        const newWar = createHolyGrailWarSession({
          discordId: master.discordId,
          username: master.username,
          servantId: activeServant?.templateId || 'artoria_pendragon_saber',
          servantName: activeServant?.template.name || 'Artoria Pendragon',
          servantClass: activeServant?.template.servantClass || 'Saber',
          avatarUrl: master.avatarUrl,
          maxHp: activeServant ? calculateServantMaxHp(activeServant) : 15000
        });
        onUpdateGrailWar(newWar);
        addMessage({
          id: getNextId('bot_war_reset_btn'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '🔄 Holy Grail War Session Reset',
            description:
              `A brand new **7-Master Fuyuki Holy Grail War** has been initiated!\n\n` +
              `All 7 Master-Servant contracts are restored to life with full HP in the shadows. Step into the war with honor!`,
            color: '#3b82f6'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'quick_war_status', label: 'View Intelligence Board (/grailwar)', style: 'primary', emoji: '📋' },
              { id: 'quick_start_duel', label: 'Initiate Duel (/duel)', style: 'danger', emoji: '⚔️' }
            ]
          }
        });
        return;
      }
      if (btnId === 'church_enter' || btnId === 'church_leave') {
        const uP = grailWar.participants[master.discordId] ||
          Object.values(grailWar.participants).find(p => p.username.toLowerCase() === master.username.toLowerCase());
        if (!uP) return;

        if (btnId === 'church_enter') {
          const res = enterChurchSanctuary(grailWar, uP.discordId);
          onUpdateGrailWar(res.updatedWar);
          addMessage({
            id: getNextId('bot_church_btn_res'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: res.success ? '⛪ Fuyuki Church Asylum Granted' : '⚠️ Asylum Notice',
              description: res.message,
              color: res.success ? '#10b981' : '#f59e0b'
            },
            components: {
              type: 'buttons',
              items: [
                { id: 'church_leave', label: 'Leave Sanctuary 🚪', style: 'danger' },
                { id: 'quick_war_defenses', label: 'Mage Defenses 🏰', style: 'secondary' }
              ]
            }
          });
        } else {
          const res = leaveChurchSanctuary(grailWar, uP.discordId);
          onUpdateGrailWar(res.updatedWar);
          addMessage({
            id: getNextId('bot_church_btn_res'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: res.success ? '⚔️ Departed Fuyuki Church Sanctuary' : '⚠️ Departure Notice',
              description: res.message,
              color: res.success ? '#3b82f6' : '#f59e0b'
            },
            components: {
              type: 'buttons',
              items: [
                { id: 'church_enter', label: 'Enter Church Sanctuary ⛪', style: 'primary' },
                { id: 'quick_war_defenses', label: 'Mage Defenses 🏰', style: 'secondary' }
              ]
            }
          });
        }
        return;
      }

      if (btnId === 'boast_servant_summon' || btnId === 'boast_servant_profile' || btnId === 'boast_ce_pull') {
        const updatedParticipants = { ...grailWar.participants };
        const key = Object.keys(updatedParticipants).find(
          k => k === master.discordId || updatedParticipants[k].username.toLowerCase() === master.username.toLowerCase()
        );
        if (key) {
          updatedParticipants[key] = {
            ...updatedParticipants[key],
            isExposed: true,
            exposureReason: 'public_command'
          };
          onUpdateGrailWar({
            ...grailWar,
            participants: updatedParticipants
          });
        }

        const s = master.servants?.[0];
        const sName = s?.nickname || s?.template?.name || 'Heroic Spirit';
        const sClass = s?.template?.servantClass || 'Saber';
        const userP = key ? updatedParticipants[key] : undefined;

        let title = `📢 MASTER ANNOUNCEMENT: ${master.username.toUpperCase()} REVEALS HEROIC SPIRIT!`;
        let desc = `Master **${master.username}** has chosen to boast their Servant's true parameters to the entire server!\n\n` +
          `⚔️ **Servant:** **${sName}** (\`${sClass}\`)\n` +
          `• **Noble Phantasm:** **${s?.template?.noblePhantasm?.name || 'Sacred Phantasm'}**\n` +
          `• **Current Status:** HP: ${userP?.currentHp?.toLocaleString() || '30,000'}/${userP?.maxHp?.toLocaleString() || '30,000'}\n\n` +
          `⚠️ *Master **${master.username}** has cast aside concealment and is now permanently **EXPOSED** on the Holy Grail War Board (\`/grailwar\`)! Rivals may now target them freely.*`;

        if (btnId === 'boast_ce_pull') {
          title = `📢 MASTER ANNOUNCEMENT: ${master.username.toUpperCase()} FORGES CRAFT ESSENCE!`;
          desc = `Master **${master.username}** has broadcasted their sacred relic forges to the entire server!\n\n` +
            `⚠️ *Master **${master.username}** has cast aside concealment and is now permanently **EXPOSED** on the Holy Grail War Board (\`/grailwar\`)!*`;
        }

        addMessage({
          id: getNextId('bot_boast_announcement'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title,
            description: desc,
            color: '#ef4444',
            thumbnailUrl: s?.template?.avatarUrl,
            footer: 'Public Identity Broadcast • Master Permanently Exposed'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'quick_war_status', label: 'View War Board (/grailwar)', style: 'primary', emoji: '📋' }
            ]
          }
        });
        return;
      }
    }
  };

  const userParticipant = grailWar.participants[master.discordId];
  const isUserExposed = userParticipant?.isExposed;
  const isUserInSanctuary = userParticipant?.inSanctuary;

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
          {/* Sanctuary Badge */}
          {isUserInSanctuary && (
            <div className="px-2.5 py-1 text-[11px] font-mono font-medium rounded-sm bg-[#064e3b] text-[#34d399] border border-[#34d399]/40 flex items-center gap-1">
              <span>⛪ Sanctuary</span>
            </div>
          )}

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

              {/* Message Content & Full-Width Native Media Unfurling (Discord Edge-to-Edge) */}
              {msg.content && (() => {
                const urlRegex = /(https?:\/\/[^\s]+)/g;
                const urls = msg.content.match(urlRegex) || [];
                const mediaUrl = urls.find(u =>
                  u.includes('giphy.com') ||
                  u.includes('tenor.com') ||
                  u.includes('.gif') ||
                  u.includes('.mp4') ||
                  u.includes('.png') ||
                  u.includes('.jpg') ||
                  u.includes('.webp') ||
                  u.includes('imgur.com') ||
                  u.includes('klipy.com')
                );

                return (
                  <div className="space-y-2 mt-1.5">
                    <div className="text-white/90 text-xs whitespace-pre-wrap leading-relaxed font-sans">
                      {msg.content}
                    </div>
                    {mediaUrl && !msg.embed && (
                      <div className="mt-2 max-w-[650px] w-full">
                        <NativeMediaVisual url={mediaUrl} />
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Discord Embed */}
              {msg.embed && (
                <div
                  className="mt-2.5 p-4 rounded-sm bg-[#111] border-l-2 text-[#dbdee1] max-w-3xl border border-y-[#1a1a1a] border-r-[#1a1a1a]"
                  style={{ borderLeftColor: msg.embed.color || '#d4af37' }}
                >
                  <h4 className="font-serif italic text-white text-base mb-1.5">{msg.embed.title}</h4>
                  <div className="whitespace-pre-wrap text-xs text-white/80 leading-relaxed font-mono">
                    {msg.embed.description}
                  </div>

                  {/* Embed Image / GIF */}
                  {(msg.embed.imageUrl || msg.embed.thumbnailUrl) && (
                    <EmbedVisual url={msg.embed.imageUrl || msg.embed.thumbnailUrl || ''} />
                  )}

                  {msg.embed.footer && (
                    <div className="text-[10px] font-mono text-white/40 mt-2.5 pt-2 border-t border-[#1a1a1a]">
                      {msg.embed.footer}
                    </div>
                  )}
                </div>
              )}

              {/* Dynamic Canvas Image Output (Discord Standalone File Attachment - Outside Embed) */}
              {msg.canvasType && (
                <div className="mt-2.5 rounded-lg overflow-hidden border border-[#26282d] bg-[#0c0d0e] max-w-[550px] w-full shadow-xl">
                  <CanvasRenderer canvasType={msg.canvasType} payload={msg.canvasPayload} />
                </div>
              )}

              {/* Full Artwork Embed Page */}
              {msg.artworkEmbed && msg.artworkEmbed.imageUrl && (
                <div
                  className="mt-3 p-3.5 rounded-sm bg-[#0e0e0e] border-l-2 text-[#dbdee1] max-w-2xl border border-y-[#1a1a1a] border-r-[#1a1a1a] shadow-xl space-y-2.5"
                  style={{ borderLeftColor: msg.artworkEmbed.color || '#d4af37' }}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-serif italic text-white text-base">
                      {msg.artworkEmbed.title || '🖼️ Servant Artwork & Character Portrait'}
                    </h4>
                    <span className="text-[10px] font-mono text-[#d4af37] bg-[#161616] px-2 py-0.5 rounded border border-[#d4af37]/30">
                      Heroic Spirit Portrait
                    </span>
                  </div>
                  {msg.artworkEmbed.description && (
                    <div className="whitespace-pre-wrap text-xs text-white/80 leading-relaxed font-mono">
                      {msg.artworkEmbed.description}
                    </div>
                  )}
                  <div className="rounded-md overflow-hidden border border-[#222] bg-[#050505] max-w-xl shadow-inner">
                    <img
                      src={msg.artworkEmbed.imageUrl}
                      alt="Servant Artwork"
                      className="w-full h-auto object-contain max-h-[550px]"
                      referrerPolicy="no-referrer"
                      onError={(e: any) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
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

      {/* Servant Picker Modal Dialog */}
      {showServantPickerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-[#0d0d0d] border border-[#d4af37]/40 rounded-xl shadow-2xl p-5 space-y-4 max-h-[85vh] flex flex-col font-mono">
            <div className="flex items-center justify-between border-b border-[#222] pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#d4af37]" />
                <h3 className="text-sm font-bold text-white font-serif tracking-wider">
                  Throne of Heroes — Quick Servant Codex
                </h3>
              </div>
              <button
                onClick={() => setShowServantPickerModal(false)}
                className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Search & Filter */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={servantPickerSearch}
                  onChange={e => setServantPickerSearch(e.target.value)}
                  placeholder="Filter spirits by name, class, NP, or lore..."
                  className="w-full pl-9 pr-3 py-2 bg-[#141414] border border-[#262626] focus:border-[#d4af37] rounded-lg text-xs text-white outline-none"
                  autoFocus
                />
              </div>

              {/* Class Filter Chips */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
                {(['all', 'Saber', 'Archer', 'Lancer', 'Ruler', 'Berserker', 'Assassin', 'Caster', 'Rider'] as const).map(cls => (
                  <button
                    key={cls}
                    onClick={() => setServantPickerClass(cls)}
                    className={`px-2.5 py-0.5 rounded whitespace-nowrap transition ${
                      servantPickerClass === cls
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-[#181818] hover:bg-[#222] text-white/60 hover:text-white border border-[#2a2a2a]'
                    }`}
                  >
                    {cls === 'all' ? 'All Classes' : cls}
                  </button>
                ))}
              </div>
            </div>

            {/* Servant List Grid */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-96">
              {allThrone
                .filter(s => {
                  if (servantPickerClass !== 'all' && s.servantClass !== servantPickerClass) return false;
                  if (!servantPickerSearch.trim()) return true;
                  const q = servantPickerSearch.toLowerCase().trim();
                  return (
                    s.name.toLowerCase().includes(q) ||
                    s.servantClass.toLowerCase().includes(q) ||
                    s.title.toLowerCase().includes(q) ||
                    s.noblePhantasm.name.toLowerCase().includes(q)
                  );
                })
                .map(s => (
                  <div
                    key={s.id}
                    className="p-2.5 bg-[#121212] hover:bg-[#181818] border border-[#222] hover:border-[#d4af37]/40 rounded-lg flex items-center justify-between gap-3 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded overflow-hidden bg-black border border-white/10 flex-shrink-0">
                        <img
                          src={s.avatarUrl || s.cardArtUrl}
                          alt={s.name}
                          className="w-full h-full object-cover object-top"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white flex items-center gap-2 truncate">
                          <span>{s.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 bg-white/10 text-[#d4af37] rounded">
                            {s.servantClass} ★{s.rarity}
                          </span>
                          {s.isCustomOrMeme && (
                            <span className="text-[9px] px-1 bg-purple-900/60 text-purple-300 border border-purple-500/30 rounded">
                              Custom
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-white/50 truncate">
                          NP: {s.noblePhantasm.name} ({s.noblePhantasm.cardType})
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => {
                          setShowServantPickerModal(false);
                          handleCommand(`/servants view ${s.name}`);
                        }}
                        className="px-2.5 py-1 text-[11px] bg-[#d4af37] hover:bg-[#c49f27] text-black font-bold rounded transition"
                      >
                        View Profile
                      </button>
                      <button
                        onClick={() => {
                          setShowServantPickerModal(false);
                          handleCommand(`/addservant edit ${s.name}`);
                        }}
                        className="px-2 py-1 text-[11px] bg-purple-900/50 hover:bg-purple-900/80 text-purple-200 border border-purple-500/40 rounded transition"
                        title="Edit stats, image, or voice dialogue"
                      >
                        Edit ✏️
                      </button>
                      <button
                        onClick={() => {
                          setShowServantPickerModal(false);
                          handleCommand(`/duel ${s.name}`);
                        }}
                        className="px-2.5 py-1 text-[11px] bg-red-900/40 hover:bg-red-900/70 text-red-300 border border-red-500/40 rounded transition"
                      >
                        Duel ⚔️
                      </button>
                      <button
                        onClick={() => {
                          setShowServantPickerModal(false);
                          setInputCommand(`/servant ${s.name}`);
                        }}
                        className="px-2 py-1 text-[11px] bg-white/10 hover:bg-white/20 text-white/80 rounded transition"
                        title="Insert into input box"
                      >
                        Insert
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            <div className="pt-2 border-t border-[#222] flex items-center justify-between text-[11px] text-white/40">
              <span>{allThrone.length} Total Heroic Spirits registered</span>
              <button
                onClick={() => {
                  setShowServantPickerModal(false);
                  handleCommand('/servants list');
                }}
                className="text-[#d4af37] hover:underline"
              >
                Output Full List to Chat (/servants list) ↗
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discord Input Bar */}
      <div className="p-3 bg-[#111] border-t border-[#1a1a1a] relative">
        {/* Live Autocomplete Suggestions Overlay */}
        {isInputFocused && inputCommand.trim().length > 0 && (
          <div className="absolute left-3 right-3 bottom-full mb-2 bg-[#0d0d0d] border border-[#d4af37]/40 rounded-xl shadow-2xl z-40 max-h-80 overflow-y-auto p-2 font-mono divide-y divide-white/5 animate-in fade-in slide-in-from-bottom-2 duration-150">
            {/* Matching Slash Commands */}
            {(() => {
              const q = inputCommand.toLowerCase().trim();
              const isEditing = q.startsWith('/addservant edit') || q.startsWith('/addservant');
              const slashCommands = [
                { cmd: '/servants list', desc: 'Browse all registered spirits in the Throne' },
                { cmd: '/servants search <name>', desc: 'Search spirits by name, class, NP, or lore' },
                { cmd: '/servant <name>', desc: 'Inspect servant profile card & voice dialogue' },
                { cmd: '/summon ritual', desc: 'Perform Holy Grail War summoning ritual' },
                { cmd: '/duel <name>', desc: 'Enter combat encounter with a rival Master/Servant' },
                { cmd: '/admin npanim <servant> <gif_url>', desc: 'Configure custom NP animated GIF (Admin)' },
                { cmd: '/admin npsettings', desc: 'Configure NP auto-delete and turn duration settings' },
                { cmd: '/grailwar status', desc: 'Check Holy Grail War battlefield & intelligence' },
                { cmd: '/grailwar attack', desc: 'Ambush suspected rival Master' },
                { cmd: '/grailwar leak', desc: 'Broadcast intel to the war board' },
                { cmd: '/addservant edit <name>', desc: 'Modify stats, dialogue, or artwork of any servant' },
                { cmd: '/addservant create', desc: 'Register a new custom Heroic Spirit' },
                { cmd: '/defenses', desc: 'Check active boundary warding fields' },
                { cmd: '/profile', desc: 'View Master status and command seals' }
              ].filter(c => c.cmd.toLowerCase().includes(q) || q.startsWith(c.cmd.split(' ')[0]));

              const searchClean = q
                .replace(/\/addservant\s*(edit|delete|create)?/gi, '')
                .replace(/\/servants?\s*(search|view|list)?/gi, '')
                .replace(/\/duel/gi, '')
                .replace(/servant_id[:=]/gi, '')
                .replace(/[\/]/g, '')
                .trim();

              const spiritMatches = allThrone.filter(s => {
                if (!searchClean) {
                  return isEditing; // If typing /addservant edit without args, show top spirits to edit
                }
                return matchServantSearch(s, searchClean);
              }).slice(0, 6);

              return (
                <div className="space-y-2">
                  {spiritMatches.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2 py-0.5 text-[10px] text-[#d4af37] font-bold uppercase tracking-wider flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Matching Heroic Spirits:
                      </div>
                      {spiritMatches.map(s => (
                        <div
                          key={s.id}
                          className="p-1.5 hover:bg-white/10 rounded-lg flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded overflow-hidden bg-black/40 border border-white/10 flex-shrink-0">
                              <img src={s.avatarUrl || s.cardArtUrl} alt={s.name} className="w-full h-full object-cover object-top" referrerPolicy="no-referrer" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-white truncate">{s.name}</span>
                              <span className="ml-1.5 text-[10px] text-white/50">({s.servantClass} ★{s.rarity})</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {isEditing && (
                              <button
                                onMouseDown={e => {
                                  e.preventDefault();
                                  handleCommand(`/addservant edit ${s.name}`);
                                  setInputCommand('');
                                  setIsInputFocused(false);
                                }}
                                className="px-2 py-0.5 bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-500/40 text-[10px] rounded font-bold"
                              >
                                Edit ✏️
                              </button>
                            )}
                            <button
                              onMouseDown={e => {
                                e.preventDefault();
                                handleCommand(`/servants view ${s.name}`);
                                setInputCommand('');
                                setIsInputFocused(false);
                              }}
                              className="px-2 py-0.5 bg-[#d4af37] text-black font-bold text-[10px] rounded hover:bg-[#c49f27]"
                            >
                              View Card
                            </button>
                            <button
                              onMouseDown={e => {
                                e.preventDefault();
                                handleCommand(`/duel ${s.name}`);
                                setInputCommand('');
                                setIsInputFocused(false);
                              }}
                              className="px-2 py-0.5 bg-red-900/60 text-red-200 text-[10px] rounded hover:bg-red-800"
                            >
                              Duel
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {slashCommands.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="px-2 py-0.5 text-[10px] text-white/40 font-bold uppercase tracking-wider">
                        Suggested Commands:
                      </div>
                      {slashCommands.slice(0, 4).map(c => (
                        <button
                          key={c.cmd}
                          onMouseDown={e => {
                            e.preventDefault();
                            if (c.cmd.includes('<')) {
                              setInputCommand(c.cmd.split('<')[0]);
                            } else {
                              handleCommand(c.cmd);
                              setInputCommand('');
                            }
                            setIsInputFocused(false);
                          }}
                          className="w-full p-1.5 hover:bg-white/10 rounded-lg flex items-center justify-between text-left transition"
                        >
                          <span className="text-xs text-[#d4af37] font-bold">{c.cmd}</span>
                          <span className="text-[10px] text-white/50">{c.desc}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Input Bar Row */}
        <div className="flex items-center gap-2 bg-[#0a0a0a] rounded-sm px-3 py-2 border border-[#1a1a1a] focus-within:border-[#d4af37]">
          <div className="text-white/40 font-mono text-xs">/</div>
          <input
            type="text"
            value={inputCommand}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setTimeout(() => setIsInputFocused(false), 200)}
            onChange={e => setInputCommand(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && inputCommand.trim()) {
                handleCommand(inputCommand);
                setInputCommand('');
              }
            }}
            placeholder="Type /servant <name>, /duel, /summon ritual, /servants search..."
            className="flex-1 bg-transparent text-white font-mono text-xs outline-none placeholder-white/30"
          />

          {/* Quick Servant Picker Button */}
          <button
            onClick={() => setShowServantPickerModal(true)}
            title="Open Throne of Heroes Servant Selector"
            className="px-2 py-1 rounded bg-[#181818] hover:bg-[#252525] text-[#d4af37] border border-[#d4af37]/40 text-xs font-mono flex items-center gap-1 transition"
          >
            <Zap className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">Pick Servant</span>
          </button>

          <button
            onClick={() => {
              if (inputCommand.trim()) {
                handleCommand(inputCommand);
                setInputCommand('');
              }
            }}
            disabled={!inputCommand.trim()}
            className="p-1.5 rounded-sm bg-[#d4af37] hover:bg-[#c49f27] text-black disabled:opacity-30 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Command & Servant Quick Suggestions */}
        <div className="flex items-center gap-1.5 mt-2 px-1 text-[10px] font-mono text-white/50 overflow-x-auto pb-1 scrollbar-thin">
          <span className="text-[#d4af37] font-semibold flex items-center gap-1 flex-shrink-0">
            <Zap className="w-3 h-3" /> Quick:
          </span>
          <button
            onClick={() => handleCommand('/servants list')}
            className="px-2 py-0.5 rounded bg-[#161616] hover:bg-[#252525] text-[#d4af37] border border-[#d4af37]/30 whitespace-nowrap transition"
          >
            📜 /servants list
          </button>

          {/* Direct Servant Quick Buttons */}
          {allThrone.map(s => (
            <button
              key={s.id}
              onClick={() => handleCommand(`/servants view ${s.name}`)}
              className="px-2 py-0.5 rounded bg-[#141414] hover:bg-[#222] hover:text-white text-white/70 border border-[#262626] whitespace-nowrap transition"
            >
              {s.name}
            </button>
          ))}

          <button
            onClick={() => handleCommand('/summon ritual')}
            className="px-2 py-0.5 rounded bg-[#141414] hover:bg-[#222] text-amber-300 border border-amber-500/30 whitespace-nowrap transition"
          >
            ✨ /summon ritual
          </button>
          <button
            onClick={() => handleCommand('/duel')}
            className="px-2 py-0.5 rounded bg-[#141414] hover:bg-[#222] text-red-300 border border-red-500/30 whitespace-nowrap transition"
          >
            ⚔️ /duel
          </button>
          <button
            onClick={() => handleCommand('/grailwar')}
            className="px-2 py-0.5 rounded bg-[#141414] hover:bg-[#222] text-blue-300 border border-blue-500/30 whitespace-nowrap transition"
          >
            🏆 /grailwar
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

  return <canvas ref={canvasRef} className="w-full h-auto rounded block" />;
}
