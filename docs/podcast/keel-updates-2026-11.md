# Keel, the updates since the deep dive

covers-to: 0e9128506

A two-voice updates episode written with the `keel-podcast` skill in its updates mode, from the main line and the open lanes of the twenty-sixth of November 2026. It covers only what changed after `keel-deep-dive.md` and what that episode left out. The host is the same senior architect; the guest is Keel's creator. Every state claim is read from `tasks/0963-to-p1/PLAN.md` (checkpoints 126 to 209), `tasks/p1/TODO.md`, `tasks/p1/end-user-review.md` and `tasks/FUTURE.md` as they stood that day. "Merged" means on the main line; "built in a lane" means on a branch, not merged; "designed" means an accepted RFC with spec text and nothing built. About 56 minutes at 150 words a minute.

## Cold open (minutes 0 to 2)

HOST: Last time, your closing line was "come back when the gate is green." I didn't expect to be back this soon.

GUEST: Neither did I. The gate went green the next morning. The whole release gate passed on this machine for the first time, and CI has since been green on the pushed head three times. It also went red several times along the way, and those failures taught me more than the pass did.

HOST: A quick recap for anyone who skipped the long one.

GUEST: Keel is a full-stack TypeScript framework designed for code that agents write. One way to do each thing, a checker that returns errors with the fix attached, and a ledger that says how strongly every claim is tested. Last time I said a lot of it was built and tested, the release gate had never passed, an outsider couldn't install it, and two hands-on reviews had found real holes. That's the whole recap.

HOST: And today?

GUEST: Today is only what moved. I'll be exact about one thing the whole way through. Very little of the new design work is merged. Most of it is built on a branch and under attack by a reviewer, or designed and waiting. I'll say which, every time.

HOST: You told me you listened back to the last episode.

GUEST: I did, with a notepad. Six of the things we'll talk about today exist because I heard myself give an answer I didn't like.

## 1. The gate went green, then CI went red (minutes 2 to 10)

HOST: Start with the gate. What passed, exactly?

GUEST: The plan records it on the twenty-sixth of November. One whole run of the gate: fourteen jobs, seven of them skipped by design, at one-tenth time scale, in about forty-two minutes. No time bound failed. The first run of that pair failed two jobs, and both were real. CI's ledger job read test reports that had run without Postgres, so four Postgres items looked like they'd lost evidence. And one golden app's built server couldn't find its in-process Postgres package. Both fixed, each with a test.

HOST: So you pushed, and CI agreed.

GUEST: CI disagreed within ten minutes. The check job failed on our own charts library. It passed here, and it passed in the gate's fresh checkout.

HOST: Works on my machine.

GUEST: Exactly that, and I don't accept it as an answer. The cause was a property test in the charts library running under the test runner's flat five-second default. On CI's four-core runner one of them took longer. This machine stays under five seconds, so the gate never saw it. We reproduced it on Linux at half a CPU.

HOST: One slow test. That's an afternoon.

GUEST: It was three in a row, and that's the story. The second was a watchdog test whose fixture had a two-hundred-millisecond hook timeout. At a time scale of one-hundredth, that's two milliseconds. A busy runner misses two milliseconds. I pushed a fix for that one from a guess, without a reproduction, and the guess was wrong. CI failed the same case again.

HOST: You guessed.

GUEST: I guessed, and the plan says so in those words. The rule that came out of it is written down: a failure that shows only on CI gets reproduced on Linux before any fix is pushed.

HOST: And the third?

GUEST: The third is the one I'd tell at a conference. The household app has a simulation test. Simulated clock, seeded schedule, fully deterministic by design. On CI it failed with a budget error: the simulation ran out of time with work still in flight. A seeded simulation whose result depends on how fast the machine is. That shouldn't be possible.

HOST: What happens when a deterministic test isn't?

GUEST: You find real time hiding inside simulated time. Postgres, compiled to run in process, arms a ten-second statistics timer on the real clock, in whatever async context happens to run the statement. The household server's statements were running in the simulation's context. So that real timer became part of the simulation's work. On a fast machine the test ends before it matters. On a starved one, the simulation waits out each real ten-second timer until its budget is gone.

HOST: How did you prove that?

GUEST: A Linux container with one CPU and two busy loops beside it. The failure appeared, with the stalled resource named as a ten-thousand-millisecond timer from the database's own code. The fix puts those calls in an async context of their own, and a test fails without it. Five of five passes at the failing setting afterward.

HOST: Three failures, one shape. All about speed.

GUEST: All three passed on a fast machine and failed on a slow one. So the gate had a blind spot, and patching tests one at a time would never close it. Two things came out of it. First, a slow-machine job in the gate. It runs CI's six test shards at real time scale in containers held to two CPUs each. Its first real run took two hours and failed four shards of six.

HOST: Four of six. Real bugs, or noise?

