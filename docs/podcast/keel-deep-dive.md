# Keel, a deep dive

A two-voice episode written with the `keel-podcast` skill from the main line of the twenty-fifth of November 2026. The host is a senior architect who has shipped on most of the frameworks named here; the guest is Keel's creator. Every state claim is read from `tasks/p1/TODO.md`, `docs/HANDOFF.md`, the spec status lines and `tooling/ledger/ledger.json` as they stood that day. About 82 minutes at 150 words a minute.

## Cold open (minutes 0 to 1)

HOST: I'll start with the thing that made me say yes to this. You told me the main author of code in your framework isn't a person. It's a coding agent. And you designed the framework around that reader instead of around me.

GUEST: That's right. Most new application code is now written by agents, and every framework they write it in was designed for people. Flexible, forgiving, lots of ways to do one thing, lots of rules nobody wrote down. An agent reads through a narrow window. It never learns your codebase the way a person on the team does after six months. It converges by running a check, reading what failed and trying again. So I built a framework where the check is the teacher.

HOST: And you're not public yet.

GUEST: Not in the sense that matters. The repository can be seen, but nothing is on npm, every package is marked private, nothing is announced, and the whole release gate hasn't passed once on the main line. I'll say that more than once today, because a lot of what I describe is built and tested, and some of it isn't.

HOST: Good. Because I've got about forty questions and I'm going to ask what it costs every time.

GUEST: Please do.

## 1. What Keel is and who it's for (minutes 1 to 6)

HOST: Give me the pitch the way you'd give it to a staff engineer who has heard every framework pitch since jQuery.

GUEST: Keel is a full-stack web framework in TypeScript and JSX. You write four things. Schemas, for what the data is. Transactions, for what can happen to it. Components, for how it looks. And a contract for each module's routes, which binds the views and the handlers. Everything else is a declaration or something derived from those four.

HOST: Every framework tells me I only write the important parts.

GUEST: Sure. The difference is what we optimize for. Keel optimizes for predictability, for token cost and for verifiability, and it trades away writing ergonomics to get them. One way to do each thing. A spec small enough to load into a context window. A checker that returns errors with the fix attached. A runtime you can query instead of reason about. And a ledger that says, for every public export and every spec clause, whether it's proven, tested by property, tested by one example, or merely run.

HOST: Why does an agent author change the design? A good framework is a good framework.

GUEST: Three things change. First, alternatives are expensive. When a framework offers three ways to fetch data, a person picks one from taste and sticks with it. An agent picks from whatever was nearest in its training data, so you get all three in one codebase. Every alternative is a hallucination target. Second, invisible rules are expensive. Things like "this hook must be called in the same order every render" or "this provider has to be above that component." A person learns those once. An agent has to rediscover them every session, and it pays for that in tokens and in wrong answers. Third, the feedback loop is the product. An agent will run your checker hundreds of times a day. If the checker's message is good and carries a fix, the agent converges. If it's vague, the agent flails.

HOST: So who's the customer? The agent doesn't have a credit card.

GUEST: The person who directs the agent. A product engineer who wants the agent to build a feature and wants to trust the result. A team lead who wants twenty agent-written pull requests a week not to turn into twenty styles. A compliance owner who wants evidence they can read. And a solo builder who wants to ship an app with a phone shell and offline writes without becoming an expert in six libraries. We wrote personas for this: eight app-author roles, six kinds of library author, and nine kinds of app, from a content site to an embedded widget. Each persona has a human form and an agent form.

HOST: Why another framework, though? Why not a very strict lint config over Next?

GUEST: I tried to answer that honestly before writing a line. A lint config can forbid things. It can't make the things that remain fit together. Our checker knows the route table, the store graph, which file runs in the browser, which fields hold personal data, which origins the content security policy allows. Those are facts about the app the framework owns, so the checker can reason about them. A lint over a framework that owns none of those facts would be guessing.

HOST: How big is it?

GUEST: Forty-one packages. Fifteen in the kernel, twenty-six in the standard library, which we call the stdlib. The ledger file, as of the twenty-fifth of November, tracks 2,800 items: 1,479 spec clauses, 641 public exports and 680 route and accessibility items.

HOST: And how many of those are proven, in the mathematical sense?

GUEST: Eighty-three items hold proven evidence. Twenty-one exhaustive, 458 probabilistic, 2,615 example, eight monitored, and an item can hold more than one rung. So the honest reading is that most of the ledger rests on example tests. That's what the numbers say and I'd rather you hear it from me.

## 2. Principles, and what Keel borrows and refuses (minutes 6 to 11)

HOST: You have twelve principles. Don't read them to me. Tell me the three that cost you the most.

GUEST: One way is the first. No dual APIs, and deprecation is removal at a major version. That costs us convenience every week. Somebody wants a shorthand, and the answer is no, because the shorthand is a second way.

The second is no action at a distance. Nothing outside a file changes what that file does. So there are no context providers, no global style cascade, no ordering rules between files, no auto-imports. That one costs the most in familiarity, because React developers reach for context constantly.

The third is claims lag machinery. The ledger reports only rungs that exist, and anything we say in public follows the ledger. That costs us marketing. I can't say "Keel is accessible." I can say which criteria each route has evidence for, and which ones a person still has to check.

HOST: Let's do borrows versus builds. Give me what you took.

GUEST: TypeScript and JSX, because they're in distribution. Agents have read millions of lines of both, and novelty is spent only where it buys predictability. The reactivity model is Solid-style signals. The parser is oxc, because check latency is tokens. The bundler is Vite with rolldown. The HTTP layer is Hono, for standard request and response objects. Tests run on Vitest with fast-check for properties. Accessibility rules come from axe-core. Signing is the platform's Ed25519 in node crypto. Proofs go through the Z3 solver. Native shells are Capacitor and Tauri. Dates and locales come from the platform's Intl, with no Temporal polyfill.

HOST: And what did you build?

GUEST: The schema system, the store and its log, the compiler artifacts, the checker, the command line, the MCP and language servers, the content security policy with a nonce per response, state charts, the widgets, data tables, and the exploration and simulation harness. The rule we used: borrow where the problem is solved and the borrowed thing doesn't leak its own choices into app code. Build where the thing is the thesis.

HOST: Now the interesting half. What familiar syntax do you refuse?

GUEST: Quite a lot, and each refusal has a reason.

Destructuring props. In Keel a component runs once, and props are getters, so destructuring them reads each value once and the component never updates. It's error E1401, and the fix says to read the prop where you use it.

The double-ampersand and the ternary in JSX for showing elements. Those become E1403. You write an If, a For with a key, or a Match with a case per variant. The reason is that the compiler needs to see the branch to make it a binding, and a Match over a union is checked for every variant.

Throw and try-catch in app code. Expected failures are values, a Result with an ok or an err. Throw is E1451, try-catch is E1452, and a Result you drop on the floor is E1453. That one surprises people most. The reason is that an agent will happily wrap things in try-catch and swallow the error. When failure is a value the type system makes you look at it.

Ambient effects. Date, Math dot random, fetch, setTimeout, local storage, document dot cookie. All E1601, and the fix names the ctx capability to use instead.

String paths in links. A Link or a navigate call takes a typed Href from the module's contract. A string is E1501. No wildcards in route patterns either.

