// Stage-Aware Servant Expression System for Fate Visual Novel Cards & Bond Sanctum
// Supports Base Body + Expression Sheet/Face Overlays per Ascension Stage

export type ExpressionEmotion = 
  | 'neutral'
  | 'smile'
  | 'angry'
  | 'blush'
  | 'wink'
  | 'shock'
  | 'sad'
  | 'smug'
  | 'confident';

export interface FaceCropBox {
  x: number; // Crop X on expression sheet
  y: number; // Crop Y on expression sheet
  w: number; // Crop Width
  h: number; // Crop Height
  targetX?: number; // Target X relative to base body (0-1 percentage or px)
  targetY?: number; // Target Y relative to base body
  targetW?: number; // Target Width
  targetH?: number; // Target Height
}

export interface ExpressionStageConfig {
  servantId: string | number;
  stage: number;
  stageName: string;
  sheetUrl: string; // Sprite sheet or expression image URL from Atlas Academy / CDN
  bodyUrl?: string; // Optional base body image URL
  baseFaceBox?: { x: number; y: number; w: number; h: number }; // Relative coordinates on main body
  emotions: Record<string, FaceCropBox | string>; // Maps emotion key to face crop box or individual overlay URL
}

export const SERVANT_EXPRESSIONS: Record<string, Record<number, ExpressionStageConfig>> = {
  // Aozaki Aoko (#413)
  '413': {
    1: {
      servantId: '413',
      stage: 1,
      stageName: 'High School Uniform (Stage 1)',
      sheetUrl: 'https://static.atlasacademy.io/NA/CharaFigure/413/413_face_1.png',
      baseFaceBox: { x: 0.42, y: 0.15, w: 0.16, h: 0.18 },
      emotions: {
        smile: { x: 0, y: 0, w: 128, h: 128 },
        angry: { x: 128, y: 0, w: 128, h: 128 },
        blush: { x: 256, y: 0, w: 128, h: 128 },
        wink: { x: 0, y: 128, w: 128, h: 128 },
        shock: { x: 128, y: 128, w: 128, h: 128 },
        neutral: { x: 256, y: 128, w: 128, h: 128 }
      }
    },
    2: {
      servantId: '413',
      stage: 2,
      stageName: 'Casual Modern Attire (Stage 2)',
      sheetUrl: 'https://static.atlasacademy.io/NA/CharaFigure/413/413_face_2.png',
      baseFaceBox: { x: 0.42, y: 0.15, w: 0.16, h: 0.18 },
      emotions: {
        smile: { x: 0, y: 0, w: 128, h: 128 },
        angry: { x: 128, y: 0, w: 128, h: 128 },
        blush: { x: 256, y: 0, w: 128, h: 128 },
        wink: { x: 0, y: 128, w: 128, h: 128 },
        shock: { x: 128, y: 128, w: 128, h: 128 },
        neutral: { x: 256, y: 128, w: 128, h: 128 }
      }
    },
    3: {
      servantId: '413',
      stage: 3,
      stageName: 'Super Aoko Red Hair Form (Stage 3)',
      sheetUrl: 'https://static.atlasacademy.io/NA/CharaFigure/413/413_face_3.png',
      baseFaceBox: { x: 0.42, y: 0.14, w: 0.17, h: 0.19 },
      emotions: {
        smile: { x: 0, y: 0, w: 128, h: 128 },
        angry: { x: 128, y: 0, w: 128, h: 128 },
        blush: { x: 256, y: 0, w: 128, h: 128 },
        wink: { x: 0, y: 128, w: 128, h: 128 },
        shock: { x: 128, y: 128, w: 128, h: 128 },
        neutral: { x: 256, y: 128, w: 128, h: 128 }
      }
    }
  },
  // Mélusine (#312)
  '312': {
    1: {
      servantId: '312',
      stage: 1,
      stageName: 'Fairy Knight Lancelot (Stage 1)',
      sheetUrl: 'https://static.atlasacademy.io/NA/CharaFigure/312/312_face_1.png',
      baseFaceBox: { x: 0.43, y: 0.16, w: 0.15, h: 0.17 },
      emotions: {
        smile: { x: 0, y: 0, w: 128, h: 128 },
        angry: { x: 128, y: 0, w: 128, h: 128 },
        blush: { x: 256, y: 0, w: 128, h: 128 },
        wink: { x: 0, y: 128, w: 128, h: 128 },
        shock: { x: 128, y: 128, w: 128, h: 128 },
        neutral: { x: 256, y: 128, w: 128, h: 128 }
      }
    }
  }
};

/**
 * Resolves expression sheet configuration for a given Servant ID and Ascension Stage
 */
export function resolveStageExpressionConfig(
  servantId: string | number,
  stage: number = 1
): ExpressionStageConfig | null {
  const cleanId = String(servantId).trim();
  const servantMap = SERVANT_EXPRESSIONS[cleanId];
  if (!servantMap) return null;

  return servantMap[stage] || servantMap[1] || null;
}
