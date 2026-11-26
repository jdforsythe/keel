# Personas

The people and agents Keel is built for. A design decision, a review and a release check are each read against them: name the personas a change touches, then answer each one's question. A decision that fails a persona's question says so and says why it is still right.

Every persona comes in two forms. The human reads docs, skims errors and asks a colleague. The agent reads the shipped skills and `keel docs`, runs commands, and reads every diagnostic word for word. A flow passes only when both forms get through it; the agent form is the stricter test of whether the docs and diagnostics are complete, the human form of whether they are short.

## Framework authors

| Persona | Who | Needs | The question |
| --- | --- | --- | --- |
| F1 Kernel maintainer | Changes a kernel package | The spec, conformance and ledger to tell them what a change breaks | Can this be changed later without breaking an app or a library that passed `keel check`? |
| F2 Stdlib maintainer | Owns a `@keel/std-*` package | To be held to the same rules as any library, with no private door into the kernel | Could a third party have built this package with what is public? |

## App authors

| Persona | Who | Comes from | Needs | The question |
| --- | --- | --- | --- | --- |
| A1 Static site builder | One person, pages and forms, no server | Astro, plain React | To write a page and ship static files; no server concept in sight | Does an app with no server carry no server code, config or vocabulary? |
| A2 Product engineer | Small team, client and server, sign-in, a database | Next, Remix, Rails | First page in minutes, loaders and actions, a data seam, deploy to one box | How many commands and how many concepts from an empty folder to a deployed page? |
| A3 Enterprise team lead | Many modules, many developers, long life | Angular, .NET | Boundaries between modules, upgrades that do not break, rules that hold without review | Does this keep two teams from breaking each other, and does it survive an upgrade? |
| A4 Mobile and offline builder | A native shell, offline writes, sync | Ionic, React Native | The shells, the outbox, conflicts, device capabilities | Does the same app code run in the browser and in the shell, and is the difference stated? |
| A5 Designer | Owns the look: tokens, themes, layout, motion | Tailwind, Figma tokens, CSS | To change the look without touching logic, and to see contrast and a11y fail early | Can the look be changed in one place, and does a bad colour or a missing label fail at check? |
| A6 Compliance owner | Answers for pii, secrets, audit, a11y law | Security review, GRC | Evidence produced by the tool, not by a promise: what leaves the browser, who can read what | Can they get the answer from `keel evidence` without reading the code, and can it be wrong? |
| A7 Tester | Owns the tests and the release gate | Playwright, Cypress, Jest | Unit, page, property, simulation and end to end tests from one command; stable under load | Can they test this at every rung without building a harness, and does a red test name its cause? |
| A8 Operator | Deploys and runs it | Docker, a PaaS | One artifact, a short list of environment values, health, logs without pii | What do they have to know that the build did not tell them? |

## Library authors

| Persona | Who | Example | Needs | The question |
| --- | --- | --- | --- | --- |
| L1 Component library author | Ships UI components with a look | A small Ionic, a design system | Parts, tokens an app can re-theme, a11y checks, no `unsafe/` | Can they build a real component from the building blocks, with no rule off, and can an app restyle it? |
| L2 Visual library author | Draws to canvas or SVG | Charts | A text alternative, colour from tokens, size budgets | Does a drawn thing stay accessible and themable? |
| L3 Service library author | Wraps an outside service, client and server | Google Maps, Stripe, an auth platform | A capability to declare, a network seam, a secret that never reaches the client, a script from another origin under the content security policy | Can they ship it without the app trusting them blindly, and does the app see what it reaches? |
| L4 Data library author | Schemas, validation, formats, stores | A validation set, a Postgres battery | Schema registration, server stores, the data seam | Do their types and checks compose with the app's, at check time? |
| L5 Tooling library author | Check rules, codemods, test helpers | A lint pack, a fixture kit | The rule registry, `./tools`, the testing entries | What can their code do on the developer's machine, and who approved it? |
| L6 Plain npm package | Not written for Keel | `date-fns`, `zod`, a maps SDK, a React-only widget | To be installed and imported | What happens when an app adds it: does it work, is it fenced, and does the app know which guarantees stop at its edge? |

## What every persona is asked

1. First five minutes: can they start from the public packages alone, and how many commands is it?
2. Same rungs: are the tests, checks and evidence the framework uses on itself available to them, from the same command?
3. Same rules: is anything allowed to the framework or the stdlib that is refused to them, or the reverse?
4. Trust: what do they take on trust from code they did not write, and where is that stated?
5. The wall: where does their real work stop being possible without `unsafe/` or a switched-off rule?
6. Leaving and upgrading: what does an upgrade cost them, and what does a wrong step cost to undo?

## Where they are used

- An RFC names the personas it touches and answers their questions in its Alternatives or Proposal.
- A reviewer who tries to break a change does it as the persona the change exposes most.
- The end-user reviews in `tasks/p1/TODO.md` are run per persona, hands-on, from the packed kit.
- The agent evals (golden-3, head to head, the walkthrough chapters) are the agent form of A2; each further eval names its persona.
