import { RaidBossConfig } from '../data/raidBosses';
import { MasterServantInstance } from '../types';
import { normalizeMediaUrl } from '../utils/mediaResolver';
import { getLocalMediaDiskPath } from '../utils/localMedia';
import { getClassIconUrl } from '../data/classIcons';
import fs from 'fs';

let canvasModule: any = null;
try {
  canvasModule = require('@napi-rs/canvas');
} catch {
  canvasModule = null;
}

export const MINIMAL_VALID_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

function createCanvas(width: number, height: number): any {
  if (canvasModule && typeof canvasModule.createCanvas === 'function') {
    return canvasModule.createCanvas(width, height);
  }
  return {
    getContext: () => ({
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      fillRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      quadraticCurveTo: () => {},
      closePath: () => {},
      stroke: () => {},
      fill: () => {},
      save: () => {},
      restore: () => {},
      clip: () => {},
      drawImage: () => {},
      fillText: () => {},
      measureText: () => ({ width: 0 }),
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      set fillStyle(_: any) {},
      set strokeStyle(_: any) {},
      set lineWidth(_: any) {},
      set font(_: any) {},
      set textAlign(_: any) {},
      set textBaseline(_: any) {},
      set shadowColor(_: any) {},
      set shadowBlur(_: any) {}
    }),
    toBuffer: (_type?: string) => MINIMAL_VALID_PNG
  };
}

const imageBufferCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60;

async function fetchImageBuffer(url: string, retries = 2): Promise<Buffer | null> {
  const cached = imageBufferCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.buffer;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        }
      });
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        if (buffer && buffer.length > 0) {
          imageBufferCache.set(url, { buffer, timestamp: Date.now() });
          return buffer;
        }
      }
    } catch {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 200));
      }
    }
  }
  return null;
}

async function loadImage(src: string): Promise<any> {
  if (!src || typeof src !== 'string') return null;
  const targetUrl = normalizeMediaUrl(src.trim());
  if (!targetUrl) return null;

  if (canvasModule && typeof canvasModule.loadImage === 'function') {
    try {
      const diskPath = getLocalMediaDiskPath(targetUrl);
      if (diskPath && fs.existsSync(diskPath)) {
        try {
          const localBuffer = fs.readFileSync(diskPath);
          return await canvasModule.loadImage(localBuffer);
        } catch {
          return await canvasModule.loadImage(diskPath);
        }
      }
      if (targetUrl.startsWith('data:') || !targetUrl.startsWith('http')) {
        return await canvasModule.loadImage(targetUrl);
      }
      const buffer = await fetchImageBuffer(targetUrl);
      if (buffer && buffer.length > 0) {
        return await canvasModule.loadImage(buffer);
      }
      return await canvasModule.loadImage(targetUrl).catch(() => null);
    } catch {
      return null;
    }
  }
  return null;
}

// ==========================================
// Helper Drawing Primitives & Vector Skill Icons
// ==========================================

function drawRoundRect(
  ctx: any,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number | { tl?: number; tr?: number; br?: number; bl?: number },
  fill = false,
  stroke = true
) {
  let tl = 0, tr = 0, br = 0, bl = 0;
  if (typeof radius === 'number') {
    tl = tr = br = bl = radius;
  } else {
    tl = radius.tl || 0;
    tr = radius.tr || 0;
    br = radius.br || 0;
    bl = radius.bl || 0;
  }

  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + width - tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + tr);
  ctx.lineTo(x + width, y + height - br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - br, y + height);
  ctx.lineTo(x + bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function drawDiamond(
  ctx: any,
  cx: number,
  cy: number,
  size: number,
  fillStyle: any,
  strokeStyle: any,
  lineWidth = 1
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.moveTo(0, -size / 2);
  ctx.lineTo(size / 2, 0);
  ctx.lineTo(0, size / 2);
  ctx.lineTo(-size / 2, 0);
  ctx.closePath();

  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.restore();
}

function drawProgressBar(
  ctx: any,
  x: number,
  y: number,
  width: number,
  height: number,
  current: number,
  max: number,
  fillGrad: any,
  bgFill = 'rgba(15, 23, 42, 0.95)',
  borderColor = '#64748b'
) {
  ctx.save();
  // Dark Background Track
  ctx.fillStyle = bgFill;
  ctx.fillRect(x, y, width, height);

  // Border frame
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);

  // End Bracket Metallic Accent Trims (< [BAR] >)
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(x - 3, y - 1, 3, height + 2);
  ctx.fillRect(x + width, y - 1, 3, height + 2);

  // Fill Ratio
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  if (ratio > 0) {
    ctx.fillStyle = fillGrad;
    ctx.fillRect(x + 1, y + 1, Math.max(1, (width - 2) * ratio), height - 2);

    // Subtle highlight line on top half of bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(x + 1, y + 1, Math.max(1, (width - 2) * ratio), Math.floor((height - 2) / 2));
  }
  ctx.restore();
}

