// Comprehensive Servant Battle Dialogue & Cut-In Engine
// Provides distinct, dynamic personality lines for Buster, Arts, Quick, Mixed chains, and Desperation

export interface ServantDialogueProfile {
  buster: string[];
  arts: string[];
  quick: string[];
  mixed: string[];
  desperation: string[];
}

export const SERVANT_COMBAT_DIALOGUES: Record<string, ServantDialogueProfile> = {
  // Mysterious Heroine X (Alter) - Berserker
  mhx_alter: {
    buster: [
      "Twin black blade overload! Calibur... BREAK! Out of my way!",
      "Dark Matter reactor output: 200%! Crushing all obstacles!",
      "Maximum annihilation drive! You shall not interfere with my sugar intake!",
      "Forbidden Black Lightning! Pulverize the target into cosmic dust!"
    ],
    arts: [
      "Activating dark mana reactor. Sweet bean jelly reserves holding at 100%.",
      "Analyzing opponent's spiritual density... Calibrating Dark Matter discharge.",
      "Calmly consuming Japanese confectionery... Calculating lethal trajectory.",
      "Prana condensation complete. Dark side energy channeling through the coils."
    ],
    quick: [
      "High-speed stealth vector confirmed. Eradicating all Sabers in the sector.",
      "Too slow to evade! Slicing through space-time with dual crimson blades!",
      "Entering hyper-drive ambush mode. Target acquired, commencing fatal slash.",
      "Critical Star condensation! Even the speed of light cannot outrun this strike!"
    ],
    mixed: [
      "Executing Dark Cavalier tactical sequence. Target will be eliminated.",
      "My blade serves dark justice... and premium Japanese snacks.",
      "Reactor cycle optimal. Engaging target with continuous dark strikes.",
      "Target verified. Do not make me deploy full universe-cleaving protocol."
    ],
    desperation: [
      "Core warning... Emergency override engaged! I will NOT fall without tea!",
      "Dark Matter reactor meltdown threshold breached! Taking you with me!",
      "My pact with Master isn't over yet... Sweet bean energy, grant me strength!"
    ]
  },

  // Artoria Pendragon - Saber
  artoria: {
    buster: [
      "Excalibur's radiant light shall vanquish all! Strike true!",
      "All mana into my blade! For the honor of Britain, yield!",
      "Unwavering conviction! Smite evil with the sacred golden flame!",
      "Dragon core ignite! Witness the furious might of the King of Knights!"
    ],
    arts: [
      "Prana circulation stable. Directing the noble path into the holy sword.",
      "Clear your mind, breathe as one... The sword guides our destiny.",
      "Channelling the breath of the dragon into our sacred strike.",
      "The battlefield reveals all truths. I shall cut down your hesitation."
    ],
    quick: [
      "Wind of the King, sweep the battlefield! Strike before they draw breath!",
      "Invisible Air releases! A gale of unseen blades!",
      "Fleet-footed chivalry! You shall not evade the strike of Camelot!",
      "Critical Star convergence! Slicing through your opening with blinding speed!"
    ],
    mixed: [
      "Executing tactical chain! Master, observe the swordsmanship of the King!",
      "My sword is yours, Master. Together we shall claim the Holy Grail!",
      "Step forward, knight. Let our steel test each other's resolve.",
      "Advancing across the front line with steady blade and steadfast heart."
    ],
    desperation: [
      "Even if my body falters, the oath to my kingdom and Master shall never break!",
      "Stand tall, Artoria! As long as Excalibur shines, victory is not lost!",
      "This wound is trivial... I will cut our way to the dawn!"
    ]
  },

  // Gilgamesh - Archer
  gilgamesh: {
    buster: [
      "Rejoice, mongrel! You are granted the honor of falling to my treasury!",
      "Drown in the peerless treasures of Babylon! Insolent fool!",
      "A pitiful insect dares to stand before the King?! Perish!",
      "Tremble before true grandeur! Every legendary blade belongs to me!"
    ],
    arts: [
      "Observing your futile resistance... A predictable choreography.",
      "Mana? The king commands infinite reserves from the vault of ages.",
      "Look upon my vaults, mongrel. Your meager tactics amuse me.",
      "A measured judgment from the Golden King. Accept your punishment."
    ],
    quick: [
      "Fleeing is useless! My celestial armaments outrun the tempest!",
      "Hahaha! A flurry of treasures to pierce your every defense!",
      "Too slow, mongrel! My vault rains upon you faster than lightning!",
      "Count the blades raining from heaven if you can!"
    ],
    mixed: [
      "Very well. I shall entertain you for a passing moment.",
      "Master, watch and marvel as the treasures of the world claim another victory.",
      "A king commands, and the battlefield obeys without exception.",
      "Do not disappoint me further. Show me what amusement you can offer!"
    ],
    desperation: [
      "How dare an insect push the King of Heroes this far?! Pay with your life!",
      "Insolence beyond measure! The Vault of Babylon opens its deepest armaments!",
      "You think you have cornered me?! Know your place, worm!"
    ]
  },

  // Scáthach - Lancer
  scathach: {
    buster: [
      "Stand firm if you dare! A true warrior never flinches before the spear!",
      "Piercing through armor and flesh alike! Crimson lance, obliterate!",
      "Feel the crushing weight of the Land of Shadows! Shatter!",
      "Let the blood-stained spear drink its fill! Face me!"
    ],
    arts: [
      "Patience, precision, lethality. Observe the true martial art of Dun Scaith.",
      "Primordial runes awaken. Let the battlefield become our domain.",
      "Draw upon the leyline... The spear strikes where destiny dictates.",
      "A warrior must read the flow of life and death. You are already pierced."
    ],
    quick: [
      "A mortal's reflex cannot outspeed divine spear mastery! Fall!",
      "Dual crimson spears dancing in the wind! Vanish!",
      "Too slow! The gap between heaven and earth is crossed in an instant!",
      "Critical puncture! Blood follows the path of my spear tip!"
    ],
    mixed: [
      "Show me your technique, young one. Let us see if you are worthy.",
      "A disciplined strike is the foundation of survival. Forward!",
      "My spear obeys my Master's resolve. Do not lose your composure.",
      "Good form. Now let us see if your spirit matches your blade."
    ],
    desperation: [
      "An admirable strike... Now, show me if you have what it takes to kill me!",
      "Pain is the forge of a warrior! Stand and face the Gate of Dun Scaith!",
      "Not yet... The Land of Shadows still calls for more blood!"
    ]
  },

  // Cú Chulainn - Lancer
  cu_chulainn: {
    buster: [
      "Gáe Bolg won't miss! Full-force thrust straight through your defenses!",
      "Get blown away! A strike backed by the Hound of Culann!",
      "All weight behind this thrust! Don't blink or you'll lose your head!",
      "Brute force from the Celtic wild! Try stopping this one!"
    ],
    arts: [
      "Nordic runes align! Let's see how long your mystic barriers hold up!",
      "Ansor rune inscribe! Mana charging straight into the crimson spear!",
      "Don't rush it... finding the sweet spot for the fatal thrust.",
      "Magic and spear craft combined. That's the Ulster way!"
    ],
    quick: [
      "Too slow! The Hound leaves no tracks in the bloodied grass!",
      "Like lightning over the moor! You won't even see the wound opening!",
      "Critical surge! A high-speed flurry that pierces thirty times at once!",
      "Run all you want, you can't outrun the red spear!"
    ],
    mixed: [
      "Alright Master, point me at 'em and let me loose!",
      "Heh, you're not half bad. But I'm taking this round!",
      "Just another day on the battlefield. Let's make it exciting!",
      "Keep up the commands, Master! I'll carve the path!"
    ],
    desperation: [
      "Battle Continuation isn't just for show! Come on, I'm just getting warmed up!",
      "Heh... You really think a mortal blow will keep the Hound down?!",
      "I promised my Master a victory, and I don't break promises!"
    ]
  },

  // EMIYA - Archer
  emiya: {
    buster: [
      "I am the bone of my sword... Steel is my body and fire is my blood!",
      "Caladbolg II, overcharge projection! Shatter the perimeter!",
      "Structural analysis complete: Maximum crushing force applied!",
      "Reinforcement magic at full output. Taste cold wrought iron!"
    ],
    arts: [
      "Analyzing structural blueprint... Reinforcement projection sequence complete.",
      "Tracing the origin, replicating the craftsmanship... All blades align.",
      "Reading enemy tactical spacing. Setting mystic landmines across the lane.",
      "A bowman who fights in melee... My prana circuit remains stable."
    ],
    quick: [
      "Kanshou and Bakuya, dual arc trajectory! Intercepting the blind spot!",
      "Crane Wing Three-Realm Strike! Slicing through your blind flanks!",
      "High-speed interception! Firing six arrows along parabolic trajectories!",
      "Defensive breach spotted. Closing the distance in an eye-blink!"
    ],
    mixed: [
      "Executing Master's strategy. Projection systems standing by.",
      "Don't worry Master, I've seen battles far worse than this.",
      "Adapting weapon choice to enemy combat style. Advancing now.",
      "An iron will is sharper than any blade. Let's finish this cleanly."
    ],
    desperation: [
      "Tracing last projection... As long as I can draw breath, the forge still burns!",
      "My entire life was Unlimited Blade Works... I will not falter here!",
      "Master, give the order! I'll hold the line with every blade I have!"
    ]
  },

  // Jeanne d'Arc (Alter) - Avenger
  jeanne_alter: {
    buster: [
      "Turn to ash! Every single ember shall consume your pathetic soul!",
      "Burn! BURN TO CINDERS! There is no salvation for you!",
      "La Grondement du Haine! Suffer the agony of my black flames!",
      "Pulverize them! Trample their hopes beneath our boots!"
    ],
    arts: [
      "Curse the heavens, curse the earth... Dark fire burns brightest in despair.",
      "Gathering the black flames... The hatred in my chest never cools.",
      "Ponder your sins while my dark flames lick your skin.",
      "Vengeance requires cold calculation before the grand inferno."
    ],
    quick: [
      "Too slow! Laughable! I'll carve you up before you even scream!",
      "Flickering cursed flames! You cannot escape my retribution!",
      "Dancing through the ash! Every strike leaves a searing brand!",
      "Critical Star massacre! Let's hear your desperate cries!"
    ],
    mixed: [
      "Hmph! Don't get in my way, Master, or I might burn you by accident!",
      "More fodder for the fire. Make it amusing at least.",
      "You dare command the Dragon Witch? Fine, watch me slaughter them.",
      "Is that all they've got? How thoroughly disappointing."
    ],
    desperation: [
      "You think this hurts?! My hatred is an infinite inferno! BURN!",
      "I died in flames once... Do you really think mortal wounds can stop me?!",
      "I refuse to lose! Not to this scum, and not before my Master!"
    ]
  },

  // Mordred - Saber
  mordred: {
    buster: [
      "Clarent, purge this battlefield! Father will acknowledge my supremacy!",
      "Eat this! Two-handed crushing overhead smash!",
      "Crimson lightning overload! Out of my way, roadkill!",
      "I'm gonna pulverize your armor into scrap metal! TAKE THIS!"
    ],
    arts: [
      "Hah! Charging straight through your mystic codes! Don't look away!",
      "Mana burst crackling around my broadsword! Let's see you block this!",
      "Don't call me a woman, and don't underestimate my prana flow!",
      "Focusing the crimson lightning... Ready for the breach!"
    ],
    quick: [
      "Eat my dust! Too slow to even see the edge of my broadsword!",
      "Blitzing through your guard! Heavy blade with supersonic velocity!",
      "Critical strike! I'm cutting you into three pieces before you land!",
      "Hahaha! Try running! Mordred doesn't leave survivors!"
    ],
    mixed: [
      "Alright Master, let's smash 'em to bits and grab some meat after!",
      "Leave the front line to me! Nobody beats Mordred in a brawl!",
      "Keep sending commands! I'll swing as hard as you want!",
      "Hey, keep your eyes on me! Watch the true heir of Camelot win!"
    ],
    desperation: [
      "Not yet... NOT YET! I'm taking your head off even if I bleed out!",
      "The Knight of Treachery never bows to anyone! COME ON!",
      "I'm not dying until Father admits I'm the strongest! DIE!"
    ]
  },

  // Nero Claudius - Saber
  nero: {
    buster: [
      "Laus Saint Claudius! Revel in the resplendent applause of the Emperor!",
      "A passionate crimson slash! Behold the majesty of Roma!",
      "Aestus Estus, cleave their insolence! A grand opening act!",
      "Magnificent destruction! Even the gods marvel at my strike!"
    ],
    arts: [
      "Let the theater resound! A harmony of blades and majestic song!",
      "Bask in the golden aura of the Golden Theater! Prana blooming!",
      "Artistic perfection! Every motion a masterpiece of imperial grace.",
      "Master, are you watching? I shall compose a masterpiece of victory!"
    ],
    quick: [
      "Behold my agile acrobatics! A rose petal dancing in the storm!",
      "Fleet as the Roman chariot! You cannot catch the Emperor!",
      "A brilliant flourish! Petals of blood and golden glory!",
      "Critical brilliance! Every strike worthy of a standing ovation!"
    ],
    mixed: [
      "UMU! Master's command is worthy of the highest imperial honor!",
      "Let us paint this stage with the brilliant colors of triumph!",
      "Hear the cheers of Roma echoing across the Holy Grail War!",
      "Praise me, Master! Your Emperor shall deliver a flawless show!"
    ],
    desperation: [
      "The final act has just begun! The spotlight never dims on the Emperor!",
      "Imperial Privilege EX! Even death itself must wait for the curtain call!",
      "I shall not fall while my beloved Master's eyes are upon me! UMU!"
    ]
  },

  // Karna - Lancer
  karna: {
    buster: [
      "O Surya, witness this strike. All shall be reduced to sacred kindling.",
      "The Hero of Charity strikes without hatred. Disperse like ash.",
      "Kundala and Kavacha shine. Consuming all falsehood with sacred fire.",
      "Vasavi lance, burn away this obstacle."
    ],
    arts: [
      "The flames of discrimination vanish in charity. Contemplate your destiny.",
      "Solar prana flowing through my veins. The cycle of duty continues.",
      "Brahma's sacred law remains unbroken. Aligning spiritual core.",
      "A warrior does not boast. The strike speaks for itself."
    ],
    quick: [
      "Swift as celestial lightning. The sun spares no shadow.",
      "Piercing through the solar flares... A strike that leaves no trace.",
      "Light moves without hesitation. Accept this flash of truth.",
      "Critical brilliance of the sun god. Evading is impossible."
    ],
    mixed: [
      "Master, your will is my duty. I shall see it fulfilled.",
      "I fight because you have entrusted your faith to me.",
      "There is no shame in a noble defeat. Prepare yourself, opponent.",
      "The spear follows the truth of your command."
    ],
    desperation: [
      "A hero is judged by his conduct in extremity. Witness the end.",
      "Even stripped of my armor, the pride of Surya burns undiminished.",
      "I gave my word to Master. I will not fail that promise."
    ]
  },

  // Heracles - Berserker
  heracles: {
    buster: [
      "■■■■■■■■■■■■■■■■! (Seismic roar pulverizes the earth!)",
      "■■■■■■■■■■! (Swings colossal stone slab with mountain-shattering force!)",
      "ROOOOOOAAAARRRR! (Shockwaves rip the ground apart!)",
      "■■■■■■■■■■■■---!!! (Madness Enhancement overwhelms the perimeter!)"
    ],
    arts: [
      "■■■■■■... (Ancient warrior instincts awaken beneath the crimson glow).",
      "■■■■... (Prana gathers silently into the superhuman titan physique).",
      "■■■■■■! (Eyes gleam with the tactical cunning of the Twelve Labors).",
      "■■■■... (Steady battle trance channels divine strength)."
    ],
    quick: [
      "■■■■■■! (Supersonic lunge leaves sonic booms in his wake!)",
      "■■■■■■■■! (Unfathomable agility for a giant, blitzing the flank!)",
      "■■■■! (Supersonic cleave cuts through the sound barrier!)",
      "■■■■■■■■! (Critical star eruption from nine simultaneous strikes!)"
    ],
    mixed: [
      "■■■■■■■■! (Nods firmly to Master and charges the enemy vanguard).",
      "■■■■... (Gargantuan frame stands as an impenetrable shield).",
      "■■■■■■! (Roars defiance at the opposing Servants).",
      "■■■■... (Eyes lock onto target with lethal certainty)."
    ],
    desperation: [
      "■■■■■■■■■■■■■■■■! (God Hand awakens... unyielding resurrecting fury!)",
      "ROOOOOOAAAARRRR! (Refuses death through legendary Twelve Labors endurance!)",
      "■■■■■■■■■■! (The Great Hero of Greece will never fall on his knees!)"
    ]
  },

  // Mash Kyrielight - Shielder
  mash: {
    buster: [
      "Lord Camelot... I will stand firm and shatter your vanguard!",
      "With Master's courage, my shield becomes an unstoppable ram!",
      "Deploying kinetic impact! For Senpai, I won't back down!",
      "Direct offensive shield bash! Breaching the enemy barrier!"
    ],
    arts: [
      "Shield deployment synchronized! Deploying tactical energy grid!",
      "Prana channels open. Protecting Senpai with the Round Table's blessing.",
      "Spirit Origin stabilizing. Defensive perimeter holding at maximum.",
      "Reading enemy attack vectors. Formulating counter-strike pathway."
    ],
    quick: [
      "Accelerating maneuver! Advancing through the line of fire!",
      "Shield-edge deflection into counter-slash! Too fast to bypass!",
      "Interception protocol! Striking the vulnerable gap in their stance!",
      "Critical star support confirmed! Seizing the offensive opening!"
    ],
    mixed: [
      "Senpai, I'm right here beside you! Let's win this together!",
      "All defensive systems operational. My shield will not break!",
      "Observing Master's tactical orders. Advancing to forward position!",
      "Heroic Spirit Shielder, Mash Kyrielight! Ready to fight!"
    ],
    desperation: [
      "Senpai... as long as you believe in me, I will never lower this shield!",
      "Even if this armor fractures, the will to protect you stands unbreakable!",
      "Lord Camelot will never fall! Senpai, stand behind me!"
    ]
  }
};

