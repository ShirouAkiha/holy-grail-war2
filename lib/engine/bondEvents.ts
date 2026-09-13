import {
  BondEvent,
  BondScene,
  BondChoice,
  BondDialogueLine,
  MasterServantInstance,
  ServantTemplate
} from '../types';

/**
 * Bond EXP thresholds required for each level (Levels 1 through 10).
 */
export const BOND_EXP_TABLE: Record<number, number> = {
  1: 0,
  2: 100,
  3: 250,
  4: 500,
  5: 800,
  6: 1200,
  7: 1700,
  8: 2300,
  9: 3000,
  10: 4000
};

export const MAX_BOND_LEVEL = 10;

/**
 * Calculates current Bond level based on total accumulated Bond EXP.
 */
export function getBondLevelFromExp(exp: number = 0): number {
  let level = 1;
  for (let l = 1; l <= MAX_BOND_LEVEL; l++) {
    if (exp >= (BOND_EXP_TABLE[l] || 0)) {
      level = l;
    } else {
      break;
    }
  }
  return level;
}

/**
 * Returns detailed progress information towards the next Bond Level.
 */
export function getBondExpProgress(exp: number = 0): {
  currentLevel: number;
  currentLevelBaseExp: number;
  nextLevelExp: number;
  expInCurrentLevel: number;
  neededForNextLevel: number;
  progressPercent: number;
  isMaxBond: boolean;
} {
  const currentLevel = getBondLevelFromExp(exp);
  const isMaxBond = currentLevel >= MAX_BOND_LEVEL;

  const currentLevelBaseExp = BOND_EXP_TABLE[currentLevel] || 0;
  const nextLevelExp = isMaxBond ? currentLevelBaseExp : (BOND_EXP_TABLE[currentLevel + 1] || currentLevelBaseExp + 1000);

  const expInCurrentLevel = Math.max(0, exp - currentLevelBaseExp);
  const neededForNextLevel = Math.max(1, nextLevelExp - currentLevelBaseExp);
  const progressPercent = isMaxBond ? 100 : Math.min(100, Math.round((expInCurrentLevel / neededForNextLevel) * 100));

  return {
    currentLevel,
    currentLevelBaseExp,
    nextLevelExp,
    expInCurrentLevel,
    neededForNextLevel,
    progressPercent,
    isMaxBond
  };
}

/**
 * Adds Bond EXP to a servant instance and calculates level-up result.
 */
export function addBondExpToServant(
  servant: MasterServantInstance,
  amount: number
): {
  updatedServant: MasterServantInstance;
  previousLevel: number;
  newLevel: number;
  didLevelUp: boolean;
} {
  const previousExp = servant.bondExp || 0;
  const newExp = previousExp + amount;

  const previousLevel = servant.bondLevel || getBondLevelFromExp(previousExp);
  const newLevel = getBondLevelFromExp(newExp);
  const didLevelUp = newLevel > previousLevel;

  const updatedServant: MasterServantInstance = {
    ...servant,
    bondExp: newExp,
    bondLevel: newLevel
  };

  return {
    updatedServant,
    previousLevel,
    newLevel,
    didLevelUp
  };
}

// ============================================================================
// CANONICAL SERVANT BOND EVENT SCRIPTS
// ============================================================================

