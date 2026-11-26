---
name: keel-escapes
description: "Read keel review output and make the calls a rule cannot: is there a Keel seam, does the reason hold, was a test or configuration bent to pass; never approves a change or edits keel-review.json; R1001, R1010, R1011, R1012, R1013, R1014, R1050, R1051, R1052, R1053, R1055, R1056, R1057, R1058, R1059, R1060, R1061, R1100, R1101, R1102, R1103, R1104, R1105, R1107, R1108, R1150, R1151, R2451"
---

# Reading keel review

`keel review` lists each escape in a project: a place where code opts out of a protection by its sanctioned name (an opt-in) or goes around one (a workaround). The command decides where an escape is, what it reaches and whether it is new. You decide what a rule cannot: whether a Keel seam replaces it, whether its reason holds, and whether something was changed so a check would pass. See `keel docs k.review` and `keel docs k.escapes`.

Acceptance is a person's (Never, below).

## Run it

```
keel review origin/main..HEAD --format=json --list   # a change: what it adds, changes and keeps
keel review --all --format=json --list               # the whole tree: every escape, standing or accepted
```

Each finding is one `review` record: `code`, `path:line:col` at the head, `message`, `protection` (the section it opts out of or goes around), `opt` (true for an opt-in), `danger`, `novelty`, `loud`, `id`, and `reason` when the escape carries one (an `unsafe` string, an origin's reason). The last record is the summary: `counts: { fail, warn, list, accepted }`. Exit 1 means a finding is `fail`.

- `danger`: `critical` (code that runs with the app's authority unreviewed, or the review's own inputs), `high` (user data, secrets, a request's trust boundary), `medium` (what a check or test proves), `low` (a contained opt-in).
- `novelty`: `new` in this range, `changed` (same code and file, different text or reason), `standing` (unchanged), `accepted` (standing and listed in `keel-review.json` at the base).
- `loud`: `fail`, `warn`, `list` or `count`. An opt-in prints one step quieter than a workaround of the same danger.

Range codes (R1060, R1061, R1100, R1103 to R1105, R1107, R1108) describe the change itself, so they are always `new`.

## For each `fail` and `warn`

Read the code at `path:line` and the diff around it. Then answer four questions, one line each.

1. Is there a Keel seam for this? The table below names it.
2. Does the reason name the guarantee given up and why this use is safe? A reason that restates the code ("needed for the build") does not.
3. Was a test, assertion, fixture or configuration changed to make something pass? Read R1059, R1060, R1061, R1103 and R1108 with the code they sit beside.
4. Is this the Keel way: every effect through `ctx`, every failure a `Result`, every escape named?

| code | what it is | the seam or the fix |
|-|-|-|
| R1001 | `unsafe(reason, fn)` | keep it narrow: one call, one reason a person can check |
| R1010 | a declared origin | drop an origin no page loads from; `connect` and `frame` reach user data |
| R1011 | `createApp({ allow })`, `KEEL_ALLOW_ORIGINS` | list only origins the team runs (`keel docs k.hosting`) |
| R1012 | `reveal` | pass the `Secret` on and reveal at the sink (`keel docs k.reveal`) |
| R1013 | a `defect` where a `Result` is `err` | a failure a caller handles stays an `err`; a defect is a bug |
| R1014 | an identity `handle` | an auth library mounted there; no credential code of the app's own (`keel docs k.user`) |
| R1050, R1051 | a cast, `any`, `!`, a suppression or lint-off comment | a type guard, `unknown`, a check; fix what the lint reported |
| R1052 | a directive assembled from strings | delete it and fix what it was hiding |
| R1053 | a computed `import()`, `require`, `new Worker` | a literal import, or a map from a key to literal imports |
| R1055 | a Keel package's `src`, `dist` or `unsafe` files | the package's public entry (`keel docs k.security`) |
| R1056 | a global by a computed key, an indirect `eval` | the `ctx` capability: `ctx.net`, `ctx.clock`, `ctx.storage` (`keel docs k.ctx`) |
| R1057 | `process.env`, `fs`, `net`, `http`, `child_process` | `DeployEnv` and `ctx`; a `service` client for the network (`keel docs k.services`) |
| R1058 | a file under `unsafe/` with no `unsafe(` call | move it out, or wrap the one line that needs it in `unsafe(reason, () => ...)`; the file's other lines are checked as app code |
| R1059, R1060 | a skipped or focused test, fewer assertions | restore the test; change the code under test instead |
| R1061 | a conformance file changed | the conformance suite changes in its own reviewed change |
| R1100 | framework source changed with the app | land the framework change on its own |
| R1101, R1102 | an override, a patch, a non-registry source, an install script | a published version from the registry; no install script |
| R1103, R1104, R1105 | configuration, CI, the baseline | change each in its own reviewed change |
| R1107 | an edited generated file | edit the source and regenerate |
| R1108 | fewer `.pii(`, `s.secret(` or `guard(` calls | keep the mark or the guard (`keel docs k.privacy`) |
| R1150 | a file the review cannot parse | correct the syntax; nothing in the file was read |
| R1151 | a baseline entry with no finding | a person removes it |
| R2451 | a transaction's `allow` (std.postgres) | drop it to keep `serializable`; does the reason say why the anomaly is harmless here? |

## Write the report

One line per finding, then the totals:

```
R1053 modules/charts/load.ts:12:9 replace with: import('./Bar.ts') and import('./Line.ts') in a map by kind
R1001 modules/charts/unsafe/canvas.ts:4:3 keep: the chart library writes its canvas; the input is a parsed Series
R1057 modules/accounts/token.server.ts:8:15 needs a person: the provider's key is read from process.env, not DeployEnv
accepted 3, count only; limits: values passed in from another file, dependency code, runtime data
```

Each line is `replace with: <seam>`, `keep: <why>`, or `needs a person: <question>`. End with the `accepted` count and the limits: review does not see a capability reached through a value from another file or a parameter, an escape inside a dependency's published code, behavior that depends on runtime data, or a test asserting the wrong thing at full strength.

## Never

- approve a range or say it is safe to merge;
- run `keel review --accept` or edit `keel-review.json`;
- edit review, check, lint, type, test or CI configuration;
- reshape code so a finding disappears without removing the escape: moving it into `unsafe/`, into another file, behind a helper, or into a string built from parts;
- delete or weaken a test to clear a finding.

On your own work, fix a finding by replacing the escape with its seam, then run the review again.
