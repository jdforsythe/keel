// Build-time evaluation resolves a package's `exports` with Node's conditions, the file `routeLiterals` reads.
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { evaluateProject } from "../src/internal/evaluateProject.ts";
import { routeLiterals } from "../src/routeLiterals.ts";

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
    JSON.stringify({ exports: { "./routes": { module: "./esm.ts", default: "./plain.ts" } } }),
  );
  write(`${pkg}/esm.ts`, `export const routes = manifest({ "frag.a": { path: "/module" } });\n`);
  write(`${pkg}/plain.ts`, `export const routes = manifest({ "frag.a": { path: "/default" } });\n`);
  write(`${pkg}/manifest.ts`, "export const manifest = (routes: object) => ({ routes });\n");
  for (const f of ["esm.ts", "plain.ts"])
    write(
      `${pkg}/${f}`,
      `import { manifest } from "./manifest.ts";\n${fs.readFileSync(path.join(root, pkg, f), "utf8")}`,
    );
  const routes = `import { routes as x } from "@keel/std-cond/routes";\nexport const routes = { routes: { ...x.routes } };\n`;
  write("modules/m/routes.ts", routes);
  const r = await evaluateProject({ root, tokensFile: undefined, routesFiles: ["modules/m/routes.ts"], usages: [] });
  expect(r.problems).toEqual([]);
  expect(r.routes["frag.a"]?.path).toBe("/default");
  const literal = `import { routes as x } from "@keel/std-cond/routes";\nexport const routes = manifest({ ...x.routes });\n`;
  const mod = `export default module({ id: "m", deps: ["@keel/std-cond"], capabilities: [], public: { exports: [], routes: [] } });\n`;
  const files = [
    { path: "modules/m/module.ts", source: mod },
    { path: "modules/m/routes.ts", source: literal },
  ];
  expect(routeLiterals(files, { root })?.routes["frag.a"]?.path).toBe("/default");
});
