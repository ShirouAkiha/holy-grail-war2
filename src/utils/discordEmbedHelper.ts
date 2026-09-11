import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { getLocalMediaDiskPath } from './localMedia';
import { CANON_MEDIA_FALLBACKS } from './mediaResolver';
import path from 'path';
import fs from 'fs';

/**
 * Safely resolves a media URL or disk path for Discord Embeds.
 * Guarantees that Discord.js EmbedBuilder never throws a URL validation error.
 * If local file exists and files array is provided, attaches it seamlessly!
 */
export function safeSetEmbedImage(
  embed: EmbedBuilder,
  mediaUrl?: string | null,
  files?: (AttachmentBuilder | any)[]
): void {
  if (!mediaUrl || typeof mediaUrl !== 'string' || !embed) return;
  const trimmed = mediaUrl.trim();
  if (!trimmed) return;

  // 1. Direct valid absolute URL or existing attachment reference
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('attachment://')) {
    try {
      embed.setImage(trimmed);
    } catch {}
    return;
  }

  // 2. Local relative media URL (/api/media/..., data/media/..., etc.)
  const diskPath = getLocalMediaDiskPath(trimmed);
  if (diskPath && fs.existsSync(diskPath)) {
    const filename = path.basename(diskPath);
    if (Array.isArray(files)) {
      const alreadyAttached = files.some(f => (f && f.name === filename) || (f && f.attachment === diskPath));
      if (!alreadyAttached) {
        files.push(new AttachmentBuilder(diskPath, { name: filename }));
      }
      try {
        embed.setImage(`attachment://${filename}`);
        return;
      } catch {}
    }
  }

  // 3. Fallback resolution if files array not supplied or unattached
  const baseFilename = path.basename(trimmed);
  if (CANON_MEDIA_FALLBACKS[baseFilename]) {
    try {
      embed.setImage(CANON_MEDIA_FALLBACKS[baseFilename]);
      return;
    } catch {}
  }

  const appBase = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.DEV_URL;
  if (appBase && (appBase.startsWith('http://') || appBase.startsWith('https://'))) {
    try {
      embed.setImage(`${appBase.replace(/\/$/, '')}/${trimmed.replace(/^\//, '')}`);
      return;
    } catch {}
  }

  // 4. Default safe fallback for Noble Phantasms
  if (trimmed.includes('np_') || trimmed.includes('anim')) {
    try {
      embed.setImage('https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif');
    } catch {}
  } else if (trimmed.includes('art') || trimmed.includes('avatar') || trimmed.includes('ce_')) {
    try {
      embed.setImage('https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500');
    } catch {}
  }
}

/**
 * Safely resolves a thumbnail URL or disk path for Discord Embeds.
 */
export function safeSetEmbedThumbnail(
  embed: EmbedBuilder,
  mediaUrl?: string | null,
  files?: (AttachmentBuilder | any)[]
): void {
  if (!mediaUrl || typeof mediaUrl !== 'string' || !embed) return;
  const trimmed = mediaUrl.trim();
  if (!trimmed) return;

  // 1. Direct valid absolute URL or existing attachment reference
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('attachment://')) {
    try {
      embed.setThumbnail(trimmed);
    } catch {}
    return;
  }

  // 2. Local relative media URL
  const diskPath = getLocalMediaDiskPath(trimmed);
  if (diskPath && fs.existsSync(diskPath)) {
    const filename = path.basename(diskPath);
    if (Array.isArray(files)) {
      const alreadyAttached = files.some(f => (f && f.name === filename) || (f && f.attachment === diskPath));
      if (!alreadyAttached) {
        files.push(new AttachmentBuilder(diskPath, { name: filename }));
      }
      try {
        embed.setThumbnail(`attachment://${filename}`);
        return;
      } catch {}
    }
  }

  const appBase = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.DEV_URL;
  if (appBase && (appBase.startsWith('http://') || appBase.startsWith('https://'))) {
    try {
      embed.setThumbnail(`${appBase.replace(/\/$/, '')}/${trimmed.replace(/^\//, '')}`);
      return;
    } catch {}
  }

  // Safe avatar fallback thumbnail
  try {
    embed.setThumbnail('https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=400');
  } catch {}
}
