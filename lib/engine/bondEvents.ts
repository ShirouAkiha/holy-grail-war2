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

export const HERACLES_BOND_EVENTS: BondEvent[] = [
  {
    id: 'heracles_bond_event_1',
    servantTemplateId: 'heracles_berserker',
    requiredBondLevel: 1,
    title: 'The Great Hero & Morning Roars',
    subtitle: 'Bond Level 1 Interlude • Fuyuki Residence',
    description: 'A chaotic morning in Chaldea with Heracles navigating domestic life, teacups, butterflies, and grocery flyers under Mad Enhancement.',
    rewardBondExp: 150,
    rewardSaintQuartz: 3,
    unlockedQuoteId: 'heracles_bond_line_1',
    scenes: [
      {
        id: 'scene_1',
        speakerName: 'Heracles',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: '■■■■■■■■■■ーーー！！',
        choices: [
          {
            id: 'c1a',
            text: 'Good morning to you too, big guy! Did you sleep well?',
            response: '───GUUUUUUUUUUUURRRRRRGH.',
            bondExpGain: 125,
            reactionEmotion: 'happy',
            nextSceneId: 'scene_2'
          },
          {
            id: 'c1b',
            text: 'Whoa, lower the volume! The landlord is already threatening to evict us!',
            response: '───Grr...? *Grumble.*',
            bondExpGain: 100,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_2'
          },
          {
            id: 'c1c',
            text: 'Put the refrigerator down. We talked about this.',
            response: '*THUD.* ───GRAAAAH!',
            bondExpGain: 150,
            reactionEmotion: 'flustered',
            nextSceneId: 'scene_2'
          }
        ]
      },
      {
        id: 'scene_2',
        speakerName: 'Heracles',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: '■■■■■■ーーーッ！',
        choices: [
          {
            id: 'c2a',
            text: 'Wait, why are you holding a tiny pink teacup?',
            response: '*CRUNCH.* ───Gwooooh...',
            bondExpGain: 125,
            reactionEmotion: 'flustered',
            nextSceneId: 'scene_3'
          },
          {
            id: 'c2b',
            text: "Is that... battery acid you're drinking out of the kettle?",
            response: '───GURRRRGH! *Gulp.* ■■■■■■ッ！',
            bondExpGain: 100,
            reactionEmotion: 'angry',
            nextSceneId: 'scene_3'
          },
          {
            id: 'c2c',
            text: 'Look at you, participating in high society tea time!',
            response: '───Hmph. *Grrr-grunt.*',
            bondExpGain: 150,
            reactionEmotion: 'smug',
            nextSceneId: 'scene_3'
          }
        ]
      },
      {
        id: 'scene_3',
        speakerName: 'Heracles',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: '───GWAAAARGH?! ■■■■■■■■■■ーーーッ！！',
        choices: [
          {
            id: 'c3a',
            text: "Don't panic! It’s just a butterfly! You killed the Nemean Lion, you can handle a bug!",
            response: '───GROOOOOGH... *Snort.*',
            bondExpGain: 125,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_4'
          },
          {
            id: 'c3b',
            text: "NO, DON'T USE NINE LIVES ON A MOTH!",
            response: '■■■■■■■■■■■■■■■■ーーーーーッッッ！！！',
            bondExpGain: 100,
            reactionEmotion: 'angry',
            nextSceneId: 'scene_4'
          },
          {
            id: 'c3c',
            text: 'Quick, hide behind me! I will protect you from the winged terror!',
            response: '...Guh? ───Gwa-ha-ha-ha-ha!',
            bondExpGain: 150,
            reactionEmotion: 'happy',
            nextSceneId: 'scene_4'
          }
        ]
      },
      {
        id: 'scene_4',
        speakerName: 'Heracles',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: '───Grrrr. *Rumble.*',
        choices: [
          {
            id: 'c4a',
            text: "Are you trying to pat my head? Please don't shatter my skull.",
            response: '*Pat... pat.* ───Gwooh.',
            bondExpGain: 125,
            reactionEmotion: 'happy',
            nextSceneId: 'scene_5'
          },
          {
            id: 'c4b',
            text: "You're pointing at the grocery store flyer. Do you want the discounted meat?",
            response: '■■■■■■！！ *NOD.* ───GRAAAA!',
            bondExpGain: 150,
            reactionEmotion: 'excited',
            nextSceneId: 'scene_5'
          },
          {
            id: 'c4c',
            text: "You're actually a big softie underneath all that Mad Enhancement, aren't you?",
            response: '───TSK. *GROOOOOAR!*',
            bondExpGain: 125,
            reactionEmotion: 'flustered',
            nextSceneId: 'scene_5'
          }
        ]
      },
      {
        id: 'scene_5',
        speakerName: 'Heracles',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: '■■■■■■■■■■ーーー！！',
        choices: [
          {
            id: 'c5a',
            text: 'Alright! Meat buffet it is! Charge!',
            response: '───UOOOOOOOOHHHH! ■■■■■■■■■■ーーーッ！！',
            bondExpGain: 150,
            reactionEmotion: 'excited'
          },
          {
            id: 'c5b',
            text: "Let's go win this Grail War, buddy. Right after lunch.",
            response: '───GURRGH!',
            bondExpGain: 150,
            reactionEmotion: 'determined'
          }
        ]
      }
    ]
  }
];

