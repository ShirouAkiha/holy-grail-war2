import { CraftEssence, GachaBanner } from '../types';

export type { CraftEssence, GachaBanner } from '../types';

export const CRAFT_ESSENCE_DATABASE: CraftEssence[] = [
  // --- 5★ SSR CRAFT ESSENCES ---
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
    effectText: 'Starts battle with 60% NP Gauge filled.',
    passiveType: 'starting_np',
    passiveValue: 60,
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
    id: 'ce_limited_zero_over',
    name: 'Limited / Zero Over',
    rarity: 5,
    description: 'A forged blade echoing the fiery determination of the Wrought Iron Hero.',
    bonusAtk: 600,
    bonusDef: 0,
    bonusHp: 200,
    atkBonus: 600,
    hpBonus: 200,
    effectText: 'Increases Buster Card effectiveness by 25%.',
    passiveType: 'buster_up',
    passiveValue: 25,
    artworkUrl: 'https://images.unsplash.com/photo-1514539079130-25950c84af65?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'ce_imaginary_around',
    name: 'Imaginary Around',
    rarity: 5,
    description: 'Flowing mystic shadow ribbons cutting through the void with supreme agility.',
    bonusAtk: 500,
    bonusDef: 0,
    bonusHp: 400,
    atkBonus: 500,
    hpBonus: 400,
    effectText: 'Increases Quick Card effectiveness by 25% and Critical Star generation.',
    passiveType: 'quick_up',
    passiveValue: 25,
    artworkUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&auto=format&fit=crop&q=80'
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
    id: 'ce_prisma_cosmos',
    name: 'Prisma Cosmos',
    rarity: 5,
    description: 'A miniature cosmos radiating continuous leyline mana to its wielder.',
    bonusAtk: 200,
    bonusDef: 150,
    bonusHp: 600,
    atkBonus: 200,
    hpBonus: 600,
    effectText: 'Regenerates 8% NP Gauge automatically at the start of each combat turn.',
    passiveType: 'starting_np',
    passiveValue: 8,
    artworkUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop&q=80'
  },

  // --- 4★ SR CRAFT ESSENCES ---
  {
    id: 'ce_imaginary_element',
    name: 'The Imaginary Element',
    rarity: 4,
    description: 'A hollow mystic number connecting visible reality to imaginary space.',
    bonusAtk: 250,
    bonusDef: 0,
    bonusHp: 400,
    atkBonus: 250,
    hpBonus: 400,
    effectText: 'Starts battle with 50% NP Gauge filled.',
    passiveType: 'starting_np',
    passiveValue: 50,
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
    id: 'ce_gandr',
    name: 'Gandr Shot',
    rarity: 4,
    description: 'Concentrated Scandinavian curse shot focused from the tip of an index finger.',
    bonusAtk: 300,
    bonusDef: 0,
    bonusHp: 200,
    atkBonus: 300,
    hpBonus: 200,
    effectText: 'Increases Quick Card effectiveness by 15%.',
    passiveType: 'quick_up',
    passiveValue: 15,
    artworkUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'ce_projection',
    name: 'Projection Magecraft',
    rarity: 4,
    description: 'Gradation Air visualization of phantom concepts into tangible armaments.',
    bonusAtk: 300,
    bonusDef: 100,
    bonusHp: 200,
    atkBonus: 300,
    hpBonus: 200,
    effectText: 'Increases Arts Card effectiveness and NP damage by 15%.',
    passiveType: 'arts_up',
    passiveValue: 15,
    artworkUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'ce_verdant_sound',
    name: 'Verdant Sound of Destruction',
    rarity: 4,
    description: 'Resounding shockwave of earth-shattering power unleashed in burst strikes.',
    bonusAtk: 380,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 380,
    hpBonus: 100,
    effectText: 'Increases Buster Card effectiveness by 15%.',
    passiveType: 'buster_up',
    passiveValue: 15,
    artworkUrl: 'https://images.unsplash.com/photo-1514539079130-25950c84af65?w=500&auto=format&fit=crop&q=80'
  },

  // --- 3★ R CRAFT ESSENCES ---
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
  },
  {
    id: 'ce_jeweled_sword',
    name: 'Jeweled Sword Zelretch',
    rarity: 3,
    description: 'A second-magic ritual blade that siphons ambient ethereal ether.',
    bonusAtk: 150,
    bonusDef: 0,
    bonusHp: 150,
    atkBonus: 150,
    hpBonus: 150,
    effectText: 'Starts battle with 20% NP Gauge & increases NP gain by 15%.',
    passiveType: 'starting_np',
    passiveValue: 20,
    artworkUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'ce_hydra_dagger',
    name: 'Hydra Dagger',
    rarity: 3,
    description: 'A poisoned blade coated in ancient serpentine venom for swift fatal strikes.',
    bonusAtk: 180,
    bonusDef: 0,
    bonusHp: 80,
    atkBonus: 180,
    hpBonus: 80,
    effectText: 'Increases Critical Strike Damage by 15%.',
    passiveType: 'crit_dmg',
    passiveValue: 15,
    artworkUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=500&auto=format&fit=crop&q=80'
  }
];

export const CE_GACHA_BANNERS: GachaBanner[] = [
  {
    id: 'ce_banner_fuyuki_relics',
    title: 'Mystic Code Sanctum: Sacred Relics',
    subtitle: 'Featured Rate-Up: Kaleidoscope & The Black Grail (5★ SSR)',
    description: 'Channel your Saint Quartz into the leyline altar to forge legendary mystic Craft Essences!',
    featuredServantIds: [],
    featuredCeIds: ['ce_kaleidoscope', 'ce_black_grail', 'ce_formal_craft'],
    bannerType: 'standard',
    costPerPull: 3,
    costTenPull: 30,
    bannerArtUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
    rates: {
      ssrServant: 0,
      srServant: 0,
      rServant: 0,
      ssrCe: 5.0,
      srCe: 25.0,
      rCe: 70.0
    }
  }
];

export const craftEssences = CRAFT_ESSENCE_DATABASE;
export default CRAFT_ESSENCE_DATABASE;