// Generic Fallback Profile for custom/unrecognized servants
const GENERIC_PROFILE: ServantDialogueProfile = {
  buster: [
    "All mana into maximum destruction! Unstoppable strike!",
    "Crushing power! Let our blade shatter their defenses!",
    "Full combat discharge! Yield before our mighty blow!",
    "Buster overload! Smite the opponent with overwhelming force!"
  ],
  arts: [
    "Charging mana reservoir... Let's flood the battlefield!",
    "Tactical prana alignment. Channeling sacred arts into the strike.",
    "A measured strike with perfect prana circulation.",
    "Analyzing spiritual blueprint... Releasing refined magical burst."
  ],
  quick: [
    "Swift like lightning... You won't even see the strike!",
    "Critical Star ambush! Piercing the blind spot in an instant!",
    "High-speed flanking maneuver! Slicing through their guard!",
    "Vanish in the gale! A flurry of lethal strikes!"
  ],
  mixed: [
    "Executing tactical 3-card chain! My blade answers your command, Master!",
    "Master, observe our teamwork! We shall secure the victory!",
    "Advancing across the front line with steadfast focus.",
    "Our pact shall not be broken! Steel clash, resolve confirmed!"
  ],
  desperation: [
    "I won't fall here... Master, give me strength!",
    "My Spirit Origin remains unyielding! Final strike!",
    "This pain is nothing... I shall fulfill our pact to the end!"
  ]
};

