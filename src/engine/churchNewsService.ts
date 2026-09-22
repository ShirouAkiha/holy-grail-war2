import { GoogleGenAI } from '@google/genai';
import { HolyGrailWarSession, ChurchOverseerHomily, FuyukiNewsBulletin } from '../types';
import { saveWarToDisk } from './grailwar';

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

// =========================================================================
// 1. KOTOMINE KIREI 24-HOUR HOMILY & SERMON GENERATOR
// =========================================================================

export function formatCleanShortMonologue(raw: string | undefined, maxChars: number = 240): string {
  if (!raw) return 'Rejoice, Masters. The leylines await your blood.';
  const clean = raw.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;

  const sentences = clean.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length > 0) {
    let acc = '';
    for (const s of sentences) {
      if ((acc + ' ' + s).trim().length <= maxChars) {
        acc = (acc + ' ' + s).trim();
      } else {
        break;
      }
    }
    if (acc.length >= 25) return acc;
  }

  const words = clean.split(' ');
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).length <= maxChars - 4) {
      cur = (cur + ' ' + w).trim();
    } else {
      break;
    }
  }
  return cur ? `${cur}...` : clean.slice(0, maxChars - 3) + '...';
}

export function generateCanonicalKotomineHomily(war: HolyGrailWarSession): ChurchOverseerHomily {
  const participants = Object.values(war.participants || {});
  const livingMasters = participants.filter(p => p.isAlive);
  const fallenMasters = participants.filter(p => !p.isAlive);
  const asylumMasters = participants.filter(p => p.inSanctuary || p.inChurchSanctuary);
  const rogueHeretics = participants.filter(p => (p.innocentKills || 0) >= 10 || p.bountyActive);
  const civilianCount = war.civilianCasualties?.length || 0;
  const totalCasualties = fallenMasters.length + civilianCount;

  // Recent battle events from logs
  const battleLogs = (war.eventLogs || []).filter(l => 
    l.type === 'clash' || l.type === 'ambush' || l.type === 'elimination' || l.type === 'casualty' ||
    (l.text && (l.text.includes('clash') || l.text.includes('ambush') || l.text.includes('eliminated') || l.text.includes('casualty')))
  );

  const rawMonologue = `Rejoice, Masters. Another 24 hours have passed, and ${totalCasualties} soul(s) have fed the leylines. ${fallenMasters.length > 0 ? `${fallenMasters.map(f => f.username).join(', ')} have returned their cores to the Grail.` : `All ${livingMasters.length} of you miraculously still cling to life.`} ${asylumMasters.length > 0 ? `${asylumMasters.map(a => a.username).join(', ')} seek shelter in my church.` : `None yet seek sanctuary.`} Carve each other apart with haste—I shall watch from the bell tower.`;
  const monologue = formatCleanShortMonologue(rawMonologue, 240);

  const keyEvents = battleLogs.slice(0, 3).map(l => typeof l === 'string' ? l : l.text);
  if (keyEvents.length === 0) {
    keyEvents.push('The leylines remain quiet under the watchful eye of the Holy Church.');
  }

  return {
    id: `homily_${Date.now()}`,
    timestamp: Date.now(),
    periodHours: 24,
    title: '🕯️ Overseer’s 24h Word | Father Kotomine',
    subtitle: 'Theological Reflection on the Desires of Fuyuki’s Masters',
    monologue,
    source: 'canon_heuristic',
    statsSummary: {
      totalCasualties,
      fallenMastersCount: fallenMasters.length,
      survivingMastersCount: livingMasters.length,
      rogueHereticsCount: rogueHeretics.length,
      asylumCount: asylumMasters.length,
      totalDuelsAndAmbushes: battleLogs.length
    },
    keyEvents
  };
}

