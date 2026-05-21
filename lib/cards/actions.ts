import type { CardDefinition } from "@/lib/cards/definitions";
import type { ActionCard, ActionEffectKey } from "@/lib/game/types";

const duplicateActionNames = new Set([
  "Double Feature",
  "Extra Cart",
  "Friend of the Queen",
  "Ignoble Noble",
  "L'Idiot",
  "Milling in Line",
  "Political Influence",
  "Pushed",
  "Stumble",
  "Trip",
]);

const implementedActions: Record<string, { effectKey: ActionEffectKey; description: string }> = {
  "Friend of the Queen": {
    effectKey: "friendOfTheQueen",
    description: "Move a chosen noble backward up to 2 spaces in line.",
  },
  Pushed: {
    effectKey: "pushed",
    description: "Move a chosen noble forward exactly 2 spaces in line.",
  },
  Stumble: {
    effectKey: "stumble",
    description: "Move a chosen noble forward exactly 1 space in line.",
  },
  "Ignoble Noble": {
    effectKey: "ignobleNoble",
    description: "Move a chosen noble forward exactly 4 spaces in line.",
  },
  "Extra Cart": {
    effectKey: "extraCart",
    description: "Add 3 nobles from the noble deck to the end of the line.",
  },
  "Political Influence": {
    effectKey: "politicalInfluence",
    description: "Draw 3 extra action cards without taking a noble this turn.",
  },
  "Double Feature": {
    effectKey: "doubleFeature",
    description: "Take an extra noble immediately from the front of the line.",
  },
  "L'Idiot": {
    effectKey: "lIdiot",
    description: "Move a chosen noble forward 1 or 2 spaces in line.",
  },
  "Let Them Eat Cake": {
    effectKey: "letThemEatCake",
    description: "If Marie Antoinette is in line, move her to the front of the line.",
  },
  "'Tis a Far Better Thing": {
    effectKey: "tisFarBetterThing",
    description: "Move a noble forward exactly 3 places in line.",
  },
  "Was That My Name?": {
    effectKey: "wasThatMyName",
    description: "Move a noble forward up to 3 places in line.",
  },
  "Forward March": {
    effectKey: "forwardMarch",
    description: "Move a Palace Guard to the front of the line.",
  },
  "Scarlet Pimpernel": {
    effectKey: "scarletPimpernel",
    description: "This day ends after you finish your turn. Discard any nobles remaining in line.",
  },
  "Bribed Guards": {
    effectKey: "bribedGuards",
    description: "Move the noble at the front of the line to the end of the line.",
  },
  "Public Demand": {
    effectKey: "publicDemand",
    description: "Move any noble in line to the front of the line.",
  },
  "The Long Walk": {
    effectKey: "theLongWalk",
    description: "Reverse the order of the line.",
  },
  "Lack of Faith": {
    effectKey: "lackOfFaith",
    description: "If there are any Blue nobles in line, move the one nearest the front to the front of the line.",
  },
  "Military Might": {
    effectKey: "militaryMight",
    description: "Move a Red noble forward up to 2 places in line.",
  },
  Majesty: {
    effectKey: "majesty",
    description: "Move a Purple noble forward up to 2 places in line.",
  },
  "Civic Pride": {
    effectKey: "civicPride",
    description: "Move a Green noble forward up to 2 places in line.",
  },
};

const actionNames = [
  "'Tis a Far Better Thing",
  "After You...",
  "Bribed Guards",
  "Callous Guards",
  "Church Support",
  "Civic Pride",
  "Civic Support",
  "Clerical Error",
  "Clothing Swap",
  "Confusion in Line",
  "Double Feature",
  "Escape!",
  "Extra Cart",
  "Fainting Spell",
  "Fled to England",
  "Forced Break",
  "Foreign Support",
  "Forward March",
  "Fountain of Blood",
  "Friend of the Queen",
  "Ignoble Noble",
  "Indifferent Public",
  "Infighting",
  "Information Exchange",
  "L'Idiot",
  "Lack of Faith",
  "Lack of Support",
  "Late Arrival",
  "Let Them Eat Cake",
  "Majesty",
  "Mass Confusion",
  "Military Might",
  "Military Support",
  "Milling in Line",
  "Missed!",
  "Missing Heads",
  "Opinionated Guards",
  "Political Influence",
  "Public Demand",
  "Pushed",
  "Rain Delay",
  "Rat Break",
  "Rush Job",
  "Scarlet Pimpernel",
  "Stumble",
  "The Long Walk",
  "Tough Crowd",
  "Trip",
  "Twist of Fate",
  "Was That My Name?",
];

export const actionDefinitions: CardDefinition<ActionCard>[] = actionNames.map((name) => {
  const implemented = implementedActions[name];

  return {
    id: toCardId(name),
    kind: "action",
    name,
    effectKey: implemented?.effectKey ?? "notImplemented",
    quantity: duplicateActionNames.has(name) ? 2 : 1,
    description: implemented?.description ?? "Real Guillotine action card. Effect implementation is deferred.",
  };
});

export const ACTION_DECK_SIZE = 60;

function toCardId(name: string): string {
  return name
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}


