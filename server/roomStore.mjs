import { randomUUID } from "node:crypto";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 5;

export function createRoomStore() {
  const rooms = new Map();
  const playerRoomBySocketId = new Map();

  function createRoom({ playerName, socketId }) {
    const roomCode = createUniqueRoomCode(rooms);
    const hostPlayer = createPlayer({ name: playerName, socketId, isHost: true });
    const room = {
      roomCode,
      players: [hostPlayer],
      hostPlayerId: hostPlayer.id,
      status: "lobby",
      gameState: undefined,
      createdAt: Date.now(),
    };

    rooms.set(roomCode, room);
    playerRoomBySocketId.set(socketId, roomCode);

    return { room, playerId: hostPlayer.id };
  }

  function joinRoom({ roomCode, playerName, socketId }) {
    const normalizedRoomCode = normalizeRoomCode(roomCode);
    const room = rooms.get(normalizedRoomCode);

    if (!room) {
      return { error: "Room not found." };
    }

    if (room.status !== "lobby") {
      return { error: "That room has already started." };
    }

    if (room.players.length >= 5) {
      return { error: "That room is full." };
    }

    const player = createPlayer({ name: playerName, socketId, isHost: false });
    room.players.push(player);
    playerRoomBySocketId.set(socketId, room.roomCode);

    return { room, playerId: player.id };
  }

  function startRoom({ roomCode, playerId, createGameState }) {
    const room = rooms.get(normalizeRoomCode(roomCode));

    if (!room) {
      return { error: "Room not found." };
    }

    if (room.hostPlayerId !== playerId) {
      return { error: "Only the host can start the game." };
    }

    if (room.players.length < 2) {
      return { error: "At least 2 players are required." };
    }

    room.status = "started";
    room.gameState = createGameState(room.players);

    return { room };
  }

  function disconnectSocket(socketId) {
    const roomCode = playerRoomBySocketId.get(socketId);

    if (!roomCode) {
      return;
    }

    playerRoomBySocketId.delete(socketId);
    const room = rooms.get(roomCode);

    if (!room) {
      return;
    }

    const player = room.players.find((candidate) => candidate.socketId === socketId);

    if (player) {
      player.isConnected = false;
      player.socketId = undefined;
    }

    if (room.players.every((candidate) => !candidate.isConnected)) {
      rooms.delete(roomCode);
      return;
    }

    if (player?.id === room.hostPlayerId) {
      const nextHost = room.players.find((candidate) => candidate.isConnected);

      if (nextHost) {
        nextHost.isHost = true;
        room.hostPlayerId = nextHost.id;
      }
    }

    return room;
  }

  function getRoom(roomCode) {
    return rooms.get(normalizeRoomCode(roomCode));
  }

  return {
    createRoom,
    disconnectSocket,
    getRoom,
    joinRoom,
    startRoom,
  };
}

export function toRoomSnapshot(room) {
  return {
    roomCode: room.roomCode,
    hostPlayerId: room.hostPlayerId,
    status: room.status,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      isHost: player.id === room.hostPlayerId,
      isConnected: player.isConnected,
    })),
  };
}

function createPlayer({ name, socketId, isHost }) {
  return {
    id: randomUUID(),
    name: sanitizePlayerName(name),
    socketId,
    isHost,
    isConnected: true,
  };
}

function createUniqueRoomCode(rooms) {
  let roomCode = createRoomCode();

  while (rooms.has(roomCode)) {
    roomCode = createRoomCode();
  }

  return roomCode;
}

function createRoomCode() {
  let roomCode = "";

  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    roomCode += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }

  return roomCode;
}

function normalizeRoomCode(roomCode) {
  return String(roomCode ?? "").trim().toUpperCase();
}

function sanitizePlayerName(playerName) {
  const cleanedName = String(playerName ?? "").trim();
  return cleanedName.length > 0 ? cleanedName.slice(0, 24) : "Player";
}
