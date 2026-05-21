import { calculatePlayerScore } from "@/lib/game/scoring";
import type {
  ActionEffectKey,
  ActionTarget,
  CardInstance,
  GameState,
  NobleCard,
  Player,
  PlayerId,
} from "@/lib/game/types";

type ActionEffectContext = {
  playerId: PlayerId;
  target?: ActionTarget;
};

export type ValidActionTarget = {
  target: ActionTarget;
  label: string;
  nobleName?: string;
  fromPosition?: number;
  toPosition?: number;
};

type ActionEffectResult = {
  state: GameState;
  applied: boolean;
  message: string;
  endsTurn?: boolean;
  logMessage?: string;
  skipEmptyLineDayEnd?: boolean;
};

type ActionEffectDefinition = {
  label: string;
  requiresTarget: boolean;
  canApply: (state: GameState, context: ActionEffectContext) => boolean;
  getValidTargets: (state: GameState, context: ActionEffectContext) => ValidActionTarget[];
  apply: (state: GameState, context: ActionEffectContext) => ActionEffectResult;
};

export const actionEffects: Record<ActionEffectKey, ActionEffectDefinition> = {
  notImplemented: createImmediateEffect("Effect not implemented yet", (state) => ({
    state,
    applied: true,
    message: "resolved with no prototype effect yet",
  })),
  friendOfTheQueen: createMoveEffect({
    label: "Move a noble backward up to 2 spaces",
    direction: "backward",
    spaces: [1, 2],
  }),
  pushed: createMoveEffect({
    label: "Move a noble forward exactly 2 spaces",
    direction: "forward",
    spaces: [2],
  }),
  stumble: createMoveEffect({
    label: "Move a noble forward exactly 1 space",
    direction: "forward",
    spaces: [1],
  }),
  ignobleNoble: createMoveEffect({
    label: "Move a noble forward exactly 4 spaces",
    direction: "forward",
    spaces: [4],
  }),
  lIdiot: createMoveEffect({
    label: "Move a noble forward 1 or 2 spaces",
    direction: "forward",
    spaces: [1, 2],
  }),
  tisFarBetterThing: createMoveEffect({
    label: "Move a noble forward exactly 3 places",
    direction: "forward",
    spaces: [3],
  }),
  wasThatMyName: createMoveEffect({
    label: "Move a noble forward up to 3 places",
    direction: "forward",
    spaces: [1, 2, 3],
  }),
  forwardMarch: createMoveToFrontEffect({
    label: "Move a Palace Guard to the front of the line",
    predicate: (noble) => noble.card.name === "Palace Guard",
  }),
  publicDemand: createMoveToFrontEffect({
    label: "Move any noble in line to the front of the line",
    predicate: () => true,
    allowAlreadyFront: true,
  }),
  letThemEatCake: createImmediateEffect("Move Marie Antoinette to the front of the line", moveMarieAntoinetteToFront),
  scarletPimpernel: createImmediateEffect("End the day after this turn", markDayEndsAfterTurn),
  bribedGuards: createImmediateEffect("Move the front noble to the end of the line", moveFrontNobleToEnd),
  theLongWalk: createImmediateEffect("Reverse the order of the line", reverseNobleLine),
  extraCart: createImmediateEffect("Add 3 nobles to the end of the line", addExtraCartNobles),
  politicalInfluence: createImmediateEffect("Draw 3 action cards and end this turn", drawPoliticalInfluenceCards),
  doubleFeature: createImmediateEffect("Take an extra front noble immediately", takeExtraFrontNoble),
  moveFrontNobleBackOne: createImmediateEffect("Move the first noble back one position", (state) => {
    const cards = [...state.nobleLine.cards];

    if (cards.length < 2) {
      return invalidResult(state, "there were not enough nobles to move");
    }

    [cards[0], cards[1]] = [cards[1], cards[0]];

    return {
      state: withNobleLine(state, cards),
      applied: true,
      message: "moved the front noble back one position",
    };
  }),
  moveBackNobleForwardOne: createImmediateEffect("Move the last noble forward one position", (state) => {
    const cards = [...state.nobleLine.cards];

    if (cards.length < 2) {
      return invalidResult(state, "there were not enough nobles to move");
    }

    const lastIndex = cards.length - 1;
    [cards[lastIndex - 1], cards[lastIndex]] = [cards[lastIndex], cards[lastIndex - 1]];

    return {
      state: withNobleLine(state, cards),
      applied: true,
      message: "moved the back noble forward one position",
    };
  }),
  swapFirstTwoNobles: createImmediateEffect("Swap the first two nobles", (state) => {
    const cards = [...state.nobleLine.cards];

    if (cards.length < 2) {
      return invalidResult(state, "there were not enough nobles to swap");
    }

    [cards[0], cards[1]] = [cards[1], cards[0]];

    return {
      state: withNobleLine(state, cards),
      applied: true,
      message: "swapped the first two nobles",
    };
  }),
  drawOneActionCard: createImmediateEffect("Draw one action card", (state, context) => drawActionCards(state, context.playerId, 1)),
};

