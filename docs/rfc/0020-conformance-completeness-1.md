# RFC 0020: Conformance completeness, wave 1 (k.router, k.check, k.cli)

Status: implemented

## Problem
docs/freeze-review.md gaps 3, 4, 6: E1502-E1506 are `it.todo` though the code throws; check's explain/fixture test uses a hardcoded code list that misses E1000, E1206, E1757; cli surface parity and `inspect` exist only as unit tests.

## Proposal
Router: each of E1502-E1506 gets a test driving `manifest`/`Form` to the throw (E1506 unknown guard: `createRouter` route error). Check: the code list is read at test time from the `**Rules` paragraphs of `spec/kernel/*.md` via `node:fs` (reading spec, not implementation); every code has `explain` and a fixture or is explain-only; the warnings-only test asserts `check()` `ok: true`. Cli: json/MCP/LSP parity, MCP input schema parity, and `run(['inspect', url], { fetch })` with E1056.

Explain-only (`check()` cannot trigger): E1051-E1054, E1056, E1101-E1103, E1201-E1206, E1251-E1254, E1351-E1354, E1502-E1506, E1551-E1554, E1651-E1653, E1702-E1706, E1756, E1801, E1804, E1806, E1807, E1901-E1904.

## Alternatives
Keep the list hardcoded: drifts.

## Spec diff
None.

## Conformance diff
Router, check, cli suites as above.

## Migration
None.

## Token impact
None.
