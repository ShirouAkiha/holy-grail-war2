import { ServantTemplate, ServantClass, PassiveSkill } from '../types';

export function getDefaultClassPassives(servantClass: ServantClass): PassiveSkill[] {
  switch (servantClass) {
    case 'Saber':
      return [
        {
          name: 'Magic Resistance B',
          type: 'magic_resistance',
          value: 17.5,
          rank: 'B',
          description: 'Increases debuff resistance by 17.5% (chance to nullify incoming debuffs).'
        },
        {
          name: 'Riding C',
          type: 'riding',
          value: 6,
          rank: 'C',
          description: 'Increases Quick Card effectiveness by 6%.'
        }
      ];
    case 'Archer':
      return [
        {
          name: 'Independent Action B',
          type: 'independent_action',
          value: 8,
          rank: 'B',
          description: 'Increases Critical Strike Damage by 8%.'
        },
        {
          name: 'Magic Resistance C',
          type: 'magic_resistance',
          value: 15,
          rank: 'C',
          description: 'Increases debuff resistance by 15%.'
        }
      ];
    case 'Lancer':
      return [
        {
          name: 'Magic Resistance B',
          type: 'magic_resistance',
          value: 17.5,
          rank: 'B',
          description: 'Increases debuff resistance by 17.5%.'
        }
      ];
    case 'Rider':
      return [
        {
          name: 'Riding A',
          type: 'riding',
          value: 10,
          rank: 'A',
          description: 'Increases Quick Card effectiveness by 10%.'
        },
        {
          name: 'Magic Resistance C',
          type: 'magic_resistance',
          value: 15,
          rank: 'C',
          description: 'Increases debuff resistance by 15%.'
        }
      ];
    case 'Caster':
      return [
        {
          name: 'Territory Creation A',
          type: 'territory_creation',
          value: 10,
          rank: 'A',
          description: 'Increases Arts Card effectiveness by 10%.'
        },
        {
          name: 'Item Construction B',
          type: 'item_construction',
          value: 8,
          rank: 'B',
          description: 'Increases debuff success rate by 8%.'
        }
      ];
    case 'Assassin':
      return [
        {
          name: 'Presence Concealment A',
          type: 'presence_concealment',
          value: 15,
          rank: 'A',
          description: 'Increases Critical Star drop rate by 15% and grants +3 bonus stars on attacks.'
        }
      ];
    case 'Berserker':
      return [
        {
          name: 'Madness Enhancement B',
          type: 'madness_enhancement',
          value: 8,
          rank: 'B',
          description: 'Permanently increases Buster Card damage by 8%.'
        }
      ];
    case 'Ruler':
      return [
        {
          name: 'Magic Resistance A',
          type: 'magic_resistance',
          value: 20,
          rank: 'A',
          description: 'Increases debuff resistance by 20%.'
        }
      ];
    case 'Avenger':
      return [
        {
          name: 'Avenger B',
          type: 'avenger',
          value: 16,
          rank: 'B',
          description: 'Increases NP gain when taking damage (+16% NP refund on received attacks).'
        },
        {
          name: 'Oblivion Correction B',
          type: 'oblivion_correction',
          value: 8,
          rank: 'B',
          description: 'Increases Critical Strike Damage by 8%.'
        }
      ];
    default:
      return [
        {
          name: 'Independent Action C',
          type: 'independent_action',
          value: 6,
          rank: 'C',
          description: 'Increases Critical Strike Damage by 6%.'
        }
      ];
  }
}

/**
 * Resolves active/unlocked passive skills for a servant based on their Bond level.
 * Rule: Maximum of 2 passive skills can be held per Servant.
 * - Passive 1 (index 0): Unlocked from Bond Lv. 1
 * - Passive 2 (index 1): Unlocks ONLY after reaching Bond Lv. 5 (Bond Lv >= 5)
 */
