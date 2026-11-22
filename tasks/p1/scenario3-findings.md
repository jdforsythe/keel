# Scenario findings: workflows on Postgres, CSP, guard into a shell, signed-in sessions

Faults and gaps the scenario tests found, written as an app author meets them. Each names what the author did, what happened, the spec sentence it differs from (`pnpm spec <topic>`), and the cause where found.

## Status

| Finding | Status |
| --- | --- |
| S3-1 | fixed: rfc:0185 a shell harness's cookie jar; `examples/shell-mount` tests the round trip |
| S3-2 | open: for an RFC (k.guards, k.user) |
| S3-3 | open: harness or skill text |
| S3-4 | fixed: the keel-server skill names `createApp`'s `std` |

## Scenarios

| scenario | vehicle | result |
| --- | --- | --- |
| Workflow with jobs on Postgres 17 under SIGKILL | `tooling/smoke/workflow-postgres.mjs` (built-smokes) | pass: instance `kept`, step ran twice, `restored` once, `api.showList` once |
| CSP header read | `tooling/smoke/csp.mjs` (built-smokes) | pass |
| Guard redirect into a shell | `examples/shell-mount`, `test/shellGuard.test.ts`; proof in `tooling/smoke/examples.mjs` | pass: redirect with `next`, the mount post and the return to the note signed in |
| Sessions for a signed-in user | `apps/golden-2/test/signedInSession.test.ts`, `sessionsReader.test.ts` | pass, after S3-3 and S3-4 |

Scenario 1 stores the workflow, its job queue and the board through the deployable's `storage: "postgres"` (std.db's Postgres driver, `keel_kv`). `@keel/std-postgres` holds app data and is not where std.workflows or std.jobs keep state, so a workflow on Postgres is a workflow on that storage.

## S3-1. A sign-in round trip in a shell cannot be tested in process

**What the author did.** `examples/shell-mount`: a `client` deployable with `shells.tauri`, a guarded note page whose guard asks `/api/me`, and a sign-in page whose `Form` posts to the identity mount. The test runs `renderRoute("notes.home", { routes, shell: { id }, ctx })` and routes `ctx.net`'s `/api/*` to the `api` deployable's `createApp`, keeping the answers' cookies and sending them back, as the native HTTP client and its cookie store do.

**What happened.** The link to note n1 redirects to `/signin?next=%2Fnotes%2Fn1`, and the sign-in sends one `POST /api/auth/sign-in/email?next=%2Fnotes%2Fn1` with `redirect: 'manual'`, both as specified. The 303 to `/notes/n1` is followed, but the guard's `/api/me` goes without the cookie and the reader lands on sign-in again. A reader whose cookie is already in the test's store is also sent to sign-in. Under happy-dom (the environment `keelConfig` apps run tests in, and the one `renderRoute` needs), a `Response` drops `set-cookie` (`getSetCookie()` is `[]`, `get("set-cookie")` is `null`) and a `Request` drops `cookie`: they are Fetch's forbidden header names. So no test can stand in for the native store, and the harness keeps none.

**Expected.** k.return Mount requests: "a 3xx resolves as it came, its `set-cookie` kept by the native store"; k.return Testing: "`renderRoute(id, { shell: true })` runs the page under a ctx of `mode: 'shell'`: mount requests go to the sim `net`". The scenario needs the harness's shell mode to keep a native cookie store over the sim net (set from mount answers, sent on mount requests and module calls), or a sim net whose requests and answers carry those headers.

**Cause.** `packages/testing/src/renderRoute.ts:84-88` (`mountRequests`) has no cookie store; the header filtering is happy-dom's `Response` and `Request`.

**The test left out of the suite** (after the first test of `examples/shell-mount/test/shellGuard.test.ts`, which holds `shell()`):

