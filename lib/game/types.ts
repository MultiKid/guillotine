export type PlayerId = string;
export type CardId = string;
export type CardInstanceId = string;

export type GamePhase = "setup" | "playing" | "dayEnd" | "gameEnd";

export type TurnStep =
  | "playActionOptional"
  | "takeNobleRequired"
  | "turnComplete";

export type CardKind = "noble" | "action";

export interface BaseCard {
  id: CardId;
  name: string;
  kind: CardKind;
  description?: string;
}

export type NobleColorCategory = "blue" | "red" | "green" | "purple" | "gray";

export interface NobleCard extends BaseCard {
  kind: "noble";
  points: number;
  group?: string;
  colorCategory: NobleColorCategory;
}

export interface ActionCard extends BaseCard {
  kind: "action";
  effectKey: ActionEffectKey;
}

export type ActionEffectKey =
  | "notImplemented"
  | "friendOfTheQueen"
  | "pushed"
  | "stumble"
  | "ignobleNoble"
  | "extraCart"
  | "politicalInfluence"
  | "doubleFeature"
  | "lIdiot"
  | "letThemEatCake"
  | "tisFarBetterThing"
  | "wasThatMyName"
  | "forwardMarch"
  | "scarletPimpernel"
  | "bribedGuards"
  | "publicDemand"
  | "theLongWalk"
  | "lackOfFaith"
  | "militaryMight"
  | "majesty"
  | "civicPride"
  | "trip"
  | "faintingSpell"
  | "fledToEngland"
  | "forcedBreak"
  | "rainDelay"
  | "massConfusion"
  | "escape"
  | "millingInLine"
  | "toughCrowd"
  | "militarySupport"
  | "churchSupport"
  | "civicSupport"
  | "fountainOfBlood"
  | "indifferentPublic"
  | "foreignSupport"
  | "opinionatedGuards"
  | "lateArrival"
  | "ratBreak"
  | "missed"
  | "rushJob"
  | "informationExchange"
  | "twistOfFate"
  | "afterYou"
  | "clothingSwap"
  | "confusionInLine"
  | "missingHeads"
  | "moveFrontNobleBackOne"
  | "moveBackNobleForwardOne"
  | "swapFirstTwoNobles"
  | "drawOneActionCard";

export interface CardInstance<TCard extends BaseCard = BaseCard> {
  instanceId: CardInstanceId;
  cardId: CardId;
  card: TCard;
}

export interface Player {
  id: PlayerId;
  name: string;
  hand: CardInstance<ActionCard>[];
  inFrontActions: CardInstance<ActionCard>[];
  collectedNobles: CardInstance<NobleCard>[];
  skipNextActionTurn: boolean;
  skipActionThisTurn: boolean;
  shuffleLineBeforeNextCollection: boolean;
  score: number;
}

export interface DeckState<TCard extends BaseCard> {
  drawPile: CardInstance<TCard>[];
  discardPile: CardInstance<TCard>[];
}

export interface NobleLine {
  cards: CardInstance<NobleCard>[];
}

export interface GameLogEntry {
  id: string;
  message: string;
  day: number;
  playerId?: PlayerId;
}

export interface PassScreenState {
  visible: boolean;
}

export interface TurnEffectsState {
  endDayAfterTurn: boolean;
}

export interface GameSnapshot {
  state: Omit<GameState, "gameHistory">;
  reason: string;
  createdAt: number;
}

export interface GameState {
  phase: GamePhase;
  day: number;
  maxDays: 3;
  players: Player[];
  currentPlayerIndex: number;
  turnStep: TurnStep;
  passScreen: PassScreenState;
  turnEffects: TurnEffectsState;
  nobleDeck: DeckState<NobleCard>;
  actionDeck: DeckState<ActionCard>;
  nobleLine: NobleLine;
  log: GameLogEntry[];
  gameHistory: GameSnapshot[];
  winnerIds: PlayerId[];
}

export type ActionTarget =
  | { type: "move-noble"; instanceId: CardInstanceId; spaces: number }
  | { type: "noble"; instanceId: CardInstanceId }
  | { type: "reorder-nobles"; instanceIds: CardInstanceId[] }
  | { type: "noble-deck-card"; instanceId: CardInstanceId }
  | { type: "action-discard-card"; instanceId: CardInstanceId }
  | { type: "in-front-action"; playerId: PlayerId; instanceId: CardInstanceId }
  | { type: "noble-position"; index: number }
  | { type: "player"; playerId: PlayerId };

export type GameCommand =
  | { type: "START_GAME"; playerNames: string[] }
  | { type: "READY_FOR_TURN" }
  | { type: "RELOAD_TEST_HAND"; playerId: PlayerId }
  | {
      type: "PLAY_ACTION_CARD";
      playerId: PlayerId;
      cardId: CardInstanceId;
      target?: ActionTarget;
    }
  | { type: "TAKE_FRONT_NOBLE"; playerId: PlayerId }
  | { type: "END_TURN"; playerId: PlayerId }
  | { type: "START_NEXT_DAY" }
  | { type: "UNDO_LAST_ACTION" };

