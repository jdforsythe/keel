# Two Tabs Open: Keel, a framework whose first reader is an agent

**Episode description.** Nadia has written React for a living for eleven years and says so early. Tom has spent the last few months working in Keel, a full-stack TypeScript web framework that hasn't reached 0.1 yet and was designed on the premise that most of its code will be written by coding agents. They cover what Keel asks you to write and what it writes for you, why its checker hands back a diff instead of an explanation, what the ledger is and why it says "example" more often than anything else, the two things Keel refuses to do for you, and a fairly long list of what isn't finished.

Speakers: **NADIA** (host), **TOM** (guest).

---

## Cold open

**NADIA:** I want to start with a confession, so you know where I'm coming from. I've written React for eleven years. I have opinions about `useEffect` that I won't share on air. And when somebody sent me Keel's README, the first line says it's a framework whose primary author is a coding agent. And I thought, okay, that's a pitch deck sentence.

**TOM:** Yeah. Fair.

**NADIA:** So convince me it isn't.

**TOM:** I'm not sure I can in one go. But I can tell you what the sentence means in practice, because it's a design constraint more than a pitch. The idea is that an agent reads code through a narrow window. It doesn't remember your codebase between sessions. It doesn't learn the house style over six months. What it does well is run a command, read the error, and try again. So the question Keel asks is, what does a framework look like if you design it around that loop instead of around a person typing in an editor?

**NADIA:** And the answer is?

**TOM:** A lot of rules. Most of them enforced by a checker that tells you exactly how to fix the thing it complained about.

**NADIA:** Okay. We'll get there. Let's do the boring part first.

## What it is, and who it's for

**NADIA:** What is it? Literally. If I `pnpm install` it, what do I get?

**TOM:** Well, first thing, you can't really `pnpm install` it the way you'd install a published framework. It's pre-0.1. The README says nothing is stable, and it means it. What exists is a monorepo with forty-one packages under `packages/`. Fifteen of those are the kernel: schema, reactive, store, the DOM runtime, the compiler, router, forms, ui, check, scaffold, testing, a thin server, thin services, the CLI and `ctx`. The other twenty-six are what they call the stdlib, everything named `std-` something. Money, dates, i18n, tables, headless widgets, Postgres, sessions, offline, that kind of thing.

**NADIA:** Forty-one packages for a thing that isn't at 0.1.

**TOM:** I know how it sounds.

**NADIA:** Who's it for? Because if the author is an agent, is the audience also an agent? Do I, a person, show up anywhere?

**TOM:** You show up as the person who decides what the app should do and reads what comes out. The agent writes the code. You read the diff, you read the review output, you decide. But it depends on what you mean by for. The thing it's optimized for is an agent converging on a green build with as few tokens and as few iterations as possible. That's measured, by the way. There's an `evals/` folder of agent tasks with pass criteria, and the metrics are things like iterations to green and tokens to green.

**NADIA:** So the customer is a model.

**TOM:** The reader is a model. The customer is whoever's paying for the model's tokens. Which is a person.

**NADIA:** Okay, I'll take that. Main goals, then. If you had to pick.

**TOM:** Predictability first. Then token cost, because every token an agent spends reading docs or reading noisy output is money and context window. And then verifiability, meaning the framework can tell you what's been proven about your app versus what has merely been run once. They put that above writing ergonomics. On purpose. It says so in the vision doc.

**NADIA:** Above ergonomics.

**TOM:** Yep.

**NADIA:** That's going to come back.

**TOM:** It will.

## The four things you write

**NADIA:** Walk me through an app. What do I actually write?

**TOM:** The vision doc says you write four things. Schemas for what the data is. Transactions for what can happen to it. Components for how it looks. And a contract for each module's routes. Everything else is supposed to be a declaration or something derived from those.

**NADIA:** Give me a real one.

**TOM:** The best example in the repo is an app called household. It's a shared shopping list and receipts book for one home, and it was built one layer at a time, so the README reads like a walkthrough. Layer one is `keel scaffold project household --workspace --adapter node`, which gives you one deployable called `web` that renders pages on the server, a `tokens.ts` with the brand styles, and an empty `app` module. Then `keel scaffold route app.start --path /` gives you a start page, a loader and a route test.

**NADIA:** So far that's every framework's create-app.

**TOM:** So far, sure. Layer two is where it gets particular. There's a `shopping` module. You've got `Item.schema.ts` describing one item. Schemas only live in files named `*.schema.ts`, that's a rule, E1104 if you put one anywhere else. Then there's a store for the list, and the list had three invariants written beside it: at most fifty items, unique ids, and one open item per name.

