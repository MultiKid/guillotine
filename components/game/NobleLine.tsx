import { Card } from "@/components/ui/Card";
import { CardImage } from "@/components/ui/CardImage";
import { getNobleColorStyle, selectedNobleColorStyle } from "@/lib/cards/nobleColors";
import { getNoblePointText } from "@/lib/game/scoring";
import type { ValidActionTarget } from "@/lib/game/effects";
import type { ActionTarget, CardInstance, CardInstanceId, NobleCard } from "@/lib/game/types";

type NobleLineProps = {
  nobles: CardInstance<NobleCard>[];
  validTargets?: ValidActionTarget[];
  selectedNobleTargetId?: CardInstanceId;
  onPlayTarget?: (target: ActionTarget) => void;
  onPreviewCard?: (card: NobleCard) => void;
  onSelectNobleTarget?: (instanceId: CardInstanceId) => void;
};

export function NobleLine({
  nobles,
  validTargets = [],
  selectedNobleTargetId,
  onPlayTarget,
  onPreviewCard,
  onSelectNobleTarget,
}: NobleLineProps) {
  const movementTargets = validTargets.filter(isLineMovementTarget);
  const movementTargetIds = new Set(movementTargets.map((target) => getTargetNobleId(target)).filter(Boolean));
  const selectedLandingTargets = selectedNobleTargetId
    ? movementTargets.filter((target) => getTargetNobleId(target) === selectedNobleTargetId)
    : [];
  const landingByPosition = new Map(selectedLandingTargets.map((target) => [target.toPosition, target]));
  const highlightedNobleIds = new Set(
    validTargets
      .filter((target) => !isLineMovementTarget(target))
      .map((target) => ("instanceId" in target.target ? target.target.instanceId : "")),
  );

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Noble Line</h2>
        <span className="text-sm text-stone-600">Front noble is on the left</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-12">
        {nobles.map((noble, index) => {
          const position = index + 1;
          const isMovementTarget = movementTargetIds.has(noble.instanceId);
          const landingTarget = landingByPosition.get(position);
          const isSelectedMovementTarget = selectedNobleTargetId === noble.instanceId;
          const isValidTarget = highlightedNobleIds.has(noble.instanceId) || isMovementTarget || Boolean(landingTarget);
          const colorStyle = isValidTarget ? selectedNobleColorStyle : getNobleColorStyle(noble.card.colorCategory);

          return (
            <div className={`min-h-28 rounded-md border p-2 transition-colors ${colorStyle}`} key={noble.instanceId}>
              <div className="text-[10px] font-semibold uppercase text-stone-500">Pos {position}</div>
              <button
                className={`mt-1 block w-full rounded-md text-left transition ${
                  isMovementTarget || landingTarget ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500" : "cursor-default"
                }`}
                disabled={!isMovementTarget && !landingTarget}
                onClick={() => {
                  if (landingTarget) {
                    onPlayTarget?.(landingTarget.target);
                    return;
                  }

                  if (isMovementTarget) {
                    onSelectNobleTarget?.(noble.instanceId);
                  }
                }}
                type="button"
              >
                <CardImage
                  alt={noble.card.name}
                  imageClassName={`aspect-[5/7] border shadow-sm ${
                    isSelectedMovementTarget ? "border-amber-700 ring-2 ring-amber-500" : "border-stone-200"
                  }`}
                  imagePath={noble.card.imagePath}
                >
                  <div className="min-h-20 rounded-md bg-white/60 p-2">
                    <h3 className="break-words text-sm font-semibold leading-tight text-stone-950">{noble.card.name}</h3>
                    <p className="mt-1 text-xs text-stone-700">{getNoblePointText(noble)} pts</p>
                  </div>
                </CardImage>
              </button>
              {isMovementTarget && !selectedNobleTargetId ? <p className="mt-2 text-xs font-semibold text-amber-800">Choose noble</p> : null}
              {isSelectedMovementTarget ? <p className="mt-2 text-xs font-semibold text-amber-800">Selected</p> : null}
              {landingTarget ? (
                <button
                  className="mt-2 w-full rounded-md border border-amber-500 bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-200"
                  onClick={() => onPlayTarget?.(landingTarget.target)}
                  type="button"
                >
                  Move here
                </button>
              ) : null}
              {!isMovementTarget && !landingTarget ? (
                <button
                  className="mt-2 text-xs font-semibold text-stone-500 hover:text-stone-900"
                  onClick={() => onPreviewCard?.(noble.card)}
                  type="button"
                >
                  Preview
                </button>
              ) : null}
            </div>
          );
        })}
        {nobles.length === 0 ? <p className="text-sm text-stone-600">No nobles remain.</p> : null}
      </div>
    </Card>
  );
}

function isLineMovementTarget(target: ValidActionTarget): boolean {
  return (
    (target.target.type === "move-noble" || target.target.type === "noble") &&
    typeof target.fromPosition === "number" &&
    typeof target.toPosition === "number"
  );
}

function getTargetNobleId(target: ValidActionTarget): CardInstanceId | undefined {
  if (target.target.type === "move-noble" || target.target.type === "noble") {
    return target.target.instanceId;
  }

  return undefined;
}