GUEST: Each one was explained, and I'd rather go through them than wave. One was a known fixture. One needed a system tool the container image lacked. One passed a read-only folder check because the container ran as root. One saw zombie processes because nothing in the container reaped them. And one was a product defect. Our evidence verifier detected a flipped byte in a signed file, and its message pointed at the signature file without naming the file that changed.

HOST: Hold on. That's your audit evidence. Did it miss a tampered byte?

GUEST: No, and I wanted that answered with certainty, so the fix has a test that flips every bit of both signed files. Detection held in every case, and the message now names both files. That job is merged, and it runs in about forty-eight minutes with three shards at a time.

HOST: And the second thing?

GUEST: One rule about time. It's the part I'd offer to any team with flaky tests. A time bound in a test is one of two kinds. Either it bounds the behavior under test, like "this debounce fires within two hundred milliseconds," and that should scale when you speed the suite up. Or it bounds the machine's own work, a build, a process spawn, a cold import, and that must never scale, because the machine doesn't get faster when you change a number.

HOST: And you'd mixed them.

GUEST: Everywhere. The default test and hook timeouts scaled, so at one-tenth scale a hook that spawned a build had a tenth of the time. The rule as built: the defaults are fixed time. Only a bound a test states through one helper, test time, scales. A bound over a build, a spawn or a cold import goes through another, fixed time. The plan counts 149 literal timeouts in 64 files moved to fixed time in the first pass.

HOST: Did the rule hold when you tested it?

GUEST: It found its own gap. We ran the whole gate under the load of four working agents on purpose. The slow shards were green. Four fast-scale shards went red, every failure a machine bound that still scaled. One showed why: a fixed-time value held in a named constant was being scaled anyway. So the rule got stricter. A bound that names anything is never scaled, and a bare number in a bound is refused by lint. Then every literal bound in the conformance tests was read and declared, 533 of them, with no number changed.

HOST: State.

GUEST: Merged on the main line as of the plan's last checkpoint: the slow-machine job, the time rule, both passes. The last pass isn't pushed yet. CI was green on the last pushed head. What I can't claim: a whole local gate passing at one-tenth scale while seven agents hammer the machine. It passed once, quiet. Under load it has failed on bounds each time. The decision on record is that CI at real scale is the arbiter, and a whole local gate gets a quiet window.

## 2. Done right, ahead of done (minutes 10 to 17)

HOST: Something in how you work changed too. Last time you described agents building in parallel. The notes I saw talk about a rule for them.

GUEST: One rule went into the plan as a decision, and everything since is judged by it. The first goal is the project done right, and done comes second. Nobody weakens Keel to get past something. Less unsafe code, never more. Higher test scores, never lower. No exemption, no loosened assertion, no raised limit, no skipped check as a shortcut. If an agent takes a shortcut, the work is sent back.

HOST: Every team says that. Show me where it cost you.

GUEST: Three places. Start with the number we argued about last time. The ledger said thirty-three unsafe uses. Another file said thirteen. I told you they disagreed.

HOST: You did. Which was right?

GUEST: Both, at different times, and the reason was worse than a stale doc. The count had been thirteen. Then the standard library began moving onto the library format, which holds each package to the app's rules. An app can't throw. So the agents doing the move met the rule by wrapping. Each package got a small file under its unsafe folder around one throw statement. The rule was satisfied and the count went up. One branch stood at forty-two.

HOST: So your escape hatch became the standard pattern.

GUEST: For one honest need: a library has to be able to say "this is a bug in the caller," and a Result isn't the right shape for a bug. The shortcut would've been to merge at forty-two and note it. What happened instead: an auditor removed what typing could remove, and an RFC, 0242, designed the sanctioned way. A function called defect, beside ok and err. A defect goes wherever a throw would go: the nearest error boundary, the server's scrubbed log, a failed test. And attempt now takes an expect argument, so it turns only the failures you name into values and rethrows the rest. A bug can't be laundered back into a value.

HOST: And the count?

GUEST: Built on its branch, the count came to thirteen from thirty-three. Then the reviewer said it's fourteen.

HOST: Off by one?

GUEST: One cast had been replaced by a type predicate. A function that says "this value is that type" after checking only that some members exist. That's a cast nothing counts. So the design got a new rule: a predicate that claims more than it proves is refused, and review lists the rest. That rule raises the honest count, to at least sixteen by the plan's reckoning. We kept it. The count measures escapes, and a number that looks better while hiding one is worth nothing.

HOST: That's the first. Second?

GUEST: Limits. Principle eight says no task should need more than four thousand tokens of spec in context, and the spec map has a token cap. Five branches were each adding spec sections. Several writers asked to raise the map's limit. Each was refused. One raised it anyway after a refused edit and was sent back to restore it.

HOST: And how did they fit?

