# RFC 0213: std.sessions: `capture` with no recorder is E1056; the session-id rule is spec, groups included

Status: implemented (ADR-0235), accepted by the orchestrator on 2026-11-24, for the operator to confirm. Amends std.sessions (API, Commands, Conformance) and std.multi (Module, Conformance). From backlog 1067 and 1068.

## Decisions
- D1: `keel session capture [url]` saves nothing and answers E1056, exit 1, when `sessions.live` is absent, `null` (no `record` on the page), an `error` section, or not a `Session`. Only a section holding a `Session` is a capture.
- D2: the session-id rule `^[A-Za-z0-9_-]{1,64}$` is stated in std.sessions as part of `sessions.Session`, and holds wherever a `Session` parses, nested ones included: a session file, a `sessions.ingest` body, the ingest archive, a group's `users`.
- D3: a bad id answers the code its container already answers for a schema failure: E2002 for a session file, 422 `keel.fields` for `sessions.ingest`, E2007 for a group file (and `replayGroup` throws E2007). No new code.
- D4: no other id in these sections needs the rule: a group has no id of its own and names its users by index, and no recording has a name; file names come from the fingerprint.
- D5: std.sessions states `ingest`'s failure code (E1056), which the code already answers.

## Problem
**1067.** std.sessions Commands says only "`capture [url]` saves `sessions.live`". The inspector section is `Session.nullable()`: a page that loads std-sessions and runs no `record` reports `{ doc, value: null }`. Today `capture` answers that with E1056 (message "has no sessions.live section", which misnames the case), answers a page without std-sessions the same way, and answers an `{ doc, error }` section (the read threw or failed its schema) with `ok` and nothing written. Three ways to have nothing to save, two outcomes, and no spec text for any of them.

**1068.** `Session.parse` refuses an `id` outside `^[A-Za-z0-9_-]{1,64}$`, but the rule lives in a `parse` override on `sessions.Session`, so a schema that nests `Session` (`SessionGroup.users`, the `Archive` of `sessions.ingest`) runs the shape's own parse and skips it: `SessionGroup.parse` accepts a user id of `../x`. No spec text states the rule; std.multi says `users: Session[]`.

Where a session id goes today (a survey of `packages/std-sessions/src`):
- No file path. `capture` and `ingest` write `.keel/sessions/<fingerprint>-<n>.json` (`fileOf`: the fingerprint when 12 hex, else zeros, and a counter; it throws on a separator or `..`). `to-test` writes `modules/<m>/test/session-<fingerprint>.test.ts`, the fingerprint the replay recomputed and `m` a module that serves `route.id` (else E2003). `minimize` rewrites the file it was given. Job files are `job-<pid>-<n>`.
- No storage key or URL. The archive is keyed by fingerprint; group users are indexed by position; `put` posts to the configured `upload`.
- Output only. The `session` output record carries `id` (json, compact, pretty), and the nightly Action puts it in an issue body through `clean`.

So there is no path traversal today. The risk is what the rule is for: an id is a short token that is safe in a record, a log line and an issue, and that a later feature could put in a file name without a second check. A rule that holds at the top level and not one level down is not a rule.

Stored recordings: no `.keel/sessions/` file and no group file is tracked under `apps/*` or `examples/*`; every generated id is a `random.id` UUID (36 characters of hex and `-`), and no hand-written id in tests or fixtures fails the rule. Nothing stored is refused.

## Proposal
### `capture` with nothing to save
Who runs `capture`: a person who has reproduced a bug in the dev app, a CI step, an agent. Each asked for the live session, so each needs to hear that there was none and why:
- A person who forgot `record` sees `ok session capture 0 sessions` and goes looking for a file that is not there. An error with the reason is the next step on the screen.
- A CI step that captures and then uploads the file passes with nothing to upload; the exit code is all it reads.
- An agent reads the exit code and the diagnostic code; `keel explain E1056` and the message tell it to check the URL and the page's `record`.

`ingest` is different: an archive with no sessions answered what was asked (the list is empty), so `ok` with 0 written stays right there. `capture` names one section on one page; with no session in it, the command did not do its one job.

