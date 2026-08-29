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
  | 'Shitposter';

export type Rarity = 1 | 2 | 3 | 4 | 5;

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
  effectType: 'buff_atk' | 'buff_def' | 'heal' | 'np_charge' | 'crit_stars' | 'evade' | 'invincible' | 'stun';
  value: number;
  duration: number;
  icon: string;
}

export interface NoblePhantasm {
  name: string;
  cardType: CardType;
  chant: string;
  description: string;
  target: 'single' | 'aoe';
  multiplier: number;
  overchargeEffect: string;
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
  noblePhantasm: NoblePhantasm;
  lore: string;
  summonQuote: string;
  battleStartQuote: string;
  victoryQuote: string;
  defeatQuote: string;
  avatarUrl: string;
  cardArtUrl: string;
  isCustomOrMeme?: boolean;
}

export interface MasterServantInstance {
  id: string;
  masterId: string;
  templateId: string;
  nickname?: string;
  level: number;
  experience: number;
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
  };
  bondLevel: number;
  template: ServantTemplate;
}

export interface MasterProfile {
  id: string;
  discordId: string;
  username: string;
  avatarUrl: string;
  saintQuartz: number;
  summonTickets: number;
  commandSeals: number;
  actionPoints: number;
  maxActionPoints: number;
  pityCount: number;
  grailWarWins: number;
  activeServantId?: string;
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
  }>;
  skills: Array<ServantSkill & { currentCooldown: number }>;
  noblePhantasm: NoblePhantasm;
  isEvading?: boolean;
  isInvincible?: boolean;
  isStunned?: boolean;
  critStars: number;
}

export interface TurnActionChoice {
  combatantId: string;
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
  actionSummary: string;
  cardChainType?: 'Buster Brave' | 'Arts Chain' | 'Quick Chain' | 'Normal';
  cardsUsed: CardType[];
  skillsUsed: string[];
  npTriggered?: boolean;
  npChant?: string;
  damageDealt: number;
  isCritical: boolean;
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
  player1: ActiveCombatant;
  player2: ActiveCombatant;
  currentTurn: number;
  turnPhase: 'card_selection' | 'action_resolution' | 'victory' | 'defeat';
  turnHistory: CombatTurnLog[];
  winnerId?: string;
  grailWarId?: string;
}

// Holy Grail War Tournament
export type DistrictId =
  | 'fuyuki_church'
  | 'shinto_bridge'
  | 'ryuudou_temple'
  | 'homurahara_academy'
  | 'docks'
  | 'einzenbern_forest'
  | 'commercial_district'
  | string;

export interface WarDistrict {
  id: DistrictId;
  name: string;
  description: string;
  leylineBonus: 'mana_surge' | 'defensive_ward' | 'agility_scout' | 'crit_sanctuary' | 'command_seal_recovery' | string;
  controllingMasterId?: string;
  manaReserve: number;
}

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
  currentDistrict: DistrictId;
  allianceId?: string;
  ap: number;
  kills: number;
}

export interface WarAlliance {
  id: string;
  name: string;
  memberMasterIds: string[];
  isSecret: boolean;
  betrayalRiskScore: number;
  formedAtRound: number;
}

export interface HolyGrailWarSession {
  id: string;
  title: string;
  status: 'recruiting' | 'active' | 'climax' | 'concluded';
  currentRound: number;
  maxRounds: number;
  districts: Record<DistrictId, WarDistrict>;
  participants: Record<string, WarMasterParticipant>;
  alliances: Record<string, WarAlliance>;
  eventLogs: Array<{
    id: string;
    round: number;
    timestamp: number;
    text: string;
    type: 'scout' | 'clash' | 'alliance' | 'betrayal' | 'elimination' | 'leyline_capture' | string;
  }>;
  grailWinnerId?: string;
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
