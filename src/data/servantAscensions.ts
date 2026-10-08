// Official Atlas Academy Ascension Artworks & Sprite Sheets for Canonical Fate/Grand Order Servants
// Stages 1, 2, 3, and 4 (Final Ascension) + Special Costumes

export interface ServantAscensionData {
  stage1: string;
  stage2: string;
  stage3: string;
  stage4: string; // Final Ascension
  costume?: string;
  costumes?: { id: string; name: string; url: string; spriteUrl?: string }[];
  sprites?: {
    stage1?: string;
    stage2?: string;
    stage3?: string;
    stage4?: string;
    costume?: string;
  };
}

export const CANONICAL_SERVANT_ASCENSIONS: Record<string, ServantAscensionData> = {
  artoria_pendragon: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/100100/100100a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/100100/100100a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/100100/100100b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/100100/100100b@2.png',
    costume: 'https://static.atlasacademy.io/NA/CharaGraph/100130/100130a.png',
    costumes: [
      { id: '100130', name: 'Invisible Air (Wind King Barrier)', url: 'https://static.atlasacademy.io/NA/CharaGraph/100130/100130a.png' }
    ],
    sprites: {
      stage1: 'https://static.atlasacademy.io/NA/CharaFigure/1001000/1001000_merged.png',
      stage2: 'https://static.atlasacademy.io/NA/CharaFigure/1001001/1001001_merged.png',
      stage3: 'https://static.atlasacademy.io/NA/CharaFigure/1001002/1001002_merged.png',
      stage4: 'https://static.atlasacademy.io/NA/CharaFigure/1001002/1001002_merged.png',
      costume: 'https://static.atlasacademy.io/NA/CharaFigure/1001300/1001300_merged.png'
    }
  },
  gilgamesh_archer: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/200200/200200a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/200200/200200a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/200200/200200b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/200200/200200b@2.png',
    sprites: {
      stage1: 'https://static.atlasacademy.io/NA/CharaFigure/2002000/2002000_merged.png',
      stage2: 'https://static.atlasacademy.io/NA/CharaFigure/2002001/2002001_merged.png',
      stage3: 'https://static.atlasacademy.io/NA/CharaFigure/2002002/2002002_merged.png',
      stage4: 'https://static.atlasacademy.io/NA/CharaFigure/2002002/2002002_merged.png'
    }
  },
  scathach_lancer: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/301300/301300a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/301300/301300a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/301300/301300b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/301300/301300b@2.png',
    costume: 'https://static.atlasacademy.io/NA/CharaGraph/301330/301330a.png',
    costumes: [
      { id: '301330', name: 'Piercing Bunny of Dun Scaith', url: 'https://static.atlasacademy.io/NA/CharaGraph/301330/301330a.png' }
    ],
    sprites: {
      stage1: 'https://static.atlasacademy.io/NA/CharaFigure/3013000/3013000_merged.png',
      stage2: 'https://static.atlasacademy.io/NA/CharaFigure/3013001/3013001_merged.png',
      stage3: 'https://static.atlasacademy.io/NA/CharaFigure/3013002/3013002_merged.png',
      stage4: 'https://static.atlasacademy.io/NA/CharaFigure/3013002/3013002_merged.png',
      costume: 'https://static.atlasacademy.io/NA/CharaFigure/3013300/3013300_merged.png'
    }
  },
  jeanne_darc_ruler: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/900100/900100a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/900100/900100a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/900100/900100b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/900100/900100b@2.png',
    costume: 'https://static.atlasacademy.io/NA/CharaGraph/900130/900130a.png',
    costumes: [
      { id: '900130', name: 'Formal Holy Maiden Gown', url: 'https://static.atlasacademy.io/NA/CharaGraph/900130/900130a.png' }
    ],
    sprites: {
      stage1: 'https://static.atlasacademy.io/NA/CharaFigure/9001000/9001000_merged.png',
      stage2: 'https://static.atlasacademy.io/NA/CharaFigure/9001001/9001001_merged.png',
      stage3: 'https://static.atlasacademy.io/NA/CharaFigure/9001002/9001002_merged.png',
      stage4: 'https://static.atlasacademy.io/NA/CharaFigure/9001002/9001002_merged.png',
      costume: 'https://static.atlasacademy.io/NA/CharaFigure/9001300/9001300_merged.png'
    }
  },
  jeanne_alter: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/1100300/1100300a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/1100300/1100300a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/1100300/1100300b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/1100300/1100300b@2.png',
    costume: 'https://static.atlasacademy.io/NA/CharaGraph/1100330/1100330a.png',
    costumes: [
      { id: '1100330', name: 'Shinjuku 1999 Casual Dress', url: 'https://static.atlasacademy.io/NA/CharaGraph/1100330/1100330a.png' }
    ],
    sprites: {
      stage1: 'https://static.atlasacademy.io/NA/CharaFigure/11003000/11003000_merged.png',
      stage2: 'https://static.atlasacademy.io/NA/CharaFigure/11003001/11003001_merged.png',
      stage3: 'https://static.atlasacademy.io/NA/CharaFigure/11003002/11003002_merged.png',
      stage4: 'https://static.atlasacademy.io/NA/CharaFigure/11003002/11003002_merged.png',
      costume: 'https://static.atlasacademy.io/NA/CharaFigure/11003300/11003300_merged.png'
    }
  },
  mhx_alter: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/702400/702400a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/702400/702400a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/702400/702400b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/702400/702400b@2.png',
    sprites: {
      stage1: 'https://static.atlasacademy.io/NA/CharaFigure/7024000/7024000_merged.png',
      stage2: 'https://static.atlasacademy.io/NA/CharaFigure/7024001/7024001_merged.png',
      stage3: 'https://static.atlasacademy.io/NA/CharaFigure/7024002/7024002_merged.png',
      stage4: 'https://static.atlasacademy.io/NA/CharaFigure/7024002/7024002_merged.png'
    }
  },
  artoria_pendragon_alter: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/100200/100200a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/100200/100200a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/100200/100200b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/100200/100200b@2.png',
    costume: 'https://static.atlasacademy.io/NA/CharaGraph/100230/100230a.png',
    costumes: [
      { id: '100230', name: 'Shinjuku 1999 Leather Jacket', url: 'https://static.atlasacademy.io/NA/CharaGraph/100230/100230a.png' }
    ],
    sprites: {
      stage1: 'https://static.atlasacademy.io/NA/CharaFigure/1002000/1002000_merged.png', // With visor
      stage2: 'https://static.atlasacademy.io/NA/CharaFigure/1002001/1002001_merged.png', // No visor
      stage3: 'https://static.atlasacademy.io/NA/CharaFigure/1002002/1002002_merged.png', // Armor dress
      stage4: 'https://static.atlasacademy.io/NA/CharaFigure/1002002/1002002_merged.png',
      costume: 'https://static.atlasacademy.io/NA/CharaFigure/1002300/1002300_merged.png' // Shinjuku jacket
    }
  },
  nero_claudius_saber: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/100500/100500a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/100500/100500a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/100500/100500b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/100500/100500b@2.png',
    costume: 'https://static.atlasacademy.io/NA/CharaGraph/100530/100530a.png',
    costumes: [
      { id: '100530', name: 'Olympia Bloomers', url: 'https://static.atlasacademy.io/NA/CharaGraph/100530/100530a.png' },
      { id: '100540', name: 'Silk of Venus', url: 'https://static.atlasacademy.io/NA/CharaGraph/100540/100540a.png' },
      { id: '100550', name: 'Chastity Bridle', url: 'https://static.atlasacademy.io/NA/CharaGraph/100550/100550a.png' }
    ],
    sprites: {
      stage1: 'https://static.atlasacademy.io/NA/CharaFigure/1005000/1005000_merged.png',
      stage2: 'https://static.atlasacademy.io/NA/CharaFigure/1005001/1005001_merged.png',
      stage3: 'https://static.atlasacademy.io/NA/CharaFigure/1005002/1005002_merged.png',
      stage4: 'https://static.atlasacademy.io/NA/CharaFigure/1005002/1005002_merged.png',
      costume: 'https://static.atlasacademy.io/NA/CharaFigure/1005300/1005300_merged.png'
    }
  },
  emiya_archer: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/200100/200100a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/200100/200100a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/200100/200100b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/200100/200100b@2.png',
    costume: 'https://static.atlasacademy.io/NA/CharaGraph/200130/200130a.png',
    costumes: [
      { id: '200130', name: 'Summer Butler Chaldea Apron', url: 'https://static.atlasacademy.io/NA/CharaGraph/200130/200130a.png' }
    ],
    sprites: {
      stage1: 'https://static.atlasacademy.io/NA/CharaFigure/2001000/2001000_merged.png',
      stage2: 'https://static.atlasacademy.io/NA/CharaFigure/2001001/2001001_merged.png',
      stage3: 'https://static.atlasacademy.io/NA/CharaFigure/2001002/2001002_merged.png',
      stage4: 'https://static.atlasacademy.io/NA/CharaFigure/2001002/2001002_merged.png',
      costume: 'https://static.atlasacademy.io/NA/CharaFigure/2001300/2001300_merged.png'
    }
  },
  emiya_alter: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/201600/201600a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/201600/201600a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/201600/201600b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/201600/201600b@2.png',
    sprites: {
      stage1: 'https://static.atlasacademy.io/NA/CharaFigure/2016000/2016000_merged.png',
      stage2: 'https://static.atlasacademy.io/NA/CharaFigure/2016001/2016001_merged.png',
      stage3: 'https://static.atlasacademy.io/NA/CharaFigure/2016002/2016002_merged.png',
      stage4: 'https://static.atlasacademy.io/NA/CharaFigure/2016002/2016002_merged.png'
    }
  },
  heracles_berserker: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/700100/700100a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/700100/700100a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/700100/700100b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/700100/700100b@2.png',
    sprites: {
      stage1: 'https://static.atlasacademy.io/NA/CharaFigure/7001000/7001000_merged.png',
      stage2: 'https://static.atlasacademy.io/NA/CharaFigure/7001001/7001001_merged.png',
      stage3: 'https://static.atlasacademy.io/NA/CharaFigure/7001002/7001002_merged.png',
      stage4: 'https://static.atlasacademy.io/NA/CharaFigure/7001002/7001002_merged.png'
    }
  },
  cu_chulainn_lancer: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/300100/300100a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/300100/300100a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/300100/300100b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/300100/300100b@2.png',
    sprites: {
      stage1: 'https://static.atlasacademy.io/NA/CharaFigure/3001000/3001000_merged.png',
      stage2: 'https://static.atlasacademy.io/NA/CharaFigure/3001001/3001001_merged.png',
      stage3: 'https://static.atlasacademy.io/NA/CharaFigure/3001002/3001002_merged.png',
      stage4: 'https://static.atlasacademy.io/NA/CharaFigure/3001002/3001002_merged.png'
    }
  },
  karna_lancer: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/300400/300400a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/300400/300400a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/300400/300400b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/300400/300400b@2.png',
    costume: 'https://static.atlasacademy.io/NA/CharaGraph/300430/300430a.png',
    costumes: [
      { id: '300430', name: 'Super Karna (Burning Flame Armor)', url: 'https://static.atlasacademy.io/NA/CharaGraph/300430/300430a.png' }
    ],
    sprites: {
      stage1: 'https://static.atlasacademy.io/NA/CharaFigure/3004000/3004000_merged.png',
      stage2: 'https://static.atlasacademy.io/NA/CharaFigure/3004001/3004001_merged.png',
      stage3: 'https://static.atlasacademy.io/NA/CharaFigure/3004002/3004002_merged.png',
      stage4: 'https://static.atlasacademy.io/NA/CharaFigure/3004002/3004002_merged.png',
      costume: 'https://static.atlasacademy.io/NA/CharaFigure/3004300/3004300_merged.png'
    }
  },
  aoko_aozaki: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/2501400/2501400a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/2501400/2501400a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/2501400/2501400b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/2501400/2501400b@2.png',
    sprites: {
      stage1: 'https://static.atlasacademy.io/NA/CharaFigure/25014000/25014000_merged.png',
      stage2: 'https://static.atlasacademy.io/NA/CharaFigure/25014001/25014001_merged.png',
      stage3: 'https://static.atlasacademy.io/NA/CharaFigure/25014002/25014002_merged.png',
      stage4: 'https://static.atlasacademy.io/NA/CharaFigure/25014002/25014002_merged.png'
    }
  },
  artoria_caster: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/504500/504500a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/504500/504500a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/504500/504500b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/504500/504500b@2.png',
    sprites: {
      stage1: 'https://static.atlasacademy.io/NA/CharaFigure/5045000/5045000_merged.png',
      stage2: 'https://static.atlasacademy.io/NA/CharaFigure/5045001/5045001_merged.png',
      stage3: 'https://static.atlasacademy.io/NA/CharaFigure/5045002/5045002_merged.png',
      stage4: 'https://static.atlasacademy.io/NA/CharaFigure/5045002/5045002_merged.png'
    }
  },
  typhon_ephemeros: {
    stage1: 'https://static.atlasacademy.io/JP/CharaGraph/2801100/2801100a@1.png',
    stage2: 'https://static.atlasacademy.io/JP/CharaGraph/2801100/2801100a@2.png',
    stage3: 'https://static.atlasacademy.io/JP/CharaGraph/2801100/2801100b@1.png',
    stage4: 'https://static.atlasacademy.io/JP/CharaGraph/2801100/2801100b@2.png',
    costume: 'https://static.atlasacademy.io/JP/CharaGraph/2801130/2801130a.png',
    costumes: [
      { id: '2801130', name: 'Ancient Dragon Form Frame', url: 'https://static.atlasacademy.io/JP/CharaGraph/2801130/2801130a.png' }
    ],
    sprites: {
      stage1: 'https://static.atlasacademy.io/JP/CharaFigure/28011000/28011000_merged.png',
      stage2: 'https://static.atlasacademy.io/JP/CharaFigure/28011001/28011001_merged.png',
      stage3: 'https://static.atlasacademy.io/JP/CharaFigure/28011002/28011002_merged.png',
      stage4: 'https://static.atlasacademy.io/JP/CharaFigure/28011002/28011002_merged.png',
      costume: 'https://static.atlasacademy.io/JP/CharaFigure/28011300/28011300_merged.png'
    }
  },
  van_gogh: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/2500600/2500600a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/2500600/2500600a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/2500600/2500600b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/2500600/2500600b@2.png',
    sprites: {
      stage1: 'https://static.atlasacademy.io/NA/CharaFigure/25006000/25006000_merged.png',
      stage2: 'https://static.atlasacademy.io/NA/CharaFigure/25006001/25006001_merged.png',
      stage3: 'https://static.atlasacademy.io/NA/CharaFigure/25006002/25006002_merged.png',
      stage4: 'https://static.atlasacademy.io/NA/CharaFigure/25006002/25006002_merged.png'
    }
  },
  tamamo_no_mae: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/500300/500300a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/500300/500300a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/500300/500300b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/500300/500300b@2.png',
    sprites: {
      stage1: 'https://static.atlasacademy.io/NA/CharaFigure/5003000/5003000_merged.png',
      stage2: 'https://static.atlasacademy.io/NA/CharaFigure/5003001/5003001_merged.png',
      stage3: 'https://static.atlasacademy.io/NA/CharaFigure/5003002/5003002_merged.png',
      stage4: 'https://static.atlasacademy.io/NA/CharaFigure/5003002/5003002_merged.png'
    }
  }
};

