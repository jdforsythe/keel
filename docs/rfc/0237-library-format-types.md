# RFC 0237: a library declares format types; E1106 holds for app code

Status: accepted (ADR-0259), accepted by the orchestrator on 2026-11-25, to be confirmed by the operator. Amends RFC 0163 (k.library: a library's files are read as the app's, D4) for one code, E1106; amends k.formats (a Who declares paragraph, two Conformance clauses) and k.schema (E1106's Rules entry). No new code. Decision D173 of `tasks/0963-to-p1/PLAN.md`; D174 keeps every other rule.

## For the operator
1. **The exemption covers installed, linked and own-folder libraries alike.** Recommended: the stdlib reaches the golden apps through workspace links, so a rule that told a linked library from an installed one would refuse the stdlib's own formats.
2. **An app's own workspace library may declare format types.** A fair use, not a hole (Alternatives, The dodge). Reverse by narrowing Who declares; the cost is item 1.
3. **Test code stays outside E1106, an app's and a library's alike.** That is k.check App code as it stands; no new reading for a library's `test/`.

## Decisions
- D1: E1106 does not report `s.format` in a library's files: those under `src/` and `unsafe/` of a package folder with `"keel": "library"` and a scoped name (k.library Kind), installed, linked, or read in its own folder (k.library-pack Own folder).
- D2: only E1106 changes. Every other rule reads a library's file as `modules/<id>/<f>` (RFC 0163 D4); D174 keeps E1105, E1107 and E1576 on library files.
- D3: a file of a folder marked library that is not under `src/` or `unsafe/` (one under `modules/` among them) is the project's and keeps E1106.
- D4: test code is no app code (k.check App code), so a library's `test/` folder and co-located `*.test.*` files are held to the app's rule, which does not reach them: no E1106 there, as in an app's test file.

## Problem
E1106 keeps `s.format` out of app code (RFC 0079): an app-written predicate brings a generator no one tests, and apps take dates, text and messages from the stdlib. RFC 0163 D4 reads a library's file `<f>` as `modules/<id>/<f>` for every rule, so a library's own files are app code. Declaring format types is what std-text, std-temporal, std-messages and std-tokens are for; once each moves onto the library format (RFC 0163 slice 4), its formats are E1106 in every app that lists it and in its own `keel check`. k.parity (RFC 0169 item 11) already says a library may declare format types; nothing in k.schema or k.formats says so, and the stdlib's formats lane waits on it.

## Proposal
- k.formats gains **Who declares**: E1106 reports `s.format` in app code but in a library's files (D1); E1106 alone reads such a file as the library's (D2); any other file of a folder marked library keeps the rule (D3); test code is no E1106 (D4).
- k.schema's Rules entry reads `E1106 \`s.format\` in app code, a library's files aside (k.formats Who declares)`.
- The check: a file is a library's for E1106 when it lies under `node_modules/<name>/src/` or `node_modules/<name>/unsafe/` of a library the app reads (k.library In an app), or under `src/` or `unsafe/` of the folder `keel check` reads as its own. The rule's message and `keel explain` entry name a library's format type in place of a stdlib one (builder's wording, within 120 tokens).

## Alternatives
- **(a) The exemption for a library's files (chosen).** One line in the rule's scope, at the boundary the format already draws: a library has a manifest with a unique `id`, a public surface (E1151), reach only to itself and other libraries (E1163), and every other rule over its files. It makes k.parity true for formats: the stdlib holds no power a library lacks.
- **(b) An `unsafe(` lift per use.** Each format moves under `unsafe/` with a justification and E1106 joins the lifted codes. Rejected: `unsafe` counts escapes from a rule a file should keep, and the ledger reads the count as risk; a library declaring formats is the library doing its job, so std-temporal alone would show a dozen escapes that mean nothing, and an app could lift E1106 the same way, which reopens it for apps.
- **(c) Format definitions in the kernel's schema package.** `@keel/schema` would own every date, text, message and token format. Rejected: kernel packages never import std packages, so the predicates (time zone data, grapheme counting, message templates) move into the kernel; its size budget pays for every app, a third-party library still could not declare one, and k.parity's claim fails.
- **The dodge: an app marking itself a library.** It gains nothing for its modules. In a folder whose `package.json` says `"keel": "library"`, `keel check` reads the root `module.ts` as the one module and `src/` and `unsafe/` as its code; the files under `modules/` stay where they are and stay app code (D3, a Conformance clause pins it). What the folder gains is a library: a scoped name, a root manifest whose `id` no app module or other library holds (E1166), a public surface, and, to publish, `keel pack` (check, test, ledger).
- **The dodge: an app's own workspace library.** An app may put its format types in `packages/<name>/` with `"keel": "library"` and list it in `deps`. This is fair use: it is how anyone writes a library, the stdlib reaches this repo's apps the same way (a workspace link), and the format types then sit behind a manifest, an `id` and a public surface, with every other rule over the library's files, so `check` is held to the kernel's purity rules (bare `Date`, `Math.random`, `fetch`). The untested generator RFC 0079 named stays the author's to test, as for any code the author writes; Keel enforces no generator test for the stdlib's formats either (their own conformance does), and a linked library needs no `.keel/ledger.json` (E1162 is for installed ones), so its rungs show only once published. The one rule that would close the route, E1106 on a linked library's files, would refuse the stdlib's formats in every workspace app (For the operator 1). Not a hole: no rule is added.

## Spec diff
Applied in this commit.
- k.formats: opening sentence (format types are declared in libraries); **Who declares** (new paragraph); Conformance #9 and #10. Status `implemented` (accepted, conformance owed), from `conformance-covered`; the map row follows.
- k.schema: E1106's Rules entry. Its clauses are unchanged, so its status stays.
- k.library and k.library-pack, each at its 3,100-token budget, are unchanged: Who declares states the one exception to k.library In an app. k.parity's By kind sentence already states the outcome.
- No new diagnostic code; no glossary term.

## Conformance diff
By the `conformance-writer`, from the spec text, under `rfc:0237`. Fixture libraries are written into a temporary project's `node_modules/`; no std package is imported.
- `packages/check/conformance/E1106-library-files.test.ts`: k.formats#9 (`check()` over the fixture's files).
- `packages/cli/conformance/E1106-library-own-folder.test.ts`: k.formats#10 (`keel check` in a temporary library folder).
- `packages/check/conformance/E1106-format-in-app.test.ts` (#1) stands; its clause's wording is unchanged.

## Migration
None: nothing is released.

## Token impact
k.formats about +370 to about 2,020 of 3,100; k.schema about +5. Map unchanged in size. `@keel/check`: a path test in `formatInApp.ts`, bytes measured in the build.

## Build order
1. This commit: RFC, ADR, spec text, map row.
2. `conformance-writer`: k.formats#9 and #10.
3. Build (one lane, S): `packages/check/src/rules/formatInApp.ts` skips a library's `src/` and `unsafe/` files as Proposal says, from the library list `check()` already reads (k.library In an app) and from the own-folder view (`packages/cli/src/internal/asInstalled.ts` maps those files under `node_modules/<name>/`); its message and the E1106 entry in `packages/check/src/internal/EXPLANATIONS.ts`; the `keel-architecture` and `keel` skills where they say format types are the stdlib's; a changeset. Then the stdlib formats lane (std-text, std-temporal, std-messages, std-tokens) relies on it.
