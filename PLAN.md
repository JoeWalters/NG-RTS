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
4. **No paid services, no SaaS, no API keys.** Assets: **no copyrighted material** — but **CC0 / public-domain** free asset packs (Kenney, Quaternius, PolyHaven, OpenGameArt) ARE allowed, provided they are **bundled locally** in `assets/` with **no runtime network** (no accounts, no payment). Procedural generation remains the fallback when no free asset fits. Everything must be self-contained and offline-capable.
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
      combat.ts             # damage, projectiles, squads, cover, suppression
      economy.ts            # harvesting, ore+gas, silo capacity, power grid
      ai.ts                 # skirmish AI (scripted behavior)
      fog.ts                # shroud + fog visibility + fog-hidden traps
      collision.ts          # spatial hashing + separation
      tech.ts               # 3 tech tiers + upgrades
      races.ts              # faction definitions: Forgefolk / Thornkin / Aliens (Chunk 11)
      squads.ts             # infantry squad composition + reinforcement
      cover.ts              # low/high cover damage reduction
      traps.ts              # ground traps: bramble, tar, steam
      hollow.ts             # underground burrow: minions + trap-rooms
      controlpoints.ts      # capture points: trickle income + victory timer
      heroes.ts             # unique hero units + abilities
      powers.ts             # hero/race ability effects (steam-strike, root-grasp)
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

### Design thesis
NG-RTS is **not** a copy of any one game. It borrows *ideas* and re-invents them into an original
world: **Forgefolk (Humans) vs Thornkin (Horde)**, with a planned third race — **Aliens** — added
post-v1 (Chunk 11). Every pillar below names what inspired it and what original thing we actually
built. If a mechanic can't be justified as a *re-invention*, it does not belong in the plan.

### Inspiration ledger (what inspired us → what we built)
| Inspired by | Our original mechanic |
|---|---|
| C&C / RA: harvesters, ore + refinery, credits | **Harvesters stay** — but they are faction-skinned: Forgefolk **Scrap-Lorries** (steam trucks) haul ore; Thornkin **Marrow-Tenders** (rooted mites) drain it. Same sim, different theme. |
| C&C / RA: MCV deploys into a Construction Yard | **Asymmetric deploy**: Forgefolk deploy a **Foundry-Mule** into a **Foundry**; Thornkin deploy a **walking corrupted tree** — the **Worldroot** — which *roots itself* into the ground as a **Heartwood**. Same "deploy" order, wildly different look and build style. |
| C&C / RA: sidebar tabs + instant pop-in builds | **Asymmetric building**: Forgefolk buy **prefabricated** structures from a sidebar and *drop* them instantly (crane flash). Thornkin *grow* buildings as **saplings** from the Heartwood over time, and can grow them **anywhere their Root-Network reaches** (global building). |
| C&C / RA: power plants, low-power penalty | **Two power skins**: Forgefolk **Boilers** (steam); Thornkin **Bloodflowers** (lifeblood). One power grid sim. |
| RA2: shroud + fog | Kept as the vision layer — but with **covert traps** (below) that stay hidden in fog until triggered. |
| Warcraft II/III: top-down 3D, right-click, box-select, health bars, minimap | The view/control layer. |
| Company of Heroes: squads, cover, garrison | **Infantry are squads** (4 models, reinforce-able), **low/high cover** reduces damage, **garrison** lets infantry enter buildings and defend from them. |
| CoH: directional armor, suppression | **Rear-hit bonus** on tanks; **suppression** pins squads under heavy fire. |
| Orcs Must Die: traps | **Traps** are ground-placed, fog-hidden, trigger on enemy feet: **Bramble Pits**, **Thorn Walls**, **Tar Spits** (slow). Both races build traps; Thornkin specialize. |
| Dungeons / Overlord: dungeon building, minion hordes, an overlord commander | **The Hollow**: an underground burrow structure that *spawns cheap minion swarms* and *hosts trap-rooms*. The faction hero is an **Overlord/Warden** who commands those minions. |
| Dawn of War: global build anywhere, hero wargear, squads | **Global building** (build anywhere via roots/mule) and **hero units** with abilities. |
| StarCraft: race asymmetry, worker-economy, tech tiers, high-ground sight | **Fully asymmetric races**, a **two-resource economy** (Ore + Gas), **3 tech tiers**, and **line-of-sight cliffs** that block shots. |
| Protoss/Zerg + Alien/Predator movies (eventual) | **Aliens** (Chunk 11): warp-in on **Psionic Ground** (Zerg creep × Protoss warp), regenerating **shields**, **cloaking** hunters (Predator), **parasite/mind-control** (Alien), **morph** upgrades (Zerg). |

