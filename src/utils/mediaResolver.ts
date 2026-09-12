/**
 * Media Resolver & URL Normalizer
 * Converts web page URLs (Tenor, Giphy, Imgur, etc.) and local media routes (/api/media/...)
 * into 100% direct CDN media links that Web views and API endpoints can render reliably.
 */

// Known reliable fallbacks for canon servants and assets
export const CANON_MEDIA_FALLBACKS: Record<string, string> = {
  'np_artoria_pendragon.gif': 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
  'np_artoria_pendragon_alter.gif': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
  'np_gilgamesh_archer.gif': 'https://i.giphy.com/media/13cACn6mlO56kU/giphy.gif',
  'np_emiya_archer.gif': 'https://i.giphy.com/media/eBGV4n8U8k3eg/giphy.gif',
  'np_cu_chulainn_lancer.gif': 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
  'np_scathach_lancer.gif': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
  'np_jeanne_darc_ruler.jpg': 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
  'np_jeanne_alter.gif': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
  'np_nero_claudius_saber.gif': 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
  'np_heracles_berserker.jpg': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
  'np_mhx_alter.gif': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
  'np_karna_lancer.gif': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
  'np_adiosa_dragon_envoy.webp': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
  'super_aoko_trans.gif': 'https://ella.janitorai.com/media-approved/gR8x0bMk-pHc95lo5mhAL.gif',
  'super_aoko_avatar.webp': 'https://ella.janitorai.com/media-approved/zUtP5PQLU7fMKVyin9H-f.webp',
  'gR8x0bMk-pHc95lo5mhAL.gif': 'https://ella.janitorai.com/media-approved/gR8x0bMk-pHc95lo5mhAL.gif',
  'zUtP5PQLU7fMKVyin9H-f.webp': 'https://ella.janitorai.com/media-approved/zUtP5PQLU7fMKVyin9H-f.webp'
};

export function normalizeMediaUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();

  // 0. Handle Local / Relative Media URLs
  if (
    trimmed.startsWith('/api/media/') ||
    trimmed.startsWith('/media/') ||
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('data/media/') ||
    trimmed.startsWith('data/media_cache/') ||
    trimmed.startsWith('file://')
  ) {
    if (trimmed.startsWith('data/media/')) {
      return `/api/media/${trimmed.replace(/^data\/media\//, '')}`;
    }
    return trimmed;
  }

  // 1. Handle Giphy URLs
  if (trimmed.includes('giphy.com/gifs/')) {
    const parts = trimmed.split('giphy.com/gifs/')[1].split('?')[0].split('/');
    const lastPart = parts[0];
    const id = lastPart.includes('-') ? lastPart.split('-').pop()! : lastPart;
    if (id) {
      return `https://i.giphy.com/media/${id}/giphy.gif`;
    }
  } else if (trimmed.includes('media.giphy.com/media/') || trimmed.includes('i.giphy.com/media/') || trimmed.includes('i.giphy.com/')) {
    const match = trimmed.match(/giphy\.com\/(?:media\/)?([a-zA-Z0-9_-]+)/);
    if (match && match[1] && !match[1].endsWith('.gif')) {
      const cleanId = match[1].replace(/\/.*$/, '');
      return `https://i.giphy.com/media/${cleanId}/giphy.gif`;
    }
  }

  // 2. Handle Imgur URLs
  if (trimmed.includes('imgur.com/')) {
    const match = trimmed.match(/imgur\.com\/(?:gallery\/|a\/|r\/[^/]+\/)?([a-zA-Z0-9]+)/);
    if (match && match[1]) {
      const id = match[1];
      if (!trimmed.endsWith('.gif') && !trimmed.endsWith('.png') && !trimmed.endsWith('.jpg') && !trimmed.endsWith('.mp4') && !trimmed.endsWith('.webp')) {
        return `https://i.imgur.com/${id}.gif`;
      }
    }
  }

  // 3. Handle Tenor URLs
  if (trimmed.includes('media.tenor.com') || trimmed.includes('media1.tenor.com') || trimmed.includes('c.tenor.com')) {
    return trimmed;
  }

  if (trimmed.includes('tenor.com/view/')) {
    const match = trimmed.match(/-([0-9]+)$/) || trimmed.match(/([0-9]+)\/?$/);
    const tenorId = match ? match[1] : '';
    
    const TENOR_FATE_MAP: Record<string, string> = {
      '18115682': 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif', // Saber Excalibur
      '21175659': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif', // Saber Alter Excalibur Morgan
      '18237937': 'https://i.giphy.com/media/eBGV4n8U8k3eg/giphy.gif', // EMIYA UBW
      '19717144': 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif', // Cu Chulainn Gae Bolg
      '18698126': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif', // Scathach Gae Bolg Alt
      '18921827': 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif', // Jeanne Luminosite
      '17865181': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif', // Jalter Grondement
      '18238122': 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif', // Nero Laus Saint Claudius
      '20516422': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif', // Heracles Nine Lives
      '19283719': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif', // MHXA Cross-Calibur
    };

    if (tenorId && TENOR_FATE_MAP[tenorId]) {
      return TENOR_FATE_MAP[tenorId];
    }
  }

  // 4. Handle Catbox URLs
  if (trimmed.includes('catbox.moe/')) {
    if (!trimmed.startsWith('https://files.catbox.moe/')) {
      const match = trimmed.match(/catbox\.moe\/([a-zA-Z0-9_\-]+\.(?:gif|png|jpg|jpeg|webp|mp4))/i);
      if (match && match[1]) {
        return `https://files.catbox.moe/${match[1]}`;
      }
    }
  }

  // 5. Handle Wikia / Fandom URLs
  if (trimmed.includes('wikia.nocookie.net')) {
    const cleanWikia = trimmed.replace(/\/revision\/latest.*$/i, '').split('?')[0];
    return cleanWikia;
  }

  // 6. Return sanitized URL
  return trimmed;
}

/**
 * Validates whether a URL is a direct media file suitable for Discord Embed .setImage()
 */
export function isDirectEmbeddableMedia(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.startsWith('/api/media/') || lower.startsWith('/media/') || lower.startsWith('/uploads/') || lower.startsWith('data/media/')) {
    return true;
  }
  if (lower.includes('tenor.com/view/')) return false;
  if (lower.includes('giphy.com/gifs/') && !lower.includes('i.giphy.com') && !lower.includes('media.giphy.com')) return false;
  return (
    lower.endsWith('.gif') ||
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.webp') ||
    lower.includes('i.giphy.com') ||
    lower.includes('media.giphy.com') ||
    lower.includes('media1.tenor.com') ||
    lower.includes('media.tenor.com') ||
    lower.includes('c.tenor.com') ||
    lower.includes('i.imgur.com') ||
    lower.includes('files.catbox.moe') ||
    lower.includes('wikia.nocookie.net')
  );
}
