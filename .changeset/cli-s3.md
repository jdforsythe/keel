---
"@keel/cli": minor
---

`keel codemod place <module> --to <deployable> [--adapter]` moves a module between deployables. `keel build` writes the generated deploy files of `topology.ts` (Dockerfiles, `deploy/compose.yaml`, the CI workflow) read-only, and `keel check` reports E1005 for one that differs, with the regenerated file as the fix. Removing a file also removes the directories it empties.

In the workspace the `keel` binary runs `src/bin.ts`; the published package keeps `dist/src/bin.js` (`publishConfig.bin`). The apps list `@keel/cli` as a dev dependency and run `keel <command>` in their scripts, so `pnpm keel <command>` works from an app folder.
