import { calculatePlayerScore } from "@/lib/game/scoring";
import { STARTING_HAND_SIZE } from "@/lib/game/constants";
import { shuffleDeck } from "@/lib/game/deck";
import type {
  ActionEffectKey,
  ActionTarget,
  ActionCard,
  CardInstance,
  GameState,
  NobleCard,
  NobleColorCategory,
  Player,
  PlayerId,
} from "@/lib/game/types";

type ActionEffectContext = {
  playerId: PlayerId;
  target?: ActionTarget;
  actionCard?: CardInstance<ActionCard>;
};

export type ValidActionTarget = {
  target: ActionTarget;
  label: string;
  nobleName?: string;
  revealedNoble?: CardInstance<NobleCard>;
  revealedAction?: CardInstance<ActionCard>;
  playerId?: PlayerId;
  playerName?: string;
  fromPosition?: number;
  toPosition?: number;
};

type ActionEffectResult = {
  state: GameState;
  applied: boolean;
  message: string;
  endsTurn?: boolean;
  allowsAnotherAction?: boolean;
  logMessage?: string;
  extraLogMessages?: string[];
  detailLogMessage?: string;
  extraDetailLogMessages?: string[];
  skipEmptyLineDayEnd?: boolean;
  skipDiscard?: boolean;
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
  lackOfFaith: createImmediateEffect("Move the Blue noble nearest the front to the front of the line", moveNearestBlueNobleToFront),
  militaryMight: createColorMoveEffect({
    label: "Move a Red noble forward up to 2 places",
    colorCategory: "red",
  }),
  majesty: createColorMoveEffect({
    label: "Move a Purple noble forward up to 2 places",
    colorCategory: "purple",
  }),
  civicPride: createColorMoveEffect({
    label: "Move a Green noble forward up to 2 places",
    colorCategory: "green",
  }),
  trip: createMoveEffect({
    label: "Move a noble backward exactly 1 place, then play another action",
    direction: "backward",
    spaces: [1],
    allowsAnotherAction: true,
  }),
  faintingSpell: createMoveEffect({
    label: "Move a noble backward up to 3 places",
    direction: "backward",
    spaces: [1, 2, 3],
  }),
  fledToEngland: createDiscardNobleEffect(),
  forcedBreak: createImmediateEffect("All other players discard one random action card", forceOtherPlayersToDiscard),
  rainDelay: createImmediateEffect("Shuffle all hands into the action deck and redeal hands", shuffleHandsAndRedeal),
  massConfusion: createImmediateEffect("Replace the line by shuffling it back into the noble deck", replaceLineFromShuffledNobleDeck),
  escape: createImmediateEffect("Discard two random nobles and shuffle the remaining line", discardRandomNoblesAndShuffleLine),
  millingInLine: createImmediateEffect("Randomly rearrange the first 5 nobles in line", shuffleFirstFiveNobles),
  toughCrowd: createAttachToOtherPlayerEffect(),
  militarySupport: createAttachToSelfEffect(),
  churchSupport: createAttachToSelfEffect(),
  civicSupport: createAttachToSelfEffect(),
  fountainOfBlood: createAttachToSelfEffect(),
  indifferentPublic: createAttachToSelfEffect(),
  foreignSupport: createAttachToSelfEffect(),
  opinionatedGuards: createReorderFirstNoblesEffect(),
  lateArrival: createLateArrivalEffect(),
  ratBreak: createRatBreakEffect(),
  missed: createMissedEffect(),
  rushJob: createRushJobEffect(),
  informationExchange: createInformationExchangeEffect(),
  twistOfFate: createTwistOfFateEffect(),
  afterYou: createAfterYouEffect(),
  clothingSwap: createClothingSwapEffect(),
  confusionInLine: createConfusionInLineEffect(),
  missingHeads: createMissingHeadsEffect(),
  callousGuards: createAttachToSelfEffect(),
  infighting: createInfightingEffect(),
  clericalError: createClericalErrorEffect(),
  lackOfSupport: createLackOfSupportEffect(),
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
  const restriction = getActionPlayRestriction(state, effectKey);

  if (restriction) {
    return invalidResult(state, restriction);
  }

  return actionEffects[effectKey].apply(state, context);
}

export function applyAfterActionCardTriggers(state: GameState): { state: GameState; logMessages: string[] } {
  const masterSpyIndex = state.nobleLine.cards.findIndex((noble) => noble.card.name === "Master Spy");

  if (masterSpyIndex < 0 || masterSpyIndex === state.nobleLine.cards.length - 1) {
    return { state, logMessages: [] };
  }

  const masterSpy = state.nobleLine.cards[masterSpyIndex];

  if (!masterSpy) {
    return { state, logMessages: [] };
  }

  const cards = state.nobleLine.cards.filter((_, index) => index !== masterSpyIndex);

  return {
    state: withNobleLine(state, [...cards, masterSpy]),
    logMessages: ["Master Spy moved to the end of the line after an action card was played."],
  };
}

