import type {
  ActionCard,
  CardInstance,
  GameLogEntry,
  GamePhase,
  GameState,
  NobleCard,
  PendingPrivateChoice,
  Player,
  PlayerId,
  TurnEffectsState,
  TurnStep,
} from "@/lib/game/types";
import type { ValidActionTarget } from "@/lib/game/effects";
import { actionEffectRequiresTarget, canApplyActionEffect, getValidActionTargets } from "@/lib/game/effects";

export interface PublicPlayerView {
  id: PlayerId;
  name: string;
  handCount: number;
  inFrontActions: CardInstance<ActionCard>[];
  collectedNobles: CardInstance<NobleCard>[];
  skipNextActionTurn: boolean;
  skipActionThisTurn: boolean;
  shuffleLineBeforeNextCollection: boolean;
  score: number;
}

export interface ViewerPlayerView extends PublicPlayerView {
  hand: CardInstance<ActionCard>[];
  validActionTargetsByCardId: Record<string, ValidActionTarget[]>;
}

export interface PublicDeckView<TCard> {
  drawPileCount: number;
  discardPile: TCard[];
}

export interface PlayerGameView {
  phase: GamePhase;
  day: number;
  maxDays: 3;
  viewerPlayerId: PlayerId;
  currentPlayerId?: PlayerId;
  isViewerTurn: boolean;
  turnStep: TurnStep;
  passScreenVisible: boolean;
  turnEffects: TurnEffectsState;
  pendingChoice?: PendingPrivateChoice;
  returningFromPrivateChoice: boolean;
  notice?: string;
  players: PublicPlayerView[];
  viewer?: ViewerPlayerView;
  nobleLine: CardInstance<NobleCard>[];
  nobleDeck: PublicDeckView<CardInstance<NobleCard>>;
  actionDeck: PublicDeckView<CardInstance<ActionCard>>;
  log: GameLogEntry[];
  briefingItems: string[];
  canUndo: boolean;
  winnerIds: PlayerId[];
}

export function createPublicPlayerView(player: Player): PublicPlayerView {
  return {
    id: player.id,
    name: player.name,
    handCount: player.hand.length,
    inFrontActions: player.inFrontActions,
    collectedNobles: player.collectedNobles,
    skipNextActionTurn: player.skipNextActionTurn,
    skipActionThisTurn: player.skipActionThisTurn,
    shuffleLineBeforeNextCollection: player.shuffleLineBeforeNextCollection,
    score: player.score,
  };
}

export function createViewerPlayerView(state: GameState, player: Player): ViewerPlayerView {
  return {
    ...createPublicPlayerView(player),
    hand: player.hand,
    validActionTargetsByCardId: Object.fromEntries(
      player.hand.map((actionCard) => [
        actionCard.instanceId,
        getViewerActionTargets(state, player.id, actionCard),
      ]),
    ),
  };
}

export function createPlayerGameView(state: GameState, viewerPlayerId: PlayerId): PlayerGameView {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const viewerPlayer = state.players.find((player) => player.id === viewerPlayerId);

  return {
    phase: state.phase,
    day: state.day,
    maxDays: state.maxDays,
    viewerPlayerId,
    currentPlayerId: currentPlayer?.id,
    isViewerTurn: currentPlayer?.id === viewerPlayerId,
    turnStep: state.turnStep,
    passScreenVisible: state.passScreen.visible,
    turnEffects: state.turnEffects,
    pendingChoice: shouldExposePendingChoice(state.pendingChoice, viewerPlayerId) ? state.pendingChoice : undefined,
    returningFromPrivateChoice: state.returningFromPrivateChoice,
    notice: state.notice,
    players: state.players.map((player) => createPublicPlayerViewForViewer(state, player, viewerPlayerId)),
    viewer: viewerPlayer ? createViewerPlayerView(state, viewerPlayer) : undefined,
    nobleLine: state.nobleLine.cards,
    nobleDeck: {
      drawPileCount: state.nobleDeck.drawPile.length,
      discardPile: state.nobleDeck.discardPile,
    },
    actionDeck: {
      drawPileCount: state.actionDeck.drawPile.length,
      discardPile: state.actionDeck.discardPile,
    },
    log: state.log,
    briefingItems: state.playerBriefings[viewerPlayerId] ?? [],
    canUndo: state.gameHistory.length > 0,
    winnerIds: state.winnerIds,
  };
}

function createPublicPlayerViewForViewer(state: GameState, player: Player, viewerPlayerId: PlayerId): PublicPlayerView {
  const publicView = createPublicPlayerView(player);
  const pending = state.pendingChoice;

  if (
    pending?.type === "clericalErrorReturn" &&
    pending.targetPlayerId === viewerPlayerId &&
    player.id === pending.originalPlayerId
  ) {
    return {
      ...publicView,
      collectedNobles: publicView.collectedNobles.filter((noble) => noble.instanceId !== pending.excludedNobleInstanceId),
    };
  }

  return publicView;
}

function getViewerActionTargets(
  state: GameState,
  playerId: PlayerId,
  actionCard: CardInstance<ActionCard>,
): ValidActionTarget[] {
  const currentPlayer = state.players[state.currentPlayerIndex];

  if (
    state.phase !== "playing" ||
    state.passScreen.visible ||
    state.pendingChoice ||
    state.turnStep !== "playActionOptional" ||
    currentPlayer?.id !== playerId ||
    currentPlayer.skipActionThisTurn ||
    currentPlayer.skipNextActionTurn
  ) {
    return [];
  }

  if (!canApplyActionEffect(state, actionCard.card.effectKey, { playerId })) {
    return [];
  }

  if (actionEffectRequiresTarget(actionCard.card.effectKey)) {
    return getValidActionTargets(state, actionCard.card.effectKey, { playerId });
  }

  return [
    {
      target: {
        type: "noble-position",
        index: -1,
      },
      label: "Play",
    },
  ];
}

function shouldExposePendingChoice(pendingChoice: PendingPrivateChoice | undefined, viewerPlayerId: PlayerId): boolean {
  return Boolean(
    pendingChoice &&
      (pendingChoice.originalPlayerId === viewerPlayerId || pendingChoice.targetPlayerId === viewerPlayerId),
  );
}
