import { randomBytes } from "node:crypto";
import type { Engine } from "./Engine.ts";

/** Real and shell: bytes from `randomBytes`. */
export function realEngine(): Engine {
  return { sim: false, bytes: (n) => randomBytes(n) };
}
