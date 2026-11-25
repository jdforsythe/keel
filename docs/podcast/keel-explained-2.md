# Two Tabs Open: Keel, the parts we skipped

**Episode description.** Nadia and Tom come back to Keel, the pre-0.1 TypeScript framework built on the premise that coding agents write most of its code. Last time they covered the rules, the checker and the ledger. This time it's the features that got left out: session recording and replay, with what it keeps, what it scrubs and who gets to read it; marks made offline and what happens when two people change the same thing; a chart library packaged the way a third party would ship one; state charts; and a quick round through the inspector, the accessibility claims, the evidence bundle and a head-to-head eval that so far has only one side.

Speakers: **NADIA** (host), **TOM** (guest).

---

## Cold open

**NADIA:** So after the last episode I got two kinds of email. One kind said, you let him off easy on the file count. Fair. The other kind said, you didn't ask about the session recording. And I had to go look up what that was, because I didn't know Keel had it.

**TOM:** It's in household. Layer ten. We stopped at nine.

**NADIA:** We stopped at the staples. The `kill -9`.

**TOM:** Right. Which you liked.

**NADIA:** I did like it. Okay, so today is the stuff we skipped. And I'm going to start with the recording thing, because my first reaction to "the framework records your users" was not warm.

**TOM:** I'd expect not.

## What gets recorded

**NADIA:** Let me put it bluntly. Why would I want my users recorded?

**TOM:** Because a bug report from a user is usually "it broke when I clicked save". And you can't reproduce it. That's the problem it's for. The recording is the steps that led to the error, in a form the test harness can run again.

**NADIA:** So it's a screen recording. Like the session replay products where you watch a little cursor move around.

**TOM:** No, and that's the first thing to get straight. There are no pixels. No video, no DOM snapshots, no mouse movement. A session is a JSON file, and it holds a list of events. There are six kinds. A `tx`, which is a transaction that ran on a store, with its name and payload. A `nav`, a navigation. A `fire`, which is an event on an element, a click, an input, a keydown, a submit, focus, blur. A `resource`, which is a loader going loading, ready, error. An `error`. And a `net` event, which is the connection going on or off.

**NADIA:** And a `fire` says, what, "clicked the button at these coordinates"?

**TOM:** It says clicked element `shopping.restock.run`, the Run now button. By id. This ties back to the thing you pushed on last time.

**NADIA:** Wait, the ids? Where tests can't use `getByRole`?

**TOM:** Yeah. Every element has a stable string id, so a recording can say "input on this id, value this" and a replay can find the same element later. If elements didn't have stable ids, there's nothing to point the event at.

**NADIA:** Okay. So the recording is what happened, by name. Where does it go?

**TOM:** It depends on whether you give it somewhere to go. You call `record(ctx, { upload })` in a component. In household that's `RecordingNote.tsx`, which sits under every page. Without `upload` it keeps a buffer in memory. With it, the first error the page reports sends the session to the URL you gave.

**NADIA:** Any URL?

**TOM:** Same-origin only. If the upload URL isn't http or https, or has a username or password in it, or is on another origin, `record` throws E2006 right there. The app that records also serves the ingest. You place the `sessions` module in your own `node` deployable, and `POST /sessions` is on your own server.

**NADIA:** So I can't ship these off to some analytics vendor.

**TOM:** Not through `record`. Part of that is the write check from last time, a cross-site POST gets refused. Part of it is the point. Your users' sessions stay on your server.

**NADIA:** And it records forever?

**TOM:** No. One recording per document, so the next page starts its own. The default limit is 500 events, and there's a byte cap, 192 kilobytes of session JSON. Past either, it drops the oldest events back to a navigation and rebases there, meaning it records the state at that point as the new starting point. So an upload always includes the error.

**NADIA:** Rebases. Okay, so the session has a starting state.

**TOM:** It has a base. The route it started on, its params and search, and the store state at that moment. Then the events after. That's what replay starts from.

