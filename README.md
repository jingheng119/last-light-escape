# Last Light: The Hollow Ward — Multiplayer Beta

Last Light is an original browser survival and escape game with **27 floors across three stages**, eight playable roles, solo play, and cooperative multiplayer for up to five players.

## Play the beta

- [Launch Last Light](https://last-light-online-trial.onrender.com/)
- [How to play](https://last-light-online-trial.onrender.com/how-to-play)

The online beta is served from the [`multiplayer/`](multiplayer/) directory. This folder contains the current game, browser assets, server-authoritative simulation, automated tests, and instructions.

## Repository structure

- `multiplayer/` — Current online game, server, and tests
- `.github/workflows/` — Automated multiplayer and browser smoke tests
- `render.yaml` — Render deployment configuration
- `LICENSE` — Project license

The earlier standalone single-player website is preserved on the **`main` branch**. It has intentionally been removed from this multiplayer beta development branch to avoid confusion.

## Development

```bash
cd multiplayer
npm install
npm test
npm start
```

The beta deployment uses Render's `feature/persistent-match-results` branch with `multiplayer` as the working directory. Never commit database secrets or private recovery keys.

## Release checks

Run `npm test` from `multiplayer/` and confirm both GitHub Actions workflows pass before inviting testers. Developer `M`-shortcut runs are testing-only and must not be written to the Neon matches database or competitive leaderboards.
