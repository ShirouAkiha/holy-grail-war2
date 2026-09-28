import { MasterProfile } from '../types';
import { saveMaster } from '../database/service';

export function getDailyUtcDateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10); // e.g. "2026-09-13"
}

/**
 * Checks whether the Master has an active custom BYOK (Bring Your Own Key) setup.
 */
export function isMasterByokActive(master: MasterProfile): boolean {
  const cfg = master.customApiConfig;
  if (!cfg || !cfg.enabled) return false;
  const p = cfg.activeProvider;
  if (p === 'openai' && !!cfg.openaiKey) return true;
  if (p === 'anthropic' && !!cfg.anthropicKey) return true;
  if (p === 'gemini' && !!cfg.geminiKey) return true;
  if (p === 'groq' && !!cfg.groqKey) return true;
  if (p === 'openrouter' && !!cfg.openrouterKey) return true;
  if (p === 'deepseek' && !!cfg.deepseekKey) return true;
  if (p === 'xai' && !!cfg.xaiKey) return true;
  if (p === 'mistral' && !!cfg.mistralKey) return true;
  if (p === 'together' && !!cfg.togetherKey) return true;
  if (p === 'perplexity' && !!cfg.perplexityKey) return true;
  if (p === 'cerebras' && !!cfg.cerebrasKey) return true;
  if (p === 'cohere' && !!cfg.cohereKey) return true;
  if (p === 'ollama') return true; // Local Ollama
  if (p === 'nanogpt' && !!cfg.nanogptKey) return true;
  if (p === 'custom' && (!!cfg.customKey || !!cfg.customEndpoint)) return true;
  return false;
}

/**
 * Returns a comprehensive, user-friendly explanation of why a Servant might reply
 * with a generic line or fallback response, explaining daily chat limits and recommending BYOK keys.
 */
export function explainGenericResponseReason(
  master: MasterProfile,
  totalMastersCount: number = 7,
  isFallback: boolean = false
): {
  title: string;
  description: string;
  reasonType: 'daily_quota_spent' | 'server_rate_limited' | 'byok_active_ok';
  recommendation: string;
} {
  const maxToday = calculateMaxDailyTalks(totalMastersCount);
  const todayKey = getDailyUtcDateKey();
  const usedToday = master.lastTalkDay === todayKey ? (master.dailyTalkCount || 0) : 0;
  const remainingToday = Math.max(0, maxToday - usedToday);
  const byok = isMasterByokActive(master);

  if (byok) {
    return {
      title: '🔑 Active Custom API Key (BYOK Enabled)',
      description: `Master **${master.username}**, you have connected a custom AI provider (\`${master.customApiConfig?.activeProvider?.toUpperCase() || 'CUSTOM'}\`). You enjoy **unlimited telepathic chats** bypassing public server rate limits.`,
      reasonType: 'byok_active_ok',
      recommendation: 'If you still experience static, check if your provider key balance or local Ollama endpoint is active!'
    };
  }

  if (remainingToday <= 0) {
    return {
      title: '⚠️ Daily Free Telepathic Chat Limit Reached',
      description:
        `Master **${master.username}**, you have exhausted your daily free chats on the public server pool (\`${usedToday}/${maxToday}\` used today).\n\n` +
        `When daily chats are spent, your Servant cannot connect to full AI models and falls back to simple generic dialogue lines.`,
      reasonType: 'daily_quota_spent',
      recommendation:
        `💡 **Solution:** Connect your own API key using \`/apikey\` or \`/byok setup\` for **unlimited, instant responses**!\n` +
        `• **100% Free Keys:** Groq Cloud (Ultra-fast Llama 3.3 70B), OpenRouter (:free), Google AI Studio Gemini (Free), or Ollama (Local AI).\n` +
        `• **Flagship Options:** Anthropic Claude 3.7 / 3.5 Sonnet, OpenAI GPT-4o, DeepSeek V3/R1.`
    };
  }

  if (isFallback) {
    return {
      title: '⚡ Shared Public AI Pool Congestion / Rate-Limited',
      description:
        `Master **${master.username}**, your Servant used a generic fallback line because the free public AI server pool is currently congested or rate-limited.\n\n` +
        `You still have **${remainingToday}/${maxToday} free chats** remaining today, but high peak demand on shared models temporarily forced a fallback.`,
      reasonType: 'server_rate_limited',
      recommendation:
        `💡 **Bypass Public Rate Limits:** Connect a personal API key using \`/apikey\`!\n` +
        `Using your own free **Groq Cloud**, **OpenRouter (:free)**, or **Gemini Key** bypasses shared server queues completely for dedicated 100% uptime!`
    };
  }

  return {
    title: '💬 Free Telepathic Resonance Active',
    description: `You have **${remainingToday}/${maxToday} free daily chats** remaining today. Resets daily at 00:00 UTC.`,
    reasonType: 'daily_quota_spent',
    recommendation: 'To upgrade to unlimited chats at any time, connect a free or paid API key using `/apikey`!'
  };
}

