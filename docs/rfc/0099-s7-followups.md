# RFC 0099: S7 follow-ups (getter props in k.ui, `styles` on any component and E1823, the audited search list, `#` specifiers)

Status: implemented. Accepted (2026-11-13, orchestrator, WORKFLOW RFC defaults 2, 3, 6; open questions answered as recommended; the user confirms or reverses, tasks/0337-s7-ui-modules/PLAN.md D29). For backlog 0594, 0596, 0597, 0599. Each decision cites the WORKFLOW RFC default it applies; what the defaults leave open is under Questions with a recommendation. ADR-0122 records it.

## Decisions
- D1 (0599): the gap is in hand-built calls and in the spec, not in the runtime or the types. Every k.ui base element already binds a prop given as a getter, and compiled JSX passes every non-literal value as one. k.ui states the rule once: a getter prop updates what it writes as its reads change; `as`, `level`, `role`, `field`, `children`, event props and an id derived from `label` are read at build. `TableSearch` passes `label` to `Input` as a getter. No type widens: a signal or computed stays where k.ui lists it today (defaults 2, 3).
- D2 (0597, compiler half; 0594): `styles` on any component is part styles. The compiler drops its list of stdlib packages and collects the literal `styles` of every component that is not a base element or `Part`. A `styles` value, a part in it or a spread in it that is not an object literal is the new E1823, except a read of the enclosing component's `props.styles` (or a member of it), whose literal is collected where the caller writes it. A same-file `const` is not read: the literal at the component is the one form (defaults 2, 6).
- D3 (0597, check half): no registry. Every path by which Keel learns about a stdlib package trusts the name `@keel/std-[a-z0-9-]+` resolved from the project's `node_modules`, so a package-declared list would let any such package, an app's own workspace package included, exempt its exports from E1111. The audited list in `@keel/check` stays, closed, with one entry (`tableSearch`, `@keel/std-tables`); k.privacy says so, and says that a schema a package exports is the package's, which is what the rule does today. The sound name-free route, E1111 read from the evaluated `routes.json`, is Questions 2.
- D4 (0596): E1576 reports every `#` specifier in app code. The check pipeline has no `package.json` or tsconfig in a rule's input, and a `#` specifier is resolved only through the nearest `package.json` `imports`, so the checker cannot show that one names no internal entry. App code names its own files by relative path and packages by name, the forms E1004, E1111, E1151, E1152 and E1822 read (defaults 6, 2).
- Budgets: `@keel/compiler` 29.75kb to 30kb and `@keel/check` 48kb to 48.25kb (default 7). `@keel/ui`, `@keel/ui/aria`, `@keel/router` are unchanged; `@keel/std-tables` grows 4 B and fits.

New codes: E1823 (k.aria). E1576 widens.

## Problem
Measured on `jdforsythe/test-impl` at `abdb3bf`.

