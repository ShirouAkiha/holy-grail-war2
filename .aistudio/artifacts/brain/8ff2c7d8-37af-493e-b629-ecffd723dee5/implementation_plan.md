# Holy Grail War Mode Battle Initiation & Mode Lifecycle Fix

Fix the Holy Grail War tournament battle initiation so that 1v1 Holy Grail War duels (with normal rival selection or direct challenges) initiate authentic Holy Grail War battles instead of Free Battles, ensure tournament participants automatically shift to War Mode upon war ignition, and enforce permanent war termination if a participant manually changes their mode to Safe Mode from their profile.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The implementation strictly aligns with your exact rules for the Holy Grail War tournament lifecycle:

- **Automatic Shift on War Start**: When the Holy Grail War ignites from registration (or admin launch), all chosen participants automatically shift from Safe Mode to Holy Grail War Mode (`environmentMode = 'war'`) with full HP and active Command Seals.
- **Manual Mode Toggle Termination**: If an active, living participant manually toggles their mode to Safe Mode from their `/profile`, they are immediately terminated/eliminated from the war (`isAlive = false`, `eliminatedReason = 'forfeited'`), their tournament slot is closed, and they cannot rejoin the ongoing war until the next tournament.
- **Holy Grail War Battle Initiation Fix**: When an active participant runs `/duel mode:1v1` (with normal opponent selection or target mention), the duel engine will properly resolve their server's active tournament session (`findActiveWarSessionForMaster`), match against living rival participants, and initiate a real Holy Grail War battle with Command Seal evacuation stakes, rather than falling back to Free Battle.

---

### 1. Root Cause Analysis: Why War Battles Were Defaulting to Free Battle

1. **Unscoped Guild War Lookup**:
   - In `src/commands/duel.ts` (lines 4129, 7191, 8241), `getOrInitWarSession(challengerMaster)` was called without the Discord server's `guildId`.
   - The tournament started by the admin was partitioned under the server's Discord guild ID, whereas `getOrInitWarSession(challengerMaster)` looked inside `'default-fuyuki-guild'`, where the participant roster was empty.
2. **Safe Mode Downgrade Cascade**:
   - Because the participant wasn't found in the empty default guild session, `isChallengerInWar` evaluated to `false`.
   - In `duel.ts` (line 4150), `isChallengerInSafeMode` (`!isChallengerInWar`) was forced to `true`, causing `isFreeBattle = true`.
   - As a result, even when selecting `mode: 1v1 (Holy Grail War)`, the duel was treated as a casual Free Battle, ending with `🕊️ FREE BATTLE CONCLUDED`.
3. **Profile Session Disconnect**:
   - In `src/commands/profile.ts` (line 453), `getOrInitWarSession(master)` similarly lacked guild context, causing `/profile` to show `Mode: Safe 🛡️ (Active)` instead of reflecting active Holy Grail War participation.

---

### 2. Proposed Changes & Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Admin / Recruitment Ignition                   │
│   • Admin announces recruitment embed in channel            │
│   • Timer expires / Force start ignites tournament          │
│   • All chosen participants set to environmentMode = 'war'  │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌──────────────────────────────┐┌──────────────────────────────┐
│  Participant in /profile     ││  Participant in /duel        │
│ • Displays War Mode & seals  ││ • Runs /duel mode:1v1        │
│ • If clicks "Quit to Safe":  ││ • Resolves active guild war  │
│   → Forfeits war immediately ││ • Matches living rivals      │
│   → isAlive = false          ││ • Initiates Holy Grail Duel  │
│   → Cannot rejoin active war ││ • Real Command Seal stakes   │
└──────────────────────────────┘└──────────────────────────────┘
```

#### A. Duel Engine Session Resolution (`src/commands/duel.ts`)
- Replace unqualified `getOrInitWarSession(challengerMaster)` with:
  `findActiveWarSessionForMaster(challengerMaster.discordId, challengerMaster, interaction.guildId || undefined)`
- Apply the same fix in:
  - Slash command execution (`execute`)
  - Multi-master helper routines (lines 6334, 6509, 6941)
  - Interactive duel start & conclusion (`startInteractiveDuel` at line 7191)
  - Prefix duel handling (`handlePrefixDuel` at line 8241)
- In `isFreeBattle` determination:
  - If `rawMode === '1v1'` and challenger is an enrolled living participant, auto-synchronize `challengerMaster.environmentMode = 'war'` and ensure `isFreeBattle = false`.
  - Normal opponent selection (Branch 2) correctly draws from `livingRivalParticipants` in the tournament and launches with `isFreeBattle = false`.

#### B. Profile & Manual Mode Toggle (`src/commands/profile.ts` & `src/index.ts`)
- In `src/commands/profile.ts` (line 453):
  - Resolve war session via `findActiveWarSessionForMaster(interaction.user.id, master, interaction.guildId || undefined)` so enrolled participants immediately see their active War status, Command Seals, and Bounded Fields.
- In `buildProfileButtons`:
  - Clearly label the toggle button when active in war: `🏳️ Quit War (Forfeit to Safe Mode)`.
- In `src/index.ts` (`profile_toggle_mode` handler at line 1711):
  - When an active, living participant clicks the toggle to change to Safe Mode, execute `forfeitWar(master, war)`:
    - Sets `master.environmentMode = 'safe'`
    - Sets `participant.isAlive = false` and `participant.eliminatedReason = 'forfeited'`
    - Broadcasts the forfeit event to the Holy Grail War event log
    - Saves master and war state to disk
    - Prevents rejoining the ongoing tournament until an admin restarts or resets the war.

#### C. Recruitment Ignition Guarantee (`src/engine/warRecruitmentService.ts`)
- Verify that during `igniteWarFromRecruitment`, all chosen applicants have:
  - `master.environmentMode = 'war'`
  - `master.guildId = targetGuildId`
  - Current Servant HP fully refreshed and starting Command Seals inscribed.

---

### 3. Verification Plan

1. **Automated Verification**:
   - Run `npx tsc --noEmit` and `lint_applet` to ensure zero compilation or typing errors across `duel.ts`, `profile.ts`, and `warRecruitmentService.ts`.
2. **Simulation Tests**:
   - Simulate recruitment ignition with 2 Masters in a guild: verify both masters have `environmentMode === 'war'` and are registered in `warSession.participants`.
   - Simulate Master A invoking `/duel mode:1v1` with normal opponent selection: verify `isFreeBattle === false`, Master B is selected as rival, and combat conclusion enters the Command Seal evacuation branch (`⚠️ CRITICAL DEFEAT — COMMAND SEAL DECISION`) rather than `🕊️ FREE BATTLE CONCLUDED`.
   - Simulate Master A clicking `profile_toggle_mode` from `/profile`: verify Master A is transitioned to `safe` mode and marked `isAlive = false (forfeited)` in the tournament session.