Barrel files and re-exports. One export per file, filename equals the export, and imports across modules name the exact file.

Context providers, as I said. And class names with a global stylesheet. You style with props over tokens, and the style vocabulary has no position, no z-index, no order and no outline. You can't remove the focus ring, because there's no word for it.

HOST: That last one will annoy designers.

GUEST: It will annoy some of them. We'll get to the designer's seat. What I'd say now is that every one of those refusals is taught by the checker. You don't need to read a style guide. You write the familiar thing, and the diagnostic tells you the Keel shape with a fix.

HOST: What about casts and any?

GUEST: No any, no casts, no non-null assertions and no ts-ignore, anywhere except inside an unsafe directory, and every unsafe call carries a justification of at least eight words. The ledger counts them. On the twenty-fifth the ledger file recorded thirty-three. The road-to-public list counts escapes in code that runs differently, and puts it at thirteen after a cleanup, so the two files don't agree. I'd want that reconciled before anyone quotes it.

HOST: You're telling me your own numbers disagree.

GUEST: In two places, yes. The README is also behind the ledger on clause counts. That's the kind of thing the release sweep exists to catch.

## 3. The kernel tour (minutes 11 to 29)

HOST: Let's go through the kernel. Start with reactivity, because I've lived through every version of this. React hooks, where the component function reruns and you manage dependency arrays by hand. Vue refs, where you remember the dot value and the proxy does the tracking. Angular, which spent years on zones patching every async API so change detection would fire, and now has signals. And Solid, where the component runs once and signals drive the DOM directly. Where do you sit?

GUEST: Closest to Solid, and on purpose. There are signals, computeds, effects and resources. A component function runs once per instance. Each dynamic expression in the JSX becomes one binding that updates its own node. No virtual DOM, no rerender of the function, no dependency arrays. The compiler turns JSX into direct DOM operations, and static subtrees become cloned templates.

HOST: So far that's Solid with a different name. What's yours?

GUEST: The constraints. An effect has to declare what it writes. Write to a signal that isn't in its writes list and that's E1201. A cycle in the dependency graph is E1202. A signal created outside an ownership scope is E1203, which is the leak you get in Solid when you create a signal in module scope and forget about it. A resource, which is any async read, has three states: loading, error and ready, and if you consume it without a Match that handles all three, that's E1204. So the spinner state and the error state can't be forgotten.

HOST: Compare that to Angular zones.

GUEST: Zones were a clever answer to a hard question, which is how to know when to check for changes without asking the developer. The price was that anything async anywhere could trigger work, and debugging meant understanding the patch. Angular's own move to signals says something about where the industry landed. We started from signals and added the declarations an agent needs so the graph is knowable from the source. The compiler writes the reactive graph out as a file, and at run time you can ask for it as data.

HOST: What happens when an agent writes the React habit? A use-effect that sets state.

GUEST: There's no use-effect, so the habit has nowhere to go. If it writes an effect that writes a signal, it either declares the write or gets E1201 with a fix. And most state shouldn't be in a signal anyway. It should be in a store.

HOST: State of reactivity?

GUEST: Built and tested. I'll be exact, though. The reactivity section's status line says implemented, not conformance-covered, even though an older freeze review lists it as covered. The spec map is the newer source, so I'd call it built but needing its status confirmed.

HOST: Stores, then. I've done Redux, NgRx, Vuex, Pinia, Zustand, MobX. Sell me a seventh.

GUEST: I won't sell it, I'll describe it. A store is a schema and an initial value with an id. You change it only through a transaction, which is a named, typed, pure function from state and payload to new state. A component that calls a transaction has to list it in its uses. Calling one it didn't list is E1301. Inside a transaction you can't reach ctx or a global, that's E1302, so a transaction is pure. Every transaction is logged, so you get snapshot, restore and undo for free. And you can declare invariants beside the store. An invariant is checked after every transaction, and a transaction that breaks one is rolled back and returns an error.

HOST: That's Redux with reducers by another name.

GUEST: It's close to Redux's core idea, and Redux got that idea right. Named events, pure updates, a log you can replay. What Redux never had is a checker that knows which component may fire which event, invariants the test harness can explore, and a proof tool that can show an invariant holds for every state the schema allows. Those come from the transaction being pure and typed. I'll show what that buys when we get to testing.

HOST: What happens when two browser tabs, or two servers, write the same store?

GUEST: A store has a head. A write names the head it read, its base, and a key so a retry commits once. A transaction declares how it handles a race. The default is reject, which answers 409 with a code, keel dot conflict, and the current head. The other is rebase, which applies the write to whatever the state is now, and that's right when the payload holds nothing the writer read. Stores are built and proven. The store section is conformance-covered.

HOST: Routing. Next gave us file-system routing. Angular has a router module. React Router has three modes now. What's Keel's shape?

GUEST: Each module has a contract file. It declares every route of the module once: pages with their path, params and search schema, layouts, and API entries with a method and an output schema. The contract is client-safe. It may import schema files and nothing else, which is E1514 if you break it. Then a routes file binds each entry to its component, loader, guard, error element and title. Miss one, or bind a wrong kind of handler, and that's E1515.

HOST: Why not files on disk like Next?

GUEST: File-system routing is good for people, because the folder tree is the site map. For an agent it's another invisible rule. Which file name means a layout, which means a loading state, what a bracket means. Our routes are a value the checker reads. And links are typed. A contract gives you an href function that takes a route id with typed params and search. Link, navigate and a form's action take only that Href type. A string path is E1501. So a renamed route breaks at check, everywhere it's linked, with the fix.

HOST: What about a redirect parameter, like next equals some path? That's where open redirects come from.

GUEST: There's a function for that, page href, which turns a string into a page Href only if it matches a page route. Otherwise it gives you nothing. Matching is simple: a static segment beats a param, and there are no wildcards. Routing is built and proven. The router, contract, routes and prefix sections are all conformance-covered.

HOST: Forms and schema. I've used Zod with React Hook Form, Angular reactive forms, Laravel's form requests. What's the one-schema story?

GUEST: Everything is a schema, which is principle four. You declare a shape once with s dot object, s dot string, s dot int, enums, branded ids, unions, records. Optional and nullable are different things. From that one declaration you get parsing, encoding, generators for property tests, docs, and form-data decoding. A form takes the schema. You get a handle with fields, values, errors and pending. A Form element wraps Input elements, each bound to a field. An Input inside a Form with no field is E1901, and a field path that isn't in the schema is E1902.

HOST: Validation timing?

GUEST: From the schema only. On blur first, then on every input once a field has been touched, and everything on submit. An invalid submit sends no request and focuses the first invalid field. If the server answers with a keel dot fields error, those exact fields show their errors. And without JavaScript the server runs the same flow and re-renders the page with the errors, without echoing passwords or secrets back.

HOST: Forms that work without JavaScript is a Remix habit.

GUEST: It is, and Remix was right about it. Both hands-on reviewers called it out as something that worked. Forms and schema are built and proven.

HOST: The server. Loaders, actions, API routes, guards. Walk me through a request.

GUEST: A request matches a route and its params are parsed against the schema. A bad param is a 404, before any of your code runs. Then every guard in the route's chain runs, all of them before any loader. A guard either passes or denies, and a deny redirects, carrying the page you wanted as next. Then the loaders run and the page streams. Loaders and actions live in files ending in dot server dot ts. Write one anywhere else and that's E1551. Guards live in dot guard files.

