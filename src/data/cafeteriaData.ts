// Chaldea Cafeteria & Campus Hub - Data Definitions & Catalogs
// Includes 8 facility zones, raw ingredients, recipes, and visiting servant patrons.

export interface CafeteriaRoom {
  id: string;
  name: string;
  shortName: string;
  description: string;
  backgroundUrl: string;
  connections: string[]; // Adjacent room IDs
  availableIngredients: string[]; // Ingredient IDs that can be harvested/found here
  primaryActivityName: string;
  primaryActionVerb: string;
  ambientBgm: string;
}

export interface Ingredient {
  id: string;
  name: string;
  category: 'produce' | 'staple' | 'protein' | 'spice' | 'delicacy';
  description: string;
  emoji: string;
  rarity: 1 | 2 | 3 | 4 | 5;
  locationId: string;
  cooldownSeconds: number; // Respawn rate
}

export interface Recipe {
  id: string;
  name: string;
  emoji: string;
  description: string;
  requiredIngredients: { [ingredientId: string]: number };
  prepTimeSeconds: number;
  cookTimeSeconds: number;
  servings: number;
  difficulty: 'Novice' | 'Journeyman' | 'Master Chef' | 'Heroic Spirit';
  favoredBy: string[]; // Servant IDs or names
  buffEffect: {
    title: string;
    description: string;
    cardType?: 'Buster' | 'Arts' | 'Quick';
    statBonusPercent?: number;
    durationHours: number;
  };
}

export interface ServantPatron {
  id: string;
  name: string;
  servantClass: string;
  avatarUrl: string;
  spriteUrl?: string;
  cravingRecipeId: string;
  cravingName: string;
  personality: string;
  criticTitle: string;
  fallbackPraiseQuotes: string[];
  fallbackCritiqueQuotes: string[];
  fallbackWrongOrderQuotes: string[];
}

export interface AttendingDoctor {
  id: 'nightingale' | 'asclepius' | 'bb' | 'paracelsus';
  name: string;
  title: string;
  perkDescription: string;
  avatarUrl: string;
  spriteUrl: string;
  iconicQuotes: string[];
}

export const ATTENDING_DOCTORS: Record<string, AttendingDoctor> = {
  nightingale: {
    id: 'nightingale',
    name: 'Florence Nightingale',
    title: 'Head Nurse (Berserker)',
    perkDescription: '⚡ Rapid Sanitize: Bed rest duration reduced from 60 to 48 minutes (+25% recovery speed).',
    avatarUrl: 'https://static.atlasacademy.io/NA/Faces/f_7014000.png',
    spriteUrl: 'https://static.atlasacademy.io/NA/CharaFigure/7014000/7014000_merged.png',
    iconicQuotes: [
      '“Amputation is the cleanest cure for minor thermal burns! Hold still, Master!”',
      '“Sterilization is absolute! I will exterminate every pathogen and burn mark, even if it requires bone saws!”',
      '“Master, please rest immediately! If you attempt to leave this bed before recovery, I shall restrain you!”'
    ]
  },
  asclepius: {
    id: 'asclepius',
    name: 'Asclepius',
    title: 'God of Medicine (Caster)',
    perkDescription: '⚕️ Divine Cure: Instantly cleanses burns & grants +25% HP bonus on bed rest & salves.',
    avatarUrl: 'https://static.atlasacademy.io/NA/Faces/f_5043000.png',
    spriteUrl: 'https://static.atlasacademy.io/NA/CharaFigure/5043000/5043000_merged.png',
    iconicQuotes: [
      '“Tch. Smoke inhalation and second-degree burns? How careless. Lie down and drink this bitter decoction.”',
      '“I am the God of Medicine. As long as breath remains in your lungs, I will not permit Death to claim you.”',
      '“Do not question the prescription! Rest for an hour and let your cells regenerate under my supervision.”'
    ]
  },
  bb: {
    id: 'bb',
    name: 'BB (Nurse)',
    title: 'Devil Nurse (MoonCancer)',
    perkDescription: '💉 Devilish Pampering: Random chance for +20% bonus SQ shards or surprise treats.',
    avatarUrl: 'https://static.atlasacademy.io/NA/Faces/f_23001000.png',
    spriteUrl: 'https://static.atlasacademy.io/NA/CharaFigure/23001000/23001000_merged.png',
    iconicQuotes: [
      '“Yahoo~! Your benevolent Super Nurse BB-chan is on duty! Time for your mega-sized syringe injection~!”',
      '“Aww, did Senpai burn your little fingers on the stove? Lie down in bed and let BB-chan pamper you~!”',
      '“No sneakily getting out of bed, Senpai! Nurse BB has locked down your vitals until full rehabilitation!”'
    ]
  },
  paracelsus: {
    id: 'paracelsus',
    name: 'Paracelsus von Hohenheim',
    title: 'Philosopher Physician (Caster)',
    perkDescription: '🧪 Philosopher Transmutation: +50% Friend Points (1.5x FP multiplier) on all friend & service actions.',
    avatarUrl: 'https://static.atlasacademy.io/NA/Faces/f_5010000.png',
    spriteUrl: 'https://static.atlasacademy.io/NA/CharaFigure/5010000/5010000_merged.png',
    iconicQuotes: [
      '“Ah, Master. Allow me to prepare a philosophic tonic to soothe your wounds.”',
      '“The Azoth blade shall excise any taint. Please rest your body peacefully.”',
      '“Alchemy and medicine are one and the same. Trust in my elixirs, Master.”'
    ]
  }
};

