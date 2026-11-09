# ADR-0064: a resumed island has the app root's Boundary; intrinsic calls keep their import (RFC 0075)

**Status:** accepted (2026-11-09), under the WORKFLOW RFC defaults 1 and 2. Found by the S1 exit drill.

**Context.** A throw in a resumed island's binding or handler had no Boundary: it became an uncaught page error that no ctx observer or session recorder saw, although k.errors says the app root has a default Boundary. A k.ui handler's throw had `data.at` `""`, so its fingerprint did not name the element. The compiler removed a `@keel/runtime-dom` intrinsic import even when a plain `.ts` module called the intrinsic, which then failed in the browser.

**Decision.**
- **Island root Boundary (k.errors).** Each resumed island's owner gets a root catcher, armed once its claim succeeds (a claim that throws stays E1253; the client re-render is armed). Its first throw becomes `keel.unexpected`, is reported to the ctx, and the island is replaced by `<pre data-k-error="<at>">`, as under `mount`. Other islands are unaffected.
- **`data.at`.** A handler's throw carries the id it was registered under, else its element's id when it throws (`idOf`), under `mount` and `resume` alike.
- **Intrinsic calls (k.component).** Supported in files without JSX. The compiler removes a `@keel/runtime-dom` import only when every binding is an intrinsic used solely as a JSX tag. E1251 is unchanged.

**Alternatives.**
- A `boundary` op around each island at resume, rejected: the server emits no region for it.
- Reporting without a fallback, rejected: differs from `mount` and leaves a dead island.
- Arming before the claim, rejected: it changes mismatch recovery.
- A check rule forbidding intrinsic calls, rejected: plain `.ts` modules would lose control flow while base elements are called as functions there.

**Consequences.**
- k.errors and k.component each gain one sentence and one conformance clause; k.runtime is unchanged.
- Session recordings of server-rendered pages see handler and binding errors, with element-specific fingerprints.
- A resumed island has no `onError`; the ctx's observers are how an app learns of its errors.
