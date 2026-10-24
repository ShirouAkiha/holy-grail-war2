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
}

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
    connections: ['dining_hall', 'greenhouse', 'hallway'],
    availableIngredients: ['matcha_tea_leaves', 'sweet_honey'],
    primaryActivityName: 'Lounge Sofas & Tea Table',
    primaryActionVerb: 'Relax & Socialize',
    ambientBgm: 'Mellow Coffeehouse Jazz'
  },
  hallway: {
    id: 'hallway',
    name: 'Central Hub Corridor & Crossroads',
    shortName: 'Central Hallway',
    description: 'The polished sterile white corridor connecting Chaldea’s civilian quarters to the culinary wing. Digital navigation boards display campus notices.',
    backgroundUrl: 'https://ella.janitorai.com/media-approved/K7uctz34BM7ZBAx_aNL0S.webp',
    connections: ['dining_hall', 'pantry', 'greenhouse', 'cold_storage', 'staff_lounge'],
    availableIngredients: [],
    primaryActivityName: 'Directory Signpost',
    primaryActionVerb: 'Walk Through Corridor',
    ambientBgm: 'Footsteps & Distant Echoes'
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
  }
};

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
    ]
  }
];
