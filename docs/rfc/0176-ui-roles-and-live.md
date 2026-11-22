# RFC 0176: k.ui and k.a11y: `Text role` for live regions, and E1826 for a status region inserted with its text

Status: implemented (ADR-0198). For backlog 0874 and 0932 (work package ui-roles-and-live, `tasks/p1/weaknesses-triage.md`).

## Decisions
- D1: `Text` takes `role?: 'status' | 'alert'`, written as the `role` attribute. A closed set of the two live-region roles a line of text carries (WCAG 4.1.3). k.ui already reads `role` at build, so the role is fixed when the element is made, as a live region needs.
- D2: a render check, E1826 (`@keel/testing`, k.a11y Render checks): after a `fire` or `settle()`, an element with `role="status"` that the root did not hold before, under a parent element it did, holding text. That is the one shape of 0932 a harness can see: a result line that appears with its text is inserted as a new region, and a screen reader announces a status region's changes, not its arrival.
- D3: `alert` is outside E1826. WAI-ARIA has user agents fire an alert event when an `alert` element is inserted, so an inserted alert with text is announced.
- D4: E1826 names no WCAG criterion in k.a11y Claims. A route with no live region at all passes it, so mapping it to 4.1.3 would give `a11y:<route>#4.1.3` the rung `example` for pages a person has not checked. 4.1.3 stays in the evidence bundle's list for a person.
- D5: a region inside a subtree the event inserted whole (a parent the root did not hold) is not E1826, nor is one on a page a navigation rendered (a `renderRoute` whose `route()` `id` or `params` changed). Both are a new view, where k.head moves focus or the region is not the change the user caused; flagging them would fail tables and widgets that bring their own `status`.
- D6: k.ui and k.a11y read `implemented` until the conformance-writer and the build land (as RFC 0170 D7): each gains a clause the ledger holds at `none`, and `keel ledger --diff` refuses a `conformance-covered` section with one (E1707). Nothing becomes `frozen`.

