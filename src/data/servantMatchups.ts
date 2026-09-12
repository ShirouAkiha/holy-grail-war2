import { MatchupQuoteEntry, MasterServantInstance, ServantTemplate } from '../types';

export interface ResolvedMatchupDialogue {
  challengerLine: string;
  defenderLine: string;
  tag: string;
  themeColor: string;
  isMirrorMatch: boolean;
}

/**
 * The definitive pairwise matchup dialogue matrix for all 13 core Heroic Spirits.
 * Keyed by [challengerServantId][opponentServantId].
 * Each entry includes:
 * - intro: Challenger's spoken dialogue upon meeting this specific opponent
 * - retort: Defender's immediate counter-banter response
 * - tag: Thematic title badge of this specific rivalry / encounter
 */
export const SERVANT_MATCHUP_DATABASE: Record<string, Record<string, MatchupQuoteEntry>> = {
  // =========================================================================
  // 1. ARTORIA PENDRAGON (SABER)
  // =========================================================================
  artoria_pendragon: {
    artoria_pendragon: {
      intro: "Another bearer of the Holy Sword Caliburn? Show me if your resolve matches the burden of Britain!",
      retort: "A mirror of myself... The weight of the kingdom cannot be shared. Let our blades determine who stands!",
      tag: "MIRROR OF CAMELOT"
    },
    gilgamesh_archer: {
      intro: "Gilgamesh! Cease your haughty insolence! I rejected your proposals in life, and I reject your arrogance now!",
      retort: "Fuhahaha! Still as defiant as ever, Saber! A king is meant to be adorned, and you shall submit to my treasury!",
      tag: "REJECTION OF THE GOLDEN KING"
    },
    scathach_lancer: {
      intro: "Queen of the Land of Shadows... The legendary immortal warrior. My holy sword shall test your spear!",
      retort: "The King of Knights herself. Let us see if your sacred blade can pierce the armor of death!",
      tag: "CROWN VS LAND OF SHADOWS"
    },
    jeanne_darc_ruler: {
      intro: "Maiden of Orleans, ruler of the Holy Grail War. If our paths must cross in combat, I shall fight with absolute honor.",
      retort: "King of Britain, your righteous heart is known to heaven. Let this spar be governed by divine grace.",
      tag: "RIGHTEOUS KINGS & SAINTS"
    },
    jeanne_alter: {
      intro: "Dragon Witch... Your soul is blackened by vengeance. Lay down your cursed banner before Excalibur purges it!",
      retort: "Shut your sanctimonious mouth, little king! Your holy light makes me want to vomit! Burn in black flame!",
      tag: "LIGHT OF CAMELOT VS DRAGON WITCH"
    },
    mhx_alter: {
      intro: "Who are you?! You wield twin dark blades and claim to hunt Sabers... and why are you eating bean paste?!",
      retort: "Target verified: Saber-class prime entity. Deploying dark matter reactor... Do not interrupt my tea break.",
      tag: "SABER HUNT: SPACE INTRUDER"
    },
    artoria_pendragon_alter: {
      intro: "My blackened shadow... A king must never rule by terror and tyranny! I shall reclaim what was lost!",
      retort: "Naive fool. Your soft-hearted ideals starved Britain to death. Pure, unyielding force is the only true kingship.",
      tag: "DUEL OF SOULS: LIGHT VS SHADOW"
    },
    nero_claudius_saber: {
      intro: "Emperor of Rome, your theater is grand, but a battlefield is not a stage for vanity. Draw your blade!",
      retort: "Umu! What a magnificent golden knight! But Rome's fiery passion shall outshine Britain's quiet stoicism!",
      tag: "RED SABER VS BLUE SABER"
    },
    emiya_archer: {
      intro: "Archer... There is an odd familiarity in the way you hold those dual swords. Let us see if your steel holds true!",
      retort: "Facing you again, Saber... My projections may be fakes, but I won't hold back against the King of Knights.",
      tag: "FAMILIAR STEEL"
    },
    heracles_berserker: {
      intro: "The great Heracles! Even madness cannot conceal your mythical glory. Prepare yourself, giant of Olympus!",
      retort: "■■■■■■■■■■■■---!! (The Berserker roars with colossal respect, swinging his stone slab with earth-shattering power!)",
      tag: "TWELVE LABORS TRIAL"
    },
    cu_chulainn_lancer: {
      intro: "Lancer of Ulster! Your crimson spear is renowned, but Invisible Air shall not yield an inch of ground!",
      retort: "Haha! You're as stubborn as ever, King of Knights! Let's see if your holy sword can parry my cursed thrust!",
      tag: "CELTIC SPEAR VS BRITISH SWORD"
    },
    karna_lancer: {
      intro: "Hero of Charity, son of Surya. The brilliance of your divine flame is unmatched. Let us clash with full valor!",
      retort: "King of Knights. Your chivalric spirit burns pure. It is an honor to offer my spear against your sword of promised victory.",
      tag: "NOBLE VOWS: SUN & SWORD"
    },
    adiosa_dragon_envoy: {
      intro: "What unfathomable draconic presence is this?! She steps between worlds... Dragon Core, ignite!",
      retort: "⟨ Krav'nok rath. ⟩ A noisy golden mortal with a dragon's spark... So small. It makes me want to squeeze you until you crack.",
      tag: "DRAGON CORE VS WORLD-PRUNER"
    }
  },

  // =========================================================================
  // 2. GILGAMESH (ARCHER)
  // =========================================================================
  gilgamesh_archer: {
    artoria_pendragon: {
      intro: "Saber! At last you grace my presence once more! Surrender your petty holy war and become the finest jewel in my vault!",
      retort: "King of Heroes, I would rather see Excalibur shattered than suffer your arrogant possessiveness! On guard!",
      tag: "CLAIM OF THE GOLDEN KING"
    },
    gilgamesh_archer: {
      intro: "An imposter dare wear the golden armor of Uruk?! Mongrel, there can be only one King beneath the heavens!",
      retort: "Fuhahaha! Look upon your own reflection, fool! Ea shall judge which of us is the true sovereign!",
      tag: "CLASH OF THE TWO KINGS"
    },
    scathach_lancer: {
      intro: "The immortal witch of the Land of Shadows... You seek death? Rejoice! My treasury holds weapons forged to slay immortals!",
      retort: "Golden King of Babylon. Many gods have tried to extinguish my life. Do not disappoint me with mere trinkets.",
      tag: "IMMORTALITY VS INFINITE TREASURY"
    },
    jeanne_darc_ruler: {
      intro: "Ruler? A naive farm girl pretending to mediate the war of kings? Do not presume to arbitrate over my will, saint!",
      retort: "King of Babylon, your pride blinds you to the sanctity of life. Even kings are bound by divine providence.",
      tag: "DIVINE ARBITER VS VAIN SOVEREIGN"
    },
    jeanne_alter: {
      intro: "A resentful phantom birthed from a counterfeit Grail? You are nothing more than a rabid cur barking at the stars!",
      retort: "Gold-plated peacock! I'll melt that gaudy armor down and drown you in your own precious treasures!",
      tag: "PEACOCK VS DRAGON WITCH"
    },
    mhx_alter: {
      intro: "What insolent creature from the cosmic void dares aim crimson light at the King?! Know your place, interloper!",
      retort: "Target spiritual density: off the charts. High-calorie golden entity detected. Commencing extermination sequence.",
      tag: "ANCIENT BABYLON VS SERVANT UNIVERSE"
    },
    artoria_pendragon_alter: {
      intro: "Hmph. Corrupted by the Grail's black mud, are you, Saber? You look far more fierce, but your defiance remains irritating!",
      retort: "Noisy golden archer. Keep barking from behind your vault before Excalibur Morgan cuts your throat.",
      tag: "DARK MAJESTY VS GOLDEN ARROGANCE"
    },
    nero_claudius_saber: {
      intro: "An emperor who turns war into a cabaret? How ridiculous! Rome was merely a province compared to ancient Uruk!",
      retort: "Umu! What a boastful golden fellow! But the beauty of the Roman stage shall humble even your ancient treasury!",
      tag: "GOLDEN THEATER VS BABYLONIAN VAULT"
    },
    emiya_archer: {
      intro: "You... Faker! A thief of legends dare present his cheap reproductions before the King?! I shall tear you to shreds!",
      retort: "Do you have enough weapons in stock, King of Heroes? Here I come—Infinite Creation of Swords!",
      tag: "FAKER VS ORIGINAL SOVEREIGN"
    },
    heracles_berserker: {
      intro: "The mighty Heracles reduced to a maddened beast... A tragic sight, demigod. I shall chain you with Enkidu once more!",
      retort: "■■■■■■■■■■■■---!! (The titan pounds his chest in fury, remembering ancient divine chains and charging with murderous wrath!)",
      tag: "DIVINE CHAINS OF ENKIDU"
    },
    cu_chulainn_lancer: {
      intro: "Hound of Culann! Have you come to be put on a leash, or shall I impale you upon a thousand ancestral spears?",
      retort: "Tch! You talk too much, goldie. All those flying swords won't save you if my Gáe Bolg reaches your chest first!",
      tag: "HOUND OF ULSTER VS KING OF HEROES"
    },
    karna_lancer: {
      intro: "Son of Surya... Karna. You alone among these mongrels possess a radiance worthy of looking upon. Let us see your divine spear!",
      retort: "King of Heroes. I appreciate your high regard. Prepare yourself, for the heat of the Sun knows no master.",
      tag: "MEETING OF SUPREME DEMIGODS"
    },
    adiosa_dragon_envoy: {
      intro: "A primordial entity from outside the Human Order? Hmph! Even stars and cosmic serpents bow before the King of Babylon!",
      retort: "⟨ Krav'nok zhal. ⟩ Such a noisy little insect wrapped in shiny yellow gravel. I will crush you into obsidian glass.",
      tag: "KING OF HEROES VS COSMIC PRUNER"
    }
  },

  // =========================================================================
  // 3. SCÁTHACH (LANCER)
  // =========================================================================
  scathach_lancer: {
    artoria_pendragon: {
      intro: "King of Knights, your holy sword has guided nations. Come, show me if your swordsmanship can overcome the spear of Dún Scáith!",
      retort: "Gatekeeper of the Land of Shadows, I accept your challenge! Excalibur shall meet your deadly runes!",
      tag: "HOLY SWORD & SHADOW SPEAR"
    },
    gilgamesh_archer: {
      intro: "King of Babylon. You boast countless noble armaments, yet a spear is only as lethal as the will behind it. Draw!",
      retort: "Arrogant woman! You shall drown beneath a rain of primordial divine weapons!",
      tag: "WARRIOR'S DISCIPLINE VS RAIN OF ARMS"
    },
    scathach_lancer: {
      intro: "Another keeper of the Land of Shadows? Could you be the one destined to grant me the death I seek?",
      retort: "A mirror of myself... If one of us must fall today, let it be an end worthy of our immortal craft!",
      tag: "DEATH-SEEKER'S MIRROR"
    },
    jeanne_darc_ruler: {
      intro: "Saint of Orleans. Your heart is pure, but a battlefield asks for resolve, not prayers. Defend yourself!",
      retort: "Lady Scáthach, my banner does not waver. The Lord grants strength to those who protect!",
      tag: "PRAYER VS PRIMORDIAL RUNE"
    },
    jeanne_alter: {
      intro: "Such unrefined, raging flame... Hatred may fuel your spirit, girl, but it makes your strikes predictable.",
      retort: "Old hag from the Land of Shadows! I don't need technique to burn you down to a pile of cinder!",
      tag: "DISCIPLINE VS WILDFIRE"
    },
    mhx_alter: {
      intro: "A warrior from the void wielding twin sabers of dark matter... Fascinating. Let me test your strange arts!",
      retort: "Target classification: Lancer entity with abnormal combat proficiency. Consuming sweet bean energy for evasion.",
      tag: "PRIMORDIAL RUNES VS DARK MATTER"
    },
    artoria_pendragon_alter: {
      intro: "The King of Knights dyed in black... Your strikes are heavier now, but heaviness alone cannot catch my red spear.",
      retort: "Spearwoman of shadows. Your endless lifespan ends here beneath Excalibur Morgan's dark blade.",
      tag: "DARK KING VS SHADOW QUEEN"
    },
    nero_claudius_saber: {
      intro: "Emperor of Rome. You have passion and flair, but your footwork leaves openings. Shall I instruct you?",
      retort: "Umu! A master spearwoman wishing to critique Rome's divine form? Very well, witness my supreme artistry!",
      tag: "TUTOR'S TRIAL: EMPEROR & SPEAR"
    },
    emiya_archer: {
      intro: "A nameless warrior who projects weapons with his soul... Your technique has reached the realm of mastery, swordsman.",
      retort: "Praised by the Queen of the Land of Shadows herself? I'm honored, but I have no intention of holding back.",
      tag: "WROUGHT IRON & SHADOW CRAFT"
    },
    heracles_berserker: {
      intro: "Heracles! Great hero who conquered twelve impossible labors! Can your God Hand endure the God Slayer spear?!",
      retort: "■■■■■■■■■■■■---!! (The hero roars defiantly, brandishing his blade to test his twelve lives against the death spear!)",
      tag: "GOD SLAYER VS GOD HAND"
    },
    cu_chulainn_lancer: {
      intro: "Cú Chulainn! Have you been slacking off since leaving Dún Scáith?! Raise your spear, pupil—let us see your growth!",
      retort: "Guh—! Shishou?! Why did it have to be you?! Fine! Don't blame me if my Gáe Bolg actually catches you this time!",
      tag: "MASTER & PUPIL: SPARRING OF DEATH"
    },
    karna_lancer: {
      intro: "Hero of Charity! You who surrendered your armor and wield the spear of Indra... A duel against you is a rare blessing.",
      retort: "Queen of Shadows. Your reputation precedes you across the ages. Let us ignite this field with our sacred weapons.",
      tag: "CLASH OF THE SUPREME SPEARS"
    },
    adiosa_dragon_envoy: {
      intro: "A primordial cosmic dragon... Even in the Land of Shadows, I have rarely sensed a presence so ancient and immense.",
      retort: "⟨ Voth Krav'nok. ⟩ You smell like dried bones and old magic. Stand still so my ruin beam can petrify you cleanly.",
      tag: "IMMORTAL HUNTER VS DRAGON ENVOY"
    }
  },

  // =========================================================================
  // 4. JEANNE D'ARC (RULER)
  // =========================================================================
  jeanne_darc_ruler: {
    artoria_pendragon: {
      intro: "King of Knights, it is an honor to cross paths with such a noble ruler. May the light of truth guide our duel!",
      retort: "Holy Maiden of France, your steadfast resolve is an inspiration. Saber, Artoria Pendragon, accepts your challenge!",
      tag: "THE SACRED KNIGHTHOOD"
    },
    gilgamesh_archer: {
      intro: "King of Babylon, your excessive pride and tyranny disrupt the balance of the Grail. I must ask you to stand down!",
      retort: "Fuhahaha! A saint lecturing the King of Heroes? Know your place before I pierce your precious banner with Ea!",
      tag: "JUDGMENT OF THE RULER"
    },
    scathach_lancer: {
      intro: "Lady Scáthach, your desire to find an end to your immortality weighs heavily on my heart. Let my banner bring you peace.",
      retort: "Kind saint. Peace is not what I seek upon the battlefield—only a blow capable of piercing this immortal flesh!",
      tag: "DIVINE COMPASSION & WARRIOR'S WILL"
    },
    jeanne_darc_ruler: {
      intro: "Another Jeanne? Could this be a trial of my faith, or a phantom conjured by the Grail?",
      retort: "If God has placed another reflection before me, then let us pray together and test our devotion!",
      tag: "ECHO OF ORLEANS"
    },
    jeanne_alter: {
      intro: "My other self... I know the agony and betrayal you felt at the stake. But drowning in hatred will never save you!",
      retort: "Shut up! Shut up, you hypocritical saint! I was born from the flames of vengeance, and I will burn you to ash!",
      tag: "ORLEANS TRAGEDY: SAINT VS WITCH"
    },
    mhx_alter: {
      intro: "Um... Excuse me? You seem to be dressed as a student from another galaxy... Why are you brandishing weapons at me?",
      retort: "Target: White-robed holy maiden. High spiritual luminosity detected. Commencing neutralization for peaceful snacking.",
      tag: "HOLY MAIDEN & COSMIC RAIDER"
    },
    artoria_pendragon_alter: {
      intro: "King of Knights... You have traded your noble ideals for ruthless oppression. I must intervene to protect the innocent!",
      retort: "Save your preaching for church, saint. Ideals don't win wars—absolute power does. Get out of my path.",
      tag: "FAITH VS TYRANNY"
    },
    nero_claudius_saber: {
      intro: "Emperor Nero... Rome's history with the faithful was turbulent, yet I see no malice in your radiant spirit.",
      retort: "Umu! A holy maiden with a glorious banner! Sing praise with me, Jeanne, and let Rome's stage bloom with roses!",
      tag: "MAIDEN OF FRANCE & EMPEROR OF ROME"
    },
    emiya_archer: {
      intro: "Nameless hero, your eyes carry the exhaustion of someone who has saved countless lives without salvation. May God comfort you.",
      retort: "A Guardian doesn't need salvation, Ruler. Just do your job as an arbiter and let me handle the cleanup.",
      tag: "GUARDIAN'S BURDEN & HOLY GRACE"
    },
    heracles_berserker: {
      intro: "Great Heracles, trapped in madness! In the name of the Lord, let Luminosité Eternelle calm your torment!",
      retort: "■■■■■■■■■■■■---!! (The giant roars against the blinding holy light, his muscles tightening for an unstoppable charge!)",
      tag: "HOLY BANNER VS MIGHT OF HERCULES"
    },
    cu_chulainn_lancer: {
      intro: "Hound of Ulster, your fierce loyalty is commendable, but your red spear brings death wherever you tread. Halt!",
      retort: "Hey now, holy lady, don't look at me like that! A warrior's gotta fight when summoned. Let's see your defenses!",
      tag: "CELTIC ROVER & HOLY MAIDEN"
    },
    karna_lancer: {
      intro: "Hero of Charity... Your selflessness in giving away your own armor reminds me of the greatest martyrs. I revere your heart.",
      retort: "Holy Maiden. I simply acted in accordance with my father's light. It is an honor to face your pure flag.",
      tag: "CHARITY & MARTYRDOM"
    },
    adiosa_dragon_envoy: {
      intro: "Lord have mercy... What cosmic calamity stands before us?! Hold fast, my banner! We shall not falter!",
      retort: "⟨ Voth Krav'nok kri. ⟩ Such an annoying white fluttering cloth. I will vaporize it and crystallize you where you stand.",
      tag: "SAINT'S PRAYER VS AZURE RUIN"
    }
  },

  // =========================================================================
  // 5. JEANNE D'ARC ALTER (AVENGER)
  // =========================================================================
  jeanne_alter: {
    artoria_pendragon: {
      intro: "Oh, look! The celebrated King of Knights! Let's see how noble you look when your shiny armor is charred black!",
      retort: "Your anger is immense, Avenger, but fury without discipline will only dull your blade. Face me!",
      tag: "DRAGON WITCH VS KING OF KNIGHTS"
    },
    gilgamesh_archer: {
      intro: "King of Babylon! All that gleaming gold makes for the perfect pyre! I'm going to roast you alive in that flashy suit!",
      retort: "Insolent wench! A mongrel drenched in counterfeit vengeance dares raise her torch against the King?! Perish!",
      tag: "HELLFIRE VS BABYLONIAN GOLD"
    },
    scathach_lancer: {
      intro: "Land of Shadows Queen, huh? Think you can teach me a lesson, old woman? I'll burn your spooky land to cinder!",
      retort: "Fierce words, little witch. But passion alone cannot deflect a strike aimed with two millennia of precision.",
      tag: "WILD WITCH VS ANCIENT SPEAR"
    },
    jeanne_darc_ruler: {
      intro: "There you are, you disgusting goody-two-shoes! How dare you walk around smiling after what France did to us?! BURN!",
      retort: "Jeanne... I will not raise my sword out of malice, but I will defend this world from your hatred with all my heart!",
      tag: "THE BURNING STAKE OF ORLEANS"
    },
    jeanne_alter: {
      intro: "What kind of cheap joke is this?! Another me?! There's only room for ONE Dragon Witch in this wretched world!",
      retort: "Ha! Who are you calling a copy, you pale imitator?! I'll incinerate you until there's no trace left!",
      tag: "MIRROR OF THE DRAGON WITCH"
    },
    mhx_alter: {
      intro: "Hey! What's with that getup?! And why are you staring at me while munching on Japanese pastries?! Stop that!",
      retort: "Avenger entity detected: High emotional temperature, flammable temperament. Commencing chilling countermeasures.",
      tag: "BLACK FLAMES & DARK MATTER"
    },
    artoria_pendragon_alter: {
      intro: "Saber Alter! Finally someone with decent taste in black armor! But don't think for a second I'm going to follow your orders!",
      retort: "Tch. A noisy, shrieking witch. Stand down before Excalibur Morgan cuts your complaints short.",
      tag: "RIVALRY OF THE BLACK SHADOWS"
    },
    nero_claudius_saber: {
      intro: "Red Saber! Your loud voice and obnoxious theatrics are giving me a headache! Time to set your theater on fire!",
      retort: "Umu! What a passionate and fiery maiden! But true artistry cannot be consumed by mere flame! En garde!",
      tag: "BURNING THEATER: ROSES VS FLAME"
    },
    emiya_archer: {
      intro: "Look at this cynical jerk pretending to be so cool and detached. Let's see you keep that poker face while turning to ash!",
      retort: "I've dealt with moody teenagers with fire magic before. Try not to embarrass yourself, Dragon Witch.",
      tag: "CYNICAL GUARDIAN VS FIERY AVENGER"
    },
    heracles_berserker: {
      intro: "A giant mountain of muscle?! Fine by me! Even Greek demigods burn when La Grondement Du Haine roars!",
      retort: "■■■■■■■■■■■■---!! (Heracles swings his massive stone sword, creating a sonic shockwave that scatters her initial sparks!)",
      tag: "TITAN'S CLASH: RAGE VS MUSCLE"
    },
    cu_chulainn_lancer: {
      intro: "Oh, the Hound of Culann. Aren't you usually dead in the first five minutes? Let me speed up the process!",
      retort: "Whoa, vicious tongue on this one! You're gonna have to catch me first if you want to burn this dog!",
      tag: "HOUND EVASION VS DRAGON WITCH"
    },
    karna_lancer: {
      intro: "You think your holy sun flames are hotter than my burning hatred?! Let's see whose fire consumes who!",
      retort: "Flame born of hatred only consumes the one who kindles it. If you wish to test the Sun, I shall answer.",
      tag: "SOLAR HEAT VS DRAGON PYRE"
    },
    adiosa_dragon_envoy: {
      intro: "Dragon Envoy?! That title belongs to ME and Fafnir! What right does a cosmic lizard have to strut around here?!",
      retort: "⟨ Shak zhal, Krav'nok. ⟩ A noisy human claiming dragons? Pathetic larva. I shall prune you along with this soil.",
      tag: "DRAGON WITCH VS PRIMORDIAL DRAGON"
    }
  },

  // =========================================================================
  // 6. MYSTERIOUS HEROINE X ALTER (BERSERKER)
  // =========================================================================
  mhx_alter: {
    artoria_pendragon: {
      intro: "Target confirmed: Saber-class prime archetype, Artoria Pendragon. Dual crimson blades ignited... Eradicating all Sabers.",
      retort: "Why are you calling me an 'archetype'?! And what is that bizarre uniform?! Defend yourself, strange warrior!",
      tag: "SABER EXTERMINATION PROTOCOL"
    },
    gilgamesh_archer: {
      intro: "Golden lifeform emitting excessive luxury radiation. High threat level to cosmic confectionery supply. Eliminating target.",
      retort: "What absurd drivel are you muttering, girl?! You dare prioritize sweets over the King's grandeur?! Die!",
      tag: "COSMIC RAIDER VS ANCIENT GOLD"
    },
    scathach_lancer: {
      intro: "Ancient martial entity detected. Analyzing Land of Shadows rune matrix... Overriding with Dark Matter reactor output.",
      retort: "Intriguing weapons and extraterrestrial runes. Let us see if your cosmic power can match my ancient spearmanship!",
      tag: "VOID CAVALIER VS SHADOW QUEEN"
    },
    jeanne_darc_ruler: {
      intro: "White-robed arbiter entity. Please do not confiscate my Japanese confectionery reserves. Resistance will be met with force.",
      retort: "I have no intention of taking your snacks! But brandishing weapons in the sacred arena cannot be overlooked!",
      tag: "SNACK DEFENSE PROTOCOL"
    },
    jeanne_alter: {
      intro: "High-heat Avenger entity. Your flames are disrupting my bean jelly shelf life. Calibrating cold dark-matter slashes.",
      retort: "Who cares about your stupid bean jelly?! I'll roast you and your goofy space blades in dragon fire!",
      tag: "DARK MATTER VS HELLFIRE"
    },
    mhx_alter: {
      intro: "Duplicate Dark Cavalier? Imposter... Are you here to steal my premium wagashi?! I will NOT surrender my snacks!",
      retort: "Negative. I am the true consumer of cosmic red bean paste. Prepare for synchronized Cross-Calibur annihilation!",
      tag: "CIVIL WAR FOR THE LAST WAGASHI"
    },
    artoria_pendragon_alter: {
      intro: "Saber Alter... You look familiar, yet you prefer fast food burgers while I represent refined Japanese sweets. A clash of philosophies!",
      retort: "Hmph. Junk food or traditional snacks, it makes no difference. Get out of my sight before I crush your reactor.",
      tag: "BURGER VS WAGASHI: CLASH OF ALTERS"
    },
    nero_claudius_saber: {
      intro: "Saber entity detected in crimson dress. High volume vocal output detected. Initiating silence protocol.",
      retort: "Umu! Silence my glorious singing?! Unforgivable! Rome's divine melody shall drown out your cosmic humming!",
      tag: "SONG OF ROME VS COSMIC SILENCE"
    },
    emiya_archer: {
      intro: "Archer entity displaying superior culinary magecraft capabilities. Surrender your sweet recipes and no one gets hurt.",
      retort: "Wait, you're attacking me just to extort pastry recipes?! Good grief, Artoria variants never change...",
      tag: "CHEF'S HOSTAGE: THE SWEETS PROTOCOL"
    },
    heracles_berserker: {
      intro: "Immense physical entity detected. Calculating kinetic resistance... Switching dual crimson blades to heavy cleave.",
      retort: "■■■■■■■■■■■■---!! (The hero roars, swinging his stone sword with seismic power against her dual energy sabers!)",
      tag: "SPACE FORCE VS MYTHIC TITAN"
    },
    cu_chulainn_lancer: {
      intro: "High-agility Lancer entity. Evasion probability: 89%. Engaging hyper-speed tracking vector. Cross-Calibur locked.",
      retort: "Whoa, those twin red glow-sticks are moving fast! Looks like I can't afford to blink against this space kid!",
      tag: "HIGH SPEED CHASE: HOUND & JET"
    },
    karna_lancer: {
      intro: "Solar entity radiating extreme thermal output. Threat to pastry preservation: critical. Deploying dark matter cooling slash.",
      retort: "Your blade carries the cold vacuum of the void. Let us see if it can withstand the heat of the midday sun.",
      tag: "COSMIC VACUUM VS SOLAR SPEAR"
    },
    adiosa_dragon_envoy: {
      intro: "Cataclysmic draconic sovereign from outer sector Lyozes. Target spiritual density exceeds galactic charts. Full overload engaged!",
      retort: "⟨ Voth zul Krav'nok! ⟩ Oh? A tiny dark creature buzzing like a cosmic wasp. Let me petrify you into black glass.",
      tag: "SERVANT UNIVERSE VS LYONIAN DRAGON"
    }
  },

  // =========================================================================
  // 7. ARTORIA PENDRAGON ALTER (SABER)
  // =========================================================================
  artoria_pendragon_alter: {
    artoria_pendragon: {
      intro: "Look at yourself, King of Knights. Blinded by chivalric fairy tales while Britain crumbled. I shall bury your weakness once and for all.",
      retort: "I carried the weight of my people with honor! A kingdom built upon terror is no kingdom at all! Excalibur, ignite!",
      tag: "THRONE OF SHADOWS: LIGHT VS DARK"
    },
    gilgamesh_archer: {
      intro: "King of Babylon. Still flaunting your golden treasures like a pampered prince? Let us see if your vault can stop Excalibur Morgan!",
      retort: "Fuhahaha! What insolence from a corrupted doll! I shall pin you to the earth with celestial blades, black knight!",
      tag: "BLACK SWORD VS HEAVEN'S VAULT"
    },
    scathach_lancer: {
      intro: "Queen of the Land of Shadows. If you seek death so desperately, step forward. My black blade grants no mercy.",
      retort: "Cold, heavy, and ruthless. A magnificent stroke, Black King. Show me if it has the power to reach my heart!",
      tag: "SHADOW SOVEREIGNS CLASH"
    },
    jeanne_darc_ruler: {
      intro: "Ruler. Your gentle prayers are useless on a battlefield of blood and iron. Disappear before I cut your banner down.",
      retort: "Artoria... The darkness around your heart cannot extinguish the oath you once swore. I will not yield!",
      tag: "IRON RULE VS SAINT'S BANNER"
    },
    jeanne_alter: {
      intro: "A screeching dragon witch... How noisy. If you think screaming makes you strong, prepare for a harsh awakening.",
      retort: "What did you say, you stuck-up goth king?! I'll burn that arrogant expression right off your face!",
      tag: "BLACK MAJESTY VS DRAGON WITCH"
    },
    mhx_alter: {
      intro: "Another version of me from space with a sweet tooth? Ridiculous. Go back to your pastries before I crush your reactor.",
      retort: "Fast-food consumer detected. Eliminating inferior culinary influence. Engaging Cross-Calibur.",
      tag: "FAST FOOD VS WAGASHI: ALTER RIVALRY"
    },
    artoria_pendragon_alter: {
      intro: "An exact copy of my corrupted Spirit Origin? Hmph. There is only room for one tyrant at the head of this army.",
      retort: "A mirror? Then prove your right to command. Only the strongest black sword shall rule.",
      tag: "MIRROR OF THE BLACK DRAGON"
    },
    nero_claudius_saber: {
      intro: "Emperor of Rome. Your theatrical posturing disgusts me. War is not art—it is absolute submission.",
      retort: "Umu! What a grim and sour expression! Rome shall teach you that even in battle, passion and beauty reign supreme!",
      tag: "DARK TYRANNY VS GOLDEN THEATER"
    },
    emiya_archer: {
      intro: "Archer. You look as weary as ever. Are you still chasing that hollow dream of saving everyone?",
      retort: "It may be a hollow dream, Saber Alter, but I won't let you trample over it with brute force. Trace on!",
      tag: "CYNICAL IDEALIST VS RUTHLESS KING"
    },
    heracles_berserker: {
      intro: "Heracles... The greatest brute of Olympus. Let us see how many times Excalibur Morgan must kill you before you stay down!",
      retort: "■■■■■■■■■■■■---!! (Heracles roars with titanic ferocity, determined to shatter the dark blade that threatens him!)",
      tag: "NINE LIVES VS CORRUPTED EXCALIBUR"
    },
    cu_chulainn_lancer: {
      intro: "Hound of Culann. Try dodging a wave of dark dragon breath with your cheap parlor tricks.",
      retort: "Tch! You're a lot scarier in black, Saber! Guess I'll have to pierce your heart before that mega-blast goes off!",
      tag: "DEADLY THRUST VS BLACK BURST"
    },
    karna_lancer: {
      intro: "Hero of Charity. Your golden radiance is blinding. I shall drown your sacred fire beneath the black mud of the Grail.",
      retort: "Black King. No darkness can extinguish the sun while Surya watches over this field. On guard.",
      tag: "SOLAR FLAME VS GRAIL CORRUPTION"
    },
    adiosa_dragon_envoy: {
      intro: "A primordial cosmic dragon... You radiate an unnatural gravitational pull. Let us see if your scales can withstand Excalibur Morgan!",
      retort: "⟨ Voth Krav'nok. ⟩ Such heavy black mana from a small mortal container. An interesting snack, but still just dust.",
      tag: "DRAGON OF CAMELOT VS DRAGON OF LYONA"
    }
  },

  // =========================================================================
  // 8. NERO CLAUDIUS (SABER)
  // =========================================================================
  nero_claudius_saber: {
    artoria_pendragon: {
      intro: "Umu! At last, the celebrated King of Knights! The audience holds its breath for the clash of the two Sabers! Behold Rome's passion!",
      retort: "Emperor Nero, your enthusiasm is noted, but my blade knows only duty and honor. Prepare yourself!",
      tag: "BLUE & RED: CLASH OF SABERS"
    },
    gilgamesh_archer: {
      intro: "King of Heroes! You boast an ancient treasury, but do you possess the true heart of an artist?! My Golden Theater shall outshine Babylon!",
      retort: "Fuhahaha! An emperor whose greatest achievement is shouting on stage? How amusing! I shall bury your theater in treasures!",
      tag: "AESTUS DOMUS VS GATE OF BABYLON"
    },
    scathach_lancer: {
      intro: "Queen of the Land of Shadows! What a dignified and alluring warrior! Master, watch closely as Rome spars with this legendary spear!",
      retort: "Your confidence is charming, young emperor. But a performance that lacks martial discipline will end in swift defeat.",
      tag: "ROYAL THEATER & ANCIENT DISCIPLINE"
    },
    jeanne_darc_ruler: {
      intro: "Umu! Saint Jeanne! Your pure heart and glorious banner deserve thunderous applause! Let us create a masterpiece of a duel!",
      retort: "Emperor Nero, your joy is infectious! May this contest honor the virtues of courage and respect.",
      tag: "SAINT & ARTIST: GLORIOUS STAGE"
    },
    jeanne_alter: {
      intro: "My, what a dark and brooding maiden! Such intense emotion makes for a magnificent tragedy! Let the roses bloom amidst your fire!",
      retort: "Stop talking to me like I'm an actress in your stupid play! I'll burn that fancy red dress off your back!",
      tag: "FLAMING TRAGEDY: WITCH & EMPEROR"
    },
    mhx_alter: {
      intro: "A mysterious visitor from the stars wielding twin crimson lights! How exotic! Rome welcomes you to the grand stage!",
      retort: "Noisy royal entity. High decibel level detected. Deploying Dark Matter suppressors to restore quiet.",
      tag: "COSMIC STRANGER IN THE COLISEUM"
    },
    artoria_pendragon_alter: {
      intro: "Oh? The King of Knights draped in midnight black! Such gothic gravitas! But Rome's blazing sun will pierce your darkness!",
      retort: "Noisy clown in red. I will slice through your theater and your chatter with a single stroke.",
      tag: "MIDNIGHT TYRANT & CRIMSON EMPEROR"
    },
    nero_claudius_saber: {
      intro: "Umu?! Another Nero Claudius?! Two supreme geniuses of Rome sharing one stage?! The audience will faint from pure bliss!",
      retort: "Umu! Exactly so! Only Rome could produce another artist as peerless as myself! Let the ultimate duet commence!",
      tag: "DOUBLE EMPEROR: DUET OF ROSES"
    },
    emiya_archer: {
      intro: "Nameless red archer! You carry yourself like an overworked stage manager! Come, show me the brilliance of your projected steel!",
      retort: "Stage manager? Good grief... Dealing with flamboyant emperors was never in my job description. Trace on!",
      tag: "STAGE MANAGER & PRIMA DONNA"
    },
    heracles_berserker: {
      intro: "The legendary Heracles! The greatest hero of the ancient world! To fight you in my Golden Theater is the pinnacle of glory! Umu!",
      retort: "■■■■■■■■■■■■---!! (Heracles roars with earth-shattering power, unbothered by theatrics and ready to crush the stage!)",
      tag: "HERCULEAN EPIC IN THE COLISEUM"
    },
    cu_chulainn_lancer: {
      intro: "Lancer of Ulster! Your reputation for swiftness is famous! Let us see if your Gáe Bolg can catch Rome's dancing crimson meteor blade!",
      retort: "Haha! You're a lively one, Saber! Don't trip over your own dress while trying to dodge my spear!",
      tag: "CELTIC HOUND & ROMAN ROSE"
    },
    karna_lancer: {
      intro: "Hero of Charity! Wreathed in the dazzling light of Surya! Such peerless nobility! What a magnificent duel this shall be!",
      retort: "Emperor of Rome. Your passion burns bright. I shall meet your artistic conviction with the sacred fire of India.",
      tag: "RADIANCE OF SURYA & ROSE OF ROME"
    },
    adiosa_dragon_envoy: {
      intro: "Umu?! What a magnificent, awe-inspiring draconic sovereign! That azure-magenta aura is breathtaking! Are you a guest star from the stars?!",
      retort: "⟨ Krav'nok zhal. ⟩ A small red creature screaming compliments. Irritatingly loud, yet cute... I will crush you gently into obsidian glass.",
      tag: "EMPEROR'S AUDIENCE WITH THE DRAGON"
    }
  },

  // =========================================================================
  // 9. EMIYA (ARCHER)
  // =========================================================================
  emiya_archer: {
    artoria_pendragon: {
      intro: "Facing you as an opponent, Saber... I suppose fate has a cruel sense of humor. Show me if your holy sword still cuts through hesitation.",
      retort: "Archer... I do not know why your eyes carry such sorrow, but as a knight, I will meet your swords with everything I have!",
      tag: "SWORN BLADES & DISTANT MEMORIES"
    },
    gilgamesh_archer: {
      intro: "King of Heroes. You have infinite treasures in your vault, but you're not a wielder—just an owner. My projections will outmatch your arrogance!",
      retort: "Insolent insect! A lowly faker dare preach to the King about mastery?! I shall nail your corpse to the ground with your own counterfeits!",
      tag: "FAKER VS KING: UNLIMITED BLADE WORKS"
    },
    scathach_lancer: {
      intro: "The legendary teacher of heroes... To cross blades with Scáthach herself is a true trial. Let's see if my projected armaments can endure your runes.",
      retort: "Your projections carry the soul of their original makers. A fascinating craft, blacksmith hero. Let me test their temper!",
      tag: "FORGED IN STEEL & SHADOWS"
    },
    jeanne_darc_ruler: {
      intro: "Ruler. You arbitrate this war with pure intentions, but ideals alone won't protect you from those who desire the Grail's corruption.",
      retort: "Archer, I understand your cynicism, but hope is never meaningless. Let us contest our beliefs with honor.",
      tag: "CYNIC'S REALITY & SAINT'S HOPE"
    },
    jeanne_alter: {
      intro: "Dragon Witch. Anger is a poor substitute for technique. If all you have is a burning tantrum, you won't last long against projected steel.",
      retort: "Tantrum?! You smirking faker, I'll turn you and your knockoff junk swords into molten slag!",
      tag: "PROJECTED STEEL VS WRATHFUL FLAME"
    },
    mhx_alter: {
      intro: "Hold on... Another Artoria, but wielding dark energy sabers and extorting sweets? Why do I always end up babysitting Sabers?!",
      retort: "Target identified: Skilled projection chef. Hand over your top-tier confectionery formulas immediately.",
      tag: "EXASPERATED GUARDIAN & SWEETS HUNTER"
    },
    artoria_pendragon_alter: {
      intro: "Saber Alter. Seeing you like this... It's proof that absolute power without ideals is just an executioner's axe. I won't let you pass.",
      retort: "Hypocrite. You sacrificed your own soul to become an executioner of the Counter Force. Don't lecture me about ideals.",
      tag: "COUNTER FORCE EXECUTIONERS"
    },
    nero_claudius_saber: {
      intro: "Emperor of Rome. Your confidence is enviable, but keeping your guard wide open for theatrical applause is going to cost you.",
      retort: "Umu! A sharp tongue for an archer! But Rome's swordsmanship is as lethal as it is gorgeous! Trace whatever you like!",
      tag: "PRACTICAL GUARDIAN & DRAMATIC EMPEROR"
    },
    emiya_archer: {
      intro: "Another nameless guardian forged in steel? If you share my regrets, then you already know how this fight ends.",
      retort: "A mirror of my own foolish ideals... Let's see whose Unlimited Blade Works has forged the sharper conviction.",
      tag: "MIRROR OF THE WROUGHT IRON HERO"
    },
    heracles_berserker: {
      intro: "Heracles... Taking all twelve of your lives in one battle is an impossible task for ordinary men. Good thing I'm just a faker. Trace on!",
      retort: "■■■■■■■■■■■■---!! (The hero roars, remembering the bowman who once carved through six of his lives in the Fuyuki forest!)",
      tag: "TWELVE LIVES: REMATCH IN STEEL"
    },
    cu_chulainn_lancer: {
      intro: "Lancer. Still running around stabbing people with that cursed red spear? Let's settle the score from that school courtyard.",
      retort: "Haha! The red archer who thinks he's a swordsman! Let's see if your Rho Aias can stop my Gáe Bolg this time!",
      tag: "FUYUKI RIVALRY: HOUND & ARCHER"
    },
    karna_lancer: {
      intro: "Hero of Charity... Even with infinite projected weapons, facing the Son of Surya is a terrifying prospect. I'll need everything I have.",
      retort: "Nameless hero. I sense the weight of countless battles in your spirit origin. Draw your steel, and let us not hold back.",
      tag: "STEEL PROJECTION & SACRED SUN"
    },
    adiosa_dragon_envoy: {
      intro: "What kind of monstrous entity is this?! The structure of my projections is disintegrating just standing near her gravitational field!",
      retort: "⟨ Voth Krav'nok. ⟩ Replicating tiny metal toys with mortal mind-threads? How quaint. Crumble into ash.",
      tag: "UNLIMITED BLADES VS DRACONIC PRUNING"
    }
  },

  // =========================================================================
  // 10. HERACLES (BERSERKER)
  // =========================================================================
  heracles_berserker: {
    artoria_pendragon: {
      intro: "■■■■■■■■■■■■---!! (The Great Hero of Olympus roars, raising his stone slab to test the King of Britain's holy blade!)",
      retort: "Heracles! Even with your mind lost to Madness Enhancement, your warrior's pride burns bright! Come!",
      tag: "HERCULEAN TEST OF CAMELOT"
    },
    gilgamesh_archer: {
      intro: "■■■■■■■■■■■■---!! (Heracles bellows with incandescent rage, remembering the Golden King's chains and surging forward with unstoppable fury!)",
      retort: "Fuhahaha! Still struggling against your fate, beast?! Enkidu's chains await your neck once more!",
      tag: "CHAINS OF FATE: TITAN VS BABYLON"
    },
    scathach_lancer: {
      intro: "■■■■■■■■■■■■---!! (The titan pounds his chest, recognizing a peerless warrior capable of challenging his God Hand!)",
      retort: "Magnificent! That is the roar of a true demigod! Let my God Slayer spear pierce all twelve of your lives!",
      tag: "GOD SLAYER VS THE TWELVE LABORS"
    },
    jeanne_darc_ruler: {
      intro: "■■■■■■■■■■■■---!! (The Berserker charges forward like an avalanche, shaking the earth with seismic footsteps!)",
      retort: "Great hero! Let Luminosité Eternelle protect against your overwhelming fury! God is here with me!",
      tag: "SHIELD OF FAITH VS OLYMPIAN ROAR"
    },
    jeanne_alter: {
      intro: "■■■■■■■■■■■■---!! (The titan ignores the dragon flames licking at his skin and swings his colossal slab blade!)",
      retort: "Guh—! You giant musclebound monster! How can you run right through my hellfire without slowing down?!",
      tag: "TITAN'S ENDURANCE VS HELLFIRE"
    },
    mhx_alter: {
      intro: "■■■■■■■■■■■■---!! (Heracles swings his stone blade, creating sonic booms that buffet the space raider!)",
      retort: "Kinetic displacement exceeding safety margins! Dark Matter thrusters engaging emergency evasive maneuvers!",
      tag: "MYTHICAL FORCE VS COSMIC HYPERDRIVE"
    },
    artoria_pendragon_alter: {
      intro: "■■■■■■■■■■■■---!! (The giant roars against the dark mana radiating from Excalibur Morgan, meeting brute force with mythic strength!)",
      retort: "Roar all you want, giant. Your God Hand is merely twelve targets for my black blade to incinerate.",
      tag: "NINE LIVES VS EXCALIBUR MORGAN"
    },
    nero_claudius_saber: {
      intro: "■■■■■■■■■■■■---!! (Heracles crushes the earth beneath his feet, lunging toward the theatrical Roman emperor!)",
      retort: "Umu! What incredible, untamed raw power! The Golden Theater trembles with the might of Olympus!",
      tag: "THE TWELVE LABORS ON THE ROMAN STAGE"
    },
    emiya_archer: {
      intro: "■■■■■■■■■■■■---!! (Heracles glares at the twin projected blades of the archer, remembering their desperate Fuyuki duel!)",
      retort: "I know that look. You remember our last spar. Here I come, Heracles—Nine Lives Blade Works!",
      tag: "THE REMATCH OF NINE LIVES"
    },
    heracles_berserker: {
      intro: "■■■■■■■■■■■■---!! (Heracles roars at his twin reflection, a clash of two identical Olympian titans shaking the foundation of the world!)",
      retort: "■■■■■■■■■■■■---!! (The mirror giant roars back with equal seismic intensity, stone blade meeting stone blade!)",
      tag: "TITANIC CATACLYSM: DUAL LABORS"
    },
    cu_chulainn_lancer: {
      intro: "■■■■■■■■■■■■---!! (The giant swings his massive slab, forcing the agile Celtic hound into frantic acrobatic evasions!)",
      retort: "Whoa, easy there, big guy! One hit from that rock and I'm pancake mix! Time to see if Gáe Bolg can pierce that thick hide!",
      tag: "HOUND EVASION VS TITAN'S CRUSH"
    },
    karna_lancer: {
      intro: "■■■■■■■■■■■■---!! (Heracles braces against the searing divine heat of the Indian sun god, unyielding in his charge!)",
      retort: "Great son of Zeus. Your fortitude is legendary across all mythologies. I shall honor your strength with Vasavi Shakti!",
      tag: "SON OF ZEUS VS SON OF SURYA"
    },
    adiosa_dragon_envoy: {
      intro: "■■■■■■■■■■■■---!! (Heracles roars against the draconic gravitational field, his muscles tearing as he defies cosmic weight!)",
      retort: "⟨ Shak zhal, Krav'nok! ⟩ Oh? A mortal brute defying the Weight of Heaven with pure muscle? How adorable. Die now.",
      tag: "MYTHIC FORTITUDE VS GRAVITATIONAL FIELD"
    }
  },

  // =========================================================================
  // 11. CÚ CHULAINN (LANCER)
  // =========================================================================
  cu_chulainn_lancer: {
    artoria_pendragon: {
      intro: "Yo, King of Knights! It's been a while since we traded blows. Let's see if your sword can keep up with my red spear!",
      retort: "Lancer of Ulster! Your agility is renowned, but Invisible Air will guide Excalibur true! En garde!",
      tag: "CELTIC ROVER & BRITISH CROWN"
    },
    gilgamesh_archer: {
      intro: "Hey, King of Babylon! Still hiding behind that vault of flying butter knives? Come down here and fight like a real warrior!",
      retort: "Impudent dog! You bark boldly for a mongrel whose heart is destined to be pierced by ancient armaments!",
      tag: "HOUND'S TAUNT & GOLDEN WRATH"
    },
    scathach_lancer: {
      intro: "Sh-Shishou?! What kind of rotten luck is this?! Look, can't we just pretend we didn't see each other today?!",
      retort: "Hahaha! Still terrified of a little training session, Cú Chulainn? Raise your spear—or I shall impale you where you stand!",
      tag: "PUPIL'S TERROR: SPAR OF DÚN SCÁITH"
    },
    jeanne_darc_ruler: {
      intro: "Holy maiden from France! Don't look at me so sternly, I'm just here for a good scrap! Try to keep up!",
      retort: "Hound of Ulster, I hold no grudge, but as an arbiter, I must ensure this duel remains just!",
      tag: "HOUND OF WAR & MAIDEN OF PEACE"
    },
    jeanne_alter: {
      intro: "Yikes, what a cranky dragon witch. You look like you need to blow off some steam! Care to spar with this old dog?",
      retort: "Old dog?! I'll turn you into roasted mutt, you insolent spearman! Gáe Bolg won't save you from dragon fire!",
      tag: "ROASTED MUTT VS FIERY WITCH"
    },
    mhx_alter: {
      intro: "A space knight who likes Japanese snacks? Lady, you're the strangest Berserker I've seen yet!",
      retort: "Target: High-speed Lancer entity. Red spear trajectory dangerous to snack integrity. Neutralizing with Cross-Calibur.",
      tag: "SPACE RAIDER & EARTHLY HOUND"
    },
    artoria_pendragon_alter: {
      intro: "Whoa, Saber, what happened to the shiny blue armor? You look ready to execute half the city! Guess I gotta watch my back!",
      retort: "Tch. A noisy hound from Ireland. Keep yapping before Excalibur Morgan cuts your tongue out.",
      tag: "LIGHTNING SPEAR & BLACK DRAGON"
    },
    nero_claudius_saber: {
      intro: "An emperor who fights in a ball gown? Haha! Rome sure knows how to put on a flashy show! Let's see your footwork!",
      retort: "Umu! A spirited and roguish hound! Rome's stage welcomes all heroic spirits! Dance with me, Lancer!",
      tag: "ROGUISH HOUND & RADIANT EMPEROR"
    },
    emiya_archer: {
      intro: "Hey there, red archer. Time to finish what we started in the Fuyuki schoolyard! Don't run away this time!",
      retort: "Run away? I was just giving you a head start, Lancer. Let's see if that red spear can break through my Rho Aias!",
      tag: "FUYUKI REMATCH: SPEAR & SHIELD"
    },
    heracles_berserker: {
      intro: "Heracles... Taking you on head-to-head is pure suicide, but hey—a warrior doesn't back down from a good death!",
      retort: "■■■■■■■■■■■■---!! (The giant roars, swinging his slab blade to swat the nimble Celtic hound like an insect!)",
      tag: "SUICIDE CHARGE: HOUND VS TITAN"
    },
    cu_chulainn_lancer: {
      intro: "Another Hound of Culann?! What, did the Grail conjure a shadow of my Ulster days?! May the fastest spear win!",
      retort: "Haha! You took the words right out of my mouth! Let's see whose Gáe Bolg reverses causality first!",
      tag: "DUEL OF THE TWO HOUNDS"
    },
    karna_lancer: {
      intro: "Hero of Charity! Wielding the divine spear of the King of Gods... Now THIS is a matchup worthy of the Ulster cycle!",
      retort: "Cú Chulainn. The famed hero of Ireland. Your spear is renowned for its swift lethality. Let us test our crafts.",
      tag: "RED SPEAR & SOLAR LANCE"
    },
    adiosa_dragon_envoy: {
      intro: "What kind of monstrous dragon is that?! Just standing near her feels like walking under ten tons of lead!",
      retort: "⟨ Voth Krav'nok. ⟩ A swift little blue flea hopping around. Let me petrify the earth so you have nowhere to run.",
      tag: "CELTIC EVASION VS DRACONIC GRAVITY"
    }
  },

  // =========================================================================
  // 12. KARNA (LANCER)
  // =========================================================================
  karna_lancer: {
    artoria_pendragon: {
      intro: "King of Knights. Your chivalric vow and unyielding devotion to your people mirror the duties of true royalty. Draw your holy blade.",
      retort: "Hero of Charity. Your nobility and radiant spirit are known across all eras. Let our clash honor our shared code of chivalry!",
      tag: "KNIGHTLY DUTY & SOLAR CHARITY"
    },
    gilgamesh_archer: {
      intro: "King of Heroes. I acknowledge your peerless treasury and primordial majesty. But the light of Surya bends to no king.",
      retort: "Fuhahaha! Well said, Karna! You alone among these mongrels understand the dignity of sovereigns! Let us clash!",
      tag: "SOVEREIGNS OF HEAVEN & EARTH"
    },
    scathach_lancer: {
      intro: "Queen of the Land of Shadows. Your mastery over runes and the spear has transcended mortal limits. It is a privilege to test my flame against you.",
      retort: "Hero of the Mahabharata. Your golden radiance is breathtaking. Show me if your divine spear can grant the death I desire!",
      tag: "PEERLESS SPEARS: RUNES & SOLAR FIRE"
    },
    jeanne_darc_ruler: {
      intro: "Holy Maiden of France. Your selfless sacrifice reminds me of the vows I swore to my father and friends. I shall fight with absolute respect.",
      retort: "Hero of Charity. Your pure heart honors the Holy Grail. May our combat be guided by peace and righteousness.",
      tag: "MARTYR'S FAITH & HERO'S CHARITY"
    },
    jeanne_alter: {
      intro: "Avenger. Hatred has blinded your eyes to the beauty of the world. Allow the sacred fire of Surya to burn away your malice.",
      retort: "Preach to someone who cares, golden boy! Your pious attitude makes me want to incinerate you on the spot!",
      tag: "SACRED SOLAR LIGHT VS MALICIOUS HELLFIRE"
    },
    mhx_alter: {
      intro: "A visitor from the stars wielding dual blades of the void... A warrior's heart transcends galaxies. Defend yourself.",
      retort: "Target: High-temperature solar Lancer. Thermal radiation threatening confectionery inventory. Deploying cold slashes.",
      tag: "SUN'S CORE VS COLD VOID"
    },
    artoria_pendragon_alter: {
      intro: "Black King of Knights. You have abandoned chivalry for cold tyranny. The sun shines upon all equally—it will not bow to darkness.",
      retort: "Save your sermon for the weak, Karna. When Excalibur Morgan falls, even your sun will be eclipsed in black.",
      tag: "ECLIPSE OF THE SUN: DARKNESS VS LIGHT"
    },
    nero_claudius_saber: {
      intro: "Emperor of Rome. Your passion and devotion to your people burn as brightly as any flame. Let us create a worthy contest.",
      retort: "Umu! How courteous and noble! Such dignity makes Rome proud to share the battlefield with you! En garde!",
      tag: "IMPERIAL PASSION & HEROIC NOBILITY"
    },
    emiya_archer: {
      intro: "Nameless archer. Your spirit origin bears the scars of countless selfless sacrifices. You are a true warrior of justice.",
      retort: "Coming from the Hero of Charity, that means a great deal. But I'll need all my projected steel to survive your spear.",
      tag: "UNSELFISH SPIRITS: STEEL & SUN"
    },
    heracles_berserker: {
      intro: "Great Heracles. Even stripped of your reason, the Olympian fire in your heart cannot be quenched. Vasavi Shakti shall honor you.",
      retort: "■■■■■■■■■■■■---!! (The titan roars in defiance, his stone blade cleaving through the air with titanic fury!)",
      tag: "SON OF SURYA VS SON OF ZEUS"
    },
    cu_chulainn_lancer: {
      intro: "Cú Chulainn. The hound of Ulster whose spear reverses cause and effect. A duel of lances between us shall be remembered.",
      retort: "Haha! You got that right, Karna! Let's see whose spear reaches its mark first—the red thrust or the sun's blast!",
      tag: "DUEL OF LEGENDARY LANCES"
    },
    karna_lancer: {
      intro: "Another manifestation of the Son of Surya? If destiny demands that I test myself against my own divine flame, so be it.",
      retort: "A mirror of charity and duty... Let the purity of our spears determine who carries the father's light forward.",
      tag: "DUAL RADIANCES OF SURYA"
    },
    adiosa_dragon_envoy: {
      intro: "An ancient sovereign dragon predating mortal civilization... The sun watches over all existence; I shall stand as its defender.",
      retort: "⟨ Voth Krav'nok. ⟩ Such a bright little flame. I have incinerated entire star clusters with Ixenor's breath—you are merely a candle.",
      tag: "SOLAR DEVOTION VS COSMIC PRUNER"
    }
  },

  // =========================================================================
  // 13. ADIOSA (FOREIGNER / DRAGON ENVOY)
  // =========================================================================
  adiosa_dragon_envoy: {
    artoria_pendragon: {
      intro: "⟨ Skar zhal, Krav'nok! ⟩ A golden mortal carrying a fragment of the Red Dragon... So tiny and fragile. It makes my claws itch to crush you.",
      retort: "What unfathomable dragon entity is this?! The pressure of her aura rivals the vortex of Camelot! Excalibur, protect Britain!",
      tag: "WORLD-PRUNER & RED DRAGON OF BRITAIN"
    },
    gilgamesh_archer: {
      intro: "⟨ Drazk'hlor Krav'nok. ⟩ A gaudy human decorated in yellow pebbles shouting about kingship. Your little toys will melt into black glass.",
      retort: "Insolent cosmic lizard! You dare look down upon the King of Heroes?! Ea shall sever your spatial anchors and return you to dust!",
      tag: "PRIMORDIAL VAULT VS INCINERATION OF AETHEL"
    },
    scathach_lancer: {
      intro: "⟨ Voth zul Adiosa. ⟩ An ancient immortal from the Land of Shadows? You seek an end to your existence? Dragon King Ixenor easily prunes such refuse.",
      retort: "Cosmic sovereign... If your azure ruin can truly end this endless life, then show me your fullest might!",
      tag: "COSMIC PRUNER & IMMORTAL SHADOW QUEEN"
    },
    jeanne_darc_ruler: {
      intro: "⟨ Shak zhal, Dra'vos. ⟩ A small female waving a white rag and mumbling to unseen spirits. Such an adorable, fragile mortal... I want to squeeze you until you pop.",
      retort: "Lord protect us! The oppressive weight of this entity's aura is terrifying! Luminosité Eternelle, shield our souls!",
      tag: "DIVINE BANNER VS THE WEIGHT OF HEAVEN"
    },
    jeanne_alter: {
      intro: "⟨ Krag zul Vael'ix. ⟩ A shrieking human pretending to summon dragons. Your dragon is a winged worm compared to the Skyborne of Aethelian.",
      retort: "Winged worm?! Who are you calling a worm, you oversized space lizard?! I'll burn your wings off and mount your horns on my wall!",
      tag: "DRAGON WITCH VS TRUE DRAGON ENVOY"
    },
    mhx_alter: {
      intro: "⟨ Vur Aeth'ra... ⟩ An extraterrestrial intruder with twin glowing red sticks. Your dark matter core smells like fermented sugar. Irritating.",
      retort: "Cataclysmic draconic sovereign detected. Target is interfering with confectionery digestion. Engaging full universe-cleaving protocol.",
      tag: "DARK CAVALIER VS COSMIC WORLD-PRUNER"
    },
    artoria_pendragon_alter: {
      intro: "⟨ Nok zul Krav'nok kri. ⟩ A corrupted mortal king saturated in Grail sludge. You are a biological malfunction on this planet. Pruning required.",
      retort: "Call me a malfunction? I have slain dragons in life, and I will sever your cosmic neck beneath Excalibur Morgan!",
      tag: "TYRANT DRAGON VS AETHELIAN ENVOY"
    },
    nero_claudius_saber: {
      intro: "⟨ Drazk'hlor! ⟩ A singing human in red silk... So noisy, yet so small. The intrusive urge to crush you beneath my heel is overwhelming.",
      retort: "Umu?! What a monstrous yet breathtaking cosmic dragon! Rome shall welcome you with an imperial performance like no other!",
      tag: "THE EMPEROR & THE STAR DRAGON"
    },
    emiya_archer: {
      intro: "⟨ Vrak'ix Krav'nok. ⟩ A human projecting false metal blades like an ant building a sandcastle. One stride of mine turns your hill to black obsidian.",
      retort: "Her gravitational field is warping the reality marble itself... Stay focused, Emiya—aim for the spiritual core! Trace on!",
      tag: "UNLIMITED BLADE WORKS VS BLACK GLASS STRIDE"
    },
    heracles_berserker: {
      intro: "⟨ Skar zhal! ⟩ A giant mortal trying to push against the Weight of Heaven. An impressive insect, but still just dust beneath Lyozes.",
      retort: "■■■■■■■■■■■■---!! (Heracles roars with unyielding defiance, veins bursting as he battles against the crushing draconic gravity!)",
      tag: "MYTHIC LABORS VS THE WEIGHT OF HEAVEN"
    },
    cu_chulainn_lancer: {
      intro: "⟨ Krav'nok kri. ⟩ A blue-coated hunter darting about like a gnat. Let me incinerate the atmosphere so you have no oxygen to run.",
      retort: "Whoa, whoa! The air is literally turning into crystal! Guess I'd better land Gáe Bolg before I get turned into glass!",
      tag: "HOUND'S LETHAL SPRINT VS AZURE RUIN"
    },
    karna_lancer: {
      intro: "⟨ Vur Aeth'ra Krav'nok. ⟩ You radiate genuine stellar energy, mortal. A worthy spark to extinguish in the name of Dragon King Ixenor.",
      retort: "Ancient dragon envoy. You threaten the integrity of this realm. I shall release the spear of Indra to preserve life!",
      tag: "THE SUN GOD'S SPEAR VS INCINERATION OF AETHEL"
    },
    adiosa_dragon_envoy: {
      intro: "⟨ Voth zul Adiosa. ⟩ Another manifestation of the Envoy of Ixenor? Planet Lyozes requires only ONE world-pruner. Commencing convergence!",
      retort: "⟨ Ruk'thar Krav'nok! ⟩ A fracture in space-time! Let our Azure-Magenta Ruin incinerate the dimensional mirror!",
      tag: "PRIMORDIAL CATACLYSM: FRACTURED DRAGON"
    }
  },

  // =========================================================================
  // 14. AOKO AOZAKI (CASTER / THE FIFTH MAGICIAN)
  // =========================================================================
  aoko_aozaki: {
    artoria_pendragon: {
      intro: "The King of Knights? Pretty formal, aren't we? Let's skip the chivalric ceremony—show me if that Holy Sword can outspeed the Fifth Magic!",
      retort: "A magician who charges straight into melee combat? Your resolve is fierce, Miss Aoko. Excalibur shall answer your challenge!",
      tag: "THE FIFTH MAGICIAN & KING OF KNIGHTS"
    },
    gilgamesh_archer: {
      intro: "The oldest King, huh? Collecting all those treasures just to fling them around like oversized darts? Let's see how they hold up against localized thermodynamic acceleration!",
      retort: "A modern magus daring to lecture the King of Heroes on the use of treasures?! Know your place, mongrel! Gate of Babylon!",
      tag: "MAGIC BLUE VS TREASURY OF BABYLON"
    },
    emiya_archer: {
      intro: "A nameless guardian who traces blades? You've got that perpetually overworked look. Don't think about dodging—my magic bullets track trajectory in real time!",
      retort: "The Fifth Magician of Misaki Town... To encounter a wielder of True Magic here of all places. I'll have to reinforce my defenses to the absolute limit.",
      tag: "PROJECTED PHANTASMS VS THERMODYNAMIC MAGIC"
    },
    cu_chulainn_lancer: {
      intro: "Fast footwork, Hound of Culann! But I've spent plenty of time dealing with beasts and monsters. Let's see whose straight punch reaches first!",
      retort: "Gahaha! Now that's the kind of energetic spirit I love to see from a Caster! Put 'em up, girl, let's have ourselves a proper brawl!",
      tag: "RUNE LANCER VS BRAWLING MAGICIAN"
    },
    scathach_lancer: {
      intro: "The Queen of the Land of Shadows? Your spear technique is insane, but the Fifth Magic governs time and entropy itself. Don't expect me to hold back!",
      retort: "True Magic... An authority that rewires the causal laws of the world. Splendid! Show me if your Magic Blue can pierce the boundary between life and death!",
      tag: "GATE OF SKYE & THE FIFTH MAGIC"
    },
    adiosa_dragon_envoy: {
      intro: "Whoa, that cosmic draconic presence is suffocating! Altering gravity and space? Perfect—just the kind of impossible physics the Fifth Magic was meant to rewrite!",
      retort: "⟨ Vur Aeth'ra... ⟩ A mortal woman manipulating the flow of planetary entropy? Irritatingly noisy creature... I will prune your timeline into black glass!",
      tag: "THE FIFTH MAGIC VS INCINERATION OF AETHEL"
    }
  }
};

