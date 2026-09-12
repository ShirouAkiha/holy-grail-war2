'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { CanvasRenderer } from './CanvasRenderer';
import {
  MasterProfile,
  CardType,
  ActiveCombatant,
  CombatTurnLog,
  HolyGrailWarSession,
  ServantTemplate,
  MasterServantInstance,
  ServantClass,
  BattleState,
  CraftEssence
} from '../lib/types';
import { SERVANT_DATABASE, getDefaultClassPassives, getServantAvatarAndCardArt } from '../lib/data/servants';
import { getAllThroneServants, saveCustomServantsToStorage } from '../lib/state/gameState';
import { getNoblePhantasmGif, getNoblePhantasmChant, setCustomNpAnimationInMemory, setCustomNpAnimationsBatch } from '../lib/data/noblePhantasmGifs';
import { normalizeMediaUrl } from '../lib/utils/mediaResolver';
import { findServantInPool, matchServantSearch } from '../lib/utils/servantMatcher';
import {
  createCombatantFromMasterServant,
  initializeBattle,
  initializeMultiBattle,
  executeBattleTurn,
  calculateFleeChance,
  rollFleeSuccess,
  applyCombatantSkill,
  forceJoinBattle
} from '../lib/engine/battle';
import {
  allocateStatPoints,
  equipCraftEssence,
  feedCraftEssences,
  getCeExpValue,
  calculateLevelFromExp,
  getTotalExpForLevel
} from '../lib/engine/customization';
import { executeCraftEssenceGachaRoll } from '../lib/engine/ceGacha';
import { CRAFT_ESSENCE_DATABASE } from '../lib/data/craftEssences';
import MASTERS_DATABASE from '../data/masters.json';
import {
  renderServantProfileCard,
  renderDialogueCard,
  renderDefeatDialogueCard,
  renderBattleTurnSummary
} from '../lib/canvas/browserCanvas';
import { getServantChainDialogue, getServantDefeatDialogue } from '@/src/engine/dialogue';
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
  setWorkshopWardInWar,
  dispatchFamiliarInWar,
  recallFamiliarsInWar,
  enterChurchSanctuary,
  leaveChurchSanctuary,
  checkAndTriggerChannelTraps,
  getReputationInfo
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

function getTimestampNow(): number {
  return Date.now();
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
  canvasType?: 'servant' | 'dialogue' | 'battle' | 'defeat_dialogue' | 'gacha';
  canvasPayload?: any;
  artworkEmbed?: {
    title?: string;
    description?: string;
    imageUrl?: string;
    color?: string;
  };
  components?: {
    type: 'buttons' | 'select' | 'list_menu';
    placeholder?: string;
    selectOptions?: Array<{
      value: string;
      label: string;
      description?: string;
      emoji?: string;
    }>;
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

function calculateDailyClaimCooldown(lastDailyClaim?: number | string | Date, currentSq: number = 0) {
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const lastClaim = typeof lastDailyClaim === 'number'
    ? lastDailyClaim
    : typeof lastDailyClaim === 'string'
      ? new Date(lastDailyClaim).getTime()
      : 0;

  const timeSinceLastClaim = now - lastClaim;
  if (lastClaim > 0 && timeSinceLastClaim < ONE_DAY_MS) {
    const remainingMs = ONE_DAY_MS - timeSinceLastClaim;
    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
    const formattedCooldown = `${hours}h ${minutes}m ${seconds}s`;
    const nextClaimTs = Math.floor((now + remainingMs) / 1000);
    return {
      canClaim: false as const,
      formattedCooldown,
      nextClaimTs,
      remainingMs,
      currentSq
    };
  }

  return {
    canClaim: true as const,
    now,
    nextClaimTs: Math.floor((now + ONE_DAY_MS) / 1000),
    prevSq: currentSq,
    newSq: currentSq + 30
  };
}

export const FUYUKI_SECTORS = [
  { id: '#holy-grail-war', name: 'holy-grail-war', label: 'Central Front', emoji: '⛩️', desc: 'Central War Front' },
  { id: '#mount-enzo', name: 'mount-enzo', label: 'Mt. Enzo', emoji: '⛰️', desc: 'Ryuudou Temple Leylines' },
  { id: '#shinto-district', name: 'shinto-district', label: 'Shinto District', emoji: '🏙️', desc: 'Commercial District' },
  { id: '#miyama-town', name: 'miyama-town', label: 'Miyama Town', emoji: '🏡', desc: 'Residential Sector' },
  { id: '#fuyuki-bridge', name: 'fuyuki-bridge', label: 'Fuyuki Bridge', emoji: '🌉', desc: 'Strategic River Chokepoint' },
  { id: '#church-grounds', name: 'church-grounds', label: 'Church Grounds', emoji: '⛪', desc: 'Outer Sanctuary Perimeter' },
  { id: '#general', name: 'general', label: 'General Sector', emoji: '💬', desc: 'Civilian District' }
] as const;

let _globalMsgCounter = 100;
function getNextId(prefix: string): string {
  _globalMsgCounter += 1;
  return `${prefix}_${_globalMsgCounter}`;
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
  const [activePublicSector, setActivePublicSector] = useState<string>('#holy-grail-war');
  const [serverChannels, setServerChannels] = useState<Array<{ id: string; name: string; label: string; emoji: string; desc: string }>>([
    { id: '#holy-grail-war', name: 'holy-grail-war', label: 'Central Front', emoji: '⛩️', desc: 'Central War Front' },
    { id: '#mount-enzo', name: 'mount-enzo', label: 'Mt. Enzo', emoji: '⛰️', desc: 'Ryuudou Temple Leylines' },
    { id: '#shinto-district', name: 'shinto-district', label: 'Shinto District', emoji: '🏙️', desc: 'Commercial District' },
    { id: '#miyama-town', name: 'miyama-town', label: 'Miyama Town', emoji: '🏡', desc: 'Residential Sector' },
    { id: '#fuyuki-bridge', name: 'fuyuki-bridge', label: 'Fuyuki Bridge', emoji: '🌉', desc: 'Strategic River Chokepoint' },
    { id: '#church-grounds', name: 'church-grounds', label: 'Church Grounds', emoji: '⛪', desc: 'Outer Sanctuary Perimeter' },
    { id: '#general', name: 'general', label: 'General Sector', emoji: '💬', desc: 'Civilian District' }
  ]);
  const [showAddChannelModal, setShowAddChannelModal] = useState(false);
  const [newChannelNameInput, setNewChannelNameInput] = useState('');
  const [showTrapsMenuModal, setShowTrapsMenuModal] = useState(false);
  const [modalTrapChannel, setModalTrapChannel] = useState<string>('#holy-grail-war');
  const [modalTrapType, setModalTrapType] = useState<'alarm' | 'bloodfort'>('alarm');
  const [modalCustomChannel, setModalCustomChannel] = useState<string>('');

  const effectiveChannels = useMemo(() => {
    const list = [...serverChannels];
    (grailWar.channelTraps || []).forEach(t => {
      if (!list.some(c => c.id.toLowerCase() === t.channelName.toLowerCase())) {
        const clean = t.channelName.replace(/^#/, '');
        list.push({
          id: t.channelName,
          name: clean,
          label: clean,
          emoji: '💬',
          desc: 'Discord Text Channel'
        });
      }
    });
    return list;
  }, [serverChannels, grailWar.channelTraps]);

  const handleAddCustomChannel = () => {
    const clean = newChannelNameInput.trim().toLowerCase().replace(/^#/, '');
    if (!clean) return;
    const channelId = `#${clean}`;
    if (!serverChannels.some(c => c.id.toLowerCase() === channelId)) {
      setServerChannels(prev => [
        ...prev,
        {
          id: channelId,
          name: clean,
          label: clean,
          emoji: '💬',
          desc: 'Discord Text Channel'
        }
      ]);
    }
    setActivePublicSector(channelId);
    setShowAddChannelModal(false);
    setNewChannelNameInput('');
    addMessage({
      id: getNextId('channel_added'),
      sender: 'bot',
      timestamp: 'Just now',
      embed: {
        title: `📍 Channel Connected: ${channelId}`,
        description: `Added actual Discord channel **${channelId}** to the active war theater.\nYou are now switched to this channel. You can conceal Bounded Field traps, dispatch scouts, or send commands here.`,
        color: '#d4af37'
      }
    });
  };

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
          '• `/daily` — Claim 30 Saint Quartz (SQ) daily allowance\n' +
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
          { id: 'quick_daily_claim', label: 'Claim Daily (30 SQ)', style: 'success', emoji: '💎' },
          { id: 'quick_war_status', label: 'Intelligence Board (/grailwar)', style: 'secondary', emoji: '🏆' },
          { id: 'war_attack_prompt', label: 'Ambush Suspect (/grailwar attack)', style: 'danger', emoji: '⚔️' },
          { id: 'quick_summon_ritual', label: 'Summoning Ritual', style: 'primary', emoji: '✨' }
        ]
      }
    }
  ]);
  const [invCategory, setInvCategory] = useState<'ces' | 'servants' | 'feed' | 'seals' | 'items'>('ces');
  const [invPage, setInvPage] = useState<number>(1);
  const [invSelectedCeId, setInvSelectedCeId] = useState<string | null>(null);
  const [invSelectedServantId, setInvSelectedServantId] = useState<string | null>(null);
  const [gachaCategory, setGachaCategory] = useState<'ces' | 'daily' | 'rates'>('ces');
  const [gachaBanner, setGachaBanner] = useState<string>('standard_ce');
  const [servantHubCategory, setServantHubCategory] = useState<'profile' | 'stats' | 'np' | 'dialogue' | 'roster'>('profile');
  const [servantHubSelectedId, setServantHubSelectedId] = useState<string | null>(null);
  const [grailWarHubCategory, setGrailWarHubCategory] = useState<'board' | 'casualties' | 'leaks' | 'battles' | 'defenses' | 'familiars' | 'traps' | 'church'>('board');
  const [adminHubCategory, setAdminHubCategory] = useState<'war' | 'war_rules' | 'npanim' | 'npsettings' | 'listnp' | 'economy'>('war');
  const [duelHubCategory, setDuelHubCategory] = useState<'arena' | 'active' | 'history' | 'leaderboard'>('arena');
  const [multiSelectState, setMultiSelectState] = useState<Record<string, string[]>>({});
  const [servantsPage, setServantsPage] = useState<number>(1);
  const [servantsOriginFilter, setServantsOriginFilter] = useState<'all' | 'canon' | 'custom'>('all');
  const [servantsClassFilter, setServantsClassFilter] = useState<string>('all');
  const [servantsSearchQuery, setServantsSearchQuery] = useState<string>('');
  const [activeDuel, setActiveDuel] = useState<{
    battle: ReturnType<typeof initializeBattle>;
    lastLog?: CombatTurnLog;
  } | null>(null);
  const [activeNpMsgId, setActiveNpMsgId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const cleanupActiveNpGif = () => {
    if (activeNpMsgId) {
      const idToDelete = activeNpMsgId;
      setActiveNpMsgId(null);
      setMessages(prev => prev.filter(m => m.id !== idToDelete));
    }
  };

  useEffect(() => {
    if (!activeNpMsgId) return;
    const timer = setTimeout(() => {
      setMessages(prev => prev.filter(m => m.id !== activeNpMsgId));
      setActiveNpMsgId(null);
    }, 60000);
    return () => clearTimeout(timer);
  }, [activeNpMsgId]);

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
  }, []);

  const allThrone = getAllThroneServants(customServants);
  const activeServant = master.servants.find(s => s.id === master.activeServantId) || master.servants[0];

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (msg: DiscordMessage) => {
    setMessages(prev => [...prev, msg]);
  };

  function postTrapsRadarOverview(actionOutcomeMsg?: string) {
    const userTraps = (grailWar.channelTraps || []).filter(t => t.setterMasterId === master.discordId);
    
    let myTrapsText = '';
    if (userTraps.length === 0) {
      myTrapsText = '• *You currently have no active Bounded Fields deployed in Fuyuki (0/3).*';
    } else {
      myTrapsText = userTraps.map((t, idx) => {
        const typeLabel = t.trapType === 'alarm'
          ? '🚨 **Sensory Alarm Ward** (Exposes intruder identity & Servant class upon entering)'
          : '🩸 **Bloodfort Mana Drain** (Siphons 1,800–2,600 HP from intruder to heal your Servant)';
        return `**${idx + 1}. Sector \`${t.channelName}\`** — ${typeLabel}\n   └ *Status:* 🟢 **Concealed & Armed** • *Anchor Time: <t:${Math.floor(t.createdAt / 1000)}:R>*`;
      }).join('\n\n');
    }

    const radarLines = effectiveChannels.map(sec => {
      const activeTrap = (grailWar.channelTraps || []).find(t => t.channelName.toLowerCase() === sec.id.toLowerCase());
      if (!activeTrap) {
        return `• \`${sec.id}\`: ✨ **Clear** *(Available to anchor)* — *${sec.desc}*`;
      }
      if (activeTrap.setterMasterId === master.discordId) {
        const icon = activeTrap.trapType === 'alarm' ? '🚨' : '🩸';
        const typeStr = activeTrap.trapType === 'alarm' ? 'Alarm Ward' : 'Bloodfort Drain';
        return `• \`${sec.id}\`: ${icon} **Armed by You** (${typeStr}) — *${sec.desc}*`;
      }
      return `• \`${sec.id}\`: 🔒 **Occupied** *(Rival Master ${activeTrap.setterUsername})* — *${sec.desc}*`;
    }).join('\n');

    // Build selectOptions for channel selection:
    const selectOptions: Array<{ value: string; label: string; description?: string; emoji?: string }> = [];
    
    effectiveChannels.forEach(sec => {
      const activeTrap = (grailWar.channelTraps || []).find(t => t.channelName.toLowerCase() === sec.id.toLowerCase());
      const isCurrent = sec.id === activePublicSector;
      const currentTag = isCurrent ? ' ⭐ [CURRENT]' : '';
      if (!activeTrap && userTraps.length < 3) {
        selectOptions.push({
          value: `anchor_trap_alarm_${sec.id}`,
          label: `Anchor Alarm Ward in ${sec.id}${currentTag}`,
          description: `Expose intruders entering ${sec.label}`,
          emoji: '🚨'
        });
        selectOptions.push({
          value: `anchor_trap_drain_${sec.id}`,
          label: `Anchor Bloodfort Drain in ${sec.id}${currentTag}`,
          description: `Siphon 1,800 HP in ${sec.label}`,
          emoji: '🩸'
        });
      } else if (activeTrap && activeTrap.setterMasterId === master.discordId) {
        selectOptions.push({
          value: `disarm_trap_${sec.id}`,
          label: `Disarm Bounded Field in ${sec.id}${currentTag}`,
          description: `Dissolve ${activeTrap.trapType === 'alarm' ? 'Alarm Ward' : 'Bloodfort Drain'}`,
          emoji: '🧹'
        });
      }
    });

    const buttons: Array<{ id: string; label: string; style: 'primary' | 'secondary' | 'success' | 'danger'; emoji?: string; disabled?: boolean }> = [
      { id: 'open_traps_hub_modal_btn', label: '🕸️ Open Traps Hub', style: 'primary', emoji: '🕸️' },
      { id: 'prompt_anchor_alarm', label: 'Anchor Alarm...', style: 'primary', emoji: '🚨', disabled: userTraps.length >= 3 },
      { id: 'prompt_anchor_drain', label: 'Anchor Bloodfort...', style: 'danger', emoji: '🩸', disabled: userTraps.length >= 3 }
    ];

    userTraps.forEach(t => {
      buttons.push({
        id: `disarm_trap_${t.channelName}`,
        label: `Disarm ${t.channelName}`,
        style: 'secondary',
        emoji: '🧹'
      });
    });

    if (userTraps.length > 0) {
      buttons.push({
        id: 'disarm_all_traps',
        label: 'Disarm All Traps',
        style: 'danger',
        emoji: '🧹'
      });
    }

    buttons.push({
      id: 'add_custom_channel_btn',
      label: '+ Connect Channel',
      style: 'secondary',
      emoji: '➕'
    });

    buttons.push({
      id: 'refresh_traps_radar',
      label: 'Refresh Radar',
      style: 'secondary',
      emoji: '🔄'
    });

    addMessage({
      id: getNextId('bot_traps_radar'),
      sender: 'bot',
      timestamp: 'Just now',
      embed: {
        title: '🕸️ Bounded Field Traps & Fuyuki Leyline Radar',
        description:
          (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
          `Conceal magecraft Bounded Fields in specific channels to intercept rival Masters!\n` +
          `*(Max 2 active Bounded Fields per Master • Only 1 Bounded Field can exist per channel)*\n\n` +
          `📍 **YOUR ACTIVE BOUNDED FIELDS (${userTraps.length}/2):**\n${myTrapsText}\n\n` +
          `🗺️ **FUYUKI LEYLINE SECTORS RADAR:**\n${radarLines}\n\n` +
          `*Select a sector from the menu below or click an action button to deploy/disarm:*`,
        color: '#8b5cf6',
        footer: 'Fuyuki Leyline Radar • Real-time channel perimeter detection'
      },
      components: {
        type: 'buttons',
        placeholder: selectOptions.length > 0 ? '🎯 Select a channel to anchor Bounded Field...' : undefined,
        selectOptions: selectOptions.length > 0 ? selectOptions.slice(0, 25) : undefined,
        items: buttons
      }
    });
  }

  function postChannelSelectorPrompt(trapType: 'alarm' | 'drain') {
    const userTraps = (grailWar.channelTraps || []).filter(t => t.setterMasterId === master.discordId);
    if (userTraps.length >= 2) {
      postTrapsRadarOverview('⚠️ **Trap Limit Reached:** You already have 2 active Bounded Fields deployed across Fuyuki. Disarm one before placing another.');
      return;
    }

    const typeName = trapType === 'alarm' ? 'Sensory Alarm Ward' : 'Bloodfort Drain Field';
    const typeIcon = trapType === 'alarm' ? '🚨' : '🩸';
    const typeDesc = trapType === 'alarm'
      ? 'Secretly alerts you and reveals the rival intruder’s username and Servant class.'
      : 'Siphons 1,800–2,600 HP from rival intruders to replenish your Servant’s health.';

    const selectOptions: Array<{ value: string; label: string; description?: string; emoji?: string }> = [];
    const buttons: Array<{ id: string; label: string; style: 'primary' | 'secondary' | 'success' | 'danger'; emoji?: string; disabled?: boolean }> = [];

    effectiveChannels.forEach(sec => {
      const activeTrap = (grailWar.channelTraps || []).find(t => t.channelName.toLowerCase() === sec.id.toLowerCase());
      const isClear = !activeTrap;
      const isMine = activeTrap && activeTrap.setterMasterId === master.discordId;
      const isCurrent = sec.id === activePublicSector;

      if (isClear) {
        selectOptions.push({
          value: `anchor_trap_${trapType}_${sec.id}`,
          label: `${sec.id} (${sec.label})${isCurrent ? ' ⭐ [CURRENT CHANNEL]' : ''}`,
          description: `✨ Leylines clear • ${sec.desc}`,
          emoji: sec.emoji
        });
        buttons.push({
          id: `anchor_trap_${trapType}_${sec.id}`,
          label: isCurrent ? `⭐ ${sec.id} (Current)` : `${sec.id}`,
          style: trapType === 'alarm' ? 'primary' : 'danger',
          emoji: sec.emoji
        });
      } else {
        selectOptions.push({
          value: `disarm_trap_${sec.id}`,
          label: `${sec.id} (${isMine ? '🔒 Armed by You' : '🔒 Occupied by Rival'})${isCurrent ? ' ⭐ [CURRENT]' : ''}`,
          description: isMine
            ? 'Click to disarm current trap'
            : `Click to infiltrate & dismantle rival Master ${activeTrap?.setterUsername}'s Bounded Field`,
          emoji: isMine ? (activeTrap?.trapType === 'alarm' ? '🚨' : '🩸') : '🗡️'
        });
      }
    });

    buttons.push({
      id: 'add_custom_channel_btn',
      label: '+ Connect Channel',
      style: 'secondary',
      emoji: '➕'
    });

    buttons.push({
      id: 'refresh_traps_radar',
      label: 'Back to Radar',
      style: 'secondary',
      emoji: '⬅️'
    });

    addMessage({
      id: getNextId(`bot_prompt_${trapType}`),
      sender: 'bot',
      timestamp: 'Just now',
      embed: {
        title: `${typeIcon} Anchor ${typeName} — Choose Target Channel`,
        description:
          `Select which Fuyuki sector to establish your **${typeName}** into.\n\n` +
          `• **Effect:** ${typeDesc}\n` +
          `• **Rule:** Only **1 Bounded Field** can exist per channel. Leylines cannot support multiple fields.\n\n` +
          `👇 **Select a target channel below:**`,
        color: trapType === 'alarm' ? '#eab308' : '#dc2626',
        footer: 'Holy Grail War Perimeter Magecraft • Choose sector'
      },
      components: {
        type: 'buttons',
        placeholder: `🎯 Select channel to anchor ${trapType === 'alarm' ? 'Alarm Ward' : 'Bloodfort Drain'}...`,
        selectOptions: selectOptions.slice(0, 25),
        items: buttons
      }
    });
  }

  const handleModalDeployTrap = (targetSector: string, trapType: 'alarm' | 'bloodfort') => {
    const cleanSector = targetSector.trim().startsWith('#') ? targetSector.trim() : `#${targetSector.trim()}`;
    const engineTrapType = trapType === 'bloodfort' ? 'drain' : 'alarm';
    const res = setChannelTrapInWar(grailWar, master.discordId, master.username, cleanSector, engineTrapType);
    onUpdateGrailWar(res.updatedWar);
    addMessage({
      id: getNextId('trap_modal_deploy'),
      sender: 'bot',
      timestamp: 'Just now',
      embed: {
        title: res.success ? `⚡ Bounded Field Established: ${cleanSector}` : `⚠️ Magecraft Failure`,
        description: res.message,
        color: res.success ? (trapType === 'alarm' ? '#a855f7' : '#e11d48') : '#ef4444',
        footer: 'Fuyuki Territorial Defense Network • Bounded Field Sanctum'
      }
    });
  };

  const handleModalDisarmTrap = (channelName?: string) => {
    const res = disarmChannelTrapsInWar(grailWar, master.discordId, channelName);
    onUpdateGrailWar(res.updatedWar);
    addMessage({
      id: getNextId('trap_modal_disarm'),
      sender: 'bot',
      timestamp: 'Just now',
      embed: {
        title: `🧹 Bounded Field Dissolved`,
        description: res.message,
        color: '#6b7280',
        footer: 'Fuyuki Territorial Defense Network'
      }
    });
  };

  const handleModalTriggerIntrusionTest = (channelName: string) => {
    const cleanSector = channelName.trim().startsWith('#') ? channelName.trim() : `#${channelName.trim()}`;
    const rivals = Object.values(grailWar.participants).filter(p => p.discordId !== master.discordId && p.isAlive);
    const rival = rivals.length > 0 ? rivals[0] : null;
    const triggerId = rival ? rival.discordId : 'shadow_rival_tester';
    const triggerName = rival ? rival.username : 'Shadow Infiltrator';
    const res = checkAndTriggerChannelTraps(grailWar, triggerId, triggerName, cleanSector);
    if (res.triggered) {
      onUpdateGrailWar({ ...grailWar });
      addMessage({
        id: getNextId('trap_modal_test_triggered'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: `🚨 INTRUSION ALERT TRIGGERED in ${cleanSector}!`,
          description: res.message || `An intruder triggered a Bounded Field trap in ${cleanSector}!`,
          color: '#e11d48',
          footer: 'Perimeter Intrusion Sensor Feed'
        }
      });
    } else {
      addMessage({
        id: getNextId('trap_modal_test_clear'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: `ℹ️ Perimeter Clear in ${cleanSector}`,
          description: `No active Bounded Field trap triggered when ${triggerName} passed through ${cleanSector}. Anchor a ward in this sector first to capture intruders.`,
          color: '#6b7280',
          footer: 'Perimeter Intrusion Sensor Feed'
        }
      });
    }
  };

  const handleCommand = (cmd: string) => {
    const rawCmd = cmd.trim();
    // Normalize exclamation mark prefix `!command` to `/command` or detect command keywords without slash
    let normalizedRawCmd = rawCmd;
    if (rawCmd.startsWith('!')) {
      normalizedRawCmd = '/' + rawCmd.slice(1);
    } else if (!rawCmd.startsWith('/')) {
      const firstWord = rawCmd.split(/\s+/)[0].toLowerCase();
      const knownCommands = [
        'attack', 'ambush', 'duel', 'summon', 'servant', 'servants', 'grailwar', 'grail', 'board', 'war',
        'daily', 'claim', 'church', 'sanctuary', 'bounty', 'bounties', 'reputation', 'rep', 'defenses', 'profile', 'inventory',
        'equip', 'dialogue', 'heal', 'feed', 'cegacha', 'gacha', 'patrol', 'leak',
        'trap', 'traps', 'familiar', 'familiars', 'help', 'boast', 'art', 'artwork', 'np'
      ];
      if (knownCommands.includes(firstWord)) {
        normalizedRawCmd = '/' + rawCmd;
      }
    }
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

    // Check if the current channel sector contains a rival Master's concealed Bounded Field trap!
    // Civilians (no activeServant) and stealth patrol commands never trigger traps.
    const isPatrolCmd = trimmed.startsWith('/patrol') || trimmed.startsWith('/petrol') || trimmed.startsWith('/grailwar patrol') || trimmed.startsWith('!patrol') || trimmed.startsWith('!petrol') || trimmed.startsWith('!scout');
    if (activeServant && !isPatrolCmd && grailWar.channelTraps && grailWar.channelTraps.length > 0) {
      const curChanName = activeChannel === 'public' ? '#holy-grail-war' : activeChannel.startsWith('#') ? activeChannel : `#${activeChannel}`;
      const trapRes = checkAndTriggerChannelTraps(grailWar, master.discordId, master.username, curChanName);
      if (trapRes.triggered && trapRes.trapType && trapRes.setterId) {
        onUpdateGrailWar(grailWar);
        const isDrain = trapRes.trapType === 'drain';
        setTimeout(() => {
          addMessage({
            id: getNextId('bot_trap_sprung_alert'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: isDrain ? '🩸 BOUNDED FIELD TRIGGERED: Bloodfort Mana Drain!' : '🚨 BOUNDED FIELD TRIPPED: Sensory Alarm Ward!',
              description: trapRes.message || (isDrain ? 'Mana drain field triggered!' : 'Alarm ward tripped!'),
              color: isDrain ? '#dc2626' : '#eab308',
              footer: 'Holy Grail War • Territorial Leyline Defense'
            }
          });
        }, 150);
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

      const summonQuote = newInstance.customQuotes?.summon || randomTemplate.summonQuote || `Servant ${randomTemplate.servantClass}. I have answered your summons. Are you my Master?`;

      // Stage 2: Visual Novel Summon Dialogue Cut-In Frame
      addMessage({
        id: getNextId('bot_summon_dialogue'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: `✨ HEROIC SPIRIT SUMMONED: ${randomTemplate.name.toUpperCase()}`,
          description:
            `💬 **[HEROIC SPIRIT SUMMON] ${randomTemplate.name}:**\n> ❝ ***${summonQuote}*** ❞\n\n` +
            `👤 **True Name:** **${randomTemplate.name}**\n` +
            `🗡️ **Class:** \`${randomTemplate.servantClass}\` | **Title:** *${randomTemplate.title}*\n` +
            `🔴 **Command Seals Bestowed:** **3 / 3**\n\n` +
            `💥 **Noble Phantasm:** **${randomTemplate.noblePhantasm.name}** [${randomTemplate.noblePhantasm.cardType}]\n` +
            `* "${randomTemplate.noblePhantasm.chant}" *`,
          color: '#d4af37',
          footer: 'Holy Grail War Contract Established • Visual Novel Invocation Frame'
        },
        canvasType: 'dialogue',
        canvasPayload: {
          speaker: randomTemplate.name,
          quote: summonQuote,
          title: 'HEROIC SPIRIT SUMMON',
          servantClass: randomTemplate.servantClass,
          avatarUrl: randomTemplate.cardArtUrl || randomTemplate.avatarUrl,
          bondOrLevel: 1,
          defenderName: 'Greater Grail',
          defenderClass: 'Throne of Heroes',
          defenderAvatarUrl: undefined,
          sequence: ['Buster', 'Arts', 'Quick'],
          bgUrlOrPreset: 'fuyuki'
        }
      });

      // Stage 3: Servant Parameter Overview Card & Actions
      addMessage({
        id: getNextId('bot_summon_res'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: `📊 SERVANT PARAMETERS: ${randomTemplate.name.toUpperCase()}`,
          description:
            `📊 **Base Parameters:**\n` +
            `• **HP:** \`${randomTemplate.baseHp.toLocaleString()}\` | **ATK:** \`${randomTemplate.baseAtk.toLocaleString()}\`\n` +
            `• **STR:** ${randomTemplate.baseStats.strength} | **END:** ${randomTemplate.baseStats.endurance} | **AGI:** ${randomTemplate.baseStats.agility} | **MNA:** ${randomTemplate.baseStats.mana} | **LCK:** ${randomTemplate.baseStats.luck}\n\n` +
            `📜 **Lore & Legend:**\n${randomTemplate.lore}`,
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

      // Subcommand: economy
      if (trimmed.includes('economy')) {
        if (trimmed.includes('reset_currency') || trimmed.includes('reset currency')) {
          onUpdateMaster({
            ...master,
            saintQuartz: 30,
            qp: 0,
            summonTickets: 0,
            manaPrisms: 0,
            saintShards: 0
          } as any);
          postAdminHub('economy', '🧹 **Currency Reset:** Reset your Saint Quartz to 30 SQ, and QP/Tickets/Shards to 0.');
          return;
        }
        if (trimmed.includes('reset_inventory') || trimmed.includes('reset inventory')) {
          const updatedServants = (master.servants || []).map(s => ({
            ...s,
            equippedCe: undefined,
            equippedCeId: undefined,
            equippedCraftEssence: undefined
          }));
          onUpdateMaster({
            ...master,
            craftEssences: [],
            catalysts: [],
            servants: updatedServants
          } as any);
          postAdminHub('economy', '🎒 **Inventory Cleared:** Wiped all Craft Essences, unequipped items, and catalysts.');
          return;
        }
        if (trimmed.includes('reset_vault') || trimmed.includes('reset vault')) {
          const updatedServants = (master.servants || []).map(s => ({
            ...s,
            equippedCe: undefined,
            equippedCeId: undefined,
            equippedCraftEssence: undefined
          }));
          onUpdateMaster({
            ...master,
            saintQuartz: 30,
            qp: 0,
            summonTickets: 0,
            manaPrisms: 0,
            saintShards: 0,
            craftEssences: [],
            catalysts: [],
            servants: updatedServants
          } as any);
          postAdminHub('economy', '🔄 **Full Vault Reset:** All inventory items wiped and currency restored to initial state (30 SQ, 0 QP).');
          return;
        }
        if (trimmed.includes('server_wipe') || trimmed.includes('server wipe')) {
          const updatedServants = (master.servants || []).map(s => ({
            ...s,
            equippedCe: undefined,
            equippedCeId: undefined,
            equippedCraftEssence: undefined
          }));
          onUpdateMaster({
            ...master,
            saintQuartz: 30,
            qp: 0,
            summonTickets: 0,
            manaPrisms: 0,
            saintShards: 0,
            craftEssences: [],
            catalysts: [],
            servants: updatedServants
          } as any);
          postAdminHub('economy', '⚠️ **Server-Wide Economy Wipe:** Wiped all Masters\' inventories and reset currencies across the server.');
          return;
        }
        setAdminHubCategory('economy');
        postAdminHub('economy');
        return;
      }

      if (trimmed.includes('war') || trimmed.includes('rules')) {
        setAdminHubCategory('war');
        postAdminHub('war');
        return;
      }

      // Default Admin Hub
      setAdminHubCategory('war');
      postAdminHub('war');
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
                  ? `**Did you mean:**\n` + suggestions.map(s => `• **${s.name}** (\`${s.servantClass}\`)`).join('\n') + `\n\n*Click a suggestion below to edit immediately:*`
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
              `• **ID:** \`${target.id}\` | **Class:** \`${target.servantClass}\` (Balanced Parity)\n` +
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
    // COMMAND 2.75: /customise quote, /customise dialogue, /dialogue set (Custom Dialogues & Chain Shouts)
    // ----------------------------------------------------
    if (
      trimmed.startsWith('/customise quote') ||
      trimmed.startsWith('/customise dialogue') ||
      trimmed.startsWith('/dialogue set') ||
      trimmed.startsWith('/dialogue add') ||
      trimmed.startsWith('/dialogue custom')
    ) {
      handleCustomDialogueCommand(trimmed);
      return;
    }

    // ----------------------------------------------------
    // COMMAND 2.78: /gacha, /cegacha (Greater Grail Invocation Sanctum)
    // ----------------------------------------------------
    if (trimmed.startsWith('/gacha') || (trimmed.startsWith('/cegacha') && !trimmed.startsWith('/cegacha inventory'))) {
      if (trimmed.includes('pull') || trimmed.includes('roll') || trimmed.includes('summon')) {
        const isTen = trimmed.includes('10') || trimmed.includes('multi') || trimmed.includes('ten');
        const rollCount = isTen ? 10 : 1;
        const requiredSq = isTen ? 30 : 3;

        if ((master.saintQuartz || 0) < requiredSq) {
          addMessage({
            id: getNextId('bot_cegacha_no_sq'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '⚠️ Insufficient Saint Quartz',
              description: `You need **${requiredSq} SQ** 💎 for a ${rollCount}x Craft Essence summon, but only have **${master.saintQuartz || 0} SQ**. Use \`/daily\` to claim 30 free SQ!`,
              color: '#ef4444'
            },
            components: {
              type: 'buttons',
              items: [{ id: 'quick_daily_claim', label: 'Claim Daily (30 SQ)', style: 'success', emoji: '💎' }]
            }
          });
          return;
        }

        const pullResult = executeCraftEssenceGachaRoll({ count: rollCount, master });
        onUpdateMaster(pullResult.updatedMaster);

        const lines = pullResult.results.map((r, idx) => {
          const c = r.item as CraftEssence;
          const newTag = r.isNew ? ' 🌟 **[NEW!]**' : '';
          const rateUpTag = r.isRateUp ? ' ✨ **[RATE-UP!]**' : '';
          const atk = c.bonusAtk || c.atkBonus || 0;
          const hp = c.bonusHp || c.hpBonus || 0;
          return `${rollCount === 10 ? `${idx + 1}. ` : '• '}**[★${c.rarity}]** **${c.name}**${newTag}${rateUpTag}\n   ↳ *${c.effectText || c.description}* (+${atk} ATK / +${hp} HP)`;
        }).join('\n');

        const bestResult = pullResult.results.slice().sort((a, b) => b.rarity - a.rarity)[0];
        const bestCe = bestResult?.item as CraftEssence;
        const embedColor = pullResult.ssrsPulled > 0 ? '#f59e0b' : pullResult.srsPulled > 0 ? '#a855f7' : '#38bdf8';

        addMessage({
          id: getNextId('bot_cegacha_pull_success'),
          sender: 'bot',
          timestamp: 'Just now',
          canvasType: 'gacha',
          canvasPayload: {
            results: pullResult.results,
            bannerTitle: rollCount === 10 ? '10x Craft Essence Multi-Summon' : '1x Craft Essence Single Summon'
          },
          embed: {
            title: `✨ Sacred Relics Forged! (${rollCount}x Summon)`,
            description:
              `Channeling completed! You spent **${pullResult.spentQuartz} Saint Quartz** 💎.\n\n` +
              `### 🔮 Relics Summoned:\n${lines}\n\n` +
              `💎 **Remaining Saint Quartz:** \`${pullResult.updatedMaster.saintQuartz} SQ\`\n` +
              `📦 **Total Essences in Vault:** \`${(pullResult.updatedMaster.craftEssences || []).length}\``,
            color: embedColor,
            footer: rollCount === 10 ? '10x Multi-Summon guarantees a 4★ SR or higher Craft Essence!' : 'Equip CEs in /inventory or feed for EXP in /feed'
          },
          artworkEmbed: bestCe?.artworkUrl ? { imageUrl: bestCe.artworkUrl, color: embedColor } : undefined,
          components: {
            type: 'buttons',
            items: [
              { id: 'inv_act_roll_1x_ce', label: 'Roll 1x Again (3 SQ)', style: 'primary', emoji: '🎲' },
              { id: 'inv_act_roll_10x_ce', label: 'Roll 10x Again (30 SQ)', style: 'success', emoji: '💎' },
              { id: 'inv_cat_ces', label: 'Open Inventory', style: 'secondary', emoji: '🛡️' },
              { id: 'inv_act_feed_duplicates', label: 'Feed Duplicates for EXP', style: 'secondary', emoji: '✨' }
            ]
          }
        });
        return;
      }

      let category: 'ces' | 'daily' | 'rates' = 'ces';
      let banner = 'standard_ce';

      if (trimmed.includes('daily') || trimmed.includes('vault') || trimmed.includes('claim')) {
        category = 'daily';
        banner = 'daily_vault';
      } else if (trimmed.includes('rates') || trimmed.includes('pool') || trimmed.includes('pity')) {
        category = 'rates';
      } else {
        category = 'ces';
        banner = 'standard_ce';
      }

      setGachaCategory(category);
      setGachaBanner(banner);
      postGachaHub(category, banner);
      return;
    }

    // ----------------------------------------------------
    // COMMAND 2.8: /inventory, /equip, /feed, /enhance, /customise stats/equip/feed
    // ----------------------------------------------------
    if (
      trimmed.startsWith('/inventory') ||
      trimmed.startsWith('/equip') ||
      trimmed.startsWith('/customise stats') ||
      trimmed.startsWith('/customise equip') ||
      trimmed.startsWith('/customise feed') ||
      trimmed.startsWith('/feed') ||
      trimmed.startsWith('/enhance') ||
      trimmed.startsWith('/cegacha inventory')
    ) {
      if (trimmed.startsWith('/customise stats')) {
        postStatAllocationHub();
        return;
      }

      let category: 'ces' | 'servants' | 'feed' | 'seals' | 'items' = 'ces';
      if (trimmed.startsWith('/feed') || trimmed.startsWith('/enhance') || trimmed.includes('feed')) {
        const feedArg = trimmed.replace('/feed', '').replace('/enhance', '').replace('/customise feed', '').trim();
        if (feedArg) {
          executeDirectFeed(feedArg);
          return;
        }
        category = 'feed';
      } else if (trimmed.includes('servant')) {
        category = 'servants';
      } else if (trimmed.includes('seal') || trimmed.includes('ward')) {
        category = 'seals';
      } else if (trimmed.includes('item') || trimmed.includes('vault') || trimmed.includes('quartz') || trimmed.includes('gacha')) {
        category = 'items';
      }

      setInvCategory(category);
      setInvPage(1);
      postInventoryHub(category, 1);
      return;
    }

    // ----------------------------------------------------
    // COMMAND 2.9: /dialogue, /cutin, /quote (Visual Novel Action Cut-In with Battlefield Stage)
    // ----------------------------------------------------
    if (trimmed.startsWith('/dialogue') || trimmed.startsWith('/cutin') || trimmed.startsWith('/quote')) {
      const rest = trimmed.replace('/dialogue', '').replace('/cutin', '').replace('/quote', '').trim();
      let chosenPreset = 'fuyuki';
      if (rest.includes('snow') || rest.includes('einzbern')) chosenPreset = 'snow';
      else if (rest.includes('temple') || rest.includes('ryuudou')) chosenPreset = 'temple';
      else if (rest.includes('throne') || rest.includes('celestial')) chosenPreset = 'throne';
      else if (rest.includes('grail') || rest.includes('cavern')) chosenPreset = 'grail';

      let targetServant: any = null;
      if (rest) {
        targetServant = allThrone.find(s => 
          s.name.toLowerCase() === rest.toLowerCase() ||
          s.name.toLowerCase().includes(rest.toLowerCase()) ||
          s.id.toLowerCase() === rest.toLowerCase()
        );
      }

      if (!targetServant && activeServant) {
        const templateId = activeServant.templateId || activeServant.template?.id || activeServant.id;
        targetServant = SERVANT_DATABASE.find(s => s.id === templateId) || activeServant.template || activeServant;
      }

      if (!targetServant) {
        targetServant = allThrone[0] || SERVANT_DATABASE[0];
      }

      // Generate personality-specific, varied dialogue using the dialogue engine
      const dialogueResult = getServantChainDialogue(
        targetServant.name,
        targetServant.servantClass || 'Saber',
        ['Buster', 'Buster', 'Buster'],
        activeServant?.customQuotes
      );
      const quote = dialogueResult.quote;

      addMessage({
        id: getNextId('bot_dialogue_cutin'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: `🎬 Visual Novel Action Cut-In: ${targetServant.name}`,
          description: `*"${quote}"*\n\n🏟️ **Battlefield:** \`${chosenPreset.toUpperCase()}\` • ⚔️ **Class:** \`${targetServant.servantClass}\` • 🎯 **Target:** \`Gilgamesh (Archer)\` • 💬 **Chain:** \`${dialogueResult.tag}\``,
          color: '#d4af37',
          footer: 'Visual Novel Cut-In Card with Stage Atmosphere, Hovering Attacker & Full-Screen Cleave'
        },
        canvasType: 'dialogue',
        canvasPayload: {
          speaker: targetServant.name,
          quote: quote,
          title: dialogueResult.tag,
          servantClass: targetServant.servantClass || 'Saber',
          avatarUrl: targetServant.avatarUrl || targetServant.cardArtUrl,
          bondOrLevel: (activeServant && activeServant.bondLevel) || 10,
          defenderName: 'Gilgamesh',
          defenderAvatarUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
          defenderClass: 'Archer',
          sequence: ['Buster', 'Buster', 'Buster'],
          bgUrlOrPreset: chosenPreset
        },
        components: {
          type: 'buttons',
          items: [
            { id: 'btn_hear_quote', label: 'Replay Cut-In 🎬', style: 'primary', emoji: '⚔️' },
            { id: 'quick_servant_card', label: 'Servant Profile', style: 'secondary', emoji: '📜' },
            { id: 'quick_start_duel', label: 'Enter Arena', style: 'danger', emoji: '⚔️' }
          ]
        }
      });
      return;
    }

    // ----------------------------------------------------
    // COMMAND 3: /servant (Master's Servant Workshop Hub or Direct Lookup)
    // ----------------------------------------------------
    if (trimmed === '/servant' || trimmed.startsWith('/servant ') || trimmed === '!servant' || trimmed.startsWith('!servant ') || trimmed === '!myservant' || trimmed.startsWith('!myservant ')) {
      const rawArg = trimmed
        .replace(/^\/servant/i, '')
        .replace(/^!servant/i, '')
        .replace(/^!myservant/i, '')
        .trim();

      const argLower = rawArg.toLowerCase();

      // If user provided a specific servant name or ID (e.g. /servant Artoria or !servant gilgamesh), display full profile card directly
      if (argLower &&
          !['status', 'profile', 'stats', 'stat', 'points', 'equip', 'ce', 'feed', 'exp', 'np', 'noble', 'dialogue', 'voice', 'quote', 'roster', 'list', 'search', 'view'].includes(argLower)) {
        const directMatch = allThrone.find(
          s => s.name.toLowerCase() === argLower ||
               s.id.toLowerCase() === argLower ||
               s.name.toLowerCase().includes(argLower) ||
               s.id.toLowerCase().includes(argLower)
        );
        if (directMatch) {
          postServantFullProfile(directMatch);
          return;
        }
      }

      let targetCat: 'profile' | 'stats' | 'equip_ce' | 'feed_ce' | 'np' | 'dialogue' | 'roster' = 'profile';
      if (argLower.includes('stat') || argLower.includes('points')) {
        targetCat = 'stats';
      } else if (argLower.includes('equip') || argLower.includes('ce')) {
        targetCat = 'equip_ce';
      } else if (argLower.includes('feed') || argLower.includes('exp')) {
        targetCat = 'feed_ce';
      } else if (argLower.includes('np') || argLower.includes('noble')) {
        targetCat = 'np';
      } else if (argLower.includes('dialogue') || argLower.includes('voice') || argLower.includes('quote')) {
        targetCat = 'dialogue';
      } else if (argLower.includes('roster') || argLower.includes('list')) {
        targetCat = 'roster';
      }
      setServantHubCategory(targetCat as any);
      postServantHub(targetCat as any);
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
    // COMMAND 3.4: /dialogue, /vn, /cutin (Visual Novel Dialogue Cut-Ins)
    // ----------------------------------------------------
    if (trimmed.startsWith('/dialogue') || trimmed.startsWith('/vn') || trimmed.startsWith('/cutin')) {
      if (!activeServant) {
        addMessage({
          id: getNextId('bot_dia_err'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: 'No Active Servant',
            description: 'You need an active Servant to render visual novel dialogue cut-ins! Summon one with `/summon ritual`.',
            color: '#ef4444'
          }
        });
        return;
      }

      const isDefeatMode = trimmed.includes('defeat') || trimmed.includes('dissolve') || trimmed.includes('death');
      const speaker = activeServant.nickname || activeServant.template.name;
      const servantClass = activeServant.template.servantClass;
      const avatarUrl = activeServant.template.cardArtUrl || activeServant.template.avatarUrl;

      if (isDefeatMode) {
        const defeatDia = getServantDefeatDialogue(speaker, activeServant.customQuotes);
        addMessage({
          id: getNextId('bot_vn_defeat'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: `☠️ VISUAL NOVEL CUT-IN — ${speaker.toUpperCase()} [DISSOLVED]`,
            description:
              `💬 **[SPIRIT ORIGIN DISSOLUTION] ${speaker}:**\n> ❝ ***${defeatDia.quote}*** ❞\n\n` +
              `*The spiritual covenant breaks. Spectral embers rise from the dissolved saint graph.*`,
            color: '#ef4444',
            footer: 'Spirit Origin Dissolution Visual Novel Canvas'
          },
          canvasType: 'defeat_dialogue',
          canvasPayload: {
            speaker,
            quote: defeatDia.quote,
            title: 'SPIRIT ORIGIN DISSOLVED',
            servantClass,
            avatarUrl,
            bondOrLevel: activeServant.bondLevel || 10,
            defenderName: 'Gilgamesh Archer',
            defenderClass: 'Archer',
            defenderAvatarUrl: 'https://i.imgur.com/hyNsgc1.jpeg',
            bgUrlOrPreset: 'fuyuki'
          }
        });
        return;
      }

      // Default Tactical Chain Dialogue Cut-In
      const chainDia = getServantChainDialogue(speaker, servantClass, ['Buster', 'Buster', 'Buster'], activeServant.customQuotes);
      addMessage({
        id: getNextId('bot_vn_chain'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: `💬 VISUAL NOVEL CUT-IN — ${speaker.toUpperCase()}`,
          description:
            `💬 **[TACTICAL CHAIN] ${speaker}:**\n> ❝ ***${chainDia.quote}*** ❞\n\n` +
            `*Use \`/dialogue defeat\` to test the Spirit Origin Dissolution visual novel cut-in!*`,
          color: '#d4af37',
          footer: 'Tactical Combat Chain Visual Novel Canvas'
        },
        canvasType: 'dialogue',
        canvasPayload: {
          speaker,
          quote: chainDia.quote,
          title: 'TACTICAL COMBAT CHAIN',
          servantClass,
          avatarUrl,
          bondOrLevel: activeServant.bondLevel || 10,
          defenderName: 'Gilgamesh Archer',
          defenderClass: 'Archer',
          defenderAvatarUrl: 'https://i.imgur.com/hyNsgc1.jpeg',
          sequence: ['Buster', 'Buster', 'Buster'],
          bgUrlOrPreset: 'fuyuki'
        }
      });
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

        setServantsSearchQuery(query);
        setServantsPage(1);
        postServantsList(
          allThrone,
          `🔍 Search Results for "${query}" (${matches.length} Found)`,
          `Matching canon & custom Heroic Spirits recorded in the Throne of Heroes:`,
          1,
          'all',
          'all',
          query
        );
        return;
      }

      // Sub-case: /servants canon or /servants custom or /servants (all)
      let initialOrigin: 'all' | 'canon' | 'custom' = 'all';
      if (trimmed.includes('canon')) {
        initialOrigin = 'canon';
      } else if (trimmed.includes('custom')) {
        initialOrigin = 'custom';
      }

      setServantsOriginFilter(initialOrigin);
      setServantsClassFilter('all');
      setServantsSearchQuery('');
      setServantsPage(1);

      postServantsList(allThrone, undefined, undefined, 1, initialOrigin, 'all');
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
            title: '❌ Civilians Cannot Challenge',
            description: 'You are a civilian without a contracted Servant! Civilians cannot initiate duels in the Holy Grail War. Invoke `/summon` to contract a Heroic Spirit first.',
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

      // Handle /duel forcejoin [side] or /duel intervene [side]
      if (
        targetQuery === 'forcejoin' ||
        targetQuery.startsWith('forcejoin') ||
        targetQuery === 'force_join' ||
        targetQuery.startsWith('force_join') ||
        targetQuery === 'intervene' ||
        targetQuery.startsWith('intervene')
      ) {
        if (!activeServant) {
          addMessage({
            id: getNextId('bot_forcejoin_no_srv'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '⚠️ No Active Servant Contract',
              description: 'You must contract and equip a Servant before you can breach a battle arena and force join!',
              color: '#ef4444'
            }
          });
          return;
        }

        const rawSideArg = targetQuery
          .replace('forcejoin', '')
          .replace('force_join', '')
          .replace('intervene', '')
          .trim()
          .toLowerCase();

        let chosenSide: 'teamA' | 'teamB' | null = null;
        if (rawSideArg === 'teama' || rawSideArg === 'team_a' || rawSideArg === 'a' || rawSideArg === '1' || rawSideArg === 'sidea' || rawSideArg === 'p1') {
          chosenSide = 'teamA';
        } else if (rawSideArg === 'teamb' || rawSideArg === 'team_b' || rawSideArg === 'b' || rawSideArg === '2' || rawSideArg === 'sideb' || rawSideArg === 'p2') {
          chosenSide = 'teamB';
        }

        // If an active duel exists, force join it
        if (activeDuel) {
          if (!chosenSide) {
            // Prompt side selection
            addMessage({
              id: getNextId('bot_forcejoin_pick_side'),
              sender: 'bot',
              timestamp: 'Just now',
              embed: {
                title: '⚡ 3RD MASTER INTERVENTION — CHOOSE ALLEGIANCE',
                description:
                  `An active duel is underway between **${activeDuel.battle.player1.name}** and **${activeDuel.battle.player2.name}**!\n\n` +
                  `Master **${master.username}** and **${activeServant.nickname || activeServant.template.name}**, choose which side to reinforce with your Spiritron mana:`,
                color: '#d4af37',
                footer: 'Holy Grail War Multi-Combatant Intervention Engine'
              },
              components: {
                type: 'buttons',
                items: [
                  { id: 'duel_forcejoin_side_teama', label: `Reinforce Team A (${activeDuel.battle.player1.name})`, style: 'primary', emoji: '🛡️' },
                  { id: 'duel_forcejoin_side_teamb', label: `Reinforce Team B (${activeDuel.battle.player2.name})`, style: 'danger', emoji: '⚔️' },
                  { id: 'duel_tab_active', label: 'View Active Clash', style: 'secondary', emoji: '🥊' }
                ]
              }
            });
            return;
          }

          const intervenorHp = userParticipant ? calculateCurrentHp(userParticipant) : undefined;
          const thirdCombatant = createCombatantFromMasterServant(activeServant, master.username, intervenorHp);
          const updatedBattle = forceJoinBattle(activeDuel.battle, thirdCombatant, chosenSide);
          setActiveDuel({ battle: updatedBattle });

          const allyTarget = chosenSide === 'teamA' ? updatedBattle.player1.name : updatedBattle.player2.name;
          const enemyTarget = chosenSide === 'teamA' ? updatedBattle.player2.name : updatedBattle.player1.name;

          addMessage({
            id: getNextId('bot_forcejoin_success'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: `🚨 3RD MASTER FORCE JOINED COMBAT!`,
              description:
                `💥 **BOUNDED FIELD BREACHED!**\n\n` +
                `Master **${master.username}** unleashed **${thirdCombatant.name}** into the ongoing clash, joining **${chosenSide === 'teamA' ? 'Team A' : 'Team B'}** alongside **${allyTarget}** against **${enemyTarget}**!\n\n` +
                `⚔️ **Updated Battle Format:** \`${updatedBattle.teamA.length}v${updatedBattle.teamB.length} Multi-Combat Encounter\`\n` +
                `❤️ **${thirdCombatant.name} HP:** \`${thirdCombatant.currentHp.toLocaleString()}/${thirdCombatant.maxHp.toLocaleString()}\`\n` +
                `✨ **Support Action:** Extra combatants contribute bonus support strikes (+25% ATK) each turn!`,
              color: '#e11d48',
              footer: 'Holy Grail War • Multi-Combat Dynamic Team Engagement'
            },
            components: {
              type: 'buttons',
              items: [
                { id: 'duel_card_bbb', label: 'Buster Brave', style: 'danger', emoji: '🔴' },
                { id: 'duel_card_aaa', label: 'Arts Chain', style: 'primary', emoji: '🔵' },
                { id: 'duel_card_qqq', label: 'Quick Chain', style: 'success', emoji: '🟢' },
                { id: 'duel_tab_active', label: 'Open Battle Stage', style: 'secondary', emoji: '🥊' }
              ]
            }
          });
          return;
        } else {
          // No active duel in progress -> Spawn a 3-way multi-combat skirmish arena!
          const otherServants = allThrone.filter(s => s.id !== activeServant.templateId);
          const r1 = otherServants[0] || allThrone[0];
          const r2 = otherServants[1] || allThrone[1] || allThrone[0];

          const p1 = createCombatantFromMasterServant(activeServant, master.username);
          const p2 = createCombatantFromMasterServant({
            id: 'shadow_master_rival_1',
            masterId: 'shadow_master_rival_1',
            templateId: r1.id,
            level: 20,
            experience: 1000,
            allocatedStats: { strength: 3, endurance: 3, agility: 3, mana: 3, luck: 2 },
            availableStatPoints: 0,
            skillLevels: [2, 2, 2],
            customQuotes: { summon: r1.summonQuote, battleStart: r1.battleStartQuote, noblePhantasm: r1.noblePhantasm.chant, victory: r1.victoryQuote, defeat: r1.defeatQuote },
            bondLevel: 3,
            template: r1
          }, 'Shadow Rival Alpha');
          p2.id = 'shadow_master_rival_1';
          p2.name = r1.name;

          const p3 = createCombatantFromMasterServant({
            id: 'shadow_master_intervenor',
            masterId: 'shadow_master_intervenor',
            templateId: r2.id,
            level: 20,
            experience: 1000,
            allocatedStats: { strength: 3, endurance: 3, agility: 3, mana: 3, luck: 2 },
            availableStatPoints: 0,
            skillLevels: [2, 2, 2],
            customQuotes: { summon: r2.summonQuote, battleStart: r2.battleStartQuote, noblePhantasm: r2.noblePhantasm.chant, victory: r2.victoryQuote, defeat: r2.defeatQuote },
            bondLevel: 3,
            template: r2
          }, 'Shadow Intervenor Omega');
          p3.id = 'shadow_master_intervenor';
          p3.name = r2.name;

          let newBattle = initializeBattle(p1, p2);
          newBattle = forceJoinBattle(newBattle, p3, chosenSide || 'teamB');
          setActiveDuel({ battle: newBattle });

          addMessage({
            id: getNextId('bot_forcejoin_arena_start'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: `⚔️ 3-MASTER MULTI-COMBAT ARENA INITIATED!`,
              description:
                `🚨 **MULTI-COMBATANT ENGAGEMENT INITIALIZED!**\n\n` +
                `Master **${master.username}** entered the arena with **${p1.name}** against **${p2.name}** and 3rd combatant **${p3.name}**!\n\n` +
                `👥 **Team A:** ${newBattle.teamA.map(c => `**${c.name}** (${c.currentHp.toLocaleString()} HP)`).join(', ')}\n` +
                `👥 **Team B:** ${newBattle.teamB.map(c => `**${c.name}** (${c.currentHp.toLocaleString()} HP)`).join(', ')}\n\n` +
                `*Execute your Command Card sequence below to strike the enemy team!*`,
              color: '#ef4444',
              footer: 'Holy Grail War Multi-Combat Arena'
            },
            components: {
              type: 'buttons',
              items: [
                { id: 'duel_card_bbb', label: 'Buster Brave', style: 'danger', emoji: '🔴' },
                { id: 'duel_card_aaa', label: 'Arts Chain', style: 'primary', emoji: '🔵' },
                { id: 'duel_card_qqq', label: 'Quick Chain', style: 'success', emoji: '🟢' },
                { id: 'duel_tab_active', label: 'Open Battle Stage', style: 'secondary', emoji: '🥊' }
              ]
            }
          });
          return;
        }
      }

      // Handle /duel 2v2 or /duel alliance or /duel tag
      if (
        targetQuery === '2v2' ||
        targetQuery.startsWith('2v2') ||
        targetQuery === 'alliance' ||
        targetQuery.startsWith('alliance') ||
        targetQuery === 'tag'
      ) {
        const otherServants = allThrone.filter(s => s.id !== activeServant.templateId);
        const allyTemplate = otherServants[0] || allThrone[0];
        const enemy1Template = otherServants[1] || allThrone[1] || allThrone[0];
        const enemy2Template = otherServants[2] || allThrone[2] || allThrone[0];

        const p1 = createCombatantFromMasterServant(activeServant, master.username);
        const ally = createCombatantFromMasterServant({
          id: 'shadow_master_ally',
          masterId: 'shadow_master_ally',
          templateId: allyTemplate.id,
          level: 20,
          experience: 1000,
          allocatedStats: { strength: 3, endurance: 3, agility: 3, mana: 3, luck: 2 },
          availableStatPoints: 0,
          skillLevels: [2, 2, 2],
          customQuotes: { summon: allyTemplate.summonQuote, battleStart: allyTemplate.battleStartQuote, noblePhantasm: allyTemplate.noblePhantasm.chant, victory: allyTemplate.victoryQuote, defeat: allyTemplate.defeatQuote },
          bondLevel: 3,
          template: allyTemplate
        }, 'Allied Master Rin');
        ally.id = 'shadow_master_ally';
        ally.name = allyTemplate.name;

        const enemy1 = createCombatantFromMasterServant({
          id: 'shadow_master_enemy_1',
          masterId: 'shadow_master_enemy_1',
          templateId: enemy1Template.id,
          level: 20,
          experience: 1000,
          allocatedStats: { strength: 3, endurance: 3, agility: 3, mana: 3, luck: 2 },
          availableStatPoints: 0,
          skillLevels: [2, 2, 2],
          customQuotes: { summon: enemy1Template.summonQuote, battleStart: enemy1Template.battleStartQuote, noblePhantasm: enemy1Template.noblePhantasm.chant, victory: enemy1Template.victoryQuote, defeat: enemy1Template.defeatQuote },
          bondLevel: 3,
          template: enemy1Template
        }, 'Enemy Master Kirei');
        enemy1.id = 'shadow_master_enemy_1';
        enemy1.name = enemy1Template.name;

        const enemy2 = createCombatantFromMasterServant({
          id: 'shadow_master_enemy_2',
          masterId: 'shadow_master_enemy_2',
          templateId: enemy2Template.id,
          level: 20,
          experience: 1000,
          allocatedStats: { strength: 3, endurance: 3, agility: 3, mana: 3, luck: 2 },
          availableStatPoints: 0,
          skillLevels: [2, 2, 2],
          customQuotes: { summon: enemy2Template.summonQuote, battleStart: enemy2Template.battleStartQuote, noblePhantasm: enemy2Template.noblePhantasm.chant, victory: enemy2Template.victoryQuote, defeat: enemy2Template.defeatQuote },
          bondLevel: 3,
          template: enemy2Template
        }, 'Enemy Master Illya');
        enemy2.id = 'shadow_master_enemy_2';
        enemy2.name = enemy2Template.name;

        const multiBattle = initializeMultiBattle([p1, ally], [enemy1, enemy2], '2v2');
        setActiveDuel({ battle: multiBattle });

        addMessage({
          id: getNextId('bot_duel_2v2_start'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: `🛡️ 2v2 ALLIANCE CLASH INITIALIZED!`,
            description:
              `⚔️ **TEAM A ALLIANCE:**\n` +
              `• **${p1.name}** (Master: ${master.username}) — \`${p1.currentHp.toLocaleString()} HP\`\n` +
              `• **${ally.name}** (Master: Allied Master Rin) — \`${ally.currentHp.toLocaleString()} HP\`\n\n` +
              `⚔️ **TEAM B ALLIANCE:**\n` +
              `• **${enemy1.name}** (Master: Enemy Master Kirei) — \`${enemy1.currentHp.toLocaleString()} HP\`\n` +
              `• **${enemy2.name}** (Master: Enemy Master Illya) — \`${enemy2.currentHp.toLocaleString()} HP\`\n\n` +
              `✨ **Support Mechanic Active:** Ally & rival partners deliver coordinated support strikes (+25% bonus ATK) every turn!\n\n` +
              `👉 *Execute your 3-card Command sequence below to strike the enemy alliance:*`,
            color: '#3b82f6',
            footer: 'Holy Grail War • 2v2 Alliance Tag-Team Engagement'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'duel_card_bbb', label: 'Buster Brave', style: 'danger', emoji: '🔴' },
              { id: 'duel_card_aaa', label: 'Arts Chain', style: 'primary', emoji: '🔵' },
              { id: 'duel_card_qqq', label: 'Quick Chain', style: 'success', emoji: '🟢' },
              { id: 'duel_tab_active', label: 'Open Battle Stage', style: 'secondary', emoji: '🥊' }
            ]
          }
        });
        return;
      }

      // Handle /duel 1v2 or /duel raid
      if (
        targetQuery === '1v2' ||
        targetQuery.startsWith('1v2') ||
        targetQuery === 'raid' ||
        targetQuery.startsWith('raid')
      ) {
        const otherServants = allThrone.filter(s => s.id !== activeServant.templateId);
        const enemy1Template = otherServants[0] || allThrone[0];
        const enemy2Template = otherServants[1] || allThrone[1] || allThrone[0];

        const p1 = createCombatantFromMasterServant(activeServant, master.username);
        const enemy1 = createCombatantFromMasterServant({
          id: 'shadow_master_enemy_1',
          masterId: 'shadow_master_enemy_1',
          templateId: enemy1Template.id,
          level: 20,
          experience: 1000,
          allocatedStats: { strength: 3, endurance: 3, agility: 3, mana: 3, luck: 2 },
          availableStatPoints: 0,
          skillLevels: [2, 2, 2],
          customQuotes: { summon: enemy1Template.summonQuote, battleStart: enemy1Template.battleStartQuote, noblePhantasm: enemy1Template.noblePhantasm.chant, victory: enemy1Template.victoryQuote, defeat: enemy1Template.defeatQuote },
          bondLevel: 3,
          template: enemy1Template
        }, 'Enemy Vanguard');
        enemy1.id = 'shadow_master_enemy_1';
        enemy1.name = enemy1Template.name;

        const enemy2 = createCombatantFromMasterServant({
          id: 'shadow_master_enemy_2',
          masterId: 'shadow_master_enemy_2',
          templateId: enemy2Template.id,
          level: 20,
          experience: 1000,
          allocatedStats: { strength: 3, endurance: 3, agility: 3, mana: 3, luck: 2 },
          availableStatPoints: 0,
          skillLevels: [2, 2, 2],
          customQuotes: { summon: enemy2Template.summonQuote, battleStart: enemy2Template.battleStartQuote, noblePhantasm: enemy2Template.noblePhantasm.chant, victory: enemy2Template.victoryQuote, defeat: enemy2Template.defeatQuote },
          bondLevel: 3,
          template: enemy2Template
        }, 'Enemy Flanker');
        enemy2.id = 'shadow_master_enemy_2';
        enemy2.name = enemy2Template.name;

        const multiBattle = initializeMultiBattle([p1], [enemy1, enemy2], '1v2');
        setActiveDuel({ battle: multiBattle });

        addMessage({
          id: getNextId('bot_duel_1v2_start'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: `⚔️ 1v2 RAID CLASH INITIALIZED!`,
            description:
              `🚨 **SOLO SURVIVAL ENGAGEMENT:**\n\n` +
              `• **Solo Champion:** **${p1.name}** (Master: ${master.username}) — \`${p1.currentHp.toLocaleString()} HP\`\n\n` +
              `⚔️ **VERSUS ENEMY DUO:**\n` +
              `• **${enemy1.name}** (Vanguard) — \`${enemy1.currentHp.toLocaleString()} HP\`\n` +
              `• **${enemy2.name}** (Flanker) — \`${enemy2.currentHp.toLocaleString()} HP\`\n\n` +
              `👉 *Execute your 3-card Command sequence below to overcome the dual threat:*`,
            color: '#ef4444',
            footer: 'Holy Grail War • 1v2 Raid Clash Engagement'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'duel_card_bbb', label: 'Buster Brave', style: 'danger', emoji: '🔴' },
              { id: 'duel_card_aaa', label: 'Arts Chain', style: 'primary', emoji: '🔵' },
              { id: 'duel_card_qqq', label: 'Quick Chain', style: 'success', emoji: '🟢' },
              { id: 'duel_tab_active', label: 'Open Battle Stage', style: 'secondary', emoji: '🥊' }
            ]
          }
        });
        return;
      }

      // If invoked as `/duel` or with a Hub tab name
      if (!targetQuery || ['arena', 'lobby', 'history', 'leaderboard', 'rankings', 'hub', 'active'].includes(targetQuery)) {
        const cat = targetQuery === 'history' ? 'history' : targetQuery === 'leaderboard' || targetQuery === 'rankings' ? 'leaderboard' : targetQuery === 'active' ? 'active' : 'arena';
        setDuelHubCategory(cat);
        postDuelHub(cat);
        return;
      }

      let targetParticipant = Object.values(grailWar.participants).find(
        p =>
          (p.username.toLowerCase().includes(targetQuery) ||
          p.servantName.toLowerCase().includes(targetQuery) ||
          p.discordId.toLowerCase() === targetQuery) &&
          p.discordId !== master.discordId
      );

      // Support shadow matchmaking test if requested or if shadow_rival
      if (!targetParticipant && targetQuery === 'shadow_rival') {
        const otherServants = allThrone.filter(s => s.id !== activeServant.templateId);
        const randIdx = otherServants.length > 0 ? (master.username?.length || 1) % otherServants.length : 0;
        const randTemplate = otherServants[randIdx] || allThrone[0];
        targetParticipant = {
          discordId: 'shadow_master_rival',
          username: 'Shadow Rival Master',
          servantId: randTemplate.id,
          servantName: randTemplate.name,
          servantClass: randTemplate.servantClass,
          avatarUrl: randTemplate.avatarUrl,
          maxHp: randTemplate.baseHp || 14000,
          currentHp: randTemplate.baseHp || 14000,
          kills: 1,
          isAlive: true,
          isExposed: true
        } as any;
      }

      if (!targetParticipant) {
        const civilianMaster: any = (MASTERS_DATABASE as any[] || []).find(
          (m: any) =>
            m && m.username &&
            m.username.toLowerCase().includes(targetQuery) &&
            (!m.servants || m.servants.length === 0)
        );

        if (civilianMaster) {
          const alreadyDead = (grailWar.civilianCasualties || []).some(
            c => c.name.toLowerCase().includes(civilianMaster.username.toLowerCase()) || c.id === `civilian_${civilianMaster.username}`
          ) || Object.values(grailWar.participants).some(
            p => p.username.toLowerCase() === civilianMaster.username.toLowerCase() && !p.isAlive
          );

          if (alreadyDead) {
            addMessage({
              id: getNextId('bot_duel_civilian_already_dead'),
              sender: 'bot',
              timestamp: 'Just now',
              embed: {
                title: '☠️ CIVILIAN ALREADY SLAIN',
                description: `Civilian **${civilianMaster.username}** was already slain earlier in this Holy Grail War! A civilian cannot be killed twice.`,
                color: '#ef4444'
              }
            });
            return;
          }

          addMessage({
            id: getNextId('bot_duel_civilian_invite'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '⚔️ HOLY GRAIL WAR: DUEL INVITATION',
              description:
                `Master **${master.username}** has challenged civilian **${civilianMaster.username}** to a battle!\n\n` +
                `**${civilianMaster.username}**, do you accept this challenge?`,
              color: '#d4af37',
              footer: 'Holy Grail War • Civilian Challenge'
            },
            components: {
              type: 'buttons',
              items: [
                { id: `accept_civilian_duel_${civilianMaster.username}`, label: 'Accept Duel', style: 'success', emoji: '⚔️' },
                { id: `decline_civilian_duel_${civilianMaster.username}`, label: 'Decline', style: 'danger', emoji: '🏳️' }
              ]
            }
          });
          return;
        }

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

      const p1BattleQuote = activeServant.customQuotes?.battleStart || activeServant.template.battleStartQuote || "My blade is drawn. Let the battle commence!";
      const initialFlee = calculateFleeChance(
        p1.currentHp,
        p1.maxHp,
        p1.servantClass,
        activeServant.template.baseStats?.agility || 10
      );

      // Battle Start Visual Novel Dialogue Cut-In Card & Command Card Clash Prompt
      addMessage({
        id: getNextId('bot_duel_init'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: `⚔️ BATTLE START — ${p1.name.toUpperCase()} VS ${p2.name.toUpperCase()}`,
          description:
            `💬 **[BATTLE ENGAGEMENT] ${p1.name}:**\n> ❝ ***${p1BattleQuote}*** ❞\n\n` +
            `**${p1.name}** (Master: ${p1.masterName})\n` +
            `❤️ HP: **${p1.currentHp.toLocaleString()}/${p1.maxHp.toLocaleString()}** | ⚡ NP: **${Math.round(p1.npGauge)}%**\n\n` +
            `**VS**\n\n` +
            `**${p2.name}** (Master: ${p2.masterName})\n` +
            `❤️ HP: **${p2.currentHp.toLocaleString()}/${p2.maxHp.toLocaleString()}** | ⚡ NP: **${Math.round(p2.npGauge)}%**\n\n` +
            `*Select your 3-card Command sequence below:*`,
          color: '#ef4444',
          footer: 'Turn-Based RPG Combat Engine • Buster / Arts / Quick'
        },
        canvasType: 'dialogue',
        canvasPayload: {
          speaker: p1.name,
          quote: p1BattleQuote,
          title: 'BATTLE ENGAGEMENT',
          servantClass: activeServant.template.servantClass,
          avatarUrl: activeServant.template.cardArtUrl || activeServant.template.avatarUrl,
          bondOrLevel: activeServant.bondLevel || 10,
          defenderName: p2.name,
          defenderClass: p2.servantClass,
          defenderAvatarUrl: rivalTemplate.cardArtUrl || rivalTemplate.avatarUrl,
          sequence: ['Buster', 'Arts', 'Quick'],
          bgUrlOrPreset: 'fuyuki'
        },
        components: {
          type: 'buttons',
          items: [
            { id: 'duel_card_bbb', label: 'Buster Brave (ATK +50%)', style: 'danger', emoji: '🔴' },
            { id: 'duel_card_aaa', label: 'Arts Chain (NP +300%)', style: 'primary', emoji: '🔵' },
            { id: 'duel_card_qqq', label: 'Quick Chain (+20 Stars & Crits)', style: 'success', emoji: '🟢' },
            { id: 'duel_use_np', label: `Noble Phantasm (${Math.round(p1.npGauge)}%)`, style: 'danger', emoji: '💥', disabled: p1.npGauge < 100 },
            { id: 'duel_act_alliance_assist', label: 'Alliance Assist (+25%)', style: 'primary', emoji: '🛡️' },
            { id: 'duel_prompt_forcejoin', label: '⚡ Force Join', style: 'danger', emoji: '🚨' },
            { id: 'duel_flee', label: `Flee (${initialFlee.chancePercent}%)`, style: 'secondary', emoji: '🏃' }
          ]
        }
      });
      return;
    }

    // ----------------------------------------------------
    // COMMAND: /skill, /skills (Active Servant Skills)
    // ----------------------------------------------------
    if (trimmed === '/skill' || trimmed.startsWith('/skill ') || trimmed === '/skills' || trimmed.startsWith('/skills ') || trimmed.startsWith('/duel skill')) {
      if (!activeServant) {
        addMessage({
          id: getNextId('bot_skill_err'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: 'No Active Servant',
            description: 'You need an active Servant to view or activate skills! Summon one with `/summon ritual`.',
            color: '#ef4444'
          }
        });
        return;
      }

      const match = trimmed.match(/\b(1|2|3)\b/);
      if (match && activeDuel) {
        const skillIdx = parseInt(match[1], 10) - 1;
        const res = applyCombatantSkill(activeDuel.battle.player1, activeDuel.battle.player2, skillIdx);
        if (res.success) {
          setActiveDuel({
            ...activeDuel,
            battle: { ...activeDuel.battle }
          });
          if (res.isTransformation && res.transformationGif) {
            addMessage({
              id: getNextId('bot_transformation_gif'),
              sender: 'bot',
              timestamp: 'Just now',
              embed: {
                title: '🔴 TRANSFORMATION AWAKENED: SUPER AOKO!',
                description:
                  `✨ **${activeDuel.battle.player1.name}** ignited the **Fifth Magic: Red Hair Ignition**!\n\n` +
                  `> 💬 ❝ ***${res.quote || 'Fifth Magic—Circuits ignition! Time to kick this into maximum gear!'}*** ❞\n\n` +
                  `⚡ **Fifth Magic True Output:** ATK +30%, Crit DMG +40%, +15 Stars generated!`,
                color: '#ef4444',
                imageUrl: res.transformationGif,
                thumbnailUrl: res.transformedAvatarUrl || 'https://ella.janitorai.com/media-approved/zUtP5PQLU7fMKVyin9H-f.webp',
                footer: 'True Magic Ignition • Super Aoko Form Engaged'
              }
            });
          }
          addMessage({
            id: getNextId('bot_skill_use'),
            sender: 'bot',
            timestamp: 'Just now',
            content: res.log
          });
        } else {
          addMessage({
            id: getNextId('bot_skill_fail'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: 'Skill Failed',
              description: res.log,
              color: '#ef4444'
            }
          });
        }
        return;
      }

      // Display Servant Skills status
      const skills = activeDuel ? activeDuel.battle.player1.skills : activeServant.template.skills;
      const skillsDesc = skills && skills.length > 0
        ? skills.map((s, idx) => {
            const cd = (s as any).currentCooldown > 0 ? ` (Cooldown: ${(s as any).currentCooldown}t)` : ' (Ready)';
            return `• **Skill ${idx + 1}: ${s.name}** [CD: ${s.cooldown}T]${cd}\n  ${s.description}`;
          }).join('\n\n')
        : 'No skills found.';

      addMessage({
        id: getNextId('bot_skill_list'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: `⚡ ${activeServant.template.name} — Personal Skills`,
          description: `${skillsDesc}\n\n*Combat command:* Type \`/skill 1\`, \`/skill 2\`, or \`/skill 3\` during an active duel to trigger!`,
          color: '#d4af37'
        }
      });
      return;
    }

    // ----------------------------------------------------
    // COMMAND: /flee, /run, /retreat (Tactical Disengagement)
    // ----------------------------------------------------
    if (trimmed === '/flee' || trimmed === '/run' || trimmed === '/retreat' || trimmed.startsWith('/flee ') || trimmed.startsWith('/run ')) {
      if (!activeDuel) {
        addMessage({
          id: getNextId('bot_flee_no_duel'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '🏃 No Active Duel',
            description: 'You can only attempt a tactical flee or retreat during an active duel! Enter combat with `/duel`.',
            color: '#ef4444'
          }
        });
        return;
      }
      handleButtonClick('duel_flee');
      return;
    }

    // ----------------------------------------------------
    // COMMAND: /evacuate, /escape (Emergency Command Seal Evacuation)
    // ----------------------------------------------------
    if (trimmed === '/evacuate' || trimmed === '/escape' || trimmed === '/seal evacuate') {
      handleButtonClick('duel_command_seal_evacuate');
      return;
    }

    // ----------------------------------------------------
    // COMMAND 4.4: /daily, /claim (Daily 30 SQ Reward)
    // ----------------------------------------------------
    if (trimmed === '/daily' || trimmed.startsWith('/daily ') || trimmed === '/claim' || trimmed.startsWith('/claim ')) {
      const claimStatus = calculateDailyClaimCooldown(master.lastDailyClaim, master.saintQuartz || 0);

      if (!claimStatus.canClaim) {
        addMessage({
          id: getNextId('bot_daily_cooldown'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '⏳ DAILY HARVEST ON COOLDOWN',
            description:
              `**You have already claimed your daily 30 Saint Quartz today.**\n\n` +
              `👤 **Master:** **${master.username}**\n` +
              `💎 **Current Balance:** 💎 \`${claimStatus.currentSq.toLocaleString()} SQ\`\n\n` +
              `⏱️ **Time Remaining:** \`${claimStatus.formattedCooldown}\`\n` +
              `🔮 **Next Reset:** <t:${claimStatus.nextClaimTs}:R>\n\n` +
              `*The Fuyuki Leyline mana reservoirs recharge once every 24 hours. Check back tomorrow!*`,
            color: '#f59e0b',
            footer: '24-Hour Leyline Cooldown Active'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'quick_profile_view', label: 'View Profile', style: 'primary', emoji: '👤' },
              { id: 'quick_ce_gacha_view', label: 'Gacha Banner', style: 'secondary', emoji: '🎲' }
            ]
          }
        });
        return;
      }

      const updatedMaster: MasterProfile = {
        ...master,
        saintQuartz: claimStatus.newSq,
        lastDailyClaim: claimStatus.now
      };
      onUpdateMaster(updatedMaster);

      addMessage({
        id: getNextId('bot_daily_success'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: '💎 DAILY LEYLINE HARVEST: +30 SAINT QUARTZ CLAIMED!',
          description:
            `**Chaldea Daily Master Allowance Received!**\n\n` +
            `👤 **Master:** **${master.username}**\n` +
            `💎 **Harvested:** \`+30 Saint Quartz\` *(Full 10x Pull Value)*\n` +
            `📊 **New Total Balance:** 💎 \`${claimStatus.newSq.toLocaleString()} SQ\` (Previous: ${claimStatus.prevSq.toLocaleString()} SQ)\n\n` +
            `⏳ **Next Daily Claim:** Available in **24 Hours** (<t:${claimStatus.nextClaimTs}:R>)\n\n` +
            `*Tip: You now have enough Saint Quartz to perform a 10x Craft Essence banner roll with \`/cegacha\`!*`,
          color: '#38bdf8',
          footer: 'Holy Grail War Daily Allowance • Leyline Sanctuary Protocol'
        },
        components: {
          type: 'buttons',
          items: [
            { id: 'quick_ce_gacha_ten', label: 'Spend in 10x Gacha (30 SQ)', style: 'success', emoji: '💎' },
            { id: 'quick_profile_view', label: 'View Profile', style: 'secondary', emoji: '👤' }
          ]
        }
      });
      return;
    }

    // ----------------------------------------------------
    // COMMAND 4.5: /profile and /patrol
    // ----------------------------------------------------
    if (trimmed === '/profile' || trimmed.startsWith('/profile ') || trimmed.startsWith('/grailwar profile')) {
      if (trimmed.includes('public') || trimmed.includes('share') || trimmed.includes('boast')) {
        handleButtonClick('profile_share_public');
      } else {
        postProfileEmbed();
      }
      return;
    }

    if (trimmed.startsWith('/patrol') || trimmed.startsWith('/petrol') || trimmed.startsWith('/grailwar patrol') || trimmed.startsWith('!patrol') || trimmed.startsWith('!petrol')) {
      const chanTag = activeChannel === 'public' ? '#holy-grail-war' : activeChannel.startsWith('#') ? activeChannel : `#${activeChannel}`;
      const res = patrolCityInWar(grailWar, master.discordId, master.username, chanTag);
      onUpdateGrailWar(res.updatedWar);
      addMessage({
        id: getNextId('bot_patrol_res'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: '👁️ CITY PATROL RECONNAISSANCE REPORT',
          description: res.message,
          color: '#0284c7',
          footer: 'Stealth Reconnaissance • Wards & Traps Detected Safely (No Trigger)'
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
    // COMMAND 4.9: /church, /sanctuary, /bounty, /bounties, /reputation, /rep (Fuyuki Church Sanctuary & Bounty Board)
    // ----------------------------------------------------
    if (
      trimmed.startsWith('/church') ||
      trimmed.startsWith('/sanctuary') ||
      trimmed.startsWith('/bounty') ||
      trimmed.startsWith('/bounties') ||
      trimmed.startsWith('/reputation') ||
      trimmed.startsWith('/rep')
    ) {
      const uP = grailWar.participants[master.discordId] ||
        Object.values(grailWar.participants).find(p => p.username.toLowerCase() === master.username.toLowerCase());

      const kills = uP ? (uP.innocentKills || 0) : (master.innocentKills || 0);
      const rep = getReputationInfo(kills);
      const participants = Object.values(grailWar.participants || {});
      const rogueMasters = participants.filter(
        p => p.isAlive && (((p.innocentKills || 0) >= 10) || p.bountyActive || p.isRogueHeretic)
      );

      // Subcommand: /bounties or /bounty or /church bounties
      if (trimmed.startsWith('/bounty') || trimmed.startsWith('/bounties') || trimmed.includes('bount')) {
        let bountyListText = '';
        if (rogueMasters.length === 0) {
          bountyListText = '🕊️ **No Active Church Extermination Bounties.**\nAll active Masters are currently abiding by the Secrecy of Magecraft or haven\'t reached 10 civilian casualties.';
        } else {
          bountyListText = rogueMasters.map((r, idx) => {
            return `**${idx + 1}. ☠️ Master ${r.username}** (${r.servantName || 'Unknown Servant'} [${r.servantClass || 'Class'}])\n` +
              `   • **Civilian Casualties:** \`${r.innocentKills || 10} Kills\` (Excommunicated)\n` +
              `   • 🎯 **Bounty Reward:** **+1 Extra Command Seal** 💠 & **+15 Saint Quartz** 💎\n` +
              `   • **Status:** Permanently Barred from Church Sanctuary • Curse of Heresy Active`;
          }).join('\n\n');
        }

        addMessage({
          id: getNextId('bot_bounty_board'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '🎯 Holy Church Extermination Bounty Registry',
            description:
              `*Father Kirei Kotomine maintains this public bounty ledger at the Fuyuki Church altar.*\n\n` +
              `📜 **CHURCH EXTERMINATION BOUNTY PROTOCOL:**\n` +
              `• Any Master who slays **10+ innocent bystanders** is declared a **Rogue Heretic**.\n` +
              `• An open **+1 Command Seal & +15 Saint Quartz** bounty is placed on their head.\n` +
              `• Defeating or executing a wanted Rogue Heretic in battle or duel immediately awards the bounty to the victor!\n\n` +
              `🎯 **CURRENT WANTED LIST (${rogueMasters.length} Active):**\n` +
              bountyListText + '\n\n' +
              `👤 **YOUR CHURCH STANDING:**\n` +
              `• Rank: **${rep.badge}** (${kills}/10 Civilian Kills)\n` +
              `• Status: ${rep.isRogue ? '☠️ **WANTED ROGUE HERETIC (BOUNTY ON YOUR HEAD)**' : '🕊️ **Good Standing with Holy Church**'}`,
            color: rogueMasters.length > 0 ? '#ef4444' : '#d4af37',
            footer: 'Holy Church Inquisitorial Office • Father Kirei Kotomine'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'war_tab_church', label: 'Church Sanctuary ⛪', style: 'primary' },
              { id: 'war_tab_reputation', label: 'Reputation Dossier 📜', style: 'secondary' },
              { id: 'quick_war_status', label: 'War Board 📋', style: 'secondary' }
            ]
          }
        });
        return;
      }

      // Subcommand: /reputation or /rep or /church reputation
      if (trimmed.startsWith('/reputation') || trimmed.startsWith('/rep') || trimmed.includes('reputation') || trimmed.includes('rank')) {
        addMessage({
          id: getNextId('bot_rep_dossier'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '📜 Holy Church Reputation & Oversight Dossier',
            description:
              `*Overseer Father Kirei Kotomine observes all Masters participating in the Fuyuki Holy Grail War.*\n\n` +
              `👤 **MASTER STANDING: ${rep.badge}**\n` +
              `• **Civilian Casualties:** \`${kills}/10 Kills\`\n` +
              `• **Overseer Assessment:** *"${rep.description}"*\n` +
              `• **Church Sanctuary Eligibility:** ${rep.isRogue ? '🚫 **REVOKED (Excommunicated)**' : '🕊️ **ELIGIBLE (Neutral Asylum Granted on request)**'}\n` +
              `• **Combat Modifier:** ${rep.isRogue ? '⛓️ **Curse of Heresy (-10% ATK)**' : '✨ **Standard Leyline Alignment**'}\n\n` +
              `⚖️ **REPUTATION RANKS OVERVIEW:**\n` +
              `• 🕊️ **Honorable Magus (0-3 Kills):** Full sanctuary rights & Overseer protection.\n` +
              `• ⚠️ **Suspect Magus (4-6 Kills):** Under surveillance for collateral damage.\n` +
              `• 🩸 **Notorious Magus (7-9 Kills):** High scrutiny. Impending excommunication.\n` +
              `• ☠️ **Rogue Heretic (10+ Kills):** +1 CS & +15 SQ Extermination Bounty, barred from church sanctuary, exposed on war map, -10% ATK.`,
            color: rep.isRogue ? '#ef4444' : kills >= 7 ? '#f97316' : kills >= 4 ? '#eab308' : '#10b981',
            footer: 'Holy Church Inquisitorial Office • Father Kirei Kotomine'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'war_tab_church', label: 'Church Sanctuary ⛪', style: 'primary' },
              { id: 'war_tab_bounties', label: 'Bounty Registry 🎯', style: 'secondary' },
              { id: 'quick_war_status', label: 'War Board 📋', style: 'secondary' }
            ]
          }
        });
        return;
      }

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
              { id: 'war_tab_bounties', label: 'Bounty Registry 🎯', style: 'secondary' },
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
              { id: 'war_tab_bounties', label: 'Bounty Registry 🎯', style: 'secondary' },
              { id: 'quick_war_defenses', label: 'Mage Defenses 🏰', style: 'secondary' }
            ]
          }
        });
        return;
      }

      // Default status view
      const inSanctuary = !!uP.inSanctuary;
      let bountySummary = '';
      if (rogueMasters.length > 0) {
        bountySummary = `\n\n🎯 **ACTIVE CHURCH EXTERMINATION BOUNTIES (${rogueMasters.length} WANTED):**\n` +
          rogueMasters.map(r => `• ☠️ **${r.username}** (${r.servantName || 'Servant'}) — **${r.innocentKills || 10} Civilian Kills** (+1 CS & +15 SQ Reward)`).join('\n');
      } else {
        bountySummary = `\n\n🎯 **CHURCH BOUNTY REGISTRY:** No active rogue heretics wanted at this time.`;
      }

      let standingLine = `• **Your Church Standing:** ${rep.badge} (\`${kills}/10\` Civilian Kills)\n`;
      if (rep.isRogue) {
        standingLine += `  ↳ ☠️ **EXCOMMUNICATED:** Barred from asylum. Bounty of +1 CS & +15 SQ active on your head.\n`;
      } else if (kills >= 7) {
        standingLine += `  ↳ 🩸 **Critical Warning:** Approaching 10 kills excommunication threshold.\n`;
      } else if (kills >= 4) {
        standingLine += `  ↳ ⚠️ **Reprimanded:** Monitored for Secrecy of Magecraft violations.\n`;
      } else {
        standingLine += `  ↳ 🕊️ **Good Standing:** Full sanctuary and arbitration rights active.\n`;
      }

      addMessage({
        id: getNextId('bot_church_status'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: '⛪ Fuyuki Church — Neutral Sanctuary Grounds',
          description:
            `*Father Kirei Kotomine presides over the neutral grounds of the Fuyuki Church.*\n\n` +
            `Under Holy Church oversight and imperial leylines, Masters seeking reprieve from the Holy Grail War may claim sanctuary here.\n\n` +
            `• **Your Sanctuary Status:** ${inSanctuary ? '🕊️ **ACTIVE ASYLUM** (Immune to all ambushes & attacks)' : '⚔️ **IN THE FIELD** (Active combatant)'}\n` +
            standingLine +
            `• **Asylum Inviolability:** No Master may target, ambush, or skirmish against anyone sheltered within the church.\n` +
            `• **Truce Binding:** Masters in sanctuary cannot launch ambushes or attack rivals until they formally depart.` +
            bountySummary +
            `\n\n*Use the interactive buttons below or commands \`/church enter\`, \`/church leave\`, \`/bounties\`:*`,
          color: rep.isRogue ? '#ef4444' : inSanctuary ? '#10b981' : '#6366f1',
          footer: 'Holy Church Overseer Protocol • Fuyuki City Neutral Zone'
        },
        components: {
          type: 'buttons',
          items: [
            inSanctuary
              ? { id: 'church_leave', label: 'Leave Sanctuary (Re-enter War) 🚪', style: 'danger' }
              : { id: 'church_enter', label: 'Enter Church Sanctuary ⛪', style: 'primary', disabled: rep.isRogue },
            { id: 'war_tab_bounties', label: 'Bounty Registry 🎯', style: 'secondary' },
            { id: 'war_tab_reputation', label: 'Reputation Dossier 📜', style: 'secondary' },
            { id: 'quick_war_status', label: 'War Board 📋', style: 'secondary' }
          ]
        }
      });
      return;
    }

    // ----------------------------------------------------
    // COMMAND 5: /grailwar, /grail, /board, /war, /attack, /leak, /defenses, /familiar, /trap
    // ----------------------------------------------------
    if (trimmed.startsWith('/grailwar') || trimmed.startsWith('/grail') || trimmed.startsWith('/board') || trimmed.startsWith('/war') || trimmed.startsWith('/attack') || trimmed.startsWith('/leak') || trimmed.startsWith('/ambush') || trimmed.startsWith('/defenses') || trimmed.startsWith('/ward') || trimmed.startsWith('/evade') || trimmed.startsWith('/familiar') || trimmed.startsWith('/familiars') || trimmed.startsWith('/trap') || trimmed.startsWith('/traps') || trimmed.startsWith('/heal') || trimmed.startsWith('/rest')) {
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

      // SUB-CASE TRAPS: /grailwar trap, /traps, /trap set, /trap disarm, /trap list
      if (isTraps) {
        let targetSector: string | null = null;

        // 1. Check channel option: channel:#channel or channel:channel or channel: #channel
        const channelOptMatch = trimmed.match(/channel:\s*([#a-zA-Z0-9_-]+)/i);
        if (channelOptMatch) {
          const raw = channelOptMatch[1].trim();
          targetSector = raw.startsWith('#') ? raw : `#${raw}`;
        }

        // 2. Check Discord mention <#12345>
        if (!targetSector) {
          const mentionMatch = trimmed.match(/<#([a-zA-Z0-9_-]+)>/);
          if (mentionMatch) {
            targetSector = `#${mentionMatch[1]}`;
          }
        }

        // 3. Check explicit #hashtag: #fuyuki-bridge, #general, etc.
        if (!targetSector) {
          const channelMatch = trimmed.match(/#([a-zA-Z0-9_-]+)/);
          if (channelMatch) {
            targetSector = `#${channelMatch[1]}`;
          }
        }

        // 4. Check known effectiveChannels names or ids
        if (!targetSector) {
          const words = trimmed.toLowerCase().split(/\s+/);
          for (const sec of effectiveChannels) {
            if (words.includes(sec.name.toLowerCase()) || words.includes(sec.id.toLowerCase())) {
              targetSector = sec.id;
              break;
            }
          }
        }

        if (targetSector) {
          const matchedTarget = targetSector;
          setServerChannels(prev => {
            if (prev.some(c => c.id.toLowerCase() === matchedTarget.toLowerCase())) return prev;
            const clean = matchedTarget.replace(/^#/, '');
            return [
              ...prev,
              {
                id: matchedTarget,
                name: clean,
                label: clean,
                emoji: '💬',
                desc: 'Discord Text Channel'
              }
            ];
          });
        }

        if (trimmed.includes('disarm') || trimmed.includes('clear')) {
          const res = disarmChannelTrapsInWar(grailWar, master.discordId, targetSector || undefined);
          onUpdateGrailWar(res.updatedWar);
          postTrapsRadarOverview(res.message);
          return;
        }

        const isSanctuary = trimmed.includes('sanctuary') || trimmed.includes('ward');
        const isDecoy = trimmed.includes('decoy');
        const isAlarm = trimmed.includes('alarm');
        const isDrain = trimmed.includes('drain') || trimmed.includes('bloodfort');

        if (isSanctuary) {
          const targetChan = targetSector || activePublicSector;
          const res = setWorkshopWardInWar(grailWar, master.discordId, 'ward', targetChan);
          onUpdateGrailWar(res.updatedWar);
          onUpdateMaster({ ...master, boundedField: 'ward', sanctuaryChannelName: targetChan });
          addMessage({
            id: getNextId('bot_trap_sanctuary'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: `🛡️ Mage Sanctuary Established in ${targetChan}`,
              description: res.message,
              color: '#3b82f6',
              footer: `Sanctuary Sector: ${targetChan} • Sole HP Auto-Regen active`
            }
          });
          return;
        }

        if (isDecoy) {
          const res = setWorkshopWardInWar(grailWar, master.discordId, 'decoy');
          onUpdateGrailWar(res.updatedWar);
          onUpdateMaster({ ...master, boundedField: 'decoy' });
          addMessage({
            id: getNextId('bot_trap_decoy'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: `🗿 Homunculus Decoy Activated`,
              description: res.message,
              color: '#8b5cf6',
              footer: `Workshop Decoy • Absorbs next incoming strike`
            }
          });
          return;
        }

        if (isAlarm && targetSector) {
          const res = setChannelTrapInWar(grailWar, master.discordId, master.username, targetSector, 'alarm');
          onUpdateGrailWar(res.updatedWar);
          postTrapsRadarOverview(res.message);
          return;
        }

        if (isDrain && targetSector) {
          const res = setChannelTrapInWar(grailWar, master.discordId, master.username, targetSector, 'drain');
          onUpdateGrailWar(res.updatedWar);
          postTrapsRadarOverview(res.message);
          return;
        }

        // If user typed /trap set <#channel> or /trap set without trap type, prompt them for that channel or open selector
        if (trimmed.includes('set') && targetSector) {
          addMessage({
            id: getNextId('bot_prompt_trap_type'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: `🕸️ Establish Bounded Field in ${targetSector}`,
              description:
                `Select which type of Bounded Field to anchor in **${targetSector}**:\n\n` +
                `• 🛡️ **Mage Sanctuary:** Absorbs 60% ambush DMG & enables passive Leyline HP Auto-Regen in this channel.\n` +
                `• 🚨 **Alarm Ward:** Concealed sensory ward that alerts you and exposes intruder identity & Servant class.\n` +
                `• 🩸 **Bloodfort Mana Drain:** Siphons 1,800–2,600 HP from rival intruders to replenish your Servant.\n\n` +
                `*Click an action below to establish the field:*`,
              color: '#8b5cf6',
              footer: `Target Sector: ${targetSector} • Choose Bounded Field type`
            },
            components: {
              type: 'buttons',
              items: [
                { id: `anchor_trap_sanctuary_${targetSector}`, label: `Anchor Sanctuary (${targetSector})`, style: 'primary', emoji: '🛡️' },
                { id: `anchor_trap_alarm_${targetSector}`, label: `Anchor Alarm Ward (${targetSector})`, style: 'secondary', emoji: '🚨' },
                { id: `anchor_trap_drain_${targetSector}`, label: `Anchor Bloodfort Drain (${targetSector})`, style: 'danger', emoji: '🩸' },
                { id: 'refresh_traps_radar', label: 'Back to Radar', style: 'secondary', emoji: '⬅️' }
              ]
            }
          });
          return;
        }

        if (isAlarm && !targetSector) {
          postChannelSelectorPrompt('alarm');
          return;
        }

        if (isDrain && !targetSector) {
          postChannelSelectorPrompt('drain');
          return;
        }

        if (trimmed.includes('set')) {
          postChannelSelectorPrompt('alarm');
          return;
        }

        // Default: display full Bounded Field & Leyline Radar
        postTrapsRadarOverview();
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
          onUpdateMaster({ ...master, boundedField: 'alarm' });
        } else if (trimmed.includes('ward sanctuary') || trimmed.includes('ward ward') || (trimmed.startsWith('/ward') && !trimmed.includes('none') && !trimmed.includes('alarm'))) {
          const res = executeWarAction(currentWar, master.discordId, 'set_ward', 'ward');
          currentWar = res.updatedWar;
          actionMsg = res.message;
          onUpdateGrailWar(currentWar);
          onUpdateMaster({ ...master, boundedField: 'ward' });
        } else if (trimmed.includes('ward none')) {
          const res = executeWarAction(currentWar, master.discordId, 'set_ward', 'none');
          currentWar = res.updatedWar;
          actionMsg = res.message;
          onUpdateGrailWar(currentWar);
          onUpdateMaster({ ...master, boundedField: 'none' });
        } else if (trimmed.includes('evade off')) {
          const res = executeWarAction(currentWar, master.discordId, 'toggle_evade', 'off');
          currentWar = res.updatedWar;
          actionMsg = res.message;
          onUpdateGrailWar(currentWar);
          onUpdateMaster({ ...master, autoConsumeCommandSeal: false });
        } else if (trimmed.includes('evade on')) {
          const res = executeWarAction(currentWar, master.discordId, 'toggle_evade', 'on');
          currentWar = res.updatedWar;
          actionMsg = res.message;
          onUpdateGrailWar(currentWar);
          onUpdateMaster({ ...master, autoConsumeCommandSeal: true });
        }

        const uP = currentWar.participants[master.discordId];
        const wardType = uP?.boundedField || 'none';
        const evadeOn = uP?.autoEvadeEnabled === true;
        const seals = uP?.commandSeals ?? 3;
        const inSanctuary = !!uP?.inSanctuary;
        const userTraps = (currentWar.channelTraps || []).filter(t => t.setterMasterId === master.discordId);

        let wardDesc = '🚫 **No Active Wards:** Your workshop has no perimeter defenses.';
        if (wardType === 'ward') {
          wardDesc = '🛡️ **Mage\'s Sanctuary Bounded Field:** Absorbs & deflects **60% of incoming ambush damage**.';
        } else if (wardType === 'alarm') {
          wardDesc = '🚨 **Intrusion Alarm Trap:** Detects infiltrators, alerting you and dealing **3,000 retaliatory DMG**.';
        }

        const channelTrapsDesc = userTraps.length > 0
          ? userTraps.map(t => `• ${t.trapType === 'alarm' ? '🚨' : '🩸'} **${t.channelName}** (${t.trapType === 'alarm' ? 'Sensory Alarm Ward' : 'Bloodfort Mana Drain'})`).join('\n')
          : '• *None active (0/2). Use `/trap` or Traps Radar to establish territory.*';

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
              `🛡️ **Workshop Bounded Field:**\n${wardDesc}\n\n` +
              `🕸️ **Channel Bounded Fields Deployed (${userTraps.length}/2):**\n${channelTrapsDesc}\n\n` +
              `⛪ **Fuyuki Church Sanctuary:**\n` +
              (inSanctuary
                ? `• **🕊️ ACTIVE ASYLUM:** Sheltered under Father Kotomine. 100% immune to all ambushes & attacks (cannot attack rivals).\n\n`
                : `• **⚔️ IN THE FIELD:** Active combatant in Holy Grail War territory.\n\n`) +
              `🔴 **Command Seal Emergency Evacuation (Auto-consume):**\n` +
              (evadeOn
                ? `• **🟢 ENABLED:** When taking fatal damage, automatically consumes **1 Command Seal** to escape with **1 HP**.\n`
                : `• **🔴 DISABLED (Default):** Auto-consume is OFF. You retain full control to manually invoke Command Seals or decide during combat.\n`) +
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
                id: 'war_tab_traps',
                label: `Traps Radar (${userTraps.length}/2)`,
                style: 'secondary',
                emoji: '🕸️'
              },
              {
                id: inSanctuary ? 'church_leave' : 'church_enter',
                label: inSanctuary ? 'Leave Sanctuary 🚪' : 'Church Sanctuary ⛪',
                style: inSanctuary ? 'danger' : 'primary'
              },
              {
                id: 'toggle_auto_evade',
                label: evadeOn ? 'Auto-Evac: ON 🟢' : 'Auto-Evac: OFF (Default) 🔴',
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

      // SUB-CASE A: /grailwar attack <target>, /attack <target>, /ambush <target>
      if (isAttack) {
        let targetQuery = rawCmd
          .replace(/^\/?(?:grailwar\s+)?(?:attack|ambush)\s*/i, '')
          .trim();

        if (!activeServant) {
          addMessage({
            id: getNextId('bot_attack_no_servant'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '❌ No Contracted Servant',
              description: 'You cannot launch an ambush without a contracted Servant! Perform a summoning ritual using `/summon ritual` first.',
              color: '#ef4444'
            },
            components: {
              type: 'buttons',
              items: [
                { id: 'quick_summon_ritual', label: 'Summon Servant (!summon)', style: 'success', emoji: '✨' }
              ]
            }
          });
          return;
        }

        if (!targetQuery) {
          addMessage({
            id: getNextId('bot_attack_help'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '⚔️ Holy Grail War: Covert Ambush & Attack',
              description:
                `Launch a covert strike on any user in the server to expose hidden Masters!\n\n` +
                `**Usage:**\n` +
                `• \`/attack <@user | MasterName | #slot>\`\n` +
                `• \`/ambush <@user | MasterName | #slot>\`\n` +
                `• \`/ambush list\` (View target registry & rogue bounties)\n` +
                `• \`/grailwar attack <target>\`\n\n` +
                `**Ambush Mechanics:**\n` +
                `🎯 **Target is a Rival Master:**\n` +
                `Your Servant strikes from the shadows dealing heavy damage. Their true Master identity and Servant are **EXPOSED** on the war board! (You remain hidden unless intercepted by an Alarm Ward or Assassin Servant).\n\n` +
                `☠️ **Target is an Innocent User:**\n` +
                `The bystander is slain as collateral damage, and the Church issues an emergency "gas leak explosion" cover-up bulletin. **Your identity is publicly EXPOSED** for violating the Secrecy of Magecraft!\n\n` +
                `⚠️ **Reputation System:** Masters with 10+ civilian kills become **Rogue Heretics** with permanent Church Bounties (+1 CS & +15 SQ) and lose Church sanctuary!`,
              color: '#ef4444'
            },
            components: {
              type: 'buttons',
              items: [
                { id: 'war_attack_prompt', label: 'Ambush Suspect', style: 'danger', emoji: '⚔️' },
                { id: 'quick_war_status', label: 'View Intelligence Board', style: 'primary', emoji: '📋' }
              ]
            }
          });
          return;
        }

        if (targetQuery.toLowerCase() === 'list') {
          const parts = Object.values(grailWar.participants || {});
          const lines = parts.map((p, idx) => {
            const isRogue = (p.innocentKills || 0) >= 10 || p.bountyActive;
            const inSanc = p.inSanctuary || (p as any).inChurchSanctuary;
            const nameLabel = isRogue || p.isExposed || !p.isAlive ? p.username : `Shadow Master #${idx + 1}`;
            const sLabel = isRogue || p.isExposed || !p.isAlive ? `${p.servantName} (${p.servantClass})` : '[Classified]';
            let tag = p.isAlive ? (p.isExposed ? '`[EXPOSED]`' : '`[HIDDEN]`') : '`[FALLEN]`';
            if (isRogue) tag = '`[☠️ WANTED HERETIC - 15 SQ BOUNTY]`';
            else if (inSanc) tag += ' `[⛪ CHURCH SANCTUARY]`';
            return `${p.isAlive ? (isRogue ? '☠️' : '🟢') : '💀'} **${nameLabel}** ${tag} — Servant: *${sLabel}* | HP: \`${calculateCurrentHp(p)}/${p.maxHp}\``;
          });

          addMessage({
            id: getNextId('bot_ambush_list'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '🗺️ Ambush Target Registry & Leyline Surveillance',
              description:
                `*Surveillance records of all recognized Masters operating in Fuyuki City:*\n\n` +
                (lines.length > 0 ? lines.join('\n') : '*No Masters detected in the sector.*') +
                `\n\n🎯 **Extermination Bounty:** Defeating a Rogue Heretic (10+ civilian kills) grants **+1 Extra Command Seal** & **+15 Saint Quartz**!`,
              color: '#ef4444'
            },
            components: {
              type: 'buttons',
              items: [
                { id: 'war_attack_prompt', label: 'Ambush Suspect', style: 'danger', emoji: '⚔️' },
                { id: 'quick_war_status', label: 'War Board 📋', style: 'secondary' }
              ]
            }
          });
          return;
        }

        let currentWar = grailWar;
        let userParticipant = currentWar.participants[master.discordId] ||
          Object.values(currentWar.participants).find(p => p.username.toLowerCase() === master.username.toLowerCase());

        if (!userParticipant && activeServant) {
          currentWar = createHolyGrailWarSession({
            discordId: master.discordId,
            username: master.username,
            servantId: activeServant.templateId,
            servantName: activeServant.template.name,
            servantClass: activeServant.template.servantClass,
            avatarUrl: master.avatarUrl,
            maxHp: calculateServantMaxHp(activeServant)
          });
          onUpdateGrailWar(currentWar);
        }

        const chanTag = activeChannel === 'public' ? '#holy-grail-war' : '#general';
        const res = attackSuspectUserInWar(currentWar, master.discordId, targetQuery, chanTag);
        onUpdateGrailWar(res.updatedWar);

        if (!res.success) {
          const isChurch = res.message.includes('Fuyuki Church');
          addMessage({
            id: getNextId('bot_attack_fail'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: isChurch ? '⛪ Fuyuki Church Neutral Grounds' : '⚠️ Ambush Blocked',
              description: res.message,
              color: isChurch ? '#10b981' : '#f59e0b',
              footer: isChurch
                ? 'Depart church asylum (/church leave) to resume offensive actions'
                : 'Action prevented by Holy Grail War rules'
            },
            components: {
              type: 'buttons',
              items: isChurch
                ? [
                    { id: 'church_leave', label: 'Depart Sanctuary 🚪', style: 'danger' },
                    { id: 'war_tab_church', label: 'Church Sanctuary ⛪', style: 'secondary' }
                  ]
                : [
                    { id: 'quick_war_status', label: 'View Intelligence Board', style: 'primary', emoji: '📋' },
                    { id: 'war_attack_prompt', label: 'Ambush Suspect', style: 'danger', emoji: '⚔️' }
                  ]
            }
          });
          return;
        }

        const attackerParticipant = res.updatedWar.participants[master.discordId] ||
          Object.values(res.updatedWar.participants).find(p => p.username.toLowerCase() === master.username.toLowerCase());

        let footerText = '';
        if (!res.targetWasMaster) {
          if (res.wasAlreadyExposed) {
            footerText = 'Attacking Master was already publicly exposed on the War Board';
          } else {
            footerText = 'Attacking Master identity is now publicly EXPOSED for violating Secrecy of Magecraft!';
          }
        } else if (attackerParticipant?.isExposed) {
          footerText = 'Both Masters are now EXPOSED on the Grail War Status Board (/grailwar status)';
        } else {
          footerText = 'Target Master identity is now EXPOSED! You remain concealed in the shadows (/grailwar status)';
        }

        let pingContent: string | undefined = undefined;
        if (res.targetWasMaster) {
          const pingTarget = res.targetMasterDiscordId ? `<@${res.targetMasterDiscordId}>` : (targetQuery.startsWith('<@') ? targetQuery : `@${res.targetMasterUsername || targetQuery}`);
          pingContent = `🚨 ${pingTarget} ⚔️ **AMBUSH ALERT! You are under attack in the Holy Grail War!**`;
        } else {
          const pingTarget = targetQuery.startsWith('<@') ? targetQuery : `@${targetQuery.replace(/^@/, '')}`;
          pingContent = `☠️ ${pingTarget} 💥 **COLLATERAL CASUALTY ALERT! Caught in magecraft crossfire!**`;
        }

        addMessage({
          id: getNextId('bot_attack_res'),
          sender: 'bot',
          timestamp: 'Just now',
          content: pingContent,
          embed: {
            title: res.targetWasMaster
              ? '⚔️ TACTICAL AMBUSH: RIVAL MASTER ENGAGED!'
              : '☠️ COLLATERAL CASUALTY: CIVILIAN SLAIN!',
            description: res.message,
            color: res.targetWasMaster ? '#ef4444' : '#7f1d1d',
            footer: footerText
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
        if (result.success && activeServant) {
          const updatedHp = result.updatedWar.participants[master.discordId]?.currentHp;
          if (updatedHp !== undefined) {
            const updatedServants = master.servants.map(s => s.id === activeServant.id ? {
              ...s,
              currentHp: updatedHp,
              baseHpAtDamage: updatedHp,
              lastDamageTime: Date.now()
            } : s);
            onUpdateMaster({ ...master, servants: updatedServants });
          }
        }

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

      // SUB-CASE E: /grailwar, /grail, /board, /war (Holy Grail War Hub & Operations Board)
      let targetCat: 'board' | 'casualties' | 'leaks' | 'battles' | 'defenses' | 'familiars' | 'traps' | 'church' = 'board';
      if (trimmed.includes('casualt') || trimmed.includes('death')) {
        targetCat = 'casualties';
      } else if (trimmed.includes('leak') || trimmed.includes('intel')) {
        targetCat = 'leaks';
      } else if (trimmed.includes('battle') || trimmed.includes('clash') || trimmed.includes('skirmish')) {
        targetCat = 'battles';
      } else if (trimmed.includes('defens') || trimmed.includes('ward')) {
        targetCat = 'defenses';
      } else if (trimmed.includes('familiar')) {
        targetCat = 'familiars';
      } else if (trimmed.includes('trap')) {
        targetCat = 'traps';
      } else if (trimmed.includes('church') || trimmed.includes('sanctuary')) {
        targetCat = 'church';
      }

      setGrailWarHubCategory(targetCat);
      postGrailWarHub(targetCat);
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
          `• \`!daily\` / \`!claim\` — Claim daily Master allowance of 30 Saint Quartz (SQ)\n` +
          `• \`!np <name>\` / \`!art <name>\` — View animated Noble Phantasm cinematics & full card artwork\n` +
          `• \`!summon [ritual | status | release]\` — Summon a random Heroic Spirit to contract\n` +
          `• \`!servant\` — View your contracted Servant profile, radar card, and voice lines\n` +
          `• \`!heal\` — Perform workshop leylines healing ritual\n` +
          `• \`!duel [@master]\` — Challenge a rival Master to turn-based RPG combat\n` +
          `• \`!attack <@user>\` / \`!ambush <@user>\` — Ambush a suspected Master (if innocent, bystander dies & you are exposed!)\n` +
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

  // Helper: Post List of Servants with Interactive Select Dropdown & Pagination Buttons
  const postServantsList = (
    servantsList: ServantTemplate[],
    headerTitle?: string,
    headerSubtitle?: string,
    page = 1,
    originFilter: 'all' | 'canon' | 'custom' = 'all',
    classFilter: string = 'all',
    searchKeyword?: string
  ) => {
    let filtered = servantsList;
    if (originFilter === 'canon') filtered = filtered.filter(s => !s.isCustomOrMeme);
    if (originFilter === 'custom') filtered = filtered.filter(s => s.isCustomOrMeme);
    if (classFilter !== 'all') filtered = filtered.filter(s => s.servantClass.toLowerCase() === classFilter.toLowerCase());
    if (searchKeyword && searchKeyword.trim()) {
      const q = searchKeyword.trim().toLowerCase();
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(q) ||
        s.servantClass.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.noblePhantasm.name.toLowerCase().includes(q)
      );
    }

    const pageSize = 8;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const pageItems = filtered.slice(startIndex, startIndex + pageSize);

    const getEmoji = (cls: string) => {
      switch (cls.toLowerCase()) {
        case 'saber': return '⚔️';
        case 'archer': return '🏹';
        case 'lancer': return '🔱';
        case 'rider': return '🐎';
        case 'caster': return '🪄';
        case 'assassin': return '🗡️';
        case 'berserker': return '🩸';
        case 'ruler': return '⚖️';
        case 'avenger': return '🌑';
        default: return '⚔️';
      }
    };

    let listLines: string[] = [];
    if (pageItems.length === 0) {
      listLines = ['• *No Heroic Spirits match the selected filter. Click the filter buttons below to change criteria.*'];
    } else {
      listLines = pageItems.map((s, idx) => {
        const tag = s.isCustomOrMeme ? '🛠️ [CUSTOM]' : '🏛️ [CANON]';
        const emoji = getEmoji(s.servantClass);
        return `${startIndex + idx + 1}. ${emoji} **${s.name}** — *${s.title}* [\`${s.servantClass}\`] ${tag}\n   └ *NP:* **${s.noblePhantasm.name}** | HP: \`${s.baseHp.toLocaleString()}\` | ATK: \`${s.baseAtk.toLocaleString()}\``;
      });
    }

    const selectOptions = pageItems.map(s => ({
      value: `view_servant_${s.id}`,
      label: `${s.name} (${s.servantClass})`,
      description: `${s.servantClass} • ${s.title || s.noblePhantasm.name}`,
      emoji: getEmoji(s.servantClass)
    }));

    const originLabel = originFilter === 'canon' ? '🏛️ Canon' : originFilter === 'custom' ? '🛠️ Custom' : '🌐 All';
    const classLabel = classFilter === 'all' ? '🏷️ All Classes' : `🏷️ ${classFilter}`;

    const navButtons = [
      { id: 'servant_list_prev', label: 'Prev', style: 'secondary' as const, emoji: '◀️', disabled: currentPage <= 1 },
      { id: 'servant_list_info', label: `${currentPage}/${totalPages}`, style: 'secondary' as const, disabled: true },
      { id: 'servant_list_next', label: 'Next', style: 'secondary' as const, emoji: '▶️', disabled: currentPage >= totalPages },
      { id: 'servant_list_class', label: classLabel, style: 'primary' as const },
      { id: 'servant_list_origin', label: originLabel, style: 'primary' as const }
    ];

    addMessage({
      id: getNextId('bot_servants_list'),
      sender: 'bot',
      timestamp: 'Just now',
      embed: {
        title: headerTitle || `📜 Throne of Heroes Registry (${filtered.length} Servants)`,
        description:
          (headerSubtitle ? `${headerSubtitle}\n\n` : `Select any Heroic Spirit below to inspect their complete status parameters, radar card, and Noble Phantasm:\n\n`) +
          listLines.join('\n\n'),
        color: '#d4af37',
        footer: `Page ${currentPage} of ${totalPages} • Filter: [${originFilter.toUpperCase()} • ${classFilter.toUpperCase()}] • Use dropdown to select`
      },
      components: {
        type: 'list_menu',
        placeholder: '🔍 Select a Heroic Spirit to inspect dossier...',
        selectOptions,
        items: navButtons
      }
    });
  };

  // Helper: Post Full Profile of a specific Servant Template to Everyone
  const postServantFullProfile = (template: ServantTemplate) => {
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
      canvasType: 'servant',
      canvasPayload: { servant: tempInstance, masterName: 'Throne of Heroes' },
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
          `• **Heroic Spirit:** **${template.name}** — *${template.title}* [\`${template.servantClass}\`]\n` +
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
          `Class: **${template.servantClass}** | Origin: **${template.isCustomOrMeme ? '🛠️ Custom Administrator Creation' : '🏛️ Canon Heroic Spirit'}** | Status: **⚖️ Balanced Parity**\n\n` +
          `📜 **Legend & Lore:**\n> ${template.lore || 'A legendary soul recorded in the Throne of Heroes.'}\n\n` +
          `💥 **Noble Phantasm:** *${template.noblePhantasm.name}* (${template.noblePhantasm.cardType})`,
        color: template.servantClass === 'Saber' ? '#3b82f6' : '#d4af37',
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
    const curServant = master.servants?.find(s => s.id === master.activeServantId) || master.servants?.[0];

    if (!curServant || !master.servants || master.servants.length === 0) {
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
    const seals = userParticipant?.commandSeals ?? master.commandSeals ?? 3;
    const isExposed = userParticipant?.isExposed;
    const isUnderSanctuary = userParticipant?.inSanctuary || userParticipant?.inChurchSanctuary;

    let wardLabel = '🚫 **No Wards Active** *(No perimeter defenses)*';
    if (ward === 'ward') {
      wardLabel = '🛡️ **Mage Sanctuary Bounded Field** *(Absorbs 60% Ambush DMG & Auto-Heals)*';
    } else if (ward === 'alarm') {
      wardLabel = '🚨 **Intrusion Alarm Trap** *(Alerts & Deals 3,000 retaliatory DMG)*';
    }

    const myChannelTraps = (grailWar.channelTraps || []).filter(t => t.setterMasterId === master.discordId);
    const channelTrapsSummary = myChannelTraps.length > 0
      ? myChannelTraps.map(t => `\`${t.channelName}\` (${t.trapType === 'alarm' ? '🚨 Alarm' : '🩸 Bloodfort'})`).join(', ')
      : 'None *(Deploy from /trap)*';

    const sTemplate = curServant.template;
    const servantName = curServant.nickname || sTemplate.name;
    const servantClass = sTemplate.servantClass;

    let classPassive = 'None (Specializes in standard tactical combat)';
    if (servantClass === 'Saber' || servantClass === 'Archer' || servantClass === 'Lancer') {
      classPassive = '👁️ **Instinct / Clairvoyance:** 35% chance to predict ambushes, parrying 80% damage and dealing 1,500 counter DMG.';
    } else if (servantClass === 'Assassin') {
      classPassive = '🕶️ **Presence Concealment:** Completely immune to surprise ambushes. Nullifies strike & counters for 2,500 DMG!';
    } else if (servantClass === 'Berserker') {
      classPassive = '❤️ **Battle Continuation (Guts):** Revives once with 25% Max HP if dealt a fatal blow.';
    }

    const userCurHp = userParticipant ? calculateCurrentHp(userParticipant) : calculateServantMaxHp(curServant);
    const userMaxHp = userParticipant?.maxHp || calculateServantMaxHp(curServant);
    const hpPercent = Math.max(0, Math.min(100, Math.round((userCurHp / Math.max(1, userMaxHp)) * 100)));

    const totalBlocks = 14;
    const filledBlocks = Math.max(0, Math.min(totalBlocks, Math.round((hpPercent / 100) * totalBlocks)));
    const hpBar = '█'.repeat(filledBlocks) + '░'.repeat(totalBlocks - filledBlocks);

    const kills = userParticipant?.kills ?? master.servantKills ?? 0;
    const duelsWon = master.duelsWon || 0;
    const duelsLost = master.duelsLost || 0;
    const totalDuels = duelsWon + duelsLost;
    const winRate = totalDuels > 0 ? Math.round((duelsWon / totalDuels) * 100) : 0;

    let standingTag = '🟢 Active Competitor';
    if (userParticipant?.isAlive === false) {
      standingTag = '💀 Dissolved Saint Graph';
    } else if (isUnderSanctuary) {
      standingTag = '🕊️ Under Church Asylum';
    }

    let churchStanding = master.reputationRank || '🕊️ Honorable Neutral';
    if (master.bountyActive && master.bountyRewardSq) {
      churchStanding += ` *(⚠️ 💎 ${master.bountyRewardSq} SQ Bounty)*`;
    }

    addMessage({
      id: getNextId('bot_profile_dossier'),
      sender: 'bot',
      timestamp: 'Just now',
      embed: {
        title: `👤 Master Dossier | ${master.username} [${standingTag}]`,
        description:
          `*(🔒 Confidential Private Dossier — only visible to you)*\n\n` +
          `💠 **Command Seals:** \`${'✦ '.repeat(seals)}${'✧ '.repeat(Math.max(0, 3 - seals))}\` (**${seals}/3**) | 💎 **${master.saintQuartz || 0} SQ** | 🎴 **${master.servants?.length || 1}** Servant(s)\n\n` +
          (customMsg ? `📢 **Action Outcome:**\n${customMsg}\n\n` : '') +
          `⚔️ **MASTER COMBAT RECORD & WAR STATUS:**\n` +
          `• **War Standing:** ${standingTag} [${isExposed ? '⚠️ **EXPOSED TO PUBLIC WAR BOARD**' : '🕶️ **Concealed in Shadows**'}]\n` +
          `• **Servant Kills:** 💀 **${kills}** Dissolved\n` +
          `• **Duel Record:** ⚔️ **${duelsWon}W - ${duelsLost}L** (${winRate}% Win Rate)\n` +
          `• **Church Standing:** ${churchStanding}\n\n` +
          `🗡️ **ACTIVE CONTRACTED SERVANT:**\n` +
          `• **Servant:** **${servantName}** (${servantClass})\n` +
          `• **Vitality:** ❤️ [${hpBar}] \`${userCurHp.toLocaleString()} / ${userMaxHp.toLocaleString()}\` (${hpPercent}%)\n` +
          `• **Class Passive:** ${classPassive}\n\n` +
          `🏰 **WORKSHOP DEFENSES:**\n` +
          `• **Bounded Field:** ${wardLabel}\n` +
          `• **Auto-Evacuation:** ${autoEvade ? '🟢 **ON** *(Retreats automatically on lethal blow)*' : '🔴 **OFF**'}\n` +
          `• **Territorial Wards:** ${channelTrapsSummary}\n\n` +
          `*Configure workshop defenses, heal, or click **[Share Public Card]** below to broadcast your profile to the server:*`,
        color: isExposed ? '#ef4444' : '#3b82f6',
        thumbnailUrl: curServant.template?.avatarUrl,
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
            id: 'profile_share_public',
            label: 'Share Public Card',
            style: 'primary',
            emoji: '📢'
          },
          {
            id: 'profile_heal',
            label: 'Healing Ritual (+40%)',
            style: 'success',
            emoji: '✨'
          },
          {
            id: 'profile_toggle_evade',
            label: autoEvade ? 'Auto-Evacuate: ON 🟢' : 'Auto-Evacuate: OFF 🔴',
            style: autoEvade ? 'success' : 'secondary'
          },
          {
            id: 'profile_refresh',
            label: 'Refresh',
            style: 'secondary',
            emoji: '🔄'
          },
          {
            id: 'quick_war_status',
            label: 'War Board (/grailwar)',
            style: 'secondary',
            emoji: '📜'
          }
        ]
      }
    });
  };

  // Helper: Post Custom Dialogue Studio & Chain Voice Lines Hub
  const postCustomDialogueHub = (servantId?: string) => {
    const ownedServants = master.servants || [];
    if (ownedServants.length === 0) {
      addMessage({
        id: getNextId('bot_dialogue_err'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: '❌ No Servants Contracted',
          description: 'You must contract a Heroic Spirit via `/summon` before customizing dialogue voice lines!',
          color: '#ef4444'
        }
      });
      return;
    }

    const target = (servantId ? ownedServants.find(s => s.id === servantId) : null) ||
      ownedServants.find(s => s.id === master.activeServantId) ||
      ownedServants[0];

    const t = target.template;
    const name = target.nickname || t.name;
    const quotes = target.customQuotes || {};

    addMessage({
      id: getNextId('bot_dialogue_hub'),
      sender: 'bot',
      timestamp: 'Just now',
      embed: {
        title: `✍️ Master Dialogue Studio: ${name} (${t.servantClass})`,
        description:
          `*Author custom combat chants, Brave Chain shouts, and dialogue for **${name}**!*\n` +
          `*Custom lines automatically activate during duels, action chains, and Visual Novel cut-ins.*\n\n` +
          `⚡ **COMBAT BRAVE CHAINS & NP:**\n` +
          `• 🔴 **Buster Brave (3x Buster):**\n  *"${quotes.busterChain || 'Default Canon Voice Line'}"*\n` +
          `• 🔵 **Arts Mana (3x Arts):**\n  *"${quotes.artsChain || 'Default Canon Voice Line'}"*\n` +
          `• 🟢 **Quick Star (3x Quick):**\n  *"${quotes.quickChain || 'Default Canon Voice Line'}"*\n` +
          `• 🌟 **Noble Phantasm Chant:**\n  *"${quotes.noblePhantasm || t.noblePhantasm.chant}"*\n\n` +
          `📜 **INVOCATIONS & STANCES:**\n` +
          `• ⚔️ **Battle Start:** *" ${quotes.battleStart || t.battleStartQuote} "*\n` +
          `• 🏆 **Victory:** *" ${quotes.victory || t.victoryQuote} "*\n` +
          `• 💀 **Defeat:** *" ${quotes.defeat || t.defeatQuote || 'Master... forgive me...'} "*\n` +
          `• 🕯️ **Summon:** *" ${quotes.summon || t.summonQuote} "*\n\n` +
          `💡 **Quick Slash Authoring:**\n` +
          `\`/customise quote busterChain "Your custom quote here"\`\n` +
          `\`/customise quote artsChain "Your custom quote here"\`\n` +
          `\`/customise quote quickChain "Your custom quote here"\`\n` +
          `\`/customise quote battleStart "Your custom quote here"\``,
        color: '#d4af37',
        footer: `Contracted to Master ${master.username} • Bond Lv. ${target.bondLevel || 1} • Click a button below to set or test!`
      },
      components: {
        type: 'buttons',
        items: [
          { id: `dlg_set_buster_${target.id}`, label: 'Set Buster Chain', style: 'danger' as const, emoji: '🔴' },
          { id: `dlg_set_arts_${target.id}`, label: 'Set Arts Chain', style: 'primary' as const, emoji: '🔵' },
          { id: `dlg_set_quick_${target.id}`, label: 'Set Quick Chain', style: 'success' as const, emoji: '🟢' },
          { id: `dlg_set_battle_${target.id}`, label: 'Set Battle Start', style: 'secondary' as const, emoji: '⚔️' },
          { id: `dlg_test_cutin_${target.id}`, label: 'Test Cut-In Live', style: 'primary' as const, emoji: '🎬' },
          ...(ownedServants.length > 1
            ? [{ id: `dlg_switch_servant_${target.id}`, label: 'Switch Servant', style: 'secondary' as const, emoji: '🔄' }]
            : [])
        ]
      }
    });
  };

  // Helper: Handle /customise quote / dialogue slash commands
  const handleCustomDialogueCommand = (trimmed: string) => {
    const ownedServants = master.servants || [];
    if (ownedServants.length === 0) {
      addMessage({
        id: getNextId('bot_dialogue_err'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: '❌ No Servants Summoned',
          description: 'You must contract a Heroic Spirit via `/summon` before authoring custom voice lines!',
          color: '#ef4444'
        }
      });
      return;
    }

    // Strip prefix
    let clean = trimmed
      .replace('/customise quote', '')
      .replace('/customise dialogue', '')
      .replace('/dialogue set', '')
      .replace('/dialogue add', '')
      .replace('/dialogue custom', '')
      .trim();

    if (!clean) {
      postCustomDialogueHub();
      return;
    }

    const validKeys: Record<string, string> = {
      buster: 'busterChain',
      busterchain: 'busterChain',
      arts: 'artsChain',
      artschain: 'artsChain',
      quick: 'quickChain',
      quickchain: 'quickChain',
      crit: 'critHit',
      crithit: 'critHit',
      critical: 'critHit',
      skill: 'skill',
      skills: 'skill',
      seal: 'commandSeal',
      commandseal: 'commandSeal',
      command: 'commandSeal',
      np: 'noblePhantasm',
      chant: 'noblePhantasm',
      noblephantasm: 'noblePhantasm',
      summon: 'summon',
      start: 'battleStart',
      battlestart: 'battleStart',
      battle: 'battleStart',
      win: 'victory',
      victory: 'victory',
      defeat: 'defeat',
      loss: 'defeat'
    };

    let targetType = 'busterChain';
    let targetQuote = '';
    let targetServant = master.servants?.find(s => s.id === master.activeServantId) || master.servants[0];

    // Check if options provided in key:value format
    const typeMatch = clean.match(/type:\s*([a-zA-Z0-9_]+)/i);
    const textMatch = clean.match(/text:\s*["“']?([^"”']+)["”']?/i);
    const servantMatch = clean.match(/servant:\s*["“']?([^"”']+)["”']?/i);

    if (servantMatch) {
      const q = servantMatch[1].toLowerCase();
      const found = ownedServants.find(s =>
        s.template.name.toLowerCase().includes(q) ||
        (s.nickname && s.nickname.toLowerCase().includes(q)) ||
        s.id.toLowerCase() === q
      );
      if (found) targetServant = found;
    }

    if (typeMatch && textMatch) {
      const matchedKey = typeMatch[1].toLowerCase();
      targetType = validKeys[matchedKey] || 'busterChain';
      targetQuote = textMatch[1].trim();
    } else {
      // Positional args: e.g. /customise quote busterChain "I shall burn this world"
      const parts = clean.split(' ');
      const firstWord = parts[0].toLowerCase().replace(/[^a-z]/g, '');
      if (validKeys[firstWord]) {
        targetType = validKeys[firstWord];
        targetQuote = parts.slice(1).join(' ').trim().replace(/^["“']|["”']$/g, '');
      } else {
        targetType = 'busterChain';
        targetQuote = clean.replace(/^["“']|["”']$/g, '');
      }
    }

    if (!targetQuote) {
      postCustomDialogueHub(targetServant.id);
      return;
    }

    const updatedServants = master.servants.map(s => {
      if (s.id === targetServant.id) {
        return {
          ...s,
          customQuotes: {
            ...(s.customQuotes || {}),
            [targetType]: targetQuote
          }
        };
      }
      return s;
    });

    onUpdateMaster({ ...master, servants: updatedServants });

    const labelMap: Record<string, string> = {
      summon: 'Summon Quote',
      battleStart: 'Battle Start Quote',
      noblePhantasm: 'Noble Phantasm Chant',
      busterChain: 'Buster Brave Chain (3x Buster)',
      artsChain: 'Arts Mana Chain (3x Arts)',
      quickChain: 'Quick Star Chain (3x Quick)',
      critHit: 'Critical Strike Quote',
      skill: 'Skill Activation Quote',
      commandSeal: 'Command Seal Invocation',
      victory: 'Victory Quote',
      defeat: 'Defeat Quote'
    };

    const sName = targetServant.nickname || targetServant.template.name;
    addMessage({
      id: getNextId('bot_dialogue_saved'),
      sender: 'bot',
      timestamp: 'Just now',
      embed: {
        title: '💬 Custom Dialogue Saved to Contract!',
        description:
          `Updated **${labelMap[targetType] || targetType}** for **${sName}**:\n\n` +
          `🗣️ *" ${targetQuote} "*\n\n` +
          `✨ *This custom line will now trigger dynamically during duels, Visual Novel cut-ins, and dialogue inspects!*`,
        color: '#22c55e',
        footer: `Contracted to Master ${master.username} • Use /dialogue or /duel to hear it live!`
      },
      components: {
        type: 'buttons',
        items: [
          { id: `dlg_test_cutin_${targetServant.id}`, label: 'Test Cut-In Preview', style: 'primary', emoji: '🎬' },
          { id: `dlg_open_hub_${targetServant.id}`, label: 'Open Dialogue Studio', style: 'secondary', emoji: '✍️' },
          { id: 'quick_start_duel', label: 'Enter Duel', style: 'danger', emoji: '⚔️' }
        ]
      }
    });
  };

  // Helper: Post Stat Allocation Menu for Active Servant
  const postStatAllocationHub = (targetServantId?: string) => {
    const sId = targetServantId || master.activeServantId || master.servants?.[0]?.id;
    const target = master.servants?.find(s => s.id === sId) || master.servants?.[0];
    if (!target) {
      addMessage({
        id: getNextId('bot_stat_no_servant'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: '⚠️ No Servant Contracted',
          description: 'You need an active Servant contract before you can allocate parameter stat points.',
          color: '#ef4444'
        }
      });
      return;
    }

    const tpl = target.template || target;
    const sName = target.nickname || tpl.name || (target as any).name || 'Heroic Spirit';
    const sClass = tpl.servantClass || (target as any).servantClass || 'Saber';
    const sLvl = target.level || 1;
    const availPoints = target.availableStatPoints || 0;
    const alloc = target.allocatedStats || { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 };
    const base = tpl.baseStats || { strength: 10, endurance: 10, agility: 10, mana: 10, luck: 10 };

    const getRank = (score: number) => {
      if (score >= 40) return 'EX';
      if (score >= 30) return 'A+';
      if (score >= 25) return 'A';
      if (score >= 20) return 'B+';
      if (score >= 15) return 'B';
      if (score >= 10) return 'C';
      if (score >= 5) return 'D';
      return 'E';
    };

    const strTotal = (base.strength || 10) + (alloc.strength || 0);
    const endTotal = (base.endurance || 10) + (alloc.endurance || 0);
    const agiTotal = (base.agility || 10) + (alloc.agility || 0);
    const mnaTotal = (base.mana || 10) + (alloc.mana || 0);
    const lckTotal = (base.luck || 10) + (alloc.luck || 0);

    addMessage({
      id: getNextId('bot_stat_alloc_hub'),
      sender: 'bot',
      timestamp: 'Just now',
      embed: {
        title: `⭐ Parameter Point Allocation: ${sName}`,
        description:
          `👑 **Servant:** **${sName}** (${sClass}) • **Level:** Lv.${sLvl}/100\n` +
          `📈 **Available Stat Points:** \`${availPoints} pts\` *(Gained +10 pts per level up!)*\n\n` +
          `📊 **Current Parameters & Allocations:**\n` +
          `• ⚔️ **Strength (STR):** Rank \`${getRank(strTotal)}\` (\`${strTotal}\` total, \`+${alloc.strength || 0}\` allocated) — *Boosts Attack Damage*\n` +
          `• 🛡️ **Endurance (END):** Rank \`${getRank(endTotal)}\` (\`${endTotal}\` total, \`+${alloc.endurance || 0}\` allocated) — *Boosts Max HP & Guard*\n` +
          `• 💨 **Agility (AGI):** Rank \`${getRank(agiTotal)}\` (\`${agiTotal}\` total, \`+${alloc.agility || 0}\` allocated) — *Boosts Evade & Critical Rate*\n` +
          `• 🔮 **Mana (MNA):** Rank \`${getRank(mnaTotal)}\` (\`${mnaTotal}\` total, \`+${alloc.mana || 0}\` allocated) — *Boosts NP Gauge Gain*\n` +
          `• 🍀 **Luck (LCK):** Rank \`${getRank(lckTotal)}\` (\`${lckTotal}\` total, \`+${alloc.luck || 0}\` allocated) — *Boosts Flee & Critical Chance*\n\n` +
          (availPoints > 0
            ? `*Click the buttons below to distribute your available points.*`
            : `*No stat points remaining. Feed Craft Essences to level up and earn +10 points per level!*`),
        color: '#f59e0b',
        footer: 'Holy Grail War Parameter Enhancement System • All stat gains scale into battle and duels'
      },
      components: {
        type: 'buttons',
        items: [
          { id: 'stat_add_strength', label: '+1 STR', style: 'primary', emoji: '⚔️' },
          { id: 'stat_add_endurance', label: '+1 END', style: 'primary', emoji: '🛡️' },
          { id: 'stat_add_agility', label: '+1 AGI', style: 'primary', emoji: '💨' },
          { id: 'stat_add_mana', label: '+1 MNA', style: 'primary', emoji: '🔮' },
          { id: 'stat_add_luck', label: '+1 LCK', style: 'primary', emoji: '🍀' },
          { id: 'stat_add_auto_distribute', label: '+5 Auto-Distribute', style: 'success', emoji: '✨' },
          { id: 'inv_cat_feed', label: 'Feed for EXP (Level Up)', style: 'primary', emoji: '✨' },
          { id: 'inv_cat_ces', label: 'Back to Inventory', style: 'secondary', emoji: '🛡️' }
        ]
      }
    });
  };

  // Helper: Direct execution for /feed command parameters
  const executeDirectFeed = (feedArg: string) => {
    const activeServant = master.servants?.find(s => s.id === master.activeServantId) || master.servants?.[0];
    if (!activeServant) {
      addMessage({
        id: getNextId('bot_feed_no_srv'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: '⚠️ No Servant to Feed',
          description: 'You need an active Servant contract before you can synthesize Craft Essences.',
          color: '#ef4444'
        }
      });
      return;
    }

    const ownedCes = (master.craftEssences || []).filter(Boolean);
    if (ownedCes.length === 0) {
      addMessage({
        id: getNextId('bot_feed_empty'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: '⚠️ No Craft Essences in Inventory',
          description: 'Your inventory has no Craft Essences to feed. Claim starter CEs or roll in `/cegacha`!',
          color: '#ef4444'
        },
        components: {
          type: 'buttons',
          items: [
            { id: 'inv_act_claim_practice_ces', label: 'Claim 5 Practice CEs', style: 'primary', emoji: '🎁' },
            { id: 'inv_quick_gacha', label: 'Gacha Banner', style: 'secondary', emoji: '🎲' }
          ]
        }
      });
      return;
    }

    let indicesToFeed: number[] = [];
    const q = feedArg.toLowerCase().trim();

    if (q === '3star' || q === '1-3star' || q === 'low' || q === 'bronze' || q === 'silver') {
      indicesToFeed = ownedCes.map((ce, idx) => ((ce.rarity || 3) <= 3 ? idx : -1)).filter(i => i !== -1);
    } else if (q === 'dupes' || q === 'duplicates' || q === 'dupe') {
      const nameCounts = new Map<string, number>();
      ownedCes.forEach(c => {
        if (c) nameCounts.set(c.name, (nameCounts.get(c.name) || 0) + 1);
      });
      const seen = new Set<string>();
      indicesToFeed = ownedCes.map((ce, idx) => {
        if (!ce || (ce.rarity || 3) >= 5) return -1; // Protect 5-star SSRs
        if ((nameCounts.get(ce.name) || 0) > 1) {
          if (seen.has(ce.name)) {
            return idx;
          } else {
            seen.add(ce.name);
            return -1;
          }
        }
        return -1;
      }).filter(i => i !== -1);
    } else if (q === 'all') {
      indicesToFeed = ownedCes.map((_, idx) => idx);
    } else {
      // Find matching CE by name
      const targetIdx = ownedCes.findIndex(ce => ce.name.toLowerCase().includes(q));
      if (targetIdx !== -1) {
        indicesToFeed = [targetIdx];
      }
    }

    if (indicesToFeed.length === 0) {
      addMessage({
        id: getNextId('bot_feed_not_found'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: '🔍 No Matching Craft Essences',
          description: `No Craft Essences in your inventory matched \`${feedArg}\`.\nTry \`/feed 3star\`, \`/feed dupes\`, \`/feed all\`, or select from the Inventory Feed tab.`,
          color: '#f59e0b'
        }
      });
      return;
    }

    const feedResult = feedCraftEssences(activeServant, indicesToFeed, master.craftEssences);
    const updatedServants = master.servants.map(s => s.id === activeServant.id ? feedResult.updatedServant : s);
    const updatedMaster: MasterProfile = {
      ...master,
      craftEssences: feedResult.remainingCraftEssences,
      servants: updatedServants
    };
    onUpdateMaster(updatedMaster);

    const sName = activeServant.nickname || activeServant.template?.name || (activeServant as any).name || 'Heroic Spirit';

    addMessage({
      id: getNextId('bot_feed_success'),
      sender: 'bot',
      timestamp: 'Just now',
      embed: {
        title: `✨ Spirit Origin Synthesis: +${feedResult.expGained.toLocaleString()} EXP!`,
        description:
          `Consumed **${feedResult.consumedCount} Craft Essence(s)** to empower **${sName}**!\n\n` +
          `📊 **EXP Gained:** \`+${feedResult.expGained.toLocaleString()} EXP\`\n` +
          `🌟 **Level:** **Lv.${feedResult.oldLevel}** ➔ **Lv.${feedResult.newLevel}** (${feedResult.levelsGained > 0 ? `+${feedResult.levelsGained} Levels Gained!` : 'Current Level'})\n` +
          `⭐ **Stat Points:** \`+${feedResult.statPointsGained} Points Awarded\` *(Total Available: ${feedResult.updatedServant.availableStatPoints || 0} pts)*\n` +
          `🛡️ **Remaining CEs:** \`${feedResult.remainingCraftEssences.length} Essences in Inventory\``,
        color: '#a855f7',
        footer: 'Spirit Origin Synthesis • +10 Stat Points per level up!'
      },
      components: {
        type: 'buttons',
        items: [
          { id: 'inv_act_allocate_stats', label: `Allocate Stats (${feedResult.updatedServant.availableStatPoints || 0} pts)`, style: 'primary', emoji: '⭐' },
          { id: 'inv_cat_feed', label: 'Feed More CEs', style: 'success', emoji: '✨' },
          { id: 'inv_cat_ces', label: 'View Inventory', style: 'secondary', emoji: '🛡️' }
        ]
      }
    });
  };

  // Helper: Post Hana Association Equipment & Inventory Hub
  const postInventoryHub = (
    category: 'ces' | 'servants' | 'feed' | 'seals' | 'items' = 'ces',
    page: number = 1,
    selectedId?: string
  ) => {
    const ownedCes = (master.craftEssences || []).filter(Boolean);
    const ownedServants = master.servants || [];
    const activeServant = master.servants?.find(s => s.id === master.activeServantId) || master.servants?.[0];
    const servantName = activeServant?.nickname || activeServant?.template?.name || (activeServant as any)?.name || 'Heroic Spirit';
    const sLvl = activeServant?.level || 1;
    const sExp = activeServant?.experience || 0;
    const nextExp = getTotalExpForLevel(sLvl + 1);
    const curLevelBaseExp = getTotalExpForLevel(sLvl);
    const expIntoLevel = Math.max(0, sExp - curLevelBaseExp);
    const expNeededForLevel = Math.max(1, nextExp - curLevelBaseExp);
    const progressPct = Math.min(100, Math.round((expIntoLevel / expNeededForLevel) * 100));
    const progressBar = '█'.repeat(Math.round(progressPct / 10)) + '░'.repeat(10 - Math.round(progressPct / 10));

    let title = `🛡️ ${master.username}'s Vault — Craft Essences`;
    let headerBanner = '';
    let itemLines: string[] = [];
    let totalItems = 0;
    const itemsPerPage = 8;
    let selectPlaceholder = '🔍 Select an item to interact...';
    let selectOptions: { value: string; label: string; description?: string; emoji?: string }[] = [];

    const activeCeInfo = activeServant?.equippedCe
      ? `• **Equipped CE:** [★${activeServant.equippedCe.rarity}] **${activeServant.equippedCe.name}** (+${activeServant.equippedCe.atkBonus || 0} ATK / +${activeServant.equippedCe.hpBonus || 0} HP)`
      : `• **Equipped CE:** *(None equipped)*`;

    const commonStatsHeader =
      `👑 **Active Contract:** **${servantName}** (Lv.${sLvl}/100) — \`[${progressBar}] ${progressPct}%\`\n` +
      `⭐ **Stat Points Available:** \`${activeServant?.availableStatPoints || 0} pts\` *(+10 per level up!)*\n` +
      `${activeCeInfo}\n` +
      `💎 **Saint Quartz Balance:** \`${master.saintQuartz || 0} SQ\``;

    if (category === 'ces') {
      title = `🛡️ ${master.username}'s Vault — Craft Essences`;
      headerBanner =
        commonStatsHeader +
        `\n\n*Select a Craft Essence below to **Equip**, **Feed for EXP**, or **Inspect Lore**.*`;

      const ceCounts = new Map<string, { ce: any; count: number }>();
      for (const c of ownedCes) {
        if (!c || !c.id) continue;
        if (!ceCounts.has(c.id)) ceCounts.set(c.id, { ce: c, count: 1 });
        else ceCounts.get(c.id)!.count++;
      }

      const uniqueCes = Array.from(ceCounts.values());
      totalItems = uniqueCes.length;

      const selCe = uniqueCes.find(u => u.ce.id === (selectedId || invSelectedCeId))?.ce || (uniqueCes.length > 0 ? uniqueCes[0].ce : null);

      if (uniqueCes.length === 0) {
        itemLines = [
          '• *No Craft Essences currently in inventory.*',
          '• *Click **[Claim Practice CEs]** below to receive 5 starter essences, or roll in **[Gacha Vault]**!*'
        ];
      } else {
        const startIndex = (page - 1) * itemsPerPage;
        const paginated = uniqueCes.slice(startIndex, startIndex + itemsPerPage);

        itemLines = paginated.map(({ ce, count }) => {
          const isEq = activeServant?.equippedCeId === ce.id;
          const isSel = (selectedId || invSelectedCeId) === ce.id;
          const rarityStars = '★'.repeat(ce.rarity || 3);
          const eqBadge = isEq ? ' **[EQUIPPED]**' : '';
          const pointer = isSel ? '▶ ' : '• ';
          return `${pointer}**[${rarityStars}]** **${ce.name}** ×${count} — +${ce.atkBonus || 0} ATK / +${ce.hpBonus || 0} HP${eqBadge}\n   ↳ *${ce.effectText || ce.description || 'Mystic Code'}*`;
        });

        selectPlaceholder = selCe ? `Selected: ${selCe.name} (★${selCe.rarity})` : '🔍 Select a Craft Essence...';
        selectOptions = uniqueCes.slice(0, 25).map(({ ce, count }) => ({
          value: `inv_sel_ce_${ce.id}`,
          label: `${ce.name} ×${count} (★${ce.rarity})`,
          description: `+${ce.atkBonus || 0} ATK / +${ce.hpBonus || 0} HP • ${ce.effectText?.slice(0, 45) || 'Relic'}`
        }));
      }
    } else if (category === 'servants') {
      title = `⚔️ ${master.username}'s Roster — Contracted Servants`;
      headerBanner =
        commonStatsHeader +
        `\n\n*Select a Heroic Spirit below to **Set Active Contract**, **Allocate Stat Points**, or **Inspect Dossier**.*`;

      totalItems = ownedServants.length;
      const startIndex = (page - 1) * itemsPerPage;
      const paginated = ownedServants.slice(startIndex, startIndex + itemsPerPage);

      const selServant = ownedServants.find(s => s.id === (selectedId || invSelectedServantId)) || activeServant;

      itemLines = paginated.map((s: any) => {
        const sN = s.nickname || s.template?.name || s.name || 'Heroic Spirit';
        const sCls = s.template?.servantClass || s.servantClass || 'Saber';
        const isAct = master.activeServantId === s.id;
        const isSel = (selectedId || invSelectedServantId) === s.id;
        const actBadge = isAct ? ' **[ACTIVE CONTRACT]**' : '';
        const pointer = isSel ? '▶ ' : '• ';
        return `${pointer}**[${sCls}]** **${sN}** — Lv.${s.level || 1}/100 | Points: \`${s.availableStatPoints || 0} pts\`${actBadge}\n   ↳ *NP: ${s.template?.noblePhantasm?.name || 'Classified'}*`;
      });

      selectPlaceholder = selServant
        ? `Selected: ${selServant.nickname || selServant.template?.name || 'Servant'} (Lv.${selServant.level || 1})`
        : '🔍 Select a Servant...';
      selectOptions = ownedServants.slice(0, 25).map(s => {
        const sN = s.nickname || s.template?.name || (s as any).name || 'Heroic Spirit';
        const sCls = s.template?.servantClass || (s as any).servantClass || 'Saber';
        return {
          value: `inv_sel_srv_${s.id}`,
          label: `${sN} (Lv.${s.level || 1} ${sCls})`,
          description: `Balanced • Available: ${s.availableStatPoints || 0} pts • NP: ${s.template?.noblePhantasm?.name || 'Noble Phantasm'}`
        };
      });
    } else if (category === 'feed') {
      title = `✨ Spirit Origin Synthesis & EXP Workshop — ${servantName}`;
      headerBanner =
        `🔮 **Target Servant:** **${servantName}** (Lv.${sLvl}/100)\n` +
        `📊 **EXP Progress:** \`${expIntoLevel.toLocaleString()} / ${expNeededForLevel.toLocaleString()} EXP\` \`[${progressBar}] ${progressPct}%\`\n` +
        `📈 **Available Stat Points:** \`${activeServant?.availableStatPoints || 0} pts\` *(+10 Stat Points awarded every Level Up!)*\n` +
        `🛡️ **Inventory Essences:** \`${ownedCes.length} Total CEs in inventory\`\n\n` +
        `*Consume Craft Essences to channel spiritron mana into your Servant!*`;

      const ceCounts = new Map<string, { ce: any; count: number }>();
      for (const c of ownedCes) {
        if (!c || !c.id) continue;
        if (!ceCounts.has(c.id)) ceCounts.set(c.id, { ce: c, count: 1 });
        else ceCounts.get(c.id)!.count++;
      }
      const uniqueCes = Array.from(ceCounts.values());
      totalItems = uniqueCes.length;

      if (uniqueCes.length === 0) {
        itemLines = [
          '• *No Craft Essences available to synthesize.*',
          '• *Click **[Claim 5 Practice CEs]** below to get starter essences, or roll in **[Roll Gacha]**!*'
        ];
      } else {
        const startIndex = (page - 1) * itemsPerPage;
        const paginated = uniqueCes.slice(startIndex, startIndex + itemsPerPage);

        itemLines = paginated.map(({ ce, count }) => {
          const expVal = getCeExpValue(ce);
          const stars = '★'.repeat(ce.rarity || 3);
          return `• **[${stars}]** **${ce.name}** ×${count} — \`+${expVal.toLocaleString()} EXP\` each (${ce.rarity >= 5 ? 'SSR' : ce.rarity >= 4 ? 'SR' : 'R'})`;
        });

        selectPlaceholder = '🔍 Select a specific CE to Feed 1x...';
        selectOptions = uniqueCes.slice(0, 25).map(({ ce, count }) => ({
          value: `inv_act_feed_single_${ce.id}`,
          label: `Feed 1x ${ce.name} (★${ce.rarity})`,
          description: `+${getCeExpValue(ce).toLocaleString()} EXP • Remaining: ×${count}`
        }));
      }
    } else if (category === 'seals') {
      title = `📜 ${master.username}'s Sanctuary — Command Seals & Master Wards`;
      headerBanner =
        commonStatsHeader +
        `\n\n*Manage your absolute magecraft Command Seals and defensive territory.*`;

      itemLines = [
        `• **Legendary** — **Command Seals** ×${(master as any).commandSeals ?? 3} / 3 — S Rank [RECHARGES 1 / 24H]`,
        `• **Rare** — **Mage Sanctuary Bounded Field** ×1 — A Rank [60% AMBUSH DAMAGE REDUCTION]`,
        `• **Rare** — **Homunculus Decoy** ×${(master as any).homunculusCount || 1} — A Rank [ABSORBS 100% AMBUSH DAMAGE]`,
        `• **Standard** — **Alarm Ward** ×1 — B Rank [EXPOSES INCOMING SCOUTS]`,
        `• **Standard** — **Bloodfort Drain Field** ×1 — B Rank [SIPHONS RIVAL HP IN PATROL]`
      ];
      totalItems = 5;
    } else if (category === 'items') {
      title = `💎 ${master.username}'s Vault & Currency Ledger`;
      headerBanner =
        commonStatsHeader +
        `\n\n*Manage Saint Quartz, summon catalysts, and vault resources.*`;

      itemLines = [
        `• **Mythic** — **Saint Quartz** ×${master.saintQuartz || 0} 💎 — EX Rank [SUMMON CURRENCY]`,
        `• **Legendary** — **Holy Grail Shards** ×${(master as any).grailShards || 1} — S Rank [ASCENSION CATALYST]`,
        `• **Rare** — **Mana Prisms** ×${(master as any).manaPrisms || 50} — A Rank [DA VINCI WORKSHOP]`,
        `• **Relic** — **Summoning Catalyst** ×1 — A Rank [HEROIC SPIRIT INVOCATION]`
      ];
      totalItems = 4;
    }

    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    const currentPage = Math.min(Math.max(page, 1), totalPages);

    const categoryNavButtons = [
      { id: 'inv_cat_ces', label: 'Craft Essences', style: category === 'ces' ? 'primary' as const : 'secondary' as const, emoji: '🛡️' },
      { id: 'inv_cat_servants', label: 'Servants', style: category === 'servants' ? 'primary' as const : 'secondary' as const, emoji: '⚔️' },
      { id: 'inv_cat_feed', label: 'Feed (EXP)', style: category === 'feed' ? 'primary' as const : 'secondary' as const, emoji: '✨' },
      { id: 'inv_cat_seals', label: 'Seals & Wards', style: category === 'seals' ? 'primary' as const : 'secondary' as const, emoji: '📜' },
      { id: 'inv_cat_items', label: 'Vault & Gacha', style: category === 'items' ? 'primary' as const : 'secondary' as const, emoji: '💎' }
    ];

    let actionButtons: { id: string; label: string; style: 'primary' | 'secondary' | 'success' | 'danger'; emoji?: string }[] = [];

    if (category === 'ces') {
      actionButtons = [
        { id: 'inv_page_prev', label: 'Prev', style: 'secondary', emoji: '◀️' },
        { id: 'inv_page_next', label: 'Next', style: 'secondary', emoji: '▶️' },
        { id: 'inv_act_equip_selected', label: 'Equip Selected', style: 'success', emoji: '✅' },
        { id: 'inv_act_feed_selected', label: 'Feed Selected', style: 'primary', emoji: '✨' },
        { id: 'inv_act_inspect', label: 'Inspect Lore', style: 'secondary', emoji: '📖' },
        { id: 'inv_act_unequip', label: 'Unequip', style: 'danger', emoji: '❌' },
        ...(ownedCes.length === 0 ? [{ id: 'inv_act_claim_practice_ces', label: 'Claim Practice CEs', style: 'primary' as const, emoji: '🎁' }] : []),
        { id: 'inv_quick_gacha', label: 'Gacha Vault', style: 'secondary', emoji: '🎲' }
      ];
    } else if (category === 'servants') {
      actionButtons = [
        { id: 'inv_page_prev', label: 'Prev', style: 'secondary', emoji: '◀️' },
        { id: 'inv_page_next', label: 'Next', style: 'secondary', emoji: '▶️' },
        { id: 'inv_act_set_active_servant', label: 'Set as Active', style: 'success', emoji: '👑' },
        { id: 'inv_act_allocate_stats', label: `Allocate Stats (${activeServant?.availableStatPoints || 0} pts)`, style: 'primary', emoji: '⭐' },
        { id: 'inv_act_go_to_feed', label: 'Feed & Level Up', style: 'primary', emoji: '✨' },
        { id: 'inv_act_inspect_servant', label: 'Dossier Profile', style: 'secondary', emoji: '👤' },
        { id: 'inv_act_open_workshop', label: 'Open Workshop', style: 'secondary', emoji: '🎨' }
      ];
    } else if (category === 'feed') {
      actionButtons = [
        { id: 'inv_act_feed_1_3star', label: 'Feed 1-3★ CEs', style: 'success', emoji: '⚡' },
        { id: 'inv_act_feed_duplicates', label: 'Feed Duplicates', style: 'primary', emoji: '⚡' },
        { id: 'inv_act_feed_all', label: 'Feed All CEs', style: 'danger', emoji: '🔥' },
        { id: 'inv_act_allocate_stats', label: `Allocate Stats (${activeServant?.availableStatPoints || 0} pts)`, style: 'primary', emoji: '⭐' },
        ...(ownedCes.length === 0 ? [{ id: 'inv_act_claim_practice_ces', label: 'Claim 5 Practice CEs', style: 'secondary' as const, emoji: '🎁' }] : []),
        { id: 'inv_quick_gacha', label: 'Roll Gacha (SQ)', style: 'secondary', emoji: '🎲' }
      ];
    } else if (category === 'seals') {
      const uP = grailWar.participants[master.discordId];
      const autoEvacOn = uP?.autoEvadeEnabled === true;
      actionButtons = [
        { id: 'inv_act_use_seal_heal', label: 'Use Seal (Full Heal)', style: 'success', emoji: '⚡' },
        { id: 'toggle_auto_evade', label: autoEvacOn ? 'Auto-Evac: ON 🟢' : 'Auto-Evac: OFF 🔴', style: autoEvacOn ? 'success' : 'secondary', emoji: '🛡️' },
        { id: 'inv_act_deploy_sanctuary', label: 'Sanctuary Field (60% Def)', style: 'primary', emoji: '🛡️' },
        { id: 'inv_act_deploy_decoy', label: 'Homunculus Decoy (100% Absorb)', style: 'secondary', emoji: '🗿' },
        { id: 'open_traps_hub_modal_btn', label: 'Traps & Wards Hub (/trap)', style: 'primary', emoji: '🔮' },
        { id: 'inv_act_patrol', label: 'Patrol Fuyuki', style: 'secondary', emoji: '👁️' }
      ];
    } else if (category === 'items') {
      actionButtons = [
        { id: 'quick_daily_claim', label: 'Claim Daily (+30 SQ)', style: 'success', emoji: '💎' },
        { id: 'inv_act_roll_1x_ce', label: '1x CE Gacha (3 SQ)', style: 'primary', emoji: '🎲' },
        { id: 'inv_act_roll_10x_ce', label: '10x CE Gacha (30 SQ)', style: 'success', emoji: '💎' },
        { id: 'quick_summon_ritual', label: 'Summon Servant (30 SQ)', style: 'primary', emoji: '🔮' }
      ];
    }

    addMessage({
      id: getNextId('bot_inv_hub'),
      sender: 'bot',
      timestamp: 'Just now',
      embed: {
        title,
        description: `${headerBanner}\n\n` + itemLines.join('\n'),
        color: category === 'feed' ? '#a855f7' : category === 'servants' ? '#d4af37' : '#38bdf8',
        footer: `Page ${currentPage}/${totalPages} • Unified Master Inventory & Workshop • All interactive buttons operational`
      },
      components: {
        type: 'buttons',
        placeholder: selectOptions.length > 0 ? selectPlaceholder : undefined,
        selectOptions: selectOptions.length > 0 ? selectOptions : undefined,
        items: [...categoryNavButtons, ...actionButtons]
      }
    });
  };

  // Helper: Post Greater Grail Gacha & Invocation Sanctum Hub
  const postGachaHub = (
    category: 'ces' | 'daily' | 'rates' = 'ces',
    banner: string = 'standard_ce'
  ) => {
    const sq = master.saintQuartz || 0;
    let title = '🛡️ Invocation Sanctum — Craft Essence Forge';
    let description = '';
    let color = '#38bdf8';
    let imageUrl = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80';

    if (category === 'ces') {
      title = '🛡️ Invocation Sanctum — Craft Essence Forge';
      color = '#38bdf8';
      imageUrl = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80';
      description =
        `💎 **Master Balance:** \`${sq} Saint Quartz\`\n\n` +
        `🛡️ **Featured Essence Banner:** **Mystic Code Armory**\n` +
        `🌟 **Featured Essences:** The Black Grail, Kaleidoscope, Formal Craft, Limited/Zero Over\n` +
        `🎁 **Multi-Summon Guarantee:** Every 10x roll guarantees at least one **★4 SR or higher** Craft Essence!\n\n` +
        `⚔️ **Holy Grail War Covenant:** *Heroic Spirits are contracted once per Master via \`/summon ritual\`. Forge and equip powerful Mystic Codes below to empower your Servant!*`;
    } else if (category === 'daily') {
      title = '💎 Saint Quartz Treasury & Daily Claim';
      color = '#10b981';
      imageUrl = 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80';
      description =
        `💎 **Current Vault Balance:** \`${sq} Saint Quartz\`\n` +
        `🏆 **Grail Shards:** \`${(master as any).grailShards || 1} Shards\`\n` +
        `🔵 **Mana Prisms:** \`${(master as any).manaPrisms || 50} Prisms\`\n\n` +
        `🎁 **Daily Login Bonus:** Claim **+30 Saint Quartz (10x Multi-Summon)** every 24 hours!\n` +
        `💰 **Battle Rewards:** Earn bonus Saint Quartz by participating in Fuyuki Patrols and Duels.\n\n` +
        `*Press the **Claim Daily Quartz** button below to collect your reward!*`;
    } else if (category === 'rates') {
      title = '📜 Greater Grail Summoning Rates & Crafting Guarantees';
      color = '#64748b';
      description =
        `📊 **Official Mystic Code Forge Probability Table:**\n\n` +
        `**Craft Essences (Mystic Codes):**\n` +
        `• ★5 SSR Craft Essence: **4.0%**\n` +
        `• ★4 SR Craft Essence: **12.0%**\n` +
        `• ★3 R Craft Essence: **84.0%**\n\n` +
        `💎 **Guaranteed Multi-Roll Pity:**\n` +
        `• 10x Multi-Summon guarantees at least one **★4 SR or higher** Craft Essence.\n\n` +
        `⚔️ **Heroic Spirit Covenant:**\n` +
        `• Servants cannot be summoned via Gacha. In an authentic Holy Grail War, each Master establishes a singular bond with a Heroic Spirit via \`/summon ritual\`.`;
    }

    const categoryNavButtons = [
      { id: 'gacha_tab_ces', label: 'Craft Essences', style: (category === 'ces' ? 'primary' : 'secondary') as any, emoji: '🛡️' },
      { id: 'gacha_tab_daily', label: 'Daily & Vault', style: (category === 'daily' ? 'primary' : 'secondary') as any, emoji: '💎' },
      { id: 'gacha_tab_rates', label: 'Drop Rates', style: (category === 'rates' ? 'primary' : 'secondary') as any, emoji: '📜' }
    ];

    const bannerSelectOptions = [
      {
        value: 'gacha_sel_standard_ce',
        label: '★5 Mystic Code Armory (Craft Essences)',
        description: 'Summon Kaleidoscope, Black Grail, Limited/Zero Over',
        emoji: '🛡️'
      },
      {
        value: 'gacha_sel_daily_vault',
        label: '💎 Daily Quartz Treasury & Rewards',
        description: 'Claim daily Saint Quartz and inspect currency',
        emoji: '💎'
      }
    ];

    const actionButtons = [
      { id: 'gacha_act_single', label: '1x Single Summon (3 SQ)', style: 'success' as const, emoji: '✨', disabled: sq < 3 },
      { id: 'gacha_act_multi', label: '10x Multi-Summon (30 SQ)', style: 'primary' as const, emoji: '🌟', disabled: sq < 30 },
      { id: 'gacha_act_claim_daily', label: 'Claim Daily SQ (+30)', style: 'success' as const, emoji: '💎' },
      { id: 'gacha_link_inventory', label: 'Master Inventory (/inventory)', style: 'secondary' as const, emoji: '👔' },
      { id: 'gacha_link_servant', label: 'Servant Workshop (/servant)', style: 'secondary' as const, emoji: '👑' },
      { id: 'gacha_link_grailwar', label: 'Holy Grail War (/grailwar)', style: 'secondary' as const, emoji: '🏰' },
      { id: 'gacha_link_duel', label: 'Combat Arena (/duel)', style: 'secondary' as const, emoji: '⚔️' }
    ];

    addMessage({
      id: getNextId('bot_gacha_hub'),
      sender: 'bot',
      timestamp: 'Just now',
      embed: {
        title,
        description,
        color,
        imageUrl: category !== 'rates' ? imageUrl : undefined,
        footer: `Greater Grail Sanctum • Master: ${master.username} • Balance: ${sq} SQ`
      },
      components: {
        type: 'buttons',
        placeholder: 'Select Summoning Banner...',
        selectOptions: bannerSelectOptions,
        items: [...categoryNavButtons, ...actionButtons]
      }
    });
  };

  // Helper: Post Master Servant Workshop Hub
  const postServantHub = (
    category: 'profile' | 'stats' | 'np' | 'dialogue' | 'roster' = 'profile',
    selectedId?: string
  ) => {
    const ownedServants = master.servants || [];
    if (ownedServants.length === 0) {
      addMessage({
        id: getNextId('bot_no_servant'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: '🕯️ No Contracted Servant',
          description: 'You have not summoned a Heroic Spirit yet for the Holy Grail War!\nUse `/summon ritual` to establish your sacred contract or `/servants` to browse all spirits.',
          color: '#ef4444'
        },
        components: {
          type: 'buttons',
          items: [
            { id: 'gacha_link_gacha', label: 'Invocation Sanctum (/gacha)', style: 'success', emoji: '🔮' },
            { id: 'quick_summon_ritual', label: 'Begin Summoning Ritual', style: 'primary', emoji: '✨' },
            { id: 'btn_show_servants_list', label: 'Browse Throne (/servants)', style: 'secondary', emoji: '📜' }
          ]
        }
      });
      return;
    }

    const targetServant = (selectedId ? ownedServants.find(s => s.id === selectedId) : null) ||
      ownedServants.find(s => s.id === (servantHubSelectedId || master.activeServantId)) ||
      ownedServants[0];

    const templateId = targetServant.templateId || targetServant.template?.id || targetServant.id;
    const canonical = SERVANT_DATABASE.find(s => s.id === templateId) || targetServant.template || targetServant;
    const t = { ...canonical, ...(targetServant.template?.isCustomOrMeme ? targetServant.template : {}) };
    const alloc = targetServant.allocatedStats || { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 };
    const base = t.baseStats || { strength: 10, endurance: 10, agility: 10, mana: 10, luck: 10 };
    const strTotal = (base.strength || 10) + (alloc.strength || 0);
    const endTotal = (base.endurance || 10) + (alloc.endurance || 0);
    const agiTotal = (base.agility || 10) + (alloc.agility || 0);
    const mnaTotal = (base.mana || 10) + (alloc.mana || 0);
    const lckTotal = (base.luck || 10) + (alloc.luck || 0);

    const ceBonusAtk = targetServant.equippedCe?.atkBonus || 0;
    const ceBonusHp = targetServant.equippedCe?.hpBonus || 0;
    const lvl = targetServant.level || 1;
    const totalHp = Math.round((t.baseHp || 28000) + endTotal * 150 + ceBonusHp);
    const totalAtk = Math.round((t.baseAtk || 10000) + strTotal * 80 + ceBonusAtk);
    const sName = targetServant.nickname || t.name;
    const bondLvl = targetServant.bondLevel || 1;
    const availPoints = targetServant.availableStatPoints || 0;

    const getRank = (score: number) => {
      if (score >= 40) return 'EX';
      if (score >= 30) return 'A+';
      if (score >= 25) return 'A';
      if (score >= 20) return 'B+';
      if (score >= 15) return 'B';
      if (score >= 10) return 'C';
      if (score >= 5) return 'D';
      return 'E';
    };

    let title = `⚔️ Servant Workshop: ${sName}`;
    let description = '';
    let color = t.rarity === 5 ? '#f59e0b' : '#38bdf8';
    let canvasType: any = undefined;
    let canvasPayload: any = undefined;
    let artworkEmbed: any = undefined;

    if (category === 'profile') {
      title = `⚔️ Servant Workshop — Profile Card: ${sName}`;
      description =
        `*${t.title}* • **Master:** ${master.username}\n` +
        `🌟 **Class:** ${t.servantClass} | **Parity:** Balanced | **Bond Lv:** ${bondLvl}/10 ♥ | **Level:** ${lvl}/100\n` +
        `❤️ **Max HP:** \`${totalHp.toLocaleString()}\` | ⚔️ **Total ATK:** \`${totalAtk.toLocaleString()}\` | 📈 **Stat Points:** **${availPoints} pts**\n\n` +
        `📊 **Battle Parameters:**\n` +
        `• **Strength (STR):** \`${strTotal}\` [${getRank(strTotal)}] | **Endurance (END):** \`${endTotal}\` [${getRank(endTotal)}]\n` +
        `• **Agility (AGI):** \`${agiTotal}\` [${getRank(agiTotal)}] | **Mana (MNA):** \`${mnaTotal}\` [${getRank(mnaTotal)}] | **Luck (LCK):** \`${lckTotal}\` [${getRank(lckTotal)}]`;
      canvasType = 'servant';
      canvasPayload = { servant: targetServant, masterName: master.username };

      const { avatarUrl, cardArtUrl } = getServantAvatarAndCardArt(targetServant, customServants);

      artworkEmbed = {
        title: `🖼️ Servant Character Portrait: ${sName}`,
        imageUrl: cardArtUrl || avatarUrl,
        color
      };
    } else if (category === 'stats') {
      title = `⭐ Parameter Point Allocation: ${sName}`;
      description =
        `👑 **Servant:** **${sName}** (${t.servantClass}) • **Level:** Lv.${lvl}/100\n` +
        `📈 **Available Stat Points:** \`${availPoints} pts\` *(Gained +10 pts per level up!)*\n\n` +
        `💪 **Strength (STR):** \`${strTotal}\` [**${getRank(strTotal)}**] — *Increases physical attack damage*\n` +
        `🛡️ **Endurance (END):** \`${endTotal}\` [**${getRank(endTotal)}**] — *Increases max HP pool*\n` +
        `⚡ **Agility (AGI):** \`${agiTotal}\` [**${getRank(agiTotal)}**] — *Increases crit star generation & dodge rate*\n` +
        `🔮 **Mana (MNA):** \`${mnaTotal}\` [**${getRank(mnaTotal)}**] — *Increases NP charge gain rate*\n` +
        `🍀 **Luck (LCK):** \`${lckTotal}\` [**${getRank(lckTotal)}**] — *Increases status effect and critical resistance*\n\n` +
        `*Click a parameter button below to allocate points or use Auto-Distribute.*`;
      color = availPoints > 0 ? '#22c55e' : '#38bdf8';
    } else if (category === 'np') {
      const np = t.noblePhantasm;
      title = `💥 Noble Phantasm: ${np.name}`;
      description =
        `> *"${targetServant.customQuotes?.noblePhantasm || np.chant || 'True Name Unleashed!'}"*\n\n` +
        `• **Heroic Spirit:** **${t.name}** — *${t.title}* [\`${t.servantClass}\`]\n` +
        `• **Card Type & Target:** **${np.cardType}** • **${np.target.toUpperCase()}**\n` +
        `• **Damage Multiplier:** \`${np.multiplier}%\` | **Overcharge:** ${np.overchargeEffect || 'Standard boost'}\n` +
        `• **True Name Power:** ${np.description}\n\n` +
        `🎬 *Cinematic Noble Phantasm Execution*`;
      color = np.cardType === 'Buster' ? '#ef4444' : np.cardType === 'Arts' ? '#3b82f6' : '#10b981';
      artworkEmbed = {
        imageUrl: t.cardArtUrl || t.avatarUrl,
        color
      };
    } else if (category === 'dialogue') {
      const quotes = targetServant.customQuotes || {};
      const sNameLower = (targetServant.nickname || t.name || '').toLowerCase();
      let busterDef = "Blade of Selection... Strike true! Dragon Core, ignite!";
      let artsDef = "With pure heart and steadfast oath... Prana circulation stable!";
      let quickDef = "Invisible Air, release! Wind of the King, sweep the field!";

      if (sNameLower.includes('emiya') || sNameLower.includes('archer')) {
        busterDef = "Caladbolg II, overcharge projection!";
        artsDef = "Tracing the origin, replicating craftsmanship... Steel is my body!";
        quickDef = "Kanshou and Bakuya, dual arc trajectory!";
      } else if (sNameLower.includes('gilgamesh')) {
        busterDef = "Drown in the peerless treasures of Babylon!";
        artsDef = "A measured judgment from the Golden King.";
        quickDef = "A flurry of treasures rains from heaven!";
      } else if (sNameLower.includes('cú') || sNameLower.includes('cu') || sNameLower.includes('lancer')) {
        busterDef = "Gáe Bolg won't miss! Full-force thrust!";
        artsDef = "Nordic runes align! Mana charging into the spear!";
        quickDef = "The Hound leaves no tracks in the bloodied grass!";
      }

      title = `💬 Master Dialogue Studio: ${sName}`;
      description =
        `*Author custom combat chants and voice lines for **${sName}**!*\n\n` +
        `⚡ **COMBAT BRAVE CHAINS & NP:**\n` +
        `• 🔴 **Buster Brave:** *" ${quotes.busterChain || busterDef} "*\n` +
        `• 🔵 **Arts Mana:** *" ${quotes.artsChain || artsDef} "*\n` +
        `• 🟢 **Quick Star:** *" ${quotes.quickChain || quickDef} "*\n` +
        `• 🌟 **Noble Phantasm:** *" ${quotes.noblePhantasm || t.noblePhantasm.chant} "*\n` +
        `• ⚡ **Critical Strike:** *" ${quotes.critHit || 'Direct hit! Piercing the heart of fate!'} "*\n\n` +
        `🔮 **TACTICAL & COMMAND SEALS:**\n` +
        `• ✨ **Skill Activation:** *" ${quotes.skill || 'Unleashing arcane technique!'} "*\n` +
        `• 🔱 **Command Seal:** *" ${quotes.commandSeal || 'By my Command Seal, shatter all opposition!'} "*\n\n` +
        `📜 **INVOCATIONS & STANCES:**\n` +
        `• ⚔️ **Battle Start:** *" ${quotes.battleStart || t.battleStartQuote} "*\n` +
        `• 🏆 **Victory:** *" ${quotes.victory || t.victoryQuote} "*\n` +
        `• 💀 **Defeat:** *" ${quotes.defeat || t.defeatQuote || 'Forgive me, Master... My duty... remains unfulfilled...'} "*\n` +
        `• 🕯️ **Summon:** *" ${quotes.summon || t.summonQuote} "*\n\n` +
        `💡 *Set lines with \`/customise quote <type> "<text>"\`, click the Studio buttons below, or choose a Preset!*`;
      color = '#d4af37';
    } else if (category === ('equip_ce' as any)) {
      title = `👔 Equip Craft Essence — ${sName}`;
      const ownedCes = (master.craftEssences || []).filter(Boolean);
      const equippedCe = targetServant.equippedCe;
      description =
        `*Select a Craft Essence from your Master Vault to equip onto **${sName}**.*\n\n` +
        `🛡️ **Currently Equipped:** ${equippedCe ? `**[★${equippedCe.rarity}] ${equippedCe.name}** (+${equippedCe.atkBonus || 0} ATK / +${equippedCe.hpBonus || 0} HP)\n> *${equippedCe.effectText || equippedCe.description}*` : '*(None equipped)*'}\n\n` +
        `🎒 **Available Vault Craft Essences (${ownedCes.length}):**\n` +
        (ownedCes.length === 0
          ? '• *No Craft Essences in inventory. Claim practice CEs in `/inventory` or roll in `/gacha`!*'
          : ownedCes.slice(0, 5).map(c => `• **[★${c.rarity}] ${c.name}** (+${c.atkBonus || 0} ATK / +${c.hpBonus || 0} HP)`).join('\n'));
      color = '#38bdf8';
    } else if (category === ('feed_ce' as any)) {
      title = `🧪 Craft Essence Synthesis & EXP Feed — ${sName}`;
      const ownedCes = (master.craftEssences || []).filter(Boolean);
      description =
        `*Synthesize Craft Essences into spiritron mana to level up **${sName}** and earn +10 Stat Points per Level Up!*\n\n` +
        `🌟 **Current Level:** Lv.${lvl}/100 | **Available Stat Points:** \`${availPoints} pts\`\n` +
        `🎒 **Inventory Essences:** \`${ownedCes.length} Essences available to feed\``;
      color = '#a855f7';
    } else if (category === 'roster') {
      title = `📜 Contracted Heroic Spirits Roster (${ownedServants.length})`;
      description =
        `Master **${master.username}** currently holds contracts with **${ownedServants.length} Heroic Spirits**.\n\n` +
        ownedServants.map((s: any, idx: number) => {
          const sN = s.nickname || s.template?.name || s.name || 'Heroic Spirit';
          const sCls = s.template?.servantClass || s.servantClass || 'Saber';
          const isAct = master.activeServantId === s.id;
          const actBadge = isAct ? ' **[ACTIVE CONTRACT]**' : '';
          return `${idx + 1}. **[${sCls}]** **${sN}** — Lv.${s.level || 1}/100 | Points: \`${s.availableStatPoints || 0} pts\`${actBadge}\n   ↳ *NP: ${s.template?.noblePhantasm?.name || 'Classified'}*`;
        }).join('\n\n') +
        `\n\n*Select a Servant below to inspect parameters or set as your active contract.*`;
      color = '#d4af37';
    }

    const categoryNavButtons = [
      { id: 'servant_tab_profile', label: 'Parameters', style: (category === 'profile' ? 'primary' : 'secondary') as any, emoji: '📊' },
      { id: 'servant_tab_stats', label: 'Stat Points', style: (category === 'stats' ? 'primary' : 'secondary') as any, emoji: '⭐' },
      { id: 'servant_tab_equip_ce', label: 'Equip CE', style: (category === ('equip_ce' as any) ? 'primary' : 'secondary') as any, emoji: '👔' },
      { id: 'servant_tab_feed_ce', label: 'Feed CEs', style: (category === ('feed_ce' as any) ? 'primary' : 'secondary') as any, emoji: '🧪' },
      { id: 'servant_tab_dialogue', label: 'Voice Lines', style: (category === 'dialogue' ? 'primary' : 'secondary') as any, emoji: '💬' },
      { id: 'servant_tab_np', label: 'Noble Phantasm', style: (category === 'np' ? 'primary' : 'secondary') as any, emoji: '💥' },
      { id: 'servant_tab_roster', label: 'Roster', style: (category === 'roster' ? 'primary' : 'secondary') as any, emoji: '📜' }
    ];

    let actionButtons: any[] = [];
    if (category === 'stats') {
      actionButtons = [
        { id: 'servant_add_str', label: '+1 STR', style: 'success', emoji: '💪', disabled: availPoints <= 0 },
        { id: 'servant_add_end', label: '+1 END', style: 'success', emoji: '🛡️', disabled: availPoints <= 0 },
        { id: 'servant_add_agi', label: '+1 AGI', style: 'success', emoji: '⚡', disabled: availPoints <= 0 },
        { id: 'servant_add_mna', label: '+1 MNA', style: 'success', emoji: '🔮', disabled: availPoints <= 0 },
        { id: 'servant_add_auto', label: 'Auto-Distribute', style: 'primary', emoji: '✨', disabled: availPoints <= 0 }
      ];
    } else if (category === ('equip_ce' as any)) {
      actionButtons = [
        { id: 'inv_cat_ces', label: 'Open Vault', style: 'primary', emoji: '🛡️' },
        ...(targetServant.equippedCe ? [{ id: 'servant_act_unequip_ce', label: 'Unequip CE', style: 'danger' as const, emoji: '❌' }] : [])
      ];
    } else if (category === ('feed_ce' as any)) {
      actionButtons = [
        { id: 'inv_act_feed_1_3star', label: 'Feed 1-3★ CEs', style: 'success', emoji: '⚡' },
        { id: 'inv_act_feed_duplicates', label: 'Feed Duplicates', style: 'primary', emoji: '⚡' },
        { id: 'inv_act_feed_all', label: 'Feed All CEs', style: 'danger', emoji: '🔥' }
      ];
    } else if (category === 'dialogue') {
      actionButtons = [
        { id: `dlg_open_modal_combat_${targetServant.id}`, label: 'Combat & NP Studio ⚔️', style: 'primary', emoji: '⚔️' },
        { id: `dlg_open_modal_tactical_${targetServant.id}`, label: 'Tactical & Seals 🔮', style: 'primary', emoji: '🔮' },
        { id: `dlg_reset_lore_${targetServant.id}`, label: 'Reset Defaults ✨', style: 'secondary', emoji: '✨' },
        { id: 'btn_hear_quote', label: 'Replay Cut-In 🎬', style: 'success', emoji: '🎬' }
      ];
    } else {
      actionButtons = [
        { id: `servant_act_set_active_${targetServant.id}`, label: 'Set as Active', style: 'success', emoji: '👑', disabled: master.activeServantId === targetServant.id },
        { id: 'view_active_np', label: 'View NP Animation', style: 'danger', emoji: '🎬' },
        { id: 'btn_hear_quote', label: 'Hear Dialogue', style: 'primary', emoji: '💬' },
        { id: 'boast_servant_profile', label: 'Boast to Server', style: 'danger', emoji: '📢' }
      ];
    }

    const crossHubShortcuts = [
      { id: 'servant_link_inventory', label: 'Inventory (/inventory)', style: 'secondary' as const, emoji: '👔' },
      { id: 'servant_link_gacha', label: 'Gacha (/gacha)', style: 'secondary' as const, emoji: '🔮' },
      { id: 'servant_link_grailwar', label: 'War Board (/grailwar)', style: 'secondary' as const, emoji: '🏰' },
      { id: 'servant_link_duel', label: 'Duel Arena (/duel)', style: 'secondary' as const, emoji: '⚔️' }
    ];

    let selectOptions: any[] | undefined = undefined;
    let selectPlaceholder: string | undefined = undefined;

    if (category === 'profile') {
      selectPlaceholder = '👑 Select Custom Title / Nickname Preset...';
      selectOptions = [
        { value: 'servant_sel_title_preset_king_of_knights', label: '👑 Title: King of Knights', description: 'Sets title to King of Knights' },
        { value: 'servant_sel_title_preset_promised_victory', label: '🗡️ Title: Sword of Promised Victory', description: 'Sets title to Sword of Promised Victory' },
        { value: 'servant_sel_title_preset_sanctuary_warden', label: '🛡️ Title: Bounded Field Guardian', description: 'Sets title to Bounded Field Guardian' },
        { value: 'servant_sel_title_preset_grand_hero', label: '🌟 Title: Grand Spirit of Legend', description: 'Sets title to Grand Spirit of Legend' },
        { value: 'servant_sel_title_preset_reset', label: '✨ Reset Title to True Name', description: 'Resets title back to canon True Name' }
      ];
    } else if (category === 'dialogue') {
      selectPlaceholder = '💬 Apply Voice Line Chants & Dialogue Preset...';
      selectOptions = [
        { value: 'servant_sel_voice_preset_artoria_canon', label: '👑 Artoria Pendragon (Fate Canon)', description: 'True lore-accurate Fate/stay night & FGO voice lines' },
        { value: 'servant_sel_voice_preset_emiya_ubw', label: '🗡️ EMIYA (Unlimited Blade Works)', description: 'Tracing projection incantation and combat quotes' },
        { value: 'servant_sel_voice_preset_gilgamesh_king', label: '🔥 Gilgamesh (King of Heroes)', description: 'Vault of Babylon & Gate of Heaven quotes' },
        { value: 'servant_sel_voice_preset_cu_lancer', label: '🔱 Cú Chulainn (Gáe Bolg Thrust)', description: 'Ulster Hound battle shouts & pierced heart quotes' },
        { value: 'servant_sel_voice_preset_jalter_avenger', label: '🖤 Jeanne d\'Arc Alter (Dragon Witch)', description: 'Dark flames of vengeance & burning quotes' },
        { value: 'servant_sel_voice_preset_reset_lore', label: '✨ Reset to Pure Canon Defaults', description: 'Clears custom lines & uses exact database lore defaults' }
      ];
    } else if (category === ('equip_ce' as any)) {
      const ownedCes = (master.craftEssences || []).filter(Boolean);
      if (ownedCes.length > 0) {
        selectPlaceholder = '👔 Select Craft Essence to equip...';
        const ceCounts = new Map<string, { ce: any; count: number }>();
        for (const c of ownedCes) {
          if (!c) continue;
          const id = c.id || c.name;
          if (!ceCounts.has(id)) {
            ceCounts.set(id, { ce: c, count: 1 });
          } else {
            ceCounts.get(id)!.count++;
          }
        }
        const uniqueCes = Array.from(ceCounts.values());
        selectOptions = uniqueCes.slice(0, 25).map(({ ce, count }) => ({
          value: `servant_sel_equip_ce_${ce.id}`,
          label: `[★${ce.rarity || 3}] ${ce.name}${count > 1 ? ` (x${count})` : ''}`,
          description: `+${ce.atkBonus || 0} ATK / +${ce.hpBonus || 0} HP • ${ce.effectText || ce.description || 'Mystic Code'}`
        }));
      }
    } else if (category === ('feed_ce' as any)) {
      const ownedCes = (master.craftEssences || []).filter(Boolean);
      if (ownedCes.length > 0) {
        selectPlaceholder = '🧪 Select Craft Essence to synthesize (+EXP)...';
        selectOptions = ownedCes.slice(0, 25).map((c, idx) => ({
          value: `servant_sel_feed_ce_${idx}`,
          label: `[★${c.rarity || 3}] ${c.name}`,
          description: `Synthesize for Spiritron Mana (+EXP) • ${c.effectText || c.description || 'Mystic Code'}`
        }));
      }
    } else if (category === 'roster' || ownedServants.length > 1) {
      if (ownedServants.length > 1) {
        selectPlaceholder = `Selected: ${sName} (Lv.${lvl})`;
        const seenIds = new Set<string>();
        selectOptions = ownedServants.slice(0, 25).map((s, sIdx) => {
          let sVal = s.id || `servant_${sIdx}`;
          if (seenIds.has(sVal)) sVal = `${sVal}_${sIdx}`;
          seenIds.add(sVal);
          return {
            value: `servant_sel_switch_${sVal}`,
            label: `${s.nickname || s.template?.name || 'Servant'} (Lv.${s.level || 1})`,
            description: `Class: ${s.template?.servantClass || 'Saber'} • Points: ${s.availableStatPoints || 0} pts`
          };
        });
      }
    }

    addMessage({
      id: getNextId('bot_servant_hub'),
      sender: 'bot',
      timestamp: 'Just now',
      embed: {
        title,
        description,
        color,
        footer: `Servant Workshop • Master: ${master.username} • Selected: ${sName}`
      },
      canvasType,
      canvasPayload,
      artworkEmbed,
      components: {
        type: 'buttons',
        placeholder: selectPlaceholder,
        selectOptions: selectOptions,
        items: [...categoryNavButtons, ...actionButtons, ...crossHubShortcuts]
      }
    });
  };

  // Helper: Post Holy Grail War Operations Hub
  const postGrailWarHub = (
    category: 'board' | 'casualties' | 'leaks' | 'battles' | 'defenses' | 'familiars' | 'traps' | 'church' = 'board',
    actionOutcomeMsg?: string
  ) => {
    const userParticipant = grailWar.participants[master.discordId];
    let title = `🏆 ${grailWar.title}`;
    let description = '';
    let color = '#d4af37';
    let imageUrl: string | undefined = undefined;

    const participants = Object.values(grailWar.participants || {});
    const aliveParticipants = participants.filter(p => p.isAlive);
    const deadParticipants = participants.filter(p => !p.isAlive);
    const civilianCasualtiesList = grailWar.civilianCasualties || [];
    const leakedIntelList = grailWar.leakedIntel || [];
    const eventLogsList = grailWar.eventLogs || [];
    const totalCasualties = deadParticipants.length + civilianCasualtiesList.length;

    const resolveDiscordUsername = (rawStr: string | undefined): string => {
      if (!rawStr) return 'Citizen';
      const idMatch = rawStr.match(/\d{16,21}/);
      if (idMatch) {
        const uid = idMatch[0];
        const participant = participants.find(p => p.discordId === uid);
        if (participant?.username) return `@${participant.username.replace(/^@+/, '')}`;
        if (master && master.discordId === uid) return `@${master.username.replace(/^@+/, '')}`;
        const knownMap: Record<string, string> = {
          '780278575860678676': 'pokehunter1',
          '492833398461562880': 'itsderpo',
          '1257784101906157589': 'fou.chiii',
          '521112557810090005': 'cccp001',
          '1499028902104797237': 'fou.chii',
          '152568236896944130': 'bwjolioliravioli',
          '442009903809429515': 'fluffycat78',
          '189710170597752832': 'ixyan',
          '499898049145995276': 'togata_my_beloved',
          '728294594378203177': 'snoic_2',
          '373115070068162561': 'stahlgeist',
          '707978460697460758': 'paradise3812'
        };
        if (knownMap[uid]) return `@${knownMap[uid]}`;
        return `@Citizen_${uid.slice(-4)}`;
      }
      const clean = rawStr.replace(/[<@!>]/g, '').trim();
      return clean.length > 0 ? (clean.startsWith('@') ? clean : `@${clean}`) : rawStr;
    };

    if (category === 'board') {
      const deadCount = deadParticipants.length;
      const totalSummoned = participants.length;

      const rosterLines: string[] = [];
      for (let slotIdx = 0; slotIdx < 7; slotIdx++) {
        const m = participants[slotIdx];
        if (m) {
          const isRogue = (m.innocentKills || 0) >= 10 || m.bountyActive;
          const isRevealed = m.isExposed || !m.isAlive || isRogue;
          const statusIcon = m.isAlive ? (isRogue ? '☠️' : (isRevealed ? '🟢' : '🕶️')) : '💀';
          const nameLabel = isRevealed ? m.username : `Shadow Master #${slotIdx + 1}`;
          const servantLabel = isRevealed ? `${m.servantName} (${m.servantClass})` : '[Classified in Shadows]';
          let exposureTag = m.isExposed ? ' `[EXPOSED]`' : (!m.isAlive ? ' `[FALLEN]`' : '');
          if (isRogue) {
            exposureTag = ' `[WANTED - 15 SQ BOUNTY] ☠️ ROGUE HERETIC`';
          } else if (m.inSanctuary || (m as any).inChurchSanctuary) {
            exposureTag += ' `[⛪ SANCTUARY]`';
          }
          const curHp = calculateCurrentHp(m);
          rosterLines.push(`${statusIcon} **${nameLabel}**${exposureTag} — Servant: *${servantLabel}* | HP: \`${curHp.toLocaleString()}/${m.maxHp.toLocaleString()}\` | Kills: ${m.kills}`);
        } else {
          rosterLines.push(`⏳ **Slot #${slotIdx + 1}** — *[Unsummoned Heroic Spirit — Awaiting Master Covenant]*`);
        }
      }

      const publicEventsList = eventLogsList.filter(evt => {
        const txt = evt.text.toLowerCase();
        return !txt.includes('workshop defense') && 
               !txt.includes('auto-evacuation') && 
               !txt.includes('channeled mana') &&
               !txt.includes('bounded field');
      });

      const recentEvents = publicEventsList.slice(0, 6)
        .map(evt => {
          let icon = '📜';
          if (evt.type === 'elimination') icon = '💀';
          else if (evt.type === 'casualty') icon = '☠️';
          else if (evt.type === 'exposure') icon = '📡';
          else if (evt.type === 'ambush') icon = '⚔️';
          else if (evt.type === 'intel_leak') icon = '🕵️';
          else if (evt.type === 'alliance') icon = '🤝';

          let displayText = evt.text;
          displayText = displayText.replace(/@(\d{16,21})/g, (_, uid) => {
            return resolveDiscordUsername(uid);
          });
          participants.forEach((m, idx) => {
            if (!m.isExposed) {
              if (m.username && displayText.includes(m.username)) {
                displayText = displayText.replace(new RegExp(`Master \\*\\*${m.username}\\*\\*`, 'g'), 'A Shadow Master');
                displayText = displayText.replace(new RegExp(`\\*\\*${m.username}\\*\\*`, 'g'), `Shadow Master #${idx + 1}`);
                displayText = displayText.replace(new RegExp(m.username, 'g'), `Shadow Master #${idx + 1}`);
              }
              if (m.servantName && displayText.includes(m.servantName)) {
                displayText = displayText.replace(new RegExp(`\\*\\*${m.servantName}\\*\\*`, 'g'), 'Heroic Spirit');
                displayText = displayText.replace(new RegExp(m.servantName, 'g'), 'Heroic Spirit');
              }
            }
          });

          return `${icon} \`${new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\` ${displayText}`;
        })
        .join('\n');

      let statusHeader = '';
      if (grailWar.status === 'concluded') {
        const winner = grailWar.grailWinnerId && grailWar.participants[grailWar.grailWinnerId] 
          ? grailWar.participants[grailWar.grailWinnerId].username 
          : (aliveParticipants[0]?.username || 'Victor');
        statusHeader = `**Status:** 🏆 CONCLUDED | **Victor:** **${winner}** | **Civilian Casualties:** **${civilianCasualtiesList.length}**`;
      } else if (totalSummoned < 7) {
        statusHeader = `**Status:** 🕯️ GATHERING MASTERS (**${totalSummoned}/7** Summoned | **${aliveParticipants.length}** Alive | **${deadCount}/6** Cores Absorbed) | **Civilian Casualties:** **${civilianCasualtiesList.length}**`;
      } else {
        statusHeader = `**Status:** ⚔️ ACTIVE ELIMINATION PHASE (**${aliveParticipants.length}/7** Alive | **${deadCount}/6** Cores Absorbed) | **Civilian Casualties:** **${civilianCasualtiesList.length}**`;
      }

      const rogueMasters = participants.filter(p => p.isAlive && (((p.innocentKills || 0) >= 10) || p.bountyActive));
      const bountyNotice = rogueMasters.length > 0
        ? `\n\n🎯 **CHURCH EXTERMINATION BOUNTY ACTIVE:**\n` +
          rogueMasters.map(r => `• ☠️ **${r.username}** (${r.servantName} [${r.servantClass}]) — **${r.innocentKills} Civilian Kills**\n  ↳ **Bounty Reward:** **+1 Extra Command Seal** 💠 & **+15 Saint Quartz** 💎 for the Master who slays them!`).join('\n') + '\n'
        : '';

      description =
        `${statusHeader}\n\n` +
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `⚔️ **7 Masters Intelligence Roster:**\n${rosterLines.join('\n')}\n\n` +
        bountyNotice +
        `📜 **War Chronicle & Skirmishes (${eventLogsList.length} Events | ${leakedIntelList.length} Leaks):**\n${recentEvents || '*The war has begun. No city skirmishes recorded yet.*'}`;
      color = '#d4af37';

    } else if (category === 'casualties') {
      title = '☠️ Holy Grail War — Casualty Dossier (Masters & Civilians)';
      color = '#ef4444';

      const fallenMasterEntries = deadParticipants.map((m, idx) => {
        const timeStr = m.deathTimestamp ? new Date(m.deathTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Earlier in ritual';
        const killerInfo = m.killedByMaster ? `by Master **${m.killedByMaster}**` : 'in decisive skirmish';
        const fatalBlow = m.fatalSkillUsed ? ` [Blow: *${m.fatalSkillUsed}*]` : '';
        const sectorInfo = m.deathChannel ? ` in sector \`${m.deathChannel}\`` : '';
        return `• 💀 **${idx + 1}. Master ${m.username}** (Servant: *${m.servantName}* [${m.servantClass}])\n` +
               `  ↳ **Eliminated:** ${killerInfo}${fatalBlow}${sectorInfo} • *Time: ${timeStr}*`;
      });

      const fallenMastersText = fallenMasterEntries.length > 0
        ? fallenMasterEntries.join('\n\n')
        : '• *No Masters have fallen in this Holy Grail War yet. All combatants remain in active contention.*';

      const civilianEntries = civilianCasualtiesList.slice(0, 15).map((c, idx) => {
        const timeStr = new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const victimDisplay = resolveDiscordUsername(c.name);
        const rawSlayer = c.slayerUsername || c.slainByMasterId;
        const slayerInfo = rawSlayer ? `Master **${resolveDiscordUsername(rawSlayer).replace(/^@/, '')}**` : 'Unregistered Mage';
        const servantInfo = c.servantName ? ` (${c.servantName})` : '';
        const sectorStr = c.channelName || 'Fuyuki Sector';
        return `• 🩸 **${idx + 1}. ${victimDisplay}** — Sector \`${sectorStr}\`\n` +
               `  ↳ **Slayer:** ${slayerInfo}${servantInfo} | **Cause:** *${c.cause || 'Collateral Thaumaturgical Shockwave'}* • *Time: ${timeStr}*`;
      });

      const civilianText = civilianEntries.length > 0
        ? civilianEntries.join('\n\n') + (civilianCasualtiesList.length > 15 ? `\n\n*...and ${civilianCasualtiesList.length - 15} more civilian casualties on police record.*` : '')
        : '• *Zero civilian casualties reported. Mage\'s Association concealment protocols remain intact.*';

      description =
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `☠️ **CASUALTY TOLL & LEYLINE IMPACT:**\n` +
        `• **Total Casualties:** **${totalCasualties}** victims (**${deadParticipants.length}** Fallen Masters | **${civilianCasualtiesList.length}** Civilian Bystanders)\n` +
        `• **Grail Greater Core:** Absorbed **${deadParticipants.length}/6** Heroic Spirit spiritual cores\n` +
        `• **Mage Association Secrecy:** ${civilianCasualtiesList.length > 5 ? '🔴 **CRITICAL BREACH** (Inquisitors En Route)' : civilianCasualtiesList.length > 0 ? '🟡 **INVESTIGATION UNDERWAY**' : '🟢 **CONTAINED**'}\n\n` +
        `💀 **FALLEN MASTERS & ELIMINATED SERVANTS (${deadParticipants.length}/7):**\n` +
        `${fallenMastersText}\n\n` +
        `🩸 **CIVILIAN CASUALTIES REGISTER (${civilianCasualtiesList.length} Slain):**\n` +
        `${civilianText}\n\n` +
        `⚠️ *Caution: Heavy civilian slaughter compromises sector leylines and invites retribution from Holy Church Executors.*`;

    } else if (category === 'leaks') {
      title = '🕵️ Intercepted Leaks & Classified Transmissions';
      color = '#0284c7';

      const leakEntries = leakedIntelList.slice(0, 15).map((l, idx) => {
        const timeStr = new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const informantName = l.informantMasterName || l.informantMasterId;
        const sourceLabel = informantName ? `Informant: **${resolveDiscordUsername(informantName).replace(/^@/, '')}**` : 'Anonymous Recon Familiar';
        const targetName = l.exposedMasterName || l.targetMasterId;
        const targetLabel = targetName ? ` | Target Compromised: **${resolveDiscordUsername(targetName).replace(/^@/, '')}**` : '';
        const sectorStr = l.channelName || 'Fuyuki Intelligence Feed';
        return `• 📡 **[DISPATCH #${idx + 1}]** — Sector \`${sectorStr}\` (${timeStr})\n` +
               `  ↳ **Source:** ${sourceLabel}${targetLabel}\n` +
               `  ↳ **Transmission:** "${l.intel}"`;
      });

      const leaksText = leakEntries.length > 0
        ? leakEntries.join('\n\n') + (leakedIntelList.length > 15 ? `\n\n*...and ${leakedIntelList.length - 15} older intercepted transmissions in archives.*` : '')
        : '• *No intercepted communications or public leaks on record. Fuyuki magecraft channels remain silent.*';

      description =
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `🕵️ **CLASSIFIED RECON DISPATCHES (${leakedIntelList.length} Intercepted):**\n` +
        `• Intelligence leaks expose hidden Masters, reveal Servant Classes, and compromise workshop coordinates.\n` +
        `• Use \`/leak text:<message>\` to broadcast intercepted secrets or disinformation across Fuyuki.\n\n` +
        `📡 **INTERCEPTED TRANSMISSION LOGS:**\n` +
        `${leaksText}\n\n` +
        `💡 *Deploy Scouting Ravens or Alarm Wards to intercept and harvest leaks in real-time.*`;

    } else if (category === 'battles') {
      title = '⚔️ Holy Grail War — Battle Chronicles & Skirmishes';
      color = '#e11d48';

      const battleEvents = eventLogsList.filter(evt => {
        const txt = evt.text.toLowerCase();
        return evt.type === 'ambush' ||
               evt.type === 'elimination' ||
               evt.type === 'skirmish' ||
               evt.type === 'duel' ||
               txt.includes('clash') ||
               txt.includes('skirmish') ||
               txt.includes('ambush') ||
               txt.includes('attack');
      });

      const battleEntries = battleEvents.slice(0, 15).map((evt, idx) => {
        const timeStr = new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let icon = '⚔️';
        if (evt.type === 'elimination') icon = '💀';
        else if (evt.type === 'ambush') icon = '🗡️';

        let displayText = evt.text;
        participants.forEach((m, mIdx) => {
          if (!m.isExposed && m.discordId !== master.discordId) {
            if (m.username && displayText.includes(m.username)) {
              displayText = displayText.replace(new RegExp(`Master \\*\\*${m.username}\\*\\*`, 'g'), 'A Shadow Master');
              displayText = displayText.replace(new RegExp(`\\*\\*${m.username}\\*\\*`, 'g'), `Shadow Master #${mIdx + 1}`);
              displayText = displayText.replace(new RegExp(m.username, 'g'), `Shadow Master #${mIdx + 1}`);
            }
            if (m.servantName && displayText.includes(m.servantName)) {
              displayText = displayText.replace(new RegExp(`\\*\\*${m.servantName}\\*\\*`, 'g'), 'Heroic Spirit');
              displayText = displayText.replace(new RegExp(m.servantName, 'g'), 'Heroic Spirit');
            }
          }
        });

        return `• ${icon} **[CLASH #${idx + 1}]** \`${timeStr}\`\n  ↳ ${displayText}`;
      });

      const battleText = battleEntries.length > 0
        ? battleEntries.join('\n\n') + (battleEvents.length > 15 ? `\n\n*...and ${battleEvents.length - 15} earlier battle records in the archives.*` : '')
        : '• *No battle skirmishes or ambushes have been recorded yet. Masters are still calculating initial strikes.*';

      description =
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `⚔️ **FUYUKI BATTLE ENGAGEMENT CHRONICLES (${battleEvents.length} Recorded Clashes):**\n` +
        `• Tracks all ambushes, Noble Phantasm clashes, bounded field triggers, and master eliminations.\n\n` +
        `${battleText}\n\n` +
        `💡 *Initiate an ambush via \`/ambush @Master\` or patrol sectors to uncover traps and scout enemy movements.*`;

    } else if (category === 'defenses') {
      title = '🏰 Mage Workshop & Personal Sanctuary Defenses';
      color = '#3b82f6';
      if (!userParticipant) {
        description = 'You are currently an innocent bystander in Fuyuki City with no contracted Servant. Use `/gacha` or `/summon ritual` to enter the Holy Grail War.';
      } else {
        const ward = userParticipant?.boundedField || 'none';
        const autoEvade = userParticipant?.autoEvadeEnabled !== false;
        const seals = userParticipant?.commandSeals ?? master.commandSeals ?? 3;

        let wardDescription = '🚫 **No Active Wards:** Your workshop has no perimeter defenses.';
        if (ward === 'ward') {
          wardDescription = '🛡️ **Mage\'s Sanctuary Active:** Absorbs **60% of incoming ambush damage**.';
        } else if (ward === 'alarm') {
          wardDescription = '🚨 **Intrusion Alarm Active:** Deals **3,000 retaliatory DMG** and exposes intruders.';
        }

        description =
          `Master **${userParticipant?.username || master.username}**'s Defense Protocols\n\n` +
          (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
          `🛡️ **Bounded Field Ward:**\n${wardDescription}\n\n` +
          `🔴 **Command Seal Emergency Auto-Evacuation:**\n` +
          (autoEvade 
            ? `• **🟢 ENABLED:** Consumes **1 Command Seal** on fatal ambush to escape with **1 HP**.\n`
            : `• **🔴 DISABLED:** Fatal ambushes will eliminate your Servant normally.\n`) +
          `• **Command Seals Remaining:** \`${'✦ '.repeat(seals)}${'✧ '.repeat(Math.max(0, 3 - seals))}\` (**${seals}/3**)`;
      }

    } else if (category === 'familiars') {
      title = '🦅 Active Familiar Reconnaissance Network';
      color = '#0ea5e9';
      const userFamiliars = (grailWar.familiars || []).filter(f => f.masterId === master.discordId);
      let desc = '';
      if (userFamiliars.length === 0) {
        desc = 'You currently have **no active familiars** stationed in Fuyuki City.\n\nDeploy a reconnaissance familiar to gather intelligence and track rivals!';
      } else {
        desc = `You currently command **${userFamiliars.length}/2** active familiars:\n\n` +
          userFamiliars.map((f, idx) => {
            const typeLabel = f.familiarType === 'raven'
              ? '🦅 **Scouting Raven** (Surveillance)'
              : f.familiarType === 'homunculus'
              ? '🗿 **Homunculus Decoy** (Ambush Shield)'
              : '🦇 **Shadow Imp** (Sabotage & Siphon)';
            const intelLogs = (f.detectedIntel && f.detectedIntel.length > 0)
              ? `\n  ↳ **Surveillance Logs:**\n  ${f.detectedIntel.slice(0, 3).join('\n  ')}`
              : `\n  ↳ *No movement observed yet.*`;
            return `**${idx + 1}. Sector ${f.channelName}** — ${typeLabel}\n*Deployed <t:${Math.floor(f.createdAt / 1000)}:R>*${intelLogs}`;
          }).join('\n\n');
      }
      description = (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') + desc;

    } else if (category === 'traps') {
      title = '🕸️ Concealed Bounded Field Traps & Radar';
      color = '#8b5cf6';
      const userTraps = (grailWar.channelTraps || []).filter(t => t.setterMasterId === master.discordId);

      let myTrapsDesc = '';
      if (userTraps.length === 0) {
        myTrapsDesc = '• *You currently have no active Bounded Fields deployed in Fuyuki (0/2).*';
      } else {
        myTrapsDesc = userTraps.map((t, idx) => {
          const typeLabel = t.trapType === 'alarm' ? '🚨 **Alarm Ward** (Exposes intruder identity)' : '🩸 **Bloodfort Drain** (Siphons 1,800 HP)';
          return `**${idx + 1}. Sector \`${t.channelName}\`** — ${typeLabel}\n   └ *Status:* 🟢 **Concealed & Armed** • *Anchor: <t:${Math.floor(t.createdAt / 1000)}:R>*`;
        }).join('\n\n');
      }

      const radarLines = effectiveChannels.map(sec => {
        const activeTrap = (grailWar.channelTraps || []).find(t => t.channelName.toLowerCase() === sec.id.toLowerCase());
        if (!activeTrap) {
          return `• \`${sec.id}\`: ✨ **Clear** *(Available to anchor)*`;
        }
        if (activeTrap.setterMasterId === master.discordId) {
          const icon = activeTrap.trapType === 'alarm' ? '🚨' : '🩸';
          return `• \`${sec.id}\`: ${icon} **Armed by You** (${activeTrap.trapType === 'alarm' ? 'Alarm Ward' : 'Bloodfort Drain'})`;
        }
        return `• \`${sec.id}\`: 🔒 **Occupied** *(Master ${activeTrap.setterUsername})*`;
      }).join('\n');

      description =
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `Anchor hidden magecraft Bounded Fields in specific channels across Fuyuki.\n` +
        `*(Max 2 active Bounded Fields per Master • Only 1 Bounded Field can exist per channel)*\n\n` +
        `📍 **YOUR ACTIVE BOUNDED FIELDS (${userTraps.length}/2):**\n${myTrapsDesc}\n\n` +
        `🗺️ **FUYUKI LEYLINE SECTORS RADAR:**\n${radarLines}\n\n` +
        `*Select a sector from the menu or click an action below to deploy/disarm:*`;

    } else if (category === 'church') {
      title = '⛪ Fuyuki Church Sanctuary & Bounty Board (Father Kotomine)';
      const isUnderSanctuary = !!(userParticipant?.inSanctuary || (userParticipant as any)?.inChurchSanctuary);
      const kills = userParticipant ? (userParticipant.innocentKills || 0) : (master.innocentKills || 0);
      const rep = getReputationInfo(kills);
      const rogueMasters = Object.values(grailWar.participants || {}).filter(
        p => p.isAlive && (((p.innocentKills || 0) >= 10) || p.bountyActive || p.isRogueHeretic)
      );

      let standingText = `• **Your Standing:** ${rep.badge} (\`${kills}/10\` Civilian Kills)\n`;
      if (rep.isRogue) {
        standingText += `  ↳ ☠️ **EXCOMMUNICATED:** Sanctuary barred. Active +1 CS & +15 SQ bounty on head.\n`;
      } else if (kills >= 7) {
        standingText += `  ↳ 🩸 **High Scrutiny:** Approaching 10 civilian kills threshold.\n`;
      } else if (kills >= 4) {
        standingText += `  ↳ ⚠️ **Reprimanded:** Monitored for Magecraft secrecy violations.\n`;
      } else {
        standingText += `  ↳ 🕊️ **Good Standing:** Neutral asylum rights granted upon request.\n`;
      }

      let bountyBoardSection = '';
      if (rogueMasters.length > 0) {
        bountyBoardSection = `\n\n🎯 **ACTIVE CHURCH EXTERMINATION BOUNTIES (${rogueMasters.length} WANTED):**\n` +
          rogueMasters.map(r => `• ☠️ **${r.username}** (${r.servantName || 'Servant'} [${r.servantClass || 'Class'}]) — **${r.innocentKills || 10} Kills** (+1 CS & +15 SQ)`).join('\n');
      } else {
        bountyBoardSection = `\n\n🎯 **ACTIVE BOUNTIES:** No Rogue Heretics currently wanted by the Church.`;
      }

      color = rep.isRogue ? '#ef4444' : isUnderSanctuary ? '#22c55e' : '#d4af37';
      description =
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `*"Welcome to the Fuyuki Church, Master. Under the supervision of the Holy Church and Father Kotomine, neutral asylum is guaranteed to any combatant who yields their right to the Grail."*\n\n` +
        `📜 **SANCTUARY RULES & STATUS:**\n` +
        `• **Your Status:** ${isUnderSanctuary ? '🕊️ **UNDER CHURCH ASYLUM** *(Immune to ambushes & unable to attack)*' : '⚔️ **ACTIVE COMBATANT** *(Can engage in skirmishes)*'}\n` +
        standingText +
        `• **Immunity:** Masters residing within the Church cannot be ambushed or tracked by familiars.\n` +
        `• **Restriction:** While under sanctuary, you cannot launch ambushes, leak intel, or duel rivals.` +
        bountyBoardSection +
        `\n\n*Choose an action below to claim or renounce church asylum, or inspect bounties and reputation.*`;
    }

    const isBoardView = ['board', 'casualties', 'leaks', 'battles'].includes(category);

    const categoryNavButtons = [
      { id: 'war_tab_board', label: 'War Board', style: (isBoardView ? 'primary' : 'secondary') as any, emoji: '🏆' },
      { id: 'war_tab_defenses', label: 'Defenses', style: (category === 'defenses' ? 'primary' : 'secondary') as any, emoji: '🏰' },
      { id: 'war_tab_familiars', label: 'Familiars', style: (category === 'familiars' ? 'primary' : 'secondary') as any, emoji: '🦅' },
      { id: 'war_tab_traps', label: 'Traps', style: (category === 'traps' ? 'primary' : 'secondary') as any, emoji: '🕸️' },
      { id: 'war_tab_church', label: 'Church', style: (category === 'church' ? 'primary' : 'secondary') as any, emoji: '⛪' }
    ];

    let boardSubViewButtons: any[] = [];
    if (isBoardView) {
      const battlesCount = eventLogsList.filter(e => e.type === 'ambush' || e.type === 'elimination' || e.type === 'skirmish' || e.type === 'duel' || (e.text || '').toLowerCase().includes('clash') || (e.text || '').toLowerCase().includes('skirmish')).length;
      boardSubViewButtons = [
        { id: 'war_board_roster', label: '7 Masters', style: (category === 'board' ? 'primary' : 'secondary') as any, emoji: '📋' },
        { id: 'war_board_casualties', label: `Casualties (${totalCasualties})`, style: (category === 'casualties' ? 'danger' : 'secondary') as any, emoji: '☠️' },
        { id: 'war_board_leaks', label: `Leaks (${leakedIntelList.length})`, style: (category === 'leaks' ? 'primary' : 'secondary') as any, emoji: '🕵️' },
        { id: 'war_board_battles', label: `Battles (${battlesCount})`, style: (category === 'battles' ? 'primary' : 'secondary') as any, emoji: '⚔️' },
        { id: 'war_act_refresh', label: 'Refresh', style: 'secondary' as const, emoji: '🔄' }
      ];
    }

    let actionButtons: any[] = [];
    if (isBoardView) {
      actionButtons = [
        { id: 'war_act_patrol', label: 'Patrol Sector', style: 'success', emoji: '👁️' },
        { id: 'war_attack_prompt', label: 'Ambush Suspect', style: 'danger', emoji: '⚔️' },
        { id: 'war_act_heal', label: 'Leyline Heal (40%)', style: 'primary', emoji: '✨' }
      ];
    } else if (category === 'defenses') {
      const curWard = (userParticipant as any)?.boundedField || 'none';
      const autoEvade = (userParticipant as any)?.autoEvadeEnabled !== false;
      actionButtons = [
        { id: 'ward_none', label: 'No Wards', style: curWard === 'none' ? 'primary' : 'secondary', emoji: '🚫' },
        { id: 'ward_ward', label: 'Sanctuary (60% Block)', style: curWard === 'ward' ? 'success' : 'secondary', emoji: '🛡️' },
        { id: 'ward_alarm', label: 'Alarm Trap (3k DMG)', style: curWard === 'alarm' ? 'danger' : 'secondary', emoji: '🚨' },
        { id: 'toggle_auto_evade', label: autoEvade ? 'Auto-Evacuate: ON 🟢' : 'Auto-Evacuate: OFF 🔴', style: autoEvade ? 'success' : 'secondary' }
      ];
    } else if (category === 'familiars') {
      const userFamiliars = (grailWar.familiars || []).filter(f => f.masterId === master.discordId);
      actionButtons = [
        { id: 'war_deploy_raven', label: 'Deploy Raven', style: 'primary', emoji: '🦅' },
        { id: 'war_deploy_homunculus', label: 'Deploy Decoy', style: 'success', emoji: '🗿' },
        { id: 'war_deploy_shadow_imp', label: 'Deploy Shadow Imp', style: 'secondary', emoji: '🦇' },
        { id: 'recall_all_familiars', label: 'Recall Familiars', style: 'danger', emoji: '🕊️', disabled: userFamiliars.length === 0 }
      ];
    } else if (category === 'traps') {
      const userTraps = (grailWar.channelTraps || []).filter(t => t.setterMasterId === master.discordId);
      actionButtons = [
        { id: 'prompt_anchor_alarm', label: 'Anchor Alarm Ward...', style: 'primary', emoji: '🚨', disabled: userTraps.length >= 2 },
        { id: 'prompt_anchor_drain', label: 'Anchor Bloodfort Drain...', style: 'danger', emoji: '🩸', disabled: userTraps.length >= 2 }
      ];
      userTraps.forEach(t => {
        actionButtons.push({
          id: `disarm_trap_${t.channelName}`,
          label: `Disarm ${t.channelName}`,
          style: 'secondary',
          emoji: '🧹'
        });
      });
      if (userTraps.length > 0) {
        actionButtons.push({
          id: 'disarm_all_traps',
          label: 'Disarm All Traps',
          style: 'secondary',
          emoji: '🧹'
        });
      }
      actionButtons.push({
        id: 'add_custom_channel_btn',
        label: '+ Connect Channel',
        style: 'secondary',
        emoji: '➕'
      });
      actionButtons.push({
        id: 'refresh_traps_radar',
        label: 'Refresh Radar',
        style: 'secondary',
        emoji: '🔄'
      });
    } else if (category === 'church') {
      const isUnderSanctuary = !!(userParticipant?.inSanctuary || (userParticipant as any)?.inChurchSanctuary);
      const isRogue = (userParticipant?.innocentKills || 0) >= 10 || (userParticipant as any)?.bountyActive;
      actionButtons = [
        { id: 'church_claim_asylum', label: 'Enter Sanctuary', style: 'success', emoji: '🕊️', disabled: isUnderSanctuary || isRogue },
        { id: 'church_leave_asylum', label: 'Depart Sanctuary', style: 'danger', emoji: '🚪', disabled: !isUnderSanctuary },
        { id: 'war_tab_bounties', label: 'Bounty Registry', style: 'secondary', emoji: '🎯' },
        { id: 'war_tab_reputation', label: 'Reputation Dossier', style: 'secondary', emoji: '📜' }
      ];
    }

    const crossHubShortcuts = [
      { id: 'war_link_inventory', label: 'Inventory (/inventory)', style: 'secondary' as const, emoji: '👔' },
      { id: 'war_link_gacha', label: 'Gacha (/gacha)', style: 'secondary' as const, emoji: '🔮' },
      { id: 'war_link_servant', label: 'Servant (/servant)', style: 'secondary' as const, emoji: '👑' },
      { id: 'war_link_duel', label: 'Duel Arena (/duel)', style: 'secondary' as const, emoji: '⚔️' }
    ];

    let hubSelectOptions: any[] | undefined = undefined;
    let hubPlaceholder: string | undefined = undefined;

    if (category === 'traps') {
      const userTraps = (grailWar.channelTraps || []).filter(t => t.setterMasterId === master.discordId);
      const opts: any[] = [];
      effectiveChannels.forEach(sec => {
        const activeTrap = (grailWar.channelTraps || []).find(t => t.channelName.toLowerCase() === sec.id.toLowerCase());
        const isCurrent = sec.id === activePublicSector;
        const currentTag = isCurrent ? ' ⭐ [CURRENT]' : '';
        if (!activeTrap && userTraps.length < 2) {
          opts.push({
            value: `anchor_trap_alarm_${sec.id}`,
            label: `Anchor Alarm Ward in ${sec.id}${currentTag}`,
            description: `Expose intruders entering ${sec.label}`,
            emoji: '🚨'
          });
          opts.push({
            value: `anchor_trap_drain_${sec.id}`,
            label: `Anchor Bloodfort Drain in ${sec.id}${currentTag}`,
            description: `Siphon 1,800 HP from intruders in ${sec.label}`,
            emoji: '🩸'
          });
        } else if (activeTrap) {
          const isMine = activeTrap.setterMasterId === master.discordId;
          opts.push({
            value: `disarm_trap_${sec.id}`,
            label: isMine 
              ? `Disarm Bounded Field in ${sec.id}${currentTag}`
              : `🗡️ Infiltrate & Disarm Rival Field in ${sec.id}${currentTag}`,
            description: isMine
              ? `Dissolve your active ${activeTrap.trapType === 'alarm' ? 'Alarm Ward' : 'Bloodfort Drain'}`
              : `Dismantle Master ${activeTrap.setterUsername}'s ${activeTrap.trapType === 'alarm' ? 'Alarm Ward' : 'Bloodfort Drain'}`,
            emoji: isMine ? '🧹' : '🗡️'
          });
        }
      });
      if (opts.length > 0) {
        hubSelectOptions = opts.slice(0, 25);
        hubPlaceholder = '🎯 Select channel to anchor or disarm Bounded Field...';
      }
    }

    addMessage({
      id: getNextId('bot_grailwar_hub'),
      sender: 'bot',
      timestamp: 'Just now',
      embed: {
        title,
        description,
        color,
        footer: 'Holy Grail War Hub • 7-Master Battle Royale Operations'
      },
      components: {
        type: 'buttons',
        placeholder: hubPlaceholder,
        selectOptions: hubSelectOptions,
        items: [...categoryNavButtons, ...boardSubViewButtons, ...actionButtons, ...crossHubShortcuts]
      }
    });
  };

  // Helper: Post Administrator Control Hub
  const postAdminHub = (
    category: 'war' | 'war_rules' | 'npanim' | 'npsettings' | 'listnp' | 'economy' = 'war',
    actionOutcomeMsg?: string
  ) => {
    let title = '👑 Holy Grail War Admin Suite';
    let description = '';
    let color = '#d4af37';

    const currentRules = (grailWar as any).rules || {
      maxMasters: 7,
      startingCommandSeals: 3,
      classExclusivity: true,
      servantPool: 'canon_only',
      permadeath: true,
      churchAsylum: true,
      leylineDensity: 'standard',
      trapLimitPerMaster: 2,
      factionMode: false
    };

    if (category === 'war') {
      title = '🏆 Overseer Control: Holy Grail War Master Dashboard';
      color = '#d4af37';
      const poolTag = currentRules.servantPool === 'canon_only'
        ? '📖 Canon Type-Moon Only'
        : currentRules.servantPool === 'custom_only'
          ? '🎨 Custom Community Only'
          : '✨ Canon + Custom Servants';

      description =
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `Configure rituals, adjust lethality & servant pools, or trigger leyline cataclysms across the server.\n\n` +
        `🏰 **Active War Format:** **${grailWar.title || '5th Fuyuki Holy Grail War'}**\n` +
        `👥 **Roster Status:** **${Object.keys(grailWar.participants || {}).length}/${currentRules.maxMasters || 7} Masters Active** | ☠️ **Eliminations:** **${Object.values(grailWar.participants || {}).filter(p => !p.isAlive).length} Fallen**\n\n` +
        `📋 **Active Ritual Configuration & Rules:**\n` +
        `• ⚔️ **Servant Pool:** ${poolTag}\n` +
        `• 🔒 **Class Exclusivity:** \`${currentRules.classExclusivity ? 'Strict (1 per Class)' : 'Open (Duplicates Allowed)'}\`\n` +
        `• 💀 **Lethality Mode:** \`${currentRules.permadeath ? 'Permadeath (Eliminated on HP 0)' : 'Casual / Training Mode'}\`\n` +
        `• ✦ **Starting Command Seals:** \`${currentRules.startingCommandSeals || 3} Seals\`\n` +
        `• 💧 **Leyline Density:** \`${currentRules.leylineDensity === 'fast' ? 'High Surge (2x Fast)' : currentRules.leylineDensity === 'desolate' ? 'Desolate (No Regen)' : 'Standard (5 min full recovery)'}\`\n` +
        `• ⛪ **Church Sanctuary:** \`${currentRules.churchAsylum ? 'Active Asylum under Father Kotomine' : 'Desecrated (No Asylum)'}\`\n\n` +
        `*Click a preset or switch to the **Customize Rules** tab to tune individual settings!*`;
    } else if (category === 'war_rules') {
      title = '⚙️ Overseer Ritual Workshop — Interactive Rule Customizer';
      color = '#eab308';
      const poolTag = currentRules.servantPool === 'canon_only'
        ? '📖 Canon Type-Moon Only'
        : currentRules.servantPool === 'custom_only'
          ? '🎨 Custom Community Only'
          : '✨ Canon + Custom Servants';

      description =
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `Directly tune ritual parameters for the active Holy Grail War. Use the direct action buttons below.\n\n` +
        `🔱 **Starting Command Seals:** \`${currentRules.startingCommandSeals || 3} Seals\` *(Options: 1, 2, 3, 5, 10)*\n` +
        `👥 **Master Roster Capacity:** \`${currentRules.maxMasters || 7} Masters\` *(Options: 7, 14, 30)*\n` +
        `⚔️ **Servant Summon Pool:** ${poolTag}\n` +
        `🔒 **Class Exclusivity:** \`${currentRules.classExclusivity ? 'Strict (1 per Class)' : 'Open (Duplicates Allowed)'}\`\n` +
        `💀 **Lethality & Permadeath:** \`${currentRules.permadeath ? 'Permadeath (Eliminated on HP 0)' : 'Casual / Training Mode'}\`\n` +
        `⛪ **Church Sanctuary:** \`${currentRules.churchAsylum ? '🟢 Active Asylum (Father Kotomine)' : '🔴 Desecrated (No Asylum)'}\`\n` +
        `🚩 **Factions:** \`${currentRules.factionMode ? 'Red vs Black (Apocrypha)' : 'Free-For-All'}\`\n\n` +
        `*Click any button below to instantly apply or toggle that rule!*`;
    } else if (category === 'npanim') {
      title = '🎬 Admin Control: Noble Phantasm Animation Manager';
      color = '#d4af37';
      description =
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `Configure cinematic animated GIFs and True Name invocation chants for Servants during combat and Noble Phantasm cut-ins.\n\n` +
        `• **Supported Formats:** Tenor, Giphy, direct .gif URLs, and uploaded MP4/GIF assets\n` +
        `• **Full Width Delivery:** Renders directly at full resolution in chat\n\n` +
        `*Use \`/admin npanim servant:<name> gif_url:<url> chant:<text>\` to configure!*`;
    } else if (category === 'npsettings') {
      title = '⚙️ Admin Control: Duel Noble Phantasm Settings';
      color = '#3b82f6';
      description =
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `Configure duel animation display timers and automatic message deletion.\n\n` +
        `• **Delivery Mode:** \`Native Full-Width Discord\` (No embed boundaries)\n` +
        `• **Auto-Delete on Next Turn:** \`Enabled 🟢\` (Cleans up GIF when next turn is picked)\n` +
        `• **AFK Safety Timeout:** \`60s\`\n\n` +
        `*Toggle settings directly using the action buttons below:*`;
    } else if (category === 'listnp') {
      title = '📋 Registered Custom Animations';
      color = '#8b5cf6';
      description =
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `1. **Artoria Pendragon** — [Excalibur GIF](https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjEx...)\n> Chant: *“Sword of Promised Victory! EX---CALIBUR!”*\n\n` +
        `2. **Gilgamesh** — [Enuma Elish GIF](https://media.giphy.com/media/v1.Y2lkPTc5MGI3...)\n> Chant: *“Behold the star of creation... Enuma Elish!”*\n\n` +
        `*Use the Servant Workshop tab or /admin npanim to add more animations.*`;
    } else if (category === 'economy') {
      title = '💎 Admin Control: Economy & Saint Quartz Mint';
      color = '#10b981';
      description =
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `Administrative tools for currency distribution and test summonings.\n\n` +
        `• **Master Balance:** \`${master.saintQuartz || 0} SQ\` | \`${((master as any).qp || 0).toLocaleString()} QP\`\n` +
        `• **Command Seals:** \`${master.commandSeals ?? 3}/3\`\n\n` +
        `*Click a quick-action button below to mint resources for your account:*`;
    }

    const categoryNavButtons = [
      { id: 'admin_tab_war', label: 'Grail War', style: (category === 'war' ? 'primary' : 'secondary') as any, emoji: '🏆' },
      { id: 'admin_tab_war_rules', label: 'Customize Rules', style: (category === 'war_rules' ? 'primary' : 'secondary') as any, emoji: '⚙️' },
      { id: 'admin_tab_npanim', label: 'NP Animations', style: (category === 'npanim' ? 'primary' : 'secondary') as any, emoji: '🎬' },
      { id: 'admin_tab_npsettings', label: 'Duel Settings', style: (category === 'npsettings' ? 'primary' : 'secondary') as any, emoji: '⚙️' },
      { id: 'admin_tab_economy', label: 'Economy Mint', style: (category === 'economy' ? 'primary' : 'secondary') as any, emoji: '💎' }
    ];

    let actionButtons: any[] = [];
    if (category === 'war') {
      actionButtons = [
        { id: 'admin_war_preset_fuyuki_7', label: '5th Fuyuki (7P)', style: 'primary', emoji: '🏆' },
        { id: 'admin_war_preset_apocrypha_14', label: 'Apocrypha (14P)', style: 'success', emoji: '⚔️' },
        { id: 'admin_war_preset_singularity_chaos', label: 'Singularity (30P)', style: 'secondary', emoji: '🌌' },
        { id: 'admin_war_preset_desolate_hardcore', label: 'Desolate Hardcore', style: 'danger', emoji: '💀' },
        { id: 'admin_war_fresh_slate', label: 'Fresh Season (Wipe All Contracts)', style: 'danger', emoji: '🧹' },
        { id: 'admin_war_reset_my_servant', label: 'Release My Servant', style: 'danger', emoji: '🗡️' },
        { id: 'admin_war_reset_my_stats', label: 'Reset Servant to Lv.1', style: 'secondary', emoji: '🌱' },
        { id: 'admin_war_action_restart', label: 'Restart War (Wipe Roster)', style: 'success', emoji: '🚀' },
        { id: 'admin_war_action_reset', label: 'Quick Refresh', style: 'secondary', emoji: '🔄' },
        { id: 'admin_war_cataclysm_hub', label: 'Cataclysm', style: 'danger', emoji: '⚡' },
        { id: 'admin_war_history_view', label: 'Hall of Fame', style: 'secondary', emoji: '📜' }
      ];
    } else if (category === 'war_rules') {
      const curSeals = currentRules.startingCommandSeals || 3;
      const curCap = currentRules.maxMasters || 7;
      actionButtons = [
        // Command seals selection buttons
        { id: 'admin_set_seals_1', label: '1 Seal', style: curSeals === 1 ? 'primary' : 'secondary', emoji: '🔱' },
        { id: 'admin_set_seals_2', label: '2 Seals', style: curSeals === 2 ? 'primary' : 'secondary', emoji: '🔱' },
        { id: 'admin_set_seals_3', label: '3 Seals (Default)', style: curSeals === 3 ? 'primary' : 'secondary', emoji: '🔱' },
        { id: 'admin_set_seals_5', label: '5 Seals', style: curSeals === 5 ? 'primary' : 'secondary', emoji: '🔱' },
        { id: 'admin_set_seals_10', label: '10 Seals (Overdrive)', style: curSeals === 10 ? 'primary' : 'secondary', emoji: '🔱' },
        // Capacity selection buttons
        { id: 'admin_set_cap_7', label: '7 Masters', style: curCap === 7 ? 'primary' : 'secondary', emoji: '👥' },
        { id: 'admin_set_cap_14', label: '14 Masters (Apocrypha)', style: curCap === 14 ? 'primary' : 'secondary', emoji: '👥' },
        { id: 'admin_set_cap_30', label: '30 Masters (Grand War)', style: curCap === 30 ? 'primary' : 'secondary', emoji: '👥' },
        // Toggles
        { id: 'admin_toggle_permadeath', label: currentRules.permadeath ? 'Permadeath: ON 💀' : 'Permadeath: OFF (Casual) 🛡️', style: currentRules.permadeath ? 'danger' : 'success' },
        { id: 'admin_toggle_church', label: currentRules.churchAsylum ? 'Church Asylum: ON ⛪' : 'Church Asylum: OFF 🚫', style: currentRules.churchAsylum ? 'success' : 'secondary' },
        { id: 'admin_toggle_class_excl', label: currentRules.classExclusivity ? 'Class Exclusivity: ON 🔒' : 'Class Exclusivity: OFF 🔓', style: currentRules.classExclusivity ? 'primary' : 'secondary' },
        { id: 'admin_toggle_factions', label: currentRules.factionMode ? 'Factions: ON (Red vs Black) 🚩' : 'Factions: OFF (FFA) ⚔️', style: currentRules.factionMode ? 'primary' : 'secondary' },
        // Refill all seals
        { id: 'admin_refill_all_seals', label: 'Refill All Masters Seals', style: 'success', emoji: '✨' },
        { id: 'admin_war_action_reset', label: 'Refresh State', style: 'secondary', emoji: '🔄' }
      ];
    } else if (category === 'economy') {
      actionButtons = [
        { id: 'admin_mint_30sq', label: '+30 SQ (Multi)', style: 'primary', emoji: '💎' },
        { id: 'admin_mint_100sq', label: '+100 SQ', style: 'success', emoji: '💎' },
        { id: 'admin_mint_qp', label: '+1,000,000 QP', style: 'secondary', emoji: '🪙' },
        { id: 'admin_refill_seals', label: 'Refill 3 Seals', style: 'secondary', emoji: '🔱' },
        { id: 'admin_reset_currency', label: 'Reset Currency', style: 'danger', emoji: '🧹' },
        { id: 'admin_reset_inventory', label: 'Reset Inventory', style: 'danger', emoji: '🎒' },
        { id: 'admin_reset_vault', label: 'Reset All Vault', style: 'danger', emoji: '🔄' },
        { id: 'admin_reset_all_economy', label: 'Server-Wide Wipe', style: 'danger', emoji: '⚠️' }
      ];
    } else if (category === 'npsettings') {
      actionButtons = [
        { id: 'admin_toggle_autodelete', label: 'Toggle Auto-Delete', style: 'primary', emoji: '🔄' },
        { id: 'admin_set_afk_30', label: 'Timeout 30s', style: 'secondary' },
        { id: 'admin_set_afk_60', label: 'Timeout 60s', style: 'secondary' }
      ];
    } else {
      actionButtons = [
        { id: 'admin_refresh_view', label: 'Refresh View', style: 'secondary', emoji: '🔄' },
        { id: 'admin_link_gacha', label: 'Gacha Test (/gacha)', style: 'secondary', emoji: '🔮' },
        { id: 'admin_link_duel', label: 'Duel Test (/duel)', style: 'secondary', emoji: '⚔️' }
      ];
    }

    const crossHubShortcuts = [
      { id: 'admin_link_inventory', label: 'Inventory (/inventory)', style: 'secondary' as const, emoji: '👔' },
      { id: 'admin_link_servant', label: 'Servant (/servant)', style: 'secondary' as const, emoji: '👑' },
      { id: 'admin_link_grailwar', label: 'Grail War (/grailwar)', style: 'secondary' as const, emoji: '🏰' },
      { id: 'admin_link_duel_main', label: 'Duel Arena (/duel)', style: 'secondary' as const, emoji: '⚔️' }
    ];

    addMessage({
      id: getNextId('bot_admin_hub'),
      sender: 'bot',
      timestamp: 'Just now',
      embed: {
        title,
        description,
        color,
        footer: 'Fate/Grand Order Master Administration Suite'
      },
      components: {
        type: 'buttons',
        items: [...categoryNavButtons, ...actionButtons, ...crossHubShortcuts]
      }
    });
  };

  // Helper: Post Combat Arena & Duel Hub
  const postDuelHub = (
    category: 'arena' | 'active' | 'history' | 'leaderboard' = 'arena',
    actionOutcomeMsg?: string
  ) => {
    let title = '⚔️ Combat Arena — Holy Grail War Duels Hub';
    let description = '';
    let color = '#ef4444';

    const sName = activeServant?.nickname || activeServant?.template?.name || 'Contracted Servant';
    const sClass = activeServant?.template?.servantClass || 'Saber';
    const sLvl = activeServant?.level || 1;

    if (category === 'arena') {
      title = '⚔️ Combat Arena — Matchmaking & Challenger Lobby';
      color = '#ef4444';
      description =
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `👑 **Active Champion:** **${sName}** (\`${sClass}\` Lv.${sLvl})\n` +
        `❤️ **Combat Parameters:** \`${activeServant?.template?.baseHp?.toLocaleString() || '14,000'} HP\` | \`${activeServant?.template?.baseAtk?.toLocaleString() || '11,000'} ATK\`\n` +
        `🔴 **Command Seals:** \`${master.commandSeals ?? 3}/3\`\n\n` +
        `🏟️ **Arena Status:** 🟢 **OPEN FOR CHALLENGERS**\n` +
        `• **Ranked Matchmaking:** Queue against real server Masters across Fuyuki leylines.\n` +
        `• **Direct Challenge:** Challenge any mentioned Master using \`/duel opponent:@Master\`.\n` +
        `• **Rewards:** Victory grants **+300 Bond EXP, +3 Saint Quartz, +5 Master EXP, +50 Glory Points**.\n\n` +
        `*Click **Queue Matchmaking** or use the action buttons below to begin!*`;

    } else if (category === 'active') {
      if (!activeDuel) {
        title = '🥊 Active Duel — No Encounter In Progress';
        color = '#64748b';
        description =
          (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
          `You are not currently engaged in an active combat duel.\n\n` +
          `• **Start an Encounter:** Return to the **Arena Lobby** tab and click **Queue Matchmaking** or specify a rival Master with \`/duel opponent:@Master\`.\n` +
          `• **Turn Rules:** Select 3 Command Cards (Buster, Arts, Quick) each turn to build damage chains, charge your NP gauge, or generate critical stars!`;
      } else {
        const battle = activeDuel.battle;
        const p1 = battle.player1;
        const p2 = battle.player2;
        title = `🥊 Active Duel — Turn ${battle.currentTurn}: ${p1.name} vs ${p2.name}`;
        color = '#ef4444';
        const fleeInfo = calculateFleeChance(p1.currentHp, p1.maxHp, p1.servantClass, activeServant?.template?.baseStats?.agility || 10);
        description =
          (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
          `**${p1.name}** (Master: ${p1.masterName})\n` +
          `❤️ HP: \`${p1.currentHp.toLocaleString()}/${p1.maxHp.toLocaleString()}\` | ⚡ NP Gauge: \`${Math.round(p1.npGauge)}%\`\n\n` +
          `**VS**\n\n` +
          `**${p2.name}** (Master: ${p2.masterName})\n` +
          `❤️ HP: \`${p2.currentHp.toLocaleString()}/${p2.maxHp.toLocaleString()}\` | ⚡ NP Gauge: \`${Math.round(p2.npGauge)}%\`\n\n` +
          `👉 **Command Sequence:** Select your 3-card attack chain or unleash your Noble Phantasm:`;
      }

    } else if (category === 'history') {
      title = '📜 Master Combat Records & War Chronicles';
      color = '#3b82f6';
      const wins = (master as any).duelsWon || 0;
      const losses = (master as any).duelsLost || 0;
      const total = wins + losses;
      const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : '100.0';
      const kills = (master as any).servantKills || 0;

      description =
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `Master **${master.username}**'s Official Combat Record:\n\n` +
        `• 🏆 **Total Duels:** \`${total}\` (\`${wins} Wins\` / \`${losses} Losses\`)\n` +
        `• 📊 **Win Rate:** \`${winRate}%\`\n` +
        `• 💀 **Heroic Spirits Defeated:** \`${kills}\`\n` +
        `• 🌟 **Arena Glory Points:** \`${(wins * 50) + (kills * 100)} pts\`\n\n` +
        `📜 **Recent Duel Summary:**\n` +
        `1. ⚔️ Victory vs Shadow Lancer (Turn 4 — Enuma Elish Finish)\n` +
        `2. ⚔️ Victory vs Shadow Assassin (Turn 3 — Buster Brave Chain)\n` +
        `3. 🏃 Tactical Retreat vs Shadow Berserker (Disengaged successfully)\n\n` +
        `*Fight more duels to climb the server glory rankings!*`;

    } else if (category === 'leaderboard') {
      title = '🛡️ Fuyuki PVP Leaderboard & Glory Rankings';
      color = '#d4af37';
      description =
        (actionOutcomeMsg ? `📢 **Action Outcome:**\n${actionOutcomeMsg}\n\n` : '') +
        `🏆 **TOP MASTERS RANKINGS (Season 1):**\n\n` +
        `🥇 **1. Master Kirei** — 2,450 pts (Jeanne d'Arc • 42W / 3L)\n` +
        `🥈 **2. Master Rin** — 2,120 pts (Archer EMIYA • 36W / 5L)\n` +
        `🥉 **3. Master ${master.username}** — \`${(((master as any).duelsWon || 0) * 50) + (((master as any).servantKills || 0) * 100) + 1200} pts\` (${sName} • ${(master as any).duelsWon || 0}W / ${(master as any).duelsLost || 0}L)\n` +
        `4. **Master Bazett** — 1,150 pts (Cu Chulainn • 18W / 4L)\n` +
        `5. **Master Illya** — 980 pts (Heracles • 15W / 2L)\n\n` +
        `🎁 **Season 1 Rewards:** Top 3 Masters receive exclusive SSR Mystic Codes and +1,000 Saint Quartz at season reset!`;
    }

    const categoryNavButtons = [
      { id: 'duel_tab_arena', label: 'Arena Lobby', style: (category === 'arena' ? 'primary' : 'secondary') as any, emoji: '⚔️' },
      { id: 'duel_tab_active', label: 'Active Duel', style: (category === 'active' ? 'primary' : 'secondary') as any, emoji: '🥊' },
      { id: 'duel_tab_history', label: 'Combat History', style: (category === 'history' ? 'primary' : 'secondary') as any, emoji: '📜' },
      { id: 'duel_tab_leaderboard', label: 'Leaderboard', style: (category === 'leaderboard' ? 'primary' : 'secondary') as any, emoji: '🛡️' }
    ];

    let actionButtons: any[] = [];
    if (category === 'arena') {
      actionButtons = [
        { id: 'duel_act_queue', label: 'Queue Matchmaking', style: 'success', emoji: '🎲' },
        { id: 'duel_act_practice', label: '1v1 Practice Clash', style: 'primary', emoji: '⚔️' },
        { id: 'duel_act_2v2', label: '2v2 Alliance Clash', style: 'primary', emoji: '🛡️' },
        { id: 'duel_act_1v2', label: '1v2 Raid Clash', style: 'secondary', emoji: '⚔️' },
        { id: 'duel_prompt_forcejoin', label: '⚡ Force Join Arena', style: 'danger', emoji: '🚨' },
        { id: 'duel_act_refresh', label: 'Refresh Lobby', style: 'secondary', emoji: '🔄' }
      ];
    } else if (category === 'active' && activeDuel) {
      const p1 = activeDuel.battle.player1;
      const isNpReady = p1.npGauge >= 100;
      const fleeInfo = calculateFleeChance(p1.currentHp, p1.maxHp, p1.servantClass, activeServant?.template?.baseStats?.agility || 10);
      actionButtons = [
        { id: 'duel_card_bbb', label: 'Buster Brave (ATK +50%)', style: 'danger', emoji: '🔴' },
        { id: 'duel_card_aaa', label: 'Arts Chain (NP +300%)', style: 'primary', emoji: '🔵' },
        { id: 'duel_card_qqq', label: 'Quick Star (+25 Stars)', style: 'success', emoji: '🟢' },
        { id: 'duel_use_np', label: `Noble Phantasm (${Math.round(p1.npGauge)}%)`, style: 'danger', emoji: '💥', disabled: !isNpReady },
        { id: 'duel_prompt_forcejoin', label: '⚡ 3rd Master Join', style: 'secondary', emoji: '🚨' },
        { id: 'duel_flee', label: `Flee (${fleeInfo.chancePercent}%)`, style: 'secondary', emoji: '🏃' }
      ];
    } else if (category === 'active' && !activeDuel) {
      actionButtons = [
        { id: 'duel_act_queue', label: 'Start Matchmaking', style: 'success', emoji: '🎲' },
        { id: 'duel_prompt_forcejoin', label: '⚡ 3-Way Force Join', style: 'danger', emoji: '🚨' },
        { id: 'duel_tab_arena', label: 'Back to Lobby', style: 'secondary', emoji: '⚔️' }
      ];
    } else {
      actionButtons = [
        { id: 'duel_act_queue', label: 'Enter Arena Queue', style: 'primary', emoji: '⚔️' },
        { id: 'duel_prompt_forcejoin', label: '⚡ Force Join (/duel forcejoin)', style: 'danger', emoji: '🚨' }
      ];
    }

    const crossHubShortcuts = [
      { id: 'duel_link_inventory', label: 'Inventory (/inventory)', style: 'secondary' as const, emoji: '👔' },
      { id: 'duel_link_gacha', label: 'Gacha (/gacha)', style: 'secondary' as const, emoji: '🔮' },
      { id: 'duel_link_servant', label: 'Servant (/servant)', style: 'secondary' as const, emoji: '👑' },
      { id: 'duel_link_grailwar', label: 'Grail War (/grailwar)', style: 'secondary' as const, emoji: '🏰' }
    ];

    addMessage({
      id: getNextId('bot_duel_hub'),
      sender: 'bot',
      timestamp: 'Just now',
      embed: {
        title,
        description,
        color,
        footer: `Combat Arena Hub • Master: ${master.username} • Champion: ${sName}`
      },
      components: {
        type: 'buttons',
        items: [...categoryNavButtons, ...actionButtons, ...crossHubShortcuts]
      }
    });
  };

  // Button interaction handler
  const handleButtonClick = (btnId: string) => {
    if (btnId.startsWith('accept_civilian_duel_')) {
      const civilianName = btnId.replace('accept_civilian_duel_', '');
      const activeS = master.servants?.find(s => s.id === master.activeServantId) || master.servants?.[0];
      const sName = activeS?.template?.name || 'Heroic Spirit';

      // Check if already dead
      const isAlreadyDead = (grailWar.civilianCasualties || []).some(
        c => c.name.toLowerCase().includes(civilianName.toLowerCase()) || c.id === `civilian_${civilianName}`
      ) || Object.values(grailWar.participants).some(
        p => p.username.toLowerCase() === civilianName.toLowerCase() && !p.isAlive
      );

      if (isAlreadyDead) {
        addMessage({
          id: getNextId('bot_civilian_already_dead'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '☠️ CIVILIAN ALREADY SLAIN',
            description: `Civilian **${civilianName}** was already slain earlier in this Holy Grail War! A civilian cannot be killed twice.`,
            color: '#ef4444'
          }
        });
        return;
      }

      // Update grailWar session state
      const updatedWar = { ...grailWar };
      const civParticipant = Object.values(updatedWar.participants).find(
        p => p.username.toLowerCase() === civilianName.toLowerCase()
      ) || {
        discordId: `civilian_${civilianName}`,
        username: civilianName,
        servantId: 'none',
        servantName: 'Civilian',
        servantClass: 'Civilian' as any,
        avatarUrl: '',
        maxHp: 100,
        currentHp: 0,
        commandSeals: 0,
        kills: 0,
        isAlive: false
      };
      civParticipant.isAlive = false;
      civParticipant.currentHp = 0;
      updatedWar.participants[civParticipant.discordId] = civParticipant;

      if (!updatedWar.civilianCasualties) updatedWar.civilianCasualties = [];
      const timestampNow = getTimestampNow();
      updatedWar.civilianCasualties.unshift({
        id: `civilian_${timestampNow}`,
        name: `@${civilianName}`,
        slainByMasterId: master.discordId || master.username,
        timestamp: timestampNow,
        cause: 'duel_civilian_execution'
      });

      const currentInnocentKills = (master.innocentKills || 0) + 1;
      const rep = getReputationInfo(currentInnocentKills);

      // Reward victor Master
      const updatedMaster: MasterProfile = {
        ...master,
        saintQuartz: (master.saintQuartz || 0) + 3,
        duelsWon: (master.duelsWon || 0) + 1,
        servantKills: (master.servantKills || 0) + 1,
        innocentKills: currentInnocentKills,
        reputationRank: rep.rank,
        bountyActive: rep.bountyActive,
        bountyRewardSq: rep.bountyRewardSq,
        isRogueHeretic: rep.isRogue
      };
      onUpdateMaster(updatedMaster);

      const masterPart = updatedWar.participants[master.discordId] ||
        Object.values(updatedWar.participants).find(p => p.username.toLowerCase() === master.username.toLowerCase());
      if (masterPart) {
        masterPart.innocentKills = currentInnocentKills;
        masterPart.reputationRank = rep.rank;
        masterPart.bountyActive = rep.bountyActive;
        masterPart.isRogueHeretic = rep.isRogue;
        if (rep.isRogue) {
          masterPart.isExposed = true;
          masterPart.exposureReason = 'heretic_bounty';
          masterPart.inSanctuary = false;
          (masterPart as any).inChurchSanctuary = false;
        }
      }

      onUpdateGrailWar(updatedWar);

      let repNotice = '';
      if (currentInnocentKills === 10) {
        repNotice = `\n\n📜 **CHURCH ORDER OF EXTERMINATION & BOUNTY ISSUED!**\n` +
          `> *"By decree of Father Kotomine: Master **${master.username}** has reached 10 civilian kills! They are excommunicated as a **Rogue Heretic**."*\n\n` +
          `• 🎯 **Open Server Bounty:** **+1 Extra Command Seal** & **+15 Saint Quartz** to any Master who eliminates them!\n` +
          `• 🚫 **Church Sanctuary:** Permanently revoked.\n` +
          `• ⛓️ **Curse of Heresy:** -10% ATK suppression in all combat encounters.\n` +
          `• 🗺️ **Permanent Exposure:** Concealment broken permanently on intelligence maps.`;
      } else if (currentInnocentKills > 10) {
        repNotice = `\n\n☠️ **WANTED ROGUE HERETIC:** Extermination Bounty active on your head (+1 Command Seal & +15 Saint Quartz). Barred from Church sanctuary.`;
      } else if (currentInnocentKills >= 7) {
        repNotice = `\n\n🩸 **NOTORIOUS MAGUS (${currentInnocentKills}/10 Kills):** The Holy Church has placed you under high surveillance. Reaching 10 kills activates a Rogue Heretic Bounty!`;
      } else if (currentInnocentKills >= 4) {
        repNotice = `\n\n⚠️ **SUSPECT MAGUS (${currentInnocentKills}/10 Kills):** The Holy Church notes your violation of the Secrecy of Magecraft.`;
      }

      addMessage({
        id: getNextId('bot_civilian_slain'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: '☠️ CIVILIAN SLAIN WITHOUT A FIGHT',
          description:
            `Civilian **${civilianName}** accepted the duel invitation without a contracted Servant!\n\n` +
            `⚔️ **${sName}** easily struck down the defenceless civilian on the spot without a fight.\n\n` +
            `• **Target Status:** 💀 Slain & Permanently Eliminated (Civilian casualty recorded)\n` +
            `• **Victor:** Master **${master.username}**\n` +
            `• **Civilian Kills:** ${currentInnocentKills} (${rep.rank})\n` +
            `• **Rewards Granted:** +300 Bond EXP, +3 Saint Quartz, +1 Kill` +
            repNotice,
          color: '#ef4444',
          footer: 'Holy Grail War • Civilian Execution Ledger'
        }
      });
      return;
    }

    if (btnId.startsWith('decline_civilian_duel_')) {
      const civilianName = btnId.replace('decline_civilian_duel_', '');
      addMessage({
        id: getNextId('bot_civilian_declined'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: '🏳️ Duel Declined',
          description: `Civilian **${civilianName}** declined the duel challenge.`,
          color: '#64748b'
        }
      });
      return;
    }

    if (btnId === 'btn_show_servants_list' || btnId === 'btn_back_servants_list') {
      handleCommand('/servants list');
    } else if (btnId.startsWith('inv_') || btnId.startsWith('stat_')) {
      const activeServant = master.servants?.find(s => s.id === master.activeServantId) || master.servants?.[0];
      const ownedCes = (master.craftEssences || []).filter(Boolean);

      // 1. Navigation tabs
      if (btnId === 'inv_cat_ces') {
        setInvCategory('ces');
        setInvPage(1);
        postInventoryHub('ces', 1, invSelectedCeId || undefined);
      } else if (btnId === 'inv_cat_servants') {
        setInvCategory('servants');
        setInvPage(1);
        postInventoryHub('servants', 1, invSelectedServantId || undefined);
      } else if (btnId === 'inv_cat_feed') {
        setInvCategory('feed');
        setInvPage(1);
        postInventoryHub('feed', 1);
      } else if (btnId === 'inv_cat_seals') {
        setInvCategory('seals');
        setInvPage(1);
        postInventoryHub('seals', 1);
      } else if (btnId === 'inv_cat_items') {
        setInvCategory('items');
        setInvPage(1);
        postInventoryHub('items', 1);
      }
      // 2. Pagination
      else if (btnId === 'inv_page_prev') {
        const newPage = Math.max(1, invPage - 1);
        setInvPage(newPage);
        postInventoryHub(invCategory, newPage, invCategory === 'ces' ? (invSelectedCeId || undefined) : (invSelectedServantId || undefined));
      } else if (btnId === 'inv_page_next') {
        const newPage = invPage + 1;
        setInvPage(newPage);
        postInventoryHub(invCategory, newPage, invCategory === 'ces' ? (invSelectedCeId || undefined) : (invSelectedServantId || undefined));
      }
      // 3. Select Dropdown Actions
      else if (btnId.startsWith('inv_sel_ce_')) {
        const ceId = btnId.replace('inv_sel_ce_', '');
        setInvSelectedCeId(ceId);
        postInventoryHub('ces', invPage, ceId);
      } else if (btnId.startsWith('inv_sel_srv_')) {
        const srvId = btnId.replace('inv_sel_srv_', '');
        setInvSelectedServantId(srvId);
        postInventoryHub('servants', invPage, srvId);
      }
      // 4. Equip Actions
      else if (btnId === 'inv_act_equip_selected' || btnId === 'inv_act_equip') {
        if (!activeServant) {
          addMessage({ id: getNextId('bot_err'), sender: 'bot', timestamp: 'Just now', embed: { title: '⚠️ No Servant', description: 'Contract a Servant first.', color: '#ef4444' } });
          return;
        }
        const targetCe = ownedCes.find(c => c.id === (invSelectedCeId || ownedCes[0]?.id)) || ownedCes[0];
        if (!targetCe) {
          addMessage({ id: getNextId('bot_err'), sender: 'bot', timestamp: 'Just now', embed: { title: '⚠️ No Craft Essence', description: 'No Craft Essence selected or owned to equip.', color: '#ef4444' } });
          return;
        }

        const updatedServant = equipCraftEssence(activeServant, targetCe.id);
        const updatedServants = master.servants.map(s => s.id === activeServant.id ? updatedServant : s);
        const updatedMaster: MasterProfile = { ...master, servants: updatedServants };
        onUpdateMaster(updatedMaster);

        addMessage({
          id: getNextId('bot_equip_success'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: `✅ Craft Essence Equipped: ${targetCe.name}!`,
            description:
              `Equipped **${targetCe.name}** [★${targetCe.rarity}] onto **${activeServant.nickname || activeServant.template?.name || 'Servant'}**!\n\n` +
              `⚔️ **ATK Bonus:** \`+${targetCe.atkBonus || 0} ATK\` | ❤️ **HP Bonus:** \`+${targetCe.hpBonus || 0} HP\`\n` +
              `🔮 **Passive Effect:** *${targetCe.effectText || targetCe.description || 'Mystic Code'}*`,
            color: '#22c55e'
          }
        });
        postInventoryHub('ces', invPage, targetCe.id);
      } else if (btnId === 'inv_act_unequip') {
        if (activeServant) {
          const updatedServant = equipCraftEssence(activeServant, undefined);
          const updatedServants = master.servants.map(s => s.id === activeServant.id ? updatedServant : s);
          onUpdateMaster({ ...master, servants: updatedServants });

          addMessage({
            id: getNextId('bot_unequip_success'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '❌ Craft Essence Unequipped',
              description: `Unequipped Craft Essence from **${activeServant.nickname || activeServant.template?.name || 'Servant'}**.`,
              color: '#f59e0b'
            }
          });
          postInventoryHub('ces', invPage);
        }
      }
      // 5. Feed Actions
      else if (btnId === 'inv_act_feed_selected') {
        const targetCe = ownedCes.find(c => c.id === (invSelectedCeId || ownedCes[0]?.id)) || ownedCes[0];
        if (targetCe) {
          executeDirectFeed(targetCe.name);
        } else {
          executeDirectFeed('all');
        }
      } else if (btnId.startsWith('inv_act_feed_single_')) {
        const ceId = btnId.replace('inv_act_feed_single_', '');
        const targetCe = ownedCes.find(c => c.id === ceId);
        if (targetCe) {
          executeDirectFeed(targetCe.name);
        }
      } else if (btnId === 'inv_act_feed_1_3star') {
        executeDirectFeed('3star');
      } else if (btnId === 'inv_act_feed_duplicates') {
        executeDirectFeed('dupes');
      } else if (btnId === 'inv_act_feed_all') {
        executeDirectFeed('all');
      } else if (btnId === 'inv_act_go_to_feed') {
        setInvCategory('feed');
        setInvPage(1);
        postInventoryHub('feed', 1);
      }
      // 6. Stat Point Allocation
      else if (btnId === 'inv_act_allocate_stats' || btnId === 'inv_quick_stats') {
        postStatAllocationHub(invSelectedServantId || master.activeServantId);
      } else if (btnId.startsWith('stat_add_')) {
        const statType = btnId.replace('stat_add_', '');
        if (!activeServant) return;

        const curAvail = activeServant.availableStatPoints || 0;
        if (curAvail <= 0) {
          addMessage({
            id: getNextId('bot_stat_no_points'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '⚠️ No Available Stat Points',
              description: 'You have 0 stat points available. Feed Craft Essences to level up and earn +10 stat points per level!',
              color: '#ef4444'
            },
            components: {
              type: 'buttons',
              items: [
                { id: 'inv_cat_feed', label: 'Feed CEs for EXP', style: 'primary', emoji: '✨' },
                { id: 'inv_cat_ces', label: 'Back to Inventory', style: 'secondary', emoji: '🛡️' }
              ]
            }
          });
          return;
        }

        let updatedServant = { ...activeServant };
        if (statType === 'auto_distribute') {
          const pointsToDist = Math.min(5, curAvail);
          const stats: (keyof typeof activeServant.allocatedStats)[] = ['strength', 'endurance', 'agility', 'mana', 'luck'];
          for (let i = 0; i < pointsToDist; i++) {
            const chosenStat = stats[i % stats.length];
            updatedServant = allocateStatPoints(updatedServant, chosenStat, 1);
          }
        } else if (['strength', 'endurance', 'agility', 'mana', 'luck'].includes(statType)) {
          updatedServant = allocateStatPoints(updatedServant, statType as any, 1);
        }

        const updatedServants = master.servants.map(s => s.id === activeServant.id ? updatedServant : s);
        onUpdateMaster({ ...master, servants: updatedServants });
        postStatAllocationHub(activeServant.id);
      }
      // 7. Servant Contract Switch
      else if (btnId === 'inv_act_set_active_servant') {
        const targetId = invSelectedServantId || master.servants?.[0]?.id;
        if (targetId) {
          const targetServant = master.servants?.find(s => s.id === targetId);
          onUpdateMaster({ ...master, activeServantId: targetId });
          addMessage({
            id: getNextId('bot_contract_switched'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: `👑 Active Contract Switched: ${targetServant?.nickname || targetServant?.template?.name || 'Servant'}`,
              description: `You are now commanding **${targetServant?.nickname || targetServant?.template?.name || 'Servant'}** in Holy Grail War duels and raids!`,
              color: '#22c55e'
            }
          });
          postInventoryHub('servants', invPage, targetId);
        }
      }
      // 8. Inspect Lore & Dossiers
      else if (btnId === 'inv_act_inspect') {
        const targetCe = ownedCes.find(c => c.id === (invSelectedCeId || activeServant?.equippedCeId || ownedCes[0]?.id)) || activeServant?.equippedCe;
        if (targetCe) {
          addMessage({
            id: getNextId('bot_ce_lore'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: `📖 Relic Lore: ${targetCe.name}`,
              description:
                `**Rarity:** ★${targetCe.rarity} ${targetCe.rarity >= 5 ? 'SSR' : targetCe.rarity >= 4 ? 'SR' : 'R'}\n` +
                `**Passive Effect:** ${targetCe.effectText || targetCe.description}\n` +
                `**Stat Boosts:** \`+${targetCe.atkBonus || 0} ATK\` / \`+${targetCe.hpBonus || 0} HP\`\n\n` +
                `*${targetCe.description || 'An ancient conceptual relic forged from heroic memories and mystic codes.'}*`,
              color: '#38bdf8'
            },
            artworkEmbed: (targetCe.artworkUrl || (targetCe as any).imageUrl) ? { imageUrl: targetCe.artworkUrl || (targetCe as any).imageUrl, color: '#38bdf8' } : undefined
          });
        } else {
          addMessage({
            id: getNextId('bot_ce_lore_none'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '📖 Craft Essence Lore Archive',
              description: 'No Craft Essence is currently selected. Select an essence from your inventory and press **Inspect Lore**.',
              color: '#38bdf8'
            }
          });
        }
      } else if (btnId === 'inv_act_inspect_servant') {
        const targetServant = master.servants?.find(s => s.id === (invSelectedServantId || master.activeServantId)) || activeServant;
        if (targetServant) {
          addMessage({
            id: getNextId('bot_servant_inspect'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: `⚔️ Servant Dossier: ${targetServant.nickname || targetServant.template?.name || (targetServant as any).name}`,
              description:
                `**Class:** ${targetServant.template?.servantClass || (targetServant as any).servantClass} | **Parity:** Balanced\n` +
                `**Level:** Lv.${targetServant.level || 1}/100 | **Bond:** Lv.${targetServant.bondLevel || 1}/10 ♥\n` +
                `**Available Stat Points:** \`${targetServant.availableStatPoints || 0} pts\`\n` +
                `**Noble Phantasm:** **${targetServant.template?.noblePhantasm?.name || 'Classified'}**\n\n` +
                `*Type \`/servant\` to view their full parameter radar card.*`,
              color: '#d4af37'
            }
          });
        }
      }
      // 9. Claim Practice CEs
      else if (btnId === 'inv_act_claim_practice_ces') {
        const starterCes = [
          CRAFT_ESSENCE_DATABASE.find(c => c.id === 'ce_zelretch') || CRAFT_ESSENCE_DATABASE[0],
          CRAFT_ESSENCE_DATABASE.find(c => c.id === 'ce_formal_craft') || CRAFT_ESSENCE_DATABASE[1],
          CRAFT_ESSENCE_DATABASE.find(c => c.id === 'ce_kaleidoscope') || CRAFT_ESSENCE_DATABASE[2],
          CRAFT_ESSENCE_DATABASE[3] || CRAFT_ESSENCE_DATABASE[0],
          CRAFT_ESSENCE_DATABASE[4] || CRAFT_ESSENCE_DATABASE[1]
        ].filter(Boolean);

        const newCes = [...(master.craftEssences || []), ...starterCes];
        onUpdateMaster({ ...master, craftEssences: newCes });

        addMessage({
          id: getNextId('bot_claim_ces_success'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '🎁 Practice Craft Essences Gift Received!',
            description:
              `Received **5 Practice Craft Essences** into your inventory!\n\n` +
              starterCes.map(c => `• **[★${c.rarity}]** **${c.name}** (+${c.atkBonus || 0} ATK / +${c.hpBonus || 0} HP)`).join('\n') +
              `\n\n*You can now equip these onto your Servant or synthesize them in the Feed tab for massive EXP!*`,
            color: '#22c55e'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'inv_cat_ces', label: 'View Inventory', style: 'primary', emoji: '🛡️' },
              { id: 'inv_cat_feed', label: 'Feed for EXP', style: 'success', emoji: '✨' }
            ]
          }
        });
      }
      // 10. Gacha & Currency Roll Actions
      else if (btnId === 'inv_quick_gacha') {
        handleCommand('/cegacha');
      } else if (btnId === 'inv_act_roll_1x_ce') {
        if ((master.saintQuartz || 0) < 3) {
          addMessage({
            id: getNextId('bot_gacha_no_sq'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '⚠️ Insufficient Saint Quartz',
              description: `1x Pull requires **3 SQ**. You currently have **${master.saintQuartz || 0} SQ**. Use \`/daily\` to claim 30 free SQ!`,
              color: '#ef4444'
            },
            components: {
              type: 'buttons',
              items: [{ id: 'quick_daily_claim', label: 'Claim Daily (30 SQ)', style: 'success', emoji: '💎' }]
            }
          });
          return;
        }

        const pullResult = executeCraftEssenceGachaRoll({ count: 1, master });
        onUpdateMaster(pullResult.updatedMaster);

        const rolledCe = pullResult.results[0].item as CraftEssence;
        const isNew = pullResult.results[0].isNew;
        const isRateUp = pullResult.results[0].isRateUp;
        const atk = rolledCe.bonusAtk || rolledCe.atkBonus || 0;
        const hp = rolledCe.bonusHp || rolledCe.hpBonus || 0;

        addMessage({
          id: getNextId('bot_gacha_1x_success'),
          sender: 'bot',
          timestamp: 'Just now',
          canvasType: 'gacha',
          canvasPayload: {
            results: pullResult.results,
            bannerTitle: '1x Craft Essence Single Summon'
          },
          embed: {
            title: `🎲 1x Craft Essence Summon: ${rolledCe.name}!`,
            description:
              `Summoned **[★${rolledCe.rarity}] ${rolledCe.name}**!${isNew ? ' 🌟 **[NEW!]**' : ''}${isRateUp ? ' ✨ **[RATE-UP!]**' : ''}\n\n` +
              `🔮 **Effect:** *${rolledCe.effectText || rolledCe.description}*\n` +
              `⚔️ **Stats:** +${atk} ATK / +${hp} HP\n` +
              `💎 **Remaining Saint Quartz:** \`${pullResult.updatedMaster.saintQuartz} SQ\``,
            color: rolledCe.rarity >= 5 ? '#f59e0b' : rolledCe.rarity >= 4 ? '#a855f7' : '#38bdf8'
          },
          artworkEmbed: rolledCe.artworkUrl ? { imageUrl: rolledCe.artworkUrl, color: '#38bdf8' } : undefined,
          components: {
            type: 'buttons',
            items: [
              { id: 'inv_act_roll_1x_ce', label: 'Roll 1x Again (3 SQ)', style: 'primary', emoji: '🎲' },
              { id: 'inv_act_roll_10x_ce', label: 'Roll 10x (30 SQ)', style: 'success', emoji: '💎' },
              { id: 'inv_cat_ces', label: 'Open Inventory', style: 'secondary', emoji: '🛡️' }
            ]
          }
        });
      } else if (btnId === 'inv_act_roll_10x_ce') {
        if ((master.saintQuartz || 0) < 30) {
          addMessage({
            id: getNextId('bot_gacha_no_sq_10'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '⚠️ Insufficient Saint Quartz',
              description: `10x Pull requires **30 SQ**. You currently have **${master.saintQuartz || 0} SQ**. Use \`/daily\` to claim 30 free SQ!`,
              color: '#ef4444'
            },
            components: {
              type: 'buttons',
              items: [{ id: 'quick_daily_claim', label: 'Claim Daily (30 SQ)', style: 'success', emoji: '💎' }]
            }
          });
          return;
        }

        const pullResult = executeCraftEssenceGachaRoll({ count: 10, master });
        onUpdateMaster(pullResult.updatedMaster);

        const lines = pullResult.results.map((r, idx) => {
          const c = r.item as CraftEssence;
          const newTag = r.isNew ? ' 🌟 **[NEW!]**' : '';
          const rateUpTag = r.isRateUp ? ' ✨ **[RATE-UP!]**' : '';
          const atk = c.bonusAtk || c.atkBonus || 0;
          const hp = c.bonusHp || c.hpBonus || 0;
          return `${idx + 1}. **[★${c.rarity}]** **${c.name}**${newTag}${rateUpTag} — *+${atk} ATK / +${hp} HP*`;
        }).join('\n');

        const embedColor = pullResult.ssrsPulled > 0 ? '#f59e0b' : pullResult.srsPulled > 0 ? '#a855f7' : '#d4af37';

        addMessage({
          id: getNextId('bot_gacha_10x_success'),
          sender: 'bot',
          timestamp: 'Just now',
          canvasType: 'gacha',
          canvasPayload: {
            results: pullResult.results,
            bannerTitle: '10x Craft Essence Multi-Summon'
          },
          embed: {
            title: `💎 10x Craft Essence Multi-Summon Results!`,
            description:
              `**Chaldea Summoning Gate Opened:**\n\n` +
              lines +
              `\n\n💎 **Remaining Saint Quartz:** \`${pullResult.updatedMaster.saintQuartz} SQ\`\n` +
              `🛡️ **Guarantee Applied:** Guaranteed 4★ SR or higher included!`,
            color: embedColor
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'inv_act_roll_10x_ce', label: 'Roll 10x Again (30 SQ)', style: 'success', emoji: '💎' },
              { id: 'inv_act_feed_duplicates', label: 'Feed Duplicates for EXP', style: 'primary', emoji: '⚡' },
              { id: 'inv_cat_ces', label: 'View Inventory', style: 'secondary', emoji: '🛡️' }
            ]
          }
        });
      }
      // 11. Command Seal Actions
      else if (btnId === 'inv_act_use_seal_heal') {
        if (!activeServant) return;
        const seals = (master as any).commandSeals ?? 3;
        if (seals <= 0) {
          addMessage({
            id: getNextId('bot_no_seals'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '🩸 No Command Seals Remaining',
              description: 'You have exhausted all 3 Command Seals. Seals regenerate 1 per 24 hours.',
              color: '#ef4444'
            }
          });
          return;
        }

        const maxHp = calculateServantMaxHp(activeServant);
        const updatedServant = {
          ...activeServant,
          currentHp: maxHp,
          baseHpAtDamage: maxHp,
          lastDamageTime: getTimestampNow()
        };
        const updatedServants = master.servants.map(s => s.id === activeServant.id ? updatedServant : s);
        onUpdateMaster({ ...master, commandSeals: seals - 1, servants: updatedServants } as any);

        addMessage({
          id: getNextId('bot_seal_heal_success'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: `🩸 COMMAND SEAL INVOKED: FULL HP RESTORATION!`,
            description:
              `*"By the absolute command of this seal, restore thy spiritron core!"*\n\n` +
              `❤️ **${activeServant.nickname || activeServant.template?.name || 'Servant'}** restored to **${maxHp.toLocaleString()} / ${maxHp.toLocaleString()} HP (100%)**!\n` +
              `🩸 **Remaining Command Seals:** \`${seals - 1} / 3\``,
            color: '#22c55e'
          }
        });
      } else if (btnId === 'inv_act_deploy_sanctuary') {
        onUpdateMaster({ ...master, boundedField: 'ward' });
        if (grailWar.participants[master.discordId]) {
          onUpdateGrailWar({
            ...grailWar,
            participants: {
              ...grailWar.participants,
              [master.discordId]: {
                ...grailWar.participants[master.discordId],
                boundedField: 'ward'
              }
            }
          });
        }
        addMessage({
          id: getNextId('bot_sanctuary_deployed'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '🛡️ Mage Sanctuary Bounded Field Deployed',
            description: 'Territory ward established around your workshop. Ambush damage taken reduced by **60%**.',
            color: '#38bdf8'
          }
        });
      } else if (btnId === 'inv_act_deploy_decoy') {
        const curCount = (master.homunculusCount || 0) + 1;
        onUpdateMaster({ ...master, boundedField: 'decoy', homunculusCount: curCount } as any);
        if (grailWar.participants[master.discordId]) {
          onUpdateGrailWar({
            ...grailWar,
            participants: {
              ...grailWar.participants,
              [master.discordId]: {
                ...grailWar.participants[master.discordId],
                boundedField: 'decoy'
              }
            }
          });
        }
        addMessage({
          id: getNextId('bot_decoy_deployed'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '🗿 Homunculus Decoy Ward Deployed',
            description: 'An artificial homunculus decoy has been created at your workshop. Absorbs **100% of incoming ambush damage** on the next strike!',
            color: '#22c55e'
          }
        });
      } else if (btnId === 'inv_act_patrol') {
        handleCommand('/patrol');
      } else if (btnId === 'inv_act_open_workshop') {
        handleCommand('/customise');
      }
      return;
    } else if (btnId.startsWith('gacha_')) {
      // 1. Navigation tabs
      if (btnId === 'gacha_tab_ces') {
        setGachaCategory('ces');
        setGachaBanner('standard_ce');
        postGachaHub('ces', 'standard_ce');
      } else if (btnId === 'gacha_tab_daily') {
        setGachaCategory('daily');
        setGachaBanner('daily_vault');
        postGachaHub('daily', 'daily_vault');
      } else if (btnId === 'gacha_tab_rates') {
        setGachaCategory('rates');
        postGachaHub('rates', gachaBanner);
      }
      // 2. Banner select dropdown actions
      else if (btnId === 'gacha_sel_standard_ce') {
        setGachaCategory('ces');
        setGachaBanner('standard_ce');
        postGachaHub('ces', 'standard_ce');
      } else if (btnId === 'gacha_sel_daily_vault') {
        setGachaCategory('daily');
        setGachaBanner('daily_vault');
        postGachaHub('daily', 'daily_vault');
      }
      // 3. Actions
      else if (btnId === 'gacha_act_claim_daily') {
        handleCommand('/daily');
      } else if (btnId === 'gacha_act_single') {
        if ((master.saintQuartz || 0) < 3) {
          addMessage({
            id: getNextId('bot_sq_err'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '⚠️ Insufficient Saint Quartz',
              description: 'You need at least 3 Saint Quartz for a single Craft Essence summon. Claim your daily allowance or win duels to earn more!',
              color: '#ef4444'
            }
          });
          return;
        }
        handleButtonClick('inv_act_roll_1x_ce');
      } else if (btnId === 'gacha_act_multi') {
        if ((master.saintQuartz || 0) < 30) {
          addMessage({
            id: getNextId('bot_sq_err'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '⚠️ Insufficient Saint Quartz',
              description: 'You need at least 30 Saint Quartz for a 10x multi-summon!',
              color: '#ef4444'
            }
          });
          return;
        }
        handleButtonClick('inv_act_roll_10x_ce');
      }
      // 4. Cross-hub navigation shortcuts
      else if (btnId === 'gacha_link_inventory') {
        handleCommand('/inventory');
      } else if (btnId === 'gacha_link_servant') {
        handleCommand('/servant');
      } else if (btnId === 'gacha_link_grailwar') {
        handleCommand('/grailwar');
      } else if (btnId === 'gacha_link_duel') {
        handleCommand('/duel');
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
        onUpdateMaster({ ...master, boundedField: 'none' });
      } else if (btnId === 'profile_ward_ward') {
        const res = executeWarAction(currentWar, master.discordId, 'set_ward', 'ward');
        currentWar = res.updatedWar;
        actionMsg = res.message;
        onUpdateGrailWar(currentWar);
        onUpdateMaster({ ...master, boundedField: 'ward' });
      } else if (btnId === 'profile_ward_alarm') {
        const res = executeWarAction(currentWar, master.discordId, 'set_ward', 'alarm');
        currentWar = res.updatedWar;
        actionMsg = res.message;
        onUpdateGrailWar(currentWar);
        onUpdateMaster({ ...master, boundedField: 'alarm' });
      } else if (btnId === 'profile_toggle_evade') {
        const curMode = currentWar.participants[master.discordId]?.autoEvadeEnabled !== false ? 'off' : 'on';
        const res = executeWarAction(currentWar, master.discordId, 'toggle_evade', curMode);
        currentWar = res.updatedWar;
        actionMsg = res.message;
        onUpdateGrailWar(currentWar);
        onUpdateMaster({ ...master, autoConsumeCommandSeal: curMode === 'on' });
      } else if (btnId === 'profile_heal') {
        const res = executeWarAction(currentWar, master.discordId, 'rest_and_heal');
        currentWar = res.updatedWar;
        actionMsg = res.message;
        onUpdateGrailWar(currentWar);
        if (res.success && activeServant) {
          const updatedHp = currentWar.participants[master.discordId]?.currentHp;
          if (updatedHp !== undefined) {
            const updatedServants = master.servants.map(s => s.id === activeServant.id ? {
              ...s,
              currentHp: updatedHp,
              baseHpAtDamage: updatedHp,
              lastDamageTime: Date.now()
            } : s);
            onUpdateMaster({ ...master, servants: updatedServants });
          }
        }
      } else if (btnId === 'profile_share_public') {
        const userParticipant = currentWar.participants[master.discordId] || Object.values(currentWar.participants)[0];
        const curServant = master.servants?.find(s => s.id === master.activeServantId) || master.servants?.[0];
        if (!curServant) return;

        const seals = userParticipant?.commandSeals ?? master.commandSeals ?? 3;
        const isExposed = userParticipant?.isExposed;
        const isUnderSanctuary = userParticipant?.inSanctuary || userParticipant?.inChurchSanctuary;

        const sTemplate = curServant.template;
        const servantName = isExposed ? (curServant.nickname || sTemplate.name || 'Heroic Spirit') : '[Classified in Shadows]';
        const servantClass = sTemplate.servantClass;

        const userCurHp = userParticipant ? calculateCurrentHp(userParticipant) : calculateServantMaxHp(curServant);
        const userMaxHp = userParticipant?.maxHp || calculateServantMaxHp(curServant);
        const hpPercent = Math.max(0, Math.min(100, Math.round((userCurHp / Math.max(1, userMaxHp)) * 100)));
        const totalBlocks = 14;
        const filledBlocks = Math.max(0, Math.min(totalBlocks, Math.round((hpPercent / 100) * totalBlocks)));
        const hpBar = '█'.repeat(filledBlocks) + '░'.repeat(totalBlocks - filledBlocks);

        const kills = userParticipant?.kills ?? master.servantKills ?? 0;
        const duelsWon = master.duelsWon || 0;
        const duelsLost = master.duelsLost || 0;
        const totalDuels = duelsWon + duelsLost;
        const winRate = totalDuels > 0 ? Math.round((duelsWon / totalDuels) * 100) : 0;

        let standingTag = '🟢 Active Competitor';
        if (userParticipant?.isAlive === false) {
          standingTag = '💀 Dissolved Saint Graph';
        } else if (isUnderSanctuary) {
          standingTag = '🕊️ Under Church Asylum';
        }

        addMessage({
          id: getNextId('bot_public_profile'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: `📢 MASTER DOSSIER | ${master.username.toUpperCase()}`,
            description:
              `Master **${master.username}** has broadcast their Master credentials to the server!\n\n` +
              `💠 **Command Seals:** \`${'✦ '.repeat(seals)}${'✧ '.repeat(Math.max(0, 3 - seals))}\` (${seals}/3) | 🎴 **${master.servants?.length || 1}** Contracted Spirit(s)\n\n` +
              `⚔️ **COMBAT RECORD & STANDING:**\n` +
              `• **War Standing:** ${standingTag} [${isExposed ? '⚠️ **EXPOSED**' : '🕶️ **Stealth**'}]\n` +
              `• **Servant Kills:** 💀 **${kills}** Dissolved\n` +
              `• **Duel Record:** ⚔️ **${duelsWon}W - ${duelsLost}L** (${winRate}% Win Rate)\n` +
              `• **Church Standing:** ${master.reputationRank || '🕊️ Honorable Neutral'}\n\n` +
              `🗡️ **CONTRACTED HEROIC SPIRIT:**\n` +
              `• **Heroic Spirit:** **${servantName}** (\`${servantClass}\`)\n` +
              `• **Vitality:** ❤️ [${hpBar}] \`${userCurHp.toLocaleString()} / ${userMaxHp.toLocaleString()}\` (${hpPercent}%)`,
            color: '#3b82f6',
            thumbnailUrl: isExposed ? curServant.template?.avatarUrl : undefined,
            footer: 'Public Master Dossier • Holy Grail War'
          }
        });
        return;
      } else if (btnId === 'profile_refresh') {
        actionMsg = '🔄 Profile refreshed.';
      }

      postProfileEmbed(actionMsg);
      return;
    } else if (
      btnId.startsWith('servant_tab_') ||
      btnId.startsWith('servant_sel_switch_') ||
      btnId.startsWith('servant_sel_title_preset_') ||
      btnId.startsWith('servant_sel_voice_preset_') ||
      btnId.startsWith('servant_sel_equip_ce_') ||
      btnId.startsWith('servant_sel_feed_ce_') ||
      btnId.startsWith('servant_act_set_active') ||
      btnId.startsWith('servant_add_') ||
      btnId.startsWith('servant_link_') ||
      btnId.startsWith('dlg_')
    ) {
      const ownedServants = master.servants || [];
      const targetServant = ownedServants.find(s => s.id === (servantHubSelectedId || master.activeServantId)) || ownedServants[0];

      // 1. Navigation Tabs
      if (btnId === 'servant_tab_profile') {
        setServantHubCategory('profile');
        postServantHub('profile', servantHubSelectedId || undefined);
      } else if (btnId === 'servant_tab_stats') {
        setServantHubCategory('stats');
        postServantHub('stats', servantHubSelectedId || undefined);
      } else if (btnId === 'servant_tab_equip_ce') {
        setServantHubCategory('equip_ce' as any);
        postServantHub('equip_ce' as any, servantHubSelectedId || undefined);
      } else if (btnId === 'servant_tab_feed_ce') {
        setServantHubCategory('feed_ce' as any);
        postServantHub('feed_ce' as any, servantHubSelectedId || undefined);
      } else if (btnId === 'servant_tab_np') {
        setServantHubCategory('np');
        postServantHub('np', servantHubSelectedId || undefined);
      } else if (btnId === 'servant_tab_dialogue') {
        setServantHubCategory('dialogue');
        postServantHub('dialogue', servantHubSelectedId || undefined);
      } else if (btnId === 'servant_tab_roster') {
        setServantHubCategory('roster');
        postServantHub('roster', servantHubSelectedId || undefined);
      } else if (btnId === 'servant_act_unequip_ce') {
        if (targetServant) {
          const updated = { ...targetServant, equippedCe: undefined, equippedCeId: undefined };
          const updatedServants = ownedServants.map(s => s.id === updated.id ? updated : s);
          onUpdateMaster({ ...master, servants: updatedServants });
          postServantHub('equip_ce' as any, updated.id);
        }
      }
      // 2. Title Preset Selection
      else if (btnId.startsWith('servant_sel_title_preset_')) {
        const val = btnId.replace('servant_sel_title_preset_', '');
        let newTitle = '';
        if (val === 'king_of_knights') newTitle = 'King of Knights';
        else if (val === 'promised_victory') newTitle = 'Sword of Promised Victory';
        else if (val === 'sanctuary_warden') newTitle = 'Bounded Field Guardian';
        else if (val === 'grand_hero') newTitle = 'Grand Spirit of Legend';
        else if (val === 'reset') newTitle = '';

        if (targetServant) {
          const updated = { ...targetServant, nickname: newTitle || undefined };
          const updatedServants = ownedServants.map(s => s.id === updated.id ? updated : s);
          onUpdateMaster({ ...master, servants: updatedServants });
          addMessage({
            id: getNextId('bot_title_updated'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: newTitle ? `👑 Title Applied: "${newTitle}"` : `✨ Title Reset to True Name`,
              description: newTitle 
                ? `Successfully updated **${targetServant.template?.name || 'Servant'}**'s title to **"${newTitle}"**!`
                : `Reset nickname back to canon True Name **${targetServant.template?.name || 'Servant'}**.`,
              color: '#22c55e'
            }
          });
          postServantHub('profile', targetServant.id);
        }
      }
      // 3. Voice Preset Selection
      else if (btnId.startsWith('servant_sel_voice_preset_')) {
        const val = btnId.replace('servant_sel_voice_preset_', '');
        if (val === 'reset_lore') {
          if (targetServant) {
            const updated = { ...targetServant, customQuotes: {} };
            const updatedServants = ownedServants.map(s => s.id === updated.id ? updated : s);
            onUpdateMaster({ ...master, servants: updatedServants });
            addMessage({
              id: getNextId('bot_voice_reset'),
              sender: 'bot',
              timestamp: 'Just now',
              embed: {
                title: `✨ Voice Lines Restored to Canon Defaults!`,
                description: `Cleared custom quotes for **${targetServant.nickname || targetServant.template?.name || 'Servant'}**. Restored to exact database lore quotes.`,
                color: '#d4af37'
              }
            });
            postServantHub('dialogue', targetServant.id);
          }
          return;
        }

        let presetQuotes: any = {};
        if (val === 'artoria_canon' || val === 'canon_knight') {
          presetQuotes = {
            noblePhantasm: 'Gathered breath of the planet, torrential stream of shining life... Take this! EX---CALIBUR!',
            battleStart: 'I take the field! Saber, Artoria Pendragon, moving out!',
            victory: 'The battle is decided. May honor guide our victory, Master.',
            defeat: 'Forgive me, Master... My duty... remains unfulfilled...',
            busterChain: 'Blade of Selection... Strike true! Dragon Core, ignite!',
            artsChain: 'With pure heart and steadfast oath... Prana circulation stable!',
            quickChain: 'Invisible Air, release! Wind of the King, sweep the field!',
            summon: 'Servant Saber. I have answered your summons. I ask of you, are you my Master?'
          };
        } else if (val === 'emiya_ubw') {
          presetQuotes = {
            noblePhantasm: 'I am the bone of my sword... UNLIMITED BLADE WORKS!',
            battleStart: 'Analyzing structural blueprint... All blades stand ready.',
            victory: 'An iron will is sharper than any steel. Victory secured.',
            defeat: 'My entire life was Unlimited Blade Works... I falter here...',
            busterChain: 'Caladbolg II, overcharge projection! Shatter the perimeter!',
            artsChain: 'Tracing the origin, replicating craftsmanship... Steel is my body!',
            quickChain: 'Kanshou and Bakuya, dual arc trajectory! Intercepting flanks!',
            summon: 'Servant Archer. I have answered your call. Leave the tactics to me.'
          };
        } else if (val === 'gilgamesh_king' || val === 'mystic_spirit') {
          presetQuotes = {
            noblePhantasm: 'Look upon the glory of creation! ENUMA ELISH!',
            battleStart: 'Rejoice, mongrel! You are granted the honor of facing the King!',
            victory: 'Hahaha! Perfection is my minimum standard! Perish, fool!',
            defeat: 'How dare an insect push the King of Heroes this far?!',
            busterChain: 'Drown in the peerless treasures of Babylon! Insolent worm!',
            artsChain: 'A measured judgment from the Golden King. Accept your fate.',
            quickChain: 'Fleeing is useless! A flurry of treasures rains from heaven!',
            summon: 'Be honored, Master. You now stand in the presence of the King.'
          };
        } else if (val === 'cu_lancer' || val === 'fiery_vanguard') {
          presetQuotes = {
            noblePhantasm: 'Gáe Bolg! Spear of Striking Death Flight!',
            battleStart: 'Alright Master, point me at \'em and let me loose!',
            victory: 'Heh, not half bad! That\'s another win for the Hound of Ulster!',
            defeat: 'Tch... Battle Continuation isn\'t enough... catch you next time...',
            busterChain: 'Gáe Bolg won\'t miss! Full-force thrust straight through!',
            artsChain: 'Nordic runes align! Mana charging straight into the crimson spear!',
            quickChain: 'Too slow! The Hound leaves no tracks in the bloodied grass!',
            summon: 'Servant Lancer! The Hound of Culann answers your summons!'
          };
        } else if (val === 'jalter_avenger' || val === 'dark_avenger') {
          presetQuotes = {
            noblePhantasm: 'La Grondement du Haine! Burn to cinders!',
            battleStart: 'Your life expires here. Turn every single soul to ash!',
            victory: 'Ashes to ashes. None shall stand against my black flames!',
            defeat: 'Curse you all... My hatred is an infinite inferno!',
            busterChain: 'Burn! BURN TO CINDERS! There is no salvation for you!',
            artsChain: 'Curse the heavens, curse the earth... Dark fire burns brightest!',
            quickChain: 'Too slow! I\'ll carve you up before you even scream!',
            summon: 'I emerge from the dark flames to claim retribution.'
          };
        }

        if (targetServant) {
          const updated = {
            ...targetServant,
            customQuotes: { ...(targetServant.customQuotes || {}), ...presetQuotes }
          };
          const updatedServants = ownedServants.map(s => s.id === updated.id ? updated : s);
          onUpdateMaster({ ...master, servants: updatedServants });
          addMessage({
            id: getNextId('bot_voice_updated'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: `💬 Voice Line Dialogue Preset Applied!`,
              description: `Custom combat chants and invocations successfully saved for **${targetServant.nickname || targetServant.template?.name || 'Servant'}**!\n\n` +
                `• **NP Chant:** *" ${(updated.customQuotes as any)?.noblePhantasm} "*\n` +
                `• **Battle Start:** *" ${(updated.customQuotes as any)?.battleStart} "*`,
              color: '#d4af37'
            }
          });
          postServantHub('dialogue', targetServant.id);
        }
      }
      else if (btnId.startsWith('dlg_reset_lore_')) {
        if (targetServant) {
          const updated = { ...targetServant, customQuotes: {} };
          const updatedServants = ownedServants.map(s => s.id === updated.id ? updated : s);
          onUpdateMaster({ ...master, servants: updatedServants });
          addMessage({
            id: getNextId('bot_voice_reset'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: `✨ Voice Lines Restored to Canon Defaults!`,
              description: `Cleared custom lines for **${targetServant.nickname || targetServant.template?.name || 'Servant'}**. Restored to exact database lore quotes.`,
              color: '#d4af37'
            }
          });
          postServantHub('dialogue', targetServant.id);
        }
      }
      else if (btnId.startsWith('dlg_open_modal_')) {
        const isTactical = btnId.includes('tactical');
        addMessage({
          id: getNextId('bot_dlg_studio_prompt'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: isTactical ? `🔮 Master Dialogue Studio — Tactical & Command Seals` : `⚔️ Master Dialogue Studio — Combat & Chains`,
            description: isTactical
              ? `Customize tactical combat responses for **${targetServant.nickname || targetServant.template?.name || 'Servant'}** using slash commands:\n\n` +
                `• \`/customise quote skill "<text>"\` — Set Skill Activation quote\n` +
                `• \`/customise quote seal "<text>"\` — Set Command Seal invocation quote\n` +
                `• \`/customise quote start "<text>"\` — Set Battle Start line\n` +
                `• \`/customise quote victory "<text>"\` — Set Victory line\n` +
                `• \`/customise quote defeat "<text>"\` — Set Defeat line\n\n` +
                `*Or use the **Servant Workshop -> Tactical & Seals** tab in the web app to edit with live inputs!*`
              : `Customize combat chants for **${targetServant.nickname || targetServant.template?.name || 'Servant'}** using slash commands:\n\n` +
                `• \`/customise quote buster "<text>"\` — Set Buster Brave Chain line\n` +
                `• \`/customise quote arts "<text>"\` — Set Arts Mana Chain line\n` +
                `• \`/customise quote quick "<text>"\` — Set Quick Star Chain line\n` +
                `• \`/customise quote crit "<text>"\` — Set Critical Strike line\n` +
                `• \`/customise quote np "<text>"\` — Set Noble Phantasm Chant\n` +
                `• \`/customise quote summon "<text>"\` — Set Summon line\n\n` +
                `*Or use the **Servant Workshop -> Combat & NP** tab in the web app to author quotes with live interactive textareas!*`,
            color: isTactical ? '#a855f7' : '#d4af37'
          }
        });
      }
      // 4. Equip CE Selection
      else if (btnId.startsWith('servant_sel_equip_ce_')) {
        const ceId = btnId.replace('servant_sel_equip_ce_', '');
        const ownedCes = (master.craftEssences || []).filter(Boolean);
        const targetCe = ownedCes.find(c => c.id === ceId);
        if (targetServant && targetCe) {
          const updated = equipCraftEssence(targetServant, ceId);
          const updatedServants = ownedServants.map(s => s.id === updated.id ? updated : s);
          onUpdateMaster({ ...master, servants: updatedServants });
          addMessage({
            id: getNextId('bot_equip_ce_success'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: `✅ Craft Essence Equipped: ${targetCe.name}`,
              description: `Equipped **${targetCe.name}** [★${targetCe.rarity}] onto **${targetServant.nickname || targetServant.template?.name || 'Servant'}**!`,
              color: '#22c55e'
            }
          });
          postServantHub('equip_ce' as any, targetServant.id);
        }
      }
      // 5. Feed CE Selection (Batch and Single)
      else if (btnId.startsWith('servant_multi_feed_ce:')) {
        const rawIds = btnId.replace('servant_multi_feed_ce:', '').split(',').filter(Boolean);
        const ownedCes = (master.craftEssences || []).filter(Boolean);
        if (targetServant && rawIds.length > 0) {
          const result = feedCraftEssences(targetServant, rawIds, ownedCes);
          onUpdateMaster({
            ...master,
            craftEssences: result.remainingCraftEssences,
            servants: ownedServants.map(s => s.id === targetServant.id ? result.updatedServant : s)
          });
          const levelDiff = result.newLevel - result.oldLevel;
          addMessage({
            id: getNextId('bot_feed_ce_success'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: levelDiff > 0 ? `✨ LEVEL UP! Lv.${result.oldLevel} ➔ Lv.${result.newLevel}` : `🧪 Synthesized ${result.fedEssences.length} Craft Essences`,
              description: `Synthesized **${result.fedEssences.length} Craft Essence(s)** into spiritron mana for **${targetServant.nickname || targetServant.template?.name || 'Servant'}**!\n\n` +
                `• **EXP Gained:** \`+${result.expGained.toLocaleString()} XP\`\n` +
                (levelDiff > 0 ? `• **LEVEL UP!** Lv.${result.oldLevel} ➔ **Lv.${result.newLevel}** (+${result.levelsGained} Levels!)\n• **Stat Points:** \`+${result.statPointsGained} Available Points\`\n` : '') +
                `• **Remaining Inventory:** \`${result.remainingCraftEssences.length} Essences\``,
              color: levelDiff > 0 ? '#22c55e' : '#a855f7'
            }
          });
          postServantHub('feed_ce' as any, result.updatedServant.id);
        }
      }
      else if (btnId.startsWith('servant_sel_feed_ce_')) {
        const ceId = btnId.replace('servant_sel_feed_ce_', '');
        const ownedCes = (master.craftEssences || []).filter(Boolean);
        const ceIndex = ownedCes.findIndex(c => c.id === ceId);
        if (targetServant && ceIndex !== -1) {
          const result = feedCraftEssences(targetServant, [String(ceIndex)], ownedCes);
          onUpdateMaster({
            ...master,
            craftEssences: result.remainingCraftEssences,
            servants: ownedServants.map(s => s.id === targetServant.id ? result.updatedServant : s)
          });
          const levelDiff = result.newLevel - result.oldLevel;
          addMessage({
            id: getNextId('bot_feed_ce_success'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: levelDiff > 0 ? `✨ LEVEL UP! Lv.${result.oldLevel} ➔ Lv.${result.newLevel}` : `🧪 Synthesized Craft Essence`,
              description: `Synthesized **${result.fedEssences[0]?.name || 'Craft Essence'}** into spiritron mana for **${targetServant.nickname || targetServant.template?.name || 'Servant'}**!\n\n` +
                `• Gained \`+${result.expGained.toLocaleString()} XP\`\n` +
                (levelDiff > 0 ? `• **LEVEL UP!** Lv.${result.oldLevel} ➔ **Lv.${result.newLevel}**\n• **Gained +${result.statPointsGained} Stat Points!**` : ''),
              color: levelDiff > 0 ? '#22c55e' : '#a855f7'
            }
          });
          postServantHub('feed_ce' as any, result.updatedServant.id);
        }
      }
      // 6. Select dropdown switch
      else if (btnId.startsWith('servant_sel_switch_')) {
        const selId = btnId.replace('servant_sel_switch_', '');
        setServantHubSelectedId(selId);
        postServantHub(servantHubCategory, selId);
      }
      // 3. Set active contract
      else if (btnId.startsWith('servant_act_set_active_') || btnId === 'servant_act_set_active') {
        const selId = btnId.startsWith('servant_act_set_active_') ? btnId.replace('servant_act_set_active_', '') : (servantHubSelectedId || targetServant?.id);
        if (selId) {
          const srv = ownedServants.find(s => s.id === selId);
          onUpdateMaster({ ...master, activeServantId: selId });
          addMessage({
            id: getNextId('bot_contract_switch'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: `👑 Active Contract Formed: ${srv?.nickname || srv?.template?.name || 'Servant'}`,
              description: `You are now commanding **${srv?.nickname || srv?.template?.name || 'Servant'}** (${srv?.template?.servantClass || 'Saber'}) in the Holy Grail War!`,
              color: '#22c55e'
            }
          });
          postServantHub(servantHubCategory, selId);
        }
      }
      // 4. Stat allocation
      else if (btnId.startsWith('servant_add_')) {
        if (!targetServant) return;
        const avail = targetServant.availableStatPoints || 0;
        if (avail <= 0) {
          addMessage({
            id: getNextId('bot_no_stat_pts'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '⚠️ No Available Stat Points',
              description: 'Feed Craft Essences in `/inventory` to level up your Servant and earn +10 stat points per level!',
              color: '#ef4444'
            }
          });
          return;
        }

        const statKey = btnId.replace('servant_add_', '');
        let updated = { ...targetServant };
        if (statKey === 'auto') {
          const stats: ('strength' | 'endurance' | 'agility' | 'mana' | 'luck')[] = ['strength', 'endurance', 'agility', 'mana', 'luck'];
          const toDist = Math.min(5, avail);
          for (let idx = 0; idx < toDist; idx++) {
            updated = allocateStatPoints(updated, stats[idx % stats.length], 1);
          }
        } else if (statKey === 'str') {
          updated = allocateStatPoints(updated, 'strength', 1);
        } else if (statKey === 'end') {
          updated = allocateStatPoints(updated, 'endurance', 1);
        } else if (statKey === 'agi') {
          updated = allocateStatPoints(updated, 'agility', 1);
        } else if (statKey === 'mna') {
          updated = allocateStatPoints(updated, 'mana', 1);
        } else if (statKey === 'lck') {
          updated = allocateStatPoints(updated, 'luck', 1);
        }

        const updatedServants = ownedServants.map(s => s.id === updated.id ? updated : s);
        onUpdateMaster({ ...master, servants: updatedServants });
        postServantHub('stats', updated.id);
      }
      // 5. Cross-Hub Shortcuts
      else if (btnId === 'servant_link_inventory') {
        postInventoryHub('ces');
      } else if (btnId === 'servant_link_gacha') {
        postGachaHub('ces');
      } else if (btnId === 'servant_link_grailwar') {
        setGrailWarHubCategory('board');
        postGrailWarHub('board');
      } else if (btnId === 'servant_link_duel') {
        handleCommand('/duel');
      }
      return;
    } else if (
      btnId.startsWith('war_tab_') ||
      btnId.startsWith('war_board_') ||
      btnId.startsWith('war_act_') ||
      btnId.startsWith('war_deploy_') ||
      btnId.startsWith('war_place_trap_') ||
      btnId.startsWith('anchor_trap_') ||
      btnId.startsWith('disarm_trap_') ||
      btnId.startsWith('prompt_anchor_') ||
      btnId === 'disarm_all_traps' ||
      btnId === 'refresh_traps_radar' ||
      btnId === 'add_custom_channel_btn' ||
      btnId.startsWith('war_link_') ||
      btnId === 'church_claim_asylum' ||
      btnId === 'church_leave_asylum'
    ) {
      // 1. Navigation Tabs & Board Sub-Views
      if (btnId === 'war_tab_board' || btnId === 'war_board_roster') {
        setGrailWarHubCategory('board');
        postGrailWarHub('board');
      } else if (btnId === 'war_board_casualties') {
        setGrailWarHubCategory('casualties');
        postGrailWarHub('casualties');
      } else if (btnId === 'war_board_leaks') {
        setGrailWarHubCategory('leaks');
        postGrailWarHub('leaks');
      } else if (btnId === 'war_board_battles') {
        setGrailWarHubCategory('battles');
        postGrailWarHub('battles');
      } else if (btnId === 'war_tab_defenses') {
        setGrailWarHubCategory('defenses');
        postGrailWarHub('defenses');
      } else if (btnId === 'war_tab_familiars') {
        setGrailWarHubCategory('familiars');
        postGrailWarHub('familiars');
      } else if (btnId === 'war_tab_traps') {
        setGrailWarHubCategory('traps');
        postGrailWarHub('traps');
      } else if (btnId === 'war_tab_church') {
        setGrailWarHubCategory('church');
        postGrailWarHub('church');
      }
      // 2. War Actions
      else if (btnId === 'war_act_patrol') {
        handleCommand('/patrol');
      } else if (btnId === 'war_act_skirmish') {
        handleCommand('/grailwar skirmish');
      } else if (btnId === 'war_act_heal') {
        handleCommand('/grailwar heal');
      } else if (btnId === 'war_act_refresh') {
        postGrailWarHub(grailWarHubCategory, '🔄 War board refreshed.');
      } else if (btnId === 'war_deploy_raven') {
        handleCommand('/grailwar familiar raven');
      } else if (btnId === 'war_deploy_homunculus') {
        handleCommand('/grailwar familiar homunculus');
      } else if (btnId === 'war_deploy_shadow_imp') {
        handleCommand('/grailwar familiar shadow_imp');
      } else if (btnId === 'war_place_trap_alarm' || btnId === 'prompt_anchor_alarm') {
        postChannelSelectorPrompt('alarm');
      } else if (btnId === 'war_place_trap_drain' || btnId === 'prompt_anchor_drain') {
        postChannelSelectorPrompt('drain');
      } else if (btnId.startsWith('anchor_trap_sanctuary_')) {
        const targetChan = btnId.replace('anchor_trap_sanctuary_', '');
        const res = setWorkshopWardInWar(grailWar, master.discordId, 'ward', targetChan);
        onUpdateGrailWar(res.updatedWar);
        onUpdateMaster({ ...master, boundedField: 'ward', sanctuaryChannelName: targetChan });
        postTrapsRadarOverview(res.message);
      } else if (btnId.startsWith('anchor_trap_alarm_')) {
        const targetChan = btnId.replace('anchor_trap_alarm_', '');
        const res = setChannelTrapInWar(grailWar, master.discordId, master.username, targetChan, 'alarm');
        onUpdateGrailWar(res.updatedWar);
        postTrapsRadarOverview(res.message);
      } else if (btnId.startsWith('anchor_trap_drain_')) {
        const targetChan = btnId.replace('anchor_trap_drain_', '');
        const res = setChannelTrapInWar(grailWar, master.discordId, master.username, targetChan, 'drain');
        onUpdateGrailWar(res.updatedWar);
        postTrapsRadarOverview(res.message);
      } else if (btnId.startsWith('disarm_trap_')) {
        const targetChan = btnId.replace('disarm_trap_', '');
        const res = disarmChannelTrapsInWar(grailWar, master.discordId, targetChan);
        onUpdateGrailWar(res.updatedWar);
        postTrapsRadarOverview(res.message);
      } else if (btnId === 'disarm_all_traps') {
        const res = disarmChannelTrapsInWar(grailWar, master.discordId);
        onUpdateGrailWar(res.updatedWar);
        postTrapsRadarOverview(res.message);
      } else if (btnId === 'refresh_traps_radar') {
        postTrapsRadarOverview();
      } else if (btnId === 'add_custom_channel_btn') {
        setShowAddChannelModal(true);
      } else if (btnId === 'church_claim_asylum') {
        const uP = grailWar.participants[master.discordId] ||
          Object.values(grailWar.participants).find(p => p.username.toLowerCase() === master.username.toLowerCase());
        if (uP) {
          const res = enterChurchSanctuary(grailWar, uP.discordId);
          onUpdateGrailWar(res.updatedWar);
          postGrailWarHub('church', res.message);
        } else {
          handleCommand('/church enter');
        }
      } else if (btnId === 'church_leave_asylum') {
        const uP = grailWar.participants[master.discordId] ||
          Object.values(grailWar.participants).find(p => p.username.toLowerCase() === master.username.toLowerCase());
        if (uP) {
          const res = leaveChurchSanctuary(grailWar, uP.discordId);
          onUpdateGrailWar(res.updatedWar);
          postGrailWarHub('church', res.message);
        } else {
          handleCommand('/church leave');
        }
      } else if (btnId === 'war_tab_bounties' || btnId === 'war_show_bounties') {
        handleCommand('/bounties');
      } else if (btnId === 'war_tab_reputation' || btnId === 'war_show_reputation') {
        handleCommand('/reputation');
      }
      // 3. Cross-Hub Shortcuts
      else if (btnId === 'war_link_inventory') {
        postInventoryHub('ces');
      } else if (btnId === 'war_link_gacha') {
        postGachaHub('ces');
      } else if (btnId === 'war_link_servant') {
        postServantHub('profile');
      } else if (btnId === 'war_link_duel') {
        handleCommand('/duel');
      }
      return;
    } else if (
      btnId.startsWith('admin_')
    ) {
      // 1. Navigation Tabs
      if (btnId === 'admin_tab_war') {
        setAdminHubCategory('war' as any);
        postAdminHub('war' as any);
      } else if (btnId === 'admin_tab_war_rules') {
        setAdminHubCategory('war_rules' as any);
        postAdminHub('war_rules' as any);
      } else if (btnId === 'admin_tab_npanim') {
        setAdminHubCategory('npanim');
        postAdminHub('npanim');
      } else if (btnId === 'admin_tab_npsettings') {
        setAdminHubCategory('npsettings');
        postAdminHub('npsettings');
      } else if (btnId === 'admin_tab_listnp') {
        setAdminHubCategory('listnp');
        postAdminHub('listnp');
      } else if (btnId === 'admin_tab_economy') {
        setAdminHubCategory('economy');
        postAdminHub('economy');
      }
      // 2. Command Seals Customization
      else if (btnId.startsWith('admin_set_seals_')) {
        const count = parseInt(btnId.replace('admin_set_seals_', ''), 10) || 3;
        const currentRules = (grailWar as any).rules || {};
        const updatedRules = { ...currentRules, startingCommandSeals: count };
        const updatedWar = { ...grailWar, rules: updatedRules };
        onUpdateGrailWar(updatedWar);
        postAdminHub('war_rules', `🔱 **Starting Command Seals set to ${count} Seals!** All future summonings will begin with ${count} Command Seals.`);
      }
      // 3. Roster Capacity Customization
      else if (btnId.startsWith('admin_set_cap_')) {
        const cap = parseInt(btnId.replace('admin_set_cap_', ''), 10) || 7;
        const currentRules = (grailWar as any).rules || {};
        const updatedRules = { ...currentRules, maxMasters: cap };
        const updatedWar = { ...grailWar, rules: updatedRules };
        onUpdateGrailWar(updatedWar);
        postAdminHub('war_rules', `👥 **Master Roster Capacity set to ${cap} Masters!**`);
      }
      // 4. Rule Toggles
      else if (btnId === 'admin_toggle_permadeath') {
        const currentRules = (grailWar as any).rules || {};
        const newVal = currentRules.permadeath === false;
        const updatedRules = { ...currentRules, permadeath: newVal };
        const updatedWar = { ...grailWar, rules: updatedRules };
        onUpdateGrailWar(updatedWar);
        postAdminHub('war_rules', newVal ? '💀 **Permadeath ENABLED!** Masters with 0 HP are permanently eliminated.' : '🛡️ **Permadeath DISABLED!** Casual/training mode activated.');
      } else if (btnId === 'admin_toggle_church') {
        const currentRules = (grailWar as any).rules || {};
        const newVal = currentRules.churchAsylum === false;
        const updatedRules = { ...currentRules, churchAsylum: newVal };
        const updatedWar = { ...grailWar, rules: updatedRules };
        onUpdateGrailWar(updatedWar);
        postAdminHub('war_rules', newVal ? '⛪ **Church Sanctuary ENABLED!** Neutral asylum under Father Kotomine active.' : '🚫 **Church Sanctuary DESECRATED!** No sanctuary allowed.');
      } else if (btnId === 'admin_toggle_class_excl') {
        const currentRules = (grailWar as any).rules || {};
        const newVal = currentRules.classExclusivity === false;
        const updatedRules = { ...currentRules, classExclusivity: newVal };
        const updatedWar = { ...grailWar, rules: updatedRules };
        onUpdateGrailWar(updatedWar);
        postAdminHub('war_rules', newVal ? '🔒 **Class Exclusivity: STRICT (1 per Class)**' : '🔓 **Class Exclusivity: OPEN (Duplicates Allowed)**');
      } else if (btnId === 'admin_toggle_factions') {
        const currentRules = (grailWar as any).rules || {};
        const newVal = currentRules.factionMode === false;
        const updatedRules = { ...currentRules, factionMode: newVal };
        const updatedWar = { ...grailWar, rules: updatedRules };
        onUpdateGrailWar(updatedWar);
        postAdminHub('war_rules', newVal ? '🚩 **Faction Mode ENABLED!** Red vs Black (Apocrypha) war active.' : '⚔️ **Faction Mode: Free-For-All**');
      } else if (btnId === 'admin_refill_all_seals') {
        const currentRules = (grailWar as any).rules || {};
        const targetSeals = currentRules.startingCommandSeals || 3;
        const updatedParts = { ...grailWar.participants };
        Object.keys(updatedParts).forEach(k => {
          if (updatedParts[k]) {
            updatedParts[k] = { ...updatedParts[k], commandSeals: targetSeals };
          }
        });
        const updatedWar = { ...grailWar, participants: updatedParts };
        onUpdateGrailWar(updatedWar);
        onUpdateMaster({ ...master, commandSeals: targetSeals });
        postAdminHub('war_rules', `✨ **Restored all active Masters' Command Seals to ${targetSeals} Seals!**`);
      }
      // 5. Grail War Presets & Rules Configuration
      else if (btnId === 'admin_war_preset_fuyuki_7') {
        postAdminHub('war' as any, '✨ Applied **5th Fuyuki (7 Masters)** format! Strict 1-per-class, Canon Only, Permadeath.');
      } else if (btnId === 'admin_war_preset_apocrypha_14') {
        postAdminHub('war' as any, '✨ Applied **Great Holy Grail War (14 Masters - Red vs Black)** format! Expanded capacity.');
      } else if (btnId === 'admin_war_preset_singularity_chaos') {
        postAdminHub('war' as any, '✨ Applied **Singularity Chaos (30 Masters)** format! Canon + Custom Servants permitted.');
      } else if (btnId === 'admin_war_preset_desolate_hardcore') {
        postAdminHub('war' as any, '💀 Applied **Desolate Hardcore** format! 1 Command Seal, Slow 15m Leylines, Extreme lethality.');
      }
      // 3. Grail War Lifecycle & Contract Actions
      else if (btnId === 'admin_war_action_restart') {
        const resetParticipants: Record<string, any> = {};
        onUpdateGrailWar({
          ...grailWar,
          participants: resetParticipants,
          channelTraps: [],
          familiars: [],
          civilianCasualties: []
        });
        postAdminHub('war' as any, '🚀 **Holy Grail War Restarted!** War roster cleared and archived to Hall of Fame. Masters can now invoke `/summon ritual` to form new covenants.');
      } else if (btnId === 'admin_war_fresh_slate') {
        onUpdateMaster({
          ...master,
          servants: [],
          activeServantId: undefined,
          commandSeals: 3
        });
        onUpdateGrailWar({
          ...grailWar,
          participants: {},
          channelTraps: [],
          familiars: [],
          civilianCasualties: []
        });
        postAdminHub('war' as any, '🧹 **FRESH SEASON LAUNCHED!** All active Servant contracts have been dissolved across the server, the war roster has been wiped clean, and Command Seals restored to 3/3! All Masters can now invoke `/summon ritual` for the new war.');
      } else if (btnId === 'admin_war_reset_my_servant') {
        onUpdateMaster({
          ...master,
          servants: [],
          activeServantId: undefined,
          commandSeals: 3
        });
        const updatedParticipants = { ...grailWar.participants };
        delete updatedParticipants[master.discordId];
        onUpdateGrailWar({
          ...grailWar,
          participants: updatedParticipants
        });
        postAdminHub('war' as any, '🗡️ **Contract Severed!** Your active Servant covenant has been released. You can now use `/summon ritual` to summon a brand new Heroic Spirit!');
      } else if (btnId === 'admin_war_reset_my_stats') {
        const resetServants = (master.servants || []).map(s => ({
          ...s,
          level: 1,
          exp: 0,
          availableStatPoints: 0,
          bonusStrength: 0,
          bonusEndurance: 0,
          bonusAgility: 0,
          bonusMana: 0,
          bonusLuck: 0,
          allocatedStats: { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 },
          bondLevel: 0,
          bondExp: 0,
          equippedCraftEssence: undefined,
          equippedCeId: undefined
        }));
        onUpdateMaster({
          ...master,
          servants: resetServants
        });
        postAdminHub('war' as any, '🌱 **Servant Level & Stats Reset!** Your Servant has been reset to **Level 1** with 0 EXP and base parameters.');
      } else if (btnId === 'admin_war_action_reset') {
        postAdminHub('war' as any, '🔄 **Holy Grail War Refreshed!** All Servants restored to full HP, sanctuary wards reactivated.');
      } else if (btnId === 'admin_war_history_view') {
        postAdminHub('war' as any, '📜 **Hall of Fame:** Previous war concluded with Victor **Kiritsugu** and *Artoria Pendragon* (7 Participants, 6 Eliminations).');
      }
      // 4. Cataclysms
      else if (btnId === 'admin_war_cataclysm_hub') {
        postAdminHub('war' as any, '⚡ **Select a Leyline Cataclysm:**\n• 🖤 Mud Surge (-35% HP)\n• 🌌 Moon Cell Purge (Sanctuaries dissolved)\n• 🔥 Mana Burst (All NP gauge +100%)\n• ☠️ Sudden Death (Double damage for 1 hour)');
      } else if (btnId.startsWith('admin_cata_')) {
        postAdminHub('war' as any, '⚡ **Cataclysm Invoked across Fuyuki Leylines!** All active Masters affected.');
      }
      // 5. Economy Minting
      else if (btnId === 'admin_mint_30sq') {
        const newSq = (master.saintQuartz || 0) + 30;
        onUpdateMaster({ ...master, saintQuartz: newSq });
        postAdminHub('economy', `✨ Minted +30 Saint Quartz! New balance: ${newSq} SQ.`);
      } else if (btnId === 'admin_mint_100sq') {
        const newSq = (master.saintQuartz || 0) + 100;
        onUpdateMaster({ ...master, saintQuartz: newSq });
        postAdminHub('economy', `✨ Minted +100 Saint Quartz! New balance: ${newSq} SQ.`);
      } else if (btnId === 'admin_mint_qp') {
        const newQp = (master.qp || 0) + 1000000;
        onUpdateMaster({ ...master, qp: newQp });
        postAdminHub('economy', `🪙 Minted +1,000,000 QP! New balance: ${newQp.toLocaleString()} QP.`);
      } else if (btnId === 'admin_refill_seals') {
        onUpdateMaster({ ...master, commandSeals: 3 });
        postAdminHub('economy', '🔱 Restored Command Seals to 3/3!');
      } else if (btnId === 'admin_reset_currency') {
        onUpdateMaster({
          ...master,
          saintQuartz: 30,
          qp: 0,
          summonTickets: 0,
          manaPrisms: 0,
          saintShards: 0
        } as any);
        postAdminHub('economy', '🧹 **Currency Reset:** Reset your Saint Quartz to 30 SQ, and QP/Tickets/Shards to 0.');
      } else if (btnId === 'admin_reset_inventory') {
        const updatedServants = (master.servants || []).map(s => ({
          ...s,
          equippedCe: undefined,
          equippedCeId: undefined,
          equippedCraftEssence: undefined
        }));
        onUpdateMaster({
          ...master,
          craftEssences: [],
          catalysts: [],
          servants: updatedServants
        } as any);
        postAdminHub('economy', '🎒 **Inventory Cleared:** Wiped all Craft Essences, unequipped items, and catalysts from inventory.');
      } else if (btnId === 'admin_reset_vault') {
        const updatedServants = (master.servants || []).map(s => ({
          ...s,
          equippedCe: undefined,
          equippedCeId: undefined,
          equippedCraftEssence: undefined
        }));
        onUpdateMaster({
          ...master,
          saintQuartz: 30,
          qp: 0,
          summonTickets: 0,
          manaPrisms: 0,
          saintShards: 0,
          craftEssences: [],
          catalysts: [],
          servants: updatedServants
        } as any);
        postAdminHub('economy', '🔄 **Full Vault Reset:** All inventory items wiped and currency restored to initial state (30 SQ, 0 QP).');
      } else if (btnId === 'admin_reset_all_economy') {
        const updatedServants = (master.servants || []).map(s => ({
          ...s,
          equippedCe: undefined,
          equippedCeId: undefined,
          equippedCraftEssence: undefined
        }));
        onUpdateMaster({
          ...master,
          saintQuartz: 30,
          qp: 0,
          summonTickets: 0,
          manaPrisms: 0,
          saintShards: 0,
          craftEssences: [],
          catalysts: [],
          servants: updatedServants
        } as any);
        postAdminHub('economy', '⚠️ **Server-Wide Economy Wipe:** Wiped all Masters\' inventories and reset currencies across the server.');
      }
      // 6. Duel NP Settings
      else if (btnId === 'admin_toggle_autodelete') {
        postAdminHub('npsettings', '🔄 Toggled Duel NP animation auto-delete.');
      } else if (btnId === 'admin_set_afk_30') {
        postAdminHub('npsettings', '⏱️ Set duel turn timeout to 30 seconds.');
      } else if (btnId === 'admin_set_afk_60') {
        postAdminHub('npsettings', '⏱️ Set duel turn timeout to 60 seconds.');
      } else if (btnId === 'admin_refresh_view') {
        postAdminHub(adminHubCategory as any, '🔄 View refreshed.');
      }
      // 7. Cross-Hub Shortcuts
      else if (btnId === 'admin_link_inventory') {
        postInventoryHub('ces');
      } else if (btnId === 'admin_link_servant') {
        postServantHub('profile');
      } else if (btnId === 'admin_link_grailwar') {
        setGrailWarHubCategory('board');
        postGrailWarHub('board');
      } else if (btnId === 'admin_link_duel' || btnId === 'admin_link_duel_main') {
        handleCommand('/duel');
      } else if (btnId === 'admin_link_gacha') {
        postGachaHub('ces');
      }
      return;
    } else if (btnId === 'servant_list_prev') {
      const newPage = Math.max(1, servantsPage - 1);
      setServantsPage(newPage);
      postServantsList(allThrone, undefined, undefined, newPage, servantsOriginFilter, servantsClassFilter, servantsSearchQuery);
      return;
    } else if (btnId === 'servant_list_next') {
      const newPage = servantsPage + 1;
      setServantsPage(newPage);
      postServantsList(allThrone, undefined, undefined, newPage, servantsOriginFilter, servantsClassFilter, servantsSearchQuery);
      return;
    } else if (btnId === 'servant_list_origin') {
      const nextOrigin: 'all' | 'canon' | 'custom' = servantsOriginFilter === 'all' ? 'canon' : servantsOriginFilter === 'canon' ? 'custom' : 'all';
      setServantsOriginFilter(nextOrigin);
      setServantsPage(1);
      postServantsList(allThrone, undefined, undefined, 1, nextOrigin, servantsClassFilter, servantsSearchQuery);
      return;
    } else if (btnId === 'servant_list_class') {
      const classes = ['all', 'Saber', 'Archer', 'Lancer', 'Rider', 'Caster', 'Assassin', 'Berserker', 'Ruler', 'Avenger'];
      const curIdx = classes.indexOf(servantsClassFilter);
      const nextClass = classes[(curIdx + 1) % classes.length];
      setServantsClassFilter(nextClass);
      setServantsPage(1);
      postServantsList(allThrone, undefined, undefined, 1, servantsOriginFilter, nextClass, servantsSearchQuery);
      return;
    } else if (btnId === 'btn_back_servants_list' || btnId === 'btn_show_servants_list') {
      postServantsList(allThrone, undefined, undefined, servantsPage, servantsOriginFilter, servantsClassFilter, servantsSearchQuery);
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
            servantClass: target.servantClass,
            avatarUrl: target.avatarUrl,
            bondOrLevel: 10,
            bgUrlOrPreset: 'fuyuki'
          }
        });
      }
    } else if (btnId === 'quick_daily_claim' || btnId === 'daily_claim') {
      handleCommand('/daily');
    } else if (btnId === 'quick_profile_view') {
      postProfileEmbed();
    } else if (btnId === 'quick_ce_gacha_ten') {
      handleCommand('/cegacha 10');
    } else if (btnId === 'quick_ce_gacha_view') {
      handleCommand('/cegacha');
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
        // Pick a dynamic combat chain type based on message state
        const chainTypes: ('Buster' | 'Arts' | 'Quick')[] = ['Buster', 'Arts', 'Quick'];
        const randomCard = chainTypes[messages.length % chainTypes.length];
        const sequence: ('Buster' | 'Arts' | 'Quick')[] = [randomCard, randomCard, randomCard];

        const diaResult = getServantChainDialogue(
          activeServant.template.name,
          activeServant.template.servantClass,
          sequence,
          activeServant.customQuotes
        );

        addMessage({
          id: getNextId('bot_quote'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: `💬 ${activeServant.template.name} — [${diaResult.tag}]`,
            description: `*"${diaResult.quote}"*`,
            color: '#f59e0b',
            footer: 'Dynamic Animated Visual Novel Dialogue Card attachment'
          },
          canvasType: 'dialogue',
          canvasPayload: {
            speaker: activeServant.template.name,
            quote: diaResult.quote,
            title: diaResult.tag,
            servantClass: activeServant.template.servantClass,
            avatarUrl: activeServant.template.avatarUrl,
            bondOrLevel: activeServant.bondLevel || 8,
            defenderName: 'Opponent Servant',
            defenderClass: 'Archer',
            sequence,
            bgUrlOrPreset: 'fuyuki'
          }
        });
      }
    } else if (btnId.startsWith('dlg_')) {
      const parts = btnId.split('_');
      // dlg_set_buster_<id>, dlg_set_arts_<id>, dlg_test_cutin_<id>, dlg_switch_servant_<id>, dlg_open_hub_<id>
      const action = parts[1]; // set, test, switch, open
      const subAction = parts[2]; // buster, arts, quick, battle, cutin, servant, hub
      const servantId = parts.slice(3).join('_') || (action === 'switch' ? parts.slice(3).join('_') : '');

      const targetServant = master.servants.find(s => s.id === servantId) || activeServant;

      if (action === 'set') {
        const chainMap: Record<string, string> = {
          buster: 'busterChain',
          arts: 'artsChain',
          quick: 'quickChain',
          battle: 'battleStart'
        };
        const key = chainMap[subAction] || 'busterChain';
        const label = subAction.toUpperCase();
        addMessage({
          id: getNextId('bot_dlg_prompt'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: `✍️ Author Custom ${label} Line`,
            description:
              `To set a custom **${label}** quote for **${targetServant?.template.name}**, run:\n\n` +
              `\`\`\`\n/customise quote ${key} "Your custom quote here"\n\`\`\`\n` +
              `*Or use the **Servant Workshop** tab at any time to edit and save directly!*`,
            color: '#d4af37'
          }
        });
      } else if (action === 'test') {
        if (targetServant) {
          const sequence: ('Buster' | 'Arts' | 'Quick')[] = ['Buster', 'Buster', 'Buster'];
          const diaResult = getServantChainDialogue(
            targetServant.template.name,
            targetServant.template.servantClass,
            sequence,
            targetServant.customQuotes
          );
          addMessage({
            id: getNextId('bot_dialogue_cutin'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: `🎬 Visual Novel Cut-In: ${targetServant.template.name} — [${diaResult.tag}]`,
              description: `*"${diaResult.quote}"*`,
              color: '#ef4444',
              footer: `Brave Chain Resonance • Master ${master.username}`
            },
            canvasType: 'dialogue',
            canvasPayload: {
              speaker: targetServant.nickname || targetServant.template.name,
              quote: diaResult.quote,
              title: diaResult.tag,
              servantClass: targetServant.template.servantClass,
              avatarUrl: targetServant.template.avatarUrl,
              bondOrLevel: targetServant.bondLevel || 10,
              defenderName: 'Enemy Combatant',
              defenderClass: 'Archer',
              sequence,
              bgUrlOrPreset: 'fuyuki'
            }
          });
        }
      } else if (action === 'switch') {
        const owned = master.servants || [];
        const currentIndex = owned.findIndex(s => s.id === servantId);
        const nextIndex = (currentIndex + 1) % owned.length;
        const nextServant = owned[nextIndex];
        postCustomDialogueHub(nextServant?.id);
      } else if (action === 'open') {
        postCustomDialogueHub(servantId);
      }
    } else if (btnId === 'duel_command_seal_evacuate') {
      const seals = master.commandSeals ?? 3;
      if (seals < 1) {
        addMessage({
          id: getNextId('bot_duel_no_seals'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '❌ Insufficient Command Seals',
            description: 'You do not have any Command Seals remaining to execute emergency spatial evacuation!',
            color: '#ef4444'
          }
        });
        return;
      }
      const newSeals = Math.max(0, seals - 1);
      onUpdateMaster({
        ...master,
        commandSeals: newSeals
      });

      // Restore Holy Grail War participant if they were eliminated
      const uId = master.discordId;
      if (grailWar.participants[uId]) {
        const updatedWar = {
          ...grailWar,
          participants: {
            ...grailWar.participants,
            [uId]: {
              ...grailWar.participants[uId],
              isAlive: true,
              currentHp: 1
            }
          }
        };
        onUpdateGrailWar(updatedWar);
      }

      setActiveDuel(null);

      const p1Name = activeServant?.nickname || activeServant?.template.name || 'Your Servant';
      const sealQuote = activeServant?.customQuotes?.commandSeal || "By my Command Seal, withdraw from this battlefield and survive!";
      addMessage({
        id: getNextId('bot_duel_seal_evac'),
        sender: 'bot',
        timestamp: 'Just now',
        embed: {
          title: '🔮 COMMAND SEAL SPATIAL EVACUATION EXECUTED',
          description:
            `🔱 **[COMMAND SEAL] ${master.username || 'Master'}:**\n> ❝ ***${sealQuote}*** ❞\n\n` +
            `By the absolute authority of your Command Seal, **${p1Name}** was spatially recalled from lethal defeat!\n\n` +
            `✨ **Status:** Preserved and extracted to safety at **1 HP**.\n` +
            `✦ **Command Seals Remaining:** **${newSeals}/3**\n` +
            `🛡️ **Holy Grail War Tournament Standing:** Restored to Active Competitor!`,
          color: '#f43f5e',
          footer: 'Emergency Spatial Extraction • 1 Command Seal Expended'
        },
        components: {
          type: 'buttons',
          items: [
            { id: 'quick_war_status', label: 'Intelligence Board (/grailwar)', style: 'primary', emoji: '📋' },
            { id: 'profile_heal', label: 'Heal at Workshop (/heal)', style: 'success', emoji: '🩹' },
            { id: 'quick_start_duel', label: 'Resume Duel (/duel)', style: 'danger', emoji: '⚔️' }
          ]
        }
      });
      return;
    } else if (btnId.startsWith('duel_tab_')) {
      if (btnId === 'duel_tab_arena') {
        setDuelHubCategory('arena');
        postDuelHub('arena');
      } else if (btnId === 'duel_tab_active') {
        setDuelHubCategory('active');
        postDuelHub('active');
      } else if (btnId === 'duel_tab_history') {
        setDuelHubCategory('history');
        postDuelHub('history');
      } else if (btnId === 'duel_tab_leaderboard') {
        setDuelHubCategory('leaderboard');
        postDuelHub('leaderboard');
      }
      return;
    } else if (btnId.startsWith('duel_act_') || btnId.startsWith('duel_link_')) {
      if (btnId === 'duel_act_queue' || btnId === 'duel_act_practice') {
        handleCommand('/duel shadow_rival');
      } else if (btnId === 'duel_act_2v2' || btnId === 'duel_act_alliance') {
        handleCommand('/duel 2v2');
      } else if (btnId === 'duel_act_1v2' || btnId === 'duel_act_raid') {
        handleCommand('/duel 1v2');
      } else if (btnId === 'duel_act_alliance_assist') {
        if (!activeDuel) return;
        const currentP1 = activeDuel.battle.player1;
        const updatedBuffs = [...(currentP1.activeBuffs || []), {
          name: 'Alliance Tag Assist',
          type: 'buff_atk',
          value: 25,
          remainingTurns: 2
        }];
        const updatedP1 = {
          ...currentP1,
          critStars: Math.min(50, (currentP1.critStars || 0) + 15),
          activeBuffs: updatedBuffs
        };
        setActiveDuel({
          ...activeDuel,
          battle: {
            ...activeDuel.battle,
            player1: updatedP1
          }
        });
        addMessage({
          id: getNextId('bot_alliance_assist'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '🛡️ ALLIANCE TAG-TEAM ASSIST ACTIVATED!',
            description: `🤝 **Alliance Partner Assist!** Your teammate executes a coordinated flank strike!\n\n• **ATK Buff:** +25% DMG for 2 Turns\n• **Tactical Stars:** +15 Critical Stars gathered!`,
            color: '#38bdf8'
          }
        });
        return;
      } else if (btnId === 'duel_act_refresh') {
        postDuelHub(duelHubCategory, '🔄 Arena lobby refreshed.');
      } else if (btnId === 'duel_link_inventory') {
        postInventoryHub('ces');
      } else if (btnId === 'duel_link_gacha') {
        postGachaHub('ces');
      } else if (btnId === 'duel_link_servant') {
        postServantHub('profile');
      } else if (btnId === 'duel_link_grailwar') {
        setGrailWarHubCategory('board');
        postGrailWarHub('board');
      }
      return;
    } else if (btnId.startsWith('duel_')) {
      if (btnId === 'duel_prompt_forcejoin') {
        handleCommand('/duel forcejoin');
        return;
      }
      if (btnId === 'duel_forcejoin_side_teama') {
        handleCommand('/duel forcejoin teama');
        return;
      }
      if (btnId === 'duel_forcejoin_side_teamb') {
        handleCommand('/duel forcejoin teamb');
        return;
      }

      if (!activeDuel) {
        handleCommand('/duel');
        return;
      }

      if (btnId === 'duel_flee') {
        cleanupActiveNpGif();
        const p1 = activeDuel.battle.player1;
        const p2 = activeDuel.battle.player2;
        const fleeCalc = calculateFleeChance(
          p1.currentHp,
          p1.maxHp,
          p1.servantClass,
          activeServant?.template.baseStats?.agility || 10
        );

        const success = rollFleeSuccess(fleeCalc.chancePercent);

        if (success) {
          addMessage({
            id: getNextId('bot_duel_flee_success'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '🏃💨 TACTICAL RETREAT SUCCESSFUL',
              description:
                `**${p1.name}** broke away from combat and safely disengaged from **${p2.name}**!\n\n` +
                `🎲 **Flee Calculation:** \`${fleeCalc.chancePercent}%\` success rate${fleeCalc.isAgilityBonus ? ' (+5% Agility Servant bonus)' : ''}\n` +
                `✨ **Outcome:** Disengaged to Chaldea sanctuary. No defeat penalty, streak loss, or elimination incurred!`,
              color: '#f59e0b',
              footer: 'Tactical Disengagement • Holy Grail War Protocol'
            },
            components: {
              type: 'buttons',
              items: [
                { id: 'quick_war_status', label: 'View Intelligence Board (/grailwar)', style: 'primary', emoji: '📋' },
                { id: 'quick_start_duel', label: 'Enter Arena (/duel)', style: 'danger', emoji: '⚔️' }
              ]
            }
          });
          setActiveDuel(null);
          return;
        } else {
          // Flee failed! Enemy counter-strike (reduced to 2,000 HP)
          const counterDmg = 2000;
          const newPlayer1Hp = Math.max(0, p1.currentHp - counterDmg);
          const isDefeated = newPlayer1Hp <= 0;

          const updatedState: BattleState = {
            ...activeDuel.battle,
            currentTurn: activeDuel.battle.currentTurn + 1,
            player1: {
              ...activeDuel.battle.player1,
              currentHp: newPlayer1Hp
            },
            turnPhase: isDefeated ? 'defeat' : 'card_selection'
          };

          const failLog = `❌ **RETREAT FAILED!** (${fleeCalc.chancePercent}% chance) Turn consumed — **${p2.name}** counter-struck for **2,000 DMG**! (${newPlayer1Hp.toLocaleString()} / ${p1.maxHp.toLocaleString()} HP remaining)`;

          if (updatedState.turnPhase === 'defeat') {
            const seals = master.commandSeals ?? 3;
            const p1DefeatQuote = activeServant?.customQuotes?.defeat || activeServant?.template.defeatQuote || "Master... I have failed you in this Holy Grail War...";
            const autoConsume = grailWar.participants[master.discordId]?.autoEvadeEnabled === true || master.autoConsumeCommandSeal === true;

            if (seals >= 1 && autoConsume) {
              const remainingSeals = Math.max(0, seals - 1);
              onUpdateMaster({
                ...master,
                commandSeals: remainingSeals
              });
              const uWar = { ...grailWar };
              if (uWar.participants[master.discordId]) {
                uWar.participants[master.discordId].currentHp = 1;
                uWar.participants[master.discordId].isAlive = true;
                uWar.participants[master.discordId].commandSeals = remainingSeals;
              }
              onUpdateGrailWar(uWar);
              setActiveDuel(null);

              addMessage({
                id: getNextId('bot_duel_flee_fail_saved'),
                sender: 'bot',
                timestamp: 'Just now',
                embed: {
                  title: '🔴 COMMAND SEAL AUTOMATIC EVACUATION',
                  description:
                    `**${p1.name}** failed to escape (${fleeCalc.chancePercent}% chance) and suffered a mortal blow from **${p2.name}**!\n\n` +
                    `💬 **[MORTAL BLOW] ${p1.name}:**\n> ❝ ***${p1DefeatQuote}*** ❞\n\n` +
                    `🔱 **[COMMAND SEAL] ${master.username || 'Master'}:**\n> ❝ ***${activeServant?.customQuotes?.commandSeal || 'By my Command Seal, withdraw from this battlefield!'}*** ❞\n\n` +
                    `🔮 **Auto-Consume Enabled:**\n` +
                    `Master possessed **${seals}/3 Command Seals**. 1 Command Seal was automatically expended to trigger emergency spatial evacuation!\n\n` +
                    `• 🔴 **Command Seals Remaining:** **${remainingSeals}/3**\n` +
                    `• ❤️ **Preserved Vitality:** **1 HP** (Emergency evacuation to Sanctuary)\n` +
                    `• 🛡️ **Tournament Standing:** Active (Contract Preserved, Elimination Averted!)`,
                  color: '#f59e0b',
                  footer: 'Command Seal Sanctuary Protocol'
                },
                components: {
                  type: 'buttons',
                  items: [
                    { id: 'quick_war_status', label: 'View Intelligence Board (/grailwar)', style: 'primary' as const, emoji: '📋' },
                    { id: 'quick_start_duel', label: 'Enter Arena (/duel)', style: 'danger' as const, emoji: '⚔️' }
                  ]
                }
              });
              return;
            } else if (seals >= 1) {
              // 1-minute decision window (Auto-consume is OFF by default)
              addMessage({
                id: getNextId('bot_duel_flee_decision'),
                sender: 'bot',
                timestamp: 'Just now',
                embed: {
                  title: '⚠️ CRITICAL DEFEAT — COMMAND SEAL DECISION',
                  description:
                    `**${p1.name}** failed to escape (${fleeCalc.chancePercent}% chance) and suffered a mortal counter-strike from **${p2.name}**!\n\n` +
                    `💬 **[MORTAL BLOW] ${p1.name}:**\n> ❝ ***${p1DefeatQuote}*** ❞\n\n` +
                    `🔮 **Command Seal Evacuation Available:** Master possesses **${seals}/3 Command Seals**.\n` +
                    `You may expend **1 Command Seal** to emergency-teleport your Servant to safety preserved at **1 HP**, preventing contract severance and Holy Grail War elimination.\n\n` +
                    `⏱️ **Time Limit:** You have **1 minute (60 seconds)** to decide. If time expires, defeat is automatically accepted.\n` +
                    `*(Auto-consume option is OFF by default to protect your Command Seals)*`,
                  color: '#f59e0b',
                  footer: 'Holy Grail War Survival Protocol • 1-Minute Decision Window (Auto-consume: OFF)'
                },
                components: {
                  type: 'buttons',
                  items: [
                    { id: 'duel_evacuate_seal', label: `Use Command Seal to Run (${seals}/3)`, style: 'danger' as const, emoji: '🔮' },
                    { id: 'duel_accept_defeat', label: 'Take Defeat', style: 'secondary' as const, emoji: '💀' }
                  ]
                }
              });
              return;
            } else {
              // 0 Command Seals remaining — permanent elimination
              const outcome = recordDuelOutcome(
                grailWar,
                updatedState.player2.masterName,
                master.username,
                'kill',
                activeChannel === 'public' ? 'holy-grail-war' : 'direct-messages',
                updatedState.player2.currentHp,
                0
              );
              onUpdateGrailWar(outcome.updatedWar);
              setActiveDuel(null);

              addMessage({
                id: getNextId('bot_duel_flee_fail_fatal'),
                sender: 'bot',
                timestamp: 'Just now',
                embed: {
                  title: '☠️ RETREAT FAILED — LETHAL COUNTER-STRIKE!',
                  description:
                    `**${p1.name}** failed to escape (${fleeCalc.chancePercent}% chance) and suffered an undefended fatal strike from **${p2.name}**!\n\n` +
                    `💬 **[DEFEAT] ${p1.name}:**\n> ❝ ***${p1DefeatQuote}*** ❞\n\n` +
                    `💀 **Mandatory Command Seal Check:** **0/3 Command Seals remaining.**\n` +
                    `With no Command Seals left to execute emergency evacuation, your contract dissolves and you have been **PERMANENTLY ELIMINATED** from the Holy Grail War!`,
                  color: '#ef4444',
                  footer: 'Combat Engine • Fatal Counter-Strike • 0 Seals Remaining'
                },
                components: {
                  type: 'buttons',
                  items: [
                    { id: 'quick_war_status', label: 'View Intelligence Board (/grailwar)', style: 'primary' as const, emoji: '📋' },
                    { id: 'war_reset_tournament', label: 'Restart Tournament Session', style: 'secondary' as const, emoji: '🔄' }
                  ]
                }
              });
              return;
            }
          }

          // Player survived the failed flee counter-strike
          setActiveDuel({ battle: updatedState });

          const nextFleeCalc = calculateFleeChance(
            updatedState.player1.currentHp,
            updatedState.player1.maxHp,
            updatedState.player1.servantClass,
            activeServant?.template.baseStats?.agility || 10
          );

          addMessage({
            id: getNextId('bot_duel_flee_fail'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: `❌ TACTICAL RETREAT FAILED — TURN CONSUMED (${fleeCalc.chancePercent}%)`,
              description:
                `**${p1.name}** could not break away! Turn consumed — **${p2.name}** took advantage and struck an undefended blow!\n\n` +
                `❤️ **${p1.name} HP:** ${updatedState.player1.currentHp.toLocaleString()}/${updatedState.player1.maxHp.toLocaleString()}\n` +
                `❤️ **${p2.name} HP:** ${updatedState.player2.currentHp.toLocaleString()}/${updatedState.player2.maxHp.toLocaleString()}\n\n` +
                `👉 **Turn ${updatedState.currentTurn}:** Select your next action:`,
              color: '#ef4444',
              footer: 'Combat Engine • Turn Consumed • 2,000 DMG Counter-Strike'
            },
            canvasType: 'battle',
            canvasPayload: { log: failLog, p1: updatedState.player1, p2: updatedState.player2 },
            components: {
              type: 'buttons',
              items: [
                { id: 'duel_card_bbb', label: 'Buster Brave', style: 'danger', emoji: '🔴' },
                { id: 'duel_card_aaa', label: 'Arts Chain', style: 'primary', emoji: '🔵' },
                { id: 'duel_card_qqq', label: 'Quick Chain (+20 Stars & Crits)', style: 'success', emoji: '🟢' },
                {
                  id: 'duel_use_np',
                  label: `Noble Phantasm (${Math.round(updatedState.player1.npGauge)}%)`,
                  style: 'danger',
                  emoji: '💥',
                  disabled: updatedState.player1.npGauge < 100
                },
                { id: 'duel_act_alliance_assist', label: 'Alliance Assist (+25%)', style: 'primary', emoji: '🛡️' },
                { id: 'duel_prompt_forcejoin', label: '⚡ Force Join', style: 'danger', emoji: '🚨' },
                {
                  id: 'duel_flee',
                  label: `Flee (${nextFleeCalc.chancePercent}%)`,
                  style: 'secondary',
                  emoji: '🏃'
                }
              ]
            }
          });
          return;
        }
      }

      if (btnId === 'duel_evacuate_seal') {
        const seals = master.commandSeals ?? 3;
        if (seals >= 1) {
          const remainingSeals = Math.max(0, seals - 1);
          onUpdateMaster({
            ...master,
            commandSeals: remainingSeals
          });
          const uWar = { ...grailWar };
          if (uWar.participants[master.discordId]) {
            uWar.participants[master.discordId].currentHp = 1;
            uWar.participants[master.discordId].isAlive = true;
            uWar.participants[master.discordId].commandSeals = remainingSeals;
          }
          onUpdateGrailWar(uWar);
          setActiveDuel(null);

          addMessage({
            id: getNextId('bot_duel_seal_evac_success'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '🔴 COMMAND SEAL EMERGENCY EVACUATION',
              description:
                `Master **${master.username}** invoked a Command Seal decree!\n` +
                `> 🔱 ❝ ***${activeServant?.customQuotes?.commandSeal || 'By my Command Seal, withdraw from this battlefield!'}*** ❞\n\n` +
                `✨ **Emergency Spatial Relocation:**\n` +
                `The Command Seal burned with radiant crimson prana, tearing open a leyline corridor and evacuating your Servant to the Church Sanctuary!\n\n` +
                `• 🔴 **Command Seals Remaining:** **${remainingSeals}/3** (1 expended)\n` +
                `• ❤️ **Preserved Vitality:** **1 HP** (Sanctuary Asylum Active)\n` +
                `• 🛡️ **Tournament Standing:** Active (Contract Preserved, Elimination Averted!)`,
              color: '#f59e0b',
              footer: 'Holy Grail War Protocol • Command Seal Sanctuary'
            },
            components: {
              type: 'buttons',
              items: [
                { id: 'quick_war_status', label: 'View Intelligence Board (/grailwar)', style: 'primary', emoji: '📋' },
                { id: 'quick_war_defenses', label: 'Mage Defenses (/defenses)', style: 'secondary', emoji: '🏰' }
              ]
            }
          });
        }
        return;
      }

      if (btnId === 'duel_evacuate_seal_p2') {
        const rivalMasterName = activeDuel?.battle.player2.masterName || 'itsderpo';
        const rivalParticipant = Object.values(grailWar.participants).find(
          p => p.username.toLowerCase() === rivalMasterName.toLowerCase() || p.discordId === activeDuel?.battle.player2.id
        );
        const rivalSeals = rivalParticipant?.commandSeals ?? 3;
        if (rivalSeals >= 1) {
          const remainingSeals = Math.max(0, rivalSeals - 1);
          const uWar = { ...grailWar };
          if (rivalParticipant && uWar.participants[rivalParticipant.discordId]) {
            uWar.participants[rivalParticipant.discordId].currentHp = 1;
            uWar.participants[rivalParticipant.discordId].isAlive = true;
            uWar.participants[rivalParticipant.discordId].commandSeals = remainingSeals;
            uWar.participants[rivalParticipant.discordId].inSanctuary = true;
          }
          onUpdateGrailWar(uWar);
          setActiveDuel(null);

          addMessage({
            id: getNextId('bot_duel_seal_evac_p2'),
            sender: 'bot',
            timestamp: 'Just now',
            embed: {
              title: '🔴 COMMAND SEAL EMERGENCY EVACUATION',
              description:
                `Defeated Master **${rivalMasterName}** invoked a Command Seal to run!\n\n` +
                `✨ **Emergency Spatial Relocation:**\n` +
                `The Command Seal flared brilliant crimson, immediately evacuating **${activeDuel?.battle.player2.name || 'Servant'}** to Church Sanctuary preserved at **1 HP**!\n\n` +
                `• 🔴 **Command Seals Remaining:** **${remainingSeals}/3** (1 expended)\n` +
                `• ❤️ **Preserved Vitality:** **1 HP** (Sanctuary Asylum Active)\n` +
                `• 🛡️ **Tournament Standing:** Active (Contract Preserved, Elimination Averted!)`,
              color: '#f59e0b',
              footer: 'Holy Grail War Protocol • Command Seal Sanctuary'
            },
            components: {
              type: 'buttons',
              items: [
                { id: 'quick_war_status', label: 'View Intelligence Board (/grailwar)', style: 'primary' as const, emoji: '📋' }
              ]
            }
          });
        }
        return;
      }

      if (btnId === 'duel_accept_defeat_p2') {
        const rivalMasterName = activeDuel?.battle.player2.masterName || 'itsderpo';
        const rivalServantName = activeDuel?.battle.player2.name || 'Scáthach';
        const p1VictoryQuote = activeServant?.customQuotes?.victory || activeServant?.template.victoryQuote || "A decisive triumph. The Holy Grail draws closer.";

        // Prompt victor with Kill or Spare choice
        addMessage({
          id: getNextId('bot_duel_fate_prompt'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '🏆 DUEL VICTORY — DECIDE MASTER\'S FATE',
            description:
              `Master **${rivalMasterName}** took defeat and chose not to run!\n\n` +
              `**${activeDuel?.battle.player1.name || 'Servant'}** (Master: ${master.username}) has defeated **${rivalServantName}** (Master: ${rivalMasterName}) in the Holy Grail duel!\n\n` +
              `💬 **[VICTORY INVOCATION] ${activeDuel?.battle.player1.name}:**\n> ❝ ***${p1VictoryQuote}*** ❞\n\n` +
              `⚖️ **The Fate of Master ${rivalMasterName} is in your hands:**\n` +
              `Choose whether to **Execute** the fallen Master to permanently eliminate them from the Holy Grail War, or show mercy and **Spare** their life.`,
            color: '#22c55e',
            footer: 'Select an execution decision below:'
          },
          canvasType: 'dialogue',
          canvasPayload: {
            speaker: activeDuel?.battle.player1.name || 'Servant',
            quote: p1VictoryQuote,
            title: 'VICTORY INVOCATION',
            servantClass: activeDuel?.battle.player1.servantClass || 'Saber',
            avatarUrl: activeDuel?.battle.player1.avatarUrl || activeServant?.template.cardArtUrl || activeServant?.template.avatarUrl,
            bondOrLevel: activeServant?.bondLevel || 10,
            defenderName: rivalServantName,
            defenderClass: activeDuel?.battle.player2.servantClass || 'Enemy',
            defenderAvatarUrl: activeDuel?.battle.player2.avatarUrl || 'https://i.imgur.com/hyNsgc1.jpeg',
            sequence: ['Buster', 'Buster', 'Buster'],
            bgUrlOrPreset: 'fuyuki'
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'duel_fate_kill', label: '☠️ Execute Master (Kill & Eliminate)', style: 'danger', emoji: '☠️' },
              { id: 'duel_fate_spare', label: '🕊️ Spare Master (Show Mercy)', style: 'success', emoji: '🕊️' }
            ]
          }
        });
        return;
      }

      if (btnId === 'duel_accept_defeat') {
        const rivalMaster = activeDuel?.battle.player2.masterName || 'itsderpo';
        const rivalServantName = activeDuel?.battle.player2.name || 'Scáthach';
        const p1DefeatQuote = activeServant?.customQuotes?.defeat || activeServant?.template.defeatQuote || "Master... I have failed you in this Holy Grail War...";

        const outcome = recordDuelOutcome(
          grailWar,
          rivalMaster,
          master.username,
          'kill',
          activeChannel === 'public' ? 'holy-grail-war' : 'direct-messages',
          activeDuel?.battle.player2.currentHp,
          0
        );
        onUpdateGrailWar(outcome.updatedWar);
        setActiveDuel(null);

        const aliveMastersCount = Object.values(outcome.updatedWar.participants).filter(p => p.isAlive).length;

        addMessage({
          id: getNextId('bot_duel_defeat_accepted'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: '☠️ DEFEAT ACCEPTED — MASTER ELIMINATED',
            description:
              `Master **${master.username}** chose to accept defeat in the Holy Grail War.\n\n` +
              `💬 **[CONTRACT DISSOLVED] ${activeServant?.template.name}:**\n> ❝ ***${p1DefeatQuote}*** ❞\n\n` +
              `💀 Master **${rivalMaster}** (${rivalServantName}) has claimed victory. Your spiritual core has been absorbed into the Lesser Grail.\n\n` +
              `🔮 **Command Seals:** Kept intact (0 consumed).\n` +
              `👥 **Surviving Masters:** **${aliveMastersCount}/7** alive in Fuyuki City.`,
            color: '#ef4444',
            footer: 'Holy Grail War Elimination • Deceased'
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

        let bountyRewardText = '';
        let extraSq = 0;
        let extraCs = 0;
        const defeatedParticipant = outcome.defeatedMaster || Object.values(grailWar.participants).find(
          p => p.username.toLowerCase() === rivalMaster.toLowerCase()
        );

        if (decision === 'kill' && defeatedParticipant && (defeatedParticipant.bountyActive || (defeatedParticipant.innocentKills || 0) >= 10)) {
          extraSq = 15;
          extraCs = 1;
          bountyRewardText =
            `\n\n🏆 **CHURCH EXTERMINATION BOUNTY CLAIMED!**\n` +
            `Father Kotomine has rewarded you for purging the Rogue Heretic **${rivalMaster}**:\n` +
            `• **+1 Command Seal** 💠 (Consecrated Sigil Restored)\n` +
            `• **+15 Saint Quartz** 💎 (Church Treasury Payout)`;
        }

        onUpdateMaster({
          ...master,
          servants: updatedServants,
          saintQuartz: master.saintQuartz + 3 + extraSq,
          commandSeals: Math.min(3, (master.commandSeals || 0) + extraCs),
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
                `• +2 Parameter Points 📊` +
                bountyRewardText,
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

        setActiveNpMsgId(npMsgId);
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

        setActiveNpMsgId(aiNpMsgId);
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
        setActiveNpMsgId(null);

        const isWin = updatedState.turnPhase === 'victory';

        if (isWin) {
          const rivalMasterName = updatedState.player2.masterName;
          const rivalParticipant = Object.values(grailWar.participants).find(
            p => p.username.toLowerCase() === rivalMasterName.toLowerCase() || p.discordId === updatedState.player2.id
          );
          const rivalSeals = rivalParticipant?.commandSeals ?? 3;
          const rivalAutoConsume = rivalParticipant?.autoEvadeEnabled === true || rivalParticipant?.autoConsumeCommandSeal === true;
          const p2DefeatQuote = rivalParticipant?.servantName ? `${rivalParticipant.servantName} has fallen in combat...` : "Master... I have failed you in this Holy Grail War...";

          if (rivalSeals >= 1 && rivalAutoConsume) {
            const remainingSeals = Math.max(0, rivalSeals - 1);
            const uWar = { ...grailWar };
            if (rivalParticipant && uWar.participants[rivalParticipant.discordId]) {
              uWar.participants[rivalParticipant.discordId].currentHp = 1;
              uWar.participants[rivalParticipant.discordId].isAlive = true;
              uWar.participants[rivalParticipant.discordId].commandSeals = remainingSeals;
              uWar.participants[rivalParticipant.discordId].inSanctuary = true;
            }
            onUpdateGrailWar(uWar);
            setActiveDuel(null);

            addMessage({
              id: getNextId('bot_duel_defeat_saved_p2'),
              sender: 'bot',
              timestamp: 'Just now',
              embed: {
                title: '🔴 COMMAND SEAL AUTOMATIC EVACUATION',
                description:
                  `**${updatedState.player1.name}** (Master: ${master.username}) dealt a mortal blow to **${updatedState.player2.name}**!\n\n` +
                  `🔮 **Auto-Consume Triggered:**\n` +
                  `Defeated Master **${rivalMasterName}** possessed **${rivalSeals}/3 Command Seals**. 1 Command Seal was automatically expended to trigger emergency spatial evacuation to Sanctuary!\n\n` +
                  `• 🔴 **Command Seals Remaining:** **${remainingSeals}/3**\n` +
                  `• ❤️ **Preserved Vitality:** **1 HP** (Emergency evacuation to Church Sanctuary)\n` +
                  `• 🛡️ **Tournament Standing:** Active (Contract Preserved, Elimination Averted!)`,
                color: '#f59e0b',
                footer: 'Command Seal Emergency Evacuation Protocol'
              },
              canvasType: 'defeat_dialogue',
              canvasPayload: {
                speaker: updatedState.player2.name,
                quote: p2DefeatQuote,
                title: 'COMMAND SEAL EVACUATION',
                servantClass: updatedState.player2.servantClass,
                avatarUrl: updatedState.player2.avatarUrl,
                bondOrLevel: 10,
                defenderName: updatedState.player1.name,
                defenderClass: updatedState.player1.servantClass,
                defenderAvatarUrl: updatedState.player1.avatarUrl || activeServant?.template.cardArtUrl || activeServant?.template.avatarUrl,
                sequence: ['Quick', 'Quick', 'Quick'],
                bgUrlOrPreset: 'fuyuki'
              },
              components: {
                type: 'buttons',
                items: [
                  { id: 'quick_war_status', label: 'View Intelligence Board (/grailwar)', style: 'primary', emoji: '📋' },
                  { id: 'quick_start_duel', label: 'Enter Arena (/duel)', style: 'danger', emoji: '⚔️' }
                ]
              }
            });
          } else if (rivalSeals >= 1) {
            // Defeated Master gets the last chance to use Command Seal to run or take defeat!
            setActiveDuel({ battle: updatedState });

            addMessage({
              id: getNextId('bot_duel_defeat_decision_p2'),
              sender: 'bot',
              timestamp: 'Just now',
              embed: {
                title: '⚠️ CRITICAL DEFEAT — COMMAND SEAL DECISION',
                description:
                  `**${updatedState.player1.name}** (Master: ${master.username}) dealt a mortal blow to **${updatedState.player2.name}** (Master: ${rivalMasterName})!\n\n` +
                  `💬 **[MORTAL BLOW] ${updatedState.player2.name}:**\n> ❝ ***${p2DefeatQuote}*** ❞\n\n` +
                  `🔮 **Command Seal Evacuation Available:** Defeated Master **${rivalMasterName}** possesses **${rivalSeals}/3 Command Seals**.\n` +
                  `When a Master loses, they get a last chance to expend **1 Command Seal** to run and emergency-teleport their Servant to Sanctuary preserved at **1 HP**, or take defeat.\n\n` +
                  `⏱️ **Time Limit:** You have **1 minute (60 seconds)** to decide. If time expires or defeat is taken, the victor will decide their fate.\n` +
                  `*(Auto-consume option is OFF by default to protect your Command Seals)*`,
                color: '#f59e0b',
                footer: 'Holy Grail War Survival Protocol • 1-Minute Decision Window (Auto-consume: OFF)'
              },
              canvasType: 'defeat_dialogue',
              canvasPayload: {
                speaker: updatedState.player2.name,
                quote: p2DefeatQuote,
                title: 'CRITICAL DEFEAT DECISION',
                servantClass: updatedState.player2.servantClass,
                avatarUrl: updatedState.player2.avatarUrl,
                bondOrLevel: 10,
                defenderName: updatedState.player1.name,
                defenderClass: updatedState.player1.servantClass,
                defenderAvatarUrl: updatedState.player1.avatarUrl || activeServant?.template.cardArtUrl || activeServant?.template.avatarUrl,
                sequence: ['Quick', 'Quick', 'Quick'],
                bgUrlOrPreset: 'fuyuki'
              },
              components: {
                type: 'buttons',
                items: [
                  { id: 'duel_evacuate_seal_p2', label: `Use Command Seal to Run (${rivalSeals}/3)`, style: 'danger', emoji: '🔮' },
                  { id: 'duel_accept_defeat_p2', label: 'Take Defeat', style: 'secondary', emoji: '💀' }
                ]
              }
            });
          } else {
            // 0 Command Seals remaining: Winner immediately decides fate!
            const p1VictoryQuote = activeServant?.customQuotes?.victory || activeServant?.template.victoryQuote || "A decisive triumph. The Holy Grail draws closer.";

            addMessage({
              id: getNextId('bot_duel_fate_prompt'),
              sender: 'bot',
              timestamp: 'Just now',
              embed: {
                title: '🏆 DUEL VICTORY — DECIDE MASTER\'S FATE',
                description:
                  `**${updatedState.player1.name}** (Master: ${master.username}) has defeated **${updatedState.player2.name}** (Master: ${updatedState.player2.masterName}) in the Holy Grail duel!\n\n` +
                  `💬 **[VICTORY INVOCATION] ${updatedState.player1.name}:**\n> ❝ ***${p1VictoryQuote}*** ❞\n\n` +
                  `⚖️ **The Fate of Master ${updatedState.player2.masterName} is in your hands:**\n` +
                  `The defeated Master has **0 Command Seals** remaining. Choose whether to **Execute** the fallen Master to permanently eliminate them from the Holy Grail War, or show mercy and **Spare** their life.`,
                color: '#22c55e',
                footer: 'Select an execution decision below:'
              },
              canvasType: 'dialogue',
              canvasPayload: {
                speaker: updatedState.player1.name,
                quote: p1VictoryQuote,
                title: 'VICTORY INVOCATION',
                servantClass: updatedState.player1.servantClass,
                avatarUrl: updatedState.player1.avatarUrl || activeServant?.template.cardArtUrl || activeServant?.template.avatarUrl,
                bondOrLevel: activeServant?.bondLevel || 10,
                defenderName: updatedState.player2.name,
                defenderClass: updatedState.player2.servantClass,
                defenderAvatarUrl: updatedState.player2.avatarUrl,
                sequence: ['Buster', 'Buster', 'Buster'],
                bgUrlOrPreset: 'fuyuki'
              },
              components: {
                type: 'buttons',
                items: [
                  { id: 'duel_fate_kill', label: '☠️ Execute Master (Kill & Eliminate)', style: 'danger', emoji: '☠️' },
                  { id: 'duel_fate_spare', label: '🕊️ Spare Master (Show Mercy)', style: 'success', emoji: '🕊️' }
                ]
              }
            });
          }
        } else {
          // Player defeated by opponent (e.g. itsderpo)
          const seals = master.commandSeals ?? 3;
          const p1DefeatQuote = activeServant?.customQuotes?.defeat || activeServant?.template.defeatQuote || "Master... I have failed you in this Holy Grail War...";
          const autoConsume = grailWar.participants[master.discordId]?.autoEvadeEnabled === true || master.autoConsumeCommandSeal === true;

          if (seals >= 1 && autoConsume) {
            const remainingSeals = Math.max(0, seals - 1);
            onUpdateMaster({
              ...master,
              commandSeals: remainingSeals
            });
            const uWar = { ...grailWar };
            if (uWar.participants[master.discordId]) {
              uWar.participants[master.discordId].currentHp = 1;
              uWar.participants[master.discordId].isAlive = true;
              uWar.participants[master.discordId].commandSeals = remainingSeals;
            }
            onUpdateGrailWar(uWar);
            setActiveDuel(null);

            addMessage({
              id: getNextId('bot_duel_defeat_saved'),
              sender: 'bot',
              timestamp: 'Just now',
              embed: {
                title: '🔴 COMMAND SEAL AUTOMATIC EVACUATION',
                description:
                  `**${updatedState.player2.name}** (Master: ${updatedState.player2.masterName}) dealt a mortal blow to **${updatedState.player1.name}**!\n\n` +
                  `💬 **[MORTAL BLOW] ${updatedState.player1.name}:**\n> ❝ ***${p1DefeatQuote}*** ❞\n\n` +
                  `🔮 **Auto-Consume Enabled:**\n` +
                  `Master **${master.username}** had **${seals}/3 Command Seals** remaining. 1 Command Seal was automatically expended to trigger emergency spatial evacuation!\n\n` +
                  `• 🔴 **Command Seals Remaining:** **${remainingSeals}/3**\n` +
                  `• ❤️ **Preserved Vitality:** **1 HP** (Emergency evacuation to Sanctuary)\n` +
                  `• 🛡️ **Tournament Standing:** Active (Contract Preserved, Elimination Averted!)`,
                color: '#f59e0b',
                footer: 'Command Seal Emergency Evacuation Protocol'
              },
              canvasType: 'defeat_dialogue',
              canvasPayload: {
                speaker: updatedState.player1.name,
                quote: p1DefeatQuote,
                title: 'COMMAND SEAL EVACUATION',
                servantClass: updatedState.player1.servantClass,
                avatarUrl: updatedState.player1.avatarUrl || activeServant?.template.cardArtUrl || activeServant?.template.avatarUrl,
                bondOrLevel: activeServant?.bondLevel || 10,
                defenderName: updatedState.player2.name,
                defenderClass: updatedState.player2.servantClass,
                defenderAvatarUrl: updatedState.player2.avatarUrl,
                sequence: ['Quick', 'Quick', 'Quick'],
                bgUrlOrPreset: 'fuyuki'
              },
              components: {
                type: 'buttons',
                items: [
                  { id: 'quick_war_status', label: 'View Intelligence Board (/grailwar)', style: 'primary', emoji: '📋' },
                  { id: 'quick_start_duel', label: 'Enter Arena (/duel)', style: 'danger', emoji: '⚔️' }
                ]
              }
            });
          } else if (seals >= 1) {
            // 1-minute decision window (Auto-consume is OFF by default)
            addMessage({
              id: getNextId('bot_duel_defeat_decision'),
              sender: 'bot',
              timestamp: 'Just now',
              embed: {
                title: '⚠️ CRITICAL DEFEAT — COMMAND SEAL DECISION',
                description:
                  `**${updatedState.player2.name}** (Master: ${updatedState.player2.masterName}) dealt a mortal blow to **${updatedState.player1.name}**!\n\n` +
                  `💬 **[MORTAL BLOW] ${updatedState.player1.name}:**\n> ❝ ***${p1DefeatQuote}*** ❞\n\n` +
                  `🔮 **Command Seal Evacuation Available:** Master possesses **${seals}/3 Command Seals**.\n` +
                  `You may expend **1 Command Seal** to emergency-teleport your Servant away from mortal danger, preserved at **1 HP**!\n\n` +
                  `⏱️ **Time Limit:** You have **1 minute (60 seconds)** to decide before contract dissolves. If time expires without an action, defeat is automatically accepted.\n` +
                  `*(Auto-consume option is OFF by default to protect your Command Seals)*`,
                color: '#f59e0b',
                footer: 'Holy Grail War Survival Protocol • 1-Minute Decision Window (Auto-consume: OFF)'
              },
              canvasType: 'defeat_dialogue',
              canvasPayload: {
                speaker: updatedState.player1.name,
                quote: p1DefeatQuote,
                title: 'CRITICAL DEFEAT DECISION',
                servantClass: updatedState.player1.servantClass,
                avatarUrl: updatedState.player1.avatarUrl || activeServant?.template.cardArtUrl || activeServant?.template.avatarUrl,
                bondOrLevel: activeServant?.bondLevel || 10,
                defenderName: updatedState.player2.name,
                defenderClass: updatedState.player2.servantClass,
                defenderAvatarUrl: updatedState.player2.avatarUrl,
                sequence: ['Quick', 'Quick', 'Quick'],
                bgUrlOrPreset: 'fuyuki'
              },
              components: {
                type: 'buttons',
                items: [
                  { id: 'duel_evacuate_seal', label: `Use Command Seal to Run (${seals}/3)`, style: 'danger', emoji: '🔮' },
                  { id: 'duel_accept_defeat', label: 'Take Defeat', style: 'secondary', emoji: '💀' }
                ]
              }
            });
          } else {
            const outcome = recordDuelOutcome(
              grailWar,
              updatedState.player2.masterName,
              master.username,
              'kill',
              activeChannel === 'public' ? 'holy-grail-war' : 'direct-messages',
              updatedState.player2.currentHp,
              0
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
                  `💬 **[DEFEAT & RETREAT] ${updatedState.player1.name}:**\n> ❝ ***${p1DefeatQuote}*** ❞\n\n` +
                  `💀 **Mandatory Command Seal Check:** **0/3 Command Seals remaining.**\n` +
                  `With no Command Seals remaining to invoke emergency evacuation, your contract dissolves and you have been **PERMANENTLY ELIMINATED** from the Holy Grail War.\n` +
                  `Your status on the Intelligence Board is now **💀 DECEASED** (HP: 0/${grailWar.participants[master.discordId]?.maxHp || 11000}).\n\n` +
                  `👥 **Surviving Masters:** **${aliveCount}/7** alive in Fuyuki.`,
                color: '#ef4444',
                footer: '0 Command Seals Remaining • You have been eliminated from the Holy Grail War'
              },
              canvasType: 'defeat_dialogue',
              canvasPayload: {
                speaker: updatedState.player1.name,
                quote: p1DefeatQuote,
                title: 'DEFEAT & CONTRACT SEVERED',
                servantClass: updatedState.player1.servantClass,
                avatarUrl: updatedState.player1.avatarUrl || activeServant?.template.cardArtUrl || activeServant?.template.avatarUrl,
                bondOrLevel: activeServant?.bondLevel || 10,
                defenderName: updatedState.player2.name,
                defenderClass: updatedState.player2.servantClass,
                defenderAvatarUrl: updatedState.player2.avatarUrl,
                sequence: ['Quick', 'Quick', 'Quick'],
                bgUrlOrPreset: 'fuyuki'
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
        }
      } else {
        const dQuote = lastLog?.dialogueQuote || (lastLog?.isNoblePhantasm ? lastLog?.npChant : undefined);
        const dialogueBox = dQuote ? `\n\n💬 **[${lastLog?.dialogueTag || 'COMBAT DIALOGUE'}] ${lastLog?.dialogueTitle || updatedState.player1.name}:**\n> ❝ ***${dQuote}*** ❞` : '';

        const fleeTurnCalc = calculateFleeChance(
          updatedState.player1.currentHp,
          updatedState.player1.maxHp,
          updatedState.player1.servantClass,
          activeServant?.template.baseStats?.agility || 10
        );

        addMessage({
          id: getNextId('bot_duel_turn'),
          sender: 'bot',
          timestamp: 'Just now',
          embed: {
            title: `⚔️ TURN ${updatedState.currentTurn} CLASH SUMMARY`,
            description: `👉 **Current Turn:** Select your next Command Card sequence or Noble Phantasm:${dialogueBox}`,
            color: '#ef4444',
            footer: 'Holy Grail War • Turn-based RPG Combat Engine'
          },
          canvasType: 'battle',
          canvasPayload: {
            log: lastLog,
            p1: updatedState.player1,
            p2: updatedState.player2,
            p1Ally: updatedState.teamA?.[1],
            p2Ally: updatedState.teamB?.[1],
            teamA: updatedState.teamA,
            teamB: updatedState.teamB
          },
          components: {
            type: 'buttons',
            items: [
              { id: 'duel_card_bbb', label: 'Buster Brave', style: 'danger', emoji: '🔴' },
              { id: 'duel_card_aaa', label: 'Arts Chain', style: 'primary', emoji: '🔵' },
              { id: 'duel_card_qqq', label: 'Quick Chain (+20 Stars & Crits)', style: 'success', emoji: '🟢' },
              {
                id: 'duel_use_np',
                label: `Noble Phantasm (${Math.round(updatedState.player1.npGauge)}%)`,
                style: 'danger',
                emoji: '💥',
                disabled: updatedState.player1.npGauge < 100
              },
              { id: 'duel_act_alliance_assist', label: 'Alliance Assist (+25%)', style: 'primary', emoji: '🛡️' },
              { id: 'duel_prompt_forcejoin', label: '⚡ Force Join', style: 'danger', emoji: '🚨' },
              {
                id: 'duel_flee',
                label: `Flee (${fleeTurnCalc.chancePercent}%)`,
                style: 'secondary',
                emoji: '🏃'
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
        onUpdateMaster({ ...master, boundedField: 'none' });
      } else if (btnId === 'ward_ward') {
        const res = executeWarAction(currentWar, master.discordId, 'set_ward', 'ward');
        currentWar = res.updatedWar;
        actionMsg = res.message;
        onUpdateGrailWar(currentWar);
        onUpdateMaster({ ...master, boundedField: 'ward' });
      } else if (btnId === 'ward_alarm') {
        const res = executeWarAction(currentWar, master.discordId, 'set_ward', 'alarm');
        currentWar = res.updatedWar;
        actionMsg = res.message;
        onUpdateGrailWar(currentWar);
        onUpdateMaster({ ...master, boundedField: 'alarm' });
      } else if (btnId === 'toggle_auto_evade') {
        const curMode = currentWar.participants[master.discordId]?.autoEvadeEnabled === true ? 'off' : 'on';
        const res = executeWarAction(currentWar, master.discordId, 'toggle_evade', curMode);
        currentWar = res.updatedWar;
        actionMsg = res.message;
        onUpdateGrailWar(currentWar);
        onUpdateMaster({ ...master, autoConsumeCommandSeal: curMode === 'on' });
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
      const evadeOn = uP?.autoEvadeEnabled === true;
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
            `🔴 **Command Seal Emergency Evacuation (Auto-consume):**\n` +
            (evadeOn
              ? `• **🟢 ENABLED:** When taking fatal damage, automatically consumes **1 Command Seal** to escape with **1 HP**.\n`
              : `• **🔴 DISABLED (Default):** Auto-consume is OFF. You retain full control to manually invoke Command Seals or decide during combat.\n`) +
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
              label: evadeOn ? 'Auto-Evac: ON 🟢' : 'Auto-Evac: OFF (Default) 🔴',
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
        setInputCommand('/attack ');
        setIsInputFocused(true);
        return;
      }

      if (btnId === 'war_leak_prompt') {
        setInputCommand('/grailwar leak ');
        return;
      }

      if (btnId === 'war_rest') {
        const result = executeWarAction(grailWar, master.discordId, 'rest_and_heal');
        onUpdateGrailWar(result.updatedWar);
        if (result.success && activeServant) {
          const updatedHp = result.updatedWar.participants[master.discordId]?.currentHp;
          if (updatedHp !== undefined) {
            const updatedServants = master.servants.map(s => s.id === activeServant.id ? {
              ...s,
              currentHp: updatedHp,
              baseHpAtDamage: updatedHp,
              lastDamageTime: Date.now()
            } : s);
            onUpdateMaster({ ...master, servants: updatedServants });
          }
        }

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

      if (btnId === 'open_traps_hub_modal_btn') {
        setShowTrapsMenuModal(true);
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

  const userParticipant = grailWar.participants[master.discordId] ||
    Object.values(grailWar.participants).find(p => p.username.toLowerCase() === master.username.toLowerCase());
  const isUserExposed = userParticipant?.isExposed;
  const isUserInSanctuary = !!(userParticipant?.inSanctuary || (userParticipant as any)?.inChurchSanctuary);

  return (
    <div id="discord_emulator_container" className="flex flex-col h-full bg-[#0a0a0a] text-[#dbdee1] rounded-xl overflow-hidden border border-[#1a1a1a] shadow-2xl">
      {/* Discord Header Bar with Channel Switcher & Sector Radar */}
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
              <span>{activePublicSector.replace('#', '')}</span>
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

          {/* Sector Selector Dropdown for Public Frontlines */}
          {activeChannel === 'public' && (
            <div className="relative flex items-center gap-1">
              <div className="relative flex items-center">
                <select
                  id="fuyuki_channel_sector_select"
                  value={activePublicSector}
                  onChange={(e) => {
                    const newSector = e.target.value;
                    setActivePublicSector(newSector);
                    const activeTrap = (grailWar.channelTraps || []).find(t => t.channelName.toLowerCase() === newSector.toLowerCase());
                    let trapStatusNote = '✨ Leylines clear (0/1 active Bounded Fields).';
                    if (activeTrap) {
                      trapStatusNote = activeTrap.setterMasterId === master.discordId
                        ? `⚠️ ${activeTrap.trapType === 'alarm' ? '🚨 Alarm Ward' : '🩸 Bloodfort Drain'} is anchored here by you.`
                        : `⚠️ Occupied by rival Master ${activeTrap.setterUsername}.`;
                    }
                    addMessage({
                      id: getNextId('channel_switched'),
                      sender: 'bot',
                      timestamp: 'Just now',
                      embed: {
                        title: `📍 Switched Sector: ${newSector}`,
                        description: `You are now operating in **${newSector}**.\n${trapStatusNote}\n*Channel traps and patrols in this channel will now affect this sector.*`,
                        color: '#d4af37'
                      }
                    });
                  }}
                  className="bg-[#141414] hover:bg-[#1a1a1a] text-[#d4af37] border border-[#d4af37]/40 rounded px-2.5 py-1 text-xs font-mono appearance-none cursor-pointer focus:outline-none pr-6 transition max-w-[190px] truncate"
                  title="Select active Discord text channel"
                >
                  {effectiveChannels.map(sec => {
                    const trapInSec = (grailWar.channelTraps || []).find(t => t.channelName.toLowerCase() === sec.id.toLowerCase());
                    let tag = '';
                    if (trapInSec) {
                      tag = trapInSec.setterMasterId === master.discordId
                        ? ` [${trapInSec.trapType === 'alarm' ? '🚨' : '🩸'} YOUR WARD]`
                        : ' [🔒 OCCUPIED]';
                    }
                    return (
                      <option key={sec.id} value={sec.id} className="bg-[#141414] text-white">
                        {sec.emoji} {sec.id}{tag}
                      </option>
                    );
                  })}
                </select>
                <div className="pointer-events-none absolute right-2 text-[#d4af37] text-[10px]">▼</div>
              </div>

              <button
                id="add_discord_channel_btn"
                onClick={() => setShowAddChannelModal(true)}
                className="px-2 py-1 text-xs font-mono font-bold rounded bg-[#141414] hover:bg-[#202020] text-[#d4af37] border border-[#d4af37]/40 hover:border-[#d4af37] transition cursor-pointer flex items-center gap-1"
                title="Add an actual Discord channel from your server"
              >
                <span>+</span>
                <span className="hidden sm:inline text-[11px] font-normal">Channel</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Active Bounded Fields Tracker Badge */}
          {(() => {
            const userTraps = (grailWar.channelTraps || []).filter(t => t.setterMasterId === master.discordId);
            return (
              <button
                id="header_bounded_fields_radar_btn"
                onClick={() => setShowTrapsMenuModal(true)}
                className={`px-2.5 py-1 text-[11px] font-mono font-medium rounded-sm border flex items-center gap-1.5 transition cursor-pointer ${
                  userTraps.length > 0
                    ? 'bg-[#200830] text-purple-300 border-purple-500/40 hover:bg-[#2e0c45]'
                    : 'bg-[#141414] text-white/50 border-white/10 hover:text-white/80'
                }`}
                title="Click to open Dedicated Bounded Fields & Traps Menu"
              >
                <span>🕸️</span>
                <span>
                  Bounded Fields: <strong className="text-white">{userTraps.length}/3</strong>
                  {userTraps.length > 0 && (
                    <span className="text-purple-300 ml-1 font-semibold">
                      ({userTraps.map(t => `${t.channelName} ${t.trapType === 'alarm' ? '🚨' : '🩸'}`).join(', ')})
                    </span>
                  )}
                </span>
              </button>
            );
          })()}

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

                const cleanContent = mediaUrl
                  ? msg.content.replace(mediaUrl, '').trim()
                  : msg.content;

                return (
                  <div className="space-y-2 mt-1.5">
                    {cleanContent && (
                      <div className="text-white/90 text-xs whitespace-pre-wrap leading-relaxed font-sans">
                        {cleanContent}
                      </div>
                    )}
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

              {/* Discord Interactive Components (Select Menu + Buttons) */}
              {msg.components && (
                <div className="flex flex-col gap-2 mt-3">
                  {/* Select Dropdown / Multi-Select if present */}
                  {msg.components.selectOptions && msg.components.selectOptions.length > 0 && (() => {
                    const isFeedMenu = msg.components?.selectOptions?.some(opt => opt.value.startsWith('servant_sel_feed_ce_') || opt.value.startsWith('feed_ce_'));
                    const selectedValues = multiSelectState[msg.id] || [];

                    if (isFeedMenu) {
                      const allOptions = msg.components.selectOptions;
                      const handleToggle = (val: string) => {
                        setMultiSelectState(prev => {
                          const curr = prev[msg.id] || [];
                          return {
                            ...prev,
                            [msg.id]: curr.includes(val) ? curr.filter(x => x !== val) : [...curr, val]
                          };
                        });
                      };

                      const handleSelectLow = () => {
                        const lowVals = allOptions.filter(o => o.label.includes('[★1]') || o.label.includes('[★2]') || o.label.includes('[★3]')).map(o => o.value);
                        setMultiSelectState(prev => ({ ...prev, [msg.id]: lowVals }));
                      };

                      const handleSelectDupes = () => {
                        // Protect 5-stars: only duplicate 1-4 stars
                        const labelCounts = new Map<string, number>();
                        allOptions.forEach(o => {
                          const baseName = o.label.replace(/\[★\d\]\s*/, '').trim();
                          labelCounts.set(baseName, (labelCounts.get(baseName) || 0) + 1);
                        });
                        const seen = new Set<string>();
                        const dupeVals: string[] = [];
                        allOptions.forEach(o => {
                          if (o.label.includes('[★5]')) return; // Safe 5-star protection
                          const baseName = o.label.replace(/\[★\d\]\s*/, '').trim();
                          if ((labelCounts.get(baseName) || 0) > 1) {
                            if (seen.has(baseName)) {
                              dupeVals.push(o.value);
                            } else {
                              seen.add(baseName);
                            }
                          }
                        });
                        setMultiSelectState(prev => ({ ...prev, [msg.id]: dupeVals }));
                      };

                      const handleSelectAll = () => {
                        setMultiSelectState(prev => ({ ...prev, [msg.id]: allOptions.map(o => o.value) }));
                      };

                      const handleClear = () => {
                        setMultiSelectState(prev => ({ ...prev, [msg.id]: [] }));
                      };

                      const handleConfirmFeed = () => {
                        if (selectedValues.length === 0) return;
                        const targets = selectedValues.map(v => v.replace('servant_sel_feed_ce_', '').replace('feed_ce_', ''));
                        handleButtonClick(`servant_multi_feed_ce:${targets.join(',')}`);
                        setMultiSelectState(prev => ({ ...prev, [msg.id]: [] }));
                      };

                      return (
                        <div className="w-full max-w-xl bg-[#0f0f0f] border border-[#a855f7]/40 rounded-lg p-3 space-y-2.5 font-mono text-xs shadow-md">
                          <div className="flex items-center justify-between flex-wrap gap-1 border-b border-[#222] pb-2">
                            <span className="text-[#a855f7] font-bold flex items-center gap-1.5">
                              <span>🧪</span> Multi-Select CEs to Synthesize ({selectedValues.length}/{allOptions.length} selected)
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={handleSelectLow}
                                className="px-2 py-0.5 rounded bg-[#1c1427] hover:bg-[#281b3a] text-[#c084fc] text-[10px] border border-[#a855f7]/30 font-semibold"
                              >
                                ⚡ 1-3★ All
                              </button>
                              <button
                                type="button"
                                onClick={handleSelectDupes}
                                className="px-2 py-0.5 rounded bg-[#1c1427] hover:bg-[#281b3a] text-[#38bdf8] text-[10px] border border-[#38bdf8]/30 font-semibold"
                              >
                                🔄 Dupes (Safe)
                              </button>
                              <button
                                type="button"
                                onClick={handleSelectAll}
                                className="px-2 py-0.5 rounded bg-[#1c1427] hover:bg-[#281b3a] text-white/80 text-[10px] border border-[#444]"
                              >
                                All
                              </button>
                              {selectedValues.length > 0 && (
                                <button
                                  type="button"
                                  onClick={handleClear}
                                  className="px-2 py-0.5 rounded bg-[#2a1111] hover:bg-[#3a1111] text-[#ef4444] text-[10px] border border-[#ef4444]/30"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                            {allOptions.map(opt => {
                              const isSelected = selectedValues.includes(opt.value);
                              return (
                                <div
                                  key={opt.value}
                                  onClick={() => handleToggle(opt.value)}
                                  className={`flex items-center justify-between px-2.5 py-1.5 rounded cursor-pointer transition border text-[11px] ${
                                    isSelected
                                      ? 'bg-[#a855f7]/20 border-[#a855f7] text-white'
                                      : 'bg-[#151515] hover:bg-[#1f1f1f] border-[#252525] text-white/70'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <span className={`w-3.5 h-3.5 flex items-center justify-center rounded-sm text-[9px] border ${isSelected ? 'bg-[#a855f7] text-black border-[#a855f7] font-bold' : 'border-white/30 text-transparent'}`}>
                                      ✓
                                    </span>
                                    <span className="font-semibold text-white truncate">{opt.label}</span>
                                    {opt.description && (
                                      <span className="text-white/40 text-[10px] truncate hidden sm:inline">
                                        • {opt.description}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-white/50">
                              {selectedValues.length > 0 ? `Selected: ${selectedValues.length} Craft Essence${selectedValues.length > 1 ? 's' : ''}` : 'Click items above to toggle selection'}
                            </span>
                            <button
                              type="button"
                              disabled={selectedValues.length === 0}
                              onClick={handleConfirmFeed}
                              className="px-3 py-1.5 rounded bg-[#a855f7] hover:bg-[#9333ea] text-black font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                            >
                              <span>✨</span> Synthesize Selected ({selectedValues.length})
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="relative w-full max-w-md">
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleButtonClick(e.target.value);
                              e.target.value = '';
                            }
                          }}
                          className="w-full bg-[#161616] hover:bg-[#1f1f1f] text-[#d4af37] border border-[#d4af37]/40 rounded px-3 py-2 text-xs font-mono appearance-none cursor-pointer focus:outline-none focus:border-[#d4af37] transition-all shadow-sm pr-8"
                        >
                          <option value="" disabled className="text-white/40 bg-[#161616]">
                            {msg.components.placeholder || '🔍 Select an entry...'}
                          </option>
                          {msg.components.selectOptions.map((opt) => (
                            <option key={opt.value} value={opt.value} className="text-white bg-[#1a1a1a]">
                              {opt.emoji ? `${opt.emoji} ` : ''}{opt.label}{opt.description ? ` — ${opt.description}` : ''}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-[#d4af37] text-xs">
                          ▼
                        </div>
                      </div>
                    );
                  })()}

                  {/* Button Actions */}
                  {msg.components.items && msg.components.items.length > 0 && (
                    <div className="flex flex-wrap gap-2">
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
                            {s.servantClass}
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
                { cmd: '/patrol', desc: '👁️ Stealth patrol Fuyuki sectors to detect concealed traps & Bounded Fields safely' },
                { cmd: '/petrol', desc: '👁️ Stealth patrol Fuyuki sectors to detect concealed traps & Bounded Fields safely' },
                { cmd: '/trap', desc: '🕸️ Conceal Bounded Field traps in specific channels' },
                { cmd: '/trap set type:alarm channel:#channel', desc: '🚨 Conceal an Alarm Ward in a specific channel' },
                { cmd: '/trap set type:drain channel:#channel', desc: '🩸 Conceal a Bloodfort Drain Bounded Field in a channel' },
                { cmd: '/trap disarm [channel]', desc: '🧹 Disarm Bounded Fields in a specific channel or across all sectors' },
                { cmd: '/trap list', desc: '📍 View where your active channel Bounded Fields are deployed' },
                { cmd: '/traps', desc: '📡 Open Fuyuki Leyline Radar and manage channel Bounded Fields' },
                { cmd: '/grailwar', desc: '🏆 Holy Grail War 7-Master intelligence & operations hub' },
                { cmd: '/grailwar traps', desc: '🕸️ Holy Grail War Bounded Field traps & Leyline radar' },
                { cmd: '/grailwar familiars', desc: '🦅 Manage deployed scout familiars & channel surveillance' },
                { cmd: '/familiar <raven|homunculus|shadow_imp>', desc: '🦅 Deploy scout familiars across Fuyuki channels' },
                { cmd: '/familiars', desc: '🦅 Manage deployed scout familiars & channel surveillance' },
                { cmd: '/dialogue', desc: '🎬 Visual Novel dialogue cut-in animation with battlefield stage & slash' },
                { cmd: '/servant', desc: '⚔️ Inspect your contracted Heroic Spirit stats, parameters, and radar' },
                { cmd: '/servants list', desc: '📜 Browse all registered spirits in the Throne of Heroes' },
                { cmd: '/servants search <name>', desc: '🔍 Search spirits by name, class, NP, or lore' },
                { cmd: '/servants view <name>', desc: '👤 View full profile card, voice lines, and artwork of a Spirit' },
                { cmd: '/summon ritual', desc: '✨ Perform Holy Grail War summoning ritual' },
                { cmd: '/duel', desc: '⚔️ Open Combat Arena lobby & match queue' },
                { cmd: '/duel 2v2', desc: '🛡️ 2v2 Alliance Tag-Team Clash with partner Master' },
                { cmd: '/duel 1v2', desc: '⚔️ 1v2 Raid Clash solo survival against two foes' },
                { cmd: '/duel forcejoin', desc: '🚨 Force join ongoing combat arena as 3rd Master' },
                { cmd: '/duel <target>', desc: '⚔️ Enter tactical combat with a rival Master or Servant' },
                { cmd: '/attack <target>', desc: '🗡️ Ambush suspected Master (if innocent, bystander dies & you are exposed!)' },
                { cmd: '/ambush <target>', desc: '🗡️ Covert ambush strike on suspected Master or server user' },
                { cmd: '/grailwar status', desc: '🏆 Check Holy Grail War 7-Master intelligence roster' },
                { cmd: '/grailwar attack <target>', desc: '🗡️ Ambush suspected rival Master on the war board' },
                { cmd: '/grailwar leak <intel>', desc: '📡 Broadcast intel or deception to the war board' },
                { cmd: '/grailwar patrol', desc: '👁️ Patrol Fuyuki sectors for enemy signatures' },
                { cmd: '/daily', desc: '💎 Claim daily Master allowance of 30 Saint Quartz (SQ)' },
                { cmd: '/inventory', desc: '🛡️ Manage Craft Essences, items, and equipment' },
                { cmd: '/customise stats', desc: '📈 Allocate earned parameter points into STR, END, AGI, MNA, LCK' },
                { cmd: '/customise equip', desc: '👔 Attach or swap Craft Essences to boost passives' },
                { cmd: '/cegacha', desc: '🔮 Summon Craft Essences using Saint Quartz' },
                { cmd: '/church', desc: '⛪ Enter neutral Church Sanctuary protection under Father Kotomine' },
                { cmd: '/defenses', desc: '🏰 Manage workshop Bounded Field warding fields & auto-evac' },
                { cmd: '/profile', desc: '👑 View Master status, Command Seals, and mana reserves' },
                { cmd: '/heal', desc: '💚 Perform workshop leyline healing ritual' },
                { cmd: '/admin npanim <servant> <url>', desc: '⚙️ Configure custom NP animated GIF (Admin)' },
                { cmd: '/admin npsettings', desc: '⚙️ Configure NP auto-delete and turn duration settings' },
                { cmd: '/addservant create', desc: '🪄 Register a new custom Heroic Spirit' },
                { cmd: '/addservant edit <name>', desc: '✏️ Modify stats, dialogue, or artwork of any servant' }
              ];

              const filteredSlashCommands = slashCommands.filter(c => {
                const cmdRoot = c.cmd.split(' ')[0].toLowerCase();
                if (cmdRoot.startsWith(q)) return true;
                if (c.cmd.toLowerCase().startsWith(q)) return true;
                const cleanQ = q.replace('/', '');
                if (cleanQ.length >= 2 && (cmdRoot.includes(cleanQ) || c.desc.toLowerCase().includes(cleanQ))) return true;
                return false;
              });

              const isServantSearchContext = q.startsWith('/servant') || q.startsWith('/addservant') || q.startsWith('/duel') || q.startsWith('/dialogue');
              const searchClean = isServantSearchContext ? q
                .replace(/\/addservant\s*(edit|delete|create)?/gi, '')
                .replace(/\/servants?\s*(search|view|list)?/gi, '')
                .replace(/\/dialogue/gi, '')
                .replace(/\/duel/gi, '')
                .replace(/servant_id[:=]/gi, '')
                .replace(/[\/]/g, '')
                .trim() : '';

              const spiritMatches = isServantSearchContext ? allThrone.filter(s => {
                if (!searchClean) {
                  return isEditing; // If typing /addservant edit without args, show top spirits to edit
                }
                return matchServantSearch(s, searchClean);
              }).slice(0, 5) : [];

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
                              <span className="ml-1.5 text-[10px] text-white/50">({s.servantClass})</span>
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

                  {filteredSlashCommands.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="px-2 py-0.5 text-[10px] text-white/40 font-bold uppercase tracking-wider">
                        Suggested Commands:
                      </div>
                      {filteredSlashCommands.slice(0, 8).map(c => (
                        <button
                          key={c.cmd}
                          onMouseDown={e => {
                            e.preventDefault();
                            if (c.cmd.includes('<')) {
                              setInputCommand(c.cmd.split('<')[0]);
                            } else if (c.cmd.includes('[')) {
                              setInputCommand(c.cmd.split('[')[0]);
                            } else if (c.cmd.includes('channel:#channel')) {
                              setInputCommand(c.cmd.replace('channel:#channel', 'channel:#'));
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
            placeholder="Type /trap, /attack @user, /ambush <name>, /duel, /summon ritual, /servant..."
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
            id="quick_traps_menu_btn"
            onClick={() => setShowTrapsMenuModal(true)}
            className="px-2.5 py-0.5 rounded bg-[#1c0c28] hover:bg-[#2c1340] text-purple-300 border border-purple-500/40 whitespace-nowrap font-semibold transition flex items-center gap-1 cursor-pointer"
          >
            <span>🕸️</span>
            <span>Traps &amp; Wards Menu</span>
          </button>
          <button
            onClick={() => handleCommand('/dialogue')}
            className="px-2 py-0.5 rounded bg-[#161616] hover:bg-[#252525] text-amber-300 border border-amber-500/30 whitespace-nowrap transition"
          >
            🎬 /dialogue cut-in
          </button>
          <button
            onClick={() => handleCommand('/daily')}
            className="px-2 py-0.5 rounded bg-[#141414] hover:bg-[#222] text-cyan-300 border border-cyan-500/30 whitespace-nowrap transition"
          >
            💎 /daily
          </button>
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
            onClick={() => handleCommand('/attack')}
            className="px-2 py-0.5 rounded bg-[#141414] hover:bg-[#222] text-rose-300 border border-rose-500/30 whitespace-nowrap transition"
          >
            🗡️ /attack
          </button>
          <button
            onClick={() => handleCommand('/grailwar')}
            className="px-2 py-0.5 rounded bg-[#141414] hover:bg-[#222] text-blue-300 border border-blue-500/30 whitespace-nowrap transition"
          >
            🏆 /grailwar
          </button>
        </div>
      </div>

      {/* Add Custom Discord Channel Modal */}
      {showAddChannelModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#d4af37]/50 rounded-xl p-5 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <span>💬</span> Connect Discord Channel
              </h3>
              <button
                onClick={() => {
                  setShowAddChannelModal(false);
                  setNewChannelNameInput('');
                }}
                className="text-zinc-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-zinc-300 mb-3 leading-relaxed">
              Enter the name of any text channel from your Discord server (e.g. <code>#war-room</code>, <code>#announcements</code>, <code>#general-chat</code>).
            </p>
            <input
              type="text"
              placeholder="#channel-name"
              value={newChannelNameInput}
              onChange={(e) => setNewChannelNameInput(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-zinc-700 focus:border-[#d4af37] rounded px-3 py-2 text-xs text-white font-mono mb-4 outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCustomChannel();
              }}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddChannelModal(false);
                  setNewChannelNameInput('');
                }}
                className="px-3 py-1.5 text-xs rounded bg-[#202020] text-zinc-300 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomChannel}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-[#d4af37] text-black hover:bg-[#e6c258] transition cursor-pointer"
              >
                Connect Channel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED BOUNDED FIELDS & TRAPS MENU MODAL */}
      {showTrapsMenuModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#0d0d11] border border-purple-500/40 rounded-xl shadow-2xl overflow-hidden font-mono text-xs">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-[#1b0b2e] via-[#130b20] to-[#0d0d11] border-b border-purple-500/30 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-950/80 text-purple-300 border border-purple-500/50 shadow-inner">
                  <span className="text-base">🕸️</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white font-serif italic flex items-center gap-2">
                    <span>Territorial Traps &amp; Bounded Field Sanctum</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-900/60 text-purple-200 border border-purple-400/30 font-normal">
                      {(grailWar.channelTraps || []).filter(t => t.setterMasterId === master.discordId).length}/3 Armed
                    </span>
                  </h3>
                  <p className="text-[11px] text-purple-200/60 mt-0.5">
                    Deploy and monitor perimeter magecraft without typing slash commands.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTrapsMenuModal(false)}
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 overflow-y-auto space-y-4 max-h-[calc(90vh-130px)]">
              {/* 3 Dedicated Ward Slots Status */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Magecraft Slots</span>
                    <span className="text-white/40 text-[10px]">
                      ({(grailWar.channelTraps || []).filter(t => t.setterMasterId === master.discordId).length}/3 Active)
                    </span>
                  </span>
                  {(grailWar.channelTraps || []).filter(t => t.setterMasterId === master.discordId).length > 0 && (
                    <button
                      onClick={() => handleModalDisarmTrap(undefined)}
                      className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold underline cursor-pointer"
                    >
                      Disarm All Wards
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[0, 1, 2].map(slotIdx => {
                    const myTraps = (grailWar.channelTraps || []).filter(t => t.setterMasterId === master.discordId);
                    const trap = myTraps[slotIdx];
                    if (trap) {
                      const isAlarm = trap.trapType === 'alarm';
                      return (
                        <div
                          key={trap.id || slotIdx}
                          className={`p-3 rounded-lg border flex flex-col justify-between space-y-2 ${
                            isAlarm
                              ? 'bg-[#180f2c] border-purple-500/50 text-purple-200'
                              : 'bg-[#260a13] border-rose-500/50 text-rose-200'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-[9px] uppercase font-bold tracking-wider text-white/50">
                              Slot {slotIdx + 1} • {isAlarm ? '🚨 Alarm' : '🩸 Bloodfort'}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                              ARMED
                            </span>
                          </div>
                          <span className="font-bold text-white text-xs block truncate">
                            {trap.channelName}
                          </span>
                          <p className="text-[10px] text-white/60 leading-tight">
                            {isAlarm
                              ? 'Exposes rival Master & Servant true class on entry.'
                              : 'Drains 1,800–2,600 HP to heal your contracted Servant.'}
                          </p>
                          <button
                            onClick={() => handleModalDisarmTrap(trap.channelName)}
                            className="w-full py-1 text-[10px] rounded bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/40 font-semibold transition cursor-pointer"
                          >
                            🧹 Disarm Sector
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={slotIdx}
                        className="p-3 rounded-lg bg-[#08080a] border border-dashed border-white/15 flex flex-col justify-center items-center text-center space-y-1 min-h-[95px]"
                      >
                        <span className="text-[10px] text-white/40 font-medium">
                          ✨ Slot {slotIdx + 1} (Available)
                        </span>
                        <span className="text-[9px] text-white/30">
                          Ready to anchor
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick Deploy Form */}
              <div className="p-3.5 rounded-lg bg-[#121216] border border-white/10 space-y-3">
                <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider block">
                  ⚡ Quick Deploy Bounded Field
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Sector Picker */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-white/60 block">
                      Target Sector Channel:
                    </label>
                    <select
                      value={modalTrapChannel}
                      onChange={e => setModalTrapChannel(e.target.value)}
                      className="w-full bg-[#0a0a0c] text-[#d4af37] border border-white/20 focus:border-[#d4af37] rounded-md px-2.5 py-1.5 text-xs outline-none"
                    >
                      {effectiveChannels.map(sec => {
                        const existing = (grailWar.channelTraps || []).find(t => t.channelName.toLowerCase() === sec.id.toLowerCase());
                        let statusLabel = '✨ Clear';
                        if (existing) {
                          statusLabel = existing.setterMasterId === master.discordId
                            ? `🕸️ Armed by You (${existing.trapType})`
                            : `🔒 Rival (${existing.setterUsername})`;
                        }
                        return (
                          <option key={sec.id} value={sec.id} className="bg-[#0a0a0c] text-white">
                            {sec.id} ({sec.label}) — [{statusLabel}]
                          </option>
                        );
                      })}
                    </select>

                    <div className="flex items-center gap-1.5 pt-0.5">
                      <input
                        type="text"
                        value={modalCustomChannel}
                        onChange={e => setModalCustomChannel(e.target.value)}
                        placeholder="Or type custom (#channel)..."
                        className="flex-1 bg-[#0a0a0c] text-white border border-white/15 focus:border-[#d4af37] rounded px-2 py-1 text-[10px] outline-none placeholder-white/30"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (modalCustomChannel.trim()) {
                            const clean = modalCustomChannel.trim().startsWith('#') ? modalCustomChannel.trim() : `#${modalCustomChannel.trim()}`;
                            setModalTrapChannel(clean);
                            setModalCustomChannel('');
                          }
                        }}
                        className="px-2 py-1 text-[10px] bg-[#1a1a20] hover:bg-[#252530] text-[#d4af37] rounded border border-[#d4af37]/30 transition"
                      >
                        Use
                      </button>
                    </div>
                  </div>

                  {/* Type Choice */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-white/60 block">
                      Select Ward Magecraft:
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setModalTrapType('alarm')}
                        className={`p-2 rounded-md border text-left flex flex-col justify-between transition cursor-pointer ${
                          modalTrapType === 'alarm'
                            ? 'bg-[#1b1030] border-purple-500 text-purple-200 ring-1 ring-purple-500'
                            : 'bg-[#0a0a0c] border-white/10 text-white/50 hover:text-white'
                        }`}
                      >
                        <span className="font-bold text-[11px] flex items-center gap-1">
                          <span>🚨</span> Alarm Ward
                        </span>
                        <span className="text-[9px] text-white/50 mt-1 leading-tight">
                          Exposes intruder &amp; true class.
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setModalTrapType('bloodfort')}
                        className={`p-2 rounded-md border text-left flex flex-col justify-between transition cursor-pointer ${
                          modalTrapType === 'bloodfort'
                            ? 'bg-[#290812] border-rose-500 text-rose-200 ring-1 ring-rose-500'
                            : 'bg-[#0a0a0c] border-white/10 text-white/50 hover:text-white'
                        }`}
                      >
                        <span className="font-bold text-[11px] flex items-center gap-1">
                          <span>🩸</span> Bloodfort Drain
                        </span>
                        <span className="text-[9px] text-white/50 mt-1 leading-tight">
                          Siphons 1,800 HP to heal Servant.
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    id="modal_anchor_trap_btn"
                    disabled={(grailWar.channelTraps || []).filter(t => t.setterMasterId === master.discordId).length >= 3}
                    onClick={() => handleModalDeployTrap(modalTrapChannel, modalTrapType)}
                    className="px-4 py-2 rounded-md bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md disabled:opacity-40 transition cursor-pointer"
                  >
                    <span>⚡</span>
                    <span>Anchor {modalTrapType === 'alarm' ? 'Alarm Ward' : 'Bloodfort Drain'} in {modalTrapChannel}</span>
                  </button>

                  <button
                    onClick={() => handleModalTriggerIntrusionTest(modalTrapChannel)}
                    className="px-3 py-1.5 rounded-md bg-[#181820] hover:bg-[#22222e] text-amber-300 border border-amber-500/30 text-[11px] transition cursor-pointer"
                  >
                    <span>🎯</span>
                    <span>Test Intrusion in {modalTrapChannel}</span>
                  </button>
                </div>
              </div>

              {/* Leyline Radar Grid */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider block">
                  📡 Fuyuki Leyline Radar Overview
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {effectiveChannels.map(sec => {
                    const trap = (grailWar.channelTraps || []).find(t => t.channelName.toLowerCase() === sec.id.toLowerCase());
                    const isMyTrap = trap && trap.setterMasterId === master.discordId;
                    const isRivalTrap = trap && trap.setterMasterId !== master.discordId;
                    const userTrapsCount = (grailWar.channelTraps || []).filter(t => t.setterMasterId === master.discordId).length;

                    return (
                      <div
                        key={sec.id}
                        className={`p-2.5 rounded-md border flex flex-col justify-between space-y-1.5 ${
                          isMyTrap
                            ? 'bg-[#180e28] border-purple-500/40'
                            : isRivalTrap
                            ? 'bg-[#1c080e] border-rose-500/40'
                            : 'bg-[#0e0e11] border-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-[11px] flex items-center gap-1">
                            <span>{sec.emoji}</span>
                            <span>{sec.id}</span>
                          </span>
                          {isMyTrap ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-900/80 text-purple-200 border border-purple-400/40 font-semibold">
                              {trap.trapType === 'alarm' ? '🚨 MY ALARM' : '🩸 MY BLOODFORT'}
                            </span>
                          ) : isRivalTrap ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-500/40 font-semibold">
                              🔒 RIVAL WARD
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                              ✨ CLEAR
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[10px] pt-1 border-t border-white/10">
                          {isMyTrap ? (
                            <button
                              onClick={() => handleModalDisarmTrap(sec.id)}
                              className="w-full py-0.5 text-[10px] text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 rounded border border-rose-500/30 transition cursor-pointer text-center"
                            >
                              🧹 Disarm This Sector
                            </button>
                          ) : isRivalTrap ? (
                            <span className="text-[9px] text-white/40 italic">
                              Master {trap.setterUsername}&apos;s Territory
                            </span>
                          ) : (
                            <div className="grid grid-cols-2 gap-1 w-full">
                              <button
                                disabled={userTrapsCount >= 3}
                                onClick={() => handleModalDeployTrap(sec.id, 'alarm')}
                                className="py-0.5 text-[9px] text-purple-200 bg-purple-950/50 hover:bg-purple-900/70 rounded border border-purple-500/30 transition disabled:opacity-40 cursor-pointer text-center"
                              >
                                🚨 +Alarm
                              </button>
                              <button
                                disabled={userTrapsCount >= 3}
                                onClick={() => handleModalDeployTrap(sec.id, 'bloodfort')}
                                className="py-0.5 text-[9px] text-rose-200 bg-rose-950/50 hover:bg-rose-900/70 rounded border border-rose-500/30 transition disabled:opacity-40 cursor-pointer text-center"
                              >
                                🩸 +Bloodfort
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#0a0a0d] border-t border-white/10 flex items-center justify-between flex-shrink-0">
              <span className="text-[10px] text-white/40">
                Tip: When rival Masters type in your sectors, traps spring automatically in real-time.
              </span>
              <button
                onClick={() => setShowTrapsMenuModal(false)}
                className="px-4 py-1.5 rounded bg-[#202025] hover:bg-[#2d2d35] text-white text-xs font-semibold transition cursor-pointer"
              >
                Done / Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
