# Last Light: The Hollow Ward

An original nine-floor, top-down survival and maze-escape game for the browser. **Version 2.0** introduces Scout and Medic roles, class-specific abilities, and a survivor rescue-and-extraction objective. It also retains v1.1's procedural rooms, directional vision and sound investigation. This is an original game, not a remake of Dota 2 or Warcraft, and uses no assets from those games.

## Play

Open `index.html` in a modern browser, or serve the files using any static HTTP server. No build step, package manager, backend or account required.

### Controls

| Key | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Space | Dash (3.5-second cooldown) |
| E | Rescue survivor / activate relay / interact with exit |
| Q | Deploy sound decoy (3 per floor) |
| F | Use class ability: Scout pulse (stuns nearby enemies, 13s cooldown) or Medic heal (restores one heart, 16s cooldown) |
| P / Escape | Pause / resume |
| R | Restart the current floor |
| Enter | Start / resume / advance when a menu is open |

Touchscreen users can use the on-screen directional pad and action buttons.

## Objectives

1. Choose **Scout** or **Medic** on the title screen.
2. Find every **cyan power core** in the maze.
3. Find the trapped **survivor** and press **E** nearby to rescue them. They follow you through the maze.
4. Find and activate the **golden relay** by approaching it and pressing **E**.
5. Bring the survivor close to the **elevator**, then press **E** or walk onto it once all objectives are done.
6. Escape nine increasingly dangerous floors. You have three health points per floor.

**Enemies:** The Hollows patrol the corridors, pursue players they can see, and investigate sound decoys. Breaking line of sight helps you lose pursuit. Dashing briefly protects you from their touch. The heading in the top-right of the game canvas points toward the next objective. The best complete-game time is stored only in your browser's `localStorage`.

## Publish to GitHub Pages

1. Create a **public repository**, e.g. `last-light-escape`.
2. Upload `index.html`, `style.css`, `game.js`, `favicon.svg`, `README.md` and `LICENSE` into the repository root.
3. In **Settings → Pages**, choose **Deploy from a branch**, `main`, `/ (root)`, and Save.
4. The resulting URL will be `https://YOUR_USERNAME.github.io/last-light-escape/`.

No additional changes are necessary. All asset references are relative paths, so this also works as a project page in a subfolder.

## Map generation (v2.2)

The game now uses a randomized, fully connected depth-first labyrinth, with twisting corridors, optional shortcuts, irregular carved chambers, and alternate routes. A fresh map seed is selected when beginning a new run; restarting the current floor retains the same layout. Walkable areas and objectives are validated by the game logic. The wall renderer uses seamless solid tiles rather than inset square blocks.

## Nine-floor lighting progression (v2.4)

| Floors | Ambient darkness | Experience |
| --- | --- | --- |
| 1–3 | 63% | Normal dim lighting (same as the previous release) |
| 4–6 | 76% | Darker corridors |
| 7–9 | 90% | Very dark surroundings; the player flashlight remains visible |

Every floor has its own maze seed, enemy population and objectives. Each new run randomizes the maze arrangement. Completing the ninth floor ends the game.

## Version 2.0 mechanics

- **Scout:** Pulse briefly stuns Hollows within 5.5 tiles. Cooldown: 13 seconds.
- **Medic:** Heal one heart if you are injured. Cooldown: 16 seconds.
- **Rescue mission:** Each floor contains one captive survivor. Interact to free them and escort them to within two tiles of the elevator.
- **Escort AI:** The survivor follows the player using grid-based pathfinding. The enemy AI targets the player, not the survivor, in this prototype.
- **Single-player:** Role selection is for one local player only; cooperative networking is not included.

## Technical design

- **Canvas 2D** renderer with procedural, original geometric graphics, gradients, atmosphere and lighting mask.
- **Seeded depth-first maze generation** with corridor loops, rectangular ward rooms, intentional doorways, connected-floor repair, and isolated-wall cleanup.
- **Breadth-first search pathfinding**, directional sight cones, sound investigation, and last-known-position searches for enemies.
- **State machine** for menus, gameplay, pause, defeat, floor completion and victory.
- **Collision detection** against the tile map, mobile controls and optional synthesized audio.
- **Zero third-party dependencies, no ads, no analytics, no network requests.**

## Source layout

- `index.html` — structure, accessible labels and HUD.
- `style.css` — responsive interface.
- `game-labyrinth-v4.js` — active gameplay, randomized map generation, enemy AI and original Canvas artwork (`game.js` is retained as an older source version).
- `favicon.svg` — original vector emblem.

## Known limitations

- Single-player only. Multiplayer requires a server and anti-cheat/network synchronization.
- The mobile interface is functional but complex maze navigation is most comfortable on a larger screen.
- Local best-time saving may be unavailable in private browsing or where storage is disabled.
- This is an independent creative project, not affiliated with Valve, Dota 2 or any custom game developer.

## License

MIT — see `LICENSE`.
