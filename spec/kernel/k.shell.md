# k.shell: Native shells
status: conformance-covered
**Declaration.** A `client` deployable may name the native shells that package it: `shells: { capacitor?: { id, name }, tauri?: { id, name } }` in `topology.ts`. `id` is a reverse-DNS app id and its return links' scheme (k.return), `name` its title; the version the app's `package.json` `version`. Each shell's package provides it and must be in `dependencies` (E1572, k.deploy): `capacitor` (Android, iOS) `@keel/std-capacitor`, `tauri` (desktop) `@keel/std-tauri`. So must each native plugin its target names (Plugins). The rest: std.capacitor, std.tauri. `shells` on another adapter, or an `id` that is not reverse-DNS, is E1573.

**Shell ctx.** A shell build's entry is the `client` entry with `createCtx({ mode: 'shell', drivers })`, `drivers` the package's `<shell>Drivers({ origin?, connect })`, `origin` the build's origin as a URL (Build 2; absent when it has none), `connect` the build's other origins (Origins): its `storage` and `net` (k.persist). The page loads from the shell's own origin, so the drivers keep this contract:
- `net.fetch`: a request to the page's origin (a relative URL included) goes to `origin`, same method, path, search, headers and body, through the shell's native HTTP client, and with no `origin` is refused; a request to `origin` or a `connect` origin goes as given; any other is refused (Origins). Cookies, the caller cookie included (k.security), stay in the shell's cookie store and go only to their origin. A failure rejects with a `TypeError`. `online()` and `net` events: as real.
- `storage`: the shell's native store, kept across restarts, written before `set` or a `true` `commit` resolves.
- `clock`, `random` and registered capabilities: as real, unless a capability's `shell` factory differs.
So `modules/` run unchanged in a browser and in a shell. Before the router starts, the entry calls the package's `shellMount(ctx, { id, origin?, mount? })` (`./shellMount`), `id` the shell's, `origin` as the drivers get it: it listens for the shell's return links, reports the launch once, then delivers each (k.links), with an identity source or without one. With `identity.ts`, `mount` is its default export: the link listener also takes that mount's paths, and each URL the router hands it opens in an external browser sharing no cookie with the app (k.return). Without one, page links are delivered and every other link is ignored.

**Origins.** A shell's `net` sends what a browser's `connect-src` lets that `client` send, and nothing else. `connect` is, in order and once each, the `keel-peer` origins of the web build (k.hosting) and the deployable's declared `origins.connect` origins (k.origins), `origin` left out. A request, or a redirect hop, to an `http:` or `https:` origin that is neither `origin` nor in `connect`, or to another scheme, is refused: `net.fetch` rejects with a `TypeError` naming no URL, as for any failure, and nothing is sent to it (k.services: `api.network`). The native client follows no redirect; the driver does:
- `redirect: 'manual'`: a 3xx resolves as it came. `'error'`: a 3xx rejects with a `TypeError`.
- `'follow'`: a 3xx with a `location` (301, 302, 303, 307, 308) is one more request to that URL, resolved against the hop's, at most 20. 303 unless the method is `HEAD`, and 301 or 302 after a `POST`, continue as a `GET` with no body and no `content-type`; any other hop repeats method and body. A hop to another origin drops `authorization`. The 21st redirect rejects with a `TypeError`. A 3xx with no `location` resolves as it came.
The shell enforces the same list outside the page, for script the app did not ship (std.capacitor, std.tauri).

**Without a server.** A topology with no `node` deployable has no Keel origin: nothing in it answers a request, and `identity.ts` there is E1589 (k.mount). Its shell build reads no `KEEL_ORIGIN` and has no `origin`: the entry passes none to the drivers or `shellMount`, `build` is given none, and its `env` holds no `KEEL_ORIGIN`. `connect` is then the declared `origins.connect` origins alone, as no `keel-peer` origin exists. `net` sends to those and refuses every other request, one on the page's own origin included, so no request carries a Keel header (k.services) or reaches a Keel server path. Page links are delivered as in any shell without `identity.ts`.

