# RFC 0202: k.testing: renders disposed at test end, events sent where a browser sends them, uncaught errors located

Status: implemented (ADR-0224), accepted by the orchestrator on 2026-11-24. Amends k.testing (Harness, Rules, Conformance) and adds k.test-run (disposal at test end, results). From walkthrough findings L2-4, L2-5 and L3-5, and the `keel test` reporter.

## Decisions
- D1: a harness handle made while a test runs is disposed when that test ends, passed or failed, after its `afterEach` hooks. A handle made outside a test is never disposed by a test's end.
- D2: `fire(id, { type: 'keydown' })` sends the key where a browser sends one: to the focused element. Focus on `id` or inside it: dispatched there. Focus elsewhere and `id` focusable: `fire` moves focus to `id` first, as the user did to press a key there. `id` unfocusable with focus outside it: E1719.
- D3: `fire(id, { type: 'change', value })` is a user's pick in a single `<select>`: the option is selected, then `input` and `change` are dispatched. `value` anywhere else, or naming no enabled option, is E1726. `change` without `value` and `input` with `value` keep their one event.
- D4: an error outside any test's result, reported by vitest or caught by `keel test` around the run, is one T0001 `uncaught: ...` at its first app frame, by the one frame rule both paths share.

`@keel/testing` aims to behave as the browser would for the events it offers. Each decision follows that, or, where a browser cannot produce what a test asks for, refuses it with a diagnostic.

## Problem
Four things app authors hit in the walkthrough and the `keel test` output.

**A render outlives a failed test.** `openHarness` (`packages/testing/src/internal/openHarness.ts`) appends a container to `document.body` and removes it only in `dispose()`. A test that fails an `expect` before its `page.dispose()` leaves the page in the document, its scope live and its seeded stores unrestored. In `apps/household/test/shoppingList.test.ts` the next test then failed at `renderRoute` with `E1703 landmark-unique: <main id="shopping.page">`, a page served by `app` judged against the one left behind, and the real failure was one line up. Without `app` the left page is kept out of axe's run (`pageRoots`), but it stays in the document: a scratch run of two route tests, the first failing before `dispose()`, ends with one container still in `document.body`. Nothing in k.testing says when a render ends but `dispose()`.

