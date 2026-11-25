# The steal list, checked against the live sites

Read on 2026-11-25. This verifies the steal list in `tasks/p1/PLAN.md` (W11 step 1) and gives each item a decision and a home (W11 step 2). Feeds W8 step 1 (information architecture), W6, W7, W9 and W10.

How it was read. Every page was fetched live through a web fetch tool that returns the page text through a small summarizing model, so link counts ("about 300 links") are approximate and layout (columns, buttons, colors) is only known where the text shows it. Quotes are short and appear on the page. Where a page would not open or the text did not show the thing, the cell says so. A claim about another project carries its URL, and each one that could go on Keel's site is dated so it can be read again at launch.

Homes: W6 human docs, W7 walkthrough, W8 site, W9 pitch and comparisons, W10 visuals, P2 outsider process.

## Tally

- 22 items on the list: 9 true as written, 9 true with a correction, 2 dropped in whole or part (10, 20), 2 not verifiable from the text (15, 17).
- 14 items added from what the sites showed (A1 to A14).

## 1. The items

| # | Item | Source | Still true? | What Keel takes | Where Keel can do better | Home |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Rust error index | https://doc.rust-lang.org/error_codes/E0308.html | Corrected. The page has three "Erroneous code examples" and a one-line opening ("Expected type did not match the received type."). It has no corrected example and does not mention `rustc --explain`. | One page per code: wrong example, the checker's own fix as a diff, links to the spec clause. | The fix is the diff `keel check` prints, and the page is generated from the same table, so page and tool cannot disagree. | W6 step 4, W8 |
| 2 | Rust doc-tests | https://doc.rust-lang.org/rustdoc/write-documentation/documentation-tests.html | True. Blocks compile and run; `#` hides setup lines; `should_panic` and `compile_fail` assert the failing cases. | Every block compiles in CI. A block tagged as wrong must fail with the code the page names. Hidden setup lines so samples stay short. | Keel can assert the exact diagnostic code, since codes are a closed set. | W6 step 6 |
| 3 | docs.rs and per-version docs | https://docs.rs/about, https://pkg.go.dev/net/http | Corrected. The docs.rs about page says it hosts docs for crates published to crates.io but does not describe versions or source links. pkg.go.dev shows a version selector, source links beside symbols, a "Details" panel and an imported-by count. | Docs per package version from the source the package ships; source link at the release tag. | Each reference page also shows the export's ledger rung (see 12). | W8 step 5 |
| 4 | Rust Book and "Why Rust" | https://www.rust-lang.org/, https://doc.rust-lang.org/book/ | Corrected. The home page has the title, a one-sentence subheading and three pillars (Performance, Reliability, Productivity). The Book opens by naming the toolchain it assumes: Rust 1.98.0 and edition 2024. | Why page on three claims, each linked to its evidence. Walkthrough opens by naming the Keel version it was built for. | Rust's pillars carry no links to evidence on the page read; Keel's three claims each link to a ledger row. | W8, W7 |
| 5 | react.dev reference pages | https://react.dev/reference/react/useState | True. Sections are Reference, Usage, Troubleshooting. Troubleshooting headings are the reader's symptom ("I've updated the state, but the screen doesn't update"). 14 live sandboxes on the page. | One fixed layout per export. Troubleshooting titled by the symptom, which for Keel is the diagnostic code and its message. | Layout generated from the schema, so no export is missing a section. | W6 step 4 |
| 6 | react.dev pitfalls and deep dives | https://react.dev/reference/react/useState | True, and sparse: one Pitfall box and one DeepDive on the page read. | Pitfall asides in the walkthrough, one per diagnostic the step is likely to cause. | The aside quotes the real diagnostic from a run of the chapter, so it cannot drift. | W7 step 3 |
| 7 | Svelte tutorial | https://svelte.dev/tutorial/svelte/welcome-to-svelte | True. Four parts (Basic Svelte, Advanced Svelte, Basic SvelteKit, Advanced SvelteKit), lesson and editor panes, previous and next links, a `solve` button at top right; the page advises using it sparingly. | Chapter text, the layer's diff and a check command in one place. The diff plays the role of `solve`. | The check command prints pass or the failing clause; solve only shows an answer. | W7 step 3 |
| 8 | `llms.txt` | https://nextjs.org/llms.txt, https://nextjs.org/docs/llms.txt, https://svelte.dev/llms.txt, https://nuxt.com/llms.txt, https://docs.solidjs.com/llms.txt, https://react.dev/llms.txt | Corrected, and larger than listed. Svelte: 7 links, three sizes (medium, small, full) plus per-package files. Next.js: root index with a "When to use nextjs.org" section, docs index of about 300 links each with a one-line description, `llms-full.txt`, markdown at every `.md` URL or `Accept: text/markdown`. Nuxt: about 415 links, "When to use this", MCP, REST API. Solid docs: about 290 links, `llms-full.txt`, `llms-small.txt` with one line per export. React: 181 links. React Router: `/llms.txt` returned 404. Angular: file URLs not confirmed (see section 3). | An index with a description on every line, three sizes, a "when to use this site" paragraph, per-page `.md`, all from the source the packages ship. | Keel's index can state the Keel version it matches and link each clause to its conformance file. | W5, W8 step 3 |
| 9 | Tokio tutorial, Super Rentals | https://tokio.rs/tokio/tutorial, https://guides.emberjs.com/release/tutorial/part-1/ | Corrected. Tokio: 11 chapters (Overview to Streams); the page read does not say mini-redis, so that detail is unverified. Super Rentals: part 1 has 10 chapters, links a finished app and a `super-rentals-tutorial-output` branch described as "a complete working example"; no per-chapter checkpoint on the page. | One app grown by chapter, finished app linked from chapter one. | A tagged commit range per chapter, so any chapter can be checked out and its tests run. | W7 steps 2 and 3 |
| 10 | Next.js Learn | https://nextjs.org/learn | Partly dropped. Courses exist (App Router, React Foundations, Pages Router, SEO); the App Router course builds a dashboard with a live preview. The page read says nothing about progress tracking or a check at the end of a chapter, and its chapter count disagrees with its sidebar (15 stated, entries 00 to 16). | The finished, deployed app shown first. Drop the progress list. | Keel's per-chapter check command is the progress signal and needs no account. | W7 |
| 11 | Django docs | https://docs.djangoproject.com/en/stable/ | True. Four kinds with a sentence each: Tutorials ("take you by the hand"), Topic guides, Reference guides, How-to guides ("recipes"). Version menu shows 6.1, dev, and releases back to 1.8. The page does not name Diátaxis. | The same four kinds, each with its one-sentence promise on the docs home. | Each kind is a directory in the repo, checked by `docs-check`, so a page cannot be in two kinds. | W6 step 5 |
| 12 | Go Tour and pkg.go.dev | https://go.dev/tour/, https://pkg.go.dev/net/http | Corrected. The tour page did not render its lesson list to the fetch tool (unverified). pkg.go.dev verified: version selector, source links, runnable examples, a Details panel (valid go.mod, redistributable license, tagged version, stable version). | Reference per export with the source at the release tag, and a Details panel of facts. | The panel shows the export's ledger rungs and mutation score, each linking to its job. | W6 step 4, W8 step 4 |
| 13 | TypeScript playground | https://www.typescriptlang.org/play/ | True. Share menu, version selector, example sets, export to StackBlitz and others; the page announces a new playground for TypeScript 7 and multi-file projects. The output tabs did not show in the text. | Nothing in P1 (decision O8). | Keep in FUTURE. | FUTURE |
| 14 | Vite "Why Vite" | https://vite.dev/guide/why.html | Corrected. Order is true: "The problem", then "The answer". It uses adjectives ("painfully slow dev server startups", "sluggish hot updates"). It then gives history (Origins, Growing with the Ecosystem, A Unified Toolchain, Where Vite is Heading) and closes with "Vite's goal is not to be the final tool". | Problem first, answer second, a direction section at the end. | Numbers where Vite has adjectives: the problem stated as a count of faults an agent hits, with a source. | W8, W9 |
| 15 | Elm home and compiler messages | https://elm-lang.org/ | Not verified. The home page returned no text to the fetch tool. A web search returned mirrored snippets of its home page ("No Runtime Exceptions", "famously helpful error messages") and the post https://elm-lang.org/blog/compilers-as-assistants; I did not read either page. | Home page opens on a real diagnostic with its fix diff. This is Keel's design choice and needs no claim about Elm. | A secondary source (elm-discuss) reports the "no runtime exceptions" claim carries "in practice"; Keel states its residuals beside each claim. | W8 home, W10 |
| 16 | htmx essays | https://htmx.org/essays/ | True. About 60 entries in eight themed groups with dates only on the five newest. One group, "On The Other Hand…", holds critiques of htmx. | An Ideas section grouped by theme, with a group for the critiques of Keel. | Each essay ends with the ledger row it depends on. | W9 step 6 |
| 17 | Stripe API reference | https://docs.stripe.com/api/charges/create | Not verified as described. The text view shows sections Request, Response, Parameters (each with type and optional or required), Returns. Three columns and the copy button were not visible in text. Seen instead: nested parameters collapse and open with `?query=<name>`, a `stripe docs` terminal reader, an agent skills note, and a request sample that pins `Stripe-Version`. | Parameter list with type and required marked, a sample next to it, the version pinned in the sample. | The sample is one of the compiled blocks of item 2. | W6 step 4 |
| 18 | Tailwind docs | https://tailwindcss.com/docs/installation/using-vite, https://tailwindcss.com/docs/padding | Corrected. The header shows the search shortcut "⌘K Ctrl K" and the version "v4.3". The install page has 6 numbered steps and shows no rendered result. The padding page shows a rendered box beside markup for some examples and a "Quick reference" table of class to generated CSS. | Visible shortcut hint on the search box; a table of input to generated output on each reference page. | Output is the generated type and the generated route, read from the build. | W8 step 3 |
| 19 | Bun home page | https://bun.sh | True with a caveat. Charts for install, Express, Postgres and WebSocket link a method under `bench/` in the oven-sh/bun repo. Others show a "Benchmark →" link whose target the text did not show. The page says "All benchmarks are Bun's own and report medians of 3 runs", and names the hardware. | Each number links to the job or file that produced it, with run count and hardware, and says who ran it. | Numbers come from the ledger at build time, so the page cannot hold an unlinked number. | W9 step 2, W8 step 4 |
| 20 | Version switch (Astro, Laravel) | https://docs.astro.build/en/getting-started/, https://laravel.com/docs/master | Dropped for Astro: no version selector on the page read (a language selector and a list of upgrade guides). Laravel: the page read is `master` with a warning banner ("You're browsing the documentation for an upcoming version of Laravel"); a switcher did not show in the text. Verified elsewhere: Django (above), React Router (selector lists `latest` 8.5.3, `main`, 7.18.7, 6.30.6 and older), Next.js (`/docs/15/...`, `/docs/canary/...`), Nuxt (`/docs/<version>`). | A switch at the top of every page, and a banner on unreleased docs. Replace Astro and Laravel with the four verified models. | Docs for a version are the files the package of that version ships (item 3). | W8 step 5 |
| 21 | Playwright trace viewer | https://playwright.dev/docs/trace-viewer-intro | True. Actions timeline, hover for the page before and after, interactive DOM snapshots, log, source, network, errors, console per step. Recorded `on-first-retry` by default; opened with `npx playwright show-report`. | A replayed Keel session shown as an action list with state before and after each. | Keel's session is deterministic, so the view is a replay, not a recording of one run. | W10 step 3 |
| 22 | Rust RFCs | https://github.com/rust-lang/rfcs/blob/master/README.md | True. Copy `0000-template.md`; the PR number becomes the RFC number; a sub-team proposes a final comment period of "ten calendar days, so that it is open for at least 5 business days", advertised in This Week in Rust; the sub-team decides. | Template, a fixed comment window, a recorded disposition. | The window and the disposition are fields checked by the RFC tooling. | P2 |

