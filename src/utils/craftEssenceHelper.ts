import { CraftEssence } from '../types';

export interface CePassiveSummary {
  atkBonus: number;
  hpBonus: number;
  busterUp: number;
  artsUp: number;
  quickUp: number;
  critDmgUp: number;
  npDmgUp: number;
  npGainUp: number;
  starGatherUp: number;
  starGainUp: number;
  startingNp: number;
  gutsCount: number;
  gutsReviveHp: number;
  isGutsPercent: boolean;
  hpRegenPerTurn: number;
  starsPerTurn: number;
  npPerTurn: number;
  defUp: number;
  damageCut: number;
  targetAllies: boolean;
  buffOnAttackFruit: boolean; // Typhon Ephemeros's Ephemeral Fruit
  invincibleHits: number;
  ignoreInvincible: boolean;
  sureHit: boolean;
  antiPurgeAtk: boolean;
}

export interface CePartyPassiveSummary {
  partyAtkUp: number;
  partyDefUp: number;
  partyArtsUp: number;
  partyBusterUp: number;
  partyQuickUp: number;
  partyCritDmgUp: number;
  partyNpDmgUp: number;
  partyNpGainUp: number;
  partyDamageCut: number;
}

/**
 * Strict canonical alias mapping to ensure Alter, Caster, and base servants never collide.
 */
const CANONICAL_SERVANT_ALIASES: Record<string, string[]> = {
  altera: ['altera', 'attila', 'attila the hun', 'great king of destruction', 'destroyer of civilization', 'etzel', 'king of combat', 'saber_altera'],
  artoria_pendragon: ['artoria_pendragon', 'artoria', 'saber_artoria', 'king of knights'],
  artoria_pendragon_alter: ['artoria_pendragon_alter', 'artoria_alter', 'salter', 'saber alter'],
  artoria_caster: ['artoria_caster', 'castoria', 'caster artoria'],
  gilgamesh_archer: ['gilgamesh_archer', 'gilgamesh', 'king of heroes', 'archer_gilgamesh'],
  scathach_lancer: ['scathach_lancer', 'scathach', 'shishou', 'lancer_scathach'],
  jeanne_darc_ruler: ['jeanne_darc_ruler', 'jeanne_darc', 'jeanne', 'ruler_jeanne', 'holy maiden'],
  jeanne_alter: ['jeanne_alter', 'jalter', 'avenger_jeanne', 'dragon witch'],
  mhx_alter: ['mhx_alter', 'mysterious_heroine_x_alter', 'ecchan', 'berserker_mhx_alter'],
  nero_claudius_saber: ['nero_claudius_saber', 'nero_claudius', 'nero', 'emperor nero', 'saber_nero'],
  emiya_archer: ['emiya_archer', 'emiya', 'nameless', 'archer_emiya'],
  heracles_berserker: ['heracles_berserker', 'heracles', 'berserker_heracles', 'herakles'],
  cu_chulainn_lancer: ['cu_chulainn_lancer', 'cu_chulainn', 'cu', 'setanta', 'lancer_cu'],
  karna_lancer: ['karna_lancer', 'karna', 'hero of charity', 'lancer_karna'],
  adiosa_dragon_envoy: ['adiosa_dragon_envoy', 'adiosa', 'dragon envoy'],
  aoko_aozaki: ['aoko_aozaki', 'aoko', 'fifth magician', 'miss blue'],
  amamiya_no_chihaya_tenkohime: ['amamiya_no_chihaya_tenkohime', 'amamiya_no_chihaya', 'chihaya', 'tenkohime'],
  lucia_lyozes: ['lucia_lyozes', 'lucia', 'vanguard lucia'],
  luvria_greenharte: ['luvria_greenharte', 'luvria', 'greenharte'],
  edmond: ['edmond', 'edmond_tank', 'shielder_edmond', 's-rank adventurer'],
  typhon_ephemeros: ['typhon_ephemeros', 'typhon', 'progenitor dragon'],
  van_gogh: ['van_gogh', 'gogh', 'clytie van gogh'],
  tamamo_no_mae: ['tamamo_no_mae', 'tamamo', 'caster of extra', 'mikokon', 'fox wife', 'caster_tamamo']
};

/**
 * Checks whether a Craft Essence's special bond passives are active for a given servant.
 * In canonical Fate lore and mechanics, Bond CEs ONLY activate their special passives
 * when equipped to their matching Heroic Spirit!
 * Standard non-bond CEs are universally active on any servant.
 */
