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
  'Altera': {
    gifUrl: 'https://ella.janitorai.com/media-approved/GDJMOW2n8X1ub8K0mVMt3.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/GDJMOW2n8X1ub8K0mVMt3.gif',
    chant: 'Sword of the War God... Tear to pieces, shatter, trample! PHOTON RAY!'
  },
  'Artoria Pendragon': {
    gifUrl: '/api/media/np_artoria_pendragon.gif',
    fallbackGif: 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
    chant: 'Gathered breath of the planet, torrential light of life... EX---CALIBUR!'
  },
  'Artoria Pendragon (Alter)': {
    gifUrl: 'https://ella.janitorai.com/media-approved/Ym7LYYmkmCu9hVfPEVQo8.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/Ym7LYYmkmCu9hVfPEVQo8.gif',
    chant: 'Hammer of the vile king, shatter the aurora... Swallow the light! EXCALIBUR MORGAN!'
  },
  'Artoria Alter': {
    gifUrl: 'https://ella.janitorai.com/media-approved/Ym7LYYmkmCu9hVfPEVQo8.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/Ym7LYYmkmCu9hVfPEVQo8.gif',
    chant: 'Hammer of the vile king, shatter the aurora... Swallow the light! EXCALIBUR MORGAN!'
  },
  'Saber Alter': {
    gifUrl: 'https://ella.janitorai.com/media-approved/Ym7LYYmkmCu9hVfPEVQo8.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/Ym7LYYmkmCu9hVfPEVQo8.gif',
    chant: 'Hammer of the vile king, shatter the aurora... Swallow the light! EXCALIBUR MORGAN!'
  },
  'Gilgamesh': {
    gifUrl: '/api/media/np_gilgamesh_archer.gif',
    fallbackGif: 'https://i.giphy.com/media/13cACn6mlO56kU/giphy.gif',
    chant: 'I speak of the beginning... Heaven and Earth split, and nothingness congratulated creation! ENUMA ELISH!'
  },
  'EMIYA': {
    gifUrl: '/api/media/np_emiya_archer.gif',
    fallbackGif: 'https://i.giphy.com/media/eBGV4n8U8k3eg/giphy.gif',
    chant: 'I am the bone of my sword. Steel is my body, and fire is my blood... UNLIMITED BLADE WORKS!'
  },
  'Cú Chulainn': {
    gifUrl: 'https://ella.janitorai.com/media-approved/DBOTMhyn9kjdpSJW4xe98.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/DBOTMhyn9kjdpSJW4xe98.gif',
    chant: 'Your heart is mine! Soar and pierce through the fated heart... GÁE BOLG!'
  },
  'Scáthach': {
    gifUrl: '/api/media/np_scathach_lancer.gif',
    fallbackGif: 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
    chant: 'Pierce through, thrust of sure mortality! GÁE BOLG ALTERNATIVE!'
  },
  'Jeanne d\'Arc': {
    gifUrl: '/api/media/np_jeanne_darc_ruler.jpg',
    fallbackGif: 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
    chant: 'My God is here with me! Holy banner, shield our faithful spirits! LUMINOSITÉ ETERNELLE!'
  },
  'Jeanne d\'Arc (Alter)': {
    gifUrl: 'https://ella.janitorai.com/media-approved/kNaIxcLG_DgaLC5YsThNf.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/kNaIxcLG_DgaLC5YsThNf.gif',
    chant: 'Burn away to charred ash! This is the scream of my soul turned to roaring wrath! LA GRONDEMENT DU HAINE!'
  },
  'Jeanne Alter': {
    gifUrl: 'https://ella.janitorai.com/media-approved/kNaIxcLG_DgaLC5YsThNf.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/kNaIxcLG_DgaLC5YsThNf.gif',
    chant: 'Burn away to charred ash! This is the scream of my soul turned to roaring wrath! LA GRONDEMENT DU HAINE!'
  },
  'Jalter': {
    gifUrl: 'https://ella.janitorai.com/media-approved/kNaIxcLG_DgaLC5YsThNf.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/kNaIxcLG_DgaLC5YsThNf.gif',
    chant: 'Burn away to charred ash! This is the scream of my soul turned to roaring wrath! LA GRONDEMENT DU HAINE!'
  },
  'Nero Claudius': {
    gifUrl: '/api/media/np_nero_claudius_saber.gif',
    fallbackGif: 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif',
    chant: 'Witness the glory of the Golden Theater! Open the curtain, bloom in full resplendence! LAUS SAINT CLAUDIUS!'
  },
  'Heracles': {
    gifUrl: '/api/media/np_heracles_berserker.jpg',
    fallbackGif: 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
    chant: 'ROOOOOOAAARGH! Shooting the hundred heads in an unceasing barrage! NINE LIVES!'
  },
  'Mysterious Heroine X (Alter)': {
    gifUrl: '/api/media/np_mhx_alter.gif',
    fallbackGif: 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
    chant: 'Darkness and sweets converge... Twin black dragon blades, severance of all Sabers! CROSS-CALIBUR!'
  },
  'Karna': {
    gifUrl: '/api/media/np_karna_lancer.gif',
    fallbackGif: 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
    chant: 'Know the mercy of the King of Gods... O Sun, abide to death! VASAVI SHAKTI!'
  },
  'Adiosa': {
    gifUrl: '/api/media/np_adiosa_dragon_envoy.webp',
    fallbackGif: 'https://i.giphy.com/media/pUp9Nb1czvHMY/giphy.gif',
    chant: '⟨ Kz\'vohl aethren... Ground to glass, sky to ash. Ruin of Ixenor... AZURE-MAGENTA RUIN! ⟩'
  },
  'Aoko Aozaki': {
    gifUrl: 'https://ella.janitorai.com/media-approved/ZxX2LIW5slaIJemYnnxJf.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/ZxX2LIW5slaIJemYnnxJf.gif',
    chant: 'Circuits connected. Spatial coordinates aligned... Fifth Magic, commence playback! Everything returns to where it was—MAGIC BLUE!'
  },
  'Amamiya no Chihaya Tenkohime': {
    gifUrl: 'https://ella.janitorai.com/media-approved/Sfp4i7TL2cXu0LS-QZxxX.webp',
    fallbackGif: 'https://ella.janitorai.com/media-approved/Sfp4i7TL2cXu0LS-QZxxX.webp',
    chant: 'Ancient leylines of Ossuaron... Swirl, sacred cherry blossoms! Amazakura yo! Washi o mamore!'
  },
  'Amamiya': {
    gifUrl: 'https://ella.janitorai.com/media-approved/Sfp4i7TL2cXu0LS-QZxxX.webp',
    fallbackGif: 'https://ella.janitorai.com/media-approved/Sfp4i7TL2cXu0LS-QZxxX.webp',
    chant: 'Ancient leylines of Ossuaron... Swirl, sacred cherry blossoms! Amazakura yo! Washi o mamore!'
  },
  'Lucia Lyozes': {
    gifUrl: 'https://ella.janitorai.com/media-approved/v4h_m7mQL9PwjTmQb_7fg.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/v4h_m7mQL9PwjTmQb_7fg.gif',
    chant: 'I have seen your sort before. You gather your miracles, call yourself chosen, and play at being God. In five seconds... none of your cheats will save you. Black Lance—Apocrypha Terminus!'
  },
  'Lucia': {
    gifUrl: 'https://ella.janitorai.com/media-approved/v4h_m7mQL9PwjTmQb_7fg.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/v4h_m7mQL9PwjTmQb_7fg.gif',
    chant: 'I have seen your sort before. You gather your miracles, call yourself chosen, and play at being God. In five seconds... none of your cheats will save you. Black Lance—Apocrypha Terminus!'
  },
  'Lucernalia Lyozes': {
    gifUrl: 'https://ella.janitorai.com/media-approved/v4h_m7mQL9PwjTmQb_7fg.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/v4h_m7mQL9PwjTmQb_7fg.gif',
    chant: 'I have seen your sort before. You gather your miracles, call yourself chosen, and play at being God. In five seconds... none of your cheats will save you. Black Lance—Apocrypha Terminus!'
  },
  'Typhon Ephemeros': {
    gifUrl: 'https://ella.janitorai.com/media-approved/WueTnw4QfurHe53DsTV-z.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/WueTnw4QfurHe53DsTV-z.gif',
    chant: 'Drink deep of the ephemeral fruit... Reverse the cosmos, hollow the stars! Dragon Grail that Reverses the Void!'
  },
  'Typhon': {
    gifUrl: 'https://ella.janitorai.com/media-approved/WueTnw4QfurHe53DsTV-z.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/WueTnw4QfurHe53DsTV-z.gif',
    chant: 'Drink deep of the ephemeral fruit... Reverse the cosmos, hollow the stars! Dragon Grail that Reverses the Void!'
  },
  'Van Gogh': {
    gifUrl: 'https://ella.janitorai.com/media-approved/_HQY3KD_L4lNGkG8Rq6y_.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/_HQY3KD_L4lNGkG8Rq6y_.gif',
    chant: 'This is just a single snippet reflecting the hard times of Van Gogh\'s life... I can\'t guarantee what will happen, but that\'s not part of the creator\'s guarantee! My study of cypresses and a village! You know it as De Sterrennacht!'
  },
  'Tamamo no Mae': {
    gifUrl: 'https://ella.janitorai.com/media-approved/_ePWNS7EhfZ058rS15mCK.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/_ePWNS7EhfZ058rS15mCK.gif',
    chant: 'Eightfold Blessings of Amaterasu on the Weight Stone under the Sunlit Watery Heavens... Suiten Nikkō Amaterasu Yano Shizu-Ishi!'
  },
  'Tamamo': {
    gifUrl: 'https://ella.janitorai.com/media-approved/_ePWNS7EhfZ058rS15mCK.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/_ePWNS7EhfZ058rS15mCK.gif',
    chant: 'Eightfold Blessings of Amaterasu on the Weight Stone under the Sunlit Watery Heavens... Suiten Nikkō Amaterasu Yano Shizu-Ishi!'
  },
  'Hassan-i-Sabbah (Azrael)': {
    gifUrl: 'https://ella.janitorai.com/media-approved/kVayE4r7ymceqPcg_My_g.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/kVayE4r7ymceqPcg_My_g.gif',
    chant: "Listen closely. The evening bell has tolled thy name. Surrender thy head to the blade of fate... Mal'ak al-Mawt!"
  },
  'Azrael': {
    gifUrl: 'https://ella.janitorai.com/media-approved/kVayE4r7ymceqPcg_My_g.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/kVayE4r7ymceqPcg_My_g.gif',
    chant: "Listen closely. The evening bell has tolled thy name. Surrender thy head to the blade of fate... Mal'ak al-Mawt!"
  },
  'Okita Souji': {
    gifUrl: 'https://ella.janitorai.com/media-approved/HQmlf5uAXpkxz6B93nmbS.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/HQmlf5uAXpkxz6B93nmbS.gif',
    chant: 'One step, fleeting shadow. Two steps, peerless edge. Three steps, absolute thrust... Mumyō Sandan-Zuki!'
  },
  'Okita': {
    gifUrl: 'https://ella.janitorai.com/media-approved/HQmlf5uAXpkxz6B93nmbS.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/HQmlf5uAXpkxz6B93nmbS.gif',
    chant: 'One step, fleeting shadow. Two steps, peerless edge. Three steps, absolute thrust... Mumyō Sandan-Zuki!'
  },
  'Archetype: Earth': {
    gifUrl: 'https://ella.janitorai.com/media-approved/_lDposzhmPLDeSsGf6k70.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/_lDposzhmPLDeSsGf6k70.gif',
    chant: 'I shall reconstruct this celestial world... Awaken, True Ancestor Throne! MARBLE PHANTASM!'
  },
  'Mysterious Executor C.I.E.L': {
    gifUrl: 'https://ella.janitorai.com/media-approved/2FK82Z4D2WXmDXZ9cL4lB.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/2FK82Z4D2WXmDXZ9cL4lB.gif',
    chant: 'Seventh Scripture, activate! Break through all sin and guilt... Seventh Holy Scripture - Final Judgment!'
  },
  'ciel_executor': {
    gifUrl: 'https://ella.janitorai.com/media-approved/2FK82Z4D2WXmDXZ9cL4lB.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/2FK82Z4D2WXmDXZ9cL4lB.gif',
    chant: 'Seventh Scripture, activate! Break through all sin and guilt... Seventh Holy Scripture - Final Judgment!'
  },
  'Ciel': {
    gifUrl: 'https://ella.janitorai.com/media-approved/2FK82Z4D2WXmDXZ9cL4lB.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/2FK82Z4D2WXmDXZ9cL4lB.gif',
    chant: 'Seventh Scripture, activate! Break through all sin and guilt... Seventh Holy Scripture - Final Judgment!'
  },
  'Code: Original Sin': {
    gifUrl: 'https://ella.janitorai.com/media-approved/2FK82Z4D2WXmDXZ9cL4lB.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/2FK82Z4D2WXmDXZ9cL4lB.gif',
    chant: 'Seventh Scripture, activate! Break through all sin and guilt... Seventh Holy Scripture - Final Judgment!'
  },
  'Calvaria Galgalim': {
    gifUrl: 'https://ella.janitorai.com/media-approved/mLP_-8WbJfVio7dzHLF3n.gif',
    fallbackGif: 'https://ella.janitorai.com/media-approved/mLP_-8WbJfVio7dzHLF3n.gif',
    chant: 'Idea Blood, manifest. Divine halo of retribution, descend upon the wicked! CALVARIA GALGALIM!'
  }
};

