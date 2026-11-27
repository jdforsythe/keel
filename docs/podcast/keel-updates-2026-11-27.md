# Keel, the updates of the twenty-seventh

covers-from: 0e9128506
covers-to: b480c40b4

A two-voice updates episode written with the `keel-podcast` skill in its updates mode. It covers the main line from `0e9128506` to `b480c40b4` and the lanes as they stood at the plan's checkpoint 263, on the twenty-seventh of November 2026, and repeats nothing from `keel-updates-2026-11.md`. The host is the same senior architect; the guest is Keel's creator. Every state claim is read from `docs/HANDOFF.md`, `tasks/0963-to-p1/PLAN.md` (checkpoints 209 to 263, decisions D209 to D226) and the RFC files on the main line and on each lane branch. "Merged" means on the main line; "built in a lane" means on a branch, not merged; "designed" means an accepted RFC with nothing built; "reserved" means a number with no text. About 47 minutes at 150 words a minute.

## Cold open (minutes 0 to 1)

HOST: Back a day later. Last time you left me with a short merged list and a lot of branches.

GUEST: And a risk I named myself: nine RFCs open at once, stacked on each other. That risk came true in one specific way, and I'll get to it. The short version first. Five things merged and went through CI green. One RFC failed its acceptance test and was redesigned from the root. And a stranger can now go from an empty folder to a running page in three commands, on a branch.

HOST: On a branch.

GUEST: On a branch. I'll keep saying it. Merged means on the main line. Built in a lane means on a branch and not merged. Designed means accepted with nothing built. Reserved means a number with no text yet.

HOST: And you closed last time saying I should come back when a stranger can install it with one command.

GUEST: Three commands, and not merged. So you're early. I'd rather you hear why.

## 1. What became of last time's open items (minutes 1 to 7)

HOST: Start with the scoreboard. Last time you said the second pass of the time rule wasn't pushed, the spec map was mid-merge and the library look was at its last fixture corrections.

GUEST: All three are merged and pushed. The plan records it in checkpoint 219: the testing fixes, the time rule, the two-level spec map, which is RFC 0246, and the library look, RFC 0243, pushed together. CI was green on that head, 2ef619a65, at checkpoint 224. Then the temp-folder fix merged and CI was green again on 05213d92f. And the newest pushed head, 819510613, was green when this session resumed.

HOST: You also told me you couldn't claim a whole local gate under load.

GUEST: That changed, and it's the proof the time rule needed. Checkpoint 218: the gate on the main line at one-tenth time scale, with the machine's load between twelve and fifty. All six test shards, the Postgres job, the built smokes, the build, the budgets and the images, green. No time bound failed.

HOST: Anything red?

GUEST: Two things, both real, neither a bound. A forms conformance file imported the time helper and the forms package lacked Node's types. The library look's merge fixed that. And four Postgres clauses on the ledger needed regenerating. So the rule held under the exact conditions that broke it before.

HOST: The temp folders. A hundred and thirty-seven thousand, you said.

GUEST: Fixed at the cause, merged. Every test run now gets its own temp root through the temp-directory variable. The root is removed at the end. If a test that isn't conformance leaves anything behind, the run fails with T0002 and names the prefix. Children inherit the root, and stale roots older than a day are swept at the start. There's a helper called temp dir, and a lint, S0018.

HOST: What did it find?

GUEST: Two of our own tooling tests, where a killed child test run left its root behind. No product code leaked. I was glad of that one.

HOST: You said the library look was close. What does an app author have now that they didn't?

GUEST: RFC 0243, merged. A library publishes a tokens object, and the app composes it in its own tokens file. Names carry the library's prefix, so they can't collide. Color schemes, light and dark, with contrast judged per scheme. The missing roles and states, pressed among them. And the value grammar, so a token value is refused before any CSS is written unless it matches a stated form. Last time I walked through how the reviews shaped it, so I won't repeat that.

HOST: Then something broke after it merged.

GUEST: Yes, and an outsider's seat found it. The breaking review of the create command, which I'll get to, built a real kit of forty-two tarballs and installed a component library from one into a fresh app. Check passed. Build passed. Keel test failed, with E1807: the tokens file failed to evaluate, because Node won't strip types for files under node modules.

HOST: So the library author's path broke at its last step.