/**
 * Returns the daily maximum telepathic chats allowed based on War scale:
 * - 25 chats per day for standard 7-Master Grail Wars (or fewer)
 * - 20 chats per day for expanded Wars (> 7 Masters)
 */
export function calculateMaxDailyTalks(totalMastersCount: number): number {
  return totalMastersCount <= 7 ? 25 : 20;
}

export interface MasterTalkQuotaStatus {
  allowed: boolean;
  reason?: 'daily_limit_reached' | 'burst_cooldown';
  remainingToday: number;
  maxToday: number;
  cooldownRemainingSeconds?: number;
  currentDay: string;
  isByok?: boolean;
}

/**
 * Check if Master has available telepathic resonance (daily limit & burst cooldown).
 */
export function checkMasterTalkQuota(master: MasterProfile, totalMastersCount: number): MasterTalkQuotaStatus {
  const maxToday = calculateMaxDailyTalks(totalMastersCount);
  const todayKey = getDailyUtcDateKey();
  const now = Date.now();
  const byok = isMasterByokActive(master);

  // 1. Anti-Spam Burst Cooldown: 5 seconds between consecutive /talk messages
  if (master.lastTalkTimestamp && (now - master.lastTalkTimestamp) < 5000) {
    const elapsed = now - master.lastTalkTimestamp;
    const cooldownRemaining = Math.max(1, Math.ceil((5000 - elapsed) / 1000));
    const usedToday = master.lastTalkDay === todayKey ? (master.dailyTalkCount || 0) : 0;
    return {
      allowed: false,
      reason: 'burst_cooldown',
      remainingToday: byok ? 9999 : Math.max(0, maxToday - usedToday),
      maxToday: byok ? 9999 : maxToday,
      cooldownRemainingSeconds: cooldownRemaining,
      currentDay: todayKey,
      isByok: byok
    };
  }

  // If BYOK is active, the Master bypasses server daily quota limits
  if (byok) {
    return {
      allowed: true,
      remainingToday: 9999,
      maxToday: 9999,
      currentDay: todayKey,
      isByok: true
    };
  }

  // 2. Daily Quota Check (25 for <= 7 Masters, 20 for > 7 Masters)
  const usedToday = master.lastTalkDay === todayKey ? (master.dailyTalkCount || 0) : 0;
  const remainingToday = Math.max(0, maxToday - usedToday);

  if (remainingToday <= 0) {
    return {
      allowed: false,
      reason: 'daily_limit_reached',
      remainingToday: 0,
      maxToday,
      currentDay: todayKey,
      isByok: false
    };
  }

  return {
    allowed: true,
    remainingToday,
    maxToday,
    currentDay: todayKey,
    isByok: false
  };
}

/**
 * Consumes 1 daily telepathic transmission and updates timestamp.
 */
export async function consumeMasterTalkQuota(
  master: MasterProfile,
  totalMastersCount: number
): Promise<{ remainingToday: number; maxToday: number; isByok: boolean }> {
  const todayKey = getDailyUtcDateKey();
  const maxToday = calculateMaxDailyTalks(totalMastersCount);
  const now = Date.now();
  const byok = isMasterByokActive(master);

  if (master.lastTalkDay !== todayKey) {
    master.lastTalkDay = todayKey;
    master.dailyTalkCount = 1;
  } else {
    master.dailyTalkCount = (master.dailyTalkCount || 0) + 1;
  }
  master.lastTalkTimestamp = now;

  await saveMaster(master);

  const remaining = byok ? 9999 : Math.max(0, maxToday - (master.dailyTalkCount || 0));
  return {
    remainingToday: remaining,
    maxToday: byok ? 9999 : maxToday,
    isByok: byok
  };
}

/**
 * Refills +5 telepathic transmissions by channeling 1 Command Seal.
 */
export async function refillTalkQuotaWithCommandSeal(
  master: MasterProfile,
  totalMastersCount: number
): Promise<{ success: boolean; message: string; remainingToday: number; sealsRemaining: number }> {
  if ((master.commandSeals ?? 0) <= 0) {
    return {
      success: false,
      message: 'You have no Command Seals remaining to restore telepathic mana.',
      remainingToday: 0,
      sealsRemaining: 0
    };
  }

  const todayKey = getDailyUtcDateKey();
  if (master.lastTalkDay !== todayKey) {
    master.lastTalkDay = todayKey;
    master.dailyTalkCount = 0;
  }

  // Deduct 1 Command Seal
  master.commandSeals = Math.max(0, (master.commandSeals ?? 3) - 1);
  // Subtract 5 from used count (effectively granting +5 additional transmissions)
  master.dailyTalkCount = Math.max(0, (master.dailyTalkCount || 0) - 5);

  await saveMaster(master);

  const maxToday = calculateMaxDailyTalks(totalMastersCount);
  const remaining = Math.max(0, maxToday - (master.dailyTalkCount || 0));

  return {
    success: true,
    message: `🔱 **Command Seal Channeled!** Restored +5 telepathic transmissions. (${remaining}/${maxToday} remaining today)`,
    remainingToday: remaining,
    sealsRemaining: master.commandSeals
  };
}