export const SCATHACH_BOND_EVENTS: BondEvent[] = [
  {
    id: 'scathach_bond_event_1',
    servantTemplateId: 'scathach_lancer',
    requiredBondLevel: 1,
    title: "Shadows of Dún Scáith & Midnight Stance",
    subtitle: "A cold night in Fuyuki",
    description: "Scáthach questions your posture and resolve under the night sky, testing whether your spirit is fit for the Queen of Dún Scáith.",
    rewardBondExp: 150,
    rewardSaintQuartz: 3,
    unlockedQuoteId: 'scathach_bond_line_1',
    scenes: [
      {
        id: 'scene_1',
        speakerName: 'Scáthach',
        backgroundTheme: 'dun_scaith',
        dialogueText: "Why have you summoned me here at such an ungodly hour, Master? If you expect an enemy ambush in this quiet town, your posture says otherwise. Speak plainly.",
        choices: [
          {
            id: 'c1_sleep',
            text: "I couldn't sleep. The pressure of this Holy Grail War is getting to me.",
            response: "Dread is the mark of an undisciplined mind. If the mere thought of battle keeps you awake, your heart will betray your body when the strike comes. You lack the grit of a warrior, yet you stand here nonetheless.",
            bondExpGain: 100,
            reactionEmotion: 'stern',
            nextSceneId: 'scene_2'
          },
          {
            id: 'c1_talk',
            text: "I wanted to know more about you, Lancer. We barely talk outside of combat.",
            response: "Idle curiosity is a luxury reserved for survivors. Knowing my history will not deflect a blade or pierce an enemy's heart. Still... your desire to peer into the dark is stubborn, if nothing else.",
            bondExpGain: 100,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_2'
          },
          {
            id: 'c1_vigilant',
            text: "Just checking our perimeter. A good Master stays vigilant, right?",
            response: "Vigilance without purpose is just wasted energy. Look at your stance—should an assassin materialize from the fog, your neck would be severed before your command seals could even flare.",
            bondExpGain: 125,
            reactionEmotion: 'stern',
            nextSceneId: 'scene_2'
          }
        ]
      },
      {
        id: 'scene_2',
        speakerName: 'Scáthach',
        backgroundTheme: 'dun_scaith',
        dialogueText: "You look upon me with eyes full of questions. This far-eastern city is strange to me, yet the stench of bloodshed in pursuit of a vessel is universal. Tell me, Master, what do you think I am to you in this ritual?",
        choices: [
          {
            id: 'c2_guide',
            text: "A legendary warrior who can guide me through this alive.",
            response: "Guide you? Do not misunderstand my nature. I am neither your teacher, nor your mother, nor your sister, nor your lover. I am a Servant summoned under a contract of blood and prana. Whatever instincts I have to train the green out of you are mere ghosts of a life long expired.",
            bondExpGain: 100,
            reactionEmotion: 'stern',
            nextSceneId: 'scene_3'
          },
          {
            id: 'c2_partner',
            text: "A partner. We fight together to win the Grail.",
            response: "\"Partners.\" An empty sentiment born of modern naivety. Reliance breeds expectation, and expectation invites hesitation. When the decisive second arrives, relying on another will only make your spear hand waver.",
            bondExpGain: 100,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_3'
          },
          {
            id: 'c2_weapon',
            text: "A blunt weapon to kill other Servants, nothing more.",
            response: "Hmph. Cold, but practical. I do not hate that pragmatism. At least a weapon has a singular, honest purpose. Yet, to wield a spear properly, you must understand the weight behind its thrust, lest the recoil shatter your own bones.",
            bondExpGain: 150,
            reactionEmotion: 'amused',
            nextSceneId: 'scene_3'
          }
        ]
      },
      {
        id: 'scene_3',
        speakerName: 'Scáthach',
        backgroundTheme: 'dun_scaith',
        dialogueText: "In truth, this Grail holds no value to me. It cannot grant what I desire, for what I seek cannot be poured from a golden cup.",
        choices: [
          {
            id: 'c3_desire',
            text: "What is it that you desire, then?",
            response: "A quiet end. A proper death at the hands of one who has transcended mortality itself. I stepped into the territory of gods and stepped past the threshold of mortality. Now, the world itself refuses to let me rot. It is an absurd curse disguised as transcendence.",
            bondExpGain: 125,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_4'
          },
          {
            id: 'c3_summon',
            text: "Then why did you answer the summon?",
            response: "The possibility of an encounter. The Holy Grail War drags legends from the throne—monsters, kings, demigods. Perhaps among them walks a warrior capable of striking my core and putting a true end to my breath. That alone was worth materializing.",
            bondExpGain: 125,
            reactionEmotion: 'determined',
            nextSceneId: 'scene_4'
          },
          {
            id: 'c3_fight',
            text: "If you don't care about the Grail, will you still fight for my wish?",
            response: "So long as the mana flows and the contract holds, my red spears will answer your command. Your small wishes do not offend me; I have seen centuries of men chase fleeting desires. I will cut down your opposition regardless.",
            bondExpGain: 150,
            reactionEmotion: 'determined',
            nextSceneId: 'scene_4'
          }
        ]
      },
      {
        id: 'scene_4',
        speakerName: 'Scáthach',
        backgroundTheme: 'dun_scaith',
        dialogueText: "Long ago, beyond the boundaries of this world, men crossed oceans of blood to reach the Land of Shadows. They came seeking strength, seeking runes, seeking glory. Most died upon the shoreline before ever meeting my gaze. Among them was a boy named Setanta.",
        choices: [
          {
            id: 'c4_cu',
            text: "Setanta... you mean Cú Chulainn, the Hound of Ulster?",
            response: "Yes. That is the name he was given later, but to me, he was simply Setanta. A wild, foolish hound with eyes that burned too bright. I forged his spirit, honed his spear, and bestowed upon him the cursed branch of the sea monster. He surpassed every limit set before him... yet even he could not pierce my chest.",
            bondExpGain: 125,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_5'
          },
          {
            id: 'c4_students',
            text: "Did you treat all your students as harshly as you speak to me?",
            response: "Harshly? I was merciful. The weak were given swift deaths; the strong were broken and reassembled until their bodies became living iron. In the Land of Shadows, weakness is not a flaw to be pitied—it is an insult to the battlefield.",
            bondExpGain: 125,
            reactionEmotion: 'stern',
            nextSceneId: 'scene_5'
          },
          {
            id: 'c4_defeat',
            text: "Did he ever come close to defeating you?",
            response: "Defeating me? No. He grew monstrously strong, magnificent in his brutality, but the gap remained absolute. He left to fulfill his tragic destiny, and I remained behind, immortal, watching his legend burn out while I stayed frozen in time.",
            bondExpGain: 150,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_5'
          }
        ]
      },
      {
        id: 'scene_5',
        speakerName: 'Scáthach',
        backgroundTheme: 'dun_scaith',
        dialogueText: "Sometimes, looking at your clumsy footwork, I feel the old habit rising in my throat. I catch myself wanting to strike your ribs, correct your balance, teach you how to trace a Primordial Rune in the air... but no. I am not your teacher. Forget it.",
        choices: [
          {
            id: 'c5_teach',
            text: "Why stop yourself? Teach me. I want to survive this war.",
            response: "You speak lightly of hell. My training does not involve gentle corrections and encouraging words. To learn from me is to stand at the precipice of death until your instincts overtake your fear. If you truly wish for that fire, I will not hold back the heat.",
            bondExpGain: 150,
            reactionEmotion: 'determined',
            nextSceneId: 'scene_6'
          },
          {
            id: 'c5_who_you_are',
            text: "You really can't help it, can you? It's just who you are.",
            response: "...Watch your tongue. You speak as if you can see through centuries of isolation. Still... perhaps there is truth in your insolence. A mentor’s pride is a stubborn poison that lingers long after the pupils have turned to dust.",
            bondExpGain: 150,
            reactionEmotion: 'amused',
            nextSceneId: 'scene_6'
          },
          {
            id: 'c5_lecture',
            text: "I didn't ask for a lecture, Lancer. Keep your lessons to yourself.",
            response: "Arrogance without skill is the quickest path to an unmarked grave. Keep that tongue sharp, Master—you will need every bit of defiance you can muster when enemy blades find you.",
            bondExpGain: 100,
            reactionEmotion: 'stern',
            nextSceneId: 'scene_6'
          }
        ]
      },
      {
        id: 'scene_6',
        speakerName: 'Scáthach',
        backgroundTheme: 'dun_scaith',
        dialogueText: "Look up at the sky. A quiet Japanese town, unaware that phantoms of myth are prowling its alleys, ready to bathe it in fire. This fragile peace humanity clings to... it is entirely fleeting, yet you struggle so desperately to preserve it. Tell me, Master, when the moment comes where my spear cannot shield you, will you run, or will you stand?",
        choices: [
          {
            id: 'c6_stand',
            text: "I will stand right beside you, even if it means dying.",
            response: "A fool's resolve... but a warrior's answer. I have no use for cowards who hide behind command seals while their Servants bleed. If you choose to stand, then ensure your spine does not bow under the pressure.",
            bondExpGain: 150,
            reactionEmotion: 'determined',
            nextSceneId: 'scene_7'
          },
          {
            id: 'c6_retreat',
            text: "I'll retreat and live to fight another round. Survival comes first.",
            response: "Pragmatic. A dead Master cannot win a war, nor can they supply prana. Knowing when to break away is not cowardice; it is tactic. Just ensure that when you turn your back, your steps are swifter than death.",
            bondExpGain: 125,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_7'
          },
          {
            id: 'c6_trust',
            text: "I trust you won't let an enemy blade get that close to me.",
            response: "Do not place absolute faith in a weapon, Master. Even my spears can be parried, and even my eyes can be deceived. If you stake your life entirely on my perfection, you will bleed for your blindness.",
            bondExpGain: 125,
            reactionEmotion: 'stern',
            nextSceneId: 'scene_7'
          }
        ]
      },
      {
        id: 'scene_7',
        speakerName: 'Scáthach',
        backgroundTheme: 'dun_scaith',
        dialogueText: "The night deepens, and the prana in the air grows turbulent. Our conversation ends here. Steel your heart, Master. Tomorrow night, the hunt resumes—and I expect you to keep pace with the Queen of Dun Scáith."
      }
    ]
  }
];

