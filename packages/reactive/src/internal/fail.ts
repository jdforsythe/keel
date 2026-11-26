import { DefectError } from "./DefectError.ts";

/** The own key that marks a defect (k.errors Defects), registered, so `@keel/schema`'s `isDefect` knows the engine's. */
const DEFECT_KEY = Symbol.for("keel.defect");

/**
 * Coded error thrown by the engine: `E1201` undeclared write, `E1202` cycle, `E1205` read of a disposed computed,
 * `E1206` `run` on a disposed scope; `E1203` a primitive with no owner and `E1208` an ownerless `scope` outside a module
 * root are defects (k.errors), marked by `Symbol.for('keel.defect')` with a non-enumerable `code`.
 */
export function fail(code: "E1201" | "E1202" | "E1203" | "E1205" | "E1206" | "E1208", message: string): Error {
  if (code !== "E1203" && code !== "E1208")
    return Object.assign(new Error(`${code} ${message}`), { code, see: "k.reactive" });
  const e = new DefectError(`${code} ${message}`);
  Object.defineProperty(e, "code", { value: code });
  Object.defineProperty(e, "see", { value: "k.reactive" });
  Object.defineProperty(e, DEFECT_KEY, { value: true });
  return e;
}
