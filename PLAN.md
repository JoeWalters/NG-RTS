# NG-RTS — Master Implementation Plan (LLM Runbook)

A real-time strategy game inspired by **Command & Conquer / Red Alert, Warcraft II, and Warcraft III**.
This document is the single source of truth that instructs an AI coding agent how to build the
game **in sequential chunks**. Each chunk has a clear goal, an explicit **Definition of Done (DoD)**,
and a **verification step** the agent must run before moving on. **Do not skip chunks.**

---

## 1. Hard Constraints (non-negotiable)

1. **Must run on an M-series Mac** (Apple Silicon). Target: macOS 14+.
2. **Runs in the browser.** Native binary is OPTIONAL and out of scope. Rationale: a browser WebGL
   app needs **zero developer accounts, zero Xcode, zero signing**, and runs identically on every
   M-series Mac via the bundled GPU-backed WebGL. This satisfies "run on hardware" — the GPU/CPU
   are exercised directly through the browser's WebGL/Canvas.
3. **No developer accounts.** Never create Apple Developer IDs, Google Play, itch.io, npm login,
   or any signup. `npm install` of public packages does NOT require an account — that is allowed.
4. **No paid services, no SaaS, no API keys.** All assets must be generated procedurally or drawn
   by code (no copyrighted sprites/audio). Everything must be self-contained and offline-capable.
5. **Language/runtime:** TypeScript compiled with Vite. Node 20+ is available (confirmed v20.11.1).

---

## 2. Chosen Tech Stack (decided — do not change without a new decision note in this file)

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | Type safety at this code size is essential |
| Build/dev server | Vite | Fast HMR, no accounts, trivial on macOS |
| 3D/rendering | Three.js (WebGL) | Mature, GPU-accelerated on Apple Silicon, no accounts |
| Math | `three` MathUtils + own helpers | Minimal deps |
| Audio | Web Audio API (procedural) | No licensed assets |
| Assets | All procedural/code-generated | Textures from canvas, models from primitives, audio synthesized |

**No other runtime dependencies. No backend. No network calls at runtime.**

### Project layout (create in Chunk 1)
```
NG-RTS/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  src/
    main.ts                 # bootstrap + game loop
    core/
      game.ts               # Game: top-level state machine, sim + render tie
      loop.ts               # fixed-timestep simulation loop
      events.ts             # typed event bus (order/announcement dispatch)
      config.ts             # all balance/constants in one place
    sim/
      map.ts                # grid terrain, tile queries
      entities.ts           # Entity base + registry (id lookup)
      unit.ts               # Unit (mobile) class
      building.ts           # Building class
      player.ts             # Player state: resources, tech, visibility
      order.ts              # Order types + queue
      pathfind.ts           # A* pathfinding + flow-field movement
      combat.ts             # damage, projectiles, attack logic
      economy.ts            # harvesting, credits, silo capacity, power grid
      ai.ts                 # skirmish AI (scripted behavior)
      fog.ts                # fog-of-war visibility + exploration
      collision.ts          # spatial hashing + separation
      tech.ts               # upgrade tree
    render/
      renderer.ts           # Three.js scene, camera, lights, resize
      terrain.ts            # procedural ground + grid tiles
      unitmesh.ts           # procedural unit/building meshes (color-coded)
      projectiles.ts        # visual projectile pool
      selection.ts          # selection ring / outline rendering
      minimap.ts            # 2D minimap overlay
      hud.ts                # DOM overlay: sidebar, resources, commands
      camera.ts             # RTS camera (edge-pan, drag, zoom, WASD)
      fx.ts                 # hit sparks, build flashes, smoke
    util/
      rng.ts                # seeded PRNG (deterministic sims)
      math.ts               # vec helpers, rounding
      perf.ts               # frame stats
    audio/
      sound.ts              # Web Audio synth + mixer
  assets/                   # (empty; all generated) — reserved for future real assets
  docs/                     # design notes per chunk (append, never delete)
```

---

## 3. Game Design (the target we are building toward)

### Inspiration map (explicit)
This game is a **C&C / Red Alert core dressed in a Warcraft-style 3D view**. Each mechanic is
credited so the blend is intentional and legible:

