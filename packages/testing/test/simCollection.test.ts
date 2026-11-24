import { pbkdf2, randomBytes, scrypt, webcrypto } from "node:crypto";
// Spec: k.drive (Driving): a resource a garbage collection would destroy is not pending, and a collection never drops
// work in flight. k.drive-law (Order): held work waits only on thread-pool requests, not on an open zlib stream.
import { lookup } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import { createGzip, gzip } from "node:zlib";
import { register } from "@keel/ctx";
import { simulate } from "@keel/testing";
import { expect, it } from "vitest";
import { onThreadPool } from "../src/internal/onThreadPool.ts";

const replay = { seed: 1, schedule: { net: [], storage: [], offline: [], plans: {} } };

const probe = register("simCollectionProbe", {
  real: () => ({ work: () => Promise.resolve() }),
  shell: () => ({ work: () => Promise.resolve() }),
  sim: ({ hold }) => ({ work: () => hold("probe", () => Promise.resolve()) }),
});

it("an async gzip of 4 MB, then a clock wait: the finished zlib handle is not pending once a collection ran", async () => {
  await simulate(
    async ({ ctx }) => {
      const data = randomBytes(4 * 1024 * 1024);
      await new Promise<void>((resolve, reject) => gzip(data, (e) => (e === null ? resolve() : reject(e))));
      await ctx.clock.after(1);
      expect(ctx.clock.now()).toBe(1);
    },
    { replay, budget: 20_000 },
  );
});

const jobs: Record<string, () => Promise<unknown>> = {
  pbkdf2: () =>
    new Promise((resolve, reject) =>
      pbkdf2("pw", "salt", 300_000, 32, "sha256", (e, k) => (e ? reject(e) : resolve(k))),
    ),
  scrypt: () =>
    new Promise((resolve, reject) => scrypt("pw", "salt", 64, { N: 2 ** 14 }, (e, k) => (e ? reject(e) : resolve(k)))),
  deriveBits: async () => {
    const key = await webcrypto.subtle.importKey("raw", new TextEncoder().encode("pw"), "PBKDF2", false, [
      "deriveBits",
    ]);
    return webcrypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: new Uint8Array(8), iterations: 300_000 },
      key,
      256,
    );
  },
  digest: () => webcrypto.subtle.digest("SHA-256", randomBytes(32 * 1024 * 1024)),
  readFile: () => readFile(new URL(import.meta.url)),
  lookup: () => lookup("localhost"),
};

for (const [name, job] of Object.entries(jobs))
  it(`a ${name} in flight survives the drive's collections: a 1 ms clock wait beside it resolves after it answers`, async () => {
    let answered = false;
    let seen: boolean | undefined;
    await simulate(
      async ({ ctx, run }) => {
        const work = job().then(() => {
          answered = true;
        });
        const waiter = ctx.clock.after(1).then(() => {
          seen = answered;
        });
        await Promise.all([work, waiter, run()]);
      },
      { replay, budget: 20_000 },
    );
    expect(seen).toBe(true);
  });

it("an open createGzip() stream holds back no hold: the hold is delivered and the scenario closes the stream", async () => {
  await simulate(
    async ({ ctx }) => {
      const gz = createGzip();
      await probe(ctx).work();
      await new Promise<void>((resolve) => gz.close(() => resolve()));
    },
    { replay, budget: 2_000 },
  );
});

it("thread-pool types: crypto jobs, file and DNS requests and a file handle's close are; zlib and an HTTP request are not", () => {
  for (const t of [
    "PBKDF2REQUEST",
    "SCRYPTREQUEST",
    "FSREQCALLBACK",
    "FSREQPROMISE",
    "FILEHANDLECLOSEREQ",
    "GETADDRINFOREQWRAP",
  ])
    expect(onThreadPool(t)).toBe(true);
  for (const t of ["ZLIB", "HTTPCLIENTREQUEST", "Timeout", "TCPWRAP"]) expect(onThreadPool(t)).toBe(false);
});
