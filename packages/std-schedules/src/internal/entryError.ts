import { TimeZone } from "@keel/std-temporal";
import { parseCron } from "./parseCron.ts";

const hostLacks = (zone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return false;
  } catch {
    return true;
  }
};

/**
 * Why a schedule entry's `cron` or `zone` does not parse (E2551, naming the field), or undefined. A `zone` must be a
 * `TimeZone` the host's `Intl.DateTimeFormat` also knows, so a job never fails at its first tick.
 */
export function entryError(cron: string, zone: string): string | undefined {
  const c = parseCron(cron);
  if (typeof c === "string") return `cron ${c}`;
  const z = `zone '${zone.slice(0, 32)}'`;
  if (!TimeZone.parse(zone).ok) return `${z} is not a TimeZone`;
  return zone !== "UTC" && hostLacks(zone) ? `${z} is not in this host's Intl time zone data` : undefined;
}
