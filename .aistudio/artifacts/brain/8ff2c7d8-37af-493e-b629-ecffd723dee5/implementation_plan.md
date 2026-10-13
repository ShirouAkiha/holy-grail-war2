# Implementation Plan - Tank Balancing & Parameter Rank-Based Stat Scaling

Address extreme offensive burst damage (e.g. 120,000+ NP damage one-shots) by introducing Fate parameter rank-based stat aptitude scaling, upgraded Max HP endurance formulas, and Endurance-driven damage mitigation.

## Problem Analysis
Currently, allocated stat points grant flat, linear additions across all Servants regardless of their natural specialties:
- **Strength Scaling:** High Strength investment (`+900 STR * 80 ATK = +72,000 Base ATK`) interacts with high Noble Phantasm multipliers (1,000%–1,200%), yielding 100,000–130,000+ damage in a single hit.
- **Endurance Underperformance:** Endurance currently only grants `+150 HP` per point (`+900 END = +135,000 HP`) and a flat defense of `10 + END * 2` (only 1,810 DEF), which offers negligible mitigation against six-figure damage numbers.
- **Homogeneous Stat Growth:** Every Servant receives the exact same stat returns from points, meaning a frail glass cannon (e.g., C/E Endurance) and a natural fortress (e.g., A/EX Endurance like Heracles or Mash) scale identically.

---

## Proposed Changes

### 1. Parameter Rank Aptitude Multiplier System
Implement a canonical Fate rank aptitude multiplier function `getParameterRankMultiplier(rank: string): number`:
- **EX Rank:** `1.45x` aptitude growth (Transcendent, extreme returns)
- **A+ / A Rank:** `1.30x` – `1.35x` aptitude growth (Legendary fortress / powerhouse)
- **B+ / B Rank:** `1.15x` – `1.20x` aptitude growth (Above average proficiency)
- **C Rank:** `1.00x` aptitude growth (Baseline standard)
- **D Rank:** `0.85x` aptitude growth (Below average specialization)
- **E Rank:** `0.75x` aptitude growth (Frail / poor aptitude, e.g., Weak Constitution)

Each Servant's allocated stat points will be scaled by their natural parameter rank:
`effectiveStat = baseStat + allocatedPoints * rankMultiplier`

### 2. Enhanced Max HP Pool Scaling
Revise the Max HP formula in `src/commands/duel.ts` (and `src/commands/raid.ts`):
- Increase the Endurance HP coefficient from `150` to `300` HP per effective Endurance point.
- Add an Endurance percentage HP resilience bonus:
  `hpBonusPercent = (effectiveEndurance / 1000) * 25%`
- This ensures an Endurance-focused tank with 600–900 Endurance reliably possesses enough survivability to withstand sustained combat.

### 3. Endurance Damage Mitigation (Diminishing-Returns Curve)
Implement an armor/mitigation curve based on Endurance in damage resolution:
- Calculate a native damage reduction factor:
  `damageReductionPercent = Math.min(50, (effectiveEndurance / (effectiveEndurance + 800)) * 50)`
- This prevents a tank from being deleted on Turn 1 by unbuffed/raw bursts while maintaining meaningful damage values across long battles.
- Combine this with existing DEF buffs and damage cut mechanics without creating complete invulnerability.

### 4. UI / Profile Feedback
- Update the servant profile/status embed to show parameter rank badges and their aptitude rating (e.g., `Endurance: A [Aptitude: +30% Growth]`).

---

## Verification Plan
1. **Stat Calculation Tests:**
   - Verify that an `Endurance A` servant receives `+30%` extra HP and defense per point allocated compared to a `C` or `E` rank servant.
   - Verify that a 900 Endurance tank achieves adequate HP and damage reduction.
2. **Combat Duel Simulation:**
   - Simulate a duel with a high-damage NP attacker (e.g. Aoko Aozaki, 900 STR) against an Endurance tank (e.g. Heracles / Van Gogh with high END investment).
   - Confirm the tank survives the burst with tactical counterplay available.
3. **Regression Testing:**
   - Ensure raid boss battles and existing PvE duel flows continue functioning smoothly without breaking baseline mechanics.
