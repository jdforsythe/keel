import { evalOnHeap } from "../../../unsafe/evalOnHeap.ts";
import type { Tools } from "./Tools.ts";
import { proveError } from "./proveError.ts";

let loaded: Promise<Tools> | undefined;

/** Load oxc-parser and the optional peer `z3-solver` once; E1718 when `z3-solver` cannot be loaded. */
export function loadTools(): Promise<Tools> {
  loaded ??= (async () => {
    const z3 = await import("z3-solver").catch((cause: unknown) => {
      throw Object.assign(
        proveError("E1718", "prove needs the optional peer dependency z3-solver; add it to devDependencies", {
          fix: '+    "z3-solver": "5.3.3"',
        }),
        { cause },
      );
    });
    const { parseSync } = await import("oxc-parser");
    const { Z3, em } = await z3.init();
    const v = Z3.get_version();
    return {
      parse: parseSync,
      version: `${v.major}.${v.minor}.${v.build_number}`,
      open: () => {
        const config = Z3.mk_config();
        const c = Z3.mk_context(config);
        Z3.del_config(config);
        return { run: (text: string) => evalOnHeap(em, c, text), close: () => Z3.del_context(c) };
      },
    };
  })();
  const pending = loaded;
  pending.catch(() => {
    if (loaded === pending) loaded = undefined;
  });
  return pending;
}