## What gets scrubbed, and how anyone knows

**NADIA:** This is the part I care about. I've got a sign-up form. Name, email, phone, password. The user types all of that and then something fails. What's in the file?

**TOM:** None of those four values. But how each one goes is a bit different, so let me go through it.

**NADIA:** Go.

**TOM:** The password is the easy one. Every password field is masked, and anything typed `s.secret` in a schema always goes. Then the name, email and phone. Last time I said you mark a field `.pii("contact")` and the server log writes `[pii]`. The recorder uses the same marks. Every marked path in a transaction payload, in store state, in route params, gets replaced with a generated value.

**NADIA:** Generated, not blanked?

**TOM:** Generated from the schema. So if the field is an email, it gets a made-up email that still parses. Seeded by the session seed and the path, so the same value gets the same stand-in every time it shows up.

**NADIA:** Why bother? Why not write `[pii]` like the log does?

**TOM:** Because replay has to parse it. If the payload says `[pii]` where the schema wants an email, the transaction fails at the boundary and you've reproduced a validation error you made up. With a generated email, the replay runs the same path through the code.

**NADIA:** Huh. Okay, that's a decent reason.

**TOM:** And the input events on a control bound to a marked field come out as `x` repeated. One `x` per character. In household, layer ten, you can open the note under the profile page, it's called What this page records, type your name, and the line says `input members.profileForm:name` and then five x's.

**NADIA:** So the length leaks.

**TOM:** The length leaks. Yeah. I hadn't thought about that.

**NADIA:** What about data that isn't in a schema? Some raw element value.

**TOM:** That goes in the module's `redact` entries in its std config. The shape is a subject, a colon, a target, a hash and a path. Subjects are `tx`, `store`, `route`, `el` and `error`. An `el:` entry masks every input on that element. And `keel check` reads those entries: an entry that names an unknown subject, another module's target, or a path that isn't in the schema, is E2001, and the fix deletes it.

**NADIA:** So a typo in the redact list doesn't silently redact nothing.

**TOM:** That's the one it catches. Then there's error text. Say an error the page reports has the email in its message. "No account for this address", with the address in it.

**NADIA:** I've written that error.

**TOM:** Everyone has. So the recorder remembers the values it dropped, the newest 256 distinct ones, and scrubs them out of later error messages and error data. It looks for each one as written, URL-encoded and JSON-escaped, any letter case. That's a spec section of its own, `std.sessions-redact`.

**NADIA:** Last time you said the log scrub looks in hex and base64 too.

**TOM:** It does. The recorder's error scrub doesn't. Only those three forms. The threat model says so, and it's one of the limits I'd underline. If your error message base64-encodes the email for some reason, the recording keeps it.

**NADIA:** And keys I didn't declare? My schema is an open object and someone shoves extra stuff in.

**TOM:** Not recorded. State, payloads and route values are recorded as their schema encodes them, so an undeclared key, at any depth, and anything under it, never makes it into the file. If you want something recorded you declare it.

**NADIA:** Okay. You've told me what it does. How is that checked? Because "we redact pii" is a sentence every vendor's privacy page has.

**TOM:** A few layers. The package has conformance tests at seed 1337, and property tests for `redact` itself. Then household has `test/recording.test.ts`. It opens the profile as a member, types a name and a phone number, and checks the recording, the upload and the archive that `POST /sessions` filed hold neither. Nor the member's email, password or id. And then there's `tooling/smoke/canary.mjs`, which runs against the built app.

**NADIA:** Canary as in you plant values and look for them.

**TOM:** Yeah. The compliance skill describes the pattern. `piiPaths` on a schema lists the marked paths, `piiValues` gives the values under them. You fill those with generated values, drive the app, then search the log lines, the recorded session and `session(ctx).taken()` in the simulation for any of them.

**NADIA:** And what's not covered?

