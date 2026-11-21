# RFC 0170: k.privacy-reads: the checker's privacy readers for stdlib rules, and three rules on them

Status: implemented (ADR-0193). For backlog 0616, 0617 and 0638 (work package check-privacy-rules, `tasks/p1/weaknesses-triage.md`).

## Decisions
- D1: `@keel/check` exports three readers it already runs for its own rules: `carriesReveal` (E1112's value walk, k.reveal Flow), `schemaHolds` (E1111's schema walk, asked about named exports instead of `.pii()` and `s.secret`) and `outputSchemas` (where a file declares `output` schemas). A stdlib `./tools` rule builds on them instead of a copy. They are public, so a library's rules can use them too (k.parity, RFC 0169).
- D2: a new kernel section, k.privacy-reads, states the readers and holds W1114. k.check, k.privacy and k.reveal are each within 10 characters of the 6,000-character section limit; the new section takes the text instead of raising a limit.
- D3: std.jobs gains E2506: a revealed value given to `enqueue` of a queue. A std code, not a new E1112 sink: k.reveal's sink list names kernel APIs only, and a kernel rule naming `@keel/std-jobs` is the coupling k.parity removes.
- D4: std.tokens gains E2203: a `Digested` node in an `output`, a page or layout `loader`'s or an API entry's. Both outputs, as E1113 covers both: an API answer leaves the server as surely as a page's data does.
- D5: W1114, in k.privacy-reads (block E110x beside E1105, E1107, E1111 to E1113): a password control bound to a field whose schema node is not `s.secret`. A warning, as the backlog line asks: the exit code of `keel check` does not change under the provisional freeze, and the static read cannot follow every schema.
- D6: every rule here reports only where its reader reads a yes. A part it cannot read reports nothing. What each rule proves and what it does not is stated in the spec text and below.
- D7: std.jobs and std.tokens go from `conformance-covered` to `implemented`: each gains a Conformance clause the ledger holds at `none` until the build and the conformance-writer land, and `keel ledger --diff` refuses a `conformance-covered` section with such a clause (E1707). k.privacy-reads is `proposed`. Nothing becomes `frozen`.

## Problem
Three privacy rules the stdlib was meant to carry do not exist, each because its stdlib package cannot reach a reader the checker keeps internal.

