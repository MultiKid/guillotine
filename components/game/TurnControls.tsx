import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { PlayerId } from "@/lib/game/types";

type TurnControlsProps = {
  canTakeNoble: boolean;
  canUndo: boolean;
  currentPlayerId?: PlayerId;
  onTakeNoble: (playerId: PlayerId) => void;
  onUndo: () => void;
};

export function TurnControls({
  canTakeNoble,
  canUndo,
  currentPlayerId,
  onTakeNoble,
  onUndo,
}: TurnControlsProps) {
  return (
    <Card>
      <h2 className="text-lg font-semibold">Turn Controls</h2>
      <p className="mt-1 text-sm text-stone-600">Action card effects are not active yet. Take the front noble to complete a turn.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button disabled>Play Action</Button>
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