**NADIA:** Invariants as in, code?

**TOM:** As in `invariant(store, fn)`. A function that returns true or false over the state. And the only way to change the store is a transaction. `add`, `toggle`, `remove`. A transaction is a named, pure function, state and payload in, new state out. Components can't poke at the state directly. A component lists the transactions it calls in an export called `uses`, and if it calls one it didn't list, that's E1301.

**NADIA:** Wait, so it's Redux.

**TOM:** It's got the Redux shape, yeah. Named actions, pure reducers. The difference is what they do with it. Because every change is a named pure function over a schema, the test tooling can enumerate states, generate payloads, prove things. We'll get to that. And the reactivity underneath is signals, Solid-style. They built that themselves rather than borrowing.

**NADIA:** Okay. And the contract thing. That's the routes?

**TOM:** Right. Each module has a file, `shopping.contract.ts`, that declares every route once. The page at `/list`. `GET /api/items`. `POST /api/items`. `DELETE /api/items/:id`. Each with its schemas. Then `routes.ts` binds each entry to a component or a loader or an action. If you declare an entry and don't bind it, that's E1515. And a link anywhere in the app is built from the contract, `shopping.href("shopping.list")`. You can't write a raw path string into a `Link`. E1501.

**NADIA:** I can't write `<a href="/list">`?

**TOM:** Not through Keel's `Link`, no. The point is that when you rename a route, there's nothing to grep for. The links derive from the contract.

**NADIA:** How many files is the shopping module now?

**TOM:** Seventy-one code files. Plus the migrations.

**NADIA:** Seventy-one files. For a shopping list.

**TOM:** For a shopping list that by the end has Postgres, live updates between two people, a weekly background job that puts staples back on the list, and an offline outbox. But yes. A lot of that count is the one-export-per-file rule.

**NADIA:** Explain that rule, because I think it's where I'd quit.

**TOM:** Every file has one export and the file is named after the export. `addTo.ts` exports `addTo`. Breaking it is E1752. The reasoning is locality. If an agent wants to know what `addTo` does, the file name is the address. It doesn't have to open a `utils.ts` with forty things in it and read past thirty-nine of them. That's tokens.

**NADIA:** And for me, a person with a file tree, it's a wall.

**TOM:** It's a long file tree. I won't argue. Hold on to that for the cost section.

## A checker that hands you the fix

**NADIA:** You keep saying codes. E-fifteen-whatever. Is that the main interface?

**TOM:** Kind of, yeah. Every diagnostic in Keel has one shape. A code, which is one letter and four digits and never gets renumbered. A path with line and column. One line of message, and that line has a hard cap at 89 characters. And when there's a mechanical fix, a unified diff.

**NADIA:** Give me one.

**TOM:** E1403 is a nice one. In JSX you'd normally write `{open && <Panel />}`. Keel doesn't allow `&&` or a ternary around elements. You use `If`, `For` with a `key`, or `Match` and `Case` for unions. So `keel check` prints E1403 with the location, and when `If` is already imported, a diff that rewrites your `&&` into an `If`. And the spec has a rule about those fixes: each one has to apply to its test fixture with `git apply`, and checking again has to report no diagnostic of that code.

**NADIA:** So the fix is tested.

**TOM:** The fixes that exist are tested. Not every code has one. Some can't, and there's an RFC that lists why for each.

**NADIA:** Why not `&&`, though? Everyone understands `&&`.

**TOM:** Everyone understands it, and it's a source of bugs everyone also understands. The zero that renders as a zero. But the bigger reason is that `If` is a thing the compiler can see. It knows there's a branch and what's in it. That feeds the IDs and the accessibility expectations the compiler writes out.

**NADIA:** And if an agent gets a code it doesn't recognize?

**TOM:** `keel explain E1403` prints what it means and how to fix it. `keel docs --for E1403` prints the spec section the code belongs to. And there's `keel docs k.router` for a whole section. The agent's skill file actually says, if no section describes the API you need, stop and report `blocked`, don't guess.

**NADIA:** Okay, but here's my pushback. I have a checker. It's called TypeScript plus a really strict lint config. Why is this different?

**TOM:** Partly it isn't. Household's `pnpm check` is `tsc`, Biome and `keel check`, and `keel check` has its own type pass. The difference is what the rules know about. ESLint doesn't know which file ends up in the browser bundle. `keel check` does. If client code can reach a file named `*.server.ts`, that's E1004 at check time, and then after bundling the build walks the graph again and fails with E1007 if a server-only file or a Node built-in is still in a browser bundle. A lint rule doesn't have that picture.

