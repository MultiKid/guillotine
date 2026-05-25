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
  ActionCard,
  CardInstance,
  CardInstanceId,
  GameCommand,
  GameLogEntry,
  GameState,
  Player,
  PlayerId,
  TurnStep,
} from "@/lib/game/types";

type EndCurrentDayOptions = {
  nextTurnStep?: TurnStep;
  showPassScreen?: boolean;
};

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
    case "CONFIRM_REORDER_AND_TAKE_FRONT_NOBLE":
      return state.passScreen.visible
        ? state
        : confirmReorderAndTakeFrontNoble(
            state,
            command.playerId,
            command.cardId,
            command.reorderedNobleIds,
            command.preShuffledLineIds,
          );
    case "TAKE_FRONT_NOBLE":
      return state.passScreen.visible ? state : takeFrontNoble(state, command.playerId, command.preShuffledLineIds);
    case "END_TURN":
      return state.passScreen.visible ? state : endTurn(state, command.playerId);
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

  const logEntry = createLogEntry(
    state,
    `${targetPlayer.name} discarded ${formatActionCardNames(chosenCards)} for Infighting.`,
    playerId,
    [playerId],
  );

  return addBriefingEntries({
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
      logEntry,
      ...state.log,
    ],
    detailedLog: [
      createDetailedLogEntry(state, `${targetPlayer.name} discarded ${formatActionCardNames(chosenCards)} for Infighting.`, playerId),
      ...state.detailedLog,
    ],
  }, [logEntry], pending.originalPlayerId);
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
  const logEntry = createLogEntry(
    transferredState,
    `${targetPlayer.name} completed the Clerical Error exchange with ${originalPlayer.name}.`,
    playerId,
    [pending.originalPlayerId, playerId],
  );

  return addBriefingEntries({
    ...transferredState,
    pendingChoice: undefined,
    returningFromPrivateChoice: true,
    passScreen: {
      visible: true,
    },
    log: [
      logEntry,
      ...transferredState.log,
    ],
    detailedLog: [
      createDetailedLogEntry(transferredState, `${targetPlayer.name} completed the Clerical Error exchange with ${originalPlayer.name}.`, playerId),
      ...transferredState.detailedLog,
    ],
  }, [logEntry], pending.originalPlayerId);
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

  const logEntry = createLogEntry(state, `${targetPlayer.name} discarded ${chosenCard.card.name} for Innocent Victim.`, playerId, [playerId]);

  return addBriefingEntries({
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
      logEntry,
      ...state.log,
    ],
    detailedLog: [
      createDetailedLogEntry(state, `${targetPlayer.name} discarded ${chosenCard.card.name} for Innocent Victim.`, playerId),
      ...state.detailedLog,
    ],
  }, [logEntry], pending.originalPlayerId);
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
  const logEntry = createLogEntry(state, `${receivingPlayer.name} gave The Clown to ${targetPlayer.name}.`, playerId, [targetPlayerId]);

  const resolvedState: GameState = addBriefingEntries({
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
      logEntry,
      ...state.log,
    ],
    detailedLog: [
      createDetailedLogEntry(state, `${receivingPlayer.name} gave The Clown to ${targetPlayer.name}.`, playerId),
      ...state.detailedLog,
    ],
  }, [logEntry], playerId);

  if (resolvedState.nobleLine.cards.length === 0) {
    return endCurrentDay(resolvedState, `Day ${resolvedState.day} ended because the noble line is empty.`, {
      nextTurnStep: resolvedState.turnStep,
      showPassScreen: false,
    });
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
  const player = state.players.find((candidate) => candidate.id === playerId);

  if (state.phase !== "playing" || !player) {
    return state;
  }

  const callousGuards = player.inFrontActions.find(
    (action) => action.instanceId === cardId && action.card.effectKey === "callousGuards",
  );

  if (!callousGuards) {
    return state;
  }

  const historyState = pushGameHistory(state, `${player.name} discarded Callous Guards.`);

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
    turnStep: historyState.turnStep,
    log: [
      createLogEntry(historyState, `${player.name} discarded Callous Guards.`, playerId),
      ...historyState.log,
    ],
    detailedLog: [
      createDetailedLogEntry(historyState, `${player.name} discarded Callous Guards.`, playerId),
      ...historyState.detailedLog,
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
      discardPile: historyState.actionDeck.discardPile,
    },
    log: [
      createLogEntry(
        historyState,
        `${currentPlayer.name} reloaded a fresh test hand of ${newHand.length} action card${newHand.length === 1 ? "" : "s"}.`,
        playerId,
      ),
      ...historyState.log,
    ],
    detailedLog: [
      createDetailedLogEntry(
        historyState,
        `${currentPlayer.name} reloaded a fresh test hand of ${newHand.length} action card${newHand.length === 1 ? "" : "s"}: ${formatActionCardNames(newHand)}.`,
        playerId,
      ),
      ...historyState.detailedLog,
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

  const affectedPlayerIds = getActionAffectedPlayerIds(state, actionCard.card.effectKey, target, playerId);
  const mainLogEntry = createLogEntry(
    result.state,
    result.logMessage ?? `${currentPlayer.name} played ${actionCard.card.name} and ${result.message}.`,
    playerId,
    affectedPlayerIds,
  );
  const extraLogEntries = (result.extraLogMessages ?? []).map((message) =>
    createLogEntry(result.state, message, playerId, affectedPlayerIds),
  );
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
      mainLogEntry,
      ...extraLogEntries,
      ...result.state.log,
    ],
    detailedLog: [
      createDetailedLogEntry(
        result.state,
        result.detailLogMessage ?? result.logMessage ?? `${currentPlayer.name} played ${actionCard.card.name} and ${result.message}.`,
        playerId,
      ),
      ...((result.extraDetailLogMessages ?? result.extraLogMessages) ?? []).map((message) =>
        createDetailedLogEntry(result.state, message, playerId),
      ),
      ...result.state.detailedLog,
    ],
  };
  const stateWithBriefings = addBriefingEntries(stateWithDiscard, [mainLogEntry, ...extraLogEntries], playerId);
  const afterActionTriggers = applyAfterActionCardTriggers(stateWithBriefings);
  const stateAfterActionTriggersWithoutSummary: GameState = {
    ...afterActionTriggers.state,
    log: [
      ...afterActionTriggers.logMessages.map((message) => createLogEntry(afterActionTriggers.state, message, playerId)),
      ...afterActionTriggers.state.log,
    ],
    detailedLog: [
      ...afterActionTriggers.logMessages.map((message) => createDetailedLogEntry(afterActionTriggers.state, message, playerId)),
      ...afterActionTriggers.state.detailedLog,
    ],
  };
  const stateAfterActionTriggers = updateTurnSummaryFromPlayerDelta(state, stateAfterActionTriggersWithoutSummary, playerId);

  const nextTurnStep: TurnStep = result.endsTurn
    ? "turnComplete"
    : result.allowsAnotherAction
      ? "playActionOptional"
      : "takeNobleRequired";
  const stateWithNextTurnStep: GameState = {
    ...stateAfterActionTriggers,
    turnStep: nextTurnStep,
  };

  if (stateWithNextTurnStep.nobleLine.cards.length === 0 && !stateWithNextTurnStep.pendingChoice && !result.skipEmptyLineDayEnd) {
    return endCurrentDay(stateWithNextTurnStep, "The noble line is empty.", {
      nextTurnStep,
      showPassScreen: false,
    });
  }

  return stateWithNextTurnStep;
}

