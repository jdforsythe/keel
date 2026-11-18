import { zoneNames } from "./zoneNames.ts";

/** The pinned zone list decoded: every Zone and Link name, and the names `gen` draws from (`UTC`, then the Zone names). */
interface PinnedZones {
  readonly names: ReadonlySet<string>;
  readonly gen: readonly string[];
}

let decoded: PinnedZones | undefined;

const unpack = (half: string): string[] =>
  half.split(";").flatMap((group) => {
    const [area = "", rest = ""] = group.split(":");
    return rest.split(",").map((name) => (area ? `${area}/${name}` : name));
  });

/** The pinned IANA names (std.temporal `TimeZone`), decoded once on first use. */
export function pinnedZones(): PinnedZones {
  if (decoded) return decoded;
  const [zones = "", links = ""] = zoneNames.split("|");
  const gen = ["UTC", ...unpack(zones)];
  decoded = { names: new Set([...gen, ...unpack(links)]), gen };
  return decoded;
}
