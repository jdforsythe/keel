import { createHash, scryptSync } from "node:crypto";
import type { Engine } from "./Engine.ts";

/** log2 of N for a sim-form key, whatever `ln` its label carries. */
const SIM_LN = 4;

/**
 * Sim: each draw is the leading bytes of SHA-256 over `<seed>:<call count>`. Keys derive synchronously with
 * `scryptSync`: at N = 2^4 for a sim-form string, at the stored parameters for a real-form one. A derivation Node
 * refuses resolves `null`.
 */
export function simEngine(seed: number): Engine {
  let count = 0;
  return {
    sim: true,
    bytes: (n) => createHash("sha256").update(`${seed}:${count++}`).digest().subarray(0, n),
    derive: (input, salt, length, params) => {
      const ln = params.id === "scrypt-sim" ? SIM_LN : params.ln;
      const N = 2 ** ln;
      try {
        return Promise.resolve(
          scryptSync(input, salt, length, { N, r: params.r, p: params.p, maxmem: 128 * N * params.r + 1048576 }),
        );
      } catch {
        return Promise.resolve(null);
      }
    },
  };
}
