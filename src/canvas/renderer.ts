import { 
  CombatTurnLog, 
  GachaResultItem, 
  HolyGrailWarSession, 
  MasterServantInstance, 
  ActiveCombatant,
  CardType
} from '../types';
import { calculateRadarCoordinates, RadarPoint } from '../engine/customization';
import { SERVANT_DATABASE } from '../data/servants';
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
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour memory cache

async function fetchWithHttpsModule(url: string, maxRedirects = 3): Promise<Buffer | null> {
  try {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? require('https') : require('http');
    if (!client || typeof client.get !== 'function') return null;

    return new Promise((resolve) => {
      try {
        const referer = parsedUrl.hostname.includes('wikia.nocookie.net')
          ? 'https://fategrandorder.fandom.com/'
          : parsedUrl.origin + '/';

        const req = client.get(
          url,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
              'Referer': referer,
              'Connection': 'keep-alive',
            },
            timeout: 10000,
          },
          (res: any) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
              const redirectUrl = new URL(res.headers.location, url).toString();
              return resolve(fetchWithHttpsModule(redirectUrl, maxRedirects - 1));
            }

            if (res.statusCode !== 200) {
              return resolve(null);
            }

            const chunks: Buffer[] = [];
            res.on('data', (chunk: any) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', () => resolve(null));
          }
        );

        req.on('error', () => resolve(null));
        req.on('timeout', () => {
          req.destroy();
          resolve(null);
        });
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

async function fetchImageBuffer(url: string, retries = 2): Promise<Buffer | null> {
  const cached = imageBufferCache.get(url);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.buffer;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const parsedUrl = new URL(url);
      const referer = parsedUrl.hostname.includes('wikia.nocookie.net')
        ? 'https://fategrandorder.fandom.com/'
        : parsedUrl.origin + '/';

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Referer': referer,
          'Connection': 'keep-alive',
        },
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
        await new Promise((r) => setTimeout(r, (attempt + 1) * 150));
      }
    }
  }

  // Fallback to Node native https module if Bun/Node fetch threw ECONNRESET or socket closed
  const httpsBuffer = await fetchWithHttpsModule(url);
  if (httpsBuffer && httpsBuffer.length > 0) {
    imageBufferCache.set(url, { buffer: httpsBuffer, timestamp: Date.now() });
    return httpsBuffer;
  }

  return null;
}

async function loadImage(src: string): Promise<any> {
  if (!src || typeof src !== 'string') return null;
  const targetUrl = normalizeMediaUrl(src.trim());
  if (!targetUrl) return null;

  if (canvasModule && typeof canvasModule.loadImage === 'function') {
    try {
      // 1. Check if it's already a local disk file or /api/media path
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

      // Final fallback attempt
      return await canvasModule.loadImage(targetUrl).catch(() => null);
    } catch {
      return null;
    }
  }
  return null;
}

// Helper to draw a 5-pointed vector star
function drawVectorStar(
  ctx: any,
  cx: number,
  cy: number,
  spikes: number,
  outerRadius: number,
  innerRadius: number,
  fillStyle?: string,
  strokeStyle?: string
) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();

  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.stroke();
  }
}

function drawRoundRect(
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Draw a clean 4-point diamond spark vector (zero unicode emojis).
 */
function drawSparkDiamond(ctx: any, cx: number, cy: number, size: number, color: string) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx + size * 0.35, cy);
  ctx.lineTo(cx, cy + size);
  ctx.lineTo(cx - size * 0.35, cy);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/**
 * Draw crossed swords vector for heraldry & clash indicators (zero unicode emojis).
 */
function drawVectorCrossedSwords(ctx: any, cx: number, cy: number, size: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, size * 0.12);
  ctx.lineCap = 'round';

  // Blade 1 (\)
  ctx.beginPath();
  ctx.moveTo(cx - size, cy - size);
  ctx.lineTo(cx + size, cy + size);
  ctx.stroke();

  // Guard 1
  ctx.beginPath();
  ctx.moveTo(cx + size * 0.35, cy + size * 0.75);
  ctx.lineTo(cx + size * 0.75, cy + size * 0.35);
  ctx.stroke();

  // Blade 2 (/)
  ctx.beginPath();
  ctx.moveTo(cx + size, cy - size);
  ctx.lineTo(cx - size, cy + size);
  ctx.stroke();

  // Guard 2
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.35, cy + size * 0.75);
  ctx.lineTo(cx - size * 0.75, cy + size * 0.35);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw medieval heraldic shield vector (zero unicode emojis).
 */
function drawVectorShield(ctx: any, cx: number, cy: number, w: number, h: number, fillColor: string, strokeColor: string) {
  ctx.save();
  const halfW = w / 2;
  const halfH = h / 2;
  ctx.beginPath();
  ctx.moveTo(cx - halfW, cy - halfH);
  ctx.lineTo(cx + halfW, cy - halfH);
  ctx.lineTo(cx + halfW, cy);
  ctx.quadraticCurveTo(cx + halfW, cy + halfH * 0.75, cx, cy + halfH);
  ctx.quadraticCurveTo(cx - halfW, cy + halfH * 0.75, cx - halfW, cy);
  ctx.closePath();
  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draw padlock vector for locked skills/seals (zero unicode emojis).
 */
function drawVectorLock(ctx: any, cx: number, cy: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  drawRoundRect(ctx, cx - 5, cy - 2, 10, 8, 2);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy - 2, 3.5, Math.PI, 0, false);
  ctx.stroke();
  ctx.restore();
}

/**
  * Draw an image into a target bounding box using object-fit: cover logic.
  * Prevents squishing/stretching regardless of the image's aspect ratio.
  */
function drawImageCover(
  ctx: any,
  img: any,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  if (!img || !img.width || !img.height) return;
  const imgRatio = img.width / img.height;
  const targetRatio = dw / dh;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;

  if (imgRatio > targetRatio) {
    // Image is wider than target frame: crop horizontal overflow
    sw = img.height * targetRatio;
    sx = (img.width - sw) / 2;
  } else {
    // Image is taller than target frame: crop vertical overflow
    sh = img.width / targetRatio;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

// Helper to draw multiline wrapped text
function drawWrappedText(
  ctx: any,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number = 2
) {
  if (!text) return;
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  let linesCount = 0;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      if (linesCount + 1 >= maxLines) {
        ctx.fillText(line.trim() + '...', x, currentY);
        return;
      }
      ctx.fillText(line.trim(), x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
      linesCount++;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
}

/**
 * Draw Tactical Crit Star Reservoir Box (Fate Ether Crit Star Pool)
 */
function drawCritStarBox(
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  starsCount: number,
  isOpponent: boolean = false
) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  drawRoundRect(ctx, x + 2, y + 2, w, h, 8);
  ctx.fill();

  const borderColor = isOpponent ? '#ef4444' : '#38bdf8';
  const glowColor = isOpponent ? 'rgba(239, 68, 68, 0.28)' : 'rgba(56, 189, 248, 0.28)';
  const starColor = isOpponent ? '#f87171' : '#38bdf8';
  const textColor = isOpponent ? '#fca5a5' : '#7dd3fc';

  // Background Gradient
  const bgGrad = ctx.createLinearGradient(x, y, x, y + h);
  if (isOpponent) {
    bgGrad.addColorStop(0, '#24080b');
    bgGrad.addColorStop(0.5, '#140406');
    bgGrad.addColorStop(1, '#0a0203');
  } else {
    bgGrad.addColorStop(0, '#0a1628');
    bgGrad.addColorStop(0.5, '#070e1b');
    bgGrad.addColorStop(1, '#04070e');
  }
  ctx.fillStyle = bgGrad;
  drawRoundRect(ctx, x, y, w, h, 8);
  ctx.fill();

  // Subtle interior grid / scanlines
  ctx.strokeStyle = isOpponent ? 'rgba(239, 68, 68, 0.08)' : 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 1;
  for (let ly = y + 8; ly < y + h; ly += 8) {
    ctx.beginPath();
    ctx.moveTo(x + 4, ly);
    ctx.lineTo(x + w - 4, ly);
    ctx.stroke();
  }

  // Neon Border
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.8;
  drawRoundRect(ctx, x, y, w, h, 8);
  ctx.stroke();

  // Inset hairline
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 0.8;
  drawRoundRect(ctx, x + 2, y + 2, w - 4, h - 4, 6);
  ctx.stroke();

  // 1. Top Header: "ETHER CRIT STARS"
  ctx.fillStyle = textColor;
  ctx.font = 'bold 9.5px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ETHER CRIT STARS', x + w / 2, y + 22);

  // Top divider line
  ctx.strokeStyle = isOpponent ? 'rgba(239, 68, 68, 0.25)' : 'rgba(56, 189, 248, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 30);
  ctx.lineTo(x + w - 6, y + 30);
  ctx.stroke();

  // 2. Center Star Icon & Large Number
  const starCx = x + 28;
  const starCy = y + h / 2 - 4;

  // Star soft glow halo
  const starGlow = ctx.createRadialGradient(starCx, starCy, 2, starCx, starCy, 20);
  starGlow.addColorStop(0, glowColor);
  starGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = starGlow;
  ctx.beginPath();
  ctx.arc(starCx, starCy, 20, 0, Math.PI * 2);
  ctx.fill();

  // Vector star
  drawVectorStar(ctx, starCx, starCy, 5, 12, 6, starColor, isOpponent ? '#fecaca' : '#bae6fd');

  // Large Bold Numeric Star Count
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${starsCount || 0}`, x + 46, starCy + 12);

  // 3. Bottom Subtitle: "ENEMY CRIT RESERVOIR" / "MASTER CRIT RESERVOIR"
  ctx.fillStyle = textColor;
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  const subText = isOpponent ? 'ENEMY CRIT RESERVOIR' : 'MASTER CRIT RESERVOIR';
  ctx.fillText(subText, x + w / 2, y + h - 16);

  ctx.restore();
}

/**
 * Draw Tarot-style Command Card with Filigree Frame, Elemental Radial Gradient, 
 * Sigil Emblem, Order Roman Numeral, Position Stat Bonus, and Real-Time Crit % Badge.
 * (Zero unicode emojis - 100% Canvas vectors)
 */
function drawTarotCommandCard(
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  card: 'Buster' | 'Arts' | 'Quick' | 'NP' | string,
  orderIdx: number,
  critStars: number,
  isQuickFirstLead: boolean
) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  drawRoundRect(ctx, x + 2, y + 2, w, h, 8);
  ctx.fill();

  let gradTop = '#5c1414';
  let gradBottom = '#140404';
  let borderColor = '#ef4444';
  let accentColor = '#fca5a5';
  let ringColor = 'rgba(239, 68, 68, 0.4)';
  let cardTitle = 'BUSTER';
  let letter = 'B';
  let stepMult = orderIdx === 0 ? '1st (+50% DMG)' : orderIdx === 1 ? '2nd (1.2x)' : '3rd (1.4x)';

  if (card === 'Arts') {
    gradTop = '#0f2942';
    gradBottom = '#040d16';
    borderColor = '#3b82f6';
    accentColor = '#93c5fd';
    ringColor = 'rgba(59, 130, 246, 0.4)';
    cardTitle = 'ARTS';
    letter = 'A';
    stepMult = orderIdx === 0 ? '1st (+100% NP)' : orderIdx === 1 ? '2nd (1.2x)' : '3rd (1.4x)';
  } else if (card === 'Quick') {
    gradTop = '#064e3b';
    gradBottom = '#02150e';
    borderColor = '#10b981';
    accentColor = '#6ee7b7';
    ringColor = 'rgba(16, 185, 129, 0.4)';
    cardTitle = 'QUICK';
    letter = 'Q';
    stepMult = orderIdx === 0 ? '1st (+STARS)' : orderIdx === 1 ? '2nd (1.2x)' : '3rd (1.4x)';
  } else if (card === 'NP' || card === 'Phantasm') {
    gradTop = '#5c3d05';
    gradBottom = '#160d02';
    borderColor = '#f59e0b';
    accentColor = '#fde047';
    ringColor = 'rgba(245, 158, 11, 0.4)';
    cardTitle = 'N. PHANTASM';
    letter = 'NP';
    stepMult = 'MAX OVERCHARGE';
  }

  // Card Background
  const cGrad = ctx.createLinearGradient(x, y, x, y + h);
  cGrad.addColorStop(0, gradTop);
  cGrad.addColorStop(1, gradBottom);
  ctx.fillStyle = cGrad;
  drawRoundRect(ctx, x, y, w, h, 8);
  ctx.fill();

  // Subtle interior grid / scanlines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  for (let ly = y + 8; ly < y + h; ly += 8) {
    ctx.beginPath();
    ctx.moveTo(x + 4, ly);
    ctx.lineTo(x + w - 4, ly);
    ctx.stroke();
  }

  // Border
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.8;
  drawRoundRect(ctx, x, y, w, h, 8);
  ctx.stroke();

  // Inset hairline
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 0.8;
  drawRoundRect(ctx, x + 2, y + 2, w - 4, h - 4, 6);
  ctx.stroke();

  // Top Step / Roman numeral badge
  const romanNumeral = orderIdx === 0 ? 'I' : orderIdx === 1 ? 'II' : 'III';

  // Roman Numeral Tag (Left of header)
  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(romanNumeral, x + 8, y + 18);

  // Card Title (Center of header)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(cardTitle, x + w / 2 + 4, y + 18);

  // Header bottom divider line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + 26);
  ctx.lineTo(x + w - 4, y + 26);
  ctx.stroke();

  // Center Emblem with Concentric Rings
  const emblemCx = x + w / 2;
  const emblemCy = y + 76;

  // Outer ring
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(emblemCx, emblemCy, 28, 0, Math.PI * 2);
  ctx.stroke();

  // Inner ring
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(emblemCx, emblemCy, 22, 0, Math.PI * 2);
  ctx.stroke();

  // Glowing center letter
  ctx.fillStyle = '#ffffff';
  ctx.font = letter === 'NP' ? 'bold 20px sans-serif' : 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(letter, emblemCx, emblemCy + (letter === 'NP' ? 7 : 10));

  // Multiplier / Effect Text (e.g. "1st (+50% DMG)", "2nd (1.2x)")
  ctx.fillStyle = accentColor;
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(stepMult, emblemCx, y + 124);

  // Bottom Crit Star Footer Pill (e.g. "★ CRIT 16%")
  const footerH = 22;
  const footerY = y + h - footerH - 6;
  const footerW = w - 12;
  const footerX = x + 6;

  ctx.fillStyle = 'rgba(10, 15, 26, 0.85)';
  drawRoundRect(ctx, footerX, footerY, footerW, footerH, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 0.8;
  drawRoundRect(ctx, footerX, footerY, footerW, footerH, 4);
  ctx.stroke();

  if (card === 'NP' || card === 'Phantasm') {
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 9.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NOBLE CARD', footerX + footerW / 2, footerY + 15);
  } else {
    const critPercent = Math.min(100, Math.max(0, (critStars || 0) * 2));
    drawVectorStar(ctx, footerX + 12, footerY + 11, 5, 4, 2, '#fbbf24');

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`CRIT ${critPercent}%`, footerX + footerW / 2 + 5, footerY + 15);
  }

  ctx.restore();
}

/**
 * Draw Compact Command Card for 2v2 / 1v2 Multi-Combat Grid (76x124)
 */
function drawCompactCommandCard(
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  card: 'Buster' | 'Arts' | 'Quick' | 'NP' | string,
  orderIdx: number,
  critStars: number,
  isQuickLead: boolean = false,
  ownerName?: string
) {
  ctx.save();
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  drawRoundRect(ctx, x + 2, y + 2, w, h, 6);
  ctx.fill();

  let gradTop = '#5c1414';
  let gradBottom = '#140404';
  let borderColor = '#ef4444';
  let accentColor = '#fca5a5';
  let ringColor = 'rgba(239, 68, 68, 0.45)';
  let cardTitle = 'BUSTER';
  let letter = 'B';
  let stepMult = orderIdx === 0 ? '1st (+50%)' : orderIdx === 1 ? '2nd (1.2x)' : '3rd (1.4x)';

  if (card === 'Arts') {
    gradTop = '#0f2942';
    gradBottom = '#040d16';
    borderColor = '#3b82f6';
    accentColor = '#93c5fd';
    ringColor = 'rgba(59, 130, 246, 0.45)';
    cardTitle = 'ARTS';
    letter = 'A';
    stepMult = orderIdx === 0 ? '1st (+100%)' : orderIdx === 1 ? '2nd (1.2x)' : '3rd (1.4x)';
  } else if (card === 'Quick') {
    gradTop = '#064e3b';
    gradBottom = '#02150e';
    borderColor = '#10b981';
    accentColor = '#6ee7b7';
    ringColor = 'rgba(16, 185, 129, 0.45)';
    cardTitle = 'QUICK';
    letter = 'Q';
    stepMult = orderIdx === 0 ? '1st (+STAR)' : orderIdx === 1 ? '2nd (1.2x)' : '3rd (1.4x)';
  } else if (card === 'NP' || card === 'Phantasm') {
    gradTop = '#5c3d05';
    gradBottom = '#160d02';
    borderColor = '#f59e0b';
    accentColor = '#fde047';
    ringColor = 'rgba(245, 158, 11, 0.5)';
    cardTitle = 'NP';
    letter = 'NP';
    stepMult = 'MAX CHG';
  }

  // Card Background
  const cGrad = ctx.createLinearGradient(x, y, x, y + h);
  cGrad.addColorStop(0, gradTop);
  cGrad.addColorStop(1, gradBottom);
  ctx.fillStyle = cGrad;
  drawRoundRect(ctx, x, y, w, h, 6);
  ctx.fill();

  // Border & Inset Hairline
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.4;
  drawRoundRect(ctx, x, y, w, h, 6);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 0.8;
  drawRoundRect(ctx, x + 2, y + 2, w - 4, h - 4, 4);
  ctx.stroke();

  // Top header: Roman Numeral + Card Type Title
  const romanNumeral = orderIdx === 0 ? 'I' : orderIdx === 1 ? 'II' : 'III';
  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 9.5px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(romanNumeral, x + 5, y + 13);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 8.5px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(cardTitle, x + w - 5, y + 13);

  // Divider
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + 18);
  ctx.lineTo(x + w - 4, y + 18);
  ctx.stroke();

  // Center Emblem with Concentric Rings
  const emblemCx = x + w / 2;
  const emblemCy = y + 54;

  // Outer ring
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(emblemCx, emblemCy, 19, 0, Math.PI * 2);
  ctx.stroke();

  // Inner ring
  ctx.beginPath();
  ctx.arc(emblemCx, emblemCy, 15, 0, Math.PI * 2);
  ctx.stroke();

  // Glowing center letter
  ctx.fillStyle = '#ffffff';
  ctx.font = letter === 'NP' ? 'bold 13px sans-serif' : 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(letter, emblemCx, emblemCy + (letter === 'NP' ? 5 : 7));

  // Step Multiplier Text
  ctx.fillStyle = accentColor;
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(stepMult, emblemCx, y + 87);

  // Bottom Pill: Crit %
  const footerH = 17;
  const footerY = y + h - footerH - 4;
  const footerW = w - 8;
  const footerX = x + 4;

  ctx.fillStyle = 'rgba(10, 15, 26, 0.88)';
  drawRoundRect(ctx, footerX, footerY, footerW, footerH, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 0.6;
  drawRoundRect(ctx, footerX, footerY, footerW, footerH, 3);
  ctx.stroke();

  if (card === 'NP') {
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NOBLE NP', footerX + footerW / 2, footerY + 12);
  } else {
    const critPercent = Math.min(100, Math.max(0, (critStars || 0) * 2));
    drawVectorStar(ctx, footerX + 9, footerY + 8.5, 5, 3.5, 1.8, '#fbbf24');
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`CRIT ${critPercent}%`, footerX + footerW / 2 + 4, footerY + 12);
  }

  ctx.restore();
}

/**
 * Draw Compact Crit Star Reservoir Card for 2v2 / 1v2 Grid (68x124)
 */
function drawCompactCritStarCard(
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  starsCount: number,
  isOpponent: boolean = false,
  unitLabel: string = 'UNIT'
) {
  ctx.save();
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  drawRoundRect(ctx, x + 2, y + 2, w, h, 6);
  ctx.fill();

  const starColor = '#fbbf24';
  const glowColor = isOpponent ? 'rgba(244, 63, 94, 0.35)' : 'rgba(56, 189, 248, 0.35)';
  const borderColor = isOpponent ? '#f43f5e' : '#38bdf8';
  const textColor = isOpponent ? '#fda4af' : '#7dd3fc';

  // Card Background
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, '#090d16');
  grad.addColorStop(0.5, '#05070e');
  grad.addColorStop(1, '#0c101d');
  ctx.fillStyle = grad;
  drawRoundRect(ctx, x, y, w, h, 6);
  ctx.fill();

  // Border
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.3;
  drawRoundRect(ctx, x, y, w, h, 6);
  ctx.stroke();

  // Inset hairline
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 0.8;
  drawRoundRect(ctx, x + 2, y + 2, w - 4, h - 4, 4);
  ctx.stroke();

  // Top header label: STARS
  ctx.fillStyle = textColor;
  ctx.font = 'bold 8.5px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CRIT STARS', x + w / 2, y + 14);

  // Top divider
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + 20);
  ctx.lineTo(x + w - 4, y + 20);
  ctx.stroke();

  // Center Glowing Star Vector
  const starCx = x + w / 2;
  const starCy = y + 48;

  const starGlow = ctx.createRadialGradient(starCx, starCy, 2, starCx, starCy, 16);
  starGlow.addColorStop(0, glowColor);
  starGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = starGlow;
  ctx.beginPath();
  ctx.arc(starCx, starCy, 16, 0, Math.PI * 2);
  ctx.fill();

  drawVectorStar(ctx, starCx, starCy, 5, 9, 4.5, starColor, isOpponent ? '#fecaca' : '#bae6fd');

  // Large Bold Numeric Star Count
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${starsCount || 0}`, starCx, y + 86);

  // Bottom Unit Identifier Pill
  const footerH = 17;
  const footerY = y + h - footerH - 4;
  const footerW = w - 8;
  const footerX = x + 4;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  drawRoundRect(ctx, footerX, footerY, footerW, footerH, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 0.6;
  drawRoundRect(ctx, footerX, footerY, footerW, footerH, 3);
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.font = 'bold 7.5px sans-serif';
  ctx.textAlign = 'center';
  const cleanLabel = unitLabel.length > 8 ? unitLabel.slice(0, 7) + '…' : unitLabel;
  ctx.fillText(cleanLabel.toUpperCase(), footerX + footerW / 2, footerY + 12);

  ctx.restore();
}

/**
 * Draw Servant Portrait Frame with Ornate Heraldic Fallback (zero unicode emojis).
 */
function drawServantPortraitCard(
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  img: any,
  servant: ActiveCombatant,
  accentColor: string
) {
  ctx.save();
  ctx.fillStyle = '#090d16';
  drawRoundRect(ctx, x, y, w, h, 8);
  ctx.fill();

  const innerX = x + 2;
  const innerY = y + 2;
  const innerW = w - 4;
  const innerH = h - 4;

  if (img) {
    ctx.save();
    drawRoundRect(ctx, innerX, innerY, innerW, innerH, 6);
    ctx.clip();
    drawImageCover(ctx, img, innerX, innerY, innerW, innerH);
    ctx.restore();

    // Subtle bottom glass class badge
    const badgeW = innerW - 20;
    const badgeH = 22;
    const badgeX = innerX + 10;
    const badgeY = innerY + innerH - badgeH - 8;

    ctx.fillStyle = 'rgba(10, 15, 26, 0.85)';
    drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 0.8;
    drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
    ctx.stroke();

    const sClass = (servant.servantClass || 'SABER').toUpperCase();
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sClass, badgeX + badgeW / 2, badgeY + 15);
  } else {
    // Ornate Heraldic Velvet Fallback
    const velvetGrad = ctx.createRadialGradient(
      innerX + innerW / 2, innerY + innerH / 2, 10,
      innerX + innerW / 2, innerY + innerH / 2, innerW * 0.8
    );
    velvetGrad.addColorStop(0, '#1e293b');
    velvetGrad.addColorStop(0.6, '#0f172a');
    velvetGrad.addColorStop(1, '#050811');
    ctx.fillStyle = velvetGrad;
    drawRoundRect(ctx, innerX, innerY, innerW, innerH, 6);
    ctx.fill();

    const cy = innerY + Math.round(innerH * 0.38);

    // Runic aura circle
    ctx.beginPath();
    ctx.arc(innerX + innerW / 2, cy, 42, 0, Math.PI * 2);
    ctx.strokeStyle = `${accentColor}33`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Heraldic Shield Vector
    drawVectorShield(ctx, innerX + innerW / 2, cy, 54, 64, `${accentColor}22`, accentColor);

    // Crossed Swords Vector
    drawVectorCrossedSwords(ctx, innerX + innerW / 2, cy, 16, '#ffffff');

    // Servant Class Ribbon
    const sClass = (servant.servantClass || 'SABER').toUpperCase();
    ctx.fillStyle = accentColor;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sClass, innerX + innerW / 2, cy + 56);

    // Servant Name
    const sName = (servant.name || 'Heroic Spirit').slice(0, 16);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(sName, innerX + innerW / 2, cy + 80);

    // Corner Filigree Accents
    drawSparkDiamond(ctx, innerX + 8, innerY + 8, 3, accentColor);
    drawSparkDiamond(ctx, innerX + innerW - 8, innerY + 8, 3, accentColor);
    drawSparkDiamond(ctx, innerX + 8, innerY + innerH - 8, 3, accentColor);
    drawSparkDiamond(ctx, innerX + innerW - 8, innerY + innerH - 8, 3, accentColor);
  }

  // Refined Dark Metallic Border (No neon glow)
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.6;
  drawRoundRect(ctx, x, y, w, h, 8);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 0.8;
  drawRoundRect(ctx, x + 2, y + 2, w - 4, h - 4, 6);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw Minimalist Floating Damage Clash Banner (Option A - Zero redundant text).
 */
