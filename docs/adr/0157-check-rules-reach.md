# ADR-0157: check rules catch what they name: literal copy in every user-visible place, the whole zone and locale list, and Node-only globals in browser code (RFC 0135)

**Status:** accepted (orchestrator under the owner's standing leave, 2026-11-18).

**Context.** E2406 reads only `label` and `alt`, no templates with substitutions, concatenation, `children` props or `const`s, and only PascalCase component files with `export default`. E1758's rule reports more than k.check lists, and misses a date that arrives as a parameter because it is syntactic. No rule reports `process`, `Buffer`, `__dirname`, `require` or Node built-in imports in code the browser runs; they type-check and fail there. std.messages and k.check are full.

**Decision.**
- C1: E2406 reads `placeholder`, `title`, `aria-label`, `aria-description`, `aria-placeholder`, `aria-roledescription`, `aria-valuetext` and `children` besides `label` and `alt`, in every `.tsx` file of the module, and the same properties of an object literal passed to an uppercase identifier callee in every app file but the set's locale files (std.copy).
- C2: E2406 follows templates whose text parts hold a letter, `+`, thunk bodies, and `const`s in the file or imported from a project file, reported at the use; calls, members, `let`, destructuring and installed packages are stated limits.
- C3: E1758's full list lives in k.host; a date is an expression whose TypeScript type is `Date` (the check's type pass), so parameters, members, call results and imports are covered; without the type pass the reach is syntactic.
- C4: E1759 reports Node-only globals and Node built-in imports in browser files (app files not named `*.server.*` under a listed module, but a `routes.ts` only node deployables load; with no topology, every app file not `*.server.*`), and `require`, `__dirname`, `__filename` in every app file. `typeof` guards, `globalThis` members, `import type`, tests and tooling are not reported. Fix `import.meta.dirname`/`filename` outside browser files only.
- C5: new sections k.host (E175x with k.check) and std.copy.

**Alternatives.** Module-graph reachability (no rule has a graph; `*.server.*` already marks the boundary). E1004's predicate (exempts all-client modules, where Node globals always fail). Reporting `globalThis.process` (no sanctioned probe left). Date parameters as a limit (the commonest shape). Every literal in a `.tsx` file, or following calls and members for E2406 (reports ids, tokens and the message-set path).

**Consequences.**
- A helper only server files import, using Node APIs, is renamed `*.server.ts`.
- E1758 needs the type checker for receivers; `check(files, { types: false })` keeps the syntactic reach.
- Copy held in object members or returned by calls is still not reported.
