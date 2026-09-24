import { GoogleGenAI } from '@google/genai';
import { ApiProviderType, UserCustomApiConfig } from '../types';
import { decryptSecret, maskApiKeySecurely, redactSensitiveKeysFromText } from '../utils/cryptoSecurity';

export function maskApiKey(key?: string): string {
  return maskApiKeySecurely(key);
}

export interface FreeModelInfo {
  id: string;
  name: string;
  provider: ApiProviderType;
  providerName: string;
  description: string;
  badge: string; // e.g. '🔥 100% Free' or '⚡ Ultra-Fast'
  isFree: boolean;
  recommendedRole?: 'best_overall' | 'fastest' | 'reasoning' | 'creative' | 'local';
}

export const FREE_MODELS_CATALOG: FreeModelInfo[] = [
  // --- Google Gemini Free Models ---
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    provider: 'gemini',
    providerName: 'Google AI Studio',
    description: 'Generous free tier. Superb visual novel personality, high fidelity, and lore nuance.',
    badge: '🌟 Best Overall',
    isFree: true,
    recommendedRole: 'best_overall'
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash-Lite',
    provider: 'gemini',
    providerName: 'Google AI Studio',
    description: 'Ultra-low latency with highest rate-limits on the free AI Studio tier.',
    badge: '⚡ Ultra-Fast',
    isFree: true,
    recommendedRole: 'fastest'
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    provider: 'gemini',
    providerName: 'Google AI Studio',
    description: 'Lightweight, steady, and responsive dialogue generation.',
    badge: '🟢 Free Tier',
    isFree: true,
    recommendedRole: 'fastest'
  },
  {
    id: 'gemini-3.5-pro',
    name: 'Gemini 3.5 Pro',
    provider: 'gemini',
    providerName: 'Google AI Studio',
    description: 'Elite complex reasoning and emotional depth for legendary Servants.',
    badge: '🧠 Deep Lore',
    isFree: true,
    recommendedRole: 'creative'
  },

  // --- Groq Free Models (All 100% Free Tier) ---
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile',
    provider: 'groq',
    providerName: 'Groq Cloud',
    description: '100% Free on Groq. Flagship 70B open weights running at blistering 300+ tok/s.',
    badge: '🔥 100% Free & Fast',
    isFree: true,
    recommendedRole: 'best_overall'
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant',
    provider: 'groq',
    providerName: 'Groq Cloud',
    description: 'Sub-150ms instant telepathic responses. Zero cost on Groq Cloud.',
    badge: '⚡ Sub-150ms',
    isFree: true,
    recommendedRole: 'fastest'
  },
  {
    id: 'gemma2-9b-it',
    name: 'Gemma 2 9B IT',
    provider: 'groq',
    providerName: 'Groq Cloud',
    description: "Google's open-weights Gemma 2 model accelerated on Groq LPUs.",
    badge: '🟢 Free Tier',
    isFree: true,
    recommendedRole: 'creative'
  },
  {
    id: 'deepseek-r1-distill-llama-70b',
    name: 'DeepSeek R1 Distill 70B',
    provider: 'groq',
    providerName: 'Groq Cloud',
    description: 'DeepSeek R1 reasoning architecture distilled into Llama 70B on Groq.',
    badge: '🧠 Free Reasoning',
    isFree: true,
    recommendedRole: 'reasoning'
  },
  {
    id: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B MoE',
    provider: 'groq',
    providerName: 'Groq Cloud',
    description: 'Mixture of Experts architecture with 32k context and snappy banter.',
    badge: '🟢 Free Tier',
    isFree: true,
    recommendedRole: 'creative'
  },

  // --- OpenRouter 100% Free (:free) Models ---
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B (:free)',
    provider: 'openrouter',
    providerName: 'OpenRouter.ai',
    description: '100% Free on OpenRouter. Full 70B instruct model with authentic character dialogue.',
    badge: '🔥 100% Free',
    isFree: true,
    recommendedRole: 'best_overall'
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Gemini 2.0 Flash Exp (:free)',
    provider: 'openrouter',
    providerName: 'OpenRouter.ai',
    description: 'Experimental Gemini 2.0 Flash hosted completely free on OpenRouter.',
    badge: '⚡ Free Flash',
    isFree: true,
    recommendedRole: 'fastest'
  },
  {
    id: 'deepseek/deepseek-r1:free',
    name: 'DeepSeek R1 (:free)',
    provider: 'openrouter',
    providerName: 'OpenRouter.ai',
    description: 'Flagship reasoning model available at zero cost via OpenRouter free tier.',
    badge: '🧠 Free Reasoning',
    isFree: true,
    recommendedRole: 'reasoning'
  },
  {
    id: 'deepseek/deepseek-chat:free',
    name: 'DeepSeek V3 Chat (:free)',
    provider: 'openrouter',
    providerName: 'OpenRouter.ai',
    description: 'DeepSeek V3 conversational model completely free on OpenRouter.',
    badge: '🟢 Free Chat',
    isFree: true,
    recommendedRole: 'best_overall'
  },
  {
    id: 'qwen/qwen-2.5-72b-instruct:free',
    name: 'Qwen 2.5 72B (:free)',
    provider: 'openrouter',
    providerName: 'OpenRouter.ai',
    description: 'Alibaba 72B open weights model with vast lore knowledge and rich vocabulary.',
    badge: '🌟 Free 72B',
    isFree: true,
    recommendedRole: 'creative'
  },
  {
    id: 'meta-llama/llama-3.1-8b-instruct:free',
    name: 'Llama 3.1 8B (:free)',
    provider: 'openrouter',
    providerName: 'OpenRouter.ai',
    description: 'Lightweight free model on OpenRouter for instant replies.',
    badge: '⚡ Fast & Free',
    isFree: true,
    recommendedRole: 'fastest'
  },

  // --- DeepSeek Direct API ---
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3 (Chat)',
    provider: 'deepseek',
    providerName: 'DeepSeek Direct',
    description: 'Direct deepseek.com API. Industry-leading open-weights performance.',
    badge: '🌟 Top Tier',
    isFree: false,
    recommendedRole: 'best_overall'
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1 (Reasoner)',
    provider: 'deepseek',
    providerName: 'DeepSeek Direct',
    description: 'Chain-of-thought reasoning for strategic battle command simulations.',
    badge: '🧠 Reasoning',
    isFree: false,
    recommendedRole: 'reasoning'
  },

  // --- Mistral AI Free Tier ---
  {
    id: 'mistral-small-latest',
    name: 'Mistral Small',
    provider: 'mistral',
    providerName: 'Mistral AI',
    description: 'Witty, concise, and highly expressive character roleplay on Mistral free tier.',
    badge: '🟢 Free Tier',
    isFree: true,
    recommendedRole: 'creative'
  },
  {
    id: 'open-mistral-7b',
    name: 'Open Mistral 7B',
    provider: 'mistral',
    providerName: 'Mistral AI',
    description: 'Classic open-weights model, lightweight and free.',
    badge: '⚡ Fast',
    isFree: true,
    recommendedRole: 'fastest'
  },

  // --- Ollama / Local Offline Models (100% Free Forever) ---
  {
    id: 'llama3.2',
    name: 'Ollama Llama 3.2 (Local)',
    provider: 'ollama',
    providerName: 'Ollama Local AI',
    description: 'Runs 100% free and offline on your own computer. Zero cloud dependencies.',
    badge: '💻 100% Local Free',
    isFree: true,
    recommendedRole: 'local'
  },
  {
    id: 'mistral',
    name: 'Ollama Mistral 7B (Local)',
    provider: 'ollama',
    providerName: 'Ollama Local AI',
    description: 'Local Mistral model on localhost:11434 with zero privacy tracking.',
    badge: '💻 Local Free',
    isFree: true,
    recommendedRole: 'local'
  },
  {
    id: 'qwen2.5:7b',
    name: 'Ollama Qwen 2.5 7B (Local)',
    provider: 'ollama',
    providerName: 'Ollama Local AI',
    description: 'Local Qwen 2.5 on your GPU or CPU.',
    badge: '💻 Local Free',
    isFree: true,
    recommendedRole: 'local'
  }
];