### Added items

| # | Item | Source | What the page shows | What Keel takes | Where Keel can do better | Home |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | Next.js agent surface | https://nextjs.org/docs/app/guides/ai-agents, https://nextjs.org/evals | Version-matched docs at `node_modules/next/dist/docs/` from 16.2 on; a managed block in `AGENTS.md` written by `create-next-app` and `next dev`; an MCP endpoint at `/_next/mcp`; markdown for every docs page. The evals page states pass@4 ("an eval passes if any of four attempts passes"), a last run date of 2026-10-30, and two conditions, Base and With `AGENTS.md`. Five current entries at 100%. | Docs ship in the package and the agent file points at them. Eval page with method, date, both conditions, old rows kept and dated. | Report single-attempt rates beside any pass@k, since the page read gives no single-attempt figure. | W5, W9 step 2 |
| A2 | Next.js per-error pages | https://nextjs.org/docs/messages/blocking-prerender-dynamic | The terminal prints "Ways to fix this" with labeled options and a "Learn more" link. The page has a card per fix, patterns, a "Trade-off" and "Gotchas" for each fix, a "Verifying the fix" section and "Don't want this validation?". | Each diagnostic page with the trade-off of each fix and a way to verify. | Keel's fix is usually one diff; where two fixes exist, both are diffs with the rule each satisfies. | W6 step 4 |
| A3 | Solid diagnostics reference | https://docs.solidjs.com/llms.txt | A "Diagnostics" group of about 76 pages (count from the fetch summary), one per named condition, for example `SERVER_WRITE` ("A signal, store, or optimistic setter runs during a server render") and `ASYNC_WATERFALL`. | One-line condition under each index entry. | Numeric codes with a spec clause and a fixed example each. | W6 step 4 |
| A4 | Laravel "agent ready" claim and Boost | https://laravel.com/docs/master | A section titled "An Agent Ready Framework" argues conventions let an agent place files. A "Laravel and AI" section describes Boost: "over 15 specialized tools" and "over 17,000 pieces of vectorized Laravel ecosystem documentation". The page cites no measured result. | The claim and the evidence on the same page. | Agent evals per chapter with convergence counts (W7 step 4). | W9 |
| A5 | Svelte's four AI tools | https://svelte.dev/docs/ai/overview | Instructions, MCP server, Skills, Subagents, "designed to work together, but each can be used individually". The page says the goal is correct code and gives no measured results. | A short list of the agent aids with what each does. | Measured results next to the list. | W5, W9 |
| A6 | Angular's residual-risk list | https://angular.dev/best-practices/security | Threats named (XSS, CSRF, XSSI, SSRF, template injection), a table of sanitization by context, then a list of residual risks (trusting values, direct DOM access, nonces cached by a CDN, JIT compilation, wildcard hosts). Authentication is placed out of scope. | A residual list on the security page. | Each residual names the diagnostic or test that covers part of it. | W9 step 3 |
| A7 | Accessibility statements | https://angular.dev/best-practices/a11y, https://svelte.dev/docs/kit/accessibility, https://nextjs.org/docs/architecture/accessibility | Angular: CDK `LiveAnnouncer`, focus trap, no WCAG claim. SvelteKit: route announcements from the `<title>`, focus moved after navigation, `lang` set to English by default, compiler warnings, "you remain responsible". Next.js: route announcer reads `document.title`, then `<h1>`, then the path; `eslint-plugin-jsx-a11y`; page last updated 2024-11-06. | A page stating what the framework does and what stays with the author. | State the WCAG criteria that have evidence, per route, from the ledger's a11y items, and the number with none. | W9 step 2 |
| A8 | Security guides | https://nextjs.org/docs/app/guides/data-security, https://reactrouter.com/how-to/security | Next.js: three data-fetch approaches, `server-only`, taint (experimental), "treat Server Actions as reachable via direct POST requests", and an auditing checklist. React Router: one page on CSP nonces that opens "This is by no means a comprehensive guide". | An auditing checklist for a reviewer. | The checklist items map to diagnostics, so part of the audit is a command. | W9 step 3 |
| A9 | Steps to a running app | see section 2 | Three to four commands in every framework read. | See "first five minutes". | | W6, W8 |
| A10 | Tutorial shapes | https://reactrouter.com/tutorials/address-book | One command creates the project from a template ("a pretty bare-bones template but includes our css and data model"); 33 sections; "30-45m"; no finished-code link on the page. | Time estimate on each chapter. A start template that holds the data model so the chapter teaches one thing. | Each chapter's check command reports done. | W7 |
| A11 | Docs organization | https://reactrouter.com/start/framework/installation, https://docs.solidjs.com/llms.txt | React Router: Getting Started with modes, Upgrading, API Reference, Tutorials, How-Tos, Explanations, Community; pages carry a mode badge. Solid: Overview, Getting Started, Concepts, Building Apps, Routing, Guides, Migration, Glossary, Reference. | Four kinds (item 11) plus a badge for the context a page applies to (browser only, server, native). | | W6 step 5 |
| A12 | Comparison pages | web search only | No official comparison page from Next.js or Nuxt turned up; results were third-party articles. The home pages read for React Router, Svelte, Nuxt and Angular make no comparison with another framework. The search was not exhaustive. | Keel's comparisons are rare in this set, so tone and sourcing carry the weight (section 4). | Dated, versioned, each claim sourced, offered to the other project to correct. | W9 step 7 |
| A13 | "When to use this site" in an index | https://nextjs.org/llms.txt, https://nuxt.com/llms.txt | Both open with a section saying what the site is the source of, how to read it efficiently, and not to cite the `.md` URL. Next.js tells agents to read the docs for the version in `package.json`. | The same paragraph in Keel's index. | | W8 step 3 |
| A14 | Copy-as-markdown and the version stated up front | https://reactrouter.com/tutorials/address-book, https://nextjs.org/ | React Router pages carry "Copy Page as Markdown". The Next.js home markdown lists `latest_version: 16.4.6`. The Rust Book names its toolchain. | A copy button, and the version and date on every page. | The date of the last conformance run beside it. | W8 |

