# k.realm: One kernel per realm
status: implemented

**Purpose.** Identity is a record each kernel package holds in its own module (k.identity), so it is only as sound as three things: that a realm holds one copy of the package, that the record's built-ins are the platform's, and that no name leads to kernel state. This section states each, and what stays open to code written on purpose to get around them.

**One copy.** Each kernel package that makes identities (`@keel/schema`, `@keel/store`, `@keel/router`, `@keel/server`) enters its name and the URL of its file, less query and hash, in the realm's census while its module is evaluated. A bundle writes that URL as the file it inlined, so two folders inlined differ (a browser bundle: the path from the project).
- A second copy of a name from another file is E1765 at that evaluation: it throws a coded refusal (k.deploy Refusals at start) whose message is `two copies of <name> in one realm: <first url> and <second url>`, and nothing more of the second copy runs. Two copies never disagree in silence about what a schema, a defect or an action is.
- `keel check` and `keel build` report E1765 at the project's `package.json` when its dependencies resolve one of those names to two folders, with the same message and the folders' paths relative to the project: the one the project resolves first, then the one under a dependency, cut from the front to fit 89 units (k.check Diagnostics).
- An evaluation from the same file again (a dev reload, a test's module reset) is no second copy. It has a record of its own: a value an earlier evaluation made fails its guards.
- The census is the map at `globalThis[Symbol.for('keel.census')]`, name to URL. It holds no made value and no record: code that writes it can raise E1765 or hide it, and a hidden second copy's values fail the first copy's guards. It forges nothing.

**Built-ins.** A kernel package reads `WeakSet`, `WeakMap` and each of their methods it calls once, while its module is evaluated, and calls only those. The generated entries (k.deploy, k.topology) import the kernel before any app or library module. So a later write to `WeakSet.prototype.has`, `WeakMap.prototype.get` or `globalThis.WeakSet` changes no guard.

**The `keel.` names.** A registered symbol whose key starts `keel.` is the kernel's: the census, and the slots its dev tools and entries keep on `globalThis`. In app code and a library's files:
- `Symbol.for` given a string that folds to one starting `keel.` (a literal, a template without substitution, a `const` bound to either, or `+` of those) is E1766 at the call;
- `Object.getOwnPropertySymbols` and `Reflect.ownKeys` given `globalThis`, `window`, `self` or `global` are E1766 at the call: they list what `Symbol.for` would name;
- a `Symbol.for` whose argument does not fold to a string is R1019 in `keel review`, and a non-literal key on the global object is R1056 (k.escapes). Check cannot read either name.
Each finds its callee as k.unsafe One path says; no fix.

**Not held.** Code that runs in the realm before the kernel and replaces a built-in (a hand-written entry, `node --import`, a loader hook); the inspector protocol; `node:vm`. None is a spelling check can refuse; review shows the nearest visible forms (R1019, R1053, R1056, R1057).

**Rules.** E1765 two copies of a kernel package in one realm, at evaluation; at check and build, in the project's dependencies · E1766 a `keel.` registered symbol named, or the global object's symbol keys listed, in app code or a library's file, message `keel. symbols are the kernel's: app and library code names none`.

**Conformance.**
- With `@keel/schema` loaded from its package folder, importing a copy of that folder made under another path throws a value whose message starts `E1765 two copies of @keel/schema in one realm: `, then the first copy's file URL, ` and `, and the second's; `isSchema` and `isDefect` of the first copy answer as before; the same holds of `@keel/store` and `@keel/router`.
- `server.mjs` of a fixture, imported after a copy of `@keel/schema` from another folder was evaluated in its process, prints one `diag` with code E1765 naming both URLs and exits 1, with no E1577 record.
- A project whose `node_modules` resolves `@keel/schema` to two folders (the app's and one nested under a dependency) is one E1765 at `package.json` from `keel check` and from `keel build`; with one folder it is none.
- Evaluating `@keel/schema` again from the same file with a fresh module graph throws nothing, and a schema the first evaluation made is not `isSchema` under the second.
- After `Reflect.set(WeakSet.prototype, 'has', () => true)`, `Reflect.set(WeakMap.prototype, 'has', () => true)` and `Reflect.set(WeakMap.prototype, 'get', () => ({}))` in a module evaluated after the kernel: `isSchema({})`, `isStore({})`, `isDefect(new Error('x'))` and `isRouteTable({})` are false, and `manifest` given `{ ...a }` for an action `a` throws a value whose message starts `E1515`.
- After `Reflect.get(globalThis, Symbol.for('keel.census')).delete('@keel/schema')`, a second copy of `@keel/schema` loads without E1765, and a schema it made is not `isSchema` under the first.
- In `modules/m/a.ts`, `Symbol.for('keel.kernel')`, `` Symbol.for(`keel.census`) ``, `Symbol.for(K)` with `const K = 'keel.' + 'result'` above it, `Object.getOwnPropertySymbols(globalThis)` and `Reflect.ownKeys(window)` are one E1766 each at the call, message `keel. symbols are the kernel's: app and library code names none`, with no fix; `Symbol.for('app.key')`, `Symbol('keel.x')` and `Reflect.ownKeys(obj)` are none.
- `keel review` reports one R1019 for `Symbol.for(name)` with `name` a parameter in `modules/m/a.ts`, and none for `Symbol.for('app.key')`.
