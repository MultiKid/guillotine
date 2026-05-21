import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { actionEffectRequiresTarget } from "@/lib/game/effects";
import type { ValidActionTarget } from "@/lib/game/effects";
import type { ActionCard, ActionTarget, CardInstance, CardInstanceId, Player } from "@/lib/game/types";

type ActionHandProps = {
  canPlayActions: boolean;
  player?: Player;
  selectedActionCardId?: CardInstanceId;
  validTargets: ValidActionTarget[];
  canPlayActionCard: (card: CardInstance<ActionCard>) => boolean;
  onSelectAction: (cardId: CardInstanceId) => void;
  onPlayAction: (cardId: CardInstanceId, target?: ActionTarget) => void;
  onReloadTestHand: () => void;
};

export function ActionHand({
  canPlayActions,
  player,
  selectedActionCardId,
  validTargets,
  canPlayActionCard,
  onSelectAction,
  onPlayAction,
  onReloadTestHand,
}: ActionHandProps) {
  const selectedAction = player?.hand.find((action) => action.instanceId === selectedActionCardId);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{player ? `${player.name}'s Hand` : "Action Hand"}</h2>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-sm text-stone-600">{canPlayActions ? "May play one action" : "Action already played"}</span>
          <Button disabled={!player} onClick={onReloadTestHand}>
            Reload Test Hand
          </Button>
        </div>
      </div>

      {selectedAction ? (
        <div className="mt-3 rounded-md border border-amber-400 bg-amber-50 p-3">
          <h3 className="font-semibold">Choose target for {selectedAction.card.name}</h3>
          <p className="mt-1 text-sm text-stone-700">Only legal movement targets are shown.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {validTargets.map((target) => (
              <Button key={`${target.target.type}-${target.target.type === "move-noble" ? target.target.instanceId : target.label}-${target.toPosition}`} onClick={() => onPlayAction(selectedAction.instanceId, target.target)}>
                {target.label}
              </Button>
            ))}
          </div>
          {validTargets.length === 0 ? <p className="mt-2 text-sm text-stone-600">No legal targets for this card right now.</p> : null}
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {player?.hand.map((action) => {
          const requiresTarget = actionEffectRequiresTarget(action.card.effectKey);
          const isSelected = action.instanceId === selectedActionCardId;
          const isPlayable = canPlayActions && canPlayActionCard(action);

          return (
            <div
              className={`rounded-md border p-3 ${isSelected ? "border-amber-600 bg-amber-100" : "border-amber-300 bg-amber-50"}`}
              key={action.instanceId}
            >
              <h3 className="font-semibold leading-snug">{action.card.name}</h3>
              <p className="mt-1 text-sm text-stone-600">{action.card.description}</p>
              <Button
                className="mt-3 w-full"
                disabled={!isPlayable}
                onClick={() => (requiresTarget ? onSelectAction(action.instanceId) : onPlayAction(action.instanceId))}
              >
                {isPlayable ? (requiresTarget ? "Choose Target" : "Play Card") : "No Legal Play"}
              </Button>
            </div>
          );
        })}
        {player && player.hand.length === 0 ? <p className="text-sm text-stone-600">No action cards in hand.</p> : null}
      </div>
    </Card>
  );
}
