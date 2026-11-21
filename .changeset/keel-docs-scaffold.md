---
"@keel/scaffold": minor
---

`@keel/scaffold/agents` exports `agentFiles(files, skills)`: the agent files `keel scaffold project` and `keel docs --sync` write and `keel check` compares (W1356), `AGENTS.md` with the Keel block between `<!-- keel:start -->` and `<!-- keel:end -->`, `CLAUDE.md` when absent, and a copy of each skill. A block without one start line before one end line is E1355. A CRLF `AGENTS.md` gets the block in CRLF.