const DEFAULT_NP_GIF = '/api/media/np_artoria_pendragon.gif';
const DEFAULT_NP_FALLBACK = 'https://i.giphy.com/media/tO2sY2i2LgZSo/giphy.gif';

/**
 * Returns a high quality GIF / animation link for a Servant's Noble Phantasm
 */
export function getNoblePhantasmGif(servantOrTemplate: any, stage?: number): string {
  if (!servantOrTemplate) return DEFAULT_NP_GIF;

  const servantId = (
    servantOrTemplate.templateId ||
    servantOrTemplate.id ||
    servantOrTemplate.servant?.templateId ||
    servantOrTemplate.servant?.template?.id ||
    servantOrTemplate.servant?.id ||
    servantOrTemplate.template?.id ||
    ''
  ).toLowerCase();
  const rawName = (
    typeof servantOrTemplate === 'string'
      ? servantOrTemplate
      : servantOrTemplate.name ||
        servantOrTemplate.nickname ||
        servantOrTemplate.servant?.nickname ||
        servantOrTemplate.servant?.name ||
        servantOrTemplate.servant?.template?.name ||
        servantOrTemplate.template?.name ||
        ''
  ).toLowerCase();

  // 1. Direct explicit form overrides
  if (
    servantId.includes('artoria_alter') ||
    servantId.includes('saber_alter') ||
    servantId.includes('artoria_pendragon_alter') ||
    rawName.includes('artoria alter') ||
    rawName.includes('saber alter') ||
    rawName.includes('artoria pendragon (alter)') ||
    (rawName.includes('alter') && (rawName.includes('artoria') || rawName.includes('saber')))
  ) {
    return normalizeMediaUrl('https://ella.janitorai.com/media-approved/Ym7LYYmkmCu9hVfPEVQo8.gif');
  }

  if (
    servantId.includes('jeanne_alter') ||
    servantId.includes('jalter') ||
    rawName.includes('jeanne alter') ||
    rawName.includes('jalter') ||
    rawName.includes("jeanne d'arc (alter)") ||
    (rawName.includes('alter') && (rawName.includes('jeanne') || rawName.includes('jalter')))
  ) {
    return normalizeMediaUrl('https://ella.janitorai.com/media-approved/kNaIxcLG_DgaLC5YsThNf.gif');
  }

  const cleanRawName = rawName.replace(/\s*\([^)]+\)\s*$/g, '').trim().toLowerCase();

  if (servantId.includes('archetype') || cleanRawName.includes('archetype') || cleanRawName.includes('arcueid') || servantId.includes('earth')) {
    const effectiveStage = stage ?? (typeof servantOrTemplate === 'object' ? (servantOrTemplate.selectedAscensionStage ?? servantOrTemplate.servant?.selectedAscensionStage ?? servantOrTemplate.ascensionStage ?? servantOrTemplate.servant?.ascensionStage ?? 1) : 1);
    if (effectiveStage === 2) {
      return normalizeMediaUrl('https://ella.janitorai.com/media-approved/gc_jc1p1H5Gj6NlUuDG1Y.gif');
    }
    return normalizeMediaUrl('https://ella.janitorai.com/media-approved/_lDposzhmPLDeSsGf6k70.gif');
  }

  if (servantId.includes('ciel') || cleanRawName.includes('ciel')) {
    const effectiveStage = stage ?? (typeof servantOrTemplate === 'object' ? (servantOrTemplate.selectedAscensionStage ?? servantOrTemplate.servant?.selectedAscensionStage ?? servantOrTemplate.ascensionStage ?? servantOrTemplate.servant?.ascensionStage ?? 1) : 1);
    if (effectiveStage === 3 || effectiveStage === 4 || String(effectiveStage).includes('costume')) {
      return normalizeMediaUrl('https://ella.janitorai.com/media-approved/mLP_-8WbJfVio7dzHLF3n.gif');
    }
    return normalizeMediaUrl('https://ella.janitorai.com/media-approved/2FK82Z4D2WXmDXZ9cL4lB.gif');
  }

  // 2. Check direct servant template configuration
  const np = typeof servantOrTemplate === 'object' ? (servantOrTemplate.noblePhantasm || servantOrTemplate.template?.noblePhantasm) : undefined;
  if (np?.gifUrl && np.gifUrl.trim()) return normalizeMediaUrl(np.gifUrl.trim());
  if (np?.animationUrl && np.animationUrl.trim()) return normalizeMediaUrl(np.animationUrl.trim());

  // 3. Check admin-configured custom NP animation registry
  if (servantId && CUSTOM_NP_ANIMATIONS_REGISTRY[servantId]?.gifUrl) {
    return normalizeMediaUrl(CUSTOM_NP_ANIMATIONS_REGISTRY[servantId].gifUrl);
  }
  if (rawName && CUSTOM_NP_ANIMATIONS_REGISTRY[rawName]?.gifUrl) {
    return normalizeMediaUrl(CUSTOM_NP_ANIMATIONS_REGISTRY[rawName].gifUrl);
  }
  if (cleanRawName && CUSTOM_NP_ANIMATIONS_REGISTRY[cleanRawName]?.gifUrl) {
    return normalizeMediaUrl(CUSTOM_NP_ANIMATIONS_REGISTRY[cleanRawName].gifUrl);
  }

  // 4. Match against known canon Servant registry
  // First pass: Exact match on full raw name or servantId (preserving qualifiers like "(Alter)")
  for (const [key, data] of Object.entries(NOBLE_PHANTASM_GIFS)) {
    const keyLower = key.toLowerCase();
    if (rawName === keyLower || servantId === keyLower) {
      return normalizeMediaUrl(data.gifUrl || data.fallbackGif);
    }
  }

  // Second pass: Cleaned name match (where parenthetical suffixes like "(Saber)" are stripped)
  for (const [key, data] of Object.entries(NOBLE_PHANTASM_GIFS)) {
    const keyClean = key.replace(/\s*\([^)]+\)\s*$/g, '').trim().toLowerCase();
    if (cleanRawName === keyClean) {
      return normalizeMediaUrl(data.gifUrl || data.fallbackGif);
    }
  }

  // Third pass: Substring match sorted by key length descending
  const sortedNpGifs = Object.entries(NOBLE_PHANTASM_GIFS).sort((a, b) => b[0].length - a[0].length);
  for (const [key, data] of sortedNpGifs) {
    const keyLower = key.toLowerCase();
    const keyClean = key.replace(/\s*\([^)]+\)\s*$/g, '').trim().toLowerCase();
    if (rawName.includes(keyLower) || cleanRawName.includes(keyClean)) {
      return normalizeMediaUrl(data.gifUrl || data.fallbackGif);
    }
  }

  // 5. Check matching by NP name
  const npName = np?.name || '';
  if (npName) {
    const lowerNp = npName.toLowerCase();
    if (lowerNp.includes('excalibur morgan') || lowerNp.includes('vile king')) {
      return NOBLE_PHANTASM_GIFS['Artoria Pendragon (Alter)'].gifUrl;
    }
    if (lowerNp.includes('grondement') || lowerNp.includes('la grondement')) {
      return NOBLE_PHANTASM_GIFS['Jeanne d\'Arc (Alter)'].gifUrl;
    }
    if (lowerNp.includes('sandan-zuki') || lowerNp.includes('sandanzuki') || lowerNp.includes('three-stage thrust') || lowerNp.includes('mumyo') || lowerNp.includes('mumyō')) {
      return NOBLE_PHANTASM_GIFS['Okita Souji'].gifUrl;
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
    if (lowerNp.includes('luminosité') || lowerNp.includes('luminosite')) {
      return NOBLE_PHANTASM_GIFS['Jeanne d\'Arc'].gifUrl;
    }
    if (lowerNp.includes('azure-magenta') || lowerNp.includes('ruin of ixenor') || lowerNp.includes('incineration of aethel')) {
      return NOBLE_PHANTASM_GIFS['Adiosa'].gifUrl;
    }
    if (lowerNp.includes('magic blue') || lowerNp.includes('first star of the morning') || lowerNp.includes('fifth magic')) {
      return NOBLE_PHANTASM_GIFS['Aoko Aozaki'].gifUrl;
    }
    if (lowerNp.includes('sterrennacht') || lowerNp.includes('starry night')) {
      return NOBLE_PHANTASM_GIFS['Van Gogh'].gifUrl;
    }
  }

  return DEFAULT_NP_GIF;
}

