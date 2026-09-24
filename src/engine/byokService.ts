import { GoogleGenAI } from '@google/genai';
import { ApiProviderType, UserCustomApiConfig } from '../types';
import { decryptSecret, maskApiKeySecurely, redactSensitiveKeysFromText } from '../utils/cryptoSecurity';

export type { ApiProviderType, UserCustomApiConfig };

export function maskApiKey(key?: string): string {
  return maskApiKeySecurely(key);
}

export interface ProviderModelSpec {
  id: string;
  name: string;
  provider: ApiProviderType;
  providerName: string;
  description: string;
  category: 'Flagship' | 'Fast & Instant' | 'Reasoning & CoT' | 'Creative & Lore' | 'Open Weights' | 'Preview / Experimental' | 'Local Offline';
  contextWindow?: string;
  isFreeTier?: boolean;
  recommended?: boolean;
}

export type FreeModelInfo = ProviderModelSpec;

/**
 * Comprehensive Catalog of Models across all supported AI providers.
 * Gives users total freedom to pick ANY model provided by their chosen service.
 */
export const PROVIDER_ALL_MODELS_CATALOG: Record<ApiProviderType, ProviderModelSpec[]> = {
  // 1. Google Gemini
  gemini: [
    {
      id: 'gemini-3.5-flash',
      name: 'Gemini 3.5 Flash',
      provider: 'gemini',
      providerName: 'Google AI Studio',
      description: 'Superb visual novel character fidelity, deep emotional nuance, and generous free tier.',
      category: 'Flagship',
      contextWindow: '1M tokens',
      isFreeTier: true,
      recommended: true
    },
    {
      id: 'gemini-3.5-flash-lite',
      name: 'Gemini 3.5 Flash-Lite',
      provider: 'gemini',
      providerName: 'Google AI Studio',
      description: 'Ultra-fast sub-second dialogue with highest rate-limits on the free AI Studio tier.',
      category: 'Fast & Instant',
      contextWindow: '1M tokens',
      isFreeTier: true,
      recommended: true
    },
    {
      id: 'gemini-3.5-pro',
      name: 'Gemini 3.5 Pro',
      provider: 'gemini',
      providerName: 'Google AI Studio',
      description: 'Elite complex reasoning, multi-turn tactical foresight, and legendary Servant lore depth.',
      category: 'Reasoning & CoT',
      contextWindow: '2M tokens',
      isFreeTier: true,
      recommended: true
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      provider: 'gemini',
      providerName: 'Google AI Studio',
      description: 'Balanced speed and multimodal dialogue capabilities.',
      category: 'Fast & Instant',
      contextWindow: '1M tokens',
      isFreeTier: true
    },
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      provider: 'gemini',
      providerName: 'Google AI Studio',
      description: 'Advanced reasoning and large-context comprehension.',
      category: 'Reasoning & CoT',
      contextWindow: '2M tokens',
      isFreeTier: true
    },
    {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      provider: 'gemini',
      providerName: 'Google AI Studio',
      description: 'Next-generation low latency dialogue engine.',
      category: 'Fast & Instant',
      contextWindow: '1M tokens',
      isFreeTier: true
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      provider: 'gemini',
      providerName: 'Google AI Studio',
      description: 'Classic 2M context flagship with deep memory of previous Holy Grail War turns.',
      category: 'Creative & Lore',
      contextWindow: '2M tokens',
      isFreeTier: true
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      provider: 'gemini',
      providerName: 'Google AI Studio',
      description: 'High-speed classic lightweight model.',
      category: 'Fast & Instant',
      contextWindow: '1M tokens',
      isFreeTier: true
    }
  ],

  // 2. Groq Cloud
  groq: [
    {
      id: 'llama-3.3-70b-versatile',
      name: 'Llama 3.3 70B Versatile',
      provider: 'groq',
      providerName: 'Groq Cloud',
      description: 'Flagship 70B open weights running at blistering 300+ tok/s on Groq LPUs. 100% Free tier.',
      category: 'Flagship',
      contextWindow: '128k tokens',
      isFreeTier: true,
      recommended: true
    },
    {
      id: 'llama-3.1-8b-instant',
      name: 'Llama 3.1 8B Instant',
      provider: 'groq',
      providerName: 'Groq Cloud',
      description: 'Sub-150ms instant telepathic responses. Zero cost on Groq Cloud.',
      category: 'Fast & Instant',
      contextWindow: '128k tokens',
      isFreeTier: true,
      recommended: true
    },
    {
      id: 'deepseek-r1-distill-llama-70b',
      name: 'DeepSeek R1 Distill 70B',
      provider: 'groq',
      providerName: 'Groq Cloud',
      description: 'DeepSeek R1 reasoning architecture distilled into Llama 70B on Groq LPUs.',
      category: 'Reasoning & CoT',
      contextWindow: '128k tokens',
      isFreeTier: true,
      recommended: true
    },
    {
      id: 'deepseek-r1-distill-qwen-32b',
      name: 'DeepSeek R1 Distill Qwen 32B',
      provider: 'groq',
      providerName: 'Groq Cloud',
      description: 'Fast chain-of-thought strategic battle logic distilled from R1.',
      category: 'Reasoning & CoT',
      contextWindow: '128k tokens',
      isFreeTier: true
    },
    {
      id: 'qwen-2.5-32b',
      name: 'Qwen 2.5 32B',
      provider: 'groq',
      providerName: 'Groq Cloud',
      description: 'Vast knowledge base and expressive dialogue on Groq hardware.',
      category: 'Creative & Lore',
      contextWindow: '128k tokens',
      isFreeTier: true
    },
    {
      id: 'gemma2-9b-it',
      name: 'Gemma 2 9B IT',
      provider: 'groq',
      providerName: 'Groq Cloud',
      description: "Google's open-weights Gemma 2 model accelerated on Groq LPUs.",
      category: 'Open Weights',
      contextWindow: '8k tokens',
      isFreeTier: true
    },
    {
      id: 'mixtral-8x7b-32768',
      name: 'Mixtral 8x7B MoE',
      provider: 'groq',
      providerName: 'Groq Cloud',
      description: 'Mixture of Experts architecture with 32k context and snappy banter.',
      category: 'Open Weights',
      contextWindow: '32k tokens',
      isFreeTier: true
    },
    {
      id: 'llama-3.1-70b-specdec',
      name: 'Llama 3.1 70B Speculative',
      provider: 'groq',
      providerName: 'Groq Cloud',
      description: 'Speculative decoding for ultra-accelerated 70B inference.',
      category: 'Fast & Instant',
      contextWindow: '8k tokens',
      isFreeTier: true
    }
  ],

  // 3. OpenRouter.ai
  openrouter: [
    {
      id: 'meta-llama/llama-3.3-70b-instruct',
      name: 'Llama 3.3 70B Instruct',
      provider: 'openrouter',
      providerName: 'OpenRouter.ai',
      description: 'Flagship Meta 70B instruct model with authentic character dialogue & broad lore knowledge.',
      category: 'Flagship',
      contextWindow: '128k tokens',
      recommended: true
    },
    {
      id: 'meta-llama/llama-3.3-70b-instruct:free',
      name: 'Llama 3.3 70B (:free)',
      provider: 'openrouter',
      providerName: 'OpenRouter.ai',
      description: '100% Free on OpenRouter. Full 70B instruct model with zero cost.',
      category: 'Flagship',
      contextWindow: '128k tokens',
      isFreeTier: true,
      recommended: true
    },
    {
      id: 'deepseek/deepseek-r1',
      name: 'DeepSeek R1 (Full Reasoning)',
      provider: 'openrouter',
      providerName: 'OpenRouter.ai',
      description: 'Industry-leading 671B chain-of-thought reasoning model for tactical Holy Grail masterplans.',
      category: 'Reasoning & CoT',
      contextWindow: '128k tokens',
      recommended: true
    },
    {
      id: 'deepseek/deepseek-r1:free',
      name: 'DeepSeek R1 (:free)',
      provider: 'openrouter',
      providerName: 'OpenRouter.ai',
      description: 'Flagship DeepSeek R1 reasoning available at $0.00 on OpenRouter free tier.',
      category: 'Reasoning & CoT',
      contextWindow: '128k tokens',
      isFreeTier: true,
      recommended: true
    },
    {
      id: 'deepseek/deepseek-chat',
      name: 'DeepSeek V3 Chat',
      provider: 'openrouter',
      providerName: 'OpenRouter.ai',
      description: 'DeepSeek V3 671B MoE conversational model. Fast, witty, and deeply immersed in lore.',
      category: 'Flagship',
      contextWindow: '64k tokens',
      recommended: true
    },
    {
      id: 'deepseek/deepseek-chat:free',
      name: 'DeepSeek V3 Chat (:free)',
      provider: 'openrouter',
      providerName: 'OpenRouter.ai',
      description: 'DeepSeek V3 chat hosted completely free on OpenRouter.',
      category: 'Flagship',
      contextWindow: '64k tokens',
      isFreeTier: true
    },
    {
      id: 'anthropic/claude-3.5-sonnet',
      name: 'Claude 3.5 Sonnet',
      provider: 'openrouter',
      providerName: 'OpenRouter.ai',
      description: 'The premier visual novel roleplay model. Peerless emotional nuance and aristocratic prose.',
      category: 'Creative & Lore',
      contextWindow: '200k tokens',
      recommended: true
    },
    {
      id: 'anthropic/claude-3.7-sonnet',
      name: 'Claude 3.7 Sonnet (Hybrid Thinking)',
      provider: 'openrouter',
      providerName: 'OpenRouter.ai',
      description: 'Latest hybrid thinking model combining instant dialogue with deep tactical reasoning.',
      category: 'Reasoning & CoT',
      contextWindow: '200k tokens'
    },
    {
      id: 'openai/gpt-4o',
      name: 'OpenAI GPT-4o',
      provider: 'openrouter',
      providerName: 'OpenRouter.ai',
      description: 'High intelligence flagship with wide-ranging versatility and snappy banter.',
      category: 'Flagship',
      contextWindow: '128k tokens'
    },
    {
      id: 'openai/gpt-4o-mini',
      name: 'OpenAI GPT-4o-mini',
      provider: 'openrouter',
      providerName: 'OpenRouter.ai',
      description: 'Ultra-fast, cost-effective model for rapid-fire Noble Phantasm duels.',
      category: 'Fast & Instant',
      contextWindow: '128k tokens'
    },
    {
      id: 'google/gemini-2.0-flash-exp:free',
      name: 'Gemini 2.0 Flash Exp (:free)',
      provider: 'openrouter',
      providerName: 'OpenRouter.ai',
      description: 'Experimental Gemini 2.0 Flash hosted completely free on OpenRouter.',
      category: 'Fast & Instant',
      contextWindow: '1M tokens',
      isFreeTier: true
    },
    {
      id: 'qwen/qwen-2.5-72b-instruct',
      name: 'Qwen 2.5 72B Instruct',
      provider: 'openrouter',
      providerName: 'OpenRouter.ai',
      description: 'Alibaba 72B open weights model with massive lore knowledge and rich vocabulary.',
      category: 'Creative & Lore',
      contextWindow: '128k tokens'
    },
    {
      id: 'qwen/qwen-2.5-72b-instruct:free',
      name: 'Qwen 2.5 72B (:free)',
      provider: 'openrouter',
      providerName: 'OpenRouter.ai',
      description: 'Alibaba 72B open model at $0.00 on OpenRouter free tier.',
      category: 'Creative & Lore',
      contextWindow: '128k tokens',
      isFreeTier: true
    },
    {
      id: 'mistralai/mistral-large-2411',
      name: 'Mistral Large 2411',
      provider: 'openrouter',
      providerName: 'OpenRouter.ai',
      description: 'Flagship European LLM with 128k context and fluent multilingual dialogue.',
      category: 'Creative & Lore',
      contextWindow: '128k tokens'
    },
    {
      id: 'nousresearch/hermes-3-llama-3.1-405b',
      name: 'Hermes 3 405B',
      provider: 'openrouter',
      providerName: 'OpenRouter.ai',
      description: 'Massive 405B unaligned parameter model for unrestricted Servant personality expression.',
      category: 'Open Weights',
      contextWindow: '128k tokens'
    }
  ],

  // 4. DeepSeek Direct API
  deepseek: [
    {
      id: 'deepseek-chat',
      name: 'DeepSeek V3 (Chat)',
      provider: 'deepseek',
      providerName: 'DeepSeek Direct',
      description: 'Direct deepseek.com 671B MoE. Industry-leading open-weights performance and value.',
      category: 'Flagship',
      contextWindow: '64k tokens',
      recommended: true
    },
    {
      id: 'deepseek-reasoner',
      name: 'DeepSeek R1 (Reasoner)',
      provider: 'deepseek',
      providerName: 'DeepSeek Direct',
      description: 'Deep chain-of-thought reasoning for strategic battle command simulations.',
      category: 'Reasoning & CoT',
      contextWindow: '64k tokens',
      recommended: true
    }
  ],

  // 5. Mistral AI
  mistral: [
    {
      id: 'mistral-large-latest',
      name: 'Mistral Large',
      provider: 'mistral',
      providerName: 'Mistral AI',
      description: 'Top-tier reasoning and sophisticated multilingual visual novel character roleplay.',
      category: 'Flagship',
      contextWindow: '128k tokens',
      recommended: true
    },
    {
      id: 'mistral-small-latest',
      name: 'Mistral Small',
      provider: 'mistral',
      providerName: 'Mistral AI',
      description: 'Witty, concise, and highly expressive character roleplay on Mistral free tier.',
      category: 'Fast & Instant',
      contextWindow: '32k tokens',
      isFreeTier: true,
      recommended: true
    },
    {
      id: 'codestral-latest',
      name: 'Codestral',
      provider: 'mistral',
      providerName: 'Mistral AI',
      description: 'High-precision structured logic model for intricate Magecraft calculations.',
      category: 'Reasoning & CoT',
      contextWindow: '256k tokens'
    },
    {
      id: 'ministral-8b-latest',
      name: 'Ministral 8B',
      provider: 'mistral',
      providerName: 'Mistral AI',
      description: 'Ultra-fast lightweight model for low-latency dialogue responses.',
      category: 'Fast & Instant',
      contextWindow: '128k tokens'
    },
    {
      id: 'pixtral-large-latest',
      name: 'Pixtral Large',
      provider: 'mistral',
      providerName: 'Mistral AI',
      description: 'Frontier multimodal model for analyzing battle maps and visual servant arts.',
      category: 'Creative & Lore',
      contextWindow: '128k tokens'
    },
    {
      id: 'open-mistral-7b',
      name: 'Open Mistral 7B',
      provider: 'mistral',
      providerName: 'Mistral AI',
      description: 'Classic open-weights model, lightweight and fast.',
      category: 'Open Weights',
      contextWindow: '32k tokens',
      isFreeTier: true
    },
    {
      id: 'open-mixtral-8x7b',
      name: 'Open Mixtral 8x7B',
      provider: 'mistral',
      providerName: 'Mistral AI',
      description: 'Classic 8x7B Mixture of Experts.',
      category: 'Open Weights',
      contextWindow: '32k tokens',
      isFreeTier: true
    }
  ],

  // 6. Ollama / Local AI (Offline & Completely Private)
  ollama: [
    {
      id: 'llama3.3',
      name: 'Ollama: Llama 3.3 70B (Local)',
      provider: 'ollama',
      providerName: 'Ollama Local AI',
      description: 'State-of-the-art 70B open weights running locally on your hardware with 100% privacy.',
      category: 'Flagship',
      contextWindow: '128k tokens',
      isFreeTier: true,
      recommended: true
    },
    {
      id: 'llama3.2',
      name: 'Ollama: Llama 3.2 3B/1B (Local)',
      provider: 'ollama',
      providerName: 'Ollama Local AI',
      description: 'Lightweight local model with sub-second response times on standard CPUs/GPUs.',
      category: 'Fast & Instant',
      contextWindow: '128k tokens',
      isFreeTier: true,
      recommended: true
    },
    {
      id: 'deepseek-r1:7b',
      name: 'Ollama: DeepSeek R1 7B (Local Reasoning)',
      provider: 'ollama',
      providerName: 'Ollama Local AI',
      description: 'Chain-of-thought reasoning running 100% offline on your machine.',
      category: 'Reasoning & CoT',
      contextWindow: '32k tokens',
      isFreeTier: true,
      recommended: true
    },
    {
      id: 'deepseek-r1:14b',
      name: 'Ollama: DeepSeek R1 14B (Local)',
      provider: 'ollama',
      providerName: 'Ollama Local AI',
      description: 'Balanced local reasoning model with deep strategic understanding.',
      category: 'Reasoning & CoT',
      contextWindow: '64k tokens',
      isFreeTier: true
    },
    {
      id: 'deepseek-r1:70b',
      name: 'Ollama: DeepSeek R1 70B (Local)',
      provider: 'ollama',
      providerName: 'Ollama Local AI',
      description: 'Heavyweight reasoning model for high-end local workstations.',
      category: 'Reasoning & CoT',
      contextWindow: '128k tokens',
      isFreeTier: true
    },
    {
      id: 'mistral',
      name: 'Ollama: Mistral 7B (Local)',
      provider: 'ollama',
      providerName: 'Ollama Local AI',
      description: 'Local Mistral model on localhost:11434 with zero network calls.',
      category: 'Local Offline',
      contextWindow: '32k tokens',
      isFreeTier: true
    },
    {
      id: 'mistral-nemo',
      name: 'Ollama: Mistral NeMo 12B (Local)',
      provider: 'ollama',
      providerName: 'Ollama Local AI',
      description: '12B parameter model built in collaboration with NVIDIA.',
      category: 'Local Offline',
      contextWindow: '128k tokens',
      isFreeTier: true
    },
    {
      id: 'qwen2.5:7b',
      name: 'Ollama: Qwen 2.5 7B (Local)',
      provider: 'ollama',
      providerName: 'Ollama Local AI',
      description: 'Alibaba Qwen 2.5 local model with extensive anime & gaming lore.',
      category: 'Creative & Lore',
      contextWindow: '32k tokens',
      isFreeTier: true
    },
    {
      id: 'qwen2.5:14b',
      name: 'Ollama: Qwen 2.5 14B (Local)',
      provider: 'ollama',
      providerName: 'Ollama Local AI',
      description: 'Mid-sized local lore powerhouse.',
      category: 'Creative & Lore',
      contextWindow: '32k tokens',
      isFreeTier: true
    },
    {
      id: 'qwen2.5:32b',
      name: 'Ollama: Qwen 2.5 32B (Local)',
      provider: 'ollama',
      providerName: 'Ollama Local AI',
      description: 'High parameter local model with rich storytelling prowess.',
      category: 'Creative & Lore',
      contextWindow: '64k tokens',
      isFreeTier: true
    },
    {
      id: 'gemma2:9b',
      name: 'Ollama: Gemma 2 9B (Local)',
      provider: 'ollama',
      providerName: 'Ollama Local AI',
      description: "Google's Gemma 2 running offline on Ollama.",
      category: 'Open Weights',
      contextWindow: '8k tokens',
      isFreeTier: true
    },
    {
      id: 'phi3:mini',
      name: 'Ollama: Phi 3 Mini 3.8B (Local)',
      provider: 'ollama',
      providerName: 'Ollama Local AI',
      description: 'Microsoft compact high-reasoning model.',
      category: 'Fast & Instant',
      contextWindow: '128k tokens',
      isFreeTier: true
    }
  ],

  // 7. NanoGPT
  nanogpt: [
    {
      id: 'gpt-4o-mini',
      name: 'NanoGPT: GPT-4o Mini',
      provider: 'nanogpt',
      providerName: 'NanoGPT',
      description: 'Pay-per-prompt or Nano faucet micro-credits for fast responses.',
      category: 'Fast & Instant',
      contextWindow: '128k tokens',
      recommended: true
    },
    {
      id: 'gpt-4o',
      name: 'NanoGPT: GPT-4o',
      provider: 'nanogpt',
      providerName: 'NanoGPT',
      description: 'Full GPT-4o omni intelligence paid in Nano cryptocurrency.',
      category: 'Flagship',
      contextWindow: '128k tokens'
    },
    {
      id: 'claude-3-5-sonnet',
      name: 'NanoGPT: Claude 3.5 Sonnet',
      provider: 'nanogpt',
      providerName: 'NanoGPT',
      description: 'Claude 3.5 Sonnet via NanoGPT gateway.',
      category: 'Creative & Lore',
      contextWindow: '200k tokens'
    },
    {
      id: 'deepseek-chat',
      name: 'NanoGPT: DeepSeek V3',
      provider: 'nanogpt',
      providerName: 'NanoGPT',
      description: 'DeepSeek V3 chat paid in Nano micro-transactions.',
      category: 'Flagship',
      contextWindow: '64k tokens'
    }
  ],

  // 8. Custom OpenAI-Compatible
  custom: [
    {
      id: 'default',
      name: 'Custom Server Default Model',
      provider: 'custom',
      providerName: 'Custom Endpoint',
      description: 'Uses the default model configured on your custom OpenAI-compatible API endpoint.',
      category: 'Open Weights',
      recommended: true
    },
    {
      id: 'llama-3.3-70b-instruct',
      name: 'Custom: Llama 3.3 70B',
      provider: 'custom',
      providerName: 'Custom Endpoint',
      description: 'Meta 70B model hosted on vLLM, LM Studio, or Together AI.',
      category: 'Flagship'
    },
    {
      id: 'deepseek-r1',
      name: 'Custom: DeepSeek R1',
      provider: 'custom',
      providerName: 'Custom Endpoint',
      description: 'Self-hosted or third-party DeepSeek R1 instance.',
      category: 'Reasoning & CoT'
    }
  ]
};

