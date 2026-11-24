# ADR-0230: k.formats: a format literal, checked by `keel check` (RFC 0208)

**Status:** accepted (orchestrator, 2026-11-23, for the operator to confirm).

**Context.** A format value written in source (a chart's `start`, a store's initial value, a test fixture) has no form: a string literal is not the branded type, and `parse` and the readers (`instantOf`) answer a `Result`, so the value needs a cast or a fallback. The household kept a run's time as epoch milliseconds for this reason.

**Decision.**
- `formatLiteral(format, text)` in `@keel/schema`, one constructor for every format type over `s.string()`: it takes a string literal and returns `Format<string, N>`; a `string`-typed `text` is a type error.
- `keel check` parses `text` with the format the schema type registry holds under `N`, in every code file, tests among them. E1108, at the argument at fault and with no fix: a `text` that is not a string literal, a `format` naming no registered format, or a `text` its `parse` refuses (the message names the format and the rule).
- Outside `keel check`, `formatLiteral` parses and throws a `TypeError` naming the format and the rule. It has no side effect, so an unused import ships nothing.
- Literals only: data from outside the source keeps `parse` and the readers, which answer a `Result`. E1108 keeps the two from ever taking the same input.
- Unregistered formats (`line`, `para`, messages) have no literal form; E1108 names them.

**Alternatives.**
- A method per format schema (`Instant.of`): a new schema type on every format, shipped whether called or not.
- A constructor per format, a throwing `unwrap(result)`, template-literal types, a cast in `unsafe/`: more than one way, nothing at `keel check`, or a second definition of each format.
- Evaluating `format` from app source so factory formats work: `keel check` does not run app code.

**Consequences.** `apps/household`'s run time becomes an `Instant`, its chart `start` a `formatLiteral`. `std-temporal`'s `UTC` is a `formatLiteral(TimeZone, 'UTC')`. k.formats reads `implemented` until its six new clauses are covered. E1108 joins the E110x block, which k.formats now shares.