- **0599.** k.ui says only which reactive values make an element bound: "A base element with an event prop, a `field`, or a signal or computed (`value`, `checked`, `disabled`, a style prop, a child) is bound" (`spec/kernel/k.ui.md:15`). It says nothing about getter props. The runtime binds them:
  - Compiled JSX passes `label={expr}` as `get label() { return (expr); }`; a string or number literal (`label="x"`, `label={"x"}`) is a plain value, a JSX element value a getter returning the lowered node, and a bare attribute `true` (`packages/compiler/src/internal/lowerFile.ts:568-575`).
  - Every writer checks for a getter: `labelled` binds the label's text node (`packages/ui/src/internal/labelled.ts:32`) and, for a getter `id`, the control's id and the label's `for` (`:26-36`); `attrOf` binds an attribute when its prop is a getter (`attrOf.ts:11-14`), used for `Box label` (`aria-label`, `Box.ts:34`), `Image src`, `alt`, `decorative`, `Link to`, `Button type`, `Input type`, `name`, `autocomplete`, `TextArea rows`, `id` and `lang` everywhere (`applyIdLang.ts`); `applyDisabled` binds a getter `disabled` (`applyDisabled.ts:17`); `keptFirst` a getter `value` or `checked` (`Input.ts:71`, `Checkbox.ts:59`, `Select.ts:87`, `TextArea.ts:65`); `Select options` re-renders in an effect (`Select.ts:58-67`); `applyStyle` binds `class` when a style prop is a getter (`applyStyle.ts:12-21`, `isDynamic.ts`).
  - Read at build: `Box as`, `Text as`, `Heading level` (the tag, `tagOf`), `Part role`, `field` (`labelled.ts:40-41`), the `children` thunk (`renderChildren.ts:6`), event props (`listen(el, "click", props.onClick)`, `Button.ts:36`), and an id derived from the first `label` (`controlId`, `labelled.ts:24`), which keeps ids stable.
  - `packages/ui/test/keptRow.test.ts:1-3` already pins "every prop a control renders is bound when it is a getter" across all ten base elements.
  - The types: base elements take `label: string`, `value: string | Computed<string>`, `disabled: boolean | Computed<boolean>` (`Input.ts:28`, `:31`, `:40`); a getter in an object literal has the type of its value, so the types already accept it. `Part` takes `V<T>`, a value, signal or computed, for every ARIA prop (`packages/ui/src/aria/PartProps.ts:7`), and binds a getter too (`Part.ts:72`); k.aria says so (`spec/kernel/k.aria.md:27`).
  - The one frozen label in the repo is a hand-built call: `TableSearch` returns `Input({ label: props.label, ... })` with the comment "Read once: k.ui `Input` takes `label` as a string" (`packages/std-tables/src/TableSearch.component.ts:59-62`). A scan of `packages/std-*/src` for a prop copied from `props` into a base element call finds no other (std-headless binds labels with `computed`, `internal/nameOf.ts:8-11`; DataTable passes `get to()`).
  - Tried on a scratch copy: a new test where an app's signal changes `TableSearch`'s `label` fails today and passes with `get label() { return props.label; }`; the draft `live-props` conformance below passes on today's `@keel/ui` with no source change. Suites: `@keel/ui` 219 tests green, `@keel/std-tables` 46 green, `tsc --noEmit` clean in both.
- **0594.** `collectStyles` reads `styles` only when its value is an object literal and skips any other value, and any spread or non-literal part inside it, with no diagnostic (`packages/compiler/src/internal/collectStyles.ts:242-254`). The CSS for `styles={shared}` is missing and nothing says so. The same silence holds for a base element's non-literal style leaf (`p={pad}`: `tokensOf` returns no token, `:58-72`) and for every style prop in a hand-built call, since collection reads `a.jsx` only (`:174-178`); both are Known limits.
- **0597.** Two kernel lists name stdlib packages:
  - `SEARCH_FACTORIES` (`packages/check/src/internal/schemaMarks.ts:10`), read by `audited` (`:13-31`): a call of `tableSearch` imported from `@keel/std-tables`, by name or namespace, is `clean` for E1111.
  - `PART_STYLED` (`packages/compiler/src/internal/collectStyles.ts:38`): `styles` is collected only on a component imported from `@keel/std-headless` or `@keel/std-tables` (`:160-170`); `packages/compiler/test/partStyles.test.ts:28-41` pins that a look-alike `@keel/std-evil` and an app component are not collected.
  - How std packages reach the kernel today: `importDeps` imports each `deps` entry matching `@keel/std-[a-z0-9-]+` and its `./tools` export, resolved through the manifest folder's `node_modules`, "the trust level of `vite dev`" (`packages/compiler/src/std/importDeps.ts:11-12`, `:30-37`, `:40-49`); a `./tools` module registers check rules and config schemas in memory (`packages/std-messages/src/tools/index.ts`; k.module Std config). `stdRoutes` finds a stdlib module's routes by the same name rule and the package's own `module.ts` (`packages/compiler/src/std/stdRoutes.ts:6`, `:24-44`). `std.json` holds module config keyed by package name. Every one of these trusts the name.
  - What E1111 already trusts: `followValue` returns `"package"` for any binding whose import specifier does not start with `.` (`packages/check/src/internal/followValue.ts:90`, `:123`), and `schemaMarks` treats it as `clean` (`schemaMarks.ts:52`). A schema an app moves into any package, or names through a `#` or tsconfig alias, is unread. The audited list adds one case: a package function called with app arguments.
