import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { PlayerId, TurnStep } from "@/lib/game/types";

type TurnControlsProps = {
  canTakeNoble: boolean;
  currentPlayerId?: PlayerId;
  turnStep: TurnStep;
  onTakeNoble: (playerId: PlayerId) => void;
};

export function TurnControls({
  canTakeNoble,
  currentPlayerId,
  turnStep,
  onTakeNoble,
}: TurnControlsProps) {
  return (
    <Card>
      <h2 className="text-lg font-semibold">Turn Controls</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button disabled={!canTakeNoble || !currentPlayerId} onClick={() => currentPlayerId && onTakeNoble(currentPlayerId)}>
          Take Front Noble
        </Button>
      </div>
    </Card>
  );
}
