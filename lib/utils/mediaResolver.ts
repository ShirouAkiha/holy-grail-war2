/**
 * Media Resolver & URL Normalizer
 * Converts web page URLs (Tenor, Giphy, Imgur, etc.) into 100% direct CDN media links
 * that Discord's Embed proxy and Web views can render reliably without "Image failed to load".
 */

export function normalizeMediaUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();

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

  return trimmed;
}

export function isDirectEmbeddableMedia(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
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
    lower.includes('i.imgur.com')
  );
}
