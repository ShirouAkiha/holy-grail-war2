import { ActiveCombatant, ServantClass } from '../types';

export type DialogueScenario =
  | 'NP_RELEASE'
  | 'BUSTER_CHAIN'
  | 'CRITICAL_STRIKE'
  | 'LOW_HP_CLUTCH'
  | 'CLASS_ADVANTAGE'
  | 'STANDARD_ATTACK'
  | 'VICTORY';

export interface MidBattleDialogue {
  speakerName: string;
  speakerClass?: ServantClass | string;
  speakerAvatarUrl?: string;
  scenario: DialogueScenario;
  scenarioTitle: string;
  quote: string;
  level?: number;
}

const SERVANT_SPECIAL_QUOTES: Record<string, Partial<Record<DialogueScenario, string[]>>> = {
  artoria: {
    NP_RELEASE: [
      'Gather, breath of the planet! Sword of Promised Victory — EXCALIBUR!',
      'Light of holy hope, pierce the darkness! EXCALIBUR!'
    ],
    BUSTER_CHAIN: [
      'With the pride of the Knights of the Round, I shall break your defense!',
      'Holy blade, strike down the enemy of Britain!'
    ],
    CRITICAL_STRIKE: [
      'This strike shall pave the path to absolute victory!',
      'I have spotted an opening in your stance!'
    ],
    CLASS_ADVANTAGE: [
      'My holy blade holds absolute advantage against your line!',
      'The dragon\'s mana overwhelms your class affinity!'
    ],
    LOW_HP_CLUTCH: [
      'As long as my oath remains unbroken, I will not fall!',
      'For the sake of my Master and my vow, I stand firm!'
    ],
    STANDARD_ATTACK: [
      'Servant Saber, engaging the enemy!',
      'Prepare yourself, warrior of the Grail!'
    ]
  },
  artoria_alter: {
    NP_RELEASE: [
      'Hammer of the Vile King... Overturn the aurora! Excalibur Morgan!',
      'Black mana unleash! Consume everything in darkness, Excalibur Morgan!'
    ],
    BUSTER_CHAIN: [
      'Know your place, worm. Fall before the tyrant\'s blade!',
      'Useless struggling. I will crush your spirit!'
    ],
    CRITICAL_STRIKE: [
      'Pathetic defense. Be torn asunder!',
      'The Dark Dragon\'s claws reach for your throat!'
    ],
    LOW_HP_CLUTCH: [
      'Do not mock me! Such minor wounds mean nothing to the Tyrant King!',
      'I shall burn my dark mana to the last ember!'
    ],
    STANDARD_ATTACK: [
      'Grovel before my shadow!',
      'Darkness, grant me strength!'
    ]
  },
  gilgamesh: {
    NP_RELEASE: [
      'I shall offer you this final judgment! Enuma Elish!',
      'Know the origin of creation! ENUMA ELISH!'
    ],
    BUSTER_CHAIN: [
      'Fool! Witness the limitless treasury of Babylon!',
      'Rejoice, mongrel! You are granted the honor of being slain by my treasures!'
    ],
    CRITICAL_STRIKE: [
      'Bask in my divine glory and perish!',
      'A mongrel like you dares defy the King of Heroes?'
    ],
    CLASS_ADVANTAGE: [
      'Archer superiority is absolute against your meager class!',
      'The King\'s vault contains weapons specifically designed to slay your kind!'
    ],
    LOW_HP_CLUTCH: [
      'Preposterous! A mere mongrel dares push the King of Heroes this far?!',
      'Impudence! I shall open the vault to its deepest vault!'
    ],
    STANDARD_ATTACK: [
      'Gates of Babylon, open!',
      'Gaze upon true royalty!'
    ]
  },
  jeanne: {
    NP_RELEASE: [
      'The Lord\'s banner protects us! Luminosité Eternelle!',
      'O Lord, grant us your holy protection! Luminosité Eternelle!'
    ],
    BUSTER_CHAIN: [
      'With holy faith, I advance for my Master!',
      'Let the divine flag inspire courage in our hearts!'
    ],
    CRITICAL_STRIKE: [
      'The Lord\'s guidance reveals the true path!',
      'Strike with purity and unwavering purpose!'
    ],
    LOW_HP_CLUTCH: [
      'Even in dire hardship, faith shall never waver!',
      'My flag will stand proud until the final moment!'
    ],
    STANDARD_ATTACK: [
      'Ruler class, standing in defense of order!',
      'Heaven\'s light, guide my lance!'
    ]
  },
  jalter: {
    NP_RELEASE: [
      'Roar, my rage! La Grondement du Haine!',
      'Burn them all to ash! LA GRONDEMENT DU HAINE!'
    ],
    BUSTER_CHAIN: [
      'Hahahahaha! Burn! Turn to cinders and smoke!',
      'Incinerate! Leave not even bone behind!'
    ],
    CRITICAL_STRIKE: [
      'Your despair is the sweetest flame!',
      'Ahahah! Feel the agonizing heat of my hatred!'
    ],
    LOW_HP_CLUTCH: [
      'Tch! Is that the best you\'ve got? My hatred burns hotter than death itself!',
      'I won\'t disappear until I\'ve dragged you into hell with me!'
    ],
    STANDARD_ATTACK: [
      'Avenger of Orleans, engaging!',
      'Black flames, consume them!'
    ]
  },
  scathach: {
    NP_RELEASE: [
      'Spear of Piercing Death... Gáe Bolg Alternative!',
      'Step into the Land of Shadows! Gáe Bolg Alternative!'
    ],
    BUSTER_CHAIN: [
      'Your posture is full of openings. Let me instruct you on true combat!',
      'Dual rune spears, pierce through flesh and soul!'
    ],
    CRITICAL_STRIKE: [
      'Flawless precision! A textbook fatal blow!',
      'A warrior of Dun Scáith does not miss!'
    ],
    LOW_HP_CLUTCH: [
      'Splendid... To push me to this brink... Come, warrior, show me more!',
      'Ah... the thrill of a battle that could end my immortality!'
    ],
    STANDARD_ATTACK: [
      'Lancer of Dun Scáith, taking the vanguard!',
      'Master the spear, or die upon it!'
    ]
  },
  mhxa: {
    NP_RELEASE: [
      'Dark Matter reactor at 100%! Cross Calibur!',
      'Black Hole Slash! Cross Calibur!'
    ],
    BUSTER_CHAIN: [
      'Sugar overload activated! Twin Dark Sabers unleash!',
      'Sweets energy maxed out! Deleting target!'
    ],
    CRITICAL_STRIKE: [
      'Critical sweet spot acquired!',
      'High calorie precision strike!'
    ],
    LOW_HP_CLUTCH: [
      'Core temperature rising... Need... sweet red bean paste...',
      'Emergency reserves active! I won\'t forfeit my tea break!'
    ],
    STANDARD_ATTACK: [
      'Berserker MHXA, entering combat mode.',
      'Calorie depletion detected... engaging enemy.'
    ]
  }
};

