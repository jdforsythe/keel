/** JSON text in biome's layout: two-space objects, arrays of scalars on one line, trailing newline. */
export function jsonText(value: unknown, indent = ""): string {
  if (Array.isArray(value)) {
    if (value.every((v) => v === null || typeof v !== "object"))
      return `[${value.map((v) => JSON.stringify(v)).join(", ")}]`;
    const inner = value.map((v) => `${indent}  ${jsonText(v, `${indent}  `)}`);
    return `[\n${inner.join(",\n")}\n${indent}]`;
  }
  if (value !== null && typeof value === "object") {
    const inner = Object.entries(value).map(
      ([k, v]) => `${indent}  ${JSON.stringify(k)}: ${jsonText(v, `${indent}  `)}`,
    );
    return inner.length === 0 ? "{}" : `{\n${inner.join(",\n")}\n${indent}}`;
  }
  return JSON.stringify(value);
}