export async function generateKotomine24hHomily(
  war: HolyGrailWarSession,
  forceRefresh: boolean = false
): Promise<ChurchOverseerHomily> {
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  
  // Return cached homily if not expired (less than 24h old) and not forcing refresh
  if (!forceRefresh && war.latestChurchHomily && (Date.now() - war.latestChurchHomily.timestamp < TWENTY_FOUR_HOURS_MS)) {
    // If stored homily monologue is a wall of text (> 260 chars), format/clean it in place
    if (war.latestChurchHomily.monologue && war.latestChurchHomily.monologue.length > 260) {
      war.latestChurchHomily.monologue = formatCleanShortMonologue(war.latestChurchHomily.monologue, 240);
      saveWarToDisk();
    }
    return war.latestChurchHomily;
  }

  const participants = Object.values(war.participants || {});
  const livingMasters = participants.filter(p => p.isAlive);
  const fallenMasters = participants.filter(p => !p.isAlive);
  const asylumMasters = participants.filter(p => p.inSanctuary || p.inChurchSanctuary);
  const rogueHeretics = participants.filter(p => (p.innocentKills || 0) >= 10 || p.bountyActive);
  const civilianCount = war.civilianCasualties?.length || 0;
  const totalCasualties = fallenMasters.length + civilianCount;

  const last24hLogs = (war.eventLogs || []).filter(l => 
    Date.now() - (l.timestamp || Date.now()) <= TWENTY_FOUR_HOURS_MS
  );
  const battleLogs = last24hLogs.length > 0 ? last24hLogs : (war.eventLogs || []).slice(0, 10);

  const client = getAiClient();
  if (!client) {
    const fallback = generateCanonicalKotomineHomily(war);
    war.latestChurchHomily = fallback;
    if (!war.homilyHistory) war.homilyHistory = [];
    war.homilyHistory.unshift(fallback);
    saveWarToDisk();
    return fallback;
  }

  const battleSummaries = battleLogs
    .map((l, i) => `[Event ${i + 1}]: ${l.text.replace(/\*\*/g, '')}`)
    .join('\n');

  const fallenNames = fallenMasters.map(f => `${f.username} (${f.servantName} [${f.servantClass}])`).join(', ') || 'None';
  const livingNames = livingMasters.map(l => `${l.username} (${l.servantClass}) - ${l.currentHp}/${l.maxHp} HP, ${l.commandSeals} Seals`).join('\n  • ') || 'None';
  const asylumNames = asylumMasters.map(a => a.username).join(', ') || 'None';
  const hereticNames = rogueHeretics.map(h => `${h.username} (${h.innocentKills} civilian kills)`).join(', ') || 'None';
  const civilianDetails = (war.civilianCasualties || []).map(c => `${c.name} (slain by ${c.slayerUsername || 'Unknown'})`).join(', ') || 'None';

  const prompt = `You are roleplaying as Father Kotomine Kirei, the solemn, sinister, and sardonic Overseer of the Fuyuki Holy Grail War from Type-Moon's Fate/stay night and Fate/Zero.
You are delivering your 24-HOUR OVERSEER'S HOMILY / MONOLOGUE to all participating Masters and observers.

CONTEXT OF THE LAST 24 HOURS IN FUYUKI:
- Total Casualties in War: ${totalCasualties} (Fallen Masters: ${fallenMasters.length}, Civilian Collateral: ${civilianCount})
- Fallen Masters (Spiritual Cores Dissolved): ${fallenNames}
- Living Masters Roster:
  • ${livingNames}
- Masters Currently in Church Sanctuary / Asylum: ${asylumNames}
- Excommunicated Rogue Heretics (Bounties Active): ${hereticNames}
- Civilian Collateral Cover-up Dossier: ${civilianDetails}
- Recent Clashes & Tactical Logs from the Past 24 Hours:
${battleSummaries || 'Quiet shadows across Fuyuki leylines.'}

KOTOMINE KIREI ROLEPLAY GUIDELINES:
- CRITICAL LENGTH RULE: Deliver a short, biting, theatrical soliloquy of EXACTLY 2 TO 3 SENTENCES (under 45 words total / ~250 characters). DO NOT write multiple paragraphs or a wall of text.
- Tone: Cold, liturgical, deeply articulate, philosophical schadenfreude. You relish the absurdity of human ambition and the spectacle of their suffering.
- Iconic traits: Use phrases like "Rejoice, Master" or "Yorokobe, shounen", reference Mapo tofu, consecrated incense, or your role as arbitrator.
- MUST BE SHORT AND COMPLETE so it can be displayed in full without getting cut off or becoming a wall of text.
- Return a valid JSON object matching the exact schema below.

JSON Output Schema:
{
  "title": "A short, evocative homily title (under 8 words)",
  "subtitle": "A concise theological subtitle (under 12 words)",
  "monologue": "The complete 2-3 sentence monologue from Kotomine Kirei (under 45 words total).",
  "keyEvents": ["2 to 3 very brief bullet points (under 15 words each) with Kotomine's cynical remarks"]
}`;

  try {
    const CANDIDATE_MODELS = [
      'gemini-3.8-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest',
      'gemini-3.1-flash-lite'
    ];

    let response;
    for (const modelName of CANDIDATE_MODELS) {
      try {
        response = await client.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            temperature: 0.9,
            responseMimeType: 'application/json'
          }
        });
        if (response && response.text) break;
      } catch (primaryErr: any) {
        console.warn(`[churchNewsService] ${modelName} homily failed, trying next candidate:`, primaryErr?.message || primaryErr);
      }
    }

    let text = response?.text?.trim();
    if (text) {
      text = text.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/g, '').trim();
      const parsed = JSON.parse(text);
      const homily: ChurchOverseerHomily = {
        id: `homily_${Date.now()}`,
        timestamp: Date.now(),
        periodHours: 24,
        title: parsed.title || '🕯️ The Overseer’s 24-Hour Homily | Father Kotomine’s Soliloquy',
        subtitle: parsed.subtitle || 'Father Kotomine’s Sermon on the Carnage of Fuyuki',
        monologue: formatCleanShortMonologue(parsed.monologue || generateCanonicalKotomineHomily(war).monologue, 240),
        source: 'gemini',
        statsSummary: {
          totalCasualties,
          fallenMastersCount: fallenMasters.length,
          survivingMastersCount: livingMasters.length,
          rogueHereticsCount: rogueHeretics.length,
          asylumCount: asylumMasters.length,
          totalDuelsAndAmbushes: battleLogs.length
        },
        keyEvents: Array.isArray(parsed.keyEvents) && parsed.keyEvents.length > 0 
          ? parsed.keyEvents 
          : battleLogs.slice(0, 4).map(l => l.text)
      };

      war.latestChurchHomily = homily;
      if (!war.homilyHistory) war.homilyHistory = [];
      war.homilyHistory.unshift(homily);
      if (war.homilyHistory.length > 10) war.homilyHistory = war.homilyHistory.slice(0, 10);
      saveWarToDisk();
      return homily;
    }
  } catch (err) {
    console.error('[churchNewsService] Gemini error generating homily, using fallback:', err);
  }

  const fallback = generateCanonicalKotomineHomily(war);
  war.latestChurchHomily = fallback;
  if (!war.homilyHistory) war.homilyHistory = [];
  war.homilyHistory.unshift(fallback);
  saveWarToDisk();
  return fallback;
}

