# RFC 0161: split k.shell: the kernel keeps the shell target, std.capacitor and std.tauri keep the vendors

Status: implemented (ADR-0183). Decision D47 of `tasks/0963-to-p1/PLAN.md` (accepted by the operator); it removes the k.shell freeze blocker (D41).

## Decisions
- D1: the kernel keeps the mechanism: `shells` on a `client` deployable, the closed set `capacitor | tauri`, each provided by one named package; `mode: 'shell'` and the driver contract; `shellMount`'s duty; the shell target contract (`shellTarget`, `ShellTarget`); the five build steps; the CI job frame; E1573, E1574, E1575 and a new E1585.
- D2: what each vendor needs moves to two new stdlib sections, std.capacitor and std.tauri: the generated files and their contents, the tool versions, the tool runs, the Android cleartext rule, the meta policy, the scheme registration, the runner images and packages of the CI jobs, the platform APIs behind the launch report and the external browser, and the device limits. std.shells stays the drivers' section.
- D3: a shell package registers its target from its `./tools` entry with `shellTarget(shell, target)` from `@keel/cli`, as std.report registers a command with `stdCommand`. `keel check` and `keel build` import that entry for each declared shell, whether or not a module's `deps` lists the package (app code never imports it), and for a shell no deployable declares only while its `deploy/<name>/<shell>/` folder holds a file (k.shell Files: "Removing a shell removes its files."); a shell's name in other text or another path imports nothing. The import runs at `keel check` (binary, MCP, every LSP open or change) with the trust of any dependency that `deps` names; `docs/THREAT-MODEL.md` Stdlib loading states it. A registered target is held for the `./tools` file whose import registered it, so per project root: an LSP or MCP process serving two projects with different shell package versions reads each project's own. A second `shellTarget` for one shell in that import is E1053.
- D4: E1575 stays a kernel code: the kernel prints it, and the package says what is missing (`{ tool, need }`). E1585 is new, in the k.shell block E155x: a package that registers no target, or a shell file path outside its folder.
- D5: the shell names stay a closed vocabulary in the kernel (`capacitor`, `tauri`), mapped to `@keel/std-capacitor` and `@keel/std-tauri`. A third shell is an additive RFC. Third-party shell packages wait (For the operator, Q1).
- D6: no feature leaves 1.0. Each generated file is byte-identical before and after; each CI job runs as before.

## Problem
k.shell (status `proposed`, the last kernel section not `conformance-covered` but k.return and k.hosting) mixes two rates of change. Its Declaration, Shell ctx and Rules are the mechanism an app writes against. Its Files, Build and CI paragraphs are Capacitor 8's and Tauri 2's: `tauri.conf.json` keys, the exact crates of `Cargo.toml`, Rust 1.95, JDK 21, Xcode 26, WebKitGTK 4.1, `cap sync`, `assembleDebug`, `xcodebuild` flags, the Ubuntu and macOS runners. A frozen kernel cannot follow those vendors' releases: Tauri 2.13 needing Rust 1.96, or Xcode 27, would be a kernel semantics change under principle 8. k.return carries the same mix: "Capacitor reports its launch when `getLaunchUrl` settles, Tauri when `getCurrent` does", "Custom Tabs on Android, an in-app Safari view on iOS", and two Conformance bullets that test vendor packages.

The code has the same seam already. `@keel/cli/shell` (`shellPlan`, `shellBuild`, `toolchain`, `androidNetworkSecurity`, `metaPolicy`, `defaultIcon`) and `@keel/scaffold` (`capacitorConfig`, `cargoToml`, `tauriConf`, `tauriBuildRs`, `tauriMainRs`, `tauriLibRs`, `tauriCapability`, `tauriHttpCapability`, `crateName`, the `shellJobs` of `ciWorkflow`) hold Capacitor and Tauri knowledge in kernel packages; `@keel/std-capacitor` has a `keel-capacitor-scheme` bin the CLI calls by name. The browser side is already split: the generated entry imports `capacitorDrivers` or `tauriDrivers` and `./shellMount` from the std package (`compiler/src/internal/entryCode.ts` `SHELLS`), and `shellMount` talks to the router through `mountRequests` (`@keel/router/internal`).

## Proposal
The kernel defines a shell target and runs it; the shell package fills it.