export function isBondCeActiveForServant(ce: any, servant: any): boolean {
  if (!ce) return false;
  // If not a bond CE, its standard passives always apply
  if (!ce.isBondCe && !ce.bondServantId && !ce.id?.startsWith('ce_bond_')) {
    return true;
  }
  if (!servant) return false;

  const sId = (servant.templateId || servant.template?.id || servant.id || '').toLowerCase().trim();
  const sName = (servant.template?.name || servant.name || '').toLowerCase().trim();
  const bId = (ce.bondServantId || '').toLowerCase().trim();
  const bName = (ce.bondServantName || '').toLowerCase().trim();
  const ceId = (ce.id || '').toLowerCase().trim();

  // 1. Direct identifier match
  if (bId && (sId === bId || sName === bName)) {
    return true;
  }

  // 2. Strict variant distinction to prevent Alter/Caster cross-contamination
  const isAlterServant = sId.includes('alter') || sName.includes('alter');
  const isAlterCe = bId.includes('alter') || bName.includes('alter') || ceId.includes('alter');
  if (isAlterServant !== isAlterCe) {
    return false;
  }

  const isCasterServant = sId.includes('caster') || sName.includes('caster');
  const isCasterCe = bId.includes('caster') || bName.includes('caster') || ceId.includes('caster');
  if (isCasterServant !== isCasterCe) {
    return false;
  }

  // 3. Match against canonical alias groups
  for (const [canonicalKey, aliases] of Object.entries(CANONICAL_SERVANT_ALIASES)) {
    const servantMatches = aliases.some(a => sId === a || sName.includes(a));
    const ceMatches = aliases.some(a => bId === a || bName.includes(a) || ceId.includes(a));

    if (servantMatches && ceMatches) {
      return true;
    }
  }

  // 4. Fallback: exact sub-token matching if bondServantId is specified
  if (bId && sId) {
    const sTokens = sId.split(/[^a-z0-9]+/);
    const bTokens = bId.split(/[^a-z0-9]+/);
    const commonTokens = sTokens.filter((t: string) => t.length > 3 && bTokens.includes(t));
    if (commonTokens.length > 0 && isAlterServant === isAlterCe && isCasterServant === isCasterCe) {
      return true;
    }
  }

  return false;
}

/**
 * Returns comprehensive passive stats for a CE, enforcing servant compatibility for Bond CEs.
 */