## 2. The six frameworks

Version from each project's own npm package, date from the registry `time` field (read with `npm view <pkg> time`), checked against the project's GitHub releases page the same day. On the Next.js releases page only canary builds were marked, so the stable number comes from https://nextjs.org (`latest_version: 16.4.6`).

| Framework | Current | Released | Release source |
| --- | --- | --- | --- |
| Next.js | 16.4.6 | 2026-11-09 | https://github.com/vercel/next.js/releases (canary 16.5.0-canary.62 on 23 Nov), https://www.npmjs.com/package/next |
| React Router | 8.5.3 | 2026-11-24 | https://github.com/remix-run/react-router/releases |
| SvelteKit | 3.4.0 | 2026-11-18 | https://github.com/sveltejs/kit/releases |
| Nuxt | 4.7.0 | 2026-11-23 | https://github.com/nuxt/nuxt/releases |
| SolidStart | 2.2.3 | 2026-11-16 | https://github.com/solidjs/solid-start/releases |
| Angular | 22.3.0 | 2026-11-18 | https://github.com/angular/angular/releases |

### Next.js 16.4.6

- Getting started: `pnpm create next-app my-app --yes`, `cd my-app`, `pnpm dev`, then open `http://localhost:3000`. Three commands. Node 20.9 minimum. The `--yes` default includes `AGENTS.md`. Source: https://nextjs.org/docs/app/getting-started/installation (page dated 2026-10-02).
- Tutorial: Learn Next.js builds a dashboard over chapters 00 to 16. https://nextjs.org/learn
- Docs: Getting Started (18), Guides (about 80), API Reference (about 195), Architecture, Community. Versioned copies at `/docs/15/...` and `/docs/canary/...`. https://nextjs.org/docs/llms.txt
- Better than anyone: the agent surface. Docs bundled in the package, a managed `AGENTS.md` block, an MCP endpoint, markdown on every page, and an evals page with method and a date. https://nextjs.org/docs/app/guides/ai-agents, https://nextjs.org/evals
- Honest limit: the evals use pass@4, and the accessibility page was last updated 2024-11-06 and makes no conformance claim.

