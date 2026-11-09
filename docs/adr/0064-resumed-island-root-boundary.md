# ADR-0064: a resumed island has the app root's Boundary; intrinsic calls keep their import (RFC 0075)

**Status:** accepted (2026-11-09), under the WORKFLOW RFC defaults 1, 2 and 4; amended the same day after review and red team (backlog 0278-0280). Found by the S1 exit drill.

**Context.** A throw in a resumed island's binding or handler had no Boundary: it became an uncaught page error that no ctx observer or session recorder saw, although k.errors says the app root has a default Boundary. A k.ui handler's throw had `data.at` `""`, so its fingerprint did not name the element. The compiler removed a `@keel/runtime-dom` intrinsic import even when a plain `.ts` module called the intrinsic, which then failed in the browser.

**Decision.**
- **Island root Boundary (k.errors).** Each resumed island's owner gets a root catcher, also the `onError` of the island's scope on the claim and client re-render paths (so the island component's own `effect`/`computed` throws are caught, `data.at` the island id), armed once its claim succeeds (a claim that throws stays E1253; the client re-render is armed). Its first throw becomes `keel.unexpected`, is reported to the ctx, and the island's nodes are replaced by `<pre data-k-error="<at>">`, as under `mount`. Other islands are unaffected.
- **`data.at` (default 4).** A handler's throw carries only an id the compiler wrote: the id it was registered under, else the `data-k` stamp of its element or nearest ancestor, else `""`. The compiler stamps a bound k.ui base element with its literal `id` (JSX tag or `.ts` call) as it stamps a bound template element; never a runtime `id`, which can hold app data that sessions upload and fingerprint unredacted. The `attr` op does not bind `data-k`.
- **Intrinsic calls (k.component).** Supported in files without JSX. The compiler removes a `@keel/runtime-dom` import only when every binding is an intrinsic used solely as a JSX tag; `analyze` treats pattern defaults as reads, so a parameter or destructuring default keeps it. E1251 is unchanged.

**Alternatives.**
- A `boundary` op around each island at resume, rejected: the server emits no region for it.
- Reporting without a fallback, rejected: differs from `mount` and leaves a dead island.
- `data.at` from the element's runtime `id`, rejected under default 4: app data would reach sessions unredacted.
- Arming before the claim, rejected: it changes mismatch recovery.
- A check rule forbidding intrinsic calls, rejected: plain `.ts` modules would lose control flow while base elements are called as functions there.

**Consequences.**
- k.errors gains three sentences and three conformance clauses, k.component one sentence and one clause; k.runtime is unchanged.
- Session recordings of server-rendered pages see handler, binding and island effect errors. Handler fingerprints name the compiled element or the base element's literal id; a base element with no literal id and no stamped ancestor has `data.at` `""`. Binding throws still take `data.at` from the element's `id` at bind time.
- A resumed island has no `onError`; the ctx's observers are how an app learns of its errors.