export const ARTORIA_BOND_EVENTS: BondEvent[] = [
  {
    id: 'artoria_bond_event_1',
    servantTemplateId: 'artoria_pendragon',
    requiredBondLevel: 1,
    title: "The King's Weight & Evening Tea",
    subtitle: "A quiet dusk at the Emiya Residence",
    description: "Artoria reflects on her duties as the King of Knights and asks Master about your resolve in the Holy Grail War.",
    rewardBondExp: 150,
    rewardSaintQuartz: 3,
    unlockedQuoteId: 'artoria_bond_line_1',
    scenes: [
      {
        id: 'scene_1',
        speakerName: 'Artoria Pendragon',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Master... You are still awake? The moonlight over the courtyard is clear tonight. I was maintaining the invisible sheath of Invisible Air. In a Holy Grail War, one cannot drop their guard for a single second.",
        choices: [
          {
            id: 'c1_rest',
            text: "You should rest, Artoria. You don't have to bear the burden alone.",
            response: "Rest...? Master, my duty as your Servant is to be your shield. Yet... hearing your concern warms a quiet corner of my heart.",
            bondExpGain: 100,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_2_a'
          },
          {
            id: 'c1_train',
            text: "Let's spar! A Master needs to keep up with their Saber.",
            response: "Ha! A spirited response. Very well, Shirou. Show me your stance! I shall adjust my stroke so you can learn the rhythm of Camelot.",
            bondExpGain: 100,
            reactionEmotion: 'amused',
            nextSceneId: 'scene_2_b'
          },
          {
            id: 'c1_food',
            text: "Are you hungry? I just prepared fresh tea and warm rice bowls.",
            response: "F-Food?! R-Rice bowls and tea?! Ahem... As a Servant, prana sustenance is indeed essential. I accept your generous offering without hesitation, Master!",
            bondExpGain: 150,
            reactionEmotion: 'flustered',
            nextSceneId: 'scene_2_c'
          }
        ]
      },
      {
        id: 'scene_2_a',
        speakerName: 'Artoria Pendragon',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "In Britain, I pulled Caliburn from the stone knowing the path of a king is solitary. But standing beside you... I feel that fighting is no longer a solitary fate. Thank you, Master."
      },
      {
        id: 'scene_2_b',
        speakerName: 'Artoria Pendragon',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Your footwork is improving rapidly! Keep your core centered. With our combined resolve, no Heroic Spirit in this War can shatter our vanguard!"
      },
      {
        id: 'scene_2_c',
        speakerName: 'Artoria Pendragon',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Delicious...! Truly a masterpiece of culinary art, Master! I swear upon Excalibur to protect you with my very life—and to ensure we never run out of supplies!"
      }
    ]
  },
  {
    id: 'artoria_bond_event_2',
    servantTemplateId: 'artoria_pendragon',
    requiredBondLevel: 5,
    title: "The Light of Excalibur",
    subtitle: "A solemn oath under the starlight",
    description: "Reaching deep trust, Artoria shares the secret weight of the Sword of Promised Victory and her true wish for the Holy Grail.",
    rewardBondExp: 300,
    rewardSaintQuartz: 5,
    unlockedQuoteId: 'artoria_bond_line_5',
    scenes: [
      {
        id: 'scene_1',
        speakerName: 'Artoria Pendragon',
        backgroundTheme: 'camelot_court',
        dialogueText: "Master... Our bond has deepened far beyond a simple Master-Servant pact. When I look at Excalibur, I used to see only my regrets. But now, when I wield it at your side, I see hope.",
        choices: [
          {
            id: 'c2_vow',
            text: "I promise to fight by your side until the very end, Artoria.",
            response: "Then I, Artoria Pendragon, entrust my sword, my dragon's core, and my fate entirely unto your hands, Master.",
            bondExpGain: 200,
            reactionEmotion: 'determined',
            nextSceneId: 'scene_2_vow'
          },
          {
            id: 'c2_smile',
            text: "I'm glad to see you smiling more often.",
            response: "Is... is that so? A king must remain stoic, yet... when I am with you, I feel I can be more than just a King. I can be myself.",
            bondExpGain: 200,
            reactionEmotion: 'flustered',
            nextSceneId: 'scene_2_vow'
          }
        ]
      },
      {
        id: 'scene_2_vow',
        speakerName: 'Artoria Pendragon',
        backgroundTheme: 'camelot_court',
        dialogueText: "Gathered breath of the planet, shining light of life... Together, we shall claim victory in this Holy Grail War!"
      }
    ]
  }
];

export const GILGAMESH_BOND_EVENTS: BondEvent[] = [
  {
    id: 'gilgamesh_bond_event_1',
    servantTemplateId: 'gilgamesh',
    requiredBondLevel: 1,
    title: "Audience in the Golden Treasury",
    subtitle: "Fuyuki Skyline at Midnight",
    description: "Gilgamesh evaluates your worth as a Master while sipping wine from the Bab-ilu vault.",
    rewardBondExp: 150,
    rewardSaintQuartz: 3,
    unlockedQuoteId: 'gilgamesh_bond_line_1',
    scenes: [
      {
        id: 'scene_1',
        speakerName: 'Gilgamesh',
        backgroundTheme: 'camelot_court',
        dialogueText: "Fuhahahahaha! Mongrel, you dare approach the King of Heroes without trembling? Speak. What amusement do you intend to offer my golden throne tonight?",
        choices: [
          {
            id: 'gil_c1',
            text: "I offer you my loyalty as a Master, King of Heroes.",
            response: "Hmph. Loyalty is expected of all living beings before my brilliance. Yet... I admire your unwavering posture, mongrel. Pour my wine!",
            bondExpGain: 120,
            reactionEmotion: 'amused'
          },
          {
            id: 'gil_c2',
            text: "The Grail War is ours to conquer, Gilgamesh.",
            response: "Conquer? The Grail was already mine from the beginning of time! But watching you strive for my treasures... yes, that shall entertain me greatly!",
            bondExpGain: 150,
            reactionEmotion: 'smug'
          }
        ]
      },
      {
        id: 'scene_2',
        speakerName: 'Gilgamesh',
        backgroundTheme: 'camelot_court',
        dialogueText: "Keep your eyes open, Master. You are privileged to witness the golden light of Bab-ilu. Do not disappoint me in battle!"
      }
    ]
  }
];

