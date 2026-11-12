# ADR-0114: focus moves on `fire`, blank required text fails, `keel dev --port`, `keel.unreachable`, one deployable name form, a landmark `Box` is labeled (RFC 0091)

**Status:** accepted by the orchestrator (2026-11-12) under the WORKFLOW RFC defaults; awaiting the user's confirmation.

**Context.** Seven frictions from the golden apps: a test cannot move focus; `s.string({ min: 1 })` accepts whitespace and reports an empty value as `min` on one form and `required` on another; `keel dev` cannot choose a port and Vite moves silently; an unreachable peer answers 502 with `keel.unexpected`; `my-api` gives the key `KEEL_PEER_MY-API` and `codemod place` refuses `my-api`; axe `landmark-unique` fails on unnamed `nav` landmarks.

**Decision.**
- D-A: `fire` `focus` and `blur` call the element's `focus()` and `blur()`; `state.focused` is the one focus query; an unfocusable target or a `blur` off an unfocused element is E1719.
- D-B: with `min` >= 1, a string of only whitespace fails `parse`; parsing never trims.
- D-C: with `min` >= 1, `''` fails rule `required`, as an absent key does; the rule lives in `parse`.
- D-D: `keel dev --port N`, default 5173; a busy port is E1560 and exit 1, with Vite on `--strictPort`.
- D-E: an unreachable peer is 502 `keel.unreachable`, naming no host; `@keel/services` reports it as `api.network`.
- D-F: one deployable name form, `[a-z][a-z0-9-]*`, checked by `deployableNameProblem` everywhere (E1352 in `codemod place`); one key derivation, `peerKey`, giving `KEEL_PEER_MY_API`.
- D-G: `Box` takes `label`, written as `aria-label`; required with `as="nav"` or `as="aside"` (E1802), optional on other landmark tags, refused on the rest; duplicate names stay a test-time E1703.

**Alternatives.**
- A `focused()` method, dispatch only, or `click` that focuses, rejected: a second query, no `activeElement` proof, browsers disagree.
- A `trim` or `blank: false` option, or trimming in `@keel/forms` or `decodeStrings`, rejected: a second spelling of required text, or the server still accepts blanks.
- Next-free-port fallback or a new code for a busy port, rejected: the caller cannot know the port; E1560 already means it.
- `keel.unexpected` with 502, or exposing 502 as `api.status`, rejected: code and status disagree; a split would add an outcome.
- Dropping `-` from names or keeping `KEEL_PEER_MY-API`, rejected: refuses common names; not settable from a shell.
- A static duplicate-landmark rule, a raw `aria-label` prop, or `labelledBy`, rejected: misses cross-file pairs; a second name beside `label`; needs a visible heading.

**Consequences.**
- A test can prove a control keeps focus across a write.
- golden-1 and golden-2 name their landmarks; a dev storage file holding a blank title fails to restore and is deleted.
- A deployable named with `-` reads `KEEL_PEER_MY_API`; `keel build` regenerates `deploy/compose.yaml`.
- E1719 is a new k.testing diagnostic; `keel.unreachable` is a new KeelError code.
