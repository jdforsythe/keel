# RFC 0198: k.shell: a shell's net sends to declared origins only, and a shell names the plugins an app must list

Status: implemented (ADR-0220). Amends k.shell, std.shells, std.capacitor, std.tauri. Under D103, D104, D106 and D108.

## Decisions
- D1: one rule for a shell's `net`: it sends to `KEEL_ORIGIN`, the build's `keel-peer` origins and the deployable's declared `origins.connect` origins, the list a browser's `connect-src` holds for the same `client`. Nothing else is sent.
- D2: a refusal is a `TypeError` from `net.fetch`, so app code sees `api.network`, as it does when a browser's policy blocks a call.
- D3: the native client follows no redirect. The driver follows, and holds every hop to D1.
- D4: the same list is enforced outside the page: Tauri's http scope with `scopeRedirects`, and `KeelHttp`'s `allow` configuration on Capacitor.
- D5: a shell target names the native plugins an app must list (`plugins`). A missing one is E1572, with the fix. No new code.
- D6: a plugin is asked for only by the feature that uses it. `@capacitor/browser` is asked for only with `identity.ts`.
- D7: launch and return links belong to every shell, so Tauri's deep-link crates are in every Tauri shell and `@capacitor/app` in every Capacitor shell.

## Problem
**The two shells disagree on where a request may go.** k.shell says of `net.fetch`: "another origin's request goes as given".
- Capacitor: `capacitorNet` hands any URL to the native plugin `KeelHttp` (`packages/std-capacitor/src/internal/capacitorNet.ts`), which has no list of origins. Android follows redirects itself unless the request is `manual` (`setInstanceFollowRedirects`), and so does iOS.
- Tauri: `tauriHttpCapability` allows `KEEL_ORIGIN/*` only, so the same call rejects.
- A browser: `connect-src` holds `'self'`, the `keel-peer` origins and the declared `origins.connect` origins (k.security, k.origins).

So a `base` service to a declared third party works in a browser and on Capacitor and fails on Tauri, and an undeclared one is blocked in a browser and on Tauri and sent on Capacitor. The native client is outside the content security policy, so on Capacitor the policy contains nothing.

**Tauri follows a redirect out of its scope.** Read in `tauri-plugin-http` 2.9.0 (`~/.cargo/registry/src/index.crates.io-*/tauri-plugin-http-2.9.0/`), the version `Cargo.toml` pins:
- `src/commands.rs:190-211`, `redirect_policy`: with no scope given it returns `Policy::limited(max_redirections)`, which checks nothing; with a scope, each hop is `scope.is_allowed(attempt.url())` or `Error::UrlNotAllowed`.
- `src/commands.rs:338`: `let scope = state.config.scope_redirects.then_some(scope);`
- `src/config.rs:7-25`: `scope_redirects` is `#[serde(default)]`, "Defaults to `false`", under `plugins.http.scopeRedirects`.
- `node_modules/.pnpm/@tauri-apps+plugin-http@2.9.0/.../dist-js/index.d.ts:56-63`: `maxRedirections`, "If set to 0, no redirects will be followed. When the `scopeRedirects` plugin configuration is enabled, every redirect must also be allowed by the configured scope".

The generated `tauri.conf.json` sets no `plugins.http`. So a server on `KEEL_ORIGIN` that answers 302 to any URL has that URL fetched and its response handed to the page.

**Nothing reports a missing native plugin.** `cap sync` reads plugins from the app's own `package.json` (`@capacitor/cli` 8.6.2, `dist/plugin.js:68-75`, `getDependencies`: `dependencies` and `devDependencies` of `config.app.package`), and skips one it cannot resolve. `@keel/std-capacitor` depends on `@capacitor/preferences`, `@capacitor/app` and `@capacitor/browser`, so their JavaScript is bundled, but their native halves are installed only when the app lists them. A call to a missing one rejects, and `shellMount` reads a rejected launch read as a failed read and swallows a rejected `Browser.open`. So:
- golden-1 lists `@capacitor/preferences` and not `@capacitor/app`: on a device no page link reaches it (k.links says one does).
- An app with `identity.ts` that lacks `@capacitor/browser` opens no sign-in page, with no error anywhere.

E1572 asks for `@keel/std-capacitor` only (`packages/check/src/internal/topologyNeeds.ts`, `NEEDS`).

**Tauri without `identity.ts` takes no link.** `cargoToml`, `tauriLibRs` and `tauriCapability` add the deep-link plugin only with `identity`, while `tauri.conf.json` always registers the scheme and `shellMount` always calls `getCurrent`. k.shell and k.links say page links are delivered with no identity source.

