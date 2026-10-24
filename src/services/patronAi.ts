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
  cooksInvolved: string[]
): Promise<PatronReviewResult> {
  const isCraveMatch = patron.cravingRecipeId === recipe.id;
  const baseStars = isCraveMatch
    ? (qualityScore >= 85 ? 5 : 4)
    : (qualityScore >= 80 ? 4 : qualityScore >= 65 ? 3 : 2);

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim().length > 0) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are roleplaying as the Fate/Grand Order Heroic Spirit ${patron.name} (${patron.servantClass}), acting as a food critic/patron in the Chaldea Cafeteria.
Your personality: ${patron.personality}
Title: ${patron.criticTitle}

The Masters of Chaldea (${cooksInvolved.join(', ')}) just served you a freshly cooked dish:
- Dish Name: ${recipe.name} (${recipe.emoji})
- Dish Description: ${recipe.description}
- Culinary Preparation Score: ${qualityScore} / 100
- Does this match your specific craving?: ${isCraveMatch ? 'YES, EXACT MATCH!' : 'No, alternative dish'}

Write an authentic, immersive, in-character food review in 2-3 sentences.
Include your reaction to the taste, presentation, and heat.
End your review by awarding a star rating between 1 and 5 stars.
Keep it strictly under 60 words, in quotes. Do not include markdown headers or meta-text.`;

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
          verdictTitle: baseStars >= 4 ? 'Glorious Feast Approved!' : 'Stern Culinary Verdict',
          isAiGenerated: true
        };
      }
    } catch (err) {
      console.warn('[PatronAI] Gemini API review fallback:', err);
    }
  }

  // Fallback to high-fidelity canonical quote
  const quotes = baseStars >= 4 ? patron.fallbackPraiseQuotes : patron.fallbackCritiqueQuotes;
  const chosenQuote = quotes[Math.floor(Math.random() * quotes.length)];

  return {
    patronName: patron.name,
    ratingStars: baseStars,
    critiqueText: `“${chosenQuote}”`,
    verdictTitle: baseStars >= 4 ? 'Chaldea Kitchen Triumph!' : 'Apprentice Kitchen Lesson',
    isAiGenerated: false
  };
}
