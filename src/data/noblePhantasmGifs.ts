// High-impact Noble Phantasm Animated Cinematic URLs
// These represent the iconic ultimate move activations from the Fate anime franchise.

export const NOBLE_PHANTASM_GIFS: Record<string, { gifUrl: string; fallbackGif: string; chant: string }> = {
  'Artoria Pendragon': {
    gifUrl: 'https://media.giphy.com/media/105OwsN7a4UQ2Q/giphy.gif',
    fallbackGif: 'https://tenor.com/view/fate-saber-excalibur-noble-phantasm-gif-18115682',
    chant: 'Gathered breath of the planet, torrential light of life... EX---CALIBUR!'
  },
  'Artoria Pendragon (Alter)': {
    gifUrl: 'https://media1.tenor.com/m/kS9wTzS47y8AAAAC/fate-stay-night-heavens-feel-saber-alter.gif',
    fallbackGif: 'https://tenor.com/view/saber-alter-excalibur-morgan-fate-stay-night-heavens-feel-gif-21175659',
    chant: 'Hammer of the vile king, shatter the aurora... Swallow the light! EXCALIBUR MORGAN!'
  },
  'Gilgamesh': {
    gifUrl: 'https://media.giphy.com/media/105OwsN7a4UQ2Q/giphy.gif',
    fallbackGif: 'https://tenor.com/view/gilgamesh-enuma-elish-enuma-fate-fate-strange-fake-gif-14660706691456931556',
    chant: 'I speak of the beginning... Heaven and Earth split, and nothingness congratulated creation! ENUMA ELISH!'
  },
  'EMIYA': {
    gifUrl: 'https://media.giphy.com/media/105OwsN7a4UQ2Q/giphy.gif',
    fallbackGif: 'https://tenor.com/view/unlimited-blade-works-archer-fate-stay-night-noble-phantasm-gif-18237937',
    chant: 'I am the bone of my sword. Steel is my body, and fire is my blood... UNLIMITED BLADE WORKS!'
  },
  'Cú Chulainn': {
    gifUrl: 'https://media.giphy.com/media/105OwsN7a4UQ2Q/giphy.gif',
    fallbackGif: 'https://tenor.com/view/lancer-gae-bolg-fate-stay-night-noble-phantasm-gif-19717144',
    chant: 'Your heart is mine! Soar and pierce through the fated heart... GÁE BOLG!'
  },
  'Scáthach': {
    gifUrl: 'https://media.giphy.com/media/105OwsN7a4UQ2Q/giphy.gif',
    fallbackGif: 'https://tenor.com/view/scathach-fate-fgo-noble-phantasm-gae-bolg-gif-18698126',
    chant: 'Pierce through, thrust of sure mortality! GÁE BOLG ALTERNATIVE!'
  },
  'Jeanne d\'Arc': {
    gifUrl: 'https://media.giphy.com/media/105OwsN7a4UQ2Q/giphy.gif',
    fallbackGif: 'https://tenor.com/view/jeanne-d-arc-fate-apocrypha-noble-phantasm-flag-gif-18921827',
    chant: 'My God is here with me! Holy banner, shield our faithful spirits! LUMINOSITÉ ETERNELLE!'
  },
  'Jeanne d\'Arc (Alter)': {
    gifUrl: 'https://media.giphy.com/media/105OwsN7a4UQ2Q/giphy.gif',
    fallbackGif: 'https://tenor.com/view/jeanne-alter-jalter-fgo-noble-phantasm-gif-17865181',
    chant: 'Burn away to charred ash! This is the scream of my soul turned to roaring wrath! LA GRONDEMENT DU HAINE!'
  },
  'Nero Claudius': {
    gifUrl: 'https://media.giphy.com/media/105OwsN7a4UQ2Q/giphy.gif',
    fallbackGif: 'https://tenor.com/view/nero-claudius-fate-extra-last-encore-noble-phantasm-gif-18238122',
    chant: 'Witness the glory of the Golden Theater! Open the curtain, bloom in full resplendence! LAUS SAINT CLAUDIUS!'
  },
  'Heracles': {
    gifUrl: 'https://media.giphy.com/media/105OwsN7a4UQ2Q/giphy.gif',
    fallbackGif: 'https://tenor.com/view/fate-stay-night-heavens-feel-nine-lives-blade-works-berserker-gif-20516422',
    chant: 'ROOOOOOAAARGH! Shooting the hundred heads in an unceasing barrage! NINE LIVES!'
  },
  'Mysterious Heroine X (Alter)': {
    gifUrl: 'https://media.giphy.com/media/105OwsN7a4UQ2Q/giphy.gif',
    fallbackGif: 'https://tenor.com/view/mysterious-heroine-x-alter-cross-calibur-fgo-noble-phantasm-gif-19283719',
    chant: 'Darkness and sweets converge... Twin black dragon blades, severance of all Sabers! CROSS-CALIBUR!'
  }
};

