import { randomBytes, scrypt } from "node:crypto";
import type { Engine } from "./Engine.ts";
import { gate } from "./gate.ts";

/**
 * Real and shell: bytes from `randomBytes`; each derivation is `scrypt` on the thread pool through the ctx's queue at
 * cost `ln`, with `maxmem` of `128 * N * r` plus 1 MiB. A derivation Node refuses resolves `null`.
 */
export function realEngine(ln: number): Engine {
  const queue = gate(ln);
  return {
    sim: false,
    bytes: (n) => randomBytes(n),
    derive: (input, salt, length, params) =>
      queue.run(
        () =>
          new Promise<Buffer | null>((done) => {
            const N = 2 ** params.ln;
            scrypt(
              input,
              salt,
              length,
              { N, r: params.r, p: params.p, maxmem: 128 * N * params.r + 1048576 },
              (e, key) => done(e === null ? key : null),
            );
          }),
      ),
  };
}
