import { createLocalGameState } from "@/lib/game/createGame";
import { applyActionEffect, canApplyActionEffect } from "@/lib/game/effects";
import { NOBLE_LINE_SIZE, STARTING_HAND_SIZE } from "@/lib/game/constants";
import { shuffleDeck } from "@/lib/game/deck";
import { pushGameHistory, undoLastAction } from "@/lib/game/history";
import { calculatePlayerScore } from "@/lib/game/scoring";
import type {
  ActionTarget,
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
    case "READY_FOR_TURN":
      return readyForTurn(state);
    case "RELOAD_TEST_HAND":
      return state.passScreen.visible ? state : reloadTestHand(state, command.playerId);
    case "UNDO_LAST_ACTION":
      return undoLastAction(state);
    case "PLAY_ACTION_CARD":
      return state.passScreen.visible ? state : playActionCard(state, command.playerId, command.cardId, command.target);
    case "TAKE_FRONT_NOBLE":
      return state.passScreen.visible ? state : takeFrontNoble(state, command.playerId);
    case "END_TURN":
    case "START_NEXT_DAY":
      return state;
    default:
      return state;
  }
}

function reloadTestHand(state: GameState, playerId: PlayerId): GameState {
  const currentPlayer = state.players[state.currentPlayerIndex];

  if (state.phase !== "playing" || !currentPlayer || currentPlayer.id !== playerId) {
    return state;
  }

  const historyState = pushGameHistory(state, `${currentPlayer.name} reloaded their test hand.`);
  const player = historyState.players.find((candidate) => candidate.id === playerId);

  if (!player) {
    return state;
  }

  const testPool = shuffleDeck([
    ...player.hand,
    ...historyState.actionDeck.drawPile,
    ...historyState.actionDeck.discardPile,
  ]);
  const newHand = testPool.slice(0, STARTING_HAND_SIZE);
  const remainingActions = testPool.slice(newHand.length);

  return {
    ...historyState,
    players: historyState.players.map((candidate) =>
      candidate.id === playerId
        ? {
            ...candidate,
            hand: newHand,
          }
        : candidate,
    ),
    actionDeck: {
      drawPile: remainingActions,
      discardPile: [],
    },
    log: [
      createLogEntry(
        historyState,
        `${currentPlayer.name} reloaded a fresh test hand of ${newHand.length} action card${newHand.length === 1 ? "" : "s"}.`,
        playerId,
      ),
      ...historyState.log,
    ],
  };
}

function readyForTurn(state: GameState): GameState {
  if (!state.passScreen.visible) {
    return state;
  }

  return {
    ...state,
    passScreen: {
      visible: false,
    },
  };
}

