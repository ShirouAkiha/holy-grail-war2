# Server-Isolated Holy Grail War & Safe Mode Architecture

Isolates all Holy Grail War tournament states, participant standings, and environment modes (Safe Mode vs. War Mode) per Discord server (`guildId`), while preserving global sharing for Servant collections, inventory, SQ, materials, and progression.

> [!IMPORTANT]
> **User Confirmed Decisions**:
> - **Per-Server Isolation**: Holy Grail War tournaments, registration, combat standing, and environment modes are strictly scoped per server (`guildId`). If a Master is fighting in a Holy Grail War in Server A, they can be in Safe Mode in Server B without interference or cross-contamination.
> - **Direct Messages (DMs)**: In DMs where no server exists, commands default strictly to **Safe Mode** with tournament war actions disabled.
> - **Global Inventory Preserved**: Servant collection, active Servant selection, EXP, Bond levels, CE inventory, Saint Quartz, and general progression remain shared globally across all servers.

---

## 1. Overview & Core Concept

Currently, a Master's `environmentMode` (`'safe' | 'war'`) is stored as a single global string on their `MasterProfile`. Additionally, `findActiveWarSessionForMaster()` iterates through all server war sessions, causing a player registered in Server A's war to be detected as in "War Mode" on Server B. Forfeiting or changing modes in Server B subsequently cancels their standing in Server A.

### The New Model
- **Global Data**: Master identity, currency (SQ, QP, Mana Prisms), Servant inventory, ascension levels, Craft Essences, and stats.
- **Per-Server Data**:
  - `guildEnvironmentModes`: `Record<string, 'safe' | 'war'>` storing the Master's mode in each server.
  - `warSessionsByGuild`: `Record<string, HolyGrailWarSession>` partitioned by `guildId`.
  - Participant status (HP, Command Seals in war, fallen/alive status, bounded fields, and familiar recon) is strictly evaluated against the current server's `HolyGrailWarSession`.

---

## 2. User Experience & Visual Design

### Server A (In War)
- `/profile`: Displays **⚔️ War Mode (Server Tournament Active)** with tournament participant badge, current War HP bar, and active Command Seals.
- `/grailwar`: Full access to tactical war actions (Patrols, Wards, Traps, Familiars, Church Sanctuary).
- `/attack`: Can launch ambush attacks against other Masters or civilians in Server A.
- `/duel`: Tournament 1v1 clashing where damage and elimination persist in Server A's war bracket.

### Server B (Safe Mode)
- `/profile`: Displays **🛡️ Safe Mode (Server Chaldea Reserve)** with zero risk of tournament elimination.
- `/grailwar`: Displays the war board as a spectator or prompts to enroll if a war is gathering in Server B.
- `/attack`: Blocked with a clean Safe Mode notice.
- `/duel`: Standard friendly sparring (`mode: free`) where Servants start with full HP and 3 Command Seals without affecting Server A's war.

### Direct Messages (DMs)
- Displays Chaldea Safe Mode with clear indication that Holy Grail War operations must take place inside a server.

---

## 3. Key Product Decisions & Trade-Offs

1. **Per-Server Environment Mode (`guildEnvironmentModes`)**:
   - *Chosen*: Store `guildEnvironmentModes: Record<string, 'safe' | 'war'>` on `MasterProfile`.
   - *Why*: Allows instantaneous mode lookup by server while keeping user storage unified and performant. Backward compatible with legacy `environmentMode`.

2. **Strict Server Resolution (`resolveGuildKey`)**:
   - *Chosen*: When an interaction provides `interaction.guildId`, `resolveGuildKey` and `findActiveWarSessionForMaster` must strictly resolve to that `guildId`.
   - *Why*: Eliminates cross-server session leakage where Server A's war was erroneously pulled into Server B.

3. **Safe Mode Defaulting in DMs**:
   - *Chosen*: Return `'safe'` when `guildId` is absent.
   - *Why*: Prevents orphan war sessions or ambiguous combat states outside a server.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        User Data & Server Scoping                      │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                     ┌─────────────────────────────┐
                     │    Global MasterProfile     │
                     │  - Servants & Active Servant│  (Shared globally)
                     │  - Inventory & Saint Quartz │  (Shared globally)
                     │  - guildEnvironmentModes:   │  (Per-server mode)
                     │    {                        │
                     │      "server_A": "war",     │
                     │      "server_B": "safe"     │
                     │    }                        │
                     └──────────────┬──────────────┘
                                    │
            ┌───────────────────────┴───────────────────────┐
            ▼                                               ▼
┌───────────────────────────────┐               ┌───────────────────────────────┐
│     Server A (Guild 111)      │               │     Server B (Guild 222)      │
│  - Mode: ⚔️ War Mode          │               │  - Mode: 🛡️ Safe Mode         │
│  - War: Active 7-Master Roster│               │  - War: Independent / Safe    │
│  - War HP: Persistent         │               │  - War HP: Full (Sparring)    │
│  - Tactical Actions: Enabled  │               │  - Tactical Actions: Disabled │
└───────────────────────────────┘               └───────────────────────────────┘
```

### Exact Files to Modify

1. **`src/types.ts`**:
   - Add `guildEnvironmentModes?: Record<string, 'safe' | 'war'>;` to `MasterProfile`.

2. **`src/engine/environmentService.ts`**:
   - Update `getMasterEnvironment(master, guildId?, warSession?)`:
     - If no `guildId` -> returns `'safe'`.
     - If `guildId` present -> checks active participant in guild's war session or `master.guildEnvironmentModes?.[guildId]`, defaulting to `'safe'`.
   - Update `setMasterEnvironment(master, mode, guildId?)`:
     - Stores mode in `master.guildEnvironmentModes[guildId] = mode`.
     - If forfeiting (`'safe'`), only eliminates/forfeits in `warSessionsByGuild[guildId]`.
   - Update `checkWarActionPermission(master, war, discordId, guildId?)`:
     - Strictly queries `guildId` war session; blocks in DMs.
   - Update `canAccessFreeBattle(master, guildId?, warSession?)`:
     - Scoped strictly to `guildId`.

3. **`src/engine/grailwar.ts`**:
   - Update `resolveGuildKey(master?, guildId?)`: Prioritizes `guildId` and avoids fallback to cross-server master profiles.
   - Update `findActiveWarSessionForMaster(discordId, master?, guildId?)`:
     - When `guildId` is provided, returns ONLY that server's war session (removes cross-guild loop).
   - Update `attemptJoinWar` and `forfeitWar` to accept and use `guildId` with `setMasterEnvironment`.

4. **`src/commands/duel.ts`**:
   - Pass `interaction.guildId` to all `getMasterEnvironment` calls and combatant generators.
   - Ensure Free Battle vs. War Duel checks use the current server's mode and standing.

5. **`src/commands/attack.ts` & `src/commands/heal.ts`**:
   - Check `getMasterEnvironment(master, interaction.guildId)` and guild-scoped war session.
   - Enforce server boundary so attacks and heals are strictly localized.

6. **`src/commands/profile.ts`**:
   - Pass `interaction.guildId` to `/profile` embed builder to display the correct mode badge (Safe vs. War) for the current server.

7. **`src/engine/warRecruitmentService.ts`**:
   - Set `master.guildEnvironmentModes[targetGuildId] = 'war'` when participant joins war in that guild.