export const CAFETERIA_ROOMS: Record<string, CafeteriaRoom> = {
  dining_hall: {
    id: 'dining_hall',
    name: 'Cafeteria Dining Hall & Serving Counter',
    shortName: 'Dining Hall',
    description: 'The bustling social heart of Chaldea. Long wooden tables line the hall where Servants and Masters gather to dine, argue, and celebrate.',
    backgroundUrl: 'https://ella.janitorai.com/media-approved/zSBTEebjWY17riuFyoWN7.webp',
    connections: ['kitchen_prep', 'kitchen_stove', 'staff_lounge', 'hallway'],
    availableIngredients: [],
    primaryActivityName: 'Serving Counter & Tables',
    primaryActionVerb: 'Present Dish',
    ambientBgm: 'Chaldea Lunchtime Melodies'
  },
  kitchen_prep: {
    id: 'kitchen_prep',
    name: 'Kitchen — Prep & Cutting Stations',
    shortName: 'Prep Counter',
    description: 'Stainless steel cutting boards, cleavers, and wide marble basins. Here ingredients are peeled, julienned, marinated, and readied for the flame.',
    backgroundUrl: 'https://ella.janitorai.com/media-approved/MN5Jt9xFPytUD0EAcCUgO.webp',
    connections: ['dining_hall', 'kitchen_stove', 'pantry', 'cold_storage'],
    availableIngredients: [],
    primaryActivityName: 'Shared Cutting Board & Prep Basin',
    primaryActionVerb: 'Chop & Prepare',
    ambientBgm: 'Kitchen Rhythm & Slicing'
  },
  kitchen_stove: {
    id: 'kitchen_stove',
    name: 'Kitchen — Stoves & Commercial Ovens',
    shortName: 'Stoves & Ovens',
    description: 'A wall of high-BTU gas ranges, heavy cast iron skillets, and bubbling cauldrons. The scent of roasted garlic and rich broth permeates the air.',
    backgroundUrl: 'https://ella.janitorai.com/media-approved/JCilim7R92jfy-l4IIdBd.webp',
    connections: ['kitchen_prep', 'dining_hall', 'pantry'],
    availableIngredients: [],
    primaryActivityName: 'Main Cooking Ranges & Simmer Pots',
    primaryActionVerb: 'Simmer & Stir',
    ambientBgm: 'Sizzling Flame & Simmering Stew'
  },
  pantry: {
    id: 'pantry',
    name: 'Pantry & Dry Ingredient Vault',
    shortName: 'Pantry Vault',
    description: 'Floor-to-ceiling wooden racks stocked with sacks of Miyama white rice, dried bonito flakes, hand-stretched noodles, and golden curry blocks.',
    backgroundUrl: 'https://ella.janitorai.com/media-approved/GEVKZJoJYmE-xqS0gLk4e.webp',
    connections: ['kitchen_prep', 'kitchen_stove', 'hallway'],
    availableIngredients: ['miyama_rice', 'golden_curry_block', 'udon_noodles', 'szechuan_peppercorn'],
    primaryActivityName: 'Dry Ingredient Shelves',
    primaryActionVerb: 'Gather Grains & Spices',
    ambientBgm: 'Quiet Storehouse Echoes'
  },
  greenhouse: {
    id: 'greenhouse',
    name: 'Hydroponics & Sacred Greenhouse',
    shortName: 'Sacred Greenhouse',
    description: 'Basking beneath magical UV grow-lamps, lush hydroponic terraces produce sweet Chaldean carrots, fragrant scallions, and holy Eden fruits.',
    backgroundUrl: 'https://ella.janitorai.com/media-approved/2dwl-AyRSkGIBPB0shl3Z.webp',
    connections: ['hallway', 'staff_lounge'],
    availableIngredients: ['chaldean_carrot', 'fresh_scallions', 'holy_eden_fruit', 'wild_forest_mushroom'],
    primaryActivityName: 'Hydroponic Terraces',
    primaryActionVerb: 'Harvest Fresh Produce',
    ambientBgm: 'Trickling Water & Gentle Breeze'
  },
  cold_storage: {
    id: 'cold_storage',
    name: 'Cold Storage & Deep Freezer',
    shortName: 'Cold Freezer',
    description: 'Sub-zero cryo-vault wrapped in frost wards. Prime dragon tenderloin, fresh seafood, and chilled churned butter are preserved in suspended stasis.',
    backgroundUrl: 'https://ella.janitorai.com/media-approved/WTFbTzIHbAwB9CabDJ0a0.webp',
    connections: ['kitchen_prep', 'hallway'],
    availableIngredients: ['dragon_steak', 'fuyuki_coastal_fish', 'churned_butter', 'fresh_eggs'],
    primaryActivityName: 'Cryo-Vault Shelves',
    primaryActionVerb: 'Forage Chilled Proteins',
    ambientBgm: 'Chilling Frost & Arctic Hum'
  },
  staff_lounge: {
    id: 'staff_lounge',
    name: 'Staff Lounge & Relaxation Break Room',
    shortName: 'Staff Lounge',
    description: 'Plush velvet couches, a low oak coffee table, and an antique record player. A cozy sanctuary where off-duty Masters rest, chat, and sip tea.',
    backgroundUrl: 'https://ella.janitorai.com/media-approved/CNCqmU0CcafjaBPgasMza.webp',
    connections: ['dining_hall', 'greenhouse', 'hallway', 'infirmary', 'restrooms'],
    availableIngredients: ['matcha_tea_leaves', 'sweet_honey'],
    primaryActivityName: 'Lounge Sofas & Tea Table',
    primaryActionVerb: 'Relax & Socialize',
    ambientBgm: 'Mellow Coffeehouse Jazz'
  },
  infirmary: {
    id: 'infirmary',
    name: 'Chaldea Medical Ward & Infirmary',
    shortName: 'Infirmary',
    description: 'The quiet sanctuary of Chaldea’s medical wing. Here Head Nurse Florence Nightingale, Asclepius, and Paracelsus attend to injured Masters with relentless devotion.',
    backgroundUrl: 'https://ella.janitorai.com/media-approved/XDmyTzNWI_uXspXLTgs1w.webp',
    connections: ['staff_lounge'],
    availableIngredients: [],
    primaryActivityName: 'Infirmary Beds & Medical Counter',
    primaryActionVerb: 'Recover & Receive Treatment',
    ambientBgm: 'Sterile Monitors & Quiet Resting Echoes'
  },
  hallway: {
    id: 'hallway',
    name: 'Central Hub Corridor & Crossroads',
    shortName: 'Central Hallway',
    description: 'The polished sterile white corridor connecting Chaldea’s civilian quarters to the culinary wing. Digital navigation boards display campus notices.',
    backgroundUrl: 'https://ella.janitorai.com/media-approved/K7uctz34BM7ZBAx_aNL0S.webp',
    connections: ['dining_hall', 'pantry', 'greenhouse', 'cold_storage', 'staff_lounge', 'restrooms'],
    availableIngredients: [],
    primaryActivityName: 'Directory Signpost',
    primaryActionVerb: 'Walk Through Corridor',
    ambientBgm: 'Footsteps & Distant Echoes'
  },
  restrooms: {
    id: 'restrooms',
    name: 'Chaldea Restrooms & Maintenance Wing',
    shortName: 'Chaldea Restrooms',
    description: 'Clean tiled lavatories, porcelain sinks, and gleaming mirrors. A quiet spot to freshen up—or the dreaded venue for Head Prefect disciplinary swirlies!',
    backgroundUrl: 'https://ella.janitorai.com/media-approved/_u98uV5gHMCeqFzcQgJ_f.webp',
    connections: ['hallway', 'staff_lounge'],
    availableIngredients: [],
    primaryActivityName: 'Porcelain Basins & Mirror Counter',
    primaryActionVerb: 'Wash & Refresh',
    ambientBgm: 'Echoing Tiles & Trickling Water'
  }
};