export const EMIYA_BOND_EVENTS: BondEvent[] = [
  {
    id: 'emiya_bond_event_1',
    servantTemplateId: 'emiya',
    requiredBondLevel: 1,
    title: "Iron and Glass: Midnight Forge",
    subtitle: "The Shed of Projections",
    description: "EMIYA polishes forged blades while discussing the burden of heroism and tactical survival.",
    rewardBondExp: 150,
    rewardSaintQuartz: 3,
    unlockedQuoteId: 'emiya_bond_line_1',
    scenes: [
      {
        id: 'scene_1',
        speakerName: 'EMIYA',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Master. You're up late. I was just reinforcing Kanshou and Bakuya. In a War like this, idealism won't keep you alive—only cold, calculated preparation.",
        choices: [
          {
            id: 'emiya_c1',
            text: "I fight for those I care about. Is that wrong, Archer?",
            response: "Sigh... That naive gaze. It reminds me of someone I used to know. Fine... if you're determined to be an idealist, I'll make sure my bow shields your back.",
            bondExpGain: 150,
            reactionEmotion: 'thoughtful'
          },
          {
            id: 'emiya_c2',
            text: "Can you project a weapon for me to practice with?",
            response: "Trace, on. Here—a sturdy practice blade. Hold the grip firm. Don't make me carry you out of the battlefield!",
            bondExpGain: 120,
            reactionEmotion: 'amused'
          }
        ]
      },
      {
        id: 'scene_2',
        speakerName: 'EMIYA',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "My body is made of swords. As long as I stand, no blade shall pierce my Master!"
      }
    ]
  }
];

export const CU_CHULAINN_BOND_EVENTS: BondEvent[] = [
  {
    id: 'cu_bond_event_1',
    servantTemplateId: 'cu_chulainn',
    requiredBondLevel: 1,
    title: "Rune Magic & Hound's Pride",
    subtitle: "A night under the stars in Fuyuki",
    description: "Cú Chulainn carves ancient Norse runes on his red spear and shares stories of the Land of Shadows.",
    rewardBondExp: 150,
    rewardSaintQuartz: 3,
    unlockedQuoteId: 'cu_bond_line_1',
    scenes: [
      {
        id: 'scene_1',
        speakerName: 'Cú Chulainn',
        backgroundTheme: 'dun_scaith',
        dialogueText: "Yo, Master! How's it going? I was just carving a few Ansuz and Kenaz runes into Gáe Bolg. A Lancer's gotta keep his thrust sharp and his instincts sharper!",
        choices: [
          {
            id: 'cu_c1',
            text: "Teach me how rune magic works, Cú!",
            response: "Hah! Interested in Scáthach's discipline, are ya? Alright, pay attention! This rune unleashes flame, and this one wards off curses!",
            bondExpGain: 150,
            reactionEmotion: 'happy'
          },
          {
            id: 'cu_c2',
            text: "Let's grab a drink after our next victory.",
            response: "Now you're talking like a true Master! It's a deal. After we impale our enemy's heart, the first round is on me!",
            bondExpGain: 130,
            reactionEmotion: 'amused'
          }
        ]
      },
      {
        id: 'scene_2',
        speakerName: 'Cú Chulainn',
        backgroundTheme: 'dun_scaith',
        dialogueText: "The Hound of Ulster never backs down from a challenge. Let's show these enemy Masters what real spearmanship looks like!"
      }
    ]
  }
];

