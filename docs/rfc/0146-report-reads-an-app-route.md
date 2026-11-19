# RFC 0146: `keel report` reads an app's own route

Status: draft, for the orchestrator to accept (ADR-0168).

## Problem
`keel report [url]` fetches `<url>/__keel/inspect`, which a dev server answers and a build does not. A built app can make a `Tally` and has no way to hand it to a person through Keel: std.report's own Known limit. The fix must not add a production endpoint to Keel or make Keel hold a credential.

## Proposal
std.report changes. k.cli does not. The command's output does not change: one `report.tally` record per tally, then `ok report <n> tallies`.

### D1. Two forms, told apart by the URL alone
- **Inspect form**: `url` absent, or a URL whose path is empty or `/` and that has no query (`http://localhost:5173`, `http://host/`). Exactly as today: one request to `<url>/__keel/inspect`.
- **Route form**: a URL with a path beyond `/`, or a query (`https://app.example/admin/tallies`, `http://h/?team=3`). One request to the URL as given, query included. `/__keel/inspect` is never fetched.

The form is decided before any request, so each run makes one request and no answer is read twice or two ways. Every `keel report` invocation that works today is in the inspect form and behaves the same.

### D2. What a route answers
A 2xx answer whose body is JSON and parses with `Tally` or with `s.array(Tally)`. No content type is required. The app serves it from an API route of its own, behind its own guard:
```ts
// modules/orders/routes.ts
export const routes = manifest({
  'orders.tallies': { api: true, path: '/admin/tallies', guard: tallyReader, loader: loadTallies },
})
// loadTallies answers [tallyOf('orders.status', statuses)]
```
Keel serves no such route and names no path for it.

### D3. Order
A single `Tally` is one record. An array is emitted in the order given. The inspect form sorts by section id because `sections` is a map and has no order of its own; an array has one, the app chose it, and two tallies may share an `id`, which a sort would need a second key to break. `[]` is `ok report 0 tallies`, exit 0.

### D4. Anything else is E1056
In the route form, a target that is unreachable, a non-2xx answer, a body that is not JSON, and JSON that parses with neither `Tally` nor `s.array(Tally)` are each E1056, exit 1. That includes an inspect document (a `url` that already ends in `/__keel/inspect` is a route-form URL) and an array with one item that fails `Tally`: a route that serves tallies and one bad row is a fault to show, where a foreign inspect section is another package's business and is skipped. A guard that answers a sign-in page with 200 lands here too: not JSON.

The E1056 message names the URL without its query, cut to 48 characters as today. A query may carry a value the caller would not want in a log.

### D5. A credential, without Keel holding one
`keel inspect` takes none. `keel session ingest` and `keel session monitor` have the one mechanism in the tree: `KEEL_SESSIONS_TOKEN` in the caller's environment (`io.env`), sent as the caller cookie, `__Host-keel-caller` to an https URL and `keel-caller` otherwise (`packages/std-sessions/src/internal/readerHeaders.ts`), and the route's guard admits a `caller` its config lists.

`keel report` reuses it under its own name: with `KEEL_REPORT_TOKEN` set and non-empty, the route-form request carries that cookie. The app's guard reads `caller` and decides, as `sessions.reader` does. Keel reads the variable for one request and stores nothing; there is no flag, so no credential sits in shell history or in an MCP tool call's arguments. The inspect form sends no cookie: a dev inspect document has no guard.

Without the variable the request carries no credential and the route must admit the caller's network position.

### D6. Unchanged
I1055 without `Io.fetch` or without the package in `deps`; the json and pretty renderings; the MCP `report` tool (same `url` input). No code is reserved.

## Known limits
- A dev app is read at its origin. `keel report http://host/base` used to fetch `http://host/base/__keel/inspect` and now fetches `http://host/base`; no dev server in the tree serves the inspect document under a base path.
- The caller cookie identifies a `caller`, not a `user` (k.user). A route guarded by `user` alone is not readable by `keel report`; the guard admits a listed `caller`, as `sessions.reader` does, or the network does the guarding.
- A redirect is followed by `fetch`; a cross-origin one drops the cookie, by the fetch standard.
- std.report is at 1,500 tokens after this unit. Its next change needs a trim or a split.

## Alternatives
- A1. Try the URL as given, and fall back to `<url>/__keel/inspect` when the body is not a tally and the URL has no path. Two requests for the common dev case, and the meaning of an answer depends on a second answer. Rejected for D1.
- A2. Tell the forms apart by the body: fetch the URL as given and accept an inspect document, a `Tally` or an array. Then `keel report http://localhost:5173` asks the dev app for `/`, gets a page and fails; the default would have to change. Rejected.
- A3. A flag (`--route`). A second way to say what the URL already says. Rejected.
- A4. Sort an array by `id`. See D3.
- A5. Skip array items that fail `Tally`, as the inspect form skips sections. Hides a broken route behind a short list. Rejected (D4).
- A6. A `--header` flag. New surface on a std command, a secret on the command line, and nothing else in the CLI has one. Rejected for D5.
- A7. No credential at all. Smallest, and leaves a guarded route readable only from inside the network. The runner-up to D5.
- A8. Reuse `KEEL_SESSIONS_TOKEN`. One variable for two packages' routes sends a sessions credential to a URL that may not be a sessions reader. Rejected.
- A9. A Keel route in the build (`/__keel/report`). A production endpoint and its guard become Keel's. Rejected by decision D82.

