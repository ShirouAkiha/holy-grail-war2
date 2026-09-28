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

export async function renderRaidBattlefield(state: RaidBattleState): Promise<Buffer> {
  const width = 1280;
  const height = 720;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Render Background
  const bgImg = await loadImage(state.boss.bgUrl);
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

  // Vignette overlay
  const vignette = ctx.createRadialGradient(width / 2, height / 2, 200, width / 2, height / 2, width * 0.7);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  // 2. Render Boss Sprite
  const bossSpriteImg = await loadImage(state.boss.spriteUrl);
  if (bossSpriteImg) {
    ctx.save();
    const cfg = state.boss.spriteConfig;
    const cropRatio = cfg.cropRightRatio || 0.52;
    const sWidth = bossSpriteImg.width * cropRatio;
    const sHeight = bossSpriteImg.height;

    const destW = 480 * cfg.scale;
    const destH = 480 * cfg.scale;
    const destX = 40 + cfg.offsetX;
    const destY = 110 + cfg.offsetY;

    // Shadow
    ctx.beginPath();
    ctx.ellipse(destX + destW * 0.45, destY + destH * 0.9, destW * 0.35, 24, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fill();

    ctx.drawImage(
      bossSpriteImg,
      0, 0, sWidth, sHeight,
      destX, destY, destW, destH
    );
    ctx.restore();
  }

  // 3. Render Player Servants
  const party = state.participants;
  const servantAvatars = await Promise.all(
    party.map(p => {
      const art = p.servant.customArtworkUrl || p.servant.template?.avatarUrl;
      return art ? loadImage(art) : Promise.resolve(null);
    })
  );

  const startX = 640;
  const availableFormationWidth = 540;
  const slotStep = party.length > 1 ? availableFormationWidth / party.length : 200;

  party.forEach((p, idx) => {
    const avatar = servantAvatars[idx];
    const posX = startX + idx * slotStep + (idx % 2 === 1 ? 40 : 0);
    const posY = 220 + (idx % 2 === 1 ? 30 : -10);

    ctx.save();
    if (p.isDead) ctx.globalAlpha = 0.35;

    // Shadow
    ctx.beginPath();
    ctx.ellipse(posX + 45, posY + 155, 45, 14, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fill();

    const sCardW = 90;
    const sCardH = 130;

    if (idx === state.activeMasterIndex && !p.isDead) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 12;
      drawRoundRect(ctx, posX - 3, posY - 3, sCardW + 6, sCardH + 6, 8, false, true);
      ctx.shadowBlur = 0;
    }

    ctx.save();
    drawRoundRect(ctx, posX, posY, sCardW, sCardH, 6, false, false);
    ctx.clip();
    if (avatar) {
      ctx.drawImage(avatar, posX, posY, sCardW, sCardH);
    } else {
      ctx.fillStyle = '#334155';
      ctx.fillRect(posX, posY, sCardW, sCardH);
    }
    ctx.restore();

    ctx.strokeStyle = p.isDead ? '#ef4444' : '#d4af37';
    ctx.lineWidth = 2;
    drawRoundRect(ctx, posX, posY, sCardW, sCardH, 6, false, true);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(posX, posY + sCardH - 22, sCardW, 22);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Lv.${p.servant.level || 90}`, posX + sCardW / 2, posY + sCardH - 7);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px sans-serif';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    const shortName = (p.servant.nickname || p.servant.template?.name || 'Servant').slice(0, 12);
    ctx.fillText(shortName, posX + sCardW / 2, posY - 8);
    ctx.shadowBlur = 0;

    ctx.restore();
  });

  // 4. Top-Left Boss HUD
  const bossAvatarImg = await loadImage(state.boss.avatarUrl);
  const bossHudX = 24;
  const bossHudY = 24;

  ctx.save();
  ctx.fillStyle = '#1e1b4b';
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2.5;
  drawRoundRect(ctx, bossHudX, bossHudY, 56, 56, 8, true, true);

  if (bossAvatarImg) {
    ctx.save();
    drawRoundRect(ctx, bossHudX + 2, bossHudY + 2, 52, 52, 6, false, false);
    ctx.clip();
    ctx.drawImage(bossAvatarImg, bossHudX + 2, bossHudY + 2, 52, 52);
    ctx.restore();
  }

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(state.boss.servantClass.toUpperCase(), bossHudX + 28, bossHudY + 68);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`Lv.${state.boss.level}  ${state.boss.title}`, bossHudX + 66, bossHudY + 16);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 6;
  ctx.fillText(state.boss.name, bossHudX + 66, bossHudY + 38);
  ctx.shadowBlur = 0;

  // Boss HP Bar
  const hpBarX = bossHudX + 66;
  const hpBarY = bossHudY + 44;
  const hpBarW = 380;
  const hpBarH = 18;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.5;
  drawRoundRect(ctx, hpBarX, hpBarY, hpBarW, hpBarH, 4, true, true);

  const hpRatio = Math.max(0, Math.min(1, state.bossCurrentHp / state.bossMaxHp));
  if (hpRatio > 0) {
    const hpGrad = ctx.createLinearGradient(hpBarX, 0, hpBarX + hpBarW * hpRatio, 0);
    hpGrad.addColorStop(0, '#a855f7');
    hpGrad.addColorStop(0.5, '#ec4899');
    hpGrad.addColorStop(1, '#ef4444');
    ctx.fillStyle = hpGrad;
    drawRoundRect(ctx, hpBarX + 1, hpBarY + 1, Math.max(4, (hpBarW - 2) * hpRatio), hpBarH - 2, 3, true, false);
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(
    `${Math.round(state.bossCurrentHp).toLocaleString()} / ${state.bossMaxHp.toLocaleString()}`,
    hpBarX + hpBarW - 8,
    hpBarY + 14
  );

  // Boss Charge Diamonds
  const chargeStartX = hpBarX;
  const chargeStartY = hpBarY + 28;
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Charge', chargeStartX, chargeStartY + 9);

  for (let c = 0; c < state.boss.maxCharge; c++) {
    const dX = chargeStartX + 52 + c * 20;
    const dY = chargeStartY + 4;
    const isCharged = c < state.bossCharge;

    ctx.save();
    ctx.translate(dX, dY);
    ctx.rotate(Math.PI / 4);

    if (isCharged) {
      ctx.fillStyle = state.bossCharge >= state.boss.maxCharge ? '#ef4444' : '#e11d48';
      ctx.strokeStyle = '#fecdd3';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-6, -6, 12, 12);
      ctx.strokeRect(-6, -6, 12, 12);
    } else {
      ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-6, -6, 12, 12);
      ctx.strokeRect(-6, -6, 12, 12);
    }
    ctx.restore();
  }

  // Target Indicator
  const targetX = bossHudX + 28;
  const targetY = bossHudY + 95;
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('▼ TARGET ▼', targetX, targetY);

  ctx.restore();

  // 5. Top-Right Battle HUD
  ctx.save();
  const trX = width - 260;
  const trY = 24;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  drawRoundRect(ctx, trX, trY, 236, 68, 8, true, true);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('BATTLE  1/1', trX + 16, trY + 26);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`TURN  ${state.round} Turn(s)`, trX + 16, trY + 50);

  ctx.fillStyle = '#f43f5e';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('DEMON GOD RAID', trX + 220, trY + 26);

  ctx.restore();

  // 6. Bottom HUD (Servant Status Cards)
  const bottomH = 190;
  const bottomY = height - bottomH - 10;
  const bottomW = width - 40;
  const cardStartX = 20;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  drawRoundRect(ctx, cardStartX, bottomY, bottomW, bottomH, 12, true, true);

  const numParticipants = Math.max(1, Math.min(4, party.length));
  const attackBtnAreaWidth = 140;
  const partyCardsTotalWidth = bottomW - attackBtnAreaWidth - 20;
  const singleCardWidth = Math.floor(partyCardsTotalWidth / numParticipants) - 10;

  for (let i = 0; i < numParticipants; i++) {
    const p = party[i];
    const cX = cardStartX + 12 + i * (singleCardWidth + 10);
    const cY = bottomY + 12;
    const cW = singleCardWidth;
    const cH = bottomH - 24;

    ctx.save();
    const isActive = i === state.activeMasterIndex && !p.isDead;

    ctx.fillStyle = p.isDead ? 'rgba(30, 41, 59, 0.5)' : isActive ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = p.isDead ? '#64748b' : isActive ? '#fbbf24' : '#475569';
    ctx.lineWidth = isActive ? 2.5 : 1.5;
    drawRoundRect(ctx, cX, cY, cW, cH, 8, true, true);

    if (isActive) {
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
      ctx.lineWidth = 4;
      drawRoundRect(ctx, cX - 2, cY - 2, cW + 4, cH + 4, 10, false, true);
    }

    const avatar = servantAvatars[i];
    const thumbSize = 58;
    const thumbX = cX + 8;
    const thumbY = cY + 8;

    ctx.save();
    drawRoundRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 6, false, false);
    ctx.clip();
    if (avatar) {
      ctx.drawImage(avatar, thumbX, thumbY, thumbSize, thumbSize);
    } else {
      ctx.fillStyle = '#334155';
      ctx.fillRect(thumbX, thumbY, thumbSize, thumbSize);
    }
    ctx.restore();

    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1.5;
    drawRoundRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 6, false, true);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 11px sans-serif';
    const sClass = p.servant.template?.servantClass || 'Saber';
    ctx.fillText(`${sClass.toUpperCase()} Lv.${p.servant.level || 90}`, thumbX + thumbSize + 8, cY + 18);

    ctx.fillStyle = p.isDead ? '#94a3b8' : '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    const servName = (p.servant.nickname || p.servant.template?.name || 'Servant').slice(0, 14);
    ctx.fillText(servName, thumbX + thumbSize + 8, cY + 34);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText(`M: ${p.username.slice(0, 12)}`, thumbX + thumbSize + 8, cY + 48);

    // 3 Skill Boxes
    const skillStartX = thumbX + thumbSize + 8;
    const skillY = cY + 54;
    const skillBoxSize = 22;

    for (let s = 0; s < 3; s++) {
      const sX = skillStartX + s * (skillBoxSize + 6);
      const cd = p.skillCooldowns?.[s] || 0;
      const isAvailable = cd === 0 && !p.isDead;

      ctx.fillStyle = isAvailable ? '#0284c7' : '#334155';
      ctx.strokeStyle = isAvailable ? '#38bdf8' : '#64748b';
      ctx.lineWidth = 1;
      drawRoundRect(ctx, sX, skillY, skillBoxSize, skillBoxSize, 4, true, true);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      if (cd > 0) {
        ctx.fillText(`${cd}T`, sX + skillBoxSize / 2, skillY + 15);
      } else {
        ctx.fillText(`S${s + 1}`, sX + skillBoxSize / 2, skillY + 15);
      }
    }

    // HP Bar
    const hpX = cX + 8;
    const hpY = cY + 84;
    const hpW = cW - 16;
    const hpH = 16;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    drawRoundRect(ctx, hpX, hpY, hpW, hpH, 3, true, true);

    const pHpRatio = Math.max(0, Math.min(1, p.currentHp / p.maxHp));
    if (pHpRatio > 0) {
      const pGrad = ctx.createLinearGradient(hpX, 0, hpX + hpW * pHpRatio, 0);
      pGrad.addColorStop(0, '#10b981');
      pGrad.addColorStop(1, '#059669');
      ctx.fillStyle = pGrad;
      drawRoundRect(ctx, hpX + 1, hpY + 1, Math.max(2, (hpW - 2) * pHpRatio), hpH - 2, 2, true, false);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`HP`, hpX + 4, hpY + 12);
    ctx.textAlign = 'right';
    ctx.fillText(
      p.isDead ? 'FALLEN' : `${Math.round(p.currentHp).toLocaleString()}/${p.maxHp.toLocaleString()}`,
      hpX + hpW - 4,
      hpY + 12
    );

    // NP Bar
    const npY = hpY + 20;
    const npH = 16;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    drawRoundRect(ctx, hpX, npY, hpW, npH, 3, true, true);

    const pNpRatio = Math.max(0, Math.min(1, (p.npGauge || 0) / 100));
    if (pNpRatio > 0) {
      const npGrad = ctx.createLinearGradient(hpX, 0, hpX + hpW * pNpRatio, 0);
      if (p.npGauge >= 100) {
        npGrad.addColorStop(0, '#fbbf24');
        npGrad.addColorStop(0.5, '#f59e0b');
        npGrad.addColorStop(1, '#ef4444');
      } else {
        npGrad.addColorStop(0, '#38bdf8');
        npGrad.addColorStop(1, '#2563eb');
      }
      ctx.fillStyle = npGrad;
      drawRoundRect(ctx, hpX + 1, npY + 1, Math.max(2, (hpW - 2) * pNpRatio), npH - 2, 2, true, false);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`NP`, hpX + 4, npY + 12);
    ctx.textAlign = 'right';
    ctx.fillText(
      p.npGauge >= 100 ? '★ 100% NP READY ★' : `${Math.round(p.npGauge || 0)}%`,
      hpX + hpW - 4,
      npY + 12
    );

    ctx.restore();
  }

  // 7. Circular ATTACK Button Sphere
  ctx.save();
  const btnCenterX = width - 85;
  const btnCenterY = bottomY + bottomH / 2;
  const btnRadius = 54;

  const ringGrad = ctx.createLinearGradient(btnCenterX - btnRadius, btnCenterY - btnRadius, btnCenterX + btnRadius, btnCenterY + btnRadius);
  ringGrad.addColorStop(0, '#38bdf8');
  ringGrad.addColorStop(0.5, '#0284c7');
  ringGrad.addColorStop(1, '#0369a1');

  ctx.beginPath();
  ctx.arc(btnCenterX, btnCenterY, btnRadius + 4, 0, Math.PI * 2);
  ctx.fillStyle = ringGrad;
  ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.stroke();

  const sphereGrad = ctx.createRadialGradient(btnCenterX - 15, btnCenterY - 15, 5, btnCenterX, btnCenterY, btnRadius);
  sphereGrad.addColorStop(0, '#67e8f9');
  sphereGrad.addColorStop(0.6, '#0ea5e9');
  sphereGrad.addColorStop(1, '#0369a1');

  ctx.beginPath();
  ctx.arc(btnCenterX, btnCenterY, btnRadius - 2, 0, Math.PI * 2);
  ctx.fillStyle = sphereGrad;
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'italic bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 6;
  ctx.fillText('Attack', btnCenterX, btnCenterY + 4);

  ctx.font = 'bold 9px sans-serif';
  ctx.fillStyle = '#e0f2fe';
  ctx.fillText('Next Phase', btnCenterX, btnCenterY + 18);
  ctx.shadowBlur = 0;

  ctx.restore();

  return canvas.toBuffer('image/png');
}