export function applyActionEffect(
  state: GameState,
  effectKey: ActionEffectKey,
  context: ActionEffectContext,
): ActionEffectResult {
  return actionEffects[effectKey].apply(state, context);
}

export function canApplyActionEffect(state: GameState, effectKey: ActionEffectKey, context: ActionEffectContext): boolean {
  return actionEffects[effectKey].canApply(state, context);
}

export function getValidActionTargets(
  state: GameState,
  effectKey: ActionEffectKey,
  context: ActionEffectContext,
): ValidActionTarget[] {
  return actionEffects[effectKey].getValidTargets(state, context);
}

export function actionEffectRequiresTarget(effectKey: ActionEffectKey): boolean {
  return actionEffects[effectKey].requiresTarget;
}

function createImmediateEffect(
  label: string,
  apply: (state: GameState, context: ActionEffectContext) => ActionEffectResult,
): ActionEffectDefinition {
  return {
    label,
    requiresTarget: false,
    canApply: (state, context) => apply(state, context).applied,
    getValidTargets: () => [],
    apply,
  };
}

function createMoveEffect(config: {
  label: string;
  direction: "forward" | "backward";
  spaces: number[];
}): ActionEffectDefinition {
  return {
    label: config.label,
    requiresTarget: true,
    canApply: (state) => getMoveTargets(state, config).length > 0,
    getValidTargets: (state) => getMoveTargets(state, config),
    apply: (state, context) => applyMoveTarget(state, context.target, config),
  };
}

function createMoveToFrontEffect(config: {
  label: string;
  predicate: (noble: CardInstance<NobleCard>) => boolean;
  allowAlreadyFront?: boolean;
}): ActionEffectDefinition {
  return {
    label: config.label,
    requiresTarget: true,
    canApply: (state) => getMoveToFrontTargets(state, config.predicate, config.allowAlreadyFront ?? false).length > 0,
    getValidTargets: (state) => getMoveToFrontTargets(state, config.predicate, config.allowAlreadyFront ?? false),
    apply: (state, context) => applyMoveToFrontTarget(state, context.target, config.predicate, config.allowAlreadyFront ?? false),
  };
}

function getMoveTargets(
  state: GameState,
  config: { direction: "forward" | "backward"; spaces: number[] },
): ValidActionTarget[] {
  return state.nobleLine.cards.flatMap((noble, index) =>
    config.spaces.flatMap((spaceCount) => {
      const destinationIndex = getDestinationIndex(index, config.direction, spaceCount);

      if (destinationIndex < 0 || destinationIndex >= state.nobleLine.cards.length || destinationIndex === index) {
        return [];
      }

      return [
        {
          target: {
            type: "move-noble" as const,
            instanceId: noble.instanceId,
            spaces: config.direction === "forward" ? spaceCount : -spaceCount,
          },
          label: `${noble.card.name}: ${index + 1} -> ${destinationIndex + 1}`,
          nobleName: noble.card.name,
          fromPosition: index + 1,
          toPosition: destinationIndex + 1,
        },
      ];
    }),
  );
}

