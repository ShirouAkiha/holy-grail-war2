import { ServantTemplate, ServantClass } from '../types';

export const SERVANT_DATABASE: ServantTemplate[] = [
  // 5-Star SSR Servants
  {
    id: 'artoria_pendragon',
    name: 'Artoria Pendragon',
    title: 'King of Knights',
    servantClass: 'Saber',
    rarity: 5,
    baseHp: 28500,
    baseAtk: 11221,
    baseStats: { strength: 18, endurance: 17, agility: 14, mana: 19, luck: 12 },
    commandDeck: ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'],
    skills: [
      {
        id: 'mana_burst_a',
        name: 'Mana Burst A',
        cooldown: 5,
        description: 'Increases own Buster Card effectiveness by 30% for 1 turn.',
        effectType: 'buff_atk',
        value: 30,
        duration: 1,
        icon: '⚔️'
      },
      {
        id: 'charisma_b',
        name: 'Charisma B',
        cooldown: 5,
        description: 'Increases party attack power by 18% for 3 turns.',
        effectType: 'buff_atk',
        value: 18,
        duration: 3,
        icon: '👑'
      },
      {
        id: 'radiant_path',
        name: 'Radiant Path EX',
        cooldown: 6,
        description: 'Charges own NP gauge by 25% and gains 15 Critical Stars.',
        effectType: 'np_charge',
        value: 25,
        duration: 1,
        icon: '✨'
      }
    ],
    noblePhantasm: {
      name: 'Excalibur: Sword of Promised Victory',
      cardType: 'Buster',
      chant: 'Gathered breath of the planet, torrential light of life... EX---CALIBUR!',
      description: 'Deals devastating holy burst damage to all foes and recharges 20% NP gauge.',
      target: 'aoe',
      multiplier: 400,
      overchargeEffect: 'NP gauge refund +20%'
    },
    lore: 'The legendary King of Britain who pulled the sword of selection Caliburn from the stone. Bearer of the Holy Sword Excalibur.',
    summonQuote: 'Servant Saber. I ask of you, are you my Master?',
    battleStartQuote: 'My blade is drawn. For chivalry and the holy vow!',
    victoryQuote: 'Victory is decided. Let our honor remain untarnished.',
    defeatQuote: 'Forgive me, Master... I have failed to protect Britain...',
    avatarUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&auto=format&fit=crop&q=80',
    cardArtUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'gilgamesh_archer',
    name: 'Gilgamesh',
    title: 'King of Heroes',
    servantClass: 'Archer',
    rarity: 5,
    baseHp: 26000,
    baseAtk: 12280,
    baseStats: { strength: 16, endurance: 14, agility: 15, mana: 18, luck: 20 },
    commandDeck: ['Buster', 'Buster', 'Arts', 'Quick', 'Quick'],
    skills: [
      {
        id: 'collector_ex',
        name: 'Collector EX',
        cooldown: 5,
        description: 'Greatly increases Critical Star absorption and charges 25% NP.',
        effectType: 'np_charge',
        value: 25,
        duration: 2,
        icon: '💎'
      },
      {
        id: 'golden_rule_a',
        name: 'Golden Rule A',
        cooldown: 6,
        description: 'Increases own NP generation and charges 20% NP Gauge.',
        effectType: 'np_charge',
        value: 20,
        duration: 2,
        icon: '🪙'
      },
      {
        id: 'treasury_of_babylon',
        name: 'Treasury of Babylon',
        cooldown: 5,
        description: 'Gains 15 Critical Stars and increases Critical Damage by 25% for 2 turns.',
        effectType: 'crit_stars',
        value: 15,
        duration: 2,
        icon: '🗝️'
      }
    ],
    noblePhantasm: {
      name: 'Enuma Elish: Star of Creation that Split Heaven and Earth',
      cardType: 'Buster',
      chant: 'I speak of the beginning... Heaven and Earth split, and nothingness congratulated creation! ENUMA ELISH!',
      description: 'Unleashes the primordial spatial rupture of Ea, dealing colossal damage with anti-world bonus.',
      target: 'aoe',
      multiplier: 450,
      overchargeEffect: 'Bonus damage against Heroic Spirits'
    },
    lore: 'The oldest hero in human mythology and sovereign of Uruk who possessed all treasures of the ancient world.',
    summonQuote: 'Fuhahaha! You have managed to summon me, mongrel. Rejoice in my presence.',
    battleStartQuote: 'Know your place before the King of Heroes!',
    victoryQuote: 'A foregone conclusion. Even a worm could not expect to stand before Ea.',
    defeatQuote: 'Im-impossible... A mere mongrel defeated the King...?!',
    avatarUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=400&auto=format&fit=crop&q=80',
    cardArtUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'scathach_lancer',
    name: 'Scáthach',
    title: 'Queen of the Land of Shadows',
    servantClass: 'Lancer',
    rarity: 5,
    baseHp: 27500,
    baseAtk: 11375,
    baseStats: { strength: 17, endurance: 16, agility: 20, mana: 15, luck: 12 },
    commandDeck: ['Quick', 'Quick', 'Buster', 'Buster', 'Arts'],
    skills: [
      {
        id: 'wisdom_dun_scaith',
        name: 'Wisdom of Dún Scáith A+',
        cooldown: 5,
        description: 'Grants self Evade (1 turn) and increases Critical Star gather.',
        effectType: 'evade',
        value: 100,
        duration: 1,
        icon: '🛡️'
      },
      {
        id: 'primordial_rune',
        name: 'Primordial Rune',
        cooldown: 6,
        description: 'Increases one ally Quick Card effectiveness by 25% for 1 turn.',
        effectType: 'buff_atk',
        value: 25,
        duration: 1,
        icon: '⚡'
      },
      {
        id: 'god_slayer_a',
        name: 'God Slayer A+',
        cooldown: 5,
        description: 'Grants self Divine Killer and Undead Killer bonus (+30% ATK) for 1 turn.',
        effectType: 'buff_atk',
        value: 30,
        duration: 1,
        icon: '🔱'
      }
    ],
    noblePhantasm: {
      name: 'Gáe Bolg Alternative: Soaring Spear of Death',
      cardType: 'Quick',
      chant: 'Pierce through, thrust of sure mortality! Gáe Bolg Alternative!',
      description: 'Pinpoints the enemy with an inescapable double spear strike, causing guaranteed Stun and lethal puncture.',
      target: 'single',
      multiplier: 650,
      overchargeEffect: 'Stun foe for 1 turn + Critical Star burst'
    },
    lore: 'The immortal ruler and gatekeeper of the Land of Shadows who trained hero Cú Chulainn in spear mastery.',
    summonQuote: 'I am Scáthach. Show me that your spirit is worthy of walking beside a warrior of death.',
    battleStartQuote: 'Come. Let me test if you have grown beyond a novice.',
    victoryQuote: 'A good spar, but you still have centuries of training to undergo.',
    defeatQuote: 'Ah... is this the end I have long sought...?',
    avatarUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=80',
    cardArtUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'jeanne_darc_ruler',
    name: 'Jeanne d\'Arc',
    title: 'Holy Maiden of Orleans',
    servantClass: 'Ruler',
    rarity: 5,
    baseHp: 34000,
    baseAtk: 9593,
    baseStats: { strength: 14, endurance: 20, agility: 13, mana: 18, luck: 15 },
    commandDeck: ['Arts', 'Arts', 'Arts', 'Buster', 'Quick'],
    skills: [
      {
        id: 'revelation_a',
        name: 'Revelation A',
        cooldown: 6,
        description: 'Gains 12 Critical Stars per turn for 3 turns through divine intuition.',
        effectType: 'crit_stars',
        value: 12,
        duration: 3,
        icon: '🕊️'
      },
      {
        id: 'true_name_discernment',
        name: 'True Name Discernment B',
        cooldown: 5,
        description: 'Greatly reduces enemy Noble Phantasm strength by 25% for 1 turn.',
        effectType: 'buff_def',
        value: 25,
        duration: 1,
        icon: '📜'
      },
      {
        id: 'divine_blessing',
        name: 'Divine Grace A+',
        cooldown: 5,
        description: 'Heals self and allies for 3500 HP and clears debuffs.',
        effectType: 'heal',
        value: 3500,
        duration: 1,
        icon: '💖'
      }
    ],
    noblePhantasm: {
      name: 'Luminosité Eternelle: God is Here With Me',
      cardType: 'Arts',
      chant: 'My Lord... I entrust this flag to you! Luminosité Eternelle!',
      description: 'Unfurls the sacred banner, granting absolute Invincibility to allies for 1 turn and massive DEF boost.',
      target: 'aoe',
      multiplier: 0,
      overchargeEffect: 'Team Invincibility (1 turn) + 30% DEF + 2000 HP Regen'
    },
    lore: 'The saint of France who received the voice of the Lord and liberated Orleans during the Hundred Years\' War.',
    summonQuote: 'Servant Ruler, Jeanne d\'Arc. The Holy Grail War requires an arbiter; I shall safeguard this pact.',
    battleStartQuote: 'The Lord protects the righteous. Raise your banners!',
    victoryQuote: 'Let us offer our prayers of gratitude for this blessed triumph.',
    defeatQuote: 'Even if my light fades, the holy flag will never fall...',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80',
    cardArtUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80'
  },

  // 4-Star SR Servants
  {
    id: 'emiya_archer',
    name: 'EMIYA',
    title: 'Wrought Iron Hero',
    servantClass: 'Archer',
    rarity: 4,
    baseHp: 23500,
    baseAtk: 9398,
    baseStats: { strength: 14, endurance: 14, agility: 16, mana: 15, luck: 11 },
    commandDeck: ['Arts', 'Arts', 'Arts', 'Buster', 'Quick'],
    skills: [
      {
        id: 'mind_eye_true',
        name: 'Mind\'s Eye (True) B',
        cooldown: 6,
        description: 'Grants self Evade for 1 turn and increases DEF by 18% for 3 turns.',
        effectType: 'evade',
        value: 100,
        duration: 1,
        icon: '👁️'
      },
      {
        id: 'clarairvoyance_c',
        name: 'Hawkeye B+',
        cooldown: 6,
        description: 'Increases Critical Star generation and Critical Damage by 30% for 2 turns.',
        effectType: 'crit_stars',
        value: 30,
        duration: 2,
        icon: '🎯'
      },
      {
        id: 'projection_magecraft',
        name: 'Projection Magecraft A',
        cooldown: 5,
        description: 'Increases own Buster, Arts, and Quick card effectiveness by 25% for 1 turn.',
        effectType: 'buff_atk',
        value: 25,
        duration: 1,
        icon: '⚔️'
      }
    ],
    noblePhantasm: {
      name: 'Unlimited Blade Works: Infinite Creation of Swords',
      cardType: 'Buster',
      chant: 'I am the bone of my sword. Steel is my body and fire is my blood... UNLIMITED BLADE WORKS!',
      description: 'Deploys a Reality Marble containing infinite projected blades that rain down upon all enemies.',
      target: 'aoe',
      multiplier: 380,
      overchargeEffect: 'Reduces enemy ATK by 20% + high star drop'
    },
    lore: 'A nameless Guardian forged in steel and idealism who commands the pinnacle of projection magecraft.',
    summonQuote: 'Servant Archer. I have answered your summons. Well, let\'s see how far your ideals take us.',
    battleStartQuote: 'Trace on. Replicating the ultimate armaments.',
    victoryQuote: 'Just another cleanup job. Don\'t get cocky, Master.',
    defeatQuote: 'My steel has cracked... A fitting end for a fake.',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    cardArtUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'heracles_berserker',
    name: 'Heracles',
    title: 'Great Hero of Olympus',
    servantClass: 'Berserker',
    rarity: 4,
    baseHp: 22000,
    baseAtk: 10655,
    baseStats: { strength: 20, endurance: 18, agility: 14, mana: 10, luck: 14 },
    commandDeck: ['Buster', 'Buster', 'Buster', 'Arts', 'Quick'],
    skills: [
      {
        id: 'valor_a',
        name: 'Valor A+',
        cooldown: 5,
        description: 'Increases own Attack by 25% for 3 turns and grants mental debuff immunity.',
        effectType: 'buff_atk',
        value: 25,
        duration: 3,
        icon: '🦁'
      },
      {
        id: 'minds_eye_fake',
        name: 'Mind\'s Eye (Fake) B',
        cooldown: 6,
        description: 'Grants self Evade for 1 turn and increases Critical Damage.',
        effectType: 'evade',
        value: 100,
        duration: 1,
        icon: '👁️'
      },
      {
        id: 'battle_continuation_a',
        name: 'Battle Continuation A',
        cooldown: 7,
        description: 'Grants self Guts (Revive with 3000 HP on lethal damage).',
        effectType: 'heal',
        value: 3000,
        duration: 5,
        icon: '🩸'
      }
    ],
    noblePhantasm: {
      name: 'Nine Lives: Shooting the Hundred Heads',
      cardType: 'Buster',
      chant: '■■■■■■■■■■■■---!!! (ROOOOOAAAR)',
      description: 'Unleashes 9 simultaneous supersonic crushing blows with his gigantic stone slab blade.',
      target: 'single',
      multiplier: 600,
      overchargeEffect: 'Reduces target DEF by 20% for 3 turns'
    },
    lore: 'The greatest hero of Greek mythology who completed the Twelve Labors through superhuman fortitude.',
    summonQuote: '■■■■■■■■■■! (The giant nods respectfully as the earth trembles beneath his feet).',
    battleStartQuote: 'ROOOOOOAAAARRRR!',
    victoryQuote: '■■■■■■... (Breathes heavily while standing atop the pulverized battlefield).',
    defeatQuote: '■■■■... (Crumbles into golden embers with unyielding dignity).',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
    cardArtUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'cu_chulainn_lancer',
    name: 'Cú Chulainn',
    title: 'Hound of Culann',
    servantClass: 'Lancer',
    rarity: 3,
    baseHp: 19500,
    baseAtk: 7239,
    baseStats: { strength: 15, endurance: 15, agility: 19, mana: 12, luck: 10 },
    commandDeck: ['Quick', 'Quick', 'Arts', 'Buster', 'Buster'],
    skills: [
      {
        id: 'protection_from_arrows',
        name: 'Protection from Arrows B',
        cooldown: 5,
        description: 'Grants self 2 turns of Evade and increases DEF by 16% for 3 turns.',
        effectType: 'evade',
        value: 100,
        duration: 2,
        icon: '🛡️'
      },
      {
        id: 'battle_continuation_b',
        name: 'Guts B',
        cooldown: 7,
        description: 'Grants self Guts status (Revive with 2000 HP).',
        effectType: 'heal',
        value: 2000,
        duration: 5,
        icon: '🩸'
      },
      {
        id: 'disengage_c',
        name: 'Disengage C',
        cooldown: 5,
        description: 'Removes own debuffs and recovers 2500 HP.',
        effectType: 'heal',
        value: 2500,
        duration: 1,
        icon: '💨'
      }
    ],
    noblePhantasm: {
      name: 'Gáe Bolg: Barbed Spear that Pierces with Death',
      cardType: 'Quick',
      chant: 'Your heart is mine! Gáe... BOLG!',
      description: 'Reverses causality so the heart is pierced before the spear is thrust. Inflicts high single-target puncture.',
      target: 'single',
      multiplier: 600,
      overchargeEffect: 'Instant death chance + DEF down 20%'
    },
    lore: 'The tragic Celtic warrior hero of the Ulster cycle who wielded the cursed red spear Gáe Bolg.',
    summonQuote: 'Yo! Servant Lancer. Call me the Hound of Culann. Let\'s have some fun in this war!',
    battleStartQuote: 'Come on, don\'t disappoint me. Let\'s see what you\'ve got!',
    victoryQuote: 'Tch, over already? Barely broke a sweat.',
    defeatQuote: 'Damn it... pierced my own rule... Master, fall back...',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=80',
    cardArtUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80'
  },

  // Custom Lore & Server Meme Servants
  {
    id: 'terminal_saber_linus',
    name: 'Linus (Terminal Saber)',
    title: 'Daemon Lord of Kernel Space',
    servantClass: 'Saber',
    rarity: 5,
    baseHp: 27000,
    baseAtk: 11950,
    baseStats: { strength: 17, endurance: 15, agility: 18, mana: 19, luck: 15 },
    commandDeck: ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'],
    skills: [
      {
        id: 'sudo_force',
        name: 'sudo rm -rf /root',
        cooldown: 5,
        description: 'Increases own Attack by 25% and grants Invincible pierce for 1 turn.',
        effectType: 'buff_atk',
        value: 25,
        duration: 1,
        icon: '💻'
      },
      {
        id: 'git_rebase_master',
        name: 'Git Rebase --force',
        cooldown: 6,
        description: 'Clears all status debuffs and grants 25% NP Charge + 15 Stars.',
        effectType: 'np_charge',
        value: 25,
        duration: 1,
        icon: '🌿'
      },
      {
        id: 'flame_war_c',
        name: 'LKML Code Review Roar',
        cooldown: 5,
        description: 'Stuns the opposing enemy for 1 turn with scathing emotional damage.',
        effectType: 'stun',
        value: 100,
        duration: 1,
        icon: '🔥'
      }
    ],
    noblePhantasm: {
      name: 'KERNEL PANIC: Out of Memory Killer',
      cardType: 'Buster',
      chant: 'Null pointer exception encountered... Killing process ID 1! KERNEL PANIC!',
      description: 'Terminates all running enemy processes with catastrophic memory leak damage.',
      target: 'aoe',
      multiplier: 400,
      overchargeEffect: 'Stun all enemies (1 turn) + 20% DEF shred'
    },
    lore: 'The mythical architect of Unix kernels who was elevated to the Throne of Heroes after reviewing 100,000 bad pull requests.',
    summonQuote: 'I am Servant Saber. Stop talking about user-space abstractions and show me the clean C code.',
    battleStartQuote: 'Compiling your demise with zero warning flags.',
    victoryQuote: 'Build passed with 0 errors. As expected.',
    defeatQuote: 'Core dumped (Segmentation fault)...',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    cardArtUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80',
    isCustomOrMeme: true
  },
  {
    id: 'discord_mod_assassin',
    name: 'Shadow Mod @everyone',
    title: 'Wielder of the Ban Hammer',
    servantClass: 'Assassin',
    rarity: 4,
    baseHp: 22500,
    baseAtk: 9800,
    baseStats: { strength: 15, endurance: 13, agility: 19, mana: 16, luck: 14 },
    commandDeck: ['Quick', 'Quick', 'Quick', 'Arts', 'Buster'],
    skills: [
      {
        id: 'slowmode_10m',
        name: 'Slowmode: 10 Minutes',
        cooldown: 5,
        description: 'Reduces enemy Speed & Crit Star drop by 30% for 2 turns.',
        effectType: 'buff_def',
        value: 30,
        duration: 2,
        icon: '⏳'
      },
      {
        id: 'delete_message',
        name: 'Message Purge (100 msgs)',
        cooldown: 6,
        description: 'Grants self 1 turn of Evade and generates 20 Crit Stars.',
        effectType: 'evade',
        value: 100,
        duration: 1,
        icon: '🗑️'
      },
      {
        id: 'unauthorized_ping',
        name: 'Ghost Ping @Master',
        cooldown: 5,
        description: 'Gains 25% Attack power and increases Quick performance by 20%.',
        effectType: 'buff_atk',
        value: 25,
        duration: 1,
        icon: '🔔'
      }
    ],
    noblePhantasm: {
      name: 'BAN HAMMER: Perma-Mute Protocol',
      cardType: 'Quick',
      chant: 'Rule 3 violated: No unsolicited memes in #general... BEGONEEEEE!',
      description: 'Lethally strikes the target and locks their active skills for 2 turns.',
      target: 'single',
      multiplier: 650,
      overchargeEffect: 'Skill Lock (2 turns) + 100% Crit Star gain'
    },
    lore: 'Legendary lurker of voice channels who maintains server peace through absolute ruthless moderation.',
    summonQuote: 'You called? Make sure you read the #rules channel before issuing any orders.',
    battleStartQuote: 'One warning. That\'s all you get.',
    victoryQuote: 'User has been kicked from the server. Peace is restored.',
    defeatQuote: 'My Discord Nitro... expired...?!',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
    cardArtUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
    isCustomOrMeme: true
  },
  {
    id: 'coffee_berserker_caffeine',
    name: 'Espresso (Caffeine Berserker)',
    title: 'High-Octane Shift Worker',
    servantClass: 'Berserker',
    rarity: 4,
    baseHp: 21500,
    baseAtk: 10900,
    baseStats: { strength: 19, endurance: 12, agility: 20, mana: 14, luck: 11 },
    commandDeck: ['Buster', 'Buster', 'Buster', 'Quick', 'Arts'],
    skills: [
      {
        id: 'quad_shot_venti',
        name: 'Quad Shot Venti Blonde',
        cooldown: 5,
        description: 'Increases Buster card damage by 25% and Crit Rate by 30% for 2 turns.',
        effectType: 'buff_atk',
        value: 25,
        duration: 2,
        icon: '☕'
      },
      {
        id: 'no_sleep_grind',
        name: 'All-Nighter Deadline Focus',
        cooldown: 6,
        description: 'Heals 3000 HP and grants Guts (Revive with 1500 HP).',
        effectType: 'heal',
        value: 3000,
        duration: 3,
        icon: '⚡'
      },
      {
        id: 'sugar_rush_crash',
        name: 'Tachypnea Tremor Rush',
        cooldown: 5,
        description: 'Increases Attack by 25% for 1 turn (Self-inflicts minor defense drop).',
        effectType: 'buff_atk',
        value: 25,
        duration: 1,
        icon: '🌪️'
      }
    ],
    noblePhantasm: {
      name: 'DEATH WISH BREW: 900mg Heart Palpitation',
      cardType: 'Buster',
      chant: 'I HAVE NOT SLEPT SINCE TUESDAY! MAXIMUM CAFFEINE OVERDRIVE!',
      description: 'Explodes into a berserk blur of hyper-energetic strikes, flattening the opponent.',
      target: 'single',
      multiplier: 600,
      overchargeEffect: 'Gain 30 Critical Stars + 15% ATK buff'
    },
    lore: 'The spirit of every programmer, medical resident, and student powered entirely by pure dark roast beans.',
    summonQuote: 'DO YOU HAVE A KEURIG? I REQUIRE DARK ROAST IMMEDIATELY.',
    battleStartQuote: 'I CAN HEAR COLORS AND MOVE AT THE SPEED OF LIGHT!',
    victoryQuote: 'HA! Still have 4 hours before the caffeine wears off!',
    defeatQuote: 'The... caffeine crash... has arrived... *falls asleep*',
    avatarUrl: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=400&auto=format&fit=crop&q=80',
    cardArtUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80',
    isCustomOrMeme: true
  }
];
