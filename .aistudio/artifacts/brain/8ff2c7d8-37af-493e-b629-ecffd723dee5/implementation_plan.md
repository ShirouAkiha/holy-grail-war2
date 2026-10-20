# Mysterious Executor C.I.E.L — Servant Integration Plan

Add the 5★ MoonCancer Servant **Mysterious Executor C.I.E.L** to the Holy Grail War RPG with all 4 Ascension stages, 2 Spiritron Dress costumes, authentic Atlas Academy assets, full skill and passive kits, 2 stage-dependent Noble Phantasms (Code: Original Sin and Calvaria Galgalim) with custom animations, and her signature Bond CE Moon Bow.

## User Review & Critical Decisions

> [!IMPORTANT]
> Key design choices confirmed with user:
> - **Skill 3 (Idea Blood)**: Randomly converts all cards in the active hand to either 100% Buster, 100% Arts, or 100% Quick for 1 turn upon activation.
> - **Dual Noble Phantasms**: Dynamically switches NP name, chant, and animation GIF based on equipped stage:
>   - **Stages 1 & 2**: *Code: Original Sin (Seventh Holy Scripture - Final Judgment)*
>   - **Stages 3 & 4 (and Costumes)**: *Calvaria Galgalim (Idea Blood: Hemonomic Principle - Guillotine)*
> - **Bond Interlude**: Intentionally omitted for now; user will provide a script later.

## 1. Overview & Core Concept

- **Servant Identity**: Mysterious Executor C.I.E.L (MoonCancer class, 5★ SSR).
- **Core Role**: Hybrid crit/burst offensive juggernaut with exceptional survivability (high HP pool, EX endurance, HP regeneration, buff removal resistance, 100% DEF burst, and defensive healing).
- **Key Mechanics**:
  - Arts on-attack Guts removal, healing down, and NP drain.
  - Buster on-attack NP charge.
  - Dynamic HP-conditional Critical Damage buffs (+50% at ≥50% HP, +50% at 100% HP).
  - Class advantage vs Sabers (1.5x damage multiplier via Executor passive).
  - Stage-adaptive NP visuals and chants with anti-Demonic scaling and Instant-Kill potential.

## 2. Technical Architecture & Component Mapping

```
┌─────────────────────────────────────────────────────────────┐
│                 Servant Data & Assets                       │
├─────────────────────────────────────────────────────────────┤
│ • Template Definition (src/data/servants.ts)                │
│ • Atlas Academy Stages 1-4 & Costumes 1-2 (servantAscensions)│
│ • Dual NP Chants & Gifs (noblePhantasmGifs.ts)              │
│ • Bond 10 CE "Moon Bow" (craftEssences.ts)                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
            Combat Resolution Systems
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│ Duel Engine                  │    │ Raid Engine                  │
│ (src/commands/duel.ts &      │    │ (src/commands/raid.ts)       │
│  lib/engine/battle.ts)       │    │                              │
├──────────────────────────────┤    ├──────────────────────────────┤
│ • Skill 1: 10% NP/T, 5% HP/T │    │ • Skill 1: 10% NP/T, 5% HP/T │
│ • Skill 2: Arts/Buster Up,   │    │ • Skill 2: Raid Guts-strip,  │
│   Guts strip, HP-cond crit   │    │   1-diamond drain, crit      │
│ • Skill 3: Hand card convert,│    │ • Skill 3: 50% NP, 3T 100%   │
│   20% NP, 1T 100% DEF        │    │   DEF, 10% heal on hit       │
│ • Passive: 1.5x vs Saber     │    │ • NP: 40% IK, Demonic bonus  │
└──────────────────────────────┘    └──────────────────────────────┘
```

## 3. Implementation Steps

### Step 1: Servant Template & Base Data (`src/data/servants.ts`)
- Add `ciel_executor` with:
  - Class: `MoonCancer`, Rarity: 5.
  - Base Stats: STR C+ (12), END EX (25), AGI B+ (14), MANA A+ (16), LUCK C+ (12).
  - Deck: `Quick, Arts, Arts, Buster, Buster`.
  - Max HP: 14,742, Max ATK: 11,658.
  - Traits: `costume_owning`, `defender`, `hominidae_servant`, `humanoid`, `living_human`, `loved_one`, `servant`, `spaceflight_able`, `summer_mode`, `weak_to_enuma_elish`.
  - Summon line, bio, and personality verbatim from brief.
  - Full definitions for Skill 1, Skill 2, Skill 3, and Passives 1 & 2.

### Step 2: Atlas Academy Visuals & Costumes (`src/data/servantAscensions.ts`)
- Add canonical entry for `ciel_executor` using official Atlas Academy assets:
  - Stages 1-4 character graphs and sprite sheets.
  - Costume 1: *Open Summer (Swimsuit Mode)* (`2300930`).
  - Costume 2: *Glasses Off Mode* (`2300940`).

### Step 3: Dual Noble Phantasm Routing & GIFs (`src/data/noblePhantasmGifs.ts`)
- Implement stage-aware resolution for C.I.E.L:
  - If stage is 1 or 2: *Code: Original Sin (Seventh Holy Scripture - Final Judgment)* with GIF `https://ella.janitorai.com/media-approved/2FK82Z4D2WXmDXZ9cL4lB.gif`.
  - If stage is 3, 4, or costume: *Calvaria Galgalim (Idea Blood: Hemonomic Principle - Guillotine)* with GIF `https://ella.janitorai.com/media-approved/mLP_-8WbJfVio7dzHLF3n.gif`.

### Step 4: Bond CE "Moon Bow" (`src/data/craftEssences.ts` & `craftEssenceHelper.ts`)
- Add CE `ce_bond_ciel`:
  - Name: *Moon Bow*, 4★ Bond Relic.
  - Art: `https://static.atlasacademy.io/JP/CharaGraph/9308300/9308300a.png`.
  - Passives: +30% NP Damage, +5% NP/turn, +3% HP/turn.

### Step 5: Combat Skills & Passive Handlers (`duel.ts`, `raid.ts`, `battle.ts`)
- **Skill 1**: Buff removal resistance, debuff resistance, 10% NP/T & 5% HP/T.
- **Skill 2**:
  - Arts attacks: 20% Healing Received Down (3T), Guts removal on target, 30% chance for 20% NP drain (duel) / 1 diamond drain (raid).
  - Buster attacks: +10% NP gauge refund.
  - Dynamic HP Crit Buffs: evaluates current HP in damage pipeline (+50% if HP ≥ 50%, additional +50% if HP = 100%).
- **Skill 3**:
  - Random hand card conversion to all-Buster, all-Arts, or all-Quick.
  - NP charge: 20% in duel, 50% in raid.
  - 100% DEF Up (1T in duel, 3T in raid).
  - Buff-on-Defense: +10% HP heal when damaged (3 hits / 3T).
- **Passives**:
  - `Self Preservation Magecraft A`: 2% HP/T.
  - `Executor (Archer) A`: 1.5x damage against Saber class enemies.
- **NP Damage**:
  - Ignores Evasion & Defense, 150% extra vs Demonic enemies, 10% IK (duel) / 40% IK (raid), 20% NP refund, +60% NP Damage Up Overcharge.

### Step 6: Verification & Compilation
- Run `lint_applet` to confirm zero lint or TypeScript errors across all files.
