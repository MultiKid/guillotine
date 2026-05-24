import type { GameCommand, PlayerId } from "@/lib/game/types";
import type { PlayerGameView } from "@/lib/game/playerView";

export type RoomCode = string;
export type ClientCommandId = string;

export interface ClientGameCommandEnvelope {
  roomCode: RoomCode;
  playerId: PlayerId;
  commandId: ClientCommandId;
  command: GameCommand;
}

export type ServerGameMessage =
  | {
      type: "GAME_VIEW_UPDATED";
      roomCode: RoomCode;
      playerId: PlayerId;
      view: PlayerGameView;
    }
  | {
      type: "COMMAND_REJECTED";
      roomCode: RoomCode;
      playerId: PlayerId;
      commandId: ClientCommandId;
      reason: string;
    };
