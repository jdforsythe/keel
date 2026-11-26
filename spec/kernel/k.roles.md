# k.roles: Part roles for app widgets
status: implemented
**Roles.** `Part` (k.aria) also takes these roles, for the widget patterns the stdlib does not ship (a date grid, a tree, a slider, a radio group, a switch, a toolbar, a menu bar, a meter). Each is an element and its ARIA state; keyboard and focus behaviour is the component's own, through `onKey`, `focus` and `tabIndex` (k.aria).

| role | tag | props (required first) |
| --- | --- | --- |
| `grid` | `table` | `label`; `rowCount`, `colCount`, `multiselectable`, `readOnly` |
| `gridcell` | `td`, always writing `role="gridcell"` | none; `selected`, `disabled`, `readOnly`, `current` (`'date'`, `true`, `false`), `colSpan` |
| `tree` | `ul` | `label`; `activeDescendant`, `multiselectable` |
| `treeitem` | `li` | none; `expanded` (absent on a leaf), `selected`, `level`, `setSize`, `posInSet`, `disabled`, `label` |
| `slider` | `input type=range` | `label`, `min`, `max`, `value`; `step`, `valueText`, `orientation`, `disabled` |
| `radiogroup` | `div` | `label`; `required` |
| `radio` | `input type=radio` | `label`, `name`, `checked`; `value`, `disabled` |
| `switch` | `button type=button`, always writing `role="switch"` | `label`, `checked` (`true`, `false`); `disabled`, `describedBy` |
| `toolbar` | `div` | `label`; `orientation` |
| `menubar` | `ul` | `label`; `activeDescendant`, `orientation` |
| `menuitemradio` | `li` | `checked`; `disabled` |
| `meter` | `meter` | `label`, `min`, `max`, `value`; `low`, `high`, `optimum`, `valueText` |
| `progressbar` | `progress` | `label`; `value`, `max`, `valueText` |
| `region` | `section` | `label` |

`button` (k.aria) also takes `pressed` (a toggle button) and `describedBy`; `menuitem` also takes `hasPopup` (`menu`) and `expanded`, for a menu bar's submenus.

**Attributes.** Each optional prop writes one attribute (ARIA names unless marked HTML); a prop left undefined writes none.

| prop | roles | attribute |
| --- | --- | --- |
| `rowCount`, `colCount` | `grid` | `aria-rowcount`, `aria-colcount` |
| `multiselectable` | `grid`, `tree` | `aria-multiselectable` |
| `readOnly` | `grid`, `gridcell` | `aria-readonly` |
| `selected` | `gridcell`, `treeitem` | `aria-selected` |
| `disabled` | `gridcell`, `treeitem`, `menuitemradio`; `slider`, `radio`, `switch` | `aria-disabled`; HTML `disabled` |
| `current` | `gridcell` | `aria-current` |
| `colSpan` | `gridcell` | HTML `colspan` |
| `activeDescendant` | `tree`, `menubar` | `aria-activedescendant` |
| `expanded`, `level`, `setSize`, `posInSet` | `treeitem` | `aria-expanded`, `aria-level`, `aria-setsize`, `aria-posinset` |
| `min`, `max`, `value`, `step` | `slider` | HTML `min`, `max`, `value`, `step` |
| `valueText` | `slider`, `meter`, `progressbar` | `aria-valuetext` |
| `orientation` | `slider`, `toolbar`, `menubar` | `aria-orientation` |
| `checked` | `switch`, `menuitemradio` | `aria-checked` |
| `min`, `max`, `value`, `low`, `high`, `optimum` | `meter` | HTML, of those names |
| `value`, `max` | `progressbar` | HTML `value`, `max` |
| `pressed` | `button` | `aria-pressed` |
| `describedBy` | `button`, `switch` | `aria-describedby` |
| `hasPopup`, `expanded` | `menuitem` | `aria-haspopup`, `aria-expanded` |
| `required` | `radiogroup` | `aria-required` |
| `name`, `checked`, `value` | `radio` | HTML `name`, `checked`, `value` |
| `abbr` | `columnheader` | HTML `abbr` |

An ARIA boolean writes `"true"` or `"false"`; an HTML boolean is present or absent.

A `grid` holds `rowgroup`, `row`, `columnheader`, `rowheader` and `gridcell` parts; `columnheader` also takes `abbr` (the full name of a short header). A `treeitem`'s children sit in a `group` given `list` (a `ul`). `label` and `labelledBy` follow k.aria: where a role takes `label` it takes `labelledBy` instead, exactly one; on `treeitem` both are optional. `current` writes `aria-current`; `value`, `checked` and the numbers take a value, a signal or a computed.

