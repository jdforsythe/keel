// Spec: k.library, clause "In that project, the `project` a registered rule sees for `src/Badge.tsx` holds the library's `module.ts` at `modules/charts/module.ts`."
// Seed 1337 (no generated input).
// ASSUMPTIONS (spec silent): "that project" is library-rules.test.ts's (`modules/shop/module.ts` lists `@acme/charts`, the library under `node_modules/@acme/charts/`, id `charts`); the rule records `project` for each file it checks and reports nothing;
// a rule sees a library's file `<f>` as `modules/<id>/<f>` (k.library In an app), so `src/Badge.tsx` is `modules/charts/src/Badge.tsx` as the rule's `file.path`; the library's `module.ts` is judged by its `modules/charts/module.ts` path, whatever the installed path, and no project entry holds `node_modules/@acme/charts/module.ts`.
import { check, defineRule } from "@keel/check";
import type { SourceFile } from "@keel/check";
import { expect, test } from "vitest";
import { type Files, manifestFile } from "./module-support.ts";

const NO_TYPES = { types: false } as const;
const ROOT = "node_modules/@acme/charts";
const LEDGER = `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, rungs: {}, mutation: {}, exports: [], clauses: [], a11y: [] })}\n`;

const seen = new Map<string, readonly SourceFile[]>();
defineRule({
  code: "E2912",
  message: "library project probe",
  see: "k.library",
  explain: "Records the project files a rule receives.",
  check: ({ file, project }) => {
    seen.set(file.path, project);
    return [];
  },
});

const files: Files = [
  manifestFile({ id: "shop", deps: ["@acme/charts"] }),
  {
    path: "modules/shop/Page.tsx",
    source:
      "import { Badge } from '@acme/charts'\nexport default function Page() { return <Badge id=\"shop.badge\" /> }\n",
  },
  {
    path: `${ROOT}/package.json`,
    source: JSON.stringify({
      name: "@acme/charts",
      version: "1.0.0",
      type: "module",
      keel: "library",
      exports: { ".": { keel: "./src/index.ts", default: "./index.js" } },
    }),
  },
  { path: `${ROOT}/index.js`, source: "export {}\n" },
  manifestFile({ id: "charts", deps: [], exports: ["Badge"] }, ROOT),
  { path: `${ROOT}/src/index.ts`, source: "export { default as Badge } from './Badge.tsx'\n" },
  {
    path: `${ROOT}/src/Badge.tsx`,
    source:
      "import { Box } from '@keel/ui'\nexport default function Badge(props: { id: string }) {\n  return <Box id={`${props.id}.box`} p=\"2\" />\n}\n",
  },
  { path: `${ROOT}/.keel/ledger.json`, source: LEDGER },
];
const badge = "modules/charts/src/Badge.tsx";
const run = (): readonly SourceFile[] | undefined => {
  seen.clear();
  check(files, NO_TYPES);
  return seen.get(badge);
};

test("In that project, the `project` a registered rule sees for `src/Badge.tsx` holds the library's `module.ts` at `modules/charts/module.ts`", () => {
  const project = run();
  expect(project).toBeDefined();
  expect((project ?? []).map((f) => f.path)).toContain("modules/charts/module.ts");
});

test("that `modules/charts/module.ts` holds the library's manifest source", () => {
  const manifest = files.find((f) => f.path === `${ROOT}/module.ts`);
  const held = (run() ?? []).find((f) => f.path === "modules/charts/module.ts");
  expect(manifest).toBeDefined();
  expect(held?.source).toBe(manifest?.source);
});
