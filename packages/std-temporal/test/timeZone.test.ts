// Seed 1337
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { expect, test } from "vitest";
import { TimeZone } from "../src/TimeZone.schema.ts";
import { pinnedZones } from "../src/internal/pinnedZones.ts";

const SEED = 1337;
const { names, gen: zones } = pinnedZones();
const pinned = [...names];

const swapCase = (name: string): string =>
  [...name].map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join("");

test("the pinned list holds 597 names, 344 Zone names plus UTC for gen, without Factory", () => {
  expect(names.size).toBe(597);
  expect(zones).toHaveLength(345);
  expect(zones[0]).toBe("UTC");
  expect(names.has("Factory")).toBe(false);
  for (const z of zones) expect(names.has(z), z).toBe(true);
  for (const n of ["Asia/Kolkata", "Asia/Calcutta", "Europe/Kyiv", "Europe/Kiev", "America/Argentina/Buenos_Aires"])
    expect(names.has(n), n).toBe(true);
});

test("every pinned name is accepted by Intl.DateTimeFormat on this host", () => {
  const refused = pinned.filter((n) => {
    try {
      new Intl.DateTimeFormat(undefined, { timeZone: n });
      return false;
    } catch {
      return true;
    }
  });
  expect(refused).toEqual([]);
});

test("every pinned name parses and is kept as written", () => {
  for (const n of pinned) expect(TimeZone.parse(n), n).toEqual({ ok: true, value: n });
});

test("every Intl name of this host is on the pinned list", () => {
  expect(Intl.supportedValuesOf("timeZone").filter((n) => !names.has(n))).toEqual([]);
});

test("a pinned name in any other case is refused with rule format", () => {
  fc.assert(
    fc.property(fc.constantFrom(...pinned), fc.boolean(), (n, lower) => {
      const variant = lower ? n.toLowerCase() : swapCase(n);
      fc.pre(variant !== n && !names.has(variant));
      const r = TimeZone.parse(variant);
      expect(r.ok, variant).toBe(false);
      if (!r.ok) expect(r.error.data.issues).toEqual([{ path: [], rule: "format" }]);
    }),
    { seed: SEED, numRuns: 300 },
  );
});

test("names Intl accepts that are not on the pinned list are refused", () => {
  for (const n of ["utc", "asia/kolkata", "EST", "Etc/GMT+15", "Mars/Olympus", "Asia/Kolkata ", ""]) {
    const r = TimeZone.parse(n);
    expect(r.ok, n).toBe(names.has(n));
  }
});

test("gen draws only pinned Zone names and UTC, and every drawn value parses", () => {
  fc.assert(
    fc.property(gen(TimeZone), (z) => {
      expect(zones).toContain(z);
      expect(TimeZone.parse(z)).toEqual({ ok: true, value: z });
    }),
    { seed: SEED, numRuns: 300 },
  );
});

test("pinnedZones decodes once and returns the same list", () => {
  expect(pinnedZones()).toBe(pinnedZones());
});