**TOM:** The compliance doc lists it under what the author owes. A value you copied into an unmarked field isn't redacted. A value derived from a marked one isn't either. If you do `email.toUpperCase()` and put that somewhere, the scrub doesn't know it came from an email.

**NADIA:** So it's as good as my marks.

**TOM:** It's as good as your marks. And `keel review` lists a drop in the number of `.pii(` calls, which I mentioned last time, so removing a mark at least shows up.

## Replay, and who reads it

**NADIA:** Alright. A session with an error lands on my server. Who can watch it?

**TOM:** Nobody watches it. There's nothing to watch.

**NADIA:** You know what I mean.

**TOM:** I do, but it matters for the answer. Reading the archive is `GET /sessions/list`, behind a guard called `sessions.reader`. You list readers in the std config, a user id or a caller hash. Household's list is empty, so every member gets 403 until someone adds theirs. `apps/sessions`, which is Keel's own ingest service, documents the steps: make one write, take the `keel-caller` cookie it mints, hash it, put the hash in `readers`, rebuild.

**NADIA:** That's a lot of steps to get read access.

**TOM:** It is. And then the person on the list runs `keel session ingest <url>` with that cookie in `KEEL_SESSIONS_TOKEN`, and it writes the sessions into `.keel/sessions/` on their machine. That's when you have files.

**NADIA:** And then replay. Is it a player?

**TOM:** It's a test run. `keel session replay <file>` builds a simulated ctx, renders the base route, and applies the inputs in order. The clicks and inputs go through the test harness, the navigations through the router, the `net` events through the simulated network. At the end you get what it observed, the state, the error, and a yes or no on whether it reproduced.

**NADIA:** What if the page needed the server?

**TOM:** If a `node` deployable serves the route, replay builds the app the way the generated entry does, so guards, loaders and actions run, over empty storage. And a recording keeps no user. So you pass `--user <id>` and it signs the replay in as a test account you name.

**NADIA:** Empty storage. So if the bug was "this user has 400 items and the 401st breaks it", replay gets an empty list.

**TOM:** Then it doesn't reproduce, and you get E2004, fingerprint differs, and nothing gets written. That's one of the honest limits. A session whose error needs the recorded server's state, or its loader answers, or the real user, won't reproduce.

**NADIA:** What's the fingerprint?

**TOM:** Twelve hex characters of a hash over the first error's code, where it happened, and the route it fired under. So every session that hit the same bug in the same place groups together. The archive keeps 64 fingerprints and the newest five sessions of each.

**NADIA:** Okay, and a replay that does reproduce?

**TOM:** Then `keel session minimize` cuts it down. Binary search for the shortest prefix that still fails, then it tries removing chunks until removing any single input stops the failure. Capped at 200 runs. And then `keel session to-test` writes a test file, `test/session-<fingerprint>.test.ts`. Every string the module didn't list in `expose` is written as x's, and it only writes the file after a replay of that redacted version still reproduces.

**NADIA:** So the bug becomes a regression test.

**TOM:** That's the loop. And there's a GitHub Action for the nightly version of it. It ingests the failing sessions of the last 26 hours, replays each fingerprint until one reproduces, minimizes it, writes the test, and opens or updates an issue titled `session <fingerprint>: <code> at <route>`. At most 20 a run. An issue closed as not planned stays closed. One closed as completed gets a new issue, since the bug is back.

**NADIA:** Is that running for real somewhere?

**TOM:** The workflow is in the repo. It skips unless the repo has the service URL and the reader token set, and I can't tell you from the repo whether anyone has set them. So, wired up, not something I've seen file an issue.

**NADIA:** There's something you said earlier I want to go back to. Seed. Last time the whole determinism story was a seed. A real browser doesn't have a seed.

**TOM:** Right, and the session says so. For a real browser the seed is absent and `deterministic` is false. A replay of that runs under seed 0, so any random ids it draws can come out different from the original run. The clicks still land, because they're addressed by element id. But if the bug depends on a specific random id, you won't get it back.

