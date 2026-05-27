import { createLocalGameState } from "@/lib/game/createGame";
import { gameReducer } from "@/lib/game/gameReducer";
import type { GameCommand, GameState, PlayerId } from "@/lib/game/types";
import type { RoomPlayer } from "./roomStore";

export function createOnlineGameState(roomPlayers: RoomPlayer[]): GameState {
  const state = createLocalGameState(roomPlayers.map((player) => player.name), { shufflePlayers: false });
  const oldPlayerIds = state.players.map((player) => player.id);
  const playerIdMap = new Map(oldPlayerIds.map((oldPlayerId, index) => [oldPlayerId, roomPlayers[index]?.id ?? oldPlayerId]));
  const mappedPlayers = state.players.map((player, index) => ({
    ...player,
    id: roomPlayers[index]?.id ?? player.id,
    name: roomPlayers[index]?.name ?? player.name,
  }));

  return {
    ...state,
    players: shuffleItems(mappedPlayers),
    playerBriefings: Object.fromEntries(
      Object.entries(state.playerBriefings).map(([oldPlayerId, entries]) => [playerIdMap.get(oldPlayerId) ?? oldPlayerId, entries]),
    ),
    log: state.log.map((entry) => ({
      ...entry,
      playerId: remapOptionalPlayerId(entry.playerId, playerIdMap),
      affectedPlayerIds: entry.affectedPlayerIds?.map((playerId) => playerIdMap.get(playerId) ?? playerId),
    })),
    detailedLog: state.detailedLog.map((entry) => ({
      ...entry,
      playerId: remapOptionalPlayerId(entry.playerId, playerIdMap),
      affectedPlayerIds: entry.affectedPlayerIds?.map((playerId) => playerIdMap.get(playerId) ?? playerId),
    })),
  };
}

export function applyOnlineGameCommand(state: GameState, command: GameCommand): { state: GameState; error?: string } {
  const validationError = validateOnlineCommand(state, command);

  if (validationError) {
    return { state, error: validationError };
  }

  let nextState = gameReducer(state, command);

  if (nextState === state) {
    return { state, error: "That command could not be applied." };
  }

  nextState = settleOnlineTurnFlow(nextState);

  if (nextState.passScreen.visible) {
    nextState = {
      ...nextState,
      passScreen: {
        visible: false,
      },
    };
  }

  return { state: nextState };
}