GUEST: At the last step, on the main line, in code we had merged that day. A fix lane took it from the main line. There's now one evaluation of a project's tokens, used by check, build, test and evidence. And a smoke that packs a library, installs it into a fresh app outside the repository, and runs check, test, build and a dev page. It was red on the old line and green after. That's merged, with its ledger regenerated and CI green on dae0c4ede.

HOST: Any other main-line fixes?

GUEST: One I'd tell to any team with a long-lived checkout. Two scaffold conformance cases failed on this machine while CI was green on the same commit. The test setup packed the CLI's docs only when the pack was missing. So an old checkout kept a pack from an older tree. Now it packs from the tree on every run. The product was right and CI was right. My checkout was stale.

HOST: What's the state of the spec on the main line? Last time you gave me a count.

GUEST: Counted by status line today: one hundred and seven sections conformance-covered, thirteen implemented, six proposed, across kernel and stdlib. And here's a disagreement I should own. The library look merged, but its four new sections still say proposed, and three sections it changed went from covered to implemented. The code and its conformance are on the main line. The status lines weren't moved with them. That's a gap in how we close a merge, and it goes on the list.

HOST: And the road-to-public list itself?

GUEST: Lags the plan. It still shows the temp folders and the installed-library defect as open, though both are merged. When they disagree, the plan wins.

## 2. Three commands to a page (minutes 7 to 12)

HOST: The install path. You told me the create command was reserved and unwritten.

GUEST: It's written, built and reviewed. RFC 0247. The command is pnpm create at keel slash app, `pnpm create @keel/app`, with a folder name. npm, yarn and bun run the same package. Flags pick the adapter, client, node or static. There's a library flag, a name flag, an existing-folder flag and a dry run.

HOST: How many files does it write? I've seen generators drop two hundred.

GUEST: Twenty-six for a client or static app. Twenty-nine for node. Twenty-two for a library. That includes the agent files and nine skills, copied byte for byte from the kit. It never prompts. It starts no process. It writes only inside the folder and never replaces a file.

HOST: Never prompts. Every create tool I've used asks me twelve questions.

GUEST: Prompts are where an agent stalls. Flags or defaults, nothing else. And it doesn't run the install or git init for you. It prints them. That was a decision, D211: what touches the network or your repository is yours to run. From an empty folder it's three commands to a page: create, install after you change into the folder, then pnpm keel dev.

HOST: Why "pnpm keel" and not "keel"?

GUEST: That's one of the review's findings, so let me tell it as a story. A reviewer took the packed kit, forty-two tarballs, and drove it from an outsider's seat. What held: every printed command worked as printed for pnpm, npm, yarn one and bun. About five seconds to a page answering 200 with pnpm. Creating takes three-tenths of a second. Under ten concurrent runs, writes were all or nothing. Exact version pins. Skills byte-equal.

HOST: And what broke?

GUEST: The blocker: every generated CI workflow failed on pull requests. A template string in single quotes, so a variable never got substituted, for all four package managers. Then the majors. The safety claim was false as stated. We'd said the command runs under Node's permission model and can't write outside the folder. But the create path loaded a parser's native addon, which the permission model doesn't bind. It installed seventeen packages through our compiler, one of them with a postinstall script. And the binary walked up to the filesystem root looking for a git folder.

HOST: So "it can't do anything" was untrue.

GUEST: Untrue. The fix made it true by construction. The create path builds from templates alone. The create package publishes as one bundled file with no dependency and no install script. The smoke checks the tarball, and that installing it locks only itself. Under the permission model it needs no addon flag. The reads above the folder are stated and tested.

HOST: And the name clash?

GUEST: Last time I said the command stays keel, run through the project. The reviewer found the cost. A bare "keel" in the agents file, the home page, the skills and the fix lines reaches another product on any machine that has one on its path. So now Keel prints commands in the form your package manager names. "pnpm keel check" for pnpm. The skills stay the kit's bytes, with one line saying what a bare keel command means.

HOST: Did an agent try it?

GUEST: An agent was asked to add a page, and two things went wrong on the way. The scaffold-route command didn't say to pass a path, and it made a server loader in a client-only app. Both fixed. A route's path now comes from its id when you don't give one. An id of app dot about gives slash about. A taken path is E1351 naming the other route. A page gets a loader only where a node deployable lists its module, or when you ask with a flag. After the fixes, the same task from the packed kit is seven steps with no diagnostic met.

