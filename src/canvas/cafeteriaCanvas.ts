import { getCanvasModule } from './canvasLoader';
import { CAFETERIA_ROOMS, CafeteriaRoom } from '../data/cafeteriaData';
import { StationedMaster, StoveCookingPot } from '../engine/cafeteriaEngine';
import { drawServantBattleSprite, isAtlasMergedSprite, getAtlasFigureBounds } from './renderer';
import { getLocalMediaDiskPath, saveLocalMediaBuffer } from '../utils/localMedia';
import path from 'path';

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

const DEFAULT_ROOM_DIALOGUES: Record<string, string> = {
  dining_hall: '“Welcome to the Dining Hall, Master! Shall we prepare a feast for our fellow Servants?”',
  kitchen_prep: '“The prep counter is clear, Master. Let us chop and season our ingredients with care.”',
  kitchen_stove: '“The stove fires are blazingly hot! Keep an eye on the simmer pot so our dish turns out exquisite.”',
  pantry: '“Our dry pantry is stocked with fine grains and spices. What shall we retrieve for today’s menu?”',
  greenhouse: '“The greenhouse herbs and produce are thriving under Chaldea’s mana lights. Freshly harvested!”',
  cold_storage: '“Brrr! It’s freezing in cold storage! Let’s quickly grab the fresh meats and seafood.”',
  staff_lounge: '“Ah, a quiet moment in the staff lounge. Take a break and recharge your Mana, Master.”',
  hallway: '“The central corridor of Chaldea... Servants are bustling to and from the kitchen!”'
};

