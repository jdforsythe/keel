import * as reactive from "@keel/reactive";
import * as runtimeDom from "@keel/runtime-dom";
import * as ops from "@keel/runtime-dom/ops";
import * as schema from "@keel/schema";
import * as store from "@keel/store";
import { transformSync } from "esbuild";
import { runCommonJs } from "../../unsafe/runCommonJs.ts";

const MODULES: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ["@keel/reactive", reactive],
  ["@keel/runtime-dom", runtimeDom],
  ["@keel/runtime-dom/ops", ops],
  ["@keel/schema", schema],
  ["@keel/store", store],
]);

function resolve(id: string): unknown {
  const m = MODULES.get(id);
  if (m === undefined) throw new Error(`evaluate: cannot require ${JSON.stringify(id)} (only @keel kernel modules)`);
  return m;
}

/**
 * Test helper: strip types from one `compile()` output, run it in-process against the live kernel
 * modules, and return its default export. Module-level reactive primitives are created inside a root
 * `scope` that is never disposed (it lives as long as the evaluated module).
 */
export function evaluate(code: string): unknown {
  const js = transformSync(code, { loader: "ts", format: "cjs", target: "es2022" }).code;
  let exported: unknown;
  reactive.scope(() => {
    exported = runCommonJs(js, resolve);
  });
  return typeof exported === "object" && exported !== null ? Reflect.get(exported, "default") : undefined;
}
