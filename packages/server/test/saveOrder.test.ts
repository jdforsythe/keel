// k.persist Server saves: a save is one `ctx.storage.commit`; a rejected commit is neither served nor carried by the
// next save, and of two overlapping saves of one key the later commit is `keel.conflict`. The storage here is a fake
// whose `commit` succeeds, rejects, or holds until released, per call.
import { describe, expect, it } from "vitest";
import { KEY, counterApp, fakeStorage, storedN, viewOf } from "./saveFixture.ts";

const tick = () => new Promise<void>((r) => setImmediate(r));

describe("saveStores as one commit (k.persist)", () => {
  it("a rejected storage commit is 500, leaves the copy unchanged, and the next save does not carry it", async () => {
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

  it("of two overlapping saves of one key, the commit that lands first is saved and the other is 409", async () => {
    const fake = fakeStorage();
    const app = counterApp(fake.storage);
    fake.plans.push("hold");
    const first = app.inc();
    while (fake.calls() === 0) await tick();
    const second = app.inc();
    expect((await second).status).toBe(200);
    for (const release of fake.held.splice(0)) release();
    expect((await first).status).toBe(409);
    expect(fake.landed.map((raw) => storedN(new Map([[KEY, raw]])))).toEqual([1]);
    expect(await app.view()).toMatchObject(viewOf(1));
  });

  it("a read during an in-flight commit sees the value before it, and a read after it the committed one", async () => {
    const fake = fakeStorage();
    const app = counterApp(fake.storage);
    fake.plans.push("hold");
    const write = app.inc();
    while (fake.calls() === 0) await tick();
    expect(await app.view()).toMatchObject(viewOf(0));
    for (const release of fake.held.splice(0)) release();
    expect((await write).status).toBe(200);
    expect(await app.view()).toMatchObject(viewOf(1));
  });
});
