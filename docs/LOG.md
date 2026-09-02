# NG-RTS Build Log

Running log appended each chunk. Each entry records what was built and the DoD
verification result. Chunks never advance until the current DoD passes.

---

## Chunk 0 — Scaffold, toolchain, and test harness (DONE)

**Built:**
- `package.json` (type: module) with scripts `dev`, `build` (`tsc && vite build`),
  `preview`, `test` (`tsc -p tsconfig.test.json && node --test build-test/test/`).
- Deps: `three`, `@types/three`, `typescript`, `vite`, `@types/node` (all public, no accounts).
- `tsconfig.json` (strict, noEmit) + `tsconfig.test.json` (NodeNext, outDir `build-test`).
- `vite.config.ts`, `index.html` (canvas mount `#app` + HUD slots `#hud-top/bottom/side`).
- `src/main.ts`: Three.js scene + spinning placeholder cube + render loop, feeding a
  `FixedLoop` sim stub at 30 ticks/s.
- `src/util/rng.ts`: seeded Mulberry32 PRNG (deterministic sim RNG).
- `src/core/loop.ts`: fixed-timestep accumulator loop (frame/run/reset).
- Tests: `test/rng.test.ts` (5), `test/loop.test.ts` (4) — 9 total.

**DoD verification:**
- `npm run build` → exit 0, strict TS clean, vite bundle 467 kB ✓
- `npm run dev` → serves index.html with HUD slots ✓ (cube render pending visual check)
- `npm run test` → 9/9 pass, proving RNG determinism ✓
- No developer account, no signup, no runtime network ✓

**Next:** Chunk 1 — simulation core, grid map, entity registry, game loop.

---

## Chunk 1 — Simulation core, grid map, entity registry, game loop (DONE)

**Built:**
- `src/sim/map.ts`: 128×128 `GridMap` with Tile enum (Ground/Water/Trees/Ore/Gems),
  `isBlocked` (water/trees/building-occupancy), occupancy grid, `generateMap(seed)` — two base
  clearings, central lake + ponds, center forest ring + scatter, ore near each base, gem field at
  center. Deterministic via seeded RNG.
- `src/sim/entities.ts`: `Entity` base (pos, radius, team, facing, alive) + `EntityRegistry`
  (id map + spatial-hash broad-phase, `entitiesInRange`, `updatePos`).
- `src/sim/unit.ts` / `building.ts`: stub classes (speed/hp/power fields).
- `src/sim/player.ts`: `Player` (team, credits, power, silo).
- `src/sim/collision.ts`: `SpatialHash` + `moveEntity` (tile-blocking + entity-blocking).
- `src/core/game.ts`: `Game` owns map+players+registry, fixed-loop `step(dt)` with subsystem
  placeholders in fixed order (orders→movement→economy→power→combat→fog→ai); `run(seconds)`;
  spawn helpers. Pure/deterministic, headless-testable.

**Tests added:** `map` (8), `entities` (5), `collision` (6), `game` (5) → 31 total pass.

**DoD verification:**
- `npm run build` → exit 0, strict TS clean ✓
- `npm run test` → 31/31 pass (map/registry/loop determinism) ✓
- `npm run dev` → serves placeholder page ✓

**Next:** Chunk 2 — A* pathfinding + movement steering.

---

## Chunk 2 — Pathfinding + movement steering (DONE)

**Built:**
- `src/sim/pathfind.ts`: A* over the 128×128 grid (8-dir, octile heuristic, cardinal-preferred),
  **corner-cutting prevention** (diagonals blocked when an orthogonal tile is blocked), path cache
  keyed by (start,goal) and invalidated on map `epoch` bump. `isLineClear` (dense 4x sampling so
  smoothing never collapses a line that crosses a blocked corner), `smoothPath` (string-pulling),
  `nearestWalkable` (re-seek start recovery). `PathFollow` (waypoint seeking, arrival snap,
  >1s stuck detection → re-seek).
- `src/sim/map.ts`: added `epoch` (bumped on tile/occupancy writes) for cache invalidation;
  `idx()` floors coords (fixes float-coordinate array out-of-range).
- `src/sim/collision.ts`: `applySeparation` — same-team overlap push-apart respecting tile blocking.
- `src/sim/unit.ts`: `moveTo` / `attackMoveTo` / `updateMovement` (path follow + separation),
  `moving`, `waypoints`.

**Bugs found & fixed during build:**
1. `idx()` with float coords → `occupied[i]` out-of-range (`undefined !== 0` = true) blocked
   everything. Fixed by flooring in `idx()`.
2. A* diagonal corner-cutting → unit wedged on wall corners. Fixed with corner-cut check.
3. Bresenham `isLineClear` missed corner-crossing diagonals → smoothing produced a path that
   physically cut through a blocked tile. Fixed with dense 4x sampling.