/**
 * Normalizes servant name to look up personality profile
 */
export function getServantProfile(servantName?: string): ServantDialogueProfile {
  if (!servantName) return GENERIC_PROFILE;
  const n = servantName.toLowerCase();

  if (n.includes('alter') && (n.includes('heroine') || n.includes('mhx') || n.includes('ecchan'))) {
    return SERVANT_COMBAT_DIALOGUES.mhx_alter;
  }
  if (n.includes('artoria') || n.includes('arthur') || n.includes('saber')) {
    return SERVANT_COMBAT_DIALOGUES.artoria;
  }
  if (n.includes('gilgamesh') || n.includes('king of heroes')) {
    return SERVANT_COMBAT_DIALOGUES.gilgamesh;
  }
  if (n.includes('scáthach') || n.includes('scathach')) {
    return SERVANT_COMBAT_DIALOGUES.scathach;
  }
  if (n.includes('cú') || n.includes('cu') || n.includes('chulainn')) {
    return SERVANT_COMBAT_DIALOGUES.cu_chulainn;
  }
  if (n.includes('emiya') || n.includes('archer') || n.includes('nameless')) {
    return SERVANT_COMBAT_DIALOGUES.emiya;
  }
  if (n.includes('jeanne') && n.includes('alter') || n.includes('jalter')) {
    return SERVANT_COMBAT_DIALOGUES.jeanne_alter;
  }
  if (n.includes('mordred')) {
    return SERVANT_COMBAT_DIALOGUES.mordred;
  }
  if (n.includes('nero') || n.includes('claudius')) {
    return SERVANT_COMBAT_DIALOGUES.nero;
  }
  if (n.includes('karna')) {
    return SERVANT_COMBAT_DIALOGUES.karna;
  }
  if (n.includes('heracles') || n.includes('berserker') || n.includes('hercules')) {
    return SERVANT_COMBAT_DIALOGUES.heracles;
  }
  if (n.includes('mash') || n.includes('shielder')) {
    return SERVANT_COMBAT_DIALOGUES.mash;
  }

  return GENERIC_PROFILE;
}

