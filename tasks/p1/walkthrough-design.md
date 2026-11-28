# The walkthrough app: design

W7 step 1 of `tasks/p1/PLAN.md`: the subject, the layers in a learner's order, the chapters and their evals, the build plan and the risks. `apps/household` was the first layered trial and stays an internal proving app; its findings (`tasks/p1/walkthrough-findings.md`) shaped what follows.

## 1. The subject

The app must be wanted on sight, small on day one, and need every layer by its end: two people at once, offline use, a job that resumes after a kill, a native shell, and data a privacy rule speaks to. Its day-one slice is W16's head-to-head spec, so it must be an afternoon's work in Next.js or SvelteKit.

| candidate | exercises | strains |
|-|-|-|
| Evenly: a group trip's shared costs | exact money splits, an invariant worth proving (balances sum to zero), currencies and locales abroad, two people adding costs at one table, offline on the road, a settle-up that waits days, a phone, payment handles as personal data | shares money with household's receipts book; std-money knows EUR, GBP, JPY and USD only |
| Door list: check-in for a volunteer event | two doors at once, offline at a venue, dietary and access needs as special-category data, a waitlist workflow, a tablet | day one is a checklist of names, close to the todo list we have; no honest place for money or locales |
| Field log: a birding group's sightings | offline in the field, `std-geo`, a phone, rare-species locations to hide | append-only, so conflicts are contrived; photos need uploads Keel forms do not take; a small audience |

I pick Evenly. Anyone who has travelled with friends has wanted it, and Splitwise and Tricount prove the shape. Day one (people, costs, uneven splits, balances, who pays whom, kept across a reload) runs in one browser with no server. Each later layer answers a question a real group asks: can my friend add the taxi from her phone, does it work in the mountains, what happens when we both edit the dinner, who still owes me at home. Shares that sum to the cost and balances that sum to zero make the best `prove` demo we have, and splitting 10.00 EUR three ways without losing a cent is a property test a reader feels.

Folders: `apps/evenly`, and from layer 6 the library `apps/evenly-charts` (`@evenly/charts`). Both match `pnpm-workspace.yaml` today.

## 2. The layers

No server through layer 6. The server arrives in layer 7 to share a trip; accounts arrive in layer 11, when settling up needs to know who confirms a payment. In each layer the reader writes one natural mistake, reads the check error and its fix diff, and applies it.

Check your work, every layer: `pnpm check && pnpm test && pnpm build` in `apps/evenly`, then `node tooling/smoke/evenly.mjs --to <layer>`, a smoke that grows one step group per layer.

| # | the app gains | packages and commands | error met | tests | smoke adds |
|-|-|-|-|-|-|
| 1 | a start page on brand | `keel scaffold project evenly --adapter client`, `keel scaffold route`, `keel dev`, `keel docs`, `keel explain` | E1752, a helper exported beside the page | route test, a11y report | `dist/web` served as plain files with `csp.txt` |
| 2 | one trip: people, equal splits, a Balances tab | store, reactive, ctx `clock` and `random`, std-headless `Tabs` and `Dialog`, std-brands | E1601, `Date.now()` and `crypto.randomUUID()` | `properties` per transaction, `explore`, `prove` that balances sum to zero | two costs, balances read |
| 3 | the cost form: amount, currency, payer, uneven shares | forms, std-money, std-text | E1453, a dropped `parseMoney` result | property: the cent-exact split sums to the cost; refused-amount test; `focusOrder` | refused and accepted cost, scripts on and off |
| 4 | many trips at `/trips/:trip`, kept across a reload, static hosting | contract params and `href`; ctx `register` of a browser capability over a small IndexedDB library | E1501, a link from a template string | route tests on the sim side | reload keeps the trip |
| 5 | yen costs with euro totals from a public rates API; English, German, Japanese | `service({ base })`, `origins.connect`, std-i18n, std-messages, std-temporal | E1571, the rates origin undeclared | `ctx.net` routes; `simulate` over drops and 503s with a stale-rate notice; three locales | locale switch; rates stand-in down |
| 6 | a balances chart and a sortable, filterable cost table | `keel scaffold library @evenly/charts`, `keel pack`, ui `Host`, std-tables | E1161, a library element id not built on `id` | the library's `keel test`; host element and its data-table alternative under a11y checks | chart and table at 390px |
| 7 | a trip shared by link, on a server; a kill loses nothing | `keel codemod place trips --to api --adapter node`, loaders, actions, API routes, `servedBy`, `service({ contract })`, std-postgres, std-db, std-health | E1572, `storage: 'postgres'` without `@keel/std-db` | handler tests on PGlite; a migration test | SIGKILL, restart, trip byte-equal |
| 8 | invites that expire; payment handles kept private | std-tokens, `s.secret`, `reveal`, `.pii`, a redirecting guard | E1112, the revealed token logged | `pii` canary; expiry on the sim clock | join by link; expired link refused |
| 9 | two people see each other's costs live; a stale edit is a conflict | std-channels (`t.changed`, `follows`), std-live, std-conflicts | E1301, `hydrate` missing from `uses` | two-user `renderRoute` with `app`; `simulate` of two writers; `findRaces` | two contexts, one edit refused |
| 10 | costs added offline, sent on reconnect; keep mine or keep theirs | std-offline `outbox`, `send`, `drain`, `resolve` | E2651, the invite token in a queued body | `simulate` offline windows against a live push on one cost; `explore` of drain orders | offline add, reconnect, conflict settled |
| 11 | accounts to settle up; trips joined by link carry over | `identity.ts`, `identity.server.ts` with an outside auth library, guard `next` and `pageHref`, `writeFor` | E1589, `identity.ts` with an unserved `client` | sign-in in a node test file; a queued cost through sign-out under `simulate`; open-redirect refusal | sign up, in, out with a cost queued |
| 12 | settle up: fewest transfers, each waiting to be marked paid, reminders in the trip's time zone; nightly rates | std-workflows, std-statecharts, std-jobs, std-schedules, `commitStores` | E2551, a misspelled `zone` | chart test; a kill at each step under `simulate`; schedule catch-up | Settle up, SIGKILL mid-run, each transfer once |
| 13 | a member sees what a session recorded; a bug replayed into a test; signed evidence | std-sessions (`keel session replay`, `minimize`, `to-test`), std-report `keel report`, std-timings, `keel evidence --verify`, `keel review` | E1062, one byte of the bundle changed | the test made from a session; masked `.pii` in the recording; a11y on every page route | evidence verifies, tampered copy fails |
| 14 | desktop and phone; an invite link opens the app; "where was this?" fills a place | `keel build --target`, std-tauri, std-capacitor, std-geo, k.links | E1574, a shell build with no `KEEL_ORIGIN` | `renderRoute` with `shell`; geo on the sim side | Tauri launch on Linux in CI; iOS, Android by hand |

