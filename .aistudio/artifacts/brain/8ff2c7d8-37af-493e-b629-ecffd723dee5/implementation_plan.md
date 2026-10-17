# Holy Grail War Duel Integrity & Barbatos Raid Reward Fixes

Enforce strict tournament participation rules on duel Force Join so only active, living Masters can intervene in Holy Grail War battles with their registered Servants, and remove Servant Bond EXP drops from the Demon God Pillar Barbatos raid encounter.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed to address the reported bugs:

- **Confirmed Decision 1 (Force Join War Restriction):** Only active, living participants registered in that server's Holy Grail War can Force Join an ongoing war duel. Non-participants and eliminated Masters will be cleanly blocked with an ephemeral notice explaining that tournament duels are restricted to registered contenders.
- **Confirmed Decision 2 (Registered Servant in War Force Join):** When an enrolled war Master force-joins a Holy Grail War duel, the system fields their locked war-registered Servant (and their current war HP status), preserving tournament state and preventing daily active Servant switches from leaking into the arena.
- **Confirmed Decision 3 (Barbatos Raid Bond EXP Removal):** Demon God Pillar Barbatos will award zero Bond EXP upon defeat. Bond EXP rewards and victory log announcements are restricted exclusively to the Beast II Tiamat raid encounter.

---

## 1. Overview & Core Concept

### What It Does
1. **Duel Force Join Gatekeeping:**
   - Detects whether an active duel is an official Holy Grail War tournament battle (`!isFreeBattle`) or a casual sparring match (`isFreeBattle`).
   - If the duel is a War battle, checks the intervening Master against `warSession.participants`:
     - If the Master is not registered in the war, interaction is blocked with an explanation directing them to Free Battles (`/duel mode:free`) or war registration.
     - If the Master has already been eliminated in the war (`!participant.isAlive`), interaction is blocked with an elimination notice.
     - If the Master is an active living contender, resolves their combatant entity using their war-registered Servant (`participant.servantId`) and their persistent war HP.
   - If the duel is a Free Battle, any Master with a summoned Servant can intervene freely as before.
2. **Barbatos Raid Spoils Calibration:**
   - Cleanses the drop tables and victory calculation in `src/commands/raid.ts`: sets `bondExpReward` to `0` for Barbatos (`boss.id === 'barbatos'`).
   - Prevents `addBondExpToServant` execution and removes Bond EXP progression lines from Barbatos victory reports.
   - Cleans up raid menu text and boss inspect cards so Barbatos displays only SQ, Servant Battle EXP, and Universal Blaze Embers.

### Target Audience & Persona
- Players competing in competitive server Holy Grail War tournaments who need bracket purity without outside disruptions.
- Masters undertaking collaborative co-op raid battles against Barbatos and Tiamat with accurate progression rewards.

---

## 2. User Experience & Visual Design

### Key User Flows

#### Flow A: Non-War Participant Clicks "⚡ Force Join Arena" on a War Duel
```
[User clicks ⚡ Force Join Arena on active War Duel]
          │
          ▼
Is this a War Duel (!isFreeBattle)?
          │── Yes ──► Check Master's War Enrollment in Guild War Session
                            │
                            ├── Not Registered? ──► Ephemeral Alert:
                            │   "❌ Holy Grail War Restricted: Only registered Masters
                            │    currently competing in this server's Holy Grail War can
                            │    intervene in tournament duels. You can freely Force Join
                            │    any Free Battle (/duel mode:free) match!"
                            │
                            ├── Fallen/Eliminated? ──► Ephemeral Alert:
                            │   "❌ Eliminated Master: You have fallen in this Holy Grail War
                            │    and cannot intervene in active tournament duels."
                            │
                            └── Active Contender ──► Opens Team / Solo Selection Prompts
```

#### Flow B: Active War Contender Force Joins a War Duel
- Master selects `Ally with Team 1`, `Ally with Team 2`, or `Solo Rogue Intervention`.
- The combatant added to the arena uses `participant.servantId` (their tournament champion) and `calculateCurrentHp(participant)`.
- Reinforcements receive standard battle intervention buffs (+30% ATK for 3 turns, +20 Critical Stars).
- Combat canvas renders the registered Servant sprite and portrait.