**NADIA:** Let's do cost. Bundle size first.

**TOM:** The browser part has a size budget of seven and a half kilobytes gzipped. That's its own code, minified, the kernel it sits on not counted. Replay, minimize and the node tools aren't in the browser entry at all.

**NADIA:** And storage on my server?

**TOM:** A session is at most 256 kilobytes on ingest, and the archive caps at 4 megabytes total. Oldest fingerprint out first.

**NADIA:** 4 megabytes is nothing. Someone posts junk and fills it.

**TOM:** Yes. The ingest takes unauthenticated posts. The `apps/sessions` README says it in so many words: anyone can post, put rate limiting in front of it, a flood replaces the archive. And the ingest redacts nothing. A recording is redacted once, in the browser, at capture.

**NADIA:** So if someone hand-crafts a session full of somebody's personal data and posts it to me...

**TOM:** It's filed as posted. The redaction happens in Keel's recorder, and the endpoint takes what it's given. The threat model lists that too.

**NADIA:** Okay. I came in hostile. I'm less hostile. I'm still not sure I'd turn it on without a lawyer.

**TOM:** That seems right to me. What it gives you is a list of what's kept and what isn't, written down. Whether that's enough for your users is your call.

**NADIA:** One more. Last time you said something about a tally file, monitored evidence. Same package?

**TOM:** Same package. `monitor` is a server runner. It counts commits of server stores by transaction name, writes the counts once a minute, and `keel session monitor <url>` pulls them down into `.keel/monitored.json`, which the ledger reads. Names and counts. No payload, no user, no time per entry.

**NADIA:** So it proves the code ran in production.

**TOM:** It shows it ran. Not that it was right. That's why it's the bottom rung.

## Writes made offline, and who wins

**NADIA:** Let's move on. Last episode you mentioned in passing that milk gets marked bought offline and it commits once or not at all. I want to actually understand it, because offline sync is where I've seen the most bugs in my life.

**TOM:** That's layer eleven. Someone is in the shop, the signal drops, they tap Bought on Milk. The row says `Bought, waiting to send`. The mark is kept in the browser, in `ctx.storage`. When the connection comes back, it goes to the server.

**NADIA:** What's the API?

**TOM:** `outbox`. In household it's `listOutbox.ts`, which is `outbox("shopping.outbox", shopping, { limit: 50 })`. The second argument is the module's contract, so the outbox only knows the API write entries the contract declares. Then the button calls `send` with the mark, a `base`, and an `owner`. `drain` runs while the page is open and flushes on each reconnect.

**NADIA:** Base is what?

**TOM:** The revision of the item that the page was showing when you tapped. Household gives each item a `rev` column, in `migrations/0003-item-revisions.sql`, and every change raises it.

**NADIA:** So optimistic concurrency. Version number.

**TOM:** Yes. When the mark arrives, `markBought.server.ts` runs one transaction. If the write's key is already in `list_writes`, it committed before, so the list comes back unchanged. That's the "never twice" part. If the item is gone, 404. If its `rev` moved past `base`, 409 `keel.conflict`, with the current `rev` as `head`, and nothing is written.

**NADIA:** And the owner?

**TOM:** That's the bit I'd have forgotten. A phone is shared, or someone signs out with marks queued. So every queued write carries the id of who made it, and the action passes it through `writeFor` with the request's user. No one signed in, it answers `offline.signin` and the mark stays queued on the device until that person signs in again. A different user, `offline.owner`.

**NADIA:** So my partner can't sign in on my phone and accidentally send my marks as theirs.

**TOM:** Right. And outbox entries that belong to the previous owner get marked failed when a new owner drains.

**NADIA:** What does the user see on a conflict?

**TOM:** There's a box under the tabs called Marks not applied. It's a `role="alert"`. In the test, one member's mark on Milk is waiting while the other adds one more Milk at home, and the page says `Milk × 2: someone at home changed this item while your mark waited`. Two buttons. Mark it bought, which is `resolve` with `mine`, sends it again over the new `rev`. Or Leave it as it is, `theirs`, which drops it.

