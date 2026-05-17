import type { Player } from "@/lib/game/types";

export function calculatePlayerScore(player: Player): number {
  return player.collectedNobles.reduce((total, noble) => total + noble.card.points, 0);
}