export interface ChainDialogueResult {
  quote: string;
  tag: string;
  color: number;
  isBraveChain: boolean;
  isDesperation: boolean;
  chainType: 'buster_brave' | 'arts_chain' | 'quick_chain' | 'mixed' | 'np' | 'desperation';
}

/**
 * Calculates dynamic, varied servant dialogue for the active combat chain.
 * Guarantees that servants NEVER repeat the same quote every turn!
 */
export function getServantChainDialogue(
  servantName: string,
  servantClass: string,
  cards: ('Buster' | 'Arts' | 'Quick' | 'NP')[],
  customQuotes?: { battleStart?: string; noblePhantasm?: string; summon?: string; victory?: string; defeat?: string },
  currentHp?: number,
  maxHp?: number,
  roundOrTurnSeed: number = 0
): ChainDialogueResult {
  const profile = getServantProfile(servantName);
  const isNP = cards.includes('NP');
  const isBusterBrave = cards.length === 3 && cards.every(c => c === 'Buster');
  const isArtsChain = cards.length === 3 && cards.every(c => c === 'Arts');
  const isQuickChain = cards.length === 3 && cards.every(c => c === 'Quick');
  const isDesperation = (currentHp !== undefined && maxHp !== undefined && maxHp > 0) 
    ? (currentHp / maxHp) <= 0.25 
    : false;

  // Helper to pick varied lines based on turn seed + time
  const pickVaried = (list: string[]) => {
    if (!list || list.length === 0) return "My blade answers your command, Master!";
    const idx = Math.abs(Math.floor(Date.now() / 300) + roundOrTurnSeed) % list.length;
    return list[idx];
  };

  if (isNP) {
    const npChant = customQuotes?.noblePhantasm || 
      (profile.buster[0] ? `“${profile.buster[0]}”` : "Noble Phantasm Unleashed!");
    return {
      quote: npChant,
      tag: 'NOBLE PHANTASM CHANT',
      color: 0xf59e0b,
      isBraveChain: true,
      isDesperation,
      chainType: 'np'
    };
  }

  if (isDesperation && Math.random() > 0.35) {
    return {
      quote: pickVaried(profile.desperation),
      tag: 'CRITICAL DESPERATION STRIKE',
      color: 0xd97706,
      isBraveChain: false,
      isDesperation: true,
      chainType: 'desperation'
    };
  }

  if (isBusterBrave) {
    return {
      quote: pickVaried(profile.buster),
      tag: 'BUSTER BRAVE CHAIN',
      color: 0xef4444,
      isBraveChain: true,
      isDesperation,
      chainType: 'buster_brave'
    };
  }

  if (isArtsChain) {
    return {
      quote: pickVaried(profile.arts),
      tag: 'ARTS MANA CHAIN',
      color: 0x3b82f6,
      isBraveChain: true,
      isDesperation,
      chainType: 'arts_chain'
    };
  }

  if (isQuickChain) {
    return {
      quote: pickVaried(profile.quick),
      tag: 'QUICK STAR CHAIN',
      color: 0x10b981,
      isBraveChain: true,
      isDesperation,
      chainType: 'quick_chain'
    };
  }

  // Mixed / Standard Tactical Chain (e.g. Buster + Arts + Quick)
  // Combines varied mixed dialogue with occasional custom lines
  const mixedPool = [...profile.mixed];
  if (customQuotes?.battleStart) {
    mixedPool.push(customQuotes.battleStart);
  }

  return {
    quote: pickVaried(mixedPool),
    tag: 'TACTICAL COMBAT CHAIN',
    color: 0xd4af37,
    isBraveChain: false,
    isDesperation,
    chainType: 'mixed'
  };
}

/**
 * Determines whether this attack turn warrants triggering the heavy 4-second Visual Novel Dialogue Cut-In!
 * RULE: Only trigger for Pure Brave/Resonance Chains (Buster Brave, Arts Mana, Quick Star)
 * or Desperation Last Stand (<25% HP), NOT for ordinary mixed 3-card chains!
 */
export function shouldTriggerDialogueCutIn(
  cards: ('Buster' | 'Arts' | 'Quick' | 'NP')[],
  currentHp?: number,
  maxHp?: number,
  forceTrigger: boolean = false
): boolean {
  if (forceTrigger) return true;
  if (cards.includes('NP')) return false; // NP has its own dedicated animated GIF cinematic!

  const isBraveChain = cards.length === 3 && (
    cards.every(c => c === 'Buster') ||
    cards.every(c => c === 'Arts') ||
    cards.every(c => c === 'Quick')
  );

  const isDesperation = (currentHp !== undefined && maxHp !== undefined && maxHp > 0)
    ? (currentHp / maxHp) <= 0.25
    : false;

  return isBraveChain || isDesperation;
}