HOST: And an action, a post?

GUEST: An action gets the parsed input, the caller, the user if the app has identity, and the stores for this request. Every write has to pass a same-site check first, and the body is capped at one megabyte by default. If the action returns ok, the stores it changed are saved. If another process saved first, it's the 409 conflict.

HOST: Next's own data security guide says to treat server actions as reachable by a direct POST. Same here?

GUEST: Same here, and that guide is a good one. Our research notes read it on the twenty-fifth of November. An action is an HTTP endpoint and anything can post to it. The same-site check stops a browser on another site from posting with your cookies. It doesn't stop curl, and the threat model says so: a request with neither the fetch-site header nor an origin header is admitted, and any non-browser client can send the header we look for. Your guard and your action's own checks are your authorization. Keel doesn't write those for you.

HOST: API routes?

GUEST: An API entry in the contract answers JSON with no view. A bearer token arrives as a Secret value, so you can't log it by accident. Cross-origin calls are allowed only for origins listed in an environment variable. And on the other side, calling a service from your code goes through a service client, made from a contract or a base URL and a schema. A client method never throws. It returns a value: timeout, network, a status error, a decode error or an input error. The default timeout is ten seconds. Server, guards, API and services are all conformance-covered.

HOST: You keep saying ctx. That's the thing I want to push on. Time and randomness as injected capabilities sounds academic.

GUEST: It's the most practical thing in Keel. Every effect comes through ctx. The clock, random numbers and ids, the network, storage. A component gets ctx as its second argument. Call Date dot now, Math dot random, fetch or setTimeout in app code and that's E1601, with the fix naming the ctx call. Ambient locale or time zone is E1758.

The payoff is that there are three ctx modes: real, shell and sim. In sim, the clock is a number the harness moves, the random source is seeded, and the network is a table of routes you write in the test. So a test of "the invite expires after seven days" doesn't wait seven days or mock a global. It moves the clock. A test of "the save fails when the network drops" doesn't need a proxy. It drops the route.

HOST: What does it cost me? Every function now takes a ctx.

GUEST: That's the cost. Your code carries ctx explicitly, the way Go code carries a context. Agents don't mind. People notice it for about a day. The ctx section is conformance-covered.

HOST: The client and server boundary. Next's answer is directives: use client, use server. What's yours?

GUEST: Placement. A dot server file or a dot guard file, in a module that a node or static deployable serves, is server-only. A client module's handler files run in the browser. The checker computes what code can reach a browser, and importing server code from client code is E1004. The build then makes sure of it: every browser build loads a server-only file as a stub that throws if it's ever called, and after bundling it walks the graph and fails with E1007, naming the import chain, if a server file, a Node built-in or another module's handler got in. A browser build exposes no environment variables except mode and a few flags.

HOST: And islands?

GUEST: A component is interactive only if it has a handler, an effect, or a read the client can write. The rest is static HTML with no JavaScript. A page with no island gets no resume script. That boundary is built and proven, and a smoke test in CI drives five pages through Chromium to check resume.

HOST: Topology. This is the word that made me curious.

GUEST: A topology file declares your deployables. Each one is a set of modules with an adapter: node, static or client. Node serves pages and runs loaders and actions on a server. Static prerenders one HTML file per route. Client runs loaders and actions in the browser. Each module lives in exactly one deployable.

HOST: And splitting a monolith into services?

GUEST: That's the part I'd defend in front of anyone. A module calls another module through a service made from its contract. The encoding is the same in every topology. When you move a module into its own node deployable, the call gains latency and two new possible outcomes, network and timeout. Never a different value. There's a codemod called place that moves a module between deployables and regenerates the deploy files. Peers find each other through an environment variable per peer.

HOST: What does build give me?

GUEST: A folder per deployable. For node, a server file that reads port, the secret, the origin and the database URL, and refuses to start with E1560 if one is missing or wrong. For client, an index file, hashed assets and a text file with the content security policy your host has to send. Plus a Dockerfile per node deployable, a compose file and a CI workflow, all generated and read-only. Hand-edit one and check fails with E1005. Topology and deploy are conformance-covered. The native shells we'll do later.

HOST: Modules and their boundaries.

GUEST: A module is a folder with a manifest: its id, its deps, the capabilities it uses, and its public exports. Everything else is private. Import a non-public export, E1151. Import from a module not in deps, E1152. A cycle in deps, E1153. Route, store and transaction ids have to start with the module id, E1155. Use a ctx capability the manifest doesn't list, E1156.

HOST: So Nx module boundaries, built in.

GUEST: Same goal as Nx's boundary rules, and Nx does that well across a big monorepo. Ours is inside one app, and it knows about routes and capabilities as well as imports. State: the module section is implemented, not conformance-covered yet. The library section, which is how a module from a package joins an app, is still proposed. Those two are among the last kernel sections waiting.

HOST: Last kernel question. You said earlier a front end with no server is first class. Most full-stack frameworks treat that as a degraded mode.

GUEST: For us it's a first-class topology. A client deployable runs its loaders, actions and guards in the browser with a real ctx. A topology with no node deployable has no Keel origin at all. It sends no request except to origins you've declared. The walkthrough app, Evenly, is exactly that: a group trip's shared costs, no server, no sign-in, no user concept. The scaffold's default adapter is client.

HOST: And identity?

GUEST: Opt-in. Without an identity file, the user is an empty string everywhere. If you add one, beside the topology file, it exports an identify function and optionally a handle that mounts an auth library's endpoints. Keel asks your auth library who the user is. It never reads, writes, mints or stores a credential. That's built and proven for the client-only case and the mount. One gap: on a native shell, the return after sign-in can't be tested inside the harness yet.

HOST: One more thing a reviewer found, I'm guessing.

GUEST: A no-server app still imports the server package for the topology function, and the default title is the word web. Both minor, both on the list.

## 4. The app builder's day (minutes 29 to 35)

HOST: Make it concrete. I've got an agent and an empty folder. What happens?

GUEST: You run keel scaffold project with a name. You get a package file, a tokens file, a topology file, a Vite config, an empty app module, generated CI and deploy files, and agent files with the skills. Then everything structural is a scaffold or a codemod. Keel scaffold module. Keel scaffold route, with the route id and dash dash path. Keel scaffold store, keel scaffold transaction, keel scaffold component, keel scaffold service from an OpenAPI file, keel scaffold shell. The scaffold's promise is that if check was clean before, it's clean after. If an operation would break that, it writes nothing and tells you the first diagnostic.

HOST: And the agent writes code between scaffolds.

GUEST: Then it runs keel check. That's the gate. It covers the whole project, it runs before every build, and it never evaluates app code. It parses with oxc, runs a strict TypeScript pass, runs the compiler's checks and the rule registry, kernel and stdlib rules both. The spec's target is under a second warm on the first golden app. A clean run prints one line.

HOST: Show me a diagnostic in words.

GUEST: A code, one letter and four digits, which is never renumbered. A file, line and column. One line of message, under ninety characters. Then, when there is one, a fix written as a unified diff: take out this line, put in this one. And a pointer to the spec section. Diagnostics are grouped by code and capped at five per code, so a thousand errors don't flood the context. Output is compact when it isn't a terminal. There's keel explain with a code, which gives the meaning and the fix pattern in about a hundred and twenty tokens, and keel docs, which prints the spec section that ships in the installed package.