### Setting & factions
A frontier blighted by a spreading corruption. Two races fight over the dying land, and a third
**invader** is planned (Chunk 11):

- **Forgefolk (Humans)** — industry, steam, and steel. Blue. Defensive, tech-heavy, prefab bases.
- **Thornkin (Horde)** — living growth, blight, and hunger. Red. Aggressive, organic, swarm-heavy.
- **Aliens (eventual)** — a hive-mind invader that warps in on psionic ground; shields, cloaking,
  parasites. Green. (See dedicated section below.)

Single skirmish map (128×128): each base has an ore field + a gas vent; a center contested region
holds richer ore + a second vent, plus 2-3 neutral **Control Points**.

### Economy (harvesters kept, re-skinned)
- **Ore** (scrap for Forgefolk / marrow for Thornkin) is the main currency. Harvesters drive to a
  field, fill a cargo, return to their drop-off (Smeltery / Heartwood), and dump for credits into a
  silo. Ore depletes and slowly respawns.
- **Gas** is a rarer second resource from vents (**Steam-Vent** / **Bloodspring**), needed for
  tech tiers and hero abilities (SC/C&C-gems flavor).
- **Power** (Boilers / Bloodflowers) is the growth limiter: power deficit slows build/train.
- A unit cap exists only for performance, not design.

### Asymmetric building
- **Forgefolk**: **Foundry-Mule** deploys → **Foundry** (their base). Sidebar buys **prefab**
  structures that *drop instantly* with a crane flash. Strong, fast, but everything sits on one
  footprint (no global build without a Mule nearby).
- **Thornkin**: **Worldroot** (a corrupted tree that walks) **roots itself** → **Heartwood** (base).
  Buildings **grow** as saplings over a growth timer, and the Heartwood's **Root-Network** lets
  them sprout *anywhere on the map* it reaches — a forward-base/global-build advantage.

### Races, roster & heroes (asymmetric)
**Forgefolk (Humans):**
- Squads: **Chainsaw-Men** (melee squads; saws chew through armor/buildings), **Riflemen**
  (ranged squads with suppression).
- Vehicles: **Scrap-Lorry** (harvester), **Forge-Tank** (steam tank, rear-armor bonus),
  **Engineer** (reinforce/repair).
- Defense: **Gun-Nest** (auto-fires), **Steam-Trap** (scalding vent — a trap), **Wall**.
- Hero: **the Marshal** — a commander with a morale aura, an order system, and a **steam-strike**
  ability (artillery call-in).

**Thornkin (Horde):**
- Squads: **Axe-Thralls** (melee squads), **Spore-Shamans** (ranged, damage-over-time).
- Monsters: **Bark-Behemoth** (giant tree-golem), **Blight-Grub** (cheap swarm minion).
- Harvest: **Marrow-Tender** (harvester).
- Defense: **Thorn-Briar** (spiked growth), **Bramble Pit / Tar Spit** (traps), **Bone-Wall**.
- Hero: **the Warden / Overlord** — commands the Hollow's minions, sets trap-rooms, and has a
  **root-grasp** ability (root an enemy in place).

### Third faction — Aliens (eventual, post-v1; full detail here, built in Chunk 11)
A hive-mind invader from beyond. Draws on **Protoss** (warp-in, shields, psi-tech), **Zerg**
(creep, swarm, morph), the movie **Alien** (hive, queen, acid, parasites) and **Predator**
(cloaking, plasma, hunting). Original blend:

- **Build**: **Hive-Nexus** (base) spreads **Psionic Ground** (creep). Structures **warp-in**
  (teleport flash) but *only on Psionic Ground* — global-build within the field. Protoss warp-in
  × Zerg creep.
