import { placeholderActions } from "@/lib/cards/actions.placeholder";
import { placeholderNobles } from "@/lib/cards/nobles.placeholder";
import {
  MAX_DAYS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  NOBLE_LINE_SIZE,
  STARTING_HAND_SIZE,
} from "@/lib/game/constants";
import { createCardInstances, shuffleDeck } from "@/lib/game/deck";
import { calculatePlayerScore } from "@/lib/game/scoring";
import type { ActionCard, CardInstance, GameState, NobleCard, Player } from "@/lib/game/types";

export function createInitialGameState(): GameState {
  return {
    phase: "setup",
    day: 1,
    maxDays: 3,
    players: [],
    currentPlayerIndex: 0,
    turnStep: "playActionOptional",
    nobleDeck: {
      drawPile: [],
      discardPile: [],
    },
    actionDeck: {
      drawPile: [],
      discardPile: [],
    },
    nobleLine: {
      cards: [],
    },
    log: [],
    gameHistory: [],
    winnerIds: [],
  };
}

export function createLocalGameState(playerNames: string[]): GameState {
  const cleanedNames = playerNames.map((name) => name.trim()).filter(Boolean);

  if (cleanedNames.length < MIN_PLAYERS || cleanedNames.length > MAX_PLAYERS) {
    throw new Error(`Local games require ${MIN_PLAYERS}-${MAX_PLAYERS} players.`);
  }

  const actionDrawPile = shuffleDeck(createCardInstances(placeholderActions, 10));
  const nobleDrawPile = shuffleDeck(createCardInstances(placeholderNobles, 6));
  const { players, remainingActions } = dealPlayers(cleanedNames, actionDrawPile);
  const nobleLineCards = nobleDrawPile.slice(0, NOBLE_LINE_SIZE);

  return {
    ...createInitialGameState(),
    phase: "playing",
    maxDays: MAX_DAYS,
    players: players.map((player) => ({
      ...player,
      score: calculatePlayerScore(player),
    })),
    actionDeck: {
      drawPile: remainingActions,
      discardPile: [],
    },
    nobleDeck: {
      drawPile: nobleDrawPile.slice(NOBLE_LINE_SIZE),
      discardPile: [],
    },
    nobleLine: {
      cards: nobleLineCards,
    },
    log: [
      {
        id: "game-started",
        message: `Started a local game for ${cleanedNames.length} players.`,
        day: 1,
      },
    ],
  };
}

function dealPlayers(
  names: string[],
  actionDrawPile: CardInstance<ActionCard>[],
): { players: Player[]; remainingActions: CardInstance<ActionCard>[] } {
  let remainingActions = actionDrawPile;

  const players = names.map((name, index) => {
    const hand = remainingActions.slice(0, STARTING_HAND_SIZE);
    remainingActions = remainingActions.slice(STARTING_HAND_SIZE);

    return {
      id: `player-${index + 1}`,
      name,
      hand,
      collectedNobles: [] as CardInstance<NobleCard>[],
      score: 0,
    };
  });

  return { players, remainingActions };
}
