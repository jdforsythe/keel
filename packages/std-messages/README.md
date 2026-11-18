# @keel/std-messages

**Spec:** std.messages · **Status:** proposed · **verified:** (none)

## Contract

- **Public API:** `messages(locales, keys, load)` (a set: the closed object schema of one locale's entry, with `text(entry)` and `load(locale)`), `formatMessage(message, params, locale): string`, types `Message<P>` and `MessageSet<L, K>`.
- **Invariants:** a key's params are `s.string()`, `line`, `para`, `s.int()`, `s.number()` or `s.enum()`; any other throws. A key without params takes text of 1 to 2,000 characters with no `{` or `}`; a key with params takes `{ text }`, `{ plural: p, other, ... }` over a number param or `{ select: p, cases }` with a case per value of an enum param. Each message is a format type, so a bad template fails with rule `format` at its key. `load` imports one locale's file through the declared ``(locale) => import(`./<Set>/${locale}.ts`)`` and parses its default export; a failing entry throws. `formatMessage` writes numbers with `formatNumber`, plurals with `plural` (std.i18n) and reads no host locale. Server-only by default: a static route level ships no message, an island ships its one entry in `#k-state`, and a `client` deployable fetches one locale's chunk.
- **Rules** (`@keel/std-messages/tools`, in a module whose `deps` list the package): E2401 a locale without `<Set>/<locale>.ts`, or a `load` that is not the exact import (fix: the exact `load`) · E2402 a locale file without a declared key · E2403 a locale file key the set does not declare (fix: removes it) · E2404 a declared key no other file reads as `.<key>` (fix: removes it from the declaration) · E2405 a `{name}`, `plural` or `select` that does not match its key's params (fix: the rename, when one declared param is absent) · E2406 literal copy (std.copy): JSX text and child expressions and the `label`, `alt`, `placeholder`, `title`, `aria-label`, `aria-description`, `aria-placeholder`, `aria-roledescription`, `aria-valuetext` and `children` attributes in every `.tsx` file of the module, the same properties of an object literal passed to an uppercase callee in any app file but the set's locale files, and what a route `title` returns in `routes.ts`; read through `?:`, `||`, `??`, `&&`, thunks, templates and `+` with a lettered part, and `const`s of the file or a project import (calls, members, `let` and installed packages are not followed).
- **Dependencies:** `@keel/schema`, `@keel/std-i18n`; `./tools` adds `@keel/check` and `oxc-parser`. The package root imports neither `@keel/check` nor `typescript`.
- **Rungs:** conformance (example + probabilistic, fixes applied with `git apply`), properties for `formatMessage` over generated entries and params.

## Extension points

Uses the **schema type registry** (k.schema `s.format`: each message is a format type) and the **check rule registry** (k.check `defineRule`, `./tools`).

## Unsafe

count: 1 (`unsafe/asEntry.ts`: the set's schema and `text`'s argument typed as the entry its keys describe)