HOST: One export per file. I'll be honest, that sounds like a style rule somebody got religious about.

GUEST: It's principle three, and I'd keep it if I lost others. One export, and the file name equals the export. A component file may also export its Props type and its uses list. The reason is addressability. When the checker says "store shopping items", the agent knows the file without searching. When it renames, the codemod renames one file. When a diff lands, a reviewer sees one thing changed. The walkthrough app's first chapter has an exercise for exactly this: put a second export beside the page and read E1752.

HOST: What does a human do in this loop, and what does the agent do?

GUEST: The skills draw that line. The agent scaffolds, writes, checks, tests and reads the spec on demand. If no spec section describes an API it needs, the skill tells it to stop and say it's blocked, not invent one. The agent never edits node modules. A person holds the things that are trust: accepting an escape that keel review flags, supplying production secrets, holding the evidence signing key, installing native tool chains. The escapes skill says the agent never approves a change, never says it's safe to merge, and never accepts a finding.

HOST: What did it take an outsider?

GUEST: That's in the end-user review from the twenty-fifth. A product engineer, from the packed kit alone: a scaffolded app, a node page with a server loader and an action over a store, check and test green, the built server serving it, and the charts library installed and drawing. About twenty-five commands and six misreadings of the docs. Verdict, yes, with pain.

HOST: What was the pain?

GUEST: The blocker was install. You can't add the kit's tarball with pnpm today, because its dependencies aren't on a registry. It works only with hand-written overrides. Nothing exists yet for a create-keel command. Then the paper cuts. The scaffold leaves an app module in the topology that the skill's example then trips over. A generated surface file goes stale after every component edit until you build. Form input ids are generated unless you give one. A scaffold-route error doesn't name the missing flag. And keel review fails on a fresh, clean app because it judges Keel's own bundle. Each of those is a next line on the road-to-public list.

HOST: And agents? You said they're the author.

GUEST: Mixed, and I'll give you both. The trials file from the twenty-fifth: Codex built the recipe box through our head-to-head harness and converged, twenty-eight of twenty-eight acceptance checks, in one iteration. Claude, building the third golden app from public material, has not converged in any trial yet. The early runs hit kit defects we've since fixed. The later two each ran out of their eighty-turn cap, and the agent spent twenty to twenty-five of those turns reading docs. So the docs command and its output size are the next thing.

## 5. The designer's day (minutes 35 to 39)

HOST: You said designers would be annoyed. Let me be the designer. Where do I work?

GUEST: In the tokens file. It's the one source for color, space, size, radius, font, font size, weight, shadow, border, breakpoints and motion. The default is one line: tokens equals brand tokens, from Keel's UI package. That styles every page with no props at all. A charcoal-on-off-white palette, one ochre accent kept for status, serif body type and a mono face, hairline borders, two breakpoints.

HOST: And if I want my own brand?

GUEST: You spread brand tokens and override, or write your own. Then there are two groups beyond the scales. Base is the style set for each element role: the page, headings, links, buttons, controls, labels, field errors, the no-script error summary, and the focus color, which draws a two-pixel focus ring with no app code. Looks are named style sets you apply with look equals a name. Primary, secondary and control ship. The household app adds two of its own: a panel, which is a white hairline card, and a notice in the error color.

HOST: No class names at all?

GUEST: None. Style props only, and their values are token names. A raw value like sixteen pixels or a hex color is a type error, and a missing token is E1801. A style attribute is E1803. The compiler emits one atomic class per prop, token, breakpoint and state, deduplicated across the app, into one CSS file. Responsive values are keyed by breakpoint. State styles like hover and focus-visible go under one states prop.

HOST: That's Tailwind's output with a type system on top.

GUEST: That's a fair description of the output, and Tailwind proved atomic CSS works at scale. The difference is that our values come from your tokens and the checker knows them, so it can judge contrast.

HOST: Go on.

GUEST: Text under four and a half to one against its background is E1804, three to one for large text, judged from the tokens where the colors are literal in the component, and at render in tests for the rest. A Heading without a level, an Image without alt text or a decorative flag, an Input without a label, all E1802. Reversing direction over focusable elements, so visual order differs from tab order, E1820. A focus ring under three to one, E1807. Those fail the build, not a review.

HOST: Building blocks?

GUEST: Box, Text, Heading, Button, Link, Image, Input, TextArea, Select, Checkbox, and a few more. Widgets come from the headless package: Listbox, Combobox, Menu, Tabs, Dialog, Disclosure and Toaster, each built on the WAI-ARIA authoring practices, each part styled through a styles prop from your tokens.

HOST: And when I need something that isn't there? A map, a d3 chart, a rich text editor?

GUEST: A Host element. It's the one element whose DOM node outside code owns. You give it a schema-typed value and a code import, and that code gets mount, update and dispose. It's client only, opaque to the test harness and to replay, and the ledger counts every one. So you can see how much of your app is outside the guarantees.

HOST: State of the designer story?

GUEST: The tokens, base, looks, building blocks and contrast checks are built and proven. Two gaps are real. A token name the app lacks can slip through check today and fail only at build, with a message that names no file. The fix is being built under RFC 0241 and is waiting for the gate. And the Part roles don't include switch, slider or radio yet, which a component library needs. A designer re-theming an app is one of the reviews we haven't run.

## 6. The standard library (minutes 39 to 48)

HOST: The stdlib is twenty-six packages. I'll pick three to go deep on and fire the rest at you. First: data. Where do my records live?

GUEST: Wherever you choose. App data is the app's. Keel validates it at a boundary and neither stores nor fetches it. You reach your records through a capability you register, or through the Postgres package, which is the battery we ship. You declare a database by a literal name in a server file. You write SQL with a tagged template, and every statement takes a schema for its rows, so what comes back is parsed. Every interpolated value is sent as a parameter, never spliced into the text. Migrations are numbered SQL files in the module, forward only. In dev, in tests and in simulation it runs on PGlite, Postgres compiled to run in process, so a test needs no Docker.

HOST: Transactions?

GUEST: Serializable by default. On a serialization failure it reruns your function, at most three runs, then answers keel dot conflict. You can opt down to repeatable read or read committed with an allow option, but you have to give a literal reason, E2459 without one, and keel review lists every allow. A function like now or random inside SQL is a warning, because simulation can't replay it.

HOST: No ORM.

GUEST: No query layer at all. The schema on each statement is the type safety. I know people love Prisma and Eloquent, and both are good at what they do. An ORM is a second language with its own invisible rules, and SQL is something every agent has read a lot of.

HOST: And Keel's own state? Sessions, job queues?

GUEST: That goes in ctx storage, which is a separate thing: get, set, a read of several keys at one cut, and a commit that's compare-and-set over several keys. A node deployable picks file, SQLite or Postgres in the topology. The Postgres battery is built and proven at example level, and its mutation score in the coverage file is about eighty-eight. The golden recipe box runs on it.

HOST: Second deep one: offline. I've shipped Ionic apps where offline was a month of work.