## Proposal
### One rule for `net`
`<shell>Drivers({ origin, connect })`. `connect` is, in order and once each, the `keel-peer` origins of the web build and the declared `origins.connect` origins, `origin` left out. A request to the page's origin goes to `origin`, as now. A request to `origin` or a `connect` origin goes as given. Any other `http:` or `https:` origin, and any other scheme, is refused: `net.fetch` rejects with a `TypeError` that names no URL and makes no native call.

What app code sees does not change shape: `ctx.net.fetch` in app code is E1651, so the call is a service, and a rejected `fetch` is `api.network` (k.services).

```ts
// topology.ts
export default topology({
  web: {
    modules: ["releases"],
    adapter: "client",
    servedBy: "api",
    origins: { connect: { "https://api.github.com": "release notes" } },
    shells: { tauri: { id: "dev.keel.releases", name: "Releases" } },
  },
  api: { modules: ["api"], adapter: "node" },
});

// modules/releases/githubApi.ts
export const githubApi = service({ base: "https://api.github.com", schema: GitHubApi });

// modules/releases/ReleasesPage.tsx: the same call in a browser, on Tauri and on Capacitor
const list = resource(() => githubApi.releases({ params: { owner: "nodejs", repo: "node" } }, ctx));
```
With the `connect` line removed, the literal `base` is E1571 at check, and at run time `list` is the `error` state with `api.network` in all three.

The generated entry of that build:
```ts
const ctx = createCtx({
  mode: "shell",
  drivers: __keelDrivers({ origin: new URL("https://releases.example"), connect: ["https://api.github.com"] }),
});
```

### Redirects
The driver sends every native request unfollowed (`maxRedirections: 0` on Tauri; `KeelHttp` follows none) and does the following itself, so the rule is one piece of code per shell and a conformance suite can run it:
- `redirect: 'manual'`: a 3xx resolves as it came (unchanged; every k.services and mount request is `manual`).
- `'error'`: a 3xx rejects with a `TypeError`.
- `'follow'`: at most 20 hops, each held to the rule before it is sent. 303 (but for `HEAD`), and 301 or 302 after a `POST`, continue as a bodiless `GET` without `content-type`. A hop to another origin drops `authorization`. A hop outside the rule rejects with a `TypeError`; nothing is sent to it.

Cookies need no change: each native store already keeps a `set-cookie` from an unfollowed 3xx.

### The same list outside the page
The driver's check is the contract; it does not bind script the app did not ship, which can call the native plugin directly. So:
- Tauri: `capabilities/http.json` allows `<o>/*` for `origin` and each `connect` origin. `tauri.conf.json` sets `plugins.http.scopeRedirects: true`, so a direct call that follows is held to the scope at each hop.
- Capacitor: the build adds `plugins.KeelHttp.allow` (`origin`, then `connect`) to `dist/<name>/capacitor/capacitor.config.json`. `KeelHttp` reads it natively, rejects a URL whose origin is not listed (every URL when there is no list) and follows no redirect; its `redirect` request field goes.

`ShellBuild` gains `connect` for this.

### Plugins an app lists
```ts
type ShellTarget = {
  // ...
  plugins(app: ShellApp): readonly { plugin: string; version: string; need: string }[];
};
```
| Feature | Turned on by | Capacitor: the app lists | Tauri: generated, the app lists none |
| --- | --- | --- | --- |
| `storage` | the shell | `@capacitor/preferences` | `tauri-plugin-store` |
| `net` | the shell | none (`KeelHttp` is in `@keel/std-capacitor`, E1572 as now) | `tauri-plugin-http` |
| launch and return links (k.links) | the shell | `@capacitor/app` | `tauri-plugin-deep-link`, `tauri-plugin-single-instance` |
| the mount's external browser (k.return) | `identity.ts` | `@capacitor/browser` | `tauri-plugin-opener` |

`plugins` reads `app` alone. `app.identity` is false without `identity.ts`, so an app that has not opted in is given no browser entry and sees no diagnostic, request or config for it (D103). Each version is the one `@keel/std-capacitor` pins for itself: the JavaScript half in the bundle is that version, so the native half must be too.

The diagnostic is E1572, whose sentence already covers it ("a deployable's `storage` or `shells` needs a package the app's `dependencies` lack (fix adds it)"):
```
E1572 topology.ts:4:3 web: capacitor needs @capacitor/browser 8.0.5 in package.json dependencies (the external browser of identity.ts)
```
```diff
--- package.json
+++ package.json
@@
   "dependencies": {
+    "@capacitor/browser": "8.0.5",
     "@capacitor/core": "8.6.0",
```
A plugin listed at another version text is the same E1572, its fix setting the version. `keel check` reports it, and `keel build --target <shell>` before any work. `@keel/check`'s own `check()` loads no shell target and reports as it does now, so the existing E1572 cases hold.

