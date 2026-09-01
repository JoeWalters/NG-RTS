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
