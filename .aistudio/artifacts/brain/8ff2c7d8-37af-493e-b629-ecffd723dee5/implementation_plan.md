# Raid Systems & Dark Sakura Climax Bug Audit & Fix Plan

Comprehensive audit and hardening of the Dark Sakura Raid engine (`darkSakuraEngine.ts`), battle calculations, state management, and reward persistence (`raid.ts`).

## User Review & Critical Decisions

> [!IMPORTANT]
> The audit focuses on eliminating softlocks, state desynchronizations, missing error traps, and inventory race conditions during Dark Sakura and standard raid encounters.

- **Confirmed Decision 1**: Focus audit primarily on Dark Sakura Raid climax choice interactions and reward/karma persistence.
- **Confirmed Decision 2**: Perform a full codebase sweep of `darkSakuraEngine.ts` and `raid.ts` to harden edge cases (overkill handling, non-participant button clicks, canvas rendering fallback, and state synchronization).

---

## 1. Overview & Core Concept

- **Goal**: Ensure 100% crash-proof, deterministic, and fair execution of raid encounters—especially the multi-Master Dark Sakura Climax sequence (`[🌸 SPARE]` vs `[⚔️ EXECUTE]`).
- **Scope**: Hardening interaction collectors, participant validation, canvas error fallbacks, concurrent database saves, and turn resolution edge cases.

---

## 2. Identified Bugs & Hardening Audit Items

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    RAID ENGINE AUDIT & BUG LIST                         │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. Dark Sakura Climax Collector Validation & Non-Participant Filters   │
│    • Ensure only registered raid participants can click Spare/Execute.  │
│    • Prevent duplicate choice submission or button spamming.            │
│                                                                         │
│ 2. Asynchronous Master Save & Inventory Race Condition Protection       │
│    • Guard `master.craftEssences` array initialization across saves.   │
│    • Ensure atomic karma and reward updates for multi-participant raids.│
│                                                                         │
│ 3. Canvas VN Dialogue Render Failures Fallback                          │
│    • Wrap `renderDarkSakuraVNDialogueImage` with a fail-safe fallback.  │
│    • Ensure climax reports and rewards deliver even if asset loading   │
│      times out.                                                         │
│                                                                         │
│ 4. Boss Overkill & Post-Mortem Enemy Action Elimination                 │
│    • Cancel boss counter-attacks and status applications immediately    │
│      when boss HP reaches 0 during mid-turn bursts.                     │
│                                                                         │
│ 5. Collector Timeout & Message Cleanup Resilience                        │
│    • Gracefully handle deleted battle messages on climax timer expiry.  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Key Technical Fixes & Implementation Strategy

### 1. Dark Sakura Climax Interaction Hardening
- **Interaction Filtering**: Validate `i.user.id` against `battleState.participants.map(p => p.userId)`.
- **Ephemeral Feedback**: Non-participants clicking climax buttons receive a clear ephemeral message (`"❌ You are not an active Master in this Dark Sakura raid battle."`).
- **State Lock**: Mark user choice immediately upon receipt to disable double-clicking and update button labels dynamically.

### 2. Multi-Participant Reward Save Serialization
- **Array Safety**: Ensure `master.craftEssences = master.craftEssences || []` before any `push(...)` call across all outcome branches (`killed`, `spared_mercy`, `spared_betrayed`).
- **Sequential Profile Persistence**: Process participant rewards sequentially with individual try/catch blocks so one failing user profile save does not cancel rewards for other participants.

### 3. Canvas & Network Resilience
- **VN Dialogue Card Render Safeguard**: Wrap `renderDarkSakuraVNDialogueImage` in a robust try/catch block. If CDN image fetching fails or times out, degrade gracefully by attaching standard embed artwork without halting the climax sequence.

### 4. Battle Loop & Overkill Guard
- **Mid-Turn Boss Death**: In `raid.ts`, check `boss.currentHp <= 0` immediately after every Servant attack action before executing boss skill counter-flurries or Noble Phantasm triggers.

---

## 4. Technical Verification Strategy

1. **Static Analysis & Linting**: Run `lint_applet` and `npx tsc --noEmit` to verify type safety.
2. **Climax Choice Simulation**: Test solo and multi-participant Dark Sakura raid completion for both `Spare` and `Execute` choices.
3. **Reward Audit**: Confirm SQ, EXP Embers, and Karma records persist cleanly without console errors.
