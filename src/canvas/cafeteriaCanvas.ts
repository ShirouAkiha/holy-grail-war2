// Chaldea Cafeteria & Campus Hub - Dual Canvas Visual Novel Renderer
// 1. renderChaldeaNodeMapCanvas: Dynamic stylized 2D map node-graph compositing Masters onto room nodes
// 2. renderChaldeaLocationCanvas: Cinematic Visual Novel room viewport with Servant companion and stationed player avatars

import { getCanvasModule } from './canvasLoader';
import { CAFETERIA_ROOMS, CafeteriaRoom } from '../data/cafeteriaData';
import { StationedMaster, StoveCookingPot } from '../engine/cafeteriaEngine';

interface NodeCoords {
  x: number;
  y: number;
  label: string;
}

const ROOM_COORDINATES: Record<string, NodeCoords> = {
  dining_hall: { x: 250, y: 160, label: 'Dining Hall' },
  kitchen_prep: { x: 130, y: 160, label: 'Prep Counter' },
  kitchen_stove: { x: 130, y: 70, label: 'Stoves & Ovens' },
  pantry: { x: 60, y: 110, label: 'Pantry Vault' },
  cold_storage: { x: 60, y: 220, label: 'Cold Storage' },
  staff_lounge: { x: 370, y: 160, label: 'Staff Lounge' },
  greenhouse: { x: 370, y: 70, label: 'Greenhouse' },
  hallway: { x: 250, y: 250, label: 'Central Corridor' }
};

async function safeLoadImage(canvasMod: any, url: string | undefined): Promise<any | null> {
  if (!url) return null;
  try {
    const loadPromise = canvasMod.loadImage(url);
    const timeoutPromise = new Promise<null>(resolve => setTimeout(() => resolve(null), 2500));
    return await Promise.race([loadPromise, timeoutPromise]);
  } catch {
    return null;
  }
}

/**
 * 1. Dynamic Chaldea Node Map Canvas (500x320)
 * Renders an architectural blueprint node-graph with connecting leylines,
 * room beacons, and live circular player avatar tokens.
 */
