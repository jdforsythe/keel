// The opening token of the Postgres driver is the transaction id of its opening transaction; one that is not a number
// fails the open (E2153) rather than becoming a token two processes share.
import { expect, test, vi } from "vitest";
import { postgres } from "../src/postgres/index.server.ts";

const xid = vi.hoisted(() => ({ value: "42" }));

vi.mock("pg", () => {
  class Pool {
    on(): this {
      return this;
    }
    async query(): Promise<{ rows: unknown[] }> {
      return { rows: [] };
    }
    async connect(): Promise<{ query(): Promise<{ rows: unknown[] }>; release(): void }> {
      return { query: async () => ({ rows: [{ x: xid.value }] }), release: () => undefined };
    }
    async end(): Promise<void> {}
  }
  return { default: { Pool } };
});

test("a numeric transaction id opens the driver", async () => {
  xid.value = "42";
  const storage = await postgres(new URL("postgres://h/db"));
  await storage.close();
});

test("a transaction id that is not a number fails the open with E2153 and never falls back to a shared token", async () => {
  xid.value = "not-a-number";
  await expect(postgres(new URL("postgres://h/db"))).rejects.toMatchObject({ code: "E2153" });
});
