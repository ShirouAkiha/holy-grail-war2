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

function createFallbackAvatarSvg(name?: string, servantClass?: string): string {
  const initial = (servantClass?.[0] || name?.[0] || 'S').toUpperCase();
  const displayName = (name || 'Servant').slice(0, 12);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect width="200" height="200" fill="#0f172a"/>
    <rect x="10" y="10" width="180" height="180" fill="#1e293b" stroke="#d4af37" stroke-width="4" rx="12"/>
    <circle cx="100" cy="85" r="45" fill="#334155" stroke="#fbbf24" stroke-width="2"/>
    <text x="100" y="102" font-family="sans-serif" font-size="52" font-weight="bold" fill="#f59e0b" text-anchor="middle">${initial}</text>
    <text x="100" y="165" font-family="sans-serif" font-size="15" font-weight="bold" fill="#f8fafc" text-anchor="middle">${displayName}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function loadBrowserImage(url?: string, fallbackName?: string, fallbackClass?: string): Promise<HTMLImageElement | null> {
  let targetUrl = url;
  if (!targetUrl || targetUrl.trim().length === 0) {
    targetUrl = createFallbackAvatarSvg(fallbackName, fallbackClass);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // If CORS anonymous failed, attempt standard load or SVG fallback
      const fallbackImg = new Image();
      fallbackImg.onload = () => resolve(fallbackImg);
      fallbackImg.onerror = () => {
        // Ultimate fallback to inline SVG data URL
        const svgImg = new Image();
        svgImg.onload = () => resolve(svgImg);
        svgImg.onerror = () => resolve(null);
        svgImg.src = createFallbackAvatarSvg(fallbackName, fallbackClass);
      };
      fallbackImg.src = targetUrl!;
    };
    img.src = targetUrl!;
  });
}

/**
 * 3. Battle Turn Clash Summary (640x700 Fate Wireframe Layout)
 */