function playActionCard(
  state: GameState,
  playerId: PlayerId,
  cardId: CardInstanceId,
  target?: ActionTarget,
): GameState {
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

  if (!actionCard || !canApplyActionEffect(state, actionCard.card.effectKey, { playerId, target })) {
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

  const result = applyActionEffect(stateWithoutCardInHand, actionCard.card.effectKey, { playerId, target });

  if (!result.applied) {
    return state;
  }

  const stateWithDiscard: GameState = {
    ...result.state,
    passScreen: {
      visible: false,
    },
    actionDeck: {
      ...result.state.actionDeck,
      discardPile: [actionCard, ...result.state.actionDeck.discardPile],
    },
    log: [
      createLogEntry(
        result.state,
        result.logMessage ?? `${currentPlayer.name} played ${actionCard.card.name} and ${result.message}.`,
        playerId,
      ),
      ...result.state.log,
    ],
  };

  if (stateWithDiscard.nobleLine.cards.length === 0 && !result.skipEmptyLineDayEnd) {
    return endCurrentDay(stateWithDiscard, "The noble line is empty.");
  }

  if (result.endsTurn) {
    return showPassScreen({
      ...stateWithDiscard,
      currentPlayerIndex: getNextPlayerIndex(stateWithDiscard.currentPlayerIndex, stateWithDiscard.players.length),
      turnStep: "playActionOptional",
      turnEffects: {
        endDayAfterTurn: false,
      },
    });
  }

  return {
    ...stateWithDiscard,
    turnStep: result.allowsAnotherAction ? "playActionOptional" : "takeNobleRequired",
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
  const updatedNobleLine = historyState.nobleLine.cards.slice(1);

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
  const nextState: GameState = {
    ...historyState,
    phase: "playing",
    players: updatedPlayers,
    currentPlayerIndex: nextPlayerIndex,
    turnStep: "playActionOptional",
    passScreen: {
      visible: false,
    },
    actionDeck: {
      ...historyState.actionDeck,
      drawPile: remainingActionDeck,
    },
    nobleDeck: historyState.nobleDeck,
    nobleLine: {
      cards: updatedNobleLine,
    },
    log: [
      createLogEntry(historyState, `${currentPlayer.name} took ${frontNoble.card.name} for ${frontNoble.card.points} points.`, playerId),
      ...historyState.log,
    ],
    winnerIds: [],
  };

  if (updatedNobleLine.length === 0) {
    return endCurrentDay(nextState, `Day ${nextState.day} ended because the noble line is empty.`);
  }

  const dayResolvedState = nextState.turnEffects.endDayAfterTurn
    ? endCurrentDay(nextState, `Scarlet Pimpernel ended Day ${nextState.day}.`)
    : nextState;

  return dayResolvedState.phase === "gameEnd" ? dayResolvedState : showPassScreen(dayResolvedState);
}

function endCurrentDay(state: GameState, reason: string): GameState {
  const discardedNobles = state.nobleLine.cards;
  const nextDay = state.day + 1;
  const baseLog = [
    createLogEntry(
      state,
      `${reason} Discarded ${discardedNobles.length} noble${discardedNobles.length === 1 ? "" : "s"} from the line.`,
    ),
    ...state.log,
  ];

  if (state.day >= state.maxDays) {
    return finishGame({
      ...state,
      nobleDeck: {
        ...state.nobleDeck,
        discardPile: [...discardedNobles, ...state.nobleDeck.discardPile],
      },
      nobleLine: {
        cards: [],
      },
      log: baseLog,
    });
  }

  const nextLine = state.nobleDeck.drawPile.slice(0, NOBLE_LINE_SIZE);
  const remainingNobleDeck = state.nobleDeck.drawPile.slice(nextLine.length);

  if (nextLine.length === 0) {
    return finishGame({
      ...state,
      nobleDeck: {
        drawPile: [],
        discardPile: [...discardedNobles, ...state.nobleDeck.discardPile],
      },
      nobleLine: {
        cards: [],
      },
      log: baseLog,
    });
  }

  return showPassScreen({
    ...state,
    day: nextDay,
    phase: "playing",
    turnStep: "playActionOptional",
    turnEffects: {
      endDayAfterTurn: false,
    },
    passScreen: {
      visible: false,
    },
    nobleDeck: {
      drawPile: remainingNobleDeck,
      discardPile: [...discardedNobles, ...state.nobleDeck.discardPile],
    },
    nobleLine: {
      cards: nextLine,
    },
    log: baseLog,
    winnerIds: [],
  });
}

function showPassScreen(state: GameState): GameState {
  return {
    ...state,
    passScreen: {
      visible: true,
    },
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

function finishGame(state: GameState): GameState {
  return {
    ...state,
    phase: "gameEnd",
    passScreen: {
      visible: false,
    },
    turnEffects: {
      endDayAfterTurn: false,
    },
    winnerIds: getWinnerIds(state.players),
  };
}

function getWinnerIds(players: Player[]): string[] {
  const highScore = Math.max(...players.map((player) => player.score));
  return players.filter((player) => player.score === highScore).map((player) => player.id);
}


