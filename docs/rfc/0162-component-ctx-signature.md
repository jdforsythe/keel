# RFC 0162: k.component: the signature `(props, ctx)`, `ctx` required

Status: implemented (ADR-0184). Design RFC for workstream W13 step 1 of `tasks/p1/PLAN.md`, under decision D41 of `tasks/0963-to-p1/PLAN.md`. It lands before the kernel freeze flip.

## Decisions
- D1: a component is `(props: P, ctx: Ctx) => Node`. The second argument is the ctx; the `slots` argument, always `undefined`, is removed.
- D2: every caller passes a ctx: the runtime (`mount`, `resume`), the router, the server's render (the `createApp({ ctx })` object itself, the one its loaders get), the harness (`render`, `renderRoute`, `resumeDocument`, which make a sim ctx when given none) and the compiler's JSX lowering (the enclosing component's `ctx`). `mount` and `resume` require `ctx`.
- D3: a component that reaches no effect may leave the parameter out. One that declares it declares `ctx: Ctx`, never optional or defaulted, and nothing after it (E1407, fix diff).
- D4: the kernel's runtime ops and elements (`If`, `For`, `Match`, `Case`, `Boundary`, `@keel/ui` base elements, `Part`, `Link`, `Form`) take no ctx and are still called as `Op(props)` from a `.ts` file. A stdlib or app component that declares `ctx` is called from a `.ts` file as `Comp(props, ctx)`, which the type requires.
- D5: route `component` and `errorElement` are components: both get `(props, ctx)`.
- D6: E1407 stays: it collides with none of the other lanes' new codes (E1590, E1591, E1585, E1607, E2451 to E2458, E1824, E1825, E1161 to E1164). The server render's ctx is the `createApp({ ctx })` object itself (k.router), which a test observes with `===`.
- D7: no migration (D65 of `tasks/0963-to-p1/PLAN.md`): nothing is released, so the build lane rewrites the apps, fixtures and skills directly (Build order).

## Problem
1. **`ctx` is optional, so every component that needs it handles its absence.** k.component says `ctx` "is passed by the runtime from the mount or island root and by the harness from `render`", and types it `ctx?: Ctx` (`packages/runtime-dom/src/types/Component.ts`, `testing/src/types/TestComponent.ts`, `router/src/types/RouteDef.ts`). `MountOptions.ctx` and `ResumeOptions.ctx` are optional, and `resumeIsland` takes `ctx: Ctx | undefined`.
2. **The absence is handled by silent degradation.** `std-headless/src/Toaster.ts:69` skips auto-dismiss when `ctx === undefined`; `std-headless/src/internal/listChart.ts:102` reads `ctx?.clock.now()`, so typeahead in Listbox, Combobox and Menu has no clock without one; `std-tables/src/TableSearch.component.ts:29` falls back to `router?.ctx`. golden-2's `NearestMarket.tsx` and golden-1's `Suggestions.tsx` each branch on `ctx === undefined` and reject or render a placeholder. None of these branches is reached by a generated entry or the harness, which always pass a ctx; each is dead code that a test must still cover, or a bug where a hand-written `mount` left the ctx out.
3. **The middle argument carries nothing.** Named slots are props (k.component Slot props) and the default slot is `props.children`; the second argument "is always `undefined`", and a conformance clause asserts it. Every component that reaches an effect writes `(props, _slots?: undefined, ctx?: Ctx)` (or `_slots?: Slots`): 22 source and app files declare it (golden-1 6, golden-2 3, apps/sessions 1, std-headless 7, std-tables 1, and the kernel types `Component`, `Island`, `RouteDef` and `TestComponent`), 10 test and conformance files more, and the kernel passes `undefined` in the middle at five call sites in four files (`mount.ts`, `resumeIsland.ts` twice, `renderChain.ts`, `testing/src/render.ts`); the `keel` skill teaches `(props, slots, ctx?)`.
4. **The compiler adds hidden parameters to match.** `ctxParams` in `packages/compiler/src/internal/lowerFile.ts` appends `<ns>props, <ns>slots, <ns>ctx` to a component function that renders a child component, and each lowered call passes `, undefined, <ctx>`. A function that declares a destructured third parameter or a rest parameter passes no ctx at all.

## Proposal

### 1. The type
```ts
// @keel/runtime-dom
export type Component<P = Record<string, never>> = ((props: P, ctx: Ctx) => Node) & { Props?: Schema<P> }
```
`TestComponent`, `Island` and the router's `component` and `errorElement` members take the same shape. A function with one parameter, `(props) => Node`, is assignable to it, so a component that reaches no effect needs no change. The three-parameter form `(props, slots, ctx)` is not assignable (its second parameter is `undefined`, which `Ctx` does not fit), so it fails to compile wherever a `Component` is expected.

### 2. The callers
- `mount(Component, el, { ctx, onError?, mode? })`, `ctx` required; `resume(..., { ctx, ... })` likewise. The generated entries already pass one.
- The router passes its own ctx (`createRouter` already requires it); the server render passes the app's.
- `render`, `renderRoute` and `resumeDocument` keep `ctx?` in their options: the harness makes a sim ctx from `KEEL_SEED` when none is given, as `render` does today, so the component always gets one.
- The compiler lowers `<Child a={x} />` inside a component to `Child({ get a() { ... } }, ctx)`, where `ctx` is the enclosing component's second parameter, which `ctxParams` adds as `<ns>ctx` when the function has fewer than two (and `<ns>props` when it has none). A component with a rest or destructured second parameter is E1407, so every component that renders a child has a ctx to pass.

### 3. Writing one
```ts
// modules/recipes/NearestMarket.tsx, after
export default function NearestMarket(props: Infer<typeof Props>, ctx: Ctx) {
  const market = resource(async () => {
    const at = await geo(ctx).position()
    // ...
  })
  return <Box>...</Box>
}
```
The `ctx === undefined` branch and its placeholder text go. Calling a widget from a `.ts` file passes the ctx it was given: `Menu({ id, trigger, items, onSelect }, ctx)`.

### 4. The rule
E1407 (k.component): a component's second parameter is optional, has a default, is destructured or is not typed `Ctx`, or a third parameter exists. Fix: rewrite the parameter list to `(props, ctx: Ctx)` (or `(props, _ctx: Ctx)` when the body never reads it), keeping the names used in the body. The checker reads the default export of a component file and every function the compiler lowers as a component; a `.ts` file calling a component with one argument where it declares `ctx` is a type error, not a diagnostic.

## Alternatives
- **Keep `ctx?`.** Leaves every branch in Problem 2 and the silent failures behind them.
- **Keep the `slots` argument and make the third required.** Every component that reaches an effect still writes a placeholder parameter, and `(props, undefined, ctx)` stays in every lowered call.
- **A context lookup (`useCtx()`).** The ctx would come from whatever root is rendering, an ordering invariant and action at a distance (PRINCIPLES 2); the explicit argument is how k.component reaches effects today.
- **Pass ctx to the runtime ops and base elements too.** They read no capability; requiring it would add an argument to 60 calls in stdlib `.ts` files (39 `Part(`, 9 `For(`, 7 `Box(`, 3 `Text(`, 3 `Link(`, 3 `If(` in `packages/std-*`, `ui`, `forms` and `router`) for no read.

## Spec diff
- **k.component** Shape: the signature sentence becomes "Signature `(props: Props, ctx: Ctx) => JSX`: every caller (runtime root, router, server render, harness, JSX parent) passes `ctx` (k.ctx), a component's only way to an effect (resource fetchers close over it). One that reaches none may omit it; declared, it is `ctx: Ctx`, last (E1407; fix `(props, ctx: Ctx)`)." The clause "the second argument is always `undefined`" goes. Conformance: the clause on `undefined` as the second argument becomes "Each caller passes a component a ctx second; `mount` without `ctx` does not compile", and an E1407 clause is added. The section is at 5,988 of 6,000 characters after this, so the other conformance bullets below stay in this RFC and ADR-0184.
- **k.runtime:** `mount(Component, el, { ctx, onError?, mode? })`, passing `ctx` as the root component's second argument.
- **k.router** Manifest: "`component` receives `{ params, search, data }`" gains "and a ctx: in a browser the router's, on the server the `createApp({ ctx })` object itself, the one its loaders get", with a Conformance bullet on that identity.

## Conformance diff
By the `conformance-writer` under `rfc:0162`:
- `mount(C, el, { ctx })` calls `C` with `({}, ctx)`, the same object; `mount` without `ctx` does not compile.
- A route page and its `errorElement` receive the router's ctx; a server-rendered page the `createApp({ ctx })` object itself (`===`), the one its loader gets; `render(C, { props })` a sim ctx, the same one its handle exposes as `ctx`.
- `<Child />` in a component's JSX gives `Child` the parent's ctx, also when the parent declares one parameter, and in an island resumed by `resume`.
- A component declared `(props)` renders unchanged from JSX, `mount` and `render`.
- `(props, _slots?: undefined, ctx?: Ctx)` as a component file's default export is one E1407 whose fix yields `(props, ctx: Ctx)` and clears it; `(props, ctx?: Ctx)` and `(props, ctx: Ctx = x)` are E1407; `(props, ctx: Ctx)` is none.
- A Toaster toast with `duration` dismisses itself after that time on the ctx's clock, rendered by `render` with no ctx given.

The suites written over the three-parameter signature are rewritten under `rfc:0162`: the 13 files in `packages/*/conformance/` that pass `undefined` as the second argument or declare `_slots`, among them the k.component clause on the second argument.

## Cost
- Bundles: `@keel/runtime-dom` and `@keel/compiler` lose the `undefined` argument and the `slots` name; the stdlib widgets lose their fallback branches. Each is measured at the build and its budget re-based to the measured number (D65 of `tasks/0963-to-p1/PLAN.md`).
- Spec: k.component about the same length (the signature sentence is shorter, E1407 is added); k.runtime one character shorter.
- One rule added (E1407). No glossary term changes.

## Build order
1. This RFC, ADR-0184, spec text. 2. `conformance-writer` under `rfc:0162`, beside RFC 0157's. 3. Build: runtime-dom (`Component`, `Island`, `MountOptions.ctx` and `ResumeOptions.ctx` required, `resumeIsland`, `Slots` deleted), compiler (`ctxParams`, the lowered call; `isSlotCall` stops recognizing `slots.<name>()`), router (`component`, `errorElement`), testing (`TestComponent`), check (E1407), std-headless and std-tables (their `undefined` branches and `TableSearch`'s `router?.ctx` fallback go). In the same stage the build lane rewrites golden-1, golden-2 and apps/sessions (the `ctx === undefined` branches of `Suggestions.tsx` and `NearestMarket.tsx` go), the fixtures, the scaffold's component template (`(props)`, and `(props, ctx: Ctx)` with `--ctx`) and the published skills `keel`, `keel-client` and `keel-testing` directly, beside RFC 0157's.

## For the operator
1. **Runtime ops and base elements take no ctx** (D4). Recommendation: accept; they read no capability, and the JSX lowering still passes the enclosing ctx to every component that does.
2. **A component may leave `ctx` out** (D3) rather than every component declaring it. Recommendation: accept; a pure view stays a one-parameter function, and the type still requires every caller to pass a ctx.
