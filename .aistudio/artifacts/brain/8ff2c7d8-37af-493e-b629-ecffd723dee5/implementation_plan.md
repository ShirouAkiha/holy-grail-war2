# Holy Grail War Safe Mode Reversion & Duel Command Seal Cut-In PFP Fix

Automatically transition Masters back to Safe Mode with fully restored Servant HP and 3 Command Seals upon death in the Holy Grail War and when a war reaches its conclusion, and fix the Command Seal visual novel canvas dialogue cut-in in duels to display the user's live Discord avatar.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed by the user in Phase 1:

- **Confirmed Decision 1 (Safe Mode on Death):** When a Master is killed or executed in the Holy Grail War, they immediately revert to Safe Mode (`environmentMode = 'safe'`, `guildEnvironmentModes[guildId] = 'safe'`), their contracted Servant is restored to full HP, and their Command Seals are reset to 3.
- **Confirmed Decision 2 (Safe Mode on War Conclusion):** When a Holy Grail War concludes (whether a victor is crowned, all fall, corruption deadline expires, or an admin terminates the war), every participant across the server is automatically transitioned back to Safe Mode with full Servant HP and 3 Command Seals restored.
- **Confirmed Decision 3 (Command Seal Cut-In Avatar Priority):** For the Command Seal visual novel canvas dialogue cut-in in duels, the avatar resolution prioritizes the user's live Discord avatar (`i.user.displayAvatarURL()`), falling back to the stored Master profile avatar.

---

## 1. Overview & Core Concept

### What It Does
1. **Fallen Master Safe Mode Transition:**
   - Detects when a Master is eliminated in combat (`resolveDuelEnd`, `recordDuelOutcome`, or environmental war events).
   - Reverts their status in the guild and profile to `'safe'`.
   - Restores their Servant to full HP and replenishes their Command Seals to 3, allowing them to participate in casual Free Battles and normal bot features without penalty.
2. **War Conclusion Mass Safe Mode Reversion:**
   - In `evaluateWarState` (and all war conclusion handlers), when `targetWar.status` transitions to `'concluded'`:
   - Iterates through all registered war participants (winner, survivors, and fallen).
   - Sets each Master's guild and active environment mode to `'safe'`.
   - Fully restores their Servant HP and replenishes their Command Seals to 3.
   - Logs the demobilization in the Holy Grail War event chronicle.
3. **Duel Command Seal Cut-In User PFP Display:**
   - In `src/commands/duel.ts`, when a Master invokes `card_seal`:
     - Resolves the user's live Discord avatar (`i.user.displayAvatarURL({ extension: 'png', forceStatic: true, size: 512 })`) with fallback to `actor.masterAvatarUrl` and `actingMaster?.avatarUrl`.
     - Updates `actor.masterAvatarUrl` and persists `master.avatarUrl`.
     - Fixes the parameter order in `buildMasterCommandSealDialogueCutInEmbed` so the quote, servant name, and class are properly mapped instead of scrambled.
   - In `src/canvas/renderer.ts`, ensures `@napi-rs/canvas` reliably loads Discord CDN avatar images without referer-blocking or format decode failures, rendering the user's portrait clearly inside the visual novel cut-in frame.

### Target Audience & Persona
- Players competing in Holy Grail War tournaments who need clean, predictable lifecycle transitions when defeated or when a tournament concludes.
- Duel combatants who want their authentic Discord profile picture showcased during high-impact Command Seal cut-in animations.

---

## 2. User Experience & Visual Design

### Key User Flows

#### Flow A: Master Falls in Battle and Reverts to Safe Mode
```
[Master is Executed or Slain in Holy Grail War Duel]
                    │
                    ▼
          War State Evaluated
                    │
    ┌───────────────┴───────────────┐
    ▼                               ▼
War Continues               War Concludes (Sole Survivor / All Fallen)
    │                               │
    ▼                               ▼
Defeated Master set to 'safe'   All Participants set to 'safe'
Servant HP restored to 100%     All Servants restored to 100%
Command Seals reset to 3/3      All Command Seals reset to 3/3
Profile saved to database       All Profiles saved to database
    │                               │
    ▼                               ▼
Defeat announcement posted      Grand Grail conclusion posted
Master can run /duel mode:free  Server returns to peace
```

#### Flow B: Invoking Command Seal in Duel Arena
```
[Master clicks 🔴 Command Seal during Duel Turn]
                    │
                    ▼
Extract i.user.displayAvatarURL({ extension: 'png', size: 512 })
                    │
                    ▼
Pass to renderMasterCommandSealDialogueCard(masterName, quote, avatarUrl, ...)
                    │
                    ▼
Canvas renders:
- Left: Master Discord PFP with flaring Magic Circuit aura & crest
- Right: Contracted Servant battle cutout
- Center: Arcane HUD & Command Seal slash vfx
- Bottom: Visual Novel dialogue ribbon with Master command quote
                    │
                    ▼
Embed & Canvas Image sent to channel with correct author icon and quote
```

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Immediate Safe Mode on Death vs Delayed Reversion
- **Chosen Approach:** Transition the fallen Master to Safe Mode immediately upon death.
- **Why:** Prevents eliminated players from being trapped in a locked war state or lingering at 0 HP. They can immediately enjoy casual features and Free Battles without manual administrative intervention.