export const INGREDIENT_CATALOG: Record<string, Ingredient> = {
  miyama_rice: {
    id: 'miyama_rice',
    name: 'Miyama Koshihikari Rice',
    category: 'staple',
    description: 'Plump, glossy white rice cultivated in the sacred leylines of Miyama Town. Fluffy and fragrant.',
    emoji: '🍚',
    rarity: 1,
    locationId: 'pantry',
    cooldownSeconds: 20
  },
  golden_curry_block: {
    id: 'golden_curry_block',
    name: 'Golden Curry Roux Block',
    category: 'spice',
    description: 'Rich Japanese roux infused with thirty roasted spices and apple honey. An Emiya household staple.',
    emoji: '🍛',
    rarity: 2,
    locationId: 'pantry',
    cooldownSeconds: 45
  },
  chaldean_carrot: {
    id: 'chaldean_carrot',
    name: 'Sweet Chaldean Carrot',
    category: 'produce',
    description: 'Crisp root vegetable grown in the hydroponics terrace. Naturally sweet with a vibrant crimson hue.',
    emoji: '🥕',
    rarity: 1,
    locationId: 'greenhouse',
    cooldownSeconds: 20
  },
  fresh_scallions: {
    id: 'fresh_scallions',
    name: 'Aromatic Scallions',
    category: 'produce',
    description: 'Freshly harvested green scallions with a pungent, crisp aroma essential for finishing broths.',
    emoji: '🌱',
    rarity: 1,
    locationId: 'greenhouse',
    cooldownSeconds: 20
  },
  wild_forest_mushroom: {
    id: 'wild_forest_mushroom',
    name: 'Wild Shiitake Mushroom',
    category: 'produce',
    description: 'Earthy wood-grown mushrooms bursting with natural umami.',
    emoji: '🍄',
    rarity: 2,
    locationId: 'greenhouse',
    cooldownSeconds: 35
  },
  holy_eden_fruit: {
    id: 'holy_eden_fruit',
    name: 'Golden Eden Apple',
    category: 'delicacy',
    description: 'Rare miraculous fruit radiating a faint golden shimmer. Elevates desserts to divine tiers.',
    emoji: '🍎',
    rarity: 4,
    locationId: 'greenhouse',
    cooldownSeconds: 90
  },
  dragon_steak: {
    id: 'dragon_steak',
    name: 'Prime Wyvern Ribeye',
    category: 'protein',
    description: 'Marbled steak carved from a subdued French wyvern. Intensely flavorful and packed with prana.',
    emoji: '🥩',
    rarity: 3,
    locationId: 'cold_storage',
    cooldownSeconds: 60
  },
  fuyuki_coastal_fish: {
    id: 'fuyuki_coastal_fish',
    name: 'Fresh Fuyuki Salmon',
    category: 'protein',
    description: 'Silvery ocean catch from Fuyuki port. Perfect for grilling or delicate sashimi.',
    emoji: '🐟',
    rarity: 2,
    locationId: 'cold_storage',
    cooldownSeconds: 30
  },
  churned_butter: {
    id: 'churned_butter',
    name: 'Chaldean Cream Butter',
    category: 'staple',
    description: 'Golden churned butter with high fat content, giving sauces and pastries unmatched richness.',
    emoji: '🧈',
    rarity: 1,
    locationId: 'cold_storage',
    cooldownSeconds: 25
  },
  fresh_eggs: {
    id: 'fresh_eggs',
    name: 'Phoenix Farm Eggs',
    category: 'staple',
    description: 'Fresh golden-yolk eggs from sanctuary fowl. The cornerstone of fluffy omelets.',
    emoji: '🥚',
    rarity: 1,
    locationId: 'cold_storage',
    cooldownSeconds: 20
  },
  udon_noodles: {
    id: 'udon_noodles',
    name: 'Hand-Pulled Sanuki Udon',
    category: 'staple',
    description: 'Thick, chewy noodles with the perfect bite. The ultimate comfort food.',
    emoji: '🍜',
    rarity: 2,
    locationId: 'pantry',
    cooldownSeconds: 30
  },
  szechuan_peppercorn: {
    id: 'szechuan_peppercorn',
    name: 'Fiery Mapo Peppercorns',
    category: 'spice',
    description: 'Numbing, tear-inducing peppercorns favored exclusively by executor priests.',
    emoji: '🌶️',
    rarity: 3,
    locationId: 'pantry',
    cooldownSeconds: 45
  },
  matcha_tea_leaves: {
    id: 'matcha_tea_leaves',
    name: 'Ceremonial Uji Matcha',
    category: 'produce',
    description: 'Finely stone-ground ceremonial green tea leaves with a soothing, vegetal fragrance.',
    emoji: '🍵',
    rarity: 2,
    locationId: 'staff_lounge',
    cooldownSeconds: 40
  },
  sweet_honey: {
    id: 'sweet_honey',
    name: 'Wild Forest Honey',
    category: 'delicacy',
    description: 'Golden nectar harvested from enchanted wildflowers in the Simulation Garden.',
    emoji: '🍯',
    rarity: 2,
    locationId: 'staff_lounge',
    cooldownSeconds: 40
  },
  purified_charcoal: {
    id: 'purified_charcoal',
    name: 'Purified Hearth Charcoal',
    category: 'delicacy',
    description: 'Fine mineral charcoal scraped from clean ovens. Essential for water filtration and seasoning black buns.',
    emoji: '🪵',
    rarity: 2,
    locationId: 'kitchen_stove',
    cooldownSeconds: 30
  },
  phantasmal_dewdrop: {
    id: 'phantasmal_dewdrop',
    name: 'Phantasmal Dewdrop',
    category: 'delicacy',
    description: 'Shimmering magical dew harvested from greenhouse leaves at dawn.',
    emoji: '💧',
    rarity: 3,
    locationId: 'greenhouse',
    cooldownSeconds: 45
  },
  golden_honey_carrot: {
    id: 'golden_honey_carrot',
    name: 'Golden Honey-Carrot Hybrid',
    category: 'produce',
    description: 'A miraculous sweet cross-breed glowing with amber mana.',
    emoji: '🥕✨',
    rarity: 4,
    locationId: 'greenhouse',
    cooldownSeconds: 60
  },
  cursed_mandrake_radish: {
    id: 'cursed_mandrake_radish',
    name: 'Cursed Mandrake Radish',
    category: 'produce',
    description: 'A screeching root cross-bred under hydroponic lights. Packs immense umami.',
    emoji: '🌱💀',
    rarity: 3,
    locationId: 'greenhouse',
    cooldownSeconds: 45
  },
  aged_cheddar: {
    id: 'aged_cheddar',
    name: 'Aged Clock Tower Cheddar',
    category: 'staple',
    description: 'Sharp, crumbly aged cheese unearthed from dry storage crates.',
    emoji: '🧀',
    rarity: 3,
    locationId: 'pantry',
    cooldownSeconds: 45
  },
  vintage_cooking_wine: {
    id: 'vintage_cooking_wine',
    name: 'Vintage Chaldean Red',
    category: 'delicacy',
    description: 'A dusty bottle of cooking wine aged in subterranean cellars.',
    emoji: '🍷',
    rarity: 3,
    locationId: 'pantry',
    cooldownSeconds: 60
  }
};

