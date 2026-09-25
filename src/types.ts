// Core types for Holy Grail War / Gacha RPG Discord Bot and Web Engine

export type ServantClass =
  | 'Saber'
  | 'Archer'
  | 'Lancer'
  | 'Rider'
  | 'Caster'
  | 'Assassin'
  | 'Berserker'
  | 'Ruler'
  | 'Avenger'
  | 'Foreigner'
  | 'MoonCancer'
  | 'Shitposter'
  | 'Shielder';

export type Rarity = 1 | 2 | 3 | 4 | 5;

// Stat Balancing Modes:
// - 'archetype': Standardized Stat Budget based on canonical Fate parameters (STR/END/AGI/MNA/LCK) and combat role. All servants have equalized total combat rating!
// - 'flat': Pure Parity Baseline mode. All servants have strictly identical base HP (28,000) and base ATK (10,000). Victory is 100% tactical via cards, skills, NP, and class affinity.
export type StatBalanceMode = 'archetype' | 'flat';

export type CardType = 'Buster' | 'Arts' | 'Quick';

export interface ServantStats {
  strength: number;   // Affects Buster & raw physical ATK
  endurance: number;  // Affects Max HP & Damage Reduction
  agility: number;    // Affects Quick damage, Initiative & Crit Star Drop
  mana: number;       // Affects Arts damage, NP Gen & Skill Power
  luck: number;       // Affects Crit DMG & Debuff/Stun Resistance
}

export interface ServantSkill {
  id: string;
  name: string;
  cooldown: number;
  currentCooldown?: number;
  description: string;
  effectType: 'buff_atk' | 'buff_def' | 'heal' | 'np_charge' | 'crit_stars' | 'evade' | 'invincible' | 'stun' | 'debuff' | 'guts';
  value: number;
  duration: number;
  icon: string;
  quote?: string;
  quotes?: string[];
  transformationAvatarUrl?: string;
  transformationGifUrl?: string;
}

export type PassiveSkillType =
  | 'magic_resistance'
  | 'riding'
  | 'independent_action'
  | 'territory_creation'
  | 'item_construction'
  | 'presence_concealment'
  | 'madness_enhancement'
  | 'divinity'
  | 'avenger'
  | 'oblivion_correction'
  | 'the_weight_of_heaven'
  | 'fifth_succession'
  | 'absolute_permanence'
  | 'magic_gunner'
  | 'terra_affinity'
  | 'veteran_of_the_slums';

export interface PassiveSkill {
  name: string;
  type: PassiveSkillType;
  value: number;
  description: string;
  rank?: string;
}

export interface NoblePhantasm {
  name: string;
  cardType: CardType;
  chant: string;
  description: string;
  target: 'single' | 'aoe' | 'support';
  multiplier: number;
  overchargeEffect: string;
  animationUrl?: string;
  gifUrl?: string;
}

export interface CraftEssence {
  id: string;
  name: string;
  rarity: Rarity;
  description: string;
  atkBonus: number;
  hpBonus: number;
  bonusAtk?: number;
  bonusDef?: number;
  bonusHp?: number;
  effectText: string;
  passiveType: 'starting_np' | 'buster_up' | 'arts_up' | 'quick_up' | 'crit_dmg' | 'hp_regen' | string;
  passiveValue: number;
  artworkUrl?: string;
  isBondCe?: boolean;
  bondServantId?: string;
  bondServantName?: string;
}

export interface MatchupQuoteEntry {
  intro?: string;
  retort?: string;
  tag?: string;
}

export interface ServantTemplate {
  id: string;
  name: string;
  title: string;
  servantClass: ServantClass;
  rarity: Rarity;
  baseHp: number;
  baseAtk: number;
  baseStats: ServantStats;
  commandDeck: [CardType, CardType, CardType, CardType, CardType];
  skills: ServantSkill[];
  passives?: PassiveSkill[];
  noblePhantasm: NoblePhantasm;
  lore: string;
  summonQuote: string;
  battleStartQuote: string;
  victoryQuote: string;
  defeatQuote: string;
  avatarUrl: string;
  cardArtUrl: string;
  spriteUrl?: string; // High-res / dialogue character cutout sprite (used in VN dialogue and Bond scenes)
  aliases?: string[];
  traits?: string[];
  isCustomOrMeme?: boolean;
  matchupDialogues?: Record<string, MatchupQuoteEntry>;
}

