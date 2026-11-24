# k.formats: Format types
status: conformance-covered
A format type narrows a schema (k.schema) by a predicate. The stdlib's dates, text and messages are format types; app code declares none (E1106, k.schema).

**Format types.** `s.format(name, base, { check, gen: { from, map } })` narrows `base` by a pure `check(v): boolean` (a throw is false) and brands its type `Format<T, name>`. `parse` runs `base`, then `check`; false fails with rule `format` at that path. `encode` and JSON Schema are `base`'s (JSON Schema adds `format: name`); `decodeStrings` coerces as `base` does, then parses, so a value `check` refuses is a `format` issue; `doc()` is `name`; `gen` maps `gen(from)` through `map`, keeping values `parse` accepts. The node is `{ kind: 'format', name, base }`; `check` and `gen` stay in memory, so a serialized node keeps the name. `sampleFormat(node, sample)` (public in `@keel/schema`, no fast-check) maps `sample(from)` through `map` once: the encoded value when `check` accepts it, else undefined, also for a node that is no in-memory format.

**Literals.** A value written in source, such as a chart's `start` (std.statecharts), a store's initial value or a test fixture, is a format literal:
```ts
import { formatLiteral } from '@keel/schema'
import { Instant } from '@keel/std-temporal'
start: { at: formatLiteral(Instant, '1970-01-01T00:00:00.000Z'), code: '' } // at: Instant
```
- `formatLiteral(format, text)` (`@keel/schema`) takes a format type `Schema<Format<string, N>>` and a string literal, and returns `text` typed `Format<string, N>`; a `text` of type `string`, or a `format` that is no format type over `s.string()`, is a type error.
- `keel check` parses `text` with the format the schema type registry holds under `N` (k.schema; `keel check` first imports each `@keel/std-*` package in `deps`, k.module Std config), in every code file it reads, test files among them. It runs that registered format's `parse` on text from the source, and no app code.
- At run time, outside `keel check` (a test run, a REPL), `formatLiteral` runs `format.parse(text)`: the value when it parses, else it throws a `TypeError` whose message names `N` and the first issue's rule. It has no side effect and holds no table, so a bundle that does not call it carries none of it.
- Data from outside the source (a request, storage, the clock, a form) is read with `parse` or the format's own reader (`instantOf`), which answer a `Result`; `formatLiteral` takes only a literal (E1108), so the two never read the same input.

**Rules.** E1108 a `formatLiteral` call whose `text` is not a string literal (`'…'`, `"…"`, or a template with no substitution), whose `format`'s type names no one format registered under its name (a `line`, `para` or message format among them), or whose `text` fails that format's `parse` (message names the format and the first issue's rule), at the argument at fault; fix: below, else none.

**E1108's message.** `formatLiteral text is not a string literal`, `formatLiteral format is no format type over a string`, `formatLiteral format <names> is not one registered format` (`<names>` joined by ` & `; `temporal.Instant`: 66 units), or `formatLiteral text does not parse as <name> (<rule>)`. For an unregistered format whose argument is imported from a `@keel/std-*` package the file's module does not list in `deps`, the fix adds that package to `deps` in `modules/<id>/module.ts`; that only a stdlib format has a literal form is `keel explain`'s.

**Conformance.**
- For a fixture format type, every generated value parses and round-trips; a value `base` accepts and `check` refuses fails with rule `format` at its path; `doc()` is its name; JSON Schema adds `format`; `s.format` in an app file is E1106.
- For each of `Instant`, `PlainDate`, `TimeZone` and `Duration` (std.temporal), `Email` and `Slug` (std.text) and every value `v` its `gen` produces, `formatLiteral(F, v)` returns `v`; `formatLiteral(Instant, '1970-01-01T00:00:00.000Z')` returns `'1970-01-01T00:00:00.000Z'`.
- `formatLiteral(PlainDate, '2023-02-29')` throws a `TypeError` whose message contains `temporal.PlainDate` and `format`; `formatLiteral(PlainDate, '2024-02-29')` returns `'2024-02-29'`.
- A file `const a: Instant = formatLiteral(Instant, '1970-01-01T00:00:00.000Z')` has no type error, as does `const d: PlainDate = formatLiteral(PlainDate, '2024-02-29')`; `formatLiteral(Instant, t)` with `t: string`, `const p: PlainDate = formatLiteral(Instant, '1970-01-01T00:00:00.000Z')` and `formatLiteral(s.string(), 'x')` are each a type error.
- In a module whose `deps` list `@keel/std-temporal`, `keel check` reports one E1108 at the text argument, its message containing `temporal.Instant` and `format`, for `formatLiteral(Instant, '2026-02-30T00:00:00.000Z')`, and none for `formatLiteral(Instant, '2026-02-28T00:00:00.000Z')`; the same holds in a test file of that module.
- `const t = '1970-01-01T00:00:00.000Z'` then `formatLiteral(Instant, t)` reports one E1108 at `t`, as does a template with a substitution; `` formatLiteral(Instant, `1970-01-01T00:00:00.000Z`) `` reports none.
- `formatLiteral(I, '1970-01-01T00:00:00.000Z')` with `import { Instant as I }`, and `formatLiteral(T.Instant, '1970-01-01T00:00:00.000Z')` with `import * as T from '@keel/std-temporal'`, report no E1108; `formatLiteral(line({ max: 80 }), 'Pasta')` reports one E1108 at its first argument, its message containing `line(1..80)`.