export interface JukeboxTrack {
  id: string;
  title: string;
  artist: string;
  emoji: string;
  description: string;
  perkDescription: string;
  perkType: 'impatience_reduction' | 'quality_boost' | 'cmp_bonus' | 'forage_boost';
}

export const JUKEBOX_TRACKS: Record<string, JukeboxTrack> = {
  emiya_family: {
    id: 'emiya_family',
    title: "Today's Menu for the Emiya Family (OST)",
    artist: 'Chaldea Broadcast',
    emoji: '🍳',
    description: 'Gentle, acoustic guitar melodies that soothe the heart and bring peaceful domestic vibes.',
    perkDescription: '✨ -15% Patron Impatience Countdown (Servants wait longer with a smile)',
    perkType: 'impatience_reduction'
  },
  jazz_cafe: {
    id: 'jazz_cafe',
    title: 'Midnight Chaldean Jazz Lounge',
    artist: 'Salieri & Mozart Quartet',
    emoji: '🎷',
    description: 'Smooth double-bass and mellow piano chords creating an upscale Parisian bistro mood.',
    perkDescription: '✨ +10% Dish Culinary Quality bonus when plating',
    perkType: 'quality_boost'
  },
  carnival_phantasm: {
    id: 'carnival_phantasm',
    title: 'Super Affection (Carnival Phantasm OP)',
    artist: 'Neco-Arc & The Student Council',
    emoji: '🎪',
    description: 'Hyperactive upbeat brass and circus trumpets that throw the cafeteria into joyous chaos!',
    perkDescription: '✨ +25% Chaldea Merit Points (CMP) earned from all room activities',
    perkType: 'cmp_bonus'
  },
  grand_battle: {
    id: 'grand_battle',
    title: 'Grand Battle Symphonic Suite',
    artist: 'Chaldea Philharmonic Orchestra',
    emoji: '⚔️',
    description: 'Pounding timpani and soaring strings that make even chopping carrots feel like saving humanity.',
    perkDescription: '✨ +1 Bonus Yield on all room forage and rummage harvests',
    perkType: 'forage_boost'
  }
};

export const CHALDEA_KITCHEN_LORE: string[] = [
  '📖 **Vol 1: "Handling the King of Knights\' Appetite" by Sir Bedivere**\n*"Never attempt to replace genuine roast meat with mashed tubers. The ahoge twitches when deceived, and Excalibur begins to hum."*',
  '📖 **Vol 2: "The Art of the Kitchen Knife" by Anonymous Red Archer**\n*"Trace, on. Reinforce the edge with structural grasping magic. A clean cut seals the cellular walls of the onion so your Master does not weep."*',
  '📖 **Vol 3: "Spice as Penance" by Father Kotomine**\n*"Tears shed while consuming Mapo Tofu are not sorrow, but the soul shedding earthly attachments. Do not reach for the milk; embrace the burning."*',
  '📖 **Vol 4: "Sparrow\'s Guide to Kitchen Hygiene" by Beni-enma**\n*"A dirty kitchen floor brings disgrace to the Enma-tei! If I catch a Master leaving burned rice crust on the range, the dechi tongue-shears will come out, dechi!"*',
  '📖 **Vol 5: "Golden Royal Dining Protocol" by Gilgamesh**\n*"A king does not dine upon mere fuel; he consumes the very concept of abundance. If the wine lacks the sparkle of Babylonian vineyards, it shall be cast into the void."*',
  '📖 **Vol 6: "The Nurse\'s Sterilization Manifesto" by Florence Nightingale**\n*"Boil the pans at 100 degrees Celsius for 20 minutes! Bacteria is the enemy of all Masters! If any mold is detected, amputation of the affected pantry shelf is mandatory!"*'
];

