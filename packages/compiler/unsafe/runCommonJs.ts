import { unsafe } from "./unsafe.ts";

/** Workspace-only (excluded from the published build; see tsconfig.build.json). Run CommonJS module text in-process with the given `require`; returns `module.exports`. */
export function runCommonJs(js: string, require: (id: string) => unknown): unknown {
  return unsafe(
    "bypasses the compiler's no-eval and sandbox guarantee; acceptable only because the sole callers are tests and conformance harnesses (src/testing, excluded from the build and not in dist) running trusted compile() output of repo fixtures",
    () => {
      const module: { exports: unknown } = { exports: {} };
      const run = new Function("require", "module", "exports", js);
      run(require, module, module.exports);
      return module.exports;
    },
  );
}
