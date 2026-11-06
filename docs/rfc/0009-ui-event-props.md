# RFC 0009: closed event props on base elements

Status: draft

## Problem
Base elements take no event props, so an app cannot handle a click, toggle, or keystroke without a lowercase element, which E1805 forbids. Undo and per-row toggles in golden-1 are blocked on this.

## Proposal
- A closed set, one per element, no others: `Button.onClick: () => void`, `Checkbox.onChange: (checked: boolean) => void`, `Input.onInput: (value: string) => void`, `TextArea.onInput: (value: string) => void`, `Select.onChange: (value: string) => void`. `Link` navigates; `Box`, `Text`, `Heading`, `Image` have none.
- Handlers register through the runtime's delegated `on` (one root listener per event type), so `fire(id, ...)` reaches them and disposing the scope removes them.
- `on`'s first argument widens from `id: string` to `target: string | Element`. Base elements are built with `createElement` and are not yet in a render's cloned nodes when they register, so they pass the element itself.
- A bound `field` (k.forms) and `onInput`/`onChange` coexist: the field updates first, then the prop runs.

## Alternatives
- Allow `onClick` on every element: opens an unbounded surface and gives inert elements click handlers (a11y).
- Lowercase elements with `on*`: contradicts E1805.

## Spec diff
k.ui Base elements: list the event props. One Conformance sentence. k.runtime Ops: `on(target, type, handler)`.

## Conformance diff
Add `packages/ui/conformance/events.test.ts`. Existing tests unchanged.

## Migration
None; props are optional.

## Token impact
About 90 tokens in k.ui.