// =========================================================================
// 2. 2-HOUR FUYUKI BREAKING NEWS BULLETIN & GAS LEAK REPORT
// =========================================================================

export function generateCanonicalNewsBulletin(war: HolyGrailWarSession): FuyukiNewsBulletin {
  const participants = Object.values(war.participants || {});
  const rogueHeretics = participants.filter(p => (p.innocentKills || 0) >= 10 || p.bountyActive);
  const recentLogs = (war.eventLogs || []).slice(0, 3);

  const headline = '🚨 MUNICIPAL ALERT: Substation Surge & Pressurized Gas Line Fracture';
  const gasLeakCoverStory = 'Fuyuki Public Safety Bureau attributes localized tremors and blue sparks in Miyama District to an underground gas pipe rupture and aged electrical transformer surge. Citizens are advised to stay indoors.';
  
  const content = `Emergency crews have contained the localized pressure spike. Reports of armored apparitions or sonic booms are confirmed to be mass optical illusions from concentrated vapor fumes.`;

  const bulletinPoints = recentLogs.map(l => `• [Tactical Dispatch]: ${l.text.replace(/\*\*/g, '').slice(0, 70)}`);
  if (bulletinPoints.length === 0) {
    bulletinPoints.push('• [Municipal Status]: Low ambient mana fluctuations detected across Fuyuki sectors.');
  }

  let threatLevel: 'Low' | 'Moderate' | 'Severe' | 'Catastrophic' = 'Moderate';
  if (rogueHeretics.length > 0 || (war.civilianCasualties && war.civilianCasualties.length >= 3)) {
    threatLevel = 'Severe';
  }

  return {
    id: `news_${Date.now()}`,
    timestamp: Date.now(),
    periodHours: 2,
    headline,
    broadcastChannel: '📻 Fuyuki Emergency Radio (FM 84.7)',
    content,
    gasLeakCoverStory,
    bulletinPoints,
    threatLevel,
    activeBountiesCount: rogueHeretics.length,
    source: 'canon_heuristic'
  };
}