export function getCePassiveStats(ce: any, servant?: any): CePassiveSummary {
  const summary: CePassiveSummary = {
    atkBonus: ce?.atkBonus || ce?.bonusAtk || 0,
    hpBonus: ce?.hpBonus || ce?.bonusHp || 0,
    busterUp: 0,
    artsUp: 0,
    quickUp: 0,
    critDmgUp: 0,
    npDmgUp: 0,
    npGainUp: 0,
    starGatherUp: 0,
    starGainUp: 0,
    startingNp: 0,
    gutsCount: 0,
    gutsReviveHp: 0,
    isGutsPercent: false,
    hpRegenPerTurn: 0,
    starsPerTurn: 0,
    npPerTurn: 0,
    defUp: 0,
    damageCut: 0,
    targetAllies: false,
    buffOnAttackFruit: false,
    invincibleHits: 0,
    ignoreInvincible: false,
    sureHit: false,
    antiPurgeAtk: false
  };

  if (!ce) return summary;

  // If a servant is provided and this is a Bond CE, verify active match
  const isBond = ce.isBondCe || ce.bondServantId || ce.id?.startsWith('ce_bond_');
  if (isBond && servant && !isBondCeActiveForServant(ce, servant)) {
    // Only flat ATK/HP apply when mismatched; special passives are suppressed
    return summary;
  }

  const ceId = (ce.id || '').toLowerCase();
  const ceName = (ce.name || '').toLowerCase();
  const pType = (ce.passiveType || '').toLowerCase();
  const pVal = Number(ce.passiveValue) || 0;

  // --------------------------------------------------------------------------
  // 1. STANDARD CRAFT ESSENCES
  // --------------------------------------------------------------------------
  if (ceId === 'ce_kaleidoscope') {
    summary.startingNp = 80;
  } else if (ceId === 'ce_the_imaginary_element' || ceId === 'ce_imaginary_element' || ceId === 'ce_hollow_magic') {
    summary.startingNp = 60;
  } else if (ceId === 'ce_dragon_meridian') {
    summary.startingNp = 50;
  } else if (ceId === 'ce_jeweled_sword') {
    summary.startingNp = 40;
    summary.npGainUp += 15;
  } else if (ceId === 'ce_black_grail') {
    summary.npDmgUp += 60;
    // demerit handled during battle turn end
  } else if (ceId === 'ce_formal_craft') {
    summary.artsUp += 25;
  } else if (ceId === 'ce_limited_zero_over') {
    summary.busterUp += 25;
  } else if (ceId === 'ce_imaginary_around') {
    summary.quickUp += 25;
  } else if (ceId === 'ce_victor_of_the_moon') {
    summary.busterUp += 10;
    summary.critDmgUp += 20;
  } else if (ceId === 'ce_another_ending') {
    summary.artsUp += 10;
    summary.critDmgUp += 20;
  } else if (ceId === 'ce_fragment_of_2030' || ceName.includes('2030')) {
    summary.starsPerTurn += 8;
  } else if (ceId === 'ce_volumen_hydragyrum') {
    summary.invincibleHits = 3;
    summary.damageCut = 200;
  } else if (ceId === 'ce_origin_bullet') {
    summary.ignoreInvincible = true;
    summary.damageCut = 100;
  } else if (ceId === 'ce_code_cast') {
    summary.atkBonus += 200;
    summary.defUp += 10;
  }

  // --------------------------------------------------------------------------
  // 2. CANONICAL BOND CRAFT ESSENCES
  // --------------------------------------------------------------------------
  if (ceId === 'ce_bond_artoria_pendragon' || ceName.includes('crown of stars') || ceName.includes('star of artoria')) {
    // Note: Party ATK +15% is handled via getCePartyPassiveStats
  } else if (ceId === 'ce_bond_altera' || ceName.includes('eternal solitude')) {
    // Note: Party & self ATK +20% is handled via getCePartyPassiveStats
  } else if (ceId === 'ce_bond_heracles_berserker' || ceName.includes('castle of snow')) {
    summary.gutsCount = 3;
    summary.gutsReviveHp = 500;
    summary.isGutsPercent = false;
  } else if (ceId === 'ce_bond_gilgamesh_archer' || ceName.includes("the king's law") || ceName.includes('bab-ilu')) {
    // Note: Party NP DMG +20% is handled via getCePartyPassiveStats
  } else if (ceId === 'ce_bond_scathach_lancer' || ceName.includes('gazing upon dún scáith') || ceName.includes('gate of skye')) {
    // Note: Party Quick +15% is handled via getCePartyPassiveStats
  } else if (ceId === 'ce_bond_jeanne_darc_ruler' || ceName.includes('revelation from heaven') || ceName.includes('luminosité')) {
    // Note: Party Buster +15% is handled via getCePartyPassiveStats
  } else if (ceId === 'ce_bond_jeanne_alter' || ceName.includes('hell of blazing punishment') || ceName.includes("cursed dragon's roar")) {
    // Note: Party Buster +15% is handled via getCePartyPassiveStats
  } else if (ceId === 'ce_bond_mhx_alter' || ceName.includes('dark knight-kun') || ceName.includes('darkness-infused anpan')) {
    // Note: Party ATK against Sabers (+20%) is handled via getCePartyPassiveStats
  } else if (ceId === 'ce_bond_artoria_pendragon_alter' || ceName.includes('memories of the dragon') || ceName.includes("dragon's memory")) {
    summary.npDmgUp += 30;
  } else if (ceId === 'ce_bond_nero_claudius_saber' || ceName.includes('thunderous applause') || ceName.includes("golden maiden's laurel")) {
    // Note: Party Arts +15% is handled via getCePartyPassiveStats
  } else if (ceId === 'ce_bond_emiya_archer' || ceName.includes('hunter of the red plains') || ceName.includes('faded wrought iron')) {
    summary.npDmgUp += 30;
  } else if (ceId === 'ce_bond_cu_chulainn_lancer' || ceName.includes('star of prophecy') || ceName.includes('red mead of ulster')) {
    summary.npDmgUp += 30;
  } else if (ceId === 'ce_bond_karna_lancer' || ceName.includes("poor man's lamp") || ceName.includes("kavacha and kundala")) {
    // Note: Party Arts, Buster, Quick +8% is handled via getCePartyPassiveStats
  } else if (ceId === 'ce_bond_adiosa_dragon_envoy' || ceName.includes('cosmic dragon fang')) {
    summary.busterUp += 20;
    summary.starsPerTurn += 10;
  } else if (ceId === 'ce_bond_aoko_aozaki' || ceName.includes('waiting in the sky') || ceName.includes('magic blueprint')) {
    summary.npDmgUp += 30;
  } else if (ceId === 'ce_bond_amamiya_no_chihaya_tenkohime' || ceName.includes("tenko's divine mirror")) {
    summary.artsUp += 20;
    summary.npPerTurn += 10;
  } else if (ceId === 'ce_bond_lucia_lyozes' || ceName.includes('the closed door insignia')) {
    summary.critDmgUp += 25;
    summary.starGatherUp += 30;
  } else if (ceId === 'ce_bond_luvria_greenharte' || ceName.includes('the boundless weave')) {
    summary.npDmgUp += 20;
    // Note: Party Arts +15% is handled via getCePartyPassiveStats
  } else if (ceId === 'ce_bond_edmond' || ceName.includes('aegis of the sunken slums')) {
    summary.defUp += 20;
    summary.damageCut += 1000;
    summary.gutsCount = 1;
    summary.gutsReviveHp = 20;
    summary.isGutsPercent = true;
    summary.targetAllies = true;
    // Note: Party Damage Cut 1000 handled via getCePartyPassiveStats
  } else if (ceId === 'ce_bond_artoria_caster' || ceName.includes('the promised moment')) {
    // Note: Party ATK +10% & Party NP Gain +10% handled via getCePartyPassiveStats
  } else if (ceId === 'ce_bond_typhon_ephemeros' || ceName.includes('ephemeral fruit')) {
    summary.npDmgUp += 30;
    summary.buffOnAttackFruit = true;
  } else if (ceId === 'ce_bond_van_gogh' || ceName.includes('self-portrait at chaldea')) {
    summary.starsPerTurn += 8;
    // Note: Party Crit DMG +15% handled via getCePartyPassiveStats
  } else if (ceId === 'ce_bond_tamamo_no_mae' || ceName.includes("tamamo's fan club") || ceName.includes('tamamo club') || ceName.includes('fan club')) {
    // Note: Party Arts +15% handled via getCePartyPassiveStats
  }

  // --------------------------------------------------------------------------
  // 3. GENERIC PASSIVE FALLBACKS
  // --------------------------------------------------------------------------
  if (pType === 'buster_up') summary.busterUp = Math.max(summary.busterUp, pVal);
  else if (pType === 'arts_up') summary.artsUp = Math.max(summary.artsUp, pVal);
  else if (pType === 'quick_up') summary.quickUp = Math.max(summary.quickUp, pVal);
  else if (pType === 'crit_dmg' || pType === 'crit_damage') summary.critDmgUp = Math.max(summary.critDmgUp, pVal);
  else if (pType === 'np_damage' || pType === 'np_dmg') summary.npDmgUp = Math.max(summary.npDmgUp, pVal);
  else if (pType === 'starting_np') summary.startingNp = Math.max(summary.startingNp, pVal);
  else if (pType === 'stars_per_turn') summary.starsPerTurn = Math.max(summary.starsPerTurn, pVal);
  else if (pType === 'hp_regen') summary.hpRegenPerTurn = Math.max(summary.hpRegenPerTurn, pVal);
  else if (pType === 'def_up') summary.defUp = Math.max(summary.defUp, pVal);
  else if (pType === 'guts' && summary.gutsCount === 0) {
    summary.gutsCount = pVal > 0 ? pVal : 1;
    summary.gutsReviveHp = 1000;
  } else if (pType === 'invincible_hits') {
    summary.invincibleHits = Math.max(summary.invincibleHits, pVal || 3);
  } else if (pType === 'ignore_invincible') {
    summary.ignoreInvincible = true;
  } else if (pType === 'sure_hit') {
    summary.sureHit = true;
  } else if (pType === 'anti_purge_atk') {
    summary.antiPurgeAtk = true;
  }

  return summary;
}