/**
 * Draws an authentic 4-pointed Fate/Grand Order Critical Star with radiant golden facets
 */
function drawFGOCritStar(
  ctx: any,
  cx: number,
  cy: number,
  size: number
) {
  ctx.save();
  const rOuter = size;
  const rInner = size * 0.32;

  // Outer Golden Glow
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 8;

  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const angleOuter = (i * Math.PI) / 2;
    const angleInner = angleOuter + Math.PI / 4;
    const ox = cx + Math.cos(angleOuter) * rOuter;
    const oy = cy + Math.sin(angleOuter) * rOuter;
    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);

    const ix = cx + Math.cos(angleInner) * rInner;
    const iy = cy + Math.sin(angleInner) * rInner;
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();

  const starGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rOuter);
  starGrad.addColorStop(0, '#ffffff');
  starGrad.addColorStop(0.35, '#fef08a');
  starGrad.addColorStop(0.8, '#f59e0b');
  starGrad.addColorStop(1, '#b45309');
  ctx.fillStyle = starGrad;
  ctx.fill();

  // White Diamond Core Sparkle
  ctx.beginPath();
  const coreSize = size * 0.35;
  ctx.moveTo(cx, cy - coreSize);
  ctx.lineTo(cx + coreSize, cy);
  ctx.lineTo(cx, cy + coreSize);
  ctx.lineTo(cx - coreSize, cy);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.restore();
}

/**
 * Draws an authentic Fate/Grand Order Skill Frame with crisp vector symbols
 */