export const RECIPES_CATALOG: Record<string, Recipe> = {
  golden_curry: {
    id: 'golden_curry',
    name: 'Golden Chaldean Beef Curry',
    emoji: '🍛',
    description: 'A steaming mountain of fragrant Japanese curry loaded with tender simmered beef, carrots, and fluffy rice.',
    requiredIngredients: {
      miyama_rice: 2,
      golden_curry_block: 1,
      chaldean_carrot: 2,
      dragon_steak: 1
    },
    prepTimeSeconds: 30,
    cookTimeSeconds: 120, // 2 minutes simmer
    servings: 5,
    difficulty: 'Journeyman',
    favoredBy: ['artoria_pendragon', 'emiya', 'fujimaru_ritsuka', 'mordred'],
    buffEffect: {
      title: 'Comfort of the Hearth',
      description: '+15% Buster & Arts Card Performance for 4 Hours',
      cardType: 'Buster',
      statBonusPercent: 15,
      durationHours: 4
    }
  },
  mapo_tofu_hell: {
    id: 'mapo_tofu_hell',
    name: 'Church Secret: Hellfire Mapo Tofu',
    emoji: '🌶️',
    description: 'A crimson cauldron of molten, mouth-numbing tofu simmering in pure chili oil. Merely smelling it causes tearing.',
    requiredIngredients: {
      szechuan_peppercorn: 2,
      fresh_scallions: 2,
      dragon_steak: 1
    },
    prepTimeSeconds: 40,
    cookTimeSeconds: 150,
    servings: 3,
    difficulty: 'Master Chef',
    favoredBy: ['kirei_kotomine', 'cu_chulainn'],
    buffEffect: {
      title: 'Spiritual Purge Endorphins',
      description: '+20% Critical Damage & Instant Death Immunity for 4 Hours',
      statBonusPercent: 20,
      durationHours: 4
    }
  },
  fluffy_omurice: {
    id: 'fluffy_omurice',
    name: 'Tornado Fluffy Omurice',
    emoji: '🍳',
    description: 'Golden butter-fried chicken rice crowned with a soft, silky tornado omelet that gently splits open upon contact.',
    requiredIngredients: {
      miyama_rice: 1,
      fresh_eggs: 2,
      churned_butter: 1,
      chaldean_carrot: 1
    },
    prepTimeSeconds: 25,
    cookTimeSeconds: 90,
    servings: 4,
    difficulty: 'Journeyman',
    favoredBy: ['artoria_pendragon_alter', 'jeanne_d_arc', 'rin_tohsaka'],
    buffEffect: {
      title: 'Chef’s Warmth',
      description: '+15% NP Gain & 5% HP Regen each turn for 4 Hours',
      cardType: 'Arts',
      statBonusPercent: 15,
      durationHours: 4
    }
  },
  seafood_udon: {
    id: 'seafood_udon',
    name: 'Coastal Fuyuki Dashi Udon',
    emoji: '🍜',
    description: 'Chewy handmade udon steeped in clear golden bonito dashi, topped with glazed salmon and crisp scallions.',
    requiredIngredients: {
      udon_noodles: 2,
      fuyuki_coastal_fish: 1,
      fresh_scallions: 1,
      wild_forest_mushroom: 1
    },
    prepTimeSeconds: 20,
    cookTimeSeconds: 80,
    servings: 4,
    difficulty: 'Novice',
    favoredBy: ['scathach', 'musashi_miyamoto', 'okita_souji'],
    buffEffect: {
      title: 'Ocean Cleansing',
      description: '+15% Quick Card Performance & +10% Star Generation for 4 Hours',
      cardType: 'Quick',
      statBonusPercent: 15,
      durationHours: 4
    }
  },
  golden_apple_tart: {
    id: 'golden_apple_tart',
    name: 'Eden Tart of the Golden Sun',
    emoji: '🥧',
    description: 'Flaky French butter pastry layered with paper-thin caramelized Eden apples and a drizzle of wildflower honey.',
    requiredIngredients: {
      holy_eden_fruit: 1,
      churned_butter: 1,
      sweet_honey: 1,
      fresh_eggs: 1
    },
    prepTimeSeconds: 45,
    cookTimeSeconds: 180,
    servings: 6,
    difficulty: 'Heroic Spirit',
    favoredBy: ['gilgamesh', 'ishtar', 'tamamo_no_mae', 'nero_claudius'],
    buffEffect: {
      title: 'Sovereign Gourmet',
      description: '+25% QP & Master EXP earned in all Battles for 6 Hours',
      statBonusPercent: 25,
      durationHours: 6
    }
  },
  ceremonial_matcha_set: {
    id: 'ceremonial_matcha_set',
    name: 'Chaldean Tea Ceremony Set',
    emoji: '🍵',
    description: 'Freshly whisked, frothy ceremonial matcha served alongside traditional sweet bean wagashi.',
    requiredIngredients: {
      matcha_tea_leaves: 2,
      sweet_honey: 1
    },
    prepTimeSeconds: 15,
    cookTimeSeconds: 40,
    servings: 4,
    difficulty: 'Novice',
    favoredBy: ['zhuge_liang', 'sasaki_kojirou', 'karna'],
    buffEffect: {
      title: 'Zen Tranquility',
      description: '+10% Defense & Command Seal Recovery Boost for 4 Hours',
      statBonusPercent: 10,
      durationHours: 4
    }
  },
  fruit_basket: {
    id: 'fruit_basket',
    name: 'Fresh Hydroponic Fruit Basket',
    emoji: '🧺',
    description: 'A wicker basket overflowing with fresh Golden Eden Apples and Wild Honey. Gift to injured friends in the Infirmary to reduce bed rest time!',
    requiredIngredients: {
      holy_eden_fruit: 1,
      sweet_honey: 1
    },
    prepTimeSeconds: 10,
    cookTimeSeconds: 15,
    servings: 1,
    difficulty: 'Novice',
    favoredBy: ['nightingale', 'asclepius', 'paracelsus'],
    buffEffect: {
      title: 'Restorative Care',
      description: 'Cuts remaining bed rest timer by 25% and awards Friend Points to both Masters when gifted in the Infirmary.',
      durationHours: 1
    }
  }
};

export interface ChaldeaShopItem {
  id: string;
  name: string;
  emoji: string;
  description: string;
  baseCostFP: number;
  maxLevel: number;
  upgradeType: 'extraStoves' | 'extraPrepCounters' | 'hydroponicLamps';
  perLevelBonus: string;
}

export const CHALDEA_SHOP_CATALOG: Record<string, ChaldeaShopItem> = {
  extra_stove: {
    id: 'extra_stove',
    name: 'Heavy Industrial Gas Stove',
    emoji: '🔥',
    description: 'Adds +2 additional cooking burner slots to your personal stove capacity line, allowing more simmering pots at once.',
    baseCostFP: 250,
    maxLevel: 3,
    upgradeType: 'extraStoves',
    perLevelBonus: '+2 Active Stove Slots'
  },
  extra_prep_counter: {
    id: 'extra_prep_counter',
    name: 'Marble Dual Prep Station',
    emoji: '🔪',
    description: 'Adds +1 parallel prep counter workspace, doubling your recipe kit assembly efficiency.',
    baseCostFP: 200,
    maxLevel: 3,
    upgradeType: 'extraPrepCounters',
    perLevelBonus: '+1 Parallel Prep Workstation'
  },
  hydroponic_uv_lamps: {
    id: 'hydroponic_uv_lamps',
    name: 'High-Output Magic UV Grow-Lamps',
    emoji: '💡',
    description: 'Upgrades Greenhouse hydroponics to yield +1 bonus fruit or produce whenever harvesting.',
    baseCostFP: 300,
    maxLevel: 3,
    upgradeType: 'hydroponicLamps',
    perLevelBonus: '+1 Bonus Harvest Produce'
  }
};

