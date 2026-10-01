import { ServantClass } from '../types';

export interface RaidBossPhaseConfig {
  phaseNumber: number;
  name: string;
  title: string;
  baseHp: number;
  maxCharge: number;
  spriteUrl: string;
  drawBox: {
    destX: number;
    destY: number;
    destW: number;
    destH: number;
  };
  passives: string[];
  breakQuote?: string;
  breakAnnouncement?: string;
}

export interface RaidBossConfig {
  id: string;
  name: string;
  title: string;
  servantClass: ServantClass;
  level: number;
  baseHp: number;
  maxCharge: number;
  traits: string[];
  avatarUrl: string;
  spriteUrl: string;
  bgUrl: string;
  spriteConfig: {
    offsetX: number;
    offsetY: number;
    scale: number;
    cropRightRatio: number;
  };
  phases?: RaidBossPhaseConfig[];
  totalPhases?: number;
  skills: {
    name: string;
    description: string;
    effect: 'atk_up' | 'def_down' | 'charge_up' | 'np_drain' | 'skill_seal' | 'aoe_curse' | 'buff_shorten' | 'barrier' | 'np_siphon';
    value: number;
    cooldown: number;
  }[];
  chargeAttack: {
    name: string;
    description: string;
    gifUrl?: string;
    damageMultiplier: number;
    ignoresInvincible?: boolean;
  };
  drops: {
    minSq: number;
    maxSq: number;
    servantExp: number;
    emberCount: number;
  };
}

