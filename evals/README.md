# Evals

```
pnpm eval --task <name> [--model <id>] [--runner claude|none] [--max-iter N] [--skill <name>] [--keel-kit <dir>] [--strict]
pnpm eval --skill <name> [--runner claude|none]
```

Tasks live in `evals/tasks/<name>/` (`TASK.md`, `spec-slice.txt`, `pass.ts` whose default export returns `true` on success). A task may carry `task.json` `{ "skill": "<name>" }` naming its default skill (golden-1, golden-1-api, golden-2, golden-3: `keel`). A task may also keep a hidden `acceptance.test.ts` that its `pass.ts` copies into the app's `test/`, runs with the app's vitest config, and removes (golden-2: behavioural `renderRoute` checks against the ids TASK.md pins; excluded from `evals/tsconfig.json`). golden-3's `pass.ts` also runs `browser.ts` (Chromium and WebKit from the local Playwright cache, no download) on the built server and makes and verifies an evidence bundle with a fresh key and `audit.json`, a `pnpm audit --json` document with no advisories. Skill precedence for a task run: `--skill`, then `task.json`, then `keel-package-dev`. `--skill` without `--task` is the skill-eval mode. Skill evals live in `evals/skills/<skill>.json`: `{skill, maxTokens, prompt, expect[]}`.

**Runners.** `claude` (default when `--model` is given) loops up to `--max-iter` (default 5): `claude -p --output-format json -- <prompt>` (the `--` keeps a prompt that starts with SKILL.md frontmatter from parsing as an option) with TASK + spec slice + skill (plus the previous iteration's `pnpm check`/`pnpm test` output), then `pnpm check --quiet`, `pnpm test --quiet`, `pass.ts`. An iteration converges only when the root check exits 0, the root test exits 0 and `pass.ts` returns true; a command that cannot start counts as non-zero. `none` skips the model and evaluates once, so CI can run end to end. Skill evals always check SKILL.md exists, has `name`/`description` frontmatter, and chars/4 <= `maxTokens`; with `claude` they also send the prompt and require every `expect` substring.

**Output.** Compact per `docs/OUTPUT.md`: `V0001` when not converged, `V0002` skill failure, then trailer `ok eval <task> converged=<bool> iter=<n> tokens=<in>/<out> unsafe=<u> (Xs)`. Exit 0 unless `--strict`.

**Results.** `evals/results/<date>-<task>-<model|none>.json`:
`{task, skill, specSections, model, runner, converged, iterations, tokens:{input,output}, costUsd, unsafeCount, checkTrailer, testTrailer, checkExit, testExit, durationMs, startedAt}`. Input tokens include cache reads/writes. `unsafeCount` counts `unsafe(` under `packages/*/src` and `unsafe/`. Skill results: `<date>-skill-<skill>-<runner>.json`.

## Public mode

A task whose `task.json` has `"docs": "public"` (golden-3) runs as a public user's agent would: in a fresh project outside the repository, from packed `@keel/*` tarballs, reading only the scaffold's `AGENTS.md`, `CLAUDE.md`, `.claude/skills/` and `keel docs`, `keel explain` and the packages' READMEs; never `spec/`, `docs/`, source or the repo's `.claude/`. Files in `evals/public/`:
- `pack.ts`: the pack step, one kit of `keel-<name>-<version>.tgz` for every package, used by the public mode and by the head-to-head Keel arm (`--keel-kit <dir>`, else a fresh pack). Each package's own `build` compiles it (`dist/`), `tooling/docs-pack.mjs --all` packs its `docs/`, and `npm pack` runs on a staged copy whose `package.json` is rewritten: `exports` entries `./src/x.ts` become `./dist/src/x.js` with `types` at `./dist/src/x.d.ts`, a root `./module.ts` is compiled to `./dist/module.js`, `bin` is the `publishConfig.bin`, `workspace:*` becomes the version, and `private`, `scripts` and `devDependencies` go. The repository's `package.json` files are not touched.
- `project.ts`: a bootstrap folder installs the kit's `@keel/cli`, runs `keel scaffold project <name>` in a fresh `<tmp>/keel-public-*` folder, and the project installs with every `@keel/*` as an `overrides` entry of its `pnpm-workspace.yaml` pointing at a tarball (`pnpm install --prefer-offline`: the shared store first, the registry for a version it lacks). `proveProject` runs `keel check`, `keel docs`, `keel test` and `keel build` in it.
- `isolation.ts`: `V0008`, the probe: the project is inside the repo, a `CLAUDE.md`, `AGENTS.md`, `.claude`, `package.json`, `pnpm-workspace.yaml` or `node_modules` sits above it, an installed `@keel/*` resolves into the repo, or (runner `claude`) the agent's list of loaded skills and memory files names a path outside the project. `V0009`, the audit of an iteration's `stream-json` transcript: any tool call whose path (resolved against the project), command or pattern names the repo root or `~/.claude`. Permission prompts stay off, so probe and audit are the guard, not a sandbox.
- `agent.ts`: `claude -p --output-format stream-json --setting-sources project` in the project; the CLI needs `--verbose` for `stream-json` and that is the only reason it is passed.
- `importApp.ts`: after each iteration the project goes into `apps/<task>/` (sources, tests, config; not `node_modules`, `dist`, `reports`, `AGENTS.md`, `CLAUDE.md`, `.claude`, `pnpm-workspace.yaml`), `@keel/*` become `workspace:*`, `scripts` take `task.json` `import.scripts`, the root's biome formats `modules` and `test`, and the task's `pass.ts` runs from the repo root unchanged. A run with `--runner claude` keeps the import and the root install's lockfile change; `--runner none` removes `apps/<task>` again.

The prompt is the task's `TASK.md` alone (no spec slice, no skill text); feedback comes from the project's own `pnpm check` and `pnpm test`. The result adds `docs: "public"`, `probe`, `audit` and `packed` (every `@keel/<name>@<version>`). `V0010` is a failed step of `eval:public prove` or `selftest`.

```
pnpm eval:public pack [--out <dir>] [--no-build]
pnpm eval:public prove [--kit <dir>]
pnpm eval:public selftest
```

`prove` runs a fresh project from the kit through check, docs, test and build and the probe. `selftest` runs the audit on a transcript that reads a forbidden path and one that does not, the pack rewrite and the import into a throwaway folder. None of the three runs an agent.

## Head to head

```
pnpm eval:h2h --arm keel|next --agent claude|codex [--model <id>] [--max-iter N] [--timeout-min N] [--keel-kit <dir>] [--next-version <v>]
pnpm eval:h2h --dry <built-app-dir|stub>
pnpm eval:h2h --url <origin>
```

One app, built by an agent in Keel and in Next.js, scored by the same hidden suite and scans against a URL. Files in `evals/headtohead/`:
- `brief/BRIEF.md`: the Recipe box, a stack-neutral product brief (behaviour, element ids, copy in three locales; no Keel API). Both arms receive it unchanged, after one preamble line in `evals/h2h.ts`.
- `suite.ts`: the hidden acceptance suite, 28 black-box checks over HTTP and Chromium (Playwright from the workspace), run in order against one server that starts empty. It is never copied into an arm's directory; the arm directory is a fresh `mkdtemp` folder outside the repository.
- `scan.ts`: the security scan (CSP quality, `nosniff`, framing, referrer and permissions policy, version-naming headers, cookie flags, CORS wildcard, stack traces on an unknown path, one stored-XSS payload through the form) and the a11y scan (axe-core's default rules on five pages, `bypassCSP` so the app's own policy does not block axe). Each defect is one line; a11y counts a rule once per page.
- `arms.ts`, `agent.ts`, `serve.ts`: arm preparation, build and production start; the `claude` and `codex` command lines and usage parsing; a free port and a child server.
- `stub/server.mjs`: a deliberately broken app that proves the scorer fails.

**Arms.** `keel`: the public mode's project (`evals/public/project.ts`: the packed `@keel/cli`'s `keel scaffold project`, which writes `AGENTS.md`, `CLAUDE.md` and the published skills) with the packed `@keel/*` tarballs of `--keel-kit` (a fresh pack when absent) as `overrides` of the scaffold's `^0.0.0` ranges (they are not on a registry); build `pnpm build`, serve `dist/<deployable>/server.mjs`. `next`: `create-next-app@<--next-version, default latest>` with TypeScript, App Router and npm; build `npm run build`, serve `npm start`. The agent (`claude -p`, or `codex exec`, permission prompts off) runs in the arm directory. Up to `--max-iter` (default 3) iterations: agent, build, start, score; a failed iteration's next prompt carries the build or start error, or only the count of failed acceptance checks, never their names.

