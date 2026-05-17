// Intended turn flow:
// 1. Player may play one action card.
// 2. Player must take the front noble.
// 3. Player draws one action card.
// 4. Noble line refills if possible.
// 5. Scores update.
// 6. Turn advances to the next player.
// 7. After the required day condition is met, advance day.
// 8. After Day 3 ends, calculate final winners.

import type { GameState, Player } from "@/lib/game/types";

export function getCurrentPlayer(state: GameState): Player | undefined {
  return state.players[state.currentPlayerIndex];
}

export function canUndoLastAction(state: GameState): boolean {
  return state.gameHistory.length > 0;
}
