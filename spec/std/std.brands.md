# std.brands: Id brand case
status: implemented

**Extension point.** Check rule registry (k.check `defineRule`). Importing `@keel/std-brands/tools` registers rule E2101 with a `fix`. `keel check` runs it on each file with the kernel rules (k.check step 3).

**Why.** A brand is a type name: `s.id('order')` and `ctx.random.id('Order')` give `Id<'order'>` and `Id<'Order'>`, which are not assignable to each other (k.schema). One spelling, PascalCase, removes the near-miss.

**API** (`@keel/std-brands/tools`). `idBrandCase`: the registered `RuleDef` (k.check), code `E2101`, `see: 'std.brands'`.

**Entries.** The package is CLI-time whole. Its main entry exports nothing and imports nothing (k.module **Std config**), so importing it alone registers nothing: a module lists `@keel/std-brands` in `deps`, and `keel check` and `keel build` load `./tools`, which holds the rule.

**Rule.** The rule finds each call `s.id(x)` and each call `<expr>.random.id(x)` whose first argument `x` is a string literal (quotes or a template without substitutions) that is not PascalCase, `^[A-Z][A-Za-z0-9]*$`. The finding sits at the literal. The message is `id brand '<x>' is not PascalCase; use '<P>'`, or `id brand '<x>' is not PascalCase` when there is no `P`.

`P` is the PascalCase form of `x`. Split `x` at every character outside `[A-Za-z0-9]` and before each uppercase letter that follows a lowercase letter or digit. Drop empty parts, uppercase the first letter of each part, and keep the rest as written. `user_id`, `user-id` and `userId` all give `UserId`. When `P` is empty or starts with a digit, the finding has no `fix`. Otherwise `fix` replaces the literal's text with `P` in the same quote character. Brands passed as variables or other expressions are not checked.

**Rules.** E2101 `s.id` or `ctx.random.id` brand literal not PascalCase (fix: the PascalCase form).

**Conformance.**
- After importing `@keel/std-brands/tools`, `rules()` lists E2101 and `explain('E2101')` returns the rule's explain text, at most 120 tokens.
- For generated non-PascalCase brands (lower, snake, kebab, camel), `s.id('<b>')` reports exactly one E2101 at the literal's line and col; `ctx.random.id('<b>')` does too.
- A file whose brands are all PascalCase literals, variables, or other expressions reports no E2101.
- For each generated E2101 with a fix, the fix applies to its file with `git apply`, and re-checking the patched file reports no E2101.
- The fixed brand of `user_id`, `user-id` and `userId` is `UserId`; the quote character is kept.
- A brand with no letter-led PascalCase form (`'_'`, `'1st'`) reports E2101 without a `fix`.
- The main entry `@keel/std-brands` exports nothing and `@keel/std-brands/tools` exports exactly `idBrandCase`; the package's `exports` has the keys `.` and `./tools`.