export const DEFAULT_PROVIDER_MODELS: Record<ApiProviderType, string> = {
  gemini: 'gemini-3.5-flash',
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'meta-llama/llama-3.3-70b-instruct:free',
  deepseek: 'deepseek-chat',
  mistral: 'mistral-small-latest',
  nanogpt: 'gpt-4o-mini',
  ollama: 'llama3.2',
  custom: 'default'
};

export const PROVIDER_DISPLAY_NAMES: Record<ApiProviderType, string> = {
  gemini: 'Google Gemini (AI Studio)',
  groq: 'Groq Cloud (Free Ultra-Fast)',
  openrouter: 'OpenRouter.ai (Free Models)',
  deepseek: 'DeepSeek Direct API',
  mistral: 'Mistral AI (La Plateforme)',
  nanogpt: 'NanoGPT',
  ollama: 'Ollama / Local AI (Offline Free)',
  custom: 'Custom OpenAI-Compatible API'
};

export const PROVIDER_FREE_TIER_NOTES: Record<ApiProviderType, string> = {
  gemini: 'Free forever on Google AI Studio (15 RPM / 1M TPM). No credit card required.',
  groq: '100% Free API keys at console.groq.com. 30 RPM / 14,400 RPD. Ultra-fast inference.',
  openrouter: 'Free models tagged with `:free` (Llama 3.3 70B, Gemini Flash, DeepSeek R1).',
  deepseek: 'Affordable developer pricing directly from api.deepseek.com.',
  mistral: 'Free tier available at console.mistral.ai with free trial credits.',
  nanogpt: 'Pay-per-prompt or Nano cryptocurrency faucet.',
  ollama: '100% Free & completely private. Runs locally on your machine (localhost:11434).',
  custom: 'Compatible with any OpenAI-standard endpoint (Together, vLLM, LM Studio).'
};