function wrapCanvasText(ctx: any, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

const IMAGE_CACHE = new Map<string, any>();
const IN_FLIGHT_PROMISES = new Map<string, Promise<any | null>>();

async function safeLoadImage(canvasMod: any, url: string | undefined): Promise<any | null> {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (IMAGE_CACHE.has(trimmed)) {
    return IMAGE_CACHE.get(trimmed);
  }
  if (IN_FLIGHT_PROMISES.has(trimmed)) {
    return IN_FLIGHT_PROMISES.get(trimmed)!;
  }

  const loadTask = (async () => {
    try {
      // 1. Try local disk path first
      const localPath = getLocalMediaDiskPath(trimmed);
      if (localPath) {
        const img = await canvasMod.loadImage(localPath);
        if (img) {
          IMAGE_CACHE.set(trimmed, img);
          return img;
        }
      }

      // 2. Fetch remote media with custom User-Agent and domain Referer
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      };

      if (trimmed.includes('atlasacademy.io')) {
        headers['Referer'] = 'https://atlasacademy.io/';
      } else if (trimmed.includes('wikia.nocookie.net')) {
        headers['Referer'] = 'https://fategrandorder.fandom.com/';
      } else if (trimmed.includes('janitorai.com')) {
        headers['Referer'] = 'https://janitorai.com/';
      }

      const res = await fetch(trimmed, { signal: controller.signal, headers });
      clearTimeout(timeout);

      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const img = await canvasMod.loadImage(buffer);
        if (img) {
          if (IMAGE_CACHE.size > 200) {
            const firstKey = IMAGE_CACHE.keys().next().value;
            if (firstKey) IMAGE_CACHE.delete(firstKey);
          }
          IMAGE_CACHE.set(trimmed, img);

          // Save to local disk cache for instant future reloads
          try {
            const filename = path.basename(trimmed.split('?')[0]);
            saveLocalMediaBuffer(buffer, filename);
          } catch {}
        }
        return img;
      }
    } catch {
      // Silently fall back to direct canvasMod.loadImage
    } finally {
      IN_FLIGHT_PROMISES.delete(trimmed);
    }

    // Direct fallback attempt via canvasMod.loadImage
    try {
      const img = await canvasMod.loadImage(trimmed);
      if (img) IMAGE_CACHE.set(trimmed, img);
      return img;
    } catch {
      return null;
    }
  })();

  IN_FLIGHT_PROMISES.set(trimmed, loadTask);
  return loadTask;
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

    // If Masters are stationed, draw tiny avatar circles
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
  activeStovePot?: StoveCookingPot,
  customDialogue?: string
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

  // 3. Contracted Servant Sprite (Flank Right - Visual Novel Character Cutout with Multi-Tier Fallback)
  const candidateUrls = [
    currentMaster.companionServantSprite,
    currentMaster.companionServantAvatar,
    'https://static.atlasacademy.io/NA/CharaGraph/100100/100100a@1.png',
    'https://ella.janitorai.com/media-approved/JCilim7R92jfy-l4IIdBd.webp'
  ].filter(Boolean) as string[];

  let servantImg: any = null;
  let usedUrl = '';

  for (const url of candidateUrls) {
    servantImg = await safeLoadImage(canvasMod, url);
    if (servantImg && servantImg.width && servantImg.height) {
      usedUrl = url;
      break;
    }
  }

  if (servantImg && servantImg.width && servantImg.height) {
    let isMerged = false;
    try {
      if (typeof isAtlasMergedSprite === 'function') {
        isMerged = isAtlasMergedSprite(servantImg);
      }
    } catch {}

    if (!isMerged) {
      isMerged = Boolean(servantImg._isAtlasMerged) ||
        (servantImg._sourceUrl && String(servantImg._sourceUrl).includes('CharaFigure')) ||
        (servantImg.src && String(servantImg.src).includes('CharaFigure')) ||
        Boolean(usedUrl && usedUrl.includes('CharaFigure'));
    }

    let sourceW = servantImg.width;
    let sourceH = servantImg.height;
    if (isMerged) {
      try {
        if (typeof getAtlasFigureBounds === 'function') {
          const bounds = getAtlasFigureBounds(servantImg);
          sourceW = bounds.sw;
          sourceH = bounds.sh;
        }
      } catch {}
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

    // Anchor to bottom edge and right side (Visual Novel right-side hero placement)
    const spriteX = width - spriteW - 24;
    const spriteY = height - spriteH;

    // Gentle warm ambient halo behind servant figure
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
    // Drop shadow for Visual Novel figure pop
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
  const count = otherMasters.length;

  // Sleek compact top title pill bar (Does not obstruct background or characters)
  const hudX = 20;
  const hudY = 16;
  const hudW = Math.min(480, 240 + Math.max(1, count) * 120);
  const hudH = 36;

  ctx.save();
  ctx.fillStyle = 'rgba(8, 14, 28, 0.85)';
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(hudX, hudY, hudW, hudH, 18);
  ctx.fill();
  ctx.stroke();

  // Header Title
  ctx.fillStyle = '#00e5ff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0, 229, 255, 0.7)';
  ctx.shadowBlur = 8;
  ctx.fillText(`👥 STATIONED MASTERS IN THIS ZONE (${roomMasters.length})`, hudX + 16, hudY + 24);
  ctx.restore();

  if (count === 0) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 8;
    ctx.fillText('You are currently the only Master stationed here.', hudX + 10, hudY + 68);
    ctx.restore();
  } else {
    // Preload avatars in parallel
    const maxDisplayed = Math.min(count, 3);
    const avatarImgs = await Promise.all(
      otherMasters.slice(0, maxDisplayed).map(m => safeLoadImage(canvasMod, m.avatarUrl))
    );
    const pillW = count <= 2 ? 220 : 170;
    const pillH = 64;

    for (let i = 0; i < maxDisplayed; i++) {
      const m = otherMasters[i];
      const slotX = hudX + i * (pillW + 12);
      const slotY = hudY + 46;

      // Floating Glass Pill Backdrop
      ctx.save();
      ctx.fillStyle = 'rgba(8, 14, 28, 0.85)';
      ctx.strokeStyle = m.isAfk ? 'rgba(245, 158, 11, 0.6)' : 'rgba(16, 185, 129, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(slotX, slotY, pillW, pillH, 32);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      const avatarSize = 54;
      const radius = avatarSize / 2;
      const avatarCenterX = slotX + 5 + radius;
      const avatarCenterY = slotY + (pillH - avatarSize) / 2 + radius;

      const avImg = avatarImgs[i];

      // Draw circular avatar inside pill
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarCenterX, avatarCenterY, radius, 0, Math.PI * 2);
      ctx.clip();
      if (avImg) {
        ctx.drawImage(avImg, slotX + 5, slotY + (pillH - avatarSize) / 2, avatarSize, avatarSize);
      } else {
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(slotX + 5, slotY + (pillH - avatarSize) / 2, avatarSize, avatarSize);
      }
      ctx.restore();

      // Glowing avatar stroke border
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarCenterX, avatarCenterY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = m.isAfk ? '#f59e0b' : '#10b981';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();

      // Master name & status labels
      const textX = slotX + avatarSize + 14;
      ctx.save();
      ctx.textAlign = 'left';
      ctx.font = count <= 2 ? 'bold 22px sans-serif' : 'bold 18px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 6;

      const maxLen = count <= 2 ? 10 : 7;
      const displayName = m.username.length > maxLen ? `${m.username.slice(0, maxLen)}…` : m.username;

      ctx.fillText(displayName, textX, avatarCenterY - 4);

      // Status badge
      ctx.font = count <= 2 ? 'bold 16px sans-serif' : 'bold 14px sans-serif';
      ctx.fillStyle = m.isAfk ? '#f59e0b' : '#10b981';
      ctx.fillText(m.isAfk ? '💤 AFK' : '⚡ Active', textX, avatarCenterY + 18);
      ctx.restore();
    }

    if (count > maxDisplayed) {
      const extraCount = count - maxDisplayed;
      const extraX = hudX + maxDisplayed * (pillW + 12);
      ctx.save();
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 16px sans-serif';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 6;
      ctx.fillText(`+${extraCount} more`, extraX, hudY + 84);
      ctx.restore();
    }
  }

  // 5. Active Stove Pot Callout (If currently in kitchen_stove)
  if (room.id === 'kitchen_stove' && activeStovePot) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(20, 122, 380, 56, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`🔥 ${activeStovePot.recipeEmoji} ${activeStovePot.recipeName}`, 34, 146);

    const now = Date.now();
    const remSec = Math.max(0, Math.ceil((activeStovePot.readyAt - now) / 1000));
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 14px sans-serif';
    const potStatus = remSec > 0 ? `Simmering (${remSec}s left) • Stirs: ${activeStovePot.stirCount}` : `READY TO PLATE!`;
    ctx.fillText(potStatus, 34, 168);
  }

  // 6. Visual Novel Dialogue Box Ribbon (Bottom - 2x Scaled Large & Bold)
  const vnBoxX = 20;
  const vnBoxY = height - 160;
  const vnBoxW = width - 40;
  const vnBoxH = 140;

  // Semi-transparent deep dark background overlay
  ctx.fillStyle = 'rgba(6, 10, 22, 0.94)';
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(vnBoxX, vnBoxY, vnBoxW, vnBoxH, 12);
  ctx.fill();
  ctx.stroke();

  // Ornate gold corner accents
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(vnBoxX + 8, vnBoxY + 8, 16, 3);
  ctx.fillRect(vnBoxX + 8, vnBoxY + 8, 3, 16);
  ctx.fillRect(vnBoxX + vnBoxW - 24, vnBoxY + 8, 16, 3);
  ctx.fillRect(vnBoxX + vnBoxW - 11, vnBoxY + 8, 3, 16);

  ctx.fillRect(vnBoxX + 8, vnBoxY + vnBoxH - 11, 16, 3);
  ctx.fillRect(vnBoxX + 8, vnBoxY + vnBoxH - 19, 3, 16);
  ctx.fillRect(vnBoxX + vnBoxW - 24, vnBoxY + vnBoxH - 11, 16, 3);
  ctx.fillRect(vnBoxX + vnBoxW - 11, vnBoxY + vnBoxH - 19, 3, 16);

  // Servant Speaker Nameplate Badge (30px Bold)
  const speakerName = currentMaster.companionServantName || 'Contracted Companion';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`💬 ${speakerName}`, vnBoxX + 28, vnBoxY + 42);

  // Servant Dialogue Text (32px Italic with multi-line word wrapping)
  const rawDialogue = customDialogue || DEFAULT_ROOM_DIALOGUES[room.id] || `“Master, what are your orders for ${room.shortName}?”`;
  const dialogueText = rawDialogue.startsWith('“') ? rawDialogue : `“${rawDialogue}”`;

  ctx.fillStyle = '#ffffff';
  ctx.font = 'italic 32px sans-serif';
  ctx.textAlign = 'left';

  const maxLineWidth = vnBoxW - 56;
  const dialogueLines = wrapCanvasText(ctx, dialogueText, maxLineWidth);

  let startY = vnBoxY + 84;
  const lineHeight = 42;

  for (const line of dialogueLines.slice(0, 2)) {
    ctx.fillText(line, vnBoxX + 28, startY);
    startY += lineHeight;
  }

  return canvas.toBuffer('image/png');
}
