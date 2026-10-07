// Official Atlas Academy Ascension Artworks for Canonical Fate/Grand Order Servants
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
    ]
  },
  gilgamesh_archer: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/200200/200200a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/200200/200200a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/200200/200200b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/200200/200200b@2.png'
  },
  scathach_lancer: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/301300/301300a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/301300/301300a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/301300/301300b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/301300/301300b@2.png',
    costume: 'https://static.atlasacademy.io/NA/CharaGraph/301330/301330a.png',
    costumes: [
      { id: '301330', name: 'Piercing Bunny of Dun Scaith', url: 'https://static.atlasacademy.io/NA/CharaGraph/301330/301330a.png' }
    ]
  },
  jeanne_darc_ruler: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/900100/900100a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/900100/900100a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/900100/900100b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/900100/900100b@2.png',
    costume: 'https://static.atlasacademy.io/NA/CharaGraph/900130/900130a.png',
    costumes: [
      { id: '900130', name: 'Formal Holy Maiden Gown', url: 'https://static.atlasacademy.io/NA/CharaGraph/900130/900130a.png' }
    ]
  },
  jeanne_alter: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/1100300/1100300a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/1100300/1100300a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/1100300/1100300b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/1100300/1100300b@2.png',
    costume: 'https://static.atlasacademy.io/NA/CharaGraph/1100330/1100330a.png',
    costumes: [
      { id: '1100330', name: 'Shinjuku 1999 Casual Dress', url: 'https://static.atlasacademy.io/NA/CharaGraph/1100330/1100330a.png' }
    ]
  },
  mhx_alter: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/702400/702400a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/702400/702400a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/702400/702400b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/702400/702400b@2.png'
  },
  artoria_pendragon_alter: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/100200/100200a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/100200/100200a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/100200/100200b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/100200/100200b@2.png',
    costume: 'https://static.atlasacademy.io/NA/CharaGraph/100230/100230a.png',
    costumes: [
      { id: '100230', name: 'Shinjuku 1999 Leather Jacket', url: 'https://static.atlasacademy.io/NA/CharaGraph/100230/100230a.png' }
    ]
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
    ]
  },
  emiya_archer: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/200100/200100a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/200100/200100a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/200100/200100b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/200100/200100b@2.png',
    costume: 'https://static.atlasacademy.io/NA/CharaGraph/200130/200130a.png',
    costumes: [
      { id: '200130', name: 'Summer Butler Chaldea Apron', url: 'https://static.atlasacademy.io/NA/CharaGraph/200130/200130a.png' }
    ]
  },
  heracles_berserker: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/700100/700100a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/700100/700100a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/700100/700100b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/700100/700100b@2.png'
  },
  cu_chulainn_lancer: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/300100/300100a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/300100/300100a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/300100/300100b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/300100/300100b@2.png'
  },
  karna_lancer: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/300400/300400a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/300400/300400a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/300400/300400b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/300400/300400b@2.png',
    costume: 'https://static.atlasacademy.io/NA/CharaGraph/300430/300430a.png',
    costumes: [
      { id: '300430', name: 'Super Karna (Burning Flame Armor)', url: 'https://static.atlasacademy.io/NA/CharaGraph/300430/300430a.png' }
    ]
  },
  aoko_aozaki: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/2501400/2501400a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/2501400/2501400a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/2501400/2501400b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/2501400/2501400b@2.png'
  },
  artoria_caster: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/504500/504500a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/504500/504500a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/504500/504500b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/504500/504500b@2.png'
  },
  typhon_ephemeros: {
    stage1: 'https://static.atlasacademy.io/JP/CharaGraph/2801100/2801100a@1.png',
    stage2: 'https://static.atlasacademy.io/JP/CharaGraph/2801100/2801100a@2.png',
    stage3: 'https://static.atlasacademy.io/JP/CharaGraph/2801100/2801100b@1.png',
    stage4: 'https://static.atlasacademy.io/JP/CharaGraph/2801100/2801100b@2.png',
    costume: 'https://static.atlasacademy.io/JP/CharaGraph/2801130/2801130a.png',
    costumes: [
      { id: '2801130', name: 'Ancient Dragon Form Frame', url: 'https://static.atlasacademy.io/JP/CharaGraph/2801130/2801130a.png' }
    ]
  },
  van_gogh: {
    stage1: 'https://static.atlasacademy.io/NA/CharaGraph/2500600/2500600a@1.png',
    stage2: 'https://static.atlasacademy.io/NA/CharaGraph/2500600/2500600a@2.png',
    stage3: 'https://static.atlasacademy.io/NA/CharaGraph/2500600/2500600b@1.png',
    stage4: 'https://static.atlasacademy.io/NA/CharaGraph/2500600/2500600b@2.png'
  }
};

/**
 * Resolves canonical ascension dataset using exact key, name, or known alias.
 */
export function findCanonicalAscensionData(identifier?: string): { key: string; data: ServantAscensionData } | undefined {
  if (!identifier) return undefined;
  const raw = identifier.toLowerCase().trim().replace(/[\s\-']/g, '_');
  
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
    gogh: 'van_gogh'
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
 */
export function resolveAscensionArtwork(
  templateId: string,
  selectedStage?: 1 | 2 | 3 | 4 | 'costume' | string,
  level: number = 1,
  bondLevel: number = 1,
  fallbackUrl?: string
): string {
  const match = findCanonicalAscensionData(templateId);
  if (!match) return fallbackUrl || '';
  const data = match.data;

  // If a specific stage is chosen, return that stage's artwork directly
  if (selectedStage !== undefined && selectedStage !== null && selectedStage !== '') {
    const sStr = String(selectedStage).toLowerCase().trim();
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
  if (isAscensionStageUnlocked(4, level, bondLevel)) return data.stage4;
  if (isAscensionStageUnlocked(3, level, bondLevel)) return data.stage3;
  if (isAscensionStageUnlocked(2, level, bondLevel)) return data.stage2;
  return data.stage1;
}
