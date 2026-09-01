import {
  CombatTurnLog,
  GachaResultItem,
  HolyGrailWarSession,
  MasterServantInstance,
  ActiveCombatant,
  CardType
} from '../types';
import { calculateRadarCoordinates } from '../engine/customization';

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

/**
 * 1. Servant Profile Status Card (900x520)
 */
export function renderServantProfileCard(
  canvas: HTMLCanvasElement,
  servant: MasterServantInstance | any,
  masterName: string
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = 900;
  canvas.height = 520;

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

  // Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 900, 520);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(0.5, '#090d16');
  bgGrad.addColorStop(1, '#020617');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 900, 520);

  // Decorative Border
  ctx.strokeStyle = t.rarity === 5 ? '#f59e0b' : '#38bdf8';
  ctx.lineWidth = 3;
  drawRoundRect(ctx, 12, 12, 876, 496, 16);
  ctx.stroke();

  // Left Avatar Frame Container (310x464 Big Portrait)
  ctx.save();
  drawRoundRect(ctx, 28, 28, 310, 464, 14);
  ctx.clip();
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(28, 28, 310, 464);

  const imgUrl = t.cardArtUrl || t.avatarUrl;
  if (imgUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imgUrl;
    const renderCardArt = () => {
      if (!ctx) return;
      ctx.save();
      drawRoundRect(ctx, 28, 28, 310, 464, 14);
      ctx.clip();
      drawImageCover(ctx, img, 28, 28, 310, 464);
      
      // Bottom overlay badge on portrait
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(28, 412, 310, 80);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${(t.servantClass || 'SABER').toUpperCase()}`, 183, 440);
      ctx.fillStyle = '#fbbf24';
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillText('★'.repeat(t.rarity || 5), 183, 468);
      ctx.restore();
    };

    if (img.complete && img.naturalWidth > 0) {
      renderCardArt();
    } else {
      img.onload = renderCardArt;
    }
  }

  // Base Overlay badge on portrait (immediate fallback)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(28, 412, 310, 80);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${(t.servantClass || 'SABER').toUpperCase()}`, 183, 440);
  ctx.fillStyle = '#fbbf24';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('★'.repeat(t.rarity || 5), 183, 468);
  ctx.restore();

  // Servant Name & Details (Right Column x = 360)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(servant.nickname || t.name || 'Heroic Spirit', 360, 58);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(`${t.title || 'Heroic Spirit'} • Master: ${masterName}`, 360, 82);

  // Level, Bond & Stat Points
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(`Lv. ${lvl}/100`, 360, 108);
  ctx.fillStyle = '#ec4899';
  ctx.fillText(`Bond Lv. ${servant.bondLevel || 1} ♥`, 460, 108);
  ctx.fillStyle = '#f59e0b';
  ctx.fillText(`Points: ${servant.availableStatPoints || 0} pts`, 590, 108);

  // HP & ATK badges
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 360, 124, 150, 48, 8);
  ctx.fill();
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('MAX HP', 372, 142);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText(totalHp.toLocaleString(), 372, 162);

  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 524, 124, 150, 48, 8);
  ctx.fill();
  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('TOTAL ATK', 536, 142);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText(totalAtk.toLocaleString(), 536, 162);

  // Base Parameters & Radar chart
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('BASE PARAMETERS', 360, 196);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(`STR: ${totalStr}   END: ${totalEnd}   AGI: ${totalAgi}`, 360, 218);
  ctx.fillText(`MNA: ${totalMna}   LCK: ${totalLck}`, 360, 238);

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
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('COMMAND DECK', 360, 268);

  const commandDeck: CardType[] = t.commandDeck || ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'];
  commandDeck.forEach((card: CardType, idx: number) => {
    const cardX = 360 + idx * 54;
    const cardY = 276;
    ctx.fillStyle = card === 'Buster' ? '#dc2626' : card === 'Arts' ? '#2563eb' : '#16a34a';
    drawRoundRect(ctx, cardX, cardY, 46, 24, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
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
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`Equipped CE: ${servant.equippedCe ? servant.equippedCe.name : 'None'}`, 372, 330);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px system-ui, sans-serif';
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
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(`Noble Phantasm: ${np.name} [${npCardEmoji} ${np.cardType}]`, 372, 390);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'italic 12px system-ui, sans-serif';
  const chant = servant.customQuotes?.noblePhantasm || np.chant || '...';
  ctx.fillText(`"${chant.slice(0, 72)}${chant.length > 72 ? '...' : ''}"`, 372, 412);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  const npDesc = np.description || 'Deals massive damage to enemy.';
  ctx.fillText(npDesc.slice(0, 78) + (npDesc.length > 78 ? '...' : ''), 372, 434);
}

/**
 * 2. Visual Novel Dynamic Dialogue Card (800x240)
 */
export function renderDialogueCard(
  canvas: HTMLCanvasElement,
  speakerName: string,
  quoteText: string,
  title: string = 'Heroic Spirit',
  servantClass: string = 'Saber'
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = 800;
  canvas.height = 240;

  // Cinematic Dark Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 800, 240);
  bgGrad.addColorStop(0, '#0c1222');
  bgGrad.addColorStop(1, '#020617');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 800, 240);

  // Golden Frame
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 2;
  drawRoundRect(ctx, 8, 8, 784, 224, 12);
  ctx.stroke();

  // Left Avatar Circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(100, 120, 65, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  const avGrad = ctx.createLinearGradient(35, 55, 165, 185);
  avGrad.addColorStop(0, '#1e293b');
  avGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = avGrad;
  ctx.fillRect(35, 55, 130, 130);
  ctx.restore();

  // Avatar Border Ring
  ctx.beginPath();
  ctx.arc(100, 120, 65, 0, Math.PI * 2);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Nameplate Box
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 195, 30, 320, 36, 6);
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(speakerName, 210, 54);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`[${servantClass}] • ${title}`, 360, 54);

  // Quote Box
  ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
  drawRoundRect(ctx, 195, 76, 575, 135, 8);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Quotation Marks
  ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillText('“', 205, 135);

  // Render Multiline Text
  ctx.fillStyle = '#f1f5f9';
  ctx.font = 'italic 16px system-ui, sans-serif';
  const maxWidth = 520;
  const words = quoteText.split(' ');
  let line = '';
  let lineY = 115;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, 240, lineY);
      line = words[n] + ' ';
      lineY += 26;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, 240, lineY);
}