- **Economy**: **Harvester-Drones** collect **Bio-Ore** + **Resonance** (gas from geysers), dump
  at **Fungal-Refinery**. Power: **Psi-Resonators** → **Psi-Power**.
- **Units**: `warrior-drone` (fast twin-blade melee), `hunter-stalker` (**cloaks** when idle,
  plasma-caster, bonus vs isolated targets), `acid-spitter` (ranged acid DoT), `hive-swarm` (cheap
  melee swarm), `parasite-larvae` (latches on an enemy, drains it, **briefly mind-controls** it).
- **Defense/traps**: `spore-nest` (auto-fire), `acid-pool` (trap, DoT), `bio-wall`; traps
  **Spore-Mines** (burst) and **Acid-Pools** (DoT) — fog-hidden like Orcs-Must-Die.
- **Unique mechanics**: regenerating **shields** (layer over HP), **cloaking**, **Psionic Ground**
  build restriction + spread, **parasite/mind-control**, **morph** (drones upgrade at tech tiers).
- **Hero**: **the Matriarch** (Queen) — commands the hive/swarm, **Acid-Ward** AoE,
  **Psionic Command** (mind-control), **Hive-Instinct** (briefly cloaks nearby drones).
- **Tech**: 3 tiers gated by **Resonance** (Warp-Tech).

### Shared original systems
1. **Squads & cover** (CoH): infantry squads of 3-4, reinforceable; low/high cover reduces
   damage; **garrison** buildings (enter & defend).
2. **Directional armor + suppression** (CoH): tanks take bonus damage from rear; heavy fire
   *pins* squads (slower movement/fire).
3. **Traps** (OMD): ground-placed, fog-hidden, trigger on enemy feet. Thornkin specialize;
   Forgefolk have Steam-Traps.
4. **The Hollow** (Dungeons/Overlord): burrow building that spawns minions and hosts trap-rooms;
   the hero commands them. Buildable by both races (Thornkin stronger).
5. **Control Points** (CoH/DoW): neutral points capture → trickle income + victory timer.
6. **Global building** (DoW): Thornkin via Root-Network; Forgefolk via deploying Mules.
7. **Tech tiers** (SC/WC3): 3 tiers unlock units/upgrades; Gas gates the higher tiers.
8. **Line-of-sight cliffs** (SC): elevated tiles block shots; units on high ground shoot down.
9. **Shroud + fog** (RA2/WC3): unexplored black persists; enemies hidden out of sight.
10. **Heroes** (DoW/WC3/CoH): one unique hero per race with abilities, revive-able.

### Core RTS systems (must all exist by final chunk)
1. Fixed-timestep deterministic sim; render interpolates.
2. A* pathfinding, separation steering, no overlap.
3. Shroud + fog, with **fog-hidden traps**.
4. Selection: click, box-select, right-click orders (move/attack/harvest/build/deploy).
5. Order queue: move, attack-move, harvest, deploy, build placement, garrison, trap-place.
6. Combat: squads, cover, directional armor, suppression, projectiles, death.
7. Economy: Ore + Gas, harvesters, silo, power grid, low-power penalty.
8. Asymmetric build: sidebar prefab-drop (Forgefolk) vs sapling growth + Root-Network (Thornkin).
9. **The Hollow** (minions + trap-rooms), **traps**, **control points**.
10. Heroes with abilities; 3 tech tiers; skirmish AI; win/lose (destroy enemy base / hold points).
11. UI: sidebar, minimap w/ shroud, squad/health bars, hero panel, portraits (procedural).

### Control scheme
- **Left-click**: select; drag = box-select; click building = select.
- **Right-click**: context order (move / attack / harvest / deploy / build / garrison).
- **Sidebar**: click structure → placement mode; click map to build; `Esc` cancels.
- **Hero/ability keys**: `Q/W/E` cast abilities on selection.
- **Keyboard**: `A` attack-move, `H` harvest, `T` trap-place, `Esc` deselect, `Ctrl+number` groups,
  `F1` select all army, `Space` select idle harvesters, `+/-` zoom, `P` pause.
- Camera: WASD pan, edge-pan, wheel zoom, middle-drag pan.

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
   forest=trees as cone meshes, water=blue plane, ore/gas fields=crystal mounds). Use
   `CanvasTexture` with a procedural grass noise texture. Low-poly, instance-meshed for perf.
