/**
 * Coded error thrown by the engine: `E1201` undeclared write, `E1202` cycle, `E1203` no scope,
 * `E1205` read of a disposed computed, `E1206` `run` on a disposed scope.
 */
export function fail(
  code: "E1201" | "E1202" | "E1203" | "E1205" | "E1206",
  message: string,
): Error & { code: string; see: string } {
  return Object.assign(new Error(`${code} ${message}`), { code, see: "k.reactive" });
}
