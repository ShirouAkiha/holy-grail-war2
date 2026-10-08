import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { getLocalMediaDiskPath } from './localMedia';
import { CANON_MEDIA_FALLBACKS } from './mediaResolver';
import path from 'path';
import fs from 'fs';

// Map of known Wikia / external filenames to cached local filenames in data/media
const EXTERNAL_TO_LOCAL_MAP: Record<string, string> = {
  'ce33.webp': 'ce_limited_zero_over.webp',
  'ce185.webp': 'ce_volumen_hydragyrum.webp',
  'ce263.webp': 'ce_origin_bullet.webp',
  'ce28.webp': 'ce_imaginary_element.webp',
  'ce24.webp': 'ce_gandr.webp',
  'ce23.webp': 'ce_projection.webp',
  'ce25.webp': 'ce_verdant_sound.webp',
  'ce56.webp': 'ce_code_cast.webp',
  'ce2470.webp': 'ce_when_the_flowers_fall.webp',
  'fgocefull_9400180a.png': 'ce_dragon_meridian.png',
  'ce247.webp': 'ce_jeweled_sword.webp',
  'ce333.webp': 'ce_hydra_dagger.webp',
  'ce31.webp': 'ce_formal_craft.webp',
  'ce67.webp': 'ce_fragment_2030.webp',
  'ce191.webp': 'ce_bond_artoria_pendragon.webp',
  'ce216.webp': 'ce_bond_gilgamesh_archer.webp',
  'ce251.webp': 'ce_bond_scathach_lancer.webp',
  'ce194.webp': 'ce_bond_jeanne_darc_ruler.webp',
  'ce350.webp': 'ce_bond_jeanne_alter.webp',
  'ce429.webp': 'ce_bond_mhx_alter.webp',
  'ce195.webp': 'ce_bond_artoria_pendragon_alter.webp',
  'ce218.webp': 'ce_bond_nero_claudius_saber.webp',
  'ce196.webp': 'ce_bond_emiya_archer.webp',
  'ce252.webp': 'ce_bond_cu_chulainn_lancer.webp',
  'ce283.webp': 'ce_bond_karna_lancer.webp',
  'ce2048.webp': 'ce_bond_aoko_aozaki.webp',
  'ce248.webp': 'ce_bond_tamamo_no_mae.webp',
};

/**
 * Safely resolves a media URL or disk path for Discord Embeds.
 * Guarantees that Discord.js EmbedBuilder never throws a URL validation error.
 * If local file exists and files array is provided, attaches it seamlessly!
 * Protects against Cloudflare 403 blocks from Wikia/Fandom by routing to local cached media.
 */
export function safeSetEmbedImage(
  embed: EmbedBuilder,
  mediaUrl?: string | null,
  files?: (AttachmentBuilder | any)[]
): void {
  if (!mediaUrl || typeof mediaUrl !== 'string' || !embed) return;
  const trimmed = mediaUrl.trim();
  if (!trimmed) return;

  // 1. Direct attachment reference
  if (trimmed.startsWith('attachment://')) {
    try {
      embed.setImage(trimmed);
    } catch {}
    return;
  }

  // 2. Check if this is a Wikia URL or has a known local cached counterpart
  const isWikia = trimmed.includes('wikia.nocookie.net') || trimmed.includes('fandom.com');
  const cleanPath = trimmed.split('?')[0].replace(/\/revision\/latest.*$/i, '');
  const rawBasename = path.basename(cleanPath).toLowerCase();
  const mappedLocalName = EXTERNAL_TO_LOCAL_MAP[rawBasename] || rawBasename;

  // 3. Try to find local disk file (handles /api/media/..., data/media/..., mapped Wikia filenames, etc.)
  const diskPath = getLocalMediaDiskPath(trimmed) || getLocalMediaDiskPath(mappedLocalName);
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

    const appBase = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.DEV_URL || 'http://localhost:3000';
    if (appBase && (appBase.startsWith('http://') || appBase.startsWith('https://'))) {
      try {
        embed.setImage(`${appBase.replace(/\/$/, '')}/api/media/${filename}`);
        return;
      } catch {}
    }
  }

  // 4. If Wikia URL and no local disk file found yet, do NOT let Discord hit 403 Forbidden
  if (isWikia) {
    const appBase = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.DEV_URL || 'http://localhost:3000';
    if (appBase && (appBase.startsWith('http://') || appBase.startsWith('https://'))) {
      try {
        embed.setImage(`${appBase.replace(/\/$/, '')}/api/media/${mappedLocalName}`);
        return;
      } catch {}
    }
  }

  // 5. Direct valid absolute URL (for non-wikia domains like ella.janitorai.com, img.gamepress.gg, i.giphy.com)
  if (!isWikia && (trimmed.startsWith('http://') || trimmed.startsWith('https://'))) {
    try {
      embed.setImage(trimmed);
    } catch {}
    return;
  }

  // 6. Fallback resolution if files array not supplied or unattached
  const baseFilename = path.basename(trimmed);
  if (CANON_MEDIA_FALLBACKS[baseFilename]) {
    try {
      embed.setImage(CANON_MEDIA_FALLBACKS[baseFilename]);
      return;
    } catch {}
  }

  const appBase = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.DEV_URL || 'http://localhost:3000';
  if (appBase && (appBase.startsWith('http://') || appBase.startsWith('https://'))) {
    try {
      embed.setImage(`${appBase.replace(/\/$/, '')}/${trimmed.replace(/^\//, '')}`);
      return;
    } catch {}
  }

  // 7. Default safe fallback for Noble Phantasms or CEs
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
 * Permanently disabled: Discord top-right thumbnails severely squish description/lore text on mobile.
 * By keeping safeSetEmbedThumbnail a complete no-op, all embeds remain 100% full-width.
 */
export function safeSetEmbedThumbnail(
  embed: EmbedBuilder,
  mediaUrl?: string | null,
  files?: (AttachmentBuilder | any)[]
): void {
  // Permanently disabled: No-op to keep Discord embeds full-width without text squishing.
  return;
}