export function canApplyActionEffect(state: GameState, effectKey: ActionEffectKey, context: ActionEffectContext): boolean {
  if (getActionPlayRestriction(state, effectKey)) {
    return false;
  }

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

const lineAlteringActionEffects = new Set<ActionEffectKey>([
  "bribedGuards",
  "civicPride",
  "clothingSwap",
  "confusionInLine",
  "escape",
  "extraCart",
  "faintingSpell",
  "fledToEngland",
  "forwardMarch",
  "friendOfTheQueen",
  "ignobleNoble",
  "lackOfFaith",
  "lateArrival",
  "letThemEatCake",
  "lIdiot",
  "majesty",
  "massConfusion",
  "militaryMight",
  "millingInLine",
  "missed",
  "moveBackNobleForwardOne",
  "moveFrontNobleBackOne",
  "opinionatedGuards",
  "publicDemand",
  "pushed",
  "stumble",
  "swapFirstTwoNobles",
  "theLongWalk",
  "tisFarBetterThing",
  "trip",
  "wasThatMyName",
]);

export function hasActiveCallousGuards(state: GameState): boolean {
  return state.players.some((player) => player.inFrontActions.some((action) => action.card.effectKey === "callousGuards"));
}

export function isActionBlockedByCallousGuards(state: GameState, effectKey: ActionEffectKey): boolean {
  return hasActiveCallousGuards(state) && lineAlteringActionEffects.has(effectKey);
}

export function getCallousGuardsBlockedMessage(): string {
  return "Callous Guards prevents action cards that alter the line.";
}

export function hasUnpopularJudgeAtFront(state: GameState): boolean {
  return state.nobleLine.cards[0]?.card.name === "Unpopular Judge";
}

export function getUnpopularJudgeBlockedMessage(): string {
  return "Unpopular Judge is at the front of the line. Action cards cannot be played.";
}

export function getActionPlayRestriction(state: GameState, effectKey: ActionEffectKey): string | undefined {
  if (hasUnpopularJudgeAtFront(state)) {
    return getUnpopularJudgeBlockedMessage();
  }

  if (isActionBlockedByCallousGuards(state, effectKey)) {
    return getCallousGuardsBlockedMessage();
  }

  return undefined;
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
  predicate?: (noble: CardInstance<NobleCard>) => boolean;
  allowsAnotherAction?: boolean;
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

function createDiscardNobleEffect(): ActionEffectDefinition {
  return {
    label: "Discard any noble in line",
    requiresTarget: true,
    canApply: (state) => state.nobleLine.cards.length > 0,
    getValidTargets: (state) =>
      state.nobleLine.cards.map((noble, index) => ({
        target: {
          type: "noble" as const,
          instanceId: noble.instanceId,
        },
        label: `Discard ${noble.card.name} from position ${index + 1}`,
        nobleName: noble.card.name,
        fromPosition: index + 1,
      })),
    apply: discardNobleTarget,
  };
}

function createAttachToSelfEffect(): ActionEffectDefinition {
  return {
    label: "Put this card in front of you",
    requiresTarget: false,
    canApply: () => true,
    getValidTargets: () => [],
    apply: (state, context) => attachPersistentActionToPlayer(state, context, context.playerId),
  };
}

function createAttachToOtherPlayerEffect(): ActionEffectDefinition {
  return {
    label: "Put this card in front of another player",
    requiresTarget: true,
    canApply: (state, context) => getOtherPlayerTargets(state, context.playerId).length > 0,
    getValidTargets: (state, context) => getOtherPlayerTargets(state, context.playerId),
    apply: (state, context) => {
      if (!context.target || context.target.type !== "player" || context.target.playerId === context.playerId) {
        return invalidResult(state, "requires another player as the target");
      }

      return attachPersistentActionToPlayer(state, context, context.target.playerId);
    },
  };
}

function createReorderFirstNoblesEffect(): ActionEffectDefinition {
  return {
    label: "Rearrange the first 4 nobles in line",
    requiresTarget: true,
    canApply: (state) => state.nobleLine.cards.length > 0,
    getValidTargets: (state) =>
      state.nobleLine.cards.slice(0, Math.min(4, state.nobleLine.cards.length)).map((noble, index) => ({
        target: {
          type: "noble" as const,
          instanceId: noble.instanceId,
        },
        label: `${index + 1}. ${noble.card.name}`,
        nobleName: noble.card.name,
        fromPosition: index + 1,
      })),
    apply: reorderFirstNobles,
  };
}

function createLateArrivalEffect(): ActionEffectDefinition {
  return {
    label: "Choose one of the top 3 noble deck cards to add to the line",
    requiresTarget: true,
    canApply: (state) => state.nobleDeck.drawPile.length > 0,
    getValidTargets: (state) =>
      state.nobleDeck.drawPile.slice(0, 3).map((noble) => ({
        target: {
          type: "noble-deck-card" as const,
          instanceId: noble.instanceId,
        },
        label: `Add ${noble.card.name} to the end of the line`,
        nobleName: noble.card.name,
        revealedNoble: noble,
      })),
    apply: addChosenNobleFromDeckToLine,
  };
}

function createRatBreakEffect(): ActionEffectDefinition {
  return {
    label: "Choose an action card from the discard pile",
    requiresTarget: true,
    canApply: (state) => state.actionDeck.discardPile.length > 0,
    getValidTargets: (state) =>
      state.actionDeck.discardPile.map((action) => ({
        target: {
          type: "action-discard-card" as const,
          instanceId: action.instanceId,
        },
        label: `Take ${action.card.name}`,
        revealedAction: action,
      })),
    apply: takeActionFromDiscard,
  };
}

function createMissedEffect(): ActionEffectDefinition {
  return {
    label: "Choose a player to return their last collected noble",
    requiresTarget: true,
    canApply: (state, context) => state.players.some((player) => player.id !== context.playerId && player.collectedNobles.length > 0),
    getValidTargets: (state, context) =>
      state.players
        .filter((player) => player.id !== context.playerId && player.collectedNobles.length > 0)
        .map((player) => ({
          target: {
            type: "player" as const,
            playerId: player.id,
          },
          label: `${player.name} returns their last collected noble`,
          playerId: player.id,
          playerName: player.name,
        })),
    apply: returnLastCollectedNoble,
  };
}

function createRushJobEffect(): ActionEffectDefinition {
  return {
    label: "Choose a player to skip their next action play",
    requiresTarget: true,
    canApply: (state, context) => state.players.some((player) => player.id !== context.playerId),
    getValidTargets: (state, context) =>
      state.players
        .filter((player) => player.id !== context.playerId)
        .map((player) => ({
          target: {
            type: "player" as const,
            playerId: player.id,
          },
          label: `${player.name} cannot play an action on their next turn`,
          playerId: player.id,
          playerName: player.name,
        })),
    apply: applyRushJob,
  };
}

function createInformationExchangeEffect(): ActionEffectDefinition {
  return {
    label: "Trade hands with another player",
    requiresTarget: true,
    canApply: (state, context) => state.players.some((player) => player.id !== context.playerId),
    getValidTargets: (state, context) =>
      state.players
        .filter((player) => player.id !== context.playerId)
        .map((player) => ({
          target: {
            type: "player" as const,
            playerId: player.id,
          },
          label: `Trade hands with ${player.name}`,
          playerId: player.id,
          playerName: player.name,
        })),
    apply: tradeHands,
  };
}

function createTwistOfFateEffect(): ActionEffectDefinition {
  return {
    label: "Discard a card in front of any player",
    requiresTarget: true,
    canApply: (state) => state.players.some((player) => player.inFrontActions.length > 0),
    getValidTargets: (state) =>
      state.players.flatMap((player) =>
        player.inFrontActions.map((action) => ({
          target: {
            type: "in-front-action" as const,
            playerId: player.id,
            instanceId: action.instanceId,
          },
          label: `Discard ${action.card.name} from ${player.name}`,
          revealedAction: action,
          playerId: player.id,
          playerName: player.name,
        })),
      ),
    apply: discardInFrontAction,
  };
}

function createAfterYouEffect(): ActionEffectDefinition {
  return {
    label: "Give the front noble to another player",
    requiresTarget: true,
    canApply: (state, context) => state.nobleLine.cards.length > 0 && state.players.some((player) => player.id !== context.playerId),
    getValidTargets: (state, context) =>
      state.players
        .filter((player) => player.id !== context.playerId)
        .map((player) => ({
          target: {
            type: "player" as const,
            playerId: player.id,
          },
          label: `Give front noble to ${player.name}`,
          playerId: player.id,
          playerName: player.name,
        })),
    apply: giveFrontNobleToPlayer,
  };
}

function createClothingSwapEffect(): ActionEffectDefinition {
  return {
    label: "Discard a noble and replace it from the noble deck",
    requiresTarget: true,
    canApply: (state) => state.nobleLine.cards.length > 0,
    getValidTargets: (state) =>
      state.nobleLine.cards.map((noble, index) => ({
        target: {
          type: "noble" as const,
          instanceId: noble.instanceId,
        },
        label: `Swap ${noble.card.name} at position ${index + 1}`,
        nobleName: noble.card.name,
        fromPosition: index + 1,
      })),
    apply: swapNobleWithTopDeckNoble,
  };
}

function createConfusionInLineEffect(): ActionEffectDefinition {
  return {
    label: "Choose a player whose next collection shuffles the line first",
    requiresTarget: true,
    canApply: (state, context) => state.players.some((player) => player.id !== context.playerId),
    getValidTargets: (state, context) =>
      state.players
        .filter((player) => player.id !== context.playerId)
        .map((player) => ({
          target: {
            type: "player" as const,
            playerId: player.id,
          },
          label: `Confuse ${player.name}'s next noble collection`,
          playerId: player.id,
          playerName: player.name,
        })),
    apply: applyConfusionInLine,
  };
}

function createMissingHeadsEffect(): ActionEffectDefinition {
  return {
    label: "Choose a player to lose a random collected noble",
    requiresTarget: true,
    canApply: (state) => state.players.some((player) => player.collectedNobles.length > 0),
    getValidTargets: (state) =>
      state.players
        .filter((player) => player.collectedNobles.length > 0)
        .map((player) => ({
          target: {
            type: "player" as const,
            playerId: player.id,
          },
          label: `${player.name} loses a random collected noble`,
          playerId: player.id,
          playerName: player.name,
        })),
    apply: discardRandomCollectedNoble,
  };
}

function createInfightingEffect(): ActionEffectDefinition {
  return {
    label: "Choose a player to privately discard action cards",
    requiresTarget: true,
    canApply: (state, context) => state.players.some((player) => player.id !== context.playerId),
    getValidTargets: (state, context) =>
      state.players
        .filter((player) => player.id !== context.playerId)
        .map((player) => ({
          target: {
            type: "player" as const,
            playerId: player.id,
          },
          label: `${player.name} chooses cards to discard`,
          playerId: player.id,
          playerName: player.name,
        })),
    apply: startInfightingChoice,
  };
}

function createClericalErrorEffect(): ActionEffectDefinition {
  return {
    label: "Choose a noble from another player's score pile",
    requiresTarget: true,
    canApply: (state, context) =>
      state.players.some((player) => player.id !== context.playerId && player.collectedNobles.length > 0),
    getValidTargets: (state, context) =>
      state.players
        .filter((player) => player.id !== context.playerId)
        .flatMap((player) =>
          player.collectedNobles.map((noble) => ({
            target: {
              type: "collected-noble" as const,
              playerId: player.id,
              instanceId: noble.instanceId,
            },
            label: `Collect ${noble.card.name} from ${player.name}`,
            nobleName: noble.card.name,
            playerId: player.id,
            playerName: player.name,
            revealedNoble: noble,
          })),
        ),
    apply: startClericalErrorExchange,
  };
}

function createLackOfSupportEffect(): ActionEffectDefinition {
  return {
    label: "Choose an action card from another player's hand to discard",
    requiresTarget: true,
    canApply: (state, context) =>
      state.players.some((player) => player.id !== context.playerId && player.hand.length > 0),
    getValidTargets: (state, context) =>
      state.players
        .filter((player) => player.id !== context.playerId)
        .flatMap((player) =>
          player.hand.map((action) => ({
            target: {
              type: "action-hand-card" as const,
              playerId: player.id,
              instanceId: action.instanceId,
            },
            label: `Discard ${action.card.name} from ${player.name}`,
            revealedAction: action,
            playerId: player.id,
            playerName: player.name,
          })),
        ),
    apply: discardActionFromPlayerHand,
  };
}

function getOtherPlayerTargets(state: GameState, playerId: PlayerId): ValidActionTarget[] {
  return state.players
    .filter((player) => player.id !== playerId)
    .map((player) => ({
      target: {
        type: "player" as const,
        playerId: player.id,
      },
      label: `Put in front of ${player.name}`,
    }));
}

function getMoveTargets(
  state: GameState,
  config: {
    direction: "forward" | "backward";
    spaces: number[];
    predicate?: (noble: CardInstance<NobleCard>) => boolean;
    allowsAnotherAction?: boolean;
  },
): ValidActionTarget[] {
  return state.nobleLine.cards.flatMap((noble, index) =>
    config.spaces.flatMap((spaceCount) => {
      if (config.predicate && !config.predicate(noble)) {
        return [];
      }

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
  config: {
    direction: "forward" | "backward";
    spaces: number[];
    predicate?: (noble: CardInstance<NobleCard>) => boolean;
    allowsAnotherAction?: boolean;
  },
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

  if (!noble || (config.predicate && !config.predicate(noble))) {
    return invalidResult(state, "does not match this card's required noble color");
  }

  const cards = state.nobleLine.cards.filter((card) => card.instanceId !== target.instanceId);
  cards.splice(toIndex, 0, noble);

  return {
    state: withNobleLine(state, cards),
    applied: true,
    message: `moved ${noble.card.name} from position ${fromIndex + 1} to ${toIndex + 1}`,
    allowsAnotherAction: config.allowsAnotherAction,
  };
}

function createColorMoveEffect(config: { label: string; colorCategory: NobleColorCategory }): ActionEffectDefinition {
  return createMoveEffect({
    label: config.label,
    direction: "forward",
    spaces: [1, 2],
    predicate: (noble) => noble.card.colorCategory === config.colorCategory,
  });
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

function discardNobleTarget(state: GameState, context: ActionEffectContext): ActionEffectResult {
  const target = context.target;

  if (!target || target.type !== "noble") {
    return invalidResult(state, "requires a noble target to discard");
  }

  const targetIndex = state.nobleLine.cards.findIndex((noble) => noble.instanceId === target.instanceId);
  const noble = state.nobleLine.cards[targetIndex];

  if (targetIndex < 0 || !noble) {
    return invalidResult(state, "does not have a legal noble to discard");
  }

  return {
    state: {
      ...state,
      nobleLine: {
        cards: state.nobleLine.cards.filter((card) => card.instanceId !== target.instanceId),
      },
      nobleDeck: {
        ...state.nobleDeck,
        discardPile: [noble, ...state.nobleDeck.discardPile],
      },
    },
    applied: true,
    message: `discarded ${noble.card.name} from the line`,
  };
}

function attachPersistentActionToPlayer(
  state: GameState,
  context: ActionEffectContext,
  targetPlayerId: PlayerId,
): ActionEffectResult {
  if (!context.actionCard) {
    return invalidResult(state, "could not find the played card to put in front");
  }

  const actionCard = context.actionCard;
  const targetPlayer = state.players.find((player) => player.id === targetPlayerId);

  if (!targetPlayer) {
    return invalidResult(state, "could not find the target player");
  }

  const players = state.players.map((player) => {
    if (player.id !== targetPlayerId) {
      return player;
    }

    const updatedPlayer: Player = {
      ...player,
      inFrontActions: [...player.inFrontActions, actionCard],
    };

    return {
      ...updatedPlayer,
      score: calculatePlayerScore(updatedPlayer),
    };
  });

  return {
    state: {
      ...state,
      players,
    },
    applied: true,
    skipDiscard: true,
    message: `put ${actionCard.card.name} in front of ${targetPlayer.name}`,
  };
}

function reorderFirstNobles(state: GameState, context: ActionEffectContext): ActionEffectResult {
  const target = context.target;
  const reorderCount = Math.min(4, state.nobleLine.cards.length);
  const reorderSegment = state.nobleLine.cards.slice(0, reorderCount);

  if (!target || target.type !== "reorder-nobles" || target.instanceIds.length !== reorderCount) {
    return invalidResult(state, "requires a confirmed noble order");
  }

  const expectedIds = new Set(reorderSegment.map((noble) => noble.instanceId));
  const hasSameIds =
    target.instanceIds.length === expectedIds.size && target.instanceIds.every((instanceId) => expectedIds.has(instanceId));

  if (!hasSameIds) {
    return invalidResult(state, "can only rearrange the first nobles in line");
  }

  const reorderedSegment = target.instanceIds.map((instanceId) => reorderSegment.find((noble) => noble.instanceId === instanceId));

  if (reorderedSegment.some((noble) => !noble)) {
    return invalidResult(state, "could not apply that noble order");
  }

  return {
    state: {
      ...state,
      nobleLine: {
        cards: [...(reorderedSegment as CardInstance<NobleCard>[]), ...state.nobleLine.cards.slice(reorderCount)],
      },
    },
    applied: true,
    message: `rearranged the first ${reorderCount} noble${reorderCount === 1 ? "" : "s"} in line`,
  };
}

function addChosenNobleFromDeckToLine(state: GameState, context: ActionEffectContext): ActionEffectResult {
  const target = context.target;

  if (!target || target.type !== "noble-deck-card") {
    return invalidResult(state, "requires a revealed noble deck choice");
  }

  const topNobles = state.nobleDeck.drawPile.slice(0, 3);
  const chosenNoble = topNobles.find((noble) => noble.instanceId === target.instanceId);

  if (!chosenNoble) {
    return invalidResult(state, "can only choose from the top 3 nobles of the deck");
  }

  return {
    state: {
      ...state,
      nobleDeck: {
        ...state.nobleDeck,
        drawPile: state.nobleDeck.drawPile.filter((noble) => noble.instanceId !== target.instanceId),
      },
      nobleLine: {
        cards: [...state.nobleLine.cards, chosenNoble],
      },
    },
    applied: true,
    message: "added one revealed noble from the noble deck to the end of the line",
  };
}

function takeActionFromDiscard(state: GameState, context: ActionEffectContext): ActionEffectResult {
  const target = context.target;

  if (!target || target.type !== "action-discard-card") {
    return invalidResult(state, "requires an action card from the discard pile");
  }

  const chosenAction = state.actionDeck.discardPile.find((action) => action.instanceId === target.instanceId);

  if (!chosenAction) {
    return invalidResult(state, "could not find that action card in the discard pile");
  }

  return {
    state: {
      ...state,
      players: state.players.map((player) =>
        player.id === context.playerId
          ? {
              ...player,
              hand: [...player.hand, chosenAction],
            }
          : player,
      ),
      actionDeck: {
        ...state.actionDeck,
        discardPile: state.actionDeck.discardPile.filter((action) => action.instanceId !== target.instanceId),
      },
    },
    applied: true,
    message: `returned ${chosenAction.card.name} from the discard pile to hand`,
  };
}

function returnLastCollectedNoble(state: GameState, context: ActionEffectContext): ActionEffectResult {
  const target = context.target;

  if (!target || target.type !== "player" || target.playerId === context.playerId) {
    return invalidResult(state, "requires a player target");
  }

  const targetPlayer = state.players.find((player) => player.id === target.playerId);
  const returnedNoble = targetPlayer?.collectedNobles[targetPlayer.collectedNobles.length - 1];

  if (!targetPlayer || !returnedNoble) {
    return invalidResult(state, "that player has no collected noble to return");
  }

  return {
    state: {
      ...state,
      players: state.players.map((player) => {
        if (player.id !== target.playerId) {
          return player;
        }

        const updatedPlayer: Player = {
          ...player,
          collectedNobles: player.collectedNobles.slice(0, -1),
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
    message: `${targetPlayer.name} returned their last collected noble to the end of the line`,
  };
}

function applyRushJob(state: GameState, context: ActionEffectContext): ActionEffectResult {
  const target = context.target;

  if (!target || target.type !== "player" || target.playerId === context.playerId) {
    return invalidResult(state, "requires a player target");
  }

  const targetPlayer = state.players.find((player) => player.id === target.playerId);

  if (!targetPlayer) {
    return invalidResult(state, "could not find the target player");
  }

  return {
    state: {
      ...state,
      players: state.players.map((player) =>
        player.id === target.playerId
          ? {
              ...player,
              skipNextActionTurn: true,
            }
          : player,
      ),
    },
    applied: true,
    message: `${targetPlayer.name} cannot play an action card on their next turn`,
  };
}

function tradeHands(state: GameState, context: ActionEffectContext): ActionEffectResult {
  const target = context.target;

  if (!target || target.type !== "player" || target.playerId === context.playerId) {
    return invalidResult(state, "requires another player target");
  }

  const currentPlayer = state.players.find((player) => player.id === context.playerId);
  const targetPlayer = state.players.find((player) => player.id === target.playerId);

  if (!currentPlayer || !targetPlayer) {
    return invalidResult(state, "could not find both players");
  }

  return {
    state: {
      ...state,
      players: state.players.map((player) => {
        if (player.id === context.playerId) {
          return {
            ...player,
            hand: targetPlayer.hand,
          };
        }

        if (player.id === target.playerId) {
          return {
            ...player,
            hand: currentPlayer.hand,
          };
        }

        return player;
      }),
    },
    applied: true,
    logMessage: `${currentPlayer.name} traded hands with ${targetPlayer.name}.`,
    detailLogMessage: `${currentPlayer.name} traded hands with ${targetPlayer.name}. ${currentPlayer.name} gave: ${formatCardNames(currentPlayer.hand)}. ${targetPlayer.name} gave: ${formatCardNames(targetPlayer.hand)}.`,
    message: `traded hands with ${targetPlayer.name}`,
  };
}

function discardInFrontAction(state: GameState, context: ActionEffectContext): ActionEffectResult {
  const target = context.target;

  if (!target || target.type !== "in-front-action") {
    return invalidResult(state, "requires a card in front of a player");
  }

  const targetPlayer = state.players.find((player) => player.id === target.playerId);
  const actionToDiscard = targetPlayer?.inFrontActions.find((action) => action.instanceId === target.instanceId);

  if (!targetPlayer || !actionToDiscard) {
    return invalidResult(state, "could not find that card in front of that player");
  }

  return {
    state: {
      ...state,
      players: state.players.map((player) => {
        if (player.id !== target.playerId) {
          return player;
        }

        const updatedPlayer: Player = {
          ...player,
          inFrontActions: player.inFrontActions.filter((action) => action.instanceId !== target.instanceId),
        };

        return {
          ...updatedPlayer,
          score: calculatePlayerScore(updatedPlayer),
        };
      }),
      actionDeck: {
        ...state.actionDeck,
        discardPile: [actionToDiscard, ...state.actionDeck.discardPile],
      },
    },
    applied: true,
    message: `discarded ${actionToDiscard.card.name} from in front of ${targetPlayer.name}`,
  };
}

function giveFrontNobleToPlayer(state: GameState, context: ActionEffectContext): ActionEffectResult {
  const target = context.target;
  const frontNoble = state.nobleLine.cards[0];

  if (!target || target.type !== "player" || target.playerId === context.playerId) {
    return invalidResult(state, "requires another player target");
  }

  const targetPlayer = state.players.find((player) => player.id === target.playerId);

  if (!frontNoble || !targetPlayer) {
    return invalidResult(state, "requires a front noble and target player");
  }

  const baseState: GameState = {
    ...state,
    nobleLine: {
      cards: state.nobleLine.cards.slice(1),
    },
    players: state.players.map((player) => {
      if (player.id !== target.playerId) {
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
    }),
  };
  const triggered = applyNobleCollectionTriggers(baseState, target.playerId, frontNoble, { clownEndsTurn: frontNoble.card.name === "The Clown" });

  return {
    state: triggered.state,
    applied: true,
    message: `gave the front noble to ${targetPlayer.name}`,
    extraLogMessages: triggered.logMessages,
  };
}

function swapNobleWithTopDeckNoble(state: GameState, context: ActionEffectContext): ActionEffectResult {
  const target = context.target;

  if (!target || target.type !== "noble") {
    return invalidResult(state, "requires a noble target");
  }

  const targetIndex = state.nobleLine.cards.findIndex((noble) => noble.instanceId === target.instanceId);
  const discardedNoble = state.nobleLine.cards[targetIndex];

  if (targetIndex < 0 || !discardedNoble) {
    return invalidResult(state, "could not find that noble in line");
  }

  const [replacementNoble, ...remainingNobleDeck] = state.nobleDeck.drawPile;
  const nextLine = [...state.nobleLine.cards];

  if (replacementNoble) {
    nextLine[targetIndex] = replacementNoble;
  } else {
    nextLine.splice(targetIndex, 1);
  }

  return {
    state: {
      ...state,
      nobleDeck: {
        drawPile: remainingNobleDeck,
        discardPile: [discardedNoble, ...state.nobleDeck.discardPile],
      },
      nobleLine: {
        cards: nextLine,
      },
    },
    applied: true,
    message: replacementNoble
      ? `discarded ${discardedNoble.card.name} and replaced it in the same position`
      : `discarded ${discardedNoble.card.name} with no replacement because the noble deck was empty`,
  };
}

function applyConfusionInLine(state: GameState, context: ActionEffectContext): ActionEffectResult {
  const target = context.target;

  if (!target || target.type !== "player" || target.playerId === context.playerId) {
    return invalidResult(state, "requires a player target");
  }

  const targetPlayer = state.players.find((player) => player.id === target.playerId);

  if (!targetPlayer) {
    return invalidResult(state, "could not find the target player");
  }

  return {
    state: {
      ...state,
      players: state.players.map((player) =>
        player.id === target.playerId
          ? {
              ...player,
              shuffleLineBeforeNextCollection: true,
            }
          : player,
      ),
    },
    applied: true,
    message: `set Confusion in Line for ${targetPlayer.name}'s next noble collection`,
  };
}

function discardRandomCollectedNoble(state: GameState, context: ActionEffectContext): ActionEffectResult {
  const target = context.target;

  if (!target || target.type !== "player" || target.playerId === context.playerId) {
    return invalidResult(state, "requires a player target");
  }

  const targetPlayer = state.players.find((player) => player.id === target.playerId);

  if (!targetPlayer || targetPlayer.collectedNobles.length === 0) {
    return invalidResult(state, "that player has no collected noble to lose");
  }

  const discardIndex = Math.floor(Math.random() * targetPlayer.collectedNobles.length);
  const discardedNoble = targetPlayer.collectedNobles[discardIndex];

  if (!discardedNoble) {
    return invalidResult(state, "could not choose a collected noble");
  }

  return {
    state: {
      ...state,
      players: state.players.map((player) => {
        if (player.id !== target.playerId) {
          return player;
        }

        const updatedPlayer: Player = {
          ...player,
          collectedNobles: player.collectedNobles.filter((_, index) => index !== discardIndex),
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
    message: `${targetPlayer.name} lost a random collected noble`,
  };
}

function startInfightingChoice(state: GameState, context: ActionEffectContext): ActionEffectResult {
  const target = context.target;

  if (!target || target.type !== "player") {
    return invalidResult(state, "requires a player target");
  }

  const targetPlayer = state.players.find((player) => player.id === target.playerId);

  if (!targetPlayer) {
    return invalidResult(state, "could not find the target player");
  }

  return {
    state: {
      ...state,
      pendingChoice: {
        type: "infighting",
        originalPlayerId: context.playerId,
        targetPlayerId: target.playerId,
      },
      passScreen: {
        visible: true,
      },
    },
    applied: true,
    message: `started Infighting for ${targetPlayer.name}`,
  };
}

function startClericalErrorExchange(state: GameState, context: ActionEffectContext): ActionEffectResult {
  const target = context.target;

  if (!target || target.type !== "collected-noble" || target.playerId === context.playerId) {
    return invalidResult(state, "requires a noble from another player's score pile");
  }

  const originalPlayer = state.players.find((player) => player.id === context.playerId);
  const targetPlayer = state.players.find((player) => player.id === target.playerId);
  const chosenNoble = targetPlayer?.collectedNobles.find((noble) => noble.instanceId === target.instanceId);

  if (!originalPlayer || !targetPlayer || !chosenNoble) {
    return invalidResult(state, "could not find the selected noble");
  }

  const transferredState = transferCollectedNoble(state, target.playerId, context.playerId, target.instanceId);
  const triggered = applyNobleCollectionTriggers(transferredState, context.playerId, chosenNoble, { triggerClown: false });
  const originalPlayerAfterTransfer = triggered.state.players.find((player) => player.id === context.playerId);
  const returnChoices =
    originalPlayerAfterTransfer?.collectedNobles.filter((noble) => noble.instanceId !== chosenNoble.instanceId) ?? [];

  if (returnChoices.length === 0) {
    return {
      state: {
        ...triggered.state,
        pendingChoice: undefined,
        passScreen: {
          visible: false,
        },
        notice: `${targetPlayer.name} has no eligible noble to collect for Clerical Error.`,
      },
      applied: true,
      message: `collected a noble from ${targetPlayer.name} with Clerical Error`,
      extraLogMessages: triggered.logMessages,
    };
  }

  return {
    state: {
      ...triggered.state,
      pendingChoice: {
        type: "clericalErrorReturn",
        originalPlayerId: context.playerId,
        targetPlayerId: target.playerId,
        excludedNobleInstanceId: chosenNoble.instanceId,
      },
      passScreen: {
        visible: true,
      },
    },
    applied: true,
    message: `started a Clerical Error exchange with ${targetPlayer.name}`,
    extraLogMessages: triggered.logMessages,
  };
}

function discardActionFromPlayerHand(state: GameState, context: ActionEffectContext): ActionEffectResult {
  const target = context.target;

  if (!target || target.type !== "action-hand-card" || target.playerId === context.playerId) {
    return invalidResult(state, "requires an action card from another player's hand");
  }

  const targetPlayer = state.players.find((player) => player.id === target.playerId);
  const chosenAction = targetPlayer?.hand.find((action) => action.instanceId === target.instanceId);

  if (!targetPlayer || !chosenAction) {
    return invalidResult(state, "could not find the selected action card");
  }

  const currentPlayerName = getPlayerName(state, context.playerId);

  return {
    state: {
      ...state,
      players: state.players.map((player) =>
        player.id === target.playerId
          ? {
              ...player,
              hand: player.hand.filter((action) => action.instanceId !== target.instanceId),
            }
          : player,
      ),
      actionDeck: {
        ...state.actionDeck,
        discardPile: [chosenAction, ...state.actionDeck.discardPile],
      },
    },
    applied: true,
    logMessage: `${currentPlayerName} used Lack of Support on ${targetPlayer.name} and discarded ${chosenAction.card.name}.`,
    detailLogMessage: `${currentPlayerName} used Lack of Support on ${targetPlayer.name} and discarded ${chosenAction.card.name} from their hand.`,
    message: `used Lack of Support on ${targetPlayer.name} and discarded ${chosenAction.card.name}`,
  };
}

function transferCollectedNoble(state: GameState, fromPlayerId: PlayerId, toPlayerId: PlayerId, nobleId: string): GameState {
  const fromPlayer = state.players.find((player) => player.id === fromPlayerId);
  const movedNoble = fromPlayer?.collectedNobles.find((noble) => noble.instanceId === nobleId);

  if (!fromPlayer || !movedNoble) {
    return state;
  }

  const players = state.players.map((player) => {
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
  });

  return {
    ...state,
    players,
  };
}

function forceOtherPlayersToDiscard(state: GameState, context: ActionEffectContext): ActionEffectResult {
  const discardedCards: GameState["actionDeck"]["discardPile"] = [];
  const discardedDetails: string[] = [];

  const players = state.players.map((player) => {
    if (player.id === context.playerId || player.hand.length === 0) {
      return player;
    }

    const discardIndex = Math.floor(Math.random() * player.hand.length);
    const discardedCard = player.hand[discardIndex];

    if (!discardedCard) {
      return player;
    }

    discardedCards.push(discardedCard);
    discardedDetails.push(`${player.name} discarded ${discardedCard.card.name}`);

    return {
      ...player,
      hand: player.hand.filter((_, index) => index !== discardIndex),
    };
  });

  return {
    state: {
      ...state,
      players,
      actionDeck: {
        ...state.actionDeck,
        discardPile: [...discardedCards, ...state.actionDeck.discardPile],
      },
    },
    applied: true,
    message:
      discardedDetails.length > 0
        ? `made other players discard random action cards: ${discardedDetails.join("; ")}`
        : "made no players discard because no other player had action cards",
  };
}

function shuffleHandsAndRedeal(state: GameState): ActionEffectResult {
  const originalHandDetails = state.players.map((player) => `${player.name} had ${formatCardNames(player.hand)}`);
  const cardsFromHands = state.players.flatMap((player) => player.hand);
  let actionPool = shuffleDeck([...state.actionDeck.drawPile, ...cardsFromHands]);
  const redealtHandDetails: string[] = [];

  const players = state.players.map((player) => {
    const newHand = actionPool.slice(0, STARTING_HAND_SIZE);
    actionPool = actionPool.slice(newHand.length);
    redealtHandDetails.push(`${player.name} received ${formatCardNames(newHand)}`);

    return {
      ...player,
      hand: newHand,
    };
  });

  return {
    state: {
      ...state,
      players,
      actionDeck: {
        ...state.actionDeck,
        drawPile: actionPool,
      },
    },
    applied: true,
    message: `shuffled all hands into the action deck and dealt new hands of up to ${STARTING_HAND_SIZE} cards`,
    detailLogMessage: `Rain Delay details: ${originalHandDetails.join("; ")}. ${redealtHandDetails.join("; ")}.`,
  };
}

function replaceLineFromShuffledNobleDeck(state: GameState): ActionEffectResult {
  const lineSize = state.nobleLine.cards.length;

  if (lineSize === 0) {
    return invalidResult(state, "there were no nobles in line to reshuffle");
  }

  const shuffledNobles = shuffleDeck([...state.nobleDeck.drawPile, ...state.nobleLine.cards]);
  const newLine = shuffledNobles.slice(0, lineSize);
  const remainingNobles = shuffledNobles.slice(newLine.length);

  return {
    state: {
      ...state,
      nobleDeck: {
        ...state.nobleDeck,
        drawPile: remainingNobles,
      },
      nobleLine: {
        cards: newLine,
      },
    },
    applied: true,
    message: `shuffled ${lineSize} noble${lineSize === 1 ? "" : "s"} from the line back into the noble deck and dealt a new line`,
  };
}

function discardRandomNoblesAndShuffleLine(state: GameState): ActionEffectResult {
  const discardCount = Math.min(2, state.nobleLine.cards.length);

  if (discardCount === 0) {
    return invalidResult(state, "there were no nobles in line to discard");
  }

  const shuffledLine = shuffleDeck(state.nobleLine.cards);
  const discardedNobles = shuffledLine.slice(0, discardCount);
  const remainingLine = shuffleDeck(shuffledLine.slice(discardCount));

  return {
    state: {
      ...state,
      nobleDeck: {
        ...state.nobleDeck,
        discardPile: [...discardedNobles, ...state.nobleDeck.discardPile],
      },
      nobleLine: {
        cards: remainingLine,
      },
    },
    applied: true,
    message: `discarded ${discardCount} random noble${discardCount === 1 ? "" : "s"} and randomly rearranged the remaining line`,
  };
}

function shuffleFirstFiveNobles(state: GameState): ActionEffectResult {
  const shuffleCount = Math.min(5, state.nobleLine.cards.length);

  if (shuffleCount <= 1) {
    return invalidResult(state, "there were not enough nobles in line to rearrange");
  }

  return {
    state: {
      ...state,
      nobleLine: {
        cards: [
          ...shuffleDeck(state.nobleLine.cards.slice(0, shuffleCount)),
          ...state.nobleLine.cards.slice(shuffleCount),
        ],
      },
    },
    applied: true,
    message: `randomly rearranged the first ${shuffleCount} noble${shuffleCount === 1 ? "" : "s"} in line`,
  };
}

function moveNearestBlueNobleToFront(state: GameState): ActionEffectResult {
  const fromIndex = state.nobleLine.cards.findIndex((noble) => noble.card.colorCategory === "blue");
  const noble = state.nobleLine.cards[fromIndex];

  if (fromIndex < 0 || !noble) {
    return invalidResult(state, "there are no Blue nobles in line");
  }

  if (fromIndex === 0) {
    return {
      state,
      applied: true,
      message: `${noble.card.name} was already the Blue noble nearest the front`,
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
    detailLogMessage: `${getPlayerName(state, playerId)} drew ${formatCardNames(cardsToDraw)}.`,
  };
}

function takeExtraFrontNoble(state: GameState, context: ActionEffectContext): ActionEffectResult {
  const confused = applyBeforeNobleCollectionTriggers(state, context.playerId);
  const frontNoble = confused.state.nobleLine.cards[0];

  if (!frontNoble) {
    return invalidResult(state, "had no noble available to take");
  }

  const updatedLine = confused.state.nobleLine.cards.slice(1);

  const collectedState = applyNobleCollectionTriggers(
    {
      ...confused.state,
      players: confused.state.players.map((player) => {
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
      }),
      nobleLine: {
        cards: updatedLine,
      },
    },
    context.playerId,
    frontNoble,
  );

  return {
    state: collectedState.state,
    applied: true,
    message: `took ${frontNoble.card.name} immediately as an extra noble`,
    extraLogMessages: [...confused.logMessages, ...collectedState.logMessages],
  };
}

export function applyBeforeNobleCollectionTriggers(
  state: GameState,
  playerId: PlayerId,
): { state: GameState; logMessages: string[] } {
  const player = state.players.find((candidate) => candidate.id === playerId);

  if (!player?.shuffleLineBeforeNextCollection) {
    return { state, logMessages: [] };
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
        cards: shuffleDeck(state.nobleLine.cards),
      },
    },
    logMessages: [`Confusion in Line triggered for ${player.name}.`],
  };
}

export function applyNobleCollectionTriggers(
  state: GameState,
  playerId: PlayerId,
  noble: CardInstance<NobleCard>,
  options: { triggerClown?: boolean; clownEndsTurn?: boolean } = {},
): { state: GameState; logMessages: string[] } {
  let nextState = state;
  const logMessages: string[] = [];
  const playerName = getPlayerName(nextState, playerId);
  const shouldTriggerClown = options.triggerClown ?? true;

  if (noble.card.name === "Robespierre") {
    nextState = {
      ...nextState,
      turnEffects: {
        ...nextState.turnEffects,
        endDayAfterTurn: true,
      },
    };
    logMessages.push("Robespierre triggered: this day will end after the turn finishes.");
  }

  if (noble.card.name === "The Clown" && shouldTriggerClown) {
    const currentPlayerIsReceiver = nextState.players[nextState.currentPlayerIndex]?.id === playerId;
    nextState = {
      ...nextState,
      pendingChoice: {
        type: "clownGift",
        originalPlayerId: playerId,
        targetPlayerId: playerId,
        clownInstanceId: noble.instanceId,
        returnToPassScreen: !currentPlayerIsReceiver || Boolean(options.clownEndsTurn),
        advanceTurnAfterChoice: Boolean(options.clownEndsTurn),
      },
      passScreen: {
        visible: false,
      },
    };
    logMessages.push(`The Clown triggered: ${playerName} must give The Clown to another player.`);
  }

  if (noble.card.name === "Fast Noble") {
    const collected = collectFrontNobleForTrigger(nextState, playerId);
    nextState = collected.state;
    logMessages.push(...collected.logMessages);
  }

  if (noble.card.name === "General" || noble.card.name === "Captain of the Guard") {
    const added = addTopNobleToLine(nextState);
    nextState = added.state;
    if (added.addedName) {
      logMessages.push(`${noble.card.name} triggered: ${added.addedName} was added to the end of the line.`);
    }
  }

  if (noble.card.name === "Innocent Victim") {
    const player = nextState.players.find((candidate) => candidate.id === playerId);
    if (player && player.hand.length > 0) {
      nextState = {
        ...nextState,
        pendingChoice: {
          type: "innocentVictimDiscard",
          originalPlayerId: playerId,
          targetPlayerId: playerId,
          returnToPassScreen: nextState.players[nextState.currentPlayerIndex]?.id !== playerId,
        },
        passScreen: {
          visible: false,
        },
      };
      logMessages.push(`Innocent Victim triggered: ${playerName} must discard 1 action card.`);
    }
  }

  if (noble.card.name === "Lady" || noble.card.name === "Lord") {
    const drawn = drawActionCardsForTrigger(nextState, playerId, 1);
    nextState = drawn.state;
    logMessages.push(...drawn.logMessages.map((message) => `${noble.card.name} triggered: ${message}`));
  }

  if (noble.card.name === "Lady in Waiting") {
    const drawn = drawActionCardsForTrigger(nextState, playerId, 1);
    nextState = drawn.state;
    logMessages.push(...drawn.logMessages.map((message) => `Lady in Waiting triggered: ${message}`));
  }

  if (noble.card.name === "Rival Executioner") {
    const collected = collectTopDeckNobleForTrigger(nextState, playerId);
    nextState = collected.state;
    logMessages.push(...collected.logMessages);
  }

  if (noble.card.colorCategory !== "purple") {
    return { state: nextState, logMessages };
  }

  const player = nextState.players.find((candidate) => candidate.id === playerId);

  if (!player || !player.inFrontActions.some((action) => action.card.effectKey === "foreignSupport")) {
    return { state: nextState, logMessages };
  }

  const [drawnAction, ...remainingActionDeck] = nextState.actionDeck.drawPile;

  if (!drawnAction) {
    return { state: nextState, logMessages };
  }

  return {
    state: {
      ...nextState,
      players: nextState.players.map((candidate) =>
        candidate.id === playerId
          ? {
              ...candidate,
              hand: [...candidate.hand, drawnAction],
            }
          : candidate,
      ),
      actionDeck: {
        ...nextState.actionDeck,
        drawPile: remainingActionDeck,
      },
    },
    logMessages: [...logMessages, `Foreign Support triggered: ${player.name} drew 1 action card for collecting a Purple noble.`],
  };
}

function collectFrontNobleForTrigger(state: GameState, playerId: PlayerId): { state: GameState; logMessages: string[] } {
  const frontNoble = state.nobleLine.cards[0];

  if (!frontNoble) {
    return { state, logMessages: [] };
  }

  const collectedState = addCollectedNobleToPlayer(
    {
      ...state,
      nobleLine: {
        cards: state.nobleLine.cards.slice(1),
      },
    },
    playerId,
    frontNoble,
  );
  const triggered = applyNobleCollectionTriggers(collectedState, playerId, frontNoble);

  return {
    state: triggered.state,
    logMessages: [
      `Fast Noble triggered: ${getPlayerName(state, playerId)} collected ${frontNoble.card.name} from the front of the line.`,
      ...triggered.logMessages,
    ],
  };
}

function collectTopDeckNobleForTrigger(state: GameState, playerId: PlayerId): { state: GameState; logMessages: string[] } {
  const [topNoble, ...remainingNobleDeck] = state.nobleDeck.drawPile;

  if (!topNoble) {
    return { state, logMessages: [] };
  }

  const collectedState = addCollectedNobleToPlayer(
    {
      ...state,
      nobleDeck: {
        ...state.nobleDeck,
        drawPile: remainingNobleDeck,
      },
    },
    playerId,
    topNoble,
  );
  const triggered = applyNobleCollectionTriggers(collectedState, playerId, topNoble);

  return {
    state: triggered.state,
    logMessages: [
      `Rival Executioner triggered: ${getPlayerName(state, playerId)} collected ${topNoble.card.name} from the noble deck.`,
      ...triggered.logMessages,
    ],
  };
}

function addTopNobleToLine(state: GameState): { state: GameState; addedName?: string } {
  const [topNoble, ...remainingNobleDeck] = state.nobleDeck.drawPile;

  if (!topNoble) {
    return { state };
  }

  return {
    state: {
      ...state,
      nobleDeck: {
        ...state.nobleDeck,
        drawPile: remainingNobleDeck,
      },
      nobleLine: {
        cards: [...state.nobleLine.cards, topNoble],
      },
    },
    addedName: topNoble.card.name,
  };
}

function drawActionCardsForTrigger(state: GameState, playerId: PlayerId, count: number): { state: GameState; logMessages: string[] } {
  const cardsToDraw = state.actionDeck.drawPile.slice(0, count);

  if (cardsToDraw.length === 0) {
    return { state, logMessages: [] };
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
    logMessages: [`${getPlayerName(state, playerId)} drew ${cardsToDraw.length} action card${cardsToDraw.length === 1 ? "" : "s"}.`],
  };
}

function addCollectedNobleToPlayer(state: GameState, playerId: PlayerId, noble: CardInstance<NobleCard>): GameState {
  return {
    ...state,
    players: state.players.map((player) => {
      if (player.id !== playerId) {
        return player;
      }

      const updatedPlayer: Player = {
        ...player,
        collectedNobles: [...player.collectedNobles, noble],
      };

      return {
        ...updatedPlayer,
        score: calculatePlayerScore(updatedPlayer),
      };
    }),
  };
}

function getPlayerName(state: GameState, playerId: PlayerId): string {
  return state.players.find((player) => player.id === playerId)?.name ?? "Player";
}

function formatCardNames(cards: CardInstance<ActionCard>[]): string {
  if (cards.length === 0) {
    return "no cards";
  }

  return cards.map((card) => card.card.name).join(", ");
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