**NADIA:** Next has `server-only` for that.

**TOM:** It does, and it's a package you remember to import. Here it's read from where the file is and what it's called. You don't opt in.

**NADIA:** What about output? You said tokens matter.

**TOM:** This was the part I underestimated. Every command has a compact mode that's the default when stdout isn't a terminal. Passing tests print nothing. You get one trailer line, like `ok 412 tests, 0 failed, 3 skipped`. Failures are grouped by code, five per code, then a line saying how many more there are and the command to see only those. No colors, no spinners, no timestamps. Relative paths only.

**NADIA:** That sounds like a style preference.

**TOM:** It's in CI. Docs, spec and tool output are measured in tokens and gated. One of the principles says no task should need more than 4,000 tokens of spec in context. So the spec is split into sections you fetch one at a time instead of a big doc site.

## Why not the stack I already use?

**NADIA:** Let me ask the obvious one. Agents write React today. Pretty well, honestly. Next.js, Tailwind, whatever. There's an enormous amount of training data. Why would I give that up for something with no users?

**TOM:** That's the strongest argument against Keel and the repo doesn't pretend otherwise. One principle is literally called "in-distribution where free". It's TypeScript and JSX. The names are familiar. They only spend novelty where it buys predictability, and then they teach it through the checker, so the model doesn't have to have seen it before. It has to read a diagnostic.

**NADIA:** But what does it buy? Concretely. What goes wrong in my React app that doesn't go wrong here?

**TOM:** Okay, a few things, pick whichever. Context providers. In a big React app, what a component does depends on which providers are above it in the tree, and that's invisible from the file. Keel has a principle called no action at a distance: nothing outside a file changes what that file does. No context providers, no global cascade, no auto-imports. Every effect comes in through `ctx`.

**NADIA:** What's on `ctx`?

**TOM:** The clock, randomness, storage, the network. Capabilities. And that's the second thing. In app code you can't call `Date`, `Math.random`, `fetch`, `setTimeout` or `localStorage`. That's E1601. You use `ctx.clock`, `ctx.random.id("Todo")`, `ctx.storage`, and for HTTP you declare a service.

**NADIA:** That's a lot of ceremony to read the time.

**TOM:** It is. But it's what makes the tests deterministic. A test gets a simulated ctx with a seed, the default seed is 1337, and then the clock only moves when the test moves it. `ctx.clock.advance(ms)`. The network only answers what the test routes. So when a test fails on CI you rerun it with the same seed and you get the same failure.

**NADIA:** I can mock `Date` in Jest.

**TOM:** You can, in that test, if you remember. Here the app code can't reach the real one in the first place. The checker won't let it.

**NADIA:** Hm. What's the third thing?

**TOM:** Addressability. Every component, element, route and state path has a stable string id. And the tests address elements by id only. If you write `querySelector` or `getByRole` in a test, that's E1701.

**NADIA:** Wait, hold on. `getByRole` is the good practice. That's the whole point of Testing Library, you test what the user sees, you get accessibility for free.

**TOM:** Yeah, I had the same reaction. Accessibility moved somewhere else. Every passing `renderRoute` test, which is the page-level test, runs axe-core over the page, checks color contrast from the design tokens, and checks focus order. And `find(id)` gives you back the role and the accessible name, so you can assert on them. You address by id so the test doesn't break when someone changes a label. Then the role and name are checked separately.

**NADIA:** So I get both.

**TOM:** You get both. You lose the habit, I guess.

**NADIA:** And I assume every framework says "we're more predictable". Is any of this measured, or is it a feeling?

**TOM:** Some of it. There was an eval early in November where a model built the first golden app, a todo app, from the spec and the skill files, to a green ledger. It converged on the first iteration. Took about ten minutes and cost a dollar thirty-two.

**NADIA:** That's... honestly cheaper than I'd guess.

**TOM:** It's one run of one model on one task, and the kernel was smaller then. I wouldn't hang anything on it. The roadmap's own bar for going public is an agent building a golden app from the public docs, which don't exist yet in that form.

## What it costs

**NADIA:** Okay. You promised. What does it cost me?

**TOM:** File count we've done. Seventy-one in one module. A person writing by hand would find it tedious. The answer the framework gives is that you're not supposed to make multi-file changes by hand. There's `keel scaffold` for module, route, component, store, service, and `keel codemod rename` and `move`. One of the principles is that structure is an operation. Renaming a route across a contract, its bindings and every link is one command.

