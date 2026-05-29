import type { PlayerGameView } from "@/lib/game/playerView";
import type { GamePhase } from "@/lib/game/types";

export type OnlineRoomPlayer = {
  id: string;
  name: string;
  isHost: boolean;
  isConnected: boolean;
};

export type OnlineRoomSnapshot = {
  roomCode: string;
  roomName: string;
  players: OnlineRoomPlayer[];
  gamePhase?: GamePhase;
  hostPlayerId: string;
  status: "lobby" | "started";
  undoRequest?: {
    id: string;
    requesterId: string;
    requesterName: string;
    approvedPlayerIds: string[];
  };
  rematchPlayerIds?: string[];
};

export type LobbyResponse =
  | {
      ok: true;
      room: OnlineRoomSnapshot;
      playerId: string;
      gameView?: PlayerGameView;
    }
  | {
      ok: false;
      error: string;
    };
