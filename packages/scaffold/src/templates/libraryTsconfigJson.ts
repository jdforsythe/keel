import { jsonText } from "../internal/jsonText.ts";

/** `tsconfig.json` of a library: the Keel strict profile over its source, tests and configuration. */
export function libraryTsconfigJson(): string {
  const cfg = {
    extends: "@keel/compiler/tsconfig.strict.json",
    compilerOptions: { jsxImportSource: "@keel/runtime-dom", types: ["node", "@keel/compiler/client"] },
    include: ["module.ts", "src", "test", "tokens.ts", "vitest.config.ts"],
  };
  return `${jsonText(cfg)}\n`;
}