/**
 * Returns party-wide aura bonuses granted by a Craft Essence (when equipped to its matching servant).
 */
export function getCePartyPassiveStats(ce: any, servant?: any): CePartyPassiveSummary {
  const partyStats: CePartyPassiveSummary = {
    partyAtkUp: 0,
    partyDefUp: 0,
    partyArtsUp: 0,
    partyBusterUp: 0,
    partyQuickUp: 0,
    partyCritDmgUp: 0,
    partyNpDmgUp: 0,
    partyNpGainUp: 0,
    partyDamageCut: 0
  };

  if (!ce) return partyStats;

  // If a servant is provided and this is a Bond CE, verify active match
  const isBond = ce.isBondCe || ce.bondServantId || ce.id?.startsWith('ce_bond_');
  if (isBond && servant && !isBondCeActiveForServant(ce, servant)) {
    return partyStats;
  }

  const ceId = (ce.id || '').toLowerCase();
  const ceName = (ce.name || '').toLowerCase();

  // Artoria: Party ATK +15%
  if (ceId === 'ce_bond_artoria_pendragon' || ceName.includes('crown of stars') || ceName.includes('star of artoria')) {
    partyStats.partyAtkUp += 15;
  }
  // Altera: Increases party's and self attack by 20% while self is on the field
  if (ceId === 'ce_bond_altera' || ceName.includes('eternal solitude')) {
    partyStats.partyAtkUp += 20;
  }
  // Gilgamesh: Party NP DMG +20%
  if (ceId === 'ce_bond_gilgamesh_archer' || ceName.includes("the king's law") || ceName.includes('bab-ilu')) {
    partyStats.partyNpDmgUp += 20;
  }
  // Scáthach: Party Quick +15%
  if (ceId === 'ce_bond_scathach_lancer' || ceName.includes('gazing upon dún scáith') || ceName.includes('gate of skye')) {
    partyStats.partyQuickUp += 15;
  }
  // Jeanne d'Arc (Ruler): Party Buster +15%
  if (ceId === 'ce_bond_jeanne_darc_ruler' || ceName.includes('revelation from heaven') || ceName.includes('luminosité')) {
    partyStats.partyBusterUp += 15;
  }
  // Jeanne d'Arc (Alter): Party Buster +15%
  if (ceId === 'ce_bond_jeanne_alter' || ceName.includes('hell of blazing punishment') || ceName.includes("cursed dragon's roar")) {
    partyStats.partyBusterUp += 15;
  }
  // MHX Alter: Party ATK against Sabers / Party ATK +20%
  if (ceId === 'ce_bond_mhx_alter' || ceName.includes('dark knight-kun') || ceName.includes('darkness-infused anpan')) {
    partyStats.partyAtkUp += 20;
  }
  // Nero Claudius: Party Arts +15%
  if (ceId === 'ce_bond_nero_claudius_saber' || ceName.includes('thunderous applause') || ceName.includes("golden maiden's laurel")) {
    partyStats.partyArtsUp += 15;
  }
  // Karna: Party Arts +8%, Party Buster +8%, Party Quick +8%
  if (ceId === 'ce_bond_karna_lancer' || ceName.includes("poor man's lamp") || ceName.includes('kavacha and kundala')) {
    partyStats.partyArtsUp += 8;
    partyStats.partyBusterUp += 8;
    partyStats.partyQuickUp += 8;
  }
  // Luvria: Party Arts +15%
  if (ceId === 'ce_bond_luvria_greenharte' || ceName.includes('the boundless weave')) {
    partyStats.partyArtsUp += 15;
  }
  // Artoria Caster: Party ATK +10%, Party NP Gain +10%
  if (ceId === 'ce_bond_artoria_caster' || ceName.includes('the promised moment')) {
    partyStats.partyAtkUp += 10;
    partyStats.partyNpGainUp += 10;
  }
  // Van Gogh: Party Crit DMG +15%
  if (ceId === 'ce_bond_van_gogh' || ceName.includes('self-portrait at chaldea')) {
    partyStats.partyCritDmgUp += 15;
  }
  // Edmond: Party Damage Cut 1000
  if (ceId === 'ce_bond_edmond' || ceName.includes('aegis of the sunken slums')) {
    partyStats.partyDamageCut += 1000;
  }
  // Tamamo no Mae: Party Arts +15%
  if (ceId === 'ce_bond_tamamo_no_mae' || ceName.includes("tamamo's fan club") || ceName.includes('tamamo club') || ceName.includes('fan club')) {
    partyStats.partyArtsUp += 15;
  }

  return partyStats;
}

