// Support for the a11y ledger conformance tests that run the real `keel` binary over temp projects. Not a test file.
// Projects live under the OS tmpdir. Assumed, as a11y-ledger-claims.test.ts: route ids carry the module prefix (`m.r`),
// `keel build` (node-only topology) writes `.keel/routes.json` and `.keel/a11y.json`, and `keel test` writes `reports/a11y.json`.
import { existsSync, readFileSync, readdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { collect } from "./ledger-fixture-kinds.ts";
import { type CliRecord, type Run, childOutput, keel, makeProject, root } from "./test-sim-project.ts";

/** The fixture test's environment line is joined from two parts so vitest does not read it as the support file's own. */
export const ENV = ["// @vitest", "environment happy-dom"].join("-");
export const TOPOLOGY = `export default { api: { modules: ["m"], adapter: "node" } };\n`;
export const COMMITTED = "tooling/ledger/ledger.json";

/** `fg` over `#ffffff`: 4.5:1 or better for `#111111`, 4.41:1 for `#787878`, below 3.5:1 for `#8a8a8a`. */
export const tokensSource = (fg: string): string =>
  `import { defineTokens } from "@keel/ui";\nexport const tokens = defineTokens({ color: { fg: "${fg}", bg: "#ffffff" } });\n`;

/** A temp project with every `@keel/*` package linked. The caller removes it. */
export function keelProject(prefix: string, files: Readonly<Record<string, string>>): string {
  const dir = makeProject(prefix, files);
  for (const pkg of readdirSync(join(root, "packages"))) {
    const at = join(dir, "node_modules", "@keel", pkg);
    if (!existsSync(at)) symlinkSync(join(root, "packages", pkg), at);
  }
  return dir;
}

/** Module `m`'s contract and routes holding one page per short id (`r` is `m.r` at `/r`); text takes the `fg` token when `styled`. */
export function moduleFiles(ids: readonly string[], styled: boolean): Record<string, string> {
  const entries = ids.map((id) => `  "m.${id}": { path: "/${id}" },`).join("\n");
  const bound = ids
    .map(
      (id) =>
        `  "m.${id}": { component: () => Text({ id: "m.${id}.msg", ${styled ? 'fg: "fg", ' : ""}children: "${id}" }), title: () => "${id}" },`,
    )
    .join("\n");
  return {
    "topology.ts": TOPOLOGY,
    "modules/m/m.contract.ts": `import { contract } from "@keel/router/contract";\nexport const m = contract("m", {\n${entries}\n});\n`,
    "modules/m/routes.ts": `import { manifest } from "@keel/router";\nimport { Text } from "@keel/ui";\nimport { m } from "./m.contract.ts";\n\nexport const routes = manifest(m, {\n${bound}\n});\n`,
  };
}

/** The head of a fixture test; `tokens` adds the import of the project's `tokens.ts`. */
export const testHead = (tokens: boolean): string => `${ENV}
import { createCtx } from "@keel/ctx";
import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
${tokens ? 'import { tokens } from "../../../tokens.ts";\n' : ""}import { routes } from "../routes.ts";
const ctx = () => createCtx({ mode: "sim", seed: 1337 });
`;

/** `keel build` must succeed; `keel test` is returned, its status is the caller's to judge. */
export function buildAndTest(dir: string): Run {
  const built = keel(dir, ["build"]);
  if (built.status !== 0)
    throw new Error(`keel build failed in ${dir} (status ${String(built.status)}): ${childOutput(built)}`);
  return keel(dir, ["test"]);
}

export const itemRecord = (run: Run, item: string): CliRecord | undefined =>
  run.records.find((r) => r.kind === "ledger" && r.item === item);

/** Every a11y item key the run emitted. */
export const a11yItems = (run: Run): string[] =>
  run.records.flatMap((r) =>
    r.kind === "ledger" && typeof r.item === "string" && r.item.startsWith("a11y:") ? [r.item] : [],
  );

export type SeenRun = { route: string; rules: string[]; violations: string[]; test: string; passed: boolean };

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** The runs of `<dir>/reports/a11y.json`, reduced to the fields the tests read (violations as rule names). */
export function runsOf(dir: string): SeenRun[] {
  const parsed: unknown = JSON.parse(readFileSync(join(dir, "reports", "a11y.json"), "utf8"));
  return collect(parsed, ["route", "rules", "violations", "test"]).flatMap((r) => {
    const { route, test, passed } = r;
    if (typeof route !== "string" || typeof test !== "string") return [];
    const violations = Array.isArray(r.violations)
      ? r.violations.flatMap((x) => {
          const rule = collect(x, ["rule"])[0]?.rule;
          return typeof rule === "string" ? [rule] : [];
        })
      : [];
    return [{ route, rules: strings(r.rules), violations, test, passed: passed === true }];
  });
}
