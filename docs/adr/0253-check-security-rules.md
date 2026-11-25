# ADR-0253: check security rules: what each rule sees through, and what it refuses (RFC 0231)

**Status:** accepted (orchestrator, 2026-11-25).

**Context.** Fix lane 07 of the weakness triage found seven gaps in the security rules of `keel check`:
- E1111's schema read misses a mutation made through an alias, a destructured `assign`, a called function or another file.
- A `vite/client` type reference passes.
- E1107 keeps a narrower reach of its own.
- `declaredFor` follows relative imports only.
- E1108 depends on what the process registered.
- E1571's message reads two ways.
- `linkEscapes` has no test.

The principle: a wrong program must not pass the gate, and a rule must not report what is not there.

**Decision.**
- E1016: a `/// <reference …/>` in project code (fix: delete it), or a declaration of the global `ImportMeta`/`ImportMetaEnv` in any loaded file other than TypeScript's lib, `@types/node` and `@keel/compiler/client`.
- k.boundary Following: Reach, and k.origins' importers, follow every specifier k.bundle Aliases resolves to a project file. A relative-headed template `import()` expands as Vite expands it. E1015: a relative specifier in non-test project code that resolves outside the project root.
- E1107 judges on the shared Reach, finds `store` through aliases, namespaces and re-exports, and also reports an unreadable state schema, a `stores()` call, and `store`/`stores` used other than as a call.
- The schema read follows a literal binding only while every reference to it in the checked files is one the read takes (k.privacy-reads Held). `@keel/schema` freezes `s` and every schema and node it makes.
- E1108 consults the registry only for a format declared by a `@keel/std-*` package in `deps`. Any other owner is not registered. An owner that cannot be told has a message of its own.
- E1571: `absolute URL fetched from client code; its origin is not declared under connect`.
- k.scaffold Links states the link rule behind E1357 and E1585, and adds a refusal of a target with more than one hard link.
- E1570 and E1571 state that a URL they cannot read is not reported. The policy blocks it at run time.

**Alternatives.**
- Name the reference as the way to type `env`: two ways, and it widens `import.meta`.
- Extend the mutation deny-list: any function can mutate its argument, so the list never ends.
- Attribute registrations by diffing the registry: that depends on import order.
- Refuse computed URLs: that reports correct same-origin code, and the policy is the enforcement.

**Consequences.**
- Fixtures that type `import.meta.env` with `vite/client` drop the reference.
- `mutatedBinding` is removed.
- Nine sections read `implemented` until their conformance and build land.
- 0994 and 0995 are builder's work against text already in the spec.