**Shell target.** `keel check` and `keel build` import the `./tools` entry of each declared shell's package (a throw: E1159, k.module), which calls `shellTarget(shell, target)` (`@keel/cli`) once; a second is E1053.
```ts
type ShellTarget = {
  platforms: readonly string[] // [] for no --platform
  files(app: ShellApp): Readonly<Record<string, string>> // under deploy/<name>/<shell>/
  tools(at: ShellProbe): readonly { tool: string; need: string }[]
  plugins(app: ShellApp): readonly { plugin: string; version: string; need: string }[]
  build(at: ShellBuild): { artifact: string } | { error: string }
  ci(app: ShellApp): readonly ShellJob[]
}
```
`ShellApp`: `{ deployable, id, name, version, pkg, policy, identity }`, `pkg` the `package.json` `name`, `policy` the `client` policy (k.security), `identity` true with `identity.ts`. `ShellProbe`: `{ platform, env, probe }`, `probe` runs a command or tests a path. `ShellBuild`: a `ShellApp` with `root`, `dir` (`dist/<name>/<shell>/`), `origin` (absent with none, Build 2), `connect` (Origins), `platform`, `release`, `env`. `ShellJob`: `{ job, runsOn, platform?, manual, steps, env, artifact? }`.

**Plugins.** `plugins` gives the npm packages whose native half the shell's own tool installs only when the app lists them: `plugin` at the exact `version`, `need` what uses it, the three at most 50 characters together. It reads `app` alone, so a plugin of a feature the app has not turned on (`identity` false) is not given and nothing is reported for it. Each one absent from the app's `package.json` `dependencies`, or there at another version text, is one E1572 at the deployable's key in `topology.ts`, `<deployable>: <shell> needs <plugin> <version> (<need>)`, its fix that entry added or set, keys sorted; once per plugin in a project. `keel check` reports them; so does `keel build --target <shell>`, with its tools. No `package.json`, or one that is not a JSON object: none.