**What the package provides** (k.shell Shell ctx, Shell target):
- `.`: `<shell>Drivers({ origin })`, returning `{ storage, net }` that keep k.shell's driver contract (std.shells tests each).
- `./shellMount`: `shellMount(ctx, { id, origin })`, called by the entry before the router starts when the project has `identity.ts`: it opens the URLs the router hands it in an external browser sharing no cookie with the app, reports the launch once, then delivers return links (k.links), through `mountRequests`.
- `./tools`: calls `shellTarget(shell, target)` once.

```ts
// @keel/cli (new export; types beside it)
export type ShellApp = {
  readonly deployable: string
  readonly id: string
  readonly name: string
  readonly version: string
  readonly pkg: string
  readonly policy: string | undefined
  readonly identity: boolean
}
export type Probe = {
  readonly run: (cmd: string, args: readonly string[]) => { readonly code: number; readonly out: string } | undefined
  readonly exists: (path: string) => boolean
  readonly platform: string
}
export type ShellProbe = {
  readonly platform: string | undefined
  readonly env: Readonly<Record<string, string | undefined>>
  readonly probe: Probe
}
export type ShellBuild = ShellApp & {
  readonly root: string
  readonly dir: string
  readonly origin: string
  readonly platform: string | undefined
  readonly release: boolean
  readonly env: Readonly<Record<string, string | undefined>>
}
export type ShellJob = {
  readonly job: string
  readonly runsOn: string
  readonly platform?: string
  readonly manual: boolean
  readonly steps: readonly string[]
  readonly env: Readonly<Record<string, string>>
  readonly artifact?: string
}
export type ShellTarget = {
  readonly platforms: readonly string[]
  readonly files: (app: ShellApp) => Readonly<Record<string, string>>
  readonly tools: (at: ShellProbe) => readonly { readonly tool: string; readonly need: string }[]
  readonly build: (at: ShellBuild) => { readonly artifact: string } | { readonly error: string }
  readonly ci: (app: ShellApp) => readonly ShellJob[]
}
export declare function shellTarget(shell: 'capacitor' | 'tauri', target: ShellTarget): void
```
`probe` runs a command and resolves a relative path from the project folder, so `tools` reads `node_modules/.bin/tauri` without being told the root.

