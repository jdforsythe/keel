# RFC 0094: `keel check` refuses `@keel/*` internal entries in app code

Status: implemented (2026-11-13, orchestrator, WORKFLOW RFC defaults 5, 6; the user confirms or reverses, tasks/0312-s6-compliance/PLAN.md D21). For backlog 0561. Each decision cites the WORKFLOW RFC default it applies; none of the points the defaults escalate arise (Questions). ADR-0117 records it.

## Decision
One new kernel rule, E1576 in k.security: a project file outside `packages/`, `node_modules/` and `.keel/` (app modules, tests, `unsafe/`, tool scripts) that names a `@keel/*` entry with an `internal` path segment, in an import, a re-export, or a literal `import()` or `require`, is an error with no fix. Kernel and stdlib source keeps importing internal entries; the rule tells them from app code by path, as E1207 does. It applies defaults 6 (a check, not the "not public" sentence k.router has today), 5 (server state stays on the server), 3 (the check pipeline and E1251's import visitor, no new mechanism) and 7 (`@keel/check` is re-based).

## Problem
Measured on `jdforsythe/test-impl` at `9135b65`.
- Internal entries today, from `packages/*/package.json` `exports`: `@keel/compiler/internal` (`packages/compiler/package.json:19`, the global-name resolver), `@keel/router/internal` (`packages/router/package.json:15`), `@keel/reactive/internal` (`packages/reactive/package.json:11`), `@keel/schema/internal` (`packages/schema/package.json:15`), `@keel/ctx/internal` (`packages/ctx/package.json:11`), `@keel/store/internal` (`packages/store/package.json:11`), and the stdlib's `@keel/std-jobs/tools/internal` (`packages/std-jobs/package.json:19`). No package exports an `./unsafe` entry. `@keel/server/dom` points into `src/internal/` (`packages/server/package.json:15-17`) but is named `dom`; the generated entries import it (`packages/compiler/src/internal/serverEntryCode.ts:6`).
- The two that matter most. `packages/store/src/internal/index.ts:3-8` exports `copyOf`, `inOrder`, `openStores`, `savedOf`, `saveStores` and `serverState`: the server state runner. `packages/router/src/internal/index.ts:6` exports `createRouterWith(routes, options, state?)` (`packages/router/src/internal/createRouterWith.ts:73`), which runs a loader's or action's `stores` when given a `ServerState`. Together they let browser code run server state over `localStorage` (the browser's `ctx.storage`), against k.server Server state ("client routers refuse `stores`", `spec/kernel/k.server.md:10`).
- `@keel/ctx/internal` exports `report` (`packages/ctx/src/internal/index.ts:5`), which delivers any event to a ctx's observers ("Kernel producers only", `packages/ctx/src/internal/report.ts:13`). App code calling it forges `nav` and `error` events that `std.sessions` records and uploads.
- What the spec says: k.router Execution ends "`@keel/router/internal` is not public" (`spec/kernel/k.router.md:28`). No other section names an internal entry. k.module checks module-to-module access (E1151, E1152) and nothing about package entries. k.check has no import rule. `tooling/structure-lint.mjs:50-60` (S0003) governs kernel-to-kernel import order in this repo only, by package name, not entry.
- What checks it: nothing. TypeScript and Vite resolve any entry in `exports`; `keel check` has one import rule, E1251 (`packages/check/src/rules/noRuntimeOpImport.ts:7`, `@keel/runtime-dom/ops` only).
- Who imports internal entries today (`.ts`/`.tsx`, `dist/` and `node_modules/` excluded):

| entry | kernel packages | stdlib packages | apps, modules, evals, scaffold |
| --- | --- | --- | --- |
| `compiler/internal` | check src 8, test 1 | none | none |
| `router/internal` | server src 16, forms src 2, testing src 1, and tests | none | none |
| `reactive/internal` | runtime-dom src 2, store src 1 | none | none |
| `schema/internal` | forms src 1, store src 1 | std-channels, std-jobs, std-offline, std-sessions src 1 each | none |
| `ctx/internal` | runtime-dom src 5, router src 3, forms, store, testing src 1 each | std-sessions src 1, test 4; std-channels test 3 | `apps/sessions/test` 2 |
| `store/internal` | server src 3, router src 2, testing src 1, and tests | none | none |
| `std-jobs/tools/internal` | none | std-schedules src 3 | none |

  The two app hits: `apps/sessions/test/homeRecording.test.ts:9` and `apps/sessions/test/homeOpaque.test.ts:6`, both `import { report } from "@keel/ctx/internal"` to force an `error` event. Scaffold templates (`packages/scaffold/src/templates/`) emit no internal import; `evals/` and `modules/` have none.

## Proposal

### The rule
- **Code and home.** E1576, k.security Rules, `see: 'k.security'`. k.security already holds the rule that keeps a server capability out of client code (E1571), and the harm here is the server-only boundary (default 5). E1572 to E1575 are reserved by RFC 0085 for k.deploy and k.shell; E1576 is the next free code in the k.security run of block E155x.
- **What it matches.** A string specifier `^@keel\/[^/]+\/(?:[^/]+\/)*internal(?:\/|$)`: `@keel/store/internal`, `@keel/std-jobs/tools/internal`, and deep paths such as `@keel/store/src/internal/serverState.ts`. Forms: `import` (type-only too: internal types are not public API either), `export ... from` and `export * from`, `import('<literal>')`, and `require('<literal>')`. One finding per statement or call, at its start, as E1251.
- **Where it runs.** Every code file `keel check` reads (`isCodePath`) except paths matching `(?:^|\/)(?:packages|node_modules|\.keel)\/`. App modules, `test/` and `*.test.ts` files, `unsafe/` and tool scripts are all in scope: a test that runs server state through an internal entry tests something the app cannot do, and `unsafe/` marks TypeScript escapes with a justification (E1754), not a way past a package's surface.
- **Stdlib packages.** A stdlib package may import a kernel internal entry: the entries are the kernel's seams for library producers (`@keel/ctx/internal` exists for `std.sessions`, `@keel/schema/internal` for the secret-path check four stdlib packages run). The rule tells library code from app code by path, as E1207 does (`packages/check/src/rules/noDetachedScope.ts:12`): in this repo stdlib source is `packages/std-*/`, in a project it is `node_modules/@keel/std-*/`, and `keel check` passes project-relative paths (`packages/cli/src/internal/projectFiles.ts:7`). Import order between packages stays S0003's.
- **Message** (under 90 characters with the longest entry): `<specifier> is internal to Keel packages; use a public entry`.
- **Explanation row** (`EXPLANATIONS.ts`): `["E1576", "import of a @keel internal entry in app code or tests", "Internal entries are kernel and stdlib seams, such as the server state runner.", "import { report } from '@keel/ctx/internal' -> produce the event through a public API", "k.security"]`.
- **No fix.** Each internal export has a different public path (the router, `createApp`, a kernel producer), or none on purpose; the replacement is the author's.

### Implementation sketch
`packages/check/src/rules/noInternalEntry.ts`, registered in `KERNEL_RULES.ts` after `noRuntimeOpImport`:
```ts
const INTERNAL = /^@keel\/[^/]+\/(?:[^/]+\/)*internal(?:\/|$)/;
const LIBRARY = /(?:^|\/)(?:packages|node_modules|\.keel)\//;
check: ({ file, ast }) => {
  if (!isCodePath(file.path) || LIBRARY.test(file.path)) return [];
  const out: Finding[] = [];
  const hit = (at: number, s: unknown): void => {
    if (typeof s === "string" && INTERNAL.test(s)) out.push(findingAt(file, at, { spec: s }));
  };
  new Visitor({
    ImportDeclaration: (n) => hit(n.start, n.source.value),
    ExportAllDeclaration: (n) => hit(n.start, n.source.value),
    ExportNamedDeclaration: (n) => hit(n.start, n.source?.value),
    ImportExpression: (n) => hit(n.start, n.source.type === "Literal" ? n.source.value : undefined),
    CallExpression: (n) => {
      const [a] = n.arguments;
      if (n.callee.type === "Identifier" && n.callee.name === "require" && a?.type === "Literal") hit(n.start, a.value);
    },
  }).visit(ast);
  return out;
}
```

### What is not covered
A computed specifier (`import(name)`, `'@keel/store/' + 'internal'`) is not followed; a deep path without an `internal` segment (`@keel/router/src/createRouter.ts`) is refused by the package's `exports` map at resolution (`moduleResolution: "Bundler"`, `tsconfig.base.json:11`), which `keel check` reports as E1751.

## Alternatives
- **A package.json `exports` condition** (`"./internal": { "keel-kernel": "./src/internal/index.ts" }`), rejected: conditions are set per build, not per importer. Vite and TypeScript resolve `@keel/schema/internal` from `node_modules/@keel/std-jobs` with the same conditions as app code, so the condition that lets stdlib and kernel packages load in an app's bundle lets the app load it too; without it, the app's own build breaks. A failed resolution also has no code, message or fix (principle 5).
- **Package-private `imports` (`#internal`)**, rejected: they resolve inside one package only, and every internal entry is shared across packages (the table above).
- **Widen E1151/E1152 to treat kernel packages as modules with `public.exports`**, rejected: kernel packages have no manifest, and the rule would need one per package to say what a path segment already says.
- **A runtime guard** (`createRouterWith` refusing a `state` in a browser), rejected as the enforcement: it covers one export of seven entries, and the router cannot tell a test process from a browser. It may come later as depth; the static rule is the guard (default 6).
- **Biome `noRestrictedImports` in the scaffold's `biome.json`**, rejected: a second checker with its own config the author can edit, no Keel code or `explain` (default 3).
- **A structure-lint S-code**, rejected: structure-lint runs in this repo only; projects outside it get nothing.
- **A public `@keel/testing` helper to emit ctx events** for the two app tests, rejected: a new user-facing API shape (escalated by WORKFLOW), and a second way to produce events the kernel already produces (default 2).

## Spec diff
k.security, **Rules** paragraph, replacement text:

> **Rules.** E1570 a literal absolute `http(s)` URL in `src`, `poster`, `data`, `srcset`, `action`, `formaction` or `Image src`: the policy blocks another origin (fix: none) · E1571 a literal absolute `http(s)` URL given to `ctx.net.fetch` or `service({ base })` in client-reachable code (E1004's reachability) · E1576 a `@keel/*` internal entry (a specifier with an `internal` path segment) named by an import, re-export, or literal `import()` or `require` in a file outside `packages/`, `node_modules/` and `.keel/`, tests included: internal entries are kernel and stdlib seams such as the server state runner (fix: none).

k.security, **Conformance**, one clause appended after the `csp.txt` clause:

> - `import { serverState } from '@keel/store/internal'` in `modules/a/x.ts`, `import('@keel/router/internal')` in `test/a.test.ts` and `export * from '@keel/std-jobs/tools/internal'` are each one E1576; the first in `packages/std-x/src/a.ts` or `node_modules/@keel/std-x/a.ts`, and `import '@keel/router/match'`, are not.

Token counts (ceil(chars/4), measured on the replaced file): k.security 1,240 before, 1,398 after, 102 tokens left of 1,500. The candidates measured and not used: k.module 1,498 (2 left), k.check 1,495 (5 left), k.compiler 1,500 (0 left), k.router 1,499 (1 left), k.server 1,442 (58 left, too few for the rule and its clause). k.router's "`@keel/router/internal` is not public" stays as written. spec/00-map.md is unchanged: E155x already lists k.security as an owner.

## Conformance diff
Written by the `conformance-writer` from the clauses above. This RFC allows these changes under `packages/*/conformance/**`:
- New: `packages/check/conformance/security-e1576.test.ts`, with the headers
  - `// Spec: k.security, Conformance "`import { serverState } from '@keel/store/internal'` in `modules/a/x.ts`, `import('@keel/router/internal')` in `test/a.test.ts` and `export * from '@keel/std-jobs/tools/internal'` are each one E1576; the first in `packages/std-x/src/a.ts` or `node_modules/@keel/std-x/a.ts`, and `import '@keel/router/match'`, are not."`
  - `// Spec: k.security, Rules "E1576 a `@keel/*` internal entry (a specifier with an `internal` path segment) named by an import, re-export, or literal `import()` or `require` in a file outside `packages/`, `node_modules/` and `.keel/`, tests included: internal entries are kernel and stdlib seams such as the server state runner (fix: none)."`
  - `// Seed: 1337.`

  Cases: the three bad forms of the clause, each exactly one E1576 at the statement; `import type { ServerState } from '@keel/store/internal'`, `require('@keel/ctx/internal')`, `export { report } from '@keel/ctx/internal'`, a deep `@keel/store/src/internal/serverState.ts` and a file under `unsafe/` each one E1576 (Rules line); the clean paths and the public entry none; a property (fast-check, seed 1337) over generated package names and subpath segments: E1576 exactly when a segment after the package is `internal`, and never for a path under `packages/`, `node_modules/` or `.keel/`.
- Changed: `packages/check/conformance/fixtures-by-code.ts` gains `E1576` (bad: `modules/a/x.ts` importing `@keel/store/internal`; clean: the same source at `packages/std-x/src/a.ts`), so the fixture-per-code and explain-per-code tests cover it. `packages/check/conformance/fix-diffs.test.ts` adds `"E1576", // the public replacement is the author's` to its no-fix list.
- Kept green: `packages/router/conformance/internal-subpath.test.ts` and `packages/ctx/conformance/*` import internal entries from under `packages/`, which the rule never reads as app code.
- Ledger: one new k.security clause item, covered by the new file.

## Diagnostics
Taken: E1576 (k.security, block E155x). Free before this RFC: no hit in `packages/*/src`, `packages/*/conformance`, `spec/`, `docs/rfc`, `docs/adr`, `tooling/` or `tasks/`. E1572 to E1575 are reserved by RFC 0085 and not used here.

## Token impact
k.security 1,240 to 1,398 tokens; the map is unchanged. The `explain` row is 57 tokens (ceil(chars/4) of its four fields), under the 120 cap.

Package size (gzip, own code, dependencies external, as `tooling/budgets.mjs` measures, on a copy of `packages/check/src` with the rule above and its explanation row):
- `@keel/check` 48,112 B today against 48,384 B (47.25kb); with the rule 48,482 B, 98 B over. The `require` case is 34 B of it; without it the package is 48,448 B, still over.
- Re-base `@keel/check` to 47.5kb (48,640 B) in `tooling/budgets.json` (the orchestrator's file), reason in the commit: a kernel rule that guards the server-only boundary (default 7). 158 B remain after it.

## Migration
What fires in the repo today, with the rule on:
- `apps/sessions/test/homeRecording.test.ts:9` and `apps/sessions/test/homeOpaque.test.ts:6`: `report` from `@keel/ctx/internal`, used to force a `nav` and an `error` event. Each test produces the events through a kernel producer instead:
  - `homeRecording` (both cases): `renderRoute` over a test route table whose `ops.home` loader (in a `*.server.ts` file under `test/`) returns `err({ code: 'ops.forced', ... })`. The router reports the `nav` and then the loader's `error` (`packages/router/src/internal/createRouterWith.ts:228`, `packages/router/src/internal/runLoaders.ts:48`), which is the "error after the served route, before the page resumes" order the second case asserts. The assertions on `ops.forced` stay.
  - `homeOpaque`: mount, on the same ctx, a test component that throws; the root Boundary reports `keel.unexpected` (`packages/runtime-dom/src/internal/rootCatcher.ts:35`). The assertion changes from `ops.forced` to `keel.unexpected`.
- `packages/std-*` (std-channels, std-jobs, std-offline, std-schedules, std-sessions, their tests) and every kernel package: no finding, by path.
- Scaffold templates, `evals/`, `modules/`, golden-1, golden-2, inspector: no import of an internal entry, nothing to change.
- Projects outside the repo: an app that imports an internal entry fails `keel check` with E1576. No golden app needs a migration; `apps/sessions` is the ops app, and only its tests change.

## Known limits
- Library code is told from app code by path: an app folder named `packages/` is not checked, as for E1207.
- Computed specifiers are not followed (above). E1603 covers code built from strings, not specifiers built from them.
- The rule names entries by an `internal` segment. Kernel-only entries under another name are not covered: `@keel/server/dom` (the generated entries import it) and `@keel/compiler/entry/*` (`@keel/server` imports it); `@keel/runtime-dom/ops` has E1251. Renaming the first two under an `internal` segment would bring them under E1576 with no new rule; the orchestrator may file it.
- A stdlib package may import any kernel internal entry. Which ones it may import is S0003's order in this repo and nothing in a project.
- The rule is static. A bundle built without `keel check` still loads an internal entry.

## Questions
None. The defaults decide each point: 6 (a `keel check` rule instead of the k.router sentence), 5 (server state stays on the server), 3 (the check pipeline, E1251's visitor shape, E1207's path test), 2 (no public event helper beside the kernel's producers) and 7 (the `@keel/check` re-base). No new user-facing API shape, no privacy or auth weakening (the rule closes a path around both), no external integration, and no golden-app migration.
