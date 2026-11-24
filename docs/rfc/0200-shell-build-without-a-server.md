# RFC 0200: k.shell: a shell build of an app with no server reads no `KEEL_ORIGIN`

Status: implemented (ADR-0222), accepted by the orchestrator on 2026-11-23, for the operator to confirm. Amends k.shell (Shell ctx, new **Without a server**, Shell target, Build, CI, Rules, Conformance), std.shells, std.tauri and std.capacitor. Under D103. From examples finding 19.

## Decisions
- D1: an app has a server when its topology has a `node` deployable. Nothing else counts: `identity.ts` without one is already E1589, a `static` deployable answers no request at run time, and a `keel-peer` origin exists only for a `node` deployable.
- D2: a shell build of an app with no server reads no `KEEL_ORIGIN` and has no `origin`. The entry, the drivers, `shellMount`, the target's `build` and the native allow lists carry none.
- D3: with no `origin`, a request on the page's own origin is refused like one to an unlisted origin. The shell's `net` sends only to the declared `origins.connect` origins.
- D4: `KEEL_ORIGIN` set and not empty in an app with no server is E1574, a second message under the same code. An app with a `node` deployable and no valid `KEEL_ORIGIN` stays E1574 as it is.
- D5: an empty `KEEL_ORIGIN` is the same as an unset one, in both cases.
- D6: the generated CI job of a shell sets `KEEL_ORIGIN` from `vars` only when the topology has a `node` deployable.

## Problem
`keel build --target tauri` in `examples/native-tauri`, and `--target capacitor --platform ios` in `examples/native-capacitor`, stop with:
```
E1574 KEEL_ORIGIN must be an https: origin (http: on localhost only)
  see: keel docs k.shell
```
Each example is one `client` deployable with a shell and no other deployable. Nothing in it calls a server: the examples smoke serves the web build and records no `/__keel/*` request. Both build with `KEEL_ORIGIN=http://localhost:4182`, an origin nothing answers, and their READMEs say to set it. `examples/links-in` is the same shape, and its smoke step sets `KEEL_ORIGIN=https://app.example` for the shell's web build.

What `KEEL_ORIGIN` does in a shell build today:
- **The check.** `shellPlan` (`packages/cli/src/shell/shellPlan.ts`) runs `shellOrigin(env.KEEL_ORIGIN)` after the target and platform checks and before the tools; undefined is E1574. The topology is never asked. k.shell Build 2 states the requirement with no condition.
- **The entry.** The Vite plugin's `shellOf` (`packages/compiler/src/vite.ts`) reads `KEEL_ORIGIN ?? ""`, and `entryCode` writes `__keelDrivers({ origin: new URL("<origin>"), connect })` and `__keelMount(ctx, { id, origin: new URL("<origin>") })`. With an empty origin the entry would throw at `new URL("")`.
- **The drivers.** `tauriNet` and `capacitorNet` map a request on the page's origin (`tauri://localhost`, `capacitor://localhost`, a relative URL) to `origin` with its path and search (`mapUrl`), and `allows` passes `origin` and the `connect` list. That mapping is why the origin exists: a browser client served by its `node` deployable calls it as `'self'`, and the shell's page has no such origin.
- **`shellMount`.** It hands `origin` to `mountRequests`, which reads a redirect naming it in full as one to its path and opens root-relative URLs on it in the external browser. Both only matter for an identity mount, which needs a `node` deployable (E1589).
- **The native allow lists.** std.tauri writes `capabilities/http.json` allowing `<origin>/*` and each `connect` origin; std.capacitor writes `plugins.KeelHttp.allow` as `origin` then `connect`, and an Android debug build with an `http:` origin gets a cleartext network security config for its host.
- **CI.** The generated shell job sets `KEEL_ORIGIN: ${{ vars.KEEL_ORIGIN }}`. When the repository has no such variable, that is an empty string, which is E1574 today.

