"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { ActionHand } from "@/components/game/ActionHand";
import { ActionDiscardPile } from "@/components/game/ActionDiscardPile";
import { CollectedNobles } from "@/components/game/CollectedNobles";
import { DayTracker } from "@/components/game/DayTracker";
import { GameEndScreen } from "@/components/game/GameEndScreen";
import { GameHistory } from "@/components/game/GameHistory";
import { NobleLine } from "@/components/game/NobleLine";
import { PassTurnScreen } from "@/components/game/PassTurnScreen";
import { PlayerDetailsModal } from "@/components/game/PlayerDetailsModal";
import { PlayerPanel } from "@/components/game/PlayerPanel";
import { PrivateChoicePanel } from "@/components/game/PrivateChoicePanel";
import { LocalGameSetup } from "@/components/setup/LocalGameSetup";
import { Button } from "@/components/ui/Button";
import { CardPreviewModal } from "@/components/ui/CardPreviewModal";
import { createInitialGameState } from "@/lib/game/createGame";
import {
  actionEffectRequiresTarget,
  canApplyActionEffect,
  getActionPlayRestriction,
  getValidActionTargets,
  hasUnpopularJudgeAtFront,
} from "@/lib/game/effects";
import type { ValidActionTarget } from "@/lib/game/effects";
import { gameReducer } from "@/lib/game/gameReducer";
import { getGameModeConfig } from "@/lib/game/modes";
import { createPlayerGameView } from "@/lib/game/playerView";
import { selectCurrentPlayer } from "@/lib/game/selectors";
import type { ActionCard, ActionTarget, BaseCard, CardInstance, CardInstanceId, NobleCard, Player } from "@/lib/game/types";
import type { GameMode } from "@/lib/game/modes";

const COLLECTED_STACK_OFFSET = 43;

type GameBoardProps = {
  mode?: GameMode;
  onBackToHome?: () => void;
};

