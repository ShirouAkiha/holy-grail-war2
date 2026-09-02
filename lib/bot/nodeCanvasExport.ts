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
 * 1. Render Servant Profile Status Card (680x760 Box Buffer)
 */
export async function renderServantProfileCard(
  servant: MasterServantInstance | any,
  masterName: string
): Promise<Buffer> {
  const canvas = createCanvas(680, 760);
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

  const totalHp = Math.round((t.baseHp || 28000) * (1 + (lvl - 1) * 0.05) + totalEnd * 150 + ceBonusHp);
  const totalAtk = Math.round((t.baseAtk || 10000) * (1 + (lvl - 1) * 0.05) + totalStr * 80 + ceBonusAtk);

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 760);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(0.3, '#0b0f19');
  bgGrad.addColorStop(0.7, '#080c14');
  bgGrad.addColorStop(1, '#020617');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 680, 760);

  // Outer Border
  const borderColor = t.rarity === 5 ? '#f59e0b' : '#38bdf8';
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2.5;
  drawRoundRect(ctx, 10, 10, 660, 740, 14);
  ctx.stroke();

  // Top Header Line
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(servant.nickname || t.name || 'Heroic Spirit', 26, 40);

  // Title & Master
  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px sans-serif';
  ctx.fillText((t.title || 'Heroic Spirit') + ' • Master: ' + masterName, 26, 60);

  // Class Badge & Stars on Right
  ctx.textAlign = 'right';
  ctx.fillStyle = t.rarity === 5 ? '#fbbf24' : '#38bdf8';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText((t.servantClass || 'SABER').toUpperCase(), 654, 40);

  ctx.fillStyle = '#fbbf24';
  ctx.font = '16px sans-serif';
  ctx.fillText('★'.repeat(t.rarity || 5), 654, 60);

  // Divider Line
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(26, 72);
  ctx.lineTo(654, 72);
  ctx.stroke();

  // Stats Sub-Header Line (Level, Bond, Stat points)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('Lv. ' + lvl + '/100', 26, 90);

  ctx.fillStyle = '#ec4899';
  ctx.fillText('Bond Lv. ' + (servant.bondLevel || 1) + ' ♥', 125, 90);

  ctx.fillStyle = '#f59e0b';
  ctx.fillText('Available Stat Points: ' + (servant.availableStatPoints || 0) + ' pts', 245, 90);

  // --- TOP-LEFT SECTION: HP/ATK + PARAMETERS + COMMAND DECK ---
  // HP Badge
  ctx.fillStyle = '#111827';
  drawRoundRect(ctx, 26, 104, 180, 48, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(74, 222, 128, 0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('MAX HP', 38, 122);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(totalHp.toLocaleString(), 38, 142);

  // ATK Badge
  ctx.fillStyle = '#111827';
  drawRoundRect(ctx, 214, 104, 182, 48, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(248, 113, 113, 0.25)';
  ctx.stroke();

  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('TOTAL ATK', 226, 122);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(totalAtk.toLocaleString(), 226, 142);

  // Base Parameters
  ctx.fillStyle = '#111827';
  drawRoundRect(ctx, 26, 160, 370, 60, 8);
  ctx.fill();
  ctx.strokeStyle = '#1e293b';
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('BASE PARAMETERS', 36, 175);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('STR: ' + totalStr + '   END: ' + totalEnd + '   AGI: ' + totalAgi, 36, 194);
  ctx.fillText('MNA: ' + totalMna + '   LCK: ' + totalLck, 36, 210);

  // Command Deck
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('COMMAND DECK', 26, 238);

  const commandDeck: CardType[] = t.commandDeck || ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'];
  commandDeck.forEach((card: CardType, idx: number) => {
    const cardX = 26 + idx * 74;
    const cardY = 246;
    ctx.fillStyle = card === 'Buster' ? '#dc2626' : card === 'Arts' ? '#2563eb' : '#16a34a';
    drawRoundRect(ctx, cardX, cardY, 68, 24, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(card, cardX + 34, cardY + 16);
  });

  // --- TOP-RIGHT SECTION: PARAMETER RADAR CHART ---
  const combinedStats = {
    strength: totalStr,
    endurance: totalEnd,
    agility: totalAgi,
    mana: totalMna,
    luck: totalLck
  };
  const radar = calculateRadarCoordinates(combinedStats, 535, 190, 52, 30);

  // Grid background lines
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  [0.35, 0.7, 1.0].forEach((ratio) => {
    ctx.beginPath();
    const rGrid = calculateRadarCoordinates(
      { strength: 30 * ratio, endurance: 30 * ratio, agility: 30 * ratio, mana: 30 * ratio, luck: 30 * ratio },
      535, 190, 52 * ratio, 30
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
  ctx.fillText('STR', 535, 126);
  ctx.fillText('END', 605, 160);
  ctx.fillText('AGI', 578, 258);
  ctx.fillText('MNA', 492, 258);
  ctx.fillText('LCK', 465, 160);

  // --- MIDDLE SECTION: HEROIC SPIRIT SKILLS (ACTIVE & PASSIVE) ---
  ctx.textAlign = 'left';
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('⚡ HEROIC SPIRIT SKILLS (ACTIVE & PASSIVE)', 26, 296);

  const defaultSkills = [
    { id: 'sk1', name: 'Mana Burst A', cooldown: 5, description: 'Increases own card effectiveness and combat prowess for 1 turn.', icon: '⚔️' },
    { id: 'sk2', name: 'Charisma B', cooldown: 5, description: 'Increases team attack power and morale for 3 turns.', icon: '👑' },
    { id: 'sk3', name: 'Instinct EX', cooldown: 6, description: 'Grants evasive instincts, gain critical stars and charge NP.', icon: '✨' }
  ];
  const skillsList = (t.skills && t.skills.length > 0) ? t.skills : defaultSkills;

  skillsList.slice(0, 3).forEach((sk: any, idx: number) => {
    const skY = 306 + idx * 68;

    // Skill Card Container
    ctx.fillStyle = '#0f172a';
    drawRoundRect(ctx, 26, skY, 628, 62, 8);
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Skill Header: Icon + Name
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText((sk.icon || '✨') + ' ' + sk.name, 38, skY + 22);

    // Cooldown badge on right
    ctx.textAlign = 'right';
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('CD: ' + (sk.cooldown || 5) + 'T', 642, skY + 22);

    // Skill Description
    ctx.textAlign = 'left';
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '11px sans-serif';
    drawWrappedText(ctx, sk.description || 'Special Heroic Spirit combat skill.', 38, skY + 40, 604, 15, 2);
  });

  // --- BOTTOM SECTION: NOBLE PHANTASM & CRAFT ESSENCE ---
  // Noble Phantasm Banner
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 26, 518, 628, 102, 8);
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1;
  ctx.stroke();

  const np = t.noblePhantasm || { name: 'Excalibur', cardType: 'Buster', chant: '...', description: '' };
  const npCardEmoji = np.cardType === 'Arts' ? '🔵' : np.cardType === 'Quick' ? '🟢' : '🔴';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('Noble Phantasm: ' + np.name + ' [' + npCardEmoji + ' ' + np.cardType + ']', 38, 540);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'italic 11px sans-serif';
  const chant = servant.customQuotes?.noblePhantasm || np.chant || '...';
  drawWrappedText(ctx, '"' + chant + '"', 38, 558, 604, 14, 2);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  const npDesc = np.description ? np.description : 'Deals massive damage to opponent.';
  drawWrappedText(ctx, npDesc, 38, 594, 604, 14, 2);

  // Craft Essence Banner
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 26, 628, 628, 110, 8);
  ctx.fill();
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#60a5fa';
  ctx.font = 'bold 12px sans-serif';
  const ceName = servant.equippedCe ? servant.equippedCe.name : 'None';
  const ceStatBonus = servant.equippedCe ? ' (+' + ceBonusAtk + ' ATK / +' + ceBonusHp + ' HP)' : '';
  ctx.fillText('Equipped CE: ' + ceName + ceStatBonus, 38, 650);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '11px sans-serif';
  const ceEffect = servant.equippedCe ? servant.equippedCe.effectText : 'No Craft Essence equipped. Use /customise equip to link a sacred relic.';
  drawWrappedText(ctx, ceEffect, 38, 672, 604, 15, 3);

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

  // Top Section: P1 (Avatar Box 120x208)
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 18, 18, 120, 208, 8);
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  drawRoundRect(ctx, 18, 18, 120, 208, 8);
  ctx.stroke();
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 38px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(p1.servantClass?.[0] || 'S', 78, 110);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText((p1.name || 'Servant').slice(0, 12), 78, 150);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(p1.masterName || 'Master 1', 148, 38);

  const p1NameWidth = ctx.measureText(p1.masterName || 'Master 1').width;
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(\`• \${p1.name} [\${p1.servantClass}]\`, 158 + p1NameWidth, 38);

  const p1HpRatio = Math.max(0, Math.min(1, p1.currentHp / p1.maxHp));
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 148, 48, 474, 26, 5);
  ctx.fill();
  ctx.fillStyle = p1HpRatio > 0.35 ? '#22c55e' : '#ef4444';
  if (p1HpRatio > 0) {
    drawRoundRect(ctx, 148, 48, Math.max(8, 474 * p1HpRatio), 26, 5);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(\`HP  \${p1.currentHp.toLocaleString()} / \${p1.maxHp.toLocaleString()} (\${Math.round(p1HpRatio * 100)}%)\`, 160, 65);

  // NP Bar
  const p1NpRatio = Math.max(0, Math.min(1, (p1.npGauge || 0) / 100));
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 148, 80, 356, 24, 5);
  ctx.fill();
  if (p1NpRatio > 0) {
    ctx.fillStyle = (p1.npGauge || 0) >= 100 ? '#f59e0b' : '#eab308';
    drawRoundRect(ctx, 148, 80, Math.max(8, 356 * p1NpRatio), 24, 5);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(\`NP: \${Math.round(p1.npGauge || 0)}% \${(p1.npGauge || 0) >= 100 ? '★ NP READY' : ''}\`, 160, 94);

  // Command Cards Top
  const p1Cards = log.p1Cards || ['Buster', 'Arts', 'Quick'];
  p1Cards.slice(0, 3).forEach((card: string, idx: number) => {
    const cardX = 148 + idx * 96;
    const cardColor = card === 'Buster' ? '#dc2626' : card === 'Arts' ? '#2563eb' : '#16a34a';
    ctx.fillStyle = '#0f172a';
    drawRoundRect(ctx, cardX, 110, 90, 116, 6);
    ctx.fill();
    ctx.strokeStyle = cardColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = cardColor;
    drawRoundRect(ctx, cardX + 2, 112, 86, 22, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(card.toUpperCase(), cardX + 45, 127);
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(card === 'Buster' ? 'B' : card === 'Arts' ? 'A' : 'Q', cardX + 45, 168);
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(card === 'Buster' ? '+50% ATK' : card === 'Arts' ? '+35% NP' : '+20 STAR', cardX + 45, 210);
  });

  // P1 Stars Pill
  ctx.fillStyle = 'rgba(56, 189, 248, 0.1)';
  drawRoundRect(ctx, 444, 110, 178, 116, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CRIT STARS', 533, 136);

  drawVectorStar(ctx, 492, 175, 5, 13, 6, '#38bdf8');
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(\`\${p1.critStars || 0}\`, 518, 166);

  // Middle Clash Box
  ctx.fillStyle = '#030712';
  drawRoundRect(ctx, 18, 236, 604, 200, 10);
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 30, 246, 580, 28, 5);
  ctx.fill();
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(\`★ HOLY GRAIL WAR • TURN \${log.turnNumber} CLASH RESOLUTION ★\`, 320, 229);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(log.actionSummary || '', 320, 285);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(\`★ \${p1.masterName || 'P1'} Stars: \${p1.critStars || 0}   |   ★ \${p2.masterName || 'P2'} Stars: \${p2.critStars || 0}\`, 320, 449);

  // Bottom Section: P2 Stars Pill (116px height)
  ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
  drawRoundRect(ctx, 18, 448, 178, 116, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CRIT STARS', 107, 472);

  drawVectorStar(ctx, 68, 513, 5, 13, 6, '#f87171');
  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(\`\${p2.critStars || 0}\`, 92, 554);

  // Bottom Section: P2 Cards (116px height)
  const p2Cards = log.p2Cards || ['Arts', 'Buster', 'Quick'];
  p2Cards.slice(0, 3).forEach((card: string, idx: number) => {
    const cardX = 202 + idx * 96;
    const cardColor = card === 'Buster' ? '#dc2626' : card === 'Arts' ? '#2563eb' : '#16a34a';
    ctx.fillStyle = '#0f172a';
    drawRoundRect(ctx, cardX, 448, 90, 116, 6);
    ctx.fill();
    ctx.strokeStyle = cardColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = cardColor;
    drawRoundRect(ctx, cardX + 2, 450, 86, 22, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(card.toUpperCase(), cardX + 45, 465);
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(card === 'Buster' ? 'B' : card === 'Arts' ? 'A' : 'Q', cardX + 45, 506);
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(card === 'Buster' ? '+50% ATK' : card === 'Arts' ? '+35% NP' : '+20 STAR', cardX + 45, 548);
  });

  const p2HpRatio = Math.max(0, Math.min(1, p2.currentHp / p2.maxHp));
  const p2NpRatio = Math.max(0, Math.min(1, (p2.npGauge || 0) / 100));

  // P2 NP Bar
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 148, 574, 344, 24, 5);
  ctx.fill();
  if (p2NpRatio > 0) {
    ctx.fillStyle = (p2.npGauge || 0) >= 100 ? '#f59e0b' : '#eab308';
    drawRoundRect(ctx, 148, 574, Math.max(8, 344 * p2NpRatio), 24, 5);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(\`NP: \${Math.round(p2.npGauge || 0)}% \${(p2.npGauge || 0) >= 100 ? '★ NP READY' : ''}\`, 160, 600);

  // P2 HP Bar
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 18, 606, 474, 26, 5);
  ctx.fill();
  ctx.fillStyle = p2HpRatio > 0.35 ? '#22c55e' : '#ef4444';
  if (p2HpRatio > 0) {
    drawRoundRect(ctx, 18, 606, Math.max(8, 474 * p2HpRatio), 26, 5);
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

  // P2 Avatar Box (Right, 120x226)
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 502, 448, 120, 226, 8);
  ctx.fill();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2.5;
  drawRoundRect(ctx, 502, 448, 120, 226, 8);
  ctx.stroke();
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 38px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(p2.servantClass?.[0] || 'E', 562, 540);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText((p2.name || 'Servant').slice(0, 12), 562, 580);

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
