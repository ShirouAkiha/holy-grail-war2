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
  gilgamesh_archer: {
    NP_RELEASE: [
      'I shall show you the origin of all treasures! Enuma Elish!',
      'Gaze upon the weapon that split heaven and earth! ENUMA ELISH!'
    ],
    BUSTER_CHAIN: [
      'Rejoice, mongrel! You are permitted to gaze upon the Gate of Babylon!',
      'Your favorite raider just got expensive.',
      'Bow your head! All treasures in this world belong to the King!'
    ],
    CRITICAL_STRIKE: [
      'Look upon my treasury and despair, impudent worm!',
      'A critical flaw in your defense... fall before my blade!'
    ],
    CLASS_ADVANTAGE: [
      'Foolish mongrel, did you think your inferior class could challenge the King?',
      'Class advantage is mere child\'s play before absolute royal authority.'
    ],
    LOW_HP_CLUTCH: [
      'Impudent insect... to force the King to step back!',
      'You dare draw blood? I shall obliterate every trace of your existence!'
    ],
    STANDARD_ATTACK: [
      'Know your place in the Holy Grail War!',
      'Mongrel, withstand this if you can!'
    ]
  },
  artoria_saber: {
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
  emiya_archer: {
    NP_RELEASE: [
      'I am the bone of my sword... Unlimited Blade Works!',
      'Steel is my body, and fire is my blood... UNLIMITED BLADE WORKS!'
    ],
    BUSTER_CHAIN: [
      'Trace On! Overedge projection engaged!',
      'Caladbolg II — Fake Spiral Sword!'
    ],
    CRITICAL_STRIKE: [
      'I\'ll take this single chance to end it!',
      'Projection speed maxed out. Take this!'
    ],
    LOW_HP_CLUTCH: [
      'I\'m used to fighting against impossible odds.',
      'Still standing... Trace, ON!'
    ],
    STANDARD_ATTACK: [
      'Answering the Master\'s command.',
      'Ranged cover secured. Moving in.'
    ]
  },
  mhx_alter_berserker: {
    NP_RELEASE: [
      'Darkness of the Dark Round... Cross Calibur!',
      'Black sugar overdrive! Cross Calibur!'
    ],
    BUSTER_CHAIN: [
      'Your favorite raider just got expensive.',
      'Sweets intake at 200%. Commencing destruction!'
    ],
    CRITICAL_STRIKE: [
      'Sugar levels nominal... maximum critical speed!',
      'Target acquired. Critical raid strike!'
    ],
    CLASS_ADVANTAGE: [
      'Target locked. Class advantage verified.',
      'Eliminating target with maximum efficiency.'
    ],
    LOW_HP_CLUTCH: [
      'Emergency ration consumed... fighting on!',
      'Dark side energy surging!'
    ],
    STANDARD_ATTACK: [
      'Sweeps in for a tactical raid strike!',
      'Engaging target.'
    ]
  },
  cu_chulainn_lancer: {
    NP_RELEASE: [
      'Your heart is mine! Piercing Death Thorn — GÁE BOLG!',
      'Inescapable red spear of causality! GÁE BOLG!'
    ],
    BUSTER_CHAIN: [
      'Let us see if you can withstand the Hound of Ulster!',
      'Rune magic infused into every thrust!'
    ],
    CRITICAL_STRIKE: [
      'Got you! No dodging this strike!',
      'Critical hit right through your guard!'
    ],
    LOW_HP_CLUTCH: [
      'Protection from Arrows... I haven\'t lost yet!',
      'Guts active! The Hound never dies easy!'
    ],
    STANDARD_ATTACK: [
      'Lancer, taking the front lines!',
      'Here comes a thrust!'
    ]
  }
};