function validateOnlineCommand(state: GameState, command: GameCommand): string | undefined {
  if (command.type === "TAKE_FRONT_NOBLE") {
    const currentPlayer = getCurrentPlayer(state);

    if (state.phase !== "playing") {
      return "The game is not currently playing.";
    }

    if (state.pendingChoice) {
      return "Resolve the pending choice before playing another action.";
    }

    if (!currentPlayer || currentPlayer.id !== command.playerId) {
      return "It is not your turn.";
    }

    if (state.turnStep === "turnComplete") {
      return "You already took a noble. End your turn.";
    }

    if (state.nobleLine.cards.length === 0) {
      return "There is no noble to take.";
    }
  }

  if (command.type === "CONFIRM_REORDER_AND_TAKE_FRONT_NOBLE") {
    const currentPlayer = getCurrentPlayer(state);

    if (state.phase !== "playing") {
      return "The game is not currently playing.";
    }

    if (state.pendingChoice) {
      return "Resolve the pending choice before playing another action.";
    }

    if (!currentPlayer || currentPlayer.id !== command.playerId) {
      return "It is not your turn.";
    }

    if (state.turnStep !== "playActionOptional") {
      return "You cannot reorder before taking a noble right now.";
    }

    const actionCard = currentPlayer.hand.find((card) => card.instanceId === command.cardId);

    if (!actionCard || actionCard.card.effectKey !== "opinionatedGuards") {
      return "Opinionated Guards is not available to confirm.";
    }

    if (currentPlayer.skipActionThisTurn || currentPlayer.skipNextActionTurn) {
      return "Rush Job prevents you from playing an action card this turn.";
    }

    if (state.nobleLine.cards.length === 0) {
      return "There is no noble to take.";
    }
  }

  if (command.type === "END_TURN") {
    const currentPlayer = getCurrentPlayer(state);

    if (state.phase !== "playing") {
      return "The game is not currently playing.";
    }

    if (state.pendingChoice) {
      return "Resolve the pending choice before playing another action.";
    }

    if (!currentPlayer || currentPlayer.id !== command.playerId) {
      return "It is not your turn.";
    }

    if (state.turnStep !== "turnComplete") {
      return "Take the front noble before ending your turn.";
    }
  }

  if (command.type === "PLAY_ACTION_CARD") {
    const currentPlayer = getCurrentPlayer(state);

    if (state.phase !== "playing") {
      return "The game is not currently playing.";
    }

    if (state.pendingChoice) {
      return "Resolve the pending choice before playing another action.";
    }

    if (!currentPlayer || currentPlayer.id !== command.playerId) {
      return "It is not your turn.";
    }

    if (state.turnStep !== "playActionOptional") {
      return "You have already played or skipped your action.";
    }

    if (currentPlayer.skipActionThisTurn || currentPlayer.skipNextActionTurn) {
      return "Rush Job prevents you from playing an action card this turn.";
    }

    if (!currentPlayer.hand.some((card) => card.instanceId === command.cardId)) {
      return "Action card not found in your hand.";
    }
  }

  if (command.type === "DISCARD_CALLOUS_GUARDS") {
    const player = state.players.find((candidate) => candidate.id === command.playerId);

    if (state.phase !== "playing") {
      return "The game is not currently playing.";
    }

    if (!player) {
      return "Player not found.";
    }

    if (!player.inFrontActions.some((action) => action.instanceId === command.cardId && action.card.effectKey === "callousGuards")) {
      return "Callous Guards not found in front of you.";
    }
  }

  if (command.type === "RESOLVE_INFIGHTING") {
    const pending = state.pendingChoice;

    if (state.phase !== "playing" || pending?.type !== "infighting") {
      return "There is no Infighting choice to resolve.";
    }

    if (pending.targetPlayerId !== command.playerId) {
      return "This Infighting choice is not for you.";
    }
  }

  if (command.type === "RESOLVE_CLERICAL_ERROR_RETURN") {
    const pending = state.pendingChoice;

    if (state.phase !== "playing" || pending?.type !== "clericalErrorReturn") {
      return "There is no Clerical Error choice to resolve.";
    }

    if (pending.targetPlayerId !== command.playerId) {
      return "This Clerical Error choice is not for you.";
    }
  }

  if (command.type === "RESOLVE_INNOCENT_VICTIM_DISCARD") {
    const pending = state.pendingChoice;

    if (state.phase !== "playing" || pending?.type !== "innocentVictimDiscard") {
      return "There is no Innocent Victim choice to resolve.";
    }

    if (pending.targetPlayerId !== command.playerId) {
      return "This Innocent Victim choice is not for you.";
    }

    const player = state.players.find((candidate) => candidate.id === command.playerId);

    if (player && player.hand.length > 0 && !command.cardId) {
      return "Choose an action card to discard.";
    }

    if (command.cardId && !player?.hand.some((card) => card.instanceId === command.cardId)) {
      return "That action card is not in your hand.";
    }
  }

  if (command.type === "RESOLVE_CLOWN_GIFT") {
    const pending = state.pendingChoice;

    if (state.phase !== "playing" || pending?.type !== "clownGift") {
      return "There is no Clown choice to resolve.";
    }

    if (pending.targetPlayerId !== command.playerId) {
      return "This Clown choice is not for you.";
    }

    if (command.targetPlayerId === command.playerId) {
      return "Choose another player to receive The Clown.";
    }

    if (!state.players.some((player) => player.id === command.targetPlayerId)) {
      return "Target player not found.";
    }
  }

  if (command.type === "RESOLVE_LOYAL_GUARDS") {
    const pending = state.pendingChoice;

    if (state.phase !== "playing" || pending?.type !== "loyalGuards") {
      return "There is no Loyal Guards choice to resolve.";
    }

    if (pending.targetPlayerId !== command.playerId) {
      return "This Loyal Guards choice is not for you.";
    }
  }

  return undefined;
}

function getCurrentPlayer(state: GameState) {
  return state.players[state.currentPlayerIndex];
}

function applyOnlineStartOfTurnEffects(state: GameState): GameState {
  const currentPlayer = getCurrentPlayer(state);

  if (state.phase !== "playing" || state.turnStep !== "playActionOptional" || !currentPlayer?.skipNextActionTurn) {
    return state;
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
  };
}

function settleOnlineTurnFlow(state: GameState): GameState {
  let nextState = state;

  for (let guard = 0; guard < 4; guard += 1) {
    const beforeState = nextState;
    nextState = applyOnlineStartOfTurnEffects(nextState);
    nextState = advanceCompletedOnlineTurn(nextState);
    nextState = applyOnlineStartOfTurnEffects(nextState);

    if (nextState === beforeState || nextState.turnStep !== "turnComplete" || nextState.pendingChoice) {
      return nextState;
    }
  }

  return nextState;
}

function advanceCompletedOnlineTurn(state: GameState): GameState {
  const currentPlayer = getCurrentPlayer(state);

  if (state.phase !== "playing" || state.turnStep !== "turnComplete" || state.pendingChoice || !currentPlayer) {
    return state;
  }

  return gameReducer(state, {
    type: "END_TURN",
    playerId: currentPlayer.id,
  });
}

function remapOptionalPlayerId(playerId: PlayerId | undefined, playerIdMap: Map<PlayerId, PlayerId>) {
  return playerId ? playerIdMap.get(playerId) ?? playerId : undefined;
}

function shuffleItems<TItem>(items: TItem[]): TItem[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}
