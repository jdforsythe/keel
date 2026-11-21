# RFC 0040: Rules triage

Status: implemented (ADR-0029)

## Problem
docs/freeze-review.md §4 and backlog 0062, 0101, 0109, 0110. Kernel Rules paragraphs name codes that nothing raises, and 0110 lists Rules codes with no fixture. `fixture-per-code` accepted them because its EXPLAIN_ONLY list mixed two cases: codes another surface raises, and codes that no surface raises. k.check says `keel check` produces every Rules code except those another command raises, so an unraised code is a spec lie. Also: E1507 was runtime only, E1701 missed a destructured `container`, and E1501 missed a string passed to a parameter typed `Href` (`nav('/orders')`). E1054 has no conformance test, and inspect `graph` includes the server's own request scope. RFC 0041 replaces the free `href()` with `routes.href()`, so the module pass must read that form too.

## Proposal
Each listed code gets one outcome. (a) A static rule in `@keel/check` with a triggering and a clean fixture, plus a fix when one hunk repairs it. (b) Deleted from the Rules line, `EXPLANATIONS`, and EXPLAIN_ONLY. (c) Explain-only, kept only when another surface raises the code and that surface's conformance asserts it.

| code | outcome | fix | note |
| --- | --- | --- | --- |
| E1000 | a | no | fixture exists since rfc:0030 (compiler pass-through) |
| E1101 | b | - | a string given where enum literals are expected is already a TS error (E1751); no source pattern shows which `s.string()` should be an enum |
| E1102 | b | - | `optional()` and `nullable()` are separate modifiers, and parse tells them apart (`optional-null`, `nullable-absent`); no source pattern is wrong |
| E1103 | b | - | adding a property to a schema or its value is a TS error (E1751); closed objects reject undeclared keys at parse (rfc:0029) |
| E1204 | a | no | `r.get()` of a `resource` binding anywhere but `<Match on={...}>` |
| E1205 | b | - | thrown by `@keel/reactive` at runtime (`computed.ts:28`), not a check rule, and no conformance asserts it |
| E1251 | a | no | import, re-export, or `import()` of `@keel/runtime-dom/ops` in app code |
| E1252 | a | no | global `document`/`window` reads in app code; members E1601 owns (`window.setTimeout`, `document.cookie`) are left to E1601; "DOM node APIs" removed (needs types) |
| E1254 | b | - | the compiler marks no islands yet (backlog 0106); restore with island marking |
| E1302 | a | no | rule already existed; k.store gains a Rules paragraph so the code is counted |
| E1551 | a | no | `loader(`/`action(` from `@keel/router` outside `*.server.ts(x)` |
| E1702 | c | - | raised by `@keel/testing` `render`; asserted by `packages/testing/conformance/rule-E1702.test.ts` |
| E1754 | a | no | fixture exists |
| E1755 | a | no | fixture exists (budgets option) |
| E1803 | a | no | fixture exists |
| E1805 | a | yes | fixture exists |
| E1806 | a | yes | JSX `loading`/`empty`/`error` given a string, a bare attribute, a literal, a JSX element, or a function with too many parameters; the fix wraps a JSX element as `() => <El />` |
| E1901 | a | no | a `@keel/ui` Input/TextArea/Select/Checkbox inside a `@keel/router` `<Form>` with no `field` (spread skipped) |
| E1903 | b | - | needs cross-file schema identity (form, route, action input); not a per-file rule |
| E1904 | b | - | the action input schema lives in another file; same reason |
| E1507 | a | yes | the positional `loader(schema, fn)`/`action(schema, fn)`, or an annotated parameter carrying `params`/`search`; the fix deletes the annotation. Guards (references since rfc:0041) play no part |
| E1701 | a | no | also a destructured DOM query: `const { container } = render(...)` |
| E1501 | a | no | TS "not assignable to parameter of type 'Href'" now maps to E1501 (the `navigate` half) |

Module pass (rfc:0041): `scanFile` collects route ids from `<x>.href('id', ...)` as well as the free `href('id')` during the transition. k.check fixtures and k.module conformance link with `routes.href(id)` and import the manifest from the target module, which lists `routes` in `public.exports`.

## Alternatives
Keep the unraised codes as explain-only: the spec would keep promising diagnostics that never appear (principle 5). Type-aware versions of E1101-E1103, E1903, and E1904: they would duplicate E1751 or need cross-file schema resolution that `check()` does not do per file. Restate E1205 as (c): no conformance asserts it.

## Spec diff
Rules lines only. k.schema drops E1101-E1103. k.reactive drops E1205. k.runtime drops E1254 and narrows E1252 to `document` or `window`. k.forms drops E1903 and E1904. k.store gains `**Rules.** E1302 ...`. Not applied, and owned elsewhere: the k.check Conformance fix list should add E1507 and E1806. No spec/00-map.md change.

## Conformance diff
check: `fixtures-by-code` adds E1204, E1251, E1252, E1302, E1507, E1551, E1806, and E1901, and moves E1157 and the E1501 clean fixture to `routes.href`. EXPLAIN_ONLY loses the triaged codes. `fix-diffs` adds E1507 and E1806, and its partition covers the new codes. The new `rules-rfc0040` covers the E1501 navigate half (types on, golden-1 root) and the destructured E1701 forms. k.module E1152 and E1157, and the stdlib tests, use `routes.href`. No assertion is removed.

## Follow-ups (other owners)
- reactive: add a conformance clause for E1205 and restore it to the Rules line, or stop throwing a numbered code.
- forms: delete `E1903-*`/`E1904-*` skips. runtime-dom: drop the E1251/E1252/E1254 todos. server: drop the E1551 todo. ui: drop the E1806 todo. testing: un-skip the destructured `container` case.
- cli (E1054): no public path emits a record of an unregistered kind. Proposal: a `@keel/cli/testing` export of `respond(records, mode)`, or a stdlib command, so conformance can assert `[{ kind: "nobody.home" }]` gives E1054. Today only `packages/cli/test/render.property.test.ts:99` covers it.
- server: `packages/server/src/createApp.ts:63` creates and isolates the request scope before the inspect branch (line 68), so `inspect()` (`internal/inspectResponse.ts:33`) reports that scope. Decide `inspecting` first and skip the scope for an inspect GET.

## Migration
None for apps: golden-1 and inspector check clean.

## Token impact
Spec down by about 120 tokens across k.schema, k.reactive, k.runtime, and k.forms; k.store up by about 25. `explain` and `check.injected10` budgets hold.
