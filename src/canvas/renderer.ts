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
 * 1. Render Servant Profile Status Card (800x460 Buffer)
 */
export async function renderServantProfileCard(
  servant: MasterServantInstance | any,
  masterName: string
): Promise<Buffer> {
  const canvas = createCanvas(800, 460);
  const ctx = canvas.getContext('2d');

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, 800, 460);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(0.5, '#090d16');
  bgGrad.addColorStop(1, '#020617');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 800, 460);

  // Border
  ctx.strokeStyle = servant.template?.rarity === 5 ? '#f59e0b' : '#38bdf8';
  ctx.lineWidth = 3;
  drawRoundRect(ctx, 12, 12, 776, 436, 16);
  ctx.stroke();

  // Left Avatar Frame Container
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 30, 30, 220, 340, 12);
  ctx.fill();

  const imageUrl = servant.template?.cardArtUrl || servant.template?.avatarUrl;
  if (imageUrl) {
    try {
      const img = await loadImage(imageUrl);
      if (img) {
        ctx.save();
        drawRoundRect(ctx, 34, 34, 212, 280, 8);
        ctx.clip();
        drawImageCover(ctx, img, 34, 34, 212, 280);
        ctx.restore();
      }
    } catch {
      // Fallback
    }
  }

  // Star Rating & Class
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText((servant.template?.servantClass || 'SABER').toUpperCase(), 140, 335);

  ctx.fillStyle = '#fbbf24';
  ctx.font = '18px sans-serif';
  ctx.fillText('★'.repeat(servant.template?.rarity || 5), 140, 355);

  // Servant Name & Details
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(servant.nickname || servant.template?.name || 'Heroic Spirit', 280, 65);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px sans-serif';
  ctx.fillText(`${servant.template?.title || 'Heroic Spirit'} • Master: ${masterName}`, 280, 92);

  // Level & Bond
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`Lv. ${servant.level || 1} / 100`, 280, 125);
  ctx.fillStyle = '#ec4899';
  ctx.fillText(`Bond Lv. ${servant.bondLevel || 1} ♥`, 420, 125);

  // HP & ATK badges
  const totalStr = (servant.template?.baseStats?.strength || 10) + (servant.allocatedStats?.strength || 0);
  const totalEnd = (servant.template?.baseStats?.endurance || 10) + (servant.allocatedStats?.endurance || 0);
  const maxHp = Math.round((servant.template?.baseHp || 12000) * (1 + ((servant.level || 1) - 1) * 0.05) + totalEnd * 150);
  const rawAtk = Math.round((servant.template?.baseAtk || 10000) * (1 + ((servant.level || 1) - 1) * 0.05) + totalStr * 80);

  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 280, 145, 140, 48, 8);
  ctx.fill();
  ctx.fillStyle = '#4ade80';
  ctx.font = '12px sans-serif';
  ctx.fillText('MAX HP', 292, 165);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(maxHp.toLocaleString(), 292, 185);

  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 435, 145, 140, 48, 8);
  ctx.fill();
  ctx.fillStyle = '#f87171';
  ctx.font = '12px sans-serif';
  ctx.fillText('BASE ATK', 447, 165);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(rawAtk.toLocaleString(), 447, 185);

  // Radar chart on right
  const combinedStats = {
    strength: totalStr,
    endurance: totalEnd,
    agility: (servant.template?.baseStats?.agility || 10) + (servant.allocatedStats?.agility || 0),
    mana: (servant.template?.baseStats?.mana || 10) + (servant.allocatedStats?.mana || 0),
    luck: (servant.template?.baseStats?.luck || 10) + (servant.allocatedStats?.luck || 0)
  };
  const radar = calculateRadarCoordinates(combinedStats, 670, 155, 60, 30);

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

  // Command Deck
  ctx.textAlign = 'left';
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('COMMAND DECK', 280, 222);

  const commandDeck: CardType[] = servant.template?.commandDeck || ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'];
  commandDeck.forEach((card: CardType, idx: number) => {
    const cardX = 280 + idx * 58;
    const cardY = 232;
    ctx.fillStyle = card === 'Buster' ? '#dc2626' : card === 'Arts' ? '#2563eb' : '#16a34a';
    drawRoundRect(ctx, cardX, cardY, 50, 26, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(card[0], cardX + 25, cardY + 18);
  });

  // Noble Phantasm Section
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 280, 275, 490, 80, 8);
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`Noble Phantasm: ${servant.template?.noblePhantasm?.name || 'Excalibur'}`, 295, 300);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px sans-serif';
  const chant = servant.customQuotes?.noblePhantasm || servant.template?.noblePhantasm?.chant || '...';
  ctx.fillText(`"${chant.slice(0, 65)}${chant.length > 65 ? '...' : ''}"`, 295, 322);

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
 * 3. Render Battle Turn Summary (800x380 Buffer)
 */
export async function renderBattleTurnSummary(
  log: CombatTurnLog,
  p1: ActiveCombatant,
  p2: ActiveCombatant
): Promise<Buffer> {
  const canvas = createCanvas(800, 380);
  const ctx = canvas.getContext('2d');

  const bgGrad = ctx.createLinearGradient(0, 0, 800, 380);
  bgGrad.addColorStop(0, '#1e1b4b');
  bgGrad.addColorStop(1, '#3b0764');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 800, 380);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`HOLY GRAIL WAR • TURN ${log.turnNumber} CLASH`, 400, 35);

  // Combatant 1
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 30, 55, 340, 240, 10);
  ctx.fill();
  ctx.fillStyle = '#60a5fa';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(p1.name, 45, 85);

  // Combatant 2
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 430, 55, 340, 240, 10);
  ctx.fill();
  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(p2.name, 445, 85);

  // Bottom action bar
  ctx.fillStyle = '#020617';
  drawRoundRect(ctx, 30, 305, 740, 60, 8);
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(log.actionSummary, 400, 340);

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
