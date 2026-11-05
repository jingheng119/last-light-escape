# Last Light — unified game rooms (development prototype)

The same original Hollow Ward game engine now powers a room with either one or two human players. **The public single-player website on main is unchanged.** This is a development integration, not yet a tested public multiplayer release.

## Local test

1. In the repository root on the feature/multiplayer-phase1 branch: `git pull`.
2. In the multiplayer folder: `npm install` (only needed once or if dependencies change).
3. Start: `node --watch server.js`.
4. In Chrome visit http://localhost:3001.
5. Click **Create room**, then **START GAME**. This is a single-player room using the original game, not a separate mode.
6. To invite another player, open another browser tab, enter the six-character code, and click **Join room**. Both tabs should show the original game's maze, Hollows, survivor, power cores and relay.
7. Try WASD, dash, decoy, ability, and interaction on each tab. The host controls floor transitions.

`git pull` in the repository root obtains future updates; refresh both browser tabs after changes. Node watch restarts automatically when the watched server source changes. If the server stops, restart it.

## Current architecture

- Original game reused as `multiplayer/game.js`; original graphics, stages, enemy AI, audio and abilities retained.
- Each room starts with 1 player. A second player can join the room using a code.
- Room host runs the full game simulation. The WebSocket server forwards the second player's input to the host and relays snapshots back.
- Remote player actions and movement are simulated inside the same original game simulation, rather than in a separate simplified maze.

## Important limitations

This is **host-authoritative**, not yet a secure dedicated game server. It depends on the host browser remaining active. The client-trusted simulation is vulnerable to cheating and unsuitable for competitive leaderboards. Hosting the relay in the cloud would not remove this dependency.

No registrations, persistent saves, lobby matchmaking, robust reconnect, touch input verification, network prediction, interpolation, dedicated authoritative simulation or production hardening yet. The prototype now relays each player's Scout/Medic role selection. Multiplayer balance, stage progression and abilities still need hands-on testing. We should subsequently move the simulation into a shared server-side engine while retaining this same room model.

## Next steps

1. Test two players on the original Hollow Ward UI and fix any observed bugs.
2. Add per-player roles, better ally-follow behavior, revives, and reconnection.
3. Move authority into a cloud game server, then deploy it on always-on infrastructure.
4. Add secure accounts and stored progress.

## Team elimination rule (latest)

- With one player, losing the third heart ends the run.
- With two players, a player at zero hearts is eliminated, cannot move or use skills, and watches the living teammate.
- Game over occurs only after both players reach zero hearts.
- A living teammate may finish the floor by completing objectives and reaching the elevator; the eliminated player is not required to stand at the exit.
- An eliminated player returns with one heart at the start of the next floor.
- Reviving teammates during a floor has not been implemented yet.