So in an app with no server, `KEEL_ORIGIN` names an origin that receives the page-origin requests, the Keel headers (k.services sends `x-keel: 1` to a Keel origin, RFC 0197) and the caller cookie, and that the native allow lists open. No deployable of the app answers there. Under D103 an app that has not opted in to a server carries no config for one; this one is told to invent it.

## Proposal
### When a shell build needs no `KEEL_ORIGIN`
When the topology has no `node` deployable. The build reads the topology it already loads for the shell's apps. The rule is per project, not per shelled `client`: a `client` with no `servedBy` in a project with a `node` deployable may still call it through `service({ contract })` or a `keel-peer` origin, and the project's origin is the one place a shell learns where that is.

| Topology | `KEEL_ORIGIN` | Result |
| --- | --- | --- |
| has a `node` deployable | `https:`, or `http:`/`https:` on `localhost` | the build's `origin` is its origin, as today |
| has a `node` deployable | unset, empty, or anything else | E1574 `KEEL_ORIGIN must be an https: origin (http: on localhost only)` |
| no `node` deployable | unset or empty | the build has no `origin` |
| no `node` deployable | set and not empty, valid or not | E1574 `KEEL_ORIGIN is set and topology.ts has no node deployable to answer it` |

Both lines are under 90 characters and name the key, never the value. Both print with `see: keel docs k.shell`, at step 2, before any tool runs and before anything is written under `dist/<name>/<shell>/`, as E1574 does now.

### What the shell then contains
With no `origin`:
- The `www` entry: `__keelDrivers({ connect: [...] })` and `__keelMount(ctx, { id: "..." })`. No origin literal is written.
- `connect` is the deployable's declared `origins.connect`, as `shellConnect` computes it; `peerOrigins` gives nothing, since `KEEL_PEER_<NAME>` names a `node` deployable.
- `ShellBuild.origin` is absent, and the `env` the target's tools run with holds no `KEEL_ORIGIN`.
- Tauri: `capabilities/http.json` allows `<o>/*` for each `connect` origin; with none, the build writes no `capabilities/http.json` and removes one an earlier build left in `dir`, so the http plugin's `fetch` command is denied.
- Capacitor: `plugins.KeelHttp.allow` is the `connect` list, `[]` when empty (KeelHttp rejects every URL then); no Android network security config, and one an earlier build wrote is removed.

### What it refuses
- A request on the page's own origin (`fetch('/api/x')`, `tauri://localhost/x`, `capacitor://localhost/x`, Tauri's `http://tauri.localhost` on Windows) rejects with a `TypeError` naming no URL, and no native request is made: k.services reports `api.network`. There is no Keel origin, so no request carries `x-keel` or a caller cookie anywhere.
- Every other origin not in `connect`, and every redirect hop to one, as k.shell Origins says now.

The bundled pages, scripts and assets still load: the webview serves them from `www/`, not through `net`.

### Links in
Unchanged. `shellMount` listens for return links and delivers page links, as in any shell without `identity.ts`; there is no mount, so no link opens the external browser. `examples/links-in` builds and takes page links with no environment.

### What stays an error
- A shell of an app with a `node` deployable and no `KEEL_ORIGIN`, or an empty or invalid one: E1574, the message unchanged.
- A half-configured app. `identity.ts` with no `node` deployable is E1589 in `keel check`, which `keel build` runs first, so a shell build never meets an identity mount without an origin. `KEEL_ORIGIN` set in an app with no server is the build-time half: the person expects a server the topology does not have. A third-party API the shell calls is declared under `origins.connect` and called through `service({ base })`, which sends it no Keel header.

`keel explain E1574`:
```
E1574 a shell build's KEEL_ORIGIN: unset or invalid with a node deployable, set without one
The shell sends page-origin requests to KEEL_ORIGIN, the origin of the app's node deployable.
KEEL_ORIGIN=https://app.example keel build --target tauri; with no node deployable, unset it
```

