---
"@keel/std-sessions": minor
---

The std.sessions GitHub Action. `packages/std-sessions/action/action.yml` is a composite action with inputs `url` and `token` (exported as `KEEL_SESSIONS_TOKEN`) that runs the new bin `keel-session-action`. The new subpath `@keel/std-sessions/action` exports `runAction(io)`: it ingests failing sessions of the last 26 hours, replays each fingerprint's newest file, and for a reproduced one runs `minimize` and `to-test` and creates or updates one `keel-session` issue titled `session <fingerprint>: <code> at <route>`, whose body holds the compact `session` record and the emitted test. A fingerprint that does not reproduce gets one comment on its open issue. Output adds record kind `session.issue`.
