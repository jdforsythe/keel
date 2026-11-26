import type { AgentSkill } from "@keel/scaffold/agents";
import type { DocsArea } from "./DocsArea.ts";
import type { DocsRow } from "./DocsRow.ts";
import type { DocsTerm } from "./DocsTerm.ts";

/** An installed `@keel/*` package: where its files sit in the loaded tree, its version, its readable index. */
type Installed = { readonly base: string; readonly version: string; readonly index: readonly DocsRow[] | undefined };

/**
 * What `keel docs` reads (k.docs): in the Keel repo (`repo`), `spec/`, `docs/GLOSSARY.md` and
 * `packages/cli/skills/`; otherwise the running `@keel/cli`'s version, `areas` (undefined: no readable
 * `docs/map.json`) and glossary `terms`, the installed packages by name, and the skills.
 */
export type InstalledDocs = {
  readonly repo: boolean;
  readonly files: ReadonlyMap<string, string>;
  readonly cliVersion: string;
  readonly areas: readonly DocsArea[] | undefined;
  readonly terms: readonly DocsTerm[];
  readonly installed: ReadonlyMap<string, Installed>;
  readonly skills: readonly AgentSkill[];
};