function drawFGOSkillIcon(
  ctx: any,
  x: number,
  y: number,
  size: number,
  skillIndex: number,
  cooldownTurns: number,
  isDead: boolean
) {
  ctx.save();

  // 1. Outer Golden Frame
  const goldGrad = ctx.createLinearGradient(x, y, x + size, y + size);
  goldGrad.addColorStop(0, '#fef08a');
  goldGrad.addColorStop(0.3, '#f59e0b');
  goldGrad.addColorStop(0.8, '#b45309');
  goldGrad.addColorStop(1, '#78350f');

  ctx.fillStyle = goldGrad;
  ctx.fillRect(x, y, size, size);

  // 2. Inner Skill Background
  const pad = 2.5;
  const innerSize = size - pad * 2;
  const innerX = x + pad;
  const innerY = y + pad;

  const bgGrad = ctx.createLinearGradient(innerX, innerY, innerX, innerY + innerSize);
  if (skillIndex === 0) {
    // Buster / Attack: Fiery Red-Orange
    bgGrad.addColorStop(0, '#ef4444');
    bgGrad.addColorStop(0.5, '#b91c1c');
    bgGrad.addColorStop(1, '#7f1d1d');
  } else if (skillIndex === 1) {
    // Arts / NP Charge: Radiant Blue-Cyan
    bgGrad.addColorStop(0, '#38bdf8');
    bgGrad.addColorStop(0.5, '#2563eb');
    bgGrad.addColorStop(1, '#1e3a8a');
  } else {
    // Quick / Crit / Buff: Amber-Gold / Emerald
    bgGrad.addColorStop(0, '#fbbf24');
    bgGrad.addColorStop(0.5, '#d97706');
    bgGrad.addColorStop(1, '#78350f');
  }

  ctx.fillStyle = bgGrad;
  ctx.fillRect(innerX, innerY, innerSize, innerSize);

  // Inner beveled stroke
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(innerX + 0.5, innerY + 0.5, innerSize - 1, innerSize - 1);

  // 3. Vector Skill Emblem
  ctx.save();
  const cx = innerX + innerSize / 2;
  const cy = innerY + innerSize / 2;

  if (skillIndex === 0) {
    // Skill 1: Diagonal Sword Blade (Attack Up)
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#fef08a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy + 10);
    ctx.lineTo(cx + 8, cy - 8);
    ctx.stroke();

    // Crossguard
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy + 4);
    ctx.lineTo(cx - 4, cy + 12);
    ctx.stroke();

    // Red Buff Arrow at bottom right
    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(innerX + innerSize - 11, innerY + innerSize - 4);
    ctx.lineTo(innerX + innerSize - 11, innerY + innerSize - 12);
    ctx.lineTo(innerX + innerSize - 14, innerY + innerSize - 12);
    ctx.lineTo(innerX + innerSize - 8, innerY + innerSize - 18);
    ctx.lineTo(innerX + innerSize - 2, innerY + innerSize - 12);
    ctx.lineTo(innerX + innerSize - 5, innerY + innerSize - 12);
    ctx.lineTo(innerX + innerSize - 5, innerY + innerSize - 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (skillIndex === 1) {
    // Skill 2: Sunbeam / NP Ray Emitter
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 3, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      ctx.beginPath();
      ctx.moveTo(cx - 3 + Math.cos(angle) * 7, cy - 3 + Math.sin(angle) * 7);
      ctx.lineTo(cx - 3 + Math.cos(angle) * 12, cy - 3 + Math.sin(angle) * 12);
      ctx.stroke();
    }

    // Golden Buff Arrow at bottom right
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(innerX + innerSize - 11, innerY + innerSize - 4);
    ctx.lineTo(innerX + innerSize - 11, innerY + innerSize - 12);
    ctx.lineTo(innerX + innerSize - 14, innerY + innerSize - 12);
    ctx.lineTo(innerX + innerSize - 8, innerY + innerSize - 18);
    ctx.lineTo(innerX + innerSize - 2, innerY + innerSize - 12);
    ctx.lineTo(innerX + innerSize - 5, innerY + innerSize - 12);
    ctx.lineTo(innerX + innerSize - 5, innerY + innerSize - 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // Skill 3: 8-Point Starburst (Crit / Burst)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? 11 : 4.5;
      const a = (i * Math.PI) / 4;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cyan Buff Arrow at bottom right
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(innerX + innerSize - 11, innerY + innerSize - 4);
    ctx.lineTo(innerX + innerSize - 11, innerY + innerSize - 12);
    ctx.lineTo(innerX + innerSize - 14, innerY + innerSize - 12);
    ctx.lineTo(innerX + innerSize - 8, innerY + innerSize - 18);
    ctx.lineTo(innerX + innerSize - 2, innerY + innerSize - 12);
    ctx.lineTo(innerX + innerSize - 5, innerY + innerSize - 12);
    ctx.lineTo(innerX + innerSize - 5, innerY + innerSize - 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // 4. Cooldown Overlay (if on cooldown or servant is dead)
  if (cooldownTurns > 0 || isDead) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fillRect(innerX, innerY, innerSize, innerSize);

    // Cooldown Turns Text
    ctx.fillStyle = '#f87171';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 5;
    ctx.fillText(`${cooldownTurns}T`, cx, cy);
    ctx.shadowBlur = 0;

    // Small Clock icon badge on top left corner
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('⏱', innerX + 10, innerY + 10);
  }

  ctx.restore();
}

const CLASS_SYMBOLS: Record<string, string> = {
  Saber: '⚔️',
  Archer: '🏹',
  Lancer: '🔱',
  Rider: '🏇',
  Caster: '🔮',
  Assassin: '🗡️',
  Berserker: '💥',
  Ruler: '⚖️',
  Avenger: '🔥',
  Pretender: '🎭',
  MoonCancer: '🌙',
  AlterEgo: '⚡',
  Foreigner: '🌌',
  Shielder: '🛡️'
};

export interface RaidParticipantState {
  userId: string;
  username: string;
  servant: MasterServantInstance;
  currentHp: number;
  maxHp: number;
  npGauge: number;
  critStars?: number;
  skillCooldowns: number[];
  activeBuffs?: { name: string; type: string; value: number; remainingTurns: number }[];
  isDead?: boolean;
  master?: any;
  currentHand?: ('Buster' | 'Arts' | 'Quick')[];
  drawPile?: ('Buster' | 'Arts' | 'Quick')[];
  commandSeals?: number;
  totalDamageDealt?: number;
  totalDamageTaken?: number;
  gutsTriggeredThisTurn?: boolean;
}

export interface RaidBattleState {
  boss: RaidBossConfig;
  bossCurrentHp: number;
  bossMaxHp: number;
  bossCharge: number;
  round: number;
  participants: RaidParticipantState[];
  activeMasterIndex: number;
  recentLogs: string[];
  lastPlayerAttackLog?: string;
  bossBuffs?: { name: string; type: string; value: number; remainingTurns: number }[];
  fullCombatLog?: string[];
  finishingBlow?: {
    userId: string;
    servantName: string;
    damage: number;
    cardChain: string;
    round: number;
  };
  lastEnemyPhase?: {
    skillName?: string;
    skillDesc?: string;
    actionName: string;
    actionTarget?: string;
    strikeDamage: number;
    curseDamage: number;
    totalDamage: number;
    debuffsInflicted: string[];
    bossBuffsGained: string[];
    specialEvents: string[];
  };
}

/**
 * Standard 16:9 Canvas (1280 x 720) Fate/Grand Order Battle Scene Routine
 */
async function renderSingleFrame(state: RaidBattleState, loadedImages: any): Promise<any> {
  const width = 1280;
  const height = 720;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const { bgImg, bossSpriteImg, bossAvatarImg, bossClassIconImg, servantAvatars, servantClassIcons = [] } = loadedImages;

  // ==========================================
  // LAYER 1: Background & Arena Environment
  // ==========================================
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, width, height);
  } else {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#1c1917');
    bgGrad.addColorStop(0.6, '#0c0a09');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  // Atmospheric dark vignette
  const vignette = ctx.createRadialGradient(width / 2, height / 2, 220, width / 2, height / 2, width * 0.72);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  // ==========================================
  // LAYER 2: Field Sprites (Midground)
  // Boss Sprite only on left-to-center field.
  // (No second floating card sprite in the middle!)
  // ==========================================
  if (bossSpriteImg) {
    ctx.save();
    // Source crop from boss sprite
    const sx = 10;
    const sy = 30;
    const sw = 200;
    const sh = 430;

    const scale = 1.08;
    const destW = Math.round(sw * scale); // ~216px
    const destH = Math.round(sh * scale); // ~464px
    const destX = 140;
    const destY = 80;

    // Ground shadow on temple floor
    ctx.beginPath();
    ctx.ellipse(destX + destW * 0.5, destY + destH - 12, destW * 0.48, 16, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fill();

    ctx.drawImage(
      bossSpriteImg,
      sx, sy, sw, sh,
      destX, destY, destW, destH
    );
    ctx.restore();
  }

  // ==========================================
  // LAYER 3: Top HUD (Header Elements)
  // ==========================================

  // 1. Top-Left Boss Status HUD (X: 30, Y: 24)
  const bossHudX = 30;
  const bossHudY = 24;
  const avatarSize = 68;

  ctx.save();
  if (bossClassIconImg) {
    // Authentic FGO Golden Boss Class Emblem Crest
    ctx.drawImage(bossClassIconImg, bossHudX, bossHudY, avatarSize, avatarSize);
  } else {
    // Fallback Diamond Box
    drawDiamond(ctx, bossHudX + avatarSize / 2, bossHudY + avatarSize / 2 + 2, avatarSize + 4, '#1e1b4b', '#d4af37', 2);
    if (bossAvatarImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(bossHudX + avatarSize / 2, bossHudY + avatarSize / 2 + 2, (avatarSize - 6) / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(bossAvatarImg, bossHudX + 3, bossHudY + 5, avatarSize - 6, avatarSize - 6);
      ctx.restore();
    }
  }

  // Boss Class Tag below Diamond
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(state.boss.servantClass.toUpperCase(), bossHudX + avatarSize / 2, bossHudY + avatarSize + 18);

  // Boss Header Texts
  const textStartX = bossHudX + avatarSize + 20;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`Lv.${state.boss.level} ${state.boss.title}`, textStartX, bossHudY + 14);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 5;
  ctx.fillText(state.boss.name, textStartX, bossHudY + 44);
  ctx.shadowBlur = 0;

  // Boss HP Bar (Width: 460px, Height: 26px)
  const bossHpW = 460;
  const bossHpH = 26;
  const bossHpX = textStartX;
  const bossHpY = bossHudY + 52;

  const bossHpGrad = ctx.createLinearGradient(bossHpX, 0, bossHpX + bossHpW, 0);
  bossHpGrad.addColorStop(0, '#9333ea');
  bossHpGrad.addColorStop(0.5, '#db2777');
  bossHpGrad.addColorStop(1, '#ef4444');

  drawProgressBar(ctx, bossHpX, bossHpY, bossHpW, bossHpH, state.bossCurrentHp, state.bossMaxHp, bossHpGrad, 'rgba(15, 23, 42, 0.95)', '#94a3b8');

  // HP Numbers on Boss HP Bar
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `${Math.round(state.bossCurrentHp).toLocaleString()} / ${state.bossMaxHp.toLocaleString()}`,
    bossHpX + bossHpW - 10,
    bossHpY + bossHpH / 2 + 1
  );

  // Boss NP / Charge Gauge (diamonds directly below HP bar)
  const chargeStartX = bossHpX;
  const chargeStartY = bossHpY + 34;
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Charge', chargeStartX, chargeStartY + 12);

  for (let c = 0; c < state.boss.maxCharge; c++) {
    const dX = chargeStartX + 72 + c * 24;
    const dY = chargeStartY + 7;
    const isCharged = c < state.bossCharge;

    const fill = isCharged
      ? (state.bossCharge >= state.boss.maxCharge ? '#ef4444' : '#e11d48')
      : 'rgba(30, 41, 59, 0.85)';
    const stroke = isCharged ? '#fecdd3' : '#94a3b8';

    drawDiamond(ctx, dX, dY, 16, fill, stroke, 1.4);
  }
  ctx.restore();

  // 2. Top-Right Quest Info Box (X: 1015, Y: 24)
  ctx.save();
  const trX = width - 265;
  const trY = 24;
  const trW = 235;
  const trH = 88;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1.5;
  drawRoundRect(ctx, trX, trY, trW, trH, 6, true, true);

  // Top header in info box
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('BATTLE  1/1', trX + 16, trY + 26);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('📦 0', trX + trW - 16, trY + 26);

  // Enemy Remaining
  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ENEMY  Remaining : 1', trX + 16, trY + 50);

  // Turn counter
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`TURN  ${state.round} Turn(s)`, trX + 16, trY + 72);
  ctx.restore();

  // ==========================================
  // LAYER 4: Bottom Player HUD (Anchored Y: 380 to 720)
  // Balanced distribution for 1, 2, 3, or 4 Servants
  // ==========================================
  const party = state.participants;
  const numPart = Math.max(1, Math.min(4, party.length));
  const panelH = 340;
  const panelTopY = 380;

  // Calculate balanced X positions and dynamic panel width
  let panelW = 295;
  let slotXPositions: number[] = [];

  if (numPart === 1) {
    panelW = 380;
    slotXPositions = [450]; // Centered on canvas
  } else if (numPart === 2) {
    panelW = 360;
    slotXPositions = [240, 680];
  } else if (numPart === 3) {
    panelW = 340;
    slotXPositions = [80, 470, 860];
  } else {
    // 4 Servants: perfectly balanced across 1280px canvas
    panelW = 295;
    slotXPositions = [30, 345, 660, 975];
  }

  party.slice(0, 4).forEach((p, i) => {
    const slotX = slotXPositions[i] || (30 + i * (panelW + 20));
    const avatar = servantAvatars[i];
    const isTurnActive = i === state.activeMasterIndex && !p.isDead;

    ctx.save();

    // 1. Portrait Crop (Back of the HUD slot)
    ctx.save();
    // Rounded top corners for HUD slot panel
    drawRoundRect(ctx, slotX, panelTopY, panelW, panelH, { tl: 10, tr: 10, bl: 0, br: 0 }, false, false);
    ctx.clip();

    // Translucent glass base behind the sprite
    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.fillRect(slotX, panelTopY, panelW, panelH);

    // Render Servant Sprite / Character Art (scaled and positioned naturally in the slot)
    if (avatar) {
      const imgW = avatar.width || panelW;
      const imgH = avatar.height || panelH;
      // Scale to comfortably fit the panel with head and upper body visible
      const scale = Math.max(panelW / imgW, (panelH * 0.95) / imgH);
      const drawW = imgW * scale;
      const drawH = imgH * scale;
      const drawX = slotX + (panelW - drawW) / 2;
      const drawY = panelTopY + 8;
      ctx.drawImage(avatar, 0, 0, imgW, imgH, drawX, drawY, drawW, drawH);
    }

    // Authentic FGO Vertical Gradient: Translucent at head -> dark black at bottom status gauges
    const fadeGrad = ctx.createLinearGradient(0, panelTopY, 0, height);
    fadeGrad.addColorStop(0, 'rgba(15, 23, 42, 0.10)');
    fadeGrad.addColorStop(0.35, 'rgba(15, 23, 42, 0.25)');
    fadeGrad.addColorStop(0.60, 'rgba(15, 23, 42, 0.88)');
    fadeGrad.addColorStop(1, 'rgba(5, 8, 18, 0.98)');
    ctx.fillStyle = fadeGrad;
    ctx.fillRect(slotX, panelTopY, panelW, panelH);

    // If Servant is dead, apply subdued desaturation overlay
    if (p.isDead) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.fillRect(slotX, panelTopY, panelW, panelH);
    }

    ctx.restore();

    // Panel Outer Frame Border & Active Glow
    if (isTurnActive) {
      ctx.save();
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      drawRoundRect(ctx, slotX, panelTopY, panelW, panelH, { tl: 10, tr: 10, bl: 0, br: 0 }, false, true);
      ctx.restore();
    } else {
      ctx.strokeStyle = p.isDead ? '#ef4444' : '#475569';
      ctx.lineWidth = 1.2;
      drawRoundRect(ctx, slotX, panelTopY, panelW, panelH, { tl: 10, tr: 10, bl: 0, br: 0 }, false, true);
    }

    // 2. Skill Icons Row (Position: Y: 485)
    const skillBoxSize = numPart >= 4 ? 54 : 64;
    const skillGap = numPart >= 4 ? 8 : 12;
    const totalSkillsW = 3 * skillBoxSize + 2 * skillGap;
    const skillStartX = slotX + (panelW - totalSkillsW) / 2;
    const skillY = 485;

    for (let s = 0; s < 3; s++) {
      const sX = skillStartX + s * (skillBoxSize + skillGap);
      const cd = p.skillCooldowns?.[s] || 0;
      drawFGOSkillIcon(ctx, sX, skillY, skillBoxSize, s, cd, !!p.isDead);
    }

    // 3. Status Bars & Labels (Y: 562 to 715)
    const barW = panelW - 20;
    const barX = slotX + 10;

    // HP Bar (Y: 562, Height: 25px)
    const hpY = 562;
    const hpH = 25;
    const pHpRatio = p.isDead ? 0 : Math.max(0, Math.min(1, p.currentHp / p.maxHp));
    const hpGrad = ctx.createLinearGradient(barX, 0, barX + barW * pHpRatio, 0);
    hpGrad.addColorStop(0, '#0284c7');
    hpGrad.addColorStop(1, '#38bdf8');

    drawProgressBar(ctx, barX, hpY, barW, hpH, p.currentHp, p.maxHp, hpGrad, 'rgba(15, 23, 42, 0.95)', '#94a3b8');

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('HP', barX + 8, hpY + hpH / 2 + 1);

    ctx.textAlign = 'right';
    const hpText = p.isDead ? 'FALLEN' : `${Math.round(p.currentHp).toLocaleString()} / ${p.maxHp.toLocaleString()}`;
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(hpText, barX + barW - 8, hpY + hpH / 2 + 1);
    ctx.restore();

    // NP Bar (Y: 595, Height: 22px)
    const npY = 595;
    const npH = 22;
    const pNpRatio = p.isDead ? 0 : Math.max(0, Math.min(1, (p.npGauge || 0) / 100));
    const npGrad = ctx.createLinearGradient(barX, 0, barX + barW * pNpRatio, 0);
    if (p.npGauge >= 100) {
      npGrad.addColorStop(0, '#fbbf24');
      npGrad.addColorStop(1, '#ef4444');
    } else {
      npGrad.addColorStop(0, '#2563eb');
      npGrad.addColorStop(1, '#38bdf8');
    }

    drawProgressBar(ctx, barX, npY, barW, npH, p.npGauge || 0, 100, npGrad, 'rgba(15, 23, 42, 0.95)', '#64748b');

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('NP', barX + 8, npY + npH / 2 + 1);

    ctx.textAlign = 'right';
    const npText = p.isDead ? '0%' : (p.npGauge >= 100 ? '100% READY' : `${Math.round(p.npGauge || 0)}%`);
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(npText, barX + barW - 8, npY + npH / 2 + 1);
    ctx.restore();

    // Footer Tag (Y: 626, Height: 85px)
    const footerY = 626;
    const emblemCx = barX + 26;
    const emblemCy = footerY + 44;
    const sClass = p.servant.template?.servantClass || 'Saber';
    const classIconImg = servantClassIcons[i];

    if (classIconImg) {
      // Authentic FGO Golden Class Crest Icon provided by Master
      const iconSize = 52;
      ctx.drawImage(classIconImg, emblemCx - iconSize / 2, emblemCy - iconSize / 2, iconSize, iconSize);
    } else {
      // Fallback Diamond Class Emblem Badge
      const diamondSize = 44;
      const goldGrad = ctx.createLinearGradient(-diamondSize / 2, -diamondSize / 2, diamondSize / 2, diamondSize / 2);
      goldGrad.addColorStop(0, '#fef08a');
      goldGrad.addColorStop(0.5, '#f59e0b');
      goldGrad.addColorStop(1, '#78350f');
      drawDiamond(ctx, emblemCx, emblemCy, diamondSize, goldGrad, '#fef08a', 1.5);
      drawDiamond(ctx, emblemCx, emblemCy, diamondSize - 6, '#0f172a', null, 0);

      ctx.save();
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(CLASS_SYMBOLS[sClass] || '⚔️', emblemCx, emblemCy + 1);
      ctx.restore();
    }

    // Class Name, Level & Servant Name
    const nameX = emblemCx + 34;
    const rawServName = p.servant.nickname || p.servant.template?.name || 'Servant';

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Line 1: Class + Level
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    const classTitle = `${sClass.toUpperCase()}`;
    ctx.fillText(classTitle, nameX, footerY + 20);

    const classWidth = ctx.measureText(classTitle).width;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(` Lv.${p.servant.level || 90}`, nameX + classWidth, footerY + 20);

    // Line 2: Servant Name + Right-Aligned Prominent Crit Star Badge
    const stars = p.critStars || 0;
    const starStr = `${stars}`;

    // Measure Larger Prominent Star Badge dimensions
    ctx.font = 'bold 18px sans-serif';
    const numWidth = ctx.measureText(starStr).width;
    const badgePad = 10;
    const starIconSize = 12;
    const badgeW = Math.max(64, starIconSize * 2 + numWidth + badgePad * 2 + 6);
    const badgeH = 28;
    const badgeY = footerY + 34;

    // Anchor badge to the far right side of the status bar/footer
    const badgeX = barX + barW - badgeW - 2;

    // Available horizontal space for the name (from nameX to badgeX - 8)
    const maxAvailableNameW = badgeX - nameX - 10;
    ctx.font = 'bold 19px sans-serif';
    let servName = rawServName;
    while (ctx.measureText(servName).width > maxAvailableNameW && servName.length > 3) {
      servName = servName.slice(0, -1);
    }
    if (servName.length < rawServName.length) {
      servName = `${servName.trim()}…`;
    }

    // Draw Servant Name cleanly on the left
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 5;
    ctx.fillText(servName, nameX, footerY + 42);

    // Draw Prominent, High-Contrast Golden Crit Star Badge on the Right Side
    ctx.save();
    drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 8, true, true);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.8;
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.stroke();

    // Draw Larger Radiant FGO Vector Star
    const starCx = badgeX + badgePad + starIconSize;
    const starCy = badgeY + badgeH / 2;
    drawFGOCritStar(ctx, starCx, starCy, starIconSize);

    // Draw Bright Bold Star Count Number
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#fef08a';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(starStr, starCx + starIconSize + 6, starCy + 0.5);
    ctx.restore();

    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.restore();
  });

  return canvas;
}

