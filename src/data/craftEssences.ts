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
    artworkUrl: 'https://ella.janitorai.com/media-approved/ZfMdFndERcnabvS9WF6UR.webp'
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
    artworkUrl: 'https://ella.janitorai.com/media-approved/dSq-fbIbTVHF7WdfsMZb3.webp'
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
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9400310/9400310a.png'
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
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9400330/9400330a.png'
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
    artworkUrl: 'https://ella.janitorai.com/media-approved/JOKsPympyDeoYPZ30ZNNq.webp'
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
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9400650/9400650a.png'
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
    artworkUrl: 'https://ella.janitorai.com/media-approved/M7EGMqW8FeegA-Z-LR-xU.webp'
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
    effectText: 'Grants Invincibility for 1 turn (3 attacks) & +15% Damage Cut.',
    passiveType: 'invincible_hits',
    passiveValue: 3,
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9401410/9401410a.png'
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
    artworkUrl: 'https://ella.janitorai.com/media-approved/ktbDIH9F1G8PV71wj5GmO.webp'
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
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9401680/9401680a.png'
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
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9400280/9400280a.png'
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
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9400240/9400240a.png'
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
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9400230/9400230a.png'
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
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9400250/9400250a.png'
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
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9400280/9400280a.png'
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
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9400560/9400560a.png'
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
    artworkUrl: 'https://static.atlasacademy.io/JP/CharaGraph/9408900/9408900a.png'
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
    artworkUrl: 'https://img.gamepress.gg/grandorder/FGOCEFull_9400180a.png?width=680'
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
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9401620/9401620a.png'
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
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9401590/9401590a.png'
  }
];

