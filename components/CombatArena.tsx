'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ActiveCombatant,
  BattleState,
  CardType,
  CombatBattleRecord,
  CombatTurnLog,
  MasterProfile,
  MasterServantInstance
} from '../lib/types';
import {
  createCombatantFromMasterServant,
  initializeBattle,
  executeBattleTurn,
  calculateClassMultiplier,
  calculateFleeChance,
  rollFleeSuccess
} from '../lib/engine/battle';
import {
  loadCombatBattleHistory,
  saveCombatBattleRecord,
  createRecordFromFinishedBattle,
  clearCombatBattleHistory,
  resetSeedCombatBattleHistory
} from '../lib/engine/combatHistory';
import CombatLogHistory from './CombatLogHistory';
import { SERVANT_DATABASE } from '../lib/data/servants';
import { getServantChainDialogue } from '@/src/engine/dialogue';
import {
  Swords,
  Shield,
  Zap,
  Flame,
  Sparkles,
  RotateCcw,
  Skull,
  Award,
  ChevronRight,
  BookOpen,
  Footprints,
  Wind,
  ShieldAlert,
  Clock,
  Timer
} from 'lucide-react';

interface CombatArenaProps {
  master: MasterProfile;
  onUpdateMaster: (master: MasterProfile) => void;
}

interface BattleDialogueCutIn {
  speakerName: string;
  speakerTitle: string;
  avatarUrl?: string;
  servantClass: string;
  rarity?: number;
  tag: string;
  dialogueText: string;
  badgeType: 'np' | 'skill' | 'advantage' | 'low_hp' | 'crit' | 'attack';
  isPlayerMove: boolean;
}

