/**
 * Media Resolver & URL Normalizer
 * Converts web page URLs (Tenor, Giphy, Imgur, etc.) and local media routes (/api/media/...)
 * into 100% direct CDN media links that Web views and API endpoints can render reliably.
 */

// Known reliable fallbacks for canon servants and assets
export const CANON_MEDIA_FALLBACKS: Record<string, string> = {
  'np_artoria_pendragon.gif': 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
  'np_artoria_pendragon_alter.gif': 'https://ella.janitorai.com/media-approved/Ym7LYYmkmCu9hVfPEVQo8.gif',
  'Ym7LYYmkmCu9hVfPEVQo8.gif': 'https://ella.janitorai.com/media-approved/Ym7LYYmkmCu9hVfPEVQo8.gif',
  'np_gilgamesh_archer.gif': 'https://i.giphy.com/media/13cACn6mlO56kU/giphy.gif',
  'np_emiya_archer.gif': 'https://i.giphy.com/media/eBGV4n8U8k3eg/giphy.gif',
  'np_cu_chulainn_lancer.gif': 'https://ella.janitorai.com/media-approved/DBOTMhyn9kjdpSJW4xe98.gif',
  'DBOTMhyn9kjdpSJW4xe98.gif': 'https://ella.janitorai.com/media-approved/DBOTMhyn9kjdpSJW4xe98.gif',
  'np_scathach_lancer.gif': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
  'np_jeanne_darc_ruler.jpg': 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
  'np_jeanne_alter.gif': 'https://ella.janitorai.com/media-approved/kNaIxcLG_DgaLC5YsThNf.gif',
  'kNaIxcLG_DgaLC5YsThNf.gif': 'https://ella.janitorai.com/media-approved/kNaIxcLG_DgaLC5YsThNf.gif',
  'np_nero_claudius_saber.gif': 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
  'np_heracles_berserker.jpg': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
  'np_mhx_alter.gif': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
  'np_karna_lancer.gif': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
  'np_adiosa_dragon_envoy.webp': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
  'super_aoko_trans.gif': 'https://ella.janitorai.com/media-approved/gR8x0bMk-pHc95lo5mhAL.gif',
  'super_aoko_avatar.webp': 'https://ella.janitorai.com/media-approved/zUtP5PQLU7fMKVyin9H-f.webp',
  'gR8x0bMk-pHc95lo5mhAL.gif': 'https://ella.janitorai.com/media-approved/gR8x0bMk-pHc95lo5mhAL.gif',
  'zUtP5PQLU7fMKVyin9H-f.webp': 'https://ella.janitorai.com/media-approved/zUtP5PQLU7fMKVyin9H-f.webp',
  'avatar_amamiya_no_chihaya_tenkohime.webp': 'https://ella.janitorai.com/media-approved/mskYeY2nC1pcPzEcW_nTK.webp',
  'np_amamiya_no_chihaya_tenkohime.webp': 'https://ella.janitorai.com/media-approved/Sfp4i7TL2cXu0LS-QZxxX.webp',
  'mskYeY2nC1pcPzEcW_nTK.webp': 'https://ella.janitorai.com/media-approved/mskYeY2nC1pcPzEcW_nTK.webp',
  'Sfp4i7TL2cXu0LS-QZxxX.webp': 'https://ella.janitorai.com/media-approved/Sfp4i7TL2cXu0LS-QZxxX.webp',
  'avatar_lucia_lyozes.webp': 'https://ella.janitorai.com/media-approved/2PMVd98BaN6Rc9lzVnWyn.webp',
  '2PMVd98BaN6Rc9lzVnWyn.webp': 'https://ella.janitorai.com/media-approved/2PMVd98BaN6Rc9lzVnWyn.webp',
  'np_lucia_lyozes.gif': 'https://ella.janitorai.com/media-approved/v4h_m7mQL9PwjTmQb_7fg.gif',
  'v4h_m7mQL9PwjTmQb_7fg.gif': 'https://ella.janitorai.com/media-approved/v4h_m7mQL9PwjTmQb_7fg.gif',
  'avatar_luvria_greenharte.webp': 'https://ella.janitorai.com/media-approved/II1DtB1YFFjXHKcs8gU7q.webp',
  'II1DtB1YFFjXHKcs8gU7q.webp': 'https://ella.janitorai.com/media-approved/II1DtB1YFFjXHKcs8gU7q.webp',
  'np_luvria_greenharte.webp': 'https://ella.janitorai.com/media-approved/eq0tPcLuV5PXGDg53sgS1.webp',
  'eq0tPcLuV5PXGDg53sgS1.webp': 'https://ella.janitorai.com/media-approved/eq0tPcLuV5PXGDg53sgS1.webp',
  'sprite_luvria_greenharte.webp': 'https://ella.janitorai.com/media-approved/k_aK4SaC3HJVRNxDuMU13.webp',
  'k_aK4SaC3HJVRNxDuMU13.webp': 'https://ella.janitorai.com/media-approved/k_aK4SaC3HJVRNxDuMU13.webp',
  'avatar_artoria_caster.webp': 'https://ella.janitorai.com/media-approved/fuzEz7ZBldGAP68c2bNJu.webp',
  'fuzEz7ZBldGAP68c2bNJu.webp': 'https://ella.janitorai.com/media-approved/fuzEz7ZBldGAP68c2bNJu.webp',
  'np_artoria_caster.gif': 'https://ella.janitorai.com/media-approved/FYGW6q4NCQ9bgeLMeOvCH.gif',
  'FYGW6q4NCQ9bgeLMeOvCH.gif': 'https://ella.janitorai.com/media-approved/FYGW6q4NCQ9bgeLMeOvCH.gif',
  'sprite_artoria_caster.webp': 'https://ella.janitorai.com/media-approved/jJ01B75AlmqdBUUK3JEfa.webp',
  'jJ01B75AlmqdBUUK3JEfa.webp': 'https://ella.janitorai.com/media-approved/jJ01B75AlmqdBUUK3JEfa.webp',
  'ce_bond_artoria_caster.webp': 'https://ella.janitorai.com/media-approved/M_CtKrPvwydKIhD_A27Aq.webp',
  'M_CtKrPvwydKIhD_A27Aq.webp': 'https://ella.janitorai.com/media-approved/M_CtKrPvwydKIhD_A27Aq.webp',
  'holy_grail_ritual.webp': 'https://ella.janitorai.com/media-approved/mK-ekdLeM4n1Wb-_vRN4L.webp',
  'mK-ekdLeM4n1Wb-_vRN4L.webp': 'https://ella.janitorai.com/media-approved/mK-ekdLeM4n1Wb-_vRN4L.webp',
  'avatar_typhon_ephemeros.webp': 'https://ella.janitorai.com/media-approved/kQzECU4XQGSezfzr6mOWo.webp',
  'kQzECU4XQGSezfzr6mOWo.webp': 'https://ella.janitorai.com/media-approved/kQzECU4XQGSezfzr6mOWo.webp',
  'np_typhon_ephemeros.gif': 'https://ella.janitorai.com/media-approved/WueTnw4QfurHe53DsTV-z.gif',
  'WueTnw4QfurHe53DsTV-z.gif': 'https://ella.janitorai.com/media-approved/WueTnw4QfurHe53DsTV-z.gif',
  'sprite_typhon_ephemeros.webp': 'https://ella.janitorai.com/media-approved/OP7PiFQNT0RNCbGEyVNTY.webp',
  'OP7PiFQNT0RNCbGEyVNTY.webp': 'https://ella.janitorai.com/media-approved/OP7PiFQNT0RNCbGEyVNTY.webp',
  'ce_bond_typhon_ephemeros.webp': 'https://ella.janitorai.com/media-approved/ooE7jWZ7K8iyxc9WJF21f.webp',
  'ooE7jWZ7K8iyxc9WJF21f.webp': 'https://ella.janitorai.com/media-approved/ooE7jWZ7K8iyxc9WJF21f.webp',
  'ce_bond_edmond.webp': 'https://ella.janitorai.com/media-approved/6tOCZiZo0xbTRAFmf85h5.webp',
  'ce_bond_van_gogh.webp': 'https://ella.janitorai.com/media-approved/-S9y-H-REfRKPTBMJUKxp.webp',
  'ce_bond_artoria_pendragon.webp': '/api/media/ce_bond_artoria_pendragon.webp',
  'ce_bond_gilgamesh_archer.webp': '/api/media/ce_bond_gilgamesh_archer.webp',
  'ce_bond_scathach_lancer.webp': '/api/media/ce_bond_scathach_lancer.webp',
  'ce_bond_jeanne_darc_ruler.webp': '/api/media/ce_bond_jeanne_darc_ruler.webp',
  'ce_bond_jeanne_alter.webp': '/api/media/ce_bond_jeanne_alter.webp',
  'ce_bond_mhx_alter.webp': '/api/media/ce_bond_mhx_alter.webp',
  'ce_bond_artoria_pendragon_alter.webp': '/api/media/ce_bond_artoria_pendragon_alter.webp',
  'ce_bond_nero_claudius_saber.webp': '/api/media/ce_bond_nero_claudius_saber.webp',
  'ce_bond_emiya_archer.webp': '/api/media/ce_bond_emiya_archer.webp',
  'ce_bond_cu_chulainn_lancer.webp': '/api/media/ce_bond_cu_chulainn_lancer.webp',
  'ce_bond_karna_lancer.webp': '/api/media/ce_bond_karna_lancer.webp',
  'ce_bond_aoko_aozaki.webp': '/api/media/ce_bond_aoko_aozaki.webp',
  'ce_limited_zero_over.webp': '/api/media/ce_limited_zero_over.webp',
  'ce_volumen_hydragyrum.webp': '/api/media/ce_volumen_hydragyrum.webp',
  'ce_origin_bullet.webp': '/api/media/ce_origin_bullet.webp',
  'ce_imaginary_element.webp': '/api/media/ce_imaginary_element.webp',
  'ce_gandr.webp': '/api/media/ce_gandr.webp',
  'ce_projection.webp': '/api/media/ce_projection.webp',
  'ce_verdant_sound.webp': '/api/media/ce_verdant_sound.webp',
  'ce_code_cast.webp': '/api/media/ce_code_cast.webp',
  'ce_when_the_flowers_fall.webp': '/api/media/ce_when_the_flowers_fall.webp',
  'ce_dragon_meridian.png': '/api/media/ce_dragon_meridian.png',
  'ce_jeweled_sword.webp': '/api/media/ce_jeweled_sword.webp',
  'ce_hydra_dagger.webp': '/api/media/ce_hydra_dagger.webp',
  'ce_formal_craft.webp': '/api/media/ce_formal_craft.webp',
  'ce_fragment_2030.webp': '/api/media/ce_fragment_2030.webp',
  'ce_kaleidoscope.webp': '/api/media/ce_kaleidoscope.webp',
  'ce_black_grail.webp': '/api/media/ce_black_grail.webp',
  'ce_imaginary_around.webp': '/api/media/ce_imaginary_around.webp',
  'ce_heavens_feel.webp': '/api/media/ce_heavens_feel.webp',
  'ce_prisma_cosmos.webp': '/api/media/ce_prisma_cosmos.webp',
  'ce_castle_of_snow.webp': '/api/media/ce_castle_of_snow.webp'
};

