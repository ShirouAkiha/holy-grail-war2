import { CraftEssence } from '../types';

export type { CraftEssence } from '../types';

export const CRAFT_ESSENCE_DATABASE: CraftEssence[] = [
  {
    id: 'ce_kaleidoscope',
    name: 'Kaleidoscope',
    rarity: 5,
    description: 'A mystic artifact depicting the Old Man of the Jewels, Kischur Zelretch Schweinorg.',
    bonusAtk: 500,
    bonusDef: 0,
    bonusHp: 200,
    atkBonus: 500,
    hpBonus: 200,
    effectText: 'Starts battle with 80% NP Gauge filled.',
    passiveType: 'starting_np',
    passiveValue: 80,
    artworkUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'ce_black_grail',
    name: 'The Black Grail',
    rarity: 5,
    description: "The tainted vessel holding the primordial curse of All the World's Evil.",
    bonusAtk: 800,
    bonusDef: 0,
    bonusHp: -100,
    atkBonus: 800,
    hpBonus: -100,
    effectText: 'Increases Noble Phantasm Damage by 60%, but loses 500 HP each turn.',
    passiveType: 'buster_up',
    passiveValue: 60,
    artworkUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'ce_formal_craft',
    name: 'Formal Craft',
    rarity: 5,
    description: 'The orthodox pinnacle of Tohsaka jewel magecraft passed through generations.',
    bonusAtk: 400,
    bonusDef: 200,
    bonusHp: 300,
    atkBonus: 400,
    hpBonus: 300,
    effectText: 'Increases Arts Card effectiveness and NP gain by 25%.',
    passiveType: 'arts_up',
    passiveValue: 25,
    artworkUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'ce_fragment_2030',
    name: 'A Fragment of 2030',
    rarity: 5,
    description: 'A glimpse into a distant high-tech future where humanity transcends the stars.',
    bonusAtk: 0,
    bonusDef: 0,
    bonusHp: 750,
    atkBonus: 0,
    hpBonus: 750,
    effectText: 'Gains 10 Critical Stars every turn automatically.',
    passiveType: 'quick_up',
    passiveValue: 10,
    artworkUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'ce_imaginary_element',
    name: 'The Imaginary Element',
    rarity: 4,
    description: 'A hollow mystic number connecting the visible reality to imaginary space.',
    bonusAtk: 250,
    bonusDef: 0,
    bonusHp: 400,
    atkBonus: 250,
    hpBonus: 400,
    effectText: 'Starts battle with 60% NP Gauge filled.',
    passiveType: 'starting_np',
    passiveValue: 60,
    artworkUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'ce_gamer_fuel',
    name: 'Gamer Fuel & Doritos',
    rarity: 4,
    description: 'A mountain of energy drinks and savory chips guaranteeing peak 3:00 AM APM.',
    bonusAtk: 350,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 350,
    hpBonus: 100,
    effectText: 'Increases Critical Strike Damage by 30% and Speed initiative.',
    passiveType: 'crit_dmg',
    passiveValue: 30,
    artworkUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'ce_dragon_meridian',
    name: "Dragon's Meridian",
    rarity: 3,
    description: 'A subterranean flow of pure magical mana traversing the Fuyuki leyline.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 200,
    atkBonus: 100,
    hpBonus: 200,
    effectText: 'Starts battle with 30% NP Gauge.',
    passiveType: 'starting_np',
    passiveValue: 30,
    artworkUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=80'
  }
];

export const craftEssences = CRAFT_ESSENCE_DATABASE;
export default CRAFT_ESSENCE_DATABASE;
