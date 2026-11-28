---
"@keel/ui": patch
"@keel/server": patch
---

RFC 0067 (backlog 0182): a route built only from base elements is an island when one of them is bound. A base element with an event prop, a `field`, or a signal or computed `value`, `checked`, `disabled`, style prop or child writes `data-k=""` on itself, as a compiled template writes `data-k` on its bound elements. The server's island rule is unchanged (a route level whose element holds a `data-k` element outside nested islands gets `data-k-island`, its props go to `#k-state`, and the document loads the resume entry), so `() => Box({ children: () => Input({ label, onInput }) })` now resumes in place under createApp, in plain node and in a browser. Base elements with none of these stay static HTML and ship no JS. A getter style prop alone does not mark (a compiled expression may be static). Children passed as a thunk claim in document order; an eager `Node` child is made before its parent, so its island is E1253 and re-renders on the client. Size: `@keel/ui` 3,031 -> 3,104 B gzip of 4 kB; `@keel/server` unchanged (comments only).
