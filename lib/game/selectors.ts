import type { GameState } from "@/lib/game/types";

export function selectCurrentPlayer(state: GameState) {
  return state.players[state.currentPlayerIndex];
}

export function selectIsGameOver(state: GameState): boolean {
  return state.phase === "gameEnd";
}

export function selectCanUndo(state: GameState): boolean {
  return state.gameHistory.length > 0;
}