### React Router 8.5.3

- Getting started: `npx create-react-router@latest my-react-router-app`, `cd`, `npm i`, `npm run dev`, then `http://localhost:5173`. Four commands. https://reactrouter.com/start/framework/installation
- Tutorial: Address Book, one command from a template, 33 sections, "30-45m". https://reactrouter.com/tutorials/address-book
- Docs: Getting Started by mode, Upgrading, API Reference, Tutorials, How-Tos, Explanations, Community; a version selector with `latest`, `main` and older majors.
- Better than anyone: a docs map that tells you which of three modes a page applies to and which kind of page it is. The installation page lists the whole tree on one screen.
- Agent docs: no mention of AI on the installation page; `/llms.txt` returned 404; a "Copy Page as Markdown" button exists.
- Security: one page, scoped to CSP nonces, with a disclaimer that it is not comprehensive. https://reactrouter.com/how-to/security

### SvelteKit 3.4.0

- Getting started: `npx sv create my-app`, `cd my-app`, `npm run dev`. Three commands. https://svelte.dev/docs/kit/creating-a-project
- Tutorial: four parts, in-browser, with a `solve` button. https://svelte.dev/tutorial/svelte/welcome-to-svelte
- Home page: "web development for the rest of us", a "get started" button, survey badges, no performance figures. https://svelte.dev
- Agent docs: `llms.txt` in three sizes plus per-package files; four named AI tools (instructions, MCP server, skills, subagents) with no measured results. https://svelte.dev/llms.txt, https://svelte.dev/docs/ai/overview
- Better than anyone: the tutorial. It sits in the browser with the lesson beside the code.

