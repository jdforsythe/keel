---
name: keel-podcast
description: Write a two-voice podcast episode script about Keel from its goals and its state on the day, or an updates episode on what changed since the last one; use when asked for a podcast, an audio explainer or an interview-style walkthrough of Keel.
---
# Keel podcast episode

This skill turns the project's goals and its current state into one spoken episode: a sceptical host and Keel's creator, talking for an hour or more. The episode is a transcript to be read aloud, so it is judged as speech and as a docs file. Run it again whenever the project moves; every fact is read on the day the episode is written.

## Inputs

| Input | Default |
| --- | --- |
| Angle or audience | A senior engineer deciding whether Keel is worth a weekend and then a team |
| Target length | 75 to 90 minutes, at about 150 spoken words a minute: 11,000 to 13,500 words |
| Output file | `docs/podcast/<slug>.md`, a slug that names the angle; list `docs/podcast/` first and never reuse a name |
| Main-line head | The commit the caller passes as the main line's head; the episode covers up to it and records it |

## Request kinds

- **An update.** A new script for the changes on the main line from the newest script's `covers-to` commit to the head the caller passes. Earlier scripts are kept. The rules are under Updates episode.
- **A full new podcast.** One script written from scratch from the sources, up to the head the caller passes. The old scripts under `docs/podcast/` are deleted in the same commit.

The caller passes the current main-line head commit with either kind. When none is passed, use `git rev-parse --short <main-line branch>` and say so in the report. Read every fact at that commit (`git show <head>:<path>`), not at a later one.

For a full new podcast, do not read earlier episodes under `docs/podcast/` before writing. Each episode is written from the sources, so it is not a rewrite of the last one; list the folder only to avoid a name collision.

## Updates episode

When asked for an updates episode, the scope is what changed on the main line from the newest script's `covers-to` commit to the head the caller passes, and what that script left out. These rules replace the matching ones in the rest of this skill; everything else holds.

- Read the newest script first, whole, and take its `covers-to` line: that commit is this episode's `covers-from`. `git log --oneline <covers-from>..<head>` is the range, and `git log -1 --format=%cI <covers-from>` its start date. Repeat nothing from it beyond a recap of two to four exchanges in the cold open. Where it stated a gap, a disagreement between two files or a promise, the update says what became of each.
- Sources: the active task's `PLAN.md` checkpoints and decisions dated after that script, read in order; `tasks/p1/TODO.md`, `tasks/p1/personas.md`, `tasks/p1/end-user-review.md` and `tasks/FUTURE.md`; and each RFC written since, read on the lane branch that holds it when it is not merged. The plan is the record of what happened; when `tasks/p1/TODO.md` lags it, the plan wins and the report says so.
- States: "merged" means on the main line. Work on a lane branch is "built in a lane, not merged", and its review state is said with it. An accepted RFC with nothing built is "designed". A reserved RFC number is "reserved, not written". Only merged work may be called built and proven.
- The coverage checklist becomes: what the last episode's open items became; the gate and CI; each idea or decision made since and what it became; each review that found holes, two to four told as stories with the reproduction and the fix; the end-user findings by state (merged, in a lane, open); a quick-fire round; the honest state sorted by the four states above, and what is left before public.
- Target length: 45 to 60 minutes, 6,750 to 9,000 words. Output file: `docs/podcast/keel-updates-<yyyy-mm-dd>.md`, the day it is written, with a letter suffix when that day already has one.
- The gap list is kept the same way.

## The cast

`HOST:` and `GUEST:` are the only speaker labels. Neither gets a personal name.

**HOST.** A senior architect with devops and full-stack depth. Has shipped with Angular, React, Vue, Ionic and Capacitor, Next, Express and Koa, Laravel and more, at enterprise scale and on personal projects. Drives the episode and chooses the depth: every main feature gets a question, the second-level features get some in depth and the rest in a quick-fire round. Pushes back. Asks "what happens when" (the network drops, two writes race, the agent ignores the rule, a library misbehaves). Asks what each thing costs: in bytes, in learning, in lock-in, in time at check. Compares with what the host has shipped, by name.

**GUEST.** Keel's creator. Answers from the goal and the planned end state at 1.0, and in every answer where it matters says which of three states the thing is in, in plain words:

- built and proven: in the tree, its spec section conformance-covered, its tests on a ledger rung;
- built but needs work: in the tree, with a gap a review, the triage or `tasks/p1/TODO.md` names;
- a goal not yet realised: decided or planned, not built.

The guest is direct and never sells. The guest volunteers weak spots before the host finds them, and names what the other framework does well before saying where Keel differs.

## Sources

Facts come from the current main line, never from a branch based on an older commit. Read them from the main worktree (read-only), in this order. Do not read `spec/` or `docs/rfc/` whole.

