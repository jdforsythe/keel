---
"@keel/check": minor
---

`reportedCodes()` lists every code `check()` can report: the pipeline's own and each registered rule's (RFC 0065, backlog 0173). The fixture-per-code clause now covers exactly these codes, and each other Rules code is asserted by its own package's conformance. E1804 and E1401-E1404 have fixtures, and k.check is `conformance-covered`. E1603 now follows a URL to where it came from (backlog 0177): `String()`, `toString()`, `new URL`, `.href`, templates and `+`, `?:` and `&&`/`||`/`??`, object literal properties, each value a local is assigned, and `Reflect.construct(Worker, [u])`. It also follows a function's prototype chain, so `Object.getPrototypeOf(Object.getPrototypeOf(async () => {})).constructor(s)` and an async method's prototype `constructor` are reported. `Object` two steps above a plain function stays clean.
