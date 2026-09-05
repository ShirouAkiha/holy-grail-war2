import {
  CombatTurnLog,
  GachaResultItem,
  HolyGrailWarSession,
  MasterServantInstance,
  ActiveCombatant,
  CardType
} from '../types';
import { calculateRadarCoordinates } from '../engine/customization';
import { SERVANT_DATABASE } from '../data/servants';

// Helper to draw a 5-pointed vector star
function drawVectorStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes: number = 5,
  outerRadius: number = 6,
  innerRadius: number = 3,
  fillStyle?: string,
  strokeStyle?: string
) {
  ctx.save();
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
  ctx.restore();
}

// Helper to draw rounded rectangles
function drawRoundRect(
  ctx: CanvasRenderingContext2D,
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
 * Draw image using cover object-fit logic in HTML5 Canvas
 */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  if (!img || !img.naturalWidth || !img.naturalHeight) return;
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const targetRatio = dw / dh;
  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;

  if (imgRatio > targetRatio) {
    sw = img.naturalHeight * targetRatio;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / targetRatio;
    sy = (img.naturalHeight - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

// Helper to draw multiline wrapped text
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
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
 * 1. Servant Profile Status Card (800x960 High-Legibility Box Card)
 */
export function renderServantProfileCard(
  canvas: HTMLCanvasElement,
  servant: MasterServantInstance | any,
  masterName: string
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = 800;
  canvas.height = 960;

  const templateId = servant.templateId || servant.template?.id || servant.id;
  const canonical = SERVANT_DATABASE.find(s => s.id === templateId) || servant.template || servant;
  const t = { 
    ...canonical, 
    ...(servant.template || {}),
    avatarUrl: servant.template?.avatarUrl || servant.avatarUrl || canonical.avatarUrl,
    cardArtUrl: servant.template?.cardArtUrl || servant.cardArtUrl || canonical.cardArtUrl
  };
  const alloc = servant.allocatedStats || { strength: 0, endurance: 0, agility: 0, mana: 0, luck: 0 };
  const base = t.baseStats || { strength: 10, endurance: 10, agility: 10, mana: 10, luck: 10 };

  const totalStr = (base.strength || 10) + (alloc.strength || 0);
  const totalEnd = (base.endurance || 10) + (alloc.endurance || 0);
  const totalAgi = (base.agility || 10) + (alloc.agility || 0);
  const totalMna = (base.mana || 10) + (alloc.mana || 0);
  const totalLck = (base.luck || 10) + (alloc.luck || 0);

  const ceBonusAtk = servant.equippedCe?.atkBonus || 0;
  const ceBonusHp = servant.equippedCe?.hpBonus || 0;
  const lvl = servant.level || 1;

  const totalHp = Math.round((t.baseHp || 28000) * (1 + (lvl - 1) * 0.05) + totalEnd * 150 + ceBonusHp);
  const totalAtk = Math.round((t.baseAtk || 10000) * (1 + (lvl - 1) * 0.05) + totalStr * 80 + ceBonusAtk);

  // Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 960);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(0.3, '#0b0f19');
  bgGrad.addColorStop(0.7, '#080c14');
  bgGrad.addColorStop(1, '#020617');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 800, 960);

  // Decorative Border
  const borderColor = t.rarity === 5 ? '#f59e0b' : '#38bdf8';
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 3;
  drawRoundRect(ctx, 12, 12, 776, 936, 16);
  ctx.stroke();

  // Top Header Line - Servant Name
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText(servant.nickname || t.name || 'Heroic Spirit', 30, 52);

  // Title & Master
  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(`${t.title || 'Heroic Spirit'} • Master: ${masterName}`, 30, 80);

  // Class Badge & Stars on Right
  ctx.textAlign = 'right';
  ctx.fillStyle = t.rarity === 5 ? '#fbbf24' : '#38bdf8';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText((t.servantClass || 'SABER').toUpperCase(), 770, 52);

  ctx.fillStyle = '#fbbf24';
  ctx.font = '22px system-ui, sans-serif';
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
  ctx.font = 'bold 17px system-ui, sans-serif';
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
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('MAX HP', 44, 166);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText(totalHp.toLocaleString(), 44, 194);

  // ATK Badge
  ctx.fillStyle = '#111827';
  drawRoundRect(ctx, 260, 142, 220, 62, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(248, 113, 113, 0.35)';
  ctx.stroke();

  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('TOTAL ATK', 274, 166);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText(totalAtk.toLocaleString(), 274, 194);

  // Base Parameters Box
  ctx.fillStyle = '#111827';
  drawRoundRect(ctx, 30, 214, 450, 72, 10);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('BASE PARAMETERS', 44, 236);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(`STR: ${totalStr}    END: ${totalEnd}    AGI: ${totalAgi}`, 44, 258);
  ctx.fillText(`MNA: ${totalMna}    LCK: ${totalLck}`, 44, 277);

  // Command Deck
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('COMMAND DECK', 30, 308);

  const commandDeck: CardType[] = t.commandDeck || ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'];
  commandDeck.forEach((card: CardType, idx: number) => {
    const cardX = 30 + idx * 90;
    const cardY = 318;
    ctx.fillStyle = card === 'Buster' ? '#dc2626' : card === 'Arts' ? '#2563eb' : '#16a34a';
    drawRoundRect(ctx, cardX, cardY, 82, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px system-ui, sans-serif';
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
    rGrid.points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.stroke();
  });

  // Polygon fill
  ctx.beginPath();
  radar.points.forEach((p, idx) => {
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
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('STR', 630, 155);
  ctx.fillText('END', 715, 198);
  ctx.fillText('AGI', 685, 320);
  ctx.fillText('MNA', 575, 320);
  ctx.fillText('LCK', 545, 198);

  // --- MIDDLE SECTION: HEROIC SPIRIT SKILLS (ACTIVE & PASSIVE) ---
  ctx.textAlign = 'left';
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px system-ui, sans-serif';
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
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(`${sk.icon || '✨'} ${sk.name}`, 46, skY + 28);

    // Cooldown badge on right
    ctx.textAlign = 'right';
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`CD: ${sk.cooldown || 5}T`, 754, skY + 28);

    // Skill Description
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '15px system-ui, sans-serif';
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
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(`Noble Phantasm: ${np.name} [${npCardEmoji} ${np.cardType}]`, 46, 678);

  ctx.fillStyle = '#fde047';
  ctx.font = 'italic 15px system-ui, sans-serif';
  const chant = servant.customQuotes?.noblePhantasm || np.chant || '...';
  drawWrappedText(ctx, `"${chant}"`, 46, 704, 708, 20, 2);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '15px system-ui, sans-serif';
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
  ctx.font = 'bold 17px system-ui, sans-serif';
  const ceName = servant.equippedCe ? servant.equippedCe.name : 'None';
  const ceStatBonus = servant.equippedCe ? ` (+${ceBonusAtk} ATK / +${ceBonusHp} HP)` : '';
  ctx.fillText(`Equipped CE: ${ceName}${ceStatBonus}`, 46, 826);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '15px system-ui, sans-serif';
  const ceEffect = servant.equippedCe ? servant.equippedCe.effectText : 'No Craft Essence equipped. Use /customise equip to link a sacred relic.';
  drawWrappedText(ctx, ceEffect, 46, 856, 708, 22, 3);
}

function drawSparkDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
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

function drawVectorCrossedSwords(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, size * 0.12);
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(cx - size, cy - size);
  ctx.lineTo(cx + size, cy + size);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + size * 0.35, cy + size * 0.75);
  ctx.lineTo(cx + size * 0.75, cy + size * 0.35);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + size, cy - size);
  ctx.lineTo(cx - size, cy + size);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - size * 0.35, cy + size * 0.75);
  ctx.lineTo(cx - size * 0.75, cy + size * 0.35);
  ctx.stroke();
  ctx.restore();
}

function drawVectorShield(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, fillColor: string, strokeColor: string) {
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

function drawVectorLock(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string = '#94a3b8'
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.2;

  // Lock shackle
  ctx.beginPath();
  ctx.arc(cx, cy - 3, 3, Math.PI, 0, false);
  ctx.stroke();

  // Lock body
  drawRoundRect(ctx, cx - 4, cy - 1, 8, 7, 1.5);
  ctx.fill();

  // Keyhole
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(cx, cy + 2, 1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Helper to draw a Command Card icon in browser canvas
 */
function drawBrowserCommandCardIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, type: string) {
  ctx.save();
  if (type === 'Buster') {
    drawVectorCrossedSwords(ctx, cx, cy, 11, '#fca5a5');
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
    drawVectorShield(ctx, cx, cy, 16, 20, 'rgba(251, 191, 36, 0.4)', '#fde047');
    drawSparkDiamond(ctx, cx, cy - 3, 5, '#ffffff');
  }
  ctx.restore();
}

/**
 * Helper to draw a crisp Vector Chevron Arrow (Zero missing glyph tofu)
 */
function drawVectorChevronArrow(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string = '#fbbf24') {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy - 7);
  ctx.lineTo(cx - 1, cy);
  ctx.lineTo(cx - 6, cy + 7);
  ctx.stroke();
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
function drawMiniReticle(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string = '#f87171') {
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
 * Helper to draw a Command Card Badge
 */
function drawCommandCardBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cardType: string,
  stepIndex: number,
  isSurging: boolean = false
) {
  ctx.save();
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

  const cGrad = ctx.createLinearGradient(x, y, x, y + h);
  cGrad.addColorStop(0, isSurging ? '#991b1b' : gradTop);
  cGrad.addColorStop(1, gradBottom);
  ctx.fillStyle = cGrad;
  drawRoundRect(ctx, x, y, w, h, 6);
  ctx.fill();

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

  ctx.strokeStyle = isSurging ? 'rgba(254, 240, 138, 0.4)' : 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 0.8;
  drawRoundRect(ctx, x + 2, y + 2, w - 4, h - 4, 4);
  ctx.stroke();

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

  drawBrowserCommandCardIcon(ctx, x + w / 2, y + 42, cardType);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(cardTitle, x + w / 2, y + 68);

  ctx.fillStyle = accentColor;
  ctx.font = 'bold 10px monospace';
  ctx.fillText(subTag, x + w / 2, y + 84);

  ctx.restore();
}

/**
 * Helper to draw Target-Locked Opponent HUD
 */
function drawTargetLockedHUD(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  defenderImg: HTMLImageElement | null,
  defenderName: string,
  defenderClass: string,
  crosshairAngle: number = 0,
  crosshairScale: number = 1.0
) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  drawRoundRect(ctx, x + 3, y + 3, w, h, 4);
  ctx.fill();

  const innerX = x + 3;
  const innerY = y + 3;
  const innerW = w - 6;
  const innerH = h - 6;

  ctx.save();
  drawRoundRect(ctx, innerX, innerY, innerW, innerH, 3);
  ctx.clip();

  if (defenderImg) {
    drawImageCover(ctx, defenderImg, innerX, innerY, innerW, innerH);
  } else {
    const fbGrad = ctx.createLinearGradient(innerX, innerY, innerX, innerY + innerH);
    fbGrad.addColorStop(0, '#2b0909');
    fbGrad.addColorStop(1, '#110303');
    ctx.fillStyle = fbGrad;
    ctx.fillRect(innerX, innerY, innerW, innerH);

    drawVectorShield(ctx, innerX + innerW / 2, innerY + 54, 46, 54, 'rgba(239, 68, 68, 0.2)', '#ef4444');
    drawVectorCrossedSwords(ctx, innerX + innerW / 2, innerY + 54, 14, '#f87171');
  }

  const redVignette = ctx.createRadialGradient(innerX + innerW / 2, innerY + innerH / 2, 16, innerX + innerW / 2, innerY + innerH / 2, innerW * 0.9);
  redVignette.addColorStop(0, 'rgba(239, 68, 68, 0.04)');
  redVignette.addColorStop(0.65, 'rgba(127, 29, 29, 0.4)');
  redVignette.addColorStop(1, 'rgba(15, 5, 5, 0.88)');
  ctx.fillStyle = redVignette;
  ctx.fillRect(innerX, innerY, innerW, innerH);

  ctx.strokeStyle = 'rgba(239, 68, 68, 0.14)';
  ctx.lineWidth = 1;
  for (let ly = innerY; ly < innerY + innerH; ly += 6) {
    ctx.beginPath();
    ctx.moveTo(innerX, ly);
    ctx.lineTo(innerX + innerW, ly);
    ctx.stroke();
  }

  const cx = innerX + innerW / 2;
  const cy = innerY + 54;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(crosshairScale, crosshairScale);
  ctx.rotate(crosshairAngle);

  ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-28, 0);
  ctx.lineTo(-14, 0);
  ctx.moveTo(14, 0);
  ctx.lineTo(28, 0);
  ctx.moveTo(0, -28);
  ctx.lineTo(0, -14);
  ctx.moveTo(0, 14);
  ctx.lineTo(0, 28);
  ctx.stroke();
  ctx.restore();

  ctx.restore();

  ctx.strokeStyle = '#b91c1c';
  ctx.lineWidth = 2;
  drawRoundRect(ctx, x, y, w, h, 4);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, x + 2, y + 2, w - 4, h - 4, 3);
  ctx.stroke();

  const bLen = 12;
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, y + bLen);
  ctx.lineTo(x, y);
  ctx.lineTo(x + bLen, y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + w - bLen, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + bLen);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x, y + h - bLen);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + bLen, y + h);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + w - bLen, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y + h - bLen);
  ctx.stroke();

  const badgeW = 128;
  const badgeH = 19;
  const badgeX = x + (w - badgeW) / 2;
  const badgeY = y - 9;

  ctx.fillStyle = '#7f1d1d';
  drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 3);
  ctx.fill();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.5;
  drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 3);
  ctx.stroke();

  drawMiniReticle(ctx, badgeX + 16, badgeY + 10, '#f87171');
  ctx.fillStyle = '#fee2e2';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TARGET: LOCKED', badgeX + badgeW / 2 + 7, badgeY + 14);

  const nameBoxH = 28;
  const nameBoxY = y + h - nameBoxH;
  ctx.fillStyle = 'rgba(15, 5, 5, 0.94)';
  drawRoundRect(ctx, x + 4, nameBoxY - 2, w - 8, nameBoxH, 3);
  ctx.fill();
  ctx.strokeStyle = '#991b1b';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, x + 4, nameBoxY - 2, w - 8, nameBoxH, 3);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  const defDisplay = defenderName.length > 17 ? defenderName.slice(0, 16) + '…' : defenderName;
  ctx.fillText(defDisplay, x + w / 2, nameBoxY + 11);
  ctx.fillStyle = '#fca5a5';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText((defenderClass || 'Enemy').toUpperCase(), x + w / 2, nameBoxY + 22);

  ctx.restore();
}

