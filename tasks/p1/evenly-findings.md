# Evenly findings, layers 1 to 3

Gaps in what an app author's agent is given. Each: skill or doc, what was needed, what it said or lacked, where the answer was.

1. keel-client, status text: the example `<Text role="status">{() => (saved() ? ... : "")}</Text>` gives a function child, which is E1406 here, and calls a signal as `saved()`, which is not callable. Needed `{status.get()}`. Found by the error and `k.component`.
2. keel (and keel-client): signals are read with `.get()` and written with `.set()`; no skill says so. Found in `packages/reactive/src/Signal.ts`.
3. keel-client: `Link` takes `to`, not `href`; only found through a type error.
4. keel-client / std.headless: a `Dialog` `trigger` renders inside the widget's own button, so a `Button` there fails E1703 nested-interactive. The skill lists Dialog but not that trigger is content only. Its E1703 fix line repeats the message.
5. keel-testing: `focusOrder()` lists the controls inside a closed Dialog (name input, save button), against "without disabled or hidden ones". Tests must compare relative order only. Possible package defect (repro: render a page with a closed `Dialog` holding an `Input`, call `focusOrder()`).
6. keel-testing: no way is named to address a `<Form>`; it has no `id`. `fire(buttonId, { type: "submit" })` is what submits. Found by trying.
7. keel-testing: a function property (over inputs, not a component or transaction) needs `fast-check`, `fc.assert` with `seed`; the skill shows only `properties()`. The app needs `fast-check` in devDependencies. Seen in household tests.
8. keel-testing: `prove` has no sum or reduce, so "balances sum to zero" (the design's invariant) cannot be proved; E1715 names `reduce`. Only structural invariants prove (ids unique, payer and shares belong to the trip). The sum is checked by `explore` plus a seeded property. A format type (std-text `line`) in a stored schema has no sort (E1715), so store `s.string` and use `line` in the form.
9. keel-client, forms: `f.field("parts.0")` on an array field cannot submit: `decodeStrings` reads `parts[]` or repeated keys, not `parts.0` (repro: `s.object({parts: s.array(s.int())}).decodeStrings({"parts.0":"1"})` is `required at parts`). Spec: k.forms "array indexes allowed". Workaround used: `s.record(s.string(...))` keyed by id. Record values are not coerced (stay strings), so the action parses numbers.
10. keel-client, forms: a record-key path from a template (`` `parts.${id}` ``) types as `string` and fails; a helper returning `` `parts.${string}` `` is needed. E1405's fix diff inlines the template again and brings the type error back.
11. keel-client: a client-only app can have a `POST` action (no server) in a file named `*.server.ts`; no skill says so. Found in `k.router` Execution and `k.boundary`.
12. keel (layout): a stored/schema file name must be the PascalCase export; `s.array` and `s.record` take one argument (no bounds); `store.get(key)` needs a key (whole state: read each key). None stated.
13. keel: editing any file makes `keel check` fail E1005 (stale `.keel/*`) until `keel build`; `pnpm check` runs biome only on `modules`. The skill does not say to build before check.
14. keel: E1752 offers only prose ("split it"), no diff. E1453 offers no diff either; the spec text is enough. E1601 for `Date.now()` gives a correct diff; for `crypto.randomUUID()` none, and the brand argument of `ctx.random.id` is not given. E1716 and E1715 "fix:" lines print stack frames.
15. keel (scaffold): `scaffold project` output has `index.html` title = deployable name `web` until a route `title` is set; not mentioned.
16. keel: no skill names `std-money`, `std-text`, `std-i18n` (Locale value is a plain literal of `Locale`), `std-brands` or `@keel/std-headless` Tabs; only `keel docs` does.
17. keel (testing, browser): no skill gives a way to open the built app in a headless browser; not done.