export async function generateFuyuki2hNewsBulletin(
  war: HolyGrailWarSession,
  forceRefresh: boolean = false
): Promise<FuyukiNewsBulletin> {
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

  // Return cached news if fresh (< 2 hours) and not forcing refresh
  if (!forceRefresh && war.latestNewsBulletin && (Date.now() - war.latestNewsBulletin.timestamp < TWO_HOURS_MS)) {
    return war.latestNewsBulletin;
  }

  const participants = Object.values(war.participants || {});
  const rogueHeretics = participants.filter(p => (p.innocentKills || 0) >= 10 || p.bountyActive);
  const last2hLogs = (war.eventLogs || []).filter(l => 
    Date.now() - (l.timestamp || Date.now()) <= TWO_HOURS_MS
  );
  const recentLogs = last2hLogs.length > 0 ? last2hLogs : (war.eventLogs || []).slice(0, 6);

  const client = getAiClient();
  if (!client) {
    const fallback = generateCanonicalNewsBulletin(war);
    war.latestNewsBulletin = fallback;
    if (!war.newsHistory) war.newsHistory = [];
    war.newsHistory.unshift(fallback);
    saveWarToDisk();
    return fallback;
  }

  const logContext = recentLogs
    .map((l, i) => `• [Event ${i + 1}]: ${l.text.replace(/\*\*/g, '')}`)
    .join('\n');

  const civilianRecent = (war.civilianCasualties || [])
    .slice(0, 3)
    .map(c => `${c.name} in #${c.channelName || 'general'}`)
    .join(', ') || 'No new civilian casualties';

  const prompt = `You are the cynical, absurdly official Fuyuki City Council & Holy Church Disinformation Bureau broadcaster.
Your job is to broadcast the 2-HOUR FUYUKI BREAKING NEWS BULLETIN covering the most recent supernatural clashes, Noble Phantasms, and Master ambushes from the Holy Grail War.

THE SACRED RULE: TO PRESERVE THE SECRECY OF MAGECRAFT, YOU MUST COVER UP ALL DEADLY MAGICAL SKIRMISHES AS ABSURD MUNDANE INDUSTRIAL ACCIDENTS:
- Severe explosions = "Underground methane gas leak" or "Industrial boiler backfire"
- Archer arrows / magic beams = "Faulty neon signage electrical arc" or "Rogue fireworks shipment combustion"
- Servant sword slashes = "Structural stress fracture from seismic vibration"
- Civilian crossfire = "Mild chemical dizziness and temporary hospitalizations from odorized gas fumes"

TACTICAL EVENTS FROM THE LAST 2 HOURS IN FUYUKI:
${logContext || 'Quiet night across the city sectors.'}
- Recent Civilian Incidents: ${civilianRecent}
- Active Church Extermination Bounties: ${rogueHeretics.length} Wanted Rogue Heretics

ROLEPLAY GUIDELINES:
- Output a dramatic, concise, and satirical news bulletin report (under 60 words total).
- Assign an appropriate Threat Level ('Low', 'Moderate', 'Severe', or 'Catastrophic').
- Give an outrageous yet deadpan 1-2 sentence "Official Gas Leak Cover Story" (under 35 words).
- Write a short 1-paragraph news report (under 40 words) advising "citizens" on safety measures.
- Output valid JSON matching the exact schema below.

JSON Output Schema:
{
  "headline": "Punchy all-caps breaking headline (under 8 words)",
  "broadcastChannel": "📻 Fuyuki Emergency Radio (FM 84.7)",
  "gasLeakCoverStory": "A concise 1-2 sentence mundane gas leak cover story explaining recent magical clashes.",
  "content": "A short 1-paragraph city advisory covering up the skirmishes (under 40 words).",
  "bulletinPoints": ["2 to 3 very brief bullet points (under 12 words each) disguised as city updates"],
  "threatLevel": "Low" | "Moderate" | "Severe" | "Catastrophic"
}`;

  try {
    const CANDIDATE_MODELS = [
      'gemini-3.8-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest',
      'gemini-3.1-flash-lite'
    ];

    let response;
    for (const modelName of CANDIDATE_MODELS) {
      try {
        response = await client.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            temperature: 0.85,
            responseMimeType: 'application/json'
          }
        });
        if (response && response.text) break;
      } catch (primaryErr: any) {
        console.warn(`[churchNewsService] ${modelName} news failed, trying next candidate:`, primaryErr?.message || primaryErr);
      }
    }

    let text = response?.text?.trim();
    if (text) {
      text = text.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/g, '').trim();
      const parsed = JSON.parse(text);
      const news: FuyukiNewsBulletin = {
        id: `news_${Date.now()}`,
        timestamp: Date.now(),
        periodHours: 2,
        headline: parsed.headline || '🚨 FUYUKI MUNICIPAL DISPATCH: Localized Gas Leak Anomaly Reported',
        broadcastChannel: parsed.broadcastChannel || '📻 Fuyuki Municipal Radio & Church Leyline Relay',
        content: parsed.content || generateCanonicalNewsBulletin(war).content,
        gasLeakCoverStory: parsed.gasLeakCoverStory || 'Underground pressurized gas resonance.',
        bulletinPoints: Array.isArray(parsed.bulletinPoints) && parsed.bulletinPoints.length > 0
          ? parsed.bulletinPoints
          : recentLogs.slice(0, 4).map(l => `• ${l.text}`),
        threatLevel: ['Low', 'Moderate', 'Severe', 'Catastrophic'].includes(parsed.threatLevel) ? parsed.threatLevel : 'Moderate',
        activeBountiesCount: rogueHeretics.length,
        source: 'gemini'
      };

      war.latestNewsBulletin = news;
      if (!war.newsHistory) war.newsHistory = [];
      war.newsHistory.unshift(news);
      if (war.newsHistory.length > 15) war.newsHistory = war.newsHistory.slice(0, 15);
      saveWarToDisk();
      return news;
    }
  } catch (err) {
    console.error('[churchNewsService] Gemini error generating news bulletin, using fallback:', err);
  }

  const fallback = generateCanonicalNewsBulletin(war);
  war.latestNewsBulletin = fallback;
  if (!war.newsHistory) war.newsHistory = [];
  war.newsHistory.unshift(fallback);
  saveWarToDisk();
  return fallback;
}

/**
 * Ensures both 24h Kotomine Homily and 2h News Bulletin are initialized in the war session.
 */
export async function getOrInitChurchIntel(
  war: HolyGrailWarSession,
  forceRefresh: boolean = false
): Promise<{
  homily: ChurchOverseerHomily;
  news: FuyukiNewsBulletin;
}> {
  const [homily, news] = await Promise.all([
    generateKotomine24hHomily(war, forceRefresh),
    generateFuyuki2hNewsBulletin(war, forceRefresh)
  ]);
  return { homily, news };
}
