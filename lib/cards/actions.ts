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
  Trip: {
    effectKey: "trip",
    description: "Move a noble backward exactly 1 place in line. You may play another action card this turn.",
  },
  "Fainting Spell": {
    effectKey: "faintingSpell",
    description: "Move a noble backward up to 3 places in line.",
  },
  "Fled to England": {
    effectKey: "fledToEngland",
    description: "Discard any noble in line.",
  },
  "Forced Break": {
    effectKey: "forcedBreak",
    description: "All other players must discard an action card at random.",
  },
  "Rain Delay": {
    effectKey: "rainDelay",
    description: "Shuffle all players' hands into the action deck and deal out 5 new action cards to each player.",
  },
  "Mass Confusion": {
    effectKey: "massConfusion",
    description: "Put all nobles in line in the noble deck. Shuffle the noble deck and deal out the same number of nobles in a new line.",
  },
  "Escape!": {
    effectKey: "escape",
    description: "Randomly choose 2 nobles in line and discard them. Randomly rearrange the remaining nobles in line.",
  },
  "Milling in Line": {
    effectKey: "millingInLine",
    description: "Randomly rearrange the first 5 nobles in line.",
  },
  "Tough Crowd": {
    effectKey: "toughCrowd",
    description: "Put this card in front of another player. It is worth -2 points to that player.",
  },
  "Military Support": {
    effectKey: "militarySupport",
    description: "Put this card in front of you. It is worth +1 point for each Red noble in your score pile.",
  },
  "Church Support": {
    effectKey: "churchSupport",
    description: "Put this card in front of you. It is worth +1 point for each Blue noble in your score pile.",
  },
  "Civic Support": {
    effectKey: "civicSupport",
    description: "Put this card in front of you. It is worth +1 point for each Green noble in your score pile.",
  },
  "Fountain of Blood": {
    effectKey: "fountainOfBlood",
    description: "Put this card in front of you. It is worth 2 points.",
  },
  "Indifferent Public": {
    effectKey: "indifferentPublic",
    description: "Put this card in front of you. Any Gray nobles in your score pile are worth 1 point instead of their normal values.",
  },
  "Foreign Support": {
    effectKey: "foreignSupport",
    description: "Put this card in front of you. Draw an action card whenever you collect a Purple noble.",
  },
  "Opinionated Guards": {
    effectKey: "opinionatedGuards",
    description: "Rearrange the first 4 nobles in line any way you wish.",
  },
  "Late Arrival": {
    effectKey: "lateArrival",
    description: "Look at the top 3 cards of the noble deck and add any one of them to the end of the line.",
  },
  "Rat Break": {
    effectKey: "ratBreak",
    description: "Put an action card of your choice from the discard pile into your hand.",
  },
  "Missed!": {
    effectKey: "missed",
    description: "Choose a player. That player must place the last noble he or she collected at the end of the line.",
  },
  "Rush Job": {
    effectKey: "rushJob",
    description: "Choose a player. That player cannot play an action card on his or her next turn.",
  },
  "Information Exchange": {
    effectKey: "informationExchange",
    description: "Trade hands with another player.",
  },
  "Twist of Fate": {
    effectKey: "twistOfFate",
    description: "Put any action card in front of any player into the discard pile.",
  },
  "After You...": {
    effectKey: "afterYou",
    description: "Put the noble at the front of the line into another player's score pile.",
  },
  "Clothing Swap": {
    effectKey: "clothingSwap",
    description: "Choose any noble in line and discard it. Replace it with the top noble from the noble deck.",
  },
  "Confusion in Line": {
    effectKey: "confusionInLine",
    description: "Choose a player. Randomly rearrange the line just before that player collects his or her next noble.",
  },
  "Missing Heads": {
    effectKey: "missingHeads",
    description: "Choose a player. That player loses a random noble from his or her score pile.",
  },
  "Callous Guards": {
    effectKey: "callousGuards",
    description: "Put this card in front of you. Action cards that alter the line may not be played.",
  },
  Infighting: {
    effectKey: "infighting",
    description: "Choose a player. That player must choose 2 action cards from his or her hand and discard them.",
  },
  "Clerical Error": {
    effectKey: "clericalError",
    description: "Choose a player. Collect any noble of your choice from that player's score pile, then that player takes one from yours.",
  },
  "Lack of Support": {
    effectKey: "lackOfSupport",
    description: "Choose a player. Look at that player's hand, choose an action card, and discard it.",
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


