---
"@keel/runtime-dom": minor
---

`resume` resumes every `[data-k-island]` in document order, each with its own props, root Boundary and delegation root, and a mismatch re-renders that island alone. An island's `children` returns the server's content of its child level: claimed in place at its slot's region, moved by a later call, and E1255 for a second call while the island builds or while the content is in the document. Events fired before resume are queued by their innermost island. The `./internal` entry gives `@keel/server` the runtime's server mode, in which every structural op and every slot other than a component slot writes its content in a `<!--[-->` … `<!--]-->` region.
