# P1 and P2 planning input

The operator's direction for the public phases, gathered on 2026-11-19. It is input to a plan, not the plan. P1 planning starts in a fresh context from this file, `docs/ROADMAP.md` (P1 row), `tasks/BACKLOG.md` and `docs/BRAND.md`.

## Gates carried into P1
- The external a11y audit and the pen test are P1 gates. S6 is provisionally closed and reopens if either fails.
- Every open weakness in the backlog is fixed before anything is published or any app is deployed.
- The fresh public repository replaces this one at launch; home-directory paths and quoted messages are stripped first (backlog 0946). The committer email stays.

## Showing the product (P1 or P2)
Screenshots, screen recordings and built visuals of features. Recorded where that is honest, constructed where a recording cannot show the point.
- A person clicks around an app; the same session replays on another machine.
- An agent writes code, gets the precise diagnostic, fixes it in one step; context stays small across the loop.
- More of these are wanted: a list of moments that show a feature working, each with what is on screen and why it matters.

## The pitch
- A features, about and pitch page for what is built in: the hardening and the batteries included with little work from the app author.
- The level of testing and evidence; the security faults an app avoids by construction.
- The architecture: thinking the way Rust does, removing whole classes of bugs.
- Comparison pages (Keel beside each alternative).
- The same properties make Keel better for people writing by hand, not only for agents; say so.
- The ideas behind the design are material: Keel as the next framework to look at.

## Agents as first-class users
- Skills and tooling for coding agents (Claude and Codex), specialised by kind of work (client, server, others as needed).
- Common files that let an agent read the docs for the version of Keel installed in the project.
- An efficient path for an agent to read docs: shipped with the packages and read from `node_modules` (likely the most efficient), a URL, or both. To be decided.
- A docs and marketing site for people, built in Keel.

## Research
- Study the best open-source and framework sites; write a steal list; decide what Keel can do better and how to show its strongest parts.

## Already recorded elsewhere
- `docs/ROADMAP.md` P1 row: the kernel `frozen` flip, SVG system diagrams, human explanations, agent documentation checked by an eval, the public site, the launch checklist.
- A new layered walkthrough app (not the golden apps); an RFC and docs sweep at the public reset (backlog 0229).
