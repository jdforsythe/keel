---
"@keel/cli": minor
---

`keel docs` replaces `keel spec` (k.docs): `keel docs` lists the sections of the installed packages and the skills of the running `@keel/cli`, `keel docs <id>` prints one section or skill verbatim, `keel docs --for <code>` prints the installed lines citing a code, and `keel docs --sync` writes the agent files. Sections come from each package's packed `docs/`; in the Keel repo `keel docs` reads `spec/`. E1065 names a package to install, E1066 a package without its packed docs. The MCP tool `spec` is now `docs`, and `keel spec` is E1051. Compact and pretty output print `see: keel docs <id>`. `keel scaffold project` writes `AGENTS.md`, `CLAUDE.md` and `.claude/skills/<name>/SKILL.md` unless `--workspace`, and `keel check` reports W1356 for a stale agent file where `AGENTS.md` holds the Keel block. `keel docs` reads a package's files only inside its real folder, up to 1,000,000 bytes each, and only from a package whose `name` matches its folder. A write a symlink would carry out of the project refuses the edit set with E1357; nothing is written.

Migration: run `keel docs` where you ran `keel spec`. An existing project runs `keel docs --sync` once to get the agent files.
