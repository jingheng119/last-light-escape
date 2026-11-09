# Render public beta readiness

The service is configured by the root `render.yaml` to use the
`feature/persistent-match-results` branch, `multiplayer` root directory,
`npm start` start command, and `/health` health-check path.

## Automated checks

`npm test` includes `startup-readiness.test.mjs`. It starts the actual
production server in two independent processes and verifies the HTTP
`/health` response and WebSocket lobby protocol. GitHub Actions runs
this check on pushes to the development branch.

## Check actual Render service settings

In Render > last-light-online-trial > Settings, confirm:
- Repository and branch point to the intended GitHub development branch.
- Root directory is `multiplayer`.
- Start command is `npm start`.
- Health check path is `/health`.
- Auto-deploy is enabled for commits on the deployment branch.
- The database environment variable is set privately (never share its value).

The repository configuration is not proof that an existing manually
created Render service has the same settings: inspect the dashboard.

## Live deployment test

1. After GitHub Actions passes, deploy the new development commit.
2. Confirm Render deploy logs show successful startup and the health
   check returns HTTP 200 JSON with `status: ok`.
3. Open the lobby from two different browser sessions. Confirm both
   can connect to WebSockets, create/join a room and see each other.
4. Leave the service idle long enough for the free instance to sleep,
   then retry `/health` and the lobby, observing the delay.
5. Confirm that a new commit triggers a deploy without selecting
   Manual Deploy. Repeat a readiness check after this deploy.

Do not call a sleeping free instance a failed application merely because
its first request is delayed. However, indefinite request timeouts,
deploy failures, or recurring manual-redeploy requirements still block
the hosting-reliability gate. Record Render's event and application logs
and the time of any failure.

## Important caveats

- Completed matches and profiles live in Neon; they survive deployments.
- Active rooms and game simulation are in server memory and do **not**
  survive a full Render process restart or free-instance spin-down.
- The test verifies process startup, not Render's infrastructure uptime,
  cold-start reliability, automatic deploy settings or internet latency.
- For dependable uninterrupted public rooms, use an always-on instance;
  the free instance is suitable for a limited trial with clear caveats.