**Dry mode.** `--dry <dir>` serves a built Keel app (`pnpm --filter golden-2 build` first) and scores it, no agent; `--dry stub` scores the stub; `--url` scores a server that is already running. Nothing is spent.

**Scores.** `evals/results/<date>-h2h-<arm>-<agent>-<model>.json` (`<date>-h2h-<app>-dry.json` for dry), the keys above (`task` `h2h-recipe-box`, `skill`, `specSections`, `model`, `runner`, `converged`, `iterations`, `tokens`, `costUsd`, `durationMs`, `startedAt`) plus `arm`, `agent`, `stack`, `tokensToGreen` (all tokens through the green iteration, null when not converged), `builds`, `timedOut`, `scoreMs`, `acceptance {passed,total,failed[{name,reason}]}`, `security {defects,checks,found[]}`, `a11y {defects,nodes,pages,found[]}`. `converged` means every acceptance check passed; `durationMs` excludes scoring. Output is compact per `docs/OUTPUT.md`: `V0004` a failed acceptance check, `V0005` a security defect, `V0006` an a11y defect, `V0007` a run that could not complete, then `ok h2h <label> converged=<bool> accept=<p>/<t> security=<n> a11y=<n> ... (Xs)`.

**Maintenance slot.** `brief/MAINTENANCE.md` specifies a second brief kind, adding a `servings` field to an existing app, with its added checks and scores. It has no suite, flag or runner step yet.