export async function renderBattleTurnSummary(
  canvas: HTMLCanvasElement,
  log: CombatTurnLog,
  p1: ActiveCombatant,
  p2: ActiveCombatant,
  showDialogueMode: boolean = false
): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = 640;
  canvas.height = 700;

  // Load Avatars concurrently
  const [p1Img, p2Img] = await Promise.all([
    loadBrowserImage(p1.avatarUrl, p1.name, p1.servantClass),
    loadBrowserImage(p2.avatarUrl, p2.name, p2.servantClass)
  ]);

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

  // ==========================================
  // TOP SECTION: PLAYER 1 (MASTER & SERVANT)
  // ==========================================
  // 1. P1 Avatar Box (Left, 120x208)
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 18, 18, 120, 208, 8);
  ctx.fill();

  if (p1Img) {
    ctx.save();
    drawRoundRect(ctx, 20, 20, 116, 204, 6);
    ctx.clip();
    drawImageCover(ctx, p1Img, 20, 20, 116, 204);
    ctx.restore();
  } else {
    ctx.fillStyle = '#1e293b';
    drawRoundRect(ctx, 20, 20, 116, 204, 6);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 38px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p1.servantClass?.[0] || 'S', 78, 110);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText((p1.name || 'Servant').slice(0, 12), 78, 150);
  }

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  drawRoundRect(ctx, 18, 18, 120, 208, 8);
  ctx.stroke();

  // 2. P1 Header Title
  const p1DisplayName = p1.masterName || 'Master 1';
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(p1DisplayName, 148, 38);

  const p1NameWidth = ctx.measureText(p1DisplayName).width;
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(`• ${p1.name} [${p1.servantClass}]`, 156 + p1NameWidth, 38);

  // 2.5 P1 3 Active Skill Badges (Top Right above HP Bar)
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
      ctx.stroke();

      ctx.fillStyle = '#a5b4fc';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🔒 Bond 5', sBoxX + sBoxW / 2, sBoxY + 15);
    } else if (sCd > 0) {
      ctx.fillStyle = '#1e293b';
      drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`S${sIdx + 1}: ${sCd}T`, sBoxX + sBoxW / 2, sBoxY + 15);
    } else {
      ctx.fillStyle = sIdx === 2 ? '#065f46' : '#0369a1';
      drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
      ctx.fill();
      ctx.strokeStyle = sIdx === 2 ? '#10b981' : '#38bdf8';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`✨ S${sIdx + 1}: RDY`, sBoxX + sBoxW / 2, sBoxY + 15);
    }
    ctx.restore();
  });

  // 3. P1 HP & NP Bars
  const p1HpRatio = Math.max(0, Math.min(1, p1.currentHp / p1.maxHp));
  const p1NpRatio = Math.max(0, Math.min(1, (p1.npGauge || 0) / 100));

  // HP Bar (26px height)
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 148, 48, 474, 26, 5);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = p1HpRatio > 0.35 ? '#22c55e' : '#ef4444';
  if (p1HpRatio > 0) {
    drawRoundRect(ctx, 148, 48, Math.max(8, 474 * p1HpRatio), 26, 5);
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`HP  ${p1.currentHp.toLocaleString()} / ${p1.maxHp.toLocaleString()} (${Math.round(p1HpRatio * 100)}%)`, 158, 66);

  // NP Bar (24px height)
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 148, 80, 356, 24, 5);
  ctx.fill();
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (p1NpRatio > 0) {
    ctx.fillStyle = (p1.npGauge || 0) >= 100 ? '#f59e0b' : '#eab308';
    drawRoundRect(ctx, 148, 80, Math.max(8, 356 * p1NpRatio), 24, 5);
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`NP: ${Math.round(p1.npGauge || 0)}% ${(p1.npGauge || 0) >= 100 ? '★ NP READY' : ''}`, 158, 97);

  // NP Tag Right
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('NP', 516, 97);

  // 4. P1 3 Portrait Command Cards (Wireframe style - enlarged 116px height)
  const p1Cards = (log.p1Cards || log.cardsUsed || ['Buster', 'Arts', 'Quick']) as ('Buster' | 'Arts' | 'Quick' | 'NP')[];
  p1Cards.slice(0, 3).forEach((card, idx) => {
    const cardX = 148 + idx * 96;
    const cardY = 110;
    const cardW = 90;
    const cardH = 116;

    let cardColor = '#dc2626';
    let cardLabel = 'BUSTER';
    let emblemText = 'B';
    let statText = idx === 0 ? '1st (+50% DMG)' : `2nd (${idx === 1 ? '1.2x' : '1.4x'})`;

    if (card === 'NP') {
      cardColor = '#d97706';
      cardLabel = 'N. PHANTASM';
      emblemText = 'NP';
      statText = 'MAX OUTPUT';
    } else if (card === 'Arts') {
      cardColor = '#2563eb';
      cardLabel = 'ARTS';
      emblemText = 'A';
      statText = idx === 0 ? '1st (+100% NP)' : `2nd (${idx === 1 ? '1.2x' : '1.4x'})`;
    } else if (card === 'Quick') {
      cardColor = '#16a34a';
      cardLabel = 'QUICK';
      emblemText = 'Q';
      statText = idx === 0 ? '1st (+20% CRIT)' : `2nd (${idx === 1 ? '1.2x' : '1.4x'})`;
    }

    ctx.fillStyle = '#0f172a';
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, 6);
    ctx.fill();
    ctx.strokeStyle = cardColor;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Top card banner
    ctx.fillStyle = cardColor;
    drawRoundRect(ctx, cardX + 2, cardY + 2, cardW - 4, 22, 4);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cardLabel, cardX + cardW / 2, cardY + 17);

    // Center Emblem
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.fillText(emblemText, cardX + cardW / 2, cardY + 62);

    // Bottom stat
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(statText, cardX + cardW / 2, cardY + 102);
  });

  // P1 Stars Pill (to right of cards - 116px height)
  ctx.fillStyle = 'rgba(56, 189, 248, 0.1)';
  drawRoundRect(ctx, 444, 110, 178, 116, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CRIT STARS', 533, 136);

  // Vector star + count
  drawVectorStar(ctx, 492, 175, 5, 13, 6, '#38bdf8');
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 36px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${p1.critStars || 0}`, 514, 186);

  // ==========================================
  // MIDDLE SECTION: CLASH RESOLUTION THEATER (OR MID-BATTLE CUT-IN DIALOGUE)
  // ==========================================
  if (showDialogueMode && log.dialogueCutIn) {
    const dialogue = log.dialogueCutIn;
    let speakerImg: HTMLImageElement | null = null;
    if (dialogue.speakerAvatarUrl) {
      if (dialogue.speakerAvatarUrl === p1.avatarUrl) speakerImg = p1Img;
      else if (dialogue.speakerAvatarUrl === p2.avatarUrl) speakerImg = p2Img;
      else speakerImg = await loadBrowserImage(dialogue.speakerAvatarUrl, dialogue.speakerName, dialogue.speakerClass);
    }
    if (!speakerImg) {
      if (dialogue.speakerName?.toLowerCase() === p2.name?.toLowerCase()) speakerImg = p2Img;
      else speakerImg = p1Img || p2Img;
    }

    // Outer Chassis
    ctx.fillStyle = '#0a0805';
    drawRoundRect(ctx, 18, 236, 604, 200, 10);
    ctx.fill();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Inner Filigree Frame Accent
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.lineWidth = 1;
    drawRoundRect(ctx, 22, 240, 596, 192, 8);
    ctx.stroke();

    // Header Marquee Pill (Scenario Title)
    ctx.fillStyle = '#1e130a';
    drawRoundRect(ctx, 30, 246, 580, 26, 5);
    ctx.fill();
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(dialogue.scenarioTitle || '💬 MID-BATTLE COMBAT CUT-IN', 320, 263);

    // Left Servant Portrait Box (X: 30, Y: 278, W: 110, H: 146)
    ctx.fillStyle = '#020617';
    drawRoundRect(ctx, 30, 278, 110, 146, 8);
    ctx.fill();

    if (speakerImg) {
      ctx.save();
      drawRoundRect(ctx, 32, 280, 106, 142, 6);
      ctx.clip();
      drawImageCover(ctx, speakerImg, 32, 280, 106, 142);
      ctx.restore();
    }

    // Gold Portrait Frame
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    drawRoundRect(ctx, 30, 278, 110, 146, 8);
    ctx.stroke();

    // Level Tag
    ctx.fillStyle = '#b45309';
    drawRoundRect(ctx, 72, 280, 26, 18, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${dialogue.level || 90}`, 85, 293);

    // Speaker Nameplate overlapping top-left of dialogue box
    ctx.fillStyle = '#1e110a';
    drawRoundRect(ctx, 148, 278, 160, 24, 4);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(dialogue.speakerName.slice(0, 18), 156, 294);

    // Dialogue Quote Box (X: 148, Y: 308, W: 462, H: 116)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    drawRoundRect(ctx, 148, 308, 462, 116, 6);
    ctx.fill();
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Quote Text wrapped
    ctx.fillStyle = '#fef08a';
    ctx.font = 'italic 14px "Georgia", serif, sans-serif';
    ctx.textAlign = 'left';
    const quoteStr = `"${dialogue.quote}"`;
    drawWrappedText(ctx, quoteStr, 162, 332, 434, 20);

    // Bottom-right indicator
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('⚡ PRE-ATTACK CUT-IN • ATTACK INCOMING IN 4s', 598, 414);
  } else {
    ctx.fillStyle = '#030712';
    drawRoundRect(ctx, 18, 236, 604, 200, 10);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Marquee Header Pill
    ctx.fillStyle = '#1e293b';
    drawRoundRect(ctx, 30, 246, 580, 28, 5);
    ctx.fill();

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`HOLY GRAIL WAR - TURN ${log.turnNumber} CLASH RESOLUTION`, 320, 265);

    // Main Action Text - Sanitize and format ASCII
    const actorClean = (log.actorName || p1.name).replace(/[^\x00-\x7F]/g, '');
    const targetClean = (log.targetName || p2.name).replace(/[^\x00-\x7F]/g, '');
    const cardsUsedSeq = (log.cardsUsed || p1Cards).join(' -> ');

    const actLine = `${actorClean} executed [${cardsUsedSeq}]`;
    const dmgLine = `Dealt ${log.damageDealt > 0 ? log.damageDealt.toLocaleString() : '0'} DMG to ${targetClean}!`;
    const statLine = `+${log.npCharged || 0}% NP Charged | +${log.starsGenerated || 0} Stars Gathered`;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(actLine, 320, 296);

    ctx.fillStyle = log.isCritical ? '#f87171' : '#38bdf8';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(dmgLine, 320, 320);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(statLine, 320, 340);

    // Special Highlight Banner
    if (log.isNoblePhantasm) {
      ctx.fillStyle = 'rgba(234, 179, 8, 0.15)';
      drawRoundRect(ctx, 32, 354, 576, 28, 5);
      ctx.fill();
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText('NOBLE PHANTASM UNLEASHED AT MAXIMUM OUTPUT!', 320, 373);
    } else if (log.isCritical) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
      drawRoundRect(ctx, 32, 354, 576, 28, 5);
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText('CRITICAL STRIKE! DOUBLE DAMAGE DEALT!', 320, 373);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText('Command Seals pulse with etheric energy as weapons clash.', 320, 373);
    }

    // Damage / Stars footer pill
    ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
    drawRoundRect(ctx, 70, 392, 500, 28, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const p1NameClean = (p1.masterName || 'P1').replace(/[^\x00-\x7F]/g, '');
    const p2NameClean = (p2.masterName || 'P2').replace(/[^\x00-\x7F]/g, '');

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`${p1NameClean} Stars: ${p1.critStars || 0}   |   ${p2NameClean} Stars: ${p2.critStars || 0}`, 320, 410);
  }

  // ==========================================
  // BOTTOM SECTION: PLAYER 2 (MASTER & SERVANT)
  // ==========================================
  // 1. P2 Stars Pill (to left of cards - 116px height)
  ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
  drawRoundRect(ctx, 18, 448, 178, 116, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CRIT STARS', 107, 472);

  drawVectorStar(ctx, 68, 513, 5, 13, 6, '#f87171');
  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 36px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${p2.critStars || 0}`, 90, 524);

  // 2. P2 3 Portrait Command Cards (Wireframe style - enlarged 116px height)
  const p2Cards = (log.p2Cards || ['Arts', 'Buster', 'Quick']) as ('Buster' | 'Arts' | 'Quick' | 'NP')[];
  p2Cards.slice(0, 3).forEach((card, idx) => {
    const cardX = 202 + idx * 96;
    const cardY = 448;
    const cardW = 90;
    const cardH = 116;

    let cardColor = '#2563eb';
    let cardLabel = 'ARTS';
    let emblemText = 'A';
    let statText = idx === 0 ? '1st (+100% NP)' : `2nd (${idx === 1 ? '1.2x' : '1.4x'})`;

    if (card === 'NP') {
      cardColor = '#d97706';
      cardLabel = 'N. PHANTASM';
      emblemText = 'NP';
      statText = 'MAX OUTPUT';
    } else if (card === 'Buster') {
      cardColor = '#dc2626';
      cardLabel = 'BUSTER';
      emblemText = 'B';
      statText = idx === 0 ? '1st (+50% DMG)' : `2nd (${idx === 1 ? '1.2x' : '1.4x'})`;
    } else if (card === 'Quick') {
      cardColor = '#16a34a';
      cardLabel = 'QUICK';
      emblemText = 'Q';
      statText = idx === 0 ? '1st (+20% CRIT)' : `2nd (${idx === 1 ? '1.2x' : '1.4x'})`;
    }

    ctx.fillStyle = '#0f172a';
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, 6);
    ctx.fill();
    ctx.strokeStyle = cardColor;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Top card banner
    ctx.fillStyle = cardColor;
    drawRoundRect(ctx, cardX + 2, cardY + 2, cardW - 4, 22, 4);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cardLabel, cardX + cardW / 2, cardY + 17);

    // Center Emblem
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.fillText(emblemText, cardX + cardW / 2, cardY + 62);

    // Bottom stat
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(statText, cardX + cardW / 2, cardY + 102);
  });

  // 3. P2 Details (Status Bars & Avatar)
  const p2HpRatio = Math.max(0, Math.min(1, p2.currentHp / p2.maxHp));
  const p2NpRatio = Math.max(0, Math.min(1, (p2.npGauge || 0) / 100));

  // P2 NP Bar (24px height)
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 148, 574, 344, 24, 5);
  ctx.fill();
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (p2NpRatio > 0) {
    ctx.fillStyle = (p2.npGauge || 0) >= 100 ? '#f59e0b' : '#eab308';
    drawRoundRect(ctx, 148, 574, Math.max(8, 344 * p2NpRatio), 24, 5);
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`NP: ${Math.round(p2.npGauge || 0)}% ${(p2.npGauge || 0) >= 100 ? '★ NP READY' : ''}`, 158, 591);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('NP', 120, 591);

  // P2 HP Bar (26px height)
  ctx.fillStyle = '#1e293b';
  drawRoundRect(ctx, 18, 606, 474, 26, 5);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = p2HpRatio > 0.35 ? '#22c55e' : '#ef4444';
  if (p2HpRatio > 0) {
    drawRoundRect(ctx, 18, 606, Math.max(8, 474 * p2HpRatio), 26, 5);
    ctx.fill();
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`HP  ${p2.currentHp.toLocaleString()} / ${p2.maxHp.toLocaleString()} (${Math.round(p2HpRatio * 100)}%)`, 28, 624);

  // 3.5 P2 3 Active Skill Badges (Bottom Left)
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
      ctx.stroke();

      ctx.fillStyle = '#a5b4fc';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🔒 Bond 5', sBoxX + sBoxW / 2, sBoxY + 15);
    } else if (sCd > 0) {
      ctx.fillStyle = '#1e293b';
      drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`S${sIdx + 1}: ${sCd}T`, sBoxX + sBoxW / 2, sBoxY + 15);
    } else {
      ctx.fillStyle = sIdx === 2 ? '#065f46' : '#991b1b';
      drawRoundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 4);
      ctx.fill();
      ctx.strokeStyle = sIdx === 2 ? '#10b981' : '#f87171';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`✨ S${sIdx + 1}: RDY`, sBoxX + sBoxW / 2, sBoxY + 15);
    }
    ctx.restore();
  });

  // P2 Header Title (Right Aligned before Avatar)
  const p2DisplayName = p2.masterName || 'Master 2';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(p2DisplayName, 492, 652);

  const p2NameWidth = ctx.measureText(p2DisplayName).width;
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(`[${p2.servantClass}] ${p2.name} • `, 492 - p2NameWidth, 652);

  // 4. P2 Avatar Box (Right, 120x226)
  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, 502, 448, 120, 226, 8);
  ctx.fill();

  if (p2Img) {
    ctx.save();
    drawRoundRect(ctx, 504, 450, 116, 222, 6);
    ctx.clip();
    drawImageCover(ctx, p2Img, 504, 450, 116, 222);
    ctx.restore();
  } else {
    ctx.fillStyle = '#1e293b';
    drawRoundRect(ctx, 504, 450, 116, 222, 6);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 38px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p2.servantClass?.[0] || 'E', 562, 540);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText((p2.name || 'Servant').slice(0, 12), 562, 580);
  }

  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2.5;
  drawRoundRect(ctx, 502, 448, 120, 226, 8);
  ctx.stroke();
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
