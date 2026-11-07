import { s } from "@keel/schema";

/** A device position (std.geo): degrees and accuracy in meters. */
export const Position = s.object(
  {
    lat: s.number({ min: -90, max: 90 }),
    lon: s.number({ min: -180, max: 180 }),
    accuracy: s.number({ min: 0 }),
  },
  { closed: true },
);
export type Position = s.infer<typeof Position>;