export const VISITING_PATRONS: ServantPatron[] = [
  {
    id: 'artoria_pendragon',
    name: 'Artoria Pendragon',
    servantClass: 'Saber',
    avatarUrl: 'https://static.wikia.nocookie.net/fategrandorder/images/5/52/Saber1.png',
    cravingRecipeId: 'golden_curry',
    cravingName: 'A towering mountain of Golden Curry',
    personality: 'Honorable King of Knights with an astronomical appetite and uncompromising devotion to hearty meals.',
    criticTitle: 'The Voracious King of Knights',
    fallbackPraiseQuotes: [
      'Master, this curry... The spice blend has penetrated the meat to its very core! A magnificent meal worthy of Camelot’s high feast. Refills, please!',
      'Mmm! Truly, your cooking warms not only the physical body but the spiritual core itself. I shall gladly accept five more bowls!'
    ],
    fallbackCritiqueQuotes: [
      'The meat is somewhat tough, Master... But do not worry. As a knight, I shall not leave a single grain of rice behind.',
      'A commendable effort, but the portion size is far too modest for an active knight in service!'
    ],
    fallbackWrongOrderQuotes: [
      'What is this, Master?! I specifically requested a mountain of Golden Curry, not this! A King cannot charge into battle without proper carbohydrates!',
      'Where is my curry?! As much as I appreciate food, bringing me the wrong dish when my stomach is roaring is treason-level negligence!'
    ]
  },
  {
    id: 'kirei_kotomine',
    name: 'Father Kotomine',
    servantClass: 'Ruler',
    avatarUrl: 'https://static.wikia.nocookie.net/fategrandorder/images/e/e0/Kotomine1.png',
    cravingRecipeId: 'mapo_tofu_hell',
    cravingName: 'Hellfire Mapo Tofu (Extreme Spice)',
    personality: 'Stoic executor priest who derives profound spiritual delight from agonizing, tear-inducing Sichuan spice.',
    criticTitle: 'The Spice Overseer',
    fallbackPraiseQuotes: [
      'Yorokobe, shounen. The burning agony in the throat... the numbness seizing the palate... Splendid. This suffering is truly pure.',
      'A dish that exposes the frailty of humanity. The tears streaming down your patrons’ faces are the greatest seasoning of all.'
    ],
    fallbackCritiqueQuotes: [
      'Faint... far too faint. It lacks the agony of true redemption. Pour another bottle of chili extract immediately.',
      'Tolerable, but where is the suffering? A mild meal has no place in the confessional.'
    ],
    fallbackWrongOrderQuotes: [
      'What is the meaning of this sweet, mild dish? Where is the excruciating Szechuan spice? You have deprived me of my righteous suffering, Master...',
      'This lacks any trace of chili extract. A sweet meal in place of Mapo Tofu Hellfire is a profound sin. Pray for forgiveness.'
    ]
  },
  {
    id: 'beni_enma',
    name: 'Beni-enma',
    servantClass: 'Saber',
    avatarUrl: 'https://static.wikia.nocookie.net/fategrandorder/images/3/3a/Beni-enma1.png',
    cravingRecipeId: 'seafood_udon',
    cravingName: 'Precision Coastal Fuyuki Dashi Udon',
    personality: 'Fierce sparrow proprietress of the Enma-tei inn and the undisputed Hell’s Kitchen judge of Chaldea.',
    criticTitle: 'The Hell’s Kitchen Gordon Ramsay',
    fallbackPraiseQuotes: [
      'Chirp! The dashi broth is clear like crystal springwater! The noodles retain their springiness! Even for a fledgeling apprentice, this earns four stars-dechi!',
      'Magnificent knife work on those scallions! Clean cut, no bruising of the cell walls. Enma-tei would proudly serve this-dechi!'
    ],
    fallbackCritiqueQuotes: [
      'What is this sloppy plating-dechi?! The dashi was boiled on too high a flame, clouding the sacred broth! Clean your station at once!',
      'Disastrous timing! The noodles grew soggy while you were idling! A cook’s mind must be sharper than their blade-dechi!'
    ],
    fallbackWrongOrderQuotes: [
      'Chirp?! I ordered Precision Coastal Dashi Udon, but you brought me this mismatched plate-dechi?! Back to the prep counter at once!',
      'Disastrous service-dechi! Bringing a customer the wrong dish violates the sacred laws of Enma-tei! Zero stars-dechi!'
    ]
  },
  {
    id: 'gilgamesh',
    name: 'Gilgamesh',
    servantClass: 'Archer',
    avatarUrl: 'https://static.wikia.nocookie.net/fategrandorder/images/4/4f/Gilgamesh1.png',
    cravingRecipeId: 'golden_apple_tart',
    cravingName: 'Eden Tart of the Golden Sun',
    personality: 'Golden King of Uruk whose standards exceed mortal comprehension. Refuses anything less than supreme royal luxury.',
    criticTitle: 'King of Heroes & Sovereign Gourmet',
    fallbackPraiseQuotes: [
      'Fwahahaha! Not bad for a mongrel! The caramelized glaze mimics the luster of Babylon’s treasury. I permit this offering to touch my lips.',
      'A golden treat fit to amuse the King. You may hold your head high, Master—Babylon approves of your craft today.'
    ],
    fallbackCritiqueQuotes: [
      'You dare offer such pedestrian fare to the King of Heroes?! The crust lacks the crispness of fine Sumerian bronze! Away with it!',
      'Hmph. Merely passable. Do not let your pride inflate, mongrel. You have much further to reach perfection.'
    ],
    fallbackWrongOrderQuotes: [
      'AHAHAHA! Are you attempting a comedy routine, mongrel?! You dare present this commoner meal when I demanded the Eden Tart of the Golden Sun?!',
      'Insolence! To bring the King of Heroes an unrequested dish... Gate of Babylon would open for lesser offenses! Take it away!'
    ]
  },
  {
    id: 'emiya',
    name: 'Emiya (Archer)',
    servantClass: 'Archer',
    avatarUrl: 'https://static.wikia.nocookie.net/fategrandorder/images/8/87/Emiya1.png',
    cravingRecipeId: 'fluffy_omurice',
    cravingName: 'Silky Tornado Fluffy Omurice',
    personality: 'Pragmatic veteran chef of Chaldea who watches over the kitchen like a protective, perfectionist mother.',
    criticTitle: 'The Head Chef of Fuyuki',
    fallbackPraiseQuotes: [
      'Well done. The egg hasn’t overcooked in the slightest—still custard-soft inside. You’ve been paying attention to heat control. I’m impressed.',
      'A balanced plate. Hearty, comforting, and prepared with care. You’re ready to run this counter on your own.'
    ],
    fallbackCritiqueQuotes: [
      'The pan wasn’t hot enough when you poured the eggs; they stuck to the side. Always preheat properly and mind the butter browning point.',
      'Edible, but rough around the edges. Come back to the prep counter and let’s review proper wrist flicking for the fold.'
    ],
    fallbackWrongOrderQuotes: [
      'Master, I distinctly ordered Silky Fluffy Omurice. Mixing up order tickets at the serving counter is an amateur mistake. Check the board next time.',
      'Sigh... As your senior in the kitchen, I\'m disappointed. Always double-check what the patron ordered before plating.'
    ]
  }
];

export interface RoomNpc {
  id: string;
  name: string;
  title: string;
  avatarUrl: string;
  dialogueIntro: string;
  tips: string[];
  commission?: {
    id: string;
    title: string;
    description: string;
    requiredIngredientId?: string;
    requiredCount?: number;
    rewardDescription: string;
  };
}