### Nuxt 4.7.0

- Getting started: `npm create nuxt@latest <project-name>`, `cd`, `npm run dev -- -o`. Three commands. Node 22 or newer; a StackBlitz option. https://nuxt.com/docs/4.x/getting-started/installation. The home page text shows `npx nuxi@latest init <project-name>`, so the two pages disagree.
- Home page: "The Full-Stack Vue Framework", a features list, and a closing "Resources for Agents" section. One number ("200+ modules"). No comparison. https://nuxt.com
- Docs: the rendering page states a limit: route rules "aren't a security boundary". https://nuxt.com/docs/4.x/guide/concepts/rendering
- Better than anyone: a published machine interface. Markdown for every docs, blog and deploy page, an MCP server, a REST API under `/api/v1` and `llms-full.txt`, listed from one index of about 415 links. https://nuxt.com/llms.txt
- Not found: a tutorial. The pages read give a sandbox and a concepts guide.

### SolidStart 2.2.3

- Getting started: `npm init solid@latest` in an empty directory, choose a shape (`basic`), pick a package manager, run the dev command the CLI prints, open `http://localhost:3000`. One command and a printed one. Node 20.19 or 22.12. https://docs.solidjs.com/getting-started/quick-start
- Home: "SolidStart: Fine-Grained Reactivity goes fullstack", with a notice that fullstack is built into Solid 2. https://start.solidjs.com/
- Better than anyone: a diagnostics reference of about 76 named conditions, each a page. https://docs.solidjs.com/llms.txt
- Agent docs: `llms-full.txt` and `llms-small.txt` per the index.