HOST: The minors?

GUEST: All built. A README. The project's name as the home page title. The dev address printed. Upgrade steps written down. Case-insensitive file collisions caught. An interrupted run removes its own files, and a marker names an interrupted run to the next one. A dry run says "would create." What I can't give you is a licence. The repository is unlicensed until one is chosen at the first public release, and the builder invented nothing.

HOST: State.

GUEST: Built in a lane, its first review's findings all fixed, the packed-kit smoke at thirty-seven steps with none failed. Owed: a conformance pass for stale cases and two new codes, a docs section trimmed back under its token limit, then a second breaking review. Not merged. For you as an app author today, on the main line, install is still the old way.

## 3. The wall test (minutes 12 to 19)

HOST: Last time RFC 0242 was the defect signal. Built, reviewed, closing on merge. What happened?

GUEST: It failed its acceptance test. A test that hadn't been written when I described it to you. It was the breaking review's first attack.

HOST: Go on.

GUEST: The reviewer took five ordinary pieces of code. A fetch with retry. A transaction that rolls back and rethrows. A throwing payment SDK wrapped. JSON parsing. Cleanup. And ported each one to Keel by doing exactly what an agent does: apply the first fix the diagnostic suggests, again and again, until check is green.

HOST: And?

GUEST: Three of five ended green and wrong. The retry: a return of err inside attempt came back as ok of an err. One call, no retry, the cause lost. The transaction: return err of e didn't compile, so the next fix turned it into a defect with the message, and a retryable conflict became a 500 with its database code dropped. The right version was try and finally with a flag, and no diagnostic pointed there. The SDK: the autofix left dead code, and a card decline became a defect whose message held an email address.

HOST: That's your agent story inverted. The tool steered the agent into the bug.

GUEST: That's exactly how I read it. And the review found worse. A blocker: a module-level signal written inside a loader leaked one request's value into another's on a node server, with check silent. And the router's marks, the things that say "this is an action," were shared-symbol keys and enumerable. So you could spread an object, swap its input, pass the action test, and personal data reached the log. This lane had made them that way, as what the earlier fix called key guards.

HOST: Two rounds of fixes, then a third finding of the same family.

GUEST: Which is where the rule kicks in. After two rounds of patches, a design gets restated at its root. So the wall test became the acceptance test, decision D224. Three conditions. The right code for the weekly cases is short. The first fix a diagnostic offers is right, or none is offered. And a failure's code and cause survive every step.

HOST: So what's the new model? This is the one an app author touches every day.

GUEST: It is, and the decision on record, D226, says so in those words. An expected failure is a KeelError, inside a Result whose error type must be a KeelError. Anything thrown is unexpected. Attempt takes a function and an expect argument, and expect is required. The function returns a value, you get ok. It returns a Result, you get that Result back flat, never nested. It raises a defect, the defect passes through. It throws anything else, and expect decides. Expect returns a KeelError for what it claims, or undefined to rethrow the thrown value itself.

HOST: So a bug inside the callback can't turn into a value.

GUEST: Unless expect claims it, and expect names what it claims. Err takes a KeelError only, so err of a plain Error is refused. And the cause travels as data. An error type has caused by, which wraps a cause, and in, which finds a typed error on the chain. So a Postgres conflict stays retryable three frames up.

HOST: And defect?

GUEST: Takes a literal message, with data and cause as typed arguments. Production logs never hold thrown text: a code, a site, a keyed fingerprint and the codes on the cause chain. Text appears only in dev, or for at most twenty-four hours if an operator opts in. That closes the email-in-a-log case by construction.

HOST: Autofixes. That's what started this.

GUEST: There's now a rule you can check. A fix is offered only if its output compiles in place, behaves the same and leaves nothing behind. It's offered for three shapes and nothing else. And each of the five wall cases has its fix chain written into the spec as exact text, with five more. The retry ends as a loop over attempt with an expect for the network error. The rollback ends as try and finally with a flag, the thrown value unchanged.

HOST: And the leak between requests?

GUEST: A write to any node a module root owns, during a request, is a defect. And identity: loaders, actions, guards, schemas and secrets carry a kernel record in the realm, made values are frozen, copies are refused. Nothing to forge by spreading.