export interface MasterServantInstance {
  id: string;
  masterId: string;
  templateId: string;
  nickname?: string;
  avatarUrl?: string;
  cardArtUrl?: string;
  spriteUrl?: string;
  level: number;
  experience: number;
  currentHp?: number;
  baseHpAtDamage?: number;
  lastDamageTime?: number;
  allocatedStats: ServantStats;
  availableStatPoints: number;
  equippedCeId?: string;
  equippedCe?: CraftEssence;
  skillLevels: [number, number, number];
  customQuotes: {
    summon?: string;
    battleStart?: string;
    noblePhantasm?: string;
    victory?: string;
    defeat?: string;
    busterChain?: string;
    artsChain?: string;
    quickChain?: string;
    skill?: string;
    commandSeal?: string;
    critHit?: string;
    matchups?: Record<string, MatchupQuoteEntry>;
  };
  bondLevel: number;
  bondExp?: number;
  bondCeGranted?: boolean;
  completedBondEvents?: string[];
  unlockedDialogueIds?: string[];
  npLevel?: number;
  template: ServantTemplate;
}

// Bond System & Visual Novel Types
export interface BondChoice {
  id: string;
  text: string;
  response: string;
  bondExpGain: number;
  reactionEmotion?: 'happy' | 'thoughtful' | 'surprised' | 'flustered' | 'determined' | 'amused' | 'stern' | 'smug' | 'angry' | 'excited';
  nextSceneId?: string;
}

export interface BondScene {
  id: string;
  speakerName?: string;
  speakerAvatarUrl?: string;
  backgroundTheme?: 'chaldea_room' | 'fuyuki_moonlight' | 'ebonwatch_realm' | 'dun_scaith' | 'camelot_court' | 'babylon_vault' | 'misaki_town' | string;
  dialogueText: string;
  choices?: BondChoice[];
}

export interface BondEvent {
  id: string;
  servantTemplateId: string; // servant template ID or 'generic'
  requiredBondLevel: number; // Level needed to unlock this event (e.g. 1, 2, 3... 10)
  title: string;
  subtitle: string;
  description: string;
  rewardBondExp: number;
  rewardSaintQuartz?: number;
  unlockedQuoteId?: string;
  unlockedCeId?: string;
  scenes: BondScene[];
}

export interface BondDialogueLine {
  id: string;
  title: string;
  category: 'summon' | 'bond_1' | 'bond_2' | 'bond_3' | 'bond_4' | 'bond_5' | 'bond_6' | 'bond_7' | 'bond_8' | 'bond_9' | 'bond_10' | 'battle' | 'special' | 'lore';
  requiredBondLevel: number;
  quoteText: string;
  audioPrompt?: string;
}

export type ApiProviderType =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'groq'
  | 'openrouter'
  | 'deepseek'
  | 'xai'
  | 'mistral'
  | 'together'
  | 'perplexity'
  | 'cerebras'
  | 'cohere'
  | 'nanogpt'
  | 'ollama'
  | 'custom';

