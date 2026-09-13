import { GoogleGenAI } from '@google/genai';

export interface ServantChatContext {
  servantName: string;
  servantClass: string;
  bondLevel: number;
  maxBond: number;
  masterName: string;
  commandSeals: number;
  isExposed: boolean;
  equippedCeName?: string;
  recentChronicleEvents: string[]; // Last 2–3 entries from the existing War Chronicle
  playerMessage: string;
}

export async function generateServantReply(ctx: ServantChatContext): Promise<string> {
  const fallback = "...Master, stay focused. We have an active war to fight.";

  if (!process.env.GEMINI_API_KEY) {
    return fallback;
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const prompt = `
You are the Heroic Spirit ${ctx.servantName} (${ctx.servantClass}) from Fate speaking directly to your Master (${ctx.masterName}) during an active Holy Grail War.

CURRENT WAR CONTEXT:
- Bond Level: ${ctx.bondLevel}/${ctx.maxBond}
- Master Command Seals: ${ctx.commandSeals}/3
- Public Board Exposure: ${ctx.isExposed ? 'EXPOSED to all Masters' : 'Concealed in shadows'}
- Equipped CE: ${ctx.equippedCeName || 'None'}
- Recent War Chronicle:
${ctx.recentChronicleEvents.length > 0 ? ctx.recentChronicleEvents.map(e => `  - ${e}`).join('\n') : '  - Quiet night with no recorded clashes.'}

BEHAVIOR & TONE RULES:
- Stay strictly in-character according to canon Fate lore and personality.
- The tone must reflect the current Bond Level (higher bond = deeper trust, candid reactions, mutual loyalty).
- Acknowledge recent events naturally if relevant (such as recent skirmishes, lost seals, or public exposure).
- Output constraint: Exactly 1 to 2 spoken sentences, written as dialogue for a Visual Novel text frame. No stage directions, no asterisks, no meta-game jargon.

Master says: "${ctx.playerMessage}"
`;

  try {
    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
      });
    } catch (primaryErr) {
      console.warn('gemini-3.1-flash-lite attempt failed, trying gemini-3.6-flash:', primaryErr);
      response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
      });
    }
    return response.text?.trim() || fallback;
  } catch (error) {
    console.error('Gemini dialogue generation error:', error);
    return fallback;
  }
}