function confirmReorderAndTakeFrontNoble(
  state: GameState,
  playerId: PlayerId,
  cardId: CardInstanceId,
  reorderedNobleIds: CardInstanceId[],
  preShuffledLineIds?: CardInstanceId[],
): GameState {
  const stateAfterReorder = playActionCard(state, playerId, cardId, {
    type: "reorder-nobles",
    instanceIds: reorderedNobleIds,
  });

  if (stateAfterReorder === state) {
    return state;
  }

  return takeFrontNoble(stateAfterReorder, playerId, preShuffledLineIds);
}

function takeFrontNoble(state: GameState, playerId: PlayerId, preShuffledLineIds?: CardInstanceId[]): GameState {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (state.phase !== "playing" || !currentPlayer || currentPlayer.id !== playerId || state.nobleLine.cards.length === 0) {
    return state;
  }

  const historyState = pushGameHistory(state, `${currentPlayer.name} took the front noble.`);
  const confused = preShuffledLineIds
    ? applyPreShuffledBeforeNobleCollection(historyState, playerId, preShuffledLineIds)
    : applyBeforeNobleCollectionTriggers(historyState, playerId);
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
  const baseNextState: GameState = {
    ...confused.state,
    phase: "playing",
    players: updatedPlayers,
    currentPlayerIndex: confused.state.currentPlayerIndex,
    turnStep: "turnComplete",
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
    detailedLog: [
      createDetailedLogEntry(confused.state, `${currentPlayer.name} took ${frontNoble.card.name} for ${collectedPointValue} points.`, playerId),
      ...confused.logMessages.map((message) => createDetailedLogEntry(confused.state, message, playerId)),
      ...confused.state.detailedLog,
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
    detailedLog: [
      ...triggered.logMessages.map((message) => createDetailedLogEntry(triggered.state, message, playerId)),
      ...triggered.state.detailedLog,
    ],
  };

  const summarizedState = updateTurnSummaryFromPlayerDelta(state, nextState, playerId);

  if (summarizedState.nobleLine.cards.length === 0 && !summarizedState.pendingChoice) {
    return endCurrentDay(summarizedState, `Day ${summarizedState.day} ended because the noble line is empty.`, {
      nextTurnStep: "turnComplete",
      showPassScreen: false,
    });
  }

  return summarizedState;
}

function endTurn(state: GameState, playerId: PlayerId): GameState {
  const currentPlayer = state.players[state.currentPlayerIndex];

  if (state.phase !== "playing" || state.turnStep !== "turnComplete" || !currentPlayer || currentPlayer.id !== playerId) {
    return state;
  }

  const turnSummaryEntry = createTurnSummaryBriefingEntry(state, currentPlayer);
  const stateWithTurnSummaryBriefing = turnSummaryEntry
    ? addBriefingEntries(state, [turnSummaryEntry], playerId)
    : state;
  const nextPlayerIndex = getNextPlayerIndex(state.currentPlayerIndex, state.players.length);
  const advancedState: GameState = {
    ...stateWithTurnSummaryBriefing,
    currentPlayerIndex: nextPlayerIndex,
    playerBriefings: {
      ...stateWithTurnSummaryBriefing.playerBriefings,
      [playerId]: [],
    },
    turnStep: "playActionOptional",
    turnEffects: {
      endDayAfterTurn: false,
    },
    turnSummary: {
      nobleNames: [],
      pointDelta: 0,
    },
  };

  if (state.nobleLine.cards.length === 0 && !state.pendingChoice) {
    return endCurrentDay(advancedState, `Day ${state.day} ended because the noble line is empty.`);
  }

  if (state.turnEffects.endDayAfterTurn) {
    return endCurrentDay(advancedState, `A day-ending effect ended Day ${state.day}.`);
  }

  return showPassScreen(advancedState);
}

function applyPreShuffledBeforeNobleCollection(
  state: GameState,
  playerId: PlayerId,
  preShuffledLineIds: CardInstanceId[],
): { state: GameState; logMessages: string[] } {
  const player = state.players.find((candidate) => candidate.id === playerId);

  if (!player?.shuffleLineBeforeNextCollection) {
    return applyBeforeNobleCollectionTriggers(state, playerId);
  }

  const lineById = new Map(state.nobleLine.cards.map((noble) => [noble.instanceId, noble]));
  const shuffledLine = preShuffledLineIds.flatMap((instanceId) => {
    const noble = lineById.get(instanceId);
    return noble ? [noble] : [];
  });

  if (shuffledLine.length !== state.nobleLine.cards.length) {
    return applyBeforeNobleCollectionTriggers(state, playerId);
  }

  return {
    state: {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === playerId
          ? {
              ...candidate,
              shuffleLineBeforeNextCollection: false,
            }
          : candidate,
      ),
      nobleLine: {
        cards: shuffledLine,
      },
    },
    logMessages: [`Confusion in Line triggered for ${player.name}.`],
  };
}

