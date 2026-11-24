---
"@keel/scaffold": minor
"@keel/cli": minor
"@keel/check": patch
"@keel/compiler": patch
"@keel/std-tauri": minor
"@keel/std-capacitor": minor
---

`keel scaffold shell <tauri|capacitor> --id <reverse-dns> [--name <title>] [--to <deployable>]` declares a native shell on a `client` deployable in `topology.ts` and lists the shell's std package, plugins, CLI and platform packages in `package.json`, at the versions the std package declares. It changes those two files and refreshes nothing; install, then `keel build`, and `keel check` is clean. `--name` defaults to the title-cased package name and `--to` to the one `client` deployable. `keel explain E1359` is new: no one `client` deployable to take the shell. `@keel/std-tauri` and `@keel/std-capacitor` declare the CLI and platform packages as optional `peerDependencies`, and `@keel/std-tauri` exports `./package.json`. `@keel/compiler/hosting/isReverseDns` is the reverse-DNS test E1573 uses.
