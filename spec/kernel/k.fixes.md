# k.fixes: Fixes that are right
status: proposed

**Purpose.** An agent applies the first fix a diagnostic offers and runs check again until it is clean. That path ends in correct code or it is not offered: a clean check over wrong code is the one outcome worse than no fix.

**Rule.** `keel check` attaches a fix to a diagnostic only when all three hold of the fixed file, in place:
1. It compiles: `tsc` and `keel check` report, for the fixed project, no diagnostic the project did not have before, and not the fixed one.
2. It behaves as before: for every input the code returns, throws and writes what it did, and each caller sees the same failures with the same identity (the same thrown value, the same `KeelError`).
3. It leaves nothing behind: no dead branch, no unread binding, no block that only held the old form.
Otherwise the diagnostic carries no fix, and its message names the shape to write. A fix never chooses between a value and a defect, never widens what a catch takes, and never changes a signature: each is the author's decision.

**Per code.** The fixes of the failure rules (k.errors, k.attempt, k.defects, k.reactive):

| Code | A fix is offered when | The fix |
| --- | --- | --- |
| the `throw` rule | the statement is `throw <e>` whose expression's type is a `KeelError`, directly in a function whose return type, declared or inferred, takes `Result<never, E>` (a function given to `attempt` does) | `return err(<e>)`, and the `err` import |
| the `catch` rule, E1452 | the statement is `try { A } catch (e) { B; throw e }`: no `finally`, `e` a plain name `B` never mentions, the `throw e` last, and `A` holding no `return`, `break`, `continue` or `yield` that leaves the `try` | `let done = false; try { A; done = true } finally { if (!done) { B } }`, `done` a name free in the function; with `B` empty, `A`'s statements alone |
| E1455 | the call is `defect(message)` or `defect(message, code)` where `r`, a plain name of a `Result`, is known not ok | the detail `{ cause: r.error }` |
| E1452 in any other form, E1453, E1457, E1458, E1203, E1208, E1256, E1260, E1762 | never | none |

So a `catch` that reads, tests or wraps what it caught has no fix: only its author knows which thrown values it expects, and `attempt(fn, expect)` asks for exactly that. A `throw` of anything but a `KeelError` has none: whether a caller can act on the failure decides between a `Result` and a defect.

**Explanations.** The explanation table (k.explain) holds, for each code above, one example per shape its message names, and each example compiles. In `explain`'s text an example is a fenced code block holding a whole module, read as `modules/m/a.ts` of a module `m`: `keel check` with the type pass and `tsc` report nothing on it, its file's name (E1752) aside. For E1452 the three shapes: cleanup (`try`/`finally` with a flag), an expected failure (`attempt(fn, (x) => x instanceof T ? E.make(data) : undefined)`), and no catch at all. For a `throw` the two: `return err(E.make(data))` with the return type it gives and what a caller then writes (`if (!r.ok) return r`), and `defect('text', { data })`. For E1203 and E1208: `const c = owner() ?? defect('no owner')` before the `await` and `c.run(() => signal(0))` after it.

**Fix chains.** A fix chain is a fixture that walks the agent's path. It holds a start project; the ordered steps (below, `throw` is the rule against `throw`, `catch` E1452, `built-in` E1457), each the first diagnostic `keel check` then reports (its code, its message, whether it carries a fix) and, for a step with no fix, the edit the message names; the end project; and a probe, a test that runs the end project. The harness applies each step's fix when one is offered, else the named edit, and checks the next step. It passes when every step matches, the end project equals the files reached, `keel check` and `tsc` report nothing on it, and the probe passes. The chains of `packages/check/conformance/fix-chains/`:

