# ADR-0050: elements in a JSX child expression are E1403 and bind nothing, `If` lowers `fallback`, and E1002/E1603 follow more forms (RFC 0061)

**Status:** accepted

**Context.**
- `{p.on ? <b/> : <i/>}` lowered to a text binding of a node and rendered "[object Object]" (backlog 0165). So did `&&`, arrays, `map()` and helper calls that return JSX. Only `&&` was diagnosed, and it was still lowered.
- The lowering dropped `If`'s `fallback`.
- E1002 missed a never-assigned `let`/`var` key and an aliased `Object.assign`/`defineProperties` map (backlog 0170).
- E1603 missed `blob:` URLs in `import()`/`new Worker` and `Object.getPrototypeOf(fn).constructor` (backlog 0171).

**Decision.**
- **E1403, not a node binding.** k.component already says conditional rendering is `If`, so every child expression holding elements is E1403, and the lowering binds nothing for it. That covers `?:`, `&&`, `||`, `??`, an array or `map()` of elements, a function, and a same-file call or binding that returns elements. `If`/`For`/`Match` cover each case. A node-swapping binding would be a second way to branch, keyless for lists, and would cost runtime bytes.
- **Scope.** Names in a child expression resolve through the rfc:0053 resolver (`initOf`, and the new `functionOf` for declarations), never by text (backlog 0176).
- **Runtime half.** Static coverage cannot be complete (backlog 0175), so the `text` op renders `""` for a node or an array holding one, on the client and on the server DOM. runtime-dom has no dev channel for bindings, so the guard is silent. A coded runtime diagnostic waits for such a channel.
- **Fix only where `If` is imported.** In that case `&&` and `?:` with element or empty branches are rewritten to `<If when fallback>`. Adding the import would be a second hunk, and ten of them exceed the compact output budget.
- **`If` `fallback`** lowers to `cond`'s `otherwise`.
- **Resolver.** `assigned` counts only a target's root name. `Object.assign`/`defineProperties` maps go through `initOf`. `Object.getPrototypeOf`/`Reflect.getPrototypeOf` of a function value resolves to `Function.prototype`.
- **E1603** adds `import()` and `new Worker`/`SharedWorker` of `URL.createObjectURL(...)` or of a constant `data:`/`blob:` prefix.

**Alternatives.** A new E10xx for ternaries (two codes for one mistake). A runtime `text` that ignores objects (hides the bug). A fix that always adds the import (over budget).

**Consequences.**
- `@keel/compiler` grows from 22,892 to 24,315 B gzip, inside its 24 kB budget with 261 B left. `@keel/check` grows from 28,741 to 28,976 B. The `@keel/runtime-dom/ops` bundle grows by 27 B.
- Elements from another module's function, element-valued attributes, `importScripts`, `Worklet.addModule`, and blob URLs that flow through calls stay undetected.
