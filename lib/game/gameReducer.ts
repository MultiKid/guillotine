import { createLocalGameState } from "@/lib/game/createGame";
import { applyActionEffect, canApplyActionEffect } from "@/lib/game/effects";
import { pushGameHistory, undoLastAction } from "@/lib/game/history";
import { calculatePlayerScore } from "@/lib/game/scoring";
import type {
  CardInstanceId,
  GameCommand,
  GameLogEntry,
  GameState,
  Player,
  PlayerId,
} from "@/lib/game/types";

export function gameReducer(state: GameState, command: GameCommand): GameState {
  switch (command.type) {
    case "START_GAME":
      return createLocalGameState(command.playerNames);
    case "PLAY_ACTION_CARD":
      return playActionCard(state, command.playerId, command.cardId);
    case "TAKE_FRONT_NOBLE":
      return takeFrontNoble(state, command.playerId);
    case "UNDO_LAST_ACTION":
      return undoLastAction(state);
    case "END_TURN":
    case "START_NEXT_DAY":
      return state;
    default:
      return state;
  }
}

function playActionCard(state: GameState, playerId: PlayerId, cardId: CardInstanceId): GameState {
  const currentPlayer = state.players[state.currentPlayerIndex];

  if (
    state.phase !== "playing" ||
    state.turnStep !== "playActionOptional" ||
    !currentPlayer ||
    currentPlayer.id !== playerId
  ) {
    return state;
  }

  const actionCard = currentPlayer.hand.find((card) => card.instanceId === cardId);

  if (!actionCard || !canApplyActionEffect(state, actionCard.card.effectKey, { playerId })) {
    return state;
  }

  const historyState = pushGameHistory(state, `${currentPlayer.name} played ${actionCard.card.name}.`);
  const stateWithoutCardInHand: GameState = {
    ...historyState,
    players: historyState.players.map((player) =>
      player.id === playerId
        ? {
            ...player,
            hand: player.hand.filter((card) => card.instanceId !== cardId),
          }
        : player,
    ),
  };

  const result = applyActionEffect(stateWithoutCardInHand, actionCard.card.effectKey, { playerId });

  if (!result.applied) {
    return state;
  }

  return {
    ...result.state,
    turnStep: "takeNobleRequired",
    actionDeck: {
      ...result.state.actionDeck,
      discardPile: [actionCard, ...result.state.actionDeck.discardPile],
    },
    log: [
      createLogEntry(
        result.state,
        `${currentPlayer.name} played ${actionCard.card.name} and ${result.message}.`,
        playerId,
      ),
      ...result.state.log,
    ],
  };
}

function takeFrontNoble(state: GameState, playerId: PlayerId): GameState {
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
      createLogEntry(historyState, `${currentPlayer.name} took ${frontNoble.card.name} for ${frontNoble.card.points} points.`, playerId),
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

function createLogEntry(state: GameState, message: string, playerId?: PlayerId): GameLogEntry {
  return {
    id: `log-${Date.now()}-${state.log.length + 1}`,
    message,
    day: state.day,
    playerId,
  };
}

function getWinnerIds(players: Player[]): string[] {
  const highScore = Math.max(...players.map((player) => player.score));
  return players.filter((player) => player.score === highScore).map((player) => player.id);
}
