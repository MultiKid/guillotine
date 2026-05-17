import type { ActionEffectKey, GameState } from "@/lib/game/types";

export type ActionEffect = (state: GameState) => GameState;

export const actionEffects: Record<ActionEffectKey, ActionEffect> = {
  none: (state) => state,
  moveNoble: (state) => state,
  swapNobles: (state) => state,
  drawCards: (state) => state,
  extraTurn: (state) => state,
  scoreModifier: (state) => state,
};

// Future card-specific effects will be wired here after the real card list and effect text are supplied.
