# NG-RTS

An original real-time strategy game — **Forgefolk (Humans) vs Thornkin (Horde)** — inspired by
Command & Conquer / Red Alert, Warcraft II & III, Company of Heroes, Dawn of War, StarCraft,
Orcs Must Die, and Dungeons/Overlord. (Aliens faction planned post-v1.)

Runs in the browser on any **M-series Mac** (WebGL). No developer accounts, no paid services,
no runtime network.

## Run it

```bash
npm install
npm run dev          # dev server → open http://localhost:5173
```

Reproducible maps: `http://localhost:5173/?seed=12345`.

## Build & test

```bash
npm run build        # strict TS type-check + production bundle (dist/)
npm test             # headless deterministic simulation tests (no browser needed)
npx vite preview     # serve the production build to verify it works
```

## Controls

| Input | Action |
|---|---|
| Arrow keys / screen edge / middle-drag / wheel | pan / zoom camera |
| Left-click, drag | select, box-select |
| Right-click | context order: move · attack · harvest · deploy |
| `A` / `S` / `G` / `D` | attack-move / stop / gather / deploy |
| `Esc` | deselect / cancel build |
| `P` | pause |
| `Ctrl+1..9` | save / recall unit groups |
| Sidebar → click building | enter build mode → left-click to place |
| Click minimap | jump camera |
| `E` | bootstrap economy demo for both races |
| `M` / `N` / `H` | debug spawns: Mule / Worldroot / harvester |

## Architecture

- **Simulation** (`src/sim/*`) is pure and deterministic (seeded PRNG, fixed 30 Hz ticks) —
  fully headless-testable in Node.
- **Rendering** (`src/render/*`) is Three.js WebGL with interpolation between ticks.
- **Audio** (`src/audio/*`) is procedural Web Audio synth — no samples, no assets.
- Assets are procedural (or CC0/public-domain, bundled locally) — no copyrighted art.

## Factions

- **Forgefolk (Humans)**: prefab sidebar builds, Boilers, Scrap-Lorry harvesters, the **Marshal** hero.
- **Thornkin (Horde)**: a walking Worldroot that roots into a Heartwood, sapling-growth builds
  anywhere (Root-Network), Bloodflowers, Marrow-Tender harvesters, Hollow minions, the **Warden** hero.
- Shared systems: harvesters, ore+gas, power grid, control points, 3 tech tiers, traps, fog of war.
