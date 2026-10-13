# Implementation Plan - Canonical Parameter Rank Verification & Fixed Default Stat Ranks

Lock Servant stat parameter ranks to their canonical Fate/Type-Moon default ranks (`E` through `EX`), verify and audit all 25 Servants in the database against official lore, and display their default rank alongside increasing numeric scores and aptitude multipliers.

---

## 1. User Requirement Alignment & Decisions

Based on user answers:
- **Rank Behavior:** Each Servant will **keep their fixed default canon rank** permanently on display, rather than having the rank letter shift as stat points are invested. The numeric score and combat effectiveness scale upward with points, while the letter rank reflects their innate canonical Heroic Spirit identity.
- **Verification & Canon Accuracy:** All 25 Servants in `SERVANT_DATABASE` will have **explicit canonical parameter rank letters** (`paramRanks: { strength, endurance, agility, mana, luck }`) verified against official Type-Moon/Fate material, with base numeric stats synchronized to match standard rank thresholds (`E: 10, D: 12, C: 14, B: 16, A: 18, A+: 20, EX: 24`).

---

## 2. Proposed Changes

### A. TypeScript Type Definitions (`src/types.ts`)
- Add `ServantParameterRanks` interface:
  ```ts
  export interface ServantParameterRanks {
    strength: string;
    endurance: string;
    agility: string;
    mana: string;
    luck: string;
  }
  ```
- Add optional `paramRanks?: ServantParameterRanks` to `ServantTemplate`.

---

### B. Canon Audit & Verification across All 25 Servants (`src/data/servants.ts`)
Audit each Servant against official Type-Moon / Fate/Grand Order / Fate/stay night materials and add explicit `paramRanks`:

1. **Artoria Pendragon (Saber):**
   - Canon: STR: `B`, END: `B`, AGI: `C`, MNA: `B`, LCK: `B`
   - Base stats: `{ strength: 16, endurance: 16, agility: 14, mana: 16, luck: 16 }`
2. **Altera (Saber):**
   - Canon: STR: `B`, END: `A`, AGI: `A`, MNA: `B`, LCK: `A`
   - Base stats: `{ strength: 16, endurance: 18, agility: 18, mana: 16, luck: 18 }`
3. **Gilgamesh (Archer):**
   - Canon: STR: `B`, END: `C`, AGI: `B`, MNA: `B`, LCK: `A`
   - Base stats: `{ strength: 16, endurance: 14, agility: 16, mana: 16, luck: 18 }`
4. **Scáthach (Lancer):**
   - Canon: STR: `B`, END: `A`, AGI: `A`, MNA: `C`, LCK: `D`
   - Base stats: `{ strength: 16, endurance: 18, agility: 18, mana: 14, luck: 12 }`
5. **Jeanne d'Arc (Ruler):**
   - Canon: STR: `B`, END: `B`, AGI: `A`, MNA: `A`, LCK: `C`
   - Base stats: `{ strength: 16, endurance: 16, agility: 18, mana: 18, luck: 14 }`
6. **Jeanne d'Arc (Alter) (Avenger):**
   - Canon: STR: `A`, END: `C`, AGI: `A`, MNA: `A+`, LCK: `E`
   - Base stats: `{ strength: 18, endurance: 14, agility: 18, mana: 20, luck: 10 }`
7. **Mysterious Heroine X (Alter) (Berserker):**
   - Canon: STR: `A`, END: `B`, AGI: `B`, MNA: `A+`, LCK: `D`
   - Base stats: `{ strength: 18, endurance: 16, agility: 16, mana: 20, luck: 12 }`
8. **Artoria Pendragon (Alter) (Saber):**
   - Canon: STR: `A`, END: `A`, AGI: `D`, MNA: `A++`, LCK: `C`
   - Base stats: `{ strength: 18, endurance: 18, agility: 12, mana: 22, luck: 14 }`
9. **Nero Claudius (Saber):**
   - Canon: STR: `D`, END: `D`, AGI: `A`, MNA: `B`, LCK: `A`
   - Base stats: `{ strength: 12, endurance: 12, agility: 18, mana: 16, luck: 18 }`
10. **EMIYA (Archer):**
    - Canon: STR: `D`, END: `C`, AGI: `C`, MNA: `B`, LCK: `E`
    - Base stats: `{ strength: 12, endurance: 14, agility: 14, mana: 16, luck: 10 }`
11. **Heracles (Berserker):**
    - Canon: STR: `A+`, END: `A`, AGI: `A`, MNA: `A`, LCK: `B`
    - Base stats: `{ strength: 20, endurance: 18, agility: 18, mana: 18, luck: 16 }`
12. **Cú Chulainn (Lancer):**
    - Canon: STR: `B`, END: `C`, AGI: `A`, MNA: `C`, LCK: `E`
    - Base stats: `{ strength: 16, endurance: 14, agility: 18, mana: 14, luck: 10 }`
13. **Karna (Lancer):**
    - Canon: STR: `B`, END: `C`, AGI: `A`, MNA: `B`, LCK: `D`
    - Base stats: `{ strength: 16, endurance: 14, agility: 18, mana: 16, luck: 12 }`