export function GameBoard({ mode = "local", onBackToHome }: GameBoardProps) {
  const modeConfig = getGameModeConfig(mode);
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialGameState);
  const enterKeyArmed = useRef(true);
  const [selectedActionCardId, setSelectedActionCardId] = useState<CardInstanceId | undefined>();
  const [selectedNobleTargetId, setSelectedNobleTargetId] = useState<CardInstanceId | undefined>();
  const [reorderDraftIds, setReorderDraftIds] = useState<CardInstanceId[]>([]);
  const [collectionAreaElement, setCollectionAreaElement] = useState<HTMLDivElement | null>(null);
  const [isCollectionAnimating, setIsCollectionAnimating] = useState(false);
  const [isLineShuffling, setIsLineShuffling] = useState(false);
  const [hiddenNobleLineCardIds, setHiddenNobleLineCardIds] = useState<CardInstanceId[]>([]);
  const [displayedBackgroundNobleCount, setDisplayedBackgroundNobleCount] = useState(13);
  const [pendingEndTurnPlayerId, setPendingEndTurnPlayerId] = useState<string | undefined>();
  const [selectedPrivateTargetPlayerId, setSelectedPrivateTargetPlayerId] = useState<string | undefined>();
  const [flyingNoble, setFlyingNoble] = useState<{
    imagePath?: string;
    name: string;
    style: {
      height: number;
      left: number;
      opacity: number;
      top: number;
      width: number;
      x: number;
      y: number;
    };
  }>();
  const [selectedDetailsPlayerId, setSelectedDetailsPlayerId] = useState<string | undefined>();
  const [previewCard, setPreviewCard] = useState<BaseCard | undefined>();
  const currentPlayer = selectCurrentPlayer(state);
  const viewerPlayerId = mode === "local" ? undefined : currentPlayer?.id;
  const playerGameView = viewerPlayerId ? createPlayerGameView(state, viewerPlayerId) : undefined;
  const playerPanelPlayers = playerGameView?.players ?? state.players;
  const detailsPlayer = state.players.find((player) => player.id === selectedDetailsPlayerId);
  const pendingClownChoiceForCurrentPlayer =
    state.pendingChoice?.type === "clownGift" &&
    currentPlayer?.id === state.pendingChoice.targetPlayerId &&
    !state.pendingChoice.returnToPassScreen;
  const clownGiftPlayerTargets =
    pendingClownChoiceForCurrentPlayer && currentPlayer
      ? state.players
          .filter((player) => player.id !== currentPlayer.id)
          .map((player) => ({
            target: {
              type: "player" as const,
              playerId: player.id,
            },
            label: `Give The Clown to ${player.name}`,
            playerId: player.id,
            playerName: player.name,
          }))
      : [];
  const canPlayActions =
    state.phase === "playing" &&
    state.turnStep === "playActionOptional" &&
    Boolean(currentPlayer) &&
    !pendingEndTurnPlayerId &&
    !currentPlayer?.skipActionThisTurn &&
    !isCollectionAnimating &&
    !pendingClownChoiceForCurrentPlayer;
  const selectedAction = currentPlayer?.hand.find((action) => action.instanceId === selectedActionCardId);
  const validTargets =
    currentPlayer && selectedAction
      ? getValidActionTargets(state, selectedAction.card.effectKey, { playerId: currentPlayer.id })
      : [];
  const isLackOfSupportAction = selectedAction?.card.effectKey === "lackOfSupport";
  const lackOfSupportPlayerTargets = isLackOfSupportAction ? getPrivateHandPlayerTargetsForPanel(validTargets) : [];
  const isReorderAction = selectedAction?.card.effectKey === "opinionatedGuards";
  const legalReorderIds = isReorderAction
    ? validTargets
        .filter((target) => target.target.type === "noble" && typeof target.fromPosition === "number" && typeof target.toPosition !== "number")
        .sort((first, second) => (first.fromPosition ?? 0) - (second.fromPosition ?? 0))
        .flatMap((target) => (target.target.type === "noble" ? [target.target.instanceId] : []))
    : [];
  const [shufflePreviewIds, setShufflePreviewIds] = useState<CardInstanceId[]>([]);
  const displayedNobles = shufflePreviewIds.length > 0
    ? applyReorderDraft(state.nobleLine.cards, shufflePreviewIds)
    : isReorderAction && reorderDraftIds.length > 0
    ? applyReorderDraft(state.nobleLine.cards, reorderDraftIds)
    : state.nobleLine.cards;
  const canUseEnterToEndTurn =
    state.phase === "playing" &&
    state.turnStep === "turnComplete" &&
    Boolean(currentPlayer) &&
    !pendingEndTurnPlayerId &&
    !isCollectionAnimating &&
    !pendingClownChoiceForCurrentPlayer;
  const canUseEnterToTakeNoble =
    state.phase === "playing" &&
    Boolean(currentPlayer) &&
    state.nobleLine.cards.length > 0 &&
    state.turnStep !== "turnComplete" &&
    !pendingEndTurnPlayerId &&
    !isCollectionAnimating &&
    !pendingClownChoiceForCurrentPlayer;
  const isPassOverlayVisible = (state.passScreen.visible || Boolean(pendingEndTurnPlayerId)) && state.phase === "playing";

  useEffect(() => {
    if (!isReorderAction) {
      setReorderDraftIds([]);
      return;
    }

    setReorderDraftIds((currentIds) => (haveSameIds(currentIds, legalReorderIds) ? currentIds : legalReorderIds));
  }, [isReorderAction, selectedActionCardId, legalReorderIds.join("|")]);

  useEffect(() => {
    if (state.phase === "setup") {
      setDisplayedBackgroundNobleCount(12);
    }
  }, [state.phase]);

  useEffect(() => {
    for (let count = 1; count <= 13; count += 1) {
      const image = new Image();
      image.src = `/backgrounds/day-cycle/day-${String(count).padStart(2, "0")}.png`;
    }
  }, []);

  useEffect(() => {
    if (state.phase !== "playing" || !state.passScreen.visible) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDisplayedBackgroundNobleCount(state.nobleLine.cards.length);
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [state.phase, state.passScreen.visible, state.nobleLine.cards.length]);

  useEffect(() => {
    const clampedNobleCount = Math.min(Math.max(displayedBackgroundNobleCount, 1), 13);
    const backgroundFileName = `day-${String(clampedNobleCount).padStart(2, "0")}.png`;

    document.documentElement.style.setProperty("--game-background-image", `url("/backgrounds/day-cycle/${backgroundFileName}")`);
    document.documentElement.style.setProperty("--game-background-next-image", `url("/backgrounds/day-cycle/${backgroundFileName}")`);
    document.documentElement.style.setProperty("--game-background-next-opacity", "0");
  }, [displayedBackgroundNobleCount]);

  async function playAction(cardId: CardInstanceId, target?: ActionTarget) {
    if (!currentPlayer) {
      return;
    }

    const actionCard = currentPlayer.hand.find((action) => action.instanceId === cardId);

    if (actionCard?.card.effectKey === "doubleFeature") {
      const frontNoble = state.nobleLine.cards[0];
      const secondNoble = state.nobleLine.cards[1];

      if (frontNoble) {
        setIsCollectionAnimating(true);
        await animateNobleToCollection(frontNoble, currentPlayer);

        if (frontNoble.card.name === "Fast Noble" && secondNoble) {
          await animateNobleToCollection(secondNoble, currentPlayer, [frontNoble]);
        }

        setIsCollectionAnimating(false);
      }
    }

    if (actionCard?.card.effectKey === "afterYou" && target?.type === "player") {
      const frontNoble = state.nobleLine.cards[0];
      const targetElement = document.querySelector<HTMLElement>(`[data-player-panel-id="${target.playerId}"]`);

      if (frontNoble && targetElement) {
        setIsCollectionAnimating(true);
        await animateNobleToElement(frontNoble, targetElement, {
          fadeAway: true,
          targetOffset: (sourceRect, targetRect) => ({
            x: targetRect.width / 2 - sourceRect.width / 2,
            y: 8,
          }),
        });
        setIsCollectionAnimating(false);
      }
    }

    dispatch({ type: "PLAY_ACTION_CARD", playerId: currentPlayer.id, cardId, target });
    setHiddenNobleLineCardIds([]);
    setSelectedActionCardId(undefined);
    setSelectedNobleTargetId(undefined);
    setSelectedPrivateTargetPlayerId(undefined);
    setReorderDraftIds([]);
  }

  function canPlayActionCard(action: CardInstance<ActionCard>) {
    if (!currentPlayer) {
      return false;
    }

    if (getActionPlayRestriction(state, action.card.effectKey)) {
      return false;
    }

    if (actionEffectRequiresTarget(action.card.effectKey)) {
      return getValidActionTargets(state, action.card.effectKey, { playerId: currentPlayer.id }).length > 0;
    }

    return canApplyActionEffect(state, action.card.effectKey, { playerId: currentPlayer.id });
  }

  function getActionBlockedReason(action: CardInstance<ActionCard>) {
    return getActionPlayRestriction(state, action.card.effectKey);
  }

  async function takeNoble(playerId: string) {
    if (isCollectionAnimating) {
      return;
    }

    const shouldCommitReorderBeforeTaking =
      isReorderAction && selectedAction && reorderDraftIds.length > 0 && state.turnStep === "playActionOptional";
    const effectiveNobleLine = shouldCommitReorderBeforeTaking
      ? applyReorderDraft(state.nobleLine.cards, reorderDraftIds)
      : state.nobleLine.cards;
    const frontNoble = effectiveNobleLine[0];
    const player = state.players.find((candidate) => candidate.id === playerId);

    if (!frontNoble || !player) {
      return;
    }

    setIsCollectionAnimating(true);

    let preShuffledLineIds: CardInstanceId[] | undefined;

    if (player.shuffleLineBeforeNextCollection) {
      preShuffledLineIds = shuffleIds(effectiveNobleLine.map((noble) => noble.instanceId));
      setShufflePreviewIds(preShuffledLineIds);
      setIsLineShuffling(true);
      await wait(720);
      setIsLineShuffling(false);
    }

    const visibleFrontNoble = preShuffledLineIds
      ? effectiveNobleLine.find((noble) => noble.instanceId === preShuffledLineIds[0])
      : frontNoble;
    const visibleSecondNoble = preShuffledLineIds
      ? effectiveNobleLine.find((noble) => noble.instanceId === preShuffledLineIds[1])
      : effectiveNobleLine[1];

    if (visibleFrontNoble) {
      await animateNobleToCollection(visibleFrontNoble, player);
    }

    if (visibleFrontNoble?.card.name === "Fast Noble" && visibleSecondNoble) {
      await animateNobleToCollection(visibleSecondNoble, player, [visibleFrontNoble]);
    }

    if (shouldCommitReorderBeforeTaking) {
      dispatch({
        type: "CONFIRM_REORDER_AND_TAKE_FRONT_NOBLE",
        playerId,
        cardId: selectedAction.instanceId,
        reorderedNobleIds: reorderDraftIds,
        preShuffledLineIds,
      });
    } else {
      dispatch({ type: "TAKE_FRONT_NOBLE", playerId, preShuffledLineIds });
    }
    setShufflePreviewIds([]);
    setHiddenNobleLineCardIds([]);
    setSelectedActionCardId(undefined);
    setSelectedNobleTargetId(undefined);
    setSelectedPrivateTargetPlayerId(undefined);
    setReorderDraftIds([]);
    setIsCollectionAnimating(false);
  }

  function endTurn(playerId: string) {
    if (pendingEndTurnPlayerId || state.passScreen.visible) {
      return;
    }

    setPendingEndTurnPlayerId(playerId);
    setSelectedActionCardId(undefined);
    setSelectedNobleTargetId(undefined);
    setSelectedPrivateTargetPlayerId(undefined);
    setReorderDraftIds([]);
  }

  function commitPendingEndTurn() {
    if (!pendingEndTurnPlayerId) {
      return;
    }

    const playerId = pendingEndTurnPlayerId;
    setPendingEndTurnPlayerId(undefined);
    dispatch({ type: "END_TURN", playerId });
    setSelectedActionCardId(undefined);
    setSelectedNobleTargetId(undefined);
    setSelectedPrivateTargetPlayerId(undefined);
    setReorderDraftIds([]);
  }

  function reloadTestHand() {
    if (!currentPlayer) {
      return;
    }

    dispatch({ type: "RELOAD_TEST_HAND", playerId: currentPlayer.id });
    setSelectedActionCardId(undefined);
    setSelectedNobleTargetId(undefined);
    setSelectedPrivateTargetPlayerId(undefined);
    setReorderDraftIds([]);
  }

  function discardCallousGuards(cardId: CardInstanceId) {
    if (!currentPlayer) {
      return;
    }

    dispatch({ type: "DISCARD_CALLOUS_GUARDS", playerId: currentPlayer.id, cardId });
    setSelectedActionCardId(undefined);
    setSelectedNobleTargetId(undefined);
    setSelectedPrivateTargetPlayerId(undefined);
    setReorderDraftIds([]);
  }

  function undo() {
    dispatch({ type: "UNDO_LAST_ACTION" });
    setSelectedActionCardId(undefined);
    setSelectedNobleTargetId(undefined);
    setSelectedPrivateTargetPlayerId(undefined);
    setReorderDraftIds([]);
  }

  function resolveInfighting(playerId: string, cardIds: CardInstanceId[]) {
    dispatch({ type: "RESOLVE_INFIGHTING", playerId, cardIds });
  }

  function resolveClericalErrorReturn(playerId: string, nobleId?: CardInstanceId) {
    dispatch({ type: "RESOLVE_CLERICAL_ERROR_RETURN", playerId, nobleId });
  }

  function resolveInnocentVictimDiscard(playerId: string, cardId?: CardInstanceId) {
    dispatch({ type: "RESOLVE_INNOCENT_VICTIM_DISCARD", playerId, cardId });
  }

  async function resolveClownGift(playerId: string, targetPlayerId: string) {
    const pending = state.pendingChoice;
    const receivingPlayer = state.players.find((player) => player.id === playerId);
    const clown =
      pending?.type === "clownGift" && receivingPlayer
        ? receivingPlayer.collectedNobles.find((noble) => noble.instanceId === pending.clownInstanceId)
        : undefined;
    const targetElement = document.querySelector<HTMLElement>(`[data-player-panel-id="${targetPlayerId}"]`);

    if (pendingClownChoiceForCurrentPlayer && clown && targetElement) {
      setIsCollectionAnimating(true);
      await animateNobleToElement(clown, targetElement, {
        fadeAway: true,
        hideLineSource: false,
        targetOffset: (sourceRect, targetRect) => ({
          x: targetRect.width / 2 - sourceRect.width / 2,
          y: 8,
        }),
      });
      setIsCollectionAnimating(false);
    }

    dispatch({ type: "RESOLVE_CLOWN_GIFT", playerId, targetPlayerId });
  }

  function readyForTurn(inputMethod?: "keyboard" | "pointer") {
    if (inputMethod === "keyboard") {
      enterKeyArmed.current = false;
    }

    dispatch({ type: "READY_FOR_TURN" });
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter" || !enterKeyArmed.current || isEditableElement(event.target)) {
        return;
      }

      event.preventDefault();
      enterKeyArmed.current = false;
      void handleEnterShortcut();
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === "Enter") {
        enterKeyArmed.current = true;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  });

  async function handleEnterShortcut() {
    if (isPassOverlayVisible || state.notice || previewCard || selectedDetailsPlayerId || isCollectionAnimating) {
      return;
    }

    if (pendingClownChoiceForCurrentPlayer && currentPlayer && clownGiftPlayerTargets.length === 1) {
      const target = clownGiftPlayerTargets[0]?.target;

      if (target?.type === "player") {
        await resolveClownGift(currentPlayer.id, target.playerId);
      }
      return;
    }

    const singleTarget = getSingleEnterActionTarget();

    if (selectedAction && singleTarget && canPlayActions) {
      await playAction(selectedAction.instanceId, singleTarget);
      return;
    }

    if (currentPlayer && canUseEnterToEndTurn) {
      endTurn(currentPlayer.id);
      return;
    }

    if (currentPlayer && canUseEnterToTakeNoble) {
      await takeNoble(currentPlayer.id);
    }
  }

  function getSingleEnterActionTarget(): ActionTarget | undefined {
    if (!selectedAction || isReorderAction) {
      return undefined;
    }

    const movementTargets = validTargets.filter((target) => isLineMovementTarget(target.target));

    if (movementTargets.length > 0) {
      const targetsForSelectedNoble = selectedNobleTargetId
        ? movementTargets.filter((target) => getTargetNobleId(target.target) === selectedNobleTargetId)
        : movementTargets;

      return targetsForSelectedNoble.length === 1 ? targetsForSelectedNoble[0]?.target : undefined;
    }

    return validTargets.length === 1 ? validTargets[0]?.target : undefined;
  }

  if (state.phase === "setup") {
    return (
      <LocalGameSetup
        modeConfig={modeConfig}
        onBackToHome={onBackToHome}
        onStartGame={(playerNames) => {
          setDisplayedBackgroundNobleCount(12);
          dispatch({ type: "START_GAME", playerNames });
        }}
      />
    );
  }

  if (state.phase === "gameEnd") {
    return <GameEndScreen players={state.players} winnerIds={state.winnerIds} />;
  }

  const pendingTargetPlayerId = state.passScreen.visible ? state.pendingChoice?.targetPlayerId : undefined;
  const pendingEndTurnNextPlayer =
    pendingEndTurnPlayerId && state.players.length > 0
      ? state.players[(state.currentPlayerIndex + 1) % state.players.length]
      : undefined;
  const passScreenPlayer = pendingTargetPlayerId
    ? state.players.find((player) => player.id === pendingTargetPlayerId)
    : pendingEndTurnNextPlayer
    ? pendingEndTurnNextPlayer
    : currentPlayer;
  const isPrivateChoicePassScreen = Boolean(state.passScreen.visible && state.pendingChoice);
  const passScreenBriefingItems =
    passScreenPlayer && !isPrivateChoicePassScreen
      ? state.playerBriefings[passScreenPlayer.id] ?? []
      : [];
  if (state.pendingChoice && state.phase === "playing" && !state.passScreen.visible && !pendingClownChoiceForCurrentPlayer) {
    return (
      <PrivateChoicePanel
        pendingChoice={state.pendingChoice}
        players={state.players}
        onResolveInfighting={resolveInfighting}
        onResolveClericalErrorReturn={resolveClericalErrorReturn}
        onResolveInnocentVictimDiscard={resolveInnocentVictimDiscard}
        onResolveClownGift={resolveClownGift}
      />
    );
  }

  return (
    <section className="relative">
      <div aria-hidden={isPassOverlayVisible} className="flex flex-col gap-4">
      {state.notice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4">
          <div className="max-w-md rounded-lg border border-stone-300 bg-white/50 p-5 text-center shadow-xl backdrop-blur-sm">
            <h2 className="text-lg font-bold text-stone-950">Notice</h2>
            <p className="mt-2 text-sm text-stone-700">{state.notice}</p>
            <Button className="mt-4" onClick={() => dispatch({ type: "DISMISS_NOTICE" })}>
              OK
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[160px_1fr]">
        <div className="grid h-full grid-rows-2 gap-2">
          <DayTracker day={state.day} maxDays={state.maxDays} />
          <div className="rounded-lg border border-stone-300 bg-white/40 p-2 shadow-sm backdrop-blur-sm">
            <p className="text-xs text-stone-600">Current Turn</p>
            <h2 className="truncate text-base font-bold">{currentPlayer?.name ?? "No player"}</h2>
            {currentPlayer?.skipActionThisTurn ? (
              <p className="mt-2 rounded-md bg-amber-100/45 px-2 py-1 text-xs font-medium text-amber-900">
                Rush Job: no action card.
              </p>
            ) : null}
            {hasUnpopularJudgeAtFront(state) ? (
              <p className="mt-2 rounded-md bg-red-100/45 px-2 py-1 text-xs font-medium text-red-900">
                Unpopular Judge blocks actions.
              </p>
            ) : null}
            {state.turnEffects.endDayAfterTurn ? (
              <p className="mt-2 rounded-md bg-red-100/45 px-2 py-1 text-xs font-medium text-red-900">
                Day ends after this turn.
              </p>
            ) : null}
            {selectedAction ? (
              <p className="mt-2 rounded-md bg-amber-100/45 px-2 py-1 text-xs text-amber-900">
                Targeting {selectedAction.card.name}.
              </p>
            ) : null}
          </div>
        </div>
        <PlayerPanel
          players={playerPanelPlayers}
          currentPlayerId={currentPlayer?.id}
          playerTargets={
            pendingClownChoiceForCurrentPlayer
              ? clownGiftPlayerTargets
              : isLackOfSupportAction
              ? lackOfSupportPlayerTargets
              : validTargets.filter((target) => target.target.type === "player")
          }
          onSelectPlayer={setSelectedDetailsPlayerId}
          onSelectPlayerTarget={(target) => {
            if (pendingClownChoiceForCurrentPlayer && currentPlayer && target.type === "player") {
              void resolveClownGift(currentPlayer.id, target.playerId);
              return;
            }

            if (isLackOfSupportAction && target.type === "player") {
              setSelectedPrivateTargetPlayerId(target.playerId);
              return;
            }

            if (selectedAction) {
              playAction(selectedAction.instanceId, target);
            }
          }}
        />
      </div>

      {pendingClownChoiceForCurrentPlayer && currentPlayer ? (
        <div className="rounded-md border border-amber-400 bg-amber-50/45 p-3 text-sm text-amber-950 backdrop-blur-sm">
          <span className="font-semibold">The Clown:</span> {currentPlayer.name}, choose another player in the Players panel to receive The Clown.
        </div>
      ) : null}

      <div className="relative z-20">
        <NobleLine
          hiddenNobleCardIds={hiddenNobleLineCardIds}
          isShuffling={isLineShuffling}
          nobles={displayedNobles}
          reorderDraftIds={reorderDraftIds}
          selectedActionEffectKey={selectedAction?.card.effectKey}
          selectedNobleTargetId={selectedNobleTargetId}
          validTargets={validTargets}
          onPlayTarget={(target) => selectedAction && playAction(selectedAction.instanceId, target)}
          onPreviewCard={setPreviewCard}
          onReorderDraftChange={setReorderDraftIds}
          onSelectNobleTarget={setSelectedNobleTargetId}
        />
      </div>

      <div className="relative z-10">
        <ActionHand
          canPlayActions={canPlayActions}
          player={currentPlayer}
          selectedActionCardId={selectedActionCardId}
          validTargets={validTargets}
          canPlayActionCard={canPlayActionCard}
          getActionBlockedReason={getActionBlockedReason}
          reorderDraftIds={reorderDraftIds}
          onSelectAction={(cardId) => {
            setSelectedActionCardId(cardId);
            setSelectedNobleTargetId(undefined);
            setSelectedPrivateTargetPlayerId(undefined);
            setReorderDraftIds([]);
          }}
          onClearSelection={() => {
            setSelectedActionCardId(undefined);
            setSelectedNobleTargetId(undefined);
            setSelectedPrivateTargetPlayerId(undefined);
            setReorderDraftIds([]);
          }}
          onPlayAction={playAction}
          onPreviewCard={setPreviewCard}
          selectedPrivateTargetPlayerId={selectedPrivateTargetPlayerId}
          canEndTurn={canUseEnterToEndTurn}
          canTakeNoble={canUseEnterToTakeNoble}
          currentPlayerId={currentPlayer?.id}
          onEndTurn={endTurn}
          onTakeNoble={takeNoble}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[5fr_3fr]">
        <CollectedNobles
          canDiscardCallousGuards={
            state.phase === "playing" &&
            state.turnStep === "playActionOptional" &&
            Boolean(currentPlayer) &&
            !currentPlayer?.skipActionThisTurn
          }
          player={currentPlayer}
          onCollectionAreaReady={setCollectionAreaElement}
          onDiscardCallousGuards={discardCallousGuards}
          onPreviewCard={setPreviewCard}
        />
        <GameHistory log={state.log} />
      </div>
      <ActionDiscardPile cards={state.actionDeck.discardPile} onPreviewCard={setPreviewCard} />
      {flyingNoble ? (
        <img
          alt={flyingNoble.name}
          className="pointer-events-none fixed z-[80] rounded-md border border-stone-300 object-cover shadow-2xl transition-[opacity,transform] duration-1000 ease-in-out"
          draggable={false}
          src={flyingNoble.imagePath}
          style={{
            height: flyingNoble.style.height,
            left: flyingNoble.style.left,
            opacity: flyingNoble.style.opacity,
            top: flyingNoble.style.top,
            transform: `translate(${flyingNoble.style.x}px, ${flyingNoble.style.y}px)`,
            width: flyingNoble.style.width,
          }}
        />
      ) : null}
      <PlayerDetailsModal
        canDiscardCallousGuards={
          state.phase === "playing" &&
          state.turnStep === "playActionOptional" &&
          Boolean(currentPlayer) &&
          !currentPlayer?.skipActionThisTurn
        }
        currentPlayerId={currentPlayer?.id}
        onClose={() => setSelectedDetailsPlayerId(undefined)}
        onDiscardCallousGuards={discardCallousGuards}
        onPlayAction={playAction}
        onPreviewCard={setPreviewCard}
        player={detailsPlayer}
        selectedActionCardId={selectedActionCardId}
        validTargets={validTargets}
      />
      <CardPreviewModal card={previewCard} onClose={() => setPreviewCard(undefined)} />
      </div>
      {isPassOverlayVisible ? (
        <PassTurnScreen
          briefingItems={passScreenBriefingItems}
          canStartTurn={state.passScreen.visible && !pendingEndTurnPlayerId}
          nextPlayer={passScreenPlayer}
          onCovered={commitPendingEndTurn}
          onReady={readyForTurn}
        />
      ) : null}
    </section>
  );

  async function animateNobleToElement(
    noble: CardInstance,
    targetElement: HTMLElement | null,
    options: {
      fadeAway?: boolean;
      hideLineSource?: boolean;
      targetOffset?: (sourceRect: DOMRect, targetRect: DOMRect) => { x: number; y: number };
    } = {},
  ) {
    const sourceElement =
      document.querySelector<HTMLElement>(`[data-noble-card-id="${noble.instanceId}"] img`) ??
      document.querySelector<HTMLElement>(`[data-collected-noble-id="${noble.instanceId}"] img`);
    const fallbackSourceElement =
      document.querySelector<HTMLElement>(`[data-noble-card-id="${noble.instanceId}"]`) ??
      document.querySelector<HTMLElement>(`[data-collected-noble-id="${noble.instanceId}"]`);
    const sourceRect = (sourceElement ?? fallbackSourceElement)?.getBoundingClientRect();
    const targetRect = targetElement?.getBoundingClientRect();

    if (!sourceRect || !targetRect || !noble.card.imagePath) {
      await wait(120);
      return;
    }

    if (options.hideLineSource !== false) {
      setHiddenNobleLineCardIds((currentIds) =>
        currentIds.includes(noble.instanceId) ? currentIds : [...currentIds, noble.instanceId],
      );
    }

    const targetOffset = options.targetOffset?.(sourceRect, targetRect) ?? { x: 18, y: 54 };
    const targetX = targetRect.left + targetOffset.x - sourceRect.left;
    const targetY = targetRect.top + targetOffset.y - sourceRect.top;

    setFlyingNoble({
      imagePath: noble.card.imagePath,
      name: noble.card.name,
      style: {
        height: sourceRect.height,
        left: sourceRect.left,
        opacity: 1,
        top: sourceRect.top,
        width: sourceRect.width,
        x: 0,
        y: 0,
      },
    });

    await wait(30);
    setFlyingNoble({
      imagePath: noble.card.imagePath,
      name: noble.card.name,
      style: {
        height: sourceRect.height,
        left: sourceRect.left,
        opacity: 1,
        top: sourceRect.top,
        width: sourceRect.width,
        x: targetX,
        y: targetY,
      },
    });
    await wait(1020);

    if (options.fadeAway) {
      setFlyingNoble({
        imagePath: noble.card.imagePath,
        name: noble.card.name,
        style: {
          height: sourceRect.height,
          left: sourceRect.left,
          opacity: 0,
          top: sourceRect.top,
          width: sourceRect.width,
          x: targetX,
          y: targetY,
        },
      });
      await wait(280);
    }

    setFlyingNoble(undefined);
  }

  async function animateNobleToCollection(
    noble: CardInstance<NobleCard>,
    player: Player,
    alreadyAnimatedNobles: CardInstance<NobleCard>[] = [],
  ) {
    const existingSameColorCount = player.collectedNobles.filter(
      (collectedNoble) => collectedNoble.card.colorCategory === noble.card.colorCategory,
    ).length;
    const animatedSameColorCount = alreadyAnimatedNobles.filter(
      (animatedNoble) => animatedNoble.card.colorCategory === noble.card.colorCategory,
    ).length;
    const stackElement = document.querySelector<HTMLElement>(
      `[data-collected-card-stack="${player.id}-${noble.card.colorCategory}-0"]`,
    );

    if (!stackElement || existingSameColorCount === 0) {
      await animateNobleToElement(noble, collectionAreaElement);
      return;
    }

    await animateNobleToElement(noble, stackElement, {
      targetOffset: () => ({
        x: 0,
        y: (existingSameColorCount + animatedSameColorCount) * COLLECTED_STACK_OFFSET,
      }),
    });
  }
}

