# ADR-0172: links into a shell (RFC 0150)

**Status:** accepted (D29 of `tasks/0963-to-p1/PLAN.md`: merged with its build, backlog 0956 closed).

**Context.** A shell admits a return link only against a pending opening (ADR-0169). That ignores deep links to pages and every callback tapped in a mail app, and a sign-in page that starts its provider on render after a link lands records a fresh opening the sender's next link takes.

**Decision.**
- A link to a page the router matches navigates at any time, with a web link's exposure; it takes no opening.
- `identityMount(path, { links: ['/magic-link/verify'] })` declares exact subpaths a link reaches at any time with one mount request GET and no opening. `keel check` gives E1584 for an entry not a string literal, `''`, not of `href`'s subpath form, or repeated. Declaring a path asserts its handler is safe to receive unsolicited, as on the web.
- Any other link under the mount takes a pending opening or is ignored, as ADR-0169.
- From a delivered link being taken until a person's act (trusted pointer, touch or non-Escape key input), no mount request records an opening, whoever starts it. A sign-in started at an ordinary launch records one.
- A shell reports its launch once: its links, none, or a failed read. Until then an opening made with no act is held; a report of no link records it, any other report drops it. A shell that never reports records none before an act.
- Under `@keel/testing`, `renderRoute(id, { shell: true })` reports a plain launch; `launch: 'later'` and the handle's `launch(links)` test the rest.

**Alternatives.** Every link needs an opening (breaks deep links and emailed callbacks). Patterns or run-time lists of declared paths (not checkable). A name-based diagnostic on declared paths (proves nothing). An opening always needs a person's act (breaks a sign-in started at launch). A launch counted as no link until told (the Capacitor launch-link race). A time bound on link-started.

**Consequences.**
- A page link is as open as a web link; a declared path is reachable by any app at any time with the native cookies.
- An app that starts a sign-in on render of a page a link lands on opens the browser with no return until the person acts.
- std-capacitor and std-tauri must report their launch.
