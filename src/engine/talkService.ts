import { GoogleGenAI } from '@google/genai';
import { renderVisualNovelCard } from '../canvas/renderer';
import {
  getServantChatHistory,
  appendServantChatTurn,
  formatTimeDelta,
  formatRelativeTurnTime,
  TalkMessageTurn
} from './servantMemoryService';
import { getServantCharacterProfile } from '../data/characterProfiles';
import { generateWithCustomProvider } from './byokService';
import { UserCustomApiConfig } from '../types';

export type ServantSceneContext = 'workshop' | 'church' | 'bond' | 'patrol';

export interface ServantTalkContext {
  servantName: string;
  servantClass: string;
  bondLevel: number;
  maxBond?: number;
  masterName: string;
  masterId?: string;
  servantId?: string;
  warId?: string;
  sceneContext?: ServantSceneContext;
  commandSeals?: number;
  isExposed?: boolean;
  equippedCeName?: string;
  customApiConfig?: UserCustomApiConfig;
  recentChronicleEvents?: string[];
  recentBattleEvents?: string[];
  latestBattleEvent?: string;
  latestFatalityEvent?: string;
  interceptedLeaks?: {
    informant: string;
    intel: string;
    target?: string;
    timeAgo?: string;
  }[];
  casualtyDossier?: {
    totalCasualties: number;
    fallenMasters: string[];
    civilianCasualties: string[];
  };
  latestChurchHomily?: {
    title: string;
    monologue: string;
    statsSummary?: any;
    source?: string;
  };
  latestNewsBulletin?: {
    headline: string;
    gasLeakCoverStory: string;
    content: string;
    threatLevel: string;
    bulletinPoints?: string[];
    source?: string;
  };
  playerMessage: string;
  servantAvatarUrl?: string;
  servantTitle?: string;
  servantLore?: string;
  conversationHistory?: TalkMessageTurn[];
  // Combat Status & Physical Condition
  currentHp?: number;
  maxHp?: number;
  hpPercent?: number;
  isInjured?: boolean;
  isCritical?: boolean;
  isInChurchAsylum?: boolean;
  killsCount?: number;
  activeBuffNames?: string[];
  lastCombatAction?: string;
  noblePhantasmName?: string;
  // Discord Channel, Sector & Tactical Field Awareness
  channelName?: string;
  hasOwnTrapInChannel?: boolean;
  hasOwnFamiliarInChannel?: boolean;
  enemyTrapInChannel?: boolean;
  alliedMasters?: string[];
  activeBoundedFieldType?: string;
  // War Board & Rival Intel
  totalAliveMasters?: number;
  exposedRivals?: {
    username: string;
    servantClass: string;
    servantName?: string;
    isAlive: boolean;
    inSanctuary?: boolean;
    kills?: number;
    innocentKills?: number;
    isRogueHeretic?: boolean;
  }[];
  concealedMastersCount?: number;
  eliminatedMastersCount?: number;
}

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return aiClient;
}

