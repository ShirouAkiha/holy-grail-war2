# Holy Grail War Time Limit Recovery & Servant Level Limit System

Recover and expose the Holy Grail War active time limit controls in the Admin Hub (in both the Rules customizer and War Proclamation announcement setup), and implement a configurable Servant level limit with entry validation, progressive warning notifications, and automatic disqualification upon reaching +5 levels over the threshold.

## User Decisions & Confirmed Architecture

> [!IMPORTANT]
> The following parameters were confirmed by the user in Phase 1:

- **Confirmed Decision 1 (Time Limit Controls Location):** Active war time limit controls must appear in **both** the Rules Customizer (`admin_tab_war_rules`) and the War Proclamation Announcement Setup (`admin_tab_war_announce`).
- **Confirmed Decision 2 (Level Limit Evaluation & +5 Buffer):**
  - **Entry:** If a Servant's level is greater than the war's `maxServantLevel`, the Master cannot enter the war.
  - **Warning Buffer:** If a Servant increases level after joining and exceeds the cap by 1–4 levels (`level > maxLevel` and `level < maxLevel + 5`), the Master receives a prominent warning embed that reaching `maxLevel + 5` will result in disqualification.
  - **Disqualification Threshold:** Once the Servant's level reaches `maxLevel + 5` (at least 5 levels over the threshold), they are automatically disqualified from the Holy Grail War.
- **Confirmed Decision 3 (Disqualification Handling):** Upon disqualification, the Master immediately returns to **Safe Mode** with fully restored Servant HP and 3 Command Seals restored via `demobilizeMasterToSafeMode`.

---

## 1. Overview & Core Features

### 1. War Time Limit Recovery
- **Root Cause:** The underlying engine already has `warDurationMinutes`, `deadlineTimestamp`, and the corruption countdown mechanism in `src/engine/grailwar.ts` and `src/engine/warRecruitmentService.ts`. However, the Admin Hub's UI (`createRuleSelectMenu` and button rows) lacked the select menu options, buttons, and display indicators to view and set this time limit.
- **Fix:**
  - Add War Time Limit select options (30m, 1h, 2h, 6h, 12h, 24h, 3d, 7d, Endless/None) to the Rules select menu and custom modal input in `admin_tab_war_rules`.
  - Add active war duration preset selection to `admin_tab_war_announce` so when an admin broadcasts a proclamation, they can pre-set the active war duration alongside the recruitment timer.
  - Display the current active war deadline and time limit clearly on both the War Hub Dashboard and Rules Customizer.

### 2. Servant Level Limit System
- **Configuration:** Add `maxServantLevel?: number` to `WarRules` (options: No Limit, Lv.20, Lv.40, Lv.50, Lv.60, Lv.70, Lv.80, Lv.90, Lv.100, and Custom via modal).
- **Entry Gatekeeper:** In `attemptJoinWar`, `/summon ritual`, and war recruitment inscription, verify that `servant.level <= war.rules.maxServantLevel`. Block entry with an informative explanation if exceeded.
- **Progression Monitoring:**
  - When a Servant gains levels (via ember feeding in `/servant` or battle EXP in `/duel`), check their level against the active war's `maxServantLevel`.
  - **Warning Embed:** If `servant.level > maxServantLevel` and `servant.level < maxServantLevel + 5`, display an alert embed stating they have exceeded the threshold and will be disqualified if they gain levels up to `maxServantLevel + 5`.
  - **Disqualification:** If `servant.level >= maxServantLevel + 5`, immediately disqualify the participant (`isAlive = false`, `eliminatedReason = 'level_limit_disqualified'`), revert them to Safe Mode with full recovery via `demobilizeMasterToSafeMode`, and log the event in the war chronicle.

---

## 2. Technical Architecture & Component Changes