Every non-capture is E1056, as k.cli's `keel inspect` answers a target that is not what it needs, and as `ingest` already does. The message names the case, so one code serves:
```
E1056 session capture found no recorder on the page (sessions.live is null): http://localhost:5173
fail session capture 0 sessions
```
Messages for the other cases: `has no sessions.live section` (absent), `sessions.live is an error: <the section's error>` (an `error` section), `sessions.live is not a session` (fails the schema).

### The id rule
std.sessions API: "`id` matches `^[A-Za-z0-9_-]{1,64}$` (a `random.id` UUID does) wherever a `Session` parses, nested ones included". The builder moves the rule from the `parse` override into the schema itself (an id or string refinement of the `id` field), so `SessionGroup`, `Archive` and any later container get it with no second check. The issue sits at `id` (in a group, `users.<i>.id`), so the existing E2002 and E2007 messages name the field.

std.multi Module: each of `users` is a `sessions.Session` under that rule; a group has no id of its own and its users are named by index.

## Alternatives
- **`capture` with nothing found is `ok`, 0 written.** OUTPUT.md has no "nothing to do" outcome, and an `ok` here hides a forgotten `record` from CI and agents. Rejected.
- **A new std code (E2011) for "no recorder".** E1056 already covers "the target did not answer what this command reads" for `ingest`, and the message names the case. Not proposed; listed for the operator.
- **E1057 for an `error` section**, as `keel inspect` reports one. E1057 is "a section that throws or fails its schema" from the page's side; `capture` reports what it could not save, one code for every non-capture. Not proposed.
- **A new code for a bad id.** Each container already has its schema-failure answer; a second code for one field would be two ways.
- **Leave the rule in `parse` and add it to `SessionGroup.parse` too.** Every new container would need the same patch.

## Spec diff
Applied in this commit.
- std.sessions (to `implemented` until its new clauses are covered): API states the id rule and where it holds; Commands states `capture`'s default URL, file and its E1056 cases, and `ingest`'s E1056; Conformance gains clauses #14 and #15.
- std.multi (to `implemented` until its new clause is covered): Module states that `users` meet the rule and that a group has no id; Conformance gains clause #8.
- No new code, no map change, no glossary term, no budget moves.

## Conformance diff
By the `conformance-writer`, from the spec text, in `packages/std-sessions/conformance/`:
- `capture-nothing-to-save.test.ts`: std.sessions #14, through `run(['session', 'capture', url])` with a fake `fetch` answering each inspect document.
- `session-id-rule.test.ts`: std.sessions #15 (schema, `keel session replay`, `sessions.ingest`).
- `group-user-id.test.ts`: std.multi #8, a clean group from `group-fixtures.ts` with `users[1].id` set to `../x`.

## Migration
None. Nothing stored is refused.

## Token impact
- Spec: std.sessions grows by about 230 tokens to about 1,730; std.multi by about 90 to about 1,070. Both under 3,100.
- `@keel/std-sessions`: a refinement replaces the override, and `capture` gains two branches; size to measure in the build.

## Build plan
1. This commit: RFC, ADR, spec text. Ledger rows std.sessions#14, #15 and std.multi#8 come from the orchestrator's regeneration.
2. `conformance-writer`: the three clauses.
3. Build:
- `packages/std-sessions/src/Session.schema.ts`: the rule on the `id` field, the `parse` override removed.
- `packages/std-sessions/src/internal/commandFetch.ts`: `capture`'s four cases, E1056 with the messages above; `test/unit/commandFetch.test.ts`: the `null` case's message, and the `{}` (no value) case becomes E1056.
- `packages/std-sessions/test/unit`: a nested-id case for `SessionGroup` and `Archive`.
- Docs: the `@keel/std-sessions` README (`capture` sentence, the id rule), a changeset, `tasks/BACKLOG.md` 1067 and 1068.

## For the operator
1. **`capture` with no session to save is E1056, exit 1.** Recommended: yes; a person, a CI step and an agent each asked for one session and need to hear there was none.
2. **One kernel code, E1056, for every non-capture**, the message naming the case, rather than a new E2011. Recommended: yes; reverse if `keel explain E1056` should not cover a page with no recorder.
3. **The id rule holds in nested sessions**, by moving it into the schema. Recommended: yes.
