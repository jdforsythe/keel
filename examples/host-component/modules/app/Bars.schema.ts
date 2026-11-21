import { s } from "@keel/schema";

export const Bars = s.object({ bars: s.array(s.object({ name: s.string(), value: s.int({ min: 0, max: 100 }) })) });
