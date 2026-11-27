/**
 * Coded error thrown by the engine: `E1201` undeclared write, `E1202` cycle, `E1205` read of a disposed computed,
 * `E1206` `run` on a disposed scope. E1203 and E1208 are defects (k.defects), raised by `defect` where they occur.
 */
export function fail(code: "E1201" | "E1202" | "E1205" | "E1206", message: string): Error {
  return Object.assign(new Error(`${code} ${message}`), { code, see: "k.reactive" });
}
