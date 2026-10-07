import { GoogleGenAI } from '@google/genai';
import { ApiProviderType } from '../types';
import { decryptSecret, redactSensitiveKeysFromText } from './cryptoSecurity';

export interface ApiConnectivityResult {
  success: boolean;
  provider: ApiProviderType;
  modelUsed: string;
  latencyMs: number;
  echoResponse?: string;
  message: string;
  errorCategory?: 'invalid_key' | 'invalid_model' | 'quota_exceeded' | 'timeout' | 'network_error' | 'unsupported_provider';
}

export interface ApiPingOptions {
  model?: string;
  customEndpoint?: string;
  timeoutMs?: number;
  customPingPrompt?: string;
}

export const DEFAULT_PING_MODELS: Record<ApiProviderType, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-3-7-sonnet-20250219',
  gemini: 'gemini-3.5-flash',
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'meta-llama/llama-3.3-70b-instruct:free',
  deepseek: 'deepseek-chat',
  xai: 'grok-2-1212',
  mistral: 'mistral-small-latest',
  together: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  perplexity: 'sonar-reasoning',
  cerebras: 'llama-3.3-70b',
  cohere: 'command-r-plus-08-2024',
  nanogpt: 'gpt-4o-mini',
  ollama: 'llama3.2',
  custom: 'default'
};

/**
 * Categorizes an error message from an API provider into a structured error code.
 */
function categorizeError(status: number, errorText: string): ApiConnectivityResult['errorCategory'] {
  const lower = errorText.toLowerCase();
  if (status === 401 || status === 403 || lower.includes('unauthorized') || lower.includes('api key') || lower.includes('invalid api_key') || lower.includes('authentication')) {
    return 'invalid_key';
  }
  if (status === 404 || lower.includes('model_not_found') || lower.includes('does not exist') || lower.includes('unknown model') || lower.includes('invalid model')) {
    return 'invalid_model';
  }
  if (status === 429 || lower.includes('quota') || lower.includes('rate limit') || lower.includes('resource_exhausted') || lower.includes('credits')) {
    return 'quota_exceeded';
  }
  if (lower.includes('timeout') || lower.includes('aborted') || lower.includes('etimedout')) {
    return 'timeout';
  }
  return 'network_error';
}

/**
 * Utility function to test API provider connectivity with a lightweight 'ping' or 'echo' request.
 * Measures response latency, validates authentication, and redacts sensitive credentials from output.
 *
 * @param provider The AI provider to test (gemini, groq, openai, anthropic, etc.)
 * @param apiKey The raw or AES-encrypted API key
 * @param options Optional configuration including custom model, custom endpoint, and timeout
 */
