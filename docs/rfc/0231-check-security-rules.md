# RFC 0231: check security rules: what each rule sees through, and what it refuses

Status: accepted (ADR-0253), by the orchestrator on 2026-11-25, to be confirmed by the operator. Amends k.boundary (Ambient types, Following, Rules, Conformance), k.bundle (Types, one bullet), k.leave (E1107), k.privacy-reads (Readers, Held), k.schema (Frozen), k.formats (Literals, E1108's message), k.origins (Rules), k.security (E1571's message), k.scaffold (Links, Rules) and k.shell (Files, one reference). From fix lane 07 of the weakness triage (`tasks/p1/weaknesses.md`).

## Decisions
- D1: E1014 (new): a `/// <reference …/>` directive in project code, or a declaration of the global `ImportMeta` or `ImportMetaEnv` in a loaded file other than TypeScript's lib, `@types/node` and `@keel/compiler/client`. `import.meta.env` is typed by Keel's declaration alone.
- D2: E1107 judges on k.boundary Reach, which it now shares. It also reports a state schema it cannot read, a `stores()` call in client-reachable code, and `store`/`stores` used other than as a call.
- D3: one way to follow a specifier (k.boundary Following): k.bundle Aliases' resolution, for Reach and for k.origins. A template `import()` with a relative head is expanded as Vite expands it. E1015 (new): a relative specifier in non-test project code that resolves outside the project root.
- D4: the schema read follows a literal binding only while it is *held*: every reference to it in the checked files is one the read takes. Every schema `@keel/schema` makes, and `s`, are frozen, so a schema value needs no such rule.
- D5: E1108 consults the registry only for a format declared by a `@keel/std-*` package in `deps`. Any other declaring package is never registered, so the answer does not depend on what the process imported.
- D6: E1571's message is `absolute URL fetched from client code; its origin is not declared under connect` (79 units).
- D7: k.scaffold Links states the link rule behind E1357 and E1585, and refuses an existing file with more than one hard link.
- D8: E1570 and E1571 state their limit: a URL they cannot read is not reported, and the policy blocks it at run time.

## Problem
`keel check` is the gate. A wrong program must not pass it, and a rule must not report what is not there. Seven lines from the triage show rules that pass shapes a reviewer can write in a minute, or whose boundary no sentence states:

| line | what passes or is unclear today |
|-|-|
| 0975 | `mutatedBinding` (`packages/check/src/internal/mutatedBinding.ts`) catches `p.x = …`, `delete`, and `Object.assign(p, …)` written as a member call, by spelling. It misses `const q = p; q.x = …`, `const { assign } = Object; assign(p, …)`, `f(p)` where `f` mutates its parameter, and a change in another file that imports `p`. Every one of them passes E1111. |
| 0884 | `/// <reference types="vite/client" />` passes. Vite's `ImportMeta` adds `glob` and `hot`, and k.bundle names the reference as allowed. |
| 0880 | E1107 walks its own reach (`moduleChecks.ts` `clientPii`): `.tsx`/`.jsx` entries and relative imports only. A plain `.ts` file of a `node` module, `import * as k` with `k.store`, a re-exported `store`, a factory schema and `stores()` all pass. |
| 0994 | `declaredFor` (`packages/compiler/src/hosting/declaredFor.ts`) builds its importer graph from relative specifiers only. A file outside `modules/` that a non-declaring module imports by the project's own name is judged against the declaring module only. |
| 1101 | `judgeFormat` limits a format to its scope only when its owner is a `@keel/std-*` package. A format whose owner is `null`, or a kernel package (`@keel/server`'s `keel.*`), is judged against every format the process has registered. So an editor can accept what a fresh `keel check` refuses. |
| 1099 | E1571's message `… the policy allows this origin only` can be read as naming the fetched origin. |
| 0995 | `linkEscapes` (`packages/cli/src/internal/linkEscapes.ts`), behind E1357 and E1585, has no unit or property test. No sentence states what it judges. A hard link is not judged. |

## Proposal
### Builder's work, no spec change
- **0994.** k.origins Rules already says "on each deployable listing the module that holds the file or a file importing it, directly or not", with no word limiting it to relative imports, and `declaredFor` breaks that sentence. Expected: `declaredFor` builds its importer edges with the resolver k.boundary Following names, the one `keel check` uses for E1013 (k.bundle Aliases): a relative specifier, the project's own name with `exports`, a workspace link or a `node_modules` symlink whose real path is a project file. The query is stripped, value imports and re-exports count, and so does a literal or relative-template `import()`. `Image src="https://a.example/x.png"` in `lib/pic.tsx`, imported by `a` as `../../lib/pic.tsx` and by `b` as `p/lib/pic.tsx`, with only `a`'s deployable declaring it, is one E1570. The k.origins bullet added here pins it. The new sentence that points Importing at Following only names the resolver; the behaviour was already required.
- **0995.** No behaviour change for symbolic links. `linkEscapes` gains a unit file and a property test (`packages/cli/test/linkEscapes.test.ts`) with these cases: a sibling whose name has the root as a prefix (`proj`, `proj-evil`), a link to an ancestor of the root, a chain of links, a dangling intermediate folder, a link that resolves back inside, a root reached through a link (macOS `/tmp`), and a root that is not a real path, for which it returns true for everything. Assert that `applyWrites` and `shellTargets` each pass a real path (k.scaffold Links: "judged against the real path of the project root"). The hard-link refusal is a spec change, under Links below.

### Ambient types (0884): E1014
The triage decided this one: forbid the reference, and type `import.meta.env` through Keel's declaration. `@keel/compiler/client` already declares the five keys (k.bundle Types). A reference adds a second declaration of the same globals. The rule therefore looks at the globals, wherever they come from:
- **The directive.** `/// <reference types|path|lib|no-default-lib …/>` in a project code file (E1576's files: outside `packages/`, `node_modules/`, `.keel/`), tests included. At the directive: `type reference in project code; import.meta.env and import types are Keel's` (75 units). The fix deletes the line. One way: TypeScript's `types` belong to Keel's type pass, not to the app.
- **The declaration.** After the type pass has built its program, the checker asks for the declarations of the global symbols `ImportMeta` and `ImportMetaEnv`. Every declaration in a file other than TypeScript's lib files, `@types/node` and `@keel/compiler/client` is E1014, once per declaring file. When that file is a project file, the finding sits at its first such declaration. When it is a package file, the finding sits at the first import, in path order then position, of a project file through which the program loads it. This catches `import 'vite/client'`, `import type {} from 'vite/client'`, a project `declare global`, and a package whose types augment `ImportMeta`. Message: `<file> declares import.meta types; they are Keel's and Node's only`, 60 units without `<file>`, with `<file>` cut from its front. No fix.
- **Not reported.** `vitest` and `vite`'s main types declare neither global (checked against vite 8.3.6 and vitest 4.1.12), so a test file importing them, or `@keel/testing`, is clean. A file under `packages/` (`@keel/std-money`'s `/// <reference lib="es2023.intl" />`) is outside E1576's files.
- **Soundness boundary.** After E1014, `import.meta` carries TypeScript's lib, Node's members (`url`, `dirname`, `filename`, `resolve`, `main`) and Keel's `env`. `import.meta.glob` and `import.meta.hot` are type errors (E1751). Node's members type-check in browser code: that comes from `@types/node`, which k.check Pipeline loads, and this RFC does not change it.
- `keel explain E1014`: `E1014 a type reference, or an import.meta declaration not Keel's` / `A browser build's import.meta.env holds BASE_URL, MODE, DEV, PROD and SSR (k.boundary Environment); @keel/compiler/client types exactly those. Another declaration (vite/client, a declare global) types keys the build never holds.` / `delete the reference; read config through clientStd`.

### Following (0994's resolver for Reach; files outside the project): E1015
- Reach followed relative specifiers only. Now it follows every specifier that k.bundle Aliases resolves to a project file. A file reached by the project's own name or a workspace link is in reach, as it is in the bundle. A specifier resolving under `node_modules/` or outside the project is a package's: it is not followed, and E1007 holds at build.
- `` import(`./pages/${n}.ts`) ``: Vite's dynamic-import-vars expands a template whose head is relative into a glob, one `*` per substitution within one path segment. Reach expands it the same way. Any other non-literal `import()` stays W1608, reaches nothing in check, and leaves E1007 at build.
- **E1015.** A relative specifier in a non-test project code file that resolves to a file outside the project root. `keel check` reads only the project's files (k.check Pipeline `project`), so every rule here would pass such a file unseen. A refusal is better than that silent pass. Message: `'<specifier>' resolves outside the project; check reads only its files` (59 units without the specifier, cut from its front). No fix: the remedy is to make the code a package. A survey of `apps/*` and `examples/*` found no such import. Test files are exempt, because nothing of theirs ships.
- `keel explain E1015`: `E1015 a relative specifier resolving outside the project` / `keel check reads the project's files only, so no rule (E1004, E1107, E1111, E1571) follows that file.` / `move the file into the project, or publish it as a workspace package`.

### E1107 (0880)
The full clause is in k.leave E1107. What it settles:
- **Reach.** Every `store` call in a client-reachable file of a `node` or `static` module. A `client` module writes no `#k-state` and is not judged. A file outside every module is judged against the `clientPii` of each module whose files import it, and its fix applies only when one manifest lacks the classes.
- **Callee.** `store` is found under any local name, as `ns.store`, through a `const` alias, or through a project re-export, as `followRef` follows them. Any other use (passed as a value, destructured from a namespace, a computed member) is E1107: `<name> of @keel/store used other than as a call; check cannot follow it`.
- **Unreadable.** A state schema that `schemaHolds` answers `'unknown'` for is E1107: `store state not readable statically; cannot show its .pii() classes` (67). So is a `.pii()` with a non-literal class. Today the call is skipped.
- **`stores()`.** An island root that calls it puts every live request store in `#k-state` (k.leave Snapshots), a loader's among them, so no static read can bound the classes: `stores() in client code can send every request store to #k-state` (64). No app or example calls it.
- **Soundness boundary.** A store a package creates is the package's, as E1111 treats a package's tables.

### The schema read (0975): Held, and frozen schemas
A deny-list of mutating shapes cannot be complete: any function that receives the object can change it. The read now works from an allow-list of uses:
- **Literal bindings** (k.privacy-reads Held). A top-level `const` bound to an object or array literal is read only while every reference to it, by lexical scope, in every checked file, is a reference the read takes: a field, spread, element, `?:` branch, argument of `s.<name>(…)`, member read in those places, export, held alias, or type. Any other reference, including one in another file or one that goes through the file's namespace object or `import()`, answers `'unknown'`. For E1111 that is the existing `route <part> not readable statically; cannot show it holds no .pii()`.
- **Schema values** (k.schema Frozen). `make` freezes the schema object and its `node` deep, and `s` is frozen at load. A change after construction then throws a `TypeError` in module code. A schema value can therefore go anywhere (`store(S, …)`, `form(S, …)`) without making the read unsound.
- `mutatedBinding.ts` goes. The Held walk replaces it, and the walk is scope-aware, where the old check matched by spelling.
- A `let`, `var` or function-local binding is not followed. That was already true in `followRef`; a bullet now pins it.
- **Soundness boundary.** A file outside the checked files is not read. With E1015 that leaves `node_modules/`, and a package cannot import an app file by a relative path.

### E1108 (1101)
k.check-cache already promises that "nothing an earlier call parsed, loaded or registered changes a later call's answer". `judgeFormat` breaks that for owners other than `@keel/std-*`. Two fixes were possible: make the registry attribute each name to a package, or consult it only where attribution already exists. This RFC takes the second. The declaring package of the `format` value comes from the type checker (`ownerOf` of its declaration file). Only a `@keel/std-*` package listed in `deps` is consulted. Any other owner (a kernel package such as `@keel/server`, the app, `null`) answers "not one registered format", or, for `null`, `formatLiteral format's package cannot be told; write the format as its import` (77). Kernel formats (`keel.*`) are internal (E1576 refuses their entries), so no app writes a literal of one. The spec text is in k.formats Literals.

### E1571's message (1099)
`absolute URL fetched from client code; its origin is not declared under connect` (79 units). It names the fault and the key that fixes it, and it cannot be read as naming the page's own origin.

### E1570 and E1571 boundary
They read a literal, a template head, the left side of `+`, `new URL` and `new Request`, through `const`s and imports (`urlText`). A URL computed any other way is not reported. No refusal rule is added. These rules move a failure earlier; they are not the defence. The policy blocks an undeclared origin at run time and reports it (k.security Reports). A refusal of every computed URL would report correct programs (a same-origin path built at run time).

### Links (0995, E1357, E1585)
k.scaffold Links states what `linkEscapes` judges. It adds one refusal: an existing target with a link count above 1. `writeFileSync` truncates in place, so writing to a hard link to an outside file changes that file. Git cannot carry a hard link, so only a local actor can plant one. Reading `nlink` costs one `stat` the write already makes. The limit is stated: the judgement happens once, before the writes, so a link made in between is followed.

## Alternatives
- **0884: name the reference as the way to type `import.meta.env`.** Rejected: that is two ways, and Vite's types promise `glob`, `hot` and an open `env` that no Keel build keeps.
- **0884: refuse only `types="vite/client"`.** Rejected: a `declare global` or an `import 'vite/client'` does the same. The rule looks at the globals.
- **0975: extend the deny-list** (aliases, destructured mutators, calls). Rejected: any function can mutate its argument, so the list never ends.
- **0975: freeze schemas alone.** Not enough: a shape literal can be changed before `s.object(shape)` reads it.
- **1101: attribute registrations by diffing the registry around each `importDeps` import.** Rejected: a package the caller imported first shows no diff, so attribution would depend on import order.
- **E1570/E1571: refuse URLs the check cannot read.** Rejected above: the policy is the enforcement, and a refusal would report same-origin computed paths.
- **E1107: judge every `store` call, server-only ones too.** Rejected: a loader's store reaches `#k-state` only through `stores()`, which is now reported itself.
- **New codes for E1107's and E1111's unreadable cases.** Rejected: E1111 already carries its unread case under its own code, and one code per sink keeps `keel explain` short.

## Spec diff
Applied in this commit. Each amended section reads `implemented` until its conformance and build land: k.boundary, k.bundle, k.leave, k.privacy-reads, k.schema, k.formats, k.origins, k.security and k.scaffold, as in the map. k.shell changes one phrase to a reference and stays `conformance-covered`.
- k.boundary: **Ambient types** (E1014), **Following** (E1015), Reach now covers E1107, Rules gains E1014 and E1015, and four Conformance bullets are added.
- k.bundle: the Types sentence on references points at E1014. Its bullet on `import.meta.env.VITE_X` now reads one E1014 and the same E1751, because the behaviour changed.
- k.leave: the E1107 sentence in Snapshots moves to a paragraph of its own, **E1107**, and three bullets are added.
- k.privacy-reads: schemaHolds says "a literal binding that is not held (Held)", **Held** is added, and two bullets.
- k.schema: **Frozen**, and one bullet.
- k.formats: Literals says which registrations count, E1108 gains one message, and one bullet.
- k.origins: Rules gains the Following reference and the read-and-policy limit, and one bullet.
- k.security: E1571's message.
- k.scaffold: **Links**, the Rules entry for E1357, and one bullet. k.shell Files points at Links.
- No section passes 3,110 tokens (`ok budgets`). The map changes status words only. k.check is untouched. No glossary term is added.

## Conformance diff
Written by the `conformance-writer` from the spec text.
- `packages/check/conformance/boundary-E1014-ambient.test.ts`: k.boundary bullets 9 and 10.
- `packages/check/conformance/boundary-E1015-outside.test.ts`: k.boundary bullet 11.
- `packages/check/conformance/boundary-following.test.ts`: k.boundary bullet 12.
- `packages/check/conformance/bundle-types.test.ts`: the changed k.bundle bullet. Its REF cases now also expect one E1014.
- `packages/check/conformance/leave-E1107-reach.test.ts`: k.leave bullets 11 to 13.
- `packages/check/conformance/privacy-reads-held.test.ts`: k.privacy-reads bullets 5 and 6.
- `packages/schema/conformance/schema-frozen.test.ts`: the k.schema bullet.
- `packages/check/conformance/formats-E1108-owner.test.ts`: the k.formats bullet.
- `packages/check/conformance/origins-following.test.ts`: the k.origins bullet.
- `packages/cli/conformance/scaffold-links.test.ts`: the k.scaffold bullet.
- `fixtures-by-code.ts` and `fix-diffs.test.ts`: fixtures for E1014 (with its fix) and E1015.
- Existing cases: `packages/cli/conformance/boundary-env.test.ts`, `build-production-mode.test.ts` and `bundle-support.ts` type `import.meta.env` with `/// <reference types="vite/client" />`, and E1014 now stops their `keel check` and `keel build`. They read keys through `Reflect.get(import.meta.env, …)` and `Object.keys`, which Keel's declaration types, so the writer drops `REF`. The test for E1571's message quotes the new text.

## Migration
None. No app is released. The build fixes any app or fixture the new errors report.

## Token impact
- Spec: k.boundary grows by about 945 tokens to about 2,685, k.leave by about 610 to about 2,010, k.privacy-reads by about 605 to about 1,680, k.schema by about 145, k.formats by about 290, k.origins by about 175, and k.scaffold by about 270 to about 2,555. k.bundle and k.shell stay level. k.check is unchanged. Every section stays under 3,110.
- `keel explain`: two catalog entries (E1014, E1015), each under budget.
- `@keel/check`: one Held walk replaces `mutatedBinding`, one global-declaration query sits on the existing program, and the reach is shared rather than duplicated. Measure the size in the build against the `@keel/check` budget.

## Build plan
1. This commit: the RFC, ADR-0253 and the spec text.
2. The `conformance-writer` writes the cases above.
3. The build:
- `packages/check/src/internal/schemaRead.ts` with a new `held.ts`; delete `mutatedBinding.ts`.
- `packages/schema/src/internal/make.ts`, `s.ts`: freeze the node and the schema, and `s`.
- `packages/check/src/internal/modules/moduleChecks.ts`: `clientPii` moves onto `isClientReachable`, with callee following and the three new E1107 findings.
- `packages/compiler/src/internal/clientReach.ts` and `packages/compiler/src/hosting/declaredFor.ts`: one resolver (k.bundle Aliases') and template `import()`.
- A new rule for E1015.
- `packages/check/src/internal/typeCheck.ts`: E1014, the directive scan plus the global-declaration query.
- `judgeFormat.ts`: scope by owner.
- `foreignUrlFetch.ts`: the message.
- `packages/cli/src/internal/linkEscapes.ts`: `nlink`, plus its unit and property tests.
- `PIPELINE_CODES.ts`, `EXPLANATIONS.ts`.
- Docs: the `keel` and `keel-compliance` skills' code lists, the `@keel/check` README, a changeset, and `tasks/BACKLOG.md` (0975, 0884, 0880, 0994, 1101, 1099, 0995).

## For the operator
1. **E1014 also covers an `import.meta` declaration, not only the directive.** Recommended: yes. Otherwise `import 'vite/client'` does what the reference did.
2. **E1015 refuses a relative import that leaves the project.** Recommended: yes. Check cannot read the target, and nothing in the tree does this today.
3. **E1107 reports a `stores()` call in client-reachable code, and any store schema it cannot read.** Recommended: yes. Both are silent passes today.
4. **Schemas are frozen at run time.** Recommended: yes. It makes the static read sound for schema values, and no package mutates a node.
5. **A hard-linked target refuses a write (E1357, E1585).** Recommended: yes. It is cheap, and the truncating write would otherwise reach outside the project.
6. **E1570 and E1571 get no refusal of unreadable URLs.** Recommended: yes. The policy is the enforcement, and the limit is stated in k.origins.
