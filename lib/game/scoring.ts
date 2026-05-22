import type { CardInstance, NobleCard, NobleColorCategory, Player } from "@/lib/game/types";

export function calculatePlayerScore(player: Player): number {
  const hasIndifferentPublic = player.inFrontActions.some((action) => action.card.effectKey === "indifferentPublic");
  const nobleScore = player.collectedNobles.reduce((total, noble) => total + calculateNobleScoreValue(player, noble, hasIndifferentPublic), 0);

  return nobleScore + calculatePersistentActionScore(player);
}

export function calculateNobleScoreValue(
  player: Player,
  noble: CardInstance<NobleCard>,
  hasIndifferentPublic = player.inFrontActions.some((action) => action.card.effectKey === "indifferentPublic"),
): number {
  if (hasIndifferentPublic && noble.card.colorCategory === "gray") {
    return 1;
  }

  if (noble.card.name === "Palace Guard") {
    return player.collectedNobles.filter((collectedNoble) => collectedNoble.card.name === "Palace Guard").length;
  }

  if (noble.card.name === "Tragic Figure") {
    return -player.collectedNobles.filter((collectedNoble) => collectedNoble.card.colorCategory === "gray").length;
  }

  const hasCount = player.collectedNobles.some((collectedNoble) => collectedNoble.card.name === "Count");
  const hasCountess = player.collectedNobles.some((collectedNoble) => collectedNoble.card.name === "Countess");
  const pairBonus =
    (noble.card.name === "Count" && hasCountess) || (noble.card.name === "Countess" && hasCount) ? 2 : 0;

  return noble.card.points + pairBonus;
}

export function getNoblePointText(noble: CardInstance<NobleCard>, player?: Player): string {
  if (player) {
    return String(calculateNobleScoreValue(player, noble));
  }

  if (noble.card.name === "Palace Guard" || noble.card.name === "Tragic Figure") {
    return "*";
  }

  return String(noble.card.points);
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
