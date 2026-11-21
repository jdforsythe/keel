// Build-time evaluation resolves a package's `exports` with Node's conditions, the file `routeLiterals` reads.
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { evaluateProject } from "../src/internal/evaluateProject.ts";
import { routeLiterals } from "../src/routeLiterals.ts";
import { stdRoutes } from "../src/std/stdRoutes.ts";

const packages = path.dirname(fs.realpathSync(path.join(import.meta.dirname, "..", "node_modules", "@keel", "schema")));
let root = "";
const write = (rel: string, text: string): void => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};
beforeEach(() => {
  root = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-cond-"));
  fs.mkdirSync(path.join(root, "node_modules", "@keel"), { recursive: true });
  for (const p of fs.readdirSync(packages))
    if (fs.existsSync(path.join(packages, p, "package.json")))
      fs.symlinkSync(path.join(packages, p), path.join(root, "node_modules", "@keel", p));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

it("evaluates and reads the `default` file of a `module` and `default` exports map", { timeout: 30000 }, async () => {
  const pkg = "node_modules/@keel/std-cond";
  write(
    `${pkg}/package.json`,
    JSON.stringify({
      exports: { "./contract": "./contract.ts", "./routes": { module: "./esm.ts", default: "./plain.ts" } },
    }),
  );
  write(`${pkg}/module.ts`, 'export default { id: "frag", deps: [], capabilities: [], public: { exports: [] } };\n');
  write(
    `${pkg}/contract.ts`,
    'import { contract } from "@keel/router/contract";\nexport const frag = contract("frag", { "frag.a": { path: "/a" } });\n',
  );
  const bound = (verb: string): string =>
    `import { action, manifest } from "@keel/router";\nimport { ok } from "@keel/schema";\nimport { frag } from "./contract.ts";\nconst V = () => null;\nexport const routes = manifest(frag, { "frag.a": { component: V${verb} } });\n`;
  write(`${pkg}/esm.ts`, bound(`, PUT: action(frag, "frag.a", {}, async () => ok(null))`));
  write(`${pkg}/plain.ts`, bound(`, POST: action(frag, "frag.a", {}, async () => ok(null))`));
  const mod = `export default module({ id: "m", deps: ["@keel/std-cond"], capabilities: [], public: { exports: [] } });\n`;
  write("modules/m/module.ts", mod);
  const topology = { web: { modules: ["frag"], adapter: "node" as const } };
  const file = stdRoutes(root, "frag")?.[0] ?? "";
  expect(file.endsWith("plain.ts")).toBe(true);
  const r = await evaluateProject({ root, tokensFile: undefined, routesFiles: [file], usages: [] });
  expect(r.problems).toEqual([]);
  expect(r.routes["frag.a"]?.actions).toEqual(["POST"]);
  const files = [{ path: "modules/m/module.ts", source: mod }];
  expect(routeLiterals(files, { root, topology })?.routes["frag.a"]?.actions).toEqual(["POST"]);
});