/**
 * Fallback generator for custom servants, meme servants, or any servant pairs not explicitly defined.
 * Generates compelling class-advantage, trait-based, and alignment-based dialogues.
 */
function generateDynamicMatchupDialogue(
  challenger: ServantTemplate | MasterServantInstance,
  opponent: ServantTemplate | MasterServantInstance
): MatchupQuoteEntry {
  const cName = ('template' in challenger ? challenger.template.name : challenger.name) || 'Heroic Spirit';
  const oName = ('template' in opponent ? opponent.template.name : opponent.name) || 'Enemy Servant';
  const cClass = ('template' in challenger ? challenger.template.servantClass : challenger.servantClass) || 'Saber';
  const oClass = ('template' in opponent ? opponent.template.servantClass : opponent.servantClass) || 'Saber';

  // Check mirror match
  const cId = ('template' in challenger ? challenger.template.id : challenger.id) || '';
  const oId = ('template' in opponent ? opponent.template.id : opponent.id) || '';
  if (cId && oId && cId === oId) {
    return {
      intro: `Facing an identical reflection of myself? Show me if your spirit origin has what it takes to surpass the original!`,
      retort: `A mirror match... There can only be one ${cName} on this battlefield. En garde!`,
      tag: 'MIRROR SHADOW CLASH'
    };
  }

  // Class advantage matchups
  if (
    (cClass === 'Saber' && oClass === 'Lancer') ||
    (cClass === 'Lancer' && oClass === 'Archer') ||
    (cClass === 'Archer' && oClass === 'Saber') ||
    (cClass === 'Rider' && oClass === 'Caster') ||
    (cClass === 'Caster' && oClass === 'Assassin') ||
    (cClass === 'Assassin' && oClass === 'Rider')
  ) {
    return {
      intro: `${oName}! The wheel of fate favors my ${cClass} origin over your ${oClass}! Stand down or face defeat!`,
      retort: `Class advantage alone won't save you from my true power, ${cName}! Prepare yourself!`,
      tag: `${cClass.toUpperCase()} ADVANTAGE CLASH`
    };
  }

  if (cClass === 'Berserker') {
    return {
      intro: `■■■■■■! Madness surges through my veins! ${oName}, you will be crushed beneath my wrath!`,
      retort: `A Berserker's frenzy... I will cut down your rampage before you destroy this field, ${cName}!`,
      tag: 'BERSERK FRENZY TRIAL'
    };
  }

  if (oClass === 'Berserker') {
    return {
      intro: `${oName}! Even lost in madness, your warrior instincts are fierce. I will grant you an honorable defeat!`,
      retort: `■■■■■■■■---!! (The Berserker roars violently, lunging forward with untamed ferocity!)`,
      tag: 'SUBDUING THE BEAST'
    };
  }

  if (cClass === 'Foreigner' || oClass === 'Foreigner') {
    return {
      intro: `The veil between realities tears... An otherworldly presence meets my gaze. Face the void, ${oName}!`,
      retort: `Such chilling alien mana... I will not let this realm be swallowed by madness!`,
      tag: 'COSMIC ANOMALY CLASH'
    };
  }

  // Standard Heroic Spirit clash
  return {
    intro: `I am ${cName}! You stand as my opponent in this Holy Grail duel, ${oName}. Show me the full measure of your legend!`,
    retort: `Well met, ${cName}. As ${oName}, I shall meet your resolve with all the might of my Heroic Spirit origin!`,
    tag: 'FATEFUL HEROIC ENCOUNTER'
  };
}

