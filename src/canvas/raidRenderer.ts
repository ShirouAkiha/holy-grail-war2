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

/**
 * Renders a single frame of the FGO Raid Battlefield (640x360 optimized dimensions)
 */
async function renderSingleFrame(state: RaidBattleState, loadedImages: any): Promise<any> {
  const width = 640;
  const height = 360;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const { bgImg, bossSpriteImg, bossAvatarImg, servantAvatars } = loadedImages;

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

  // 2. Render Boss Sprite
  if (bossSpriteImg) {
    ctx.save();
    // Precise crop from boss sprite (sx=10, sy=30, sw=200, sh=430)
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
      bossSpriteImg,
      sx, sy, sw, sh,
      destX, destY, destW, destH
    );
    ctx.restore();
  }

  // 3. Render Player Servants (Standing Arena Sprites on Field)
  const party = state.participants;
  const arenaStartX = 410;
  const arenaStepX = 65;

  party.slice(0, 3).forEach((p, idx) => {
    const avatar = servantAvatars[idx];
    const posX = arenaStartX + idx * arenaStepX;
    const posY = 130 + (idx % 2 === 1 ? 20 : 0);

    ctx.save();
    if (p.isDead) ctx.globalAlpha = 0.35;

    // Ground Shadow under feet
    ctx.beginPath();
    ctx.ellipse(posX + 20, posY + 65, 20, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fill();

    // Small Arena Sprite
    const spriteW = 45;
    const spriteH = 70;

    if (idx === state.activeMasterIndex && !p.isDead) {
      ctx.save();
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      drawRoundRect(ctx, posX - 1, posY - 1, spriteW + 2, spriteH + 2, 4, false, true);
      ctx.restore();
    }

    ctx.save();
    drawRoundRect(ctx, posX, posY, spriteW, spriteH, 4, false, false);
    ctx.clip();
    if (avatar) {
      const imgW = avatar.width || spriteW;
      const imgH = avatar.height || spriteH;
      const imgRatio = imgW / imgH;
      const targetRatio = spriteW / spriteH;
      let sx = 0, sy = 0, sw = imgW, sh = imgH;
      if (imgRatio > targetRatio) {
        sw = imgH * targetRatio;
        sx = (imgW - sw) / 2;
      } else {
        sh = imgW / targetRatio;
        sy = (imgH - sh) / 2;
      }
      ctx.drawImage(avatar, sx, sy, sw, sh, posX, posY, spriteW, spriteH);
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(posX, posY, spriteW, spriteH);
    }
    ctx.restore();

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

  // 6. Bottom Authentic FGO Servant HUD (Matching Reference Image)
  const hudStartColX = 15;
  const hudColW = 190;
  const hudColGap = 18;

  party.slice(0, 3).forEach((p, i) => {
    const cX = hudStartColX + i * (hudColW + hudColGap);
    const colCenterX = cX + hudColW / 2;
    const avatar = servantAvatars[i];

    ctx.save();

    // Servant Bust Artwork Portrait inside HUD Column
    const portraitW = 125;
    const portraitH = 115;
    const portraitX = colCenterX - portraitW / 2;
    const portraitY = 165;

    ctx.save();
    if (p.isDead) ctx.globalAlpha = 0.35;
    if (avatar) {
      const imgW = avatar.width || portraitW;
      const imgH = avatar.height || portraitH;
      const imgRatio = imgW / imgH;
      const targetRatio = portraitW / portraitH;
      let sx = 0, sy = 0, sw = imgW, sh = imgH;
      if (imgRatio > targetRatio) {
        sw = imgH * targetRatio;
        sx = (imgW - sw) / 2;
      } else {
        sh = imgW / targetRatio;
        sy = (imgH - sh) / 2;
      }
      ctx.drawImage(avatar, sx, sy, sw, sh, portraitX, portraitY, portraitW, portraitH);
    }
    ctx.restore();

    // Turn Active Glow
    if (i === state.activeMasterIndex && !p.isDead) {
      ctx.save();
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      drawRoundRect(ctx, cX, 238, hudColW, 118, 6, false, true);
      ctx.restore();
    }

    // a. 3 Skill Icons Row
    const skillBoxSize = 22;
    const skillGap = 4;
    const totalSkillsW = 3 * skillBoxSize + 2 * skillGap;
    const skillStartX = colCenterX - totalSkillsW / 2;
    const skillY = 248;

    const skillBgGradients = ['#9a3412', '#1e3a8a', '#854d0e']; // Buster / Arts / Quick
    const skillSymbols = ['⚔️', '✨', '💥'];

    for (let s = 0; s < 3; s++) {
      const sX = skillStartX + s * (skillBoxSize + skillGap);
      const cd = p.skillCooldowns?.[s] || 0;
      const isAvailable = cd === 0 && !p.isDead;

      ctx.save();
      // Outer FGO Frame
      ctx.fillStyle = isAvailable ? skillBgGradients[s] : '#1e293b';
      ctx.fillRect(sX, skillY, skillBoxSize, skillBoxSize);

      ctx.strokeStyle = isAvailable ? '#f59e0b' : '#64748b';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(sX, skillY, skillBoxSize, skillBoxSize);

      // Skill Symbol
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(skillSymbols[s], sX + skillBoxSize / 2, skillY + skillBoxSize / 2);

      // Cooldown Clock Overlay
      if (cd > 0 || p.isDead) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
        ctx.fillRect(sX, skillY, skillBoxSize, skillBoxSize);

        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 8px sans-serif';
        ctx.fillText(`⏱️${cd}`, sX + skillBoxSize / 2, skillY + skillBoxSize / 2);
      }
      ctx.restore();
    }

    // b. Authentic FGO HP Bar
    const barW = hudColW - 12;
    const barX = colCenterX - barW / 2;
    const hpY = 276;
    const hpH = 13;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.fillRect(barX, hpY, barW, hpH);

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, hpY, barW, hpH);

    // End Bracket Accent Trims
    ctx.fillStyle = '#d1d5db';
    ctx.fillRect(barX - 2, hpY, 2, hpH);
    ctx.fillRect(barX + barW, hpY, 2, hpH);

    const pHpRatio = p.isDead ? 0 : Math.max(0, Math.min(1, p.currentHp / p.maxHp));
    if (pHpRatio > 0) {
      const pGrad = ctx.createLinearGradient(barX, 0, barX + barW * pHpRatio, 0);
      pGrad.addColorStop(0, '#0284c7');
      pGrad.addColorStop(1, '#38bdf8');
      ctx.fillStyle = pGrad;
      ctx.fillRect(barX + 1, hpY + 1, Math.max(1, (barW - 2) * pHpRatio), hpH - 2);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('HP', barX + 4, hpY + hpH / 2);

    ctx.textAlign = 'right';
    ctx.font = 'bold 8px sans-serif';
    const hpText = p.isDead ? 'FALLEN' : Math.round(p.currentHp).toLocaleString();
    ctx.fillText(hpText, barX + barW - 4, hpY + hpH / 2);
    ctx.restore();

    // c. Authentic FGO NP Bar
    const npY = 292;
    const npH = 11;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.fillRect(barX, npY, barW, npH);

    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, npY, barW, npH);

    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(barX - 2, npY, 2, npH);
    ctx.fillRect(barX + barW, npY, 2, npH);

    const pNpRatio = p.isDead ? 0 : Math.max(0, Math.min(1, (p.npGauge || 0) / 100));
    if (pNpRatio > 0) {
      const npGrad = ctx.createLinearGradient(barX, 0, barX + barW * pNpRatio, 0);
      if (p.npGauge >= 100) {
        npGrad.addColorStop(0, '#fbbf24');
        npGrad.addColorStop(1, '#ef4444');
      } else {
        npGrad.addColorStop(0, '#2563eb');
        npGrad.addColorStop(1, '#38bdf8');
      }
      ctx.fillStyle = npGrad;
      ctx.fillRect(barX + 1, npY + 1, Math.max(1, (barW - 2) * pNpRatio), npH - 2);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('NP', barX + 4, npY + npH / 2);

    ctx.textAlign = 'right';
    ctx.font = 'bold 8px sans-serif';
    const npText = p.isDead ? '0%' : `${Math.round(p.npGauge || 0)}%`;
    ctx.fillText(npText, barX + barW - 4, npY + npH / 2);
    ctx.restore();

    // d. Bottom Class Emblem Diamond & Servant Name Ribbon
    const ribbonY = 308;
    const classEmblemX = barX + 10;
    const classEmblemY = ribbonY + 12;
    const size = 18;

    // Diamond Class Emblem Badge
    ctx.save();
    ctx.translate(classEmblemX, classEmblemY);
    ctx.beginPath();
    ctx.moveTo(0, -size / 2);
    ctx.lineTo(size / 2, 0);
    ctx.lineTo(0, size / 2);
    ctx.lineTo(-size / 2, 0);
    ctx.closePath();

    const goldGrad = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2);
    goldGrad.addColorStop(0, '#fef08a');
    goldGrad.addColorStop(0.5, '#f59e0b');
    goldGrad.addColorStop(1, '#78350f');
    ctx.fillStyle = goldGrad;
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1;
    ctx.stroke();

    const innerSize = size - 4;
    ctx.beginPath();
    ctx.moveTo(0, -innerSize / 2);
    ctx.lineTo(innerSize / 2, 0);
    ctx.lineTo(0, innerSize / 2);
    ctx.lineTo(-innerSize / 2, 0);
    ctx.closePath();
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    const sClass = p.servant.template?.servantClass || 'Saber';
    const classSymbols: Record<string, string> = {
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
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(classSymbols[sClass] || '⚔️', 0, 0.5);
    ctx.restore();

    // Class Name & Level + Servant Name
    const nameX = classEmblemX + 13;
    const servName = p.servant.nickname || p.servant.template?.name || 'Servant';

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Line 1: AVENGER Lv.102
    ctx.font = 'bold 8px sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 2;
    const classTitle = `${sClass.toUpperCase()}`;
    ctx.fillText(classTitle, nameX, ribbonY + 2);

    const classWidth = ctx.measureText(classTitle).width;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(` Lv.${p.servant.level || 90}`, nameX + classWidth, ribbonY + 2);

    // Line 2: Jeanne Alter / Oberon / Altria
    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(servName.slice(0, 16), nameX, ribbonY + 12);
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.restore();
  });

  return canvas;
}

/**
 * Generates a PNG buffer for the FGO PvE Raid Battlefield
 */
export async function renderRaidBattlefield(state: RaidBattleState, _animated = false): Promise<{ buffer: Buffer; fileName: string }> {
  // Preload all assets
  const [bgImg, bossSpriteImg, bossAvatarImg, ...servantAvatars] = await Promise.all([
    loadImage(state.boss.bgUrl),
    loadImage(state.boss.spriteUrl),
    loadImage(state.boss.avatarUrl),
    ...state.participants.map(p => {
      const art = p.servant.customArtworkUrl || p.servant.template?.avatarUrl;
      return art ? loadImage(art) : Promise.resolve(null);
    })
  ]);

  const loadedImages = { bgImg, bossSpriteImg, bossAvatarImg, servantAvatars };

  // Render single crisp PNG frame
  const singleCanvas = await renderSingleFrame(state, loadedImages);
  return { buffer: singleCanvas.toBuffer('image/png'), fileName: 'raid_battlefield.png' };
}