/**
 * Render procedural battlefield stage backdrop or draw custom background image
 */
function drawBattlefieldStage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bgImg: HTMLImageElement | null,
  stagePreset: string = 'fuyuki',
  frameIdx: number = 0
) {
  if (bgImg) {
    // Custom user background image
    ctx.save();
    drawImageCover(ctx, bgImg, 0, 0, width, height);

    // Cinematic dark contrast overlay ensuring text & HUD are 100% legible
    const vGrad = ctx.createRadialGradient(width / 2, height / 2, 90, width / 2, height / 2, width * 0.72);
    vGrad.addColorStop(0, 'rgba(8, 4, 3, 0.40)');
    vGrad.addColorStop(0.7, 'rgba(6, 3, 2, 0.72)');
    vGrad.addColorStop(1, 'rgba(3, 1, 1, 0.90)');
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    return;
  }

  const preset = (stagePreset || 'fuyuki').toLowerCase();

  if (preset.includes('temple') || preset.includes('ryuudou')) {
    // Ryuudou Temple - Mystic Indigo Midnight & Moonlight Beam
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#040716');
    sky.addColorStop(0.5, '#0a122e');
    sky.addColorStop(1, '#050918');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    // Moonlight aura beam
    const moon = ctx.createRadialGradient(400, 30, 10, 400, 30, 260);
    moon.addColorStop(0, 'rgba(191, 219, 254, 0.35)');
    moon.addColorStop(0.5, 'rgba(96, 165, 250, 0.12)');
    moon.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = moon;
    ctx.fillRect(0, 0, width, height);

    // Misty mountain ridges & temple steps
    ctx.fillStyle = '#02040c';
    ctx.beginPath();
    ctx.moveTo(0, 250);
    ctx.lineTo(220, 180);
    ctx.lineTo(400, 220);
    ctx.lineTo(620, 160);
    ctx.lineTo(800, 240);
    ctx.lineTo(800, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    // Floating spirit motes
    for (let i = 0; i < 14; i++) {
      const mx = (i * 59 + frameIdx * 9) % width;
      const my = (i * 31 + (frameIdx % 4) * 6) % 220 + 20;
      drawSparkDiamond(ctx, mx, my, 2.5 + (i % 3), 'rgba(147, 197, 253, 0.7)');
    }
  } else if (preset.includes('throne')) {
    // Throne of Heroes - Celestial Golden Cosmic Realm
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#1c1004');
    sky.addColorStop(0.5, '#2e1906');
    sky.addColorStop(1, '#0f0802');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const sun = ctx.createRadialGradient(400, 90, 20, 400, 90, 320);
    sun.addColorStop(0, 'rgba(253, 224, 71, 0.32)');
    sun.addColorStop(0.5, 'rgba(217, 119, 6, 0.15)');
    sun.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(400, 90, 110, 0, Math.PI * 2);
    ctx.arc(400, 90, 175, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 12; i++) {
      const sx = (i * 67 + frameIdx * 7) % width;
      const sy = (i * 41) % 200 + 15;
      drawSparkDiamond(ctx, sx, sy, 2 + (i % 3), '#fbbf24');
    }
  } else if (preset.includes('grail') || preset.includes('abyss')) {
    // Greater Grail Cavern - Dark Leyline Abyss
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#0c040e');
    sky.addColorStop(0.5, '#17061a');
    sky.addColorStop(1, '#070209');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const mana = ctx.createRadialGradient(400, 120, 15, 400, 120, 270);
    mana.addColorStop(0, 'rgba(217, 70, 239, 0.3)');
    mana.addColorStop(0.6, 'rgba(147, 51, 234, 0.14)');
    mana.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = mana;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(236, 72, 153, 0.25)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(80, 0); ctx.lineTo(340, 120); ctx.lineTo(240, height);
    ctx.moveTo(720, 0); ctx.lineTo(460, 120); ctx.lineTo(560, height);
    ctx.stroke();
  } else if (preset.includes('snow') || preset.includes('castle')) {
    // Einzbern Castle Twilight Blizzard
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#070f20');
    sky.addColorStop(0.5, '#0d1d36');
    sky.addColorStop(1, '#060c18');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const moon = ctx.createRadialGradient(400, 50, 15, 400, 50, 240);
    moon.addColorStop(0, 'rgba(224, 242, 254, 0.35)');
    moon.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = moon;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 15; i++) {
      const fx = (i * 57 + frameIdx * 10) % width;
      const fy = (i * 29 + frameIdx * 8) % height;
      drawSparkDiamond(ctx, fx, fy, 2, 'rgba(255, 255, 255, 0.6)');
    }
  } else {
    // Default: Fuyuki Burning City
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#0c0503');
    sky.addColorStop(0.45, '#1f0905');
    sky.addColorStop(0.8, '#2e0d04');
    sky.addColorStop(1, '#0e0402');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    // Burning Horizon Aura
    const fireGrad = ctx.createRadialGradient(400, 230, 20, 400, 230, 360);
    fireGrad.addColorStop(0, 'rgba(239, 68, 68, 0.32)');
    fireGrad.addColorStop(0.45, 'rgba(245, 158, 11, 0.20)');
    fireGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = fireGrad;
    ctx.fillRect(0, 0, width, height);

    // Distant ruined city skyline silhouettes
    ctx.fillStyle = '#060201';
    ctx.fillRect(170, 160, 36, 100);
    ctx.fillRect(215, 140, 46, 120);
    ctx.fillRect(270, 175, 32, 85);
    ctx.fillRect(500, 155, 42, 105);
    ctx.fillRect(550, 135, 52, 125);
    ctx.fillRect(610, 170, 36, 90);

    // Drifting flame sparks / embers
    for (let i = 0; i < 16; i++) {
      const ex = (i * 49 + frameIdx * 12) % width;
      const ey = ((height - 50) - (i * 24 + frameIdx * 10)) % (height - 20);
      drawSparkDiamond(ctx, ex, ey, 2 + (i % 3), i % 2 === 0 ? '#f59e0b' : '#ef4444');
    }
  }
}

