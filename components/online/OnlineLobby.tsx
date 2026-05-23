"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { OnlineGameReadOnly } from "@/components/online/OnlineGameReadOnly";
import type { PlayerGameView } from "@/lib/game/playerView";
import type { ActionTarget, CardInstanceId } from "@/lib/game/types";
import type { LobbyResponse, OnlineRoomSnapshot } from "@/lib/online/lobbyTypes";

type OnlineLobbyProps = {
  onBackToHome: () => void;
};

type LobbyMode = "create" | "join";

type SocketClient = {
  disconnect: () => void;
  emit: (eventName: string, payload?: unknown, callback?: (response: unknown) => void) => void;
  on: (eventName: string, callback: (...args: unknown[]) => void) => SocketClient;
  off: (eventName: string, callback?: (...args: unknown[]) => void) => SocketClient;
};

export function OnlineLobby({ onBackToHome }: OnlineLobbyProps) {
  const socketRef = useRef<SocketClient>();
  const [socketReady, setSocketReady] = useState(false);
  const [connectionError, setConnectionError] = useState<string | undefined>();
  const [mode, setMode] = useState<LobbyMode>("create");
  const [playerName, setPlayerName] = useState("Player");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [room, setRoom] = useState<OnlineRoomSnapshot | undefined>();
  const [playerId, setPlayerId] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isBusy, setIsBusy] = useState(false);
  const [gameView, setGameView] = useState<PlayerGameView | undefined>();

  const currentPlayer = useMemo(
    () => room?.players.find((player) => player.id === playerId),
    [playerId, room?.players],
  );
  const isHost = Boolean(currentPlayer?.isHost);

  useEffect(() => {
    let isMounted = true;
    let socket: SocketClient | undefined;

    import("socket.io-client")
      .then(({ io }) => {
        if (!isMounted) {
          return;
        }

        socket = io();
        socketRef.current = socket;
        setSocketReady(true);
        setConnectionError(undefined);

        socket.on("room:updated", (nextRoom) => {
          setRoom(nextRoom as OnlineRoomSnapshot);
        });
        socket.on("room:started", (nextRoom) => {
          setRoom(nextRoom as OnlineRoomSnapshot);
        });
        socket.on("game:view", (nextView) => {
          setGameView(nextView as PlayerGameView);
          setIsBusy(false);
        });
      })
      .catch(() => {
        if (isMounted) {
          setConnectionError("Socket.io client is not installed yet. Run npm install before testing Online Mode.");
        }
      });

    return () => {
      isMounted = false;
      socket?.disconnect();
      socketRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (!room || room.status !== "started" || !playerId || gameView) {
      return;
    }

    socketRef.current?.emit(
      "game:view:request",
      {
        roomCode: room.roomCode,
        playerId,
      },
      (response) => {
        const gameViewResponse = response as { ok?: boolean; gameView?: PlayerGameView; error?: string };

        if (gameViewResponse?.ok && gameViewResponse.gameView) {
          setGameView(gameViewResponse.gameView);
          setIsBusy(false);
          return;
        }

        if (gameViewResponse?.error) {
          setError(gameViewResponse.error);
          setIsBusy(false);
        }
      },
    );
  }, [gameView, playerId, room]);

  function createRoom() {
    setIsBusy(true);
    setError(undefined);
    socketRef.current?.emit("room:create", { playerName }, handleLobbyResponse);
  }

  function joinRoom() {
    setIsBusy(true);
    setError(undefined);
    socketRef.current?.emit(
      "room:join",
      {
        playerName,
        roomCode: roomCodeInput,
      },
      handleLobbyResponse,
    );
  }

  function startRoom() {
    if (!room || !playerId) {
      return;
    }

    setIsBusy(true);
    setError(undefined);
    socketRef.current?.emit(
      "room:start",
      {
        roomCode: room.roomCode,
        playerId,
      },
      handleLobbyResponse,
    );
  }

  function handleLobbyResponse(response: unknown) {
    const lobbyResponse = response as LobbyResponse;
    setIsBusy(false);

    if (!lobbyResponse?.ok) {
      setError(lobbyResponse?.error ?? "Something went wrong.");
      return;
    }

    setRoom(lobbyResponse.room);
    setPlayerId(lobbyResponse.playerId);
    if (lobbyResponse.gameView) {
      setGameView(lobbyResponse.gameView);
    }
  }

  return (
    gameView ? (
      <OnlineGameReadOnly
        error={error}
        isBusy={isBusy}
        view={gameView}
        onEndTurn={endTurn}
        onPlayAction={playActionCard}
        onTakeFrontNoble={takeFrontNoble}
      />
    ) : (
    <Card className="mx-auto w-full max-w-4xl">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Online Lobby</h2>
            <p className="mt-1 text-sm text-stone-700">
              Room-code scaffold with server-owned read-only game views. Gameplay commands are not connected yet.
            </p>
          </div>
          <Button onClick={onBackToHome}>Back</Button>
        </div>

        {connectionError ? (
          <div className="rounded-md border border-amber-300 bg-amber-50/60 p-3 text-sm text-amber-950">
            {connectionError}
          </div>
        ) : null}

        {!room ? (
          <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
            <div className="flex rounded-lg border border-stone-300 bg-white/35 p-1 backdrop-blur-sm">
              <button
                className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${mode === "create" ? "bg-white/70 shadow-sm" : "text-stone-600"}`}
                onClick={() => setMode("create")}
                type="button"
              >
                Create
              </button>
              <button
                className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${mode === "join" ? "bg-white/70 shadow-sm" : "text-stone-600"}`}
                onClick={() => setMode("join")}
                type="button"
              >
                Join
              </button>
            </div>

            <div className="grid gap-3 rounded-lg border border-stone-300 bg-white/30 p-4 backdrop-blur-sm">
              <label className="grid gap-1 text-sm font-medium text-stone-700">
                Player Name
                <input
                  className="rounded-md border border-stone-300 bg-white/55 px-3 py-2 text-stone-950 outline-none focus:border-stone-500"
                  maxLength={24}
                  value={playerName}
                  onChange={(event) => setPlayerName(event.target.value)}
                />
              </label>

              {mode === "join" ? (
                <label className="grid gap-1 text-sm font-medium text-stone-700">
                  Room Code
                  <input
                    className="rounded-md border border-stone-300 bg-white/55 px-3 py-2 uppercase tracking-[0.25em] text-stone-950 outline-none focus:border-stone-500"
                    maxLength={5}
                    value={roomCodeInput}
                    onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())}
                  />
                </label>
              ) : null}

              {error ? <p className="text-sm font-medium text-red-800">{error}</p> : null}

              <Button
                disabled={!socketReady || isBusy || playerName.trim().length === 0 || (mode === "join" && roomCodeInput.trim().length === 0)}
                onClick={mode === "create" ? createRoom : joinRoom}
              >
                {isBusy ? "Working..." : mode === "create" ? "Create Room" : "Join Room"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <div className="rounded-lg border border-stone-300 bg-white/35 p-4 text-center backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">Room Code</p>
              <p className="mt-2 text-4xl font-black tracking-[0.25em] text-stone-950">{room.roomCode}</p>
              <p className="mt-3 text-sm text-stone-700">Share this code with friends or family.</p>
            </div>

            <div className="rounded-lg border border-stone-300 bg-white/35 p-4 backdrop-blur-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">Players</h3>
                  <p className="text-sm text-stone-700">{room.players.length}/5 joined</p>
                </div>
                <span className="rounded-full bg-amber-100/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-950">
                  {room.status === "started" ? "Read-only game started" : "Waiting in lobby"}
                </span>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {room.players.map((player) => (
                  <div
                    className={`rounded-md border p-3 ${
                      player.id === playerId ? "border-stone-900 bg-stone-100/45" : "border-stone-300 bg-white/30"
                    }`}
                    key={player.id}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{player.name}</p>
                      <span className="text-xs text-stone-600">{player.isConnected ? "Connected" : "Disconnected"}</span>
                    </div>
                    {player.isHost ? <p className="mt-1 text-xs font-semibold text-amber-900">Host</p> : null}
                  </div>
                ))}
              </div>

              {room.status === "started" ? (
                <div className="mt-4 rounded-md border border-green-300 bg-green-50/60 p-3 text-sm text-green-950">
                  Server-owned game created. Waiting for your filtered player view.
                </div>
              ) : null}

              {error ? <p className="mt-3 text-sm font-medium text-red-800">{error}</p> : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button disabled={!isHost || isBusy || room.players.length < 2} onClick={startRoom}>
                  {isBusy ? "Starting..." : "Start Read-Only Game"}
                </Button>
                {!isHost ? <p className="self-center text-sm text-stone-700">Waiting for host to start.</p> : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
    )
  );

  function takeFrontNoble() {
    if (!room || !playerId) {
      return;
    }

    setIsBusy(true);
    setError(undefined);
    socketRef.current?.emit(
      "game:take-front-noble",
      {
        roomCode: room.roomCode,
        playerId,
      },
      (response) => {
        const commandResponse = response as { ok?: boolean; error?: string; gameView?: PlayerGameView };

        if (!commandResponse?.ok) {
          setError(commandResponse?.error ?? "Could not take the front noble.");
          setIsBusy(false);
          return;
        }

        if (commandResponse.gameView) {
          setGameView(commandResponse.gameView);
          setIsBusy(false);
        }
      },
    );
  }

  function endTurn() {
    if (!room || !playerId) {
      return;
    }

    setIsBusy(true);
    setError(undefined);
    socketRef.current?.emit(
      "game:end-turn",
      {
        roomCode: room.roomCode,
        playerId,
      },
      (response) => {
        const commandResponse = response as { ok?: boolean; error?: string; gameView?: PlayerGameView };

        if (!commandResponse?.ok) {
          setError(commandResponse?.error ?? "Could not end the turn.");
          setIsBusy(false);
          return;
        }

        if (commandResponse.gameView) {
          setGameView(commandResponse.gameView);
          setIsBusy(false);
        }
      },
    );
  }

  function playActionCard(cardId: CardInstanceId, target?: ActionTarget) {
    if (!room || !playerId) {
      return;
    }

    setIsBusy(true);
    setError(undefined);
    socketRef.current?.emit(
      "game:play-action-card",
      {
        roomCode: room.roomCode,
        playerId,
        cardId,
        target,
      },
      (response) => {
        const commandResponse = response as { ok?: boolean; error?: string; gameView?: PlayerGameView };

        if (!commandResponse?.ok) {
          setError(commandResponse?.error ?? "Could not play that action card.");
          setIsBusy(false);
          return;
        }

        if (commandResponse.gameView) {
          setGameView(commandResponse.gameView);
          setIsBusy(false);
        }
      },
    );
  }
}