| Mechanic | Source | How we use it |
|---|---|---|
| Credits + Ore/Gems harvested by **Harvesters** returning to **Refineries** | C&C / RA | Core economy (below) |
| **MCV deploys into Construction Yard**; buildings bought from **Sidebar** and "pop-in" instantly | C&C / RA | No worker-construction; instant build flash |
| **Power Plants + power grid**; low power slows production | C&C / RA | Growth limiter instead of a food cap |
| **Shroud + Fog** (unexplored black persists; enemies hidden out of sight) | RA2 | Vision system |
| **Allied vs Soviet** factions, tanks/infantry/vehicles, Tesla Coil defenses | RA | Faction/roster flavor |
| **Superpowers**: Chronosphere (teleport) / Iron Curtain (invulnerability) | RA2 | Signature powers in Chunk 8 |
| Sidebar **tabs** (Base/Defense/Infantry/Vehicle) with costs + build progress | C&C / RA | Main UI (Chunk 7) |
| Top-down 3D, right-click orders, box-select, health bars, minimap, group keys | Warcraft II/III | View + control layer |
| Fog of war per-unit sight | Warcraft III | Blended with shroud |

### Theme & scale
- Two factions: **Allied (blue)** vs **Soviet (red)** — Red Alert-style. Skirmish matches.
- Top-down 3D view (Warcraft-III-like camera), grid terrain, **shroud + fog of war**, base building.
- Single skirmish map (128×128 tiles): each base has an ore field + a defensive pass; a center
  contested region holds a second, richer gem field (Red-Alert flavor: ore + gems).

### Economy (C&C / Red Alert style)
- Single currency: **Credits**. No lumber, no food cap.
- **Ore Fields** (crystal-like patches) scatter near bases; a rarer **Gem Field** sits at the
  center. Fields deplete as harvested and slowly respawn (or new fields seed later).
- **Harvester** (mobile vehicle) drives to a field, harvests (turns ore into a cargo load), drives
  to a **Refinery**, and dumps it for credits into the silo. Refinery adds silo capacity.
- **Power** replaces the population cap: each building consumes power; **Power Plants** supply it.
  At power deficit, production (build/train) slows dramatically — the classic C&C "low power"
  penalty. A unit cap exists only for performance, not as a design limiter.

### Building model (C&C / Red Alert style)
- Player starts with an **MCV (Mobile Construction Vehicle)** that can **deploy** into a
  **Construction Yard**.
- Structures are bought from the **Sidebar** (tabs: Power / Base / Defense / Infantry / Vehicle),
  placed by clicking a spot, and **build instantly** with a build flash + crane animation.
  **No worker construction** — this is the C&C signature difference from Warcraft.
- Buildings: Construction Yard (MCV), Power Plant, Refinery, Barracks (infantry), Weapons Factory
  (vehicles), Defense: Tesla Coil / Flame Tower / Pillbox, and Wall segments.

### Factions & roster (RA-flavored; symmetric-ish for skirmish)
**Infantry** (trained at Barracks):
- `rifleman` — cheap basic infantry.
- `rocketeer` — anti-vehicle/anti-structure rocket infantry (slow, fragile).

**Vehicles** (built at Weapons Factory):
- `harvester` — economy unit (no combat).
- `lighttank` — Allied signature: fast, lighter.
- `heavytank` — Soviet signature: slow, armored.
- `mammoth` — expensive heavy tank (late game).

**Defense structures** (auto-fire at nearby enemies):
- `teslacoil` — Allied/Soviet Tesla Coil: high-damage single-target, power-hungry, charge time.
- `flametower` — short-range AoE anti-infantry.
- `pillbox` — cheap machine-gun defense.
- `wall` — cheap obstacle, low HP, blocks pathing.

**Superpowers** (Chunk 8, cooldown-based):
- Allied **Chronosphere**: teleports a group of your units across the map.
- Soviet **Iron Curtain**: makes a group briefly invulnerable.