export const ROOM_NPCS: Record<string, RoomNpc> = {
  dining_hall: {
    id: 'ciel',
    name: 'Mysterious Executor C.I.E.L.',
    title: 'Dining Hall Quartermaster',
    avatarUrl: 'https://static.wikia.nocookie.net/fategrandorder/images/c/c1/Ciel1.png',
    dialogueIntro: 'Welcome to the Dining Hall, Master! Servants gather here when their stomachs rumble. Have you checked today\'s cravings?',
    tips: [
      'Artoria loves Golden Curry! Serving her preferred dish grants double Community Buff duration.',
      'Father Kotomine only orders Mapo Tofu Hellfire. Be sure to add extra Szechuan peppercorns!',
      'Gossip says Beni-enma is inspecting the Prep Counter today—keep your cutting boards spotless!'
    ],
    commission: {
      id: 'ciel_curry_order',
      title: 'Curry Reserve Supply',
      description: 'Bring 1 Golden Curry Block from the Pantry to keep the serving counter fully stocked.',
      requiredIngredientId: 'golden_curry_block',
      requiredCount: 1,
      rewardDescription: '2x Holy Eden Fruit & +15 Master Reputation'
    }
  },
  kitchen_prep: {
    id: 'beni_enma_npc',
    name: 'Beni-enma',
    title: 'Hell\'s Kitchen Inspector',
    avatarUrl: 'https://static.wikia.nocookie.net/fategrandorder/images/3/3a/Beni-enma1.png',
    dialogueIntro: 'Inspect your cleavers-dechi! High dish quality begins with immaculate knife precision at the cutting board.',
    tips: [
      'Chopping ingredients with a partner in the room increases assembly speed by 25%!',
      'Don\'t hoard ingredients in your apron. Deposit them in the Shared Basin so all Masters can assemble kits.',
      'Always sharpen your cleavers before prepping high-difficulty dishes like Golden Sun Tart!'
    ],
    commission: {
      id: 'beni_prep_task',
      title: 'Fresh Scallion Precision Prep',
      description: 'Deposit 2 Fresh Scallions into the Shared Basin for tonight\'s udon broth.',
      requiredIngredientId: 'fresh_scallions',
      requiredCount: 2,
      rewardDescription: '1x Sacred Dragon Flour & +20 Master Reputation'
    }
  },
  kitchen_stove: {
    id: 'emiya_npc',
    name: 'Emiya (Kitchen Captain)',
    title: 'Master Chef of Chaldea',
    avatarUrl: 'https://static.wikia.nocookie.net/fategrandorder/images/8/87/Emiya1.png',
    dialogueIntro: 'Welcome to the ranges, Master. Mind the flame temperature and don\'t leave simmering pots unattended.',
    tips: [
      'Stir the pot regularly! Each stir boosts Quality Score and prevents burning.',
      'When the timer turns green, plate immediately before the dish burns on the open flame!',
      'Working together with another Master allows a Dual Stir synergy for maximum +100 Quality.'
    ],
    commission: {
      id: 'emiya_stove_task',
      title: 'Stove Maintenance Fuel',
      description: 'Bring 1 Miyama Koshihikari Rice to fuel the rice cookers.',
      requiredIngredientId: 'miyama_rice',
      requiredCount: 1,
      rewardDescription: '1x Churned Butter & +15 Master Reputation'
    }
  },
  pantry: {
    id: 'boudica_npc',
    name: 'Boudica',
    title: 'Pantry Quartermaster',
    avatarUrl: 'https://static.wikia.nocookie.net/fategrandorder/images/5/52/Boudica1.png',
    dialogueIntro: 'Need extra spices or grains? Our dry vaults are always open to hard-working Masters.',
    tips: [
      'Check the Pantry drawers carefully—sometimes rare spices are tucked away behind the rice sacks.',
      'Golden Curry Blocks and Szechuan Peppercorns respawn regularly here.'
    ]
  },
  greenhouse: {
    id: 'nemo_npc',
    name: 'Captain Nemo',
    title: 'Hydroponics Specialist',
    avatarUrl: 'https://static.wikia.nocookie.net/fategrandorder/images/d/d4/Nemo1.png',
    dialogueIntro: 'The hydroponic terraces are thriving. Our magical grow-lamps yield the sweetest carrots in Chaldea.',
    tips: [
      'Calibrating the UV lights increases the harvest yield of Holy Eden Fruits!',
      'Gently watering the terraces resets ingredient gather cooldowns faster.'
    ]
  },
  cold_storage: {
    id: 'skadi_npc',
    name: 'Scáthach-Skadi',
    title: 'Deep Freezer Overseer',
    avatarUrl: 'https://static.wikia.nocookie.net/fategrandorder/images/8/87/Skadi1.png',
    dialogueIntro: 'It is delightfully cold here... Ice cream and frozen prime cuts remain frozen for eternity.',
    tips: [
      'Cold Storage is where high-grade Prime A5 Beef and Pure Mana Milk reside.',
      'Defrosting the freezer seals prevents frostbite and uncovers frozen treats.'
    ]
  },
  staff_lounge: {
    id: 'oberon_npc',
    name: 'Oberon',
    title: 'Relaxation Lounge Guest',
    avatarUrl: 'https://static.wikia.nocookie.net/fategrandorder/images/0/05/Oberon1.png',
    dialogueIntro: 'Ah, taking a break? The tea is hot, and the cushions are soft. Don\'t work yourself to exhaustion.',
    tips: [
      'Sipping tea in the Staff Lounge restores Master Energy and clears cooking debuffs.',
      'Cozy up on the sofas to exchange rumors with fellow Masters.'
    ]
  },
  hallway: {
    id: 'da_vinci_npc',
    name: 'Leonardo da Vinci',
    title: 'Chaldea Facility Director',
    avatarUrl: 'https://static.wikia.nocookie.net/fategrandorder/images/2/29/DaVinci1.png',
    dialogueIntro: 'Bonjour, Master! The cafeteria hub connects all sectors of Chaldea. Where are you heading today?',
    tips: [
      'Keep an eye on room activity logs to see where other Masters are cooking!',
      'You can ping fellow Masters to request assistance at the stoves.'
    ]
  },
  infirmary: {
    id: 'nightingale_npc',
    name: 'Florence Nightingale',
    title: 'Head Nurse of Chaldea',
    avatarUrl: 'https://static.wikia.nocookie.net/fategrandorder/images/f/f3/Nightingale1.png',
    dialogueIntro: '“Amputation is the cleanest cure for minor thermal burns. Hold still, Master!”',
    tips: [
      'Hospitalized Masters recover passively over time (10% HP per minute).',
      'Drinking Burn Salve brewed from Sacred Greenhouse herbs clears burns instantly!',
      'Visiting friends can click [Bring Fruit Basket] to cut your bed rest time in half.'
    ]
  }
};

export interface EnvironmentAction {
  id: string;
  name: string;
  emoji: string;
  description: string;
  effectMessage: string;
  rewardIngredientId?: string;
}