// ============================================================================
// CANONICAL BOND CRAFT ESSENCES (Awarded automatically upon reaching Bond 10)
// ============================================================================
export const BOND_CRAFT_ESSENCES: Record<string, CraftEssence> = {
  artoria_pendragon: {
    id: 'ce_bond_artoria_pendragon',
    name: 'Crown of Stars',
    rarity: 4,
    description: 'A shimmering silver crown bestowed upon the King of Knights. Even after Camelot fell to ruin, its starlight continues to illuminate the path forward beside her Master.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to Artoria Pendragon: Increases party Attack by 15% while on the field.',
    passiveType: 'buff_atk',
    passiveValue: 15,
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9300010/9300010a.png',
    isBondCe: true,
    bondServantId: 'artoria_pendragon',
    bondServantName: 'Artoria Pendragon'
  },
  altera: {
    id: 'ce_bond_altera',
    name: 'Eternal Solitude',
    rarity: 4,
    description: 'Standing upon the desolate wilderness, the King of Combat gazes into the horizon. No companion, no warmth, only the solemn path of destruction that carved a legacy across empires.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped on Altera: Increases party\'s and self attack by 20% while self is on the field.',
    passiveType: 'buff_atk',
    passiveValue: 20,
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9300110/9300110a.png',
    isBondCe: true,
    bondServantId: 'altera',
    bondServantName: 'Altera'
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
    effectText: 'When equipped to Gilgamesh: Increases Noble Phantasm Damage of all allies by 20% while on the field.',
    passiveType: 'np_damage',
    passiveValue: 20,
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9300210/9300210a.png',
    isBondCe: true,
    bondServantId: 'gilgamesh_archer',
    bondServantName: 'Gilgamesh'
  },
  scathach_lancer: {
    id: 'ce_bond_scathach_lancer',
    name: 'Gazing Upon Dún Scáith',
    rarity: 4,
    description: 'Looking out from the ramparts of Dún Scáith over the mist-veiled sea. For centuries she awaited one who could pierce her solitude, until a Master stood beside her in the Land of Shadows.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to Scáthach: Increases Quick Card effectiveness of all allies by 15% while she is on the field.',
    passiveType: 'quick_up',
    passiveValue: 15,
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9300440/9300440a.png',
    isBondCe: true,
    bondServantId: 'scathach_lancer',
    bondServantName: 'Scáthach'
  },
  jeanne_darc_ruler: {
    id: 'ce_bond_jeanne_darc_ruler',
    name: 'Revelation from Heaven',
    rarity: 4,
    description: 'A divine revelation descending upon Domrémy, guiding the humble country maiden across flaming battlefields to protect those who believe.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: "When equipped to Jeanne d'Arc: Increases Buster Card effectiveness of all allies by 15% while she is on the field.",
    passiveType: 'buster_up',
    passiveValue: 15,
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9300040/9300040a.png',
    isBondCe: true,
    bondServantId: 'jeanne_darc_ruler',
    bondServantName: "Jeanne d'Arc"
  },
  jeanne_alter: {
    id: 'ce_bond_jeanne_alter',
    name: 'Hell of Blazing Punishment',
    rarity: 4,
    description: 'The scorching inferno of hatred and vengeance born from the stake. Yet even amidst the raging flames of hell, an unspoken covenant binds the Dragon Witch to her Master.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: "When equipped to Jeanne d'Arc (Alter): Increases Buster Card performance of all allies by 15% while she is on the field.",
    passiveType: 'buster_up',
    passiveValue: 15,
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9301010/9301010a.png',
    isBondCe: true,
    bondServantId: 'jeanne_alter',
    bondServantName: "Jeanne d'Arc (Alter)"
  },
  mhx_alter: {
    id: 'ce_bond_mhx_alter',
    name: 'Dark Knight-Kun',
    rarity: 4,
    description: 'A plush Dark Knight doll crafted with affectionate simplicity. Hugging it brings calm and warmth to the exhausted Berserker after a long sugar-fueled mission.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to MHX Alter: Increases party\'s Attack against [Saber] class enemies by 20% while she is on the field.',
    passiveType: 'buff_atk',
    passiveValue: 20,
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9301590/9301590a.png',
    isBondCe: true,
    bondServantId: 'mhx_alter',
    bondServantName: 'Mysterious Heroine X Alter'
  },
  artoria_pendragon_alter: {
    id: 'ce_bond_artoria_pendragon_alter',
    name: 'Memories of the Dragon',
    rarity: 4,
    description: 'An obsidian dragon scale echoing the tyrannical roar of the corrupted King. A ruthless heart tempered only by the silent bond shared with Master.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to Artoria Alter: Increases own NP damage by 30% and grants 30% chance to reduce enemy defense by 5% for 3 turns on normal attack.',
    passiveType: 'np_damage',
    passiveValue: 30,
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9300050/9300050a.png',
    isBondCe: true,
    bondServantId: 'artoria_pendragon_alter',
    bondServantName: 'Artoria Pendragon (Alter)'
  },
  nero_claudius_saber: {
    id: 'ce_bond_nero_claudius_saber',
    name: 'Thunderous Applause',
    rarity: 4,
    description: 'The overwhelming applause that echoes from the Golden Theater. But of all the cheers in the empire, none matters more than the praise from the one she loves.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to Nero Claudius: Increases Arts Card effectiveness of all allies by 15% while she is on the field.',
    passiveType: 'arts_up',
    passiveValue: 15,
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9300230/9300230a.png',
    isBondCe: true,
    bondServantId: 'nero_claudius_saber',
    bondServantName: 'Nero Claudius'
  },
  emiya_archer: {
    id: 'ce_bond_emiya_archer',
    name: 'Hunter of the Red Plains',
    rarity: 4,
    description: 'The homing hound of Ulster, Hrunting, piercing the desolate crimson horizon. A weapon honed through countless battles to protect the bond he finally holds dear.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to EMIYA: Increases own NP damage by 30% and grants 30% chance to gain 5 critical stars when attacking.',
    passiveType: 'np_damage',
    passiveValue: 30,
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9300060/9300060a.png',
    isBondCe: true,
    bondServantId: 'emiya_archer',
    bondServantName: 'EMIYA'
  },
  cu_chulainn_lancer: {
    id: 'ce_bond_cu_chulainn_lancer',
    name: 'Star of Prophecy',
    rarity: 4,
    description: 'The destined star shining down on the child of light. Born under the prophecy of a brief but brilliant life, blazing proudest at his Master\'s side.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to Cú Chulainn: Increases own NP damage by 30% and grants 30% chance to increase critical damage by 10% (3 turns) when attacking.',
    passiveType: 'np_damage',
    passiveValue: 30,
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9300450/9300450a.png',
    isBondCe: true,
    bondServantId: 'cu_chulainn_lancer',
    bondServantName: 'Cú Chulainn'
  },
  karna_lancer: {
    id: 'ce_bond_karna_lancer',
    name: "Poor Man's Lamp",
    rarity: 4,
    description: 'A humble, fragile lamp casting gentle warmth into the shadows. Shining not with destructive solar brilliance, but with the quiet compassion of the Hero of Charity.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to Karna: Increases Arts, Buster, and Quick Card effectiveness of all allies by 8% while he is on the field.',
    passiveType: 'buster_up',
    passiveValue: 8,
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9300630/9300630a.png',
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
    name: 'Waiting in the Sky',
    rarity: 4,
    description: 'Leaning against the fence atop Misaki Hill beneath an endless azure sky. Magic bullets humming in tune with her heart as she waits for Master to catch up.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to Aoko Aozaki: Increases own NP damage by 30% and grants 1 [Magic Bullet] count every turn.',
    passiveType: 'np_damage',
    passiveValue: 30,
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9308240/9308240a.png',
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
  },
  luvria_greenharte: {
    id: 'ce_bond_luvria_greenharte',
    name: 'The Boundless Weave',
    rarity: 4,
    description: 'A wooden talisman carved from the ancient heartwood of Sylvanryth, pulsing with all four elemental paths. A keepsake reminding the Strongest Mage that true strength lies not in the nullification of reality, but in the warmth of the family she protects.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to Luvria Greenharte: Increases Arts Card effectiveness of all allies by 15% and increases own NP Damage by 20%.',
    passiveType: 'arts_up',
    passiveValue: 15,
    artworkUrl: 'https://ella.janitorai.com/media-approved/II1DtB1YFFjXHKcs8gU7q.webp',
    isBondCe: true,
    bondServantId: 'luvria_greenharte',
    bondServantName: 'Luvria Greenharte'
  },
  artoria_caster: {
    id: 'ce_bond_artoria_caster',
    name: 'The Promised Moment',
    rarity: 4,
    description: 'A quiet, serene moment under the azure sky with the girl of prophecy. Sharing tea, laughter, and the promise of tomorrow, far away from bells, pilgrimage, and calamitous battles.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: "When equipped to Artoria Caster: Increases party's attack by 10% and increases party's NP generation rate by 10% while self is on the field.",
    passiveType: 'buff_atk',
    passiveValue: 10,
    artworkUrl: 'https://ella.janitorai.com/media-approved/M_CtKrPvwydKIhD_A27Aq.webp',
    isBondCe: true,
    bondServantId: 'artoria_caster',
    bondServantName: 'Artoria Caster'
  },
  typhon_ephemeros: {
    id: 'ce_bond_typhon_ephemeros',
    name: 'The Ephemeral Fruit of Moirai',
    rarity: 4,
    description: 'The cursed fruit offered by the goddesses of fate. A trick of destiny that sealed the Progenitor Dragon, turning boundless strength into an inverted anti-grail that burns desires into ash.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to Typhon Ephemeros: Increases own NP damage by 30% and grants self Buff-On-Attack (When normal attacking: Increases own critical damage by 10% for 3 turns [activates first] and inflicts Curse with 200 damage for 3 turns to self [Demerit]).',
    passiveType: 'np_damage',
    passiveValue: 30,
    artworkUrl: 'https://ella.janitorai.com/media-approved/ooE7jWZ7K8iyxc9WJF21f.webp',
    isBondCe: true,
    bondServantId: 'typhon_ephemeros',
    bondServantName: 'Typhon Ephemeros'
  },
  typhon: {
    id: 'ce_bond_typhon_ephemeros',
    name: 'The Ephemeral Fruit of Moirai',
    rarity: 4,
    description: 'The cursed fruit offered by the goddesses of fate. A trick of destiny that sealed the Progenitor Dragon, turning boundless strength into an inverted anti-grail that burns desires into ash.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to Typhon Ephemeros: Increases own NP damage by 30% and grants self Buff-On-Attack (When normal attacking: Increases own critical damage by 10% for 3 turns [activates first] and inflicts Curse with 200 damage for 3 turns to self [Demerit]).',
    passiveType: 'np_damage',
    passiveValue: 30,
    artworkUrl: 'https://ella.janitorai.com/media-approved/ooE7jWZ7K8iyxc9WJF21f.webp',
    isBondCe: true,
    bondServantId: 'typhon_ephemeros',
    bondServantName: 'Typhon Ephemeros'
  },
  edmond: {
    id: 'ce_bond_edmond',
    name: 'Aegis of the Sunken Slums',
    rarity: 4,
    description: 'A colossal tower shield of dented titan-forged iron, etched with the tally marks of every ally shielded and every beast repelled. Held by the vanguard whose unbreakable resolve protects his comrades to the end.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to Edmond: Increases own Defense by 20%, applies Damage Cut (1,000) to all allies, and grants self Guts (revives with 20% HP, 1 time).',
    passiveType: 'def_up',
    passiveValue: 20,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp',
    isBondCe: true,
    bondServantId: 'edmond',
    bondServantName: 'Edmond'
  },
  van_gogh: {
    id: 'ce_bond_van_gogh',
    name: 'Self-Portrait At Chaldea',
    rarity: 4,
    description: 'A canvas painted under the pale fluorescent lights of Chaldea. Not with the frantic, feverish brushstrokes of Arles or Saint-Rémy, but with quiet, hesitant colors. A sunflower holding hands with a drop of water, gazing upon the Master who smiled at her first.',
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: 'When equipped to Van Gogh: Gains 8 critical stars every turn and increases party\'s critical damage by 15% while self is on the field.',
    passiveType: 'stars_per_turn',
    passiveValue: 8,
    artworkUrl: 'https://ella.janitorai.com/media-approved/-S9y-H-REfRKPTBMJUKxp.webp',
    isBondCe: true,
    bondServantId: 'van_gogh',
    bondServantName: 'Van Gogh'
  },
  tamamo_no_mae: {
    id: 'ce_bond_tamamo_no_mae',
    name: "Tamamo's Fan Club",
    rarity: 4,
    description: "A sacred guild established for the devoted followers of the peerless sun fox maiden. When held high by her Master, the radiance of the golden white fox blesses all allies with boundless spiritual energy.",
    bonusAtk: 100,
    bonusDef: 0,
    bonusHp: 100,
    atkBonus: 100,
    hpBonus: 100,
    effectText: "When equipped to Tamamo no Mae: Increases party's and self Arts performance by 15% while self is on the field.",
    passiveType: 'arts_up',
    passiveValue: 15,
    artworkUrl: 'https://static.atlasacademy.io/NA/CharaGraph/9302480/9302480a.png',
    isBondCe: true,
    bondServantId: 'tamamo_no_mae',
    bondServantName: 'Tamamo no Mae'
  }
};

