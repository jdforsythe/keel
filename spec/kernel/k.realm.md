# k.realm: One kernel per realm
status: implemented

**Purpose.** Identity is a record each kernel package holds in its own module (k.identity), so it is only as sound as three things: that a realm holds one copy of the package, that the record's built-ins are the platform's, and that no name leads to kernel state. This section states each, and what stays open to code written on purpose to get around them.

**One copy.** Each kernel package that makes identities (`@keel/schema`, `@keel/store`, `@keel/router`, `@keel/server`) enters its name and the URL of its file, less query and hash, in the realm's census while its module is evaluated. A bundle names the file it inlined by a path, never by a folder of the machine that built it, so two folders inlined differ and two machines build the same bytes: a browser bundle by the path from the project, a server bundle by the path from its own file, resolved against the bundle's URL as it runs, so E1765 names file URLs of the machine that starts it.
- A second copy of a name from another file is E1765 at that evaluation: it throws a coded refusal (k.deploy Refusals at start) whose message is `two copies of <name> in one realm: <first url> and <second url>`, and nothing more of the second copy runs. Two copies never disagree in silence about what a schema, a defect or an action is.
- `keel check` and `keel build` report E1765 at the project's `package.json` when its dependencies resolve one of those names to two folders, with the same message and the folders' paths relative to the project: the one the project resolves first, then the one under a dependency. A folder's holder is the segment before its last `node_modules`, with the one before that when it starts `@`. Past 89 units (k.check Diagnostics) each folder takes its next shorter form, the first before the second at each step: from its holder on (`.../dep/node_modules/@keel/schema`), then its holder and last segment (`.../dep/.../schema`); a folder with no holder goes to `.../<last segment>`. Past that a holder keeps the head that fits, then `...` (`.../left-pa.../schema`), each holder getting half the room unless one fits in less. So the dependency that holds a copy stays named.
- An evaluation from the same file again (a dev reload, a test's module reset) is no second copy. It has a record of its own: a value an earlier evaluation made fails its guards.
- The census is the map at `globalThis[Symbol.for('keel.census')]`, name to URL. It holds no made value and no record: code that writes it can raise E1765 or hide it, and a hidden second copy's values fail the first copy's guards. It forges nothing.

**Built-ins.** A kernel package reads `WeakSet`, `WeakMap` and each of their methods it calls once, while its module is evaluated, and calls only those. The generated entries (k.deploy, k.topology) import the kernel before any app or library module. So a later write to `WeakSet.prototype.has`, `WeakMap.prototype.get` or `globalThis.WeakSet` changes no guard.

**The `keel.` names.** A registered symbol whose key starts `keel.` is the kernel's. The kernel keeps state on `globalThis` under one only where two module graphs or two packages must share it without importing each other: a test's fresh module graph evaluates a package again in the realm, and `@keel/services` reads what `@keel/server`, a browser entry and `@keel/testing` write. None holds a maker's record (k.identity): writing one changes what that state says, never what a guard answers. The slots, each `keel.<name>`:
- `census`: a `Map` of package name to URL (One copy).
- `ctxMeta`, `ctxHubs`, `simStorageShared`, `driven` (`@keel/ctx`): `WeakMap`s from a ctx to its mode, seed and plans, from a ctx to its observers, from a sim storage object to its data, and from a sim clock to what `simulate` drives.
- `modules`: a `WeakMap` from a served ctx to a `Map` of module id to a peer's URL or app, and `keel.user` to the `x-keel-user` signer (k.topology). `users`: a `WeakMap` from a ctx to its test user (k.user Testing).
- `errorCodes`: a `Set` of the codes `s.error` declared. `harnessCtx`: a `WeakSet` of the ctxs a test harness renders with.
- On a page, resume's: `resumed` (a `WeakSet` of islands), `waitingSnapshots` (a `Map` of store id to snapshot), `resumeWarnings` (strings), `trustedTypes` (the `keel` policy).
- `dev.registrations` (`keel dev`: a `Map` of capability to stack), `server.onUncaught.remove` (a function).

In app code and a library's files:
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
- In that project with the dependency named `dep`, the message is `two copies of @keel/schema in one realm: .../schema and .../dep/node_modules/@keel/schema`; named `left-pad`, `two copies of @keel/schema in one realm: .../schema and .../left-pad/.../schema`.
- Evaluating `@keel/schema` again from the same file with a fresh module graph throws nothing, and a schema the first evaluation made is not `isSchema` under the second.
- After `Reflect.set(WeakSet.prototype, 'has', () => true)`, `Reflect.set(WeakMap.prototype, 'has', () => true)` and `Reflect.set(WeakMap.prototype, 'get', () => ({}))` in a module evaluated after the kernel: `isSchema({})`, `isStore({})`, `isDefect(new Error('x'))` and `isRouteTable({})` are false, and `manifest` given `{ ...a }` for an action `a` throws a value whose message starts `E1515`.
- After `Reflect.get(globalThis, Symbol.for('keel.census')).delete('@keel/schema')`, a second copy of `@keel/schema` loads without E1765, and a schema it made is not `isSchema` under the first.
- In `modules/m/a.ts`, `Symbol.for('keel.kernel')`, `` Symbol.for(`keel.census`) ``, `Symbol.for(K)` with `const K = 'keel.' + 'result'` above it, `Object.getOwnPropertySymbols(globalThis)` and `Reflect.ownKeys(window)` are one E1766 each at the call, message `keel. symbols are the kernel's: app and library code names none`, with no fix; `Symbol.for('app.key')`, `Symbol('keel.x')` and `Reflect.ownKeys(obj)` are none.
- `keel review` reports one R1019 for `Symbol.for(name)` with `name` a parameter in `modules/m/a.ts`, and none for `Symbol.for('app.key')`.
