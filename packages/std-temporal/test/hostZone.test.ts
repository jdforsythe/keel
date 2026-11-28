// A host whose Intl lacks a pinned zone: parse and gen still accept it, using it raises a defect. Seed 1337
import { isDefect } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { afterEach, beforeEach, expect, test } from "vitest";
import { Instant } from "../src/Instant.schema.ts";
import { TimeZone } from "../src/TimeZone.schema.ts";
import { formatInstant } from "../src/formatInstant.ts";
import { plainDateOf } from "../src/plainDateOf.ts";

const SEED = 1337;
const REFUSED = "America/Ciudad_Juarez";
const RealDateTimeFormat = Intl.DateTimeFormat;

class Refusing extends RealDateTimeFormat {
  constructor(locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
    if (options?.timeZone === REFUSED) throw new RangeError(`Invalid time zone specified: ${REFUSED}`);
    super(locales, options);
  }
}

beforeEach(() => {
  Object.defineProperty(Intl, "DateTimeFormat", { value: Refusing, configurable: true, writable: true });
});
afterEach(() => {
  Object.defineProperty(Intl, "DateTimeFormat", { value: RealDateTimeFormat, configurable: true, writable: true });
});

test("parse accepts a pinned zone the host refuses and keeps it as written", () => {
  expect(TimeZone.parse(REFUSED)).toEqual({ ok: true, value: REFUSED });
});

test("gen draws the same zones whether or not the host refuses one, and each parses", () => {
  const draw = () => fc.sample(gen(TimeZone), { seed: SEED, numRuns: 400 });
  const refusing = draw();
  Object.defineProperty(Intl, "DateTimeFormat", { value: RealDateTimeFormat, configurable: true, writable: true });
  expect(draw()).toEqual(refusing);
  fc.assert(
    fc.property(gen(TimeZone), (z) => {
      expect(TimeZone.parse(z)).toEqual({ ok: true, value: z });
    }),
    { seed: SEED, numRuns: 300 },
  );
});

/** What `run` throws, or `undefined`. */
const thrown = (run: () => unknown): unknown => {
  try {
    run();
  } catch (e) {
    return e;
  }
  return undefined;
};

test("plainDateOf and formatInstant raise a defect naming the zone the host refuses", () => {
  const i = Instant.parse("2026-11-10T23:30:00.000Z");
  const z = TimeZone.parse(REFUSED);
  expect(i.ok && z.ok).toBe(true);
  if (!(i.ok && z.ok)) return;
  const d = thrown(() => plainDateOf(i.value, z.value));
  expect(isDefect(d)).toBe(true);
  expect(Reflect.get(Object(d), "data")).toEqual({ timeZone: REFUSED });
  expect(isDefect(thrown(() => formatInstant(i.value, "en-US", z.value, "short")))).toBe(true);
});