function endCurrentDay(state: GameState, reason: string, options: EndCurrentDayOptions = {}): GameState {
  const discardedNobles = state.nobleLine.cards;
  const nextDay = state.day + 1;
  const nextTurnStep = options.nextTurnStep ?? "playActionOptional";
  const dayEndMessage = `${reason} Discarded ${discardedNobles.length} noble${discardedNobles.length === 1 ? "" : "s"} from the line.`;
  const baseLog = [
    createLogEntry(state, dayEndMessage),
    ...state.log,
  ];
  const baseDetailedLog = [
    createDetailedLogEntry(
      state,
      discardedNobles.length > 0
        ? `${dayEndMessage} Discarded nobles: ${discardedNobles.map((noble) => noble.card.name).join(", ")}.`
        : dayEndMessage,
    ),
    ...state.detailedLog,
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
      detailedLog: baseDetailedLog,
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
      detailedLog: baseDetailedLog,
    });
  }

  const nextState: GameState = {
    ...state,
    day: nextDay,
    phase: "playing",
    turnStep: nextTurnStep,
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
    detailedLog: baseDetailedLog,
    winnerIds: [],
  };

  return options.showPassScreen === false ? nextState : showPassScreen(nextState);
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

function createLogEntry(
  state: GameState,
  message: string,
  playerId?: PlayerId,
  affectedPlayerIds: PlayerId[] = [],
): GameLogEntry {
  return {
    id: `log-${Date.now()}-${state.log.length + 1}`,
    message,
    day: state.day,
    playerId,
    affectedPlayerIds,
  };
}