/**
 * Executes a lightweight test prompt against the specified provider and API key.
 * Never leaks the key in error outputs or telemetry.
 */
export async function testProviderConnection(
  provider: ApiProviderType,
  apiKey: string,
  modelName?: string,
  customEndpoint?: string
): Promise<{ success: boolean; message: string; modelUsed: string }> {
  const rawKey = decryptSecret(apiKey);
  const model = modelName?.trim() || DEFAULT_PROVIDER_MODELS[provider];
  const testPrompt = 'Respond strictly with the single word: "resonance_established"';

  if (!rawKey && provider !== 'ollama') {
    return {
      success: false,
      message: 'Empty or invalid API key provided.',
      modelUsed: model
    };
  }

  try {
    if (provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey: rawKey.trim() });
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

    if (provider === 'groq') {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${rawKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: testPrompt }],
          max_tokens: 25,
          temperature: 0.2
        })
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Groq HTTP ${res.status}: ${redactSensitiveKeysFromText(errBody.slice(0, 150), [rawKey])}`);
      }

      const json = (await res.json()) as any;
      const content = json.choices?.[0]?.message?.content?.trim() || '';
      return {
        success: true,
        message: `Groq connection established! Responded: "${content.slice(0, 40)}"`,
        modelUsed: model
      };
    }

    if (provider === 'openrouter') {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${rawKey.trim()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://discord.gg',
          'X-Title': 'Fate Holy Grail War Discord Bot'
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: testPrompt }],
          max_tokens: 25,
          temperature: 0.2
        })
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`OpenRouter HTTP ${res.status}: ${redactSensitiveKeysFromText(errBody.slice(0, 150), [rawKey])}`);
      }

      const json = (await res.json()) as any;
      const content = json.choices?.[0]?.message?.content?.trim() || '';
      return {
        success: true,
        message: `OpenRouter connection established! Responded: "${content.slice(0, 40)}"`,
        modelUsed: model
      };
    }

    if (provider === 'deepseek') {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${rawKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: testPrompt }],
          max_tokens: 25,
          temperature: 0.2
        })
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`DeepSeek HTTP ${res.status}: ${redactSensitiveKeysFromText(errBody.slice(0, 150), [rawKey])}`);
      }

      const json = (await res.json()) as any;
      const content = json.choices?.[0]?.message?.content?.trim() || '';
      return {
        success: true,
        message: `DeepSeek connection established! Responded: "${content.slice(0, 40)}"`,
        modelUsed: model
      };
    }

    if (provider === 'mistral') {
      const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${rawKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: testPrompt }],
          max_tokens: 25,
          temperature: 0.2
        })
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Mistral HTTP ${res.status}: ${redactSensitiveKeysFromText(errBody.slice(0, 150), [rawKey])}`);
      }

      const json = (await res.json()) as any;
      const content = json.choices?.[0]?.message?.content?.trim() || '';
      return {
        success: true,
        message: `Mistral connection established! Responded: "${content.slice(0, 40)}"`,
        modelUsed: model
      };
    }

    if (provider === 'ollama') {
      const endpoint = (customEndpoint || 'http://localhost:11434/v1/chat/completions').trim();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (rawKey && rawKey.trim()) {
        headers['Authorization'] = `Bearer ${rawKey.trim()}`;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: testPrompt }],
          max_tokens: 25,
          temperature: 0.2
        })
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Ollama Local HTTP ${res.status}: ${errBody.slice(0, 150)}`);
      }

      const json = (await res.json()) as any;
      const content = json.choices?.[0]?.message?.content?.trim() || '';
      return {
        success: true,
        message: `Ollama local model responded: "${content.slice(0, 40)}"`,
        modelUsed: model
      };
    }

    if (provider === 'nanogpt') {
      const res = await fetch('https://nano-gpt.com/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${rawKey.trim()}`,
          'x-api-key': rawKey.trim(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: testPrompt }],
          max_tokens: 25,
          temperature: 0.2
        })
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`NanoGPT HTTP ${res.status}: ${redactSensitiveKeysFromText(errBody.slice(0, 150), [rawKey])}`);
      }

      const json = (await res.json()) as any;
      const content = json.choices?.[0]?.message?.content?.trim() || '';
      return {
        success: true,
        message: `NanoGPT connection established! Responded: "${content.slice(0, 40)}"`,
        modelUsed: model
      };
    }

    if (provider === 'custom') {
      const endpoint = (customEndpoint || 'https://api.openai.com/v1/chat/completions').trim();
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${rawKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: testPrompt }],
          max_tokens: 25,
          temperature: 0.2
        })
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Custom Endpoint HTTP ${res.status}: ${redactSensitiveKeysFromText(errBody.slice(0, 150), [rawKey])}`);
      }

      const json = (await res.json()) as any;
      const content = json.choices?.[0]?.message?.content?.trim() || '';
      return {
        success: true,
        message: `Custom endpoint responded: "${content.slice(0, 40)}"`,
        modelUsed: model
      };
    }

    throw new Error(`Unsupported provider: ${provider}`);
  } catch (err: any) {
    const safeError = redactSensitiveKeysFromText(err?.message || 'Connection test failed.', [rawKey]);
    return {
      success: false,
      message: safeError,
      modelUsed: model
    };
  }
}

/**
 * Generates servant dialogue using the user's custom BYOK configuration.
 * Cryptographically decrypts keys just-in-time and immediately purges them.
 */
export async function generateWithCustomProvider(
  config: UserCustomApiConfig,
  prompt: string
): Promise<{ reply: string; modelUsed: string; provider: string }> {
  const provider = config.activeProvider || 'gemini';

  // 1. Google Gemini
  if (provider === 'gemini' && config.geminiKey) {
    const rawKey = decryptSecret(config.geminiKey);
    const model = config.geminiModel?.trim() || DEFAULT_PROVIDER_MODELS.gemini;
    try {
      const ai = new GoogleGenAI({ apiKey: rawKey.trim() });
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
    } catch (err: any) {
      throw new Error(redactSensitiveKeysFromText(err?.message || 'Gemini BYOK request failed', [rawKey]));
    }
  }

  // 2. Groq Cloud (Free Ultra-Fast)
  if (provider === 'groq' && config.groqKey) {
    const rawKey = decryptSecret(config.groqKey);
    const model = config.groqModel?.trim() || DEFAULT_PROVIDER_MODELS.groq;
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${rawKey.trim()}`,
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
        throw new Error(`Groq API error (HTTP ${res.status}): ${errText.slice(0, 200)}`);
      }

      const data = (await res.json()) as any;
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('Groq BYOK returned empty text.');
      return { reply: text, modelUsed: model, provider: 'Groq Cloud (BYOK)' };
    } catch (err: any) {
      throw new Error(redactSensitiveKeysFromText(err?.message || 'Groq BYOK request failed', [rawKey]));
    }
  }

  // 3. OpenRouter (Free and Paid Models)
  if (provider === 'openrouter' && config.openrouterKey) {
    const rawKey = decryptSecret(config.openrouterKey);
    const model = config.openrouterModel?.trim() || DEFAULT_PROVIDER_MODELS.openrouter;
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${rawKey.trim()}`,
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

      const data = (await res.json()) as any;
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('OpenRouter BYOK returned empty text.');
      return { reply: text, modelUsed: model, provider: 'OpenRouter (BYOK)' };
    } catch (err: any) {
      throw new Error(redactSensitiveKeysFromText(err?.message || 'OpenRouter BYOK request failed', [rawKey]));
    }
  }

  // 4. DeepSeek Direct API
  if (provider === 'deepseek' && config.deepseekKey) {
    const rawKey = decryptSecret(config.deepseekKey);
    const model = config.deepseekModel?.trim() || DEFAULT_PROVIDER_MODELS.deepseek;
    try {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${rawKey.trim()}`,
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
        throw new Error(`DeepSeek API error (HTTP ${res.status}): ${errText.slice(0, 200)}`);
      }

      const data = (await res.json()) as any;
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('DeepSeek BYOK returned empty text.');
      return { reply: text, modelUsed: model, provider: 'DeepSeek (BYOK)' };
    } catch (err: any) {
      throw new Error(redactSensitiveKeysFromText(err?.message || 'DeepSeek BYOK request failed', [rawKey]));
    }
  }

  // 5. Mistral AI
  if (provider === 'mistral' && config.mistralKey) {
    const rawKey = decryptSecret(config.mistralKey);
    const model = config.mistralModel?.trim() || DEFAULT_PROVIDER_MODELS.mistral;
    try {
      const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${rawKey.trim()}`,
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
        throw new Error(`Mistral API error (HTTP ${res.status}): ${errText.slice(0, 200)}`);
      }

      const data = (await res.json()) as any;
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('Mistral BYOK returned empty text.');
      return { reply: text, modelUsed: model, provider: 'Mistral (BYOK)' };
    } catch (err: any) {
      throw new Error(redactSensitiveKeysFromText(err?.message || 'Mistral BYOK request failed', [rawKey]));
    }
  }

  // 6. Ollama / Local AI
  if (provider === 'ollama') {
    const rawKey = config.customKey ? decryptSecret(config.customKey) : '';
    const endpoint = (config.ollamaEndpoint || 'http://localhost:11434/v1/chat/completions').trim();
    const model = config.ollamaModel?.trim() || DEFAULT_PROVIDER_MODELS.ollama;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (rawKey && rawKey.trim()) {
      headers['Authorization'] = `Bearer ${rawKey.trim()}`;
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
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
        throw new Error(`Ollama API error (HTTP ${res.status}): ${errText.slice(0, 200)}`);
      }

      const data = (await res.json()) as any;
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('Ollama local model returned empty text.');
      return { reply: text, modelUsed: model, provider: 'Ollama Local (BYOK)' };
    } catch (err: any) {
      throw new Error(redactSensitiveKeysFromText(err?.message || 'Ollama local generation failed'));
    }
  }

  // 7. NanoGPT
  if (provider === 'nanogpt' && config.nanogptKey) {
    const rawKey = decryptSecret(config.nanogptKey);
    const model = config.nanogptModel?.trim() || DEFAULT_PROVIDER_MODELS.nanogpt;
    try {
      const res = await fetch('https://nano-gpt.com/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${rawKey.trim()}`,
          'x-api-key': rawKey.trim(),
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

      const data = (await res.json()) as any;
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('NanoGPT BYOK returned empty text.');
      return { reply: text, modelUsed: model, provider: 'NanoGPT (BYOK)' };
    } catch (err: any) {
      throw new Error(redactSensitiveKeysFromText(err?.message || 'NanoGPT BYOK request failed', [rawKey]));
    }
  }

  // 8. Custom OpenAI-compatible Endpoint
  if (provider === 'custom' && config.customKey && config.customEndpoint) {
    const rawKey = decryptSecret(config.customKey);
    const model = config.customModel?.trim() || 'default';
    try {
      const res = await fetch(config.customEndpoint.trim(), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${rawKey.trim()}`,
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

      const data = (await res.json()) as any;
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('Custom Endpoint BYOK returned empty text.');
      return { reply: text, modelUsed: model, provider: 'Custom API (BYOK)' };
    } catch (err: any) {
      throw new Error(redactSensitiveKeysFromText(err?.message || 'Custom Endpoint BYOK request failed', [rawKey]));
    }
  }

  throw new Error(`No active custom API key configured for provider: ${provider}`);
}
