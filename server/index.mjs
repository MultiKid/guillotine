import { createServer } from "node:http";
import next from "next";
import { Server as SocketServer } from "socket.io";
import { createPlayerGameView, createReadOnlyOnlineGameState, endTurn, playActionCard, takeFrontNoble } from "./onlineGame.mjs";
import { createRoomStore, toRoomSnapshot } from "./roomStore.mjs";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? (dev ? "127.0.0.1" : "0.0.0.0");
const port = Number(process.env.PORT ?? 3000);
const nextApp = next({ dev, hostname, port });
const handle = nextApp.getRequestHandler();
const roomStore = createRoomStore();

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
  socket.on("room:create", ({ playerName } = {}, reply) => {
    const result = roomStore.createRoom({ playerName, socketId: socket.id });
    socket.join(result.room.roomCode);

    const payload = {
      ok: true,
      room: toRoomSnapshot(result.room),
      playerId: result.playerId,
    };

    reply?.(payload);
    io.to(result.room.roomCode).emit("room:updated", payload.room);
  });

  socket.on("room:join", ({ roomCode, playerName } = {}, reply) => {
    const result = roomStore.joinRoom({ roomCode, playerName, socketId: socket.id });

    if (result.error) {
      reply?.({ ok: false, error: result.error });
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

  socket.on("room:start", ({ roomCode, playerId } = {}, reply) => {
    const result = roomStore.startRoom({ roomCode, playerId, createGameState: createReadOnlyOnlineGameState });

    if (result.error) {
      reply?.({ ok: false, error: result.error });
      return;
    }

    const roomSnapshot = toRoomSnapshot(result.room);
    const starterView = createPlayerGameView(result.room.gameState, playerId);

    reply?.({ ok: true, room: roomSnapshot, playerId, gameView: starterView });
    io.to(result.room.roomCode).emit("room:started", roomSnapshot);
    io.to(result.room.roomCode).emit("room:updated", roomSnapshot);
    emitGameViews(result.room);
  });

  socket.on("game:view:request", ({ roomCode, playerId } = {}, reply) => {
    const room = roomStore.getRoom(roomCode);

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

  socket.on("game:take-front-noble", ({ roomCode, playerId } = {}, reply) => {
    const room = roomStore.getRoom(roomCode);

    if (!room?.gameState) {
      reply?.({ ok: false, error: "Game has not started yet." });
      return;
    }

    const result = takeFrontNoble(room.gameState, playerId);

    if (result.error) {
      reply?.({ ok: false, error: result.error });
      return;
    }

    reply?.({ ok: true, gameView: createPlayerGameView(room.gameState, playerId) });
    emitGameViews(room);
  });

  socket.on("game:play-action-card", ({ roomCode, playerId, cardId, target } = {}, reply) => {
    const room = roomStore.getRoom(roomCode);

    if (!room?.gameState) {
      reply?.({ ok: false, error: "Game has not started yet." });
      return;
    }

    const result = playActionCard(room.gameState, playerId, cardId, target);

    if (result.error) {
      reply?.({ ok: false, error: result.error });
      return;
    }

    reply?.({ ok: true, gameView: createPlayerGameView(room.gameState, playerId) });
    emitGameViews(room);
  });

  socket.on("game:end-turn", ({ roomCode, playerId } = {}, reply) => {
    const room = roomStore.getRoom(roomCode);

    if (!room?.gameState) {
      reply?.({ ok: false, error: "Game has not started yet." });
      return;
    }

    const result = endTurn(room.gameState, playerId);

    if (result.error) {
      reply?.({ ok: false, error: result.error });
      return;
    }

    reply?.({ ok: true, gameView: createPlayerGameView(room.gameState, playerId) });
    emitGameViews(room);
  });

  socket.on("disconnect", () => {
    const room = roomStore.disconnectSocket(socket.id);

    if (room) {
      io.to(room.roomCode).emit("room:updated", toRoomSnapshot(room));
    }
  });
});

function emitGameViews(room) {
  if (!room.gameState) {
    return;
  }

  room.players.forEach((roomPlayer) => {
    if (!roomPlayer.socketId || !roomPlayer.isConnected) {
      return;
    }

    const gamePlayer = room.gameState.players.find((player) => player.id === roomPlayer.id);

    if (!gamePlayer) {
      return;
    }

    io.to(roomPlayer.socketId).emit("game:view", createPlayerGameView(room.gameState, gamePlayer.id));
  });
}

httpServer.listen(port, hostname, () => {
  console.log(`Guillotine server listening on http://${hostname}:${port}`);
});