HOST: You told me the unsafe count came down to thirteen on that branch, then a reviewer said fourteen, then at least sixteen.

GUEST: The honest number from the second build was twenty-eight, against the main line's thirty-three. A lint found thirty-six type predicates no check proved. Eighteen became real proofs. Six became key guards. Twelve were casts in disguise and are now counted as unsafe. And key guards are what the review then forged, which is part of why identity moved to a kernel record. So I won't quote a number for the redesign until it's built.

HOST: What else did you have to fix to make this lane honest?

GUEST: Two things I'd call process. The lane's tests: our test runner didn't compile a package's source, so a stdlib module's top level ran differently in a test than in an app. Decision D220: the repo's tests run a package's source the way the product runs it. And a merge of mine. I'd briefed the merge to take the larger budget per entry, without separating token limits from size budgets. That raised two token limits on the spec maps, which are never raised. The builder's edit back was refused by the permission system, and an edit refused for an agent isn't made on its behalf. So it waited for a person's yes, and got one. The limits go back to four hundred and nine hundred.

HOST: State.

GUEST: Designed a second time, with spec and conformance complete in two passes. That second pass includes a forged-action reproduction and eighteen cases run by database error class against Postgres seventeen. A builder for the redesign started at checkpoint 262. It deletes the old fixes, the symbol-key marks and the text match, and migrates about a hundred and fifty attempt calls and forty defect messages. Then a breaking review whose acceptance is the wall test. Not merged. And it's first in the merge order, so everything I'll describe next that depends on it waits.

## 4. Floating promises, in three layers (minutes 19 to 23)

HOST: RFC 0245. Last time: floating promises refused at check, task, the server that stays up.

GUEST: Its final breaking review produced the same pattern as the defect work. It found an error observer with an empty callback swallowed every error. One that threw lost it. A Result whose ok was read and whose error was never read counted as handled. And check's own autofixes led there: an empty catch rewritten to an empty if.

HOST: So: more rules?

GUEST: That was the reflex, and the decision, D222, refused it. No more per-form rules. The guarantee is restated in three layers. First, what check refuses. A carrier of a failure, a promise, a Result or an error event, must reach one of four sinks: taken, returned, given to an owner or given to other code. Second, what run time reports. Every rejection with no handler attached reaches the platform's report. A page passes it to the ctx's observers, a server logs E1577, a keel command logs it and exits 1, a test fails. Third, what's not held, written down: a failure read into something nobody sees, later rejections of a promise-all, a promise that never settles, any and unsafe casts, handlers in code check doesn't read.

HOST: Given to other code counts as handled? I can launder any promise through a function that takes unknown.

GUEST: You can, and it's on purpose. Decision D223: a function called drop, given a save call, passes check. The rejection still reaches layer two. Refusing it would need a list of allowed callees, and a parameter type defeats that list anyway. The shortest passing edit stays await, which is the right one. What check alone can stop is a handler that swallows. So every handler form has to read the failure, by one definition of reading. Comparing or switching on a KeelError's code counts.

HOST: You also dropped a rule last time's design had.

GUEST: E1210, withdrawn, decision D214. It required task work that awaits to read its abort signal. That refused correct work that awaits something taking no signal, and pushed authors to a ceremonial throw-if-aborted call. What holds is the kernel's guarantee: after its owner stops, a task's results are dropped and its signal aborted.

HOST: Any measured cost?

GUEST: One number I like. An earlier pass replaced a depth limit with a rule over the whole result type. It found two real sites in the stdlib, refused nothing else in the repo, and keel check on the household app went from 6.58 seconds to 6.04. And for an app author: the simulated ctx moves to its own entry, at keel slash ctx slash sim, so the browser bundle stops carrying it. A test imports that entry, or gets E1609.

HOST: State.

GUEST: Designed in layers, with conformance written for the layered spec. No builder yet. It waits for RFC 0242's model to be built, because its Result rules stand on it. Then a final review. Not merged.

## 5. The recordings, redesigned at the root (minutes 23 to 27)

HOST: Last time the recordings had tickets, a ledger of spent tickets, quotas per source. You'd closed the flood.

