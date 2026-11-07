import { s } from "@keel/schema";
import type { Schema } from "@keel/schema";
import type { Tokens } from "./types/Tokens.ts";

const scale = s.record(s.string()).optional();
const pair = s.object({ light: s.string(), dark: s.string() }, { closed: true });

/**
 * Validates `tokens.ts` (E1807): only the closed groups (an unknown group fails with rule `unknown-key`),
 * string token values, colors a string or a closed `{ light, dark }` pair (rfc:0029).
 */
export const TokenSchema: Schema<Tokens> = s.object(
  {
    color: s.record(s.union([s.string(), pair])).optional(),
    space: scale,
    size: scale,
    radius: scale,
    font: scale,
    fontSize: scale,
    weight: scale,
    shadow: scale,
    border: scale,
    breakpoint: scale,
    motion: scale,
  },
  { closed: true },
);
