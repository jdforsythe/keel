// k.server Server state: `inOrder` runs calls on a shared key one at a time in issue order and calls on disjoint keys
// concurrently; the saved copy's loads and saves are queued through it.
import { describe, expect, it } from "vitest";
import { inOrder } from "../src/internal/inOrder.ts";

const tick = () => new Promise<void>((r) => setImmediate(r));

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
