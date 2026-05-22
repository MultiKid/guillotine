import type { NobleColorCategory, Player } from "@/lib/game/types";

export function calculatePlayerScore(player: Player): number {
  const hasIndifferentPublic = player.inFrontActions.some((action) => action.card.effectKey === "indifferentPublic");
  const nobleScore = player.collectedNobles.reduce((total, noble) => {
    if (hasIndifferentPublic && noble.card.colorCategory === "gray") {
      return total + 1;
    }

    return total + noble.card.points;
  }, 0);

  return nobleScore + calculatePersistentActionScore(player);
}

function calculatePersistentActionScore(player: Player): number {
  return player.inFrontActions.reduce((total, action) => {
    switch (action.card.effectKey) {
      case "toughCrowd":
        return total - 2;
      case "militarySupport":
        return total + countNoblesByColor(player, "red");
      case "churchSupport":
        return total + countNoblesByColor(player, "blue");
      case "civicSupport":
        return total + countNoblesByColor(player, "green");
      case "fountainOfBlood":
        return total + 2;
      default:
        return total;
    }
  }, 0);
}

function countNoblesByColor(player: Player, colorCategory: NobleColorCategory): number {
  return player.collectedNobles.filter((noble) => noble.card.colorCategory === colorCategory).length;
}
