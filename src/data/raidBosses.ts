import { ServantClass } from '../types';

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
  skills: {
    name: string;
    description: string;
    effect: 'atk_up' | 'def_down' | 'charge_up' | 'np_drain' | 'skill_seal' | 'aoe_curse';
    value: number;
    cooldown: number;
  }[];
  chargeAttack: {
    name: string;
    description: string;
    gifUrl?: string;
    damageMultiplier: number;
  };
  drops: {
    minSq: number;
    maxSq: number;
    servantExp: number;
    bondExp: number;
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
      bondExp: 2_000,
      emberCount: 3
    }
  }
};
