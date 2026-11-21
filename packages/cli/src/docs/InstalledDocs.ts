import type { AgentSkill } from "@keel/scaffold/agents";

/** One row of a packed `docs/index.json` or `docs/map.json`. */
type Row = { readonly id: string; readonly title: string; readonly codes: readonly string[]; readonly package: string };

/** An installed `@keel/*` package: where its files sit in the loaded tree, its version, its readable index. */
type Installed = { readonly base: string; readonly version: string; readonly index: readonly Row[] | undefined };

/**
 * What `keel docs` reads (k.docs): in the Keel repo (`repo`), `spec/` and `packages/cli/skills/`; otherwise the
 * running `@keel/cli`'s version and `map` (undefined: no readable `docs/map.json`), the installed packages by name,
 * and the skills.
 */
export type InstalledDocs = {
  readonly repo: boolean;
  readonly files: ReadonlyMap<string, string>;
  readonly cliVersion: string;
  readonly map: readonly Row[] | undefined;
  readonly installed: ReadonlyMap<string, Installed>;
  readonly skills: readonly AgentSkill[];
};
