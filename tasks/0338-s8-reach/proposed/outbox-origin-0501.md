# 0501 with 0509: a stored outbox entry's origin and owner (the owner decides; security)

**Attack.** `drain` loads `keel.outbox.<id>` from `ctx.storage` and posts each entry through `service({ base: e.origin })` (`packages/std-offline/src/internal/flush.ts:46`), so a value planted in storage with `origin: 'https://evil.example'` gets the entry's body and `write` key posted there. Entries carry no owner, so after one user signs out on a shared browser, the next user's `drain` sends the first user's queued writes under the new caller's cookie.

std.offline Privacy says entries "go only to their endpoint", and that does not hold for stored data.

**Options.**
- A (0509): `outbox(id, api, { module, limit, maxBytes })` sends through `service({ module, schema: api })`. `send(ctx, outbox, endpoint, input, { base })` takes no origin, and entries carry none. Every post goes to the module's own deployable, the stored data cannot redirect it, and the derived answer map in `flush.ts` goes away. Cost to an app author: one `module` option, and each `send` call loses its `origin` argument (golden-1 is the one app that calls it). An outbox can no longer post to a foreign origin, and nothing in the repo does.
- B: keep `origin`, and give `outbox` an allow-list that `drain` checks; an entry for another origin is `failed`. Cost: a list to keep in step with the topology, and two places that name where writes go.
- C: an owner stamp. `outbox`/`drain` take a caller id (the signed-in user), each entry stores it, and `drain` fails or drops entries of another owner. Cost: the app passes its caller id at `drain` and `send`, and decides what the UI shows for another user's entries (fail and offer Dismiss, or drop silently).
- D: app code clears `keel.outbox.<id>` on sign-out. Cost: one call per outbox at sign-out; it does nothing against planted data or a sign-out that never runs (an expired session, a closed tab).

**Recommendation: A + C.** A closes the redirect with no new knob and deletes code. C closes the shared-browser case, which A alone does not, because the module's own deployable accepts the next user's cookie. D is a sentence for the docs, not a guard. B is a weaker A with more upkeep.

**Spec and RFC.** A and C change std.offline's signatures (`outbox`, `send`, `drain`, `OutboxEntry`) and its Privacy paragraph. The user fixed these shapes in RFC 0081 D2, so this needs the user's decision and then one RFC for both.
