import { Card } from "@/components/ui/Card";
import { CollectedNobleStacks, InFrontActionStack } from "@/components/game/CollectedNobleStacks";
import type { BaseCard, CardInstanceId, Player } from "@/lib/game/types";

type CollectedNoblesProps = {
  player?: Player;
  canDiscardCallousGuards?: boolean;
  onCollectionAreaReady?: (element: HTMLDivElement | null) => void;
  onDiscardCallousGuards?: (cardId: CardInstanceId) => void;
  onPreviewCard?: (card: BaseCard) => void;
};

export function CollectedNobles({
  canDiscardCallousGuards = false,
  player,
  onCollectionAreaReady,
  onDiscardCallousGuards,
  onPreviewCard,
}: CollectedNoblesProps) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Collected Nobles</h2>
        <span className="text-sm font-semibold text-stone-700">{player?.score ?? 0} pts</span>
      </div>

      <div className="mt-3 max-h-[33rem] overflow-auto" ref={onCollectionAreaReady}>
        {player && (player.collectedNobles.length > 0 || player.inFrontActions.length > 0) ? (
          <div className="flex flex-wrap items-start gap-3">
            <CollectedNobleStacks nobles={player.collectedNobles} ownerPlayerId={player.id} onPreviewCard={onPreviewCard} />
            <InFrontActionStack
              actions={player.inFrontActions}
              canDiscardCallousGuards={canDiscardCallousGuards}
              onCardClick={(action) => onPreviewCard?.(action.card)}
              onDiscardCallousGuards={onDiscardCallousGuards}
            />
          </div>
        ) : (
          <p className="text-sm text-stone-600">No nobles collected yet.</p>
        )}
      </div>

    </Card>
  );
}
