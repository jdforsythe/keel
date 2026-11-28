import { s } from "@keel/schema";

/** How long a formatted duration's units are (std.temporal): `Intl.NumberFormat` `unitDisplay` and `Intl.ListFormat` `style`. */
export const UnitStyle = s.enum(["long", "short", "narrow"]);
export type UnitStyle = s.infer<typeof UnitStyle>;
