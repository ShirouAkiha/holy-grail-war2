# Holy Grail War: Registered Servant Lock, Reset Warnings & Post-Combat HP Recovery

Enforce registered Servant integrity during Holy Grail War duels, verify post-battle HP regeneration and healing rituals, and implement a confirmation modal with an ephemeral warning when resetting or de-leveling a Servant actively registered in an ongoing tournament.

> [!IMPORTANT]
> **Confirmed User Decisions**:
> - **Registered Servant Lock in War Duels**: In Holy Grail War duels, only the registered Servant (`participant.servantId`) is deployed in combat, even if the Master has set a different Servant as active globally or in other servers. Free battles and raids remain unrestricted.
> - **Reset Warning Modal**: If a Master attempts to reset/de-level a Servant that is actively registered in any ongoing Holy Grail War, display an ephemeral warning embed with explicit `[Yes, Reset]` and `[Cancel]` buttons. If confirmed, proceed with the reset.
> - **HP Recovery Preserved**: Ensure post-battle HP persistence and the recovery mechanics (baseline passive recovery, Mage Sanctuary acceleration, and `/heal` ritual command) are fully functional.

---

## 1. Overview & Core Concept

Currently, when a Master initiates or joins a Holy Grail War duel (`/duel`), the system selects the Master's current global `activeServantId`. If a Master contracts Artoria for the war, but subsequently switches their active companion to Gilgamesh via `/servant switch`, Gilgamesh enters the war tournament arena instead of Artoria.

Additionally:
1. When de-leveling (`servant_act_reclaim_exp`) or resetting stats, there is no warning if the Servant is currently fighting in an ongoing tournament.
2. In Holy Grail War, HP damage persists across tournament duels and requires recovery via time-based regeneration and healing rituals.

This update closes the loophole by locking Holy Grail War duels to the participant's registered Servant, adding a confirmation warning when resetting an active war Servant, and validating end-to-end post-battle HP recovery.

---

## 2. User Experience & Visual Design

### Flow A: Holy Grail War Duel with Locked Registered Servant
- Master has **Artoria Pendragon** registered in Server A's Holy Grail War.
- Master switches active companion to **Gilgamesh** for Raids and Free Battles.
- When running `/duel` (War Mode) in Server A:
  - The combat engine retrieves **Artoria Pendragon** via `participant.servantId`.
  - The battle introduction and card canvas display **Artoria** with her persisted War HP bar and active Command Seals.
  - A subtle combat tag indicates: `⚔️ Registered War Champion: Artoria Pendragon`.
  - When running `/duel mode:free` or `/raid`, **Gilgamesh** is deployed as normal.

### Flow B: Reset / De-Level Confirmation Warning
- In `/servant`, Master clicks **⚗️ Reclaim EXP** or **Reset Stats** on a Servant currently registered in an ongoing tournament.
- Instead of immediately stripping the Servant's levels, a private ephemeral warning is shown:
  ```
  ⚠️ HOLY GRAIL WAR REGISTRATION WARNING
  Artoria Pendragon is currently registered as your champion in an active Holy Grail War!
  
  • De-leveling or resetting this Servant will lower their combat parameters during war duels.
  • Your tournament registration and current war damage will remain unchanged.
  
  Are you sure you want to proceed?
  [ ⚗️ Yes, Reset & Reclaim ]   [ Cancel ]
  ```
- Clicking **Cancel** leaves the Servant untouched.
- Clicking **Yes, Reset & Reclaim** executes the respec and converts the EXP into embers.

### Flow C: Post-Combat HP Recovery
- After a tournament duel or ambush, the surviving combatant's remaining HP is recorded in `participant.currentHp`, `baseHpAtDamage`, and `lastDamageTime`.
- **Natural Recovery**: Servants steadily reconstitute their spiritual core over time.
- **Mage Sanctuary ('ward')**: Accelerates passive regeneration to full recovery within 5 minutes.
- **Healing Ritual (`/heal`)**: Restores +40% Max HP instantly (5-minute cooldown).
- **Free Battles**: Start and end with 100% full health and 3 Command Seals with zero war attrition.

---

## 3. Key Product Decisions & Trade-Offs

1. **Strict Registered Servant Lookup in Tournament Duels**:
   - *Chosen*: In `duel.ts` and `attack.ts`, query `challengerMaster.servants.find(s => s.id === challengerParticipant.servantId)`. If not found (e.g. edge-case deletion), gracefully fall back to active servant snapshot.
   - *Why*: Guarantees tournament integrity without preventing players from enjoying other Servants in free sparring and raids.
2. **Ephemeral Warning Embed Over Hard Lock for Resets**:
   - *Chosen*: Warn with `[Yes]` / `[No]` buttons rather than blocking resets completely.
   - *Why*: Respects player agency across servers where the Master might be in Safe Mode, while preventing accidental stat drops during tournament season.
3. **Recovery System Architecture**:
   - *Chosen*: Maintain both passive time-based regeneration and active `/heal` rituals, ensuring `lastDamageTime` and `calculateCurrentHp` are properly evaluated at duel entry and exit.
   - *Why*: Preserves tactical Holy Grail War attrition while giving players clear paths to recover between clashes.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Servant Selection Routing                       │
└────────────────────────────────────────────────────────────────────────┘
                                    │
               ┌────────────────────┴────────────────────┐
               ▼                                         ▼
   ┌───────────────────────┐                 ┌───────────────────────┐
   │    Holy Grail War     │                 │   Free Sparring /     │
   │  (/duel in War Mode)  │                 │   Raids (/raid)       │
   └───────────┬───────────┘                 └───────────┬───────────┘
               │                                         │
               ▼                                         ▼
   Query `participant.servantId`             Query `master.activeServantId`
   from current server War Session           from global MasterProfile
               │                                         │
               ▼                                         ▼
   Deploy Registered Champion                Deploy Active Companion
   (e.g., Artoria Pendragon)                 (e.g., Gilgamesh)
   - Persisted War HP bar                    - Full HP / Friendly sparring
   - Active Command Seals                    - 3 Command Seals restored
```

### Components & Handlers to Update

1. **`src/commands/duel.ts`**:
   - When resolving `challengerServant` in tournament mode (`!isFreeBattle` and `isEnrolledAndAliveInWar`):
     - Select Servant matching `challengerParticipant.servantId`.
   - When resolving `opponentServant`, `allyServant`, and `opponent2Servant` in tournament mode:
     - Select Servant matching each participant's `servantId`.
   - Ensure post-duel HP update persists to `participant.currentHp` and `participant.lastDamageTime` using server-scoped `preferredGuildId`.
2. **`src/commands/attack.ts`**:
   - Ensure ambush strikes deploy the attacker's registered war servant (`attackerPart.servantId`).
3. **`src/commands/servant.ts`**:
   - In `servant_act_reclaim_exp` and `servant_act_reset_stats`:
     - Check if `targetServant.id` matches any living participant's `servantId` across active war sessions (`getAllWarSessions()`).
     - If so, display the warning embed with confirmation buttons (`servant_confirm_reclaim_exp:<servantId>` and `servant_cancel_reset:<servantId>`).
     - Handle confirmation button clicks to safely proceed or dismiss.
4. **`src/engine/grailwar.ts`**:
   - Verify `calculateCurrentHp(participant, now)` handles both baseline passive regeneration and Mage Sanctuary acceleration seamlessly.
   - Ensure `recordDuelOutcome` updates `baseHpAtDamage` and `lastDamageTime` consistently for both human and AI duels.
