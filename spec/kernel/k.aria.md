# k.aria: Widget parts
status: conformance-covered

**Part.** `@keel/ui/aria` exports `Part`, the element stdlib widgets are built from. A base element in every k.ui sense: built through the runtime's `element` in document order, so it resumes in place; takes `id` (required), `role`, `lang`, `hidden`, the style props and a `children` thunk; it is bound (`data-k`) when it has an event prop, a `focus` or `open`, or a signal or computed. Only kernel and stdlib code imports `@keel/ui/aria`; a file outside `packages/`, `node_modules/`, `.keel/` and `unsafe/`, tests included, that imports or re-exports it is E1822.

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
| `dialog`, `alertdialog` | `dialog` | `labelledBy`, `open`; `describedBy` (required for alertdialog), `onDismiss` |
| `status`, `alert`, `generic` | `div` | none |
| `navigation`, `group` | `nav`, `div` | `label` |
| `table` | `table` | `label`; `rowCount` |
| `rowgroup` | `tbody`, `thead` with `head` | none |
| `row` | `tr` | none; `rowIndex` |
| `columnheader`, `rowheader`, `cell` | `th scope=col`, `th scope=row`, `td` | none; `sort` (`ascending`, `descending`; columnheader), `colSpan` (cell) |

`label` is a string written as `aria-label`; wherever a role takes `label` it takes `labelledBy` instead, exactly one. `labelledBy`, `describedBy`, `controls` and `activeDescendant` are element ids (`aria-labelledby`, ...). A boolean writes `"true"` or `"false"`; `disabled` writes the attribute on `button` and `input` and `aria-disabled` elsewhere. ARIA props and `tabIndex` take a value, a signal or a computed (bound as k.ui's `value`); numbers and `sort` may be undefined.

**Behavior.**
- `tabIndex` is `0` or `-1`, never positive (type).
- `focus: boolean`, reactive: when it turns from false to true it is focused after the commit. Never at first render or resume.
- `onKey(key: KeyInput) => boolean` runs on `keydown` through the delegated table (k.runtime). `KeyInput` is `{ key, shift, alt, mod }`: `key` the DOM `key`, `mod` Ctrl or Meta. Returning true prevents the default.
- `onClick`, `onFocus`, `onBlur` (bound directly, k.runtime); `onInput(value: string)` on `combobox`.
- On `option`, `menuitem` and `menuitemcheckbox`, `mousedown` is prevented, so a click leaves focus where it was.
- When `activeDescendant` changes, the element it names gets `data-k-highlighted` (the previous one loses it) and is scrolled into view (`block: 'nearest'`).
- `dialog`, `alertdialog`: `open` true calls `showModal()` after the commit and focuses the first descendant that is a `button`, `input`, `select`, `textarea`, `a[href]` or `tabindex="0"`, else the dialog (`tabindex="-1"`). `open` false calls `close()` and returns focus to the element focused when it opened, if still connected. A close request (`cancel`) is prevented and calls `onDismiss`; a platform `close` while `open` is true calls it too.

**Part styles.** A component from a `@keel/std-*` package takes `styles={{ <part>: { <style props> } }}`; the compiler collects each part's style props as it collects a base element's (k.ui), and the component passes them to the `Part` or base element of that part. There and on `Part`, `states` also takes `selected` (`[aria-selected="true"]`), `checked` (`[aria-checked="true"]`, `:checked`), `expanded` (`[aria-expanded="true"]`) and `highlighted` (`[data-k-highlighted]`).

**Rules.** E1822 `@keel/ui/aria` imported by app code (no fix: use a `@keel/std-headless` widget, or a file under `unsafe/` with a justification).

**Conformance.**
- `option` renders `<li role="option" aria-selected="false">`; `tab` a `<button type="button" role="tab">`; `columnheader` a `<th scope="col">` and `dialog` a `<dialog>`, neither with a `role` attribute.
- `label` writes `aria-label` and `labelledBy` `aria-labelledby`; a signal bound to `expanded` changes only that attribute.
- `focus` turning true focuses the element; `focus` true at the first render, and at resume, leaves focus where it was.
- `fire(id, { type: 'keydown', key: 'ArrowDown' })` calls `onKey` with `{ key: 'ArrowDown', shift: false, alt: false, mod: false }`; a true return cancels the event, a false one does not.
- A `mousedown` on an `option` is default-prevented.
- Setting `activeDescendant` to an option's id gives that option `data-k-highlighted` and removes it from the one before.
- A `dialog` given `open` true has the `open` attribute and focus on its first `button`; a `cancel` event calls `onDismiss` and leaves it open; `open` false closes it and focuses the element focused before.
- `styles={{ option: { p: '2', states: { highlighted: { bg: 'accent' } } } }}` on a stdlib component puts the `2` rule and an `accent` rule under `[data-k-highlighted]` into the CSS file, once each.
- Each role rendered with its required props, inside its required parent and children (a `listbox` with one `option`, a `table` with one `row` of one `cell`), has no axe violations.
- E1822 fires on an app file importing `@keel/ui/aria` and not on one under `packages/` or `unsafe/`.
