# Brief: one published Keel skill (W5 step 4)

You write ONE published agent skill for the Keel framework. Seven agents work at the same time in this same git worktree, one skill each:
the worktree and branch the orchestrator names in your prompt. Run every command there. Never touch the parent checkout or other worktrees.

Your skill's name is given in your prompt. You own exactly these paths and nothing else:
- `packages/cli/skills/<name>/SKILL.md` (create it)
- `evals/skills/<name>.json` (create or rewrite; if old skills merge into yours, fold their `evals/skills/<old>.json` prompts and expectations into this one file, but do NOT delete the old files or the old `.claude/skills/*`: another lane removes them)
Commit with explicit paths only (`git add <those two paths>; git commit`), never `git add -A` or `git commit -a`. If `git commit` fails because another agent holds the index lock, wait a few seconds and retry.

## Read first
- `CLAUDE.md`, `docs/BRAND.md` (voice rules; `node tooling/voice-lint.mjs` checks them), `docs/GLOSSARY.md` (never rename a term).
- `tasks/p1/w5-agent-docs.md`: the "Skill split" table row for your skill (scope, spec sections, source skills, target size) and the section "Checks that keep docs true" (your skill must satisfy every check listed there, even though the checker is not built yet).
- The old skills your row names under "from": `.claude/skills/<old>/SKILL.md`.
- Each spec section your row lists, fetched one at a time with `pnpm spec <id>` (never read `spec/` wholesale). Not every id in the table exists; `pnpm spec --map` lists the real ones. Use what exists and report ids that do not.

## What the skill is
The reader is a coding agent in a USER'S project that has Keel installed from npm. It has no Keel repo: no `spec/`, `docs/`, `apps/`, `packages/`, no `pnpm spec`, no `--workspace`. It can run `keel docs <section id>` (prints one spec section), `keel docs --for <code>` (the section that owns a diagnostic code), `keel explain <code>`, `keel check`, `keel test`, `keel build`, `keel scaffold ...`.

The skill holds the task-shaped rules and ONE compiling example per main API, and sends the agent to `keel docs <id>` for exact signatures. It is not a copy of the spec.

## Hard requirements
1. Frontmatter with `name` and `description`; the description names the kind of work and the diagnostic codes (follow the style of the old skills' descriptions, e.g. "...; E19xx, E1583").
2. Size: whole file chars / 4 at or under your row's target. Measure it (`wc -c`) and report it.
3. Reconcile with the spec: every API name, option, default, file name and diagnostic code in the skill is read from a spec section (or verified by `grep` in `packages/*/src` exports and `keel explain`'s catalog: `grep -rn "<CODE>" packages/check/src/explain | head -2`), not copied from the old skill. Where the old skill and the spec disagree, the spec wins; list each disagreement in your report.
4. Every fenced `ts`/`tsx` block must type-check as a module against the workspace packages under the strict profile. Prove it: copy each block to a scratch file under `packages/cli/skills/<name>/.tmp-check/` (untracked; delete it before committing), type-check it with the repo's TypeScript and base config (look at how an app such as `apps/golden-1` sets up its `tsconfig.json`, and use `pnpm exec tsc --noEmit -p <your scratch tsconfig>`), and fix the example until it passes. At most two blocks may be tagged `ts fragment` (not compiled). No `any`, casts, non-null assertions or `@ts-ignore` in examples; no bare `Date`, `Math.random`, `fetch`.
5. Every `import { ... } from '@keel/...'` names a real export of that package.
6. Every section id cited (`keel docs k.router`) exists in `pnpm spec --map`. Every diagnostic code cited exists; a range like `E19xx` needs at least one real code in it.
7. No repo-only path or command anywhere in the skill: `pnpm spec`, `spec/`, `docs/`, `apps/`, `packages/`, `.claude/`, `--workspace`.
8. Voice: present tense, plain, no history ("now", "used to", "new"), no marketing words, no task or RFC ids.
9. `evals/skills/<name>.json` has the shape `{skill, maxTokens, prompt, expect[]}` (see an existing file); `maxTokens` is your target; the prompt asks for a small task in your scope and `expect` lists substrings a correct answer must contain (API names, a code). Keep the best cases of the merged old files.

## Verify
- `node tooling/voice-lint.mjs` prints ok (if it does not cover `packages/cli/skills/`, run it anyway and also re-read your file against `docs/BRAND.md`).
- `pnpm exec biome format --write evals/skills/<name>.json` for the JSON only.
- Do not run test suites. Do not run `pnpm eval` with a model runner. `pnpm eval --skill <name> --runner none` may not find a skill at the new path yet; try it once and report what it says.

## Commit
`docs(skills): the published <name> skill`, message ending with:
Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>
Do not push.

## Report (under 200 words)
The commit; file size in chars and chars/4 against the target; number of code blocks and how each was type-checked (the command and its result); every place the old skill disagreed with the spec; spec ids from your row that do not exist; anything in your scope you had to leave out for size, so the orchestrator can decide.
