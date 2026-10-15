# Beast II / Tiamat Raid Overhaul & Ascension

Upgrade the Primordial Mother Tiamat raid encounter into an epic, multi-phase endgame calamity with doubled combat parameters, 66M Phase 3 HP, phase-specific Noble Phantasm cut-in cinematics, rapid NP gauge acceleration, and massive endgame spoils of war.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following parameters were confirmed via user clarification:
> - **NP Gauge Acceleration Rate**: 35% chance per enemy round to charge NP gauge by **+2 diamonds** instead of +1.
> - **Scaling Focus**: Scale **HP and attack damage by 2x**, keeping base skill utility, debuff durations, and barrier values balanced for tactical counterplay.
> - **Final Phase Vitality**: Phase 3 HP scaled to **66,000,000 HP** (base 8M × 2 = 16M + 50M bonus).
> - **Victory Spoils**: 200,000 Battle EXP, 30 Universal EXP Embers, 1,000 Bond EXP, and 50 Saint Quartz.

- **Confirmed Decision 1**: Distinct Noble Phantasm names, chants, and full visual cut-ins for each of Tiamat's 3 phases using the user's approved image assets.
- **Confirmed Decision 2**: Automatic distribution of 30 Universal EXP Embers and 1,000 Bond EXP alongside 50 SQ upon raid completion.

---

### 1. Overview & Core Concept

- **What It Does**: Upgrades the 3-phase Tiamat raid battle in `/raid tiamat` to reflect true Beast II status. Phase 1 represents her Limiter State (7M HP), Phase 2 awakens the Titan Form (11M HP), and Phase 3 unleashes the Primeval Sea Dragon (66M HP) with Nega-Genesis damage mitigation.
- **Target Audience**: Cooperative raid groups and solo Masters looking for an intense endgame boss fight requiring team synergy, anti-purge defense, and sustained card chains.
- **Key Value**: Delivers cinematic, high-stakes raid combat with authentic Fate lore pacing and generous rewards for victory.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Raid Initiation (`/raid tiamat`)**: Masters launch or join the Chaos Sea expedition; lobby embeds display Tiamat's augmented parameters and threat level.
  2. **Phase 1 Combat (Limiter State — 7,000,000 HP)**: Tiamat exerts Chaos Tide drain and self-limitation healing. At 5 diamonds, she unleashes **Primordial Murmur** with Phase 1 visual cut-in.
  3. **Phase 2 Break (Titan March — 11,000,000 HP)**: The limiter cracks; Tiamat gains stun immunity and chaos shields. At 4 diamonds, she executes **Chaos Surge** with Phase 2 visual cut-in.
  4. **Phase 3 Break (Primeval Sea Dragon — 66,000,000 HP)**: Final boss emergence with 66 Million HP and Nega-Genesis (-50% normal card resistance). At 3 diamonds, she unleashes **Primordial Roar** with Phase 3 draconic cut-in, bypassing standard Evade and Invincibility.
  5. **Victory & Spoils Distribution**: Tiamat is banished; all participating Masters receive 50 SQ, 200k Servant EXP, 30 Universal EXP Embers, and 1k Bond EXP with level-up notifications.

- **Visual Assets & Cut-in Mapping**:
  - **Phase 1 NP Cut-In**: `https://ella.janitorai.com/media-approved/xpD_kMhfXNT1T0MtyF4DX.webp`
  - **Phase 2 NP Cut-In**: `https://ella.janitorai.com/media-approved/kQ23vRCI41AnKDMw9RHcW.webp`
  - **Phase 3 NP Cut-In**: `https://ella.janitorai.com/media-approved/tiZM7h03gIQkcvsJEwEYd.webp`

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: HP & Damage Scaling Structure**
  - *Chosen Approach*:
    - Phase 1 HP: `3,500,000 × 2 = 7,000,000`
    - Phase 2 HP: `5,500,000 × 2 = 11,000,000`
    - Phase 3 HP: `(8,000,000 × 2) + 50,000,000 = 66,000,000`
    - Attack scaling: 2.0x multiplier on normal strikes and AoE Noble Phantasms.
  - *Why*: Delivers an escalating endurance challenge where early phases test resource conservation and the final phase demands optimal burst rotation before enrage.
  - *Alternatives Considered*: Scaling skills 2x was considered, but per user feedback, skill effects/barriers remain baseline to ensure the fight is difficult yet fair.

- **Decision 2: NP Gauge Acceleration (Primordial Pulse)**
  - *Chosen Approach*: On enemy turn start (when not NP-sealed), roll 35% chance to grant +2 diamonds instead of +1, broadcast with a combat log notice.
  - *Why*: Adds pressure and unpredictability, compelling Masters to time defensive buffs, NP seals, and drains strategically.

- **Decision 3: Drops & Reward Packaging**
  - *Chosen Approach*: Direct injection of 50 SQ, 200,000 Servant Battle EXP, 30 EXP Embers (crafted into Master Craft Essence inventory), and 1,000 Bond EXP to all participants.
  - *Why*: Fulfills user requirements directly and integrates with existing servant growth systems (`/servant`, `/feed`).

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    RAID COMMAND (/raid)                     │
│  - Select Boss: Tiamat (Beast II)                           │
│  - Initializes RaidBattleState with 3-Phase HP Scaling      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   TIAMAT BOSS DATA ENGINE                   │
│  - Phase 1: 7,000,000 HP | 5 Max Charge                     │
│  - Phase 2: 11,000,000 HP | 4 Max Charge                    │
│  - Phase 3: 66,000,000 HP | 3 Max Charge                    │
│  - NP Assets: 3 Dedicated WebP URLs mapped per phase        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 COMBAT ROUND & ENEMY PHASE                  │
│  - 35% Primordial Pulse Roll: +2 Charge Diamonds            │
│  - 2x Damage Multiplier on Normal Attacks & Noble Phantasms │
│  - Dynamic Cut-In dispatch with phase-specific image        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               VICTORY & SPOILS OF WAR ENGINE                │
│  - +50 Saint Quartz to Master profile                       │
│  - +200,000 Servant Battle EXP (Levels up Servant)          │
│  - +1,000 Servant Bond EXP (Advances Bond Ranks)            │
│  - +30 Universal EXP Embers added to Craft Essence Vault    │
└─────────────────────────────────────────────────────────────┘
```

- **Entities & Configuration Updated**:
  - `src/data/raidBosses.ts`: Update Tiamat definition (`baseHp`, `phases` array with new HP and NP config, `drops` table).
  - `src/commands/raid.ts`:
    - Update `dispatchBossNpGif` to support phase-specific NP names, chants, and cut-in image URLs for Tiamat.
    - Update enemy phase charge logic to check 35% roll for +2 gauge diamonds.
    - Apply 2.0x multiplier to Tiamat's normal and AoE attack damage.
    - Update `handleRaidVictory` to award 50 SQ, 200k EXP, 30 Embers, and 1k Bond EXP, rendering the updated spoils report.