function drawMinimalClashBanner(
  ctx: any,
  log: CombatTurnLog,
  p1: ActiveCombatant,
  p2: ActiveCombatant,
  x: number = 16,
  y: number = 290,
  w: number = 608,
  h: number = 54,
  formatBadge: string = 'CLASH'
) {
  ctx.save();
  // 1. Sleek Dark Obsidian Glass Banner
  const bgGrad = ctx.createLinearGradient(x, y, x + w, y + h);
  bgGrad.addColorStop(0, '#0c1220');
  bgGrad.addColorStop(0.5, '#131b2e');
  bgGrad.addColorStop(1, '#0c1220');
  ctx.fillStyle = bgGrad;
  drawRoundRect(ctx, x, y, w, h, 8);
  ctx.fill();

  // Subtle Metallic Border (no neon glow)
  ctx.strokeStyle = log.isNoblePhantasm ? '#d97706' : log.isCritical ? '#b91c1c' : '#334155';
  ctx.lineWidth = 1.5;
  drawRoundRect(ctx, x, y, w, h, 8);
  ctx.stroke();

  // Inset hairline
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 0.8;
  drawRoundRect(ctx, x + 2, y + 2, w - 4, h - 4, 6);
  ctx.stroke();

  // 2. Left Turn Badge Pill
  const turnX = x + 12;
  const turnY = y + 12;
  const turnW = 82;
  const turnH = 30;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  drawRoundRect(ctx, turnX, turnY, turnW, turnH, 5);
  ctx.fill();
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 1.2;
  drawRoundRect(ctx, turnX, turnY, turnW, turnH, 5);
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`T${log.turnNumber || 1} • ${formatBadge}`, turnX + turnW / 2, turnY + 19);

  // 3. Center Damage Text & Cinematic Dialogue (High-contrast, bold and prominent)
  const dmg = log.damageDealt > 0 ? log.damageDealt.toLocaleString() : '0';
  const centerX = x + w / 2 - 10;
  ctx.textAlign = 'center';

  const rawQuote = (log.dialogueQuote || '').trim().replace(/^["“'❝*]+|["”'❞*]+$/g, '');
  const quoteText = rawQuote.length > 38 ? rawQuote.substring(0, 37) + '…' : rawQuote;

  if (quoteText) {
    // Two-tier display: Quote above, damage / action decree below
    ctx.font = 'italic bold 12px sans-serif';
    if (log.dialogueTag?.includes('COMMAND SEAL') || log.actionSummary?.toLowerCase().includes('command seal')) {
      ctx.fillStyle = '#fb7185';
      ctx.fillText(`“${quoteText}”`, centerX, y + 21);
    } else if (log.dialogueTag?.includes('SKILL') || log.actionSummary?.toLowerCase().includes('activated')) {
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`“${quoteText}”`, centerX, y + 21);
    } else {
      ctx.fillStyle = '#fde047';
      ctx.fillText(`“${quoteText}”`, centerX, y + 21);
    }

    if (log.isEvaded || (log.damageDealt === 0 && (log.actionSummary?.toLowerCase().includes('evaded') || log.actionSummary?.toLowerCase().includes('evade')))) {
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('ATTACK EVADED! (0 DMG)', centerX, y + 39);
    } else if (log.isInvincible || (log.damageDealt === 0 && log.actionSummary?.toLowerCase().includes('invincible'))) {
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#fde047';
      ctx.fillText('INVINCIBLE! (0 DMG)', centerX, y + 39);
    } else if (log.damageDealt > 0) {
      ctx.font = 'bold 15px sans-serif';
      if (log.isNoblePhantasm) {
        ctx.fillStyle = '#fde047';
        ctx.fillText(`NOBLE PHANTASM: ${dmg} DAMAGE!`, centerX, y + 39);
      } else if (log.isCritical) {
        ctx.fillStyle = '#f87171';
        ctx.fillText(`CRITICAL STRIKE: ${dmg} DAMAGE!`, centerX, y + 39);
      } else {
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(`DEALT ${dmg} DAMAGE!`, centerX, y + 39);
      }
    } else if (log.dialogueTag?.includes('COMMAND SEAL') || log.actionSummary?.toLowerCase().includes('command seal')) {
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#f43f5e';
      ctx.fillText('COMMAND SEAL: NP REFILLED TO 100%', centerX, y + 39);
    } else if (log.dialogueTag?.includes('SKILL') || log.actionSummary?.toLowerCase().includes('activated')) {
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('TACTICAL SKILL ACTIVATED!', centerX, y + 39);
    } else {
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`DEALT ${dmg} DAMAGE!`, centerX, y + 39);
    }
  } else {
    // Single-tier display when no dialogue quote is available
    if (log.isEvaded || (log.damageDealt === 0 && (log.actionSummary?.toLowerCase().includes('evaded') || log.actionSummary?.toLowerCase().includes('evade')))) {
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('ATTACK EVADED! (0 DMG)', centerX, y + 33);
    } else if (log.isInvincible || (log.damageDealt === 0 && log.actionSummary?.toLowerCase().includes('invincible'))) {
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = '#fde047';
      ctx.fillText('INVINCIBLE! (0 DMG)', centerX, y + 33);
    } else if (log.isNoblePhantasm) {
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = '#fde047';
      ctx.fillText(`NOBLE PHANTASM: ${dmg} DAMAGE!`, centerX, y + 33);
    } else if (log.isCritical) {
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = '#f87171';
      ctx.fillText(`CRITICAL STRIKE: ${dmg} DAMAGE!`, centerX, y + 33);
    } else if (log.damageDealt > 0) {
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(`DEALT ${dmg} DAMAGE!`, centerX, y + 33);
    } else if (log.actionSummary?.toLowerCase().includes('command seal')) {
      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = '#f43f5e';
      ctx.fillText('COMMAND SEAL: NP REFILLED TO 100%', centerX, y + 33);
    } else if (log.actionSummary?.toLowerCase().includes('activated')) {
      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('TACTICAL SKILL ACTIVATED!', centerX, y + 33);
    } else {
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(`DEALT ${dmg} DAMAGE!`, centerX, y + 33);
    }
  }

  // 4. Right Tactical Gains (+NP & +Stars)
  const statsX = x + w - 16;
  ctx.textAlign = 'right';
  ctx.font = 'bold 11px sans-serif';

  const npGain = log.npCharged || 0;
  const starGain = log.starsGenerated || 0;

  ctx.fillStyle = '#fbbf24';
  ctx.fillText(`+${npGain}% NP`, statsX, y + 22);

  ctx.fillStyle = '#38bdf8';
  ctx.fillText(`+${starGain} Stars`, statsX, y + 38);

  ctx.restore();
}

/**
 * Draw Cinematic Clash Resolution Theater (zero unicode emojis - 100% Canvas vectors).
 */
function drawCinematicClashTheater(
  ctx: any,
  log: CombatTurnLog,
  p1: ActiveCombatant,
  p2: ActiveCombatant,
  p1Cards: ('Buster' | 'Arts' | 'Quick' | 'NP')[]
) {
  const boxX = 18;
  const boxY = 236;
  const boxW = 604;
  const boxH = 200;

  ctx.save();
  // 1. Deep Space Cosmic / Mystic Backdrop
  const bgGrad = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxH);
  bgGrad.addColorStop(0, '#040714');
  bgGrad.addColorStop(0.5, '#0b0918');
  bgGrad.addColorStop(1, '#05030a');
  ctx.fillStyle = bgGrad;
  drawRoundRect(ctx, boxX, boxY, boxW, boxH, 10);
  ctx.fill();

  // Amber/Gold Outer Frame
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.0;
  drawRoundRect(ctx, boxX, boxY, boxW, boxH, 10);
  ctx.stroke();

  // Inner accent line
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, boxX + 3, boxY + 3, boxW - 6, boxH - 6, 8);
  ctx.stroke();

  // 2. Cinematic Energy Slashes & Epicenter Sparks
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(boxX + 30, boxY + 40);
  ctx.lineTo(boxX + 300, boxY + 115);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(boxX + boxW - 30, boxY + boxH - 40);
  ctx.lineTo(boxX + 340, boxY + 115);
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Radiant Spark Burst at clash point
  drawSparkDiamond(ctx, 320, boxY + 115, 7, '#fbbf24');
  drawSparkDiamond(ctx, 305, boxY + 110, 4, '#ffffff');
  drawSparkDiamond(ctx, 335, boxY + 120, 4, '#ffffff');
  drawSparkDiamond(ctx, 310, boxY + 126, 3, '#38bdf8');
  drawSparkDiamond(ctx, 330, boxY + 104, 3, '#f87171');
  ctx.restore();

  // 3. Header Marquee Ribbon
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, boxX + 12, boxY + 10, boxW - 24, 26, 5);
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.2;
  drawRoundRect(ctx, boxX + 12, boxY + 10, boxW - 24, 26, 5);
  ctx.stroke();

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`[ HOLY GRAIL WAR - TURN ${log.turnNumber} CLASH RESOLUTION ]`, 320, boxY + 27);

  // 4. Combatants Matchup & Chain Sequence Row
  const actorClean = (log.actorName || p1.name).replace(/[^\x00-\x7F]/g, '');
  const targetClean = (log.targetName || p2.name).replace(/[^\x00-\x7F]/g, '');
  const cardsUsed = log.cardsUsed || p1Cards;

  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(actorClean, 280, boxY + 54);

  drawVectorCrossedSwords(ctx, 320, boxY + 50, 8, '#f59e0b');

  ctx.textAlign = 'left';
  ctx.fillStyle = '#f87171';
  ctx.fillText(targetClean, 360, boxY + 54);

  // Card combo mini-badges: [ BUSTER ] > [ ARTS ] > [ BUSTER ]
  const totalCards = Math.min(3, cardsUsed.length);
  const badgeW = 68;
  const badgeH = 18;
  const spacing = 16;
  const startX = 320 - ((totalCards * badgeW + (totalCards - 1) * spacing) / 2);
  const cardRowY = boxY + 65;

  cardsUsed.slice(0, 3).forEach((c, i) => {
    const cx = startX + i * (badgeW + spacing);
    let cColor = '#dc2626';
    if (c === 'Arts') cColor = '#2563eb';
    else if (c === 'Quick') cColor = '#16a34a';
    else if (c === 'NP') cColor = '#d97706';

    ctx.fillStyle = `${cColor}33`;
    drawRoundRect(ctx, cx, cardRowY, badgeW, badgeH, 3);
    ctx.fill();
    ctx.strokeStyle = cColor;
    ctx.lineWidth = 1;
    drawRoundRect(ctx, cx, cardRowY, badgeW, badgeH, 3);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(c.toUpperCase(), cx + badgeW / 2, cardRowY + 12);

    if (i < totalCards - 1) {
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('>', cx + badgeW + spacing / 2, cardRowY + 13);
    }
  });

  // 5. Cinematic Impact / Resolution Banner
  const impactY = boxY + 92;
  const impactH = 46;
  const impactW = boxW - 28;
  const impactX = boxX + 14;

  if (log.isNoblePhantasm) {
    const npGrad = ctx.createLinearGradient(impactX, impactY, impactX + impactW, impactY + impactH);
    npGrad.addColorStop(0, 'rgba(120, 53, 15, 0.85)');
    npGrad.addColorStop(0.5, 'rgba(217, 119, 6, 0.95)');
    npGrad.addColorStop(1, 'rgba(120, 53, 15, 0.85)');
    ctx.fillStyle = npGrad;
    drawRoundRect(ctx, impactX, impactY, impactW, impactH, 6);
    ctx.fill();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1.8;
    drawRoundRect(ctx, impactX, impactY, impactW, impactH, 6);
    ctx.stroke();

    drawSparkDiamond(ctx, impactX + 20, impactY + impactH / 2, 6, '#ffffff');
    drawSparkDiamond(ctx, impactX + impactW - 20, impactY + impactH / 2, 6, '#ffffff');

    const quoteStr = log.dialogueQuote || log.npChant;
    const cleanQuote = quoteStr ? (quoteStr.length > 56 ? quoteStr.slice(0, 54) + '...' : quoteStr) : null;

    ctx.fillStyle = '#fef08a';
    ctx.font = cleanQuote ? 'bold italic 11px sans-serif' : 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cleanQuote ? `“${cleanQuote}”` : '<< NOBLE PHANTASM UNLEASHED AT MAXIMUM OUTPUT >>', 320, impactY + 17);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(`DEALT ${log.damageDealt > 0 ? log.damageDealt.toLocaleString() : '0'} DEVASTATING DAMAGE!`, 320, impactY + 38);
  } else if (log.isCritical) {
    const critGrad = ctx.createLinearGradient(impactX, impactY, impactX + impactW, impactY + impactH);
    critGrad.addColorStop(0, 'rgba(127, 29, 29, 0.85)');
    critGrad.addColorStop(0.5, 'rgba(220, 38, 38, 0.95)');
    critGrad.addColorStop(1, 'rgba(127, 29, 29, 0.85)');
    ctx.fillStyle = critGrad;
    drawRoundRect(ctx, impactX, impactY, impactW, impactH, 6);
    ctx.fill();
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 1.8;
    drawRoundRect(ctx, impactX, impactY, impactW, impactH, 6);
    ctx.stroke();

    drawSparkDiamond(ctx, impactX + 20, impactY + impactH / 2, 6, '#ffffff');
    drawSparkDiamond(ctx, impactX + impactW - 20, impactY + impactH / 2, 6, '#ffffff');

    const quoteStr = log.dialogueQuote || log.npChant;
    const cleanQuote = quoteStr ? (quoteStr.length > 56 ? quoteStr.slice(0, 54) + '...' : quoteStr) : null;

    ctx.fillStyle = '#fca5a5';
    ctx.font = cleanQuote ? 'bold italic 11px sans-serif' : 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cleanQuote ? `“${cleanQuote}”` : '>> CRITICAL STRIKE! DOUBLE DAMAGE DEALT <<', 320, impactY + 17);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(`DEALT ${log.damageDealt > 0 ? log.damageDealt.toLocaleString() : '0'} DAMAGE!`, 320, impactY + 38);
  } else {
    const stdGrad = ctx.createLinearGradient(impactX, impactY, impactX + impactW, impactY + impactH);
    stdGrad.addColorStop(0, 'rgba(15, 23, 42, 0.8)');
    stdGrad.addColorStop(0.5, 'rgba(30, 41, 59, 0.9)');
    stdGrad.addColorStop(1, 'rgba(15, 23, 42, 0.8)');
    ctx.fillStyle = stdGrad;
    drawRoundRect(ctx, impactX, impactY, impactW, impactH, 6);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.4;
    drawRoundRect(ctx, impactX, impactY, impactW, impactH, 6);
    ctx.stroke();

    const quoteStr = log.dialogueQuote || log.npChant;
    if (quoteStr) {
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold italic 11px sans-serif';
      ctx.textAlign = 'center';
      const cleanQuote = quoteStr.length > 62 ? quoteStr.slice(0, 60) + '...' : quoteStr;
      ctx.fillText(`“${cleanQuote}”`, 320, impactY + 16);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Command Seals pulse with etheric energy as weapons clash.', 320, impactY + 16);
    }

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`DEALT ${log.damageDealt > 0 ? log.damageDealt.toLocaleString() : '0'} DAMAGE TO ENEMY`, 320, impactY + 36);
  }

  // 6. Tactical Gains Row (NP Charged & Stars Gathered)
  const statsY = boxY + 154;
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';

  ctx.fillStyle = '#fbbf24';
  ctx.fillText(`+${log.npCharged || 0}% NP CHARGED`, 240, statsY);

  ctx.fillStyle = '#64748b';
  ctx.fillText('|', 320, statsY);

  drawVectorStar(ctx, 350, statsY - 4, 5, 6, 3, '#38bdf8');
  ctx.fillStyle = '#38bdf8';
  ctx.textAlign = 'left';
  ctx.fillText(`+${log.starsGenerated || 0} STARS GATHERED`, 362, statsY);

  // 7. Footer Telemetry Pill (Dual Master Stars)
  const footY = boxY + 166;
  const footW = 460;
  const footX = 320 - footW / 2;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
  drawRoundRect(ctx, footX, footY, footW, 24, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, footX, footY, footW, 24, 12);
  ctx.stroke();

  const p1NameClean = (p1.masterName || 'P1').replace(/[^\x00-\x7F]/g, '');
  const p2NameClean = (p2.masterName || 'P2').replace(/[^\x00-\x7F]/g, '');

  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  drawVectorStar(ctx, 160, footY + 12, 5, 5, 2.5, '#38bdf8');
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(`${p1NameClean}: ${p1.critStars || 0} Stars`, 220, footY + 16);

  ctx.fillStyle = '#64748b';
  ctx.fillText('||', 320, footY + 16);

  drawVectorStar(ctx, 360, footY + 12, 5, 5, 2.5, '#f87171');
  ctx.fillStyle = '#f87171';
  ctx.fillText(`${p2NameClean}: ${p2.critStars || 0} Stars`, 420, footY + 16);

  ctx.restore();
}

/**
 * 1. Render Servant Profile Status Card (800x960 High-Legibility Box Buffer)
 */
export async function renderServantProfileCard(
  servant: MasterServantInstance | any,
  masterName: string
): Promise<Buffer> {
  const canvas = createCanvas(800, 960);
  const ctx = canvas.getContext('2d');

  const templateId = servant.templateId || servant.template?.id || servant.id;
  const canonical = SERVANT_DATABASE.find(
    s => s.id === templateId || 
         (s.name && servant.name && s.name.toLowerCase() === servant.name.toLowerCase()) ||
         (s.name && servant.template?.name && s.name.toLowerCase() === servant.template.name.toLowerCase())
  ) || servant.template || servant;
  
  const isCustom = servant.template?.isCustomOrMeme || canonical?.isCustomOrMeme;
  const t = isCustom ? { ...canonical, ...servant.template } : { ...(canonical || servant.template || servant) };
  const alloc = servant.allocatedStats || { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 };
  const base = canonical?.baseStats || t.baseStats || { strength: 10, endurance: 10, agility: 10, mana: 10, luck: 10 };

  const totalStr = (base.strength || 10) + (alloc.strength || 0);
  const totalEnd = (base.endurance || 10) + (alloc.endurance || 0);
  const totalAgi = (base.agility || 10) + (alloc.agility || 0);
  const totalMna = (base.mana || 10) + (alloc.mana || 0);
  const totalLck = (base.luck || 10) + (alloc.luck || 0);

  const ceBonusAtk = servant.equippedCe?.atkBonus || 0;
  const ceBonusHp = servant.equippedCe?.hpBonus || 0;
  const lvl = servant.level || 1;

  const baseHp = canonical?.baseHp || t.baseHp || 28000;
  const baseAtk = canonical?.baseAtk || t.baseAtk || 10000;
  const totalHp = Math.round(baseHp + totalEnd * 150 + ceBonusHp);
  const totalAtk = Math.round(baseAtk + totalStr * 80 + ceBonusAtk);

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 960);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(0.3, '#0b0f19');
  bgGrad.addColorStop(0.7, '#080c14');
  bgGrad.addColorStop(1, '#020617');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 800, 960);

  // Outer Border
  const borderColor = t.rarity === 5 ? '#f59e0b' : '#38bdf8';
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 3;
  drawRoundRect(ctx, 12, 12, 776, 936, 16);
  ctx.stroke();

  // Top Header Line - Servant Name
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(servant.nickname || t.name || 'Heroic Spirit', 30, 52);

  // Title & Master
  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px sans-serif';
  ctx.fillText(`${t.title || 'Heroic Spirit'} • Master: ${masterName}`, 30, 80);

  // Class Badge & Parity on Right
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText((t.servantClass || 'SABER').toUpperCase(), 770, 52);

  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 12px monospace, sans-serif';
  ctx.fillText('HEROIC SPIRIT • BALANCED', 770, 78);

  // Divider Line
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(30, 96);
  ctx.lineTo(770, 96);
  ctx.stroke();

  // Stats Sub-Header Line (Level, Bond, Stat points)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(`Lv. ${lvl}/100`, 30, 124);

  ctx.fillStyle = '#f472b6';
  ctx.fillText(`Bond Lv. ${servant.bondLevel || 1} ♥`, 165, 124);

  ctx.fillStyle = '#f59e0b';
  ctx.fillText(`Available Stat Points: ${servant.availableStatPoints || 0} pts`, 330, 124);

  // --- TOP-LEFT SECTION: HP/ATK + PARAMETERS + COMMAND DECK ---
  // HP Badge
  ctx.fillStyle = '#111827';
  drawRoundRect(ctx, 30, 142, 220, 62, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(74, 222, 128, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('MAX HP', 44, 166);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(totalHp.toLocaleString(), 44, 194);

  // ATK Badge
  ctx.fillStyle = '#111827';
  drawRoundRect(ctx, 260, 142, 220, 62, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(248, 113, 113, 0.35)';
  ctx.stroke();

  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('TOTAL ATK', 274, 166);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(totalAtk.toLocaleString(), 274, 194);

  // Base Parameters Box
  ctx.fillStyle = '#111827';
  drawRoundRect(ctx, 30, 214, 450, 72, 10);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('BASE PARAMETERS', 44, 236);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`STR: ${totalStr}    END: ${totalEnd}    AGI: ${totalAgi}`, 44, 258);
  ctx.fillText(`MNA: ${totalMna}    LCK: ${totalLck}`, 44, 277);

  // Command Deck
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('COMMAND DECK', 30, 308);

  const commandDeck: CardType[] = t.commandDeck || ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'];
  commandDeck.forEach((card: CardType, idx: number) => {
    const cardX = 30 + idx * 90;
    const cardY = 318;
    ctx.fillStyle = card === 'Buster' ? '#dc2626' : card === 'Arts' ? '#2563eb' : '#16a34a';
    drawRoundRect(ctx, cardX, cardY, 82, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(card, cardX + 41, cardY + 20);
  });

  // --- TOP-RIGHT SECTION: PARAMETER RADAR CHART ---
  const combinedStats = {
    strength: totalStr,
    endurance: totalEnd,
    agility: totalAgi,
    mana: totalMna,
    luck: totalLck
  };
  const radar = calculateRadarCoordinates(combinedStats, 630, 235, 62, 30);

  // Grid background lines
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  [0.35, 0.7, 1.0].forEach((ratio) => {
    ctx.beginPath();
    const rGrid = calculateRadarCoordinates(
      { strength: 30 * ratio, endurance: 30 * ratio, agility: 30 * ratio, mana: 30 * ratio, luck: 30 * ratio },
      630, 235, 62 * ratio, 30
    );
    rGrid.points.forEach((p: RadarPoint, idx: number) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.stroke();
  });

  // Polygon fill
  ctx.beginPath();
  radar.points.forEach((p: RadarPoint, idx: number) => {
    if (idx === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Radar Labels
  ctx.fillStyle = '#f1f5f9';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('STR', 630, 155);
  ctx.fillText('END', 715, 198);
  ctx.fillText('AGI', 685, 320);
  ctx.fillText('MNA', 575, 320);
  ctx.fillText('LCK', 545, 198);

  // --- MIDDLE SECTION: HEROIC SPIRIT SKILLS (ACTIVE & PASSIVE) ---
  ctx.textAlign = 'left';
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('HEROIC SPIRIT SKILLS (ACTIVE & PASSIVE)', 30, 376);

  const defaultSkills = [
    { id: 'sk1', name: 'Mana Burst A', cooldown: 5, description: 'Increases own card effectiveness and combat prowess for 1 turn.', icon: '⚔️' },
    { id: 'sk2', name: 'Charisma B', cooldown: 5, description: 'Increases team attack power and morale for 3 turns.', icon: '👑' },
    { id: 'sk3', name: 'Instinct EX', cooldown: 6, description: 'Grants evasive instincts, gain critical stars and charge NP.', icon: '✨' }
  ];
  const skillsList = (t.skills && t.skills.length > 0) ? t.skills : defaultSkills;

  skillsList.slice(0, 3).forEach((sk: any, idx: number) => {
    const skY = 390 + idx * 84;

    // Skill Card Container
    ctx.fillStyle = '#0f172a';
    drawRoundRect(ctx, 30, skY, 740, 76, 10);
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Skill Header: Icon + Name
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(`${sk.name}`, 46, skY + 28);

    // Cooldown badge on right
    ctx.textAlign = 'right';
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`CD: ${sk.cooldown || 5}T`, 754, skY + 28);

    // Skill Description
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '15px sans-serif';
    drawWrappedText(ctx, sk.description || 'Special Heroic Spirit combat skill.', 46, skY + 54, 708, 20, 2);
  });

  // --- BOTTOM SECTION: NOBLE PHANTASM & CRAFT ESSENCE ---
  // Noble Phantasm Banner
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 30, 648, 740, 138, 10);
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const np = t.noblePhantasm || { name: 'Excalibur', cardType: 'Buster', chant: '...', description: '' };
  const npCardEmoji = np.cardType === 'Arts' ? '🔵' : np.cardType === 'Quick' ? '🟢' : '🔴';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`Noble Phantasm: ${np.name} [${npCardEmoji} ${np.cardType}]`, 46, 678);

  ctx.fillStyle = '#fde047';
  ctx.font = 'italic 15px sans-serif';
  const chant = servant.customQuotes?.noblePhantasm || np.chant || '...';
  drawWrappedText(ctx, `"${chant}"`, 46, 704, 708, 20, 2);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '15px sans-serif';
  const npDesc = np.description ? `${np.description}` : 'Deals massive damage to opponent.';
  drawWrappedText(ctx, npDesc, 46, 750, 708, 20, 2);

  // Craft Essence Banner
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 30, 796, 740, 142, 10);
  ctx.fill();
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#60a5fa';
  ctx.font = 'bold 17px sans-serif';
  const ceName = servant.equippedCe ? servant.equippedCe.name : 'None';
  const ceStatBonus = servant.equippedCe ? ` (+${ceBonusAtk} ATK / +${ceBonusHp} HP)` : '';
  ctx.fillText(`Equipped CE: ${ceName}${ceStatBonus}`, 46, 826);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '15px sans-serif';
  const ceEffect = servant.equippedCe ? servant.equippedCe.effectText : 'No Craft Essence equipped. Use /customise equip to link a sacred relic.';
  drawWrappedText(ctx, ceEffect, 46, 856, 708, 22, 3);

  try {
    return canvas.toBuffer('image/png');
  } catch {
    return MINIMAL_VALID_PNG;
  }
}

/**
 * Helper to draw a crisp Vector Chevron Arrow (Zero missing glyph tofu)
 */
function drawVectorChevronArrow(ctx: any, cx: number, cy: number, color: string = '#fbbf24') {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // First chevron
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy - 7);
  ctx.lineTo(cx - 1, cy);
  ctx.lineTo(cx - 6, cy + 7);
  ctx.stroke();
  // Second chevron
  ctx.beginPath();
  ctx.moveTo(cx + 1, cy - 7);
  ctx.lineTo(cx + 6, cy);
  ctx.lineTo(cx + 1, cy + 7);
  ctx.stroke();
  ctx.restore();
}

/**
 * Helper to draw a crisp Vector Mini Reticle Crosshair (Zero emoji tofu)
 */
function drawMiniReticle(ctx: any, cx: number, cy: number, color: string = '#f87171') {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 7, cy);
  ctx.lineTo(cx + 7, cy);
  ctx.moveTo(cx, cy - 7);
  ctx.lineTo(cx, cy + 7);
  ctx.stroke();
  ctx.restore();
}

