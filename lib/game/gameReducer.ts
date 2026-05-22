import { createLocalGameState } from "@/lib/game/createGame";
import {
  applyAfterActionCardTriggers,
  applyActionEffect,
  applyBeforeNobleCollectionTriggers,
  applyNobleCollectionTriggers,
  canApplyActionEffect,
} from "@/lib/game/effects";
import { NOBLE_LINE_SIZE, STARTING_HAND_SIZE } from "@/lib/game/constants";
import { shuffleDeck } from "@/lib/game/deck";
import { pushGameHistory, undoLastAction } from "@/lib/game/history";
import { calculateNobleScoreValue, calculatePlayerScore } from "@/lib/game/scoring";
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
    case "DISMISS_NOTICE":
      return {
        ...state,
        notice: undefined,
      };
    case "RELOAD_TEST_HAND":
      return state.passScreen.visible ? state : reloadTestHand(state, command.playerId);
    case "DISCARD_CALLOUS_GUARDS":
      return state.passScreen.visible ? state : discardCallousGuards(state, command.playerId, command.cardId);
    case "RESOLVE_INFIGHTING":
      return state.passScreen.visible ? state : resolveInfighting(state, command.playerId, command.cardIds);
    case "RESOLVE_CLERICAL_ERROR_RETURN":
      return state.passScreen.visible ? state : resolveClericalErrorReturn(state, command.playerId, command.nobleId);
    case "RESOLVE_INNOCENT_VICTIM_DISCARD":
      return state.passScreen.visible ? state : resolveInnocentVictimDiscard(state, command.playerId, command.cardId);
    case "RESOLVE_CLOWN_GIFT":
      return state.passScreen.visible ? state : resolveClownGift(state, command.playerId, command.targetPlayerId);
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

function resolveInfighting(state: GameState, playerId: PlayerId, cardIds: CardInstanceId[]): GameState {
  const pending = state.pendingChoice;

  if (state.phase !== "playing" || pending?.type !== "infighting" || pending.targetPlayerId !== playerId) {
    return state;
  }

  const targetPlayer = state.players.find((player) => player.id === playerId);

  if (!targetPlayer) {
    return state;
  }

  const requiredDiscardCount = Math.min(2, targetPlayer.hand.length);
  const uniqueCardIds = [...new Set(cardIds)];
  const chosenCards = uniqueCardIds
    .map((cardId) => targetPlayer.hand.find((card) => card.instanceId === cardId))
    .filter((card): card is NonNullable<typeof card> => Boolean(card));

  if (chosenCards.length !== requiredDiscardCount) {
    return state;
  }

  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId
        ? {
            ...player,
            hand: player.hand.filter((card) => !uniqueCardIds.includes(card.instanceId)),
          }
        : player,
    ),
    actionDeck: {
      ...state.actionDeck,
      discardPile: [...chosenCards, ...state.actionDeck.discardPile],
    },
    pendingChoice: undefined,
    returningFromPrivateChoice: true,
    passScreen: {
      visible: true,
    },
    log: [
      createLogEntry(state, `${targetPlayer.name} discarded ${chosenCards.length} action card${chosenCards.length === 1 ? "" : "s"} for Infighting.`, playerId),
      ...state.log,
    ],
  };
}

function resolveClericalErrorReturn(state: GameState, playerId: PlayerId, nobleId?: CardInstanceId): GameState {
  const pending = state.pendingChoice;

  if (state.phase !== "playing" || pending?.type !== "clericalErrorReturn" || pending.targetPlayerId !== playerId) {
    return state;
  }

  const originalPlayer = state.players.find((player) => player.id === pending.originalPlayerId);
  const targetPlayer = state.players.find((player) => player.id === playerId);
  const eligibleNobles =
    originalPlayer?.collectedNobles.filter((noble) => noble.instanceId !== pending.excludedNobleInstanceId) ?? [];

  if (!originalPlayer || !targetPlayer) {
    return state;
  }

  if (eligibleNobles.length === 0) {
    return {
      ...state,
      pendingChoice: undefined,
      returningFromPrivateChoice: true,
      passScreen: {
        visible: true,
      },
    };
  }

  const chosenNoble = eligibleNobles.find((noble) => noble.instanceId === nobleId);

  if (!chosenNoble) {
    return state;
  }

  const transferredState = transferCollectedNobleInReducer(state, pending.originalPlayerId, playerId, chosenNoble.instanceId);
  const triggered = applyNobleCollectionTriggers(transferredState, playerId, chosenNoble, { triggerClown: false });

  return {
    ...triggered.state,
    pendingChoice: undefined,
    returningFromPrivateChoice: true,
    passScreen: {
      visible: true,
    },
    log: [
      ...triggered.logMessages.map((message) => createLogEntry(triggered.state, message, playerId)),
      createLogEntry(triggered.state, `${targetPlayer.name} completed the Clerical Error exchange with ${originalPlayer.name}.`, playerId),
      ...triggered.state.log,
    ],
  };
}

