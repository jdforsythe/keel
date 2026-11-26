// @vitest-environment node
// Spec: k.e2e, clause "In a library folder holding `src/Card.ts` and `@keel/compiler`, `@keel/router` and `@keel/server` in `devDependencies`, `serve({ page: 'src/Card.ts', props: { title: 'Hi' } })` serves a page whose `find('card.title')` text is `Hi`; without `@keel/router` it rejects E1737 naming `@keel/router`."
// k.e2e Rules E1737 (a host package missing) is asserted by the second part of the case.
// Seed: n/a (no generated input). Method: as e2e-serve.test.ts: a library folder (package.json `"keel": "library"`, `module.ts`, `src/Card.ts`, `tokens.ts`) whose e2e file runs under `keel test --e2e`; the run's report is read.
// The cases need Chromium (e2e-support.ts); none skips. Both libraries link every `@keel/*` package of the workspace but the one `omit` names, and list the packages their `devDependencies` hold.
// ASSUMED: (1) `Card.ts` is a plain `.ts` file, so it calls `Box` and `Text` as functions and its default export is named `Card`; (2) E1161 (an id built on `props.id`) holds in a library, so `Card` takes its `id` from `props` and the case
// passes `props: { id: 'card', title: 'Hi' }`: the clause's `props: { title: 'Hi' }` gives `Card` no `id` to build `card.title` on, and the spec does not say the host supplies one (AMBIGUOUS); (3) `.keel/e2e-host/topology.ts` names the
// deployable `web`; (4) `serve`'s `page` is a path (k.e2e Libraries), so the case does not type-check against a `page` typed as a component.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FAILURE, type Run, cleanup, keelE2e, outcome, project, reasons, suite } from "./e2e-support.ts";

const DEV = ["@keel/cli", "@keel/compiler", "@keel/router", "@keel/server", "@keel/testing"];
const library = (omit: string | undefined): Record<string, string> => ({
  "package.json": `${JSON.stringify(
    {
      name: "@acme/cards",
      version: "0.1.0",
      type: "module",
      keel: "library",
      exports: { ".": { keel: "./src/index.ts", types: "./dist/src/index.d.ts", default: "./dist/src/index.js" } },
      peerDependencies: {
        "@keel/compiler": "*",
        "@keel/reactive": "*",
        "@keel/runtime-dom": "*",
        "@keel/schema": "*",
        "@keel/ui": "*",
      },
      devDependencies: Object.fromEntries(
        [
          ...DEV,
          "@keel/reactive",
          "@keel/runtime-dom",
          "@keel/schema",
          "@keel/ui",
          "@types/node",
          "happy-dom",
          "playwright-core",
          "typescript",
          "vite",
          "vitest",
        ]
          .filter((n) => n !== omit)
          .map((n) => [n, "*"]),
      ),
    },
    null,
    2,
  )}\n`,
  "module.ts":
    "import { module } from '@keel/compiler'\nexport default module({ id: 'cards', deps: [], capabilities: [], public: { exports: ['Card'] } })\n",
  "src/index.ts": 'export { default as Card } from "./Card.ts";\n',
  "src/Card.ts":
    'import { type Infer, s } from "@keel/schema";\nimport { Box, Text } from "@keel/ui";\n\nexport const Props = s.object({ id: s.string(), title: s.string() });\n\nexport default function Card(props: Infer<typeof Props>) {\n  return Box({ as: "section", id: props.id, children: () => Text({ id: `${props.id}.title`, children: () => props.title }) });\n}\n',
  "tokens.ts": 'import { brandTokens } from "@keel/ui/brand";\nexport const tokens = brandTokens;\n',
  "tsconfig.json": `${JSON.stringify(
    {
      extends: "@keel/compiler/tsconfig.strict.json",
      compilerOptions: { jsxImportSource: "@keel/runtime-dom", types: ["node", "@keel/compiler/client"] },
      include: ["module.ts", "src", "test", "tokens.ts", "vitest.config.ts"],
    },
    null,
    2,
  )}\n`,
  "vitest.config.ts":
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vitest/config";\nexport default defineConfig({ plugins: [keel()], test: { environment: "happy-dom" } });\n',
  "test/failure.ts": FAILURE,
});

const withRouter = suite(
  ["import { existsSync, readFileSync } from 'node:fs'", "import { serve } from '@keel/testing/e2e'"],
  [
    {
      title: "a library page is served by its host project",
      body: `const app = await serve({ page: 'src/Card.ts', props: { id: 'card', title: 'Hi' } })
const page = await app.open('/')
expect((await page.find('card.title')).text).toBe('Hi')
expect(existsSync('.keel/e2e-host/topology.ts')).toBe(true)
expect(readFileSync('.keel/e2e-host/topology.ts', 'utf8')).toContain('web')`,
    },
  ],
);
const withoutRouter = suite(
  ["import { serve } from '@keel/testing/e2e'", "import { failure } from './failure.ts'"],
  [
    {
      title: "a library without the router is E1737 naming it",
      body: `const e = await failure(serve({ page: 'src/Card.ts', props: { id: 'card', title: 'Hi' } }))
expect(e.code).toBe('E1737')
expect(e.message).toContain('@keel/router')`,
    },
  ],
);

const FILE = "test/card.e2e.ts";
let withDir = "";
let withoutDir = "";
const runs = new Map<string, Run>();

beforeAll(() => {
  withDir = project({ ...library(undefined), [FILE]: withRouter.source });
  withoutDir = project({ ...library("@keel/router"), [FILE]: withoutRouter.source }, { omit: ["router"] });
  runs.set("with", keelE2e(withDir));
  runs.set("without", keelE2e(withoutDir));
}, 3_000_000);
afterAll(cleanup);

const why = (key: string): string => reasons(runs.get(key));

describe("k.e2e libraries", () => {
  it("In a library folder holding `src/Card.ts` and `@keel/compiler`, `@keel/router` and `@keel/server` in `devDependencies`, `serve({ page: 'src/Card.ts', props: { title: 'Hi' } })` serves a page whose `find('card.title')` text is `Hi`; without `@keel/router` it rejects E1737 naming `@keel/router`", () => {
    const line = withRouter.lines["a library page is served by its host project"];
    expect(outcome(withDir, FILE, line ?? 0), why("with")).toBe("passed");
    const other = withoutRouter.lines["a library without the router is E1737 naming it"];
    expect(outcome(withoutDir, FILE, other ?? 0), why("without")).toBe("passed");
  });
});
