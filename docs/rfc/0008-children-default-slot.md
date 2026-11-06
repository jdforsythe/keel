# RFC 0008: JSX children are `props.children`

Status: implemented

## Problem
The compiler lowers `<Button>Go</Button>` to `Button({}, { default: () => ... })`, but base elements read `props.children`, so every base element given JSX children renders empty in a compiled app. k.component does not say how children reach a component.

## Proposal
- JSX children of a component are its default slot and arrive as `props.children`, typed `Children = () => Node | Node[] | string`. A thunk, so children render lazily inside the child's scope.
- Lowering: `Button({ children: () => "Go" })`. A single static text child yields a string, a single element its node, several children a fragment node.
- Base elements accept `children` as a thunk or a plain `string | number | Node | readonly[]`, via one internal helper `renderChildren`.
- The second `slots` argument is reserved for named slots. No syntax for them exists yet; they are deferred to a later RFC. Until then `slots` is `undefined` from compiled code.

## Alternatives
- Base elements read `slots.default`: splits one concept across two APIs and breaks hand-built calls.
- Eager children: render outside the child's scope and ignore `If`/`For` ownership.

## Spec diff
k.component Shape: children sentence plus one Conformance sentence. k.ui Standard slots: note that `children` is the default slot.

## Conformance diff
Add `packages/compiler/conformance/children-default-slot.test.ts`. Existing tests unchanged.

## Migration
Components reading `slots.default` move to `props.children`.

## Token impact
About 50 tokens in k.component.
