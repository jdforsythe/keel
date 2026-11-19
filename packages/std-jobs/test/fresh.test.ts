// std.jobs definitions built when a module loads: the rules' explanations and the `jobs.queue` inspect section. Each
// test loads a fresh set of modules inside the test, so that what runs at load is exercised by it. Seed 1337
import { expect, test, vi } from "vitest";

const settle = async () => {
  for (let i = 0; i < 300; i++) await Promise.resolve();
};

test("Each rule's explanation names its fix and points at std.jobs", async () => {
  vi.resetModules();
  await import("../src/tools/index.ts");
  const { explain } = await import("@keel/check/explain");
  const { rules } = await import("@keel/check");
  expect(
    rules()
      .filter((r) => r.code.startsWith("E25"))
      .map((r) => [r.code, r.see]),
  ).toEqual([
    ["E2501", "std.jobs"],
    ["E2502", "std.jobs"],
    ["E2503", "std.jobs"],
    ["E2504", "std.jobs"],
    ["E2505", "std.jobs"],
  ]);
  expect(explain("E2501")).toBe(
    "E2501.\nOne queue per module, in modules/<id>/jobs.server.ts, keyed by module-prefixed ids. Fix: queue({ send }) -> queue({ 'orders.send': send }).\nsee: std.jobs",
  );
  expect(explain("E2502")).toBe(
    "E2502 jobs is public; other modules start jobs through this module's actions.\nA queue runs only in its module's deployable; other modules call its actions. Fix: exports: ['jobs', 'Order'] -> exports: ['Order'].\nsee: std.jobs",
  );
  expect(explain("E2503")).toBe(
    "E2503 job input holds s.secret; a job's input is stored.\nJob inputs are stored, so they hold no secret. Fix: pass an id the job reads it by: job({ input: s.object({ userId: s.id('User') }) }, fn).\nsee: std.jobs",
  );
  expect(explain("E2504")).toBe(
    "E2504.\nA queue runs where runners.server.ts lists it, in a node deployable. Fix: export const runners = [jobs]; place the module in a node deployable.\nsee: std.jobs",
  );
  expect(explain("E2505")).toBe(
    "E2505 attempts or timeoutMs is not a positive integer.\nBoth are whole numbers above zero. Fix: job({ input, attempts: 5, timeoutMs: 30000 }, fn).\nsee: std.jobs",
  );
});

test("The jobs.queue section counts pending and running jobs apart and lists failures without an input", async () => {
  vi.resetModules();
  const { createCtx } = await import("@keel/ctx");
  const { createApp, topology } = await import("@keel/server");
  const { err, s } = await import("@keel/schema");
  const { job, queue } = await import("../src/index.ts");
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const input = s.object({ note: s.string() });
  const hang = job({ input }, () => new Promise(() => undefined));
  const bad = job({ input, attempts: 1 }, async () => err({ code: "orders.rejected", message: "no", data: {} }));
  const jobs = queue({ "orders.hang": hang, "orders.bad": bad });
  const app = await createApp({
    topology: topology({ web: { modules: ["orders"], adapter: "node" } }),
    ctx,
    mode: "dev",
    runners: { orders: [jobs] },
  });
  const read = async (): Promise<unknown> => {
    const res = await app.fetch(new Request("http://localhost/__keel/inspect"));
    const body: unknown = await res.json();
    return Reflect.get(Object(Reflect.get(Object(Reflect.get(Object(body), "sections")), "jobs.queue")), "value");
  };
  expect(await read()).toEqual({});
  await jobs.enqueue(ctx, "orders.hang", { note: "x" });
  await settle();
  await jobs.enqueue(ctx, "orders.hang", { note: "y" }, { delayMs: 60_000 });
  await jobs.enqueue(ctx, "orders.hang", { note: "z" }, { delayMs: 60_000 });
  await settle();
  expect(await read()).toEqual({ orders: { pending: 2, running: 1, failed: [] } });
  await app.close();
  const bare = createCtx({ mode: "sim", seed: 1337 });
  const solo = queue({ "orders.bad": bad });
  const other = await createApp({
    topology: topology({ web: { modules: ["orders"], adapter: "node" } }),
    ctx: bare,
    mode: "dev",
    runners: { orders: [solo] },
  });
  await solo.enqueue(bare, "orders.bad", { note: "secret note" });
  await settle();
  const res = await other.fetch(new Request("http://localhost/__keel/inspect"));
  const text = await res.text();
  expect(text).not.toContain("secret note");
  const body: unknown = JSON.parse(text);
  const section = Reflect.get(
    Object(Reflect.get(Object(Reflect.get(Object(body), "sections")), "jobs.queue")),
    "value",
  );
  expect(Object(Reflect.get(Object(section), "orders"))).toMatchObject({ pending: 0, running: 0 });
  expect(Reflect.get(Object(Reflect.get(Object(section), "orders")), "failed")).toEqual([
    { id: expect.any(String), job: "orders.bad", code: "orders.rejected", at: 0 },
  ]);
  await other.close();
});