Each package's layer: scaffold, cli, check, compiler, router, runtime-dom, ui, schema, testing (1); store, reactive, ctx, std-headless, std-brands (2); forms, std-money, std-text (3); services, std-i18n, std-messages, std-temporal (5); std-tables (6); server, std-postgres, std-db, std-health (7); std-tokens (8); std-channels, std-live, std-conflicts (9); std-offline (10); std-jobs, std-schedules, std-workflows, std-statecharts (12); std-sessions, std-report, std-timings (13); std-tauri, std-capacitor, std-geo (14).

What no layer reaches, and where it is proven:
- Server-rendered pages, resume and claim: Evenly's `web` stays a `client`; household and golden-2 under `tooling/smoke/resume.mjs`.
- The `static` adapter's per-route documents: the W8 site, built in Keel.
- Peers and compose: `examples/compose-peers`. OpenAPI import: `examples/openapi-import`.
- `keel codemod rename` and `move`: package tests.
- The std-sessions GitHub Action: `apps/sessions`. Driving the Android UI: no runner; CI builds golden-1's APK.
- k.bundle workers, k.compat, k.parity, k.mount-scope edges, k.privacy-reads, MCP and LSP edges: conformance only (`tasks/p1/feature-coverage.md` section 5).

## 3. The chapters

| # | title | the one idea | diff, hand-written |
|-|-|-|-|
| 1 | A page with no server | the checker is the teacher | ~80 lines, 4 files |
| 2 | A trip in a store | state changes only by named transactions, under checked invariants | ~250, 10 |
| 3 | The cost form | the schema is the form's validation | ~250, 8 |
| 4 | Many trips, kept | your data lives behind a seam you own | ~300, 10 |
| 5 | Abroad | another organisation's API is declared, simulated and allowed to fail | ~350, 14 |
| 6 | A chart of your own | a component outside the building blocks is a library under the same checks | ~350, 12 |
| 7 | Share a trip | moving a module to a server is one command, and a kill loses nothing | ~400, 15 |
| 8 | Links that expire | secrets and personal data are marked in the schema and followed | ~300, 12 |
| 9 | Two people at once | a live view follows commits; a stale edit is a conflict, never a lost write | ~300, 10 |
| 10 | On a train | offline writes queue and come back as conflicts you settle | ~250, 8 |
| 11 | Accounts | Keel signs no one in; an auth library plugs into one seam | ~350, 10 |
| 12 | Settle up | background work is a chart that resumes where it was killed | ~400, 12 |
| 13 | What happened | a session is a reproducible bug report, and the app's claims are signed | ~200, 8 |
| 14 | On your phone | one topology builds the server, the desktop and the phone | ~150, 6, plus generated shell folders |

The reader types what the layer table's commands column names and sees its "the app gains" column, meeting its error on the way. Each chapter's eval (`evals/tasks/evenly-NN/`) asks: starting from chapter N-1's tree and chapter N's text alone, reach a tree where `pnpm check`, `pnpm test`, `pnpm build` and layer N's hidden acceptance tests pass.

