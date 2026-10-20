# Raid Battle Auto-Relay to Bottom of Channel

Re-enable the auto-relay behavior in raid battles so that at the start of each new turn/round, the previous battle embed is deleted and a fresh battle message is sent at the bottom of the channel (matching `/duel`), while keeping in-place edits for card selection and mid-turn strike previews.

## User Review & Critical Decisions

> [!IMPORTANT]
> The user confirmed the exact desired flow:
> - **New Round/Turn Auto-Relay**: On new turns/rounds, auto-delete the previous raid battle embed and send a fresh embed at the bottom of the channel (matching `/duel`).
> - **Mid-Turn In-Place Edits**: During card selection and the 2.5s player strike animation, edit the message in-place so buttons and attack previews update instantly without chat spam.

## 1. Overview & Core Concept

When a raid battle advances to a new turn or round (after player actions and boss turn resolution), the bot will send a fresh battle message with the updated canvas image, status, and interactive buttons at the bottom of the text channel, then delete the preceding battle message.

This ensures the raid control UI is always at the very bottom of Discord chat, making it easily accessible even if players send text messages during combat.

## 2. User Experience & Visual Design

- **Card Selection**: Clicking card buttons (`#1`, `#2`, `#3`) updates the current battle message in-place with selected card indicators.
- **Player Strike Phase**: When 3 cards are submitted, the battle message edits in-place to show the player's strike damage HUD and updated boss HP bar for 2.5 seconds.
- **New Turn Auto-Relay**: Once the boss executes its turn and a new round begins, the bot sends a fresh battle embed at the bottom of the channel, registers the new message ID in `raidMessageIds`, and deletes the previous battle message.

## 3. Key Product Decisions & Trade-Offs

```
┌─────────────────────────────────────────────────────────────┐
│                 Raid Turn Lifecycle                         │
└──────────────────────────────┬──────────────────────────────┘
                               │
            Card Selection / Skill Activation
                               │ (In-Place Edit)
                               ▼
            3 Cards Submitted: Execute Strike
                               │ (In-Place Edit)
                               ▼
            2.5s Pause -> Boss Turn Resolution
                               │
                               ▼
            New Turn / Round Reached
                               │
                               ▼
       ┌───────────────────────────────────────────┐
       │ 1. send({ fresh battle embed }) at bottom │
       │ 2. battleMsg = newBattleMsg               │
       │ 3. raidMessageIds.add(newBattleMsg.id)    │
       │ 4. prevMsg.delete()                       │
       └───────────────────────────────────────────┘
```

- **In-Place Edits during Combat Actions**: Prevents rate-limits and message deletion race conditions during rapid button clicking (card picking/clearing).
- **Auto-Relay on New Round**: Guarantees the battle board stays visible at the bottom of the channel after every round.

## 4. Technical Implementation Plan

1. **`renderAndPostTurn(isMidTurnStrike = false)` in `src/commands/raid.ts`**:
   - Add an optional `isMidTurnStrike` parameter to differentiate between in-turn strike previews and new round transitions.
   - If `isMidTurnStrike` is `true`: edit `battleMsg` in-place (`await battleMsg.edit(...)`).
   - If `isMidTurnStrike` is `false` (default):
     - Attempt `channelToSend.send(...)` to post the fresh turn embed at the bottom of the channel.
     - Add `newBattleMsg.id` to `raidMessageIds`.
     - Update `battleMsg = newBattleMsg`.
     - Delete `prevMsg` (`await prevMsg.delete().catch(() => {})`).
     - Fall back to in-place edit if `channelToSend.send` fails.

2. **Attack Sequence Execution**:
   - Call `renderAndPostTurn(true)` when displaying the player strike damage preview.
   - Execute `executeBossTurn(battleState)`.
   - Call `renderAndPostTurn(false)` at the start of the new round to post the fresh embed at the bottom and delete the old one.

3. **Validation & Typecheck**:
   - Run `lint_applet` to verify zero TypeScript or ESLint errors.