function getMoveToFrontTargets(
  state: GameState,
  predicate: (noble: CardInstance<NobleCard>) => boolean,
  allowAlreadyFront: boolean,
): ValidActionTarget[] {
  return state.nobleLine.cards.flatMap((noble, index) => {
    if (!predicate(noble) || (index === 0 && !allowAlreadyFront)) {
      return [];
    }

    return [
      {
        target: {
          type: "noble" as const,
          instanceId: noble.instanceId,
        },
        label: `${noble.card.name}: ${index + 1} -> 1`,
        nobleName: noble.card.name,
        fromPosition: index + 1,
        toPosition: 1,
      },
    ];
  });
}

function applyMoveTarget(
  state: GameState,
  target: ActionTarget | undefined,
  config: { direction: "forward" | "backward"; spaces: number[] },
): ActionEffectResult {
  if (!target || target.type !== "move-noble") {
    return invalidResult(state, "requires a noble movement target");
  }

  const direction = target.spaces > 0 ? "forward" : "backward";
  const absoluteSpaces = Math.abs(target.spaces);

  if (direction !== config.direction || !config.spaces.includes(absoluteSpaces)) {
    return invalidResult(state, "has an invalid movement distance");
  }

  const fromIndex = state.nobleLine.cards.findIndex((noble) => noble.instanceId === target.instanceId);
  const toIndex = getDestinationIndex(fromIndex, direction, absoluteSpaces);

  if (fromIndex < 0 || toIndex < 0 || toIndex >= state.nobleLine.cards.length) {
    return invalidResult(state, "cannot move outside the line");
  }

  const noble = state.nobleLine.cards[fromIndex];
  const cards = state.nobleLine.cards.filter((card) => card.instanceId !== target.instanceId);
  cards.splice(toIndex, 0, noble);

  return {
    state: withNobleLine(state, cards),
    applied: true,
    message: `moved ${noble.card.name} from position ${fromIndex + 1} to ${toIndex + 1}`,
  };
}

function applyMoveToFrontTarget(
  state: GameState,
  target: ActionTarget | undefined,
  predicate: (noble: CardInstance<NobleCard>) => boolean,
  allowAlreadyFront: boolean,
): ActionEffectResult {
  if (!target || target.type !== "noble") {
    return invalidResult(state, "requires a noble target");
  }

  const fromIndex = state.nobleLine.cards.findIndex((noble) => noble.instanceId === target.instanceId);
  const noble = state.nobleLine.cards[fromIndex];

  if (fromIndex < 0 || !noble || !predicate(noble) || (fromIndex === 0 && !allowAlreadyFront)) {
    return invalidResult(state, "does not have a legal target to move to the front");
  }

  if (fromIndex === 0) {
    return {
      state,
      applied: true,
      message: `${noble.card.name} was already at the front of the line`,
    };
  }

  return moveNobleToIndex(state, fromIndex, 0);
}

function moveMarieAntoinetteToFront(state: GameState): ActionEffectResult {
  const fromIndex = state.nobleLine.cards.findIndex((noble) => noble.card.name === "Marie Antoinette");

  if (fromIndex < 0) {
    return invalidResult(state, "Marie Antoinette is not in line");
  }

  if (fromIndex === 0) {
    return {
      state,
      applied: true,
      message: "Marie Antoinette was already at the front of the line",
    };
  }

  return moveNobleToIndex(state, fromIndex, 0);
}

function reverseNobleLine(state: GameState, context: ActionEffectContext): ActionEffectResult {
  return {
    state: withNobleLine(state, [...state.nobleLine.cards].reverse()),
    applied: true,
    message: "reversed the noble line",
    logMessage: `${getPlayerName(state, context.playerId)} reversed the noble line with The Long Walk.`,
    skipEmptyLineDayEnd: true,
  };
}

function moveFrontNobleToEnd(state: GameState): ActionEffectResult {
  if (state.nobleLine.cards.length < 2) {
    return invalidResult(state, "there were not enough nobles to move the front noble to the end");
  }

  return moveNobleToIndex(state, 0, state.nobleLine.cards.length - 1);
}

function markDayEndsAfterTurn(state: GameState): ActionEffectResult {
  return {
    state: {
      ...state,
      turnEffects: {
        ...state.turnEffects,
        endDayAfterTurn: true,
      },
    },
    applied: true,
    message: "marked this day to end after the turn",
  };
}

