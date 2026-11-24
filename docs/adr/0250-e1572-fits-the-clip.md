# ADR-0250: k.shell: E1572's plugin message fits 89 units whole; a shell target's texts are bounded (RFC 0228)

**Status:** accepted (orchestrator, 2026-11-24, for the operator to confirm).

**Context.** k.check clips every `diag` message at 89 UTF-16 code units and says each is written to fit. E1572's plugin form, `<deployable>: <shell> needs <plugin> <version> in package.json dependencies (<need>)` with `need` up to 60, runs to 96 and 112 units at `@keel/std-capacitor`'s real plugins, so they are clipped and the conformance expecting them whole fails. k.check#23 measures each code's one `check()` fixture; the plugin form is built only by the CLI's shell pass from a package's `./tools`, so no fixture reached it. E1575's text is a target's free text with no bound either.

**Decision.**
- E1572's plugin form is `<deployable>: <shell> needs <plugin> <version> (<need>)`, `plugin`, `version` and `need` at most 50 characters together: at most `<deployable>` + 72 units. Where to add the entry is the `fix`'s (`package.json` `dependencies`) and `keel explain E1572`'s. The storage and shell-package form is unchanged.
- `@capacitor/browser`'s need is `external browser sign-in`.
- E1575 is `<tool> missing or too old: needs <need>`, `tool` and `need` at most 60 together: at most 87 units.
- One k.shell clause measures both at their bounds over the stub target. No diagnostic for an over-long entry; the clip is its net.

**Alternatives.**
- Keeping `in package.json dependencies` with a need of about 14 characters, which says nothing.
- Dropping `<deployable>:`, which E1573 and the storage form carry.
- Widening k.check#23 to every message form, with no room in k.check and a fixture per CLI form.

**Consequences.** The std.capacitor and cli shell-plugins conformance take the new strings; k.shell reads `implemented` until its new clause is covered. The sweep found no other `diag` template overrunning at real input; thrown errors (E1708, E1715, E1716, E1727, E1728) and the E1007 build line can pass 89 at real names and are left to their own sections.
