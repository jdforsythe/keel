# k.shell: Native shells
status: conformance-covered

**Declaration.** A `client` deployable may name the native shells that package it: `shells: { capacitor?: { id, name }, tauri?: { id, name } }` in `topology.ts`. `id` is a reverse-DNS app id and its return links' scheme (k.return), `name` its title; the version the app's `package.json` `version`. Each shell's package provides it and must be in `dependencies` (E1572, k.deploy): `capacitor` (Android, iOS) `@keel/std-capacitor`, `tauri` (desktop) `@keel/std-tauri`. The rest: std.capacitor, std.tauri. `shells` on another adapter, or an `id` that is not reverse-DNS, is E1573.

**Shell ctx.** A shell build's entry is the `client` entry with `createCtx({ mode: 'shell', drivers })`, `drivers` the package's `<shell>Drivers({ origin })`, `origin` the `KEEL_ORIGIN` URL: its `storage` and `net` (k.persist). The page loads from the shell's own origin, so the drivers keep this contract:
- `net.fetch`: a request to the page's origin (a relative URL included) goes to the build's `KEEL_ORIGIN`, same method, path, search, headers and body, through the shell's native HTTP client, honouring `redirect: 'manual'`; another origin's request goes as given. Cookies, the caller cookie included (k.security), stay in the shell's cookie store and go only to their origin. A failure rejects with a `TypeError`. `online()` and `net` events: as real.
- `storage`: the shell's native store, kept across app restarts, written before `set` or a `true` `commit` resolves.
- `clock`, `random` and registered capabilities: as real, unless a capability's `shell` factory differs.
So `modules/` run unchanged in a browser and in a shell. With `identity.ts` the entry calls the package's `shellMount(ctx, { id, origin, mount })` (`./shellMount`, `mount` from `identity.ts`) before the router starts: it opens each URL the router hands it in an external browser sharing no cookie with the app, reports the launch once, then delivers return links (k.links).

**Shell target.** `keel check` and `keel build` import the `./tools` entry of each declared shell's package (a throw: E1159, k.module), which calls `shellTarget(shell, target)` (`@keel/cli`) once; a second throws E1053.
```ts
type ShellTarget = {
  platforms: readonly string[] // [] for no --platform
  files(app: ShellApp): Readonly<Record<string, string>> // under deploy/<name>/<shell>/
  tools(at: ShellProbe): readonly { tool: string; need: string }[]
  build(at: ShellBuild): { artifact: string } | { error: string }
  ci(app: ShellApp): readonly ShellJob[]
}
```
`ShellApp`: `{ deployable, id, name, version, pkg, policy, identity }`, `pkg` the `package.json` `name`, `policy` the `client` policy (k.security), `identity` true with `identity.ts`. `ShellProbe`: `{ platform, env, probe }`, `probe` runs a command or tests a path. `ShellBuild`: a `ShellApp` with `root`, `dir` (`dist/<name>/<shell>/`), `origin`, `platform`, `release`, `env`. `ShellJob`: `{ job, runsOn, platform?, manual, steps, env, artifact? }`.

**Files.** `files` gives the shell files, read-only deploy files (k.deploy; E1005, fix: the regenerated file); a path with a `..` segment, a `\` or a leading `/`, a symlink, or one resolving outside the folder is E1585: none of the set is written. Another file there is the app's. Removing a shell removes its files.

**Build.** `keel build --target <shell>` [`--platform <p>`] [`--release`] builds each `client` deployable declaring it:
1. A shell no `client` deployable declares, or a `--platform` not in the target's `platforms` or missing while it has some, is E1052; a package registering no target, E1585.
2. `KEEL_ORIGIN` unset, or not `https:` outside `localhost`, is E1574.
3. `tools`, before any work: each entry one E1575.
4. The shell entry's web build into `dist/<name>/<shell>/www/` (the Vite plugin, given `KEEL_SHELL`), `deploy/<name>/<shell>/` copied beside it.
5. `build`, writing only under `dir` and the app's files: an `error` (a tool's output) ends the build with its lines from the first error line, at most 12; the trailer names each `artifact` (`ok build web tauri <artifact>`).

**CI.** The generated workflow (k.deploy) gains each `ShellJob` as `<name>-<job>` on its deployable's paths, `KEEL_ORIGIN` from `vars`: checkout, pnpm, Node 22, `steps`, install, `keel build --target <shell>` with its `platform` and `env`, uploading `artifact`. A `manual` job's `if` adds `github.event_name == 'workflow_dispatch'`, then a workflow trigger.

**Rules.** E1573 `shells` on a deployable that is not `client`, or an `id` that is not reverse-DNS · E1574 a shell build without a valid `KEEL_ORIGIN` (names the key) · E1575 a shell build's tool missing or too old (names it and the version needed) · E1585 a shell package registering no target, or a shell file path outside its folder.

**Conformance.** With a stub `@keel/std-tauri` whose target gives `a.json`:
- `shells` on a `node` deployable is one E1573; `id: 'golden'` is one E1573.
- `keel build --target tauri` with `KEEL_ORIGIN` unset prints one E1574 naming it and builds nothing; with `http://localhost:8080` it proceeds.
- The `www` entry a shell build writes creates its ctx with `mode: 'shell'` and the package's drivers; the plain `client` entry is unchanged.
- `keel build` writes `deploy/web/tauri/a.json`; a changed byte is E1005 whose fix restores it; removing `tauri` removes it; a file `files` does not give stays.
- With `tools` giving two entries, the build prints two E1575, each naming its `tool` and `need`, exits 1, writes nothing under `dist/web/tauri/` and calls no `build`.
- With `platforms: ['x']`, `--platform y` and no `--platform` are each one E1052; a stub registering nothing, or a path `../a.json`, is one E1585.
- A `build` whose `error` has an `error:` line then 20 more prints 12 from it and exits 1; one returning an `artifact` prints it in the trailer.
- A `ShellJob` `{ job: 'tauri', manual: true }` is a `web-tauri` job running `keel build --target tauri` on `workflow_dispatch` only.