### Decision 2: Full HP & Seal Restoration upon Safe Mode Entry
- **Chosen Approach:** Automatically restore Servant to max HP and reset Command Seals to 3 upon reverting to Safe Mode.
- **Why:** As confirmed by the user, once a player is out of the tournament, they should not suffer punitive HP locks for casual activities.

### Decision 3: Live Discord Avatar Prioritization
- **Chosen Approach:** `i.user.displayAvatarURL()` takes highest priority for canvas rendering, falling back to stored profile URL.
- **Why:** Players frequently change Discord avatars. Using the live interaction user avatar guarantees the cut-in reflects their current identity in real time, while also updating their stored profile for future turns.

---

## 4. Technical Architecture & Data Strategy

### System Flow Diagram
```
┌─────────────────────────────────────────────────────────────┐
│                      Holy Grail War Engine                   │
│                                                             │
│  recordDuelOutcome() / evaluateWarState()                   │
│    │                                                        │
│    ├── On Master Death:                                     │
│    │     p.isAlive = false;                                 │
│    │     revertMasterToSafeMode(master, guildId);           │
│    │                                                        │
│    └── On War Status -> 'concluded':                        │
│          for (const p of participants) {                    │
│            revertMasterToSafeMode(p.master, guildId);       │
│          }                                                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Master Profile Database                   │
│                                                             │
│  revertMasterToSafeMode(master, guildId):                   │
│    master.environmentMode = 'safe';                         │
│    master.guildEnvironmentModes[guildId] = 'safe';         │
│    master.commandSeals = 3;                                 │
│    activeServant.currentHp = activeServant.maxHp;           │
│    await saveMaster(master);                                │
└─────────────────────────────────────────────────────────────┘
                               ▲
                               │
┌──────────────────────────────┴──────────────────────────────┐
│                      Duel Arena Interaction                  │
│                                                             │
│  card_seal button handler:                                  │
│    avatar = i.user.displayAvatarURL({ extension: 'png' });  │
│    renderMasterCommandSealDialogueCard(..., avatar, ...);   │
│    buildMasterCommandSealDialogueCutInEmbed(..., avatar);   │
└─────────────────────────────────────────────────────────────┘
```

### Component & File Modifications
1. **`src/engine/grailwar.ts`:**
   - Add helper `revertMasterToSafeMode(discordId, guildId)` to update environment mode, restore Servant HP to max, and set Command Seals to 3.
   - In `recordDuelOutcome`: When a Master is executed (`decision === 'kill'`), call `revertMasterToSafeMode` for the defeated Master.
   - In `evaluateWarState`: When war status becomes `'concluded'` (sole survivor, all fallen, corruption timeout), iterate all participants and invoke `revertMasterToSafeMode`.
   - In other elimination paths (e.g., trap deaths, civilian casualties), ensure Safe Mode reversion is called.
2. **`src/commands/duel.ts`:**
   - In `card_seal`:
     - Resolve `masterAvatar` via `i.user.displayAvatarURL({ extension: 'png', forceStatic: true, size: 512 }) || actor.masterAvatarUrl || actingMaster?.avatarUrl`.
     - Update `actor.masterAvatarUrl` and `actingMaster.avatarUrl`.
     - Fix `buildMasterCommandSealDialogueCutInEmbed` arguments so the parameters match the function signature: `(masterName, masterAvatar, sName, sClass, csQuote, true)`.
   - In duel initialization (`execute`), pass `interaction.user.displayAvatarURL(...)` when creating/getting challenger and opponent Masters so combatants have `masterAvatarUrl` pre-populated.
   - In `finalizeDuelRewardsAndSync`, ensure executed Masters have their environment mode set to `'safe'` and HP/seals refreshed.
3. **`src/canvas/renderer.ts`:**
   - Verify `fetchImageBuffer` / `loadImage` handles Discord CDN avatar URLs reliably without referer headers that cause CDN rejections.
   - Verify `drawHoveringMaster` positions and renders the user's avatar cleanly with full fidelity.

---

## 5. Verification Plan

### Automated Compilation & Type Checks
- Run `npx tsc --noEmit` across all modified files (`src/commands/duel.ts`, `src/engine/grailwar.ts`, `src/canvas/renderer.ts`) to verify zero TypeScript errors.

### Functional Verification
- Verify that calling `renderMasterCommandSealDialogueCard` with a Discord avatar URL successfully fetches and renders a valid PNG buffer with the Master portrait.
- Verify that calling `revertMasterToSafeMode` updates the Master's environment to `'safe'`, sets HP to max, sets Command Seals to 3, and persists the record.
- Verify war evaluation transitions all participants to Safe Mode upon conclusion.