#### Flow C: Free Battle Force Join
- Any Master with at least 1 summoned Servant can click `⚡ Force Join Arena` on casual matches without restrictions.

#### Flow D: Barbatos Raid Victory Screen
- **Boss Defeated:** Barbatos collapses into the void.
- **Spoils of War Embed:**
  - `• +10–20 Saint Quartz 💎`
  - `• +25,000 Servant Battle EXP ⚔️`
  - `• +3 Universal EXP Embers ✨`
  - *(Bond EXP line is omitted)*
- **Master Progression:**
  - Reports Servant level-ups and stat points.
  - Does not advance Bond Level and omits the 🌸 Bond line.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Server-Scoped War Verification vs Global State
- **Chosen Approach:** Check `findActiveWarSessionForMaster` using the battle's `guildId`. Match the joiner's ID in `warSession.participants`.
- **Why:** Holy Grail Wars operate on a per-guild basis. Checking the guild's war session guarantees that someone who is in a war on Server A cannot force-join a war on Server B unless registered there.

### Decision 2: Field Registered War Servant on Force Join
- **Chosen Approach:** When `!isFreeBattle`, fetch the Servant by `joinPart.servantId`. Fall back to active Servant only if no registered ID is recorded.
- **Why:** Maintains consistency with earlier servant isolation rules where tournament combatants are locked to their inscribed champion.

### Decision 3: Zero Bond EXP for Barbatos vs Explicit Value
- **Chosen Approach:** Set `bondExpReward = isTiamat ? 1000 : 0`. Wrap the bond addition and bond report generation inside `if (bondExpReward > 0)`.
- **Why:** Keeps the logic clean and maintainable. Tiamat preserves her full 1,000 Bond EXP drop, Barbatos yields 0, and any future boss can easily define its own bond rewards without side-effects.

---

## 4. Technical Architecture & Data Strategy

### Technical Flow Diagram

```
┌────────────────────────────────────────────────────────┐
│                   DISCORD BATTLE EVENT                 │
└────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        ▼                                       ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐
│       src/commands/duel.ts    │ │      src/commands/raid.ts    │
│  - card_forcejoin click      │ │  - Victory calculation      │
│  - fj_join_team1 / team2 /   │ │  - Drop descriptions        │
│    join_solo button handlers │ │  - Progress report builder   │
└──────────────────────────────┘ └──────────────────────────────┘
        │                                       │
        ▼                                       ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐
│    War Enrollment Guard:     │ │      Boss Drop Logic:        │
│ • Check !isFreeBattle        │ │ • isTiamat ? 1000 : 0        │
│ • Verify joinPart exists     │ │ • if (bondExpReward > 0)     │
│ • Verify joinPart.isAlive    │ │   award bond & log progress  │
│ • Use joinPart.servantId     │ │ • Omit bond from Barbatos UI │
└──────────────────────────────┘ └──────────────────────────────┘
```

### Affected Handlers & State Mapping

| Target Area | Location | Expected Adjustment |
| :--- | :--- | :--- |
| **Force Join Modal Handler** | `src/commands/duel.ts` (`card_forcejoin`) | Add check for `!isFreeBattle`: verify `warSession.participants[i.user.id]`. Reject non-registered and dead Masters with ephemeral messages. |
| **Team 1 / 2 Selection** | `src/commands/duel.ts` (`fj_join_team1_`, `fj_join_team2_`) | Verify `joinPart && joinPart.isAlive` in War duels; load `joinPart.servantId` as the combatant's Servant. |
| **Solo Rogue Selection** | `src/commands/duel.ts` (`fj_join_solo_`) | Verify `joinPart && joinPart.isAlive` in War duels; load `joinPart.servantId` as the combatant's Servant. |
| **Barbatos Raid Reward** | `src/commands/raid.ts` (`bondExpReward`) | Change calculation to `isTiamat ? 1000 : 0`. Conditionally apply bond rewards and conditionally render Bond EXP lines in victory embeds. |
| **Raid Menu & Inspect UI** | `src/commands/raid.ts` (lines 135, 203) | Remove `+2,000 Bond` references from Barbatos drop listings. |
