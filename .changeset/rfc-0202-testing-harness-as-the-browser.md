---
"@keel/testing": minor
"@keel/cli": patch
"@keel/check": patch
---

A `render`, `renderRoute` or `resumeDocument` made in a test is disposed when the test ends, pass or fail, after its `afterEach` hooks; one made in `beforeAll` lasts until its own `dispose()`. `fire` `keydown` goes to the focused element, focusing a focusable target first, and is E1719 at an element that cannot take focus. `fire` `change` with `value` picks a select's option and fires `input` then `change`; E1726 for a pick a person cannot make. An error outside any test is one T0001 `uncaught: <code> <first line>` at its first app frame on both of `keel test`'s paths. `keel explain` gains E1726 and a rewritten E1719.
