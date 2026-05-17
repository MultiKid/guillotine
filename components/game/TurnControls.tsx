import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { PlayerId, TurnStep } from "@/lib/game/types";

type TurnControlsProps = {
  canTakeNoble: boolean;
  canUndo: boolean;
  currentPlayerId?: PlayerId;
  turnStep: TurnStep;
  onTakeNoble: (playerId: PlayerId) => void;
  onUndo: () => void;
};

export function TurnControls({
  canTakeNoble,
  canUndo,
  currentPlayerId,
  turnStep,
  onTakeNoble,
  onUndo,
}: TurnControlsProps) {
  return (
    <Card>
      <h2 className="text-lg font-semibold">Turn Controls</h2>
      <p className="mt-1 text-sm text-stone-600">
        {turnStep === "playActionOptional"
          ? "You may play one action card, or take the front noble now."
          : "Action played. Take the front noble to finish the turn."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button disabled={!canTakeNoble || !currentPlayerId} onClick={() => currentPlayerId && onTakeNoble(currentPlayerId)}>
          Take Front Noble
        </Button>
        <Button disabled={!canUndo} onClick={onUndo}>
          Undo Last Action
        </Button>
      </div>
    </Card>
  );
}
