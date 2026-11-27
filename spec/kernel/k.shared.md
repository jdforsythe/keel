# k.shared: Module state on a server
status: proposed

**Rule.** State a module owns outlives a request, so on a server every request the process serves can read it. What is shared is shared on purpose: no request writes state a later request can read, unless that state is a named process slot. An author picks by lifetime:

| Lifetime | Where it lives |
| --- | --- |
| a request | a `store`, a `signal` or a library's maker called inside the request (a guard, a loader, an action, a component it renders): the request's scope owns it, its registry is the request's own (k.store Registries) and it is disposed with the request; what a loader returns; `ctx` |
| a user | durable storage keyed by `user` or `caller`: a server store (k.server) or app data (k.data) |
| the process, read-only to requests | module state set while the module is evaluated or by work started outside any request: configuration read at start, a timer's refresh |
| the process, written by requests | `processSlot(name, make)` (k.ctx): a cache with a name, plain values only |

**Reactive state.** Module state is every node a module root owns (k.reactive Module roots): a signal, a computed, a store, and whatever a maker builds from them, since a chart, an outbox and any library's state are made of those nodes. While a request is served, by the mark k.leave Module stores describes, which follows the request's async context after its response too:
- a write to module state is the defect E1256 and changes nothing: a signal's `set`, a store's `tx`, `restore`, `undo` and `undoWhere`. Its message is `E1256 write to module state during a request`, its `data` `{ node, kind }`, the node's id (k.reactive `inspect`) and `signal` or `store`;
- making a node in a module root is E1256 the same, `kind` `root`: a module root's `run`, or a maker that makes its state on first use, would take the state's first value from the request;
- a read is free.
A callback registered outside a request is not judged, even when a request resolves the promise it waits on. The rule is on the node's owner, not on a list of makers: a maker written later, in any package, is under it because its state is a node. On a page nothing here is refused: a browser's module state is one person's.

**At check.** Server code is a `*.server.ts` file and a file that calls `loader`, `action` or `guard` (k.contract Handlers). In it, inside a function:
- E1256: a call of `set` on a binding declared at a module's top level, in any file, whose type is the kernel's `Signal`, at the call, message `write to module signal <name> in server code: per-request state lives in the request's scope`.
- E1260: a write to plain module state, at the write, message `module state written in server code: per request use the request's scope, per process use processSlot(name, make)`. A write is an assignment (`=`, a compound one, `++`, `--`) to a top-level `let` or `var`, to a property or element of a top-level binding, or a call of `set`, `add`, `delete`, `clear`, `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill` or `copyWithin` on a top-level binding whose type is a `Map`, `Set`, `WeakMap`, `WeakSet` or array. A binding whose initializer is a `processSlot` call is not judged: its sharing is named, and `keel review` lists each slot.
Neither carries a fix: where the state belongs is the author's choice (k.fixes). Code at a module's top level is not judged; it runs once, before any request.

**Not held.** Plain state has no node, so the run time cannot see it. Check does not follow a top-level binding through an alias, an argument or a helper in another file; state inside a plain npm package; or a value reached from a slot. A reactive leak is refused by construction at run time; a plain one only where check sees the write.

**Rules.** E1256 (k.resume) a write to module state during a request, a defect; at check, a `set` on a module-level signal in server code · E1260 a write to plain module state in server code. No fix.

**Conformance.**
- On a node server, with `export const last = signal('')` at the top level of `modules/p/last.ts`, a loader running `last.set(params.id)` fails its level with a value `isDefect(v, 'E1256')` accepts whose `data.kind` is `signal`, answers 500 with `keel.unexpected`, and leaves `last.get()` `''`.
- Two requests served at once, `/p/a` and `/p/b`, whose loader runs `last.set(params.id)`, awaits a timer, and returns `last.get()`: neither answer holds the other's id.
- `last.set('boot')` at the module's top level, and inside a `setInterval` callback registered there, changes `last` with no E1256, also while a request is being served.
- A library's maker built on `signal` (`counter(id)` returning `{ get, add }`), declared at a module's top level in an app that lists the library: an action calling its `add` fails with the E1256 defect; the same maker called inside a loader gives each of two concurrent requests its own count.
- A maker that makes its store on first use, declared at a module's top level and first used in a loader, fails that loader with the E1256 defect whose `data.kind` is `root`; first used at the top level, it serves requests that read it.
- Under `mount` in a browser, a click handler's `last.set('x')` on that module signal changes it and raises nothing.
- In `modules/p/load.server.ts`, `last.set(x)` inside a function, `last` imported from `./last.ts`, is one E1256 at the call with no fix; the same call at the file's top level, `const s = signal(0); s.set(1)` inside a loader's function, and the call in `modules/p/Panel.tsx` (no handler, not a server file) are none.
- In `modules/p/load.server.ts`, inside a function, each of `count++` and `count = 1` (`let count = 0` at the top level), `cache.set(k, v)` (`const cache = new Map()`), `seen.push(x)` (`const seen: string[] = []`) and `conf.mode = 'x'` (`const conf = { mode: '' }`) is one E1260 at the write; `cache.get(k)`, `pool.set(k, v)` with `const pool = processSlot('p.pool', () => new Map())`, `count = 1` at the top level, and each of these in `modules/p/Panel.tsx` are none.
