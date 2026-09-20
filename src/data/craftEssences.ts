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
    effectText: 'Starts battle with 80% NP Gauge filled.',
    passiveType: 'starting_np',
    passiveValue: 80,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp'
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
    passiveType: 'np_damage',
    passiveValue: 60,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp'
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
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp'
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
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp'
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
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp'
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
    passiveType: 'stars_per_turn',
    passiveValue: 10,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp'
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
    passiveType: 'np_per_turn',
    passiveValue: 8,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp'
  },
  {
    id: 'ce_volumen_hydragyrum',
    name: 'Volumen Hydragyrum',
    rarity: 5,
    description: 'Self-governing mercury fluid weapon forged by El-Melloi archmages for impenetrable defense.',
    bonusAtk: 500,
    bonusDef: 300,
    bonusHp: 500,
    atkBonus: 500,
    hpBonus: 500,
    effectText: 'Grants Invincibility for 3 attacks & +15% Damage Cut.',
    passiveType: 'invincible_hits',
    passiveValue: 3,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp'
  },
  {
    id: 'ce_heavens_feel',
    name: "Heaven's Feel",
    rarity: 5,
    description: 'The Third Magic: Materialization of the Soul in divine radiance.',
    bonusAtk: 600,
    bonusDef: 0,
    bonusHp: 200,
    atkBonus: 600,
    hpBonus: 200,
    effectText: 'Increases Noble Phantasm Damage by 40%.',
    passiveType: 'np_damage',
    passiveValue: 40,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp'
  },
  {
    id: 'ce_origin_bullet',
    name: 'Origin Bullet',
    rarity: 5,
    description: 'Mystic code rounds fashioned from Kiritsugu Emiya\'s ribs to disrupt and sever magical circuits.',
    bonusAtk: 800,
    bonusDef: 0,
    bonusHp: 0,
    atkBonus: 800,
    hpBonus: 0,
    effectText: 'Ignores Invincibility & +35% Special Damage against Magic users.',
    passiveType: 'ignore_invincible',
    passiveValue: 35,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp'
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
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp'
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
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp'
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
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp'
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
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp'
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
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp'
  },
  {
    id: 'ce_hollow_magic',
    name: 'Hollow Magic',
    rarity: 4,
    description: 'A shadowy mystic code that channels virtual magical energy directly into noble phantasm gauge.',
    bonusAtk: 200,
    bonusDef: 0,
    bonusHp: 300,
    atkBonus: 200,
    hpBonus: 300,
    effectText: 'Starts battle with 60% NP Gauge filled.',
    passiveType: 'starting_np',
    passiveValue: 60,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp'
  },
  {
    id: 'ce_code_cast',
    name: 'Code Cast',
    rarity: 4,
    description: 'A digital command spell program optimized for tactical engagement.',
    bonusAtk: 350,
    bonusDef: 100,
    bonusHp: 150,
    atkBonus: 350,
    hpBonus: 150,
    effectText: 'Increases ATK and Defense by 10%.',
    passiveType: 'atk_up',
    passiveValue: 10,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp'
  },
  {
    id: 'ce_when_the_flowers_fall',
    name: 'When the Flowers Fall',
    rarity: 4,
    description: 'Under the falling cherry blossom petals, a fleeting promise is etched forever in memory.',
    bonusAtk: 200,
    bonusDef: 0,
    bonusHp: 300,
    atkBonus: 200,
    hpBonus: 300,
    effectText: 'Charges NP gauge by 4% every turn. Increases Quick performance by 4%. Increases NP damage by 5%.',
    passiveType: 'quick_up',
    passiveValue: 4,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp'
  },
  {
    id: 'ce_amazakura',
    name: 'Amazakura',
    rarity: 4,
    description: 'Uchigatana forged for Amamiya. Relatively short for everyone else (even the dwarves) but perfectly balanced for her.',
    bonusAtk: 450,
    bonusDef: 100,
    bonusHp: 200,
    atkBonus: 450,
    hpBonus: 200,
    effectText: 'Increases Quick Card effectiveness by 15% and Critical Star generation by 15%.',
    passiveType: 'quick_up',
    passiveValue: 15,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp'
  },
  {
    id: 'ce_castle_of_snow',
    name: 'Castle of Snow',
    rarity: 5,
    description: 'An unmelting castle of white snow nestled in the Einzbern forest. Even if broken a thousand times, the great hero rises again to defend his Master without fail.',
    bonusAtk: 500,
    bonusDef: 200,
    bonusHp: 500,
    atkBonus: 500,
    hpBonus: 500,
    effectText: 'Grants Guts status to self (revives 3 times with 500 HP). Signature Bond CE of Heracles.',
    passiveType: 'guts',
    passiveValue: 3,
    artworkUrl: 'https://ella.janitorai.com/media-approved/QGsCqgq-eKYBH421MO6BR.webp',
    isBondCe: true,
    bondServantId: 'heracles_berserker',
    bondServantName: 'Heracles'
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
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp'
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
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp'
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
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp'
  }
];

