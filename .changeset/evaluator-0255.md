---
"@keel/cli": minor
"@keel/check": minor
"@keel/compiler": minor
"@keel/std-tokens": patch
---

Every build-time evaluation (`tokens.ts`, contracts, route tables) runs in the evaluator: one Node child per bundle, started by `evaluate({ kind: 'data', entry, deadlineMs })` of `@keel/compiler` with `--permission` (file reads of the bundle's folder only), code from strings off, zero-filled buffers, an empty working folder and an environment of `TZ`, `LANG` and `LC_*` alone. Its global object is prepared from `HOST_VIEWS`, its views hold none of Node's objects and ask the command, which answers and records each question, and the command ends it at its result, so a leftover timer, a write to `Math` or a dev server's globals never reach another evaluation or the command. An evaluation that gives no result (a top-level await that never settles, or 30 s with none) is E1048; any other early exit is E1049. A refusal crosses as a record, a package frame placed as `<package>/<path>:<line>:<col>`. `keel dev` ends an evaluation a newer change made stale and prints evaluation problems as `keel check` does. Node 22.13 is the least Keel runs on.