Fair and repeatable means:
- The start tree is the export of tag N-1 (section 4) with packages from W5's `public-docs` local registry. No git history, no later tag, no repository: the agent has the chapter, the installed skills, `keel docs` and `keel explain`, as a public reader's agent does.
- Acceptance tests touch only what the chapter names (routes, element ids, transaction names, visible text), so a correct tree with other file names passes. A script derives the chapter's name list from the tests, so the two cannot disagree.
- Sim ctx, fixed seeds, and stand-ins for the rates API, the auth library's mail and the shells: no run reads the network or the clock.
- A script judges, never a model. Three runs per chapter, one model, one token budget; we record converged count, iterations and tokens. Fewer than two of three is a chapter defect, fixed before the next chapter's eval.
- A text change reruns its eval, and the set runs weekly in CI.

## 4. The build plan

One lane, `lane-p1-walk`, built in order. Each layer is a commit range ending in an annotated tag `evenly/NN-<slug>` (`evenly/01-page` to `evenly/14-shell`) where that layer's check-your-work line passes. Layer N's chapter text is written beside the build of N+1. `apps/evenly/README.md` lists each layer's one-minute moment.

The public repository starts from one commit (O7), so tags do not survive launch. `tooling/walkthrough-export.mjs` turns the tags into a history of one commit per layer, both folders at the root and `workspace:*` set to the release version. The evals start from that export, so they test what a reader clones; at launch it becomes the walkthrough's own repository.

Tiers: haiku for layer 1 (mechanical); sonnet for 2, 3, 5, 7, 8, 12, 13 and 14 (golden-1, golden-2 and household hold the patterns), for chapter text and for eval runs; opus for 4 (a browser capability no app has built, which 7 must move), 6 (the library format and host element meet an app first here) and 9 to 11 (live, conflicts, offline and identity interact, and the fault schedules need design).

Built first, to de-risk:
- Spike A, before layer 4: in a scratch client app, an IndexedDB capability registered in app code, its sim side under `keel test`, its real side kept across a reload in Chromium, then `keel codemod place` of the module to a `node` deployable with std-postgres behind the same accessor type. Watch whether E1601 or R1056 refuse the library's calls. No app does this today.
- Spike B, beside layer 1: a signed-in page's session through `keel session replay`, `minimize` and `to-test`, against the three limits in `tasks/p1/feature-coverage.md` section 1. Each limit that holds becomes an RFC now; layer 13 needs them gone.

Each builder reports into `tasks/p1/evenly-findings.md` in household's form (fault, docs or rough; what was tried, command and output, what was expected, which skill or section misled), and per layer: every place a skill or `keel docs` section was wrong, silent or misleading; whether the planted error's message and fix diff sufficed alone; each rule learned from a failure instead of the docs; tokens and iterations to green. A kernel or std fault stops the layer with a reproduction and an RFC or backlog line; no workaround lands in the app.

Needs from other workstreams:
- Layers 1 to 3 start now: the scaffold, the skills in `packages/cli/skills/` and the spec are on the main line.
- Layer 4 waits on spike A; layer 13 on spike B's fixes.
- Layer 6 needs RFC 0163 slices 1 to 3 (on the main line) and should follow slice 4, which moves the stdlib onto the format and changes an app's dependencies; built before it, layers 1 to 6 take one dependency pass after.
- The chapter evals need W5 steps 2 and 3 (`keel docs` over the installed packages, the scaffold's `AGENTS.md`) and the `public-docs` registry mode. Layers can be built first.
- Published chapter text (W6 step 5) waits for the freeze flip, so the sections it cites stay put.

W16 builds layers 1 to 4 in each framework as the day-one app, layer 5 as the first maintenance task, and layers 9 and 10 as the second, where an incumbent stack needs a sync library, a queue and its own conflict rule.

## 5. What could go wrong

1. The browser-first data path does not hold. No app keeps data in a browser capability today, and layer 7 moves it behind a server with the same accessor type. If spike A meets E1601 on the IndexedDB calls, a sim side that cannot match the real one, or a `place` that cannot carry a capability, the front-end-first promise breaks at its first real step. I would raise an RFC for a client data capability, never bend the chapter, and keep layers 1 to 3 moving while it is decided.
2. The late layers meet known gaps. Session-to-test behind sign-in (spike B), a shell sign-in round trip no in-process test drives (S3-1), about a hundred lines of auth glue per app (L6-5) and the style roughness S-1 to S-11 all land in layers 11 to 14, where a reader's patience is lowest. I would close them before their layer: spike B now, an example identity adapter shipped as a library beside layer 11, and the open S lines triaged into W2.
3. Chapters too large for their evals, or evals that measure the wrong thing. Fourteen chapters at three runs is 42 runs per release, and a 400-line chapter may not converge from text alone. I would split any layer past about 400 hand-written lines, keep the name list generated from the tests, and treat a chapter that does not converge as a text defect first and a Keel defect second, filing both in the findings.
