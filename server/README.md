# Server

This folder contains the first online multiplayer scaffold.

Implemented now:

- Custom Next.js HTTP server.
- Socket.io attachment.
- In-memory room store.
- Create room.
- Join room by room code.
- Player list updates.
- Host-only start placeholder.
- Disconnect cleanup.

Not implemented yet:

- Gameplay synchronization.
- Server-owned `GameState`.
- Reducer commands over Socket.io.
- Reconnect tokens.
- Persistence/database.
- Authentication or matchmaking.
- Host Screen + Phones mode.