**NADIA:** And if the codemod doesn't cover what I need?

**TOM:** Then you're editing a lot of small files by hand and the checker tells you which ones you missed. Graceful it isn't.

**NADIA:** What else?

**TOM:** Failures are values. You don't `throw` in app code, you return `err(...)`. That's E1451. You don't write `try`, you wrap throwing code in `attempt`, E1452. And you can't drop a `Result` on the floor, E1453. If you've done Rust or Go that feels fine. If you've done a lot of JavaScript it's a lot of `Result` handling.

**NADIA:** Types?

**TOM:** No `any`, no casts, no non-null `!`, no `@ts-ignore`. Outside one escape hatch.

**NADIA:** There's always an escape hatch.

**TOM:** There's exactly one, by design. It's called `unsafe`. `unsafe(reason, fn)`, in a file under a folder called `unsafe/`. The reason is a string, and if it's under eight words that's E1760. Each one is counted. The ledger records the count, and if a change raises it, `keel ledger --diff` fails with E1706. So you can do the bad thing. You have to say why, in a sentence, and it shows up in a number someone looks at.

**NADIA:** What's the number right now, for the framework itself?

**TOM:** Thirteen, when I looked this morning.

**NADIA:** Thirteen across forty-one packages.

**TOM:** Thirteen. And there's a tool called `keel review` that goes further, it lists every place code opts out of a protection by name, an `unsafe`, a declared origin, a `reveal`, and every place code goes around one without naming it. A cast where check doesn't read. A computed import. A changed CI config. A test that got skipped. A drop in the number of `.pii(` calls.

**NADIA:** And it blocks the merge?

**TOM:** It reports. Some findings fail, some warn, some are listed. Its baseline is read from the base of the range, so a change can't add an escape and accept it in the same breath. The agent skill for reading it is blunt: never approve, never say it's safe to merge. Acceptance is a person's.

**NADIA:** Last cost question. Ecosystem. If I want a date picker, a chart library, whatever.

**TOM:** It depends on what kind of thing. A pure TypeScript library you call from a loader or a helper, that's an ordinary dependency. A component library that owns its own DOM, a chart library or d3, that goes through one element called `Host`. You give it a schema-typed value and three functions, mount, update, dispose. It's client only, the test harness can't see inside it, and the ledger counts how many you have. And Keel-native libraries, packaged so the app's checker runs over them as if they were the app's own code, that format is the newest part of the repo and still settling. So for ecosystem today, the honest answer is thin.

## Tests, rungs and the ledger

**NADIA:** You said the ledger a few times. I don't know what it is.

**TOM:** It's the verification report. Every public export and every spec clause sits on one rung, and the rungs are, from top: proven, exhaustive, probabilistic, example, monitored.

**NADIA:** Monitored comes last? I'd have thought production data is the best evidence.

**TOM:** It's a different kind of evidence. Monitored means a transaction ran in production and got counted, there's a tally file the sessions tooling writes. That tells you it runs. It doesn't tell you it's right. Example means one passing hand-written test names it. Probabilistic is generated input, a hundred runs or more with a fixed seed. Exhaustive is every state from some starting point or to some depth. Proven is proven.

**NADIA:** Proven how?

**TOM:** Two ways. One is `explore`. If a store's schemas are finite, `explore` visits every reachable state and checks the invariants at each one. With no bounds given, that's the closed form, and `complete: true` means every state was covered. The other is `prove`, which translates the transactions and invariants into Z3 and proves by induction that every transaction preserves the invariant for every state and payload the schemas allow.

**NADIA:** Z3, the solver?

**TOM:** The solver. Optional peer dependency. And it only works on a fragment: transactions with no calls to other functions, no loops, no reassignment. Outside that you get E1715 and it tells you to use `explore`.

**NADIA:** So mostly people are at the example rung.

**TOM:** Mostly, yeah. For the framework's own spec clauses, this morning it was 1,418 clauses. 1,113 at example. 253 probabilistic. 44 proven. Six exhaustive. Two with nothing.

**NADIA:** I like that you know the exact numbers.

**TOM:** I looked because I knew you'd ask. And because the principle behind it is that claims lag machinery. The ledger only reports rungs that exist, and anything said publicly is supposed to follow the ledger. So if I told you Keel was proven correct, the ledger would call me a liar. Most of it is example tests.