/**
 * Generates a high-definition 1280x720 PNG buffer for the FGO PvE Raid Battlefield
 */
export async function renderRaidBattlefield(state: RaidBattleState, _animated = false): Promise<{ buffer: Buffer; fileName: string }> {
  const bossClassIconUrl = getClassIconUrl(state.boss.servantClass);
  const participantClassIconUrls = state.participants.map(p =>
    getClassIconUrl(p.servant.template?.servantClass || 'Saber')
  );

  // Preload all assets including authentic FGO class icons
  const [bgImg, bossSpriteImg, bossAvatarImg, bossClassIconImg, ...rest] = await Promise.all([
    loadImage(state.boss.bgUrl),
    loadImage(state.boss.spriteUrl),
    loadImage(state.boss.avatarUrl),
    loadImage(bossClassIconUrl),
    ...state.participants.map(p => {
      const art = p.servant.template?.spriteUrl || p.servant.customArtworkUrl || p.servant.template?.avatarUrl;
      return art ? loadImage(art) : Promise.resolve(null);
    }),
    ...participantClassIconUrls.map(url => loadImage(url))
  ]);

  const numPart = state.participants.length;
  const servantAvatars = rest.slice(0, numPart);
  const servantClassIcons = rest.slice(numPart);

  const loadedImages = {
    bgImg,
    bossSpriteImg,
    bossAvatarImg,
    bossClassIconImg,
    servantAvatars,
    servantClassIcons
  };

  // Render pristine 1280x720 PNG frame
  const singleCanvas = await renderSingleFrame(state, loadedImages);
  return { buffer: singleCanvas.toBuffer('image/png'), fileName: 'raid_battlefield.png' };
}
