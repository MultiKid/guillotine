import { randomUUID } from "node:crypto";
import type { GameState } from "@/lib/game/types";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 5;

export type RoomStatus = "lobby" | "started";

export type RoomPlayer = {
  id: string;
  name: string;
  socketId?: string;
  isConnected: boolean;
};

export type Room = {
  roomCode: string;
  players: RoomPlayer[];
  hostPlayerId: string;
  status: RoomStatus;
  gameState?: GameState;
  createdAt: number;
};

export function createRoomStore() {
  const rooms = new Map<string, Room>();
  const playerRoomBySocketId = new Map<string, string>();

  function createRoom({ playerName, socketId }: { playerName: string; socketId: string }) {
    const roomCode = createUniqueRoomCode(rooms);
    const hostPlayer = createPlayer({ name: playerName, socketId });
    const room: Room = {
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

  function joinRoom({ roomCode, playerName, socketId }: { roomCode: string; playerName: string; socketId: string }) {
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

    const player = createPlayer({ name: playerName, socketId });
    room.players.push(player);
    playerRoomBySocketId.set(socketId, room.roomCode);

    return { room, playerId: player.id };
  }

  function rejoinRoom({ roomCode, playerName, socketId }: { roomCode: string; playerName: string; socketId: string }) {
    const room = rooms.get(normalizeRoomCode(roomCode));

    if (!room) {
      return { error: "Room not found." };
    }

    const sanitizedName = sanitizePlayerName(playerName);
    const player = room.players.find(
      (candidate) => !candidate.isConnected && candidate.name.toLowerCase() === sanitizedName.toLowerCase(),
    );

    if (!player) {
      return { error: "No disconnected player with that name was found in this room." };
    }

    player.socketId = socketId;
    player.isConnected = true;
    playerRoomBySocketId.set(socketId, room.roomCode);

    return { room, playerId: player.id };
  }

  function quickJoinRoom({ playerName, socketId }: { playerName: string; socketId: string }) {
    const waitingRoom = Array.from(rooms.values())
      .filter((room) => room.status === "lobby" && room.players.length < 5)
      .sort((firstRoom, secondRoom) => firstRoom.createdAt - secondRoom.createdAt)[0];

    if (!waitingRoom) {
      return createRoom({ playerName, socketId });
    }

    const player = createPlayer({ name: playerName, socketId });
    waitingRoom.players.push(player);
    playerRoomBySocketId.set(socketId, waitingRoom.roomCode);

    return { room: waitingRoom, playerId: player.id };
  }

  function startRoom({
    roomCode,
    playerId,
    createGameState,
  }: {
    roomCode: string;
    playerId: string;
    createGameState: (players: RoomPlayer[]) => GameState;
  }) {
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

  function disconnectSocket(socketId: string): Room | undefined {
    const roomCode = playerRoomBySocketId.get(socketId);

    if (!roomCode) {
      return undefined;
    }

    playerRoomBySocketId.delete(socketId);
    const room = rooms.get(roomCode);

    if (!room) {
      return undefined;
    }

    const player = room.players.find((candidate) => candidate.socketId === socketId);

    if (player) {
      player.isConnected = false;
      player.socketId = undefined;
    }

    if (room.players.every((candidate) => !candidate.isConnected)) {
      rooms.delete(roomCode);
      return undefined;
    }

    if (player?.id === room.hostPlayerId) {
      const nextHost = room.players.find((candidate) => candidate.isConnected);

      if (nextHost) {
        room.hostPlayerId = nextHost.id;
      }
    }

    return room;
  }

  function getRoom(roomCode: string) {
    return rooms.get(normalizeRoomCode(roomCode));
  }

  return {
    createRoom,
    disconnectSocket,
    getRoom,
    joinRoom,
    quickJoinRoom,
    rejoinRoom,
    startRoom,
  };
}

export function toRoomSnapshot(room: Room) {
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

function createPlayer({ name, socketId }: { name: string; socketId: string }): RoomPlayer {
  return {
    id: randomUUID(),
    name: sanitizePlayerName(name),
    socketId,
    isConnected: true,
  };
}

function createUniqueRoomCode(rooms: Map<string, Room>) {
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

function normalizeRoomCode(roomCode: string) {
  return String(roomCode ?? "").trim().toUpperCase();
}

function sanitizePlayerName(playerName: string) {
  const cleanedName = String(playerName ?? "").trim();
  return cleanedName.length > 0 ? cleanedName.slice(0, 24) : "Player";
}
