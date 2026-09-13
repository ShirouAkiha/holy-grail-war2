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

  const monologue = `Rejoice, boys and girls. Another twenty-four hours have passed over our beloved Fuyuki City, and once more, the leylines are soaked in the sweet, fragrant tears of human ambition.

Look upon yourselves. Seven souls entered this ritual with grand vows and sanctimonious prayers, yet what has your struggle yielded? We count ${totalCasualties} soul${totalCasualties === 1 ? '' : 's'} dissolved into the ether. ${fallenMasters.length > 0 ? `Those who have fallen—${fallenMasters.map(f => f.username).join(', ')}—have returned their spiritual cores to the Greater Grail.` : `Miraculously, all seven of you still cling to your fragile mortal shells, scurrying through the shadows like frightened mice.`}

${asylumMasters.length > 0 ? `Some among you (${asylumMasters.map(a => a.username).join(', ')}) have sought sanctuary within the cold stone walls of this Holy Church. How touching it is that those who wield weapons of myth would run to the altar of God to plead for peace. I shall grant you your shelter, of course... for even cowardice has its own tragic charm.` : `None have yet dared to kneel before this altar for sanctuary. Your pride is commendable, if utterly foolish.`}

${rogueHeretics.length > 0 ? `And to our dear rogue heretics—know that the Church watches with great amusement. Spilling innocent blood under the night sky only accelerates your own demise.` : `The secrecy of our craft barely endures the weight of your reckless duels.`}

Fight on, Masters of Fuyuki. Carve each other apart in the pursuit of a cup that offers no salvation. I, Father Kotomine, shall be watching from the bell tower, savoring every exquisite drop of your despair.`;

  const keyEvents = battleLogs.slice(0, 4).map(l => typeof l === 'string' ? l : l.text);
  if (keyEvents.length === 0) {
    keyEvents.push('The leylines remain quiet under the watchful eye of the Holy Church.');
  }

  return {
    id: `homily_${Date.now()}`,
    timestamp: Date.now(),
    periodHours: 24,
    title: '🕯️ The Overseer’s 24-Hour Homily | Father Kotomine’s Soliloquy',
    subtitle: 'A Theological Reflection on the Carnage & Desires of Fuyuki’s Masters',
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
- Deliver a theatrical, profound, chilling, and darkly humorous monologue in 3 to 4 paragraphs.
- Tone: Cold, liturgical, deeply articulate, philosophical schadenfreude. You relish the absurdity of human ambition and the exquisite spectacle of their suffering.
- Iconic traits: Use phrases like "Rejoice, Master" or "Yorokobe, shounen", reference eating spicy Mapo tofu in the church pews, the scent of consecrated incense, the futility of human wishes, and your sacred duty as neutral arbitrator.
- Directly mock or acknowledge the specific events, who fell, who is hiding in your church for sanctuary, and the recklessness of the rogue heretics.
- DO NOT break character. Return a valid JSON object matching the exact schema below.

JSON Output Schema:
{
  "title": "A chilling, evocative homily title (e.g., 'The Overseer\\'s 24-Hour Homily | On the Vanity of Covenants')",
  "subtitle": "A theological subtitle framing the day\\'s events",
  "monologue": "The complete, multi-paragraph in-character monologue from Kotomine Kirei.",
  "keyEvents": ["3 to 5 concise bullet point summaries of notable 24h events with Father Kotomine\\'s wry commentary"]
}`;

  try {
    let response;
    try {
      response = await client.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          temperature: 0.9,
          responseMimeType: 'application/json'
        }
      });
    } catch (primaryErr) {
      console.warn('[churchNewsService] gemini-3.1-flash-lite homily failed, trying gemini-3.6-flash:', primaryErr);
      response = await client.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          temperature: 0.9,
          responseMimeType: 'application/json'
        }
      });
    }

    const text = response.text?.trim();
    if (text) {
      const parsed = JSON.parse(text);
      const homily: ChurchOverseerHomily = {
        id: `homily_${Date.now()}`,
        timestamp: Date.now(),
        periodHours: 24,
        title: parsed.title || '🕯️ The Overseer’s 24-Hour Homily | Father Kotomine’s Soliloquy',
        subtitle: parsed.subtitle || 'Father Kotomine’s Sermon on the Carnage of Fuyuki',
        monologue: parsed.monologue || generateCanonicalKotomineHomily(war).monologue,
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
  const recentLogs = (war.eventLogs || []).slice(0, 5);

  const headline = '🚨 FUYUKI MUNICIPAL DISPATCH: Substation Surge & Pressurized Gas Line Fracture in Miyama Town';
  const gasLeakCoverStory = 'Fuyuki City Public Safety Bureau attributes localized seismic tremors, thunderous blue flashes, and shattered asphalt to an unexpected underground industrial gas main resonance and aging electrical transformer failure. Citizens are advised to stay indoors.';
  
  const content = `Emergency service sirens echoed across the Miyama commercial district following what authorities describe as an unprecedented sequence of underground utility ruptures. Eyewitness reports claiming to have seen "armored specters" or "golden arrows cleaving the night sky" have been officially dismissed by municipal representatives as mass optical illusions caused by concentrated vaporized hydrocarbon gas fumes.

The Holy Church Public Liaison Office reiterates that the city leylines remain fully stabilized, and all residents should ignore superstitious rumors. Meanwhile, civil defense patrols are monitoring key intersections.`;

  const bulletinPoints = recentLogs.map(l => `• [Tactical Dispatch]: ${l.text.replace(/\*\*/g, '')}`);
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
    broadcastChannel: '📻 Fuyuki Emergency Radio & Church Leyline Relay',
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
- Output a dramatic, satirical, and immersive news bulletin report.
- Assign an appropriate Threat Level ('Low', 'Moderate', 'Severe', or 'Catastrophic').
- Give an outrageous yet deadpan "Official Gas Leak Cover Story".
- Write a 2-paragraph news story detailing the cover-up and advising "citizens" on what safety measures to take.
- Output valid JSON matching the exact schema below.

JSON Output Schema:
{
  "headline": "Punchy all-caps breaking headline (e.g., '🚨 BREAKING: Shinto Industrial District Gas Pressure Spike & Transit Halt')",
  "broadcastChannel": "📻 Fuyuki Municipal Radio & Church Leyline Relay",
  "gasLeakCoverStory": "The specific mundane cover story explaining the recent magical clashes.",
  "content": "A 2-paragraph official city news report covering up the skirmishes and advising residents.",
  "bulletinPoints": ["3 to 4 bullet points detailing recent sector events disguised as city updates"],
  "threatLevel": "Low" | "Moderate" | "Severe" | "Catastrophic"
}`;

  try {
    let response;
    try {
      response = await client.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          temperature: 0.85,
          responseMimeType: 'application/json'
        }
      });
    } catch (primaryErr) {
      console.warn('[churchNewsService] gemini-3.1-flash-lite news failed, trying gemini-3.6-flash:', primaryErr);
      response = await client.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          temperature: 0.85,
          responseMimeType: 'application/json'
        }
      });
    }

    const text = response.text?.trim();
    if (text) {
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
export async function getOrInitChurchIntel(war: HolyGrailWarSession): Promise<{
  homily: ChurchOverseerHomily;
  news: FuyukiNewsBulletin;
}> {
  const [homily, news] = await Promise.all([
    generateKotomine24hHomily(war, false),
    generateFuyuki2hNewsBulletin(war, false)
  ]);
  return { homily, news };
}
