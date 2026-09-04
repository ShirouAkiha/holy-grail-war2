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

async function loadImage(src: string): Promise<any> {
  if (canvasModule && typeof canvasModule.loadImage === 'function') {
    try {
      return await canvasModule.loadImage(src);
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
  let cardColor = '#dc2626';
  let cardCore = '#ef4444';
  let deepColor = '#3b0707';
  let cardLabel = 'BUSTER';
  let emblemText = 'B';
  const posPrefix = orderIdx === 0 ? '1st' : orderIdx === 1 ? '2nd' : '3rd';
  let statText = orderIdx === 0 ? '1st (+50% DMG)' : `${posPrefix} (${orderIdx === 1 ? '1.2x' : '1.4x'})`;
  let baseCritMult = 2.0;

  if (card === 'NP') {
    cardColor = '#d97706';
    cardCore = '#fbbf24';
    deepColor = '#451a03';
    cardLabel = 'N. PHANTASM';
    emblemText = 'NP';
    statText = 'MAX OVERCHARGE';
    baseCritMult = 0;
  } else if (card === 'Arts') {
    cardColor = '#2563eb';
    cardCore = '#38bdf8';
    deepColor = '#082f49';
    cardLabel = 'ARTS';
    emblemText = 'A';
    statText = orderIdx === 0 ? '1st (+100% NP)' : `${posPrefix} (${orderIdx === 1 ? '1.2x' : '1.4x'})`;
    baseCritMult = 1.8;
  } else if (card === 'Quick') {
    cardColor = '#16a34a';
    cardCore = '#4ade80';
    deepColor = '#064e3b';
    cardLabel = 'QUICK';
    emblemText = 'Q';
    statText = orderIdx === 0 ? '1st (+20% CRIT)' : `${posPrefix} (${orderIdx === 1 ? '1.2x' : '1.4x'})`;
    baseCritMult = 2.2;
  }

  ctx.save();

  // 1. Rich Radial Elemental Gradient
  const radGrad = ctx.createRadialGradient(x + w / 2, y + h / 2, 6, x + w / 2, y + h / 2, w * 0.75);
  radGrad.addColorStop(0, deepColor);
  radGrad.addColorStop(0.7, '#070a14');
  radGrad.addColorStop(1, '#020408');
  ctx.fillStyle = radGrad;
  drawRoundRect(ctx, x, y, w, h, 8);
  ctx.fill();

  // Outer Border
  ctx.strokeStyle = cardColor;
  ctx.lineWidth = 2.2;
  drawRoundRect(ctx, x, y, w, h, 8);
  ctx.stroke();

  // Inner Ornate Filigree Frame
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, x + 3, y + 3, w - 6, h - 6, 6);
  ctx.stroke();

  // Corner Accent Diamonds
  drawSparkDiamond(ctx, x + 6, y + 6, 2.5, cardCore);
  drawSparkDiamond(ctx, x + w - 6, y + 6, 2.5, cardCore);
  drawSparkDiamond(ctx, x + 6, y + h - 6, 2.5, cardCore);
  drawSparkDiamond(ctx, x + w - 6, y + h - 6, 2.5, cardCore);

  // 2. Card Header Ribbon
  const ribbonGrad = ctx.createLinearGradient(x + 4, y + 4, x + w - 4, y + 24);
  ribbonGrad.addColorStop(0, cardColor);
  ribbonGrad.addColorStop(1, deepColor);
  ctx.fillStyle = ribbonGrad;
  drawRoundRect(ctx, x + 4, y + 4, w - 8, 20, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 0.8;
  drawRoundRect(ctx, x + 4, y + 4, w - 8, 20, 4);
  ctx.stroke();

  // Turn Order Indicator (I, II, III) on top-left
  const roman = orderIdx === 0 ? 'I' : orderIdx === 1 ? 'II' : 'III';
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(roman, x + 8, y + 18);

  // Card Type Label
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(cardLabel, x + w / 2 + 4, y + 18);

  // 3. Center Sigil & Luminous Ether Rings
  const cx = x + w / 2;
  const cy = y + 54;

  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.strokeStyle = `${cardCore}44`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 17, 0, Math.PI * 2);
  ctx.strokeStyle = `${cardCore}22`;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Emblem Shadow + Main Text
  ctx.font = card === 'NP' ? 'bold 22px sans-serif' : 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';
  ctx.fillText(emblemText, cx + 1, cy + 10 + 1);

  ctx.fillStyle = card === 'NP' ? '#fde047' : '#ffffff';
  ctx.fillText(emblemText, cx, cy + 10);

  // 4. Subtitle Position Stat Bonus
  ctx.font = 'bold 8px sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(statText, cx, y + 84);

  // 5. Bottom Crit % Badge
  const badgeY = y + 92;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  drawRoundRect(ctx, x + 5, badgeY, w - 10, 18, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 0.8;
  drawRoundRect(ctx, x + 5, badgeY, w - 10, 18, 4);
  ctx.stroke();

  if (card === 'NP') {
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('NOBLE CARD', cx, badgeY + 13);
  } else {
    let critPct = Math.min(100, Math.round((critStars || 0) * baseCritMult));
    if (isQuickFirstLead && orderIdx > 0) {
      critPct = Math.min(100, critPct + 20);
    }
    // Gold vector star
    drawVectorStar(ctx, x + 16, badgeY + 9, 5, 5, 2.5, '#fbbf24');
    ctx.fillStyle = critPct >= 50 ? '#fde047' : '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`CRIT ${critPct}%`, cx + 6, badgeY + 13);
  }

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

    // Runic aura circle
    ctx.beginPath();
    ctx.arc(innerX + innerW / 2, innerY + 70, 36, 0, Math.PI * 2);
    ctx.strokeStyle = `${accentColor}33`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Heraldic Shield Vector
    drawVectorShield(ctx, innerX + innerW / 2, innerY + 70, 48, 56, `${accentColor}22`, accentColor);

    // Crossed Swords Vector
    drawVectorCrossedSwords(ctx, innerX + innerW / 2, innerY + 70, 14, '#ffffff');

    // Servant Class Ribbon
    const sClass = (servant.servantClass || 'SABER').toUpperCase();
    ctx.fillStyle = accentColor;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sClass, innerX + innerW / 2, innerY + 124);

    // Servant Name
    const sName = (servant.name || 'Heroic Spirit').slice(0, 14);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(sName, innerX + innerW / 2, innerY + 148);

    // Corner Filigree Accents
    drawSparkDiamond(ctx, innerX + 6, innerY + 6, 3, accentColor);
    drawSparkDiamond(ctx, innerX + innerW - 6, innerY + 6, 3, accentColor);
    drawSparkDiamond(ctx, innerX + 6, innerY + innerH - 6, 3, accentColor);
    drawSparkDiamond(ctx, innerX + innerW - 6, innerY + innerH - 6, 3, accentColor);
  }

  // Double Metallic Border
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2.2;
  drawRoundRect(ctx, x, y, w, h, 8);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, x + 2, y + 2, w - 4, h - 4, 6);
  ctx.stroke();

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
  const totalHp = Math.round(baseHp * (1 + (lvl - 1) * 0.05) + totalEnd * 150 + ceBonusHp);
  const totalAtk = Math.round(baseAtk * (1 + (lvl - 1) * 0.05) + totalStr * 80 + ceBonusAtk);

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

  // Class Badge & Stars on Right
  ctx.textAlign = 'right';
  ctx.fillStyle = t.rarity === 5 ? '#fbbf24' : '#38bdf8';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText((t.servantClass || 'SABER').toUpperCase(), 770, 52);

  ctx.fillStyle = '#fbbf24';
  ctx.font = '22px sans-serif';
  ctx.fillText('★'.repeat(t.rarity || 5), 770, 80);

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
  ctx.fillText('⚡ HEROIC SPIRIT SKILLS (ACTIVE & PASSIVE)', 30, 376);

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
    ctx.fillText(`${sk.icon || '✨'} ${sk.name}`, 46, skY + 28);

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
  frameIdx: number = 0
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
  frameIdx: number = 0
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

  ctx.restore();

  // 3. Floating [ TARGET: LOCKED ] Crimson HUD Badge (Top Right)
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

  // 2. Attacker Hovering Sprite (Left Side)
  drawHoveringAttacker(ctx, portraitImg, speakerName, servantClass, bondOrLevel, frameIdx);

  // 3. Defender Hovering Sprite (Right Side)
  drawHoveringDefender(ctx, defenderImg, defenderName, defenderClass, frameIdx);

  // 4. Center Tactical Command Cards & Active Chain HUD
  drawCenterCommandHUD(ctx, chainTagOrTitle, sequence, frameIdx);

  // 5. Full-Screen Screen-Splitting Slash Cut-In Animation
  drawPersonaSlashAnimation(ctx, frameIdx, chainTagOrTitle);

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
 * 3. Render Battle Turn Summary (640x700 Fate Immersive Clash & Tarot Layout)
 * Supports both headless Buffer generation (Discord Bot / Server API)
 * and direct HTML5 Canvas rendering (DiscordEmulator / CanvasStudio).
 */
