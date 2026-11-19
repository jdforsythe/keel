// The `pg` pool the Postgres driver builds when no `clientFactory` is given: its options and its error listeners, seen
// through a stand-in for the `pg` module.
import { expect, test, vi } from "vitest";
import { postgres } from "../src/postgres/postgres.ts";

type Listener = (...args: readonly unknown[]) => unknown;

const seen = vi.hoisted(() => {
  const pools: { readonly options: unknown; readonly listeners: Map<string, Listener[]>; ended: number }[] = [];
  return { pools };
});

vi.mock("pg", () => {
  class Pool {
    readonly #record: (typeof seen.pools)[number];
    constructor(options: unknown) {
      this.#record = { options, listeners: new Map(), ended: 0 };
      seen.pools.push(this.#record);
    }
    on(event: string, listener: Listener): this {
      this.#record.listeners.set(event, [...(this.#record.listeners.get(event) ?? []), listener]);
      return this;
    }
    async query(): Promise<{ rows: unknown[] }> {
      return { rows: [] };
    }
    async connect(): Promise<{ query(): Promise<{ rows: unknown[] }>; release(): void }> {
      return { query: async () => ({ rows: [] }), release: () => undefined };
    }
    async end(): Promise<void> {
      this.#record.ended++;
    }
  }
  return { default: { Pool } };
});

test("the driver's own pool holds at most 10 connections on the URL, with a 10 s connect timeout", async () => {
  seen.pools.length = 0;
  const url = new URL("postgresql://keel:pw@db.example:6543/app?sslmode=require");
  const storage = await postgres(url);
  expect(seen.pools.length).toBe(1);
  expect(seen.pools[0]?.options).toEqual({ connectionString: url.href, max: 10, connectionTimeoutMillis: 10_000 });
  await storage.close();
  expect(seen.pools[0]?.ended).toBe(1);
});

test("the pool drops the errors of idle clients and of each client it connects", async () => {
  seen.pools.length = 0;
  const storage = await postgres(new URL("postgres://h/db"));
  const listeners = seen.pools[0]?.listeners ?? new Map<string, Listener[]>();
  expect([...listeners.keys()].sort()).toEqual(["connect", "error"]);
  for (const l of listeners.get("error") ?? []) expect(l(new Error("idle client lost"))).toBeUndefined();
  const clientEvents: string[] = [];
  const clientListeners: Listener[] = [];
  const client = {
    on: (event: string, listener: Listener) => {
      clientEvents.push(event);
      clientListeners.push(listener);
    },
  };
  expect(listeners.get("connect")?.length).toBe(1);
  for (const l of listeners.get("connect") ?? []) l(client);
  expect(clientEvents).toEqual(["error"]);
  for (const l of clientListeners) expect(l(new Error("connection lost"))).toBeUndefined();
  await storage.close();
});
