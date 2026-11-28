# ADR-0183: split k.shell: the kernel keeps the shell target, std.capacitor and std.tauri keep the vendors (RFC 0161)

**Status:** accepted (D47, accepted by the operator).

**Context.** k.shell held both the mechanism an app writes against and Capacitor 8's and Tauri 2's files, tool versions, build steps and CI runners. A frozen kernel cannot follow those vendors' releases, and k.return carried the same mix.

**Decision.** The kernel keeps `shells` (the closed set `capacitor | tauri`, each provided by its named package), `mode: 'shell'` and the driver contract, `shellMount`'s duty, the shell target contract (`shellTarget(shell, target)` from `@keel/cli`, called in the package's `./tools`: `platforms`, `files`, `tools`, `build`, `ci`), the five build steps, the CI job frame, and E1573, E1574, E1575 and the new E1585. std.capacitor and std.tauri hold what each vendor writes, needs and runs; std.shells keeps the drivers. Every generated file and CI job stays as it is.

**Alternatives.**
- Freeze k.shell whole: each vendor release becomes a kernel change.
- An open shell set: no type error for a typo, no E1572 fix, no third shell asked for; left to a later, additive RFC.
- The package writes its own files and jobs: the kernel could not hold them to E1005 or the deployable's paths.
- E1575 as a std code: the kernel prints it, so the kernel owns it.

**Consequences.** Tool version bumps and new vendor files change std sections only. Vendor code leaves `@keel/cli/shell` and `@keel/scaffold` for the two packages' `./tools`; `keel-capacitor-scheme` goes. Kernel shell conformance runs over a stub package; the vendor tests move with their bullets to std-capacitor and std-tauri.
