// High-impact Noble Phantasm Animated Cinematic URLs
// These represent the iconic ultimate move activations from the Fate anime franchise.

import { normalizeMediaUrl } from '../utils/mediaResolver';

// Custom NP animations registry (safe across both client-side React and server-side runtimes)
export const CUSTOM_NP_ANIMATIONS_REGISTRY: Record<string, { gifUrl: string; chant?: string }> = {};

export function setCustomNpAnimationInMemory(idOrName: string, anim: { gifUrl: string; chant?: string }) {
  if (!idOrName) return;
  const normalizedGif = normalizeMediaUrl(anim.gifUrl);
  CUSTOM_NP_ANIMATIONS_REGISTRY[idOrName.toLowerCase()] = {
    ...anim,
    gifUrl: normalizedGif
  };
}

export function setCustomNpAnimationsBatch(anims: Record<string, { gifUrl: string; chant?: string }>) {
  if (!anims) return;
  for (const [k, v] of Object.entries(anims)) {
    CUSTOM_NP_ANIMATIONS_REGISTRY[k.toLowerCase()] = {
      ...v,
      gifUrl: normalizeMediaUrl(v.gifUrl)
    };
  }
}

export const NOBLE_PHANTASM_GIFS: Record<string, { gifUrl: string; fallbackGif: string; chant: string }> = {
  'Artoria Pendragon': {
    gifUrl: 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
    fallbackGif: 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
    chant: 'Gathered breath of the planet, torrential light of life... EX---CALIBUR!'
  },
  'Artoria Pendragon (Alter)': {
    gifUrl: 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
    fallbackGif: 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
    chant: 'Hammer of the vile king, shatter the aurora... Swallow the light! EXCALIBUR MORGAN!'
  },
  'Gilgamesh': {
    gifUrl: 'https://i.giphy.com/media/13cACn6mlO56kU/giphy.gif',
    fallbackGif: 'https://i.giphy.com/media/13cACn6mlO56kU/giphy.gif',
    chant: 'I speak of the beginning... Heaven and Earth split, and nothingness congratulated creation! ENUMA ELISH!'
  },
  'EMIYA': {
    gifUrl: 'https://i.giphy.com/media/eBGV4n8U8k3eg/giphy.gif',
    fallbackGif: 'https://i.giphy.com/media/eBGV4n8U8k3eg/giphy.gif',
    chant: 'I am the bone of my sword. Steel is my body, and fire is my blood... UNLIMITED BLADE WORKS!'
  },
  'Cú Chulainn': {
    gifUrl: 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
    fallbackGif: 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
    chant: 'Your heart is mine! Soar and pierce through the fated heart... GÁE BOLG!'
  },
  'Scáthach': {
    gifUrl: 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
    fallbackGif: 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
    chant: 'Pierce through, thrust of sure mortality! GÁE BOLG ALTERNATIVE!'
  },
  'Jeanne d\'Arc': {
    gifUrl: 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
    fallbackGif: 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
    chant: 'My God is here with me! Holy banner, shield our faithful spirits! LUMINOSITÉ ETERNELLE!'
  },
  'Jeanne d\'Arc (Alter)': {
    gifUrl: 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
    fallbackGif: 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
    chant: 'Burn away to charred ash! This is the scream of my soul turned to roaring wrath! LA GRONDEMENT DU HAINE!'
  },
  'Nero Claudius': {
    gifUrl: 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
    fallbackGif: 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
    chant: 'Witness the glory of the Golden Theater! Open the curtain, bloom in full resplendence! LAUS SAINT CLAUDIUS!'
  },
  'Heracles': {
    gifUrl: 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
    fallbackGif: 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
    chant: 'ROOOOOOAAARGH! Shooting the hundred heads in an unceasing barrage! NINE LIVES!'
  },
  'Mysterious Heroine X (Alter)': {
    gifUrl: 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
    fallbackGif: 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
    chant: 'Darkness and sweets converge... Twin black dragon blades, severance of all Sabers! CROSS-CALIBUR!'
  }
};

const DEFAULT_NP_GIF = 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif';
const DEFAULT_NP_FALLBACK = 'https://i.giphy.com/media/13cACn6mlO56kU/giphy.gif';

/**
 * Returns a high quality GIF / animation link for a Servant's Noble Phantasm
 */
