// Official Atlas Academy CDN Assets Integration
// Provides clean, direct links to official FGO assets for items, currencies, command cards, and icons.

export const ATLAS_ITEM_ICONS = {
  saintQuartz: 'https://static.atlasacademy.io/NA/Items/6.png',
  summonTicket: 'https://static.atlasacademy.io/NA/Items/4001.png',
  manaPrism: 'https://static.atlasacademy.io/NA/Items/7.png',
  rarePrism: 'https://static.atlasacademy.io/NA/Items/18.png',
  holyGrail: 'https://static.atlasacademy.io/NA/Items/7999.png',
  grailShard: 'https://static.atlasacademy.io/NA/Items/7998.png',
  goldenApple: 'https://static.atlasacademy.io/NA/Items/100.png',
  visionaryFlames: 'https://static.atlasacademy.io/NA/Items/1000.png',
  beastFootprint: 'https://static.atlasacademy.io/NA/Items/2000.png',
  fouPaws: 'https://static.atlasacademy.io/NA/Items/2000.png',
  silverFouHp: 'https://static.atlasacademy.io/NA/Items/30011.png',
  silverFouAtk: 'https://static.atlasacademy.io/NA/Items/30012.png',
  goldenFouHp: 'https://static.atlasacademy.io/NA/Items/30021.png',
  goldenFouAtk: 'https://static.atlasacademy.io/NA/Items/30022.png',
  qp: 'https://static.atlasacademy.io/NA/Items/5.png'
} as const;

export const ATLAS_COMMAND_CARDS = {
  Buster: 'https://static.atlasacademy.io/NA/Servants/Commands/100100/card_servant_03.png',
  Arts: 'https://static.atlasacademy.io/NA/Servants/Commands/100100/card_servant_02.png',
  Quick: 'https://static.atlasacademy.io/NA/Servants/Commands/100100/card_servant_01.png',
  Extra: 'https://static.atlasacademy.io/NA/Servants/Commands/100100/card_servant_ex.png',
  NP: 'https://static.atlasacademy.io/NA/Servants/Commands/100100/card_servant_np.png'
} as const;

/**
 * Returns the official Atlas Academy item icon URL for a given item or currency key.
 */
export function getAtlasItemIcon(itemKey: keyof typeof ATLAS_ITEM_ICONS | string): string {
  const normalized = itemKey.trim();
  if (normalized in ATLAS_ITEM_ICONS) {
    return ATLAS_ITEM_ICONS[normalized as keyof typeof ATLAS_ITEM_ICONS];
  }
  return ATLAS_ITEM_ICONS.saintQuartz;
}

/**
 * Returns the official command card banner graphic for Buster, Arts, Quick, or NP.
 */
export function getAtlasCommandCardUrl(cardType: 'Buster' | 'Arts' | 'Quick' | 'Extra' | 'NP' | string): string {
  if (cardType === 'Buster') return ATLAS_COMMAND_CARDS.Buster;
  if (cardType === 'Arts') return ATLAS_COMMAND_CARDS.Arts;
  if (cardType === 'Quick') return ATLAS_COMMAND_CARDS.Quick;
  if (cardType === 'NP') return ATLAS_COMMAND_CARDS.NP;
  return ATLAS_COMMAND_CARDS.Buster;
}

/**
 * Derives an Atlas Academy Craft Essence artwork URL from its collection number.
 */
export function getAtlasCeArtUrl(collectionNo: number | string): string {
  const num = parseInt(String(collectionNo), 10);
  if (isNaN(num)) return '';
  // Standard CEs in Atlas Academy use 9400000 + padded ID
  const padded = String(num).padStart(3, '0');
  const equipId = `940${padded}0`;
  return `https://static.atlasacademy.io/NA/CharaGraph/${equipId}/${equipId}a.png`;
}

/**
 * Derives an Atlas Academy Craft Essence face/icon URL from its collection number.
 */
export function getAtlasCeFaceUrl(collectionNo: number | string): string {
  const num = parseInt(String(collectionNo), 10);
  if (isNaN(num)) return '';
  const padded = String(num).padStart(3, '0');
  const equipId = `940${padded}0`;
  return `https://static.atlasacademy.io/NA/EquipFaces/f_${equipId}0.png`;
}
