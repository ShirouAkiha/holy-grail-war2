# Paginated Dropdown Selection Architecture for Large Collections

Universal paginated dropdown selection system across all major Discord RPG command hubs (`/servant`, `/inventory`, `/customise`, `/bond`, `/gacha`). Resolves Discord's hard 25-option select menu limit by pairing paginated 20-item dropdown menus with dedicated `◀ Prev Page` and `▶ Next Page` navigation controls.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The confirmed choices from the Phase 1 questionnaire are integrated below:

- **Confirmed Decision 1: Paginated Dropdowns with Prev/Next Buttons**
  - Select menus will display up to **20 items per page** (leaving room for quick-action items), accompanied by `◀ Prev Page` and `▶ Next Page` button controls to seamlessly scroll through large rosters, CEs, and inventory items.
- **Confirmed Decision 2: Universal Upgrade Across Major Hubs**
  - Upgrades selection UI in `/servant`, `/inventory`, `/customise`, `/bond`, and `/gacha`.

---

## 1. Overview & Core Concept

Discord enforces a strict limit of **25 choices per `StringSelectMenuBuilder`**. When a player contracts 26+ Servants or holds 30+ Craft Essences, unpaginated select menus drop options past index 25 or throw API validation errors.

This architectural update introduces a standardized **Dropdown Pagination Pattern**:
1. **Paginated Items Window**: Select menus display a window of 20 items for the current page (`Page X of Y`).
2. **Page Navigation Row**: Action row below the select menu containing `◀ Prev Page` and `▶ Next Page` buttons with current page indicator badge (`Page X / Total Y`).
3. **Smart Target Retention**: When selecting a specific Servant or Craft Essence (e.g. via command parameter or active contract), that item is guaranteed to stay highlighted and selectable regardless of page index.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Viewing Workshop or Roster (`/servant`)**:
   - Master opens `/servant`. The dropdown displays `1. [MoonCancer] Archetype: Earth (Lv.1)` through `20. [Saber] Artoria Pendragon`.
   - Below the dropdown, navigation buttons read: `◀ Prev Page (Disabled)` | `Page 1 / 3` | `▶ Next Page`.
   - Clicking `▶ Next Page` advances the dropdown to items 21–40, preserving the active selection state and updating the embed roster list.

2. **Equipping & Feeding Craft Essences (`/inventory` & `/customise`)**:
   - Master views Owned CEs in `/inventory`.
   - The dropdown displays 20 CEs on Page 1.
   - Clicking `▶ Next Page` displays CEs 21–40.
   - Master picks a CE from Page 2 and clicks `Equip / Set Active`.

3. **Bond Sanctum Interludes & Gifts (`/bond`)**:
   - Master views Bond Roster in `/bond`.
   - Dropdown lists contracted Servants 20 at a time with page navigation.
   - Master selects Archetype: Earth on Page 2 to open her My Room Interludes and Gift Menu.

---

## 3. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DISCORD UI INTERACTION                          │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │   Embed Header: Master Inventory / Servant Workshop               │  │
│  │   Page X / Total Y • Total Items: N                              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │   StringSelectMenuBuilder (Max 20 Items for Page X)              │  │
│  │   [ 1. Servant A (Lv.1) ] [ 2. Servant B (Lv.80) ] ...            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌─────────────────────────┬───────────────────┬───────────────────┐  │
│  │ ◀ Prev Page             │ Page X / Y        │ ▶ Next Page       │  │
│  └─────────────────────────┴───────────────────┴───────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   STATE ENGINE & HANDLER PIPELINE                      │
│                                                                        │
│  1. Extract State: pageIndex, totalPages, targetId                     │
│  2. Slice Window: items.slice((page - 1) * 20, page * 20)              │
│  3. Ensure Active/Target Item is Injected                              │
│  4. Render Embed & ActionRows atomically                               │
└────────────────────────────────────────────────────────────────────────┘
```

### Affected Files & Component Upgrades

1. **`src/commands/servant.ts`**:
   - Add page state tracking (`pageIndex`) to `buildServantHub` and `attachServantCollector`.
   - Add pagination navigation row for `servant_sel_switch` select menu when `master.servants.length > 20`.

2. **`src/commands/customise.ts`**:
   - Update `buildInventoryHub` and `handleGlobalInventoryInteraction` so `category === 'servants'` and `category === 'ces'` use paginated select menus with Prev/Next buttons.

3. **`src/commands/bond.ts`**:
   - Update `buildBondRosterActionRows` and `handleBondSelectInteraction` to support paginated Servant selection for Bond Interludes and Gifts.

4. **`src/commands/gacha.ts`**:
   - Update CE/Servant Shop dropdowns to paginate if custom admin lists exceed 20 items.

---

## Verification Plan

### Automated Tests
- Run `lint_applet` (`npm run lint`) to ensure ESLint passes with 0 errors.
- Run `tsc --noEmit` to verify 100% clean TypeScript compilation.

### Manual Verification Scenarios
1. **Roster > 20 Servants**:
   - Verify that `/servant` displays Page 1 (items 1–20) with active `▶ Next Page` button.
   - Click `▶ Next Page` and verify items 21–26 (including Archetype: Earth) appear in the dropdown.
   - Select Archetype: Earth and confirm her profile card loads cleanly.
2. **Inventory CEs > 20 CEs**:
   - Open `/inventory category: ces`.
   - Verify page navigation buttons cycle through CE pages in both the embed and dropdown.