export function getNoblePhantasmGif(servantOrTemplate: any): string {
  if (!servantOrTemplate) return DEFAULT_NP_GIF;

  // 1. Check direct servant template configuration
  const np = servantOrTemplate.noblePhantasm || servantOrTemplate.template?.noblePhantasm;
  if (np?.gifUrl && np.gifUrl.trim()) return normalizeMediaUrl(np.gifUrl.trim());
  if (np?.animationUrl && np.animationUrl.trim()) return normalizeMediaUrl(np.animationUrl.trim());

  // 2. Check admin-configured custom NP animation registry
  const servantId = (servantOrTemplate.id || servantOrTemplate.templateId || servantOrTemplate.template?.id || '').toLowerCase();
  const rawName = (servantOrTemplate.name || servantOrTemplate.template?.name || '').toLowerCase();
  if (servantId && CUSTOM_NP_ANIMATIONS_REGISTRY[servantId]?.gifUrl) {
    return normalizeMediaUrl(CUSTOM_NP_ANIMATIONS_REGISTRY[servantId].gifUrl);
  }
  if (rawName && CUSTOM_NP_ANIMATIONS_REGISTRY[rawName]?.gifUrl) {
    return normalizeMediaUrl(CUSTOM_NP_ANIMATIONS_REGISTRY[rawName].gifUrl);
  }

  // 3. Match against known canon Servant registry
  for (const [key, data] of Object.entries(NOBLE_PHANTASM_GIFS)) {
    if (rawName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(rawName.toLowerCase())) {
      return normalizeMediaUrl(data.gifUrl || data.fallbackGif);
    }
  }

  // 4. Check matching by NP name
  const npName = np?.name || '';
  if (npName) {
    const lowerNp = npName.toLowerCase();
    if (lowerNp.includes('excalibur morgan')) {
      return NOBLE_PHANTASM_GIFS['Artoria Pendragon (Alter)'].gifUrl;
    }
    if (lowerNp.includes('excalibur')) {
      return NOBLE_PHANTASM_GIFS['Artoria Pendragon'].gifUrl;
    }
    if (lowerNp.includes('enuma elish') || lowerNp.includes('gate of babylon')) {
      return NOBLE_PHANTASM_GIFS['Gilgamesh'].gifUrl;
    }
    if (lowerNp.includes('blade works')) {
      return NOBLE_PHANTASM_GIFS['EMIYA'].gifUrl;
    }
    if (lowerNp.includes('gae bolg') || lowerNp.includes('gáe bolg')) {
      return NOBLE_PHANTASM_GIFS['Cú Chulainn'].gifUrl;
    }
    if (lowerNp.includes('grondement')) {
      return NOBLE_PHANTASM_GIFS['Jeanne d\'Arc (Alter)'].gifUrl;
    }
    if (lowerNp.includes('luminosité') || lowerNp.includes('luminosite')) {
      return NOBLE_PHANTASM_GIFS['Jeanne d\'Arc'].gifUrl;
    }
  }

  return DEFAULT_NP_GIF;
}

/**
 * Returns the incantation / chant of the Noble Phantasm
 */
export function getNoblePhantasmChant(servantOrTemplate: any): string {
  if (!servantOrTemplate) return 'True Name Unleashed!';
  const custom = servantOrTemplate.customQuotes?.noblePhantasm;
  if (custom) return custom;

  // Check admin custom config
  const servantId = (servantOrTemplate.id || servantOrTemplate.templateId || servantOrTemplate.template?.id || '').toLowerCase();
  const rawName = (servantOrTemplate.name || servantOrTemplate.template?.name || '').toLowerCase();
  if (servantId && CUSTOM_NP_ANIMATIONS_REGISTRY[servantId]?.chant) {
    return CUSTOM_NP_ANIMATIONS_REGISTRY[servantId].chant!;
  }
  if (rawName && CUSTOM_NP_ANIMATIONS_REGISTRY[rawName]?.chant) {
    return CUSTOM_NP_ANIMATIONS_REGISTRY[rawName].chant!;
  }

  const np = servantOrTemplate.noblePhantasm || servantOrTemplate.template?.noblePhantasm;
  if (np?.chant) return np.chant;

  for (const [key, data] of Object.entries(NOBLE_PHANTASM_GIFS)) {
    if (rawName.toLowerCase().includes(key.toLowerCase())) {
      return data.chant;
    }
  }

  return 'True Name Unleashed — Receive the full divine power of this Heroic Spirit!';
}