4. Arrival-radius drift let units skip waypoints and cut corners diagonally. Fixed by snapping
   exactly onto each reached waypoint before advancing.

**Tests added:** `pathfind` (15) → 45 total pass. Covers A* around walls, not-found handling,
path bounds, cache invalidation, smoothing validity, wall-routing movement, crossing non-overlap,
stuck re-seek recovery, stationary-cluster separation.

**DoD verification:**
- `npm run build` → exit 0, strict TS clean ✓
- `npm run test` → 45/45 pass (A* avoids obstacles, diagonals bounded, no overlap after 500 steps,
  no NaN) ✓
- `npm run dev` → serves placeholder page ✓

**Next:** Chunk 3 — rendering: terrain, units, camera, selection.

---

## Chunk 3 — Rendering: terrain, units, camera, selection (DONE)

**Built:**
- `src/render/camera.ts`: `RTSController` — pure camera math (view center + zoom, WASD/edge pan,
  wheel zoom clamped, bounds clamp); `apply()` drives an orthographic top-down camera.
- `src/render/terrain.ts`: `buildTerrain` — full-map ground quad with procedural per-tile
  CanvasTexture (grass/water/ore/gems), instanced tree cones + crystal mounds; headless fallback
  texture when no DOM. Returns counts for tests.
- `src/render/unitmesh.ts`: `UnitMeshRegistry` — entityId→mesh with prev/cur interpolation,
  team tinting, raycast targets, dispose on remove.
- `src/render/selection.ts`: `SelectionManager` — selection ids + ground selection rings.
- `src/render/renderer.ts`: `Renderer` — WebGL scene, ortho camera, lights, terrain, meshes,
  selection; fixed-step + interpolated render hooks.
- `src/main.ts`: full wiring — Game + Renderer, fixed-step accumulator with interpolation,
  WASD/edge-pan/wheel/middle-drag camera, click + box selection via raycast/ground projection,
  `H` spawns a harvester at camera, `?seed=` URL param. Spawns 2 harvesters that walk toward
  each other so movement is visible.
- `src/sim/entities.ts`: added `kind?` discriminator for render.

**Tests added:** `render` (6 headless scene-graph smoke tests, no GL needed) → 51 total pass.
Covers terrain counts, mesh add/sync/interpolate/remove, selection ring lifecycle, camera
clamp/zoom, ortho apply.

**DoD verification:**
- `npm run build` → exit 0, strict TS clean ✓
- `npm run test` → 51/51 pass ✓
- `npm run dev` → serves page + module ✓
- Visual check (terrain + two harvesters walking, WASD/zoom/edge-pan, click-select ring)
  **pending a human browser pass** — cannot be verified headlessly (needs WebGL).

**Next:** Chunk 4 — ordering, selection, and movement orders (input → sim).

---

## Chunk 4 — Ordering, selection, and movement orders (input → sim) (DONE)

**Built:**
- `src/sim/order.ts`: `Order` union (move/attackmove/attack/harvest/build/stop/deploy/garrison/trap),
  `OrderQueue`, and `OrderSystem` — drives each unit's current order to completion then advances
  the queue. Handles move (path to goal), attack (explicit targetId or nearest-enemy acquisition,
  moves to weapon range, stays active while target alive), harvest (moves to field, sets state),
  build (moves to site), deploy (deployable unit → Building), stop (preempts queue).
- `src/sim/unit.ts`: `orders` queue, `orderState`, attack/harvest/build targets, `deployable`,
  `issue()` (stop preempts), `stopMovement`, `faceTowards`, `reached` getter.
- `src/sim/movement.ts`: `MovementSystem` — drives all units' path-follow + separation each tick.
- `src/core/game.ts`: wired `OrderSystem` (before movement) + `MovementSystem` into the fixed update.
- `src/render/hud.ts`: minimal HUD with pure `formatSelection()` (id, kind, hp, credits, power).
- `src/main.ts`: right-click context orders (attack enemy / harvest ore-gems / deploy deployable /
  move), keys `A` attack-move, `S` stop, `G` gather, `D` deploy, `Esc` deselect, `Ctrl+num` groups,
  `H` harvester, `M` deployable Mule, HUD readout. Camera pan switched to arrow keys (resolves the
  WASD-pan vs A-attack conflict; edge-pan + wheel + middle-drag kept).

**Tests added:** `order` (10) → 61 total pass. Covers move-to-goal, attack acquisition (explicit +
nearest), attack end-on-target-death, harvest state, deploy convert/reject, sequential queue,
stop preemption.