GUEST: By shortening other sections' titles. "Accessibility" became "A11y." "Proving invariants" became "Proofs." Each writer did it differently, so the map was getting worse and would conflict at merge. The limit was telling us the structure had stopped scaling. RFC 0246 makes the map two levels: fourteen areas, each with its own file of sections, and lookup by error code, API name or glossary term. Measured on its branch, a fresh start loads 346 tokens of map where it loaded 1,643. Every title goes back to full words, held by a lint. That one is built and integrated with the main line, and its merge was in progress at the last checkpoint.

HOST: You re-based size budgets, though. I saw byte numbers move.

GUEST: Byte budgets, yes, and the difference matters. A bundle that grows because it gained a feature gets its budget re-based, with the number and the reason recorded. Token limits are never raised. And the checker's bundle has grown from 91 to 98 kilobytes on one branch in two days, which is the first item of a size review before public.

HOST: Third.

GUEST: Assertions. The end-to-end test work moved our own browser smoke tests onto the new runner. The builder reported it done and stable. Then listed, honestly, the assertions the new page API couldn't express, which it had dropped. Page titles. An element's padding. A caret position. Console warnings. A few more.

HOST: I've seen that migration. "We'll add them back later."

GUEST: The answer on record is one sentence: a migration loses no assertion. Each one gets a verb, a clause in the spec or a named other home, and the old smoke stays until all its assertions are carried. The RFC's writer went back and gave every one a home.

HOST: Did the rule ever make something worse? Strictness has a cost.

GUEST: It exposed a mistake of the same family. On the defect branch, the Postgres package turned database errors into defects. A lock timeout, a value too long for a column, a serialization failure. Callers lost the typed way to tell them apart, and one test had been weakened from checking a code to checking a message substring. The reviewer caught it. The rule that came out: a failure a caller could handle is a value, and a defect is a bug or corruption. The other migrated packages are audited against it as part of the same fix.

HOST: State of 0242?

GUEST: Built in a lane, reviewed, its seven holes closed in the design, conformance written, and the second build was running at the last checkpoint. Not merged. The main line's ledger still says thirty-three.

## 3. The breaking review (minutes 17 to 28)

HOST: You keep saying "the reviewer." Last time you had conformance tests written by an agent that can't see the implementation. Is this the same thing?

GUEST: It's a step added after it. The loop for a design change now has six stations. A writer produces the RFC and the spec text. A conformance writer, who can't read implementation files, writes tests from the spec. A builder makes them pass. Then a breaking reviewer attacks the built branch. The reviewer plays a persona, the one the change exposes most. A hostile library author. A designer. An ordinary product engineer who reads the error message and does what it says. Every hole has to be reproduced, with a file on disk or a failing request. The holes go back to the writer, who closes them in the spec first. Then conformance, then the build, then another pass.

HOST: How many of those reviews came back clean?

GUEST: None. Every breaking review recorded in the plan found real holes. I'll tell you four.

HOST: Go.

GUEST: The first is a stylesheet. Last time I said a library couldn't ship its own look, and that we'd decided a direction. That's RFC 0243, and it got built: a library ships a tokens object, the app composes it in its own tokens file. The reviewer, playing a library author, put an unclosed quote in a font value.

HOST: And?

GUEST: The value passed our filter, which was a deny list. It went into the generated CSS. And the browser, following the CSS rules correctly, dropped every rule after it. One token value wiped the app's whole stylesheet. The code was older than the RFC, but the RFC turned it into a path from a library to an app.

HOST: What happens when the fix for that is another deny-list entry?

GUEST: Then there's a next hole, so the fix went the other way. Each token group now has a positive grammar: what a value may be, with everything else refused before any CSS is emitted. And the invariant is stated in the spec: a browser's CSS parser keeps every rule the compiler emitted. A test in CI loads the output into Chromium and counts the rules kept.

HOST: Did the second pass find anything?

GUEST: A form feed character inside a quoted font name. It passed the new grammar, the build failed inside the minifier with no Keel diagnostic, and the dev server served five rules of fifty-eight. It also found the opposite problem, which I think matters as much. Walls. Values a designer needs that the grammar refused: calc, clamp, min, the safe-area insets on phones, the newer viewport units. The grammar was widened for those. And it's now built so a CSS tokenizer can read each form only one way.

HOST: Second story.

GUEST: Errors that vanished. One of the hands-on reviews had shown a library's render code stopping the server. One request, a promise nobody awaited rejected, and the process exited. That was by design, an old decision, and the review made me look at it again.

HOST: Node's default. Unhandled rejection, exit.

GUEST: Right, and the first question was whether the class of bug could be removed before run time. RFC 0245 does that. Keel check refuses a floating promise: a promise left as a statement, in app code and in a library's code as the app reads it. There's no fire-and-forget in Keel. The builder then swept the rule over every package, app and example we have.

HOST: How many?

GUEST: Fifty-seven real floating promises, by the plan's count, with real bugs behind some. A rejected form submit that never reached an error boundary. A failed request that left a form pending forever. Six app handlers that dropped their rejections. In our own code.

