# RFC 0119: the root fallback shows `keel.unexpected` in production

Status: accepted (orchestrator under the owner's standing leave, 2026-11-17). For backlog 0281 (the production-message part). ADR-0141 records it.

## Problem
The app root's default Boundary, for a `mount` tree and for each island `resume` resumes, renders `<pre data-k-error="<at>">` with the thrown error's message (`packages/runtime-dom/src/internal/rootFallback.ts:7`, `pre.textContent = error.message`), and k.errors says so. That is the page people see in production. A message is whatever a library or the app put in it: an internal path, a query, a token echoed by a parser, a person's data. The server already keeps this out of production: an uncaught throw is 500 `keel.unexpected` with message `unexpected` in production (k.server Status), and docs/THREAT-MODEL's Mode line covers only server error text. The client root fallback has no production mode at all.

The full error has other ways out that stay as they are: the ctx's `error` report (k.ctx) that observers and recorders read, `mount`'s `onError`, and the test harness, which mounts with `onError`.

## Proposal
**`mode`.** `mount(Component, el, { ctx?, onError?, mode? })` and `resume(root, components, { ctx, stores, mode? })` take `mode: 'dev' | 'production'`, the same two values and the same default as `createApp({ mode })` (k.server: `mode` defaults to `production`). It is the one notion of production the spec already has; nothing reads `NODE_ENV` or `import.meta.env` inside `@keel/runtime-dom`.

**Fallback.** In `production` the root fallback is `<pre data-k-error="<at>">keel.unexpected</pre>`: the code as text, `data-k-error` as today. In `dev` it holds the message, as today. The error reported to the ctx and passed to `onError` is unchanged and carries the message. A route's `errorElement` and an app `Boundary`'s `fallback` are app code and get the full error, as today.

**Entries.** The generated client entry (`packages/compiler/src/internal/entryCode.ts`) calls `mount(router.App, el, { ctx, mode })` and the generated resume entry (`packages/compiler/src/entry/resumeEntry.ts`) calls `resume(document.body, components, { ctx, stores, mode })`, with `const mode = import.meta.env?.DEV === true ? "dev" : "production";`. A dev build (`keel dev`, Vite serve) is `dev`; a `keel build` bundle is `production`; an entry that reaches a browser unbundled has no `import.meta.env` and is `production`. The client entry already branches on `import.meta.env.DEV` for the inspect reporter; this is the same test.

**Harness.** `@keel/testing` mounts without `mode`, so a rendered test sees the production fallback; it reads errors through `onError`, which is unchanged.

## Alternatives
- Read `import.meta.env.DEV` inside `@keel/runtime-dom`: ties the kernel package to Vite, and conformance could not drive both modes in one run.
- Default `dev`, production opt-in: a direct `mount` caller that forgets the option leaks the message; the server defaults to production for the same reason.
- An empty fallback in production: a person sees nothing where the tree was; the code says something failed and is stable text for support.
- A per-app fallback component for the root: a new extension point; a route's `errorElement` already serves that need for routed apps.

## Spec diff
k.errors (before 5,967 characters, 1,492 tokens; after 5,997 characters, 1,500 tokens). To pay for the change, three API bullets are tightened with their meaning kept ("there are no `map`/`unwrap` helpers" to "no `map` or `unwrap`"; "a plain serializable object" to "a serializable"; "E-codes are diagnostics" to "E-codes diagnostics"), and the Boundaries paragraph drops "anywhere" before "in its subtree". Whole new text of each changed paragraph:

API bullets 1 to 3:
```
- `Result<T, E>` is `{ ok: true, value: T } | { ok: false, error: E }`. `ok` and `err` are its only constructors; no `map` or `unwrap`: narrow on `r.ok`. `s.result(T, E)` is its schema (codec for loaders, actions, services).
- `KeelError<C, D>` is a serializable `{ code: C, message: string, data: D }`. `code` is a dotted string literal; app codes start with the module id (E1155). `s.error(code, data)` declares one; `.make(data, message?)` builds one (message defaults to the code).
- Kernel codes: `keel.unexpected`, `keel.notFound`, `keel.denied`, `keel.fields` (k.forms), `keel.payloadTooLarge`, `keel.conflict`, `keel.unreachable` and `keel.busy` (k.server), `schema.invalid` (`SchemaError`, data `{ issues: { path, rule }[] }`), `api.*` (k.services). KeelError codes are data, E-codes diagnostics; they never share a namespace.
```

Boundaries:
```
`Boundary` (from `@keel/runtime-dom`) catches throws from render, `computed`, `effect`, and event handlers (including rejections of promises they return) in its subtree. The nearest boundary wins. On catch the subtree's scope is disposed and `fallback` renders with a `KeelError<'keel.unexpected'>` whose `data.at` is the element id where the throw surfaced; `reset()` re-renders the children in a fresh scope. Every route is a boundary whose fallback is its `errorElement`; the app root has a default one, for a `mount` tree and for each island `resume` resumes: it catches what any Boundary catches, reports the error to the ctx (k.ctx `error`) and renders `<pre data-k-error="<at>">` holding `keel.unexpected` (`mode: 'dev'`: the message) in place of that tree or island (a throw while `resume` claims an island is a mismatch, k.runtime E1253). A throw at no element of its own (the root component's own `effect`, `computed` or render) has `data.at` the `data-k` at the root's place (the `mount` element, the island's parent), else `""`. A handler's throw has `data.at` an id the compiler wrote: the id `on` registered it under, else the `data-k` of its element or of the nearest ancestor with a non-empty one (the compiler stamps a bound template element's id, and a bound k.ui base element's literal `id`), else `""`; an `id` set at runtime never is, and the `attr` op never sets `data-k`. A `resource` fetcher failure is its `error` state, not a throw (k.reactive). A transaction that throws leaves state and log unchanged.
```

Conformance bullet 9 (changed):
```
- After `resume`, an island whose handler throws reports one `keel.unexpected` with that element's id as `data.at` to an observer and renders the root fallback, holding only `keel.unexpected`, in place of the island; the page's other islands keep handling events; under `mount` the same throw reports the same error.
```

k.runtime (before 5,988 characters, 1,497 tokens; after 5,992 characters, 1,498 tokens). To pay for the change: the Islands paragraph's sentence "The compiler writes `data-k="<elementId>"` into the template of each bound element." folds into the first server bullet; "`keel.unexpected`" leaves the `onError` sentence (the root Boundary renders no other code); and "live" to "are", "directly", "immediately" to "right", "as an island" to "an island", "the island root element" to "its root element" and the E1253 sentence's tail are tightened with their meaning kept. Whole new text of each changed paragraph:

API (second paragraph line):
```
`mount(Component, el, { ctx?, onError?, mode? })` (generated entry only; the root takes no props) renders a client-only tree into `el`, passing `ctx` as the root component's third argument, and returns `dispose`. `onError` also gets each error the default root Boundary renders. Server-rendered apps never call it; their entry calls `resume` (`@keel/runtime-dom/ops`), which passes `ctx` to every island root. Both take `mode` (k.errors): `'dev'` in a dev build, else `'production'`.
```

Events:
```
**Events.** Delegated: one listener per event type at the mount or island root. Handlers are in a table keyed by element id (k.component). Dispatch walks from the target to the root, calling each handler on the path innermost first, until `stopPropagation`. Non-bubbling events (`focus`, `blur`, `mouseenter`, `mouseleave`, `scroll`, `load`, `error`, `cancel`, `close`) bind on the element.
```

Islands and resume, the lead and the first and third server bullets:
```
**Islands and resume.** The compiler marks a component instance an island when its subtree has an event handler, an `effect`, or a read of client-writable state; everything else is static HTML and ships no JS. Marking is static and best effort by name within a file: an element is bound when it has an `on` binding or a binding whose expression reads a `signal`, `computed`, or `resource` declared in the file or calls `.get`/`.select`; every root element of a component that calls `effect` is bound. The server emits:
- `data-k="<elementId>"` on every bound element, from its template;
- `<script type="module" src="/@keel/entry.ts">` only when the page has an island: the generated resume entry. It imports `components` (by route id; best effort) from `/@keel/islands.ts` and calls `resume(document.body, components, { ctx, stores, mode })` with a real `ctx`;
```

Resume markup:
```
**Resume markup.** The server wraps each structural op's content (`If`, `For`, `Match`, `Boundary`) in `<!--[-->` … `<!--]-->`, right before the op's anchor; regions nest. At resume the island's first template claims its root element, and each op claims the elements of its region in order (rows of a `For` in list order); a template slot `<!--+-->` holds one element, which its component claims; `element` claims the next element, and its `fill` claims the children; claimed nodes are kept, and later content is inserted before the closing marker. Tags and structure must match the compiled templates; text and comments are not compared. A missing marker, a missing or extra element, or a slot without its element is a mismatch (E1253): that island re-renders on the client in place of the server element, dropping its queued events.
```

Conformance bullet 8 (changed):
```
- `mount` `onError` receives the error the root boundary rendered; its fallback shows the message only with `mode: 'dev'`.
```

## Conformance diff
One `rfc:0119` commit by the `conformance-writer`:
- `packages/runtime-dom/conformance/mount-onerror.test.ts:4`: header quotes k.runtime Conformance 8; update to the new text. `:30` and `:59` assert `pre.textContent` equals `seen[0]?.message`; without `mode` they assert `"keel.unexpected"` and that the text does not contain the message, and a new case in the same file mounts with `mode: "dev"` and asserts the message.
- `packages/runtime-dom/conformance/resume-root-catcher.test.ts:2`: header quotes k.errors Conformance 9; update to the new text. `:82` and `:141` assert `"boom"`; they assert `"keel.unexpected"` (no `mode`), and `:79` keeps asserting the observer's `err.message` is `"boom"`.
- `packages/runtime-dom/conformance/resume-root-effect.test.ts:77` asserts `"fx1"`; it asserts `"keel.unexpected"` (no `mode`), and `:72` keeps asserting the observer's message.
- `packages/server/conformance/resume-entry.test.ts:3`: header comment quotes `resume(document.body, components, { ctx, stores })`; update to `{ ctx, stores, mode }`. Its assertions (`:79-80`) are unchanged.
- New `packages/compiler/conformance/entry-mode.test.ts`, citing k.runtime API: the generated client entry passes `mode` to `mount` and the resume entry passes it to `resume`; evaluated with `import.meta.env.DEV` true the value is `"dev"`, else `"production"`.

## Migration
An app sees `keel.unexpected` in place of the message in its production root fallback; dev is unchanged. A direct caller of `mount` or `resume` (a test) that reads the fallback's text passes `mode: "dev"` or reads `onError` or the ctx report. In this repo, tests that read the root fallback's text: `packages/runtime-dom/test/boundary-effects.test.ts:133-138,164`, `listEdges.test.ts:135`, `matchReport.test.ts:183`, `resumeBoundary.test.ts:99,139`, `resumeIslandTeardown.test.ts:61,85`, `resumeRootCatcher.test.ts:89,132,151,211`, and `packages/std-sessions/test/resume-record.test.ts:62`.

## Build order
1. Orchestrator: `spec/kernel/k.errors.md`, `spec/kernel/k.runtime.md` (applied with this RFC). The `conformance-writer`: the conformance diff.
2. Lane A (runtime-dom) owns `packages/runtime-dom/src/mount.ts`, `src/ops/resume.ts`, `src/internal/rootFallback.ts`, `src/internal/rootCatcher.ts` and the options types they take, `packages/runtime-dom/test/**`, `packages/runtime-dom/README.md`, `packages/std-sessions/test/resume-record.test.ts`, and a changeset (`@keel/runtime-dom` minor: a new option and a changed default fallback). It runs `check`, the runtime-dom suite once, and `pnpm budgets`.
3. Lane B (compiler), after lane A: `packages/compiler/src/internal/entryCode.ts`, `packages/compiler/src/entry/resumeEntry.ts`, `packages/compiler/test/**` (entry text snapshots), and a changeset (`@keel/compiler` patch). It runs the compiler and server suites once and the testing suite once (the harness sees the production fallback).
4. Orchestrator: `docs/THREAT-MODEL.md` Mode line, from "Servers default to production; dev serves inspect and error text." to "Servers and the client root fallback (`mount`, `resume`) default to production; dev serves inspect and error text, and only dev's root fallback shows an error's message." Then ledger, backlog 0281 narrowed to its other leads, HANDOFF.

## Token impact
k.errors 1,492 to 1,500 tokens (5,967 to 5,997 characters); k.runtime 1,497 to 1,498 tokens (5,988 to 5,992 characters). No other section changes.

## Choices
- C1: `mode: 'dev' | 'production'` with default `production`, the values and default of `createApp`'s `mode`, not a new flag.
- C2: the production text is the code `keel.unexpected`, not empty and not `unexpected` (the server's message): the element holds a code, and k.errors names codes as the stable data.
- C3: the entries compute `mode` from `import.meta.env?.DEV`, so the unbundled resume text is production.
- C4: the test harness passes no `mode`; tests see what production shows and read errors from `onError`.
- C5: the new conformance requirements fold into the two existing bullets whose files change anyway (k.errors 9, k.runtime 8) instead of new bullets, to fit both sections at 1,500 tokens.