**NADIA:** So the user picks. There's no merge.

**TOM:** For this write, the user picks. Keel's own stores have a setting for it. A transaction declares `concurrent`, and the default is `'reject'`: a stale base gets `keel.conflict`, and the server answers 409, the same answer household's SQL gives. The other choice is `'rebase'`, where the write runs on the current state anyway and the entry keeps the old base.

**NADIA:** Rebase sounds like how you lose data.

**TOM:** It can be. Which is what `std-conflicts` is for. It takes a store's log and, for each rebased entry, replays it against the writes it didn't see, in both orders. If one order fails, or both succeed but end in different states, that's a race. E2701. The message names the entry, what it raced, and the store.

**NADIA:** When does that run? Every request?

**TOM:** Never on a request. The spec is firm on that. It needs the state at `base`, which a request doesn't have, and a refusal there would depend on timing. It runs on a replay, a test, or a snapshot. And the nice version of it is over a group.

**NADIA:** A group?

**TOM:** Back to sessions for a second. `std.multi` is several users recorded and replayed together under simulation. `openGroup` starts each user in its own worker thread with its own DOM and its own cookie jar, all talking to one simulated server. You drive them, you stop, you get a group file. `findRaces` replays that group and runs the race check on every server store at the end.

**NADIA:** So I'd write a test where two people edit the same list and it tells me whether the order mattered.

**TOM:** That's the use. And the answer it gives you is a design decision: either the transaction should have been `'reject'`, or the payload carries a value read from a stale copy.

**NADIA:** What's rough here?

**TOM:** One thing in household. Only the marks go through the outbox. Adding and removing items still go straight to the API.

**NADIA:** Why only marks?

**TOM:** The README doesn't argue it. My guess is it's the case they wanted to prove first. I'd rather not guess on air.

**NADIA:** You did, though.

**TOM:** I did. Strike that.

## A chart library, from outside

**NADIA:** Last time I asked about ecosystem and you said thin. Has that changed?

**TOM:** A bit. There's a folder called `libraries/` beside `packages/`, and in it is `@keel-libs/charts`. Bar charts, line charts and sparklines. It's built the way a third party would ship one, with `"keel": "library"` in its `package.json` and a root `module.ts`. Household's receipts book page uses `BarChart`.

**NADIA:** Why does it need a special format? A chart is a component.

**TOM:** Because of what happens when the app installs it. The app's `keel check` reads the library's files as if they were the app's own. Every rule runs over them but one, the rule that stops app code declaring its own format types, since a library is allowed to. The type pass, the content security policy rules, accessibility, the pii rules. A diagnostic in the library shows up at `node_modules/@keel-libs/charts/src/...` and there's no fix attached and nothing turns the rule off.

**NADIA:** So if the library author wrote a cast, my build fails.

**TOM:** E1757, at their file, in your check. Yeah.

**NADIA:** That's brutal for the library author.

**TOM:** For the library author, sure. For you, it means installing one can't weaken a check your own code is held to. The spec says that in one line: installing a library weakens no check of the app's.

**NADIA:** What about the `unsafe` count? You made a big deal of it.

**TOM:** That's where the library ledger comes in. A published library ships `.keel/ledger.json`, which `keel pack` writes. It states how many `unsafe` uses and how many `Host` elements its files hold. Your `keel check` counts them again. If the shipped number doesn't match the files, E1162. And your own `keel ledger --diff` counts the library's `unsafe` uses as yours, so installing one that adds an escape fails E1706 until you rewrite your ledger.

**NADIA:** So I'd see it.

**TOM:** You'd see it. And its ledger entries show up in your ledger output with the evidence string `library` and its version. They don't count toward your totals.

**NADIA:** Let's talk about the chart itself. Charts are an accessibility disaster most of the time.

