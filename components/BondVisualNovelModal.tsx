'use client';

import React, { useState, useEffect } from 'react';
import {
  BondEvent,
  BondScene,
  BondChoice,
  MasterServantInstance
} from '../lib/types';
import {
  getBondExpProgress,
  addBondExpToServant
} from '../lib/engine/bondEvents';
import { Sparkles, Award, ChevronRight, Volume2, Shield, Heart, CheckCircle2, RotateCcw } from 'lucide-react';

interface BondVisualNovelModalProps {
  isOpen: boolean;
  event: BondEvent | null;
  servant: MasterServantInstance;
  onClose: () => void;
  onComplete: (updatedServant: MasterServantInstance, rewardSq: number) => void;
}

export const BondVisualNovelModal: React.FC<BondVisualNovelModalProps> = ({
  isOpen,
  event,
  servant,
  onClose,
  onComplete
}) => {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<BondChoice | null>(null);
  const [choiceResponseText, setChoiceResponseText] = useState<string | null>(null);
  const [totalBondExpGained, setTotalBondExpGained] = useState(0);
  const [isEventFinished, setIsEventFinished] = useState(false);
  const [reactionEmotion, setReactionEmotion] = useState<string | null>(null);

  // Reset modal state when new event opens
  useEffect(() => {
    if (isOpen && event) {
      const timer = setTimeout(() => {
        setCurrentSceneIndex(0);
        setDisplayedText('');
        setSelectedChoice(null);
        setChoiceResponseText(null);
        setTotalBondExpGained(event.rewardBondExp || 100);
        setIsEventFinished(false);
        setReactionEmotion(null);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, event]);

  const currentScene: BondScene | undefined = event?.scenes[currentSceneIndex];

  // Typewriter effect for dialogue text
  useEffect(() => {
    if (!currentScene || isEventFinished) return;

    const fullText = choiceResponseText || currentScene.dialogueText;
    let charIndex = 0;
    
    // Schedule state updates asynchronously inside timer
    const timer = setTimeout(() => {
      setDisplayedText('');
      setIsTyping(true);
    }, 0);

    const interval = setInterval(() => {
      if (charIndex < fullText.length) {
        setDisplayedText(fullText.slice(0, charIndex + 1));
        charIndex++;
      } else {
        setIsTyping(false);
        clearInterval(interval);
      }
    }, 20);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [currentSceneIndex, choiceResponseText, currentScene, isEventFinished]);

  if (!isOpen || !event || !currentScene) return null;

  // Handle clicking dialogue box to auto-complete typewriter
  const handleDialogueBoxClick = () => {
    const fullText = choiceResponseText || currentScene.dialogueText;
    if (isTyping) {
      setDisplayedText(fullText);
      setIsTyping(false);
    }
  };

  // Handle player choice selection
  const handleSelectChoice = (choice: BondChoice) => {
    setSelectedChoice(choice);
    setChoiceResponseText(choice.response);
    setTotalBondExpGained(prev => prev + choice.bondExpGain);
    if (choice.reactionEmotion) {
      setReactionEmotion(choice.reactionEmotion);
    }
  };

  // Advance to next scene or conclude event
  const handleNextScene = () => {
    if (choiceResponseText) {
      // Clear choice response and advance scene
      setChoiceResponseText(null);
      setSelectedChoice(null);
      setReactionEmotion(null);
    }

    if (currentSceneIndex < event.scenes.length - 1) {
      setCurrentSceneIndex(prev => prev + 1);
    } else {
      // Event concluded!
      setIsEventFinished(true);
    }
  };

  // Finalize event rewards & update master servant instance
  const handleClaimRewards = () => {
    const isFirstTime = !servant.completedBondEvents?.includes(event.id);
    const sqReward = isFirstTime ? (event.rewardSaintQuartz || 3) : 0;
    const expGain = isFirstTime ? totalBondExpGained : 0;

    let updatedServant = { ...servant };
    if (isFirstTime && expGain > 0) {
      const res = addBondExpToServant(servant, expGain);
      updatedServant = res.updatedServant;
    }

    // Track completed event ID
    if (!updatedServant.completedBondEvents) {
      updatedServant.completedBondEvents = [];
    }
    if (!updatedServant.completedBondEvents.includes(event.id)) {
      updatedServant.completedBondEvents.push(event.id);
    }

    // Unlock dialogue line if event grants one
    if (event.unlockedQuoteId) {
      if (!updatedServant.unlockedDialogueIds) {
        updatedServant.unlockedDialogueIds = [];
      }
      if (!updatedServant.unlockedDialogueIds.includes(event.unlockedQuoteId)) {
        updatedServant.unlockedDialogueIds.push(event.unlockedQuoteId);
      }
    }

    onComplete(updatedServant, sqReward);
    onClose();
  };

  // Dynamic background themes
  const getThemeBackgroundClass = (theme?: string) => {
    switch (theme) {
      case 'fuyuki_moonlight':
        return 'from-slate-950 via-indigo-950 to-slate-900 border-indigo-500/30';
      case 'camelot_court':
        return 'from-amber-950 via-yellow-950 to-slate-900 border-amber-500/30';
      case 'ebonwatch_realm':
        return 'from-purple-950 via-stone-950 to-fuchsia-950 border-fuchsia-500/30';
      case 'dun_scaith':
        return 'from-red-950 via-slate-950 to-zinc-950 border-red-500/30';
      default:
        return 'from-slate-900 via-slate-950 to-cyan-950 border-cyan-500/30';
    }
  };

  const template = servant.template;
  const avatarUrl = currentScene.speakerAvatarUrl || servant.avatarUrl || template.avatarUrl;
  const bondProgress = getBondExpProgress(servant.bondExp || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 animate-fadeIn">
      <div className={`relative w-full max-w-4xl h-[85vh] max-h-[720px] rounded-2xl border bg-gradient-to-b ${getThemeBackgroundClass(currentScene.backgroundTheme)} shadow-2xl flex flex-col overflow-hidden text-slate-100`}>
        
        {/* TOP BAR: Event Title & Progress */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-sm z-20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Servant Bond Interlude</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">Bond Lv. {servant.bondLevel || 1}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-100">{event.title}</h3>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Exit Event
            </button>
          </div>
        </div>

        {/* MAIN STAGE / CONTENT AREA */}
        {!isEventFinished ? (
          <div className="relative flex-1 flex flex-col justify-between overflow-hidden p-4 sm:p-6">
            
            {/* ATMOSPHERIC BACKGROUND EFFECTS */}
            <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-400/20 via-transparent to-transparent" />

            {/* SERVANT CHARACTER PORTRAIT / CUT-IN */}
            <div className="relative flex-1 flex items-end justify-center mb-4 z-10">
              <div className="relative group">
                {/* Glowing Aura */}
                <div className="absolute -inset-2 bg-gradient-to-t from-amber-500/30 via-indigo-500/20 to-transparent rounded-full blur-xl opacity-70 group-hover:opacity-100 transition-opacity" />
                
                {/* Avatar Image */}
                <img
                  src={avatarUrl}
                  alt={currentScene.speakerName || template.name}
                  className="relative h-64 sm:h-80 md:h-96 object-contain filter drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)] transition-transform duration-300 transform hover:scale-105"
                  referrerPolicy="no-referrer"
                />

                {/* Emotion Badge if reacted */}
                {reactionEmotion && (
                  <div className="absolute top-2 right-2 px-3 py-1 rounded-full border border-amber-400/50 bg-amber-950/80 text-amber-300 text-xs font-semibold backdrop-blur-md shadow-lg animate-bounce">
                    ✨ {reactionEmotion.toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {/* CHOICE SELECTION OVERLAY (If scene has choices and choice hasn't been selected yet) */}
            {currentScene.choices && currentScene.choices.length > 0 && !selectedChoice && (
              <div className="absolute inset-x-4 top-24 z-30 flex flex-col gap-3 max-w-xl mx-auto bg-slate-950/90 border border-amber-500/40 p-4 rounded-xl backdrop-blur-md shadow-2xl">
                <div className="text-xs font-bold text-amber-400 uppercase tracking-widest text-center flex items-center justify-center gap-2">
                  <Heart className="w-4 h-4 fill-amber-400" /> Select Your Master Response
                </div>
                {currentScene.choices.map(choice => (
                  <button
                    key={choice.id}
                    onClick={() => handleSelectChoice(choice)}
                    className="w-full p-3 text-left rounded-lg border border-slate-700 hover:border-amber-400/80 bg-slate-900/90 hover:bg-slate-800 transition-all group flex items-start justify-between gap-3 shadow-md"
                  >
                    <span className="text-sm text-slate-200 group-hover:text-amber-200 font-medium">
                      “{choice.text}”
                    </span>
                    <span className="text-xs px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono whitespace-nowrap">
                      +{choice.bondExpGain} Bond EXP
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* DIALOGUE TEXT OVERLAY - CLASSIC FSN STYLE */}
            <div
              onClick={handleDialogueBoxClick}
              className="relative z-20 w-full bg-slate-950/70 border-t border-slate-400/30 p-4 sm:p-6 backdrop-blur-sm cursor-pointer shadow-2xl transition-colors rounded-b-xl"
            >
              {/* Speaker Name & Meta */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg sm:text-xl font-bold font-serif text-white tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                    ◆ {(currentScene.speakerName || template.name).toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-300/80 text-xs font-mono">
                  <span>◆ BOND LVL {servant.bondLevel || 1}/10</span>
                  <div className="flex items-center gap-1 text-slate-400 text-xs">
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Scene {currentSceneIndex + 1}/{event.scenes.length}</span>
                  </div>
                </div>
              </div>

              {/* Text */}
              <p className="text-base sm:text-lg text-white font-serif leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] min-h-[60px] tracking-wide">
                “{displayedText}”
                {isTyping && <span className="inline-block w-2 h-4 ml-1 bg-amber-300 animate-pulse" />}
              </p>

              {/* Next Prompt Indicator */}
              {(!currentScene.choices || selectedChoice || currentScene.choices.length === 0) && (
                <div className="flex justify-end mt-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNextScene();
                    }}
                    disabled={isTyping}
                    className="flex items-center gap-2 text-xs font-semibold px-4 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40 hover:bg-amber-500/30 text-amber-200 shadow-md disabled:opacity-50 transition-all"
                  >
                    <span>{currentSceneIndex < event.scenes.length - 1 ? 'Next Scene' : 'Conclude Event'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

          </div>
        ) : (
          /* EVENT CONCLUDED / REWARD SUMMARY SCREEN */
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-20 animate-fadeIn">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-400 flex items-center justify-center mb-4 shadow-xl">
              <Award className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-black text-slate-100 mb-1">Interlude Completed!</h2>
            <p className="text-sm text-amber-400/90 font-medium mb-6">
              You learned more about {template.name} and deepened your Master-Servant Bond.
            </p>

            {/* REWARD CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg mb-8">
              <div className="p-4 rounded-xl border border-amber-500/30 bg-slate-900/80 flex items-center gap-4 text-left shadow-lg">
                <div className="p-3 rounded-lg bg-amber-500/20 text-amber-300">
                  <Heart className="w-6 h-6 fill-amber-400/30" />
                </div>
                <div>
                  <div className="text-xs text-slate-400">Total Bond EXP Gained</div>
                  <div className="text-xl font-bold text-amber-300">+{totalBondExpGained} EXP</div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-cyan-500/30 bg-slate-900/80 flex items-center gap-4 text-left shadow-lg">
                <div className="p-3 rounded-lg bg-cyan-500/20 text-cyan-300">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-slate-400">Saint Quartz Reward</div>
                  <div className="text-xl font-bold text-cyan-300">+{event.rewardSaintQuartz || 3} SQ</div>
                </div>
              </div>
            </div>

            {/* BOND LEVEL PROGRESS BAR */}
            <div className="w-full max-w-lg bg-slate-950/80 border border-slate-800 p-4 rounded-xl mb-8 text-left">
              <div className="flex justify-between items-center text-xs font-semibold mb-2">
                <span className="text-slate-300">Servant Bond Level</span>
                <span className="text-amber-400 font-mono">Bond Lv. {servant.bondLevel || 1}</span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-700"
                  style={{ width: `${bondProgress.progressPercent}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-400 mt-1 text-right font-mono">
                {bondProgress.expInCurrentLevel} / {bondProgress.neededForNextLevel} EXP to next level
              </div>
            </div>

            {/* CLAIM BUTTON */}
            <button
              onClick={handleClaimRewards}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-base shadow-xl hover:shadow-amber-500/25 transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>Claim Rewards & Update Bond</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