3. `src/render/unitmesh.ts`: build low-poly units/buildings from primitives (box bodies + cone
   heads) tinted per team. A `MeshRegistry` maps entityId→mesh, updated each frame from sim
   (positions interpolated between last two ticks).
4. `src/render/camera.ts`: RTS camera — WASD pan, edge scroll, wheel zoom (clamped), middle-drag
   pan. Keep within map bounds.
5. `src/render/selection.ts`: draw a selection ring/outline under selected units (flat ring mesh);
   highlight selected buildings with emissive edge.
6. `src/main.ts`: wire input (pointer events → world raycast; click/box select) and call into
   game. Add a dev "spawn two harvesters" (Forgefolk Scrap-Lorry + Thornkin Marrow-Tender)
   debug command to see movement (temporary; remove in Chunk 9).
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
1. `src/sim/order.ts`: `Order` = union type (Move, Harvest, Attack, Build, Stop, Deploy, Garrison,
   Trap). Unit has `orderQueue`. Right-click sets context order based on cursor (enemy unit →
   attack; ore/gas field → harvest; empty ground → move; Mule/Worldroot on clear ground → deploy;
   garrisonable building → garrison; building → build placement ghost).
2. `src/render/hud.ts` (start): DOM overlay for selection readout (name, hp, ore/gas) — minimal
   now, full in Chunk 7.
3. Input pipeline: raycast to pick entity/tile; drag threshold distinguishes click vs box-select;
   `A` sets attack-move; `Esc` deselects; `Ctrl+num` save/recall groups (store unit ids); `T` trap.
4. Headless tests: order queue executes in order; move order reaches goal within tolerance;
   attack order acquires target; harvest order sets harvester state; deploy order converts the
   Mule/Worldroot.

**DoD:** In browser: left-click selects, drag box-selects multiple, right-click moves unit to
ground, right-click enemy attacks, right-click ore/gas field harvests (harvester moves & starts),
right-click Mule/Worldroot on ground deploys. Build clean, tests green.

---

### CHUNK 5 — Economy & asymmetric building (harvesters, ore+gas, power, race build styles)
**Goal:** Full two-race economy (harvesters, two resources, power) + both build systems + production.

Steps:
1. `src/sim/economy.ts`: Harvester states (idle→driveToField→harvest→driveToDropoff→dump). Ore
   fields and Gas vents hold reserves and deplete (slowly respawn). Drop-off (Smeltery/Heartwood)
   receives cargo → ore into silo; silo capacity blocks dumping. Carry, harvest, dump rates in
   `config.ts`. Gas is gated for tech/hero (Chunk 8).
2. `src/sim/races.ts` + `src/sim/building.ts`: faction definitions. **Forgefolk**: Foundry-Mule
   `deploy` → **Foundry**; sidebar buys **prefab** structures that *drop instantly* (crane flash,
   short build timer). **Thornkin**: Worldroot (walking tree) `deploy` → **Heartwood**; buildings
   *grow* as saplings over a longer timer; **Root-Network** lets them sprout anywhere within its
   reach (global build). `building.place(blueprint)` ghost preview, valid/invalid tiles, red/green.
3. `src/sim/tech.ts` → power grid: each building powerConsumed; Boilers/Bloodflowers supply.
   Deficit slows build/train (low-power penalty). Unfinished buildings are non-functional.
4. Production: Forgefolk **Barracks** trains infantry squads; **Weapons Factory** builds vehicles.
   Thornkin **Heartwood** grows squads; **Behemoth-Pit** grows monsters. Each has a **queue**
   with sequential build times.
5. `src/render/unitmesh.ts`: prefab drop flash vs sapling growth scaling; ghost preview; harvester
   cargo visual; walking-tree deploy animation.
6. `src/render/hud.ts` (start): ore+gas panel, power bar, race-aware sidebar tabs. Full UI in Chunk 7.
7. Headless tests: harvester cycle yields correct ore; silo blocks dumping; gas gating; power
   deficit slows production; Mule deploy → Foundry and Worldroot deploy → Heartwood; prefab vs
   growth timers; Root-Network build range respected.

**DoD:** Both races' economy works in browser: deploy base (Mule or Worldroot), harvest ore+gas,
build (prefab drop vs sapling growth), train/build units. Power + resources correct. Tests green,
build clean.

