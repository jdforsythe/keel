---
"@keel/std-credentials": minor
---

`@keel/std-credentials` hashes passwords and mints tokens for `node` deployables. `.` exports the client-safe schemas `Hashed`, `Digested` and `CredentialsConfig`; `./server` exports `credentials(ctx)`, whose `hash` and `verify` take a `Secret<string>` and store `$scrypt$ln=<ln>,r=8,p=1$<salt>$<key>`, and whose `mint` and `check` give and read `keel_<id>_<secret>` tokens stored as `$sha256$exp=<ms>$<digest>` with the expiry inside; `./tools` adds E2201 (the server entry outside a `*.server.ts` file) and E2202 (the server entry in a module a deployable other than `node` serves). A module sets the cost with `std: { '@keel/std-credentials': { ln } }`, an integer 17 to 20, default 17.
