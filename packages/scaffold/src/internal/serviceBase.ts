import { callArgObject } from "./callArgObject.ts";
import { parseSource } from "./parseSource.ts";
import { propertyValue } from "./propertyValue.ts";

/** The `base` string literal of the first `service({ base, ... })` call of a source, else undefined. */
export function serviceBase(path: string, source: string): string | undefined {
  const program = parseSource(path, source);
  const arg = program === null ? null : callArgObject(program, "service");
  const v = arg === null ? null : propertyValue(arg, "base");
  return v?.type === "Literal" && typeof v.value === "string" ? v.value : undefined;
}