GUEST: The offline package gives you an outbox over a contract's write entries. You send a write through it. It resolves as sent, queued, conflict or failed. Queued writes sit in ctx storage, each with its key, the base head it read and its owner, and drain in order on reconnect. If the server has moved on, the entry becomes a conflict, and the app shows it. The person picks mine or theirs, and the outbox resolves it.

HOST: What happens when the person who queued the write signs out and another person signs in on the same phone?

GUEST: Each write carries its owner, and the action's first line checks it. Another owner's write is refused with a code, and a write with no user asks for sign-in. The limits are a hundred entries and two hundred fifty-six kilobytes by default. There's a household test for the human version of this: one person marks milk bought with the network down, it waits, the server is unchanged, and it commits once on reconnect. If someone else changed the list meanwhile, the page says the marks weren't applied and offers the choice.

HOST: And how do you find races before users do?

GUEST: The conflicts package. Give it a group of rebased writes and it replays them in both orders and reports any whose order matters. That runs in tests, never on a request. Offline and conflicts are built and proven at example level. Both are tier one, which means the target mutation score is ninety, and today they're in the high seventies. So, built, with hardening owed.

HOST: Third: workflows, jobs and schedules. The thing I always end up building with a queue and a cron box.

GUEST: A job is a function with an input schema, three attempts and a sixty-second timeout by default. A schedule is a cron line with a time zone and a rule for missed runs: once or skip. A workflow is a state chart where step states run a function and wait states time out, one instance per run, kept in a server store, with each step run as a job. A step runs at least once, so you pass a key to its effect. A step killed in the middle reruns when its lease ends.

HOST: Give me a real one.

GUEST: The household app has a Saturday-morning restock. A schedule fires at eight, UTC, and a workflow adds five staples to the shopping list, one every two seconds. The test kills the server at eleven different points, starts a new one on the same storage and database, and checks the run ends once as done with each staple on the list exactly once. On the simulated clock, so it runs in seconds.

HOST: State?

GUEST: Jobs and schedules are built and proven. Workflows is the one stdlib section whose status is still implemented, not conformance-covered, and its mutation score is about seventy-three against a threshold of seventy. Built, needs work. There's a CI smoke that kills a workflow inside a step with a real signal and checks it resumes.

HOST: Quick-fire on the rest. Channels and live.

GUEST: A channel is declared in a schema file and served by a channel route. On the client, live keeps a store current by re-reading through its loader after each push. Status is connecting, live, offline or denied. Messages reach members on the serving process. Data every replica must see goes through a store save or follows a Postgres change. Caps of eight streams per caller and a thousand in all. Built and proven at example level.

HOST: Statecharts.

GUEST: A chart compiles to a store and one transaction per event, so every tool that reads a store reads a chart. Unreachable states and dead ends are check errors. No XState, because a chart that's a store needs no second runtime. Built and proven, two clauses at proven.

HOST: Sessions.

GUEST: Record a session in the browser, redacted once there: personal data replaced with generated values, secrets and passwords dropped. Replay it as a test. Built and proven. The move onto the library format is in an unmerged lane.

HOST: I18n.

GUEST: Locales as a schema enum, number formatting, plural rules, and message sets. Once a module uses message sets, a fixed word in JSX is an error, E2406. Plural forms take exact forms like equals zero, and a category the locale never selects is caught. Built and proven. Moving every Intl call into the one package is in an unmerged lane.

HOST: Money.

GUEST: Minor units with a currency. Format, parse with a locale, add. Twelve comma fifty in a US English field is an error, never rounded. Built and proven, mostly at probabilistic.

HOST: Temporal.

GUEST: Instants, plain dates, time zones, durations, formatting, built on platform Intl with no polyfill. Built and proven.

HOST: Tables.

GUEST: Declare columns once. The table's query lives in the route's search, so a sorted, filtered page is a URL. One apply-query function runs in the loader and on the client, so both compute the same rows. A personal-data column in search or filter is an error. Built and proven, with a mutation score close to its threshold.

HOST: Headless widgets.

GUEST: The seven I named, each with one state chart instance, keyboard and ARIA per the authoring practices, every word a prop. Built and proven. Grid, tree, slider, radio group and date picker are in the future list.

HOST: Native shells.

GUEST: Declare shells on a client deployable, Capacitor for Android and iOS, Tauri for desktop. Keel build dash dash target builds them. The shell supplies storage and network drivers, and the web build runs unchanged. A shell sends only to your origin, your peers and declared connect origins. Built, proven with conditions. Linux Tauri runs in CI. Android builds in CI but nothing is driven on a device. macOS and iOS were driven on one Mac, three runs each, replaying a session and draining an outbox. The threat model calls behavior on a real device unproven.

## 7. Testing and the ledger (minutes 48 to 54)

HOST: You promised testing would show what pure transactions buy. Go.

GUEST: Five kinds of test, in rising strength. Example tests render a component or a whole route in a harness. Render a route and the guards and loaders run, then the page. You fire events at elements by id, wait for things to settle, and find an element by id. You get back its role, name, text and state, never a DOM node. A DOM selector in a test is an error, E1701. Every render runs axe-core's WCAG two point two A and AA rules, and a pull of the accessibility tree and the focus order is one call each.

Property tests take a component or a transaction and run it a hundred times with inputs generated from the schemas. For a component: it renders without throwing, it has no axe violations, and it's equal under one seed. For a transaction: the output parses, every invariant holds, equal inputs give equal outputs, and undo restores. A failure prints the seed and the shrunk case.

Exploration takes a store's transactions and visits every reachable state up to a bound, checking invariants. If one breaks, it gives you the shortest path there.

Simulation runs a scenario under generated schedules of delays, dropped requests, lost responses, 503s, storage failures and offline windows. The simulated clock jumps to the next deadline when nothing else is pending. And a law check runs each passing run a second time and compares the two traces, so nondeterminism in your code fails the test.

Proof hands a store's transactions to Z3 and proves the invariants by induction, for every state and payload the schemas allow.

HOST: Every state? That sounds like an oversell.

GUEST: It would be, without the limit, so here's the limit. Proof works only for a fragment: no calls to other functions, no loops, no reassignment, no reduce. Outside it you get E1715 and the advice to explore instead. The walkthrough app's README says it plainly. Evenly proves its add-person and add-cost transactions keep five invariants, ids unique, every payer on the trip, one currency and so on. But "balances sum to zero" can't be stated for the prover, because the fragment has no sum. So that one is checked by two hundred seeded trips instead.

HOST: That's a good example. Where does this all land?

GUEST: In the ledger. Every public export and every spec clause gets its highest rung, or none. Proven, exhaustive, probabilistic, example, and monitored, which is a tally from production. A rung rests on a run: a test counts only while the run report says it passed at the test file's current version. And keel ledger dash dash diff fails the build if a rung goes down or the unsafe count goes up.

HOST: You gave me the rung numbers earlier, and they were mostly example.

GUEST: Yes. Of the clauses alone, the ledger file on the twenty-fifth had 1,174 at example, 253 probabilistic, 44 proven, six exhaustive and two with no test. The coverage file says outright what a verified clause means: a conformance test cites it. It doesn't mean the test is strong. That's why we run mutation testing.

HOST: Thresholds?