/**
 * Applies initial combatant effects from the equipped Craft Essence to a combatant.
 * Used at the start of Duel and Raid encounters.
 */
export function applyCeInitialCombatantEffects(combatant: any, allAllies?: any[]): void {
  if (!combatant || !combatant.servant) return;
  const ce = combatant.servant.equippedCe;
  if (!ce) return;

  const ceStats = getCePassiveStats(ce, combatant.servant);
  if (!combatant.activeBuffs) combatant.activeBuffs = [];

  // 1. Starting NP Gauge
  if (ceStats.startingNp > 0) {
    combatant.npGauge = Math.min(100, Math.max(combatant.npGauge || 0, ceStats.startingNp));
  }

  // 2. Guts
  if (ceStats.gutsCount > 0 && !combatant.activeBuffs.some((b: any) => b.name?.includes('(Guts)'))) {
    const maxHp = combatant.maxHp || 28000;
    const reviveVal = ceStats.isGutsPercent
      ? Math.round(maxHp * (ceStats.gutsReviveHp / 100))
      : (ceStats.gutsReviveHp || 1000);

    combatant.activeBuffs.push({
      name: `${ce.name} (Guts x${ceStats.gutsCount})`,
      type: 'guts',
      value: reviveVal,
      remainingTurns: 99,
      remainingHits: ceStats.gutsCount,
      isHitCount: true
    });
  }

  // 3. Invincibility (e.g. Volumen Hydragyrum)
  if (ceStats.invincibleHits > 0 && !combatant.activeBuffs.some((b: any) => b.name?.includes('Volumen Hydragyrum (Invincibility)'))) {
    combatant.activeBuffs.push({
      name: `${ce.name} (Invincibility)`,
      type: 'invincible',
      value: 100,
      remainingTurns: 99,
      remainingHits: ceStats.invincibleHits,
      isHitCount: true
    });
    combatant.isInvincible = true;
  }

  // 4. Damage Cut
  if (ceStats.damageCut > 0 && !combatant.activeBuffs.some((b: any) => b.name?.includes('Damage Cut') && b.name?.includes(ce.name))) {
    combatant.activeBuffs.push({
      name: `${ce.name} (Damage Cut)`,
      type: 'damage_cut',
      value: ceStats.damageCut,
      remainingTurns: 99
    });
  }

  // 5. Defense Up
  if (ceStats.defUp > 0 && !combatant.activeBuffs.some((b: any) => b.name?.includes('DEF Up') && b.name?.includes(ce.name))) {
    combatant.activeBuffs.push({
      name: `${ce.name} (DEF Up)`,
      type: 'buff_def',
      value: ceStats.defUp,
      remainingTurns: 99
    });
  }

  // 6. Card Performance Buffs (Buster / Arts / Quick)
  if (ceStats.busterUp > 0 && !combatant.activeBuffs.some((b: any) => b.name?.includes(`${ce.name} (Buster Up)`))) {
    combatant.activeBuffs.push({
      name: `${ce.name} (Buster Up)`,
      type: 'buster_up',
      value: ceStats.busterUp,
      remainingTurns: 99
    });
  }
  if (ceStats.artsUp > 0 && !combatant.activeBuffs.some((b: any) => b.name?.includes(`${ce.name} (Arts Up)`))) {
    combatant.activeBuffs.push({
      name: `${ce.name} (Arts Up)`,
      type: 'arts_up',
      value: ceStats.artsUp,
      remainingTurns: 99
    });
  }
  if (ceStats.quickUp > 0 && !combatant.activeBuffs.some((b: any) => b.name?.includes(`${ce.name} (Quick Up)`))) {
    combatant.activeBuffs.push({
      name: `${ce.name} (Quick Up)`,
      type: 'quick_up',
      value: ceStats.quickUp,
      remainingTurns: 99
    });
  }

  // 7. Critical Damage & NP Damage Up
  if (ceStats.critDmgUp > 0 && !combatant.activeBuffs.some((b: any) => b.name?.includes(`${ce.name} (Crit DMG Up)`))) {
    combatant.activeBuffs.push({
      name: `${ce.name} (Crit DMG Up)`,
      type: 'crit_dmg',
      value: ceStats.critDmgUp,
      remainingTurns: 99
    });
  }
  if (ceStats.npDmgUp > 0 && !combatant.activeBuffs.some((b: any) => b.name?.includes(`${ce.name} (NP DMG Up)`))) {
    combatant.activeBuffs.push({
      name: `${ce.name} (NP DMG Up)`,
      type: 'np_dmg',
      value: ceStats.npDmgUp,
      remainingTurns: 99
    });
  }

  // 8. NP Gain Up
  if (ceStats.npGainUp > 0 && !combatant.activeBuffs.some((b: any) => b.name?.includes(`${ce.name} (NP Gain Up)`))) {
    combatant.activeBuffs.push({
      name: `${ce.name} (NP Gain Up)`,
      type: 'np_gain_up',
      value: ceStats.npGainUp,
      remainingTurns: 99
    });
  }

  // 9. Star Gather Up
  if (ceStats.starGatherUp > 0 && !combatant.activeBuffs.some((b: any) => b.name?.includes(`${ce.name} (Star Gather Up)`))) {
    combatant.activeBuffs.push({
      name: `${ce.name} (Star Gather Up)`,
      type: 'star_gather_up',
      value: ceStats.starGatherUp,
      remainingTurns: 99
    });
  }

  // 10. Ignore Invincible
  if (ceStats.ignoreInvincible && !combatant.activeBuffs.some((b: any) => b.type === 'ignore_invincible')) {
    combatant.activeBuffs.push({
      name: `${ce.name} (Ignore Invincible)`,
      type: 'ignore_invincible',
      value: 35,
      remainingTurns: 99
    });
  }

  // 11. Buff-On-Attack for Typhon Ephemeros
  if (ceStats.buffOnAttackFruit && !combatant.activeBuffs.some((b: any) => b.type === 'buff_on_attack_fruit')) {
    combatant.activeBuffs.push({
      name: 'Ephemeral Fruit: Blessing & Curse',
      type: 'buff_on_attack_fruit',
      value: 10,
      remainingTurns: 99
    });
  }
}

