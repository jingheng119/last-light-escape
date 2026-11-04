# Last Light: The Hollow Ward

An original three-floor, top-down survival and maze-escape game for the browser. **Version 1.1** adds open ward rooms, directional enemy sight, sound investigation, and last-known-position searches. Inspired by the broad genre of cooperative escape maps, **not** a remake of any Dota 2 or Warcraft game. No copyrighted characters, music, maps or assets are included.

## Play

Open `index.html` in a modern browser, or serve the files using any static HTTP server. No build step, package manager, backend or account required.

### Controls

| Key | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Space | Dash (3.5-second cooldown) |
| E | Activate nearby relay / interact with exit |
| Q | Deploy sound decoy (3 per floor) |
| P / Escape | Pause / resume |
| R | Restart the current floor |
| Enter | Start / resume / advance when a menu is open |

Touchscreen users can use the on-screen directional pad and action buttons.

## Objectives

1. Find every **cyan power core** in the maze.
2. Find and activate the **golden relay** by approaching it and pressing **E**.
3. Reach the **elevator** and press **E** (or walk onto it) after all objectives are complete.
4. Escape three increasingly dangerous floors. You have three health points per floor.

**Enemies:** The Hollows patrol the corridors, pursue players they can see, and investigate sound decoys. Breaking line of sight helps you lose pursuit. Dashing briefly protects you from their touch. The heading in the top-right of the game canvas points toward the next objective. The best complete-game time is stored only in your browser's `localStorage`.

## Publish to GitHub Pages

1. Create a **public repository**, e.g. `last-light-escape`.
2. Upload `index.html`, `style.css`, `game.js`, `favicon.svg`, `README.md` and `LICENSE` into the repository root.
3. In **Settings → Pages**, choose **Deploy from a branch**, `main`, `/ (root)`, and Save.
4. The resulting URL will be `https://YOUR_USERNAME.github.io/last-light-escape/`.

No additional changes are necessary. All asset references are relative paths, so this also works as a project page in a subfolder.

## Technical design

- **Canvas 2D** renderer with procedural, original geometric graphics, gradients, atmosphere and lighting mask.
- **Seeded depth-first maze generation** with extra loops and open ward rooms to create alternate routes.
- **Breadth-first search pathfinding**, directional sight cones, sound investigation, and last-known-position searches for enemies.
- **State machine** for menus, gameplay, pause, defeat, floor completion and victory.
- **Collision detection** against the tile map, mobile controls and optional synthesized audio.
- **Zero third-party dependencies, no ads, no analytics, no network requests.**

## Source layout

- `index.html` — structure, accessible labels and HUD.
- `style.css` — responsive interface.
- `game.js` — gameplay, generation, enemy AI and original Canvas artwork.
- `favicon.svg` — original vector emblem.

## Known limitations

- Single-player only. Multiplayer requires a server and anti-cheat/network synchronization.
- The mobile interface is functional but complex maze navigation is most comfortable on a larger screen.
- Local best-time saving may be unavailable in private browsing or where storage is disabled.
- This is an independent creative project, not affiliated with Valve, Dota 2 or any custom game developer.

## License

MIT — see `LICENSE`.