export const ROOM_ENVIRONMENT_ACTIONS: Record<string, EnvironmentAction[]> = {
  dining_hall: [
    {
      id: 'inspect_tables',
      name: 'Inspect High Tables & VIP Booths',
      emoji: '🔍',
      description: 'Search under the dining tables for leftover tips or dropped items.',
      effectMessage: 'You found a forgotten bag of Sweet Wild Honey left behind by Gilgamesh!',
      rewardIngredientId: 'sweet_honey'
    },
    {
      id: 'polish_silverware',
      name: 'Polish Dining Silverware & Napkins',
      emoji: '✨',
      description: 'Clean and set the dining tables to make patrons feel welcome.',
      effectMessage: 'You polished all the dining silverware! Dining Hall ambience boosted (+10% Patron Gratitude).'
    }
  ],
  kitchen_prep: [
    {
      id: 'sharpen_knives',
      name: 'Sharpen Cleavers & Paring Knives',
      emoji: '🔪',
      description: 'Run the cleavers along the whetstone for razor-sharp cutting precision.',
      effectMessage: 'You sharpened all the prep knives on the whetstone! Recipe kit assembly is now 20% faster.'
    },
    {
      id: 'clean_cutting_boards',
      name: 'Sanitize Marble Cutting Boards',
      emoji: '🧼',
      description: 'Scrub and sanitize the marble cutting counters.',
      effectMessage: 'You scrubbed the cutting boards spotless! Beni-enma nods in quiet approval.'
    }
  ],
  kitchen_stove: [
    {
      id: 'calibrate_burners',
      name: 'Calibrate Flame Burner Valves',
      emoji: '🔥',
      description: 'Adjust gas burner pressure for perfect even simmer temperatures.',
      effectMessage: 'You calibrated the gas stove valves! All active stove pots gain +10 Dish Quality.'
    },
    {
      id: 'inspect_spice_rack',
      name: 'Inspect Overhead Chef Spice Rack',
      emoji: '🧂',
      description: 'Rummage through Emiya\'s private spice cabinet.',
      effectMessage: 'You discovered a jar of rare Szechuan Peppercorns tucked behind the bay leaves!',
      rewardIngredientId: 'szechuan_peppercorn'
    }
  ],
  pantry: [
    {
      id: 'search_rice_sacks',
      name: 'Search Behind Vintage Grain Sacks',
      emoji: '📦',
      description: 'Look through stored crates in the pantry corners.',
      effectMessage: 'You uncovered a sack of premium Miyama Koshihikari Rice!',
      rewardIngredientId: 'miyama_rice'
    },
    {
      id: 'organize_shelves',
      name: 'Organize Dry Vault Shelves',
      emoji: '🪜',
      description: 'Stack flour sacks and curry blocks systematically.',
      effectMessage: 'You organized the dry vault shelves! All pantry items now respawn 25% faster.'
    }
  ],
  greenhouse: [
    {
      id: 'calibrate_uv_lamps',
      name: 'Calibrate Magical Grow-Lamps',
      emoji: '💡',
      description: 'Tune the UV wavelength for maximum hydroponic growth.',
      effectMessage: 'You tuned the grow-lamps! You harvested a rare Holy Eden Fruit!',
      rewardIngredientId: 'holy_eden_fruit'
    },
    {
      id: 'mist_terraces',
      name: 'Mist Hydroponic Terraces',
      emoji: '🌧️',
      description: 'Spray nutrient water across the carrot and scallion beds.',
      effectMessage: 'You misted the hydroponic crops! Fresh produce harvested into your apron pockets.'
    }
  ],
  cold_storage: [
    {
      id: 'defrost_seals',
      name: 'Defrost Deep Freezer Door Seals',
      emoji: '🧊',
      description: 'Chisel away frost build-up on the deep freezer latches.',
      effectMessage: 'You chiseled away the ice buildup! Uncovered 1x Pure Mana Milk from storage.',
      rewardIngredientId: 'mana_milk'
    }
  ],
  staff_lounge: [
    {
      id: 'brew_herbal_tea',
      name: 'Brew Pot of Chaldean Herbal Tea',
      emoji: '🫖',
      description: 'Steep fresh tea leaves in hot spring water for idling Masters.',
      effectMessage: 'You brewed a steaming teapot of Earl Grey! Relaxed the whole room.'
    }
  ],
  hallway: [
    {
      id: 'inspect_notice_board',
      name: 'Inspect Chaldea Cafeteria Notice Board',
      emoji: '📌',
      description: 'Read notes posted by kitchen staff and fellow Masters.',
      effectMessage: 'Notice Board reads: "Beni-enma rates today\'s Udon broth 5 Stars! Artoria is extra hungry."'
    }
  ],
  infirmary: [
    {
      id: 'sanitize_bandages',
      name: 'Sterilize Medical Bandages & Salves',
      emoji: '🩺',
      description: 'Assist Head Nurse Nightingale in preparing antiseptic compresses.',
      effectMessage: 'You sterilized the medical compresses! Nurse Nightingale nod with ferocious approval.'
    }
  ],
  restrooms: [
    {
      id: 'wash_face',
      name: 'Wash Face & Clean Soot',
      emoji: '🧼',
      description: 'Splash cold refreshing water on your face at the porcelain sink to clean away kitchen grease and soot stains.',
      effectMessage: 'You splashed cold water on your face! Cleansed soot stains and restored +10 HP.'
    },
    {
      id: 'check_reflection',
      name: 'Check Mirror Reflection & CMP Rank',
      emoji: '🪞',
      description: 'Gaze into the gleaming mirror to inspect your uniform, discipline standing, and Chaldea Merit Points rank.',
      effectMessage: 'You adjusted your uniform in the mirror with quiet confidence!'
    },
    {
      id: 'break_door_lock',
      name: 'Pick Restroom Door Lock',
      emoji: '🔓',
      description: 'Attempt to force or pick the bolt lock on the restroom door to rescue an imprisoned Master.',
      effectMessage: 'You rattled and unlatched the exterior lock mechanism!'
    }
  ]
};

export interface ChaldeaRankTier {
  rank: number;
  title: string;
  minCMP: number;
  emoji: string;
  description: string;
}

export const CHALDEA_RANK_TIERS: ChaldeaRankTier[] = [
  { rank: 1, title: 'Chaldea Head Prefect', minCMP: 300, emoji: '👑', description: 'Supreme authority on campus. Possesses disciplinary powers.' },
  { rank: 2, title: 'Head of Operations', minCMP: 300, emoji: '🎖️', description: 'Senior overseer of cafeteria duties.' },
  { rank: 3, title: 'Sous Chef', minCMP: 150, emoji: '👨‍🍳', description: 'Skilled culinary artisan and station supervisor.' },
  { rank: 4, title: 'Kitchen Hand', minCMP: 50, emoji: '🔪', description: 'Reliable helper chopping ingredients and tending fires.' },
  { rank: 5, title: 'Junior Master', minCMP: 0, emoji: '🌱', description: 'Novice apprentice exploring Chaldea facilities.' }
];
