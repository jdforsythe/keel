// Shared helpers for the k.origins check conformance files (not a test file). Public API only. Seed 1337.
import { check } from "@keel/check";
import type { Files } from "./support.ts";

export const SEED = 1337;

const MANIFEST = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;

export interface Deployable {
  name: string;
  modules: string[];
  adapter?: string;
  /** Source text of the `origins` value, e.g. `{ img: { 'https://a.example': 'r' } }`; absent: no `origins`. */
  origins?: string;
}

/** `topology.ts` plus one manifest per module, then the given files. */
export function project(deployables: Deployable[], files: Files = []): Files {
  const entries = deployables.map(
    (d) =>
      `  ${d.name}: { modules: [${d.modules.map((m) => `'${m}'`).join(", ")}], adapter: '${d.adapter ?? "node"}'${d.origins === undefined ? "" : `, origins: ${d.origins}`} },`,
  );
  const ids = [...new Set(deployables.flatMap((d) => d.modules))];
  return [
    {
      path: "topology.ts",
      source: `import { topology } from '@keel/server'\nexport default topology({\n${entries.join("\n")}\n})\n`,
    },
    ...ids.map((id) => ({ path: `modules/${id}/module.ts`, source: MANIFEST(id) })),
    ...files,
  ];
}

/** One `node` deployable `web` holding module `a`. */
export const single = (origins: string | undefined, files: Files = []): Files =>
  project([{ name: "web", modules: ["a"], ...(origins === undefined ? {} : { origins }) }], files);

export const withCode = (files: Files, code: string) =>
  check(files, { types: false }).diagnostics.filter((d) => d.code === code);

/** A `{ directive: { origin: 'r', ... } }` source text. */
export const decl = (directive: string, ...origins: string[]): string =>
  `{ ${directive}: { ${origins.map((o) => `'${o}': 'r'`).join(", ")} } }`;