export async function renderBattleTurnSummary(
  canvas: any,
  log: CombatTurnLog,
  p1: ActiveCombatant,
  p2: ActiveCombatant
): Promise<Buffer>;
export async function renderBattleTurnSummary(
  log: CombatTurnLog,
  p1: ActiveCombatant,
  p2: ActiveCombatant
): Promise<Buffer>;
export async function renderBattleTurnSummary(
  canvasOrLog: any,
  logOrP1: any,
  p1OrP2: any,
  p2Optional?: any
): Promise<Buffer> {
  let canvas: any;
  let log: CombatTurnLog;
  let p1: ActiveCombatant;
  let p2: ActiveCombatant;
  const isClientCanvas = canvasOrLog && typeof canvasOrLog.getContext === 'function';

  if (isClientCanvas) {
    canvas = canvasOrLog;
    log = logOrP1;
    p1 = p1OrP2;
    p2 = p2Optional;
  } else {
    canvas = createCanvas(640, 700);
    log = canvasOrLog;
    p1 = logOrP1;
    p2 = p1OrP2;
  }

  if (canvas.width !== 640 || canvas.height !== 700) {
    canvas.width = 640;
    canvas.height = 700;
  }
  const ctx = canvas.getContext('2d');

  // Load Avatars concurrently
  const p1Img = p1?.avatarUrl ? await loadImage(p1.avatarUrl) : null;
  const p2Img = p2?.avatarUrl ? await loadImage(p2.avatarUrl) : null;

  // Background - Deep Mystic War Canvas
  const bgGrad = ctx.createLinearGradient(0, 0, 640, 700);
  bgGrad.addColorStop(0, '#090d19');
  bgGrad.addColorStop(0.5, '#04060e');
  bgGrad.addColorStop(1, '#11071d');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 640, 700);

  // Outer Border with glowing accents
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  drawRoundRect(ctx, 8, 8, 624, 684, 14);
  ctx.stroke();

  // Grid / Rune background lines
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.04)';
  ctx.lineWidth = 1;
  for (let x = 30; x < 630; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 12);
    ctx.lineTo(x, 688);
    ctx.stroke();
  }
  for (let y = 30; y < 690; y += 40) {
    ctx.beginPath();
    ctx.moveTo(12, y);
    ctx.lineTo(628, y);
    ctx.stroke();
  }

  // Corner Accent Filigree Spark Diamonds
  drawSparkDiamond(ctx, 16, 16, 5, '#38bdf8');
  drawSparkDiamond(ctx, 624, 16, 5, '#38bdf8');
  drawSparkDiamond(ctx, 16, 684, 5, '#ef4444');
  drawSparkDiamond(ctx, 624, 684, 5, '#ef4444');

  // ==========================================
  // TOP SECTION: PLAYER 1 (MASTER & SERVANT)
  // ==========================================
  // 1. P1 Avatar Portrait Frame (Left, 120x208)
  drawServantPortraitCard(ctx, 18, 18, 120, 208, p1Img, p1, '#38bdf8');

  // 2. P1 Header Title & Class Pill
  const p1DisplayName = (p1.masterName || 'Master 1').replace(/[^\x00-\x7F]/g, '');
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(p1DisplayName, 148, 38);

  const p1NameWidth = ctx.measureText(p1DisplayName).width;
  const p1ServantClean = (p1.name || 'Heroic Spirit').replace(/[^\x00-\x7F]/g, '');
  const p1ClassClean = (p1.servantClass || 'SABER').toUpperCase();

  // Class badge pill
  const pillX = 158 + p1NameWidth;
  const pillY = 24;
  ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
  drawRoundRect(ctx, pillX, pillY, 68, 18, 9);
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, pillX, pillY, 68, 18, 9);
  ctx.stroke();
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(p1ClassClean, pillX + 34, pillY + 13);

  // Servant Name
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(p1ServantClean, pillX + 76, 38);

  // 2.5 P1 3 Active Skill Badges (Top Right above HP Bar) - 100% Vector icons
  const p1Skills = p1.skills || [];
  const p1Bond = p1.bondLevel !== undefined ? p1.bondLevel : 5;
  [0, 1, 2].forEach((sIdx) => {
    const sBoxX = 416 + sIdx * 70;
    const sBoxY = 20;
    const sBoxW = 66;
    const sBoxH = 22;
    const sData = p1Skills[sIdx];
    const sCd = sData?.currentCooldown || 0;
    const isLocked = sIdx === 2 && p1Bond < 5;

    ctx.save();
    if (isLocked) {
      ctx.fillStyle = '#1e1b4b';
      drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
      ctx.fill();
      ctx.strokeStyle = '#4338ca';
      ctx.lineWidth = 1;
      drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
      ctx.stroke();

      // Vector Lock (NO EMOJI)
      drawVectorLock(ctx, sBoxX + 14, sBoxY + 11, '#a5b4fc');

      ctx.fillStyle = '#a5b4fc';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Bond 5', sBoxX + sBoxW / 2 + 7, sBoxY + 15);
    } else if (sCd > 0) {
      ctx.fillStyle = '#1e293b';
      drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`S${sIdx + 1}: ${sCd}T`, sBoxX + sBoxW / 2, sBoxY + 15);
    } else {
      ctx.fillStyle = sIdx === 2 ? '#065f46' : '#0369a1';
      drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
      ctx.fill();
      ctx.strokeStyle = sIdx === 2 ? '#10b981' : '#38bdf8';
      ctx.lineWidth = 1;
      drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
      ctx.stroke();

      // Vector Spark Diamond (NO EMOJI)
      drawSparkDiamond(ctx, sBoxX + 13, sBoxY + 11, 3.5, '#ffffff');

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`S${sIdx + 1}: RDY`, sBoxX + sBoxW / 2 + 6, sBoxY + 15);
    }
    ctx.restore();
  });

  // 3. P1 HP & NP Glassmorphic Bars
  const p1HpRatio = Math.max(0, Math.min(1, p1.currentHp / p1.maxHp));
  const p1NpRatio = Math.max(0, Math.min(1, (p1.npGauge || 0) / 100));

  // HP Bar (26px height)
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 148, 48, 474, 26, 5);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  drawRoundRect(ctx, 148, 48, 474, 26, 5);
  ctx.stroke();

  if (p1HpRatio > 0) {
    const hpGrad = ctx.createLinearGradient(148, 48, 148, 74);
    if (p1HpRatio > 0.35) {
      hpGrad.addColorStop(0, '#4ade80');
      hpGrad.addColorStop(1, '#16a34a');
    } else {
      hpGrad.addColorStop(0, '#f87171');
      hpGrad.addColorStop(1, '#dc2626');
    }
    ctx.fillStyle = hpGrad;
    drawRoundRect(ctx, 148, 48, Math.max(8, 474 * p1HpRatio), 26, 5);
    ctx.fill();

    // Subtle Glass Sheen Top Half
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    drawRoundRect(ctx, 148, 48, Math.max(8, 474 * p1HpRatio), 12, 5);
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`HP  ${p1.currentHp.toLocaleString()} / ${p1.maxHp.toLocaleString()} (${Math.round(p1HpRatio * 100)}%)`, 158, 66);

  // NP Bar (24px height)
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 148, 80, 356, 24, 5);
  ctx.fill();
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 1.5;
  drawRoundRect(ctx, 148, 80, 356, 24, 5);
  ctx.stroke();

  if (p1NpRatio > 0) {
    const npGrad = ctx.createLinearGradient(148, 80, 148, 104);
    if ((p1.npGauge || 0) >= 100) {
      npGrad.addColorStop(0, '#fde047');
      npGrad.addColorStop(1, '#d97706');
    } else {
      npGrad.addColorStop(0, '#facc15');
      npGrad.addColorStop(1, '#ca8a04');
    }
    ctx.fillStyle = npGrad;
    drawRoundRect(ctx, 148, 80, Math.max(8, 356 * p1NpRatio), 24, 5);
    ctx.fill();

    // Subtle Glass Sheen Top Half
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    drawRoundRect(ctx, 148, 80, Math.max(8, 356 * p1NpRatio), 11, 5);
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  const p1NpText = `NP: ${Math.round(p1.npGauge || 0)}%`;
  ctx.fillText(p1NpText, 158, 97);

  if ((p1.npGauge || 0) >= 100) {
    const npTextW = ctx.measureText(p1NpText).width;
    drawVectorStar(ctx, 168 + npTextW, 93, 5, 5, 2.5, '#fde047');
    ctx.fillStyle = '#fde047';
    ctx.fillText('[MAX READY]', 178 + npTextW, 97);
  }

  // NP Tag Right
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('NP GAUGE', 436, 97);

  // 4. P1 3 Tarot Command Cards (Option 1 - Ornate Tarot Filigree)
  const p1Cards = (log.p1Cards || log.cardsUsed || ['Buster', 'Arts', 'Quick']) as ('Buster' | 'Arts' | 'Quick' | 'NP')[];
  const isP1QuickLead = p1Cards[0] === 'Quick';
  p1Cards.slice(0, 3).forEach((card, idx) => {
    const cardX = 148 + idx * 96;
    const cardY = 110;
    const cardW = 90;
    const cardH = 116;

    drawTarotCommandCard(
      ctx,
      cardX,
      cardY,
      cardW,
      cardH,
      card,
      idx,
      p1.critStars || 0,
      isP1QuickLead
    );
  });

  // P1 Stars Reservoir Pill (to right of cards - 116px height)
  ctx.save();
  const p1ResGrad = ctx.createRadialGradient(533, 168, 10, 533, 168, 90);
  p1ResGrad.addColorStop(0, '#0c1b33');
  p1ResGrad.addColorStop(1, '#080d1a');
  ctx.fillStyle = p1ResGrad;
  drawRoundRect(ctx, 444, 110, 178, 116, 8);
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.6;
  drawRoundRect(ctx, 444, 110, 178, 116, 8);
  ctx.stroke();

  // Inner Accent
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, 447, 113, 172, 110, 6);
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ETHER CRIT STARS', 533, 134);

  // Vector star + count
  drawVectorStar(ctx, 488, 172, 5, 14, 7, '#38bdf8');
  drawVectorStar(ctx, 488, 172, 5, 7, 3.5, '#ffffff');

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${p1.critStars || 0}`, 512, 185);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('STARS READY FOR ATTACK', 533, 212);
  ctx.restore();

  // ==========================================
  // MIDDLE SECTION: CINEMATIC CLASH THEATER (OPTION 2)
  // ==========================================
  drawCinematicClashTheater(ctx, log, p1, p2, p1Cards);

  // ==========================================
  // BOTTOM SECTION: PLAYER 2 (MASTER & SERVANT)
  // ==========================================
  // 1. P2 Stars Reservoir Pill (to left of cards - 116px height)
  ctx.save();
  const p2ResGrad = ctx.createRadialGradient(107, 506, 10, 107, 506, 90);
  p2ResGrad.addColorStop(0, '#330c12');
  p2ResGrad.addColorStop(1, '#1a080c');
  ctx.fillStyle = p2ResGrad;
  drawRoundRect(ctx, 18, 448, 178, 116, 8);
  ctx.fill();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.6;
  drawRoundRect(ctx, 18, 448, 178, 116, 8);
  ctx.stroke();

  // Inner Accent
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.2)';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, 21, 451, 172, 110, 6);
  ctx.stroke();

  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ETHER CRIT STARS', 107, 472);

  drawVectorStar(ctx, 62, 510, 5, 14, 7, '#f87171');
  drawVectorStar(ctx, 62, 510, 5, 7, 3.5, '#ffffff');

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${p2.critStars || 0}`, 86, 523);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ENEMY CRIT RESERVOIR', 107, 550);
  ctx.restore();

  // 2. P2 3 Tarot Command Cards (Option 1 - Ornate Tarot Filigree)
  const p2Cards = (log.p2Cards || ['Arts', 'Buster', 'Quick']) as ('Buster' | 'Arts' | 'Quick' | 'NP')[];
  const isP2QuickLead = p2Cards[0] === 'Quick';
  p2Cards.slice(0, 3).forEach((card, idx) => {
    const cardX = 202 + idx * 96;
    const cardY = 448;
    const cardW = 90;
    const cardH = 116;

    drawTarotCommandCard(
      ctx,
      cardX,
      cardY,
      cardW,
      cardH,
      card,
      idx,
      p2.critStars || 0,
      isP2QuickLead
    );
  });

  // 3. P2 Details (Status Bars & Active Skills)
  const p2HpRatio = Math.max(0, Math.min(1, p2.currentHp / p2.maxHp));
  const p2NpRatio = Math.max(0, Math.min(1, (p2.npGauge || 0) / 100));

  // P2 NP Bar (24px height)
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 148, 574, 344, 24, 5);
  ctx.fill();
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 1.5;
  drawRoundRect(ctx, 148, 574, 344, 24, 5);
  ctx.stroke();

  if (p2NpRatio > 0) {
    const p2NpGrad = ctx.createLinearGradient(148, 574, 148, 598);
    if ((p2.npGauge || 0) >= 100) {
      p2NpGrad.addColorStop(0, '#fde047');
      p2NpGrad.addColorStop(1, '#d97706');
    } else {
      p2NpGrad.addColorStop(0, '#facc15');
      p2NpGrad.addColorStop(1, '#ca8a04');
    }
    ctx.fillStyle = p2NpGrad;
    drawRoundRect(ctx, 148, 574, Math.max(8, 344 * p2NpRatio), 24, 5);
    ctx.fill();

    // Glass sheen
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    drawRoundRect(ctx, 148, 574, Math.max(8, 344 * p2NpRatio), 11, 5);
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  const p2NpText = `NP: ${Math.round(p2.npGauge || 0)}%`;
  ctx.fillText(p2NpText, 158, 591);

  if ((p2.npGauge || 0) >= 100) {
    const p2NpTextW = ctx.measureText(p2NpText).width;
    drawVectorStar(ctx, 168 + p2NpTextW, 587, 5, 5, 2.5, '#fde047');
    ctx.fillStyle = '#fde047';
    ctx.fillText('[MAX READY]', 178 + p2NpTextW, 591);
  }

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('NP GAUGE', 76, 591);

  // P2 HP Bar (26px height)
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 18, 606, 474, 26, 5);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  drawRoundRect(ctx, 18, 606, 474, 26, 5);
  ctx.stroke();

  if (p2HpRatio > 0) {
    const p2HpGrad = ctx.createLinearGradient(18, 606, 18, 632);
    if (p2HpRatio > 0.35) {
      p2HpGrad.addColorStop(0, '#4ade80');
      p2HpGrad.addColorStop(1, '#16a34a');
    } else {
      p2HpGrad.addColorStop(0, '#f87171');
      p2HpGrad.addColorStop(1, '#dc2626');
    }
    ctx.fillStyle = p2HpGrad;
    drawRoundRect(ctx, 18, 606, Math.max(8, 474 * p2HpRatio), 26, 5);
    ctx.fill();

    // Glass sheen
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    drawRoundRect(ctx, 18, 606, Math.max(8, 474 * p2HpRatio), 12, 5);
    ctx.fill();
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`HP  ${p2.currentHp.toLocaleString()} / ${p2.maxHp.toLocaleString()} (${Math.round(p2HpRatio * 100)}%)`, 28, 624);

  // 3.5 P2 3 Active Skill Badges (Bottom Left) - 100% Vector icons
  const p2Skills = p2.skills || [];
  const p2Bond = p2.bondLevel !== undefined ? p2.bondLevel : 3;
  [0, 1, 2].forEach((sIdx) => {
    const sBoxX = 18 + sIdx * 70;
    const sBoxY = 638;
    const sBoxW = 66;
    const sBoxH = 22;
    const sData = p2Skills[sIdx];
    const sCd = sData?.currentCooldown || 0;
    const isLocked = sIdx === 2 && p2Bond < 5;

    ctx.save();
    if (isLocked) {
      ctx.fillStyle = '#1e1b4b';
      drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
      ctx.fill();
      ctx.strokeStyle = '#4338ca';
      ctx.lineWidth = 1;
      drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
      ctx.stroke();

      // Vector Lock (NO EMOJI)
      drawVectorLock(ctx, sBoxX + 14, sBoxY + 11, '#a5b4fc');

      ctx.fillStyle = '#a5b4fc';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Bond 5', sBoxX + sBoxW / 2 + 7, sBoxY + 15);
    } else if (sCd > 0) {
      ctx.fillStyle = '#1e293b';
      drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`S${sIdx + 1}: ${sCd}T`, sBoxX + sBoxW / 2, sBoxY + 15);
    } else {
      ctx.fillStyle = sIdx === 2 ? '#065f46' : '#991b1b';
      drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
      ctx.fill();
      ctx.strokeStyle = sIdx === 2 ? '#10b981' : '#f87171';
      ctx.lineWidth = 1;
      drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
      ctx.stroke();

      // Vector Spark Diamond (NO EMOJI)
      drawSparkDiamond(ctx, sBoxX + 13, sBoxY + 11, 3.5, '#ffffff');

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`S${sIdx + 1}: RDY`, sBoxX + sBoxW / 2 + 6, sBoxY + 15);
    }
    ctx.restore();
  });

  // P2 Header Title (Right Aligned before Avatar)
  const p2DisplayName = (p2.masterName || 'Master 2').replace(/[^\x00-\x7F]/g, '');
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(p2DisplayName, 492, 652);

  const p2NameWidth = ctx.measureText(p2DisplayName).width;
  const p2ServantClean = (p2.name || 'Heroic Spirit').replace(/[^\x00-\x7F]/g, '');
  const p2ClassClean = (p2.servantClass || 'ENEMY').toUpperCase();

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`[${p2ClassClean}] ${p2ServantClean} • `, 492 - p2NameWidth, 652);

  // 4. P2 Avatar Portrait Frame (Right, 120x226)
  drawServantPortraitCard(ctx, 502, 448, 120, 226, p2Img, p2, '#ef4444');

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
    ctx.fillText(`${p.isAlive ? '🟢' : '💀'} ${p.username}`, x + 15, y + 25);

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