function resolveInnocentVictimDiscard(state: GameState, playerId: PlayerId, cardId?: CardInstanceId): GameState {
  const pending = state.pendingChoice;

  if (state.phase !== "playing" || pending?.type !== "innocentVictimDiscard" || pending.targetPlayerId !== playerId) {
    return state;
  }

  const targetPlayer = state.players.find((player) => player.id === playerId);

  if (!targetPlayer) {
    return state;
  }

  if (targetPlayer.hand.length === 0) {
    return {
      ...state,
      pendingChoice: undefined,
      returningFromPrivateChoice: pending.returnToPassScreen,
      passScreen: {
        visible: pending.returnToPassScreen,
      },
    };
  }

  const chosenCard = targetPlayer.hand.find((card) => card.instanceId === cardId);

  if (!chosenCard) {
    return state;
  }

  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId
        ? {
            ...player,
            hand: player.hand.filter((card) => card.instanceId !== cardId),
          }
        : player,
    ),
    actionDeck: {
      ...state.actionDeck,
      discardPile: [chosenCard, ...state.actionDeck.discardPile],
    },
    pendingChoice: undefined,
    returningFromPrivateChoice: pending.returnToPassScreen,
    passScreen: {
      visible: pending.returnToPassScreen,
    },
    log: [
      createLogEntry(state, `${targetPlayer.name} discarded 1 action card for Innocent Victim.`, playerId),
      ...state.log,
    ],
  };
}

function resolveClownGift(state: GameState, playerId: PlayerId, targetPlayerId: PlayerId): GameState {
  const pending = state.pendingChoice;

  if (
    state.phase !== "playing" ||
    pending?.type !== "clownGift" ||
    pending.targetPlayerId !== playerId ||
    targetPlayerId === playerId
  ) {
    return state;
  }

  const receivingPlayer = state.players.find((player) => player.id === playerId);
  const targetPlayer = state.players.find((player) => player.id === targetPlayerId);
  const clown = receivingPlayer?.collectedNobles.find((noble) => noble.instanceId === pending.clownInstanceId);

  if (!receivingPlayer || !targetPlayer || !clown) {
    return state;
  }

  const nextCurrentPlayerIndex = pending.advanceTurnAfterChoice
    ? getNextPlayerIndex(state.currentPlayerIndex, state.players.length)
    : state.currentPlayerIndex;

  const resolvedState: GameState = {
    ...state,
    players: state.players.map((player) => {
      if (player.id === playerId) {
        const updatedPlayer: Player = {
          ...player,
          collectedNobles: player.collectedNobles.filter((noble) => noble.instanceId !== pending.clownInstanceId),
        };

        return {
          ...updatedPlayer,
          score: calculatePlayerScore(updatedPlayer),
        };
      }

      if (player.id === targetPlayerId) {
        const updatedPlayer: Player = {
          ...player,
          collectedNobles: [...player.collectedNobles, clown],
        };

        return {
          ...updatedPlayer,
          score: calculatePlayerScore(updatedPlayer),
        };
      }

      return player;
    }),
    currentPlayerIndex: nextCurrentPlayerIndex,
    turnStep: pending.advanceTurnAfterChoice ? "playActionOptional" : state.turnStep,
    pendingChoice: undefined,
    returningFromPrivateChoice: pending.returnToPassScreen,
    passScreen: {
      visible: pending.returnToPassScreen,
    },
    log: [
      createLogEntry(state, `${receivingPlayer.name} gave The Clown to ${targetPlayer.name}.`, playerId),
      ...state.log,
    ],
  };

  if (resolvedState.nobleLine.cards.length === 0) {
    return endCurrentDay(resolvedState, `Day ${resolvedState.day} ended because the noble line is empty.`);
  }

  if (resolvedState.turnEffects.endDayAfterTurn) {
    return endCurrentDay(resolvedState, `Robespierre ended Day ${resolvedState.day}.`);
  }

  return resolvedState;
}