- 0616. A job's input and `key` are written to `ctx.storage` under `std.jobs.<module>` (std.jobs API). E2503 refuses an `s.secret` in a job's input schema, so a secret cannot be stored as a secret. Nothing refuses the revealed value of one: `jobs.enqueue(ctx, 'orders.mail', { token: reveal(t) })` parses (the input field is `s.string()`) and stores the token in plain text. E1112 does not see it: `enqueue` is not one of k.reveal's sinks, and a call to anything not listed ends the value. `packages/std-jobs/src/tools/` has `secretInput.ts` (E2503) and nothing for revealed values; `packages/check/src/rules/revealedValue.ts` holds the walk, unexported.
- 0617. A `type="password"` control bound to an `s.string()` field sends the password to the server as a plain string. The masks around it hold (k.ctx observer, std.sessions, the 422 re-render, k.forms), but once parsed nothing marks the value: a `diag` record scrubs only `.pii()` values and `Secret`s (k.privacy Server log), so a thrown message holding it, a `tx` given it or a store holding it keeps it as written. `s.secret` closes all of these (k.privacy Secrets). No rule in `packages/forms` or `packages/check` ties the two.
- 0638. A token's `digest` (`Digested`, std.tokens) belongs in a store, never in an answer. COMPLIANCE says to keep it out of loader outputs; nothing checks it. RFC 0103 named the code (E2203) and deferred it "when the checker's schema reader (E1111's) is exported to tools". `packages/check/src/internal/schemaMarks.ts` is that reader; it answers only for `.pii()` and `s.secret`.

The three findings share one cause: E1111's and E1112's readers are internal to `@keel/check`, so a stdlib rule either copies them or does not exist.

## Proposal
### Readers (k.privacy-reads Readers)
`@keel/check` exports:

```ts
import { carriesReveal, defineRule, outputSchemas, schemaHolds } from '@keel/check'

carriesReveal(node, input)                 // boolean: node carries a value reveal returns (k.reveal Flow)
schemaHolds(expr, input, [{ from: '@keel/std-tokens', name: 'Digested' }])  // 'yes' | 'unknown' | 'no'
outputSchemas(input)                       // the output expressions of contract entries and loader declarations
```

- `carriesReveal` is E1112's walk, given an expression: whether it carries a revealed value, by k.reveal Flow, a local's value read where the node stands. It reads one file; a helper's body is not read.
- `schemaHolds` is E1111's walk with the question as data: a part is listed when it is a named import of `{ from, name }` under any local name, or `<ns>.<name>` of a namespace import. It follows `const`s, project imports and re-exports, object fields, spreads, array elements, call arguments, a call's receiver and both branches of `?:`. It answers `'yes'` when a part is listed, `'unknown'` where it cannot read (a factory call, an unfollowed binding, a computed member, a getter, setter or method, a binding changed after its literal), `'no'` otherwise. An unlisted package's schema is `'no'`, as E1111 treats a package's schema as the package's.
- `outputSchemas` lists the `output` expressions the file declares: each API entry of a `contract` call (read as k.contract Static reading reads entries) and each `loader` declaration that is an object literal or a `const` bound to one.

### E2506 (std.jobs)
```ts
// modules/orders/pay.server.ts
import { reveal } from '@keel/schema'
import { jobs } from './jobs.server.ts'
await jobs.enqueue(ctx, 'orders.mail', { token: reveal(input.token) })          // E2506
await jobs.enqueue(ctx, 'orders.mail', { tokenId: minted.value.id })            // clean: pass an id the job reads by
```
An argument of `<q>.enqueue(…)` for which `carriesReveal` is true, where `<q>` is a name imported from a relative path ending `jobs.server` (with `.ts`, `.js` or no extension), `<ns>.<name>` of a namespace import of one, or a `const` of the file bound to `queue(…)`. Every argument counts, so `{ key: reveal(x) }` is one too: the key is stored. No fix.

### E2203 (std.tokens)
```ts
// accounts.contract.ts
'accounts.tokens': { method: 'GET', path: '/api/tokens', output: ApiTokens },   // E2203 when ApiTokens holds digest: Digested
```
Each `output` from `outputSchemas` for which `schemaHolds(expr, input, [{ from: '@keel/std-tokens', name: 'Digested' }])` is `'yes'`. One finding at the `output` expression. No fix: the author picks the fields to send (the `id`, `expiresAt`).

### W1114 (k.privacy-reads Password controls)
```tsx
const f = form(Registration)                                                     // Registration.password: s.string()
<Input field={f.field('password')} type="password" label="Password" autocomplete="new-password" />  // W1114
```
An `Input` (`@keel/ui`, JSX or a call with an object literal) with a literal `type` `password`, or a literal `autocomplete` holding `current-password` or `new-password`, whose `field` is `f.field('<literal path>')` with `f` a `const` of the file bound to `form(<schema>, …)` (`@keel/forms`). The schema is followed as `schemaHolds` follows it and walked one segment at a time through `s.object` fields, trailing method calls (`.optional()`, `.pii()`) passed over at each step. The node at the path is reported when it is a call `s.<name>(…)` of `@keel/schema` other than `s.secret`. No fix: the change to `s.secret` also changes how the server reads the value (`reveal`), which the author must write.

### What the rules prove, and what they do not
For reviewers, stated in the spec text of each rule:
- E2506 proves: no revealed value reaches a direct `enqueue` call on an imported or local queue through the flows k.reveal lists. It does not see: `enqueue` taken off the queue into a local or passed along, its `.call` or `.apply`, a helper function that enqueues (the walk ends at any other call, as E1112's does), a value revealed in another file and passed in as a parameter, a revealed value placed in a store that a job later reads.
- E2203 proves: no `output` the file declares in the two readable shapes refers to `@keel/std-tokens`'s `Digested`, through the files of the project. It does not see: an `output` built by a factory call or from a package (`'unknown'` and package schemas report nothing), a schema that names the format by its registry name, a `Digested` value copied into an `s.string()` field by the handler (the schema then says string), a digest sent by any path that is not an `output` schema (a log, a `Response` from a mounted handle).
- W1114 proves: for the password controls it reads, the bound field's schema node is `s.secret`. It does not see: a reactive or computed `type`, a computed path, a `field` passed in as a prop or held in a variable, a schema it cannot follow, a numeric path segment, a plain `<input>` (E1805 refuses those in app code), a `Form` posting to a mounted sign-in library without a Keel field (k.mount: Keel reads neither value).
- No rule changes at run time. E1112, E1113 and E2503 are unchanged.

## Alternatives
- **E1112 gains `enqueue` as a sink.** One rule, no export. Rejected: the kernel rule would name a stdlib API, and the same question returns for every stdlib package that stores what it is given (std.channels messages, std.offline outbox bodies, std.workflows). D3.
- **Each stdlib package copies the walk.** No kernel change. Rejected: two readers drift; RFC 0103 deferred E2203 to avoid this.
- **E2203 at run time, beside E1113.** `loader` and `contract` already walk `output` for `s.secret`. Rejected: the walk would need a kernel schema flag for "never in an output" that a std format type sets, a new k.schema feature for one type; and E1113 reports only when the code runs.
- **W1114 as a render check.** `bind` knows the field's schema node exactly, so the check would have no unread cases. Rejected for now: it reports only for pages a test renders, render checks have no warnings (each is a failing render), and it needs a channel from `@keel/forms` to `@keel/testing`. The static rule runs on every `keel check`.
- **W1114 as a type error.** `Input` props as a union where `type: 'password'` takes `Field<Secret<string>>`. Rejected: a computed path gives `Field<unknown>` and would fail to compile, and a reactive `type` is out of the type's reach.
- **W1114 as an error (E1114).** Rejected under the freeze: a new error can fail an existing app's `keel check`. Revisit at the trim review before P1 (operator question 2).
- **The text in k.check.** Rejected: k.check is at 5,998 of 6,000 characters. D2.

## Spec diff
Applied in this commit:
- **New `spec/kernel/k.privacy-reads.md`** (status `proposed`): Purpose; Readers (`carriesReveal`, `schemaHolds`, `outputSchemas`); Password controls (W1114); Rules (W1114); Conformance, four clauses.
- **std.jobs** (status `implemented`, D7): Extension points "registers E2501-E2504 and E2506"; API, `job` bullet: "`enqueue` is given no revealed value (E2506): a job's input and `key` are stored"; Rules gains E2506 with its reach and what it does not follow; Conformance gains one clause, appended (bullet 12).
- **std.tokens** (status `implemented`, D7): Extension points "(E2201-E2203)"; the "token leaves once" bullet gains "Its `digest` never leaves (E2203)"; Rules gains E2203; Conformance gains one clause, appended (bullet 16, after the `idOf` bullets). `mint`'s `id` gloss is shortened and the E2201/E2202 reading sentence is tightened (same content). The section reaches 1,734 tokens, so `spec.section` and `docs.section` are re-based from 1,700 to 1,750.
- **k.forms** Rules: "A password control's field: W1114 (k.privacy-reads)."
- **Map**: block E110x lists k.privacy-reads; row `| k.privacy-reads | Static privacy reads | proposed | readers |` after k.reveal. `spec/std/README.md`: std.jobs and std.tokens rows read `implemented`, E2501-E2506 and E2201-E2203.

## New codes
| code | owner | meaning |
|-|-|-|
| W1114 | k.privacy-reads | a password control bound to a field whose schema node is not `s.secret` (no fix) |
| E2203 | std.tokens | `Digested` in a page or layout `loader` `output` or an API entry `output` (no fix) |
| E2506 | std.jobs | a value `reveal` returns given to `enqueue` of a queue (no fix) |

All three were free: E1114 and W1114 are unused; E2203 is the number RFC 0103 named; E2501 to E2505 are taken. E1903 and E1904 were not reused (RFC 0040 dropped them).

## Conformance diff
By the `conformance-writer`, under `rfc:0170`, from the spec text alone:
- `packages/check/conformance/privacy-reads.test.ts` (new): k.privacy-reads clauses 1 to 4: the readers' true, false, `'yes'`, `'unknown'` and `'no'` cases, `outputSchemas` inline, through a `const` and for `decl()`, and W1114's cases. `fixtures-by-code.ts` gains a W1114 fixture (k.check Conformance: every code `check()` reports has one).
- `packages/std-jobs/conformance/rules.test.ts` (or its rules file): std.jobs clause 12 (E2506); the "each fire on a fixture and not on its clean twin" case extends to E2506.
- `packages/std-tokens/conformance/rules.test.ts`: std.tokens clause 16 (E2203), with a fixture and its clean twin.
Spec topics: `pnpm spec k.privacy-reads`, `pnpm spec std.jobs`, `pnpm spec std.tokens`, and for the flows they cite `pnpm spec k.reveal`, `pnpm spec k.contract`.

## Build
- `@keel/check`: export `carriesReveal` (from `rules/revealedValue.ts`'s walk), `schemaHolds` (generalizing `internal/schemaMarks.ts`; E1111 and E1107 keep their answers) and `outputSchemas` (over `internal/contractCalls.ts` and the `loader` read E1558 uses), each in its own `src/<name>.ts`; W1114 as `rules/passwordField.ts` in `KERNEL_RULES`; an `EXPLANATIONS.ts` row for W1114 (at most 120 tokens). The size line of `@keel/check` is re-based if it moves.
- `@keel/std-jobs`: `src/tools/revealedEnqueue.ts` (E2506), registered in `src/tools/index.ts`.
- `@keel/std-tokens`: `src/tools/digestOutput.ts` (E2203), registered in `src/tools/index.ts`.
- Docs: `docs/COMPLIANCE.md` (tokens and jobs paragraphs), the `keel-compliance` skill (its description lists W1114, E2203, E2506; one line each in Secrets and reveal), the check, std-jobs and std-tokens READMEs.
- Ledger: the six new clauses (k.privacy-reads #1 to #4, std.jobs #12, std.tokens #16) are in `tooling/ledger/ledger.json` at `none` (this commit); the build raises them.

## Token impact
k.privacy-reads 4,082 characters (1,021 tokens). std.jobs 4,991 to 5,797 characters; std.tokens 5,905 to 5,998; k.forms 5,537 to 5,590. Map: one row and one block entry, 1,345 tokens; the `spec.map` budget is re-based from 1,330 to 1,345 (`tooling/budgets.json`). `tooling/docs-owners.json` gives k.privacy-reads to `@keel/check`. The `keel-compliance` skill gains about 60 tokens.

## For the operator
1. W1114 is a warning (D5). Recommendation: keep it a warning until P1, then decide at the trim review whether it becomes E1114; a password over a plain string has no known valid use.
2. E2506 and E2203 are errors, so a project using std-jobs or std-tokens that sends a revealed value to a queue or a digest in an output fails `keel check` once built. Neither golden app does (`grep` of `apps/`). Recommendation: accept; both are leaks.
3. std.jobs and std.tokens read `implemented` until the conformance-writer and the build land (D7). Recommendation: accept; the alternative, `conformance-covered` with a `none` clause, fails `keel ledger --diff`.
