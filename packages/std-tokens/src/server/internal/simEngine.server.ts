import { createHash } from "node:crypto";
import type { Engine } from "./Engine.ts";

/** Sim: each draw is the leading bytes of SHA-256 over `<seed>:<call count>`. */
export function simEngine(seed: number): Engine {
  let count = 0;
  return {
    sim: true,
    bytes: (n) => createHash("sha256").update(`${seed}:${count++}`).digest().subarray(0, n),
  };
}