```
┌─────────────────────────────────────────────────────────────┐
│                          Admin Hub                          │
│                                                             │
│  admin_tab_war_rules & admin_tab_war_announce:              │
│    ├── War Time Limit Options: 30m, 1h, 2h, 6h, 12h, 24h,   │
│    │     3d, 7d, Endless (via select menu / buttons / modal)│
│    │                                                        │
│    └── Level Limit Options: No Limit, Lv.20, Lv.40, Lv.50,  │
│          Lv.60, Lv.70, Lv.80, Lv.90, Lv.100, Custom Modal   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      Holy Grail War Engine                   │
│                                                             │
│  WarRules:                                                  │
│    • warDurationMinutes?: number (time limit)               │
│    • maxServantLevel?: number (level limit)                 │
│                                                             │
│  attemptJoinWar():                                          │
│    • Enforce servant.level <= maxServantLevel               │
│                                                             │
│  checkAndEnforceWarLevelLimits():                           │
│    • If level >= maxServantLevel + 5:                       │
│        Disqualify participant -> demobilizeMasterToSafeMode │
│    • Else if level > maxServantLevel:                       │
│        Trigger Warning Embed (+5 limit alert)               │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Level-Up Touchpoints                     │
│                                                             │
│  • src/commands/servant.ts (feed_ce / ember enhancement)    │
│  • src/commands/duel.ts (battle EXP level-up sync)          │
└─────────────────────────────────────────────────────────────┘
```

### File-by-File Changes

1. **`src/types.ts`:**
   - In `WarRules`, add `maxServantLevel?: number;`.
   - In `WarMasterParticipant`, add `servantLevelAtEntry?: number;`.
2. **`src/engine/grailwar.ts`:**
   - In `updateWarRules`: Handle `ruleChanges.maxServantLevel` and `ruleChanges.warDurationMinutes`.
   - In `attemptJoinWar`: Check `targetWar.rules?.maxServantLevel`. If `(servant.level || 1) > targetWar.rules.maxServantLevel`, reject entry.
   - Add `checkAndEnforceWarLevelLimits(war, master, servant)`:
     - Detects level changes for active participants.
     - Triggers warning embed if `level > maxServantLevel && level < maxServantLevel + 5`.
     - Disqualifies Master if `level >= maxServantLevel + 5`, sets `p.isAlive = false`, and calls `demobilizeMasterToSafeMode(master.discordId, war.guildId, master.username)`.
3. **`src/commands/admin.ts`:**
   - In `createRuleSelectMenu`:
     - Add `war_timer_*` options (30m, 1h, 2h, 6h, 12h, 24h, 3d, 7d, endless).
     - Add `lvl_limit_*` options (none, 20, 40, 50, 60, 70, 80, 90, 100, custom).
   - In `buildAdminHub`:
     - Display current Active War Time Limit and Level Limit in `war` and `war_rules` embed descriptions.
     - In `war_announce`, add buttons for pre-configuring active war time limit and level limit.
   - In `handleAdminInteraction`:
     - Handle `admin_war_rule_select` for `war_timer_*` and `lvl_limit_*`.
     - Handle modal inputs `admin_modal_war_custom_timer` and `admin_modal_war_custom_level`.
4. **`src/commands/servant.ts`:**
   - In category `feed_ce` / level enhancement after feeding embers, invoke `checkAndEnforceWarLevelLimits` and attach the warning or disqualification embed if applicable.
5. **`src/commands/duel.ts`:**
   - In `finalizeDuelRewardsAndSync`, check level-up outcomes against active war level limits.

---

## 3. Verification Plan

### Automated Type & Build Checks
- Run `npx tsc --noEmit` to verify zero TypeScript errors.

### Functional Verification
- Verify time limit updates set `war.deadlineTimestamp` and reflect properly in Admin Hub embeds.
- Verify entry gatekeeper blocks Servants above `maxServantLevel`.
- Verify level-up triggers the warning embed when `level > maxServantLevel` and `< maxServantLevel + 5`.
- Verify reaching `maxServantLevel + 5` immediately disqualifies the participant and returns them to Safe Mode with full stats.
