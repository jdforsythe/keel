import type { Cron } from "./Cron.ts";

const FIELDS = [
  ["minute", 0, 59],
  ["hour", 0, 23],
  ["day of month", 1, 31],
  ["month", 1, 12],
  ["day of week", 0, 6],
] as const;

/**
 * Parse a five-field cron (std.schedules): each field `*`, `n`, `a-b` or a comma list of those, each with an optional
 * `/step` (`n/step` steps from `n` to the field's maximum). A failure is the reason, naming the field.
 */
export function parseCron(text: string): Cron | string {
  const parts = text.trim().split(/\s+/);
  const sets: number[][] = [];
  for (const [i, [name, lo, hi]] of FIELDS.entries()) {
    const part = parts[i];
    if (part === undefined) return `${name} field missing`;
    const set = new Set<number>();
    for (const item of part.split(",")) {
      const m = /^(?:\*|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/.exec(item);
      if (m === null) return `${name} field '${part.slice(0, 20)}' is not *, n, a-b or a list`;
      const a = m[1] === undefined ? lo : Number(m[1]);
      const b = m[2] !== undefined ? Number(m[2]) : m[1] === undefined || m[3] !== undefined ? hi : a;
      const step = Number(m[3] ?? 1);
      if (a < lo || b > hi || a > b || step < 1) return `${name} field '${part.slice(0, 20)}' is outside ${lo}-${hi}`;
      for (let v = a; v <= b; v += step) set.add(v);
    }
    sets.push([...set].sort((x, y) => x - y));
  }
  if (parts.length > 5) return `extra field '${String(parts[5]).slice(0, 20)}'; cron has five`;
  const [mi = [], h = [], dom = [], mon = [], dow = []] = sets;
  return { mi, h, dom, mon, dow, domR: parts[2] !== "*", dowR: parts[4] !== "*" };
}