**Files.** `files` gives the shell files, read-only deploy files (k.deploy; E1005, fix: the regenerated file); a path with a `..` segment, a `\` or a leading `/`, a symlink, or one resolving outside the folder is E1585: none of the set is written. Another file there is the app's. Removing a shell removes its files.

**Build.** `keel build --target <shell>` [`--platform <p>`] [`--release`] builds each `client` deployable declaring it:
1. A shell no `client` deployable declares, or a `--platform` not in the target's `platforms` or missing while it has some, is E1052; a package registering no target, E1585.
2. With a `node` deployable in the topology, `KEEL_ORIGIN` unset or empty, or not `https:` outside `localhost`, is E1574 `KEEL_ORIGIN must be an https: origin (http: on localhost only)`; its origin is the build's `origin`. With none, a `KEEL_ORIGIN` set and not empty is E1574 `KEEL_ORIGIN is set and topology.ts has no node deployable to answer it`, and the build has no `origin` (Without a server). Neither names the value.
3. `tools` and `plugins`, before any work: each `tools` entry one E1575, each missing plugin one E1572.
4. The shell entry's web build into `dist/<name>/<shell>/www/` (the Vite plugin, given `KEEL_SHELL`), `deploy/<name>/<shell>/` copied beside it.
5. `build`, writing only under `dir` and the app's files: an `error` (a tool's output) ends the build with its lines from the first error line, at most 12; the trailer names each `artifact` (`ok build web tauri <artifact>`).

**CI.** The generated workflow (k.deploy) gains each `ShellJob` as `<name>-<job>` on its deployable's paths, with a `node` deployable in the topology `KEEL_ORIGIN` from `vars`: checkout, pnpm, Node 22, `steps`, install, `keel build --target <shell>` with its `platform` and `env`, uploading `artifact`. A `manual` job's `if` adds `github.event_name == 'workflow_dispatch'`, then a workflow trigger.

**Rules.** E1573 `shells` on a deployable that is not `client`, or an `id` that is not reverse-DNS · E1574 a shell build's `KEEL_ORIGIN` unset, empty or invalid with a `node` deployable, or set with none (names the key) · E1575 a shell build's tool missing or too old, `<tool> missing or too old: needs <need>`, the two at most 60 characters together · E1585 a shell package registering no target, or a shell file path outside its folder.

**Conformance.** With a stub `@keel/std-tauri` whose target gives `a.json`; a case that sets `KEEL_ORIGIN` has a `node` deployable `api` beside `web`:
- `shells` on a `node` deployable is one E1573; `id: 'golden'` is one E1573.
- With `api`, `keel build --target tauri` with `KEEL_ORIGIN` unset, and with it empty, prints one E1574 naming it and builds nothing; with `http://localhost:8080` it proceeds.
- The `www` entry a shell build writes creates its ctx with `mode: 'shell'` and the package's drivers; the plain `client` entry is unchanged.
- `keel build` writes `deploy/web/tauri/a.json`; a changed byte is E1005 whose fix restores it; removing `tauri` removes it; a file `files` does not give stays.
- With `tools` giving two entries, the build prints two E1575, each naming its `tool` and `need`, exits 1, writes nothing under `dist/web/tauri/` and calls no `build`.
- With `platforms: ['x']`, `--platform y` and no `--platform` are each one E1052; a stub registering nothing, or a path `../a.json`, is one E1585.
- A `build` whose `error` has an `error:` line then 20 more prints 12 from it and exits 1; one returning an `artifact` prints it in the trailer.
- A `ShellJob` `{ job: 'tauri', manual: true }` is a `web-tauri` job running `keel build --target tauri` on `workflow_dispatch` only.
- The `www` entry of a project with no `identity.ts` calls the package's `shellMount` with the shell's `id` and no `mount`, before the router starts; with `identity.ts`, with its default export as `mount`.
- With a stub target whose `plugins` gives `{ plugin: '@x/p', version: '1.2.3', need: 'n' }`: `keel check` of an app without `@x/p` in `dependencies` prints one E1572 at the deployable's key naming `@x/p 1.2.3` and `(n)`, whose fix adds `"@x/p": "1.2.3"`; with `"@x/p": "^1.2.3"`, one whose fix sets `1.2.3`; with `1.2.3`, none. Two `client` deployables declaring the shell: one E1572.
- With that E1572, `keel build --target tauri` prints it, exits 1, writes nothing under `dist/web/tauri/` and calls no `build`.
- A stub whose `plugins` gives that entry only when `app.identity`: no E1572 in a project with no `identity.ts`; one with it.
- `keel check` with a stub `plugins` entry `{ plugin: '@aaaaaaaa/bbbbbbbb', version: '10.20.30', need }`, `need` 24 `n`s: one E1572, `web: tauri needs @aaaaaaaa/bbbbbbbb 10.20.30 (<need>)` (71 units). `keel build --target tauri` with a `tools` entry of `tool` 30 `t`s, `need` 30 `n`s: one E1575, `<tool> missing or too old: needs <need>` (87).
- The `www` entry's drivers call carries `connect: []` with no `origins`; with `origins.connect` declaring `https://api.example` and `KEEL_PEER_API=https://peer.example`, `connect: ["https://peer.example", "https://api.example"]`, which `build` is given as `connect` too; a declared origin equal to `KEEL_ORIGIN` is left out.
- With `web` alone, `keel build --target tauri` with `KEEL_ORIGIN` unset, and with it empty, prints no E1574 and proceeds; `build` is given no `origin` and an `env` without `KEEL_ORIGIN`; the `www` entry's drivers call is `{ connect: [] }` and its `shellMount` call `{ id }`, neither with an `origin`. With `KEEL_PEER_API=https://peer.example` set too, the same.
- With `web` alone and `KEEL_ORIGIN=https://app.example`, the build prints one E1574 `KEEL_ORIGIN is set and topology.ts has no node deployable to answer it`, holding no part of the value, exits 1, writes nothing under `dist/web/tauri/` and calls no `build`.
- With `web` alone declaring `origins.connect` `https://api.example`, the drivers call is `{ connect: ["https://api.example"] }`, which `build` is given as `connect`.
- The generated workflow's `web-tauri` job sets no `KEEL_ORIGIN` with `web` alone, and `KEEL_ORIGIN: ${{ vars.KEEL_ORIGIN }}` with `api`.
