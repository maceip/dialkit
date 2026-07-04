# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
- `dialkit` is a **library** (real-time parameter tweaking for React/Solid/Svelte/Vue), built with `tsup` + `@sveltejs/package`. Source is in `src/`.
- `example/` is a **React + Vite demo app** (PhotoStack) that consumes the library via `"dialkit": "file:.."`, so it imports the built output in `dist/`, not `src/`.

### Build/run dependency (non-obvious)
- The root `npm install` runs the `prepare` script, which runs `npm run build` and produces `dist/`. The example app cannot run until `dist/` exists, because it resolves `dialkit` to `../dist`. If `dist/` is missing, run `npm run build` at the repo root first.
- Because the example points at built `dist/` (not `src/`), editing library source in `src/` will **not** show up in the running example until `dist/` is rebuilt. For library development, run `npm run dev` (`tsup --watch`) at the repo root to rebuild `dist/` on change; Vite in `example/` then hot-reloads. (Note: `npm run dev` only rebuilds the tsup/React output, not the Svelte package.)

### Common commands
- Root library: `npm run typecheck` (tsc for react/solid/vue + `svelte-check`), `npm run build` (full build incl. Svelte package), `npm run dev` (watch).
- Example app: `npm run dev --prefix example` starts Vite on **port 3000** (http://localhost:3000/). `npm run build --prefix example` builds it.
- There is no lint script and no automated test suite in this repo.

### Notes
- `npm run typecheck` currently passes with 0 errors (svelte-check may report warnings; those are pre-existing and non-blocking).
