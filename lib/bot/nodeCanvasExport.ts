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
  const canvas = createCanvas(900, 520);
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
  const bgGrad = ctx.createLinearGradient(0, 0, 900, 520);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(0.5, '#090d16');
  bgGrad.addColorStop(1, '#020617');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 900, 520);

  // Border
  ctx.strokeStyle = t.rarity === 5 ? '#f59e0b' : '#38bdf8';
  ctx.lineWidth = 3;
  drawRoundRect(ctx, 12, 12, 876, 496, 16);
  ctx.stroke();

  // Left Avatar Frame Container (310x464 Big Portrait)
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 28, 28, 310, 464, 14);
  ctx.fill();

  const imageUrl = t.cardArtUrl || t.avatarUrl;
  if (imageUrl) {
    try {
      const img = await loadImage(imageUrl);
      if (img) {
        ctx.save();
        drawRoundRect(ctx, 28, 28, 310, 464, 14);
        ctx.clip();
        drawImageCover(ctx, img, 28, 28, 310, 464);
        ctx.restore();
      }
    } catch {
      // Fallback
    }
  }

  // Bottom overlay on portrait for Class & Rarity
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(28, 412, 310, 80);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText((t.servantClass || 'SABER').toUpperCase(), 183, 440);

  ctx.fillStyle = '#fbbf24';
  ctx.font = '20px sans-serif';
  ctx.fillText('★'.repeat(t.rarity || 5), 183, 468);

  // Servant Name & Details (Right Column x = 360)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(servant.nickname || t.name || 'Heroic Spirit', 360, 58);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px sans-serif';
  ctx.fillText(\`\${t.title || 'Heroic Spirit'} • Master: \${masterName}\`, 360, 82);

  // Level, Bond & Stat Points
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(\`Lv. \${lvl}/100\`, 360, 108);
  ctx.fillStyle = '#ec4899';
  ctx.fillText(\`Bond Lv. \${servant.bondLevel || 1} ♥\`, 460, 108);
  ctx.fillStyle = '#f59e0b';
  ctx.fillText(\`Points: \${servant.availableStatPoints || 0} pts\`, 590, 108);

  // HP & ATK badges
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 360, 124, 150, 48, 8);
  ctx.fill();
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('MAX HP', 372, 142);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(totalHp.toLocaleString(), 372, 162);

  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 524, 124, 150, 48, 8);
  ctx.fill();
  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('TOTAL ATK', 536, 142);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(totalAtk.toLocaleString(), 536, 162);

  // Base Parameters & Radar chart
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('BASE PARAMETERS', 360, 196);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '13px sans-serif';
  ctx.fillText(\`STR: \${totalStr}   END: \${totalEnd}   AGI: \${totalAgi}\`, 360, 218);
  ctx.fillText(\`MNA: \${totalMna}   LCK: \${totalLck}\`, 360, 238);

  const combinedStats = {
    strength: totalStr,
    endurance: totalEnd,
    agility: totalAgi,
    mana: totalMna,
    luck: totalLck
  };
  const radar = calculateRadarCoordinates(combinedStats, 770, 205, 52, 28);

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

  // Command Deck
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('COMMAND DECK', 360, 268);

  const commandDeck: CardType[] = t.commandDeck || ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'];
  commandDeck.forEach((card: CardType, idx: number) => {
    const cardX = 360 + idx * 54;
    const cardY = 276;
    ctx.fillStyle = card === 'Buster' ? '#dc2626' : card === 'Arts' ? '#2563eb' : '#16a34a';
    drawRoundRect(ctx, cardX, cardY, 46, 24, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(card[0], cardX + 23, cardY + 16);
  });

  // Craft Essence Section
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 360, 312, 508, 46, 8);
  ctx.fill();
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#60a5fa';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(\`Equipped CE: \${servant.equippedCe ? servant.equippedCe.name : 'None'}\`, 372, 330);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  const ceEffect = servant.equippedCe ? servant.equippedCe.effectText : 'No Craft Essence equipped. Use /customise equip.';
  ctx.fillText(ceEffect.slice(0, 75) + (ceEffect.length > 75 ? '...' : ''), 372, 348);

  // Noble Phantasm Section
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 360, 368, 508, 110, 8);
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1;
  ctx.stroke();

  const np = t.noblePhantasm || { name: 'Excalibur', cardType: 'Buster', chant: '...', description: '' };
  const npCardEmoji = np.cardType === 'Arts' ? '🔵' : np.cardType === 'Quick' ? '🟢' : '🔴';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(\`Noble Phantasm: \${np.name} [\${npCardEmoji} \${np.cardType}]\`, 372, 390);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'italic 12px sans-serif';
  const chant = servant.customQuotes?.noblePhantasm || np.chant || '...';
  ctx.fillText(\`"\${chant.slice(0, 72)}\${chant.length > 72 ? '...' : ''}"\`, 372, 412);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  const npDesc = np.description || 'Deals massive damage to enemy.';
  ctx.fillText(npDesc.slice(0, 78) + (npDesc.length > 78 ? '...' : ''), 372, 434);

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
  ctx.fillText(\`HOLY GRAIL WAR • TURN \${log.turnNumber} CLASH\`, 400, 35);

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