/**
 * Clean chant text by trimming whitespace and removing parenthetical over-explanations like "(ROOOOOAAAR)"
 */
export function cleanChantText(text?: string): string {
  if (!text) return '';
  return text.replace(/\s*\([^)]*\)/g, '').trim();
}

/**
 * Returns the incantation / chant of the Noble Phantasm
 */
export function getNoblePhantasmChant(servantOrTemplate: any): string {
  if (!servantOrTemplate) return 'True Name Unleashed!';

  let custom: string | undefined;
  let rawName = '';
  let servantId = '';
  let templateNp: any = undefined;

  if (typeof servantOrTemplate === 'string') {
    rawName = servantOrTemplate.toLowerCase();
  } else if (typeof servantOrTemplate === 'object') {
    custom = servantOrTemplate.customQuotes?.noblePhantasm;
    if (custom) return cleanChantText(custom);

    servantId = (
      servantOrTemplate.id ||
      servantOrTemplate.templateId ||
      servantOrTemplate.servant?.id ||
      servantOrTemplate.servant?.templateId ||
      servantOrTemplate.servant?.template?.id ||
      servantOrTemplate.template?.id ||
      ''
    ).toLowerCase();

    rawName = (
      servantOrTemplate.name ||
      servantOrTemplate.nickname ||
      servantOrTemplate.servant?.name ||
      servantOrTemplate.servant?.template?.name ||
      servantOrTemplate.template?.name ||
      servantOrTemplate.servantName ||
      ''
    ).toLowerCase();

    templateNp = servantOrTemplate.noblePhantasm || servantOrTemplate.template?.noblePhantasm || servantOrTemplate.servant?.template?.noblePhantasm;
  }

  // Direct explicit form overrides for chant
  if (
    servantId.includes('artoria_alter') ||
    servantId.includes('saber_alter') ||
    servantId.includes('artoria_pendragon_alter') ||
    rawName.includes('artoria alter') ||
    rawName.includes('saber alter') ||
    rawName.includes('artoria pendragon (alter)') ||
    (rawName.includes('alter') && (rawName.includes('artoria') || rawName.includes('saber')))
  ) {
    return 'Hammer of the vile king, shatter the aurora... Swallow the light! EXCALIBUR MORGAN!';
  }

  if (
    servantId.includes('jeanne_alter') ||
    servantId.includes('jalter') ||
    rawName.includes('jeanne alter') ||
    rawName.includes('jalter') ||
    rawName.includes("jeanne d'arc (alter)") ||
    (rawName.includes('alter') && (rawName.includes('jeanne') || rawName.includes('jalter')))
  ) {
    return 'Burn away to charred ash! This is the scream of my soul turned to roaring wrath! LA GRONDEMENT DU HAINE!';
  }

  // Check admin custom config
  if (servantId && CUSTOM_NP_ANIMATIONS_REGISTRY[servantId]?.chant) {
    return cleanChantText(CUSTOM_NP_ANIMATIONS_REGISTRY[servantId].chant!);
  }

  const cleanRawName = rawName.replace(/\s*\([^)]+\)\s*$/g, '').trim().toLowerCase();
  if (cleanRawName && CUSTOM_NP_ANIMATIONS_REGISTRY[cleanRawName]?.chant) {
    return cleanChantText(CUSTOM_NP_ANIMATIONS_REGISTRY[cleanRawName].chant!);
  }

  // Check dynamic stage chant for Ciel
  if (servantId.includes('ciel') || cleanRawName.includes('ciel')) {
    const effectiveStage = typeof servantOrTemplate === 'object'
      ? (servantOrTemplate.selectedAscensionStage ?? servantOrTemplate.servant?.selectedAscensionStage ?? servantOrTemplate.ascensionStage ?? servantOrTemplate.servant?.ascensionStage ?? 1)
      : 1;
    if (effectiveStage === 3 || effectiveStage === 4 || String(effectiveStage).includes('costume')) {
      return 'Idea Blood, manifest. Divine halo of retribution, descend upon the wicked! CALVARIA GALGALIM!';
    }
    return 'Seventh Scripture, activate! Break through all sin and guilt... Seventh Holy Scripture - Final Judgment!';
  }

  if (templateNp?.chant) return cleanChantText(templateNp.chant);

  if (rawName) {
    for (const [key, data] of Object.entries(NOBLE_PHANTASM_GIFS)) {
      const keyLower = key.toLowerCase();
      if (rawName === keyLower || servantId === keyLower) {
        return cleanChantText(data.chant);
      }
    }

    for (const [key, data] of Object.entries(NOBLE_PHANTASM_GIFS)) {
      const keyClean = key.replace(/\s*\([^)]+\)\s*$/g, '').trim().toLowerCase();
      if (cleanRawName === keyClean) {
        return cleanChantText(data.chant);
      }
    }

    const sortedNpGifs = Object.entries(NOBLE_PHANTASM_GIFS).sort((a, b) => b[0].length - a[0].length);
    for (const [key, data] of sortedNpGifs) {
      const keyLower = key.toLowerCase();
      const keyClean = key.replace(/\s*\([^)]+\)\s*$/g, '').trim().toLowerCase();
      if (rawName.includes(keyLower) || cleanRawName.includes(keyClean)) {
        return cleanChantText(data.chant);
      }
    }
  }

  return 'True Name Unleashed — Receive the full divine power of this Heroic Spirit!';
}