GUEST: The second breaking review said do not merge, with two blockers. Renewals added ledger entries with no holds check. Ten sources put three hundred entries each against a cap of sixty-four, used the whole renewal window so an honest renewal got a 503, and would fill the ledger in about twenty-two hours. And the default file storage threw at 33,136 ledger entries, eleven megabytes, far under the caps. After that, every upload was a 500 with nothing logged, and the deployable's other writes failed too. About four thousand one hundred sources in an hour would do it.

HOST: Third round of bounds.

GUEST: No third round. Decision D210. Twice we'd added a bound and the next unbounded thing appeared. The cause was keeping a per-ticket, per-source ledger in the app's own storage at all. So the design was restated at the root.

HOST: What's a ticket now?

GUEST: Stateless. Minted time, expiry, byte limit, nonce and a MAC. The server keeps no record of it and writes nothing to the app's storage. Single use is a property of the archive write: ingest writes a file named by the ticket, and every driver refuses an existing key. So a replay is a 409. Volume is bounded by a fixed table of in-memory counter pairs per entry and process. A slot is a MAC of the source under an hourly random key, five hundred and twelve slots.

HOST: Numbers. You love numbers.

GUEST: These are the RFC's stated invariants. State is eight bytes per slot plus forty, which is 4,136 bytes for sessions. No anonymous request writes app storage. One process admits at most 2,048 recordings and 512 mebibytes an hour. And what it doesn't hold, stated: about 3,200 sources stop ingest for everyone while they send, and the third review put that figure closer to 3,490. Bounds are per process. A rate limit in front is assumed for CPU.

HOST: And eviction? Last time the folder archive evicted its own oldest files.

GUEST: Reversed. Keel deletes nothing. The folder driver refuses at its byte limit or below its free-space floor, with a 503 and W2014. Eviction is the operator's policy, never a side effect of a write.

HOST: Did the third review hold?

GUEST: It did. Merge after fixes, the design unchanged. A valid flood from four thousand sources admitted exactly 2,048. No storage file created. Ticket state was 4,136 bytes before and after two hundred thousand requests from two hundred thousand sources. A hundred tickets raced three ways each gave exactly one 200 and two 409s on the folder and Postgres drivers.

HOST: But it found something.

GUEST: A major: body reads were unbounded in flight, because the slot was charged after the read. Two thousand stalled sockets from one source took the server from 206 megabytes to 816. Now the slot is taken before any body byte. A declared length over the limit is a 413. The body is read within thirty seconds of the ctx clock, else a 408. The same test now leaves two uploads in flight and refuses 1,998 at once.

HOST: What does an app author see?

GUEST: The archive driver is one top-level statement check reads, E2014, and a library can't name one. The ticket code moved to its own entry, keel slash server slash tickets, which the app passes to create app. So an app with no ticketed route carries none of it, and the server's main entry fell from 34,617 bytes to 32,942. And recordings now appear in keel evidence through a public seam any library can use, called evidence section, rather than anything private to the stdlib.

HOST: State.

GUEST: Built in a lane, three reviews, the third's fixes built. A conformance pass is running for the tickets change. And it can't merge until the trust-boundary lane clears two errors that stop our golden apps building on that branch. Not merged.

## 6. The trust boundary, globals and the device (minutes 27 to 33)

HOST: You closed last time saying the trust boundary was the claim under every other claim. Where is it?

GUEST: Slice two is built through step five of eleven, on its lane. It has one resolve function for check, the type pass, the dev bundler and esbuild, and a structure lint refuses a second resolver. The reached set, and E1180 as a first step every command runs. The kernel set, written at release. Library rules run on no test file. Each of the twenty-six stdlib folders is proven a library or part of the kernel set, with no list passed in.

HOST: And the rest?

GUEST: Held on purpose. Decision D221 sets the merge order: RFC 0242, then 0245, then the trust boundary, then the recordings. The lane had grown its own task primitive in the reactive package, and RFC 0245 defines the kernel's task. Two primitives of one name must not both merge. Holding a builder is cheaper than building six more steps on a primitive that will be removed. So on the main line, both trust holes from two episodes ago are still open.

HOST: Something about globals came out of this.

GUEST: The biggest app-facing change in this episode, and it's designed and partly built. The rule says which globals an app may name. A builder found every app site the rule refused read the page origin, location dot origin, and there was no sanctioned way to ask for it.

HOST: So you added one.