/**
 * Helper to draw a Command Card icon
 */
function drawCommandCardIcon(ctx: any, cx: number, cy: number, type: string) {
  ctx.save();
  if (type === 'Buster') {
    drawVectorCrossedSwords(ctx, cx, cy, 13, '#fca5a5');
  } else if (type === 'Arts') {
    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.stroke();
    drawSparkDiamond(ctx, cx, cy, 6, '#60a5fa');
  } else if (type === 'Quick') {
    ctx.strokeStyle = '#6ee7b7';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - 7);
    ctx.lineTo(cx + 5, cy - 7);
    ctx.moveTo(cx - 12, cy);
    ctx.lineTo(cx + 10, cy);
    ctx.moveTo(cx - 7, cy + 7);
    ctx.lineTo(cx + 7, cy + 7);
    ctx.stroke();
  } else {
    // NP Phantasm
    drawVectorShield(ctx, cx, cy, 16, 20, 'rgba(251, 191, 36, 0.4)', '#fde047');
    drawSparkDiamond(ctx, cx, cy - 3, 5, '#ffffff');
  }
  ctx.restore();
}

/**
 * Helper to draw a Command Card Badge
 */
function drawCommandCardBadge(
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  cardType: string,
  stepIndex: number,
  isSurging: boolean = false
) {
  ctx.save();
  // Drop shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  drawRoundRect(ctx, x + 3, y + 3, w, h, 6);
  ctx.fill();

  let gradTop = '#7f1d1d';
  let gradBottom = '#240606';
  let borderColor = '#ef4444';
  let accentColor = '#fca5a5';
  let cardTitle = 'BUSTER';
  let subTag = '+100% ATK';

  if (cardType === 'Arts') {
    gradTop = '#1e3a8a';
    gradBottom = '#081226';
    borderColor = '#3b82f6';
    accentColor = '#93c5fd';
    cardTitle = 'ARTS';
    subTag = '+100% NP';
  } else if (cardType === 'Quick') {
    gradTop = '#064e3b';
    gradBottom = '#02150e';
    borderColor = '#10b981';
    accentColor = '#6ee7b7';
    cardTitle = 'QUICK';
    subTag = '+STARS';
  } else if (cardType === 'NP') {
    gradTop = '#78350f';
    gradBottom = '#240d02';
    borderColor = '#f59e0b';
    accentColor = '#fde047';
    cardTitle = 'PHANTASM';
    subTag = 'FATAL NP';
  }

  // Card Background Gradient
  const cGrad = ctx.createLinearGradient(x, y, x, y + h);
  cGrad.addColorStop(0, isSurging ? '#991b1b' : gradTop);
  cGrad.addColorStop(1, gradBottom);
  ctx.fillStyle = cGrad;
  drawRoundRect(ctx, x, y, w, h, 6);
  ctx.fill();

  // Outer Border (Surging gold pulse if isSurging is true)
  if (isSurging) {
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3;
    drawRoundRect(ctx, x - 1, y - 1, w + 2, h + 2, 7);
    ctx.stroke();
  } else {
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.8;
    drawRoundRect(ctx, x, y, w, h, 6);
    ctx.stroke();
  }

  // Inset hairline
  ctx.strokeStyle = isSurging ? 'rgba(254, 240, 138, 0.4)' : 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 0.8;
  drawRoundRect(ctx, x + 2, y + 2, w - 4, h - 4, 4);
  ctx.stroke();

  // Top step pill: [ 1st ], [ 2nd ], [ 3rd ]
  const stepLabel = stepIndex === 0 ? '1st' : stepIndex === 1 ? '2nd' : '3rd';
  const pillW = 38;
  const pillH = 17;
  const pillX = x + (w - pillW) / 2;
  const pillY = y + 5;
  ctx.fillStyle = isSurging ? 'rgba(254, 240, 138, 0.25)' : 'rgba(0, 0, 0, 0.7)';
  drawRoundRect(ctx, pillX, pillY, pillW, pillH, 4);
  ctx.fill();
  ctx.strokeStyle = isSurging ? '#fde047' : borderColor;
  ctx.lineWidth = 1.2;
  drawRoundRect(ctx, pillX, pillY, pillW, pillH, 4);
  ctx.stroke();

  ctx.fillStyle = isSurging ? '#fef08a' : '#f8fafc';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(stepLabel, pillX + pillW / 2, pillY + 12);

  // Card Icon in center
  drawCommandCardIcon(ctx, x + w / 2, y + 42, cardType);

  // Card Title (Big & Bold)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(cardTitle, x + w / 2, y + 68);

  // SubTag badge at bottom (Legible monospace)
  ctx.fillStyle = accentColor;
  ctx.font = 'bold 10px monospace';
  ctx.fillText(subTag, x + w / 2, y + 84);

  ctx.restore();
}

/**
 * Helper to draw Battlefield Stage Background (Supports Presets & Custom Images)
 */