---

### CHUNK 6 — Combat, squads & cover, traps, death, shroud + fog
**Goal:** Units fight as squads, cover/traps matter, shroud/fog hides the map.

Steps:
1. `src/sim/combat.ts`: `attack` order — approach to range, face target, fire rate, armor/weapon
   tiers. Projectiles travel then apply damage. **Rear-hit bonus** for vehicles (directional
   armor); **suppression** pins squads (slower move/fire) under heavy fire.
2. `src/sim/squads.ts` + `src/sim/cover.ts`: infantry are **squads** of 3-4 models sharing an HP
   pool; squads **reinforce** at a Barracks/Heartwood (cost per man). **Low/high cover** reduces
   incoming damage; **garrison** lets infantry enter buildings and fire from them.
3. `src/sim/traps.ts`: ground **traps** placed by units, **hidden in fog** until triggered, fire
   on enemy feet: **Bramble Pit** (damage+slow), **Tar Spit** (slow), **Steam-Trap** (damage,
   Forgefolk). Thornkin get more trap types.
4. `src/sim/fog.ts`: per-player **shroud + fog**; explored persists (shroud cleared), enemies
   hidden unless currently visible (fog). Fog hides traps too. Feeds render + selection.
5. `src/render/projectiles.ts` + `fx.ts`: shell tracers, build flashes, trap-trigger effects,
   death fade + wreck decal.
6. `src/sim/ai.ts` (start): scripted Thornkin opponent — grow base, harvesters, then army-push +
   trap placement. Simple & deterministic.
7. Win/lose: `game.checkEnd()` — destroy enemy base (Foundry/Heartwood + buildings) or hold
   control points (Chunk 8) → overlay.
8. Headless tests: DPS correct; rear hit bonus applies; suppression pins squad; squad reinforce
   costs/replaces men; cover reduces damage; trap triggers once on enemy feet; fog hides unit.

**DoD:** In browser: two squads fight (tracers fly, squad HP drops, death). Cover/traps affect
combat. Enemy hidden until scouted; minimap (Chunk 7) shows shroud. Build clean, tests green.

---

### CHUNK 7 — Full UI: race sidebar, minimap w/ shroud, squad bars, hero panel, portraits
**Goal:** Polished, playable interface for both races.

Steps:
1. `src/render/minimap.ts`: canvas 2D minimap — terrain, unit dots, **shroud+fog** shading, and
   **control-point** icons. Click-to-move camera; 10Hz updates.
2. `src/render/hud.ts` (full): ore+gas + power bar (low-power warning), minimap, and a **right-side
   race-aware sidebar** (Forgefolk: Base/Defense/Infantry/Vehicle; Thornkin: Growth/Defense/Minions/
   Monsters). Entries show cost + build/growth progress; clicking enters placement mode. Squad
   health bars over units, announcements ("Harvester ready", "You are victorious!").
3. Unit portraits: procedural canvas icons per type (no assets).
4. `src/render/selection.ts`: squad bars, selection rings, attack lines, garrison + deploy buttons.
5. **Hero panel** (from Chunk 8): ability slots `Q/W/E` + cooldowns.
6. Pause (`P`), game timer, FPS counter (`perf.ts`).
7. Headless tests: `hud.ts` has a pure-ish `update(state)` API testable for resource/power/sidebar
   cost + progress formatting.

**DoD:** Full playable skirmish vs AI for both races: deploy, build from sidebar, harvest, fight,
see minimap/shroud, control points, hero panel, win/lose overlays. Build clean, tests green.

---

### CHUNK 8 — Heroes, The Hollow, control points, tech tiers, balance
**Goal:** Endgame depth: unique heroes, the dungeon layer, victory points, 3-tier tech.

Steps:
1. `src/sim/heroes.ts` + `src/sim/powers.ts`: **the Marshal** (Forgefolk) — morale aura, order
   system, **Steam-Strike** artillery call-in. **the Warden/Overlord** (Thornkin) — commands
   Hollow minions, sets trap-rooms, **Root-Grasp** roots an enemy in place. Heroes revive after a
   timer; effects deterministic & testable.