/**
 * Resolves dynamic Noble Phantasm name based on servant and equipped stage/costume.
 * For Mysterious Executor C.I.E.L:
 *   - Stages 1-2: Code: Original Sin
 *   - Stages 3-4 (or costumes): Calvaria Galgalim
 */
export function getNoblePhantasmName(servantOrTemplate: any, stage?: number): string {
  if (!servantOrTemplate) return 'Noble Phantasm';

  const rawName = typeof servantOrTemplate === 'string'
    ? servantOrTemplate
    : (servantOrTemplate.name || servantOrTemplate.servant?.template?.name || servantOrTemplate.template?.name || '');

  const servantId = (
    typeof servantOrTemplate === 'string'
      ? servantOrTemplate
      : (servantOrTemplate.id || servantOrTemplate.templateId || servantOrTemplate.servant?.templateId || servantOrTemplate.template?.id || '')
  ).toLowerCase();

  const cleanRawName = rawName.replace(/\s*\([^)]+\)\s*$/g, '').trim().toLowerCase();

  if (servantId.includes('ciel') || cleanRawName.includes('ciel')) {
    const effectiveStage = stage ?? (typeof servantOrTemplate === 'object'
      ? (servantOrTemplate.selectedAscensionStage ?? servantOrTemplate.servant?.selectedAscensionStage ?? servantOrTemplate.ascensionStage ?? servantOrTemplate.servant?.ascensionStage ?? 1)
      : 1);
    if (effectiveStage === 3 || effectiveStage === 4 || String(effectiveStage).includes('costume')) {
      return 'Calvaria Galgalim';
    }
    return 'Code: Original Sin';
  }

  const templateNp = typeof servantOrTemplate === 'object'
    ? (servantOrTemplate.noblePhantasm || servantOrTemplate.template?.noblePhantasm)
    : undefined;
  if (templateNp?.name) return templateNp.name;

  return 'Noble Phantasm';
}
