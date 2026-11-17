# RFC 0124: `keel build` writes the production client whatever `NODE_ENV` says

Status: accepted (orchestrator under the owner's standing leave, 2026-11-17). For backlog 0751 (red team 5, finding 2, MEDIUM). Follows RFC 0119 and RFC 0122.

## Problem
The generated client entry and the resume entry compute `const mode = import.meta.env?.DEV === true ? "dev" : "production"` (`packages/compiler/src/internal/entryCode.ts:73`, `packages/compiler/src/entry/resumeEntry.ts:25`), and the client entry runs the inspect reporter under `if (import.meta.env.DEV)` (`entryCode.ts:78`). Vite sets `DEV` to `NODE_ENV !== "production"` once `NODE_ENV` is set, and a project `.env` holding `NODE_ENV=development` sets it when the shell does not (vite 8.3.6, `dist/node/chunks/node.js:37539-37546,37681-37686,37802`). `keel build` hands the shell environment to `vite build` unchanged (`packages/cli/src/internal/viteRun.ts:16`; `packages/cli/src/shell/shellBuild.ts:88` for `--target`). Red team 5 built the entry's mode line with the repo's Vite:

```
NODE_ENV=production -> MODE=production
NODE_ENV unset      -> MODE=production
NODE_ENV=staging    -> MODE=dev
NODE_ENV=test       -> MODE=dev
.env NODE_ENV=development, shell unset -> MODE=dev
```

The bundle then carries the literal `"dev"`. `createRouter`'s default alert, every `errorElement` and every `Form` get the thrown message (RFC 0122), `mount`'s and `resume`'s root fallback shows it (RFC 0119), and the reporter posts every store snapshot to `/__keel/inspect` once a second. The server decides the other way: `nodeEnv()` (`packages/server/src/internal/nodeEnv.ts`) reads `NODE_ENV` at run time and treats anything but `development` or `test` as production. A staging deploy built under `NODE_ENV=staging` therefore pairs a production server with a dev client. CI commonly sets `NODE_ENV=test` for a whole job, and the generated `ci.yml` runs `keel test` and `keel build` in one job (k.deploy Deploy files), so the same thing happens to a CI artifact.

## Proposal
**Rule.** What `keel build` writes is the production client. Only `keel dev` produces a dev client. No environment variable, `.env` file or Vite `mode` changes that.

**The entries' `mode`.** The Vite plugin (`packages/compiler/src/vite.ts`) writes `mode` into the generated client and resume entries as a string literal chosen by Vite's command, which it already records at `configResolved`: `"dev"` when Vite serves (`keel dev`, or a test's `createServer`), `"production"` when it builds. `entryCode` and `resumeEntry` take `mode: 'dev' | 'production'`, default `'production'`, and emit `const mode = "<mode>";`. The inspect reporter is guarded by `if (mode === "dev")`, so a build's bundler drops it as dead code. Neither entry reads `import.meta.env`. The server's unbundled fallback (`packages/server/src/internal/servedEntry.ts:38`) calls `resumeEntry(d)` and gets `"production"`, as it does today through the missing `import.meta.env`. This half makes the kernel's own client code independent of the build shell, and also covers a bare `vite build` run outside `keel build`.

**App code and dependencies.** `keel build` runs every Vite build it starts (`viteRun`, `shellBuild`) with `NODE_ENV=production` in the child's environment. Vite treats a set `NODE_ENV` as final: it skips the `.env` file's `NODE_ENV`, sets `import.meta.env.DEV` to `false` and `PROD` to `true`, and replaces `process.env.NODE_ENV` in client code with `"production"`, so app code and libraries that branch on either see a production build too. `server.mjs` is unaffected: `nodeEnv()` reads `process.env` through `Reflect.get` at run time, so no build-time value is folded into it, and the deployed server still decides its own mode from its own environment.

**What `.env` does.** A `.env` file's `NODE_ENV` has no effect on `keel build`, because the shell value `keel build` sets wins (Vite's own precedence). Under `keel dev` it keeps whatever effect Vite gives it on `import.meta.env.DEV` in app code; the kernel entries are `"dev"` there either way.

**Output.** `keel build` says nothing when it overrides a `NODE_ENV`: a successful build is silent (docs/OUTPUT.md), and a warning would fire on every CI build that sets `NODE_ENV=test` for the job, teaching people to read past `W` lines. The rule is in k.deploy Build, where a reader of the build looks. This is choice C3; the operator can reverse it.

## Alternatives
- Set `NODE_ENV=production` in `keel build` only, leaving the entries on `import.meta.env.DEV`: a `vite.config.ts` that sets `define` or `process.env.NODE_ENV`, or a bare `vite build`, could still flip the kernel's mode. The literal costs one parameter.
- The plugin literal only, with `NODE_ENV` passed through: the kernel fails closed, but app code and dependencies that read `import.meta.env.DEV` or `process.env.NODE_ENV` ship their dev branches in a staging build. That is still a dev client by the operator's rule.
- Warn (a new `W` code) when `NODE_ENV` is set to anything but `production`, and build as asked: the build stays a dev client, and the warning lands in CI logs nobody reads. Fail closed means the build is right without the reader's help.
- Pass `--mode production` and key the entry on `import.meta.env.MODE === "development"`: `mode` also picks `.env.<mode>` files, so forcing it would change which of the project's env files load; and `MODE` is still Vite's value, which a config can set.
- Refuse to build (an `E` code) when `NODE_ENV` is set to anything else: breaks every CI job that sets `NODE_ENV=test` for the job, for a value the build can safely ignore.

## Spec diff
k.runtime (before 5,992 characters, 1,498 tokens; after 5,991 characters, 1,498 tokens). To pay for the change, "Server-rendered apps never call it; their entry calls `resume`" becomes "Server-rendered apps' entries call `resume`", meaning kept (the first sentence already makes `mount` client-only). Whole new text of the changed paragraph line:

```
`mount(Component, el, { ctx?, onError?, mode? })` (generated entry only; the root takes no props) renders a client-only tree into `el`, passing `ctx` as the root component's third argument, and returns `dispose`. `onError` also gets each error the default root Boundary renders. Server-rendered apps' entries call `resume` (`@keel/runtime-dom/ops`), which passes `ctx` to every island root. Both take `mode` (k.errors): `'dev'` only under `keel dev`, else `'production'` (k.deploy).
```

k.deploy (before 5,750 characters, 1,438 tokens; after 5,982 characters, 1,496 tokens). To pay for part of the change: "Shell builds (`keel build --target`): k.shell." becomes "`keel build --target`: k.shell."; "which the app lists in `dependencies` (E1572)" becomes "E1572" inside the std.db parenthesis (the Rules line states E1572 in full); the compose bullet drops "(`KEEL_DATABASE_URL` too)", which Conformance 9 states. Whole new text of each changed sentence:

Build, a new third sentence after "… no `sourcesContent`, never served.", and the last sentence:
```
`keel build` runs Vite with `NODE_ENV=production`, whatever the shell or `.env` sets: the entries' `mode` is `'production'` and `import.meta.env.DEV` is `false`.
… `keel build --target`: k.shell.
```

Storage:
```
`'sqlite'` and `'postgres'` are drivers (k.persist) of `@keel/std-db` (std.db; E1572); the generated entry imports the one named and `start` opens it before listening (a failure: std.db's E2152 or E2153, exit 1). The URL is a secret: no log line, diagnostic or generated file holds it.
```

Deploy files, compose bullet:
```
- `deploy/compose.yaml`: a service per `node` deployable and a volume per one with a volume, `KEEL_PEER_<NAME>` set to peers' service URLs, other `DeployEnv` keys from the environment.
```

Conformance, appended as bullet 11 (bullets 1-10 keep their order and text):
```
- `keel build` under `NODE_ENV=staging`, or with `NODE_ENV=development` in `.env`, builds an entry with `mode` `'production'` and no inspect reporter.
```

## Conformance diff
One `rfc:0124` commit by the `conformance-writer`:
- `packages/compiler/conformance/entry-mode.test.ts`: the header's first line quotes the new k.runtime clause ("`'dev'` only under `keel dev`, else `'production'`"). The served entries (Vite `createServer`, as now) hold `const mode = "dev"` whatever `import.meta.env` is bound to: the enumeration over `DEV` values becomes one assertion that the served text has no `import.meta.env`. The entry text from the plugin's `load` under a `build` command holds `const mode = "production"`, and the unbundled `resumeEntry()` text holds `"production"`.
- New `packages/cli/conformance/build-production-mode.test.ts`, citing k.deploy Conformance 11: a client fixture built by `keel build` (the binary's `Io.build`) with `NODE_ENV=staging` in the environment, and a second one with `NODE_ENV=development` in `.env` and none in the environment, each give a `dist/<name>/assets/*.js` that contains the string `"production"` as the mode and not `/__keel/inspect`; the run prints only the `ok` trailer. One vite build per case; the suite stays within the slow-test bound the cli conformance already uses.

## Migration
No app source changes. A deployed client that was built under a `NODE_ENV` other than `production` becomes a production client on its next `keel build`: thrown text shows as `unexpected` or `keel.unexpected` (RFC 0119, RFC 0122) and nothing posts to `/__keel/inspect`. App code that reads `import.meta.env.DEV` sees `false` in every `keel build`; a team that used a staging `NODE_ENV` to turn on its own debug panels moves that switch to a `VITE_`-prefixed variable of its own, which `keel build` passes through.

One documented flow relies on a dev build from `vite build`: the inspector smoke (`tooling/smoke/README.md` and the header of `tooling/smoke/inspector.mjs`) builds golden-1 with `NODE_ENV=development pnpm --filter golden-1 exec vite build` and serves it with `vite preview`. After this change that bundle is production and never reports. The smoke serves golden-1 with `keel dev --port 4180` from `apps/golden-1` instead; `keel dev` serves `/__keel/inspect` and the dev entry posts to it (k.cli Inspect), and `apps/inspector` keeps its `vite preview --port 4182`. No other doc, README, skill or app relies on a dev build from `keel build` or `vite build`: `NODE_ENV` appears nowhere else in `docs/`, `.claude/skills/`, package READMEs or `apps/`, and no app has a `.env` file. `docs/guide/build-golden-1.md:280` quotes the old mode line and changes to the literal.

## Build order
1. Orchestrator: `spec/kernel/k.runtime.md`, `spec/kernel/k.deploy.md`. The `conformance-writer`: the conformance diff.
2. Lane A (compiler, sonnet): `entryCode.ts` and `entry/resumeEntry.ts` take `mode` and emit the literal, the reporter guard reads `mode`; `vite.ts` passes `command === "serve" ? "dev" : "production"` at the `load` of `/@keel/entry.ts` (`RESUME_ENTRY` stays the production text; the plugin calls `resumeEntry(q.d, mode)`); `packages/compiler/test/{islands,inspect,mutation-project-pure}.test.ts` assert the literal; `packages/compiler/README.md` Vite plugin paragraph; changeset (`@keel/compiler` patch). Runs the compiler suite once.
3. Lane B (cli, haiku): `viteRun.ts` and `shellBuild.ts` add `NODE_ENV: "production"` to the child environment; their unit tests assert it; `packages/cli/README.md` `Io.build` sentence; changeset (`@keel/cli` patch). Runs the cli suite once.
4. Orchestrator: `tooling/smoke/README.md`, `tooling/smoke/inspector.mjs` header, `docs/guide/build-golden-1.md:280`, `docs/THREAT-MODEL.md` Mode line ("a `keel build` client is production whatever `NODE_ENV` the build sees"); ledger, backlog 0751, HANDOFF.

## Token impact
k.runtime 1,498 to 1,498 tokens (5,992 to 5,991 characters); k.deploy 1,438 to 1,496 tokens (5,750 to 5,982 characters). No other section changes.

## Choices
Each is the drafter's recommendation; the operator can reverse any of them.
- C1: both halves: the plugin writes the entries' `mode` as a literal from Vite's command, and `keel build` sets `NODE_ENV=production` for app code and dependencies. Either half alone is listed under Alternatives.
- C2: a `.env` `NODE_ENV` is ignored by `keel build` (the shell value wins, Vite's precedence); `keel dev` is unchanged.
- C3: `keel build` overrides `NODE_ENV` silently; the reversal is one `W` line naming the overridden shell value.
- C4: a bare `vite build` also gives production kernel entries; there is no longer any way to build a dev client, and the inspector smoke moves to `keel dev`.
- C5: `keel build` passes no `--mode`, so the project's `.env.<mode>` file selection is unchanged.
