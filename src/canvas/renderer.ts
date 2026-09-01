import { 
  CombatTurnLog, 
  GachaResultItem, 
  HolyGrailWarSession, 
  MasterServantInstance, 
  ActiveCombatant,
  CardType
} from '../types';
import { calculateRadarCoordinates, RadarPoint } from '../engine/customization';

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

/**
 * 1. Render Servant Profile Status Card (900x520 Buffer)
 */
export async function renderServantProfileCard(
  servant: MasterServantInstance | any,
  masterName: string
): Promise<Buffer> {
  const canvas = createCanvas(850, 390);
  const ctx = canvas.getContext('2d');

  const t = servant.template || servant;
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

  const totalHp = Math.round((t.baseHp || 12000) * (1 + (lvl - 1) * 0.05) + totalEnd * 150 + ceBonusHp);
  const totalAtk = Math.round((t.baseAtk || 10000) * (1 + (lvl - 1) * 0.05) + totalStr * 80 + ceBonusAtk);

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, 850, 390);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(0.5, '#090d16');
  bgGrad.addColorStop(1, '#020617');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 850, 390);

  // Outer Border
  const borderColor = t.rarity === 5 ? '#f59e0b' : '#38bdf8';
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 3;
  drawRoundRect(ctx, 10, 10, 830, 370, 14);
  ctx.stroke();

  // Top Header Line
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(servant.nickname || t.name || 'Heroic Spirit', 32, 44);

  // Title & Master
  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px sans-serif';
  ctx.fillText(`${t.title || 'Heroic Spirit'} • Master: ${masterName}`, 32, 64);

  // Class Badge & Stars on Right
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText((t.servantClass || 'SABER').toUpperCase(), 818, 44);

  ctx.fillStyle = '#fbbf24';
  ctx.font = '16px sans-serif';
  ctx.fillText('★'.repeat(t.rarity || 5), 818, 64);

  // Divider Line
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(32, 76);
  ctx.lineTo(818, 76);
  ctx.stroke();

  // Stats Sub-Header Line (Level, Bond, Stat points)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`Lv. ${lvl}/100`, 32, 96);

  ctx.fillStyle = '#ec4899';
  ctx.fillText(`Bond Lv. ${servant.bondLevel || 1} ♥`, 140, 96);

  ctx.fillStyle = '#f59e0b';
  ctx.fillText(`Available Stat Points: ${servant.availableStatPoints || 0} pts`, 270, 96);

  // --- LEFT SECTION: HP/ATK + PARAMETERS + COMMAND DECK ---
  // HP Badge
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 32, 108, 170, 48, 8);
  ctx.fill();
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('MAX HP', 44, 126);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(totalHp.toLocaleString(), 44, 146);

  // ATK Badge
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 214, 108, 170, 48, 8);
  ctx.fill();
  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('TOTAL ATK', 226, 126);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(totalAtk.toLocaleString(), 226, 146);

  // Base Parameters
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('BASE PARAMETERS', 32, 173);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '13px sans-serif';
  ctx.fillText(`STR: ${totalStr}    END: ${totalEnd}    AGI: ${totalAgi}`, 32, 193);
  ctx.fillText(`MNA: ${totalMna}    LCK: ${totalLck}`, 32, 212);

  // Command Deck
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('COMMAND DECK', 32, 233);

  const commandDeck: CardType[] = t.commandDeck || ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'];
  commandDeck.forEach((card: CardType, idx: number) => {
    const cardX = 32 + idx * 56;
    const cardY = 240;
    ctx.fillStyle = card === 'Buster' ? '#dc2626' : card === 'Arts' ? '#2563eb' : '#16a34a';
    drawRoundRect(ctx, cardX, cardY, 48, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(card[0], cardX + 24, cardY + 15);
  });

  // --- RIGHT SECTION: PARAMETER RADAR CHART ---
  const combinedStats = {
    strength: totalStr,
    endurance: totalEnd,
    agility: totalAgi,
    mana: totalMna,
    luck: totalLck
  };
  const radar = calculateRadarCoordinates(combinedStats, 640, 175, 55, 30);

  // Grid background lines
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  [0.35, 0.7, 1.0].forEach((ratio) => {
    ctx.beginPath();
    const rGrid = calculateRadarCoordinates(
      { strength: 30 * ratio, endurance: 30 * ratio, agility: 30 * ratio, mana: 30 * ratio, luck: 30 * ratio },
      640, 175, 55 * ratio, 30
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
  ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Radar Labels
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('STR', 640, 108);
  ctx.fillText('END', 715, 144);
  ctx.fillText('AGI', 685, 244);
  ctx.fillText('MNA', 595, 244);
  ctx.fillText('LCK', 565, 144);

  // --- BOTTOM SECTION: CRAFT ESSENCE & NOBLE PHANTASM ---
  // Craft Essence Banner
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 32, 272, 786, 42, 8);
  ctx.fill();
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#60a5fa';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(`Equipped CE: ${servant.equippedCe ? servant.equippedCe.name : 'None'}`, 44, 289);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  const ceEffect = servant.equippedCe ? servant.equippedCe.effectText : 'No Craft Essence equipped. Use /customise equip.';
  ctx.fillText(ceEffect.slice(0, 110) + (ceEffect.length > 110 ? '...' : ''), 44, 305);

  // Noble Phantasm Banner
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 32, 322, 786, 52, 8);
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1;
  ctx.stroke();

  const np = t.noblePhantasm || { name: 'Excalibur', cardType: 'Buster', chant: '...', description: '' };
  const npCardEmoji = np.cardType === 'Arts' ? '🔵' : np.cardType === 'Quick' ? '🟢' : '🔴';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`Noble Phantasm: ${np.name} [${npCardEmoji} ${np.cardType}]`, 44, 340);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'italic 11px sans-serif';
  const chant = servant.customQuotes?.noblePhantasm || np.chant || '...';
  ctx.fillText(`"${chant.slice(0, 110)}${chant.length > 110 ? '...' : ''}"`, 44, 358);

  try {
    return canvas.toBuffer('image/png');
  } catch {
    return MINIMAL_VALID_PNG;
  }
}

