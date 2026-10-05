import { ActiveCombatant } from '../types';

export interface CombatantBadge {
  id: string;
  name?: string;
  label: string;
  shortLabel: string;
  iconSymbol: string;
  type: string;
  turns?: number;
  hits?: number;
  value?: number;
  bgColor: string;
  borderColor: string;
  textColor: string;
}

export interface TacticalDossierField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface TacticalDossierEmbedData {
  title: string;
  color: number;
  description: string;
  fields: TacticalDossierField[];
  footer?: { text: string };
}

export interface CombatantBuffSummary {
  totalAtkPercent: number;
  totalDefPercent: number;
  busterPercent: number;
  artsPercent: number;
  quickPercent: number;
  critDmgPercent: number;
  npGainPercent: number;
  isEvading: boolean;
  evadeHits?: number;
  isInvincible: boolean;
  invincibleHits?: number;
  isAntiPurgeDefense: boolean;
  gutsCount: number;
  isStunned: boolean;
  badges: CombatantBadge[];
  buffDescriptions: string[];
}

/**
 * Calculates net stat boosts, survivability status, and visual badge chips
 * for any combatant (works with both DuelCombatant and ActiveCombatant).
 */
export function calculateCombatantBuffSummary(
  combatant: ActiveCombatant | any
): CombatantBuffSummary {
  if (!combatant) {
    return {
      totalAtkPercent: 0,
      totalDefPercent: 0,
      busterPercent: 0,
      artsPercent: 0,
      quickPercent: 0,
      critDmgPercent: 0,
      npGainPercent: 0,
      isEvading: false,
      isInvincible: false,
      isAntiPurgeDefense: false,
      gutsCount: 0,
      isStunned: false,
      badges: [],
      buffDescriptions: []
    };
  }

  const buffs: any[] = combatant.activeBuffs || [];
  let atkBoost = 0;
  let defBoost = 0;
  let busterBoost = 0;
  let artsBoost = 0;
  let quickBoost = 0;
  let critBoost = 0;
  let npGainBoost = 0;
  let isEvading = false;
  let evadeHits = 0;
  let isInvincible = false;
  let invincibleHits = 0;
  let isAntiPurgeDefense = false;
  let gutsCount = 0;
  let isStunned = Boolean(combatant.isStunned);

  const buffDescriptions: string[] = [];

  // 1. Process active buffs
  for (const b of buffs) {
    const val = Number(b.value) || 0;
    const turns = b.remainingTurns ?? 1;
    const hits = b.remainingHits;
    const durationLabel = hits ? `${hits} Hit${hits > 1 ? 's' : ''}` : `${turns}T`;

    switch (b.type) {
      case 'buff_atk':
        atkBoost += val;
        buffDescriptions.push(`• **${b.name || 'ATK Up'}**: +${val}% ATK (${durationLabel})`);
        break;
      case 'debuff_atk':
        atkBoost -= val;
        buffDescriptions.push(`• **${b.name || 'ATK Down'}**: -${val}% ATK (${durationLabel})`);
        break;
      case 'buff_def':
        defBoost += val;
        buffDescriptions.push(`• **${b.name || 'DEF Up'}**: +${val}% DEF (${durationLabel})`);
        break;
      case 'debuff_def':
        defBoost -= val;
        buffDescriptions.push(`• **${b.name || 'DEF Down'}**: -${val}% DEF (${durationLabel})`);
        break;
      case 'buster_up':
        busterBoost += val;
        buffDescriptions.push(`• **${b.name || 'Buster Up'}**: +${val}% Buster (${durationLabel})`);
        break;
      case 'arts_up':
        artsBoost += val;
        buffDescriptions.push(`• **${b.name || 'Arts Up'}**: +${val}% Arts (${durationLabel})`);
        break;
      case 'quick_up':
        quickBoost += val;
        buffDescriptions.push(`• **${b.name || 'Quick Up'}**: +${val}% Quick (${durationLabel})`);
        break;
      case 'crit_dmg':
        critBoost += val;
        buffDescriptions.push(`• **${b.name || 'Critical DMG'}**: +${val}% Crit (${durationLabel})`);
        break;
      case 'np_gen':
      case 'np_gain':
        npGainBoost += val;
        buffDescriptions.push(`• **${b.name || 'NP Gain'}**: +${val}% NP Gain (${durationLabel})`);
        break;
      case 'anti_purge_defense':
      case 'anti_purge':
        if (b.remainingTurns > 0) {
          isAntiPurgeDefense = true;
          buffDescriptions.push(`• **${b.name || 'Anti-Purge Defense'}**: Complete Damage Nullification [Blocks Ignore Invincible] (${durationLabel})`);
        }
        break;
      case 'evade':
        if (b.remainingTurns > 0 && (b.remainingHits === undefined || b.remainingHits > 0)) {
          isEvading = true;
          if (hits) evadeHits = Math.max(evadeHits, hits);
          buffDescriptions.push(`• **${b.name || 'Evade'}**: Evade Attacks (${durationLabel})`);
        }
        break;
      case 'invincible':
        if (b.remainingTurns > 0 && (b.remainingHits === undefined || b.remainingHits > 0)) {
          isInvincible = true;
          if (hits) invincibleHits = Math.max(invincibleHits, hits);
          buffDescriptions.push(`• **${b.name || 'Invincibility'}**: Complete Invulnerability (${durationLabel})`);
        }
        break;
      case 'anti_purge_atk':
        buffDescriptions.push(`• **${b.name || 'Anti-Purge Attack'}**: Attacks Pierce Invincibility & Anti-Purge Defense (${durationLabel})`);
        break;
      case 'ignore_invincible':
        buffDescriptions.push(`• **${b.name || 'Ignore Invincibility'}**: Attacks Pierce Evade & Invincibility (${durationLabel})`);
        break;
      case 'guts':
        if (b.remainingTurns === undefined || b.remainingTurns > 0) {
          const count = b.remainingHits !== undefined ? b.remainingHits : 1;
          gutsCount += count;
          buffDescriptions.push(`• **${b.name || 'Guts'}**: Revive from lethal damage (${durationLabel})`);
        }
        break;
      default:
        if (b.name) {
          buffDescriptions.push(`• **${b.name}**: Active effect (${durationLabel})`);
        }
        break;
    }
  }

  // 2. Process Passives
  const passives: any[] = combatant.passives || [];
  for (const p of passives) {
    if (p.type === 'madness_enhancement') {
      const bstVal = p.value || 8;
      busterBoost += bstVal;
      atkBoost += Math.round(bstVal * 0.5);
    } else if (p.type === 'territory_creation') {
      artsBoost += p.value || 8;
    } else if (p.type === 'independent_action') {
      critBoost += p.value || 8;
    } else if (p.type === 'avenger' && combatant.currentHp && combatant.maxHp) {
      const missingRatio = 1 - (combatant.currentHp / combatant.maxHp);
      const avengerBoost = Math.round(missingRatio * 20);
      if (avengerBoost > 0) {
        atkBoost += avengerBoost;
      }
    }
  }

  // Fallback to combatant.gutsCount if no guts buffs exist in activeBuffs
  if (gutsCount === 0 && combatant.gutsCount) {
    gutsCount = combatant.gutsCount;
  }

  // 3. Assemble Visual Badges
  const badges: CombatantBadge[] = [];

  // GUTS Badge (Top Priority for tactical awareness)
  if (gutsCount > 0) {
    const gutsBuff = buffs.find(b => b.type === 'guts');
    const turns = gutsBuff?.remainingTurns;
    badges.push({
      id: 'guts',
      label: gutsCount > 1 ? `GUTS x${gutsCount}` : 'GUTS',
      shortLabel: gutsCount > 1 ? `x${gutsCount}` : (turns !== undefined && turns > 0 && turns < 90 ? `${turns}T` : 'GUTS'),
      iconSymbol: 'guts',
      type: 'guts',
      hits: gutsCount,
      turns: turns,
      bgColor: 'rgba(159, 18, 57, 0.92)',
      borderColor: '#f43f5e',
      textColor: '#ffe4e6'
    });
  }

  // ANTI-PURGE DEFENSE Badge (Highest Defensive Priority)
  if (isAntiPurgeDefense) {
    const apBuff = buffs.find(b => b.type === 'anti_purge_defense' || b.type === 'anti_purge');
    badges.push({
      id: 'anti_purge',
      label: 'ANTI-PURGE',
      shortLabel: apBuff?.remainingTurns ? `${apBuff.remainingTurns}T` : 'A-PURGE',
      iconSymbol: 'invincible',
      type: 'invincible',
      turns: apBuff?.remainingTurns,
      bgColor: 'rgba(91, 33, 182, 0.92)',
      borderColor: '#a855f7',
      textColor: '#f3e8ff'
    });
  } else if (isInvincible) {
    // INVINCIBLE Badge
    const invBuff = buffs.find(b => b.type === 'invincible');
    const invTurns = invBuff?.remainingTurns;
    badges.push({
      id: 'invincible',
      label: invincibleHits > 0 ? `INVINC (${invincibleHits}H)` : 'INVINC',
      shortLabel: invincibleHits > 0 ? `${invincibleHits}H` : (invTurns ? `${invTurns}T` : 'INV'),
      iconSymbol: 'invincible',
      type: 'invincible',
      hits: invincibleHits,
      turns: invTurns,
      bgColor: 'rgba(146, 64, 14, 0.92)',
      borderColor: '#facc15',
      textColor: '#fef08a'
    });
  } else if (isEvading) {
    // EVADE Badge
    const evBuff = buffs.find(b => b.type === 'evade');
    const evTurns = evBuff?.remainingTurns;
    badges.push({
      id: 'evade',
      label: evadeHits > 0 ? `EVADE (${evadeHits}H)` : 'EVADE',
      shortLabel: evadeHits > 0 ? `${evadeHits}H` : (evTurns ? `${evTurns}T` : 'EVD'),
      iconSymbol: 'evade',
      type: 'evade',
      hits: evadeHits,
      turns: evTurns,
      bgColor: 'rgba(8, 145, 178, 0.92)',
      borderColor: '#06b6d4',
      textColor: '#cffafe'
    });
  }

  // ATK Up / Down Badge
  if (atkBoost !== 0) {
    const sign = atkBoost > 0 ? '+' : '';
    const atkBuff = buffs.find(b => b.type === (atkBoost > 0 ? 'buff_atk' : 'debuff_atk'));
    const turns = atkBuff?.remainingTurns;
    badges.push({
      id: 'atk',
      label: `${sign}${atkBoost}% ATK`,
      shortLabel: turns && turns < 90 ? `${sign}${atkBoost}% (${turns}T)` : `${sign}${atkBoost}%`,
      iconSymbol: atkBoost > 0 ? 'atk' : 'debuff_atk',
      type: atkBoost > 0 ? 'atk' : 'debuff_atk',
      value: atkBoost,
      turns: turns,
      bgColor: atkBoost > 0 ? 'rgba(153, 27, 27, 0.92)' : 'rgba(88, 28, 135, 0.92)',
      borderColor: atkBoost > 0 ? '#ef4444' : '#a855f7',
      textColor: '#ffffff'
    });
  }

  // DEF Up / Down Badge
  if (defBoost !== 0) {
    const sign = defBoost > 0 ? '+' : '';
    const defBuff = buffs.find(b => b.type === (defBoost > 0 ? 'buff_def' : 'debuff_def'));
    const turns = defBuff?.remainingTurns;
    badges.push({
      id: 'def',
      label: `${sign}${defBoost}% DEF`,
      shortLabel: turns && turns < 90 ? `${sign}${defBoost}% (${turns}T)` : `${sign}${defBoost}%`,
      iconSymbol: defBoost > 0 ? 'def' : 'debuff_def',
      type: defBoost > 0 ? 'def' : 'debuff_def',
      value: defBoost,
      turns: turns,
      bgColor: defBoost > 0 ? 'rgba(30, 58, 138, 0.92)' : 'rgba(107, 33, 168, 0.92)',
      borderColor: defBoost > 0 ? '#38bdf8' : '#c084fc',
      textColor: '#ffffff'
    });
  }

  // Card Performance Badges
  if (busterBoost > 0) {
    const bstBuff = buffs.find(b => b.type === 'buster_up');
    const turns = bstBuff?.remainingTurns;
    badges.push({
      id: 'buster',
      label: `+${busterBoost}% BST`,
      shortLabel: turns && turns < 90 ? `+${busterBoost}% (${turns}T)` : `+${busterBoost}%`,
      iconSymbol: 'buster',
      type: 'buster_up',
      value: busterBoost,
      turns: turns,
      bgColor: 'rgba(185, 28, 28, 0.92)',
      borderColor: '#f87171',
      textColor: '#fee2e2'
    });
  }
  if (artsBoost > 0) {
    const artsBuff = buffs.find(b => b.type === 'arts_up');
    const turns = artsBuff?.remainingTurns;
    badges.push({
      id: 'arts',
      label: `+${artsBoost}% ART`,
      shortLabel: turns && turns < 90 ? `+${artsBoost}% (${turns}T)` : `+${artsBoost}%`,
      iconSymbol: 'arts',
      type: 'arts_up',
      value: artsBoost,
      turns: turns,
      bgColor: 'rgba(29, 78, 216, 0.92)',
      borderColor: '#60a5fa',
      textColor: '#dbeafe'
    });
  }
  if (quickBoost > 0) {
    const qckBuff = buffs.find(b => b.type === 'quick_up');
    const turns = qckBuff?.remainingTurns;
    badges.push({
      id: 'quick',
      label: `+${quickBoost}% QCK`,
      shortLabel: turns && turns < 90 ? `+${quickBoost}% (${turns}T)` : `+${quickBoost}%`,
      iconSymbol: 'quick',
      type: 'quick_up',
      value: quickBoost,
      turns: turns,
      bgColor: 'rgba(4, 120, 87, 0.92)',
      borderColor: '#34d399',
      textColor: '#d1fae5'
    });
  }

  // Stun Debuff Badge
  if (isStunned) {
    const stunBuff = buffs.find(b => b.type === 'stun');
    const turns = stunBuff?.remainingTurns || 1;
    badges.push({
      id: 'stun',
      label: 'STUNNED',
      shortLabel: `${turns}T`,
      iconSymbol: 'stun',
      type: 'stun',
      turns: turns,
      bgColor: 'rgba(180, 83, 9, 0.92)',
      borderColor: '#fbbf24',
      textColor: '#fef3c7'
    });
  }

  // 4. Specific Status Afflictions (Curse, Burn, Poison, NP Gain, Crit DMG, Skill Seal, NP Seal)
  const curseBuffs = buffs.filter(b => b.type === 'curse' || b.type === 'void_curse' || (b.name && b.name.toLowerCase().includes('curse')));
  if (curseBuffs.length > 0) {
    const maxTurns = Math.max(...curseBuffs.map(b => b.remainingTurns || 1));
    badges.push({
      id: 'curse',
      label: curseBuffs.length > 1 ? `CURSE x${curseBuffs.length}` : 'CURSE',
      shortLabel: curseBuffs.length > 1 ? `x${curseBuffs.length}` : `${maxTurns}T`,
      iconSymbol: 'curse',
      type: 'curse',
      turns: maxTurns,
      bgColor: 'rgba(76, 29, 149, 0.92)',
      borderColor: '#8b5cf6',
      textColor: '#ede9fe'
    });
  }

  const burnBuffs = buffs.filter(b => b.type === 'burn' || b.type === 'spread_of_fire' || (b.name && (b.name.toLowerCase().includes('burn') || b.name.toLowerCase().includes('dragon grail') || b.name.toLowerCase().includes('fire'))));
  if (burnBuffs.length > 0) {
    const maxTurns = Math.max(...burnBuffs.map(b => b.remainingTurns || 1));
    badges.push({
      id: 'burn',
      label: burnBuffs.length > 1 ? `BURN x${burnBuffs.length}` : 'BURN',
      shortLabel: burnBuffs.length > 1 ? `x${burnBuffs.length}` : `${maxTurns}T`,
      iconSymbol: 'burn',
      type: 'burn',
      turns: maxTurns,
      bgColor: 'rgba(154, 52, 18, 0.92)',
      borderColor: '#ea580c',
      textColor: '#ffedd5'
    });
  }

  const poisonBuffs = buffs.filter(b => b.type === 'poison' || (b.name && b.name.toLowerCase().includes('poison')));
  if (poisonBuffs.length > 0) {
    const maxTurns = Math.max(...poisonBuffs.map(b => b.remainingTurns || 1));
    badges.push({
      id: 'poison',
      label: poisonBuffs.length > 1 ? `POISON x${poisonBuffs.length}` : 'POISON',
      shortLabel: poisonBuffs.length > 1 ? `x${poisonBuffs.length}` : `${maxTurns}T`,
      iconSymbol: 'poison',
      type: 'poison',
      turns: maxTurns,
      bgColor: 'rgba(6, 78, 59, 0.92)',
      borderColor: '#10b981',
      textColor: '#d1fae5'
    });
  }

  if (critBoost > 0) {
    badges.push({
      id: 'crit_dmg',
      label: `+${critBoost}% CRIT`,
      shortLabel: `+${critBoost}%`,
      iconSymbol: 'crit_dmg',
      type: 'crit_dmg',
      bgColor: 'rgba(133, 77, 14, 0.92)',
      borderColor: '#eab308',
      textColor: '#fef9c3'
    });
  }

  if (npGainBoost > 0) {
    badges.push({
      id: 'np_gain',
      label: `+${npGainBoost}% NP`,
      shortLabel: `+${npGainBoost}%`,
      iconSymbol: 'np_charge',
      type: 'np_charge',
      bgColor: 'rgba(21, 94, 117, 0.92)',
      borderColor: '#06b6d4',
      textColor: '#ecfeff'
    });
  }

  const skillSeal = buffs.find(b => b.type === 'skill_seal');
  if (skillSeal) {
    badges.push({
      id: 'skill_seal',
      label: 'SKILL SEAL',
      shortLabel: `${skillSeal.remainingTurns || 1}T`,
      iconSymbol: 'skill_seal',
      type: 'skill_seal',
      bgColor: 'rgba(127, 29, 29, 0.92)',
      borderColor: '#dc2626',
      textColor: '#fee2e2'
    });
  }

  const npSeal = buffs.find(b => b.type === 'np_seal');
  if (npSeal) {
    badges.push({
      id: 'np_seal',
      label: 'NP SEAL',
      shortLabel: `${npSeal.remainingTurns || 1}T`,
      iconSymbol: 'np_seal',
      type: 'np_seal',
      bgColor: 'rgba(120, 53, 15, 0.92)',
      borderColor: '#d97706',
      textColor: '#fef3c7'
    });
  }

  return {
    totalAtkPercent: atkBoost,
    totalDefPercent: defBoost,
    busterPercent: busterBoost,
    artsPercent: artsBoost,
    quickPercent: quickBoost,
    critDmgPercent: critBoost,
    npGainPercent: npGainBoost,
    isEvading,
    evadeHits: evadeHits > 0 ? evadeHits : undefined,
    isInvincible,
    invincibleHits: invincibleHits > 0 ? invincibleHits : undefined,
    isAntiPurgeDefense,
    gutsCount,
    isStunned,
    badges,
    buffDescriptions
  };
}

