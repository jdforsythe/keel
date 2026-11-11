// std.schedules: the next fire time after `t` matches the cron in `zone`, no minute between matches; a skipped local
// time fires at the first minute after the gap, a repeated one at its first occurrence. Checked against an independent
// minute scan: minute `i` fires when a matching wall time lies in (the latest wall reading before `i`, the reading at
// `i`]. Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { parseCron } from "../src/internal/parseCron.ts";
import { seek } from "../src/internal/seek.ts";

const MIN = 60_000;
const ZONES = ["UTC", "Europe/Berlin", "America/New_York", "Australia/Lord_Howe", "Asia/Kolkata"];
const fmt = new Map<string, Intl.DateTimeFormat>();
function wall(zone: string, minute: number): number {
  const f =
    fmt.get(zone) ??
    new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  fmt.set(zone, f);
  const p = Object.fromEntries(f.formatToParts(minute * MIN).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year ?? 0, (p.month ?? 1) - 1, p.day ?? 1, p.hour ?? 0, p.minute ?? 0) / MIN;
}
const UTC_DAY = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});
function matches(cron: string, w: number): boolean {
  const [mi = "", ho = "", dm = "", mo = "", dw = ""] = cron.split(" ");
  const has = (f: string, v: number, lo: number, hi: number) =>
    f.split(",").some((part) => {
      const [r = "", st] = part.split("/");
      const [x, y] = r === "*" ? [lo, hi] : r.split("-").map(Number);
      const a = x ?? lo;
      const b = y ?? (st === undefined ? a : hi);
      return v >= a && v <= b && (v - a) % Number(st ?? 1) === 0;
    });
  const day = Math.floor(w / 1440);
  const p = Object.fromEntries(UTC_DAY.formatToParts(day * 86_400_000).map((x) => [x.type, Number(x.value)]));
  const m = w % 1440;
  if (!has(mi, m % 60, 0, 59) || !has(ho, Math.floor(m / 60), 0, 23) || !has(mo, p.month ?? 0, 1, 12)) return false;
  const a = has(dm, p.day ?? 0, 1, 31);
  const b = has(dw, (((day + 4) % 7) + 7) % 7, 0, 6);
  return dm !== "*" && dw !== "*" ? a || b : a && b;
}
/** The first fire minute after minute `tm` by scanning, within `limit` minutes. */
function scan(cron: string, zone: string, tm: number, limit: number): number | undefined {
  let top = Number.NEGATIVE_INFINITY;
  for (let i = tm - 300; i <= tm; i++) top = Math.max(top, wall(zone, i));
  for (let i = tm + 1; i <= tm + limit; i++) {
    const w = wall(zone, i);
    for (let x = Math.max(top + 1, w - 180); x <= w; x++) if (matches(cron, x)) return i;
    top = Math.max(top, w);
  }
  return undefined;
}

const item = (lo: number, hi: number) =>
  fc.oneof(
    fc.constant("*"),
    fc.integer({ min: lo, max: hi }).map(String),
    fc
      .tuple(fc.integer({ min: lo, max: hi }), fc.integer({ min: lo, max: hi }))
      .map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`),
    fc.integer({ min: 2, max: 7 }).map((st) => `*/${st}`),
  );
const cronArb = fc
  .tuple(
    item(0, 59),
    item(0, 23),
    fc.oneof(fc.constant("*"), item(1, 28)),
    fc.constant("*"),
    fc.oneof(fc.constant("*"), item(0, 6)),
  )
  .map((p) => p.join(" "));
// instants near the 2026 and 2027 clock changes of the zones above, and anywhere in 2026-2027
const instant = fc.oneof(
  fc
    .constantFrom(
      "2026-03-08T06:00Z",
      "2026-03-29T00:30Z",
      "2026-04-05T15:00Z",
      "2026-10-04T15:00Z",
      "2026-10-25T00:00Z",
      "2026-11-01T05:00Z",
      "2027-03-28T00:00Z",
    )
    .chain((iso) => fc.integer({ min: -180, max: 180 }).map((m) => Date.parse(iso) + m * MIN + 17)),
  fc.integer({ min: Date.UTC(2026, 0, 1) / MIN, max: Date.UTC(2028, 0, 1) / MIN }).map((m) => m * MIN + 1),
);

test("seek(+1) equals the first fire minute of an independent scan, in five zones", () => {
  fc.assert(
    fc.property(cronArb, fc.constantFrom(...ZONES), instant, (cron, zone, t) => {
      const c = parseCron(cron);
      if (typeof c === "string") throw new Error(c);
      const want = scan(cron, zone, Math.floor(t / MIN), 2 * 1440);
      fc.pre(want !== undefined);
      expect(seek(c, zone, t, 1)).toBe((want ?? 0) * MIN);
    }),
    { seed: 1337, numRuns: 100 },
  );
});

test("seek is monotonic: next is after t, prev is at or before it, and no fire time lies strictly between them", () => {
  fc.assert(
    fc.property(cronArb, fc.constantFrom(...ZONES), instant, (cron, zone, t) => {
      const c = parseCron(cron);
      if (typeof c === "string") throw new Error(c);
      const next = seek(c, zone, t, 1) ?? Number.POSITIVE_INFINITY;
      const prev = seek(c, zone, t, -1) ?? Number.NEGATIVE_INFINITY;
      expect(next).toBeGreaterThan(t);
      expect(prev).toBeLessThanOrEqual(t);
      if (Number.isFinite(prev)) expect(seek(c, zone, prev - 1, 1)).toBe(prev);
      if (Number.isFinite(next)) expect(seek(c, zone, next, -1)).toBe(next);
      if (Number.isFinite(prev) && Number.isFinite(next)) expect(seek(c, zone, prev, 1)).toBe(next);
    }),
    { seed: 1337, numRuns: 150 },
  );
});

test("Europe/Berlin: 02:30 daily fires at 03:00 on the spring change and once on the autumn one", () => {
  const c = parseCron("30 2 * * *");
  if (typeof c === "string") throw new Error(c);
  expect(seek(c, "Europe/Berlin", Date.parse("2027-03-27T12:00Z"), 1)).toBe(Date.parse("2027-03-28T01:00Z"));
  expect(seek(c, "Europe/Berlin", Date.parse("2026-10-24T12:00Z"), 1)).toBe(Date.parse("2026-10-25T00:30Z"));
  expect(seek(c, "Europe/Berlin", Date.parse("2026-10-25T00:30Z"), 1)).toBe(Date.parse("2026-10-26T01:30Z"));
});