**TOM:** This one was built with that in mind. Each chart draws an SVG inside one `Host`. It has a `label`, a visible `summary` line, and a button that opens the values as a table. A point is `name`, `value` and `shown`, where `shown` is the value as your app formats it.

**NADIA:** Why does it need both?

**TOM:** Because the charts never format a number. Twelve forty in euros, eighty-five milliseconds, that's yours. Every word comes from your copy too. Color comes from your tokens, through `currentColor`, so your check judges the contrast. And nothing moves, so reduced motion shows the same chart.

**NADIA:** Ids?

**TOM:** Built from the id you pass. `<id>.chart`, `<id>.summary`, `<id>.button`, `<id>.table`, one per row. That's enforced too. In a library file, an element whose id isn't built from the component's own `id` prop is E1161. Otherwise two charts on one page could end up sharing ids.

**NADIA:** What's not done?

**TOM:** The library section, `k.library`, is still at proposed status. So it's the newest part and still moving. The charts package is version 0.1.0, private, in the repo. I'm not aware of a library written by anyone outside the project.

## State charts, briefly

**NADIA:** You said nobody's built a canvas-heavy app. What about complicated UI state? The modal that's open, submitting, failed, retrying.

**TOM:** That's `std-statecharts`. You declare a chart with `chart(id, { ... })`: states, events with payload schemas, guards and actions. And it compiles to an ordinary store with one transaction per event.

**NADIA:** XState.

**TOM:** Close to that shape, but flat. And because it's a store, everything from last time applies. `explore` can visit every state when the data is finite. `coverage` gives you the states nothing reached and the non-final states where it got stuck.

**NADIA:** And the checker reads it?

**TOM:** It does. E2752 is a state you can't reach from `initial`. E2753 is a non-final state with no way out, and the fix adds `final: true`. E2755 is when you build the declaration from variables or spreads, because the checker can't prove anything about it then.

**NADIA:** Where does it show up in real code?

**TOM:** Two places I know. Every headless widget, the menu, tabs, dialog, listbox, runs on one chart instance. And household's weekly restock is a chart, `restockChart.ts`, with `putting`, `resting`, `done` and `failed`. That's the one you watched survive `kill -9`. The workflow runs chart instances over durable jobs.

**NADIA:** Is the workflow part done?

**TOM:** `std.workflows` is at implemented, not conformance-covered. So the tests that exist were written alongside the code, not from the spec beforehand. It's one of the few stdlib sections in that state.

## Quick round

**NADIA:** I've got a list. Short answers.

**TOM:** I'll try.

**NADIA:** The inspector.

**TOM:** In dev, an app serves `GET /__keel/inspect`, a JSON document with the reactive graph, every store's state and log, the ids, the accessibility expectations, the routes, and sections that packages register. `keel inspect` prints it in the terminal. And `apps/inspector` is a Keel app, client-only, that renders another app's document. You give it `?url=`. In production that route is a 404.

**NADIA:** Store state in dev, unredacted?

**TOM:** Unredacted, to the developer. The compliance doc says so. And it's where `keel session capture` reads a live recording from, the `sessions.live` section.

**NADIA:** Accessibility. Last time you said every page test runs axe. Is anything claimed?

**TOM:** The ledger turns those runs into claims, one per route and WCAG criterion, like `a11y:shifts.show#1.1.1`. A claim sits at example when a passing page test rendered the route and every rule mapped to that criterion ran clean. The doc is careful: that claim says every image has a name, not that the name is any good.

**NADIA:** And what's never claimed?

**TOM:** Any criterion no rule maps to. Most of captions, timing, input assistance. Those get listed for a person. Contrast is read from the tokens, not from pixels, so text over an image isn't seen. Screen reader behavior isn't tested at all.

**NADIA:** The evidence bundle.

