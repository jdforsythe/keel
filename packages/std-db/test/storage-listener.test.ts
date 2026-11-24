// The listener's `drop`: an error on a client that is no longer the live one never clears or reports to the watchers of
// the client that replaced it.
import type { StorageReport } from "@keel/ctx";
import { expect, test, vi } from "vitest";
import { storageListener } from "../src/postgres/storageListener.ts";

type Listener = (...args: readonly unknown[]) => unknown;

const made = vi.hoisted(() => {
  const clients: {
    readonly listeners: Map<string, Listener[]>;
    gate: Promise<void>;
    release: () => void;
    ended: number;
  }[] = [];
  return { clients };
});

vi.mock("pg", () => {
  class Client {
    readonly #record: (typeof made.clients)[number];
    constructor() {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((r) => {
        release = r;
      });
      this.#record = { listeners: new Map(), gate, release, ended: 0 };
      made.clients.push(this.#record);
    }
    on(event: string, listener: Listener): this {
      this.#record.listeners.set(event, [...(this.#record.listeners.get(event) ?? []), listener]);
      return this;
    }
    removeAllListeners(): this {
      this.#record.listeners.clear();
      return this;
    }
    async connect(): Promise<void> {}
    async query(): Promise<void> {
      await this.#record.gate;
    }
    async end(): Promise<void> {
      this.#record.ended++;
    }
  }
  return { default: { Client } };
});

test("an old client erroring while a new watch opens reports nothing to the new watch", async () => {
  made.clients.length = 0;
  const listening = storageListener(new URL("postgres://h/db"), "1");
  const first: StorageReport[] = [];
  const pendingFirst = listening.watch((r) => first.push(r));
  made.clients[0]?.release();
  const stopFirst = await pendingFirst;
  const oldClient = made.clients[0];
  stopFirst();
  const second: StorageReport[] = [];
  const pendingSecond = listening.watch((r) => second.push(r));
  expect(made.clients.length).toBe(2);
  for (const l of oldClient?.listeners.get("error") ?? []) l(new Error("old connection lost"));
  made.clients[1]?.release();
  const stopSecond = await pendingSecond;
  expect(second).toEqual([]);
  for (const l of made.clients[1]?.listeners.get("error") ?? []) l(new Error("new connection lost"));
  expect(second).toEqual([{ kind: "lost" }]);
  stopSecond();
  await listening.close();
});
