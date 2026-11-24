# k.scaffold-shell: Adding a native shell
status: implemented

`keel scaffold shell <tauri|capacitor>` declares a native shell (k.shell) on a `client` deployable and lists what the shell needs in `package.json`. It is a generator (k.scaffold): one edit set, applied atomically, `--dry-run` as for any operation.
```sh
keel scaffold shell tauri --id com.acme.shop
keel scaffold shell capacitor --id com.acme.shop --name 'Acme Shop' --to web
```

**Input.** `{ shell, id, name?, to? }`. `shell` is `tauri` or `capacitor`, the first argument. `id` (`--id`) is the shell's reverse-DNS app id; it has no default, since it is the app's store identifier and its return links' scheme (k.return). `name` (`--name`) is the shell's title; its default is the `package.json` `name` with any `@scope/` dropped, split at `-`, `_` and `.`, each word's first letter upper-cased, joined by spaces (`native-tauri` gives `Native Tauri`). `to` (`--to`) names the deployable; its default is the topology's one `client` deployable.

**Edits.** Exactly two files change, and no other is created, changed or removed:
1. `topology.ts`: the deployable gains `shells: { <shell>: { id: '<id>', name: '<name>' } }` as its last property, or its `shells` object gains the `<shell>` entry as its last, in the file's quote style. Its other properties keep their text. A one-line deployable the edit would take past 120 columns is written one property per line.
2. `package.json`, keys of each object sorted: `dependencies` gains the shell's package (`@keel/std-tauri`, `@keel/std-capacitor`) at the version text of `@keel/server` there; `dependencies` and `devDependencies` gain the shell's app packages (std.tauri, std.capacitor App packages), each in the field and at the version the shell's package declares, with `identity` true when the project has `identity.ts`. A package already listed in `dependencies` or `devDependencies` is kept as written, except a `plugins` entry (k.shell Plugins) at another version text, which is set to the declared one.

`@keel/scaffold` carries each shell package's declared versions, generated from that package's `package.json` at the same release, so an app's versions are the shell package's own and never another app's.

**After it.** The operation refreshes nothing (k.scaffold Refresh): its packages are not installed yet. Until the package manager installs them, `keel check` reports E1159 for the shell's `./tools`. After the install, `keel build` (with or without `--target`) writes the shell's files and CI jobs (k.shell Files, CI); until then `keel check` reports each as E1005, and after it no diagnostic the operation caused. `keel build --target <shell>` then needs only the native toolchain (k.shell Build 3, E1575 for a tool) and, with a `node` deployable in the topology, `KEEL_ORIGIN` (k.shell Build 2). The k.scaffold Guarantee holds once those two steps ran.

**Refusals.** Each writes nothing, judged in this order:
- `shell` neither `tauri` nor `capacitor`, no `id`, no `name` and no `package.json` `name` to derive one from, `to` naming no deployable, no `topology.ts`, or a `package.json` that is not a JSON object: E1052.
- An `id` that is not reverse-DNS: E1353 naming E1573.
- No `client` deployable, several and no `to`, or `to` naming one that is not `client`: E1359, naming the deployables.
- The deployable already declares `<shell>`: E1351. Its deployable or `shells` written as something other than an object literal: E1052.

**Rules.** E1359 `scaffold shell` has no one `client` deployable to take the shell: none, several and no `--to`, or `--to` naming another adapter; names them (no fix: pass `--to <client deployable>`, or `keel codemod place <module> --to <name> --adapter client`).

**Conformance.** Project `p` is `keel scaffold project p`, its `package.json` `name` `p`; `pw` is `keel scaffold project native-tauri --workspace`.
- In `p`, `shell { shell: 'tauri', id: 'com.acme.p' }` changes `package.json` and `topology.ts` alone; `web` gains `shells: { tauri: { id: "com.acme.p", name: "P" } }` as its last property, one property per line, its other properties unchanged; `dependencies` gains `@keel/std-tauri` at `@keel/server`'s text, `devDependencies` gains `@tauri-apps/cli`, nothing else is added, and each object's keys are sorted.
- In `p`, `shell: 'capacitor'` adds `@keel/std-capacitor`, `@capacitor/core`, `@capacitor/preferences` and `@capacitor/app` to `dependencies` and `@capacitor/cli`, `@capacitor/android` and `@capacitor/ios` to `devDependencies`; with `identity.ts` in the tree, `@capacitor/browser` too.
- In `pw`, `tauri` with no `name` gives `name: "Native Tauri"`; a `package.json` `name` of `@acme/my_app.desktop` gives `My App Desktop`; `name: 'Acme'` is written as given; no `package.json` `name` and no `name` is E1052.
- `tauri` then `capacitor` on `web` leaves `shells` with both entries, `tauri` first; `tauri` twice is E1351 the second time, nothing written.
- With `client` deployables `web` and `admin` and a `node` deployable `api`: no `to` is one E1359 naming `web` and `admin`; `to: 'admin'` edits `admin` alone; `to: 'api'` is E1359 naming `api`; `to: 'nope'` is E1052. In `keel scaffold project q --adapter node`, no `to` is E1359. Nothing is written in each refusal.
- `shell: 'electron'`, and no `id`, are each E1052; `id: 'shop'` is E1353 naming E1573. Nothing is written.
- A `package.json` with `@tauri-apps/cli` `^2` in `devDependencies` keeps it; one with `@capacitor/app` `^8.0.0` in `dependencies` gets the declared version, `keel check` then reporting no E1572 for it.
- In a project where `keel build` ran, the operation writes no file under `.keel/`, `deploy/` or `dist/`, and its trailer is `ok scaffold shell 0 created, 2 changed, 0 removed`, with no `artifacts`. Two runs on equal trees give equal edit sets; `--dry-run` writes nothing and prints the diff a following apply writes.
- Each refusal's compact line has a message under 90 characters.
