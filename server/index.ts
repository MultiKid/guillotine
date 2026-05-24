import { createServer } from "node:http";
import next from "next";
import { Server as SocketServer } from "socket.io";
import { createPlayerGameView } from "@/lib/game/playerView";
import type { ActionTarget, CardInstanceId, PlayerId } from "@/lib/game/types";
import { applyOnlineGameCommand, createOnlineGameState } from "./onlineEngine";
import { createRoomStore, toRoomSnapshot } from "./roomStore";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? (dev ? "127.0.0.1" : "0.0.0.0");
const port = Number(process.env.PORT ?? 3000);
const nextApp = next({ dev, hostname, port });
const handle = nextApp.getRequestHandler();
const roomStore = createRoomStore();

void startServer();

async function startServer() {
  await nextApp.prepare();

  const httpServer = createServer((request, response) => {
    handle(request, response);
  });

  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.SOCKET_CORS_ORIGIN ?? true,
    },
  });

  io.on("connection", (socket) => {
    socket.on("room:create", ({ playerName } = {}, reply?: (response: unknown) => void) => {
      const result = roomStore.createRoom({ playerName: String(playerName ?? ""), socketId: socket.id });
      socket.join(result.room.roomCode);

      const payload = {
        ok: true,
        room: toRoomSnapshot(result.room),
        playerId: result.playerId,
      };

      reply?.(payload);
      io.to(result.room.roomCode).emit("room:updated", payload.room);
    });

    socket.on("room:join", ({ roomCode, playerName } = {}, reply?: (response: unknown) => void) => {
      const result = roomStore.joinRoom({
        roomCode: String(roomCode ?? ""),
        playerName: String(playerName ?? ""),
        socketId: socket.id,
      });

      if (result.error || !result.room || !result.playerId) {
        reply?.({ ok: false, error: result.error ?? "Could not join room." });
        return;
      }

      socket.join(result.room.roomCode);

      const payload = {
        ok: true,
        room: toRoomSnapshot(result.room),
        playerId: result.playerId,
      };

      reply?.(payload);
      io.to(result.room.roomCode).emit("room:updated", payload.room);
    });

    socket.on("room:quick-join", ({ playerName } = {}, reply?: (response: unknown) => void) => {
      const result = roomStore.quickJoinRoom({ playerName: String(playerName ?? ""), socketId: socket.id });
      socket.join(result.room.roomCode);

      const payload = {
        ok: true,
        room: toRoomSnapshot(result.room),
        playerId: result.playerId,
      };

      reply?.(payload);
      io.to(result.room.roomCode).emit("room:updated", payload.room);
    });

    socket.on("room:start", ({ roomCode, playerId } = {}, reply?: (response: unknown) => void) => {
      const result = roomStore.startRoom({
        roomCode: String(roomCode ?? ""),
        playerId: String(playerId ?? ""),
        createGameState: createOnlineGameState,
      });

      if (result.error || !result.room?.gameState) {
        reply?.({ ok: false, error: result.error ?? "Could not start room." });
        return;
      }

      const roomSnapshot = toRoomSnapshot(result.room);
      const starterView = createPlayerGameView(result.room.gameState, String(playerId ?? ""));

      reply?.({ ok: true, room: roomSnapshot, playerId, gameView: starterView });
      io.to(result.room.roomCode).emit("room:started", roomSnapshot);
      io.to(result.room.roomCode).emit("room:updated", roomSnapshot);
      emitGameViews(io, result.room);
    });

    socket.on("game:view:request", ({ roomCode, playerId } = {}, reply?: (response: unknown) => void) => {
      const room = roomStore.getRoom(String(roomCode ?? ""));

      if (!room?.gameState) {
        reply?.({ ok: false, error: "Game has not started yet." });
        return;
      }

      const gamePlayer = room.gameState.players.find((player) => player.id === playerId);

      if (!gamePlayer) {
        reply?.({ ok: false, error: "Player not found in game." });
        return;
      }

      reply?.({ ok: true, gameView: createPlayerGameView(room.gameState, gamePlayer.id) });
    });

    socket.on(
      "game:take-front-noble",
      ({ roomCode, playerId, pendingReorder } = {}, reply?: (response: unknown) => void) => {
        const reorder =
          pendingReorder &&
          typeof pendingReorder === "object" &&
          "cardId" in pendingReorder &&
          "reorderedNobleIds" in pendingReorder &&
          Array.isArray(pendingReorder.reorderedNobleIds)
            ? {
                cardId: String(pendingReorder.cardId ?? "") as CardInstanceId,
                reorderedNobleIds: pendingReorder.reorderedNobleIds.map((instanceId: unknown) => String(instanceId) as CardInstanceId),
              }
            : undefined;

        applyCommandAndReply(
          io,
          String(roomCode ?? ""),
          String(playerId ?? ""),
          reorder
            ? {
                type: "CONFIRM_REORDER_AND_TAKE_FRONT_NOBLE",
                playerId: String(playerId ?? ""),
                cardId: reorder.cardId,
                reorderedNobleIds: reorder.reorderedNobleIds,
              }
            : { type: "TAKE_FRONT_NOBLE", playerId: String(playerId ?? "") },
          reply,
        );
      },
    );

    socket.on(
      "game:play-action-card",
      (
        { roomCode, playerId, cardId, target } = {},
        reply?: (response: unknown) => void,
      ) => {
        applyCommandAndReply(
          io,
          String(roomCode ?? ""),
          String(playerId ?? ""),
          {
            type: "PLAY_ACTION_CARD",
            playerId: String(playerId ?? ""),
            cardId: String(cardId ?? "") as CardInstanceId,
            target: target as ActionTarget | undefined,
          },
          reply,
        );
      },
    );

    socket.on("game:reload-test-hand", ({ roomCode, playerId } = {}, reply?: (response: unknown) => void) => {
      applyCommandAndReply(
        io,
        String(roomCode ?? ""),
        String(playerId ?? ""),
        {
          type: "RELOAD_TEST_HAND",
          playerId: String(playerId ?? ""),
        },
        reply,
      );
    });

    socket.on("game:end-turn", ({ roomCode, playerId } = {}, reply?: (response: unknown) => void) => {
      applyCommandAndReply(io, String(roomCode ?? ""), String(playerId ?? ""), { type: "END_TURN", playerId: String(playerId ?? "") }, reply);
    });

    socket.on("game:discard-callous-guards", ({ roomCode, playerId, cardId } = {}, reply?: (response: unknown) => void) => {
      applyCommandAndReply(
        io,
        String(roomCode ?? ""),
        String(playerId ?? ""),
        {
          type: "DISCARD_CALLOUS_GUARDS",
          playerId: String(playerId ?? ""),
          cardId: String(cardId ?? "") as CardInstanceId,
        },
        reply,
      );
    });

    socket.on("game:resolve-infighting", ({ roomCode, playerId, cardIds } = {}, reply?: (response: unknown) => void) => {
      applyCommandAndReply(
        io,
        String(roomCode ?? ""),
        String(playerId ?? ""),
        {
          type: "RESOLVE_INFIGHTING",
          playerId: String(playerId ?? ""),
          cardIds: Array.isArray(cardIds) ? cardIds.map((cardId) => String(cardId) as CardInstanceId) : [],
        },
        reply,
      );
    });

    socket.on("game:resolve-clerical-error-return", ({ roomCode, playerId, nobleId } = {}, reply?: (response: unknown) => void) => {
      applyCommandAndReply(
        io,
        String(roomCode ?? ""),
        String(playerId ?? ""),
        {
          type: "RESOLVE_CLERICAL_ERROR_RETURN",
          playerId: String(playerId ?? ""),
          nobleId: nobleId ? String(nobleId) as CardInstanceId : undefined,
        },
        reply,
      );
    });

    socket.on("game:resolve-innocent-victim-discard", ({ roomCode, playerId, cardId } = {}, reply?: (response: unknown) => void) => {
      applyCommandAndReply(
        io,
        String(roomCode ?? ""),
        String(playerId ?? ""),
        {
          type: "RESOLVE_INNOCENT_VICTIM_DISCARD",
          playerId: String(playerId ?? ""),
          cardId: cardId ? String(cardId) as CardInstanceId : undefined,
        },
        reply,
      );
    });

    socket.on("game:resolve-clown-gift", ({ roomCode, playerId, targetPlayerId } = {}, reply?: (response: unknown) => void) => {
      applyCommandAndReply(
        io,
        String(roomCode ?? ""),
        String(playerId ?? ""),
        {
          type: "RESOLVE_CLOWN_GIFT",
          playerId: String(playerId ?? ""),
          targetPlayerId: String(targetPlayerId ?? ""),
        },
        reply,
      );
    });

    socket.on("disconnect", () => {
      const room = roomStore.disconnectSocket(socket.id);

      if (room) {
        io.to(room.roomCode).emit("room:updated", toRoomSnapshot(room));
      }
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`Guillotine server listening on http://${hostname}:${port}`);
  });
}

