import type { SourceFile } from "../../src/index.ts";

const q = (xs: readonly string[]): string => `[${xs.map((x) => `'${x}'`).join(", ")}]`;

/** A module manifest at `modules/<id>/module.ts` with `deps`. */
export const mod = (id: string, deps: readonly string[] = []): SourceFile => ({
  path: `modules/${id}/module.ts`,
  source: `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${q(deps)}, capabilities: [], public: { exports: [] } })\n`,
});

/** A module's contract at `modules/<id>/<id>.contract.ts` over `entries`, source text of the entries object body. */
export const contractFile = (id: string, entries: string): SourceFile => ({
  path: `modules/${id}/${id}.contract.ts`,
  source: `import { contract } from '@keel/router/contract'\nimport { s } from '@keel/schema'\nexport const ${id} = contract('${id}', { ${entries} })\n`,
});

/** The module's `routes.ts` binding its contract; `binding` is the source text of the binding object body. */
export const bindingFile = (id: string, binding: string): SourceFile => ({
  path: `modules/${id}/routes.ts`,
  source: `import { manifest } from '@keel/router'\nimport { ${id} } from './${id}.contract.ts'\ndeclare const Page: () => Node\nexport const routes = manifest(${id}, { ${binding} })\n`,
});

/** A `topology.ts` placing `modules` per deployable, every deployable on the node adapter. */
export const topologyFile = (deployables: Readonly<Record<string, readonly string[]>>): SourceFile => ({
  path: "topology.ts",
  source: `import { topology } from '@keel/server'\nexport default topology({ ${Object.entries(deployables)
    .map(([name, modules]) => `${name}: { modules: ${q(modules)}, adapter: 'node' }`)
    .join(", ")} })\n`,
});
