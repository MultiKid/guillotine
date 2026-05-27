import type { CardDefinition } from "@/lib/cards/definitions";
import type { NobleCard } from "@/lib/game/types";

const nobleDefinitionData: CardDefinition<NobleCard>[] = [
  { id: "archbishop", kind: "noble", name: "Archbishop", colorCategory: "blue", points: 4, group: "church", quantity: 1 },
  { id: "bad-nun", kind: "noble", name: "Bad Nun", colorCategory: "blue", points: 3, group: "church", quantity: 1 },
  { id: "baron", kind: "noble", name: "Baron", colorCategory: "purple", points: 3, group: "royal", quantity: 1 },
  { id: "bishop", kind: "noble", name: "Bishop", colorCategory: "blue", points: 2, group: "church", quantity: 1 },
  { id: "captain-of-the-guard", kind: "noble", name: "Captain of the Guard", colorCategory: "red", points: 2, group: "military", quantity: 1 },
  { id: "cardinal", kind: "noble", name: "Cardinal", colorCategory: "blue", points: 5, group: "church", quantity: 1 },
  { id: "coiffeur", kind: "noble", name: "Coiffeur", colorCategory: "purple", points: 1, group: "royal", quantity: 1 },
  { id: "colonel", kind: "noble", name: "Colonel", colorCategory: "red", points: 3, group: "military", quantity: 1 },
  { id: "councilman", kind: "noble", name: "Councilman", colorCategory: "green", points: 3, group: "civic", quantity: 1 },
  { id: "count", kind: "noble", name: "Count", colorCategory: "purple", points: 2, group: "royal", quantity: 1 },
  { id: "countess", kind: "noble", name: "Countess", colorCategory: "purple", points: 2, group: "royal", quantity: 1 },
  { id: "duke", kind: "noble", name: "Duke", colorCategory: "purple", points: 3, group: "royal", quantity: 1 },
  { id: "fast-noble", kind: "noble", name: "Fast Noble", colorCategory: "purple", points: 2, group: "royal", quantity: 1 },
  { id: "general", kind: "noble", name: "General", colorCategory: "red", points: 4, group: "military", quantity: 1 },
  { id: "governor", kind: "noble", name: "Governor", colorCategory: "green", points: 4, group: "civic", quantity: 1 },
  { id: "heretic", kind: "noble", name: "Heretic", colorCategory: "blue", points: 2, group: "church", quantity: 1 },
  { id: "hero-of-the-people", kind: "noble", name: "Hero of the People", colorCategory: "gray", points: -3, group: "gray", quantity: 1 },
  { id: "heroine-of-the-people", kind: "noble", name: "Heroine of the People", colorCategory: "gray", points: -3, group: "gray", quantity: 1 },
  { id: "innocent-victim", kind: "noble", name: "Innocent Victim", colorCategory: "gray", points: -1, group: "gray", quantity: 1 },
  { id: "king-louis-xvi", kind: "noble", name: "King Louis XVI", colorCategory: "purple", points: 5, group: "royal", quantity: 1 },
  { id: "lady", kind: "noble", name: "Lady", colorCategory: "purple", points: 2, group: "royal", quantity: 1 },
  { id: "lady-in-waiting", kind: "noble", name: "Lady in Waiting", colorCategory: "purple", points: 1, group: "royal", quantity: 1 },
  { id: "land-lord", kind: "noble", name: "Land Lord", colorCategory: "green", points: 2, group: "civic", quantity: 1 },
  { id: "lieutenant", kind: "noble", name: "Lieutenant", colorCategory: "red", points: 2, group: "military", quantity: 2 },
  { id: "lord", kind: "noble", name: "Lord", colorCategory: "purple", points: 2, group: "royal", quantity: 1 },
  { id: "marie-antoinette", kind: "noble", name: "Marie Antoinette", colorCategory: "purple", points: 5, group: "royal", quantity: 1 },
  { id: "martyr", kind: "noble", name: "Martyr", colorCategory: "gray", points: -1, group: "gray", quantity: 3 },
  { id: "master-spy", kind: "noble", name: "Master Spy", colorCategory: "red", points: 4, group: "military", quantity: 1 },
  { id: "mayor", kind: "noble", name: "Mayor", colorCategory: "green", points: 3, group: "civic", quantity: 1 },
  {
    id: "palace-guard",
    kind: "noble",
    name: "Palace Guard", colorCategory: "red",
    points: 1,
    group: "military",
    quantity: 5,
    description: "Special scoring later: each Palace Guard is worth the number of Palace Guards in that player's score pile.",
  },
  { id: "piss-boy", kind: "noble", name: "Piss Boy", colorCategory: "purple", points: 1, group: "royal", quantity: 1 },
  { id: "regent", kind: "noble", name: "Regent", colorCategory: "purple", points: 4, group: "royal", quantity: 1 },
  { id: "rival-executioner", kind: "noble", name: "Rival Executioner", colorCategory: "green", points: 1, group: "civic", quantity: 1 },
  { id: "robespierre", kind: "noble", name: "Robespierre", colorCategory: "purple", points: 3, group: "royal", quantity: 1 },
  { id: "royal-cartographer", kind: "noble", name: "Royal Cartographer", colorCategory: "purple", points: 1, group: "royal", quantity: 1 },
  { id: "sheriff", kind: "noble", name: "Sheriff", colorCategory: "green", points: 1, group: "civic", quantity: 2 },
  { id: "tax-collector", kind: "noble", name: "Tax Collector", colorCategory: "green", points: 2, group: "civic", quantity: 1 },
  { id: "the-clown", kind: "noble", name: "The Clown", colorCategory: "gray", points: -2, group: "gray", quantity: 1 },
  {
    id: "tragic-figure",
    kind: "noble",
    name: "Tragic Figure", colorCategory: "gray",
    points: -1,
    group: "gray",
    quantity: 1,
    description: "Special scoring later: worth -1 for each gray noble in that player's score pile.",
  },
  { id: "unpopular-judge", kind: "noble", name: "Unpopular Judge", colorCategory: "green", points: 2, group: "civic", quantity: 2 },
  { id: "wealthy-priest", kind: "noble", name: "Wealthy Priest", colorCategory: "blue", points: 1, group: "church", quantity: 2 },
];

export const nobleDefinitions: CardDefinition<NobleCard>[] = nobleDefinitionData.map((card) => ({
  ...card,
  imagePath: `/cards/nobles/${getNobleImageFileName(card.id)}`,
}));

export const NOBLE_DECK_SIZE = 51;

function getNobleImageFileName(id: string) {
  if (id === "heroine-of-the-people") {
    return "heroine-of-the-people.png";
  }

  return `${id}.jpg`;
}

