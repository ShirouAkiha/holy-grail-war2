import {
  CombatTurnLog,
  GachaResultItem,
  HolyGrailWarSession,
  MasterServantInstance,
  ActiveCombatant
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
 * 1. Servant Profile Status Card (800x460)
 */
export function renderServantProfileCard(
  canvas: HTMLCanvasElement,
  servant: MasterServantInstance,
  masterName: string
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = 800;
  canvas.height = 460;

  // Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 800, 460);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(0.5, '#090d16');
  bgGrad.addColorStop(1, '#020617');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 800, 460);

  // Decorative Border
  ctx.strokeStyle = servant.template.rarity === 5 ? '#f59e0b' : '#38bdf8';
  ctx.lineWidth = 3;
  drawRoundRect(ctx, 12, 12, 776, 436, 16);
  ctx.stroke();

  // Left Avatar Frame (220x340)
  ctx.save();
  drawRoundRect(ctx, 30, 30, 220, 340, 12);
  ctx.clip();
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(30, 30, 220, 340);

  // Avatar background
  const avatarGrad = ctx.createLinearGradient(30, 30, 250, 370);
  avatarGrad.addColorStop(0, '#334155');
  avatarGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = avatarGrad;
  ctx.fillRect(30, 30, 220, 340);

  const imgUrl = servant.template.cardArtUrl || servant.template.avatarUrl;
  if (imgUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imgUrl;
    if (img.complete && img.naturalWidth > 0) {
      drawImageCover(ctx, img, 30, 30, 220, 280);
    } else {
      img.onload = () => {
        if (!ctx) return;
        ctx.save();
        drawRoundRect(ctx, 30, 30, 220, 340, 12);
        ctx.clip();
        drawImageCover(ctx, img, 30, 30, 220, 280);
        
        // Re-overlay bottom badge after async image loads
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(30, 280, 220, 60);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${servant.template.servantClass.toUpperCase()}`, 140, 312);
        ctx.fillStyle = '#fbbf24';
        ctx.font = '18px system-ui, sans-serif';
        ctx.fillText('★'.repeat(servant.template.rarity), 140, 332);
        ctx.restore();
      };
    }
  }

  // Class & Rarity overlay on avatar bottom
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(30, 280, 220, 60);
  ctx.restore();

  // Class Badge on Avatar bottom
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${servant.template.servantClass.toUpperCase()}`, 140, 345);

  // Star Rating
  const stars = '★'.repeat(servant.template.rarity);
  ctx.fillStyle = '#fbbf24';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText(stars, 140, 362);

  // Servant Name & Title
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(servant.nickname || servant.template.name, 280, 65);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(`${servant.template.title} • Master: ${masterName}`, 280, 92);

  // Level & Bond Bar
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(`Lv. ${servant.level} / 100`, 280, 125);
  ctx.fillStyle = '#ec4899';
  ctx.fillText(`Bond Lv. ${servant.bondLevel} ♥`, 420, 125);

  // HP and ATK badges
  const totalStr = servant.template.baseStats.strength + (servant.allocatedStats.strength || 0);
  const totalEnd = servant.template.baseStats.endurance + (servant.allocatedStats.endurance || 0);
  const maxHp = Math.round(servant.template.baseHp * (1 + (servant.level - 1) * 0.05) + totalEnd * 150 + (servant.equippedCe?.hpBonus || 0));
  const rawAtk = Math.round(servant.template.baseAtk * (1 + (servant.level - 1) * 0.05) + totalStr * 80 + (servant.equippedCe?.atkBonus || 0));

  // HP Box
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 280, 145, 140, 48, 8);
  ctx.fill();
  ctx.fillStyle = '#4ade80';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('MAX HP', 292, 165);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(maxHp.toLocaleString(), 292, 185);

  // ATK Box
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 435, 145, 140, 48, 8);
  ctx.fill();
  ctx.fillStyle = '#f87171';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('BASE ATK', 447, 165);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(rawAtk.toLocaleString(), 447, 185);

  // Radar Chart on the Right (CenterX: 670, CenterY: 155)
  const combinedStats = {
    strength: totalStr,
    endurance: totalEnd,
    agility: servant.template.baseStats.agility + (servant.allocatedStats.agility || 0),
    mana: servant.template.baseStats.mana + (servant.allocatedStats.mana || 0),
    luck: servant.template.baseStats.luck + (servant.allocatedStats.luck || 0)
  };

  const radar = calculateRadarCoordinates(combinedStats, 670, 155, 60, 30);

  // Draw Radar concentric webs
  [0.33, 0.66, 1.0].forEach(scale => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
      const r = 60 * scale;
      const x = 670 + r * Math.cos(angle);
      const y = 155 + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Draw Radar Polygon fill
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
  radar.points.forEach(p => {
    const angle = Math.atan2(p.y - 155, p.x - 670);
    const labelX = 670 + 78 * Math.cos(angle);
    const labelY = 155 + 78 * Math.sin(angle) + 4;
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.label} ${p.value}`, labelX, labelY);
  });

  // Command Deck Cards
  ctx.textAlign = 'left';
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText('COMMAND DECK', 280, 222);

  servant.template.commandDeck.forEach((card, idx) => {
    const cardX = 280 + idx * 58;
    const cardY = 232;
    ctx.fillStyle = card === 'Buster' ? '#dc2626' : card === 'Arts' ? '#2563eb' : '#16a34a';
    drawRoundRect(ctx, cardX, cardY, 50, 26, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
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
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(`Noble Phantasm: ${servant.template.noblePhantasm.name}`, 295, 300);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`"${servant.customQuotes.noblePhantasm || servant.template.noblePhantasm.chant}"`, 295, 322);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(`${servant.template.noblePhantasm.description}`, 295, 342);

  // Equipped Craft Essence strip
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 30, 385, 740, 50, 8);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 13px system-ui, sans-serif';
  const ceText = servant.equippedCe
    ? `Equipped CE: ${servant.equippedCe.name} (${servant.equippedCe.effectText})`
    : 'No Craft Essence Equipped (Use /customise to equip)';
  ctx.fillText(ceText, 45, 415);
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
