// `Host` as a base element in the compiler (k.host-element): its id entry, its `data-k` stamp, its style props, and a
// host element code file's stylesheet at build-time evaluation (k.host-code).
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compile } from "../src/index.ts";
import { evaluateProject } from "../src/internal/evaluateProject.ts";

const packages = path.dirname(fs.realpathSync(path.join(import.meta.dirname, "..", "node_modules", "@keel", "schema")));
const HEAD = "import { Host } from '@keel/ui'\nimport { In } from './In.schema.ts'\n";
const CODE = "code={() => import('./chart.ts').then((m) => m.chart)}";
const page = (attrs: string): string =>
  `${HEAD}export default function C() { return <Host id="c.h" ${attrs} input={In} value={{ n: 1 }} ${CODE} /> }\n`;

describe("Host in the compiler", () => {
  it("is in ids.json and a11y.json as a `div` with its role and an ARIA name", () => {
    const r = compile([{ path: "modules/a/C.tsx", source: page('role="img" label="Chart"') }]);
    expect(r.diagnostics).toEqual([]);
    expect(r.artifacts["ids.json"]["c.h"]).toMatchObject({ tag: "div", role: "img", component: "C" });
    expect(r.artifacts["a11y.json"]["c.h"]).toEqual({ name: "aria", role: "img", tag: "div" });
    const group = compile([{ path: "modules/a/C.tsx", source: page('role="group" labelledBy="c.t"') }]);
    expect(group.artifacts["ids.json"]["c.h"]).toMatchObject({ role: "group" });
  });

  it("is stamped with its literal id, its style props become a class, and `code` stays a function", () => {
    const r = compile([{ path: "modules/a/C.tsx", source: page('role="img" label="Chart" h="2"') }]);
    const code = r.outputs[0]?.code ?? "";
    expect(code).toContain('stamp("c.h", Host)(');
    expect(code).toContain('class: "k-h-2"');
    expect(code).toContain("get code() { return (() => import('./chart.ts').then((m) => m.chart)); }");
    expect(r.artifacts["styles.json"].usages).toEqual([{ props: { h: "2" } }]);
  });
});

describe("a host element code file's stylesheet at build-time evaluation", () => {
  let root = "";
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("a `.css` import in the code a route reaches evaluates to nothing in Node", { timeout: 30000 }, async () => {
    root = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-host-css-"));
    const write = (rel: string, text: string): void => {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), text);
    };
    fs.mkdirSync(path.join(root, "node_modules", "@keel"), { recursive: true });
    for (const p of fs.readdirSync(packages))
      if (fs.existsSync(path.join(packages, p, "package.json")))
        fs.symlinkSync(path.join(packages, p), path.join(root, "node_modules", "@keel", p));
    write("modules/m/chart.css", ".x{color:red}\n");
    write("modules/m/chart.ts", 'import "./chart.css";\nexport const chart = 1;\n');
    write(
      "modules/m/m.contract.ts",
      'import { contract } from "@keel/router/contract";\nexport const m = contract("m", { "m.a": { path: "/a" } });\n',
    );
    write(
      "modules/m/routes.ts",
      'import { manifest } from "@keel/router";\nimport { m } from "./m.contract.ts";\n' +
        'export const load = () => import("./chart.ts").then((x) => x.chart);\n' +
        'const V = () => null;\nexport const routes = manifest(m, { "m.a": { component: V } });\n',
    );
    const r = await evaluateProject({ root, tokensFile: undefined, routesFiles: ["modules/m/routes.ts"], usages: [] });
    expect(r.problems).toEqual([]);
    expect(r.routes["m.a"]?.path).toBe("/a");
  });
});
