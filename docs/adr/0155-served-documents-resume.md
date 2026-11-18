# ADR-0155: a served document resumes: the server writes regions, a layout island's `children` holds the child level, and every island resumes (RFC 0133)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-18).

**Context.** The server rendered each route level through the client `mount`, which wrote no `<!--[-->` … `<!--]-->` regions, so `resume` met no region at the first structural op of an island and re-rendered it. A layout island resumed with props lacking `children`, and only outermost islands resumed, so a layout around a page re-rendered and took the page island's server nodes with it. golden-1's board was such a page.

**Decision.**
- R1: slot calls, `children()` included, write regions like structural ops; a component slot `<!--+-->` stays one element. The runtime has a server mode (`serverMode` from `@keel/runtime-dom/internal`, set by `@keel/server` around each level's render) in which `prepare` and `slot` write the regions.
- R2: at resume an island's `children` renders no child level: claimed at its slot's region, it returns the region's nodes in place, unclaimed; a later call moves them to its place; a removed place detaches them and disposes nothing.
- R3: E1255 for a second call while the layout builds or while the content is in the document, on the server (the level fails as a throw; the thrown code is logged as a `diag`) and in a resumed island (its root Boundary). Zero calls and conditional calls are specified, not refused.
- R4: every `[data-k-island]` resumes in document order with its own props, root Boundary and delegation root; a mismatch re-renders that island alone, and a re-rendered layout's `children` returns the held content.
- D5: while an island claims, a server element with regions gets an own `childNodes` without them, deleted when the claim ends, so the compiled output's `childNodes[i]` reads the template's positions. No server node moves, and the compiler's output and the k.runtime op list stay as they are.
- D6: a layout island that mismatches before its `children` call holds the outermost region below it around its first nested island root; with no nested island it holds nothing.
- D7: events fired before resume are queued by their innermost island, so each island replays its own.
- D8: an op outside a template (a fresh anchor in a fragment, as compiled among a k.ui element's children) claims the server's next region and the anchor after it in its place; a claimed k.ui element keeps its comments and what its regions hold, and its children pass over them. `Form` renders through `element`, so a served form and its children are claimed, not rebuilt.

**Alternatives.**
- One element for the child level (a `<!--+-->` slot): constrains what a page may return.
- The child level's HTML or a re-render marker in `#k-state`: needs static levels' components on the client or doubles the document.
- The layout and its nested islands as one island: a mismatch in one re-renders both.
- Lifting the regions out of a claimed element while it claims: every region's nodes would leave and re-enter the document at resume.
- A compiler op reading a child past regions: a new op outside k.runtime's op list, and every compiled file changes.

**Consequences.**
- Served documents carry a few bytes of comments per op and slot.
- A layout island whose slot's branch did not render on the server shows nothing when the branch shows on the client.
- A static child level under a layout island that mismatches before its `children` call, with no island below it, is not held.

**Amendment (review and browser smoke after the build).**
- D5 stands, accepted at the review's low rating, with its limits: the own `childNodes` is a snapshot taken when the claim starts, and only `childNodes[i]` reads see it (`firstChild`, `nextSibling`, `children` and iteration see the real nodes, regions included); it is deleted on every path, success, mismatch and throw. A guard test pins that compiled output reads a claimed element's children only through `childNodes[i]`, so a compiler change that reads them another way fails there first.
- D6 is replaced: the server writes `<!--k-->` first in a child level's content, and a layout island that mismatches before its `children` call holds exactly the region that comment opens, nothing of its own output. A static child level is held too, so the last consequence below no longer holds.
- D7 is replaced: queued events replay once every island has resumed, in the order they fired, each dispatched as a live event through every enclosing island; the `input` sync for controls typed before load stays per island. An event in a re-rendered island's own nodes is dropped.
- D9: while a request `createApp` serves runs, through every `await`, a `tx` on a module-registry store throws E1256 and changes nothing; the level fails as a throw does, an action answers 500. `renderRoute`, runners and code outside a request are not checked; no static rule yet.
- D10: a `#k-state` snapshot with no store in `resume`'s `stores` restores the store an island creates with that id while it resumes; one never taken is E1253.
- D11: `resumeDocument` with `routes` as an import function resumes in a module graph of its own; served-document conformance uses it.
- D12: golden-1 is client-only; its served-document tests and the browser smoke move to golden-2.
- D9 mechanism: `@keel/store/internal` has a `moduleWrites.check` slot that every `tx` on a module-registry store calls first; `createApp` installs a check that throws E1256 while an `AsyncLocalStorage` (`serving`) says a request runs. `@keel/store` gains no node dependency and a few bytes.
- D10 mechanism: `@keel/runtime-dom` does not depend on `@keel/store`, so `resume` puts the snapshots no store in `stores` took in a map under `Symbol.for("keel.waitingSnapshots")` on `globalThis` while islands resume, and `store()` takes the one for its id at creation and restores it.
- D11 mechanism: `resumeDocument` imports `vitest` when `routes` is a function, calls `vi.resetModules()`, runs the import, and takes `resume`, `stores` and `scope` from the same new graph; the islands run in that graph's own scope, disposed with the handle.