```ts
it("sends a signed-out reader to sign-in and back to the note after signing in, the param carried", async () => {
  const { ctx, jar, sent } = await shell();
  const t = await renderRoute("notes.home", { routes, shell: { id: "dev.keel.shellmount" }, ctx });
  try {
    await t.fire("notes.home.toNote", { type: "click" });
    await t.fire("notes.signinForm:name", { type: "input", value: "Ada" });
    await t.fire("notes.signinSubmit", { type: "click" });
    expect(sent.filter((s) => s.startsWith("POST"))).toHaveLength(1);
    expect(jar.get("demo-user")).toBe("Ada"); // fails: the jar is empty
    expect(t.route()).toMatchObject({ id: "notes.note", params: { noteId: "n1" } }); // fails: notes.signin
    expect(t.find("notes.note.title").text).toBe("Note n1");
  } finally {
    t.dispose();
  }
});

it("lets a signed-in reader open the note without a detour", async () => {
  const { ctx, jar } = await shell();
  jar.set("demo-user", "Ada");
  const t = await renderRoute("notes.home", { routes, shell: { id: "dev.keel.shellmount" }, ctx });
  try {
    await t.fire("notes.home.toNote", { type: "click" });
    expect(t.route()).toMatchObject({ id: "notes.note", params: { noteId: "n1" } }); // fails: notes.signin
    expect(t.find("notes.note.title").text).toBe("Note n1");
  } finally {
    t.dispose();
  }
});
```

The built proof in `tooling/smoke/examples.mjs` covers the server half over real HTTP: the mount's 303 goes to `next` with the cookie, and `/api/me` then names the user. The whole round trip in a real shell is left to a Tauri run (`tooling/smoke/shell.mjs` on Linux).

## S3-2. A guard on a shell page cannot read the signed-in user

**What the author did.** Wrote the sign-in guard the way `apps/household/modules/members/signedIn.guard.ts` does, `user === '' ? err(...) : ok(null)`, for a page in a `client` deployable with a shell.

**What happened.** The guard always redirects: on a `client` deployable `user` is `''`. The example's guard instead calls `/api/me` through a service on every guarded navigation.

**Expected.** k.guards: '`caller` and `user` are k.server's and k.user's (`''` if none or client-only)'; k.user: '`''` with no identity source, on a `client` deployable'. So the behaviour is as specified, and no section says how a guard in a shell or a hosted client learns who is signed in. An app in a shell needs a guard that redirects a signed-out reader, and today each author writes the network call, its failure handling and its cost per navigation. For an RFC: a client-side `user` the runtime fills from one call to the identity source (k.user), or a std helper that a guard awaits.

## S3-3. `renderRoute(id, { user })` on its own ctx: a loader's module call refuses `user`

**What the author did.** `renderRoute("accounts.signin", { routes, params, ctx, user })` in golden-2, with `ctx` a fresh sim ctx whose `/api/*` reaches the `api` deployable. The page's loader (`readAccount`) calls `accountsApi.me({ user }, ctx)`.

**What happened.** The call answers `api.input` at `user`, nothing reaches the net, and the page renders signed out (the loader treats any error as signed out). Passing the `createApp` ctx itself (`ctx: server`) works: that ctx is bound, so the call is signed.

**Expected.** k.user Conformance: '`renderRoute(id, { user: 'u1' })` gives guard and loader `'u1'`': it does, but on an unbound ctx the loader cannot pass it on. A test of a `node` page that calls a module service with `user` has to know to share the `createApp` ctx.

**Cause.** `packages/services/src/internal/buildRequest.ts:52`: a `user` on a target with no `sign` is `api.input` (`type`). The harness ctx is bound to no signer. Fix: the harness signs for its own ctx, or keel-testing says to pass the `createApp` ctx.

## S3-4. `createApp` without `std` denies every sessions reader, silently

**What the author did.** Placed module `sessions` in golden-2's `api`, named the operator's user id in `readers` (`modules/accounts/module.ts`), and served `createApp({ topology, routes, ctx, deployable, identity })` in a test.

**What happened.** `GET /sessions/tally` and `/sessions/list` answer 403 to the reader. `createApp` binds the std config only from its `std` option (a `.keel/std.json` path); without it `stdConfig` is `{}`, `readers` is empty and the guard denies everyone, with no diagnostic. Passing `std: resolve(".keel/std.json")` admits the reader.

**Expected.** std.sessions Ingest: "`sessions.list` ... loads it behind guard `sessions.reader`: `user` or `caller` in `readers`, else 403". The keel-server skill lists `createApp`'s options without `std`, so an author meets this only through the package README. Fix: the skill's Runners and tests paragraph names `std`.