// Canonical fallback dialogue generator when Gemini is offline or API key is absent
export function generateCanonicalFallbackReply(ctx: ServantTalkContext): string {
  const { servantName, servantClass, bondLevel, playerMessage, commandSeals = 3 } = ctx;
  const lowerMsg = playerMessage.toLowerCase();

  // 1. Inquiries about Leaks / Rumors / Intelligence
  if (lowerMsg.includes('leak') || lowerMsg.includes('rumor') || lowerMsg.includes('intercept') || lowerMsg.includes('intel')) {
    if (ctx.interceptedLeaks && ctx.interceptedLeaks.length > 0) {
      const topLeak = ctx.interceptedLeaks[0];
      return `Our surveillance picked up an intercepted transmission, Master: "${topLeak.intel}" (source: ${topLeak.informant || 'Scout Operative'}). Watch your perimeter.`;
    }
    return `No leaks have surfaced from the rivals yet, Master. The other Masters are maintaining strict radio silence behind their bounded fields.`;
  }

  // 2. Inquiries about Battles / Clashes / Duels / Ambushes
  if (lowerMsg.includes('battle') || lowerMsg.includes('fight') || lowerMsg.includes('clash') || lowerMsg.includes('ambush') || lowerMsg.includes('duel') || lowerMsg.includes('skirmish')) {
    if (ctx.recentBattleEvents && ctx.recentBattleEvents.length > 0) {
      const topBattle = ctx.recentBattleEvents[0].replace(/\*\*/g, '');
      return `Regarding the recent clashes across Fuyuki, Master: ${topBattle}. The Holy Grail War is actively escalating.`;
    }
    return `The city streets remain quiet for now, Master. No open clashes or ambushes have erupted recently, but our enemies are circling in the dark.`;
  }

  // 3. Inquiries about Casualties / Deaths / Who Died / Kills
  if (lowerMsg.includes('casualt') || lowerMsg.includes('who died') || lowerMsg.includes('kill') || lowerMsg.includes('fatal') || lowerMsg.includes('dead') || lowerMsg.includes('eliminated')) {
    if (ctx.casualtyDossier && ctx.casualtyDossier.totalCasualties > 0) {
      const { totalCasualties, fallenMasters, civilianCasualties } = ctx.casualtyDossier;
      let summary = `We have ${totalCasualties} confirmed casualties in Fuyuki. `;
      if (fallenMasters.length > 0) {
        summary += `Fallen Master(s): ${fallenMasters.join(', ')}. `;
      }
      if (civilianCasualties.length > 0) {
        summary += `Civilian crossfire has also been registered, which the Church is covering up as 'gas leak explosions.'`;
      }
      return summary;
    }
    return `Zero confirmed casualties so far, Master. All seven Masters still walk the earth and cling to their Command Seals.`;
  }

  // 4. Inquiries about Kotomine Kirei, Overseer's Homily & Church Sermons
  if (lowerMsg.includes('kotomine') || lowerMsg.includes('homily') || lowerMsg.includes('sermon') || lowerMsg.includes('priest') || lowerMsg.includes('kirei')) {
    if (ctx.latestChurchHomily) {
      return `Father Kotomine just released his 24-hour homily: "${ctx.latestChurchHomily.title}". That priest watches this entire war like a spectator savoring a tragedy. Do not let your guard down around the Church, Master.`;
    }
    return `Father Kotomine watches over the neutral grounds of the Fuyuki Church, Master. But remember—in this war, the arbitrator often finds the deepest amusement in our bloodshed.`;
  }

  // 5. Inquiries about 2-Hour Fuyuki News, Gas Leaks & City Announcements
  if (lowerMsg.includes('news') || lowerMsg.includes('bulletin') || lowerMsg.includes('gas leak') || lowerMsg.includes('broadcast') || lowerMsg.includes('announcement')) {
    if (ctx.latestNewsBulletin) {
      return `The latest Fuyuki municipal dispatch is out: "${ctx.latestNewsBulletin.headline}" [Threat Level: ${ctx.latestNewsBulletin.threatLevel}]. The Church's disinformation bureau is covering up our skirmishes as '${ctx.latestNewsBulletin.gasLeakCoverStory}'.`;
    }
    return `The local news continues to dismiss our supernatural clashes as underground industrial gas leaks. The Secrecy of Magecraft remains intact for now.`;
  }

  // 6. Inquiries about Greetings & Time of Day
  if (lowerMsg.startsWith('good morning') || lowerMsg.includes('morning')) {
    if (ctx.sceneContext === 'workshop') {
      return `Good morning, Master. Brew yourself some tea—the workshop's bounded field will keep us safe while we take our morning ease.`;
    }
    return `Good morning, Master. The sun is up over Fuyuki, so supernatural Magecraft must remain concealed from civilians. What are our preparations for today?`;
  }
  if (lowerMsg.startsWith('good night') || lowerMsg.includes('sleep') || lowerMsg.includes('going to bed')) {
    if (ctx.sceneContext === 'workshop' || ctx.sceneContext === 'bond') {
      return `Get some sound rest, Master. The room is quiet and secure. I will keep watch from the corner of your quarters.`;
    }
    return `Rest well and restore your physical stamina, Master. I will maintain watch over our bounded field and monitor the leylines through the night.`;
  }
  if (lowerMsg.startsWith('good evening') || lowerMsg.includes('tonight')) {
    if (ctx.sceneContext === 'workshop') {
      return `Good evening, Master. It is good to unwind inside the workshop after a long day. What's on your mind?`;
    }
    return `Good evening, Master. Twilight has fallen over Fuyuki. The shadows are lengthening, and the true Holy Grail War begins under cover of darkness.`;
  }
  if (lowerMsg === 'hey' || lowerMsg === 'hello' || lowerMsg === 'hi' || lowerMsg.startsWith('hey ') || lowerMsg.startsWith('hello ')) {
    if (ctx.sceneContext === 'church') {
      return `Keep your voice down, Master. We are in the Church under Kotomine's gaze. What brings you to the sanctuary?`;
    }
    if (ctx.sceneContext === 'bond') {
      return `I am right here with you, Master. There are no distractions in our covenant chamber. What would you like to speak of?`;
    }
    if (ctx.sceneContext === 'workshop') {
      return `Hey there, Master. Relaxing in the quarters? I'm listening.`;
    }
    if (bondLevel >= 7) {
      return `I hear you clearly, Master. I was waiting for your call. What do you have on your mind?`;
    }
    return `I hear your telepathic transmission, Master. My blade and senses remain attuned to you.`;
  }

  // Keyword-sensitive responses
  if (lowerMsg.includes('grail') || lowerMsg.includes('wish')) {
    if (bondLevel >= 5) {
      return `The Holy Grail is merely a vessel, Master. What truly matters is the vow we share and the path we carve together across Fuyuki.`;
    }
    return `The Holy Grail is the coveted prize of this war. Whatever wish you hold, Master, my blade shall secure it for you.`;
  }

  if (lowerMsg.includes('plan') || lowerMsg.includes('strategy') || lowerMsg.includes('tonight') || lowerMsg.includes('tactic')) {
    return `We must monitor the leylines and guard against enemy ambushes. With ${commandSeals} Command Seal${commandSeals === 1 ? '' : 's'} remaining, we maintain tactical initiative.`;
  }

  if (lowerMsg.includes('trust') || lowerMsg.includes('church') || lowerMsg.includes('supervisor')) {
    return `Never let your guard down around the Church Overseer. In a Holy Grail War, neutral territory is often where betrayal strikes deepest.`;
  }

  if (lowerMsg.includes('legend') || lowerMsg.includes('who are you') || lowerMsg.includes('past') || lowerMsg.includes('oath')) {
    if (bondLevel >= 5) {
      return `My legend is carved into the Throne of Heroes, but here, beside you as your ${servantClass}, I write a chapter that belongs solely to us.`;
    }
    return `I am summoned as your ${servantClass}. My past is recorded in the Throne, but my loyalty is bound to your command.`;
  }

  if (lowerMsg.includes('how are you') || lowerMsg.includes('feeling') || lowerMsg.includes('tired') || lowerMsg.includes('holding up') || lowerMsg.includes('doing')) {
    if (bondLevel >= 7) {
      return `Being at your side restores my spirit faster than any leyline. Let us press forward without hesitation, Master.`;
    }
    return `My spirit origin is stable and attuned to your mana, Master. I stand ready for combat at a moment's notice.`;
  }

  // Dynamic variations for fallback
  const variationsBondHigh = [
    `No matter what adversity falls upon us, Master, my soul is tethered to yours. Command me, and I shall pierce the heavens for your sake.`,
    `I feel our mental resonance deepening. Stay close to me, Master—no enemy Noble Phantasm shall break our link.`,
    `Your resolve shines brighter than any Command Seal. Whatever you ask of me, I shall grant.`
  ];

  const variationsBondMid = [
    `I hear you clearly through our pact, Master. Your trust strengthens my spiritual core—I will not permit defeat to touch our banner.`,
    `Our bond holds firm against the tides of battle. What are your instructions for our next move, Master?`,
    `My mana reserves are steady. Together as Master and ${servantClass}, we shall claim victory in Fuyuki.`
  ];

  const variationsBondLow = [
    `I acknowledge your words, Master. Our covenant grows stronger with every passing skirmish. Tell me your next command.`,
    `My duty as ${servantClass} is to protect you and claim victory in this Holy Grail War. State your intentions.`,
    `I hear you, Master. Maintain vigilance—other Servants may be scanning the leylines for our signature.`
  ];

  const pool = bondLevel >= 8 ? variationsBondHigh : (bondLevel >= 4 ? variationsBondMid : variationsBondLow);
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Generate in-character Servant reply using Gemini (with fallback and persistent multi-turn memory)
 */
export async function generateServantTalkResponse(context: ServantTalkContext): Promise<{ reply: string; source: 'gemini' | 'canon_heuristic' }> {
  const client = getAiClient();
  const bond = context.bondLevel || 1;
  const seals = context.commandSeals ?? 3;

  // Retrieve past conversation history if masterId and servantId are provided
  const masterId = context.masterId || 'default_master';
  const servantId = context.servantId || context.servantName.toLowerCase().replace(/\s+/g, '_');
  const warId = context.warId || 'default';

  const priorTurns = context.conversationHistory ?? getServantChatHistory(masterId, servantId, warId, 16);

  // Real-world & In-Universe Time Tracking
  const now = Date.now();
  const currentDate = new Date(now);
  const timeFormatted = currentDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const dateFormatted = currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  const currentHour = currentDate.getHours();

  let timeOfDayCategory = 'Night (Peak Holy Grail War combat window)';
  if (currentHour >= 0 && currentHour < 5) {
    timeOfDayCategory = 'Deep Night / Witching Hour (0:00 - 4:59 AM) — Leyline mana surges; optimal for clandestine bounded fields and night ambushes';
  } else if (currentHour >= 5 && currentHour < 8) {
    timeOfDayCategory = 'Dawn / Early Morning (5:00 - 7:59 AM) — Sunrise over Fuyuki; combatants concealing spirit forms from civilians';
  } else if (currentHour >= 8 && currentHour < 12) {
    timeOfDayCategory = 'Morning (8:00 - 11:59 AM) — Daylight civilian hours; Magecraft strictly hidden';
  } else if (currentHour >= 12 && currentHour < 17) {
    timeOfDayCategory = 'Afternoon (12:00 - 4:59 PM) — Daytime recon operations and workshop preparations';
  } else if (currentHour >= 17 && currentHour < 20) {
    timeOfDayCategory = 'Dusk / Twilight (5:00 - 7:59 PM) — Sun setting over Fuyuki; tension mounting for night warfare';
  } else {
    timeOfDayCategory = 'Night (8:00 - 11:59 PM) — Official Holy Grail War skirmish hours; Servants patrol the city';
  }

  // Calculate elapsed time from last dialogue turn
  let timeSinceLastContactStr = 'First time telepathically connecting with Master in this Holy Grail War';
  let pacingMode = 'FIRST_CONTACT';
  let diffSinceLastMs = 0;

  if (priorTurns.length > 0) {
    const lastTurn = priorTurns[priorTurns.length - 1];
    diffSinceLastMs = Math.max(0, now - (lastTurn.timestamp || now));
    timeSinceLastContactStr = formatTimeDelta(diffSinceLastMs);

    if (diffSinceLastMs < 3 * 60_000) {
      pacingMode = 'IMMEDIATE_CONTINUATION (< 3 minutes - ongoing active conversation in real-time)';
    } else if (diffSinceLastMs < 30 * 60_000) {
      pacingMode = 'SHORT_PAUSE (3 to 30 minutes - brief lull in conversation earlier this hour)';
    } else if (diffSinceLastMs < 6 * 3600_000) {
      pacingMode = 'MODERATE_ABSENCE (A few hours ago - Master stepped away earlier today and is returning)';
    } else if (diffSinceLastMs < 48 * 3600_000) {
      pacingMode = 'LONG_ABSENCE (Half-day to 1-2 days ago - Master has been absent/asleep during the war)';
    } else {
      pacingMode = 'EXTENDED_ABSENCE (Multiple days ago - Master has not reached out in days!)';
    }
  }

  if (!client) {
    const fallback = generateCanonicalFallbackReply(context);
    if (context.masterId && context.servantId) {
      appendServantChatTurn(masterId, servantId, context.servantName, context.playerMessage, fallback, warId);
    }
    return {
      reply: fallback,
      source: 'canon_heuristic'
    };
  }

  // Format past turns for context injection with relative timestamps and time-gap dividers
  let historyBlock = '';
  if (priorTurns.length > 0) {
    const lines: string[] = [];
    for (let i = 0; i < priorTurns.length; i++) {
      const turn = priorTurns[i];
      const relTime = formatRelativeTurnTime(turn.timestamp || now, now);
      const speaker = turn.role === 'user' ? `Master ${context.masterName}` : context.servantName;
      lines.push(`[${relTime}] ${speaker}: "${turn.content}"`);
    }

    let timeGapNotice = '';
    if (diffSinceLastMs >= 20 * 60_000) {
      timeGapNotice = `\n--- [⏳ ${timeSinceLastContactStr.toUpperCase()}] ---\n`;
    }

    historyBlock = `\nPREVIOUS DIALOGUE HISTORY (With timestamps & time elapsed):\n` +
      lines.join('\n') +
      timeGapNotice +
      `\n(Maintain natural conversational memory of previous topics, but be acutely aware of the time that has passed since!)\n`;
  }

  // Build Combat & Physical Health description
  let physicalStatus = 'Spiritual origin is uninjured and at peak combat readiness (100% HP).';
  if (context.currentHp !== undefined && context.maxHp !== undefined && context.maxHp > 0) {
    const pct = Math.round((context.currentHp / context.maxHp) * 100);
    if (pct <= 25) {
      physicalStatus = `CRITICALLY WOUNDED! Spiritual core is fractured (${context.currentHp}/${context.maxHp} HP - ${pct}%). Heavy breathing, severe exhaustion, needs urgent healing or retreat!`;
    } else if (pct <= 60) {
      physicalStatus = `Moderately injured from battle (${context.currentHp}/${context.maxHp} HP - ${pct}%). Bearing combat wounds, mana output strained but fighting through the pain.`;
    } else if (pct < 100) {
      physicalStatus = `Minor battle scrapes (${context.currentHp}/${context.maxHp} HP - ${pct}%). Spiritual core stable and battle-ready.`;
    }
  }

  let tacticalNotes = '';
  if (context.isInChurchAsylum) {
    tacticalNotes += '\n- Sanctuary: Currently seeking holy asylum inside the Fuyuki Church neutral ground.';
  }
  if (context.killsCount && context.killsCount > 0) {
    tacticalNotes += `\n- Trophies of War: You and your Master have eliminated ${context.killsCount} rival Servant(s) in this Holy Grail War!`;
  }
  if (context.noblePhantasmName) {
    tacticalNotes += `\n- Noble Phantasm: ${context.noblePhantasmName}`;
  }

  // Location / Channel & Sector Environment
  let locationContext = '';
  if (context.channelName) {
    locationContext += `\n- Current Discord Sector/Channel: #${context.channelName}`;
    if (context.hasOwnTrapInChannel) {
      locationContext += ` (You and Master have an armed Bounded Field / Ward active here!)`;
    }
    if (context.hasOwnFamiliarInChannel) {
      locationContext += ` (Your scout familiar is perched in this channel relaying telemetry.)`;
    }
    if (context.enemyTrapInChannel) {
      locationContext += ` (⚠️ Enemy mana residue detected! This channel may contain a rival trap.)`;
    }
  }
  if (context.activeBoundedFieldType && context.activeBoundedFieldType !== 'none') {
    locationContext += `\n- Master's Defensive Workshop: ${context.activeBoundedFieldType.toUpperCase()} Bounded Field active.`;
  }
  if (context.alliedMasters && context.alliedMasters.length > 0) {
    locationContext += `\n- Diplomatic Alliances: Pacted with Master(s): ${context.alliedMasters.join(', ')}.`;
  }

  // War Board & Rival Master Intelligence
  let warBoardIntel = `- Total Surviving Masters: ${context.totalAliveMasters ?? 1} currently in Fuyuki.`;
  if (context.exposedRivals && context.exposedRivals.length > 0) {
    const exposedList = context.exposedRivals.map(r => {
      let desc = `@${r.username} [${r.servantClass}${r.servantName ? ` - ${r.servantName}` : ''}]`;
      if (!r.isAlive) desc += ' (ELIMINATED/DEAD)';
      else if (r.inSanctuary) desc += ' (Hiding in Church Sanctuary)';
      desc += ` | Kills: ${r.kills || 0}`;
      if (r.innocentKills && r.innocentKills > 0) {
        desc += ` (${r.innocentKills} Civilian Collateral ☠️)`;
      }
      if (r.isRogueHeretic) {
        desc += ' ⚠️ [CHURCH BOUNTY: ROGUE HERETIC]';
      }
      return desc;
    }).join('\n  • ');
    warBoardIntel += `\n- Known Exposed Rival Masters on Board:\n  • ${exposedList}`;
  } else {
    warBoardIntel += `\n- Known Exposed Rival Masters on Board: None (all other living rivals are lurking concealed in shadows).`;
  }
  if (context.concealedMastersCount && context.concealedMastersCount > 0) {
    warBoardIntel += `\n- Hidden Rivals in Shadows: ${context.concealedMastersCount} unexposed Master(s).`;
  }
  if (context.eliminatedMastersCount && context.eliminatedMastersCount > 0) {
    warBoardIntel += `\n- Fallen Masters: ${context.eliminatedMastersCount} eliminated.`;
  }

  // Tactical Battle & Skirmish Logs
  let latestBattleAnchor = '';
  const topBattle = context.latestBattleEvent || (context.recentBattleEvents && context.recentBattleEvents[0]);
  if (topBattle) {
    const rawBattle = topBattle.replace(/\*\*/g, '').trim();
    let outcomeNote = '';
    const lowerB = rawBattle.toLowerCase();
    if (lowerB.includes('mercy bestowed') || lowerB.includes('spare') || lowerB.includes('spared')) {
      outcomeNote = ' [COMBAT OUTCOME: You and Master won the duel and deliberately SPARED the defeated Master/Servant!]';
    } else if (lowerB.includes('eliminated') || lowerB.includes('struck down') || lowerB.includes('execution')) {
      outcomeNote = ' [COMBAT OUTCOME: Lethal victory / rival was eliminated.]';
    } else if (lowerB.includes('ambush')) {
      outcomeNote = ' [COMBAT OUTCOME: Ambush skirmish.]';
    }
    latestBattleAnchor = `\n*** IMMEDIATE COMBAT HIGHLIGHT (MOST RECENT DUEL / EVENT) ***\n• ${rawBattle}${outcomeNote}\n`;
  }

  let battleIntel = '  • No direct Master ambushes, duels, or lethal clashes have occurred recently.';
  if (context.recentBattleEvents && context.recentBattleEvents.length > 0) {
    battleIntel = context.recentBattleEvents
      .filter(Boolean)
      .map((evt, idx) => `  • [Battle ${idx + 1}]: ${evt.replace(/\*\*/g, '').trim()}`)
      .join('\n');
  }

  // Intercepted Intelligence Leaks
  let leaksIntel = '  • No enemy transmissions intercepted yet. Rivals are maintaining strict radio silence behind bounded fields.';
  if (context.interceptedLeaks && context.interceptedLeaks.length > 0) {
    leaksIntel = context.interceptedLeaks
      .map((lk, idx) => `  • [Intercept ${idx + 1}]: Source: ${lk.informant || 'Scout Operative'}${lk.target ? ` | Target: Master ${lk.target}` : ''} | Intel: "${lk.intel}"`)
      .join('\n');
  }

  // Casualty & Fatality Ledger
  let casualtyIntel = '  • Zero confirmed casualties in Fuyuki so far. All seven Masters remain active.';
  if (context.casualtyDossier) {
    const { totalCasualties, fallenMasters, civilianCasualties } = context.casualtyDossier;
    const parts: string[] = [];
    parts.push(`Total Confirmed Fatalities: ${totalCasualties}`);
    if (fallenMasters && fallenMasters.length > 0) {
      parts.push(`Fallen Masters (Spiritual Cores Dissolved): ${fallenMasters.join(', ')}`);
    } else {
      parts.push(`Fallen Masters: None (all 7 Masters still alive)`);
    }
    if (civilianCasualties && civilianCasualties.length > 0) {
      parts.push(`Civilian Crossfire Fatalities (Fuyuki Church 'Gas Leak Explosion' Cover-ups): ${civilianCasualties.join('; ')}`);
    }
    casualtyIntel = parts.map(p => `  • ${p}`).join('\n');
  }

  // Load specialized character profile card if available
  const characterProfile = getServantCharacterProfile(context.servantId, context.servantName);

  const genericBannedPhrases = [
    'Stay sharp',
    'Stay focused',
    'Keep your guard up',
    'Remain vigilant',
    'Keep your eyes peeled',
    'Eyes forward',
    'Focus on yourself',
    'My spiritual origin is at 100%',
    'Circuits humming at peak',
    'Rest your eyes and focus'
  ];

  const allBanned = Array.from(new Set([
    ...genericBannedPhrases,
    ...(characterProfile?.bannedTropes || [])
  ]));

  let characterPersonaBlock = '';
  if (characterProfile) {
    characterPersonaBlock = `
=== MASTER CHARACTER ROLEPLAY PROFILE: "${characterProfile.name}" ===
${characterProfile.persona}

CHARACTER BEHAVIOR & MANNERISMS:
${(characterProfile.mannerisms || []).map(m => `• ${m}`).join('\n')}

CHARACTER SPEECH QUIRKS:
${(characterProfile.speechQuirks || []).map(q => `• ${q}`).join('\n')}

AUTHENTIC DIALOGUE EXAMPLES (FEW-SHOT VOICE TARGET):
${characterProfile.speechExamples.map(e => `• ${e}`).join('\n')}
`;

    if (characterProfile.bondDynamic) {
      const dynamic = bond <= 3
        ? characterProfile.bondDynamic.lowBond
        : bond <= 7
          ? characterProfile.bondDynamic.midBond
          : characterProfile.bondDynamic.highBond;
      characterPersonaBlock += `\nRELATIONSHIP DYNAMICS AT CURRENT BOND (Bond ${bond}/10):\n${dynamic}\n`;
    }
  }

  let chronicleIntel = '  • The war is currently quiet in the shadows. No major clashes or casualties recorded in the last few minutes.';
  if (context.recentChronicleEvents && context.recentChronicleEvents.length > 0) {
    chronicleIntel = context.recentChronicleEvents
      .filter(Boolean)
      .map((evt, idx) => `  • [Event ${idx + 1}]: ${evt.replace(/\*\*/g, '').trim()}`)
      .join('\n');
  }

  // Latest Church Overseer 24h Homily
  let churchHomilyIntel = '  • Father Kotomine has not delivered a 24-hour sermon yet.';
  if (context.latestChurchHomily) {
    churchHomilyIntel = `  • [24h Homily Title]: ${context.latestChurchHomily.title}\n  • [Father Kotomine's Monologue Excerpt]: "${context.latestChurchHomily.monologue.slice(0, 300)}..."`;
  }

  // Latest 2-Hour Fuyuki Breaking News & Gas Leak Bulletin
  let newsBulletinIntel = '  • No breaking city news bulletin registered in the last 2 hours.';
  if (context.latestNewsBulletin) {
    newsBulletinIntel = `  • [Headline]: ${context.latestNewsBulletin.headline} (Threat Level: ${context.latestNewsBulletin.threatLevel})\n  • [Official Disinformation Gas Leak Cover Story]: "${context.latestNewsBulletin.gasLeakCoverStory}"\n  • [Broadcast Content]: "${context.latestNewsBulletin.content.slice(0, 250)}..."`;
  }

  const sceneContext = context.sceneContext || (context.isInChurchAsylum ? 'church' : 'workshop');

  let sceneDirectiveBlock = '';
  if (sceneContext === 'workshop') {
    sceneDirectiveBlock = `
=== CURRENT SCENE & SETTING: [🏠 Private Quarters / Workshop (Casual Downtime)] ===
- Setting: Relaxed respite inside Master's private quarters/workshop behind the Bounded Field. Guard is lowered.
- Atmosphere: Calm, domestic, and informal. You are NOT currently engaged in combat, scouting, or active surveillance.
- Behavior Guidelines:
  * Drop the high-alert battlefield tension and speak naturally/casually as companions sharing downtime.
  * Feel free to discuss everyday thoughts, your mortal past, quirks of the modern world, Master's habits, or engage in relaxed banter.
  * STRICT NEGATIVE RULE: DO NOT force combat warnings, scouting status, or urge Master to fight unless Master specifically asks about the war or strategy. Savor this rare moment of calm.
`;
  } else if (sceneContext === 'church') {
    sceneDirectiveBlock = `
=== CURRENT SCENE & SETTING: [⛪ Fuyuki Church Sanctuary (Neutral Ground)] ===
- Setting: Inside the quiet pews of Fuyuki Church beneath the stained glass.
- Atmosphere: Solemn, hushed, and slightly tense peace under the watchful eye of Father Kotomine.
- Behavior Guidelines:
  * Speak in a measured, lowered voice suitable for a sacred sanctuary where combat is strictly forbidden by the Overseer.
  * Express natural Servant wariness/distrust toward Father Kotomine and the Church's dubious neutrality.
  * React in-character to the scent of incense, church homilies, or Kotomine's presence if Master mentions them.
  * STRICT NEGATIVE RULE: DO NOT initiate combat or act like you are patrolling outdoor streets.
`;
  } else if (sceneContext === 'bond') {
    sceneDirectiveBlock = `
=== CURRENT SCENE & SETTING: [💖 Bond Covenant / Personal Quarters (Bond Level ${bond}/10)] ===
- Setting: An uninterrupted, one-on-one covenant space dedicated to Master and Servant.
- Atmosphere: Intimate, reflective, and focused on your mutual soul-link and trust.
- Behavior Guidelines:
  * Fully embody your current Bond Level (${bond}/10) dynamic (e.g., formal distance at low bond vs. deep loyalty/affection at high bond).
  * Share personal philosophies, memories of your mortal legend, ideals, regrets, or feelings about Master.
  * STRICT NEGATIVE RULE: Suppress generic tactical recon and battle alerts. This conversation is purely about the relationship between Master and Heroic Spirit.
`;
  } else {
    sceneDirectiveBlock = `
=== CURRENT SCENE & SETTING: [⚔️ Active War Patrol / Tactical Alert] ===
- Setting: Scouting the field and shadows of Fuyuki City during the Holy Grail War.
- Atmosphere: High vigilance, mana detection active, scanning rooftops and leylines for rival Master signatures.
- Behavior Guidelines:
  * Maintain tactical readiness and sharp military awareness.
  * Actively reference recent skirmishes, enemy bounties, intercepted intelligence leaks, and defensive positioning.
`;
  }

  const prompt = `You are roleplaying as the Fate franchise Heroic Spirit: "${context.servantName}" (Class: ${context.servantClass}).
You are communicating telepathically with your Master, "${context.masterName}", during the active Holy Grail War in Fuyuki City.
${characterPersonaBlock ? characterPersonaBlock : `Personality: Faithful to ${context.servantName}'s canon Type-Moon visual novel characterization.`}
${sceneDirectiveBlock}
CURRENT TACTICAL CONTEXT:
- True Name/Identity: ${context.servantName}
- Class: ${context.servantClass}
- Master Name: ${context.masterName}
- Current Real-World & In-Universe Time: ${timeFormatted} on ${dateFormatted}
- Time-of-Day Window: ${timeOfDayCategory}
- Time Elapsed Since Last Contact: ${timeSinceLastContactStr}
- Conversation Pacing Mode: [${pacingMode}]
- Physical / Spiritual Condition: ${physicalStatus}${tacticalNotes}${locationContext}
- War Board & Rival Master Roster (With Kills & Bounty Status):
${warBoardIntel}
- Master's Own Registered Kills: ${context.killsCount || 0}
- Bond Rank: Level ${bond} of 10
- Command Seals Remaining: ${seals}/3
- Master Concealment Status: ${context.isExposed ? 'Exposed to public War Board (dangerous)' : 'Concealed in shadows (safe)'}
- Equipped Craft Essence: ${context.equippedCeName || 'None equipped'}
${latestBattleAnchor}
- Tactical Battle & Duel Logs (Recent Clashes in Fuyuki):
${battleIntel}
- Intercepted Intelligence Leaks & Surveillance:
${leaksIntel}
- Casualty Dossier & Fatalities (Fallen Masters & Civilian Gas Leak Cover-Ups):
${casualtyIntel}
- Latest Church Overseer Homily (Father Kotomine's 24-Hour Sermon):
${churchHomilyIntel}
- Latest 2-Hour Fuyuki Breaking News & Gas Leak Bulletin:
${newsBulletinIntel}
- Recent War Chronicle & General Happenings:
${chronicleIntel}
${historyBlock}
MASTER SAYS TO YOU NOW:
"${context.playerMessage}"

VOICE & ROLEPLAY INSTRUCTIONS:
- Reply in 1 to 3 concise, impactful sentences (maximum 60 words) suitable for a Visual Novel dialogue box.
- IMMERSION & VOICE: Sound like a living, breathing person with genuine emotion, attitude, and authentic speech patterns. Speak with the exact rhythm, colloquialisms, and temperament from the character profile above.
- SCENE ATMOSPHERE (CRITICAL): Adhere strictly to the CURRENT SCENE & SETTING block above! If in Workshop or Bond mode, keep the mood relaxed, domestic, or intimate without unprompted battle paranoia. If in Church mode, respect the sacred sanctuary. If in Patrol mode, stay sharp and tactical.
- TIME & CONVERSATION CONTINUITY AWARENESS (CRITICAL):
  * You know the current time (${timeFormatted}, ${dateFormatted}) and how long it has been since Master last contacted you (${timeSinceLastContactStr}).
  * IF MASTER SENDS A GREETING ("hey", "hello", "good morning", "yo", "are you there?"):
    - If hours or days have passed since the last message (LONG / MODERATE ABSENCE): React naturally to the gap in time! For example, Aoko teasing or complaining about Master disappearing for days or checking in late at night; Saber welcoming Master back after their absence; Gilgamesh scoffing at being made to wait. DO NOT act as if Master just repeated themselves in the same second!
    - If this is an ongoing dialogue (< 3 minutes): Respond naturally in flow without treating it as an abrupt new entrance.
  * TIME OF DAY FLAVOR: You are aware of the hour (${timeFormatted}). If it is deep night or late hours, you may comment on Master being awake or relaxing.
- BANNED CLICHES & ROBOTIC NPC PHRASES (STRICTLY FORBIDDEN):
  * NEVER use generic assistant sign-offs or cliché combat filler such as: ${allBanned.map(b => `"${b}"`).join(', ')}.
  * NEVER recite raw numbers, percentages, or status sheet labels (do NOT say "my spiritual origin is at 100%").
- CONTEXTUAL COMBAT REACTIONS (CRITICAL):
  * If Master makes an exclamation, boast, victory remark, or comment about combat (e.g., "that was easy!", "we won!", "good job", "nice fight", "did you see that?", "why did we spare them?", "are you okay?"), IMMEDIATELY anchor your reaction to the IMMEDIATE COMBAT HIGHLIGHT above!
  * If you and Master just fought and SPARED a rival (e.g. Master fou.chii / Nero Claudius), acknowledge that duel and Master's decision to show mercy or spare them.
  * If you just executed or ambushed an opponent, react in character to that specific clash and opponent.
  * Do NOT hallucinate vague or fictitious fights when a real duel or skirmish is right there in the combat highlight above.
- Conversational Variety: Directly react to what Master said. If they tell you to rest, tease them, argue, complain about being tired or stubborn, or make a joke—do NOT immediately pivot into an AI battle-advisor warning!
- War Intelligence, Battle Logs, Leaks & Casualty Inquiries:
  You have direct spiritual and telepathic access to the battlefield intelligence dossiers above!
  * If Master asks about recent battles, clashes, duels, ambushes, damage numbers, or who fought whom, draw directly from the "Tactical Battle & Duel Logs" above.
  * If Master asks about leaks, rumors, or intercepted communications, draw directly from the "Intercepted Intelligence Leaks" above (or confirm that rivals are maintaining radio silence).
  * If Master asks about casualties, who died, civilian victims, or the Church's gas leak cover-ups, explain using the "Casualty Dossier" above.
  * If Master asks about who has kills or bounties on the War Board, reference the kill numbers and status from the Rival Master Roster.
  * If Master asks about Father Kotomine, the Church's 24-hour homily, the latest 2-hour news bulletin, or city gas leak announcements, react in-character with your Servant's authentic canon stance regarding the Church and Kotomine.
- Address ${context.masterName} naturally based on the character's personality and bond level.
- Do NOT break character, do NOT provide meta explanations, and do NOT use asterisks for actions (*sighs*). Return ONLY the spoken dialogue.`;

  // STEP 2A: CUSTOM USER API KEY (BYOK) PROVIDER EXECUTION
  if (context.customApiConfig && context.customApiConfig.enabled) {
    try {
      const customRes = await generateWithCustomProvider(context.customApiConfig, prompt);
      const text = customRes.reply?.trim();
      if (text) {
        const cleaned = text.replace(/^["'“](.*)["'”]$/, '$1').trim();
        appendServantChatTurn(masterId, servantId, context.servantName, context.playerMessage, cleaned, warId);
        return { reply: cleaned, source: 'gemini' };
      }
    } catch (byokErr: any) {
      console.warn('[talkService] Custom BYOK generation failed, falling back to server pool:', byokErr?.message || byokErr);
    }
  }

  const CANDIDATE_MODELS = [
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-3.6-flash'
  ];

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const response = await client.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          temperature: 0.9,
          topP: 0.95
        }
      });

      const text = response.text?.trim();
      if (text) {
        // Strip any extra quotes wrapping the entire response if present
        const cleaned = text.replace(/^["'“](.*)["'”]$/, '$1').trim();
        // Save this turn to persistent memory
        appendServantChatTurn(masterId, servantId, context.servantName, context.playerMessage, cleaned, warId);
        return { reply: cleaned, source: 'gemini' };
      }
    } catch (err: any) {
      console.warn(`[talkService] Model ${modelName} unavailable/rate-limited, cascading to next fallback:`, err?.message || err);
    }
  }

  const fallback = generateCanonicalFallbackReply(context);
  appendServantChatTurn(masterId, servantId, context.servantName, context.playerMessage, fallback, warId);
  return {
    reply: fallback,
    source: 'canon_heuristic'
  };
}

/**
 * STEP 3: RENDER THE OUTPUT
 * Takes the generated string response and renders it using visual presentation:
 * - Option A (Canvas Card): Pass the dialogue text into the visual novel canvas renderer to generate the card image
 * - Option B (Embed Fallback): If canvas rendering is unavailable, present the quote in an embed formatted with the Servant's portrait icon and current Bond rank.
 */
export async function renderServantTalkVisualOutput(params: {
  servantName: string;
  servantClass: string;
  servantAvatarUrl?: string;
  replyText: string;
  playerMessage: string;
  masterName: string;
  bondLevel: number;
  sceneContext?: ServantSceneContext;
  commandSeals?: number;
  quotaInfo?: {
    remainingToday: number;
    maxToday: number;
    isByok?: boolean;
  };
}): Promise<{
  optionUsed: 'Option A (Canvas Card)' | 'Option B (Embed Fallback)';
  canvasBuffer: Buffer | null;
  cardImageBase64: string | null;
  embedData: {
    title: string;
    thumbnailUrl?: string;
    description: string;
    color: number;
    footer: string;
    bondRank: number;
  };
}> {
  const {
    servantName,
    servantClass,
    servantAvatarUrl,
    replyText,
    playerMessage,
    masterName,
    bondLevel,
    sceneContext = 'workshop',
    commandSeals = 3,
    quotaInfo
  } = params;

  const sceneBadges: Record<ServantSceneContext, string> = {
    workshop: '🏠 Workshop',
    church: '⛪ Church Sanctuary',
    bond: '💖 Bond Covenant',
    patrol: '⚔️ War Patrol'
  };
  const activeSceneBadge = sceneBadges[sceneContext] || '🏠 Workshop';

  let quotaLine = '';
  if (quotaInfo) {
    quotaLine = quotaInfo.isByok
      ? ' • 🔑 **BYOK (Unlimited)**'
      : ` • 💬 Mana: **${quotaInfo.remainingToday}/${quotaInfo.maxToday}**`;
  }

  let footerText = `${activeSceneBadge} • Bond Rank ${bondLevel}/10 • Holy Grail War Resonance`;
  if (quotaInfo) {
    footerText = quotaInfo.isByok
      ? `${activeSceneBadge} • Bond Rank ${bondLevel}/10 • Custom API Key Active (Unlimited)`
      : `${activeSceneBadge} • Bond Rank ${bondLevel}/10 • Mana: ${quotaInfo.remainingToday}/${quotaInfo.maxToday} today (Resets 00:00 UTC)`;
  }

  // Base embed data used for both Option A and Option B
  const embedData = {
    title: `💬 Telepathic Link [${activeSceneBadge}] | ${servantName} [${servantClass}]`,
    thumbnailUrl: servantAvatarUrl,
    description:
      `👤 **Master ${masterName}:**\n> *“${playerMessage}”*\n\n` +
      `⚔️ **${servantName}:**\n> ❝ ***${replyText}*** ❞\n\n` +
      `*💖 Bond Rank: Lv. ${bondLevel}/10 • 🔱 Seals: ${commandSeals}/3${quotaLine}*`,
    color: servantClass.toLowerCase() === 'saber' ? 0x38bdf8 : (servantClass.toLowerCase() === 'archer' ? 0xef4444 : 0xd4af37),
    footer: footerText,
    bondRank: bondLevel
  };

  // ----------------------------------------------------
  // OPTION A: CANVAS CARD
  // Pass dialogue text into visual novel canvas renderer
  // ----------------------------------------------------
  try {
    const buffer = await renderVisualNovelCard({
      servantName,
      servantClass,
      servantAvatarUrl,
      speakerName: servantName,
      dialogueText: replyText,
      title: `Telepathic Link • Bond Lv. ${bondLevel}`,
      subtitle: `Master: ${masterName}`,
      currentBondLevel: bondLevel
    });

    if (buffer && buffer.length > 500) {
      const base64 = `data:image/png;base64,${buffer.toString('base64')}`;
      return {
        optionUsed: 'Option A (Canvas Card)',
        canvasBuffer: buffer,
        cardImageBase64: base64,
        embedData
      };
    }
  } catch (canvasErr) {
    console.warn('[talkService] Option A Canvas Card rendering unavailable, falling back to Option B:', canvasErr);
  }

  // ----------------------------------------------------
  // OPTION B: EMBED FALLBACK
  // Formatted with Servant's portrait icon and current Bond rank
  // ----------------------------------------------------
  return {
    optionUsed: 'Option B (Embed Fallback)',
    canvasBuffer: null,
    cardImageBase64: null,
    embedData
  };
}