/**
 * Persona / Anime Dynamic Diagonal Full-Screen Screen-Splitting Slash
 * Slices boldly across the entire 800x420 screen with radiant energy, speed trails, and shockwave burst.
 */
function drawPersonaSlashAnimation(
  ctx: CanvasRenderingContext2D,
  frameIdx: number,
  cardTypeTheme: string = 'Buster'
) {
  ctx.save();

  if (frameIdx === 0) {
    // Frame 0: Focus Tension & Eye Gleam - Screen dims, razor charge line stretches diagonally
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fillRect(0, 0, 800, 420);

    // Diagonal gold charge line across the entire screen (top-right to bottom-left)
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(760, 15);
    ctx.lineTo(40, 405);
    ctx.stroke();

    // Ignition sparks at center and attacker focus point
    drawSparkDiamond(ctx, 400, 210, 5, '#fbbf24');
    drawSparkDiamond(ctx, 160, 110, 6, '#ffffff');
  } else if (frameIdx === 1) {
    // Frame 1: Blade Draw & Sudden Strike - High velocity forward stroke
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(780, 10);
    ctx.lineTo(30, 410);
    ctx.stroke();

    // Outer golden aura trail
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.65)';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(780, 10);
    ctx.lineTo(30, 410);
    ctx.stroke();

    // Dynamic speed streaks across canvas
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(680, 20); ctx.lineTo(120, 360);
    ctx.moveTo(820, 40); ctx.lineTo(220, 430);
    ctx.moveTo(580, 40); ctx.lineTo(40, 380);
    ctx.stroke();

    drawSparkDiamond(ctx, 400, 210, 7, '#ffffff');
    drawSparkDiamond(ctx, 520, 140, 5, '#fde047');
    drawSparkDiamond(ctx, 280, 280, 5, '#fde047');
  } else if (frameIdx === 2) {
    // Frame 2: THE SCREEN-SPLITTING CLEAVE (CLIMAX IMPACT FLASH!)
    // Massive incandescent energy polygon ripping across the full canvas
    ctx.beginPath();
    ctx.moveTo(820, -10);
    ctx.lineTo(720, -10);
    ctx.lineTo(-20, 390);
    ctx.lineTo(-20, 430);
    ctx.closePath();
    const slashFill = ctx.createLinearGradient(820, -10, -20, 430);
    slashFill.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
    slashFill.addColorStop(0.5, 'rgba(245, 158, 11, 0.55)');
    slashFill.addColorStop(1, 'rgba(239, 68, 68, 0.35)');
    ctx.fillStyle = slashFill;
    ctx.fill();

    // Colossal Outer Flame Wake (38px wide)
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
    ctx.lineWidth = 38;
    ctx.beginPath();
    ctx.moveTo(820, -10);
    ctx.lineTo(-20, 430);
    ctx.stroke();

    // Radiant Inset Golden Blade (18px wide)
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.85)';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(820, -10);
    ctx.lineTo(-20, 430);
    ctx.stroke();

    // Pure Blinding White Blade Core (6px wide)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(820, -10);
    ctx.lineTo(-20, 430);
    ctx.stroke();

    // Epicenter Radial Shockwave Ring at Center of Clash (400, 200)
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(400, 200, 72, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(400, 200, 105, 0, Math.PI * 2);
    ctx.stroke();

    // Secondary X-Cut Energy Blade (Lethal Anime Cross Cleave)
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(160, 30);
    ctx.lineTo(660, 370);
    ctx.stroke();

    // Velocity speed lines streaking across full screen
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.7)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(700, 0); ctx.lineTo(100, 360);
    ctx.moveTo(800, 50); ctx.lineTo(200, 410);
    ctx.moveTo(600, 20); ctx.lineTo(40, 350);
    ctx.moveTo(750, 110); ctx.lineTo(250, 410);
    ctx.stroke();

    // Array of 14 explosive spark diamonds radiating along the blade cut
    drawSparkDiamond(ctx, 400, 200, 9, '#ffffff');
    drawSparkDiamond(ctx, 400, 200, 14, 'rgba(254, 240, 138, 0.6)');
    drawSparkDiamond(ctx, 480, 150, 6, '#ffffff');
    drawSparkDiamond(ctx, 320, 250, 6, '#ffffff');
    drawSparkDiamond(ctx, 560, 110, 5, '#fde047');
    drawSparkDiamond(ctx, 240, 290, 5, '#fde047');
    drawSparkDiamond(ctx, 640, 65, 5.5, '#fbbf24');
    drawSparkDiamond(ctx, 160, 335, 5.5, '#fbbf24');
    drawSparkDiamond(ctx, 720, 25, 6, '#ffffff');
    drawSparkDiamond(ctx, 80, 375, 6, '#ffffff');
    drawSparkDiamond(ctx, 380, 130, 4, '#f87171');
    drawSparkDiamond(ctx, 430, 270, 4, '#f87171');
    drawSparkDiamond(ctx, 460, 230, 4.5, '#ffffff');
    drawSparkDiamond(ctx, 340, 170, 4.5, '#ffffff');
  } else if (frameIdx === 3) {
    // Frame 3: Resonant Wake Expanding -> 1st Command Card Surges!
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.7)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(820, -10);
    ctx.lineTo(-20, 430);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(800, -10);
    ctx.lineTo(-40, 430);
    ctx.stroke();

    drawSparkDiamond(ctx, 400, 200, 6, '#fbbf24');
    drawSparkDiamond(ctx, 305, 120, 7, '#fde047'); // Flaring at Card 1
  } else if (frameIdx === 4) {
    // Frame 4: Resonance Shockwave Sweeps to 2nd Command Card!
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(820, -10);
    ctx.lineTo(-20, 430);
    ctx.stroke();

    drawSparkDiamond(ctx, 400, 120, 7, '#93c5fd'); // Flaring at Card 2
    drawSparkDiamond(ctx, 450, 180, 4.5, '#fbbf24');
  } else if (frameIdx === 5) {
    // Frame 5: Resonance Overdrive Sweeps to 3rd Card & Full Chain Activation!
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(820, -10);
    ctx.lineTo(-20, 430);
    ctx.stroke();

    drawSparkDiamond(ctx, 495, 120, 7, '#6ee7b7'); // Flaring at Card 3
    drawSparkDiamond(ctx, 400, 35, 6, '#fde047');  // Banner glowing
  } else if (frameIdx === 6) {
    // Frame 6: Ember Scatter & Drifting Mana Sparks
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(820, -10);
    ctx.lineTo(-20, 430);
    ctx.stroke();

    drawSparkDiamond(ctx, 500, 80, 3.5, '#fef08a');
    drawSparkDiamond(ctx, 420, 160, 4, '#fef08a');
    drawSparkDiamond(ctx, 340, 240, 3.5, '#fef08a');
    drawSparkDiamond(ctx, 260, 320, 3, '#fef08a');
  } else if (frameIdx === 7) {
    // Frame 7: Settled Stance & Dialogue Focus
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.15)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(820, -10);
    ctx.lineTo(-20, 430);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw Attacker Hovering Sprite on the Left Side
 * A majestic half-body cut-in with smooth soft-edge gradient fade toward the center clash.
 */