export interface UserCustomApiConfig {
  activeProvider: ApiProviderType;
  openaiKey?: string;
  openaiModel?: string; // e.g. "gpt-4o", "gpt-4o-mini", "o3-mini", "o1", "gpt-4.5-preview"
  anthropicKey?: string;
  anthropicModel?: string; // e.g. "claude-3-7-sonnet-20250219", "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"
  geminiKey?: string;
  geminiModel?: string; // e.g. "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"
  groqKey?: string;
  groqModel?: string; // e.g. "llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"
  openrouterKey?: string;
  openrouterModel?: string; // e.g. "google/gemini-2.0-flash-exp:free", "meta-llama/llama-3.3-70b-instruct:free", "deepseek/deepseek-r1:free"
  deepseekKey?: string;
  deepseekModel?: string; // e.g. "deepseek-chat", "deepseek-reasoner"
  xaiKey?: string;
  xaiModel?: string; // e.g. "grok-2-1212", "grok-2-vision-1212", "grok-beta"
  mistralKey?: string;
  mistralModel?: string; // e.g. "mistral-small-latest", "open-mistral-7b"
  togetherKey?: string;
  togetherModel?: string; // e.g. "meta-llama/Llama-3.3-70B-Instruct-Turbo", "deepseek-ai/DeepSeek-R1"
  perplexityKey?: string;
  perplexityModel?: string; // e.g. "sonar-reasoning", "sonar-pro", "sonar"
  cerebrasKey?: string;
  cerebrasModel?: string; // e.g. "llama-3.3-70b", "llama3.1-8b"
  cohereKey?: string;
  cohereModel?: string; // e.g. "command-r-plus-08-2024", "command-r-08-2024"
  nanogptKey?: string;
  nanogptModel?: string; // e.g. "gpt-4o-mini", "chatgpt-4o-latest"
  ollamaEndpoint?: string; // default "http://localhost:11434/v1/chat/completions"
  ollamaModel?: string; // e.g. "llama3.2", "mistral", "qwen2.5:7b"
  customEndpoint?: string;
  customKey?: string;
  customModel?: string;
  enabled: boolean;
  lastTestedAt?: number;
  lastTestStatus?: 'success' | 'failed';
}

export interface MasterProfile {
  id: string;
  discordId: string;
  username: string;
  avatarUrl: string;
  saintQuartz: number;
  summonTickets: number;
  manaPrisms?: number;
  grailShards?: number;
  qp?: number;
  commandSeals: number;
  autoConsumeCommandSeal?: boolean;
  boundedField?: 'none' | 'ward' | 'alarm' | 'decoy';
  sanctuaryChannelName?: string;
  actionPoints: number;
  maxActionPoints: number;
  pityCount: number;
  grailWarWins: number;
  duelsWon?: number;
  duelsLost?: number;
  servantKills?: number;
  innocentKills?: number;
  reputationRank?: 'Honorable Magus' | 'Suspect Magus' | 'Notorious Magus' | 'Rogue Heretic';
  bountyActive?: boolean;
  bountyRewardSq?: number;
  isRogueHeretic?: boolean;
  homunculusCount?: number;
  lastDailyClaim?: number | string;
  activeServantId?: string;
  dailyTalkCount?: number;
  lastTalkDay?: string;
  lastTalkTimestamp?: number;
  dailySparCount?: number;
  lastSparDay?: string;
  lastSparTimestamp?: number;
  dailyTeaCount?: number;
  lastTeaDay?: string;
  lastTeaTimestamp?: number;
  customApiConfig?: UserCustomApiConfig;
  environmentMode?: 'safe' | 'war';
  servants: MasterServantInstance[];
  craftEssences: CraftEssence[];
}

export interface GachaBanner {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  featuredServantIds: string[];
  featuredCeIds: string[];
  bannerType: 'standard' | 'limited' | 'lore' | 'server_memes';
  costPerPull: number;
  costTenPull: number;
  bannerArtUrl: string;
  rates: {
    ssrServant: number;
    srServant: number;
    rServant: number;
    ssrCe: number;
    srCe: number;
    rCe: number;
  };
}

export interface GachaResultItem {
  type: 'servant' | 'craft_essence' | 'ce';
  rarity: Rarity | number;
  item: ServantTemplate | CraftEssence | any;
  isNew: boolean;
  isRateUp?: boolean;
}

