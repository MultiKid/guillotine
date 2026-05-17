import type { ActionCard } from "@/lib/game/types";

export const placeholderActions: ActionCard[] = [
  {
    id: "move-front-noble-back-one",
    kind: "action",
    name: "MoveFrontNobleBackOne",
    effectKey: "moveFrontNobleBackOne",
    description: "Move the first noble in line back by one position.",
  },
  {
    id: "move-back-noble-forward-one",
    kind: "action",
    name: "MoveBackNobleForwardOne",
    effectKey: "moveBackNobleForwardOne",
    description: "Move the last noble in line forward by one position.",
  },
  {
    id: "swap-first-two-nobles",
    kind: "action",
    name: "SwapFirstTwoNobles",
    effectKey: "swapFirstTwoNobles",
    description: "Swap the first two nobles in line.",
  },
  {
    id: "draw-one-action-card",
    kind: "action",
    name: "DrawOneActionCard",
    effectKey: "drawOneActionCard",
    description: "Immediately draw one additional action card.",
  },
];
