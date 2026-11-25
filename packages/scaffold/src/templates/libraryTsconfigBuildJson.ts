import { jsonText } from "../internal/jsonText.ts";

/**
 * `tsconfig.build.json` of a library: `src/` built to `dist/src/` with declarations (k.library-pack Package). An app's
 * compiler and check read the library's source; Keel imports a built file only through a `./tools` export.
 */
export function libraryTsconfigBuildJson(): string {
  const cfg = {
    extends: "./tsconfig.json",
    compilerOptions: {
      noEmit: false,
      allowImportingTsExtensions: false,
      rewriteRelativeImportExtensions: true,
      declaration: true,
      outDir: "dist",
      rootDir: ".",
    },
    include: ["src"],
  };
  return `${jsonText(cfg)}\n`;
}
