// Stage-Aware Servant Expression System for Fate Visual Novel Cards & Bond Sanctum
// Supports Base Body + Expression Sheet/Face Overlays per Ascension Stage

export type ExpressionEmotion = 
  | 'neutral'
  | 'smile'
  | 'angry'
  | 'blush'
  | 'wink'
  | 'shock'
  | 'pout'
  | 'embarrassed'
  | 'determined'
  | 'sad'
  | 'smug';

export interface StageExpressionConfig {
  stage: number;
  stageName: string;
  baseSpriteUrl?: string; // Stage-specific base body sprite
  expressionGridUrl?: string; // Expression grid sheet (e.g. 4x4 or 3x3)
  gridCols?: number;
  gridRows?: number;
  // Bounding box for where the facial area sits on the base sprite canvas (in percentage or relative offsets)
  faceBox?: {
    xPercent: number; // e.g. 45% across from top-left of sprite
    yPercent: number; // e.g. 18% down from top-left of sprite
    wPercent: number; // e.g. 15% width of face
    hPercent: number; // e.g. 12% height of face
  };
  // Individual face mappings for emotions
  faces?: Record<ExpressionEmotion, {
    col?: number;
    row?: number;
    customOverlayUrl?: string; // Direct PNG face crop override URL
    label?: string;
  }>;
}

export interface ServantExpressionData {
  servantKey: string;
  servantName: string;
  stages: Record<number, StageExpressionConfig>;
}