export async function renderChaldeaNodeMapCanvas(
  currentRoomId: string,
  allMasters: StationedMaster[]
): Promise<Buffer> {
  const canvasMod = getCanvasModule();
  const width = 500;
  const height = 320;
  const canvas = canvasMod.createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Deep sci-fi blueprint slate background
  ctx.fillStyle = '#060a17';
  ctx.fillRect(0, 0, width, height);

  // 2. Subtle architectural grid lines
  ctx.strokeStyle = 'rgba(30, 58, 138, 0.25)';
  ctx.lineWidth = 1;
  const gridSize = 25;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // 3. Header title ribbon
  ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
  ctx.fillRect(0, 0, width, 32);
  ctx.fillStyle = '#00e5ff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('⚡ CHALDEA SECURITY ORGANIZATION — CULINARY SECTOR MAP', 14, 20);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`ONLINE MASTERS: ${allMasters.length}`, width - 14, 20);

  // Group masters by room
  const mastersByRoom: Record<string, StationedMaster[]> = {};
  for (const m of allMasters) {
    if (!mastersByRoom[m.currentRoomId]) mastersByRoom[m.currentRoomId] = [];
    mastersByRoom[m.currentRoomId].push(m);
  }

  // 4. Draw connecting leylines between adjacent rooms
  ctx.lineWidth = 2;
  const drawnLines = new Set<string>();

  for (const [roomId, room] of Object.entries(CAFETERIA_ROOMS)) {
    const fromCoord = ROOM_COORDINATES[roomId];
    if (!fromCoord) continue;

    for (const connId of room.connections) {
      const toCoord = ROOM_COORDINATES[connId];
      if (!toCoord) continue;

      const lineKey = [roomId, connId].sort().join('-');
      if (drawnLines.has(lineKey)) continue;
      drawnLines.add(lineKey);

      const isCurrentLine = roomId === currentRoomId || connId === currentRoomId;
      ctx.strokeStyle = isCurrentLine ? 'rgba(0, 229, 255, 0.6)' : 'rgba(56, 189, 248, 0.2)';
      ctx.beginPath();
      ctx.moveTo(fromCoord.x, fromCoord.y);
      ctx.lineTo(toCoord.x, toCoord.y);
      ctx.stroke();
    }
  }

  // 5. Draw Room Nodes
  for (const [roomId, coord] of Object.entries(ROOM_COORDINATES)) {
    const isCurrent = roomId === currentRoomId;
    const roomMasters = mastersByRoom[roomId] || [];
    const radius = isCurrent ? 24 : 19;

    // Outer glow for current room
    if (isCurrent) {
      ctx.beginPath();
      ctx.arc(coord.x, coord.y, radius + 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
      ctx.fill();
    }

    // Node body
    ctx.beginPath();
    ctx.arc(coord.x, coord.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = isCurrent ? '#f59e0b' : roomMasters.length > 0 ? '#1e293b' : '#0f172a';
    ctx.fill();
    ctx.lineWidth = isCurrent ? 2.5 : 1.5;
    ctx.strokeStyle = isCurrent ? '#fbbf24' : roomMasters.length > 0 ? '#00e5ff' : '#334155';
    ctx.stroke();

    // Node icon / count
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (isCurrent) {
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('YOU', coord.x, coord.y);
    } else {
      ctx.fillStyle = roomMasters.length > 0 ? '#00e5ff' : '#64748b';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`${roomMasters.length > 0 ? roomMasters.length : '•'}`, coord.x, coord.y);
    }

    // Node label below
    ctx.font = isCurrent ? 'bold 10px sans-serif' : '9px sans-serif';
    ctx.fillStyle = isCurrent ? '#fbbf24' : roomMasters.length > 0 ? '#e2e8f0' : '#94a3b8';
    ctx.fillText(coord.label, coord.x, coord.y + radius + 12);

    // If Masters are stationed, draw tiny avatar circles or tokens
    if (roomMasters.length > 0) {
      const tokenSpacing = 16;
      const startX = coord.x - ((Math.min(3, roomMasters.length) - 1) * tokenSpacing) / 2;
      for (let i = 0; i < Math.min(3, roomMasters.length); i++) {
        const m = roomMasters[i];
        const tokenX = startX + i * tokenSpacing;
        const tokenY = coord.y - radius - 10;

        ctx.beginPath();
        ctx.arc(tokenX, tokenY, 6, 0, Math.PI * 2);
        ctx.fillStyle = m.discordId === (roomMasters.find(x => x.discordId === m.discordId)?.discordId) ? '#10b981' : '#3b82f6';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  // 6. Bottom Legend Bar
  ctx.fillStyle = 'rgba(10, 15, 29, 0.9)';
  ctx.fillRect(0, height - 26, width, 26);
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fbbf24';
  ctx.fillText('● Gold = Your Location', 14, height - 9);
  ctx.fillStyle = '#00e5ff';
  ctx.fillText('● Cyan = Occupied Room', 140, height - 9);
  ctx.fillStyle = '#64748b';
  ctx.fillText('● Grey = Empty Station', 270, height - 9);

  return canvas.toBuffer('image/png');
}

/**
 * 2. First-Person Visual Novel Viewport Stage (960x540)
 * Renders the room background, contracted Servant companion sprite on right,
 * stationed Master tokens on top/left, and visual novel dialogue HUD at bottom.
 */
export async function renderChaldeaLocationCanvas(
  room: CafeteriaRoom,
  currentMaster: StationedMaster,
  roomMasters: StationedMaster[],
  activeStovePot?: StoveCookingPot
): Promise<Buffer> {
  const canvasMod = getCanvasModule();
  const width = 960;
  const height = 540;
  const canvas = canvasMod.createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Draw Room Background Image
  const bgImg = await safeLoadImage(canvasMod, room.backgroundUrl);
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, width, height);
  } else {
    // Elegant procedural sci-fi gradient fallback
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#1e293b');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // 2. Cinematic Vignette (darken edges for focus)
  const topGrad = ctx.createLinearGradient(0, 0, 0, 120);
  topGrad.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
  topGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, width, 120);

  const bottomGrad = ctx.createLinearGradient(0, height - 200, 0, height);
  bottomGrad.addColorStop(0, 'transparent');
  bottomGrad.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, height - 200, width, 200);

  // 3. Contracted Servant Sprite (Flank Right - Visual Novel Character Cutout)
  const candidateUrl = currentMaster.companionServantSprite || currentMaster.companionServantAvatar;
  let servantImg = await safeLoadImage(canvasMod, candidateUrl);
  if (!servantImg && currentMaster.companionServantAvatar && currentMaster.companionServantAvatar !== candidateUrl) {
    servantImg = await safeLoadImage(canvasMod, currentMaster.companionServantAvatar);
  }

  if (servantImg && servantImg.width && servantImg.height) {
    const isMerged = isAtlasMergedSprite(servantImg) ||
      Boolean(servantImg._isAtlasMerged) ||
      (servantImg._sourceUrl && String(servantImg._sourceUrl).includes('CharaFigure')) ||
      (servantImg.src && String(servantImg.src).includes('CharaFigure')) ||
      Boolean(candidateUrl && candidateUrl.includes('CharaFigure'));

    let sourceW = servantImg.width;
    let sourceH = servantImg.height;
    if (isMerged) {
      const bounds = getAtlasFigureBounds(servantImg);
      sourceW = bounds.sw;
      sourceH = bounds.sh;
    }

    const aspect = sourceW / sourceH;
    const maxSpriteH = Math.round(height * 0.94);
    const maxSpriteW = Math.round(width * 0.46);

    let spriteW = maxSpriteW;
    let spriteH = Math.round(spriteW / aspect);
    if (spriteH > maxSpriteH) {
      spriteH = maxSpriteH;
      spriteW = Math.round(spriteH * aspect);
    }

    // Anchor to bottom edge and right side
    const spriteX = width - spriteW - 24;
    const spriteY = height - spriteH;

    // Gentle warm halo behind servant
    const haloX = spriteX + spriteW / 2;
    const haloY = spriteY + spriteH / 2;
    const haloRadius = Math.max(spriteW, spriteH) * 0.45;
    const halo = ctx.createRadialGradient(haloX, haloY, 20, haloX, haloY, haloRadius);
    halo.addColorStop(0, 'rgba(212, 175, 55, 0.25)');
    halo.addColorStop(0.7, 'rgba(212, 175, 55, 0.08)');
    halo.addColorStop(1, 'transparent');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(haloX, haloY, haloRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    // Drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;

    if (isMerged) {
      drawServantBattleSprite(ctx, servantImg, spriteX, spriteY, spriteW, spriteH, {
        fitMode: 'contain',
        isAtlasMerged: true,
      });
    } else {
      ctx.drawImage(servantImg, spriteX, spriteY, spriteW, spriteH);
    }
    ctx.restore();
  }

  // 4. Stationed Masters HUD Banner (Top-Left)
  const otherMasters = roomMasters.filter(m => m.discordId !== currentMaster.discordId);
  ctx.fillStyle = 'rgba(10, 15, 29, 0.85)';
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(24, 20, 420, 72, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#00e5ff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`👥 STATIONED MASTERS IN THIS ZONE (${roomMasters.length})`, 38, 40);

  if (otherMasters.length === 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = 'italic 11px sans-serif';
    ctx.fillText('You are currently the only Master stationed here.', 38, 65);
  } else {
    // Show names and AFK statuses of up to 3 other masters
    let avatarOffsetX = 38;
    for (let i = 0; i < Math.min(3, otherMasters.length); i++) {
      const m = otherMasters[i];
      const avImg = await safeLoadImage(canvasMod, m.avatarUrl);

      // Draw circular avatar
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarOffsetX + 14, 62, 14, 0, Math.PI * 2);
      ctx.clip();
      if (avImg) {
        ctx.drawImage(avImg, avatarOffsetX, 48, 28, 28);
      } else {
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(avatarOffsetX, 48, 28, 28);
      }
      ctx.restore();

      ctx.beginPath();
      ctx.arc(avatarOffsetX + 14, 62, 14, 0, Math.PI * 2);
      ctx.strokeStyle = m.isAfk ? '#f59e0b' : '#10b981';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Master name badge
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(m.username.slice(0, 9), avatarOffsetX + 34, 58);

      ctx.font = '9px sans-serif';
      ctx.fillStyle = m.isAfk ? '#f59e0b' : '#94a3b8';
      ctx.fillText(m.isAfk ? '[AFK]' : '[Active]', avatarOffsetX + 34, 71);

      avatarOffsetX += 120;
    }
  }

  // 5. Active Stove Pot Callout (If currently in kitchen_stove)
  if (room.id === 'kitchen_stove' && activeStovePot) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(24, 105, 340, 52, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`🔥 ${activeStovePot.recipeEmoji} ${activeStovePot.recipeName}`, 36, 126);

    const now = Date.now();
    const remSec = Math.max(0, Math.ceil((activeStovePot.readyAt - now) / 1000));
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '10px sans-serif';
    const potStatus = remSec > 0 ? `Simmering (${remSec}s left) • Stirs: ${activeStovePot.stirCount}` : `READY TO PLATE!`;
    ctx.fillText(potStatus, 36, 144);
  }

  // 6. Visual Novel Dialogue Box Ribbon (Bottom)
  const vnBoxX = 24;
  const vnBoxY = height - 145;
  const vnBoxW = width - 48;
  const vnBoxH = 125;

  ctx.fillStyle = 'rgba(8, 12, 22, 0.92)';
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(vnBoxX, vnBoxY, vnBoxW, vnBoxH, 8);
  ctx.fill();
  ctx.stroke();

  // Ornate gold corner accents
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(vnBoxX + 6, vnBoxY + 6, 12, 2);
  ctx.fillRect(vnBoxX + 6, vnBoxY + 6, 2, 12);
  ctx.fillRect(vnBoxX + vnBoxW - 18, vnBoxY + 6, 12, 2);
  ctx.fillRect(vnBoxX + vnBoxW - 8, vnBoxY + 6, 2, 12);

  // Room Title & Activity Tab
  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`📍 ${room.name.toUpperCase()}`, vnBoxX + 22, vnBoxY + 28);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`🎵 ${room.ambientBgm}`, vnBoxX + vnBoxW - 22, vnBoxY + 28);

  // Room Description
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(room.description, vnBoxX + 22, vnBoxY + 54);

  // Player status & companion line
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText(`Contracted Companion: ${currentMaster.companionServantName}`, vnBoxX + 22, vnBoxY + 80);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = 'italic 11px sans-serif';
  ctx.fillText(`“Master, what are our culinary orders for tonight? The kitchen awaits your command.”`, vnBoxX + 22, vnBoxY + 100);

  return canvas.toBuffer('image/png');
}