function drawHoveringAttacker(
  ctx: CanvasRenderingContext2D,
  portraitImg: HTMLImageElement | null,
  servantName: string,
  servantClass: string,
  bondOrLevel: number | string,
  frameIdx: number
) {
  ctx.save();
  const sprX = 10;
  // Sinusoidal floating hover animation (6px vertical breathing float)
  const floatOffsetY = Math.sin((frameIdx / 8) * Math.PI * 2) * 6;
  const sprY = 10 + floatOffsetY;
  const sprW = 280;
  const sprH = 340;

  // Attacker golden/amber rim aura
  const auraGrad = ctx.createRadialGradient(130, 160 + floatOffsetY, 30, 130, 160 + floatOffsetY, 190);
  auraGrad.addColorStop(0, 'rgba(245, 158, 11, 0.22)');
  auraGrad.addColorStop(0.7, 'rgba(217, 119, 6, 0.08)');
  auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = auraGrad;
  ctx.fillRect(0, 0, 340, 380);

  if (portraitImg) {
    ctx.save();
    // Soft vignette on the right edge fading into the center clash
    drawImageCover(ctx, portraitImg, sprX, sprY, sprW, sprH);

    // Right-edge fade gradient so character hovers naturally over the battlefield
    const rFade = ctx.createLinearGradient(sprX + sprW * 0.55, 0, sprX + sprW + 10, 0);
    rFade.addColorStop(0, 'rgba(10, 5, 3, 0)');
    rFade.addColorStop(0.75, 'rgba(10, 5, 3, 0.7)');
    rFade.addColorStop(1, 'rgba(10, 5, 3, 0.98)');
    ctx.fillStyle = rFade;
    ctx.fillRect(sprX, sprY, sprW + 15, sprH + 10);

    // Bottom fade into the dialogue box
    const bFade = ctx.createLinearGradient(0, sprY + sprH * 0.65, 0, sprY + sprH);
    bFade.addColorStop(0, 'rgba(10, 5, 3, 0)');
    bFade.addColorStop(1, 'rgba(10, 5, 3, 0.95)');
    ctx.fillStyle = bFade;
    ctx.fillRect(sprX, sprY + sprH * 0.65, sprW, sprH * 0.35);
    ctx.restore();
  } else {
    // Stylized Heraldic Knight Silhouette Fallback
    const vGrad = ctx.createLinearGradient(sprX, sprY, sprX + sprW, sprY + sprH);
    vGrad.addColorStop(0, '#2b160b');
    vGrad.addColorStop(0.6, '#150904');
    vGrad.addColorStop(1, '#080302');
    ctx.fillStyle = vGrad;
    drawRoundRect(ctx, sprX + 15, sprY + 15, sprW - 30, sprH - 30, 8);
    ctx.fill();

    drawVectorShield(ctx, sprX + sprW / 2 - 10, sprY + 140, 64, 76, 'rgba(245, 158, 11, 0.2)', '#f59e0b');
    drawVectorCrossedSwords(ctx, sprX + sprW / 2 - 10, sprY + 140, 20, '#fbbf24');
  }

  // Floating Class Crest & Level Badge (Top-Left Shoulder)
  const badgeX = 20;
  const badgeY = 20;
  const badgeW = 160;
  const badgeH = 26;

  ctx.fillStyle = 'rgba(10, 5, 3, 0.92)';
  drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
  ctx.fill();

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.5;
  drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
  ctx.stroke();

  drawVectorStar(ctx, badgeX + 14, badgeY + 13, 5, 5, 2.5, '#fbbf24');

  const lvlText = typeof bondOrLevel === 'number' ? `Lv.${bondOrLevel}` : `${bondOrLevel}`;
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(lvlText, badgeX + 24, badgeY + 17);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText((servantClass || 'SABER').toUpperCase(), badgeX + badgeW - 10, badgeY + 17);

  ctx.restore();
}

