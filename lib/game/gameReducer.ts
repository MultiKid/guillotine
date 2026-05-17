import { createLocalGameState } from "@/lib/game/createGame";
import { calculatePlayerScore } from "@/lib/game/scoring";
import { pushGameHistory, undoLastAction } from "@/lib/game/history";
import type { GameCommand, GameLogEntry, GameState, Player } from "@/lib/game/types";

export function gameReducer(state: GameState, command: GameCommand): GameState {
  switch (command.type) {
    case "START_GAME":
      return createLocalGameState(command.playerNames);
    case "TAKE_FRONT_NOBLE":
      return takeFrontNoble(state, command.playerId);
    case "UNDO_LAST_ACTION":
      return undoLastAction(state);
    case "PLAY_ACTION_CARD":
    case "END_TURN":
    case "START_NEXT_DAY":
      return state;
    default:
      return state;
  }
}

function takeFrontNoble(state: GameState, playerId: string): GameState {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const frontNoble = state.nobleLine.cards[0];

  if (state.phase !== "playing" || !currentPlayer || currentPlayer.id !== playerId || !frontNoble) {
    return state;
  }

  const historyState = pushGameHistory(state, `${currentPlayer.name} took ${frontNoble.card.name}.`);
  const [drawnAction, ...remainingActionDeck] = historyState.actionDeck.drawPile;
  const [replacementNoble, ...remainingNobleDeck] = historyState.nobleDeck.drawPile;
  const updatedNobleLine = historyState.nobleLine.cards.slice(1);

  if (replacementNoble) {
    updatedNobleLine.push(replacementNoble);
  }

  const updatedPlayers = historyState.players.map((player) => {
    if (player.id !== playerId) {
      return player;
    }

    const updatedPlayer: Player = {
      ...player,
      hand: drawnAction ? [...player.hand, drawnAction] : player.hand,
      collectedNobles: [...player.collectedNobles, frontNoble],
    };

    return {
      ...updatedPlayer,
      score: calculatePlayerScore(updatedPlayer),
    };
  });

  const nextPlayerIndex = getNextPlayerIndex(historyState.currentPlayerIndex, historyState.players.length);
  const gameEnded = updatedNobleLine.length === 0 && remainingNobleDeck.length === 0;

  return {
    ...historyState,
    phase: gameEnded ? "gameEnd" : "playing",
    players: updatedPlayers,
    currentPlayerIndex: gameEnded ? historyState.currentPlayerIndex : nextPlayerIndex,
    turnStep: "playActionOptional",
    actionDeck: {
      ...historyState.actionDeck,
      drawPile: remainingActionDeck,
    },
    nobleDeck: {
      ...historyState.nobleDeck,
      drawPile: remainingNobleDeck,
    },
    nobleLine: {
      cards: updatedNobleLine,
    },
    log: [
      createLogEntry(historyState, `${currentPlayer.name} took ${frontNoble.card.name} for ${frontNoble.card.points} points.`),
      ...historyState.log,
    ],
    winnerIds: gameEnded ? getWinnerIds(updatedPlayers) : [],
  };
}

function getNextPlayerIndex(currentIndex: number, playerCount: number): number {
  if (playerCount === 0) {
    return 0;
  }

  return (currentIndex + 1) % playerCount;
}

function createLogEntry(state: GameState, message: string): GameLogEntry {
  return {
    id: `log-${Date.now()}-${state.log.length + 1}`,
    message,
    day: state.day,
  };
}

function getWinnerIds(players: Player[]): string[] {
  const highScore = Math.max(...players.map((player) => player.score));
  return players.filter((player) => player.score === highScore).map((player) => player.id);
}
