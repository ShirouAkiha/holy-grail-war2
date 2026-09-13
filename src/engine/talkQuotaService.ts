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
  if (cfg.activeProvider === 'gemini' && !!cfg.geminiKey) return true;
  if (cfg.activeProvider === 'openrouter' && !!cfg.openrouterKey) return true;
  if (cfg.activeProvider === 'nanogpt' && !!cfg.nanogptKey) return true;
  if (cfg.activeProvider === 'custom' && !!cfg.customKey) return true;
  return false;
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