export const ADIOSA_BOND_EVENTS: BondEvent[] = [
  {
    id: 'adiosa_bond_event_1',
    servantTemplateId: 'adiosa_dragon_envoy',
    requiredBondLevel: 1,
    title: "Celestial Dragon Flight",
    subtitle: "High above the clouds of Fuyuki",
    description: "Adiosa spreads her celestial dragon wings and invites Master to view the world from the dragon's perch.",
    rewardBondExp: 180,
    rewardSaintQuartz: 3,
    unlockedQuoteId: 'adiosa_bond_line_1',
    scenes: [
      {
        id: 'scene_1',
        speakerName: 'Adiosa, Dragon Envoy',
        backgroundTheme: 'ebonwatch_realm',
        dialogueText: "Master... The dragon scales of my Spirit Origin resonate with your mana core. Look down at the city lights below us... From this altitude, mortal rivalries seem so small.",
        choices: [
          {
            id: 'adiosa_c1',
            text: "It's breathtaking, Adiosa. I feel safe with you.",
            response: "Your warmth... it soothes the primordial dragon flames within me. As long as our pact endures, no storm shall touch you.",
            bondExpGain: 160,
            reactionEmotion: 'happy'
          },
          {
            id: 'adiosa_c2',
            text: "Unleash your dragon breath when we enter the next clash!",
            response: "Fufufu... A Master with fierce fire in their heart! Very well. The Dragon Realm's wrath shall incinerate all who oppose us!",
            bondExpGain: 140,
            reactionEmotion: 'determined'
          }
        ]
      },
      {
        id: 'scene_2',
        speakerName: 'Adiosa, Dragon Envoy',
        backgroundTheme: 'ebonwatch_realm',
        dialogueText: "Celestial wings, hear my decree! Together, Master, we shall ascend to the pinnacle of the Grail War!"
      }
    ]
  }
];

