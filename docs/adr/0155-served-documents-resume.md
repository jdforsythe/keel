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