function moveNobleToIndex(state: GameState, fromIndex: number, toIndex: number): ActionEffectResult {
  const noble = state.nobleLine.cards[fromIndex];

  if (!noble || toIndex < 0 || toIndex >= state.nobleLine.cards.length || fromIndex === toIndex) {
    return invalidResult(state, "cannot move that noble");
  }

  const cards = state.nobleLine.cards.filter((_, index) => index !== fromIndex);
  cards.splice(toIndex, 0, noble);

  return {
    state: withNobleLine(state, cards),
    applied: true,
    message: `moved ${noble.card.name} from position ${fromIndex + 1} to ${toIndex + 1}`,
  };
}

function getDestinationIndex(fromIndex: number, direction: "forward" | "backward", spaces: number): number {
  return direction === "forward" ? fromIndex - spaces : fromIndex + spaces;
}

function addExtraCartNobles(state: GameState): ActionEffectResult {
  const noblesToAdd = state.nobleDeck.drawPile.slice(0, 3);

  if (noblesToAdd.length === 0) {
    return invalidResult(state, "had no nobles left to add");
  }

  return {
    state: {
      ...state,
      nobleLine: {
        cards: [...state.nobleLine.cards, ...noblesToAdd],
      },
      nobleDeck: {
        ...state.nobleDeck,
        drawPile: state.nobleDeck.drawPile.slice(noblesToAdd.length),
      },
    },
    applied: true,
    message: `added ${noblesToAdd.length} noble${noblesToAdd.length === 1 ? "" : "s"} to the end of the line`,
  };
}

function drawPoliticalInfluenceCards(state: GameState, context: ActionEffectContext): ActionEffectResult {
  const result = drawActionCards(state, context.playerId, 3);

  return {
    ...result,
    endsTurn: result.applied,
    message: `${result.message} and ended the turn without taking a noble`,
  };
}

function drawActionCards(state: GameState, playerId: PlayerId, count: number): ActionEffectResult {
  const cardsToDraw = state.actionDeck.drawPile.slice(0, count);

  if (cardsToDraw.length === 0) {
    return invalidResult(state, "had no action cards left to draw");
  }

  return {
    state: {
      ...state,
      players: state.players.map((player) =>
        player.id === playerId
          ? {
              ...player,
              hand: [...player.hand, ...cardsToDraw],
            }
          : player,
      ),
      actionDeck: {
        ...state.actionDeck,
        drawPile: state.actionDeck.drawPile.slice(cardsToDraw.length),
      },
    },
    applied: true,
    message: `drew ${cardsToDraw.length} action card${cardsToDraw.length === 1 ? "" : "s"}`,
  };
}

function takeExtraFrontNoble(state: GameState, context: ActionEffectContext): ActionEffectResult {
  const frontNoble = state.nobleLine.cards[0];

  if (!frontNoble) {
    return invalidResult(state, "had no noble available to take");
  }

  const updatedLine = state.nobleLine.cards.slice(1);

  const updatedPlayers = state.players.map((player) => {
    if (player.id !== context.playerId) {
      return player;
    }

    const updatedPlayer: Player = {
      ...player,
      collectedNobles: [...player.collectedNobles, frontNoble],
    };

    return {
      ...updatedPlayer,
      score: calculatePlayerScore(updatedPlayer),
    };
  });

  return {
    state: {
      ...state,
      players: updatedPlayers,
      nobleLine: {
        cards: updatedLine,
      },
    },
    applied: true,
    message: `took ${frontNoble.card.name} immediately as an extra noble`,
  };
}

function getPlayerName(state: GameState, playerId: PlayerId): string {
  return state.players.find((player) => player.id === playerId)?.name ?? "Player";
}

function withNobleLine(state: GameState, cards: CardInstance<NobleCard>[]): GameState {
  return {
    ...state,
    nobleLine: {
      cards,
    },
  };
}

function invalidResult(state: GameState, message: string): ActionEffectResult {
  return {
    state,
    applied: false,
    message,
  };
}