### The code a build changes
`ShellBuild` and the drivers' options gain an optional `origin`; the shapes below type-check under the repository's `exactOptionalPropertyTypes`.
```ts
// @keel/cli, types/ShellBuild.ts
export type ShellBuild = ShellApp & {
  readonly root: string;
  readonly dir: string;
  readonly origin?: string;
  readonly connect: readonly string[];
  readonly platform: string | undefined;
  readonly release: boolean;
  readonly env: Readonly<Record<string, string | undefined>>;
};

// @keel/std-tauri, tauriDrivers.ts (capacitorDrivers the same)
export function tauriDrivers(opts: { readonly origin?: URL; readonly connect?: readonly string[] }): {
  readonly storage: KeyValueStorage;
  readonly net: Net;
} {
  return { storage: storeStorage(), net: tauriNet(opts.origin, opts.connect) };
}

// the generated www entry of examples/native-tauri under this proposal
const ctx = createCtx({ mode: "shell", drivers: __keelDrivers({ connect: [] }) });
__keelMount(ctx, { id: "dev.keel.nativetauri" });
```
`mapUrl(url, origin, page)` with `origin` undefined returns `undefined` for a URL on the page's origin, and the driver refuses it before any native call; `allows` with no `origin` checks `connect` alone.

### How a test proves an app with no server carries no origin config
k.shell#14 to #16 below build the stub project with `web` alone and no `KEEL_ORIGIN`, then read what the build hands on: the `www` entry text (no `origin` in the drivers call or the `shellMount` call), the `ShellBuild` the stub's `build` receives (no `origin` key, no `KEEL_ORIGIN` in `env`), and `connect` (`[]`, even with a `KEEL_PEER_API` in the environment). std.tauri and std.capacitor clauses read the native allow lists the real targets write after a build that had an origin, so a stale grant left by the earlier build fails them. std.shells#13 drives the drivers with no `origin` and asserts that a page-origin request makes no native call. The examples smoke keeps its check that the web build makes no `/__keel/*` request, and its `links-in` step builds the shell's web build with no `KEEL_ORIGIN`.

### The examples, replayed
In `examples/native-tauri`, with no environment: `keel build --target tauri` passes step 2, the entry holds `__keelDrivers({ connect: [] })`, the build writes no `capabilities/http.json`, and `tauri build` runs. In `examples/native-capacitor`, `keel build --target capacitor --platform ios` passes step 2 and `capacitor.config.json` holds `plugins.KeelHttp.allow: []`. The READMEs drop `KEEL_ORIGIN=http://localhost:4182`.

## Alternatives
- **Ignore `KEEL_ORIGIN` when there is no `node` deployable.** Simplest for CI that sets it everywhere. Rejected: a value the build reads and then drops is action at a distance (P2), and the person who set it believes the shell talks to a server. D103 asks for a half-opted-in app to be an error.
- **Decide per shelled `client`: no `servedBy`, no peer, no contract service.** Rejected for now: a `client` can reach a `node` deployable by a `keel-peer` origin or a `service({ contract })` the checker reads across modules, and getting that wrong drops the origin from an app that needs it. Per project is exact and cheap; the per-client rule can come with a need.
- **A topology flag (`shells: { tauri: { id, name, origin: false } }`).** Rejected: a second way to say what the topology already says (P1), and a flag someone can set on an app that has a server.
- **Default the origin to `http://localhost`.** Rejected: a config value nobody chose, opened in the native allow lists of a release build.
- **A new code for the second E1574 case.** Not proposed: both cases are the one rule "the shell's origin matches the topology", and `keel explain E1574` covers both. A new code is cheap if the operator prefers one.
- **Serve page-origin requests from the bundled `www/` files through `net`.** Not proposed: a browser client on a static host reads its own files as `'self'`, but no Keel feature asks `net` for a bundled file, and the refusal keeps `net` to the declared list. Open below.

