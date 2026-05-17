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

export interface NobleCard extends BaseCard {
  kind: "noble";
  points: number;
  group?: string;
}

export interface ActionCard extends BaseCard {
  kind: "action";
  effectKey: ActionEffectKey;
}

export type ActionEffectKey =
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
  collectedNobles: CardInstance<NobleCard>[];
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
  nobleDeck: DeckState<NobleCard>;
  actionDeck: DeckState<ActionCard>;
  nobleLine: NobleLine;
  log: GameLogEntry[];
  gameHistory: GameSnapshot[];
  winnerIds: PlayerId[];
}

export type ActionTarget =
  | { type: "noble"; instanceId: CardInstanceId }
  | { type: "noble-position"; index: number }
  | { type: "player"; playerId: PlayerId };

export type GameCommand =
  | { type: "START_GAME"; playerNames: string[] }
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