**NADIA:** What's `simulate`? I saw that in the skill file.

**TOM:** That's the one I find most interesting. `simulate` runs a scenario many times under generated schedules: requests dropped, delayed, lost responses, 503s, storage failing, the app going offline for a window. Same seed, same schedule. Household has a test where a member marks milk as bought while offline. It runs under thirty schedules, and the assertion is the mark commits once or not at all. Never twice.

**NADIA:** And if it commits twice in schedule nineteen?

**TOM:** You get E1704 with the seed, the run and the shrunk case, and you replay it with `KEEL_SEED`. There's also a check they call the law check. Under `keel test` each passing run gets run a second time and the two traces are compared. If they differ, E1729. That catches a test that's secretly depending on something outside the simulation. A real timer, state left over from the last run.

**NADIA:** That's paranoid.

**TOM:** A bit. I haven't seen it fire myself.

**NADIA:** And mutation testing, I saw Stryker in the architecture doc.

**TOM:** For the kernel packages. Mutation score of at least 80 percent for schema, reactive, store and router, 70 elsewhere. The thresholds never get lowered. It runs nightly in CI, and locally there's a lock so only one mutation run happens on a machine at a time, because it's heavy.

**NADIA:** Coverage?

**TOM:** They measure it, and the testing doc goes out of its way to say a covered line is one the tests executed, not one they proved. That's what the mutation score is for.

## The parts Keel won't do

**NADIA:** Let's talk security, because I assume a framework built by agents is going to get asked about it.

**TOM:** There's a threat model doc that's written for people trying to break it. Each protection is one testable statement with the spec section and the diagnostic that enforces it, and then its limits. And they say a limit stated there is published on purpose, it's not a finding.

**NADIA:** Give me a protection.

**TOM:** The content security policy. Every production document gets `default-src 'none'`, a fresh script nonce per response, Trusted Types, `frame-ancestors 'none'`. The only way to widen it is a declared origin in `topology.ts`. An exact origin, under one directive, with a reason. And there's a write check: a POST from another site gets 403 `keel.denied` and nothing runs.

**NADIA:** And a limit?

**TOM:** Same write check. A script that isn't a browser can send whatever headers it likes. The check stops a browser being tricked into a cross-site write. It doesn't stop curl. The doc says that.

**NADIA:** What about personal data? Everyone's favorite compliance topic.

**TOM:** In a schema you mark a field `.pii("contact")` or `.pii("name")`. Secrets are `s.secret`. A secret prints as `[secret]` everywhere, `JSON.stringify`, template strings, `util.inspect`. To get the value back you call `reveal`, and that's only allowed in a `*.server.ts` file, E1105 anywhere else. Then the server log scrubs every pii value from a request to `[pii]` and every secret to `[secret]`. It looks for the value as written, and in hex, base64, URL-encoded, JSON-escaped. Up to two layers of escaping.

**NADIA:** Two layers.

**TOM:** Three or more and it can miss it. That's in the limits list too.

**NADIA:** You said there are two things it won't do.

**TOM:** Authentication, and your app's data. Keel authenticates nobody. It doesn't hash passwords, it doesn't store sessions. You write a file called `identity.server.ts` with a function, `identify`, that answers who made a request, and Keel carries that user id through guards and loaders. The sign-in itself is a library's job. Household and the recipe app both plug in Better Auth through that seam, and the library keeps its own database.

**NADIA:** That feels like a cop-out.

**TOM:** I think it's the opposite. Rolling your own auth inside a framework is how you get a CVE with your name on it. The threat model says sign-in, cookie attributes, rotation, revocation belong to the auth library, and a flaw in that library belongs to that project.

**NADIA:** And data?

**TOM:** Same idea. Keel validates data at a boundary and neither stores nor fetches your app's records. There's a battery for it, `std-postgres`. It runs PGlite in dev and tests, real Postgres in production. Every `sql` call takes a schema. Transactions default to serializable and get run again on a serialization failure, three runs at most, then you get `keel.conflict`. You can opt down, but you have to give a literal reason, and `keel review` lists it.

**NADIA:** So I can't use Mongo.

**TOM:** You can register your own capability and reach whatever store you want through it. Postgres is the one that comes in the box. And to be clear, a front end with no server at all is a supported shape. The first golden app started as a client-only deployable. A topology with no `node` deployable has no Keel server, and Keel isn't answering requests for it.

## Who builds it

**NADIA:** I want to ask about how it's built. Is it built by agents too? The framework itself?