### Core RTS systems (must all exist by final chunk)
1. Fixed-timestep simulation (deterministic; render interpolates).
2. Grid pathfinding (A*), separation steering, no unit overlap.
3. **Shroud + fog**: unexplored tiles stay black (shroud); explored-but-not-seen tiles show
   terrain but hide enemy units (fog). Units visible only when an allied unit/building has sight.
4. Selection: click unit, box-select groups, right-click orders (move/attack/harvest/build).
5. Order queue: waypoints, move, attack-move, harvest, deploy, build placement.
6. Combat: attack declarations, projectile travel, damage, death, corpse decay.
7. **Power grid** (supply/consumption, low-power slowdown) + **credit economy** + silo capacity.
8. **Sidebar build system**: tabs, costs, build times, instant placement.
9. Skirmish AI: build order script (MCV→power→refinery→harvester→barracks→army) + army-push.
10. Win/lose: destroy opponent's **Construction Yard** (or all buildings) → victory/defeat overlay.
11. UI: resource/sidebar panel, minimap w/ shroud, health bars, unit portraits (procedural).

### Control scheme (Warcraft right-click + C&C sidebar)
- **Left-click**: select unit(s). Drag = box select. Click building = select.
- **Right-click**: context order (move / attack / harvest / deploy / build on placement ghost).
- **Sidebar**: click a structure to enter placement mode; click map to build; `Esc` cancels.
- **Keyboard**: `A` attack-move, `H` harvest, `Esc` deselect, `Ctrl+number` groups,
  `F1` select all army, `+/-` zoom, `P` pause, `Space` select all idle harvesters.
- Camera: WASD pan, edge-pan, mouse-wheel zoom, drag middle/right.

---

## 4. Chunk Execution Protocol (how the agent must work)

- Work **one chunk at a time, in order**. Each chunk ends with its DoD verified.
- Each chunk appends a short "Chunk N — done" note to `docs/LOG.md` (create it in Chunk 1).
- **Never** proceed to the next chunk until the DoD of the current chunk passes.
- After any chunk that changes `package.json`, run `npm install` and confirm the dev server starts.
- Run the game manually each chunk via `npm run dev` (agent should use `curl`/headless checks for
  smoke tests; real gameplay validation is noted per chunk). Since no human is guaranteed to play,
  the agent must add **automated smoke tests** (see Chunk 1 test harness) that exercise the sim
  headlessly (run sim in Node without rendering) to verify logic without a browser.

### Verification commands used throughout
```bash
npm run dev          # start Vite dev server
npm run build        # type-check (tsc) + bundle; MUST pass with zero errors
npm run test         # headless sim unit tests (Node, no browser needed)
npx vite preview     # serve production build to verify bundle works
```
Add these scripts in Chunk 1. `test` runs `node --test` against headless sim code.

---

## 5. THE CHUNKS

### CHUNK 0 — Scaffold, toolchain, and test harness
**Goal:** Empty-but-working Vite+TS project; dev server runs; headless test runner works.

Steps:
1. Create `package.json` with scripts: `dev`, `build` (`tsc && vite build`), `test`
   (`node --test dist-test` or `node --test test/**/*.test.mjs` — use plain `node --test` over
   `.mjs` files compiled by `tsc` to a `build-test/` dir; keep tests dependency-free).
2. Install `typescript`, `vite`, `three`, `@types/three` (all public, no accounts).
3. Create `index.html` (canvas mount + HUD root divs), `tsconfig.json` (strict), `vite.config.ts`.
4. Create `src/main.ts` that mounts an empty Three.js scene with a spinning placeholder cube and a
   simple game-loop stub. Add a red-green-blue triangle of test data for the harness.
5. Create the headless test harness: a tiny `src/core/loop.ts` that runs N fixed sim steps and
   asserts invariants. Write a first test that runs 10 sim steps and checks deterministic output
   from `util/rng.ts` (same seed → same sequence).
6. Create `docs/LOG.md`; append "Chunk 0 — done".

**DoD:**
- `npm run build` exits 0 with strict TS.
- `npm run dev` serves `index.html`; placeholder cube renders.
- `npm run test` passes ≥1 test proving RNG determinism.
- No developer account, signup, or network-at-runtime anywhere.