GUEST: Eighty percent for schema, reactive, store and router, seventy elsewhere, and they're never lowered. Nightly in CI. The coverage file from the twenty-fifth has router at about ninety-two, schema near ninety, store and reactive both between eighty-six and eighty-seven. The checker sits near seventy-three, with fifty stale claims left out of that score, which I'd call a caveat on the number. The tier targets on the road-to-public list are higher: ninety for tier one. Most tier-one packages aren't there yet.

HOST: Conformance tests. You said they're written from the spec.

GUEST: Before the implementation, by an agent that can't read implementation files. Each conformance file quotes the clause it tests, and the ledger matches a test to a clause by that quoted text. Conformance files change only through an RFC. It's a cheap way to stop the implementer from writing the tests that its code happens to pass.

HOST: Now the question you're expecting. End-to-end tests. Playwright, Cypress. My team won't ship without them.

GUEST: That's a gap, and it's the one I'd most like you to repeat. The harness runs in process, not in a real browser. The repo has real-browser smoke tests for its own apps, in Chromium, but they're internal. There's no keel test dash dash e2e for an app author today. The product engineer in the review brought Playwright in by hand. An RFC for end-to-end tests over the built app in a real browser is a next line on the list, with the repo's own smokes moving onto it. Until then, you'd run Playwright beside Keel the way you do now.

HOST: Other things the testing story doesn't cover?

GUEST: Screen readers aren't tested. Contrast comes from tokens, so text over an image isn't seen. And the reviewer hit two real bugs. Firing submit on a form, the way the testing skill says, sent no POST through the app; click worked. And simulate over a whole app with a POST failed its law check with no detail, and passed only with the law check off. Both are on the list. And one about our own house: the release gate has failed three whole runs on this machine at one-tenth time scale, on four test time bounds and one smoke. Check passes. The ledger is fresh. The whole gate has never passed on the current main line.

## 8. Library authors (minutes 54 to 59)

HOST: Let's say I want to publish a component library for Keel. What's the format?

GUEST: A library is a package marked as a Keel library with a module manifest at its root, its source and an unsafe folder. It ships its TypeScript source, under a keel export condition. An app lists the library in a module's deps by package name, and from then on keel check and keel build read the library's files as if they were the app's own. Every rule applies there except one about file layout. A diagnostic in a library shows up at its path under node modules, with no fix, and nothing can turn a rule off there.

HOST: That's a big claim. My existing npm packages don't work that way.

GUEST: Right, and a plain npm package inside an app is one of the reviews we haven't run yet. For a Keel library, keel scaffold library gives you the folder. Keel pack runs five steps, kind, package, check, test and ledger, and writes a ledger file you commit. Every Keel package the library imports must be a peer dependency, never a dependency, so it resolves to the app's copy. Every element id must be built from the component's id prop, which keeps ids unique when the app uses the component twice. The ledger counts the library's unsafe uses and host elements, and the app recounts them.

HOST: What does a library see of ctx? If my library wants the network?

GUEST: That's the capability question, and today's state matters. A library's module lists capabilities like any module. Check catches a library's direct fetch, a network call to an undeclared origin, a missing capability and a ledger miscount. What's decided but not on the main line is the app-side grant: the app names, per library, the capabilities it allows, and a library holding one the app didn't grant is an error at check. It's built in a lane, with a review owed, and its first known issue is that a non-literal manifest fails open. So, a goal not yet realised on the main line.

HOST: What did the library reviewer find?

GUEST: The good part first. From the kit alone, an outsider scaffolded a library, wrote a badge, a toggle and a card with a slot, tested, packed and installed it into a scaffolded app, check clean, no unsafe, in about fifteen minutes. Then it stopped at four rows. The blocker I mentioned: a token name the app doesn't have passes everything until build. A library can't ship a look of its own. There's no switch, slider or radio role. And property tests on a component fail on a generated id, and a probe's properties don't raise the component's rung, so every chart in our own charts library sits at example. No publish story, no provenance workflow. The library scaffold doesn't write agent files.

HOST: The look question. How should a library ship its visual design without breaking your no-action-at-a-distance rule?

GUEST: We decided a direction and haven't built it. A library ships a tokens object, and the app composes it in its own tokens file, the same way it composes brand tokens. The names a library needs are declared, namespaced by the library's id and checked against the app's at keel check. Nothing applies unless the app imports it. So the app still owns every style that reaches its pages. That needs an RFC, and it's a next line.

HOST: And trust? A library is code running in my build.

GUEST: Two holes the second reviewer found, and I want both on the record. A library's tools entry runs any Node code during keel check and keel build, and the app approves nothing. The reviewer's tools file wrote a file to temp and read the environment. And a library's unsafe folder is a full escape that the app's check doesn't show: a raw fetch posted to the app's own action on page load and planted a row, with check reporting zero errors. Only the ledger's unsafe count showed it. The fix decided is that tools and unsafe become capabilities the app grants, and the scaffolded CI runs the ledger diff. Not built yet.

## 9. Security and compliance (minutes 59 to 64)

HOST: Personal data. Every framework tells me it takes privacy seriously. What does Keel do?

GUEST: You mark fields in a schema with a pii class. There are eight: name, contact, location, identifier, financial, special, network and content. The mark changes no type. Then the checker follows it. Personal data in a route's params or search is E1111, because URLs end up in browser history and proxy logs. A store that a client file reaches ships its state to the browser, so each class it holds has to be listed in the module's client pii list, E1107 otherwise. A control bound to a pii field without an autocomplete attribute fails the accessibility check. In the server log, records carry a placeholder in place of the value. The scrubber finds values as given and under the usual encodings, percent, plus, JSON, HTML entities, base64 and hex, one or two levels deep.

HOST: And three levels deep?

GUEST: Not found. The threat model lists that limit, and others: some escape forms, hashes, compression, hex of very short values. And marking is the author's duty. A value copied into an unmarked field, or derived from a marked one, isn't redacted. The rules stop accidents. An author who means to store a secret can.

HOST: Secrets.

GUEST: A secret schema parses to a Secret value. It encodes, stringifies and logs as a placeholder, and has no keys you can enumerate. To get the value you call reveal, and reveal is allowed only in a server file, E1105 anywhere else, tests included. A revealed value reaching a log, storage, a file, store state or a throw in the same file is E1112. That analysis doesn't follow a value through a helper or an import, and the docs say so. A secret in a loader's output is E1113.

HOST: Content security policy. Most teams turn it on, break the site, and turn it off.

GUEST: Every node document gets a strict policy with a fresh nonce per response, strict-dynamic, Trusted Types, no inline styles, frame ancestors none, plus the usual headers. App code can't add an inline script, a style element or attribute, or an on-handler attribute, and a literal outside URL in a source attribute is an error. The only way to widen the policy is a declared origin in the topology, with an exact origin and a reason, under one of image, media, font, connect or frame. Script and style can never widen. The limits: dev sends a report-only policy, a client or static deployable's policy is a text file your host has to send, and a declared connect origin can receive anything the document holds.

HOST: Session recordings sound like a privacy problem waiting to happen.

GUEST: They can be, so the redaction happens once, in the browser, before anything is stored. Pii values become generated values, and secrets and password inputs are left out. The household app has a test that types a name and a phone number into marked fields and checks that the recording, its upload and the archive hold neither. The limit is on the server side: the ingest endpoint redacts nothing more and accepts unauthenticated posts up to two hundred fifty-six kilobytes, and the threat model says so. Listing recordings is limited to the readers you name.

