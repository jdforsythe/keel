# RFC 0035: Conformance completion k.check, k.cli, k.module

Status: implemented (ADR-0024)

## Problem
docs/freeze-review.md §1 and backlog 0060. k.check: the fix-diff clause names "the top 30 codes", an undefined set, and the suite asserted 5 fixes; the 600-token budget was asserted over `format()` of synthetic diagnostics, not the real `keel check` on golden app 1. k.cli: `GET /__keel/inspect` on a dev `createApp` and the production 404 had unit tests only. k.module: the stdlib fixture used `id: '@keel/std-auth'`, which `ModuleSchema` rejects, and only E1151, E1152, E1154 were asserted on a stdlib module. Three `test.skip` stubs (E1753 stdlib range, E1754, E1755) remained in check, already covered by fixtures; "W-only exits 0" and `--code` were asserted below the CLI only.

## Proposal
- k.check fixes: every fix a diagnostic carries must apply. The checker's fix set is the 16 codes below; the other fixtured codes have no one-hunk fix, each with its reason. New fixes: E1151 and E1157 add the name to the owning module's `public.exports` / `public.routes`; E1155 prefixes the literal with `<module id>.`. No fix edits a file under `node_modules/` (a stdlib package is not the app's to edit), so a stdlib module's own E1152, E1154-E1157 carry none.
- Stdlib modules: the manifest sits at the package root (`node_modules/@keel/std-<x>/module.ts`), `deps` name the package, and its lowerCamel `id` is its prefix.

| fix | codes |
| --- | --- |
| yes (16) | E1003 · E1005 (bytes differ, data and hash intact) · E1151 · E1152 · E1154 · E1155 · E1156 · E1157 · E1401 · E1451 · E1452 (`try`) · E1601 (exact `ctx` equivalent) · E1652 · E1653 · E1757 (`!`, `any`, suppression) · E1805 |

No one-hunk fix:

| code | reason |
| --- | --- |
| E1000 | the intended source is unknown |
| E1001, E1002, E1403, E1501 | compiler-owned (k.compiler); `key`, the safe sink, and the route id need data `check` lacks or a second import; E1403's diff (~90 tokens) would also break the injected-10 budget (52 tokens of headroom). k.compiler follow-up |
| E1004 | moving code across the server boundary is a multi-file decision |
| E1005 (data or hash edited) | the original bytes are unknown; regenerate |
| E1104, E1105, E1752 | a file rename or split plus every importer: k.scaffold `rename`, not a hunk |
| E1153 | which edge of the cycle to drop is a design choice |
| E1404 | the new id is a naming decision |
| E1452 (`.catch()`), E1453 | the caller's type becomes a `Result`; handling it is application logic |
| E1454 | choosing an error code is a naming decision |
| E1601 (`setTimeout`, `fetch`, storage) | no exact `ctx` equivalent |
| E1651 | spec: declare an endpoint (no fix) |
| E1701 | the element id is not derivable from a selector |
| E1751 | arbitrary TS error |
| E1753 | choosing a free code is a naming decision |
| E1754 | a placeholder justification defeats the rule |
| E1755 | budgets are met by changing content |
| E1757 (casts) | removing a cast changes types; narrowing is the author's |
| E1802 | the accessible name is content only the author knows |
| E1803 | style props need tokens; E1801 nearest-token is not implemented |

Clause to test (strict verdict, D1):

| section | clause | test |
| --- | --- | --- |
| k.check | explain + fixture per code | `explain`, `fixture-per-code` (explain-only list, D3) |
| k.check | fix diffs | `fix-applies`: the 16-code table, every fix on every fixture, the fix/no-fix partition |
| k.check | json byte-identical | `compiler-passthrough` |
| k.check | static only | `rendered-a11y` |
| k.check | two runs identical | `deterministic` |
| k.check | injected 10 <= 600 | `cli/conformance/check-budget-injected10` (real `keel check` on golden-1 + `tooling/fixtures/injected10-app`) |
| k.check | `--code E1501` | `flags`, `cli/conformance/check-code-and-warnings` |
| k.check | E1753, E1756 | `define-rule`, `E1756-rule-threw`, `E1753-E1754-E1755-notes` |
| k.check | W-only exits 0 | `cli/conformance/check-code-and-warnings` |
| k.cli | 1-8, 10 | `surfaces`, `check-output`, `limit-and-quiet`, `rules-e1051`, `spec-and-explain`, `inspect` |
| k.cli | `GET /__keel/inspect` dev and prod 404 | `cli/conformance/inspect-endpoint` |
| k.cli | POST without `Origin` | `server/conformance/inspect-post-origin` (D2) |
| k.module | 1-6 | `module-E115x-*`, `module-private-signature-change` |
| k.module | stdlib same schema and rules | `module-stdlib-same-rules`: `ModuleSchema` and `module()` on stdlib manifests, E1151-E1157 on a stdlib module, app/stdlib diagnostic parity |

## Alternatives
Keep "top 30": no 30 check-reportable codes have a correct one-hunk fix; placeholder fixes (E1754, E1802) would pass the test and mislead. Run the budget test over `format()` only: a proxy (D1).

## Spec diff
k.check Conformance bullet 2 names the fix set. k.module: Rules entries name their fixes; Manifest states the stdlib location and prefix.

## Conformance diff
check: `fix-applies` rewritten (superset of the 5 old cases), `module-stdlib-same-rules` extended, three skips replaced. cli: `check-budget-injected10`, `check-code-and-warnings`, `inspect-endpoint`; stale header in `check-output`. No assertion removed.

## Migration
None. E1151, E1155, E1157 diagnostics gain `fix`.

## Token impact
k.check +~40, k.module +~60 tokens; both under 1,500. Injected-10 output unchanged (its codes are untouched).