// ============================================================================
// CANONICAL BOND CRAFT ESSENCES (Awarded automatically upon reaching Bond 10)
// ============================================================================
export const BOND_CRAFT_ESSENCES: Record<string, CraftEssence> = {
  artoria_pendragon: {
    id: 'ce_bond_artoria_pendragon',
    name: 'Star of Artoria',
    rarity: 4,
    description: 'The crown and sapphire mantle worn by the King of Knights when the oath of Camelot was sealed. Gazing upon it, the King remembers the Master who fought beside her to the very end.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to Artoria Pendragon: Increases party Attack by 15% and Noble Phantasm Damage by 20%.',
    passiveType: 'buster_up',
    passiveValue: 20,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp',
    isBondCe: true,
    bondServantId: 'artoria_pendragon',
    bondServantName: 'Artoria Pendragon'
  },
  heracles_berserker: {
    id: 'ce_bond_heracles_berserker',
    name: 'Castle of Snow',
    rarity: 4,
    description: 'An unmelting castle of white snow nestled in the Einzbern forest. Even if broken a thousand times, the great hero rises again to defend his Master without fail.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to Heracles: Grants Guts to self (revives with 500 HP, 3 times).',
    passiveType: 'guts',
    passiveValue: 3,
    artworkUrl: 'https://ella.janitorai.com/media-approved/QGsCqgq-eKYBH421MO6BR.webp',
    isBondCe: true,
    bondServantId: 'heracles_berserker',
    bondServantName: 'Heracles'
  },
  gilgamesh_archer: {
    id: 'ce_bond_gilgamesh_archer',
    name: "The King's Law (Bab-ilu)",
    rarity: 4,
    description: "The golden key that unlocks the Vault of Babylon. Only a Master who has earned the King of Heroes' genuine esteem may behold its sacred gleam.",
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to Gilgamesh: Increases Noble Phantasm Damage by 30% and Critical Damage by 20%.',
    passiveType: 'crit_dmg',
    passiveValue: 20,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp',
    isBondCe: true,
    bondServantId: 'gilgamesh_archer',
    bondServantName: 'Gilgamesh'
  },
  scathach_lancer: {
    id: 'ce_bond_scathach_lancer',
    name: 'Gate of Skye',
    rarity: 4,
    description: 'The weathered stone threshold of Dún Scáith overlooking the misty Celtic sea. For centuries she waited in the Land of Shadows, until a Master crossed the threshold into her heart.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to Scáthach: Increases Quick Card effectiveness by 15% and Critical Damage by 25%.',
    passiveType: 'quick_up',
    passiveValue: 15,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp',
    isBondCe: true,
    bondServantId: 'scathach_lancer',
    bondServantName: 'Scáthach'
  },
  jeanne_darc_ruler: {
    id: 'ce_bond_jeanne_darc_ruler',
    name: "Luminosité Eternelle: Maiden's Standard",
    rarity: 4,
    description: 'The consecrated fleur-de-lis banner carried through flame and battle. Held aloft not to conquer, but to shield every soul marching under her righteous prayer.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: "When equipped to Jeanne d'Arc: Increases party Defense by 15% and recovers 500 HP each turn.",
    passiveType: 'hp_regen',
    passiveValue: 500,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp',
    isBondCe: true,
    bondServantId: 'jeanne_darc_ruler',
    bondServantName: "Jeanne d'Arc"
  },
  jeanne_alter: {
    id: 'ce_bond_jeanne_alter',
    name: "Cursed Dragon's Roar",
    rarity: 4,
    description: 'The ragged black standard steeped in vengeful dragonfire. Born of wrath and hatred, yet fiercely bound to the one Master who looked into her abyss and smiled.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: "When equipped to Jeanne d'Arc (Alter): Increases Buster Card effectiveness by 20% and Critical Damage by 25%.",
    passiveType: 'buster_up',
    passiveValue: 20,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp',
    isBondCe: true,
    bondServantId: 'jeanne_alter',
    bondServantName: "Jeanne d'Arc (Alter)"
  },
  mhx_alter: {
    id: 'ce_bond_mhx_alter',
    name: 'Darkness-Infused Anpan',
    rarity: 4,
    description: 'A confectionery snack filled with dark matter paste from the servant universe, secretly split in two and shared with Master late at night.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to Mysterious Heroine X Alter: Increases Quick & Buster effectiveness by 15% and Critical Damage by 20%.',
    passiveType: 'quick_up',
    passiveValue: 15,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp',
    isBondCe: true,
    bondServantId: 'mhx_alter',
    bondServantName: 'Mysterious Heroine X Alter'
  },
  artoria_pendragon_alter: {
    id: 'ce_bond_artoria_pendragon_alter',
    name: "Dragon's Memory",
    rarity: 4,
    description: 'An obsidian dragon scale forged into an emblem of tyrannical majesty. It hums with merciless crimson mana, yet stays warm against Master\'s chest.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to Artoria Alter: Increases Buster Card effectiveness by 20% and increases NP Gain by 15%.',
    passiveType: 'buster_up',
    passiveValue: 20,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp',
    isBondCe: true,
    bondServantId: 'artoria_pendragon_alter',
    bondServantName: 'Artoria Pendragon (Alter)'
  },
  nero_claudius_saber: {
    id: 'ce_bond_nero_claudius_saber',
    name: "Golden Maiden's Laurel",
    rarity: 4,
    description: 'A crown of golden laurel leaves plucked from the stage of Domus Aurea. Fashioned solely for the audience member whose applause she treasures above all Rome.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to Nero Claudius: Increases Arts Card effectiveness by 15% and restores 400 HP each turn.',
    passiveType: 'arts_up',
    passiveValue: 15,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp',
    isBondCe: true,
    bondServantId: 'nero_claudius_saber',
    bondServantName: 'Nero Claudius'
  },
  emiya_archer: {
    id: 'ce_bond_emiya_archer',
    name: 'Faded Wrought Iron',
    rarity: 4,
    description: 'A tattered red mantle draped over Kanshou & Bakuya upon a hill of countless blades. A life spent as an ally of justice, finally finding peace in the bond with his Master.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to EMIYA: Increases Arts & Buster Card effectiveness by 15% and Critical Damage by 20%.',
    passiveType: 'arts_up',
    passiveValue: 15,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp',
    isBondCe: true,
    bondServantId: 'emiya_archer',
    bondServantName: 'EMIYA'
  },
  cu_chulainn_lancer: {
    id: 'ce_bond_cu_chulainn_lancer',
    name: 'Red Mead of Ulster',
    rarity: 4,
    description: 'An ancient carved horn filled with the crimson wine of Dun Scaith and Ulster. Poured only for brothers-in-arms after surviving impossible battles together.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to Cú Chulainn: Grants Guts to self (revives with 25% HP, 1 time) and increases Quick Card effectiveness by 15%.',
    passiveType: 'guts',
    passiveValue: 1,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp',
    isBondCe: true,
    bondServantId: 'cu_chulainn_lancer',
    bondServantName: 'Cú Chulainn'
  },
  karna_lancer: {
    id: 'ce_bond_karna_lancer',
    name: "Kavacha and Kundala's Radiance",
    rarity: 4,
    description: 'The celestial golden earrings and armor gifted by the Sun God Surya, glowing with the boundless compassion of the Hero of Charity.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to Karna: Increases Buster Card effectiveness by 20% and Noble Phantasm Damage by 20%.',
    passiveType: 'buster_up',
    passiveValue: 20,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp',
    isBondCe: true,
    bondServantId: 'karna_lancer',
    bondServantName: 'Karna'
  },
  adiosa_dragon_envoy: {
    id: 'ce_bond_adiosa_dragon_envoy',
    name: 'Cosmic Dragon Fang',
    rarity: 4,
    description: 'A celestial fang shed by the Primordial Dragon across timelines. Pulsing with cosmic resonance, it binds Master and Envoy as eternal partners against universal entropy.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to Adiosa: Increases Buster Card effectiveness by 20% and generates 10 Critical Stars each turn.',
    passiveType: 'buster_up',
    passiveValue: 20,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp',
    isBondCe: true,
    bondServantId: 'adiosa_dragon_envoy',
    bondServantName: 'Adiosa'
  },
  aoko_aozaki: {
    id: 'ce_bond_aoko_aozaki',
    name: 'Magic Blueprint: The Fifth',
    rarity: 4,
    description: 'A worn leather journal filled with the forbidden formulas of the Fifth Magic, wrapped with a scarlet hair ribbon given to Master.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to Aoko Aozaki: Increases Arts & Buster effectiveness by 15% and starts battle with 30% NP Gauge.',
    passiveType: 'starting_np',
    passiveValue: 30,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp',
    isBondCe: true,
    bondServantId: 'aoko_aozaki',
    bondServantName: 'Aoko Aozaki'
  },
  amamiya_no_chihaya_tenkohime: {
    id: 'ce_bond_amamiya_no_chihaya_tenkohime',
    name: "Tenko's Divine Mirror (Yata no Tenko)",
    rarity: 4,
    description: 'A sacred bronze mirror framed by golden fox tails and Shinto purification shimenawa. Reflects the pure, unbroken bond between the Heavenly Fox and her beloved Master.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to Tenkohime: Increases Arts Card effectiveness by 20% and gains 10% NP Gauge each turn.',
    passiveType: 'arts_up',
    passiveValue: 20,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp',
    isBondCe: true,
    bondServantId: 'amamiya_no_chihaya_tenkohime',
    bondServantName: 'Amamiya no Chihaya (Tenkohime)'
  },
  lucia_lyozes: {
    id: 'ce_bond_lucia_lyozes',
    name: 'The Closed Door Insignia',
    rarity: 4,
    description: 'The Vanguard crest of Lyozes forged from black iron, etched with five concentric rings of prescient foresight. Given only to the commander she trusts to stand beside her beyond all Calamities.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to Lucia Lyozes: Increases Critical Damage by 25% and Critical Star Gather Rate by 30%.',
    passiveType: 'crit_dmg',
    passiveValue: 25,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp',
    isBondCe: true,
    bondServantId: 'lucia_lyozes',
    bondServantName: 'Lucia Lyozes'
  }
};

