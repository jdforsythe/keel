# k.e2e-page: End-to-end pages
status: implemented
The page a `Served` handle opens (k.e2e): the harness's verbs (k.testing) on a real browser tab, how it waits, and what a failure prints.

**open.** `open(path, { deployable?, scripts?, hold? })` makes a browser context, loads `path` at the deployable's origin and resolves a `Page` once the document's `load` event has fired and the page is quiet (Waits). `scripts: false` runs no script of the page: none is delivered, and each document arrives without its script elements. With `hold: true` the document is shown with no script of the app run until `resume()`. A `Page`'s `open(path, { hold? })` opens another tab in its own context, sharing its cookies and storage.

**Verbs.** Each verb takes ids alone (k.testing), and an id the project cannot show is E1705 before anything is sent to the browser: one that is not in `.keel/ids.json`, not `<id>.<key>` under one of its ids, not under the fixed head or tail of a template id its or its libraries' source writes (`` `shop.row.${row.id}` ``, `` `${props.id}.chart` ``), not a form field's `<formId>:<path>` (k.forms), and not on the page when the verb is called (a widget's id composed at run time).
- `fire(id, event)`: `event` is k.testing's `TestEvent`, sent as a person's act: `click` a mouse click at the element's centre, `input` with `value` the element's text replaced by typing `value`, `change` with `value` the option picked, `keydown` a key press, `focus` and `blur` focus moved. It resolves once the page is quiet.
- `press(key)`: a key press at the focused element, `key` as `keydown`'s, `Tab` among them.
- `find(id)`: `{ id, role, name, text, state, value? }` as k.testing's (a host element's without `value`: its value is the runtime's, which the page does not expose), once the element is shown; not shown within the bound, E1735. `findAll(prefix)`: each shown element whose id begins `<prefix>.`, in document order, at once.
- `until(id, match, { within?, fixed? })`: resolves once `find(id)` matches `match`, `{ text?, name?, role?, state?, gone? }`: `text` a string equal to the element's text with white space runs made one space and the ends trimmed, or a `RegExp` it matches; `state` the given keys equal; `gone: true` no element with that id shown.
- `settle()`: resolves once the page is quiet. `focusOrder()`: the ids in tab order, as k.testing's.
- `a11y(id?)`: k.testing's tree, built in the page; then axe-core over the document with k.a11y's tags and rules, `color-contrast` among them as the browser renders it; a violation is E1703.
- `navigate(path)`, `reload()`, `back()`: as a person's address bar, reload and back, resolving as `open` does. `location()`: `{ path, entries }`, the path and query, and the tab's history length. `documents()`: `{ method, url, status }` per document the tab loaded, in order.
- `requests()`: the tab's request log (k.requests): each request the browser sent for it, documents, scripts and event streams among them.
- `cookies()`: `{ name, domain, path, httpOnly, secure, sameSite, expires }` per cookie of the context, no value.
- `fetch(path, init?)`: a request made from the test process with the context's cookies, as `Served` `fetch` otherwise; a `Set-Cookie` it answers is kept in the context.
- `offline(on)`: the context's network off or on, service workers' requests too.
- `scroll(y)`: the document scrolled to `y` CSS pixels from the top, as a person's wheel. `viewport({ width, height })`; `layout(id?)`: `{ x, y, width, height, scrollWidth, clientWidth }` of the element, or of the document with no `id`; `style(id, names)`: the computed values of `names`, each one of `color`, `background-color`, `font-family`, `font-size`, `outline-style`, `outline-width`, `outline-color`, `outline-offset`, `flex-direction`, `display`.
- `resume()`: on a held page, runs its scripts and resolves once every island has claimed and the page is quiet. It rejects E1720 (k.testing) when the claim removed or replaced an element the server sent, or moved focus, a control's value or caret, or the scroll position.
- `problems()`: the browser problems since the last call, each `{ kind, text }`, `kind` `pageerror`, `console` (an error) or `csp` (a policy violation), and clears them.

**Waits.** A page is quiet when no request it sent is unanswered but event streams (`text/event-stream`), no DOM change has happened for one animation frame, and no navigation is under way. Every wait above is bounded: 10 s, or `within` and `fixed` (k.e2e Time); a wait that runs out is E1735. A held page's parked scripts are not waited on until `resume()`. No verb sleeps for a time; each waits on a browser event or a DOM change.

**Problems.** A problem `problems()` has not returned by the end of a test fails it with E1738 naming the first: `pageerror Uncaught TypeError: ...`, `csp script-src blocked inline`.

**Failure output** (docs/OUTPUT.md). A failed e2e test is one T0001 at the test's line, its message the error's code and one line: `E1735 until shop.cart.count: text was "0", not "2", after 10.0s`. Below it, at most 10 lines `server: <record>`, the compact form of each record its `serve`'s deployables wrote from the start of the failing verb, then `screenshot: <path>` per open tab and `trace: <path>` per context. A context records a trace (DOM snapshots, network, console) from its `open`; on a failed test each is written under `reports/e2e/`, named `<file>-<line>-<n>`: `<file>` the test file's name less its `.ts` (`checkout.e2e`), `<line>` the T0001's line, `<n>` counting the tabs for `.png` and the contexts for `.zip` from 1; a passing test writes nothing there.

**Rules.** E1735 a wait of a page that ran out (`<verb> <id>: <what was seen> after <s>s`) · E1738 a browser problem the test did not read.

**Conformance.**
- `fire('a.add', { type: 'click' })` on a button whose handler posts to an action resolves after the action's answer has reached the page, and `find` then shows the text the answer set.
- `find('a.nope')` with `a.nope` absent from `.keel/ids.json` rejects E1705, and the browser receives no command for it.
- `until('a.status', { text: 'Live' })` on an element whose text is `Connecting` for the 10 s bound rejects E1735 whose message holds `a.status`, `Connecting` and `10.0s`.
- `until` with `within: 2000`, `fixed: 5000` under `KEEL_TEST_TIME_SCALE=0.5` waits 6 s before E1735.
- `settle()` on a page holding an open event stream and nothing else in flight resolves.
- `findAll('shop.row')` on a page with `shop.row.a`, `shop.row.b` and `shop.rows` returns `shop.row.a` and `shop.row.b`, in document order.
- `open('/list', { hold: true })`, `fire('a.name', { type: 'input', value: 'Mi' })`, then `resume()` keeps the input's `value` `Mi`, its caret at 2 (a `press('x')` then makes it `Mix`) and its focus, and resolves; an island whose claim replaces the input makes `resume()` reject E1720.
- After `offline(true)`, a click on a button whose handler fetches the page's origin leaves its `TypeError` among `problems()` and no entry for it in the server log; after `offline(false)` the same click is answered 200.
- `cookies()` after a form POST, the page's first write, which sets the caller cookie `keel-caller` (`HttpOnly`, `SameSite=Lax`; k.user), holds its name with `httpOnly: true` and `sameSite: 'Lax'` and no value.
- `documents()` of a page whose live update changed its text without a load holds one entry.
- A test whose page's click handler rejects with `new Error('boom')` (an unhandled rejection: app code may not `throw`, E1451), and that never calls `problems()`, fails with E1738 holding `boom`; calling `problems()` after the click returns it, and the test passes.
- A test that fails at `until` writes one `.png` and one `.zip` under `reports/e2e/` named after its file and its T0001's line, and its T0001 output lists the `server:` records of the requests made during that `until`; the same test passing writes nothing under `reports/e2e/`.
- `a11y()` of a page whose text is `#777` on `#fff` rejects E1703 naming `color-contrast`.
- On a page whose only focusable element is `a.button`, styled `outline: 2px solid` when focused, `press('Tab')` then `style('a.button', ['outline-style', 'outline-width'])` returns `{ 'outline-style': 'solid', 'outline-width': '2px' }`.