1. `README.md`, `docs/VISION.md`, `docs/PRINCIPLES.md`, `docs/GLOSSARY.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `docs/BRAND.md` and `docs/VOICE.md`, `docs/COMPLIANCE.md`, `docs/THREAT-MODEL.md`.
2. The spec map, then one section per feature the episode describes. Say it as "pnpm spec dash dash map", then "pnpm spec" and the topic: `pnpm spec --map`, then `pnpm spec <topic>` for reactivity, store, router, forms, schema, server, ctx and time, topology and deployables, modules and boundaries, the library format, contract, a11y, pii and secrets, testing and the ledger rungs, offline, conflicts, channels and live, workflows, schedules, the native shells, i18n, money and temporal, and the ui building blocks and tokens. Each section's `status:` line is the first evidence for its state.
3. The published skills under `.claude/skills/keel*`: how an app author and a library author work.
4. Current state, checked on the day: `docs/HANDOFF.md`; `tasks/p1/TODO.md` (done, running, next, blocked, human); `tasks/p1/PLAN.md` workstream headings only (`grep -n '^#' tasks/p1/PLAN.md`); `tasks/p1/end-user-review.md`; `tasks/p1/personas.md`; `tasks/p1/research.md` (the only source for facts and versions of other frameworks); `tasks/p1/app-trials.md`; `tasks/FUTURE.md`.
5. Counts from the ledger itself, not from prose that quotes it: `tooling/ledger/ledger.json` (`rungs`, `clauses`, `exports`, `a11y`, `unsafe`), and `git log -1 --format=%cd --date=short -- tooling/ledger/ledger.json` for its date. Count spec status lines with `grep -h -m1 '^status:' spec/kernel/*.md spec/std/*.md | sort | uniq -c`.
6. The worked apps and library for concrete examples told in words: `apps/household`, `apps/evenly`, `apps/golden-1`, `apps/golden-2`, `libraries/charts`.

Gathering is reading across many files: hand it to parallel read-only subagents, one fact sheet per group (kernel spec; stdlib and libraries; testing and compliance; research and personas; skills and apps), each told to label every fact with its state and its source file and to flag contradictions. The writer keeps the fact sheets, not the file dumps.

## Coverage checklist

Tick each line as the outline places it, and again when the draft holds it.

- [ ] Cold open and the pitch: what Keel is, who it is for, why another framework; code written mostly by agents and what that changes about framework design.
- [ ] The principles, and borrows versus builds: ideas and syntax taken from elsewhere, familiar syntax or concepts refused, with the reason for each refusal.
- [ ] The kernel tour, each feature set against what the host knows: reactivity (React hooks, Vue refs, Angular signals and zones, Solid); state and stores; routing; forms and schema; the server (loaders, actions, API routes, guards); ctx, time and randomness as injected capabilities; the client and server boundary; topology and deployables; modules and their boundaries; the no-back-end app as first class and identity as opt-in.
- [ ] The app builder's day: scaffold, the commands, `keel check` as the gate, diagnostics with fixes, one export per file, what an agent does and what a human does.
- [ ] The designer's day: tokens, looks, base styles, the building blocks, contrast and a11y failing at check, custom components.
- [ ] The standard library, part in depth and part quick-fire: data and Postgres, offline and the outbox, conflicts, channels and live, workflows, schedules and jobs, statecharts, sessions, i18n, money, temporal, tables, headless widgets, the native shells.
- [ ] Testing: example, property, exploration, simulation, proof; the ledger and its rungs; evidence; mutation; conformance from the spec; a11y checks; deterministic simulation with injected time and network; what is built in and what is not (end-to-end tests stated as a gap if `tasks/p1/TODO.md` still lists them as next).
- [ ] Library authors: the format, pack, capabilities and the app-side grant, what a library is held to, the state of a library's own look, the gaps the reviews found.
- [ ] Security and compliance: pii classes, secrets, what leaves the browser, the content security policy, evidence an auditor reads; what is claimed and what is not (Keel is a seam for auth libraries and platforms, not an auth library).
- [ ] Why an enterprise should care and why a solo builder should; the cost of adoption; upgrades and the freeze.
- [ ] Classes of bugs the design removes, each with its mechanism, and the classes it does not.
- [ ] Head to head: React and Next, Angular, Vue and Nuxt, Svelte and SvelteKit, Solid, Remix (React Router), Ionic and Capacitor, Laravel and Rails style full stacks; for each what it does well, where the creator thinks Keel does better, and where Keel is behind today.
- [ ] A quick-fire round of second-level features.
- [ ] The honest state today and the road to public: built, needs work, unrealised; what 1.0 means.

## The gap list

An episode is also a probe for gaps. While preparing each answer, keep a list of every question a senior architect would ask for which Keel has no good answer today. The kinds:

- a feature other frameworks have and Keel has no plan for;
- a goal with nothing built and no line in `tasks/p1/TODO.md` or `tasks/BACKLOG.md`;
- a comparison where Keel is honestly behind and no workstream closes it;
- a contradiction between two sources;
- a claim the docs make that nothing in the repo proves;
- a concept the guest could not explain in a few plain sentences, which means the design or the docs are unclear.

For each item record the question, what the sources say (with file names), and a suggested home: a `tasks/p1/TODO.md` workstream, a backlog line, `tasks/FUTURE.md`, or a decision for the operator. Rank the list by how much each would hurt in front of a sceptical audience. Search `tasks/FUTURE.md`, `tasks/p1/TODO.md` and `tasks/BACKLOG.md` (`grep -n -i <word>`) before calling something homeless.

The list goes back to whoever ran the skill, in the final report. It is not written into the episode file and not committed. The guest still answers each of these honestly in the script where the question comes up.

## Honesty rules

1. Every state claim carries one of the three states, and the state is what `tasks/p1/TODO.md`, `docs/HANDOFF.md` and the spec status line say on the day. When they disagree, the more recent and more specific source wins, and the disagreement goes in the report to the caller.
2. No invented numbers. A number is spoken only if a file in the repo holds it, and the speaker says where it comes from and its date ("the ledger, as of the twenty-fifth of November").
3. Facts about another framework come only from `tasks/p1/research.md` (with the version and the day it was read) or from uncontroversial common knowledge of that framework's design. No benchmark, statistic or version number from memory. Do not say another project lacks something unless research.md records a page that says so.
4. Comparisons are fair: name what the other framework does well first, frame Keel's advantage as the creator's view, and say where Keel is behind (ecosystem, maturity, not yet public).
5. Every blocker and major finding in `tasks/p1/end-user-review.md` that is still open is said out loud, by the guest if the host does not raise it.
6. A claim that cannot be traced to a source is cut, and listed in the report.

## Form

- Under the `#` title, before any other text, the script records the commits it covers as bare lines: `covers-to: <sha>` for every script, and `covers-from: <sha>` above it for an updates episode. These are the next update's starting point.
- Speaker turns start with `HOST:` or `GUEST:` at the start of a paragraph. No other labels, no stage directions.
- `##` headings for segments, each with rough minutes, for example "## 3. The kernel tour (minutes 14 to 38)". Segment minutes add up to the target.
- A cold open of two to four exchanges before the first heading's material settles in; a quick-fire round with short questions and one-to-three-sentence answers; a closing on what is next.
- Spoken style: short sentences, contractions, one idea per sentence. No code blocks and no code read aloud: describe code in words ("a store with a transaction named add item"). Spell commands as a person says them ("keel check", "pnpm spec dash dash map"); a code span may hold the written form beside it for a reader.
- Length planning: 150 words a minute. Measure with `wc -w` and adjust segments, not by padding.

## House rules for the file

- `docs/VOICE.md` and `docs/BRAND.md` voice: no banned words (the list in VOICE.md, every intensifier among them, in speech too), no em dashes, no hedging adverbs, no reversals of the form VOICE.md names, no stock phrases, the only nautical word is Keel.
- Docs describe what exists now. A transcript is exempt from the no-history rule only where a speaker talks about the past ("we tried that in the summer"); headings and any framing text follow it.
- No home-directory paths, no private names or email addresses, no quoted private messages, and no quotation attributed to the operator or user.
- The lints the repo runs over docs pass on both files. On the current main line: `node tooling/voice-lint.mjs` (V0003), `node tooling/hygiene.mjs` (H0001 home paths, H0002 quoted operator words, H0005 listed personal words), `node tooling/docs-freshness.mjs` (D0001), `node tooling/format-check.mjs` (F0001), `node tooling/docs-check.mjs` (published skills only), `node tooling/budgets.mjs`. On an older branch run the ones its `package.json` `check` script lists. If a lint caps a file or section size, satisfy it the way the lint allows (its budget configuration, a sanctioned split); never weaken the rule.
- Do not run tests, builds or the gate to write an episode.

## Self-check before commit

- [ ] Every coverage line ticked, each with the segment that holds it.
- [ ] Every state claim traced to a named source read today; every number traced to a file with its date.
- [ ] Every comparison names what the other framework does well, and every version comes from research.md.
- [ ] Every open blocker and major from the end-user reviews is spoken.
- [ ] `covers-to` (and for an update `covers-from`) under the title, equal to the commits the episode was read at.
- [ ] Word count within the target (`wc -w`), segment minutes add up.
- [ ] Each lint above passes; its last line is in the report.
- [ ] The gap list is ranked, each item with its question, sources and suggested home, and it is in the report, not in the episode.
- [ ] Report to the caller: file paths, word count and minutes, where each checklist line sits, claims cut for lack of a source, contradictions found between sources, and the gap list.
