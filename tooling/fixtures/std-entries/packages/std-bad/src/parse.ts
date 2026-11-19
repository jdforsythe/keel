import { parseSync } from "oxc-parser";

export const parse = (source: string): unknown => parseSync("a.ts", source);
