# Tiamat Raid Boss Verification & Phase 3 HP Tuning

Adjusts Primordial Mother Tiamat's final phase (Phase 3: Primeval Sea Dragon) base HP from 182,000,000 to 70,000,000 (70 Million) and performs a thorough verification of all 6 active skills, 6 phase passives, and 3 Phase Noble Phantasms in the raid combat system.

> [!IMPORTANT]
> **User Confirmed Decisions**:
> - **Phase 3 Base HP**: Set to **70,000,000** (70 Million) in `src/data/raidBosses.ts` and `src/commands/raid.ts`.
> - **Skill & NP Verification**: Audit and verify all 6 active skills (`Wailing Voice`, `Mud Surge`, `Tremor Step`, `Crying Eyes`, `Jaw of the Primordial`, `Chaos Deluge`), Phase 1-3 passives (`Sea of Life / Chaos Tide`, `Self-Limitation`, `Immense Mass`, `Chaos Spores`, `Nega-Genesis`, `Authority of the Beast`), and Phase 1-3 NP executions (`PRIMORDIAL MURMUR`, `CHAOS SURGE`, `PRIMORDIAL ROAR`).

---

## 1. Overview & Core Concept

**Tiamat (Beast II / Primordial Mother)** is a 3-Phase Break Gauge Grand Calamity raid boss in the `/raid` system.
- **Phase 1 (Limiter State)**: 14,000,000 HP. Features *Sea of Life* (-2,000 HP & -15% NP Gain per turn) and *Self-Limitation* (+150k HP heal on player heal).
- **Phase 2 (Titan Form)**: 22,000,000 HP. Features *Immense Mass* (Stun/Charm/Freeze immunity) and *Chaos Spores* (20% DEF shield on odd turns).
- **Phase 3 (Primeval Sea Dragon)**: Adjusted to **70,000,000 HP**. Features *Nega-Genesis* (-50% normal card DMG) and *Authority of the Beast* (cleaves 2 Servants with high crit).

---

## 2. User Experience & Visual Design

- **Raid Combat Log Clarity**: Ensure Tiamat's skills render bold, distinct combat logs with accurate debuff tags (`Skill Seal`, `Buff Shorten`, `DEF Shred`, `NP Drain`, `NP Siphon + 50k Barrier`).
- **Break Gauge Transition Feedback**: Display dramatic break announcements when transitioning from Phase 1 -> Phase 2 -> Phase 3, updating Tiamat's full-canvas sprite, NP name, and charge threshold (5 -> 4 -> 3 diamonds).
- **Phase 3 NP Visuals**: `PRIMORDIAL ROAR (NEGA-GENESIS ANNIHILATION)` renders True AoE damage ignoring Evade/Invincibility with unmitigated true damage logs.

---

## 3. Key Product Decisions & Trade-Offs

1. **Phase 3 HP Balance (70M)**:
   - *Chosen*: Lower Phase 3 base HP from 182M to 70M.
   - *Rationale*: Reduces extreme attrition grind while retaining high threat via *Nega-Genesis* (-50% normal card damage) and 3-diamond NP charge frequency.

2. **Skill Engine Validation**:
   - *Chosen*: Audit state transitions in `src/commands/raid.ts` to ensure skill probability weighting (17% per skill) correctly triggers all 6 skills without index out-of-bounds or silent pass-throughs.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Tiamat Raid Engine Architecture                  │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                     ┌─────────────────────────────┐
                     │    src/data/raidBosses.ts   │
                     │  - Phase 1 HP: 14,000,000   │
                     │  - Phase 2 HP: 22,000,000   │
                     │  - Phase 3 HP: 70,000,000   │  <-- UPDATE
                     │  - 6 Active Skills Config   │
                     └──────────────┬──────────────┘
                                    │
                                    ▼
                     ┌─────────────────────────────┐
                     │    src/commands/raid.ts     │
                     │  - Phase 3 fallback HP      │  <-- UPDATE (70M)
                     │  - Skill RNG Roll (0.0-1.0) │  <-- VERIFY (6 skills)
                     │  - Phase 1-3 Passives       │  <-- VERIFY
                     │  - Phase 1-3 NP Executions  │  <-- VERIFY
                     └─────────────────────────────┘
```

### Files to Update & Verify
1. **`src/data/raidBosses.ts`**: Update Phase 3 `baseHp` from `182_000_000` to `70_000_000`.
2. **`src/commands/raid.ts`**:
   - Update fallback Phase 3 base HP in break gauge handler (line 2088) from `182_000_000` to `70_000_000`.
   - Verify skill roll boundaries (0.17, 0.34, 0.50, 0.67, 0.84, 1.0) map to all 6 active skills (`Wailing Voice`, `Mud Surge`, `Tremor Step`, `Jaw of the Primordial`, `Crying Eyes`, `Chaos Deluge`).
   - Verify Phase 1, Phase 2, and Phase 3 NP execution handlers and passives.
