// Chaldea Cafeteria - Gemini AI Servant Patron Review Service
// Generates personalized in-character food critiques, Michelin star scores, and dining dialogue.

import { GoogleGenAI } from '@google/genai';
import { ServantPatron, Recipe } from '../data/cafeteriaData';

export interface PatronReviewResult {
  patronName: string;
  ratingStars: number; // 1 to 5
  critiqueText: string;
  verdictTitle: string;
  isAiGenerated: boolean;
}

export async function generatePatronFoodReview(
  patron: ServantPatron,
  recipe: Recipe,
  qualityScore: number,
  cooksInvolved: string[],
  patronMood?: string,
  orderedCravingName?: string
): Promise<PatronReviewResult> {
  const isCraveMatch = patron.cravingRecipeId === recipe.id;
  const baseStars = isCraveMatch
    ? (qualityScore >= 85 ? 5 : 4)
    : 1; // Wrong order always gets 1 star!

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim().length > 0) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = isCraveMatch
        ? `You are roleplaying as the Fate/Grand Order Heroic Spirit ${patron.name} (${patron.servantClass}), dining in the Chaldea Cafeteria in a ${patronMood || 'pleased'} mood.
Your personality: ${patron.personality}
Title: ${patron.criticTitle}

The Masters of Chaldea (${cooksInvolved.join(', ')}) just served you EXACTLY what you craved:
- Dish Name: ${recipe.name} (${recipe.emoji})
- Dish Description: ${recipe.description}
- Culinary Quality Score: ${qualityScore} / 100

Write an authentic, immersive, enthusiastic in-character food review in 2-3 sentences praising the taste, aroma, and presentation. End with star rating. Keep under 60 words, in quotes.`
        : `You are roleplaying as the Fate/Grand Order Heroic Spirit ${patron.name} (${patron.servantClass}), dining in the Chaldea Cafeteria in a ${patronMood || 'hungry'} mood.
Your personality: ${patron.personality}
Title: ${patron.criticTitle}

You ordered: "${orderedCravingName || patron.cravingName}"
The Masters of Chaldea (${cooksInvolved.join(', ')}) brought you the WRONG DISH: "${recipe.name} (${recipe.emoji})"!

Write a hilarious, dramatic, canon-accurate in-character reaction expressing indignation, shock, or comedic disappointment at the Master mixing up your order ticket. Keep under 60 words, in quotes.`;

      const genPromise = ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt
      });
      const timeoutPromise = new Promise<null>(resolve => setTimeout(() => resolve(null), 3500));
      const response = await Promise.race([genPromise, timeoutPromise]);

      const text = response?.text ? response.text.trim().replace(/^["']|["']$/g, '') : '';
      if (text) {
        return {
          patronName: patron.name,
          ratingStars: baseStars,
          critiqueText: `“${text}”`,
          verdictTitle: isCraveMatch ? 'Glorious Feast Approved!' : '❌ Order Mix-Up Reprimand!',
          isAiGenerated: true
        };
      }
    } catch (err) {
      console.warn('[PatronAI] Gemini API review fallback:', err);
    }
  }

  // Fallback to high-fidelity canonical quote
  const quotes = isCraveMatch
    ? (baseStars >= 4 ? patron.fallbackPraiseQuotes : patron.fallbackCritiqueQuotes)
    : (patron.fallbackWrongOrderQuotes && patron.fallbackWrongOrderQuotes.length > 0 ? patron.fallbackWrongOrderQuotes : patron.fallbackCritiqueQuotes);
  
  const chosenQuote = quotes[Math.floor(Math.random() * quotes.length)];

  return {
    patronName: patron.name,
    ratingStars: baseStars,
    critiqueText: `“${chosenQuote}”`,
    verdictTitle: isCraveMatch ? 'Chaldea Kitchen Triumph!' : '❌ Order Ticket Mix-Up!',
    isAiGenerated: false
  };
}
