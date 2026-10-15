# Fix Servant Noble Phantasm Lines Bug & Dialogue Profile Resolution

Fixes the issue where all Servants were displaying the exact same Noble Phantasm line ("Sword of Promised Victory... EXCALIBUR!") during battles and commands.

> [!IMPORTANT]
> **Root Cause Identified**:
> 1. **Hardcoded Fallback in Battle Engine (`lib/engine/battle.ts`)**: When `actor.noblePhantasm?.chant` was missing or unpopulated on combatants, `generateTurnDialogueQuote` defaulted to `"Sword of Promised Victory... EXCALIBUR!"`.
> 2. **Class Keyword Pollution in Dialogue Profiles (`src/engine/dialogue.ts`)**: `getServantProfile` checked generic class keywords (e.g. `n.includes('saber')`, `n.includes('archer')`, `n.includes('berserker')`) before specific servant names. Because servant names are formatted like `"Adiosa (Saber)"` or `"Lucia Lyozes (Saber)"`, all Sabers matched `saber` and returned Artoria's dialogue profile.
> 3. **Name Parsing in NP Chant Resolver (`src/data/noblePhantasmGifs.ts`)**: `getNoblePhantasmChant` did not strip trailing class parentheses `"(Saber)"`, causing dictionary lookups in `NOBLE_PHANTASM_GIFS` to fail for formatted servant names.

---

## 1. Overview & Core Concept

When Servants activate their Noble Phantasm in duels, raids, combat logs, or card previews, they should display their authentic, unique NP chant (e.g. Gilgamesh's *Enuma Elish*, Emiya's *Unlimited Blade Works*, Okita's *Mumyō Sandan-Zuki*, Adiosa's *Azure-Magenta Ruin*, etc.) rather than repeating Artoria Pendragon's *Excalibur* chant.

---

## 2. User Experience & Visual Design

- **Combat Logs & Banners**: During combat turns, activating a Noble Phantasm will display the Servant's exact NP incantation in the combat log and canvas cut-in banner.
- **Duel & Raid Embeds**: All combatants (players, AI rivals, raid bosses, and summoned Servants) will showcase their distinct dialogue and chants.
- **Servant Information Cards**: Calling `/servant` or inspecting Servant details will consistently show their actual NP chant line.

---

## 3. Key Technical Fixes & Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Servant / Combatant                      │
│            e.g. name = "Lucia Lyozes (Saber)"               │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               Name Sanitizer & Parser                       │
│    Strips "(Class)" -> rawName = "Lucia Lyozes"              │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐┌─────────────────────────────┐
│   getNoblePhantasmChant      ││      getServantProfile      │
│ Checks:                      ││ Checks specific name rules  │
│ 1. customQuotes.noblePhantasm││ BEFORE generic class tags   │
│ 2. noblePhantasm.chant       ││ (saber, archer, berserker) │
│ 3. NOBLE_PHANTASM_GIFS       │└──────────────┬──────────────┘
│ 4. SERVANT_DATABASE          │               │
└──────────────┬───────────────┘               │
               │                               │
               └───────────────┬───────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Combat Log & Canvas Renderer                │
│    Renders unique NP Chant & Dialogue Profile for Servant   │
└─────────────────────────────────────────────────────────────┘
```

### Planned Changes

1. **Fix `getServantProfile` in `src/engine/dialogue.ts`**:
   - Strip class tags `(Saber)`, `(Archer)`, `(Lancer)`, `(Caster)`, `(Rider)`, `(Berserker)`, `(Assassin)`, `(Avenger)`, `(Ruler)`, etc., from `servantName` before checking keywords.
   - Reorder keyword checks so specific Servant names (e.g., `okita`, `nero`, `adiosa`, `lucia`, `aoko`, `amamiya`, `altera`, `karna`, `mordred`) are matched BEFORE checking general class words like `saber`, `archer`, `berserker`, `ruler`.

2. **Fix `getNoblePhantasmChant` in `src/data/noblePhantasmGifs.ts`**:
   - Clean `servantOrTemplate.name` and `id` by stripping parenthetical class suffixes before matching against `NOBLE_PHANTASM_GIFS` and `CUSTOM_NP_ANIMATIONS_REGISTRY`.
   - Fall back to checking `SERVANT_DATABASE` by ID/name if not directly defined in `NOBLE_PHANTASM_GIFS`.

3. **Fix `generateTurnDialogueQuote` in `lib/engine/battle.ts`**:
   - Replace the hardcoded default `"Sword of Promised Victory... EXCALIBUR!"` on line 2052 with a dynamic fallback using `getNoblePhantasmChant(actor)`.

4. **Ensure `ActiveCombatant` Initializers Populate Chant**:
   - Ensure all battle state creation logic in `lib/engine/battle.ts`, `src/engine/battle.ts`, `src/commands/duel.ts`, and `src/commands/raid.ts` sets `noblePhantasm.chant` using `getNoblePhantasmChant(servant)` during combatant initialization.

---

## 4. Verification Plan

- Run TypeScript build check (`npx tsc --noEmit`) to ensure zero type errors.
- Run `npm run lint` / `lint_applet` to confirm clean static analysis.
- Execute test scripts verifying that `getServantProfile` and `getNoblePhantasmChant` return distinct NP lines for all Servants (including Sabers, Archers, Berserkers, etc.).