---

### CHUNK 1 — Simulation core, grid map, entity registry, game loop
**Goal:** The deterministic headless simulation works without rendering: map, entities, fixed loop.

Steps:
1. `src/core/loop.ts`: fixed-timestep loop (e.g. 30 ticks/s, accumulator pattern). Simulation is
   pure and render-agnostic; it exposes `step(dt)`.
2. `src/sim/map.ts`: 128×128 tile grid. Tile types: `ground`, `water`, `ore`, `gems`, `trees`
   (visual only), plus building-occupied tiles. Map generated procedurally with seeded RNG: two
   clearings at corners, center forest, an ore field near each base and a richer gem field at
   center. Provide `isBlocked(x,y)`, `tileAt`, `setTile`.
3. `src/sim/entities.ts`: `Entity` base (id, pos, radius, team, alive) + `EntityRegistry`
   (map id→entity, spatial hash for broad-phase).
4. `src/sim/unit.ts`/`building.ts`: stub classes with position + facing.
5. `src/sim/player.ts`: `Player` with team, **credits**, powerProduced, powerConsumed, silo.
6. `src/core/game.ts`: owns map + players + registry; `step(dt)` drives loop; `update` calls
   subsystems in a fixed order (order, movement, economy, power, combat, fog, ai — order matters
   for determinism). Expose `Game` as pure class usable from Node tests.
7. `src/sim/collision.ts`: spatial hash grid; `moveEntity` with tile-blocking + entity blocking.
8. Write headless tests: map gen is deterministic; entity move blocked by water/tree tile; registry
   lookups; 1000 steps run without NaN/exception and produce identical result from identical seed.

**DoD:** `npm run test` green for map/registry/loop determinism. `npm run build` clean.
`npm run dev` still renders placeholder.

---

### CHUNK 2 — Pathfinding + movement steering
**Goal:** Units pathfind around obstacles and separate from each other.

Steps:
1. `src/sim/pathfind.ts`: A* on the 128×128 grid (allow diagonal, prefer cardinal), with a
   path-reuse cache keyed by (start,goal,obstacleEpoch). Recompute when obstacleEpoch changes
   (buildings/trees change).
2. Add smoothing (string-pulling) and path-following (seek next waypoint; arrival radius).
3. `src/sim/collision.ts` separation: same-team units push apart within radius; blocked tiles
   prevent entry. Add "flow field"-lite: units re-seek if blocked >1s (stuck detection).
4. Expose `unit.moveTo(x,y)` and `unit.attackMoveTo(x,y)` (path + fight-while-moving).
5. Headless tests: unit goes around a wall obstacle; two units crossing don't overlap; stuck
   unit recovers; path exists/not-found handling.

**DoD:** Tests prove A* avoids obstacles, diagonal moves bounded, no overlap after 500 steps,
no NaN. Build clean. (Render path as debug lines optionally in Chunk 6.)

---

### CHUNK 3 — Rendering: terrain, units, camera, selection
**Goal:** The game is visible and controllable on screen.

Steps:
1. `src/render/renderer.ts`: Three.js scene, orthographic top-down camera, ambient + directional
   light, `renderer.setAnimationLoop` driving `game.step` + interpolated render.
2. `src/render/terrain.ts`: build ground from grid — colored quads per tile type (grass,
   forest=trees as cone meshes, water=blue plane, gold mine=rocky mound). Use `CanvasTexture`
   with a procedural grass noise texture. Low-poly, instance-meshed for perf.
3. `src/render/unitmesh.ts`: build low-poly units/buildings from primitives (box bodies + cone
   heads) tinted per team. A `MeshRegistry` maps entityId→mesh, updated each frame from sim
   (positions interpolated between last two ticks).
4. `src/render/camera.ts`: RTS camera — WASD pan, edge scroll, wheel zoom (clamped), middle-drag
   pan. Keep within map bounds.
5. `src/render/selection.ts`: draw a selection ring/outline under selected units (flat ring mesh);
   highlight selected buildings with emissive edge.