/**
 * Distributes party-wide auras from equipped CEs across all allies in the battle.
 */
export function applyCePartyAuras(combatants: any[]): void {
  if (!Array.isArray(combatants) || combatants.length === 0) return;

  for (const combatant of combatants) {
    if (!combatant || combatant.isDead || !combatant.servant?.equippedCe) continue;
    const ce = combatant.servant.equippedCe;
    const partyStats = getCePartyPassiveStats(ce, combatant.servant);

    // Distribute auras to all combatants
    for (const ally of combatants) {
      if (!ally || ally.isDead) continue;
      if (!ally.activeBuffs) ally.activeBuffs = [];

      // Party ATK Up
      if (partyStats.partyAtkUp > 0 && !ally.activeBuffs.some((b: any) => b.name === `${ce.name} Aura (Party ATK +${partyStats.partyAtkUp}%)`)) {
        ally.activeBuffs.push({
          name: `${ce.name} Aura (Party ATK +${partyStats.partyAtkUp}%)`,
          type: 'buff_atk',
          value: partyStats.partyAtkUp,
          remainingTurns: 99
        });
      }

      // Party DEF Up
      if (partyStats.partyDefUp > 0 && !ally.activeBuffs.some((b: any) => b.name === `${ce.name} Aura (Party DEF +${partyStats.partyDefUp}%)`)) {
        ally.activeBuffs.push({
          name: `${ce.name} Aura (Party DEF +${partyStats.partyDefUp}%)`,
          type: 'buff_def',
          value: partyStats.partyDefUp,
          remainingTurns: 99
        });
      }

      // Party Arts Up
      if (partyStats.partyArtsUp > 0 && !ally.activeBuffs.some((b: any) => b.name === `${ce.name} Aura (Party Arts +${partyStats.partyArtsUp}%)`)) {
        ally.activeBuffs.push({
          name: `${ce.name} Aura (Party Arts +${partyStats.partyArtsUp}%)`,
          type: 'arts_up',
          value: partyStats.partyArtsUp,
          remainingTurns: 99
        });
      }

      // Party Buster Up
      if (partyStats.partyBusterUp > 0 && !ally.activeBuffs.some((b: any) => b.name === `${ce.name} Aura (Party Buster +${partyStats.partyBusterUp}%)`)) {
        ally.activeBuffs.push({
          name: `${ce.name} Aura (Party Buster +${partyStats.partyBusterUp}%)`,
          type: 'buster_up',
          value: partyStats.partyBusterUp,
          remainingTurns: 99
        });
      }

      // Party Quick Up
      if (partyStats.partyQuickUp > 0 && !ally.activeBuffs.some((b: any) => b.name === `${ce.name} Aura (Party Quick +${partyStats.partyQuickUp}%)`)) {
        ally.activeBuffs.push({
          name: `${ce.name} Aura (Party Quick +${partyStats.partyQuickUp}%)`,
          type: 'quick_up',
          value: partyStats.partyQuickUp,
          remainingTurns: 99
        });
      }

      // Party NP DMG Up
      if (partyStats.partyNpDmgUp > 0 && !ally.activeBuffs.some((b: any) => b.name === `${ce.name} Aura (Party NP DMG +${partyStats.partyNpDmgUp}%)`)) {
        ally.activeBuffs.push({
          name: `${ce.name} Aura (Party NP DMG +${partyStats.partyNpDmgUp}%)`,
          type: 'np_dmg',
          value: partyStats.partyNpDmgUp,
          remainingTurns: 99
        });
      }

      // Party Crit DMG Up
      if (partyStats.partyCritDmgUp > 0 && !ally.activeBuffs.some((b: any) => b.name === `${ce.name} Aura (Party Crit DMG +${partyStats.partyCritDmgUp}%)`)) {
        ally.activeBuffs.push({
          name: `${ce.name} Aura (Party Crit DMG +${partyStats.partyCritDmgUp}%)`,
          type: 'crit_dmg',
          value: partyStats.partyCritDmgUp,
          remainingTurns: 99
        });
      }

      // Party NP Gain Up
      if (partyStats.partyNpGainUp > 0 && !ally.activeBuffs.some((b: any) => b.name === `${ce.name} Aura (Party NP Gain +${partyStats.partyNpGainUp}%)`)) {
        ally.activeBuffs.push({
          name: `${ce.name} Aura (Party NP Gain +${partyStats.partyNpGainUp}%)`,
          type: 'np_gain_up',
          value: partyStats.partyNpGainUp,
          remainingTurns: 99
        });
      }

      // Party Damage Cut
      if (partyStats.partyDamageCut > 0 && !ally.activeBuffs.some((b: any) => b.name === `${ce.name} Aura (Damage Cut -${partyStats.partyDamageCut})`)) {
        ally.activeBuffs.push({
          name: `${ce.name} Aura (Damage Cut -${partyStats.partyDamageCut})`,
          type: 'damage_cut',
          value: partyStats.partyDamageCut,
          remainingTurns: 99
        });
      }
    }
  }
}

