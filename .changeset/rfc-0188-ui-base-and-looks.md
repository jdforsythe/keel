---
"@keel/ui": minor
"@keel/compiler": minor
"@keel/check": minor
"@keel/server": patch
"@keel/testing": patch
---

`tokens.ts` takes a `base` group (style sets for `page`, `heading`, `link`, `button`, `control`, `label`, `fieldError`, `summary`, and a `focus` color) and a `look` group of named style sets. `compileStyles` writes a `keel.base` cascade layer: `[hidden]` hidden, `body` with `overflow-wrap: anywhere`, each base set on its role class, and a 2px `:focus-visible` outline in `base.focus`; atomic rules stay unlayered, so any style prop wins. Base elements carry role classes (`k-heading`, `k-link`, `k-button`, `k-control`, `k-label`, `k-error`). `look="<name>"` on a base element, `Part` or in a part style lowers to the set's classes, the element's own props winning per prop and state. `Input`, `TextArea`, `Select` and `Checkbox` take `styles` parts `field`, `label` and `error`. `brandTokens` carries the brand's base and the looks `primary`, `secondary` and `control`. A `base.focus` under 3:1 against `base.page`'s `bg` is E1807. `keel check` reports E1809 for a `gap` with no `direction` at its smallest breakpoint. The no-script 422 summary names each field by its rendered label, links to it and carries `k-summary`. The render contrast check reads the base colors.