## Spec diff
- `spec/std/std.report.md` (5,000 to 6,000 characters, the limit):
  - Status `conformance-covered` becomes `implemented` here and in `spec/std/README.md` while bullets 16 to 18 have no evidence; it goes back with the conformance commit.
  - New paragraph **An app's own route** after **Reaching a person** (D1 to D5).
  - Prose shortened to fit, no change of meaning: **Entries** ("is data only", "the package"); **Reaching a person** drops the repeated compact example, "ordered" and "`keel inspect` prints those".
  - Conformance: bullets 1 to 15 unchanged. Appended 16 to 18 (below).
- `spec/std/README.md`: the std.report row reads `implemented`.
- `spec/kernel/k.cli.md`, `spec/00-map.md`: unchanged.
- Codes: none new.

Bullet 12 ("`keel report` against an unreachable url, a non-2xx answer or a body that is not an inspect document emits E1056 and exits 1") stays true of every URL it was written for: a URL without a path or query is in the inspect form, whose behaviour is unchanged, and its test runs the default URL and `http://localhost:1`. Read without that scope it would cover a route-form URL answering a tally; the new paragraph and bullet 17 give that form its own E1056 rule.

Appended std.report bullets:
16. `keel report http://h/t?x=1` makes one request, to it: a `Tally` body prints its compact line and `ok report 1 tallies`; an array of tallies `b`, `a` prints `b`, `a`, `ok report 2 tallies`; `[]` prints `ok report 0 tallies`; each exits 0.
17. For a `url` with a path or a query, a non-2xx answer, a body that is not JSON, an inspect document, or an array with an item failing `Tally` emits E1056, exits 1 and prints no part of the query.
18. With `KEEL_REPORT_TOKEN=t` in `io.env` that request carries `cookie: __Host-keel-caller=t` over https and `cookie: keel-caller=t` over http; a `url` without path or query gets none.

## Conformance diff
One `rfc:0146` commit by the `conformance-writer`, red. New files under `packages/std-report/conformance/`, each importing `@keel/std-report/tools` and running `run(['report', url, ...], io)` from `@keel/cli` with `io.fetch` recording `(url, init)`:
- Bullet 16: assert the recorded URL list equals `['http://h/t?x=1']`; bodies a `Tally`, a two-item array whose ids are out of alphabetical order, and `[]`. A property over generated tally arrays (seeded) that the printed lines follow the array's order.
- Bullet 17: statuses 404 and 500, body `<html>`, an inspect document, `[tally, { kind: 'report.tally' }]`; a URL `http://h/t?secret=abc123` and an assertion that stdout and stderr hold neither `secret` nor `abc123`. Run it in compact and json.
- Bullet 18: `io.env` with and without the variable; https and http URLs; read the `cookie` header from the recorded `init.headers` (a plain object or `Headers`); the inspect form with the variable set records no cookie.
- No existing file changes: all thirteen use URLs without a path or pass none.

## Migration
- `packages/std-report/src/command.ts`: choose the form from the parsed URL; the route form fetches as given with the cookie header when `io.env.KEEL_REPORT_TOKEN` is non-empty and parses the body with `Tally`, then `s.array(Tally)`; E1056 messages drop the query. The operation's `description` names both forms and stays inside the MCP `tools/list` budget (1,750).
- `packages/std-report/README.md`, the skills that name `keel report`, `docs/OUTPUT.md` if it lists environment variables a command reads.
- `apps/golden-2`: an API route serves a tally behind a guard, and a test reads it with `keel report` against the built server.
- Changeset: `@keel/std-report`.
- Migration note: none needed; every working invocation keeps its meaning.

## Build order
1. This RFC, ADR-0168, std.report and the README row (commit 1).
2. `conformance-writer`: the Conformance diff, red (commit 2).
3. Builder: the Migration; std.report back to `conformance-covered` when green.

## Token impact
std.report 1,500 (was 1,250). k.cli and the map unchanged.

## Choices
Each is the author's call for the orchestrator to confirm or reverse.
- C1: the form is read from the URL: no path and no query is the inspect form, anything else the route form; one request either way (D1). Runner-up: A1.
- C2: a route answers `Tally` or `s.array(Tally)`; nothing else, an inspect document included, is accepted there (D2, D4).
- C3: an array is emitted in the order given (D3). Runner-up: by `id` ascending, to match the inspect form.
- C4: one item failing `Tally` fails the whole answer with E1056 (D4). Runner-up: A5.
- C5: `KEEL_REPORT_TOKEN` in the environment is sent as the caller cookie, route form only (D5). Runner-up: A7, no credential.
- C6: the E1056 message leaves out the query (D4).
- C7: no new code and no change to k.cli (D6).
