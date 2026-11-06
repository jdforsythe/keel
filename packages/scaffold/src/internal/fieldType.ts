const BASES = new Set(["string", "number", "int", "boolean"]);
const MODS = new Set(["optional", "nullable"]);

/** Parse a field type `base(.optional|.nullable)*` into its `s` expression, or null when it is not one. */
export function fieldType(type: string): { expr: string; optional: boolean } | null {
  const [base, ...mods] = type.split(".");
  if (base === undefined || !BASES.has(base) || !mods.every((m) => MODS.has(m))) return null;
  return { expr: `s.${base}()${mods.map((m) => ".".concat(m, "()")).join("")}`, optional: mods.includes("optional") };
}