14. **Artoria Caster (Caster):**
    - Canon: STR: `B`, END: `D`, AGI: `B`, MNA: `A`, LCK: `B`
    - Base stats: `{ strength: 16, endurance: 12, agility: 16, mana: 18, luck: 16 }`
15. **Typhon Ephemeros (Pretender):**
    - Canon: STR: `B`, END: `B`, AGI: `B`, MNA: `A`, LCK: `B`
    - Base stats: `{ strength: 16, endurance: 16, agility: 16, mana: 18, luck: 16 }`
16. **Van Gogh (Foreigner):**
    - Canon: STR: `E`, END: `D`, AGI: `C`, MNA: `A`, LCK: `E`
    - Base stats: `{ strength: 10, endurance: 12, agility: 14, mana: 18, luck: 10 }`
17. **Tamamo no Mae (Caster):**
    - Canon: STR: `E`, END: `E`, AGI: `B`, MNA: `A`, LCK: `D`
    - Base stats: `{ strength: 10, endurance: 10, agility: 16, mana: 18, luck: 12 }`
18. **Hassan-i-Sabbah (Azrael) (Grand Assassin):**
    - Canon: STR: `B`, END: `A`, AGI: `B`, MNA: `E`, LCK: `E`
    - Base stats: `{ strength: 16, endurance: 18, agility: 16, mana: 10, luck: 10 }`
19. **Okita Souji (Saber):**
    - Canon: STR: `B`, END: `E`, AGI: `A+`, MNA: `E`, LCK: `D`
    - Base stats: `{ strength: 16, endurance: 10, agility: 20, mana: 10, luck: 12 }`
20. **Aoko Aozaki (Caster):**
    - Canon: STR: `C`, END: `C`, AGI: `B`, MNA: `EX`, LCK: `B`
    - Base stats: `{ strength: 14, endurance: 14, agility: 16, mana: 24, luck: 16 }`
21. **Adiosa (Foreigner):**
    - Custom: STR: `A`, END: `A+`, AGI: `E`, MNA: `A+`, LCK: `E`
22. **Amamiya no Chihaya Tenkohime (Saber):**
    - Custom: STR: `C`, END: `D`, AGI: `A`, MNA: `A`, LCK: `D`
23. **Lucernalia Lyozes (Lancer):**
    - Custom: STR: `B`, END: `C`, AGI: `B+`, MNA: `B`, LCK: `D`
24. **Luvria Greenharte (Caster):**
    - Custom: STR: `D`, END: `C`, AGI: `B`, MNA: `A+`, LCK: `B`
25. **Edmond (Shielder):**
    - Custom: STR: `B`, END: `A+`, AGI: `D`, MNA: `D`, LCK: `C`

---

### C. Stat System Canon Rank Helper (`src/engine/statSystem.ts`)
- Add `getServantDefaultParamRank(servant, paramKey)` helper:
  - Returns `servant.template?.paramRanks?.[paramKey]` if defined.
  - Falls back to `getParameterRank(baseValue)` if not defined.
- Update `getParameterRankMultiplier` to read the Servant's default canonical rank for accurate aptitude multipliers (`EX: 1.45x, A+: 1.35x, A: 1.30x, B: 1.15x, C: 1.00x, D: 0.85x, E: 0.75x`).

---

### D. UI Presentation Overhaul (`src/commands/servant.ts` & `src/commands/servants.ts`)
- **Profile Embed (`/servant` -> Profile):**
  - Displays each parameter with its fixed canonical rank:
    `• Strength (STR): 16 [Rank B] • Endurance (END): 10 [Rank E]`
- **Parameter Point Allocation Embed (`/servant` -> Stats):**
  - Displays the numeric score alongside the fixed default rank and its growth aptitude:
    `💪 Strength (STR): 16 [Rank B] • (Growth Aptitude: +15%) — Increases base attack damage (+0 allocated, max 1000)`
    `🛡️ Endurance (END): 10 [Rank E] • (Growth Aptitude: -25%) — Increases max HP (+300 HP/pt) & up to 50% native damage reduction (+0 allocated, max 1000)`
    `⚡ Agility (AGI): 20 [Rank A+] • (Growth Aptitude: +35%) — Boosts crit generation & dodge (+0 allocated, max 1000)`
  - When the Master allocates 200 points to Strength:
    `💪 Strength (STR): 246 [Rank B] • (Growth Aptitude: +15%) — Increases base attack damage (+200 allocated, max 1000)`
    *(The numeric value scales up with investment, but the rank remains their canonical Heroic Spirit Rank B!)*
- **Roster Embed (`/servants`):**
  - Formats all canonical ranks directly from `paramRanks`:
    `• STR: 16 [Rank B] | END: 10 [Rank E] | AGI: 20 [Rank A+]`

---

## 3. Verification Plan
- Run automated simulation test using `npx tsx` across all 25 Servants to verify that all canonical ranks match official Type-Moon lore.
- Verify that Okita Souji displays:
  - STR: `[Rank B]` (+15% Aptitude)
  - END: `[Rank E]` (-25% Aptitude)
  - AGI: `[Rank A+]` (+35% Aptitude)
  - MNA: `[Rank E]` (-25% Aptitude)
  - LCK: `[Rank D]` (-15% Aptitude)
- Run `lint_applet` and `npx tsc --noEmit` to ensure zero compilation or typing regressions.
