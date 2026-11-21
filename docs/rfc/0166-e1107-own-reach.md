# RFC 0166: k.leave: E1107 reads its own reach, narrower than k.boundary's

Status: implemented (ADR-0188). For backlog 0880.

## Decisions
- D1: E1107 keeps the reach `@keel/check` gives it today and k.leave states it: a `store` call in a `.tsx` or `.jsx` file not named `*.server.*`, or in a file one reaches by relative `import`, `export … from` and literal `import()` through no `*.server.*` file (D25: kept narrower and stated).
- D2: k.boundary Reach and k.bundle stop saying E1107 uses E1004's reach; they name E1004 and E1571 only.
- D3: the limits are stated in k.leave: a plain `.ts` file no component imports is outside the reach, and a store an island finds only by `stores()` id or through a package import is not reported.

## Problem
k.leave Snapshots says E1107 fires "in a client-reachable file (E1004's reachability)", and k.boundary Reach and k.bundle say "(E1004, so E1107 and E1571)". k.boundary's reach is wide: with a `topology.ts`, every file of a `node` or `static` module but server-only ones; with none, every file but server-only ones. `clientPii` in `packages/check/src/internal/modules/moduleChecks.ts` starts from `.tsx`/`.jsx` files not matching `\.server\.[cm]?[jt]sx?$` and follows relative imports, re-exports and literal `import()` (`scanFile.ts`), never into a `*.server.*` file.

`packages/check/conformance/client-pii.test.ts` asks for the narrow one. Its spec quote, k.leave Conformance: "`store(Contact, …)` with `email: s.string().pii('contact')` in a component file is E1107 when the module has no `clientPii` ...; with `clientPii: ['contact']`, or in a `*.server.ts` file, it is not". Its negatives at lines 114 to 116 check that golden-2's `accounts` module, whose `.pii('contact')` stores sit in plain `.ts` files that only server files import, reports no E1107. Under k.boundary's reach every one of those files is client-reachable, so the spec as written would require E1107 there. Lane 05 found the contradiction when it moved E1107 onto the shared reach (0880).

Why narrow is the right reach for this rule: `#k-state` holds only stores an island creates or reads while it renders (k.leave Snapshots), and an island is a component. A store in a file no component reaches cannot reach a snapshot. k.boundary's reach answers a different question, what code may be bundled for a browser, where over-reporting costs nothing; for E1107 it would make every `.pii()` store in a module helper an error and push apps to list classes in `clientPii` that never leave the server, which weakens the rule's signal.

## Proposal
Spec text only; the check already conforms.

```ts
// modules/accounts/profileStores.ts: only loadAccount.server.ts imports it. No E1107.
export const profileStores = factory(() => ({ profile: store(Profile, { email: '' }) }))

// modules/accounts/Panel.tsx imports it: E1107 for 'contact' unless module.ts lists clientPii: ['contact'].
import { profileStores } from './profileStores.ts'
```

## Alternatives
- Move E1107 onto k.boundary's reach and change the test: over-reports, as above, and asks apps to declare classes that never reach a page.
- A reach from island roots only (route components marked island): more exact, but the check would need the runtime's island decision, which is a render-time fact (k.runtime).

## Spec diff
- k.leave Snapshots: "in a client-reachable file (E1004's reachability)" becomes "in a `.tsx` or `.jsx` file not named `*.server.*`, or in a file one reaches by relative `import`, `export … from` and literal `import()` through no `*.server.*` file"; after "the fix adds the class." add "That reach is narrower than k.boundary's: a plain `.ts` file no component file imports, say one only loaders use, is not in it, and a store an island finds only by `stores()` id or a package import is not reported."
- k.boundary Reach: "(E1004, so E1107 and E1571)" becomes "(E1004 and E1571; E1107 has its own, k.leave)".
- k.bundle Bundles: "Reach (E1004, so E1107 and E1571)" becomes "Reach (E1004 and E1571)".

## Conformance diff
By the `conformance-writer`, under `rfc:0166`, in `packages/check/conformance/client-pii.test.ts`:
- Retag the `// Spec: k.leave, Snapshots` header to the new text (not ledger-counted; the Conformance clause is unchanged).
- From the new sentence alone: a `.pii('contact')` store in `modules/app/stores.ts` that only `load.server.ts` imports is clean with a `topology.ts` listing the module on `node` and without one; the same file imported by `Card.tsx` is E1107.

## Migration
None; behaviour is unchanged.

## Token impact
k.leave 1,314 to 1,397 tokens; k.boundary 1,493 to 1,497; k.bundle 1,269 to 1,267. Map unchanged. No new clause.

## Build order
1. This commit. 2. `conformance-writer` (header, two cases). 3. No build; the `clientPii` doc comment already says this.

## For the operator
- A store an island reaches only by `stores()` id is unreported. Recommendation: accept as a stated limit; a lookup by id names a store some component file created, which the reach covers in nearly every app.
