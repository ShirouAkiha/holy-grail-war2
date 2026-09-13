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
    const sqReward = event.rewardSaintQuartz || 3;
    const { updatedServant } = addBondExpToServant(servant, totalBondExpGained);

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
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-black overflow-hidden select-none font-sans animate-fadeIn">
      {/* FULLSCREEN ATMOSPHERIC BACKGROUND SCENE */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img
          src="https://ella.janitorai.com/media-approved/IIRAOZkI3ENNvVT8H7gQC.webp"
          alt="Visual Novel Background"
          className="w-full h-full object-cover object-center transform scale-105 transition-all duration-1000 filter brightness-90 contrast-105"
        />
        {/* Subtle Sepia & Lighting Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/30 pointer-events-none" />
      </div>

      {/* TOP-LEFT STATUS BADGE (Steins;Gate Style) */}
      <div className="absolute top-6 left-6 sm:left-10 z-30 flex items-center gap-4">
        <div className="bg-slate-900/85 border border-slate-300/40 rounded-sm px-4 py-2 shadow-[0_4px_20px_rgba(0,0,0,0.7)] backdrop-blur-md flex items-center gap-3">
          <span className="font-mono text-base sm:text-lg font-bold text-slate-100 tracking-wider">
            8/13 <span className="text-xs text-slate-400 font-sans font-normal">(FRI)</span>
          </span>
          <div className="h-4 w-px bg-slate-600/60" />
          <div className="flex items-center gap-1.5 text-slate-300 text-xs font-mono">
            <span className="text-[10px] bg-slate-700/60 px-1 py-0.5 rounded text-slate-200">🔋 98%</span>
            <span className="text-[11px] text-slate-300">📶</span>
          </div>
        </div>
      </div>

      {/* TOP-RIGHT ACTIONS / CLOSE BUTTON */}
      <div className="absolute top-6 right-6 sm:right-10 z-30 flex items-center gap-3">
        <button
          onClick={onClose}
          className="bg-slate-900/85 hover:bg-slate-800 border border-slate-400/40 text-slate-200 px-4 py-2 rounded-sm text-xs font-mono tracking-wider font-semibold backdrop-blur-md transition-all shadow-lg flex items-center gap-2 group"
        >
          <span className="text-amber-400 font-bold group-hover:scale-110 transition-transform">[ESC]</span>
          <span>EXIT INTERLUDE</span>
        </button>
      </div>

      {/* MAIN STAGE / CONTENT AREA */}
      {!isEventFinished ? (
        <div className="relative inset-0 flex-1 flex flex-col justify-end z-10 overflow-hidden">
          
          {/* RIGHT SIDE CHARACTER SPRITE (Standing ON stage like Kurisu) */}
          <div className="absolute bottom-[100px] sm:bottom-[120px] right-[4%] sm:right-[8%] md:right-[12%] h-[65%] sm:h-[75%] md:h-[82%] max-h-[720px] z-10 pointer-events-none flex items-end justify-center">
            <div className="relative group h-full">
              {/* Soft character aura glow */}
              <div className="absolute inset-0 bg-gradient-to-t from-amber-500/20 via-indigo-500/10 to-transparent rounded-full blur-2xl opacity-60" />
              
              {/* Full height character sprite */}
              <img
                src={avatarUrl}
                alt={currentScene.speakerName || template.name}
                className="h-full w-auto object-contain object-bottom filter drop-shadow-[0_20px_40px_rgba(0,0,0,0.9)] transition-all duration-300 transform group-hover:scale-[1.01]"
                referrerPolicy="no-referrer"
              />

              {/* Emotion Badge */}
              {reactionEmotion && (
                <div className="absolute top-4 left-4 px-3 py-1 rounded-sm border border-amber-400/60 bg-slate-950/90 text-amber-300 text-xs font-mono font-bold backdrop-blur-md shadow-2xl animate-bounce">
                  ✨ {reactionEmotion.toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* CHOICE SELECTION OVERLAY (Centered Left above dialogue bar) */}
          {currentScene.choices && currentScene.choices.length > 0 && !selectedChoice && (
            <div className="absolute inset-x-6 bottom-[260px] sm:bottom-[280px] z-30 flex flex-col gap-3 max-w-xl mx-auto sm:ml-12 md:ml-20 bg-slate-950/90 border border-slate-400/40 p-5 rounded-sm backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.9)]">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-widest text-center flex items-center justify-center gap-2 mb-1">
                <Heart className="w-4 h-4 fill-amber-400" /> Choose Master Response
              </div>
              {currentScene.choices.map(choice => (
                <button
                  key={choice.id}
                  onClick={() => handleSelectChoice(choice)}
                  className="w-full p-3.5 text-left rounded-sm border border-slate-700 hover:border-amber-400 bg-slate-900/90 hover:bg-slate-800/90 transition-all group flex items-start justify-between gap-3 shadow-md"
                >
                  <span className="text-sm sm:text-base text-slate-100 group-hover:text-amber-200 font-serif">
                    “{choice.text}”
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono whitespace-nowrap">
                    +{choice.bondExpGain} EXP
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* LOWER VISUAL NOVEL DIALOGUE BAR (Steins;Gate Style) */}
          <div className="relative z-20 w-full bg-gradient-to-t from-black via-slate-950/95 to-slate-950/80 border-t border-slate-400/40 pt-6 pb-6 px-6 sm:px-12 md:px-20 backdrop-blur-md shadow-[0_-15px_50px_rgba(0,0,0,0.95)]">
            
            {/* Speaker Nameplate Pill (Centered on top border line) */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-8 py-0.5 bg-slate-950 border border-slate-400/60 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.8)] flex items-center gap-3">
              <div className="h-px w-6 bg-slate-500/60" />
              <span className="text-xs sm:text-sm font-serif font-bold tracking-widest text-slate-100 uppercase">
                {currentScene.speakerName || template.name}
              </span>
              <div className="h-px w-6 bg-slate-500/60" />
            </div>

            <div className="max-w-6xl mx-auto flex flex-col justify-between min-h-[110px] cursor-pointer" onClick={handleDialogueBoxClick}>
              
              {/* Dialogue Text Container */}
              <div className="pt-2 pb-4 pr-12">
                <p className="text-base sm:text-lg md:text-xl text-slate-100 font-serif leading-relaxed tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                  “{displayedText}”
                  {isTyping && <span className="inline-block w-2 h-4 ml-1 bg-amber-300 animate-pulse" />}
                </p>
              </div>

              {/* Bottom Info Bar & Spinning Gear Icon */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs font-mono text-slate-400">
                <div className="flex items-center gap-4">
                  <span className="text-amber-400/90 font-semibold">◆ BOND LVL {servant.bondLevel || 1}/10</span>
                  <span>SCENE {currentSceneIndex + 1}/{event.scenes.length}</span>
                </div>

                <div className="flex items-center gap-3">
                  {(!currentScene.choices || selectedChoice || currentScene.choices.length === 0) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNextScene();
                      }}
                      disabled={isTyping}
                      className="flex items-center gap-2 px-4 py-1.5 rounded-sm bg-slate-900 hover:bg-slate-800 border border-slate-500/50 hover:border-amber-400 text-amber-300 font-mono text-xs font-bold transition-all disabled:opacity-50 shadow-md"
                    >
                      <span>{currentSceneIndex < event.scenes.length - 1 ? 'NEXT' : 'CONCLUDE'}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                  {/* Spinning Gear Icon from Steins;Gate UI */}
                  <div className="w-5 h-5 text-slate-400/80 animate-spin-slow flex items-center justify-center">
                    ⚙
                  </div>
                </div>
              </div>
            </div>

            {/* BOTTOM-LEFT INTERACTION CONTROLS HINT */}
            <div className="absolute bottom-1.5 left-6 sm:left-12 flex items-center gap-4 text-[10px] font-mono text-slate-500 tracking-wider">
              <span><strong className="text-slate-300">F3</strong> AUTO</span>
              <span>•</span>
              <span><strong className="text-slate-300">E</strong> SKIP</span>
              <span>•</span>
              <span><strong className="text-slate-300">CLICK</strong> ADVANCE</span>
            </div>
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
  );
};