/**
 * Draw Defender Hovering Sprite on the Right Side
 * Facing inward toward attacker with crimson target-lock HUD and soft edge fade.
 */
function drawHoveringDefender(
  ctx: CanvasRenderingContext2D,
  defenderImg: HTMLImageElement | null,
  defenderName: string,
  defenderClass: string,
  frameIdx: number
) {
  ctx.save();
  const sprX = 510;
  // Sinusoidal floating hover animation (5px counter-phase breathing float)
  const floatOffsetY = Math.cos((frameIdx / 8) * Math.PI * 2) * 5;
  const sprY = 10 + floatOffsetY;
  const sprW = 280;
  const sprH = 340;

  // Dark Crimson Tactical Aura
  const auraGrad = ctx.createRadialGradient(670, 160 + floatOffsetY, 30, 670, 160 + floatOffsetY, 190);
  auraGrad.addColorStop(0, 'rgba(239, 68, 68, 0.22)');
  auraGrad.addColorStop(0.7, 'rgba(153, 27, 27, 0.08)');
  auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = auraGrad;
  ctx.fillRect(470, 0, 330, 380);

  if (defenderImg) {
    ctx.save();
    drawImageCover(ctx, defenderImg, sprX, sprY, sprW, sprH);

    // Left-edge fade gradient so defender hovers seamlessly over stage
    const lFade = ctx.createLinearGradient(sprX - 10, 0, sprX + sprW * 0.45, 0);
    lFade.addColorStop(0, 'rgba(10, 5, 3, 0.98)');
    lFade.addColorStop(0.25, 'rgba(10, 5, 3, 0.7)');
    lFade.addColorStop(1, 'rgba(10, 5, 3, 0)');
    ctx.fillStyle = lFade;
    ctx.fillRect(sprX - 10, sprY, sprW, sprH + 10);

    // Bottom fade into the dialogue box
    const bFade = ctx.createLinearGradient(0, sprY + sprH * 0.65, 0, sprY + sprH);
    bFade.addColorStop(0, 'rgba(10, 5, 3, 0)');
    bFade.addColorStop(1, 'rgba(10, 5, 3, 0.95)');
    ctx.fillStyle = bFade;
    ctx.fillRect(sprX, sprY + sprH * 0.65, sprW, sprH * 0.35);

    // Tactical red combat grading
    ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
    ctx.fillRect(sprX, sprY, sprW, sprH);

    // Tactical scanlines
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.12)';
    ctx.lineWidth = 1;
    for (let ly = sprY; ly < sprY + sprH; ly += 6) {
      ctx.beginPath();
      ctx.moveTo(sprX, ly);
      ctx.lineTo(sprX + sprW, ly);
      ctx.stroke();
    }
    ctx.restore();
  } else {
    // Crimson Phantom Silhouette Fallback
    const fbGrad = ctx.createLinearGradient(sprX, sprY, sprX + sprW, sprY + sprH);
    fbGrad.addColorStop(0, '#2e0a0a');
    fbGrad.addColorStop(0.6, '#170404');
    fbGrad.addColorStop(1, '#090202');
    ctx.fillStyle = fbGrad;
    drawRoundRect(ctx, sprX + 15, sprY + 15, sprW - 30, sprH - 30, 8);
    ctx.fill();

    drawVectorShield(ctx, sprX + sprW / 2, sprY + 140, 60, 72, 'rgba(239, 68, 68, 0.2)', '#ef4444');
    drawVectorCrossedSwords(ctx, sprX + sprW / 2, sprY + 140, 18, '#f87171');
  }

  // Tactical Crosshair Reticle (cx: 650, cy: 120)
  const cx = 650;
  const cy = 120;
  const crosshairAngle = (frameIdx * 45 * Math.PI) / 180;
  const crosshairScale = frameIdx === 4 ? 0.9 : frameIdx === 2 ? 1.15 : 1.0;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(crosshairScale, crosshairScale);
  ctx.rotate(crosshairAngle);

  ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.stroke();

  // Crosshair Ticks
  ctx.beginPath();
  ctx.moveTo(-32, 0); ctx.lineTo(-16, 0);
  ctx.moveTo(16, 0); ctx.lineTo(32, 0);
  ctx.moveTo(0, -32); ctx.lineTo(0, -16);
  ctx.moveTo(0, 16); ctx.lineTo(0, 32);
  ctx.stroke();
  ctx.restore();

  // Floating [ TARGET: LOCKED ] Crimson HUD Badge (Top-Right)
  const badgeW = 140;
  const badgeH = 26;
  const badgeX = 630;
  const badgeY = 20;

  ctx.fillStyle = 'rgba(127, 29, 29, 0.92)';
  drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
  ctx.fill();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.5;
  drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
  ctx.stroke();

  drawMiniReticle(ctx, badgeX + 16, badgeY + 13, '#f87171');
  ctx.fillStyle = '#fee2e2';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TARGET: LOCKED', badgeX + badgeW / 2 + 8, badgeY + 17);

  // Floating Defender Nameplate above the Dialogue Box
  const nameBoxW = 200;
  const nameBoxH = 24;
  const nameBoxX = 570;
  const nameBoxY = 216;

  ctx.fillStyle = 'rgba(15, 5, 5, 0.92)';
  drawRoundRect(ctx, nameBoxX, nameBoxY, nameBoxW, nameBoxH, 4);
  ctx.fill();
  ctx.strokeStyle = '#991b1b';
  ctx.lineWidth = 1.2;
  drawRoundRect(ctx, nameBoxX, nameBoxY, nameBoxW, nameBoxH, 4);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  const defClean = defenderName.length > 18 ? defenderName.slice(0, 17) + '…' : defenderName;
  ctx.fillText(`${defClean} [${(defenderClass || 'ENEMY').toUpperCase()}]`, nameBoxX + nameBoxW / 2, nameBoxY + 16);

  ctx.restore();
}

/**
 * Draw Center Tactical Command Cards & Active Chain Resonance HUD
 */
