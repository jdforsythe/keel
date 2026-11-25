import { jsonText } from "../internal/jsonText.ts";

/**
 * `tsconfig.build.json` of a library: `src/` built to `dist/src/` with declarations, the files Node imports at check
 * time (k.library-pack Package). JSX compiles to `@keel/runtime-dom/jsx-runtime` calls, so the built entry imports;
 * an app renders the library's source, which its compiler lowers.
 */
export function libraryTsconfigBuildJson(): string {
  const cfg = {
    extends: "./tsconfig.json",
    compilerOptions: {
      noEmit: false,
      allowImportingTsExtensions: false,
      rewriteRelativeImportExtensions: true,
      declaration: true,
      jsx: "react-jsx",
      outDir: "dist",
      rootDir: ".",
    },
    include: ["src"],
  };
  return `${jsonText(cfg)}\n`;
}
