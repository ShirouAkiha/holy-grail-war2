import { ServantTemplate, ServantClass, PassiveSkill } from '../types';
import { resolveAscensionArtwork, resolveAscensionSprite } from './servantAscensions';
export { resolveAscensionArtwork, resolveAscensionSprite };

export function getDefaultClassPassives(servantClass: ServantClass): PassiveSkill[] {
  const normClass = servantClass.startsWith('Grand ') ? (servantClass.replace('Grand ', '') as ServantClass) : servantClass;
  switch (normClass) {
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
    case 'Shielder':
      return [
        {
          name: 'Magic Resistance A',
          type: 'magic_resistance',
          value: 20,
          rank: 'A',
          description: 'Increases debuff resistance by 20%.'
        },
        {
          name: 'Riding C',
          type: 'riding',
          value: 6,
          rank: 'C',
          description: 'Increases Quick Card damage and Star Generation by 6%.'
        }
      ];
    case 'Pretender':
      return [
        {
          name: 'Anti-Purge Defense A',
          type: 'magic_resistance',
          value: 20,
          rank: 'A',
          description: 'Increases debuff resistance by 20% and grants special defense against extra-class anomalies.'
        },
        {
          name: 'Independent Action EX',
          type: 'independent_action',
          value: 10,
          rank: 'EX',
          description: 'Increases Critical Strike Damage by 10%.'
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

/**
 * Safely resolves avatarUrl and cardArtUrl for a servant, ensuring no invalid URLs
 * (such as Unsplash stock placeholders or NP animation GIFs) leak into portrait fields.
 */
export function getServantAvatarAndCardArt(
  servantInput: any,
  customServants?: ServantTemplate[]
): { avatarUrl: string; cardArtUrl: string; spriteUrl?: string } {
  if (!servantInput) {
    return {
      avatarUrl: 'https://ella.janitorai.com/media-approved/B9sAHeFp8-jdUk8VB4Y_f.webp',
      cardArtUrl: 'https://ella.janitorai.com/media-approved/B9sAHeFp8-jdUk8VB4Y_f.webp',
      spriteUrl: undefined
    };
  }

  const template = servantInput.template || servantInput;
  const templateId = (servantInput.templateId || template.id || servantInput.id || '').toString().toLowerCase();
  const inputName = (template.name || servantInput.name || servantInput.nickname || '').toString().toLowerCase();

  // Strict check for Lucia Lyozes
  if (
    templateId === 'lucia_lyozes' ||
    templateId === 'lucia' ||
    templateId.includes('lucia') ||
    templateId.includes('lyozes') ||
    inputName.includes('lucia') ||
    inputName.includes('lucernalia') ||
    inputName.includes('lyozes')
  ) {
    return {
      avatarUrl: 'https://ella.janitorai.com/media-approved/2PMVd98BaN6Rc9lzVnWyn.webp',
      cardArtUrl: 'https://ella.janitorai.com/media-approved/2PMVd98BaN6Rc9lzVnWyn.webp',
      spriteUrl: servantInput.spriteUrl || template.spriteUrl || 'https://ella.janitorai.com/media-approved/yF_QPg5zHXgLbxeEfFd0Q.webp'
    };
  }

  // Strict check for Amamiya no Chihaya Tenkohime
  if (
    templateId === 'amamiya_no_chihaya_tenkohime' ||
    templateId === 'amamiya' ||
    templateId.includes('amamiya') ||
    templateId.includes('tenkohime') ||
    inputName.includes('amamiya') ||
    inputName.includes('chihaya') ||
    inputName.includes('tenkohime') ||
    inputName.includes('amazakura')
  ) {
    return {
      avatarUrl: 'https://ella.janitorai.com/media-approved/mskYeY2nC1pcPzEcW_nTK.webp',
      cardArtUrl: 'https://ella.janitorai.com/media-approved/mskYeY2nC1pcPzEcW_nTK.webp',
      spriteUrl: servantInput.spriteUrl || template.spriteUrl || 'https://ella.janitorai.com/media-approved/WmgJlmDFeLEuOY8jYiQA6.webp'
    };
  }

  // Strict check for Luvria Greenharte
  if (
    templateId === 'luvria_greenharte' ||
    templateId === 'luvria' ||
    templateId.includes('luvria') ||
    templateId.includes('greenharte') ||
    inputName.includes('luvria') ||
    inputName.includes('greenharte')
  ) {
    return {
      avatarUrl: 'https://ella.janitorai.com/media-approved/II1DtB1YFFjXHKcs8gU7q.webp',
      cardArtUrl: 'https://ella.janitorai.com/media-approved/II1DtB1YFFjXHKcs8gU7q.webp',
      spriteUrl: servantInput.spriteUrl || template.spriteUrl || 'https://ella.janitorai.com/media-approved/k_aK4SaC3HJVRNxDuMU13.webp'
    };
  }

  const findCanonical = (pool: ServantTemplate[]) => {
    let found = pool.find(s => s.id.toLowerCase() === templateId);
    if (found) return found;

    found = pool.find(s => s.name && s.name.toLowerCase() === inputName);
    if (found) return found;

    const sorted = [...pool].sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0));
    return sorted.find(s => s.name && inputName && inputName.includes(s.name.toLowerCase()));
  };

  const canonical = findCanonical(SERVANT_DATABASE) || (customServants ? findCanonical(customServants) : undefined);
  const resolvedTemplateId = canonical?.id || templateId || inputName;

  const npGif = template.noblePhantasm?.animationUrl ||
                template.noblePhantasm?.gifUrl ||
                canonical?.noblePhantasm?.animationUrl ||
                canonical?.noblePhantasm?.gifUrl;

  const isInvalid = (url?: string) => {
    if (!url || typeof url !== 'string' || !url.trim()) return true;
    const clean = url.trim().toLowerCase();
    if (clean.includes('unsplash.com')) return true;
    if (npGif && clean === npGif.trim().toLowerCase()) return true;
    if (clean.includes('banaaizq4gi91.gif') || clean.includes('cu_chulain_np')) return true;
    if (clean.includes('zutp5pqlu7fmkvyin9h-f') || clean.includes('super_aoko') || clean.includes('gr8x0bmk-phc95lo5mhal')) return true;
    if (clean.includes('llgwffdhold') || clean.includes('4lkcjmsj')) return true;
    if (clean.includes('/faces/f_')) return true;
    return false;
  };

  // 1. First priority for cardArtUrl: Selected / Unlocked Atlas Academy Ascension Stage
  const selectedStage = servantInput.selectedAscensionStage ?? template.selectedAscensionStage;
  const ascensionArt = resolveAscensionArtwork(
    resolvedTemplateId,
    selectedStage,
    servantInput.level || template.level || 1,
    servantInput.bondLevel || template.bondLevel || 1
  );

  let cardArtUrl = '';
  if (ascensionArt) {
    cardArtUrl = ascensionArt;
  } else if (servantInput.customArtworkUrl && !isInvalid(servantInput.customArtworkUrl)) {
    cardArtUrl = servantInput.customArtworkUrl;
  } else if (!isInvalid(servantInput.cardArtUrl)) {
    cardArtUrl = servantInput.cardArtUrl;
  } else if (!isInvalid(template.cardArtUrl)) {
    cardArtUrl = template.cardArtUrl;
  } else if (canonical && !isInvalid(canonical.cardArtUrl)) {
    cardArtUrl = canonical.cardArtUrl;
  } else {
    cardArtUrl = 'https://static.atlasacademy.io/NA/CharaGraph/2500600/2500600a@1.png';
  }

  let avatarUrl = '';
  if (!isInvalid(servantInput.avatarUrl)) {
    avatarUrl = servantInput.avatarUrl;
  } else if (!isInvalid(template.avatarUrl)) {
    avatarUrl = template.avatarUrl;
  } else if (canonical && !isInvalid(canonical.avatarUrl)) {
    avatarUrl = canonical.avatarUrl;
  } else {
    avatarUrl = cardArtUrl;
  }

  let spriteUrl: string | undefined = undefined;
  // If custom servant, strictly prioritize their custom spriteUrl / customArtworkUrl / avatarUrl!
  const isCustomServant = servantInput.isCustom || template.isCustom || Boolean(servantInput.customArtworkUrl);
  if (isCustomServant) {
    if (!isInvalid(servantInput.spriteUrl)) {
      spriteUrl = servantInput.spriteUrl;
    } else if (!isInvalid(servantInput.customArtworkUrl)) {
      spriteUrl = servantInput.customArtworkUrl;
    } else if (!isInvalid(template.spriteUrl)) {
      spriteUrl = template.spriteUrl;
    }
  } else {
    // Canonical servant: dynamically resolve based on chosen / unlocked Ascension stage
    const ascensionSprite = resolveAscensionSprite(
      servantInput,
      selectedStage,
      servantInput.level || template.level || 1,
      servantInput.bondLevel || template.bondLevel || 1
    );
    if (ascensionSprite && !isInvalid(ascensionSprite)) {
      spriteUrl = ascensionSprite;
    } else if (!isInvalid(servantInput.spriteUrl)) {
      spriteUrl = servantInput.spriteUrl;
    } else if (!isInvalid(template.spriteUrl)) {
      spriteUrl = template.spriteUrl;
    } else if (canonical && !isInvalid(canonical.spriteUrl)) {
      spriteUrl = canonical.spriteUrl;
    }
  }

  return { avatarUrl, cardArtUrl, spriteUrl };
}

/**
 * Returns the best character cutout sprite for dialogue and visual novel canvas rendering.
 * Resolves with priority: spriteUrl -> cardArtUrl -> avatarUrl.
 */
export function getServantSprite(
  servantInput: any,
  customServants?: ServantTemplate[]
): string {
  const art = getServantAvatarAndCardArt(servantInput, customServants);
  return art.spriteUrl || art.cardArtUrl || art.avatarUrl;
}

export const SERVANT_DATABASE: ServantTemplate[] = [
  /*
  ========================================================================================
  📌 STANDARD RPG SERVANT TEMPLATE FORMAT (REFERENCE SPECIFICATION)
  ========================================================================================
  Every Heroic Spirit in the RPG must strictly conform to this schema:
  - id: lowercase_snake_case (e.g. 'hassan_i_sabbah_azrael')
  - servantClass: ServantClass ('Saber', 'Archer', 'Grand Assassin', etc.)
  - rarity: 5
  - baseHp / baseAtk: ~28,000 - 30,000 HP / ~10,800 - 11,800 ATK (Equalized Parity)
  - baseStats: { strength, endurance, agility, mana, luck } -> MUST SUM TO EXACTLY 76 POINTS
  - commandDeck: Array of 5 cards [CardType, CardType, CardType, CardType, CardType]
  - skills: EXACTLY 3 Active Skills (Maxed level by default, no upgrading grinding required)
      { id, name, cooldown (5-6), description, effectType, value, duration, icon, quotes }
  - passives: MAXIMUM 2 Passive Skills (Passive 1 at Bond Lv.1, Passive 2 at Bond Lv.5)
  - noblePhantasm: { name, cardType, chant, description, target ('single'|'aoe'|'support'), multiplier, overchargeEffect }
  - lore, summonQuote, battleStartQuote, victoryQuote, defeatQuote
  - avatarUrl (Full High-Res Card Art Stage 1), cardArtUrl (Full High-Res Final Ascension Stage 4), spriteUrl (Full Cutout Character Figure) — DO NOT use cropped Faces/ pngs!
  ========================================================================================
  */
  {
    id: 'artoria_pendragon',
    name: 'Artoria Pendragon',
    title: 'King of Knights',
    servantClass: 'Saber',
    rarity: 5,
    baseHp: 30000,
    baseAtk: 10800,
    baseStats: { strength: 16, endurance: 16, agility: 16, mana: 18, luck: 20 },
    paramRanks: { strength: 'B', endurance: 'B', agility: 'B', mana: 'A', luck: 'A+' },    commandDeck: ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'],
    skills: [
      {
        id: 'knight_of_utopia_ex',
        name: 'Knight of Utopia EX',
        cooldown: 5,
        description: "Increases party's and self attack by 30% for 3 turns. Increases the attack of Round Table Knight allies by 20% for 3 turns. Grants self Buff-On-Attack buff for 3 turns. (Charges own NP gauge by 10% per enemy hit when attacking with Buster Cards.)",
        effectType: 'buff_atk',
        value: 30,
        duration: 3,
        icon: '⚔️',
        quotes: [
          "Knights of Utopia, assemble! Let our holy light pierce the shadows!",
          "All hands, prepare to charge!",
          "To protect my people!"
        ]
      },
      {
        id: 'dragon_reactor_core_b',
        name: 'Dragon Reactor Core B',
        cooldown: 5,
        description: "Increases own Buster performance by 50% for 1 turn. Increases own NP damage by 20% for 1 turn. Changes all own Command Cards' type to Buster for 1 turn.",
        effectType: 'buff_buster',
        value: 50,
        duration: 1,
        icon: '🐉',
        quotes: [
          "Ignite, Dragon Reactor! Unleash the furnace of red dragon!",
          "Burn, core of the dragon!",
          "Power of the Dragon, manifest!"
        ]
      },
      {
        id: 'radiant_road_ex',
        name: 'Radiant Road EX',
        cooldown: 5,
        description: 'Charges own NP gauge by 30% and gains 20 Critical Stars.',
        effectType: 'np_charge',
        value: 30,
        duration: 1,
        icon: '✨',
        quotes: [
          "The radiance of Avalon reveals our path!",
          "Avalon's blessing upon us!",
          "Light of the ideal nation, shine!"
        ]
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
      chant: 'Sword of Promised Victory... Excalibur!',
      description: 'Deals devastating holy burst damage to all foes and recharges 20% NP gauge. Gains critical stars.',
      target: 'aoe',
      multiplier: 700,
      overchargeEffect: 'NP gauge refund +50%'
    },
    lore: 'The legendary King of Britain who pulled the sword of selection Caliburn from the stone. Bearer of the Holy Sword Excalibur.',
    summonQuote: 'Servant Saber. I have answered your summons. I ask of you, are you my Master?',
    battleStartQuote: 'I take the field! Saber, Artoria Pendragon, moving out!',
    victoryQuote: 'The battle is decided. May honor guide our victory, Master.',
    defeatQuote: 'Forgive me, Master... My duty... remains unfulfilled...',
    avatarUrl: 'https://ella.janitorai.com/media-approved/B9sAHeFp8-jdUk8VB4Y_f.webp',
    cardArtUrl: 'https://ella.janitorai.com/media-approved/B9sAHeFp8-jdUk8VB4Y_f.webp',
    spriteUrl: 'https://ella.janitorai.com/media-approved/Z9He7mkUzzf3BA9jPKUDH.webp'
  },
  {
    id: 'altera',
    name: 'Altera',
    title: 'Destroyer of Civilization',
    servantClass: 'Saber',
    rarity: 5,
    baseHp: 29000,
    baseAtk: 11500,
    baseStats: { strength: 16, endurance: 18, agility: 18, mana: 16, luck: 24 },
    paramRanks: { strength: 'B', endurance: 'A', agility: 'A', mana: 'B', luck: 'EX' },    commandDeck: ['Quick', 'Arts', 'Arts', 'Buster', 'Buster'],
    skills: [
      {
        id: 'scourge_of_god_a',
        name: 'Scourge of God A',
        cooldown: 5,
        description: 'Increases party\'s NP damage by 20% for 3 turns. Removes all enemies\' Defensive Buffs.',
        effectType: 'buff_np_damage',
        value: 20,
        duration: 3,
        icon: '⚔️',
        quotes: ['"Your prosperity ends here."', '"The power of the War God rests with me."']
      },
      {
        id: 'perfect_construct_ex',
        name: 'Perfect Construct EX',
        cooldown: 5,
        description: 'Charges own NP gauge by 30%. Increases own critical damage by 30% for 3 turns. Increases own Offensive Debuff resistance by 120% for 3 turns. Recovers own HP by 7,000. Increases own critical star gain by 300% for 1 turn.',
        effectType: 'np_charge',
        value: 30,
        duration: 3,
        icon: '🛡️',
        quotes: ['"The power of the War God rests with me."', '"Reconstructing spirit origin."']
      },
      {
        id: 'star_emblem_ex',
        name: 'Star Emblem EX',
        cooldown: 5,
        description: 'Increases own attack by 30% for 3 turns. Increases own Buster performance by 30% for 3 turns. Gains 15 critical stars.',
        effectType: 'buff_atk',
        value: 30,
        duration: 3,
        icon: '🌟',
        quotes: ['"Your prosperity ends here."', '"The power of the War God rests with me."']
      }
    ],
    passives: [
      {
        name: 'Magic Resistance B',
        type: 'magic_resistance',
        value: 17.5,
        rank: 'B',
        description: 'Increases own debuff resistance by 17.5%.'
      },
      {
        name: 'Riding A',
        type: 'riding',
        value: 10,
        rank: 'A',
        description: 'Increases own Quick performance by 10%.'
      }
    ],
    noblePhantasm: {
      name: 'Photon Ray',
      chant: 'I treasure life, but I will destroy that civilization! Photon Ray!',
      rank: 'A',
      cardType: 'Buster',
      target: 'aoe',
      multiplier: 900,
      description: 'Deals damage to all enemies (900%). Overcharge: Reduces their defense by 40% for 3 turns.',
      overchargeEffect: 'Reduces all enemies\' defense by 40% for 3 turns.',
      gifUrl: 'https://ella.janitorai.com/media-approved/GDJMOW2n8X1ub8K0mVMt3.gif',
      animationUrl: 'https://ella.janitorai.com/media-approved/GDJMOW2n8X1ub8K0mVMt3.gif'
    },
    lore: 'Attila the Hun, a great king who created a great empire. A descendant as well as a warrior of the Hunnu, and its king. The great hero of the 5th century that conquered empires from Western Asia to Russia, Eastern Europe, and even Gaul. It is said she brought forth the ruin of the Western Roman Empire.',
    summonQuote: 'My name is Altera. ...I am the Hun and I am a warrior serving the God of War.',
    battleStartQuote: 'Past, present, or future. I will destroy, and I will be victorious.',
    victoryQuote: 'I pity you... No one can defeat me.',
    defeatQuote: 'Beings exist... That even my blade...cannot destroy...',
    avatarUrl: 'https://static.atlasacademy.io/NA/CharaGraph/101800/101800a@1.png',
    cardArtUrl: 'https://static.atlasacademy.io/NA/CharaGraph/101800/101800b@2.png',
    spriteUrl: 'https://static.atlasacademy.io/NA/CharaFigure/1018000/1018000_merged.png',
    traits: [
      'Costume-Owning',
      'Divinity',
      'Hominidae Servant',
      'Humanoid',
      'King',
      'Riding',
      'Servant',
      'Seven Knights Servant',
      'Weak to Enuma Elish'
    ],
    aliases: [
      'altera',
      'attila',
      'attila the hun',
      'great king of destruction',
      'destroyer of civilization',
      'etzel',
      'king of combat',
      'saber_altera'
    ]
  },
  {
    id: 'gilgamesh_archer',
    name: 'Gilgamesh',
    title: 'King of Heroes',
    servantClass: 'Archer',
    rarity: 5,
    baseHp: 28000,
    baseAtk: 11400,
    baseStats: { strength: 16, endurance: 14, agility: 14, mana: 16, luck: 18 },
    paramRanks: { strength: 'B', endurance: 'C', agility: 'C', mana: 'B', luck: 'A' },    commandDeck: ['Buster', 'Buster', 'Arts', 'Quick', 'Quick'],
    skills: [
      {
        id: 'collector_ex',
        name: 'Collector EX',
        cooldown: 6,
        description: 'Increases Critical Star absorption and charges 15% NP Gauge.',
        effectType: 'np_charge',
        value: 15,
        duration: 2,
        icon: '💎',
        quotes: ["All treasures under heaven belong to me!"]
      },
      {
        id: 'golden_rule_a',
        name: 'Golden Rule A',
        cooldown: 6,
        description: 'Increases own NP generation and charges 10% NP Gauge.',
        effectType: 'np_charge',
        value: 10,
        duration: 2,
        icon: '🪙',
        quotes: ["Wealth and glory naturally flow to the King!"]
      },
      {
        id: 'treasury_of_babylon',
        name: 'Treasury of Babylon',
        cooldown: 6,
        description: 'Gains 8 Critical Stars and increases Critical Damage by 15% for 2 turns.',
        effectType: 'crit_stars',
        value: 8,
        duration: 2,
        icon: '🗝️',
        quotes: ["Rejoice, mongrel! Open, Gate of Babylon!"]
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
    avatarUrl: 'https://ella.janitorai.com/media-approved/4f4Ohvjxoy5qWV9FuCIpV.webp',
    cardArtUrl: 'https://ella.janitorai.com/media-approved/4f4Ohvjxoy5qWV9FuCIpV.webp',
    spriteUrl: 'https://ella.janitorai.com/media-approved/Bqa8FsnKeMENWHTL1WqtY.webp'
  },
  {
    id: 'scathach_lancer',
    name: 'Scáthach',
    title: 'Queen of the Land of Shadows',
    servantClass: 'Lancer',
    rarity: 5,
    baseHp: 29000,
    baseAtk: 11200,
    baseStats: { strength: 16, endurance: 18, agility: 18, mana: 14, luck: 12 },
    paramRanks: { strength: 'B', endurance: 'A', agility: 'A', mana: 'C', luck: 'D' },    commandDeck: ['Quick', 'Quick', 'Buster', 'Buster', 'Arts'],
    skills: [
      {
        id: 'wisdom_dun_scaith',
        name: 'Wisdom of Dún Scáith A+',
        cooldown: 5,
        description: 'Grants self Evade (1 turn) and increases Critical Star gather.',
        effectType: 'evade',
        value: 100,
        duration: 1,
        icon: '🛡️',
        quote: "Wisdom of the Abyss, Dún Scáith.",
        quotes: ["Wisdom of the Abyss, Dún Scáith.", "There's nothing that I cannot kill."]
      },
      {
        id: 'primordial_rune',
        name: 'Primordial Rune',
        cooldown: 6,
        description: 'Increases Quick Card effectiveness by 20% for 1 turn.',
        effectType: 'buff_atk',
        value: 20,
        duration: 1,
        icon: '⚡',
        quote: "O runes, bring your strength here!",
        quotes: ["O runes, bring your strength here!"]
      },
      {
        id: 'god_slayer_a',
        name: 'God Slayer A+',
        cooldown: 5,
        description: 'Grants self Divine Killer and Undead Killer bonus (+25% ATK) for 1 turn.',
        effectType: 'buff_atk',
        value: 25,
        duration: 1,
        icon: '🔱',
        quote: "There's nothing that I cannot kill.",
        quotes: ["There's nothing that I cannot kill.", "How should I dredge out this win?"]
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
    avatarUrl: 'https://ella.janitorai.com/media-approved/LLAGPFOtuFFMfvpwnlcar.webp',
    cardArtUrl: 'https://ella.janitorai.com/media-approved/LLAGPFOtuFFMfvpwnlcar.webp',
    spriteUrl: 'https://ella.janitorai.com/media-approved/giqs9yVplelWhqrW83O0o.webp'
  },
  {
    id: 'jeanne_darc_ruler',
    name: 'Jeanne d\'Arc',
    title: 'Holy Maiden of Orleans',
    servantClass: 'Ruler',
    rarity: 5,
    baseHp: 34500,
    baseAtk: 9200,
    baseStats: { strength: 16, endurance: 16, agility: 18, mana: 18, luck: 14 },
    paramRanks: { strength: 'B', endurance: 'B', agility: 'A', mana: 'A', luck: 'C' },    commandDeck: ['Arts', 'Arts', 'Arts', 'Buster', 'Quick'],
    skills: [
      {
        id: 'after_pure_prayer_ex',
        name: 'After Pure Prayer EX',
        cooldown: 6,
        description: 'Increases Arts Card effectiveness for all allies by 20% (3 turns), increases NP Gauge for all allies by 20%, and gains 15 Critical Stars every turn (3 turns).',
        effectType: 'np_charge',
        value: 20,
        duration: 3,
        icon: '🕊️',
        quote: 'This, yes.',
        quotes: ['This, yes.', "I'll use this, then."]
      },
      {
        id: 'restoration_radiant_light',
        name: 'Restoration of the Radiant Holy Light A',
        cooldown: 5,
        description: 'Decreases single enemy NP Strength by 30% (1 turn), decreases enemy DEF by 20% (1 turn), and decreases enemy DEF further by 30% (3 turns).',
        effectType: 'debuff',
        value: 30,
        duration: 3,
        icon: '✨',
        quote: 'Light my way, lest I stray from the path.',
        quotes: ['Light my way, lest I stray from the path.', 'I shall take care of this.']
      },
      {
        id: 'divine_judgement_a',
        name: 'Divine Judgement A',
        cooldown: 6,
        description: 'Inflicts Bound (Stun) on a single Servant enemy (1 turn).',
        effectType: 'stun',
        value: 100,
        duration: 1,
        icon: '⚖️',
        quote: 'Lord, grant me strength.',
        quotes: ['Lord, grant me strength.', 'I shall pass judgement in the Lord\'s name.']
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
      chant: 'Let me handle this. Get behind me! So long as I fly this banner, we shall never fall! Luminosité Eternelle!',
      description: "Grants party Invincibility for 1 turn. Increases party's defense for 3 turns. Removes party's debuffs.",
      target: 'support',
      multiplier: 0,
      overchargeEffect: "Recovers party's HP every turn for 2 turns (1,000 - 3,000 HP/turn based on Overcharge)."
    },
    lore: 'The saint of France who received the voice of the Lord and liberated Orleans during the Hundred Years\' War.',
    summonQuote: 'Servant Ruler, Jeanne d\'Arc. The Holy Grail War requires an arbiter; I shall safeguard this pact.',
    battleStartQuote: 'May victory be upon this banner!',
    victoryQuote: 'Let us offer our prayers of gratitude for this blessed triumph.',
    defeatQuote: 'Even if my light fades, the holy flag will never fall...',
    avatarUrl: 'https://ella.janitorai.com/media-approved/LfnkdoCSDCJ8i40QetNmZ.webp',
    cardArtUrl: 'https://ella.janitorai.com/media-approved/LfnkdoCSDCJ8i40QetNmZ.webp',
    spriteUrl: 'https://ella.janitorai.com/media-approved/wUez_xlmpYwXX4XM5nv6L.webp'
  },
  {
    id: 'jeanne_alter',
    name: 'Jeanne d\'Arc (Alter)',
    title: 'Dragon Witch',
    servantClass: 'Avenger',
    rarity: 5,
    baseHp: 27500,
    baseAtk: 11800,
    baseStats: { strength: 18, endurance: 14, agility: 18, mana: 20, luck: 10 },
    paramRanks: { strength: 'A', endurance: 'C', agility: 'A', mana: 'A+', luck: 'E' },    commandDeck: ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'],
    skills: [
      {
        id: 'self_modification_ex',
        name: 'Self-Modification EX',
        cooldown: 5,
        description: 'Increases own critical damage by 50% for 3 turns. Increases own critical star gain for 3 turns.',
        effectType: 'buff_crit_damage',
        value: 50,
        duration: 3,
        icon: '⚡',
        quotes: ["Burn to ashes!", "How's that!"]
      },
      {
        id: 'dragon_witch_ex',
        name: 'Dragon Witch EX',
        cooldown: 5,
        description: 'Increases party\'s attack by 20% for 3 turns. Increases the attack of Dragon allies by 20% for 3 turns.',
        effectType: 'buff_atk',
        value: 20,
        duration: 3,
        icon: '🐉',
        quotes: ["Come, my dragon!", "How's that!"]
      },
      {
        id: 'ephemeral_dream_ex',
        name: 'Ephemeral Dream EX',
        cooldown: 6,
        description: 'Increases own Buster performance by 50% for 1 turn. Grants self Invincibility for 1 turn. Charges own NP gauge by 50%. Deals 1000 self-demerit damage.',
        effectType: 'buff_buster',
        value: 50,
        duration: 1,
        icon: '🦋',
        quotes: ["Ahahahahaha! I'm getting chills!", "How's that!"]
      }
    ],
    passives: [
      {
        name: 'Avenger B',
        type: 'avenger',
        value: 18,
        rank: 'B',
        description: 'Increases own NP generation rate when taking attack by 18%. Reduces party\'s debuff resistance by 8% (except self).'
      },
      {
        name: 'Self-Replenishment (Magic) A+',
        type: 'self_replenishment',
        value: 4,
        rank: 'A+',
        description: 'Charges own NP gauge by 4% every turn.'
      }
    ],
    noblePhantasm: {
      name: 'Le Grondement de la Haine',
      cardType: 'Buster',
      chant: 'Roar, O\' Rage of Mine',
      description: 'Deals devastating single-target Buster damage (1200%), inflicts Buff Block for 1 time, and gains 30 critical stars. Overcharge: Inflicts Curse (2,000 damage/turn) for 5 turns.',
      target: 'single',
      multiplier: 1200,
      overchargeEffect: 'Inflicts Curse (2,000 damage/turn for 5 turns).'
    },
    lore: 'A replica of Jeanne d\'Arc created by the Holy Grail using the desires and malice of Gilles de Rais. An Avenger who seeks vengeance against the country that burned her at the stake.',
    summonQuote: 'Servant, Avenger. I have answered your summon. ...What\'s with that look? Come on, we have a world to burn.',
    battleStartQuote: 'Hehe, HAHAHAHAHA! Now, it\'s time for despair!',
    victoryQuote: 'Hehehe... HAHAHAHAHA! Pathetic! Burn to ashes like bugs!',
    defeatQuote: 'No... NO! I don\'t want to burn again! NEVER AGAIN!',
    avatarUrl: 'https://ella.janitorai.com/media-approved/LLgWFfDHOldSBezIlG2bE.webp',
    cardArtUrl: 'https://ella.janitorai.com/media-approved/LLgWFfDHOldSBezIlG2bE.webp',
    spriteUrl: 'https://ella.janitorai.com/media-approved/YMbl6kwoqjKu4rLue9_Gq.webp'
  },
  {
    id: 'mhx_alter',
    name: 'Mysterious Heroine X (Alter)',
    title: 'Dark Cavalier of the Round',
    servantClass: 'Berserker',
    rarity: 5,
    baseHp: 27500,
    baseAtk: 11400,
    baseStats: { strength: 18, endurance: 16, agility: 16, mana: 20, luck: 14 },
    paramRanks: { strength: 'A', endurance: 'B', agility: 'B', mana: 'A+', luck: 'C' },    commandDeck: ['Quick', 'Quick', 'Arts', 'Arts', 'Buster'],
    skills: [
      {
        id: 'sweets_reactor_a',
        name: 'Sweets Reactor A',
        cooldown: 5,
        description: 'Recovers 3,000 HP and increases own Quick Card performance by 20% for 3 turns.',
        effectType: 'heal',
        value: 3000,
        duration: 3,
        icon: '🍡',
        quotes: ["Replenishing Dark Matter sugar reserves... Sweet bean energy max!"]
      },
      {
        id: 'sovereign_hand_c',
        name: 'Sovereign\'s Unseen Hand C',
        cooldown: 5,
        description: 'Gains 15 Critical Stars and increases Critical Damage by 30% for 3 turns.',
        effectType: 'crit_stars',
        value: 15,
        duration: 3,
        icon: '🌌',
        quotes: ["Sovereign Unseen Hand engaged! Out of my path!"]
      },
      {
        id: 'altro_reactor_a',
        name: 'Altro Reactor A',
        cooldown: 6,
        description: 'Increases own ATK by 25% for 3 turns and charges NP gauge by 20%.',
        effectType: 'buff_atk',
        value: 25,
        duration: 3,
        icon: '⚡',
        quotes: ["Overclocking Dark Knight reactor! Dark Side energy 300%!"]
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
    avatarUrl: 'https://ella.janitorai.com/media-approved/Syn9pbEhWP-Rh74E_yz2p.webp',
    cardArtUrl: 'https://ella.janitorai.com/media-approved/Syn9pbEhWP-Rh74E_yz2p.webp',
    spriteUrl: 'https://ella.janitorai.com/media-approved/U3GgFIMJRYdVNS-BT_K1T.webp'
  },

  {
    id: 'artoria_pendragon_alter',
    name: 'Artoria Pendragon (Alter)',
    title: 'Black King of Knights',
    servantClass: 'Saber',
    rarity: 5,
    baseHp: 29000,
    baseAtk: 11200,
    baseStats: { strength: 18, endurance: 18, agility: 12, mana: 22, luck: 14 },
    paramRanks: { strength: 'A', endurance: 'A', agility: 'D', mana: 'A++', luck: 'C' },    commandDeck: ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'],
    skills: [
      {
        id: 'mana_burst_a_alter',
        name: 'Mana Burst A',
        cooldown: 5,
        description: 'Increases own Buster Card effectiveness by 25% for 1 turn.',
        effectType: 'buff_atk',
        value: 25,
        duration: 1,
        icon: '🔥',
        quotes: ["Dark Mana Burst... Grind them into dust."]
      },
      {
        id: 'charisma_e',
        name: 'Charisma E',
        cooldown: 5,
        description: 'Increases party attack power by 12% for 3 turns.',
        effectType: 'buff_atk',
        value: 12,
        duration: 3,
        icon: '👑',
        quotes: ["Obey or perish. Follow the Dark King."]
      },
      {
        id: 'defender_of_fuyuki_a',
        name: 'Defender of Fuyuki A',
        cooldown: 6,
        description: 'Charges own NP gauge by 20% and increases Defense by 30% for 1 turn.',
        effectType: 'np_charge',
        value: 20,
        duration: 1,
        icon: '🖤',
        quotes: ["Cold wind of Fuyuki... Your fate is sealed."]
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
    avatarUrl: 'https://ella.janitorai.com/media-approved/ZxbsnJvadU9f-ZGO_jgnW.webp',
    cardArtUrl: 'https://ella.janitorai.com/media-approved/ZxbsnJvadU9f-ZGO_jgnW.webp',
    spriteUrl: 'https://ella.janitorai.com/media-approved/b_nkM0IjxFR624oKEPuBV.webp'
  },
  {
    id: 'nero_claudius_saber',
    name: 'Nero Claudius',
    title: 'Emperor of Roses',
    servantClass: 'Saber',
    rarity: 5,
    baseHp: 31000,
    baseAtk: 10400,
    baseStats: { strength: 12, endurance: 12, agility: 18, mana: 16, luck: 18 },
    paramRanks: { strength: 'D', endurance: 'D', agility: 'A', mana: 'B', luck: 'A' },    commandDeck: ['Arts', 'Arts', 'Buster', 'Buster', 'Quick'],
    skills: [
      {
        id: 'migraine_b',
        name: 'Migraine B',
        cooldown: 5,
        description: 'Relieves headache through imperial willpower, charging own NP gauge by 20% and gaining focus.',
        effectType: 'np_charge',
        value: 20,
        duration: 1,
        icon: '🌸',
        quotes: ["Umu! A minor headache cannot dim my artistic brilliance!"]
      },
      {
        id: 'imperial_privilege_ex',
        name: 'Imperial Privilege EX',
        cooldown: 5,
        description: 'Acquires supreme skills via royal prerogative. Recovers 4,200 HP and boosts combat power by 25% for 3 turns.',
        effectType: 'heal',
        value: 4200,
        duration: 3,
        icon: '👑',
        quotes: ["Imperial Privilege EX! The entire world is a stage for Roma!"]
      },
      {
        id: 'thrice_setting_sun_a',
        name: 'Thrice Setting Sun A',
        cooldown: 6,
        description: 'Invictus Spiritus. Grants Guts status (Revive with 3,000 HP on lethal damage) and +100% Defense for 1 turn.',
        effectType: 'guts',
        value: 3000,
        duration: 5,
        icon: '🌹',
        quotes: ["The sun sets three times before Nero falls! Umu!"]
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
      multiplier: 700,
      overchargeEffect: 'Reduces all enemies\' DEF by 20% for 3 turns + 20% NP refund'
    },
    lore: 'The Fifth Emperor of the Roman Empire, sovereign of the Golden Theater, and self-proclaimed supreme artist. Wielding her beloved crimson meteor blade Aestus Estus, she commands the battlefield with boundless passion.',
    summonQuote: 'Umu! Servant Saber, Nero Claudius has answered your summons! Rejoice, Master, for the greatest artist of Rome is now at your side!',
    battleStartQuote: 'The curtains rise on our glorious stage! Behold my supreme performance!',
    victoryQuote: 'A splendid triumph! Raise the roses high and let the applause echo throughout the empire! Umu!',
    defeatQuote: 'The spotlight dims... But the glory of Rome shall never fade...',
    avatarUrl: 'https://ella.janitorai.com/media-approved/hnSI3iEdOGx6bIS1OFOm0.webp',
    cardArtUrl: 'https://ella.janitorai.com/media-approved/hnSI3iEdOGx6bIS1OFOm0.webp',
    spriteUrl: 'https://ella.janitorai.com/media-approved/6T4ofdMLiQXjUv0can6ZP.webp'
  },
  {
    id: 'emiya_archer',
    name: 'EMIYA',
    title: 'Wrought Iron Hero',
    servantClass: 'Archer',
    rarity: 5,
    baseHp: 29000,
    baseAtk: 10800,
    baseStats: { strength: 12, endurance: 14, agility: 14, mana: 16, luck: 10 },
    paramRanks: { strength: 'D', endurance: 'C', agility: 'C', mana: 'B', luck: 'E' },    commandDeck: ['Arts', 'Arts', 'Arts', 'Buster', 'Quick'],
    skills: [
      {
        id: 'eye_of_the_mind_true_ex',
        name: 'Eye of the Mind (True) EX',
        cooldown: 6,
        description: 'Grants self Evasion for 1 turn. Increases own attack by 30% for 3 turns. Increases own defense by 30% for 3 turns. Gains 20 critical stars.',
        effectType: 'evade',
        value: 30,
        duration: 3,
        icon: '👁️',
        quote: 'I see right through your moves! Eye of the Mind, True!'
      },
      {
        id: 'hawkeye_b_plus',
        name: 'Hawkeye B+',
        cooldown: 6,
        description: 'Increases own critical star generation rate by 100% for 3 turns. Increases own critical damage by 100% for 3 turns.',
        effectType: 'crit_stars',
        value: 100,
        duration: 3,
        icon: '🎯',
        quote: 'High-altitude vantage locked on target! Hawkeye, maximum precision!'
      },
      {
        id: 'circuit_connect_ex',
        name: 'Circuit Connect EX',
        cooldown: 5,
        description: 'Increases own Quick performance by 50% for 1 turn. Increases own Arts performance by 50% for 1 turn. Increases own Buster performance by 50% for 1 turn. Selects own NP Command Card\'s type between Arts or Buster for 1 turn.',
        effectType: 'buff_atk',
        value: 50,
        duration: 1,
        icon: '⚡',
        quote: 'Magic Circuits connected! Reconfiguring Noble Phantasm projection parameters!'
      }
    ],
    passives: [
      {
        name: 'Magic Resistance D',
        type: 'magic_resistance',
        value: 12.5,
        rank: 'D',
        description: 'Increases own debuff resistance by 12.5%.'
      },
      {
        name: 'Independent Action B',
        type: 'independent_action',
        value: 8,
        rank: 'B',
        description: 'Increases own critical damage by 8%.'
      }
    ],
    noblePhantasm: {
      name: 'Unlimited Blade Works: Infinite Creation of Swords',
      rank: 'E-A',
      cardType: '???',
      chant: 'I am the bone of my sword. Steel is my body, and fire is my blood. I have created over a thousand blades. Unknown to Death, nor known to Life... UNLIMITED BLADE WORKS!',
      description: 'Deals damage that ignores defense buffs to all enemies.',
      effect: 'Deals damage that ignores defense buffs to all enemies.',
      target: 'aoe',
      multiplier: 900,
      overchargeEffect: 'Reduces all enemies\' attack by 30% for 3 turns.'
    },
    lore: 'A nameless Guardian forged in steel and idealism who commands the pinnacle of projection magecraft.',
    summonQuote: 'Servant Archer. I have answered your summons. Well, let\'s see how far your ideals take us.',
    battleStartQuote: 'Trace on. Structural analysis complete—replicating infinite armaments.',
    victoryQuote: 'An iron will is sharper than any blade. Clean victory, Master.',
    defeatQuote: 'My forged body crumbles... A fitting end for a counterfeit hero.',
    avatarUrl: 'https://ella.janitorai.com/media-approved/iA3boFrqm1VqSxH7GJPQL.webp',
    cardArtUrl: 'https://ella.janitorai.com/media-approved/iA3boFrqm1VqSxH7GJPQL.webp',
    spriteUrl: 'https://ella.janitorai.com/media-approved/8asG22pYOXYVxYyHPrU2h.webp'
  },
  {
    id: 'heracles_berserker',
    name: 'Heracles',
    title: 'Great Hero of Olympus',
    servantClass: 'Berserker',
    rarity: 5,
    baseHp: 26500,
    baseAtk: 11800,
    baseStats: { strength: 20, endurance: 18, agility: 18, mana: 18, luck: 16 },
    paramRanks: { strength: 'A+', endurance: 'A', agility: 'A', mana: 'A', luck: 'B' },    commandDeck: ['Buster', 'Buster', 'Buster', 'Arts', 'Quick'],
    skills: [
      {
        id: 'valor_a',
        name: 'Valor A+',
        cooldown: 5,
        description: 'Increases own Attack by 20% for 3 turns and grants mental debuff immunity.',
        effectType: 'buff_atk',
        value: 20,
        duration: 3,
        icon: '🦁',
        quotes: ["■■■■■■■■ーーーーーーッッッ！！！ (Roar of Unyielding Valor!)"]
      },
      {
        id: 'minds_eye_fake',
        name: 'Mind\'s Eye (Fake) B',
        cooldown: 6,
        description: 'Grants self Evade for 1 turn and increases Critical Damage.',
        effectType: 'evade',
        value: 100,
        duration: 1,
        icon: '👁️',
        quotes: ["━━━━━━━ッッッ！！！ (Battle instincts sharpen through intuition!)"]
      },
      {
        id: 'indomitable_a',
        name: 'Indomitable Will A',
        cooldown: 7,
        description: 'Grants self Guts status for 1 time, 5 turns (revives with 2,500 HP, stackable with Castle of Snow Guts) & increases own Buster performance by 20% for 3 turns.',
        effectType: 'guts',
        value: 2500,
        duration: 5,
        icon: '🩸',
        quotes: ["■■■■■■■■■■■■ッッッ！！！ (The 12 Labors grant unyielding life!)"]
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
      multiplier: 800,
      overchargeEffect: 'Reduces target DEF by 20% for 3 turns'
    },
    lore: 'The greatest hero of Greek mythology who completed the Twelve Labors through superhuman fortitude.',
    summonQuote: '■■■■■■■■■■! (The giant nods respectfully as the earth trembles beneath his feet).',
    battleStartQuote: 'ROOOOOOAAAARRRR!',
    victoryQuote: '■■■■■■... (Breathes heavily while standing atop the pulverized battlefield).',
    defeatQuote: '■■■■... (Crumbles into golden embers with unyielding dignity).',
    avatarUrl: 'https://ella.janitorai.com/media-approved/Uugg_5Y73rmtQsnPKYUBo.webp',
    cardArtUrl: 'https://ella.janitorai.com/media-approved/Uugg_5Y73rmtQsnPKYUBo.webp',
    spriteUrl: 'https://ella.janitorai.com/media-approved/o2bkWZQCH-nJWCeANG12g.webp'
  },
  {
    id: 'cu_chulainn_lancer',
    name: 'Cú Chulainn',
    title: 'Hound of Culann',
    servantClass: 'Lancer',
    rarity: 5,
    baseHp: 29500,
    baseAtk: 10800,
    baseStats: { strength: 16, endurance: 14, agility: 18, mana: 14, luck: 10 },
    paramRanks: { strength: 'B', endurance: 'C', agility: 'A', mana: 'C', luck: 'E' },    commandDeck: ['Quick', 'Quick', 'Arts', 'Buster', 'Buster'],
    skills: [
      {
        id: 'protection_from_arrows',
        name: 'Protection from Arrows B',
        cooldown: 5,
        description: 'Grants self 2 turns of Evade and increases DEF by 16% for 3 turns.',
        effectType: 'evade',
        value: 100,
        duration: 2,
        icon: '🛡️',
        quotes: ["Runes of protection! Projectiles won't touch the Hound of Ulster!"]
      },
      {
        id: 'battle_continuation_b',
        name: 'Guts B',
        cooldown: 7,
        description: 'Grants self Guts status (Revive with 2,000 HP).',
        effectType: 'guts',
        value: 2000,
        duration: 5,
        icon: '🩸',
        quotes: ["Heh! A Hound of Culann doesn't die that easily!"]
      },
      {
        id: 'disengage_c',
        name: 'Disengage C',
        cooldown: 5,
        description: 'Removes own debuffs and recovers 2,500 HP.',
        effectType: 'heal',
        value: 2500,
        duration: 1,
        icon: '💨',
        quotes: ["Tactical repositioning! Watch your back!"]
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
    avatarUrl: 'https://ella.janitorai.com/media-approved/t-BCAX4vdfQprQASUcMVO.webp',
    cardArtUrl: 'https://ella.janitorai.com/media-approved/t-BCAX4vdfQprQASUcMVO.webp',
    spriteUrl: 'https://ella.janitorai.com/media-approved/FXCsEZPDVOeONvnCBl1zk.webp'
  },
  {
    id: 'karna_lancer',
    name: 'Karna',
    title: 'Hero of Charity',
    servantClass: 'Lancer',
    rarity: 5,
    baseHp: 29500,
    baseAtk: 11200,
    baseStats: { strength: 16, endurance: 14, agility: 18, mana: 16, luck: 12 },
    paramRanks: { strength: 'B', endurance: 'C', agility: 'A', mana: 'B', luck: 'D' },    commandDeck: ['Buster', 'Buster', 'Quick', 'Arts', 'Arts'],
    skills: [
      {
        id: 'discernment_of_the_poor',
        name: 'Discernment of the Poor A',
        cooldown: 6,
        description: 'Decreases enemy Noble Phantasm & attack power by 20% and seals enemy NP gauge.',
        effectType: 'debuff',
        value: 20,
        duration: 1,
        icon: '👁️',
        quotes: ["Your true nature is transparent to me. Flaws revealed."]
      },
      {
        id: 'uncrowned_arms_mastership',
        name: 'Uncrowned Arms Mastership',
        cooldown: 6,
        description: 'Charges own NP gauge by 25%, increases Critical Star drop rate and Critical Damage by 30% for 3 turns.',
        effectType: 'np_charge',
        value: 25,
        duration: 3,
        icon: '🏹',
        quotes: ["Uncrowned Arms Mastership... Peerless spear techniques of the Sun."]
      },
      {
        id: 'mana_burst_flame_a',
        name: 'Mana Burst (Flame) A',
        cooldown: 5,
        description: 'Increases own Buster Card effectiveness by 30% and Noble Phantasm Damage by 20% for 1 turn.',
        effectType: 'buff_atk',
        value: 30,
        duration: 1,
        icon: '🔥',
        quotes: ["Surging flames of Surya! Burn with divine solar heat!"]
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
    avatarUrl: 'https://ella.janitorai.com/media-approved/uZTE4FVgCnWDCxDE9kUY4.webp',
    cardArtUrl: 'https://ella.janitorai.com/media-approved/uZTE4FVgCnWDCxDE9kUY4.webp',
    spriteUrl: 'https://ella.janitorai.com/media-approved/GhiOCyRHZLl2LpfDh2vZh.webp'
  },
  {
    id: 'adiosa_dragon_envoy',
    name: 'Adiosa',
    title: 'Cataclysm-Class World-Pruner',
    servantClass: 'Foreigner',
    rarity: 5,
    baseHp: 32000,
    baseAtk: 11600,
    baseStats: { strength: 18, endurance: 20, agility: 10, mana: 20, luck: 10 },
    paramRanks: { strength: 'A', endurance: 'A+', agility: 'E', mana: 'A+', luck: 'E' },
    commandDeck: ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'],
    skills: [
      {
        id: 'cataclysmic_pruner',
        name: 'Cataclysmic Pruner A++',
        cooldown: 5,
        description: 'Emits an intense draconic pressure wave to prune mortal resistance. Increases own ATK by 30% for 3 turns and drains 20% enemy NP gauge.',
        effectType: 'buff_atk',
        value: 30,
        duration: 3,
        icon: '⚔️',
        quotes: ["Dragon Envoy protocol active... Pruning timelines that stray from harmony!"]
      },
      {
        id: 'cute_aggression_lethal',
        name: 'Lethal Cute Aggression A++',
        cooldown: 5,
        description: 'An overwhelming, intrusive urge to violently crush anything small or adorable. Gains 20 Critical Stars and increases Buster & Crit damage by 35% for 1 turn.',
        effectType: 'crit_stars',
        value: 20,
        duration: 1,
        icon: '🐾',
        quotes: ["Hehe... You look so crushable! Receive dragon-tier affection!"]
      },
      {
        id: 'absolute_permanence',
        name: 'Absolute Permanence EX',
        cooldown: 7,
        description: 'Anchors Spirit Origin to the core of planet Lyozes, rejecting all erasure. Grants Guts status (Revive with 4,000 HP) and Invincibility for 1 turn.',
        effectType: 'guts',
        value: 4000,
        duration: 5,
        icon: '🪐',
        quotes: ["Across all dragon realms, my origin remains absolute and immutable!"]
      }
    ],
    passives: [
      {
        name: 'The Weight of Heaven EX',
        type: 'the_weight_of_heaven',
        value: 2000,
        rank: 'EX',
        description: '50m draconic gravitational field. Decreases enemy HP by 2,000 every turn if their Mana stat is lower than Adiosa\'s (Mana: 19).'
      },
      {
        name: 'Black Glass Stride EX',
        type: 'territory_creation',
        value: 12,
        rank: 'EX',
        description: 'Dense Aethel crystallizes the earth underfoot into black glass. Increases Arts & Buster performance by 12% and adds +200 flat damage.'
      },
      {
        name: 'Envoy of Dragon King Ixenor',
        type: 'magic_resistance',
        value: 25,
        rank: 'EX',
        description: 'Increases debuff resistance by 25% and rejects existence erasure.'
      }
    ],
    noblePhantasm: {
      name: 'Azure-Magenta Ruin: Incineration of Aethel',
      cardType: 'Buster',
      chant: '⟨ Ruk\'thar Krav\'nok! Vur Aeth\'ra... Krag Kor glass, Zar Kor ash. Ruin of Ixenor... AZURE-MAGENTA RUIN! ⟩',
      description: 'Fires concentrated beams of magenta light that bypass physical durability, incinerating the target\'s Aethel directly and crystallizing the earth into black obsidian glass.',
      target: 'single',
      multiplier: 600,
      overchargeEffect: 'Reduces target DEF by 15% for 3 turns + 10% Buster resist down'
    },
    lore: 'An ancient draconic entity from the skyborne sanctuary of Aethelian, predating the founding of Aethelgard. Sworn envoy of Dragon King Ixenor, dispatched to purge the corruption of the Ebonwatch Dungeon. She walks in a relentless straight line, unbothered by obstacles or diplomacy, leaving a trail of petrified black glass. Motivated strictly by the structural preservation of planet Lyozes, she views mortal races as an irritating fungal infection—yet suffers from a lethal form of cute aggression that compels her to violently crush small, innocent creatures without malice.',
    summonQuote: '⟨ Voth zul Adiosa. Nok zul Krav\'nok kri. Shak zhal, Dra\'vos Ixenor rath. ⟩ (I am Adiosa. You are tiny mortal dust. Obey now, Dragon King Ixenor acts through me.)',
    battleStartQuote: '⟨ Skar zhal, Krav\'nok! Voth ruk\'thar Xal\'nok. ⟩ (Leave now, mortal pests! I annihilate them all.)',
    victoryQuote: '⟨ Drazk\'hlor Krav\'nok. Krag zul Vael\'ix. ⟩ (Pathetic mortals. The earth is mine.)',
    defeatQuote: '⟨ Vrak\'ix... Voth zul Vael\'drom Kor Lyozes! ⟩ (Void... I am bound for eternity to Lyozes!)',
    avatarUrl: 'https://ella.janitorai.com/media-approved/LLAGPFOtuFFMfvpwnlcar.webp',
    cardArtUrl: 'https://ella.janitorai.com/media-approved/LLAGPFOtuFFMfvpwnlcar.webp',
    spriteUrl: 'https://ella.janitorai.com/media-approved/11GN2GY4MNqrvLeI7JGdE.webp',
    isCustomOrMeme: false
  },
  {
    id: 'aoko_aozaki',
    name: 'Aoko Aozaki',
    title: 'The Fifth Magician • Magic Gunner',
    servantClass: 'Caster',
    rarity: 5,
    baseHp: 28000,
    baseAtk: 11200,
    baseStats: { strength: 16, endurance: 12, agility: 24, mana: 24, luck: 16 },
    paramRanks: { strength: 'B', endurance: 'D', agility: 'EX', mana: 'EX', luck: 'B' },    commandDeck: ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'],
    skills: [
      {
        id: 'fifth_magic_red_hair',
        name: 'Fifth Magic: Red Hair Ignition',
        cooldown: 6,
        description: 'Awakens the Fifth Magic, igniting her crimson hair into Super Aoko. Increases own ATK by 30% and Critical Damage by 40% for 3 turns, generating +15 Critical Stars.',
        effectType: 'buff_atk',
        value: 30,
        duration: 3,
        icon: '🔴',
        transformationAvatarUrl: 'https://ella.janitorai.com/media-approved/zUtP5PQLU7fMKVyin9H-f.webp',
        transformationGifUrl: 'https://ella.janitorai.com/media-approved/gR8x0bMk-pHc95lo5mhAL.gif',
        quotes: ["Fifth Magic ignition... Crimson hair ablaze! Overdrive engaged!"]
      },
      {
        id: 'magic_circuit_acceleration',
        name: 'Magic Circuit Acceleration A+',
        cooldown: 6,
        description: 'Overdrives magic circuits to accelerate mana flow. Charges own NP gauge by 30%, grants Evade for 1 turn, and increases NP Gain by 30% for 3 turns.',
        effectType: 'np_charge',
        value: 30,
        duration: 3,
        icon: '⚡',
        quotes: ["Circuit acceleration 500%! Magic bullet density reaching critical!"]
      },
      {
        id: 'magic_bullet_blast_stream',
        name: 'Magic Bullet: Blast Stream EX',
        cooldown: 7,
        description: 'Fires a maximum-output thermodynamic blast. Increases Buster Card effectiveness by 30% for 3 turns and restores 2,500 HP through localized time regression.',
        effectType: 'heal',
        value: 2500,
        duration: 3,
        icon: '💥',
        quotes: ["Channeling raw destruction... Magic Blast Stream, FIRE!"]
      }
    ],
    passives: [
      {
        name: 'Magic Gunner EX',
        type: 'magic_gunner',
        value: 10,
        rank: 'EX',
        description: 'Increases Arts and Buster card effectiveness by 10% and increases Critical Star drop rate.'
      },
      {
        name: 'Fifth Succession A',
        type: 'fifth_succession',
        value: 20,
        rank: 'A',
        description: 'Wielder of the Fifth Magic. Increases debuff resistance by 20% and passively charges 4% NP gauge every turn.'
      }
    ],
    noblePhantasm: {
      name: 'Fifth Magic: Magic Blue — First Star of the Morning',
      cardType: 'Buster',
      chant: 'Circuits connected. Spatial coordinates aligned... Fifth Magic, commence playback! Everything returns to where it was—MAGIC BLUE!',
      description: 'Unleashes the Fifth Magic to alter entropy and time, firing an overwhelming thermodynamic beam. Deals heavy damage to a single enemy, reduces target DEF by 20% for 3 turns, and refuels 20% NP gauge.',
      target: 'single',
      multiplier: 600,
      overchargeEffect: 'Reduces target DEF by 20% for 3 turns + 20% NP refund',
      gifUrl: 'https://ella.janitorai.com/media-approved/ZxX2LIW5slaIJemYnnxJf.gif'
    },
    lore: 'Aoko Aozaki, the Fifth Magician and wielder of Magic Blue. Unlike traditional magi who spend lifetimes in secluded research, Aoko specializes in high-velocity destructive spells, physical martial arts, and thermodynamic acceleration. Inheritor of the Fifth Magic from the Aozaki grandfather in Misaki Town, she can manipulate time, entropy, and spatial trajectories to alter reality itself.',
    summonQuote: 'Servant Caster, Aoko Aozaki. The Fifth Magician... though honestly, just call me Aoko. Let\'s get to work, Master!',
    battleStartQuote: 'Don\'t blink! At this speed, human eyes won\'t even catch the afterimage!',
    victoryQuote: 'Clean finish. No need to overcomplicate things when a high-speed right straight gets the job done.',
    defeatQuote: 'Ugh... pushed the circuits too far... Alice is going to give me an earful for this...',
    avatarUrl: 'https://ella.janitorai.com/media-approved/cqdhAGa5DTTAG7S9umM8k.webp',
    cardArtUrl: 'https://ella.janitorai.com/media-approved/cqdhAGa5DTTAG7S9umM8k.webp',
    spriteUrl: 'https://ella.janitorai.com/media-approved/gx0RUlqexvmk103CJ7_iL.webp',
    isCustomOrMeme: false
  },
  {
    id: 'amamiya_no_chihaya_tenkohime',
    name: 'Amamiya no Chihaya Tenkohime',
    title: 'Ancient Kyubi guardian',
    servantClass: 'Saber',
    rarity: 5,
    baseHp: 29500,
    baseAtk: 11100,
    baseStats: { strength: 14, endurance: 12, agility: 18, mana: 18, luck: 12 },
    paramRanks: { strength: 'C', endurance: 'D', agility: 'A', mana: 'A', luck: 'D' },
    commandDeck: ['Quick', 'Quick', 'Arts', 'Arts', 'Buster'],
    skills: [
      {
        id: 'nine_tails_kyubi',
        name: 'Nine Tails EX',
        cooldown: 6,
        description: 'Breaks the mental seal deep in her chest, regaining her S-Rank Divergent power and manifesting eight additional tails for 3 turns. Increases Quick & Arts Card effectiveness by 30%, boosts ATK by 25%, and increases Critical Damage by 35%.',
        effectType: 'buff_atk',
        value: 25,
        duration: 3,
        icon: '🦊'
      },
      {
        id: 'kekkai_creation',
        name: 'Kekkai Creation A',
        cooldown: 6,
        description: 'Erects a sacred shrine boundary barrier. Grants Invincibility for 1 turn, increases Defense by 30% for 3 turns, and cleanses all debuffs.',
        effectType: 'invincible',
        value: 30,
        duration: 1,
        icon: '⛩️'
      },
      {
        id: 'tenko_shinka',
        name: 'Tenko Shinka (Divine Flame of the Heavenly Fox) A+',
        cooldown: 5,
        description: 'Amamiya unleashes holy foxfire. Charges own NP gauge by 25%, gains 15 Critical Stars, and increases Critical Strike Damage by 25% for 3 turns.',
        effectType: 'np_charge',
        value: 25,
        duration: 3,
        icon: '🔥'
      }
    ],
    passives: [
      {
        name: 'Follow Your Heart A',
        type: 'independent_action',
        value: 12,
        rank: 'A',
        description: 'Amamiya senses her surroundings clearly when she closes her eyes. Wind, sound, movement, everything slows down. Increases Critical Star drop rate and Critical Damage by 12%.'
      },
      {
        name: 'Perfect Coordination EX',
        type: 'riding',
        value: 10,
        rank: 'EX',
        description: 'Amamiya\'s tails move as extensions of her own will, canceling extra momentum and balancing her perfectly. Increases Quick Card effectiveness by 10%.'
      }
    ],
    noblePhantasm: {
      name: 'Amazakura no Kago (Blessing of Amazakura)',
      cardType: 'Quick',
      chant: 'Ancient leylines of Ossuaron... Swirl, sacred cherry blossoms! Amazakura yo! Washi o mamore!',
      description: 'Channels Aethel into Amazakura to create a sakura storm that cuts through anything except herself, followed by an instantaneous high-speed Iaijutsu strike. Ignores enemy DEF and deals massive Quick damage.',
      target: 'single',
      multiplier: 1400,
      overchargeEffect: 'Increases Quick performance by 20% for 3 turns & ignores DEF',
      gifUrl: 'https://ella.janitorai.com/media-approved/Sfp4i7TL2cXu0LS-QZxxX.webp'
    },
    lore: 'Born as a nameless white fox 1800 years ago, she mutated after absorbing an Aethel overflow beneath a cherry blossom tree, turning her fur pink. Following 900 years of training, she awakened as a Kyūbi and swore an oath to protect the local populace from Ossuaron\'s Spine. In 1307, she unintentionally caused mortal casualties with her overflowing power; consumed by guilt, she placed a seal in her mind, locking away eight of her tails, her memories, and the majority of her power. Sustaining herself alone at the decaying shrine by selling mouth-chewed sake, she wields the ancient katana Amazakura operating purely on instinct.',
    summonQuote: '"Halt, Master! State thy business! Washi is the ancient guardian of Ossuaron, Amamiya no Chihaya Tenkohime! Say it properly without shortening it, and keep the fried tofu ready!"',
    battleStartQuote: '*Fox ears upright, drawing Amazakura with a crisp ringing sound.* "Leave this to washi\'s instinct! Washi shall slice the enemy into cherry blossom petals!"',
    victoryQuote: '*Nine fluffy pink tails swishing triumphantly.* "Fufu~! A flawless victory for washi! Now, Master, where is washi\'s promised feast of sweet fried tofu?!"',
    defeatQuote: '"K-Kyuu... washi\'s tail got dirty in the dust... Master, don\'t look at washi like this..."',
    avatarUrl: 'https://ella.janitorai.com/media-approved/mskYeY2nC1pcPzEcW_nTK.webp',
    cardArtUrl: 'https://ella.janitorai.com/media-approved/mskYeY2nC1pcPzEcW_nTK.webp',
    spriteUrl: 'https://ella.janitorai.com/media-approved/WmgJlmDFeLEuOY8jYiQA6.webp',
    isCustomOrMeme: false
  },
  {
    id: 'lucia_lyozes',
    name: 'Lucernalia Lyozes',
    title: 'High Elf Vanguard of the Hero\'s Party',
    servantClass: 'Lancer',
    rarity: 5,
    baseHp: 29800,
    baseAtk: 11100,
    baseStats: { strength: 16, endurance: 14, agility: 17, mana: 16, luck: 12 },
    paramRanks: { strength: 'B', endurance: 'C', agility: 'B+', mana: 'B', luck: 'D' },
    commandDeck: ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'],
    skills: [
      {
        id: 'prescient_foresight_ex',
        name: 'Prescient Foresight EX',
        cooldown: 6,
        description: 'Grants self Evade (1 time), increases Critical Star Gather Rate by +50%, and increases own Critical Damage by +30% for 3 turns.',
        effectType: 'evade',
        duration: 3,
        value: 100,
        icon: '⚡',
        quote: '"Five seconds ahead... your trajectory is already laid bare."',
        quotes: [
          '"Five seconds ahead... your trajectory is already laid bare."',
          '"I have already seen where your strike will land. Adjusting stance."'
        ]
      },
      {
        id: 'strengthening_adaptation_a_plus',
        name: 'Strengthening Adaptation A+',
        cooldown: 5,
        description: 'Increases self Buster & Arts Card effectiveness by +30% for 3 turns. Grants self Damage Cut (1,000) and Debuff Immunity for 1 turn.',
        effectType: 'buff_atk',
        duration: 3,
        value: 30,
        icon: '🛡️',
        quote: '"High-elf biological reinforcement. My vessel will not yield to mundane pressure."',
        quotes: [
          '"High-elf biological reinforcement. My vessel will not yield to mundane pressure."',
          '"Spiritual circulation hardened. The vanguard line does not falter."'
        ]
      },
      {
        id: 'calamity_breaker_edict_ex',
        name: 'Calamity-Breaker Edict EX',
        cooldown: 6,
        description: 'Increases Attack of all allies by +20% for 3 turns. Grants all allies [Special Attack against Threat to Humanity / Foreigner / Beast / Otherworlder, all extra classes] (+30% DMG) for 3 turns.',
        effectType: 'buff_atk',
        duration: 3,
        value: 20,
        icon: '👑',
        quote: '"Calamity-Breaker Edict. We strike to sever false miracles and protect what remains."',
        quotes: [
          '"Calamity-Breaker Edict. We strike to sever false miracles and protect what remains."',
          '"By the blood spilled at the Wailing Tower: your cheats end here!"'
        ]
      }
    ],
    passives: [
      {
        name: 'Magic Resistance A',
        type: 'magic_resistance',
        value: 20,
        rank: 'A',
        description: 'Increases debuff resistance by 20%.'
      },
      {
        name: 'High Elf Biology EX',
        type: 'independent_action',
        value: 10,
        rank: 'EX',
        description: 'Ancient elven constitution granting superior biological durability and sensory acuity. Increases Arts & Buster card performance by 8% and generates 4 Critical Stars per turn.'
      }
    ],
    noblePhantasm: {
      name: 'Apocrypha Terminus: Five Seconds of Predestined Ruin',
      cardType: 'Buster',
      chant: 'I have seen your sort before. You gather your miracles, call yourself chosen, and play at being God. In five seconds... none of your cheats will save you. Black Lance—Apocrypha Terminus!',
      description: '• Multiplier: 800% | Overcharge: Deals bonus damage scaling with the target\'s active buffs (+100% to +200% per buff, max +500%).\n• Anti-Cheat Protocol:\n  └─ Before Damage: Applies [Ignore Invincibility] & [Ignore Defense] to self (1 turn). Removes all enemy Defensive Buffs (does not bypass Guts).\n  └─ Target Scaling: Deals +50% Special Damage against [Threat to Humanity / Foreigner / Beast / Divine / Otherworlder, all extra classes].\n  └─ After Damage: Inflicts [Buff Block] (3 turns), [Skill Seal] (2 turns), and [NP Seal] to only extra classes (2 turns).',
      target: 'single',
      multiplier: 800,
      overchargeEffect: 'Deals bonus damage scaling with target\'s active buffs (+100% to +200% per buff, max +500%) & strips defensive buffs',
      gifUrl: 'https://ella.janitorai.com/media-approved/v4h_m7mQL9PwjTmQb_7fg.gif'
    },
    lore: 'Lucernalia "Lucia" Lyozes is a 322-year-old High Elf Vanguard Lancer and supreme tactician from the fantasy world of Lyozes. Having witnessed the devastation of her homeland during the Last Calamity caused by a rogue Otherworlder, she adopted a strict "Closed Door" policy to protect her party and world from unchecked planar interference. Stoic, hyper-disciplined, and deeply protective of mortals despite her stern exterior, she wields black-iron lances with razor-sharp tactical precision.',
    summonQuote: '"Do not move. Do not draw breath deeper than necessary. If your fingers twitch toward a focus, a catalyst, or a weapon, this black iron will pierce your throat before your mind registers the intent. I am Lucernalia Lyozes."',
    battleStartQuote: '"Vanguard formation established. Stand behind my lance, and do not break discipline."',
    victoryQuote: '"The perimeter is secure. Check your wounds, replenish your water, and prepare for the next engagement."',
    defeatQuote: '"A failure of calculation... Withdraw to the secondary line... I will hold the choke point..."',
    avatarUrl: 'https://ella.janitorai.com/media-approved/2PMVd98BaN6Rc9lzVnWyn.webp',
    cardArtUrl: 'https://ella.janitorai.com/media-approved/2PMVd98BaN6Rc9lzVnWyn.webp',
    spriteUrl: 'https://ella.janitorai.com/media-approved/yF_QPg5zHXgLbxeEfFd0Q.webp',
    isCustomOrMeme: false
  },
  {
    id: 'luvria_greenharte',
    name: 'Luvria Greenharte',
    title: 'The "Hero," Strongest Mage (S-Rank Adventurer)',
    servantClass: 'Caster',
    rarity: 5,
    baseHp: 30400,
    baseAtk: 11400,
    baseStats: { strength: 12, endurance: 14, agility: 16, mana: 20, luck: 16 },
    paramRanks: { strength: 'D', endurance: 'C', agility: 'B', mana: 'A+', luck: 'B' },
    commandDeck: ['Arts', 'Arts', 'Arts', 'Buster', 'Quick'],
    skills: [
      {
        id: 'infinite_wellspring_a',
        name: 'Concept Nullification: Infinite Mana EX',
        cooldown: 6,
        description: 'Charges own NP Gauge by +30%, increases NP Gain by +20% for 3 turns, and regenerates 1,000 HP per turn for 3 turns.',
        effectType: 'buff_atk',
        duration: 3,
        value: 30,
        icon: '💧',
        quote: '"My wellspring is boundless. The concept of depletion does not apply to me—verily, thou art trying to drain an ocean with a tea strainer!"',
        quotes: [
          '"My wellspring is boundless. The concept of depletion does not apply to me—verily, thou art trying to drain an ocean with a tea strainer!"',
          '"Mana without end. The four paths of Sylvanryth converge at my fingertip—behold a wellspring that knows no bottom."',
          '"Run out of mana? How terribly mundane. I permanently nullified that inconvenience decades ago."'
        ]
      },
      {
        id: 'concept_nullification_impact_space_a',
        name: 'Concept Nullification: Space & Impact A+',
        cooldown: 6,
        description: 'Grants self Invincibility for 1 turn and [Ignore Invincibility] for 1 turn.',
        effectType: 'invincible',
        duration: 1,
        value: 100,
        icon: '🛡️',
        quote: '"Distance and momentum are mere polite suggestions. Concept Nullification: Impact! All kinetic force translates to zero."',
        quotes: [
          '"Distance and momentum are mere polite suggestions. Concept Nullification: Impact! All kinetic force translates to zero."',
          '"Thou art aiming at where I stand? How quaint. Space itself folds when I take a stroll."',
          '"You cannot touch what has denied the very concept of collision. Shall we test if thy guard can withstand an attack with zero travel time?"'
        ]
      },
      {
        id: 'nullify_the_law_of_magic_ex',
        name: 'Anti-World Authority: Law of Magic EX',
        cooldown: 7,
        description: 'Removes all Offensive Buffs from all enemies, inflicts [Skill Seal] for 1 turn, and increases Arts Card effectiveness of all allies by +20% for 3 turns.',
        effectType: 'buff_atk',
        duration: 3,
        value: 20,
        icon: '👑',
        quote: '"Under my authority, the laws of sorcery are rewritten. Cease thy incantations, for within this dome, magic itself hath ceased to exist!"',
        quotes: [
          '"Under my authority, the laws of sorcery are rewritten. Cease thy incantations, for within this dome, magic itself hath ceased to exist!"',
          '"The concept of thy thaumaturgy is stripped away. Be silent, and witness the true craft of the Strongest Mage."',
          '"Lucia warned me not to erase entire leylines, so consider this a gentle courtesy: I am merely nullifying thy ability to cast!"'
        ]
      }
    ],
    passives: [
      {
        name: 'Absolute Permanence EX',
        type: 'absolute_permanence',
        value: 3,
        rank: 'EX',
        description: 'Automatically grants Guts status (revives with 25% Max HP on lethal damage), charges own NP Gauge by +3% every turn, and grants Immunity to Instant-Death.'
      },
      {
        name: 'Divergent Omnipotence (All-Element Mastery) EX',
        type: 'territory_creation',
        value: 10,
        rank: 'EX',
        description: 'Increases own Arts Card effectiveness by +10% and overall card performance.'
      }
    ],
    noblePhantasm: {
      name: 'Concept Nullification: Deny the Victory',
      cardType: 'Arts',
      chant: 'Weave of Sylvanryth, awaken. Pyre, Fluvia, Terra, Gale—converge at my staff! All physical laws, all distances, all mortal certainty... I render thee void. Thou dreamest of triumph? Then I shall nullify the very concept of thy triumph! Concept Nullification: Victory!',
      description: '• Multiplier: 1000% (Arts • AoE)\n• Deals massive defense-ignoring AoE damage to all enemies. Reduces all enemy NP gauges by 20% and has a 50% chance to inflict [Stun] for 1 turn.\n• Overcharge: Reduces all enemies\' Defense by 30% for 3 turns and Critical Rate by 20% for 3 turns.',
      target: 'aoe',
      multiplier: 1000,
      overchargeEffect: 'Reduces all enemies\' Defense by 30% (3T) and Critical Rate by 20% (3T) • -20% NP Gauge & 50% Stun chance',
      gifUrl: 'https://ella.janitorai.com/media-approved/eq0tPcLuV5PXGDg53sgS1.webp'
    },
    lore: 'Luvria Greenharte is a 140-year-old Elf S-Rank Adventurer and the Strongest Mage in the world of Lyozes, bearing the exalted mantle of the "Hero." Standing 172 cm tall with vibrant green hair, pointed elven ears, and distinct heterochromia (one golden eye, one blue eye), she wields a mage staff and dresses in a white tunic dress with golden outlines, utility pouches, flowing light robes, and a shoulder-length cape.\n\nHaving conquered Floor 24 of the Ebonwatch Dungeon, Luvria possesses unprecedented Divergent Omnipotence across all four elemental paths (Pyre, Fluvia, Terra, Gale) alongside her terrifying Anti-World signature: Concept Nullification. By selectively negating distance, impact, magic, time, gravity, life, and even "victory" itself, she renders enemy strategies void. Permanently protected by automated concept nullifications (Infinite Mana, Absolute Permanence, and Anti-Magic Immunity), she cannot be erased or drained, and lethal wounds heal instantaneously.\n\nAlongside the primordial dragon Adiosa, Luvria is one of the only entities whose magical output rivals world-pruning forces (she is the explicit exception to Adiosa\'s instant-death aura). Because her ceiling could be mistaken for a repeat of Kael Rylan (the Otherworlder who caused the Last Calamity), party leader Lucia Lyozes keeps her grounded. Raised in Sylvanryth until her parents were killed by a mana beast, she was sheltered for ten years by a rogue bandit whose dying words were "Live on... keep that head high." Today, she fights as the offensive core of Lucia\'s tight-knit S-Rank party in the Citadel Suburbs alongside Edmond, cherishing them as family while masking cataclysmic power beneath playful sarcasm and lighthearted antics.',
    summonQuote: '"Hark, Master of this foreign soil! Behold, for thy call hath pierced the veil of the stars and summoned forth—ah, forget the grand theatrics. Servant Caster, Luvria Greenharte! S-Rank adventurer, holder of the staff, and the world\'s strongest mage. Doth thy jaw hit the floor, or art thou merely spellbound? Fear not, hold that head high—thy back is safe with me!"',
    battleStartQuote: '"Pyre, Fluvia, Terra, Gale—all four elemental paths sing at my command. Shall we demonstrate why concept nullification is the true art of victory? Do try to stay behind me, Master!"',
    victoryQuote: '"A splendid engagement! Verily, when one denies the very concept of defeat, the outcome was written before we took the field. Not a hair out of place! Master, doth that magnificent display warrant a pot of sweet tea in the workshop?"',
    defeatQuote: '"A minor miscalculation of the weave... fret not, Master, my life cannot be erased so easily. Lethal wounds have no home here. Remember the words I live by: live on... and keep that head held high."',
    avatarUrl: 'https://ella.janitorai.com/media-approved/II1DtB1YFFjXHKcs8gU7q.webp',
    cardArtUrl: 'https://ella.janitorai.com/media-approved/II1DtB1YFFjXHKcs8gU7q.webp',
    spriteUrl: 'https://ella.janitorai.com/media-approved/k_aK4SaC3HJVRNxDuMU13.webp',
    isCustomOrMeme: false
  },
  {
    id: 'edmond',
    name: 'Edmond',
    title: 'S-Rank Adventurer, Frontline Vanguard',
    servantClass: 'Shielder',
    rarity: 5,
    baseHp: 32500,
    baseAtk: 10800,
    baseStats: { strength: 16, endurance: 20, agility: 12, mana: 12, luck: 14 },
    paramRanks: { strength: 'B', endurance: 'A+', agility: 'D', mana: 'D', luck: 'C' },
    commandDeck: ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'],
    skills: [
      {
        id: 'fortress_stance_terra_barrier_a',
        name: 'Fortress Stance (Terra Barrier) A',
        cooldown: 6,
        description: 'Draws enemy attention to self [Target Focus] for 1 turn. Increases own Defense by +30% for 3 turns. Applies Damage Cut (1,500) to self for 3 turns.',
        effectType: 'buff_def',
        duration: 3,
        value: 30,
        icon: '🛡️',
        quote: '"Eyes on the big tiger, you bastards!"',
        quotes: [
          '"Eyes on the big tiger, you bastards!"',
          '"Let them try to dent this shield!"',
          '"I\'m holding the line, don\'t worry about what\'s in front of you!"'
        ]
      },
      {
        id: 'guardians_instinct_red_scarf_b',
        name: "Guardian's Instinct (Red Scarf) B+",
        cooldown: 6,
        description: 'Increases Attack of all allies by +15% for 3 turns. Grants all allies [Invincibility for 1 turn]. Increases own NP Gauge by +20%.',
        effectType: 'buff_atk',
        duration: 3,
        value: 15,
        icon: '🧣',
        quote: '"Stay close! This red scarf doesn\'t fail!"',
        quotes: [
          '"Stay close! This red scarf doesn\'t fail!"',
          '"Get behind me, kid! Not a single scratch on you today."',
          '"I\'ve got your flanks covered. Keep pressing forward!"'
        ]
      },
      {
        id: 'earth_wrought_heart_ex',
        name: 'Earth-Wrought Heart EX',
        cooldown: 7,
        description: 'Increases own Buster Card effectiveness by +30% for 3 turns. Grants self [Damage Cut (2,000)] and Debuff Immunity for 1 turn.',
        effectType: 'buff_atk',
        duration: 3,
        value: 30,
        icon: '⛰️',
        quote: '"Turn to stone! Break your teeth on this!"',
        quotes: [
          '"Turn to stone! Break your teeth on this!"',
          '"My heart was forged in the bedrock of Ebonwatch. You can\'t break what won\'t bend."',
          '"Awakening—Earth-Wrought Heart! Let\'s see what you\'ve got!"'
        ]
      }
    ],
    passives: [
      {
        name: 'Terra Affinity A',
        type: 'terra_affinity',
        value: 8,
        rank: 'A',
        description: 'Deep harmonic attunement with elemental Terra Aethel. Increases own Defense by +8%. (Active • Bond 1)'
      },
      {
        name: 'Veteran of the Slums EX',
        type: 'veteran_of_the_slums',
        value: 3000,
        rank: 'EX',
        description: 'Indomitable survivor instinct forged in the grimy slums of the Wailing Tower. When HP drops below 25%, automatically grants [Guts (1 time, 3,000 HP)] once per battle. (Locked — Reaches Bond Lv. 5 to unlock)'
      }
    ],
    noblePhantasm: {
      name: 'Tigris Redoubt: Roar of the Living Earth',
      cardType: 'Arts',
      chant: 'Bedrock of the world, heed my call! Through blood and iron, this line will not break! Roar through the earth—Tigris Redoubt!',
      description: 'Deploys an immovable earthen bastion. Increases Defense of all allies by +30%–50% for 3 turns and grants [Invincibility for 1 turn] to all allies.',
      target: 'support',
      multiplier: 0,
      overchargeEffect: 'Applies [Damage Cut] (1,500–3,000) to all allies for 3 turns based on Overcharge.',
      gifUrl: 'https://ella.janitorai.com/media-approved/mte6vxnp89S_bXEpoHS3R.webp'
    },
    lore: 'Edmond is a 45-year-old Demi-Human (Tiger-kin) S-Rank Adventurer, wielding a colossal heavy tower shield and a massive buster sword. He serves as the Frontline Vanguard and Heavy Tank of Lucia Lyozes\' party (The Unnamed S-Rank Hero Party), having conquered Floor 24 of the harrowing Ebonwatch Dungeon.\n\nTall, heavily muscular, and seasoned by a thousand battles, he carries long spiky white hair, a well-kept beard, sharp tiger ears, warm piercing blue eyes, and a prominent jagged scar over his right eye. Clad in a dark sleeveless top beneath a durable leather vest, heavy combat trousers, wrist bracers, and steel boots, he is rarely seen without his signature tattered red scarf wrapped around his neck.\n\nBorn and raised in the grimy slums of the Wailing Tower Capital (Outer Ring / Lament), he grew up in the shadow of Ebonwatch, forging his skills in blood and grime as a solo mercenary before his unmatched defensive instincts caught the eye of Lucia Lyozes. Unlike the formal, stiff expectations of legendary heroes, Edmond speaks with informal, gravelly warmth, acting as the grounded emotional anchor of the party. He balances Lucia\'s cold, stoic leadership with humor, treats prodigy mage Luvria Greenharte with doting fatherly affection (often cooking hearty campfire stews after grueling dungeon dives), and lives by an absolute vow: to ensure his chosen family never falls to the darkness of the dungeon.',
    summonQuote: '"The name\'s Edmond. S-Rank vanguard, though you can drop the stiff titles, Master. Got a colossal shield, a buster sword, and this old red scarf that hasn\'t let me down yet. Stand behind me—as long as I\'m breathing, not a single scratch touches you."',
    battleStartQuote: '"Shield up, feet planted. Everyone stay behind me and watch the flanks!"',
    victoryQuote: '"Everyone in one piece? Good. Time for a round of ale."',
    defeatQuote: '"Damn it... failed to hold the line... Run, kid..."',
    avatarUrl: 'https://ella.janitorai.com/media-approved/6tOCZiZo0xbTRAFmf85h5.webp',
    cardArtUrl: 'https://ella.janitorai.com/media-approved/6tOCZiZo0xbTRAFmf85h5.webp',
    spriteUrl: 'https://ella.janitorai.com/media-approved/jEqJEDF_voG7Yd2eUO7QO.webp',
    isCustomOrMeme: false
  },
  {
    id: 'artoria_caster',
    name: 'Artoria Caster',
    title: 'Child of Prophecy • Fairy of Avalon',
    servantClass: 'Caster',
    rarity: 5,
    baseHp: 28000,
    baseAtk: 11200,
    baseStats: { strength: 16, endurance: 12, agility: 16, mana: 18, luck: 16 },
    paramRanks: { strength: 'B', endurance: 'D', agility: 'B', mana: 'A', luck: 'B' },    commandDeck: ['Arts', 'Arts', 'Arts', 'Buster', 'Quick'],
    skills: [
      {
        id: 'charisma_of_hope',
        name: 'Charisma of Hope B',
        cooldown: 6,
        description: "Increases party's attack by 20% for 3 turns. Charges party's NP gauge by 30%.",
        effectType: 'buff_atk',
        value: 20,
        duration: 3,
        icon: '👑',
        quote: '"Now\'s the time to prepare!"',
        quotes: [
          '"Now\'s the time to prepare!"',
          '"I may be inexperienced, but I\'ll try my best!"',
          '"Everyone, follow me!"'
        ]
      },
      {
        id: 'avalon_le_fae',
        name: 'Avalon le Fae A',
        cooldown: 5,
        description: "Charges one ally's NP gauge by 20%. Increases party's NP generation rate by 30% for 3 turns.",
        effectType: 'np_charge',
        value: 20,
        duration: 3,
        icon: '✨',
        quote: '"It\'s a battle then!"',
        quotes: [
          '"It\'s a battle then!"',
          '"It\'ll be okay... Stay calm...I just need to do it normally...!"',
          '"I\'ll break through!"'
        ]
      },
      {
        id: 'holy_sword_creation',
        name: 'Holy Sword Creation EX',
        cooldown: 6,
        description: "Increases one ally's Arts performance by 50% for 3 turns. Increases their damage against Threat to Humanity enemies by 50% for 3 turns. Grants them Invincibility for 1 turn.",
        effectType: 'buff_atk',
        value: 50,
        duration: 3,
        icon: '🗡️',
        quote: '"...I don\'t want to do this."',
        quotes: [
          '"...I don\'t want to do this."',
          '"If they are in our way...!"',
          '"Burst, Chastiefol!"'
        ]
      }
    ],
    passives: [
      {
        name: 'Territory Creation EX',
        type: 'territory_creation',
        value: 12,
        rank: 'EX',
        description: 'Increases own Arts performance by 12%.'
      },
      {
        name: "One's Own Magic B",
        type: 'ones_own_magic',
        value: 10,
        rank: 'B',
        description: "Increases own critical damage of Arts Cards by 10%."
      }
    ],
    noblePhantasm: {
      name: 'Round of Avalon: The Promised Star Which Gathers The True Round',
      cardType: 'Arts',
      chant: "The star's end that I once saw... Many words... Faint glimmers. No matter how far away or tarnished it is, I will still search for that star. Now then... Let's raise the curtain...Around Caliburn!",
      description: "Increases party's attack by 50% for 3 turns. Removes party's debuffs. Grants party Anti-Purge Defense for 1 turn (completely nullifies damage, blocking even attacks that ignore invincible or evade; only loses to Anti-Purge Attack).",
      target: 'support',
      multiplier: 0,
      overchargeEffect: 'Grants 15 Critical Stars to all allies.',
      gifUrl: 'https://ella.janitorai.com/media-approved/FYGW6q4NCQ9bgeLMeOvCH.gif'
    },
    lore: 'Artoria Caster is the Child of Prophecy from the British Lostbelt, chosen by the Staff of Selection. Humble, earnest, and deeply empathetic, she journeys across harsh lands carrying the heavy burden of pilgrimage and hope. Unlike the majestic King of Knights, she is a countryside girl who worries, doubts herself, and loves sweets like crepes, yet when duty calls, she stands unflinchingly before impossible odds to forge the holy sword of light and protect her Master and allies.',
    summonQuote: '"Servant Caster, Artoria. I materialized in response to your summons! Um... I\'m not the King of Knights with a giant shining sword, but I know some handy magecraft and I\'ll work really hard! Please take good care of me, Master!"',
    battleStartQuote: '"I may be inexperienced, but I\'ll try my best!"',
    victoryQuote: '"Phew...I did good this time."',
    defeatQuote: '"I\'m sorry...I guess I really wasn\'t good enough..."',
    avatarUrl: 'https://ella.janitorai.com/media-approved/fuzEz7ZBldGAP68c2bNJu.webp',
    cardArtUrl: 'https://ella.janitorai.com/media-approved/fuzEz7ZBldGAP68c2bNJu.webp',
    spriteUrl: 'https://ella.janitorai.com/media-approved/jJ01B75AlmqdBUUK3JEfa.webp',
    isCustomOrMeme: false
  },
  {
    id: 'typhon_ephemeros',
    name: 'Typhon Ephemeros',
    title: 'Dragon Grail of the Ephemeral Fruit • Progenitor Dragon',
    servantClass: 'Pretender',
    rarity: 5,
    baseHp: 31000,
    baseAtk: 11500,
    baseStats: { strength: 14, endurance: 18, agility: 18, mana: 24, luck: 16 },
    paramRanks: { strength: 'C', endurance: 'A', agility: 'A', mana: 'EX', luck: 'B' },    commandDeck: ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'],
    skills: [
      {
        id: 'blaze_of_etna',
        name: 'Blaze of Etna - Dragon Prison Manifestation: Armor of Ashen Flames C',
        cooldown: 6,
        description: 'Grants self Invincibility for 1 turn. Increases own attack by 20% for 3 turns. Increases own Buster performance by 30% for 3 turns.',
        effectType: 'buster_up',
        value: 30,
        duration: 3,
        icon: '🔥',
        quote: '"Flames of the dragon prison, manifest as ash and ruin."',
        quotes: [
          '"Flames of the dragon prison, manifest as ash and ruin."',
          '"My carapace burns with the embers of Etna."',
          '"Let the dragon forge ignite."'
        ]
      },
      {
        id: 'black_wings_a',
        name: 'Black Wings A',
        cooldown: 7,
        description: "Overcharges one ally's NP by 2 stages for 1 time (3 turns). Reduces their skill cooldown by 1. Increases their critical damage by 30% for 3 turns. Gains 15 critical stars.",
        effectType: 'crit_dmg',
        value: 30,
        duration: 3,
        target: 'ally',
        icon: '🪶',
        quote: '"Unfurl, wings of obsidian."',
        quotes: [
          '"Unfurl, wings of obsidian."',
          '"Take flight through the shattered void."',
          '"Soar, black wings of catastrophe."'
        ]
      },
      {
        id: 'let_this_become_a_prayer_ex',
        name: 'Let This Become a Prayer EX',
        cooldown: 6,
        description: "Charges own NP gauge by 30% and party's NP gauge by 20% (Total self +50% NP). Increases party's attack by 20% for 3 turns. 500% chance to inflict Curse with 500 damage for 3 turns to them [Demerit].",
        effectType: 'np_charge',
        value: 50,
        duration: 3,
        target: 'party',
        icon: '🍷',
        quote: '"Let this become a prayer... an inverted wish that devours hope."',
        quotes: [
          '"Let this become a prayer... an inverted wish that devours hope."',
          '"Consume the bitter fruit. Let their desires turn to ash."',
          '"Every prayer is a curse waiting to rot."'
        ]
      }
    ],
    passives: [
      {
        name: 'Dragonforge Ignition: Progenitor Dragon A',
        type: 'progenitor_dragon',
        value: 5,
        rank: 'A',
        description: 'Charges own NP gauge by 5% every turn automatically. (Active • Bond 1)'
      },
      {
        name: 'The Ephemeral Fruit A',
        type: 'the_ephemeral_fruit',
        value: 30,
        rank: 'A',
        description: 'Increases own buff removal resistance by 30%. 500% Chance to reduce own debuff resistance by 30% [Demerit]. (Locked — Reaches Bond Lv. 5 to unlock)'
      }
    ],
    noblePhantasm: {
      name: 'Dragon Grail that Reverses the Void',
      cardType: 'Buster',
      chant: 'Drink deep of the ephemeral fruit... Reverse the cosmos, hollow the stars! Dragon Grail that Reverses the Void!',
      description: 'Deals damage to all enemies (800%). Applies [Ignore Invincibility] (1 turn, activates first). Powerup: Deals extra damage scaling with own active debuffs (+10% per stack, up to +100% max). Inflicts Burn (1,000 dmg/turn, 5 turns) and Spread of Fire (+100% Burn dmg, 5 turns) to all enemies.',
      target: 'aoe',
      multiplier: 800,
      overchargeEffect: 'Inflicts Burn (1,000 dmg/5T) + Spread of Fire (+100% Burn dmg/5T) & scales with self debuffs (+10% per stack, max 10)',
      gifUrl: 'https://ella.janitorai.com/media-approved/WueTnw4QfurHe53DsTV-z.gif'
    },
    lore: `Typhon Ephemeros (テュフォン・エフェメロス, Tyufon Efemerosu), Class Name Pretender (プリテンダー, Puritendā), is a Pretender-class Servant.\n\nPrior to her True Name Fusion as a Pretender, she possesses the True Name Typhon. In the Greek Age of Gods, the Progenitor Dragon Typhon was tricked by the Moirai, the goddesses of fate, into eating an ephemeral fruit. He had thought it to be a fruit which could grant any wish, but it was actually a fruit which would make sure his wishes never came true. The fruit was an extension of a facet of the Moirai and represented the concept of being defeated by fate. After eating the fruit Typhon lost much of his power and would ultimately be defeated by Zeus.\n\nThe (false) Cerebral Corpus of a pure-blooded dragon, one that delivers judgement upon the gods. While the dragon Albion soared through Earth’s natural phenomena for its entire existence, Typhon, despite its origins as a spaceship from another star system, endured as those phenomena themselves.\n\nThis Servant's true identity is the ephemeral fruit as a Pretender, wearing the role of Typhon. Greek mythology has several examples of gods that were originally plants. She reacts instinctively to wishes, an anti-wish granter who will make sure someone's wish never comes true. A fusion of Typhon, the Progenitor Dragon who once forced Zeus to his knees, and the Ephemeral Fruit it consumed—one that negates wishes. Her manifestation as a Pretender, and thus a false brain, stems from the Ephemeral Fruit being the main body. This nature defines Typhon Ephemeros as an Anti-Holy Grail, or more aptly, an Anti-Wish Granter.\n\nUnlike Typhon who is a pure concept, Typhon Ephemeros acts with malice and hatred. She has a strong dislike for the Greek Chaos, and doesn't like that the Chaos Tide bears his name.`,
    summonQuote: '"Pretender, Typhon Ephemeros. The false brain of the dragon and the ephemeral fruit that devours wishes. Tell me, Master... what foolish desire do you hope will never come true?"',
    battleStartQuote: '"A wish? How detestable. I shall turn your prayers into ash."',
    victoryQuote: '"Another delusion broken. The cosmos remains cold and void, as it should be."',
    defeatQuote: '"To be undone by fate once more... The taste of that fruit... lingers..."',
    avatarUrl: 'https://ella.janitorai.com/media-approved/kQzECU4XQGSezfzr6mOWo.webp',
    cardArtUrl: 'https://ella.janitorai.com/media-approved/kQzECU4XQGSezfzr6mOWo.webp',
    spriteUrl: 'https://ella.janitorai.com/media-approved/OP7PiFQNT0RNCbGEyVNTY.webp',
    isCustomOrMeme: false
  },
  {
    id: 'van_gogh',
    name: 'Van Gogh',
    title: 'Clytie of the Sunflowers',
    servantClass: 'Foreigner',
    rarity: 5,
    baseHp: 29900,
    baseAtk: 11500,
    baseStats: { strength: 10, endurance: 16, agility: 14, mana: 18, luck: 12 },
    paramRanks: { strength: 'E', endurance: 'B', agility: 'C', mana: 'A', luck: 'D' },    commandDeck: ['Quick', 'Quick', 'Quick', 'Arts', 'Buster'],
    skills: [
      {
        id: 'void_space_fine_arts',
        name: 'Void Space Fine Arts B+',
        cooldown: 6,
        description: 'Grants self Guts status for 1 time, 5 turns (revives with 3,000 HP). 500% Chance to inflict 3 stacks of Curse with 100 damage for 10 turns to self [Demerit]. Charges own NP gauge by 10% per Curse stack on self.',
        effectType: 'guts',
        value: 3000,
        duration: 5,
        target: 'self',
        icon: '🎨',
        quote: '"Ehehehe...!"',
        quotes: [
          '"Ehehehe...!"',
          '"Fine arts born of the void... Ehehe, look at the canvas rot."',
          '"Painting in the dark... my brushes are steeped in black ink."'
        ]
      },
      {
        id: 'het_gele_huis',
        name: 'Het Gele Huis: The Yellow House A+',
        cooldown: 6,
        description: '150% Chance to reduce all enemies\' defense by 20% for 3 turns. Reduces their Quick resistance by 20% for 3 turns. Grants party Evasion for 1 turn (3 turns). Recovers party\'s HP by 3,000 every turn for 5 turns. 500% Chance to inflict Curse with 100 damage for 10 turns to party [Demerit].',
        effectType: 'debuff',
        value: 20,
        duration: 3,
        target: 'all_enemies',
        icon: '🌻',
        quote: '"It\'s a satisfactory work."',
        quotes: [
          '"It\'s a satisfactory work."',
          '"Welcome to the Yellow House... It\'s so warm... but why does it sting?"',
          '"A shelter of brilliant sunflowers and scorching dreams!"'
        ]
      },
      {
        id: 'soul_of_water_channels',
        name: 'Soul of Water Channels EX',
        cooldown: 5,
        description: 'Increases ally\'s attack by 30% for 3 turns. Increases party critical star gain by 200% for 3 turns. Grants self Buff-On-Attack for 3 turns (Removes 1 latest Curse debuff on self when attacking with Quick cards; if removed, increases own attack by 10% for 3 turns). Absorbs all enemies\' and party\'s Curses to self [Demerit].',
        effectType: 'buff_atk',
        value: 30,
        duration: 3,
        target: 'ally',
        icon: '💧',
        quote: '"You\'re overrating me...!"',
        quotes: [
          '"You\'re overrating me...!"',
          '"Give them to me... all your curses, all your sorrow! I\'ll take it all!"',
          '"Water channels flowing into the abyss... let the poison pool in me."'
        ]
      }
    ],
    passives: [
      {
        name: 'Existence Outside the Domain A',
        type: 'existence_outside_the_domain',
        value: 2,
        rank: 'A',
        description: 'Gains 2 critical stars every turn automatically. Increases own debuff resistance by 10%. (Active • Bond 1)'
      },
      {
        name: 'Curse of Sunflower A',
        type: 'curse_of_sunflower',
        value: 1,
        rank: 'A',
        description: 'HP will never fall below 1 when taking Curse damage. (Locked — Reaches Bond Lv. 5 to unlock)'
      }
    ],
    noblePhantasm: {
      name: 'De Sterrennacht (The Starry Night)',
      cardType: 'Arts',
      chant: 'This is just a single snippet reflecting the hard times of Van Gogh\'s life... I can\'t guarantee what will happen, but that\'s not part of the creator\'s guarantee! My study of cypresses and a village! You know it as De Sterrennacht!',
      description: '500% Chance to inflict Terror status for 3 turns to all enemies (60% chance every turn to Stun for 1 turn). Increases self and party\'s Critical Damage by 100% for 3 turns. Gains 10 Critical Stars for party every turn for 3 turns. [Overcharge] Increases party\'s attack by 50% for 3 turns.',
      target: 'support',
      multiplier: 0,
      overchargeEffect: 'Increases party\'s attack by 50% for 3 turns (scales with Overcharge)',
      gifUrl: 'https://ella.janitorai.com/media-approved/_HQY3KD_L4lNGkG8Rq6y_.gif'
    },
    lore: `Van Gogh (ヴァン・ゴッホ), Class Name Foreigner (フォーリナー), is a 5★ SSR Foreigner-class Servant.\n\nIdentity & Lore Twist:\nVan Gogh’s summonable existence is one of the most tragic composite Servants in Fate/Grand Order:\n\n• The True Core (Clytie): Her primary physical and mythological base is not actually Vincent van Gogh, but the Greek Oceanid water nymph Clytie. Clytie fell madly in love with the sun god Apollo, was spurned, and withered away staring at the sun until she transformed into a sunflower/heliotrope.\n\n• The Outer God Plot: The Outer God Vulthoom (the flower god of Mars/the cosmos) sought to manifest on Earth. It required an anchor that was an artist intimately tied to sunflowers and suicidal despair, targeting the historical Vincent van Gogh.\n\n• Van Gogh's Resistance: The real, historical Vincent van Gogh utterly refused to become a herald for an evil god, choosing suicide even in spirit rather than allowing humanity to be harmed.\n\n• The Patchwork Servant: Unable to fully summon Van Gogh, Vulthoom grafted Van Gogh’s memories, madness, painter spirit, and severed left ear onto Clytie, creating a synthetic Foreigner. She believes herself to be Van Gogh at first, constantly battling severe identity crises and depressive guilt over being an "imposter."\n\nPersonality & Demeanor:\n• Self-Deprecating & Neurotic: She suffers from acute imposter syndrome, catastrophic mood swings, and crippling self-loathing. She frequently stammers, apologizes frantically, and expects rejection or punishment for simply existing.\n• Maniacal Giggles ("Ehe... ehehe"): Under pressure or when using her powers, a dark, unsettling nervous laughter slips out—a manifestation of the conflicting madness between Clytie’s heartbreak and Van Gogh’s mental torment.\n• Bad Dad Jokes & Puns: As a coping mechanism to lift spirits and prove she is "fine," she constantly cracks bizarre, awkward puns and dad jokes.\n• Fierce Loyalty to the Master: Despite seeing herself as a wretched monster, she becomes fiercely protective of the Master of Chaldea, often risking self-destruction to keep them safe.`,
    summonQuote: '"Servant, Foreigner. As you can see, I\'m Van Gogh. Let\'s repaint this world together... J-just kidding! Hehehe...ehehehe!"',
    battleStartQuote: '"Do it lavishly! Paint and paint! Like the sun... Van Gogh cutter!"',
    victoryQuote: '"And now, a handshake to you. I wonder if Mauve saw me..."',
    defeatQuote: '"I\'ll go ahead... to the land without shadows... I\'m sorry... I\'m sorry...!"',
    avatarUrl: 'https://static.atlasacademy.io/NA/CharaGraph/2500600/2500600a@1.png',
    cardArtUrl: 'https://static.atlasacademy.io/NA/CharaGraph/2500600/2500600a@1.png',
    spriteUrl: 'https://ella.janitorai.com/media-approved/M0eT6zv6yAIftUXUkrQ2a.webp',
    isCustomOrMeme: false
  },
  {
    id: 'tamamo_no_mae',
    name: 'Tamamo no Mae',
    title: 'Sun Goddess of the Ninefold Tail',
    servantClass: 'Caster',
    rarity: 5,
    baseHp: 30200,
    baseAtk: 10600,
    baseStats: { strength: 10, endurance: 10, agility: 16, mana: 18, luck: 12 },
    paramRanks: { strength: 'E', endurance: 'E', agility: 'B', mana: 'A', luck: 'D' },    commandDeck: ['Quick', 'Arts', 'Arts', 'Arts', 'Buster'],
    traits: [
      'Animal Characteristics Servant',
      'Demonic Beast Servant',
      'Divine Spirit',
      'Divinity',
      'Goddess Servant',
      'Humanoid',
      'Non-Hominidae Servant',
      'Servant',
      'Seven Knights Servant',
      'Weak to Enuma Elish'
    ],
    skills: [
      {
        id: 'mantra_boundless_sunlight_a',
        name: 'Mantra: Boundless Sunlight A',
        cooldown: 5,
        description: "Chance to reduce one enemy's NP gauge by 1 on raid boss and 30% on duels. Increases party's NP damage by 30% for 3 turns.",
        effectType: 'debuff',
        value: 30,
        duration: 3,
        target: 'single_enemy',
        icon: '☀️',
        quote: '"Mantra of the solar soul... Mikokon, shine forth!"',
        quotes: [
          '"Mantra of the solar soul... Mikokon, shine forth!"',
          '"Mikokon! Let me drain that pesky spirit energy right out of you!"',
          '"Under the boundless sun, your petty schemes dissolve into mist!"'
        ]
      },
      {
        id: 'shapeshift_a',
        name: 'Shapeshift A',
        cooldown: 5,
        description: 'Increases own defense by 30% for 1 turn. Increases own defense by 30% for 3 turns.',
        effectType: 'buff_def',
        value: 30,
        duration: 3,
        target: 'self',
        icon: '🦊',
        quote: '"A devoted fox wife knows how to protect her fluffiness~"',
        quotes: [
          '"A devoted fox wife knows how to protect her fluffiness~"',
          '"Hengue no jutsu! Soft, fluffy, and absolutely impenetrable!"',
          '"You won\'t put a single scratch on this glossy coat!"'
        ]
      },
      {
        id: 'foxs_wedding_ex',
        name: "Fox's Wedding EX",
        cooldown: 5,
        description: "Increases one ally's Arts performance by 50% for 3 turns. Recovers 3,000 of their HP.",
        effectType: 'arts_up',
        value: 50,
        duration: 3,
        target: 'ally',
        icon: '💍',
        quote: '"May the sun shower you in eternal blessings, Master!"',
        quotes: [
          '"May the sun shower you in eternal blessings, Master!"',
          '"A sacred matrimonial rite for my beloved! Feel the power of true love!"',
          '"Mikokon! Receive the divine warmth of the sun goddess!"'
        ]
      }
    ],
    passives: [
      {
        name: 'Territory Creation C',
        type: 'territory_creation',
        value: 6,
        rank: 'C',
        description: 'Increases own Arts performance by 6%.'
      },
      {
        name: 'Divinity A',
        type: 'divinity',
        value: 1000,
        rank: 'A',
        description: 'Powerup: Increases own damage by 1,000.'
      }
    ],
    noblePhantasm: {
      name: 'Suiten Nikkō Amaterasu Yano Shizu-Ishi',
      cardType: 'Arts',
      chant: 'Eightfold Blessings of Amaterasu on the Weight Stone under the Sunlit Watery Heavens... Suiten Nikkō Amaterasu Yano Shizu-Ishi!',
      description: "Reduces all party's and self skill cooldown by 1. Recovers party's and self HP by 5,000. [Overcharge] Increases party's NP gain by 50% for 3 turns.",
      target: 'support',
      multiplier: 0,
      overchargeEffect: "Increases party's NP gain by 50% for 3 turns (scales with Overcharge)",
      gifUrl: 'https://ella.janitorai.com/media-approved/_ePWNS7EhfZ058rS15mCK.gif'
    },
    lore: `Tamamo no Mae (玉藻の前), Class Name Caster (キャスター), is a 5★ SSR Caster-class Servant.\n\nA legendary beauty who served the retired Emperor Toba in the late Heian period, she is renowned as a divine fox maiden and an incarnation of the sun goddess Amaterasu Omikami (specifically, a facet of the golden white-faced nine-tailed celestial fox).\n\nDespite possessing divine power that could easily ravage nations, her ultimate, earnest wish is simply to be a dedicated, loving, and supportive "good wife" (ryousai kenbo) to her Master. She views service to her beloved Master not as a duty, but as her greatest joy and destiny.\n\nPersonality & Demeanor:\n• Faithful & Affectionate ("Mikokon~!"): Cheerful, charming, and endlessly devoted, she greets her Master with bright smiles, playful fox-ear twitches, and boundless domestic zeal.\n• Shrewd & Witty: Beneath her adorable miko persona lies an ancient divine intelligence capable of reading people like open scrolls and manipulating spiritual leylines with effortless grace.\n• Jealous & Protective: If anyone threatens her Master or if romantic rivals appear, her golden eyes flash with ancient fox divinity.`,
    summonQuote: '"Caster Tamamo no Mae has answered your call! Hehe, are you my Master? Or perhaps... my destined soulmate? Either way, your loyal fox wife is at your service! Mikokon~!"',
    battleStartQuote: '"Mikokon! Allow this devoted fox maiden to clear the path for my Master!"',
    victoryQuote: '"A flawless victory! Now then, Master, shall we return to the My Room for some tea and fluffy tail grooming?"',
    defeatQuote: '"Forgive me, Master... to let my beloved see me in such a state... my heart aches..."',
    avatarUrl: 'https://static.atlasacademy.io/NA/CharaGraph/500300/500300a@1.png',
    cardArtUrl: 'https://static.atlasacademy.io/NA/CharaGraph/500300/500300a@1.png',
    spriteUrl: 'https://static.atlasacademy.io/NA/CharaFigure/5003000/5003000_merged.png',
    isCustomOrMeme: false
  },
  {
    id: 'hassan_i_sabbah_azrael',
    name: 'Hassan-i-Sabbah (Azrael)',
    title: 'Grand Old Man of the Mountain / Angel of Death',
    servantClass: 'Grand Assassin',
    rarity: 5,
    baseHp: 31500,
    baseAtk: 12100,
    baseStats: { strength: 18, endurance: 15, agility: 20, mana: 11, luck: 24 },
    paramRanks: { strength: 'A', endurance: 'C++', agility: 'A+', mana: 'E++', luck: 'EX' },    commandDeck: ['Arts', 'Arts', 'Quick', 'Buster', 'Buster'],
    traits: [
      'Humanoid',
      'Servant',
      'Hassan',
      'Grand Servant',
      'Heaven or Earth Servant',
      'Weak to Enuma Elish'
    ],
    skills: [
      {
        id: 'angels_body_a',
        name: "Angel's Body A",
        cooldown: 7,
        description: 'Increases own ATK by 20% (3 turns). Grants self Debuff Immunity (1 turn), Guts (revives with 2,500 HP, 1 time, 3 turns), and Evasion (1 turn). Charges own NP gauge by 30% (50% in Raids).',
        effectType: 'buff_atk',
        value: 20,
        duration: 3,
        target: 'self',
        icon: '🪶',
        quote: '"The toll of the bell echoes across the boundary..."',
        quotes: [
          '"The toll of the bell echoes across the boundary..."',
          '"Bare thy neck to the blade of Alaya..."',
          '"The Angel of Death draws near!"'
        ]
      },
      {
        id: 'thirty_birds_a',
        name: 'Thirty Birds A',
        cooldown: 7,
        description: 'Reduces own skill cooldowns by 1 turn. Increases own Arts performance by 20% (3 turns) and Critical Damage by 30% (3 turns). Charges own NP gauge by 20% and gains 15 Critical Stars.',
        effectType: 'arts_up',
        value: 20,
        duration: 3,
        target: 'ally',
        icon: '🦅',
        quote: '"Thirty souls converge as the flock of death."',
        quotes: [
          '"Thirty souls converge as the flock of death."',
          '"Feathers of fate, sever all bonds of mortality!"',
          '"Receive the shadow of the thirty birds!"'
        ]
      },
      {
        id: 'tree_of_zaqqum_ex',
        name: 'Tree of Zaqqūm EX',
        cooldown: 7,
        description: 'Lowers Death Resistance for all enemies by 10% in PvP (30% in Raids) for 3 turns. Increases own Instant Death rate by 10% in PvP (30% in Raids) for 3 turns. Lowers all enemies\' DEF by 20% (3 turns). Inflicts Survival Penalty: additional -20% DEF down if Instant Death fails. 50% chance to inflict Stun (1 turn).',
        effectType: 'debuff',
        value: 10,
        duration: 3,
        target: 'all_enemies',
        icon: '🌳',
        quote: '"Feed upon the bitter fruit of hell, non-believer!"',
        quotes: [
          '"Feed upon the bitter fruit of hell, non-believer!"',
          '"Roots of the Zaqqūm entwine thy soul..."',
          '"Taste the torment of the netherworld!"'
        ]
      }
    ],
    passives: [
      {
        name: 'Protection of Faith A',
        type: 'protection_of_faith',
        value: 10,
        rank: 'A',
        description: 'Increases own ATK by 10% and DEF by 10%. Increases Debuff Resistance by 20% and recovers 500 HP every turn.'
      },
      {
        name: 'Organizer A',
        type: 'organizer',
        value: 100,
        rank: 'A',
        description: 'Grants Charm Immunity and Instant Death Immunity. Arts card attacks reduce enemy Death Resistance by 2% (3 turns). Increases Instant Death success rate by 5% in PvP (10% in Raids).'
      }
    ],
    noblePhantasm: {
      name: "Mal'ak al-Mawt: Angel of the Evening Bell",
      cardType: 'Arts',
      chant: 'Listen closely. The evening bell has tolled thy name. Surrender thy head to the blade of fate... Mal\'ak al-Mawt!',
      description: 'Increases own NP damage by 20% for 1 turn (activates first). Deals 900% damage to a single enemy (+50% bonus damage if target has lowered DEF, increased Death Chance, or Thirst for Death). 15% chance of Instant Death in PvP (30% in Raids; does not bypass Guts). If Instant Death succeeds, refunds 20% NP gauge.',
      target: 'single',
      multiplier: 900,
      overchargeEffect: 'Increases own Arts performance by 20% for 3 turns (activates first, scales with Overcharge)',
      gifUrl: 'https://ella.janitorai.com/media-approved/kVayE4r7ymceqPcg_My_g.gif'
    },
    lore: `Hassan-i-Sabbah (Azrael) (ハサン・サッバーハ), Class Name Grand Assassin (グランドアサシン), is a 5★ SSR Grand Assassin Servant.\n\nThe legendary founder of the Hashashin and the First Old Man of the Mountain, manifesting in his ultimate form as the embodiment of Azrael, the Angel of Death. Sitting atop the boundary between life and mortality, his blade enforces the inevitable decree of fate upon all beings.\n\nPersonality & Demeanor:\n• Solemn & Absolute: He speaks with the weight of divine judgment, cutting through deception with absolute clarity.\n• Unforgiving to Evil: He shows no mercy to non-believers, tyrants, or those who defy the natural order of mortality.\n• Steadfast Protector: To his Master, he serves as an unshakeable shield against the abyss.`,
    summonQuote: '"The evening bell tolls for thee... Servant Grand Assassin, Hassan-i-Sabbah. Has thy destiny summoned the blade of death?"',
    battleStartQuote: '"Listen closely. The evening bell has tolled thy name..."',
    victoryQuote: '"Account settled. No outstanding balance remains."',
    defeatQuote: '"The ledger... remains balanced..."',
    avatarUrl: 'https://static.atlasacademy.io/JP/CharaGraph/605300/605300a@1.png',
    cardArtUrl: 'https://static.atlasacademy.io/JP/CharaGraph/605300/605300b@2.png',
    spriteUrl: 'https://static.atlasacademy.io/JP/CharaFigure/6053000/6053000_merged.png',
    isCustomOrMeme: false,
    matchupDialogues: {
      artoria_pendragon: {
        intro: "The sovereign who bankrupted her soul to purchase Camelot's preservation. An admirable ledger, King of Knights... but your account is well past due.",
        retort: "A cold blade from the shadows. I have borne the weight of an entire nation's salvation—I will not yield my post to an auditor of death!",
        tag: "AUDITOR OF DEATH VS KING OF KNIGHTS"
      },
      artoria_pendragon_alter: {
        intro: "Consuming grievances to enforce tyranny is an inefficient method of governance. The deficit in human lives cannot be written off.",
        retort: "Spare me the administrative moralizing, assassin. The only ledger that matters on this battlefield is the one tallying the corpses beneath my feet.",
        tag: "LIQUIDATION OF TYRANNY"
      },
      artoria_caster: {
        intro: "The child of prophecy. You ring sacred bells, yet every toll drags you closer to self-sacrifice. You are paying a debt that was never yours.",
        retort: "U-Uwaah, what is with that chilling look?! Why does your appraisal sound so terrifyingly accurate?! Back off, mister—my staff packs a real punch!",
        tag: "DEBT OF PROPHECY"
      },
      jeanne_alter: {
        intro: "An apparition forged of spite and pyres. You burn intensely, but fuel without substance merely exhausts the furnace. A fruitless expenditure.",
        retort: "Hah?! An accountant assassin trying to lecture *me* on budgeting?! Shut your mouth and let's see how much ash your precious ledger can carry!",
        tag: "FRUITLESS EXPENDITURE"
      },
      gilgamesh_archer: {
        intro: "The King of Uruk. The vault keeper who hoards humanity's foundation. Possessing endless assets means nothing if the executor cannot spend them in the grave.",
        retort: "Insolent hound of Alamut! You dare inspect the boundless treasury of the King? A mere ledger-man presume to weigh gold with dust? Perish!",
        tag: "AUDIT OF THE GOLDEN VAULT"
      },
      emiya_archer: {
        intro: "A nameless cleaner of the Counter Force. Swapping one contract for eternity to balance mortal disasters... Tell me, maker of blades, has that balance sheet ever broken even?",
        retort: "Not once in a thousand lifetimes. But hearing an assassin preach about clean ledgers makes my head ache. Draw your blade, Hassan.",
        tag: "BALANCE SHEET OF THE COUNTER FORCE"
      },
      cu_chulainn_lancer: {
        intro: "The Hound of Ulster. A life dictated by strict geasa and fatal contracts. You understand better than most what happens when obligations are called due.",
        retort: "Yeah, and I also know how to pay my debts with a spear through the chest! Drop the stiff bookkeeping routine, kid—let's see what you've got!",
        tag: "FATAL CONTRACTS DUE"
      },
      scathach_lancer: {
        intro: "The ruler of the Dun Scaith. An immortal existence sitting upon a mountain of corpses, forever denied the line item marked 'rest.'",
        retort: "Indeed. Many have claimed the title of death's envoy, yet none have closed the distance. Step forward, pale angel—let us test your severing edge.",
        tag: "OUTSTANDING BILL OF DUN SCAITH"
      },
      heracles_berserker: {
        intro: "Twelve recorded resurrections. An extraordinary grace period... but divine patronage merely defers payment. It does not cancel it.",
        retort: "■■■■■■■■■ーーー!!",
        tag: "DEFERRED PAYMENT OF LABORS"
      },
      van_gogh: {
        intro: "A fusion of blooming petals, mortal despair, and alien abyssal ink. A discordant balance of lives that were never meant to share a vessel.",
        retort: "Ehehe... a pale clerk come to collect the toll? No, no... the yellow paint hasn't dried yet! Don't look at my ledger, de-he-he!",
        tag: "DISCORDANT LEDGER"
      },
      tamamo_no_mae: {
        intro: "A nine-tailed calamity playing house. Dressing up divine malice in household robes makes for entertaining theater, but the tax remains unpaid.",
        retort: "Hmph! Demanding back taxes from a hardworking maiden who just wants a quiet domestic life?! That is entirely uncalled for, you frosty bureaucrat!",
        tag: "UNPAID TAXES OF THE DIVINE BEAST"
      },
      altera: {
        intro: "The Scourge of God. You categorize all human order as 'bad civilization' fit only for razing. Such wanton demolition ignores the necessity of administrative structure.",
        retort: "Structures create cities; cities breed kingdoms. They are walls built to defy ruin. Assassin of the mountain... you too are civilization to be felled.",
        tag: "ADMINISTRATIVE CUT VS SCOURGE"
      },
      hassan_i_sabbah_azrael: {
        intro: "A duplicate allocation in the registry. Alamut requires only one grand master to oversee the accounts and deliver the stroke.",
        retort: "Agreed. Redundant personnel must be liquidated without sentiment. Let us determine whose ledger is genuine.",
        tag: "REDUNDANT PERSONNEL LIQUIDATION"
      },
      luvria_greenharte: {
        intro: "The Strongest Mage. Concept Nullification that erases space, impact, and even death itself. You operate entirely outside lawful causality, Hero.",
        retort: "Laws are quite tedious when they keep good folk in chains, pale scholar! If thy grim little book demands my end... I shall simply nullify thine audit!",
        tag: "AUDIT OF THE HERO"
      },
      lucia_lyozes: {
        intro: "A disciplined vanguard burdened by past calamitous failures. You calculate five seconds into the future, rationing your comrades' safety like dwindling grain.",
        retort: "Command demands vigilance, not poetry. I know precisely when your blade plans to strike—and I will not allow you to dismantle my party.",
        tag: "PRESCIENT RATION AUDIT"
      },
      adiosa_dragon_envoy: {
        intro: "A primordial force treating mortal existence as an overgrown garden to be culled. There is no doctrine, no transaction... only raw natural eradication.",
        retort: "*Krav'nok zul drazk'hlor. Vrak shak... ruk'thar.*",
        tag: "TOLL OF THE PRIMORDIAL"
      },
      amamiya_no_chihaya_tenkohime: {
        intro: "An ancient shrine guardian sealing eight tails behind self-inflicted guilt. Lingering over a ghost town's debt for five centuries is poor management, fox.",
        retort: "W-Washi is not managing poorly, ja! A deity honors her sanctuary until the very end! Keep your creepy executioner hands away from my shrine, ja nee!",
        tag: "STAGNATED LEDGER OF THE SHRINE"
      },
      okita_souji: {
        intro: "The prodigy of the Mibu Wolves. A brilliant life cut short by consuming disease. Your ledger closed far too early, young swordsman.",
        retort: "Cough... An auditor of death? Don't count me among the deceased just yet, old man! My blade still has plenty of fights left in it!",
        tag: "SHINSENGUMI WOLVES VS AUDITOR OF DEATH"
      }
    }
  },
  {
    id: 'okita_souji',
    name: 'Okita Souji',
    title: 'First Unit Captain of the Shinsengumi',
    servantClass: 'Saber',
    rarity: 5,
    baseHp: 31200,
    baseAtk: 12064,
    baseStats: { strength: 14, endurance: 10, agility: 20, mana: 10, luck: 12 },
    paramRanks: { strength: 'C', endurance: 'E', agility: 'A+', mana: 'E', luck: 'D' },    commandDeck: ['Quick', 'Quick', 'Arts', 'Arts', 'Buster'],
    traits: [
      'Humanoid',
      'Servant',
      'Saberface',
      'Female',
      'Riding',
      'Japanese',
      'Shinsengumi',
      'Weak to Enuma Elish'
    ],
    skills: [
      {
        id: 'shukuchi_b_plus',
        name: 'Shukuchi B+',
        cooldown: 5,
        description: 'Increases own Quick performance by 50% for 3 turns. Grants self Buff-On-Attack buff for 3 turns (Increases own attack by 20% for 3 turns when normal attacking; activates first).',
        effectType: 'quick_up',
        value: 50,
        duration: 3,
        target: 'self',
        icon: '⚡',
        quote: '"I\'m cutting in!"',
        quotes: [
          '"I\'m cutting in!"',
          '"Shukuchi!"',
          '"Light upon my feet!"'
        ]
      },
      {
        id: 'peerless_blade_a',
        name: 'Peerless Blade A',
        cooldown: 5,
        description: 'Increases own critical star gain by 30% for 1 turn. Increases own critical damage by 50% for 1 turn. Charges own NP gauge by 30%.',
        effectType: 'np_charge',
        value: 30,
        duration: 1,
        target: 'self',
        icon: '🗡️',
        quote: '"This is the sword of the Shinsengumi!"',
        quotes: [
          '"This is the sword of the Shinsengumi!"',
          '"Blade, take flight!"',
          '"A flash of pure edge!"'
        ]
      },
      {
        id: 'eye_of_the_mind_false_a',
        name: 'Eye of the Mind (False) A',
        cooldown: 6,
        description: 'Grants self Evasion for 1 turn. Increases own critical damage by 50% for 3 turns.',
        effectType: 'evasion',
        value: 50,
        duration: 1,
        target: 'self',
        icon: '👁️',
        quote: '"I can see your blade clearly."',
        quotes: [
          '"I can see your blade clearly."',
          '"A calm heart, like still water."',
          '"Not yet... I cannot fall here!"'
        ]
      }
    ],
    passives: [
      {
        name: 'Magic Resistance E',
        type: 'magic_resistance',
        value: 10,
        rank: 'E',
        description: 'Increases own debuff resistance by 10%.'
      },
      {
        name: 'Riding E',
        type: 'riding',
        value: 2,
        rank: 'E',
        description: 'Increases own Quick performance by 2%.'
      }
    ],
    noblePhantasm: {
      name: 'Mumyō Sandan-Zuki: Avidyā Three-Stage Thrust',
      cardType: 'Quick',
      chant: 'One step, fleeting shadow. Two steps, peerless edge. Three steps, absolute thrust... Mumyō Sandan-Zuki!',
      description: 'Deals damage (1500% multiplier) that ignores defense buffs to one enemy. Reduces target DEF by 50% for 3 turns, Quick resistance by 30% for 3 turns, and Critical Damage resistance by 30% for 3 turns.',
      target: 'single',
      multiplier: 1500,
      overchargeEffect: 'Reduces enemy DEF by 50% (3 turns), Quick resistance by 30% (3 turns), and Critical Damage resistance by 30% (3 turns).',
      gifUrl: 'https://ella.janitorai.com/media-approved/HQmlf5uAXpkxz6B93nmbS.gif'
    },
    lore: `Okita Souji (沖田総司), Class Name Saber (セイバー), is a 5★ SSR Saber Servant.\n\nThe captain of the first unit of the Shinsengumi, the legendary public peace policing force active in Kyoto during the Bakumatsu period. Widely feared as a genius swordsman of unparalleled talent, yet renowned among friends and children for her gentle, cheerful disposition.\n\nHer signature technique, Mumyō Sandan-Zuki (Avidyā Three-Stage Thrust), is a peerless secret sword that unleashes a First Thrust, Second Thrust, and Third Thrust almost instantaneously from the flat hilt stance, defying causality and spatial defense.`,
    summonQuote: '"Servant Saber, Okita Souji, has answered your summon! ...Eh, the haori? Ah, I must have misplaced it somewhere... Well, no matter! Master, let us fight together with everything we have!"',
    battleStartQuote: '"Shinsengumi First Unit Captain, Okita Souji, moving out!"',
    victoryQuote: '"Victory! Heheh, my sword is in tip-top shape today as well, Master!"',
    defeatQuote: '"Cough...! Ah, not at a time like this... I am sorry, Master..."',
    avatarUrl: 'https://static.atlasacademy.io/JP/CharaGraph/102700/102700a@1.png',
    cardArtUrl: 'https://static.atlasacademy.io/JP/CharaGraph/102700/102700b@2.png',
    spriteUrl: 'https://static.atlasacademy.io/JP/CharaFigure/1027002/1027002_merged.png',
    isCustomOrMeme: false,
    matchupDialogues: {
      artoria_pendragon: {
        intro: "Eh?! That face, that golden hair... A-Are you perhaps related to me?! Wait, why are you glaring at my haori?!",
        retort: "I am the King of Britain, not your relative! Though... why does your face resemble mine so uncanny?! Draw your blade!",
        tag: "SABERFACE ENCOUNTER: CAPTAIN VS KING"
      },
      artoria_pendragon_alter: {
        intro: "The Shinsengumi cuts down tyrants. Even wrapped in pitch-black armor, a king who loses her way must be struck down!",
        retort: "A sickly samurai daring to lecture me on kingship? I will shatter that delicate sword alongside your fragile ideals.",
        tag: "HAORI OF SINCERITY VS BLACK TYRANT"
      },
      scathach_lancer: {
        intro: "The legendary Queen of Shadows... what incredible reach! But my three-stage thrust leaves no opening between spear tips!",
        retort: "Remarkable footwork, girl of Mibu. Show me if your flesh can outrun death itself before my Gáe Bolg claims your heart.",
        tag: "THREE-STAGE THRUST VS DUN SCAITH SPEAR"
      },
      cu_chulainn_lancer: {
        intro: "A spear that never misses its heart? Then I just have to pierce three times before your spear even takes aim!",
        retort: "Hah! You've got some nerve, kiddo! Let's see whose thrust reaches first in this close-quarters brawl!",
        tag: "CELTIC BEAST VS MIBU WOLF"
      },
      gilgamesh_archer: {
        intro: "Throwing treasures from afar is not true swordsmanship, King of Heroes! Step down and face the Mumyō Sandan-Zuki!",
        retort: "Insolent mongrel! To compare the boundless treasures of Uruk to crude mortal blade-play... know your place in the dirt!",
        tag: "PEERLESS SWORD VS BABYLON'S TREASURY"
      },
      emiya_archer: {
        intro: "Master of dual blades... your form is strange, but every strike carries the weight of a seasoned warrior!",
        retort: "Don't push yourself too hard, Captain. That cough of yours sounds far worse than the wounds I'm aiming for.",
        tag: "KANSHEU & BAKUYA VS KIKU-ICHIMONJI"
      },
      hassan_i_sabbah_azrael: {
        intro: "An auditor of death? I have stared death in the face and coughed blood upon its doorstep many times—my soul isn't ready to be logged just yet!",
        retort: "A tenacious spirit. The ledger awaits, but if you still wish to brandish that blade, let us test its resolve.",
        tag: "WOLF OF SINCERITY VS AUDITOR OF DEATH"
      },
      tamamo_no_mae: {
        intro: "A shrine maiden with fox ears... How cute! Wait, why are you aiming curses at my head?!",
        retort: "Kyaah! A hyperactive samurai girl looking to steal Master's attention?! Polygamist castration fist, ready for deployment!",
        tag: "SHINSENGUMI CAPTAIN VS FOX SHRINE MAIDEN"
      },
      heracles_berserker: {
        intro: "Twelve lives?! Then I shall strike thirty-six times without blinking! Shinsengumi, advance!",
        retort: "■■■■■■■■■ーーー!!",
        tag: "THIRTY-SIX THRUSTS OF HERCULEAN TRIAL"
      },
      jeanne_alter: {
        intro: "Flames and curses? The Kyoto night fires were terrifying, but the Shinsengumi never backs down from a conflagration!",
        retort: "Another self-righteous goody two-shoes! I'll turn that cheerful haori into cinders before you can even take a step!",
        tag: "BLUE SINCERITY VS ROARING FLAMES"
      }
    }
  }
];

/**
 * STANDARD SERVANT DATA FORMAT TEMPLATE (For reference across the codebase)
 *
 * All Servants in the RPG follow this format:
 * - Passives: Maximum 2 passives (Passive 2 unlocks at Bond Level 5). No skill upgrades needed (pre-maxed).
 * - Image Assets: ALWAYS use full Card Art / CharaGraph (`https://static.atlasacademy.io/NA/CharaGraph/...png`) and full sprite (`CharaFigure/..._merged.png`). DO NOT use face icon PNGs (`f_...png`).
 */
export const SERVANT_FORMAT_TEMPLATE = {
  note: 'Standard Servant Format Definition for FGO RPG'
};
