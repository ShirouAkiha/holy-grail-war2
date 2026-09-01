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

  canvas.width = 850;
  canvas.height = 390;

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
  const bgGrad = ctx.createLinearGradient(0, 0, 850, 390);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(0.5, '#090d16');
  bgGrad.addColorStop(1, '#020617');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 850, 390);

  // Decorative Border
  const borderColor = t.rarity === 5 ? '#f59e0b' : '#38bdf8';
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 3;
  drawRoundRect(ctx, 10, 10, 830, 370, 14);
  ctx.stroke();

  // Top Header Line
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText(servant.nickname || t.name || 'Heroic Spirit', 32, 44);

  // Title & Master
  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(`${t.title || 'Heroic Spirit'} • Master: ${masterName}`, 32, 64);

  // Class Badge & Stars on Right
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText((t.servantClass || 'SABER').toUpperCase(), 818, 44);

  ctx.fillStyle = '#fbbf24';
  ctx.font = '16px system-ui, sans-serif';
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
  ctx.font = 'bold 14px system-ui, sans-serif';
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
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('MAX HP', 44, 126);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(totalHp.toLocaleString(), 44, 146);

  // ATK Badge
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 214, 108, 170, 48, 8);
  ctx.fill();
  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('TOTAL ATK', 226, 126);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(totalAtk.toLocaleString(), 226, 146);

  // Base Parameters
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('BASE PARAMETERS', 32, 173);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(`STR: ${totalStr}    END: ${totalEnd}    AGI: ${totalAgi}`, 32, 193);
  ctx.fillText(`MNA: ${totalMna}    LCK: ${totalLck}`, 32, 212);

  // Command Deck
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('COMMAND DECK', 32, 233);

  const commandDeck: CardType[] = t.commandDeck || ['Buster', 'Buster', 'Arts', 'Arts', 'Quick'];
  commandDeck.forEach((card: CardType, idx: number) => {
    const cardX = 32 + idx * 56;
    const cardY = 240;
    ctx.fillStyle = card === 'Buster' ? '#dc2626' : card === 'Arts' ? '#2563eb' : '#16a34a';
    drawRoundRect(ctx, cardX, cardY, 48, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
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
  ctx.font = 'bold 10px system-ui, sans-serif';
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
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText(`Equipped CE: ${servant.equippedCe ? servant.equippedCe.name : 'None'}`, 44, 289);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px system-ui, sans-serif';
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
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`Noble Phantasm: ${np.name} [${npCardEmoji} ${np.cardType}]`, 44, 340);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'italic 11px system-ui, sans-serif';
  const chant = servant.customQuotes?.noblePhantasm || np.chant || '...';
  ctx.fillText(`"${chant.slice(0, 110)}${chant.length > 110 ? '...' : ''}"`, 44, 358);
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
 * 3. Battle Turn Clash Summary (800x600 - High-Res Diagonal Clash Layout matching Sketch)
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
  canvas.height = 620;

  // Background - Deep Mystic War Canvas
  const bgGrad = ctx.createLinearGradient(0, 0, 800, 620);
  bgGrad.addColorStop(0, '#090d16');
  bgGrad.addColorStop(0.5, '#05070d');
  bgGrad.addColorStop(1, '#11071f');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 800, 620);

  // Outer Border with glowing accents
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  drawRoundRect(ctx, 12, 12, 776, 596, 16);
  ctx.stroke();

  // Subtle grid or rune background lines
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.07)';
  ctx.lineWidth = 1;
  for (let x = 30; x < 780; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 15);
    ctx.lineTo(x, 605);
    ctx.stroke();
  }
  for (let y = 30; y < 610; y += 40) {
    ctx.beginPath();
    ctx.moveTo(15, y);
    ctx.lineTo(785, y);
    ctx.stroke();
  }

  // ==========================================
  // TOP SECTION: PLAYER 1 (Top-Left Layout)
  // ==========================================
  // Header tag
  ctx.fillStyle = '#60a5fa';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Player 1', 35, 42);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`Master: ${p1.masterName} • [${p1.servantClass}]`, 120, 42);

  // 1. P1 Servant Profile Avatar Box (Left)
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 35, 55, 140, 140, 12);
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Avatar Icon / Silhouette
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 43, 63, 124, 124, 8);
  ctx.fill();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 36px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(p1.servantClass[0] || 'S', 105, 128);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 13px system-ui, sans-serif';
  const p1ShortName = p1.name.length > 14 ? p1.name.slice(0, 13) + '…' : p1.name;
  ctx.fillText(p1ShortName, 105, 172);

  // 2. P1 HP & NP Bars (Right of P1 Avatar)
  const p1HpRatio = Math.max(0, Math.min(1, p1.currentHp / p1.maxHp));
  const p1NpRatio = Math.max(0, Math.min(1, p1.npGauge / 100));

  // HP Label & Bar
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('HP', 195, 74);

  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 225, 60, 530, 20, 5);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.stroke();

  // HP Filled
  ctx.fillStyle = p1HpRatio > 0.35 ? '#22c55e' : '#ef4444';
  if (p1HpRatio > 0) {
    drawRoundRect(ctx, 225, 60, 530 * p1HpRatio, 20, 5);
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText(`${p1.currentHp.toLocaleString()} / ${p1.maxHp.toLocaleString()} (${Math.round(p1HpRatio * 100)}%)`, 235, 75);

  // NP Label & Bar
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('NP', 195, 104);

  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 225, 90, 360, 18, 5);
  ctx.fill();
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (p1NpRatio > 0) {
    ctx.fillStyle = p1.npGauge >= 100 ? '#f59e0b' : '#eab308';
    drawRoundRect(ctx, 225, 90, 360 * p1NpRatio, 18, 5);
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText(`${Math.round(p1.npGauge)}% ${p1.npGauge >= 100 ? '✦ NP UNLEASH READY' : ''}`, 235, 103);

  // 3. P1 3 Command Cards (Displayed below HP/NP bars)
  const p1Cards: CardType[] = log.p1Cards || ['Buster', 'Arts', 'Arts'];
  p1Cards.slice(0, 3).forEach((card, idx) => {
    const cardX = 225 + idx * 110;
    const cardY = 120;
    const cardW = 95;
    const cardH = 75;

    const isBuster = card === 'Buster';
    const isArts = card === 'Arts';
    const cardColor = isBuster ? '#dc2626' : isArts ? '#2563eb' : '#16a34a';

    // Card background
    ctx.fillStyle = '#0f172a';
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, 8);
    ctx.fill();
    ctx.strokeStyle = cardColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Card Header Banner
    ctx.fillStyle = cardColor;
    drawRoundRect(ctx, cardX + 4, cardY + 4, cardW - 8, 22, 4);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(card.toUpperCase(), cardX + cardW / 2, cardY + 19);

    // Card Icon
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(isBuster ? '💥' : isArts ? '🌀' : '⚡', cardX + cardW / 2, cardY + 54);

    ctx.font = '9px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(isBuster ? '+50% ATK' : isArts ? '+35% NP' : '+20 Stars', cardX + cardW / 2, cardY + 68);
  });

  // ==========================================
  // MIDDLE SECTION: BATTLE TEXTS HERE (Center Marquee)
  // ==========================================
  ctx.fillStyle = '#020617';
  drawRoundRect(ctx, 35, 215, 730, 150, 12);
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Marquee Header
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 45, 225, 710, 28, 6);
  ctx.fill();

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`⚔️ HOLY GRAIL DUEL • TURN ${log.turnNumber} CLASH RESOLUTION ⚔️`, 400, 244);

  // Main Action Text
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(log.actionSummary, 400, 285);

  // Additional detail notes
  if (log.isCritical || log.isNoblePhantasm) {
    ctx.fillStyle = log.isNoblePhantasm ? '#facc15' : '#ef4444';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(
      log.isNoblePhantasm ? '✨ NOBLE PHANTASM UNLEASHED AT MAXIMUM OUTPUT! ✨' : '💥 CRITICAL STRIKE! DOUBLE DAMAGE DEALT!',
      400,
      315
    );
  } else {
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 12px system-ui, sans-serif';
    ctx.fillText('The Command Seal energy pulses across the battlefield as weapons collide.', 400, 315);
  }

  // Damage / Stats footer banner inside marquee
  ctx.fillStyle = '#38bdf8';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`P1 Stars: ${p1.critStars || 0} ✨  |  P2 Stars: ${p2.critStars || 0} ✨`, 400, 345);

  // ==========================================
  // BOTTOM SECTION: PLAYER 2 (Bottom-Right Layout)
  // ==========================================
  // 1. P2 3 Command Cards (Displayed on Left side of bottom section)
  const p2Cards: CardType[] = log.p2Cards || ['Arts', 'Buster', 'Arts'];
  p2Cards.slice(0, 3).forEach((card, idx) => {
    const cardX = 35 + idx * 110;
    const cardY = 390;
    const cardW = 95;
    const cardH = 75;

    const isBuster = card === 'Buster';
    const isArts = card === 'Arts';
    const cardColor = isBuster ? '#dc2626' : isArts ? '#2563eb' : '#16a34a';

    // Card background
    ctx.fillStyle = '#0f172a';
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, 8);
    ctx.fill();
    ctx.strokeStyle = cardColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Card Header Banner
    ctx.fillStyle = cardColor;
    drawRoundRect(ctx, cardX + 4, cardY + 4, cardW - 8, 22, 4);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(card.toUpperCase(), cardX + cardW / 2, cardY + 19);

    // Card Icon
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(isBuster ? '💥' : isArts ? '🌀' : '⚡', cardX + cardW / 2, cardY + 54);

    ctx.font = '9px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(isBuster ? '+50% ATK' : isArts ? '+35% NP' : '+20 Stars', cardX + cardW / 2, cardY + 68);
  });

  // 2. P2 NP & HP Bars (Underneath P2 Cards, Left Side)
  const p2HpRatio = Math.max(0, Math.min(1, p2.currentHp / p2.maxHp));
  const p2NpRatio = Math.max(0, Math.min(1, p2.npGauge / 100));

  // P2 NP
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('NP', 35, 492);

  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 65, 478, 330, 18, 5);
  ctx.fill();
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (p2NpRatio > 0) {
    ctx.fillStyle = p2.npGauge >= 100 ? '#f59e0b' : '#eab308';
    drawRoundRect(ctx, 65, 478, 330 * p2NpRatio, 18, 5);
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText(`${Math.round(p2.npGauge)}% ${p2.npGauge >= 100 ? '✦ READY' : ''}`, 75, 491);

  // P2 HP
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('HP', 35, 526);

  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 65, 510, 530, 20, 5);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = p2HpRatio > 0.35 ? '#22c55e' : '#ef4444';
  if (p2HpRatio > 0) {
    drawRoundRect(ctx, 65, 510, 530 * p2HpRatio, 20, 5);
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText(`${p2.currentHp.toLocaleString()} / ${p2.maxHp.toLocaleString()} (${Math.round(p2HpRatio * 100)}%)`, 75, 525);

  // 3. P2 Servant Profile Avatar Box (Right side)
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 625, 390, 140, 140, 12);
  ctx.fill();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 633, 398, 124, 124, 8);
  ctx.fill();

  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 36px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(p2.servantClass[0] || 'E', 695, 463);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 13px system-ui, sans-serif';
  const p2ShortName = p2.name.length > 14 ? p2.name.slice(0, 13) + '…' : p2.name;
  ctx.fillText(p2ShortName, 695, 507);

  // Bottom-Right Label: Player 2
  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Player 2', 765, 570);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`Master: ${p2.masterName} • [${p2.servantClass}]`, 765, 590);
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