/**
 * 2. Render Dialogue Card (800x240 Buffer)
 */
export async function renderDialogueCard(
  speakerName: string,
  quoteText: string,
  _title: string = 'Heroic Spirit',
  _servantClass: string = 'Saber'
): Promise<Buffer> {
  const canvas = createCanvas(800, 240);
  const ctx = canvas.getContext('2d');

  const bgGrad = ctx.createLinearGradient(0, 0, 800, 240);
  bgGrad.addColorStop(0, '#0c1222');
  bgGrad.addColorStop(1, '#020617');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 800, 240);

  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 2;
  drawRoundRect(ctx, 8, 8, 784, 224, 12);
  ctx.stroke();

  // Nameplate
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 30, 30, 320, 36, 6);
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(speakerName, 45, 54);

  // Quote Box
  ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
  drawRoundRect(ctx, 30, 76, 740, 135, 8);
  ctx.fill();

  ctx.fillStyle = '#f1f5f9';
  ctx.font = 'italic 16px sans-serif';
  ctx.fillText(`"${quoteText}"`, 45, 120);

  try {
    return canvas.toBuffer('image/png');
  } catch {
    return MINIMAL_VALID_PNG;
  }
}

/**
 * 3. Render Battle Turn Summary (720x760 Buffer - Portrait Clash Layout matching Sketch)
 */
