import { DefectError } from "./DefectError.ts";
import { kernelDefects } from "./kernelDefects.ts";

/**
 * Coded error thrown by the engine: `E1201` undeclared write, `E1202` cycle, `E1205` read of a disposed computed,
 * `E1206` `run` on a disposed scope; `E1203` a primitive with no owner and `E1208` an ownerless `scope` outside a module
 * root are defects (k.defects), recorded in the realm's kernel record (k.identity) with a non-enumerable `code`.
 */
export function fail(code: "E1201" | "E1202" | "E1203" | "E1205" | "E1206" | "E1208", message: string): Error {
  if (code !== "E1203" && code !== "E1208")
    return Object.assign(new Error(`${code} ${message}`), { code, see: "k.reactive" });
  const e = new DefectError(`${code} ${message}`);
  Object.defineProperty(e, "code", { value: code });
  Object.defineProperty(e, "see", { value: "k.reactive" });
  kernelDefects().add(e);
  return e;
}