**TOM:** Mostly, yes. There's a person directing, setting priorities, deciding what changes. Then agents in separate worktrees, an orchestrator handing out tasks, reviewing and merging.

**NADIA:** That makes me more nervous, not less.

**TOM:** Sure. So here's the bit that reassured me. Spec first. Every kernel section is written as a spec, and the conformance tests for a section are written by a dedicated agent, they call it the conformance writer, from the spec text alone. It isn't allowed to read the implementation. Then a different agent builds the implementation against those tests. If the builder disputes a test, the conformance writer judges it again, still from the spec.

**NADIA:** So the tests can't be bent to fit the code.

**TOM:** That's the intent. And conformance files can only change through an RFC pull request. There's a hook and a CI check. If you're an agent and your implementation fails a conformance test, the cheap move is to edit the test. That's blocked.

**NADIA:** Does the agent writing the code ever try?

**TOM:** I'd assume so. That's why `keel review` has a code for it. A changed conformance file is R1061. Fewer assertions is R1060. A skipped test is R1059.

**NADIA:** Okay, what does a person do all day, then?

**TOM:** Reads. Decides. The RFCs and the ADRs are where the decisions live. Things like, is a change to the kernel allowed? Right now the kernel is what they call provisionally frozen. Every change goes through an RFC with an ADR, and the formal frozen status waits until the stdlib work has exercised the kernel enough.

## What isn't done

**NADIA:** Let's do the honest section. What's not done?

**TOM:** It's a long list, so stop me.

**NADIA:** I won't.

**TOM:** It's pre-0.1. Nothing is stable. There's no public docs site yet. The roadmap's last gate before going public includes the site, system diagrams, and docs a person can learn from. Today the docs are written for agents first, and they read like it. Dense.

**NADIA:** I noticed. The testing doc has a paragraph that's a page long.

**TOM:** Several. The kernel isn't formally frozen, as I said. Of the kernel's sections, one is still at proposed status, and it's the one waiting on the library format, which is the newest thing and still being built.

**NADIA:** Native apps? I saw Capacitor and Tauri.

**TOM:** CI builds the first golden app as a Tauri Linux binary and an Android debug APK, and it replays a recorded session inside the Linux Tauri shell and checks the server ends up in the same state as the simulated replay. On macOS and the iOS simulator CI runs a launch check, and there's a separate script that drives the app through the accessibility tree. What's not shown: a physical Android or iOS device. A signed release build. A store upload. A Windows Tauri build. The roadmap lists those under not shown.

**NADIA:** Do you trust the shells?

**TOM:** For the things CI drives, sure. The threat model says plainly that the native parts that need a device or an installed bundle are unproven.

**NADIA:** What else?

**TOM:** The numbers move every day. I gave you the ledger counts from this morning, and the README's own headline numbers were already behind when I looked. Package count, clause count. That's a symptom of how fast it's changing.

**NADIA:** Is that a criticism?

**TOM:** It's an observation. A doc that's out of date is a bug by their own rules. There's a freshness check that fails a top-level doc when enough commits have touched its subject since someone last verified it. It catches a lot. Not everything.

**NADIA:** And the human ergonomics thing. You said it would come back.

**TOM:** Yeah. I think if you're a person who likes writing code by hand, Keel will annoy you. `If` instead of `&&`. No `Date`. Seventy-one files. Results everywhere. The bet is that you mostly aren't writing it. You're reading the diff and the review and the ledger. If that bet's wrong, a lot of the design is cost with no payoff.

**NADIA:** Do you think the bet's right?

**TOM:** For the kind of app household is? A web app with forms, a list, a few people, some background work, a database. I think so. For something like a canvas-heavy editor where most of the interesting code is inside a `Host` element, where the harness can't see? I'd want to see it tried first. Nobody's built one.

**NADIA:** Last question. Someone listening wants to poke at it this weekend. Where do they start?

**TOM:** Household's README. Start at layer one and stop at layer four, where the list moves to the server and there's a guard. Most layers end with the same line, `pnpm test && pnpm check && pnpm build`. And when `keel check` complains, don't fix it yourself. Read the diff it gives you first.

**NADIA:** Not even once?

**TOM:** Once. To see what it's like. Then read the diff.

**NADIA:** Tom, thanks.

**TOM:** Thanks for having me. Oh, and layer nine. The one where staples go back on the list every Saturday at eight. Kill the server halfway through with `kill -9` and start it again. Watch it pick up from the staple it was on.

**NADIA:** You saved that for after the thank you.

**TOM:** It's the bit I like.