export const AOKO_BOND_EVENTS: BondEvent[] = [
  {
    id: 'aoko_bond_event_1',
    servantTemplateId: 'aoko_aozaki',
    requiredBondLevel: 1,
    title: 'The Fifth Magician & The Late Night Patrol',
    subtitle: 'Bond Level 1 Interlude • Misaki Night Wards',
    description: 'A late-night conversation with Aoko Aozaki regarding her past in Misaki Town, the nature of the Fifth Magic, and your partnership.',
    rewardBondExp: 150,
    rewardSaintQuartz: 3,
    unlockedQuoteId: 'aoko_bond_line_1',
    scenes: [
      {
        id: 'scene_1',
        speakerName: 'Aoko Aozaki',
        backgroundTheme: 'misaki_town',
        dialogueText: "You’re up late. What, can’t sleep because the magical wards around here are humming, or did the idea of tomorrow's patrol finally get through that thick skull of yours?",
        choices: [
          {
            id: 'c1a',
            text: 'I came to check on you.',
            response: "Check on me? Give me a break. I’m a Servant, Master, not a delicate flower you need to water every three hours. Still... I guess having someone acknowledge I'm alive isn't the worst feeling in the world.",
            bondExpGain: 100,
            reactionEmotion: 'flustered',
            nextSceneId: 'scene_2'
          },
          {
            id: 'c1b',
            text: 'Just wanted some fresh air. And maybe an explanation about your magic.',
            response: "Fresh air, sure. As for my magic? Don't go digging into a magician's secrets unless you're ready to pay the tuition fee. Though, I suppose if we're partnering up in this mess, you deserve to know what kind of gun you're holding.",
            bondExpGain: 100,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_2'
          },
          {
            id: 'c1c',
            text: "You look like you're brooding. It doesn't suit you.",
            response: "Ha! Brooding? Me? Watch your mouth before I blast you into next week. I don't brood. I scheme. There's a massive difference, and one of them involves significantly more collateral damage.",
            bondExpGain: 125,
            reactionEmotion: 'smug',
            nextSceneId: 'scene_2'
          }
        ]
      },
      {
        id: 'scene_2',
        speakerName: 'Aoko Aozaki',
        backgroundTheme: 'misaki_town',
        dialogueText: "Look, ever since you summoned me into this Grail War, I’ve been thinking. You’re green. Painfully green. The Clock Tower snobs would eat you alive in five minutes, and an actual killer would take about five seconds. Yet here you are, barking orders and dragging me through alleyways like we’re partners in crime.",
        choices: [
          {
            id: 'c2a',
            text: "We *are* partners in crime. That's the whole point.",
            response: '"Partners in crime." Don\'t make me laugh. Back in Misaki, the only partner I had was a stubborn idiot and a bird that talked too much. But... fine. If we\'re partners, that means you pull your own weight. No hiding behind me when the spells start flying.',
            bondExpGain: 125,
            reactionEmotion: 'amused',
            nextSceneId: 'scene_3'
          },
          {
            id: 'c2b',
            text: "You're the one who keeps blowing up the scenery!",
            response: "Hey! Destruction is an art form, and I happen to be a master artist! Besides, if the enemy didn't want their hideout leveled, they shouldn't have set up shop in front of my firing line. That’s basic urban planning.",
            bondExpGain: 100,
            reactionEmotion: 'smug',
            nextSceneId: 'scene_3'
          },
          {
            id: 'c2c',
            text: "I'm trying my best to keep us both alive.",
            response: "...Yeah. I know you are. Don't look so defensive. If I actually thought you were useless, I would’ve cut the contract on night one and hunted the Grail myself. The fact that I'm still standing here listening to you complain should tell you something.",
            bondExpGain: 150,
            reactionEmotion: 'happy',
            nextSceneId: 'scene_3'
          }
        ]
      },
      {
        id: 'scene_3',
        speakerName: 'Aoko Aozaki',
        backgroundTheme: 'misaki_town',
        dialogueText: "You know, people always get terrified when they hear about the Fifth Magic. They whisper about it like it's some divine catastrophe waiting to wipe out the timeline. But to me? It’s just work. It’s borrowing from tomorrow to fix the mess we made today. It means every time I pull a miracle out of thin air, somewhere down the line, the bill comes due.",
        choices: [
          {
            id: 'c3a',
            text: 'Does it ever scare you? Carrying that kind of debt?',
            response: "Terrified? Maybe once, a long time ago in a snowfield. Now? It’s just life. If you freeze up because you’re scared of the consequences, you die before the consequences even catch up to you. You run forward, you kick down the door, and you deal with the fire afterward.",
            bondExpGain: 125,
            reactionEmotion: 'determined',
            nextSceneId: 'scene_4'
          },
          {
            id: 'c3b',
            text: 'Then let me help share the bill.',
            response: "You? Share the debt of True Magic? You'd evaporate on the spot, idiot. ...But I appreciate the sentiment. Really. Just keep your Command Spells handy and make sure my magical energy doesn't bottom out mid-fight. That's more than enough.",
            bondExpGain: 150,
            reactionEmotion: 'happy',
            nextSceneId: 'scene_4'
          },
          {
            id: 'c3c',
            text: 'Sounds like standard credit card logic to me.',
            response: "Pfft! Hahaha! Wow. Comparing the pinnacle of mystery to bad financial habits. You really don't have a filter, do you? I like that. Maguses spend their whole lives acting like uptight corpses; it's refreshing to hear someone talk like an actual human being for once.",
            bondExpGain: 150,
            reactionEmotion: 'amused',
            nextSceneId: 'scene_4'
          }
        ]
      },
      {
        id: 'scene_4',
        speakerName: 'Aoko Aozaki',
        backgroundTheme: 'misaki_town',
        dialogueText: "Alright, break time's over. The barrier on the west side just flickered. We’ve got company inbound, and by the feel of the prana, they didn't come to negotiate.",
        choices: [
          {
            id: 'c4a',
            text: "Right behind you. Let's show them what we can do.",
            response: "That's what I like to hear! Stick to my flank, Master. I'll blow open the path—you just make sure nobody sneaks up behind us!",
            bondExpGain: 150,
            reactionEmotion: 'determined'
          },
          {
            id: 'c4b',
            text: "Don't blow up the entire block this time, please!",
            response: "No promises! If they didn't want the block leveled, they should've stayed in their own territory! Let's go!",
            bondExpGain: 125,
            reactionEmotion: 'amused'
          }
        ]
      }
    ]
  }
];

/**
 * Registry of all available curated bond events by servant template ID.
 */
export const SERVANT_BOND_EVENT_DATABASE: Record<string, BondEvent[]> = {
  artoria_pendragon: ARTORIA_BOND_EVENTS,
  gilgamesh: GILGAMESH_BOND_EVENTS,
  emiya: EMIYA_BOND_EVENTS,
  cu_chulainn: CU_CHULAINN_BOND_EVENTS,
  adiosa_dragon_envoy: ADIOSA_BOND_EVENTS,
  aoko_aozaki: AOKO_BOND_EVENTS
};

