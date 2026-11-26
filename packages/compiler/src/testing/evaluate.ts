import * as reactive from "@keel/reactive";
import * as reactiveInternal from "@keel/reactive/internal";
import * as runtimeDom from "@keel/runtime-dom";
import * as ops from "@keel/runtime-dom/ops";
import * as schema from "@keel/schema";
import * as store from "@keel/store";
import { transformSync } from "esbuild";
import { runCommonJs } from "./runCommonJs.ts";

const MODULES: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ["@keel/reactive", reactive],
  ["@keel/reactive/internal", reactiveInternal],
  ["@keel/runtime-dom", runtimeDom],
  ["@keel/runtime-dom/ops", ops],
  ["@keel/schema", schema],
  ["@keel/store", store],
]);

function resolver(extra: Readonly<Record<string, unknown>>): (id: string) => unknown {
  return (id) => {
    const m = Object.hasOwn(extra, id) ? extra[id] : MODULES.get(id);
    if (m === undefined)
      throw new Error(`evaluate: cannot require ${JSON.stringify(id)} (kernel modules and the given modules only)`);
    return m;
  };
}

/**
 * Test helper: strip types from one `compile()` output, run it in-process against the live kernel
 * modules, and return its default export. `modules` adds or overrides specifiers by id, for packages later in
 * the dependency order than the compiler (e.g. `{ "@keel/ui": ui }` from a testing suite) or probes; the compiler
 * itself never imports them. The module runs inside a detached root `scope` that is never disposed (it lives as long as
 * the evaluated module); each top-level statement holding a call runs in its own module root, as compiled code does.
 */
export function evaluate(code: string, modules: Readonly<Record<string, unknown>> = {}): unknown {
  const js = transformSync(code, { loader: "ts", format: "cjs", target: "es2022" }).code;
  let exported: unknown;
  reactive.scope(
    () => {
      exported = runCommonJs(js, resolver(modules));
    },
    { detached: true },
  );
  return typeof exported === "object" && exported !== null ? Reflect.get(exported, "default") : undefined;
}