- **0596.** E1822 and E1576 match specifier text (`packages/check/src/rules/ariaImport.ts:11`, `noInternalEntry.ts:7`); `ariaImport.ts` says "A package `imports` alias (`#aria`) is not followed: the checker reads no `package.json`". A rule's input is `{ file, ast, artifacts, project }` with `project` the code files only (`packages/check/src/types/RuleInput.ts`, `check.ts:85`, `:100`); `keel check` loads code, spec markdown, `.keel/` artifacts, deploy files and the ledger, no `package.json` and no tsconfig (`packages/cli/src/internal/readProject.ts:15-20`). The tree has no `#` specifier in `apps/`, `modules/`, `packages/*/src`, `tooling/`, `evals/` or a scaffold template, and no tsconfig `paths`.

## Proposal

### D1 (0599). Getter props, stated once
- **The rule.** One sentence in k.ui Base elements, after the event props: a prop given as a getter updates what it writes as its reads change; `as`, `level`, `role`, `field`, `children`, event props and an id derived from `label` are read at build. It covers `Part`, which k.aria makes "a base element in every k.ui sense". The existing bound sentence keeps the list of props that also take a signal or computed.
- **What changes in code.** `TableSearch.component.ts:59-62` passes `get label() { return props.label; }` and drops the comment. `@keel/ui` has no source change.
- **Why no wider types.** A computed `label` would be a second way to say what a getter says (default 2), and widening `label`, `alt`, `to` and the rest is a new user-facing API shape, which the defaults send to the user (Questions 3). A signal or computed differs from a getter in one way that stays: it makes the element bound (`data-k`), so its level resumes; a getter alone does not, because a compiled expression may be static (`applyStyle.ts:10-11`).

### D2 (0597, 0594). `styles` on any component, and E1823
- **Collection.** `collectStyles` reads `styles` on every JSX component whose tag is not a `@keel/ui` base element or `Part` (`uiBaseElements`, the `@keel/ui/aria` import). `PART_STYLED` and the std import loop go. An app wrapper that forwards `styles` to a std widget now gets its caller's literal collected, which today is dropped too.
- **E1823.** Reported at the attribute, the part or the spread, `styles not readable statically; write the object here`, `see: k.aria`, no fix:
  - the `styles` value is not an object literal (a binding, same file or imported, a call, `?:`, `??`);
  - a part's value is not an object literal (`{ table: t }`);
  - a spread or computed key inside it (`{ ...shared }`).
- **Not E1823.** `props.styles`, `props.styles.x`, `props.styles?.x`, and the same as a spread, where `props` is the first parameter of the component function holding the element (`componentFns`). The caller's literal is collected at the caller, and the caller's own non-literal is E1823 there. A style leaf inside a literal part follows k.ui as today: literals and the literal leaves of `?:`, `&&`, `||`, `??`.
- **What stays unreadable.** Any binding, including a top-level `const` object in the same file. Reading one would add a second form beside the literal, and sharing across files, the likely case, would still fail (default 2). A wrapper component that owns the literal is the way to share it.
- **Where it runs.** `compile` pushes `collectStyles`' diagnostics with the file's other rules (`packages/compiler/src/compile.ts:108`), so `keel check`, `keel build` and the Vite plugin report E1823. `@keel/check` lists it in `PIPELINE_CODES` and `EXPLANATIONS`.
- **Prototype.** On a scratch copy: the compiler suite is 990 of 992 green; the two failures are `partStyles.test.ts:28-34` and `:35-41`, which pin the old list. A compile of every `.tsx` under `apps/`, `packages/scaffold` and `evals/` reports no E1823.

### D3 (0597, check half). Keep the audited list, and say why
- **Every channel trusts a name.** `./tools` registration runs code from a package imported because its name matches `@keel/std-[a-z0-9-]+`; it cannot attribute a registration to the package that made it. A static declaration in a package's own `package.json`, found by resolving the `deps` name, is attributed by location, but the location is whatever the project installed under that name: an app's workspace package `@keel/std-evil` or a `link:` dependency passes both. A path alias can point the specifier `@keel/std-tables` itself at an app file, which defeats the list as well; a list names one audited export, a registry would trust every package under the prefix.
- **So.** The list stays in `@keel/check`, closed. An entry is added only with a conformance test, in its own package, that the export refuses a marked column when called (E2852 for `tableSearch` today). k.privacy states it, with the trust `followValue` already applies to every package export.
- **The name-free route** is the evaluated schema: `routes.ts` runs at build and `routes.json` holds each route's `search` as JSON Schema. With `x-keel-pii` on each marked node, as the OpenAPI generator writes it (`packages/cli/src/internal/toJsonSchema.ts:25`), E1111 could read the evaluated value whoever built it, and the list could go (Questions 2).