HOST: And the long-lived stuff? An offline queue draining in the background is a floating promise by nature.

GUEST: That's where the builder stopped and asked, correctly. It proposed a private reporter for the standard library by allowlist. Refused: no private door for the stdlib. The answer is a small kernel primitive called task. Work owned by a reactive scope, cancelled through an abort signal when the scope goes away, its rejection delivered to the nearest error boundary.

HOST: Then the reviewer.

GUEST: Then the reviewer found the simplest way around the whole RFC. On a server, a task's rejection went to ctx, and nothing on a server observed it. So it vanished. No log line, no count. Fixed in the design: a task doesn't exist on a server, which already has three owners for work. Then the last review found the one that stung. Our own offline package observes the network on ctx for the life of the page. The reporting rule sent an error to the platform only when ctx had no observers. So in two of our own apps, every browser error was silent.

HOST: In your showcase apps.

GUEST: In the first golden app and the household app. And one more from that pass. A task at a module's top level ran during the build. Three times in a node build, five in dev, ten in a static build, each run rejecting with a secret string in the reviewer's test, exit code zero, nothing printed.

HOST: What's the principle that closes all of that? You can't enumerate forms forever.

GUEST: The spec now states one: a failure is read by code, or it reaches an owner that reports it, and no form discards one. Everything in that review is being fixed in the lane, nothing pushed to a backlog. And the server side is settled too. A rejection is logged and the server serves on. The hundredth since start turns the health endpoint to 503 so an orchestrator replaces the instance. It never exits past a count, because that would hand an attacker an off switch at N requests.

HOST: State.

GUEST: Built in a lane, integrated with the main line, every earlier finding closed on re-run. The last review's fixes are in the spec, and their conformance was being written at the last checkpoint. Not merged.

HOST: Third story. You said a library ran unjudged at build.

GUEST: This is the big one. Last time I told you about two trust holes: a library's tools file runs any code at check, and its unsafe folder is invisible to the app. The fix was grants. The app names what each library may do, and the code is approved by a digest in a committed file. That got built, with the reviewers' two attacks as tests.

HOST: And the breaking review said?

GUEST: Do not merge. Three blockers, each with check green. The approval digest pinned one file, while that file could import itself by package name, or through a computed import, and run unapproved code. A library's files outside its source and unsafe folders escaped every rule, shipped in the bundle, and ran at build. And a nested second copy of a library was invisible to check, the grants and the approvals.

HOST: Three patches.

GUEST: That would've made seven, counting holes from two other reviews. And they were one design fault. The checker started from the files it expected. The bundler started from whatever resolved. Anything in the gap between those two sets ran without being judged. So no seventh patch. RFC 0251 designs the trust boundary itself. One resolve function serves the checker, the type pass, the bundler and every evaluation. Every file reached gets one class: app, library, kernel, plain package or built-in. And the loader refuses a file with no class, so the next hole fails closed.

HOST: And the review of that?

GUEST: Its first slice was built and reviewed, and the verdict was that the central claim is false today. A library imported without being listed is never judged and runs at build. And judged code can take the build process's rights by building the word "process" from two strings and reading it off the global object. The checker passed it. It wrote a file at build.

HOST: You can't win that game statically. JavaScript will always have another way to spell it.

GUEST: Which is what the second design concedes. A static rule over JavaScript will have a next hole. So evaluation at check and build moves into a child process under Node's permission model. No file writes, no child processes, no workers, no native addons. I'll give you the limit as the RFC states it: network is denied only from Node 25, and the supported floor is 22.15, so below 25 that gap is listed under "not held."

HOST: And approval? Somebody still has to say yes to a library's tools.

GUEST: This is the finding I'd underline for anyone building for agents. The reviewer sat in the approver's seat. The output hid what changed and what the code could do. It exited zero with nothing approved. And the error message and our own skill steered an agent to approve blindly. An agent told "run this command to approve" will run it.

HOST: So what does approval mean now?

GUEST: In the design: approval is per package and version, at a terminal, and refused under CI or when an agent is driving. The command shows the version, what it was before, the capabilities and what ships. And the grant is split in two. A rules grant runs a library's check rules in a host with no rights. A tools grant means the whole machine, and says so in those words.

HOST: What about a plain npm package? Last time that was a review you hadn't run.

GUEST: Still not run as a review. The design now says what it's held to. A plain package that judged code imports is declared per deployable, with a reason. The common case the RFC gives is adding a date library: install it, import it, one line in the topology file. What's held: it's present only where declared, no Node built-ins or environment values in browser assets, calls type-checked. What's not promised, stated plainly: what it does with page rights in a browser, within the content security policy, and with process rights on a server.

HOST: State.

GUEST: Designed, twice. The first slice is built in a lane. The second slice has its conformance written, about eighty cases. Nothing merged, and by decision the two slices merge together. The grants work waits behind it. So on the main line today, both trust holes from the last episode are still open.