const CLASS_FALLBACK_QUOTES: Record<string, Record<DialogueScenario, string[]>> = {
  Saber: {
    NP_RELEASE: ['Noble sword, shine forth with glorious radiant power!', 'Blade of chivalry, unleash maximum mana output!'],
    BUSTER_CHAIN: ['Heavy slash! Break through their vanguard!', 'My blade will rend armor and ether alike!'],
    CRITICAL_STRIKE: ['A decisive strike at the enemy\'s weakness!', 'Precision slash delivered!'],
    CLASS_ADVANTAGE: ['Saber class affinity grants us complete dominance here!', 'Superior swordplay breaches your defense!'],
    LOW_HP_CLUTCH: ['I shall not yield while my Master depends on me!', 'Standing resolute despite severe wounds!'],
    STANDARD_ATTACK: ['Sword drawn! Advancing on the enemy!', 'Engaging target in close-quarters duel!'],
    VICTORY: ['Victory is secured for my Master!', 'The enemy champion has fallen.']
  },
  Archer: {
    NP_RELEASE: ['Raining down a thousand arrows from afar!', 'Bow string drawn tight... unleash the divine volley!'],
    BUSTER_CHAIN: ['Heavy artillery projection strike!', 'Direct hit with armor-piercing projectile!'],
    CRITICAL_STRIKE: ['Bullseye! Bullseye critical strike landed!', 'Target weakness exposed! Fire!'],
    CLASS_ADVANTAGE: ['Superior range and class affinity lock down the target!', 'Archery tactics invalidate your position!'],
    LOW_HP_CLUTCH: ['Independent Action active! I will keep firing!', 'Repositioning... the battle is not over yet!'],
    STANDARD_ATTACK: ['Nocking arrow. Loose!', 'Ranged barrage incoming!'],
    VICTORY: ['Target eliminated from range.', 'The battlefield is clear.']
  },
  Lancer: {
    NP_RELEASE: ['Pierce through the heavens! Spear of destiny!', 'Speed and thrust beyond the sound barrier!'],
    BUSTER_CHAIN: ['Overwhelming spear rush! Penetrate their line!', 'Lunge with full etheric momentum!'],
    CRITICAL_STRIKE: ['Deadly accurate spear point critical strike!', 'Through the gap in your defense!'],
    CLASS_ADVANTAGE: ['Spear length and agility completely counter your class!', 'Class advantage verified. Piercing through!'],
    LOW_HP_CLUTCH: ['Battle Continuation! I will drive this spear home!', 'Wounded, but far from defeated!'],
    STANDARD_ATTACK: ['Lancer advancing with high-speed thrusts!', 'Taste the point of my spear!'],
    VICTORY: ['The enemy falls before the spear.', 'A honorable victory on the battlefield.']
  },
  Berserker: {
    NP_RELEASE: ['GRAAAAAAH! MAXIMUM DESTRUCTIVE MADNESS!', 'RAAAAAAGH! OBLITERATE EVERYTHING!'],
    BUSTER_CHAIN: ['CRUSH! SMASH! HEAVY BUSTER IMPACT!', 'NO RETREAT! FULL MADNESS ASSAULT!'],
    CRITICAL_STRIKE: ['ROAARRR! CRITICAL SAVAGE STRIKE!', 'DEVASTATING CRITICAL CRUSH!'],
    CLASS_ADVANTAGE: ['BERSERKER DAMAGE DISSOLVES YOUR CLASS DEFENSE!', 'MADNESS OVERPOWERING EVERYTHING!'],
    LOW_HP_CLUTCH: ['GRAAAA! MAD ENHANCEMENT MAX LEVEL!', 'STILL FIGHTING! STILL CRUSHING!'],
    STANDARD_ATTACK: ['GRAAAAAAAH!', 'SMASH THEM TO PIECES!'],
    VICTORY: ['GRAAAAH! VICTORY!', 'ENEMIES REDUCED TO ASHES.']
  }
};

const GENERIC_DEFAULT_QUOTES: Record<DialogueScenario, string[]> = {
  NP_RELEASE: ['Unleashing True Name Release! Noble Phantasm max output!', 'Mana channels overflowing... Noble Phantasm trigger!'],
  BUSTER_CHAIN: ['All-out offensive! Buster chain unleashed!', 'Your favorite raider just got expensive.'],
  CRITICAL_STRIKE: ['Critical opening spotted! Maximum critical strike!', 'A flawless critical blow delivered to the target!'],
  CLASS_ADVANTAGE: ['Favorable class affinity gives us the advantage!', 'Target class vulnerable to our offensive line!'],
  LOW_HP_CLUTCH: ['Pushed to the limit... now witness my true strength!', 'Command Seals pulse... I will not give up!'],
  STANDARD_ATTACK: ['Executing tactical combat strike!', 'Engaging the enemy in clash resolution!'],
  VICTORY: ['The Holy Grail War victory is ours!', 'Battle concluded with complete success.']
};

export function determineScenarioTitle(scenario: DialogueScenario): string {
  switch (scenario) {
    case 'NP_RELEASE':
      return '✨ NOBLE PHANTASM UNLEASHED';
    case 'BUSTER_CHAIN':
      return '⚔️ BUSTER CHAIN HEAVY IMPACT';
    case 'CRITICAL_STRIKE':
      return '💥 HIGH CRITICAL STRIKE';
    case 'LOW_HP_CLUTCH':
      return '🔥 LOW HP CLUTCH OVERDRIVE';
    case 'CLASS_ADVANTAGE':
      return '⚡ CLASS ADVANTAGE TACTICS';
    case 'VICTORY':
      return '🏆 FINISHING BLOW VICTORY';
    case 'STANDARD_ATTACK':
    default:
      return '💬 MID-BATTLE COMBAT CUT-IN';
  }
}

export function generateBattleDialogue(
  combatant: ActiveCombatant,
  scenario: DialogueScenario,
  customQuoteOverride?: string
): MidBattleDialogue {
  const scenarioTitle = determineScenarioTitle(scenario);
  const servantId = combatant.id.toLowerCase();

  // 1. Check custom quote override
  if (customQuoteOverride && customQuoteOverride.trim().length > 0) {
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

  // 2. Check special quotes for recognized servants
  const matchedKey = Object.keys(SERVANT_SPECIAL_QUOTES).find(k => servantId.includes(k) || k.includes(servantId));
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

  // 3. Check class fallback quotes
  const cls = combatant.servantClass || 'Saber';
  const classQuotesObj = CLASS_FALLBACK_QUOTES[cls];
  if (classQuotesObj && classQuotesObj[scenario]) {
    const classQuotes = classQuotesObj[scenario];
    const quote = classQuotes[Math.floor(Math.random() * classQuotes.length)];
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

  // 4. Generic fallback quotes
  const genericQuotes = GENERIC_DEFAULT_QUOTES[scenario] || GENERIC_DEFAULT_QUOTES['STANDARD_ATTACK'];
  const quote = genericQuotes[Math.floor(Math.random() * genericQuotes.length)];

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