export const JEANNE_RULER_BOND_EVENTS: BondEvent[] = [
  {
    id: 'jeanne_ruler_bond_event_1',
    servantTemplateId: 'jeanne_darc_ruler',
    requiredBondLevel: 1,
    title: "Saint's Vigil & Gentle Night Air",
    subtitle: "Bond Level 1 Interlude • Rooftop Vigil over Fuyuki",
    description: "A quiet midnight conversation with Jeanne d'Arc atop a high vantage point, reflecting on life, faith, and your pact as Master and Servant.",
    rewardBondExp: 150,
    rewardSaintQuartz: 3,
    unlockedQuoteId: 'jeanne_ruler_bond_line_1',
    scenes: [
      {
        id: 'scene_1',
        speakerName: "Jeanne d'Arc",
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "The night air here is surprisingly gentle, Master. Even in the middle of a conflict like this, the town feels so peaceful when looking at it from up here. Are you holding up all right? You still looked quite pale after we established the contract earlier.",
        choices: [
          {
            id: 'c1_option1',
            text: "I'm still trying to process all of this. Magic, Servants, fighting for a relic... it's overwhelming.",
            response: "That is completely natural. To be pulled from an ordinary life into a battle of ideals and survival is a terrible shock. You do not need to force yourself to accept everything overnight. I will be your shield while you find your footing.",
            bondExpGain: 125,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_2'
          },
          {
            id: 'c1_option2',
            text: "I’m fine, honestly. Just a little tired from running around all evening.",
            response: "You say that, but your shoulders are stiff as stone. You do not have to hide your exhaustion from me. Endurance is admirable, but ignoring your limits will only cost you when danger truly strikes.",
            bondExpGain: 125,
            reactionEmotion: 'stern',
            nextSceneId: 'scene_2'
          },
          {
            id: 'c1_option3',
            text: "Pale? I thought I looked pretty heroic standing next to a legendary saint.",
            response: "Heroic, is it? You certainly had resolve in your eyes, but vanity will not deflect an enemy's blade, Master. Still... having lighthearted courage is better than trembling in despair.",
            bondExpGain: 150,
            reactionEmotion: 'amused',
            nextSceneId: 'scene_2'
          }
        ]
      },
      {
        id: 'scene_2',
        speakerName: "Jeanne d'Arc",
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Tell me, before the Command Seals appeared on your hand, what kind of life did you lead in this city? A Holy Grail War demands so much, yet I still know almost nothing about the person walking beside me.",
        choices: [
          {
            id: 'c2_option1',
            text: "Just average. School, part-time shifts, walking through convenience stores at midnight. Completely mundane.",
            response: "A mundane life is a profound blessing, Master. In my own era, peace of that scale was a distant dream for most peasants. Waking up knowing tomorrow will likely come without ruin... that quiet routine is precisely what deserves protection.",
            bondExpGain: 150,
            reactionEmotion: 'happy',
            nextSceneId: 'scene_3'
          },
          {
            id: 'c2_option2',
            text: "Quiet, maybe a bit lonely. I mostly kept to myself and watched the days slip by.",
            response: "Solitude can weigh heavily on a person. But even in a quiet existence, you were carrying yourself forward every single day. That quiet endurance requires its own quiet kind of faith.",
            bondExpGain: 150,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_3'
          },
          {
            id: 'c2_option3',
            text: "I always felt like something was missing, like I was waiting for a spark or purpose.",
            response: "Be careful wishing for a spark. Often, when the world answers that longing, it does so through fire and trial. But now that you stand in the flame, I pray you find the resolve to shape it into something noble rather than destructive.",
            bondExpGain: 150,
            reactionEmotion: 'determined',
            nextSceneId: 'scene_3'
          }
        ]
      },
      {
        id: 'scene_3',
        speakerName: "Jeanne d'Arc",
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Which brings a question to mind. When you look at me as your Servant, what do you see? Most magi call upon spirits seeking legendary weapons or devastating sorcery. But I am neither a conqueror nor a mage.",
        choices: [
          {
            id: 'c3_option1',
            text: "I see a protector. Someone who stands firm no matter how terrifying the odds are.",
            response: "A protector... Yes. That is the calling I swore myself to. A banner cannot kill, but it can grant people the heart to stand firm against fear. Knowing you place that trust in my defense gives me immense strength.",
            bondExpGain: 150,
            reactionEmotion: 'determined',
            nextSceneId: 'scene_4'
          },
          {
            id: 'c3_option2',
            text: "Honestly? Just an eighteen-year-old girl bearing an impossible weight on her back.",
            response: "You... you see through the armor quite easily, don't you? Most people only look at the banner or the miracles. Hearing someone recognize simply the person underneath... it catches me off guard, but I am grateful.",
            bondExpGain: 175,
            reactionEmotion: 'flustered',
            nextSceneId: 'scene_4'
          },
          {
            id: 'c3_option3',
            text: "A living legend. A holy figure from the history books who led armies.",
            response: "The history books tend to polish the rough edges of reality. I was an illiterate country girl who answered a call she barely understood. If history remembers me as glorious, it is only because ordinary people fought bravely beside me.",
            bondExpGain: 125,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_4'
          }
        ]
      },
      {
        id: 'scene_4',
        speakerName: "Jeanne d'Arc",
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Speaking of the banner... Master, since you are not from a lineage of magi, you must have doubts about this ritual. Do you truly believe the Holy Grail will grant whatever wish you hold in your heart?",
        choices: [
          {
            id: 'c4_option1',
            text: "I haven't even thought about a wish. I'm just focused on surviving this.",
            response: "Survival is an honest, pure instinct. There is no shame in making that your priority. A wish means nothing if your soul is lost in the pursuit of it.",
            bondExpGain: 125,
            reactionEmotion: 'happy',
            nextSceneId: 'scene_5'
          },
          {
            id: 'c4_option2',
            text: "If it has limitless power, there must be a catch. Miracles usually come with a steep price.",
            response: "That is remarkably perceptive of you. The allure of an omnipotent wish frequently blinds both Master and Servant to the cost. Remaining wary of easy miracles will keep your spirit grounded.",
            bondExpGain: 150,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_5'
          },
          {
            id: 'c4_option3',
            text: "I do want something meaningful out of this, even if I haven't figured out what yet.",
            response: "To seek purpose through trial is human nature. Just promise me you will reflect carefully upon that desire. When blood is spilled in the name of a wish, the heart can easily forget why it began searching in the first place.",
            bondExpGain: 125,
            reactionEmotion: 'determined',
            nextSceneId: 'scene_5'
          }
        ]
      },
      {
        id: 'scene_5',
        speakerName: "Jeanne d'Arc",
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "For myself, as a Ruler summoned into this war, I possess no personal wish for the Holy Grail. My only duty is to ensure the boundary of the ritual is kept, and now, to guide and preserve your life through it. Does having a Servant without an ambition disappoint you?",
        choices: [
          {
            id: 'c5_option1',
            text: "Not at all. It means your judgment won't be blinded by greed.",
            response: "Clarity of mind is essential, especially when others lose themselves to ambition. If I remain unswayed by the prize, I can evaluate threats without hesitation or deceit.",
            bondExpGain: 150,
            reactionEmotion: 'happy',
            nextSceneId: 'scene_6'
          },
          {
            id: 'c5_option2',
            text: "A little bit. Won't a lack of desire make it hard to fight against ruthless enemies?",
            response: "A fair concern. But righteous conviction can be far stronger than personal greed. A warrior driven by hunger may break when the prize seems out of reach; one driven by duty will stand until the final breath.",
            bondExpGain: 125,
            reactionEmotion: 'determined',
            nextSceneId: 'scene_6'
          },
          {
            id: 'c5_option3',
            text: "It doesn't disappoint me, but it makes me wonder: what keeps you going then?",
            response: "What keeps me going? The simple desire to see goodness endure. To know that after the smoke clears, innocent people will wake to another quiet morning. That is reward enough for my spirit.",
            bondExpGain: 150,
            reactionEmotion: 'happy',
            nextSceneId: 'scene_6'
          }
        ]
      },
      {
        id: 'scene_6',
        speakerName: "Jeanne d'Arc",
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "You have seen the other Servants prowling the city borders tonight. The shadows are full of dangerous intent. When the moment comes where we must confront them directly, how do you wish for us to proceed as Master and Servant?",
        choices: [
          {
            id: 'c6_option1',
            text: "We take the defensive. We observe, gather information, and only strike if forced.",
            response: "A patient and wise strategy. In an unfamiliar war, recklessness is the swiftest path to defeat. We will study the lay of the land and protect the civilians first.",
            bondExpGain: 125,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_7'
          },
          {
            id: 'c6_option2',
            text: "We fight openly and honorably. No underhanded tricks or collateral damage.",
            response: "Spoken like a true knight at heart. Holding to honor in the midst of blood and sorcery is a painful path, but one I will proudly walk at your side.",
            bondExpGain: 150,
            reactionEmotion: 'determined',
            nextSceneId: 'scene_7'
          },
          {
            id: 'c6_option3',
            text: "I trust your tactical instincts completely, Jeanne. Lead the way in combat.",
            response: "Thank you for your confidence, Master. I will bear the tactical burden gladly, but do not forget: your command and your safety remain the core of every decision I make on the field.",
            bondExpGain: 150,
            reactionEmotion: 'happy',
            nextSceneId: 'scene_7'
          }
        ]
      },
      {
        id: 'scene_7',
        speakerName: "Jeanne d'Arc",
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "We have spoken long enough while standing in this cold wind. Look at you, your breath is turning to mist and your hands are shaking slightly. We should head back inside our hideout and prepare for the morning. What is the first thing you want to do once we step inside?",
        choices: [
          {
            id: 'c7_option1',
            text: "Let’s share a hot meal and go over the map of the city one more time.",
            response: "That sounds wonderful. Breaking bread together brings warmth back to weary bodies, and studying the district roads will give us an edge. I will help with the food if you show me how these modern stoves work!",
            bondExpGain: 150,
            reactionEmotion: 'happy'
          },
          {
            id: 'c7_option2',
            text: "Teach me something basic about command tactics so I’m not useless tomorrow.",
            response: "You are far from useless, but your desire to learn is commendable. I will teach you how to read enemy formations and how to pace your mana. A prepared Master is a surviving Master.",
            bondExpGain: 150,
            reactionEmotion: 'determined'
          },
          {
            id: 'c7_option3',
            text: "You should rest first, Jeanne. You’ve been standing watch for hours.",
            response: "Always looking out for me before yourself... Even as a Servant made of spiritual energy, your kindness reaches me. Let us return inside together, then. The war continues tomorrow, but tonight, we rest as comrades.",
            bondExpGain: 150,
            reactionEmotion: 'flustered'
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
  aoko_aozaki: AOKO_BOND_EVENTS,
  heracles_berserker: HERACLES_BOND_EVENTS,
  heracles: HERACLES_BOND_EVENTS,
  scathach_lancer: SCATHACH_BOND_EVENTS,
  scathach: SCATHACH_BOND_EVENTS,
  jeanne_darc_ruler: JEANNE_RULER_BOND_EVENTS,
  jeanne_ruler: JEANNE_RULER_BOND_EVENTS,
  jeanne_d_arc: JEANNE_RULER_BOND_EVENTS,
  jeanne: JEANNE_RULER_BOND_EVENTS
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
  ],
  heracles_berserker: [
    {
      id: 'heracles_summon',
      title: 'Summoning Pact',
      category: 'summon',
      requiredBondLevel: 1,
      quoteText: '■■■■■■■■■■! (The giant nods respectfully as the earth trembles beneath his feet).'
    },
    {
      id: 'heracles_bond_1',
      title: 'Bond 1: Morning Roars',
      category: 'bond_1',
      requiredBondLevel: 1,
      quoteText: '■■■■■■！！ *NOD.* ───GRAAAA! (Do you want the discounted meat?)'
    },
    {
      id: 'heracles_bond_3',
      title: 'Bond 3: Softie Underneath',
      category: 'bond_3',
      requiredBondLevel: 3,
      quoteText: '*Pat... pat.* ───Gwooh. (The Great Hero gently pats your head).'
    },
    {
      id: 'heracles_bond_5',
      title: 'Bond 5: Unyielding Loyalty',
      category: 'bond_5',
      requiredBondLevel: 5,
      quoteText: '───UOOOOOOOOHHHH! ■■■■■■■■■■ーーーッ！！'
    }
  ],
  heracles: [
    {
      id: 'heracles_summon',
      title: 'Summoning Pact',
      category: 'summon',
      requiredBondLevel: 1,
      quoteText: '■■■■■■■■■■! (The giant nods respectfully as the earth trembles beneath his feet).'
    },
    {
      id: 'heracles_bond_1',
      title: 'Bond 1: Morning Roars',
      category: 'bond_1',
      requiredBondLevel: 1,
      quoteText: '■■■■■■！！ *NOD.* ───GRAAAA! (Do you want the discounted meat?)'
    },
    {
      id: 'heracles_bond_3',
      title: 'Bond 3: Softie Underneath',
      category: 'bond_3',
      requiredBondLevel: 3,
      quoteText: '*Pat... pat.* ───Gwooh. (The Great Hero gently pats your head).'
    },
    {
      id: 'heracles_bond_5',
      title: 'Bond 5: Unyielding Loyalty',
      category: 'bond_5',
      requiredBondLevel: 5,
      quoteText: '───UOOOOOOOOHHHH! ■■■■■■■■■■ーーーッ！！'
    }
  ],
  scathach_lancer: [
    {
      id: 'scathach_summon',
      title: 'Summoning Pact',
      category: 'summon',
      requiredBondLevel: 1,
      quoteText: 'I am Scáthach. Show me that your spirit is worthy of walking beside a warrior of death.'
    },
    {
      id: 'scathach_bond_1',
      title: 'Bond 1: Queen of Dún Scáith',
      category: 'bond_1',
      requiredBondLevel: 1,
      quoteText: 'The night deepens, and the prana in the air grows turbulent. Tomorrow night, the hunt resumes—and I expect you to keep pace with the Queen of Dun Scáith.'
    },
    {
      id: 'scathach_bond_5',
      title: 'Bond 5: Mentor\'s Pride',
      category: 'bond_5',
      requiredBondLevel: 5,
      quoteText: 'A mentor’s pride is a stubborn poison that lingers long after the pupils have turned to dust.'
    }
  ],
  scathach: [
    {
      id: 'scathach_summon',
      title: 'Summoning Pact',
      category: 'summon',
      requiredBondLevel: 1,
      quoteText: 'I am Scáthach. Show me that your spirit is worthy of walking beside a warrior of death.'
    },
    {
      id: 'scathach_bond_1',
      title: 'Bond 1: Queen of Dún Scáith',
      category: 'bond_1',
      requiredBondLevel: 1,
      quoteText: 'The night deepens, and the prana in the air grows turbulent. Tomorrow night, the hunt resumes—and I expect you to keep pace with the Queen of Dun Scáith.'
    },
    {
      id: 'scathach_bond_5',
      title: 'Bond 5: Mentor\'s Pride',
      category: 'bond_5',
      requiredBondLevel: 5,
      quoteText: 'A mentor’s pride is a stubborn poison that lingers long after the pupils have turned to dust.'
    }
  ],
  jeanne_darc_ruler: [
    {
      id: 'jeanne_ruler_summon',
      title: 'Summoning Pact',
      category: 'summon',
      requiredBondLevel: 1,
      quoteText: 'Servant Ruler, Jeanne d\'Arc. The Holy Grail War requires an arbiter; I shall safeguard this pact.'
    },
    {
      id: 'jeanne_ruler_bond_line_1',
      title: 'Bond 1: Saint\'s Vigil',
      category: 'bond_1',
      requiredBondLevel: 1,
      quoteText: 'Even in the middle of a conflict like this, the town feels so peaceful when looking at it from up here. I will be your shield while you find your footing.'
    },
    {
      id: 'jeanne_ruler_bond_5',
      title: 'Bond 5: Holy Shield',
      category: 'bond_5',
      requiredBondLevel: 5,
      quoteText: 'Knowing you place that trust in my defense gives me immense strength. Together, we shall protect the innocent.'
    }
  ],
  jeanne_ruler: [
    {
      id: 'jeanne_ruler_summon',
      title: 'Summoning Pact',
      category: 'summon',
      requiredBondLevel: 1,
      quoteText: 'Servant Ruler, Jeanne d\'Arc. The Holy Grail War requires an arbiter; I shall safeguard this pact.'
    },
    {
      id: 'jeanne_ruler_bond_line_1',
      title: 'Bond 1: Saint\'s Vigil',
      category: 'bond_1',
      requiredBondLevel: 1,
      quoteText: 'Even in the middle of a conflict like this, the town feels so peaceful when looking at it from up here. I will be your shield while you find your footing.'
    }
  ],
  jeanne_d_arc: [
    {
      id: 'jeanne_ruler_summon',
      title: 'Summoning Pact',
      category: 'summon',
      requiredBondLevel: 1,
      quoteText: 'Servant Ruler, Jeanne d\'Arc. The Holy Grail War requires an arbiter; I shall safeguard this pact.'
    },
    {
      id: 'jeanne_ruler_bond_line_1',
      title: 'Bond 1: Saint\'s Vigil',
      category: 'bond_1',
      requiredBondLevel: 1,
      quoteText: 'Even in the middle of a conflict like this, the town feels so peaceful when looking at it from up here. I will be your shield while you find your footing.'
    }
  ],
  jeanne: [
    {
      id: 'jeanne_ruler_summon',
      title: 'Summoning Pact',
      category: 'summon',
      requiredBondLevel: 1,
      quoteText: 'Servant Ruler, Jeanne d\'Arc. The Holy Grail War requires an arbiter; I shall safeguard this pact.'
    },
    {
      id: 'jeanne_ruler_bond_line_1',
      title: 'Bond 1: Saint\'s Vigil',
      category: 'bond_1',
      requiredBondLevel: 1,
      quoteText: 'Even in the middle of a conflict like this, the town feels so peaceful when looking at it from up here. I will be your shield while you find your footing.'
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
