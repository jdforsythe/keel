## Conformance diff
Written by `conformance-writer` in the `rfc:0105` PR, from the Spec diff only.

**`packages/server/conformance/privacy-diag-scrub.test.ts`** (changed). Header line 3 quotes the old Sinks sentence and the old Conformance bullet. It becomes:
`// Spec: k.privacy, Sinks "So is the revealed value of each `Secret` made while the request runs (`bearer` too), by `[secret]`: a string or a number, not a boolean." Conformance "An action throwing the revealed value of a `Secret` input or `bearer`, as a string or in an `Error` message, logs a `diag` record holding `[secret]` and not the value, in dev and production, ..."`
Its cases (generated input schemas, the action throwing each revealed secret as a string and in an `Error`, in dev and production, no line holding the value, its base64 or `encodeURIComponent` form) are unchanged: the decoded input is made inside the request's scope, so the hook covers what the removed `runAction` line did. The `it` names that quote the old bullet are updated to the new wording.

**`packages/server/conformance/bearer-0104.test.ts`** (changed). Header line 11 quotes "An action's `output` counts as a loader's, and `bearer` (k.api) as a `Secret` input." and line 12 "An API action throwing the revealed `bearer` logs `[secret]` in its place." Both become quotes of the new text: Sinks "So is the revealed value of each `Secret` made while the request runs (`bearer` too), by `[secret]`" and the merged Conformance bullet. The scrub case (`it` at "An API action throwing the revealed `bearer` logs `[secret]`...", dev and production, token `ab+c/d-e.f_g~h==` in all four forms) keeps its assertions; its name quotes the new sentence. It now passes through the hook, since `bearerOf` runs inside `run`.

**`packages/server/conformance/privacy-secret-reach.test.ts`** (new). Header quotes the new Sinks sentences ("So is ...", "One made at startup or in a runner is not.") and the merged Conformance bullet. One app, `createApp` with a sim ctx (seed 1337), `artifacts` set, `log: { format: "json", write }`. Cases:
- A loader that awaits once, parses `"api-key-91c2e7d40b"` with `s.secret(s.string())` and throws `Error("upstream refused " + reveal(key))`: a document GET in production logs `loader app.a threw: Error: upstream refused [secret]`, and no line holds the key in any of the four forms.
- An action that awaits once, parses `"keelsim_0a1b2c3d4e5f6071_9f8e7d6c5b4a39281706f5e4d3c2b1a0"` and throws `Error("mailer down; token " + revealed)`: in dev and production the line is `action app.a threw: Error: mailer down; token [secret]`; in dev the JSON response body does not hold the token either.
- The same throw where a helper in a second app file, called after two `await`s, makes the secret: marked (the scope follows the call chain, not the file).
- Input `{ flag: s.secret(s.boolean()) }`, sent `{ flag: true }`, the action throwing `Error("flag " + String(reveal(flag)))`: the line is `action app.a threw: Error: flag true`.
- Two overlapping POSTs, each parsing its own secret (`"alpha-7c1e3f"`, `"bravo-2d9a6b"`) after an `await` on a sim clock deadline that makes them interleave, each throwing an `Error` whose message holds its own value and the other request's value as a string literal: each request's line marks its own value and holds the other's as written.
- A `Secret` parsed at module scope before `createApp` and thrown revealed by an action: the line holds the value as written (the "One made at startup ... is not" sentence; this case flips if Questions 1 is decided otherwise).
- A runner that parses a secret and rejects with its revealed value: the `runner rejected` line holds it as written.

No `packages/schema/conformance` file changes: no spec sentence about `s.secret` changes. `onSecret` is covered by unit tests in the schema lane.

