# ADR-0037: A production node deployable serves its Vite client build (RFC 0048)

**Status:** accepted

**Context.** RFC 0046 answers `/@keel/entry.ts` with source text that only a Vite dev server can resolve. A node deployable run with `node` in production therefore never resumes its islands (backlog 0116). Generated Docker and CI (S3) need a deployable that runs on its own.

**Decision.**
- **Build.** `keel build` runs Vite once more for each `node` deployable in `topology.ts`, with `KEEL_DEPLOYABLE=<name>`. The plugin's `config` hook then builds only the resume entry, with its island modules, into `dist/<name>/`. The output has hashed `assets/` and `.vite/manifest.json` (`CLIENT_MANIFEST`), and the run writes no `.keel/` artifacts. `topology.ts` is the only configuration.
- **Serve.** In production, `createApp({ assets: 'dist/<name>' })` reads the manifest's entry chunk and every `assets/` file once, at startup. Documents load `/<entry file>`, and those files are answered with `cache-control: public, max-age=31536000, immutable`. A missing or entry-less manifest rejects `createApp` with E1555.
- **Dev.** In dev, or without `assets`, `/@keel/entry.ts` is served as before.

**Alternatives.**
- **A Vite SSR server bundle.** This is deferred to S3: the entry's path to its client build differs between the source and the bundle.
- **Requiring `assets` in every production app.** This breaks in-process tests and apps whose pages have no islands.
- **Per-request disk reads.** These open traversal risk and cost filesystem work on each request.
- **A build section in `topology.ts`.** This is a second configuration surface.

**Consequences.**
- **Production start.** A production node server needs `keel build` before it starts. golden-1's `build` is now `keel build`, and its `server.ts` passes `assets`.
- **Build order.** The node client builds run after the project's own build, which empties `dist/`. A later plain `vite build` removes `dist/<name>/`.
- **Startup memory.** Built assets are held in memory from startup.
- **CSS.** Built CSS is not yet linked from server documents.