### Angular 22.3.0

- Getting started: `npm install -g @angular/cli`, `ng new my-first-angular-app`, `cd`, `npm start`, then `http://localhost:4200`. Four commands. Node 22.22.3 or newer. https://angular.dev/installation
- Tutorials: six, four of which run in the in-browser Playground; one is an AI Tutor over MCP. https://angular.dev/tutorials
- Home: "Productivity Meets scalability", "Trusted by millions" with no figure. https://angular.dev/
- Better than anyone: the security page names residual risks in a list (trusted values, direct DOM access, cached nonces, JIT, wildcard hosts) and places authentication out of scope. https://angular.dev/best-practices/security
- Agent docs: an "AI" section (CLI MCP server, agent skills, prompt rules). Search results describe `llms.txt` and `llms-full.txt` on https://angular.dev/ai/develop-with-ai; I did not confirm the file URLs, and a fetch of `/llms.txt` returned the home page text.

## 3. What I could not open or verify

- https://elm-lang.org/ home page (no text returned). Item 15 stands as Keel's design choice only.
- https://go.dev/tour/ and `/tour/list` (lesson list not in the text).
- Stripe's three-column layout and copy button (text view only).
- docs.rs per-version URLs and source links (the about page does not describe them). pkg.go.dev covers the idea.
- Whether Laravel has a version switcher (the master page read shows a banner, no switcher in text).
- Angular `llms.txt` file URLs.
- The Tokio tutorial's mini-redis project (not named on the page read).
- Link counts and the "about 76 diagnostics" count: approximate, produced by the fetch summarizer.
- Vercel's blog post behind the "100% with bundled docs, up to 79% with Skills" claim: I read the sentence on the ai-agents page, not the post.
- Next.js `/docs/messages` index page returned 404; per-error pages open.