/**
 * Dynamically generates a custom Visual Novel Bond Event for custom or unscripted servants
 * so testing and gameplay works seamlessly for ANY servant in the game!
 */
export function generateGenericBondEvent(
  servant: ServantTemplate | MasterServantInstance,
  targetBondLevel: number = 1
): BondEvent {
  const template = 'template' in servant ? servant.template : servant;
  const name = template.name || 'Heroic Spirit';
  const servantClass = template.servantClass || 'Saber';
  const avatarUrl = template.avatarUrl;

  return {
    id: `bond_event_generic_${template.id}_lvl_${targetBondLevel}`,
    servantTemplateId: template.id,
    requiredBondLevel: targetBondLevel,
    title: `Bond Interlude: ${name}'s Resolve`,
    subtitle: `Bond Level ${targetBondLevel} Interlude`,
    description: `Spend time getting to know ${name} in Chaldea and learn more about their past battles and expectations for your pact.`,
    rewardBondExp: 150 + targetBondLevel * 25,
    rewardSaintQuartz: 3,
    scenes: [
      {
        id: 'scene_1',
        speakerName: name,
        speakerAvatarUrl: avatarUrl,
        backgroundTheme: 'chaldea_room',
        dialogueText: `Greetings, Master. As a ${servantClass}, I have walked through countless battles. Spending this quiet moment with you allows me to calibrate my Spirit Origin for our upcoming clashes.`,
        choices: [
          {
            id: 'gen_c1',
            text: `Tell me about your noble phantasm, ${name}.`,
            response: `My Noble Phantasm is the embodiment of my hero's journey. ${template.noblePhantasm?.chant || template.lore || 'When invoked, it shatters our foes without mercy!'}`,
            bondExpGain: 100,
            reactionEmotion: 'determined',
            nextSceneId: 'scene_2'
          },
          {
            id: 'gen_c2',
            text: `I'm proud to have summoned you as my ${servantClass}.`,
            response: `Your trust honors me, Master! A Servant's true strength springs from the faith of their Master. I shall cut down any obstacle in your path.`,
            bondExpGain: 125,
            reactionEmotion: 'happy',
            nextSceneId: 'scene_2'
          }
        ]
      },
      {
        id: 'scene_2',
        speakerName: name,
        speakerAvatarUrl: avatarUrl,
        backgroundTheme: 'chaldea_room',
        dialogueText: `Our pact is forged in iron and mana, Master. Let us continue to fight together and conquer the Holy Grail War!`
      }
    ]
  };
}

/**
 * Returns all available Bond Events for a given servant instance based on template ID and bond level.
 */
export function getBondEventsForServant(
  servant: MasterServantInstance
): BondEvent[] {
  const templateId = servant.templateId || servant.template?.id || servant.id;
  const curated = SERVANT_BOND_EVENT_DATABASE[templateId];

  if (curated && curated.length > 0) {
    return curated;
  }

  // Fallback generic bond event for testing & custom servants
  const currentBond = servant.bondLevel || 1;
  return [generateGenericBondEvent(servant.template || servant, Math.max(1, currentBond))];
}

/**
 * Selects the active (unlocked & uncompleted, or highest available for replay) Bond Interlude event for a Servant.
 */
export function selectActiveInterludeForServant(servant: MasterServantInstance | any): {
  event: BondEvent;
  isReplay: boolean;
  statusNote: string;
} {
  const events = getBondEventsForServant(servant);
  const completedIds = servant.completedBondEvents || [];
  const bondLevel = servant.bondLevel || 1;

  // 1. Find the first unlocked event that has NOT been completed yet
  const uncompleted = events.find(e => e.requiredBondLevel <= bondLevel && !completedIds.includes(e.id));
  if (uncompleted) {
    return {
      event: uncompleted,
      isReplay: false,
      statusNote: `Ready to Play (Bond Lv. ${uncompleted.requiredBondLevel} Required)`
    };
  }

  // 2. If all unlocked events are completed, find the highest unlocked completed event for replay
  const completedUnlocked = events.filter(e => e.requiredBondLevel <= bondLevel && completedIds.includes(e.id));
  if (completedUnlocked.length > 0) {
    const highestCompleted = completedUnlocked[completedUnlocked.length - 1];
    return {
      event: highestCompleted,
      isReplay: true,
      statusNote: `Replay Mode (Completed)`
    };
  }

  // 3. Fallback to the first available event or generic fallback
  const firstEvent = events[0] || generateGenericBondEvent(servant?.template || servant, Math.max(1, bondLevel));
  const isUnlocked = firstEvent.requiredBondLevel <= bondLevel;

  return {
    event: firstEvent,
    isReplay: completedIds.includes(firstEvent.id),
    statusNote: isUnlocked ? 'Ready to Play' : `Locked (Requires Bond Lv. ${firstEvent.requiredBondLevel})`
  };
}

