---
"@keel/cli": patch
---

k.compat Surface: `keel build`'s surface step reports a `routes.ts` or placed stdlib `./routes` that throws as E1006 naming the file (a thrown E code or a syntax error's E1000 kept, as the routes evaluation words it), exits 1 and writes no `surface.json`; `@keel/router/internal` or `@keel/store/internal` not loading is code 1.
