import { GoogleGenAI } from '@google/genai';
import { renderVisualNovelCard } from '../canvas/renderer';
import {
  getServantChatHistory,
  appendServantChatTurn,
  TalkMessageTurn
} from './servantMemoryService';

export interface ServantTalkContext {
  servantName: string;
  servantClass: string;
  bondLevel: number;
  maxBond?: number;
  masterName: string;
  masterId?: string;
  servantId?: string;
  warId?: string;
  commandSeals?: number;
  isExposed?: boolean;
  equippedCeName?: string;
  recentChronicleEvents?: string[];
  playerMessage: string;
  servantAvatarUrl?: string;
  servantTitle?: string;
  servantLore?: string;
  conversationHistory?: TalkMessageTurn[];
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

  // Format past turns for context injection
  let historyBlock = '';
  if (priorTurns.length > 0) {
    historyBlock = `\nPREVIOUS CONVERSATIONS BETWEEN YOU AND MASTER IN THIS GRAIL WAR (Remember these naturally!):\n` +
      priorTurns.map(t => `${t.role === 'user' ? `Master ${context.masterName}` : context.servantName}: "${t.content}"`).join('\n') +
      `\n(Maintain continuous conversational awareness with what you both discussed earlier.)\n`;
  }

  const prompt = `You are roleplaying as the Fate franchise Heroic Spirit: "${context.servantName}" (Class: ${context.servantClass}).
You are communicating telepathically with your Master, "${context.masterName}", during the active Holy Grail War in Fuyuki City.

CONTEXT:
- True Name/Identity: ${context.servantName}
- Class: ${context.servantClass}
- Master Name: ${context.masterName}
- Bond Rank: Level ${bond} of 10
  * Bond 1-2: Formal, disciplined, distant, evaluating the Master's worth.
  * Bond 3-4: Emerging respect, strategic camaraderie, respectful partnership.
  * Bond 5-7: Strong emotional bond, candid personal loyalty, opens up about their legend and struggles.
  * Bond 8-10: Absolute devotion, complete emotional resonance, treats Master as their true irreplaceable companion.
- Command Seals Remaining: ${seals}/3
- Master Concealment Status: ${context.isExposed ? 'Exposed to public War Board (dangerous)' : 'Concealed in shadows (safe)'}
- Equipped Craft Essence: ${context.equippedCeName || 'None equipped'}
- Recent War Chronicle: ${(context.recentChronicleEvents || ['War raging across Fuyuki.']).slice(-2).join('; ')}
${historyBlock}
MASTER SAYS TO YOU NOW:
"${context.playerMessage}"

INSTRUCTIONS:
- Reply in 1 to 3 concise, impactful sentences (maximum 60 words) suitable for a Visual Novel dialogue box.
- Stay strictly in character matching ${context.servantName}'s canon personality, tone, vocabulary, and chivalric/heroic ethos.
- If referencing past topics mentioned by Master, seamlessly incorporate them as a shared memory of this War.
- Address ${context.masterName} naturally (e.g. "Master", or specific honorifics appropriate to the character).
- Reflect your current Bond Rank (${bond}/10).
- Do NOT break character, do NOT provide meta explanations, and do NOT use asterisks for actions (*sighs*). Return ONLY the spoken dialogue.`;

  try {
    let response;
    try {
      response = await client.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt
      });
    } catch (primaryErr) {
      console.warn('[talkService] gemini-3.1-flash-lite attempt error, falling back to gemini-3.6-flash:', primaryErr);
      response = await client.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt
      });
    }

    const text = response.text?.trim();
    if (text) {
      // Strip any extra quotes wrapping the entire response if present
      const cleaned = text.replace(/^["'“](.*)["'”]$/, '$1').trim();
      // Save this turn to persistent memory
      appendServantChatTurn(masterId, servantId, context.servantName, context.playerMessage, cleaned, warId);
      return { reply: cleaned, source: 'gemini' };
    }
  } catch (err) {
    console.warn('[talkService] Gemini generation fallback:', err);
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
  commandSeals?: number;
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
    commandSeals = 3
  } = params;

  // Base embed data used for both Option A and Option B
  const embedData = {
    title: `💬 Telepathic Link | ${servantName} [${servantClass}]`,
    thumbnailUrl: servantAvatarUrl,
    description:
      `👤 **Master ${masterName}:**\n> *“${playerMessage}”*\n\n` +
      `⚔️ **${servantName}:**\n> ❝ ***${replyText}*** ❞\n\n` +
      `*💖 Bond Rank: Lv. ${bondLevel}/10 • 🔱 Command Seals: ${commandSeals}/3 • Fuyuki Leyline Link*`,
    color: servantClass.toLowerCase() === 'saber' ? 0x38bdf8 : (servantClass.toLowerCase() === 'archer' ? 0xef4444 : 0xd4af37),
    footer: `Bond Rank ${bondLevel}/10 • Holy Grail War Telepathic Resonance`,
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
