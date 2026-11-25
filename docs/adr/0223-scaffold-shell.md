# ADR-0223: k.scaffold-shell: `keel scaffold shell <tauri|capacitor>` adds a native shell (RFC 0201)

**Status:** accepted (orchestrator, 2026-11-24; under D103).

**Context.** A native shell is declared as `shells` on a `client` deployable, and the app lists the shell's std package, its plugins and the shell's CLI and platform packages. Each was a hand edit, and the CLI and platform versions were known only to the apps that listed them. `@keel/scaffold` cannot import the std packages (they depend on `@keel/cli`), and before the install the std package cannot be read from the project.

**Decision.**
- `keel scaffold shell <tauri|capacitor> --id <reverse-dns> [--name <title>] [--to <deployable>]` is a generator that changes `topology.ts` and `package.json` and no other file. `--id` has no default; `--name` defaults to the title-cased `package.json` `name`; `--to` to the one `client` deployable. Capacitor gets both platform packages.
- `topology.ts` gains `shells: { <shell>: { id, name } }` as the deployable's last property, in the layout `connectOrigin` keeps. `package.json` gains the std package at `@keel/server`'s version text and the shell's app packages at the versions the std package declares; an entry already there is kept, except a plugin at another version, which is set.
- Each std package declares its app packages in its own `package.json`: plugins and `@capacitor/core` in `dependencies`, the CLI and platform packages in optional `peerDependencies`. `pnpm generate` writes them into `@keel/scaffold`, and `pnpm check` fails on drift.
- The operation refreshes nothing. After the install and `keel build`, which writes the shell's files and CI jobs, `keel check` is clean and `keel build --target <shell>` needs only the native toolchain and, with a `node` deployable, `KEEL_ORIGIN`.
- Refusals: E1052 for input, E1353 naming E1573 for an `id` that is not reverse-DNS, E1351 for a shell already declared there, and new E1359 when no one `client` deployable can take the shell.

**Alternatives.**
- A `--shell` flag on `scaffold project`: no way to add a shell to an existing app, and two ways once both exist.
- Version literals in `@keel/scaffold`: a second copy kept by hand.
- Writing the shell's generated files when the std package resolves: the edit set would depend on `node_modules`.
- A default `id`: the store identifier and link scheme nobody chose.

**Consequences.** Every hand edit of `examples/native-tauri` and `examples/native-capacitor` is written by `keel scaffold project <name> --workspace` then `keel scaffold shell`. `keel check` reports E1159 until the install and E1005 for the shell's files until `keel build`; the k.scaffold Guarantee says so. The std packages gain optional peers; a version bump there needs `pnpm generate`. The map and `keel docs` token budgets are re-based by 20.