// Combat Types
export interface ActiveCombatant {
  id: string;
  name: string;
  masterName: string;
  servantClass: ServantClass;
  avatarUrl: string;
  baseAvatarUrl?: string;
  isTransformed?: boolean;
  transformationTurns?: number;
  maxHp: number;
  currentHp: number;
  atk: number;
  def: number;
  stats: ServantStats;
  commandDeck: CardType[];
  npGauge: number;
  activeBuffs: Array<{
    name: string;
    type: 'buff_atk' | 'buff_def' | 'crit_rate' | 'evade' | 'invincible' | 'stun' | string;
    value: number;
    remainingTurns: number;
    remainingHits?: number;
    isHitCount?: boolean;
  }>;
  skills: Array<ServantSkill & { currentCooldown: number }>;
  passives?: PassiveSkill[];
  noblePhantasm: NoblePhantasm;
  isEvading?: boolean;
  isInvincible?: boolean;
  isStunned?: boolean;
  gutsCount?: number;
  critStars: number;
  bondLevel?: number;
  npLevel?: number;
  equippedCe?: CraftEssence;
  statBalanceMode?: StatBalanceMode;
  customQuotes?: MasterServantInstance['customQuotes'];
  templateId?: string;
  traits?: string[];
}

export type BattleCombatMode = '1v1' | '1v2' | '2v2' | '1v1v1' | 'ffa';

export interface TurnActionChoice {
  combatantId: string;
  targetId?: string; // Target combatant ID for multi-combatant (1v2, 2v2) engagements
  selectedCards: CardType[];
  useSkillIndex?: number;
  useNoblePhantasm?: boolean;
  useCommandSeal?: 'heal' | 'np_charge' | 'buff';
}

export interface CombatTurnLog {
  turnNumber: number;
  actorId: string;
  actorName: string;
  targetId: string;
  targetName: string;
  targetIndex?: number;
  targetIds?: string[];
  targetNames?: string[];
  isAoE?: boolean;
  allDamages?: Array<{
    targetId: string;
    targetName: string;
    damage: number;
    isEvaded?: boolean;
    isInvincible?: boolean;
    isCritical?: boolean;
    hpRemaining?: number;
  }>;
  actionSummary: string;
  cardChainType?: 'Buster Brave' | 'Arts Chain' | 'Quick Chain' | 'Normal';
  cardsUsed: ('Buster' | 'Arts' | 'Quick' | 'NP')[];
  p1Cards?: ('Buster' | 'Arts' | 'Quick' | 'NP')[];
  p1AllyCards?: ('Buster' | 'Arts' | 'Quick' | 'NP')[];
  p2Cards?: ('Buster' | 'Arts' | 'Quick' | 'NP')[];
  p2AllyCards?: ('Buster' | 'Arts' | 'Quick' | 'NP')[];
  skillsUsed: string[];
  npTriggered?: boolean;
  isNoblePhantasm?: boolean;
  npChant?: string;
  dialogueQuote?: string;
  dialogueTag?: string;
  dialogueTitle?: string;
  damageDealt: number;
  isCritical: boolean;
  isEvaded?: boolean;
  isInvincible?: boolean;
  starsGenerated: number;
  npCharged: number;
  actorHpRemaining: number;
  targetHpRemaining: number;
  actorHpMax: number;
  targetHpMax: number;
  actorNp: number;
  targetNp: number;
}

export interface BattleState {
  battleId: string;
  battleMode?: BattleCombatMode;
  teamA: ActiveCombatant[];
  teamB: ActiveCombatant[];
  player1: ActiveCombatant;
  player2: ActiveCombatant;
  player1Ally?: ActiveCombatant;
  player2Ally?: ActiveCombatant;
  currentTurn: number;
  turnPhase: 'card_selection' | 'action_resolution' | 'victory' | 'defeat' | 'fled' | 'evacuated';
  turnHistory: CombatTurnLog[];
  winnerId?: string;
  winnerTeam?: 'teamA' | 'teamB';
  grailWarId?: string;
  statBalanceMode?: StatBalanceMode;
  balanceMode?: StatBalanceMode;
  forceJoinedCombatants?: string[];
  teamSolo?: ActiveCombatant[];
}