function drawCenterCommandHUD(
  ctx: CanvasRenderingContext2D,
  chainTagOrTitle: string,
  sequence: ('Buster' | 'Arts' | 'Quick' | 'NP')[],
  frameIdx: number
) {
  ctx.save();
  let chainGradTop = '#78350f';
  let chainBorder = '#f59e0b';
  let chainSubtitle = 'Tactical Card Resonance • Enhanced Strike Power';

  const tagUpper = (chainTagOrTitle || '').toUpperCase();
  if (tagUpper.includes('BUSTER')) {
    chainGradTop = '#7f1d1d';
    chainBorder = '#ef4444';
    chainSubtitle = 'Buster Power +50% • Extra Attack Guaranteed';
  } else if (tagUpper.includes('ARTS')) {
    chainGradTop = '#1e3a8a';
    chainBorder = '#3b82f6';
    chainSubtitle = 'NP Battery +20% • Arts Resonance Activated';
  } else if (tagUpper.includes('QUICK')) {
    chainGradTop = '#064e3b';
    chainBorder = '#10b981';
    chainSubtitle = 'Critical Stars +20 • Lethal Critical Stance';
  }

  // Active Chain Banner Pill
  const bannerW = 310;
  const bannerH = 26;
  const bannerX = 245;
  const bannerY = 20;

  const cbGrad = ctx.createLinearGradient(bannerX, bannerY, bannerX + bannerW, bannerY);
  cbGrad.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
  cbGrad.addColorStop(0.2, chainGradTop);
  cbGrad.addColorStop(0.8, chainGradTop);
  cbGrad.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
  ctx.fillStyle = cbGrad;
  drawRoundRect(ctx, bannerX, bannerY, bannerW, bannerH, 4);
  ctx.fill();

  ctx.strokeStyle = frameIdx === 5 ? '#fde047' : chainBorder;
  ctx.lineWidth = frameIdx === 5 ? 2.2 : 1.4;
  drawRoundRect(ctx, bannerX, bannerY, bannerW, bannerH, 4);
  ctx.stroke();

  drawSparkDiamond(ctx, bannerX + 14, bannerY + bannerH / 2, 4, '#fbbf24');
  drawSparkDiamond(ctx, bannerX + bannerW - 14, bannerY + bannerH / 2, 4, '#fbbf24');

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`[ ${(chainTagOrTitle || 'COMBAT CHAIN').toUpperCase()} ]`, bannerX + bannerW / 2, bannerY + 18);

  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText(chainSubtitle, bannerX + bannerW / 2, bannerY + 40);

  // Command Cards Row
  const cardW = 92;
  const cardH = 88;
  const cardY = 56;
  const cardX1 = 250;
  const cardX2 = 354;
  const cardX3 = 458;

  const validSeq = sequence && sequence.length === 3 ? sequence : ['Buster', 'Buster', 'Buster'];

  drawCommandCardBadge(ctx, cardX1, cardY, cardW, cardH, validSeq[0], 0, frameIdx === 3);
  drawCommandCardBadge(ctx, cardX2, cardY, cardW, cardH, validSeq[1], 1, frameIdx === 4);
  drawCommandCardBadge(ctx, cardX3, cardY, cardW, cardH, validSeq[2], 2, frameIdx === 5);

  drawVectorChevronArrow(ctx, 347, cardY + cardH / 2, '#fbbf24');
  drawVectorChevronArrow(ctx, 451, cardY + cardH / 2, '#fbbf24');

  ctx.restore();
}

/**
 * Render a single frame of the Visual Novel Dialogue Cut-In
 */
function renderDialogueSingleFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frameIdx: number,
  speakerName: string,
  quoteText: string,
  chainTagOrTitle: string,
  servantClass: string,
  portraitImg: HTMLImageElement | null,
  bondOrLevel: number | string,
  defenderName: string,
  defenderImg: HTMLImageElement | null,
  defenderClass: string,
  sequence: ('Buster' | 'Arts' | 'Quick' | 'NP')[],
  bgImg: HTMLImageElement | null = null,
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
  const nameMetrics = ctx.measureText(`${speakerName} [${servantClass || 'Servant'}]`);
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
 * 2. Visual Novel Dialogue Frame (800x420 Animated Action Cut-In)
 * Features Hovering Split-Screen Characters, Full-Screen Screen-Splitting Slash,
 * Tactical Command Cards & Chain HUD, and Customizable Battlefield Backgrounds.
 */
export async function renderDialogueCard(
  canvas: HTMLCanvasElement,
  speakerName: string,
  quoteText: string,
  title: string = 'Tactical Chain',
  servantClass: string = 'Saber',
  avatarUrl?: string,
  bondOrLevel: number | string = 8,
  defenderName: string = 'Enemy Servant',
  defenderAvatarUrl?: string,
  defenderClass: string = 'Servant',
  sequence: ('Buster' | 'Arts' | 'Quick' | 'NP')[] = ['Buster', 'Buster', 'Buster'],
  bgUrlOrPreset: string = 'fuyuki'
): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = 800;
  canvas.height = 420;

  // Clear existing animation timer if any
  if ((canvas as any).__animTimer) {
    clearInterval((canvas as any).__animTimer);
    (canvas as any).__animTimer = null;
  }

  // Pre-load images concurrently
  const isCustomBgUrl = bgUrlOrPreset && (bgUrlOrPreset.startsWith('http') || bgUrlOrPreset.startsWith('data:image'));
  const [portraitImg, defenderImg, bgImg] = await Promise.all([
    avatarUrl ? loadBrowserImage(avatarUrl) : Promise.resolve(null),
    defenderAvatarUrl ? loadBrowserImage(defenderAvatarUrl) : Promise.resolve(null),
    isCustomBgUrl ? loadBrowserImage(bgUrlOrPreset) : Promise.resolve(null)
  ]);

  const stagePreset = isCustomBgUrl ? 'custom' : (bgUrlOrPreset || 'fuyuki');

  // Render initial climax frame (Frame 2 - The Cleave)
  renderDialogueSingleFrame(
    ctx,
    800,
    420,
    2,
    speakerName,
    quoteText,
    title,
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

  // Start animated playback loop
  let frame = 2;
  const timer = setInterval(() => {
    if (!canvas.isConnected) {
      clearInterval(timer);
      (canvas as any).__animTimer = null;
      return;
    }
    frame = (frame + 1) % 8;
    ctx.clearRect(0, 0, 800, 420);
    renderDialogueSingleFrame(
      ctx,
      800,
      420,
      frame,
      speakerName,
      quoteText,
      title,
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
  }, 120);

  (canvas as any).__animTimer = timer;
}

function loadBrowserImage(url?: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, 2500);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        resolve(img);
      }
    };
    img.onerror = () => {
      // If CORS anonymous failed, attempt standard load so canvas can still paint it
      const fallbackImg = new Image();
      fallbackImg.onload = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          resolve(fallbackImg);
        }
      };
      fallbackImg.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          resolve(null);
        }
      };
      fallbackImg.src = url;
    };
    img.src = url;
  });
}

/**
 * Draw Tactical Crit Star Reservoir Box (Fate Ether Crit Star Pool)
 */