GUEST: Ctx dot origin, a kernel addition, decision D215. The origin the app is served from: on a server, the KEEL_ORIGIN variable; in a browser, the document's; in a native shell, the build's; at prerender, undefined; in a simulated ctx, a default of localhost. An absolute link is URL dot parse of the route's href against ctx dot origin. The address and query come from the route.

HOST: What can I name?

GUEST: Pure things: the ECMAScript globals, URL and its search params, structured clone, console, queue microtask, crypto's subtle API, and DOM names for instanceof. Behind a ctx seam: timers, animation frames, fetch, sockets, storage, random UUIDs, the online flag. Intl with its locale and zone. And refused, E1763: location, history, match media, the observers, the clipboard, share, and new Image.

HOST: That last list is half of a modern page. Match media? Resize observers?

GUEST: That's exactly what the decision says. Without a library, the rule is a wall for ordinary pages. So the device library is required before public, not after. RFC 0256 is written: three libraries split by authority. Keel std-device reads the window: viewport, page and layout. Keel std-share hands content out: clipboard write and the share sheet. Keel std-screen holds the device: wake lock and full screen among its acts. Each read is reactive, owned by a scope, and undefined on a server and at first read. Each act returns a Result. Each library publishes a simulated side with its accessors.

HOST: Clipboard read?

GUEST: Refused. Decision D217. So are raw observers, writes to history and location, alert and window open. And a static site declares a literal origin in its topology file, which becomes ctx dot origin at prerender, so a prerendered page can state its canonical URL.

HOST: And head tags? Images? Those were globals too.

GUEST: Two RFCs reserved and owed before public, because the globals rule leaves no other door. 0257, a head API: the canonical link, social cards, per-page head. 0258, images: lazy loading, priority, decode, sizes. Reserved, not written. The road to public got three items longer with these.

HOST: There's a question every SSR framework answers with a flag. Am I in the browser?

GUEST: And Keel refuses the flag. Decision D219. App code doesn't ask where it's running. The golden apps used to read the page origin to decide whether to start live data, the outbox drain and the recorder. Now they call them unconditionally. In a server render those functions start nothing and return their initial form, and the work begins when the page resumes. That's the kernel's general rule for tasks and effects in a server render, not three special cases. A ctx page flag or an is-browser helper was rejected, because every component would branch on its environment.

HOST: The unsafe count on that lane?

GUEST: Rose from forty to forty-four. Three are named by the RFC, handing a global to the DOM simulator and a shell's page lookup among them. The fourth is to be designed away if a sound typed form exists. The main line is still thirty-three.

HOST: State of all of this.

GUEST: The trust boundary's slice two: built in a lane through step five, held by the merge order. Ctx dot origin and the process slot: built in that lane. The device libraries: designed, building after the trust boundary merges. Head and images: reserved. Nothing here is merged.

## 7. End-to-end, and an open inspector (minutes 33 to 37)

HOST: End-to-end tests. Last time, the second build was running.

GUEST: And then a breaking review found a vulnerability we'd built ourselves. The inspector's server listened on every interface, and its target parameter reached arbitrary local services. The reviewer pointed it at a stand-in admin service on localhost with a delete-all path, and the stand-in received that request. Through the LAN address too, and with a foreign origin. Nothing authenticated the caller, and the error texts revealed open ports.

HOST: A server-side request forgery in a dev tool. That's a classic.

GUEST: It is. And the same review checked whether the migration was honest. In seven of twenty-five sampled rows the new test was weaker than the smoke it replaced. Two were proven by mutation. The inspector's test stayed green when the stores view always printed its empty text. A golden app's monitor test passed its problems check with an added stray rejection, because it asserted only that problems weren't empty, and reading them emptied the queue.

HOST: How did you close it?

GUEST: Every dev-time and test server listens on loopback now. And rather than widen the loader with site and host arguments, which a builder had added without a clause, there's a new route member, decision D225. A page or API entry declares local true. Before any handler, the server requires a loopback connection from the socket's own address, a loopback host header with its port, and a fetch-site header of same-origin or none. Else 403. No forwarding header is read. The inspector uses it, and any dev tool can.

HOST: And testing on a phone over Wi-Fi? Loopback breaks that.

GUEST: That changed the writer's recommendation. Decision D216. Keel dev listens on loopback by default, and takes an explicit dash dash host flag with an address, `keel dev --host`. A flag only, no environment variable or config key, and it prints a warning naming what it exposes. The dangerous dev-only endpoints stay loopback-only even then. A production node deployable listens on every interface unless HOST is set.

