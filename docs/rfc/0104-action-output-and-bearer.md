# RFC 0104: Action output and bearer (an API route's action answers data by its `output` schema; an API route's handlers get the `Authorization: Bearer` token as a `Secret`)

Status: accepted (user, 2026-11-16: Questions 1 to 5 as recommended, so D1, D5, D6, D7 and D8 stand as written; the orchestrator accepts Questions 6 to 9 under the defaults each cites). The kernel RFC that RFC 0103 D9 named. ADR-0127 records it.

## Decisions
D1, D5, D6, D7 and D8 are the user's: each is a new API shape, a security choice, or needs a golden app migration. The others apply the WORKFLOW RFC default they cite. Every recommended form is written into the Proposal; the other form and its cost are under Questions.

- D1 (the user's): an API route's action declares `output`, a schema, and returns `Result<T, KeelError>` for its type; a page's action does not declare one and keeps `Result<Href | null, KeelError>`. Each side refuses the other: E1512, a type error at `routes.actions`, which also throws it. `Href | null` stays only where it means something, a page's navigation. A write with nothing to answer declares `output: s.object({})` and returns `ok({})` (default 2: the new path replaces the old one on API routes everywhere).
- D2: the wire answer is the one k.server already writes for a runtime request: 200 `application/json` with `{ "ok": true, "value": <encoded> }`. The value is parsed by `output` before any store is saved; a value `output` refuses is E1554 and a 500 with nothing saved; a save conflict is 409 `keel.conflict` and the value is never sent. Every write's answer is `Cache-Control: no-store`, as the code does today (default 3).
- D3: nothing else learns a new shape for output. A `module` service already decodes the `ok` value with its endpoint's `output`; `.keel/surface.json` records an API action's answer as its `output`, so E1561 and E1562 now compare real data; `Form` and the client router post to pages only, so they keep `Href | null`. Keel has no OpenAPI export; when one is built it derives from `output` (defaults 2, 3).
- D4: a `loader` or `action` `output` holding an `s.secret` node throws E1113 at declaration, since a secret encodes as `"[secret]"`. A token leaves as `reveal(token)` into an `s.string()` field, in the action's `*.server.ts` file. E1105, E1111 and E1112 do not change; k.reveal says that a `return` is not a sink. `.pii()` in an `output` is allowed and joins the server log's scrub set, as a loader's output does (defaults 4, 6).
- D5 (the user's): an API route's guard, loader and action get `bearer: Secret<string> | undefined` beside `caller`, read from the `authorization` header. A page's action has no `bearer` in its type; a page's guard and loader get `undefined`, so a page never reads the header. No other header reaches server code.
- D6 (the user's, security): the parse. The value, trimmed, is `Bearer` in any letter case, one or more spaces, then a token68 of 1 to 4,096 characters. Anything else is `undefined`, with no error status and no log line. The kernel parses it with `s.secret(s.string())` before any app code runs; its text is in the request's `[secret]` scrub set and never in a `req` record (defaults 4, 6).
- D7 (the user's, security): `bearer` and `caller` are independent and neither changes. The same-site check of a write is unchanged, and stays sufficient: a browser sends `authorization` cross-origin only after a preflight, which only an allowed origin passes. `authorization` joins the allowed request headers of the preflight (k.hosting). A response to a request that carries `authorization` is `Cache-Control: no-store` (defaults 4, 6).
- D8 (the user's): a services client call takes `bearer?: Secret<string>` beside `signal` and sends `authorization: Bearer <token>`; a token outside the D6 form is `api.input` at `bearer` and nothing is sent. std.offline's `send` takes no `bearer`, since an outbox entry is persisted and a secret never persists.
- D9: tests pass a bearer the way a client does: a `Request` with the header to `createApp`, or a service call with `bearer` under a sim ctx, whose sim net route sees the header. `renderRoute` renders pages, which get `undefined`, so it gains no option; a direct `run` call may leave `bearer` out. A Capacitor or Tauri shell sends it through its driver, which already forwards headers, and has nowhere to keep it across launches (default 3).
- D10: left out. A general `headers` object (PRINCIPLES 1, 2, 4), schemes other than Bearer, a 401 status with `WWW-Authenticate`, `output` on page actions, a caller made from a token, and an OpenAPI export.

New codes: E1512 (k.api, block E150x), E1113 (k.privacy, block E110x). Both are unused in `spec/`, `docs/`, `tasks/`, every `packages/*/src` and every `packages/*/conformance`. No KeelError code is added. No spec section is created and `spec/00-map.md` does not change: E1512 falls in a block k.api already owns and E1113 in one k.privacy owns.

## Problem
Measured on `jdforsythe/test-impl` at `910450b9`.

**A write cannot answer with data.** `action` returns `Result<Href | null, KeelError<string, unknown>>` (`packages/router/src/action.ts:10`, `types/Action.ts:20`). On an API route, `runAction` answers a runtime request with `jsonResponse(200, ok(result.value))` (`packages/server/src/internal/runAction.ts:92`), so the JSON holds a link or `null`. Every API action in the repo answers `ok(null)`: seven in golden-1's `api` module, one in `digest`, two in golden-2's `kitchen`, `ingestSession` in std-sessions and the channel POST in std-channels. RFC 0103 Example 2 mints a token and has to send it through a mail `service` call, because the response that creates the token cannot carry it. A settings page that shows a new token once, or a script that asks for one, has no path.

**`Href | null` on an API route is already a small second way.** An API route never redirects (k.api: "never 303"), so an `ok(href)` there is a string a script receives as data. Its type says "navigation" and its use says "a string". `.keel/surface.json` records every action's answer as `Href | null` (`packages/cli/src/internal/surfaceOf.ts:12`), which is why golden-2's module endpoints declare `output: s.string().nullable()` for their POSTs and golden-1's `WriteAnswer` reads `value: s.string().nullable()`.

**No request header reaches server code.** A guard gets `{ url, caller }`, a loader `{ params, search, url, caller, stores }`, an action `{ params, url, caller, stores }` (`packages/router/src/guard.ts`, `loader.ts`, `action.ts`). The server reads `content-type`, `accept`, `cookie`, `origin`, `sec-fetch-site`, `x-keel` and `x-forwarded-proto` for its own use and passes none on. The preflight allows `accept, content-type, x-keel` (`packages/server/src/internal/withCors.ts:17`). So RFC 0103's Example 2 takes the token in a POST body, and a GET cannot take one at all except in the URL, which lands in history and proxy logs.

**What a header-borne token would meet today.**
- Same-site check (`sameSite.ts`): a script's request has neither `Origin` nor `Sec-Fetch-Site` and passes; a cross-origin browser request with a non-simple header needs a preflight, which only an allowed origin on an API route gets (`createApp.ts:182-194`).
- Caller (`callerOf.ts`): a write without a signed cookie mints one and sets it; a read gets `""`. A script ignores the cookie, so each of its writes is a new caller.
- Log scrub (`redacted.ts`, `RequestScope.ts`): `diag` text is scrubbed of the request's `.pii()` values and of the revealed value of each `Secret` in the decoded action input. The `req` record holds method, path, route, status and time (`reqLine.ts`), no header.
- Caching: an action's response is `no-store` (`noStore.ts`, applied in `handle.ts:118`). A loader's JSON answer carries no `Cache-Control`.
- Shells (k.shell): the driver forwards a request's headers to `KEEL_ORIGIN` through the native HTTP client, with no preflight.
- Request events: `observe` reports no request or header (`CtxEvent.ts`), and std.sessions records none.

**Where an outbox would keep one.** std.offline's `SendInput` is the client call's input less `signal` (`packages/std-offline/src/SendInput.ts`), and `send` writes each entry to `ctx.storage`. A `bearer` in the client's input type would flow into it and persist as `"[secret]"`.

**OpenAPI.** k.openapi imports OpenAPI 3 into endpoints. Nothing exports one: `routes.json` holds `params` and `search` as JSON Schema and no loader `output` or action `input` (`packages/router/src/routesArtifact.ts`).

**Spec room.** In tokens, as `tooling/budgets.mjs` counts them: k.server 1,500 and k.router, k.security 1,499 each, at the limit; k.errors 1,492; k.api 888; k.guards 284; k.hosting 1,087; k.privacy 1,374; k.services 1,222; k.reveal 709; k.compat 1,431; `spec/00-map.md` 1,198 of 1,200.

## Proposal

### API
Everything that changes for an app. Signatures typecheck under `@keel/compiler/tsconfig.strict.json` (Prototype).

```ts
// @keel/router
import type { Ctx } from '@keel/ctx'
import type { KeelError, ObjectSchema, Result, Schema, Secret } from '@keel/schema'
type Out<T> = Result<T, KeelError<string, unknown>>
type PageAt<P, St> = { readonly params: P; readonly url: string; readonly caller: string; readonly stores: St }
type ApiAt<P, St> = PageAt<P, St> & { readonly bearer: Secret<string> | undefined }

// An API route's action: declares `output`; its fn sees `bearer`.
export function action<I, O, P = unknown, St = undefined>(
  decl: { readonly input: ObjectSchema<I>; readonly output: Schema<O>; readonly params?: ObjectSchema<P>; readonly stores?: (ctx: Ctx) => St },
  fn: (input: I, at: ApiAt<NoInfer<P>, NoInfer<St>>, ctx: Ctx) => Out<NoInfer<O>> | Promise<Out<NoInfer<O>>>,
): ApiAction<I, O, P, St>
// A page's action: as today.
export function action<I, P = unknown, St = undefined>(
  decl: { readonly input: ObjectSchema<I>; readonly params?: ObjectSchema<P>; readonly stores?: (ctx: Ctx) => St },
  fn: (input: I, at: PageAt<NoInfer<P>, NoInfer<St>>, ctx: Ctx) => Out<Href | null> | Promise<Out<Href | null>>,
): Action<I, P, St>

export interface ApiAction<I, O, P = unknown, St = unknown> {   // new file types/ApiAction.ts
  readonly kind: 'keel.action'
  readonly input: ObjectSchema<I>
  readonly output: Schema<O>
  readonly params?: ObjectSchema<P>
  readonly stores?: (ctx: Ctx) => St
  run(input: I, at: PageAt<P, St> & { readonly bearer?: Secret<string> }, ctx: Ctx): Out<O> | Promise<Out<O>>
}
// Action<I, P, St> (types/Action.ts) gains `readonly output?: never`; its run is unchanged.
// RouteActions accepts Action or ApiAction per method.

// loader: fn's args add `bearer`; run's args take `bearer?`.
type LoaderArgs<P, S, St> = { readonly params: P; readonly search: S; readonly url: string;
  readonly caller: string; readonly bearer: Secret<string> | undefined; readonly stores: St }
// guard: fn gets { url, caller, bearer }; run takes { url, caller?, bearer? }.
type GuardFn = (req: { readonly url: string; readonly caller: string; readonly bearer: Secret<string> | undefined }, ctx: Ctx)
  => Promise<Result<null, KeelError<'keel.denied', unknown>>>

// @keel/services: a client method's input gains `bearer`.
type Input<E> = Flat<Part<E, 'params'> & Part<E, 'query'> & Part<E, 'body'> &
  { readonly signal?: AbortSignal; readonly bearer?: Secret<string> }>
```

**`routes.actions`.** `ActionsFit` gains one check per method, after the `params` check: on an entry with `api: true` the action must have `output`; on any other entry it must not. The type error's text is the E1512 message, which `keel check` maps to E1512 as it maps E1510's. At run time `routes.actions` throws the same code for the same cases, as it throws E1505 and E1507.

**Diagnostics.**

| Code | Section | When | Where | Fix |
| --- | --- | --- | --- | --- |
| E1512 | k.api | an action without `output` bound to an API route, or one with `output` bound to a page | type error at the `routes.actions` key, mapped by `keel check`; `routes.actions` throws it | none (the fix is in the action's own file) |
| E1113 | k.privacy | an `s.secret` node anywhere in a `loader` or `action` `output` schema | `loader()` and `action()` throw it at declaration | none |

Messages, under 90 characters: `E1512 api.reports: an API route's action declares output (POST)`, `E1512 todos.index: a page's action declares no output (POST)`, `E1113 output holds s.secret at token: it would encode as "[secret]"`. Explain rows (each under 120 tokens): E1512, "An API route answers data, so its action declares `output` and returns `ok(value)`; a write with nothing to say declares `output: s.object({})` and returns `ok({})`. A page's action answers navigation, `ok(href)` or `ok(null)`, and declares no `output`." E1113, "A `Secret` encodes as `\"[secret]\"`, so an `output` holding one would answer the marker. Reveal it in the `*.server.ts` file and put the text in an `s.string()` field: `ok({ token: reveal(t) })`."

**The answer of an API action.**

| The action | Status | Body | Saved | Log |
| --- | --- | --- | --- | --- |
| `ok(v)`, `v` passes `output`, save succeeds | 200 | `{"ok":true,"value":<output.encode(v)>}` | its changed stores | `req` |
| `ok(v)`, `v` fails `output` | 500 | `keel.unexpected` (production message `unexpected`) | nothing | `req`, `diag` E1554 naming the first refused path |
| `ok(v)`, save conflicts | 409 | `keel.conflict` | nothing | `req` |
| `err(e)` | k.server Status of `e.code` | `{"ok":false,"error":e}` | nothing | `req` |
| throws | 500 | `keel.unexpected` | nothing | `req`, `diag` |
| input fails | 422 | `keel.fields` | nothing (action not run) | `req` |

Every row: `content-type: application/json; charset=utf-8` and `cache-control: no-store`, whatever the request's `accept`. A document POST to an API route gets the same answer and no `Location` (k.api today).

**The bearer parse.** `bearerOf(request)` in `@keel/server` internals. `Headers.get('authorization')` joins two headers with `, ` and trims each value's leading and trailing whitespace.

| `authorization` | `bearer` |
| --- | --- |
| absent | `undefined` |
| `Bearer abc`, `bearer abc`, `BEARER   abc` | reveals `abc` |
| `Bearer abc==` | reveals `abc==` |
| `Bearer keel_<16 hex>_<64 hex>` (a std.tokens token) | reveals the token |
| `Bearer` or `Bearer ` (empty) | `undefined` |
| `Bearer a b`, `Bearer a,b`, `Bearer a\tb` | `undefined` |
| `Bearer` and 4,097 token characters | `undefined` |
| `Basic YWxhZGRpbg==`, `Token abc`, `Bearerabc` | `undefined` |
| two headers, `Bearer a` and `Bearer b` (read as `Bearer a, Bearer b`) | `undefined` |

The grammar is RFC 7235's `credentials = auth-scheme 1*SP token68` with `token68 = 1*( ALPHA / DIGIT / "-" / "." / "_" / "~" / "+" / "/" ) *"="`, plus the 4,096 bound: `/^bearer +([A-Za-z0-9\-._~+/]{1,4096}=*)$/i` over the trimmed value.

**Headers.**

| Header | Before | After |
| --- | --- | --- |
| `access-control-allow-headers` on an allowed origin's preflight to an API route | `accept, content-type, x-keel` | `accept, authorization, content-type, x-keel` |
| `cache-control` on an API route's answer to a request carrying `authorization` | none on a GET; `no-store` on a write | `no-store` |
| `cache-control` on any write's answer | `no-store` (code, not spec) | `no-store` (k.api) |

### D1. Which actions declare `output`
**API route actions, all of them, and no page action.** An action's answer means one of two things today. On a page it is navigation: `Form` reads `ok(href)` as "go there" and `ok(null)` as "re-run the loaders" (k.router Form), and a document POST turns it into a 303. On an API route nothing navigates; the same `Href | null` is a string a script reads. The gap is that a script, or a page's own code calling a service, needs data, and the kernel's one way to declare a data shape is a schema (PRINCIPLES 4). So an API action declares `output`, as a loader does, and its `fn` returns `Result<T, KeelError>` for the schema's type.

**`Href | null` stays where it means navigation, and only there.** Default 2 says a new path that duplicates an existing one replaces it everywhere or is dropped. Making `output` optional on API routes would leave two answers on one route kind: an action without it would still send an href as data, and a reader would have to look at the declaration to know which kind of answer a route gives. With `output` required on API routes and refused on pages, each route kind has one answer shape, and the type of `fn` says which one it is. Page actions are untouched: no page app changes.

**Why not `output` on page actions too.** A page action's answer is consumed by `Form`, which navigates or revalidates; data in it would need a second consumer in the router and a way to hand it to a component. The settings-page case does not need that: the page's code calls the API route through `service({ module })` and gets the data back, which is the path k.api already names for calling an API route. A page action with data would be a second way to do what that call does (Questions 1 records the cost of the other choice).

**A write that answers nothing** declares `output: s.object({})` and returns `ok({})`. golden-2 already has the schema as `Nothing`. The schema library has no `s.null()`, and adding one for this would be a second kernel change; `{}` is a value every client can decode. The wire answer of such a write changes from `"value": null` to `"value": {}` (Migration).

**E1512 is a type error first.** `routes.actions` is typed per entry today (`ActionsFit`); the new check sits beside the `params` check and its message is the diagnostic text, which `keel check` maps to the code. `routes.actions` throws it at run time for untyped tables. There is no fix diff: the edit is in the action's own file, not at the binding.

### D2. The wire answer
**One answer shape, the one that exists.** k.server answers every runtime request with a `Result` as JSON, and a `module` service already reads `{ ok, value }` and decodes `value` with its endpoint's `output` (k.services Encoding). An API action's answer stays that shape; only what `value` holds changes. 200 for every `ok`, with no 201 or 204: a status per answer kind would be a second way to say what `output` says, and a 204 has no body to hold `{}`.

**Parse before save.** Today `runAction` saves the stores inside the action's run and answers after. With `output`, the value is parsed by `output` first. A value `output` refuses is a bug in the action (the type allowed it, as `{}` allows any non-null value, or a refinement such as `max` failed), so it answers as k.server answers a loader's E1554: a `diag` naming the first refused path, never the value, and 500 `keel.unexpected`. Because the parse comes first, nothing is saved, and the client's view of the store stays true. Then the stores are saved; a conflict answers 409 `keel.conflict`, and the value, which may hold a token whose row was not saved, is dropped. So a minted token reaches the client only when its digest is stored.

**`no-store` on every write.** `handle.ts` already sets it on every action response; the spec now says so, in k.api because k.server has no room. A token in an answer must not sit in a shared or a browser cache, and a write's answer is never a cacheable read anyway.

**Errors and `keel.conflict`.** Unchanged: an `err` answers at its code's k.server status, 409 for `keel.conflict`, 422 for `keel.fields`, 503 for `keel.busy`, 400 for any other. `errors` on an endpoint decodes them as today.

### D3. Output and the rest of the kernel
**Services.** A `module` endpoint's `output` is the action's `output`. Nothing in `@keel/services` changes for output: it already decodes the `ok` value with the endpoint's `output` (k.services Encoding), and a 3xx is still `api.status`.

**Compatibility.** `.keel/surface.json` records an action's answer as `Href | null` for every action (k.compat Surface). It records an API action's answer as the JSON Schema of its `output` and a page action's as `Href | null`. E1561 then reports an endpoint whose `output` refuses the action's, and E1562 a change to an API action's `output` that a deployed caller in another deployable refuses. This is where the migration is found: golden-2's `kitchen` POST endpoints declare `output: s.string().nullable()`, which refuses `{}`, and `keel check` names each one.

**OpenAPI.** Keel has no OpenAPI export; k.openapi imports only. An export, when it is built, reads `output` for the 200 response of a write, so the document derives from the schema (PRINCIPLES 4). This RFC adds none.

**Forms and the router.** `Form action` takes an `Href`, and `routes.href` names pages only (k.api Calling), so `Form` never posts to an API route; the client router matches no API route. Neither changes. The router has no fetcher API. A page that wants a write's data calls the API route through its service from an event handler (Example).

**`#k-state`, sessions, inspect.** A service's answer is not a store. If page code puts a token into a store, it is captured as any store value is: Questions 4.

### D4. Secrets and personal data in an output
**A secret cannot leave as a secret.** `s.secret` encodes as `"[secret]"` (k.privacy), so an `output` with `token: s.secret(s.string())` would compile, run, and answer the marker. The kernel refuses it where it is written: `action()` and `loader()` walk the `output` node once at declaration and throw E1113 at the first `secret` node, naming its path. A declaration-time throw is how `manifest()` refuses E1505 and E1507; it fires on import, so the first test, `keel dev` start or `createApp` sees it. An endpoint's `output` may hold `s.secret`: decoding a raw string into a `Secret` on the receiving side is what `s.secret` is for.

**A secret leaves by `reveal`, once, in the action's file.** `return ok({ token: reveal(minted.value.token) })`. The rules that exist cover it as they stand:
- E1105: `reveal` is imported only in `*.server.ts` files, and every action is in one (E1551).
- E1112: a `return` is not a sink, and `ok(...)` is a call, which ends a flow (k.reveal). The same revealed value given to `tx`, a log or a throw in that file is still reported. k.reveal gains one sentence saying the `return` case is deliberate, and one conformance case.
- E1111: about route `params` and `search`; not affected.
- The output field is `s.string()`. Its value is plain data from there on: in the HTTP body, in the client's decoded value, in whatever the client does with it. The action's file is the one place it is revealed, and a reviewer can find it by searching for `reveal(`.

**Personal data.** A `.pii(class)` node in an `output` encodes as written (k.privacy: personal data serializes where the app sends it), and its values join the request's `[pii]` scrub set, as a loader's output does: `notePii(rq.pii, action.output, encoded)`.

**The server log's `[secret]` scrub.** A `diag` record is scrubbed of the revealed value of each `Secret` in the decoded action input; it is also scrubbed of the revealed `bearer`. The revealed token in an action's `ok` value is not added: after the action returns, the only `diag` of that request is E1554, which names a path and never a value, and before it returns the value is not known to the server. A token a helper throws inside the action is the case RFC 0103 lists under Known limits, unchanged.

### D5. Who gets `bearer`
**API route handlers only.** The `authorization` header is how a script, another service or a cross-origin client names itself; a browser page never sends it on a navigation or a `Form` post. k.api already separates the two kinds of route: pages answer documents to browsers holding the caller cookie, and API routes answer JSON to anyone allowed. Reading the header on API routes only keeps that line where it is.

**The types follow the route kind where they can.** An API action is known by its `output`, so its `fn` gets `bearer` and a page action's `fn` has no such key: a page action that reads `bearer` does not compile. A loader or a guard does not know its route's kind (one `guard({ redirect })` may guard pages and API routes), so their arguments always carry `bearer`, and the server gives a page's guard and loader `undefined`. A guard that requires a bearer therefore denies on a page, which fails closed.

**Why not every route.** It would let a script read page loaders as data with a token, a second way to build what an API route is for, and it would read a credential header on requests that cannot carry one from a browser. Questions 2.

**Live loaders.** An event-stream GET to an API route's live loader gets `bearer` in its arguments too: a script can follow a channel with a token. A browser `EventSource` cannot send the header, so a page still follows with the cookie.

### D6. The parse
**`undefined` for anything that is not one clear Bearer token.** The rules, in order:
1. No header: `undefined`.
2. The value as `Headers.get` gives it: two headers are joined with `, `, and leading and trailing whitespace is trimmed.
3. The scheme is `bearer` in any letter case, as RFC 7235 makes schemes case-insensitive, followed by one or more spaces (no tab).
4. The token is token68, 1 to 4,096 characters, then any number of `=`. A space, a comma or a tab inside it, an empty token, or a longer one: `undefined`. Two headers always contain `, ` and so are `undefined`; the server never picks one of two credentials.
5. Any other scheme (`Basic`, `Digest`, `Token`): `undefined`.

4,096 is the bound because a JWT with a few dozen claims stays under 2 KiB, a std.tokens token is 86 characters, and Node's default limit for all request headers together is 16 KiB.

**No error status, no log line.** A malformed header is not an error of the request: the handler sees `undefined` and its guard or action denies as it would for none. Logging it would let any client write lines into the server log. There is no 401 and no `WWW-Authenticate` (D10, Questions 3).

**A `Secret` before app code runs.** The server parses the token with `s.secret(s.string())` when it builds the request scope, before any guard. The raw header string is not kept on the scope. The revealed text joins the scope's `secrets` set, so every `diag` of that request has it replaced by `[secret]` in each written form `scrubbed` matches (as is, URL-encoded, JSON-escaped, base64). The `req` record never held a header and does not now. `String(bearer)`, `JSON.stringify` and `util.inspect` give the marker (k.privacy).

**What app code does with it.** It hands it to `credentials(ctx).check(bearer, find)` (std.tokens), which reads the text inside the package. App code that reveals it is held to E1112 like any revealed value.

### D7. Caller, origin checks, CORS and caching
**`bearer` and `caller` are independent.** `caller` stays the hash of the signed cookie (k.server), minted on a write without one; `bearer` is the header. A request may carry both, one or neither, and the handler decides what each means. A bearer does not stop the cookie from being set on a script's write: the script ignores it, and changing the cookie rule for some requests would be a second caller rule (Questions 6).

**The same-site check is unchanged, and still sufficient.** It refuses a cross-site browser write that rides ambient credentials. A bearer is not ambient: a browser attaches `authorization` only when page code sets it, and setting it on a cross-origin request needs a preflight, which only an allowed origin on an API route passes (k.hosting). A script sends neither `Origin` nor `Sec-Fetch-Site` and passes as today. A shell's native client sends neither and passes. So no rule is added and none is relaxed: a bearer does not exempt a request from the check, and a request from a disallowed origin that somehow carries one is still 403.

**CORS.** The preflight's `access-control-allow-headers` gains `authorization`. It is still granted only to an allowed origin on an API route. `access-control-allow-credentials: true` stays, so a cross-origin client may send the cookie, the token, or both. This is what lets a client served from another site, where the caller cookie cannot reach (W1567), name its sender.

**Caching.** An API route's answer to a request that carries `authorization` is `Cache-Control: no-store`, whatever the method, and every write's answer already is. Shared caches do not store an authorized response by default (RFC 9111 section 3.5), but a browser's own cache may, and a loader's JSON has no `Cache-Control` today. A response a token unlocked is per-token data, so nothing keeps it. The header is set on the presence of `authorization`, valid or not, so a malformed token does not get a cacheable 403.

### D8. Sending a bearer from a services client
**A call option, per call.** `api.addReport({ body, bearer }, ctx)`. A token belongs to a user or a script, so it varies per call; a `service({ ..., bearer })` option would fix one token at import, and Keel has no path for a secret at import (RFC 0100 Questions 2). It is a `Secret<string>`, so a client never holds the plain text in a value that could reach a log, and `@keel/services` reveals it in one place to build the header. A `base` service sends it too: a third-party API that takes a Bearer token is the other half of this.

**Checked before sending.** A token outside D6's form (a space inside, over 4,096 characters, empty) is `api.input` with issue `{ path: ['bearer'], rule: 'format' }`, and no request is sent, as for a `params` that fails its schema. An `events: true` endpoint sends it on its one GET.

**std.offline.** `SendInput` drops `bearer` beside `signal`. An outbox entry is written to `ctx.storage` and replayed later, possibly by another ctx; a `Secret` never persists, and a stored token would outlive its sender's intent. An app that queues writes offline uses the caller cookie, as golden-1 does.

**What stays stdlib.** k.services "Not here" keeps getting and refreshing tokens: a sign-in flow, OAuth, refresh on 401. The kernel carries a token on a request and nothing more.

### D9. Tests and shells
**Server tests** send the header on the `Request` they give `createApp`'s `fetch`, as they send `content-type` today. **Service tests** pass `bearer` to the client call under a sim ctx; the sim net route receives the `Request` with the header, and a route that forwards to `app.fetch` serves it (Example). **`renderRoute`** renders pages, whose guards and loaders get `undefined`, so it gains no option; its `caller` option stays. **Direct calls**: `action.run(input, at, ctx)`, `loader.run(args, ctx)` and `guard.run(req, ctx)` take `bearer` as optional, as `guard.run` takes `caller`, so no existing test changes.

**Shells.** A Capacitor or Tauri build's `net` driver forwards a request's headers to `KEEL_ORIGIN` through the native client (k.shell), so a service call with `bearer` works there unchanged, with no preflight, and the caller cookie works in the shell's own cookie store as today. A shell cannot keep a token across launches: a `Secret` never serializes, so `ctx.storage` cannot hold one, and the platform keychains are not a Keel capability (Known limits).

### D10. What is left out, and why no `headers` object
**A general `headers` object** in what a handler receives would give every handler every header. It is rejected on three principles. PRINCIPLES 1: each header would become a second way to carry what the kernel already carries (the caller cookie, `accept`, the input body), and an app could read `x-user-id` from a proxy where `caller` is the rule. PRINCIPLES 2: a handler's result would depend on headers a proxy, a CDN or another deployable adds, none visible in the file. PRINCIPLES 4: a header map is `Record<string, string>`, the opposite of a schema; a named, typed `bearer` is one field with one parse. One header is enough to close the gap; another would come with its own RFC and reason.

Also left out, each with the reason:
- Other schemes (`Basic`, `Digest`): Basic sends a password on every request, and Keel's passwords are checked by `credentials(ctx).verify` in an action that issues a token.
- A 401 status with `WWW-Authenticate`: the denial is the app's, through `keel.denied` (403) or the error `check` returns (400); a kernel status would need a new KeelError code (Questions 3).
- `output` on page actions (D1).
- A caller made from a token: `caller` is the cookie; an app that wants "the owner of this token" reads it from the row `check` returns.
- An OpenAPI export (D3).
- A bearer in `renderRoute` (D9).

### Example: RFC 0103's Example 2 on the new shapes
A signed-in user's settings page asks for an API token, sees it once, and a script presents it on later requests. Module `accounts`, in a `node` deployable. Every file below typechecks under the strict profile against the Prototype's types, and the two server files hold one `reveal` between them.

```ts
// modules/accounts/TokenRow.schema.ts
import { s } from "@keel/schema";
import { Digested } from "@keel/std-credentials";

/** One API token: its non-secret id, the digest `mint` gave (the expiry is inside it), and the caller who made it. */
export const TokenRow = s.object({ id: s.string({ min: 16, max: 16 }), digest: Digested, owner: s.string() });
export type TokenRow = s.infer<typeof TokenRow>;
```
```ts
// modules/accounts/Report.schema.ts
import { s } from "@keel/schema";

export const Report = s.object({ owner: s.string(), text: s.string({ max: 2000 }) });
export type Report = s.infer<typeof Report>;
```
```ts
// modules/accounts/Accounts.schema.ts
import { s } from "@keel/schema";
import { Report } from "./Report.schema.ts";
import { TokenRow } from "./TokenRow.schema.ts";

export const Accounts = s.object({ tokens: s.array(TokenRow), reports: s.array(Report) });
export type Accounts = s.infer<typeof Accounts>;
```
```ts
// modules/accounts/NewToken.schema.ts
import { s } from "@keel/schema";

/** What `POST /api/tokens` answers, once: the token's text, its id and its expiry. */
export const NewToken = s.object({
  token: s.string({ max: 128 }),
  id: s.string({ min: 16, max: 16 }),
  expiresAt: s.int().nullable(),
});
export type NewToken = s.infer<typeof NewToken>;
```
```ts
// modules/accounts/ReportText.schema.ts
import { s } from "@keel/schema";

export const ReportText = s.object({ text: s.string({ min: 1, max: 2000 }) });
export type ReportText = s.infer<typeof ReportText>;
```
```ts
// modules/accounts/Reports.schema.ts
import { s } from "@keel/schema";
import { Report } from "./Report.schema.ts";

export const Reports = s.object({ reports: s.array(Report) });
export type Reports = s.infer<typeof Reports>;
```
```ts
// modules/accounts/Nothing.schema.ts
import { s } from "@keel/schema";

/** The input or answer of a write that carries no fields. */
export const Nothing = s.object({});
export type Nothing = s.infer<typeof Nothing>;
```
```ts
// modules/accounts/addToken.ts
import { transaction } from "@keel/store";
import type { Store } from "@keel/store";
import type { Accounts } from "./Accounts.schema.ts";
import { TokenRow } from "./TokenRow.schema.ts";

export const addToken = (accounts: Store<Accounts>) =>
  transaction(accounts, "accounts.addToken", TokenRow, (state, row) => ({
    ...state,
    tokens: state.tokens.some((t) => t.id === row.id) ? state.tokens : [...state.tokens, row],
  }));
```
```ts
// modules/accounts/addReport.ts
import { transaction } from "@keel/store";
import type { Store } from "@keel/store";
import type { Accounts } from "./Accounts.schema.ts";
import { Report } from "./Report.schema.ts";

export const addReport = (accounts: Store<Accounts>) =>
  transaction(accounts, "accounts.addReport", Report, (state, report) => ({
    ...state,
    reports: [...state.reports, report],
  }));
```
```ts
// modules/accounts/accountStores.ts
import { store } from "@keel/store";
import { Accounts } from "./Accounts.schema.ts";
import { addReport } from "./addReport.ts";
import { addToken } from "./addToken.ts";

export const accountStores = () => {
  const accounts = store(Accounts, { tokens: [], reports: [] }, { id: "accounts.accounts" });
  return { accounts, addToken: addToken(accounts), addReport: addReport(accounts) };
};
```
```ts
// modules/accounts/denied.ts
import type { KeelError } from "@keel/schema";

/** The answer to a request with no bearer token: 403 (k.server Status). */
export const denied: KeelError<"keel.denied", null> = { code: "keel.denied", message: "keel.denied", data: null };
```
```ts
// modules/accounts/postToken.server.ts
import { action } from "@keel/router";
import { err, ok, reveal } from "@keel/schema";
import { credentials } from "@keel/std-credentials/server";
import { tx } from "@keel/store";
import { NewToken } from "./NewToken.schema.ts";
import { Nothing } from "./Nothing.schema.ts";
import { accountStores } from "./accountStores.ts";

/** `POST /api/tokens`: a new API token for this caller, good for 90 days, answered once and stored as its digest. */
export const postToken = action(
  { input: Nothing, output: NewToken, stores: accountStores },
  (_input, { caller, stores }, ctx) => {
    const minted = credentials(ctx).mint({ ttl: 90 * 86_400_000 });
    if (!minted.ok) return err(minted.error);
    const { id, digest, expiresAt, token } = minted.value;
    const r = tx(stores.addToken, { id, digest, owner: caller });
    return r.ok ? ok({ token: reveal(token), id, expiresAt }) : err(r.error);
  },
);
```
```ts
// modules/accounts/postReport.server.ts
import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { credentials } from "@keel/std-credentials/server";
import { tx } from "@keel/store";
import { Nothing } from "./Nothing.schema.ts";
import { ReportText } from "./ReportText.schema.ts";
import { accountStores } from "./accountStores.ts";
import { denied } from "./denied.ts";

/** `POST /api/reports` with `Authorization: Bearer <token>`: a report filed as the token's owner. */
export const postReport = action(
  { input: ReportText, output: Nothing, stores: accountStores },
  (input, { bearer, stores }, ctx) => {
    if (bearer === undefined) return err(denied);
    const found = credentials(ctx).check(bearer, (id) => stores.accounts.get("tokens").find((t) => t.id === id));
    if (!found.ok) return err(found.error);
    const r = tx(stores.addReport, { owner: found.value.owner, text: input.text });
    return r.ok ? ok({}) : err(r.error);
  },
);
```
```ts
// modules/accounts/loadReports.server.ts
import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { credentials } from "@keel/std-credentials/server";
import { Reports } from "./Reports.schema.ts";
import { accountStores } from "./accountStores.ts";
import { denied } from "./denied.ts";

/** `GET /api/reports` with `Authorization: Bearer <token>`: the reports of the token's owner. */
export const loadReports = loader({ output: Reports, stores: accountStores }, async ({ bearer, stores }, ctx) => {
  if (bearer === undefined) return err(denied);
  const found = credentials(ctx).check(bearer, (id) => stores.accounts.get("tokens").find((t) => t.id === id));
  if (!found.ok) return err(found.error);
  const owner = found.value.owner;
  return ok({ reports: stores.accounts.get("reports").filter((r) => r.owner === owner) });
});
```
```ts
// modules/accounts/routes.ts
import { manifest } from "@keel/router";
import { loadReports } from "./loadReports.server.ts";
import { postReport } from "./postReport.server.ts";
import { postToken } from "./postToken.server.ts";

export const routes = manifest({
  "accounts.tokens": { api: true, path: "/api/tokens" },
  "accounts.reports": { api: true, path: "/api/reports", loader: loadReports },
});
routes.actions({
  "accounts.tokens": { POST: postToken },
  "accounts.reports": { POST: postReport },
});
```
```ts
// modules/accounts/AccountsApi.schema.ts
import { endpoints } from "@keel/services";
import { NewToken } from "./NewToken.schema.ts";
import { Nothing } from "./Nothing.schema.ts";
import { ReportText } from "./ReportText.schema.ts";
import { Reports } from "./Reports.schema.ts";

/** The `accounts` API routes as a module service reads them: each `output` is the action's or loader's own. */
export const AccountsApi = endpoints({
  createToken: { method: "POST", path: "/api/tokens", body: Nothing, output: NewToken },
  addReport: { method: "POST", path: "/api/reports", body: ReportText, output: Nothing },
  listReports: { method: "GET", path: "/api/reports", output: Reports },
});
```
```ts
// modules/accounts/accounts.service.ts
import { service } from "@keel/services";
import { AccountsApi } from "./AccountsApi.schema.ts";

export const accounts = service({ module: "accounts", schema: AccountsApi });
```
```ts
// test/tokens.test.ts
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { createApp } from "@keel/server";
import { expect, it } from "vitest";
import { accounts } from "../modules/accounts/accounts.service.ts";
import { routes } from "../modules/accounts/routes.ts";
import topology from "../topology.ts";

it("answers a token once, then files and lists reports under it", async () => {
  const app = await createApp({ topology, routes, ctx: createCtx({ mode: "sim", seed: 7 }), deployable: "api" });
  const ctx = createCtx({ mode: "sim", seed: 1 });
  ctx.net.route("http://accounts.keel.invalid/api/*", (req) => app.fetch(req));
  const made = await accounts.createToken({ body: {} }, ctx);
  if (!made.ok) throw new Error(made.error.code);
  const parsed = s.secret(s.string()).parse(made.value.token);
  if (!parsed.ok) throw new Error("not a token");
  const bearer = parsed.value;
  expect((await accounts.addReport({ body: { text: "late" }, bearer }, ctx)).ok).toBe(true);
  const listed = await accounts.listReports({ bearer }, ctx);
  expect(listed.ok && listed.value.reports.length).toBe(1);
  const anonymous = await accounts.addReport({ body: { text: "late" } }, ctx);
  expect(!anonymous.ok && anonymous.error.code).toBe("api.status");
});
```

- The token is revealed once, in the last line of `postToken`, into `NewToken.token`, an `s.string()`. E1112 reports nothing: the value goes to `ok`, a call, and then to `return`. `tx` gets `id` and `digest`, never the token.
- If `addToken` refuses or the save conflicts, the answer is an `err` or a 409 and the token is never sent. If it succeeds and `NewToken` refuses the value, the answer is 500 and nothing is saved.
- `postReport` and `loadReports` narrow `bearer` from `Secret<string> | undefined` and hand it to `check`, which reads it inside the package. Neither file imports `reveal`.
- The GET takes its token in a header. RFC 0103 D9's "a GET route has no good way to take one" is gone.
- A settings page in the `todos`-style client module calls `accounts.createToken({ body: {} }, ctx)` from a button's handler, keeps `made.value.token` in a component-local `signal`, and renders it in one `Text`. The browser sends the caller cookie and `x-keel: 1`, so the same-site check passes, and `caller` names the owner.
- A script presents it: `curl -X POST https://api.example/api/reports -H 'authorization: Bearer keel_0123456789abcdef_<64 hex>' -H 'content-type: application/json' -d '{"text":"late"}'` answers `{"ok":true,"value":{}}`; on day 91, 400 with `credentials.expired`; without the header, 403 `keel.denied`.
- Nothing in either std-credentials call changed from RFC 0103: `mint` and `check` are used as that RFC specifies.
- The test file was typechecked against stubs of `createApp` (its present options, narrowed to the four used) and of vitest's `it` and `expect`; the rest against the Prototype's types.

### Prototype
In a scratch directory outside the repo: a stub `@keel/router` with the `action` overloads, `ApiAction`, the loader and guard arguments and `ActionsFit`'s E1512 check exactly as under API; a stub `@keel/services` client with `bearer`; `@keel/std-credentials` stubbed from RFC 0103's API section; `@keel/schema`, `@keel/store` and `@keel/ctx` from the repo's sources. `tsc` 5.9.3 over the Example's files reports nothing. These fail to compile, each checked with `@ts-expect-error`:
- an action without `output` bound to an API route, and one with `output` bound to a page (E1512's message);
- `action({ input, output: s.object({ n: s.int() }) }, () => ok('/x'))`;
- a page action reading `bearer`;
- `credentials(ctx).check(bearer, find)` with `bearer` not narrowed from `undefined`.

One finding from it: `output: s.object({})` types its value as `{}`, which TypeScript lets any non-null value meet, so `ok('/x')` compiles against `Nothing`. The parse before save catches it at run time (E1554, D2). A narrower `output` catches it at compile time.

## Alternatives
- **`output` optional on API actions, `Href | null` kept when absent.** No migration. Rejected under default 2: an API route would have two answer shapes and the reader could not tell which from the route (Questions 1).
- **`output` on page actions too, with `Form` handing the value to the page.** Rejected: a second way to do what a service call to an API route does, and a new consumer in the router (D1).
- **A separate `apiAction()` function.** Rejected: two names for one concept; `output` present or absent is the declaration, and `routes.actions` checks it against the route kind.
- **Infer the route kind for `bearer` and `output` from where the action is bound.** Rejected: an action is declared before it is bound, in another statement, and its type must be fixed there (PRINCIPLES 2).
- **`s.secret` in `output` encoding as its revealed text.** The client would decode it back to a `Secret` and the action would need no `reveal`. Rejected: it breaks "a secret never serializes" for every schema, the browser cannot read a `Secret` (E1105 forbids `reveal` there), so a settings page could not show it, and a `reveal` the reviewer can search for would become an invisible one.
- **E1113 as a type error.** Rejected for now: a recursive type over every schema type that finds `Secret` costs compile time on every `loader` and `action`, and the declaration-time throw fires on import (Questions 7).
- **`ok(null)` kept for empty answers by adding `s.null()`.** Rejected: a second kernel change to save a migration of `null` to `{}` (Questions 1).
- **A status per answer (201 for a create, 204 for empty).** Rejected (D2).
- **`bearer` on every route.** Rejected (D5, Questions 2).
- **A general `headers` object, or `headers: ['authorization']` declared per route.** Rejected (D10). The declared form is smaller but still a second way per header, and a route-level declaration makes a handler's input depend on its route entry in another file.
- **The token in `caller`, or `caller` derived from a valid token.** Rejected: `caller` is the cookie's hash and scopes undo; a token's owner is app data that `check` returns.
- **A 400 or 401 for a malformed header.** Rejected: any client could turn a header typo into an error page in place of the route's own denial, and log lines (D6).
- **Exempting bearer requests from the same-site check.** Rejected: it adds a rule and closes nothing; scripts already pass and browsers need a preflight (D7).
- **`bearer` as a `service()` option.** Rejected (D8).
- **The outbox persisting a bearer.** Rejected: a secret never persists (default 4).
- **A kernel 401 KeelError code.** Rejected for this RFC (Questions 3).

## Spec diff
Token counts are ceil(chars/4) of the whole file after the change, as `tooling/budgets.mjs` counts them, measured on scratch copies of `spec/kernel/` at `910450b9`. No section is created; `spec/00-map.md` does not change (1,198).

### k.api (888 to 1,465)
In **Requests**, the bullet "- A write: the same-site check, then the action's `Result` as JSON; never 303." becomes:

> - A write: the same-site check, then the action's `Result` as JSON (Output); never 303.

Two paragraphs before **Calling.**:

> **Output.** An API route's action declares `output`, a schema, and a page's action does not (E1512): `action({ input, output, params?, stores? }, fn)`, whose `fn` returns `Result<T, KeelError>` for `output`'s type `T`. An `ok` value is parsed by `output` before any store is saved (fail: E1554, nothing saved), then the stores are saved (k.server Server state), then the answer is 200 `application/json` `{ "ok": true, "value": <encoded> }`; a 409 `keel.conflict` sends no value. A write that answers nothing declares `output: s.object({})` and returns `ok({})`. Every write's answer is `Cache-Control: no-store`. `output` holds no `s.secret` (k.privacy).
>
> **Bearer.** An API route's guard, loader and action get `bearer: Secret<string> | undefined` beside `caller`, from the `authorization` header; a page's action has none, and a page's guard and loader get `undefined`. The header's value, less leading and trailing whitespace, is the scheme `Bearer` in any letter case, one or more spaces, then 1 to 4,096 characters of `A-Z a-z 0-9 - . _ ~ + /` and any trailing `=`. Anything else is `undefined`: no header, another scheme, an empty or longer token, a space inside it, or two headers (joined by `, `); it is no error and is not logged. The token is a `Secret` before app code runs (k.privacy). `bearer` and `caller` are independent: neither reads the other's header, and the same-site check of a write is unchanged. A response to a request carrying `authorization` is `Cache-Control: no-store`.

**Rules**, after "thrown by `createApp`; no fix":

> · E1512 an action without `output` on an API route, or with one on a page; a type error, and `routes.actions` throws it; no fix.

**Conformance**, four bullets at the end:

> - An action with `output: s.object({ n: s.int() })` returning `ok({ n: 1 })` answers 200 `{ "ok": true, "value": { "n": 1 } }`, `cache-control: no-store`; returning `ok({ n: 0.5 })`, 500 and no store saved.
> - An API route's action without `output`, and a page's with one, do not compile, and `routes.actions` throws E1512.
> - With `authorization` `Bearer abc`, `bearer abc` or `BEARER  abc=`, an API route's guard, loader and action get a `bearer` revealing `abc` (`abc=`); with `Basic abc`, `Bearer`, `Bearer a b`, a 4,097-character token or two headers, `undefined`; on a page, `undefined`.
> - A GET to an API route with `authorization` answers `cache-control: no-store`.

The code block under **Entry** stays: `postList` is declared elsewhere, and after the migration it declares `output`.

### k.server (1,500 to 1,494)
**API**, the loader bullet: "`fn` gets `{ params, search, url, caller, stores }` and `ctx`" becomes "`fn` gets `{ params, search, url, caller, bearer, stores }` and `ctx`".

**API**, the action bullet becomes:

> - `action({ input, output?, params?, stores? }, fn)`: `fn` gets the decoded input, `{ params, url, caller, stores }` and `ctx`; returns `Result<Href | null, KeelError>` (with `output`: k.api); routes bind it by method (`routes.actions`, k.router).

**Build**, trimmed to pay for the two: "**Build.** `assets`: k.deploy; runners, peers, `keel dev`, the document entry without `assets`: k.topology." becomes "**Build.** k.deploy, k.topology." Both sections still name what they own in their own text; the map lists them.

**Rules**: "E1554 loader data fails its output schema" becomes "E1554 loader or action data fails its output schema".

### k.guards (284 to 297)
"`caller` is k.server's `caller` (`''` if none or client-only)." becomes:

> `caller` is k.server's `caller` (`''` if none or client-only); `bearer` is k.api's (`undefined` off an API route).

### k.privacy (1,374 to 1,497)
**Secrets**, after "and nothing at run time tells it from another value.":

> A `loader` or `action` `output` holds no `s.secret` (E1113); a secret leaves as `reveal(secret)` in an `s.string()` field (k.api).

**Sinks**, the Server log bullet, after "is replaced by `[secret]` the same way.":

> An action's `output` counts as a loader's, and `bearer` (k.api) as a `Secret` input.

**Rules**, after the E1112 entry:

> · E1113 an `s.secret` node in a `loader` or `action` `output`, thrown at declaration (fix: none).

**Conformance**, two bullets at the end:

> - An `action` or `loader` whose `output` has an `s.secret` field throws E1113; with `s.string()`, none.
> - An API action throwing the revealed `bearer` logs `[secret]` in its place.

The sentence `packages/server/conformance/privacy-diag-scrub.test.ts` quotes is kept word for word; the new one follows it.

### k.reveal (709 to 750)
**Flow**, after "Any other call, a parameter and an import end it (a hash passes; a helper is not read).":

> A `return` is not a sink: an API action's `output` is where a revealed value leaves on purpose (k.api).

**Conformance**, one bullet at the end:

> - `return ok({ token: reveal(p.k) })` in an action is none.

### k.hosting (1,087 to 1,108)
**Allowed origins**, the preflight bullet: "`access-control-allow-headers: accept, content-type, x-keel`" becomes "`access-control-allow-headers: accept, authorization, content-type, x-keel`".

**Caller**, after "is one W1567 `diag` per origin.":

> Such a request can name its sender with a `bearer` (k.api) instead.

### k.services (1,222 to 1,302)
**API**, "- A client method takes `{ params?, query?, body?, signal? }` and `ctx`." becomes:

> - A client method takes `{ params?, query?, body?, signal?, bearer? }` and `ctx`. `bearer`, a `Secret<string>`, is sent as `authorization: Bearer <token>`; a token outside k.api's Bearer form is `api.input` at `bearer`.

**Not here**: "retries, caching, auth and token refresh, interceptors." becomes "retries, caching, getting and refreshing tokens, interceptors."

**Conformance**, one bullet at the end:

> - With `bearer` a secret of `abc`, the request carries `authorization: Bearer abc`; with `a b`, the call is `api.input` with issue path `bearer` and sends no request.

### k.compat (1,431 to 1,481)
**Surface**: "per action method, its `input` and answer (`Href | null`);" becomes "per action method, its `input` and answer (its `output` on an API route, else `Href | null`);".

**Conformance**, after "- A GET endpoint to a route with no loader is one E1561.":

> - A POST endpoint with `output: s.string().nullable()` to an API route whose action's `output` is `s.object({ n: s.int() })` is one E1561; with that `output`, none.

### Unchanged
k.router (1,499): `Form` posts to pages, whose actions keep `Href | null`; E1505 and E1507 stand. k.security (1,499): its headers are unchanged; the new `Cache-Control` rules live in k.api. k.errors (1,492): no KeelError code. k.testing (1,416): `renderRoute` renders pages (D9). k.shell (1,320): the driver already forwards headers. k.forms, k.ctx, k.sim: unchanged. std.tokens: its API and conformance stand; `check(input.token, find)` in its E1112 case is still clean, and `check(bearer, find)` is the same call. std.offline: its spec sentence about `send` names no `bearer`; only the type changes (D8).

## Conformance diff
Written by the `conformance-writer` from the changed spec sections, without reading `packages/*/src`. Every file is in the `rfc:0104` PR. Each starts with one `// Spec: <section>, <paragraph> "<sentence>"` line per sentence it tests, quoted whole, then `// Seed: 1337.`.

**New files**

| File | Quotes | Cases |
| --- | --- | --- |
| `packages/server/conformance/api-output-0104.test.ts` | k.api Output (all), k.api C1, k.server the action bullet | An API action with `output: s.object({ n: s.int() })` over a store factory: `ok({ n: 1 })` answers 200, body `{ ok: true, value: { n: 1 } }`, `content-type` JSON, `cache-control: no-store`, and its store change is saved (a following GET reads it). `ok({ n: 0.5 })`: 500 `keel.unexpected`, one `diag` E1554 naming `n` and not the value, the store unchanged. Two overlapping actions on one factory: the later is 409 `keel.conflict` and its body has no `value`. `err` of an app code: 400 with the error. A document POST (`accept: text/html`, form body) to the route: the same JSON, no `Location`. A page action's answer to a document POST is still 303. A `.pii('contact')` field in `output` answered as written, and its value replaced by `[pii]` in a `diag` of a later throw in the same request (a loader on the route that throws). |
| `packages/router/conformance/action-output-0104.test.ts` | k.api Output first sentence, k.api C2, the E1512 Rules entry, k.privacy C (E1113) and the Secrets sentence | Type cases with `@ts-expect-error`: an action without `output` bound to an API route; one with `output` bound to a page; an output action returning `ok('/x')` for `output: s.object({ n: s.int() })`; a page action reading `bearer`. Run-time cases over an untyped table (`manifest` given a widened record): `routes.actions` throws an error whose `code` is E1512 for each binding. `action()` with `output: s.object({ t: s.secret(s.string()) })`, with `s.array(s.secret(s.string()))` and with `s.object({ a: s.object({ b: s.secret(s.string()) }) })`: each throws E1113 naming the path; `loader()` the same; `s.string()` in each place: none. `endpoints({ x: { method: 'GET', path: '/x', output: s.object({ t: s.secret(s.string()) }) } })`: no throw. |
| `packages/server/conformance/bearer-0104.test.ts` | k.api Bearer (all), k.api C3 and C4, k.guards the `bearer` sentence, k.privacy C (bearer scrub) and the Server log sentence, k.hosting the preflight bullet | One app with an API route (guard, loader, POST action, a live loader) and a page (guard, loader, action), each recording what it got. For each row of the RFC's parse table: what the guard, the loader and the action saw (revealed in the test). A property over generated token68 strings of 1 to 4,096 characters and generated scheme casings: revealed equal to the token; over generated strings with a space, comma or tab inside, or 4,097 to 5,000 characters: `undefined`. The page's guard and loader: `undefined` for `Bearer abc`. The live loader's event-stream GET: `bearer` reveals the token. An API GET with `authorization` (valid or not): `cache-control: no-store`; without: as today. A write with `Bearer abc` and no cookie: `caller` is a fresh hash and a cookie is set; with a signed cookie and `Bearer abc`: `caller` is the cookie's hash and `bearer` reveals `abc`. A write from `Origin: https://evil.test` with `Sec-Fetch-Site: cross-site` and `Bearer abc`: 403, nothing runs. An allowed origin's preflight: `access-control-allow-headers` lists `accept, authorization, content-type, x-keel`. An action throwing `new Error('t=' + reveal(bearer))`, in dev and production: the `diag` holds `[secret]` and not the token, and no log line in the whole run holds the token in any of the four forms `scrubbed` matches. |
| `packages/services/conformance/bearer-0104.test.ts` | k.services the client-method bullet, k.services C (bearer) | Under sim, a net route that records the `Request`: a call with `bearer` a secret of `abc` sends `authorization: Bearer abc`; a call without sends no `authorization`; an `events: true` endpoint sends it on its GET. `a b`, `''`, and 4,097 characters: `api.input` with issue path `bearer`, no request sent. A `base` service sends it the same way. The call's input object passed through `JSON.stringify` holds `"[secret]"`, not `abc`. |
| `packages/check/conformance/e1112-return-0104.test.ts` | k.reveal the `return` sentence, k.reveal C (return) | `check()` over `modules/accounts/postToken.server.ts` exactly as the RFC's Example: no E1112, no E1105. The same file with `tx(stores.addToken, { id, digest, owner: reveal(token) })`: one E1112. `return ok({ token: reveal(p.k) })` and `return reveal(p.k)` in an action: none. |
| `packages/cli/conformance/compat-output-0104.test.ts` | k.compat the Surface sentence, k.compat C (POST endpoint) | `keel build` of a fixture whose API action declares `output: s.object({ n: s.int() })`: `.keel/surface.json` records that answer as the output's JSON Schema; a page action's as `Href | null`. A `service({ module })` POST endpoint with `output: s.string().nullable()` to it: one E1561; with the action's `output`: none. With a base whose answer was `{ n }` and a current `output` without `n`, and the caller in another deployable: one E1562. |

**Existing files that change** (each needs this RFC's `rfc:0104` commit):

| File | Why | Change |
| --- | --- | --- |
| `packages/server/conformance/hosting-0087.test.ts` | the preflight's header list is spec text; its API actions would throw E1512 | the expected `access-control-allow-headers` tokens gain `authorization`; each action bound to an API route gains `output: s.object({})` and returns `ok({})`; any `value: null` it asserts becomes `value: {}` |
| `packages/server/conformance/api-routes-0086.test.ts` | its `write` action is bound to an API route | `write` gains `output: s.object({})`, returns `ok({})`; asserted bodies follow |
| `packages/router/conformance/api-routes-0086.test.ts` | the same | the same |
| `packages/std-channels/conformance/fixtures.ts` | six actions bound to API routes | each gains `output: s.object({})` and returns `ok({})` |
| `packages/std-channels/conformance/publish-scope.test.ts` | asserts a POST answer `value: null` | `value: {}` |
| `packages/std-sessions/conformance/ingest-list.test.ts` | asserts `sessions.ingest`'s answer `value: null` | `value: {}` |
| `packages/check/conformance/fixtures-by-code.ts` | every code `check()` reports needs a fixture | an E1512 entry: `bad`, a manifest binding a page action to an API route (resolving `@keel/router` as the E1510 fixture does); `clean`, the same with `output` |
| `packages/server/conformance/e1554-loader-output-schema.test.ts` | its header quotes "E1554 loader data fails its output schema" | the quote line only: "E1554 loader or action data fails its output schema" |

Checked and unchanged: `packages/server/conformance/privacy-diag-scrub.test.ts` (its sentence is kept), `packages/services/conformance/module-unwrap-0092.test.ts` (it stubs the wire with a string `value` and decodes it with a nullable string `output`, which stays true of any action whose `output` is that), `packages/cli/conformance/compat-support.ts` (its fixtures bind actions to pages, whose answer stays `Href | null`), every other conformance file that binds actions (all to pages). The `std-credentials` conformance is being written now; lane 6 runs it and reports any binding to an API route.

E1113 is thrown, not reported by `check()`, so `explain-and-fixture-per-code.test.ts` finds its assertion in `action-output-0104.test.ts`, as it finds the other thrown codes'. Both codes need `explain` rows (lane 5).

## Lanes and build order
Written for agents who have read only this RFC. The user accepts the RFC first. Then lane 1 goes alone; lanes 2 and 3 run in parallel; lanes 4, 5 and 6 run in parallel after lane 3; lane 7 runs after 4, 5 and 6; lane 8 last. Machine rules for every lane: one test file at a time (`perl -e 'alarm 300; exec @ARGV' pnpm --filter <pkg> exec vitest run <file> --reporter=dot 2>&1 | tail -20`), every command bounded, no watch mode, no process left running. No lane edits `spec/**`, `tooling/budgets.json`, `tasks/BACKLOG.md` or `docs/HANDOFF.md`; the orchestrator owns them.

### Lane 1. Orchestrator: spec (one commit, `rfc:0104 spec`)
Apply the Spec diff to `spec/kernel/k.api.md`, `k.server.md`, `k.guards.md`, `k.privacy.md`, `k.reveal.md`, `k.hosting.md`, `k.services.md` and `k.compat.md`, exactly. Run `node tooling/budgets.mjs` for the token budgets only if it can be bounded; else measure each file with `Math.ceil(text.length / 4)` and compare with the counts above. `pnpm spec k.api | tail -n +4` prints the new section.

### Lane 2. `conformance-writer` (the `rfc:0104` PR)
Owns the six new conformance files and the eight existing ones listed under Conformance diff, nothing else. Writes from the spec; does not read `packages/*/src`. The new suites are red until lanes 3 to 6 land; the writer checks each file parses and each `// Spec:` line quotes its sentence exactly. Reports: files written, any sentence it could not test as written.

### Lane 3. Router (kernel agent): `packages/router/src`, `packages/router/test`
- `types/ApiAction.ts` (new): the interface under API. `types/Action.ts`: `readonly output?: never`. `types/RouteActions.ts`: each method takes `Action<unknown> | ApiAction<unknown, unknown>`.
- `action.ts`: the two overloads; the implementation keeps `run: fn` for a page action and, for an API action, `run: (input, at, ctx) => fn(input, { ...at, bearer: at.bearer }, ctx)` so a direct call may leave `bearer` out. With `output`, walk `output.node` once (object fields, array items, record values, union variants, nullable and optional wrappers) and throw an `Error` with `code: 'E1113'` and the dotted path at the first `kind: 'secret'` node.
- `loader.ts`, `types/Loader.ts`: `bearer` in `fn`'s args and `bearer?` in `run`'s and `live`'s; the same E1113 walk over `output`.
- `guard.ts`, `types/Guard.ts`, `types/ApiGuard.ts`: `bearer` in `fn`'s request, `bearer?` in `run`'s, defaulting to `undefined`.
- `types/ActionsFit.ts`: the kind check of the Prototype (`A extends { readonly output: object }` on an `api: true` entry, the reverse elsewhere), with the two messages under API.
- `internal/attachActions.ts` (or wherever `routes.actions` validates today): throw `code: 'E1512'` for the same two cases.
- `internal/RouterCore.ts` and `internal/FormSeam.ts` need no change: the client router runs page chains only, and `run` takes `bearer` as optional, so guards and loaders get `undefined`.
- Tests in `packages/router/test/`: the overloads' types (a `.test-d.ts` or `expectTypeOf` file); the E1113 walk over generated schema trees with one `secret` node placed at a generated path (property, seed 1337): it throws exactly when one is present and names that path; `ActionsFit` over both kinds.
Verification: `pnpm --filter @keel/router check`, each test file alone, `pnpm --filter @keel/router build`.

### Lane 4. Server (kernel agent, after lane 3): `packages/server/src`, `packages/server/test`
- `internal/bearerOf.ts` (new): `(raw: Request) => Secret<string> | undefined` by D6's regex, parsed with `s.secret(s.string())`.
- `internal/RequestScope.ts`: `bearer: Secret<string> | undefined`. `createApp.ts` builds it with `bearerOf(raw)` when `matchUrl(served, path)` names an API route (today it matches only when an allow list is set, so this match is new), else `undefined`, and adds its revealed text to `secrets`. The raw header is not stored.
- `internal/runGuards.ts`, `runLoaders.ts`, `liveStream.ts`, `runAction.ts`: pass `bearer` beside `caller` (API actions only for `runAction`).
- `internal/runAction.ts`: for an action with `output`, after an `ok`: parse with `output` (fail: the E1554 diag and 500, `rq.held.clear()`, nothing saved), encode, `notePii(rq.pii, action.output, encoded)`, then `saveStores`, then `jsonResponse(200, ok(encoded))`. A page action is unchanged.
- `internal/handle.ts`: an API route's response to a request with an `authorization` header gets `cache-control: no-store` (reuse `noStore`).
- `internal/withCors.ts`: `accept, authorization, content-type, x-keel`.
- `README.md` (the allowed-headers line) and the comments this touches: present tense, no RFC ids.
- Tests: `bearerOf` against the parse table and a property over generated header values (never throws; `undefined` unless the regex matches); `runAction` ordering (a spy store shows no save on a refused `output`).
Verification: `pnpm --filter @keel/server check`, each test file alone, `pnpm --filter @keel/server build`.

### Lane 5. Services, std-offline and check (one agent, after lane 3): `packages/services/src`, `packages/services/test`, `packages/std-offline/src/SendInput.ts`, `packages/check/src`
- `packages/services/src/Client.ts`: `bearer?: Secret<string>` in `Input`. `internal/buildRequest.ts`: with `bearer`, reveal it once, check D6's token form (else `api.input` with issue `{ path: ['bearer'], rule: 'format' }`, nothing sent), and set `authorization: Bearer <token>`. `internal/events.ts` sends it on its GET.
- `packages/std-offline/src/SendInput.ts`: drop `bearer` with `signal` (`P extends 'signal' | 'bearer' ? never : P`). Run `packages/std-offline` check and its `send` tests.
- `packages/check/src/internal/EXPLANATIONS.ts`: E1512 and E1113 rows, the text under API. `internal/mapTsDiagnostic.ts`: the two E1512 messages map to E1512 at the `routes.actions` key. `reportedCodes()` gains E1512.
Verification: `pnpm --filter @keel/services check` and `build`; `pnpm --filter @keel/check check` and `build`; `packages/check/conformance/explain.test.ts` alone; `fixture-per-code.test.ts` alone once lane 2's fixture lands.

### Lane 6. Compat (one agent, after lane 3): `packages/cli/src/internal/surfaceOf.ts` and its tests
An action with `output` records `schemaOf(action.output)` as its answer; one without keeps `ACTION_ANSWER`. Its doc comment says both. Verification: `pnpm --filter @keel/cli check`, `packages/cli/test/surface.test.ts` alone, then `compat-output-0104.test.ts` alone once lane 2 lands.

### Lane 7. Migration (one agent, after lanes 4 to 6)
Owns the files listed under Migration that are not conformance. For each API route action: `output: Nothing` (the module's own `s.object({})` schema, created where the module has none) and `ok({})` in place of `ok(null)`. For each endpoint and test that reads such an answer: `value: {}` and an `output` that accepts `{}`. `keel check` on each golden app lists every endpoint E1561 still refuses. Verification: `pnpm --filter <app or package> check`, then each touched test file alone. Reports: files touched, any action that answered something other than `ok(null)`.

### Lane 8. Orchestrator
- Run every new and changed conformance file once, one at a time. Spec statuses of the eight sections stay `conformance-covered` when their suites are green.
- Docs, present tense and no RFC ids. `docs/THREAT-MODEL.md`: **Allowed origins** lists `accept, authorization, content-type, x-keel`; a new bullet after **Caller identity**: "**Bearer.** An API route's handlers get the `authorization: Bearer` token as a `Secret` (`bearer`); any other value of the header is none, and pages never read it. It is scrubbed from the log and never kept by the server. It does not change `caller` or the same-site check, and a response to a request that carries one is `no-store`. Checking it is the app's (`credentials(ctx).check`)."; **Credentials**, the "Not covered" clause "a token's way out of a write and in by a header, which the kernel does not carry;" is removed. Skills: `keel-api` (API actions declare `output`; `bearer`; `{ body, bearer }` on a call; E1512, E1113 in its description), `keel-server` (`output` and `bearer` in the handler arguments), `keel-compliance` (a token leaves as `reveal` into an `s.string()` `output` field; E1113), `keel-forms` (a page's `Form` posts to a page action, which declares no `output`). `packages/std-credentials/README.md`: the token example uses `output` and `bearer`.
- Changesets: `@keel/router`, `@keel/server`, `@keel/services`, `@keel/check`, `@keel/cli`, `@keel/std-offline`, `@keel/std-channels`, `@keel/std-sessions` minor, one paragraph each.
- `node tooling/budgets.mjs` on a quiet tree (Budget); the ledger with `pnpm ledger` on a quiet tree: k.api, k.privacy, k.services, k.compat, k.reveal items gain their new clauses at the rung each test gives (`probabilistic` for the generated-header and generated-schema properties, `example` for the rest).
- `tasks/BACKLOG.md`: close the kernel line RFC 0103 filed; file the Known limits that have a next step (`tasks/FUTURE.md` for the rest).
- `docs/HANDOFF.md` and the task's `PLAN.md`: the user's answers to Questions 1 to 5 and the orchestrator's on 6 to 9.

## Migration
Needed for golden apps 1 and 2, two std packages and their tests; the user decides it with D1 (Questions 1). Every change is mechanical: `ok(null)` in an API action becomes `ok({})` under `output: Nothing`, and readers of that answer expect `{}`.

| Where | Change |
| --- | --- |
| `apps/golden-1/modules/api/post*.server.ts` (7) and `modules/digest/refresh.server.ts` | `output: Nothing`, `ok({})` |
| `apps/golden-1/modules/todos/WriteAnswer.schema.ts` | `value: s.object({})` |
| `apps/golden-1/modules/todos/todos.service.ts`, `digest/board.service.ts` | each POST endpoint's `output` accepts `{}` (`keel check` E1561 names them) |
| `apps/golden-1/test/` `api`, `board`, `digest`, `formAnswer`, `removalParts` | asserted `value: null` of API writes becomes `value: {}` |
| `apps/golden-2/modules/kitchen/postRecipe.server.ts`, `postFavorite.server.ts` | `output: Nothing`, `ok({})` |
| `apps/golden-2/modules/recipes/kitchen.service.ts` | the two POST endpoints' `output: s.string().nullable()` becomes `Nothing` |
| `apps/golden-2/test/api.test.ts`, `recipes.test.ts` | `value: {}` |
| `packages/std-sessions/src/routes/ingestSession.ts` | `output: s.object({})`, `ok({})`; its client reader and `packages/std-sessions/test/` follow |
| `packages/std-channels/src/server/channelRoute.ts` | both POST variants `output: s.object({})`, `ok({})`; `internal/apiOf.ts`'s publish `output` reads the whole body as an open object and stays |
| `packages/server/test`, `packages/router/test`, `packages/services/test` | the unit tests that bind an action to an API route or assert its `value: null` (`apiRoutes`, `jsonBody`, `hardening`, `formRoundTrip.property`, `document`, `client.example` among them; lanes 3 to 5 run each) |
| `evals/tasks/golden-1-api/spec-slice.txt`, `golden-2/`, `golden-3/` | copies of spec text the eval tasks hand an agent; the orchestrator regenerates them from the new sections |

No app outside the repo uses Keel. Page actions, `Form`, every loader and every guard need no change; `bearer` is additive in their arguments. An app outside the repo that reads `value: null` from an API write reads `{}`.

## Token impact
| Section | Before | After |
| --- | --- | --- |
| k.api | 888 | 1,465 |
| k.server | 1,500 | 1,494 |
| k.guards | 284 | 297 |
| k.privacy | 1,374 | 1,497 |
| k.reveal | 709 | 750 |
| k.hosting | 1,087 | 1,108 |
| k.services | 1,222 | 1,302 |
| k.compat | 1,431 | 1,481 |
| `spec/00-map.md` | 1,198 | 1,198 |

A task that touches an API action reads k.api (1,465) and k.server (1,494), 2,959 tokens, under the 4k of PRINCIPLES 8. `keel explain E1512` and `keel explain E1113` are one row each, under 120 tokens.

## Budget
Estimated; lane 8 measures with `tooling/budgets.mjs` on a quiet tree. A breach is re-based with the reason in the commit (default 7), never by lowering a threshold.

| Entry | Limit | Added, estimated (gzip) | Why |
| --- | --- | --- | --- |
| `@keel/router` | 10.25kb | 200 to 300 B | the E1113 walk, the E1512 check in `routes.actions`, `bearer` plumbing |
| `@keel/server` | 20.25kb | 250 to 350 B | `bearerOf`, the parse-before-save path, `no-store` on authorized answers |
| `@keel/services` | 3.25kb | 100 to 150 B | the header and its check |
| `@keel/check` | 53kb | 200 to 300 B | two explain rows, the E1512 message mapping |
| `@keel/cli` | 25kb | under 50 B | one branch in `surfaceOf` |

`@keel/services` at 3.25kb has the least room in absolute terms; if it breaches, the token check reuses the server's regex from a shared internal file of `@keel/schema` rather than a second copy.

## Risks
- A migration across two golden apps and two std packages. Each step is mechanical and `keel check` (E1512, E1561) lists what is left, but it touches tests that assert answers, and a missed `value: null` fails a test rather than shipping.
- `output: s.object({})` accepts any non-null value at compile time (Prototype). A write that means to answer nothing and returns something by mistake is caught by the parse at run time (E1554), not by `tsc`.
- A token in a response body. It is in the client's memory from then on; if page code puts it in a store, std.sessions captures it and `/__keel/inspect` shows it in dev (Questions 4).
- A long-lived bearer in a script's environment or shell history is outside Keel. `ttl` (std.tokens) bounds its life.
- The `no-store` rule keys on the presence of `authorization`. A proxy that strips the header before Keel sees it also removes the bearer, so nothing token-scoped is answered either.
- `bearer` on every API guard, loader and action means app code may start treating a token as identity without `check`. Nothing in the kernel says a bearer is valid; `check` does. The skill text and the threat model say so.
- Two `authorization` headers are `undefined`. A client that sends both a proxy's credential and the app's token gets denied rather than half-authenticated.
- Changing `withCors`' header list widens what an allowed origin may send. It is still granted only to the listed origins and only on API routes.
- E1113 throws at import. A module whose loader has a secret in its output fails to load in every environment at once, which is loud and immediate; the message names the path.

## Known limits
- One header. Anything else a client needs to say goes in the body, the path or the query, under their schemas.
- No 401 and no `WWW-Authenticate`; a script reads the error code in the body.
- A shell has no secure place to keep a token across launches (D9). A shell app signs in per launch or uses the caller cookie, which its cookie store keeps.
- An outbox write carries no bearer (D8).
- A page cannot answer data from its own action; it calls the API route's service (D1).
- `caller` stays a per-browser cookie; a token's owner is app data.
- The revealed token in an action's answer is not added to the request's `[secret]` scrub set (D4); a helper in another file that throws it is logged as written, as RFC 0103 Known limits says.
- A `bearer` cannot be passed to `renderRoute`; page code never sees one.
- No OpenAPI export. When one is built, `output` is its source for a write's response.
- The token form is token68 up to 4,096 characters; a credential outside it (with spaces, or longer) cannot be a bearer.

## Questions
Answered: the user accepted 1 to 5 as recommended on 2026-11-16, and the orchestrator accepted 6 to 9 under the defaults cited (recorded in `PLAN.md` and `docs/HANDOFF.md` for the user to confirm or reverse). The questions stand below as they were asked.

1. **`output` required on every API action (D1).** Recommendation: required, with `ok({})` for an empty answer, and `Href | null` for pages only. The other form makes `output` optional, keeps `Href | null` JSON on API routes without one, and needs no migration; its cost is two answer shapes on one route kind and a script reading an href as data, against default 2. A third form adds `s.null()` to the schema library so empty writes keep `ok(null)` and the wire stays `null`; its cost is a k.schema change to avoid a mechanical migration. The user's: API shape and golden app migration.
2. **`bearer` on API routes only (D5).** Recommendation: API routes only, `undefined` on a page's guard and loader, absent from a page action's type. The other form reads it on every route; its cost is that page loaders become a token-readable data API beside API routes, and a credential header is parsed on every document request. The user's: security and API shape.
3. **No kernel 401 (D6, D10).** Recommendation: none; a missing or bad bearer is the app's denial (`keel.denied` 403, or `check`'s error at 400). The other form adds a KeelError code such as `keel.unauthorized` at 401 with `WWW-Authenticate: Bearer`; its cost is a new kernel code and status, and a second way to deny beside `keel.denied`. The user's: security and API shape.
4. **The token in the answer is a plain `s.string()` (D4).** Recommendation: plain, revealed once in the action's file, kept out of stores by the page that shows it, with that rule in `keel-compliance`. The other form recommends `.pii('identifier')` on the field so sessions, logs and the evidence bundle redact it; its cost is a personal-data mark on a value that is a credential, which then shows in COMPLIANCE's data map as personal data. The user's: privacy.
5. **`bearer` per call on the services client, refused by std.offline (D8).** Recommendation: per call, `Secret<string>`, checked before sending. The other form is a `service({ bearer })` option; its cost is one token per client at import, with no source for it. The user's: API shape.
6. **The caller cookie on a bearer write (D7).** Recommendation: unchanged; a script's write still gets a fresh caller and a `Set-Cookie` it ignores. The other form skips the cookie when a bearer is present; its cost is a second caller rule. The orchestrator may accept it under default 2.
7. **E1113 at declaration (D4).** Recommendation: a throw from `action()` and `loader()`, as `manifest()` throws E1505. A type-level refusal can be added later without changing the code. The orchestrator may accept it under default 6.
8. **`no-store` on any API answer to a request with `authorization` (D7).** Recommendation: accept. The orchestrator may accept it under default 4.
9. **The 4,096-character bound and token68 (D6).** Recommendation: accept; RFC 7235's grammar, and the bound covers JWTs and std.tokens tokens with room. The orchestrator may accept it under default 6.