function drawCritStarBox(
  ctx: CanvasRenderingContext2D,
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
 * Draw Grand Fate Tarot Command Card (Option A - Zero neon glows, metallic obsidian finish)
 */
function drawTarotCommandCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cardType: string,
  stepIndex: number,
  critStars: number = 0,
  isQuickFirst: boolean = false
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
  let stepMult = stepIndex === 0 ? '1st (+50% DMG)' : stepIndex === 1 ? '2nd (1.2x)' : '3rd (1.4x)';

  if (cardType === 'Arts') {
    gradTop = '#0f2942';
    gradBottom = '#040d16';
    borderColor = '#3b82f6';
    accentColor = '#93c5fd';
    ringColor = 'rgba(59, 130, 246, 0.4)';
    cardTitle = 'ARTS';
    letter = 'A';
    stepMult = stepIndex === 0 ? '1st (+100% NP)' : stepIndex === 1 ? '2nd (1.2x)' : '3rd (1.4x)';
  } else if (cardType === 'Quick') {
    gradTop = '#064e3b';
    gradBottom = '#02150e';
    borderColor = '#10b981';
    accentColor = '#6ee7b7';
    ringColor = 'rgba(16, 185, 129, 0.4)';
    cardTitle = 'QUICK';
    letter = 'Q';
    stepMult = stepIndex === 0 ? '1st (+STARS)' : stepIndex === 1 ? '2nd (1.2x)' : '3rd (1.4x)';
  } else if (cardType === 'NP' || cardType === 'Phantasm') {
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
  const romanNumeral = stepIndex === 0 ? 'I' : stepIndex === 1 ? 'II' : 'III';

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

  if (cardType === 'NP' || cardType === 'Phantasm') {
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
 * Draw Servant Portrait Frame (Option A - No neon glow, refined metallic border + class badge)
 */
function drawServantPortraitCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  avatarImg: HTMLImageElement | null,
  servant: ActiveCombatant,
  accentColor: string
) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  drawRoundRect(ctx, x + 2, y + 2, w, h, 8);
  ctx.fill();

  const innerX = x + 2;
  const innerY = y + 2;
  const innerW = w - 4;
  const innerH = h - 4;

  if (avatarImg) {
    ctx.save();
    drawRoundRect(ctx, innerX, innerY, innerW, innerH, 6);
    ctx.clip();
    drawImageCover(ctx, avatarImg, innerX, innerY, innerW, innerH);

    // Subtle bottom vignette for contrast
    const vGrad = ctx.createLinearGradient(innerX, innerY + innerH - 60, innerX, innerY + innerH);
    vGrad.addColorStop(0, 'rgba(10, 15, 26, 0)');
    vGrad.addColorStop(1, 'rgba(10, 15, 26, 0.85)');
    ctx.fillStyle = vGrad;
    ctx.fillRect(innerX, innerY + innerH - 60, innerW, 60);

    ctx.restore();

    // Subtle class badge at bottom of portrait
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
    // Heraldic Velvet Fallback
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
    ctx.beginPath();
    ctx.arc(innerX + innerW / 2, cy, 42, 0, Math.PI * 2);
    ctx.strokeStyle = `${accentColor}33`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    drawVectorShield(ctx, innerX + innerW / 2, cy, 54, 64, `${accentColor}22`, accentColor);
    drawVectorCrossedSwords(ctx, innerX + innerW / 2, cy, 16, '#ffffff');

    const sClass = (servant.servantClass || 'SABER').toUpperCase();
    ctx.fillStyle = accentColor;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sClass, innerX + innerW / 2, cy + 56);

    const sName = (servant.name || 'Heroic Spirit').slice(0, 16);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(sName, innerX + innerW / 2, cy + 80);
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
 * Draw Minimalist Floating Damage Clash Banner (Option A - Zero redundant text)
 */
function drawMinimalClashBanner(
  ctx: CanvasRenderingContext2D,
  log: CombatTurnLog,
  p1: ActiveCombatant,
  p2: ActiveCombatant,
  x: number = 16,
  y: number = 286,
  w: number = 608,
  h: number = 54
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
  ctx.fillText(`TURN ${log.turnNumber || 1}`, turnX + turnW / 2, turnY + 19);

  // 3. Center Damage Text
  const dmg = log.damageDealt > 0 ? log.damageDealt.toLocaleString() : '0';
  ctx.textAlign = 'center';

  if (log.isNoblePhantasm) {
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#fde047';
    ctx.fillText(`NOBLE PHANTASM: ${dmg} DAMAGE!`, x + w / 2 - 10, y + 33);
  } else if (log.isCritical) {
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#f87171';
    ctx.fillText(`CRITICAL STRIKE: ${dmg} DAMAGE!`, x + w / 2 - 10, y + 33);
  } else {
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(`DEALT ${dmg} DAMAGE!`, x + w / 2 - 10, y + 33);
  }

  // 4. Right Tactical Gains Pill (+NP & +Stars)
  const gainsX = x + w - 128;
  const gainsY = y + 12;
  const gainsW = 116;
  const gainsH = 30;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  drawRoundRect(ctx, gainsX, gainsY, gainsW, gainsH, 5);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, gainsX, gainsY, gainsW, gainsH, 5);
  ctx.stroke();

  const npGain = (log as any).npGained ?? log.npCharged ?? 0;
  const starGain = log.starsGenerated || 0;
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`+${npGain}% NP`, gainsX + 10, gainsY + 19);

  ctx.fillStyle = '#38bdf8';
  ctx.textAlign = 'right';
  ctx.fillText(`+${starGain} ★`, gainsX + gainsW - 10, gainsY + 19);

  ctx.restore();
}

/**
 * 3. Battle Turn Clash Summary (640x680 Option A Layout)
 */
