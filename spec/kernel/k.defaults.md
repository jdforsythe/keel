# k.defaults: Queued default actions
status: proposed

What the browser does for an event the pre-resume queue holds (k.runtime, k.resume Replay), so that an action fired before its island resumes happens once.

**Submit.** A `submit` on a form inside an island that has not resumed is queued with its default prevented at capture. At replay its handlers run as for any queued event; if none called `preventDefault()`, the runtime then submits the form once, natively, with no second `submit` event, as the browser would have: the submitter's `name` and `value` in the data, and its `formaction`, `formmethod`, `formenctype` and `formtarget` used. A queued submit whose island has no component, so no root encloses it, is submitted the same way once the queue replays. One whose form left the document (its island re-rendered, E1253) is dropped. During replay such an event's `defaultPrevented` reads `true` whatever the handlers did.

**Links.** A `click` inside an `a[href]` is not queued unless the link is to a fragment of the same document (`href` starting `#`): the browser follows it at once, and no island handler sees that click. A fragment link's click is queued and replayed; its scroll has already happened.

**Others.** Every other queued event keeps the default action it had when it fired, and a handler's `preventDefault()` at replay changes nothing: a checkbox or radio is toggled and its `input` and `change` replay; typed text stays and its `input` replays (a value typed before the queue existed is synced by k.runtime's `input`); `keydown` Enter in a field submits through `submit` above; `reset` resets. A `submit` outside every island, or in one that has resumed, is not touched by the queue.

**Rules.** None.

**Conformance.**
- A `submit` dispatched (`cancelable`) on a form in an unresumed island is `defaultPrevented` once dispatched; after `resume` its island handler, which calls `preventDefault()`, runs once, and the form is not submitted natively (stubbed `submit` and `requestSubmit` are not called) and no second `submit` event fires.
- The same with a handler that does not call `preventDefault()`: after `resume` the form is submitted natively once, its data holding the submitter's `name` and `value` and its `formaction` used, and a counting `submit` listener on `document` sees one event in all.
- A queued submit on a form in an island with no compiled component is submitted natively once after `resume`; one on a form in an island that mismatches and re-renders is not submitted.
- A `click` before `resume` on `<a href="/other">` in an island is not `defaultPrevented`, and its island handler does not run after `resume`; on `<a href="#part">` the handler runs once after `resume`.
- A click before `resume` on a checkbox in an island leaves it checked; its `change` handler runs once after `resume`, and a click handler calling `preventDefault()` then leaves it checked.
- A `submit` on a form outside every island, or in a resumed island, is not `defaultPrevented` by the queue.