const GENERIC_CLASS_QUOTES: Record<string, Partial<Record<DialogueScenario, string[]>>> = {
  SABER: {
    NP_RELEASE: ['Noble sword, shine forth and strike down my enemy!'],
    BUSTER_CHAIN: ['Saber\'s steel shall sever all resistance!'],
    CRITICAL_STRIKE: ['A decisive blow with the edge of my blade!'],
    CLASS_ADVANTAGE: ['My knightly blade holds absolute advantage over your class!'],
    LOW_HP_CLUTCH: ['My knightly honor prohibits me from retreating!'],
    STANDARD_ATTACK: ['Blade drawn, striking with full force!']
  },
  ARCHER: {
    NP_RELEASE: ['Target locked in sight! Rain down from the heavens!'],
    BUSTER_CHAIN: ['A barrage of lethal arrows from afar!'],
    CRITICAL_STRIKE: ['Bullseye! Straight through the vital point!'],
    CLASS_ADVANTAGE: ['You cannot escape an Archer\'s superior range!'],
    LOW_HP_CLUTCH: ['Even pinned down, my marksmanship remains true!'],
    STANDARD_ATTACK: ['Nocking arrow, drawing bowstring!']
  },
  LANCER: {
    NP_RELEASE: ['Spear of destiny, pierce through the enemy\'s heart!'],
    BUSTER_CHAIN: ['Relentless thrusts breaking through armor!'],
    CRITICAL_STRIKE: ['One swift strike to breach their defenses!'],
    CLASS_ADVANTAGE: ['My spear reaches far beyond your guard!'],
    LOW_HP_CLUTCH: ['Lancers never back down from a mortal duel!'],
    STANDARD_ATTACK: ['Spear tip aimed, charging forward!']
  },
  RIDER: {
    NP_RELEASE: ['Mount of legend, trample our foes into dust!'],
    BUSTER_CHAIN: ['Unstoppable momentum crushing everything in path!'],
    CRITICAL_STRIKE: ['A swift hit-and-run at maximum velocity!'],
    CLASS_ADVANTAGE: ['My high-speed assault completely outmaneuvers you!'],
    LOW_HP_CLUTCH: ['Full speed ahead! We push past our limits!'],
    STANDARD_ATTACK: ['Charge forward without hesitation!']
  },
  CASTER: {
    NP_RELEASE: ['High Thaumaturgy initialized! Chant of absolute mana!'],
    BUSTER_CHAIN: ['Elemental overload cascade unleashed!'],
    CRITICAL_STRIKE: ['Mana concentrated into a pinpoint destruction spell!'],
    CLASS_ADVANTAGE: ['My arcane knowledge completely counters your magic defenses!'],
    LOW_HP_CLUTCH: ['Drawing upon emergency mana reserves!'],
    STANDARD_ATTACK: ['Arcane incantation commencing!']
  },
  ASSASSIN: {
    NP_RELEASE: ['Silent death approaches... One hit, inevitable kill!'],
    BUSTER_CHAIN: ['Shadow strikes from every blind spot!'],
    CRITICAL_STRIKE: ['A lethal blow from the shadows!'],
    CLASS_ADVANTAGE: ['You never saw me coming. Class advantage exploited!'],
    LOW_HP_CLUTCH: ['Fading into mist... but my dagger still strikes true!'],
    STANDARD_ATTACK: ['Stepping quietly into position...']
  },
  BERSERKER: {
    NP_RELEASE: ['ROAAAAAR! DESTROY EVERYTHING!'],
    BUSTER_CHAIN: ['SMASH! CRUSH! RIP TO SHREDS!'],
    CRITICAL_STRIKE: ['UNSTOPPABLE BRUTE FORCE IMPACT!'],
    CLASS_ADVANTAGE: ['GRAAAA! NO ONE ESCAPES MY RAGE!'],
    LOW_HP_CLUTCH: ['PAIN ONLY MAKES ME STRONGER! GRAAAAH!'],
    STANDARD_ATTACK: ['WILD SAVAGE STRIKE!']
  }
};