HOST: You said four stories.

GUEST: The fourth belongs to the recordings, and that's one of the things listening back changed.

## 4. What listening back changed (minutes 28 to 43)

HOST: So you played the episode back. What did you hear?

GUEST: I heard you ask about session recordings, and I heard myself say the ingest endpoint accepts unauthenticated posts up to two hundred fifty-six kilobytes, and that listing recordings is limited to readers you name. Both true. Both wrong for this project.

HOST: Why wrong? You disclosed it.

GUEST: Disclosing a weak design doesn't make it a good one. An open upload endpoint is something every scanner finds. And the reader list was a small home-built authorization scheme, in a framework whose stated position is that it's not an auth library. So the decision was to fix it, and RFC 0248 is a redesign.

HOST: Walk me through it.

GUEST: Three ideas. First, as far as the framework goes, the endpoint is write-only. No list route, no reader guard, no viewer registration. All of that is deleted. Second, an upload needs a ticket. It works in the manner of a presigned upload. When a node server serves a page, it puts a short-lived signed ticket in the document: bound to the origin, the deployable and the entry, with an expiry, a number of uses and a byte limit, under a key derived from the app's secret. No ticket, no upload, and the handler never runs.

HOST: And reading them?

GUEST: Third idea. The server writes to an archive it never reads back. A folder, an object store, Postgres, or an HTTPS sink. You pull recordings from that storage with your own credentials, to a local folder, and replay, minimize and turn them into tests there. Who can read the storage is the operator's question, answered by the storage's own access control.

HOST: What does a ticket prove? Be careful here.

GUEST: The RFC is careful, so I'll use its words. A server holding the secret served a page on this origin within the hour. It doesn't prove a browser, a person or true content.

HOST: So I can fetch a page with curl, take the ticket and post garbage.

GUEST: That's the fourth story. The reviewer did exactly that arithmetic. A ticket costs one GET, and a 404 page gives one. So what bounds an attacker is the ledger of spent tickets and the archive. And both failed closed for everyone. Sixty-five thousand junk posts from one client, eighteen a second for an hour, each one refused but still spending a ledger entry, filled the ledger. After that, every ticketed entry in the app answered 503 for up to an hour. The app team's own uploads included.

HOST: A denial of service made of rejections.

GUEST: And the archive had the same shape. Eighty-two uploads filled a twenty-mebibyte folder archive, then all writes were refused until someone deleted files by hand. The object store had no quota at all.

HOST: What's the fix? Rate limiting is the thing you said you don't do.

GUEST: Bounds per source as well as in total. A request spends a use only after its body is within size and decodes. Junk counts as refusals, and twenty in a minute answers 503 to that source alone. A source holds at most sixty-four ledger entries. Past the total cap, only sources holding fewer than four get in, so filling the ledger takes about a thousand sources. Hourly quotas on uploads and bytes per source and overall. The folder archive evicts its own oldest files, never one under an hour old. And the flood tests run at full size, with an honest client admitted straight after.

HOST: "Per source" behind a proxy means trusting a forwarded header.

GUEST: That question found a kernel fault. The kernel had been trusting the last entry in the forwarded-for header, which a client writes, for the security-policy report limit too. There's one rule now: the socket's peer address, or with a declared number of proxies, that many entries from the end.

HOST: Honest residue?

GUEST: Stated in the threat model text of the RFC. An anonymous endpoint has quotas, and it doesn't have a wall. Anyone who can load pages can store about two mebibytes per source an hour. A rate limit in front is required.

HOST: State.

GUEST: Built in a lane, including the review fixes, with a property test per security claim. One late decision: each archive driver is its own entry the app imports, because bundling all of them made the monitor carry a storage signer and a database client it never calls. Splitting them took the monitor from 5,655 bytes to 1,704. Not merged. The recordings on the main line are still the old design.

HOST: Next note on your pad.

GUEST: Dark mode. You asked in the quick-fire, and I said a second scheme isn't on any list yet. I didn't enjoy hearing that.

HOST: It's the first thing a designer asks.

GUEST: So it went into the look RFC, 0243. Schemes in the tokens file, light and dark. The system preference decides until the visitor chooses. A select component, a cookie, the right scheme on first paint from a node server, and a small external script for static hosts. Contrast is judged per scheme. Text that passes in light and fails in dark is an error at check.

HOST: Two schemes is the minimum. Real products have brand themes, high contrast, print.

GUEST: Which is the next note. RFC 0249, themes. Here's why it's cheap. Tokens compile to CSS custom properties, and each style prop compiles to one atomic class that reads a property. So a theme is another set of values for the same properties under one selector. Switching is one attribute on the html element. No class changes, no re-render.

HOST: What's a theme, in the design?

GUEST: A named, partial token set with a condition. The condition is the visitor's choice, the system's contrast preference, or print. The limits are eight choice themes, one contrast theme and one print theme, which with two schemes gives at most fifty-four combinations, and contrast is judged for each. Under the contrast theme the bar for text is seven to one.