function createDetailedLogEntry(state: GameState, message: string, playerId?: PlayerId): GameLogEntry {
  return {
    id: `detail-log-${Date.now()}-${state.detailedLog.length + 1}`,
    message,
    day: state.day,
    playerId,
  };
}

function formatActionCardNames(cards: CardInstance<ActionCard>[]): string {
  if (cards.length === 0) {
    return "no action cards";
  }

  return cards.map((card) => card.card.name).join(", ");
}

function addBriefingEntries(state: GameState, entries: GameLogEntry[], excludePlayerId?: PlayerId): GameState {
  if (entries.length === 0) {
    return state;
  }

  const playerBriefings = { ...state.playerBriefings };

  entries.forEach((entry) => {
    entry.affectedPlayerIds?.forEach((playerId) => {
      if (playerId === excludePlayerId) {
        return;
      }

      playerBriefings[playerId] = [...(playerBriefings[playerId] ?? []), entry.message];
    });
  });

  return {
    ...state,
    playerBriefings,
  };
}

function updateTurnSummaryFromPlayerDelta(previousState: GameState, nextState: GameState, playerId: PlayerId): GameState {
  const previousPlayer = previousState.players.find((player) => player.id === playerId);
  const nextPlayer = nextState.players.find((player) => player.id === playerId);

  if (!previousPlayer || !nextPlayer) {
    return nextState;
  }

  const previousNobleIds = new Set(previousPlayer.collectedNobles.map((noble) => noble.instanceId));
  const addedNobleNames = nextPlayer.collectedNobles
    .filter((noble) => !previousNobleIds.has(noble.instanceId))
    .map((noble) => noble.card.name);
  const pointDelta = nextPlayer.score - previousPlayer.score;

  if (addedNobleNames.length === 0 && pointDelta === 0) {
    return nextState;
  }

  const currentSummary =
    nextState.turnSummary.playerId === playerId
      ? nextState.turnSummary
      : {
          playerId,
          nobleNames: [],
          pointDelta: 0,
        };

  return {
    ...nextState,
    turnSummary: {
      playerId,
      nobleNames: [...currentSummary.nobleNames, ...addedNobleNames],
      pointDelta: currentSummary.pointDelta + pointDelta,
    },
  };
}

function createTurnSummaryBriefingEntry(state: GameState, player: Player): GameLogEntry | undefined {
  const summary = state.turnSummary.playerId === player.id ? state.turnSummary : undefined;

  if (!summary || (summary.nobleNames.length === 0 && summary.pointDelta === 0)) {
    return undefined;
  }

  const nobleText =
    summary.nobleNames.length > 0
      ? `collected ${formatList(summary.nobleNames)}`
      : "collected no nobles";
  const pointText = `${summary.pointDelta >= 0 ? "gained" : "lost"} ${Math.abs(summary.pointDelta)} point${Math.abs(summary.pointDelta) === 1 ? "" : "s"}`;
  const affectedPlayerIds = state.players.map((candidate) => candidate.id).filter((id) => id !== player.id);

  return createLogEntry(
    state,
    `${player.name}'s turn summary: ${nobleText}; ${pointText} total.`,
    player.id,
    affectedPlayerIds,
  );
}

function formatList(items: string[]): string {
  if (items.length <= 1) {
    return items[0] ?? "";
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function getActionAffectedPlayerIds(
  state: GameState,
  effectKey: string,
  target: ActionTarget | undefined,
  playerId: PlayerId,
): PlayerId[] {
  const allPlayerIds = state.players.map((player) => player.id);

  switch (effectKey) {
    case "callousGuards":
    case "rainDelay":
    case "massConfusion":
    case "escape":
    case "millingInLine":
    case "theLongWalk":
    case "scarletPimpernel":
      return allPlayerIds;
    case "forcedBreak":
      return allPlayerIds.filter((id) => id !== playerId);
    case "informationExchange":
    case "rushJob":
    case "missed":
    case "afterYou":
    case "confusionInLine":
    case "missingHeads":
    case "infighting":
    case "lackOfSupport":
      return target?.type === "player" ? [target.playerId] : [];
    case "toughCrowd":
      return target?.type === "player" ? [target.playerId] : [];
    case "clericalError":
      return target?.type === "collected-noble" ? [playerId, target.playerId] : [];
    case "twistOfFate":
      return target?.type === "in-front-action" ? [target.playerId] : [];
    default:
      return [];
  }
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


