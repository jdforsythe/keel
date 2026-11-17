# ADR-0145: `keel build` writes the production client whatever `NODE_ENV` says (RFC 0124)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-17).

**Context.** The generated client and resume entries computed `mode` from `import.meta.env.DEV`, and the client entry ran the inspect reporter under the same flag. Vite sets `DEV` from `NODE_ENV` once it is set, by the shell or by a project `.env`, and `keel build` passed the shell environment to `vite build` unchanged. A build under `NODE_ENV=staging` or `NODE_ENV=test` therefore shipped a dev client: thrown messages on screen and every store snapshot posted to `/__keel/inspect`, beside a server that runs in production.

**Decision.**
- D1: the Vite plugin writes `mode` into the client and resume entries as a string literal chosen by Vite's command: `"dev"` when Vite serves, `"production"` when it builds. `entryCode` and `resumeEntry` take `mode: 'dev' | 'production'`, default `'production'`; neither entry reads `import.meta.env`, and the reporter is guarded by `mode === "dev"`, so a build drops it.
- D2: `keel build` runs every Vite build it starts (`viteRun`, `shellBuild`) with `NODE_ENV=production`. A `.env` `NODE_ENV` has no effect on it; `keel dev` is unchanged.
- D3: the override is silent. A successful build prints only its trailer.
- D4: a bare `vite build` also gives production kernel entries. There is no way to build a dev client; the inspector smoke serves golden-1 with `keel dev`.
- D5: `keel build` passes no `--mode`, so the project's `.env.<mode>` selection is unchanged.

**Alternatives.**
- `NODE_ENV=production` only: a `vite.config.ts` `define`, or a bare `vite build`, could still flip the kernel's mode.
- The literal only: app code and libraries that branch on `import.meta.env.DEV` or `process.env.NODE_ENV` would ship their dev branches.
- A `W` line when `NODE_ENV` is overridden: fires on every CI job that sets `NODE_ENV=test`.
- Refuse to build under another `NODE_ENV`: breaks those CI jobs for a value the build can ignore.
- `--mode production` keyed on `import.meta.env.MODE`: changes which `.env.<mode>` files load, and a config can still set `MODE`.

**Consequences.**
- A deployed client built under another `NODE_ENV` becomes production on its next `keel build`: thrown text shows as `unexpected` and nothing posts to `/__keel/inspect`.
- App code sees `import.meta.env.DEV === false` in every `keel build`; a team's own debug switch moves to a `VITE_`-prefixed variable.
- `server.mjs` still decides its mode from its own environment at run time.