HOST: And the anonymous cookie every visitor gets?

GUEST: The caller cookie. It's HttpOnly, SameSite Lax, host-prefixed and Secure over https, signed with the app's secret, and it grants nothing. It's how a write is tied to a browser without a user. Its lifetime is one to four hundred days, and the caller's hash is itself marked as network-class personal data.

HOST: Evidence for an auditor.

GUEST: Keel evidence runs test, check and ledger, makes no network request, and writes a dated folder: a manifest and its Ed25519 signature, the check output, the ledger, an accessibility report with the criteria left to a person, the security headers and policy with every declared origin and its reason, the personal-data paths and sinks, and the production dependencies as a CycloneDX list. It holds no app values, only ids, codes, paths, counts and hashes. Keel evidence dash dash verify checks the signature and rehashes every file. The signature proves the files haven't changed since a key holder signed them. Who holds the key is your process.

HOST: And what's not claimed? Authentication, I assume.

GUEST: Keel is not an auth library, and that's deliberate. It authenticates no one. It never reads, writes, mints, rotates or stores a credential or a session. Sign-in, passwords, cookie attributes, rotation and revocation belong to the auth library or platform you plug into the identity seam. The household and recipe-box apps use Better Auth as the example. Also out of scope: the host, TLS, rate limiting per address, your guards and actions, every unsafe and reveal you write, your dependencies, and denial of service beyond the stated caps. And there's no outside audit yet. The accessibility audit and the penetration test are scheduled for the end of the public-readiness phase or after it.

## 10. Why an enterprise should care, and a solo builder (minutes 64 to 68)

HOST: I've sat in the room where a platform team picks a framework. Make the enterprise case in two minutes.

GUEST: Three things. When agents write a large share of your code, the risk moves from "can we write it" to "can we trust what was written." Keel makes the checker the reviewer of first resort: one way per task, so twenty agent pull requests look alike, and the rules that matter for security, privacy and accessibility fail check instead of waiting for a human to notice. Second, the evidence bundle is something a compliance owner can read and verify without reading code. Third, the topology model lets you start as one deployable and split without rewriting calls.

HOST: And the solo builder?

GUEST: One person and an agent can ship a client-only app with offline writes, a phone shell, i18n and money handled correctly, and tests that run under simulated time and network, without assembling six libraries. And you can stop at any layer. The walkthrough app is designed as fourteen layers, from a page with no server to native shells. Three are built.

HOST: What does adoption cost?

GUEST: Learning the refusals. No context, no throw, no class names, no destructured props, no ambient Date. A person feels that for a week. Carrying ctx. Giving up an ecosystem: React's component libraries don't drop in. A DOM-owning library goes in a Host element, and anything else is written in Keel. And adopting something pre-release, with no outside users yet.

HOST: What about the cost in tokens? Agents aren't free either.

GUEST: That's measured as a budget. Principle twelve says docs, spec and every tool output are counted in tokens and gated in CI. No task should need more than four thousand tokens of spec in context. A spec section has a token cap, the map has a cap, keel explain has a cap. The honest part is what the trials showed: an agent building from public docs spent a quarter of its turns in docs output. So the budget exists, and the docs command still costs too much. That's the next piece of the agent-docs workstream.

HOST: Can I adopt it inside an existing app? I'm not rewriting a Next site to try it.

GUEST: Not well, today. The personas include an embedded piece, a widget inside an existing site, and a client deployable can be hosted anywhere. But there's no guide for running Keel beside an existing framework, and that persona isn't among the reviews scheduled. For a team, the realistic first step is a new, separate app.

HOST: Upgrades. I've done Angular major upgrades. Tell me about the freeze.

GUEST: The kernel spec never changes meaning once a section is frozen. Today the kernel is provisionally frozen, and no section has flipped to frozen. The flip waits until every kernel section is conformance-covered, and that waits on the library format's last slice. Changes go through an RFC. Deprecation is removal at a major. And 1.0 is defined on the list: after a public 0.x preview, four weeks with no kernel semantic change and no frozen section reopened. Before then I won't write codemods or compatibility shims for unreleased changes. After it, structure is an operation, so a breaking change is meant to ship with its codemod.

## 11. Bugs the design removes, and bugs it doesn't (minutes 68 to 72)

HOST: Name the bug classes you remove, each with the mechanism. No vague answers.

GUEST: Injected markup and script. Output is escaped by context, URL attributes with a non-web scheme render as a blank page, there's no raw HTML API outside unsafe, and the strict policy with Trusted Types backs it up.

Server code or secrets leaking into the browser bundle. Placement plus the stub plus the E1007 build failure, and no environment values in browser files. The limit is a secret hard-coded in a shared file, which ships.

Cross-site writes, by the same-site check on every write.

Open redirects, by typed Hrefs and page href.

Personal data in URLs and logs, by the pii marks, E1111 and the scrubber, within the limits I gave.

A form field with no label, an image with no alt, a heading with no level, low-contrast text. All fail check.

Lost updates across requests and tabs. Request-isolated stores, heads and bases, the 409 conflict, serializable Postgres transactions.

SQL injection in app data, because every value is a parameter. Migrations run as written, though.

Flaky time and network bugs in tests, because every effect is injected and seeded.

Invalid states, by invariants checked after every transaction and by explore and prove.

The forgotten loading or error state, by a resource needing a Match. The swallowed exception, by failure as a value.

HOST: Push on one. What happens when the agent can't make check pass and reaches for unsafe to get around a rule?

GUEST: Then it has to write unsafe by name, in a file under an unsafe folder, with a reason of at least eight words. The ledger counts it, and the ledger diff fails the build if the count goes up. Keel review lists it as a new escape with a danger level, and the CI review job fails the pull request on a finding marked fail. Only a person accepts it, in its own change, and the accepted list is read at the base of the range, so a change can't accept its own escapes. The review also watches the quieter workarounds: a cast, a suppressed error, a skipped or focused test, a test with fewer assertions than before, fewer pii marks, secrets or guards than before, an edited generated file, a changed conformance file.

HOST: And what can review not see?

GUEST: A capability reached through a value from another file, an escape inside a dependency's published code, behavior that depends on runtime data, and a test that asserts the wrong thing at full strength. Those are listed in the docs as limits. The last one is why mutation testing exists, and why I don't treat a green test suite as the end of the argument.

HOST: And what's left?

GUEST: Authentication and session security, which belong to your auth library. Authorization logic, which is your guards. Business logic. Infrastructure. Supply chain beyond what review can see, and review sees nothing inside a dependency's published code. An escape written on purpose. Personal data that isn't marked. Screen-reader behavior. Device behavior on native shells. And the library trust holes I described, until the grants land.

## 12. Head to head (minutes 72 to 77)

HOST: Head to head. I'll name a stack, you tell me what it does well, where you think Keel does better, and where you're behind. Versions from your notes only. React and Next.