/**
 * Returns all predefined models for the given provider.
 */
export function getModelsForProvider(provider: ApiProviderType): ProviderModelSpec[] {
  return PROVIDER_ALL_MODELS_CATALOG[provider] || [];
}

/**
 * Backwards compatibility catalog for free models.
 */
export const FREE_MODELS_CATALOG: ProviderModelSpec[] = Object.values(PROVIDER_ALL_MODELS_CATALOG)
  .flat()
  .filter(m => m.isFreeTier || m.provider === 'ollama');

/**
 * Dynamically queries live models directly from the provider API endpoint so the model list is NEVER outdated.
 */
export async function fetchLiveProviderModels(
  provider: ApiProviderType,
  apiKey?: string,
  endpoint?: string
): Promise<{ success: boolean; models: ProviderModelSpec[]; source: 'live_api' | 'catalog'; error?: string }> {
  const fallback = getModelsForProvider(provider);
  const rawKey = apiKey ? decryptSecret(apiKey) : '';

  try {
    // 1. OpenRouter Live Dynamic Model List (Works public or authenticated)
    if (provider === 'openrouter') {
      const headers: Record<string, string> = {
        'HTTP-Referer': 'https://discord.gg',
        'X-Title': 'Fate Holy Grail War Bot'
      };
      if (rawKey) headers['Authorization'] = `Bearer ${rawKey.trim()}`;

      const res = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(6000)
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        const liveList: any[] = data.data || [];
        if (Array.isArray(liveList) && liveList.length > 0) {
          const mapped: ProviderModelSpec[] = liveList.slice(0, 30).map((m: any) => {
            const isFree = m.id.endsWith(':free') || (m.pricing?.prompt === '0' && m.pricing?.completion === '0');
            return {
              id: m.id,
              name: m.name || m.id,
              provider: 'openrouter',
              providerName: 'OpenRouter.ai',
              description: m.description ? m.description.slice(0, 110) + '...' : `OpenRouter model (${m.context_length || '128k'} context)`,
              category: isFree ? 'Flagship' : (m.id.includes('r1') || m.id.includes('reason') ? 'Reasoning & CoT' : 'Creative & Lore'),
              contextWindow: m.context_length ? `${Math.round(m.context_length / 1000)}k tokens` : undefined,
              isFreeTier: isFree,
              recommended: isFree || m.id.includes('llama-3.3') || m.id.includes('claude-3.5') || m.id.includes('deepseek-r1')
            };
          });

          return { success: true, models: mapped, source: 'live_api' };
        }
      }
    }

    // 2. Groq Live Dynamic Models (requires Groq key)
    if (provider === 'groq' && rawKey) {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${rawKey.trim()}`
        },
        signal: AbortSignal.timeout(5000)
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        const liveList: any[] = data.data || [];
        if (Array.isArray(liveList) && liveList.length > 0) {
          const mapped: ProviderModelSpec[] = liveList
            .filter((m: any) => !m.id.includes('whisper') && !m.id.includes('embed'))
            .map((m: any) => ({
              id: m.id,
              name: m.id.replace(/-/g, ' ').toUpperCase(),
              provider: 'groq',
              providerName: 'Groq Cloud',
              description: `Active model on Groq LPUs. (Owned by ${m.owned_by || 'groq'})`,
              category: m.id.includes('r1') ? 'Reasoning & CoT' : (m.id.includes('8b') ? 'Fast & Instant' : 'Flagship'),
              contextWindow: m.context_window ? `${Math.round(m.context_window / 1000)}k tokens` : '128k tokens',
              isFreeTier: true,
              recommended: m.id.includes('llama-3.3-70b') || m.id.includes('deepseek-r1')
            }));

          return { success: true, models: mapped, source: 'live_api' };
        }
      }
    }

    // 3. Ollama Live Dynamic Tags/Models (queries local ollama server)
    if (provider === 'ollama') {
      const baseUrl = (endpoint || 'http://localhost:11434').replace(/\/v1.*$/, '').replace(/\/api.*$/, '');
      const res = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(4000)
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        const liveList: any[] = data.models || [];
        if (Array.isArray(liveList) && liveList.length > 0) {
          const mapped: ProviderModelSpec[] = liveList.map((m: any) => ({
            id: m.name || m.model,
            name: `Ollama: ${m.name || m.model} (Installed)`,
            provider: 'ollama',
            providerName: 'Ollama Local AI',
            description: `Locally installed Ollama model (${m.details?.parameter_size || 'Unknown size'}, ${m.details?.quantization_level || 'quantized'}). 100% Offline Free.`,
            category: 'Local Offline',
            isFreeTier: true,
            recommended: true
          }));

          return { success: true, models: mapped, source: 'live_api' };
        }
      }
    }

    // 4. Mistral Live Dynamic Models (requires Mistral key)
    if (provider === 'mistral' && rawKey) {
      const res = await fetch('https://api.mistral.ai/v1/models', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${rawKey.trim()}` },
        signal: AbortSignal.timeout(5000)
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        const liveList: any[] = data.data || [];
        if (Array.isArray(liveList) && liveList.length > 0) {
          const mapped: ProviderModelSpec[] = liveList
            .filter((m: any) => !m.id.includes('embed'))
            .map((m: any) => ({
              id: m.id,
              name: m.id,
              provider: 'mistral',
              providerName: 'Mistral AI',
              description: `Mistral official model (${m.max_context_length ? `${Math.round(m.max_context_length / 1000)}k ctx` : '32k ctx'}).`,
              category: m.id.includes('large') ? 'Flagship' : (m.id.includes('codestral') ? 'Reasoning & CoT' : 'Fast & Instant'),
              isFreeTier: m.id.includes('small') || m.id.includes('open'),
              recommended: m.id.includes('large') || m.id.includes('small')
            }));

          return { success: true, models: mapped, source: 'live_api' };
        }
      }
    }
  } catch (err: any) {
    // Graceful fallback to static comprehensive catalog
    return { success: false, models: fallback, source: 'catalog', error: err?.message };
  }

  return { success: true, models: fallback, source: 'catalog' };
}

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
