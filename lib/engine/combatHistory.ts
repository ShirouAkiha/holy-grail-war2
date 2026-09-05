import { BattleState, CombatBattleRecord, CombatTurnLog } from '../types/index';

export const COMBAT_HISTORY_STORAGE_KEY = 'fate_combat_arena_last_10_battles_v1';
export const MAX_STORED_BATTLES = 10;

// Authentic seed battles so the user can immediately inspect turn-by-turn history
export const INITIAL_SEED_BATTLES: CombatBattleRecord[] = [
  {
    id: 'battle_clash_001_gilgamesh',
    timestamp: Date.now() - 1000 * 60 * 18, // 18 mins ago
    outcome: 'victory',
    totalTurns: 3,
    player1: {
      id: 'p1_artoria_saber',
      name: 'Artoria Pendragon',
      servantClass: 'Saber',
      masterName: 'Chaldea Master',
      noblePhantasmName: 'Excalibur: Sword of Promised Victory',
      finalHp: 16840,
      maxHp: 28500,
      atk: 12240,
      def: 9800
    },
    player2: {
      id: 'p2_gilgamesh_archer',
      name: 'Gilgamesh',
      servantClass: 'Archer',
      masterName: 'Rival Master Kotomine',
      noblePhantasmName: 'Enuma Elish: Star of Creation That Split Heaven and Earth',
      finalHp: 0,
      maxHp: 32000,
      atk: 13850,
      def: 8900
    },
    totalDamageDealt: 35120,
    totalDamageTaken: 11660,
    noblePhantasmsUsed: 1,
    criticalHitsLanded: 2,
    turns: [
      {
        turnNumber: 1,
        actorId: 'p1_artoria_saber',
        actorName: 'Artoria Pendragon',
        targetId: 'p2_gilgamesh_archer',
        targetName: 'Gilgamesh',
        actionSummary: '⚔️ Artoria Pendragon activated Charisma B (+18% ATK) and struck with a Buster Brave Chain dealing 12,480 DMG!',
        cardChainType: 'Buster Brave',
        cardsUsed: ['Buster', 'Buster', 'Buster'],
        skillsUsed: ['Charisma B'],
        damageDealt: 12480,
        isCritical: true,
        starsGenerated: 6,
        npCharged: 18,
        actorHpRemaining: 28500,
        targetHpRemaining: 19520,
        actorHpMax: 28500,
        targetHpMax: 32000,
        actorNp: 48,
        targetNp: 20
      },
      {
        turnNumber: 1,
        actorId: 'p2_gilgamesh_archer',
        actorName: 'Gilgamesh',
        targetId: 'p1_artoria_saber',
        targetName: 'Artoria Pendragon',
        actionSummary: '⚔️ Gilgamesh activated Golden Rule A and barraged with Gate of Babylon cards dealing 5,820 DMG!',
        cardChainType: 'Normal',
        cardsUsed: ['Buster', 'Arts', 'Quick'],
        skillsUsed: ['Golden Rule A'],
        damageDealt: 5820,
        isCritical: false,
        starsGenerated: 14,
        npCharged: 35,
        actorHpRemaining: 19520,
        targetHpRemaining: 22680,
        actorHpMax: 32000,
        targetHpMax: 28500,
        actorNp: 55,
        targetNp: 48
      },
      {
        turnNumber: 2,
        actorId: 'p1_artoria_saber',
        actorName: 'Artoria Pendragon',
        targetId: 'p2_gilgamesh_archer',
        targetName: 'Gilgamesh',
        actionSummary: '⚔️ Artoria Pendragon chained Arts-Arts-Quick, channeling leylines to hit 100% NP charge!',
        cardChainType: 'Arts Chain',
        cardsUsed: ['Arts', 'Arts', 'Quick'],
        skillsUsed: ['Prana Burst A'],
        damageDealt: 7340,
        isCritical: false,
        starsGenerated: 18,
        npCharged: 52,
        actorHpRemaining: 22680,
        targetHpRemaining: 12180,
        actorHpMax: 28500,
        targetHpMax: 32000,
        actorNp: 100,
        targetNp: 55
      },
      {
        turnNumber: 2,
        actorId: 'p2_gilgamesh_archer',
        actorName: 'Gilgamesh',
        targetId: 'p1_artoria_saber',
        targetName: 'Artoria Pendragon',
        actionSummary: '⚔️ Gilgamesh used Collector EX and hurled celestial weaponry dealing 5,840 DMG.',
        cardChainType: 'Normal',
        cardsUsed: ['Buster', 'Quick', 'Arts'],
        skillsUsed: ['Collector EX'],
        damageDealt: 5840,
        isCritical: true,
        starsGenerated: 12,
        npCharged: 30,
        actorHpRemaining: 12180,
        targetHpRemaining: 16840,
        actorHpMax: 32000,
        targetHpMax: 28500,
        actorNp: 85,
        targetNp: 100
      },
      {
        turnNumber: 3,
        actorId: 'p1_artoria_saber',
        actorName: 'Artoria Pendragon',
        targetId: 'p2_gilgamesh_archer',
        targetName: 'Gilgamesh',
        actionSummary: '💥 NOBLE PHANTASM UNLEASHED! Artoria Pendragon raised the golden blade of promised victory, dealing 15,300 decisive DMG and vaporizing the King of Heroes!',
        cardChainType: 'Buster Brave',
        cardsUsed: ['NP', 'Buster', 'Buster'],
        skillsUsed: ['Intuition A'],
        npTriggered: true,
        isNoblePhantasm: true,
        npChant: 'Gathered breath of stars, shining torrent of life... EXCALIBUR!',
        damageDealt: 15300,
        isCritical: true,
        starsGenerated: 25,
        npCharged: 0,
        actorHpRemaining: 16840,
        targetHpRemaining: 0,
        actorHpMax: 28500,
        targetHpMax: 32000,
        actorNp: 0,
        targetNp: 85
      }
    ]
  },
  {
    id: 'battle_clash_002_cuchulainn',
    timestamp: Date.now() - 1000 * 60 * 45, // 45 mins ago
    outcome: 'victory',
    totalTurns: 2,
    player1: {
      id: 'p1_cuchulainn_lancer',
      name: 'Cú Chulainn',
      servantClass: 'Lancer',
      masterName: 'Chaldea Master',
      noblePhantasmName: 'Gáe Bulg: Barbed Spear of Piercing Death',
      finalHp: 24200,
      maxHp: 27000,
      atk: 11800,
      def: 9200
    },
    player2: {
      id: 'p2_emiya_archer',
      name: 'EMIYA',
      servantClass: 'Archer',
      masterName: 'Rival Master Tohsaka',
      noblePhantasmName: 'Unlimited Blade Works: Infinite Creation of Swords',
      finalHp: 0,
      maxHp: 26500,
      atk: 11400,
      def: 9500
    },
    totalDamageDealt: 29800,
    totalDamageTaken: 2800,
    noblePhantasmsUsed: 1,
    criticalHitsLanded: 2,
    turns: [
      {
        turnNumber: 1,
        actorId: 'p1_cuchulainn_lancer',
        actorName: 'Cú Chulainn',
        targetId: 'p2_emiya_archer',
        targetName: 'EMIYA',
        actionSummary: '⚔️ Cú Chulainn invoked Protection from Arrows (Evade) and launched a Quick Chain dealing 9,600 Class Advantage DMG!',
        cardChainType: 'Quick Chain',
        cardsUsed: ['Quick', 'Quick', 'Quick'],
        skillsUsed: ['Protection from Arrows'],
        damageDealt: 9600,
        isCritical: true,
        starsGenerated: 32,
        npCharged: 45,
        actorHpRemaining: 27000,
        targetHpRemaining: 16900,
        actorHpMax: 27000,
        targetHpMax: 26500,
        actorNp: 75,
        targetNp: 30
      },
      {
        turnNumber: 1,
        actorId: 'p2_emiya_archer',
        actorName: 'EMIYA',
        targetId: 'p1_cuchulainn_lancer',
        targetName: 'Cú Chulainn',
        actionSummary: '⚔️ EMIYA traced Kanshou and Bakuya, but Cú Chulainn deflected the barrage with Protection from Arrows!',
        cardChainType: 'Arts Chain',
        cardsUsed: ['Arts', 'Arts', 'Arts'],
        skillsUsed: ['Magecraft C-'],
        damageDealt: 2800,
        isCritical: false,
        starsGenerated: 8,
        npCharged: 38,
        actorHpRemaining: 16900,
        targetHpRemaining: 24200,
        actorHpMax: 26500,
        targetHpMax: 27000,
        actorNp: 68,
        targetNp: 75
      },
      {
        turnNumber: 2,
        actorId: 'p1_cuchulainn_lancer',
        actorName: 'Cú Chulainn',
        targetId: 'p2_emiya_archer',
        targetName: 'EMIYA',
        actionSummary: '💥 NOBLE PHANTASM UNLEASHED! Cú Chulainn reversed causality with the barbed demonic spear Gáe Bulg, piercing EMIYA heart for 20,200 lethal DMG!',
        cardChainType: 'Buster Brave',
        cardsUsed: ['NP', 'Buster', 'Quick'],
        skillsUsed: ['Disengage C'],
        npTriggered: true,
        isNoblePhantasm: true,
        npChant: 'Your heart is already mine... GÁE BULG!',
        damageDealt: 20200,
        isCritical: true,
        starsGenerated: 20,
        npCharged: 15,
        actorHpRemaining: 24200,
        targetHpRemaining: 0,
        actorHpMax: 27000,
        targetHpMax: 26500,
        actorNp: 15,
        targetNp: 68
      }
    ]
  },
  {
    id: 'battle_clash_003_heracles',
    timestamp: Date.now() - 1000 * 60 * 95, // 95 mins ago
    outcome: 'defeat',
    totalTurns: 4,
    player1: {
      id: 'p1_medusa_rider',
      name: 'Medusa',
      servantClass: 'Rider',
      masterName: 'Chaldea Master',
      noblePhantasmName: 'Bellerophon: Bridle of Chivalry',
      finalHp: 0,
      maxHp: 25000,
      atk: 10500,
      def: 8600
    },
    player2: {
      id: 'p2_heracles_berserker',
      name: 'Heracles',
      servantClass: 'Berserker',
      masterName: 'Illyasviel von Einzbern',
      noblePhantasmName: 'Nine Lives: Shooting the Hundred Heads',
      finalHp: 8500,
      maxHp: 36000,
      atk: 15200,
      def: 11000
    },
    totalDamageDealt: 27500,
    totalDamageTaken: 31200,
    noblePhantasmsUsed: 1,
    criticalHitsLanded: 1,
    turns: [
      {
        turnNumber: 1,
        actorId: 'p1_medusa_rider',
        actorName: 'Medusa',
        targetId: 'p2_heracles_berserker',
        targetName: 'Heracles',
        actionSummary: '⚔️ Medusa activated Mystic Eyes of Petrification (Cybele) and scored a Quick Chain for 7,800 DMG.',
        cardChainType: 'Quick Chain',
        cardsUsed: ['Quick', 'Quick', 'Quick'],
        skillsUsed: ['Cybele A+'],
        damageDealt: 7800,
        isCritical: false,
        starsGenerated: 28,
        npCharged: 35,
        actorHpRemaining: 25000,
        targetHpRemaining: 28200,
        actorHpMax: 25000,
        targetHpMax: 36000,
        actorNp: 55,
        targetNp: 25
      },
      {
        turnNumber: 1,
        actorId: 'p2_heracles_berserker',
        actorName: 'Heracles',
        targetId: 'p1_medusa_rider',
        targetName: 'Medusa',
        actionSummary: '⚔️ Heracles roared in Madness Enhancement and smashed with an earth-shattering stone axe for 9,400 Berserker DMG!',
        cardChainType: 'Buster Brave',
        cardsUsed: ['Buster', 'Buster', 'Buster'],
        skillsUsed: ['Valor A+'],
        damageDealt: 9400,
        isCritical: true,
        starsGenerated: 5,
        npCharged: 20,
        actorHpRemaining: 28200,
        targetHpRemaining: 15600,
        actorHpMax: 36000,
        targetHpMax: 25000,
        actorNp: 45,
        targetNp: 55
      },
      {
        turnNumber: 2,
        actorId: 'p1_medusa_rider',
        actorName: 'Medusa',
        targetId: 'p2_heracles_berserker',
        targetName: 'Heracles',
        actionSummary: '⚔️ Medusa channeled Bloodfort Andromeda for mana siphon, gaining +45% NP and dealing 6,200 DMG.',
        cardChainType: 'Arts Chain',
        cardsUsed: ['Arts', 'Arts', 'Buster'],
        skillsUsed: ['Bloodfort Andromeda B'],
        damageDealt: 6200,
        isCritical: false,
        starsGenerated: 12,
        npCharged: 45,
        actorHpRemaining: 15600,
        targetHpRemaining: 22000,
        actorHpMax: 25000,
        targetHpMax: 36000,
        actorNp: 100,
        targetNp: 45
      },
      {
        turnNumber: 2,
        actorId: 'p2_heracles_berserker',
        actorName: 'Heracles',
        targetId: 'p1_medusa_rider',
        targetName: 'Medusa',
        actionSummary: '⚔️ Heracles followed through with brutal cleaving strikes, dealing 7,800 DMG.',
        cardChainType: 'Normal',
        cardsUsed: ['Buster', 'Arts', 'Buster'],
        skillsUsed: ['Mind’s Eye (Fake) B'],
        damageDealt: 7800,
        isCritical: false,
        starsGenerated: 6,
        npCharged: 25,
        actorHpRemaining: 22000,
        targetHpRemaining: 7800,
        actorHpMax: 36000,
        targetHpMax: 25000,
        actorNp: 70,
        targetNp: 100
      },
      {
        turnNumber: 3,
        actorId: 'p1_medusa_rider',
        actorName: 'Medusa',
        targetId: 'p2_heracles_berserker',
        targetName: 'Heracles',
        actionSummary: '💥 NOBLE PHANTASM UNLEASHED! Medusa summoned the divine Pegasus Bellerophon, dealing 13,500 radiant DMG!',
        cardChainType: 'Quick Chain',
        cardsUsed: ['NP', 'Quick', 'Quick'],
        skillsUsed: ['Monstrous Strength B'],
        npTriggered: true,
        isNoblePhantasm: true,
        npChant: 'Grasp the bridle and soar to heavens... BELLEROPHON!',
        damageDealt: 13500,
        isCritical: true,
        starsGenerated: 35,
        npCharged: 20,
        actorHpRemaining: 7800,
        targetHpRemaining: 8500,
        actorHpMax: 25000,
        targetHpMax: 36000,
        actorNp: 20,
        targetNp: 100
      },
      {
        turnNumber: 4,
        actorId: 'p2_heracles_berserker',
        actorName: 'Heracles',
        targetId: 'p1_medusa_rider',
        targetName: 'Medusa',
        actionSummary: '💥 NOBLE PHANTASM UNLEASHED! Heracles triggered Battle Continuation and unleashed Nine Lives, executing 9 rapid dragon-slaying blows for 14,000 fatal DMG!',
        cardChainType: 'Buster Brave',
        cardsUsed: ['NP', 'Buster', 'Buster'],
        skillsUsed: ['Battle Continuation A'],
        npTriggered: true,
        isNoblePhantasm: true,
        npChant: '■■■■■■■■■■■■! NINE LIVES!',
        damageDealt: 14000,
        isCritical: true,
        starsGenerated: 15,
        npCharged: 0,
        actorHpRemaining: 8500,
        targetHpRemaining: 0,
        actorHpMax: 36000,
        targetHpMax: 25000,
        actorNp: 0,
        targetNp: 20
      }
    ]
  },
  {
    id: 'battle_clash_004_jeanne',
    timestamp: Date.now() - 1000 * 60 * 150, // 2.5 hours ago
    outcome: 'victory',
    totalTurns: 3,
    player1: {
      id: 'p1_jeanne_ruler',
      name: 'Jeanne d\'Arc',
      servantClass: 'Ruler',
      masterName: 'Chaldea Master',
      noblePhantasmName: 'Luminosité Eternelle: God is Here With Me',
      finalHp: 27500,
      maxHp: 32000,
      atk: 10800,
      def: 13500
    },
    player2: {
      id: 'p2_gilles_caster',
      name: 'Gilles de Rais',
      servantClass: 'Caster',
      masterName: 'Rival Master Ryuunosuke',
      noblePhantasmName: 'Prelati\'s Spellbook: Text of the Sunken Spiral City',
      finalHp: 0,
      maxHp: 24000,
      atk: 9600,
      def: 8200
    },
    totalDamageDealt: 26400,
    totalDamageTaken: 4500,
    noblePhantasmsUsed: 1,
    criticalHitsLanded: 1,
    turns: [
      {
        turnNumber: 1,
        actorId: 'p1_jeanne_ruler',
        actorName: 'Jeanne d\'Arc',
        targetId: 'p2_gilles_caster',
        targetName: 'Gilles de Rais',
        actionSummary: '⚔️ Jeanne d\'Arc established Revelation A and attacked with an Arts Chain for 8,200 DMG, buffing team NP.',
        cardChainType: 'Arts Chain',
        cardsUsed: ['Arts', 'Arts', 'Arts'],
        skillsUsed: ['Revelation A'],
        damageDealt: 8200,
        isCritical: false,
        starsGenerated: 15,
        npCharged: 48,
        actorHpRemaining: 32000,
        targetHpRemaining: 15800,
        actorHpMax: 32000,
        targetHpMax: 24000,
        actorNp: 58,
        targetNp: 20
      },
      {
        turnNumber: 1,
        actorId: 'p2_gilles_caster',
        actorName: 'Gilles de Rais',
        targetId: 'p1_jeanne_ruler',
        targetName: 'Jeanne d\'Arc',
        actionSummary: '⚔️ Gilles de Rais summoned abyssal horrors with Prelati\'s Spellbook, but Jeanne\'s Ruler resistance reduced damage to 2,200.',
        cardChainType: 'Normal',
        cardsUsed: ['Arts', 'Buster', 'Quick'],
        skillsUsed: ['Mental Pollution A'],
        damageDealt: 2200,
        isCritical: false,
        starsGenerated: 5,
        npCharged: 25,
        actorHpRemaining: 15800,
        targetHpRemaining: 29800,
        actorHpMax: 24000,
        targetHpMax: 32000,
        actorNp: 45,
        targetNp: 58
      },
      {
        turnNumber: 2,
        actorId: 'p1_jeanne_ruler',
        actorName: 'Jeanne d\'Arc',
        targetId: 'p2_gilles_caster',
        targetName: 'Gilles de Rais',
        actionSummary: '⚔️ Jeanne d\'Arc activated True Name Revelation and channeled holy banners for 7,800 DMG.',
        cardChainType: 'Normal',
        cardsUsed: ['Buster', 'Arts', 'Quick'],
        skillsUsed: ['True Name Revelation B'],
        damageDealt: 7800,
        isCritical: true,
        starsGenerated: 18,
        npCharged: 42,
        actorHpRemaining: 29800,
        targetHpRemaining: 8000,
        actorHpMax: 32000,
        targetHpMax: 24000,
        actorNp: 100,
        targetNp: 45
      },
      {
        turnNumber: 2,
        actorId: 'p2_gilles_caster',
        actorName: 'Gilles de Rais',
        targetId: 'p1_jeanne_ruler',
        targetName: 'Jeanne d\'Arc',
        actionSummary: '⚔️ Gilles frantically chanted eldritch invocations, inflicting 2,300 chipped damage.',
        cardChainType: 'Normal',
        cardsUsed: ['Arts', 'Arts', 'Buster'],
        skillsUsed: ['Aesthetic Appreciation E-'],
        damageDealt: 2300,
        isCritical: false,
        starsGenerated: 4,
        npCharged: 20,
        actorHpRemaining: 8000,
        targetHpRemaining: 27500,
        actorHpMax: 24000,
        targetHpMax: 32000,
        actorNp: 65,
        targetNp: 100
      },
      {
        turnNumber: 3,
        actorId: 'p1_jeanne_ruler',
        actorName: 'Jeanne d\'Arc',
        targetId: 'p2_gilles_caster',
        targetName: 'Gilles de Rais',
        actionSummary: '💥 NOBLE PHANTASM UNLEASHED! Jeanne planted the holy standard of Orléans, purging the corruption with Luminosité Eternelle for 10,400 holy DMG!',
        cardChainType: 'Arts Chain',
        cardsUsed: ['NP', 'Arts', 'Buster'],
        skillsUsed: ['Divine Judgement A'],
        npTriggered: true,
        isNoblePhantasm: true,
        npChant: 'My Lord, grant thy blessing to this flag... Luminosité Eternelle!',
        damageDealt: 10400,
        isCritical: false,
        starsGenerated: 22,
        npCharged: 20,
        actorHpRemaining: 27500,
        targetHpRemaining: 0,
        actorHpMax: 32000,
        targetHpMax: 24000,
        actorNp: 20,
        targetNp: 65
      }
    ]
  },
  {
    id: 'battle_clash_005_mordred',
    timestamp: Date.now() - 1000 * 60 * 240, // 4 hours ago
    outcome: 'victory',
    totalTurns: 2,
    player1: {
      id: 'p1_mordred_saber',
      name: 'Mordred',
      servantClass: 'Saber',
      masterName: 'Chaldea Master',
      noblePhantasmName: 'Clarent Blood Arthur: Rebellion Against My Beautiful Father',
      finalHp: 21900,
      maxHp: 29000,
      atk: 13100,
      def: 9400
    },
    player2: {
      id: 'p2_sasaki_assassin',
      name: 'Sasaki Kojiro',
      servantClass: 'Assassin',
      masterName: 'Rival Master Ryuudou',
      noblePhantasmName: 'Tsubame Gaeshi: Swallow Reversal',
      finalHp: 0,
      maxHp: 23000,
      atk: 10200,
      def: 7900
    },
    totalDamageDealt: 28200,
    totalDamageTaken: 7100,
    noblePhantasmsUsed: 1,
    criticalHitsLanded: 2,
    turns: [
      {
        turnNumber: 1,
        actorId: 'p1_mordred_saber',
        actorName: 'Mordred',
        targetId: 'p2_sasaki_assassin',
        targetName: 'Sasaki Kojiro',
        actionSummary: '⚔️ Mordred triggered Prana Burst A and unleashed violent red lightning in a Buster Chain for 11,200 DMG!',
        cardChainType: 'Buster Brave',
        cardsUsed: ['Buster', 'Buster', 'Buster'],
        skillsUsed: ['Prana Burst A'],
        damageDealt: 11200,
        isCritical: true,
        starsGenerated: 10,
        npCharged: 20,
        actorHpRemaining: 29000,
        targetHpRemaining: 11800,
        actorHpMax: 29000,
        targetHpMax: 23000,
        actorNp: 40,
        targetNp: 30
      },
      {
        turnNumber: 1,
        actorId: 'p2_sasaki_assassin',
        actorName: 'Sasaki Kojiro',
        targetId: 'p1_mordred_saber',
        targetName: 'Mordred',
        actionSummary: '⚔️ Sasaki Kojiro activated Eye of the Mind (False) and slashed with graceful nodachi cuts for 7,100 DMG.',
        cardChainType: 'Quick Chain',
        cardsUsed: ['Quick', 'Quick', 'Quick'],
        skillsUsed: ['Eye of the Mind (False) A'],
        damageDealt: 7100,
        isCritical: true,
        starsGenerated: 28,
        npCharged: 35,
        actorHpRemaining: 11800,
        targetHpRemaining: 21900,
        actorHpMax: 23000,
        targetHpMax: 29000,
        actorNp: 65,
        targetNp: 40
      },
      {
        turnNumber: 2,
        actorId: 'p1_mordred_saber',
        actorName: 'Mordred',
        targetId: 'p2_sasaki_assassin',
        targetName: 'Sasaki Kojiro',
        actionSummary: '💥 NOBLE PHANTASM UNLEASHED! Mordred channeled Secret of Pedigree and detonated the blood sword Clarent Blood Arthur for 17,000 crimson DMG!',
        cardChainType: 'Buster Brave',
        cardsUsed: ['NP', 'Buster', 'Arts'],
        skillsUsed: ['Secret of Pedigree EX'],
        npTriggered: true,
        isNoblePhantasm: true,
        npChant: 'This is the sword that felled my father... CLARENT BLOOD ARTHUR!',
        damageDealt: 17000,
        isCritical: true,
        starsGenerated: 24,
        npCharged: 15,
        actorHpRemaining: 21900,
        targetHpRemaining: 0,
        actorHpMax: 29000,
        targetHpMax: 23000,
        actorNp: 15,
        targetNp: 65
      }
    ]
  },
  {
    id: 'battle_clash_006_scathach',
    timestamp: Date.now() - 1000 * 60 * 360, // 6 hours ago
    outcome: 'defeat',
    totalTurns: 3,
    player1: {
      id: 'p1_diarmuid_lancer',
      name: 'Diarmuid Ua Duibhne',
      servantClass: 'Lancer',
      masterName: 'Chaldea Master',
      noblePhantasmName: 'Gáe Buidhe: Golden Rose of Mortality',
      finalHp: 0,
      maxHp: 26000,
      atk: 11200,
      def: 8900
    },
    player2: {
      id: 'p2_scathach_lancer',
      name: 'Scáthach',
      servantClass: 'Lancer',
      masterName: 'Lord El-Melloi II',
      noblePhantasmName: 'Gáe Bolg Alternative: Piercing Death Thorn',
      finalHp: 14200,
      maxHp: 31000,
      atk: 14500,
      def: 10500
    },
    totalDamageDealt: 16800,
    totalDamageTaken: 28500,
    noblePhantasmsUsed: 0,
    criticalHitsLanded: 1,
    turns: [
      {
        turnNumber: 1,
        actorId: 'p1_diarmuid_lancer',
        actorName: 'Diarmuid Ua Duibhne',
        targetId: 'p2_scathach_lancer',
        targetName: 'Scáthach',
        actionSummary: '⚔️ Diarmuid activated Mind\'s Eye (True) and thrust twin spears for 8,500 DMG.',
        cardChainType: 'Quick Chain',
        cardsUsed: ['Quick', 'Quick', 'Buster'],
        skillsUsed: ['Mind\'s Eye (True) B'],
        damageDealt: 8500,
        isCritical: true,
        starsGenerated: 22,
        npCharged: 25,
        actorHpRemaining: 26000,
        targetHpRemaining: 22500,
        actorHpMax: 26000,
        targetHpMax: 31000,
        actorNp: 35,
        targetNp: 20
      },
      {
        turnNumber: 1,
        actorId: 'p2_scathach_lancer',
        actorName: 'Scáthach',
        targetId: 'p1_diarmuid_lancer',
        targetName: 'Diarmuid Ua Duibhne',
        actionSummary: '⚔️ Scáthach etched Primordial Runes and cleaved the shadow leylines for 9,800 DMG!',
        cardChainType: 'Buster Brave',
        cardsUsed: ['Buster', 'Quick', 'Quick'],
        skillsUsed: ['Primordial Rune'],
        damageDealt: 9800,
        isCritical: true,
        starsGenerated: 18,
        npCharged: 35,
        actorHpRemaining: 22500,
        targetHpRemaining: 16200,
        actorHpMax: 31000,
        targetHpMax: 26000,
        actorNp: 55,
        targetNp: 35
      },
      {
        turnNumber: 2,
        actorId: 'p1_diarmuid_lancer',
        actorName: 'Diarmuid Ua Duibhne',
        targetId: 'p2_scathach_lancer',
        targetName: 'Scáthach',
        actionSummary: '⚔️ Diarmuid slashed with Gáe Dearg to dispel runic barriers, dealing 8,300 DMG.',
        cardChainType: 'Arts Chain',
        cardsUsed: ['Arts', 'Arts', 'Quick'],
        skillsUsed: ['Love Spot C'],
        damageDealt: 8300,
        isCritical: false,
        starsGenerated: 14,
        npCharged: 40,
        actorHpRemaining: 16200,
        targetHpRemaining: 14200,
        actorHpMax: 26000,
        targetHpMax: 31000,
        actorNp: 75,
        targetNp: 55
      },
      {
        turnNumber: 2,
        actorId: 'p2_scathach_lancer',
        actorName: 'Scáthach',
        targetId: 'p1_diarmuid_lancer',
        targetName: 'Diarmuid Ua Duibhne',
        actionSummary: '⚔️ Scáthach activated God Slayer B and barraged with supernatural spear arts for 8,500 DMG.',
        cardChainType: 'Normal',
        cardsUsed: ['Quick', 'Arts', 'Buster'],
        skillsUsed: ['God Slayer B'],
        damageDealt: 8500,
        isCritical: false,
        starsGenerated: 19,
        npCharged: 45,
        actorHpRemaining: 14200,
        targetHpRemaining: 7700,
        actorHpMax: 31000,
        targetHpMax: 26000,
        actorNp: 100,
        targetNp: 75
      },
      {
        turnNumber: 3,
        actorId: 'p2_scathach_lancer',
        actorName: 'Scáthach',
        targetId: 'p1_diarmuid_lancer',
        targetName: 'Diarmuid Ua Duibhne',
        actionSummary: '💥 NOBLE PHANTASM UNLEASHED! Scáthach opened the Gate of Skye and hurled the twin red spears Gáe Bolg Alternative for 10,200 fatal DMG!',
        cardChainType: 'Quick Chain',
        cardsUsed: ['NP', 'Quick', 'Quick'],
        skillsUsed: ['Wisdom of Dún Scáith A+'],
        npTriggered: true,
        isNoblePhantasm: true,
        npChant: 'Open, Land of Shadows! Gáe Bolg Alternative!',
        damageDealt: 10200,
        isCritical: true,
        starsGenerated: 30,
        npCharged: 0,
        actorHpRemaining: 14200,
        targetHpRemaining: 0,
        actorHpMax: 31000,
        targetHpMax: 26000,
        actorNp: 0,
        targetNp: 75
      }
    ]
  }
];