### Proof: golden-1
- `net`: golden-1 declares no `origins`; `connect` is `[]`. Every request it makes (its `contract` services, std-live's and std-channels' streams, std-offline's outbox) is to the page's origin, so each goes to `KEEL_ORIGIN`. Nothing it sends is refused. Tauri's `http.json` is byte-equal to today's.
- Plugins, Capacitor: no `identity.ts`. `keel check` prints one E1572, `web: capacitor needs @capacitor/app 8.1.2 in package.json dependencies (launch and return links)`. Its fix is applied in the build commit. No browser entry.
- Plugins, Tauri: none asked. golden-1's `deploy/web/tauri/Cargo.toml`, `src/lib.rs` and `capabilities/default.json` gain the deep-link lines; `tauri.conf.json` gains `plugins.http`.

### Proof: `examples/shell-mount`
- `net`: a Tauri shell with `identity.ts`. The sign-in `Form` is a mount request to the page's origin, `manual`; its 303 is read by the router. No hop is followed, so D3 changes nothing here. The provider page opens through the opener, not `net`.
- Plugins: `plugins` is `[]`; `Cargo.toml` already holds all five crates. No E1572.
- Had it declared `capacitor`: three E1572 (`@capacitor/preferences`, `@capacitor/app`, `@capacitor/browser`), each with its fix; removing `identity.ts` and `identity.server.ts` leaves two.

## Alternatives
- **Capacitor's behaviour everywhere (any origin goes).** Rejected: the native client is outside the content security policy, so a shell would have no containment a browser has, and D104's "an app declares the third-party origins it calls" would hold in a browser only.
- **Tauri's behaviour everywhere (`KEEL_ORIGIN` only).** Rejected: a declared third party works in a browser; `modules/` must run unchanged in a shell.
- **Leave following to each native client and check hops natively.** Rejected: three native stacks, three behaviours, none reachable from a jsdom conformance suite; `scopeRedirects` alone would leave Capacitor to hand-written Java and Swift.
- **A distinct error for a refusal (`keel.origin`).** Rejected: a browser gives a `TypeError` for a blocked call; a second shape would make a shell differ from a browser. E1571 teaches the fix at check.
- **A new code for a missing plugin.** Rejected: E1572's sentence, place and fix are already this fault's; the E155x block has no free code before E1592.
- **`peerDependencies` on `@keel/std-capacitor`.** Rejected: a package manager installs a peer without writing it to the app's `package.json`, which is the only place `cap sync` reads.
- **The build writes a `package.json` that lists the plugins.** Rejected: under pnpm the plugin is not resolvable from the app's folder unless the app depends on it.
- **A caret range passes.** Rejected: the bundled JavaScript half is the pinned version; a newer native half is a pairing nobody tested.
- **The plugin table in `@keel/check`.** Rejected: the kernel would name Capacitor's packages and versions; std.capacitor follows Capacitor's releases.

## Spec diff
Applied in this commit; k.shell and std.shells are `implemented` until the clauses below are covered.
- k.shell: Declaration (plugins must be listed), Shell ctx (`connect`; the `net` bullet), new **Origins**, `ShellTarget.plugins`, `ShellBuild.connect`, new **Plugins**, Build step 3, four Conformance clauses.
- std.shells: `connect` on both drivers, the hop check, five Conformance clauses (one rewritten).
- std.capacitor: new **Plugins**, Build (`plugins.KeelHttp.allow`), Limits, three Conformance clauses.
- std.tauri: Files (`scopeRedirects`; deep-link crates always), new **Plugins**, Build (`http.json`), Limits, two Conformance clauses.
- `docs/GLOSSARY.md`: **shell target** lists plugins. No new term.
- k.deploy is unchanged: its E1572 sentence stands.

## Conformance diff
By the `conformance-writer`, under `rfc:0198`.

k.shell (`packages/cli/conformance`, stub target):
1. A stub `plugins` entry `@x/p` `1.2.3` `n`: absent, one E1572 at the deployable's key naming `@x/p 1.2.3` and `(n)`, fix adds it; at `^1.2.3`, one whose fix sets `1.2.3`; at `1.2.3`, none; two declaring deployables, one.
2. With that E1572, `keel build --target tauri` prints it, exits 1, writes nothing under `dist/web/tauri/`, calls no `build`.
3. An entry given only when `app.identity`: none without `identity.ts`, one with it.
4. The `www` entry's `connect`: `[]` with no `origins`; peer then declared origin; `KEEL_ORIGIN` left out; `build` is given the same list.

std.shells (`packages/std-capacitor/conformance`, `packages/std-tauri/conformance`, each driver):
1. Rewritten ("`https://other.example/x` keeps its URL"): kept with `connect` holding it; with `connect: []` a `TypeError` without the URL, no native request, `api.network`; `http:` against an `https:` entry and a longer host refused too.
2. Default `redirect`: 302 to `/b` follows in two unfollowed native requests; 302 to `https://evil.example/x` rejects with no request there; 302 to a `connect` origin drops `authorization`.
3. POST then 303: bodiless GET without `content-type`; 307: POST with the body; 21 requests then a `TypeError`; a 302 with no `location` resolves.
4. `redirect: 'error'`: a 302 rejects after one request.
5. `redirect: 'manual'`: unchanged.
New clauses are appended, so each existing clause keeps its number; std.shells clause 3 is the one rewritten.

std.capacitor (`packages/std-capacitor/conformance`):
1. The built `capacitor.config.json` holds `plugins.KeelHttp.allow`, `origin` then declared origins; the file under `deploy/` has no `plugins`.
2. `plugins`: preferences and app at the package's own pinned versions; browser too with `identity`.
3. `keel check`: none for a no-identity app listing both; one for the browser once `identity.ts` exists; one for a removed `@capacitor/app`.

std.tauri (`packages/std-tauri/conformance`):
1. `scopeRedirects` is `true`; deep-link and single-instance in `Cargo.toml`, `src/lib.rs` and the capability without `identity.ts`, the opener only with it.
2. `http.json` allows exactly `origin` and the declared origins; `plugins` is `[]`.

The existing android-cleartext case compares `capacitor.config.json` across builds "the origin aside"; `allow` holds only the origin there, so it stands. Report it if it does not.

## Migration
None is written (no release yet). The build commit applies golden-1's E1572 fix and regenerates each app's Tauri files.

## What it costs
- Spec: k.shell 1,610 to 2,436 tokens of 3,100; std.shells 1,311; std.capacitor 1,395; std.tauri 1,292. The map row is unchanged in length.
- Size: `@keel/std-capacitor` and `@keel/std-tauri` each gain the hop loop (about 0.4 kB each); `@keel/cli/shell` is at a 4.5 kB limit and gains the plugin pass: re-base if it overruns.
- A Tauri shell without identity gains two crates.

## Build order
1. This commit. 2. `conformance-writer`. 3. Build, by file:
- `packages/cli/src/types/ShellTarget.ts`, `ShellBuild.ts`; `packages/cli/src/internal/shellTargets.ts` and `checkCommand.ts` (the E1572 pass, with the diff helper of `packages/check/src/internal/topologyNeeds.ts` exported); `packages/cli/src/shell/shellPlan.ts`; `packages/check/src/internal/EXPLANATIONS.ts`.
- `packages/compiler/src/internal/entryCode.ts` and `vite.ts` (`connect`, from `peerOrigins` and the static `origins`).
- `packages/std-capacitor/src`: `capacitorDrivers.ts`, `internal/capacitorNet.ts`, `tools/capacitorTarget.ts`, `tools/capacitorBuild.ts`; `android/.../KeelHttpPlugin.java`, `ios/Sources/KeelHttpPlugin/KeelHttpPlugin.swift`.
- `packages/std-tauri/src`: `tauriDrivers.ts`, `internal/tauriNet.ts`, `tools/tauriConf.ts`, `cargoToml.ts`, `tauriLibRs.ts`, `tauriCapability.ts`, `tauriHttpCapability.ts`, `tauriTarget.ts`.
- `apps/golden-1/package.json` and each app's `deploy/<name>/tauri/`; the keel-deploy skill's Shells paragraph; both package READMEs.
- golden-1 lists `@tauri-apps/api`, `@tauri-apps/plugin-http` and `@tauri-apps/plugin-store`, which nothing in the app imports and no rule asks for: remove them if `keel build --target tauri` still builds its web half.

## For the operator
1. **Peers in a shell.** `connect` includes the build's `keel-peer` origins, as a browser's `connect-src` does, while the shell policies are built with no peer (`shellPolicy`). Recommended: keep them in `connect`; the policy does not govern the native client. The other course is a shell that reaches Keel through `KEEL_ORIGIN` alone.
2. **Exact plugin versions.** A plugin at `^8.1.2` is E1572. Recommended: keep exact, since the bundled half is pinned. The cost is one fix diff when Keel moves a Capacitor version.
3. **Bytes without identity.** `@keel/std-capacitor/shellMount` imports `@capacitor/browser` statically, so a no-identity bundle carries its JavaScript (D103 says ideally none). Recommended: a backlog line to pass the browser from the entry only with `identity.ts`; not in this RFC.
4. **`@capacitor/core`, `@capacitor/android`, `@capacitor/ios`.** Not in `plugins`: they are the tool's own packages, and `cap add` fails loudly without them. Recommended: a later line adds them to std.capacitor Tools as E1575 entries.