/**
 * Handles turn-start or round-start passives granted by CEs (HP Regen, NP per turn, Stars per turn).
 * Returns array of descriptive battle log lines.
 */
export function processCeTurnStartEffects(combatant: any): string[] {
  const logs: string[] = [];
  if (!combatant || combatant.isDead) return logs;

  const servant = combatant.servant || combatant;
  const ce = combatant.servant?.equippedCe || combatant.equippedCe;
  if (!ce) return logs;

  const ceStats = getCePassiveStats(ce, servant);
  const sName = servant.nickname || servant.template?.name || servant.name || 'Servant';

  // 1. HP Regen
  if (ceStats.hpRegenPerTurn > 0 && combatant.currentHp < combatant.maxHp) {
    const healAmount = Math.min(combatant.maxHp - combatant.currentHp, ceStats.hpRegenPerTurn);
    combatant.currentHp += healAmount;
    logs.push(`💖 **${sName}** recovers **+${healAmount.toLocaleString()} HP** via *${ce.name}*! (${combatant.currentHp.toLocaleString()}/${combatant.maxHp.toLocaleString()} HP)`);
  }

  // 2. NP per turn
  if (ceStats.npPerTurn > 0 && combatant.npGauge < 100) {
    const npGain = Math.min(100 - combatant.npGauge, ceStats.npPerTurn);
    combatant.npGauge += npGain;
    logs.push(`✨ **${sName}** gains **+${npGain}% NP Gauge** via *${ce.name}*! (${combatant.npGauge}% NP)`);
  }

  // 3. Critical Stars per turn
  if (ceStats.starsPerTurn > 0) {
    combatant.critStars = Math.min(50, (combatant.critStars || 0) + ceStats.starsPerTurn);
    logs.push(`⭐ **${sName}** generates **+${ceStats.starsPerTurn} Critical Stars** via *${ce.name}*!`);
  }

  return logs;
}