### D4 (0596). A `#` specifier is E1576
- `noInternalEntry` also reports a specifier starting with `#`, in the files E1576 covers, one finding per statement or call. Message: `#lib/x may name an entry internal to Keel packages; use a public entry`. E1822 is unchanged: the same import is E1576 once, not two codes.
- `ariaImport.ts`' comment and `packages/check/README.md` say that E1576 reports the alias.
- Tsconfig `paths` and a project's bundler aliases stay out of reach (Known limits).

## Alternatives
- 0599: widen label-like props to `V<T>` as `Part` takes; rejected for now (default 2; a new API shape: Questions 3).
- 0599: a k.ui Conformance clause per prop; rejected, `keptRow.test.ts` covers every prop as a test, and the clause names the controls the backlog line reproduces.
- 0594: read a same-file `const` object; rejected (default 2), and it leaves imports unread.
- 0594: collect nothing new and only diagnose; rejected, a wrapper's forwarded `styles` would still be dropped.
- 0597: `registerSearchFactory` or `registerPartStyled` called from `./tools`; rejected, any loaded package could register any name.
- 0597: a `keel` field in a std package's `package.json`, passed to `check()` by the CLI; rejected, the trust is the same name prefix and `check()` gains an input.
- 0597: keep `PART_STYLED` and add packages as they ship; rejected, the compiler would name each stdlib package and a wrapper would stay dropped.
- 0596: resolve `#` through the nearest `package.json` `imports` (conditions, `*` patterns), loading every `package.json` in `keel check`'s `query` scope and passing it to two rules; rejected for now (Questions 1).
- 0596: leave it as a stated limit; rejected (default 6: a guard costs one test in one rule).

## Spec diff
Token counts are ceil(chars/4) of the whole section after the change, measured on copies of `spec/kernel/*.md` at `abdb3bf`. No sentence a conformance header quotes changes.

### k.ui (1,415 to 1,494)
**Base elements**, after "a bound `field` updates first, then the prop runs.", inserted:

> A prop given as a getter (compiled JSX passes each non-literal value as one) updates what it writes as its reads change; `as`, `level`, `role`, `field`, `children`, event props and an id derived from `label` are read at build.

**Style props**, the sentence "Types accept any string shaped like a token name (...); whether the token exists is E1801.", replacement text:

> Types take a `TokenName` (an identifier or short numeric key: `16px` and `#fff` are type errors); a missing token is E1801.

**Conformance**, appended:

> - A getter `label` over a signal on an `Input`, `Select`, `TextArea`, `Checkbox` and `Box as="nav"` shows each write on the same element.

### k.aria (1,498 to 1,495)
**Part**, the sentence "A base element in every k.ui sense: built through the runtime's `element` in document order, so it resumes in place; takes ...", replacement text of its start:

> A base element in every k.ui sense (it resumes in place); takes

