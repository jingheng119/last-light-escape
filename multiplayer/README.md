# Last Light — Five-player co-op lobby (experimental)

**Development branch:** `feature/five-player-lobby`

The game now includes a public lobby listing all active rooms by name, room
code, activity and occupancy, updated live over WebSocket. Anyone can create
a named room or join an existing room using its Join button or a six-character
invite code. Each room supports **up to five players**. The sixth is rejected.
The lobby is part of the existing web game; no new account is required.

Each room owns one dedicated server simulation. Players 1–5 have independent
controls, roles (Scout or Medic), dash cooldowns, hearts and character
positions. Hollows target any living connected player. Any living teammate
may revive a downed one by staying nearby for five seconds. The elevator
requires all living connected teammates to be present. Separate player
colors/labels and lighting are rendered locally in the browser.

The room creator starts the run and advances floors. If the creator leaves,
host controls transfer to the oldest remaining connected player. Joining a
room mid-run is supported, with the joining player spawning at the beginning
of the current floor. Room state remains in memory and is lost if Render
restarts, which is expected with the Free hosting plan.

## Test before deploying

Run from the repository root:

```bash
git fetch origin
git switch --track origin/feature/five-player-lobby
cd multiplayer
npm install
npm test
npm start
```

Open `http://localhost:3001/` in five browser sessions, create a room, join
it from the directory and verify the lobby displays `5 / 5` and disables
its Join button. Test movement, dash, soul revival, Hollow hits, elevator
progression, role selection, departure and host transfer.

Our automated tests exercise the headless five-player game engine, real
WebSocket clients and five Chromium browser sessions. A live internet
playthrough on Render is still required before considering this a stable
release. Do **not** merge directly into `main`; the original game remains
untouched there.

The prior verified **two-player** server-authoritative version remains on
`feature/server-authoritative`, providing an easy rollback path.