/**
 * Handles on-attack triggers for equipped CEs (such as Typhon's Ephemeral Fruit).
 */
export function processCeOnAttackEffects(attacker: any, defender: any, card: string): string[] {
  const logs: string[] = [];
  if (!attacker) return logs;

  const servant = attacker.servant || attacker;
  const ce = attacker.servant?.equippedCe || attacker.equippedCe;
  if (!ce) return logs;

  const ceStats = getCePassiveStats(ce, servant);

  // Typhon Ephemeros: The Ephemeral Fruit of Moirai
  const isTyphonFruit = ceStats.buffOnAttackFruit ||
    ce.id === 'ce_bond_typhon_ephemeros' ||
    /ephemeral fruit|typhon/i.test(ce.name || '');

  if (isTyphonFruit && card !== 'NP') {
    if (!attacker.activeBuffs) attacker.activeBuffs = [];

    // 1. Critical Damage Up +10% (3 turns, stacks)
    attacker.activeBuffs.push({
      name: 'Moirai Fruit (Crit DMG +10%)',
      type: 'crit_dmg',
      value: 10,
      remainingTurns: 3
    });

    // 2. Demerit: Inflicts Curse 200 dmg for 3 turns to self
    attacker.activeBuffs.push({
      name: 'Moirai Fruit Demerit (Curse)',
      type: 'curse',
      value: 200,
      remainingTurns: 3
    });

    const sName = servant.nickname || servant.template?.name || servant.name || 'Typhon';
    logs.push(`🍎 **${sName}** triggered *The Ephemeral Fruit of Moirai*! (+10% Crit DMG (3T), [Demerit] 200 Curse (3T) to self)`);
  }

  return logs;
}