/**
 * Unlocked dialogue quotes database associated with Bond levels.
 */
export const SERVANT_BOND_DIALOGUE_LINES: Record<string, BondDialogueLine[]> = {
  artoria_pendragon: [
    {
      id: 'artoria_summon',
      title: 'Summoning Pact',
      category: 'summon',
      requiredBondLevel: 1,
      quoteText: 'I ask of you, are you my Master? Servant Saber, Artoria Pendragon. I answer your summons!'
    },
    {
      id: 'artoria_bond_1',
      title: 'Bond 1: The First Step',
      category: 'bond_1',
      requiredBondLevel: 1,
      quoteText: 'Do not worry about my well-being, Master. As a Servant, my sword is devoted entirely to your victory.'
    },
    {
      id: 'artoria_bond_2',
      title: 'Bond 2: Shared Meals',
      category: 'bond_2',
      requiredBondLevel: 2,
      quoteText: 'Master, is it time for dinner yet? A properly nourished knight is essential for peak tactical performance.'
    },
    {
      id: 'artoria_bond_3',
      title: 'Bond 3: Chivalric Trust',
      category: 'bond_3',
      requiredBondLevel: 3,
      quoteText: 'I have fought alongside many knights of the Round Table, but your steadfast spirit gives me a quiet peace I haven’t felt in years.'
    },
    {
      id: 'artoria_bond_4',
      title: 'Bond 4: Unbroken Oath',
      category: 'bond_4',
      requiredBondLevel: 4,
      quoteText: 'Even if the heavens fall or the Grail War turns against us, stand behind me, Shirou. Excalibur will clear our path.'
    },
    {
      id: 'artoria_bond_5',
      title: 'Bond 5: Heart of the King',
      category: 'bond_5',
      requiredBondLevel: 5,
      quoteText: 'I used to think a king must abandon human heart to be righteous. But with you... I remember what it means to be Artoria.'
    }
  ],
  gilgamesh: [
    {
      id: 'gil_summon',
      title: 'Summoning Pact',
      category: 'summon',
      requiredBondLevel: 1,
      quoteText: 'Fuhahaha! Who dares summon the King of Heroes? You have lucked into a divine partner, mongrel!'
    },
    {
      id: 'gil_bond_1',
      title: 'Bond 1: King\'s Audience',
      category: 'bond_1',
      requiredBondLevel: 1,
      quoteText: 'Stand upright before my presence! A Master of Gilgamesh must carry themselves with dignity.'
    },
    {
      id: 'gil_bond_5',
      title: 'Bond 5: Trusted Subject',
      category: 'bond_5',
      requiredBondLevel: 5,
      quoteText: 'Very well, Master. I grant you the right to look upon my treasury. Do not make me regret my generosity!'
    }
  ],
  emiya: [
    {
      id: 'emiya_summon',
      title: 'Summoning Pact',
      category: 'summon',
      requiredBondLevel: 1,
      quoteText: 'Servant Archer. I have answered your call. Let\'s get one thing straight: I obey orders, but don\'t expect miracles.'
    },
    {
      id: 'emiya_bond_1',
      title: 'Bond 1: Tactical Iron',
      category: 'bond_1',
      requiredBondLevel: 1,
      quoteText: 'Keep your head down in combat, Master. Leave the long-range artillery to me.'
    },
    {
      id: 'emiya_bond_5',
      title: 'Bond 5: The Hero\'s Shadow',
      category: 'bond_5',
      requiredBondLevel: 5,
      quoteText: 'I used to despise the path I took... But fighting alongside a Master who genuinely values human life... perhaps it wasn\'t all in vain.'
    }
  ],
  cu_chulainn: [
    {
      id: 'cu_summon',
      title: 'Summoning Pact',
      category: 'summon',
      requiredBondLevel: 1,
      quoteText: 'Yo! Servant Lancer. The name\'s Cú Chulainn. Take it easy, Master—I\'m the best spearmanship expert you could ever ask for!'
    },
    {
      id: 'cu_bond_1',
      title: 'Bond 1: Hound\'s Spirit',
      category: 'bond_1',
      requiredBondLevel: 1,
      quoteText: 'Don\'t worry about my defense. A true hound charges straight into the enemy formation!'
    },
    {
      id: 'cu_bond_5',
      title: 'Bond 5: Celtic Oath',
      category: 'bond_5',
      requiredBondLevel: 5,
      quoteText: 'Upon my spear and my Geas, Master—I\'ll pierce any enemy that dares put a finger on you!'
    }
  ],
  adiosa_dragon_envoy: [
    {
      id: 'adiosa_summon',
      title: 'Summoning Pact',
      category: 'summon',
      requiredBondLevel: 1,
      quoteText: 'Celestial tides gather! I am Adiosa, Dragon Envoy of the Ebonwatch Realm. I offer my draconic wings to your command.'
    },
    {
      id: 'adiosa_bond_1',
      title: 'Bond 1: Dragon\'s Roar',
      category: 'bond_1',
      requiredBondLevel: 1,
      quoteText: 'My scales hum with divine energy. Fear no mortal weaponry, Master.'
    },
    {
      id: 'adiosa_bond_5',
      title: 'Bond 5: Sovereign Pact',
      category: 'bond_5',
      requiredBondLevel: 5,
      quoteText: 'You have earned the eternal devotion of the Dragon Realm. Where you fly, I shall follow!'
    }
  ],
  aoko_aozaki: [
    {
      id: 'aoko_summon',
      title: 'Summoning Pact',
      category: 'summon',
      requiredBondLevel: 1,
      quoteText: "Servant Caster, Aoko Aozaki. The Fifth Magician... though honestly, just call me Aoko. Let's get to work, Master!"
    },
    {
      id: 'aoko_bond_1',
      title: 'Bond 1: Late Night Patrol',
      category: 'bond_1',
      requiredBondLevel: 1,
      quoteText: "Check on me? Give me a break. I’m a Servant, Master, not a delicate flower you need to water every three hours. Still... I guess having someone acknowledge I'm alive isn't the worst feeling in the world."
    },
    {
      id: 'aoko_bond_3',
      title: 'Bond 3: Partners in Crime',
      category: 'bond_3',
      requiredBondLevel: 3,
      quoteText: "If we're partners, that means you pull your own weight. No hiding behind me when the spells start flying!"
    },
    {
      id: 'aoko_bond_5',
      title: 'Bond 5: True Magic Debt',
      category: 'bond_5',
      requiredBondLevel: 5,
      quoteText: "Share the debt of True Magic? You'd evaporate on the spot, idiot... But I appreciate the sentiment. Really."
    }
  ]
};

