---
"@keel/compiler": minor
"@keel/check": minor
"@keel/runtime-dom": patch
---

Elements in a JSX child expression are E1403 and bind nothing (backlog 0165, 0170, 0171, 0175, 0176; RFC 0061). `{p.on ? <b/> : <i/>}` used to compile to a text binding and render "[object Object]". E1403 now covers `&&`, `?:`, `||` and `??` with an element branch, an array or `map()` of elements, a function child, and a same-file call or binding that returns elements. In a file that imports `If`, its fix rewrites `&&` and `?:` to `<If when fallback>`. Names in the child resolve by lexical scope (backlog 0176). A `text` binding that receives a node, or an array holding one, renders nothing at runtime, for the forms the compiler cannot see (backlog 0175). The lowering now passes `If`'s `fallback` to `cond`, which it used to drop. E1002 follows a never-assigned `let`/`var` key (`el[k] = x`) and a map held in an alias (`Object.assign(el, o)`, `Object.defineProperties(el, d)`). E1603 covers `import()` and `new Worker`/`SharedWorker` of a `blob:` URL (`URL.createObjectURL`) or a `data:` URL, and `Object.getPrototypeOf(fn).constructor`.