/**
 * Resolves the full matchup dialogue between two Servants.
 * Checks player instance customQuotes, servant template matchupDialogues,
 * the canonical SERVANT_MATCHUP_DATABASE, and fallback heuristics.
 */
export function getServantMatchupDialogue(
  challenger: ServantTemplate | MasterServantInstance,
  opponent: ServantTemplate | MasterServantInstance
): ResolvedMatchupDialogue {
  const cTemplate: ServantTemplate = 'template' in challenger ? challenger.template : challenger;
  const oTemplate: ServantTemplate = 'template' in opponent ? opponent.template : opponent;

  const cId = cTemplate.id;
  const oId = oTemplate.id;
  const isMirror = cId === oId;

  // 1. Check if Challenger instance has a custom rival line configured via Servant Workshop
  const cCustomInstance = 'customQuotes' in challenger ? challenger.customQuotes : undefined;
  const oCustomInstance = 'customQuotes' in opponent ? opponent.customQuotes : undefined;

  let challengerLine = '';
  let defenderLine = '';
  let tag = '';

  if (cCustomInstance?.matchups?.[oId]?.intro) {
    challengerLine = cCustomInstance.matchups[oId].intro!;
  }
  if (cCustomInstance?.matchups?.[oId]?.tag) {
    tag = cCustomInstance.matchups[oId].tag!;
  }

  // 2. Check if Defender instance has a custom retort line configured
  if (oCustomInstance?.matchups?.[cId]?.retort) {
    defenderLine = oCustomInstance.matchups[cId].retort!;
  }

  // 3. Check Challenger's template matchupDialogues
  if (!challengerLine && cTemplate.matchupDialogues?.[oId]?.intro) {
    challengerLine = cTemplate.matchupDialogues[oId].intro!;
  }
  if (!defenderLine && cTemplate.matchupDialogues?.[oId]?.retort) {
    defenderLine = cTemplate.matchupDialogues[oId].retort!;
  }
  if (!tag && cTemplate.matchupDialogues?.[oId]?.tag) {
    tag = cTemplate.matchupDialogues[oId].tag!;
  }

  // 4. Check canonical SERVANT_MATCHUP_DATABASE
  if (!challengerLine && SERVANT_MATCHUP_DATABASE[cId]?.[oId]?.intro) {
    challengerLine = SERVANT_MATCHUP_DATABASE[cId][oId].intro!;
  }
  if (!defenderLine && SERVANT_MATCHUP_DATABASE[cId]?.[oId]?.retort) {
    defenderLine = SERVANT_MATCHUP_DATABASE[cId][oId].retort!;
  }
  if (!tag && SERVANT_MATCHUP_DATABASE[cId]?.[oId]?.tag) {
    tag = SERVANT_MATCHUP_DATABASE[cId][oId].tag!;
  }

  // If defenderLine still missing, check opponent's database entry facing challenger
  if (!defenderLine && SERVANT_MATCHUP_DATABASE[oId]?.[cId]?.intro) {
    defenderLine = SERVANT_MATCHUP_DATABASE[oId][cId].intro!;
  }

  // 5. Fallback heuristics if still empty
  if (!challengerLine || !defenderLine || !tag) {
    const fallback = generateDynamicMatchupDialogue(challenger, opponent);
    if (!challengerLine) challengerLine = fallback.intro || cTemplate.battleStartQuote || "I take the field!";
    if (!defenderLine) defenderLine = fallback.retort || oTemplate.battleStartQuote || "Prepare yourself!";
    if (!tag) tag = fallback.tag || (isMirror ? 'MIRROR MATCH' : 'BATTLE ENGAGEMENT');
  }

  // Theme color based on class
  const classColors: Record<string, string> = {
    Saber: '#3b82f6',
    Archer: '#ef4444',
    Lancer: '#10b981',
    Rider: '#f59e0b',
    Caster: '#8b5cf6',
    Assassin: '#6b7280',
    Berserker: '#dc2626',
    Ruler: '#eab308',
    Avenger: '#991b1b',
    Foreigner: '#d946ef'
  };

  const themeColor = classColors[cTemplate.servantClass] || '#d4af37';

  return {
    challengerLine,
    defenderLine,
    tag,
    themeColor,
    isMirrorMatch: isMirror
  };
}