export const RAID_BOSSES: Record<string, RaidBossConfig> = {
  barbatos: {
    id: 'barbatos',
    name: 'Demon God Pillar Barbatos',
    title: 'Observation Pillar • 72 Demon Gods of Solomon',
    servantClass: 'Caster',
    level: 90,
    baseHp: 1_200_000,
    maxCharge: 5,
    traits: ['threat_to_humanity', 'beast', 'demonic', 'giant', 'super_large', 'demon_god_pillar'],
    avatarUrl: 'https://ella.janitorai.com/media-approved/Y-F0QFOyK7CJ33x4tVufH.webp',
    spriteUrl: 'https://ella.janitorai.com/media-approved/CGFhQCyCSVrzWsWlBE-42.gif',
    bgUrl: 'https://ella.janitorai.com/media-approved/E4GsB0KvKGsUfJc8l7nBh.webp',
    spriteConfig: {
      offsetX: 40,
      offsetY: 60,
      scale: 1.15,
      cropRightRatio: 0.52
    },
    skills: [
      {
        name: 'Gaze of the Thousand Eyes',
        description: 'Lowers all enemies’ DEF by 20% and inflicts Skill Seal for 1 turn.',
        effect: 'def_down',
        value: 20,
        cooldown: 3
      },
      {
        name: 'Wailing of the Inverted Spire',
        description: 'Increases own ATK by 25% (2T) and charges NP gauge by 1 diamond.',
        effect: 'charge_up',
        value: 25,
        cooldown: 4
      },
      {
        name: 'Curse of the Solomon Throne',
        description: 'Inflicts Curse (1,200 DMG/Turn, 3T) and lowers ATK by 20% on the target Servant.',
        effect: 'aoe_curse',
        value: 20,
        cooldown: 3
      }
    ],
    chargeAttack: {
      name: 'Incineration Ritual: Barbatos Calamity',
      description: 'Barbatos opens its myriad crimson eyes, unleashing an apocalyptic wave of cursed demon god mana across the entire party!',
      damageMultiplier: 2.8
    },
    drops: {
      minSq: 10,
      maxSq: 20,
      servantExp: 25_000,
      emberCount: 3
    }
  },
  tiamat: {
    id: 'tiamat',
    name: 'Tiamat',
    title: 'Beast II • Primordial Mother of Genesis',
    servantClass: 'Beast',
    level: 95,
    baseHp: 3_500_000,
    maxCharge: 5,
    totalPhases: 3,
    traits: ['threat_to_humanity', 'beast', 'demonic', 'giant', 'super_large', 'divine', 'female', 'dragon'],
    avatarUrl: 'https://ella.janitorai.com/media-approved/0e2G0RijgX5dnEjjuZPBm.webp',
    spriteUrl: 'https://ella.janitorai.com/media-approved/vIAH9W2EA76dznj4sTQP5.webp',
    bgUrl: 'https://ella.janitorai.com/media-approved/w7DGikOFd4qgiJd_f38Eh.webp',
    spriteConfig: {
      offsetX: 0,
      offsetY: 0,
      scale: 1.0,
      cropRightRatio: 0
    },
    phases: [
      {
        phaseNumber: 1,
        name: 'Tiamat',
        title: 'Beast II • Primordial Mother (Limiter State)',
        baseHp: 3_500_000,
        maxCharge: 5,
        spriteUrl: 'https://ella.janitorai.com/media-approved/vIAH9W2EA76dznj4sTQP5.webp',
        drawBox: {
          destX: 80,
          destY: 90,
          destW: 410,
          destH: 530
        },
        passives: [
          'Sea of Life / Chaos Tide: -2,000 HP & -15% NP Gain to all Servants every turn',
          'Self-Limitation: Restores +150,000 HP whenever players use a heal'
        ],
        breakQuote: 'Aaaa... aaaaa...',
        breakAnnouncement: 'The limiter state shatters! Tiamat groans as dark divine wings unfurl!'
      },
      {
        phaseNumber: 2,
        name: 'Tiamat (Titan)',
        title: 'Beast II • The Marching Calamity',
        baseHp: 5_500_000,
        maxCharge: 4,
        spriteUrl: 'https://ella.janitorai.com/media-approved/WaKYI0RR-_UhcLwjF4Fbu.webp',
        drawBox: {
          destX: 100,
          destY: 30,
          destW: 500,
          destH: 540
        },
        passives: [
          'Immense Mass: Complete immunity to Stun, Charm, Freeze, and Instant Death',
          'Chaos Spores: 20% DEF shield on odd turns until 300,000 turn DMG is dealt'
        ],
        breakQuote: 'The shell cracks... the primeval sea dragon awakens!',
        breakAnnouncement: 'The shell cracks... the primeval sea dragon awakens! Beast II enters her true Draconic Form!'
      },
      {
        phaseNumber: 3,
        name: 'Beast II / Tiamat',
        title: 'Beast of Calamity • Primeval Sea Dragon',
        baseHp: 8_000_000,
        maxCharge: 3,
        spriteUrl: 'https://ella.janitorai.com/media-approved/0e2G0RijgX5dnEjjuZPBm.webp',
        drawBox: {
          destX: -140,
          destY: -20,
          destW: 1100,
          destH: 720
        },
        passives: [
          'Nega-Genesis: Normal cards deal -50% DMG (Only NPs deal unmitigated true damage)',
          'Authority of the Beast: Normal attacks cleave 2 Servants with high critical rate'
        ]
      }
    ],
    skills: [
      {
        name: 'Wailing Voice',
        description: 'Moderate single-target strike; inflicts 1-turn Skill Seal on the target.',
        effect: 'skill_seal',
        value: 1,
        cooldown: 3
      },
      {
        name: 'Mud Surge',
        description: 'Targets two random Servants, shortening active buff durations by 1 turn.',
        effect: 'buff_shorten',
        value: 1,
        cooldown: 3
      },
      {
        name: 'Tremor Step',
        description: 'Smashes the front-most Servant, reducing DEF by 20% for 3 turns.',
        effect: 'def_down',
        value: 20,
        cooldown: 3
      },
      {
        name: 'Crying Eyes',
        description: 'Drains 10% NP gauge from two active players.',
        effect: 'np_drain',
        value: 10,
        cooldown: 3
      },
      {
        name: 'Jaw of the Primordial',
        description: 'Focuses the lowest-HP Servant for massive single-target damage and a 40% DEF shred.',
        effect: 'def_down',
        value: 40,
        cooldown: 3
      },
      {
        name: 'Chaos Deluge',
        description: 'Siphons 15% NP gauge from all 4 Servants and converts it into a boss barrier.',
        effect: 'barrier',
        value: 50000,
        cooldown: 4
      }
    ],
    chargeAttack: {
      name: 'Primordial Murmur',
      description: 'High AoE team damage applying a 3-turn persistent Curse stack.',
      damageMultiplier: 2.5
    },
    drops: {
      minSq: 20,
      maxSq: 35,
      servantExp: 60_000,
      emberCount: 5
    }
  }
};
