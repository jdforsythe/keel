# RFC 0075: a resumed island has the app root's Boundary; intrinsic calls keep their import

Status: accepted (ADR-0064, 2026-11-09). Found by the S1 exit drill. Applies WORKFLOW RFC default 1 (a stdlib need that exposes a kernel gap is met by a kernel change, not a workaround) and default 2 (one way). It restores the k.errors sentence "the app root has a default one" for server-rendered pages, where the app root is the set of resumed islands, and makes it explicit for `resume`. No app-facing API changes.

## Problem
1. **Resumed islands had no root catcher.** `resumeIsland` created the island owner with no catcher, so a throw from a binding or event handler reached `report` with no Boundary and was rethrown: an uncaught page error. Nothing reported it to the ctx, so no observer, and no session recorder, saw it. `mount` wraps its tree in a root Boundary that reports and renders `<pre data-k-error>`; `resume` did not, although k.errors says the app root has a default Boundary.
2. **`data.at` of a handler throw was often empty.** `on(target: Element, …)` (k.ui base elements) took `target.id` at registration, before the element's id is set, so a handler's throw had `data.at` `""` under `mount` and `resume` alike. The session fingerprint hashes `data.at`, so every handler error on a page shared one fingerprint.
3. **The compiler stripped referenced intrinsic imports.** `lowerFile` removed any `@keel/runtime-dom` import made only of intrinsics, even when the file called them as functions, so a plain `.ts` module calling `If(...)` or `Boundary(...)` failed in the browser with "If is not defined".

## Proposal
### 1. The island root Boundary (k.errors)
Each island `resume` resumes gets the root Boundary `mount` gives its tree (`internal/rootCatcher.ts`), installed as the island owner's catcher. It is armed once the island's claim succeeds: until then a throw passes through as before, so a claim that throws stays a mismatch (E1253) and the island re-renders on the client. On the client re-render path the catcher is armed before rendering, so a throw there renders the fallback in place of the server element instead of escaping `resume`. Once armed, the first throw:
- becomes `keel.unexpected` with `data.at` (`toUnexpected`, as a Boundary does);
- is reported to the ctx as an `error` event (k.ctx Observers), so the ctx keeps it for a late observer (RFC 0074);
- tears the island down (owner, scope, delegation root) and replaces it with the root fallback `<pre data-k-error="<at>">` holding the message, the same node `mount`'s root Boundary renders.
Later throws under the same island are ignored. Other islands have their own owners and catchers and keep working. Every resume entry goes through `resumeIsland`: ui-only island roots, islands with eager children (the E1253 client re-render path), and node and static deployables alike. `mount` is unchanged and still calls `onError`; `resume` has no `onError` option.

### 2. `data.at` of a handler throw
A handler's throw carries the id it was registered under, else its element's id at the time it throws (`id`, else `data-k`, else the nearest ancestor's, `idOf`). Delegated dispatch and non-bubbling listeners resolve it the same way, under `mount` and `resume` alike, so one page's handler errors fingerprint apart. Binding throws keep the id their op passes.

### 3. Intrinsic calls keep their import (k.component)
Decision: supported. Intrinsics are runtime functions (`If` is the `cond` op wrapper), and a file without JSX has no other way to use them; k.ui base elements are already called as functions in plain `.ts` modules (apps/sessions `Home`). JSX stays the way in `.tsx`, where the compiler lowers the tags to ops. The compiler removes a `@keel/runtime-dom` import only when every binding it imports is an intrinsic used solely as a JSX tag (`a.identsByName` has no value reference to it); a binding called or passed as a value keeps the import. E1251 (`noRuntimeOpImport`) is unchanged: it forbids `@keel/runtime-dom/ops`, and intrinsics come from `@keel/runtime-dom`, which app code may import (k.runtime API).

## Alternatives
- **Wrap each island in a `boundary` op at resume.** The op claims a `<!--[-->` region the server does not emit around an island root, so every island would mismatch.
- **Report but do not render a fallback.** Leaves a dead island looking live, and differs from `mount`.
- **Arm the catcher before the claim.** A binding throwing during the claim would render the fallback instead of re-rendering the island on the client (E1253), changing mismatch recovery.
- **Forbid intrinsic calls with a check rule (item 3).** A plain `.ts` module would lose conditionals and Boundaries altogether, while base elements are called as functions there; it would be the more restrictive one way for no gain.

## Spec diff
- **k.errors** (922 -> 1,071 printed). **Boundaries**: "the app root has a default one" becomes "the app root has a default one, for a `mount` tree and for each island `resume` resumes: it reports the error to the ctx (k.ctx `error`) and renders `<pre data-k-error=\"<at>\">` with the message in place of that tree or island. A handler's throw has `data.at` its element's id (`id`, else `data-k`, else the nearest ancestor's) when it throws." **Conformance**: "After `resume`, an island whose handler throws reports one `keel.unexpected` with that element's id as `data.at` to an observer and renders the root fallback in place of the island; the page's other islands keep handling events; under `mount` the same throw reports the same error."
- **k.component** (663 -> 773). **Control flow**: "A file without JSX calls them as functions with the same props (`If({ when, children: () => node })`); the compiler removes a `@keel/runtime-dom` import only when every binding it imports is used solely as a JSX tag." **Conformance**: "A plain `.ts` module calling `If` and `Boundary` imported from `@keel/runtime-dom` compiles with that import kept and renders the chosen branch; a `.tsx` module using them only as tags compiles with the import removed."
- k.runtime is unchanged (1,493), so nothing is trimmed.

## Conformance diff
- Added `packages/runtime-dom/conformance/resume-root-catcher.test.ts` and `packages/compiler/conformance/intrinsic-call-import.test.ts`.

## Tests
- `packages/std-sessions/test/resume-record.test.ts`: createApp serves a page, its island resumes with the page's ctx and starts the recorder, a click handler throws; the fallback shows, and the session is recorded and uploaded once (a second click uploads nothing).
- `apps/sessions/test/resumeRecording.test.ts`: the same on the service's own deployable with a fixture page of its own, and the uploaded session is accepted by the service's `sessions.ingest`.

## Migration
None. An app whose resumed island threw got an uncaught page error before and gets the root fallback and an `error` event now. No golden app test depends on an uncaught resume error.

## Size
`@keel/runtime-dom` (root entry, the budgeted one) 4,067 B gzip, up from 4,062 B, within 6 kB. `resume` lives in `./ops`, which has no budget of its own.

## Known limits
- A throw during an island's claim is still a mismatch, not an error: the island re-renders on the client, and a throw there renders the fallback.
- A resumed island has no `onError` hook; observers on the ctx see its errors.
