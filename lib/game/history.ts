import type { GameState } from "@/lib/game/types";

export function pushGameHistory(state: GameState, reason: string): GameState {
  const { gameHistory: _history, ...stateWithoutHistory } = state;

  return {
    ...state,
    gameHistory: [
      ...state.gameHistory,
      {
        state: stateWithoutHistory,
        reason,
        createdAt: Date.now(),
      },
    ],
  };
}

export function undoLastAction(state: GameState): GameState {
  const snapshot = state.gameHistory[state.gameHistory.length - 1];

  if (!snapshot) {
    return state;
  }

  return {
    ...snapshot.state,
    gameHistory: state.gameHistory.slice(0, -1),
  };
}
