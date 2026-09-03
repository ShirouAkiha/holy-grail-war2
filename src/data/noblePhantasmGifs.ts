// High-impact Noble Phantasm Animated Cinematic URLs
// These represent the iconic ultimate move activations from the Fate anime franchise.

// Custom NP animations registry (safe across both client-side React and server-side runtimes)
export const CUSTOM_NP_ANIMATIONS_REGISTRY: Record<string, { gifUrl: string; chant?: string }> = {};

export function setCustomNpAnimationInMemory(idOrName: string, anim: { gifUrl: string; chant?: string }) {
  if (!idOrName) return;
  CUSTOM_NP_ANIMATIONS_REGISTRY[idOrName.toLowerCase()] = anim;
}

export function setCustomNpAnimationsBatch(anims: Record<string, { gifUrl: string; chant?: string }>) {
  if (!anims) return;
  for (const [k, v] of Object.entries(anims)) {
    CUSTOM_NP_ANIMATIONS_REGISTRY[k.toLowerCase()] = v;
  }
}

export const NOBLE_PHANTASM_GIFS: Record<string, { gifUrl: string; fallbackGif: string; chant: string }> = {
  'Artoria Pendragon': {
    gifUrl: 'https://media.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
    fallbackGif: 'https://tenor.com/view/fate-saber-excalibur-noble-phantasm-gif-18115682',
    chant: 'Gathered breath of the planet, torrential light of life... EX---CALIBUR!'
  },
  'Artoria Pendragon (Alter)': {
    gifUrl: 'https://media.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
    fallbackGif: 'https://tenor.com/view/saber-alter-excalibur-morgan-fate-stay-night-heavens-feel-gif-21175659',
    chant: 'Hammer of the vile king, shatter the aurora... Swallow the light! EXCALIBUR MORGAN!'
  },
  'Gilgamesh': {
    gifUrl: 'https://media.giphy.com/media/13cACn6mlO56kU/giphy.gif',
    fallbackGif: 'https://tenor.com/view/gilgamesh-enuma-elish-enuma-fate-fate-strange-fake-gif-14660706691456931556',
    chant: 'I speak of the beginning... Heaven and Earth split, and nothingness congratulated creation! ENUMA ELISH!'
  },
  'EMIYA': {
    gifUrl: 'https://media.giphy.com/media/eBGV4n8U8k3eg/giphy.gif',
    fallbackGif: 'https://tenor.com/view/unlimited-blade-works-archer-fate-stay-night-noble-phantasm-gif-18237937',
    chant: 'I am the bone of my sword. Steel is my body, and fire is my blood... UNLIMITED BLADE WORKS!'
  },
  'Cú Chulainn': {
    gifUrl: 'https://media.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
    fallbackGif: 'https://tenor.com/view/lancer-gae-bolg-fate-stay-night-noble-phantasm-gif-19717144',
    chant: 'Your heart is mine! Soar and pierce through the fated heart... GÁE BOLG!'
  },
  'Scáthach': {
    gifUrl: 'https://media.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
    fallbackGif: 'https://tenor.com/view/scathach-fate-fgo-noble-phantasm-gae-bolg-gif-18698126',
    chant: 'Pierce through, thrust of sure mortality! GÁE BOLG ALTERNATIVE!'
  },
  'Jeanne d\'Arc': {
    gifUrl: 'https://media.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
    fallbackGif: 'https://tenor.com/view/jeanne-d-arc-fate-apocrypha-noble-phantasm-flag-gif-18921827',
    chant: 'My God is here with me! Holy banner, shield our faithful spirits! LUMINOSITÉ ETERNELLE!'
  },
  'Jeanne d\'Arc (Alter)': {
    gifUrl: 'https://media.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
    fallbackGif: 'https://tenor.com/view/jeanne-alter-jalter-fgo-noble-phantasm-gif-17865181',
    chant: 'Burn away to charred ash! This is the scream of my soul turned to roaring wrath! LA GRONDEMENT DU HAINE!'
  },
  'Nero Claudius': {
    gifUrl: 'https://media.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
    fallbackGif: 'https://tenor.com/view/nero-claudius-fate-extra-last-encore-noble-phantasm-gif-18238122',
    chant: 'Witness the glory of the Golden Theater! Open the curtain, bloom in full resplendence! LAUS SAINT CLAUDIUS!'
  },
  'Heracles': {
    gifUrl: 'https://media.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
    fallbackGif: 'https://tenor.com/view/fate-stay-night-heavens-feel-nine-lives-blade-works-berserker-gif-20516422',
    chant: 'ROOOOOOAAARGH! Shooting the hundred heads in an unceasing barrage! NINE LIVES!'
  },
  'Mysterious Heroine X (Alter)': {
    gifUrl: 'https://media.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
    fallbackGif: 'https://tenor.com/view/mysterious-heroine-x-alter-cross-calibur-fgo-noble-phantasm-gif-19283719',
    chant: 'Darkness and sweets converge... Twin black dragon blades, severance of all Sabers! CROSS-CALIBUR!'
  }
};

const DEFAULT_NP_GIF = 'https://media.giphy.com/media/tO2sY2i2LgZSo/giphy.gif';
const DEFAULT_NP_FALLBACK = 'https://media.giphy.com/media/13cACn6mlO56kU/giphy.gif';

/**
 * Returns a high quality GIF / animation link for a Servant's Noble Phantasm
 */
export function getNoblePhantasmGif(servantOrTemplate: any): string {
  if (!servantOrTemplate) return DEFAULT_NP_GIF;

  // 1. Check direct servant template configuration
  const np = servantOrTemplate.noblePhantasm || servantOrTemplate.template?.noblePhantasm;
  if (np?.gifUrl && np.gifUrl.trim()) return np.gifUrl.trim();
  if (np?.animationUrl && np.animationUrl.trim()) return np.animationUrl.trim();

  // 2. Check admin-configured custom NP animation registry
  const servantId = (servantOrTemplate.id || servantOrTemplate.templateId || servantOrTemplate.template?.id || '').toLowerCase();
  const rawName = (servantOrTemplate.name || servantOrTemplate.template?.name || '').toLowerCase();
  if (servantId && CUSTOM_NP_ANIMATIONS_REGISTRY[servantId]?.gifUrl) {
    return CUSTOM_NP_ANIMATIONS_REGISTRY[servantId].gifUrl;
  }
  if (rawName && CUSTOM_NP_ANIMATIONS_REGISTRY[rawName]?.gifUrl) {
    return CUSTOM_NP_ANIMATIONS_REGISTRY[rawName].gifUrl;
  }

  // 3. Match against known canon Servant registry
  for (const [key, data] of Object.entries(NOBLE_PHANTASM_GIFS)) {
    if (rawName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(rawName.toLowerCase())) {
      return data.gifUrl || data.fallbackGif;
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