## Spec diff
Applied in this commit. k.shell, std.shells, std.tauri and std.capacitor stay `implemented` until the clauses below are covered. The map is unchanged and no glossary term is added.
- k.shell: Shell ctx (`origin?` in the drivers and `shellMount`; a page-origin request with no `origin` refused), new **Without a server**, `ShellBuild.origin` absent with none, Build 2 (the table above as text, both messages), CI (`KEEL_ORIGIN` only with a `node` deployable), Rules (E1574), Conformance (a preface for cases that set `KEEL_ORIGIN`, the E1574 clause rewritten, four clauses added).
- std.shells: `origin` optional; `net.fetch` refuses a page-origin request with none; one clause.
- std.tauri: Build, no `origin`; a conformance preface; one clause.
- std.capacitor: Build, `allow` with no `origin` and the network security config; a conformance preface; one clause.

## Conformance diff
By the `conformance-writer`, from the spec text:
1. **k.shell#2, E1574 with a server** (`packages/cli/conformance`). With `api` (`node`) beside `web`, `KEEL_ORIGIN` unset and empty each print one E1574 naming the key and build nothing; `http://localhost:8080` proceeds.
2. **k.shell#14, no origin** (`packages/cli/conformance`). With `web` alone, `KEEL_ORIGIN` unset and empty each print no E1574 and proceed; `build` gets no `origin` and an `env` without `KEEL_ORIGIN`; the `www` entry's drivers call is `{ connect: [] }` and its `shellMount` call `{ id }`; with `KEEL_PEER_API=https://peer.example` too, the same.
3. **k.shell#15, E1574 without a server** (`packages/cli/conformance`). With `web` alone and `KEEL_ORIGIN=https://app.example`: one E1574 with the exact message, no part of the value, exit 1, nothing under `dist/web/tauri/`, no `build` call.
4. **k.shell#16, connect alone** (`packages/cli/conformance`). With `web` alone declaring `origins.connect` `https://api.example`: drivers call `{ connect: ["https://api.example"] }`, the same `connect` given to `build`.
5. **k.shell#17, CI** (`packages/cli/conformance`, beside `shell-target-ci.test.ts`). The `web-tauri` job has no `KEEL_ORIGIN` with `web` alone and `KEEL_ORIGIN: ${{ vars.KEEL_ORIGIN }}` with `api`.
6. **std.shells#13, no origin** (`packages/std-tauri/conformance` and `packages/std-capacitor/conformance`). Drivers with `{ connect: ['https://other.example'] }` and no `origin`: a relative and a page-origin URL reject with a `TypeError` holding no part of the URL and no native request; `https://other.example/x` keeps its URL; with `connect: []` every request rejects.
7. **std.tauri#9, no origin** (`packages/std-tauri/conformance`). After a build with `api` and an origin, a build of `web` alone with no `KEEL_ORIGIN` leaves no `capabilities/http.json`; with `origins.connect` `https://api.example`, one allowing exactly `https://api.example/*`.
8. **std.capacitor#10, no origin** (`packages/std-capacitor/conformance`). After a build with `api` and `http://localhost:8080`, an Android build of `web` alone with no `KEEL_ORIGIN` leaves `plugins.KeelHttp.allow` `[]` and no network security config; with `origins.connect` `https://api.example`, `["https://api.example"]`.

Existing cases the new text contradicts, for the `conformance-writer` to correct under `rfc:0200`. Each sets `KEEL_ORIGIN` on a topology of `web` alone, which is now E1574; each holds again with a `node` deployable `api` added to the fixture's topology, as the new prefaces say:
- `packages/cli/conformance/build-target-e1574.test.ts` (the fixture, line 29), `packages/cli/conformance/shell-stub.ts` (`topologySrc`, line 45, shared by the stub cases that set `KEEL_ORIGIN`), `packages/cli/conformance/shell-connect.test.ts` (line 19, for the cases without `KEEL_PEER_API`).
- `packages/compiler/conformance/shell-entry.test.ts` (line 40), `packages/compiler/conformance/shell-entry-mount.test.ts` (the no-identity fixture, line 41).
- `packages/std-tauri/conformance/build-tools.test.ts` (line 42), `shell-scope.test.ts` (line 35, the case without `identity`), `build-target-e1575.test.ts` (line 29).
- `packages/std-capacitor/conformance/build-tools.test.ts` (line 44), `android-cleartext.test.ts` (line 44), `return-scheme.test.ts` (line 42), `shell-plugins.test.ts` (line 50, the case without `identity`).
- `packages/testing/conformance/return-chains.test.ts` sets `KEEL_ORIGIN` without a `--target` build; the writer confirms it is untouched.