6. `src/main.ts`: wire input (pointer events → world raycast; click/box select) and call into
   game. Add a dev "spawn two peasants" debug command to see movement (temporary; remove in Chunk 9).
7. Headless tests unaffected; add a render smoke test that builds a scene in Node with
   `headlessgl`? — **skip**; instead assert `buildScene()` returns non-null counts in a unit test
   that doesn't require a GL context (mock minimal). Keep render logic thin so it's testable.

**DoD:** Browser shows terrain + two units; WASD/zoom/edge-pan works; clicking a unit selects it
(selection ring appears); build clean. (Manual check; agent verifies via dev server + a
screenshot if a headless renderer is available, else logs.)

---

### CHUNK 4 — Ordering, selection, and movement orders (input → sim)
**Goal:** Full mouse/keyboard control: select, box-select, right-click orders.

Steps:
1. `src/sim/order.ts`: `Order` = union type (Move, Gather, Attack, Build, Stop, Patrol). Unit has
   `orderQueue`. Right-click sets context order based on what's under cursor (enemy unit → attack;
   gold mine/tree → gather; empty ground → move; building → build order via placement ghost).
2. `src/render/hud.ts` (start): DOM overlay for selection readout (name, hp, resources) — minimal
   now, full in Chunk 7.
3. Input pipeline: raycast to pick entity/tile; drag threshold distinguishes click vs box-select;
   `A` sets attack-move; `Esc` deselects; `Ctrl+num` save/recall groups (store unit ids).
4. Headless tests: order queue executes in order; move order reaches goal within tolerance;
   attack order acquires target; gather order sets worker state.

**DoD:** In browser: left-click selects, drag box-selects multiple, right-click moves unit to
ground, right-click enemy attacks, right-click tree/mine gathers (worker moves & starts).
Build clean, tests green.

---

### CHUNK 5 — Economy: harvesters, refineries, sidebar build, power grid
**Goal:** Full C&C-style economy loop + instant sidebar construction + power management.

Steps:
1. `src/sim/economy.ts`: Harvester states (idle→drivingToField→harvesting→drivingToRefinery→
   dumping). Ore/Gem fields hold N credits and deplete as harvested (slowly respawn). Refinery
   receives cargo → credits into silo; silo has capacity (full silo stops dumping). Carry
   capacity, harvest rate, dump rate constants in `config.ts`.
2. `src/sim/building.ts` + placement: `building.place(blueprint)` — ghost preview, valid/invalid
   tiles, red/green ghost. Buildings "pop in" after a sidebar **build time** with a build flash;
   no worker construction (C&C style). MCV has a `deploy` order converting it into a Construction
   Yard (deployable anywhere on clear ground).
3. `src/sim/tech.ts` → power grid: each building has powerConsumed; Power Plants provide power.
   Track powerProduced vs powerConsumed per player; deficit slows build/train rates (low-power
   penalty). Buildings under construction are non-functional until the build timer ends.
4. Production: Barracks trains infantry; Weapons Factory builds vehicles — each has a **queue**
   with sequential build times (C&C-style queue). Costs in credits.
5. `src/render/unitmesh.ts`: building meshes + pop-in build flash; ghost preview mesh; harvester
   cargo visual when carrying ore.
6. `src/render/hud.ts` (start): resource panel (credits), power bar (produced/consumed), and a
   minimal sidebar with the Power/Base/Defense/Infantry/Vehicle tabs. Full UI in Chunk 7.
7. Headless tests: harvester harvest/dump cycle yields correct credits; silo capacity blocks
   dumping; build timer completes → building usable; power deficit slows production; MCV deploy
   becomes a Construction Yard.

**DoD:** In browser: deploy MCV→build Power Plant/Refinery→harvester gathers credits→build
Barracks/Weapons Factory→train/build units. Power bar and credits correct. Tests green, build clean.

---

### CHUNK 6 — Combat, projectiles, death, shroud + fog of war
**Goal:** Units fight, die, and RA2-style shroud/fog works.

Steps:
1. `src/sim/combat.ts`: `attack` order — approach to range, face target, fire rate, damage with
   armor (basic armor/weapon tiers from `tech.ts`). Projectiles as sim entities with travel time;
   on arrival apply damage. Tesla Coil charges then fires a high-damage bolt; Flame Tower applies
   short-range AoE; Pillbox rapid-fires.