| Chain | Start | Steps | End |
| --- | --- | --- | --- |
| `retry` | a fetch loop that catches, waits and throws `new Error` on a status | catch, no fix; throw, no fix | a loop over `attempt(fn, expect)` returning `Result`, retrying on its error's code |
| `rollback` | `try { work; commit } catch (e) { rollback; throw e }` in a `Promise<void>` function | catch, fix | the `done` flag and `finally`; the signature unchanged |
| `sdk` | a `catch` that tests `e.name === 'CardError'` and rethrows the rest | catch, no fix | k.attempt's `charge` |
| `json` | `try { return JSON.parse(text) } catch { return fallback }` | catch, no fix; built-in, no fix | `Prefs.parseJson(text)`, the fallback chosen on its error's code |
| `cleanup` | `try { use(h) } finally { h.close() }` | none | the start |
| `invalid` | an action that throws on a bad field | throw, no fix | `Draft.parse(input)` and `if (!r.ok) return r` |
| `missing` | a loader that throws when no row is found | throw, no fix | `err(Missing.make({ id }))` in a `Result` return |
| `timeout` | a `catch` that tests `e.name === 'TimeoutError'` | catch, no fix | `attempt(fn, expect)` naming `TimeoutError` as `feed.timeout` |
| `conflict` | a loop that catches a conflict and runs again | catch, no fix | a loop on `r.error.code === 'keel.conflict'` that returns any other `r` |
| `bug` | `if (!row) throw new Error('no row ' + id)` where the row must exist | throw, no fix | `row ?? defect('no row', { data: { id } })` |

**Rules.** None: each code's rule is in its own section.

**Conformance.**
- Every fixture of `packages/check/conformance` whose diagnostic carries a fix, applied alone, gives a project for which `keel check` reports neither that diagnostic nor any the start did not have, and `tsc` reports none.
- In `modules/m/a.ts`, `function f(): Result<number, Locked> { if (bad) throw Locked.make({}); return ok(1) }` is one E1451 whose fix gives `return err(Locked.make({}))`; `throw new Error('x')` there, `throw Locked.make({})` in a function declared `: number`, and `throw Locked.make({})` in a function declared `Promise<void>` are one E1451 each with no fix.
- In `modules/m/a.ts`, `try { await work(); await commit() } catch (e) { await rollback(); throw e }` is one E1452 whose fix gives `let done = false`, then `try { await work(); await commit(); done = true } finally { if (!done) { await rollback() } }`; where the function already declares `done` the name is `done2`; `try { f() } catch (e) { throw e }` is one whose fix gives `f()` alone.
- In `modules/m/a.ts`, `try { return f() } catch (e) { undo(); throw e }`, `try { f() } catch (e) { log(e); throw e }`, `try { f() } catch { g() }`, `try { f() } catch {}`, `try { f() } catch (e) { if (e instanceof RangeError) return 0; throw e }`, `p.catch(g)` and `p.then(f, g)` are one E1452 each with no fix.
- The chain `retry` ends in a project whose probe holds: answers 503, 503 and 200 give `ok` after three requests and waits of 100 and 200 sim ms; 404 gives `err` `feed.http` with data `{ status: 404 }` after one request; a refused connection on every try gives `err` `feed.unreachable` after `tries` requests; a defect raised while the body is read rejects with that defect after one request.
- The chain `rollback` takes one step, and its probe holds: with `work` rejecting with `w`, an object whose `code` is `40P01`, the function rejects with `w` itself after the statements `begin` and `rollback`; with `work` resolving, the statements are `begin` and `commit`.
- The chains `sdk`, `json`, `timeout` and `conflict` each end in a project whose probe holds: the expected failure is `err` with the code the end names, and a `TypeError` thrown inside the wrapped call is thrown on as itself.
- The chain `json` ends in a function that returns the parsed value for a valid text and the fallback for `{`, and throws for neither.
- The chain `cleanup` has no step: `keel check` reports nothing on its start.
- The chains `invalid`, `missing` and `bug` each take one step with no fix; the probes hold that a bad field answers `err` `schema.invalid`, an absent row `err` with the module's `missing` code and its `id`, and a row that must exist a defect whose `data` is `{ id }` and whose message holds no id.
- For each code Per code names, every example `explain(code)` shows as the code to write is the end of a fixture on which `keel check` and `tsc` report nothing.
- No chain holds a step whose diagnostic carries a fix that the next step, or the probe, shows to be wrong: with every offered fix applied and no other edit, each chain's files compile at every step.