**Native controls.** `slider` and `radio` are the platform's controls, so the platform gives their keyboard (arrows, Home, End, Page keys on a range; arrows and one tab stop over the radios sharing a `name`). `slider` takes `onInput(value: number)`; `radio` takes `onChange()`, called when it becomes checked. A `div` with role `slider` or `radio` is not offered: it would rebuild a native control.

**Keys.** Keel writes each role's states; the keys are the component's own, as ARIA's authoring practices give them, and no check judges them:
- `switch` and a `button` with `pressed` are native buttons: Space and Enter call `onClick`, where the component flips `checked` or `pressed`; `states.checked` styles a `switch` that is on. A `switch`'s children are its drawing; `label` or `labelledBy` is its name.
- `toolbar` and `menubar` are one tab stop: one item has `tabIndex` 0 and the rest -1, and `onKey` moves `focus` with ArrowLeft and ArrowRight (ArrowUp and ArrowDown when `orientation` is `vertical`), Home and End. In a `menubar`, ArrowDown, Enter or Space on a `menuitem` with `hasPopup` opens its `menu` and Escape closes it, focus back on the item.
- `menuitemradio`s in one `group` of a `menu` hold one `checked` item; Space and Enter check the focused one.
- `meter` and `progressbar` take no focus and no keys; a `progressbar` with `value` undefined is indeterminate. `region` is a landmark.
- A number a person types and steps (the spinbutton pattern) is `Input type="number"` (k.ui), not a role.

**Primitives.** The stdlib widgets' list behaviour is public in `@keel/std-headless` (std.lists): `listChart` (the active option, `move`, `jump`, typeahead and part ids over a list) and `stableRows`. No movement over two dimensions exists: a grid's key map is the component's own pure function.

**Conformance.**
- `grid` renders `<table role="grid" aria-label=...>`; `gridcell` a `<td role="gridcell">`; `current: 'date'` writes `aria-current="date"`.
- `tree` renders a `<ul role="tree">`; a `treeitem` with `expanded` false writes `aria-expanded="false"`, a leaf none; a `group` with `list` renders a `<ul role="group">`.
- `slider` renders `<input type="range" min max value aria-label>` with no `role` attribute; `valueText` writes `aria-valuetext`; `fire(id, { type: 'input', value: '4' })` calls `onInput(4)`.
- Two `radio` parts with one `name` in a `radiogroup`: `fire(id, { type: 'change' })` on the second calls its `onChange` once; neither has a `role` attribute.
- A `columnheader` with `abbr="Monday"` writes the `abbr` attribute.
- A `grid` with `rowCount` 6 and `readOnly` true writes `aria-rowcount="6"` and `aria-readonly="true"`; a `treeitem` with `level` 2, `setSize` 3 and `posInSet` 1 writes `aria-level="2" aria-setsize="3" aria-posinset="1"`; a `gridcell` with `colSpan` 2 writes `colspan="2"`; a `slider` with `disabled` writes the `disabled` attribute and no `aria-disabled`.
- A `grid` with one `row` of one `gridcell`, a `tree` with one `treeitem`, a `slider` and a `radiogroup` with two `radio`s each have no axe violations.
- A `gridcell` with `tabIndex` and `focus` from a signal: moving the signal from one cell to another focuses the second and leaves one cell with `tabindex="0"`.
- A `switch` with `label="Wifi"` and `checked` false renders `<button type="button" role="switch" aria-checked="false" aria-label="Wifi">`; `fire(id, 'click')` calls `onClick` once, and a signal bound to `checked` set true changes only `aria-checked` to `"true"`.
- A `button` with `pressed` true writes `aria-pressed="true"`, and with `describedBy="t"` writes `aria-describedby="t"`; without them it writes neither.
- `toolbar` renders a `<div role="toolbar" aria-label=...>`, `menubar` a `<ul role="menubar" aria-label=...>`, `menuitemradio` with `checked` true an `<li role="menuitemradio" aria-checked="true">`, and a `menuitem` with `hasPopup="menu"` and `expanded` false writes `aria-haspopup="menu" aria-expanded="false"`.
- A `meter` with `label="Disk"`, `min` 0, `max` 100 and `value` 40 renders `<meter min="0" max="100" value="40" aria-label="Disk">` with no `role` attribute; a `progressbar` with `value` undefined renders a `<progress>` with no `value` attribute.
- A `region` with `label="Details"` renders `<section aria-label="Details">` with no `role` attribute.
- A `switch`, a `toolbar` holding two `button`s, a `menubar` with one `menuitem`, a `meter`, a `progressbar` and a `region` each have no axe violations.