2. `src/sim/hollow.ts`: an underground **Hollow** burrow building that spawns **Blight-Grub**
   minion swarms over time and hosts **trap-rooms** (slots where traps can be set). Both races can
   build it; Thornkin stronger. The hero commands the swarm.
3. `src/sim/controlpoints.ts`: neutral **Control Points** captured by standing; grant trickle ore
   income and drive a **victory timer** (hold X of Y points for Z seconds to win).
4. `src/sim/tech.ts`: **3 tech tiers** (Gas-gated) unlocking upgrades + higher-tier units.
5. Extend `ai.ts`: uses heroes, hollow minions, and pushes control points.
6. Balance pass: tune harvest/build/train/combat so an AI skirmish is winnable in ~10 min.
   Constants in `config.ts` with comments.
7. Headless tests: hero ability effects (Steam-Strike AoE, Root-Grasp root); hollow spawns
   minions at rate; control point capture/income/victory timer; tech tier gates unit/upgrade.

**DoD:** Heroes, Hollow minions, control points, and 3 tech tiers work and are balanced; AI
skirmish winnable in ~10 min. Build clean, tests green.

---

### CHUNK 9 — Audio, polish, optimization, robustness, packaging
**Goal:** Juice, sound, 60fps on M-series, and a ship-ready production build.

Steps:
1. `src/audio/sound.ts`: Web Audio synth — construction/prefab drop, sapling growth, tank fire,
   chainsaw, axe, trap trigger, hero ability, harvester dump, click, victory sting. A mixer.
2. Polish: unit idle bob, facing smoothing, soft fog/shroud edges (shader), nicer water, sky
   gradient, screen shake on big hits, trap flicker.
3. Perf: instance meshes for units/buildings/trees; cap draw calls; LOD for far units; minimap
   throttled; GC pass (object pooling for projectiles/minions). Target ≥60fps on M1/M2/M3 full map.
4. Remove Chunk 3 debug spawn command. Add `?seed=` URL param for reproducible maps.
5. Robustness: error boundary → "reload" screen; `ResizeObserver`; pause on blur; dispose meshes.
6. `npm run build` then `npx vite preview` → confirm production bundle serves and runs.
7. `docs/LOG.md` final summary + `README.md` run instructions (no accounts).
8. Headless test: full 3000-step deterministic sim from fixed seed passes invariants (no NaN,
   no leaks, consistent end-state).

**DoD:** 60fps on M-series; `vite preview` works; `npm run build` zero errors; README documents
`npm install && npm run dev` and `npm run build`; all tests green.

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

### CHUNK 11 — Third faction: Aliens (post-v1 stretch; start only after Chunk 10 passes)
**Goal:** Add the Aliens as a full third faction, reusing the sim and all shared systems.

Steps:
1. Extend `races.ts` to 3 factions; add Alien units/buildings/hero from Section 3.
2. New `src/sim/shields.ts`: regenerating **shield** layer over HP for Alien units/buildings
   (absorbs damage first, regenerates when not hit).
3. **Cloaking** on `hunter-stalker`: hidden unless moving; shimmer effect in render; fog interplay
   (cloaked unit invisible to enemies).
4. New `src/sim/psionic.ts`: **Psionic Ground** creep field spreads from the Hive-Nexus; buildings
   **warp-in** only on the field (else invalid placement).
5. `parasite-larvae` **parasite/mind-control**; **morph** upgrades for drones at tech tiers.
6. Alien AI (swarm pressure + hunter-killer behavior), balance vs both races, audio/polish.
7. Headless tests: shields absorb then regenerate; cloak hides a stationary unit; warp-in blocked
   off-field; mind-control expires and returns the unit; morph upgrades stats.

**DoD:** Any 2-faction skirmish pairing works (incl. Aliens); all prior gates (`build`, `test`,
`preview`) still green; 60fps on M-series with 3 factions.

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
- A full skirmish RTS loop exists: deploy → harvest → build (prefab/growth) → train → tech →
  fight (squads/cover/traps/heroes) → win/lose → shroud/fog/minimap/sidebar/control-point UI.
- `npm run dev`, `npm run build`, `npm run test`, `npx vite preview` all pass.
- Zero developer accounts, zero paid services, zero licensed assets, zero runtime network.