export function getUnlockedPassives(
  passivesOrClass: PassiveSkill[] | ServantClass | undefined,
  bondLevel: number = 1
): PassiveSkill[] {
  if (!passivesOrClass) return [];

  const raw: PassiveSkill[] = Array.isArray(passivesOrClass)
    ? passivesOrClass
    : getDefaultClassPassives(passivesOrClass);

  if (!raw || raw.length === 0) return [];

  // Strictly cap at max 2 passive skills
  const maxTwo = raw.slice(0, 2);

  // If bond level is below 5, only the 1st passive skill is unlocked
  if (bondLevel < 5) {
    return maxTwo.slice(0, 1);
  }

  // Bond Level 5 or higher unlocks both passives (up to 2)
  return maxTwo;
}

export const SERVANT_DATABASE: ServantTemplate[] = [
  // 5-Star SSR Servants
  {
    id: 'artoria_pendragon',
    name: 'Artoria Pendragon',
    title: 'King of Knights',
    servantClass: 'Saber',
    rarity: 5,
    baseHp: 31500,
    baseAtk: 11221,
    baseStats: { strength: 18, endurance: 17, agility: 14, mana: 19, luck: 12 },
    commandDeck: ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'],
    skills: [
      {
        id: 'mana_burst_a',
        name: 'Mana Burst A',
        cooldown: 5,
        description: 'Increases own Buster Card effectiveness by 25% for 1 turn.',
        effectType: 'buff_atk',
        value: 25,
        duration: 1,
        icon: '⚔️'
      },
      {
        id: 'charisma_b',
        name: 'Charisma B',
        cooldown: 5,
        description: 'Increases party attack power by 15% for 3 turns.',
        effectType: 'buff_atk',
        value: 15,
        duration: 3,
        icon: '👑'
      },
      {
        id: 'radiant_path',
        name: 'Radiant Path EX',
        cooldown: 6,
        description: 'Charges own NP gauge by 20% and gains 12 Critical Stars.',
        effectType: 'np_charge',
        value: 20,
        duration: 1,
        icon: '✨'
      }
    ],
    passives: [
      {
        name: 'Magic Resistance A',
        type: 'magic_resistance',
        value: 20,
        rank: 'A',
        description: 'Increases debuff resistance by 20% (chance to completely nullify incoming debuffs).'
      },
      {
        name: 'Riding B',
        type: 'riding',
        value: 8,
        rank: 'B',
        description: 'Increases Quick Card effectiveness by 8%.'
      }
    ],
    noblePhantasm: {
      name: 'Excalibur: Sword of Promised Victory',
      cardType: 'Buster',
      chant: 'Gathered breath of the planet, torrential light of life... EX---CALIBUR!',
      description: 'Deals devastating holy burst damage to all foes and recharges 20% NP gauge.',
      target: 'aoe',
      multiplier: 380,
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
    baseHp: 26500,
    baseAtk: 10850,
    baseStats: { strength: 14, endurance: 12, agility: 14, mana: 15, luck: 16 },
    commandDeck: ['Buster', 'Buster', 'Arts', 'Quick', 'Quick'],
    skills: [
      {
        id: 'collector_ex',
        name: 'Collector EX',
        cooldown: 6,
        description: 'Increases Critical Star absorption and charges 15% NP Gauge.',
        effectType: 'np_charge',
        value: 15,
        duration: 2,
        icon: '💎'
      },
      {
        id: 'golden_rule_a',
        name: 'Golden Rule A',
        cooldown: 6,
        description: 'Increases own NP generation and charges 10% NP Gauge.',
        effectType: 'np_charge',
        value: 10,
        duration: 2,
        icon: '🪙'
      },
      {
        id: 'treasury_of_babylon',
        name: 'Treasury of Babylon',
        cooldown: 6,
        description: 'Gains 8 Critical Stars and increases Critical Damage by 15% for 2 turns.',
        effectType: 'crit_stars',
        value: 8,
        duration: 2,
        icon: '🗝️'
      }
    ],
    passives: [
      {
        name: 'Independent Action B',
        type: 'independent_action',
        value: 8,
        rank: 'B',
        description: 'Increases Critical Strike Damage by 8%.'
      },
      {
        name: 'Divinity C',
        type: 'divinity',
        value: 100,
        rank: 'C',
        description: 'Adds +100 flat pure damage to every hit (ignoring enemy defense).'
      }
    ],
    noblePhantasm: {
      name: 'Enuma Elish: Star of Creation that Split Heaven and Earth',
      cardType: 'Buster',
      chant: 'I speak of the beginning... Heaven and Earth split, and nothingness congratulated creation! ENUMA ELISH!',
      description: 'Unleashes the primordial spatial rupture of Ea, dealing anti-world damage.',
      target: 'aoe',
      multiplier: 300,
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
    baseHp: 29500,
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
        description: 'Increases Quick Card effectiveness by 20% for 1 turn.',
        effectType: 'buff_atk',
        value: 20,
        duration: 1,
        icon: '⚡'
      },
      {
        id: 'god_slayer_a',
        name: 'God Slayer A+',
        cooldown: 5,
        description: 'Grants self Divine Killer and Undead Killer bonus (+25% ATK) for 1 turn.',
        effectType: 'buff_atk',
        value: 25,
        duration: 1,
        icon: '🔱'
      }
    ],
    passives: [
      {
        name: 'Magic Resistance A',
        type: 'magic_resistance',
        value: 20,
        rank: 'A',
        description: 'Increases debuff resistance by 20% (chance to completely nullify incoming debuffs).'
      },
      {
        name: 'Divinity B',
        type: 'divinity',
        value: 175,
        rank: 'B',
        description: 'Adds +175 flat pure damage to every hit (ignoring enemy defense).'
      }
    ],
    noblePhantasm: {
      name: 'Gáe Bolg Alternative: Soaring Spear of Death',
      cardType: 'Quick',
      chant: 'Pierce through, thrust of sure mortality! Gáe Bolg Alternative!',
      description: 'Pinpoints the enemy with an inescapable double spear strike, causing guaranteed Stun and lethal puncture.',
      target: 'single',
      multiplier: 1200,
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
    baseHp: 36000,
    baseAtk: 9593,
    baseStats: { strength: 14, endurance: 20, agility: 13, mana: 18, luck: 15 },
    commandDeck: ['Arts', 'Arts', 'Arts', 'Buster', 'Quick'],
    skills: [
      {
        id: 'revelation_a',
        name: 'Revelation A',
        cooldown: 6,
        description: 'Gains 10 Critical Stars per turn for 3 turns through divine intuition.',
        effectType: 'crit_stars',
        value: 10,
        duration: 3,
        icon: '🕊️'
      },
      {
        id: 'true_name_discernment',
        name: 'True Name Discernment B',
        cooldown: 5,
        description: 'Greatly reduces enemy damage with +25% DEF for 1 turn.',
        effectType: 'buff_def',
        value: 25,
        duration: 1,
        icon: '📜'
      },
      {
        id: 'divine_blessing',
        name: 'Divine Grace A+',
        cooldown: 5,
        description: 'Heals self and allies for 3,500 HP and clears debuffs.',
        effectType: 'heal',
        value: 3500,
        duration: 1,
        icon: '💖'
      }
    ],
    passives: [
      {
        name: 'Magic Resistance EX',
        type: 'magic_resistance',
        value: 30,
        rank: 'EX',
        description: 'Increases debuff resistance by 30% (chance to completely nullify incoming debuffs).'
      }
    ],
    noblePhantasm: {
      name: 'Luminosité Eternelle: God is Here With Me',
      cardType: 'Arts',
      chant: 'My Lord... I entrust this flag to you! Luminosité Eternelle!',
      description: 'Unfurls the sacred banner, granting Invincibility to allies for 1 turn, massive DEF boost, HP recovery, and Arts NP refund.',
      target: 'support',
      multiplier: 0,
      overchargeEffect: 'Team Invincibility (1 turn) + 30% DEF + 2500 HP Regen + 25% Arts NP refund'
    },
    lore: 'The saint of France who received the voice of the Lord and liberated Orleans during the Hundred Years\' War.',
    summonQuote: 'Servant Ruler, Jeanne d\'Arc. The Holy Grail War requires an arbiter; I shall safeguard this pact.',
    battleStartQuote: 'The Lord protects the righteous. Raise your banners!',
    victoryQuote: 'Let us offer our prayers of gratitude for this blessed triumph.',
    defeatQuote: 'Even if my light fades, the holy flag will never fall...',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80',
    cardArtUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'jeanne_alter',
    name: 'Jeanne d\'Arc (Alter)',
    title: 'Dragon Witch',
    servantClass: 'Avenger',
    rarity: 5,
    baseHp: 31200,
    baseAtk: 12240,
    baseStats: { strength: 20, endurance: 15, agility: 14, mana: 16, luck: 8 },
    commandDeck: ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'],
    skills: [
      {
        id: 'self_modification_ex',
        name: 'Self-Modification EX',
        cooldown: 5,
        description: 'Increases self attack by +35% and critical star conversion for 3 turns.',
        effectType: 'buff_atk',
        value: 35,
        duration: 3,
        icon: '⚡'
      },
      {
        id: 'dragon_witch_ex',
        name: 'Dragon Witch EX',
        cooldown: 6,
        description: 'Increases attack of all allies by +20% for 3 turns.',
        effectType: 'buff_atk',
        value: 20,
        duration: 3,
        icon: '🐉'
      },
      {
        id: 'ephemeral_dream_a',
        name: 'Ephemeral Dream A',
        cooldown: 5,
        description: 'Grants self Invincibility for 1 turn and increases attack by +40% for 1 turn.',
        effectType: 'invincible',
        value: 40,
        duration: 1,
        icon: '🦋'
      }
    ],
    passives: [
      {
        name: 'Avenger B',
        type: 'avenger',
        value: 16,
        rank: 'B',
        description: 'Increases NP gain when taking damage (+16% NP refund on received attacks).'
      },
      {
        name: 'Oblivion Correction A',
        type: 'oblivion_correction',
        value: 10,
        rank: 'A',
        description: 'Increases Critical Strike Damage by 10%.'
      }
    ],
    noblePhantasm: {
      name: 'La Grondement Du Haine: Roar, O Rage of Mine',
      cardType: 'Buster',
      chant: 'This is the roar of my soul, polished by hate... La Grondement Du Haine!',
      description: 'Deals devastating single-target Buster damage and inflicts Curse and Buff Block.',
      target: 'single',
      multiplier: 800,
      overchargeEffect: 'Apply heavy burn and target defense down for 3 turns'
    },
    lore: 'A replica of Jeanne d\'Arc created by the Holy Grail using the desires and malice of Gilles de Rais. An Avenger who seeks vengeance against the country that burned her at the stake.',
    summonQuote: 'Servant, Avenger. I have answered your summon. ...What\'s with that look? Come on, we have a world to burn.',
    battleStartQuote: 'Every last one of you... I\'ll burn you to ashes!',
    victoryQuote: 'A predictable outcome. Now, clean up this mess.',
    defeatQuote: 'To burn again... is this my only fate...?',
    avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80',
    cardArtUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'mhx_alter',
    name: 'Mysterious Heroine X (Alter)',
    title: 'Dark Cavalier of the Round',
    servantClass: 'Berserker',
    rarity: 5,
    baseHp: 28500,
    baseAtk: 11150,
    baseStats: { strength: 17, endurance: 16, agility: 19, mana: 18, luck: 14 },
    commandDeck: ['Quick', 'Quick', 'Arts', 'Arts', 'Buster'],
    skills: [
      {
        id: 'sweets_reactor_a',
        name: 'Sweets Reactor A',
        cooldown: 5,
        description: 'Recovers 3,000 HP and increases own Quick Card performance by 20% for 3 turns.',
        effectType: 'heal',
        value: 3000,
        duration: 3,
        icon: '🍡'
      },
      {
        id: 'sovereign_hand_c',
        name: 'Sovereign\'s Unseen Hand C',
        cooldown: 5,
        description: 'Gains 15 Critical Stars and increases Critical Damage by 30% for 3 turns.',
        effectType: 'crit_stars',
        value: 15,
        duration: 3,
        icon: '🌌'
      },
      {
        id: 'altro_reactor_a',
        name: 'Altro Reactor A',
        cooldown: 6,
        description: 'Increases own ATK by 25% for 3 turns and charges NP gauge by 20%.',
        effectType: 'buff_atk',
        value: 25,
        duration: 3,
        icon: '⚡'
      }
    ],
    passives: [
      {
        name: 'Madness Enhancement C',
        type: 'madness_enhancement',
        value: 6,
        rank: 'C',
        description: 'Increases Buster Card effectiveness by 6%.'
      },
      {
        name: 'Altro Reactor EX',
        type: 'independent_action',
        value: 10,
        rank: 'EX',
        description: 'Increases Critical Strike Damage by 10%.'
      }
    ],
    noblePhantasm: {
      name: 'Cross-Calibur: Twin Black Dragon Blades of Dark Destruction',
      cardType: 'Quick',
      chant: 'Darkness... devour my soul! Twin black dragon blades, unleash! CROSS-CALIBUR!',
      description: 'Slashes the foe with dual dark saber constructs infused with Dark Matter force, dealing massive single-target Quick damage with high critical star generation.',
      target: 'single',
      multiplier: 1400,
      overchargeEffect: 'Super effective against Saber class targets & generates 30 Critical Stars'
    },
    lore: 'A dark assassin from the Servant Universe who claims to be the villainous Dark Cavalier destined to defeat Mysterious Heroine X. She loves Japanese sweets and stays energized with black bean paste.',
    summonQuote: 'Servant Berserker, Mysterious Heroine X Alter. Do you have Japanese sweets? No? Then I shall wait until you acquire some.',
    battleStartQuote: 'Entering Dark Matter reactor mode... Target acquired.',
    victoryQuote: 'Objective accomplished. Time for my tea break.',
    defeatQuote: 'Reactor core... overloaded... My sweets...',
    avatarUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&auto=format&fit=crop&q=80',
    cardArtUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80'
  },

  // 4-Star SR Servants
  {
    id: 'artoria_pendragon_alter',
    name: 'Artoria Pendragon (Alter)',
    title: 'Black King of Knights',
    servantClass: 'Saber',
    rarity: 4,
    baseHp: 26400,
    baseAtk: 10248,
    baseStats: { strength: 19, endurance: 16, agility: 12, mana: 18, luck: 10 },
    commandDeck: ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'],
    skills: [
      {
        id: 'mana_burst_a_alter',
        name: 'Mana Burst A',
        cooldown: 5,
        description: 'Increases own Buster Card effectiveness by 25% for 1 turn.',
        effectType: 'buff_atk',
        value: 25,
        duration: 1,
        icon: '🔥'
      },
      {
        id: 'charisma_e',
        name: 'Charisma E',
        cooldown: 5,
        description: 'Increases party attack power by 12% for 3 turns.',
        effectType: 'buff_atk',
        value: 12,
        duration: 3,
        icon: '👑'
      },
      {
        id: 'defender_of_fuyuki_a',
        name: 'Defender of Fuyuki A',
        cooldown: 6,
        description: 'Charges own NP gauge by 20% and increases Defense by 30% for 1 turn.',
        effectType: 'np_charge',
        value: 20,
        duration: 1,
        icon: '🖤'
      }
    ],
    passives: [
      {
        name: 'Magic Resistance B',
        type: 'magic_resistance',
        value: 17.5,
        rank: 'B',
        description: 'Increases debuff resistance by 17.5%.'
      }
    ],
    noblePhantasm: {
      name: 'Excalibur Morgan: Sword of Promised Victory',
      cardType: 'Buster',
      chant: 'Take this... The cry of a dying star! Let the dark breath of the dragon consume all! EX---CALIBUR... MORGAN!',
      description: 'Unleashes a catastrophic wave of black light, dealing massive damage to all enemies and recharging NP gauge.',
      target: 'aoe',
      multiplier: 450,
      overchargeEffect: 'NP gauge refund +20%'
    },
    lore: 'The Black King of Knights, Artoria Pendragon dyed in black by the mud of the Holy Grail. A cold, merciless tyrant who fights with relentless power, wielding the corrupted Excalibur Morgan.',
    summonQuote: 'Servant Saber, Artoria Alter. I have materialized in response to your summons. Master, are you prepared to govern with an iron fist?',
    battleStartQuote: 'There is no mercy on this battlefield. Disappear.',
    victoryQuote: 'A predictable outcome. Clean up the residue.',
    defeatQuote: 'The dark... is fading...',
    avatarUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&auto=format&fit=crop&q=80',
    cardArtUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'nero_claudius_saber',
    name: 'Nero Claudius',
    title: 'Emperor of Roses',
    servantClass: 'Saber',
    rarity: 4,
    baseHp: 27200,
    baseAtk: 9449,
    baseStats: { strength: 14, endurance: 14, agility: 15, mana: 16, luck: 17 },
    commandDeck: ['Arts', 'Arts', 'Buster', 'Buster', 'Quick'],
    skills: [
      {
        id: 'migraine_b',
        name: 'Migraine B',
        cooldown: 5,
        description: 'Relieves headache through imperial willpower, charging own NP gauge by 20% and gaining focus.',
        effectType: 'np_charge',
        value: 20,
        duration: 1,
        icon: '🌸'
      },
      {
        id: 'imperial_privilege_ex',
        name: 'Imperial Privilege EX',
        cooldown: 5,
        description: 'Acquires supreme skills via royal prerogative. Recovers 4,200 HP and boosts combat power by 25% for 3 turns.',
        effectType: 'heal',
        value: 4200,
        duration: 3,
        icon: '👑'
      },
      {
        id: 'thrice_setting_sun_a',
        name: 'Thrice Setting Sun A',
        cooldown: 6,
        description: 'Invictus Spiritus. Grants Guts status (Revive with 3,000 HP on lethal damage) and +100% Defense for 1 turn.',
        effectType: 'guts',
        value: 3000,
        duration: 5,
        icon: '🌹'
      }
    ],
    passives: [
      {
        name: 'Magic Resistance C',
        type: 'magic_resistance',
        value: 15,
        rank: 'C',
        description: 'Increases debuff resistance by 15%.'
      },
      {
        name: 'Riding B',
        type: 'riding',
        value: 8,
        rank: 'B',
        description: 'Increases Quick Card effectiveness by 8%.'
      }
    ],
    noblePhantasm: {
      name: 'Laus Saint Claudius: Imperium of the Maiden\'s Blooming',
      cardType: 'Arts',
      chant: 'Behold my talent, listen to the thunderous applause! Let the golden theater open! Laus Saint Claudius!',
      description: 'Deploys the Golden Theater Aestus Domus Aurea, raining blazing crimson rose strikes that ignore defense and shred enemy armor.',
      target: 'aoe',
      multiplier: 380,
      overchargeEffect: 'Reduces all enemies\' DEF by 20% for 3 turns + 20% NP refund'
    },
    lore: 'The Fifth Emperor of the Roman Empire, sovereign of the Golden Theater, and self-proclaimed supreme artist. Wielding her beloved crimson meteor blade Aestus Estus, she commands the battlefield with boundless passion.',
    summonQuote: 'Umu! Servant Saber, Nero Claudius has answered your summons! Rejoice, Master, for the greatest artist of Rome is now at your side!',
    battleStartQuote: 'The curtains rise on our glorious stage! Behold my supreme performance!',
    victoryQuote: 'A splendid triumph! Raise the roses high and let the applause echo throughout the empire! Umu!',
    defeatQuote: 'The spotlight dims... But the glory of Rome shall never fade...',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    cardArtUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'emiya_archer',
    name: 'EMIYA',
    title: 'Wrought Iron Hero',
    servantClass: 'Archer',
    rarity: 4,
    baseHp: 26000,
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
        description: 'Increases Critical Star generation and Critical Damage by 25% for 2 turns.',
        effectType: 'crit_stars',
        value: 25,
        duration: 2,
        icon: '🎯'
      },
      {
        id: 'projection_magecraft',
        name: 'Projection Magecraft A',
        cooldown: 5,
        description: 'Increases own Buster, Arts, and Quick card effectiveness by 20% for 1 turn.',
        effectType: 'buff_atk',
        value: 20,
        duration: 1,
        icon: '⚔️'
      }
    ],
    passives: [
      {
        name: 'Magic Resistance D',
        type: 'magic_resistance',
        value: 12.5,
        rank: 'D',
        description: 'Increases debuff resistance by 12.5%.'
      },
      {
        name: 'Independent Action B',
        type: 'independent_action',
        value: 8,
        rank: 'B',
        description: 'Increases Critical Strike Damage by 8%.'
      }
    ],
    noblePhantasm: {
      name: 'Unlimited Blade Works: Infinite Creation of Swords',
      cardType: 'Buster',
      chant: 'I am the bone of my sword. Steel is my body and fire is my blood... UNLIMITED BLADE WORKS!',
      description: 'Deploys a Reality Marble containing infinite projected blades that rain down upon all enemies.',
      target: 'aoe',
      multiplier: 360,
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
    baseHp: 24500,
    baseAtk: 10655,
    baseStats: { strength: 20, endurance: 18, agility: 14, mana: 10, luck: 14 },
    commandDeck: ['Buster', 'Buster', 'Buster', 'Arts', 'Quick'],
    skills: [
      {
        id: 'valor_a',
        name: 'Valor A+',
        cooldown: 5,
        description: 'Increases own Attack by 20% for 3 turns and grants mental debuff immunity.',
        effectType: 'buff_atk',
        value: 20,
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
        description: 'Grants self Guts (Revive with 3,000 HP on lethal damage).',
        effectType: 'guts',
        value: 3000,
        duration: 5,
        icon: '🩸'
      }
    ],
    passives: [
      {
        name: 'Madness Enhancement B',
        type: 'madness_enhancement',
        value: 8,
        rank: 'B',
        description: 'Permanently increases Buster Card damage by 8%.'
      },
      {
        name: 'Divinity A',
        type: 'divinity',
        value: 200,
        rank: 'A',
        description: 'Adds +200 flat pure damage to every hit (ignoring enemy defense).'
      }
    ],
    noblePhantasm: {
      name: 'Nine Lives: Shooting the Hundred Heads',
      cardType: 'Buster',
      chant: '■■■■■■■■■■■■---!!! (ROOOOOAAAR)',
      description: 'Unleashes 9 simultaneous supersonic crushing blows with his gigantic stone slab blade.',
      target: 'single',
      multiplier: 480,
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
    baseHp: 22500,
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
        description: 'Grants self Guts status (Revive with 2,000 HP).',
        effectType: 'guts',
        value: 2000,
        duration: 5,
        icon: '🩸'
      },
      {
        id: 'disengage_c',
        name: 'Disengage C',
        cooldown: 5,
        description: 'Removes own debuffs and recovers 2,500 HP.',
        effectType: 'heal',
        value: 2500,
        duration: 1,
        icon: '💨'
      }
    ],
    passives: [
      {
        name: 'Magic Resistance C',
        type: 'magic_resistance',
        value: 15,
        rank: 'C',
        description: 'Increases debuff resistance by 15%.'
      },
      {
        name: 'Divinity B',
        type: 'divinity',
        value: 175,
        rank: 'B',
        description: 'Adds +175 flat pure damage to every hit (ignoring enemy defense).'
      }
    ],
    noblePhantasm: {
      name: 'Gáe Bolg: Barbed Spear that Pierces with Death',
      cardType: 'Quick',
      chant: 'Your heart is mine! Gáe... BOLG!',
      description: 'Reverses causality so the heart is pierced before the spear is thrust. Inflicts high single-target puncture with massive Critical Star drop.',
      target: 'single',
      multiplier: 1200,
      overchargeEffect: 'Instant death chance + DEF down 20% + 25 Critical Stars'
    },
    lore: 'The tragic Celtic warrior hero of the Ulster cycle who wielded the cursed red spear Gáe Bolg.',
    summonQuote: 'Yo! Servant Lancer. Call me the Hound of Culann. Let\'s have some fun in this war!',
    battleStartQuote: 'Come on, don\'t disappoint me. Let\'s see what you\'ve got!',
    victoryQuote: 'Tch, over already? Barely broke a sweat.',
    defeatQuote: 'Damn it... pierced my own rule... Master, fall back...',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=80',
    cardArtUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'karna_lancer',
    name: 'Karna',
    title: 'Hero of Charity',
    servantClass: 'Lancer',
    rarity: 5,
    baseHp: 29800,
    baseAtk: 11975,
    baseStats: { strength: 18, endurance: 16, agility: 17, mana: 18, luck: 8 },
    commandDeck: ['Buster', 'Buster', 'Quick', 'Arts', 'Arts'],
    skills: [
      {
        id: 'discernment_of_the_poor',
        name: 'Discernment of the Poor A',
        cooldown: 6,
        description: 'Decreases enemy Noble Phantasm & attack power by 20% and seals enemy NP gauge.',
        effectType: 'stun',
        value: 20,
        duration: 1,
        icon: '👁️'
      },
      {
        id: 'uncrowned_arms_mastership',
        name: 'Uncrowned Arms Mastership',
        cooldown: 6,
        description: 'Charges own NP gauge by 25%, increases Critical Star drop rate and Critical Damage by 30% for 3 turns.',
        effectType: 'np_charge',
        value: 25,
        duration: 3,
        icon: '🏹'
      },
      {
        id: 'mana_burst_flame_a',
        name: 'Mana Burst (Flame) A',
        cooldown: 5,
        description: 'Increases own Buster Card effectiveness by 30% and Noble Phantasm Damage by 20% for 1 turn.',
        effectType: 'buff_atk',
        value: 30,
        duration: 1,
        icon: '🔥'
      }
    ],
    passives: [
      {
        name: 'Magic Resistance C',
        type: 'magic_resistance',
        value: 15,
        rank: 'C',
        description: 'Increases debuff resistance by 15%.'
      },
      {
        name: 'Riding A',
        type: 'riding',
        value: 10,
        rank: 'A',
        description: 'Increases Quick Card effectiveness by 10%.'
      },
      {
        name: 'Divinity A',
        type: 'divinity',
        value: 200,
        rank: 'A',
        description: 'Adds +200 flat pure damage to every hit (ignoring enemy defense).'
      }
    ],
    noblePhantasm: {
      name: 'Vasavi Shakti: O Sun, Abide to Death',
      cardType: 'Buster',
      chant: 'Know the mercy of the King of Gods... O Sun, abide to death! VASAVI SHAKTI!',
      description: 'Unleashes the divine anti-divine spear of Indra, burning all enemies with sacred solar rays and dealing massive Buster damage.',
      target: 'aoe',
      multiplier: 400,
      overchargeEffect: 'Super effective against Divine targets + 20% Buster resist down'
    },
    lore: 'The invincible Son of the Sun God Surya from the Mahabharata. Known as the Hero of Charity who sacrificed his golden armor Kavacha and earrings without hesitation.',
    summonQuote: 'Servant Lancer, Karna. Master... I shall serve as your spear. Let us bring charity and justice to this war.',
    battleStartQuote: 'O Surya, witness this strike. All shall be reduced to sacred kindling.',
    victoryQuote: 'The sun sets on this battle. A duty fulfilled.',
    defeatQuote: 'Even if the sun sets... my honor remains untarnished...',
    avatarUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=400&auto=format&fit=crop&q=80',
    cardArtUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80'
  }
];
