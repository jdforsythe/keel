import { unsafe } from "./unsafe.ts";

/** Run CommonJS module text in-process with the given `require`; returns `module.exports`. */
export function runCommonJs(js: string, require: (id: string) => unknown): unknown {
  return unsafe("test harness only: evaluates compile() output in-process via new Function (no sandbox)", () => {
    const module: { exports: unknown } = { exports: {} };
    const run = new Function("require", "module", "exports", js);
    run(require, module, module.exports);
    return module.exports;
  });
}
