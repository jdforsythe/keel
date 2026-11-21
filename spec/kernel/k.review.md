# k.review: Review of escapes
status: proposed

**Purpose.** `keel review` lists each escape in a project: a place where code opts out of a protection by its sanctioned name (an opt-in) or goes around one (a workaround), ranked by what it reaches and whether it is new. `keel check` decides correctness per file; review reads a git range or a tree, makes no network request and runs no project code.

**Command.** `keel review [paths] [<base>..<head> | --all] [--list] [--fail-on warn]`; `keel review --accept <id> --reason <text>`. Scope: each folder holding `topology.ts` under `paths` (default the working directory's project), and the git root's `package.json` files, lockfile, `.github/`, `.githooks/` and `patches/`. Every tracked file in scope is read, `unsafe/`, tests, `.d.ts` and `*.config.*` included. A range reads both revisions from git objects, never the working tree; `--all`, the default, reads the working tree. Two runs on one tree and range print the same bytes.

**Findings.** A `review` record `{ kind, code, path, line, col, message, protection, opt, danger, novelty, loud, id, reason? }`: `code` an R code of k.escapes, the position at `<head>`, `protection` the spec id opted out of or gone around, `opt` true for an opt-in, `reason` the escape's own text (an `unsafe` string, an origin's reason) when it has one. `id` is the first 12 hex characters of the SHA-256 of `code`, `path` (renames followed) and the escape's source text with each whitespace run as one space, plus `#<n>` when that text occurs `n` times before it in the file. Compact: `R1053 modules/a/x.ts:4:9 critical new module specifier computed at run time`. Not reported: an escape `keel check` reports as an error at the same place.

**Danger.** critical: code that runs with the app's authority without passing review, or the review's own inputs. high: user data, secrets, a request's trust boundary. medium: what a check or test proves. low: a contained opt-in. A code's level is its row's in k.escapes.

**Novelty.** In a range: `new`, at `<head>` only; `changed`, when `<base>` has a finding of that code and path with another `id` (each matched once, nearest line first); `standing`, the same `id` at both; `accepted`, standing with its `id` in the baseline at `<base>`. Under `--all`: `accepted` when in the working tree's baseline, else `standing`. Range codes (k.escapes) are read from the range's changes and are `new`.

**Loudness.** For new, changed, standing: critical `fail fail fail`, high `fail fail warn`, medium `warn warn list`, low `list list list`; accepted is `count`. An opt-in is one step quieter: `fail` is `warn`, `warn` is `list`. Compact prints `fail`, then `warn` findings, grouped and capped as OUTPUT.md says, and `list` ones with `--list`; json holds `fail`, `warn` and `list`, and `count` ones with `--list`. Trailer: `ok review 0 fail, 2 warn, 14 listed, 3 accepted`, or `fail review` with the same counts. Exit 1 when a finding is `fail`, or `warn` under `--fail-on warn`; else 0.

**Baseline.** `keel-review.json` beside `topology.ts`, or at the git root for a finding outside every project: `{ v: 1, accepted: [{ id, code, path, reason }] }`, `reason` 10 to 200 characters. `--accept` adds one entry for a finding in the working tree. An entry added in a range accepts nothing in it.

**CI.** The workflow k.deploy generates holds one `review` job on `pull_request`: checkout with full history, install, `keel review origin/<base_ref>..HEAD`.

**Limits.** Not seen: a capability reached through a value from another file or a parameter, an escape in a dependency's published code, behavior that depends on runtime data, a test asserting the wrong thing at full strength. The baseline cannot prove a person wrote an entry; reading it at `<base>` means a merged change did.

**Rules.** E1065 not a git repository, or a revision of the range does not resolve · E1066 `keel-review.json` does not parse, or holds an `id` twice · E1067 `--accept` without `--reason`, a reason out of range, or an `id` with no finding · E1068 a range with `--all`.

**Conformance.**
- A finding at `<head>` only is `new`; with only its line moved, `standing`; with its `unsafe` reason edited, `changed`.
- With its `id` in `keel-review.json` at `<base>` a finding is `accepted` and counted only; the same entry added only at `<head>` leaves it `new` and adds one R1105.
- Each cell of Loudness, and the opt-in step, holds on a fixture; the exit is 1 exactly when a finding is `fail`, and under `--fail-on warn` also when one is `warn`.
- Compact prints no `list` finding without `--list`; json holds every `fail`, `warn` and `list` finding, and `count` ones with `--list`; the trailer counts all four.
- Two runs on one fixture print byte-equal output, and a run with no network succeeds.
- `--accept <id> --reason <text>` writes one entry; without `--reason`, E1067 and nothing written; a range outside git, E1065.
- A review at a monorepo root and one of `apps/x` report the same findings for `apps/x`.
- The generated CI workflow holds a `review` job that runs `keel review` over the pull request's range.