## 4. Comparison claims on Keel's site

Rules for W9 step 7, from what the sources support.

- A claim names the version, the URL and the day read. Example form: "Next.js 16.4.6 (released 2026-11-09) bundles version-matched docs at `node_modules/next/dist/docs/`; https://nextjs.org/docs/app/guides/ai-agents, read 2026-11-25."
- State what the other project does, in its own words where short. Do not state what it lacks unless a page said so. "The installation page does not mention AI" is a statement about a page and carries its date.
- Claims supported today, each re-read at launch:
  - Next.js evals use pass@4 and were last run on 2026-10-30 (https://nextjs.org/evals).
  - Next.js recommends treating Server Actions as reachable by direct POST (https://nextjs.org/docs/app/guides/data-security).
  - Angular's security page lists residual risks and places authentication out of scope (https://angular.dev/best-practices/security).
  - SvelteKit moves focus after navigation and announces the page `<title>` (https://svelte.dev/docs/kit/accessibility).
  - Nuxt publishes markdown for every docs page, an MCP server and a REST API (https://nuxt.com/llms.txt).
  - Solid's docs index lists a diagnostics group of named conditions (https://docs.solidjs.com/llms.txt).
- No claim about SolidStart or React Router agent docs beyond "not found on the pages read".
- Keel's own claims in the same table carry a ledger row and a rung, per PRINCIPLES 11.

## 5. What the first five minutes should be

Drawn from the best of the six. Each point names its source. The commands are a proposal for the walkthrough's first chapter and the site's start page; none of it changes the framework.

1. Three commands or fewer to a running page: create, `cd`, run (Next.js, SvelteKit and Nuxt do it in three). The Node version sits above them (Next.js 20.9, Nuxt 22). One line states the Keel version and its date, as the Rust Book does for its toolchain.
2. The scaffold writes the agent file and the docs it points to into the project (Next.js `AGENTS.md`, bundled docs). The start page shows the file.
3. Minute two: the reader breaks the page on purpose. `keel check` prints a diagnostic with a code and a fix diff (Rust error pages, Elm). The page for that code opens from the code, with the wrong example and the fixed one.
4. Minute three: the reader applies the diff. The check turns green and one test runs. The check command is the progress signal (Super Rentals finished-app idea, tagged here as a chapter commit).
5. Minute four: the reader opens the evidence for what they just ran, a ledger row with its rung and its job (Bun's linked benchmark method, applied to every number).
6. Minute five: the same path for an agent. It reads the index with a "when to use this site" paragraph, fetches a page as markdown, and runs the check (Next.js and Nuxt indexes).
7. Chapter two starts from a tagged commit, and the page says how long it takes (React Router "30-45m").

Where each lands: steps 1 and 2 on the site's start page (W8) and in the scaffold output (W6); steps 3 to 5 as chapter one (W7) and a terminal recording (W10 step 2); step 6 in the agent docs (W5, W8 step 3).

subject: tasks/p1/PLAN.md
verified: 5132ef10
