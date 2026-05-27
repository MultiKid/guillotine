"use client";

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActionDiscardPile } from "@/components/game/ActionDiscardPile";
import { CollectedNobleStacks, InFrontActionStack } from "@/components/game/CollectedNobleStacks";
import { GameEndScreen } from "@/components/game/GameEndScreen";
import { CardPreviewModal } from "@/components/ui/CardPreviewModal";
import { Card } from "@/components/ui/Card";
import { CardImage } from "@/components/ui/CardImage";
import { actionDefinitions } from "@/lib/cards/actions";
import { getNobleColorStyle, selectedNobleColorStyle } from "@/lib/cards/nobleColors";
import type { PlayerGameView, PublicPlayerView } from "@/lib/game/playerView";
import type { ActionCard, ActionTarget, BaseCard, CardInstance, CardInstanceId, NobleCard } from "@/lib/game/types";
import type { ValidActionTarget } from "@/lib/game/effects";
import type { MutableRefObject } from "react";
import type { OnlineRoomSnapshot } from "@/lib/online/lobbyTypes";

type OnlineGameReadOnlyProps = {
  error?: string;
  isBusy?: boolean;
  onDiscardCallousGuards: (cardId: CardInstanceId) => void;
  onPlayAction: (cardId: CardInstanceId, target?: ActionTarget) => void;
  onResolveClericalErrorReturn: (nobleId?: CardInstanceId) => void;
  onResolveClownGift: (targetPlayerId: string) => void;
  onResolveInfighting: (cardIds: CardInstanceId[]) => void;
  onResolveInnocentVictimDiscard: (cardId?: CardInstanceId) => void;
  onResolveLoyalGuards: (useProtection: boolean) => void;
  onReloadTestHand: () => void;
  onRequestUndo: () => void;
  onRespondToUndoRequest: (requestId: string, approve: boolean) => void;
  onTakeFrontNoble: (pendingReorder?: { cardId: CardInstanceId; reorderedNobleIds: CardInstanceId[] }) => void;
  onDismissRoomAlert?: () => void;
  room?: OnlineRoomSnapshot;
  roomAlert?: string;
  view: PlayerGameView;
};

type OnlineActionTargetChoice = ValidActionTarget;

type OnlineActionFlashState = {
  card: ActionCard;
  id: string;
  isVisible: boolean;
  rect: DOMRect;
};

type OnlineScorePulseState = {
  delta: number;
  holdPreviousScore: boolean;
  id: string;
  isVisible: boolean;
  playerId: string;
  previousScore: number;
};

type OnlineToastState = {
  id: string;
  isVisible: boolean;
  message: string;
};

const BACKGROUND_TRANSITION_DURATION_MS = 1400;
const ONLINE_TOAST_MIN_VISIBLE_MS = 3000;
const ONLINE_TOAST_MAX_VISIBLE_MS = 8000;
const ONLINE_TOAST_SLIDE_MS = 300;