/**
 * Resolves all unlocked dialogue lines for a servant based on their current Bond Level.
 */
export function getUnlockedDialogueLinesForServant(
  servant: MasterServantInstance
): BondDialogueLine[] {
  const templateId = servant.templateId || servant.template?.id || servant.id;
  const curated = SERVANT_BOND_DIALOGUE_LINES[templateId];
  const bondLevel = servant.bondLevel || 1;

  if (curated && curated.length > 0) {
    return curated.filter(line => line.requiredBondLevel <= bondLevel);
  }

  // Fallback lines for custom / unscripted servants
  const template = servant.template || servant;
  const fallbackLines: BondDialogueLine[] = [
    {
      id: `${templateId}_summon`,
      title: 'Summoning Quote',
      category: 'summon',
      requiredBondLevel: 1,
      quoteText: servant.customQuotes?.summon || template?.summonQuote || `I answer your summons, Master!`
    },
    {
      id: `${templateId}_bond_1`,
      title: 'Bond 1: Trusting Pact',
      category: 'bond_1',
      requiredBondLevel: 1,
      quoteText: `I am ready to follow your orders. Lead the way!`
    }
  ];

  if (bondLevel >= 5) {
    fallbackLines.push({
      id: `${templateId}_bond_5`,
      title: 'Bond 5: Devoted Loyalty',
      category: 'bond_5',
      requiredBondLevel: 5,
      quoteText: `You have proven yourself a worthy Master. My power is completely yours!`
    });
  }

  return fallbackLines;
}
