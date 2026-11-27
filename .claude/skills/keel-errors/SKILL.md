---
name: keel-errors
description: "Keel failures: err and s.error, attempt(fn, expect), defect, retry, rollback with a flag, wrapping a throwing SDK, what an expect may claim and carry, keelError; E1451, E1452, E1453, E1455, E1457, E1458, E1459, E1460, E1461"
---

# Failures in Keel

Exact rules: `keel docs k.attempt`, `k.expect`, `k.errors`, `k.defects`. Each code's shape to write: `keel explain <code>`.

**Two kinds.** A failure a caller can act on (retry, take another path, tell a person) is a value: declare it with `s.error(code, data)`, return `err(X.make(data))` in a `Result`. Anything thrown is unexpected; a bug is `defect('literal text', code?, { data, cause })`. A kernel code an author returns is `keelError.denied.make({})`, `.notFound`, `.conflict`, `.unreachable`, `.busy`, or `keelError.fields.make({ 'address.city': 'Taken' })`; a `KeelError` is never an object literal (E1458). `ok` never takes a `Result` (E1459): return the inner one.

**One catch.** `attempt(fn, expect)` runs `fn`: a value is `ok`, a returned `Result` is its own, a defect passes through, and any other throw goes to `expect`, whose `KeelError` is the `err`; `undefined` throws it on. Write the `expect` in the call (or name a function of the project). It claims only in a branch a test of its parameter selects (`x instanceof C`, `x.code === '23505'`, a boolean predicate), and holds `undefined` in its return type (E1452). Out of the thrown value it carries a number, a boolean or a literal union, never text: no `message`, `String(x)` or template (E1460). A `make` message is a literal (E1460). Code that runs code it does not own and must outlive any throw is a library's `supervise` (E1461 in app code).

**Retry, roll back, wrap an SDK.**
```ts
import type { Ctx } from '@keel/ctx'
import { attempt, err, ok, s, type Result } from '@keel/schema'

export const HttpFailed = s.error('feed.http', s.object({ status: s.int() }))
export const Unreachable = s.error('feed.unreachable', s.object({}))
export const CardDeclined = s.error('pay.declined', s.object({ reason: s.enum(['funds', 'other']) }))
type FeedError = s.infer<typeof HttpFailed> | s.infer<typeof Unreachable>
type Feed = { get(url: string): Promise<{ ok: boolean; status: number; text: string }> }

const once = (feed: Feed, url: string) =>
  attempt(async () => {
    const res = await feed.get(url)
    return res.ok ? ok(res.text) : err(HttpFailed.make({ status: res.status }))
  }, (x) => (x instanceof TypeError ? Unreachable.make({}) : undefined))

export async function fetchRetry(ctx: Ctx, feed: Feed, url: string, tries: number): Promise<Result<string, FeedError>> {
  for (let i = 0; ; i++) {
    const r = await once(feed, url)
    if (r.ok || i === tries - 1 || (r.error.code === 'feed.http' && r.error.data.status < 500)) return r
    await ctx.clock.after(2 ** i * 100)
  }
}

export async function inTx(db: { query(sql: string): Promise<void> }, work: () => Promise<void>): Promise<void> {
  await db.query('begin')
  let done = false
  try {
    await work()
    await db.query('commit')
    done = true
  } finally {
    if (!done) await db.query('rollback')
  }
}

const reasonOf = (x: Error): 'funds' | 'other' => (Reflect.get(x, 'code') === 'insufficient_funds' ? 'funds' : 'other')
export const charge = (sdk: { charge(cents: number): Promise<string> }, cents: number) =>
  attempt(
    () => sdk.charge(cents),
    (x) => (x instanceof Error && x.name === 'CardError' ? CardDeclined.make({ reason: reasonOf(x) }) : undefined),
  )
```
The retry's `err` is the call's own `Result`, typed and retried. The rollback is `try`/`finally` with a flag: the thrown value goes on as itself. The SDK's message, which may name the buyer, has nowhere to go: the data is a closed enum.

**Other weekly shapes.** JSON: `const r = Prefs.parseJson(text)`, never a bare `JSON.parse` (E1457); `URL.parse(text)` for an address. A validation failure: `const r = Draft.parse(input); if (!r.ok) return r`. A row that must exist: `row ?? defect('no row', { data: { id } })`. A function that throws today: return `Result<T, E>` if a caller can act, each caller returns it on or reads `r.error` (E1453), else `defect`.