export async function renderBattleTurnSummary(
  canvas: HTMLCanvasElement,
  log: CombatTurnLog,
  p1: ActiveCombatant,
  p2: ActiveCombatant
): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = 640;
  canvas.height = 680;

  // Load Avatars concurrently
  const [p1Img, p2Img] = await Promise.all([
    loadBrowserImage(p1.avatarUrl),
    loadBrowserImage(p2.avatarUrl)
  ]);

  // Background - Deep Mystic Slate War Canvas
  const bgGrad = ctx.createLinearGradient(0, 0, 640, 680);
  bgGrad.addColorStop(0, '#090d18');
  bgGrad.addColorStop(0.5, '#05070f');
  bgGrad.addColorStop(1, '#0c0b16');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 640, 680);

  // Subtle Matte Slate Frame (No neon glow)
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.6;
  drawRoundRect(ctx, 6, 6, 628, 668, 10);
  ctx.stroke();

  // Subtle inner accent line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 0.8;
  drawRoundRect(ctx, 8, 8, 624, 664, 8);
  ctx.stroke();

  // ==========================================
  // TOP SECTION: PLAYER 1 (MASTER & SERVANT)
  // ==========================================
  // 1. P1 Avatar Portrait Card (Left, 172x260) - Large Portrait
  drawServantPortraitCard(ctx, 16, 16, 172, 260, p1Img, p1, '#38bdf8');

  // 2. P1 Header Title & Class Pill
  const p1DisplayName = (p1.masterName || 'Master 1').replace(/[^\x00-\x7F]/g, '');
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(p1DisplayName, 200, 32);

  const p1NameWidth = ctx.measureText(p1DisplayName).width;
  const p1ServantClean = (p1.name || 'Heroic Spirit').replace(/[^\x00-\x7F]/g, '');
  const p1ClassClean = (p1.servantClass || 'SABER').toUpperCase();

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

  // Servant Name
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(p1ServantClean, pillX + 72, 32);

  // 2.5 P1 3 Active Skill Badges (Top Right above HP Bar)
  const p1Skills = p1.skills || [];
  const p1Bond = p1.bondLevel !== undefined ? p1.bondLevel : 5;
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

  // 3. P1 HP Bar (22px height)
  const p1HpRatio = Math.max(0, Math.min(1, p1.currentHp / p1.maxHp));
  const p1NpRatio = Math.max(0, Math.min(1, (p1.npGauge || 0) / 100));

  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 200, 40, 424, 22, 4);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.2;
  drawRoundRect(ctx, 200, 40, 424, 22, 4);
  ctx.stroke();

  if (p1HpRatio > 0) {
    const hpGrad = ctx.createLinearGradient(200, 40, 200, 62);
    if (p1HpRatio > 0.35) {
      hpGrad.addColorStop(0, '#22c55e');
      hpGrad.addColorStop(1, '#15803d');
    } else {
      hpGrad.addColorStop(0, '#ef4444');
      hpGrad.addColorStop(1, '#b91c1c');
    }
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
  ctx.fillText(`HP  ${p1.currentHp.toLocaleString()} / ${p1.maxHp.toLocaleString()} (${Math.round(p1HpRatio * 100)}%)`, 210, 56);

  // NP Bar (22px height, full width 424px)
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 200, 66, 424, 22, 4);
  ctx.fill();
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 1.2;
  drawRoundRect(ctx, 200, 66, 424, 22, 4);
  ctx.stroke();

  if (p1NpRatio > 0) {
    const npGrad = ctx.createLinearGradient(200, 66, 200, 88);
    if ((p1.npGauge || 0) >= 100) {
      npGrad.addColorStop(0, '#fde047');
      npGrad.addColorStop(1, '#d97706');
    } else {
      npGrad.addColorStop(0, '#facc15');
      npGrad.addColorStop(1, '#ca8a04');
    }
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
  const p1NpText = `NP: ${Math.round(p1.npGauge || 0)}%`;
  ctx.fillText(p1NpText, 210, 82);

  if ((p1.npGauge || 0) >= 100) {
    const npTextW = ctx.measureText(p1NpText).width;
    drawVectorStar(ctx, 220 + npTextW, 78, 5, 4.5, 2.2, '#fde047');
    ctx.fillStyle = '#fde047';
    ctx.fillText('[MAX READY]', 228 + npTextW, 82);
  }

  // 4. P1 Crit Star Reservoir Box + 3 Compact Command Cards (w: 100 each, h: 180)
  const p1Cards = (log.p1Cards || log.cardsUsed || ['Buster', 'Arts', 'Quick']) as ('Buster' | 'Arts' | 'Quick' | 'NP')[];
  const isP1QuickLead = p1Cards[0] === 'Quick';

  // Crit Star Box on Left of Cards
  drawCritStarBox(ctx, 200, 92, 100, 184, p1.critStars || 0, false);

  // 3 Compact Command Cards
  p1Cards.slice(0, 3).forEach((card, idx) => {
    const cardX = 308 + idx * 108;
    const cardY = 92;
    const cardW = 100;
    const cardH = 184;

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

  // ==========================================
  // MIDDLE SECTION: MINIMAL CLASH BANNER (Option A - No Slop)
  // ==========================================
  drawMinimalClashBanner(ctx, log, p1, p2, 16, 284, 608, 54);

  // ==========================================
  // BOTTOM SECTION: PLAYER 2 (MASTER & SERVANT)
  // ==========================================
  // 1. P2 Crit Star Reservoir Box + 3 Compact Command Cards (Left, w: 100 each, h: 184)
  const p2Cards = (log.p2Cards || ['Arts', 'Buster', 'Quick']) as ('Buster' | 'Arts' | 'Quick' | 'NP')[];
  const isP2QuickLead = p2Cards[0] === 'Quick';

  // P2 Crit Star Box
  drawCritStarBox(ctx, 16, 346, 100, 184, p2.critStars || 0, true);

  // P2 3 Compact Command Cards
  p2Cards.slice(0, 3).forEach((card, idx) => {
    const cardX = 124 + idx * 108;
    const cardY = 346;
    const cardW = 100;
    const cardH = 184;

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

  // 2. P2 Avatar Portrait Card (Right, 172x260) - Large Portrait Upgrade
  drawServantPortraitCard(ctx, 452, 346, 172, 260, p2Img, p2, '#ef4444');

  // 3. P2 Skills (Row under cards, y: 536)
  const p2Skills = p2.skills || [];
  const p2Bond = p2.bondLevel !== undefined ? p2.bondLevel : 3;
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

  // 4. P2 Header Title & Class Pill (Right-aligned next to skills)
  const p2DisplayName = (p2.masterName || 'Master 2').replace(/[^\x00-\x7F]/g, '');
  const p2ServantClean = (p2.name || 'Enemy Spirit').replace(/[^\x00-\x7F]/g, '');
  const p2ClassClean = (p2.servantClass || 'ARCHER').toUpperCase();

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

  // 5. P2 NP Bar (y: 560, full width 424px)
  const p2NpRatio = Math.max(0, Math.min(1, (p2.npGauge || 0) / 100));
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 16, 560, 424, 22, 4);
  ctx.fill();
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 1.2;
  drawRoundRect(ctx, 16, 560, 424, 22, 4);
  ctx.stroke();

  if (p2NpRatio > 0) {
    const npGrad = ctx.createLinearGradient(16, 560, 16, 582);
    if ((p2.npGauge || 0) >= 100) {
      npGrad.addColorStop(0, '#fde047');
      npGrad.addColorStop(1, '#d97706');
    } else {
      npGrad.addColorStop(0, '#facc15');
      npGrad.addColorStop(1, '#ca8a04');
    }
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
  const p2NpText = `NP: ${Math.round(p2.npGauge || 0)}%`;
  ctx.fillText(p2NpText, 26, 576);

  if ((p2.npGauge || 0) >= 100) {
    const p2NpW = ctx.measureText(p2NpText).width;
    drawVectorStar(ctx, 36 + p2NpW, 572, 5, 4.5, 2.2, '#fde047');
    ctx.fillStyle = '#fde047';
    ctx.fillText('[MAX READY]', 44 + p2NpW, 576);
  }

  // 6. P2 HP Bar (y: 586, 22px height)
  const p2HpRatio = Math.max(0, Math.min(1, p2.currentHp / p2.maxHp));
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 16, 586, 424, 22, 4);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.2;
  drawRoundRect(ctx, 16, 586, 424, 22, 4);
  ctx.stroke();

  if (p2HpRatio > 0) {
    const hpGrad = ctx.createLinearGradient(16, 586, 16, 608);
    if (p2HpRatio > 0.35) {
      hpGrad.addColorStop(0, '#22c55e');
      hpGrad.addColorStop(1, '#15803d');
    } else {
      hpGrad.addColorStop(0, '#ef4444');
      hpGrad.addColorStop(1, '#b91c1c');
    }
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
  ctx.fillText(`HP  ${p2.currentHp.toLocaleString()} / ${p2.maxHp.toLocaleString()} (${Math.round(p2HpRatio * 100)}%)`, 26, 602);
}

/**
 * 4. 10-Pull Gacha Summon Strip (900x420)
 */
export function renderGachaSummonBanner(
  canvas: HTMLCanvasElement,
  results: GachaResultItem[],
  bannerTitle: string
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = 900;
  canvas.height = 420;

  // Mystic Summoning Circle Background
  const bg = ctx.createRadialGradient(450, 210, 50, 450, 210, 450);
  bg.addColorStop(0, '#1e1b4b');
  bg.addColorStop(0.7, '#090d16');
  bg.addColorStop(1, '#020617');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 900, 420);

  // Title Banner
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`✦ SUMMONING COMPLETE: ${bannerTitle} ✦`, 450, 35);

  // Draw up to 10 cards in 2 rows of 5
  const cardW = 150;
  const cardH = 160;
  const startX = 45;
  const startY = 60;
  const gapX = 22;
  const gapY = 20;

  results.slice(0, 10).forEach((item, idx) => {
    const row = Math.floor(idx / 5);
    const col = idx % 5;
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);

    // Card background
    ctx.fillStyle = item.rarity === 5 ? '#311042' : item.rarity === 4 ? '#172554' : '#1e293b';
    drawRoundRect(ctx, x, y, cardW, cardH, 8);
    ctx.fill();

    // Rarity Border
    ctx.strokeStyle = item.rarity === 5 ? '#f59e0b' : item.rarity === 4 ? '#a855f7' : '#64748b';
    ctx.lineWidth = item.rarity >= 4 ? 2.5 : 1;
    ctx.stroke();

    // Item Type Header
    ctx.fillStyle = item.type === 'servant' ? '#38bdf8' : '#34d399';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(item.type === 'servant' ? 'SERVANT' : 'CRAFT ESSENCE', x + cardW / 2, y + 20);

    // Star Rating
    ctx.fillStyle = '#fbbf24';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('★'.repeat(item.rarity), x + cardW / 2, y + 36);

    // Item Name (Wrapped)
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px system-ui, sans-serif';
    const name = item.item.name;
    if (name.length > 16) {
      ctx.fillText(name.substring(0, 15) + '...', x + cardW / 2, y + 90);
    } else {
      ctx.fillText(name, x + cardW / 2, y + 90);
    }

    // New Badge
    if (item.isNew) {
      ctx.fillStyle = '#ef4444';
      drawRoundRect(ctx, x + 6, y + 6, 34, 16, 4);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.fillText('NEW', x + 23, y + 17);
    }
  });
}