function transferCollectedNobleInReducer(
  state: GameState,
  fromPlayerId: PlayerId,
  toPlayerId: PlayerId,
  nobleId: CardInstanceId,
): GameState {
  const fromPlayer = state.players.find((player) => player.id === fromPlayerId);
  const movedNoble = fromPlayer?.collectedNobles.find((noble) => noble.instanceId === nobleId);

  if (!movedNoble) {
    return state;
  }

  return {
    ...state,
    players: state.players.map((player) => {
      if (player.id === fromPlayerId) {
        const updatedPlayer: Player = {
          ...player,
          collectedNobles: player.collectedNobles.filter((noble) => noble.instanceId !== nobleId),
        };

        return {
          ...updatedPlayer,
          score: calculatePlayerScore(updatedPlayer),
        };
      }

      if (player.id === toPlayerId) {
        const updatedPlayer: Player = {
          ...player,
          collectedNobles: [...player.collectedNobles, movedNoble],
        };

        return {
          ...updatedPlayer,
          score: calculatePlayerScore(updatedPlayer),
        };
      }

      return player;
    }),
  };
}

function discardCallousGuards(state: GameState, playerId: PlayerId, cardId: CardInstanceId): GameState {
  const currentPlayer = state.players[state.currentPlayerIndex];

  if (
    state.phase !== "playing" ||
    state.turnStep !== "playActionOptional" ||
    !currentPlayer ||
    currentPlayer.id !== playerId ||
    currentPlayer.skipActionThisTurn
  ) {
    return state;
  }

  const callousGuards = currentPlayer.inFrontActions.find(
    (action) => action.instanceId === cardId && action.card.effectKey === "callousGuards",
  );

  if (!callousGuards) {
    return state;
  }

  const historyState = pushGameHistory(state, `${currentPlayer.name} discarded Callous Guards.`);

  return {
    ...historyState,
    players: historyState.players.map((player) => {
      if (player.id !== playerId) {
        return player;
      }

      const updatedPlayer: Player = {
        ...player,
        inFrontActions: player.inFrontActions.filter((action) => action.instanceId !== cardId),
      };

      return {
        ...updatedPlayer,
        score: calculatePlayerScore(updatedPlayer),
      };
    }),
    actionDeck: {
      ...historyState.actionDeck,
      discardPile: [callousGuards, ...historyState.actionDeck.discardPile],
    },
    turnStep: "takeNobleRequired",
    log: [
      createLogEntry(historyState, `${currentPlayer.name} discarded Callous Guards.`, playerId),
      ...historyState.log,
    ],
  };
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

  if (state.pendingChoice) {
    return {
      ...state,
      passScreen: {
        visible: false,
      },
    };
  }

  if (state.returningFromPrivateChoice) {
    return {
      ...state,
      returningFromPrivateChoice: false,
      passScreen: {
        visible: false,
      },
    };
  }

  const currentPlayer = state.players[state.currentPlayerIndex];

  if (!currentPlayer?.skipNextActionTurn) {
    return {
      ...state,
      passScreen: {
        visible: false,
      },
    };
  }

  return {
    ...state,
    players: state.players.map((player) =>
      player.id === currentPlayer.id
        ? {
            ...player,
            skipNextActionTurn: false,
            skipActionThisTurn: true,
          }
        : player,
    ),
    turnStep: "takeNobleRequired",
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

  if (currentPlayer.skipActionThisTurn) {
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

  const result = applyActionEffect(stateWithoutCardInHand, actionCard.card.effectKey, { playerId, target, actionCard });

  if (!result.applied) {
    return state;
  }

  const stateWithDiscard: GameState = {
    ...result.state,
    passScreen: result.state.passScreen,
    actionDeck: {
      ...result.state.actionDeck,
      discardPile: result.skipDiscard
        ? result.state.actionDeck.discardPile
        : [actionCard, ...result.state.actionDeck.discardPile],
    },
    log: [
      createLogEntry(
        result.state,
        result.logMessage ?? `${currentPlayer.name} played ${actionCard.card.name} and ${result.message}.`,
        playerId,
      ),
      ...(result.extraLogMessages ?? []).map((message) => createLogEntry(result.state, message, playerId)),
      ...result.state.log,
    ],
  };
  const afterActionTriggers = applyAfterActionCardTriggers(stateWithDiscard);
  const stateAfterActionTriggers: GameState = {
    ...afterActionTriggers.state,
    log: [
      ...afterActionTriggers.logMessages.map((message) => createLogEntry(afterActionTriggers.state, message, playerId)),
      ...afterActionTriggers.state.log,
    ],
  };

  if (stateAfterActionTriggers.nobleLine.cards.length === 0 && !stateAfterActionTriggers.pendingChoice && !result.skipEmptyLineDayEnd) {
    return endCurrentDay(stateAfterActionTriggers, "The noble line is empty.");
  }

  if (result.endsTurn) {
    return showPassScreen({
      ...stateAfterActionTriggers,
      currentPlayerIndex: getNextPlayerIndex(stateAfterActionTriggers.currentPlayerIndex, stateAfterActionTriggers.players.length),
      turnStep: "playActionOptional",
      turnEffects: {
        endDayAfterTurn: false,
      },
    });
  }

  return {
    ...stateAfterActionTriggers,
    turnStep: result.allowsAnotherAction ? "playActionOptional" : "takeNobleRequired",
  };
}

function takeFrontNoble(state: GameState, playerId: PlayerId): GameState {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (state.phase !== "playing" || !currentPlayer || currentPlayer.id !== playerId || state.nobleLine.cards.length === 0) {
    return state;
  }

  const historyState = pushGameHistory(state, `${currentPlayer.name} took the front noble.`);
  const confused = applyBeforeNobleCollectionTriggers(historyState, playerId);
  const frontNoble = confused.state.nobleLine.cards[0];

  if (!frontNoble) {
    return state;
  }

  const [drawnAction, ...remainingActionDeck] = confused.state.actionDeck.drawPile;
  const updatedNobleLine = confused.state.nobleLine.cards.slice(1);

  const updatedPlayers = confused.state.players.map((player) => {
    if (player.id !== playerId) {
      return player;
    }

    const updatedPlayer: Player = {
      ...player,
      hand: drawnAction ? [...player.hand, drawnAction] : player.hand,
      collectedNobles: [...player.collectedNobles, frontNoble],
      skipActionThisTurn: false,
    };

    return {
      ...updatedPlayer,
      score: calculatePlayerScore(updatedPlayer),
    };
  });

  const collectingPlayerAfterUpdate = updatedPlayers.find((player) => player.id === playerId);
  const collectedPointValue = collectingPlayerAfterUpdate
    ? calculateNobleScoreValue(collectingPlayerAfterUpdate, frontNoble)
    : frontNoble.card.points;
  const nextPlayerIndex = getNextPlayerIndex(confused.state.currentPlayerIndex, confused.state.players.length);
  const baseNextState: GameState = {
    ...confused.state,
    phase: "playing",
    players: updatedPlayers,
    currentPlayerIndex: nextPlayerIndex,
    turnStep: "playActionOptional",
    passScreen: {
      visible: false,
    },
    actionDeck: {
      ...confused.state.actionDeck,
      drawPile: remainingActionDeck,
    },
    nobleDeck: confused.state.nobleDeck,
    nobleLine: {
      cards: updatedNobleLine,
    },
    log: [
      createLogEntry(confused.state, `${currentPlayer.name} took ${frontNoble.card.name} for ${collectedPointValue} points.`, playerId),
      ...confused.logMessages.map((message) => createLogEntry(confused.state, message, playerId)),
      ...confused.state.log,
    ],
    winnerIds: [],
  };
  const triggered = applyNobleCollectionTriggers(baseNextState, playerId, frontNoble);
  const nextState: GameState = {
    ...triggered.state,
    log: [
      ...triggered.logMessages.map((message) => createLogEntry(triggered.state, message, playerId)),
      ...triggered.state.log,
    ],
  };

  if (nextState.nobleLine.cards.length === 0 && !nextState.pendingChoice) {
    return endCurrentDay(nextState, `Day ${nextState.day} ended because the noble line is empty.`);
  }

  const dayResolvedState = nextState.turnEffects.endDayAfterTurn
    ? endCurrentDay(nextState, `A day-ending effect ended Day ${nextState.day}.`)
    : nextState;

  if (dayResolvedState.phase === "gameEnd" || dayResolvedState.pendingChoice) {
    return dayResolvedState;
  }

  return showPassScreen(dayResolvedState);
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