// Built-in Registry for Canonical & Popular Servants
export const SERVANT_EXPRESSIONS: Record<string, ServantExpressionData> = {
  // Aozaki Aoko (Servant No. 413)
  aoko: {
    servantKey: 'aoko',
    servantName: 'Aozaki Aoko',
    stages: {
      1: {
        stage: 1,
        stageName: 'Stage 1 (School Uniform)',
        baseSpriteUrl: 'https://static.atlasacademy.io/NA/CharaFigure/3051000/3051000_merged.png',
        faceBox: { xPercent: 46, yPercent: 12, wPercent: 14, hPercent: 12 },
        faces: {
          neutral: { label: '😐 Neutral', customOverlayUrl: '' },
          smile: { label: '😊 Smile / Playful', customOverlayUrl: '' },
          angry: { label: '😠 Serious / Fifth Magic', customOverlayUrl: '' },
          blush: { label: '😳 Flustered', customOverlayUrl: '' },
          wink: { label: '😉 Confident Wink', customOverlayUrl: '' },
          shock: { label: '😱 Surprised', customOverlayUrl: '' },
          pout: { label: '😤 Pouting', customOverlayUrl: '' },
          embarrassed: { label: '🙈 Shy', customOverlayUrl: '' },
          determined: { label: '🔥 Red Shift Charging', customOverlayUrl: '' },
          sad: { label: '🙁 Soft Sigh', customOverlayUrl: '' },
          smug: { label: '😏 Grin', customOverlayUrl: '' },
        }
      },
      2: {
        stage: 2,
        stageName: 'Stage 2 (Casual Traveler)',
        baseSpriteUrl: 'https://static.atlasacademy.io/NA/CharaFigure/3051001/3051001_merged.png',
        faceBox: { xPercent: 45, yPercent: 11, wPercent: 15, hPercent: 12 },
        faces: {
          neutral: { label: '😐 Calm', customOverlayUrl: '' },
          smile: { label: '😊 Bright Smile', customOverlayUrl: '' },
          angry: { label: '😠 Annoyed', customOverlayUrl: '' },
          blush: { label: '😳 Blushing', customOverlayUrl: '' },
          wink: { label: '😉 Wink', customOverlayUrl: '' },
          shock: { label: '😱 Astonished', customOverlayUrl: '' },
          pout: { label: '😤 Pout', customOverlayUrl: '' },
          embarrassed: { label: '🙈 Embarrassed', customOverlayUrl: '' },
          determined: { label: '🔥 Battle Ready', customOverlayUrl: '' },
          sad: { label: '🙁 Melancholic', customOverlayUrl: '' },
          smug: { label: '😏 Mischievous', customOverlayUrl: '' },
        }
      },
      3: {
        stage: 3,
        stageName: 'Stage 3 (Super Aoko / Red Shift Transformation)',
        baseSpriteUrl: 'https://static.atlasacademy.io/NA/CharaFigure/3051002/3051002_merged.png',
        faceBox: { xPercent: 44, yPercent: 10, wPercent: 16, hPercent: 13 },
        faces: {
          neutral: { label: '🔥 Super Aoko Neutral', customOverlayUrl: '' },
          smile: { label: '✨ Cosmic Smile', customOverlayUrl: '' },
          angry: { label: '⚡ Fifth Magic Unleashed', customOverlayUrl: '' },
          blush: { label: '😳 Soft Redness', customOverlayUrl: '' },
          wink: { label: '😉 Playful Fifth Magic', customOverlayUrl: '' },
          shock: { label: '💥 Stunned', customOverlayUrl: '' },
          pout: { label: '😤 Sassy Pout', customOverlayUrl: '' },
          embarrassed: { label: '🙈 Overwhelmed', customOverlayUrl: '' },
          determined: { label: '🌌 Red Shift Cannon', customOverlayUrl: '' },
          sad: { label: '🙁 Quiet Moment', customOverlayUrl: '' },
          smug: { label: '😏 True Magician Grin', customOverlayUrl: '' },
        }
      }
    }
  },

  // Dark Sakura (Sakura Matou / Shadow)
  dark_sakura: {
    servantKey: 'dark_sakura',
    servantName: 'Dark Sakura',
    stages: {
      1: {
        stage: 1,
        stageName: 'Shadow Vessel (Bound Ribbon)',
        baseSpriteUrl: 'https://static.atlasacademy.io/NA/CharaFigure/1001000/1001000_merged.png',
        faceBox: { xPercent: 48, yPercent: 14, wPercent: 14, hPercent: 12 },
        faces: {
          neutral: { label: '😐 Soft Shadow', customOverlayUrl: '' },
          smile: { label: '🌸 Gentle Smile', customOverlayUrl: '' },
          angry: { label: '🖤 Void Gaze', customOverlayUrl: '' },
          blush: { label: '😳 Shy Warmth', customOverlayUrl: '' },
          wink: { label: '😉 Quiet Tease', customOverlayUrl: '' },
          shock: { label: '😱 Trembling', customOverlayUrl: '' },
          pout: { label: '😤 Pouting Ribbon', customOverlayUrl: '' },
          embarrassed: { label: '🙈 Flustered Sakura', customOverlayUrl: '' },
          determined: { label: '🔥 Shadow Unleashed', customOverlayUrl: '' },
          sad: { label: '🙁 Sorrowful', customOverlayUrl: '' },
          smug: { label: '😏 Playful Dark Smile', customOverlayUrl: '' },
        }
      }
    }
  },

  // Artoria Pendragon
  artoria: {
    servantKey: 'artoria',
    servantName: 'Artoria Pendragon',
    stages: {
      1: {
        stage: 1,
        stageName: 'Stage 1 (Unarmored / Caliburn)',
        baseSpriteUrl: 'https://static.atlasacademy.io/NA/CharaFigure/1001000/1001000_merged.png',
        faceBox: { xPercent: 47, yPercent: 13, wPercent: 14, hPercent: 12 },
        faces: {
          neutral: { label: '😐 Regal Neutral', customOverlayUrl: '' },
          smile: { label: '👑 Soft King Smile', customOverlayUrl: '' },
          angry: { label: '⚔️ Excalibur Command', customOverlayUrl: '' },
          blush: { label: '😳 Chivalric Blush', customOverlayUrl: '' },
          wink: { label: '😉 Nod', customOverlayUrl: '' },
          shock: { label: '😱 Surprised King', customOverlayUrl: '' },
          pout: { label: '😤 Hungry Ahoge Pout', customOverlayUrl: '' },
          embarrassed: { label: '🙈 Flustered Saber', customOverlayUrl: '' },
          determined: { label: '✨ Excalibur Prepared', customOverlayUrl: '' },
          sad: { label: '🙁 Gentle Grief', customOverlayUrl: '' },
          smug: { label: '😏 Proud King', customOverlayUrl: '' },
        }
      },
      2: {
        stage: 2,
        stageName: 'Stage 2 (Silver Plate Armor)',
        baseSpriteUrl: 'https://static.atlasacademy.io/NA/CharaFigure/1001001/1001001_merged.png',
        faceBox: { xPercent: 47, yPercent: 12, wPercent: 14, hPercent: 12 },
        faces: {
          neutral: { label: '😐 Knightly Neutral', customOverlayUrl: '' },
          smile: { label: '😊 Warm Smile', customOverlayUrl: '' },
          angry: { label: '⚔️ Battle Cry', customOverlayUrl: '' },
          blush: { label: '😳 Blushing Armor', customOverlayUrl: '' },
          wink: { label: '😉 Sword Wink', customOverlayUrl: '' },
          shock: { label: '😱 Shocked', customOverlayUrl: '' },
          pout: { label: '😤 Pout', customOverlayUrl: '' },
          embarrassed: { label: '🙈 Embarrassed', customOverlayUrl: '' },
          determined: { label: '✨ Ready for Battle', customOverlayUrl: '' },
          sad: { label: '🙁 Melancholy', customOverlayUrl: '' },
          smug: { label: '😏 Confident', customOverlayUrl: '' },
        }
      },
      3: {
        stage: 3,
        stageName: 'Stage 3 (Full Crown & Blue Cape)',
        baseSpriteUrl: 'https://static.atlasacademy.io/NA/CharaFigure/1001002/1001002_merged.png',
        faceBox: { xPercent: 47, yPercent: 11, wPercent: 14, hPercent: 12 },
        faces: {
          neutral: { label: '👑 High King Stance', customOverlayUrl: '' },
          smile: { label: '✨ Sovereign Smile', customOverlayUrl: '' },
          angry: { label: '⚔️ Sword of Promised Victory', customOverlayUrl: '' },
          blush: { label: '😳 Royal Blush', customOverlayUrl: '' },
          wink: { label: '😉 Crown Wink', customOverlayUrl: '' },
          shock: { label: '😱 Stunned Sovereign', customOverlayUrl: '' },
          pout: { label: '😤 Ahoge Twitch Pout', customOverlayUrl: '' },
          embarrassed: { label: '🙈 Shy King', customOverlayUrl: '' },
          determined: { label: '🌟 Excalibur Radiance', customOverlayUrl: '' },
          sad: { label: '🙁 Solitary King', customOverlayUrl: '' },
          smug: { label: '😏 Majestic Grin', customOverlayUrl: '' },
        }
      }
    }
  }
};

/**
 * Finds matching expression registry entry for a servant key or name
 */
export function getServantExpressionRegistry(servantIdOrName?: string): ServantExpressionData | null {
  if (!servantIdOrName) return null;
  const key = servantIdOrName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  
  for (const [id, data] of Object.entries(SERVANT_EXPRESSIONS)) {
    if (key.includes(id) || data.servantName.toLowerCase().includes(servantIdOrName.toLowerCase())) {
      return data;
    }
  }
  return null;
}

/**
 * Resolves specific stage expression config for a servant
 */
export function resolveStageExpressionConfig(
  servantIdOrName: string,
  stage: number = 1
): StageExpressionConfig | null {
  const reg = getServantExpressionRegistry(servantIdOrName);
  if (!reg) return null;
  
  const targetStage = Math.max(1, Math.min(3, stage));
  return reg.stages[targetStage] || reg.stages[1] || null;
}