HOST: Print. Nobody does print.

GUEST: Everybody's invoice page does print, badly. A print theme, a print key beside the breakpoints on responsive props, and three page-break props.

HOST: Colors. Last time everything was hex.

GUEST: A reviewer flagged that a designer will expect more. The themes design takes six opaque forms: hex, rgb, hsl, oklab, oklch and display-p3, each with an exact luminance, so contrast is still computed. Alpha is the hard one, because you can't judge contrast against a see-through color without knowing what's behind it. So an overlay token lists its backdrops, and text on it is judged against the blend.

HOST: And where do the values come from? My designers live in a design tool.

GUEST: That's the piece I care most about. A command, keel tokens import. It reads design tokens files, the format design tools export. The plan names Figma variables as the first source. One file per mode, and modes become themes. It rewrites one generated tokens file whole and adds its spread to your own tokens file once, so hand edits survive a re-import. Anything with no home in Keel's groups is a warning that names it.

HOST: State of schemes and themes.

GUEST: Different states. Schemes and the library look, 0243: built in a lane, through two breaking reviews, with a proof library and a proof app, and it was at its last fixture corrections before merge at the final checkpoint. Themes, 0249: designed, with about 170 conformance cases written and failing as unbuilt. Its builder waits for the look to merge. And Keel's own brand has no dark palette yet. That's owed.

HOST: Did the library look survive its review? That was a major finding last time.

GUEST: The design did. A library ships its tokens, names are prefixed with the library's id so they can't collide, and when an app lacks them check gives one error per library with a fix that writes the import. The review changed one thing I like: a library's tokens file is never evaluated. Its form is judged from the text, and the app receives the data. The first version ran the file, and the reviewer got a second file to execute before the error appeared. The missing roles are in there too. Switch, toolbar, menubar and more. And a hole the reviewer found by using it: a toggle button couldn't look pressed, because there was no pressed state.

HOST: Motion. I didn't ask last time and I should have.

GUEST: I asked myself after listening. What the tree has today is a group of named durations that go to zero under the reduced-motion preference. And nothing consumes them. No transition prop, no keyframes, no enter or exit.

HOST: So, nothing.

GUEST: Nothing usable. RFC 0252 is the design, and it's designed only. Tokens say how things move: durations, easings, opacity, shift, scale, rotate, and named keyframes. Style props for transitions and animations. Enter and exit on mount and unmount. Page and shared-element transitions through the router on the platform's view transitions, progressive where unsupported. Scroll-driven animation by named timeline.

HOST: What happens when an element is leaving and the user tabs to it?

GUEST: The content's scope is disposed at once, as today. The element stays in place, inert, without its id, until its animation ends. Focus, events, the accessibility tree and the test harness all treat it as gone. And in tests, enter is skipped and exit removes in the same commit, so no test sleeps waiting for an animation.

HOST: And reduced motion? Everyone bolts that on at the end.

GUEST: It's in the grammar. A keyframe animation states its reduced form, and the reduced form never moves. Check refuses an animation over five seconds with no pause control, a moving transition whose reduced duration isn't zero, and a flash over three a second. And the visitor's setting has reduce and no "full." An app can't turn on motion the platform turned off.

HOST: What's refused?

GUEST: Animating layout properties and height. That's a type error. I expect complaints, and the review will tell us if it's a wall.

HOST: Next note.

GUEST: A paper cut I'd read out last time as a paper cut: after every component edit, check reports a stale generated file until you run a build. Hearing it aloud, it's absurd. The checker knows the file is stale. It can refresh the derived files itself before judging. A stale committed artifact stays an error only in a frozen mode for CI. That was promoted from the paper-cut list to its own line.

HOST: Built?

GUEST: Not built. Next on the list. And while we're on check speed: last time I quoted the target of under a second warm. A builder measured warm check on the household app at 2.5 to 2.8 seconds. That miss predates this work and it's on the backlog. The RFC that had claimed the budget no longer claims it.

HOST: You also told me the runtime is queryable. I wondered at the time why there's no browser panel for it.

GUEST: Same thought, listening back. Today there's a dev-only inspect endpoint, a command and an MCP server. Nothing reads client state from the page, and there's no extension. The plan reserves RFC 0250: one extension for Chrome and Firefox, with panels for stores and their transaction logs, the live dependency graph, scopes and tasks, the accessibility tree with an overlay, tokens and contrast per element, the session recorder, and a server panel. It's planned for after the freeze, because it rides a surface the open RFCs are still changing. No design text exists yet.

HOST: And the last note?

GUEST: The one I'm most excited about, so I'll be the most careful. A design mode in keel dev. A designer changes token values live and sees the result across the whole app, or scoped to one page or one component. Contrast is judged as they edit, by the same judge check uses. They can create a theme or do a whole redesign. Agents are good at structure and less good at taste, so this is where a person styles what an agent built. And the result exports as a change to the tokens file that becomes a pull request.

