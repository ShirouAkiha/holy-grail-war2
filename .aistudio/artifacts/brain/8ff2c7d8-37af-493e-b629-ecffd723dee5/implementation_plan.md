# Holy Grail War: Servant Registration Decoupling & Active Partner Isolation

Ensure the Holy Grail War strictly isolates registered tournament champions from everyday Chaldea active Servants, prevent active Servant switching from polluting or enrolling users into the war board, preserve the official Church announcement registration flow, and enforce registered Servant integrity in war duels.

> [!IMPORTANT]
> **Confirmed User Decisions & Directives**:
> - **War Registration Flow**: Holy Grail War registration happens via the official announcement embed sent when an admin starts a war. Clicking the recruitment button allows Magi to inscribe their soul and select their tournament champion.
> - **Active Servant Scope**: Setting an active Servant (via `/switch` or `/servant` "Set Active") applies **strictly to Free Battles and Raids**. It must never alter an existing war participant's registered Servant, never auto-enroll safe users into a war, and never trigger war summon logs.
> - **Holy Grail War Board Visibility**: Masters and their Servants appear on the Holy Grail War board (`/grailwar`) **only after explicitly joining War Mode** in that specific server.
> - **War Duel Combatant**: When fighting in a Holy Grail War duel, **only the registered Servant is deployed**, even if the Master has a completely different Servant set as their active Chaldea partner.
> - **Reset Warning Modal**: If a Master attempts to reset a Servant that is actively registered in an ongoing war, show a discreet ephemeral warning embed with explicit `[Yes, Reset]` and `[Cancel]` options.

---

## 1. Overview & Core Concept

Currently, whenever a Master changes their active Servant (via `/switch`, `/servant` "Set Active", or summoning), helper functions like `getOrInitWarSession(master)` inadvertently overwrite `participant.servantId` on the active Holy Grail War participant record. Furthermore, if a player is in War Mode or the guild defaults, calling `getOrInitWarSession` automatically enrolls them into the war, broadcasts an announcement log (`🕯️ A new Master contracted with a Heroic Spirit in the shadows!`), and places their name on the war board.

This plan removes all side effects from active Servant switching so that `master.activeServantId` only affects peacetime features (Free Battles, Raids, and dialogue), while Holy Grail War registration remains locked to the Servant inscribed during the official recruitment phase.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Changing Active Servant (Peacetime)**:
   - User runs `/switch` or selects "Set Active" in `/servant`.
   - The embed updates cleanly: `👑 Active Servant Changed to [Servant Name]! (Active for Free Battles & Raids)`.
   - No Holy Grail War participant data is modified, no war announcement logs are broadcast, and no un-enrolled players are pushed to the war board.

2. **Registering for a Holy Grail War**:
   - Admin initiates a war or recruitment call (`/admin war start`).
   - The Church broadcasts the recruitment embed: `🕯️ An Overseer has proclaimed the commencement of a Holy Grail War!` with button `⚔️ Inscribe Command Seals`.
   - Clicking the button lets the user pick their champion Servant for the war.
   - When the recruitment period ends or the war ignites, the selected champion is permanently registered in `participant.servantId` for that tournament cycle.

3. **Fighting in a Duel**:
   - In **Free Battles** (`/duel mode:free` or `!duel free`): The system deploys the Master's current `master.activeServantId` (or chosen roster servant).
   - In **Holy Grail War Duels** (`/duel mode:war` or `!duel`): The system strictly deploys the Master's registered tournament Servant (`participant.servantId`), preserving all war HP damage and leyline healing.

4. **Resetting a Registered Servant**:
   - If a Master resets/delevels a Servant currently fighting in an active war, an ephemeral warning informs them: `⚠️ Warning: This Servant is actively registered in an ongoing Holy Grail War in this server.` with `[Confirm Reset]` and `[Cancel]` buttons.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Pure Read-Only War Session Inspection in Peacetime Commands**
  - *Chosen Approach*: Disconnect `getOrInitWarSession(master)` from modifying `existing.servantId` or creating participant records during passive checks. Participant creation is restricted to explicit war registration (`igniteWarFromRecruitment` and `attemptJoinWar`).
  - *Why*: Prevents passive commands (like `/switch`, `/servant`, `/daily`, `/summon`) from mutating war state or spamming tournament logs.
- **Decision 2: Clear Separation of Active Servant vs War Servant in Types & Logic**
  - *Chosen Approach*: `master.activeServantId` governs Chaldea peacetime combat (Free Battles, Raids, Boasting, Dialogue). `warSession.participants[userId].servantId` strictly governs tournament combat.
  - *Why*: Matches user intent directly—Masters can freely use and test multiple Servants in free battles and raids without compromising tournament integrity.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Master Action Router                           │
└───────────────┬─────────────────────────────────────────┬───────────────┘
                │                                         │
     [Peacetime Action]                         [War Tournament Action]
  (/switch, /servant, /summon)               (/admin war start, war duel)
                │                                         │
                ▼                                         ▼
   Updates `master.activeServantId`            Interacts with War Session
   Scope: Free Battles & Raids only            - Church Inscription Embed
   NO side-effects on war participants         - `participant.servantId` locked
   NO war log announcements                    - Deployed in War Duels only
                │                                         │
                ▼                                         ▼
   ┌──────────────────────────┐               ┌──────────────────────────┐
   │    Free Battle / Raid    │               │   Holy Grail War Duel    │
   │  Uses `activeServantId`  │               │ Uses `servantId` from    │
   │  Unrestricted Roster     │               │ War Participant Record   │
   └──────────────────────────┘               └──────────────────────────┘
```

### Verification & Testing Plan

1. **Automated Unit Tests**:
   - Verify changing `activeServantId` via `/switch` does not mutate `war.participants[id].servantId`.
   - Verify summoning new servants does not trigger war enrollment logs or replace war champions.
   - Verify war duels select `participant.servantId` even when `activeServantId` points to another Servant.
   - Verify Free Battles and Raids correctly use `activeServantId`.
2. **Build Verification**:
   - Run compilation via `compile_applet` to ensure zero TypeScript errors.
