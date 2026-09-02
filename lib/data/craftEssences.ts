import { CraftEssence, GachaBanner } from '../types';

export const CRAFT_ESSENCE_DATABASE: CraftEssence[] = [
  {
    id: 'ce_kaleidoscope',
    name: 'Kaleidoscope',
    rarity: 5,
    description: 'A mystic artifact depicting the Old Man of the Jewels, Kischur Zelretch Schweinorg.',
    atkBonus: 500,
    hpBonus: 0,
    effectText: 'Starts battle with 80% NP Gauge filled.',
    passiveType: 'starting_np',
    passiveValue: 80,
    artworkUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'ce_black_grail',
    name: 'The Black Grail',
    rarity: 5,
    description: 'The tainted vessel holding the primordial curse of All the World\'s Evil.',
    atkBonus: 600,
    hpBonus: 0,
    effectText: 'Increases Noble Phantasm Damage by 60%, but loses 500 HP each turn.',
    passiveType: 'buster_up',
    passiveValue: 60,
    artworkUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'ce_fragment_2030',
    name: 'A Fragment of 2030',
    rarity: 5,
    description: 'A glimpse into a distant high-tech future where humanity transcends the stars.',
    atkBonus: 0,
    hpBonus: 750,
    effectText: 'Gains 10 Critical Stars every turn automatically.',
    passiveType: 'quick_up',
    passiveValue: 10,
    artworkUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'ce_formal_craft',
    name: 'Formal Craft',
    rarity: 5,
    description: 'The orthodox pinnacle of Tohsaka jewel magecraft passed through generations.',
    atkBonus: 400,
    hpBonus: 300,
    effectText: 'Increases Arts Card effectiveness and NP gain by 25%.',
    passiveType: 'arts_up',
    passiveValue: 25,
    artworkUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'ce_imaginary_element',
    name: 'The Imaginary Element',
    rarity: 4,
    description: 'A hollow mystic number connecting the visible reality to imaginary space.',
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
    atkBonus: 350,
    hpBonus: 100,
    effectText: 'Increases Critical Strike Damage by 30% and Speed initiative.',
    passiveType: 'crit_dmg',
    passiveValue: 30,
    artworkUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'ce_dragon_meridian',
    name: 'Dragon\'s Meridian',
    rarity: 3,
    description: 'A subterranean flow of pure magical mana traversing the Fuyuki leyline.',
    atkBonus: 100,
    hpBonus: 200,
    effectText: 'Starts battle with 30% NP Gauge.',
    passiveType: 'starting_np',
    passiveValue: 30,
    artworkUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=80'
  }
];

export const GACHA_BANNERS: GachaBanner[] = [
  {
    id: 'banner_holy_grail_legends',
    title: 'Holy Grail War: King\'s Awakening',
    subtitle: 'Limited Rate-Up: Artoria Pendragon & Gilgamesh (5★ SSR)',
    description: 'Summon legendary Heroic Spirits of ancient myth to fight as your Servant in the Holy Grail War!',
    featuredServantIds: ['artoria_pendragon', 'gilgamesh_archer'],
    featuredCeIds: ['ce_kaleidoscope', 'ce_black_grail'],
    bannerType: 'limited',
    costPerPull: 3,
    costTenPull: 30,
    bannerArtUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80',
    rates: {
      ssrServant: 1.0,
      srServant: 3.0,
      rServant: 40.0,
      ssrCe: 4.0,
      srCe: 12.0,
      rCe: 40.0
    }
  },
  {
    id: 'banner_shadow_lands_saint',
    title: 'Chaldea Vanguard: Shadows & Saints',
    subtitle: 'Featured: Scáthach & Jeanne d\'Arc (5★ SSR)',
    description: 'The gatekeeper of the Land of Shadows and the Holy Maiden of Orleans offer their blades.',
    featuredServantIds: ['scathach_lancer', 'jeanne_darc_ruler'],
    featuredCeIds: ['ce_fragment_2030', 'ce_formal_craft'],
    bannerType: 'standard',
    costPerPull: 3,
    costTenPull: 30,
    bannerArtUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80',
    rates: {
      ssrServant: 1.0,
      srServant: 3.0,
      rServant: 40.0,
      ssrCe: 4.0,
      srCe: 12.0,
      rCe: 40.0
    }
  },
  {
    id: 'banner_imperial_rose',
    title: 'Imperial Bloom: Golden Theater',
    subtitle: 'Featured Rate-Up: Nero Claudius (4★ SR) & EMIYA (4★ SR)',
    description: 'The Emperor of Rome opens her radiant theater alongside the Fabled Wrought Iron Hero!',
    featuredServantIds: ['nero_claudius_saber', 'emiya_archer', 'heracles_berserker'],
    featuredCeIds: ['ce_formal_craft', 'ce_kaleidoscope'],
    bannerType: 'standard',
    costPerPull: 3,
    costTenPull: 30,
    bannerArtUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
    rates: {
      ssrServant: 1.0,
      srServant: 4.5,
      rServant: 38.5,
      ssrCe: 4.0,
      srCe: 12.0,
      rCe: 40.0
    }
  }
];
