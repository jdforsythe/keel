# ADR-0224: k.testing: renders disposed at test end, events sent where a browser sends them, uncaught errors located (RFC 0202)

**Status:** accepted (orchestrator, 2026-11-24, for the operator to confirm).

**Context.** `@keel/testing` aims to behave as the browser would for the events it offers. Four places fall short. A render ends only at `dispose()`, so a test that fails before it leaves its page in the document and the next page's render checks fail on it. `fire` sends a `keydown` to its target whatever holds focus, where a browser sends a key press only to the focused element (UI Events; HTML's focused area of the document), so a widget that acts on focus, such as APG Tabs, ignores it. `change` takes no `value`, so a select pick changes nothing, where a browser sets the option's selectedness and fires `input` then `change`. An error vitest reports outside a test is a T0001 with no location, while one `keel test` catches around the run carries a frame that may be a dependency's.

**Decision.**
- A `render`, `renderRoute` or `resumeDocument` handle made while a test runs (its body, `beforeEach` or `afterEach`) is disposed when the test ends, passed or failed, after its `afterEach` hooks; a route handle with every document it opened. A handle disposed by hand is not disposed again. A handle made outside a test is disposed only by `dispose()`.
- `fire(id, keydown)` dispatches at the focused element when it is `id` or inside `id`; with focus elsewhere and `id` focusable, it moves focus to `id` as `fire` `focus` does, then dispatches there; with `id` unfocusable, E1719 `<id> cannot take focus, so no key press reaches it`. The focus it moves is no person's act (k.opening).
- `fire(id, { type: 'change', value })` on a single `<select>` selects the enabled option of that value and dispatches `input` then `change`; the option already selected dispatches nothing. Any other element, a `multiple` select, or no enabled option of that value is E1726. `change` without `value` and `input` with `value` keep one event each; k.ctx `FireEvent` is unchanged.
- An app frame is a stack frame in an absolute path outside `node_modules`, not `node:`, not vitest's. Each error outside any test's result, from vitest or caught by `keel test`, is one T0001 `uncaught: <code> <first line>` at its first app frame, else at line 1 of the file vitest names, else unlocated. `catchingStray` makes it through `testResults`.

**Alternatives.**
- A setup-file `afterEach` for disposal: ordered against the app's hooks by registration, and only under `keelConfig`.
- E1719 for every keydown at an unfocused element: exact about the target, but each key test then opens with a `focus` line that adds nothing.
- `input` on a select firing `change` too: a recorded session replays its `input` and `change` one for one, and would send `change` twice.
- An unlocated uncaught error named by its test: the name is not always known, and a path is what a reader opens.

**Consequences.** A test no longer needs `dispose()` at its end, and a failed one leaves nothing behind. Key tests drop their leading `fire` `focus`; a key fired at an unfocusable element with focus outside it now fails, which may touch a few repo tests (`aria-onkey`, `fire-modifiers`). A select is tested as a user picks. Every T0001 of a `keel test` run names a place when the error has one. Disposal and results are a new section, k.test-run; k.testing is at 2,860 of its 3,100 tokens and the map at 1,408 of its 1,410.
