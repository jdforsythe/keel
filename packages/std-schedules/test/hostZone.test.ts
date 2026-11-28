// std.schedules E2551: `schedule` refuses a pinned zone the server's Intl lacks. Seed 1337
import { ok, s } from "@keel/schema";
import { job, queue } from "@keel/std-jobs";
import { afterEach, beforeEach, expect, test } from "vitest";
import { schedule } from "../src/index.ts";
import { dataOf } from "./dataOf.ts";

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

const jobs = () => queue({ "orders.digest": job({ input: s.object({}) }, async () => ok(null)) });
const table = (zone: string) => ({ "orders.x": { cron: "0 3 * * *", zone, job: "orders.digest", input: {} } }) as const;

test("a pinned zone the host's Intl lacks throws E2551 naming the zone", () => {
  expect(dataOf(() => schedule(jobs(), table(REFUSED)))).toEqual({
    schedule: "orders.x",
    reason: `zone '${REFUSED}' is not in this host's Intl time zone data`,
  });
});

test("a zone the host knows, and UTC, still build a runner", () => {
  expect(() => schedule(jobs(), table("Europe/Berlin"))).not.toThrow();
  expect(() => schedule(jobs(), table("UTC"))).not.toThrow();
});

test("a zone off the pinned list is still refused as not a TimeZone", () => {
  expect(dataOf(() => schedule(jobs(), table("Mars/Olympus")))).toEqual({
    schedule: "orders.x",
    reason: "zone 'Mars/Olympus' is not a TimeZone",
  });
});
