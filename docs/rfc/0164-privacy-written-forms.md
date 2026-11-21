# RFC 0164: k.privacy: the written forms the server log scrub marks

Status: accepted (ADR-0186) under the RFC defaults (4: privacy by default; 1: the spec is the contract), for the orchestrator to confirm. For backlog 0690.

## Decisions
- D1: k.privacy Sinks states every written form of a value the scrub marks, so each is a contract the conformance suite may check, not an implementation detail.
- D2: the `req` path segment rule moves from k.privacy Sinks to a new **Path** paragraph of k.serverlog, word for word but its lead-in, to make room; k.privacy keeps a one-line pointer. No Conformance bullet moves, so no ledger item changes section.
- D3: the forms' conformance bullet goes in k.serverlog, the section with room; k.privacy is at its limit.

## Problem
`packages/server/README.md` (Log paragraph) lists the forms `formsOf` (`packages/server/src/internal/formsOf.ts`) gives a value: as written; JSON-escaped, again with `\u` for each non-ASCII unit, and twice; `encodeURIComponent` once and twice, `encodeURI` and form-encoded (`URLSearchParams`), none for a value with a lone surrogate; base64 of its UTF-8, padded, and from 8 bytes unpadded in both alphabets, the padding that follows taken in. `scrubbed.ts` folds letter case one code unit at a time (`automatonOf.ts` `foldTable`), marks a match under 3 code units only where no letter, digit, combining mark or `_` stands beside it, and replaces each run of overlapping matches as one mark. The README then says: "Of these forms k.privacy specifies the value as written ...; the other forms are how the scrub works and no contract." k.privacy says only that each value "becomes `[secret]`" or `[pii]`. A change to `formsOf` that dropped base64url would pass every gate. k.privacy is at 1,499 of 1,500 tokens.

## Proposal
State the forms in k.privacy Sinks as one bullet (below). Make room by moving the `req` path paragraph, which is about how one part of a record is written, to k.serverlog as **Path**; k.serverlog step 1 names it. The README sentence that the forms are no contract goes in the build commit.

Why the 8-byte and 3-byte-offset rules belong in the contract: an unpadded base64 copy of a short value is a few letters that ordinary text holds by chance (`ab` is `YWI`), so short values match padded only; and inside a longer base64 text a value's characters are fixed only when it starts at a byte offset that is a multiple of 3 and ends at the text's end or after a multiple of 3 bytes. Anything else is a different string, which no scrub of whole forms can find. Stating both tells an operator exactly which copies are covered.

## Alternatives
- README says the forms are not a contract (the backlog's second option): keeps the section short, but a guarantee nobody can test is no guarantee (principle: the spec is the contract).
- A new section for the server log scrub: the map pays a row, and k.serverlog already exists for how a record is written.
- Raise k.privacy's limit: the brief forbids it.

## Spec diff
- k.privacy Sinks, new bullet after Server log: "Written forms: a value is marked as written; JSON-escaped, also with `\u` for each non-ASCII unit, and twice; `encodeURIComponent` once and twice, `encodeURI` and form-encoded (`+` for a space), none for a value with a lone surrogate; and as base64 of its UTF-8, padded, from 8 bytes also unpadded and URL-safe, found inside longer base64 from a byte offset that is a multiple of 3, to its end or for a multiple of 3 bytes. Letter case folds one code unit at a time; a form under 3 units is marked only as a whole token (no letter, digit, mark or `_` beside it). Overlapping matches are one mark."
- k.privacy Sinks, the `req` path bullet becomes "`req` path: first, a segment at a route's secret or `.pii()` `params` field is marked (k.serverlog Path)."
- k.serverlog: step 1 gains "a `req` path after Path below"; new paragraph **Path.** "Before the scrub, a segment at a secret `params` field ..." (the moved text); one Conformance bullet (below).

## Conformance diff
By the `conformance-writer`, under `rfc:0164`, in `packages/server/conformance/`:
- k.serverlog: "A revealed secret of 8 bytes or more thrown JSON-escaped twice, `encodeURI`d, form-encoded, unpadded base64 and base64url logs `[secret]` in each place; a 2-character one inside a word logs as is."
- Retag the `// Spec: k.privacy, Sinks "`req` path, first: ..."` headers of `privacy-req-path.test.ts` and `privacy-req-path-pii.test.ts` to `k.serverlog, Path` with the new text. Not ledger-counted (Sinks is not a Conformance list), so no item regresses.
- Cases the conformance-writer may add from the Written forms bullet alone: an 11-character secret base64-encoded at byte offset 3 of a longer string logs `[secret]` there; the same at offset 1 logs as is; a secret with a lone surrogate has no URL form and its JSON form is still marked; the uppercase of a secret is marked.

## Migration
None for apps: the scrub already marks these forms. The build commit replaces the README's "no contract" sentence with "k.privacy Sinks states these forms".

## Token impact
k.privacy 1,499 to 1,495 tokens. k.serverlog 929 to 1,169. Map unchanged. `docs/freeze-review.md`: k.serverlog 7 clauses, clause 7 without a test until the conformance commit.

## Build order
1. This commit. 2. `conformance-writer` (the bullet, the header retags). 3. Build: README sentence; `formsOf` already conforms, so no code change is expected.

## For the operator
- Should the Written forms list be closed (only these forms) or a floor (at least these)? Recommendation: a floor, as written: the scrub may mark more, never fewer.
