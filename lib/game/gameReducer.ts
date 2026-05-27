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
  ActionEffectKey,
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

type ReducerActionEffectResult = {
  state: GameState;
  applied: boolean;
  message: string;
  endsTurn?: boolean;
  allowsAnotherAction?: boolean;
  extraLogMessages?: string[];
  extraDetailLogMessages?: string[];
  skipDiscard?: boolean;
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
      return state.passScreen.visible ? state : reloadTestHand(state, command.playerId, command.allowAnyPlayer);
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
    case "RESOLVE_LOYAL_GUARDS":
      return state.passScreen.visible ? state : resolveLoyalGuards(state, command.playerId, command.useProtection);
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

  const loyalGuards = findLoyalGuards(targetPlayer);

  if (loyalGuards) {
    return {
      ...state,
      pendingChoice: {
        type: "loyalGuards",
        originalPlayerId: playerId,
        targetPlayerId,
        loyalGuardsInstanceId: loyalGuards.instanceId,
        source: {
          type: "clownGift",
          clownInstanceId: pending.clownInstanceId,
          returnToPassScreen: pending.returnToPassScreen,
          advanceTurnAfterChoice: pending.advanceTurnAfterChoice,
        },
      },
      passScreen: {
        visible: false,
      },
    };
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

function resolveLoyalGuards(state: GameState, playerId: PlayerId, useProtection: boolean): GameState {
  const pending = state.pendingChoice;

  if (state.phase !== "playing" || pending?.type !== "loyalGuards" || pending.targetPlayerId !== playerId) {
    return state;
  }

  const protectedPlayer = state.players.find((player) => player.id === pending.targetPlayerId);
  const originalPlayer = state.players.find((player) => player.id === pending.originalPlayerId);
  const loyalGuards = protectedPlayer?.inFrontActions.find((action) => action.instanceId === pending.loyalGuardsInstanceId);

  if (!protectedPlayer || !originalPlayer || !loyalGuards) {
    return {
      ...state,
      pendingChoice: undefined,
    };
  }

  const stateWithoutLoyalGuards: GameState = {
    ...state,
    pendingChoice: undefined,
    players: state.players.map((player) => {
      if (player.id !== protectedPlayer.id) {
        return player;
      }

      const updatedPlayer: Player = {
        ...player,
        inFrontActions: player.inFrontActions.filter((action) => action.instanceId !== loyalGuards.instanceId),
      };

      return {
        ...updatedPlayer,
        score: calculatePlayerScore(updatedPlayer),
      };
    }),
    actionDeck: {
      ...state.actionDeck,
      discardPile: [loyalGuards, ...state.actionDeck.discardPile],
    },
  };

  if (pending.source.type === "clownGift") {
    const resolvedState = useProtection
      ? stateWithoutLoyalGuards
      : transferClownAfterLoyalGuards(stateWithoutLoyalGuards, pending.originalPlayerId, pending.targetPlayerId, pending.source.clownInstanceId);
    const logEntry = createLogEntry(
      resolvedState,
      useProtection
        ? `${protectedPlayer.name} used Loyal Guards and refused The Clown from ${originalPlayer.name}.`
        : `${protectedPlayer.name} declined Loyal Guards and received The Clown from ${originalPlayer.name}.`,
      protectedPlayer.id,
      [protectedPlayer.id, originalPlayer.id],
    );

    return addBriefingEntries({
      ...resolvedState,
      currentPlayerIndex: pending.source.advanceTurnAfterChoice
        ? getNextPlayerIndex(resolvedState.currentPlayerIndex, resolvedState.players.length)
        : resolvedState.currentPlayerIndex,
      turnStep: pending.source.advanceTurnAfterChoice ? "playActionOptional" : resolvedState.turnStep,
      returningFromPrivateChoice: pending.source.returnToPassScreen,
      passScreen: {
        visible: pending.source.returnToPassScreen,
      },
      log: [logEntry, ...resolvedState.log],
      detailedLog: [
        createDetailedLogEntry(resolvedState, logEntry.message, protectedPlayer.id),
        ...resolvedState.detailedLog,
      ],
    }, [logEntry], protectedPlayer.id);
  }

  const redirectedTarget = useProtection
    ? getLoyalGuardsBackfireTarget(pending.source.effectKey, pending.source.originalTarget, pending.originalPlayerId)
    : pending.source.originalTarget;
  const protectedResult = useProtection
    ? applyLoyalGuardsBackfire(stateWithoutLoyalGuards, pending.source.effectKey, pending.originalPlayerId, redirectedTarget, pending.source.actionCard)
    : applyActionEffect(stateWithoutLoyalGuards, pending.source.effectKey, {
        playerId: pending.originalPlayerId,
        target: redirectedTarget,
        actionCard: pending.source.actionCard,
      });

  if (!protectedResult.applied) {
    const logEntry = createLogEntry(
      stateWithoutLoyalGuards,
      `${protectedPlayer.name} ${useProtection ? "used" : "declined"} Loyal Guards. ${originalPlayer.name}'s ${pending.source.actionCard.card.name} had no effect.`,
      protectedPlayer.id,
      [protectedPlayer.id, originalPlayer.id],
    );

    return addBriefingEntries({
      ...stateWithoutLoyalGuards,
      actionDeck: {
        ...stateWithoutLoyalGuards.actionDeck,
        discardPile: [pending.source.actionCard, ...stateWithoutLoyalGuards.actionDeck.discardPile],
      },
      turnStep: "takeNobleRequired",
      log: [logEntry, ...stateWithoutLoyalGuards.log],
      detailedLog: [createDetailedLogEntry(stateWithoutLoyalGuards, logEntry.message, protectedPlayer.id), ...stateWithoutLoyalGuards.detailedLog],
    }, [logEntry], pending.originalPlayerId);
  }

  const logEntry = createLogEntry(
    protectedResult.state,
    useProtection
      ? `${protectedPlayer.name} used Loyal Guards. ${originalPlayer.name}'s ${pending.source.actionCard.card.name} backfired: ${protectedResult.message}.`
      : `${protectedPlayer.name} declined Loyal Guards. ${originalPlayer.name}'s ${pending.source.actionCard.card.name} resolved: ${protectedResult.message}.`,
    pending.originalPlayerId,
    [protectedPlayer.id, originalPlayer.id],
  );
  const stateWithDiscard: GameState = {
    ...protectedResult.state,
    actionDeck: {
      ...protectedResult.state.actionDeck,
      discardPile: protectedResult.skipDiscard
        ? protectedResult.state.actionDeck.discardPile
        : [pending.source.actionCard, ...protectedResult.state.actionDeck.discardPile],
    },
    turnStep: protectedResult.endsTurn
      ? "turnComplete"
      : protectedResult.allowsAnotherAction
        ? "playActionOptional"
        : "takeNobleRequired",
    log: [
      logEntry,
      ...((protectedResult.extraLogMessages ?? []).map((message) => createLogEntry(protectedResult.state, message, pending.originalPlayerId, [protectedPlayer.id, originalPlayer.id]))),
      ...protectedResult.state.log,
    ],
    detailedLog: [
      createDetailedLogEntry(protectedResult.state, logEntry.message, pending.originalPlayerId),
      ...((protectedResult.extraDetailLogMessages ?? protectedResult.extraLogMessages) ?? []).map((message) =>
        createDetailedLogEntry(protectedResult.state, message, pending.originalPlayerId),
      ),
      ...protectedResult.state.detailedLog,
    ],
  };
  const stateWithBriefings = addBriefingEntries(stateWithDiscard, [logEntry], pending.originalPlayerId);
  const afterActionTriggers = applyAfterActionCardTriggers(stateWithBriefings);

  return {
    ...afterActionTriggers.state,
    log: [
      ...afterActionTriggers.logMessages.map((message) => createLogEntry(afterActionTriggers.state, message, pending.originalPlayerId)),
      ...afterActionTriggers.state.log,
    ],
    detailedLog: [
      ...afterActionTriggers.logMessages.map((message) => createDetailedLogEntry(afterActionTriggers.state, message, pending.originalPlayerId)),
      ...afterActionTriggers.state.detailedLog,
    ],
  };
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

function reloadTestHand(state: GameState, playerId: PlayerId, allowAnyPlayer = false): GameState {
  const currentPlayer = state.players[state.currentPlayerIndex];

  if (state.phase !== "playing" || !currentPlayer || (!allowAnyPlayer && currentPlayer.id !== playerId)) {
    return state;
  }

  const playerName = state.players.find((candidate) => candidate.id === playerId)?.name ?? currentPlayer.name;
  const historyState = pushGameHistory(state, `${playerName} reloaded their test hand.`);
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
        `${player.name} reloaded a fresh test hand of ${newHand.length} action card${newHand.length === 1 ? "" : "s"}.`,
        playerId,
      ),
      ...historyState.log,
    ],
    detailedLog: [
      createDetailedLogEntry(
        historyState,
        `${player.name} reloaded a fresh test hand of ${newHand.length} action card${newHand.length === 1 ? "" : "s"}: ${formatActionCardNames(newHand)}.`,
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

  const loyalGuardsPlayerId = getLoyalGuardsProtectedPlayerId(stateWithoutCardInHand, actionCard.card.effectKey, target, playerId);

  if (loyalGuardsPlayerId) {
    const protectedPlayer = stateWithoutCardInHand.players.find((player) => player.id === loyalGuardsPlayerId);
    const loyalGuards = protectedPlayer ? findLoyalGuards(protectedPlayer) : undefined;

    if (protectedPlayer && loyalGuards) {
      return {
        ...stateWithoutCardInHand,
        pendingChoice: {
          type: "loyalGuards",
          originalPlayerId: playerId,
          targetPlayerId: loyalGuardsPlayerId,
          loyalGuardsInstanceId: loyalGuards.instanceId,
          source: {
            type: "action",
            actionCard,
            effectKey: actionCard.card.effectKey,
            originalTarget: target,
          },
        },
        passScreen: {
          visible: false,
        },
      };
    }
  }

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

function findLoyalGuards(player: Player): CardInstance<ActionCard> | undefined {
  return player.inFrontActions.find((action) => action.card.effectKey === "loyalGuards");
}

function transferClownAfterLoyalGuards(
  state: GameState,
  fromPlayerId: PlayerId,
  toPlayerId: PlayerId,
  clownInstanceId: CardInstanceId,
): GameState {
  const fromPlayer = state.players.find((player) => player.id === fromPlayerId);
  const clown = fromPlayer?.collectedNobles.find((noble) => noble.instanceId === clownInstanceId);

  if (!fromPlayer || !clown) {
    return state;
  }

  return {
    ...state,
    players: state.players.map((player) => {
      if (player.id === fromPlayerId) {
        const updatedPlayer: Player = {
          ...player,
          collectedNobles: player.collectedNobles.filter((noble) => noble.instanceId !== clownInstanceId),
        };

        return {
          ...updatedPlayer,
          score: calculatePlayerScore(updatedPlayer),
        };
      }

      if (player.id === toPlayerId) {
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
  };
}

function getLoyalGuardsBackfireTarget(
  effectKey: ActionEffectKey,
  originalTarget: ActionTarget | undefined,
  originalPlayerId: PlayerId,
): ActionTarget | undefined {
  switch (effectKey) {
    case "afterYou":
    case "missed":
    case "rushJob":
    case "confusionInLine":
    case "missingHeads":
    case "infighting":
    case "toughCrowd":
      return { type: "player", playerId: originalPlayerId };
    case "lackOfSupport":
      return originalTarget?.type === "action-hand-card"
        ? { ...originalTarget, playerId: originalPlayerId }
        : originalTarget;
    case "twistOfFate":
      return originalTarget?.type === "in-front-action"
        ? { ...originalTarget, playerId: originalPlayerId }
        : originalTarget;
    default:
      return originalTarget;
  }
}

function applyLoyalGuardsBackfire(
  state: GameState,
  effectKey: ActionEffectKey,
  originalPlayerId: PlayerId,
  target: ActionTarget | undefined,
  actionCard: CardInstance<ActionCard>,
): ReducerActionEffectResult {
  if (effectKey === "informationExchange" || effectKey === "clericalError") {
    return {
      state,
      applied: false,
      message: "the protected effect was cancelled",
    };
  }

  if (effectKey === "forcedBreak") {
    return loyalGuardsForcedBreakBackfire(state, originalPlayerId);
  }

  if (effectKey === "rainDelay") {
    return loyalGuardsRainDelayBackfire(state, originalPlayerId);
  }

  if (effectKey === "afterYou") {
    return loyalGuardsAfterYouBackfire(state, originalPlayerId);
  }

  if (effectKey === "missed") {
    return loyalGuardsMissedBackfire(state, originalPlayerId);
  }

  if (effectKey === "rushJob") {
    return loyalGuardsRushJobBackfire(state, originalPlayerId);
  }

  if (effectKey === "confusionInLine") {
    return loyalGuardsConfusionBackfire(state, originalPlayerId);
  }

  if (effectKey === "missingHeads") {
    return loyalGuardsMissingHeadsBackfire(state, originalPlayerId);
  }

  if (effectKey === "infighting") {
    return loyalGuardsInfightingBackfire(state, originalPlayerId);
  }

  if (effectKey === "lackOfSupport") {
    return loyalGuardsLackOfSupportBackfire(state, originalPlayerId, target);
  }

  if (effectKey === "twistOfFate") {
    return loyalGuardsTwistOfFateBackfire(state, originalPlayerId, target);
  }

  if (effectKey === "toughCrowd") {
    return attachPersistentActionToAttackerForLoyalGuards(state, originalPlayerId, actionCard);
  }

  return applyActionEffect(state, effectKey, {
    playerId: originalPlayerId,
    target,
  });
}

function loyalGuardsForcedBreakBackfire(state: GameState, playerId: PlayerId) {
  const player = state.players.find((candidate) => candidate.id === playerId);

  if (!player || player.hand.length === 0) {
    return {
      state,
      applied: true,
      message: `${player?.name ?? "the attacker"} had no action cards to discard`,
    };
  }

  const discardIndex = Math.floor(Math.random() * player.hand.length);
  const discardedCard = player.hand[discardIndex];

  if (!discardedCard) {
    return {
      state,
      applied: false,
      message: "could not choose a card to discard",
    };
  }

  return {
    state: {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === playerId
          ? {
              ...candidate,
              hand: candidate.hand.filter((_, index) => index !== discardIndex),
            }
          : candidate,
      ),
      actionDeck: {
        ...state.actionDeck,
        discardPile: [discardedCard, ...state.actionDeck.discardPile],
      },
    },
    applied: true,
    message: `${player.name} discarded ${discardedCard.card.name}`,
  };
}

function loyalGuardsRainDelayBackfire(state: GameState, playerId: PlayerId) {
  const player = state.players.find((candidate) => candidate.id === playerId);

  if (!player) {
    return {
      state,
      applied: false,
      message: "could not find the attacker",
    };
  }

  const pool = shuffleDeck([...state.actionDeck.drawPile, ...player.hand]);
  const newHand = pool.slice(0, STARTING_HAND_SIZE);
  const remainingDeck = pool.slice(newHand.length);

  return {
    state: {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === playerId
          ? {
              ...candidate,
              hand: newHand,
            }
          : candidate,
      ),
      actionDeck: {
        ...state.actionDeck,
        drawPile: remainingDeck,
      },
    },
    applied: true,
    message: `${player.name} shuffled their hand into the action deck and drew ${newHand.length} new action card${newHand.length === 1 ? "" : "s"}`,
  };
}

function loyalGuardsAfterYouBackfire(state: GameState, playerId: PlayerId) {
  const frontNoble = state.nobleLine.cards[0];
  const player = state.players.find((candidate) => candidate.id === playerId);

  if (!frontNoble || !player) {
    return { state, applied: false, message: "there was no front noble to collect" };
  }

  const baseState: GameState = {
    ...state,
    nobleLine: {
      cards: state.nobleLine.cards.slice(1),
    },
    players: state.players.map((candidate) => {
      if (candidate.id !== playerId) {
        return candidate;
      }

      const updatedPlayer: Player = {
        ...candidate,
        collectedNobles: [...candidate.collectedNobles, frontNoble],
      };

      return {
        ...updatedPlayer,
        score: calculatePlayerScore(updatedPlayer),
      };
    }),
  };
  const triggered = applyNobleCollectionTriggers(baseState, playerId, frontNoble);

  return {
    state: triggered.state,
    applied: true,
    message: `${player.name} received ${frontNoble.card.name} instead`,
    extraLogMessages: triggered.logMessages,
  };
}

function loyalGuardsMissedBackfire(state: GameState, playerId: PlayerId) {
  const player = state.players.find((candidate) => candidate.id === playerId);
  const returnedNoble = player?.collectedNobles[player.collectedNobles.length - 1];

  if (!player || !returnedNoble) {
    return { state, applied: true, message: `${player?.name ?? "the attacker"} had no collected noble to return` };
  }

  return {
    state: {
      ...state,
      players: state.players.map((candidate) => {
        if (candidate.id !== playerId) {
          return candidate;
        }

        const updatedPlayer: Player = {
          ...candidate,
          collectedNobles: candidate.collectedNobles.slice(0, -1),
        };

        return {
          ...updatedPlayer,
          score: calculatePlayerScore(updatedPlayer),
        };
      }),
      nobleLine: {
        cards: [...state.nobleLine.cards, returnedNoble],
      },
    },
    applied: true,
    message: `${player.name} returned ${returnedNoble.card.name} to the end of the line`,
  };
}

function loyalGuardsRushJobBackfire(state: GameState, playerId: PlayerId) {
  const player = state.players.find((candidate) => candidate.id === playerId);

  return {
    state: {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === playerId
          ? {
              ...candidate,
              skipNextActionTurn: true,
            }
          : candidate,
      ),
    },
    applied: true,
    message: `${player?.name ?? "the attacker"} cannot play an action card on their next turn`,
  };
}

function loyalGuardsConfusionBackfire(state: GameState, playerId: PlayerId) {
  const player = state.players.find((candidate) => candidate.id === playerId);

  return {
    state: {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === playerId
          ? {
              ...candidate,
              shuffleLineBeforeNextCollection: true,
            }
          : candidate,
      ),
    },
    applied: true,
    message: `set Confusion in Line for ${player?.name ?? "the attacker"}'s next noble collection`,
  };
}

function loyalGuardsMissingHeadsBackfire(state: GameState, playerId: PlayerId) {
  const player = state.players.find((candidate) => candidate.id === playerId);

  if (!player || player.collectedNobles.length === 0) {
    return { state, applied: true, message: `${player?.name ?? "the attacker"} had no collected noble to lose` };
  }

  const discardIndex = Math.floor(Math.random() * player.collectedNobles.length);
  const discardedNoble = player.collectedNobles[discardIndex];

  if (!discardedNoble) {
    return { state, applied: false, message: "could not choose a collected noble" };
  }

  return {
    state: {
      ...state,
      players: state.players.map((candidate) => {
        if (candidate.id !== playerId) {
          return candidate;
        }

        const updatedPlayer: Player = {
          ...candidate,
          collectedNobles: candidate.collectedNobles.filter((_, index) => index !== discardIndex),
        };

        return {
          ...updatedPlayer,
          score: calculatePlayerScore(updatedPlayer),
        };
      }),
      nobleDeck: {
        ...state.nobleDeck,
        discardPile: [discardedNoble, ...state.nobleDeck.discardPile],
      },
    },
    applied: true,
    message: `${player.name} lost ${discardedNoble.card.name}`,
  };
}

function loyalGuardsInfightingBackfire(state: GameState, playerId: PlayerId) {
  const player = state.players.find((candidate) => candidate.id === playerId);

  return {
    state: {
      ...state,
      pendingChoice: {
        type: "infighting" as const,
        originalPlayerId: playerId,
        targetPlayerId: playerId,
      },
      passScreen: {
        visible: true,
      },
    },
    applied: true,
    message: `started Infighting for ${player?.name ?? "the attacker"}`,
  };
}

function loyalGuardsLackOfSupportBackfire(state: GameState, playerId: PlayerId, target: ActionTarget | undefined) {
  const player = state.players.find((candidate) => candidate.id === playerId);
  const chosenAction =
    target?.type === "action-hand-card"
      ? player?.hand.find((action) => action.instanceId === target.instanceId)
      : player?.hand[0];

  if (!player || !chosenAction) {
    return { state, applied: true, message: `${player?.name ?? "the attacker"} had no action card to discard` };
  }

  return {
    state: {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === playerId
          ? {
              ...candidate,
              hand: candidate.hand.filter((action) => action.instanceId !== chosenAction.instanceId),
            }
          : candidate,
      ),
      actionDeck: {
        ...state.actionDeck,
        discardPile: [chosenAction, ...state.actionDeck.discardPile],
      },
    },
    applied: true,
    message: `${player.name} discarded ${chosenAction.card.name} from their own hand`,
  };
}

function loyalGuardsTwistOfFateBackfire(state: GameState, playerId: PlayerId, target: ActionTarget | undefined) {
  const player = state.players.find((candidate) => candidate.id === playerId);
  const chosenAction =
    target?.type === "in-front-action"
      ? player?.inFrontActions.find((action) => action.instanceId === target.instanceId)
      : player?.inFrontActions[0];

  if (!player || !chosenAction) {
    return { state, applied: true, message: `${player?.name ?? "the attacker"} had no card in front to discard` };
  }

  return {
    state: {
      ...state,
      players: state.players.map((candidate) => {
        if (candidate.id !== playerId) {
          return candidate;
        }

        const updatedPlayer: Player = {
          ...candidate,
          inFrontActions: candidate.inFrontActions.filter((action) => action.instanceId !== chosenAction.instanceId),
        };

        return {
          ...updatedPlayer,
          score: calculatePlayerScore(updatedPlayer),
        };
      }),
      actionDeck: {
        ...state.actionDeck,
        discardPile: [chosenAction, ...state.actionDeck.discardPile],
      },
    },
    applied: true,
    message: `${player.name} discarded ${chosenAction.card.name} from in front of themself`,
  };
}

function attachPersistentActionToAttackerForLoyalGuards(
  state: GameState,
  playerId: PlayerId,
  actionCard: CardInstance<ActionCard>,
) {
  const player = state.players.find((candidate) => candidate.id === playerId);

  if (!player) {
    return { state, applied: false, message: "could not find the attacker" };
  }

  return {
    state: {
      ...state,
      players: state.players.map((candidate) => {
        if (candidate.id !== playerId) {
          return candidate;
        }

        const updatedPlayer: Player = {
          ...candidate,
          inFrontActions: [...candidate.inFrontActions, actionCard],
        };

        return {
          ...updatedPlayer,
          score: calculatePlayerScore(updatedPlayer),
        };
      }),
    },
    applied: true,
    skipDiscard: true,
    message: `put ${actionCard.card.name} in front of ${player.name}`,
  };
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

function getLoyalGuardsProtectedPlayerId(
  state: GameState,
  effectKey: ActionEffectKey,
  target: ActionTarget | undefined,
  playerId: PlayerId,
): PlayerId | undefined {
  if (effectKey === "callousGuards" || effectKey === "loyalGuards") {
    return undefined;
  }

  const playerHasLoyalGuards = (id: PlayerId) => {
    const player = state.players.find((candidate) => candidate.id === id);
    return Boolean(player && id !== playerId && findLoyalGuards(player));
  };

  if (effectKey === "forcedBreak" || effectKey === "rainDelay") {
    return state.players.find((player) => player.id !== playerId && findLoyalGuards(player))?.id;
  }

  if (
    target?.type === "player" &&
    [
      "afterYou",
      "confusionInLine",
      "infighting",
      "informationExchange",
      "missed",
      "missingHeads",
      "rushJob",
      "toughCrowd",
    ].includes(effectKey)
  ) {
    return playerHasLoyalGuards(target.playerId) ? target.playerId : undefined;
  }

  if (target?.type === "action-hand-card" && effectKey === "lackOfSupport") {
    return playerHasLoyalGuards(target.playerId) ? target.playerId : undefined;
  }

  if (target?.type === "collected-noble" && effectKey === "clericalError") {
    return playerHasLoyalGuards(target.playerId) ? target.playerId : undefined;
  }

  if (target?.type === "in-front-action" && effectKey === "twistOfFate") {
    return playerHasLoyalGuards(target.playerId) ? target.playerId : undefined;
  }

  return undefined;
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