export interface CombatBattleRecord {
  id: string;
  timestamp: number;
  outcome: 'victory' | 'defeat' | 'fled' | 'evacuated';
  battleMode?: BattleCombatMode;
  totalTurns: number;
  teamA?: Array<{
    id: string;
    name: string;
    servantClass: ServantClass;
    masterName: string;
    avatarUrl?: string;
    noblePhantasmName: string;
    finalHp: number;
    maxHp: number;
    atk: number;
    def: number;
  }>;
  teamB?: Array<{
    id: string;
    name: string;
    servantClass: ServantClass;
    masterName: string;
    avatarUrl?: string;
    noblePhantasmName: string;
    finalHp: number;
    maxHp: number;
    atk: number;
    def: number;
  }>;
  player1: {
    id: string;
    name: string;
    servantClass: ServantClass;
    masterName: string;
    avatarUrl?: string;
    noblePhantasmName: string;
    finalHp: number;
    maxHp: number;
    atk: number;
    def: number;
  };
  player2: {
    id: string;
    name: string;
    servantClass: ServantClass;
    masterName: string;
    avatarUrl?: string;
    noblePhantasmName: string;
    finalHp: number;
    maxHp: number;
    atk: number;
    def: number;
  };
  totalDamageDealt: number;
  totalDamageTaken: number;
  noblePhantasmsUsed: number;
  criticalHitsLanded: number;
  turns: CombatTurnLog[];
}

// Holy Grail War Tournament
export interface WarMasterParticipant {
  discordId: string;
  username: string;
  servantId: string;
  servantName: string;
  servantClass: ServantClass;
  avatarUrl: string;
  currentHp: number;
  maxHp: number;
  commandSeals: number;
  isAlive: boolean;
  isExposed?: boolean;
  exposureReason?: 'public_command' | 'ambush_clash' | 'innocent_assault' | 'intel_leak' | 'direct_combat' | string;
  innocentKills?: number;
  bountyActive?: boolean;
  bountyRewardSq?: number;
  isRogueHeretic?: boolean;
  reputationRank?: 'Honorable Magus' | 'Suspect Magus' | 'Notorious Magus' | 'Rogue Heretic';
  allianceId?: string;
  kills: number;
  boundedField?: 'none' | 'ward' | 'alarm' | 'decoy';
  sanctuaryChannelName?: string;
  autoEvadeEnabled?: boolean; // Default: false (OFF by default)
  autoConsumeCommandSeal?: boolean; // Default: false (OFF by default)
  lastAmbushTime?: number;
  lastAmbushedTime?: number;
  lastDamageTime?: number;
  baseHpAtDamage?: number;
  lastHealRitualTime?: number;
  gutsTriggered?: boolean;
  inSanctuary?: boolean;
  inChurchSanctuary?: boolean;
  sanctuaryEnteredAt?: number;
  deathTimestamp?: number;
  killedByMaster?: string;
  eliminatedBy?: string;
  fatalSkillUsed?: string;
  deathChannel?: string;
  eliminatedReason?: string;
}

export interface WarAlliance {
  id: string;
  name: string;
  memberMasterIds: string[];
  isSecret: boolean;
  betrayalRiskScore: number;
}

export interface ChannelBoundedTrap {
  id: string;
  channelName: string;
  setterMasterId: string;
  setterUsername: string;
  trapType: 'alarm' | 'drain';
  createdAt: number;
  expiresAt?: number;
  triggered?: boolean;
}

export interface ActiveFamiliar {
  id: string;
  masterId: string;
  masterUsername: string;
  channelName: string;
  familiarType: 'raven' | 'homunculus' | 'shadow_imp';
  createdAt: number;
  expiresAt: number;
  detectedIntel: string[];
}

export interface WarRules {
  preset: 'fuyuki_7' | 'apocrypha_14' | 'singularity_chaos' | 'desolate_hardcore' | 'custom';
  formatName: string;
  maxMasters: number;
  servantPool: 'canon_only' | 'all' | 'custom_only';
  classExclusivity: boolean;
  permadeath: boolean;
  startingCommandSeals: number;
  autoEvacuateAllowed: boolean;
  leylineDensity: 'standard' | 'fast' | 'desolate';
  churchAsylum: boolean;
  trapLimitPerMaster: number;
  factionMode?: boolean;
  factions?: {
    red?: string[];
    black?: string[];
    ruler?: string[];
  };
}

export interface WarHistoryRecord {
  warId: string;
  title: string;
  concludedAt: number;
  winnerMasterId?: string;
  winnerUsername?: string;
  winnerServantName?: string;
  totalParticipants: number;
  totalEliminations: number;
  rulesSummary: string;
}

