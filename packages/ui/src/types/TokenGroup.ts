import type { Tokens } from "./Tokens.ts";

/** One of the closed token group names that hold values (every group but the style sets `base` and `look`, and `schemes`). */
export type TokenGroup = Exclude<keyof Tokens, "base" | "look" | "schemes">;