function drawBattlefieldStage(
  ctx: any,
  width: number,
  height: number,
  bgImg: any = null,
  preset: string = 'fuyuki',
  frameIdx: number = 2
) {
  ctx.save();

  if (bgImg) {
    // Custom Background with tone-mapping vignette
    drawImageCover(ctx, bgImg, 0, 0, width, height);

    const darkGrad = ctx.createLinearGradient(0, 0, 0, height);
    darkGrad.addColorStop(0, 'rgba(8, 4, 3, 0.4)');
    darkGrad.addColorStop(0.5, 'rgba(8, 4, 3, 0.25)');
    darkGrad.addColorStop(1, 'rgba(6, 2, 1, 0.85)');
    ctx.fillStyle = darkGrad;
    ctx.fillRect(0, 0, width, height);
  } else {
    const p = (preset || 'fuyuki').toLowerCase();

    if (p.includes('snow') || p.includes('castle') || p.includes('einzbern')) {
      // Einzbern Twilight Blizzard
      const bGrad = ctx.createLinearGradient(0, 0, 0, height);
      bGrad.addColorStop(0, '#060d1a');
      bGrad.addColorStop(0.6, '#0f1f38');
      bGrad.addColorStop(1, '#02060f');
      ctx.fillStyle = bGrad;
      ctx.fillRect(0, 0, width, height);

      // Distant mountain / pine tree silhouettes
      ctx.fillStyle = 'rgba(4, 9, 18, 0.8)';
      ctx.beginPath();
      ctx.moveTo(0, 240);
      ctx.lineTo(80, 190); ctx.lineTo(160, 245);
      ctx.lineTo(290, 175); ctx.lineTo(410, 245);
      ctx.lineTo(540, 185); ctx.lineTo(680, 250);
      ctx.lineTo(800, 195); ctx.lineTo(800, 320); ctx.lineTo(0, 320);
      ctx.closePath();
      ctx.fill();

      // Falling starry snowflakes
      const snowCount = 28;
      for (let s = 0; s < snowCount; s++) {
        const sx = ((s * 41 + frameIdx * 19) % (width + 40)) - 20;
        const sy = ((s * 33 + frameIdx * 23) % (height + 20)) - 10;
        const size = (s % 3) + 1.2;
        ctx.fillStyle = s % 2 === 0 ? 'rgba(255, 255, 255, 0.85)' : 'rgba(186, 230, 253, 0.65)';
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (p.includes('temple') || p.includes('ryuudou')) {
      // Ryuudou Temple Midnight Misty Ridge
      const tGrad = ctx.createLinearGradient(0, 0, 0, height);
      tGrad.addColorStop(0, '#030712');
      tGrad.addColorStop(0.5, '#0b1329');
      tGrad.addColorStop(1, '#02040a');
      ctx.fillStyle = tGrad;
      ctx.fillRect(0, 0, width, height);

      // Pale Blue Moon Beam in center
      const moonBeam = ctx.createRadialGradient(400, 0, 20, 400, 180, 340);
      moonBeam.addColorStop(0, 'rgba(147, 197, 253, 0.25)');
      moonBeam.addColorStop(0.5, 'rgba(59, 130, 246, 0.08)');
      moonBeam.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = moonBeam;
      ctx.fillRect(0, 0, width, height);

      // Floating sakura spiritual embers
      for (let k = 0; k < 22; k++) {
        const kx = ((k * 53 + frameIdx * 14) % width);
        const ky = ((k * 37 + frameIdx * 16) % 240);
        ctx.fillStyle = 'rgba(244, 114, 182, 0.6)';
        ctx.beginPath();
        ctx.arc(kx, ky, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (p.includes('throne') || p.includes('golden')) {
      // Throne of Heroes Royal Golden Cosmos
      const gGrad = ctx.createLinearGradient(0, 0, width, height);
      gGrad.addColorStop(0, '#100b04');
      gGrad.addColorStop(0.5, '#2e1c07');
      gGrad.addColorStop(1, '#080502');
      ctx.fillStyle = gGrad;
      ctx.fillRect(0, 0, width, height);

      // Shimmering celestial mana ring
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.16)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(400, 140, 190, 0, Math.PI * 2);
      ctx.stroke();

      for (let g = 0; g < 20; g++) {
        const gx = ((g * 67 + frameIdx * 9) % width);
        const gy = ((g * 43) % 230);
        drawSparkDiamond(ctx, gx, gy, 3.5, '#fef08a');
      }
    } else if (p.includes('grail') || p.includes('abyss')) {
      // Greater Grail Cavern Abyss
      const abyssGrad = ctx.createLinearGradient(0, 0, 0, height);
      abyssGrad.addColorStop(0, '#14041b');
      abyssGrad.addColorStop(0.6, '#280638');
      abyssGrad.addColorStop(1, '#09010d');
      ctx.fillStyle = abyssGrad;
      ctx.fillRect(0, 0, width, height);

      // Pulsing dark mana arcs
      ctx.strokeStyle = 'rgba(217, 70, 239, 0.22)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(100, 230);
      ctx.quadraticCurveTo(400, 80, 700, 230);
      ctx.stroke();
    } else {
      // Fuyuki City on Fire (Default iconic Fate battlefield)
      const fGrad = ctx.createLinearGradient(0, 0, 0, height);
      fGrad.addColorStop(0, '#0a0504');
      fGrad.addColorStop(0.45, '#1e0c06');
      fGrad.addColorStop(0.85, '#3b1206');
      fGrad.addColorStop(1, '#1a0603');
      ctx.fillStyle = fGrad;
      ctx.fillRect(0, 0, width, height);

      // Blazing horizon glow
      const fireGlow = ctx.createRadialGradient(400, 240, 20, 400, 220, 360);
      fireGlow.addColorStop(0, 'rgba(239, 68, 68, 0.38)');
      fireGlow.addColorStop(0.45, 'rgba(245, 158, 11, 0.22)');
      fireGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = fireGlow;
      ctx.fillRect(0, 0, width, height);

      // Ruined skyline silhouette
      ctx.fillStyle = 'rgba(10, 4, 3, 0.88)';
      ctx.beginPath();
      ctx.moveTo(0, 235);
      ctx.lineTo(55, 195); ctx.lineTo(110, 235);
      ctx.lineTo(190, 160); ctx.lineTo(260, 235);
      ctx.lineTo(380, 180); ctx.lineTo(460, 235);
      ctx.lineTo(570, 150); ctx.lineTo(650, 235);
      ctx.lineTo(740, 185); ctx.lineTo(800, 235);
      ctx.lineTo(800, 320); ctx.lineTo(0, 320);
      ctx.closePath();
      ctx.fill();

      // Floating burning embers & sparks
      for (let e = 0; e < 24; e++) {
        const ex = ((e * 47 + frameIdx * 18) % (width + 30)) - 15;
        const ey = 250 - ((e * 23 + frameIdx * 28) % 240);
        const radius = (e % 3) + 1.2;
        ctx.fillStyle = e % 2 === 0 ? 'rgba(251, 191, 36, 0.85)' : 'rgba(239, 68, 68, 0.75)';
        ctx.beginPath();
        ctx.arc(ex, ey, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Top Dark Vignette to ground the combat space
  const topVig = ctx.createLinearGradient(0, 0, 0, 80);
  topVig.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  topVig.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = topVig;
  ctx.fillRect(0, 0, width, 80);

  ctx.restore();
}

/**
 * Helper to draw Split-Screen Hovering Attacker (Left Side, 280x340)
 */
function drawHoveringAttacker(
  ctx: any,
  portraitImg: any,
  servantName: string,
  servantClass: string,
  bondOrLevel: number | string = 8,
  frameIdx: number = 0,
  hideLevelBadge: boolean = true
) {
  ctx.save();
  const spriteW = 280;
  const spriteH = 340;
  const spriteX = 10;
  // Sinusoidal floating hover animation (6px vertical breathing float)
  const floatOffsetY = Math.sin((frameIdx / 8) * Math.PI * 2) * 6;
  const spriteY = 10 + floatOffsetY;

  // 1. Golden Amber Spiritual Aura Glow behind Attacker
  const auraGrad = ctx.createRadialGradient(140, 150 + floatOffsetY, 30, 140, 150 + floatOffsetY, 170);
  auraGrad.addColorStop(0, 'rgba(245, 158, 11, 0.28)');
  auraGrad.addColorStop(0.6, 'rgba(217, 119, 6, 0.12)');
  auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = auraGrad;
  ctx.fillRect(spriteX - 20, spriteY, spriteW + 40, spriteH);

  // 2. Render Character Sprite
  ctx.save();
  ctx.beginPath();
  ctx.rect(spriteX, spriteY, spriteW, spriteH);
  ctx.clip();

  if (portraitImg) {
    drawImageCover(ctx, portraitImg, spriteX, spriteY, spriteW, spriteH);
  } else {
    // Heraldic velvet fallback
    const vGrad = ctx.createLinearGradient(spriteX, spriteY, spriteX, spriteY + spriteH);
    vGrad.addColorStop(0, '#2b160a');
    vGrad.addColorStop(1, '#0e0603');
    ctx.fillStyle = vGrad;
    ctx.fillRect(spriteX, spriteY, spriteW, spriteH);

    drawVectorShield(ctx, spriteX + spriteW / 2 - 10, spriteY + 110, 68, 78, 'rgba(245, 158, 11, 0.2)', '#f59e0b');
    drawVectorCrossedSwords(ctx, spriteX + spriteW / 2 - 10, spriteY + 110, 22, '#fbbf24');
  }

  // Right Edge Smooth Fade into Center Clash
  const fadeRight = ctx.createLinearGradient(spriteX + spriteW - 90, spriteY, spriteX + spriteW, spriteY);
  fadeRight.addColorStop(0, 'rgba(10, 5, 3, 0)');
  fadeRight.addColorStop(0.6, 'rgba(10, 5, 3, 0.65)');
  fadeRight.addColorStop(1, 'rgba(10, 5, 3, 0.98)');
  ctx.fillStyle = fadeRight;
  ctx.fillRect(spriteX + spriteW - 90, spriteY, 90, spriteH);

  // Bottom Edge Fade into Dialogue Ribbon
  const fadeBottom = ctx.createLinearGradient(spriteX, spriteY + spriteH - 80, spriteX, spriteY + spriteH);
  fadeBottom.addColorStop(0, 'rgba(10, 5, 3, 0)');
  fadeBottom.addColorStop(1, 'rgba(10, 5, 3, 0.95)');
  ctx.fillStyle = fadeBottom;
  ctx.fillRect(spriteX, spriteY + spriteH - 80, spriteW, 80);

  ctx.restore();

  if (!hideLevelBadge) {
    // 3. Floating Class Crest & Level Badge on Left Shoulder
    const badgeW = 76;
    const badgeH = 22;
    const badgeX = spriteX + 16;
    const badgeY = spriteY + 16;

    ctx.fillStyle = 'rgba(13, 7, 4, 0.88)';
    drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.6;
    drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
    ctx.stroke();

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    const badgeDisplay = typeof bondOrLevel === 'number' ? `Lv.${bondOrLevel}` : `${bondOrLevel}`;
    ctx.fillText(badgeDisplay, badgeX + badgeW / 2, badgeY + 15);
  }

  ctx.restore();
}

/**
 * Helper to draw Split-Screen Hovering Defender (Right Side, 280x340)
 */
function drawHoveringDefender(
  ctx: any,
  defenderImg: any,
  defenderName: string,
  defenderClass: string,
  frameIdx: number = 0,
  hideTargetHUD: boolean = true
) {
  ctx.save();
  const spriteW = 280;
  const spriteH = 340;
  const spriteX = 510;
  // Sinusoidal floating hover animation (5px counter-phase breathing float)
  const floatOffsetY = Math.cos((frameIdx / 8) * Math.PI * 2) * 5;
  const spriteY = 10 + floatOffsetY;

  // 1. Dark Crimson Tactical Combat Aura Glow behind Defender
  const targetAura = ctx.createRadialGradient(660, 150 + floatOffsetY, 30, 660, 150 + floatOffsetY, 170);
  targetAura.addColorStop(0, 'rgba(239, 68, 68, 0.26)');
  targetAura.addColorStop(0.6, 'rgba(185, 28, 28, 0.12)');
  targetAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = targetAura;
  ctx.fillRect(spriteX - 20, spriteY, spriteW + 40, spriteH);

  // 2. Render Defender Sprite
  ctx.save();
  ctx.beginPath();
  ctx.rect(spriteX, spriteY, spriteW, spriteH);
  ctx.clip();

  if (defenderImg) {
    drawImageCover(ctx, defenderImg, spriteX, spriteY, spriteW, spriteH);
  } else {
    // Dark Crimson fallback
    const fbGrad = ctx.createLinearGradient(spriteX, spriteY, spriteX, spriteY + spriteH);
    fbGrad.addColorStop(0, '#2b0909');
    fbGrad.addColorStop(1, '#0e0303');
    ctx.fillStyle = fbGrad;
    ctx.fillRect(spriteX, spriteY, spriteW, spriteH);

    drawVectorShield(ctx, spriteX + spriteW / 2 + 10, spriteY + 110, 68, 78, 'rgba(239, 68, 68, 0.2)', '#ef4444');
    drawVectorCrossedSwords(ctx, spriteX + spriteW / 2 + 10, spriteY + 110, 20, '#f87171');
  }

  // Left Edge Smooth Fade into Center Clash
  const fadeLeft = ctx.createLinearGradient(spriteX, spriteY, spriteX + 90, spriteY);
  fadeLeft.addColorStop(0, 'rgba(10, 5, 3, 0.98)');
  fadeLeft.addColorStop(0.4, 'rgba(10, 5, 3, 0.65)');
  fadeLeft.addColorStop(1, 'rgba(10, 5, 3, 0)');
  ctx.fillStyle = fadeLeft;
  ctx.fillRect(spriteX, spriteY, 90, spriteH);

  // Bottom Edge Fade into Dialogue Ribbon
  const fadeBottom = ctx.createLinearGradient(spriteX, spriteY + spriteH - 80, spriteX, spriteY + spriteH);
  fadeBottom.addColorStop(0, 'rgba(10, 5, 3, 0)');
  fadeBottom.addColorStop(1, 'rgba(10, 5, 3, 0.95)');
  ctx.fillStyle = fadeBottom;
  ctx.fillRect(spriteX, spriteY + spriteH - 80, spriteW, 80);

  // Tactical Scanlines
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.10)';
  ctx.lineWidth = 1;
  for (let ly = spriteY; ly < spriteY + spriteH; ly += 6) {
    ctx.beginPath();
    ctx.moveTo(spriteX, ly);
    ctx.lineTo(spriteX + spriteW, ly);
    ctx.stroke();
  }

  // Tactical Crosshair Reticle over opponent (rotates 45 degrees dynamically every frame)
  if (!hideTargetHUD) {
    const cx = 650;
    const cy = 120;
    const crosshairAngle = (frameIdx * Math.PI) / 4;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(crosshairAngle);

    ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-30, 0); ctx.lineTo(-14, 0);
    ctx.moveTo(14, 0);  ctx.lineTo(30, 0);
    ctx.moveTo(0, -30); ctx.lineTo(0, -14);
    ctx.moveTo(0, 14);  ctx.lineTo(0, 30);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();

  // 3. Floating [ TARGET: LOCKED ] Crimson HUD Badge (Top Right)
  if (!hideTargetHUD) {
    const badgeW = 138;
    const badgeH = 22;
    const badgeX = spriteX + spriteW - badgeW - 16;
    const badgeY = spriteY + 16;

    ctx.fillStyle = 'rgba(127, 29, 29, 0.92)';
    drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
    ctx.stroke();

    drawMiniReticle(ctx, badgeX + 16, badgeY + 11, '#fca5a5');
    ctx.fillStyle = '#fee2e2';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TARGET: LOCKED', badgeX + badgeW / 2 + 7, badgeY + 15);
  }

  if (!hideTargetHUD) {
    // 4. Floating Defender Nameplate
    const nameW = 180;
    const nameH = 34;
    const nameX = spriteX + spriteW - nameW - 16;
    const nameY = spriteY + 44;

    ctx.fillStyle = 'rgba(15, 5, 5, 0.90)';
    drawRoundRect(ctx, nameX, nameY, nameW, nameH, 4);
    ctx.fill();
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 1.2;
    drawRoundRect(ctx, nameX, nameY, nameW, nameH, 4);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    const defDisplay = defenderName.length > 17 ? defenderName.slice(0, 16) + '…' : defenderName;
    ctx.fillText(defDisplay, nameX + nameW / 2, nameY + 14);

    ctx.fillStyle = '#fca5a5';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText((defenderClass || 'Enemy').toUpperCase(), nameX + nameW / 2, nameY + 27);
  }

  ctx.restore();
}

/**
 * Helper to draw Tactical Command Cards & Active Chain HUD in Center
 */
function drawCenterCommandHUD(
  ctx: any,
  chainTagOrTitle: string,
  sequence: ('Buster' | 'Arts' | 'Quick' | 'NP')[],
  frameIdx: number
) {
  ctx.save();

  // Active Chain Banner Pill
  let chainGradTop = '#78350f';
  let chainBorder = '#f59e0b';
  let chainSubtitle = 'Card Resonance Active';

  const tagUpper = (chainTagOrTitle || '').toUpperCase();
  if (tagUpper.includes('BUSTER')) {
    chainGradTop = '#7f1d1d';
    chainBorder = '#ef4444';
    chainSubtitle = 'Buster Power +50% • Guaranteed Extra Strike';
  } else if (tagUpper.includes('ARTS')) {
    chainGradTop = '#1e3a8a';
    chainBorder = '#3b82f6';
    chainSubtitle = 'NP Battery +20% • Arts Resonance Activated';
  } else if (tagUpper.includes('QUICK')) {
    chainGradTop = '#064e3b';
    chainBorder = '#10b981';
    chainSubtitle = 'Critical Stars +20 • Deadly Strike Surge';
  } else if (tagUpper.includes('BRAVE')) {
    chainGradTop = '#581c87';
    chainBorder = '#a855f7';
    chainSubtitle = 'Brave Resonance • Full Sequence Executed';
  }

  const bannerW = 340;
  const bannerH = 36;
  const bannerX = 230;
  const bannerY = 24;

  const bGrad = ctx.createLinearGradient(bannerX, bannerY, bannerX, bannerY + bannerH);
  bGrad.addColorStop(0, chainGradTop);
  bGrad.addColorStop(1, '#110804');
  ctx.fillStyle = bGrad;
  drawRoundRect(ctx, bannerX, bannerY, bannerW, bannerH, 4);
  ctx.fill();

  ctx.strokeStyle = chainBorder;
  ctx.lineWidth = 1.8;
  drawRoundRect(ctx, bannerX, bannerY, bannerW, bannerH, 4);
  ctx.stroke();

  // Golden Sparkles on Chain Banner
  drawSparkDiamond(ctx, bannerX + 16, bannerY + bannerH / 2, 4.5, '#fbbf24');
  drawSparkDiamond(ctx, bannerX + bannerW - 16, bannerY + bannerH / 2, 4.5, '#fbbf24');

  // Banner Title (Large & Bold)
  const cleanTag = (chainTagOrTitle || 'TACTICAL CHAIN')
    .replace(/^\[\s*/, '')
    .replace(/\s*\]$/, '')
    .trim();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`[ ${cleanTag} ]`, bannerX + bannerW / 2, bannerY + 16);

  // Banner Subtitle
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText(chainSubtitle, bannerX + bannerW / 2, bannerY + 29);

  // 3 Tactical Command Cards (96x102 at y: 78, x: 232, 356, 480)
  const cardW = 96;
  const cardH = 102;
  const cardY = 78;
  const cardSpacing = 28;
  const startX = 232;

  for (let c = 0; c < 3; c++) {
    const cardX = startX + c * (cardW + cardSpacing);
    const cardType = sequence[c] || (c === 0 ? 'Buster' : c === 1 ? 'Arts' : 'Quick');
    const isSurging = (frameIdx >= 3 && frameIdx <= 5 && (frameIdx - 3) === c);

    drawCommandCardBadge(ctx, cardX, cardY, cardW, cardH, cardType, c, isSurging);

    // Chevron Arrow between cards
    if (c < 2) {
      const arrowX = cardX + cardW + cardSpacing / 2;
      drawVectorChevronArrow(ctx, arrowX, cardY + cardH / 2, '#fbbf24');
    }
  }

  ctx.restore();
}

/**
 * Helper to draw Tactical Skill Activation HUD in Center
 */
function drawSkillCenterHUD(
  ctx: any,
  skillName: string,
  servantClass: string = 'Saber',
  frameIdx: number = 0,
  customEffects?: string[],
  skillTypeCategory?: string
) {
  ctx.save();

  const cleanSkillName = (skillName || 'TACTICAL SKILL')
    .replace(/^\[?\s*SKILL:\s*/i, '')
    .replace(/\s*\]?$/, '')
    .trim();

  const lowerName = cleanSkillName.toLowerCase();

  // Dynamic Skill Theme Colors
  let headerGrad1 = '#0369a1';
  let headerGrad2 = '#082f49';
  let headerBorder = '#38bdf8';
  let runeTheme = '#38bdf8';
  let crestCategory = skillTypeCategory || 'ACTIVE SKILL • REINFORCEMENT';

  if (lowerName.includes('buster') || lowerName.includes('mana burst') || lowerName.includes('flame') || lowerName.includes('nine lives')) {
    headerGrad1 = '#991b1b';
    headerGrad2 = '#450a0a';
    headerBorder = '#f87171';
    runeTheme = '#f87171';
    crestCategory = skillTypeCategory || 'MANA BURST • BUSTER UP';
  } else if (lowerName.includes('arts') || lowerName.includes('fox') || lowerName.includes('territory') || lowerName.includes('rule')) {
    headerGrad1 = '#1e40af';
    headerGrad2 = '#172554';
    headerBorder = '#60a5fa';
    runeTheme = '#60a5fa';
    crestCategory = skillTypeCategory || 'TACTICAL ARTS • NP CATALYST';
  } else if (lowerName.includes('quick') || lowerName.includes('rune') || lowerName.includes('unseen hand') || lowerName.includes('arrow') || lowerName.includes('wind')) {
    headerGrad1 = '#065f46';
    headerGrad2 = '#022c22';
    headerBorder = '#34d399';
    runeTheme = '#34d399';
    crestCategory = skillTypeCategory || 'SPEED REINFORCE • QUICK SURGE';
  } else if (lowerName.includes('charisma') || lowerName.includes('tactics') || lowerName.includes('command') || lowerName.includes('star')) {
    headerGrad1 = '#854d0e';
    headerGrad2 = '#422006';
    headerBorder = '#facc15';
    runeTheme = '#facc15';
    crestCategory = skillTypeCategory || 'IMPERIAL DOMINION • CHARISMA';
  }

  // 1. Top Skill Header Banner
  const bannerW = 530;
  const bannerH = 40;
  const bannerX = 236;
  const bannerY = 18;

  const bGrad = ctx.createLinearGradient(bannerX, bannerY, bannerX, bannerY + bannerH);
  bGrad.addColorStop(0, headerGrad1);
  bGrad.addColorStop(1, headerGrad2);
  ctx.fillStyle = bGrad;
  drawRoundRect(ctx, bannerX, bannerY, bannerW, bannerH, 4);
  ctx.fill();

  ctx.strokeStyle = headerBorder;
  ctx.lineWidth = 1.8;
  drawRoundRect(ctx, bannerX, bannerY, bannerW, bannerH, 4);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(254, 240, 138, 0.4)';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, bannerX + 2, bannerY + 2, bannerW - 4, bannerH - 4, 3);
  ctx.stroke();

  // Corner Gold Sparkles
  drawSparkDiamond(ctx, bannerX + 16, bannerY + bannerH / 2, 4.5, '#fbbf24');
  drawSparkDiamond(ctx, bannerX + bannerW - 16, bannerY + bannerH / 2, 4.5, '#fbbf24');

  // Eyebrow Tag
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('✦ HEROIC SPIRIT ACTIVE SKILL ✦', bannerX + bannerW / 2, bannerY + 13);

  // Skill Name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`[ SKILL: ${cleanSkillName.toUpperCase()} ]`, bannerX + bannerW / 2, bannerY + 30);

  // 2. Center Arcane Enhancement Container Box
  const coreX = 236;
  const coreY = 66;
  const coreW = 530;
  const coreH = 170;

  ctx.fillStyle = 'rgba(6, 11, 25, 0.94)';
  drawRoundRect(ctx, coreX, coreY, coreW, coreH, 4);
  ctx.fill();

  ctx.strokeStyle = headerBorder;
  ctx.lineWidth = 1.8;
  drawRoundRect(ctx, coreX, coreY, coreW, coreH, 4);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(254, 240, 138, 0.3)';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, coreX + 3, coreY + 3, coreW - 6, coreH - 6, 3);
  ctx.stroke();

  // Corner Filigree Brackets
  const cbLen = 10;
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(coreX + 4, coreY + 4 + cbLen);
  ctx.lineTo(coreX + 4, coreY + 4);
  ctx.lineTo(coreX + 4 + cbLen, coreY + 4);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(coreX + coreW - 4 - cbLen, coreY + 4);
  ctx.lineTo(coreX + coreW - 4, coreY + 4);
  ctx.lineTo(coreX + coreW - 4, coreY + 4 + cbLen);
  ctx.stroke();

  // 3. Left Section: Spinning Runic Magic Circle (cx: 295, cy: 145)
  const circleX = 295;
  const circleY = 145;
  const baseR = 44;
  const pulseR = baseR + Math.sin(frameIdx * Math.PI / 4) * 3;

  // Glowing Leyline Core
  const coreGlow = ctx.createRadialGradient(circleX, circleY, 5, circleX, circleY, pulseR + 15);
  coreGlow.addColorStop(0, `${runeTheme}66`);
  coreGlow.addColorStop(0.6, `${runeTheme}22`);
  coreGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = coreGlow;
  ctx.beginPath();
  ctx.arc(circleX, circleY, pulseR + 15, 0, Math.PI * 2);
  ctx.fill();

  // Outer Rotating Rune Ring
  ctx.save();
  ctx.translate(circleX, circleY);
  ctx.rotate((frameIdx * Math.PI) / 8);
  ctx.strokeStyle = runeTheme;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
  ctx.stroke();

  // Orbital Celestial Rune Nodes
  for (let n = 0; n < 8; n++) {
    const angle = (n * Math.PI) / 4;
    const nx = Math.cos(angle) * pulseR;
    const ny = Math.sin(angle) * pulseR;
    drawSparkDiamond(ctx, nx, ny, n % 2 === 0 ? 3.5 : 2.5, '#fbbf24');
  }
  ctx.restore();

  // Inner Concentric Ring
  ctx.strokeStyle = 'rgba(254, 240, 138, 0.7)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(circleX, circleY, pulseR - 12, 0, Math.PI * 2);
  ctx.stroke();

  // Central Glowing Vector Rune Icon
  drawSparkDiamond(ctx, circleX, circleY, 12, '#ffffff');
  drawSparkDiamond(ctx, circleX, circleY, 7, runeTheme);

  // Magic Circle Category Label Pill underneath
  const pillW = 104;
  const pillH = 18;
  const pillX = circleX - pillW / 2;
  const pillY = circleY + pulseR + 8;
  ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
  drawRoundRect(ctx, pillX, pillY, pillW, pillH, 3);
  ctx.fill();
  ctx.strokeStyle = runeTheme;
  ctx.lineWidth = 1;
  drawRoundRect(ctx, pillX, pillY, pillW, pillH, 3);
  ctx.stroke();

  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(crestCategory.slice(0, 20), circleX, pillY + 12);

  // 4. Right Section: 3 Tactical Effect Panels (x: 360, y: 74, w: 396)
  let effList = customEffects && customEffects.length > 0 ? customEffects : [];
  if (effList.length === 0) {
    if (lowerName.includes('unseen hand')) {
      effList = [
        '⚡ Quick & Arts Perf +30% (3T)',
        '🌟 Critical Stars +20 • Target Lock',
        '⏳ Cooldown: 5 Turns • Card Resonance'
      ];
    } else if (lowerName.includes('mana burst')) {
      effList = [
        '🔴 Buster Card Performance +50% (1T)',
        '⚔️ Attack Power Surge +20% (1T)',
        '⏳ Cooldown: 5 Turns • Overwhelming Strike'
      ];
    } else if (lowerName.includes('arrows') || lowerName.includes('evade') || lowerName.includes('wisdom')) {
      effList = [
        '💨 Evasion Granted (3 Hits / 3 Turns)',
        '🛡️ Defense Up +25% • Survival Active',
        '⏳ Cooldown: 5 Turns • Unshakable Stance'
      ];
    } else if (lowerName.includes('charisma') || lowerName.includes('tactics')) {
      effList = [
        '⚔️ Party Attack Power +20% (3T)',
        '🌟 Morale Resonance • Star Drop +15%',
        '⏳ Cooldown: 5 Turns • Strategic Command'
      ];
    } else if (lowerName.includes('fox') || lowerName.includes('territory') || lowerName.includes('golden rule')) {
      effList = [
        '🔵 Arts Card Performance +50% (3T)',
        '💎 NP Gauge Charge +30% • Battery Boost',
        '⏳ Cooldown: 6 Turns • Magecraft Mastery'
      ];
    } else if (lowerName.includes('guts') || lowerName.includes('continuation')) {
      effList = [
        '🩸 Guts Revive Granted (1 Time / 5T)',
        '❤️ Revives with +2,500 HP on Defeat',
        '⏳ Cooldown: 7 Turns • Indomitable Will'
      ];
    } else {
      effList = [
        `⚡ ${cleanSkillName} Primary Surge Active`,
        '🌟 Tactical Combat Buffs Imbued',
        '⏳ Cooldown: 5 Turns • Immediate Cast'
      ];
    }
  }

  const tileW = 388;
  const tileH = 46;
  const startTileY = 74;
  const tileSpacing = 7;

  const tileIcons = ['⚡', '🌟', '⏳'];
  const tileHeaders = ['PRIMARY ENHANCEMENT', 'TACTICAL RESONANCE', 'MASTERY COOLDOWN'];
  const tileGrads = [
    ['rgba(15, 23, 42, 0.9)', 'rgba(30, 58, 138, 0.5)'],
    ['rgba(15, 23, 42, 0.9)', 'rgba(88, 28, 135, 0.5)'],
    ['rgba(15, 23, 42, 0.9)', 'rgba(120, 53, 15, 0.5)']
  ];

  for (let t = 0; t < 3; t++) {
    const tileX = 362;
    const tileY = startTileY + t * (tileH + tileSpacing);
    const effText = effList[t] || (t === 2 ? '⏳ Cooldown: 5 Turns' : '✨ Tactical Resonance Active');

    // Tile Box
    const tGrad = ctx.createLinearGradient(tileX, tileY, tileX + tileW, tileY);
    tGrad.addColorStop(0, tileGrads[t % 3][0]);
    tGrad.addColorStop(1, tileGrads[t % 3][1]);
    ctx.fillStyle = tGrad;
    drawRoundRect(ctx, tileX, tileY, tileW, tileH, 3);
    ctx.fill();

    ctx.strokeStyle = t === 0 ? headerBorder : t === 1 ? '#c084fc' : '#fbbf24';
    ctx.lineWidth = 1.2;
    drawRoundRect(ctx, tileX, tileY, tileW, tileH, 3);
    ctx.stroke();

    // Left Icon Square
    const iconSqW = 32;
    const iconSqH = 34;
    const iconSqX = tileX + 6;
    const iconSqY = tileY + 6;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
    drawRoundRect(ctx, iconSqX, iconSqY, iconSqW, iconSqH, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.5)';
    ctx.lineWidth = 0.8;
    drawRoundRect(ctx, iconSqX, iconSqY, iconSqW, iconSqH, 3);
    ctx.stroke();

    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(tileIcons[t % 3], iconSqX + iconSqW / 2, iconSqY + 23);

    // Header Mini Label
    ctx.fillStyle = t === 0 ? '#7dd3fc' : t === 1 ? '#e9d5ff' : '#fde047';
    ctx.font = 'bold 8.5px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(tileHeaders[t % 3], tileX + 46, tileY + 16);

    // Value Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12.5px sans-serif';
    const cleanEff = effText.replace(/^[⚡🌟⏳⚔️🛡️💎💚🩸✨]\s*/, '');
    ctx.fillText(cleanEff.slice(0, 42), tileX + 46, tileY + 34);
  }

  ctx.restore();
}

/**
 * Animated Skill Mana Burst & Leyline Aura Shockwave (Replaces diagonal sword slash)
 */
function drawSkillAuraAnimation(ctx: any, frameIdx: number, servantClass: string = 'Saber') {
  ctx.save();
  const cx = 295;
  const cy = 145;

  if (frameIdx === 0) {
    // Focus Tension: converging radiant sparkles
    drawSparkDiamond(ctx, cx, cy, 14, '#38bdf8');
    drawSparkDiamond(ctx, cx - 40, cy - 30, 6, '#facc15');
    drawSparkDiamond(ctx, cx + 40, cy + 30, 6, '#facc15');
  } else if (frameIdx === 1) {
    // Wave 1: expanding radiant ring
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 70, 0, Math.PI * 2);
    ctx.stroke();
    drawSparkDiamond(ctx, cx - 70, cy, 7, '#ffffff');
    drawSparkDiamond(ctx, cx + 70, cy, 7, '#ffffff');
  } else if (frameIdx === 2) {
    // Climax Mana Burst: Brilliant concentric shockwaves & diamond spark storm
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, 95, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 120, 0, Math.PI * 2);
    ctx.stroke();

    drawSparkDiamond(ctx, 150, 60, 9, '#ffffff');
    drawSparkDiamond(ctx, 210, 110, 7, '#38bdf8');
    drawSparkDiamond(ctx, 450, 60, 8, '#facc15');
    drawSparkDiamond(ctx, 620, 110, 9, '#ffffff');
    drawSparkDiamond(ctx, 720, 70, 7, '#38bdf8');
    drawSparkDiamond(ctx, 180, 220, 8, '#facc15');
    drawSparkDiamond(ctx, 580, 220, 7, '#ffffff');
  } else if (frameIdx === 3) {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 140, 0, Math.PI * 2);
    ctx.stroke();
    drawSparkDiamond(ctx, 350, 50, 6, '#facc15');
    drawSparkDiamond(ctx, 650, 160, 6, '#38bdf8');
  } else if (frameIdx >= 4 && frameIdx <= 6) {
    const alpha = (7 - frameIdx) * 0.18;
    ctx.strokeStyle = `rgba(250, 204, 21, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 160 + (frameIdx - 4) * 20, 0, Math.PI * 2);
    ctx.stroke();
    drawSparkDiamond(ctx, 480, 90 + frameIdx * 10, 5, '#fef08a');
  }

  ctx.restore();
}

/**
 * Persona / Anime Dynamic Diagonal Slash Cut-In (Animated Frame-by-Frame)
 * Full-screen diagonal cleave spanning the entire 800x420 screen!
 */
function drawPersonaSlashAnimation(
  ctx: any,
  frameIdx: number,
  cardTypeTheme: string = 'Buster'
) {
  ctx.save();

  if (frameIdx === 0) {
    // Frame 0: Focus Tension - Razor Charge Line across screen
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(760, 15);
    ctx.lineTo(40, 405);
    ctx.stroke();
    drawSparkDiamond(ctx, 400, 210, 6, '#fbbf24');
  } else if (frameIdx === 1) {
    // Frame 1: Rapid Inception Slash - High Velocity Stroke
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(780, 10);
    ctx.lineTo(30, 410);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(254, 240, 138, 0.35)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(780, 10);
    ctx.lineTo(30, 410);
    ctx.stroke();

    drawSparkDiamond(ctx, 500, 150, 7, '#ffffff');
    drawSparkDiamond(ctx, 300, 270, 7, '#ffffff');
  } else if (frameIdx === 2) {
    // Frame 2: Full Screen Impact Slice (The Climax Cleave!)
    // Slices boldly from top-right (860, -20) to bottom-left (-60, 440)
    ctx.beginPath();
    ctx.moveTo(880, -30);
    ctx.lineTo(840, -10);
    ctx.lineTo(-40, 450);
    ctx.lineTo(-80, 430);
    ctx.closePath();

    const slashGrad = ctx.createLinearGradient(800, 0, 0, 420);
    slashGrad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
    slashGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.55)');
    slashGrad.addColorStop(1, 'rgba(239, 68, 68, 0.35)');
    ctx.fillStyle = slashGrad;
    ctx.fill();

    // Wide radiant blade aura wake
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
    ctx.lineWidth = 38;
    ctx.beginPath();
    ctx.moveTo(860, -20);
    ctx.lineTo(-60, 440);
    ctx.stroke();

    // Golden Blade Cleave
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(860, -20);
    ctx.lineTo(-60, 440);
    ctx.stroke();

    // Intense White-Hot Slash Core
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(860, -20);
    ctx.lineTo(-60, 440);
    ctx.stroke();

    // Cross-cleave secondary strike
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.7)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(250, 40);
    ctx.lineTo(550, 220);
    ctx.stroke();

    // Burst of 14 Radiant Diamond Sparks along the slash cut
    drawSparkDiamond(ctx, 720, 50, 8, '#ffffff');
    drawSparkDiamond(ctx, 640, 95, 6, '#fef08a');
    drawSparkDiamond(ctx, 560, 135, 7, '#ffffff');
    drawSparkDiamond(ctx, 480, 175, 9, '#fbbf24');
    drawSparkDiamond(ctx, 400, 215, 10, '#ffffff');
    drawSparkDiamond(ctx, 320, 260, 7, '#fef08a');
    drawSparkDiamond(ctx, 240, 305, 8, '#ffffff');
    drawSparkDiamond(ctx, 160, 350, 6, '#fbbf24');
    drawSparkDiamond(ctx, 90, 390, 5, '#ffffff');
  } else if (frameIdx === 3) {
    // Frame 3: Resonant Wake Expanding (Card 1 activates)
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.85)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(820, 0);
    ctx.lineTo(0, 410);
    ctx.stroke();

    drawSparkDiamond(ctx, 520, 150, 6, '#fbbf24');
    drawSparkDiamond(ctx, 360, 240, 6, '#fbbf24');
  } else if (frameIdx === 4) {
    // Frame 4: Shockwave sweeps to Card 2
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(820, 0);
    ctx.lineTo(0, 410);
    ctx.stroke();

    drawSparkDiamond(ctx, 460, 180, 5, '#fde047');
    drawSparkDiamond(ctx, 320, 260, 5, '#fde047');
  } else if (frameIdx === 5) {
    // Frame 5: Shockwave sweeps to Card 3
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(820, 0);
    ctx.lineTo(0, 410);
    ctx.stroke();

    drawSparkDiamond(ctx, 420, 200, 4.5, '#fbbf24');
  } else if (frameIdx === 6) {
    // Frame 6: Ember Scatter & Drift
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(820, 0);
    ctx.lineTo(0, 410);
    ctx.stroke();

    drawSparkDiamond(ctx, 580, 120, 4, '#fef08a');
    drawSparkDiamond(ctx, 280, 280, 4, '#fef08a');
  } else if (frameIdx === 7) {
    // Frame 7: Ambient Luminous Stance
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(820, 0);
    ctx.lineTo(0, 410);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Render a single frame of the Dialogue Card Cut-In
 */
function renderDialogueSingleFrame(
  ctx: any,
  width: number,
  height: number,
  frameIdx: number,
  speakerName: string,
  quoteText: string,
  chainTagOrTitle: string,
  servantClass: string,
  portraitImg: any,
  bondOrLevel: number | string,
  defenderName: string,
  defenderImg: any,
  defenderClass: string,
  sequence: ('Buster' | 'Arts' | 'Quick' | 'NP')[],
  bgImg: any = null,
  stagePreset: string = 'fuyuki'
) {
  // 1. Stage / Battlefield Background
  drawBattlefieldStage(ctx, width, height, bgImg, stagePreset, frameIdx);

  const isSkillTag = (chainTagOrTitle || '').toUpperCase().startsWith('SKILL:') || (chainTagOrTitle || '').toUpperCase().includes('SKILL');

  // 2. Attacker Hovering Sprite (Left Side)
  drawHoveringAttacker(ctx, portraitImg, speakerName, servantClass, bondOrLevel, frameIdx, true);

  // 3. Defender Hovering Sprite (Right Side) - only during combat clashes
  if (!isSkillTag) {
    drawHoveringDefender(ctx, defenderImg, defenderName, defenderClass, frameIdx, true);
  }

  // 4. Center Tactical Command Cards & Active Chain HUD or Arcane Skill HUD
  if (isSkillTag) {
    const extractedSkillName = (chainTagOrTitle || '').replace(/^\[?\s*SKILL:\s*/i, '').replace(/\s*\]?$/, '').trim();
    drawSkillCenterHUD(ctx, extractedSkillName, servantClass, frameIdx);
    drawSkillAuraAnimation(ctx, frameIdx, servantClass);
  } else if (chainTagOrTitle !== 'VICTORY INVOCATION' && chainTagOrTitle !== 'DIALOGUE' && chainTagOrTitle !== 'SUMMON INVOCATION') {
    drawCenterCommandHUD(ctx, chainTagOrTitle, sequence, frameIdx);

    // 5. Full-Screen Screen-Splitting Slash Cut-In Animation
    drawPersonaSlashAnimation(ctx, frameIdx, chainTagOrTitle);
  }

  // 6. Visual Novel Dialogue Ribbon (Lower Section)
  const boxX = 22;
  const boxY = 248;
  const boxW = 756;
  const boxH = 154;

  // Obsidian Glassmorphism Base (Semi-translucent so characters peek through)
  ctx.fillStyle = 'rgba(10, 5, 3, 0.90)';
  drawRoundRect(ctx, boxX, boxY, boxW, boxH, 4);
  ctx.fill();

  // Double Metallic Gold Border
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 2;
  drawRoundRect(ctx, boxX, boxY, boxW, boxH, 4);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(254, 240, 138, 0.35)';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, boxX + 3, boxY + 3, boxW - 6, boxH - 6, 3);
  ctx.stroke();

  // Corner Filigree Brackets
  const boxCbLen = 12;
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(boxX + 3, boxY + 3 + boxCbLen);
  ctx.lineTo(boxX + 3, boxY + 3);
  ctx.lineTo(boxX + 3 + boxCbLen, boxY + 3);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(boxX + boxW - 3 - boxCbLen, boxY + 3);
  ctx.lineTo(boxX + boxW - 3, boxY + 3);
  ctx.lineTo(boxX + boxW - 3, boxY + 3 + boxCbLen);
  ctx.stroke();

  // 7. Speaker Nameplate Tab (Overlapping top-left border of dialogue box)
  ctx.font = 'bold 15px sans-serif';
  const nameLabel = `${speakerName} [${servantClass || 'Servant'}]`;
  const nameMetrics = ctx.measureText(nameLabel);
  const nameW = Math.max(180, Math.min(360, nameMetrics.width + 36));
  const nameH = 30;
  const nameX = boxX + 20;
  const nameY = boxY - 16;

  ctx.fillStyle = '#0d0704';
  drawRoundRect(ctx, nameX, nameY, nameW, nameH, 4);
  ctx.fill();

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  drawRoundRect(ctx, nameX, nameY, nameW, nameH, 4);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(254, 240, 138, 0.4)';
  ctx.lineWidth = 0.8;
  drawRoundRect(ctx, nameX + 2, nameY + 2, nameW - 4, nameH - 4, 3);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${speakerName} [${(servantClass || 'Servant').toUpperCase()}]`, nameX + nameW / 2, nameY + 20);

  // 8. Dialogue Quote Text (Large, High Contrast, 24px Serif)
  const textX = boxX + 28;
  const textY = boxY + 42;
  const maxTextW = boxW - 56;
  const lineHeight = 32;

  ctx.fillStyle = '#fffbeb';
  ctx.font = 'bold 24px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'left';

  const cleanQuote = quoteText.replace(/^["“]/, '').replace(/["”]$/, '').trim();
  drawWrappedText(ctx, `“${cleanQuote}”`, textX, textY, maxTextW, lineHeight, 3);

  // 9. Continuation Prompt Indicator (Pulsing Gold Diamond at bottom-right)
  const promptScale = frameIdx % 2 === 0 ? 6 : 5;
  drawSparkDiamond(ctx, boxX + boxW - 24, boxY + boxH - 20, promptScale, '#fbbf24');
}

/**
 * 2. Render Visual Novel Dialogue Frame (800x420 Authentic Fate VN Animated Frame)
 * Features Ornate Double Gold Borders, Framed Servant Portrait with Level Badge, 
 * Persona-Style Dynamic Slash Cut-In (Animated GIF / Action Sequence), 
 * Glowing Command Cards & Chain HUD, Target-Locked Opponent HUD,
 * Overlapping Nameplate Tab, and Large High-Contrast Dialogue Text.
 */
export async function renderDialogueCard(
  canvasOrSpeaker: any,
  quoteOrSpeaker?: any,
  chainTagOrTitle: string = 'TACTICAL COMBAT CHAIN',
  servantClass: string = 'Saber',
  avatarUrl?: string,
  bondOrLevel: number | string = 8,
  defenderName: string = 'Opponent Servant',
  defenderAvatarUrl?: string,
  defenderClass: string = 'Servant',
  sequence: ('Buster' | 'Arts' | 'Quick' | 'NP')[] = ['Buster', 'Buster', 'Buster'],
  battlefieldPresetOrBg: string = 'fuyuki'
): Promise<Buffer> {
  let canvas: any;
  let speakerName: string;
  let quoteText: string;

  const isClientCanvas = canvasOrSpeaker && typeof canvasOrSpeaker.getContext === 'function';

  if (isClientCanvas) {
    canvas = canvasOrSpeaker;
    speakerName = quoteOrSpeaker || 'Heroic Spirit';
    quoteText = chainTagOrTitle || '';
  } else {
    canvas = createCanvas(800, 420);
    speakerName = canvasOrSpeaker || 'Heroic Spirit';
    quoteText = quoteOrSpeaker || '';
  }

  if (canvas.width !== 800 || canvas.height !== 420) {
    canvas.width = 800;
    canvas.height = 420;
  }
  const ctx = canvas.getContext('2d');

  // Pre-load images once for all frames
  let portraitImg: any = null;
  if (avatarUrl) {
    try {
      portraitImg = await loadImage(avatarUrl);
    } catch {
      portraitImg = null;
    }
  }

  let defenderImg: any = null;
  if (defenderAvatarUrl) {
    try {
      defenderImg = await loadImage(defenderAvatarUrl);
    } catch {
      defenderImg = null;
    }
  }

  let bgImg: any = null;
  let stagePreset = 'fuyuki';
  if (battlefieldPresetOrBg) {
    if (battlefieldPresetOrBg.startsWith('http') || battlefieldPresetOrBg.startsWith('data:')) {
      try {
        bgImg = await loadImage(battlefieldPresetOrBg);
      } catch {
        bgImg = null;
      }
    } else {
      stagePreset = battlefieldPresetOrBg;
    }
  }

  // If rendering on client canvas (HTML5 Canvas element in browser):
  if (isClientCanvas) {
    // Render full climax frame (Frame 2) on client canvas
    renderDialogueSingleFrame(
      ctx,
      800,
      420,
      2,
      speakerName,
      quoteText,
      chainTagOrTitle,
      servantClass,
      portraitImg,
      bondOrLevel,
      defenderName,
      defenderImg,
      defenderClass,
      sequence,
      bgImg,
      stagePreset
    );
    return MINIMAL_VALID_PNG;
  }

  // Server execution: Build animated GIF with 8 action frames if gifenc is available
  if (gifencModule && typeof gifencModule.GIFEncoder === 'function') {
    try {
      const { GIFEncoder, quantize, applyPalette } = gifencModule;
      const gif = GIFEncoder();
      const totalFrames = 8;
      const frameDelay = 120; // 120ms per frame = ~960ms loop cycle

      for (let f = 0; f < totalFrames; f++) {
        // Clear canvas
        ctx.clearRect(0, 0, 800, 420);

        // Render frame f
        renderDialogueSingleFrame(
          ctx,
          800,
          420,
          f,
          speakerName,
          quoteText,
          chainTagOrTitle,
          servantClass,
          portraitImg,
          bondOrLevel,
          defenderName,
          defenderImg,
          defenderClass,
          sequence,
          bgImg,
          stagePreset
        );

        // Quantize and write GIF frame with Netscape 2.0 loop extension on frame 0
        const imgData = ctx.getImageData(0, 0, 800, 420);
        const palette = quantize(imgData.data, 256);
        const index = applyPalette(imgData.data, palette);
        gif.writeFrame(index, 800, 420, { palette, delay: frameDelay, repeat: f === 0 ? 0 : undefined });
      }

      gif.finish();
      const gifBuffer = Buffer.from(gif.bytes());
      if (gifBuffer && gifBuffer.length > 500) {
        return gifBuffer;
      }
    } catch (animErr) {
      console.warn('Animated GIF generation failed, falling back to static PNG:', animErr);
    }
  }

  // Fallback: Static PNG render (Frame 2 - Climax Impact)
  renderDialogueSingleFrame(
    ctx,
    800,
    420,
    2,
    speakerName,
    quoteText,
    chainTagOrTitle,
    servantClass,
    portraitImg,
    bondOrLevel,
    defenderName,
    defenderImg,
    defenderClass,
    sequence,
    bgImg,
    stagePreset
  );

  try {
    return canvas.toBuffer('image/png');
  } catch {
    return MINIMAL_VALID_PNG;
  }
}

/**
 * Helper to draw iconic Fate 3-winged Command Seal Vector Insignia
 */
function drawVectorCommandSeal(
  ctx: any,
  cx: number,
  cy: number,
  scale: number = 1,
  color: string = '#ef4444'
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;

  // Central Wing / Blade
  ctx.beginPath();
  ctx.moveTo(0, -32);
  ctx.bezierCurveTo(9, -18, 10, 4, 0, 24);
  ctx.bezierCurveTo(-10, 4, -9, -18, 0, -32);
  ctx.fill();

  // Left Crescent Wing
  ctx.beginPath();
  ctx.moveTo(-6, -22);
  ctx.bezierCurveTo(-26, -14, -32, 12, -12, 28);
  ctx.bezierCurveTo(-20, 16, -18, -4, -6, -22);
  ctx.fill();

  // Right Crescent Wing
  ctx.beginPath();
  ctx.moveTo(6, -22);
  ctx.bezierCurveTo(26, -14, 32, 12, 12, 28);
  ctx.bezierCurveTo(20, 16, 18, -4, 6, -22);
  ctx.fill();

  // Center core spark
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draw Hovering Master Sprite on the Left Side (280x340)
 * Showcases Master's Profile Picture (PFP), glowing Command Seal crest, flaring magic circuits,
 * and Magus Authority status badge.
 */
function drawHoveringMaster(
  ctx: any,
  masterImg: any,
  masterName: string,
  commandSealsCount: number = 3,
  frameIdx: number = 0
) {
  ctx.save();
  const spriteW = 280;
  const spriteH = 340;
  const spriteX = 10;
  // Sinusoidal floating hover animation (5px breathing float)
  const floatOffsetY = Math.sin((frameIdx / 8) * Math.PI * 2) * 5;
  const spriteY = 10 + floatOffsetY;

  // 1. Intense Crimson & Rose Magus Mana Aura
  const auraGrad = ctx.createRadialGradient(140, 150 + floatOffsetY, 25, 140, 150 + floatOffsetY, 180);
  auraGrad.addColorStop(0, 'rgba(244, 63, 94, 0.40)');
  auraGrad.addColorStop(0.5, 'rgba(225, 29, 72, 0.18)');
  auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = auraGrad;
  ctx.fillRect(spriteX - 20, spriteY, spriteW + 40, spriteH);

  // 2. Glowing Magic Circuit lines flaring behind Master
  ctx.save();
  ctx.strokeStyle = 'rgba(251, 113, 133, 0.50)';
  ctx.lineWidth = 1.8;
  ctx.shadowColor = '#f43f5e';
  ctx.shadowBlur = 8;
  // Circuit vein 1
  ctx.beginPath();
  ctx.moveTo(spriteX + 20, spriteY + spriteH - 40);
  ctx.lineTo(spriteX + 55, spriteY + 160);
  ctx.lineTo(spriteX + 35, spriteY + 90);
  ctx.stroke();
  // Circuit vein 2
  ctx.beginPath();
  ctx.moveTo(spriteX + spriteW - 20, spriteY + spriteH - 50);
  ctx.lineTo(spriteX + spriteW - 45, spriteY + 175);
  ctx.lineTo(spriteX + spriteW - 25, spriteY + 105);
  ctx.stroke();
  ctx.restore();

  // 3. Render Master PFP
  ctx.save();
  ctx.beginPath();
  ctx.rect(spriteX, spriteY, spriteW, spriteH);
  ctx.clip();

  if (masterImg) {
    drawImageCover(ctx, masterImg, spriteX, spriteY, spriteW, spriteH);
  } else {
    // Stylized Magus Silhouette Fallback
    const mGrad = ctx.createLinearGradient(spriteX, spriteY, spriteX, spriteY + spriteH);
    mGrad.addColorStop(0, '#3f0c18');
    mGrad.addColorStop(0.55, '#1a050a');
    mGrad.addColorStop(1, '#080103');
    ctx.fillStyle = mGrad;
    ctx.fillRect(spriteX, spriteY, spriteW, spriteH);

    drawVectorShield(ctx, spriteX + spriteW / 2, spriteY + 120, 72, 84, 'rgba(225, 29, 72, 0.25)', '#e11d48');
    drawVectorCommandSeal(ctx, spriteX + spriteW / 2, spriteY + 120, 1.2, '#f43f5e');
  }

  // Right Edge Smooth Fade into Center Leyline
  const fadeRight = ctx.createLinearGradient(spriteX + spriteW - 90, spriteY, spriteX + spriteW, spriteY);
  fadeRight.addColorStop(0, 'rgba(10, 5, 3, 0)');
  fadeRight.addColorStop(0.6, 'rgba(10, 5, 3, 0.65)');
  fadeRight.addColorStop(1, 'rgba(10, 5, 3, 0.98)');
  ctx.fillStyle = fadeRight;
  ctx.fillRect(spriteX + spriteW - 90, spriteY, 90, spriteH);

  // Bottom Edge Fade into Dialogue Ribbon
  const fadeBottom = ctx.createLinearGradient(spriteX, spriteY + spriteH - 80, spriteX, spriteY + spriteH);
  fadeBottom.addColorStop(0, 'rgba(10, 5, 3, 0)');
  fadeBottom.addColorStop(1, 'rgba(10, 5, 3, 0.95)');
  ctx.fillStyle = fadeBottom;
  ctx.fillRect(spriteX, spriteY + spriteH - 80, spriteW, 80);

  ctx.restore(); // end clip

  // 4. Glowing Command Seal on Master's wrist / bottom right of portrait
  const sealScale = 0.75 + Math.sin(frameIdx * 0.8) * 0.06;
  drawVectorCommandSeal(ctx, spriteX + spriteW - 48, spriteY + spriteH - 95, sealScale, '#ff2056');

  // 5. Floating Master Crest & Command Seals Badge (Top Left)
  const badgeW = 126;
  const badgeH = 24;
  const badgeX = spriteX + 14;
  const badgeY = spriteY + 14;

  ctx.fillStyle = 'rgba(18, 4, 8, 0.92)';
  drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
  ctx.fill();
  ctx.strokeStyle = '#e11d48';
  ctx.lineWidth = 1.6;
  drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
  ctx.stroke();

  ctx.fillStyle = '#fee2e2';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('MASTER', badgeX + 8, badgeY + 16);

  // Dots for seals
  const sealsCount = Math.max(0, Math.min(3, commandSealsCount));
  for (let s = 0; s < 3; s++) {
    const dotX = badgeX + badgeW - 14 - (2 - s) * 14;
    const dotY = badgeY + 12;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
    ctx.fillStyle = s < sealsCount ? '#f43f5e' : '#4b1520';
    ctx.fill();
    if (s < sealsCount) {
      ctx.strokeStyle = '#fecdd3';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Draw Hovering Contracted Servant on the Right Side (280x340)
 * Displays Servant receiving the Master's absolute command, glowing with cyan-gold resonance.
 */
function drawHoveringContractedServant(
  ctx: any,
  servantImg: any,
  servantName: string,
  servantClass: string,
  frameIdx: number = 0
) {
  ctx.save();
  const spriteW = 280;
  const spriteH = 340;
  const spriteX = 510;
  // Sinusoidal floating hover animation (5px counter-phase breathing float)
  const floatOffsetY = Math.cos((frameIdx / 8) * Math.PI * 2) * 5;
  const spriteY = 10 + floatOffsetY;

  // 1. Radiant Cyan-Gold Spiritual Resonance Aura (Command Accepted)
  const auraGrad = ctx.createRadialGradient(660, 150 + floatOffsetY, 30, 660, 150 + floatOffsetY, 175);
  auraGrad.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
  auraGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.14)');
  auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = auraGrad;
  ctx.fillRect(spriteX - 20, spriteY, spriteW + 40, spriteH);

  // 2. Render Servant Sprite
  ctx.save();
  ctx.beginPath();
  ctx.rect(spriteX, spriteY, spriteW, spriteH);
  ctx.clip();

  if (servantImg) {
    drawImageCover(ctx, servantImg, spriteX, spriteY, spriteW, spriteH);
  } else {
    // Golden amber fallback
    const fbGrad = ctx.createLinearGradient(spriteX, spriteY, spriteX, spriteY + spriteH);
    fbGrad.addColorStop(0, '#2b160a');
    fbGrad.addColorStop(1, '#0e0603');
    ctx.fillStyle = fbGrad;
    ctx.fillRect(spriteX, spriteY, spriteW, spriteH);

    drawVectorShield(ctx, spriteX + spriteW / 2, spriteY + 110, 68, 78, 'rgba(245, 158, 11, 0.25)', '#f59e0b');
    drawVectorCrossedSwords(ctx, spriteX + spriteW / 2, spriteY + 110, 20, '#fbbf24');
  }

  // Left Edge Smooth Fade into Center Leyline
  const fadeLeft = ctx.createLinearGradient(spriteX, spriteY, spriteX + 90, spriteY);
  fadeLeft.addColorStop(0, 'rgba(10, 5, 3, 0.98)');
  fadeLeft.addColorStop(0.4, 'rgba(10, 5, 3, 0.65)');
  fadeLeft.addColorStop(1, 'rgba(10, 5, 3, 0)');
  ctx.fillStyle = fadeLeft;
  ctx.fillRect(spriteX, spriteY, 90, spriteH);

  // Bottom Edge Fade into Dialogue Ribbon
  const fadeBottom = ctx.createLinearGradient(spriteX, spriteY + spriteH - 80, spriteX, spriteY + spriteH);
  fadeBottom.addColorStop(0, 'rgba(10, 5, 3, 0)');
  fadeBottom.addColorStop(1, 'rgba(10, 5, 3, 0.95)');
  ctx.fillStyle = fadeBottom;
  ctx.fillRect(spriteX, spriteY + spriteH - 80, spriteW, 80);

  ctx.restore(); // end clip

  // 3. Floating [ CONTRACTED SERVANT ] Cyan HUD Badge (Top Right)
  const badgeW = 160;
  const badgeH = 24;
  const badgeX = spriteX + spriteW - badgeW - 14;
  const badgeY = spriteY + 14;

  ctx.fillStyle = 'rgba(7, 24, 38, 0.92)';
  drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.4;
  drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
  ctx.stroke();

  drawSparkDiamond(ctx, badgeX + 12, badgeY + 12, 3.5, '#38bdf8');
  ctx.fillStyle = '#e0f2fe';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CONTRACTED SERVANT', badgeX + badgeW / 2 + 5, badgeY + 16);

  // 4. Floating Servant Nameplate & Overdrive Tag
  const nameW = 190;
  const nameH = 38;
  const nameX = spriteX + spriteW - nameW - 14;
  const nameY = spriteY + 44;

  ctx.fillStyle = 'rgba(10, 5, 8, 0.90)';
  drawRoundRect(ctx, nameX, nameY, nameW, nameH, 4);
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.2;
  drawRoundRect(ctx, nameX, nameY, nameW, nameH, 4);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  const sDisplay = servantName.length > 17 ? servantName.slice(0, 16) + '…' : servantName;
  ctx.fillText(sDisplay, nameX + nameW / 2, nameY + 15);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText(`[${(servantClass || 'Servant').toUpperCase()}] • NP 100% READY`, nameX + nameW / 2, nameY + 30);

  ctx.restore();
}

/**
 * Draw Master Command Seal Arcane HUD in Center
 */
function drawMasterCommandSealCenterHUD(
  ctx: any,
  frameIdx: number
) {
  ctx.save();

  // 1. Center Banner Pill
  const bannerW = 340;
  const bannerH = 36;
  const bannerX = 230;
  const bannerY = 22;

  const bGrad = ctx.createLinearGradient(bannerX, bannerY, bannerX, bannerY + bannerH);
  bGrad.addColorStop(0, '#881337');
  bGrad.addColorStop(0.5, '#4c0519');
  bGrad.addColorStop(1, '#1e0508');
  ctx.fillStyle = bGrad;
  drawRoundRect(ctx, bannerX, bannerY, bannerW, bannerH, 4);
  ctx.fill();

  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 1.8;
  drawRoundRect(ctx, bannerX, bannerY, bannerW, bannerH, 4);
  ctx.stroke();

  drawSparkDiamond(ctx, bannerX + 16, bannerY + bannerH / 2, 4.5, '#f43f5e');
  drawSparkDiamond(ctx, bannerX + bannerW - 16, bannerY + bannerH / 2, 4.5, '#f43f5e');

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('[ COMMAND SEAL INVOCATION ]', bannerX + bannerW / 2, bannerY + 16);

  ctx.fillStyle = '#fecdd3';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('Absolute Authority Invoked • NP Max Surge 100%', bannerX + bannerW / 2, bannerY + 29);

  // 2. Arcane Leyline Energy Beam streaming horizontally between Master and Servant
  const beamY = 145;
  const beamGrad = ctx.createLinearGradient(230, beamY, 570, beamY);
  beamGrad.addColorStop(0, 'rgba(244, 63, 94, 0.85)');
  beamGrad.addColorStop(0.5, 'rgba(254, 205, 211, 0.95)');
  beamGrad.addColorStop(1, 'rgba(56, 189, 248, 0.85)');
  ctx.strokeStyle = beamGrad;
  ctx.lineWidth = 3 + Math.sin(frameIdx * 0.9) * 1.5;
  ctx.shadowColor = '#f43f5e';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(230, beamY);
  ctx.lineTo(570, beamY);
  ctx.stroke();

  // 3. Central Concentric Magic Circles & Flaring Command Seal Sigil
  const cx = 400;
  const cy = 145;

  // Outer runic ring
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 54, 0, Math.PI * 2);
  ctx.stroke();

  // Inner ring
  ctx.strokeStyle = 'rgba(254, 240, 138, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, 40, 0, Math.PI * 2);
  ctx.stroke();

  // Runic ticks
  const tickAngleOffset = (frameIdx * Math.PI) / 8;
  for (let t = 0; t < 8; t++) {
    const ang = tickAngleOffset + (t * Math.PI) / 4;
    const x1 = cx + Math.cos(ang) * 44;
    const y1 = cy + Math.sin(ang) * 44;
    const x2 = cx + Math.cos(ang) * 54;
    const y2 = cy + Math.sin(ang) * 54;
    ctx.strokeStyle = 'rgba(251, 113, 133, 0.65)';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Large Central Glowing Command Seal Symbol
  const centerScale = 1.35 + Math.sin(frameIdx * 0.7) * 0.12;
  drawVectorCommandSeal(ctx, cx, cy, centerScale, '#ff2056');

  // Spark diamonds around sigil
  drawSparkDiamond(ctx, cx - 62, cy, 5, '#fb7185');
  drawSparkDiamond(ctx, cx + 62, cy, 5, '#38bdf8');
  drawSparkDiamond(ctx, cx, cy - 62, 5, '#ffffff');
  drawSparkDiamond(ctx, cx, cy + 62, 5, '#f43f5e');

  ctx.restore();
}

/**
 * Master Command Seal Screen-Splitting Slash / Radiant Shockwave Animation
 */
function drawMasterCommandSlashAnimation(
  ctx: any,
  frameIdx: number
) {
  ctx.save();
  if (frameIdx === 0) {
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(850, -30);
    ctx.lineTo(-50, 450);
    ctx.stroke();
  } else if (frameIdx === 1) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(860, -20);
    ctx.lineTo(-60, 440);
    ctx.stroke();
  } else if (frameIdx === 2) {
    // Climax Cleave: Brilliant Ruby & White Shockwave
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 9;
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(860, -20);
    ctx.lineTo(-60, 440);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(254, 205, 211, 0.85)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(250, 40);
    ctx.lineTo(550, 220);
    ctx.stroke();

    // Burst of Radiant Diamond Sparks
    drawSparkDiamond(ctx, 720, 50, 9, '#ffffff');
    drawSparkDiamond(ctx, 640, 95, 7, '#fb7185');
    drawSparkDiamond(ctx, 560, 135, 8, '#ffffff');
    drawSparkDiamond(ctx, 480, 175, 10, '#f43f5e');
    drawSparkDiamond(ctx, 400, 215, 11, '#ffffff');
    drawSparkDiamond(ctx, 320, 260, 8, '#fb7185');
    drawSparkDiamond(ctx, 240, 305, 9, '#ffffff');
    drawSparkDiamond(ctx, 160, 350, 7, '#f43f5e');
  } else if (frameIdx === 3) {
    ctx.strokeStyle = 'rgba(251, 113, 133, 0.85)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(820, 0);
    ctx.lineTo(0, 410);
    ctx.stroke();
    drawSparkDiamond(ctx, 520, 150, 6, '#f43f5e');
    drawSparkDiamond(ctx, 360, 240, 6, '#f43f5e');
  } else if (frameIdx >= 4 && frameIdx <= 6) {
    const alpha = (7 - frameIdx) * 0.2;
    ctx.strokeStyle = `rgba(244, 63, 94, ${alpha})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(820, 0);
    ctx.lineTo(0, 410);
    ctx.stroke();
    drawSparkDiamond(ctx, 460, 180, 5, '#fb7185');
  }
  ctx.restore();
}

/**
 * Render a single frame of the Master Command Seal Visual Novel Cut-In (800x420)
 * Features Master's PFP on left, Contracted Servant on right, center Leyline surge,
 * and high-contrast dialogue box displaying Master's absolute command decree.
 */
function renderMasterCommandSealSingleFrame(
  ctx: any,
  width: number,
  height: number,
  frameIdx: number,
  masterName: string,
  quoteText: string,
  masterImg: any,
  commandSealsCount: number = 3,
  servantName: string = 'Heroic Spirit',
  servantClass: string = 'Saber',
  servantImg: any = null,
  bgImg: any = null,
  stagePreset: string = 'fuyuki'
) {
  // 1. Stage / Battlefield Background
  drawBattlefieldStage(ctx, width, height, bgImg, stagePreset, frameIdx);

  // Subtle crimson vignette to indicate Command Seal activation
  const redVig = ctx.createRadialGradient(width / 2, height / 2, 80, width / 2, height / 2, 450);
  redVig.addColorStop(0, 'rgba(136, 19, 55, 0.22)');
  redVig.addColorStop(0.7, 'rgba(76, 5, 25, 0.45)');
  redVig.addColorStop(1, 'rgba(20, 2, 5, 0.65)');
  ctx.fillStyle = redVig;
  ctx.fillRect(0, 0, width, height);

  // 2. Master Hovering Sprite (Left Side) - Features Master's PFP!
  drawHoveringMaster(ctx, masterImg, masterName, commandSealsCount, frameIdx);

  // 3. Contracted Servant Hovering Sprite (Right Side)
  drawHoveringContractedServant(ctx, servantImg, servantName, servantClass, frameIdx);

  // 4. Center Arcane Command HUD & Leyline Transfusion
  drawMasterCommandSealCenterHUD(ctx, frameIdx);

  // 5. Full-Screen Screen-Splitting Slash Cut-In Animation
  drawMasterCommandSlashAnimation(ctx, frameIdx);

  // 6. Visual Novel Dialogue Ribbon (Lower Section)
  const boxX = 22;
  const boxY = 248;
  const boxW = 756;
  const boxH = 154;

  // Obsidian Base with rich crimson glassmorphism
  ctx.fillStyle = 'rgba(16, 4, 7, 0.94)';
  drawRoundRect(ctx, boxX, boxY, boxW, boxH, 4);
  ctx.fill();

  // Double Metallic Border: Outer Crimson, Inner Gold Hairline
  ctx.strokeStyle = '#e11d48';
  ctx.lineWidth = 2;
  drawRoundRect(ctx, boxX, boxY, boxW, boxH, 4);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(254, 240, 138, 0.40)';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, boxX + 3, boxY + 3, boxW - 6, boxH - 6, 3);
  ctx.stroke();

  // Corner Filigree Brackets
  const boxCbLen = 12;
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(boxX + 3, boxY + 3 + boxCbLen);
  ctx.lineTo(boxX + 3, boxY + 3);
  ctx.lineTo(boxX + 3 + boxCbLen, boxY + 3);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(boxX + boxW - 3 - boxCbLen, boxY + 3);
  ctx.lineTo(boxX + boxW - 3, boxY + 3);
  ctx.lineTo(boxX + boxW - 3, boxY + 3 + boxCbLen);
  ctx.stroke();

  // 7. Speaker Nameplate Tab (Overlapping top-left border of dialogue box)
  ctx.font = 'bold 15px sans-serif';
  const nameLabel = `🔱 MASTER ${masterName.toUpperCase()} [CHALDEA MAGUS]`;
  const nameMetrics = ctx.measureText(nameLabel);
  const nameW = Math.max(220, Math.min(420, nameMetrics.width + 44));
  const nameH = 30;
  const nameX = boxX + 20;
  const nameY = boxY - 16;

  ctx.fillStyle = '#26040a';
  drawRoundRect(ctx, nameX, nameY, nameW, nameH, 4);
  ctx.fill();

  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 2;
  drawRoundRect(ctx, nameX, nameY, nameW, nameH, 4);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(254, 240, 138, 0.45)';
  ctx.lineWidth = 0.8;
  drawRoundRect(ctx, nameX + 2, nameY + 2, nameW - 4, nameH - 4, 3);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(nameLabel, nameX + nameW / 2, nameY + 20);

  // 8. Dialogue Quote Text (Large, High Contrast, 24px Serif)
  const textX = boxX + 28;
  const textY = boxY + 42;
  const maxTextW = boxW - 56;
  const lineHeight = 32;

  ctx.fillStyle = '#fff1f2';
  ctx.font = 'bold 24px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'left';

  const cleanQuote = quoteText.replace(/^["“]/, '').replace(/["”]$/, '').trim();
  drawWrappedText(ctx, `“${cleanQuote}”`, textX, textY, maxTextW, lineHeight, 2);

  // Bottom Command Decree Banner Strip
  ctx.fillStyle = '#fda4af';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('✦ ABSOLUTE COMMAND SEAL INVOCATION • NOBLE PHANTASM GAUGE SURGED TO 100%', textX, boxY + boxH - 18);

  // 9. Continuation Prompt Indicator (Pulsing Crimson Diamond at bottom-right)
  const promptScale = frameIdx % 2 === 0 ? 6 : 5;
  drawSparkDiamond(ctx, boxX + boxW - 24, boxY + boxH - 20, promptScale, '#f43f5e');
}

/**
 * Render Master Command Seal Visual Novel Dialogue Frame (800x420 Animated Action Cut-In)
 * Features Master's PFP with flaring Magic Circuits, glowing Command Seal insignia,
 * Contracted Servant reception HUD, and absolute commandment decree.
 */
export async function renderMasterCommandSealDialogueCard(
  canvasOrMaster: any,
  quoteOrMasterName?: any,
  masterAvatarUrlOrQuote?: string,
  commandSealsCountOrAvatar?: any,
  servantNameOrCount: any = 3,
  servantClassOrName: string = 'Heroic Spirit',
  servantAvatarUrlOrClass: string = 'Saber',
  battlefieldPresetOrServantAvatar?: string,
  maybePreset: string = 'fuyuki'
): Promise<Buffer> {
  const isClientCanvas = canvasOrMaster && typeof canvasOrMaster.getContext === 'function';
  let masterName = 'Master';
  let quoteText = 'By my Command Seal, unleash your true power!';
  let masterAvatarUrl: string | undefined;
  let commandSealsCount = 3;
  let servantName = 'Heroic Spirit';
  let servantClass = 'Saber';
  let servantAvatarUrl: string | undefined;
  let battlefieldPresetOrBg = 'fuyuki';

  if (isClientCanvas) {
    masterName = quoteOrMasterName || 'Master';
    quoteText = masterAvatarUrlOrQuote || quoteText;
    masterAvatarUrl = commandSealsCountOrAvatar;
    commandSealsCount = typeof servantNameOrCount === 'number' ? servantNameOrCount : 3;
    servantName = servantClassOrName || 'Heroic Spirit';
    servantClass = servantAvatarUrlOrClass || 'Saber';
    servantAvatarUrl = battlefieldPresetOrServantAvatar;
    battlefieldPresetOrBg = maybePreset || 'fuyuki';
  } else {
    masterName = canvasOrMaster || 'Master';
    quoteText = quoteOrMasterName || quoteText;
    masterAvatarUrl = masterAvatarUrlOrQuote;
    commandSealsCount = typeof commandSealsCountOrAvatar === 'number' ? commandSealsCountOrAvatar : 3;
    servantName = typeof servantNameOrCount === 'string' ? servantNameOrCount : 'Heroic Spirit';
    servantClass = servantClassOrName || 'Saber';
    servantAvatarUrl = servantAvatarUrlOrClass;
    battlefieldPresetOrBg = battlefieldPresetOrServantAvatar || 'fuyuki';
  }

  let canvas: any;
  let ctx: any;

  if (isClientCanvas) {
    canvas = canvasOrMaster;
    ctx = canvas.getContext('2d');
    canvas.width = 800;
    canvas.height = 420;
  } else {
    canvas = createCanvas(800, 420);
    ctx = canvas.getContext('2d');
  }

  // Pre-load images
  let masterImg: any = null;
  if (masterAvatarUrl) {
    try {
      masterImg = await loadImage(masterAvatarUrl);
    } catch {
      masterImg = null;
    }
  }

  let servantImg: any = null;
  if (servantAvatarUrl) {
    try {
      servantImg = await loadImage(servantAvatarUrl);
    } catch {
      servantImg = null;
    }
  }

  let bgImg: any = null;
  let stagePreset = 'fuyuki';
  if (battlefieldPresetOrBg) {
    if (battlefieldPresetOrBg.startsWith('http') || battlefieldPresetOrBg.startsWith('data:')) {
      try {
        bgImg = await loadImage(battlefieldPresetOrBg);
      } catch {
        bgImg = null;
      }
    } else {
      stagePreset = battlefieldPresetOrBg;
    }
  }

  if (isClientCanvas) {
    renderMasterCommandSealSingleFrame(
      ctx,
      800,
      420,
      2,
      masterName,
      quoteText,
      masterImg,
      commandSealsCount,
      servantName,
      servantClass,
      servantImg,
      bgImg,
      stagePreset
    );
    return MINIMAL_VALID_PNG;
  }

  // Server execution: Build animated GIF with 8 action frames if gifenc is available
  if (gifencModule && typeof gifencModule.GIFEncoder === 'function') {
    try {
      const { GIFEncoder, quantize, applyPalette } = gifencModule;
      const gif = GIFEncoder();
      const totalFrames = 8;
      const frameDelay = 120; // 120ms per frame

      for (let f = 0; f < totalFrames; f++) {
        ctx.clearRect(0, 0, 800, 420);
        renderMasterCommandSealSingleFrame(
          ctx,
          800,
          420,
          f,
          masterName,
          quoteText,
          masterImg,
          commandSealsCount,
          servantName,
          servantClass,
          servantImg,
          bgImg,
          stagePreset
        );

        const imgData = ctx.getImageData(0, 0, 800, 420);
        const palette = quantize(imgData.data, 256);
        const index = applyPalette(imgData.data, palette);
        gif.writeFrame(index, 800, 420, { palette, delay: frameDelay });
      }

      gif.finish();
      const gifBytes = gif.bytes();
      return Buffer.from(gifBytes);
    } catch (gifErr) {
      console.warn('GIF encoding failed for Master Command Seal dialogue, falling back to static PNG:', gifErr);
    }
  }

  // Fallback: Static PNG of climax frame (Frame 2)
  renderMasterCommandSealSingleFrame(
    ctx,
    800,
    420,
    2,
    masterName,
    quoteText,
    masterImg,
    commandSealsCount,
    servantName,
    servantClass,
    servantImg,
    bgImg,
    stagePreset
  );

  try {
    return canvas.toBuffer('image/png');
  } catch {
    return MINIMAL_VALID_PNG;
  }
}

/**
 * Render a single frame of the Dedicated Arcane Skill Visual Novel Cut-In (800x420)
 * Features casting servant portrait, glowing arcane aura, spinning runic magic circle,
 * tactical enhancement tiles, dynamic mana burst particles, and spoken incantation dialogue.
 */
function renderSkillSingleFrame(
  ctx: any,
  width: number,
  height: number,
  frameIdx: number,
  speakerName: string,
  skillName: string,
  skillQuote: string,
  servantClass: string = 'Saber',
  portraitImg: any = null,
  bondOrLevel: number | string = 10,
  skillType: string = 'buff',
  skillEffects: string[] = [],
  bgImg: any = null,
  stagePreset: string = 'fuyuki'
) {
  // 1. Stage / Battlefield Background
  drawBattlefieldStage(ctx, width, height, bgImg, stagePreset, frameIdx);

  // Deep Arcane Leyline Vignette
  const vig = ctx.createRadialGradient(width / 2, height / 2, 60, width / 2, height / 2, 440);
  vig.addColorStop(0, 'rgba(15, 23, 42, 0.25)');
  vig.addColorStop(0.7, 'rgba(2, 6, 23, 0.60)');
  vig.addColorStop(1, 'rgba(2, 6, 23, 0.85)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);

  // 2. Casting Servant Hovering Sprite (Left Side)
  drawHoveringAttacker(ctx, portraitImg, speakerName, servantClass, bondOrLevel, frameIdx, true);

  // 3. Center Tactical Skill Activation HUD & Rune Core
  drawSkillCenterHUD(ctx, skillName, servantClass, frameIdx, skillEffects, skillType);

  // 4. Animated Skill Mana Burst & Leyline Aura Shockwave
  drawSkillAuraAnimation(ctx, frameIdx, servantClass);

  // 5. Visual Novel Dialogue Ribbon (Lower Section)
  const boxX = 22;
  const boxY = 248;
  const boxW = 756;
  const boxH = 154;

  ctx.fillStyle = 'rgba(10, 5, 3, 0.90)';
  drawRoundRect(ctx, boxX, boxY, boxW, boxH, 4);
  ctx.fill();

  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 2;
  drawRoundRect(ctx, boxX, boxY, boxW, boxH, 4);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(254, 240, 138, 0.35)';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, boxX + 3, boxY + 3, boxW - 6, boxH - 6, 3);
  ctx.stroke();

  // Corner Filigree Brackets
  const boxCbLen = 12;
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(boxX + 3, boxY + 3 + boxCbLen);
  ctx.lineTo(boxX + 3, boxY + 3);
  ctx.lineTo(boxX + 3 + boxCbLen, boxY + 3);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(boxX + boxW - 3 - boxCbLen, boxY + 3);
  ctx.lineTo(boxX + boxW - 3, boxY + 3);
  ctx.lineTo(boxX + boxW - 3, boxY + 3 + boxCbLen);
  ctx.stroke();

  // Speaker Nameplate Tab
  ctx.font = 'bold 15px sans-serif';
  const nameLabel = `${speakerName} [${servantClass || 'Servant'}]`;
  const nameMetrics = ctx.measureText(nameLabel);
  const nameW = Math.max(180, Math.min(360, nameMetrics.width + 36));
  const nameH = 30;
  const nameX = boxX + 20;
  const nameY = boxY - 16;

  ctx.fillStyle = '#0d0704';
  drawRoundRect(ctx, nameX, nameY, nameW, nameH, 4);
  ctx.fill();

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  drawRoundRect(ctx, nameX, nameY, nameW, nameH, 4);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(254, 240, 138, 0.4)';
  ctx.lineWidth = 0.8;
  drawRoundRect(ctx, nameX + 2, nameY + 2, nameW - 4, nameH - 4, 3);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${speakerName} [${(servantClass || 'Servant').toUpperCase()}]`, nameX + nameW / 2, nameY + 20);

  // Dialogue Quote Text (24px Serif)
  const textX = boxX + 28;
  const textY = boxY + 42;
  const maxTextW = boxW - 56;
  const lineHeight = 32;

  ctx.fillStyle = '#fffbeb';
  ctx.font = 'bold 24px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'left';

  const cleanQuote = (skillQuote || `Witness the true power of ${skillName}!`).replace(/^["“]/, '').replace(/["”]$/, '').trim();
  drawWrappedText(ctx, `“${cleanQuote}”`, textX, textY, maxTextW, lineHeight, 3);

  // Continuation Prompt Indicator
  const promptScale = frameIdx % 2 === 0 ? 6 : 5;
  drawSparkDiamond(ctx, boxX + boxW - 24, boxY + boxH - 20, promptScale, '#38bdf8');
}

/**
 * Render Dedicated Skill Activation Dialogue Card (800x420 Animated GIF or PNG)
 */
export async function renderSkillDialogueCard(
  canvasOrSpeaker: any,
  skillNameOrQuote?: any,
  skillQuoteOrEffects?: any,
  servantClass: string = 'Saber',
  avatarUrl?: string,
  bondOrLevel: number | string = 10,
  skillType: string = 'buff',
  skillEffects: string[] = [],
  battlefieldPresetOrBg: string = 'fuyuki'
): Promise<Buffer> {
  const isClientCanvas = canvasOrSpeaker && typeof canvasOrSpeaker.getContext === 'function';
  let speakerName = 'Heroic Spirit';
  let skillName = 'Tactical Skill';
  let skillQuote = 'Witness my power!';
  let effects: string[] = skillEffects;

  if (isClientCanvas) {
    speakerName = skillNameOrQuote || 'Heroic Spirit';
    skillName = skillQuoteOrEffects || 'Tactical Skill';
    skillQuote = avatarUrl || 'Witness my power!';
    effects = Array.isArray(skillEffects) ? skillEffects : [];
  } else {
    speakerName = canvasOrSpeaker || 'Heroic Spirit';
    skillName = skillNameOrQuote || 'Tactical Skill';
    skillQuote = skillQuoteOrEffects || 'Witness my power!';
    effects = Array.isArray(skillEffects) ? skillEffects : [];
  }

  let canvas: any;
  let ctx: any;

  if (isClientCanvas) {
    canvas = canvasOrSpeaker;
    ctx = canvas.getContext('2d');
    canvas.width = 800;
    canvas.height = 420;
  } else {
    canvas = createCanvas(800, 420);
    ctx = canvas.getContext('2d');
  }

  let portraitImg: any = null;
  if (avatarUrl && !isClientCanvas) {
    try {
      portraitImg = await loadImage(avatarUrl);
    } catch {
      portraitImg = null;
    }
  }

  let bgImg: any = null;
  let stagePreset = 'fuyuki';
  if (battlefieldPresetOrBg) {
    if (battlefieldPresetOrBg.startsWith('http') || battlefieldPresetOrBg.startsWith('data:')) {
      try {
        bgImg = await loadImage(battlefieldPresetOrBg);
      } catch {
        bgImg = null;
      }
    } else {
      stagePreset = battlefieldPresetOrBg;
    }
  }

  if (isClientCanvas) {
    renderSkillSingleFrame(
      ctx,
      800,
      420,
      2,
      speakerName,
      skillName,
      skillQuote,
      servantClass,
      portraitImg,
      bondOrLevel,
      skillType,
      effects,
      bgImg,
      stagePreset
    );
    return MINIMAL_VALID_PNG;
  }

  if (gifencModule && typeof gifencModule.GIFEncoder === 'function') {
    try {
      const { GIFEncoder, quantize, applyPalette } = gifencModule;
      const gif = GIFEncoder();
      const totalFrames = 8;
      const frameDelay = 120;

      for (let f = 0; f < totalFrames; f++) {
        ctx.clearRect(0, 0, 800, 420);
        renderSkillSingleFrame(
          ctx,
          800,
          420,
          f,
          speakerName,
          skillName,
          skillQuote,
          servantClass,
          portraitImg,
          bondOrLevel,
          skillType,
          effects,
          bgImg,
          stagePreset
        );
        const imgData = ctx.getImageData(0, 0, 800, 420);
        const palette = quantize(imgData.data, 256);
        const index = applyPalette(imgData.data, palette);
        gif.writeFrame(index, 800, 420, { palette, delay: frameDelay });
      }
      gif.finish();
      const gifBytes = gif.bytes();
      return Buffer.from(gifBytes);
    } catch (gifErr) {
      console.warn('GIF encoding failed for skill dialogue, falling back to static PNG:', gifErr);
    }
  }

  renderSkillSingleFrame(
    ctx,
    800,
    420,
    2,
    speakerName,
    skillName,
    skillQuote,
    servantClass,
    portraitImg,
    bondOrLevel,
    skillType,
    effects,
    bgImg,
    stagePreset
  );

  try {
    return canvas.toBuffer('image/png');
  } catch {
    return MINIMAL_VALID_PNG;
  }
}

/**
 * Render a single frame of the Tragic Servant Defeat Visual Novel Cut-In (800x420)
 * Features Spirit Origin Dissolution background, desaturated/grayscale tinted defeated portrait,
 * rising spectral embers, shattered glass polygons, metallic filigree warning header,
 * and high-contrast dialogue box displaying the Servant's authentic last words.
 */
function renderDefeatSingleFrame(
  ctx: any,
  width: number,
  height: number,
  frameIdx: number,
  speakerName: string,
  defeatQuote: string,
  defeatTag: string,
  servantClass: string,
  portraitImg: any,
  bondOrLevel: number | string,
  victorName: string,
  victorImg: any,
  victorClass: string,
  bgImg: any = null,
  stagePreset: string = 'fuyuki'
) {
  // 1. Somber Tragic Battlefield Stage Background with Crimson/Purple Vignette
  drawBattlefieldStage(ctx, width, height, bgImg, stagePreset, frameIdx);

  // Dark Tragic Vignette & Color Grading Overlay
  const darkVignette = ctx.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, 450);
  darkVignette.addColorStop(0, 'rgba(15, 3, 5, 0.55)');
  darkVignette.addColorStop(0.7, 'rgba(25, 4, 8, 0.88)');
  darkVignette.addColorStop(1, 'rgba(8, 2, 3, 0.98)');
  ctx.fillStyle = darkVignette;
  ctx.fillRect(0, 0, width, height);

  // 2. Rising Spirit Origin Dissolution Embers & Shattered Glass Shards
  ctx.save();
  for (let i = 0; i < 24; i++) {
    const emberX = ((i * 37 + frameIdx * 8) % 760) + 20;
    const emberY = 380 - ((i * 23 + frameIdx * 12) % 360);
    const emberSize = (i % 3) + 2;
    const alpha = Math.max(0.2, 1 - (380 - emberY) / 360);

    ctx.fillStyle = i % 2 === 0 ? `rgba(239, 68, 68, ${alpha})` : `rgba(245, 158, 11, ${alpha})`;
    ctx.beginPath();
    ctx.arc(emberX, emberY, emberSize, 0, Math.PI * 2);
    ctx.fill();

    // Floating Glass Fragment (Triangles)
    if (i % 4 === 0) {
      ctx.save();
      ctx.translate(emberX, emberY);
      ctx.rotate((frameIdx * 0.1) + i);
      ctx.strokeStyle = `rgba(254, 240, 138, ${alpha * 0.7})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4, 4);
      ctx.lineTo(-4, 4);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();

  // 3. Defeated Servant Sprite (Left Side - 280x340) - Grayscale / Crimson Dissolution Tint
  ctx.save();
  const spriteW = 280;
  const spriteH = 340;
  const spriteX = 10;
  const spriteY = 20;

  // Crimson Dissolution Aura
  const auraGrad = ctx.createRadialGradient(150, 180, 20, 150, 180, 180);
  auraGrad.addColorStop(0, 'rgba(220, 38, 38, 0.35)');
  auraGrad.addColorStop(0.7, 'rgba(127, 29, 29, 0.15)');
  auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = auraGrad;
  ctx.fillRect(spriteX - 20, spriteY, spriteW + 40, spriteH);

  // Clip & Draw Defeated Servant Portrait
  ctx.save();
  ctx.beginPath();
  ctx.rect(spriteX, spriteY, spriteW, spriteH);
  ctx.clip();

  if (portraitImg) {
    drawImageCover(ctx, portraitImg, spriteX, spriteY, spriteW, spriteH);
    // Apply Dark Crimson & Desaturation Tint Overlay over portrait
    const tintGrad = ctx.createLinearGradient(spriteX, spriteY, spriteX, spriteY + spriteH);
    tintGrad.addColorStop(0, 'rgba(20, 5, 5, 0.40)');
    tintGrad.addColorStop(0.5, 'rgba(153, 27, 27, 0.30)');
    tintGrad.addColorStop(1, 'rgba(10, 2, 2, 0.75)');
    ctx.fillStyle = tintGrad;
    ctx.fillRect(spriteX, spriteY, spriteW, spriteH);
  } else {
    const fbGrad = ctx.createLinearGradient(spriteX, spriteY, spriteX, spriteY + spriteH);
    fbGrad.addColorStop(0, '#3b0707');
    fbGrad.addColorStop(1, '#0f0202');
    ctx.fillStyle = fbGrad;
    ctx.fillRect(spriteX, spriteY, spriteW, spriteH);
  }

  // Vertical Scanning Dissolution Dissolve Lines
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
  ctx.lineWidth = 1;
  for (let ly = spriteY; ly < spriteY + spriteH; ly += 8) {
    ctx.beginPath();
    ctx.moveTo(spriteX, ly);
    ctx.lineTo(spriteX + spriteW, ly);
    ctx.stroke();
  }

  // Right Edge Smooth Fade
  const fadeRight = ctx.createLinearGradient(spriteX + spriteW - 90, spriteY, spriteX + spriteW, spriteY);
  fadeRight.addColorStop(0, 'rgba(10, 3, 5, 0)');
  fadeRight.addColorStop(1, 'rgba(10, 3, 5, 0.95)');
  ctx.fillStyle = fadeRight;
  ctx.fillRect(spriteX + spriteW - 90, spriteY, 90, spriteH);

  ctx.restore();

  ctx.restore();

  // 4. Victor / Opponent Hovering Sprite (Right Side - Sharp Contrast)
  drawHoveringDefender(ctx, victorImg, victorName, victorClass, frameIdx, true);

  // 5. Center Defeat Warning Header Banner (Golden / Crimson Filigree)
  const bannerW = 360;
  const bannerH = 38;
  const bannerX = 220;
  const bannerY = 22;

  const bGrad = ctx.createLinearGradient(bannerX, bannerY, bannerX, bannerY + bannerH);
  bGrad.addColorStop(0, '#991b1b');
  bGrad.addColorStop(1, '#180303');
  ctx.fillStyle = bGrad;
  drawRoundRect(ctx, bannerX, bannerY, bannerW, bannerH, 4);
  ctx.fill();

  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 2;
  drawRoundRect(ctx, bannerX, bannerY, bannerW, bannerH, 4);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(254, 240, 138, 0.4)';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, bannerX + 3, bannerY + 3, bannerW - 6, bannerH - 6, 3);
  ctx.stroke();

  // Header Title
  const cleanTag = (defeatTag || 'SPIRIT ORIGIN DISSOLVED').toUpperCase();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`[ ${cleanTag} ]`, bannerX + bannerW / 2, bannerY + 16);

  ctx.fillStyle = '#fca5a5';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('Contract Severance • Final Defeat Quote', bannerX + bannerW / 2, bannerY + 30);

  // 6. Visual Novel Dialogue Ribbon (Lower Section - 756x154)
  const boxX = 22;
  const boxY = 248;
  const boxW = 756;
  const boxH = 154;

  // Obsidian Base Box
  ctx.fillStyle = 'rgba(12, 4, 6, 0.94)';
  drawRoundRect(ctx, boxX, boxY, boxW, boxH, 4);
  ctx.fill();

  // Double Metallic Border (Crimson Outer, Gold Inner)
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 2;
  drawRoundRect(ctx, boxX, boxY, boxW, boxH, 4);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(217, 119, 6, 0.5)';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, boxX + 3, boxY + 3, boxW - 6, boxH - 6, 3);
  ctx.stroke();

  // Corner Filigree Brackets
  const boxCbLen = 12;
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(boxX + 3, boxY + 3 + boxCbLen);
  ctx.lineTo(boxX + 3, boxY + 3);
  ctx.lineTo(boxX + 3 + boxCbLen, boxY + 3);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(boxX + boxW - 3 - boxCbLen, boxY + 3);
  ctx.lineTo(boxX + boxW - 3, boxY + 3);
  ctx.lineTo(boxX + boxW - 3, boxY + 3 + boxCbLen);
  ctx.stroke();

  // 7. Speaker Nameplate Tab (Overlapping top-left)
  ctx.font = 'bold 15px sans-serif';
  const nameLabel = `${speakerName} [${(servantClass || 'Servant').toUpperCase()} • DEFEATED]`;
  const nameMetrics = ctx.measureText(nameLabel);
  const nameW = Math.max(200, Math.min(380, nameMetrics.width + 36));
  const nameH = 30;
  const nameX = boxX + 20;
  const nameY = boxY - 16;

  ctx.fillStyle = '#170303';
  drawRoundRect(ctx, nameX, nameY, nameW, nameH, 4);
  ctx.fill();

  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 2;
  drawRoundRect(ctx, nameX, nameY, nameW, nameH, 4);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(nameLabel, nameX + nameW / 2, nameY + 20);

  // 8. Tragic Defeat Dialogue Quote Text (Large, High Contrast 23px Serif)
  const textX = boxX + 28;
  const textY = boxY + 42;
  const maxTextW = boxW - 56;
  const lineHeight = 32;

  ctx.fillStyle = '#fff1f2';
  ctx.font = 'italic bold 23px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'left';

  const cleanQuote = defeatQuote.replace(/^["“]/, '').replace(/["”]$/, '').trim();
  drawWrappedText(ctx, `“${cleanQuote}”`, textX, textY, maxTextW, lineHeight, 3);

  // 9. Pulsing Shattered Gem Prompt Indicator (Bottom Right)
  const promptScale = frameIdx % 2 === 0 ? 6 : 5;
  drawSparkDiamond(ctx, boxX + boxW - 24, boxY + boxH - 20, promptScale, '#ef4444');
}

/**
 * Render Visual Novel Defeat Dialogue Frame (800x420 Spirit Origin Dissolution Frame)
 * Features Tragic Dark Crimson/Obsidian Backdrop, Shattered Glass & Dissolution Embers,
 * Desaturated/Grayscale Defeated Servant Portrait, Metallic Filigree Warning Header,
 * and Large High-Contrast Defeat Quote Box.
 */
export async function renderDefeatDialogueCard(
  canvasOrSpeaker: any,
  quoteOrSpeaker?: any,
  defeatTag: string = 'SPIRIT ORIGIN DISSOLVED',
  servantClass: string = 'Saber',
  avatarUrl?: string,
  bondOrLevel: number | string = 8,
  victorName: string = 'Opponent Servant',
  victorAvatarUrl?: string,
  victorClass: string = 'Enemy',
  battlefieldPresetOrBg: string = 'fuyuki'
): Promise<Buffer> {
  let canvas: any;
  let speakerName: string;
  let defeatQuote: string;

  const isClientCanvas = canvasOrSpeaker && typeof canvasOrSpeaker.getContext === 'function';

  if (isClientCanvas) {
    canvas = canvasOrSpeaker;
    speakerName = quoteOrSpeaker || 'Heroic Spirit';
    defeatQuote = defeatTag || '';
  } else {
    canvas = createCanvas(800, 420);
    speakerName = canvasOrSpeaker || 'Heroic Spirit';
    defeatQuote = quoteOrSpeaker || '';
  }

  if (canvas.width !== 800 || canvas.height !== 420) {
    canvas.width = 800;
    canvas.height = 420;
  }
  const ctx = canvas.getContext('2d');

  let portraitImg: any = null;
  if (avatarUrl) {
    try {
      portraitImg = await loadImage(avatarUrl);
    } catch {
      portraitImg = null;
    }
  }

  let victorImg: any = null;
  if (victorAvatarUrl) {
    try {
      victorImg = await loadImage(victorAvatarUrl);
    } catch {
      victorImg = null;
    }
  }

  let bgImg: any = null;
  let stagePreset = 'fuyuki';
  if (battlefieldPresetOrBg) {
    if (battlefieldPresetOrBg.startsWith('http') || battlefieldPresetOrBg.startsWith('data:')) {
      try {
        bgImg = await loadImage(battlefieldPresetOrBg);
      } catch {
        bgImg = null;
      }
    } else {
      stagePreset = battlefieldPresetOrBg;
    }
  }

  if (isClientCanvas) {
    renderDefeatSingleFrame(
      ctx,
      800,
      420,
      2,
      speakerName,
      defeatQuote,
      defeatTag,
      servantClass,
      portraitImg,
      bondOrLevel,
      victorName,
      victorImg,
      victorClass,
      bgImg,
      stagePreset
    );
    return MINIMAL_VALID_PNG;
  }

  // Server Animated GIF execution
  if (gifencModule && typeof gifencModule.GIFEncoder === 'function') {
    try {
      const { GIFEncoder, quantize, applyPalette } = gifencModule;
      const gif = GIFEncoder();
      const totalFrames = 8;
      const frameDelay = 120;

      for (let f = 0; f < totalFrames; f++) {
        ctx.clearRect(0, 0, 800, 420);
        renderDefeatSingleFrame(
          ctx,
          800,
          420,
          f,
          speakerName,
          defeatQuote,
          defeatTag,
          servantClass,
          portraitImg,
          bondOrLevel,
          victorName,
          victorImg,
          victorClass,
          bgImg,
          stagePreset
        );

        const imgData = ctx.getImageData(0, 0, 800, 420);
        const palette = quantize(imgData.data, 256);
        const index = applyPalette(imgData.data, palette);
        gif.writeFrame(index, 800, 420, { palette, delay: frameDelay, repeat: f === 0 ? 0 : undefined });
      }

      gif.finish();
      const gifBuffer = Buffer.from(gif.bytes());
      if (gifBuffer && gifBuffer.length > 500) {
        return gifBuffer;
      }
    } catch (animErr) {
      console.warn('Animated Defeat GIF generation failed, falling back to static PNG:', animErr);
    }
  }

  renderDefeatSingleFrame(
    ctx,
    800,
    420,
    2,
    speakerName,
    defeatQuote,
    defeatTag,
    servantClass,
    portraitImg,
    bondOrLevel,
    victorName,
    victorImg,
    victorClass,
    bgImg,
    stagePreset
  );

  try {
    return canvas.toBuffer('image/png');
  } catch {
    return MINIMAL_VALID_PNG;
  }
}

/**
 * Draw Targeting Reticle Overlay (Modular Multi-Combat Reticle)
 */
function drawTargetReticle(
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string = 'TARGET'
) {
  ctx.save();
  const bracketLen = 14;
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 6;

  // Top-Left
  ctx.beginPath();
  ctx.moveTo(x - 2, y + bracketLen);
  ctx.lineTo(x - 2, y - 2);
  ctx.lineTo(x + bracketLen, y - 2);
  ctx.stroke();

  // Top-Right
  ctx.beginPath();
  ctx.moveTo(x + w + 2 - bracketLen, y - 2);
  ctx.lineTo(x + w + 2, y - 2);
  ctx.lineTo(x + w + 2, y + bracketLen);
  ctx.stroke();

  // Bottom-Left
  ctx.beginPath();
  ctx.moveTo(x - 2, y + h - bracketLen);
  ctx.lineTo(x - 2, y + h + 2);
  ctx.lineTo(x + bracketLen, y + h + 2);
  ctx.stroke();

  // Bottom-Right
  ctx.beginPath();
  ctx.moveTo(x + w + 2 - bracketLen, y + h + 2);
  ctx.lineTo(x + w + 2, y + h + 2);
  ctx.lineTo(x + w + 2, y + h + 2 - bracketLen);
  ctx.stroke();

  ctx.shadowBlur = 0;

  // Center-Top Lock Badge
  const badgeW = 74;
  const badgeH = 18;
  const badgeX = x + w / 2 - badgeW / 2;
  const badgeY = y - 8;

  ctx.fillStyle = '#78350f';
  drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.2;
  drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
  ctx.stroke();

  drawVectorStar(ctx, badgeX + 10, badgeY + 9, 4, 3.5, 1.8, '#fde047');
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 8.5px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, badgeX + badgeW / 2 + 5, badgeY + 12.5);

  ctx.restore();
}

/**
 * Draw Defeated / Fallen Overlay
 */
function drawDefeatedOverlay(
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string = 'FALLEN'
) {
  ctx.save();
  ctx.fillStyle = 'rgba(5, 7, 15, 0.82)';
  drawRoundRect(ctx, x, y, w, h, 8);
  ctx.fill();

  ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 10, y + 10);
  ctx.lineTo(x + w - 10, y + h - 10);
  ctx.stroke();

  const bannerW = Math.min(w - 16, 116);
  const bannerH = 26;
  const bannerX = x + (w - bannerW) / 2;
  const bannerY = y + h / 2 - bannerH / 2 - 10;

  ctx.fillStyle = 'rgba(153, 27, 27, 0.9)';
  drawRoundRect(ctx, bannerX, bannerY, bannerW, bannerH, 4);
  ctx.fill();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.2;
  drawRoundRect(ctx, bannerX, bannerY, bannerW, bannerH, 4);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`☠️ ${label}`, bannerX + bannerW / 2, bannerY + 17);

  ctx.restore();
}

/**
 * Integrated Servant Combatant HUD Plate
 * (Binds Portrait Artwork, Role, Class, Dynamic HP Bar, NP Bar, Skills & Reticle)
 */
function drawUnitHudPlate(
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  avatarImg: any,
  servant: ActiveCombatant,
  roleLabel: string,
  accentColor: string,
  isTargeted: boolean = false,
  showBars: boolean = true
) {
  const isDefeated = servant.currentHp <= 0;
  ctx.save();

  // 1. Base Container Box
  ctx.fillStyle = '#0a0f1d';
  drawRoundRect(ctx, x, y, w, h, 8);
  ctx.fill();

  // Metallic Frame
  ctx.strokeStyle = isTargeted ? '#f59e0b' : isDefeated ? '#334155' : accentColor;
  ctx.lineWidth = isTargeted ? 2 : 1.4;
  drawRoundRect(ctx, x, y, w, h, 8);
  ctx.stroke();

  // Inner border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 0.8;
  drawRoundRect(ctx, x + 2, y + 2, w - 4, h - 4, 6);
  ctx.stroke();

  // 2. Portrait Area
  const portraitH = showBars ? (h - 68) : (h - 6);
  const pX = x + 3;
  const pY = y + 3;
  const pW = w - 6;

  if (avatarImg) {
    ctx.save();
    drawRoundRect(ctx, pX, pY, pW, portraitH, 6);
    ctx.clip();
    drawImageCover(ctx, avatarImg, pX, pY, pW, portraitH);

    // Vignette for name contrast
    const vGrad = ctx.createLinearGradient(pX, pY + portraitH - 46, pX, pY + portraitH);
    vGrad.addColorStop(0, 'rgba(10, 15, 26, 0)');
    vGrad.addColorStop(1, 'rgba(10, 15, 26, 0.95)');
    ctx.fillStyle = vGrad;
    ctx.fillRect(pX, pY + portraitH - 46, pW, 46);
    ctx.restore();
  } else {
    const bgGrad = ctx.createRadialGradient(pX + pW / 2, pY + portraitH / 2, 5, pX + pW / 2, pY + portraitH / 2, pW * 0.7);
    bgGrad.addColorStop(0, '#1e293b');
    bgGrad.addColorStop(1, '#090d16');
    ctx.fillStyle = bgGrad;
    drawRoundRect(ctx, pX, pY, pW, portraitH, 6);
    ctx.fill();

    const cy = pY + Math.round(portraitH * 0.4);
    drawVectorShield(ctx, pX + pW / 2, cy, 38, 46, `${accentColor}22`, accentColor);
    drawVectorCrossedSwords(ctx, pX + pW / 2, cy, 12, '#ffffff');
  }

  // Role Pill on Top-Left
  const roleW = Math.min(pW - 10, roleLabel.length * 6.5 + 14);
  ctx.fillStyle = 'rgba(10, 15, 26, 0.88)';
  drawRoundRect(ctx, pX + 4, pY + 4, roleW, 16, 4);
  ctx.fill();
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 0.9;
  drawRoundRect(ctx, pX + 4, pY + 4, roleW, 16, 4);
  ctx.stroke();

  ctx.fillStyle = accentColor;
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(roleLabel, pX + 4 + roleW / 2, pY + 15);

  // Class Pill on Top-Right
  const sClass = (servant.servantClass || 'SABER').toUpperCase();
  const classW = 44;
  ctx.fillStyle = 'rgba(10, 15, 26, 0.88)';
  drawRoundRect(ctx, pX + pW - classW - 4, pY + 4, classW, 16, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 0.8;
  drawRoundRect(ctx, pX + pW - classW - 4, pY + 4, classW, 16, 4);
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(sClass, pX + pW - classW / 2 - 4, pY + 15);

  // Servant Name (Bottom of Portrait)
  const sCleanName = (servant.name || 'Heroic Spirit').replace(/[^\x00-\x7F]/g, '');
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(sCleanName.length > 15 ? sCleanName.slice(0, 14) + '…' : sCleanName, pX + 6, pY + portraitH - 8);

  if (showBars) {
    // 3. Integrated HP Bar (Height: 18px)
    const hpY = pY + portraitH + 4;
    const barW = w - 10;
    const barX = x + 5;
    const hpRatio = Math.max(0, Math.min(1, servant.currentHp / (servant.maxHp || 1)));

    ctx.fillStyle = '#090d16';
    drawRoundRect(ctx, barX, hpY, barW, 18, 4);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    drawRoundRect(ctx, barX, hpY, barW, 18, 4);
    ctx.stroke();

    if (hpRatio > 0) {
      const hpGrad = ctx.createLinearGradient(barX, hpY, barX, hpY + 18);
      if (hpRatio > 0.35) {
        hpGrad.addColorStop(0, '#22c55e');
        hpGrad.addColorStop(1, '#15803d');
      } else {
        hpGrad.addColorStop(0, '#ef4444');
        hpGrad.addColorStop(1, '#991b1b');
      }
      ctx.fillStyle = hpGrad;
      drawRoundRect(ctx, barX, hpY, Math.max(6, barW * hpRatio), 18, 4);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      drawRoundRect(ctx, barX, hpY, Math.max(6, barW * hpRatio), 8, 4);
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9.5px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`HP ${Math.round(hpRatio * 100)}%`, barX + 6, hpY + 13);
    ctx.textAlign = 'right';
    ctx.fillText(`${servant.currentHp.toLocaleString()}`, barX + barW - 6, hpY + 13);

    // 4. Integrated NP Bar (Height: 16px)
    const npY = hpY + 22;
    const npRatio = Math.max(0, Math.min(1, (servant.npGauge || 0) / 100));

    ctx.fillStyle = '#090d16';
    drawRoundRect(ctx, barX, npY, barW, 16, 4);
    ctx.fill();
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1;
    drawRoundRect(ctx, barX, npY, barW, 16, 4);
    ctx.stroke();

    if (npRatio > 0) {
      const npGrad = ctx.createLinearGradient(barX, npY, barX, npY + 16);
      if ((servant.npGauge || 0) >= 100) {
        npGrad.addColorStop(0, '#fde047');
        npGrad.addColorStop(1, '#d97706');
      } else {
        npGrad.addColorStop(0, '#facc15');
        npGrad.addColorStop(1, '#ca8a04');
      }
      ctx.fillStyle = npGrad;
      drawRoundRect(ctx, barX, npY, Math.max(6, barW * npRatio), 16, 4);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      drawRoundRect(ctx, barX, npY, Math.max(6, barW * npRatio), 7, 4);
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`NP ${Math.round(servant.npGauge || 0)}%`, barX + 6, npY + 12);

    if ((servant.npGauge || 0) >= 100) {
      ctx.fillStyle = '#fde047';
      ctx.textAlign = 'right';
      ctx.fillText('MAX RDY', barX + barW - 6, npY + 12);
    }
  }

  // 5. Defeated Overlay
  if (isDefeated) {
    drawDefeatedOverlay(ctx, x, y, w, h, 'FALLEN');
  }

  // 6. Targeting Reticle
  if (isTargeted) {
    drawTargetReticle(ctx, x, y, w, h, 'LOCKED');
  }

  ctx.restore();
}

/**
 * Draw Tarot Command Card with Optional Servant Attribution
 */
function drawAttributedCommandCard(
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  cardType: string,
  stepIndex: number,
  critStars: number = 0,
  isQuickFirst: boolean = false,
  attribution?: string
) {
  drawTarotCommandCard(ctx, x, y, w, h, cardType as any, stepIndex, critStars, isQuickFirst);

  if (attribution) {
    ctx.save();
    const tagW = w - 16;
    const tagH = 15;
    const tagX = x + 8;
    const tagY = y + 30;

    ctx.fillStyle = 'rgba(10, 15, 26, 0.9)';
    drawRoundRect(ctx, tagX, tagY, tagW, tagH, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 0.7;
    drawRoundRect(ctx, tagX, tagY, tagW, tagH, 3);
    ctx.stroke();

    ctx.fillStyle = '#93c5fd';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(attribution.slice(0, 12), tagX + tagW / 2, tagY + 11);
    ctx.restore();
  }
}

/**
 * 3. Render Battle Turn Summary (640x700 Modular 1v1, 2v2 & 1v2 Clash Engine)
 * Supports both headless Buffer generation (Discord Bot / Server API)
 * and direct HTML5 Canvas rendering (DiscordEmulator / CanvasStudio).
 */
export async function renderBattleTurnSummary(
  canvas: any,
  log: CombatTurnLog,
  p1: ActiveCombatant,
  p2: ActiveCombatant,
  p1Ally?: ActiveCombatant,
  p2Ally?: ActiveCombatant,
  teamA?: ActiveCombatant[],
  teamB?: ActiveCombatant[]
): Promise<Buffer>;
export async function renderBattleTurnSummary(
  log: CombatTurnLog,
  p1: ActiveCombatant,
  p2: ActiveCombatant,
  p1Ally?: ActiveCombatant,
  p2Ally?: ActiveCombatant,
  teamA?: ActiveCombatant[],
  teamB?: ActiveCombatant[]
): Promise<Buffer>;
export async function renderBattleTurnSummary(
  canvasOrLog: any,
  logOrP1: any,
  p1OrP2: any,
  p2Optional?: any,
  p1AllyOptional?: any,
  p2AllyOptional?: any,
  teamAOptional?: any,
  teamBOptional?: any
): Promise<Buffer> {
  let canvas: any;
  let log: CombatTurnLog;
  let p1: ActiveCombatant;
  let p2: ActiveCombatant;
  let p1Ally: ActiveCombatant | undefined;
  let p2Ally: ActiveCombatant | undefined;
  let teamA: ActiveCombatant[] | undefined;
  let teamB: ActiveCombatant[] | undefined;
  const isClientCanvas = canvasOrLog && typeof canvasOrLog.getContext === 'function';

  if (isClientCanvas) {
    canvas = canvasOrLog;
    log = logOrP1;
    p1 = p1OrP2;
    p2 = p2Optional;
    p1Ally = p1AllyOptional;
    p2Ally = p2AllyOptional;
    teamA = teamAOptional;
    teamB = teamBOptional;
  } else {
    canvas = createCanvas(640, 700);
    log = canvasOrLog;
    p1 = logOrP1;
    p2 = p1OrP2;
    p1Ally = p2Optional;
    p2Ally = p1AllyOptional;
    teamA = p2AllyOptional;
    teamB = teamAOptional;
  }

  if (canvas.width !== 640 || canvas.height !== 700) {
    canvas.width = 640;
    canvas.height = 700;
  }
  const ctx = canvas.getContext('2d');

  // Resolve teams dynamically
  const resolvedTeamA = teamA && teamA.length > 0 ? teamA : [p1, ...(p1Ally ? [p1Ally] : [])].filter(Boolean);
  const resolvedTeamB = teamB && teamB.length > 0 ? teamB : [p2, ...(p2Ally ? [p2Ally] : [])].filter(Boolean);

  const isMultiTeamA = resolvedTeamA.length >= 2;
  const isMultiTeamB = resolvedTeamB.length >= 2;

  const activeP1 = resolvedTeamA[0] || p1;
  const activeP1Ally = resolvedTeamA[1] || p1Ally;
  const activeP2 = resolvedTeamB[0] || p2;
  const activeP2Ally = resolvedTeamB[1] || p2Ally;

  // Determine combat format tag
  let formatTag = '1v1';
  if (isMultiTeamA && isMultiTeamB) formatTag = '2v2';
  else if (isMultiTeamB) formatTag = '1v2';
  else if (isMultiTeamA) formatTag = '2v1';

  // Target lock analysis: check which enemy or player unit was targeted
  const targetSummary = (log.actionSummary || '').toLowerCase();
  const isP2AllyTargeted = isMultiTeamB && activeP2Ally && (log.targetIndex === 1 || targetSummary.includes(activeP2Ally.name.toLowerCase()));
  const isP2LeadTargeted = !isP2AllyTargeted;

  const isP1AllyTargeted = isMultiTeamA && activeP1Ally && (log.targetIndex === 1 || targetSummary.includes(activeP1Ally.name.toLowerCase()));
  const isP1LeadTargeted = !isP1AllyTargeted;

  // Load Avatars concurrently
  const [p1Img, p1AllyImg, p2Img, p2AllyImg] = await Promise.all([
    activeP1?.avatarUrl ? loadImage(activeP1.avatarUrl) : Promise.resolve(null),
    activeP1Ally?.avatarUrl ? loadImage(activeP1Ally.avatarUrl) : Promise.resolve(null),
    activeP2?.avatarUrl ? loadImage(activeP2.avatarUrl) : Promise.resolve(null),
    activeP2Ally?.avatarUrl ? loadImage(activeP2Ally.avatarUrl) : Promise.resolve(null)
  ]);

  // Background - Deep Mystic Slate War Canvas
  const bgGrad = ctx.createLinearGradient(0, 0, 640, 700);
  bgGrad.addColorStop(0, '#090d18');
  bgGrad.addColorStop(0.5, '#05070f');
  bgGrad.addColorStop(1, '#0c0b16');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 640, 700);

  // Subtle Matte Slate Frame
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.6;
  drawRoundRect(ctx, 6, 6, 628, 688, 10);
  ctx.stroke();

  // Inset hairline
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 0.8;
  drawRoundRect(ctx, 8, 8, 624, 684, 8);
  ctx.stroke();

  // ==========================================
  // TOP SECTION: TEAM A (PLAYER 1 & ALLIES)
  // ==========================================
  const p1Cards = (log.p1Cards || log.cardsUsed || ['Buster', 'Arts', 'Quick']) as ('Buster' | 'Arts' | 'Quick' | 'NP')[];
  const isP1QuickLead = p1Cards[0] === 'Quick';

  if (!isMultiTeamA) {
    // Standard Single Vanguard Layout
    drawUnitHudPlate(ctx, 16, 16, 172, 256, p1Img, activeP1, 'CHAMPION', '#38bdf8', isP1LeadTargeted, false);

    // P1 Header Title & Class Pill
    const p1DisplayName = (activeP1.masterName || 'Master 1').replace(/[^\x00-\x7F]/g, '');
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(p1DisplayName, 200, 32);

    const p1NameWidth = ctx.measureText(p1DisplayName).width;
    const p1ServantClean = (activeP1.name || 'Heroic Spirit').replace(/[^\x00-\x7F]/g, '');
    const p1ClassClean = (activeP1.servantClass || 'SABER').toUpperCase();

    // Class badge pill
    const pillX = 208 + p1NameWidth;
    const pillY = 18;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
    drawRoundRect(ctx, pillX, pillY, 64, 18, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1;
    drawRoundRect(ctx, pillX, pillY, 64, 18, 9);
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p1ClassClean, pillX + 32, pillY + 13);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(p1ServantClean, pillX + 72, 32);

    // 3 Active Skill Badges
    const p1Skills = activeP1.skills || [];
    const p1Bond = activeP1.bondLevel !== undefined ? activeP1.bondLevel : 5;
    [0, 1, 2].forEach((sIdx) => {
      const sBoxX = 432 + sIdx * 64;
      const sBoxY = 16;
      const sBoxW = 60;
      const sBoxH = 20;
      const sData = p1Skills[sIdx];
      const sCd = sData?.currentCooldown || 0;
      const isLocked = sIdx === 2 && p1Bond < 5;

      ctx.save();
      if (isLocked) {
        ctx.fillStyle = '#1e1b4b';
        drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
        ctx.fill();
        ctx.strokeStyle = '#4338ca';
        ctx.lineWidth = 0.8;
        drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
        ctx.stroke();

        drawVectorLock(ctx, sBoxX + 12, sBoxY + 10, '#a5b4fc');
        ctx.fillStyle = '#a5b4fc';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Bond 5', sBoxX + sBoxW / 2 + 6, sBoxY + 14);
      } else if (sCd > 0) {
        ctx.fillStyle = '#1e293b';
        drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 0.8;
        drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
        ctx.stroke();

        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`S${sIdx + 1}: ${sCd}T`, sBoxX + sBoxW / 2, sBoxY + 14);
      } else {
        ctx.fillStyle = sIdx === 2 ? '#064e3b' : '#075985';
        drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
        ctx.fill();
        ctx.strokeStyle = sIdx === 2 ? '#10b981' : '#38bdf8';
        ctx.lineWidth = 0.8;
        drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
        ctx.stroke();

        drawSparkDiamond(ctx, sBoxX + 11, sBoxY + 10, 3, '#ffffff');
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`S${sIdx + 1}: RDY`, sBoxX + sBoxW / 2 + 5, sBoxY + 14);
      }
      ctx.restore();
    });

    // P1 HP Bar
    const p1HpRatio = Math.max(0, Math.min(1, activeP1.currentHp / activeP1.maxHp));
    ctx.fillStyle = '#0f172a';
    drawRoundRect(ctx, 200, 40, 424, 22, 4);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;
    drawRoundRect(ctx, 200, 40, 424, 22, 4);
    ctx.stroke();

    if (p1HpRatio > 0) {
      const hpGrad = ctx.createLinearGradient(200, 40, 200, 62);
      hpGrad.addColorStop(0, p1HpRatio > 0.35 ? '#22c55e' : '#ef4444');
      hpGrad.addColorStop(1, p1HpRatio > 0.35 ? '#15803d' : '#b91c1c');
      ctx.fillStyle = hpGrad;
      drawRoundRect(ctx, 200, 40, Math.max(8, 424 * p1HpRatio), 22, 4);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      drawRoundRect(ctx, 200, 40, Math.max(8, 424 * p1HpRatio), 10, 4);
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`HP  ${activeP1.currentHp.toLocaleString()} / ${activeP1.maxHp.toLocaleString()} (${Math.round(p1HpRatio * 100)}%)`, 210, 56);

    // P1 NP Bar
    const p1NpRatio = Math.max(0, Math.min(1, (activeP1.npGauge || 0) / 100));
    ctx.fillStyle = '#0f172a';
    drawRoundRect(ctx, 200, 66, 424, 22, 4);
    ctx.fill();
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1.2;
    drawRoundRect(ctx, 200, 66, 424, 22, 4);
    ctx.stroke();

    if (p1NpRatio > 0) {
      const npGrad = ctx.createLinearGradient(200, 66, 200, 88);
      npGrad.addColorStop(0, (activeP1.npGauge || 0) >= 100 ? '#fde047' : '#facc15');
      npGrad.addColorStop(1, (activeP1.npGauge || 0) >= 100 ? '#d97706' : '#ca8a04');
      ctx.fillStyle = npGrad;
      drawRoundRect(ctx, 200, 66, Math.max(8, 424 * p1NpRatio), 22, 4);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      drawRoundRect(ctx, 200, 66, Math.max(8, 424 * p1NpRatio), 10, 4);
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    const p1NpText = `NP: ${Math.round(activeP1.npGauge || 0)}%`;
    ctx.fillText(p1NpText, 210, 82);

    if ((activeP1.npGauge || 0) >= 100) {
      const npTextW = ctx.measureText(p1NpText).width;
      drawVectorStar(ctx, 220 + npTextW, 78, 5, 4.5, 2.2, '#fde047');
      ctx.fillStyle = '#fde047';
      ctx.fillText('[MAX READY]', 228 + npTextW, 82);
    }

    // Crit Star Box & 3 Cards
    drawCritStarBox(ctx, 200, 92, 100, 180, activeP1.critStars || 0, false);
    p1Cards.slice(0, 3).forEach((card, idx) => {
      drawTarotCommandCard(ctx, 308 + idx * 108, 92, 100, 180, card, idx, activeP1.critStars || 0, isP1QuickLead);
    });
  } else {
    // Multi-Combatant Team A: 2 Avatars on Left, 2-Row Card Grid on Right
    drawUnitHudPlate(ctx, 16, 16, 138, 256, p1Img, activeP1, 'VANGUARD', '#38bdf8', isP1LeadTargeted);
    if (activeP1Ally) {
      drawUnitHudPlate(ctx, 158, 16, 138, 256, p1AllyImg, activeP1Ally, 'ALLIED FLANK', '#818cf8', isP1AllyTargeted);
    }

    // Right Side: 2-Row Grid with 4 Columns [Star, Card1, Card2, Card3]
    // Row 1 (Avatar 1 / Vanguard)
    drawCompactCritStarCard(ctx, 304, 16, 68, 124, activeP1.critStars || 0, false, activeP1.name || 'Vanguard');
    p1Cards.slice(0, 3).forEach((card, idx) => {
      drawCompactCommandCard(ctx, 378 + idx * 82, 16, 76, 124, card, idx, activeP1.critStars || 0, isP1QuickLead, activeP1.name);
    });

    // Row 2 (Avatar 2 / Allied Flank)
    const p1AllyCards = (log.p1AllyCards || (activeP1Ally?.commandDeck && activeP1Ally.commandDeck.length >= 3 ? activeP1Ally.commandDeck.slice(0, 3) : ['Quick', 'Arts', 'Buster'])) as ('Buster' | 'Arts' | 'Quick' | 'NP')[];
    const isP1AllyQuickLead = p1AllyCards[0] === 'Quick';
    drawCompactCritStarCard(ctx, 304, 148, 68, 124, activeP1Ally?.critStars || 0, false, activeP1Ally?.name || 'Flank');
    p1AllyCards.slice(0, 3).forEach((card, idx) => {
      drawCompactCommandCard(ctx, 378 + idx * 82, 148, 76, 124, card, idx, activeP1Ally?.critStars || 0, isP1AllyQuickLead, activeP1Ally?.name);
    });
  }

  // ==========================================
  // MIDDLE SECTION: MINIMAL CLASH BANNER
  // ==========================================
  drawMinimalClashBanner(ctx, log, activeP1, activeP2, 16, 286, 608, 54, formatTag);

  // ==========================================
  // BOTTOM SECTION: TEAM B (ENEMY RIVALS)
  // ==========================================
  const p2Cards = (log.p2Cards || ['Arts', 'Buster', 'Quick']) as ('Buster' | 'Arts' | 'Quick' | 'NP')[];
  const isP2QuickLead = p2Cards[0] === 'Quick';

  if (!isMultiTeamB) {
    // Standard Single Rival Layout
    drawCritStarBox(ctx, 16, 350, 100, 180, activeP2.critStars || 0, true);
    p2Cards.slice(0, 3).forEach((card, idx) => {
      drawTarotCommandCard(ctx, 124 + idx * 108, 350, 100, 180, card, idx, activeP2.critStars || 0, isP2QuickLead);
    });

    drawUnitHudPlate(ctx, 452, 350, 172, 256, p2Img, activeP2, 'RIVAL', '#ef4444', isP2LeadTargeted, false);

    // Skills
    const p2Skills = activeP2.skills || [];
    const p2Bond = activeP2.bondLevel !== undefined ? activeP2.bondLevel : 3;
    [0, 1, 2].forEach((sIdx) => {
      const sBoxX = 16 + sIdx * 64;
      const sBoxY = 536;
      const sBoxW = 60;
      const sBoxH = 20;
      const sData = p2Skills[sIdx];
      const sCd = sData?.currentCooldown || 0;
      const isLocked = sIdx === 2 && p2Bond < 5;

      ctx.save();
      if (isLocked) {
        ctx.fillStyle = '#1e1b4b';
        drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
        ctx.fill();
        ctx.strokeStyle = '#4338ca';
        ctx.lineWidth = 0.8;
        drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
        ctx.stroke();

        drawVectorLock(ctx, sBoxX + 12, sBoxY + 10, '#a5b4fc');
        ctx.fillStyle = '#a5b4fc';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Bond 5', sBoxX + sBoxW / 2 + 6, sBoxY + 14);
      } else if (sCd > 0) {
        ctx.fillStyle = '#1e293b';
        drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 0.8;
        drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
        ctx.stroke();

        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`S${sIdx + 1}: ${sCd}T`, sBoxX + sBoxW / 2, sBoxY + 14);
      } else {
        ctx.fillStyle = sIdx === 2 ? '#064e3b' : '#881337';
        drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
        ctx.fill();
        ctx.strokeStyle = sIdx === 2 ? '#10b981' : '#f43f5e';
        ctx.lineWidth = 0.8;
        drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
        ctx.stroke();

        drawSparkDiamond(ctx, sBoxX + 11, sBoxY + 10, 3, '#ffffff');
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`S${sIdx + 1}: RDY`, sBoxX + sBoxW / 2 + 5, sBoxY + 14);
      }
      ctx.restore();
    });

    // P2 Header Title
    const p2DisplayName = (activeP2.masterName || 'Master 2').replace(/[^\x00-\x7F]/g, '');
    const p2ServantClean = (activeP2.name || 'Enemy Spirit').replace(/[^\x00-\x7F]/g, '');
    const p2ClassClean = (activeP2.servantClass || 'ARCHER').toUpperCase();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(p2DisplayName, 440, 551);

    const p2NameWidth = ctx.measureText(p2DisplayName).width;
    const p2PillX = 432 - p2NameWidth - 64;
    const p2PillY = 537;
    ctx.fillStyle = 'rgba(244, 63, 94, 0.12)';
    drawRoundRect(ctx, p2PillX, p2PillY, 60, 18, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
    ctx.lineWidth = 1;
    drawRoundRect(ctx, p2PillX, p2PillY, 60, 18, 9);
    ctx.stroke();
    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p2ClassClean, p2PillX + 30, p2PillY + 13);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(p2ServantClean, p2PillX - 8, 551);

    // P2 NP Bar
    const p2NpRatio = Math.max(0, Math.min(1, (activeP2.npGauge || 0) / 100));
    ctx.fillStyle = '#0f172a';
    drawRoundRect(ctx, 16, 560, 424, 22, 4);
    ctx.fill();
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1.2;
    drawRoundRect(ctx, 16, 560, 424, 22, 4);
    ctx.stroke();

    if (p2NpRatio > 0) {
      const npGrad = ctx.createLinearGradient(16, 560, 16, 582);
      npGrad.addColorStop(0, (activeP2.npGauge || 0) >= 100 ? '#fde047' : '#facc15');
      npGrad.addColorStop(1, (activeP2.npGauge || 0) >= 100 ? '#d97706' : '#ca8a04');
      ctx.fillStyle = npGrad;
      drawRoundRect(ctx, 16, 560, Math.max(8, 424 * p2NpRatio), 22, 4);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      drawRoundRect(ctx, 16, 560, Math.max(8, 424 * p2NpRatio), 10, 4);
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    const p2NpText = `NP: ${Math.round(activeP2.npGauge || 0)}%`;
    ctx.fillText(p2NpText, 26, 576);

    if ((activeP2.npGauge || 0) >= 100) {
      const p2NpW = ctx.measureText(p2NpText).width;
      drawVectorStar(ctx, 36 + p2NpW, 572, 5, 4.5, 2.2, '#fde047');
      ctx.fillStyle = '#fde047';
      ctx.fillText('[MAX READY]', 44 + p2NpW, 576);
    }

    // P2 HP Bar
    const p2HpRatio = Math.max(0, Math.min(1, activeP2.currentHp / activeP2.maxHp));
    ctx.fillStyle = '#0f172a';
    drawRoundRect(ctx, 16, 586, 424, 22, 4);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;
    drawRoundRect(ctx, 16, 586, 424, 22, 4);
    ctx.stroke();

    if (p2HpRatio > 0) {
      const hpGrad = ctx.createLinearGradient(16, 586, 16, 608);
      hpGrad.addColorStop(0, p2HpRatio > 0.35 ? '#22c55e' : '#ef4444');
      hpGrad.addColorStop(1, p2HpRatio > 0.35 ? '#15803d' : '#b91c1c');
      ctx.fillStyle = hpGrad;
      drawRoundRect(ctx, 16, 586, Math.max(8, 424 * p2HpRatio), 22, 4);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      drawRoundRect(ctx, 16, 586, Math.max(8, 424 * p2HpRatio), 10, 4);
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`HP  ${activeP2.currentHp.toLocaleString()} / ${activeP2.maxHp.toLocaleString()} (${Math.round(p2HpRatio * 100)}%)`, 26, 602);
  } else {
    // Multi-Combatant Team B: 2-Row Card Grid on Left, 2 Avatars on Right
    // Left Side: 2-Row Grid with 4 Columns [Star, Card1, Card2, Card3]
    // Row 1 (Enemy Vanguard)
    drawCompactCritStarCard(ctx, 16, 350, 68, 124, activeP2.critStars || 0, true, activeP2.name || 'Enemy 1');
    p2Cards.slice(0, 3).forEach((card, idx) => {
      drawCompactCommandCard(ctx, 90 + idx * 82, 350, 76, 124, card, idx, activeP2.critStars || 0, isP2QuickLead, activeP2.name);
    });

    // Row 2 (Enemy Ally / Flank)
    const p2AllyCards = (log.p2AllyCards || (activeP2Ally?.commandDeck && activeP2Ally.commandDeck.length >= 3 ? activeP2Ally.commandDeck.slice(0, 3) : ['Arts', 'Buster', 'Buster'])) as ('Buster' | 'Arts' | 'Quick' | 'NP')[];
    const isP2AllyQuickLead = p2AllyCards[0] === 'Quick';
    drawCompactCritStarCard(ctx, 16, 482, 68, 124, activeP2Ally?.critStars || 0, true, activeP2Ally?.name || 'Enemy 2');
    p2AllyCards.slice(0, 3).forEach((card, idx) => {
      drawCompactCommandCard(ctx, 90 + idx * 82, 482, 76, 124, card, idx, activeP2Ally?.critStars || 0, isP2AllyQuickLead, activeP2Ally?.name);
    });

    // Right Side: 2 Avatars (Enemy Vanguard + Enemy Flank)
    drawUnitHudPlate(ctx, 338, 350, 138, 256, p2Img, activeP2, 'ENEMY VANGUARD', '#ef4444', isP2LeadTargeted);
    if (activeP2Ally) {
      drawUnitHudPlate(ctx, 480, 350, 138, 256, p2AllyImg, activeP2Ally, 'ENEMY FLANK', '#f43f5e', isP2AllyTargeted);
    }
  }

  try {
    if (typeof canvas.toBuffer === 'function') {
      return canvas.toBuffer('image/png');
    }
    return MINIMAL_VALID_PNG;
  } catch {
    return MINIMAL_VALID_PNG;
  }
}

/**
 * 4. Render Gacha Summon Banner (900x520 Buffer)
 */
export async function renderGachaSummonBanner(
  results: GachaResultItem[],
  bannerTitle: string
): Promise<Buffer> {
  const width = 960;
  const height = results.length > 5 ? 540 : 380;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Concurrently load artwork images for CEs
  const loadedArtworks = await Promise.all(
    results.map(async (item) => {
      const ce = item.item as any;
      if (ce && ce.artworkUrl) {
        return await loadImage(ce.artworkUrl);
      }
      return null;
    })
  );

  // Deep mystic night sky gradient background
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0a0d1a');
  bgGrad.addColorStop(0.5, '#0f172a');
  bgGrad.addColorStop(1, '#05070e');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Mystic leyline circles
  ctx.save();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 220, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 380, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Header Title
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`[ ${bannerTitle.toUpperCase()} ]`, width / 2, 38);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('SACRED CRAFT ESSENCE RELICS FORGED VIA SAINT QUARTZ', width / 2, 58);

  // Layout cards in 1 or 2 rows
  const isMultiRow = results.length > 5;
  const itemsPerRow = isMultiRow ? 5 : Math.min(results.length, 5);
  const cardWidth = 156;
  const cardHeight = 210;
  const gapX = 22;
  const gapY = 20;

  const totalRowWidth = itemsPerRow * cardWidth + (itemsPerRow - 1) * gapX;
  const startX = (width - totalRowWidth) / 2;
  const startY = 82;

  for (let i = 0; i < results.length; i++) {
    const item = results[i];
    const ce = item.item as any;
    const artImg = loadedArtworks[i];
    const row = isMultiRow ? Math.floor(i / 5) : 0;
    const col = isMultiRow ? (i % 5) : i;

    const x = startX + col * (cardWidth + gapX);
    const y = startY + row * (cardHeight + gapY);

    // Card frame & background
    ctx.save();
    
    // Rarity border styling
    let borderGrad = '#64748b';
    let glowColor = 'rgba(100, 116, 139, 0.2)';
    let rarityLabel = '3-STAR R';
    let rarityColor = '#94a3b8';

    if (item.rarity === 5) {
      borderGrad = '#fbbf24'; // Gold
      glowColor = 'rgba(251, 191, 36, 0.45)';
      rarityLabel = '5-STAR SSR';
      rarityColor = '#fcd34d';
    } else if (item.rarity === 4) {
      borderGrad = '#c084fc'; // Purple
      glowColor = 'rgba(192, 132, 252, 0.35)';
      rarityLabel = '4-STAR SR';
      rarityColor = '#e9d5ff';
    }

    // Shadow & glow
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = item.rarity === 5 ? 16 : 8;

    // Card BG
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(x, y, cardWidth, cardHeight, 10);
    ctx.fill();

    // Card Border
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = item.rarity === 5 ? 2.5 : 1.5;
    ctx.stroke();
    ctx.restore();

    // Artwork box / image rendering
    if (artImg) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x + 6, y + 6, cardWidth - 12, 100, 6);
      ctx.clip();
      drawImageCover(ctx, artImg, x + 6, y + 6, cardWidth - 12, 100);
      
      // Gradient overlay at bottom of artwork for text readability
      const artGrad = ctx.createLinearGradient(0, y + 60, 0, y + 106);
      artGrad.addColorStop(0, 'transparent');
      artGrad.addColorStop(1, 'rgba(15, 23, 42, 0.9)');
      ctx.fillStyle = artGrad;
      ctx.fillRect(x + 6, y + 60, cardWidth - 12, 46);
      ctx.restore();
    } else {
      // Fallback vector shield graphic
      ctx.save();
      ctx.fillStyle = item.rarity === 5 ? '#2d1e40' : item.rarity === 4 ? '#1e203c' : '#1a2234';
      ctx.beginPath();
      ctx.roundRect(x + 6, y + 6, cardWidth - 12, 100, 6);
      ctx.fill();

      ctx.strokeStyle = borderGrad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const cx = x + cardWidth / 2;
      const cy = y + 46;
      ctx.moveTo(cx - 16, cy - 20);
      ctx.lineTo(cx + 16, cy - 20);
      ctx.lineTo(cx + 16, cy);
      ctx.quadraticCurveTo(cx + 16, cy + 20, cx, cy + 26);
      ctx.quadraticCurveTo(cx - 16, cy + 20, cx - 16, cy);
      ctx.closePath();
      ctx.stroke();

      drawVectorStar(ctx, cx, cy - 2, 5, 8, 4, borderGrad);
      ctx.restore();
    }

    // Draw Vector Stars over bottom of artwork
    const starGap = 12;
    const starSize = 5;
    const totalStarsWidth = (item.rarity - 1) * starGap;
    const starStartX = (x + cardWidth / 2) - (totalStarsWidth / 2);
    for (let s = 0; s < item.rarity; s++) {
      drawVectorStar(ctx, starStartX + s * starGap, y + 96, 5, starSize, starSize / 2, rarityColor);
    }

    // Nameplate background
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(x + 6, y + 110, cardWidth - 12, 28, 4);
    ctx.fill();

    // Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    const nameStr = ce.name || 'Craft Essence';
    const truncatedName = nameStr.length > 17 ? nameStr.substring(0, 15) + '..' : nameStr;
    ctx.fillText(truncatedName, x + cardWidth / 2, y + 128);

    // Stats
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px sans-serif';
    const atk = ce.bonusAtk || ce.atkBonus || 0;
    const hp = ce.bonusHp || ce.hpBonus || 0;
    ctx.fillText(`+${atk} ATK  |  +${hp} HP`, x + cardWidth / 2, y + 152);

    // Effect summary snippet
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    const effStr = ce.effectText || '';
    const effTrunc = effStr.length > 28 ? effStr.substring(0, 26) + '...' : effStr;
    ctx.fillText(effTrunc, x + cardWidth / 2, y + 172);

    // Rarity Badge at bottom
    ctx.fillStyle = rarityColor;
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(rarityLabel, x + cardWidth / 2, y + 194);

    // NEW badge if first time pulled
    if (item.isNew) {
      ctx.save();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.roundRect(x + cardWidth - 44, y + 8, 38, 16, 4);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('NEW!', x + cardWidth - 25, y + 20);
      ctx.restore();
    }
  }

  try {
    return canvas.toBuffer('image/png');
  } catch {
    return MINIMAL_VALID_PNG;
  }
}

/**
 * 5. Render Holy Grail War Tournament Overview
 */
export async function renderGrailWarMap(
  war: HolyGrailWarSession
): Promise<Buffer> {
  const canvas = createCanvas(800, 450);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, 800, 450);

  // Border
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, 780, 430);

  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 22px serif';
  ctx.textAlign = 'center';
  ctx.fillText(war.title.toUpperCase(), 400, 45);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px sans-serif';
  const alive = Object.values(war.participants).filter(p => p.isAlive).length;
  ctx.fillText(`7-MASTER BATTLE ROYALE • ${alive}/7 SURVIVING MASTERS`, 400, 75);

  // Draw roster cards
  const participants = Object.values(war.participants);
  participants.forEach((p, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = col === 0 ? 30 : 410;
    const y = 95 + row * 80;

    ctx.fillStyle = p.isAlive ? '#0f172a' : '#1e1111';
    ctx.strokeStyle = p.isAlive ? '#334155' : '#7f1d1d';
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, 360, 70);
    ctx.strokeRect(x, y, 360, 70);

    ctx.fillStyle = p.isAlive ? '#ffffff' : '#6b7280';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${p.isAlive ? '[ACTIVE]' : '[FALLEN]'} ${p.username}`, x + 15, y + 25);

    ctx.fillStyle = '#d4af37';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${p.servantName} [${p.servantClass}]`, x + 15, y + 45);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`HP: ${p.currentHp.toLocaleString()}/${p.maxHp.toLocaleString()}`, x + 345, y + 25);
    ctx.fillText(`Kills: ${p.kills}`, x + 345, y + 45);
  });

  try {
    return canvas.toBuffer('image/png');
  } catch {
    return MINIMAL_VALID_PNG;
  }
}

export interface VisualNovelCardOptions {
  servantName: string;
  servantClass: string;
  servantAvatarUrl?: string;
  backgroundImageUrl?: string;
  backgroundTheme?: string;
  speakerName: string;
  dialogueText: string;
  title: string;
  subtitle?: string;
  choiceMadeText?: string;
  reactionEmotion?: string;
  expGained?: number;
  sqGained?: number;
  currentBondLevel?: number;
  isComplete?: boolean;
}

/**
 * 6. Render Fate Visual Novel Dialogue Screen (Classic FSN Style, Mobile & Desktop Optimized)
 */
/**
 * Render a production-grade 16:9 Visual Novel Stage Canvas Image matching Steins;Gate HUD standards.
 * Layering Architecture (Bottom to Top):
 * 1. Background Layer (Base 1280x720 object-fit: cover)
 * 2. Character Sprite Layer (Middle - Prominent 85% height figure anchored to bottom right y = 720)
 * 3. Top-Left HUD (Phone / Date Widget e.g. "8/13 (FRI)")
 * 4. Dialogue Box / HUD Layer (Top - Semi-transparent glass overlay, bottom-centered name bracket, Steins;Gate gear indicator, [F3] AUTO | [E] SKIP control hints)
 */
export async function renderVisualNovelCard(
  opts: VisualNovelCardOptions
): Promise<Buffer> {
  const width = 1280;
  const height = 720;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // ==========================================
  // LAYER 1: BACKGROUND LAYER (BASE)
  // ==========================================
  const defaultBgUrl = 'https://ella.janitorai.com/media-approved/IIRAOZkI3ENNvVT8H7gQC.webp';
  const bgUrlToUse = (opts.backgroundImageUrl && opts.backgroundImageUrl !== opts.servantAvatarUrl)
    ? opts.backgroundImageUrl
    : defaultBgUrl;

  let bgDrawn = false;
  if (bgUrlToUse) {
    try {
      const bgImg = await loadImage(bgUrlToUse);
      if (bgImg && bgImg.width && bgImg.height) {
        // Full-bleed object-fit: cover logic
        const imgRatio = bgImg.width / bgImg.height;
        const canvasRatio = width / height;
        let drawW = width;
        let drawH = height;
        let drawX = 0;
        let drawY = 0;

        if (imgRatio > canvasRatio) {
          drawW = height * imgRatio;
          drawX = (width - drawW) / 2;
        } else {
          drawH = width / imgRatio;
          drawY = (height - drawH) / 2;
        }

        ctx.drawImage(bgImg, drawX, drawY, drawW, drawH);
        bgDrawn = true;
      }
    } catch {
      bgDrawn = false;
    }
  }

  if (!bgDrawn) {
    // Steins;Gate City Skyline Sepia-Golden Gradient Fallback
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#1c150e');
    bgGrad.addColorStop(0.4, '#36281b');
    bgGrad.addColorStop(0.8, '#211810');
    bgGrad.addColorStop(1, '#0e0b07');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle atmospheric grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  // Subtle atmospheric edge vignette
  ctx.save();
  const vignetteGrad = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.4,
    width / 2, height / 2, Math.max(width, height) * 0.7
  );
  vignetteGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignetteGrad.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
  ctx.fillStyle = vignetteGrad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // ==========================================
  // LAYER 2: CHARACTER SPRITE LAYER (MIDDLE)
  // ==========================================
  if (opts.servantAvatarUrl) {
    try {
      const spriteImg = await loadImage(opts.servantAvatarUrl);
      if (spriteImg && spriteImg.width && spriteImg.height) {
        const aspect = spriteImg.width / spriteImg.height;

        // Target Scale: Prominent half-body / 3/4-body sprite, roughly 85% of total canvas height (~612px)
        const maxSpriteH = Math.floor(height * 0.85); // 612px
        const maxSpriteW = Math.floor(width * 0.48);  // 614px

        let spriteH = maxSpriteH;
        let spriteW = spriteH * aspect;

        if (spriteW > maxSpriteW) {
          spriteW = maxSpriteW;
          spriteH = spriteW / aspect;
        }

        // Anchor sprite to the bottom right of the canvas (x ≈ 0.58 to 0.65, resting at bottom edge y = 720)
        const spriteX = width * 0.58 + (maxSpriteW - spriteW) / 2;
        const spriteY = height - spriteH;

        ctx.save();
        // Drop shadow for sprite figure
        ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 10;

        ctx.drawImage(spriteImg, spriteX, spriteY, spriteW, spriteH);
        ctx.restore();
      }
    } catch {
      // Ignore sprite load failure
    }
  }

  // ==========================================
  // LAYER 3: TOP-LEFT HUD (PHONE / DATE WIDGET)
  // ==========================================
  ctx.save();
  const hudX = 40;
  const hudY = 30;
  const hudW = 220;
  const hudH = 65;

  // Semi-transparent dark slate panel
  ctx.fillStyle = 'rgba(35, 45, 60, 0.78)';
  ctx.beginPath();
  ctx.roundRect(hudX, hudY, hudW, hudH, 3);
  ctx.fill();

  // Sleek subtle border highlight
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(hudX, hudY, hudW, hudH, 3);
  ctx.stroke();

  // Battery & Signal Indicator Icons (Top Right of Widget)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('🔋 📶', hudX + hudW - 12, hudY + 20);

  // Digital Date Text e.g. "8/13 (FRI)"
  ctx.font = 'bold 30px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 4;
  ctx.fillText('8/13', hudX + 16, hudY + 44);

  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = 'rgba(225, 235, 245, 0.85)';
  ctx.fillText('(FRI)', hudX + 105, hudY + 44);
  ctx.restore();

  // ==========================================
  // LAYER 4: DIALOGUE BOX / HUD LAYER (TOP)
  // ==========================================
  const boxX = 40;
  const boxY = 490;
  const boxW = 1200;
  const boxH = 185;

  ctx.save();
  // Semi-transparent dark overlay (covering bottom ~25% of canvas)
  ctx.fillStyle = 'rgba(12, 16, 25, 0.68)';
  ctx.fillRect(boxX, boxY, boxW, boxH);

  // Minimalist top highlight line across the top edge of dialogue box
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(boxX, boxY);
  ctx.lineTo(boxX + boxW, boxY);
  ctx.stroke();
  ctx.restore();

  // --- Speaker Name Bracket Tag (Centered at Bottom Edge of Dialogue Box) ---
  const speakerNameText = (opts.speakerName || opts.servantName || 'Heroic Spirit').toUpperCase();
  ctx.save();
  ctx.font = 'bold 18px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 6;

  const bracketStr = `──────────   ${speakerNameText}   ──────────`;
  ctx.fillText(bracketStr, width / 2, boxY + boxH + 8);
  ctx.restore();

  // --- Choice Selected Badge (If choice was made) ---
  if (opts.choiceMadeText) {
    ctx.save();
    ctx.font = 'italic bold 15px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;

    const choiceStr = `✨ CHOICE: “${opts.choiceMadeText.length > 40 ? opts.choiceMadeText.slice(0, 37) + '...' : opts.choiceMadeText}”`;
    ctx.fillText(choiceStr, boxX + boxW - 20, boxY + 30);
    ctx.restore();
  }

  // --- Dialogue Text (Clean White Serif with Steins;Gate Gear Indicator) ---
  ctx.save();
  const textX = boxX + 45;
  const textY = boxY + 55;
  const maxTextW = boxW - 90;
  const lineHeight = 42;

  ctx.font = '26px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'left';

  const cleanText = (opts.dialogueText || '').replace(/^["“]/, '').replace(/["”]$/, '').trim();
  const fullText = `“${cleanText}” ⚙`;
  const words = fullText.split(' ');
  let currentLine = '';
  let lineY = textY;
  let linesDrawn = 0;

  for (let i = 0; i < words.length; i++) {
    const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxTextW && i > 0) {
      // High contrast text shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.shadowBlur = 4;
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(currentLine, textX, lineY);

      currentLine = words[i];
      lineY += lineHeight;
      linesDrawn++;
      if (linesDrawn >= 3) break;
    } else {
      currentLine = testLine;
    }
  }

  if (linesDrawn < 3 && currentLine.trim().length > 0) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(currentLine, textX, lineY);
  }
  ctx.restore();

  // --- Bottom-Left Control Hints: [F3] AUTO | [E] SKIP ---
  ctx.save();
  const ctrlX = 40;
  const ctrlY = 708;

  // Key badge 1: [F3]
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(ctrlX, ctrlY - 14, 28, 18, 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('F3', ctrlX + 14, ctrlY);

  // Label: AUTO
  ctx.textAlign = 'left';
  ctx.fillText('AUTO', ctrlX + 34, ctrlY);

  // Divider
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText('|', ctrlX + 76, ctrlY);

  // Key badge 2: [E]
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(ctrlX + 88, ctrlY - 14, 20, 18, 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('E', ctrlX + 98, ctrlY);

  // Label: SKIP
  ctx.textAlign = 'left';
  ctx.fillText('SKIP', ctrlX + 114, ctrlY);
  ctx.restore();

  try {
    return canvas.toBuffer('image/png');
  } catch {
    return MINIMAL_VALID_PNG;
  }
}
