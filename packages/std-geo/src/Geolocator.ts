import type { KeelError, Result } from "@keel/schema";
import type { Position } from "./Position.schema.ts";

/** The `geo` capability (std.geo): one position reading per call; failure is `geo.unavailable`, never a throw. */
export type Geolocator = {
  position(): Promise<Result<Position, KeelError<"geo.unavailable", Record<string, never>>>>;
};
