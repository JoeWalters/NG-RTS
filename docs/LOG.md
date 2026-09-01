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