export async function pingApiProvider(
  provider: ApiProviderType,
  apiKey: string,
  options?: ApiPingOptions
): Promise<ApiConnectivityResult> {
  const startTime = Date.now();
  const rawKey = decryptSecret(apiKey)?.trim() || '';
  const model = options?.model?.trim() || DEFAULT_PING_MODELS[provider] || 'default';
  const timeoutMs = options?.timeoutMs || 10000;
  const pingPrompt = options?.customPingPrompt || 'Echo back the single word: "ping_ok"';

  if (!rawKey && provider !== 'ollama') {
    return {
      success: false,
      provider,
      modelUsed: model,
      latencyMs: 0,
      message: 'Empty or invalid API key provided.',
      errorCategory: 'invalid_key'
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 1. Google Gemini (via @google/genai SDK)
    if (provider === 'gemini') {
      const ai = new GoogleGenAI({
        apiKey: rawKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const response = await ai.models.generateContent({
        model,
        contents: pingPrompt,
        config: {
          maxOutputTokens: 15,
          temperature: 0.1
        }
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;
      const echo = response.text?.trim() || '';

      if (echo.length > 0) {
        return {
          success: true,
          provider,
          modelUsed: model,
          latencyMs,
          echoResponse: echo,
          message: `Google Gemini connected successfully in ${latencyMs}ms (Echo: "${echo.slice(0, 30)}")`
        };
      }
      throw new Error('Received empty response from Gemini API.');
    }

    // 2. OpenAI
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${rawKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: pingPrompt }],
          max_tokens: 15,
          temperature: 0.1
        })
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errBody = await res.text();
        const safeErr = redactSensitiveKeysFromText(errBody.slice(0, 180), [rawKey]);
        return {
          success: false,
          provider,
          modelUsed: model,
          latencyMs,
          message: `OpenAI error (HTTP ${res.status}): ${safeErr}`,
          errorCategory: categorizeError(res.status, errBody)
        };
      }

      const data = await res.json() as any;
      const echo = data.choices?.[0]?.message?.content?.trim() || '';
      return {
        success: true,
        provider,
        modelUsed: model,
        latencyMs,
        echoResponse: echo,
        message: `OpenAI connected successfully in ${latencyMs}ms (Echo: "${echo.slice(0, 30)}")`
      };
    }

    // 3. Anthropic Claude
    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'x-api-key': rawKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: pingPrompt }],
          max_tokens: 15
        })
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errBody = await res.text();
        const safeErr = redactSensitiveKeysFromText(errBody.slice(0, 180), [rawKey]);
        return {
          success: false,
          provider,
          modelUsed: model,
          latencyMs,
          message: `Anthropic Claude error (HTTP ${res.status}): ${safeErr}`,
          errorCategory: categorizeError(res.status, errBody)
        };
      }

      const data = await res.json() as any;
      const echo = data.content?.[0]?.text?.trim() || '';
      return {
        success: true,
        provider,
        modelUsed: model,
        latencyMs,
        echoResponse: echo,
        message: `Anthropic Claude connected successfully in ${latencyMs}ms (Echo: "${echo.slice(0, 30)}")`
      };
    }

    // 4. Groq Cloud
    if (provider === 'groq') {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${rawKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: pingPrompt }],
          max_tokens: 15,
          temperature: 0.1
        })
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errBody = await res.text();
        const safeErr = redactSensitiveKeysFromText(errBody.slice(0, 180), [rawKey]);
        return {
          success: false,
          provider,
          modelUsed: model,
          latencyMs,
          message: `Groq error (HTTP ${res.status}): ${safeErr}`,
          errorCategory: categorizeError(res.status, errBody)
        };
      }

      const data = await res.json() as any;
      const echo = data.choices?.[0]?.message?.content?.trim() || '';
      return {
        success: true,
        provider,
        modelUsed: model,
        latencyMs,
        echoResponse: echo,
        message: `Groq Cloud connected successfully in ${latencyMs}ms (Echo: "${echo.slice(0, 30)}")`
      };
    }

    // 5. OpenRouter
    if (provider === 'openrouter') {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${rawKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://discord.gg',
          'X-Title': 'Fate RPG Bot'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: pingPrompt }],
          max_tokens: 15,
          temperature: 0.1
        })
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errBody = await res.text();
        const safeErr = redactSensitiveKeysFromText(errBody.slice(0, 180), [rawKey]);
        return {
          success: false,
          provider,
          modelUsed: model,
          latencyMs,
          message: `OpenRouter error (HTTP ${res.status}): ${safeErr}`,
          errorCategory: categorizeError(res.status, errBody)
        };
      }

      const data = await res.json() as any;
      const echo = data.choices?.[0]?.message?.content?.trim() || '';
      return {
        success: true,
        provider,
        modelUsed: model,
        latencyMs,
        echoResponse: echo,
        message: `OpenRouter connected successfully in ${latencyMs}ms (Echo: "${echo.slice(0, 30)}")`
      };
    }

    // 6. DeepSeek Direct API
    if (provider === 'deepseek') {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${rawKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: pingPrompt }],
          max_tokens: 15,
          temperature: 0.1
        })
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errBody = await res.text();
        const safeErr = redactSensitiveKeysFromText(errBody.slice(0, 180), [rawKey]);
        return {
          success: false,
          provider,
          modelUsed: model,
          latencyMs,
          message: `DeepSeek error (HTTP ${res.status}): ${safeErr}`,
          errorCategory: categorizeError(res.status, errBody)
        };
      }

      const data = await res.json() as any;
      const echo = data.choices?.[0]?.message?.content?.trim() || '';
      return {
        success: true,
        provider,
        modelUsed: model,
        latencyMs,
        echoResponse: echo,
        message: `DeepSeek connected successfully in ${latencyMs}ms (Echo: "${echo.slice(0, 30)}")`
      };
    }

    // 7. xAI (Grok)
    if (provider === 'xai') {
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${rawKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: pingPrompt }],
          max_tokens: 15,
          temperature: 0.1
        })
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errBody = await res.text();
        const safeErr = redactSensitiveKeysFromText(errBody.slice(0, 180), [rawKey]);
        return {
          success: false,
          provider,
          modelUsed: model,
          latencyMs,
          message: `xAI Grok error (HTTP ${res.status}): ${safeErr}`,
          errorCategory: categorizeError(res.status, errBody)
        };
      }

      const data = await res.json() as any;
      const echo = data.choices?.[0]?.message?.content?.trim() || '';
      return {
        success: true,
        provider,
        modelUsed: model,
        latencyMs,
        echoResponse: echo,
        message: `xAI Grok connected successfully in ${latencyMs}ms (Echo: "${echo.slice(0, 30)}")`
      };
    }

    // 8. Mistral AI
    if (provider === 'mistral') {
      const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${rawKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: pingPrompt }],
          max_tokens: 15,
          temperature: 0.1
        })
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errBody = await res.text();
        const safeErr = redactSensitiveKeysFromText(errBody.slice(0, 180), [rawKey]);
        return {
          success: false,
          provider,
          modelUsed: model,
          latencyMs,
          message: `Mistral AI error (HTTP ${res.status}): ${safeErr}`,
          errorCategory: categorizeError(res.status, errBody)
        };
      }

      const data = await res.json() as any;
      const echo = data.choices?.[0]?.message?.content?.trim() || '';
      return {
        success: true,
        provider,
        modelUsed: model,
        latencyMs,
        echoResponse: echo,
        message: `Mistral AI connected successfully in ${latencyMs}ms (Echo: "${echo.slice(0, 30)}")`
      };
    }

    // 9. Together AI
    if (provider === 'together') {
      const res = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${rawKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: pingPrompt }],
          max_tokens: 15,
          temperature: 0.1
        })
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errBody = await res.text();
        const safeErr = redactSensitiveKeysFromText(errBody.slice(0, 180), [rawKey]);
        return {
          success: false,
          provider,
          modelUsed: model,
          latencyMs,
          message: `Together AI error (HTTP ${res.status}): ${safeErr}`,
          errorCategory: categorizeError(res.status, errBody)
        };
      }

      const data = await res.json() as any;
      const echo = data.choices?.[0]?.message?.content?.trim() || '';
      return {
        success: true,
        provider,
        modelUsed: model,
        latencyMs,
        echoResponse: echo,
        message: `Together AI connected successfully in ${latencyMs}ms (Echo: "${echo.slice(0, 30)}")`
      };
    }

    // 10. Perplexity AI
    if (provider === 'perplexity') {
      const res = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${rawKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: pingPrompt }],
          max_tokens: 15,
          temperature: 0.1
        })
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errBody = await res.text();
        const safeErr = redactSensitiveKeysFromText(errBody.slice(0, 180), [rawKey]);
        return {
          success: false,
          provider,
          modelUsed: model,
          latencyMs,
          message: `Perplexity error (HTTP ${res.status}): ${safeErr}`,
          errorCategory: categorizeError(res.status, errBody)
        };
      }

      const data = await res.json() as any;
      const echo = data.choices?.[0]?.message?.content?.trim() || '';
      return {
        success: true,
        provider,
        modelUsed: model,
        latencyMs,
        echoResponse: echo,
        message: `Perplexity AI connected successfully in ${latencyMs}ms (Echo: "${echo.slice(0, 30)}")`
      };
    }

    // 11. Cerebras
    if (provider === 'cerebras') {
      const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${rawKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: pingPrompt }],
          max_tokens: 15,
          temperature: 0.1
        })
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errBody = await res.text();
        const safeErr = redactSensitiveKeysFromText(errBody.slice(0, 180), [rawKey]);
        return {
          success: false,
          provider,
          modelUsed: model,
          latencyMs,
          message: `Cerebras error (HTTP ${res.status}): ${safeErr}`,
          errorCategory: categorizeError(res.status, errBody)
        };
      }

      const data = await res.json() as any;
      const echo = data.choices?.[0]?.message?.content?.trim() || '';
      return {
        success: true,
        provider,
        modelUsed: model,
        latencyMs,
        echoResponse: echo,
        message: `Cerebras connected successfully in ${latencyMs}ms (Echo: "${echo.slice(0, 30)}")`
      };
    }

    // 12. Cohere
    if (provider === 'cohere') {
      const res = await fetch('https://api.cohere.com/v2/chat', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${rawKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: { type: 'text', text: pingPrompt } }]
        })
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errBody = await res.text();
        const safeErr = redactSensitiveKeysFromText(errBody.slice(0, 180), [rawKey]);
        return {
          success: false,
          provider,
          modelUsed: model,
          latencyMs,
          message: `Cohere error (HTTP ${res.status}): ${safeErr}`,
          errorCategory: categorizeError(res.status, errBody)
        };
      }

      const data = await res.json() as any;
      const echo = data.message?.content?.[0]?.text?.trim() || '';
      return {
        success: true,
        provider,
        modelUsed: model,
        latencyMs,
        echoResponse: echo,
        message: `Cohere connected successfully in ${latencyMs}ms (Echo: "${echo.slice(0, 30)}")`
      };
    }

    // 13. NanoGPT
    if (provider === 'nanogpt') {
      const res = await fetch('https://nano-gpt.com/api/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${rawKey}`,
          'x-api-key': rawKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: pingPrompt }],
          max_tokens: 15,
          temperature: 0.1
        })
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errBody = await res.text();
        const safeErr = redactSensitiveKeysFromText(errBody.slice(0, 180), [rawKey]);
        return {
          success: false,
          provider,
          modelUsed: model,
          latencyMs,
          message: `NanoGPT error (HTTP ${res.status}): ${safeErr}`,
          errorCategory: categorizeError(res.status, errBody)
        };
      }

      const data = await res.json() as any;
      const echo = data.choices?.[0]?.message?.content?.trim() || '';
      return {
        success: true,
        provider,
        modelUsed: model,
        latencyMs,
        echoResponse: echo,
        message: `NanoGPT connected successfully in ${latencyMs}ms (Echo: "${echo.slice(0, 30)}")`
      };
    }

    // 14. Ollama (Local)
    if (provider === 'ollama') {
      const endpoint = (options?.customEndpoint || 'http://localhost:11434/v1/chat/completions').trim();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (rawKey) headers['Authorization'] = `Bearer ${rawKey}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers,
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: pingPrompt }],
          max_tokens: 15,
          temperature: 0.1
        })
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errBody = await res.text();
        return {
          success: false,
          provider,
          modelUsed: model,
          latencyMs,
          message: `Ollama error (HTTP ${res.status}): ${errBody.slice(0, 180)}`,
          errorCategory: categorizeError(res.status, errBody)
        };
      }

      const data = await res.json() as any;
      const echo = data.choices?.[0]?.message?.content?.trim() || '';
      return {
        success: true,
        provider,
        modelUsed: model,
        latencyMs,
        echoResponse: echo,
        message: `Ollama local instance connected in ${latencyMs}ms (Echo: "${echo.slice(0, 30)}")`
      };
    }

    // 15. Custom OpenAI-Compatible Endpoints
    if (provider === 'custom') {
      const endpoint = (options?.customEndpoint || 'https://api.openai.com/v1/chat/completions').trim();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (rawKey) headers['Authorization'] = `Bearer ${rawKey}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers,
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: pingPrompt }],
          max_tokens: 15,
          temperature: 0.1
        })
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errBody = await res.text();
        const safeErr = redactSensitiveKeysFromText(errBody.slice(0, 180), [rawKey]);
        return {
          success: false,
          provider,
          modelUsed: model,
          latencyMs,
          message: `Custom endpoint HTTP ${res.status}: ${safeErr}`,
          errorCategory: categorizeError(res.status, errBody)
        };
      }

      const data = await res.json() as any;
      const echo = data.choices?.[0]?.message?.content?.trim() || '';
      return {
        success: true,
        provider,
        modelUsed: model,
        latencyMs,
        echoResponse: echo,
        message: `Custom endpoint responded in ${latencyMs}ms (Echo: "${echo.slice(0, 30)}")`
      };
    }

    clearTimeout(timeoutId);
    return {
      success: false,
      provider,
      modelUsed: model,
      latencyMs: Date.now() - startTime,
      message: `Unsupported provider: ${provider}`,
      errorCategory: 'unsupported_provider'
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    const isTimeout = err?.name === 'AbortError' || err?.message?.toLowerCase().includes('aborted');
    const safeError = redactSensitiveKeysFromText(err?.message || 'Connection test failed.', [rawKey]);

    return {
      success: false,
      provider,
      modelUsed: model,
      latencyMs,
      message: isTimeout ? `Connection timed out after ${timeoutMs}ms.` : safeError,
      errorCategory: isTimeout ? 'timeout' : categorizeError(0, err?.message || '')
    };
  }
}