export const CE_DEFAULT_ARTWORK = 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp';

/**
 * Retrieve the Bond Craft Essence corresponding to a Servant.
 * If canonical, returns the curated Bond CE.
 * For custom or unmapped servants, dynamically generates an authentic Bond CE.
 */
export function getBondCraftEssenceForServant(
  servantIdentifier: string,
  servantName?: string,
  customArt?: string
): CraftEssence {
  const normId = (servantIdentifier || '').toLowerCase().trim();
  
  // 1. Direct match by templateId
  if (BOND_CRAFT_ESSENCES[normId]) {
    return BOND_CRAFT_ESSENCES[normId];
  }

  // 2. Fuzzy match against registered bond CEs
  for (const [key, ce] of Object.entries(BOND_CRAFT_ESSENCES)) {
    if (
      normId.includes(key) ||
      key.includes(normId) ||
      (servantName && (ce.bondServantName?.toLowerCase().includes(servantName.toLowerCase()) || servantName.toLowerCase().includes(key)))
    ) {
      return ce;
    }
  }

  // 3. Procedurally generate custom Bond CE for custom/community servants
  const cleanName = servantName || servantIdentifier || 'Heroic Spirit';
  const cleanId = normId.replace(/[^a-z0-9_]/g, '_') || 'custom';
  
  return {
    id: `ce_bond_${cleanId}`,
    name: `The Hero's Bond: ${cleanName}`,
    rarity: 4,
    description: `A sacred, untarnished relic crystallizing the absolute covenant forged between Master and ${cleanName} through ten tiers of trials.`,
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: `When equipped to ${cleanName}: Increases ATK by 15%, DEF by 15%, and starts battle with 20% NP Gauge.`,
    passiveType: 'buster_up',
    passiveValue: 15,
    artworkUrl: customArt || CE_DEFAULT_ARTWORK,
    isBondCe: true,
    bondServantId: normId,
    bondServantName: cleanName
  };
}

