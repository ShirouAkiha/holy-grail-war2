import { RaidBossConfig } from '../data/raidBosses';
import { MasterServantInstance } from '../types';
import { normalizeMediaUrl } from '../utils/mediaResolver';
import { getLocalMediaDiskPath } from '../utils/localMedia';
import fs from 'fs';

let canvasModule: any = null;
try {
  canvasModule = require('@napi-rs/canvas');
} catch {
  canvasModule = null;
}

let gifencModule: any = null;
try {
  gifencModule = require('gifenc');
} catch {
  gifencModule = null;
}

let omggifModule: any = null;
try {
  omggifModule = require('omggif');
} catch {
  omggifModule = null;
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
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      set fillStyle(_: any) {},
      set strokeStyle(_: any) {},
      set lineWidth(_: any) {},
      set font(_: any) {},
      set textAlign(_: any) {}
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

function drawRoundRect(
  ctx: any,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill = false,
  stroke = true
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

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
}

async function extractGifFrames(url: string, sampleCount = 10): Promise<any[]> {
  if (!omggifModule) return [];
  const buffer = await fetchImageBuffer(url);
  if (!buffer) return [];

  try {
    const reader = new omggifModule.GifReader(buffer);
    const total = reader.numFrames();
    if (total <= 1) return [];

    const width = reader.width;
    const height = reader.height;

    const frameIndices: number[] = [];
    for (let i = 0; i < sampleCount; i++) {
      frameIndices.push(Math.floor((i * total) / sampleCount));
    }

    const compCanvas = createCanvas(width, height);
    const compCtx = compCanvas.getContext('2d');
    const resultCanvases: any[] = [];

    for (let f = 0; f < total; f++) {
      const frameInfo = reader.frameInfo(f);
      const pixelData = new Uint8ClampedArray(width * height * 4);
      reader.decodeAndBlitFrameRGBA(f, pixelData);

      const frameCanvas = createCanvas(width, height);
      const frameCtx = frameCanvas.getContext('2d');
      const imgData = frameCtx.createImageData(width, height);
      imgData.data.set(pixelData);
      frameCtx.putImageData(imgData, 0, 0);

      if (frameInfo.disposal === 2) {
        compCtx.clearRect(frameInfo.x, frameInfo.y, frameInfo.width, frameInfo.height);
      }
      compCtx.drawImage(frameCanvas, 0, 0);

      if (frameIndices.includes(f)) {
        const snap = createCanvas(width, height);
        snap.getContext('2d').drawImage(compCanvas, 0, 0);
        resultCanvases.push(snap);
      }
    }
    return resultCanvases;
  } catch {
    return [];
  }
}

/**
 * Renders a single frame of the FGO Raid Battlefield (640x360 optimized dimensions)
 */
async function renderSingleFrame(state: RaidBattleState, frameIndex: number, loadedImages: any): Promise<any> {
  const width = 640;
  const height = 360;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const { bgImg, bossSpriteImg, bossSpriteFrames, bossAvatarImg, servantAvatars } = loadedImages;

  // 1. Render Background
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, width, height);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#1c1917');
    grad.addColorStop(0.6, '#0c0a09');
    grad.addColorStop(1, '#000000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // Vignette
  const vignette = ctx.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, width * 0.7);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  // 2. Render Boss Sprite (Draw animated frame from extracted GIF frames if available!)
  const activeBossFrame = (bossSpriteFrames && bossSpriteFrames.length > 0)
    ? bossSpriteFrames[frameIndex % bossSpriteFrames.length]
    : bossSpriteImg;

  if (activeBossFrame) {
    ctx.save();
    // Precise crop from 512x512 GIF (sx=10, sy=30, sw=200, sh=430)
    const sx = 10;
    const sy = 30;
    const sw = 200;
    const sh = 430;

    const scale = 0.54;
    const destW = Math.round(sw * scale); // 108px
    const destH = Math.round(sh * scale); // 232px
    const destX = 18;
    const destY = 32;

    // Shadow on temple ground
    ctx.beginPath();
    ctx.ellipse(destX + destW * 0.5, destY + destH - 6, destW * 0.45, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fill();

    ctx.drawImage(
      activeBossFrame,
      sx, sy, sw, sh,
      destX, destY, destW, destH
    );
    ctx.restore();
  }

  // 3. Render Player Servants
  const party = state.participants;
  const startX = 320;
  const availableFormationWidth = 270;
  const slotStep = party.length > 1 ? availableFormationWidth / party.length : 100;

  party.forEach((p, idx) => {
    const avatar = servantAvatars[idx];
    const posX = startX + idx * slotStep + (idx % 2 === 1 ? 20 : 0);
    const posY = 110 + (idx % 2 === 1 ? 15 : -5);

    ctx.save();
    if (p.isDead) ctx.globalAlpha = 0.35;

    // Shadow
    ctx.beginPath();
    ctx.ellipse(posX + 22, posY + 78, 22, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fill();

    const sCardW = 45;
    const sCardH = 65;

    if (idx === state.activeMasterIndex && !p.isDead) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 6;
      drawRoundRect(ctx, posX - 1, posY - 1, sCardW + 2, sCardH + 2, 4, false, true);
      ctx.shadowBlur = 0;
    }

    ctx.save();
    drawRoundRect(ctx, posX, posY, sCardW, sCardH, 3, false, false);
    ctx.clip();
    if (avatar) {
      ctx.drawImage(avatar, posX, posY, sCardW, sCardH);
    } else {
      ctx.fillStyle = '#334155';
      ctx.fillRect(posX, posY, sCardW, sCardH);
    }
    ctx.restore();

    ctx.strokeStyle = p.isDead ? '#ef4444' : '#d4af37';
    ctx.lineWidth = 1;
    drawRoundRect(ctx, posX, posY, sCardW, sCardH, 3, false, true);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(posX, posY + sCardH - 12, sCardW, 12);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Lv.${p.servant.level || 90}`, posX + sCardW / 2, posY + sCardH - 3);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 7px sans-serif';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 2;
    const shortName = (p.servant.nickname || p.servant.template?.name || 'Servant').slice(0, 10);
    ctx.fillText(shortName, posX + sCardW / 2, posY - 4);
    ctx.shadowBlur = 0;

    ctx.restore();
  });

  // 4. Top-Left Boss HUD
  const bossHudX = 12;
  const bossHudY = 12;

  ctx.save();
  ctx.fillStyle = '#1e1b4b';
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1.5;
  drawRoundRect(ctx, bossHudX, bossHudY, 28, 28, 4, true, true);

  if (bossAvatarImg) {
    ctx.save();
    drawRoundRect(ctx, bossHudX + 1, bossHudY + 1, 26, 26, 3, false, false);
    ctx.clip();
    ctx.drawImage(bossAvatarImg, bossHudX + 1, bossHudY + 1, 26, 26);
    ctx.restore();
  }

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(state.boss.servantClass.toUpperCase(), bossHudX + 14, bossHudY + 36);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 7px sans-serif';
  ctx.fillText(`Lv.${state.boss.level} ${state.boss.title.slice(0, 24)}`, bossHudX + 33, bossHudY + 8);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px sans-serif';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 3;
  ctx.fillText(state.boss.name, bossHudX + 33, bossHudY + 20);
  ctx.shadowBlur = 0;

  // Boss HP Bar
  const hpBarX = bossHudX + 33;
  const hpBarY = bossHudY + 23;
  const hpBarW = 190;
  const hpBarH = 10;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, hpBarX, hpBarY, hpBarW, hpBarH, 2, true, true);

  const hpRatio = Math.max(0, Math.min(1, state.bossCurrentHp / state.bossMaxHp));
  if (hpRatio > 0) {
    const hpGrad = ctx.createLinearGradient(hpBarX, 0, hpBarX + hpBarW * hpRatio, 0);
    hpGrad.addColorStop(0, '#a855f7');
    hpGrad.addColorStop(0.5, '#ec4899');
    hpGrad.addColorStop(1, '#ef4444');
    ctx.fillStyle = hpGrad;
    drawRoundRect(ctx, hpBarX + 1, hpBarY + 1, Math.max(2, (hpBarW - 2) * hpRatio), hpBarH - 2, 2, true, false);
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(
    `${Math.round(state.bossCurrentHp).toLocaleString()} / ${state.bossMaxHp.toLocaleString()}`,
    hpBarX + hpBarW - 4,
    hpBarY + 8
  );

  // Boss Charge Diamonds
  const chargeStartX = hpBarX;
  const chargeStartY = hpBarY + 14;
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Charge', chargeStartX, chargeStartY + 5);

  for (let c = 0; c < state.boss.maxCharge; c++) {
    const dX = chargeStartX + 32 + c * 10;
    const dY = chargeStartY + 2;
    const isCharged = c < state.bossCharge;

    ctx.save();
    ctx.translate(dX, dY);
    ctx.rotate(Math.PI / 4);

    if (isCharged) {
      ctx.fillStyle = state.bossCharge >= state.boss.maxCharge ? '#ef4444' : '#e11d48';
      ctx.strokeStyle = '#fecdd3';
      ctx.lineWidth = 1;
      ctx.fillRect(-3, -3, 6, 6);
      ctx.strokeRect(-3, -3, 6, 6);
    } else {
      ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.fillRect(-3, -3, 6, 6);
      ctx.strokeRect(-3, -3, 6, 6);
    }
    ctx.restore();
  }

  ctx.restore();

  // 5. Top-Right Battle HUD
  ctx.save();
  const trX = width - 130;
  const trY = 12;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, trX, trY, 118, 34, 4, true, true);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('BATTLE 1/1', trX + 8, trY + 13);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 7px sans-serif';
  ctx.fillText(`TURN ${state.round} Turn(s)`, trX + 8, trY + 25);

  ctx.fillStyle = '#f43f5e';
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('DEMON GOD RAID', trX + 110, trY + 13);

  ctx.restore();

  // 6. Bottom HUD (Servant Status Cards)
  const bottomH = 95;
  const bottomY = height - bottomH - 5;
  const bottomW = width - 20;
  const cardStartX = 10;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, cardStartX, bottomY, bottomW, bottomH, 6, true, true);

  const numParticipants = Math.max(1, Math.min(4, party.length));
  const attackBtnAreaWidth = 70;
  const partyCardsTotalWidth = bottomW - attackBtnAreaWidth - 10;
  const singleCardWidth = Math.floor(partyCardsTotalWidth / numParticipants) - 5;

  for (let i = 0; i < numParticipants; i++) {
    const p = party[i];
    const cX = cardStartX + 6 + i * (singleCardWidth + 5);
    const cY = bottomY + 6;
    const cW = singleCardWidth;
    const cH = bottomH - 12;

    ctx.save();
    const isActive = i === state.activeMasterIndex && !p.isDead;

    ctx.fillStyle = p.isDead ? 'rgba(30, 41, 59, 0.5)' : isActive ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = p.isDead ? '#64748b' : isActive ? '#fbbf24' : '#475569';
    ctx.lineWidth = isActive ? 1.5 : 1;
    drawRoundRect(ctx, cX, cY, cW, cH, 4, true, true);

    const avatar = servantAvatars[i];
    const thumbSize = 28;
    const thumbX = cX + 4;
    const thumbY = cY + 4;

    ctx.save();
    drawRoundRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 3, false, false);
    ctx.clip();
    if (avatar) {
      ctx.drawImage(avatar, thumbX, thumbY, thumbSize, thumbSize);
    } else {
      ctx.fillStyle = '#334155';
      ctx.fillRect(thumbX, thumbY, thumbSize, thumbSize);
    }
    ctx.restore();

    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    drawRoundRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 3, false, true);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 6px sans-serif';
    const sClass = p.servant.template?.servantClass || 'Saber';
    ctx.fillText(`${sClass.toUpperCase()} Lv.${p.servant.level || 90}`, thumbX + thumbSize + 4, cY + 9);

    ctx.fillStyle = p.isDead ? '#94a3b8' : '#ffffff';
    ctx.font = 'bold 7px sans-serif';
    const servName = (p.servant.nickname || p.servant.template?.name || 'Servant').slice(0, 11);
    ctx.fillText(servName, thumbX + thumbSize + 4, cY + 18);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '6px sans-serif';
    ctx.fillText(`M: ${p.username.slice(0, 10)}`, thumbX + thumbSize + 4, cY + 26);

    // Skill Badges
    const skillStartX = thumbX + thumbSize + 4;
    const skillY = cY + 28;
    const skillBoxSize = 11;

    for (let s = 0; s < 3; s++) {
      const sX = skillStartX + s * (skillBoxSize + 3);
      const cd = p.skillCooldowns?.[s] || 0;
      const isAvailable = cd === 0 && !p.isDead;

      ctx.fillStyle = isAvailable ? '#0284c7' : '#334155';
      ctx.strokeStyle = isAvailable ? '#38bdf8' : '#64748b';
      ctx.lineWidth = 0.5;
      drawRoundRect(ctx, sX, skillY, skillBoxSize, skillBoxSize, 2, true, true);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 5px sans-serif';
      ctx.textAlign = 'center';
      if (cd > 0) {
        ctx.fillText(`${cd}T`, sX + skillBoxSize / 2, skillY + 8);
      } else {
        ctx.fillText(`S${s + 1}`, sX + skillBoxSize / 2, skillY + 8);
      }
    }

    // HP Bar
    const hpX = cX + 4;
    const hpY = cY + 43;
    const hpW = cW - 8;
    const hpH = 9;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 0.5;
    drawRoundRect(ctx, hpX, hpY, hpW, hpH, 2, true, true);

    const pHpRatio = Math.max(0, Math.min(1, p.currentHp / p.maxHp));
    if (pHpRatio > 0) {
      const pGrad = ctx.createLinearGradient(hpX, 0, hpX + hpW * pHpRatio, 0);
      pGrad.addColorStop(0, '#10b981');
      pGrad.addColorStop(1, '#059669');
      ctx.fillStyle = pGrad;
      drawRoundRect(ctx, hpX + 0.5, hpY + 0.5, Math.max(1, (hpW - 1) * pHpRatio), hpH - 1, 1, true, false);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 5px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`HP`, hpX + 2, hpY + 7);
    ctx.textAlign = 'right';
    ctx.fillText(
      p.isDead ? 'FALLEN' : `${Math.round(p.currentHp)}/${p.maxHp}`,
      hpX + hpW - 2,
      hpY + 7
    );

    // NP Bar
    const npY = hpY + 11;
    const npH = 9;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 0.5;
    drawRoundRect(ctx, hpX, npY, hpW, npH, 2, true, true);

    const pNpRatio = Math.max(0, Math.min(1, (p.npGauge || 0) / 100));
    if (pNpRatio > 0) {
      const npGrad = ctx.createLinearGradient(hpX, 0, hpX + hpW * pNpRatio, 0);
      if (p.npGauge >= 100) {
        npGrad.addColorStop(0, '#fbbf24');
        npGrad.addColorStop(1, '#ef4444');
      } else {
        npGrad.addColorStop(0, '#38bdf8');
        npGrad.addColorStop(1, '#2563eb');
      }
      ctx.fillStyle = npGrad;
      drawRoundRect(ctx, hpX + 0.5, npY + 0.5, Math.max(1, (hpW - 1) * pNpRatio), npH - 1, 1, true, false);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 5px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`NP`, hpX + 2, npY + 7);
    ctx.textAlign = 'right';
    ctx.fillText(
      p.npGauge >= 100 ? '100% READY' : `${Math.round(p.npGauge || 0)}%`,
      hpX + hpW - 2,
      npY + 7
    );

    ctx.restore();
  }

  // 7. Circular ATTACK Button Sphere
  ctx.save();
  const btnCenterX = width - 42;
  const btnCenterY = bottomY + bottomH / 2;
  const btnRadius = 26;

  const ringGrad = ctx.createLinearGradient(btnCenterX - btnRadius, btnCenterY - btnRadius, btnCenterX + btnRadius, btnCenterY + btnRadius);
  ringGrad.addColorStop(0, '#38bdf8');
  ringGrad.addColorStop(0.5, '#0284c7');
  ringGrad.addColorStop(1, '#0369a1');

  ctx.beginPath();
  ctx.arc(btnCenterX, btnCenterY, btnRadius + 2, 0, Math.PI * 2);
  ctx.fillStyle = ringGrad;
  ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const sphereGrad = ctx.createRadialGradient(btnCenterX - 8, btnCenterY - 8, 2, btnCenterX, btnCenterY, btnRadius);
  sphereGrad.addColorStop(0, '#67e8f9');
  sphereGrad.addColorStop(0.6, '#0ea5e9');
  sphereGrad.addColorStop(1, '#0369a1');

  ctx.beginPath();
  ctx.arc(btnCenterX, btnCenterY, btnRadius - 1, 0, Math.PI * 2);
  ctx.fillStyle = sphereGrad;
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'italic bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 3;
  ctx.fillText('Attack', btnCenterX, btnCenterY + 2);

  ctx.font = 'bold 5px sans-serif';
  ctx.fillStyle = '#e0f2fe';
  ctx.fillText('Next Phase', btnCenterX, btnCenterY + 9);
  ctx.shadowBlur = 0;

  ctx.restore();

  return canvas;
}

/**
 * Generates an Animated GIF or PNG buffer for the FGO PvE Raid Battlefield
 */
export async function renderRaidBattlefield(state: RaidBattleState, animated = true): Promise<{ buffer: Buffer; fileName: string }> {
  // Preload all assets
  const [bgImg, bossSpriteImg, bossAvatarImg, bossSpriteFrames, ...servantAvatars] = await Promise.all([
    loadImage(state.boss.bgUrl),
    loadImage(state.boss.spriteUrl),
    loadImage(state.boss.avatarUrl),
    animated ? extractGifFrames(state.boss.spriteUrl, 10) : Promise.resolve([]),
    ...state.participants.map(p => {
      const art = p.servant.customArtworkUrl || p.servant.template?.avatarUrl;
      return art ? loadImage(art) : Promise.resolve(null);
    })
  ]);

  const loadedImages = { bgImg, bossSpriteImg, bossAvatarImg, bossSpriteFrames, servantAvatars };

  // If gifenc is available and we have animated frames, generate a lightweight 640x360 looping GIF attachment for Discord!
  if (animated && gifencModule && typeof gifencModule.GIFEncoder === 'function') {
    try {
      const { GIFEncoder, quantize, applyPalette } = gifencModule;
      const gif = GIFEncoder();

      const frameCount = (bossSpriteFrames && bossSpriteFrames.length > 0) ? bossSpriteFrames.length : 2;

      for (let f = 0; f < frameCount; f++) {
        const frameCanvas = await renderSingleFrame(state, f, loadedImages);
        const w = frameCanvas.width;
        const h = frameCanvas.height;
        const ctx = frameCanvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, w, h);
        const palette = quantize(imgData.data, 128); // 128 colors for lightweight autoplaying GIF
        const index = applyPalette(imgData.data, palette);
        gif.writeFrame(index, w, h, { palette, delay: 120 });
      }

      gif.finish();
      const gifBuffer = Buffer.from(gif.bytes());
      if (gifBuffer && gifBuffer.length > 0) {
        return { buffer: gifBuffer, fileName: 'raid_battlefield.gif' };
      }
    } catch (err) {
      console.error('GIF encoding error, falling back to static PNG:', err);
    }
  }

  // Fallback to high-definition PNG
  const singleCanvas = await renderSingleFrame(state, 0, loadedImages);
  return { buffer: singleCanvas.toBuffer('image/png'), fileName: 'raid_battlefield.png' };
}
