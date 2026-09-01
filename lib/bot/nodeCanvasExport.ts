/**
 * Node.js Canvas Compositor for Discord Bot v14
 * Library: @napi-rs/canvas
 * Purpose: Server-side dynamic 2D image rendering for Discord attachments
 */

export const nodeCanvasRendererCode = `import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { 
  CombatTurnLog, 
  GachaResultItem, 
  HolyGrailWarSession, 
  MasterServantInstance, 
  ActiveCombatant 
} from '../types';
import { calculateRadarCoordinates } from '../engine/customization';

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
    sw = img.height * targetRatio;
    sx = (img.width - sw) / 2;
  } else {
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
  ctx.fillText((t.title || 'Heroic Spirit') + ' • Master: ' + masterName, 32, 64);

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
  ctx.fillText('Lv. ' + lvl + '/100', 32, 96);

  ctx.fillStyle = '#ec4899';
  ctx.fillText('Bond Lv. ' + (servant.bondLevel || 1) + ' ♥', 140, 96);

  ctx.fillStyle = '#f59e0b';
  ctx.fillText('Available Stat Points: ' + (servant.availableStatPoints || 0) + ' pts', 270, 96);

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
  ctx.fillText('STR: ' + totalStr + '    END: ' + totalEnd + '    AGI: ' + totalAgi, 32, 193);
  ctx.fillText('MNA: ' + totalMna + '    LCK: ' + totalLck, 32, 212);

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
  ctx.fillText('Equipped CE: ' + (servant.equippedCe ? servant.equippedCe.name : 'None'), 44, 289);

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
  ctx.fillText('Noble Phantasm: ' + np.name + ' [' + npCardEmoji + ' ' + np.cardType + ']', 44, 340);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'italic 11px sans-serif';
  const chant = servant.customQuotes?.noblePhantasm || np.chant || '...';
  ctx.fillText('"' + chant.slice(0, 110) + (chant.length > 110 ? '...' : '') + '"', 44, 358);

  return canvas.toBuffer('image/png');
}

/**
 * 2. Render Dialogue Card (800x240 Buffer)
 */
export async function renderDialogueCard(
  speakerName: string,
  quoteText: string,
  title: string = 'Heroic Spirit',
  servantClass: string = 'Saber'
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
  drawRoundRect(ctx, 195, 30, 320, 36, 6);
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(speakerName, 210, 54);

  // Quote Box
  ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
  drawRoundRect(ctx, 195, 76, 575, 135, 8);
  ctx.fill();

  ctx.fillStyle = '#f1f5f9';
  ctx.font = 'italic 16px sans-serif';
  ctx.fillText(\`"\${quoteText}"\`, 215, 120);

  return canvas.toBuffer('image/png');
}

/**
 * 3. Render Battle Turn Summary (640x700 Fate Wireframe Layout)
 */
export async function renderBattleTurnSummary(
  log: CombatTurnLog,
  p1: ActiveCombatant,
  p2: ActiveCombatant
): Promise<Buffer> {
  const canvas = createCanvas(640, 700);
  const ctx = canvas.getContext('2d');

  const bgGrad = ctx.createLinearGradient(0, 0, 640, 700);
  bgGrad.addColorStop(0, '#090d19');
  bgGrad.addColorStop(0.5, '#04060e');
  bgGrad.addColorStop(1, '#11071d');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 640, 700);

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  drawRoundRect(ctx, 8, 8, 624, 684, 14);
  ctx.stroke();

  // Top Section: P1 (Avatar Box 115x165)
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 20, 20, 115, 165, 8);
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  drawRoundRect(ctx, 20, 20, 115, 165, 8);
  ctx.stroke();
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(p1.servantClass?.[0] || 'S', 77, 95);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText((p1.name || 'Servant').slice(0, 12), 77, 130);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(p1.masterName || 'Master 1', 150, 38);

  const p1NameWidth = ctx.measureText(p1.masterName || 'Master 1').width;
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(\`• \${p1.name} [\${p1.servantClass}]\`, 158 + p1NameWidth, 38);

  const p1HpRatio = Math.max(0, Math.min(1, p1.currentHp / p1.maxHp));
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 150, 48, 472, 24, 5);
  ctx.fill();
  ctx.fillStyle = p1HpRatio > 0.35 ? '#22c55e' : '#ef4444';
  if (p1HpRatio > 0) {
    drawRoundRect(ctx, 150, 48, Math.max(8, 472 * p1HpRatio), 24, 5);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(\`HP  \${p1.currentHp.toLocaleString()} / \${p1.maxHp.toLocaleString()} (\${Math.round(p1HpRatio * 100)}%)\`, 160, 65);

  // NP Bar
  const p1NpRatio = Math.max(0, Math.min(1, (p1.npGauge || 0) / 100));
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 150, 78, 350, 22, 5);
  ctx.fill();
  if (p1NpRatio > 0) {
    ctx.fillStyle = (p1.npGauge || 0) >= 100 ? '#f59e0b' : '#eab308';
    drawRoundRect(ctx, 150, 78, Math.max(8, 350 * p1NpRatio), 22, 5);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(\`NP: \${Math.round(p1.npGauge || 0)}% \${(p1.npGauge || 0) >= 100 ? '★ NP READY' : ''}\`, 160, 94);

  // Command Cards Top
  const p1Cards = log.p1Cards || ['Buster', 'Arts', 'Quick'];
  p1Cards.slice(0, 3).forEach((card: string, idx: number) => {
    const cardX = 150 + idx * 96;
    const cardColor = card === 'Buster' ? '#dc2626' : card === 'Arts' ? '#2563eb' : '#16a34a';
    ctx.fillStyle = '#0f172a';
    drawRoundRect(ctx, cardX, 106, 90, 80, 6);
    ctx.fill();
    ctx.strokeStyle = cardColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = cardColor;
    drawRoundRect(ctx, cardX + 2, 108, 86, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(card.toUpperCase(), cardX + 45, 122);
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(card === 'Buster' ? 'B' : card === 'Arts' ? 'A' : 'Q', cardX + 45, 156);
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(card === 'Buster' ? '+50% ATK' : card === 'Arts' ? '+35% NP' : '+20 STAR', cardX + 45, 178);
  });

  // P1 Stars Pill
  ctx.fillStyle = 'rgba(56, 189, 248, 0.1)';
  drawRoundRect(ctx, 444, 106, 178, 80, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CRIT STARS', 533, 128);

  drawVectorStar(ctx, 498, 156, 5, 11, 5, '#38bdf8');
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(\`\${p1.critStars || 0}\`, 518, 166);

  // Middle Clash Box
  ctx.fillStyle = '#030712';
  drawRoundRect(ctx, 18, 198, 604, 284, 10);
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 30, 208, 580, 30, 6);
  ctx.fill();
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(\`★ HOLY GRAIL WAR • TURN \${log.turnNumber} CLASH RESOLUTION ★\`, 320, 229);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(log.actionSummary || '', 320, 285);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(\`★ \${p1.masterName || 'P1'} Stars: \${p1.critStars || 0}   |   ★ \${p2.masterName || 'P2'} Stars: \${p2.critStars || 0}\`, 320, 449);

  // Bottom Section: P2 Stars Pill
  ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
  drawRoundRect(ctx, 18, 494, 178, 80, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CRIT STARS', 107, 516);

  drawVectorStar(ctx, 72, 544, 5, 11, 5, '#f87171');
  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(\`\${p2.critStars || 0}\`, 92, 554);

  // Bottom Section: P2 Cards
  const p2Cards = log.p2Cards || ['Arts', 'Buster', 'Quick'];
  p2Cards.slice(0, 3).forEach((card: string, idx: number) => {
    const cardX = 202 + idx * 96;
    const cardColor = card === 'Buster' ? '#dc2626' : card === 'Arts' ? '#2563eb' : '#16a34a';
    ctx.fillStyle = '#0f172a';
    drawRoundRect(ctx, cardX, 494, 90, 80, 6);
    ctx.fill();
    ctx.strokeStyle = cardColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = cardColor;
    drawRoundRect(ctx, cardX + 2, 496, 86, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(card.toUpperCase(), cardX + 45, 510);
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(card === 'Buster' ? 'B' : card === 'Arts' ? 'A' : 'Q', cardX + 45, 544);
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(card === 'Buster' ? '+50% ATK' : card === 'Arts' ? '+35% NP' : '+20 STAR', cardX + 45, 566);
  });

  const p2HpRatio = Math.max(0, Math.min(1, p2.currentHp / p2.maxHp));
  const p2NpRatio = Math.max(0, Math.min(1, (p2.npGauge || 0) / 100));

  // P2 NP Bar
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 150, 584, 342, 22, 5);
  ctx.fill();
  if (p2NpRatio > 0) {
    ctx.fillStyle = (p2.npGauge || 0) >= 100 ? '#f59e0b' : '#eab308';
    drawRoundRect(ctx, 150, 584, Math.max(8, 342 * p2NpRatio), 22, 5);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(\`NP: \${Math.round(p2.npGauge || 0)}% \${(p2.npGauge || 0) >= 100 ? '★ NP READY' : ''}\`, 160, 600);

  // P2 HP Bar
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 18, 612, 474, 24, 5);
  ctx.fill();
  ctx.fillStyle = p2HpRatio > 0.35 ? '#22c55e' : '#ef4444';
  if (p2HpRatio > 0) {
    drawRoundRect(ctx, 18, 612, Math.max(8, 474 * p2HpRatio), 24, 5);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(\`HP  \${p2.currentHp.toLocaleString()} / \${p2.maxHp.toLocaleString()} (\${Math.round(p2HpRatio * 100)}%)\`, 28, 629);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(p2.masterName || 'Master 2', 492, 658);

  const p2NameWidth = ctx.measureText(p2.masterName || 'Master 2').width;
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(\`[\${p2.servantClass}] \${p2.name} • \`, 492 - p2NameWidth, 658);

  // P2 Avatar Box
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 505, 494, 115, 168, 8);
  ctx.fill();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2.5;
  drawRoundRect(ctx, 505, 494, 115, 168, 8);
  ctx.stroke();
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(p2.servantClass?.[0] || 'E', 562, 575);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText((p2.name || 'Servant').slice(0, 12), 562, 610);

  return canvas.toBuffer('image/png');
}

/**
 * 4. Render Gacha Summon Banner (900x420 Buffer)
 */
export async function renderGachaSummonBanner(
  results: GachaResultItem[],
  bannerTitle: string
): Promise<Buffer> {
  const canvas = createCanvas(900, 420);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, 900, 420);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(\`✦ SUMMONING: \${bannerTitle} ✦\`, 450, 35);

  return canvas.toBuffer('image/png');
}
`;