## Migration
None for an app with a `node` deployable. An app with no server that sets `KEEL_ORIGIN` for a shell build drops it.

## What it costs
- k.shell: 9,741 to 12,006 characters, 3,002 tokens of the 3,100 a section holds. The next addition to k.shell needs a new section. std.shells 1,444, std.tauri 1,432, std.capacitor 1,504 tokens. The map is unchanged.
- `@keel/cli`, `@keel/compiler`, `@keel/std-tauri`, `@keel/std-capacitor`: a branch each; no new dependency. The drivers keep the page-origin mapping code in every shell, used or not; the bytes are the driver's, not the app's config.
- `keel explain E1574`: the entry rewritten, within the 300-token budget.

## Build plan
1. This commit: RFC, ADR, spec text. 2. `conformance-writer`: the eight clauses and the corrections above. 3. Build:
- `packages/cli/src/shell/shellPlan.ts` (step 2 by `hasNode(loaded.topology)`, both E1574 messages, empty as unset), `shell/shellOrigin.ts`, `shell/shellBuild.ts` (`KEEL_ORIGIN` left out of `env` with no origin), `types/ShellPlan.ts` and `types/ShellBuild.ts` (`origin?`).
- `packages/compiler/src/vite.ts` (`shellOf`: origin optional, empty as none), `src/internal/entryCode.ts` (no `origin` in the drivers or mount call), `src/hosting/shellConnect.ts` (`origin` optional).
- `packages/std-tauri/src/tauriDrivers.ts`, `src/shellMount.ts`, `src/internal/tauriNet.ts`, `mapUrl.ts`, `allows.ts`; `src/tools/tauriBuild.ts` and `tauriHttpCapability.ts` (no file with nothing to allow, a stale one removed).
- `packages/std-capacitor/src/capacitorDrivers.ts`, `src/shellMount.ts`, `src/internal/capacitorNet.ts`, `mapUrl.ts`, `allows.ts`; `src/tools/capacitorBuild.ts`, `allowConfig.ts`, `androidNetworkSecurity.ts` (origin optional).
- `packages/scaffold/src/templates/ciWorkflow.ts` (`shellJob` sets `KEEL_ORIGIN` only with a `node` deployable).
- `packages/check/src/internal/EXPLANATIONS.ts`: E1574 as above.
- `tooling/smoke/examples.mjs`: the `links-in` step builds the shell's web build with no `KEEL_ORIGIN`.
- Docs: `examples/native-tauri/README.md`, `examples/native-capacitor/README.md`, `examples/links-in/README.md` (no `KEEL_ORIGIN`), the keel-deploy skill's Shells paragraph, the std-tauri, std-capacitor and cli READMEs where they name `KEEL_ORIGIN`, a changeset, `tasks/p1/examples-findings.md` (19), `tasks/BACKLOG.md`.
- Verify: the two examples build with `env -u KEEL_ORIGIN` on this machine (Tauri; Capacitor iOS where Xcode is present), and Tauri accepts a build with no `capabilities/http.json`.

## For the operator
1. **`KEEL_ORIGIN` set in an app with no server is E1574, not ignored.** It makes the conformance writer add an `api` deployable to about a dozen existing fixtures. Recommended: yes; D103 makes a half-opted-in app an error, and a dropped value is invisible.
2. **The rule is per project (any `node` deployable), not per shelled `client`.** A `client` with no link to the project's `node` deployable still needs an origin. Recommended: keep; it is exact, and a per-client rule needs the checker to prove no path to the server.
3. **One code, two messages for E1574.** Recommended: keep; one rule, and `keel explain E1574` says both.
4. **A page-origin request with no origin is refused, not served from `www/`.** Recommended: refuse; nothing in Keel asks for it, and serving it widens `net` beyond the declared list.