function applyReorderDraft<TCard extends { instanceId: CardInstanceId }>(cards: TCard[], reorderIds: CardInstanceId[]): TCard[] {
  if (reorderIds.length === 0) {
    return cards;
  }

  const reorderSet = new Set(reorderIds);
  const segmentById = new Map(cards.filter((card) => reorderSet.has(card.instanceId)).map((card) => [card.instanceId, card]));
  const reorderedSegment = reorderIds.flatMap((instanceId) => {
    const card = segmentById.get(instanceId);
    return card ? [card] : [];
  });

  if (reorderedSegment.length !== reorderIds.length) {
    return cards;
  }

  return [...reorderedSegment, ...cards.filter((card) => !reorderSet.has(card.instanceId))];
}

function haveSameIds(firstIds: CardInstanceId[], secondIds: CardInstanceId[]): boolean {
  return firstIds.length === secondIds.length && firstIds.every((instanceId, index) => instanceId === secondIds[index]);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function shuffleIds(ids: CardInstanceId[]): CardInstanceId[] {
  const shuffledIds = [...ids];

  for (let index = shuffledIds.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffledIds[index], shuffledIds[swapIndex]] = [shuffledIds[swapIndex], shuffledIds[index]];
  }

  return shuffledIds;
}

function getPrivateHandPlayerTargetsForPanel(validTargets: ValidActionTarget[]): ValidActionTarget[] {
  const players = new Map<string, string>();

  validTargets.forEach((target) => {
    if (target.target.type === "action-hand-card" && target.playerId && target.playerName) {
      players.set(target.playerId, target.playerName);
    }
  });

  return Array.from(players, ([playerId, playerName]) => ({
    target: {
      type: "player" as const,
      playerId,
    },
    label: `Inspect ${playerName}'s hand`,
    playerId,
    playerName,
  }));
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

function isLineMovementTarget(target: ActionTarget): boolean {
  return (
    (target.type === "move-noble" || target.type === "noble") &&
    "spaces" in target
  );
}

function getTargetNobleId(target: ActionTarget): CardInstanceId | undefined {
  if (target.type === "move-noble" || target.type === "noble") {
    return target.instanceId;
  }

  return undefined;
}

