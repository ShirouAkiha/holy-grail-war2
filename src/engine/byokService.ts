import { GoogleGenAI } from '@google/genai';
import { ApiProviderType, UserCustomApiConfig } from '../types';

export function maskApiKey(key?: string): string {
  if (!key) return 'Not configured';
  if (key.length <= 8) return '••••••••';
  return `${key.slice(0, 6)}••••••••${key.slice(-4)}`;
}

export const DEFAULT_PROVIDER_MODELS: Record<ApiProviderType, string> = {
  gemini: 'gemini-3.5-flash',
  openrouter: 'google/gemini-3.5-flash',
  nanogpt: 'gpt-4o-mini',
  custom: 'default'
};

export const PROVIDER_DISPLAY_NAMES: Record<ApiProviderType, string> = {
  gemini: 'Google Gemini AI Studio',
  openrouter: 'OpenRouter.ai',
  nanogpt: 'NanoGPT',
  custom: 'Custom OpenAI-Compatible API'
};

/**
 * Executes a lightweight test prompt against the specified provider and API key.
 */
export async function testProviderConnection(
  provider: ApiProviderType,
  apiKey: string,
  modelName?: string,
  customEndpoint?: string
): Promise<{ success: boolean; message: string; modelUsed: string }> {
  const model = modelName?.trim() || DEFAULT_PROVIDER_MODELS[provider];
  const testPrompt = 'Respond strictly with the single word: "resonance_established"';

  try {
    if (provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
      const response = await ai.models.generateContent({
        model: model,
        contents: testPrompt,
        config: {
          maxOutputTokens: 20,
          temperature: 0.2
        }
      });
      const text = response.text?.trim() || '';
      if (text.length > 0) {
        return {
          success: true,
          message: `Connection established! Responded: "${text.slice(0, 40)}"`,
          modelUsed: model
        };
      }
      throw new Error('Empty response from Gemini API.');
    }

    if (provider === 'openrouter') {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://discord.gg',
          'X-Title': 'Fate Holy Grail War Discord Bot'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'user', content: testPrompt }
          ],
          max_tokens: 25,
          temperature: 0.2
        })
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`OpenRouter HTTP ${res.status}: ${errBody.slice(0, 150)}`);
      }

      const json = await res.json() as any;
      const content = json.choices?.[0]?.message?.content?.trim() || '';
      return {
        success: true,
        message: `Connection established! Responded: "${content.slice(0, 40)}"`,
        modelUsed: model
      };
    }

    if (provider === 'nanogpt') {
      const res = await fetch('https://nano-gpt.com/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'x-api-key': apiKey.trim(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'user', content: testPrompt }
          ],
          max_tokens: 25,
          temperature: 0.2
        })
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`NanoGPT HTTP ${res.status}: ${errBody.slice(0, 150)}`);
      }

      const json = await res.json() as any;
      const content = json.choices?.[0]?.message?.content?.trim() || '';
      return {
        success: true,
        message: `Connection established! Responded: "${content.slice(0, 40)}"`,
        modelUsed: model
      };
    }

    if (provider === 'custom') {
      const endpoint = (customEndpoint || 'https://api.openai.com/v1/chat/completions').trim();
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'user', content: testPrompt }
          ],
          max_tokens: 25,
          temperature: 0.2
        })
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Custom Endpoint HTTP ${res.status}: ${errBody.slice(0, 150)}`);
      }

      const json = await res.json() as any;
      const content = json.choices?.[0]?.message?.content?.trim() || '';
      return {
        success: true,
        message: `Connection established! Responded: "${content.slice(0, 40)}"`,
        modelUsed: model
      };
    }

    throw new Error(`Unsupported provider: ${provider}`);
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Connection test failed.',
      modelUsed: model
    };
  }
}

/**
 * Generates servant dialogue using the user's custom BYOK configuration.
 */
export async function generateWithCustomProvider(
  config: UserCustomApiConfig,
  prompt: string
): Promise<{ reply: string; modelUsed: string; provider: string }> {
  const provider = config.activeProvider || 'gemini';

  if (provider === 'gemini' && config.geminiKey) {
    const model = config.geminiModel?.trim() || DEFAULT_PROVIDER_MODELS.gemini;
    const ai = new GoogleGenAI({ apiKey: config.geminiKey.trim() });
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        temperature: 0.9,
        topP: 0.95
      }
    });
    const text = response.text?.trim();
    if (!text) throw new Error('Gemini BYOK returned empty text.');
    return { reply: text, modelUsed: model, provider: 'Gemini (BYOK)' };
  }

  if (provider === 'openrouter' && config.openrouterKey) {
    const model = config.openrouterModel?.trim() || DEFAULT_PROVIDER_MODELS.openrouter;
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openrouterKey.trim()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://discord.gg',
        'X-Title': 'Fate Holy Grail War Discord Bot'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are an authentic Fate/stay night visual novel dialogue simulator. Follow all in-character personality, bond, and brevity constraints strictly. Respond only with the character spoken dialogue in 1-3 sentences.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.9,
        max_tokens: 180
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter API error (HTTP ${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = await res.json() as any;
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('OpenRouter BYOK returned empty text.');
    return { reply: text, modelUsed: model, provider: 'OpenRouter (BYOK)' };
  }

  if (provider === 'nanogpt' && config.nanogptKey) {
    const model = config.nanogptModel?.trim() || DEFAULT_PROVIDER_MODELS.nanogpt;
    const res = await fetch('https://nano-gpt.com/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.nanogptKey.trim()}`,
        'x-api-key': config.nanogptKey.trim(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are an authentic Fate/stay night visual novel dialogue simulator. Follow all in-character personality, bond, and brevity constraints strictly. Respond only with the character spoken dialogue in 1-3 sentences.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.9,
        max_tokens: 180
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`NanoGPT API error (HTTP ${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = await res.json() as any;
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('NanoGPT BYOK returned empty text.');
    return { reply: text, modelUsed: model, provider: 'NanoGPT (BYOK)' };
  }

  if (provider === 'custom' && config.customKey && config.customEndpoint) {
    const model = config.customModel?.trim() || 'default';
    const res = await fetch(config.customEndpoint.trim(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.customKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are an authentic Fate/stay night visual novel dialogue simulator. Follow all in-character personality, bond, and brevity constraints strictly. Respond only with the character spoken dialogue in 1-3 sentences.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.9,
        max_tokens: 180
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Custom Endpoint error (HTTP ${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = await res.json() as any;
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Custom Endpoint BYOK returned empty text.');
    return { reply: text, modelUsed: model, provider: 'Custom API (BYOK)' };
  }

  throw new Error(`No active custom API key configured for provider: ${provider}`);
}