**Roles**, the sentence after the table, replacement text of its start (`label` takes a value, a signal or a computed, as the sentence's end says):

> `label` writes `aria-label`; wherever a role takes `label` it takes `labelledBy` instead, exactly one.

**Behavior**, the bullet "`tabIndex` is `0` or `-1`, never positive (type)." is removed: k.a11y Order and focus states it.

**Part styles**, replacement text (its last sentence, which a header quotes, is unchanged):

> **Part styles.** `styles` on any component is `{ <part>: { <style props> } }`: the compiler collects each part's style props from that literal as a base element's (k.ui), and the component passes them to the part's `Part` or base element. Any other value, part or spread is E1823, except `props.styles` or its members, collected where written. There and on `Part`, `states` also takes `selected` (`[aria-selected="true"]`), `checked` (`[aria-checked="true"]`, `:checked`), `expanded` (`[aria-expanded="true"]`) and `highlighted` (`[data-k-highlighted]`).

**Rules**, replacement text:

> **Rules.** E1822 `@keel/ui/aria` in app code (no fix: a `@keel/std-headless` widget, or `unsafe/`). E1823 unreadable `styles` (no fix).

### k.security (1,493 to 1,499)
**Reports**, the clause "without the write proof, since it changes no state, and answers 204", replacement text:

> without the write proof and answers 204.

**Rules**, appended after E1576's sentence:

> So is any `#` specifier (no `package.json` is read).

### k.privacy (1,179 to 1,190)
**Rules**, E1111's second sentence, replacement text:

> It also reports a route table, entry, `params` or `search` it cannot read statically (a factory call, a computed key); a route table or schema a package exports is the package's, and so is the schema an export on the checker's closed audited list returns, each one refusing a marked column when called (`tableSearch` from `@keel/std-tables`).

### Unchanged
k.compiler (1,498: E1823 lives in k.aria, so the `k.artifacts` split is not needed), k.check (1,495), k.module (1,498), std.tables, std.headless. `spec/00-map.md` already maps E18xx to k.ui, k.a11y and k.aria.

## Conformance diff
Written by the `conformance-writer` from the sentences above. This RFC allows these changes under `packages/*/conformance/**`.

New files:
- `packages/ui/conformance/live-props.test.ts`: `// Spec: k.ui Conformance, "A getter `label` over a signal on an `Input`, `Select`, `TextArea`, `Checkbox` and `Box as="nav"` shows each write on the same element."` and `// Spec: k.ui Base elements, "A prop given as a getter (compiled JSX passes each non-literal value as one) updates what it writes as its reads change; `as`, `level`, `role`, `field`, `children`, event props and an id derived from `label` are read at build."` A property over label words (seed 1337) for the first; getter `as` and `level` keep their first tag for the second. A draft passes on today's `@keel/ui`.
- `packages/compiler/conformance/part-styles-any-component.test.ts`: `// Spec: k.aria Part styles, "`styles` on any component is `{ <part>: { <style props> } }`: the compiler collects each part's style props from that literal as a base element's (k.ui), and the component passes them to the part's `Part` or base element."`, `// Spec: k.aria Part styles, "Any other value, part or spread is E1823, except `props.styles` or its members, collected where written."` and `// Spec: k.aria Rules, "E1823 unreadable `styles` (no fix)."` Cases: an app component's literal `styles` is collected; `styles={shared}` (a same-file `const`), `styles={{ table: t }}` and `styles={{ ...x }}` are each one E1823 and add no usage; `styles={props.styles}` and `{ ...props.styles, table: props.styles?.table }` are none.
- `packages/check/conformance/security-e1576-hash.test.ts`: `// Spec: k.security Rules, "So is any `#` specifier (no `package.json` is read)."` Cases: `import { a } from '#lib/a'` in `modules/a/x.ts` and `import('#x')` in `test/a.test.ts` are each one E1576; the first in `packages/std-x/src/a.ts` or `node_modules/@keel/std-x/a.ts` is none.

Changed files:
- `packages/check/conformance/fixtures-by-code.ts`: an `E1823` entry after `E1822` (`:784-788`): bad `<DataTable styles={shared} />` with `const shared` in the file, clean the same with a literal.
- `packages/check/conformance/fix-diffs.test.ts:338`: `NO_FIX` gains `"E1823"`.
- `packages/ui/conformance/aria-focus.test.ts:4`: the comment cites k.a11y Order and focus for the `tabIndex` rule; the test at `:146` is unchanged.

Existing tests that break: `packages/compiler/test/partStyles.test.ts:28-34` and `:35-41` (they pin that a look-alike package's and an app component's `styles` are not collected); both flip to "collected". No other suite breaks on the prototype: `@keel/check` 1,184 green with the fixtures above, `@keel/compiler` 990 of 992 (those two).

## Lanes and build order
1. Orchestrator: the spec text above, one commit.
2. `conformance-writer`: the conformance diff, in the `rfc:0099` PR.
3. Kernel agent, one lane: `@keel/compiler` first (`collectStyles`, `compile.ts`, `partStyles.test.ts`, the doc comment), then `@keel/check` (`PIPELINE_CODES`, `EXPLANATIONS` rows E1823 and E1576, `noInternalEntry`, `ariaImport.ts` comment, README), since the E1823 fixture runs through `compile`.
4. std lane, in parallel with 3: `@keel/std-tables` `TableSearch` getter and a `test/liveProps.test.ts` case.
5. Orchestrator: budgets, root `check`, `test`, `build`, the ledger on a quiet tree, backlog 0594, 0596, 0597, 0599 closed and the Known limits filed.

## Migration
- Apps: nothing fires. No `#` specifier and no non-literal `styles` in the repo; golden-2's `CatalogPage.tsx` and `BoxShell.tsx` write literals.
- Std packages: `TableSearch`'s label follows its prop. The other std components already bind theirs.
- Behavior: an app component's literal `styles` now reaches the CSS file, and E1801 checks its tokens.
- Scaffold templates: unchanged.
- Docs: `packages/check/README.md` (E1576, E1822 lines); `evals/tasks/golden-2-catalog/spec-slice.txt:29` may say "any component" for part styles.
- An app outside the repo that uses `#` imports gets E1576 for each and moves them to relative paths.

## Token impact
| Section | Before | After |
| --- | --- | --- |
| k.ui | 1,415 | 1,494 |
| k.aria | 1,498 | 1,495 |
| k.security | 1,493 | 1,499 |
| k.privacy | 1,179 | 1,190 |

`keel explain E1823` is one row under 120 tokens.

## Budget
Measured with `tooling/budgets.mjs`' bundle settings on the scratch prototype.

| Entry | Limit | Before | After |
| --- | --- | --- | --- |
| `@keel/compiler` | 29.75kb (30,464) | 30,420 | 30,639: re-base to 30kb |
| `@keel/check` | 48kb (49,152) | 49,015 | 49,154: re-base to 48.25kb |
| `@keel/std-tables` | 4.25kb (4,352) | 4,124 | 4,128 |
| `@keel/ui`, `@keel/ui/aria`, `@keel/router` | | 3,990, 3,143, 10,488 | unchanged |

The compiler bytes buy a diagnostic where CSS goes missing today with no word, and remove the stdlib list. The check bytes are E1823's explain row and pipeline code, which k.check Conformance requires of every reported code, and E1576's `#` case.

## Risks
- An app with a component prop named `styles` of another shape now gets its literal collected and its tokens checked by E1801. k.aria makes `styles` mean part styles on every component.
- E1823's exemption keys on the component's first parameter; a destructured parameter is E1401 already, and a renamed one (`p.styles`) is read through the parameter's own name.
- k.security is at 1,499 tokens and k.aria at 1,495; their next addition needs a trim or a split.
- `@keel/check` sits 254 B under its new limit.

## Known limits
- A getter prop does not make an element bound, so a getter `label` over a signal on a level with no other bound element stays server HTML in the browser, as a template binding that reads no store does (k.runtime islands).
- A base element's non-literal style leaf (`p={pad}`, `bg={props.tone}`) is still dropped silently, and style props and `styles` in a hand-built `.ts` call are never collected: `apps/sessions/modules/ops/Home.ts:42-60` builds its page with `Box({ p: "6", gap: "4", ... })` and `apps/sessions/.keel/styles.json` holds no usages, so that page ships classes with no rules. Recommendation: two backlog lines, E1823's reach widened to base element leaves, and collection of object-literal calls the compiler already reads (`a.calls`).
- Tsconfig `paths` and a project's bundler aliases are not read; a bare specifier is the package it names, for E1111, E1576 and E1822 alike.
- E1111 trusts every package's exported schema (D3).

## Questions
1. 0596: refuse every `#` specifier in app code, or resolve it through `package.json` `imports`? Recommendation: refuse. It closes the alias for E1004, E1111, E1151, E1152 and E1822 at once for a few bytes; resolving needs `package.json` in `keel check`'s input, Node's conditions and patterns in `@keel/check`, and still leaves tsconfig `paths`. Revisit if an app needs subpath imports.
2. 0597: drop the audited list for E1111 read from the evaluated `routes.json`? Recommendation: a backlog line now, not this RFC. It needs `x-keel-pii` in the router's `jsonSchemaOf` (`@keel/router` has 8 B of room), a k.compiler Artifacts sentence (k.compiler has 2 tokens: the `k.artifacts` split), and a rule for a project with no build yet.
3. 0599: let base element label-like props take a signal or computed, as `Part`'s do? Recommendation: no. A getter is the one way to pass a changing value; the type widening is a new API shape for the user to decide.
