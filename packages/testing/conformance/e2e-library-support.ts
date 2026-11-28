// Support for the library conformance files (not a test file): a library folder as a fixture project tree. Seed 1337.
import { FAILURE } from "./e2e-support.ts";
import type { Tree } from "./fixtures/e2e/node-app.ts";

const DEV = ["@keel/cli", "@keel/compiler", "@keel/router", "@keel/server", "@keel/testing"];
export const library = (omit: string | undefined): Tree => ({
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