/**
 * Builds a clean, scannable Discord embed summary line for combat turn embeds.
 */
export function formatCombatantBuffEmbedString(
  combatant: ActiveCombatant | any,
  prefix: string = ''
): string {
  const summary = calculateCombatantBuffSummary(combatant);
  const parts: string[] = [];

  // ATK Boost
  if (summary.totalAtkPercent !== 0) {
    const sign = summary.totalAtkPercent > 0 ? '+' : '';
    parts.push(`⚔️ ATK: **${sign}${summary.totalAtkPercent}%**`);
  } else {
    parts.push('⚔️ ATK: **+0%**');
  }

  // DEF Boost
  if (summary.totalDefPercent !== 0) {
    const sign = summary.totalDefPercent > 0 ? '+' : '';
    parts.push(`🛡️ DEF: **${sign}${summary.totalDefPercent}%**`);
  }

  // Card Performance
  if (summary.busterPercent > 0) parts.push(`🔴 Buster: **+${summary.busterPercent}%**`);
  if (summary.artsPercent > 0) parts.push(`🔵 Arts: **+${summary.artsPercent}%**`);
  if (summary.quickPercent > 0) parts.push(`🟢 Quick: **+${summary.quickPercent}%**`);

  // Survivability
  if (summary.isAntiPurgeDefense) parts.push(`👑 **Anti-Purge Defense**`);
  else if (summary.isInvincible) parts.push(`✨ **Invincible**${summary.invincibleHits ? ` (${summary.invincibleHits}H)` : ''}`);
  else if (summary.isEvading) parts.push(`💨 **Evade**${summary.evadeHits ? ` (${summary.evadeHits}H)` : ''}`);
  if (summary.gutsCount > 0) parts.push(`🩸 **Guts (${summary.gutsCount}x)**`);
  if (summary.isStunned) parts.push(`💫 **STUNNED**`);

  const statLine = parts.join(' • ');

  if (summary.buffDescriptions.length > 0) {
    const topBuffs = summary.buffDescriptions.slice(0, 3).map(d => d.replace(/^•\s*/, '')).join(' | ');
    return `${prefix}${statLine}\n> 🔮 **Active:** ${topBuffs}`;
  }

  return `${prefix}${statLine}`;
}