## Problem
- 0874. `Text` (`packages/ui/src/elements/Text.ts`) takes `as`, `id`, `lang`, style props and children; no `role`. App code that shows a line of text a screen reader should hear (a saved notice, a result count, an error after a request) has `Part` from `@keel/ui/aria` (k.aria: `status`, `alert`, `generic` render a `div`), which needs an `id`, renders a block, and is the widget-building surface rather than the copy surface. `Text` is where app copy lives.
- 0932. `@keel/ui` has no live region for app code; std-headless `Toaster` is the only live output (`std.headless`), and it is a toast list with dismiss buttons, not a result line. The usual way a result appears after an action is a conditional child: `{() => saved() ? <Text>Saved</Text> : null}`. Even with a `role="status"` on it, that inserts a new region with its text, which NVDA, JAWS and VoiceOver mostly do not announce: a status region is announced when its content changes after it is in the accessibility tree. Nothing in Keel says so, and nothing reports it. k.head already relies on status regions (focus falls to the page's first `role="status"` when a navigation removes the focused element), so the role is in use; the authoring rule around it is missing.

## Proposal
### `Text role` (k.ui Base elements)
```tsx
// The region is there from the first render; the action changes its children.
<Text id="save.result" role="status">{() => (saved() ? text.saved : '')}</Text>
<Text id="save.error" role="alert">{() => failure()?.message ?? ''}</Text>
```
`role` is `'status' | 'alert'`, optional, written as the attribute in server and client output; read at build (k.ui lists `role` among such props). Any other value is a type error. The role does not change `as`.

### E1826 (k.a11y Render checks)
After a `fire` or `settle()` (on a `renderRoute` handle, one that leaves `route()`'s `id` and `params` as they were), each element with `role="status"` that the root did not hold before the call, whose parent element the root did hold, and whose text content is not empty, fails the render with E1826 naming its element id.

```tsx
{() => (saved() ? <Text id="done" role="status">{text.saved}</Text> : null)}   // E1826 after the fire that saves
<Text id="done" role="status">{() => (saved() ? text.saved : '')}</Text>        // clean: rendered empty, then filled
```
It applies to any element with the attribute: a `Text`, a `Part` (k.aria) or a host element. Message: `<id>: a status region inserted holding text is not announced; render it empty first and change its children`. No fix (the restructure is the author's).

### What E1826 proves, and what it does not
- Proves: in the renders a test drives, no `status` region the user's own event caused appears already filled.
- Does not see: a region inserted empty and filled in the same event (its text is present after the event, so it is inserted holding text: reported, as it should be); a region in a page no test renders; a result line with no role at all; text changed inside an `aria-hidden` subtree; a region whose text changes too fast to be read. These stay with a person (4.1.3 in the evidence bundle).

## Alternatives
- **An announcer, `announce(text)`, writing into one document-level region the kernel renders.** Works for an inserted line too. Rejected: new kernel surface (a function, a region in every document, visually-hidden CSS outside the style vocabulary), under a provisional freeze, for a need `Text role` meets.
- **`Text` inserts a `status` region empty and writes its children a task later.** Makes the conditional pattern announce. Rejected: `settle()` runs no timers (k.testing), so every test would see the region empty after the event; and a base element that writes its children on its own clock is a second rendering path beside the runtime's.
- **`live?: 'polite' | 'assertive'` writing `aria-live`.** Rejected: `role` is the vocabulary `Part` and k.head use, and `aria-live` alone carries no role for `a11y.json` (E1702) to compare.
- **More roles on `Text` (`note`, `log`, `timer`, `marquee`).** Rejected: no finding asks for them, and `log`, `timer` and `marquee` belong to widgets (`Part`), not a line of copy.
- **E1826 as a static check.** Rejected: whether a region is rendered conditionally depends on reactive children, components and slots that a file read cannot follow; the harness sees the DOM.
- **E1826 mapped to 4.1.3.** Rejected (D4).
- **E1826 for `alert` too.** Rejected (D3).

## Spec diff
Applied in this commit:
- **k.ui** (status `implemented`, D6): Base elements, after the `lang` sentence: "`Text role` takes `status` or `alert`, written as the attribute: a live region (WCAG 4.1.3), announced when its children change, so it is rendered from the first render (empty if need be) and its children change; a `status` region inserted holding text is not announced (E1826, k.a11y)." Conformance gains bullet 16.
- **k.a11y** (status `implemented`, D6): Render checks gains the E1826 sentence; Rules gains "E1826 a `status` region inserted holding text (render; no criterion in Claims)"; Conformance gains bullet 13.
- **Map**: the k.ui and k.a11y rows read `implemented`. Block E18xx already lists both sections.

Clauses:
- k.ui #16: `Text role="status"` and `Text role="alert"` write that `role` attribute in server and client output; a `Text` without `role` writes none; any other `role` is a type error.
- k.a11y #13: a `fire` that inserts `<Text id="done" role="status">Saved</Text>` under an element rendered before it fails with E1826 naming `done`; a `Text role="status"` rendered empty at the first render and given `Saved` by the `fire` passes, as do a `Text role="alert"` inserted holding text and a `role="status"` region inside a subtree the `fire` inserted whole.

## New codes
| code | owner | meaning |
|-|-|-|
| E1826 | k.a11y | a `role="status"` region a `fire` or `settle()` inserted under an existing parent, holding text (render check, no fix) |

E1826 was free: E1822 to E1825 are taken, and no spec, package or RFC names E1826.

## Conformance diff
By the `conformance-writer`, under `rfc:0176`, from `pnpm spec k.ui` and `pnpm spec k.a11y` (and `pnpm spec k.testing` for `render`, `fire`, `settle`):
- `packages/ui/conformance/` (new file, `text-role.test.ts`): k.ui #16, server output (`renderToString` or a `renderRoute` document) and client output, the absent case, and the type error under `@ts-expect-error`.
- `packages/testing/conformance/` (new file, `a11y-live-region.test.ts`): k.a11y #13, the four cases through `render` and `fire`, and the `renderRoute` navigation case of D5 if the writer wants it pinned.

## Build
- `@keel/ui`: `Text` takes `role` (`packages/ui/src/elements/Text.ts`), written once at build.
- `@keel/compiler`: `roleFor` and the element collector record `Text`'s literal `role` in `a11y.json`, so E1702 agrees with the harness.
- `@keel/testing`: E1826 in the render checks that follow `fire` and `settle()` (a snapshot of the root's `role="status"` elements before the call); `keel explain` entry for E1826 (at most 120 tokens).
- Stdlib: the build runs the std-headless and std-tables render tests; a widget that inserts a filled `status` region under an existing parent renders it empty first. `Combobox`'s `empty` and `Toaster`'s regions are rendered from the first render today.
- Docs: the `keel-client` skill (one line under a11y: `Text role`, render the region first; E1826 in its description), `packages/ui/README.md`, `packages/testing/README.md`, `docs/A11Y-TARGET.md` (4.1.3: `Text role` and E1826 help, a person still checks).
- Ledger: k.ui #16 and k.a11y #13 are in `tooling/ledger/ledger.json` at `none` (this commit); the build raises them and the sections go back to `conformance-covered`.

## Token impact
k.ui 6,000 to 6,454 characters (1,614 tokens); k.a11y 6,000 to 6,750 (1,688 tokens); both under the 1,750 section budget. Map 1,363 tokens (two status words shorter). One code. The `keel-client` skill gains about 40 tokens.

## For the operator
1. E1826 fails a render (render checks have no warnings), so a test of a page that shows a filled status line after an action fails once built. Neither golden app has a `role="status"` in app code today (`grep` of `apps/`). Recommendation: accept; the line was never announced.
2. The golden apps' result lines (a save notice, a count after a search) have no role now. Recommendation: a golden-polish backlog line to give them `Text role="status"` rendered from the first render, so the apps show the pattern.
