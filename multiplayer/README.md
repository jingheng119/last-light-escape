# Last Light — online multiplayer trial

This branch contains the **original full game** with room-based 1–2 player online co-op. The single-player public GitHub Pages website on `main` is unchanged.

## Play locally

```cmd
git pull
cd multiplayer
npm install
npm start
```

Open `http://localhost:3001/`, create a room, start, then share the room code with a second player on the **same network**. For online players, deploy below.

## Deploy online with Render

A `render.yaml` Blueprint is included at the repository root. It declares one **Free** Node.js web service in **Singapore**, running the multiplayer app from `multiplayer/`.

1. Log in to https://dashboard.render.com/ using your own account.
2. Choose **New → Blueprint**, connect GitHub if prompted, and select `jingheng119/last-light-escape`.
3. In Render's branch selection, select **`feature/multiplayer-phase1`**, not `main`. Confirm it finds the root `render.yaml`.
4. Review the service **last-light-online-trial**, region **Singapore**, plan **Free**. Approve/deploy the Blueprint. No custom domain is needed.
5. After status is **Live**, click the public `https://<your-assigned-name>.onrender.com` URL shown by Render. Do **not** assume the name until Render supplies it.
6. Player 1 opens the service URL, clicks **Create room**, and starts the game.
7. Share the complete invite link shown by the game with player 2, who opens it on another computer/network and clicks **Join room**. Alternatively, share the six-character room code.
8. Test player movement, shared objectives, soul revival, elevator rules, and the victory screen.
9. Subsequent commits to `feature/multiplayer-phase1` should trigger Render redeployment if auto-deploy remains enabled. Your local `git pull` is not required to update Render.

You can alternatively create a **Web Service** manually, using these settings: repository `jingheng119/last-light-escape`; branch `feature/multiplayer-phase1`; root directory `multiplayer`; runtime Node; build command `npm install --omit=dev`; start command `npm start`; region Singapore; instance Free; health check path `/health`.

**Free hosting behavior:** Render can spin down after 15 minutes with no inbound HTTP request or WebSocket messages. Waking it can take roughly a minute. Active two-player sessions send messages, so they generally remain active, but platform restarts, deploys, or disconnections can still end a session. Render has usage quotas, and free infrastructure is not for production. Check the dashboard before adding a payment method.

**Architecture caveat:** A hosted room relay lets two people play over the internet but is **not yet a fully server-authoritative multiplayer game**. The player who created the room still runs the actual game physics, Hollows, Dashers, and objectives in their browser. The host must keep the browser running. The Render server provides HTTPS/WSS, room lookup, forwarding, and state delivery. We must extract and move simulation to the Node server before promising host-independent rooms, reliable reconnection, anti-cheat, or persistent matches.

## Gameplay

- One-player rooms use the complete original game.
- Two players share enemies, objectives, floor progression, and victory.
- Both living players must reach the elevator, but eliminated players do not block progression.
- A defeated player's soul remains at the death location. A living teammate can stand nearby for five consecutive seconds to revive them with one heart.
- Only when every player has zero hearts does the entire room lose.

## Troubleshooting

- **Build fails:** verify the branch is `feature/multiplayer-phase1` and Render's root directory is `multiplayer`.
- **Page loads but assets don't:** check `/game.js`, `/style.css`, and `/favicon.svg` at your Render URL.
- **Both players cannot join:** make sure they use the **same Render URL**, not one player on localhost. Rooms exist only within the same server process.
- **A cold-start delay:** this is a known Free tier limitation.
- **The host leaves:** the room closes. This is expected in the current prototype.
- **Unexpected game changes during a deployment:** restart the room after a new release; mid-session updates are not hot-swappable.

## Online movement latency improvement

The joining player now predicts their own movement immediately using the original maze collision rules, and incoming host snapshots gently correct small errors. Actions, enemy hits, core pickups, exits and win/loss decisions remain authoritative on the room host. The goal is to make controls feel less delayed over internet round trips; this does not reduce network ping or make the simulation dedicated-server authoritative. Test both straight corridors, turns against walls, dashing, and reviving after deployment.

## Dash and Hollow timing (online prototype)

The remote client now sends movement position alongside control input and sends its dash direction with each dash request. The host makes **bounded, maze-collision-checked** corrections before applying those commands; this reduces disagreement about where remote players stand when Hollow collision is evaluated. The remote player retains the dash animation for its brief startup window. Hollow visuals extrapolate up to 120 ms based on recent snapshots. These are prototype responsiveness improvements, not a replacement for a dedicated authoritative server. Health changes, damage, survival, and victory still come from the host, so there can be residual delays equal to the network round trip.

After an auto-deployment, hard-refresh both clients and create a new room. Test dash when a Hollow approaches, dash at walls, regular collision damage, and revival. Revert the latest change if collision rules diverge.
