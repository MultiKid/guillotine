# Server

This folder contains the first online multiplayer scaffold.

Implemented now:

- Custom Next.js HTTP server compiled from TypeScript.
- Socket.io attachment.
- In-memory room store.
- Create room.
- Join room by room code.
- Player list updates.
- Host-only start.
- Server-owned `GameState` using the shared game engine.
- Filtered `PlayerGameView` broadcasts.
- Basic online commands routed through the shared reducer.
- Disconnect cleanup.

Not implemented yet:

- Reconnect tokens.
- Persistence/database.
- Authentication or matchmaking.
- Host Screen + Phones mode.
