# Contributing

Keel is pre-release. External contributions open at the public launch; until then the repository is worked by its maintainers and their coding agents. Issues and pull requests from others are not yet reviewed.

## How the repo is worked

The repo is the memory. Read `docs/HANDOFF.md`, `docs/PRINCIPLES.md`, `docs/GLOSSARY.md` and `docs/ARCHITECTURE.md`, in that order. Retrieve spec sections with `pnpm spec` (the areas), `pnpm spec <area>`, `pnpm spec <id>` and `pnpm spec --for <code, name or term>` rather than reading `spec/` or `docs/adr/` whole. `docs/WORKFLOW.md` describes the loop: one task from `tasks/BACKLOG.md`, a spec section, conformance tests written from that section, then the implementation.

## Commands

`pnpm install` once, then `pnpm check` · `pnpm test` · `pnpm build` · `pnpm eval` · `pnpm spec`. Each prints compact structured output (`docs/OUTPUT.md`); pass `--format=pretty` on a terminal. Run one test file at a time on a shared machine.

## Kernel changes go through an RFC

A change to a spec section's text or status rules, a conformance test, a glossary term, a kernel package or an extension point is an RFC (`docs/RFC.md`). It lands as three commits tagged `rfc:NNNN`: the RFC with its ADR and spec text, the conformance change, then the build. Files under `packages/*/conformance/**` change only in such a commit.

## Rules a change meets

- No `any`, casts, non-null assertions or `@ts-ignore` outside `unsafe/` directories; each `unsafe` use carries a justification string.
- Anything printed follows `docs/OUTPUT.md`; anything a person reads follows `docs/BRAND.md` and `docs/VOICE.md`.
- Docs describe what exists now, with no history; the git log and `docs/rfc/` hold the story.
- Report a vulnerability through [SECURITY.md](SECURITY.md), not an issue.
