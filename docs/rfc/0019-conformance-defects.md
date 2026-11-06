# RFC 0019: Conformance defects

Status: implemented

## Problem
The freeze review found four defects in committed conformance and docs: `schema/conformance/result.test.ts` never awaits an async property; `check/conformance/zz.test.ts.bak` is a tracked debug probe; the cli `session` test asserts E1051 while k.cli Rules specify I1055 (info, exit 0); RFCs 0001-0018 still say `draft`.

## Proposal
Add the missing `await`; delete the `.bak`; align `rules-e1051.test.ts` and k.cli prose to I1055 and make the cli return it; set merged RFCs to `implemented`. No kernel behavior change except `keel session` now conforming to the existing Rules line.

## Alternatives
Change Rules to E1051: contradicts the "command not available" semantics.

## Spec diff
k.cli: `session` sentence says I1055.

## Conformance diff
The three edits above.

## Migration
None.

## Token impact
None.
