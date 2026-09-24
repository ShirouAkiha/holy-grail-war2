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
      intro: "An exact reflection of myself? Britain's fate is a burden meant for one king alone. Draw Excalibur!",
      retort: "If you truly carry the will of the King of Knights, you know this path permits no hesitation. Show me your resolve!",
      tag: "MIRROR OF CAMELOT"
    },
    gilgamesh_archer: {
      intro: "Cease your shameless insolence, King of Heroes. Neither in this war nor any other shall Britain's honor be laid at the feet of your vanity!",
      retort: "Still drowning in your stubborn delusions, Saber? A king is meant to be claimed, and you shall soon learn your place within my garden.",
      tag: "REJECTION OF THE GOLDEN KING"
    },
    scathach_lancer: {
      intro: "The sovereign of Dún Scáith... I sense the cold boundary between life and death upon your spears. Let us test our resolve.",
      retort: "A king who bears the sorrow of an entire kingdom without wavering. Let us see if your sacred edge can pierce an existence that cannot die.",
      tag: "CROWN VS LAND OF SHADOWS"
    },
    jeanne_darc_ruler: {
      intro: "Holy Maiden of Orleans. You who held a banner without malice amidst the flames... It is an honor to cross paths with such pure devotion.",
      retort: "King of Knights. The light of your sword has given hope to countless souls. Let this duel be governed by righteousness and mutual respect.",
      tag: "RIGHTEOUS KINGS & SAINTS"
    },
    jeanne_alter: {
      intro: "A hollow phantom driven purely by spite... You brandish hatred like a torch, but an undisciplined flame will never reach my heart.",
      retort: "Spare me the righteous sermon, you shining hypocrite! I’m going to scorch that pristine armor until you're nothing but black ash!",
      tag: "LIGHT OF CAMELOT VS DRAGON WITCH"
    },
    mhx_alter: {
      intro: "Who are you? You bear my exact countenance, yet wield twin blades of cosmic darkness... and why are you casually dining on sweets?!",
      retort: "Target confirmed: Original Saber-type entity. Engaging dark matter reactor... Please yield your rations quietly so I may return to my tea.",
      tag: "SABER HUNT: SPACE INTRUDER"
    },
    artoria_pendragon_alter: {
      intro: "A king who rules by dread alone has already abandoned her people. I will not allow a tyrant to defile the oath we swore!",
      retort: "Still reciting fairy tales while the country turns to dust? How pathetic. I shall crush that fragile softness once and for all.",
      tag: "DUEL OF SOULS: LIGHT VS SHADOW"
    },
    nero_claudius_saber: {
      intro: "Emperor of Rome. The battlefield is an altar of sacrifice, not a stage for self-indulgence. Ready your blade.",
      retort: "Umu! What a delightfully stern and stoic sovereign! But Rome's burning passion shall show you that glory must always bloom with beauty!",
      tag: "RED SABER VS BLUE SABER"
    },
    emiya_archer: {
      intro: "Archer... There is a strange, aching sorrow in the way you take your stance. Who are you to wield such quiet regret?",
      retort: "Just a nameless fake who took a few wrong turns, Saber. Don't look at me like that—raise your sword.",
      tag: "FAMILIAR STEEL"
    },
    heracles_berserker: {
      intro: "Great Heracles. Even stripped of reason by the madness of your class, your mythical stature remains unblemished. Come!",
      retort: "■■■■■■■■■■■■---!!",
      tag: "TWELVE LABORS TRIAL"
    },
    cu_chulainn_lancer: {
      intro: "Hound of Culann. Your spear is deadly, but as long as this wind conceals my blade, you shall not gain a single step.",
      retort: "Hah! You never give an inch, do you, King of Knights? Let’s see if that invisible steel can deflect a thrust aimed straight for the heart!",
      tag: "CELTIC SPEAR VS BRITISH SWORD"
    },
    karna_lancer: {
      intro: "Hero of Charity, son of Surya. The unblemished purity of your spear demands everything I have. Face me with full honor!",
      retort: "King of Knights. Your chivalric spirit burns without a speck of deceit. It is a privilege to cross weapons with the Sword of Promised Victory.",
      tag: "NOBLE VOWS: SUN & SWORD"
    },
    adiosa_dragon_envoy: {
      intro: "What an immense, primordial presence... You carry the breath of an ancient cosmic dragon. As the Red Dragon of Britain, I shall not yield!",
      retort: "⟨ Krav'nok rath. ⟩ A small mortal container flickering with the ember of a dragon... How fragile. Let us see if your tiny star breaks under true mass.",
      tag: "DRAGON CORE VS WORLD-PRUNER"
    },
    luvria_greenharte: {
      intro: "Hero of Lyozes. Your spells unravel the very principles of thaumaturgy. Stand firm, for my blade carries the hopes of an entire nation!",
      retort: "What an earnest and noble proclamation, Artoria! Let us see if the promised light of your holy sword can outshine a concept that simply ceases to exist!",
      tag: "THE KING'S OATH & THE ELVEN HERO"
    },
    aoko_aozaki: {
      intro: "The Fifth Magician. You borrow tomorrow's light to overturn the laws of the present... Show me if that miracle can outshine the sacred light of the planet!",
      retort: "The King of Knights herself! Direct, dignified, and no nonsense—just my type of fight! Don't hold back, Saber; let's see which of us blows the field wide open!",
      tag: "FIFTH MAGIC RETROGRADE VS EXCALIBUR"
    },
    amamiya_no_chihaya_tenkohime: {
      intro: "A celestial guardian of the shrine. Your blade is drawn purely on sacred instinct. Let us cross steel with mutual respect.",
      retort: "King of Knights! Washi's sacred katana shall measure thy chivalry! ...A-And prithee wipe the mud off thy boots before treading upon the shrine grounds!",
      tag: "HOLY SWORD & DIVINE FOX KATANA"
    },
    lucia_lyozes: {
      intro: "Vanguard of the elves. I see in your eyes the quiet resolve of one who carries the memory of fallen companions. I accept your challenge!",
      retort: "King of Knights. Your chivalry is admirable, but on a merciless front, unbending honor can cost lives. Show me the strength behind your conviction.",
      tag: "ROYAL SOVEREIGN CLASH"
    },
    edmond: {
      intro: "A fortress of unyielding will... Your shield stands not for glory, but to shelter those behind you. I shall meet your bastion with full honor!",
      retort: "King of Knights, huh? That blade carries a hell of a reputation. Step forward, your Majesty—let's see if your holy light can crack this wall!",
      tag: "HOLY SWORD OF VICTORY VS TIGRIS REDOUBT"
    }
  },

  // =========================================================================
  // 2. GILGAMESH (ARCHER)
  // =========================================================================
  gilgamesh_archer: {
    artoria_pendragon: {
      intro: "Still drowning in your hopeless ideals, Saber? Cease this futile struggle. Lay down your blade and accept your place as the finest jewel in my garden.",
      retort: "I would rather see Excalibur shattered than allow Britain's pride to be locked away in your vault. Draw your sword, King of Heroes!",
      tag: "CLAIM OF THE GOLDEN KING"
    },
    gilgamesh_archer: {
      intro: "An imposter dare stand beneath the heavens wearing the countenance of the King?! Mongrel, there can be only one sovereign upon this earth!",
      retort: "Fuhahaha! What amusing insolence from a wandering phantom! Let Ea decide which of us is the true master of the world!",
      tag: "CLASH OF THE TWO KINGS"
    },
    scathach_lancer: {
      intro: "The immortal shade of the Dun Scaith... You wander the earth begging for death? Rejoice, witch. The King's treasury lacks no tool to sever eternity.",
      retort: "Golden King of Babylon. Gods and phantoms have tried and failed to pierce my chest. Do not bore me with mere trinkets.",
      tag: "IMMORTALITY VS INFINITE TREASURY"
    },
    jeanne_darc_ruler: {
      intro: "A peasant girl playing arbiter over the affairs of kings? How laughably absurd. Keep your prayers to yourself, saint; my will is the only law this world requires.",
      retort: "Your vanity blinds you, King of Babylon. No throne stands above the will of the heavens. I will not allow your tyranny to go unchallenged.",
      tag: "DIVINE ARBITER VS VAIN SOVEREIGN"
    },
    jeanne_alter: {
      intro: "A rabid cur born from a counterfeit wish, howling at the stars... Begone, phantom. Your noisy tantrums are an insult to my hearing.",
      retort: "Call me a cur all you want, gold-plated peacock! I'm going to melt down that arrogant smirk along with every shiny trinket in your vault!",
      tag: "PEACOCK VS DRAGON WITCH"
    },
    mhx_alter: {
      intro: "What manner of cosmic absurdity is this? Aiming crimson light at the King while chewing on rations... Disappear from my sight, nuisance!",
      retort: "Target evaluation: Extreme spiritual density. High-calorie golden entity detected. Commencing standard anti-Saber extermination protocol.",
      tag: "ANCIENT BABYLON VS SERVANT UNIVERSE"
    },
    artoria_pendragon_alter: {
      intro: "Soiled by the dregs of the Grail, yet as stubborn as ever. A tyrant's crown does not suit you, Saber. Must I break you entirely?",
      retort: "Silence, golden archer. Keep barking from behind your treasury before Excalibur Morgan cleaves your head from your shoulders.",
      tag: "DARK MAJESTY VS GOLDEN ARROGANCE"
    },
    nero_claudius_saber: {
      intro: "An emperor who turns the battlefield into a vulgar cabaret? Insolent child. Rome was barely a barren hill when Uruk ruled the cradle of civilization.",
      retort: "Umu! What a needlessly sour disposition for someone wrapped in so much gold! Rome shall teach your dusty vault what true beauty and passion look like!",
      tag: "GOLDEN THEATER VS BABYLONIAN VAULT"
    },
    emiya_archer: {
      intro: "You... You wretched fake. A mere thief of human history dares stand before the King? I shall scatter your counterfeit remnants across the dirt!",
      retort: "Still hoarding what you never learned to master, King of Heroes? Let's see if you have enough weapons in stock.",
      tag: "FAKER VS ORIGINAL SOVEREIGN"
    },
    heracles_berserker: {
      intro: "A demigod of your caliber reduced to a mindless hound... A sorrowful sight, Heracles. Allow the chains of my friend to grant you an honorable rest.",
      retort: "■■■■■■■■■■■■---!!",
      tag: "DIVINE CHAINS OF ENKIDU"
    },
    cu_chulainn_lancer: {
      intro: "Still barking in the courtyard, hound of Culann? Know your place, or I shall pin you to the earth with a thousand ancestral spears.",
      retort: "Tch. All that shiny junk floating around you and not an ounce of spine to hold a blade. Let's see if that armor can turn aside Gáe Bolg, goldie!",
      tag: "HOUND OF ULSTER VS KING OF HEROES"
    },
    karna_lancer: {
      intro: "Son of Surya. You alone among these rabble carry a brilliance worthy of the King's gaze. Show me the majesty of the heavens, hero of charity.",
      retort: "King of Heroes. I appreciate your high regard. Yet the sun yields to no monarch—prepare yourself.",
      tag: "MEETING OF SUPREME DEMIGODS"
    },
    adiosa_dragon_envoy: {
      intro: "A primordial calamity from beyond the stars? Fuhahaha! Even the celestial dragons of ancient heaven bowed their necks before the King of Uruk!",
      retort: "⟨ Krav'nok zhal. ⟩ Such a noisy insect wrapped in polished yellow gravel. Pruning your civilization will be no more difficult than crushing dust.",
      tag: "KING OF HEROES VS COSMIC PRUNER"
    },
    luvria_greenharte: {
      intro: "An eccentric wielder of woodland miracles who dares profess omnipotence? Foolish girl! Every concept, every miracle known to man was born and cataloged within my vault!",
      retort: "My, what a wonderfully deafening lecture! But boasting of what you own cannot pierce an anti-world barrier, Golden King. Shall I erase the concept of your vanity next?",
      tag: "TREASURY OF CREATION VS THE STRONGEST MAGE"
    },
    aoko_aozaki: {
      intro: "A modern magus meddling with the Fifth domain, brazenly borrowing the future's debt? You overstep your bounds, girl. Let the weight of antiquity crush your fragile tricks.",
      retort: "Antiquity, huh? Keep posturing behind those floating portals, King of Heroes—let's see if your ancient relics can outrun a stream of Magic Bullets!",
      tag: "GATE OF BABYLON VS THE FIFTH MAGIC"
    },
    amamiya_no_chihaya_tenkohime: {
      intro: "A divine beast baring its fangs at its master? Entertaining. You might make a decent fur lining for my winter cloak, fox.",
      retort: "A-Arrogant gold king! Washi is the sacred guardian of the imperial mountains! Dare address washi as a mongrel and washi shall bite thy golden fingers off!",
      tag: "ANCIENT KYUBI VS KING OF HEROES"
    },
    lucia_lyozes: {
      intro: "An elven vanguard daring to lecture the King on duty? Your meager seconds of foresight will only grant you the luxury of watching your own ruin in vivid detail, mongrel.",
      retort: "I have brought down tyrants who declared themselves gods long before standing here. Count your treasures while you can, King of Heroes—my lance will find your heart.",
      tag: "APOCRYPHA TERMINUS VS GATE OF BABYLON"
    },
    edmond: {
      intro: "A scoundrel from the slums raising a slab of iron against the sovereign of mankind? Your insolence shall be repaid with a thousand divine blades, mongrel.",
      retort: "King of Heroes, huh? You've got an awful lot of shiny cutlery floating in the air. Step up and see how many shatter against this wall.",
      tag: "TOWER SHIELD VS GATE OF BABYLON"
    }
  },

  // =========================================================================
  // 3. SCÁTHACH (LANCER)
  // =========================================================================
  scathach_lancer: {
    artoria_pendragon: {
      intro: "A king who carries the weight of a dying star upon her shoulders. Let us see if that pure, unyielding resolve can withstand two spears born in shadow.",
      retort: "Gatekeeper of Dún Scáith. The oaths I swore to Britain will not bend before the cold stillness of your realm. Prepare yourself!",
      tag: "HOLY SWORD & SHADOW SPEARS"
    },
    gilgamesh_archer: {
      intro: "You store countless armaments, King of Babylon, yet you wield none of them with a warrior's heart. A weapon without will cannot reach me.",
      retort: "Insolent shade! You wander the earth begging for an honorable end, yet dare mock the King's armory? You shall be pinned beneath a storm of divine steel!",
      tag: "WARRIOR'S DISCIPLINE VS RAIN OF ARMS"
    },
    scathach_lancer: {
      intro: "Another shadow stranded between life and death. Tell me... does your spear possess the edge required to finally end this weary vigil?",
      retort: "Only one of us needs to walk out of this mist. Strike with everything you have, and let the grave claim whichever shadow falls short.",
      tag: "DEATH-SEEKER'S MIRROR"
    },
    jeanne_darc_ruler: {
      intro: "Your heart is untouched by malice, saint. But on a field of blood, piety alone will not turn aside a spear aimed at your vitals. Defend yourself.",
      retort: "I know the reality of war, Lady Scáthach. This banner was not raised merely to pray—it stands so others do not have to fall.",
      tag: "PRAYER VS PRIMORDIAL RUNE"
    },
    jeanne_alter: {
      intro: "A wild flame fueled entirely by spite. Hatred can sharpen a blade, girl, but your undisciplined footing leaves your throat wide open.",
      retort: "Save the lecture for your disciples, old hag! I don't need your fancy martial arts to turn your gloomy castle into a bonfire!",
      tag: "DISCIPLINE VS WILDFIRE"
    },
    mhx_alter: {
      intro: "Twin blades of condensed darkness from the cosmic void... An unusual martial style. Let me test if your strange arts hold true under pressure.",
      retort: "Target evaluation: Ancient instructor entity with extreme combat parameters. Ingesting sugar units to stabilize reflexes. Engaging.",
      tag: "PRIMORDIAL RUNES VS DARK MATTER"
    },
    artoria_pendragon_alter: {
      intro: "The King of Knights stripped of hesitation. Your strikes are devastatingly heavy now, Black King, but raw power alone will never catch my spears.",
      retort: "You speak too much, gatekeeper. If you desire an end to your eternity so badly, stay still and let Excalibur Morgan grant it.",
      tag: "DARK KING VS SHADOW QUEEN"
    },
    nero_claudius_saber: {
      intro: "An emperor who dances upon the blade's edge. Your theatrics have flair, but your guard drops every third step. ...No, you are not my student. En garde.",
      retort: "Umu! A legendary sovereign offering critique to Rome? How wonderful! But do not blink, master of shadows—my supreme artistry shines brightest under pressure!",
      tag: "EMPEROR'S STAGE VS SHADOW SPEARS"
    },
    emiya_archer: {
      intro: "A nameless warrior who hammers out cold steel from the marrow of his own soul. Your form is unorthodox, yet honed to razor precision. Let us trade blows.",
      retort: "To receive praise from the master of Dún Scáith is higher honors than a fake deserves. Forgive me, but I have no intention of going easy.",
      tag: "WROUGHT IRON & SHADOW CRAFT"
    },
    heracles_berserker: {
      intro: "The greatest hero of Greece, swallowed by madness yet still unyielding. Twelve lives... Let us find out if each one can fall to a different thrust.",
      retort: "■■■■■■■■■■■■---!!",
      tag: "GOD SLAYER VS GOD HAND"
    },
    cu_chulainn_lancer: {
      intro: "Your stance has widened, Setanta. Have you grown careless since leaving my halls? ...No, you are a hero grown. Show me how far your spear has traveled.",
      retort: "Guh... Of all the people to run into. Don't look at me like that, Shishou—I didn't come all this way just to get lectured again. Let's see who strikes first!",
      tag: "QUEEN OF DÚN SCÁITH & THE HOUND"
    },
    karna_lancer: {
      intro: "A peerless spear bathed in the brilliance of the sun god. To cross weapons with such pristine technique... this old soul could not ask for better.",
      retort: "Queen of Shadows. Your reputation precedes you across the ages. It is an honor to test the heat of Surya against the threshold of your realm.",
      tag: "CLASH OF SUPREME SPEARS"
    },
    adiosa_dragon_envoy: {
      intro: "A primordial calamity born from outside the sky. Even in the depths of the Land of Shadows, such ancient mass is rare. Come—show me if your scales can be pierced.",
      retort: "⟨ Voth Krav'nok. ⟩ You reek of the boundary between breath and decay. A brittle mortal core wrapped in old runes... I shall reduce your shadows to ash.",
      tag: "IMMORTAL HUNTER VS DRAGON ENVOY"
    },
    aoko_aozaki: {
      intro: "Borrowing time from tomorrow to burn today... A reckless method of magecraft, girl. Let us see if your Magic Blue can slip past a spear that transcends mortality.",
      retort: "Talk about intimidating. If you're looking for someone to break your immortality, you picked the right opponent—don't blink, or these heavy rounds will blow right past you!",
      tag: "GATE OF SKYE & THE FIFTH MAGIC"
    },
    amamiya_no_chihaya_tenkohime: {
      intro: "An ancient divine beast moving on pure sacred instinct. Good. Let your fangs bare themselves without restraint—test whether your divine light can extinguish my breath.",
      retort: "Queen of Dún Scáith! Washi can feel the deathly chill clinging to thy red spears! But the sacred foxfire of this shrine will never be smothered by thy gloom!",
      tag: "PRIMORDIAL SPEAR VS CELESTIAL FOXFIRE"
    },
    lucia_lyozes: {
      intro: "You read the flow five seconds before it arrives. A formidable gift, high elf, but foresight is meaningless if your body cannot outpace a strike that has already pierced you.",
      retort: "Your spear movements have discarded all unnecessary motion across millennia. Even knowing where your thrust lands, parrying it will demand everything I have. On guard, Scáthach.",
      tag: "PINNACLE LANCER DUEL"
    },
    luvria_greenharte: {
      intro: "An archmage who commands the erasure of concepts. Tell me, Hero of Lyozes... can your boundless authority deny the concept of an immortal's death?",
      retort: "My, what a sorrowful wish wrapped in such deadly steel! An existence that cannot perish, seeking the one blow to end it all? Let us see if my nullification can reach the root of your eternity!",
      tag: "IMMORTAL TEACHER VS CONCEPT NULLIFIER"
    },
    edmond: {
      intro: "The stance of a man who has held the line through countless meat grinders. Your shield has weathered ruin, vanguard—let us see if it can withstand the gate of the dead.",
      retort: "They say you've killed gods and forged the finest warriors of the age. Don't hold back, teacher—let's see if those red spears can dent this wall.",
      tag: "GATE OF SKYE VS FORTRESS OF EBONWATCH"
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
      intro: "Oh, look at the spotless, shining King of Knights. How utterly nauseating. Let’s see how pretty that chivalry looks after I roast you alive.",
      retort: "Spite is not conviction, Avenger. Swing your hatred all you want, but an undisciplined flame will never pierce my armor.",
      tag: "DRAGON WITCH VS KING OF KNIGHTS"
    },
    gilgamesh_archer: {
      intro: "All that shiny gold is just begging to be melted down into slag. Let’s see how smug you look once that gaudy armor turns red-hot.",
      retort: "A mongrel forged from delusions dares to brandish her counterfeit torch before me? Know your place and burn to dust, gutter-born witch.",
      tag: "HELLFIRE VS BABYLONIAN GOLD"
    },
    scathach_lancer: {
      intro: "Queen of the Dead or whatever you call yourself... Don't stand there looking down on me like I'm a child, old hag!",
      retort: "An amusing amount of venom, little dragon. But swinging a flag in blind rage won't pierce a heart honed by two thousand years of slaughter.",
      tag: "WILD WITCH VS ANCIENT SPEAR"
    },
    jeanne_darc_ruler: {
      intro: "Wipe that sickening, forgiving smile off your face. Looking at you makes me want to burn every single stone in France to ash.",
      retort: "I know how deep your hurt goes, Jeanne. But screaming your hatred at the world won't make you real. Put the flag down.",
      tag: "THE BURNING STAKE OF ORLEANS"
    },
    jeanne_alter: {
      intro: "Who the hell pulled another one of me out of the mud?! There’s only room for one real Dragon Witch here!",
      retort: "Real? You're just a pale, pathetic echo holding a match. Die and let the true Avenger finish the job!",
      tag: "MIRROR OF THE DRAGON WITCH"
    },
    mhx_alter: {
      intro: "What is your deal?! Why are you standing there glaring at me while shoveling bean paste down your throat?! Put the sweets down!",
      retort: "Target evaluated: High-temperature, low-tact Avenger. Deploying low-temperature sugar defense before she scorches my emergency rations.",
      tag: "BLACK FLAMES & DARK MATTER"
    },
    artoria_pendragon_alter: {
      intro: "Get that superior smirk off your face, you overgrown goth! One more word about my fashion sense and I'm incinerating your fast-food stash!",
      retort: "Quiet, stray dog. The only thing louder than your mouth is your total lack of finesse. Fall back before I cleave that flag in two.",
      tag: "RIVALRY OF THE BLACK SHADOWS"
    },
    nero_claudius_saber: {
      intro: "Keep screeching and prancing like that and I'll turn your precious theater into a mass grave, red runt!",
      retort: "What savage vulgarity! A true maiden should bloom with passion, not bitter envy! Rome shall teach your dark flames what true beauty looks like!",
      tag: "BURNING THEATER: ROSES VS FLAME"
    },
    emiya_archer: {
      intro: "You look like someone who desperately needs to have that smug, cynical look wiped clean off his face. Mind if I use hellfire?",
      retort: "I've cleaned up after plenty of rebellious brats with a penchant for fire. Try not to singe yourself, fake saint.",
      tag: "CYNICAL GUARDIAN VS FIERY AVENGER"
    },
    heracles_berserker: {
      intro: "A towering wall of muscle? Perfect. You're just a giant target for me to cremate over, and over, and over again!",
      retort: "■■■■■■■■■■■■---!!",
      tag: "TITAN'S CLASH: RAGE VS MUSCLE"
    },
    cu_chulainn_lancer: {
      intro: "Prancing around like an annoying stray mutt... Stay still for three seconds so I can turn you into charcoal!",
      retort: "Feisty little witch, aren't ya? Hate to break it to you, girl, but you’ll have to move a whole lot faster if you want to catch this hound.",
      tag: "HOUND EVASION VS DRAGON WITCH"
    },
    karna_lancer: {
      intro: "The glorious Hero of Charity... God, you blinding do-gooders disgust me. Let's see if your holy light survives real, burning spite.",
      retort: "Your flame is hot, but it carries only the cold emptiness of self-destruction. If you truly wish to challenge the Sun, come.",
      tag: "SOLAR HEAT VS DRAGON PYRE"
    },
    adiosa_dragon_envoy: {
      intro: "A primordial dragon? Ha! I drag dragons by the collar and burn whole armies to ash. You're just an oversized lizard stepping on my territory!",
      retort: "⟨ Shak zhal, Krav'nok. ⟩ An artificial vessel shrieking under the weight of stolen embers. You are no dragon-master, little insect—only ash waiting to settle.",
      tag: "DRAGON WITCH VS PRIMORDIAL DRAGON"
    },
    aoko_aozaki: {
      intro: "What's with this arrogant high-schooler shooting red beams everywhere?! Fifth Magic or not, let’s see you dodge when the entire ground catches fire!",
      retort: "Talk about a short fuse. If you think screaming your lungs out makes your fire any hotter, I’ve got a dozen heavy rounds here to set you straight!",
      tag: "MAGIC BULLETS VS DRAGON WITCH PYRE"
    },
    amamiya_no_chihaya_tenkohime: {
      intro: "What’s with this squeaking bundle of fur?! Flapping paper charms around won't stop you from turning into a roasted fox pelt!",
      retort: "H-Hii! Such foul, unholy dragon breath! Keep those smoky boots away from the shrine steps, thou rude and quarrelsome witch!",
      tag: "AVENGER PYRE VS SACRED CELESTIAL FOX"
    },
    lucia_lyozes: {
      intro: "Don't lecture me from atop that ivory tower, elf. You know nothing about being burned alive while the world watches and cheers!",
      retort: "I know what it means to stand amidst the ash of everything you loved. But lashing out like a cornered beast will only leave you emptier than before.",
      tag: "DRAGON WITCH'S SPITE VS HIGH ELVEN VANGUARD"
    },
    luvria_greenharte: {
      intro: "Waving that staff around and smiling like you own the world... Let's see your 'nullification' swallow a storm of pure, unadulterated hellfire!",
      retort: "My, what delightful fury! A curse that seeks to consume the earth? How wonderfully tragic! Let's see if that flame can burn through a concept that simply ceases to exist!",
      tag: "CONCEPT NULLIFICATION VS LA GRONDEMENT DU HAINE"
    },
    edmond: {
      intro: "Out of my way, iron wall! If you stand between me and my quarry, I'll melt that rusty slab right into your chest!",
      retort: "Heh, I've spent years dealing with reckless, stubborn brats throwing magical fits. Plant your boots and roar all you want, witch—this wall isn't moving.",
      tag: "FLAMES OF VENGEANCE VS SCARRED BASTION"
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
      intro: "A king who starves her own heart to feed her people will only leave them with ashes. Let me show you the weight of the reality you ignored.",
      retort: "You abandoned the oath we swore to the very end! I will not let a tyrant wear my face and mock the knights who fell for Britain!",
      tag: "THRONE OF SHADOWS: LIGHT VS DARK"
    },
    gilgamesh_archer: {
      intro: "Your endless prattling is a waste of oxygen, King of Heroes. If you won't draw your sword, I'll turn you and your trinkets to dust.",
      retort: "Hah! A corrupted mongrel dares to bare its fangs at the king? Let us see how long that blackened armor can withstand the weight of the heavens!",
      tag: "BLACK SWORD VS HEAVEN'S VAULT"
    },
    scathach_lancer: {
      intro: "You seek to die, yet you guard your life with a master's spear. Make up your mind, or I will cleave through both your hesitation and your heart.",
      retort: "A tyrant's heavy strikes lack finesse, but possess undeniable power. Show me if that dark light can reach the Abyss I reside in.",
      tag: "SHADOW SOVEREIGNS CLASH"
    },
    jeanne_darc_ruler: {
      intro: "Still clinging to that tattered flag, saint? Your prayers won't generate mana, and they certainly won't stop this sword.",
      retort: "I do not fight with prayers alone, Artoria! As long as there are people to protect, this banner will not fall to your tyranny!",
      tag: "IRON RULE VS SAINT'S BANNER"
    },
    jeanne_alter: {
      intro: "Loud, petty, and unrefined as always. Try not to trip over your own excessive edge, fake saint.",
      retort: "Oh, shut up, you junk-food-obsessed goth! I'm going to roast you inside that tin can you call armor!",
      tag: "BLACK MAJESTY VS DRAGON WITCH"
    },
    mhx_alter: {
      intro: "A galactic assassin who wastes her budget on sweets instead of proper maintenance. Hand over the junk food, and I might make this quick.",
      retort: "Target designated: Burger-consuming Saber variant. Commencing extermination to secure the universal sugar supply. Cross-Calibur...",
      tag: "FAST FOOD VS WAGASHI: ALTER RIVALRY"
    },
    artoria_pendragon_alter: {
      intro: "An illusion born of stagnant mana? How irritating. I don't have the patience to look at my own face.",
      retort: "Then close your eyes permanently. There's only room for one tyrant to devour this world's resources.",
      tag: "MIRROR OF THE BLACK DRAGON"
    },
    nero_claudius_saber: {
      intro: "A battlefield is no place for a concert. Silence that obnoxious voice of yours, or I will permanently ruin your vocal cords.",
      retort: "How incredibly drab! An emperor must shine even in the darkest mud! I shall teach you the brilliant colors of Rome, Black King!",
      tag: "DARK TYRANNY VS GOLDEN THEATER"
    },
    emiya_archer: {
      intro: "A nameless hero swinging borrowed blades. You cannot save anything in this state, Archer. Step aside, or be swept away with the rest of the trash.",
      retort: "I'll pass. I might be a fake who only cleans up messes, but watching the King of Knights reduce herself to a mindless storm of destruction is where I draw the line.",
      tag: "HOLLOW PATHS & BORROWED BLADES"
    },
    heracles_berserker: {
      intro: "A mindless beast is just a large target. Stand still and let me burn away all twelve of your lives at once.",
      retort: "■■■■■■■■■■■■---!!",
      tag: "NINE LIVES VS CORRUPTED EXCALIBUR"
    },
    cu_chulainn_lancer: {
      intro: "Your footwork is irritating. I will simply obliterate the ground you stand on, hound.",
      retort: "Tch. You're a lot less fun to spar with in black, Saber. Guess I'll have to take your heart before you can swing that oversized club.",
      tag: "DEADLY THRUST VS BLACK BURST"
    },
    karna_lancer: {
      intro: "The sun is an eyesore. I will swallow your charity and your flames in the abyss of my mana.",
      retort: "Your armor is heavy with corrupted duty, Black King. But my flames will not yield to mere shadows.",
      tag: "SOLAR FLAME VS GRAIL CORRUPTION"
    },
    adiosa_dragon_envoy: {
      intro: "You reek of unfamiliar stars and overwhelming mass. But a dragon is still a dragon, and my sword was forged to slay them.",
      retort: "⟨ Voth Krav'nok. ⟩ Such dense, violent mana from a fragile human shell. You may prove to be a more entertaining meal than the rest.",
      tag: "DRAGON OF CAMELOT VS DRAGON OF LYONA"
    },
    aoko_aozaki: {
      intro: "Manipulating time to dodge a strike you cannot block? A coward's magecraft. I will simply crush the space you attempt to flee to.",
      retort: "Hey, who said anything about dodging? If you think you can just brute-force your way through the Fifth Magic, you’re in for a very painful physics lesson!",
      tag: "FIFTH MAGIC RETROGRADE VS EXCALIBUR MORGAN"
    },
    amamiya_no_chihaya_tenkohime: {
      intro: "An antique spirit trying to hold back a storm with paper talismans. Burn with your shrine, fox.",
      retort: "H-Hii! Such scary black armor! But this great fox guardian will not let her sacred grounds be bulldozed by a gloomy tyrant!",
      tag: "BLACK DRAGON OF BRITAIN VS ANCIENT KYUBI"
    },
    lucia_lyozes: {
      intro: "A vanguard who relies on sentiment will eventually break her own shield. Let us see if your black iron can withstand a true tyrant's blow.",
      retort: "You've discarded your heart for the sake of efficiency, King of Knights. But a blade swung without purpose is just reckless violence. I will stop you here.",
      tag: "BLACK IRON VS BLACK SUN"
    },
    luvria_greenharte: {
      intro: "Erasing concepts is a parlor trick for those who lack the physical strength to end their enemies. I will crush your nullification with sheer, overwhelming mass.",
      retort: "My, what a delightfully gloomy tyrant! You think pure magical density can crush an erasure? How charmingly stubborn! Let's put that to the test!",
      tag: "EXCALIBUR MORGAN VS CONCEPT NULLIFICATION"
    },
    edmond: {
      intro: "No fortress holds against Excalibur. If you insist on playing the unyielding wall, I will shatter you into the bedrock.",
      retort: "That blackened blade carries a ridiculous amount of mana... but I've held off worse. Bring it on! This shield doesn't care how heavy your resentment is!",
      tag: "TYRANT'S CALIBURN VS SCARRED REDOUBT"
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
  // 9. EMIYA (ARCHER)
  // =========================================================================
  emiya_archer: {
    artoria_pendragon: {
      intro: "Still swinging that sword for a dream that will never answer back, Saber? You haven't changed in the slightest.",
      retort: "My path was chosen without deceit, Archer. If you have abandoned your pride as a hero, then fall before Excalibur!",
      tag: "IDEAL AND REGRET"
    },
    gilgamesh_archer: {
      intro: "Hmph...Do you have enough weapons in stock, king of heroes?",
      retort: "Insolent imitation! A thief of legends dare present his cheap reproductions before the King? I shall impale you where you stand!",
      tag: "FAKER VS ORIGINAL SOVEREIGN"
    },
    artoria_pendragon_alter: {
      intro: "Throwing away your doubts just to become an unthinking machine of slaughter... That's a rather lazy way to run a kingdom, Saber.",
      retort: "Silence, stray cleaner. A fake who scurries through the mud has no right to lecture the King of Knights.",
      tag: "BROKEN IDEALS"
    },
    cu_chulainn_lancer: {
      intro: "Still rushing in headfirst with that spear, Lancer? One would think you'd learn some caution after all these Grail Wars.",
      retort: "Tch! Can't you ever shut up and just fight, Archer? Let's see if those counterfeit blades can keep your heart inside your ribcage!",
      tag: "RED AND BLUE RIVALRY"
    },
    heracles_berserker: {
      intro: "A living fortress wrapped in the madness of Olympus... Taking six of your lives was exhausting enough the first time. Let's finish the rest.",
      retort: "■■■■■■■■■■■■---!!",
      tag: "THE LABORS OF IRON"
    },
    karna_lancer: {
      intro: "The supreme Hero of Charity... Facing an opponent whose spear burns away even deceit is truly the worst kind of matchup for a faker.",
      retort: "Your armor is forged from quiet resolve, Archer. A heart that has weathered betrayal and slaughter still answers the call to battle. Come.",
      tag: "HERO OF CHARITY & THE COUNTER GUARDIAN"
    },
    scathach_lancer: {
      intro: "The gatekeeper of Dún Scáith herself. I suppose a mundane swordsman like me will have to exhaust every trick in the book to survive.",
      retort: "You call yourself a fake, yet every edge you forge carries the weight of a lifetime of blood. Show me that unyielding craft, nameless warrior.",
      tag: "WROUGHT STEEL & SHADOW SPEARS"
    },
    jeanne_darc_ruler: {
      intro: "A maiden who walked straight into the flames with a smile... People like you are terrifying, saint. You never realize the cost until it's too late.",
      retort: "I know the sorrow this world holds, Archer. But if we discard our prayers out of despair, who will stand for those who cannot fight?",
      tag: "SAINT'S FAITH & GUARDIAN'S DESPAIR"
    },
    jeanne_alter: {
      intro: "Screaming at the world because it didn't treat you fairly? Take some advice from a veteran of regret, girl: tantrums won't fill the void.",
      retort: "You smug, condescending bastard! Wipe that know-it-all smirk off your face before I turn your rusty blades into ash!",
      tag: "BITTER PHANTOMS"
    },
    nero_claudius_saber: {
      intro: "Must you turn every skirmish into an opera, Emperor? A battlefield is a place for killing, not a stage for applause.",
      retort: "Umu! How utterly dreary! A true hero must strike with flair and passion! Rome shall paint some color over that somber coat of yours!",
      tag: "MIDNIGHT FORGE VS GOLDEN THEATER"
    },
    mhx_alter: {
      intro: "Saberfaces falling out of deep space now? Good grief... Put down the pastries and step aside before I have to clean up this mess.",
      retort: "Analysis: Red-coated archer entity exhibiting maternal culinary tendencies. Suppress hostility if nutrient rations are provided... Otherwise, engaging.",
      tag: "HIGH REPRODUCTIONS VS JUNK FOOD REACTOR"
    },
    adiosa_dragon_envoy: {
      intro: "An unnatural mass distorting the local causal baseline... The Counter Force really loves dumping the most absurd anomalies right into my lap.",
      retort: "⟨ Krav'nok rath. ⟩ A small, burnt soul bound to an endless wheel of cleanups. You smell of recycled iron, mortal. Break and be forgotten.",
      tag: "COUNTER FORCE VS COSMIC ENTROPY"
    },
    aoko_aozaki: {
      intro: "Shifting the universe's thermodynamic debt into the future just to throw heavy punches... You always did have the most reckless methods, Magician.",
      retort: "Hey, as long as it gets the job done, right? Don't start lecturing me like an old man, Archer—let's see if those projection tricks can take a heavy round!",
      tag: "PROJECTION MAGE-CRAFT VS FIFTH MAGIC"
    },
    amamiya_no_chihaya_tenkohime: {
      intro: "An ancient nine-tailed divine beast... I'd rather not turn this shrine into a war zone, fox. How about we settle this without leveling the mountain?",
      retort: "H-Hmph! Thou talkest smoothly for someone bristling with forged swords! Washi shall guard this sanctuary from thy gloomy, sharp-edged tricks!",
      tag: "MODERN STEEL VS CELESTIAL BEAST"
    },
    lucia_lyozes: {
      intro: "Seeing five seconds into the future is a deadly edge, vanguard. But what happens when the battlefield fills with thousands of blades all falling at once?",
      retort: "You carry the hollow stride of a soldier who has outlived his cause, Archer. Even if a thousand swords fall, my lance only needs to find one opening.",
      tag: "FIVE SECONDS OF FORESIGHT VS UNLIMITED BLADES"
    },
    luvria_greenharte: {
      intro: "Nullifying concepts on a whim? What a headache. Magic that rewrites common sense is precisely why I prefer cold, reliable steel.",
      retort: "My, what an exhaustingly practical gentleman! You forge hollow copies out of sheer stubbornness? How delightful! Let us see if your iron can exist once its concept is stripped away!",
      tag: "RECORDED ORIGINS VS CONCEPTUAL NULLIFICATION"
    },
    edmond: {
      intro: "A tower shield held by a man who knows the weight of holding the line. Respectable... but every wall has a structural flaw if you know where to strike.",
      retort: "Heh, you've got the eyes of an old veteran who's seen too many bad days. Come on then, Archer—let's see if your arrows have enough weight to crack this slab.",
      tag: "THE COUNTER ARSENAL VS THE UNBROKEN WALL"
    },
    emiya_archer: {
      intro: "Looking at my own face never gets any easier. Tell me... how many more people did you kill before you realized it was all meaningless?",
      retort: "I stopped counting a long time ago. If you want to put an end to this pathetic existence, you'd better make sure your projection doesn't shatter first.",
      tag: "MIRROR OF THE WROUGHT IRON"
    }
  },

  // =========================================================================
  // 10. HERACLES (BERSERKER)
  // =========================================================================
  heracles_berserker: {
    artoria_pendragon: {
      intro: "■■■■■■■■■■■■———!!",
      retort: "Great Heracles. Even stripped of reason by the madness of your class, your mythical stature remains unblemished. Come!",
      tag: "THE PROMISED BLADE AND THE TWELVE LABORS"
    },
    gilgamesh_archer: {
      intro: "■■■■■■■■■■■■———!! (A roar thick with ancient recognition and pure, visceral fury.)",
      retort: "A demigod of your caliber reduced to a mindless hound... A sorrowful sight, Heracles. Allow the chains of my friend to grant you an honorable rest.",
      tag: "FETTERS OF HEAVEN & THE TITAN"
    },
    emiya_archer: {
      intro: "■■■■■■■■■■■■———!!",
      retort: "A living fortress wrapped in the madness of Olympus... Taking six of your lives was exhausting enough the first time. Let's see if we can finish the rest.",
      tag: "THE LABORS OF IRON"
    },
    artoria_pendragon_alter: {
      intro: "■■■■■■■■■■■■———!!",
      retort: "A mindless beast is just an oversized target. Stand still and let me burn away all twelve of your lives at once.",
      tag: "NINE LIVES VS CORRUPTED EXCALIBUR"
    },
    cu_chulainn_lancer: {
      intro: "■■■■■■■■■■■■———!!",
      retort: "A giant mountain of muscle that won't go down easy... Now that's what I call a proper warm-up! Let's see how many of those lives can take a cursed spear to the heart!",
      tag: "BEAST OF IRELAND VS TITAN OF GREECE"
    },
    karna_lancer: {
      intro: "■■■■■■■■■■■■———!!",
      retort: "Great son of Zeus. Though madness consumes your mind, your martial spirit remains unbroken. I shall face your twelve lives with Surya's sacred flame.",
      tag: "COLLISION OF SUPREME DEMIGODS"
    },
    scathach_lancer: {
      intro: "■■■■■■■■■■■■———!!",
      retort: "The greatest hero of Greece, swallowed by madness yet still unyielding. Twelve lives... Let us find out if each one can fall to a different thrust.",
      tag: "GOD SLAYER VS GOD HAND"
    },
    jeanne_darc_ruler: {
      intro: "■■■■■■■■■■■■———!!",
      retort: "Even beneath such terrifying wrath, I can see the soul of a hero who protected humanity. Stand down, Heracles—I will not let your sorrow tear this world apart!",
      tag: "SAINT'S RESOLVE VS UNBRIDLED MIGHT"
    },
    jeanne_alter: {
      intro: "■■■■■■■■■■■■———!!",
      retort: "A towering wall of muscle? Perfect. You're just a giant target for me to cremate over, and over, and over again!",
      tag: "SPITEFUL PYRE VS MOUNTAIN OF STONE"
    },
    nero_claudius_saber: {
      intro: "■■■■■■■■■■■■———!!",
      retort: "Umu! What a terrifying, earth-shaking roar! Such raw power belongs in the greatest arenas of Rome! Prepare yourself, great titan!",
      tag: "GOLDEN THEATER VS COLOSSAL MIGHT"
    },
    mhx_alter: {
      intro: "■■■■■■■■■■■■———!!",
      retort: "Target evaluation: Extreme physical mass. High kinetic impact warning. Diverting sugar reserves to emergency defense barrier.",
      tag: "PRIMORDIAL MUSCLE VS COSMIC CALORIES"
    },
    adiosa_dragon_envoy: {
      intro: "■■■■■■■■■■■■———!!",
      retort: "⟨ Krav'nok rath. ⟩ A bipedal beast roaring against the void. You possess admirable mass for a mortal, but stone still shatters under gravity.",
      tag: "DIVINE TITAN VS PRIMORDIAL STAR-DRAGON"
    },
    aoko_aozaki: {
      intro: "■■■■■■■■■■■■———!!",
      retort: "Talk about a wall! Physical attacks below Rank A won't even scratch him, huh? Guess I'll just have to put everything into a direct point-blank blast!",
      tag: "FIFTH MAGIC HEAVY ROUNDS VS GOD HAND"
    },
    amamiya_no_chihaya_tenkohime: {
      intro: "■■■■■■■■■■■■———!!",
      retort: "H-HIIII! What a monstrous, giant ogre! W-Washi's nine tails are standing straight up! Stay back, thou giant brute, or washi shall blast thee with sacred foxfire!",
      tag: "MOUNTAIN BREAKER VS CELESTIAL FOX"
    },
    lucia_lyozes: {
      intro: "■■■■■■■■■■■■———!!",
      retort: "A swing so heavy it tears the atmosphere apart... Even knowing where that blade lands five seconds ahead, a single glancing blow will shatter my bones. Hold your ground, Lucia...!",
      tag: "FIVE-SECOND FORESIGHT VS TITANIC SWINGS"
    },
    luvria_greenharte: {
      intro: "■■■■■■■■■■■■———!!",
      retort: "My, what an overwhelming tempest of pure physical fury! Twelve blessings of immortality? How magnificent! Let us see if your lives return once the concept of resurrection is erased!",
      tag: "GOD HAND RESURRECTION VS CONCEPT NULLIFICATION"
    },
    edmond: {
      intro: "■■■■■■■■■■■■———!!",
      retort: "God of strength... That roar alone rattles my teeth right out of my skull. Dig your boots into the dirt, old man—this is going to hit like an avalanche!",
      tag: "THE UNSTOPPABLE FORCE VS THE UNBREAKABLE WALL"
    },
    heracles_berserker: {
      intro: "■■■■■■■■■■■■———!!",
      retort: "■■■■■■■■■■■■———!! (An identical shockwave of sound and bloodlust that splits the earth beneath their feet.)",
      tag: "COLLISION OF TWO TITANS"
    }
  },

  // =========================================================================
  // 11. CÚ CHULAINN (LANCER)
  // =========================================================================
  cu_chulainn_lancer: {
    artoria_pendragon: {
      intro: "Still keeping that invisible blade tucked under your cloak, King of Knights? Come on, let's skip the small talk and see if you can parry my thrust this time!",
      retort: "Hound of Culann. Your spear is deadly, but as long as this wind conceals my blade, you shall not gain a single step.",
      tag: "BLUE COAT & PROMISED STEEL"
    },
    gilgamesh_archer: {
      intro: "You sure love looking down on people from that high horse, goldie. Floating all those shiny swords won't save you if my red spear reaches your throat first!",
      retort: "Still barking in the courtyard, hound of Culann? Know your place, or I shall pin you to the earth with a thousand ancestral spears.",
      tag: "HOUND OF ULSTER VS KING OF HEROES"
    },
    emiya_archer: {
      intro: "Look at that, a guy carrying two swords! What's your True Name, 'Saber'—or should I introduce myself first? Name's Mario. First name Mario, last name Mario. Mario Mario.",
      retort: "Funny, I took you for the legendary Italian spearman 'Cú chu-lame'.",
      tag: "MARIO MARIO VS CU CHU-LAME"
    },
    artoria_pendragon_alter: {
      intro: "Whoa, look at that grim face. You're a hell of a lot more terrifying in black, Saber! Mind if I test how heavy that dark blade really swings?",
      retort: "Your footwork is irritating. I will simply obliterate the ground you stand on, hound.",
      tag: "CRIMSON SPEAR VS CORRUPTED SWORD"
    },
    heracles_berserker: {
      intro: "A giant mountain of muscle that won't go down easy... Now that's what I call a proper warm-up! Let's see how many of those lives can take a cursed spear to the heart!",
      retort: "■■■■■■■■■■■■---!!",
      tag: "BEAST OF IRELAND VS TITAN OF GREECE"
    },
    karna_lancer: {
      intro: "The supreme Hero of Charity wielding Surya's divine flame... Heh, crossing tips with a spearman of your caliber is the kind of fight a guy lives for!",
      retort: "Child of light, blessed by the sun god Lugh. Your spear possesses the purity of an unbroken warrior. Step forward, Hound of Ulster.",
      tag: "SPEARS OF THE SUN AND SEA"
    },
    scathach_lancer: {
      intro: "Guh... Of all the people to run into today, it just had to be Shishou. Don't look at me like that—I'm not the green kid from Dún Scáith anymore! On guard!",
      retort: "Your stance has widened, Setanta. Have you grown careless since leaving my halls? ...No, you are a hero grown. Show me how far your spear has traveled.",
      tag: "DISCIPLE'S CHALLENGE"
    },
    jeanne_darc_ruler: {
      intro: "A pretty saint marching onto a muddy battlefield with nothing but a flag? You've got guts, girl, but don't expect this hound to pull his punches!",
      retort: "I know the valor of Ulster's greatest warrior, Sir Cú Chulainn. I ask for no mercy—only an honorable contest under heaven.",
      tag: "WARRIOR'S CODE & HOLY BANNER"
    },
    jeanne_alter: {
      intro: "Feisty little witch, aren't you? Flapping that cursed banner and screaming your lungs out won't do you any good if you can't even catch my shadow!",
      retort: "Prancing around like an annoying stray mutt... Stay still for three seconds so I can turn you into charcoal!",
      tag: "HOUND HUNT VS DRAGON PYRE"
    },
    nero_claudius_saber: {
      intro: "An emperor turning a bloody scrap into a theater performance? You're certainly flashy, Red Saber, but let's see how you dance when the spear closes in!",
      retort: "Umu! A swift and spirited hound from the wild northern lands! Rome welcomes your vigor—let us compose a masterpiece upon this stage!",
      tag: "CELTIC STORM & ROMAN BLOOM"
    },
    mhx_alter: {
      intro: "Twin dark-matter blades from outer space? I've fought plenty of strange monsters in my time, but a space assassin munching sweets takes the cake!",
      retort: "Target evaluated: High-mobility Lancer entity. Engaging dark reactor... Cease distracting me from my sugar intake, hound.",
      tag: "ANCIENT SPEAR VS COSMIC TWIN-BLADES"
    },
    adiosa_dragon_envoy: {
      intro: "That's an absurd amount of pressure radiating off a dragon. I've pierced sea monsters and divine beasts before—let's see if these scales can turn aside Gáe Bolg!",
      retort: "⟨ Krav'nok rath. ⟩ A noisy flesh-beast darting around with a barbed twig. You will make a brittle crunch beneath my talons, mortal.",
      tag: "HOUND OF WAR VS PRIMORDIAL STAR-DRAGON"
    },
    aoko_aozaki: {
      intro: "Throwing around pure destruction with bare fists and high-heels? You've got an awful lot of nerve for a modern magus, girl! Let's see whose blast is faster!",
      retort: "Fast footwork and a cursed red spear? Now this looks like fun! Don't blink, Lancer—my heavy rounds don't wait for anyone!",
      tag: "BEAST-LIKE REFLEXES VS MAGIC BULLET BARRAGE"
    },
    amamiya_no_chihaya_tenkohime: {
      intro: "A celestial fox guardian brandishing a sacred blade? Don't worry, little lady, I don't usually hunt foxes—unless you're itching for a real duel!",
      retort: "H-Hii! Such sharp canine fangs and a bloodthirsty spear! Washi is a sacred divine kitsune, not some woodland critter for thee to chase!",
      tag: "HOUND'S SCENT & CELESTIAL FOXFIRE"
    },
    lucia_lyozes: {
      intro: "Seeing five seconds into the future, huh? That's a nasty trick, princess. But even if you see the strike coming, can your body move fast enough to dodge a reversal of cause and effect?!",
      retort: "Your spear technique is pure, untamed instinct honed by divine slaughter, Cú Chulainn. Knowing the trajectory won't make parrying it any easier—on guard!",
      tag: "THE PIERCING HOUND VS FIVE-SECOND FORESIGHT"
    },
    luvria_greenharte: {
      intro: "Erasing concepts on the fly? Man, Casters and their absurd cheat codes never cease to give me a headache! Guess I'll just have to pierce your chest before you finish reciting the spell!",
      retort: "My, what delightful confidence from the famed Hound of Ulster! A spear that strikes before it is even thrust? How wonderfully paradoxical! Let us see if your curse survives when its concept simply ceases to be!",
      tag: "CURSED HEART-PIERCER VS CONCEPT ERASURE"
    },
    edmond: {
      intro: "Now that's a proper frontline vanguard! Plant those boots and brace yourself, big guy—let's find out what happens when the spear that always pierces meets a wall that never falls!",
      retort: "Heh, heard plenty of legends about the Hound of Ulster. Don't hold back, Lancer—let's see if that red needle can punch through the pride of the frontline!",
      tag: "THE IRRESISTIBLE SPEAR VS THE IMMOVABLE WALL"
    },
    cu_chulainn_lancer: {
      intro: "Ha! Staring down my own ugly mug? Well, there's only room for one blue hound on this battlefield. Let's see who's got the sharper fangs!",
      retort: "Tch, don't get cocky just because you wear the same face! May the fastest thrust win, brother—don't die on the first pass!",
      tag: "DOG EAT DOG"
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
    },
    luvria_greenharte: {
      intro: "⟨ Hear me, Greenharte... ⟩ The mortal who denies death, space, and magic itself. My celestial dragon flames acknowledge no laws. Stand firm against the breath of Ixenor!",
      retort: "Verily, a greeting worthy of a world-pruning calamity! Concept Nullification: Heat and Impact! Come, great dragon, show this 140-year-old mage the fury of the ancients!",
      tag: "SOVEREIGNS OF CALAMITY"
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
    },
    luvria_greenharte: {
      intro: "Hey, green-haired hero! If you think you can just 'nullify' the Fifth Magic, you've got another thing coming! Magic Gunner, full throttle!",
      retort: "Such fiery enthusiasm! Let us trade incantations, Magician! Pyre, Gale, and Nullification—converge!",
      tag: "CLASH OF EXTRAORDINARY SORCERY"
    }
  },

  // =========================================================================
  // 15. AMAMIYA NO CHIHAYA TENKOHIME (SABER / ANCIENT KYUBI GUARDIAN)
  // =========================================================================
  amamiya_no_chihaya_tenkohime: {
    artoria_pendragon: {
      intro: "King of Knights! Washi's Amazakura shall test thy chivalry! ...A-And keep those muddy steel boots away from washi's clean shrine tatami!",
      retort: "A kitsune swordswoman of divine lineage? Your instinctual draw is remarkably swift. Let our blades cross with honor!",
      tag: "HOLY SWORD & DIVINE FOX KATANA"
    },
    gilgamesh_archer: {
      intro: "Arrogant gold king! Washi's divine name is Amamiya no Chihaya Tenkohime! Don't thee dare call washi a mere mongrel or washi shall bite thy golden fingers off!",
      retort: "Fuhahaha! A little pink fox baring its fangs at the King of Heroes? Entertaining! Become an ornament in my vault, beast!",
      tag: "ANCIENT KYUBI VS KING OF HEROES"
    },
    scathach_lancer: {
      intro: "Queen of Dún Scáith... Washi senses the cold chill of the Land of Shadows upon thy spears! But washi's celestial foxfire never dims!",
      retort: "An ancient nine-tailed guardian whose blade moves purely on instinct. Good... Show me if your fangs can grant me the release of death!",
      tag: "PRIMORDIAL SPEAR VS CELESTIAL FOXFIRE"
    },
    jeanne_darc_ruler: {
      intro: "A holy maiden of the Western God? Thy prayers carry genuine warmth, Saint... But in this arena, washi's sacred shrine barriers shall stand firm!",
      retort: "Divine shrine guardian of the East, I sense profound purity in your spiritual core. Let us cross weapons in righteous accord.",
      tag: "SAINT OF ORLEANS & SHRINE MAIDEN"
    },
    jeanne_alter: {
      intro: "H-Hii! Thy dragon flames are going to scorch washi's fur and singe washi's tails! Cease thy reckless tantrums at once, foul witch!",
      retort: "Haah?! What's with this noisy pink fur-ball squeaking like a toy? I'll roast your cute little tails into a charcoal bonfire!",
      tag: "ROARING DRAGON FLAME VS SHRINE KEKKAI"
    },
    mhx_alter: {
      intro: "W-Wait! Those red twin lightning sabers look dangerous! And why art thou staring at washi's shrine dango with such intense hunger?!",
      retort: "Target confirmed: Pink Saber... with exceptional pastry potential. Surrender your sweet bean buns and fried snacks, and your tails may be spared...",
      tag: "SWEETS REACTOR VS FOX SHRINE DANGO"
    },
    artoria_pendragon_alter: {
      intro: "Such oppressive, tyrannical mana! Even if thy dark blade Excalibur Morgan casts a shadow over the leylines, washi's sacred Amazakura shall cleave through the dark!",
      retort: "Hmph. A stubborn celestial fox wagging its tail against absolute tyranny. Kneel before the black king, or be crushed underfoot.",
      tag: "TYRANT'S ECLIPSE & DIVINE CHERRY BLOSSOM"
    },
    nero_claudius_saber: {
      intro: "W-What is with all this gaudy red theater shouting?! Thou art making far too much noise—washi's sensitive fox ears are ringing!",
      retort: "UMU! What an extraordinarily fluffy and radiant maiden of the East! Stand beside my Golden Theater and let us celebrate beauty together, Fox Princess!",
      tag: "IMPERIAL THEATER & CELESTIAL PRINCESS"
    },
    emiya_archer: {
      intro: "A Nameless Archer who projects infinite blades? Fumu... washi's single Amazakura is guided by 1,800 years of divine instinct! And Master said thou makest delicious fried tofu—is that true?!",
      retort: "A Kyubi Saber demanding culinary service mid-battle... *sigh* Very well. If you can parry my projections, I'll prepare a full banquet of sweet aburaage.",
      tag: "UNLIMITED BLADES & THE SACRED KATANA"
    },
    heracles_berserker: {
      intro: "Eeeek! H-Huge! A mountainous giant of pure rage! W-Washi isn't scared! Amazakura yo, unleash the divine cherry blossom storm before he squishes washi!",
      retort: "■■■■■■■■ーーーッ！！ (The titan roars, earth-shaking footsteps rattling the shrine leylines with terrifying pressure!)",
      tag: "TWELVE LABORS TRIAL VS KYUBI INSTINCT"
    },
    cu_chulainn_lancer: {
      intro: "The Hound of Culann! Thou hadst better not try chasing washi's fluffy tails like a playful stray dog, or washi's foxfire will singe thy nose!",
      retort: "Gaha! A feisty divine kitsune with a razor-sharp katana? Don't worry, Princess, let's see if your quick paws can dodge this crimson spear!",
      tag: "HOUND OF ULSTER VS CELESTIAL FOX"
    },
    karna_lancer: {
      intro: "Hero of Charity... Thy radiant solar aura blazes like the midday sun. It is warm, but washi's celestial shrine shall not yield to thy holy spear!",
      retort: "Your sword contains no deceit, only pure instinct and an ancient vow to protect. It is an honor to cross weapons with you, Tenkohime.",
      tag: "SUN GOD'S CHARITY & HEAVENLY FOXFIRE"
    },
    adiosa_dragon_envoy: {
      intro: "W-Whoa! That huge dragon presence from Lyozes! Did Akira send thee to scold washi again?! Washi didn't do anything wrong, washi promises!",
      retort: "⟨ Vur Aeth'ra... ⟩ The sealed Kyubi from Ossuaron's Spine... So tiny and fluffy. The urge to squish you until your tails squeak is immense.",
      tag: "GUARDIAN OF OSSUARON VS WORLD-PRUNER"
    },
    aoko_aozaki: {
      intro: "The Fifth Magician! Thy loud mana blasts will dirty washi's shrine robes! Leave the swordsmanship to washi's instincts!",
      retort: "Whoa, an ancient Kyubi shrine maiden! Try not to trip over those cute tails when my thermodynamic magic kicks in!",
      tag: "SHRINE GUARDIAN VS THE FIFTH MAGIC"
    },
    amamiya_no_chihaya_tenkohime: {
      intro: "Another washi?! Amamiya ja nee! Washi no namae wa Amamiya no Chihaya Tenkohime! There is only one true ancient guardian of the shrine!",
      retort: "Kyuuu?! An imposter trying to steal washi's fried tofu and Master's headpats?! Amazakura yo, purge the false reflection!",
      tag: "MIRROR OF OSSUARON: KYUBI DUEL"
    },
    amamiya: {
      intro: "Another washi?! Amamiya ja nee! Washi no namae wa Amamiya no Chihaya Tenkohime! There is only one true ancient guardian of the shrine!",
      retort: "Kyuuu?! An imposter trying to steal washi's fried tofu and Master's headpats?! Amazakura yo, purge the false reflection!",
      tag: "MIRROR OF OSSUARON: KYUBI DUEL"
    },
    lucia_lyozes: {
      intro: "Uwah! Such a stern elf princess! Master, look at her spear, it is so long and sharp! Don't you dare poke washi's fluffy tails with that black lance, or washi will bite thee!",
      retort: "An ancient Kyubi from Ossuaron's Spine... Your blade relies on beastly instinct. But against five-second foresight and the Black Lance, instinct is merely a predictable vector.",
      tag: "SYLVAN VANGUARD VS GUARDIAN OF OSSUARON"
    },
    luvria_greenharte: {
      intro: "The Strongest Mage of the Citadel! Washi senses nine hundred years of nature spirits dancing around thy staff! Show washi thy ancient Sylvanryth sorcery!",
      retort: "With pleasure, ancient guardian! Fluvia's tides and Terra's stone answer my call! Try not to get thy precious fur wet!",
      tag: "SYLVAN WEAVE & NINE-TAILED TEMPEST"
    },
    luvria: {
      intro: "The Strongest Mage of the Citadel! Washi senses nine hundred years of nature spirits dancing around thy staff! Show washi thy ancient Sylvanryth sorcery!",
      retort: "With pleasure, ancient guardian! Fluvia's tides and Terra's stone answer my call! Try not to get thy precious fur wet!",
      tag: "SYLVAN WEAVE & NINE-TAILED TEMPEST"
    },
    edmond: {
      intro: "Kyuuu?! What a giant tiger warrior! Thy shield looks like a boulder sliced straight from Mount Ossuaron! Washi will slice right around it!",
      retort: "Hahaha! You're quick, kid, but the earth doesn't move so easily. Come on, show me what those nine tails can do!",
      tag: "SACRED SHRINE GUARDIAN VS GUARDIAN OF EBONWATCH"
    }
  },
  lucia_lyozes: {
    artoria_pendragon: {
      intro: "King of Knights. Your chivalric ideals are noble, but on an apocalyptic battlefield, hesitation born of honor will get your comrades killed. Show me your conviction!",
      retort: "Princess of Sylvanryth. I see the weight of fallen comrades in your eyes. I accept your vanguard challenge with Excalibur!",
      tag: "ROYAL SOVEREIGN CLASH"
    },
    gilgamesh_archer: {
      intro: "The King of Heroes. Flaunting countless treasures and calling yourself the sole arbiter of humanity? I have dealt with arrogant beings who played at being god before. Black Lance—Apocrypha Terminus!",
      retort: "Hmph! An elf from an alien world daring to lecture the King? Your five seconds of foresight will only allow you to witness your demise with absolute clarity, mongrel!",
      tag: "APOCRYPHA TERMINUS VS GATE OF BABYLON"
    },
    gilgamesh: {
      intro: "The King of Heroes. Flaunting countless treasures and calling yourself the sole arbiter of humanity? I have dealt with arrogant beings who played at being god before. Black Lance—Apocrypha Terminus!",
      retort: "Hmph! An elf from an alien world daring to lecture the King? Your five seconds of foresight will only allow you to witness your demise with absolute clarity, mongrel!",
      tag: "APOCRYPHA TERMINUS VS GATE OF BABYLON"
    },
    scathach_lancer: {
      intro: "The spearwoman who dwells outside the world. Your weapon reach is formidable, Scáthach... but I can already see where your crimson thrust lands five seconds from now.",
      retort: "Foresight honed on the frontline of a calamity? Splendid, Lucia Lyozes! Pierce through my defenses if you have the will to slay a god!",
      tag: "PINNACLE LANCER DUEL"
    },
    cu_chulainn_lancer: {
      intro: "The Hound of Culann. Gáe Bolg rewrites causality to pierce the heart... but if I anticipate the cause five seconds prior, your barbed thrust will find only empty air.",
      retort: "An elf with combat clairvoyance? Sounds like quite the headache! Let's see if your eyes can keep up when my spear goes full throttle!",
      tag: "SPEAR OF CAUSALITY VS PRESCIENT FORESIGHT"
    },
    karna_lancer: {
      intro: "Hero of Charity. The blinding radiance of your solar spear won't dazzle my clairvoyance. Prepare your stance!",
      retort: "Your eyes do not gaze upon wealth or status, but upon the fragile lives behind you. A true vanguard. Come, Princess of Sylvanryth.",
      tag: "FLAME OF CHARITY & THE BLACK LANCE"
    },
    emiya_archer: {
      intro: "A nameless warrior fighting with projected blades... Your defensive stances are disciplined, but you're carrying the burden of sacrificing the few for the many. Stay behind my vanguard.",
      retort: "A pragmatic vanguard commander who refuses to lose another comrade... Our paths may differ, Princess, but I respect a warrior who guards her rear.",
      tag: "TACTICAL VANGUARD SCRUTINY"
    },
    heracles_berserker: {
      intro: "Twelve lives of godlike resilience? My Black Lance's Apocrypha Terminus strips away defensive barriers and false miracles. Rest now, great hero!",
      retort: "■■■■■■■■ーーーッ！！ (The titan roars in defiance, lunging forward with primordial earth-shattering force!)",
      tag: "ANTI-CHEAT PROTOCOL VS GOD HAND"
    },
    jeanne_d_arc_ruler: {
      intro: "Holy Maiden of Orleans. You carry the banner of faith, but divine miracles alone cannot prevent a calamity. You must harden your heart when disaster strikes.",
      retort: "I understand the burden you bear, Lucia. But faith is not a mere cheat—it is the light that guides humanity through darkness. Let us test our resolves!",
      tag: "LUMINOSITÉ ETERNELLE VS PRESCIENT FORESIGHT"
    },
    jeanne_darc_ruler: {
      intro: "Holy Maiden of Orleans. You carry the banner of faith, but divine miracles alone cannot prevent a calamity. You must harden your heart when disaster strikes.",
      retort: "I understand the burden you bear, Lucia. But faith is not a mere cheat—it is the light that guides humanity through darkness. Let us test our resolves!",
      tag: "LUMINOSITÉ ETERNELLE VS PRESCIENT FORESIGHT"
    },
    jeanne_alter: {
      intro: "An Avenger born of vengeful dragon fire. You lash out because the world betrayed you. I have seen entire nations turn to ash—your hatred changes nothing.",
      retort: "Shut up, preachy elf princess! What do you know about burning?! I'll turn your high-and-mighty lance into blackened cinders!",
      tag: "DRAGON WITCH'S SPITE VS HIGH ELVEN VANGUARD"
    },
    mhx_alter: {
      intro: "An extraterrestrial entity consuming dark matter sweets? Whatever outer realm you fell from, your reckless power ends at this perimeter. Ready yourself.",
      retort: "Calorie readings spiked! A super-serious elven warrior blocking the bakery supply chain? Engaging dark saber protocol!",
      tag: "VANGUARD DISCIPLINE VS COSMIC BERSERKER"
    },
    artoria_pendragon_alter: {
      intro: "A tyrant wielding corrupted holy steel. You discard sentiment for tyrannical efficiency, but ruthlessness without tactical clarity is merely reckless violence.",
      retort: "Hmph. A stubborn high elf clinging to dead comrades. Let your black lance test the weight of Excalibur Morgan, vanguard.",
      tag: "BLACK IRON VS BLACK SUN"
    },
    nero_claudius_saber: {
      intro: "Emperor of Rome. A battlefield is not an amphitheater for self-indulgent applause. Maintain your footing, or my lance will humble your theater.",
      retort: "Umu! What a severe, beautiful elven maiden! But true artistry shines brightest when clashing against an unyielding wall! Behold my golden stage!",
      tag: "IMPERIAL PASSION VS ELVEN PRAGMATISM"
    },
    adiosa_dragon_envoy: {
      intro: "The Dragon Envoy of Ixenor... You descend from Aethelian to purge the Ebonwatch Dungeon. But this world is not your disposable gameboard. Five seconds into the future, your path stops right here.",
      retort: "⟨ Vur Aeth'ra... ⟩ The High Elf Vanguard of the Wailing Tower. Floor 34 diver. Your mortal struggle against the Calamity was quaint, Lucia Lyozes. Yield before the dragon's ruin.",
      tag: "EBONWATCH CONVERGENCE: DRAGON ENVOY VS VANGUARD LANCER"
    },
    aoko_aozaki: {
      intro: "The Fifth Magician... Consuming future energy to alter current reality. Unchecked magic that warps time and consequences is something I will never tolerate on my watch!",
      retort: "Whoa, chill out! I don't plan on destroying the universe, elf lady! If you think you can read five seconds ahead of my Fifth Magic, let's see you try!",
      tag: "PREDETERMINED RUIN VS THE FIFTH MAGIC"
    },
    amamiya_no_chihaya_tenkohime: {
      intro: "An ancient Kyubi from Ossuaron's Spine... Your blade relies on beastly instinct. But against five-second foresight and the Black Lance, instinct is merely a predictable vector.",
      retort: "Uwah! Such a stern elf princess! Master, look at her spear, it is so long and sharp! Don't you dare poke washi's fluffy tails with that black lance, or washi will bite thee!",
      tag: "SYLVAN VANGUARD VS GUARDIAN OF OSSUARON"
    },
    amamiya: {
      intro: "An ancient Kyubi from Ossuaron's Spine... Your blade relies on beastly instinct. But against five-second foresight and the Black Lance, instinct is merely a predictable vector.",
      retort: "Uwah! Such a stern elf princess! Master, look at her spear, it is so long and sharp! Don't you dare poke washi's fluffy tails with that black lance, or washi will bite thee!",
      tag: "SYLVAN VANGUARD VS GUARDIAN OF OSSUARON"
    },
    lucia_lyozes: {
      intro: "A duplicate of myself? If you carry the same scars of the Calamity and the weight of the Hero's Party... then prove your resolve is stronger than mine!",
      retort: "There is only one vanguard who protects the Citadel Suburbs. Ground your spear—let us see whose foresight holds true!",
      tag: "MIRROR OF PREDESTINED RUIN"
    },
    luvria_greenharte: {
      intro: "Luvria! Stop spinning that staff like a toy and put up your guard! If you try to nullify your way out of morning drills again or use continent-scale magic in the city, I'm having Edmond hold you upside down until sundown!",
      retort: "Aha! Lucia, must thou be so terribly stern? 'Tis merely a friendly duel! Besides, how canst thou poke me if I selectively deny the concept of thy lance's kinetic impact? Come at me, Leader!",
      tag: "THE S-RANK VANGUARD & THE STRONGEST MAGE"
    },
    luvria: {
      intro: "Luvria! Stop spinning that staff like a toy and put up your guard! If you try to nullify your way out of morning drills again or use continent-scale magic in the city, I'm having Edmond hold you upside down until sundown!",
      retort: "Aha! Lucia, must thou be so terribly stern? 'Tis merely a friendly duel! Besides, how canst thou poke me if I selectively deny the concept of thy lance's kinetic impact? Come at me, Leader!",
      tag: "THE S-RANK VANGUARD & THE STRONGEST MAGE"
    },
    edmond: {
      intro: "Edmond. You know I don't hold back, even against my own shield. Plant your stance, or I'll spear right through your guard.",
      retort: "Lucia! You're really going to make the vanguard spar against the leader? Alright, but don't blame me if this tower shield knocks you off balance!",
      tag: "THE UNNAMED HERO PARTY: SHIELD & SPEAR"
    }
  },

  // 17. LUVRIA GREENHARTE (CASTER / THE "HERO", STRONGEST MAGE OF LYOZES)
  // =========================================================================
  luvria_greenharte: {
    // 1. VS LUCIA LYOZES
    lucia: {
      intro: "Lucia! Are we truly sparring? Please do not make that terrifying face; I promise not to erase the ground beneath your boots this time~",
      retort: "Five seconds into the future, you say? Let us see if your clairvoyance can keep pace when I rewrite the very rules of the arena, Leader!",
      tag: "THE S-RANK VANGUARD & THE STRONGEST MAGE"
    },
    lucia_lyozes: {
      intro: "Lucia! Are we truly sparring? Please do not make that terrifying face; I promise not to erase the ground beneath your boots this time~",
      retort: "Five seconds into the future, you say? Let us see if your clairvoyance can keep pace when I rewrite the very rules of the arena, Leader!",
      tag: "THE S-RANK VANGUARD & THE STRONGEST MAGE"
    },

    // 2. VS ADIOSA DRAGON ENVOY
    adiosa: {
      intro: "The ancient envoy of Aethelian... The Weight of Heaven is truly magnificent. But you will find the mortals of this world are far more than weeds to be pruned!",
      retort: "You anchor your permanence to the planet, yet I command the concept of existence itself. Let us see whose absolute authority breaks first, Dragon!",
      tag: "CATACLYSM CONVERGENCE: WORLD-PRUNER VS THE STRONGEST MAGE"
    },
    adiosa_dragon_envoy: {
      intro: "The ancient envoy of Aethelian... The Weight of Heaven is truly magnificent. But you will find the mortals of this world are far more than weeds to be pruned!",
      retort: "You anchor your permanence to the planet, yet I command the concept of existence itself. Let us see whose absolute authority breaks first, Dragon!",
      tag: "CATACLYSM CONVERGENCE: WORLD-PRUNER VS THE STRONGEST MAGE"
    },

    // 3. VS GILGAMESH (ARCHER)
    gilgamesh: {
      intro: "My, what a splendid golden treasury! But tell me, 'King of Heroes'—have you ever considered what happens when the concept of 'ownership' simply ceases to exist?",
      retort: "A 'mongrel'? How dreadfully uninspired. Let us see if your endless rain of divine relics can pierce a barrier that denies the very concept of impact!",
      tag: "CONCEPT NULLIFICATION VS GATE OF BABYLON"
    },
    gilgamesh_archer: {
      intro: "My, what a splendid golden treasury! But tell me, 'King of Heroes'—have you ever considered what happens when the concept of 'ownership' simply ceases to exist?",
      retort: "A 'mongrel'? How dreadfully uninspired. Let us see if your endless rain of divine relics can pierce a barrier that denies the very concept of impact!",
      tag: "CONCEPT NULLIFICATION VS GATE OF BABYLON"
    },

    // 4. VS ARTORIA PENDRAGON (SABER)
    artoria: {
      intro: "The legendary Sword of Promised Victory... A breathtaking radiant light, King of Knights. But I wonder... what happens when a promise meets an absolute denial?",
      retort: "Hold your golden blade high, Artoria! Let us test whether your chivalric oath can endure against a Hero who erases the very horizon of triumph!",
      tag: "SWORD OF VICTORY VS DENY THE VICTORY"
    },
    artoria_pendragon: {
      intro: "The legendary Sword of Promised Victory... A breathtaking radiant light, King of Knights. But I wonder... what happens when a promise meets an absolute denial?",
      retort: "Hold your golden blade high, Artoria! Let us test whether your chivalric oath can endure against a Hero who erases the very horizon of triumph!",
      tag: "SWORD OF VICTORY VS DENY THE VICTORY"
    },

    // 5. VS EMIYA (ARCHER)
    emiya: {
      intro: "A thousand forged blades resting beneath an endless crimson sky... A poignant landscape, Archer. Though relying on mere copies before a true archmage is rather bold~",
      retort: "Project all the infinite steel you wish, nameless guardian! No matter how many swords you weave, not one shall cross the distance I have nullified!",
      tag: "UNLIMITED BLADE WORKS VS DIVERGENT OMNIPOTENCE"
    },
    emiya_archer: {
      intro: "A thousand forged blades resting beneath an endless crimson sky... A poignant landscape, Archer. Though relying on mere copies before a true archmage is rather bold~",
      retort: "Project all the infinite steel you wish, nameless guardian! No matter how many swords you weave, not one shall cross the distance I have nullified!",
      tag: "UNLIMITED BLADE WORKS VS DIVERGENT OMNIPOTENCE"
    },

    // 6. VS CÚ CHULAINN (LANCER)
    cu_chulainn: {
      intro: "The famed Hound of Ulster! That cursed crimson spear of yours... it dictates that the heart is pierced before the thrust is even thrown, does it not? How delightfully quaint!",
      retort: "Causality reversal is a fascinating rule, Lancer! But what meaning does a guaranteed piercing carry against an existence that has nullified the concept of death?",
      tag: "REVERSED CAUSALITY VS CONCEPT NULLIFICATION"
    },
    cu_chulainn_lancer: {
      intro: "The famed Hound of Ulster! That cursed crimson spear of yours... it dictates that the heart is pierced before the thrust is even thrown, does it not? How delightfully quaint!",
      retort: "Causality reversal is a fascinating rule, Lancer! But what meaning does a guaranteed piercing carry against an existence that has nullified the concept of death?",
      tag: "REVERSED CAUSALITY VS CONCEPT NULLIFICATION"
    },
    cu: {
      intro: "The famed Hound of Ulster! That cursed crimson spear of yours... it dictates that the heart is pierced before the thrust is even thrown, does it not? How delightfully quaint!",
      retort: "Causality reversal is a fascinating rule, Lancer! But what meaning does a guaranteed piercing carry against an existence that has nullified the concept of death?",
      tag: "REVERSED CAUSALITY VS CONCEPT NULLIFICATION"
    },

    // 7. VS AOKO AOZAKI
    aoko_aozaki: {
      intro: "The Fifth Magic... Borrowing tomorrow's energy to blast through today, are you, Miss Magician? A delightfully brazen trick—let us see if your borrowed time can withstand my void!",
      retort: "Firing raw miracles like heavy artillery? I adore your lack of restraint, Aoko! Let us clash at the frontier where modern thaumaturgy meets absolute concept rewrite!",
      tag: "THE FIFTH MAGIC VS CONCEPT NULLIFICATION"
    },
    aoko: {
      intro: "The Fifth Magic... Borrowing tomorrow's energy to blast through today, are you, Miss Magician? A delightfully brazen trick—let us see if your borrowed time can withstand my void!",
      retort: "Firing raw miracles like heavy artillery? I adore your lack of restraint, Aoko! Let us clash at the frontier where modern thaumaturgy meets absolute concept rewrite!",
      tag: "THE FIFTH MAGIC VS CONCEPT NULLIFICATION"
    },

    // 8. VS AMAMIYA NO CHIHAYA TENKOHIME (FOX GUARDIAN)
    amamiya: {
      intro: "Oh, what a remarkably fluffy divine guardian! Tell me, Tenkohime-sama, would you accept a peaceful ceasefire in exchange for a towering platter of sweet fried tofu?",
      retort: "Kyuuu?! Fried tofu?! Master, didst thou hear this cheeky elf mage?! Washi will not be bribed so easily by deep-fried treats... although, if thou addest sweet sake... wait, no! Amazakura, to my side! Washi shall show thee the might of an ancient guardian!",
      tag: "THE SACRED FOX & THE ELVEN HERO"
    },
    amamiya_no_chihaya_tenkohime: {
      intro: "Oh, what a remarkably fluffy divine guardian! Tell me, Tenkohime-sama, would you accept a peaceful ceasefire in exchange for a towering platter of sweet fried tofu?",
      retort: "Kyuuu?! Fried tofu?! Master, didst thou hear this cheeky elf mage?! Washi will not be bribed so easily by deep-fried treats... although, if thou addest sweet sake... wait, no! Amazakura, to my side! Washi shall show thee the might of an ancient guardian!",
      tag: "THE SACRED FOX & THE ELVEN HERO"
    },

    // 9. VS MIRROR MATCH (Luvria vs Luvria)
    mirror_match: {
      intro: "My, what an exceptionally gorgeous, prodigiously talented archmage! Are you here to challenge my title, or did the universe simply decide one Hero wasn't enough to carry all these sweets?",
      retort: "Nullifying my own nullifications? How delightfully absurd! Let us see which of us is the genuine Hero of Lyozes and which is merely an unruly reflection!",
      tag: "MIRROR OF OMNIPOTENCE"
    },
    luvria_greenharte: {
      intro: "My, what an exceptionally gorgeous, prodigiously talented archmage! Are you here to challenge my title, or did the universe simply decide one Hero wasn't enough to carry all these sweets?",
      retort: "Nullifying my own nullifications? How delightfully absurd! Let us see which of us is the genuine Hero of Lyozes and which is merely an unruly reflection!",
      tag: "MIRROR OF OMNIPOTENCE"
    },
    luvria: {
      intro: "My, what an exceptionally gorgeous, prodigiously talented archmage! Are you here to challenge my title, or did the universe simply decide one Hero wasn't enough to carry all these sweets?",
      retort: "Nullifying my own nullifications? How delightfully absurd! Let us see which of us is the genuine Hero of Lyozes and which is merely an unruly reflection!",
      tag: "MIRROR OF OMNIPOTENCE"
    },
    edmond: {
      intro: "Edmond! You promised extra honey pastries if I behaved today! Don't make me erase the ground under that giant shield!",
      retort: "Luvria! Playtime's over, kid! Put that staff down before you blow up the camp kitchen again!",
      tag: "FAMILY OF EBONWATCH: FATHERLY SHIELD VS THE HERO"
    }
  },

  // =========================================================================
  // 18. EDMOND (SHIELDER / S-RANK VANGUARD)
  // =========================================================================
  edmond: {
    // 1. VS LUCIA LYOZES
    lucia: {
      intro: "Lucia! You're really going to make the vanguard spar against the leader? Alright, but don't blame me if this tower shield knocks you off balance!",
      retort: "Edmond. You know I don't hold back, even against my own shield. Plant your stance, or I'll spear right through your guard.",
      tag: "THE UNNAMED HERO PARTY: SHIELD & SPEAR"
    },
    lucia_lyozes: {
      intro: "Lucia! You're really going to make the vanguard spar against the leader? Alright, but don't blame me if this tower shield knocks you off balance!",
      retort: "Edmond. You know I don't hold back, even against my own shield. Plant your stance, or I'll spear right through your guard.",
      tag: "THE UNNAMED HERO PARTY: SHIELD & SPEAR"
    },

    // 2. VS LUVRIA GREENHARTE
    luvria: {
      intro: "Luvria! Playtime's over, kid! Put that staff down before you blow up the camp kitchen again!",
      retort: "Edmond! You promised extra honey pastries if I behaved today! Don't make me erase the ground under that giant shield!",
      tag: "FAMILY OF EBONWATCH: FATHERLY SHIELD VS THE HERO"
    },
    luvria_greenharte: {
      intro: "Luvria! Playtime's over, kid! Put that staff down before you blow up the camp kitchen again!",
      retort: "Edmond! You promised extra honey pastries if I behaved today! Don't make me erase the ground under that giant shield!",
      tag: "FAMILY OF EBONWATCH: FATHERLY SHIELD VS THE HERO"
    },

    // 3. VS ADIOSA DRAGON ENVOY
    adiosa: {
      intro: "That ancient dragon presence... The Weight of Heaven, huh? I've carried the weight of the Wailing Tower on my back for forty-five years. Let's see whose earth is heavier!",
      retort: "A mortal beast clad in scarred resolve... Commendable. But can your bedrock withstand the pruning of a dying star?",
      tag: "TITANIC DEFENSE VS WORLD-PRUNING GRAVITY"
    },
    adiosa_dragon_envoy: {
      intro: "That ancient dragon presence... The Weight of Heaven, huh? I've carried the weight of the Wailing Tower on my back for forty-five years. Let's see whose earth is heavier!",
      retort: "A mortal beast clad in scarred resolve... Commendable. But can your bedrock withstand the pruning of a dying star?",
      tag: "TITANIC DEFENSE VS WORLD-PRUNING GRAVITY"
    },

    // 4. VS GILGAMESH
    gilgamesh: {
      intro: "King of Heroes, is it? You've got an awful lot of shiny swords in that vault. Mind if I see how many break against my shield?",
      retort: "A beast of the slums dares stand before the King of Heroes? Your insolence will be rewarded with a thousand divine blades, mongrel!",
      tag: "TOWER SHIELD VS GATE OF BABYLON"
    },
    gilgamesh_archer: {
      intro: "King of Heroes, is it? You've got an awful lot of shiny swords in that vault. Mind if I see how many break against my shield?",
      retort: "A beast of the slums dares stand before the King of Heroes? Your insolence will be rewarded with a thousand divine blades, mongrel!",
      tag: "TOWER SHIELD VS GATE OF BABYLON"
    },

    // 5. VS ARTORIA PENDRAGON
    artoria: {
      intro: "King of Knights! Your Excalibur shines bright, but let's see how that holy light handles a frontline veteran who won't budge an inch!",
      retort: "Immovable courage... Your shield carries the weight of your allies' lives. I shall meet your resolve with the full glory of Britain!",
      tag: "HOLY SWORD OF VICTORY VS TIGRIS REDOUBT"
    },
    artoria_pendragon: {
      intro: "King of Knights! Your Excalibur shines bright, but let's see how that holy light handles a frontline veteran who won't budge an inch!",
      retort: "Immovable courage... Your shield carries the weight of your allies' lives. I shall meet your resolve with the full glory of Britain!",
      tag: "HOLY SWORD OF VICTORY VS TIGRIS REDOUBT"
    },

    // 6. VS AMAMIYA NO CHIHAYA TENKOHIME (FOX GUARDIAN)
    amamiya: {
      intro: "Hey there, little fox! You're waving those tails around like you're itching for a fight. Stay behind my shield before someone steps on them!",
      retort: "Kyuuu?! Who art thou calling a little fox?! Washi has lived for centuries! Respect thy elder, tiger warrior!",
      tag: "GUARDIAN OF EBONWATCH VS SACRED SHRINE GUARDIAN"
    },
    amamiya_no_chihaya_tenkohime: {
      intro: "Hey there, little fox! You're waving those tails around like you're itching for a fight. Stay behind my shield before someone steps on them!",
      retort: "Kyuuu?! Who art thou calling a little fox?! Washi has lived for centuries! Respect thy elder, tiger warrior!",
      tag: "GUARDIAN OF EBONWATCH VS SACRED SHRINE GUARDIAN"
    },

    // 7. VS ARTORIA PENDRAGON ALTER
    artoria_alter: {
      intro: "Dark dragon mana radiating from that blackened blade... You've discarded the white armor, King of Knights, but your strike is heavier than ever. Bring it on—my shield doesn't care what color the sword is!",
      retort: "Insolent beast. No fortress of iron withstands the abyss of Morgan. Brace yourself, vanguard—I will cleave your bedrock in twain.",
      tag: "TYRANT'S CALIBURN VS SCARRED REDOUBT"
    },
    artoria_pendragon_alter: {
      intro: "Dark dragon mana radiating from that blackened blade... You've discarded the white armor, King of Knights, but your strike is heavier than ever. Bring it on—my shield doesn't care what color the sword is!",
      retort: "Insolent beast. No fortress of iron withstands the abyss of Morgan. Brace yourself, vanguard—I will cleave your bedrock in twain.",
      tag: "TYRANT'S CALIBURN VS SCARRED REDOUBT"
    },

    // 8. VS EMIYA (ARCHER)
    emiya: {
      intro: "A red coat, twin blades, and cynical eyes. You look like a man who's survived too many lost causes, archer. How many projected blades will it take to scratch this tower shield?",
      retort: "A frontline defender who fights with his body on the line... admirable, but reckless. Let's see if your shield holds against Caladbolg II!",
      tag: "UNLIMITED BLADEWORKS VS BEDROCK VANGUARD"
    },
    emiya_archer: {
      intro: "A red coat, twin blades, and cynical eyes. You look like a man who's survived too many lost causes, archer. How many projected blades will it take to scratch this tower shield?",
      retort: "A frontline defender who fights with his body on the line... admirable, but reckless. Let's see if your shield holds against Caladbolg II!",
      tag: "UNLIMITED BLADEWORKS VS BEDROCK VANGUARD"
    },

    // 9. VS CÚ CHULAINN (LANCER)
    cu_chulainn: {
      intro: "The Hound of Ulster! That crimson spear carries the scent of a thousand death-defying battles. Think you can pierce straight through my core before my shield bats you back?",
      retort: "Gaha! Now that's the kind of thick-skinned monster I love hunting! Plant your feet, big guy—Gáe Bulg never misses its mark!",
      tag: "PIERCING CRIMSON GÁE BULG VS TIGRIS WALL"
    },
    cu_chulainn_lancer: {
      intro: "The Hound of Ulster! That crimson spear carries the scent of a thousand death-defying battles. Think you can pierce straight through my core before my shield bats you back?",
      retort: "Gaha! Now that's the kind of thick-skinned monster I love hunting! Plant your feet, big guy—Gáe Bulg never misses its mark!",
      tag: "PIERCING CRIMSON GÁE BULG VS TIGRIS WALL"
    },

    // 10. VS HERACLES (BERSERKER)
    heracles: {
      intro: "That primeval roar... Nine Lives, twelve trials, and raw Olympian fury! I survived the Floor 50 Abyss, giant—I'm not backing down from Hercules!",
      retort: "▂▂▃▃▄▄▅▅! (The God Hand bellows with primeval fury, raising the stone axe-sword to test the mortal vanguard's indomitable shield!)",
      tag: "TWELVE LABORS VS INDOMITABLE REDOUBT"
    },
    heracles_berserker: {
      intro: "That primeval roar... Nine Lives, twelve trials, and raw Olympian fury! I survived the Floor 50 Abyss, giant—I'm not backing down from Hercules!",
      retort: "▂▂▃▃▄▄▅▅! (The God Hand bellows with primeval fury, raising the stone axe-sword to test the mortal vanguard's indomitable shield!)",
      tag: "TWELVE LABORS VS INDOMITABLE REDOUBT"
    },

    // 11. VS SCÁTHACH (LANCER)
    scathach: {
      intro: "Queen of the Land of Shadows... They say you've killed gods and trained the greatest warriors alive. Don't go easy on an old frontline beast, teacher!",
      retort: "A warrior whose soul has been hammered upon the anvil of mortal struggle. Very well. Let us test if your shield can withstand the threshold of Dun Scaith!",
      tag: "GATE OF SKYE VS FORTRESS OF EBONWATCH"
    },
    scathach_lancer: {
      intro: "Queen of the Land of Shadows... They say you've killed gods and trained the greatest warriors alive. Don't go easy on an old frontline beast, teacher!",
      retort: "A warrior whose soul has been hammered upon the anvil of mortal struggle. Very well. Let us test if your shield can withstand the threshold of Dun Scaith!",
      tag: "GATE OF SKYE VS FORTRESS OF EBONWATCH"
    },

    // 12. VS KARNA (LANCER)
    karna: {
      intro: "Hero of Charity! Your spear burns with the heat of the sun itself. Let's see if solar fire can melt a shield forged in the coldest subterranean abyss!",
      retort: "Your stance is pure and devoid of hesitation. A warrior who protects his brethren with his life deserves the fullest radiance of Vasavi Shakti.",
      tag: "SUN GOD'S BRILLIANCE VS IMPREGNABLE BASTION"
    },
    karna_lancer: {
      intro: "Hero of Charity! Your spear burns with the heat of the sun itself. Let's see if solar fire can melt a shield forged in the coldest subterranean abyss!",
      retort: "Your stance is pure and devoid of hesitation. A warrior who protects his brethren with his life deserves the fullest radiance of Vasavi Shakti.",
      tag: "SUN GOD'S BRILLIANCE VS IMPREGNABLE BASTION"
    },

    // 13. VS JEANNE D'ARC (RULER)
    jeanne: {
      intro: "Saint of Orleans! Your sacred banner inspires thousands, but out here on the frontline, a banner needs a solid wall in front of it. Let's trade defense tactics!",
      retort: "The Lord is my light and my salvation! Master Edmond, your protective heart shines with true devotion. Luminosité Eternelle, shield our path!",
      tag: "HOLY MAIDEN'S BANNER VS VANGUARD'S SHIELD"
    },
    jeanne_darc_ruler: {
      intro: "Saint of Orleans! Your sacred banner inspires thousands, but out here on the frontline, a banner needs a solid wall in front of it. Let's trade defense tactics!",
      retort: "The Lord is my light and my salvation! Master Edmond, your protective heart shines with true devotion. Luminosité Eternelle, shield our path!",
      tag: "HOLY MAIDEN'S BANNER VS VANGUARD'S SHIELD"
    },
    jeanne_d_arc: {
      intro: "Saint of Orleans! Your sacred banner inspires thousands, but out here on the frontline, a banner needs a solid wall in front of it. Let's trade defense tactics!",
      retort: "The Lord is my light and my salvation! Master Edmond, your protective heart shines with true devotion. Luminosité Eternelle, shield our path!",
      tag: "HOLY MAIDEN'S BANNER VS VANGUARD'S SHIELD"
    },

    // 14. VS JEANNE D'ARC ALTER (AVENGER)
    jalter: {
      intro: "Dragon Witch! Screaming about burning the world down won't work on me. I've babysat stubborn hotheads like Luvria for years—throw those flames right here!",
      retort: "Who are you calling a stubborn hothead, you oversized slum cat?! I'll roast that rusty shield into slag and make you beg for mercy! La Grondement Du Haine!",
      tag: "FLAMES OF VENGEANCE VS SCARRED BASTION"
    },
    jeanne_alter: {
      intro: "Dragon Witch! Screaming about burning the world down won't work on me. I've babysat stubborn hotheads like Luvria for years—throw those flames right here!",
      retort: "Who are you calling a stubborn hothead, you oversized slum cat?! I'll roast that rusty shield into slag and make you beg for mercy! La Grondement Du Haine!",
      tag: "FLAMES OF VENGEANCE VS SCARRED BASTION"
    },

    // 15. VS NERO CLAUDIUS (SABER)
    nero: {
      intro: "Emperor of Rome! All that gold and rose petals... You fight like you're performing on a grand stage. Just try not to trip over my shield when you pirouette!",
      retort: "Umu! What a magnificent, rugged gladiator! A true colosseum champion! Let the golden theater resound with our passionate clash, Praetor's loyal vanguard!",
      tag: "GOLDEN THEATER VS RUGGED ARENA SHIELD"
    },
    nero_claudius_saber: {
      intro: "Emperor of Rome! All that gold and rose petals... You fight like you're performing on a grand stage. Just try not to trip over my shield when you pirouette!",
      retort: "Umu! What a magnificent, rugged gladiator! A true colosseum champion! Let the golden theater resound with our passionate clash, Praetor's loyal vanguard!",
      tag: "GOLDEN THEATER VS RUGGED ARENA SHIELD"
    },
    nero_claudius: {
      intro: "Emperor of Rome! All that gold and rose petals... You fight like you're performing on a grand stage. Just try not to trip over my shield when you pirouette!",
      retort: "Umu! What a magnificent, rugged gladiator! A true colosseum champion! Let the golden theater resound with our passionate clash, Praetor's loyal vanguard!",
      tag: "GOLDEN THEATER VS RUGGED ARENA SHIELD"
    },

    // 16. VS MYSTERIOUS HEROINE X ALTER (BERSERKER)
    mhx_alter: {
      intro: "A Sith Saber craving sweets? Hey, kid, put down that dual-bladed lightsaber and I might have a couple of chocolate wafers in my pouch for you.",
      retort: "...Bribing the Dark Lord with high-calorie snacks? ...I accept the offering, but your shield still must be cleaved by the Cross-Calibur.",
      tag: "DARK SIDE CALIBUR VS SWEETS-SEEKING SHIELD"
    },
    ecchan: {
      intro: "A Sith Saber craving sweets? Hey, kid, put down that dual-bladed lightsaber and I might have a couple of chocolate wafers in my pouch for you.",
      retort: "...Bribing the Dark Lord with high-calorie snacks? ...I accept the offering, but your shield still must be cleaved by the Cross-Calibur.",
      tag: "DARK SIDE CALIBUR VS SWEETS-SEEKING SHIELD"
    },

    // 17. VS AOKO AOZAKI
    aoko: {
      intro: "Miss Fifth Magician! Accelerating magic circuits with martial arts? That's my kind of direct brawl! Let's see whose kinetic impact hits harder!",
      retort: "Not bad, big guy! An old-school tank who isn't afraid to take a hit directly to the chest! Don't blink, or my Magic Bullet Stream will blow your stance wide open!",
      tag: "FIFTH MAGIC RETROGRADE VS KINETIC SHIELD-BASH"
    },
    aoko_aozaki: {
      intro: "Miss Fifth Magician! Accelerating magic circuits with martial arts? That's my kind of direct brawl! Let's see whose kinetic impact hits harder!",
      retort: "Not bad, big guy! An old-school tank who isn't afraid to take a hit directly to the chest! Don't blink, or my Magic Bullet Stream will blow your stance wide open!",
      tag: "FIFTH MAGIC RETROGRADE VS KINETIC SHIELD-BASH"
    },

    // 18. MIRROR MATCH
    edmond: {
      intro: "Another scarred tiger with a red scarf and a heavy shield? Guess there's two of us who refuse to let our family die!",
      retort: "Let's see who holds the true line, then. One shield stands, one shield falls!",
      tag: "REDOUBT OF THE DUAL TIGERS"
    }
  }
};

// Also alias amamiya, lucia, and luvria in the database
(SERVANT_MATCHUP_DATABASE as Record<string, any>)['amamiya'] = SERVANT_MATCHUP_DATABASE.amamiya_no_chihaya_tenkohime;
(SERVANT_MATCHUP_DATABASE as Record<string, any>)['lucia'] = SERVANT_MATCHUP_DATABASE.lucia_lyozes;
(SERVANT_MATCHUP_DATABASE as Record<string, any>)['luvria'] = SERVANT_MATCHUP_DATABASE.luvria_greenharte;
(SERVANT_MATCHUP_DATABASE as Record<string, any>)['edmond'] = SERVANT_MATCHUP_DATABASE.edmond;

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
  const getAltId = (id: string) => {
    if (id === 'amamiya') return 'amamiya_no_chihaya_tenkohime';
    if (id === 'amamiya_no_chihaya_tenkohime') return 'amamiya';
    if (id === 'lucia') return 'lucia_lyozes';
    if (id === 'lucia_lyozes') return 'lucia';
    if (id === 'luvria') return 'luvria_greenharte';
    if (id === 'luvria_greenharte') return 'luvria';
    return id;
  };
  const cAlt = getAltId(cId);
  const oAlt = getAltId(oId);
  const isMirror = cId === oId || cAlt === oId || cId === oAlt;

  // 1. Check if Challenger instance has a custom rival line configured via Servant Workshop
  const cCustomInstance = 'customQuotes' in challenger ? challenger.customQuotes : undefined;
  const oCustomInstance = 'customQuotes' in opponent ? opponent.customQuotes : undefined;

  let challengerLine = '';
  let defenderLine = '';
  let tag = '';

  if (cCustomInstance?.matchups?.[oId]?.intro || cCustomInstance?.matchups?.[oAlt]?.intro) {
    challengerLine = (cCustomInstance.matchups[oId]?.intro || cCustomInstance.matchups[oAlt]?.intro)!;
  }
  if (cCustomInstance?.matchups?.[oId]?.tag || cCustomInstance?.matchups?.[oAlt]?.tag) {
    tag = (cCustomInstance.matchups[oId]?.tag || cCustomInstance.matchups[oAlt]?.tag)!;
  }

  // 2. Check if Defender instance has a custom retort line configured
  if (oCustomInstance?.matchups?.[cId]?.retort || oCustomInstance?.matchups?.[cAlt]?.retort) {
    defenderLine = (oCustomInstance.matchups[cId]?.retort || oCustomInstance.matchups[cAlt]?.retort)!;
  }

  // 3. Check Challenger's template matchupDialogues
  if (!challengerLine && (cTemplate.matchupDialogues?.[oId]?.intro || cTemplate.matchupDialogues?.[oAlt]?.intro)) {
    challengerLine = (cTemplate.matchupDialogues?.[oId]?.intro || cTemplate.matchupDialogues?.[oAlt]?.intro)!;
  }
  if (!defenderLine && (cTemplate.matchupDialogues?.[oId]?.retort || cTemplate.matchupDialogues?.[oAlt]?.retort)) {
    defenderLine = (cTemplate.matchupDialogues?.[oId]?.retort || cTemplate.matchupDialogues?.[oAlt]?.retort)!;
  }
  if (!tag && (cTemplate.matchupDialogues?.[oId]?.tag || cTemplate.matchupDialogues?.[oAlt]?.tag)) {
    tag = (cTemplate.matchupDialogues?.[oId]?.tag || cTemplate.matchupDialogues?.[oAlt]?.tag)!;
  }

  // 4. Check canonical SERVANT_MATCHUP_DATABASE
  const matchEntry =
    SERVANT_MATCHUP_DATABASE[cId]?.[oId] ||
    SERVANT_MATCHUP_DATABASE[cId]?.[oAlt] ||
    SERVANT_MATCHUP_DATABASE[cAlt]?.[oId] ||
    SERVANT_MATCHUP_DATABASE[cAlt]?.[oAlt];

  if (!challengerLine && matchEntry?.intro) {
    challengerLine = matchEntry.intro;
  }
  if (!defenderLine && matchEntry?.retort) {
    defenderLine = matchEntry.retort;
  }
  if (!tag && matchEntry?.tag) {
    tag = matchEntry.tag;
  }

  // If defenderLine still missing, check opponent's database entry facing challenger
  const oppMatchEntry =
    SERVANT_MATCHUP_DATABASE[oId]?.[cId] ||
    SERVANT_MATCHUP_DATABASE[oId]?.[cAlt] ||
    SERVANT_MATCHUP_DATABASE[oAlt]?.[cId] ||
    SERVANT_MATCHUP_DATABASE[oAlt]?.[cAlt];

  if (!defenderLine && oppMatchEntry?.intro) {
    defenderLine = oppMatchEntry.intro;
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