export async function renderBattleTurnSummary(
  log: CombatTurnLog,
  p1: ActiveCombatant,
  p2: ActiveCombatant
): Promise<Buffer> {
  const canvas = createCanvas(720, 760);
  const ctx = canvas.getContext('2d');

  // Load Avatars concurrently
  const p1Img = p1.avatarUrl ? await loadImage(p1.avatarUrl) : null;
  const p2Img = p2.avatarUrl ? await loadImage(p2.avatarUrl) : null;

  // Background - Deep Mystic War Canvas
  const bgGrad = ctx.createLinearGradient(0, 0, 720, 760);
  bgGrad.addColorStop(0, '#090d16');
  bgGrad.addColorStop(0.5, '#05070d');
  bgGrad.addColorStop(1, '#11071f');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 720, 760);

  // Outer Border with glowing accents
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  drawRoundRect(ctx, 10, 10, 700, 740, 16);
  ctx.stroke();

  // Grid / Rune background lines
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
  ctx.lineWidth = 1;
  for (let x = 30; x < 700; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 15);
    ctx.lineTo(x, 745);
    ctx.stroke();
  }
  for (let y = 30; y < 745; y += 40) {
    ctx.beginPath();
    ctx.moveTo(15, y);
    ctx.lineTo(705, y);
    ctx.stroke();
  }

  // ==========================================
  // TOP SECTION: PLAYER 1 MASTER & SERVANT
  // ==========================================
  const p1DisplayName = p1.masterName || 'Master 1';
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(p1DisplayName, 35, 38);

  const p1NameWidth = ctx.measureText(p1DisplayName).width;
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`• ${p1.name} [${p1.servantClass}]`, 45 + p1NameWidth, 38);

  // 1. P1 Avatar Box (Left, 160x160)
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 35, 52, 160, 160, 14);
  ctx.fill();

  if (p1Img) {
    ctx.save();
    drawRoundRect(ctx, 37, 54, 156, 156, 12);
    ctx.clip();
    drawImageCover(ctx, p1Img, 37, 54, 156, 156);
    ctx.restore();
  } else {
    ctx.fillStyle = '#1e293b';
    drawRoundRect(ctx, 37, 54, 156, 156, 12);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 46px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p1.servantClass[0] || 'S', 115, 138);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(p1.name.slice(0, 14), 115, 182);
  }

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  drawRoundRect(ctx, 35, 52, 160, 160, 14);
  ctx.stroke();

  // 2. P1 HP & NP Bars
  const p1HpRatio = Math.max(0, Math.min(1, p1.currentHp / p1.maxHp));
  const p1NpRatio = Math.max(0, Math.min(1, p1.npGauge / 100));

  // HP Label & Bar
  ctx.textAlign = 'left';
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('HP', 215, 74);

  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 245, 52, 440, 32, 6);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = p1HpRatio > 0.35 ? '#22c55e' : '#ef4444';
  if (p1HpRatio > 0) {
    drawRoundRect(ctx, 245, 52, Math.max(12, 440 * p1HpRatio), 32, 6);
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`${p1.currentHp.toLocaleString()} / ${p1.maxHp.toLocaleString()} (${Math.round(p1HpRatio * 100)}%)`, 258, 74);

  // NP Label & Bar
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('NP', 215, 111);

  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 245, 92, 330, 26, 6);
  ctx.fill();
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (p1NpRatio > 0) {
    ctx.fillStyle = p1.npGauge >= 100 ? '#f59e0b' : '#eab308';
    drawRoundRect(ctx, 245, 92, Math.max(12, 330 * p1NpRatio), 26, 6);
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`NP Gauge: ${Math.round(p1.npGauge)}% ${p1.npGauge >= 100 ? '✦ NP READY' : ''}`, 258, 110);

  // 3. P1 3 Command Cards
  const p1Cards: CardType[] = log.p1Cards || ['Buster', 'Arts', 'Arts'];
  p1Cards.slice(0, 3).forEach((card, idx) => {
    const cardX = 215 + idx * 152;
    const cardY = 128;
    const cardW = 144;
    const cardH = 84;

    const isBuster = card === 'Buster';
    const isArts = card === 'Arts';
    const cardColor = isBuster ? '#dc2626' : isArts ? '#2563eb' : '#16a34a';

    ctx.fillStyle = '#0f172a';
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, 8);
    ctx.fill();
    ctx.strokeStyle = cardColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = cardColor;
    drawRoundRect(ctx, cardX + 3, cardY + 3, cardW - 6, 24, 5);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(card.toUpperCase(), cardX + cardW / 2, cardY + 19);

    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(isBuster ? '💥' : isArts ? '🌀' : '⚡', cardX + cardW / 2, cardY + 54);

    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(isBuster ? '+50% ATK' : isArts ? '+35% NP' : '+20 Stars', cardX + cardW / 2, cardY + 74);
  });

  // ==========================================
  // MIDDLE SECTION: COMBAT LOG MARQUEE (LARGE & PROMINENT)
  // ==========================================
  ctx.fillStyle = '#020617';
  drawRoundRect(ctx, 35, 236, 650, 270, 14);
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Marquee Header
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 48, 248, 624, 34, 6);
  ctx.fill();

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`⚔️ HOLY GRAIL DUEL • TURN ${log.turnNumber} CLASH RESOLUTION ⚔️`, 360, 271);

  // Main Action Text (with multiline auto-wrap for maximum readability)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 21px sans-serif';
  const words = log.actionSummary.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > 600 && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  const startY = lines.length > 1 ? 320 : 335;
  lines.forEach((line, i) => {
    ctx.fillText(line, 360, startY + i * 28);
  });

  // Additional detail notes
  if (log.isCritical || log.isNoblePhantasm) {
    ctx.fillStyle = log.isNoblePhantasm ? '#facc15' : '#ef4444';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(
      log.isNoblePhantasm ? '✨ NOBLE PHANTASM UNLEASHED AT MAXIMUM OUTPUT! ✨' : '💥 CRITICAL STRIKE! DOUBLE DAMAGE DEALT!',
      360,
      415
    );
  } else {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('Command Seals pulse with etheric energy as weapons clash.', 360, 415);
  }

  // Damage / Stars footer banner
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`✨ ${p1.masterName || 'P1'} Stars: ${p1.critStars || 0}  |  ✨ ${p2.masterName || 'P2'} Stars: ${p2.critStars || 0}`, 360, 470);

  // ==========================================
  // BOTTOM SECTION: PLAYER 2 MASTER & SERVANT
  // ==========================================
  // 1. P2 3 Command Cards (Left)
  const p2Cards: CardType[] = log.p2Cards || ['Arts', 'Buster', 'Arts'];
  p2Cards.slice(0, 3).forEach((card, idx) => {
    const cardX = 35 + idx * 152;
    const cardY = 530;
    const cardW = 144;
    const cardH = 84;

    const isBuster = card === 'Buster';
    const isArts = card === 'Arts';
    const cardColor = isBuster ? '#dc2626' : isArts ? '#2563eb' : '#16a34a';

    ctx.fillStyle = '#0f172a';
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, 8);
    ctx.fill();
    ctx.strokeStyle = cardColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = cardColor;
    drawRoundRect(ctx, cardX + 3, cardY + 3, cardW - 6, 24, 5);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(card.toUpperCase(), cardX + cardW / 2, cardY + 19);

    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(isBuster ? '💥' : isArts ? '🌀' : '⚡', cardX + cardW / 2, cardY + 54);

    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(isBuster ? '+50% ATK' : isArts ? '+35% NP' : '+20 Stars', cardX + cardW / 2, cardY + 74);
  });

  // 2. P2 NP & HP Bars
  const p2HpRatio = Math.max(0, Math.min(1, p2.currentHp / p2.maxHp));
  const p2NpRatio = Math.max(0, Math.min(1, p2.npGauge / 100));

  // P2 NP
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('NP', 35, 642);

  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 65, 624, 330, 26, 6);
  ctx.fill();
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (p2NpRatio > 0) {
    ctx.fillStyle = p2.npGauge >= 100 ? '#f59e0b' : '#eab308';
    drawRoundRect(ctx, 65, 624, Math.max(12, 330 * p2NpRatio), 26, 6);
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`NP Gauge: ${Math.round(p2.npGauge)}% ${p2.npGauge >= 100 ? '✦ NP READY' : ''}`, 78, 642);

  // P2 HP
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('HP', 35, 683);

  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 65, 660, 440, 32, 6);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = p2HpRatio > 0.35 ? '#22c55e' : '#ef4444';
  if (p2HpRatio > 0) {
    drawRoundRect(ctx, 65, 660, Math.max(12, 440 * p2HpRatio), 32, 6);
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`${p2.currentHp.toLocaleString()} / ${p2.maxHp.toLocaleString()} (${Math.round(p2HpRatio * 100)}%)`, 78, 682);

  // 3. P2 Avatar Box (Right, 160x160)
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 525, 530, 160, 160, 14);
  ctx.fill();

  if (p2Img) {
    ctx.save();
    drawRoundRect(ctx, 527, 532, 156, 156, 12);
    ctx.clip();
    drawImageCover(ctx, p2Img, 527, 532, 156, 156);
    ctx.restore();
  } else {
    ctx.fillStyle = '#1e293b';
    drawRoundRect(ctx, 527, 532, 156, 156, 12);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 46px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p2.servantClass[0] || 'E', 605, 616);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(p2.name.slice(0, 14), 605, 660);
  }

  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 3;
  drawRoundRect(ctx, 525, 530, 160, 160, 14);
  ctx.stroke();

  // Bottom-Right Master Label
  const p2DisplayName = p2.masterName || 'Master 2';
  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(p2DisplayName, 685, 725);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`[${p2.servantClass}] ${p2.name} •`, 675 - ctx.measureText(p2DisplayName).width, 725);

  try {
    return canvas.toBuffer('image/png');
  } catch {
    return MINIMAL_VALID_PNG;
  }
}

/**
 * 4. Render Gacha Summon Banner (900x420 Buffer)
 */
export async function renderGachaSummonBanner(
  _results: GachaResultItem[],
  bannerTitle: string
): Promise<Buffer> {
  const canvas = createCanvas(900, 420);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, 900, 420);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`✦ SUMMONING: ${bannerTitle} ✦`, 450, 35);

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
