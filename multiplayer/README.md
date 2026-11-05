# Last Light multiplayer — Phase 1

This is a separate, experimental two-player WebSocket demo. The public single-player Hollow Ward game is unchanged.

## Run on Windows

1. Install Node.js (version 20 or later).
2. Download or clone the feature/multiplayer-phase1 branch.
3. Open Command Prompt or PowerShell in the multiplayer folder.
4. Run: npm install
5. Run: npm start
6. Open http://localhost:3001 in two browser tabs.
7. Create a room in the first tab. Copy the room code or link to the second tab, then join.
8. Move both players with WASD or arrow keys.

The server must stay running for this local test. We have not deployed a cloud server yet.

## What this milestone demonstrates

- Two clients can create/join a private six-character room.
- Server owns movement and sends updated locations to each browser at 20Hz.
- Rooms allow up to two players and are removed when empty.
- Different player colors and a shared canvas.

## Not implemented yet

- Maze walls and Hollow/Dasher enemies
- Shared abilities, attacks, objectives and stage completion
- User registration, persistence or leaderboard
- Reconnection, production-grade rate limits, access control and protection against abuse
- Cloud hosting for 24/7 access

Do not advertise this demonstration server as a production game. GitHub Pages cannot run the WebSocket server; production requires a separate HTTPS/WSS host.

Next step: port the real game maze and server-authoritative collisions, then implement co-op objectives and hosting.
