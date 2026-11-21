---
"@keel/testing": minor
---

The handle of `render`, `renderRoute` and `resumeDocument` exposes `ctx`: the ctx the component, or the route's app, runs on (the one given, else the sim ctx the harness made). It is typed `SimCtx` when none is given, so a test drives `ctx.clock` through it; a given ctx keeps its type.