```ts
// packages/std-tauri/src/tools.ts: `@keel/std-tauri/tools`, no exports
import { shellTarget } from '@keel/cli'
import { tauriTarget } from './tools/tauriTarget.ts'

shellTarget('tauri', tauriTarget)
```
```ts
// packages/std-tauri/src/tools/tauriTarget.ts
import type { ShellTarget } from '@keel/cli'
import { tauriBuild } from './tauriBuild.ts'
import { tauriFiles } from './tauriFiles.ts'
import { tauriJobs } from './tauriJobs.ts'
import { tauriTools } from './tauriTools.ts'

export const tauriTarget: ShellTarget = {
  platforms: [],
  files: tauriFiles,
  tools: tauriTools,
  build: tauriBuild,
  ci: tauriJobs,
}
```
```ts
// packages/std-tauri/src/tools/tauriTools.ts
import type { ShellProbe } from '@keel/cli'

export function tauriTools(at: ShellProbe): readonly { readonly tool: string; readonly need: string }[] {
  const out: { tool: string; need: string }[] = []
  if (!at.probe.exists('node_modules/.bin/tauri')) out.push({ tool: 'tauri', need: "@tauri-apps/cli in the app's devDependencies" })
  const cargo = at.probe.run('cargo', ['--version'])
  if (cargo === undefined || cargo.code !== 0) out.push({ tool: 'cargo', need: 'Rust 1.95' })
  return out
}
```
(The real `tauriTools` keeps today's `CARGO_HOME`, version and WebKitGTK reads; the sample shows the shape.)

**What the kernel does** (k.shell Build): (1) the shell is declared and its target registered (E1052, E1585), `--platform` against the target's `platforms` (E1052); (2) `KEEL_ORIGIN` (E1574); (3) `tools`, each entry one E1575 with the kernel's message `<tool> missing or too old: needs <need>`; (4) the shell entry and Vite web build into `dist/<name>/<shell>/www/`, `deploy/<name>/<shell>/` copied beside it; (5) `build`, an `error` trimmed by `toolError` (from the first error line, at most 12), an `artifact` in the trailer. Before any of it, `keel build` writes `files` under `deploy/<name>/<shell>/` as deploy files, and `keel check` holds them to E1005 and rejects a path outside the folder (E1585). The generated workflow frames each `ShellJob`: `<name>-<job>`, the paths gate, `KEEL_ORIGIN` from `vars`, checkout, pnpm, Node 22, the target's `steps`, install, `keel build --target <shell> [--platform]` with `env`, upload of `artifact`; `manual` adds `workflow_dispatch` and gates the job on it.

**What the kernel checks** of a package: that `./tools` imports (E1159) and registers once (E1053, E1585); that `files` paths stay in their folder, by their text and on disk: a path that is a symlink, or whose nearest existing ancestor's real path is outside the deployable's shell folder, is E1585 and none of the set is written, the rule `keel docs --sync` applies to its writes (E1357); that `tools` reports before any work and stops the build; that the build writes `www/` itself. It does not check what the files hold or what the tools do: std.capacitor's and std.tauri's conformance does.

### Sorting today's text
k.shell, by sentence ("K" kernel k.shell, "C" std.capacitor, "T" std.tauri, "S" std.shells):

| today's sentence or bullet | goes to |
| --- | --- |
| Declaration: `shells: { capacitor?, tauri? }`; `id` reverse-DNS; `name`; version from `package.json` | K, unchanged |
| "Capacitor makes the Android and iOS apps, Tauri the Linux, macOS and Windows apps" | K, as "`capacitor` (Android, iOS) … `tauri` (desktop)" |
| "Each needs its package in `dependencies` (…; E1572, k.deploy)" | K, as "Each shell's package provides it and must be in `dependencies`" |
| "`shells` on another adapter, or an `id` that is not reverse-DNS, is E1573" | K, unchanged |
| Shell ctx: entry with `createCtx({ mode: 'shell', drivers })` | K, naming `<shell>Drivers({ origin })` |
| "The page loads from the shell's own origin (`capacitor://localhost`, `https://localhost`, `tauri://localhost`)" | K without the origins (each package's driver tests hold them: std.shells bullet 3) |
| driver contract bullets `net.fetch`, `storage`, `clock`… and "So `modules/` run unchanged" | K, word for word |
| (new) `shellMount`'s duty | K |
| Files: `capacitor.config.json` keys | C |
| Files: `tauri/` file list, `tauri.conf.json` keys, `Cargo.toml` crates, `build.rs`, `src/*.rs`, `capabilities/default.json` | T |
| "Derived … read-only (E1005, fix: the regenerated file)" | K (Files) |
| `Cargo.lock` committed, not generated; `icons/icon.png` the app's, else Keel's mark | T; K keeps the rule "another file there is the app's" |
| Build 1 `KEEL_ORIGIN` E1574 | K, word for word (step 2) |
| Build 2 toolchain: JDK 21, Android SDK, Xcode 26, Rust 1.95, WebKitGTK 4.1 | C, T (Tools); K keeps "each its own E1575, before any work" |
| Build 3 "The shell entry and web build into `dist/<name>/<shell>/www/` (the Vite plugin, given `KEEL_SHELL`), beside the shell files" | K (step 4) |
| Build 3 "for Capacitor the app's `package.json`", meta policy, Android cleartext config | C |
| Build 3 "for Tauri, the http permission for `KEEL_ORIGIN`" | T |
| Build 4 `cap sync`, scheme, Gradle, `xcodebuild`; `tauri build --debug --no-bundle`; `--release` unsigned | C, T |
| "A failing tool ends the build with its error lines, at most 12" | K (step 5) |
| `--platform` E1052 rules | K, generalized to the target's `platforms` |
| trailer example; "Signing and store upload are not Keel's" | K; C and T |
| CI: "a job per shell on its deployable's paths … each uploading its artifact"; iOS manual | K (frame, `manual`); C, T (runners, packages, JDK, Xcode) |
| Rules E1573, E1574, E1575 | K, word for word |
| Conformance 1 (`deploy/web/tauri/` written, E1005, removed) | T, word for word; K gets the same with a stub |
| Conformance 2 (`tauri.conf.json`) | T, word for word |
| Conformance 3 (E1573) | K, word for word |
| Conformance 4 (E1574) | K, word for word |
| Conformance 5 (no `cargo`, E1575, Rust 1.95) | T, word for word; K gets the stub form |
| Conformance 6 (`www` entry `mode: 'shell'`) | K, word for word |
| Conformance 7 (Android cleartext) | C, word for word |

Neighbours, where they speak of shells:

| section: sentence or bullet | goes to |
| --- | --- |
| k.return intro, Mount requests, `KEEL_ORIGIN` host, OAuth, Sign-out, The app's part, Testing | k.return, unchanged |
| k.return External browser "Custom Tabs on Android, an in-app Safari view on iOS, the default browser on desktop" | C, T; k.return keeps "the one the shell package opens … shares no cookie" |
| k.return "Each shell registers its `id` as a URI scheme" | k.return, adding "in its files (std.capacitor, std.tauri)" |
| k.return "Capacitor reports its launch when `getLaunchUrl` settles, Tauri when `getCurrent` does" | C, T; k.return keeps "once its platform has read the launch links" |
| k.return "On Capacitor the launch URL can be delivered again after a webview reload" | C; k.return keeps "a launch link delivered again is read as any other" |
| k.return Limits: native cookie store, cold start, desktop schemes from an installed bundle | C, T Limits; k.return keeps the link-started sentence |
| k.return Conformance 4 (std-capacitor's and std-tauri's `net` on `redirect: 'manual'`) | S, word for word |
| k.return Conformance 5 (the shell files register `id`) | split: C "an Android intent filter, iOS `CFBundleURLTypes`", T "Tauri's deep-link schemes" |
| k.return Conformance 1, 2, 3, 6, 7 | k.return, unchanged |
| k.links "closes the in-app Safari view" | k.links "closes the external browser"; C says iOS closes, Android has none |
| k.links all else; k.opening; k.mount `links` | unchanged: no vendor fact |
| k.deploy "shell jobs: k.shell", "Shell files: k.shell", E1572 | unchanged |
| k.cli E1053 | adds "or shell target" |

### Where code, tests and CI live afterwards
Packages and exports:
- `@keel/cli`: gains `shellTarget` and the `Shell*` types on its main entry. `@keel/cli/shell` keeps `shellPlan` (generic: steps 1 to 3), `shellBuild` (steps 4 and 5), `hostShell`, `toolError`, `toolCommand`. `toolchain`, `versionOf`, `androidNetworkSecurity`, `metaPolicy`, `defaultIcon` and the Capacitor and Tauri arms of `stepsOf` move: Capacitor's to `@keel/std-capacitor/tools`, Tauri's to `@keel/std-tauri/tools`. `ShellPlan.target` becomes `'capacitor' | 'tauri'` plus the loaded `ShellTarget`. `shellPolicy` (`src/internal/shellPolicy.ts`) is kept in `@keel/cli` and reaches each target as `ShellApp.policy`: it is the `client` document's content security policy (k.security), `cspPolicy({ peers: [] })` of `@keel/server/csp` as the project resolves it, a kernel fact the same for every shell, so no shell package depends on `@keel/server` or derives the policy itself.
- `@keel/scaffold`: `deployFiles` and `ciWorkflow` take the registered targets as input and stay pure; `capacitorConfig` moves to std-capacitor; `cargoToml`, `tauriConf`, `tauriBuildRs`, `tauriMainRs`, `tauriLibRs`, `tauriCapability`, `tauriHttpCapability` and `crateName` move to std-tauri. The exports `tauriHttpCapability` and `crateName` leave `@keel/scaffold`; `shellDeployables` stays.
- `@keel/std-capacitor`: gains `./tools`; the `keel-capacitor-scheme` bin and `schemeBin.ts` go (the build calls `returnScheme` directly). `.` and `./shellMount` unchanged.
- `@keel/std-tauri`: gains `./tools`. `.` and `./shellMount` unchanged.
- `@keel/router`: a shell build's router reads only the mount its entry passes to `shellMount`; `identityMounts` (`@keel/router/internal`) stays process-wide for `renderRoute(id, { shell: true })` alone, whose options name no mount.
- `@keel/compiler` (`entryCode` `SHELLS`), `@keel/check` (`topologyNeeds`), `@keel/server` (`TopologySchema`), the `Topology` type: unchanged.
- The shell packages' `./tools` gain `@keel/cli` as a dependency, which k.module Std config allows for `./tools*` (S0009 exempts it).

Tests:
- Conformance: per the Conformance diff below.
- Unit tests: `cli/test/androidNetworkSecurity.test.ts` to `std-capacitor/test/`; `cli/test/shellBuild.test.ts` and `shellPlan.test.ts` split: the generic halves stay against a stub target, the vendor halves move to each package; `cli/test/shellTarget.property.test.ts`, `toolError.test.ts`, `buildTrailer.test.ts` stay; `cli/test/packageBin.test.ts` loses its `keel-capacitor-scheme` case; `scaffold/test/shellFiles.test.ts` moves, split by vendor; `compiler/test/shellEntry.test.ts` stays; `std-capacitor/test/returnScheme.test.ts` stays.
- Smokes and CI: `tooling/smoke/shell.mjs`, `shell-launch.mjs`, `shell-drive.mjs`, `shellReplay.mjs` stay in `tooling/smoke/`. The repo's jobs `shell-tauri`, `shell-android`, `shell-tauri-macos` and `shell-ios` (`tooling/ci.source.json`, `.github/workflows/ci.yml`) stay as they are; their path gate covers the packages golden-1 builds from, std-capacitor and std-tauri among them, so a change to either package's tools runs them. Mutation (`tooling/mutate-nightly.source.json`) gains the moved files under the std packages' Stryker configs. `apps/golden-1/deploy/web/tauri/*` stay byte-identical, which `keel check` (E1005) holds in golden-1.

## Alternatives
- Leave k.shell whole and freeze it: each vendor release becomes a kernel semantics change, or the kernel lies about versions.
- An open shell set (`shells: Record<string, { id, name }>`, any package declaring a target in its `package.json`): a typo is no type error (principle 4, 9), E1572 has no fix to offer, and no third shell is asked for. Kept for later (Q1).
- The package writes its files and CI jobs itself: the kernel then cannot hold them to E1005 or put them on the deployable's paths, and two writers touch `deploy/` and `ci.yml`.
- Move E1575 to a std code (E2xxx): the kernel would print a code it does not own, and every existing E1575 reader changes for nothing.
- One std section `std.shell-builds` for both vendors: Capacitor and Tauri release on their own schedules; one section per vendor changes one at a time, and each fits under its budget.

## Spec diff
- k.shell rewritten (5,997 of 6,000 characters): Declaration, Shell ctx (driver contract word for word, plus `shellMount`), Shell target, Files, Build 1 to 5, CI frame, Rules (E1585 added), Conformance (3 bullets kept, 5 new over a stub package).
- New std.capacitor (3,663 characters) and std.tauri (3,745), status `proposed`.
- std.shells: one sentence pointing to them; k.return bullet 4 appended word for word (3,751).
- k.return: External browser, Return links and Limits drop vendor facts; bullets 4 and 5 leave (4,884).
- k.links: "closes the in-app Safari view" becomes "closes the external browser" (5,995).
- k.cli: E1053 adds "or shell target" (5,980).
- `spec/00-map.md` row k.shell one-word column `target`; `spec/std/README.md` two rows; `docs/GLOSSARY.md` adds **shell target**; `tooling/docs-owners.json` assigns the two sections.

## Conformance diff
By the `conformance-writer`, under `rfc:0161`.

Move word for word (the file moves; only its `// Spec:` section id and its helper import paths change; assertions unchanged):
- `packages/scaffold/conformance/shell-files.test.ts` to `packages/std-tauri/conformance/shell-files.test.ts`, `k.shell` to `std.tauri`.
- `packages/scaffold/conformance/tauri-conf.test.ts` to `packages/std-tauri/conformance/tauri-conf.test.ts`, `k.shell` to `std.tauri`.
- `packages/cli/conformance/build-target-e1575.test.ts` to `packages/std-tauri/conformance/build-target-e1575.test.ts`, `k.shell` to `std.tauri` (the Rules header stays `k.shell`).
- `packages/cli/conformance/android-cleartext.test.ts` to `packages/std-capacitor/conformance/android-cleartext.test.ts`, `k.shell` to `std.capacitor`.
- `packages/std-capacitor/conformance/manual-redirect.test.ts` and `packages/std-tauri/conformance/manual-redirect.test.ts` stay where they are; `k.return` to `std.shells`.
Each moved file needs the fixture helper it imports (`keel-cli.ts`, `compat-support.ts`, `unified-diff.ts`) beside it: a copy in each std package's `conformance/`, with `@keel/cli` and `@keel/scaffold` as dev dependencies.

Change:
- `packages/cli/conformance/return-scheme-android.test.ts` to `packages/std-capacitor/conformance/return-scheme.test.ts`; header quotes std.capacitor "The Capacitor shell files register `id` as a scheme: an Android intent filter, iOS `CFBundleURLTypes`."
- `packages/scaffold/conformance/return-scheme.test.ts` to `packages/std-tauri/conformance/return-scheme.test.ts`; header quotes std.tauri "The Tauri shell files register `id` as a scheme: Tauri's deep-link schemes."
- `packages/cli/conformance/build-target-tools.test.ts` splits: its "at most 12" case becomes the k.shell stub bullet below; its `KEEL_SHELL`/`www` case stays in cli against the stub; its icon, `package.json` and http-permission cases move to std-capacitor and std-tauri under the new std bullets.

Stay unchanged: `packages/check/conformance/E1573.test.ts`, `packages/cli/conformance/build-target-e1574.test.ts`, `packages/compiler/conformance/shell-entry.test.ts`, `packages/check/conformance/E1572.test.ts`, every `std-*/conformance` file citing std.shells, every `testing/conformance/return-*` and links file.

New, k.shell (in `packages/cli/conformance/`, over a fixture whose `node_modules/@keel/std-tauri` is a stub package with a `./tools` entry):
- `keel build` writes `deploy/web/tauri/a.json`; a changed byte is E1005 whose fix restores it; removing `tauri` removes it; a file `files` does not give stays.
- With `tools` giving two entries, the build prints two E1575, each naming its `tool` and `need`, exits 1, writes nothing under `dist/web/tauri/` and calls no `build`.
- With `platforms: ['x']`, `--platform y` and no `--platform` are each one E1052; a stub registering nothing, or a path `../a.json`, is one E1585.
- A `build` whose `error` has an `error:` line then 20 more prints 12 from it and exits 1; one returning an `artifact` prints it in the trailer.
- A `ShellJob` `{ job: 'tauri', manual: true }` is a `web-tauri` job running `keel build --target tauri` on `workflow_dispatch` only.
- (k.cli) a second `shellTarget('tauri', t)` throws E1053.
- (Files) with `deploy/web/tauri/` a symlink to a folder outside the project, or `deploy/web/tauri/a.json` a symlink, `keel check` reports one E1585 and `keel build` writes nothing under `deploy/web/tauri/` or the link's target.

New, std.capacitor and std.tauri: the bullets of those sections not listed above as moved (each section's last three or four).

## Migration
For an app: none. `topology.ts`, `package.json` (E1572 already requires the shell packages) and every generated file stay byte for byte; `keel build --target` takes the same flags and prints the same trailer. A project that imported `tauriHttpCapability` or `crateName` from `@keel/scaffold` imports them from `@keel/std-tauri/tools`. A script that ran `keel-capacitor-scheme` runs `keel build --target capacitor`. The build lane updates the READMEs of `@keel/cli`, `@keel/scaffold`, `@keel/std-capacitor`, `@keel/std-tauri`, the `keel-deploy` skill and the `docs/ARCHITECTURE.md` shells sentence to name `./tools`.

## What it costs
- Tokens: k.shell 1,498 tokens (5,991 characters), std.capacitor 916, std.tauri 937, std.shells 938, k.return 1,221, k.links 1,499, k.cli 1,495; the map 1,206 of 1,250 (one word changed).
- Size: `@keel/cli` gains a registry of a few lines (25.75kb budget); `@keel/cli/shell` (4.5kb) and `@keel/scaffold` (18.75kb) shrink. The std packages' `./tools` entries are CLI-time and unbudgeted, as every std `./tools` is.
- Codes: E1585 new (free; `pnpm spec --for E1585` finds nothing).

## Build order
1. This commit: RFC, ADR, spec text. 2. `conformance-writer`: the moves, the changes and the new bullets above. 3. Build: `shellTarget` and the generic `shellPlan` and `shellBuild`; move the vendor code into the two `./tools` entries; `deployFiles` and `ciWorkflow` over targets; `keel check` loads the targets; drop the bin; docs. 4. k.shell to `implemented`, then `conformance-covered`, which removes the freeze blocker.

## For the operator
- Q1: open the shell set to third-party packages (D49's "the stdlib holds no power a library lacks")? Recommendation: not for 1.0. The closed set keeps typos type errors and E1572's fix; opening it later is additive (a `keel.shell` field in a package's `package.json`), and `mountRequests` would first have to leave `@keel/router/internal`.
- Q2: std.capacitor's iOS job stays `manual`, as today. Recommendation: keep it so until a macOS runner is free for every push (the repo's own `shell-ios` already runs on public pushes).
