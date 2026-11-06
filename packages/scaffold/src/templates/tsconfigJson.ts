import { jsonText } from "../internal/jsonText.ts";

/** `tsconfig.json` of a new project: extends the Keel strict profile; a workspace project also covers `test/` and `vitest.config.ts`. */
export function tsconfigJson(workspace = false): string {
  const cfg = {
    extends: "@keel/compiler/tsconfig.strict.json",
    compilerOptions: { jsxImportSource: "@keel/runtime-dom" },
    include: workspace
      ? ["modules", "test", "tokens.ts", "topology.ts", "vite.config.ts", "vitest.config.ts"]
      : ["tokens.ts", "topology.ts", "vite.config.ts", "modules"],
  };
  return `${jsonText(cfg)}\n`;
}
