"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Player } from "@/lib/game/types";

type PassTurnScreenProps = {
  briefingItems?: string[];
  canStartTurn?: boolean;
  nextPlayer?: Player;
  onCovered?: () => void;
  onReady: (inputMethod?: "keyboard" | "pointer") => void;
};

export function PassTurnScreen({ briefingItems = [], canStartTurn = true, nextPlayer, onCovered, onReady }: PassTurnScreenProps) {
  const enterKeyArmed = useRef(true);
  const hasReportedCovered = useRef(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isShowingBriefing, setIsShowingBriefing] = useState(false);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => setIsVisible(true));

    return () => window.cancelAnimationFrame(animationFrame);
  }, []);

  useEffect(() => {
    if (!isVisible || hasReportedCovered.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      hasReportedCovered.current = true;
      onCovered?.();
    }, 320);

    return () => window.clearTimeout(timeoutId);
  }, [isVisible, onCovered]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter" || !enterKeyArmed.current || !canStartTurn) {
        return;
      }

      event.preventDefault();
      enterKeyArmed.current = false;
      beginReadyTransition("keyboard");
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
  }, [briefingItems.length, canStartTurn, isLeaving, isShowingBriefing]);

  function beginReadyTransition(inputMethod: "keyboard" | "pointer" = "pointer") {
    if (isLeaving || !canStartTurn) {
      return;
    }

    if (!isShowingBriefing && briefingItems.length > 0) {
      setIsShowingBriefing(true);
      return;
    }

    setIsLeaving(true);
    window.setTimeout(() => onReady(inputMethod), 260);
  }

  return (
    <section
      className={`fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-stone-950 px-6 text-white transition-opacity duration-300 ${
        isVisible && !isLeaving ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="w-full max-w-lg rounded-lg border border-stone-700 bg-stone-900 p-8 text-center shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-300">
          {isShowingBriefing ? "Since your last turn" : "Pass and play"}
        </p>
        {isShowingBriefing ? (
          <>
            <div className="mt-5 max-h-72 overflow-auto rounded-md border border-stone-700 bg-stone-950/60 p-4 text-left text-sm text-stone-200">
              <ul className="list-disc space-y-2 pl-5">
                {briefingItems.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-3xl font-bold leading-tight">
              Pass the laptop to {nextPlayer?.name ?? "the next player"}
            </h1>
            <p className="mt-3 text-sm text-stone-300">
              The next hand is hidden until the player is ready.
            </p>
          </>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            className="border-amber-300 bg-amber-200 text-stone-950 hover:bg-amber-100 disabled:opacity-70"
            disabled={!canStartTurn}
            onClick={() => beginReadyTransition("pointer")}
          >
            {isShowingBriefing ? "Dismiss" : "Start Turn"}
          </Button>
        </div>
      </div>
    </section>
  );
}