const DEFAULT_NP_GIF = 'https://media.giphy.com/media/105OwsN7a4UQ2Q/giphy.gif';
const DEFAULT_NP_FALLBACK = 'https://tenor.com/view/anime-magic-magic-circle-spell-gif-8657546';

/**
 * Returns a high quality GIF / animation link for a Servant's Noble Phantasm
 */
export function getNoblePhantasmGif(servantOrTemplate: any): string {
  if (!servantOrTemplate) return DEFAULT_NP_GIF;

  // Check custom direct animations first
  const np = servantOrTemplate.noblePhantasm || servantOrTemplate.template?.noblePhantasm;
  if (np?.gifUrl) return np.gifUrl;
  if (np?.animationUrl) return np.animationUrl;

  const rawName = servantOrTemplate.name || servantOrTemplate.template?.name || '';
  for (const [key, data] of Object.entries(NOBLE_PHANTASM_GIFS)) {
    if (rawName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(rawName.toLowerCase())) {
      return data.gifUrl || data.fallbackGif;
    }
  }

  // Check matching by NP name
  const npName = np?.name || '';
  if (npName) {
    for (const [, data] of Object.entries(NOBLE_PHANTASM_GIFS)) {
      if (npName.toLowerCase().includes('excalibur morgan')) {
        return NOBLE_PHANTASM_GIFS['Artoria Pendragon (Alter)'].gifUrl;
      }
      if (npName.toLowerCase().includes('excalibur')) {
        return NOBLE_PHANTASM_GIFS['Artoria Pendragon'].gifUrl;
      }
      if (npName.toLowerCase().includes('enuma elish') || npName.toLowerCase().includes('gate of babylon')) {
        return NOBLE_PHANTASM_GIFS['Gilgamesh'].gifUrl;
      }
      if (npName.toLowerCase().includes('blade works')) {
        return NOBLE_PHANTASM_GIFS['EMIYA'].gifUrl;
      }
      if (npName.toLowerCase().includes('gae bolg') || npName.toLowerCase().includes('gáe bolg')) {
        return NOBLE_PHANTASM_GIFS['Cú Chulainn'].gifUrl;
      }
      if (npName.toLowerCase().includes('grondement')) {
        return NOBLE_PHANTASM_GIFS['Jeanne d\'Arc (Alter)'].gifUrl;
      }
      if (npName.toLowerCase().includes('luminosité') || npName.toLowerCase().includes('luminosite')) {
        return NOBLE_PHANTASM_GIFS['Jeanne d\'Arc'].gifUrl;
      }
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

  const np = servantOrTemplate.noblePhantasm || servantOrTemplate.template?.noblePhantasm;
  if (np?.chant) return np.chant;

  const rawName = servantOrTemplate.name || servantOrTemplate.template?.name || '';
  for (const [key, data] of Object.entries(NOBLE_PHANTASM_GIFS)) {
    if (rawName.toLowerCase().includes(key.toLowerCase())) {
      return data.chant;
    }
  }

  return 'True Name Unleashed — Receive the full divine power of this Heroic Spirit!';
}