**DoD verification:**
- `npm run build` → exit 0, strict TS clean ✓
- `npm run test` → 61/61 pass ✓
- `npm run dev` → serves page ✓
- Browser checks (right-click move/attack/harvest/deploy, click/box select, keys) **pending a human
  browser pass** (needs WebGL).

**Next:** Chunk 5 — economy: harvesters, ore+gas, power grid, race build styles, production.

---

## Chunk 5 — Economy: harvesters, ore+gas, power grid, race build styles, production (DONE)

**Built:**
- `src/sim/races.ts`: `RACES` (Forgefolk prefab-drop vs Thornkin sapling-growth; Root-Network global
  build), building/unit catalogs with costs, power, build times.
- `src/sim/building.ts`: `Building` with role, construction progress, power fields, production
  queue (`enqueue`); `placeBuilding` validates cost/tiles/range and applies race build-mode time.
- `src/sim/economy.ts`: `EconomySystem` — resource fields (clustered from map ore/gas/gems),
  harvester gather→carry→drop-off→dump cycles, silo capacity, gas resource, power grid
  (produced/consumed per player, low-power 0.5x penalty), construction, production queues,
  field regen.
- `src/sim/map.ts`: added `Gas` tile + 3 vents (2 near bases, 1 at center).
- `src/sim/unit.ts`: `role`/`economyActive`/`carrying`/`kindName`; `order.ts` deploy → race base
  (Foundry-Mule → Foundry, Worldroot → Heartwood); harvest respects economy ownership.
- `src/core/game.ts`: wired `EconomySystem`, starting credits, `placeBuilding` helper.
- `render/unitmesh.ts`: building mesh scales with construction progress.
- `main.ts`: `e` key starts a both-race economy demo (base + harvester + auto-harvest),
  `n` spawns a Worldroot.

**Bugs found & fixed:**
1. Harvester pathfinding to the dropoff's own occupied tile → never arrived. Fixed by targeting an
   adjacent walkable tile.
2. `applySeparation` pushed the harvester away from the dropoff building (radius-2) forever,
   fighting approach. Fixed by skipping non-movable (large-radius) entities in separation.
3. Power deficit slowed construction/production (verified 0.5x).

**Tests added:** `economy` (8) → 69 total pass. Covers gather→drop credits, full-silo blocking,
gas (no credits), power-deficit production slowdown, prefab-vs-growth timers, Root-Network range,
production spawn + cost, race-specific base deploy.

**DoD verification:**
- `npm run build` → exit 0, strict TS clean ✓
- `npm run test` → 69/69 pass ✓
- `npm run dev` → serves page ✓
- Browser economy loop (deploy base, harvest, build, train) **pending a human browser pass**.

**Next:** Chunk 6 — combat, squads & cover, traps, death, shroud + fog.

---

## Chunk 6 — Combat, squads & cover, traps, death, shroud + fog (DONE)

**Built:**
- `src/sim/combat.ts`: `CombatSystem` — attack orders fire projectiles that travel and apply
  damage on arrival; cover modifies damage; rear-hit bonus (directional armor) on vehicles;
  squad fire applies suppression; auto-acquire for attack-move; damage only to visible targets.
- `src/sim/squads.ts`: squad pool sharing + `reinforce` (cost per man, heals); `PIN_THRESHOLD`.
- `src/sim/cover.ts`: high/low cover from tree tiles (0.5x / 0.7x).
- `src/sim/traps.ts`: `Trap` entity + `TrapSystem` — bramble (damage+slow), tar (slow),
  steam (damage); trigger once per trap, fog-hidden until stepped on.
- `src/sim/fog.ts`: `FogSystem` — per-player shroud + visibility grids; explored persists.
- `src/sim/ai.ts`: scripted Thornkin — deploy base, harvest, produce army, attack-move.
- `src/core/game.ts`: wired combat/fog/traps/ai (ai opt-in `aiEnabled`), `checkEnd` (lose base →
  defeat). Unit gained squad/combat fields, `moveSpeed` (pinned/slow), `maxSquadSize`.
- Renderer removes dead meshes and hides unscouted enemy units via fog.

**Notes:** garrison is a stub for now; projectile visuals/fx deferred to render polish.

**Tests added:** `combat` (10) → 79 total pass. Covers DPS, death-by-projectile, rear-hit bonus,
suppression pin, cover reduction, squad reinforce, trap trigger-once, fog hide/explore-persists,
checkEnd, AI base+harvesters.

**DoD verification:**
- `npm run build` → exit 0, strict TS clean ✓
- `npm run test` → 79/79 pass ✓
- `npm run dev` → serves page ✓
- Browser fight/cover/trap/fog visuals **pending a human browser pass** (needs WebGL).

**Next:** Chunk 7 — full UI: race sidebar, minimap w/ shroud, squad bars, hero panel, portraits.
