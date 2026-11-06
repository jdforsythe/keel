import ts from "typescript";

/**
 * The strict profile of `tsconfig.base.json` as compiler options, plus what an in-memory check needs:
 * `noEmit`, `.ts` import paths, global JSX typing (no `jsxImportSource`), and no ambient `@types`.
 */
export function tsCompilerOptions(): ts.CompilerOptions {
  return {
    strict: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    noImplicitOverride: true,
    verbatimModuleSyntax: true,
    isolatedModules: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.Preserve,
    skipLibCheck: true,
    noEmit: true,
    allowImportingTsExtensions: true,
    types: [],
  };
}