export default function CombatArena({ master, onUpdateMaster }: CombatArenaProps) {
  const activeServant = master.servants.find(s => s.id === master.activeServantId) || master.servants[0];

  // Enemy selection
  const [selectedEnemyId, setSelectedEnemyId] = useState<string>('gilgamesh_archer');
  const enemyTemplate = SERVANT_DATABASE.find(s => s.id === selectedEnemyId) || SERVANT_DATABASE[1];

  const setupNewBattle = (opponentTemplate = enemyTemplate) => {
    if (!activeServant) return null;
    const p1 = createCombatantFromMasterServant(activeServant, master.username);
    const p2 = createCombatantFromMasterServant(
      {
        id: 'cpu_servant',
        masterId: 'cpu_master',
        templateId: opponentTemplate.id,
        level: 30,
        experience: 0,
        allocatedStats: { strength: 4, endurance: 3, agility: 3, mana: 4, luck: 2 },
        availableStatPoints: 0,
        skillLevels: [5, 5, 5],
        customQuotes: {
          summon: opponentTemplate.summonQuote,
          battleStart: opponentTemplate.battleStartQuote,
          noblePhantasm: opponentTemplate.noblePhantasm.chant,
          victory: opponentTemplate.victoryQuote,
          defeat: opponentTemplate.defeatQuote
        },
        bondLevel: 5,
        template: opponentTemplate
      },
      'Rival Master Kotomine'
    );
    return initializeBattle(p1, p2);
  };

  const [battle, setBattle] = useState<BattleState | null>(() => setupNewBattle());
  const [selectedCards, setSelectedCards] = useState<CardType[]>([]);
  const [useNp, setUseNp] = useState(false);
  const [selectedSkillIdx, setSelectedSkillIdx] = useState<number | undefined>();
  const [selectedCommandSeal, setSelectedCommandSeal] = useState<'heal' | 'np_charge' | undefined>();
  const [isSimulating, setIsSimulating] = useState(false);
  const [showEvacuatePrompt, setShowEvacuatePrompt] = useState(false);
  const [evacuateCountdown, setEvacuateCountdown] = useState(60);
  const [evacuateExpired, setEvacuateExpired] = useState(false);
  const [autoConsumeCommandSeal, setAutoConsumeCommandSeal] = useState(false); // OFF by default
  const [fleeStatusMessage, setFleeStatusMessage] = useState<string | null>(null);

  // Mid-Battle Dialogue Embed State
  const [dialogueCutIn, setDialogueCutIn] = useState<BattleDialogueCutIn | null>(null);
  const [showDialogueMode, setShowDialogueMode] = useState(false);
  const [cutInCountdown, setCutInCountdown] = useState(3.0);

  // Trigger Battle Start Dialogue Cut-In on Initial Engagement
  useEffect(() => {
    if (activeServant && battle && battle.currentTurn === 1 && battle.turnPhase === 'card_selection') {
      const activeTemplate = activeServant.template;
      const servantName = activeServant.nickname || activeTemplate.name;
      const servantClass = activeTemplate.servantClass;
      const quote = activeServant.customQuotes?.battleStart || activeTemplate.battleStartQuote || "My blade is drawn. Let the battle commence!";

      const timer = setTimeout(() => {
        setDialogueCutIn({
          speakerName: servantName,
          speakerTitle: `${servantClass} • Battle Engagement`,
          avatarUrl: activeTemplate.cardArtUrl || activeTemplate.avatarUrl,
          servantClass,
          rarity: activeTemplate.rarity || 5,
          tag: 'BATTLE ENGAGEMENT',
          dialogueText: quote,
          badgeType: 'attack',
          isPlayerMove: true
        });
        setShowDialogueMode(true);
        setCutInCountdown(3.0);
      }, 50);

      let remaining = 3.0;
      const interval = setInterval(() => {
        remaining -= 0.5;
        if (remaining <= 0) {
          clearInterval(interval);
          setShowDialogueMode(false);
        } else {
          setCutInCountdown(Math.round(remaining * 10) / 10);
        }
      }, 500);

      return () => {
        clearTimeout(timer);
        clearInterval(interval);
      };
    }
  }, [battle?.currentTurn, activeServant?.id]);

  // Combat Log History state (Last 10 battles)
  const [arenaTab, setArenaTab] = useState<'duel' | 'history'>('duel');
  const [battleHistory, setBattleHistory] = useState<CombatBattleRecord[]>(() => loadCombatBattleHistory());
  const [lastCompletedBattleId, setLastCompletedBattleId] = useState<string | undefined>();

  // 1-minute (60-second) decision time limit for Emergency Command Seal evacuation
  useEffect(() => {
    if (!showEvacuatePrompt || battle?.turnPhase !== 'defeat') {
      return;
    }

    const interval = setInterval(() => {
      setEvacuateCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimeout(() => {
            setEvacuateExpired(true);
            setShowEvacuatePrompt(false);
            if (battle) {
              const record = createRecordFromFinishedBattle(battle, 'defeat');
              const updatedHistory = saveCombatBattleRecord(record);
              setBattleHistory(updatedHistory);
              setLastCompletedBattleId(record.id);
            }
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showEvacuatePrompt, battle?.turnPhase, battle]);

  if (!activeServant || !battle) {
    return (
      <div className="p-8 text-center bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] text-[#e5e5e5]">
        <Swords className="w-12 h-12 text-[#d4af37] mx-auto mb-3 opacity-80" />
        <h3 className="text-xl font-serif italic text-white mb-2">No Active Servant</h3>
        <p className="text-xs text-white/40 font-mono">Summon a Servant first from the Gacha portal to enter combat!</p>
      </div>
    );
  }

  const p1 = battle.player1;
  const p2 = battle.player2;
  const classMultiplier = calculateClassMultiplier(p1.servantClass, p2.servantClass);

  const handleCardClick = (card: CardType) => {
    if (selectedCards.length < 3) {
      setSelectedCards(prev => [...prev, card]);
    }
  };

  const handleClearCards = () => {
    setSelectedCards([]);
  };

  const handleQuickPreset = (preset: 'Buster Brave' | 'Arts Chain' | 'Quick Chain') => {
    if (preset === 'Buster Brave') setSelectedCards(['Buster', 'Buster', 'Buster']);
    if (preset === 'Arts Chain') setSelectedCards(['Arts', 'Arts', 'Arts']);
    if (preset === 'Quick Chain') setSelectedCards(['Quick', 'Quick', 'Quick']);
  };

  const getBattleDialogueForTurn = (): BattleDialogueCutIn => {
    const p1HpRatio = p1.currentHp / p1.maxHp;
    const isLowHp = p1HpRatio <= 0.35;
    const servantName = p1.name;
    const servantClass = p1.servantClass;
    const activeTemplate = activeServant?.template;
    const customQuotes = activeServant?.customQuotes;

    if (useNp && p1.npGauge >= 100) {
      return {
        speakerName: servantName,
        speakerTitle: `${servantClass} • ${p1.noblePhantasm.name}`,
        avatarUrl: p1.avatarUrl || activeTemplate?.avatarUrl,
        servantClass,
        rarity: activeTemplate?.rarity || 5,
        tag: 'NOBLE PHANTASM CHANT',
        dialogueText: customQuotes?.noblePhantasm || p1.noblePhantasm.chant || `Sword of Promised Victory... EXCALIBUR!`,
        badgeType: 'np',
        isPlayerMove: true
      };
    }

    if (selectedCommandSeal) {
      return {
        speakerName: master.username || 'Master',
        speakerTitle: `Master Command Seal Amplification`,
        avatarUrl: master.avatarUrl || p1.avatarUrl,
        servantClass,
        rarity: 5,
        tag: 'COMMAND SEAL ACTIVATED',
        dialogueText: `By my Command Seal! ${servantName}, refill your Noble Phantasm and shatter enemy lines!`,
        badgeType: 'skill',
        isPlayerMove: true
      };
    }

    if (selectedSkillIdx !== undefined && p1.skills[selectedSkillIdx]) {
      const sk = p1.skills[selectedSkillIdx];
      return {
        speakerName: servantName,
        speakerTitle: `${servantClass} • Skill: ${sk.name}`,
        avatarUrl: p1.avatarUrl || activeTemplate?.avatarUrl,
        servantClass,
        rarity: activeTemplate?.rarity || 5,
        tag: 'SKILL RELEASE',
        dialogueText: `Activating ${sk.name}! ${sk.description}`,
        badgeType: 'skill',
        isPlayerMove: true
      };
    }

    if (selectedCards.length === 3) {
      const isAllBuster = selectedCards.every(c => c === 'Buster');
      const isAllArts = selectedCards.every(c => c === 'Arts');
      const isAllQuick = selectedCards.every(c => c === 'Quick');

      const chainType = isAllBuster
        ? 'Buster Brave Chain'
        : isAllArts
        ? 'Arts Chain'
        : isAllQuick
        ? 'Quick Chain'
        : 'Command Card Combo';

      const dialogueResult = getServantChainDialogue(
        servantName,
        servantClass,
        selectedCards as any,
        customQuotes,
        p1.currentHp,
        p1.maxHp,
        battle.currentTurn
      );

      return {
        speakerName: servantName,
        speakerTitle: `${servantClass} • ${chainType} (${selectedCards.join(' → ')})`,
        avatarUrl: p1.avatarUrl || activeTemplate?.avatarUrl,
        servantClass,
        rarity: activeTemplate?.rarity || 5,
        tag: dialogueResult.tag,
        dialogueText: dialogueResult.quote,
        badgeType: isAllBuster ? 'crit' : 'attack',
        isPlayerMove: true
      };
    }

    if (isLowHp) {
      const lowHpQuotes = [
        "I won't fall here... Master, give me strength!",
        "My Spirit Origin remains unyielding! Final strike!",
        "This pain is nothing... I shall fulfill our pact!"
      ];
      const q = lowHpQuotes[Math.floor(Math.random() * lowHpQuotes.length)];
      return {
        speakerName: servantName,
        speakerTitle: `${servantClass} • Desperation Strike`,
        avatarUrl: p1.avatarUrl || activeTemplate?.avatarUrl,
        servantClass,
        rarity: activeTemplate?.rarity || 5,
        tag: 'DESPERATION',
        dialogueText: q,
        badgeType: 'low_hp',
        isPlayerMove: true
      };
    }

    if (classMultiplier > 1.0) {
      const advQuotes = [
        "Your class stands no chance against my blade!",
        "I hold the class affinity edge in this clash, prepare yourself!",
        "A foolish match-up for you... I will take victory in one strike!"
      ];
      const q = advQuotes[Math.floor(Math.random() * advQuotes.length)];
      return {
        speakerName: servantName,
        speakerTitle: `${servantClass} (1.5x Advantage vs ${p2.servantClass})`,
        avatarUrl: p1.avatarUrl || activeTemplate?.avatarUrl,
        servantClass,
        rarity: activeTemplate?.rarity || 5,
        tag: 'CLASS ADVANTAGE',
        dialogueText: q,
        badgeType: 'advantage',
        isPlayerMove: true
      };
    }

    return {
      speakerName: servantName,
      speakerTitle: `${servantClass} • Battle Engagement`,
      avatarUrl: p1.avatarUrl || activeTemplate?.avatarUrl,
      servantClass,
      rarity: activeTemplate?.rarity || 5,
      tag: 'BATTLE QUOTE',
      dialogueText: customQuotes?.battleStart || activeTemplate?.battleStartQuote || "Engaging opponent in combat!",
      badgeType: 'attack',
      isPlayerMove: true
    };
  };

  const handleExecuteTurn = () => {
    if (selectedCards.length < 3 && !useNp) return;

    const dialogue = getBattleDialogueForTurn();

    // Check if this attack sequence warrants a special Visual Novel Dialogue Cut-In:
    // Only trigger for Pure Brave Chains (BBB, AAA, QQQ) or NP!
    // Desperation states do NOT trigger dialogue cut-ins. Ordinary mixed combat chains proceed directly without pausing!
    const isPureBrave = selectedCards.length === 3 && (
      selectedCards.every(c => c === 'Buster') ||
      selectedCards.every(c => c === 'Arts') ||
      selectedCards.every(c => c === 'Quick')
    );
    const shouldCutIn = useNp || isPureBrave;

    if (!shouldCutIn) {
      runTurnCalculation();
      return;
    }

    // Display Mid-Battle Dialogue Cut-In Box for 3.0 seconds before dealing damage
    setDialogueCutIn(dialogue);
    setShowDialogueMode(true);
    setIsSimulating(true);
    setCutInCountdown(3.0);

    let remaining = 3.0;
    const interval = setInterval(() => {
      remaining -= 0.5;
      if (remaining <= 0) {
        clearInterval(interval);
        setShowDialogueMode(false);
        runTurnCalculation();
      } else {
        setCutInCountdown(Math.round(remaining * 10) / 10);
      }
    }, 500);
  };

  const runTurnCalculation = () => {
    // AI enemy card decision
    const aiDeck = p2.commandDeck;
    const shuffled = [...aiDeck].sort(() => 0.5 - Math.random());
    const aiCards = (shuffled.slice(0, 3) as CardType[]) || ['Buster', 'Arts', 'Quick'];
    const aiUseNp = p2.npGauge >= 100 && Math.random() > 0.3;

    const { updatedState } = executeBattleTurn(
      battle,
      {
        combatantId: p1.id,
        selectedCards: selectedCards.length === 3 ? selectedCards : ['Buster', 'Arts', 'Quick'],
        useNoblePhantasm: useNp,
        useSkillIndex: selectedSkillIdx,
        useCommandSeal: selectedCommandSeal
      },
      {
        combatantId: p2.id,
        selectedCards: aiCards,
        useNoblePhantasm: aiUseNp
      }
    );

    if (selectedCommandSeal) {
      onUpdateMaster({
        ...master,
        commandSeals: Math.max(0, (master.commandSeals ?? 3) - 1)
      });
    }

    setBattle(updatedState);
    setSelectedCards([]);
    setUseNp(false);
    setSelectedSkillIdx(undefined);
    setSelectedCommandSeal(undefined);
    setIsSimulating(false);

    if (updatedState.turnPhase === 'victory') {
      onUpdateMaster({
        ...master,
        saintQuartz: master.saintQuartz + 3,
        grailWarWins: master.grailWarWins + 1
      });
      const record = createRecordFromFinishedBattle(updatedState, 'victory');
      const updatedHistory = saveCombatBattleRecord(record);
      setBattleHistory(updatedHistory);
      setLastCompletedBattleId(record.id);
    } else if (updatedState.turnPhase === 'defeat') {
      if ((master.commandSeals ?? 3) >= 1) {
        if (autoConsumeCommandSeal) {
          onUpdateMaster({
            ...master,
            commandSeals: Math.max(0, (master.commandSeals ?? 3) - 1)
          });
          const evacuatedCombatant = {
            ...updatedState.player1,
            currentHp: 1
          };
          const evacLog: CombatTurnLog = {
            turnNumber: updatedState.currentTurn,
            actorId: updatedState.player1.id,
            actorName: master.username || 'Master',
            targetId: updatedState.player2.id,
            targetName: updatedState.player2.name,
            actionSummary: `🔮 **AUTO COMMAND SEAL EVACUATION!** Master had auto-consume enabled. 1 Command Seal expended to preserve Servant at 1 HP! (${Math.max(0, (master.commandSeals ?? 3) - 1)}/3 Seals Remaining)`,
            cardsUsed: [],
            skillsUsed: [],
            damageDealt: 0,
            isCritical: false,
            starsGenerated: 0,
            npCharged: 0,
            actorHpRemaining: 1,
            targetHpRemaining: updatedState.player2.currentHp,
            actorHpMax: updatedState.player1.maxHp,
            targetHpMax: updatedState.player2.maxHp,
            actorNp: updatedState.player1.npGauge,
            targetNp: updatedState.player2.npGauge,
            dialogueTag: 'COMMAND SEAL EVACUATION',
            dialogueTitle: 'Emergency Spatial Extraction',
            dialogueQuote: `By my Command Seal! Spatial evacuation initiate! Fall back to safety!`
          };
          setBattle({
            ...updatedState,
            player1: evacuatedCombatant,
            turnPhase: 'evacuated',
            turnHistory: [...updatedState.turnHistory, evacLog]
          });
        } else {
          // Off by default: show 1-minute evacuation prompt
          setShowEvacuatePrompt(true);
          setEvacuateCountdown(60);
          setEvacuateExpired(false);
        }
      } else {
        const record = createRecordFromFinishedBattle(updatedState, 'defeat');
        const updatedHistory = saveCombatBattleRecord(record);
        setBattleHistory(updatedHistory);
        setLastCompletedBattleId(record.id);
      }
    }
  };

  const handleAttemptFlee = () => {
    if (!battle || isSimulating) return;
    if (battle.turnPhase === 'victory' || battle.turnPhase === 'defeat' || battle.turnPhase === 'fled' || battle.turnPhase === 'evacuated') return;

    const { chancePercent, isAgilityBonus } = calculateFleeChance(
      battle.player1.currentHp,
      battle.player1.maxHp,
      battle.player1.servantClass,
      battle.player1.stats?.agility || 10
    );

    const success = rollFleeSuccess(chancePercent);

    if (success) {
      // Escape Succeeded!
      const fleeLog: CombatTurnLog = {
        turnNumber: battle.currentTurn,
        actorId: battle.player1.id,
        actorName: battle.player1.name,
        targetId: battle.player2.id,
        targetName: battle.player2.name,
        actionSummary: `🏃💨 **TACTICAL RETREAT SUCCESSFUL!** ${battle.player1.name} broke away from combat (${chancePercent}% chance${isAgilityBonus ? ' with +5% Agility Servant bonus' : ''}) and safely disengaged from the battlefield!`,
        cardsUsed: [],
        skillsUsed: [],
        damageDealt: 0,
        isCritical: false,
        starsGenerated: 0,
        npCharged: 0,
        actorHpRemaining: battle.player1.currentHp,
        targetHpRemaining: battle.player2.currentHp,
        actorHpMax: battle.player1.maxHp,
        targetHpMax: battle.player2.maxHp,
        actorNp: battle.player1.npGauge,
        targetNp: battle.player2.npGauge,
        dialogueTag: 'TACTICAL RETREAT',
        dialogueTitle: `${battle.player1.servantClass} • Tactical Disengagement`,
        dialogueQuote: 'A strategic retreat today ensures victory tomorrow, Master. Returning to safety!'
      };

      const updatedState: BattleState = {
        ...battle,
        turnPhase: 'fled',
        turnHistory: [...battle.turnHistory, fleeLog]
      };

      setBattle(updatedState);
      setFleeStatusMessage(`Tactical retreat successful! Escaped with ${chancePercent}% chance.`);

      const record = createRecordFromFinishedBattle(updatedState, 'fled');
      const updatedHistory = saveCombatBattleRecord(record);
      setBattleHistory(updatedHistory);
      setLastCompletedBattleId(record.id);
    } else {
      // Escape Failed! Turn consumed and enemy strikes unguarded target!
      const aiDeck = battle.player2.commandDeck;
      // Flee failed: Opponent lands an immediate 2,000 HP counter-strike
      const counterDmg = 2000;
      const newPlayer1Hp = Math.max(0, battle.player1.currentHp - counterDmg);
      const isDefeated = newPlayer1Hp <= 0;

      const failLog: CombatTurnLog = {
        turnNumber: battle.currentTurn,
        actorId: battle.player2.id,
        actorName: battle.player2.name,
        targetId: battle.player1.id,
        targetName: battle.player1.name,
        actionSummary: `❌ **TACTICAL RETREAT FAILED!** (${chancePercent}% chance rolled). ${battle.player1.name} could not break line of sight and took a **2,000 DMG** counter-strike from ${battle.player2.name}!`,
        cardsUsed: ['Buster'],
        skillsUsed: [],
        damageDealt: counterDmg,
        isCritical: false,
        starsGenerated: 0,
        npCharged: 0,
        actorHpRemaining: battle.player2.currentHp,
        targetHpRemaining: newPlayer1Hp,
        actorHpMax: battle.player2.maxHp,
        targetHpMax: battle.player1.maxHp,
        actorNp: battle.player2.npGauge,
        targetNp: battle.player1.npGauge
      };

      const finalState: BattleState = {
        ...battle,
        currentTurn: battle.currentTurn + 1,
        player1: {
          ...battle.player1,
          currentHp: newPlayer1Hp
        },
        turnPhase: isDefeated ? 'defeat' : 'card_selection',
        turnHistory: [...battle.turnHistory, failLog]
      };

      setBattle(finalState);
      setFleeStatusMessage(`Tactical retreat failed (${chancePercent}% chance). Took 2,000 DMG counter-strike!`);

      if (finalState.player1.currentHp <= 0) {
        if ((master.commandSeals ?? 3) >= 1) {
          if (autoConsumeCommandSeal) {
            onUpdateMaster({
              ...master,
              commandSeals: Math.max(0, (master.commandSeals ?? 3) - 1)
            });
            const evacuatedCombatant = {
              ...finalState.player1,
              currentHp: 1
            };
            const evacLog: CombatTurnLog = {
              turnNumber: finalState.currentTurn,
              actorId: finalState.player1.id,
              actorName: master.username || 'Master',
              targetId: finalState.player2.id,
              targetName: finalState.player2.name,
              actionSummary: `🔮 **AUTO COMMAND SEAL EVACUATION!** Master had auto-consume enabled. 1 Command Seal expended after fatal counter-strike to preserve Servant at 1 HP! (${Math.max(0, (master.commandSeals ?? 3) - 1)}/3 Seals Remaining)`,
              cardsUsed: [],
              skillsUsed: [],
              damageDealt: 0,
              isCritical: false,
              starsGenerated: 0,
              npCharged: 0,
              actorHpRemaining: 1,
              targetHpRemaining: finalState.player2.currentHp,
              actorHpMax: finalState.player1.maxHp,
              targetHpMax: finalState.player2.maxHp,
              actorNp: finalState.player1.npGauge,
              targetNp: finalState.player2.npGauge,
              dialogueTag: 'COMMAND SEAL EVACUATION',
              dialogueTitle: 'Emergency Spatial Extraction',
              dialogueQuote: `By my Command Seal! Spatial evacuation initiate! Fall back to safety!`
            };
            setBattle({
              ...finalState,
              player1: evacuatedCombatant,
              turnPhase: 'evacuated',
              turnHistory: [...finalState.turnHistory, evacLog]
            });
          } else {
            // Off by default: show 1-minute prompt
            setShowEvacuatePrompt(true);
            setEvacuateCountdown(60);
            setEvacuateExpired(false);
          }
        } else {
          const record = createRecordFromFinishedBattle(finalState, 'defeat');
          const updatedHistory = saveCombatBattleRecord(record);
          setBattleHistory(updatedHistory);
          setLastCompletedBattleId(record.id);
        }
      }
    }
  };

  const handleCommandSealEvacuate = () => {
    if (!battle || (master.commandSeals ?? 3) < 1) return;

    onUpdateMaster({
      ...master,
      commandSeals: Math.max(0, (master.commandSeals ?? 3) - 1)
    });

    const evacuatedCombatant = {
      ...battle.player1,
      currentHp: 1
    };

    const evacLog: CombatTurnLog = {
      turnNumber: battle.currentTurn,
      actorId: battle.player1.id,
      actorName: master.username || 'Master',
      targetId: battle.player2.id,
      targetName: battle.player2.name,
      actionSummary: `🔮 **COMMAND SEAL SPATIAL EVACUATION!** Master invoked 1 Command Seal to emergency-teleport ${battle.player1.name} away from mortal danger! Preserved at 1 HP. (${Math.max(0, (master.commandSeals ?? 3) - 1)}/3 Seals Remaining)`,
      cardsUsed: [],
      skillsUsed: [],
      damageDealt: 0,
      isCritical: false,
      starsGenerated: 0,
      npCharged: 0,
      actorHpRemaining: 1,
      targetHpRemaining: battle.player2.currentHp,
      actorHpMax: battle.player1.maxHp,
      targetHpMax: battle.player2.maxHp,
      actorNp: battle.player1.npGauge,
      targetNp: battle.player2.npGauge,
      dialogueTag: 'COMMAND SEAL EVACUATION',
      dialogueTitle: 'Emergency Spatial Extraction',
      dialogueQuote: `By my Command Seal! Spatial evacuation initiate! Fall back to safety!`
    };

    const updatedState: BattleState = {
      ...battle,
      player1: evacuatedCombatant,
      turnPhase: 'evacuated',
      turnHistory: [...battle.turnHistory, evacLog]
    };

    setBattle(updatedState);
    setShowEvacuatePrompt(false);
    setEvacuateCountdown(60);
    setEvacuateExpired(false);

    const record = createRecordFromFinishedBattle(updatedState, 'evacuated');
    const updatedHistory = saveCombatBattleRecord(record);
    setBattleHistory(updatedHistory);
    setLastCompletedBattleId(record.id);
  };

  const handleAcceptDefeat = () => {
    if (!battle) return;
    setShowEvacuatePrompt(false);
    setEvacuateCountdown(60);
    const record = createRecordFromFinishedBattle(battle, 'defeat');
    const updatedHistory = saveCombatBattleRecord(record);
    setBattleHistory(updatedHistory);
    setLastCompletedBattleId(record.id);
  };

  const handleRestart = () => {
    setBattle(setupNewBattle());
    setSelectedCards([]);
    setUseNp(false);
    setSelectedSkillIdx(undefined);
    setShowEvacuatePrompt(false);
    setEvacuateCountdown(60);
    setEvacuateExpired(false);
    setFleeStatusMessage(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Arena Navigation Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1a1a1a] pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setArenaTab('duel')}
            className={`px-4 py-2 rounded-sm text-xs font-mono uppercase tracking-wider flex items-center gap-2 transition ${
              arenaTab === 'duel'
                ? 'bg-[#d4af37] text-black font-bold shadow-[0_0_12px_rgba(212,175,55,0.2)]'
                : 'bg-[#111] text-white/60 hover:text-white border border-[#1a1a1a]'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            Live Arena Duel
          </button>
          <button
            onClick={() => setArenaTab('history')}
            className={`px-4 py-2 rounded-sm text-xs font-mono uppercase tracking-wider flex items-center gap-2 transition ${
              arenaTab === 'history'
                ? 'bg-[#d4af37] text-black font-bold shadow-[0_0_12px_rgba(212,175,55,0.2)]'
                : 'bg-[#111] text-white/60 hover:text-white border border-[#1a1a1a]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Combat Log History
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1 ${
                arenaTab === 'history' ? 'bg-black text-[#d4af37]' : 'bg-[#1a1a1a] text-[#d4af37]'
              }`}
            >
              {battleHistory.length}
            </span>
          </button>
        </div>

        {arenaTab === 'duel' && (
          <button
            onClick={() => setArenaTab('history')}
            className="text-[11px] font-mono text-white/50 hover:text-[#d4af37] flex items-center gap-1.5 transition"
          >
            <span>Review Last 10 Battles</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* When Combat Log History Tab is Active */}
      {arenaTab === 'history' ? (
        <CombatLogHistory
          history={battleHistory}
          initialSelectedBattleId={lastCompletedBattleId}
          activeServantName={activeServant.template.name}
          onSelectRematch={enemyTemplateId => {
            const opp = SERVANT_DATABASE.find(s => s.id === enemyTemplateId);
            if (opp) {
              setSelectedEnemyId(opp.id);
              setBattle(setupNewBattle(opp));
            } else {
              setBattle(setupNewBattle());
            }
            setSelectedCards([]);
            setUseNp(false);
            setSelectedSkillIdx(undefined);
            setArenaTab('duel');
          }}
          onClose={() => setArenaTab('duel')}
          onResetSeed={() => {
            const reset = resetSeedCombatBattleHistory();
            setBattleHistory(reset);
          }}
          onClearHistory={() => {
            clearCombatBattleHistory();
            setBattleHistory([]);
          }}
        />
      ) : (
        <>
          {/* Top Arena Header & Opponent Select */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#0a0a0a] rounded-xl border border-[#1a1a1a]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-sm bg-[#161616] text-[#d4af37] border border-[#d4af37]/30">
                <Swords className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-serif italic text-white tracking-wide">Fuyuki Combat Arena</h2>
                <p className="text-[11px] font-mono text-white/40 uppercase tracking-wider">
                  Turn {battle.currentTurn} • Tactical Card-Chain RPG
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-[11px] font-mono text-white/40 uppercase tracking-wider">Rival:</div>
              <select
                value={selectedEnemyId}
                onChange={e => {
                  setSelectedEnemyId(e.target.value);
                  const opp = SERVANT_DATABASE.find(s => s.id === e.target.value);
                  if (opp) setBattle(setupNewBattle(opp));
                }}
                className="bg-[#111] text-white text-xs px-3 py-1.5 rounded-sm border border-[#222] outline-none font-mono focus:border-[#d4af37]"
              >
                {SERVANT_DATABASE.filter(s => s.id !== activeServant.template.id).map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.servantClass} • {s.rarity}★)
                  </option>
                ))}
              </select>

              <button
                onClick={handleRestart}
                className="px-3 py-1.5 rounded-sm bg-transparent hover:bg-[#161616] text-white/70 hover:text-white text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 border border-white/20 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          </div>

      {/* Battle Stage Split Screen */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Player 1 Card */}
        <div className="p-6 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 px-3 py-1 bg-[#161616] text-[#d4af37] text-[10px] font-mono uppercase tracking-widest border-l border-b border-[#1a1a1a]">
            YOUR SERVANT • {p1.servantClass}
          </div>

          <div className="flex items-center gap-4 mb-5 mt-2">
            <div className="w-14 h-14 rounded-sm bg-[#161616] border border-[#d4af37]/40 flex items-center justify-center text-xl text-[#d4af37]">
              ⚔️
            </div>
            <div>
              <h3 className="text-lg font-serif italic text-white">{p1.name}</h3>
              <p className="text-xs text-white/40 font-mono">Master: {p1.masterName}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-[#111] text-[#3b82f6] border border-[#3b82f6]/30">
                  ATK: {p1.atk.toLocaleString()}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-[#111] text-[#22c55e] border border-[#22c55e]/30">
                  DEF: {p1.def.toLocaleString()}
                </span>
                {classMultiplier > 1 && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/40">
                    Advantage 1.5x
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* HP Bar */}
          <div className="space-y-1.5 mb-4">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-white/40 uppercase tracking-wider">HP</span>
              <span className="text-white font-bold">
                {p1.currentHp.toLocaleString()} / {p1.maxHp.toLocaleString()}
              </span>
            </div>
            <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  p1.currentHp / p1.maxHp > 0.3 ? 'bg-[#22c55e]' : 'bg-[#ef4444]'
                }`}
                style={{ width: `${Math.max(0, (p1.currentHp / p1.maxHp) * 100)}%` }}
              />
            </div>
          </div>

          {/* NP Gauge */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-[#d4af37] flex items-center gap-1 uppercase tracking-wider">
                <Sparkles className="w-3 h-3" /> NP Gauge
              </span>
              <span className="text-[#d4af37] font-bold">{Math.round(p1.npGauge)}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#d4af37] shadow-[0_0_8px_#d4af37] transition-all duration-300"
                style={{ width: `${Math.min(100, (p1.npGauge / 100) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Player 2 (Enemy) Card */}
        <div className="p-6 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 px-3 py-1 bg-[#161616] text-[#ef4444] text-[10px] font-mono uppercase tracking-widest border-l border-b border-[#1a1a1a]">
            OPPONENT • {p2.servantClass}
          </div>

          <div className="flex items-center gap-4 mb-5 mt-2">
            <div className="w-14 h-14 rounded-sm bg-[#161616] border border-[#ef4444]/40 flex items-center justify-center text-xl text-[#ef4444]">
              💀
            </div>
            <div>
              <h3 className="text-lg font-serif italic text-white">{p2.name}</h3>
              <p className="text-xs text-white/40 font-mono">Master: {p2.masterName}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-[#111] text-[#ef4444] border border-[#ef4444]/30">
                  ATK: {p2.atk.toLocaleString()}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-[#111] text-[#22c55e] border border-[#22c55e]/30">
                  DEF: {p2.def.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* HP Bar */}
          <div className="space-y-1.5 mb-4">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-white/40 uppercase tracking-wider">HP</span>
              <span className="text-white font-bold">
                {p2.currentHp.toLocaleString()} / {p2.maxHp.toLocaleString()}
              </span>
            </div>
            <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  p2.currentHp / p2.maxHp > 0.3 ? 'bg-[#22c55e]' : 'bg-[#ef4444]'
                }`}
                style={{ width: `${Math.max(0, (p2.currentHp / p2.maxHp) * 100)}%` }}
              />
            </div>
          </div>

          {/* NP Gauge */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-[#d4af37] flex items-center gap-1 uppercase tracking-wider">
                <Sparkles className="w-3 h-3" /> NP Gauge
              </span>
              <span className="text-[#d4af37] font-bold">{Math.round(p2.npGauge)}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#d4af37] shadow-[0_0_8px_#d4af37] transition-all duration-300"
                style={{ width: `${Math.min(100, (p2.npGauge / 100) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mid-Battle Dialogue Embed Box Cut-In (Reference Image Match) */}
      {showDialogueMode && dialogueCutIn && (
        <div className="p-1 rounded-2xl bg-gradient-to-br from-[#d4af37] via-[#b87928] to-[#6e4610] shadow-[0_0_35px_rgba(212,175,55,0.35)] animate-in fade-in zoom-in-95 duration-200 my-4">
          <div className="p-5 md:p-6 bg-[#140d0a] rounded-xl border-2 border-[#24150b] relative overflow-hidden">
            {/* 3.0s Animated Countdown Progress Bar */}
            <div className="w-full h-1.5 bg-[#0a0604] rounded-full overflow-hidden mb-4 border border-[#b87928]/30">
              <div
                className="h-full bg-gradient-to-r from-[#d4af37] via-[#f59e0b] to-[#e59a2d] transition-all duration-300 shadow-[0_0_12px_#d4af37]"
                style={{ width: `${(cutInCountdown / 3.0) * 100}%` }}
              />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-5">
              {/* Left Avatar Square Frame with Badge */}
              <div className="shrink-0 flex flex-col items-center">
                <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-lg bg-[#0c0806] border-2 border-[#d4af37] p-1 shadow-[0_0_18px_rgba(212,175,55,0.25)] flex items-center justify-center overflow-hidden">
                  {/* Top Badge/Rank Indicator */}
                  <div className="absolute top-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[#0e0a07] border border-[#d4af37] text-[10px] font-mono font-bold text-[#d4af37] rounded-sm shadow-md z-10 flex items-center gap-1">
                    <span>{dialogueCutIn.rarity || 5}★</span>
                  </div>

                  {/* Avatar Image / Fallback Icon */}
                  {dialogueCutIn.avatarUrl ? (
                    <img
                      src={dialogueCutIn.avatarUrl}
                      alt={dialogueCutIn.speakerName}
                      className="w-full h-full object-cover rounded-sm filter brightness-95 contrast-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#1c120c] flex items-center justify-center text-3xl text-[#d4af37]">
                      ⚔️
                    </div>
                  )}

                  {/* Dark Shadow Vignette Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
                </div>

                {/* Nameplate Tag Overlay */}
                <div className="-mt-3.5 z-20 px-3 py-1 bg-[#0f0a07] border-2 border-[#d4af37] text-xs font-mono font-bold text-[#d4af37] shadow-lg rounded-sm tracking-wider uppercase text-center max-w-[140px] truncate">
                  {dialogueCutIn.speakerName}
                </div>
              </div>

              {/* Right / Bottom Dialogue Text Box (Reference Photo Match) */}
              <div className="flex-1 flex flex-col justify-between space-y-3">
                {/* Header Row: Title & Scenario Tag */}
                <div className="flex items-center justify-between gap-2 border-b border-[#3d2613]/80 pb-2">
                  <span className="text-xs font-mono text-[#d4af37] uppercase tracking-wider font-semibold">
                    {dialogueCutIn.speakerTitle}
                  </span>
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-sm bg-[#24150b] text-[#f59e0b] border border-[#d4af37]/40 uppercase tracking-widest font-bold">
                    [{dialogueCutIn.tag}]
                  </span>
                </div>

                {/* Main Golden-Border Dialogue Container */}
                <div className="p-4 rounded-md bg-[#0a0604] border-2 border-[#a16823] shadow-inner text-left relative min-h-[90px] flex items-center">
                  <span className="absolute top-2 left-2 text-2xl font-serif text-[#d4af37]/20 select-none">“</span>
                  
                  <p className="font-serif italic text-sm md:text-base text-[#f5e6d3] leading-relaxed tracking-wide px-3">
                    &quot;{dialogueCutIn.dialogueText}&quot;
                  </p>

                  <span className="absolute bottom-2 right-2 text-2xl font-serif text-[#d4af37]/20 select-none">”</span>
                </div>

                {/* Countdown & Damage Preview Footer */}
                <div className="flex items-center justify-between text-[11px] font-mono text-white/50 pt-1">
                  <span className="flex items-center gap-1.5 text-[#d4af37]">
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing mid-battle dialogue chant...</span>
                  </span>
                  <span className="text-white/70 font-bold bg-[#1e130a] px-2.5 py-0.5 rounded-sm border border-[#3d2a19]">
                    Damage Dealt in {cutInCountdown}s
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Victory / Defeat / Retreat / Evacuate Overlay */}
      {(battle.turnPhase === 'victory' ||
        battle.turnPhase === 'defeat' ||
        battle.turnPhase === 'fled' ||
        battle.turnPhase === 'evacuated') && (
        <div
          className={`p-6 md:p-8 rounded-xl border text-center shadow-2xl ${
            battle.turnPhase === 'victory'
              ? 'bg-[#0a0a0a] border-[#d4af37]/50 text-[#e5e5e5]'
              : battle.turnPhase === 'fled'
              ? 'bg-[#0a0a0a] border-[#f59e0b]/50 text-[#e5e5e5]'
              : battle.turnPhase === 'evacuated'
              ? 'bg-[#0a0a0a] border-rose-500/50 text-[#e5e5e5]'
              : 'bg-[#0a0a0a] border-[#ef4444]/50 text-[#e5e5e5]'
          }`}
        >
          {/* Emergency Command Seal Evacuation Prompt (When Defeated & Seals Available) */}
          {showEvacuatePrompt && battle.turnPhase === 'defeat' && (
            <div className="mb-6 p-5 rounded-xl bg-gradient-to-r from-[#22070c] via-[#150508] to-[#22070c] border-2 border-rose-500/80 shadow-[0_0_35px_rgba(244,63,94,0.35)] animate-in fade-in zoom-in-95 duration-200">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 text-rose-400 font-mono text-xs uppercase tracking-widest font-bold">
                  <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />
                  <span>EMERGENCY COMMAND SEAL INTERVENTION</span>
                </div>
                {/* 1-Minute Decision Time Limit Badge */}
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono font-bold tracking-wider ${
                    evacuateCountdown <= 15
                      ? 'bg-red-950/90 border-red-500 text-red-300 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.6)]'
                      : 'bg-rose-950/70 border-rose-500/60 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                  }`}
                >
                  <Clock
                    className={`w-3.5 h-3.5 ${evacuateCountdown <= 15 ? 'text-red-400 animate-spin' : 'text-rose-400'}`}
                    style={{ animationDuration: evacuateCountdown <= 15 ? '1.5s' : '4s' }}
                  />
                  <span>
                    TIME LIMIT: {Math.floor(evacuateCountdown / 60)}:{String(evacuateCountdown % 60).padStart(2, '0')}
                  </span>
                </div>
              </div>

              <h4 className="text-xl font-serif italic text-white mb-2">
                Your Servant Has Suffered Lethal Damage!
              </h4>

              <p className="text-xs font-mono text-white/70 max-w-xl mx-auto mb-4 leading-relaxed">
                Before the spiritual contract dissolves, you may expend <strong className="text-rose-400">1 Command Seal</strong> to execute an emergency spatial extraction. {p1.name} will be teleported to safety at 1 HP, preventing tournament streak loss and contract severance!
              </p>

              {/* 1-Minute Visual Countdown Bar */}
              <div className="w-full max-w-md mx-auto mb-5 p-2.5 rounded-lg bg-black/40 border border-rose-950/60">
                <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
                  <span className="text-rose-300/80 flex items-center gap-1.5">
                    <Timer className="w-3.5 h-3.5 text-rose-400" />
                    Contract Dissolution Window
                  </span>
                  <span className={`font-bold ${evacuateCountdown <= 15 ? 'text-red-400 animate-pulse' : 'text-rose-300'}`}>
                    {evacuateCountdown}s remaining
                  </span>
                </div>
                <div className="h-1.5 w-full bg-black/80 rounded-full overflow-hidden border border-rose-900/40">
                  <div
                    className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                      evacuateCountdown <= 15
                        ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)]'
                        : 'bg-gradient-to-r from-rose-500 via-rose-400 to-amber-400'
                    }`}
                    style={{ width: `${(evacuateCountdown / 60) * 100}%` }}
                  />
                </div>
                <div className="text-[10px] font-mono text-white/40 text-center mt-1.5">
                  ⏱️ You have 1 minute to decide. If time expires, defeat is automatically accepted.
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  disabled={(master.commandSeals ?? 3) < 1}
                  onClick={handleCommandSealEvacuate}
                  className="px-6 py-3 rounded-sm bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider font-mono shadow-[0_0_20px_rgba(225,29,72,0.4)] flex items-center gap-2 transition active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Use Command Seal to Run ({(master.commandSeals ?? 3)}/3 Left)</span>
                </button>
                <button
                  onClick={handleAcceptDefeat}
                  className="px-5 py-3 rounded-sm bg-[#161616] hover:bg-[#222] text-white/70 hover:text-white font-mono text-xs uppercase tracking-wider border border-white/20 transition active:scale-95 cursor-pointer"
                >
                  Take Defeat ({evacuateCountdown}s)
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-rose-950/40 flex items-center justify-center">
                <label className="flex items-center gap-2 cursor-pointer text-[11px] font-mono text-white/60 hover:text-white transition select-none">
                  <input
                    type="checkbox"
                    checked={autoConsumeCommandSeal}
                    onChange={(e) => setAutoConsumeCommandSeal(e.target.checked)}
                    className="accent-rose-500 rounded cursor-pointer"
                  />
                  <span>Automatically consume Command Seal on defeat <span className="text-white/40 font-normal">(Off by default)</span></span>
                </label>
              </div>
            </div>
          )}

          <div className="inline-flex p-3.5 rounded-sm bg-[#161616] border border-white/10 mb-3">
            {battle.turnPhase === 'victory' ? (
              <Award className="w-8 h-8 text-[#d4af37]" />
            ) : battle.turnPhase === 'fled' ? (
              <Wind className="w-8 h-8 text-[#f59e0b]" />
            ) : battle.turnPhase === 'evacuated' ? (
              <Sparkles className="w-8 h-8 text-rose-400" />
            ) : (
              <Skull className="w-8 h-8 text-[#ef4444]" />
            )}
          </div>
          <h3 className="text-2xl font-serif italic text-white mb-2">
            {battle.turnPhase === 'victory'
              ? 'VICTORY ACHIEVED'
              : battle.turnPhase === 'fled'
              ? 'TACTICAL RETREAT SUCCESSFUL'
              : battle.turnPhase === 'evacuated'
              ? 'COMMAND SEAL SPATIAL EVACUATION'
              : 'DEFEAT'}
          </h3>
          <p className="text-xs font-mono text-white/60 max-w-md mx-auto mb-5">
            {battle.turnPhase === 'victory'
              ? `Your Servant ${p1.name} has claimed triumph. Rewards: +3 Saint Quartz & +1 Grail War Victory.`
              : battle.turnPhase === 'fled'
              ? `${p1.name} safely broke line of sight and disengaged from combat. No streak or penalty loss incurred.`
              : battle.turnPhase === 'evacuated'
              ? `Command Seal teleportation successful! ${p1.name} was pulled from mortal peril and survives at 1 HP.`
              : evacuateExpired
              ? `Decision window expired (1 minute limit reached). No Command Seal was invoked in time — contract dissolved.`
              : `${p2.name} overwhelmed your defense. Fortify your stats in the workshop and retry.`}
          </p>

          {/* Visual Novel Victory / Defeat / Retreat Dialogue Frame */}
          <div className="max-w-2xl mx-auto mb-6 p-1 rounded-2xl bg-gradient-to-br from-[#d4af37] via-[#b87928] to-[#6e4610] shadow-[0_0_35px_rgba(212,175,55,0.25)] text-left">
            <div className="p-5 md:p-6 bg-[#140d0a] rounded-xl border-2 border-[#24150b] relative overflow-hidden">
              <div className="flex flex-col sm:flex-row items-stretch gap-5">
                {/* Avatar portrait with 5★ badge */}
                <div className="shrink-0 flex flex-col items-center">
                  <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-lg bg-[#0c0806] border-2 border-[#d4af37] p-1 shadow-[0_0_18px_rgba(212,175,55,0.25)] flex items-center justify-center overflow-hidden">
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[#0e0a07] border border-[#d4af37] text-[10px] font-mono font-bold text-[#d4af37] rounded-sm shadow-md z-10 flex items-center gap-1">
                      <span>{activeServant.template.rarity || 5}★</span>
                    </div>
                    <img
                      src={activeServant.template.cardArtUrl || activeServant.template.avatarUrl}
                      alt={p1.name}
                      className="w-full h-full object-cover rounded-sm filter brightness-95 contrast-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
                  </div>
                  <div className="-mt-3.5 z-20 px-3 py-1 bg-[#0f0a07] border-2 border-[#d4af37] text-xs font-mono font-bold text-[#d4af37] shadow-lg rounded-sm tracking-wider uppercase text-center max-w-[140px] truncate">
                    {p1.name}
                  </div>
                </div>

                {/* Dialogue Speech Box */}
                <div className="flex-1 flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between gap-2 border-b border-[#3d2613]/80 pb-2">
                    <span className="text-xs font-mono text-[#d4af37] uppercase tracking-wider font-semibold">
                      {p1.servantClass} • {battle.turnPhase === 'victory' ? 'Triumph Achieved' : battle.turnPhase === 'fled' ? 'Tactical Disengagement' : battle.turnPhase === 'evacuated' ? 'Emergency Spatial Recall' : 'Contract Severed'}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2.5 py-0.5 rounded-sm uppercase tracking-widest font-bold border ${
                        battle.turnPhase === 'victory'
                          ? 'bg-[#24150b] text-[#f59e0b] border-[#d4af37]/40'
                          : battle.turnPhase === 'fled'
                          ? 'bg-[#261c0c] text-amber-300 border-amber-500/40'
                          : battle.turnPhase === 'evacuated'
                          ? 'bg-[#260c14] text-rose-300 border-rose-500/40'
                          : 'bg-[#2b0c0c] text-[#ef4444] border-[#ef4444]/40'
                      }`}
                    >
                      [{battle.turnPhase === 'victory'
                        ? 'VICTORY INVOCATION'
                        : battle.turnPhase === 'fled'
                        ? 'TACTICAL RETREAT'
                        : battle.turnPhase === 'evacuated'
                        ? 'SEAL EVACUATION'
                        : 'DEFEAT & RETREAT'}]
                    </span>
                  </div>

                  <div className="p-4 rounded-md bg-[#0a0604] border-2 border-[#a16823] shadow-inner text-left relative min-h-[80px] flex items-center">
                    <span className="absolute top-2 left-2 text-2xl font-serif text-[#d4af37]/20 select-none">“</span>
                    <p className="font-serif italic text-sm md:text-base text-[#f5e6d3] leading-relaxed tracking-wide px-3">
                      &quot;{battle.turnPhase === 'victory'
                        ? (activeServant.customQuotes?.victory || activeServant.template.victoryQuote || "A decisive triumph. The Holy Grail draws closer.")
                        : battle.turnPhase === 'fled'
                        ? "A strategic retreat today ensures our victory tomorrow, Master. Returning to safety!"
                        : battle.turnPhase === 'evacuated'
                        ? "Understood, Master! Spatial extraction initiated through the Command Seal's authority!"
                        : (activeServant.customQuotes?.defeat || activeServant.template.defeatQuote || "Master... I have failed you in battle...")}&quot;
                    </p>
                    <span className="absolute bottom-2 right-2 text-2xl font-serif text-[#d4af37]/20 select-none">”</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handleRestart}
              className="px-6 py-2.5 rounded-sm bg-[#d4af37] hover:bg-[#c49f27] text-black font-bold text-xs uppercase tracking-wider shadow-lg transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Rematch Duel
            </button>
            <button
              onClick={() => setArenaTab('history')}
              className="px-6 py-2.5 rounded-sm bg-[#161616] hover:bg-[#222] text-[#d4af37] border border-[#d4af37]/40 font-bold text-xs uppercase tracking-wider shadow-lg transition flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Review Turn-by-Turn Combat Log
            </button>
          </div>
        </div>
      )}

      {/* Combat Command Controller */}
      {battle.turnPhase !== 'victory' &&
        battle.turnPhase !== 'defeat' &&
        battle.turnPhase !== 'fled' &&
        battle.turnPhase !== 'evacuated' && (
        <div className="p-6 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] shadow-2xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1a1a1a] pb-4">
            <div>
              <h3 className="text-sm font-serif italic text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#d4af37]" /> Command Card Sequence (3 Cards)
              </h3>
              <p className="text-[11px] font-mono text-white/40 mt-0.5">
                Select 3 cards to chain tactical Buster / Arts / Quick multipliers
              </p>
            </div>

            {/* Quick Chain Presets */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">Presets:</span>
              <button
                onClick={() => handleQuickPreset('Buster Brave')}
                className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider font-bold rounded-sm bg-[#220000] text-[#ef4444] border border-[#ef4444]/40 hover:bg-[#330000] transition"
              >
                Buster x3
              </button>
              <button
                onClick={() => handleQuickPreset('Arts Chain')}
                className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider font-bold rounded-sm bg-[#001133] text-[#3b82f6] border border-[#3b82f6]/40 hover:bg-[#001c4d] transition"
              >
                Arts x3
              </button>
              <button
                onClick={() => handleQuickPreset('Quick Chain')}
                className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider font-bold rounded-sm bg-[#002200] text-[#22c55e] border border-[#22c55e]/40 hover:bg-[#003300] transition"
              >
                Quick x3
              </button>
            </div>
          </div>

          {/* Active 3-card slots */}
          <div className="flex items-center justify-center gap-4">
            {[0, 1, 2].map(idx => {
              const card = selectedCards[idx];
              return (
                <div
                  key={idx}
                  className={`w-28 h-36 rounded-lg border flex flex-col items-center justify-center p-3 transition-all ${
                    card === 'Buster'
                      ? 'bg-[#220000] border-[#ef4444]/60 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                      : card === 'Arts'
                      ? 'bg-[#001133] border-[#3b82f6]/60 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                      : card === 'Quick'
                      ? 'bg-[#002200] border-[#22c55e]/60 shadow-[0_0_12px_rgba(34,197,94,0.2)]'
                      : 'bg-[#0f0f0f] border-dashed border-[#222]'
                  }`}
                >
                  {card ? (
                    <>
                      <span className={`text-[10px] font-mono font-bold uppercase tracking-widest ${
                        card === 'Buster' ? 'text-[#ef4444]' : card === 'Arts' ? 'text-[#3b82f6]' : 'text-[#22c55e]'
                      }`}>
                        {card}
                      </span>
                      <span className="text-[9px] font-mono text-white/50 mt-1">
                        {card === 'Buster' ? 'DMG +50%' : card === 'Arts' ? 'NP +30%' : 'Crit +40%'}
                      </span>
                    </>
                  ) : (
                    <span className="text-[10px] font-mono text-white/20 uppercase tracking-wider">Slot #{idx + 1}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Card Hand Selector */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {p1.commandDeck.map((card, idx) => {
              const baseMult = card === 'Buster' ? 2.0 : card === 'Arts' ? 1.8 : 2.2;
              const critPct = Math.min(100, Math.round((p1.critStars || 0) * baseMult));
              return (
                <button
                  key={idx}
                  disabled={selectedCards.length >= 3}
                  onClick={() => handleCardClick(card)}
                  className={`px-4 py-2 rounded-sm font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 border transition disabled:opacity-30 disabled:cursor-not-allowed ${
                    card === 'Buster'
                      ? 'bg-[#220000] hover:bg-[#330000] text-[#ef4444] border-[#ef4444]/40'
                      : card === 'Arts'
                      ? 'bg-[#001133] hover:bg-[#001c4d] text-[#3b82f6] border-[#3b82f6]/40'
                      : 'bg-[#002200] hover:bg-[#003300] text-[#22c55e] border-[#22c55e]/40'
                  }`}
                >
                  <span>{card} ({critPct}% Crit)</span>
                </button>
              );
            })}

            <button
              onClick={handleClearCards}
              className="px-3.5 py-2 rounded-sm bg-transparent hover:bg-[#161616] text-white/60 hover:text-white text-xs font-mono uppercase tracking-wider border border-white/20"
            >
              Clear
            </button>
          </div>

          {/* Active Skills & Noble Phantasm Triggers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#1a1a1a]">
            {/* Active Skills */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Active Skills:</span>
              <div className="flex flex-wrap gap-2">
                {p1.skills.map((sk, idx) => (
                  <button
                    key={sk.id}
                    disabled={sk.currentCooldown > 0}
                    onClick={() => setSelectedSkillIdx(selectedSkillIdx === idx ? undefined : idx)}
                    className={`px-3 py-1.5 rounded-sm text-xs font-mono transition border ${
                      selectedSkillIdx === idx
                        ? 'bg-[#d4af37] text-black border-[#d4af37] font-bold'
                        : sk.currentCooldown > 0
                        ? 'bg-[#111] text-white/20 border-[#1a1a1a] cursor-not-allowed'
                        : 'bg-[#111] hover:bg-[#161616] text-white/80 border-[#222]'
                    }`}
                  >
                    <span>{sk.icon} </span>
                    <span>{sk.name}</span>
                    {sk.currentCooldown > 0 && <span className="text-[10px] text-white/40"> ({sk.currentCooldown}t)</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Noble Phantasm & Command Seals Activation */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Noble Phantasm & Seals:</span>
                <span className="text-[10px] font-mono text-rose-400">🔴 {master.commandSeals ?? 3}/3 Seals</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  disabled={p1.npGauge < 100}
                  onClick={() => setUseNp(!useNp)}
                  className={`py-2 px-3 rounded-sm text-xs font-mono uppercase tracking-wider flex items-center justify-between border transition ${
                    useNp
                      ? 'bg-[#d4af37] text-black border-[#d4af37] font-bold shadow-[0_0_12px_#d4af37]'
                      : p1.npGauge >= 100
                      ? 'bg-[#ef4444]/20 hover:bg-[#ef4444]/30 text-[#ef4444] border-[#ef4444]/50'
                      : 'bg-[#111] text-white/30 border-[#1a1a1a] cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-serif italic capitalize not-italic truncate">{p1.noblePhantasm.name}</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-black/40 font-mono ml-1">
                    {p1.npGauge >= 100 ? 'READY' : `${Math.round(p1.npGauge)}%`}
                  </span>
                </button>

                <button
                  disabled={(master.commandSeals ?? 3) <= 0 || p1.npGauge >= 100}
                  onClick={() => setSelectedCommandSeal(selectedCommandSeal ? undefined : 'np_charge')}
                  className={`py-2 px-3 rounded-sm text-xs font-mono tracking-wider flex items-center justify-between border transition ${
                    selectedCommandSeal
                      ? 'bg-rose-600 text-white border-rose-400 font-bold shadow-[0_0_12px_rgba(225,29,72,0.5)]'
                      : (master.commandSeals ?? 3) <= 0 || p1.npGauge >= 100
                      ? 'bg-[#111] text-white/30 border-[#1a1a1a] cursor-not-allowed'
                      : 'bg-[#111] hover:bg-[#161616] text-rose-400 border-rose-900/50'
                  }`}
                >
                  <span className="truncate">🔴 Refill NP (1 Seal)</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-black/40 font-mono ml-1">100% NP</span>
                </button>
              </div>
            </div>
          </div>

          {/* Flee Status Message Banner if applicable */}
          {fleeStatusMessage && (
            <div className="p-3 rounded bg-amber-950/30 border border-amber-500/40 text-amber-300 text-xs font-mono flex items-center justify-between">
              <span>{fleeStatusMessage}</span>
              <button
                type="button"
                onClick={() => setFleeStatusMessage(null)}
                className="text-white/40 hover:text-white text-xs font-mono ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Turn Execution & Flee Control Row */}
          {(() => {
            const fleeCalc = calculateFleeChance(
              p1.currentHp,
              p1.maxHp,
              p1.servantClass,
              p1.stats?.agility || 10
            );

            return (
              <div className="pt-2 flex flex-col sm:flex-row items-stretch gap-3">
                <button
                  disabled={selectedCards.length < 3 && !useNp}
                  onClick={handleExecuteTurn}
                  className="flex-1 py-3 rounded-sm bg-[#d4af37] hover:bg-[#c49f27] text-black font-bold text-xs font-mono uppercase tracking-widest shadow-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSimulating ? (
                    <span>Resolving Turn Clash...</span>
                  ) : (
                    <>
                      <span>Execute Turn {battle.currentTurn} Clash</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isSimulating}
                  onClick={handleAttemptFlee}
                  title={`Tactical Flee chance: ${fleeCalc.chancePercent}%. ${
                    fleeCalc.isAgilityBonus ? '+5% Agility Servant bonus applied! ' : ''
                  }${
                    p1.currentHp / p1.maxHp < 0.5
                      ? 'Escape rate decreased because HP < 50%.'
                      : 'Base 30% rate.'
                  } Consumes turn and risks counter-strike on failure!`}
                  className="px-5 py-3 rounded-sm border border-amber-500/40 bg-amber-950/20 hover:bg-amber-950/40 active:bg-amber-900/50 text-amber-300 font-mono text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 disabled:opacity-40 shadow-md"
                >
                  <Footprints className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Flee ({fleeCalc.chancePercent}%)</span>
                  {fleeCalc.isAgilityBonus && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30">
                      +5% AGI
                    </span>
                  )}
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Battle Log History */}
      {battle.turnHistory.length > 0 && (
        <div className="p-6 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono uppercase tracking-widest text-white/40 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#d4af37]" /> Current Clash Logs
            </h4>
            <button
              onClick={() => setArenaTab('history')}
              className="text-[11px] font-mono text-[#d4af37] hover:underline flex items-center gap-1 transition"
            >
              <BookOpen className="w-3 h-3" />
              <span>Review Past 10 Battles History</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto font-mono text-xs">
            {battle.turnHistory.slice(-6).map((log, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-sm bg-[#111] border border-[#1a1a1a] flex items-start gap-2.5 text-white/80"
              >
                <span className="text-[#d4af37] font-bold">T{log.turnNumber}:</span>
                <div className="flex-1">
                  <div>{log.actionSummary}</div>
                  {log.npChant && (
                    <div className="text-[#d4af37] italic text-[11px] mt-0.5">
                      &quot;{log.npChant}&quot;
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