**TOM:** `keel evidence` runs check, test and ledger and writes a folder of files, signed with an Ed25519 key you pass in `KEEL_EVIDENCE_KEY`. `pii.json` has every marked path and each sink. `security.json` has the headers and the policy each deployable sends. `a11y.json` has the claims and what's left to a person. `keel evidence --verify` checks it. Change one byte in any file and it answers E1062 with the file name.

**NADIA:** And if my tests fail?

**TOM:** It writes the bundle anyway and exits 1 with E1060. The bundle shows the state as it is.

**NADIA:** Last time you gave me one eval, a dollar thirty-two. Anything new?

**TOM:** There's a head-to-head now. One product brief, a recipe box, with copy in three locales and no Keel in it. An agent builds it in Keel, or in Next.js, and the same hidden suite scores both. 28 black-box checks over HTTP and a browser, a security scan, axe on five pages.

**NADIA:** And?

**TOM:** One side has run. The Keel side, with Codex, today. Passed 28 of 28 on the first iteration, no security defects out of 37 checks, no accessibility defects. About fifteen minutes and five million input tokens.

**NADIA:** And Next?

**TOM:** Hasn't run yet. Ask me next time.

**NADIA:** Five million tokens is a lot.

**TOM:** It is. Most of it is input, the agent reading. I don't know yet what the Next side costs, so I can't tell you whether it's a lot by comparison.

**NADIA:** The new walkthrough app. Evenly?

**TOM:** A group trip's shared costs. It runs in the browser alone, no server, no sign-in. Three layers so far. The bit I like is the money. You type an amount as text, `parseMoney` reads it, and `12.505` euros is refused with a message on the field, never rounded. Ten euros split three ways is 3.34, 3.33, 3.33, and a seeded test checks that the shares add up to the cost.

**NADIA:** Can it prove that?

**TOM:** It can prove the invariants about ids and who's on the trip. Not that balances sum to zero, because the proof fragment has no sum. The README says that and points at the 200 seeded trips that check it instead.

**NADIA:** Moving a module between servers. You said structure is an operation.

**TOM:** `keel codemod place <module> --to <deployable>`. It edits `topology.ts` and regenerates the deploy files. A module lives in exactly one deployable, so that's the whole move.

**NADIA:** Live updates. You mentioned two people seeing the same list.

**TOM:** Layer eight. A channel, `shopping.live`, and a write transaction in Postgres that ends with `t.changed(listChannel, {})`. That's sent with `pg_notify` inside the transaction, so it's delivered once it commits and never for one that rolls back. Open pages get `{ kind: 'changed' }` with nothing else in it, no item, no name, and re-read the list. And before each change goes out, the server checks who the stream's cookie belongs to now, so after a sign-out in another tab the stream closes.

**NADIA:** Nothing in the message at all?

**TOM:** Nothing. No personal data rides the channel.

## What's rough

**NADIA:** Okay. The list.

**TOM:** From today's topics. The library section is proposed. Workflows are at implemented. The nightly session loop is wired but I haven't seen it file anything. The session ingest is anonymous, needs rate limiting you supply, and a flood replaces it. The recorder's error scrub covers three encodings. Replay can't bring back server state or a real user. The head-to-head has one arm. The second brief in it, adding a field to an existing app, has no suite or runner yet. Screen readers aren't tested.

**NADIA:** That's longer than the feature list.

**TOM:** About the same, I'd say. Most of it is written down in the repo, which is how I found it.

**NADIA:** Last question, same as last time. Someone wants to try one thing from today. Which?

**TOM:** Household, layer ten. Open the profile page, open What this page records, and type your name. Watch the x's. Then go to layer eleven, turn the network off in dev tools, mark Milk bought, add Milk in the other window, and turn it back on.

**NADIA:** And read the diff when check complains.

**TOM:** You remembered.

**NADIA:** Tom, thanks.

**TOM:** Thanks. Oh, one thing. The Action that files issues, it strips control characters out of every title. Because a route id ends up in an issue title, and a route id came from a recording.

**NADIA:** You did it again.

**TOM:** Same as last time. It's the bit I like.
