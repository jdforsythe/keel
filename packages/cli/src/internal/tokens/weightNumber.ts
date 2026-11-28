const NAMES: ReadonlyMap<string, number> = new Map([
  ["thin", 100],
  ["hairline", 100],
  ["extralight", 200],
  ["ultralight", 200],
  ["light", 300],
  ["normal", 400],
  ["regular", 400],
  ["book", 400],
  ["medium", 500],
  ["semibold", 600],
  ["demibold", 600],
  ["bold", 700],
  ["extrabold", 800],
  ["ultrabold", 800],
  ["black", 900],
  ["heavy", 900],
  ["extrablack", 950],
  ["ultrablack", 950],
]);

/** A DTCG font weight as the number it stands for: a number from 1 to 1000 as it is, a name by the format's table (case, `-`, `_` and spaces ignored); undefined otherwise. */
export function weightNumber(value: string | number): number | undefined {
  if (typeof value === "number") return Number.isInteger(value) && value >= 1 && value <= 1000 ? value : undefined;
  return NAMES.get(value.toLowerCase().replace(/[\s_-]+/g, ""));
}