2. `src/sim/fog.ts`: per-player **shroud + fog** grid. Each unit/building has `sightRadius`; tiles
   seen within radius are **visible**; once seen, stay **explored** (shroud cleared permanently).
   Enemy units hidden unless the tile they occupy is currently visible (fog). Fog data feeds
   render (hide meshes) and selection (can't select hidden).
3. `src/render/projectiles.ts` + `fx.ts`: visual projectile pool (shell tracers, tesla bolts),
   hit sparks, death fade + wreck decal, build flashes.
4. `src/sim/ai.ts` (start): scripted Soviet opponent — build order (MCV→power→refinery→
   harvesters→weapons factory→army) then attack-move to Allied base. Keep simple & deterministic.
5. Win/lose: `game.checkEnd()` — player with 0 Construction Yard buildings (or all buildings
   dead) loses; show overlay via HUD.
6. Headless tests: DPS math correct; projectile arrival applies damage once; dead unit removed;
   fog hides unit (visibility query); shroud persists after leaving; AI builds then attacks.

**DoD:** In browser: two units fight (shells fly, hp bars drop, death). Enemy hidden until
scouted; minimap (Chunk 7) reflects shroud. Build clean, tests green.

**DoD:** In browser: two units fight (arrows fly, hp bars drop, death). Fog hides enemy until
scouted; minimap (Chunk 7) reflects explored. Build clean, tests green.

---

### CHUNK 7 — Full UI: C&C sidebar, minimap w/ shroud, health bars, portraits, announcements
**Goal:** Polished, playable C&C-style interface.

Steps:
1. `src/render/minimap.ts`: canvas 2D minimap — terrain colors, unit dots, **shroud + fog**
   shading. Click-to-move camera; render at low cost (update 10Hz).
2. `src/render/hud.ts` (full): top resource bar (**credits**, power bar with low-power warning),
   minimap, and a **right-side C&C sidebar** with tabs (Power / Base / Defense / Infantry /
   Vehicle). Each entry shows cost + build progress; clicking enters placement mode. Health bars
   over units (billboard sprites), announcements feed ("Harvester ready", "You are victorious!").
3. Unit portraits: procedurally drawn small canvas icons per type (no assets).
4. `src/render/selection.ts`: hp bars + selection rings + attack line to target + deploy button
   for MCV.
5. Pause (`P`), game timer, FPS counter (`perf.ts`).
6. Headless tests: HUD is DOM — skip; ensure `hud.ts` has a `update(state)` pure-ish API so it's
   testable for resource/power formatting and sidebar cost logic.

**DoD:** Full playable skirmish vs AI: deploy, build from sidebar, harvest, fight, see
minimap/shroud, win/lose overlays. Build clean, tests green.

**DoD:** Full playable skirmish vs AI: build, gather, fight, see minimap/fog, use command card,
win/lose overlays. Build clean, tests green.

---

### CHUNK 8 — Superpowers, tech upgrades, polish, audio, balance
**Goal:** Deeper game (RA2 superpowers + upgrades) + juice + sound.

Steps:
1. `src/sim/tech.ts` (full): upgrade tiers (e.g. `weapon1/2/3`, `armor1/2/3`) purchasable at
   Weapons Factory/Barracks; Tesla Coil and tank upgrades. Costs + effects in `config.ts`.
2. **Superpowers** in `src/sim/tech.ts` or a new `src/sim/powers.ts`: Allied **Chronosphere**
   (teleport selected group after a brief charge) and Soviet **Iron Curtain** (invulnerability
   for a duration). Cooldown + cost; effects deterministic and testable.
3. `src/audio/sound.ts`: Web Audio synth — construction, tank fire, tesla zap, explosion,
   harvester dump, click, victory sting. All synthesized; a simple mixer with volume.
4. Polish: unit idle bob, facing smoothing, soft fog/shroud edges (shader), nicer water, sky
   gradient, subtle screen shake on big hits (`fx.ts`), tesla bolt flicker.
5. Balance pass: tune harvest/build/train/combat rates so an AI skirmish is winnable in ~10 min.
   Record tuned constants in `config.ts` with comments.
6. Headless tests: upgrade applies stat changes; Chronosphere teleports group to target;
   Iron Curtain makes group invulnerable then expires; AoE damages multiple; audio functions
   exist (no-op in headless).

**DoD:** Upgrades + superpowers work, audio plays, game balanced/playable, 60fps on an M-series
Mac for full map. Build clean, tests green.

**DoD:** Upgrades work, audio plays, game is balanced/playable, performance stable on an M-series
Mac at 60fps for full map. Build clean, tests green.

---

### CHUNK 9 — Optimization, robustness, production build, packaging
**Goal:** Ship-ready, fast, and robust; remove debug scaffolding.

Steps:
1. Perf: instance meshes for units/buildings/trees; cap draw calls; LOD for far units; minimap
   throttled; GC pass (object pooling for projectiles). Target ≥60fps on M1/M2/M3 at full map.
2. Remove Chunk 3 debug spawn command. Add `?seed=` URL param for reproducible maps.
3. Robustness: error boundary → friendly "reload" screen; `ResizeObserver` handling; pause on
   blur; memory: dispose meshes on death.
4. `npm run build` then `npx vite preview` → confirm production bundle serves and runs.
5. Write `docs/LOG.md` final summary + a `README.md` with run instructions (no accounts).
6. Headless test: full 3000-step deterministic simulation from fixed seed passes invariants
   (no NaN, no leaks, end-state consistent).

**DoD:** 60fps on M-series; production `vite preview` works; `npm run build` zero errors;
README documents `npm install && npm run dev` and `npm run build`. All tests green.

---

### CHUNK 10 — Final acceptance & handoff
**Goal:** The game meets every requirement in Section 1 and is documented.

Steps:
1. Re-run every prior DoD as a regression: `npm run build`, `npm run test`, `npx vite preview`.
2. Full manual playthrough checklist (agent drives via dev server + headless assertions):
   - Boot in browser on an M-series Mac, no console errors.
   - Play a full skirmish vs AI to victory and defeat conditions.
   - Confirm zero accounts used anywhere; `package.json` has only public deps.
3. Final `docs/LOG.md` entry + `README.md` finalized.
4. Commit everything with a clear message: "NG-RTS v1.0 complete".

**DoD:** All sections of this plan satisfied; game runs on M-series Mac in-browser; no developer
accounts; clean git history; README gives a stranger the 2-command run path.

---

## 6. Determinism & Testing Rules (critical for an LLM working headlessly)
- The simulation (`src/sim/*`) must be **pure**: no `Math.random`, no wall-clock time, no
  globals. Use `util/rng.ts` seeded PRNG everywhere. This lets the agent run thousands of sim
  steps headlessly in Node and assert invariants without a browser.
- Rendering/audio/DOM live behind interfaces so Node tests never touch them.
- Every chunk adds tests; `npm run test` must be green before `npm run build` is considered done.
- NaN-guard: assert no `NaN`/`Infinity` in entity transforms after every long sim in tests.

## 7. Risk & Mitigation
| Risk | Mitigation |
|---|---|
| Browser-only means no native app | Accepted per Section 1: browser satisfies requirement; note in README |
| WebGL perf on Apple Silicon | Instance meshes, LOD, capped draw calls (Chunk 9) |
| LLM can't visually verify | Headless deterministic tests + optional headless screenshot via `puppeteer-core`? — NO accounts, but puppeteer needs Chrome download; keep optional. Prefer DOM/log assertions. |
| Scope creep | Hard chunk gates + DoD before advancing; this plan is the contract |

## 8. Definition of "Done" (global)
- Runs in a browser on any M-series Mac at 60fps.
- A full skirmish RTS loop exists: build → gather → train → tech → fight → win/lose → fog/minimap/UI.
- `npm run dev`, `npm run build`, `npm run test`, `npx vite preview` all pass.
- Zero developer accounts, zero paid services, zero licensed assets, zero runtime network.
