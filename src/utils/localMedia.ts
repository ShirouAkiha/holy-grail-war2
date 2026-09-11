import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const MEDIA_DIR = path.join(DATA_DIR, 'media');
const PUBLIC_MEDIA_DIR = path.join(process.cwd(), 'public', 'media');

export function ensureMediaDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }
  if (!fs.existsSync(PUBLIC_MEDIA_DIR)) {
    fs.mkdirSync(PUBLIC_MEDIA_DIR, { recursive: true });
  }
}

export function isLocalMediaUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return (
    trimmed.startsWith('/api/media/') ||
    trimmed.startsWith('/media/') ||
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('data/media/') ||
    trimmed.startsWith('file://')
  );
}

export function getLocalMediaDiskPath(urlOrFilename: string): string | null {
  if (!urlOrFilename) return null;
  ensureMediaDirectories();

  let cleanName = urlOrFilename.trim();
  cleanName = cleanName.replace(/^\/api\/media\//, '').replace(/^\/media\//, '').replace(/^data\/media\//, '');
  const basename = path.basename(cleanName);

  const candidates = [
    path.join(MEDIA_DIR, cleanName),
    path.join(MEDIA_DIR, basename),
    path.join(PUBLIC_MEDIA_DIR, cleanName),
    path.join(PUBLIC_MEDIA_DIR, basename),
    path.join(DATA_DIR, 'media_cache', basename),
    path.join(process.cwd(), 'public', 'uploads', basename)
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

export function saveLocalMediaBuffer(buffer: Buffer, filename: string): string {
  ensureMediaDirectories();
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const targetDataPath = path.join(MEDIA_DIR, safeFilename);
  const targetPublicPath = path.join(PUBLIC_MEDIA_DIR, safeFilename);

  fs.writeFileSync(targetDataPath, buffer);
  try {
    fs.writeFileSync(targetPublicPath, buffer);
  } catch {}

  return `/api/media/${safeFilename}`;
}

export async function downloadMediaToLocal(
  url: string,
  preferredName: string,
  timeoutMs = 12000
): Promise<string> {
  if (!url || typeof url !== 'string') return url;
  if (isLocalMediaUrl(url)) return url;

  ensureMediaDirectories();
  const safePrefix = preferredName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,video/*,*/*;q=0.8',
        'Referer': url.includes('wikia.nocookie.net') ? 'https://fategrandorder.fandom.com/' : url
      }
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[LocalMedia] Failed to download remote media from ${url} (status: ${res.status})`);
      return url;
    }

    const contentType = res.headers.get('content-type') || '';
    let ext = '.gif';
    if (contentType.includes('webp')) ext = '.webp';
    else if (contentType.includes('png')) ext = '.png';
    else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';
    else if (contentType.includes('mp4')) ext = '.mp4';
    else if (contentType.includes('webm')) ext = '.webm';
    else {
      // try deduce from url
      const urlExt = path.extname(new URL(url).pathname).toLowerCase();
      if (['.gif', '.png', '.jpg', '.jpeg', '.webp', '.mp4', '.webm'].includes(urlExt)) {
        ext = urlExt;
      }
    }

    const filename = `${safePrefix}${ext}`;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > 0) {
      return saveLocalMediaBuffer(buffer, filename);
    }
  } catch (err: any) {
    console.warn(`[LocalMedia] Error downloading ${url}:`, err.message);
  }

  return url;
}
