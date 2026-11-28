/** `YYYY-MM-DDTHH:MM[:SS[.fraction]]` then `Z` or a `±HH:MM` offset (`±HHMM`, `±HH` too). */
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?(Z|[+-]\d{2}(?::?\d{2})?)$/;
const DAY_MS = 86_400_000;

const leap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const daysIn = (y: number, m: number): number => (m === 2 ? (leap(y) ? 29 : 28) : [4, 6, 9, 11].includes(m) ? 30 : 31);

/** Days from 1970-01-01 to the civil date `y-m-d` (proleptic Gregorian). */
function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146_097 + doe - 719_468;
}

/**
 * The epoch milliseconds of an ISO 8601 instant (a date, a time and `Z` or an offset), by arithmetic; `undefined` for
 * anything else, a date or time out of range included. Digits past milliseconds are dropped.
 */
export function isoInstantMs(text: string): number | undefined {
  const m = INSTANT.exec(text);
  if (m === null) return undefined;
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? "0"].map(Number);
  if (y === undefined || mo === undefined || d === undefined || h === undefined || mi === undefined || s === undefined)
    return undefined;
  if (mo < 1 || mo > 12 || d < 1 || d > daysIn(y, mo) || h > 23 || mi > 59 || s > 59) return undefined;
  const ms = Number((m[7] ?? "").padEnd(3, "0").slice(0, 3));
  const zone = m[8] ?? "Z";
  let offset = 0;
  if (zone !== "Z") {
    const digits = zone.slice(1).replace(":", "");
    const oh = Number(digits.slice(0, 2));
    const om = Number(digits.slice(2, 4) || "0");
    if (oh > 23 || om > 59) return undefined;
    offset = (zone.startsWith("-") ? -1 : 1) * (oh * 60 + om) * 60_000;
  }
  return daysFromCivil(y, mo, d) * DAY_MS + ((h * 60 + mi) * 60 + s) * 1000 + ms - offset;
}
