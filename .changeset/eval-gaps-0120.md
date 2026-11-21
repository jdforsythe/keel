---
"@keel/check": patch
"@keel/server": patch
"@keel/reactive": minor
"@keel/cli": patch
"@keel/schema": patch
---

RFC 0068 (backlogs 0120, 0197, 0198): a PascalCase `.ts` component file whose default export is a function taking `Props` may export `Props` and `uses`; E1752 and E1104 call one `isComponentFile`, and any other file declaring `Props` stays E1104. A zero-byte JSON action body decodes as `{}`: the action runs when its input accepts `{}`, otherwise 422 `keel.fields` names each missing field. `keel scaffold project <name>` writes under `<name>/`, with or without `--workspace`; the generator stays project-relative. `ok`/`err` brand each `Result` with a non-enumerable `Symbol.for('keel.result')` key, and `resource` unwraps only those: `ok(v)` settles `ready` with `v`, `err(e)` settles `error` with `e`, so a fetcher returning a `@keel/services` call needs no throw; a plain `{ ok, error }` payload stays `ready`. `resource<T>(fetcher: () => Promise<T>)` returns `Resource<Settled<T>>` (`Settled` exported). Size: `@keel/server` +7 B gzip; `@keel/reactive` 1,970 -> 2,041 B of 4 kB; `@keel/schema` 4,337 B of 5 kB.
