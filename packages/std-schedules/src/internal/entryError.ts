import { TimeZone } from "@keel/std-temporal";
import { parseCron } from "./parseCron.ts";

/** Why a schedule entry's `cron` or `zone` does not parse (E2551, naming the field), or undefined. */
export function entryError(cron: string, zone: string): string | undefined {
  const c = parseCron(cron);
  if (typeof c === "string") return `cron ${c}`;
  return TimeZone.parse(zone).ok ? undefined : `zone '${zone.slice(0, 32)}' is not a TimeZone`;
}