HOST: Why is that feasible for you and hard elsewhere?

GUEST: I'll answer the first half only. It rests on things that already hold. Tokens are custom properties, so a live edit sets one property and re-renders nothing. And every style value is a token, so there's one place to edit. Whether other frameworks' dev servers offer the same, I haven't checked against our research notes, so I won't claim they don't.

HOST: State.

GUEST: Reserved as RFC 0253, blocked on themes. Not written. A later step, generating a file a design tool can import so a design starts from the app's real values, sits in the future file for after 1.0.

## 5. End-to-end tests (minutes 43 to 47)

HOST: Last time you asked me to repeat one gap: no end-to-end tests for an app author. I repeated it. To several people.

GUEST: Thank you. RFC 0244 is the answer, and its first build exists in a lane. Test files ending in dot e2e dot ts, run by keel test dash dash e2e, `keel test --e2e`, which builds first. The testing package gains a serve function that starts every deployable from the build output on free ports with fresh data and peers wired. A static app is served the way a static host would, with its policy file as the header. There's a way to stand in a fake outside origin.

HOST: And the page API? If it's Playwright with a new name, I already have Playwright.

GUEST: It runs on Playwright's core as an optional pinned peer. The page keeps the harness's verbs and adds a few, like until, press, reload, back and offline. Two constraints carry over. Ids are the only selectors. And no verb sleeps.

HOST: What happens when the browser isn't installed on the CI box? Every suite I've seen quietly skips.

GUEST: It's an error with its own code, a failure, never a skip. A quiet skip is a green check that tested nothing.

HOST: What doesn't it do?

GUEST: The RFC says it in a list. Against a built app, you don't control the simulated clock, the random seed, network and storage faults, simulate or replay. Those belong to the in-process harness. And a passing end-to-end test earns no new rung on the ledger. It's example evidence.

HOST: How far along is it?

GUEST: The runner and the command are built in the lane. Our own browser smokes were moved onto it, all but the three native-shell ones and the inspector's. The plan records the migrated examples at seventy of seventy, and every migrated file green in a two-CPU container. Then the dropped-assertions finding I told you about, which sent it back to the writer. A second build step was running at the last checkpoint. Not merged.

HOST: Did moving your smokes find anything?

GUEST: One I enjoyed. The inspector app's smoke couldn't move, because the built app's security policy blocks the inspector's request to another app. The old smoke had passed only because its file server sent no policy header. So the test had been green for the wrong reason, and the policy was right. The inspector gets redesigned to fetch on its server.

HOST: And library authors? A component library has no server to serve.

GUEST: That was unbuilt in the first pass and the writer settled it: serve takes a component file and props, and writes a one-route host project around it. Designed, not built.

## 6. Personas, and what the two reviews became (minutes 47 to 52)

HOST: Last time you mentioned personas in one breath. They seem to be doing more work now.

GUEST: They're the measuring stick. Framework authors, eight app-author roles, nine kinds of app, six kinds of library author, each in a human form and an agent form. The agent form is the stricter test of whether docs and diagnostics are complete. The human form tests whether they're short. Three uses. An RFC names the personas it touches. A breaking reviewer attacks as the persona most exposed. And the hands-on reviews run per persona, from the packed kit.

HOST: Give me a decision a persona changed.

GUEST: The grants design first had digests hand-typed into module manifests. Twelve manifests, long hex strings. Read against the product engineer and the enterprise lead, that fails at upgrade time and tells a reviewer nothing. So approval became a command that shows each escape with its reason and what changed, writing one readable committed file. And one of the six questions asked of every persona is whether anything is allowed to the framework that's refused to them. That question is why the offline package didn't get its private reporter.

HOST: The two reviews. Component library author, and product engineer with a third-party library. Both said yes, with pain. You read me the findings last time. I want the scoreboard.

GUEST: Merged on the main line. The library blocker, a token name the app lacks passing check and failing at build, is fixed for app code under RFC 0241; a library's own folder and a listed library's source are the next step. Firing submit at a form's button now reaches the form. The simulation that failed its replay check was truly nondeterministic: the caller cookie's key came from the system's random bytes, outside ctx. Fixed at the source, and the error now shows the two entries that differ. And property tests on a component get an id-shaped id.

HOST: Built in a lane, not merged?

GUEST: The library look and the missing roles. The server staying up. End-to-end tests. The grants for tools and unsafe, which are built and held behind the trust boundary. And a library's ledger rungs, which the app took on trust: in the grants design they're shown as claimed, since a library's tests aren't in its tarball.

HOST: Still open, with nothing built?

