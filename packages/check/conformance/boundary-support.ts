// Project trees for the k.boundary check suites (not a test file). Public API only. Seed 1337 for every property.
import { check } from "@keel/check";
import type { Files } from "./support.ts";

export type Diag = ReturnType<typeof check>["diagnostics"][number];
export type Adapter = "node" | "client" | "static";

export const NO_TYPES = { types: false } as const;

export const file = (path: string, source: string): Files[number] => ({ path, source });

export const manifestOf = (id: string): Files[number] =>
  file(
    `modules/${id}/module.ts`,
    `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`,
  );

/** `topology.ts` declaring each deployable as `name: { modules, adapter }`. */
export const topologyOf = (decls: Record<string, { modules: string[]; adapter: Adapter }>): Files[number] =>
  file(
    "topology.ts",
    `import { topology } from '@keel/server'\nexport default topology({ ${Object.entries(decls)
      .map(
        ([name, d]) => `${name}: { modules: [${d.modules.map((m) => `'${m}'`).join(", ")}], adapter: '${d.adapter}' }`,
      )
      .join(", ")} })\n`,
  );

/** Node `api` lists module `a` and `client` `web` lists module `w`. */
export const nodeA = (extra: Files = []): Files => [
  topologyOf({ api: { modules: ["a"], adapter: "node" }, web: { modules: ["w"], adapter: "client" } }),
  manifestOf("a"),
  manifestOf("w"),
  ...extra,
];

/** Module `a`'s contract: the page `a.show` at `/a`. */
export const CONTRACT_A = file(
  "modules/a/a.contract.ts",
  "import { contract } from '@keel/router/contract'\nexport const a = contract('a', { 'a.show': { path: '/a' } })\n",
);

/** Module `a`'s `routes.ts` naming `Page.tsx` as the component of `a.show`. */
export const ROUTES_A = file(
  "modules/a/routes.ts",
  "import { manifest } from '@keel/router'\nimport { a } from './a.contract.ts'\nimport Page from './Page.tsx'\nexport const routes = manifest(a, { 'a.show': { component: Page } })\n",
);

/** A page component file with `body` after its imports. */
export const pageOf = (imports: string, body = "export default function Page() {\n  return null\n}\n"): Files[number] =>
  file("modules/a/Page.tsx", `${imports}${body}`);

/** The diagnostics of `files` with `code`. */
export const diagsOf = (files: Files, code: string): Diag[] =>
  check(files, NO_TYPES).diagnostics.filter((d) => d.code === code);