/**
 * Builds the Tactical Dossier Embed shown when a player clicks [📊 Status & Buffs].
 */
export function buildTacticalDossierEmbed(
  viewer: any,
  opponent?: any,
  allies?: any[]
): TacticalDossierEmbedData {
  const vSummary = calculateCombatantBuffSummary(viewer);
  const vName = viewer.servant?.nickname || viewer.servant?.template?.name || viewer.name || 'Your Servant';
  const vClass = (viewer.servant?.template?.servantClass || viewer.servantClass || 'Saber').toUpperCase();
  const vHp = Math.round(viewer.currentHp || 0);
  const vMaxHp = viewer.maxHp || 1;
  const vHpPct = Math.round((vHp / vMaxHp) * 100);
  const vNp = Math.round(viewer.npGauge || 0);

  const fields: TacticalDossierField[] = [];

  // 1. Net Boosts Breakdown
  const netParts: string[] = [
    `• ⚔️ **Net Attack Boost:** **${vSummary.totalAtkPercent >= 0 ? '+' : ''}${vSummary.totalAtkPercent}%**`,
    `• 🛡️ **Net Defense Boost:** **${vSummary.totalDefPercent >= 0 ? '+' : ''}${vSummary.totalDefPercent}%**`
  ];
  if (vSummary.busterPercent > 0) netParts.push(`• 🔴 **Buster Performance:** **+${vSummary.busterPercent}%**`);
  if (vSummary.artsPercent > 0) netParts.push(`• 🔵 **Arts Performance:** **+${vSummary.artsPercent}%**`);
  if (vSummary.quickPercent > 0) netParts.push(`• 🟢 **Quick Performance:** **+${vSummary.quickPercent}%**`);
  if (vSummary.critDmgPercent > 0) netParts.push(`• 💥 **Critical Damage:** **+${vSummary.critDmgPercent}%**`);
  if (vSummary.npGainPercent > 0) netParts.push(`• ⚡ **NP Charge Rate:** **+${vSummary.npGainPercent}%**`);
  if (vSummary.gutsCount > 0) netParts.push(`• 🩸 **Guts Revives:** **${vSummary.gutsCount} remaining**`);
  if (vSummary.isInvincible) netParts.push(`• ✨ **Invincibility:** **ACTIVE** (${vSummary.invincibleHits || '1'} hit barrier)`);
  else if (vSummary.isEvading) netParts.push(`• 💨 **Evade:** **ACTIVE** (${vSummary.evadeHits || '1'} hit barrier)`);
  if (vSummary.isStunned) netParts.push(`• 💫 **Incapacitation:** **STUNNED**`);

  fields.push({
    name: '📈 Net Calculated Multipliers',
    value: netParts.join('\n'),
    inline: false
  });

  // 2. Active Buffs List
  if (vSummary.buffDescriptions.length > 0) {
    fields.push({
      name: '✨ Active Buffs & Durations',
      value: vSummary.buffDescriptions.slice(0, 8).join('\n'),
      inline: false
    });
  } else {
    fields.push({
      name: '✨ Active Buffs & Durations',
      value: '_No active skill or command buffs currently applied. Operating at baseline stats._',
      inline: false
    });
  }

  // 3. Opponent Reconnaissance (if provided)
  if (opponent && opponent.currentHp > 0) {
    const oppSummary = calculateCombatantBuffSummary(opponent);
    const oppName = opponent.servant?.nickname || opponent.servant?.template?.name || opponent.name || 'Opponent';
    const oppClass = (opponent.servant?.template?.servantClass || opponent.servantClass || 'Target').toUpperCase();
    const oppHp = Math.round(opponent.currentHp || 0);
    const oppMaxHp = opponent.maxHp || 1;
    const oppHpPct = Math.round((oppHp / oppMaxHp) * 100);

    const oppNotes: string[] = [
      `• **Status:** ❤️ **${oppHp.toLocaleString()} HP** (${oppHpPct}%) • ⚡ **${Math.round(opponent.npGauge || 0)}% NP**`,
      `• **Net Defense:** **${oppSummary.totalDefPercent >= 0 ? '+' : ''}${oppSummary.totalDefPercent}%** | **ATK:** **${oppSummary.totalAtkPercent >= 0 ? '+' : ''}${oppSummary.totalAtkPercent}%**`
    ];

    if (oppSummary.isInvincible) oppNotes.push(`• ⚠️ **PROTECTED:** ✨ **Invincible Active**`);
    else if (oppSummary.isEvading) oppNotes.push(`• ⚠️ **PROTECTED:** 💨 **Evade Active** (${oppSummary.evadeHits || '1'} Hit remaining)`);
    if (oppSummary.gutsCount > 0) oppNotes.push(`• 🩸 **Guts Active:** Will revive up to **${oppSummary.gutsCount}x**`);
    if (oppSummary.isStunned) oppNotes.push(`• 💫 **VULNERABLE:** Stunned and unable to retaliate`);

    fields.push({
      name: `🎯 Target Recon: ${oppName} [${oppClass}]`,
      value: oppNotes.join('\n'),
      inline: false
    });
  }

  // 4. Allied Flank Recon (if provided)
  if (allies && allies.length > 0) {
    for (const ally of allies) {
      if (!ally || ally.userId === viewer.userId) continue;
      const aSummary = calculateCombatantBuffSummary(ally);
      const aName = ally.servant?.nickname || ally.servant?.template?.name || ally.name || 'Ally';
      const aHp = Math.round(ally.currentHp || 0);
      fields.push({
        name: `🛡️ Allied Partner: ${aName}`,
        value: `• HP: **${aHp.toLocaleString()}** | ATK: **${aSummary.totalAtkPercent >= 0 ? '+' : ''}${aSummary.totalAtkPercent}%** | DEF: **${aSummary.totalDefPercent >= 0 ? '+' : ''}${aSummary.totalDefPercent}%**`,
        inline: true
      });
    }
  }

  return {
    title: `📊 TACTICAL COMBAT DOSSIER — ${vName.toUpperCase()}`,
    color: 0x38bdf8,
    description:
      `Master: <@${viewer.userId}> • **${vName}** [${vClass}]\n` +
      `❤️ **HP:** **${vHp.toLocaleString()} / ${vMaxHp.toLocaleString()}** (${vHpPct}%) • ⚡ **NP Gauge:** **${vNp}%**`,
    fields,
    footer: { text: 'Holy Grail War Tactical Intelligence • Auto-updates every turn' }
  };
}