export function loadCombatBattleHistory(): CombatBattleRecord[] {
  if (typeof window === 'undefined') {
    return INITIAL_SEED_BATTLES;
  }

  try {
    const raw = localStorage.getItem(COMBAT_HISTORY_STORAGE_KEY);
    if (!raw) {
      // First visit: save initial seeds
      localStorage.setItem(COMBAT_HISTORY_STORAGE_KEY, JSON.stringify(INITIAL_SEED_BATTLES));
      return INITIAL_SEED_BATTLES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, MAX_STORED_BATTLES);
    }
    return INITIAL_SEED_BATTLES;
  } catch (err) {
    console.error('Failed to load combat battle history from localStorage:', err);
    return INITIAL_SEED_BATTLES;
  }
}

export function saveCombatBattleRecord(record: CombatBattleRecord): CombatBattleRecord[] {
  const current = loadCombatBattleHistory();
  // Filter out any duplicate id
  const filtered = current.filter(b => b.id !== record.id);
  const updated = [record, ...filtered].slice(0, MAX_STORED_BATTLES);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(COMBAT_HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save combat battle history to localStorage:', err);
    }
  }

  return updated;
}

export function createRecordFromFinishedBattle(
  battle: BattleState,
  outcome: 'victory' | 'defeat' | 'fled' | 'evacuated'
): CombatBattleRecord {
  const p1 = battle.player1;
  const p2 = battle.player2;

  let totalDmgDealt = 0;
  let totalDmgTaken = 0;
  let npUsedP1 = 0;
  let critsP1 = 0;

  for (const log of battle.turnHistory) {
    if (log.actorId === p1.id) {
      totalDmgDealt += log.damageDealt || 0;
      if (log.npTriggered || log.isNoblePhantasm) npUsedP1 += 1;
      if (log.isCritical) critsP1 += 1;
    } else if (log.targetId === p1.id) {
      totalDmgTaken += log.damageDealt || 0;
    }
  }

  return {
    id: `battle_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    outcome,
    totalTurns: battle.currentTurn,
    player1: {
      id: p1.id,
      name: p1.name,
      servantClass: p1.servantClass,
      masterName: p1.masterName,
      avatarUrl: p1.avatarUrl,
      noblePhantasmName: p1.noblePhantasm.name,
      finalHp: Math.max(0, p1.currentHp),
      maxHp: p1.maxHp,
      atk: p1.atk,
      def: p1.def
    },
    player2: {
      id: p2.id,
      name: p2.name,
      servantClass: p2.servantClass,
      masterName: p2.masterName,
      avatarUrl: p2.avatarUrl,
      noblePhantasmName: p2.noblePhantasm.name,
      finalHp: Math.max(0, p2.currentHp),
      maxHp: p2.maxHp,
      atk: p2.atk,
      def: p2.def
    },
    totalDamageDealt: totalDmgDealt,
    totalDamageTaken: totalDmgTaken,
    noblePhantasmsUsed: npUsedP1,
    criticalHitsLanded: critsP1,
    turns: [...battle.turnHistory]
  };
}

export function clearCombatBattleHistory(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(COMBAT_HISTORY_STORAGE_KEY);
    } catch (err) {
      console.error('Failed to clear combat battle history:', err);
    }
  }
}

export function resetSeedCombatBattleHistory(): CombatBattleRecord[] {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(COMBAT_HISTORY_STORAGE_KEY, JSON.stringify(INITIAL_SEED_BATTLES));
    } catch (err) {
      console.error('Failed to reset seed combat battle history:', err);
    }
  }
  return INITIAL_SEED_BATTLES;
}