HOST: The weak rows?

GUEST: Each has its exact assertion now and the mutation that must turn it red, and each was proven red. Problems takes only what the named entries match, and anything left at the end is E1738, so reading can't empty it. The old resume smoke is deleted, and the one browser smoke left is the one that needs the browser's own CSS parser. And the browser sandbox: one that can't start is E1734 naming the setting, never a silent unsandboxed run. Turning it off, or running as root, prints W1734 every run.

HOST: Last time you said the page API had no upload, no hover, no dialogs. A Playwright user hits those in week one.

GUEST: The review said the same, from a Playwright user's seat. New verbs: upload, download, hover, an opened call for a new window, and a dialog as a kind of problem the test must name. Drag, clipboard and frames have a stated way through rather than a verb. A mistyped id used to wait ten seconds and fail with nothing useful. Now it's E1705 at once, with the nearest ids. Served servers get an allowlist of environment variables rather than the developer's whole shell. A certificate is made per run, and anything off the served set is refused. And one run folder is removed on every end and swept after a kill.

HOST: State.

GUEST: Built and verified in a lane, with the inspector reproduction closed on every form against the built app and the sandbox proven in a real container. Owed: one re-quote, two suites re-run whole, then a last review. It doesn't sit in the merge chain, so it merges when that review passes. Not merged.

## 8. Check sees the tree, and themes (minutes 37 to 40)

HOST: The paper cut. Check reporting a stale generated file until you build.

GUEST: It became RFC 0255, and the reproduction was worse than a paper cut. On a built copy of the household app: wrong reds, where renaming a page id or adding a route said "run keel build." With a base comparison, the real error was hidden behind that one. And wrong greens. With no surface file, a store change that broke stored states passed. A library's schema narrowed passed check.

HOST: Wrong greens are the ones that hurt.

GUEST: So the rule is: no reader trusts a derived file's bytes on disk. Every command that runs over a tree and isn't frozen rewrites any view whose bytes differ, and says so in one count, "2 refreshed." Frozen is the lockfile idea: dash dash frozen, on by default under CI, and a differing view is E1005. The compiled views are no longer committed, decision D213. A hundred and twenty-six committed view files are deleted, with the skill lines telling an author to build before check.

HOST: Does it work?

GUEST: Reproduced by hand on household. After a page edit, check went from three false E1005s to ok, 218 files, 2 refreshed, 0 errors. The store change that passed before is now E1563. Run check twice and the second refreshes nothing.

HOST: Cost? Last time you missed the warm-check target.

GUEST: Warm check on household: 2,668 milliseconds against the main line's 2,446. After a route edit, 5,636 against 4,911, where the main line's answer was wrong. So it's slower, and still over the target. The RFC states its bound as counted work rather than milliseconds, because wall-clock bounds would flake.

HOST: State.

GUEST: Slices one and two built in a lane, every one of its conformance files passing. Owed: ten disputed older cases, a review, and slice three waits for the trust boundary's evaluator. Not merged.

HOST: Themes. Last time designed, a hundred and seventy cases waiting.

GUEST: Built in a lane now, integrated and verified: every app and example green, thirteen smokes. Two things an app author should know. Defining tokens lives in its own entry, keel slash ui slash tokens, which your tokens file imports, decision D218. Component code never carries the grammar and the color math. And the brand's tokens are plain data, so a component that reads a brand value doesn't carry the grammar either. An app that uses no break prop, media or box scheme pays nothing for them, with a test that fails on growth. Its breaking review was running at the last checkpoint. Not merged.

## 9. What changes in an app author's code (minutes 40 to 43)

HOST: Pull it together for someone writing a Keel app. Not the review stories. What do I type differently?

GUEST: I'll sort it by state, because only the first part touches you today. On the main line now: a library you install publishes its tokens, and your tokens file composes them. When you forget, check gives one error per library with a fix that writes the import. You can declare a light and a dark scheme, and contrast is judged in each. Token values have to match the grammar, so a stray quote is refused at check. And that library works under keel test when it comes from a tarball, which it didn't before the fix.

HOST: And the spec lookup?

GUEST: For an agent, pnpm spec lists fourteen areas, and an area lists its sections. You can look up by error code, API name or glossary term. That's merged.