**A key press on an unfocused element.** `fire` dispatches every event at `id` (`eventFor`), whatever has focus. `Tabs` (std.options) opens its list state on focus (`onFocus: () => l.opened(...)`), as APG Tabs does, so `fire('tb.tab.apple', { type: 'keydown', key: 'ArrowRight' })` with no focus changes nothing; after a `fire(..., { type: 'focus' })` the same call selects `banana`. A keydown fired at the unfocusable `tb.list` while a tab holds focus also does nothing, where a browser would have sent the key to the tab and bubbled it through the list. A browser cannot produce either of these: UI Events sends a keyboard event to the focused element (HTML's currently focused area of the document, its DOM anchor; the body when nothing has focus), and a key press never moves focus by itself. The key only reaches `id` after the user put focus there, by Tab or by a click, and the focus events fired then.

**A select change that changes nothing.** `TestEvent`'s `change` has no `value`, and `eventFor` dispatches a bare `change` event. `fire('receipts.new:paidBy', { type: 'change', value: 'sam' })` fails `tsc` as an object literal with an unknown key, but vitest strips types, so the run drops `value`: the select stays at `alex` and its handlers read `alex`. `{ type: 'input', value: 'sam' }` sets the value and dispatches `input` alone. A browser does neither: when a user picks an option of a `<select>`, HTML sets that option's selectedness and then sends select update notifications, firing `input` (bubbles, composed) and then `change` (bubbles) at the select, so both handlers read the new `value`. A pick of the option already selected fires nothing.

**An uncaught error with no location.** `testResults` (`packages/testing/src/testResults.ts`, shared by `keel test` and the repository's vitest reporter) turns each error vitest reports outside a test's result into `T0001 <first line>` with no path. `catchingStray` (`packages/cli/src/internal/catchingStray.ts`), which holds `uncaughtException` and `unhandledRejection` around a `keel test` run, gives the same kind of error `T0001 <path>:<line>:<col> uncaught: <code> <first line>` at the first frame of its stack that is not `node:`, a `node_modules` or vitest frame included. Two paths, two shapes, and the vitest one names no place. Vitest's error already carries what is needed: its parsed `stacks` or `stack`, and `VITEST_TEST_PATH`, the file whose worker raised it.

## Proposal
### 1. Disposal at test end
A `render`, `renderRoute` or `resumeDocument` handle made while a test runs, in its body or one of its `beforeEach` or `afterEach` hooks, is disposed when that test ends, passed or failed, after its `afterEach` hooks: its elements leave the document, its scope is disposed and its seeded stores are restored, as `dispose()` does. A route handle is disposed with every document it opened.
- **By hand.** `dispose()` keeps its meaning and stays the way to end a render mid-test. A disposed handle is not disposed again: the end of the test restores nothing a second time, so a store written after a hand `dispose()` keeps the write. A second `dispose()` does nothing; methods of a disposed handle stay E1705.
- **`renderRoute`.** Every document the handle opened with `app` (each resumed answer, each navigation) and the route harness itself are disposed; each route harness already ends scrolled to the top.
- **Outside a test.** A handle made in `beforeAll`, a `describe` body or at module scope belongs to no test and is never disposed by a test's end. It lives until its `dispose()`, which an `afterAll` makes. A test that renders in `beforeAll` keeps doing so.
- **`afterEach`.** The test's `afterEach` hooks still see the render, so a hook that reads `t.state()` or restores a store keeps working; vitest's `onTestFinished` runs after them, which is where the harness disposes.
- **Not under vitest.** With no running vitest test nothing is registered, and only `dispose()` ends a render.
- **What stays.** `dispose()`, `properties` (which disposes its own renders), and the `afterEach` restore idiom the keel-testing skill shows.

```ts fragment
// apps/household/test/shoppingList.test.ts under this proposal: no dispose() needed; a failing expect leaves nothing behind
it("shows the empty list", async () => {
  const { page } = await open();
  expect(page.find("shopping.heading").text).toBe("Shopping list");
});
```

### 2. A key press goes to the focused element
`fire(id, { type: 'keydown', ... })` dispatches the `KeyboardEvent` at the document's focused element, as a browser sends a key press:
- Focus on `id` or on an element inside `id`: the event goes to the focused element and bubbles through `id`. No focus event fires.
- Focus elsewhere (or nowhere) and `id` focusable by the rule `fire(id, { type: 'focus' })` uses: `fire` first moves focus to `id` as that call does (`blur` and `focus` events, their handlers, a settle), then dispatches at `id`. This stands for the Tab or click a user made to put focus there.
- Focus outside `id` and `id` not focusable: E1719 and nothing is dispatched or moved.

```
E1719 tb.list cannot take focus, so no key press reaches it
```
`<id> cannot take focus, so no key press reaches it` is 49 characters plus the id; the line stays within 90 for ids up to 35 characters and is cut by the reporter's rule past that. `data` is `{ id, type: 'keydown' }`, as E1719 carries for `focus` and `blur`.
- **What stays.** The other events are dispatched at `id`. `focus` and `blur` keep E1719 as they are. `keydown`'s `key`, `shift`, `alt` and `mod` are unchanged. std.headless is unchanged: its widgets already act on a key only where APG says focus is. The focus a key press moves is no person's act under k.opening Testing (only `click`, `submit` and the `keydown` are), so link-started reads as today.

```ts fragment
// a Tabs test under this proposal: the key press puts focus on the tab, as the user did
await t.fire("tb.tab.apple", { type: "keydown", key: "ArrowRight" });
expect(changes).toEqual(["banana"]);
expect(t.find("tb.tab.banana").state.focused).toBe(true);
```

### 3. A select pick
`TestEvent`'s `change` takes an optional `value`. `fire(id, { type: 'change', value })` on a `<select>` without `multiple` is the user picking the enabled option whose value is `value`: that option becomes selected, then `input` (bubbles, composed) and `change` (bubbles) are dispatched at the select, in that order, each seeing the new `value`. A pick of the option already selected dispatches nothing, as a browser fires no event when the selection does not change.

Refused with E1726, nothing selected, nothing dispatched:
```
E1726 receipts.new:paidBy has no enabled option with that value
E1726 receipts.new:amount takes no value on change: not a single select
```
`<id> has no enabled option with that value` is 38 characters plus the id; `<id> takes no value on change: not a single select` is 46. Neither names the value (it can be personal data). `data` is `{ id, type: 'change' }`.
- **What stays.** `change` without `value` dispatches one `change` event, on any element, as today (the golden apps fire it on checkboxes). `input` with `value` writes it and dispatches one `input` event, a select's too; a recorded session (std.sessions) replays its `input` and `change` events one for one, so neither gains a second event. k.ctx `FireEvent` is unchanged: `value` on `change` is `TestEvent`'s, as the `keydown` modifiers are.

```ts fragment
// packages/testing/src/types/TestEvent.ts under this proposal
type KeyDown = Extract<FireEvent, { type: "keydown" }>;
type Change = Extract<FireEvent, { type: "change" }>;
export type TestEvent =
  | Exclude<FireEvent, KeyDown | Change>
  | (KeyDown & { readonly shift?: boolean; readonly alt?: boolean; readonly mod?: boolean })
  | (Change & { readonly value?: string });

// a test under this proposal
await page.fire("receipts.new:paidBy", { type: "change", value: "sam" });
```

### 4. Uncaught errors located
An app frame is a stack frame whose file is an absolute path outside `node_modules`, not `node:`, and not vitest's own (`/vitest/`, `/@vitest/`): the rule `testResults` already uses for a failed test. Each error outside any test's result, an unhandled error or rejection vitest reports or one `keel test` catches around the run, is one diagnostic:
```
T0001 test/late.test.ts:7:11 uncaught: late
```
- Message `uncaught: <code> <first line>`, the code only when the error has a string `code` (`uncaught: ECONNRESET read ECONNRESET`), ANSI removed, cut at 90 characters with `...`.
- Located at its first app frame, from vitest's parsed `stacks` when present, else its `stack` text; with none, at line 1, column 1 of the file vitest names for it (`VITEST_TEST_PATH`); with neither, without a location. The path is relative to the run's directory.
- Both paths make it with one function: `catchingStray` hands each held error to `testResults([], [error], root)`, so a stray is located by the same frame rule and no longer at a `node_modules` frame.
- **What stays.** The T0001 of a failed test, the E17xx of a harness failure, the file-level T0001 at line 1, the counts (`errors` counts these), and the run failing when there is one.

## Alternatives
- **1: an `afterEach` in a setup file `keelConfig` loads.** It would dispose before the app's own `afterEach` hooks or after, by registration order, and only under `keelConfig`. `onTestFinished` is registered by the render itself, runs after every `afterEach`, and needs only vitest.
- **1: dispose a `beforeAll` render after the suite.** A render outside a test has no test to end with, and vitest's `afterAll` cannot be added from inside a hook. Owning it by hand is the plain rule.
- **1: fail the next render while an earlier one is still mounted.** It names the leak, but the author still has to write the `dispose()` a harness can make itself.
- **2: refuse every keydown at an element without focus (E1719), never moving focus.** Browser-exact about the key's target, but `fire(tab, keydown)` asks for the state in which a key press there happens, and refusing it makes every key test start with a `focus` line that says nothing more. Moving focus first keeps the target the browser would use and the focus events the user's Tab or click would have fired.
- **2: focus the target on every keydown, unfocusable ones included, or dispatch at `id` as now.** The first does what no user can; the second keeps the finding.
- **3: fire `change` on a select's `input` too.** A browser does fire both for a pick, but `input` with `value` is also how a recorded session replays a select's `input` event, and its recorded `change` follows: a replay would send `change` twice. `change` with `value` is the pick; `input` keeps its one event.
- **3: allow `value` on `change` for text inputs.** A browser fires `input` per edit and `change` on commit (blur, Enter); `input` with `value` then `blur` already models that. Refused until a test needs it.
- **4: keep the vitest one unlocated and print the test name.** The name is not always known (an error after a file's teardown), and a path is what a person or agent opens.

## Spec diff
Applied in this commit. With the new text k.testing would hold about 3,570 tokens of its 3,100, so disposal and results go to a new section, k.test-run, `proposed`; k.testing stays `implemented` until its clauses below are covered. The map gains one row (`| k.test-run | Test end, results | proposed | dispose |`), no glossary term is added, and no other section changes: std.headless already says its widgets follow the APG pattern each names, and k.ctx `FireEvent` is unchanged.
- k.testing Harness: the `fire` bullet (`change` with optional `value`), and two bullets on where `keydown` and a select pick are sent.
- k.testing Rules: E1719 gains `keydown`; E1726 new. Ledger, exploration and simulation: a pointer to k.test-run.
- k.testing Conformance: clauses 7 to 12 below.
- k.test-run, new: **Disposal**, **Results** (app frame, the uncaught T0001), Rules (none of its own), Conformance: clauses 1 to 6, 13 and 14 below.

## Conformance
By the `conformance-writer`, from the spec text. Clauses 1 to 6 and 14 are k.test-run and 7 to 12 k.testing, all in `packages/testing/conformance`; clause 13 is k.test-run in `packages/cli/conformance`.
1. **Disposal of a failed test.** A test that `renderRoute`s a page with a `<main>` landmark and fails before `dispose()` leaves no element of the page in `document.body` once it ends; the next test's `renderRoute` of the same page passes its render checks.
2. **Seeded stores at test end.** A `render` given `state: [[store, v]]` and never disposed: in the next test `store.snapshot()` holds the value from before the render.
3. **By hand, then the end.** A `render` disposed by hand, then its seeded store written in the same test: the next test reads the written value; a second `dispose()` throws nothing.
4. **`afterEach` sees the render.** An `afterEach` hook of the test that made a render reads `t.state()` and finds its element in the document; after the test ends it is gone.
5. **`beforeAll`.** A render made in `beforeAll` is in the document in each of its suite's tests and in `afterAll`, and is gone after an `afterAll` `dispose()`.
6. **A route handle's documents.** A `renderRoute` with `app` that submits a `<Form>` answered by a 303 (two documents) leaves no element of either after the test.
7. **Keydown at the focused element.** With focus on an `input` inside an unfocusable container that has a keydown handler: `fire(container, { type: 'keydown', key: 'Enter' })` calls the input's and the container's keydown handlers once each, both reading `event.target` the input, and fires no focus or blur event.
8. **Keydown moves focus first.** With focus on another input, `fire(id, { type: 'keydown', key: 'a' })` on a focusable element runs its focus handler, then its keydown handler, in that order; the other input's blur handler runs once; `find(id).state.focused` is then true.
9. **Keydown on the focused element.** `fire(id, keydown)` on the element that has focus runs no focus or blur handler.
10. **E1719 for a key.** With focus outside it, `fire(id, { type: 'keydown', key: 'a' })` on an element that cannot take focus rejects with E1719 `<id> cannot take focus, so no key press reaches it` and `data` `{ id, type: 'keydown' }`; no handler runs and focus stays where it was.
11. **A select pick.** On a `<select>` with options `alex` and `sam`, `alex` selected, and `input` and `change` handlers on the select and on an ancestor: `fire(id, { type: 'change', value: 'sam' })` runs the select's `input` handler, then its `change` handler, each reading `value` `sam`, and the ancestor's handlers too; the select's value is then `sam`. A second identical call runs no handler.
12. **E1726.** `change` with a `value` naming no option, or a disabled one, rejects with E1726 `<id> has no enabled option with that value`; on an `<input>` and on a `<select multiple>`, E1726 `<id> takes no value on change: not a single select`; each with `data` `{ id, type: 'change' }`, no handler run and the value unchanged. `change` without `value` on the select runs its `change` handler alone and leaves the value; `input` with `value` `sam` runs its `input` handler alone.
13. **The uncaught T0001** (`packages/cli/conformance`). `keel test` over a fixture project whose test schedules `setTimeout(() => { throw new Error('late') })` that fires after the test ends prints `T0001 <test file>:<line>:<col> uncaught: late` at the line and column of the `throw`, and fails the run.
14. **`testResults` locations.** `testResults([], [e], cwd)` for an error whose `stacks` are a `node_modules` frame and then a frame in `cwd/test/a.test.ts` at 12:11 gives one T0001 at `test/a.test.ts:12:11`, message `uncaught: boom`; with a string `code` `ECONNRESET`, `uncaught: ECONNRESET boom`; with no app frame and `VITEST_TEST_PATH` `cwd/test/a.test.ts`, at `test/a.test.ts:1:1`; with neither, a T0001 with no path.

No existing conformance case contradicts the new text: the k.testing cases fire `focus` before keys or none; the k.opening cases (`return-acts*.test.ts`) fire a key at a focusable field, which now gains focus first, and that focus is no act; the std.headless cases that fire a key with no prior `focus` (`combobox-keys.test.ts`, `typeahead.test.ts`) target a focusable element or one holding focus. The `conformance-writer` confirms `packages/ui/conformance/aria-onkey.test.ts`: it fires a key at a `listbox` `Part`; if that part is not focusable the case is E1719 under the new text, and the writer gives the part a `tabIndex` or a prior `focus`, under `rfc:0202`.

## Build plan
1. This commit: RFC, ADR, spec text. 2. `conformance-writer`: the fourteen clauses, and the `aria-onkey` confirmation. 3. Build:
- `packages/testing/src/internal/openHarness.ts`: register the handle's `dispose` with the running test (`onTestFinished`) at open; `packages/testing/unsafe/currentTestMeta.ts` or a sibling `unsafe/onTestEnd.ts` reads the running vitest task, with its justification string; `render.ts`, `renderRoute.ts`, `resumeDocument.ts` through it, the route harness's documents included.
- `packages/testing/src/internal/eventFor.ts` and `openHarness.ts` `fire`: `keydown` at `document.activeElement` when it is `id` or inside it, else `moveFocus(el, 'focus')`, a settle, then dispatch; `src/internal/moveFocus.ts` (E1719 for `keydown`); a new `src/internal/pickOption.ts` (the select pick, E1726).
- `packages/testing/src/types/TestEvent.ts`: `change` with optional `value`.
- `packages/testing/src/testResults.ts`: the uncaught T0001 located, `VITEST_TEST_PATH` fallback, `uncaught:` and the code; its JSDoc.
- `packages/cli/src/internal/catchingStray.ts`: each held error through `testResults([], [e], root)`; `packages/cli/test/catchingStray.test.ts` (a `node_modules` first frame is skipped).
- `packages/check/src/internal/EXPLANATIONS.ts`: E1719 rewritten, E1726 new; the code table.
- Tests in `packages/testing/test`: property tests for the keydown target over focus positions and for the pick over option sets; `fire.test.ts` and `fire-modifiers.test.ts` where a key is fired at an unfocusable element.
- Repo tests that a key now focuses or refuses: `packages/std-sessions/test/*` (a recording may hold a `focus` event where a key moved focus), `packages/router/test/userReadAndActs.test.ts`, `packages/runtime-dom/test/secondCopy.test.ts`, `apps/golden-2/test/catalog.test.ts`, `apps/household/test/shoppingList.test.ts` (the `dispose()` calls may go).
- Docs: the keel-testing skill (`fire` bullet: a key press focuses its target; `change` with `value` on a select; no `dispose()` needed at a test's end), the testing README, a changeset, `tasks/p1/walkthrough-findings.md`, `tasks/BACKLOG.md`.
- Verify: the testing, cli, std-headless, std-sessions, router and runtime-dom suites; `keel test` in golden-1, golden-2, household and each `examples/*`.

## What it costs
- k.testing: 8,634 to 11,440 characters, 2,860 of the 3,100 tokens a section holds. k.test-run: 3,256 characters, 814 tokens. The map: 5,630 characters, 1,408 of its 1,410 tokens; the next map row needs the map trimmed or re-based.
- `@keel/testing`: a branch in `fire`, a pick helper, a test-end hook; no new dependency (vitest is already its optional peer). `@keel/cli`: `catchingStray` shrinks.
- `keel explain E1719` rewritten and `E1726` new, each within the 300-token budget.

## For the operator
1. **A keydown at an unfocused focusable element moves focus there first, rather than E1719.** Recommended: move focus; it is the state in which a browser delivers that key, and the test reads as the user acts. A strict reading (E1719 always) is a one-line change if preferred.
2. **A render made in `beforeAll` is the author's to dispose.** Recommended: keep; it belongs to no test, and the suite that shares it decides when it ends.
3. **`input` with `value` on a select keeps one event; the pick is `change` with `value`.** Recommended: keep; a recorded session replays `input` and `change` one for one, and a second `change` would run handlers twice.
4. **One new code, E1726, for a pick a browser cannot make.** Recommended: yes; E1719 is about focus, and a pick is not.
