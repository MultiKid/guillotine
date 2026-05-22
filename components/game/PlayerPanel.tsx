import { Card } from "@/components/ui/Card";
import type { ValidActionTarget } from "@/lib/game/effects";
import type { ActionTarget, Player, PlayerId } from "@/lib/game/types";

type PlayerPanelProps = {
  players: Player[];
  currentPlayerId?: PlayerId;
  playerTargets?: ValidActionTarget[];
  onSelectPlayer?: (playerId: PlayerId) => void;
  onSelectPlayerTarget?: (target: ActionTarget) => void;
};

export function PlayerPanel({
  players,
  currentPlayerId,
  playerTargets = [],
  onSelectPlayer,
  onSelectPlayerTarget,
}: PlayerPanelProps) {
  const isSelectingPlayerTarget = playerTargets.length > 0;
  const targetByPlayerId = new Map(
    playerTargets.flatMap((target) => (target.target.type === "player" ? [[target.target.playerId, target]] : [])),
  );

  return (
    <Card className={isSelectingPlayerTarget ? "border-amber-500 bg-amber-50 shadow-[0_0_18px_rgba(245,158,11,0.18)]" : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Players</h2>
        {isSelectingPlayerTarget ? <span className="text-xs font-semibold text-amber-800">Choose target player</span> : null}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {players.map((player) => {
          const isCurrentPlayer = player.id === currentPlayerId;
          const playerTarget = targetByPlayerId.get(player.id);
          const isValidPlayerTarget = Boolean(playerTarget);
          const isDisabled = isSelectingPlayerTarget ? !isValidPlayerTarget : isCurrentPlayer;

          return (
            <button
              className={`rounded-md border p-2 text-left transition ${
                isSelectingPlayerTarget
                  ? isValidPlayerTarget
                    ? "border-amber-500 bg-amber-100 hover:bg-amber-200"
                    : "cursor-not-allowed border-stone-200 bg-stone-100 opacity-45"
                  : isCurrentPlayer
                    ? "cursor-default border-stone-900 bg-stone-100"
                    : "border-stone-300 bg-white hover:border-stone-900 hover:bg-stone-50"
              }`}
              disabled={isDisabled}
              key={player.id}
              onClick={() =>
                isSelectingPlayerTarget && playerTarget
                  ? onSelectPlayerTarget?.(playerTarget.target)
                  : onSelectPlayer?.(player.id)
              }
              type="button"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="truncate text-sm font-semibold">{player.name}</h3>
                <span className="text-sm font-semibold">{player.score} pts</span>
              </div>
              <p className="mt-1 text-xs text-stone-600">
                {player.hand.length} hand, {player.collectedNobles.length} nobles, {player.inFrontActions.length} in front
              </p>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
