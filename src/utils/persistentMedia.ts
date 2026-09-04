import fs from 'fs';
import path from 'path';
import { normalizeMediaUrl } from './mediaResolver';
import { NOBLE_PHANTASM_GIFS } from '../data/noblePhantasmGifs';

const DATA_DIR = path.join(process.cwd(), 'data');
const MEDIA_CACHE_DIR = path.join(DATA_DIR, 'media_cache');

export function ensureMediaCacheDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(MEDIA_CACHE_DIR)) {
    fs.mkdirSync(MEDIA_CACHE_DIR, { recursive: true });
  }
}

/**
 * Checks if a URL is an ephemeral Discord CDN URL that expires in 24 hours.
 */
export function isDiscordCdnUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return (
    url.includes('cdn.discordapp.com/attachments/') ||
    url.includes('media.discordapp.net/attachments/')
  );
}

/**
 * Downloads and caches a media file permanently to prevent expiration.
 * If the file is small (< 3MB), also returns a base64 Data URI so it can be saved in JSON.
 */
export async function persistMediaUrl(
  urlOrData: string,
  prefix: string = 'media'
): Promise<{ permanentUrl: string; dataUri?: string; localPath?: string; buffer?: Buffer }> {
  if (!urlOrData || typeof urlOrData !== 'string') {
    return { permanentUrl: urlOrData || '' };
  }

  const trimmed = urlOrData.trim();

  // If it's already a base64 Data URI
  if (trimmed.startsWith('data:')) {
    try {
      ensureMediaCacheDirectory();
      const matches = trimmed.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const mime = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        let ext = '.png';
        if (mime.includes('gif')) ext = '.gif';
        else if (mime.includes('jpeg') || mime.includes('jpg')) ext = '.jpg';
        else if (mime.includes('webp')) ext = '.webp';
        else if (mime.includes('mp4')) ext = '.mp4';

        const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
        const filePath = path.join(MEDIA_CACHE_DIR, filename);
        fs.writeFileSync(filePath, buffer);

        return {
          permanentUrl: trimmed,
          dataUri: trimmed,
          localPath: filePath,
          buffer
        };
      }
    } catch (err) {
      console.warn('Failed to parse base64 data URI:', err);
    }
    return { permanentUrl: trimmed, dataUri: trimmed };
  }

  // If it's a local file path
  if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.includes(MEDIA_CACHE_DIR)) {
    const fullPath = trimmed.startsWith('/') ? path.join(process.cwd(), 'public', trimmed) : trimmed;
    if (fs.existsSync(fullPath)) {
      try {
        const buffer = fs.readFileSync(fullPath);
        return {
          permanentUrl: trimmed,
          localPath: fullPath,
          buffer
        };
      } catch {}
    }
  }

  // If it's a web URL (especially Discord CDN links or image uploads)
  const isCdn = isDiscordCdnUrl(trimmed);
  const normalized = normalizeMediaUrl(trimmed);

  try {
    ensureMediaCacheDirectory();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(normalized, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FateHolyGrailWar/1.0'
      }
    });
    clearTimeout(timeout);

    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length > 100) {
        const contentType = response.headers.get('content-type') || '';
        let ext = '.gif';
        if (contentType.includes('png') || normalized.endsWith('.png')) ext = '.png';
        else if (contentType.includes('jpeg') || contentType.includes('jpg') || normalized.endsWith('.jpg')) ext = '.jpg';
        else if (contentType.includes('webp') || normalized.endsWith('.webp')) ext = '.webp';
        else if (contentType.includes('gif') || normalized.endsWith('.gif')) ext = '.gif';

        const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
        const filePath = path.join(MEDIA_CACHE_DIR, filename);
        fs.writeFileSync(filePath, buffer);

        // If file is reasonably sized (< 4MB), create a data URI so it stays permanent across all contexts
        let dataUri: string | undefined;
        if (buffer.length <= 4 * 1024 * 1024) {
          const mimeType = contentType || (ext === '.gif' ? 'image/gif' : ext === '.png' ? 'image/png' : 'image/jpeg');
          dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;
        }

        return {
          permanentUrl: dataUri || normalized,
          dataUri,
          localPath: filePath,
          buffer
        };
      }
    }
  } catch (err) {
    console.warn(`Could not cache media URL (${normalized}):`, err);
  }

  return { permanentUrl: normalized };
}

/**
 * Resolves any media specifier (URL, local file, Data URI, or Servant name) to a valid Buffer and filename
 * suitable for Discord AttachmentBuilder.
 */
export async function resolveMediaAttachment(
  mediaUrlOrName: string,
  servantName?: string,
  defaultFilename: string = 'media.gif'
): Promise<{ buffer?: Buffer; url?: string; filename: string }> {
  if (!mediaUrlOrName && !servantName) {
    return { url: 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif', filename: defaultFilename };
  }

  const raw = (mediaUrlOrName || '').trim();

  // 1. Check Data URI
  if (raw.startsWith('data:')) {
    const matches = raw.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const mime = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      let ext = '.gif';
      if (mime.includes('png')) ext = '.png';
      else if (mime.includes('jpeg') || mime.includes('jpg')) ext = '.jpg';
      return { buffer, filename: defaultFilename.replace(/\.[^.]+$/, ext) };
    }
  }

  // 2. Check Local File
  if (raw.startsWith('/') || raw.startsWith('./') || raw.includes('data/media_cache')) {
    const candidatePaths = [
      raw,
      path.join(process.cwd(), 'public', raw),
      path.join(process.cwd(), raw)
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          const buffer = fs.readFileSync(p);
          return { buffer, filename: path.basename(p) || defaultFilename };
        } catch {}
      }
    }
  }

  // 3. Try to fetch remote URL
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    const normalized = normalizeMediaUrl(raw);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(normalized, {
        signal: controller.signal,
        headers: { 'User-Agent': 'FateHolyGrailWar/1.0' }
      });
      clearTimeout(timeout);
      if (res.ok) {
        const ab = await res.arrayBuffer();
        const buffer = Buffer.from(ab);
        if (buffer.length > 200) {
          return { buffer, filename: defaultFilename };
        }
      }
    } catch (fetchErr) {
      console.warn('Direct media download failed, falling back to canonical asset:', fetchErr);
    }
  }

  // 4. Fallback to canonical Fate animations
  if (servantName) {
    for (const [key, data] of Object.entries(NOBLE_PHANTASM_GIFS)) {
      if (servantName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(servantName.toLowerCase())) {
        return { url: data.gifUrl || data.fallbackGif, filename: defaultFilename };
      }
    }
  }

  return { url: 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif', filename: defaultFilename };
}
