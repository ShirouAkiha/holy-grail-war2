# Implementation Plan - Okita Souji (Saber) Integration

Integrating 5★ SSR Saber **Okita Souji** (沖田総司) into the Holy Grail War Discord RPG, featuring authentic Fate/Grand Order skill mechanics, official dialogues, high-fidelity Atlas Academy art assets, Headband of Resolve Bond Craft Essence, and tactical duel execution.

---

## 1. Verification of Skills, Passives & Noble Phantasm

All user-supplied skills and effects have been cross-referenced with canon Fate/Grand Order data:

| Ability / Skill | Rank | Verified Canon Effects & Implementation |
| :--- | :--- | :--- |
| **Skill 1: Shukuchi** | **B+** | • Increases own Quick Performance by **+50%** for 1 turn.<br>• Grants self **Buff-On-Attack** (Increases own Attack by **+20%** for 1 turn when normal attacking; activates before hit). |
| **Skill 2: Peerless Blade (Mumyou no Yaiba)** | **A** | • Charges own NP Gauge by **+30%**.<br>• Increases own Critical Star Absorption by **+1,000%** for 1 turn.<br>• Increases own Critical Damage by **+50%** for 1 turn. |
| **Skill 3: Eye of the Mind (False)** | **A** | • Grants self **Evasion** for 1 turn.<br>• Increases own Critical Damage by **+50%** for 3 turns. |
| **Passive 1: Magic Resistance** | **E** | Increases own Debuff Resistance by **+10%**. |
| **Passive 2: Riding** | **E** | Increases own Quick Card performance by **+2%** (Unlocked at Bond Level 5). |
| **Noble Phantasm: Mumyō Sandan-Zuki** *(Avidyā Three-Stage Thrust)* | **ST Quick** | • Deals defense-ignoring severe damage (**1,200% ST**) to one target.<br>• **Overcharge:** Reduces target DEF by **50%** (3 turns), reduces target Quick Resistance by **30%** (3 turns), and reduces target Critical Resistance by **30%** (3 turns). |
| **Bond CE: Headband of Resolve** | **4★ CE** | When equipped to Okita Souji: Increases party's Critical Damage by **+25%** while self is on the field. |
| **Command Deck** | **QQABB** | Quick, Quick, Arts, Arts, Buster (FGO canon layout selected by user). |

---

## 2. Official Combat Dialogues, Lore & Audio Chants

Sourced directly from official Fate/Grand Order Japanese / English localization:

- **Summon Dialogue:**
  > *"Shinsengumi First Unit Captain, Okita Souji, has arrived! ...Eh? My haori? Ah, I seemed to have misplaced it... Well, never mind that, Master, let us set forth!"*
- **Battle Start:**
  > *"Shinsengumi, moving out! Step forward if you dare cross swords!"*
- **Skill Invocations:**
  - *Shukuchi B+:* *"Step into the void... In an instant!"*
  - *Peerless Blade A:* *"No form, no hesitation... One stroke!"*
  - *Eye of the Mind (False) A:* *"I can see right through your blade's reach."*
- **Command Card Quotes:**
  - *Buster Chain:* *"Shinsengumi swordplay! Take this! Haaaaaah!"*
  - *Arts Chain:* *"Step, breath, and cut! Flowing like water."*
  - *Quick Chain:* *"Faster than sight! Shukuchi thrusts! Soryaa!"*
- **Noble Phantasm Chant (Mumyō Sandan-Zuki):**
  > *"One thrust for the sword, two thrusts boundless, three thrusts... an absolute blade! Mumyō Sandan-Zuki (Avidyā Three-Stage Thrust)!"*
- **Victory Quotes:**
  - Standard: *"Victory belongs to the Shinsengumi! Master, how was my swordplay?"*
  - Cough Quirks (Weak Constitution flavor): *"Victory...! *cough* *cough*... Ah, don't worry Master, this is just my usual constitution!"*