export function OnlineGameReadOnly({
  error,
  isBusy = false,
  onDiscardCallousGuards,
  onPlayAction,
  onResolveClericalErrorReturn,
  onResolveClownGift,
  onResolveInfighting,
  onResolveInnocentVictimDiscard,
  onResolveLoyalGuards,
  onReloadTestHand,
  onRequestUndo,
  onRespondToUndoRequest,
  onTakeFrontNoble,
  onDismissRoomAlert,
  room,
  roomAlert,
  view,
}: OnlineGameReadOnlyProps) {
  const [selectedActionId, setSelectedActionId] = useState<CardInstanceId | undefined>();
  const [selectedHandTargetPlayerId, setSelectedHandTargetPlayerId] = useState<string | undefined>();
  const [selectedNobleTargetId, setSelectedNobleTargetId] = useState<CardInstanceId | undefined>();
  const [reorderDraftIds, setReorderDraftIds] = useState<CardInstanceId[]>([]);
  const [selectedDetailsPlayerId, setSelectedDetailsPlayerId] = useState<string | undefined>();
  const [previewCard, setPreviewCard] = useState<BaseCard | undefined>();
  const previousViewRef = useRef<PlayerGameView | undefined>(undefined);
  const [flashingAction, setFlashingAction] = useState<OnlineActionFlashState | undefined>();
  const [scorePulse, setScorePulse] = useState<OnlineScorePulseState | undefined>();
  const [activeToast, setActiveToast] = useState<OnlineToastState | undefined>();
  const [toastQueue, setToastQueue] = useState<OnlineToastState[]>([]);
  const toastQueueLengthRef = useRef(0);
  const toastTimerIdsRef = useRef<number[]>([]);
  const displayedBackgroundNobleCountRef = useRef(clampBackgroundNobleCount(view.nobleLine.length || 12));
  const previousBackgroundTurnRef = useRef<{ currentPlayerId?: string; day: number; turnStep: string } | undefined>(undefined);
  const backgroundTransitionTimeoutRef = useRef<number[]>([]);
  const enterKeyIsDownRef = useRef(false);
  const testHandChordKeysRef = useRef(new Set<string>());
  const testHandChordArmedRef = useRef(true);
  const wasViewerTurnRef = useRef(view.phase === "playing" && view.isViewerTurn);
  const currentPlayer = view.players.find((player) => player.id === view.currentPlayerId);
  const selectedDetailsPlayer = view.players.find((player) => player.id === selectedDetailsPlayerId);
  const visibleHistoryLog = view.log.filter((entry) => !isTestHandReloadMessage(entry.message));
  const pendingScorePulse = scorePulse ? undefined : getPendingOpponentScorePulse(view, previousViewRef.current);
  const displayedScorePulse = scorePulse ?? pendingScorePulse;
  const canTakeFrontNoble =
    view.phase === "playing" && view.isViewerTurn && view.turnStep !== "turnComplete" && view.nobleLine.length > 0 && !isBusy;
  const rushJobBlocksViewer = Boolean(view.viewer?.skipActionThisTurn || view.viewer?.skipNextActionTurn);
  const canPlayAction =
    view.phase === "playing" &&
    view.isViewerTurn &&
    view.turnStep === "playActionOptional" &&
    !view.pendingChoice &&
    !rushJobBlocksViewer &&
    !isBusy;
  const selectedAction = view.viewer?.hand.find((action) => action.instanceId === selectedActionId);
  const isReorderAction = selectedAction?.card.effectKey === "opinionatedGuards";
  const selectedActionTargets = selectedAction ? view.viewer?.validActionTargetsByCardId[selectedAction.instanceId] ?? [] : [];
  const movementTargets = useMemo(
    () => selectedActionTargets.filter(isOnlineLineMovementTarget),
    [selectedActionTargets],
  );
  const selectedLandingTargets = useMemo(
    () =>
      selectedNobleTargetId
        ? movementTargets.filter((target) => getTargetNobleId(target.target) === selectedNobleTargetId)
        : [],
    [movementTargets, selectedNobleTargetId],
  );
  const legalReorderIds = isReorderAction ? getLegalReorderIds(selectedActionTargets) : [];
  const targetChoicesByNobleId = useMemo(
    () =>
      selectedActionTargets.length > 0 && !isReorderAction
        ? getTargetChoicesByNobleId(selectedActionTargets.filter((target) => !isOnlineLineMovementTarget(target)))
        : new Map<CardInstanceId, OnlineActionTargetChoice[]>(),
    [isReorderAction, selectedActionTargets],
  );
  const targetChoicesByPlayerId = useMemo(
    () => selectedActionTargets.length > 0 ? getTargetChoicesByPlayerId(selectedActionTargets) : new Map<string, OnlineActionTargetChoice[]>(),
    [selectedActionTargets],
  );
  const handTargetChoicesByPlayerId = useMemo(
    () => selectedActionTargets.length > 0 ? getHandTargetChoicesByPlayerId(selectedActionTargets) : new Map<string, OnlineActionTargetChoice[]>(),
    [selectedActionTargets],
  );
  const collectedNobleTargetChoicesByPlayerId = useMemo(
    () => selectedActionTargets.length > 0 ? getCollectedNobleTargetChoicesByPlayerId(selectedActionTargets) : new Map<string, OnlineActionTargetChoice[]>(),
    [selectedActionTargets],
  );
  const nobleDeckTargetChoices = useMemo(
    () => selectedActionTargets.filter((target) => target.target.type === "noble-deck-card"),
    [selectedActionTargets],
  );
  const actionDiscardTargetChoices = useMemo(
    () => selectedActionTargets.filter((target) => target.target.type === "action-discard-card"),
    [selectedActionTargets],
  );
  const inFrontTargetChoices = useMemo(
    () => selectedActionTargets.filter((target) => target.target.type === "in-front-action"),
    [selectedActionTargets],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();

      if (isEditableElement(event.target)) {
        return;
      }

      if (key === "q" || key === "w" || key === "e") {
        testHandChordKeysRef.current.add(key);

        if (
          testHandChordArmedRef.current &&
          testHandChordKeysRef.current.has("q") &&
          testHandChordKeysRef.current.has("w") &&
          testHandChordKeysRef.current.has("e")
        ) {
          testHandChordArmedRef.current = false;
          event.preventDefault();
          reloadTestHandFromKeyboard();
        }

        return;
      }

      if (event.key === "Enter" && !enterKeyIsDownRef.current && !event.repeat) {
        enterKeyIsDownRef.current = true;
        void handleEnterShortcut();
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      const key = event.key.toLowerCase();

      if (key === "q" || key === "w" || key === "e") {
        testHandChordKeysRef.current.delete(key);

        if (testHandChordKeysRef.current.size === 0) {
          testHandChordArmedRef.current = true;
        }
      }

      if (event.key === "Enter") {
        enterKeyIsDownRef.current = false;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  });

  function reloadTestHandFromKeyboard() {
    if (isBusy || view.phase !== "playing") {
      return;
    }

    onReloadTestHand();
  }

  useLayoutEffect(() => {
    setSelectedHandTargetPlayerId(undefined);
    setSelectedNobleTargetId(undefined);
  }, [selectedActionId]);

  useEffect(() => {
    for (let count = 1; count <= 13; count += 1) {
      const image = new Image();
      image.src = `/backgrounds/day-cycle/day-${String(count).padStart(2, "0")}.png`;
    }
    const nightImage = new Image();
    nightImage.src = "/backgrounds/day-cycle/day-night.png";

    return () => {
      clearBackgroundTransitionTimeouts(backgroundTransitionTimeoutRef);
    };
  }, []);

  useEffect(() => {
    if (view.phase !== "playing") {
      return;
    }

    const previousTurn = previousBackgroundTurnRef.current;
    const currentTurn = { currentPlayerId: view.currentPlayerId, day: view.day, turnStep: view.turnStep };
    previousBackgroundTurnRef.current = currentTurn;

    if (!previousTurn) {
      displayedBackgroundNobleCountRef.current = clampBackgroundNobleCount(view.nobleLine.length || 12);
      setGameBackgroundImage(displayedBackgroundNobleCountRef.current);
      return;
    }

    const justAdvancedTurn =
      view.turnStep === "playActionOptional" &&
      (previousTurn.turnStep === "turnComplete" || previousTurn.currentPlayerId !== view.currentPlayerId);
    const justAdvancedDay = view.day > (previousTurn.day ?? view.day);
    const nextCount = clampBackgroundNobleCount(view.nobleLine.length);

    if (justAdvancedDay) {
      displayedBackgroundNobleCountRef.current = nextCount;
      transitionGameBackgroundThroughNight(nextCount, backgroundTransitionTimeoutRef);
      return;
    }

    if (justAdvancedTurn && nextCount !== displayedBackgroundNobleCountRef.current) {
      displayedBackgroundNobleCountRef.current = nextCount;
      transitionGameBackground(nextCount, backgroundTransitionTimeoutRef);
    }
  }, [view.currentPlayerId, view.nobleLine.length, view.phase, view.turnStep]);

  useEffect(() => {
    const isViewerOfficialTurn =
      view.phase === "playing" &&
      view.isViewerTurn &&
      view.turnStep === "playActionOptional" &&
      !view.pendingChoice;
    const wasViewerOfficialTurn = wasViewerTurnRef.current;
    wasViewerTurnRef.current = isViewerOfficialTurn;

    if (!wasViewerOfficialTurn && isViewerOfficialTurn) {
      void playYourTurnNotificationSound();
    }
  }, [view.currentPlayerId, view.isViewerTurn, view.pendingChoice, view.phase, view.turnStep]);

  useEffect(() => {
    if (!isReorderAction) {
      setReorderDraftIds([]);
      return;
    }

    setReorderDraftIds((currentIds) => (haveSameIds(currentIds, legalReorderIds) ? currentIds : legalReorderIds));
  }, [isReorderAction, legalReorderIds.join("|")]);

  useEffect(() => {
    toastQueueLengthRef.current = toastQueue.length;
  }, [toastQueue.length]);

  useEffect(() => {
    if (activeToast || toastQueue.length === 0) {
      return;
    }

    const [nextToast, ...remainingToasts] = toastQueue;

    if (!nextToast) {
      return;
    }

    setToastQueue(remainingToasts);
    setActiveToast(nextToast);

    const showTimeoutId = window.setTimeout(() => {
      setActiveToast((currentToast) => (currentToast?.id === nextToast.id ? { ...currentToast, isVisible: true } : currentToast));
    }, 30);
    let clearTimeoutId: number | undefined;
    let maxHideTimeoutId: number | undefined;

    function hideAndClearToast() {
      setActiveToast((currentToast) => (currentToast?.id === nextToast.id ? { ...currentToast, isVisible: false } : currentToast));
      clearTimeoutId = window.setTimeout(() => {
        setActiveToast((currentToast) => (currentToast?.id === nextToast.id ? undefined : currentToast));
      }, ONLINE_TOAST_SLIDE_MS + 80);
      toastTimerIdsRef.current.push(clearTimeoutId);
    }

    const minHideTimeoutId = window.setTimeout(() => {
      if (toastQueueLengthRef.current > 0) {
        hideAndClearToast();
      } else {
        maxHideTimeoutId = window.setTimeout(hideAndClearToast, ONLINE_TOAST_MAX_VISIBLE_MS - ONLINE_TOAST_MIN_VISIBLE_MS);
        toastTimerIdsRef.current.push(maxHideTimeoutId);
      }
    }, ONLINE_TOAST_MIN_VISIBLE_MS);

    toastTimerIdsRef.current.push(showTimeoutId, minHideTimeoutId);
  }, [activeToast, toastQueue.length]);

  useEffect(() => {
    return () => {
      toastTimerIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      toastTimerIdsRef.current = [];
    };
  }, []);

  useLayoutEffect(() => {
    const previousView = previousViewRef.current;

    if (!previousView) {
      previousViewRef.current = view;
      return;
    }

    const newEntries = view.log.filter((entry) => !previousView.log.some((previousEntry) => previousEntry.id === entry.id));
    const newSpectatorToasts = newEntries
      .filter((entry) => shouldShowOnlineToastForEntry(entry, view.viewerPlayerId))
      .reverse()
      .map((entry) => ({
        id: `${entry.id}-toast`,
        isVisible: false,
        message: formatOnlineToastMessage(entry.message),
      }));

    if (newSpectatorToasts.length > 0) {
      setToastQueue((currentQueue) => [...currentQueue, ...newSpectatorToasts]);
    }

    if (!view.isViewerTurn && view.currentPlayerId) {
      const actingPlayerId = view.currentPlayerId;

      for (const entry of newEntries) {
        if (entry.playerId !== actingPlayerId) {
          continue;
        }

        const actionName = getPlayedActionName(entry.message, currentPlayer?.name ?? "");
        const actionCard = actionName ? findVisibleActionCardByName(view, actionName) : undefined;

        if (!actionCard) {
          continue;
        }

        const playerElement = document.querySelector<HTMLElement>(`[data-online-player-id="${actingPlayerId}"]`);
        const rect = playerElement?.getBoundingClientRect();

        if (!rect) {
          continue;
        }

        const id = `${entry.id}-action-flash`;
        setFlashingAction({ card: actionCard, id, isVisible: false, rect });
        window.setTimeout(() => {
          setFlashingAction((current) => (current?.id === id ? { ...current, isVisible: true } : current));
        }, 30);
        window.setTimeout(() => {
          setFlashingAction((current) => (current?.id === id ? { ...current, isVisible: false } : current));
        }, 2100);
        window.setTimeout(() => {
          setFlashingAction((current) => (current?.id === id ? undefined : current));
        }, 3000);
      }

      const previousFrontNoble = previousView.nobleLine[0];
      const currentFrontNoble = view.nobleLine[0];
      const frontNobleLeftLine = previousFrontNoble && previousFrontNoble.instanceId !== currentFrontNoble?.instanceId;
      const previousActor = previousView.players.find((player) => player.id === actingPlayerId);
      const nextActor = view.players.find((player) => player.id === actingPlayerId);
      const actorCollectedFrontNoble =
        previousFrontNoble &&
        nextActor?.collectedNobles.some((noble) => noble.instanceId === previousFrontNoble.instanceId) &&
        !previousActor?.collectedNobles.some((noble) => noble.instanceId === previousFrontNoble.instanceId);

      if (frontNobleLeftLine && previousFrontNoble && actorCollectedFrontNoble) {
        const delta = (nextActor?.score ?? 0) - (previousActor?.score ?? 0);

        if (delta !== 0 && previousActor) {
          const id = `${previousFrontNoble.instanceId}-score-pulse-${view.log[0]?.id ?? Date.now()}`;
          setScorePulse({
            delta,
            holdPreviousScore: true,
            id,
            isVisible: false,
            playerId: actingPlayerId,
            previousScore: previousActor.score,
          });
          window.setTimeout(() => {
            setScorePulse((current) => (current?.id === id ? { ...current, isVisible: true } : current));
          }, 30);
          window.setTimeout(() => {
            setScorePulse((current) => (current?.id === id ? { ...current, isVisible: false } : current));
          }, 1100);
          window.setTimeout(() => {
            setScorePulse((current) => (current?.id === id ? undefined : current));
          }, 1850);
        }
      }
    }

    previousViewRef.current = view;
  }, [currentPlayer?.name, view]);

  if (view.phase === "gameEnd") {
    return <GameEndScreen players={view.players} winnerIds={view.winnerIds} />;
  }

  function handleEnterShortcut() {
    if (roomAlert || previewCard || selectedDetailsPlayerId || isBusy || view.phase !== "playing" || view.pendingChoice) {
      return;
    }

    const singleTarget = getSingleEnterActionTarget();

    if (selectedAction && singleTarget && canPlayAction) {
      onPlayAction(selectedAction.instanceId, singleTarget);
      setSelectedActionId(undefined);
      setSelectedHandTargetPlayerId(undefined);
      setSelectedNobleTargetId(undefined);
      return;
    }

    if (canTakeFrontNoble) {
      takeFrontNobleFromControls();
    }
  }

  function getSingleEnterActionTarget(): ActionTarget | undefined {
    if (!selectedAction || isReorderAction) {
      return undefined;
    }

    if (movementTargets.length > 0) {
      const targetsForSelectedNoble = selectedNobleTargetId
        ? movementTargets.filter((target) => getTargetNobleId(target.target) === selectedNobleTargetId)
        : movementTargets;

      return targetsForSelectedNoble.length === 1 ? targetsForSelectedNoble[0]?.target : undefined;
    }

    if (selectedHandTargetPlayerId) {
      const handTargets = handTargetChoicesByPlayerId.get(selectedHandTargetPlayerId) ?? [];
      return handTargets.length === 1 ? handTargets[0]?.target : undefined;
    }

    return selectedActionTargets.length === 1 ? selectedActionTargets[0]?.target : undefined;
  }

  function takeFrontNobleFromControls() {
    if (isReorderAction && selectedAction && reorderDraftIds.length > 0) {
      onTakeFrontNoble({
        cardId: selectedAction.instanceId,
        reorderedNobleIds: reorderDraftIds,
      });
      setSelectedActionId(undefined);
      setSelectedNobleTargetId(undefined);
      setReorderDraftIds([]);
      return;
    }

    onTakeFrontNoble();
  }

  return (
    <div className="flex flex-col gap-4">
      {room?.roomName ? (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 text-center text-3xl font-bold text-stone-950">
          {room.roomName}
        </div>
      ) : null}
      {room?.undoRequest && room.undoRequest.requesterId !== view.viewerPlayerId ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-stone-950/35 p-4">
          <div className="max-w-md rounded-lg border border-amber-300 bg-white/80 p-5 text-center shadow-xl backdrop-blur-sm">
            <h2 className="text-lg font-bold text-stone-950">Undo Request</h2>
            <p className="mt-2 text-sm text-stone-700">
              {room.undoRequest.requesterName} asked to undo the last thing that happened. Allow the undo?
            </p>
            {room.undoRequest.approvedPlayerIds.includes(view.viewerPlayerId) ? (
              <p className="mt-4 rounded-md border border-green-300 bg-green-50/70 px-3 py-2 text-sm font-semibold text-green-900">
                You approved this undo. Waiting for the other players.
              </p>
            ) : (
              <div className="mt-4 flex justify-center gap-2">
                <button
                  className="rounded-md border border-green-700 bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
                  disabled={isBusy}
                  onClick={() => onRespondToUndoRequest(room.undoRequest?.id ?? "", true)}
                  type="button"
                >
                  Yes
                </button>
                <button
                  className="rounded-md border border-stone-400 bg-white/70 px-4 py-2 text-sm font-semibold text-stone-900 transition hover:bg-white"
                  disabled={isBusy}
                  onClick={() => onRespondToUndoRequest(room.undoRequest?.id ?? "", false)}
                  type="button"
                >
                  No
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
      {room?.undoRequest && room.undoRequest.requesterId === view.viewerPlayerId ? (
        <div className="rounded-md border border-amber-300 bg-amber-50/55 px-3 py-2 text-sm text-amber-950 backdrop-blur-sm">
          Waiting for the other players to approve your undo request.
        </div>
      ) : null}
      {roomAlert ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-stone-950/35 p-4">
          <div className="max-w-md rounded-lg border border-amber-300 bg-white/75 p-5 text-center shadow-xl backdrop-blur-sm">
            <h2 className="text-lg font-bold text-stone-950">Player Left</h2>
            <p className="mt-2 text-sm text-stone-700">{roomAlert}</p>
            <button
              className="mt-4 rounded-md border border-stone-300 bg-white/70 px-4 py-2 text-sm font-semibold text-stone-900 transition hover:bg-white"
              onClick={onDismissRoomAlert}
              type="button"
            >
              OK
            </button>
          </div>
        </div>
      ) : null}
      {view.pendingChoice?.type === "infighting" && view.pendingChoice.targetPlayerId === view.viewerPlayerId ? (
        <OnlineInfightingChoice
          isBusy={isBusy}
          playerName={view.viewer?.name ?? "You"}
          hand={view.viewer?.hand ?? []}
          onConfirm={onResolveInfighting}
        />
      ) : null}
      {view.pendingChoice?.type === "clericalErrorReturn" && view.pendingChoice.targetPlayerId === view.viewerPlayerId ? (
        <OnlineClericalErrorReturnChoice
          isBusy={isBusy}
          originalPlayer={view.players.find((player) => player.id === view.pendingChoice?.originalPlayerId)}
          targetPlayerName={view.viewer?.name ?? "You"}
          excludedNobleInstanceId={view.pendingChoice.excludedNobleInstanceId}
          onConfirm={onResolveClericalErrorReturn}
        />
      ) : null}
      {view.pendingChoice?.type === "innocentVictimDiscard" && view.pendingChoice.targetPlayerId === view.viewerPlayerId ? (
        <OnlineInnocentVictimDiscardChoice
          hand={view.viewer?.hand ?? []}
          isBusy={isBusy}
          onConfirm={onResolveInnocentVictimDiscard}
          playerName={view.viewer?.name ?? "You"}
        />
      ) : null}
      {view.pendingChoice?.type === "loyalGuards" && view.pendingChoice.targetPlayerId === view.viewerPlayerId ? (
        <OnlineLoyalGuardsChoice
          actionName={view.pendingChoice.source.type === "action" ? view.pendingChoice.source.actionCard.card.name : "The Clown"}
          isBusy={isBusy}
          originalPlayerName={getPlayerName(view, view.pendingChoice.originalPlayerId)}
          playerName={view.viewer?.name ?? "You"}
          onConfirm={onResolveLoyalGuards}
        />
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.6fr)]">
        <Card className="min-h-[13rem]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">Online Game</p>
              <h2 className="text-xl font-bold">
                {view.isViewerTurn ? "Your turn" : `${currentPlayer?.name ?? "A player"}'s turn`}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2 text-sm font-semibold text-stone-700">
              <span className="rounded-full bg-white/45 px-3 py-1">Day {view.day} / {view.maxDays}</span>
            </div>
          </div>
          <div className="mt-3">
            {!view.isViewerTurn ? (
              <p className="text-sm text-stone-700">Waiting for {currentPlayer?.name ?? "the current player"}.</p>
            ) : null}
            {error ? <p className="text-sm font-medium text-red-800">{error}</p> : null}
          </div>
        </Card>

        <Card className="min-h-[13rem]">
          <h3 className="text-lg font-semibold">Players</h3>
        {view.pendingChoice?.type === "clownGift" && view.pendingChoice.targetPlayerId === view.viewerPlayerId ? (
          <p className="mt-1 text-sm font-medium text-amber-950">
            The Clown: choose another player to receive The Clown.
          </p>
        ) : null}
        {selectedAction && (targetChoicesByPlayerId.size > 0 || handTargetChoicesByPlayerId.size > 0) ? (
          <p className="mt-1 text-sm font-medium text-amber-950">
            Choose which player is affected by {selectedAction.card.name}.
          </p>
        ) : null}
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {view.players.map((player) => {
            const playerTargetChoices = targetChoicesByPlayerId.get(player.id) ?? [];
            const handTargetChoices = handTargetChoicesByPlayerId.get(player.id) ?? [];
            const collectedNobleTargetChoices = collectedNobleTargetChoicesByPlayerId.get(player.id) ?? [];
            const isHandTargetPlayer = handTargetChoices.length > 0;
            const isCollectedNobleTargetPlayer = collectedNobleTargetChoices.length > 0;
            const isClownGiftTarget =
              view.pendingChoice?.type === "clownGift" &&
              view.pendingChoice.targetPlayerId === view.viewerPlayerId &&
              player.id !== view.viewerPlayerId;
            const isTargetablePlayer = playerTargetChoices.length > 0 || isHandTargetPlayer || isCollectedNobleTargetPlayer || isClownGiftTarget;
            const isSelectedHandTargetPlayer = selectedHandTargetPlayerId === player.id;
            const directPlayerTargetChoice = playerTargetChoices[0];
            const isDisconnected = room?.players.find((roomPlayer) => roomPlayer.id === player.id)?.isConnected === false;
            const isActiveTurnPlayer = player.id === view.currentPlayerId;
            const canOpenPlayerDetails = !isTargetablePlayer && player.id !== view.viewerPlayerId;

            function handlePlayerTileClick() {
              if (isBusy) {
                return;
              }

              if (isClownGiftTarget) {
                onResolveClownGift(player.id);
                return;
              }

              if (selectedAction && directPlayerTargetChoice) {
                onPlayAction(selectedAction.instanceId, directPlayerTargetChoice.target);
                setSelectedActionId(undefined);
                return;
              }

              if (selectedAction && isHandTargetPlayer && !selectedHandTargetPlayerId) {
                setSelectedHandTargetPlayerId(player.id);
                return;
              }

              if (canOpenPlayerDetails) {
                setSelectedDetailsPlayerId(player.id);
              }
            }

            return (
              <div
                className={`rounded-md border p-2 text-left transition focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                  isTargetablePlayer || canOpenPlayerDetails ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md" : "cursor-default"
                } ${
                  isActiveTurnPlayer ? "ring-2 ring-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.24)]" : ""
                } ${
                  isTargetablePlayer
                    ? isSelectedHandTargetPlayer
                      ? "border-amber-600 bg-amber-200/70 shadow-sm"
                      : "border-amber-400 bg-amber-100/60 shadow-sm"
                    : isDisconnected
                      ? "border-red-600 bg-red-50/55 shadow-[0_0_0_1px_rgba(220,38,38,0.22)]"
                    : player.id === view.viewerPlayerId
                      ? "border-stone-900 bg-stone-100/45"
                      : "border-stone-300 bg-white/35"
                }`}
                key={player.id}
                data-online-player-id={player.id}
                role={isTargetablePlayer || canOpenPlayerDetails ? "button" : undefined}
                tabIndex={isTargetablePlayer || canOpenPlayerDetails ? 0 : undefined}
                onClick={handlePlayerTileClick}
                onKeyDown={(event) => {
                  if (!isTargetablePlayer && !canOpenPlayerDetails) {
                    return;
                  }

                  if (event.key !== "Enter" && event.key !== " ") {
                    return;
                  }

                  event.preventDefault();
                  handlePlayerTileClick();
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="truncate text-sm font-semibold">{player.name}</h4>
                  <span className="relative text-sm font-semibold">
                    {displayedScorePulse?.playerId === player.id && displayedScorePulse.holdPreviousScore ? displayedScorePulse.previousScore : player.score} pts
                    {displayedScorePulse?.playerId === player.id ? (
                      <span
                        className={`pointer-events-none absolute right-0 top-0 whitespace-nowrap text-sm font-bold transition-all duration-700 ${
                          displayedScorePulse.delta >= 0 ? "text-green-700" : "text-red-700"
                        }`}
                        style={{
                          opacity: displayedScorePulse.isVisible ? 1 : 0,
                          transform: displayedScorePulse.isVisible ? "translateY(-1.1rem)" : "translateY(0)",
                        }}
                      >
                        {displayedScorePulse.delta > 0 ? "+" : ""}
                        {displayedScorePulse.delta}
                      </span>
                    ) : null}
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-600">
                  {player.handCount} hand, {player.collectedNobles.length} nobles, {player.inFrontActions.length} in front
                </p>
                {isSelectedHandTargetPlayer ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="rounded border border-amber-600 bg-amber-50/80 px-2 py-1 text-xs font-semibold text-amber-950">
                      Selected
                    </span>
                  </div>
                ) : null}
                {isCollectedNobleTargetPlayer ? (
                  <div className="mt-2 grid grid-cols-3 gap-1">
                    {collectedNobleTargetChoices.map((choice) => {
                      const noble = choice.revealedNoble;

                      if (!noble || !selectedAction) {
                        return null;
                      }

                      return (
                        <button
                          className={`rounded border p-1 text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${getNobleColorStyle(noble.card.colorCategory)}`}
                          disabled={isBusy}
                          key={noble.instanceId}
                          onClick={(event) => {
                            event.stopPropagation();
                            onPlayAction(selectedAction.instanceId, choice.target);
                            setSelectedActionId(undefined);
                          }}
                          title={`Take ${noble.card.name}`}
                          type="button"
                        >
                          <CardImage
                            alt={noble.card.name}
                            imageClassName="aspect-[5/7] border border-stone-200 object-cover shadow-sm"
                            imagePath={noble.card.imagePath}
                          >
                            <div className="rounded bg-white/60 p-1 text-[10px] font-semibold leading-tight">{noble.card.name}</div>
                          </CardImage>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Noble Line</h3>
          <span className="text-sm text-stone-600">Front noble is on the left</span>
        </div>
        <OnlineNobleLine
          isBusy={isBusy}
          isReorderMode={isReorderAction}
          legalReorderIds={legalReorderIds}
          movementTargets={movementTargets}
          nobles={view.nobleLine}
          reorderDraftIds={reorderDraftIds}
          selectedAction={selectedAction}
          selectedNobleTargetId={selectedNobleTargetId}
          selectedLandingTargets={selectedLandingTargets}
          targetChoicesByNobleId={targetChoicesByNobleId}
          onPlayAction={(target) => {
            if (!selectedAction) {
              return;
            }

            onPlayAction(selectedAction.instanceId, target);
            setSelectedActionId(undefined);
            setSelectedNobleTargetId(undefined);
          }}
          onPreviewCard={(card) => setPreviewCard(card)}
          onReorderDraftChange={setReorderDraftIds}
          onSelectNobleTarget={setSelectedNobleTargetId}
        />
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Your Hand</h3>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <p className="text-sm text-stone-600">
              {rushJobBlocksViewer
                ? "Rush Job: you cannot play an action card this turn."
                : canPlayAction
                  ? "You may play one action card before taking a noble."
                  : "Only your device receives these cards."}
            </p>
            <button
              className="rounded-md border border-stone-300 bg-white/55 px-3 py-2 text-sm font-semibold text-stone-900 shadow-sm transition hover:bg-white/75 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canTakeFrontNoble}
              onClick={takeFrontNobleFromControls}
              type="button"
            >
              {isBusy ? "Working..." : "Take Front Noble"}
            </button>
            <button
              className="rounded-md border border-amber-300 bg-amber-50/60 px-3 py-2 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100/70 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isBusy || Boolean(room?.undoRequest)}
              onClick={onRequestUndo}
              type="button"
            >
              Ask for Undo
            </button>
          </div>
        </div>
        {selectedAction ? (
          <div className="mt-3 rounded-md border border-amber-400 bg-amber-50/60 p-3 text-sm text-amber-950">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>
                Choose a target for <span className="font-semibold">{selectedAction.card.name}</span>
                {getSelectedActionTargetInstruction({
                  actionDiscardTargetChoices,
                  collectedNobleTargetChoicesByPlayerId,
                  handTargetChoicesByPlayerId,
                  inFrontTargetChoices,
                  nobleDeckTargetChoices,
                  targetChoicesByPlayerId,
                })}
              </p>
              <button
                className="rounded border border-stone-300 bg-white/55 px-2 py-1 text-xs font-semibold"
                onClick={() => {
                  setSelectedActionId(undefined);
                  setSelectedHandTargetPlayerId(undefined);
                  setSelectedNobleTargetId(undefined);
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
            {nobleDeckTargetChoices.length > 0 ? (
              <NobleDeckChoicePanel
                choices={nobleDeckTargetChoices}
                isBusy={isBusy}
                onChoose={(choice) => {
                  onPlayAction(selectedAction.instanceId, choice.target);
                  setSelectedActionId(undefined);
                }}
              />
            ) : null}
            {actionDiscardTargetChoices.length > 0 ? (
              <ActionCardChoicePanel
                choices={actionDiscardTargetChoices}
                emptyMessage="No action cards are available in the discard pile."
                isBusy={isBusy}
                stackedDiscardLayout
                title="Choose an action card from the discard pile"
                onChoose={(choice) => {
                  onPlayAction(selectedAction.instanceId, choice.target);
                  setSelectedActionId(undefined);
                }}
              />
            ) : null}
            {inFrontTargetChoices.length > 0 ? (
              <ActionCardChoicePanel
                choices={inFrontTargetChoices}
                emptyMessage="No action cards are in front of players."
                isBusy={isBusy}
                title="Choose a card in front of a player"
                onChoose={(choice) => {
                  onPlayAction(selectedAction.instanceId, choice.target);
                  setSelectedActionId(undefined);
                }}
              />
            ) : null}
            {handTargetChoicesByPlayerId.size > 0 ? (
              <ActionCardChoicePanel
                choices={selectedHandTargetPlayerId ? handTargetChoicesByPlayerId.get(selectedHandTargetPlayerId) ?? [] : []}
                emptyMessage="Choose a player from the Players box first."
                isBusy={isBusy}
                title={selectedHandTargetPlayerId ? `Choose a card from ${getPlayerName(view, selectedHandTargetPlayerId)}'s hand` : "Choose a player first"}
                compact
                onChoose={(choice) => {
                  onPlayAction(selectedAction.instanceId, choice.target);
                  setSelectedActionId(undefined);
                  setSelectedHandTargetPlayerId(undefined);
                }}
              />
            ) : null}
            {isReorderAction ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p className="mr-auto text-sm text-stone-700">
                  Drag highlighted nobles horizontally in the noble line. Confirm when the order looks right.
                </p>
                <button
                  className="rounded border border-amber-500 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isBusy || reorderDraftIds.length === 0}
                  onClick={() => {
                  onPlayAction(selectedAction.instanceId, { type: "reorder-nobles", instanceIds: reorderDraftIds });
                  setSelectedActionId(undefined);
                  setSelectedNobleTargetId(undefined);
                  setReorderDraftIds([]);
                  }}
                  type="button"
                >
                  Confirm Reorder
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="mt-3 grid gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {view.viewer?.hand.map((action) => (
            <div
              className="relative cursor-pointer rounded-md border border-amber-300 bg-amber-50/45 p-2 transition-transform duration-200 hover:z-20 hover:scale-[1.125] focus:outline-none focus:ring-2 focus:ring-amber-400"
              key={action.instanceId}
              role="button"
              tabIndex={0}
              onClick={() => setPreviewCard(action.card)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") {
                  return;
                }

                event.preventDefault();
                setPreviewCard(action.card);
              }}
            >
              <CardImage
                alt={action.card.name}
                imageClassName="aspect-[5/7] border border-amber-200 shadow-sm"
                imagePath={action.card.imagePath}
              >
                <div className="rounded-md bg-white/60 p-2">
                  <h4 className="text-sm font-semibold leading-tight">{action.card.name}</h4>
                  <p className="mt-1 text-xs text-stone-700">{action.card.description}</p>
                </div>
              </CardImage>
              <OnlineActionButton
                action={action}
                canPlayAction={canPlayAction}
                isBusy={isBusy}
                view={view}
                onPlayAction={onPlayAction}
                onSelectAction={setSelectedActionId}
              />
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">Collected Nobles</h3>
            <p className="text-sm font-semibold text-stone-700">{view.viewer?.score ?? 0} pts</p>
          </div>
          {view.viewer && (view.viewer.collectedNobles.length > 0 || view.viewer.inFrontActions.length > 0) ? (
            <div className="mt-3 min-h-[28rem] max-h-[42rem] overflow-auto pr-2">
              <div className="flex flex-wrap items-start gap-3">
                <CollectedNobleStacks
                  nobles={view.viewer.collectedNobles}
                  offset={43}
                  onPreviewCard={(card) => setPreviewCard(card)}
                  ownerPlayerId={view.viewer.id}
                />
                <InFrontActionStack
                  actions={view.viewer.inFrontActions}
                  canDiscardCallousGuards
                  offset={43}
                  onCardClick={(action) => setPreviewCard(action.card)}
                  onDiscardCallousGuards={onDiscardCallousGuards}
                />
              </div>
            </div>
          ) : (
            <p className="mt-3 min-h-[28rem] text-sm text-stone-600">No nobles collected yet.</p>
          )}
        </Card>

        <Card>
          <h3 className="text-lg font-semibold">History</h3>
          <div className="mt-3 max-h-[42rem] min-h-[28rem] overflow-auto pr-2 text-sm text-stone-700">
            {visibleHistoryLog.map((entry) => (
              <p className="mb-2" key={entry.id}>{entry.message}</p>
            ))}
          </div>
        </Card>
      </div>

      <ActionDiscardPile cards={view.actionDeck.discardPile} onPreviewCard={setPreviewCard} />
      {activeToast ? <OnlineBottomToast toast={activeToast} /> : null}
      <OnlinePlayerDetailsModal
        canDiscardCallousGuards={Boolean(selectedDetailsPlayer && selectedDetailsPlayer.id === view.viewerPlayerId)}
        isBusy={isBusy}
        player={selectedDetailsPlayer}
        onClose={() => setSelectedDetailsPlayerId(undefined)}
        onDiscardCallousGuards={onDiscardCallousGuards}
        onPreviewCard={setPreviewCard}
      />
      {flashingAction ? <OnlineActionFlash flash={flashingAction} /> : null}
      <CardPreviewModal card={previewCard} onClose={() => setPreviewCard(undefined)} />
    </div>
  );
}

function OnlineActionFlash({ flash }: { flash: OnlineActionFlashState }) {
  const width = 118;
  const left = flash.rect.left + flash.rect.width / 2 - width / 2;
  const top = flash.rect.top + flash.rect.height / 2 - (width * 7) / 10;

  return (
    <div
      className="pointer-events-none fixed z-[90] rounded-lg bg-amber-50/80 p-1 shadow-2xl ring-2 ring-amber-300 transition-opacity duration-700"
      style={{
        left,
        opacity: flash.isVisible ? 1 : 0,
        top,
        width,
      }}
    >
      <CardImage
        alt={flash.card.name}
        imageClassName="aspect-[5/7] border border-amber-200 shadow-sm"
        imagePath={flash.card.imagePath}
      >
        <div className="rounded-md bg-white/70 p-2">
          <h4 className="text-xs font-semibold leading-tight">{flash.card.name}</h4>
          <p className="mt-1 text-[10px] text-stone-700">{flash.card.description}</p>
        </div>
      </CardImage>
    </div>
  );
}

function OnlineBottomToast({ toast }: { toast: OnlineToastState }) {
  return (
    <div
      className="pointer-events-none fixed bottom-0 left-1/2 z-[85] w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 transition-transform duration-300 ease-out"
      style={{
        transform: `translateX(-50%) translateY(${toast.isVisible ? "0" : "105%"})`,
        transitionDuration: `${ONLINE_TOAST_SLIDE_MS}ms`,
      }}
    >
      <div className="rounded-t-xl border border-amber-300 bg-stone-950/88 px-4 py-3 text-center text-sm font-semibold text-amber-50 shadow-2xl backdrop-blur-md">
        {toast.message}
      </div>
    </div>
  );
}

function OnlineActionButton({
  action,
  canPlayAction,
  isBusy,
  onPlayAction,
  onSelectAction,
  view,
}: {
  action: CardInstance<ActionCard>;
  canPlayAction: boolean;
  isBusy: boolean;
  onPlayAction: (cardId: CardInstanceId, target?: ActionTarget) => void;
  onSelectAction: (cardId: CardInstanceId | undefined) => void;
  view: PlayerGameView;
}) {
  const targets = view.viewer?.validActionTargetsByCardId[action.instanceId] ?? [];

  if (targets.length === 0) {
    return (
      <button
        className="mt-2 w-full rounded-md border border-stone-300 bg-white/35 px-2 py-1.5 text-xs font-semibold text-stone-500"
        disabled
        type="button"
      >
        No legal play
      </button>
    );
  }

  const automaticTarget = targets.length === 1 && targets[0]?.target.type === "noble-position" && targets[0].target.index === -1;

  return (
    <button
      className="mt-2 w-full rounded-md border border-amber-400 bg-white/55 px-2 py-1.5 text-xs font-semibold text-stone-900 transition hover:bg-white/75 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={!canPlayAction || isBusy}
      onClick={(event) => {
        event.stopPropagation();
        if (automaticTarget) {
          onPlayAction(action.instanceId);
          return;
        }

        onSelectAction(action.instanceId);
      }}
      type="button"
    >
      Play Card
    </button>
  );
}

function OnlinePlayerDetailsModal({
  canDiscardCallousGuards,
  isBusy,
  onClose,
  onDiscardCallousGuards,
  onPreviewCard,
  player,
}: {
  canDiscardCallousGuards: boolean;
  isBusy: boolean;
  onClose: () => void;
  onDiscardCallousGuards: (cardId: CardInstanceId) => void;
  onPreviewCard: (card: BaseCard) => void;
  player?: PublicPlayerView;
}) {
  if (!player) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-950/45 p-4">
      <div className="max-h-[88vh] w-full max-w-5xl overflow-auto rounded-xl border border-stone-300 bg-white/80 p-5 shadow-2xl backdrop-blur-md">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-2xl font-bold text-stone-950">{player.name}</h3>
            <p className="mt-1 text-sm font-semibold text-stone-700">
              {player.score} pts · {player.collectedNobles.length} noble{player.collectedNobles.length === 1 ? "" : "s"} ·{" "}
              {player.inFrontActions.length} card{player.inFrontActions.length === 1 ? "" : "s"} in front
            </p>
          </div>
          <button
            className="rounded-md border border-stone-300 bg-white/65 px-3 py-2 text-sm font-semibold text-stone-900 transition hover:bg-white"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        {player.collectedNobles.length > 0 || player.inFrontActions.length > 0 ? (
          <div className="mt-5 flex flex-wrap items-start gap-4">
            <CollectedNobleStacks
              cardWidth={118}
              maxCardsPerStack={7}
              nobles={player.collectedNobles}
              offset={43}
              ownerPlayerId={player.id}
              onPreviewCard={(card) => onPreviewCard(card)}
            />
            <InFrontActionStack
              actions={player.inFrontActions}
              canDiscardCallousGuards={canDiscardCallousGuards}
              cardWidth={118}
              maxCardsPerStack={7}
              offset={43}
              onCardClick={(action) => onPreviewCard(action.card)}
              onDiscardCallousGuards={(cardId) => {
                if (isBusy) {
                  return;
                }

                onDiscardCallousGuards(cardId);
              }}
            />
          </div>
        ) : (
          <p className="mt-5 rounded-md border border-stone-300 bg-white/45 p-4 text-sm text-stone-700">
            {player.name} has no collected nobles or cards in front yet.
          </p>
        )}
      </div>
    </div>
  );
}

function OnlineInfightingChoice({
  hand,
  isBusy,
  onConfirm,
  playerName,
}: {
  hand: CardInstance<ActionCard>[];
  isBusy: boolean;
  onConfirm: (cardIds: CardInstanceId[]) => void;
  playerName: string;
}) {
  const [selectedIds, setSelectedIds] = useState<CardInstanceId[]>([]);
  const requiredCount = Math.min(2, hand.length);

  function toggleCard(cardId: CardInstanceId) {
    setSelectedIds((currentIds) => {
      if (currentIds.includes(cardId)) {
        return currentIds.filter((id) => id !== cardId);
      }

      if (currentIds.length >= requiredCount) {
        return currentIds;
      }

      return [...currentIds, cardId];
    });
  }

  return (
    <Card className="border-amber-500 bg-amber-50/80">
      <h3 className="text-lg font-semibold">Infighting</h3>
      <p className="mt-1 text-sm text-stone-700">
        {playerName}, choose {requiredCount} action card{requiredCount === 1 ? "" : "s"} to discard.
      </p>
      {hand.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {hand.map((action) => {
            const isSelected = selectedIds.includes(action.instanceId);

            return (
              <button
                className={`rounded-md border p-2 text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${
                  isSelected ? "border-amber-700 bg-amber-100/80 ring-2 ring-amber-500" : "border-amber-300 bg-white/45"
                }`}
                disabled={isBusy}
                key={action.instanceId}
                onClick={() => toggleCard(action.instanceId)}
                type="button"
              >
                <CardImage
                  alt={action.card.name}
                  imageClassName="aspect-[5/7] border border-amber-200 shadow-sm"
                  imagePath={action.card.imagePath}
                >
                  <div className="rounded bg-white/60 p-2">
                    <h4 className="text-sm font-semibold leading-tight">{action.card.name}</h4>
                    <p className="mt-1 text-xs text-stone-700">{action.card.description}</p>
                  </div>
                </CardImage>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-sm text-stone-600">You have no action cards to discard.</p>
      )}
      <button
        className="mt-3 rounded-md border border-amber-500 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isBusy || selectedIds.length !== requiredCount}
        onClick={() => onConfirm(selectedIds)}
        type="button"
      >
        Confirm Discard
      </button>
    </Card>
  );
}

function OnlineLoyalGuardsChoice({
  actionName,
  isBusy,
  originalPlayerName,
  playerName,
  onConfirm,
}: {
  actionName: string;
  isBusy: boolean;
  originalPlayerName: string;
  playerName: string;
  onConfirm: (useProtection: boolean) => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-stone-950/45 p-4">
      <div className="max-w-md rounded-lg border border-amber-300 bg-white/80 p-5 text-center shadow-xl backdrop-blur-md">
        <h3 className="text-lg font-semibold">Loyal Guards</h3>
        <p className="mt-2 text-sm text-stone-700">
          {playerName}, {originalPlayerName} used {actionName} against you. Use Loyal Guards to block it?
        </p>
        <p className="mt-2 text-xs text-stone-600">
          Loyal Guards will be discarded either way. If you block, the effect backfires when possible.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            className="rounded-md border border-amber-500 bg-amber-100/80 px-3 py-2 text-sm font-semibold text-amber-950 disabled:opacity-50"
            disabled={isBusy}
            onClick={() => onConfirm(true)}
            type="button"
          >
            Use Loyal Guards
          </button>
          <button
            className="rounded-md border border-stone-300 bg-white/70 px-3 py-2 text-sm font-semibold text-stone-900 disabled:opacity-50"
            disabled={isBusy}
            onClick={() => onConfirm(false)}
            type="button"
          >
            Let It Happen
          </button>
        </div>
      </div>
    </div>
  );
}

function OnlineClericalErrorReturnChoice({
  excludedNobleInstanceId,
  isBusy,
  onConfirm,
  originalPlayer,
  targetPlayerName,
}: {
  excludedNobleInstanceId: CardInstanceId;
  isBusy: boolean;
  onConfirm: (nobleId?: CardInstanceId) => void;
  originalPlayer?: { collectedNobles: CardInstance<NobleCard>[]; name: string };
  targetPlayerName: string;
}) {
  const eligibleNobles = originalPlayer?.collectedNobles.filter((noble) => noble.instanceId !== excludedNobleInstanceId) ?? [];

  return (
    <Card className="border-amber-500 bg-amber-50/80">
      <h3 className="text-lg font-semibold">Clerical Error</h3>
      <p className="mt-1 text-sm text-stone-700">
        {targetPlayerName}, choose a noble from {originalPlayer?.name ?? "the other player"}'s score pile to collect.
      </p>
      {eligibleNobles.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {eligibleNobles.map((noble) => (
            <button
              className={`rounded-md border p-2 text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${getNobleColorStyle(noble.card.colorCategory)}`}
              disabled={isBusy}
              key={noble.instanceId}
              onClick={() => onConfirm(noble.instanceId)}
              type="button"
            >
              <CardImage
                alt={noble.card.name}
                imageClassName="aspect-[5/7] border border-stone-200 shadow-sm"
                imagePath={noble.card.imagePath}
              >
                <div className="rounded bg-white/60 p-2">
                  <h4 className="text-sm font-semibold leading-tight">{noble.card.name}</h4>
                  <p className="mt-1 text-xs text-stone-700">{noble.card.points} pts</p>
                </div>
              </CardImage>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-stone-600">No eligible nobles are available to return.</p>
          <button
            className="mt-2 rounded-md border border-amber-500 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isBusy}
            onClick={() => onConfirm()}
            type="button"
          >
            Continue
          </button>
        </div>
      )}
    </Card>
  );
}

function OnlineInnocentVictimDiscardChoice({
  hand,
  isBusy,
  onConfirm,
  playerName,
}: {
  hand: CardInstance<ActionCard>[];
  isBusy: boolean;
  onConfirm: (cardId?: CardInstanceId) => void;
  playerName: string;
}) {
  if (hand.length === 0) {
    return (
      <Card className="border-amber-500 bg-amber-50/80">
        <h3 className="text-lg font-semibold">Innocent Victim</h3>
        <p className="mt-1 text-sm text-stone-700">{playerName}, you have no action cards to discard.</p>
        <button
          className="mt-3 rounded-md border border-amber-500 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isBusy}
          onClick={() => onConfirm()}
          type="button"
        >
          Continue
        </button>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500 bg-amber-50/80">
      <h3 className="text-lg font-semibold">Innocent Victim</h3>
      <p className="mt-1 text-sm text-stone-700">{playerName}, choose 1 action card to discard.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {hand.map((action) => (
          <button
            className="rounded-md border border-amber-300 bg-white/45 p-2 text-left transition hover:-translate-y-0.5 hover:bg-white/65 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isBusy}
            key={action.instanceId}
            onClick={() => onConfirm(action.instanceId)}
            type="button"
          >
            <CardImage
              alt={action.card.name}
              imageClassName="aspect-[5/7] border border-amber-200 shadow-sm"
              imagePath={action.card.imagePath}
            >
              <div className="rounded bg-white/60 p-2">
                <h4 className="text-sm font-semibold leading-tight">{action.card.name}</h4>
                <p className="mt-1 text-xs text-stone-700">{action.card.description}</p>
              </div>
            </CardImage>
          </button>
        ))}
      </div>
    </Card>
  );
}

function InFrontActionChip({
  action,
  canDiscard,
  isBusy,
  onDiscardCallousGuards,
}: {
  action: CardInstance<ActionCard>;
  canDiscard: boolean;
  isBusy: boolean;
  onDiscardCallousGuards: (cardId: CardInstanceId) => void;
}) {
  return (
    <div className={`relative rounded border border-amber-300 bg-white/50 p-1 ${action.card.effectKey === "callousGuards" ? "z-10" : ""}`}>
      <CardImage
        alt={action.card.name}
        imageClassName="h-16 w-12 border border-amber-200 object-cover shadow-sm"
        imagePath={action.card.imagePath}
      >
        <div className="h-16 w-12 rounded bg-white/70 p-1 text-[9px] font-semibold leading-tight">
          {action.card.name}
        </div>
      </CardImage>
      {canDiscard ? (
        <button
          aria-label="Discard Callous Guards"
          className="absolute left-1/2 top-full flex h-6 w-9 -translate-x-1/2 items-center justify-center rounded-b-md border border-red-700 bg-red-600 text-white shadow-md transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isBusy}
          onClick={(event) => {
            event.stopPropagation();
            onDiscardCallousGuards(action.instanceId);
          }}
          type="button"
        >
          <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

type OnlineNobleLineProps = {
  isBusy: boolean;
  isReorderMode: boolean;
  legalReorderIds: CardInstanceId[];
  movementTargets: OnlineActionTargetChoice[];
  nobles: CardInstance<NobleCard>[];
  onPlayAction: (target: ActionTarget) => void;
  onPreviewCard: (card: NobleCard) => void;
  onReorderDraftChange: (instanceIds: CardInstanceId[]) => void;
  onSelectNobleTarget: (instanceId: CardInstanceId) => void;
  reorderDraftIds: CardInstanceId[];
  selectedAction?: CardInstance<ActionCard>;
  selectedLandingTargets: OnlineActionTargetChoice[];
  selectedNobleTargetId?: CardInstanceId;
  targetChoicesByNobleId: Map<CardInstanceId, OnlineActionTargetChoice[]>;
};

const OnlineNobleLine = memo(function OnlineNobleLineComponent({
  isBusy,
  isReorderMode,
  legalReorderIds,
  movementTargets,
  nobles,
  onPlayAction,
  onPreviewCard,
  onReorderDraftChange,
  onSelectNobleTarget,
  reorderDraftIds,
  selectedAction,
  selectedLandingTargets,
  selectedNobleTargetId,
  targetChoicesByNobleId,
}: OnlineNobleLineProps) {
  const [dragState, setDragState] = useState<{
    currentX: number;
    instanceId: CardInstanceId;
    slotWidth: number;
    startX: number;
  }>();
  const displayedNobles = useMemo(
    () => {
      const orderedNobles = isReorderMode && reorderDraftIds.length > 0 ? applyReorderDraft(nobles, reorderDraftIds) : nobles;
      return orderedNobles;
    },
    [isReorderMode, nobles, reorderDraftIds],
  );
  const movementTargetIds = useMemo(
    () => new Set(movementTargets.map((target) => getTargetNobleId(target.target)).filter(Boolean)),
    [movementTargets],
  );
  const landingTargetByPosition = useMemo(
    () => new Map(selectedLandingTargets.map((target) => [target.toPosition, target])),
    [selectedLandingTargets],
  );

  useEffect(() => {
    if (!isReorderMode) {
      setDragState(undefined);
    }
  }, [isReorderMode]);

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-12">
      {displayedNobles.map((noble, index) => (
        <OnlineNobleLineCard
          dragState={dragState}
          index={index}
          isBusy={isBusy}
          isMovementTarget={movementTargetIds.has(noble.instanceId)}
          isReorderMode={isReorderMode}
          landingTarget={landingTargetByPosition.get(index + 1)}
          key={noble.instanceId}
          legalReorderIds={legalReorderIds}
          noble={noble}
          reorderDraftIds={reorderDraftIds}
          selectedAction={selectedAction}
          selectedNobleTargetId={selectedNobleTargetId}
          targetChoices={targetChoicesByNobleId.get(noble.instanceId) ?? []}
          onDragStateChange={setDragState}
          onPlayAction={onPlayAction}
          onPreviewCard={onPreviewCard}
          onReorderDraftChange={onReorderDraftChange}
          onSelectNobleTarget={onSelectNobleTarget}
        />
      ))}
    </div>
  );
}, areOnlineNobleLinePropsEqual);

function OnlineNobleLineCard({
  dragState,
  index,
  isBusy,
  isMovementTarget,
  isReorderMode,
  landingTarget,
  legalReorderIds,
  noble,
  onPlayAction,
  onPreviewCard,
  onReorderDraftChange,
  onSelectNobleTarget,
  reorderDraftIds,
  selectedAction,
  selectedNobleTargetId,
  targetChoices,
  onDragStateChange,
}: {
  dragState?: {
    currentX: number;
    instanceId: CardInstanceId;
    slotWidth: number;
    startX: number;
  };
  index: number;
  isBusy: boolean;
  isMovementTarget: boolean;
  isReorderMode: boolean;
  landingTarget?: OnlineActionTargetChoice;
  legalReorderIds: CardInstanceId[];
  noble: CardInstance<NobleCard>;
  onPlayAction: (target: ActionTarget) => void;
  onPreviewCard: (card: NobleCard) => void;
  onReorderDraftChange: (instanceIds: CardInstanceId[]) => void;
  onSelectNobleTarget: (instanceId: CardInstanceId) => void;
  reorderDraftIds: CardInstanceId[];
  selectedAction?: CardInstance<ActionCard>;
  selectedNobleTargetId?: CardInstanceId;
  targetChoices: OnlineActionTargetChoice[];
  onDragStateChange: (dragState: {
    currentX: number;
    instanceId: CardInstanceId;
    slotWidth: number;
    startX: number;
  } | undefined | ((current: {
    currentX: number;
    instanceId: CardInstanceId;
    slotWidth: number;
    startX: number;
  } | undefined) => {
    currentX: number;
    instanceId: CardInstanceId;
    slotWidth: number;
    startX: number;
  } | undefined)) => void;
}) {
  const isReorderTarget = isReorderMode && legalReorderIds.includes(noble.instanceId);
  const reorderIds = reorderDraftIds.length > 0 ? reorderDraftIds : legalReorderIds;
  const isDragged = dragState?.instanceId === noble.instanceId;
  const currentDragIndex = dragState ? reorderIds.indexOf(dragState.instanceId) : -1;
  const dragDelta = dragState ? dragState.currentX - dragState.startX : 0;
  const swapThreshold = dragState ? dragState.slotWidth * 0.75 : 0;
  const clampedDragDelta =
    dragState && isDragged
      ? clamp(
          dragDelta,
          currentDragIndex <= 0 ? 0 : -swapThreshold,
          currentDragIndex >= reorderIds.length - 1 ? 0 : swapThreshold,
        )
      : 0;
  const transform = isDragged && clampedDragDelta ? `translateX(${clampedDragDelta}px)` : undefined;
  const isSelectedMovementTarget = selectedNobleTargetId === noble.instanceId;
  const hasTargets = targetChoices.length > 0 || isReorderTarget || isMovementTarget || Boolean(landingTarget);
  const canPreview = !hasTargets;
  const colorStyle = hasTargets ? selectedNobleColorStyle : getNobleColorStyle(noble.card.colorCategory);
  const isWholeCardClickable = canPreview || isMovementTarget || Boolean(landingTarget) || targetChoices.length === 1;

  return (
    <div
      className={`relative rounded-md border p-2 ${
        isReorderMode
          ? "transition-[background-color,border-color,box-shadow] duration-200"
          : "transition-[background-color,border-color,box-shadow,transform] duration-200 hover:z-30 hover:scale-125"
      } ${
        canPreview ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400" : ""
      } ${
        isReorderTarget ? "cursor-grab touch-none select-none active:cursor-grabbing" : ""
      } ${colorStyle}`}
      data-online-noble-id={noble.instanceId}
      role={isWholeCardClickable ? "button" : undefined}
      tabIndex={isWholeCardClickable ? 0 : undefined}
      onClick={() => {
        if (isBusy) {
          return;
        }

        if (landingTarget) {
          onPlayAction(landingTarget.target);
          return;
        }

        if (isMovementTarget) {
          onSelectNobleTarget(noble.instanceId);
          return;
        }

        if (targetChoices.length === 1) {
          onPlayAction(targetChoices[0].target);
          return;
        }

        if (canPreview) {
          onPreviewCard(noble.card);
        }
      }}
      onKeyDown={(event) => {
        if (!isWholeCardClickable || (event.key !== "Enter" && event.key !== " ")) {
          return;
        }

        event.preventDefault();
        if (landingTarget) {
          onPlayAction(landingTarget.target);
          return;
        }

        if (isMovementTarget) {
          onSelectNobleTarget(noble.instanceId);
          return;
        }

        if (targetChoices.length === 1) {
          onPlayAction(targetChoices[0].target);
          return;
        }

        onPreviewCard(noble.card);
      }}
      onPointerCancel={() => onDragStateChange(undefined)}
      onPointerDown={(event) => {
        if (!isReorderTarget || isBusy) {
          return;
        }

        const bounds = event.currentTarget.getBoundingClientRect();
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        onDragStateChange({
          currentX: event.clientX,
          instanceId: noble.instanceId,
          slotWidth: bounds.width + 8,
          startX: event.clientX,
        });
      }}
      onPointerMove={(event) => {
        if (dragState?.instanceId !== noble.instanceId) {
          return;
        }

        event.preventDefault();
        onDragStateChange((current) => {
          if (!current) {
            return current;
          }

          const currentIndex = reorderIds.indexOf(current.instanceId);

          if (currentIndex < 0) {
            return { ...current, currentX: event.clientX };
          }

          const delta = event.clientX - current.startX;
          const threshold = current.slotWidth * 0.75;
          const shouldMoveLeft = delta <= -threshold && currentIndex > 0;
          const shouldMoveRight = delta >= threshold && currentIndex < reorderIds.length - 1;

          if (!shouldMoveLeft && !shouldMoveRight) {
            return { ...current, currentX: event.clientX };
          }

          const targetIndex = currentIndex + (shouldMoveLeft ? -1 : 1);
          const nextOrder = [...reorderIds];
          const [draggedId] = nextOrder.splice(currentIndex, 1);
          nextOrder.splice(targetIndex, 0, draggedId);
          onReorderDraftChange(nextOrder);

          return {
            ...current,
            currentX: event.clientX,
            startX: current.startX + (shouldMoveLeft ? -current.slotWidth : current.slotWidth),
          };
        });
      }}
      onPointerUp={(event) => {
        if (dragState?.instanceId !== noble.instanceId) {
          return;
        }

        event.preventDefault();
        onDragStateChange(undefined);
      }}
      style={{
        transform,
        zIndex: isDragged ? 20 : undefined,
      }}
    >
      <p className="mb-1 text-xs font-semibold text-stone-600">{index + 1}</p>
      <CardImage
        alt={noble.card.name}
        imageClassName={`aspect-[5/7] border shadow-sm ${
          isSelectedMovementTarget ? "border-amber-700 ring-2 ring-amber-500" : "border-stone-200"
        }`}
        imagePath={noble.card.imagePath}
      >
        <div className="rounded-md bg-white/60 p-2">
          <h4 className="text-sm font-semibold leading-tight">{noble.card.name}</h4>
          <p className="mt-1 text-xs text-stone-700">{noble.card.points} pts</p>
        </div>
      </CardImage>
      {selectedAction && targetChoices.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {targetChoices.map((choice) => (
            <button
              className="rounded border border-amber-400 bg-amber-100/75 px-2 py-1 text-xs font-semibold text-amber-950"
              disabled={isBusy}
              key={`${noble.instanceId}-${choice.label}`}
              onClick={(event) => {
                event.stopPropagation();
                onPlayAction(choice.target);
              }}
              type="button"
            >
              {choice.label}
            </button>
          ))}
        </div>
      ) : null}
      {isMovementTarget && !selectedNobleTargetId ? <p className="mt-2 text-xs font-semibold text-amber-800">Choose noble</p> : null}
      {isSelectedMovementTarget ? <p className="mt-2 text-xs font-semibold text-amber-800">Selected</p> : null}
      {landingTarget ? <p className="mt-2 text-xs font-semibold text-amber-800">Move here</p> : null}
      {isReorderTarget ? <p className="mt-2 text-xs font-semibold text-amber-800">Drag horizontally</p> : null}
    </div>
  );
}

function NobleDeckChoicePanel({
  choices,
  isBusy,
  onChoose,
}: {
  choices: OnlineActionTargetChoice[];
  isBusy: boolean;
  onChoose: (choice: OnlineActionTargetChoice) => void;
}) {
  return (
    <div className="mt-3">
      <h4 className="text-sm font-semibold">Choose one revealed noble</h4>
      <div className="mt-2 grid gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {choices.map((choice) => {
          const noble = choice.revealedNoble;

          if (!noble) {
            return null;
          }

          return (
            <button
              className={`rounded-md border p-2 text-left transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 ${getNobleColorStyle(noble.card.colorCategory)}`}
              disabled={isBusy}
              key={noble.instanceId}
              onClick={() => onChoose(choice)}
              type="button"
            >
              <CardImage
                alt={noble.card.name}
                imageClassName="aspect-[5/7] border border-stone-200 shadow-sm"
                imagePath={noble.card.imagePath}
              >
                <div className="rounded-md bg-white/60 p-2">
                  <h5 className="text-sm font-semibold leading-tight">{noble.card.name}</h5>
                  <p className="mt-1 text-xs text-stone-700">{noble.card.points} pts</p>
                </div>
              </CardImage>
              <span className="mt-2 block rounded border border-amber-500 bg-white/75 px-2 py-1 text-center text-xs font-semibold text-amber-950">
                Select
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ActionCardChoicePanel({
  choices,
  compact = false,
  emptyMessage,
  isBusy,
  onChoose,
  stackedDiscardLayout = false,
  title,
}: {
  choices: OnlineActionTargetChoice[];
  compact?: boolean;
  emptyMessage: string;
  isBusy: boolean;
  onChoose: (choice: OnlineActionTargetChoice) => void;
  stackedDiscardLayout?: boolean;
  title: string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | undefined>();
  const cardWidth = 120;
  const cardOverlap = cardWidth / 2;
  const cardStep = cardWidth - cardOverlap;
  const spreadOffset = cardOverlap + 8;
  const stackWidth = choices.length > 0 ? cardWidth + (choices.length - 1) * cardStep : 0;

  return (
    <div className="mt-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      {choices.length === 0 ? (
        <p className="mt-2 text-sm text-stone-700">{emptyMessage}</p>
      ) : stackedDiscardLayout ? (
        <div className="mt-2 min-h-48 overflow-x-auto pb-3">
          <div
            className="relative min-h-44"
            onMouseLeave={() => setHoveredIndex(undefined)}
            style={{
              width: Math.max(stackWidth + spreadOffset, cardWidth),
            }}
          >
            {choices.map((choice, index) => {
              const action = choice.revealedAction;

              if (!action) {
                return null;
              }

              const shiftForHover = hoveredIndex !== undefined && index < hoveredIndex ? -spreadOffset : 0;

              return (
                <div
                  className="absolute top-0"
                  key={`${action.instanceId}-${choice.label}`}
                  onMouseEnter={() => setHoveredIndex(index)}
                  style={{
                    height: 180,
                    left: index * cardStep,
                    width: cardStep,
                    zIndex: choices.length - index,
                  }}
                >
                  <div
                    className="transition-transform duration-200 ease-out"
                    style={{
                      transform: `translateX(${shiftForHover}px)`,
                      width: cardWidth,
                    }}
                  >
                    <button
                      className="block w-full rounded-md border border-amber-300 bg-amber-50/45 p-1 shadow-sm transition hover:border-amber-600 hover:bg-amber-100/60 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isBusy}
                      onClick={() => onChoose(choice)}
                      title={`Select ${action.card.name}`}
                      type="button"
                    >
                      <CardImage
                        alt={action.card.name}
                        imageClassName="aspect-[5/7] border border-amber-200 shadow-sm"
                        imagePath={action.card.imagePath}
                      >
                        <div className="min-h-20 rounded-md bg-white/60 p-1">
                          <h5 className="text-xs font-semibold leading-tight">{action.card.name}</h5>
                        </div>
                      </CardImage>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={`mt-2 grid gap-2 ${compact ? "sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8" : "sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"}`}>
          {choices.map((choice) => {
            const action = choice.revealedAction;

            if (!action) {
              return null;
            }

            return (
              <button
                className="rounded-md border border-amber-300 bg-white/45 p-2 text-left transition hover:-translate-y-0.5 hover:bg-white/65 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isBusy}
                key={`${action.instanceId}-${choice.label}`}
                onClick={() => onChoose(choice)}
                type="button"
              >
                <CardImage
                  alt={action.card.name}
                  imageClassName="aspect-[5/7] border border-amber-200 shadow-sm"
                  imagePath={action.card.imagePath}
                >
                  <div className="rounded-md bg-white/60 p-2">
                    <h5 className="text-sm font-semibold leading-tight">{action.card.name}</h5>
                    <p className="mt-1 text-xs text-stone-700">{action.card.description}</p>
                  </div>
                </CardImage>
                <span className="mt-2 block rounded border border-amber-500 bg-amber-50/85 px-2 py-1 text-center text-xs font-semibold text-amber-950">
                  Select
                </span>
                {choice.playerName ? <span className="mt-1 block text-center text-[11px] text-stone-600">{choice.playerName}</span> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getTargetChoicesByNobleId(targets: OnlineActionTargetChoice[]): Map<CardInstanceId, OnlineActionTargetChoice[]> {
  const choicesByNobleId = new Map<CardInstanceId, OnlineActionTargetChoice[]>();

  targets.forEach((choice) => {
    const instanceId = getTargetNobleId(choice.target);

    if (!instanceId) {
      return;
    }

    choicesByNobleId.set(instanceId, [
      ...(choicesByNobleId.get(instanceId) ?? []),
      choice,
    ]);
  });

  return choicesByNobleId;
}

function getTargetChoicesByPlayerId(targets: OnlineActionTargetChoice[]): Map<string, OnlineActionTargetChoice[]> {
  const choicesByPlayerId = new Map<string, OnlineActionTargetChoice[]>();

  targets.forEach((choice) => {
    if (choice.target.type !== "player") {
      return;
    }

    choicesByPlayerId.set(choice.target.playerId, [
      ...(choicesByPlayerId.get(choice.target.playerId) ?? []),
      choice,
    ]);
  });

  return choicesByPlayerId;
}

function getHandTargetChoicesByPlayerId(targets: OnlineActionTargetChoice[]): Map<string, OnlineActionTargetChoice[]> {
  const choicesByPlayerId = new Map<string, OnlineActionTargetChoice[]>();

  targets.forEach((target) => {
    if (target.target.type !== "action-hand-card") {
      return;
    }

    choicesByPlayerId.set(target.target.playerId, [
      ...(choicesByPlayerId.get(target.target.playerId) ?? []),
      target,
    ]);
  });

  return choicesByPlayerId;
}

function getCollectedNobleTargetChoicesByPlayerId(targets: OnlineActionTargetChoice[]): Map<string, OnlineActionTargetChoice[]> {
  const choicesByPlayerId = new Map<string, OnlineActionTargetChoice[]>();

  targets.forEach((target) => {
    if (target.target.type !== "collected-noble") {
      return;
    }

    choicesByPlayerId.set(target.target.playerId, [
      ...(choicesByPlayerId.get(target.target.playerId) ?? []),
      target,
    ]);
  });

  return choicesByPlayerId;
}

function getTargetNobleId(target: ActionTarget): CardInstanceId | undefined {
  if (target.type === "move-noble" || target.type === "noble") {
    return target.instanceId;
  }

  return undefined;
}

function isOnlineLineMovementTarget(target: OnlineActionTargetChoice): boolean {
  return (
    (target.target.type === "move-noble" || target.target.type === "noble") &&
    typeof target.fromPosition === "number" &&
    typeof target.toPosition === "number"
  );
}

function getTargetLabel(target: { label: string; target: ActionTarget }): string {
  if (target.target.type === "move-noble") {
    return target.target.spaces === 1 ? "Move 1" : `Move ${target.target.spaces}`;
  }

  return target.label;
}

function getSelectedActionTargetInstruction({
  actionDiscardTargetChoices,
  collectedNobleTargetChoicesByPlayerId,
  handTargetChoicesByPlayerId,
  inFrontTargetChoices,
  nobleDeckTargetChoices,
  targetChoicesByPlayerId,
}: {
  actionDiscardTargetChoices: OnlineActionTargetChoice[];
  collectedNobleTargetChoicesByPlayerId: Map<string, OnlineActionTargetChoice[]>;
  handTargetChoicesByPlayerId: Map<string, OnlineActionTargetChoice[]>;
  inFrontTargetChoices: OnlineActionTargetChoice[];
  nobleDeckTargetChoices: OnlineActionTargetChoice[];
  targetChoicesByPlayerId: Map<string, OnlineActionTargetChoice[]>;
}) {
  if (targetChoicesByPlayerId.size > 0 || handTargetChoicesByPlayerId.size > 0 || collectedNobleTargetChoicesByPlayerId.size > 0) {
    return " from the Players box.";
  }

  if (nobleDeckTargetChoices.length > 0) {
    return " from the revealed noble cards.";
  }

  if (actionDiscardTargetChoices.length > 0) {
    return " from the action discard pile.";
  }

  if (inFrontTargetChoices.length > 0) {
    return " from the cards in front of players.";
  }

  return " from the noble line.";
}

function getPlayerName(view: PlayerGameView, playerId: string) {
  return view.players.find((player) => player.id === playerId)?.name ?? "that player";
}

function getPendingOpponentScorePulse(view: PlayerGameView, previousView?: PlayerGameView): OnlineScorePulseState | undefined {
  if (!previousView || view.isViewerTurn || !view.currentPlayerId) {
    return undefined;
  }

  const actingPlayerId = view.currentPlayerId;
  const previousFrontNoble = previousView.nobleLine[0];
  const currentFrontNoble = view.nobleLine[0];
  const frontNobleLeftLine = previousFrontNoble && previousFrontNoble.instanceId !== currentFrontNoble?.instanceId;
  const previousActor = previousView.players.find((player) => player.id === actingPlayerId);
  const nextActor = view.players.find((player) => player.id === actingPlayerId);
  const actorCollectedFrontNoble =
    previousFrontNoble &&
    nextActor?.collectedNobles.some((noble) => noble.instanceId === previousFrontNoble.instanceId) &&
    !previousActor?.collectedNobles.some((noble) => noble.instanceId === previousFrontNoble.instanceId);
  const delta = (nextActor?.score ?? 0) - (previousActor?.score ?? 0);

  if (!frontNobleLeftLine || !previousFrontNoble || !previousActor || !actorCollectedFrontNoble || delta === 0) {
    return undefined;
  }

  return {
    delta,
    holdPreviousScore: true,
    id: `${previousFrontNoble.instanceId}-score-pulse-preview`,
    isVisible: false,
    playerId: actingPlayerId,
    previousScore: previousActor.score,
  };
}

function getCurrentTurnActivity(view: PlayerGameView) {
  if (!view.currentPlayerId) {
    return [];
  }

  const activity: PlayerGameView["log"] = [];

  for (const entry of view.log) {
    if (entry.playerId && entry.playerId !== view.currentPlayerId) {
      break;
    }

    if (entry.playerId === view.currentPlayerId && isTurnActivityMessage(entry.message)) {
      activity.push(entry);
    }
  }

  return activity.reverse();
}

function getPlayedActionName(message: string, playerName: string): string | undefined {
  const prefix = `${playerName} played `;

  if (message.startsWith(prefix)) {
    const withoutPrefix = message.slice(prefix.length);
    const actionName = withoutPrefix.split(" and ")[0]?.replace(/\.$/, "").trim();
    return actionName || undefined;
  }

  const usedPrefix = `${playerName} used `;

  if (message.startsWith(usedPrefix)) {
    return actionDefinitions
      .map((action) => action.name)
      .sort((first, second) => second.length - first.length)
      .find((actionName) => normalizeCardName(message.slice(usedPrefix.length)).startsWith(normalizeCardName(actionName)));
  }

  return undefined;
}

function findVisibleActionCardByName(view: PlayerGameView, actionName: string): ActionCard | undefined {
  const normalizedName = normalizeCardName(actionName);
  const discardedCard = view.actionDeck.discardPile.find((card) => normalizeCardName(card.card.name) === normalizedName);

  if (discardedCard) {
    return discardedCard.card;
  }

  const inFrontCard = view.players
    .flatMap((player) => player.inFrontActions)
    .find((card) => normalizeCardName(card.card.name) === normalizedName);

  if (inFrontCard) {
    return inFrontCard.card;
  }

  return actionDefinitions.find((card) => normalizeCardName(card.name) === normalizedName);
}

function shouldShowOnlineToastForEntry(entry: PlayerGameView["log"][number], viewerPlayerId: string): boolean {
  return Boolean(
    entry.playerId &&
      entry.playerId !== viewerPlayerId &&
      !isTestHandReloadMessage(entry.message) &&
      isTurnActivityMessage(entry.message),
  );
}

function areOnlineNobleLinePropsEqual(
  previous: OnlineNobleLineProps,
  next: OnlineNobleLineProps,
) {
  return (
    previous.isBusy === next.isBusy &&
    previous.isReorderMode === next.isReorderMode &&
    previous.selectedAction?.instanceId === next.selectedAction?.instanceId &&
    previous.selectedNobleTargetId === next.selectedNobleTargetId &&
    getNobleInstanceKey(previous.nobles) === getNobleInstanceKey(next.nobles) &&
    previous.legalReorderIds.join("|") === next.legalReorderIds.join("|") &&
    previous.reorderDraftIds.join("|") === next.reorderDraftIds.join("|") &&
    getOnlineTargetChoiceKey(previous.movementTargets) === getOnlineTargetChoiceKey(next.movementTargets) &&
    getOnlineTargetChoiceKey(previous.selectedLandingTargets) === getOnlineTargetChoiceKey(next.selectedLandingTargets) &&
    getTargetChoicesMapKey(previous.targetChoicesByNobleId) === getTargetChoicesMapKey(next.targetChoicesByNobleId)
  );
}

function getNobleInstanceKey(nobles: CardInstance<NobleCard>[]) {
  return nobles.map((noble) => noble.instanceId).join("|");
}

function getOnlineTargetChoiceKey(choices: OnlineActionTargetChoice[]) {
  return choices
    .map((choice) => `${choice.label}:${choice.toPosition ?? ""}:${JSON.stringify(choice.target)}`)
    .join("|");
}

function getTargetChoicesMapKey(choicesByNobleId: Map<CardInstanceId, OnlineActionTargetChoice[]>) {
  return Array.from(choicesByNobleId.entries())
    .map(([instanceId, choices]) => `${instanceId}=${getOnlineTargetChoiceKey(choices)}`)
    .join(";");
}

function formatOnlineToastMessage(message: string): string {
  return message;
}

function normalizeCardName(name: string): string {
  return name.replace(/[’']/g, "").toLowerCase();
}

async function playYourTurnNotificationSound() {
  try {
    const AudioContextConstructor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextConstructor) {
      return;
    }

    const audioContext = new AudioContextConstructor();

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    gain.connect(audioContext.destination);

    [659.25, 880].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.11);
      oscillator.connect(gain);
      oscillator.start(now + index * 0.11);
      oscillator.stop(now + index * 0.11 + 0.16);
    });

    window.setTimeout(() => {
      void audioContext.close();
    }, 700);
  } catch {
    // Browsers may block audio until the tab has received a user gesture.
  }
}

function isTurnActivityMessage(message: string): boolean {
  const normalized = message.toLowerCase();

  return (
    normalized.includes(" played ") ||
    normalized.includes(" took ") ||
    normalized.includes(" collected ") ||
    normalized.includes(" gave the clown") ||
    normalized.includes("triggered:")
  );
}

function isTestHandReloadMessage(message: string): boolean {
  return message.toLowerCase().includes("reloaded a fresh test hand");
}

function getLegalReorderIds(targets: OnlineActionTargetChoice[]): CardInstanceId[] {
  return targets
    .filter((target) => target.target.type === "noble" && typeof target.fromPosition === "number" && typeof target.toPosition !== "number")
    .sort((first, second) => (first.fromPosition ?? 0) - (second.fromPosition ?? 0))
    .flatMap((target) => (target.target.type === "noble" ? [target.target.instanceId] : []));
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampBackgroundNobleCount(nobleCount: number): number {
  return Math.min(Math.max(nobleCount, 1), 13);
}

function getBackgroundImageValue(nobleCount: number): string {
  return `url("/backgrounds/day-cycle/day-${String(clampBackgroundNobleCount(nobleCount)).padStart(2, "0")}.png")`;
}

function getNightBackgroundImageValue(): string {
  return `url("/backgrounds/day-cycle/day-night.png")`;
}

function setGameBackgroundImage(nobleCount: number) {
  document.documentElement.style.setProperty("--game-background-image", getBackgroundImageValue(nobleCount));
  document.documentElement.style.setProperty("--game-background-next-image", getBackgroundImageValue(nobleCount));
  document.documentElement.style.setProperty("--game-background-next-opacity", "0");
}

function transitionGameBackground(nobleCount: number, timeoutRef: MutableRefObject<number[]>) {
  transitionGameBackgroundTo(getBackgroundImageValue(nobleCount), timeoutRef);
}

function transitionGameBackgroundThroughNight(nobleCount: number, timeoutRef: MutableRefObject<number[]>) {
  clearBackgroundTransitionTimeouts(timeoutRef);
  const sunsetImage = getBackgroundImageValue(1);
  const nightImage = getNightBackgroundImageValue();
  const nextDayImage = getBackgroundImageValue(nobleCount);
  const stepDelay = BACKGROUND_TRANSITION_DURATION_MS + 180;

  transitionGameBackgroundTo(sunsetImage, timeoutRef, false);
  timeoutRef.current.push(window.setTimeout(() => transitionGameBackgroundTo(nightImage, timeoutRef, false), stepDelay));
  timeoutRef.current.push(window.setTimeout(() => transitionGameBackgroundTo(nextDayImage, timeoutRef, false), stepDelay * 2));
}

function transitionGameBackgroundTo(backgroundImage: string, timeoutRef: MutableRefObject<number[]>, clearExisting = true) {
  if (clearExisting) {
    clearBackgroundTransitionTimeouts(timeoutRef);
  }

  document.documentElement.style.setProperty("--game-background-transition", "none");
  document.documentElement.style.setProperty("--game-background-next-image", backgroundImage);
  document.documentElement.style.setProperty("--game-background-next-opacity", "0");
  void document.documentElement.offsetHeight;
  window.requestAnimationFrame(() => {
    document.documentElement.style.setProperty("--game-background-transition", `opacity ${BACKGROUND_TRANSITION_DURATION_MS}ms ease-in-out`);
    document.documentElement.style.setProperty("--game-background-next-opacity", "1");
  });

  timeoutRef.current.push(window.setTimeout(() => {
    commitBackgroundTransition(backgroundImage);
  }, BACKGROUND_TRANSITION_DURATION_MS + 80));
}

function commitBackgroundTransition(backgroundImage: string) {
  document.documentElement.style.setProperty("--game-background-image", backgroundImage);
  document.documentElement.style.setProperty("--game-background-next-image", backgroundImage);
  document.documentElement.style.setProperty("--game-background-transition", "none");
  document.documentElement.style.setProperty("--game-background-next-opacity", "0");
  window.requestAnimationFrame(() => {
    document.documentElement.style.setProperty("--game-background-transition", `opacity ${BACKGROUND_TRANSITION_DURATION_MS}ms ease-in-out`);
  });
}

function clearBackgroundTransitionTimeouts(timeoutRef: MutableRefObject<number[]>) {
  timeoutRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
  timeoutRef.current = [];
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}