function determineScenarioTitle(scenario: DialogueScenario): string {
  switch (scenario) {
    case 'NP_RELEASE':
      return '💥 NOBLE PHANTASM RELEASE CUT-IN';
    case 'BUSTER_CHAIN':
      return '🔥 TRIPLE BUSTER POWER CHAIN CUT-IN';
    case 'CRITICAL_STRIKE':
      return '⚡ ETHERIC CRITICAL STRIKE CUT-IN';
    case 'LOW_HP_CLUTCH':
      return '🩸 DESPERATE LAST-STAND CUT-IN';
    case 'CLASS_ADVANTAGE':
      return '🛡️ CLASS AFFINITY ADVANTAGE CUT-IN';
    case 'VICTORY':
      return '🏆 TRIUMPHANT VICTORY CUT-IN';
    case 'STANDARD_ATTACK':
    default:
      return '⚔️ MID-BATTLE COMBAT CUT-IN';
  }
}

export function generateBattleDialogue(
  combatant: ActiveCombatant,
  scenario: DialogueScenario = 'STANDARD_ATTACK',
  npChantOverride?: string,
  customQuoteOverride?: string
): MidBattleDialogue {
  const scenarioTitle = determineScenarioTitle(scenario);
  const servantId = combatant.id.toLowerCase();
  const servantName = combatant.name.toLowerCase();

  // 1. Check NP Chant
  if (scenario === 'NP_RELEASE' && npChantOverride && npChantOverride.trim().length > 0) {
    return {
      speakerName: combatant.name,
      speakerClass: combatant.servantClass,
      speakerAvatarUrl: combatant.avatarUrl,
      scenario,
      scenarioTitle,
      quote: npChantOverride,
      level: 90
    };
  }

  // 2. Check custom quote override
  if (customQuoteOverride && customQuoteOverride.trim().length > 0 && scenario !== 'NP_RELEASE') {
    return {
      speakerName: combatant.name,
      speakerClass: combatant.servantClass,
      speakerAvatarUrl: combatant.avatarUrl,
      scenario,
      scenarioTitle,
      quote: customQuoteOverride,
      level: 90
    };
  }

  // 3. Check special quotes for recognized servants using fuzzy key matching
  const matchedKey = Object.keys(SERVANT_SPECIAL_QUOTES).find(k => {
    const keyLower = k.toLowerCase();
    return servantId.includes(keyLower) || keyLower.includes(servantId) || servantName.includes(keyLower) || keyLower.includes(servantName);
  });

  if (matchedKey) {
    const servantQuotes = SERVANT_SPECIAL_QUOTES[matchedKey];
    const scenarioQuotes = servantQuotes[scenario] || servantQuotes['STANDARD_ATTACK'];
    if (scenarioQuotes && scenarioQuotes.length > 0) {
      const quote = scenarioQuotes[Math.floor(Math.random() * scenarioQuotes.length)];
      return {
        speakerName: combatant.name,
        speakerClass: combatant.servantClass,
        speakerAvatarUrl: combatant.avatarUrl,
        scenario,
        scenarioTitle,
        quote,
        level: 90
      };
    }
  }

  // 4. Fallback to Class Generic Quotes
  const servantClassUpper = (combatant.servantClass || 'SABER').toUpperCase();
  const classQuotes = GENERIC_CLASS_QUOTES[servantClassUpper] || GENERIC_CLASS_QUOTES['SABER'];
  const scenarioQuotes = classQuotes[scenario] || classQuotes['STANDARD_ATTACK'];
  if (scenarioQuotes && scenarioQuotes.length > 0) {
    const quote = scenarioQuotes[Math.floor(Math.random() * scenarioQuotes.length)];
    return {
      speakerName: combatant.name,
      speakerClass: combatant.servantClass,
      speakerAvatarUrl: combatant.avatarUrl,
      scenario,
      scenarioTitle,
      quote,
      level: 90
    };
  }

  // 5. Ultimate Fallback Quote
  return {
    speakerName: combatant.name,
    speakerClass: combatant.servantClass,
    speakerAvatarUrl: combatant.avatarUrl,
    scenario,
    scenarioTitle,
    quote: `${combatant.name} unleashes etheric energy on the battlefield!`,
    level: 90
  };
}
