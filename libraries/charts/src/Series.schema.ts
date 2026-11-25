import { s } from "@keel/schema";
import { Point } from "./Point.schema.ts";

/** What a chart's `Host` code draws: the points in the order given. */
export const Series = s.object({ points: s.array(Point) });
