import type { PlayerGameView } from "@/lib/game/playerView";

export type OnlineRoomPlayer = {
  id: string;
  name: string;
  isHost: boolean;
  isConnected: boolean;
};

export type OnlineRoomSnapshot = {
  roomCode: string;
  players: OnlineRoomPlayer[];
  hostPlayerId: string;
  status: "lobby" | "started";
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
