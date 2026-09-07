'use client';

import React, { useRef, useEffect, useState } from 'react';
import {
  renderServantProfileCard,
  renderDialogueCard,
  renderDefeatDialogueCard,
  renderBattleTurnSummary
} from '../lib/canvas/browserCanvas';

export function CanvasRenderer({ canvasType, payload }: { canvasType: string; payload: any }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!canvasRef.current || !payload) return;
    const canvas = canvasRef.current;

    if (canvasType === 'servant') {
      renderServantProfileCard(canvas, payload.servant, payload.masterName);
    } else if (canvasType === 'dialogue') {
      renderDialogueCard(
        canvas,
        payload.speaker,
        payload.quote,
        payload.title || 'Tactical Combat Chain',
        payload.servantClass || 'Saber',
        payload.avatarUrl,
        payload.bondOrLevel || 8,
        payload.defenderName || 'Gilgamesh',
        payload.defenderAvatarUrl,
        payload.defenderClass || 'Archer',
        payload.sequence || ['Buster', 'Buster', 'Buster'],
        payload.bgUrlOrPreset || 'fuyuki'
      );
    } else if (canvasType === 'defeat_dialogue') {
      renderDefeatDialogueCard(
        canvas,
        payload.speaker,
        payload.quote,
        payload.title || 'SPIRIT ORIGIN DISSOLVED',
        payload.servantClass || 'Saber',
        payload.avatarUrl,
        payload.bondOrLevel || 8,
        payload.defenderName || 'Opponent Servant',
        payload.defenderAvatarUrl,
        payload.defenderClass || 'Enemy',
        payload.bgUrlOrPreset || 'fuyuki'
      );
    } else if (canvasType === 'battle') {
      renderBattleTurnSummary(canvas, payload.log, payload.p1, payload.p2);
    }

    return () => {
      if (canvas && (canvas as any).__animTimer) {
        clearInterval((canvas as any).__animTimer);
        (canvas as any).__animTimer = null;
      }
    };
  }, [canvasType, payload]);

  const toggleAnimation = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if ((canvas as any).__animTimer) {
      clearInterval((canvas as any).__animTimer);
      (canvas as any).__animTimer = null;
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      if (canvasType === 'dialogue') {
        renderDialogueCard(
          canvas,
          payload.speaker,
          payload.quote,
          payload.title || 'Tactical Combat Chain',
          payload.servantClass || 'Saber',
          payload.avatarUrl,
          payload.bondOrLevel || 8,
          payload.defenderName || 'Gilgamesh',
          payload.defenderAvatarUrl,
          payload.defenderClass || 'Archer',
          payload.sequence || ['Buster', 'Buster', 'Buster'],
          payload.bgUrlOrPreset || 'fuyuki'
        );
      } else if (canvasType === 'defeat_dialogue') {
        renderDefeatDialogueCard(
          canvas,
          payload.speaker,
          payload.quote,
          payload.title || 'SPIRIT ORIGIN DISSOLVED',
          payload.servantClass || 'Saber',
          payload.avatarUrl,
          payload.bondOrLevel || 8,
          payload.defenderName || 'Opponent Servant',
          payload.defenderAvatarUrl,
          payload.defenderClass || 'Enemy',
          payload.bgUrlOrPreset || 'fuyuki'
        );
      }
    }
  };

  const isAnimated = canvasType === 'dialogue' || canvasType === 'defeat_dialogue';

  return (
    <div className="relative group/canvas">
      <canvas
        ref={canvasRef}
        width={900}
        height={450}
        className="w-full h-auto block rounded-lg shadow-2xl"
      />
      {isAnimated && (
        <div className="absolute top-2.5 right-2.5 opacity-0 group-hover/canvas:opacity-100 transition-opacity flex gap-1.5 z-10">
          <button
            type="button"
            onClick={toggleAnimation}
            className="px-2 py-1 rounded bg-black/80 hover:bg-black text-[#d4af37] text-[10px] font-mono border border-[#d4af37]/40 backdrop-blur-sm shadow-md flex items-center gap-1 cursor-pointer transition-all"
            title={isPlaying ? 'Pause visual FX' : 'Play visual FX'}
          >
            <span>{isPlaying ? '⏸' : '▶'}</span>
            <span>{isPlaying ? 'FX Active' : 'FX Paused'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