GUEST: The other blocker, and it's the one that matters most to a stranger. Install. You still can't add the kit with one command. The create command is reserved as RFC 0247 and isn't written. Also open: a library's publish story with provenance. The library scaffold writing agent files. A probe's property test crediting its component on the ledger, which needs a small RFC that's queued. And the paper cuts: the leftover module in the scaffold, generated form ids, the scaffold-route message, review failing on a fresh app, docs for installed libraries, a no-server app importing the server package.

HOST: The binary name clash?

GUEST: Answered. The command stays keel, run through the project, and the docs will recommend against a global install.

HOST: And the reviews you hadn't run. A designer, a compliance owner, a tester, a static site, a service library, a plain npm package, a storefront, a SaaS over services, the embedded widget.

GUEST: None run yet. They're one line on the list, each to be run by a person's seat and by an agent's. The embedded piece gained a line of its own after you asked about adopting inside an existing app. A review first, then a guide.

HOST: You also said agents hadn't converged building the third golden app from public docs.

GUEST: No new trial since then. A Codex path for that app is still queued.

## 7. Quick-fire (minutes 52 to 54)

HOST: Quick-fire. Kernel sections conformance-covered. Two of your files disagreed.

GUEST: Counted by status line, seventy-three of eighty-three, after the token-name work merged. The handoff's seventy-eight of seventy-nine was wrong and has been corrected.

HOST: The README's counts?

GUEST: Still behind the ledger. It's a line on the list, with the rule that counts are generated wherever a doc states one.

HOST: Does the kernel obey its own rules?

GUEST: Not everywhere. The sweep found thirteen discarded Results in kernel code. A fix lane is owed, then every app rule run over the kernel's source as a standing check.

HOST: Third-party native shells?

GUEST: A minimal door is designed: a shells entry may name a library package that provides the shell, judged and approved like any library. The rest is reserved as RFC 0254.

HOST: How many agents at once?

GUEST: Up to seven. Five on the heavier model, or seven when two or more are lighter. Each owns a branch and a worktree.

HOST: What went wrong with that?

GUEST: Fourteen wait loops from finished agents were found still running, some for forty-four hours. Each watched for a process by a name its own command line contained, so it never ended. And test runs had left 137,000 temp folders, 45 gigabytes. Fixing the test helpers so a test removes its folders is on the list.

HOST: Any expected failure still wrongly treated as a bug?

GUEST: One known: a schedule's enqueue error. It needs its own RFC and sits on the backlog.

HOST: Mutation scores?

GUEST: No new numbers since last time. Tier-one hardening is still blocked behind the rest.

HOST: Motion in the brand?

GUEST: Owed, along with the dark palette.

HOST: The outside audits?

GUEST: Unchanged. After the public-readiness phase or at its end.

## 8. The honest state, and what's left (minutes 54 to 56)

HOST: Close it the way you closed last time. Sort it for me.

GUEST: Merged on the main line since we last spoke: token names judged at check for app code. The slow-machine gate job. The time rule, in both passes. The fixes for the three CI failures. The testing fixes from the reviews. A clearer evidence-verifier message. CI was green on the last pushed head, and the newest merges weren't pushed at the last checkpoint.

Built in a lane and under review, not merged: the defect signal and the unsafe count coming down. The library look, color schemes and the value grammar, which is closest to merging. End-to-end tests. Floating promises refused at check, task, and the server that stays up. The two-level spec map. The redesigned recordings. The first slice of the trust boundary, with the grants behind it.

Designed, not built: themes, print and the color forms, with the import from design tools. Motion. The second slice of the trust boundary: the single resolver, the sandboxed evaluator, approval at a terminal.

Reserved, not written: the create command. The browser dev tool. The design mode. The rest of third-party shells.

HOST: That's a lot of branches and a short merged list.

GUEST: It is, and it's the risk I'd name before you do. Nine RFCs are open at once and several stack on each other. Themes sit on the look, motion on themes, recordings and the trust boundary on the sessions branch. Each merge moves the ground under the others. The loop is slow on purpose, because every review so far has found holes I'd have shipped.

HOST: What's left before public, beyond landing those?

GUEST: From the road-to-public list. The install path. The kernel freeze, which waits on the last library-format slice and the shells. The remaining persona reviews. The agent docs and a converging build from public docs. The walkthrough app past its third layer. Tier-one mutation targets. The human docs, the site built in Keel, the comparison pages and the measured head-to-head results, none of them built. The docs sweep. A publish dry run with provenance. And the repository's own numbers agreeing with each other.

HOST: Last time I asked what you'd fix if you could fix one thing. You said the gate.

GUEST: The gate's in better shape than I'd hoped a day ago. Today I'd say the trust boundary. It's the claim under every other claim: what check judged is what runs. Right now, on the main line, that's false in ways I can reproduce. Until it merges, I'd tell anyone to treat a third-party Keel library like any npm package: code you're trusting.

HOST: And for me? What should I come back for?

GUEST: Come back when a stranger can install it with one command and the design mode has a first build. Bring a designer.

HOST: I'll bring two.
