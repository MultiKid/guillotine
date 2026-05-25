import { actionDefinitions, ACTION_DECK_SIZE } from "@/lib/cards/actions";
import { getDefinitionCount } from "@/lib/cards/definitions";
import { nobleDefinitions, NOBLE_DECK_SIZE } from "@/lib/cards/nobles";
import {
  MAX_DAYS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  NOBLE_LINE_SIZE,
  STARTING_HAND_SIZE,
} from "@/lib/game/constants";
import { createCardInstancesFromDefinitions, shuffleDeck } from "@/lib/game/deck";
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
    passScreen: {
      visible: false,
    },
    turnEffects: {
      endDayAfterTurn: false,
    },
    turnSummary: {
      nobleNames: [],
      pointDelta: 0,
    },
    pendingChoice: undefined,
    returningFromPrivateChoice: false,
    notice: undefined,
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
    detailedLog: [],
    playerBriefings: {},
    gameHistory: [],
    winnerIds: [],
  };
}

export function createLocalGameState(playerNames: string[], options: { shufflePlayers?: boolean } = {}): GameState {
  const cleanedNames = playerNames.map((name) => name.trim()).filter(Boolean);
  const orderedNames = options.shufflePlayers === false ? cleanedNames : shuffleItems(cleanedNames);

  if (cleanedNames.length < MIN_PLAYERS || cleanedNames.length > MAX_PLAYERS) {
    throw new Error(`Local games require ${MIN_PLAYERS}-${MAX_PLAYERS} players.`);
  }

  validateDeckSizes();

  const actionDrawPile = shuffleDeck(createCardInstancesFromDefinitions(actionDefinitions));
  const nobleDrawPile = shuffleDeck(createCardInstancesFromDefinitions(nobleDefinitions));
  const { players, remainingActions } = dealPlayers(orderedNames, actionDrawPile);
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
    detailedLog: [
      {
        id: "detail-game-started",
        message: `Started a local game for ${cleanedNames.length} players.`,
        day: 1,
      },
    ],
    playerBriefings: Object.fromEntries(players.map((player) => [player.id, []])),
  };
}

function validateDeckSizes() {
  const nobleCount = getDefinitionCount(nobleDefinitions);
  const actionCount = getDefinitionCount(actionDefinitions);

  if (nobleCount !== NOBLE_DECK_SIZE) {
    throw new Error(`Expected ${NOBLE_DECK_SIZE} noble cards, received ${nobleCount}.`);
  }

  if (actionCount !== ACTION_DECK_SIZE) {
    throw new Error(`Expected ${ACTION_DECK_SIZE} action cards, received ${actionCount}.`);
  }
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
      inFrontActions: [],
      collectedNobles: [] as CardInstance<NobleCard>[],
      skipNextActionTurn: false,
      skipActionThisTurn: false,
      shuffleLineBeforeNextCollection: false,
      score: 0,
    };
  });

  return { players, remainingActions };
}

function shuffleItems<TItem>(items: TItem[]): TItem[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}


