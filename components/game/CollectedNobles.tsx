import { Card } from "@/components/ui/Card";
import { CollectedNobleStacks, InFrontActionStack } from "@/components/game/CollectedNobleStacks";
import type { BaseCard, Player } from "@/lib/game/types";

type CollectedNoblesProps = {
  player?: Player;
  onPreviewCard?: (card: BaseCard) => void;
};

export function CollectedNobles({ player, onPreviewCard }: CollectedNoblesProps) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Collected Nobles</h2>
        <span className="text-sm font-semibold text-stone-700">{player?.score ?? 0} pts</span>
      </div>

      <div className="mt-3 max-h-[33rem] overflow-auto">
        {player && (player.collectedNobles.length > 0 || player.inFrontActions.length > 0) ? (
          <div className="flex flex-wrap items-start gap-3">
            <CollectedNobleStacks nobles={player.collectedNobles} onPreviewCard={onPreviewCard} />
            <InFrontActionStack actions={player.inFrontActions} onCardClick={(action) => onPreviewCard?.(action.card)} />
          </div>
        ) : (
          <p className="text-sm text-stone-600">No nobles collected yet.</p>
        )}
      </div>
    </Card>
  );
}
