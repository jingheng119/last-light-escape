# Last Light — server-authoritative multiplayer (experimental branch)

**Branch:** `feature/server-authoritative`

The original game simulation (all 18 floors, Hollows, Dashers, damage, skills,
survivors, relays, soul revival, objectives and victory) now runs inside a
dedicated **Node.js room engine**. Each browser sends movement and action
requests; it does not run enemy or damage logic.

The known-working host-authoritative multiplayer remains unchanged on
`feature/multiplayer-phase1`. The existing Render deployment still serves
that branch until manually switched.

## Local test — Windows CMD

Stop any old `node --watch server.js` process using Ctrl+C first, to release port 3001.

From the **repository root**, run:

```cmd
git fetch origin
git switch --track origin/feature/server-authoritative
cd multiplayer
npm install
npm test
npm start
```

If the branch already exists locally, use `git switch feature/server-authoritative`
instead of `git switch --track ...`.

Then open http://localhost:3001/ in two browsers or two tabs. Create a room,
start, join using the room code and test independently moving both players.
Try dashing near Hollows, taking damage, 5-second soul revival, completing an
elevator and Stage 2 progression.

The new server runs from `server-authoritative.js`; do **not** launch the
old `server.js` relay on this branch.

## What's different

- The server owns the room's full state and runs the **original game's rules** through
  `headless-engine.js`. This adapter removes browser-only rendering/network hooks
  and stubs DOM elements; it does not rewrite the combat mechanics from scratch.
- `game.js` in each browser only sends inputs, predicts its own movement for
  responsiveness, and renders server-owned snapshots.
- Both players' dash, ghost collision, health, level objectives and revival
  are decided by the server. Browsers cannot declare victory or damage.
- The simulation can continue after the room creator disconnects, provided
  another player remains connected.
- One-player rooms use the same simulation as two-player rooms.

## Validation

Run `npm test` for the Node-only gameplay smoke test. It checks room start,
two players, dashing, Stage 2 Floor 1 and Floor 9, and survival after the
original host leaves. Network integration and full real-world co-op gameplay
still require manual testing.

## Online release

The new branch contains a `render.yaml` targeting
`feature/server-authoritative`, but **it is not deployed to the existing live
service automatically**. After successful local testing, you can change the
Render web service's Git branch from `feature/multiplayer-phase1` to
`feature/server-authoritative`, deploy, and check
`https://last-light-online-trial.onrender.com/health` for
`"authority":"server"`.

**Do not switch Render yet if the local server isn't working.** The original
online multiplayer can remain available while we verify this new design.

Known limitations: Browser client prediction can still mispredict at walls
or during a dash; server corrections can be visible on slow networks.
Rooms are in memory and can be lost during a Render restart or deploy.
Accounts and reconnection are not yet implemented. Only two players are
supported; public abuse protection and load testing are still pending.
