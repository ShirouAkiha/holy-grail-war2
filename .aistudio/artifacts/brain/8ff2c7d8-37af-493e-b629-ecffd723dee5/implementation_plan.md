# Implementation Plan: Archetype: Earth Servant Integration & Millennium Castle Mechanics

Add **Archetype: Earth** (Arcueid Brunestud) as a 5-Star MoonCancer Servant with full multi-stage ascension art and battle sprites, stage-dependent Noble Phantasm cinematic animations, dynamic Millennium Castle Battlefield field transformation mechanics in Duels and Raids, and her signature Bond Craft Essence *Moon Margaret*.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following key decisions have been confirmed and incorporated:
> - **Servant Class & Rarity**: 5-Star MoonCancer (SSR) with class advantage against Avengers and neutral/favorable positioning.
> - **Ascension Stages & Sprites**: Official Atlas Academy high-definition assets for Stages 1, 2, 3, and 4 (Final Ascension) plus combat battle sprites.
> - **Noble Phantasm Visuals**: Stage 1 & 3 use the moonlit castle incantation animation (`_lDposzhmPLDeSsGf6k70.gif`), and Stage 2 uses the modern Arcueid release animation (`gc_jc1p1H5Gj6NlUuDG1Y.gif`).
> - **Bond Story**: As instructed, her bond story unlock script will be held until provided in a later update; default bond level dialogue, interactions, and profile lines will be fully populated.

---

### 1. Overview & Core Concept

- **What It Delivers**: Introduces Archetype: Earth into the Holy Grail War roster, gacha summon pools, servant lists, duels, and cooperative raids. She brings unique field manipulation mechanics that transform the battle environment into the **Millennium Castle Battlefield (千年城)** for 3 turns, boosting her own and allies' capabilities.
- **Key Value**: Provides a faithful, high-impact implementation of the True Ancestor royalty with lore-accurate multi-stage personalities, stage-adaptive NP cinematics, and interactive battlefield field buffs.

---

### 2. User Experience & Visual Design

- **Ascension Stages & Costumes**:
  - **Stage 1 (True Ancestor Queen)**: Long white dress, cold regal demeanor, queenly dialogue.
  - **Stage 2 (Innocent Vampire / Tsukihime Arcueid)**: Classic white sweater and purple long skirt, friendly, expressive personality.
  - **Stage 3 (True Ancestor Princess / Astral Dress)**: Celestial gown, gentle and contemplative demeanor.
  - **Stage 4 (Final Ascension)**: Full artistic portrait beneath the luminous moon.
- **Noble Phantasm Stage Adaptation**:
  - Automatically checks `selectedAscensionStage` or `ascensionStage`:
    - Stage 2 displays `gc_jc1p1H5Gj6NlUuDG1Y.gif`.
    - Stages 1, 3, and 4 display `_lDposzhmPLDeSsGf6k70.gif`.
- **Millennium Castle Battlefield Visual Backdrop**:
  - When *Marble Phantasm* is unleashed, both Duels and PvE Raids instantly transition their battlefield background canvas to the Millennium Castle environment (`mOEhq2x9RkL0KU_fI1DZK.webp`), accompanied by field status indicators on the tactical HUD.
- **Craft Essence Presentation**:
  - *Moon Margaret* (CE 1671) with official high-resolution artwork and custom passive party NP damage aura when fighting upon the Millennium Castle Battlefield.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Dual-Stage Noble Phantasm GIF Resolution**:
  - *Approach*: Extend `getNoblePhantasmGif` in `src/data/noblePhantasmGifs.ts` to inspect the servant instance's `selectedAscensionStage` or pass the active stage dynamically from Duel and Raid callers.
  - *Why*: Seamlessly renders the user-provided Stage 2 animation when Arcueid is in her modern form and the Stage 1 & 3 animation in her royal forms without breaking backwards compatibility.
- **Decision 2: Universal Field State Management**:
  - *Approach*: Implement `fieldStatus` tracking with remaining turn counters in both `src/commands/duel.ts` and `src/commands/raid.ts`.
  - *Why*: Ensures `Ultimate One D` (+30% Q/A/B performance), `Funny Vamp EX` (+30% party NP battery), and *Moon Margaret* (+25% party NP damage) trigger accurately across both game modes.
- **Decision 3: Raid vs. PvP Skill Balancing**:
  - *Approach*: Skill 2 (*Breath of the Planet C*) dynamically detects the battle context to award 50% NP gauge in Duels/PvP and 100% NP gauge in cooperative Raids.
  - *Why*: Follows the exact user specification and matches the character's raid farming identity.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ARCHETYPE: EARTH DATA                           │
│  - Template: src/data/servants.ts (MoonCancer, Stats, Lore, Skills)    │
│  - Ascensions: src/data/servantAscensions.ts (Stages 1-4 & Sprites)   │
│  - CE: src/data/craftEssences.ts (Moon Margaret CE1671)                │
│  - NP Animations: src/data/noblePhantasmGifs.ts (Stage 1&3 vs Stage 2) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
               ┌────────────────────┴────────────────────┐
               ▼                                         ▼
┌─────────────────────────────┐           ┌─────────────────────────────┐
│       DUEL SUBSYSTEM        │           │       RAID SUBSYSTEM        │
│  - src/commands/duel.ts     │           │  - src/commands/raid.ts     │
│  - battleBgUrl override     │           │  - fieldStatus in state     │
│  - 3T Millennium Castle     │           │  - raidRenderer background  │
│  - Chaotic bonus multiplier │           │  - 100% NP battery in raids │
│  - Ally NP battery (40%)    │           │  - Party battery (Funny Vamp│
└──────────────┬──────────────┘           └──────────────┬──────────────┘
               │                                         │
               └────────────────────┬────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        CANVAS RENDERING ENGINE                         │
│  - src/canvas/renderer.ts & src/canvas/raidRenderer.ts                 │
│  - Renders Millennium Castle Backdrop when field status active         │
│  - Draws Stage 1-4 sprites & character cards                           │
└────────────────────────────────────────────────────────────────────────┘
```

#### Detailed State & Combat Flow:
1. **Skill 1: Rainbow Mystic Eyes A (CD 6T)**:
   - Inflicts 1-turn Skill Seal on all enemies.
   - Reduces enemy defense by 20% for 3 turns.
   - Increases self attack by 30% for 3 turns.
2. **Skill 2: Breath of the Planet C (CD 7T)**:
   - Grants +50% NP gauge in PvP Duels; +100% NP gauge in Raids.
   - Increases self NP damage by 20% for 3 turns.
3. **Skill 3: Funny Vamp EX (CD 6T)**:
   - Party 1-attack, 3-turn Invincibility.
   - 100% Buff Removal Resistance for 1 turn.
   - If Millennium Castle Battlefield is active: charges party NP gauge (except self) by +30%.
4. **Passive: Ultimate One D**:
   - While Millennium Castle Battlefield is active: increases Quick, Arts, and Buster card performance by +30%.
5. **Noble Phantasm: Marble Phantasm (Buster, 800% multiplier, AoE)**:
   - Activates Millennium Castle Battlefield for 3 turns before damage resolution.
   - Switches arena background texture to the Millennium Castle webp asset.
   - Deals +200% super-effective damage against enemies with Chaotic alignment.
   - Overcharge: charges NP gauge of all allies (except self) by 40%.
6. **Craft Essence: Moon Margaret (CE 1671)**:
   - Increases party NP damage by 25% while equipped on Archetype: Earth and the field is Millennium Castle Battlefield.
