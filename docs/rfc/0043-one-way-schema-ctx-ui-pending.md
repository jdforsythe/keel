# RFC 0043: One way for schema validation, random ids, styling, button text, and pending state

Status: accepted

## Problem
Backlog 0064 (docs/freeze-review.md §2 rows 4-8). Five surfaces each have two or three ways to do one thing (principle 1: every alternative is a hallucination target):
- **Schema.** `decode` is `parse` (`make.ts`: `decode: parse`). k.schema calls `decode` "the JSON inverse of `encode`", but it does exactly what `parse` does.
- **Ctx.** `random.uuid()` and `random.id(brand)` draw the same uuid from the same stream. One is typed and one is not.
- **UI styling.** Typed style props sit beside `styles({...})` plus a `class` string prop. `class` takes any string, so it is also a way around tokens.
- **Button text.** `<Button label="Save" />` and `<Button>Save</Button>` both render the text. When both are given, `label` silently becomes `aria-label`.
- **Pending.** A submission's in-flight state has three readers: `f.pending()`, `<Form loading>` (fed by a separate signal private to `Form`), and `route().pending`.

## Proposal

| surface | kept | removed | reason | migrated |
| --- | --- | --- | --- | --- |
| schema | `parse` (k.schema's primary derivation) | `decode` | identical function; `parse(encode(v))` is the round-trip | 34 (4 src, 23 schema tests and conformance, 5 runtime-dom, compiler 2) |
| ctx | `random.id(brand)` | `random.uuid()` | `id` is typed and draws the same stream; a raw token is `id('Caller')` | 30 (server `callerOf`, ctx and cli conformance, check E1601 hint, evals) |
| ui styling | typed style props (+ `states`) | `styles()`, `class` prop | props are the thesis; `class` is an untyped way around tokens; no a11y or testing hook needs it (tests address by `id`) | 7 (ui tests only; no app used it) |
| Button | children are the text | `label` | in-distribution (`<Button>Save</Button>`); `Link` already works this way; an icon button names itself with `<Image alt>` | 20 (golden-1 4, ui and testing conformance 12, skills, evals, check fixture) |
| pending | `f.pending()`, the one per-submission state; `route().pending` stays the router's busy flag | `<Form loading>` and `Form`'s private pending signal | the router's submit is the one writer. It sets `f.pending()` and folds into `route().pending`. Render from `f.pending()` (`<If when={f.pending()}>`, `disabled`) | 5 (router tests 4, forms fixture 1) |

`route().pending` is not a second way to read a submission. It answers a different question: the router is busy (a navigation, a revalidation, or any action). `settle` in `@keel/testing` relies on it.

## Alternatives
- **Keep `decode` as a JSON-only codec.** It would need its own semantics, such as rejecting non-JSON input that `parse` accepts. That is a new behavior, not a fix, and the round-trip needs nothing beyond `parse`.
- **Keep `uuid()` for raw tokens.** Branding a token costs one argument, and a `uuid()` beside `id()` is the dual surface.
- **Keep `class` for a11y or test hooks.** Neither needs it: tests and the inspector use `id`, and a11y comes from roles and required props.
- **`label` as `aria-label` only (freeze review).** `<Button label="Save" />` would then render an empty button that type-checks.
- **Keep `<Form loading>` derived from `f.pending()`.** That leaves two ways to render pending, and the slot cannot disable a button.
- **Narrow `route().pending` to navigation.** `settle` would then return while an action is in flight.

## Spec diff
- **k.schema.** Derivations: `parse` also takes `encode` output, and there is no `decode`. The "`decode` stays the JSON inverse" sentence is dropped. Secrets: "`parse` of the marker". Conformance: `parse(encode(v))` round-trips, and a schema has no `decode`.
- **k.ctx.** API: `random.float()` and `random.id(brand)`, the one way to mint. Rules: `crypto.randomUUID` names `ctx.random.id(brand)` without a fix. Conformance: `random` has no `uuid`.
- **k.ui.** Base elements: `Button` children (text, or an `Image` with `alt`), no `label`. Style props are the only styling. The Scoped styles paragraph is deleted. E1803 is the `style` attribute only. Conformance +1: no `styles` export, no `class` prop, no Button `label`.
- **k.forms.** The example renders `<If when={f.pending()}>` and `<Button type="submit">Save</Button>`. `pending()` is a submission's one pending state. The Slot is `error` only. Conformance: `<Form>` has no `loading` prop.
- **k.router.** Client: "(a form's own is `f.pending()`, k.forms)". Form: `<Form method action params? form? error?>`.
- **k.testing.** The a11y clause example becomes `<Button disabled>Save</Button>`.

## Conformance diff
Migrations only, no assertion weakened:
- **schema.** `decode` becomes `parse` in round-trip, optional-nullable, json, closed-and-member-unions, result, secret, and decode-strings. The secret marker cases also go through JSON text.
- **ctx.** sim-determinism, keel-test-env-sim, and three-implementations (`random: ["id", "float"]`).
- **cli.** test-sim-ctx.
- **ui.** base-elements-axe-core ("Button (image named by alt)") and events.
- **testing.** a11y-button (clause text), ui-base-elements-axe, ui-events-fire, ui-signal-style, and fixtures.
- **forms.** fixtures (drops `loading`).
- **check.** fixtures-by-code (E1601 and E1802 clean fixtures).

Additions:
- **schema `parse-rejects`.** "a schema has no decode": `"decode" in` is false, plus a type-level `not.toHaveProperty`.
- **ctx `random-id`.** "random has no uuid" in every mode, at runtime and at type level.
- **ui `one-way-style-and-button`.** New file.
- **forms `form-has-no-loading`.** New file.

## Migration
- `T.decode(x)` becomes `T.parse(x)`.
- `ctx.random.uuid()` becomes `ctx.random.id('<Brand>')`.
- `styles({...})` with `class={css.k}` becomes the same style props on the element. For reuse, write a component.
- `<Button label="X" />` becomes `<Button>X</Button>`. An icon button becomes `<Button><Image src alt="X" /></Button>`.
- `<Form loading={() => ...}>` becomes `<If when={f.pending()}>...</If>` inside the form.

Done in this RFC:
- **Source.** schema, ctx, ui, router `Form`/`FormProps`/`Router` docs, runtime-dom `islandProps`, services `exchange`, store `copy`, compiler `ModuleSchema`, server `callerOf`, and check (E1601 `randomUUID` hint, E1802 Button needs `children`).
- **Apps and docs.** golden-1, skills keel and keel-forms, evals spec slices and golden-1 TASK, and the READMEs.

Proposals for owners elsewhere:
- **@keel/compiler.** Drop `styles()` collection from `@keel/ui` imports (now dead).
- **@keel/check.** Drop the exported-`styles` half of E1803 and its explanation text. Map an excess `label` on `Button` to E1802 "use children" instead of E1751.

## Token impact
k.schema 1226 -> 1234; k.ctx 504 -> 529; k.ui 1119 -> 1124; k.forms 918 -> 965; k.router 1478 -> 1485; k.testing 1335 -> 1333. All are within 1,500.