export const CE_DEFAULT_ARTWORK = 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp';

/**
 * Canonical Servant ID to Bond CE key mapping.
 * Strictly maps canonical IDs and aliases to their exact Bond CE.
 */
const CANONICAL_SERVANT_TO_BOND_KEY: Record<string, string> = {
  altera: 'altera',
  attila: 'altera',
  etzel: 'altera',
  attila_the_hun: 'altera',
  saber_altera: 'altera',
  artoria_pendragon: 'artoria_pendragon',
  artoria: 'artoria_pendragon',
  saber_artoria: 'artoria_pendragon',
  artoria_pendragon_alter: 'artoria_pendragon_alter',
  artoria_alter: 'artoria_pendragon_alter',
  salter: 'artoria_pendragon_alter',
  artoria_caster: 'artoria_caster',
  castoria: 'artoria_caster',
  gilgamesh_archer: 'gilgamesh_archer',
  gilgamesh: 'gilgamesh_archer',
  scathach_lancer: 'scathach_lancer',
  scathach: 'scathach_lancer',
  jeanne_darc_ruler: 'jeanne_darc_ruler',
  jeanne: 'jeanne_darc_ruler',
  jeanne_alter: 'jeanne_alter',
  jalter: 'jeanne_alter',
  mhx_alter: 'mhx_alter',
  nero_claudius_saber: 'nero_claudius_saber',
  nero: 'nero_claudius_saber',
  emiya_archer: 'emiya_archer',
  emiya: 'emiya_archer',
  heracles_berserker: 'heracles_berserker',
  heracles: 'heracles_berserker',
  cu_chulainn_lancer: 'cu_chulainn_lancer',
  cu_chulainn: 'cu_chulainn_lancer',
  cu: 'cu_chulainn_lancer',
  karna_lancer: 'karna_lancer',
  karna: 'karna_lancer',
  adiosa_dragon_envoy: 'adiosa_dragon_envoy',
  adiosa: 'adiosa_dragon_envoy',
  aoko_aozaki: 'aoko_aozaki',
  aoko: 'aoko_aozaki',
  amamiya_no_chihaya_tenkohime: 'amamiya_no_chihaya_tenkohime',
  amamiya_no_chihaya: 'amamiya_no_chihaya_tenkohime',
  chihaya: 'amamiya_no_chihaya_tenkohime',
  tenkohime: 'amamiya_no_chihaya_tenkohime',
  lucia_lyozes: 'lucia_lyozes',
  lucia: 'lucia_lyozes',
  luvria_greenharte: 'luvria_greenharte',
  luvria: 'luvria_greenharte',
  edmond: 'edmond',
  edmond_tank: 'edmond',
  typhon_ephemeros: 'typhon_ephemeros',
  typhon: 'typhon_ephemeros',
  van_gogh: 'van_gogh',
  gogh: 'van_gogh',
  tamamo_no_mae: 'tamamo_no_mae',
  tamamo: 'tamamo_no_mae',
  caster_tamamo: 'tamamo_no_mae',
  mikokon: 'tamamo_no_mae',
  fox_wife: 'tamamo_no_mae'
};

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
  const normName = (servantName || '').toLowerCase().trim();
  
  // 1. Check strict canonical dictionary (highest precision, prevents Alter/Caster cross-matching)
  if (CANONICAL_SERVANT_TO_BOND_KEY[normId]) {
    const key = CANONICAL_SERVANT_TO_BOND_KEY[normId];
    if (BOND_CRAFT_ESSENCES[key]) return BOND_CRAFT_ESSENCES[key];
  }
  if (CANONICAL_SERVANT_TO_BOND_KEY[normName]) {
    const key = CANONICAL_SERVANT_TO_BOND_KEY[normName];
    if (BOND_CRAFT_ESSENCES[key]) return BOND_CRAFT_ESSENCES[key];
  }

  // 2. Direct match by templateId
  if (BOND_CRAFT_ESSENCES[normId]) {
    return BOND_CRAFT_ESSENCES[normId];
  }

  // 3. Exact matching against registered bond CEs (guarded against Alter/Caster mismatch)
  const isAlter = normId.includes('alter') || normName.includes('alter');
  const isCaster = normId.includes('caster') || normName.includes('caster');

  for (const [key, ce] of Object.entries(BOND_CRAFT_ESSENCES)) {
    const keyIsAlter = key.includes('alter') || (ce.bondServantName || '').toLowerCase().includes('alter');
    const keyIsCaster = key.includes('caster') || (ce.bondServantName || '').toLowerCase().includes('caster');

    if (isAlter !== keyIsAlter || isCaster !== keyIsCaster) {
      continue;
    }

    if (
      normId === key ||
      normId === ce.bondServantId?.toLowerCase() ||
      (normName && ce.bondServantName?.toLowerCase() === normName)
    ) {
      return ce;
    }
  }

  // 4. Procedurally generate custom Bond CE for custom/community servants
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
    title: 'Greater Grail Sanctum: Heroic Spirits & Mystic Codes',
    subtitle: 'Unified Altar: 50% Servants & 50% CEs (1% 5★ CE Rate)',
    description: 'Channel your Saint Quartz into the Greater Grail Altar to summon Heroic Spirits and forge legendary Craft Essences in equal measure!',
    featuredServantIds: [],
    featuredCeIds: ['ce_kaleidoscope', 'ce_black_grail', 'ce_formal_craft'],
    bannerType: 'standard',
    costPerPull: 3,
    costTenPull: 30,
    bannerArtUrl: 'https://ella.janitorai.com/media-approved/-fHihOhhCzye-LbbIz3AA.webp',
    rates: {
      ssrServant: 50.0,
      srServant: 0,
      rServant: 0,
      ssrCe: 1.0,
      srCe: 19.0,
      rCe: 80.0
    }
  }
];

export const craftEssences = CRAFT_ESSENCE_DATABASE;
export default CRAFT_ESSENCE_DATABASE;
