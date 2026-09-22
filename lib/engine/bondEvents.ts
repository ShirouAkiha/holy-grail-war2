import {
  BondEvent,
  BondScene,
  BondChoice,
  BondDialogueLine,
  MasterServantInstance,
  ServantTemplate,
  CraftEssence
} from '../types';
import { getBondCraftEssenceForServant, checkAndGrantBond10Ce, getAllBondCraftEssences } from '../../src/data/craftEssences';

export { getBondCraftEssenceForServant, checkAndGrantBond10Ce, getAllBondCraftEssences };
export type { BondEvent, BondScene, BondChoice, BondDialogueLine };

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
  unlockedBondCe?: CraftEssence;
} {
  const previousExp = servant.bondExp || 0;
  const newExp = previousExp + amount;

  const previousLevel = servant.bondLevel || getBondLevelFromExp(previousExp);
  const newLevel = getBondLevelFromExp(newExp);
  const didLevelUp = newLevel > previousLevel;

  let unlockedBondCe: CraftEssence | undefined;
  if (newLevel >= 10 && previousLevel < 10) {
    unlockedBondCe = getBondCraftEssenceForServant(
      servant.templateId || servant.template?.id || servant.id,
      servant.nickname || servant.template?.name
    );
  }

  const updatedServant: MasterServantInstance = {
    ...servant,
    bondExp: newExp,
    bondLevel: newLevel
  };

  return {
    updatedServant,
    previousLevel,
    newLevel,
    didLevelUp,
    unlockedBondCe
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

export const AMAMIYA_BOND_EVENTS: BondEvent[] = [
  {
    id: 'amamiya_bond_event_1',
    servantTemplateId: 'amamiya_no_chihaya_tenkohime',
    requiredBondLevel: 1,
    title: 'The Pink Divinity Demands Tofu',
    subtitle: 'Bond Level 1 Interlude • Ama-no-Miya Shrine & Tatami Residence',
    description: "Amamiya demands proper reverence for her divine name, frets over modern technology, panics over a tiny house spider, inspects a Roomba familiar, and enjoys fried tofu with Master.",
    rewardBondExp: 200,
    rewardSaintQuartz: 3,
    unlockedQuoteId: 'amamiya_bond_line_1',
    scenes: [
      {
        id: 'scene_1',
        speakerName: 'Amamiya',
        speakerAvatarUrl: 'https://ella.janitorai.com/media-approved/mskYeY2nC1pcPzEcW_nTK.webp',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Halt! State your business, Master. And do not dare shorten washi's divine name again! It is Amamiya no Chihaya Tenkohime! Say it properly or washi shall place a minor, inconvenient hex upon your left shoe!",
        choices: [
          {
            id: 'amamiya_b1_c1_a',
            text: "Good morning, Amamichi.",
            response: "Ignored! Completely ignored! The sheer insolence... though your polite greeting softens the blow slightly. Hmph!",
            bondExpGain: 100,
            reactionEmotion: 'flustered',
            nextSceneId: 'scene_2'
          },
          {
            id: 'amamiya_b1_c1_b',
            text: "That name is way too long for Discord, Fox Girl.",
            response: "Dis-koodo? What foul abyssal spell is that?! Do not rebrand a divine fox spirit like a cheap tavern stray!",
            bondExpGain: 100,
            reactionEmotion: 'amused',
            nextSceneId: 'scene_2'
          },
          {
            id: 'amamiya_b1_c1_c',
            text: "All hail Lady Amamiya no Chihaya Tenkohime!",
            response: "Fufu~! Now that is the proper reverence! Continue stroking washi's celestial ego and you might just survive this war!",
            bondExpGain: 150,
            reactionEmotion: 'smug',
            nextSceneId: 'scene_2'
          }
        ]
      },
      {
        id: 'scene_2',
        speakerName: 'Amamiya',
        speakerAvatarUrl: 'https://ella.janitorai.com/media-approved/mskYeY2nC1pcPzEcW_nTK.webp',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Regardless... this land is utterly baffling. The wooden shrines and tatami mats look just like home, yet you have giant glowing glass rectangles on the walls and magic horseless iron carriages everywhere. Tell washi the truth. Is this realm just Vargath with excessive electricity?",
        choices: [
          {
            id: 'amamiya_b1_c2_a',
            text: "It's just modern Japan. We don't have magic, just Wi-Fi.",
            response: "Wai-fai? Is that an invisible wind spirit? Can washi eat it? Does it taste like fried batter?",
            bondExpGain: 100,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_3'
          },
          {
            id: 'amamiya_b1_c2_b',
            text: "Actually, those metal carriages run on the souls of dead demons.",
            response: "Washi knew it! Those roaring metal beasts reek of black iron and suffering! Master, you summon washi into a nest of mad sorcerers!",
            bondExpGain: 125,
            reactionEmotion: 'flustered',
            nextSceneId: 'scene_3'
          },
          {
            id: 'amamiya_b1_c2_c',
            text: "You fit right in with the local Shinto aesthetic, honestly.",
            response: "Naturally! True elegance transcends dimensions! The mortals of this world clearly recognized perfection and copied washi's style.",
            bondExpGain: 150,
            reactionEmotion: 'happy',
            nextSceneId: 'scene_3'
          }
        ]
      },
      {
        id: 'scene_3',
        speakerName: 'Amamiya',
        speakerAvatarUrl: 'https://ella.janitorai.com/media-approved/mskYeY2nC1pcPzEcW_nTK.webp',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "So, this 'Holy Grail' we are fighting over... the Grail War information baked into washi's brain claims it grants any wish. Master, tell me straight: is the Grail just a massive, golden sake cup filled with infinite fried tofu?",
        choices: [
          {
            id: 'amamiya_b1_c3_a',
            text: "It's an omnipotent wishing cup made of pure mana.",
            response: "A wishing cup that doesn't default to food is a monumental waste of ancient metallurgy! Mortals always overcomplicate divine relics.",
            bondExpGain: 100,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_4'
          },
          {
            id: 'amamiya_b1_c3_b',
            text: "If you win, I will personally buy you a swimming pool of fried tofu.",
            response: "A... a whole pool?! S-Such extravagance! You aren't lying to washi, are you?! If you break this vow, washi will bite your kneecaps!",
            bondExpGain: 150,
            reactionEmotion: 'happy',
            nextSceneId: 'scene_4'
          },
          {
            id: 'amamiya_b1_c3_c',
            text: "No, it's a cursed relic that usually explodes in fire.",
            response: "Exploding cups?! Why must every legendary artifact in every universe be a ticking disaster?! Who is manufacturing these hazardous dishes?!",
            bondExpGain: 125,
            reactionEmotion: 'flustered',
            nextSceneId: 'scene_4'
          }
        ]
      },
      {
        id: 'scene_4',
        speakerName: 'Amamiya',
        speakerAvatarUrl: 'https://ella.janitorai.com/media-approved/mskYeY2nC1pcPzEcW_nTK.webp',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Speaking of funds for fried tofu... Master, your local currency is strange paper and tiny silver discs. Since washi is low on mortal coins, should washi brew a fresh batch of Kuchikamizake to sell to your wealthy nobles?",
        choices: [
          {
            id: 'amamiya_b1_c4_a',
            text: "Wait... you chew rice and spit it into a jar to make alcohol?!",
            response: "Of course! It is a sacred, ancient tradition! Washi hates the texture of raw mush, but rich eccentrics pay ridiculous sums for 'divine saliva vintage'!",
            bondExpGain: 100,
            reactionEmotion: 'flustered',
            nextSceneId: 'scene_5'
          },
          {
            id: 'amamiya_b1_c4_b',
            text: "That's actually a real ancient Japanese ritual, but please don't do that here.",
            response: "Hmph! Fine! Washi didn't want to chew cold grain anyway! My jaw cramps after the third bottle!",
            bondExpGain: 125,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_5'
          },
          {
            id: 'amamiya_b1_c4_c',
            text: "How much can we sell a jar for? Asking for tactical funding.",
            response: "Fufu~! An ambitious Master! Back in the mountains, desperate collectors traded entire chests of tea for a single jug! We could be rich!",
            bondExpGain: 150,
            reactionEmotion: 'amused',
            nextSceneId: 'scene_5'
          }
        ]
      },
      {
        id: 'scene_5',
        speakerName: 'Amamiya',
        speakerAvatarUrl: 'https://ella.janitorai.com/media-approved/mskYeY2nC1pcPzEcW_nTK.webp',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "E-EEEEK! MASTER! BEHIND YOU! ON THE WALL! A MULTI-LEGGED ABOMINATION FROM THE CRACKED ABYSS! PURGE IT! CAST THE STRONGEST COMMAND SEAL IMMEDIATELY!",
        choices: [
          {
            id: 'amamiya_b1_c5_a',
            text: "That's literally just a tiny house spider.",
            response: "A 'tiny' nightmare with too many eyes and zero manners! Washi does not negotiate with arachnid invaders! Slay it or washi is burning the house down!",
            bondExpGain: 100,
            reactionEmotion: 'flustered',
            nextSceneId: 'scene_6'
          },
          {
            id: 'amamiya_b1_c5_b',
            text: "Calm down, you're an ancient divine fox spirit!",
            response: "A divine spirit who despises dirt, venom, and creepy crawling things! Rank has nothing to do with basic sanitation! Slay it now!",
            bondExpGain: 125,
            reactionEmotion: 'flustered',
            nextSceneId: 'scene_6'
          },
          {
            id: 'amamiya_b1_c5_c',
            text: "TACTICAL RETREAT! ABANDON THE ROOM!",
            response: "A wise strategist! Evacuate! Seal the door with talismans and salt! We shall sleep on the roof until dawn!",
            bondExpGain: 150,
            reactionEmotion: 'determined',
            nextSceneId: 'scene_6'
          }
        ]
      },
      {
        id: 'scene_6',
        speakerName: 'Amamiya',
        speakerAvatarUrl: 'https://ella.janitorai.com/media-approved/mskYeY2nC1pcPzEcW_nTK.webp',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Haaaah... haaaah... crisis averted. Washi's divine heart nearly stopped. Now... explain that flat, round metal beast crawling slowly across your floor. It is humming with sinister intent. Is it an enemy familiar sent by an Assassin Servant?!",
        choices: [
          {
            id: 'amamiya_b1_c6_a',
            text: "That is a Roomba. It's an automated vacuum cleaner.",
            response: "Room-ba...? A mechanical homunculus dedicated entirely to swallowing floor crumbs? Mortals in this world are terrifyingly lazy geniuses.",
            bondExpGain: 100,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_7'
          },
          {
            id: 'amamiya_b1_c6_b',
            text: "Don't move, it hunts through vibrations in the tatami.",
            response: "Eeee?! Master, pick washi up! My geta are touching the ground! Do not let the floor-demon ingest washi's pristine white tabi socks!",
            bondExpGain: 150,
            reactionEmotion: 'flustered',
            nextSceneId: 'scene_7'
          },
          {
            id: 'amamiya_b1_c6_c',
            text: "It cleans the dust off the floor so you don't have to sweep.",
            response: "It sweeps automatically?! Incredible! Back at the shrine, washi spent centuries sweeping pine needles! Can washi ride atop its armored shell?!",
            bondExpGain: 150,
            reactionEmotion: 'happy',
            nextSceneId: 'scene_7'
          }
        ]
      },
      {
        id: 'scene_7',
        speakerName: 'Amamiya',
        speakerAvatarUrl: 'https://ella.janitorai.com/media-approved/mskYeY2nC1pcPzEcW_nTK.webp',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Fumu... Master, you brought back a plastic sack from that glowing roadside fortress called 'Seven-Eleven'. What is inside? If it is not food, washi will be profoundly sullen for the next three days.",
        choices: [
          {
            id: 'amamiya_b1_c7_a',
            text: "I bought you warm canned green tea and three packs of sweet Aburaage.",
            response: "*GASP!* T-The legendary fried golden sheets! And pure green tea without that repulsive cow milk?! Master... you are a genius among mortals! Give it here! Hand it over this instant!",
            bondExpGain: 150,
            reactionEmotion: 'happy',
            nextSceneId: 'scene_8'
          },
          {
            id: 'amamiya_b1_c7_b',
            text: "Just instant cup noodles and a bottle of iced milk tea.",
            response: "M-Milk tea?! Blasphemy! Cow juice belongs nowhere near sacred leaves! But... these curly dried noodles look intriguing. Teach washi the boiling ritual.",
            bondExpGain: 100,
            reactionEmotion: 'flustered',
            nextSceneId: 'scene_8'
          },
          {
            id: 'amamiya_b1_c7_c',
            text: "Energy drinks to prepare for our midnight scouting mission.",
            response: "Sour fizzy water?! Are you trying to corrode washi's stomach lining before we even encounter the Saber class?! Unacceptable!",
            bondExpGain: 100,
            reactionEmotion: 'amused',
            nextSceneId: 'scene_8'
          }
        ]
      },
      {
        id: 'scene_8',
        speakerName: 'Amamiya',
        speakerAvatarUrl: 'https://ella.janitorai.com/media-approved/mskYeY2nC1pcPzEcW_nTK.webp',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "*Nom nom nom... gulp.* Aaaah... divine bliss. This strange, metal-box world has its merits after all. Listen closely, Master. Washi has made an executive decision regarding our Holy Grail War strategy.",
        choices: [
          {
            id: 'amamiya_b1_c8_a',
            text: "What's the plan? Ambush enemy Masters at night?",
            response: "Far too loud! Too much running through mud! If washi gets dirt on this silk Chihaya robe, someone is losing a limb!",
            bondExpGain: 100,
            reactionEmotion: 'flustered',
            nextSceneId: 'scene_9'
          },
          {
            id: 'amamiya_b1_c8_b',
            text: "Secure ley lines around the city shrines?",
            response: "Hmph, ley lines are useful, but washi can barely find the way back from your local convenience market!",
            bondExpGain: 125,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_9'
          },
          {
            id: 'amamiya_b1_c8_c',
            text: "Let me guess: more fried tofu expeditions.",
            response: "Precisely! You read washi's brilliant strategic mind like an open scroll!",
            bondExpGain: 150,
            reactionEmotion: 'smug',
            nextSceneId: 'scene_9'
          }
        ]
      },
      {
        id: 'scene_9',
        speakerName: 'Amamiya',
        speakerAvatarUrl: 'https://ella.janitorai.com/media-approved/mskYeY2nC1pcPzEcW_nTK.webp',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "The contract stands firm: you provide this divine fox princess with daily fried tofu, zero spiders, and hot green tea. In exchange, washi will slice through any Servant who dares disturb our peaceful afternoon naps. Deal, Master?",
        choices: [
          {
            id: 'amamiya_b1_c9_a',
            text: "Deal. Welcome to the team, Amamiya.",
            response: "You dropped the title again... but the tofu was delicious, so washi shall forgive you just this once. Ehehe~!",
            bondExpGain: 125,
            reactionEmotion: 'happy'
          },
          {
            id: 'amamiya_b1_c9_b',
            text: "Deal, Lady Amamiya no Chihaya Tenkohime.",
            response: "Fufu~! Excellent! Your training as a proper royal retainer is coming along splendidly!",
            bondExpGain: 150,
            reactionEmotion: 'smug'
          },
          {
            id: 'amamiya_b1_c9_c',
            text: "Only if you promise not to spit rice wine in my living room.",
            response: "M-Mou! Washi already promised! Stop bringing up the sacred spit brew, you insufferable mortal!",
            bondExpGain: 125,
            reactionEmotion: 'flustered'
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

export const NERO_BOND_EVENTS: BondEvent[] = [
  {
    id: 'nero_bond_event_1',
    servantTemplateId: 'nero_claudius_saber',
    requiredBondLevel: 1,
    title: 'The Emperor of Roses & The Golden Theater',
    subtitle: 'Bond Level 1 Interlude • Domus Aurea Prelude',
    description: 'An evening audience with Nero Claudius regarding Roman grandeur, the Far Eastern skyline, her legendary singing, and your blooming contract.',
    rewardBondExp: 150,
    rewardSaintQuartz: 3,
    unlockedQuoteId: 'nero_bond_line_1',
    scenes: [
      {
        id: 'scene_1',
        speakerName: 'Nero Claudius',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Umu! Tell me, Praetor. How fares the view from your side of the room? Splendid, is it not?",
        choices: [
          {
            id: 'c1a',
            text: "It's nice, but aren't you a bit cold in that dress?",
            response: "Cold? An Emperor of Rome feels only the blazing warmth of passion! Besides, concealing such perfection from you would be the true crime.",
            bondExpGain: 100,
            reactionEmotion: 'happy',
            nextSceneId: 'scene_2'
          },
          {
            id: 'c1b',
            text: "The view of the Japanese skyline is great, yeah.",
            response: "The skyline? Hmph, these eastern towers of steel and glass are fine, but they lack the glorious soul of marble! Still, your appreciation shows taste.",
            bondExpGain: 100,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_2'
          },
          {
            id: 'c1c',
            text: "I can barely look away from you, honestly.",
            response: "Umu, umu! Naturally! A truthful subject is a joy to behold. You possess an exquisite eye for art, Master!",
            bondExpGain: 150,
            reactionEmotion: 'smug',
            nextSceneId: 'scene_2'
          }
        ]
      },
      {
        id: 'scene_2',
        speakerName: 'Nero Claudius',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Still, this Far Eastern land is peculiar. No grand colosseums, no triumphant parades in the streets... Tell me, how do the people here celebrate greatness?",
        choices: [
          {
            id: 'c2a',
            text: "Usually festivals, fireworks, and good food.",
            response: "Fireworks and banquets! Now that sounds worthy of an empire. We must partake in one at once!",
            bondExpGain: 150,
            reactionEmotion: 'happy',
            nextSceneId: 'scene_3'
          },
          {
            id: 'c2b',
            text: "Quietly. People here tend to avoid drawing attention to themselves.",
            response: "Avoid attention?! Madness! What is the purpose of existing if you do not shine bright enough to blind the heavens?",
            bondExpGain: 100,
            reactionEmotion: 'flustered',
            nextSceneId: 'scene_3'
          },
          {
            id: 'c2c',
            text: "Through concerts and stage plays, mostly.",
            response: "The stage! Ah, the muse sings to me! A culture of performers is a culture that can truly grasp my brilliance.",
            bondExpGain: 150,
            reactionEmotion: 'happy',
            nextSceneId: 'scene_3'
          }
        ]
      },
      {
        id: 'scene_3',
        speakerName: 'Nero Claudius',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Which brings me to a vital matter. Since fate has bound our contracts together in this conflict, what do you think of my singing?",
        choices: [
          {
            id: 'c3a',
            text: "I haven't heard it yet, but I'm sure it's powerful.",
            response: "Powerful? It is a tempest! A divine chorus that brings entire arenas to their knees with tears of awe!",
            bondExpGain: 125,
            reactionEmotion: 'happy',
            nextSceneId: 'scene_4'
          },
          {
            id: 'c3b',
            text: "I've heard... rumors that your singing can level buildings.",
            response: "Slander spread by the jealous Senate! The deaf cannot comprehend high art, Master!",
            bondExpGain: 100,
            reactionEmotion: 'flustered',
            nextSceneId: 'scene_4'
          },
          {
            id: 'c3c',
            text: "Only if you promise not to shatter every window in the city.",
            response: "Glass? Glass is fragile, but art is eternal! Though, for your sake, I shall restrain my grandest crescendo to an indoor hum.",
            bondExpGain: 150,
            reactionEmotion: 'amused',
            nextSceneId: 'scene_4'
          }
        ]
      },
      {
        id: 'scene_4',
        speakerName: 'Nero Claudius',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Umu... Tch. Ah, forgive me. A minor nuisance. Just a dull ache behind my eyes. Pay it no mind.",
        choices: [
          {
            id: 'c4a',
            text: "Are you alright? Do you need magical energy?",
            response: "Your mana is warm and welcome, but this is merely an old acquaintance of mine. A stubborn guest from my mortal days.",
            bondExpGain: 125,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_5'
          },
          {
            id: 'c4b',
            text: "Sit down for a moment. You look pale.",
            response: "Pale? An empress does not look pale! But... if my Master insists with such concern, I shall rest upon this chair.",
            bondExpGain: 125,
            reactionEmotion: 'flustered',
            nextSceneId: 'scene_5'
          },
          {
            id: 'c4c',
            text: "Is it a curse from an enemy Servant?",
            response: "No coward of an assassin could slip past my blade! It is simply a lingering poison of the past. A persistent headache.",
            bondExpGain: 100,
            reactionEmotion: 'determined',
            nextSceneId: 'scene_5'
          }
        ]
      },
      {
        id: 'scene_5',
        speakerName: 'Nero Claudius',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "In Rome, my own mother favored belladonna in my tea. Treachery everywhere I turned. Even Seneca... ah, but why sour our evening with old ghosts?",
        choices: [
          {
            id: 'c5a',
            text: "You don't have to carry that alone anymore. I'm here.",
            response: "...You say such things with an earnest face. Take care, Praetor, or I might actually rely on your kindness.",
            bondExpGain: 150,
            reactionEmotion: 'happy',
            nextSceneId: 'scene_6'
          },
          {
            id: 'c5b',
            text: "Must have been exhausting, never being able to trust anyone.",
            response: "It was suffocating. I gave them love, triumphs, and gold... yet they responded with venom and whispers.",
            bondExpGain: 100,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_6'
          },
          {
            id: 'c5c',
            text: "You survived it all, though. That takes incredible strength.",
            response: "Umu! Of course! I am the Emperor of Roses! Even the grave could not keep me quiet for long.",
            bondExpGain: 150,
            reactionEmotion: 'happy',
            nextSceneId: 'scene_6'
          }
        ]
      },
      {
        id: 'scene_6',
        speakerName: 'Nero Claudius',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Tell me, Master. In this Holy Grail War, with death lurking behind every shadow... what drives you forward?",
        choices: [
          {
            id: 'c6a',
            text: "I just want to survive and make it home in one piece.",
            response: "An honest, humble wish! Fear not, for my crimson blade shall carve our path out of the mire.",
            bondExpGain: 100,
            reactionEmotion: 'determined',
            nextSceneId: 'scene_7'
          },
          {
            id: 'c6b',
            text: "I want to see you claim victory on the greatest stage.",
            response: "Hahaha! Splendid! An answer truly worthy of my retainer! Together, our curtain call will be magnificent!",
            bondExpGain: 150,
            reactionEmotion: 'happy',
            nextSceneId: 'scene_7'
          },
          {
            id: 'c6c',
            text: "I have a wish I can't give up on.",
            response: "A burning ambition! That is the spark of a true hero. Keep that flame fed, and I shall provide the winds to make it roar.",
            bondExpGain: 125,
            reactionEmotion: 'determined',
            nextSceneId: 'scene_7'
          }
        ]
      },
      {
        id: 'scene_7',
        speakerName: 'Nero Claudius',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Whatever the reason, we are a pair now. Tell me, Praetor—do you feel our bond growing stronger?",
        choices: [
          {
            id: 'c7a',
            text: "Definitely. I trust you completely.",
            response: "Then my theater shall never fall! When you believe in me, my sword knows no limits.",
            bondExpGain: 150,
            reactionEmotion: 'happy',
            nextSceneId: 'scene_8'
          },
          {
            id: 'c7b',
            text: "We're getting there, step by step.",
            response: "A steady march! Rome was not built in a day, after all!",
            bondExpGain: 100,
            reactionEmotion: 'amused',
            nextSceneId: 'scene_8'
          },
          {
            id: 'c7c',
            text: "As long as you let me hold the controller sometimes.",
            response: "A bold jester, aren't you? Very well, you may steer our chariot, but the glory remains mine!",
            bondExpGain: 125,
            reactionEmotion: 'smug',
            nextSceneId: 'scene_8'
          }
        ]
      },
      {
        id: 'scene_8',
        speakerName: 'Nero Claudius',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Rest now, Praetor. Tomorrow the stage calls for blood and steel, but tonight, your Emperor watches over you."
      }
    ]
  }
];

export const LUCIA_BOND_EVENTS: BondEvent[] = [
  {
    id: 'lucia_bond_event_1',
    servantTemplateId: 'lucia_lyozes',
    requiredBondLevel: 1,
    title: 'The Outsider and the Black Iron',
    subtitle: 'Flour, iron pans, and an S-Rank Lancer',
    description: 'Summoned amidst scorched kitchen tiles and flour, Lucernalia Lyozes pins her unexpected Master under a black iron spear to determine whether you are a cataclysm or a casualty.',
    rewardBondExp: 350,
    rewardSaintQuartz: 3,
    unlockedQuoteId: 'lucia_bond_1',
    scenes: [
      {
        id: 'scene_1',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Do not move. Do not draw breath deeper than necessary. If your fingers twitch toward a focus, a catalyst, or a weapon, this black iron will pierce your throat before your mind registers the intent."
      },
      {
        id: 'scene_2',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "The artifact that forced its way into my consciousness calls itself the Holy Grail. It filled my mind with the concepts of this land, its language, and the nature of this rite. But it did not prepare me for the audacity of its architects. A human realm. A modern city untouched by mana. And you, sitting amidst flour and iron pans, bearing the crimson brand of a Master."
      },
      {
        id: 'scene_3',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Speak. Slowly. Who authorized this summoning, and what catastrophic purpose brought you to pluck a warrior from Lyozes?",
        choices: [
          {
            id: 'c1_a',
            text: "I work here. The light just exploded out of the floor.",
            response: "A mundane worker? You insult my intelligence. The ritual required an anchor, an incantation, and a reserve of life force. You sit upon scorched tiles with three Command Seals carved into your flesh, claiming coincidence?",
            bondExpGain: 50,
            reactionEmotion: 'stern',
            nextSceneId: 'scene_4'
          },
          {
            id: 'c1_b',
            text: "Lower the spear first. My brother is asleep in the back.",
            response: "A hostage already? Or a shield? Do not invoke family to disarm a veteran of war. If an innocent sleeps behind that door, you should have considered the consequences before meddling with planar displacement.",
            bondExpGain: 50,
            reactionEmotion: 'stern',
            nextSceneId: 'scene_4'
          },
          {
            id: 'c1_c',
            text: "I didn't authorize anything. I don't even know what Lyozes is.",
            response: "Ignorance is the universal defense of fools and saboteurs alike. If you truly do not know my homeland, then you are a blind child holding the fuse to a keg of black powder.",
            bondExpGain: 50,
            reactionEmotion: 'stern',
            nextSceneId: 'scene_4'
          }
        ]
      },
      {
        id: 'scene_4',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Look at your right hand. That geometric scar is not birthmark or ink. It is a conduit. It tethers my spiritual vessel to your fragile, fleeting mortal frame. In my world, anyone attempting to drag an entity across dimensions is executed on sight under Elven Imperial decree. Article Fourteen, Section Nine: 'Any confirmed Otherworlder shall be immediately terminated to preserve the natural order.'"
      },
      {
        id: 'scene_5',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Now, the roles have inverted. I am the outsider in your world. And my instincts tell me the quickest way to sever this dangerous, unnatural link is to slit your throat right here on this tile.",
        choices: [
          {
            id: 'c2_a',
            text: "If you kill me, doesn't your tether to this world snap with it?",
            response: "The Grail's doctrine states an unanchored Servant fades without prana. Correct. But fading into nonexistence is far preferable to being enslaved as an instrument of mass slaughter for an unknown mortal's ambition.",
            bondExpGain: 50,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_6'
          },
          {
            id: 'c2_b',
            text: "Do what you have to. But keep it quiet.",
            response: "You speak of death as though it were a routine inspection. That indifference is not courage; it is the callousness of someone who has abandoned self-preservation. That makes you far more dangerous than a frightened child.",
            bondExpGain: 50,
            reactionEmotion: 'stern',
            nextSceneId: 'scene_6'
          },
          {
            id: 'c2_c',
            text: "I have twelve thousand yen in the register and half a shift left. I'm not playing God.",
            response: "Gold, currency, mundane labor... You recite the grievances of an ordinary peasant while holding the leash to an S-Rank vanguard. Is this an act? Did the Grail match me with an actor?",
            bondExpGain: 50,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_6'
          }
        ]
      },
      {
        id: 'scene_6',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Two centuries ago, an Otherworlder entered Lyozes. He spoke of our world as though it were a game, a stage built purely for his entertainment. He possessed no reverence for life, no fear of consequence. When contested, he detonated mana cores beneath our greatest cities, turning sovereign lands into ash and burying thousands of families in a single breath."
      },
      {
        id: 'scene_7',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "That Calamity began exactly like this. With a single, unchecked human believing that possessing absolute power granted him the right to reshape reality. Now this 'Holy Grail' promises a wish. A miracle that grants any desire at the cost of blood. Tell me, human... what grand, world-ending delusion were you planning to enact with that cup?",
        choices: [
          {
            id: 'c3_a',
            text: "I want my brother to finish middle school without starving. That's it.",
            response: "A brother's education. Such a small, domestic justification for summoning a weapon of ruin. Do you know how many tyrants began their crusade claiming they only wished to secure a warm meal for their kin?",
            bondExpGain: 50,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_8'
          },
          {
            id: 'c3_b',
            text: "I don't believe in wishes. Magic doesn't pay the rent.",
            response: "A pragmatist's answer. Or a coward's deflection. Magic does not pay rent, no, but it levels mountains when wielded by the desperate.",
            bondExpGain: 50,
            reactionEmotion: 'stern',
            nextSceneId: 'scene_8'
          },
          {
            id: 'c3_c',
            text: "If that cup requires killing people, smash it.",
            response: "'Smash it.' As if an omnipotent convergence of leylines can simply be broken over one's knee like a dry branch. Your flippancy borders on insolence.",
            bondExpGain: 50,
            reactionEmotion: 'stern',
            nextSceneId: 'scene_8'
          }
        ]
      },
      {
        id: 'scene_8',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Extend your arm. Slowly. Let me appraise your Aethel."
      },
      {
        id: 'scene_9',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "..."
      },
      {
        id: 'scene_10',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Barren. There are no refined pathways in this body. No martial density in your marrow. No formal defensive wards layered over your vital organs. You possess only the faint, stagnant flicker of an ordinary mortal life force, completely untrained, barely sustaining your own heartbeat."
      },
      {
        id: 'scene_11',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Either you are the most profoundly subtle spy to ever stand before me, completely masking an S-Rank presence behind a fabricated husk... or the Grail has committed a grotesque clerical error.",
        choices: [
          {
            id: 'c4_a',
            text: "My parents died four years ago. I haven't had time for 'subtlety'.",
            response: "...I have watched an entire nation burn because one girl refused to let go of a tombstone.",
            bondExpGain: 50,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_12'
          },
          {
            id: 'c4_b',
            text: "I barely manage twelve-hour kitchen shifts. I can't even throw a punch.",
            response: "You confess weakness with the ease of someone who has swallowed their pride long ago. In the Wailing Tower, men fight to display strength. You brandish your exhaustion like an unpolished buckler...",
            bondExpGain: 50,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_12'
          },
          {
            id: 'c4_c',
            text: "If I'm useless to you, can you leave before morning prep starts?",
            response: "You still do not grasp the gravity of this room. The barrier between life and death is resting entirely on the pressure of my lance tip against your collarbone, and you speak of morning preparations.",
            bondExpGain: 50,
            reactionEmotion: 'stern',
            nextSceneId: 'scene_12'
          }
        ]
      },
      {
        id: 'scene_12',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Hear me clearly. If this war is real, six other entities like myself exist in this city right now. Warriors whose legends are carved from slaughter, commanded by magi who will not hesitate to flay your mind to claim those Command Seals. If they locate this building, your 'restaurant' will cease to exist within seconds."
      },
      {
        id: 'scene_13',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Your life is already forfeit. The moment that sigil burned into your skin, you ceased being a civilian. You became a target.",
        choices: [
          {
            id: 'c5_a',
            text: "Then tell me what to do so the building doesn't burn.",
            response: "Obedience is a good start. But I do not need a servant; I need a Master who will not falter when steel begins to shatter bone.",
            bondExpGain: 50,
            reactionEmotion: 'determined',
            nextSceneId: 'scene_14'
          },
          {
            id: 'c5_b',
            text: "I survived four years without magic. I'll figure it out.",
            response: "Arrogance. Surviving poverty in a peaceful city does not prepare you for a phantom cleaving your ribs before you can blink.",
            bondExpGain: 50,
            reactionEmotion: 'stern',
            nextSceneId: 'scene_14'
          },
          {
            id: 'c5_c',
            text: "Take the marks off my hand. Give them to someone else.",
            response: "They cannot be peeled away like parchment without severing the limb or the soul beneath it. The rite binds us until one of us falls.",
            bondExpGain: 50,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_14'
          }
        ]
      },
      {
        id: 'scene_14',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "I am Lucernalia Lyozes. I am the lance that protects my vanguard, and I am the wall that prevents reckless fools from destroying the world in the name of salvation."
      },
      {
        id: 'scene_15',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "I will not kneel to you. I will not call you 'Master.' And the very second I detect a whisper of ambition—the moment you look upon that Holy Grail with the greed of Kael Rylan or the zealotry of an Orecanian priest—I will drive this blade through your heart and accept my own dissolution."
      },
      {
        id: 'scene_16',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Until then... your survival serves as my only window into this strange, fragile world. Keep your head down, speak only when questioned, and do not dare give me a reason to finish what this summoning began."
      }
    ]
  },
  {
    id: 'lucia_bond_event_2',
    servantTemplateId: 'lucia_lyozes',
    requiredBondLevel: 2,
    title: 'Basic Logistics and Morning Broth',
    subtitle: 'Warm broth, a cold cupboard, and unyielding eyes',
    description: 'The morning after the summoning, Lucia takes stock of your cramped apartment, prepares a frugal breakfast, and observes the quiet survival instincts of you and your brother.',
    rewardBondExp: 500,
    rewardSaintQuartz: 3,
    unlockedQuoteId: 'lucia_bond_2',
    scenes: [
      {
        id: 'b2_scene_1',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Sit down. The rice is warm, and the broth has already settled."
      },
      {
        id: 'b2_scene_2',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "You slept past dawn. In a fortress under siege, an officer who fails to wake at first light is relieved of command. In this cramped box of an apartment, it simply meant the fledgling in the other room began rummaging through cold cupboards thirty minutes before your eyes opened."
      },
      {
        id: 'b2_scene_3',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "I told you last night: do not make sudden moves. Take the chair, pick up the utensils, and eat.",
        choices: [
          {
            id: 'b2_c1_a',
            text: "You... cooked? I thought you were going to kill me.",
            response: "A corpse does not provide an anchor for a Servant, and a starving Master is a liability. Do not flatter yourself into believing this is an offering of peace. It is basic logistics.",
            bondExpGain: 50,
            reactionEmotion: 'stern',
            nextSceneId: 'b2_scene_4'
          },
          {
            id: 'b2_c1_b',
            text: "Sorry. Last night didn't leave much room for sleep.",
            response: "An explanation, not an excuse. Fatigue is the premier killer of sentries. If you collapse before midday, your defense folds before an enemy even draws steel.",
            bondExpGain: 50,
            reactionEmotion: 'stern',
            nextSceneId: 'b2_scene_4'
          },
          {
            id: 'b2_c1_c',
            text: "Did you put anything weird in that? Magic herbs, or...",
            response: "If I wished to end your pulse, I would not waste salt and dried kelp to mask the deed. A clean thrust through the sternum requires neither oil nor flame.",
            bondExpGain: 50,
            reactionEmotion: 'smug',
            nextSceneId: 'b2_scene_4'
          }
        ]
      },
      {
        id: 'b2_scene_4',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Your hearth is absurdly small. The cold-box humming against the wall had barely three eggs and a wedge of cured radish. No dried meat, no root vegetables preserved in salt, not even a single ward against pests. For a mortal managing a household, your supply cache borders on criminal negligence."
      },
      {
        id: 'b2_scene_5',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Yet the tools are spotless. The knives are honed to an acceptable edge, and the cast iron holds no rust. Someone in this dwelling understands upkeep, even if your pantry looks like a refugee camp in winter.",
        choices: [
          {
            id: 'b2_c2_a',
            text: "He didn't scream when he saw your ears?",
            response: "He stared. Then he asked if I was a foreigner from the television. I told him I was a traveler indebted for shelter. He accepted the answer without another syllable, bowed his head, and waited until a bowl was placed before him.",
            bondExpGain: 50,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'b2_scene_6'
          },
          {
            id: 'b2_c2_b',
            text: "I try to keep the knives sharp. They were my father's.",
            response: "Inherited iron. Keep it dry and oiled. It is the only sensible thing I have encountered in this entire wretched province so far.",
            bondExpGain: 50,
            reactionEmotion: 'determined',
            nextSceneId: 'b2_scene_6'
          },
          {
            id: 'b2_c2_c',
            text: "Is he eating okay? He usually won't touch food if a stranger is near.",
            response: "He took the bowl with two hands, spoke a quiet phrase of gratitude to the empty air, and began chewing. He ate as though he was frightened the portion might vanish if he paused to breathe.",
            bondExpGain: 50,
            reactionEmotion: 'stern',
            nextSceneId: 'b2_scene_6'
          }
        ]
      },
      {
        id: 'b2_scene_6',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "That behavior is not natural for a cub his size."
      },
      {
        id: 'b2_scene_7',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "In the royal gardens of Sylvanryth, or even among the rowdy litters of the demi-human tribes across the Grand Way, fledglings shout. They spill milk. They demand attention, cause disaster, and test the patience of their elders until an ear is pulled."
      },
      {
        id: 'b2_scene_8',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Your brother did none of that. He sat upright. He adjusted his sleeves to avoid the soup. He watched my hands as I chopped scallions, not with curiosity, but with the quiet vigilance of a stray hound that has learned heavy footsteps usually mean a boot to the ribs.",
        choices: [
          {
            id: 'b2_c3_a',
            text: "He was six when the hospital called. He had to learn to be quiet.",
            response: "A sickness. The great leveler of short-lived races. Even without dungeon curses or stray arrows, your fragile bodies find a thousand mundane ways to fail before a century passes.",
            bondExpGain: 50,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'b2_scene_9'
          },
          {
            id: 'b2_c3_b',
            text: "He's just well-mannered. Don't read too much into it.",
            response: "Do not lie to a commander who has buried two generations of soldiers. Manners are taught through grace. That silence was carved by necessity.",
            bondExpGain: 50,
            reactionEmotion: 'stern',
            nextSceneId: 'b2_scene_9'
          },
          {
            id: 'b2_c3_c',
            text: "When money is tight, kids figure out how to take up less space.",
            response: "Taking up less space... What a cowardly, miserable lesson to beat into a fledgling before his bones have even hardened.",
            bondExpGain: 50,
            reactionEmotion: 'angry',
            nextSceneId: 'b2_scene_9'
          }
        ]
      },
      {
        id: 'b2_scene_9',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "And look at you."
      },
      {
        id: 'b2_scene_10',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "You sit there with your hair uncombed, bags heavy beneath your eyes, wearing an apron that has been stitched and re-stitched at the hem with mismatched thread. You carry yourself like an old veteran who has spent ten winters in the trenches."
      },
      {
        id: 'b2_scene_11',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "The Grail dumped the timeline of your life into my mind alongside your city's geography. You have seen barely nineteen cycles of the sun. In elven reckoning, you are not even old enough to choose your own bow, let alone speak before a town council."
      },
      {
        id: 'b2_scene_12',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "You are a child pretending to be a pillar. And the structure beneath you is already groaning under the weight.",
        choices: [
          {
            id: 'b2_c4_a',
            text: "Nineteen is an adult here. I pay the taxes.",
            response: "Taxes. Paper documents. Arbitrary numbers stamped onto copper and tin. This world invents such elaborate, bloodless chains to choke its youth into submission.",
            bondExpGain: 50,
            reactionEmotion: 'stern',
            nextSceneId: 'b2_scene_13'
          },
          {
            id: 'b2_c4_b',
            text: "If I collapse, who feeds him? You?",
            response: "...A sharp retort. You possess teeth after all. Keep that fire; you will need it when the enemy Servants arrive to test whether that neck can hold its ground.",
            bondExpGain: 50,
            reactionEmotion: 'determined',
            nextSceneId: 'b2_scene_13'
          },
          {
            id: 'b2_c4_c',
            text: "Call me whatever you want. The rice is good, so thanks.",
            response: "Eat, then. Stop staring at the grain and finish it before it turns cold.",
            bondExpGain: 50,
            reactionEmotion: 'amused',
            nextSceneId: 'b2_scene_13'
          }
        ]
      },
      {
        id: 'b2_scene_13',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Do not mistake this for affection."
      },
      {
        id: 'b2_scene_14',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "I despise this summoning. I despise the foreign voices echoing in the leylines beneath this asphalt, and I despise the fact that an unseen war has dragged my lance into a mortal kitchen. If a master mage stands behind this Grail, their arrogance disgusts me just as deeply as Kael Rylan's ever did."
      },
      {
        id: 'b2_scene_15',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "If I find that you orchestrated even a fraction of this—if that boy is an actor and this poverty is a stage set to soften an elven heart—my judgment from last night remains absolute.",
        choices: [
          {
            id: 'b2_c5_a',
            text: "I understand. Until then, stay out of sight while I work.",
            response: "I am a Servant. Spirit form will suffice to keep your customers from fainting at the sight of elven plate. But do not wander far from my lance's perimeter.",
            bondExpGain: 50,
            reactionEmotion: 'determined',
            nextSceneId: 'b2_scene_16'
          },
          {
            id: 'b2_c5_b',
            text: "There's an extra bowl in the pot. You need mana, right?",
            response: "...Hmph. Offering food to a warrior who had a spear at your throat six hours ago. Either your courage is legendary, or your instinct for survival is hopelessly defective.",
            bondExpGain: 50,
            reactionEmotion: 'amused',
            nextSceneId: 'b2_scene_16'
          },
          {
            id: 'b2_c5_c',
            text: "I don't have time to stage a play. The lunch rush starts at eleven.",
            response: "'Lunch rush.' The sky could tear open with Abyssal fire, and you would still fret over boiling noodles on schedule. Sit and finish your broth, fool. I will watch the door.",
            bondExpGain: 50,
            reactionEmotion: 'stern',
            nextSceneId: 'b2_scene_16'
          }
        ]
      },
      {
        id: 'b2_scene_16',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Eat your breakfast, Master. We have a war to endure, and I will not march beside a soldier whose hands tremble from skipping a meal."
      }
    ]
  },
  {
    id: 'lucia_bond_event_3',
    servantTemplateId: 'lucia_lyozes',
    requiredBondLevel: 3,
    title: 'Tactical Positioning on Asphalt',
    subtitle: 'Narrow alleys, distant sirens, and five seconds of clairvoyance',
    description: 'During a midnight patrol across the commercial district, Lucia analyzes the city\'s concrete layout and tests your battlefield footwork.',
    rewardBondExp: 750,
    rewardSaintQuartz: 3,
    unlockedQuoteId: 'lucia_bond_3',
    scenes: [
      {
        id: 'b3_scene_1',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Three meters behind me. Not two, not four. If an Archer releases from that rooftop, three meters gives me the arc to deflect the projectile without clipping your shoulder on the follow-through."
      },
      {
        id: 'b3_scene_2',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "This city is an absurd maze of hard angles. In Sylvanryth, trees yield to momentum and earth muffles sound. Here, every step echoes against glass and brick, and your electrical cables hum loud enough to drown out subtle mana fluctuations."
      },
      {
        id: 'b3_scene_3',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Tell me, Master: if two shadows emerge from that intersection ahead, where is your escape vector?",
        choices: [
          {
            id: 'b3_c1_a',
            text: "Back into the 24-hour convenience store to break line-of-sight.",
            response: "Glass walls and a single rear exit. You would turn yourself into trapped game in a illuminated pen. Think with your terrain, not your comfort.",
            bondExpGain: 75,
            reactionEmotion: 'stern',
            nextSceneId: 'b3_scene_4'
          },
          {
            id: 'b3_c1_b',
            text: "Up the steel fire escape to the adjacent low roof.",
            response: "Elevation with multiple drop points into the alley network. Better. You are beginning to look beyond the ground beneath your boots.",
            bondExpGain: 75,
            reactionEmotion: 'determined',
            nextSceneId: 'b3_scene_4'
          },
          {
            id: 'b3_c1_c',
            text: "I stay behind the Black Lance and let you spearhead.",
            response: "...Pragmatic. But a vanguard requires an anchor that does not panic. If I push forward, your eyes must cover my flank.",
            bondExpGain: 75,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'b3_scene_4'
          }
        ]
      },
      {
        id: 'b3_scene_4',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "My eyes see five seconds into causality. When steel clashes, I know where the sparks will die before the blade leaves its scabbard."
      },
      {
        id: 'b3_scene_5',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Yet foresight is worthless if the soldier beside me freezes in hesitation. When I shout 'left', you move left. No questioning, no turning your head to verify. Can you promise that discipline?",
        choices: [
          {
            id: 'b3_c2_a',
            text: "I trust your eyes. When you call the move, I execute.",
            response: "Good. A vanguard that acts as one mind can hold against a thousand irregulars.",
            bondExpGain: 75,
            reactionEmotion: 'determined',
            nextSceneId: 'b3_scene_6'
          },
          {
            id: 'b3_c2_b',
            text: "As long as you promise not to jump into suicide plays.",
            response: "I do not seek martyrdom. I have a party waiting for my return, and a promise carved into black iron.",
            bondExpGain: 75,
            reactionEmotion: 'stern',
            nextSceneId: 'b3_scene_6'
          }
        ]
      },
      {
        id: 'b3_scene_6',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "The patrol is complete for tonight. Back to the apartment. You have three hours of sleep before your kitchen shift begins, and I will stand guard at the window."
      }
    ]
  },
  {
    id: 'lucia_bond_event_4',
    servantTemplateId: 'lucia_lyozes',
    requiredBondLevel: 4,
    title: 'Echoes of the Wailing Tower',
    subtitle: 'The shadow of Kael Rylan and the weight of surviving',
    description: 'Under the dim light of your kitchen counter, Lucia shares the truth of the Last Calamity that devastated her world.',
    rewardBondExp: 1000,
    rewardSaintQuartz: 3,
    unlockedQuoteId: 'lucia_bond_4',
    scenes: [
      {
        id: 'b4_scene_1',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Why are you still awake? The fledgling fell asleep two hours ago, and your ledgers are closed."
      },
      {
        id: 'b4_scene_2',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "You asked earlier why I despise the word 'miracle.' Why I looked at your Command Seals with such venom when I first manifested on that worn rug."
      },
      {
        id: 'b4_scene_3',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Two hundred years ago, a boy arrived in our world. He claimed he was chosen by higher beings, blessed with cheat skills, infinite mana, and an absolute mandate to 'save' us from hardship."
      },
      {
        id: 'b4_scene_4',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "His name was Kael Rylan. Kings bowed to his power, sages praised his effortless magic, and an entire continent cheered as he dismantled ancient borders in the name of progress."
      },
      {
        id: 'b4_scene_5',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "And when his cheat abilities ruptured the tectonic core of the Wailing Tower... half of Sylvanryth burned to ash in a single night. He vanished back to his own realm, untouched, leaving us to bury ten thousand children in the soot.",
        choices: [
          {
            id: 'b4_c1_a',
            text: "That wasn't a hero. That was an irresponsible child playing god.",
            response: "Exactly. He treated our centuries of history as a game stage made for his personal gratification.",
            bondExpGain: 100,
            reactionEmotion: 'stern',
            nextSceneId: 'b4_scene_6'
          },
          {
            id: 'b4_c1_b',
            text: "I'm sorry you had to carry that grief alone for two centuries.",
            response: "...Do not pity me. Pity is useless. Vigilance is the only true monument to the fallen.",
            bondExpGain: 100,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'b4_scene_6'
          }
        ]
      },
      {
        id: 'b4_scene_6',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "That is why I enforce the Closed Door. That is why I do not allow unearned power near those I protect. And that is why this Black Lance is forged with the property to pierce through false miracles."
      },
      {
        id: 'b4_scene_7',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "You are small. You have no cheat magic, no divine bloodline, no grand destiny. But you work with your own hands, and you shelter those who cannot fight for themselves. That... is an anchor worth holding."
      }
    ]
  },
  {
    id: 'lucia_bond_event_5',
    servantTemplateId: 'lucia_lyozes',
    requiredBondLevel: 5,
    title: 'Oath of the Vanguard Wall',
    subtitle: 'Black iron grounded, unshakeable trust, and the frontline bond',
    description: 'At the pinnacle of your shared trials, Lucia formally accepts you as her true Master and family.',
    rewardBondExp: 1500,
    rewardSaintQuartz: 5,
    unlockedQuoteId: 'lucia_bond_5',
    scenes: [
      {
        id: 'b5_scene_1',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Stand beside me, Master. Not behind me tonight. Beside me."
      },
      {
        id: 'b5_scene_2',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "We have faced enemy spirits, endured the leylines of this war, and protected this fragile corner of your city through sheer resolve."
      },
      {
        id: 'b5_scene_3',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "When I was summoned, I swore I would never call you Master. I swore I would sever your throat if you showed a hint of greed for that golden cup."
      },
      {
        id: 'b5_scene_4',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "Instead, I watched you tend to your brother's fever, scrub pots until your knuckles cracked, and command this frontline without once asking for a miracle shortcut.",
        choices: [
          {
            id: 'b5_c1_a',
            text: "Because we win this with our own strength. Together.",
            response: "*A rare, genuine smile softens her golden-brown eyes.* Together. A word I have not shared with an outsider in two hundred years.",
            bondExpGain: 150,
            reactionEmotion: 'happy',
            nextSceneId: 'b5_scene_5'
          },
          {
            id: 'b5_c1_b',
            text: "You're part of this household now, Lucia. That's what family does.",
            response: "...Family. To think an elven princess would find her sisterhood in a cramped mortal kitchen. *She chuckles softly.*",
            bondExpGain: 150,
            reactionEmotion: 'happy',
            nextSceneId: 'b5_scene_5'
          }
        ]
      },
      {
        id: 'b5_scene_5',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "*Grounding the Black Lance firmly into the earth, placing her right hand over her armored chest.*"
      },
      {
        id: 'b5_scene_6',
        speakerName: 'Lucia Lyozes',
        backgroundTheme: 'fuyuki_moonlight',
        dialogueText: "I, Lucernalia Lyozes, Vanguard of Sylvanryth and guardian of the Closed Door, formally pledge my lance to your command. Let false gods and cheated destinies come: as long as my heart beats, the vanguard wall shall never fall!"
      }
    ]
  }
];

export const LUVRIA_BOND_EVENTS: BondEvent[] = [
  {
    id: 'luvria_bond_event_1',
    servantTemplateId: 'luvria_greenharte',
    requiredBondLevel: 1,
    title: 'The "Hero" of Sylvanryth & The Paper-Door Abode',
    subtitle: 'Bond Level 1 Interlude • Summoning Encounter',
    description: 'An initial encounter with the strongest archmage of Sylvanryth, exploring her arrival as an Otherworlder, dimensional laws, and your mutual pact.',
    rewardBondExp: 200,
    rewardSaintQuartz: 3,
    unlockedQuoteId: 'luvria_bond_line_1',
    scenes: [
      {
        id: 'scene_1',
        speakerName: 'Luvria Greenharte',
        backgroundTheme: 'chaldea_room',
        dialogueText: "Hark, mortal of this foreign soil! Behold, for thy call hath pierced the veil of the stars, and... and... *Elu'vash... no, wait, elen'dorahn?* Ugh, whatever, what was the royal greeting again? *Ael'shir...* Ah, forget it. The elven elders would dock my allowance if they heard that butchery anyway.\n\nAhem. Let's just stick to common tongue. Servant, Caster. The greatest mage of my world, naturally. Now... are you going to stand there gawking at my ears all night, or are we going to establish why this strange golden cup just downloaded an entire encyclopedia of 'Japan' into my head?",
        choices: [
          {
            id: 'c1_wifi',
            text: "Are you okay? You sounded like you were trying to remember a forgotten WiFi password.",
            response: "A 'WiFi password'? See, that is the exact kind of bizarre foreign jargon the Grail just crammed into my brain. For your information, that was ancient High Sylvan! Or... at least my very rough approximation of it. Language of grace, poetry, and profound wisdom. I just happen to think too fast for centuries-old grammar.",
            bondExpGain: 100,
            reactionEmotion: 'flustered',
            nextSceneId: 'scene_2'
          },
          {
            id: 'c1_summon',
            text: "Servant Caster... I take it the summoning actually worked? Welcome.",
            response: "Of course it worked. You think some petty magical circle could summon anyone less magnificent than me? Though, you are taking this awfully in stride. Most people who summon a legendary figure either drop to their knees weeping or start demanding miracles.",
            bondExpGain: 100,
            reactionEmotion: 'smug',
            nextSceneId: 'scene_2'
          },
          {
            id: 'c1_living_room',
            text: "Welcome to Japan! Please tell me you don't plan on blowing up my living room.",
            response: "Blowing it up? Heavens, no. What kind of barbarian do you take me for? Though, judging by the ambient mana in this room, or rather the complete lack of it, a stray sneeze from me might shake the foundation. Don't worry, your little paper-door dwelling is safe for now.",
            bondExpGain: 125,
            reactionEmotion: 'amused',
            nextSceneId: 'scene_2'
          }
        ]
      },
      {
        id: 'scene_2',
        speakerName: 'Luvria Greenharte',
        backgroundTheme: 'chaldea_room',
        dialogueText: "Though... let us cut the pleasantries for a second, Master. Let me ask you something plainly. Do you have any idea what I am to your world right now?\n\nBack where I come from, when someone falls out of the sky from another dimension, we have a very specific name for them: *Otherworlders*. And do you know what the law says to do with them? Terminate on sight. No trial. No tea. Just a lance through the ribs before they accidentally detonate a continent.\n\nAnd now, thanks to this little Grail War... *I* am the Otherworlder. In your city. In your world. Funny how the cosmos works, isn't it? So tell me... should I be expecting a legion of your world's soldiers to kick down that wooden sliding door, or are you people considerably more hospitable than the elves?",
        choices: [
          {
            id: 'c2_gentle',
            text: "You don't look like a walking disaster to me. Just someone a very long way from home.",
            response: "Ha! 'A long way from home.' That is a terribly gentle way of putting it. You short-lived folks have a peculiar habit of looking at a loaded ballista and calling it a decorative piece of wood. But... I suppose I appreciate the sentiment. It is certainly nicer than being greeted with drawn bows.",
            bondExpGain: 125,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_3'
          },
          {
            id: 'c2_commute',
            text: "People here are way too busy with their morning commutes to hunt down dimensional wanderers.",
            response: "A 'morning commute'? Ah, yes, the metal trains packed like salted herring barrels. Truly, modern human torment knows no bounds. If that is what consumes your world's wrath, then perhaps I overestimated your appetite for war.",
            bondExpGain: 100,
            reactionEmotion: 'amused',
            nextSceneId: 'scene_3'
          },
          {
            id: 'c2_trouble',
            text: "Back home, Otherworlders really caused that much trouble?",
            response: "Trouble doesn't begin to cover it. Two centuries ago, one of them treated our entire world like a playground. Detonated weapons of light and fire beneath our cities. Made rivers run red. So yes, forgive me if I cast a ward or two around this room just to make sure you weren't planning on sacrificing me to some dark ritual.",
            bondExpGain: 125,
            reactionEmotion: 'stern',
            nextSceneId: 'scene_3'
          }
        ]
      },
      {
        id: 'scene_3',
        speakerName: 'Luvria Greenharte',
        backgroundTheme: 'chaldea_room',
        dialogueText: "Still... you're not tensing your shoulders. Your pulse isn't racing like a cornered rabbit's. You just look... calm. Mildly bewildered, but fundamentally at ease.\n\nI can sense those red marks on the back of your hand. The Command Seals. You hold three absolute orders over my existence. In theory, you could command me to prostrate myself, or force me to incinerate an entire city block against my will. Aren't you going to brandish them? Give a speech about destiny and bloodlines? That seems to be the customary greeting for mages in these Grail records.",
        choices: [
          {
            id: 'c3_dinner',
            text: "I'd rather earn your trust over dinner than force your hand with a tattoo.",
            response: "Dinner over servitude? By the roots of Sylvanryth, what kind of hopeless idealist did this cup bind me to? ...Though, my Grail-imparted knowledge informs me that this island has something called 'tonkatsu'. If that is on the table, your odds of survival just increased dramatically.",
            bondExpGain: 150,
            reactionEmotion: 'excited',
            nextSceneId: 'scene_4'
          },
          {
            id: 'c3_frog',
            text: "If I tried commanding you like a pawn, I'm pretty sure you'd find a way to turn me into a frog.",
            response: "A frog? Please. That is amateur transfiguration. If you offended me that gravely, I'd simply remove the concept of your shoelaces staying tied for the rest of your mortal life. Far more cruel, and considerably funnier.",
            bondExpGain: 125,
            reactionEmotion: 'smug',
            nextSceneId: 'scene_4'
          },
          {
            id: 'c3_partner',
            text: "I summoned a partner, not a weapon. Let's start with basic mutual respect.",
            response: "Mutual respect... *Vael'en... dor?* Ugh, there's an elven proverb for that. Something about two travelers sharing the same shade without measuring each other's shadows. My father used to recite it when he was trying to sound terribly profound. It's rare to hear that sentiment from someone who actually holds a leash.",
            bondExpGain: 150,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_4'
          }
        ]
      },
      {
        id: 'scene_4',
        speakerName: 'Luvria Greenharte',
        backgroundTheme: 'chaldea_room',
        dialogueText: "Very well, Master. You've passed the initial sanity check. You're neither a power-drunk zealot nor a sniveling coward. That puts you roughly thirty leagues ahead of the nobles I usually have to tolerate.\n\nSo, let's talk shop. This 'Holy Grail War.' Seven servants, seven masters, one wish-granting artifact that supposedly reaches the Root of all creation. To be frank, it sounds suspiciously like the kind of cursed relic someone digs out of the Ebonwatch Dungeon right before a floor boss wipes their entire raid party.\n\nDo you actually have a wish for this thing? Some grand, reality-altering desire? Or did you just trip over a summoning circle on your way to buy groceries?",
        choices: [
          {
            id: 'c4_survive',
            text: "I just want to survive this war and make sure nobody innocent gets hurt in our city.",
            response: "A protector's mindset. Practical. Grounded. A bit boring, perhaps, but boring keeps people breathing. Lucia would probably approve of you. She's always droning on about collateral damage and tactical restraint while I'm trying to have a bit of fun.",
            bondExpGain: 125,
            reactionEmotion: 'thoughtful',
            nextSceneId: 'scene_5'
          },
          {
            id: 'c4_accident',
            text: "Honestly? I got dragged into this by accident. I just wanted to do the right thing.",
            response: "An accidental participant? Hah! The universe truly has an exquisite sense of humor. You stumble into an ancient death tournament, and your prize is the strongest, most high-maintenance archmage from an entirely different realm. Lucky you.",
            bondExpGain: 125,
            reactionEmotion: 'amused',
            nextSceneId: 'scene_5'
          },
          {
            id: 'c4_her_wish',
            text: "What about you, Luvria? If we win, is there something you want to wish for?",
            response: "Me? A wish from a metal cup? Please. If I want a mountain moved, I don't pray to a relic; I simply tell reality to step aside until it complies. Though... if it could grant an endless supply of roasted pastries without me having to listen to palace lectures, I might reconsider.",
            bondExpGain: 150,
            reactionEmotion: 'happy',
            nextSceneId: 'scene_5'
          }
        ]
      },
      {
        id: 'scene_5',
        speakerName: 'Luvria Greenharte',
        backgroundTheme: 'chaldea_room',
        dialogueText: "In any case, we have an agreement then. I will serve as your Caster. I'll ward this perimeter, sniff out the other six servants, and ensure nobody turns your quiet neighborhood into a smoldering crater.\n\nJust remember one golden rule when fighting alongside me: I don't cast standard fireballs or parlor tricks. When I say no to something—be it a blade, a spell, or the very laws of physics—the world obeys. So try not to faint if you see me breaking reality over my knee like dry firewood.",
        choices: [
          {
            id: 'c5_breakfast',
            text: "Sounds like I'm in good hands. Just promise you won't erase the concept of tomorrow's breakfast.",
            response: "Perish the thought! Breakfast is sacred. If anything, I'll nullify the concept of burnt toast. Now, show me where you keep the tea. We have seven legendary heroes to outsmart, and I refuse to strategize on an empty stomach.",
            bondExpGain: 150,
            reactionEmotion: 'happy'
          },
          {
            id: 'c5_japanese',
            text: "Deal. But only if you let me teach you proper Japanese before you butcher that elven greeting again.",
            response: "How dare you! My High Sylvan is majestic! ...Fine, it's terrible, but you didn't have to agree so quickly! You've got yourself a bargain, Master. You teach me your bizarre island dialect, and I'll keep the legendary spirits of Earth from turning you into mist.",
            bondExpGain: 150,
            reactionEmotion: 'flustered'
          },
          {
            id: 'c5_team',
            text: "Let's win this together, Caster. Welcome to the team.",
            response: "'The team.' Listen to you, sounding like a proper leader already. Hold that head high, Master. With Luvria Greenharte at your side, this war won't even know what hit it.",
            bondExpGain: 150,
            reactionEmotion: 'determined'
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
  amamiya_no_chihaya_tenkohime: AMAMIYA_BOND_EVENTS,
  amamiya: AMAMIYA_BOND_EVENTS,
  chihaya: AMAMIYA_BOND_EVENTS,
  tenkohime: AMAMIYA_BOND_EVENTS,
  lucia_lyozes: LUCIA_BOND_EVENTS,
  lucia: LUCIA_BOND_EVENTS,
  lucernalia: LUCIA_BOND_EVENTS,
  lucernalia_lyozes: LUCIA_BOND_EVENTS,
  luvria_greenharte: LUVRIA_BOND_EVENTS,
  luvria: LUVRIA_BOND_EVENTS,
  greenharte: LUVRIA_BOND_EVENTS,
  heracles_berserker: HERACLES_BOND_EVENTS,
  heracles: HERACLES_BOND_EVENTS,
  scathach_lancer: SCATHACH_BOND_EVENTS,
  scathach: SCATHACH_BOND_EVENTS,
  jeanne_darc_ruler: JEANNE_RULER_BOND_EVENTS,
  jeanne_ruler: JEANNE_RULER_BOND_EVENTS,
  jeanne_d_arc: JEANNE_RULER_BOND_EVENTS,
  jeanne: JEANNE_RULER_BOND_EVENTS,
  nero_claudius_saber: NERO_BOND_EVENTS,
  nero_claudius: NERO_BOND_EVENTS,
  nero: NERO_BOND_EVENTS,
  saber_nero: NERO_BOND_EVENTS,
  rose_saber: NERO_BOND_EVENTS,
  umu: NERO_BOND_EVENTS
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
  amamiya_no_chihaya_tenkohime: [
    {
      id: 'amamiya_summon',
      title: 'Summoning Pact',
      category: 'summon',
      requiredBondLevel: 1,
      quoteText: '"Washi has been called upon. Time to sweep out the fallen leaves."'
    },
    {
      id: 'amamiya_bond_1',
      title: 'Bond 1: Divine Name',
      category: 'bond_1',
      requiredBondLevel: 1,
      quoteText: '"Amamiya ja nee! Washi no namae wa Amamiya no Chihaya Tenkohime! Remember it properly! Hmpf!"'
    },
    {
      id: 'amamiya_bond_2',
      title: 'Bond 2: Sacred Kuchikamizake',
      category: 'bond_2',
      requiredBondLevel: 2,
      quoteText: '"Washi would never chew and spit rice into a jar for you! ...Unless... it is for a truly grand ritual... and you shall promise to buy washi fried tofu afterward... Hmph!"'
    },
    {
      id: 'amamiya_bond_3',
      title: 'Bond 3: Afternoon Affection',
      category: 'bond_3',
      requiredBondLevel: 3,
      quoteText: '"*poke poke* Ne ne... Master, washi is bored. Pay attention to washi, or washi shall take a nap right on thy lap."'
    },
    {
      id: 'amamiya_bond_4',
      title: 'Bond 4: Arachnid Terror',
      category: 'bond_4',
      requiredBondLevel: 4,
      quoteText: '"K-Kyuuuu! A BUG! Master, smite it! Smite it this instant! Do not let it touch washi\'s tail!"'
    },
    {
      id: 'amamiya_bond_5',
      title: 'Bond 5: Nine Tails Awakening',
      category: 'bond_5',
      requiredBondLevel: 5,
      quoteText: '"Amazakura yo! Washi o mamore! Whatever darkness descends upon this world, washi\'s Nine Tails shall shield you from all harm!"'
    }
  ],
  amamiya: [
    {
      id: 'amamiya_summon',
      title: 'Summoning Pact',
      category: 'summon',
      requiredBondLevel: 1,
      quoteText: '"Washi has been called upon. Time to sweep out the fallen leaves."'
    },
    {
      id: 'amamiya_bond_1',
      title: 'Bond 1: Divine Name',
      category: 'bond_1',
      requiredBondLevel: 1,
      quoteText: '"Amamiya ja nee! Washi no namae wa Amamiya no Chihaya Tenkohime! Remember it properly! Hmpf!"'
    },
    {
      id: 'amamiya_bond_2',
      title: 'Bond 2: Sacred Kuchikamizake',
      category: 'bond_2',
      requiredBondLevel: 2,
      quoteText: '"Washi would never chew and spit rice into a jar for you! ...Unless... it is for a truly grand ritual... and you shall promise to buy washi fried tofu afterward... Hmph!"'
    },
    {
      id: 'amamiya_bond_3',
      title: 'Bond 3: Afternoon Affection',
      category: 'bond_3',
      requiredBondLevel: 3,
      quoteText: '"*poke poke* Ne ne... Master, washi is bored. Pay attention to washi, or washi shall take a nap right on thy lap."'
    },
    {
      id: 'amamiya_bond_4',
      title: 'Bond 4: Arachnid Terror',
      category: 'bond_4',
      requiredBondLevel: 4,
      quoteText: '"K-Kyuuuu! A BUG! Master, smite it! Smite it this instant! Do not let it touch washi\'s tail!"'
    },
    {
      id: 'amamiya_bond_5',
      title: 'Bond 5: Nine Tails Awakening',
      category: 'bond_5',
      requiredBondLevel: 5,
      quoteText: '"Amazakura yo! Washi o mamore! Whatever darkness descends upon this world, washi\'s Nine Tails shall shield you from all harm!"'
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
  ],
  nero_claudius_saber: [
    {
      id: 'nero_summon',
      title: 'Summoning Pact',
      category: 'summon',
      requiredBondLevel: 1,
      quoteText: 'Servant Saber, Nero Claudius, has arrived upon your stage! Rejoice, Praetor, for your victory is now an absolute work of art!'
    },
    {
      id: 'nero_bond_line_1',
      title: 'Bond 1: Emperor\'s Solace',
      category: 'bond_1',
      requiredBondLevel: 1,
      quoteText: 'Rest now, Praetor. Tomorrow the stage calls for blood and steel, but tonight, your Emperor watches over you.'
    },
    {
      id: 'nero_bond_5',
      title: 'Bond 5: Golden Theater of the Heart',
      category: 'bond_5',
      requiredBondLevel: 5,
      quoteText: 'Umu! When you believe in me, my sword knows no limits! Together, our grand curtain call shall echo through eternity!'
    }
  ],
  nero_claudius: [
    {
      id: 'nero_summon',
      title: 'Summoning Pact',
      category: 'summon',
      requiredBondLevel: 1,
      quoteText: 'Servant Saber, Nero Claudius, has arrived upon your stage! Rejoice, Praetor, for your victory is now an absolute work of art!'
    },
    {
      id: 'nero_bond_line_1',
      title: 'Bond 1: Emperor\'s Solace',
      category: 'bond_1',
      requiredBondLevel: 1,
      quoteText: 'Rest now, Praetor. Tomorrow the stage calls for blood and steel, but tonight, your Emperor watches over you.'
    },
    {
      id: 'nero_bond_5',
      title: 'Bond 5: Golden Theater of the Heart',
      category: 'bond_5',
      requiredBondLevel: 5,
      quoteText: 'Umu! When you believe in me, my sword knows no limits! Together, our grand curtain call shall echo through eternity!'
    }
  ],
  lucia_lyozes: [
    {
      id: 'lucia_summon',
      title: 'Summoning Pact',
      category: 'summon',
      requiredBondLevel: 1,
      quoteText: 'Do not move. Do not draw breath deeper than necessary. If your fingers twitch toward a focus, a catalyst, or a weapon, this black iron will pierce your throat before your mind registers the intent. I am Lucernalia Lyozes.'
    },
    {
      id: 'lucia_bond_1',
      title: 'Bond 1: Guarded Perimeter',
      category: 'bond_1',
      requiredBondLevel: 1,
      quoteText: 'Keep your head down, speak only when questioned, and do not dare give me a reason to finish what this summoning began.'
    },
    {
      id: 'lucia_bond_2',
      title: 'Bond 2: Battlefield Discipline',
      category: 'bond_2',
      requiredBondLevel: 2,
      quoteText: 'You survived another shift. Good. Maintain that routine. In war, regularity is the first wall against mental breakdown.'
    },
    {
      id: 'lucia_bond_3',
      title: 'Bond 3: Tactical Positioning',
      category: 'bond_3',
      requiredBondLevel: 3,
      quoteText: 'Your Aethel remains thin, yet your footsteps in the kitchen carry the rhythm of someone who understands positioning. Let us see how that translates to a tactical retreat.'
    },
    {
      id: 'lucia_bond_4',
      title: 'Bond 4: Vanguard Vigilance',
      category: 'bond_4',
      requiredBondLevel: 4,
      quoteText: 'I checked on your brother. His breathing was even. No foreign mana in the room. ...Do not look at me like that. A vanguard must secure the civilian perimeter.'
    },
    {
      id: 'lucia_bond_5',
      title: 'Bond 5: Oath of the Wall',
      category: 'bond_5',
      requiredBondLevel: 5,
      quoteText: 'I will not call you Master. But... as long as you hold fast against corruption and protect those under your care, this black iron belongs to your vanguard.'
    }
  ],
  lucia: [
    {
      id: 'lucia_summon_alias',
      title: 'Summoning Pact',
      category: 'summon',
      requiredBondLevel: 1,
      quoteText: 'Do not move. Do not draw breath deeper than necessary. If your fingers twitch toward a focus, a catalyst, or a weapon, this black iron will pierce your throat before your mind registers the intent. I am Lucernalia Lyozes.'
    },
    {
      id: 'lucia_bond_1_alias',
      title: 'Bond 1: Guarded Perimeter',
      category: 'bond_1',
      requiredBondLevel: 1,
      quoteText: 'Keep your head down, speak only when questioned, and do not dare give me a reason to finish what this summoning began.'
    },
    {
      id: 'lucia_bond_5_alias',
      title: 'Bond 5: Oath of the Wall',
      category: 'bond_5',
      requiredBondLevel: 5,
      quoteText: 'I will not call you Master. But... as long as you hold fast against corruption and protect those under your care, this black iron belongs to your vanguard.'
    }
  ],
  luvria_greenharte: [
    {
      id: 'luvria_summon',
      title: 'Summoning Pact',
      category: 'summon',
      requiredBondLevel: 1,
      quoteText: 'Hark, mortal of this foreign soil! Behold, for thy call hath pierced the veil of the stars... Ah, forget it. Servant Caster, Luvria Greenharte! The greatest mage of my world, naturally.'
    },
    {
      id: 'luvria_bond_line_1',
      title: 'Bond 1: Otherworlder Pact',
      category: 'bond_1',
      requiredBondLevel: 1,
      quoteText: 'When I say no to something—be it a blade, a spell, or the very laws of physics—the world obeys. So try not to faint if you see me breaking reality over my knee like dry firewood.'
    },
    {
      id: 'luvria_bond_2',
      title: 'Bond 2: Morning Commute',
      category: 'bond_2',
      requiredBondLevel: 2,
      quoteText: 'A "morning commute"? Ah, yes, metal trains packed like salted herring barrels. Truly, modern human torment knows no bounds.'
    },
    {
      id: 'luvria_bond_3',
      title: 'Bond 3: Sacred Breakfast',
      category: 'bond_3',
      requiredBondLevel: 3,
      quoteText: 'Breakfast is sacred. If anything, I\'ll nullify the concept of burnt toast. Now, show me where you keep the tea. I refuse to strategize on an empty stomach.'
    },
    {
      id: 'luvria_bond_4',
      title: 'Bond 4: Tonkatsu Over Servitude',
      category: 'bond_4',
      requiredBondLevel: 4,
      quoteText: 'Dinner over servitude? By the roots of Sylvanryth, what kind of hopeless idealist did this cup bind me to? ...Though if tonkatsu is on the table, your odds of survival just increased dramatically.'
    },
    {
      id: 'luvria_bond_5',
      title: 'Bond 5: Invincible Archmage',
      category: 'bond_5',
      requiredBondLevel: 5,
      quoteText: 'Hold that head high, Master. With Luvria Greenharte at your side, this war won\'t even know what hit it!'
    }
  ],
  luvria: [
    {
      id: 'luvria_summon_alias',
      title: 'Summoning Pact',
      category: 'summon',
      requiredBondLevel: 1,
      quoteText: 'Hark, mortal of this foreign soil! Behold, for thy call hath pierced the veil of the stars... Ah, forget it. Servant Caster, Luvria Greenharte! The greatest mage of my world, naturally.'
    },
    {
      id: 'luvria_bond_line_1_alias',
      title: 'Bond 1: Otherworlder Pact',
      category: 'bond_1',
      requiredBondLevel: 1,
      quoteText: 'When I say no to something—be it a blade, a spell, or the very laws of physics—the world obeys. So try not to faint if you see me breaking reality over my knee like dry firewood.'
    },
    {
      id: 'luvria_bond_5_alias',
      title: 'Bond 5: Invincible Archmage',
      category: 'bond_5',
      requiredBondLevel: 5,
      quoteText: 'Hold that head high, Master. With Luvria Greenharte at your side, this war won\'t even know what hit it!'
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

// ============================================================================
// BOND GIFTS & OFFERINGS CATALOG
// ============================================================================

export interface BondGiftItem {
  id: string;
  name: string;
  emoji: string;
  bondExp: number;
  sqCost: number;
  description: string;
}

export const BOND_GIFTS: Record<string, BondGiftItem> = {
  chaldea_tea: {
    id: 'chaldea_tea',
    name: 'Chaldea Afternoon Tea',
    emoji: '☕',
    bondExp: 150,
    sqCost: 0,
    description: 'A steaming pot of royal black tea and pastries to share during downtime.'
  },
  heroic_feast: {
    id: 'heroic_feast',
    name: 'Heroic Feast & Delicacies',
    emoji: '🍱',
    bondExp: 250,
    sqCost: 5,
    description: 'A gourmet meal prepared with exquisite craftsmanship and flavors.'
  },
  golden_apple: {
    id: 'golden_apple',
    name: 'Golden Apple of Eden',
    emoji: '🍏',
    bondExp: 350,
    sqCost: 10,
    description: 'A mythical fruit overflowing with pure, revitalizing magical energy.'
  },
  sacred_relic: {
    id: 'sacred_relic',
    name: 'Sacred Holy Relic',
    emoji: '💠',
    bondExp: 500,
    sqCost: 15,
    description: 'An ancient consecrated sigil that deeply resonates with heroic origins.'
  }
};

/**
 * Returns an in-character dialogue reaction when a Servant receives a specific gift.
 */
export function getServantGiftReaction(
  servant: MasterServantInstance,
  giftId: string
): { responseText: string; emotion: 'happy' | 'flustered' | 'amused' | 'thoughtful' } {
  const templateId = servant.templateId || servant.template?.id || servant.id;
  const sName = servant.nickname || servant.template?.name || 'Servant';

  const reactions: Record<string, Record<string, { responseText: string; emotion: 'happy' | 'flustered' | 'amused' | 'thoughtful' }>> = {
    artoria_pendragon: {
      chaldea_tea: {
        responseText: "Tea with Master? ...Ah, the aroma is wonderful. Taking a brief respite with you reminds me of peaceful afternoons in Britain.",
        emotion: 'happy'
      },
      heroic_feast: {
        responseText: "A feast prepared for me?! ...I shall accept with deep gratitude, Master! I will make sure not a single morsel goes to waste!",
        emotion: 'happy'
      },
      golden_apple: {
        responseText: "Such dense vitality... Master, consuming this allows my Mana Core to burn brighter. Thank you for your care.",
        emotion: 'thoughtful'
      },
      sacred_relic: {
        responseText: "A sacred holy relic... I feel the solemn resonance with the Round Table. As long as I hold Excalibur, I will protect you.",
        emotion: 'thoughtful'
      }
    },
    gilgamesh_archer: {
      chaldea_tea: {
        responseText: "Hmph. Offering tea to the King of Heroes? Well, your boldness is not entirely displeasing. Let us see if your taste satisfies me, mongrel.",
        emotion: 'amused'
      },
      heroic_feast: {
        responseText: "A feast? Though it pales before the cellars of Babylon, your effort to entertain your King earns you my praise.",
        emotion: 'amused'
      },
      golden_apple: {
        responseText: "The fruit of youth and vigor... Know that everything precious in this world belongs in my treasury, Master. But I accept your tribute.",
        emotion: 'amused'
      },
      sacred_relic: {
        responseText: "Hahaha! Offering a treasure to the King who owns all treasures? Very well, I shall acknowledge your devotion!",
        emotion: 'happy'
      }
    },
    emiya_archer: {
      chaldea_tea: {
        responseText: "Afternoon tea? Well, you have good timing. I was just about to bake a batch of scones. Sit down, Master, I'll pour for both of us.",
        emotion: 'happy'
      },
      heroic_feast: {
        responseText: "A feast? Hey now, who taught you to prepare all this? Not bad at all... sharing a table like this isn't so bad after all.",
        emotion: 'happy'
      },
      golden_apple: {
        responseText: "A Golden Apple... It’s packed with an absurd amount of mana. Don't worry, Master, I'll make sure none of it goes to waste in battle.",
        emotion: 'thoughtful'
      },
      sacred_relic: {
        responseText: "A consecrated relic... tracing the structural concept reveals intricate mysteries. Thank you, Master. I will reinforce our arms with this.",
        emotion: 'thoughtful'
      }
    },
    cu_chulainn_lancer: {
      chaldea_tea: {
        responseText: "Tea? Haha, I'm more of an ale and roasted boar guy, but sitting down with you is always a good time, Master!",
        emotion: 'amused'
      },
      heroic_feast: {
        responseText: "Now THAT'S what I'm talking about! A warrior's feast! Let's dig in, Master, before the war calls us back to the battlefield!",
        emotion: 'happy'
      },
      golden_apple: {
        responseText: "Whoa, that's some potent magical fruit! My spear arm feels lighter already! Thanks, Master!",
        emotion: 'happy'
      },
      sacred_relic: {
        responseText: "An ancient artifact? Runes are reacting to it like wildfire. Leave the enemy Vanguard to me, Master!",
        emotion: 'thoughtful'
      }
    },
    jeanne_d_arc: {
      chaldea_tea: {
        responseText: "A warm cup of tea... Master, sharing this quiet moment with you brings such warmth to my prayer. Thank you.",
        emotion: 'happy'
      },
      heroic_feast: {
        responseText: "Master, you prepared so much for us? The Lord's blessings upon your kindness! Let us give thanks together before eating.",
        emotion: 'happy'
      },
      golden_apple: {
        responseText: "Such pure radiant mana... I will channel this energy to ensure our Luminosité Eternelle protects you from every harm.",
        emotion: 'thoughtful'
      },
      sacred_relic: {
        responseText: "A holy relic... I can feel the pure light within it. May our journey together remain pure and guided by grace.",
        emotion: 'thoughtful'
      }
    },
    nero_claudius_saber: {
      chaldea_tea: {
        responseText: "Umu! Fine tea poured in an emperor's honor! Sit beside me, Praetor, let us savor this refined moment together!",
        emotion: 'happy'
      },
      heroic_feast: {
        responseText: "Magnificent! A banquet worthy of Rome's greatest artist! You truly know how to spoil your Emperor, Praetor!",
        emotion: 'happy'
      },
      golden_apple: {
        responseText: "A radiant Golden Apple! The flame of passion inside my Spirit Origin burns brighter than ever! Let the theater begin!",
        emotion: 'happy'
      },
      sacred_relic: {
        responseText: "An exquisite treasure! The Domus Aurea herself welcomes such splendor! Master, your devotion is truly peerless!",
        emotion: 'amused'
      }
    },
    nero_claudius: {
      chaldea_tea: {
        responseText: "Umu! Fine tea poured in an emperor's honor! Sit beside me, Praetor, let us savor this refined moment together!",
        emotion: 'happy'
      },
      heroic_feast: {
        responseText: "Magnificent! A banquet worthy of Rome's greatest artist! You truly know how to spoil your Emperor, Praetor!",
        emotion: 'happy'
      },
      golden_apple: {
        responseText: "A radiant Golden Apple! The flame of passion inside my Spirit Origin burns brighter than ever! Let the theater begin!",
        emotion: 'happy'
      },
      sacred_relic: {
        responseText: "An exquisite treasure! The Domus Aurea herself welcomes such splendor! Master, your devotion is truly peerless!",
        emotion: 'amused'
      }
    },
    amamiya_no_chihaya_tenkohime: {
      chaldea_tea: {
        responseText: "Pure green tea without that repulsive cow milk?! Master, you truly understand divine hospitality! Ehehe~!",
        emotion: 'happy'
      },
      heroic_feast: {
        responseText: "A-Aburaage?! Golden, crispy sheets of fried tofu piled high like Mount Fuji?! Master... washi shall fight with everything for you!",
        emotion: 'happy'
      },
      golden_apple: {
        responseText: "Such divine, concentrated mana... It feels just like the Aethel overflow beneath the sacred cherry blossom tree. Washi's tails are tingling!",
        emotion: 'thoughtful'
      },
      sacred_relic: {
        responseText: "An ancient consecrated talisman! This will cleanse the shrine and keep every spider away from our sanctuary! A brilliant tribute, Master!",
        emotion: 'thoughtful'
      }
    },
    amamiya: {
      chaldea_tea: {
        responseText: "Pure green tea without that repulsive cow milk?! Master, you truly understand divine hospitality! Ehehe~!",
        emotion: 'happy'
      },
      heroic_feast: {
        responseText: "A-Aburaage?! Golden, crispy sheets of fried tofu piled high like Mount Fuji?! Master... washi shall fight with everything for you!",
        emotion: 'happy'
      },
      golden_apple: {
        responseText: "Such divine, concentrated mana... It feels just like the Aethel overflow beneath the sacred cherry blossom tree. Washi's tails are tingling!",
        emotion: 'thoughtful'
      },
      sacred_relic: {
        responseText: "An ancient consecrated talisman! This will cleanse the shrine and keep every spider away from our sanctuary! A brilliant tribute, Master!",
        emotion: 'thoughtful'
      }
    },
    lucia_lyozes: {
      chaldea_tea: {
        responseText: "Hot black tea without sweetener. ...Adequate. In the Citadel, hot rations keep the senses sharp during long vigils.",
        emotion: 'thoughtful'
      },
      heroic_feast: {
        responseText: "Fresh bread, stew, roasted vegetables... You prepared this yourself? A vanguard requires steady caloric fuel. I commend your discipline.",
        emotion: 'thoughtful'
      },
      golden_apple: {
        responseText: "A dense crystallization of planetary vitality. I will allocate its reserves strictly for defense and mana stabilization.",
        emotion: 'thoughtful'
      },
      sacred_relic: {
        responseText: "An ancient warding relic. I will inspect its runes to ensure no residual curse clings to it, then weave it into the storehouse defenses.",
        emotion: 'thoughtful'
      }
    },
    lucia: {
      chaldea_tea: {
        responseText: "Hot black tea without sweetener. ...Adequate. In the Citadel, hot rations keep the senses sharp during long vigils.",
        emotion: 'thoughtful'
      },
      heroic_feast: {
        responseText: "Fresh bread, stew, roasted vegetables... You prepared this yourself? A vanguard requires steady caloric fuel. I commend your discipline.",
        emotion: 'thoughtful'
      },
      golden_apple: {
        responseText: "A dense crystallization of planetary vitality. I will allocate its reserves strictly for defense and mana stabilization.",
        emotion: 'thoughtful'
      },
      sacred_relic: {
        responseText: "An ancient warding relic. I will inspect its runes to ensure no residual curse clings to it, then weave it into the storehouse defenses.",
        emotion: 'thoughtful'
      }
    }
  };

  const servantReactions = reactions[templateId];
  if (servantReactions && servantReactions[giftId]) {
    return servantReactions[giftId];
  }

  // Generic fallback reaction based on gift
  if (giftId === 'chaldea_tea') {
    return {
      responseText: `Thank you for the warm tea, Master. Taking this quiet moment together strengthens our bond.`,
      emotion: 'happy'
    };
  } else if (giftId === 'heroic_feast') {
    return {
      responseText: `What a wonderful feast! Having you care for my well-being like this fills me with pride as your Servant.`,
      emotion: 'happy'
    };
  } else if (giftId === 'golden_apple') {
    return {
      responseText: `A Golden Apple! The immense magical energy within it courses through my Spirit Origin. I will fight even harder for you!`,
      emotion: 'happy'
    };
  } else {
    return {
      responseText: `A sacred relic of such immense value... Master, your trust and generosity are the greatest honors I could receive.`,
      emotion: 'thoughtful'
    };
  }
}

/**
 * Generates an in-character sparring debrief dialogue when practicing in the Bond Chamber.
 */
export function getServantSparringDebrief(
  servant: MasterServantInstance
): { responseText: string; emotion: 'happy' | 'amused' | 'thoughtful' } {
  const templateId = servant.templateId || servant.template?.id || servant.id;
  const sName = servant.nickname || servant.template?.name || 'Servant';

  const drills: Record<string, { responseText: string; emotion: 'happy' | 'amused' | 'thoughtful' }> = {
    artoria_pendragon: {
      responseText: "Good stance, Master! Your footwork has improved considerably. When we face enemy Servants, trust my blade and stay behind my shield.",
      emotion: 'thoughtful'
    },
    gilgamesh_archer: {
      responseText: "Hmph. To raise a weapon against a King requires either madness or commendable courage. You didn't flinch, Master. Keep that resolve.",
      emotion: 'amused'
    },
    emiya_archer: {
      responseText: "Keep your breathing steady. Don't look at the tip of the blade, watch the opponent's center of balance. You're catching on fast, Master.",
      emotion: 'thoughtful'
    },
    cu_chulainn_lancer: {
      responseText: "Haha! Nice feint! If you were a Celtic warrior, Scáthach might even crack a half-smile. Let's do another round!",
      emotion: 'amused'
    },
    jeanne_d_arc: {
      responseText: "Excellent focus, Master. Even without casting high thaumaturgy, your commanding timing gives me immense strength on the frontline.",
      emotion: 'happy'
    },
    medusa_rider: {
      responseText: "Your reaction speed is sharp, Master. When the chains strike, you anticipated the vector accurately. I am glad we sparred.",
      emotion: 'thoughtful'
    },
    nero_claudius_saber: {
      responseText: "Splendid form, Praetor! Such theatrical grace in your footwork! With my crimson blade and your tactical command, no stage shall ever deny us victory!",
      emotion: 'happy'
    },
    nero_claudius: {
      responseText: "Splendid form, Praetor! Such theatrical grace in your footwork! With my crimson blade and your tactical command, no stage shall ever deny us victory!",
      emotion: 'happy'
    },
    amamiya_no_chihaya_tenkohime: {
      responseText: "*Nine tails swaying swiftly.* Splendid reflex, Master! Amazakura moves purely on instinct, but your commanding rhythm balances washi's footwork perfectly! Now, where is that fried tofu you promised?",
      emotion: 'happy'
    },
    amamiya: {
      responseText: "*Nine tails swaying swiftly.* Splendid reflex, Master! Amazakura moves purely on instinct, but your commanding rhythm balances washi's footwork perfectly! Now, where is that fried tofu you promised?",
      emotion: 'happy'
    },
    lucia_lyozes: {
      responseText: "Your guard dropped after the third step. When fatigue sets in, the ribs open up. We will repeat the defensive transition fifty times tomorrow before dawn.",
      emotion: 'thoughtful'
    },
    lucia: {
      responseText: "Your guard dropped after the third step. When fatigue sets in, the ribs open up. We will repeat the defensive transition fifty times tomorrow before dawn.",
      emotion: 'thoughtful'
    }
  };

  if (drills[templateId]) {
    return drills[templateId];
  }

  return {
    responseText: `Great drill, Master! Practicing our tactical coordination gives us a decisive edge in the Holy Grail War. Our synchronicity is higher than ever!`,
    emotion: 'happy'
  };
}
