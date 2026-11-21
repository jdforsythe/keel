# k.api: API routes
status: conformance-covered

**Purpose.** A route that answers JSON has no view. It is an API entry of the module's contract (k.contract), which declares its `method`, `path`, `params`, `query`, `body`, `output` and `errors`; the binding gives it a `loader` (GET) or an `action` (a write) and an optional `guard`. A guard's `redirect` is optional: a guard without one guards API entries only, and on a page or layout it is a type error and `manifest()` throws E1508 (k.guards). In `routes.json` an API entry has `api: true` and its `method`.

**Requests.** The server answers an API entry as a runtime request (k.server) whatever `accept` says; it renders no HTML and is no island root. After the guard it decodes `query` (fail: 422 `keel.fields`, issue paths prefixed `query`; nothing runs), which may require keys.
- GET with a loader: `{ id, results }` as JSON with the loader's status. With `accept: text/event-stream` on a live loader: the stream.
- Paths: the router keys its table by path pattern, and a pattern holds one page or one contract's API entries at distinct methods (else E1502, k.routes). A request matches the pattern by path, then the entry by method; that entry's guard and handler run. HEAD runs the GET entry and sends no body. A method no entry at the pattern has is 405, no guard run, with `allow` the pattern's methods in the order GET, HEAD, POST, PUT, PATCH, DELETE (HEAD with GET). OPTIONS is no entry method: a preflight is k.hosting's, any other OPTIONS 405.
- A write: the same-site check, then the action's `Result` as JSON (Output); never 303.
- A guard denial: 403 `keel.denied` as JSON; the guard's `redirect` is not followed.
- `accept: text/event-stream` on an entry that is not live: 406 after the guard and before `query`, so a denial is 403 first.
- Every error status of k.server, as the `Result` JSON.

**Output.** An API entry's handler returns `Result<T, KeelError>` for its `output`'s type `T`; a page's action declares no `output` (k.contract Handlers). An `ok` value is parsed by `output` before any store is saved (fail: E1554, nothing saved), then the stores are saved (k.server Server state), then the answer is 200 `application/json` `{ "ok": true, "value": <encoded> }`; a 409 `keel.conflict` sends no value. A write that answers nothing declares `output: s.object({})` and returns `ok({})`. Every write's answer is `Cache-Control: no-store`. An `output` holds no `s.secret` (E1113, k.privacy): a secret leaves a `loader` or `action` `output` as `reveal(secret)` in an `s.string()` field.

**Bearer.** An API route's guard, loader and action get `bearer: Secret<string> | undefined` beside `caller`, from the `authorization` header; a page's action has none, and a page's guard and loader get `undefined`. The header's value, less leading and trailing spaces and tabs, is the scheme `Bearer` in any letter case, one or more spaces, then 1 to 4,096 characters of `A-Z a-z 0-9 - . _ ~ + /` and any trailing `=`. Anything else is `undefined`: no header, another scheme, an empty or longer token, a space inside it, or two headers (joined by `, `); it is no error and is not logged. The token is a `Secret` before app code runs (k.privacy). `bearer` and `caller` are independent: neither reads the other's header, and the same-site check of a write is unchanged. A response to a request carrying `authorization` is `Cache-Control: no-store`.

**Calling.** A contract's `href` takes page ids only, so `Link`, `navigate` and `Form action` cannot name an API entry; a guard `redirect` naming one is E1508 at the first read of the table. `matchHref` returns `null` for an API path and the client router matches none, so a link to one is a document request. Modules call an API entry through `service({ contract })` (k.services).

**Rules.** E1511 an API entry in a module a `client` or `static` deployable serves (k.topology); reported from `topology.ts`, thrown by `createApp`; no fix. E1510: k.contract.

**Conformance.**
- An API entry bound with a `component` does not compile and `manifest()` throws E1510.
- `matchHref` of an API entry's path is `null`.
- An API GET whose `query` requires `q`, sent without it, answers 422 `keel.fields` at `query.q` and runs no loader; with a denying guard, 403 and `query` unread.
- A GET with `accept: text/html` to an API route with a loader gets the JSON body and status a runtime GET gets.
- A GET to a path with only a `POST` entry is 405 with `allow: POST`; with a GET entry too, a PUT is 405 `allow: GET, HEAD, POST`, a HEAD runs the GET entry's loader and sends no body, and a plain OPTIONS is 405 with that `allow`.
- In one contract, two POST entries at `/x`, or a page and an API entry at `/x`, make `contract` throw E1502 naming both ids; a GET and a POST entry at `/x` do not.
- A form POST to an API route gets the action's `Result` as JSON with no `Location`.
- A denying guard with a `redirect` answers 403 `keel.denied` and no `Location`.
- A guard without `redirect` on an API route denies with 403 `keel.denied`; on a page it does not compile and `manifest()` throws E1508.
- `createApp` for a `client` deployable serving an API route throws E1511.
- An action with `output: s.object({ n: s.int() })` returning `ok({ n: 1 })` answers 200 `{ "ok": true, "value": { "n": 1 } }`, `cache-control: no-store`; returning `ok({ n: 0.5 })`, 500 and no store saved.
- An API action returning a value its entry's `output` refuses does not compile.
- With `authorization` `Bearer abc`, `bearer abc` or `BEARER  abc=`, an API route's guard, loader and action get a `bearer` revealing `abc` (`abc=`); with `Basic abc`, `Bearer`, `Bearer a b`, a 4,097-character token or two headers, `undefined`; on a page, `undefined`.
- A GET to an API route with `authorization` answers `cache-control: no-store`.
