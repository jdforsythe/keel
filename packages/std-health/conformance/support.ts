// Shared helpers for the std.health conformance suite (not a test file). Seed 1337.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { check } from "@keel/check";

export const SEED = 1337;
export type Files = Parameters<typeof check>[0];

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (rel: string): string => readFileSync(`${root}${rel}`, "utf8");

/** The package's real files at their node_modules paths: module.ts and every src/*.ts. */
export function packageFiles(): Files {
  const src = readdirSync(`${root}src`).filter((f) => f.endsWith(".ts"));
  return [
    { path: "node_modules/@keel/std-health/module.ts", source: read("module.ts") },
    ...src.map((f) => ({ path: `node_modules/@keel/std-health/src/${f}`, source: read(`src/${f}`) })),
  ];
}

/** An app module `orders` that imports `@keel/std-health/<file>`; `deps` is its manifest deps. */
export function appFiles(deps: string[], file: string): Files {
  const list = deps.map((d) => `'${d}'`).join(", ");
  return [
    {
      path: "modules/orders/module.ts",
      source: `import { module } from '@keel/compiler'
export default module({ id: 'orders', deps: [${list}], capabilities: [], public: { exports: [] } })
`,
    },
    {
      path: "modules/orders/OrderCard.ts",
      source: `import { ${file} } from '@keel/std-health/${file}'\nexport const OrderCard = ${file}\n`,
    },
  ];
}

export const moduleCodes = (files: Files) =>
  check(files, { types: false }).diagnostics.filter((d) => /^E115[1-7]$/.test(d.code));
