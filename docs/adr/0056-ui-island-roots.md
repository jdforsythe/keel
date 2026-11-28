# ADR-0056: a bound base element marks its route level as an island (RFC 0067)

**Status:** accepted

**Context.**
- A route made only of `@keel/ui` base elements never became an island: the server marks a level that holds a `data-k` element, and only compiled templates wrote `data-k` (backlog 0182). Its handlers never ran.

**Decision.**
- **Base elements mark themselves.** One with an event prop, a `field`, or a signal or computed `value`, `checked`, `disabled`, style prop or child writes `data-k=""`. Islands keep one rule: a route level whose element holds a `data-k` element outside nested islands.
- **Getters alone do not mark.** Compiled props are getters, and many are static; the style check runs inside the class binding.
- **Thunk children resume in place.** An eager `Node` child is made before its parent, so it is E1253 and re-renders on the client.

**Alternatives.**
- The server marks every route root. Every page would ship the runtime.
- The render unit reports bindings. Template bindings of loader data read no state, so every data page would become an island, and islands would have two rules.
- `data-k` on every base element (rejected in RFC 0064).

**Consequences.**
- `() => Box({ children: () => Input({ label, onInput }) })` is an island: the document loads the resume entry, and resume adopts the server nodes without E1253.
- Bound base elements carry `data-k=""` in server HTML and client renders.
- `@keel/ui` +73 B gzip (3,104 of 4,096). Server, runtime-dom and compiler code unchanged.
- **Known limits.** A getter style prop that reads a signal, a compiled text child of a component, and a component that calls `effect` and returns base elements do not mark. Eager children re-render at resume.
