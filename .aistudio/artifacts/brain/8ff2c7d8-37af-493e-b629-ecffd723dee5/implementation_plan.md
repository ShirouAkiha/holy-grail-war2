# Implementation Plan: CE Vault, Lore Studio & Multi-Command Pagination Audit

Restore full CE Vault and Lore Studio workshop functionality in `/servant`, ensure Discord 5-action-row compliance across all states, and audit `/servant`, `/inventory`, `/bond`, and `/customise` for pagination and UI control integrity.

## Problem Analysis & Root Cause

1. **CE Vault Component Overflow & Truncation in `/servant`**:
   - When Masters have >20 servants, `/servant` renders:
     1. Top Category Navigation Bar (`categoryNavRow`)
     2. Roster Select Dropdown (`servant_sel_switch`)
     3. Roster Dropdown Pagination Controls (`servant_pagedrop_prev / next`)
   - This already consumes 3 rows. Adding CE sub-tabs, quick feed rows, CE select menus, and cross-hub shortcuts pushes total rows to 6–7.
   - Discord enforces a strict maximum of **5 action rows** per message. The engine’s safety slicing (`components.slice(0, 5)`) causes quick feed buttons, CE menus, or shortcut rows to be dropped.
   - In `feed_ce` category, the condition `if (components.length < 4)` fails when roster pagination is present, causing quick feed controls to be missing or cramped.

2. **Lore Studio Modal Triggers Missing in `/servant`**:
   - The backend modal handlers for `servant_act_open_dialogue_modal_combat`, `servant_act_open_dialogue_modal_tactical`, and `servant_act_open_dialogue_modal_faceoff` are fully implemented in `src/commands/servant.ts`.
   - However, the action row with the buttons triggering these three modals (Combat, Tactical, Face-Off) and Reset Defaults was omitted from `buildServantHub()` when rendering the `dialogue` tab.

3. **Cross-Command Pagination Audit (`/servant`, `/inventory`, `/bond`, `/customise`)**:
   - Verify pagination bounds, empty state fallbacks, button state synchronization (`disabled` states), and 5-row limit compliance across all views and sub-views.

---

## Proposed Changes & Architecture

### 1. `src/commands/servant.ts` — CE Vault Architecture & 5-Row Harmony
- **Adaptive Row Budgeting**:
  - Keep Discord's 5-row ceiling strictly respected in all scenarios (≤20 servants and >20 servants).
  - When in `equip_ce` view:
    - **Row 1**: Top Category Tabs (Parameters, Stat Points, Ascension, CE Vault, Lore & Studio)
    - **Row 2**: Servant Switcher Menu (with inline page indicator in placeholder)
    - **Row 3**: CE Vault Sub-Tab Row: `Equip CE` (active) | `Feed CEs` | `Unequip CE` (if equipped) | `Set Active`
    - **Row 4**: CE Select Menu (`servant_sel_equip_ce`) with pagination/filtering info
    - **Row 5**: Contextual action row: Roster Prev/Next buttons (if >20 servants) AND Cross-hub shortcut buttons, consolidated so it never exceeds 5 buttons per row.
  - When in `feed_ce` view:
    - **Row 1**: Top Category Tabs
    - **Row 2**: Servant Switcher Menu
    - **Row 3**: Sub-Tabs: `Equip CE` | `Feed CEs` (active) | `Reclaim EXP`
    - **Row 4**: Quick Feed Actions: `Feed Embers` (✨) | `Feed 1-3★` (⚡) | `Feed Dupes` (🔥) | `Feed All` (☣️) | `Unlock All` (🔓)
    - **Row 5**: Synthesis Multi-Select Menu (`servant_sel_feed_ce`) for targeted CE synthesis. (If roster pagination is needed, integrate compact page buttons into the action layout seamlessly).

### 2. `src/commands/servant.ts` — Lore Studio Modal Buttons Restoration
- In `category === 'dialogue'`:
  - Add the Lore Studio Modal Action Row:
    - `Combat Lines` (🔴 / `servant_act_open_dialogue_modal_combat`)
    - `Tactical & Stances` (⚔️ / `servant_act_open_dialogue_modal_tactical`)
    - `Rival Face-Off` (🔥 / `servant_act_open_dialogue_modal_faceoff`)
    - `Reset Lore` (✨ / `servant_act_reset_dialogue`)
  - Ensure the voice line preset select menu (`servant_sel_voice_preset`) and sub-tabs (`Voice Lines` | `Noble Phantasm` | `Roster`) stay within the 5-row limit.

### 3. `src/commands/customise.ts` & `/inventory` — CE Vault & Inventory Audit
- Audit `buildInventoryHub` and `attachInventoryCollector`:
  - Verify that `inv_page_prev` and `inv_page_next` correctly paginate all categories: CEs (all/owned/rarity), Servants, Seals, and Vault Items.
  - Check that the 5-row limit is strictly preserved when filter pills are present (Row 1: Categories, Row 2: Filter Pills, Row 3: Select Menu, Row 4: Page Prev/Next + Equip + Lore, Row 5: Secondary Actions).
  - Verify that unlocking, equipping, and viewing art work reliably without breaking collector state.

### 4. `src/commands/bond.ts` — Bond Sanctum Roster & Visual Novel Pagination Audit
- Audit `buildBondRosterActionRows` and `buildBondSanctumActionRows`:
  - Ensure `vn_roster_prev_*` and `vn_roster_next_*` correctly cycle through contracted servants.
  - Ensure Visual Novel scene chunks and interlude choices do not exceed action row limits or Discord payload size.

---

## Verification Plan

1. **Compilation & Syntax Validation**:
   - Run `compile_applet` to ensure TypeScript builds cleanly with zero errors.
   - Run `lint_applet` to confirm clean imports, typing, and absence of syntax issues.

2. **Functional UI Matrix Checks**:
   - **`/servant` CE Vault**:
     - Check `equip_ce` tab: Confirm `Equip CE` and `Feed CEs` sub-tab buttons render, CE select menu opens, equipping/unequipping updates servant embed.
     - Check `feed_ce` tab: Confirm Quick Feed buttons (`Feed Embers`, `Feed 1-3★`, `Feed Dupes`, `Feed All`, `Unlock All`, `Reclaim EXP`) and the multi-select menu all display and function without exceeding 5 rows.
   - **`/servant` Lore Studio**:
     - Check `dialogue` tab: Confirm buttons for `Combat Lines`, `Tactical & Stances`, and `Rival Face-Off` render properly and open their respective Discord modals (`modal_quotes_combat`, `modal_quotes_tactical`, `modal_quotes_faceoff`).
     - Test submitting each modal to verify custom quotes persist to database.
   - **Pagination Checks**:
     - Test roster navigation with 1, 5, 21+ servants to confirm previous/next controls stay within 5 rows and never push out essential gameplay buttons.
     - Test `/inventory` pagination across all tabs (CEs, Servants, Seals, Items).
     - Test `/bond` roster pagination and sanctum switching.
