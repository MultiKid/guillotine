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

export type UndoRequest = {
  id: string;
  requesterId: string;
  requesterName: string;
  approvedPlayerIds: string[];
};

export type Room = {
  roomCode: string;
  roomName: string;
  players: RoomPlayer[];
  hostPlayerId: string;
  status: RoomStatus;
  gameState?: GameState;
  rematchPlayerIds: string[];
  undoRequest?: UndoRequest;
  createdAt: number;
};

export function createRoomStore() {
  const rooms = new Map<string, Room>();
  const playerRoomBySocketId = new Map<string, string>();

  function createRoom({ playerName, roomName, socketId }: { playerName: string; roomName?: string; socketId: string }) {
    const roomCode = createUniqueRoomCode(rooms);
    const hostPlayer = createPlayer({ name: playerName, socketId });
    const room: Room = {
      roomCode,
      roomName: sanitizeRoomName(roomName),
      players: [hostPlayer],
      hostPlayerId: hostPlayer.id,
      status: "lobby",
      gameState: undefined,
      rematchPlayerIds: [],
      undoRequest: undefined,
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

    const sanitizedName = sanitizePlayerName(playerName);
    const existingPlayer = room.players.find((player) => player.name.toLowerCase() === sanitizedName.toLowerCase());

    if (existingPlayer) {
      if (!existingPlayer.isConnected) {
        existingPlayer.socketId = socketId;
        existingPlayer.isConnected = true;
        playerRoomBySocketId.set(socketId, room.roomCode);
        return { room, playerId: existingPlayer.id };
      }

      return { error: "That name is already taken in this room." };
    }

    if (room.status !== "lobby") {
      return { error: "That room has already started." };
    }

    if (room.players.length >= 5) {
      return { error: "That room is full." };
    }

    const player = createPlayer({ name: sanitizedName, socketId });
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

    const sanitizedName = sanitizePlayerName(playerName);
    const duplicateName = waitingRoom.players.some((player) => player.name.toLowerCase() === sanitizedName.toLowerCase());

    if (duplicateName) {
      return createRoom({ playerName, socketId });
    }

    const player = createPlayer({ name: sanitizedName, socketId });
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
    room.rematchPlayerIds = [];
    room.undoRequest = undefined;

    return { room };
  }

  function requestRematch({
    createGameState,
    playerId,
    roomCode,
  }: {
    createGameState: (players: RoomPlayer[]) => GameState;
    playerId: string;
    roomCode: string;
  }) {
    const room = rooms.get(normalizeRoomCode(roomCode));

    if (!room?.gameState) {
      return { error: "Game has not started yet." };
    }

    if (room.gameState.phase !== "gameEnd") {
      return { error: "Rematch is only available after the game ends." };
    }

    if (!room.players.some((player) => player.id === playerId)) {
      return { error: "Player not found." };
    }

    if (!room.rematchPlayerIds.includes(playerId)) {
      room.rematchPlayerIds.push(playerId);
    }

    const isApproved = room.players.every((player) => room.rematchPlayerIds.includes(player.id));

    if (isApproved) {
      room.status = "started";
      room.gameState = createGameState(room.players);
      room.rematchPlayerIds = [];
      room.undoRequest = undefined;
      return { room, started: true };
    }

    return { room, started: false };
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

    if (room.status === "lobby" && player) {
      room.players = room.players.filter((candidate) => candidate.id !== player.id);

      if (room.players.length === 0) {
        rooms.delete(roomCode);
        return undefined;
      }

      if (player.id === room.hostPlayerId) {
        room.hostPlayerId = room.players[0]?.id ?? room.hostPlayerId;
      }

      return room;
    }

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

  function lookupRoom(roomCode: string) {
    return rooms.get(normalizeRoomCode(roomCode));
  }

  function startUndoRequest({ roomCode, playerId }: { roomCode: string; playerId: string }) {
    const room = rooms.get(normalizeRoomCode(roomCode));

    if (!room?.gameState) {
      return { error: "Game has not started yet." };
    }

    const requester = room.players.find((player) => player.id === playerId);

    if (!requester) {
      return { error: "Player not found." };
    }

    if (room.undoRequest) {
      return { error: "An undo request is already pending." };
    }

    if (room.gameState.gameHistory.length === 0) {
      return { error: "There is nothing to undo." };
    }

    room.undoRequest = {
      id: randomUUID(),
      requesterId: requester.id,
      requesterName: requester.name,
      approvedPlayerIds: [],
    };

    return { room, undoRequest: room.undoRequest };
  }

  function respondToUndoRequest({
    approve,
    playerId,
    requestId,
    roomCode,
  }: {
    approve: boolean;
    playerId: string;
    requestId: string;
    roomCode: string;
  }) {
    const room = rooms.get(normalizeRoomCode(roomCode));

    if (!room?.undoRequest) {
      return { error: "There is no undo request pending." };
    }

    if (room.undoRequest.id !== requestId) {
      return { error: "That undo request is no longer active." };
    }

    if (room.undoRequest.requesterId === playerId) {
      return { error: "The requesting player does not vote on their own undo request." };
    }

    const player = room.players.find((candidate) => candidate.id === playerId);

    if (!player) {
      return { error: "Player not found." };
    }

    if (!approve) {
      room.undoRequest = undefined;
      return { room, rejected: true };
    }

    if (!room.undoRequest.approvedPlayerIds.includes(playerId)) {
      room.undoRequest.approvedPlayerIds.push(playerId);
    }

    return { room, approved: true, unanimous: isUndoRequestApprovedByAllConnectedOthers(room) };
  }

  function clearUndoRequest(roomCode: string) {
    const room = rooms.get(normalizeRoomCode(roomCode));

    if (room) {
      room.undoRequest = undefined;
    }

    return room;
  }

  return {
    clearUndoRequest,
    createRoom,
    disconnectSocket,
    getRoom,
    joinRoom,
    quickJoinRoom,
    lookupRoom,
    rejoinRoom,
    requestRematch,
    respondToUndoRequest,
    startUndoRequest,
    startRoom,
  };
}

export function toRoomSnapshot(room: Room) {
  return {
    roomCode: room.roomCode,
    roomName: room.roomName,
    gamePhase: room.gameState?.phase,
    hostPlayerId: room.hostPlayerId,
    status: room.status,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      isHost: player.id === room.hostPlayerId,
      isConnected: player.isConnected,
    })),
    undoRequest: room.undoRequest
      ? {
          id: room.undoRequest.id,
          requesterId: room.undoRequest.requesterId,
          requesterName: room.undoRequest.requesterName,
          approvedPlayerIds: [...room.undoRequest.approvedPlayerIds],
        }
      : undefined,
    rematchPlayerIds: [...room.rematchPlayerIds],
  };
}

function isUndoRequestApprovedByAllConnectedOthers(room: Room): boolean {
  const requiredPlayerIds = room.players
    .filter((player) => player.isConnected && player.id !== room.undoRequest?.requesterId)
    .map((player) => player.id);

  return requiredPlayerIds.every((playerId) => room.undoRequest?.approvedPlayerIds.includes(playerId));
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

function sanitizeRoomName(roomName: string | undefined) {
  const cleanedName = String(roomName ?? "").trim();
  return cleanedName.length > 0 ? cleanedName.slice(0, 36) : "Private Guillotine Room";
}