GUEST: Our research notes read Next at 16.4.6 on the twenty-fifth of November. Next has the best agent surface of anyone right now: docs bundled in the package, a managed agents file in new projects, an MCP endpoint, markdown on every page, and a published evals page with its method and date. Its per-error pages, with ways to fix and a section on verifying the fix, are very good, and its data security guide is honest. Where I think Keel does better: our fixes are diffs from the same table the checker uses, and the checker knows more about the app, because Keel owns the route table, the boundary, the data marks and the policy. Next's evals report pass at four, an eval passes if any of four attempts does; we plan to report single-attempt rates beside that. Where we're behind: everything about ecosystem and maturity. Next has a huge user base and years of production. We have none.

HOST: Angular.

GUEST: Angular 22.3.0, read the same day. Angular's security page is the one I admire most. It lists residual risks plainly. And Angular is the enterprise choice for good reasons: one opinionated way, dependency injection, a CLI that generates structure. Keel shares that taste for one way. Where we differ is that Angular's DI is a form of action at a distance. A provider far up the tree changes what a component gets. Keel passes ctx explicitly. Behind: Angular's tooling depth, its long-term support and its hiring market.

HOST: Vue and Nuxt.

GUEST: Nuxt 4.7.0. Nuxt publishes a machine interface for its docs better than anyone: markdown for every page, an MCP server, a REST API, and a full text file of everything. Vue's single-file components are pleasant for people. Keel's view is that agents do better with one export per file and checked props than with a template language. Behind: Nuxt's module ecosystem, which its home page puts at over two hundred.

HOST: Svelte and SvelteKit.

GUEST: SvelteKit 3.4.0. The Svelte tutorial is the best in the business: four parts, in the browser, with a solve button. SvelteKit also moves focus after navigation and announces the title. Our router does focus the new page's heading too. Where we differ: Svelte is a compiler with its own language, and we chose plain TypeScript and JSX to stay in distribution. Behind: we have no tutorial yet. The walkthrough is three layers in.

HOST: Solid.

GUEST: Solid is where our reactivity comes from, and SolidStart, 2.2.3 in our notes, has a diagnostics reference with a page per named condition, which is close to what we want. Keel adds the declarations and the checker on top of the same model. Behind: Solid is used in production and we aren't.

HOST: Remix.

GUEST: Remix lives on as React Router, 8.5.3 in our notes. Its docs map tells you which of three modes each page applies to, which is clear writing. Loaders, actions and forms that work without JavaScript, that's Remix's idea and we took it. Where we differ: one mode, not three.

HOST: Ionic and Capacitor.

GUEST: We borrow Capacitor. It's the right way to put a web build in a native shell, and Ionic's component set is mature on mobile in a way ours isn't. What Keel adds is the outbox, the conflict flow and a shell ctx with storage and network drivers, so offline isn't a month of work. Behind: device testing. Our iOS proof is three runs on one Mac.

HOST: Laravel and Rails.

GUEST: The full-stack conventions frameworks. Rails proved that one opinionated way makes a small team fast, and Laravel's ecosystem is a model of how to grow one. Laravel calls itself agent ready and ships Boost, with tools and a large index of its docs. Our notes found no measured result on that page. Where Keel differs: we have no ORM, we put types and schemas at every boundary, and the checker enforces the conventions instead of a book teaching them. Behind: decades of production, hosting, queues, mail, admin panels, and people.

HOST: And the measured comparison? An agent building the same app in Keel and in an incumbent stack?

GUEST: Planned, as the head-to-head workstream. The harness exists, and Codex has built one app through it. The three pairs against the comparison list aren't run, and the result has to carry a date and versions. So today, any claim that agents build faster in Keel is a goal, not a finding.

## 13. Quick-fire (minutes 77 to 79)

HOST: Quick-fire. Short answers. Is the runtime queryable?

GUEST: Yes. In dev, an inspect endpoint returns the state, the dependency graph, the render tree, the accessibility tree and the transaction log. Keel inspect summarizes it.

HOST: MCP and language server?

GUEST: The command line serves both, one engine, one MCP tool per operation.

HOST: Errors in production?

GUEST: One mode decides what a person sees. In production an unexpected error shows as the code unexpected with empty data. The observers still get the full error.

HOST: Escapes review?

GUEST: Keel review lists every escape in a range, by name or by shape, with a danger level. Only a person can accept one, in its own change.

HOST: Static sites?

GUEST: A static deployable prerenders one file per route and fails on any route that doesn't answer 200.

HOST: Geolocation?

GUEST: A stdlib package. The recipe box finds the nearest market and its test asserts the position was sent nowhere.

HOST: Opaque tokens for APIs?

GUEST: A tokens package mints two hundred fifty-six random bits as a Secret with a SHA-256 digest and checks in constant time. Keel hashes no password.

HOST: Health checks and timings?

GUEST: Stdlib packages, used by the recipe box.

HOST: Production monitoring?

GUEST: Tallies from production land on the ledger as monitored. Eight items today.

HOST: Dark mode?

GUEST: The brand tokens define one light scheme. An app can write its own tokens. A second scheme isn't on any list yet.

HOST: WebSockets?

GUEST: Channels are server event streams. Two-way sockets and collaborative text editing aren't built; collaborative editing is in the future file.

HOST: Windows?

GUEST: Windows CI is in the future file.

HOST: Global keel binary name?

GUEST: Another product already ships one. Choosing ours before npm is a decision for a person.

## 14. The honest state and the road to public (minutes 79 to 82)

HOST: Close it out. Built and proven, built but needs work, not yet realised. Give me each.

GUEST: Built and proven: the kernel's reactivity model, stores, router and contracts, forms and schema, the server, ctx and simulation, the boundary, topology and deploy, the checker and its diagnostics, the accessibility checks, the content security policy, the pii and secret rules within their stated limits, the evidence bundle, and most of the stdlib at example level, with two golden apps, a household app and a client-only walkthrough built on it. By the status lines on the twenty-fifth, seventy-three of the kernel's eighty-three section files and thirty-eight of thirty-nine stdlib sections say conformance-covered. The handoff file counts kernel sections differently and says seventy-eight of seventy-nine, so the two files disagree, and the sweep has to settle it.

Built but needs work: the library format and its trust holes; workflows; the module section's status; tier-one mutation scores under ninety; the release gate itself, which hasn't passed once on the main line; agent convergence from public docs; the install path; and the paper cuts from both reviews.

Not yet realised: the app-side capability grant, on the main line; a library's own look; end-to-end tests for app authors; the kernel freeze flip; the site, built in Keel, with every number read from the evidence file; the guides and the generated reference; the head-to-head results; the outside accessibility audit and penetration test; npm packages with provenance.

HOST: What's the bar for going public?

GUEST: The list says it in one sentence. Keel goes public when a serious engineer, an auditor and a first user can each push on it and it holds. Correctness first: a wrong program doesn't pass keel check, a claim on the site is a number CI produced, and a gate that flakes is a defect. And nothing is cut from the kernel or the stdlib to get there.

HOST: And after that?

GUEST: A fresh public repository from one commit of the swept tree. Packages on npm at 0.x with provenance. The site live. An outsider building an app from the docs. Then 1.0, after four weeks with no kernel semantic change.

HOST: Last question. What's the next thing you'd fix, if you could only fix one?

GUEST: The gate. Every other claim I made today rests on CI being green on the pushed head, and today it isn't. After that, the install path, because a framework nobody can install is a design document.

HOST: Thanks for not selling it.

GUEST: Thanks for pushing. Come back when the gate is green and ask me all of this again.
