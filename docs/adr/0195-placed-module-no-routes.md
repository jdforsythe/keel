# ADR-0195: k.topology: a placed stdlib module with a contract and no routes is E1586 (RFC 0172)

**Status:** accepted (the orchestrator under the RFC defaults, 1: the spec is the contract).

**Context.** A placed stdlib module's routes come from its package's `./routes` export, and a package without one places silently. That is right for a runner-only module and wrong for one whose `./contract` declares routes: a package that loses `./routes`, or names a file the publish left out, passes `keel check` and `keel build` and serves 404 at every path its contract declares.

**Decision.** E1586, an error in `keel check` (so `keel build` fails with exit 1 and nothing written), at a module id in `topology.ts` whose stdlib package resolves `./contract` and not `./routes`. The package is the `@keel/std-*` one an app manifest's `deps` names, found in `node_modules` from that manifest's folder up, whose root manifest has the id; an export resolves when the package's `exports` names it and the named file is in the package. A package with neither export stays silent. No fix: the package, not the app, is wrong.

**Alternatives.**
- Every placed module that resolves no routes: false for every runner-only stdlib module.
- Folded into W1005: the reader read everything, and a build serving none of a contract's routes should stop.
- A throw in `createApp`: its route table never names the contract, and a check finds it before a deploy.

**Consequences.** A broken stdlib package stops the build at the app that places it. An app module with a contract file and no `routes.ts` stays silent.