const WIKIA_FILE_MAP: Record<string, string> = {
  'ce33.webp': '/api/media/ce_limited_zero_over.webp',
  'ce185.webp': '/api/media/ce_volumen_hydragyrum.webp',
  'ce263.webp': '/api/media/ce_origin_bullet.webp',
  'ce28.webp': '/api/media/ce_imaginary_element.webp',
  'ce24.webp': '/api/media/ce_gandr.webp',
  'ce23.webp': '/api/media/ce_projection.webp',
  'ce25.webp': '/api/media/ce_verdant_sound.webp',
  'ce56.webp': '/api/media/ce_code_cast.webp',
  'ce2470.webp': '/api/media/ce_when_the_flowers_fall.webp',
  'fgocefull_9400180a.png': '/api/media/ce_dragon_meridian.png',
  'ce247.webp': '/api/media/ce_jeweled_sword.webp',
  'ce333.webp': '/api/media/ce_hydra_dagger.webp',
  'ce31.webp': '/api/media/ce_formal_craft.webp',
  'ce67.webp': '/api/media/ce_fragment_2030.webp',
  'ce191.webp': '/api/media/ce_bond_artoria_pendragon.webp',
  'ce216.webp': '/api/media/ce_bond_gilgamesh_archer.webp',
  'ce251.webp': '/api/media/ce_bond_scathach_lancer.webp',
  'ce194.webp': '/api/media/ce_bond_jeanne_darc_ruler.webp',
  'ce350.webp': '/api/media/ce_bond_jeanne_alter.webp',
  'ce429.webp': '/api/media/ce_bond_mhx_alter.webp',
  'ce195.webp': '/api/media/ce_bond_artoria_pendragon_alter.webp',
  'ce218.webp': '/api/media/ce_bond_nero_claudius_saber.webp',
  'ce196.webp': '/api/media/ce_bond_emiya_archer.webp',
  'ce252.webp': '/api/media/ce_bond_cu_chulainn_lancer.webp',
  'ce283.webp': '/api/media/ce_bond_karna_lancer.webp',
  'ce2048.webp': '/api/media/ce_bond_aoko_aozaki.webp'
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
    if (trimmed.startsWith('/media/')) {
      return `/api/media/${trimmed.replace(/^\/media\//, '')}`;
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
      '21175659': 'https://ella.janitorai.com/media-approved/Ym7LYYmkmCu9hVfPEVQo8.gif', // Saber Alter Excalibur Morgan
      '18237937': 'https://i.giphy.com/media/eBGV4n8U8k3eg/giphy.gif', // EMIYA UBW
      '19717144': 'https://ella.janitorai.com/media-approved/DBOTMhyn9kjdpSJW4xe98.gif', // Cu Chulainn Gae Bolg
      '18698126': 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif', // Scathach Gae Bolg Alt
      '18921827': 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif', // Jeanne Luminosite
      '17865181': 'https://ella.janitorai.com/media-approved/kNaIxcLG_DgaLC5YsThNf.gif', // Jalter Grondement
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

  // 5. Handle Wikia / Fandom URLs (Prevent 403 Forbidden blocks)
  if (trimmed.includes('wikia.nocookie.net') || trimmed.includes('fandom.com')) {
    const cleanWikia = trimmed.replace(/\/revision\/latest.*$/i, '').split('?')[0];
    const filename = cleanWikia.split('/').pop()?.toLowerCase() || '';
    if (WIKIA_FILE_MAP[filename]) {
      return WIKIA_FILE_MAP[filename];
    }
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
    lower.includes('wikia.nocookie.net') ||
    lower.includes('janitorai.com')
  );
}