/**
 * Resolves canonical ascension dataset using exact key, name, or known alias.
 */
export function findCanonicalAscensionData(identifier?: any): { key: string; data: ServantAscensionData } | undefined {
  if (!identifier) return undefined;
  const strId = typeof identifier === 'string'
    ? identifier
    : (identifier.templateId || identifier.template?.id || identifier.id || identifier.name || String(identifier));
  if (!strId || typeof strId !== 'string') return undefined;

  const raw = strId.toLowerCase().trim().replace(/[\s\-']/g, '_');
  
  if (CANONICAL_SERVANT_ASCENSIONS[raw]) {
    return { key: raw, data: CANONICAL_SERVANT_ASCENSIONS[raw] };
  }

  const ALIAS_MAP: Record<string, string> = {
    scathach: 'scathach_lancer',
    scathach_lancer: 'scathach_lancer',
    scáthach: 'scathach_lancer',
    artoria: 'artoria_pendragon',
    artoria_pendragon: 'artoria_pendragon',
    saber: 'artoria_pendragon',
    gilgamesh: 'gilgamesh_archer',
    gilgamesh_archer: 'gilgamesh_archer',
    archer: 'emiya_archer',
    emiya: 'emiya_archer',
    emiya_archer: 'emiya_archer',
    jeanne: 'jeanne_darc_ruler',
    jeanne_darc: 'jeanne_darc_ruler',
    jeanne_darc_ruler: 'jeanne_darc_ruler',
    ruler: 'jeanne_darc_ruler',
    jeanne_alter: 'jeanne_alter',
    jalter: 'jeanne_alter',
    mhx_alter: 'mhx_alter',
    ecchan: 'mhx_alter',
    mysterious_heroine_x_alter: 'mhx_alter',
    artoria_pendragon_alter: 'artoria_pendragon_alter',
    artoria_alter: 'artoria_pendragon_alter',
    saber_alter: 'artoria_pendragon_alter',
    salter: 'artoria_pendragon_alter',
    nero: 'nero_claudius_saber',
    nero_claudius: 'nero_claudius_saber',
    nero_claudius_saber: 'nero_claudius_saber',
    heracles: 'heracles_berserker',
    heracles_berserker: 'heracles_berserker',
    cu_chulainn: 'cu_chulainn_lancer',
    cu_chulainn_lancer: 'cu_chulainn_lancer',
    cú_chulainn: 'cu_chulainn_lancer',
    cu: 'cu_chulainn_lancer',
    karna: 'karna_lancer',
    karna_lancer: 'karna_lancer',
    aoko: 'aoko_aozaki',
    aoko_aozaki: 'aoko_aozaki',
    artoria_caster: 'artoria_caster',
    castoria: 'artoria_caster',
    typhon: 'typhon_ephemeros',
    typhon_ephemeros: 'typhon_ephemeros',
    ephemeros: 'typhon_ephemeros',
    van_gogh: 'van_gogh',
    gogh: 'van_gogh',
    tamamo: 'tamamo_no_mae',
    tamamo_no_mae: 'tamamo_no_mae',
    caster_tamamo: 'tamamo_no_mae',
    mikokon: 'tamamo_no_mae',
    fox_wife: 'tamamo_no_mae',
    emiya_alter: 'emiya_alter',
    edgemiya: 'emiya_alter',
    demiya: 'emiya_alter'
  };

  if (ALIAS_MAP[raw] && CANONICAL_SERVANT_ASCENSIONS[ALIAS_MAP[raw]]) {
    return { key: ALIAS_MAP[raw], data: CANONICAL_SERVANT_ASCENSIONS[ALIAS_MAP[raw]] };
  }

  for (const [key, data] of Object.entries(CANONICAL_SERVANT_ASCENSIONS)) {
    if (raw.includes(key) || key.includes(raw)) {
      return { key, data };
    }
  }

  return undefined;
}

/**
 * Returns whether a specific Ascension stage is unlocked for a servant based on level and bond level.
 * Rule:
 * - Stage 1 (Base): Unlocked at Level 1 (Default)
 * - Stage 2: Unlocked at Level 20+
 * - Stage 3: Unlocked at Level 35+
 * - Stage 4 (Final Ascension): Unlocked at Level 50+ OR Bond Level 10!
 * - Costume: Unlocked at Level 50+ OR Bond Level 5+
 */
export function isAscensionStageUnlocked(
  stage: 1 | 2 | 3 | 4 | 'costume' | string,
  level: number = 1,
  bondLevel: number = 1
): boolean {
  if (stage === 1 || stage === '1') return true;
  if (stage === 2 || stage === '2') return level >= 20;
  if (stage === 3 || stage === '3') return level >= 35;
  if (stage === 4 || stage === '4') return level >= 50 || bondLevel >= 10;
  if (stage === 'costume' || String(stage).startsWith('costume')) return level >= 50 || bondLevel >= 5;
  return true;
}

/**
 * Returns all available and unlocked Ascension stages for a given Servant.
 */
export function getUnlockedAscensionStages(
  templateId: string,
  level: number = 1,
  bondLevel: number = 1
): { stage: 1 | 2 | 3 | 4 | 'costume'; name: string; url: string; unlocked: boolean; reqText: string }[] {
  const match = findCanonicalAscensionData(templateId);
  if (!match) return [];
  const data = match.data;

  return [
    {
      stage: 1,
      name: 'Stage 1 (Base Spirit Origin)',
      url: data.stage1,
      unlocked: true,
      reqText: 'Unlocked by default'
    },
    {
      stage: 2,
      name: 'Stage 2 (Ascension 2)',
      url: data.stage2,
      unlocked: isAscensionStageUnlocked(2, level, bondLevel),
      reqText: 'Requires Level 20'
    },
    {
      stage: 3,
      name: 'Stage 3 (Ascension 3)',
      url: data.stage3,
      unlocked: isAscensionStageUnlocked(3, level, bondLevel),
      reqText: 'Requires Level 35'
    },
    {
      stage: 4,
      name: 'Stage 4 (Final Ascension)',
      url: data.stage4,
      unlocked: isAscensionStageUnlocked(4, level, bondLevel),
      reqText: 'Requires Level 50 OR Bond Level 10'
    },
    ...(data.costumes && data.costumes.length > 0
      ? data.costumes.map(c => ({
          stage: 'costume' as const,
          name: `Costume: ${c.name}`,
          url: c.url,
          unlocked: isAscensionStageUnlocked('costume', level, bondLevel),
          reqText: 'Requires Level 50 OR Bond Level 5'
        }))
      : [])
  ];
}

/**
 * Resolves the artwork URL for a servant based on their selected Ascension stage.
 * Accepts either a string templateId or a servant object instance.
 * CRITICAL: Strictly preserves custom servants' artwork untouched!
 */
export function resolveAscensionArtwork(
  servantOrTemplate: any,
  selectedStage?: 1 | 2 | 3 | 4 | 'costume' | string,
  level: number = 1,
  bondLevel: number = 1,
  fallbackUrl?: string
): string {
  if (!servantOrTemplate) return fallbackUrl || '';

  // 1. STRICT GUARANTEE: Never overwrite custom servants' artwork!
  const isCustom = typeof servantOrTemplate === 'object' && (
    servantOrTemplate.isCustom ||
    servantOrTemplate.template?.isCustom ||
    Boolean(servantOrTemplate.customArtworkUrl) ||
    Boolean(servantOrTemplate.template?.customArtworkUrl) ||
    Boolean(servantOrTemplate.isUserCreated) ||
    Boolean(servantOrTemplate.template?.isUserCreated)
  );
  if (isCustom) {
    return servantOrTemplate.customArtworkUrl ||
           servantOrTemplate.template?.customArtworkUrl ||
           servantOrTemplate.cardArtUrl ||
           servantOrTemplate.template?.cardArtUrl ||
           servantOrTemplate.avatarUrl ||
           servantOrTemplate.template?.avatarUrl ||
           fallbackUrl || '';
  }

  const templateId = typeof servantOrTemplate === 'string'
    ? servantOrTemplate
    : (servantOrTemplate.templateId || servantOrTemplate.template?.id || servantOrTemplate.id || '');

  const match = findCanonicalAscensionData(templateId);
  if (!match) {
    return typeof servantOrTemplate === 'object'
      ? (servantOrTemplate.cardArtUrl || servantOrTemplate.avatarUrl || fallbackUrl || '')
      : (fallbackUrl || '');
  }
  const data = match.data;

  const effectiveStage = selectedStage ??
                         (typeof servantOrTemplate === 'object'
                           ? (servantOrTemplate.selectedAscensionStage ?? servantOrTemplate.template?.selectedAscensionStage)
                           : undefined);
  const effLevel = (typeof servantOrTemplate === 'object' ? (servantOrTemplate.level || servantOrTemplate.template?.level) : level) || level || 1;
  const effBond = (typeof servantOrTemplate === 'object' ? (servantOrTemplate.bondLevel || servantOrTemplate.template?.bondLevel) : bondLevel) || bondLevel || 1;

  // If a specific stage is chosen, return that stage's artwork directly
  if (effectiveStage !== undefined && effectiveStage !== null && effectiveStage !== '') {
    const sStr = String(effectiveStage).toLowerCase().trim();
    if (sStr === '4' || sStr === 'stage4' || sStr === 'final') {
      return data.stage4;
    }
    if (sStr === '3' || sStr === 'stage3') {
      return data.stage3;
    }
    if (sStr === '2' || sStr === 'stage2') {
      return data.stage2;
    }
    if (sStr === '1' || sStr === 'stage1' || sStr === 'base') {
      return data.stage1;
    }
    if (sStr.includes('costume') || sStr === 'costume') {
      return data.costume || (data.costumes && data.costumes[0]?.url) || data.stage4;
    }
  }

  // Default automatic progression: return highest unlocked stage
  if (isAscensionStageUnlocked(4, effLevel, effBond)) return data.stage4;
  if (isAscensionStageUnlocked(3, effLevel, effBond)) return data.stage3;
  if (isAscensionStageUnlocked(2, effLevel, effBond)) return data.stage2;
  return data.stage1;
}

/**
 * Resolves the battle sprite URL for a servant based on their selected Ascension stage.
 * Returns the transparent Atlas Academy CharaFigure sprite for canonical servants,
 * or falls back to the servant's existing spriteUrl / custom artwork.
 * CRITICAL: Strictly preserves custom servants' avatar and spriteUrl untouched!
 */
export function resolveAscensionSprite(
  servantOrTemplate: any,
  selectedStage?: 1 | 2 | 3 | 4 | 'costume' | string,
  level: number = 1,
  bondLevel: number = 1,
  fallbackUrl?: string
): string {
  if (!servantOrTemplate) return fallbackUrl || '';

  // 1. STRICT GUARANTEE: Never overwrite custom servants' avatar or spriteUrl!
  const isCustom = servantOrTemplate.isCustom ||
                   servantOrTemplate.template?.isCustom ||
                   Boolean(servantOrTemplate.customArtworkUrl) ||
                   Boolean(servantOrTemplate.template?.customArtworkUrl) ||
                   Boolean(servantOrTemplate.isUserCreated) ||
                   Boolean(servantOrTemplate.template?.isUserCreated);
  if (isCustom) {
    return servantOrTemplate.spriteUrl ||
           servantOrTemplate.template?.spriteUrl ||
           servantOrTemplate.customArtworkUrl ||
           servantOrTemplate.template?.customArtworkUrl ||
           servantOrTemplate.avatarUrl ||
           servantOrTemplate.template?.avatarUrl ||
           fallbackUrl || '';
  }

  const templateId = typeof servantOrTemplate === 'string'
    ? servantOrTemplate
    : (servantOrTemplate.templateId || servantOrTemplate.template?.id || servantOrTemplate.id || '');
  const match = findCanonicalAscensionData(templateId);
  if (!match || !match.data.sprites) {
    return typeof servantOrTemplate === 'object'
      ? (servantOrTemplate.spriteUrl || servantOrTemplate.template?.spriteUrl || servantOrTemplate.customArtworkUrl || servantOrTemplate.avatarUrl || fallbackUrl || '')
      : (fallbackUrl || '');
  }

  const sprites = match.data.sprites;
  const effectiveStage = selectedStage ??
                         (typeof servantOrTemplate === 'object'
                           ? (servantOrTemplate.selectedAscensionStage ?? servantOrTemplate.template?.selectedAscensionStage)
                           : undefined);

  if (effectiveStage !== undefined && effectiveStage !== null && effectiveStage !== '') {
    const sStr = String(effectiveStage).toLowerCase().trim();
    if (sStr === '4' || sStr === 'stage4' || sStr === 'final') {
      return sprites.stage4 || sprites.stage3 || sprites.stage1 || '';
    }
    if (sStr === '3' || sStr === 'stage3') {
      return sprites.stage3 || sprites.stage2 || sprites.stage1 || '';
    }
    if (sStr === '2' || sStr === 'stage2') {
      return sprites.stage2 || sprites.stage1 || '';
    }
    if (sStr === '1' || sStr === 'stage1' || sStr === 'base') {
      return sprites.stage1 || '';
    }
    if (sStr.includes('costume') || sStr === 'costume') {
      return sprites.costume || sprites.stage3 || sprites.stage1 || '';
    }
  }

  // Automatic progression based on unlock level
  const effLevel = (typeof servantOrTemplate === 'object' ? (servantOrTemplate.level || servantOrTemplate.template?.level) : level) || level || 1;
  const effBond = (typeof servantOrTemplate === 'object' ? (servantOrTemplate.bondLevel || servantOrTemplate.template?.bondLevel) : bondLevel) || bondLevel || 1;
  if (isAscensionStageUnlocked(4, effLevel, effBond) && sprites.stage4) return sprites.stage4;
  if (isAscensionStageUnlocked(3, effLevel, effBond) && sprites.stage3) return sprites.stage3;
  if (isAscensionStageUnlocked(2, effLevel, effBond) && sprites.stage2) return sprites.stage2;
  return sprites.stage1 || (typeof servantOrTemplate === 'object' ? servantOrTemplate.spriteUrl : '') || '';
}

