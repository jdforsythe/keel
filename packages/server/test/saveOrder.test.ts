// k.server Server state (RFC 0044), backlog 0125: a save replaces the in-process copy only after `ctx.storage.set`
// resolves, so a rejected write is neither served nor carried by the next save, and saves of one key land in issue
// order. The storage here is a fake whose `set` succeeds, rejects, or holds until released, per call.
import { describe, expect, it } from "vitest";
import { inOrder } from "../src/internal/inOrder.ts";
import { KEY, counterApp, fakeStorage, storedN, viewOf } from "./saveFixture.ts";

const tick = () => new Promise<void>((r) => setImmediate(r));

describe("saveStores ordering (backlog 0125)", () => {
  it("a rejected storage set is 500, leaves the copy unchanged, and the next save does not carry it", async () => {
    const fake = fakeStorage();
    const app = counterApp(fake.storage);
    expect((await app.inc()).status).toBe(200);
    fake.plans.push("reject");
    expect((await app.inc()).status).toBe(500);
    expect(storedN(fake.data)).toBe(1);
    expect(await app.view()).toMatchObject(viewOf(1));
    expect((await app.inc()).status).toBe(200);
    expect(storedN(fake.data)).toBe(2);
    expect(await app.view()).toMatchObject(viewOf(2));
  });

  it("a rejected first save leaves nothing stored and nothing in the copy", async () => {
    const fake = fakeStorage();
    const app = counterApp(fake.storage);
    fake.plans.push("reject");
    expect((await app.inc()).status).toBe(500);
    expect(storedN(fake.data)).toBeNull();
    expect(await app.view()).toMatchObject(viewOf(0));
  });

  it("a save issued while an earlier one is in flight lands after it, even when storage would resolve it first", async () => {
    const fake = fakeStorage();
    const app = counterApp(fake.storage);
    fake.plans.push("hold");
    const first = app.inc();
    while (fake.calls() === 0) await tick();
    const second = app.inc();
    for (let i = 0; i < 20; i++) await tick();
    // The second save waits for the held first one: it has not reached storage.
    expect(fake.calls()).toBe(1);
    for (const release of fake.held.splice(0)) release();
    expect((await first).status).toBe(200);
    expect((await second).status).toBe(200);
    expect(fake.landed.map((raw) => storedN(new Map([[KEY, raw]])))).toEqual([1, 2]);
    expect(storedN(fake.data)).toBe(2);
    expect(await app.view()).toMatchObject(viewOf(2));
  });

  it("a read during an in-flight save waits for it and sees the written copy", async () => {
    const fake = fakeStorage();
    const app = counterApp(fake.storage);
    fake.plans.push("hold");
    const write = app.inc();
    while (fake.calls() === 0) await tick();
    const read = app.view();
    for (const release of fake.held.splice(0)) release();
    await write;
    expect(await read).toMatchObject(viewOf(1));
  });
});

describe("inOrder", () => {
  const deferred = () => {
    let release = () => {};
    const done = new Promise<void>((r) => {
      release = r;
    });
    return { done, release };
  };

  it("runs calls on a shared key one at a time in issue order; a rejection does not block the next", async () => {
    const chains = new Map<string, Promise<void>>();
    const seen: string[] = [];
    const gate = deferred();
    const a = inOrder(chains, ["k"], async () => {
      await gate.done;
      seen.push("a");
      throw new Error("a failed");
    });
    const b = inOrder(chains, ["k", "j"], async () => {
      seen.push("b");
      return "b";
    });
    await tick();
    expect(seen).toEqual([]);
    gate.release();
    await expect(a).rejects.toThrow("a failed");
    expect(await b).toBe("b");
    expect(seen).toEqual(["a", "b"]);
  });

  it("runs calls on disjoint keys concurrently and forgets a key once its last call settles", async () => {
    const chains = new Map<string, Promise<void>>();
    const gate = deferred();
    const a = inOrder(chains, ["a"], () => gate.done.then(() => "a"));
    const b = inOrder(chains, ["b"], () => Promise.resolve("b"));
    expect(await b).toBe("b");
    expect(chains.has("a")).toBe(true);
    gate.release();
    expect(await a).toBe("a");
    await tick();
    expect(chains.size).toBe(0);
  });

  it("keeps a key's entry while a later call is queued behind it", async () => {
    const chains = new Map<string, Promise<void>>();
    const gate = deferred();
    const first = inOrder(chains, ["k"], () => Promise.resolve(1));
    const second = inOrder(chains, ["k"], () => gate.done.then(() => 2));
    expect(await first).toBe(1);
    await tick();
    expect(chains.has("k")).toBe(true);
    gate.release();
    expect(await second).toBe(2);
    await tick();
    expect(chains.has("k")).toBe(false);
  });
});