/**
 * Returns all predefined canonical Bond Craft Essences
 */
export function getAllBondCraftEssences(): CraftEssence[] {
  return Object.values(BOND_CRAFT_ESSENCES);
}

/**
 * Checks if a servant has achieved Bond Level 10 and automatically awards their Bond Craft Essence.
 * Safe and idempotent: will not double-grant.
 */
export function checkAndGrantBond10Ce(
  master: any,
  servant: any
): { granted: boolean; ce: CraftEssence; message: string } | null {
  if (!master || !servant) return null;
  const bondLevel = servant.bondLevel || 1;
  if (bondLevel < 10) return null;

  const servantId = servant.templateId || servant.template?.id || servant.id;
  const servantName = servant.nickname || servant.template?.name || servant.name || 'Heroic Spirit';
  const servantArt = servant.cardArtUrl || servant.avatarUrl || servant.template?.cardArtUrl;
  const bondCe = getBondCraftEssenceForServant(servantId, servantName, servantArt);

  if (!master.craftEssences) {
    master.craftEssences = [];
  }

  // Check if Master already has this Bond CE in inventory or marked on servant
  const alreadyInInventory = master.craftEssences.some(
    (c: any) => c && (c.id === bondCe.id || (c.isBondCe && (c.bondServantId === servantId || c.name === bondCe.name)))
  );

  if (alreadyInInventory && servant.bondCeGranted) {
    return null;
  }

  // Grant the Bond CE to the master's vault
  servant.bondCeGranted = true;
  if (!alreadyInInventory) {
    master.craftEssences.push({
      ...bondCe,
      id: bondCe.id
    });
  }

  const celebrationMsg = 
    `🎖️ **MAX BOND 10 ATTAINED — BOND CRAFT ESSENCE UNLOCKED!**\n\n` +
    `Through unshakeable devotion and countless shared battles across Fuyuki City, **${servantName}** has reached **Bond Level 10 (MAX BOND)**!\n\n` +
    `As eternal testament to your unbroken covenant, you have been awarded their exclusive Bond Relic:\n` +
    `★4 **${bondCe.name}**\n` +
    `*${bondCe.description}*\n\n` +
    `**Special Bond Effect:** ${bondCe.effectText}\n` +
    `*(Stats: +${bondCe.atkBonus} ATK / +${bondCe.hpBonus} HP)*\n\n` +
    `💡 *This Craft Essence has been added to your inventory! Equip it using \`/inventory\` or \`/equip\`.*`;

  return {
    granted: true,
    ce: bondCe,
    message: celebrationMsg
  };
}

// Append all Bond CEs into the global database so they are recognized across the app
CRAFT_ESSENCE_DATABASE.push(...Object.values(BOND_CRAFT_ESSENCES));

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
    bannerArtUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp',
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