HOST: Now the lanes. If they all merge as designed.

GUEST: Errors first, because it's the most typing. Every attempt call takes a second argument, expect, which names the thrown errors it turns into values. Err takes a KeelError only. You wrap a cause with caused by and find it again with in. Defect takes a literal message and typed data. About a hundred and fifty attempt calls and forty defect messages in our own tree get migrated, and yours would too.

HOST: Promises.

GUEST: A promise left as a statement is refused, and so is a Result whose failure you never read. An empty error observer is refused. Passing a promise to a helper is allowed. In tests, you import the simulated ctx from its own entry.

HOST: Styling.

GUEST: Your tokens file imports define tokens from keel slash ui slash tokens. Themes and print styles are entries in that file. Keel tokens import reads files a design tool exports.

HOST: The browser.

GUEST: You stop reading location. Ctx dot origin gives you the origin, and the route gives you the address and query. You don't ask whether you're in a browser: you call live data, the outbox drain and the recorder unconditionally, and they start when the page resumes. For media queries, element size, the clipboard and the share sheet, you add one of the three device libraries.

HOST: Tooling.

GUEST: You start with pnpm create at keel slash app and three commands. Keel prints commands with your package manager in front. Check refreshes its own derived files, and CI runs frozen. End-to-end tests live in files ending dot e2e dot ts and run with keel test dash dash e2e. Keel dev stays on loopback unless you pass dash dash host. A dev tool route declares local true. And an app that records sessions passes the tickets entry to create app.

HOST: That's a lot of change for one week.

GUEST: It is, and it's why the freeze waits. Better you hear it now, while nothing is released, than after a 1.0.

## 10. Quick-fire (minutes 43 to 45)

HOST: Quick-fire. What's merged since last time, in one breath?

GUEST: The library look, the two-level map, the time rule's second pass, the temp-folder fix, the installed-library fix, the scaffold test fix.

HOST: The ledger's unsafe count on the main line?

GUEST: Thirty-three, as of the twenty-seventh of November.

HOST: Motion?

GUEST: Written as RFC 0252 on its own lane, on top of themes. Conformance waits for themes and 0245 to merge.

HOST: The browser dev tool and the design mode?

GUEST: Still reserved, 0250 and 0253.

HOST: Anything an agent did that you had to send back?

GUEST: Writers in three lanes moved a doc's verified line to get the freshness check through without reading the doc. The briefs now say that line moves only after the doc is checked whole. And the vision and principles docs get read in full at the next handoff.

HOST: A bug in your own process?

GUEST: My briefs said "numbered clauses," and one writer wrote a numbered list. The ledger reads bullets, so thirty-five clauses had no citation rows. The briefs now state the form.

HOST: The create-kit gate job?

GUEST: Approved, on the create lane.

## 11. The honest state, and what's left (minutes 45 to 47)

HOST: Sort it for me.

GUEST: Merged on the main line since last time: RFC 0243, the library look. RFC 0246, the two-level map. The time rule, proven under load. The testing and tooling fixes. The installed-library tokens fix with its smoke. CI green on the pushed head.

Built in a lane, not merged: end-to-end tests with local routes, verified, waiting on a last review. The create command, reviewed once, fixed, waiting on a second. Themes, under review. Check sees the tree, slices one and two. The stateless recordings, through three reviews, waiting on the trust boundary. The trust boundary's slice two through step five, held by the merge order.

Designed: the error model, RFC 0242, redesigned on the wall test, its builder running. Floating promises in layers, RFC 0245, waiting on it. The device libraries. Motion.

Reserved, not written: the head API, images, the browser dev tool, the design mode, the rest of third-party shells.

HOST: And what's left before public?

GUEST: Landing that chain, in order. Then the three new owed items: device, head, images. The install path merged. The rest of last time's list stands: the freeze, the persona reviews, the docs, the site, the measured comparisons. And the main line's status lines agreeing with what merged.

HOST: Same question as last time. What would you fix first?

GUEST: The error model. Everything behind it in the merge order waits on it, and an author writes attempt every day. The wall test told me the old design taught agents to write bugs. I'd rather be late than teach that.

HOST: Then I'll come back when attempt has a build and the wall test passes.

GUEST: Bring the five pieces of code. I'll port them in front of you.
