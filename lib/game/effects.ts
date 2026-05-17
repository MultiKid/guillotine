import type { ActionEffectKey, CardInstance, GameState, NobleCard, PlayerId } from "@/lib/game/types";

type ActionEffectContext = {
  playerId: PlayerId;
};

type ActionEffectResult = {
  state: GameState;
  applied: boolean;
  message: string;
};

type ActionEffectDefinition = {
  label: string;
  canApply: (state: GameState, context: ActionEffectContext) => boolean;
  apply: (state: GameState, context: ActionEffectContext) => ActionEffectResult;
};

export const actionEffects: Record<ActionEffectKey, ActionEffectDefinition> = {
  moveFrontNobleBackOne: {
    label: "Move the first noble back one position",
    canApply: (state) => state.nobleLine.cards.length >= 2,
    apply: (state) => {
      if (state.nobleLine.cards.length < 2) {
        return invalidResult(state, "There are not enough nobles to move the front noble back.");
      }

      const cards = [...state.nobleLine.cards];
      [cards[0], cards[1]] = [cards[1], cards[0]];

      return {
        state: withNobleLine(state, cards),
        applied: true,
        message: "moved the front noble back one position",
      };
    },
  },
  moveBackNobleForwardOne: {
    label: "Move the last noble forward one position",
    canApply: (state) => state.nobleLine.cards.length >= 2,
    apply: (state) => {
      if (state.nobleLine.cards.length < 2) {
        return invalidResult(state, "There are not enough nobles to move the back noble forward.");
      }

      const cards = [...state.nobleLine.cards];
      const lastIndex = cards.length - 1;
      [cards[lastIndex - 1], cards[lastIndex]] = [cards[lastIndex], cards[lastIndex - 1]];

      return {
        state: withNobleLine(state, cards),
        applied: true,
        message: "moved the back noble forward one position",
      };
    },
  },
  swapFirstTwoNobles: {
    label: "Swap the first two nobles",
    canApply: (state) => state.nobleLine.cards.length >= 2,
    apply: (state) => {
      if (state.nobleLine.cards.length < 2) {
        return invalidResult(state, "There are not enough nobles to swap.");
      }

      const cards = [...state.nobleLine.cards];
      [cards[0], cards[1]] = [cards[1], cards[0]];

      return {
        state: withNobleLine(state, cards),
        applied: true,
        message: "swapped the first two nobles",
      };
    },
  },
  drawOneActionCard: {
    label: "Draw one action card",
    canApply: (state) => state.actionDeck.drawPile.length > 0,
    apply: (state, context) => {
      const [drawnCard, ...remainingDrawPile] = state.actionDeck.drawPile;

      if (!drawnCard) {
        return invalidResult(state, "There are no action cards left to draw.");
      }

      return {
        state: {
          ...state,
          players: state.players.map((player) =>
            player.id === context.playerId
              ? {
                  ...player,
                  hand: [...player.hand, drawnCard],
                }
              : player,
          ),
          actionDeck: {
            ...state.actionDeck,
            drawPile: remainingDrawPile,
          },
        },
        applied: true,
        message: "drew one action card",
      };
    },
  },
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
