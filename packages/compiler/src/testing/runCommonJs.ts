/**
 * Runs CommonJS module text in-process with the given `require` and returns `module.exports`. Hazard: `new Function`
 * executes `js` with this process's authority, outside the compiler's no-eval guarantee. It is safe only because its
 * one caller is the test helper `evaluate`, which passes `compile()` output of repository fixtures, and `src/testing`
 * is left out of the published build (`tsconfig.build.json`).
 */
export function runCommonJs(js: string, require: (id: string) => unknown): unknown {
  const module: { exports: unknown } = { exports: {} };
  const run = new Function("require", "module", "exports", js);
  run(require, module, module.exports);
  return module.exports;
}
