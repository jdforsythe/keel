# ADR-0189: k.bundle: `@keel/compiler/client` types `import.meta.env` and the worker and url imports (RFC 0167)

**Status:** accepted (orchestrator, under the RFC defaults).

**Context.** `keel check` said its only ambient types were Node's, yet accepted `/// <reference types="vite/client" />`, which cli conformance uses to type `import.meta.env` and `?worker` imports. Vite's types make every unknown `import.meta.env` key `any` and add APIs no section specifies.

**Decision.** A types-only entry `@keel/compiler/client` declares `import.meta.env` with exactly `BASE_URL`, `MODE`, `DEV`, `PROD`, `SSR`, and the default imports of `*?worker`, `*?sharedworker` and `*?url`. `keel check` loads it as it loads Node's; the scaffold lists it in `tsconfig.json` `types`. Other type references stay allowed; the entry sets Vite's `strictImportMetaEnv`, so under `vite/client` an unknown key is still a type error.

**Alternatives.** Name `vite/client` as the way (Vite's surface and `any` become Keel's promise); refuse other references (breaks the bundle suites for no gain); omit `strictImportMetaEnv` (keeps `any` under `vite/client`).

**Consequences.** App code types `import.meta.env` with no reference line, and a read of a key the build never exposes fails `keel check`. `boundary-env.test.ts` reads its probe keys through `Reflect.get`; the other suites are unchanged.