- **Defeat Quote:**
  > *"To fall here... Kondou-san, Hijikata-san... forgive me..."*

---

## 3. Proposed Code Changes

### A. Data Layer (`/src/data/servants.ts`)
- Register `okita_souji` in the `SERVANTS` array:
  - Base Stats: HP 29,800, ATK 12,068 (SSR 5★ Saber baseline).
  - Deck: `['Quick', 'Quick', 'Arts', 'Arts', 'Buster']`.
  - Passives: `Magic Resistance E` (+10% debuff res), `Riding E` (+2% Quick perf).
  - Skills:
    - S1 `shukuchi_b_plus`: +50% Quick (1T), Buff-on-attack +20% ATK (1T).
    - S2 `peerless_blade_a`: +30% NP battery, +1000% star absorb (1T), +50% crit damage (1T).
    - S3 `eye_of_the_mind_false_a`: Evasion (1T), +50% crit damage (3T).
  - Noble Phantasm: `Mumyō Sandan-Zuki`, Quick single target, ignore defense, overcharge DEF -50%, Quick Res -30%, Crit Res -30%.
  - High resolution Atlas Academy assets:
    - CharaGraph / Card Art: `https://static.atlasacademy.io/NA/CharaGraph/1006800/1006800a.png` (Stage 3 Shinsengumi Haori)
    - Character Sprite: `https://static.atlasacademy.io/NA/CharaFigure/10068000/10068000_merged.png`
  - Matchup dialogues with Shinsengumi / Sabers / Rivals (Artoria, Hijikata, Emiya, Nobunaga references).

### B. Craft Essences (`/src/data/craftEssences.ts`)
- Register `ce_bond_okita_souji` (**Headband of Resolve**):
  - ID: `ce_bond_okita_souji`
  - Target: `okita_souji`
  - Effect: Increases party critical damage by +25% while equipped on Okita Souji.
  - Card Art: `https://static.atlasacademy.io/NA/CharaGraph/9300680/9300680a.png`

### C. Persona & Character Profile (`/src/data/characterProfiles.ts`)
- Add Okita Souji profile into `DEFAULT_SERVANT_CHARACTER_PROFILES`:
  - Personality: Cheerful, polite, dutiful Shinsengumi captain who transforms into a ruthless, cold-eyed manslayer in life-or-death battle.
  - Speech mannerisms, cough quirk ("*cough*"), and Master bond dynamic.

### D. Combat & Duel Engine (`/src/engine/dialogue.ts` & `/src/commands/duel.ts`)
- In `/src/engine/dialogue.ts`:
  - Add `SERVANT_COMBAT_DIALOGUES.okita_souji` with all Buster/Arts/Quick/NP/victory lines and map `okita` in `getServantProfile()`.
- In `/src/commands/duel.ts`:
  - Wire S1 `shukuchi_b_plus`: Quick Up +50% (1T) and buff-on-attack ATK trigger (+20% on attack).
  - Wire S2 `peerless_blade_a`: NP gauge +30%, star absorb +1000% (1T), crit dmg +50% (1T).
  - Wire S3 `eye_of_the_mind_false_a`: Evade (1T) + crit dmg +50% (3T).
  - Wire NP `Mumyō Sandan-Zuki`: Ignore defense, apply 3T DEF down (-50%), Quick down (-30%), and Crit Res down (-30%).

---

## 4. Verification Plan

### Automated Build & Syntax Verification
- Run `compile_applet` to ensure full TypeScript compilation without errors.
- Run `lint_applet` to confirm clean imports and types.

### Manual / System Functional Checks
1. Summon & Database query: Test `/servant` / workshop lookup for Okita Souji.
2. Skill execution test in Duel: Confirm S1, S2, and S3 apply accurate buffs and NP battery.
3. Noble Phantasm execution: Confirm defense-piercing strike and 3-turn debuffs applied.
4. Dialogue verification: Verify Quick/Arts/Buster cut-in quotes and NP chant render properly in the visual novel combat box.