export interface ChurchOverseerHomily {
  id: string;
  timestamp: number;
  periodHours: number; // e.g. 24
  title: string;
  subtitle: string;
  monologue: string;
  source: 'gemini' | 'canon_heuristic';
  statsSummary: {
    totalCasualties: number;
    fallenMastersCount: number;
    survivingMastersCount: number;
    rogueHereticsCount: number;
    asylumCount: number;
    totalDuelsAndAmbushes: number;
  };
  keyEvents: string[];
}

export interface FuyukiNewsBulletin {
  id: string;
  timestamp: number;
  periodHours: number; // e.g. 2
  headline: string;
  broadcastChannel: string;
  content: string;
  gasLeakCoverStory: string;
  bulletinPoints: string[];
  threatLevel: 'Low' | 'Moderate' | 'Severe' | 'Catastrophic';
  activeBountiesCount: number;
  source: 'gemini' | 'canon_heuristic';
}

export interface WarRecruitmentCall {
  id: string;
  active: boolean;
  channelId: string;
  messageId?: string;
  guildId?: string;
  startedAt: number;
  expiresAt: number; // Unix timestamp in ms; 0 if open indefinitely until manually triggered
  durationMinutes: number;
  maxSlots: number;
  presetKey: string;
  applicantIds: string[]; // List of Discord User IDs who inscribed their seals
  applicantServantChoices?: Record<string, string>; // Maps userId -> servantId chosen for the war
  initiatedBy: string; // Admin username
  initiatedById: string; // Admin discord ID
}

export interface HolyGrailWarSession {
  id: string;
  title: string;
  status: 'gathering' | 'active' | 'concluded';
  rules?: WarRules;
  recruitmentCall?: WarRecruitmentCall;
  participants: Record<string, WarMasterParticipant>;
  alliances: Record<string, WarAlliance>;
  channelTraps?: ChannelBoundedTrap[];
  familiars?: ActiveFamiliar[];
  latestChurchHomily?: ChurchOverseerHomily;
  latestNewsBulletin?: FuyukiNewsBulletin;
  homilyHistory?: ChurchOverseerHomily[];
  newsHistory?: FuyukiNewsBulletin[];
  civilianCasualties?: Array<{
    id: string;
    name: string;
    timestamp: number;
    slainByMasterId: string;
    slayerUsername?: string;
    servantName?: string;
    slayerServant?: string;
    slayerServantClass?: string;
    slayerDiscordId?: string;
    channelName?: string;
    cause?: string;
  }>;
  leakedIntel?: Array<{
    id: string;
    informantMasterId: string;
    informantMasterName?: string;
    exposedMasterName?: string;
    channelName?: string;
    intel: string;
    timestamp: number;
    targetMasterId?: string;
  }>;
  eventLogs: Array<{
    id: string;
    timestamp: number;
    text: string;
    type: 'clash' | 'alliance' | 'betrayal' | 'elimination' | 'heal' | 'ambush' | 'casualty' | 'exposure' | 'intel_leak' | 'cataclysm' | 'admin_reset' | string;
  }>;
  grailWinnerId?: string;
  history?: WarHistoryRecord[];
}

export interface WarActionResult {
  success: boolean;
  message: string;
  combatTriggered?: {
    opponentId: string;
    opponentName: string;
    isAmbush: boolean;
  };
  eliminatedMasterId?: string;
  isCollateralCasualty?: boolean;
  targetWasMaster?: boolean;
  targetMasterDiscordId?: string;
  targetMasterUsername?: string;
  wasAlreadyExposed?: boolean;
  exposedTargetMaster?: string;
  updatedWar: HolyGrailWarSession;
}

// Compatibility types for legacy structures
export interface ServantData {
  id: string;
  name: string;
  className: string;
  rarity: number;
  noblePhantasm: string;
  npType: string;
  atk: number;
  hp: number;
}

export interface MasterData {
  discordId: string;
  username: string;
  saintQuartz: number;
  actionPoints: number;
  commandSeals: number;
}
