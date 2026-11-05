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

## Separate Lobby and Game pages

The home route `/` is the **Survivor Lobby**. It shows room discovery,
creation, occupancy, and invite-code joining, without displaying the game.
Joining or creating a room navigates to `/play?room=CODE`, a dedicated
game view with controls, HUD, game canvas and room navigation.

Both routes are rendered from the same HTML app on purpose: switching
pages via browser history preserves the same WebSocket connection and
server-assigned player slot. **Survivor Lobby** returns to the lobby
without leaving the room, **Return to game** restores the game screen,
and **Leave Room** exits the room and frees the slot. A direct `/play`
invite in a new browser connects and joins automatically.

The Node server serves `/`, `/play`, and `/play/` with the correct
HTML content type. GitHub's Chromium test verifies route changes,
visibility, preserving live room membership, direct invites and normal
five-player gameplay. A reload will open a new WebSocket session, so
players should use the in-page lobby button rather than browser reload
when switching between lobby and game.

## Player nicknames and lobby roster

Before creating or joining a room, players may set a nickname (up to
20 characters) and choose **Scout** or **Medic** in the lobby. If no nickname
is entered, the server assigns `Survivor 1` through `Survivor 5`.
The browser remembers the nickname for the current tab session; accounts
and permanent player identities are not required.

The active room shows a five-slot roster with each connected survivor's
nickname, role, a **HOST** indicator for the current leader, and **YOU** for
the local player. Empty slots display **Waiting for survivor…**. The server
broadcasts updates whenever somebody joins, leaves, renames, changes class
before starting, or inherits host status after a disconnect. The lobby
remains browseable while already joined.

Role changes are blocked by the server during an active run, while nickname
updates remain available. Names are length-limited and stripped of markup
and control characters on the server; browser display uses `textContent`.

Run `npm test` and the Chromium GitHub Actions suite to check nickname
updates, host handover, room roster rendering and live game behavior.

## Minimal lobby team composition + player nameplates

To keep the public lobby compact, the current room now displays only the
number of **Scouts**, **Medics**, and connected players. The roster of
individual player names is no longer displayed in the lobby. Nickname and
class selection remain available before joining a room.

Inside the game, each player sees their own nickname with **(YOU)** and all
teammates' names above their player sprites. Names remain visible above
fallen souls for identifying who needs revival. The authoritative roster
still distributes nicknames and roles over WebSocket, so edits appear
live without creating another network channel.

The Chromium test verifies the class-only lobby summaries and confirms the
canvas draws actual player nicknames during a real five-person match.
