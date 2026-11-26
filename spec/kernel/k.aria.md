# k.aria: Widget parts
status: implemented

**Part.** `@keel/ui/aria` exports `Part`, the element stdlib widgets build on. A base element in every k.ui sense (it resumes in place); takes `id` (required), `role`, `lang`, `hidden`, the style props and a `children` thunk; it is bound (`data-k`) when it has an event prop, a `focus` or `open`, or a signal or computed. App code imports it as the stdlib does; the roles for app widgets (`grid`, `tree`, `slider`, `radiogroup`): k.roles.

**Roles.** `role` fixes the tag and the ARIA props `Part` accepts (its props type is a union discriminated by `role`; a prop another role takes is a type error). The `role` attribute is written only where it differs from the tag's implicit role.

| role | tag | props (required first) |
| --- | --- | --- |
| `listbox`, `menu` | `ul` | `label`; `activeDescendant`, `orientation`, `multiselectable` (listbox) |
| `option` | `li` | `selected`; `disabled` |
| `menuitem`, `menuitemcheckbox` | `li` | `checked` (menuitemcheckbox); `disabled` |
| `combobox` | `input type=text` | `label`, `expanded`, `controls`; `activeDescendant`, `value`; writes `aria-autocomplete="list"` |
| `button` | `button type=button` | none; `controls`, `hasPopup` (`menu`, `listbox`, `dialog`), `expanded`, `disabled` |
| `checkbox` | `input type=checkbox` | `label`, `checked` (`true`, `false`, `'mixed'`) |
| `tablist` | `div` | `label`; `orientation` |
| `tab` | `button type=button` | `selected`, `controls` |
| `tabpanel` | `div` | `labelledBy` |
| `dialog`, `alertdialog` | `dialog` | `labelledBy`, `open`; `describedBy` (required for alertdialog), `onDismiss`, `returnFocus` |
| `status`, `alert`, `generic` | `div` | none |
| `navigation`, `group` | `nav`, `div` | `label` |
| `table` | `table` | `label`; `rowCount` |
| `rowgroup` | `tbody`, `thead` with `head` | none |
| `row` | `tr` | none; `rowIndex` |
| `columnheader`, `rowheader`, `cell` | `th scope=col`, `th scope=row`, `td` | none; `sort` (`ascending`, `descending`; columnheader), `colSpan` (cell) |

`label` writes `aria-label`; wherever a role takes `label` it takes `labelledBy` instead, exactly one. `labelledBy`, `describedBy`, `controls` and `activeDescendant` are element ids (`aria-labelledby`, ...). A boolean writes `"true"` or `"false"`; `disabled` writes the attribute on `button` and `input` and `aria-disabled` elsewhere. ARIA props and `tabIndex` take a value, a signal or a computed (bound as k.ui's `value`); numbers and `sort` may be undefined.

**Behavior.**
- `focus: boolean`, reactive: when it turns from false to true it is focused after the commit. Never at first render or resume.
- `onKey(key: KeyInput) => boolean` runs on a delegated `keydown` (k.runtime). `KeyInput` is `{ key, shift, alt, mod }`: `key` the DOM `key`, `mod` Ctrl or Meta. True prevents the default and stops propagation.
- `onClick`, `onFocus`, `onBlur` (bound directly, k.runtime); `onInput(value: string)` on `combobox`.
- On `option`, `menuitem` and `menuitemcheckbox`, `mousedown` is prevented, so a click leaves focus where it was.
- When `activeDescendant` changes, the element it names gets `data-k-highlighted` (the previous one loses it) and is scrolled into view (`block: 'nearest'`).
- `dialog`, `alertdialog`: `open` true calls `showModal()` after the commit and focuses the first descendant that is a `button`, `input`, `select`, `textarea`, `a[href]` or `tabindex="0"`, else the dialog (`tabindex="-1"`). `open` false, or removal while open, closes it and focuses the element `returnFocus` names, else the one focused at open, else `main`. A close request (`cancel`) is prevented and calls `onDismiss`; a platform `close` while `open` is true calls it too.

**Part styles.** `styles` on any component is `{ <part>: { <style props> } }`: the compiler collects each part's style props from that literal as a base element's (k.ui), and the component passes them to the part's `Part` or base element. Any other value, part or spread is E1823, except `props.styles` or its members, collected where written. There, on `Part` and in a `look` or `base` set, `states` takes every state below; on a base element, the first four. Each state's rule matches any of its selectors:

| state | selectors |
| --- | --- |
| `hover`, `focusVisible`, `active` | `:hover`; `:focus-visible`; `:active` |
| `disabled` | `:disabled`, `[aria-disabled="true"]` |
| `selected` | `[aria-selected="true"]` |
| `checked` | `[aria-checked="true"]`, `:checked` (a `checkbox`, `radio`, `switch`, `menuitemcheckbox`, `menuitemradio`) |
| `pressed` | `[aria-pressed="true"]` (a `button` with `pressed`) |
| `expanded` | `[aria-expanded="true"]` |
| `current` | `[aria-current]:not([aria-current="false"])` |
| `highlighted` | `[data-k-highlighted]` |

**Rules.** E1823 unreadable `styles` (no fix).

**Conformance.**
- `option` renders `<li role="option" aria-selected="false">`; `tab` a `<button type="button" role="tab">`; `columnheader` a `<th scope="col">` and `dialog` a `<dialog>`, neither with a `role` attribute.
- `label` writes `aria-label` and `labelledBy` `aria-labelledby`; a signal bound to `expanded` changes only that attribute.
- `focus` turning true focuses the element; `focus` true at the first render, and at resume, leaves focus where it was.
- `fire(id, { type: 'keydown', key: 'ArrowDown' })` calls `onKey` with `{ key: 'ArrowDown', shift: false, alt: false, mod: false }`; a true return cancels the event, a false one does not.
- A `mousedown` on an `option` is default-prevented.
- Setting `activeDescendant` to an option's id gives that option `data-k-highlighted` and removes it from the one before.
- A `dialog` given `open` true has the `open` attribute and focus on its first `button`; a `cancel` event calls `onDismiss` and leaves it open; `open` false closes it and focuses the element focused before.
- `styles={{ option: { p: '2', states: { highlighted: { bg: 'accent' } } } }}` on a stdlib component puts the `2` rule and an `accent` rule under `[data-k-highlighted]` into the CSS file, once each.
- Each role with its required props, parent and children (a `listbox` with one `option`, a `table` with one `row` of one `cell`) has no axe violations.
- An app file importing `Part` from `@keel/ui/aria` reports no diagnostic, and its `styles` are collected as a stdlib component's.
- With `brandTokens`, a `button` `Part` with `pressed` from a signal and `states={{ pressed: { bg: 'accent' } }}` has the `accent` rule under `[aria-pressed="true"]` in the CSS file, and setting the signal true changes only its `aria-pressed` attribute.
- With `brandTokens`, `states={{ disabled: { fg: 'textSecondary' } }}` puts its rule under both `:disabled` and `[aria-disabled="true"]`, so a `menuitemradio` with `disabled` true matches it; `states={{ current: { weight: 'bold' } }}` matches a `gridcell` with `current: 'date'` and not one with `current` false.
- `states={{ pressed: { bg: 'accent' } }}` on a base element `Button` is a type error, asserted by `tsc --noEmit` over `conformance/`, which the package's `check` script runs (`vitest run` does not type-check).