function applyCommandAndReply(
  io: SocketServer,
  roomCode: string,
  playerId: PlayerId,
  command: Parameters<typeof applyOnlineGameCommand>[1],
  reply?: (response: unknown) => void,
) {
  const room = roomStore.getRoom(roomCode);

  if (!room?.gameState) {
    reply?.({ ok: false, error: "Game has not started yet." });
    return;
  }

  const result = applyOnlineGameCommand(room.gameState, command);

  if (result.error) {
    reply?.({ ok: false, error: result.error });
    return;
  }

  room.gameState = result.state;
  reply?.({ ok: true, gameView: createPlayerGameView(room.gameState, playerId) });
  emitGameViews(io, room);
}

function emitGameViews(io: SocketServer, room: { gameState?: NonNullable<ReturnType<typeof roomStore.getRoom>>["gameState"]; players: Array<{ id: string; socketId?: string; isConnected: boolean }> }) {
  if (!room.gameState) {
    return;
  }

  const gameState = room.gameState;

  room.players.forEach((roomPlayer) => {
    if (!roomPlayer.socketId || !roomPlayer.isConnected) {
      return;
    }

    const gamePlayer = gameState.players.find((player) => player.id === roomPlayer.id);

    if (!gamePlayer) {
      return;
    }

    io.to(roomPlayer.socketId).emit("game:view", createPlayerGameView(gameState, gamePlayer.id));
  });
}