/**
 * 3. Battle Turn Clash Summary (800x380)
 */
export function renderBattleTurnSummary(
  canvas: HTMLCanvasElement,
  log: CombatTurnLog,
  p1: ActiveCombatant,
  p2: ActiveCombatant
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = 800;
  canvas.height = 380;

  // Split Dark Battle Arena Background
  const bgGrad = ctx.createLinearGradient(0, 0, 800, 380);
  bgGrad.addColorStop(0, '#1e1b4b');
  bgGrad.addColorStop(0.5, '#090d16');
  bgGrad.addColorStop(1, '#3b0764');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 800, 380);

  // Turn Header
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`HOLY GRAIL WAR • TURN ${log.turnNumber} CLASH`, 400, 35);

  // P1 (Left Combatant) Card (340x260)
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 30, 55, 340, 240, 10);
  ctx.fill();
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#60a5fa';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(p1.name, 45, 85);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`Master: ${p1.masterName} [${p1.servantClass}]`, 45, 105);

  // P1 HP Bar
  const p1HpRatio = Math.max(0, p1.currentHp / p1.maxHp);
  ctx.fillStyle = '#334155';
  drawRoundRect(ctx, 45, 120, 310, 16, 4);
  ctx.fill();
  ctx.fillStyle = p1HpRatio > 0.3 ? '#22c55e' : '#ef4444';
  drawRoundRect(ctx, 45, 120, 310 * p1HpRatio, 16, 4);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText(`HP ${p1.currentHp.toLocaleString()} / ${p1.maxHp.toLocaleString()}`, 50, 133);

  // P1 NP Bar
  const p1NpRatio = Math.min(1.0, p1.npGauge / 100);
  ctx.fillStyle = '#334155';
  drawRoundRect(ctx, 45, 145, 310, 12, 4);
  ctx.fill();
  ctx.fillStyle = '#eab308';
  drawRoundRect(ctx, 45, 145, 310 * p1NpRatio, 12, 4);
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.fillText(`NP ${Math.round(p1.npGauge)}%`, 50, 155);

  // VS Emblem in Center
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VS', 400, 175);

  // P2 (Right Combatant) Card (340x260)
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 430, 55, 340, 240, 10);
  ctx.fill();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(p2.name, 445, 85);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`Master: ${p2.masterName} [${p2.servantClass}]`, 445, 105);

  // P2 HP Bar
  const p2HpRatio = Math.max(0, p2.currentHp / p2.maxHp);
  ctx.fillStyle = '#334155';
  drawRoundRect(ctx, 445, 120, 310, 16, 4);
  ctx.fill();
  ctx.fillStyle = p2HpRatio > 0.3 ? '#22c55e' : '#ef4444';
  drawRoundRect(ctx, 445, 120, 310 * p2HpRatio, 16, 4);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText(`HP ${p2.currentHp.toLocaleString()} / ${p2.maxHp.toLocaleString()}`, 450, 133);

  // P2 NP Bar
  const p2NpRatio = Math.min(1.0, p2.npGauge / 100);
  ctx.fillStyle = '#334155';
  drawRoundRect(ctx, 445, 145, 310, 12, 4);
  ctx.fill();
  ctx.fillStyle = '#eab308';
  drawRoundRect(ctx, 445, 145, 310 * p2NpRatio, 12, 4);
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.fillText(`NP ${Math.round(p2.npGauge)}%`, 450, 155);

  // Bottom Clash Action Banner
  ctx.fillStyle = '#020617';
  drawRoundRect(ctx, 30, 305, 740, 60, 8);
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(log.actionSummary, 400, 335);

  if (log.isCritical) {
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('CRITICAL STRIKE!', 400, 353);
  }
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
