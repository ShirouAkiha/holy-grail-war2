# Raid Instant Turn Transition for Fallen Servants

Fix the raid battle management engine so that when a Servant in positions 1, 2, or 3 falls in combat (during the Boss phase, Noble Phantasm strikes, or affliction DoT ticks), the active turn immediately and seamlessly transitions to the next living ally with zero delay, eliminating the 2-minute auto-play freeze.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were confirmed during Phase 1 clarification:
> - **Instant Turn Transition:** When a Servant falls, their turn is bypassed immediately with zero delay, handing initiative to the next living ally.
> - **Canvas Integrity:** Fallen Servants remain visually visible on the battlefield canvas in their `FALLEN` state while combat controls and turn prompts shift to living allies.

---

## 1. Root Cause & Technical Diagnosis

In `src/commands/raid.ts`:
1. **Unchecked Active Index Post-Boss Phase:**
   When all players finish their card actions in a round, `advanceToNextPlayer()` resets `battleState.activeMasterIndex` to `0` (or whichever participant was living before the Boss phase).
2. **Death During Boss Action / Curse Ticks:**
   `executeBossTurn(battleState)` executes boss single-target attacks, AoE Noble Phantasms, and end-of-round Curse burn damage. When the boss defeats the servant at `battleState.activeMasterIndex` (e.g., Archetype: Earth in position 1):
   - The servant's status is set to `isDead = true` and `currentHp = 0`.
   - The engine increments `battleState.round++`.
   - The engine immediately calls `renderAndPostTurn()`.
3. **Stuck Turn Timer & Paralyzed Controls:**
   Because `battleState.activeMasterIndex` and `currentActiveParticipant` were not updated to the next living servant:
   - `buildTurnContent` outputs `<@User>'s Turn! (Fallen Servant)`.
   - `buildBattleButtons` disables all card buttons, skill buttons, and `Auto/Pass` because `active.isDead === true`.
   - `renderAndPostTurn` starts a 120,000ms (2-minute) timer via `resetTurnTimer()`.
   - Living allies cannot click any buttons because the engine checks `i.user.id !== active.userId`.
   - The entire raid remains completely frozen until the 2-minute auto-play timer expires, which was the only place calling `ensureActiveParticipantIsAlive()`.
4. **Index Reset Flaw in `ensureActiveParticipantIsAlive`:**
   The existing helper uses `participants.findIndex(p => !p.isDead)`. When a servant in position 2 or 3 died mid-round, this searched from index 0 instead of advancing forward in cyclic turn order.

---

## 2. Architecture & Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    Raid Turn Cycle Flow                      │
└──────────────────────────────────────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
     [ Player Turn Ends ]             [ Boss Phase Ends ]
               │                               │
               ▼                               ▼
    Advance to Next Player            Check Living Servants
               │                               │
       Is Next Unit Dead?             Was Active Unit Slain?
      ┌────────┴────────┐             ┌────────┴────────┐
     Yes                No           Yes                No
      │                 │             │                 │
      ▼                 ▼             ▼                 ▼
Advance forward     Assign Turn   Find First Living  Assign Turn
to Living Ally                    Starting at Idx 0
      │                 │             │                 │
      └────────┬────────┘             └────────┬────────┘
               │                               │
               └───────────────┬───────────────┘
                               ▼
                 [ ensureActiveParticipantAlive ]
                               │
                               ▼
                    [ renderAndPostTurn ]
          • Validates active servant is ALIVE
          • Renders Fallen banner on dead units
          • Generates cards/skills for living ally
          • Resets 2-min timer for active ally
```

---

## 3. Implementation Steps

### Step 1: Upgrade `ensureActiveParticipantIsAlive` Algorithm
- In `src/commands/raid.ts`, update `ensureActiveParticipantIsAlive` to inspect `curr.isDead || (curr.currentHp || 0) <= 0`.
- If the current participant is dead, scan forward cyclically: `nextIdx = (battleState.activeMasterIndex + 1) % participants.length` until finding an ally where `!p.isDead && (p.currentHp || 0) > 0`.
- Update both `battleState.activeMasterIndex` and `currentActiveParticipant` atomically.

### Step 2: Immediate Sanitization in `renderAndPostTurn`
- Call `ensureActiveParticipantIsAlive()` at the very beginning of `renderAndPostTurn()`.
- If `currentActiveParticipant.isDead`, it will automatically and instantaneously advance to the next living ally before constructing any Discord buttons, message contents, or starting the turn timer.

### Step 3: Round-Start Reset After `executeBossTurn`
- In `executeAttackSequence()` (lines ~2170–2215):
  - After `executeBossTurn(battleState)` completes, check `if (!anyAlive)` for defeat.
  - For the new round (`battleState.round++`), find the first living participant starting from index 0:
    ```ts
    const firstLivingIdx = battleState.participants.findIndex(p => !p.isDead && (p.currentHp || 0) > 0);
    if (firstLivingIdx !== -1) {
      battleState.activeMasterIndex = firstLivingIdx;
      currentActiveParticipant = battleState.participants[firstLivingIdx];
    }
    ```
  - This ensures that if the Servant in position 1 (or position 2) was killed by the Boss, the new round immediately starts on the turn of the first living Servant (e.g. Van Gogh in position 2, or Lucernalia in position 3).

### Step 4: Mid-Round Death & `advanceToNextPlayer` Robustness
- Verify `advanceToNextPlayer()` properly handles cases where multiple Servants have died, ensuring it advances only through living units and correctly flags round completion.
- Ensure `raid_pass_turn` (`Auto/Pass`) and `raid_flee` cannot deadlock if triggered by living allies.

---

## 4. Verification Plan

1. **Static Analysis & Typecheck:**
   - Run `npx tsc --noEmit` to ensure type safety.
2. **Boss Turn Kill Simulation:**
   - Verify that when the Boss slays the Servant at position 1 (or 2 or 3), `battleState.activeMasterIndex` immediately jumps to the next living ally.
   - Verify that `renderAndPostTurn()` outputs the living ally's name, enables their action cards, and starts their timer.
   - Confirm fallen Servants remain visibly marked as `FALLEN` on the rendered battlefield canvas.
